// FS20 Future-skills academies and cohorts: the pure rules shared by the pages, the LocalBackend RPCs, the seed builder and (mirrored
// in SQL) supabase/migrations/20261010232001_kafaa_fs32_course_pack_academies.sql (kafaa_acad_stats_core, kafaa_acad_evidence_level).
// Import-free apart from types (node seed and validator scripts load it directly).
//
// Benchmarks: NUC-NET (the Nordic Nuclear Trainee Programme's module + project + mentor triad, so cohorts are comparable),
// UAE-PEERS (AI learning whose output is a built artefact; academies as national pipelines).
//
//  - Four academies (AI Academy, Digital Twin Bootcamp, SMR Fundamentals cohort, Energy Transition cohort), each on one template:
//    modules (FS19 pack courses), one capstone project and a mentor role; a separate reviewer signs the capstone off.
//  - Nomination: myself, my line manager or the programme owner (training W + A) nominates; the programme owner accepts (naming a
//    mentor and a reviewer: two different staff members, neither the nominee) or declines. Acceptance enrols the member in the module
//    courses (M04 enrolments, so the existing cohort views and transcripts apply).
//  - Capstone: the member submits; only the named reviewer signs it off (never the member). Merit or pass writes F01 `ojt` evidence on
//    the academy's capstone skills (merit one level higher, capped at 3), recomputes the member's skills and makes them alumni;
//    "not yet" returns it with feedback for rework.
//  - Statistics: every cohort and academy figure is suppressed when it describes fewer than 10 people (MIN_GROUP 10).
//  - Advanced-reactor content carries "no deployment decision implied"; capstone data is SIMULATED.

export const MIN_GROUP = 10;
export const MEMBER_STATUSES = ['nominated', 'accepted', 'declined', 'active', 'completed', 'withdrawn'] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];
export const OPEN_MEMBER: MemberStatus[] = ['nominated', 'accepted', 'active'];
/** Members who count as participants in cohort statistics. */
export const PARTICIPANT: MemberStatus[] = ['accepted', 'active', 'completed'];
export const COHORT_STATUSES = ['planned', 'nominating', 'running', 'completed'] as const;
export const CAPSTONE_STATUSES = ['draft', 'submitted', 'signed_off', 'returned'] as const;
export const RESULTS = ['merit', 'pass', 'not_yet'] as const;
export type CapstoneResult = (typeof RESULTS)[number];
export const ARTEFACT_KINDS = ['automation', 'analysis', 'twin_validation', 'study', 'role_delta'] as const;
export const TITLE_MIN = 3;
export const TITLE_MAX = 140;
export const SUMMARY_MIN = 20;
export const SUMMARY_MAX = 2000;
export const NOTE_MAX = 500;
export const FEEDBACK_MAX = 2000;

/** User-facing refusal messages (identical in SQL). */
export const ACAD_MSG = {
  not_signed_in: 'Sign in to use the academies',
  forbidden: 'Academies are for ENEC staff',
  forbidden_owner: 'Only the programme owner (training manager) decides nominations',
  cohort_not_found: 'Cohort not found',
  cohort_closed: 'Nominations for this cohort are closed',
  person_not_found: 'That person is not an active staff member',
  not_your_team: 'You can nominate yourself or people in your own team',
  already_open: 'There is already an open nomination or place in this academy',
  already_completed: 'Already an alumnus of this academy',
  invalid_note: 'The note is limited to 500 characters',
  not_found: 'Nomination not found',
  not_pending: 'This nomination has already been decided',
  invalid_decision: 'Choose accept or decline',
  mentor_invalid: 'Choose a mentor: an active staff member other than the nominee',
  reviewer_invalid: 'Choose a reviewer: an active staff member other than the nominee and the mentor',
  cohort_full: 'The cohort is full',
  capstone_not_found: 'Capstone not found',
  not_active: 'Your place in the cohort is not active',
  not_editable: 'This capstone is with the reviewer or already signed off',
  invalid_capstone: 'Give the capstone a title (3-140 characters) and a summary (20-2000 characters)',
  invalid_kind: 'Choose the kind of artefact',
  restricted: 'Capstones never describe plant security details',
  not_reviewer: 'Only the named reviewer signs off this capstone',
  self_signoff: 'You cannot sign off your own capstone',
  not_submitted: 'The capstone has not been submitted',
  invalid_result: 'Choose merit, pass or not yet',
  feedback_required: 'Explain what to rework (feedback up to 2000 characters)',
} as const;
export type AcadCode = keyof typeof ACAD_MSG;

