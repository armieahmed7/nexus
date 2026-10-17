// SHR-01 · "Everything coming up" for one person, as calendar events: booked training sessions, scheduled assessments,
// development-plan due dates, qualification expiries, licence key dates, open licensing tasks and planned exam milestones.
// Pure: the caller passes the person's own rows (read with an explicit person filter) and the builders.
import type { AssessmentFormsRow, AttemptsRow, CoursesRow, DevPlansRow, EnrolmentsRow, ExamMilestonesRow, JobRolesRow, LicencesRow, LicensingTasksRow, MedicalDueRow, PlanActivitiesRow, QualRecordsRow, QualStandardsRow, RequalCyclesRow, SessionsRow } from '../../data/types';
import { upcomingOnly, type IcsEvent } from '../../domain/ics';
import { keyDates } from '../../modules/m03/licensing';
import type { CalendarEvents } from './useCalendarEvents';

const OPEN_ENROLMENT = ['assigned', 'requested', 'approved', 'waitlisted', 'enrolled', 'in_progress'];

export interface UpcomingInput {
  enrolments: EnrolmentsRow[];
  sessions: SessionsRow[];
  courses: CoursesRow[];
  attempts: AttemptsRow[];
  forms: AssessmentFormsRow[];
  plans: DevPlansRow[];
  activities: PlanActivitiesRow[];
  roles: Pick<JobRolesRow, 'id' | 'title_en' | 'title_ar'>[];
  quals: QualRecordsRow[];
  standards: QualStandardsRow[];
  licence: LicencesRow | null;
  medical: MedicalDueRow | null;
  requal: RequalCyclesRow | null;
  tasks: LicensingTasksRow[];
  milestones: ExamMilestonesRow[];
}

export function collectUpcoming(i: UpcomingInput, cal: CalendarEvents, opts: { now?: Date; sessionKind?: (kind: string) => string; roleTitle?: (r: UpcomingInput['roles'][number]) => string } = {}): IcsEvent[] {
  const now = opts.now ?? new Date();
  const session = new Map(i.sessions.map((s) => [s.id, s]));
  const course = new Map(i.courses.map((c) => [c.id, c]));
  const form = new Map(i.forms.map((f) => [f.id, f]));
  const out: (IcsEvent | null)[] = [];
  for (const e of i.enrolments) {
    const s = e.session_id ? session.get(e.session_id) : undefined;
    if (!s || s.status === 'cancelled' || !OPEN_ENROLMENT.includes(e.status) || e.status === 'waitlisted') continue;
    out.push(cal.session(s, course.get(e.course_id), '/my/learning', opts.sessionKind?.(s.kind), e.status));
  }
  for (const a of i.attempts) if (a.status === 'scheduled') out.push(cal.attempt(a, form.get(a.form_id), '/my/assessments'));
  const plan = i.plans.find((p) => p.status === 'active' || p.status === 'approved') ?? i.plans.find((p) => p.status !== 'closed');
  if (plan) {
    const role = i.roles.find((r) => r.id === plan.target_role_id);
    const title = role ? (opts.roleTitle ? opts.roleTitle(role) : role.title_en) : undefined;
    for (const a of i.activities) if (a.plan_id === plan.id && a.status !== 'done') out.push(cal.planActivity(a, '/my/plan', title));
  }
  const std = new Map(i.standards.map((s) => [s.id, s]));
  for (const q of i.quals) if (!['planned', 'in_progress', 'suspended'].includes(q.status)) out.push(cal.qualExpiry(q, std.get(q.standard_id), '/my/quals'));
  if (i.licence) {
    for (const k of keyDates(i.licence, i.medical, i.requal, now)) {
      const system = k.kind === 'medical' ? i.medical?.source_system : ['expiry', 'renewal_start', 'withdrawal'].includes(k.kind) ? i.licence.source_system : undefined;
      out.push(cal.licenceDate(k, '/my/licence', system));
    }
    for (const x of i.tasks) if (x.status === 'open') out.push(cal.licensingTask(x, '/my/licence'));
    for (const m of i.milestones) if (m.status === 'planned') out.push(cal.milestone(m, '/my/licence'));
  }
  return upcomingOnly(out.filter((e): e is IcsEvent => e !== null), now).sort((a, b) => a.start.localeCompare(b.start));
}
