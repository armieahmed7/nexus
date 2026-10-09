// F27 SAT analysis workbench: the pure rules shared by the pages, the LocalBackend RPCs, the seed builder and (mirrored in SQL)
// supabase/migrations/20261009142001_kafaa_w4e2_sat.sql. Import-free apart from types (node seed and validator scripts load it).
//
//  - difDecision(D, I, F): the deterministic train / no-train / overtrain rule. Every triple on 1..5 maps to exactly one outcome
//    and one rule branch (exhaustive unit test). Branches (first match wins):
//      1. I >= 4, D >= 3, F <= 2  -> overtrain  (important, difficult and rarely performed: train beyond mastery and refresh)
//      2. I >= 3                  -> train      (important enough to need formal training)
//      3. D >= 4                  -> train      (too difficult to learn on the job without structure)
//      4. D  = 3, F <= 2          -> train      (moderately difficult and rarely practised)
//      5. otherwise               -> no_train   (low importance; easy or frequent enough to learn on the job)
//  - consensus(ratings): integer consensus per dimension = mean rounded half up, computed exactly from sums
//    (floor((2*sum + n) / (2n))), so TS and SQL agree; disagreement when any dimension spreads by 3 or more.
//  - proposal(ratings): needs MIN_RATERS (3) active ratings, then applies difDecision to the consensus.
//  - coverage(): the task-to-training matrix: coverage gaps (a task selected for training with no learning objective),
//    orphan objectives (an objective no task links to) and overtrain tasks without a continuing-training refresher.
//  - changeImpact(): what a task change touches: courses and qualification standards (one review item each), JPMs and
//    assessment items (metadata only: id, topic, difficulty, status; never stems or keys).
import type { Reason } from '../../domain/engines/types';

export type Decision = 'train' | 'no_train' | 'overtrain';
export type DecisionState = Decision | 'pending';
export type Rule = 'overtrain' | 'important' | 'difficult' | 'rare_moderate' | 'low';
export const DECISIONS: Decision[] = ['train', 'overtrain', 'no_train'];
export const MIN_RATERS = 3;
export const NOTE_MAX = 500;
export const SUMMARY_MIN = 10;
export const RESTRICTED_TITLE = { en: "Restricted task — managed outside Kafa'a", ar: 'مهمة مقيدة — تُدار خارج كفاءة' };
export const RESTRICTED_FAMILIES = ['security', 'safeguards', 'cyber'];
export const SELECTED: DecisionState[] = ['train', 'overtrain'];

export const SAT_MSG = {
  not_signed_in: 'Sign in to use the SAT workbench',
  forbidden: 'Only training staff with SAT rights can do this',
  forbidden_decide: 'Only the training manager decides train, no-train or overtrain',
  forbidden_rate: 'Only training staff or a subject-matter expert in this role can rate this task',
  not_found: 'Task not found',
  restricted: "Restricted task: security, safeguards and cyber tasks are managed outside Kafa'a",
  restricted_role: "Tasks for security, safeguards and cyber roles are managed outside Kafa'a",
  retired: 'This task is retired',
  dif_range: 'Rate difficulty, importance and frequency as whole numbers from 1 to 5',
  note_long: 'Keep the note under 500 characters',
  insufficient: 'At least 3 subject-matter expert ratings are needed before a training decision',
  decision_invalid: 'Choose train, no-train or overtrain',
  note_required: 'Explain in at least 10 characters why the decision differs from the DIF rule',
  objective_not_found: 'Learning objective not found',
  objective_retired: 'This learning objective is retired',
  course_not_found: 'Course not found',
  module_not_found: 'Course module not found for this course',
  jpm_not_found: 'JPM not found',
  jpm_restricted: 'This JPM belongs to a restricted standard',
  link_exists: 'This objective is already linked to the task',
  link_missing: 'This objective is not linked to the task',
  title_invalid: 'Give the task a title in English and Arabic (5 to 200 characters each)',
  objective_invalid: 'Write the objective in English and Arabic (10 to 400 characters each)',
  role_not_found: 'Role not found',
  change_open: 'An open SAT change already exists for this task; close its review items first',
  change_kind: 'Choose modified or retired',
  change_summary: 'Describe the change in 10 to 500 characters',
  change_linked: 'This task is linked to training: open a SAT change so the impact is reviewed',
  item_not_found: 'Review item not found',
  item_closed: 'This review item is already closed',
  item_outcome: 'Close a course item as updated or no change, a standard item as revised or no change',
  item_note: 'Give a reason of at least 5 characters for no change',
  not_revised: 'Revise the standard first (a newer version must supersede it), then close the item',
  analysis_status: 'Move a job analysis from draft to survey to approved',
  analysis_undecided: 'Every active task needs a training decision before the analysis is approved',
  approve_forbidden: 'Only the training manager approves a job analysis',
  survey_closed: 'The DIF survey for this role is not open',
} as const;

