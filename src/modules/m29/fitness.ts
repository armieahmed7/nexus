// FS10 AI and Digital Fitness Check: the pure rules shared by the pages, the LocalBackend RPCs, the seed builder and (mirrored in SQL)
// supabase/migrations/20261010222001_kafaa_fs22_ai_fluency.sql (kafaa_fit_*). Import-free apart from types.
//
// Benchmarks: DigComp 2.2/3.0 (five competence areas; "% of people with above-basic digital skills" as the headline indicator);
// skills-platform adaptive assessment (Workera: an estimate from about 20 adaptive items); OECD PIAAC Cycle 2 (adaptive problem solving
// assessed as its own scale, a benchmark line on every score shown to a person).
//
//  - Nine areas (kafaa_fitness_areas): the five DigComp areas (information and data literacy, communication and collaboration,
//    digital content creation, safety, problem solving) and the four AI dimensions of the fluency ladder. Safety and problem solving
//    carry extra weight (1.5).
//  - Adaptive routing (nextStep), deterministic from the answers so far:
//      phase 1  one item per area at difficulty 2 (intermediate), areas in order;
//      phase 2  a second item per area: difficulty 3 after a right answer, difficulty 1 after a wrong one;
//      phase 3  weighted areas whose two answers disagree get a confirming third item at the second item's difficulty.
//    Stop rule: stop when every area is settled, and never after more than MAX_ITEMS (20). 18 to 20 items.
//  - Area level 0-3: right at 2 and 3 -> 3; right at 2, wrong at 3 -> 2; wrong at 2, right at 1 -> 1; wrong at both -> 0. In a
//    weighted area with a confirming item, the third answer decides between the two neighbouring levels.
//  - Score 0-100 = round(100 x sum(weight x level) / (3 x sum(weight))); band: >= 75 advanced, >= 50 above basic, >= 25 basic,
//    else limited. "Above basic" = above_basic or advanced (the DigComp indicator).
//  - Evidence: one F01 `assessment` row per skill an area maps to (kafaa_fitness_areas.skill_ids), level = min(2, best area level),
//    written only for levels >= 1. The check never evidences more than level 2 (EVIDENCE_CAP); higher levels need work evidence.
//    The latest check replaces earlier checks' evidence (kept, inactive): the check says where a person stands now.
//  - Item choice: the active items of the area and difficulty not yet used in this attempt, ordered by (sort, id), index
//    (attempt number mod count), so a re-take each quarter sees other items where the bank allows.
//  - Re-take once per calendar quarter; the trend of quarterly scores is the artefact.
import type { Reason } from '../../domain/engines/types';

export const MAX_ITEMS = 20;
export const START_DIFFICULTY = 2;
export const EVIDENCE_CAP = 2;
export const MAX_LEVEL = 3;
export const DIFFICULTIES = [1, 2, 3] as const;
export const BANDS = ['limited', 'basic', 'above_basic', 'advanced'] as const;
export type Band = (typeof BANDS)[number];
export const ABOVE_BASIC: Band[] = ['above_basic', 'advanced'];
export const MIN_ITEMS_PER_CELL = 2;
export const OPTIONS_MIN = 3;
export const OPTIONS_MAX = 4;
export const STEM_MAX = 400;
export const OPTION_MAX = 200;
/** Terms an item may never carry: the check is digital and AI fluency, never plant security (CONTRACT section 1.3). */
export const RESTRICTED_TERMS = ['vital area', 'protected area', 'security plan', 'guard force', 'design basis threat', 'safeguards', 'physical protection', 'alarm station', 'access code', 'firewall rule', 'network diagram', 'ip address'];

