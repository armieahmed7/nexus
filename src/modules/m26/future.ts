// FS06 Task layer with AI exposure and change horizon: the pure rules shared by the pages, the LocalBackend RPCs, the seed builder
// and (mirrored in SQL) supabase/migrations/20261010215001_kafaa_fs15_task_future.sql. Import-free apart from types (node seed and
// validator scripts load it directly).
//
// Benchmarks: OECD AI Capability Indicators (2025): ten capability dimensions, each on a five-level scale, so a task's human
// requirement and AI capability can be compared on the same axes; SkillsFuture Singapore "AI Potential on Tasks" (2025): exposure
// per task, shown as "what the tool will do, what you will still own"; O*NET Hot Technologies / Bright Outlook: technology badges
// with published thresholds.
//
//  - Every non-restricted JTA task carries `ai_capability_needed`: the level (1-5) the task demands on 1 to 4 relevant OECD
//    dimensions, a change horizon (now, 2030, 2035) and a technology driver.
//  - The AI capability reached on each dimension at each horizon is a seeded reference row (kafaa_ai_capability_levels), labelled
//    SIMULATED: an ENEC planning assumption on the OECD scale, not an OECD rating.
//  - exposureOf(task, levels): the dimensions where AI capability >= the task's need at its horizon are "covered". First match wins:
//      1. fewer than half the dimensions covered      -> human_core       (people own the task; AI does not reach its need)
//      2. every dimension covered, task critical       -> augment          (a qualified person stays accountable for a critical task)
//      3. every dimension covered                      -> automate_partly  (AI can take over parts; a person verifies)
//      4. otherwise (half or more covered)             -> augment          (AI assists; a person owns the outcome)
//    augmentable = exposure <> human_core. Reasons: the branch, one reason per dimension (covered or gap) and the horizon.
//  - Security, safeguards and cyber tasks (restricted) are never rated, scored or returned: exposureOf returns null.
import type { Reason } from '../../domain/engines/types';

export const OECD_DIMS = ['language', 'social', 'problem_solving', 'creativity', 'metacognition', 'learning_memory', 'vision', 'manipulation', 'robotic', 'consciousness'] as const;
/** The tenth OECD dimension (consciousness) is not a work-task requirement and is never rated for a task. */
export const TASK_DIMS = ['language', 'social', 'problem_solving', 'creativity', 'metacognition', 'learning_memory', 'vision', 'manipulation', 'robotic'] as const;
export type Dim = (typeof TASK_DIMS)[number];
export const EXPOSURES = ['augment', 'automate_partly', 'human_core'] as const;
export type Exposure = (typeof EXPOSURES)[number];
export const HORIZONS = ['now', '2030', '2035'] as const;
export type Horizon = (typeof HORIZONS)[number];
export const DRIVERS = ['ai_assist', 'digital_ic', 'robotics', 'digital_twin', 'smr_design', 'none'] as const;
export type Driver = (typeof DRIVERS)[number];
export const SKILL_KINDS = ['current', 'future'] as const;
export type Branch = 'below_half' | 'critical_all' | 'all_covered' | 'some_covered';

export const MAX_DIMS = 4;
export const MAX_SKILLS = 6;
export const MAX_SKILL_LEVEL = 4;
export const NOTE_MAX = 500;
/** O*NET-style published threshold: a driver is a "hot driver" for a role when it changes at least this share of the role's rated tasks. */
export const HOT_DRIVER_PCT = 30;
/** O*NET-style minimum: a role needs at least this many rated tasks before a driver badge is shown. */
export const HOT_DRIVER_MIN_TASKS = 3;