const R = (code: string, vars?: Reason['vars']): Reason => (vars === undefined ? { code, key: `m26.reasons.${code}` } : { code, key: `m26.reasons.${code}`, vars });

export function validDif(x: unknown): x is number {
  return typeof x === 'number' && Number.isInteger(x) && x >= 1 && x <= 5;
}

/** The DIF decision rule. Total over 1..5 x 1..5 x 1..5: exactly one outcome and one rule branch per triple. */
export function difDecision(d: number, i: number, f: number): { decision: Decision; rule: Rule; reasons: Reason[] } {
  const v = { d, i, f };
  if (i >= 4 && d >= 3 && f <= 2) return { decision: 'overtrain', rule: 'overtrain', reasons: [R('dif_overtrain', v), R('dif_refresh')] };
  if (i >= 3) return { decision: 'train', rule: 'important', reasons: [R('dif_important', v)] };
  if (d >= 4) return { decision: 'train', rule: 'difficult', reasons: [R('dif_difficult', v)] };
  if (d === 3 && f <= 2) return { decision: 'train', rule: 'rare_moderate', reasons: [R('dif_rare_moderate', v)] };
  return { decision: 'no_train', rule: 'low', reasons: [R('dif_low', v)] };
}

export interface RatingLite { d: number; i: number; f: number; active?: boolean | null }
export interface Consensus { n: number; d: number; i: number; f: number; mean: { d: number; i: number; f: number }; spread: { d: number; i: number; f: number }; disagreement: boolean }

/** Mean rounded half up, exact on integers: floor((2*sum + n) / (2n)). */
export const roundMean = (sum: number, n: number) => Math.floor((2 * sum + n) / (2 * n));

export function consensus(ratings: RatingLite[]): Consensus | null {
  const xs = ratings.filter((r) => r.active !== false);
  const n = xs.length;
  if (!n) return null;
  const sum = (k: 'd' | 'i' | 'f') => xs.reduce((s, r) => s + r[k], 0);
  const spr = (k: 'd' | 'i' | 'f') => Math.max(...xs.map((r) => r[k])) - Math.min(...xs.map((r) => r[k]));
  const mean = { d: Math.round((sum('d') * 10) / n) / 10, i: Math.round((sum('i') * 10) / n) / 10, f: Math.round((sum('f') * 10) / n) / 10 };
  const spread = { d: spr('d'), i: spr('i'), f: spr('f') };
  return { n, d: roundMean(sum('d'), n), i: roundMean(sum('i'), n), f: roundMean(sum('f'), n), mean, spread, disagreement: spread.d >= 3 || spread.i >= 3 || spread.f >= 3 };
}

export interface Proposal { status: 'insufficient' | 'proposed'; n: number; consensus: Consensus | null; decision: Decision | null; rule: Rule | null; reasons: Reason[] }