export interface FitArea { id: string; weight: number; skill_ids: string[]; sort: number; name_en: string; name_ar: string }
export interface FitItem { id: string; area_id: string; difficulty: number; status: string; sort: number }
export interface FitResponse { item_id: string; area_id: string; difficulty: number; choice: number; correct: boolean }
export interface FitStep { area_id: string; difficulty: number; phase: 1 | 2 | 3 }
export interface FitScore {
  levels: Record<string, number>;
  score: number;
  band: Band;
  evidence: { skill_id: string; level: number }[];
  reasons: Reason[];
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
export const sortAreas = <T extends Pick<FitArea, 'sort' | 'id'>>(areas: T[]) => [...areas].sort((a, b) => Number(a.sort) - Number(b.sort) || cmp(a.id, b.id));
const isWeighted = (a: Pick<FitArea, 'weight'>) => Number(a.weight) > 1;
const rsOf = (responses: FitResponse[], area: string) => responses.filter((r) => r.area_id === area);

/** The next area and difficulty, or null when the attempt is complete (stop rule). */
export function nextStep(areas: FitArea[], responses: FitResponse[]): FitStep | null {
  if (responses.length >= MAX_ITEMS) return null;
  const list = sortAreas(areas);
  for (const a of list) if (rsOf(responses, a.id).length === 0) return { area_id: a.id, difficulty: START_DIFFICULTY, phase: 1 };
  for (const a of list) { const rs = rsOf(responses, a.id); if (rs.length === 1) return { area_id: a.id, difficulty: rs[0].correct ? 3 : 1, phase: 2 }; }
  for (const a of list) {
    if (!isWeighted(a)) continue;
    const rs = rsOf(responses, a.id);
    if (rs.length === 2 && rs[0].correct !== rs[1].correct) return { area_id: a.id, difficulty: rs[1].difficulty, phase: 3 };
  }
  return null;
}

/** Level 0-3 of one area from its answers in order (null when unanswered). */
export function areaLevel(rs: Pick<FitResponse, 'correct'>[], weighted: boolean): number | null {
  if (!rs.length) return null;
  const c1 = rs[0].correct;
  if (rs.length === 1) return c1 ? 2 : 0;
  const c2 = rs[1].correct;
  if (weighted && rs.length >= 3 && c1 !== c2) return c1 ? (rs[2].correct ? 3 : 2) : (rs[2].correct ? 1 : 0);
  return c1 ? (c2 ? 3 : 2) : (c2 ? 1 : 0);
}

export const bandOf = (score: number): Band => (score >= 75 ? 'advanced' : score >= 50 ? 'above_basic' : score >= 25 ? 'basic' : 'limited');
export const isAboveBasic = (band: string | null | undefined) => band === 'above_basic' || band === 'advanced';

/** Score a finished (or stopped) attempt: area levels, score, band, the capped evidence and the reasons. */
export function scoreAttempt(areas: FitArea[], responses: FitResponse[]): FitScore {
  const list = sortAreas(areas);
  const levels: Record<string, number> = {};
  let num = 0;
  let den = 0;
  const reasons: Reason[] = [];
  const best = new Map<string, number>();
  for (const a of list) {
    const rs = rsOf(responses, a.id);
    const l = areaLevel(rs, isWeighted(a)) ?? 0;
    levels[a.id] = l;
    num += Number(a.weight) * l;
    den += Number(a.weight) * MAX_LEVEL;
    for (const s of a.skill_ids ?? []) best.set(s, Math.max(best.get(s) ?? 0, Math.min(EVIDENCE_CAP, l)));
  }
  const score = den > 0 ? Math.floor((100 * num) / den + 0.5) : 0;
  const band = bandOf(score);
  reasons.push({ code: 'fs10_score', key: `m29.fit.reason.band.${band}`, vars: { score, n: responses.length } });
  for (const a of list) {
    const rs = rsOf(responses, a.id);
    reasons.push({ code: 'fs10_area', key: `m29.fit.reason.level${levels[a.id]}`, vars: { area: { en: a.name_en, ar: a.name_ar } } });
    if (isWeighted(a) && rs.length >= 3) reasons.push({ code: 'fs10_confirmed', key: 'm29.fit.reason.confirmed', vars: { area: { en: a.name_en, ar: a.name_ar } } });
  }
  if (Object.values(levels).some((l) => l > EVIDENCE_CAP)) reasons.push({ code: 'fs10_cap', key: 'm29.fit.reason.cap', vars: { level: EVIDENCE_CAP } });
  const evidence = [...best].filter(([, l]) => l >= 1).map(([skill_id, level]) => ({ skill_id, level })).sort((a, b) => cmp(a.skill_id, b.skill_id));
  return { levels, score, band, evidence, reasons };
}

/** The item for a step: active items of the area and difficulty not used yet, ordered (sort, id), index attemptNo mod count. */
export function pickItem<T extends FitItem>(items: T[], step: Pick<FitStep, 'area_id' | 'difficulty'>, used: Set<string>, attemptNo: number): T | null {
  const c = items.filter((i) => i.status === 'active' && i.area_id === step.area_id && Number(i.difficulty) === step.difficulty && !used.has(i.id))
    .sort((a, b) => Number(a.sort) - Number(b.sort) || cmp(a.id, b.id));
  if (!c.length) return null;
  return c[((attemptNo % c.length) + c.length) % c.length];
}

// ───────────── Quarters (calendar quarters, UTC): the re-take rule and the indicator window
export const quarterOfDate = (d: string) => `${d.slice(0, 4)}-Q${Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1}`;
export function quarterShift(q: string, k: number): string {
  const [y, n] = q.split('-Q').map(Number);
  const i = y * 4 + (n - 1) + k;
  return `${Math.floor(i / 4)}-Q${(i % 4) + 1}`;
}
/** First day of the quarter after q (the next re-take date). */
export function nextQuarterStart(q: string): string {
  const nq = quarterShift(q, 1);
  const [y, n] = nq.split('-Q').map(Number);
  return `${y}-${String((n - 1) * 3 + 1).padStart(2, '0')}-01`;
}
/** The indicator window: the current quarter and the three before it, oldest first. */
export const windowQuarters = (today: string) => [3, 2, 1, 0].map((k) => quarterShift(quarterOfDate(today), -k));

// ───────────── Organisation indicator (suppressed under minGroup), mirrored by SQL kafaa_fitness_stats
export interface AttemptLite { id: string; person_id: string; period: string; status: string; score: number | null; band: string | null; completed_at: string | null; area_levels?: Record<string, number> | null }
export interface PersonLite { id: string; kind: string; status: string; job_family_id: string | null }
export interface FitnessStats {
  quarter: string;
  window: string[];
  staff: number;
  tested: number;
  coverage_pct: number | null;
  above_basic: number | null;
  pct_above_basic: number | null;
  avg_score: number | null;
  bands: { band: Band; n: number | null }[];
  trend: { quarter: string; n: number | null; pct_above_basic: number | null; avg_score: number | null }[];
  by_family: { family_id: string; n: number | null; pct_above_basic: number | null; avg_score: number | null }[];
  by_area: { area_id: string; avg_level: number | null }[];
}
export const RESTRICTED_FAMILIES = ['security', 'safeguards', 'cyber'];
const r1 = (x: number) => Math.floor(x * 10 + 0.5) / 10;
const r2 = (x: number) => Math.floor(x * 100 + 0.5) / 100;
const latestPer = (rows: AttemptLite[]) => {
  const m = new Map<string, AttemptLite>();
  for (const a of rows) {
    const cur = m.get(a.person_id);
    if (!cur || String(a.completed_at) > String(cur.completed_at) || (String(a.completed_at) === String(cur.completed_at) && a.id > cur.id)) m.set(a.person_id, a);
  }
  return [...m.values()];
};
export const isStaff = (p: Pick<PersonLite, 'kind' | 'status'>) => p.kind === 'staff' && p.status === 'active';

export function fitnessStats(attempts: AttemptLite[], people: PersonLite[], areas: FitArea[], today: string, minGroup: number): FitnessStats {
  const win = windowQuarters(today);
  const staff = people.filter(isStaff);
  const fam = new Map(staff.map((p) => [p.id, p.job_family_id]));
  const done = attempts.filter((a) => a.status === 'completed' && fam.has(a.person_id) && win.includes(a.period));
  const latest = latestPer(done);
  const tested = latest.length;
  const big = tested >= minGroup;
  const sup = (v: number) => (v >= minGroup ? v : null);
  const above = latest.filter((a) => isAboveBasic(a.band)).length;
  const avg = (rows: AttemptLite[]) => r1(rows.reduce((s, a) => s + Number(a.score ?? 0), 0) / rows.length);
  const pctOf = (rows: AttemptLite[]) => r1((100 * rows.filter((a) => isAboveBasic(a.band)).length) / rows.length);
  const fams = [...new Set(latest.map((a) => fam.get(a.person_id) ?? '').filter((f) => f && !RESTRICTED_FAMILIES.includes(f)))].sort(cmp);
  return {
    quarter: win[win.length - 1],
    window: win,
    staff: staff.length,
    tested,
    coverage_pct: staff.length >= minGroup && big ? r1((100 * tested) / staff.length) : null,
    above_basic: big ? sup(above) : null,
    pct_above_basic: big ? pctOf(latest) : null,
    avg_score: big ? avg(latest) : null,
    bands: BANDS.map((b) => ({ band: b, n: big ? sup(latest.filter((a) => a.band === b).length) : null })),
    trend: win.map((q) => {
      const g = latestPer(done.filter((a) => a.period === q));
      const ok = g.length >= minGroup;
      return { quarter: q, n: ok ? g.length : null, pct_above_basic: ok ? pctOf(g) : null, avg_score: ok ? avg(g) : null };
    }),
    by_family: fams.map((f) => {
      const g = latest.filter((a) => fam.get(a.person_id) === f);
      const ok = g.length >= minGroup;
      return { family_id: f, n: ok ? g.length : null, pct_above_basic: ok ? pctOf(g) : null, avg_score: ok ? avg(g) : null };
    }),
    by_area: sortAreas(areas).map((ar) => ({ area_id: ar.id, avg_level: big ? r2(latest.reduce((s, a) => s + Number(a.area_levels?.[ar.id] ?? 0), 0) / tested) : null })),
  };
}

// ───────────── Item bank checks (saveFitnessItem, seed): same rules in SQL kafaa_fit_item_problem
export interface ItemInput {
  id?: string | null; area_id: string; difficulty: number; stem_en: string; stem_ar: string; options_en: string[]; options_ar: string[]; correct: number;
  explain_en?: string; explain_ar?: string; status?: 'active' | 'retired';
}
export const hasRestrictedTerm = (text: string) => { const t = text.toLowerCase(); return RESTRICTED_TERMS.some((w) => t.includes(w)); };
/** First problem code of an item, or null: area, difficulty, texts, options, key, restricted wording. */
export function itemProblem(i: ItemInput, areaIds: string[]): string | null {
  if (!areaIds.includes(i.area_id)) return 'area';
  if (!Number.isInteger(i.difficulty) || i.difficulty < 1 || i.difficulty > 3) return 'difficulty';
  const s = (x: unknown) => (typeof x === 'string' ? x.trim() : '');
  if (!s(i.stem_en) || !s(i.stem_ar) || s(i.stem_en).length > STEM_MAX || s(i.stem_ar).length > STEM_MAX) return 'stem';
  const oe = Array.isArray(i.options_en) ? i.options_en : [];
  const oa = Array.isArray(i.options_ar) ? i.options_ar : [];
  if (oe.length < OPTIONS_MIN || oe.length > OPTIONS_MAX || oe.length !== oa.length) return 'options';
  if ([...oe, ...oa].some((o) => !s(o) || s(o).length > OPTION_MAX)) return 'options';
  if (!Number.isInteger(i.correct) || i.correct < 0 || i.correct >= oe.length) return 'correct';
  const all = [i.stem_en, i.stem_ar, ...oe, ...oa, i.explain_en ?? '', i.explain_ar ?? ''].join(' ');
  if (hasRestrictedTerm(all)) return 'restricted';
  return null;
}
