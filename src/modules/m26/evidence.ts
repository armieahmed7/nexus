// F29 evidence facts for a programme (what Kafa'a holds that an accreditation self-evaluation can cite) and the F27 role
// traceability summary they reuse. Pure; the LocalBackend RPC accrEvidence and the SQL kafaa_accr_evidence_compute compute the
// same numbers from the same rows (PGlite parity check in scripts/validate/w4e2-sat.mjs). Counts only, never people.
// F25 (L3 observations) and F31 (instructor tracks) are optional sources: when their tables exist the facts use them.
import { coverage, roleCurriculum, type Coverage, type LinkLite, type ObjectiveLite, type TaskLite } from './sat.ts';
import type { EvidenceFact } from './accr.ts';
import { addDaysIso } from './accr.ts';

export interface TraceData {
  tasks: TaskLite[];
  links: LinkLite[];
  objectives: (ObjectiveLite & { competency_id?: string | null })[];
  roleComps: { role_id: string; competency_id: string }[];
  courses: { id: string; programme_id: string | null; competency_ids: string[] | null; evaluation_form_id?: string | null; initial: boolean; audience?: string | null }[];
}

/** The objectives a role is answerable for: its curriculum courses' objectives and SAT objectives written for the role. */
export function roleScopeObjectives(roleId: string, d: TraceData): ObjectiveLite[] {
  const roleTaskIds = new Set(d.tasks.filter((t) => t.role_id === roleId).map((t) => t.id));
  const linkedCourses = d.links.filter((l) => l.active && roleTaskIds.has(l.task_id) && l.course_id).map((l) => l.course_id as string);
  const curr = new Set(roleCurriculum(roleId, d.roleComps, d.courses, linkedCourses));
  return d.objectives.filter((o) => (o.course_id && curr.has(o.course_id)) || (o.source === 'sat' && o.role_id === roleId));
}

export const continuingCourses = (courses: TraceData['courses']) => new Set(courses.filter((c) => !c.initial).map((c) => c.id));

export function roleCoverage(roleId: string, d: TraceData): Coverage {
  return coverage(d.tasks.filter((t) => t.role_id === roleId), d.links, d.tasks, roleScopeObjectives(roleId, d), continuingCourses(d.courses));
}

export interface EvidenceData extends TraceData {
  programme: { id: string; role_ids: string[]; standard_ids: string[]; course_ids: string[] };
  analyses: { role_id: string; restricted: boolean }[];
  items: { id: string; bank: string; status: string; competency_id: string | null }[];
  forms: { id: string; course_id: string | null }[];
  attempts: { form_id: string; released: boolean }[];
  evaluatorQuals: { person_id: string; standard_id: string; valid_to: string }[];
  qualRecords: { id: string; person_id: string; standard_id: string; status: string }[];
  evaluations: { record_id: string; date: string; supervisor_ack_at: string | null }[];
  trainingRecords: { course_id: string; completed_on: string; result: string }[];
  sessions: { course_id: string; status: string }[];
  /** F25 kafaa_l3_observations rows (course_id), or null when the table does not exist. */
  l3: { course_id: string | null }[] | null;
  /** F31 kafaa_instructor_tracks rows, or null when the table does not exist. */
  tracks: unknown[] | null;
}

export const programmeCourseIds = (d: Pick<EvidenceData, 'programme' | 'courses'>) =>
  [...new Set([...d.courses.filter((c) => c.programme_id === d.programme.id).map((c) => c.id), ...d.programme.course_ids])].sort();