export const DIM_LABEL: Record<Dim, { en: string; ar: string }> = {
  language: { en: 'Language', ar: 'اللغة' },
  social: { en: 'Social interaction', ar: 'التفاعل الاجتماعي' },
  problem_solving: { en: 'Problem solving', ar: 'حل المشكلات' },
  creativity: { en: 'Creativity', ar: 'الإبداع' },
  metacognition: { en: 'Metacognition and critical thinking', ar: 'ما وراء المعرفة والتفكير النقدي' },
  learning_memory: { en: 'Knowledge, learning and memory', ar: 'المعرفة والتعلّم والذاكرة' },
  vision: { en: 'Vision', ar: 'الرؤية' },
  manipulation: { en: 'Manipulation', ar: 'المعالجة اليدوية' },
  robotic: { en: 'Robotic intelligence', ar: 'الذكاء الروبوتي' },
};
export const HORIZON_LABEL: Record<Horizon, { en: string; ar: string }> = {
  now: { en: 'now', ar: 'الآن' },
  '2030': { en: '2030', ar: '2030' },
  '2035': { en: '2035', ar: '2035' },
};

export const FX_MSG = {
  not_signed_in: 'Sign in to use the SAT workbench',
  forbidden: "Only the training manager or a designated SAT analyst can set a task's future attributes",
  not_found: 'Task not found',
  restricted: "Restricted task: security, safeguards and cyber tasks are managed outside Kafa'a",
  retired: 'This task is retired',
  needs_invalid: 'Rate 1 to 4 OECD capability dimensions, each once, with a whole-number level from 1 to 5',
  horizon_invalid: 'Choose a change horizon: now, 2030 or 2035',
  driver_invalid: 'Choose a technology driver',
  skills_invalid: 'Link 1 to 6 skills, each once, with a whole-number level from 1 to 4',
  skill_not_found: 'Skill not found',
  skill_restricted: 'Security skills are never linked to SAT tasks',
  note_long: 'Keep the note under 500 characters',
  forbidden_designate: 'Only the training manager designates SAT analysts',
  not_instructor: 'Only training staff (instructors) can be designated SAT analysts',
  person_not_found: 'Person not found',
  self_designate: 'Designate another member of training staff',
  no_change: 'Nothing to change: the designation is already in that state',
} as const;

export type Needs = Partial<Record<Dim, number>>;
export interface CapLevel { dimension: string; horizon: string; level: number }
export interface FutureTaskLite { needs: Needs | Record<string, unknown> | null; change_horizon: string | null; critical: boolean; restricted: boolean }
export interface ExposureResult { exposure: Exposure; augmentable: boolean; branch: Branch; covered: Dim[]; gaps: Dim[]; reasons: Reason[] }

const R = (code: string, vars?: Reason['vars']): Reason => (vars === undefined ? { code, key: `m26.reasons.${code}` } : { code, key: `m26.reasons.${code}`, vars });
const isInt = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x);
export const isDim = (x: unknown): x is Dim => typeof x === 'string' && (TASK_DIMS as readonly string[]).includes(x);
export const isHorizon = (x: unknown): x is Horizon => typeof x === 'string' && (HORIZONS as readonly string[]).includes(x);
export const isDriver = (x: unknown): x is Driver => typeof x === 'string' && (DRIVERS as readonly string[]).includes(x);

/** A valid needs object: 1-4 known task dimensions with integer levels 1..5 (no other keys). */
export function validNeeds(x: unknown): x is Needs {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  const ks = Object.keys(x as object);
  if (ks.length < 1 || ks.length > MAX_DIMS) return false;
  return ks.every((k) => isDim(k) && isInt((x as Record<string, unknown>)[k]) && ((x as Record<string, number>)[k] >= 1 && (x as Record<string, number>)[k] <= 5));
}
/** Needs in the canonical dimension order (stable JSON for TS = SQL comparisons). */
export function canonNeeds(x: Needs): Needs {
  const out: Needs = {};
  for (const d of TASK_DIMS) if (x[d] !== undefined) out[d] = x[d];
  return out;
}

/** AI capability level for a dimension at a horizon (0 when no reference row exists: no assumed capability). */
export function aiLevel(levels: CapLevel[], dim: string, horizon: string): number {
  return levels.find((l) => l.dimension === dim && l.horizon === horizon)?.level ?? 0;
}

