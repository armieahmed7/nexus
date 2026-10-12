/**
 * M35 · FS61 Skills pilots registry. Pure rules, import-free (node seed scripts and the PGlite validator load this file directly). SQL
 * mirror, change both together: supabase/migrations/20261010271001_kafaa_fs71_disclosure_pilots.sql (kafaa_spl_*).
 *
 * Every workforce experiment is registered with a hypothesis, a comparison group, a named independent evaluator (a role card, never the
 * pilot owner or the person who registered it), its metrics, its result (failures included) and an adoption decision. A pilot runs
 * draft -> running -> evaluating (the evaluator's sign-off with the result and a recommendation) -> closed (HR records the adoption
 * decision; the result is published to staff and stays visible, a failure as much as a success). It cannot close without the evaluator's
 * sign-off. The adoption rate (closed pilots adopted, expanded or further funded, out of all closed pilots) is computed from the statuses
 * and shown against the Future Skills Centre reference read from kafaa_benchmarks (FSC, figure adoption_rate), never typed into copy.
 */

export const STATUSES = ['draft', 'running', 'evaluating', 'closed'] as const;
export type PilotStatus = (typeof STATUSES)[number];
export const RESULTS = ['success', 'mixed', 'failed'] as const;
export type PilotResult = (typeof RESULTS)[number];
export const ADOPTIONS = ['adopted', 'expanded', 'further_funded', 'not_adopted'] as const;
export type Adoption = (typeof ADOPTIONS)[number];
/** what counts as "adoption, expansion or further investment" (the FSC definition) */
export const ADOPTED: Adoption[] = ['adopted', 'expanded', 'further_funded'];
/** a failed pilot can be stopped or funded for a redesign, never adopted or expanded as it stands */
export const FAILED_ALLOWED: Adoption[] = ['not_adopted', 'further_funded'];
export const METRIC_UNITS = ['pct', 'count', 'hours', 'score', 'days'] as const;
export const ID_RE = /^sp-[a-z0-9-]{3,48}$/;
export const KEY_RE = /^[a-z0-9_]{2,40}$/;
export const TITLE: [number, number] = [5, 140];
export const HYPOTHESIS: [number, number] = [20, 800];
export const COMPARISON: [number, number] = [10, 600];
export const LABEL: [number, number] = [3, 120];
export const RESULT_TEXT: [number, number] = [20, 1200];
export const LESSONS: [number, number] = [10, 1200];
export const MAX_METRICS = 5;
export const MAX_SKILLS = 6;
export const GROUP_MAX = 100000;
export const VALUE_LIMIT = 1000000;
export const MIN_GROUP = 10;
export const REFERENCE = { benchmark: 'FSC', figure: 'adoption_rate' } as const;

type AnyRow = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export interface PilotMetric { key: string; label_en: string; label_ar: string; unit: string; baseline: number; target: number; pilot?: number | null; comparison?: number | null }
export interface PilotInput {
  id?: string | null;
  title_en: string; title_ar: string;
  hypothesis_en: string; hypothesis_ar: string;
  comparison_en: string; comparison_ar: string;
  pilot_n?: number | null; comparison_n?: number | null;
  owner_person_id: string;
  evaluator_person_id: string;
  metrics: PilotMetric[];
  skill_ids: string[];
  start_on: string; end_on: string;
  status: 'draft' | 'running';
}
export interface PilotCtx { staff: string[]; skills: string[]; creator: string }
export type PilotProblem = 'id' | 'title' | 'hypothesis' | 'comparison' | 'people' | 'independence' | 'metrics' | 'skills' | 'dates' | 'groups' | 'status';

const len = (v: unknown) => (typeof v === 'string' ? v.trim().length : -1);
const between = (v: unknown, [lo, hi]: [number, number]) => len(v) >= lo && len(v) <= hi;
const ARABIC = /[؀-ۿ]/;
const bi = (en: unknown, ar: unknown, r: [number, number]) => between(en, r) && between(ar, r) && ARABIC.test(String(ar));
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= VALUE_LIMIT;
const isDate = (v: unknown) => typeof v === 'string' && /^20(2[4-9]|30)-\d\d-\d\d$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const groupOk = (v: unknown) => v == null || (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= GROUP_MAX);

/** The register check for a new or edited pilot (TS = SQL kafaa_spl_problem): first problem, or null. `ctx.creator` = who registered it. */
export function pilotProblem(x: Partial<PilotInput> | null | undefined, ctx: PilotCtx, isNew: boolean): PilotProblem | null {
  if (!x || typeof x !== 'object') return 'title';
  if (isNew && !(typeof x.id === 'string' && ID_RE.test(x.id))) return 'id';
  if (!bi(x.title_en, x.title_ar, TITLE)) return 'title';
  if (!bi(x.hypothesis_en, x.hypothesis_ar, HYPOTHESIS)) return 'hypothesis';
  if (!bi(x.comparison_en, x.comparison_ar, COMPARISON)) return 'comparison';
  if (typeof x.owner_person_id !== 'string' || typeof x.evaluator_person_id !== 'string' || !ctx.staff.includes(x.owner_person_id) || !ctx.staff.includes(x.evaluator_person_id)) return 'people';
  if (x.evaluator_person_id === x.owner_person_id || x.evaluator_person_id === ctx.creator) return 'independence';
  const ms = x.metrics;
  if (!Array.isArray(ms) || ms.length < 1 || ms.length > MAX_METRICS) return 'metrics';
  const keys = new Set<string>();
  for (const m of ms) {
    if (!m || typeof m !== 'object' || typeof m.key !== 'string' || !KEY_RE.test(m.key) || keys.has(m.key)) return 'metrics';
    keys.add(m.key);
    if (!bi(m.label_en, m.label_ar, LABEL) || !(METRIC_UNITS as readonly string[]).includes(m.unit) || !isNum(m.baseline) || !isNum(m.target)) return 'metrics';
  }
  const sk = x.skill_ids;
  if (!Array.isArray(sk) || sk.length > MAX_SKILLS || sk.some((s) => typeof s !== 'string' || !ctx.skills.includes(s)) || new Set(sk).size !== sk.length) return 'skills';
  if (!isDate(x.start_on) || !isDate(x.end_on) || (x.start_on as string) > (x.end_on as string)) return 'dates';
  if (!groupOk(x.pilot_n) || !groupOk(x.comparison_n)) return 'groups';
  if (x.status !== 'draft' && x.status !== 'running') return 'status';
  return null;
}