export function proposal(ratings: RatingLite[]): Proposal {
  const c = consensus(ratings);
  const n = c?.n ?? 0;
  if (!c || n < MIN_RATERS) return { status: 'insufficient', n, consensus: c, decision: null, rule: null, reasons: [R('dif_insufficient', { n, min: MIN_RATERS })] };
  const dd = difDecision(c.d, c.i, c.f);
  const reasons = [...dd.reasons, R('dif_raters', { n })];
  if (c.disagreement) reasons.push(R('dif_disagreement', { d: c.spread.d, i: c.spread.i, f: c.spread.f }));
  return { status: 'proposed', n, consensus: c, decision: dd.decision, rule: dd.rule, reasons };
}

/** Reasons for a recorded decision: the DIF rule, plus the override when the training manager decided differently. */
export function decisionReasons(p: Proposal, decision: DecisionState, override: boolean): Reason[] {
  if (decision === 'pending') return p.reasons;
  return override ? [...p.reasons, R('dif_override', { decision })] : p.reasons;
}

// ───────────── task-to-training matrix
export interface TaskLite { id: string; role_id: string; restricted: boolean; status: string; decision: DecisionState }
export interface LinkLite { id: string; task_id: string; objective_ref: string; course_id: string | null; module_id?: string | null; jpm_id: string | null; active: boolean }
export interface ObjectiveLite { id: string; course_id: string | null; role_id?: string | null; status: string; source: string }
export interface CoverageRow { task_id: string; selected: boolean; links: number; objectives: string[]; courses: string[]; jpms: string[]; gap: boolean; no_refresher: boolean }
export interface Coverage { rows: CoverageRow[]; gaps: string[]; orphans: string[]; selected: number; covered: number; pct: number | null; no_refresher: string[] }

const sortStr = (xs: Iterable<string>) => [...new Set(xs)].sort();

/**
 * The matrix for a set of tasks. `scopeObjectives` limits the orphan search (a role: objectives of its curriculum courses and
 * SAT objectives written for it); an orphan is an active objective that no active link of an active task points at (any role).
 * `continuingCourseIds`: courses that count as a refresher (continuing training) for overtrain tasks.
 */
export function coverage(tasks: TaskLite[], allLinks: LinkLite[], allTasks: TaskLite[], scopeObjectives: ObjectiveLite[], continuingCourseIds: Set<string>): Coverage {
  const activeTask = new Map(allTasks.filter((t) => t.status === 'active').map((t) => [t.id, t]));
  const links = allLinks.filter((l) => l.active && activeTask.has(l.task_id));
  const byTask = new Map<string, LinkLite[]>();
  for (const l of links) byTask.set(l.task_id, [...(byTask.get(l.task_id) ?? []), l]);
  const rows: CoverageRow[] = tasks.filter((t) => t.status === 'active' && !t.restricted).map((t) => {
    const ls = byTask.get(t.id) ?? [];
    const selected = SELECTED.includes(t.decision);
    const courses = sortStr(ls.map((l) => l.course_id).filter((x): x is string => !!x));
    const jpms = sortStr(ls.map((l) => l.jpm_id).filter((x): x is string => !!x));
    const noRefresher = t.decision === 'overtrain' && ls.length > 0 && !courses.some((c) => continuingCourseIds.has(c)) && jpms.length === 0;
    return { task_id: t.id, selected, links: ls.length, objectives: sortStr(ls.map((l) => l.objective_ref)), courses, jpms, gap: selected && ls.length === 0, no_refresher: noRefresher };
  });
  rows.sort((a, b) => (a.task_id < b.task_id ? -1 : 1));
  const linkedObj = new Set(links.map((l) => l.objective_ref));
  const orphans = sortStr(scopeObjectives.filter((o) => o.status === 'active' && !linkedObj.has(o.id)).map((o) => o.id));
  const selected = rows.filter((r) => r.selected).length;
  const covered = rows.filter((r) => r.selected && !r.gap).length;
  return {
    rows, gaps: rows.filter((r) => r.gap).map((r) => r.task_id), orphans, selected, covered,
    pct: selected ? Math.floor((200 * covered + selected) / (2 * selected)) : null, no_refresher: rows.filter((r) => r.no_refresher).map((r) => r.task_id),
  };
}

