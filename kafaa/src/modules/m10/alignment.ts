/**
 * FS66 University programme alignment: pure rules shared by both backends, the seed builder, the pages and the PGlite validator.
 * Import-free apart from other import-free rule files (node loads it directly). SQL mirror: kafaa_ua_* in
 * supabase/migrations/20261010274001_kafaa_fs74_university_alignment.sql; scripts/validate/fs74-university-alignment.mjs proves SQL = TS.
 *
 * A university maps one of its programmes to ENEC skills and levels (each skill names the modules that teach it). Coverage reuses the
 * FS57 rule (src/modules/m25/coverage.ts: requirementsOf + scoreReqs over the published FS05 role profile of each target role, now and
 * 2030), with the programme as the only teaching source: a mapped skill counts up to the learning ceiling (level 2), exactly like a
 * catalogue course. International anchors come from the FS08 crosswalk (published, listed skill_alignments).
 *
 * Endorsement (an INMA-style review): a framework owner (frameworks A) who did not submit the programme checks three things the system
 * computes (every mapped skill names its modules; at least one target role reaches the coverage threshold; every mapped skill has a
 * published international anchor) and confirms three things only a reviewer can (the programme assesses the mapped skills, includes an
 * industry placement or project, and holds its national accreditation). An endorsement covers graduates from `covers_from` to
 * `valid_to` (three years after the decision, then it lapses and must be renewed).
 *
 * Evidence at hire: when HR records the hire of a graduate of an endorsed programme whose graduation date falls inside the endorsement
 * window, every mapped skill becomes F01 evidence `se:programme:<graduate>:<skill>` (kind credential, basis validated, ref_table
 * programme_alignments, level capped at 2, observed on the graduation date). Nothing is written for a programme that is not endorsed:
 * the record waits, and the endorsement writes it later if the graduation date is covered.
 *
 * Every programme row in the demo is a SAMPLE: an illustrative mapping, not an actual ENEC endorsement of a real university's degree.
 */
import { HORIZONS, LEARN_CEILING, rdivC, requirementsOf, restrictedSkills, scoreReqs } from '../m25/coverage.ts';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export const DEGREES = ['bachelor', 'master', 'diploma', 'doctorate', 'certificate'] as const;
export type Degree = (typeof DEGREES)[number];
export const UA_STATUSES = ['draft', 'submitted', 'endorsed', 'returned'] as const;
export type UaStatus = (typeof UA_STATUSES)[number];
export const AUTO_CRITERIA = ['outcomes', 'coverage', 'crosswalk'] as const;
export const REVIEW_CRITERIA = ['assessment', 'placement', 'accreditation'] as const;
export type ReviewCriterion = (typeof REVIEW_CRITERIA)[number];
export const UA_DECISIONS = ['endorse', 'return'] as const;
/** Best target-role coverage (now or 2030) needed to endorse. */
export const COVERAGE_MIN = 40;
/** Endorsement period (Kafa'a demo policy): renew after three years. */
export const ENDORSE_YEARS = 3;
export const UA_LEVEL_MAX = LEARN_CEILING;
export const SKILLS_MIN = 3;
export const SKILLS_MAX = 30;
export const ROLES_MAX = 4;
export const GRAD_STATUSES = ['evidence_written', 'awaiting_endorsement', 'not_covered'] as const;
export type GradStatus = (typeof GRAD_STATUSES)[number];
export const UA_REF_TABLE = 'programme_alignments';