export interface SignoffInput {
  result: PilotResult;
  recommendation: Adoption;
  result_en: string; result_ar: string;
  lessons_en: string; lessons_ar: string;
  /** measured values per metric key: pilot group (required) and comparison group (optional) */
  metric_results: { key: string; pilot: number; comparison?: number | null }[];
}
export type SignoffProblem = 'result' | 'recommendation' | 'summary' | 'lessons' | 'metrics';
/** The evaluator's sign-off check (TS = SQL kafaa_spl_signoff_problem). `keys` = the pilot's metric keys, all of which need a result. */
export function signoffProblem(x: Partial<SignoffInput> | null | undefined, keys: string[]): SignoffProblem | null {
  if (!x || typeof x !== 'object' || !(RESULTS as readonly string[]).includes(x.result as string)) return 'result';
  if (!(ADOPTIONS as readonly string[]).includes(x.recommendation as string) || (x.result === 'failed' && !FAILED_ALLOWED.includes(x.recommendation as Adoption))) return 'recommendation';
  if (!bi(x.result_en, x.result_ar, RESULT_TEXT)) return 'summary';
  if (!bi(x.lessons_en, x.lessons_ar, LESSONS)) return 'lessons';
  const mr = x.metric_results;
  if (!Array.isArray(mr) || mr.length !== keys.length) return 'metrics';
  const seen = new Set<string>();
  for (const m of mr) {
    if (!m || typeof m !== 'object' || typeof m.key !== 'string' || !keys.includes(m.key) || seen.has(m.key) || !isNum(m.pilot) || !(m.comparison == null || isNum(m.comparison))) return 'metrics';
    seen.add(m.key);
  }
  return null;
}
/** HR's close check: an adoption decision that fits the evaluated result. */
export const closeProblem = (adoption: unknown, result: string | null | undefined): 'adoption' | null =>
  !(ADOPTIONS as readonly string[]).includes(adoption as string) || (result === 'failed' && !FAILED_ALLOWED.includes(adoption as Adoption)) ? 'adoption' : null;

export interface PilotLite { id: string; status: string; result?: string | null; adoption?: string | null }
export interface AdoptionStats { closed: number; adopted: number; expanded: number; further_funded: number; not_adopted: number; failed: number; mixed: number; success: number; rate: number | null; running: number; evaluating: number; draft: number }
/** adoptionRate: closed pilots adopted, expanded or further funded out of all closed pilots (one decimal; null with none closed).
 *  Failures stay in the denominator. TS = SQL kafaa_spl_adoption. */
export function adoptionRate(pilots: PilotLite[]): AdoptionStats {
  const closed = pilots.filter((p) => p.status === 'closed');
  const n = (a: string) => closed.filter((p) => p.adoption === a).length;
  const adoptedAll = closed.filter((p) => ADOPTED.includes(p.adoption as Adoption)).length;
  return {
    closed: closed.length, adopted: n('adopted'), expanded: n('expanded'), further_funded: n('further_funded'), not_adopted: n('not_adopted'),
    failed: closed.filter((p) => p.result === 'failed').length, mixed: closed.filter((p) => p.result === 'mixed').length, success: closed.filter((p) => p.result === 'success').length,
    rate: closed.length ? Math.floor(1000 * adoptedAll / closed.length + 0.5) / 10 : null,
    running: pilots.filter((p) => p.status === 'running').length, evaluating: pilots.filter((p) => p.status === 'evaluating').length, draft: pilots.filter((p) => p.status === 'draft').length,
  };
}
/** The FSC reference figure from the benchmark registry rows (never typed): value, label, first https source and as-of date. */
export function referenceOf(benchmarks: AnyRow[]): { id: string; figure: string; value: number; url: string; as_of: string } | null {
  const b = benchmarks.find((x) => x.id === REFERENCE.benchmark);
  const f = (Array.isArray(b?.figures) ? b!.figures : []).find((x: AnyRow) => x?.key === REFERENCE.figure);
  if (!b || !f || typeof f.value !== 'number') return null;
  return { id: b.id, figure: f.key, value: f.value, url: String((b.urls ?? [])[0] ?? ''), as_of: String(b.as_of ?? '').slice(0, 10) };
}
/** group sizes are people counts: shown only from 10 */
export const groupShown = (n: number | null | undefined) => (n != null && n >= MIN_GROUP ? n : null);
/** the change a pilot made on one metric against its comparison group (pages only) */
export function lift(m: PilotMetric): number | null {
  if (m.pilot == null || m.comparison == null) return null;
  return Math.round((m.pilot - m.comparison) * 10) / 10;
}