/** The exposure rule. Null for restricted or not-yet-rated tasks. */
export function exposureOf(t: FutureTaskLite, levels: CapLevel[]): ExposureResult | null {
  if (t.restricted) return null;
  if (!validNeeds(t.needs) || !isHorizon(t.change_horizon)) return null;
  const h = t.change_horizon;
  const needs = t.needs as Needs;
  const dims = TASK_DIMS.filter((d) => needs[d] !== undefined);
  const covered: Dim[] = [];
  const gaps: Dim[] = [];
  const per: Reason[] = [];
  for (const d of dims) {
    const need = needs[d] as number;
    const ai = aiLevel(levels, d, h);
    if (ai >= need) { covered.push(d); per.push(R('fx_dim_covered', { dim: DIM_LABEL[d], need, ai })); } else { gaps.push(d); per.push(R('fx_dim_gap', { dim: DIM_LABEL[d], need, ai })); }
  }
  const k = covered.length, n = dims.length;
  let exposure: Exposure, branch: Branch, head: Reason;
  if (2 * k < n) { exposure = 'human_core'; branch = 'below_half'; head = R('fx_human_core', { k, n }); }
  else if (k === n && t.critical) { exposure = 'augment'; branch = 'critical_all'; head = R('fx_critical_keep', { n }); }
  else if (k === n) { exposure = 'automate_partly'; branch = 'all_covered'; head = R('fx_all_covered', { n }); }
  else { exposure = 'augment'; branch = 'some_covered'; head = R('fx_some_covered', { k, n }); }
  return { exposure, augmentable: exposure !== 'human_core', branch, covered, gaps, reasons: [head, ...per, R('fx_horizon', { horizon: HORIZON_LABEL[h] })] };
}

// ───────────── summaries (pages and the seed report)
export interface FutureRow { id: string; role_id: string; exposure: string | null; change_horizon: string | null; tech_driver: string | null; restricted: boolean; status: string }
export interface FutureSummary { rated: number; total: number; byExposure: Record<Exposure, number>; byHorizon: Record<Horizon, number>; byDriver: Record<Driver, number>; augmentable: number; augmentablePct: number | null }

export function futureSummary(rows: FutureRow[]): FutureSummary {
  const live = rows.filter((r) => !r.restricted && r.status === 'active');
  const rated = live.filter((r) => r.exposure);
  const byExposure = Object.fromEntries(EXPOSURES.map((e) => [e, rated.filter((r) => r.exposure === e).length])) as Record<Exposure, number>;
  const byHorizon = Object.fromEntries(HORIZONS.map((e) => [e, rated.filter((r) => r.change_horizon === e).length])) as Record<Horizon, number>;
  const byDriver = Object.fromEntries(DRIVERS.map((e) => [e, rated.filter((r) => r.tech_driver === e).length])) as Record<Driver, number>;
  const augmentable = byExposure.augment + byExposure.automate_partly;
  return { rated: rated.length, total: live.length, byExposure, byHorizon, byDriver, augmentable, augmentablePct: rated.length ? Math.floor((200 * augmentable + rated.length) / (2 * rated.length)) : null };
}

/** O*NET-style driver badges per role: drivers (other than none) that change >= HOT_DRIVER_PCT of the role's rated tasks. */
export function hotDrivers(rows: FutureRow[], roleId: string): { driver: Driver; n: number; of: number; pct: number }[] {
  const rated = rows.filter((r) => r.role_id === roleId && !r.restricted && r.status === 'active' && r.exposure && r.tech_driver);
  if (rated.length < HOT_DRIVER_MIN_TASKS) return [];
  return DRIVERS.filter((d) => d !== 'none')
    .map((d) => { const n = rated.filter((r) => r.tech_driver === d).length; return { driver: d, n, of: rated.length, pct: Math.floor((200 * n + rated.length) / (2 * rated.length)) }; })
    .filter((x) => x.n > 0 && x.pct >= HOT_DRIVER_PCT)
    .sort((a, b) => b.n - a.n || DRIVERS.indexOf(a.driver) - DRIVERS.indexOf(b.driver));
}

/** Auto summary for the SAT change log row written by every future edit. */
export function futureSummaryLine(x: { exposure: string; change_horizon: string; tech_driver: string }): string {
  return `Future attributes: ${x.exposure} by ${x.change_horizon}, driver ${x.tech_driver}`;
}