/** A role's curriculum: courses whose competencies overlap the role's required competencies, plus courses already linked. */
export function roleCurriculum(roleId: string, roleComps: { role_id: string; competency_id: string }[], courses: { id: string; competency_ids: string[] | null; audience?: string | null }[], linkedCourseIds: string[] = []): string[] {
  const comps = new Set(roleComps.filter((rc) => rc.role_id === roleId).map((rc) => rc.competency_id));
  return sortStr([...courses.filter((c) => (c.audience ?? 'staff') === 'staff' && (c.competency_ids ?? []).some((x) => comps.has(x))).map((c) => c.id), ...linkedCourseIds]);
}

// ───────────── change impact
export interface ImpactInput {
  task: { id: string; standard_id: string | null; task_item_id: string | null; restricted: boolean };
  links: LinkLite[];
  objectives: { id: string; course_id: string | null; competency_id: string | null }[];
  courses: { id: string; code: string; title_en: string; title_ar: string }[];
  jpms: { id: string; task_id: string | null; standard_id: string; code: string; title_en: string; title_ar: string }[];
  standards: { id: string; code: string; title_en: string; title_ar: string; security_restricted: boolean; status: string }[];
  items: { id: string; competency_id: string | null; topic: string; difficulty: string; status: string; bank: string }[];
}
export interface ImpactRef { id: string; code: string; title_en: string; title_ar: string }
export interface Impact { courses: ImpactRef[]; standards: ImpactRef[]; jpms: ImpactRef[]; items: { id: string; topic: string; difficulty: string; status: string; bank: string }[]; objectives: string[] }

export function changeImpact(x: ImpactInput): Impact {
  const empty: Impact = { courses: [], standards: [], jpms: [], items: [], objectives: [] };
  if (x.task.restricted) return empty;
  const links = x.links.filter((l) => l.active && l.task_id === x.task.id);
  const objById = new Map(x.objectives.map((o) => [o.id, o]));
  const courseIds = new Set<string>();
  for (const l of links) { const c = l.course_id ?? objById.get(l.objective_ref)?.course_id ?? null; if (c) courseIds.add(c); }
  const jpmIds = new Set<string>(links.map((l) => l.jpm_id).filter((j): j is string => !!j));
  if (x.task.task_item_id) for (const j of x.jpms) if (j.task_id === x.task.task_item_id) jpmIds.add(j.id);
  const jpmById = new Map(x.jpms.map((j) => [j.id, j]));
  const stdIds = new Set<string>();
  if (x.task.standard_id) stdIds.add(x.task.standard_id);
  for (const id of jpmIds) { const j = jpmById.get(id); if (j) stdIds.add(j.standard_id); }
  const stdById = new Map(x.standards.map((s) => [s.id, s]));
  const comps = new Set(links.map((l) => objById.get(l.objective_ref)?.competency_id).filter((c): c is string => !!c));
  const ref = (r: { id: string; code: string; title_en: string; title_ar: string }): ImpactRef => ({ id: r.id, code: r.code, title_en: r.title_en, title_ar: r.title_ar });
  const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return {
    courses: x.courses.filter((c) => courseIds.has(c.id)).map(ref).sort(byId),
    standards: [...stdIds].map((id) => stdById.get(id)).filter((s): s is NonNullable<typeof s> => !!s && !s.security_restricted).map(ref).sort(byId),
    jpms: [...jpmIds].map((id) => jpmById.get(id)).filter((j): j is NonNullable<typeof j> => !!j && !(stdById.get(j.standard_id)?.security_restricted)).map(ref).sort(byId),
    items: x.items.filter((i) => i.competency_id && comps.has(i.competency_id) && i.status !== 'retired').map((i) => ({ id: i.id, topic: i.topic, difficulty: i.difficulty, status: i.status, bank: i.bank })).sort(byId),
    objectives: sortStr(links.map((l) => l.objective_ref)),
  };
}

export const between = (s: string, min: number, max: number) => s.length >= min && s.length <= max;
