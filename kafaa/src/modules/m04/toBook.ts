/**
 * MGR-05: the "To book" worklist on /training/cohorts. Pure rules over rows the caller can already read (RLS decides which
 * enrolments, people and sessions come back), so the page and the unit tests share them.
 *
 * An enrolment needs a seat when it is assigned or approved and is not booked on a scheduled session (a booking on a cancelled
 * or closed session does not count, the same rule rpc.enrolCourse applies before it books the existing row onto a session).
 * Self-paced e-learning and on-the-job training need no seat unless the course is run as sessions.
 * Prerequisites are checked as rpc.enrolCourse checks them (passed, completed or attended records, completed enrolments), so
 * "Book N" only offers people the RPC would book; the others are listed with the courses they still need.
 */
import type { CoursesRow, EnrolmentsRow, PeopleRow, SessionsRow, TrainingRecordsRow } from '../../data/types';
import { holdsSeat, missingPrerequisites } from '../../domain/learning';

export type BookPriority = 'licence_critical' | 'mandatory' | 'elective';
export const PRIORITY_RANK: Record<BookPriority, number> = { licence_critical: 0, mandatory: 1, elective: 2 };
const WAITING = ['assigned', 'approved'];
const SELF_PACED = ['elearning', 'ojt'];

export interface ToBookItem {
  e: EnrolmentsRow;
  person: PeopleRow | undefined;
  course: CoursesRow | undefined;
  priority: BookPriority;
  /** Days until the due date (negative when overdue); null without a due date. */
  dueIn: number | null;
  /** Prerequisite course ids not completed yet (booking is refused until they are). */
  missing: string[];
}
export interface OpenSession {
  s: SessionsRow;
  taken: number;
  free: number;
}

const dayMs = 86400000;
export const daysFrom = (iso: string | null | undefined, nowIso: string): number | null => (iso ? Math.floor((Date.parse(iso.slice(0, 10)) - Date.parse(nowIso.slice(0, 10))) / dayMs) : null);

/** Licence-critical when the course runs licence-critical sessions (COCT, requalification); mandatory for mandatory courses and role rules. */
export function bookPriority(course: CoursesRow | undefined, e: EnrolmentsRow, sessions: SessionsRow[]): BookPriority {
  if (sessions.some((s) => s.course_id === e.course_id && s.priority === 'licence_critical')) return 'licence_critical';
  if (course?.mandatory || e.source === 'role_rule') return 'mandatory';
  return 'elective';
}

/** Course ids each person has completed, as rpc.enrolCourse counts them for prerequisites. */
export function completedByPerson(records: TrainingRecordsRow[], enrolments: EnrolmentsRow[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const add = (p: string, c: string) => out.set(p, (out.get(p) ?? new Set()).add(c));
  for (const r of records) if (['passed', 'completed', 'attended'].includes(r.result)) add(r.person_id, r.course_id);
  for (const e of enrolments) if (e.status === 'completed') add(e.person_id, e.course_id);
  return out;
}

/** Assigned or approved enrolments without a seat on a scheduled session, most urgent first (priority, then due date). */
export function toBookList(enrolments: EnrolmentsRow[], sessions: SessionsRow[], courses: Map<string, CoursesRow>, people: Map<string, PeopleRow>, nowIso: string, records: TrainingRecordsRow[] = []): ToBookItem[] {
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const done = completedByPerson(records, enrolments);
  const runAsSessions = new Set(sessions.map((s) => s.course_id));
  const out: ToBookItem[] = [];
  for (const e of enrolments) {
    if (!WAITING.includes(e.status)) continue;
    if (e.session_id && byId.get(e.session_id)?.status === 'scheduled') continue;
    const course = courses.get(e.course_id);
    if (course && SELF_PACED.includes(course.modality) && !runAsSessions.has(e.course_id)) continue;
    const person = people.get(e.person_id);
    if (person && person.status !== 'active') continue;
    out.push({ e, person, course, priority: bookPriority(course, e, sessions), dueIn: daysFrom(e.due_on, nowIso), missing: missingPrerequisites(course?.prerequisites ?? [], done.get(e.person_id) ?? []) });
  }
  return out.sort(byUrgency);
}
export function byUrgency(a: ToBookItem, b: ToBookItem): number {
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || (a.dueIn ?? 1e9) - (b.dueIn ?? 1e9) || a.e.id.localeCompare(b.e.id);
}

/** Scheduled sessions of a course that have not started, soonest first, with the seats still free. */
export function openSessions(courseId: string, sessions: SessionsRow[], enrolments: EnrolmentsRow[], nowIso: string): OpenSession[] {
  return sessions
    .filter((s) => s.course_id === courseId && s.status === 'scheduled' && s.starts_at > nowIso)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .map((s) => {
      const taken = enrolments.filter((e) => e.session_id === s.id && holdsSeat(e.status)).length;
      return { s, taken, free: Math.max(0, s.capacity - taken) };
    });
}

/** Who may take a seat on this session: prerequisites met; a crew session (simulator) only takes its own crew; staff sessions only staff. */
export function eligibleFor(s: SessionsRow, items: ToBookItem[]): ToBookItem[] {
  return items.filter((x) => x.e.course_id === s.course_id && x.missing.length === 0 && (!s.crew || x.person?.crew === s.crew) && (s.audience !== 'staff' || !x.person || x.person.kind === 'staff'));
}

/** The people to book on a session: the most urgent eligible ones, no more than the free seats. */
export function pickForSession(o: OpenSession, items: ToBookItem[]): ToBookItem[] {
  return eligibleFor(o.s, items).sort(byUrgency).slice(0, o.free);
}

export interface CourseGroup {
  courseId: string;
  course: CoursesRow | undefined;
  items: ToBookItem[];
  priority: BookPriority;
  earliestDue: number | null;
  open: OpenSession[];
  freeSeats: number;
}
/** One group per course, most urgent first; each with its open sessions and free seats. */
export function groupByCourse(items: ToBookItem[], sessions: SessionsRow[], enrolments: EnrolmentsRow[], nowIso: string): CourseGroup[] {
  const map = new Map<string, ToBookItem[]>();
  for (const x of items) map.set(x.e.course_id, [...(map.get(x.e.course_id) ?? []), x]);
  return [...map.entries()]
    .map(([courseId, xs]) => {
      const open = openSessions(courseId, sessions, enrolments, nowIso);
      const dues = xs.map((x) => x.dueIn).filter((d): d is number => d != null);
      return { courseId, course: xs[0].course, items: xs, priority: xs.reduce<BookPriority>((p, x) => (PRIORITY_RANK[x.priority] < PRIORITY_RANK[p] ? x.priority : p), 'elective'), earliestDue: dues.length ? Math.min(...dues) : null, open, freeSeats: open.reduce((n, o) => n + o.free, 0) };
    })
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || (a.earliestDue ?? 1e9) - (b.earliestDue ?? 1e9) || b.items.length - a.items.length || a.courseId.localeCompare(b.courseId));
}