/** Evidence level a capstone result records on one capstone skill: merit one level above the stated level (max 3), pass the stated
 *  level, not yet nothing. SQL: kafaa_acad_evidence_level. */
export function evidenceLevel(result: string, level: number): number {
  const l = Math.max(1, Math.min(3, Math.floor(Number(level) || 0)));
  return result === 'merit' ? Math.min(3, l + 1) : result === 'pass' ? l : 0;
}

export interface CapstoneSkill { skill_id: string; level: number }
export interface EvidenceRow {
  id: string; person_id: string; skill_id: string; kind: 'ojt'; ref_table: 'cohort_capstones'; ref_id: string; level: number; basis: 'evidenced';
  status: 'current'; observed_on: string; note: string; recorded_by: string; active: true;
}
export function capstoneEvidence(capstoneId: string, personId: string, skills: CapstoneSkill[], result: string, on: string, by: string, academyName: string): EvidenceRow[] {
  return [...skills].sort((a, b) => (a.skill_id < b.skill_id ? -1 : 1)).map((s) => ({ s, level: evidenceLevel(result, s.level) })).filter((x) => x.level > 0).map(({ s, level }) => ({
    id: `se:ojt:${capstoneId}:${s.skill_id}`, person_id: personId, skill_id: s.skill_id, kind: 'ojt' as const, ref_table: 'cohort_capstones' as const, ref_id: capstoneId,
    level, basis: 'evidenced' as const, status: 'current' as const, observed_on: on.slice(0, 10), note: `Academy capstone signed off: ${academyName}`, recorded_by: by, active: true as const,
  }));
}

/** Integer percentage rounded half up, exactly as SQL (a * 200 + b) / (2 * b). */
export const pct = (a: number, b: number): number | null => (b > 0 ? Math.floor((a * 200 + b) / (2 * b)) : null);

export interface MemberLite { id: string; cohort_id: string; academy_id: string; person_id: string; status: string }
export interface CapstoneLite { id: string; member_id: string; cohort_id: string; status: string; result?: string | null }
export interface CohortLite { id: string; academy_id: string; status: string; capacity: number; starts_on: string; sort?: number | null }
export interface EnrolLite { person_id: string; course_id: string; status: string }

export interface CohortStats {
  cohort_id: string; academy_id: string; status: string; suppressed: boolean;
  participants: number | null; nominations: number | null; alumni: number | null; completion_pct: number | null;
  module_pct: number | null; reviewed: number | null; pass_pct: number | null; merit_pct: number | null;
}
export interface AcademyStats { academy_id: string; suppressed: boolean; participants: number | null; alumni: number | null; cohorts: number; cohort_stats: CohortStats[] }
export interface StatsOut { min_group: number; academies: AcademyStats[] }