/** User-facing refusal messages (identical in the SQL functions). */
export const UA_MSG = {
  not_signed_in: 'Sign in first',
  forbidden_save: 'Only the university that owns the programme (or an ENEC partnerships admin) can edit it',
  forbidden_endorse: 'Only a framework owner can endorse a programme',
  forbidden_hire: 'Only the HR director records graduate hires',
  not_found: 'Programme not found',
  locked: 'The programme is under review; wait for the decision before editing',
  exists: 'A programme with this code already exists for the university',
  org: 'Choose a university organisation',
  code: 'Give a programme code of 2 to 30 letters, digits, spaces, dots, dashes or slashes',
  title: 'Give the title in English and Arabic (3 to 160 characters each)',
  degree: 'Choose the award: bachelor, master, diploma, doctorate or certificate',
  nqf: 'The indicative NQF level is a whole number from 1 to 10, or empty',
  field: 'The field of study is at most 120 characters in each language',
  summary: 'The summary is at most 600 characters in each language',
  roles: 'Choose 1 to 4 current ENEC roles graduates target (security roles are career-path only)',
  skills: 'Map 3 to 30 different skills, each at level 1 or 2 with 1 to 6 modules (2 to 80 characters); security and obsolete skills cannot be mapped',
  accreditation: 'The accreditation reference is at most 120 characters',
  status: 'Only a submitted programme can be decided',
  maker_checker: 'The person who submitted the programme cannot decide it',
  decision: 'Choose endorse or return',
  note: 'Explain the decision in 10 to 500 characters',
  criteria: 'Confirm assessment, placement and accreditation before endorsing',
  auto: 'The programme does not yet meet the computed criteria (modules for every skill, coverage threshold, international anchors)',
  covers: 'The first graduation date covered must be within the three years before today',
  person: 'Choose a graduate (an applicant or a member of staff)',
  programme: 'Choose a university programme',
  duplicate: 'This graduate is already recorded for this programme',
  graduated: 'Give a graduation date between 1 Jan 2000 and today',
  hired: 'The hire date is on or after the graduation date and at most a year ahead',
} as const;
export type UaCode = keyof typeof UA_MSG;

const str = (v: unknown) => (typeof v === 'string' ? v.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '') : '');
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
export const isIsoDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
/** Calendar years added like SQL (date + interval 'n years'): 29 Feb falls back to 28 Feb. */
export function addYears(iso: string, n: number): string {
  const y = Number(iso.slice(0, 4)) + n, m = Number(iso.slice(5, 7)), d = Number(iso.slice(8, 10));
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}
export const d10 = (v: unknown) => (v == null ? null : String(v).slice(0, 10));

export interface ProgrammeSkill { skill_id: string; level: number; modules: string[] }
export interface UaWorld {
  skills: Row[]; // id, competency_id, core, area, lifecycle, name_en, name_ar
  competencies: Row[]; // id, domain
  job_roles: Row[]; // id, sort, lifecycle, security_sensitive
  role_profile_versions: Row[]; // id, role_id, horizon, status, path_only, requirements
  skill_alignments: Row[]; // skill_id, framework, external_code, label_en, label_ar, status, listed, sort, id
  organisations?: Row[]; // id, kind
}

// ───────────── coverage (the FS57 rule with the programme as the teaching source)
export interface ProgrammeRoleCoverage { role_id: string; horizon: string; version_id: string; score: number | null; n: number; covered: number; uncovered: string[] }
export interface ProgrammeCoverage { roles: ProgrammeRoleCoverage[]; now: number | null; h2030: number | null; best: number | null }

/** Mapped skills as taught levels (skill -> min(level, ceiling)); restricted skills never count. */
export function taughtOf(skills: unknown, restricted: Set<string>): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of (Array.isArray(skills) ? skills : []) as Row[]) {
    if (!s || typeof s.skill_id !== 'string' || !isInt(s.level) || s.level < 1 || restricted.has(s.skill_id)) continue;
    out.set(s.skill_id, Math.max(out.get(s.skill_id) ?? 0, Math.min(s.level, LEARN_CEILING)));
  }
  return out;
}

/** Coverage of each target role (job-role sort, then id) for now and 2030 (now first): the published profile version with the
 *  smallest id, path-only versions skipped; means per horizon (half away from zero) and the best single score. */