export function evidenceFacts(d: EvidenceData, today: string): EvidenceFact[] {
  const out: EvidenceFact[] = [];
  const p = d.programme;
  const courseIds = programmeCourseIds(d);
  const cset = new Set(courseIds);
  const yearAgo = addDaysIso(today, -365);
  // traceability (F27): one fact per analysed, non-restricted role of the programme
  const analysed = new Set(d.analyses.filter((a) => !a.restricted).map((a) => a.role_id));
  for (const role of [...p.role_ids].sort()) {
    if (!analysed.has(role)) continue;
    const c = roleCoverage(role, d);
    out.push({ kind: 'traceability', ref: role, route: `/training/sat/roles/${role}`, m: { tasks: c.rows.length, selected: c.selected, covered: c.covered, gaps: c.gaps.length, orphans: c.orphans.length } });
  }
  // effectiveness (F25 L3 observations when present; course evaluation forms otherwise)
  const progCourses = d.courses.filter((c) => cset.has(c.id));
  if (d.l3) {
    const l3 = d.l3.filter((x) => x.course_id && cset.has(x.course_id));
    if (l3.length) out.push({ kind: 'effectiveness', ref: p.id, route: '/training/effectiveness', m: { l3: l3.length, courses: new Set(l3.map((x) => x.course_id)).size } });
  }
  const withForm = progCourses.filter((c) => c.evaluation_form_id).length;
  if (withForm) out.push({ kind: 'effectiveness', ref: `${p.id}:forms`, route: '/training/courses', m: { courses: progCourses.length, with_form: withForm } });
  // item analysis (M05): approved bank items on the programme's competencies; released attempts on its course forms
  const comps = new Set(progCourses.flatMap((c) => c.competency_ids ?? []));
  const items = d.items.filter((i) => i.status === 'approved' && i.competency_id && comps.has(i.competency_id)).length;
  const formIds = new Set(d.forms.filter((f) => f.course_id && cset.has(f.course_id)).map((f) => f.id));
  const released = d.attempts.filter((a) => a.released && formIds.has(a.form_id)).length;
  if (items || released) out.push({ kind: 'item_analysis', ref: p.id, route: '/training/items', m: { items, released } });
  // instructor qualifications (F31 tracks when present; M02 evaluator qualifications and the instructor standard)
  const std = new Set(p.standard_ids);
  const eq = d.evaluatorQuals.filter((e) => std.has(e.standard_id) && e.valid_to >= today);
  const evaluators = new Set(eq.map((e) => e.person_id)).size;
  const standards = new Set(eq.map((e) => e.standard_id)).size;
  const instructors = new Set(d.qualRecords.filter((r) => r.standard_id === 'qs-instr' && ['qualified', 'due', 'renewed'].includes(r.status)).map((r) => r.person_id)).size;
  if (d.tracks && d.tracks.length) out.push({ kind: 'instructor_quals', ref: `${p.id}:tracks`, route: '/training/instructors', m: { tracks: d.tracks.length, evaluators, standards } });
  if (evaluators) out.push({ kind: 'instructor_quals', ref: p.id, route: '/training/quals/qs-instr', m: { evaluators, standards, instructors } });
  // sign-off timeliness (M02): evaluations on records of the programme's standards in the last 12 months
  const recStd = new Map(d.qualRecords.map((r) => [r.id, r.standard_id]));
  const ev = d.evaluations.filter((e) => std.has(recStd.get(e.record_id) ?? '') && e.date >= yearAgo && e.date <= today);
  if (ev.length) out.push({ kind: 'signoff_timeliness', ref: p.id, route: '/training/quals', m: { evaluations: ev.length, acknowledged: ev.filter((e) => !!e.supervisor_ack_at).length } });
  // programme records (M04): completions in the last 12 months and sessions
  const tr = d.trainingRecords.filter((r) => cset.has(r.course_id) && r.completed_on >= yearAgo && r.completed_on <= today);
  const sessions = d.sessions.filter((s) => cset.has(s.course_id) && s.status !== 'cancelled').length;
  if (tr.length || sessions) out.push({ kind: 'programme_records', ref: p.id, route: '/training/schedule', m: { records: tr.length, passed: tr.filter((r) => r.result === 'passed' || r.result === 'completed').length, sessions } });
  return out;
}