/** Cohort and academy statistics, every cell suppressed under MIN_GROUP people. SQL: kafaa_acad_stats_core(). */
export function academyStats(academies: { id: string; module_course_ids: string[]; sort?: number | null }[], cohorts: CohortLite[], members: MemberLite[], capstones: CapstoneLite[], enrolments: EnrolLite[], min = MIN_GROUP): StatsOut {
  const done = new Set(enrolments.filter((e) => e.status === 'completed').map((e) => `${e.person_id}|${e.course_id}`));
  const gate = (n: number) => (n >= min ? n : null);
  const out: AcademyStats[] = [];
  for (const a of [...academies].sort((x, y) => Number(x.sort ?? 0) - Number(y.sort ?? 0) || (x.id < y.id ? -1 : 1))) {
    const cs: CohortStats[] = [];
    for (const c of cohorts.filter((x) => x.academy_id === a.id).sort((x, y) => (x.starts_on < y.starts_on ? -1 : x.starts_on > y.starts_on ? 1 : x.id < y.id ? -1 : 1))) {
      const mem = members.filter((m) => m.cohort_id === c.id);
      const part = mem.filter((m) => (PARTICIPANT as string[]).includes(m.status));
      const n = part.length;
      const nom = mem.filter((m) => m.status === 'nominated').length;
      if (n < min) {
        cs.push({ cohort_id: c.id, academy_id: a.id, status: c.status, suppressed: true, participants: null, nominations: gate(nom), alumni: null, completion_pct: null, module_pct: null, reviewed: null, pass_pct: null, merit_pct: null });
        continue;
      }
      const alumni = part.filter((m) => m.status === 'completed').length;
      const mods = a.module_course_ids ?? [];
      const doneMods = part.reduce((t, m) => t + mods.filter((cid) => done.has(`${m.person_id}|${cid}`)).length, 0);
      const ids = new Set(part.map((m) => m.id));
      const caps = capstones.filter((k) => ids.has(k.member_id));
      const reviewed = caps.filter((k) => k.status === 'signed_off' || k.status === 'returned');
      const passed = reviewed.filter((k) => k.status === 'signed_off').length;
      const merit = reviewed.filter((k) => k.status === 'signed_off' && k.result === 'merit').length;
      const rv = reviewed.length;
      cs.push({
        cohort_id: c.id, academy_id: a.id, status: c.status, suppressed: false, participants: n, nominations: gate(nom), alumni: gate(alumni),
        completion_pct: pct(alumni, n), module_pct: mods.length ? pct(doneMods, n * mods.length) : null,
        reviewed: gate(rv), pass_pct: rv >= min ? pct(passed, rv) : null, merit_pct: rv >= min ? pct(merit, rv) : null,
      });
    }
    const persons = new Set(members.filter((m) => m.academy_id === a.id && (PARTICIPANT as string[]).includes(m.status)).map((m) => m.person_id));
    const alum = new Set(members.filter((m) => m.academy_id === a.id && m.status === 'completed').map((m) => m.person_id));
    out.push({ academy_id: a.id, suppressed: persons.size < min, participants: gate(persons.size), alumni: gate(alum.size), cohorts: cs.length, cohort_stats: cs });
  }
  return { min_group: min, academies: out };
}

/** My progress in one academy: module courses completed and the stage I am at. */
export type Stage = 'nominated' | 'accepted' | 'modules' | 'capstone_draft' | 'capstone_submitted' | 'capstone_returned' | 'alumni' | 'declined' | 'withdrawn';
export function memberStage(m: { status: string }, cap: { status: string } | null | undefined, modulesDone: number, modulesTotal: number): Stage {
  if (m.status === 'nominated' || m.status === 'declined' || m.status === 'withdrawn') return m.status as Stage;
  if (m.status === 'completed') return 'alumni';
  if (m.status === 'accepted') return 'accepted';
  if (cap?.status === 'submitted') return 'capstone_submitted';
  if (cap?.status === 'returned') return 'capstone_returned';
  if (modulesTotal > 0 && modulesDone < modulesTotal && (!cap || cap.status === 'draft')) return 'modules';
  return 'capstone_draft';
}
export const STAGE_ORDER: Stage[] = ['nominated', 'accepted', 'modules', 'capstone_draft', 'capstone_submitted', 'capstone_returned', 'alumni'];

export const memberId = (cohortId: string, personId: string) => `am-${cohortId.replace(/^ac-/, '')}-${personId.replace(/^[pw]-/, '')}`;
export const capstoneId = (mId: string) => `cc-${mId.replace(/^am-/, '')}`;
export const academyEnrolmentId = (mId: string, courseId: string) => `en-${mId}-${courseId.replace(/^c-fs-/, '')}`;