export function programmeCoverage(p: { skills?: unknown; target_role_ids?: unknown }, w: UaWorld): ProgrammeCoverage {
  const restricted = restrictedSkills(w.skills, w.competencies);
  const taught = taughtOf(p.skills, restricted);
  const sort = new Map(w.job_roles.map((r) => [String(r.id), Number(r.sort ?? 0)]));
  const targets = [...new Set((Array.isArray(p.target_role_ids) ? p.target_role_ids : []).filter((x): x is string => typeof x === 'string' && sort.has(x)))]
    .sort((a, b) => sort.get(a)! - sort.get(b)! || cmp(a, b));
  const roles: ProgrammeRoleCoverage[] = [];
  for (const h of HORIZONS) {
    for (const r of targets) {
      const v = w.role_profile_versions.filter((x) => x.role_id === r && x.horizon === h && x.status === 'published').sort((a, b) => cmp(String(a.id), String(b.id)))[0];
      if (!v || v.path_only === true) continue;
      const s = scoreReqs(requirementsOf(v, w.skills, restricted), (k) => taught.get(k) ?? 0);
      roles.push({ role_id: r, horizon: h, version_id: String(v.id), score: s.score, n: s.reqs.length, covered: s.covered, uncovered: s.reqs.filter((q) => q.taught < q.target).map((q) => q.skill_id) });
    }
  }
  const mean = (h: string) => { const xs = roles.filter((x) => x.horizon === h && x.score !== null).map((x) => x.score as number); return xs.length ? rdivC(xs.reduce((a, b) => a + b, 0), xs.length) : null; };
  const scored = roles.filter((x) => x.score !== null).map((x) => x.score as number);
  return { roles, now: mean('now'), h2030: mean('2030'), best: scored.length ? Math.max(...scored) : null };
}

// ───────────── international anchors (FS08 crosswalk)
export interface Anchor { framework: string; code: string; label_en: string; label_ar: string }
export function anchorsOf(skillId: string, alignments: Row[]): Anchor[] {
  return alignments.filter((a) => a.skill_id === skillId && a.status === 'published' && a.listed === true)
    .sort((a, b) => cmp(String(a.framework), String(b.framework)) || Number(a.sort ?? 0) - Number(b.sort ?? 0) || cmp(String(a.id), String(b.id)))
    .map((a) => ({ framework: String(a.framework), code: String(a.external_code ?? ''), label_en: String(a.label_en ?? ''), label_ar: String(a.label_ar ?? '') }));
}

export interface AutoCriteria { outcomes: boolean; coverage: boolean; crosswalk: boolean }
/** The three computed endorsement criteria. */
export function autoCriteria(p: { skills?: unknown; target_role_ids?: unknown }, w: UaWorld): AutoCriteria {
  const skills = (Array.isArray(p.skills) ? p.skills : []) as Row[];
  const cov = programmeCoverage(p, w);
  const anchored = new Set(w.skill_alignments.filter((a) => a.status === 'published' && a.listed === true).map((a) => String(a.skill_id)));
  return {
    outcomes: skills.length > 0 && skills.every((s) => Array.isArray(s.modules) && s.modules.length > 0),
    coverage: cov.best !== null && cov.best >= COVERAGE_MIN,
    crosswalk: skills.length > 0 && skills.every((s) => anchored.has(String(s.skill_id))),
  };
}

// ───────────── save (university, own organisation)
export interface ProgrammeInput {
  id?: unknown; university_org_id?: unknown; code?: unknown; title_en?: unknown; title_ar?: unknown; degree?: unknown; nqf_level?: unknown;
  field_en?: unknown; field_ar?: unknown; summary_en?: unknown; summary_ar?: unknown; target_role_ids?: unknown; skills?: unknown;
  placement?: unknown; accreditation_ref?: unknown; submit?: unknown;
}
const lenOk = (v: unknown, min: number, max: number) => (v == null || typeof v === 'string') && str(v).length >= min && str(v).length <= max;

/** First problem of a programme draft (null = valid). */
export function programmeProblem(p: ProgrammeInput, w: UaWorld): UaCode | null {
  const org = (w.organisations ?? []).find((o) => o.id === p.university_org_id);
  if (!org || org.kind !== 'university') return 'org';
  if (typeof p.code !== 'string' || !/^[A-Za-z0-9 .\-/]{2,30}$/.test(str(p.code)) || str(p.code).length < 2) return 'code';
  if (typeof p.title_en !== 'string' || typeof p.title_ar !== 'string' || !lenOk(p.title_en, 3, 160) || !lenOk(p.title_ar, 3, 160)) return 'title';
  if (typeof p.degree !== 'string' || !(DEGREES as readonly string[]).includes(p.degree)) return 'degree';
  if (p.nqf_level != null && (!isInt(p.nqf_level) || p.nqf_level < 1 || p.nqf_level > 10)) return 'nqf';
  if (!lenOk(p.field_en, 0, 120) || !lenOk(p.field_ar, 0, 120)) return 'field';
  if (!lenOk(p.summary_en, 0, 600) || !lenOk(p.summary_ar, 0, 600)) return 'summary';
  const roles = Array.isArray(p.target_role_ids) ? p.target_role_ids : null;
  if (!roles || roles.length < 1 || roles.length > ROLES_MAX || new Set(roles).size !== roles.length) return 'roles';
  for (const r of roles) {
    const jr = w.job_roles.find((x) => x.id === r);
    if (typeof r !== 'string' || !jr || jr.lifecycle === 'concept' || jr.security_sensitive === true) return 'roles';
  }
  const restricted = restrictedSkills(w.skills, w.competencies);
  const skills = Array.isArray(p.skills) ? (p.skills as unknown[]) : null;
  if (!skills || skills.length < SKILLS_MIN || skills.length > SKILLS_MAX) return 'skills';
  const seen = new Set<string>();
  for (const s0 of skills) {
    const s = s0 as Row;
    if (!s || typeof s !== 'object' || Array.isArray(s) || typeof s.skill_id !== 'string' || seen.has(s.skill_id)) return 'skills';
    seen.add(s.skill_id);
    const sk = w.skills.find((x) => x.id === s.skill_id);
    if (!sk || restricted.has(s.skill_id) || sk.lifecycle === 'obsolete') return 'skills';
    if (!isInt(s.level) || s.level < 1 || s.level > UA_LEVEL_MAX) return 'skills';
    if (!Array.isArray(s.modules) || s.modules.length < 1 || s.modules.length > 6 || !s.modules.every((m: unknown) => typeof m === 'string' && str(m).length >= 2 && str(m).length <= 80)) return 'skills';
  }
  if (!lenOk(p.accreditation_ref, 0, 120)) return 'accreditation';
  return null;
}

/** The stored form of a valid draft's skills: trimmed modules, sorted by skill id. */
export function cleanSkills(skills: unknown): ProgrammeSkill[] {
  return ((Array.isArray(skills) ? skills : []) as Row[])
    .map((s) => ({ skill_id: String(s.skill_id), level: Number(s.level), modules: (s.modules as unknown[]).map((m) => str(m)) }))
    .sort((a, b) => cmp(a.skill_id, b.skill_id));
}
export const programmeId = (org: string, code: string) => `ua-${org}-${str(code).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;

// ───────────── decision (frameworks A, maker-checker)
export interface DecisionInput { decision?: unknown; note?: unknown; criteria?: unknown; covers_from?: unknown }
/** First problem of an endorsement decision (null = valid). */
export function decisionProblem(d: DecisionInput, row: Row | undefined, me: string, auto: AutoCriteria | null, today: string): UaCode | null {
  if (!row) return 'not_found';
  if (row.status !== 'submitted') return 'status';
  if (row.submitted_by === me) return 'maker_checker';
  if (typeof d.decision !== 'string' || !(UA_DECISIONS as readonly string[]).includes(d.decision)) return 'decision';
  const n = typeof d.note === 'string' ? str(d.note).length : 0;
  if (n < 10 || n > 500) return 'note';
  if (d.decision === 'endorse') {
    const c = (d.criteria && typeof d.criteria === 'object' && !Array.isArray(d.criteria) ? d.criteria : {}) as Row;
    if (!REVIEW_CRITERIA.every((k) => c[k] === true)) return 'criteria';
    if (!auto || !AUTO_CRITERIA.every((k) => auto[k])) return 'auto';
    if (d.covers_from != null && (!isIsoDate(d.covers_from) || d.covers_from > today || d.covers_from < addYears(today, -ENDORSE_YEARS))) return 'covers';
  }
  return null;
}
/** Default first graduation date covered: 1 January of the previous year. */
export const defaultCoversFrom = (today: string) => `${Number(today.slice(0, 4)) - 1}-01-01`;

// ───────────── graduates (HR, at hire)
export interface HireInput { person_id?: unknown; programme_id?: unknown; graduated_on?: unknown; hired_on?: unknown }
export const graduateId = (programme: string, person: string) => `pg-${programme}-${person}`;
export function hireProblem(h: HireInput, person: Row | undefined, programme: Row | undefined, exists: boolean, today: string): UaCode | null {
  if (!person || !['applicant', 'staff'].includes(String(person.kind)) || person.status === 'leaver') return 'person';
  if (!programme) return 'programme';
  if (exists) return 'duplicate';
  if (!isIsoDate(h.graduated_on) || h.graduated_on < '2000-01-01' || h.graduated_on > today) return 'graduated';
  if (!isIsoDate(h.hired_on) || h.hired_on < h.graduated_on || h.hired_on > addYears(today, 1)) return 'hired';
  return null;
}
/** Is a graduation date inside the programme's endorsement window? */
export function covered(programme: Row, graduatedOn: string): boolean {
  const from = d10(programme.covers_from), to = d10(programme.valid_to);
  return programme.status === 'endorsed' && !!from && !!to && graduatedOn >= from && graduatedOn <= to;
}
export function gradStatus(programme: Row, graduatedOn: string): GradStatus {
  if (covered(programme, graduatedOn)) return 'evidence_written';
  return programme.status === 'endorsed' ? 'not_covered' : 'awaiting_endorsement';
}
export interface EvidenceRow { id: string; person_id: string; skill_id: string; kind: 'credential'; ref_table: string; ref_id: string; level: number; basis: 'validated'; status: 'current'; observed_on: string; note: string }
export const evidenceId = (grad: string, skill: string) => `se:programme:${grad}:${skill}`;
/** The validated evidence a covered graduate gets: every mapped skill that is still live (not restricted, not obsolete), level <= 2. */
export function graduateEvidence(grad: { id: string; person_id: string; graduated_on: string }, programme: Row, w: Pick<UaWorld, 'skills' | 'competencies'>): EvidenceRow[] {
  if (!covered(programme, grad.graduated_on)) return [];
  const restricted = restrictedSkills(w.skills, w.competencies);
  const live = new Set(w.skills.filter((s) => s.lifecycle !== 'obsolete').map((s) => String(s.id)));
  return [...taughtOf(programme.skills, restricted)].filter(([s]) => live.has(s)).sort((a, b) => cmp(a[0], b[0])).map(([skill_id, level]) => ({
    id: evidenceId(grad.id, skill_id), person_id: grad.person_id, skill_id, kind: 'credential', ref_table: UA_REF_TABLE, ref_id: String(programme.id), level,
    basis: 'validated', status: 'current', observed_on: grad.graduated_on, note: `Endorsed programme ${programme.code}`,
  }));
}

/** Display status: an endorsement past its valid_to reads "lapsed". */
export function displayStatus(row: Row, today: string): UaStatus | 'lapsed' {
  if (row.status === 'endorsed' && d10(row.valid_to) && d10(row.valid_to)! < today) return 'lapsed';
  return row.status as UaStatus;
}
