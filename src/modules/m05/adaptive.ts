// FS21 Adaptive future-skills assessment: the pure rules shared by the pages, the LocalBackend RPCs, the seed builder and (mirrored
// in SQL) supabase/migrations/20261010233001_kafaa_fs33_assessment.sql (kafaa_ad_*). Import-free apart from the FS01 engine rule.
//
// Benchmarks: skills-platform adaptive assessment (SKILLS-TECH: an estimate from about 20 adaptive items) and OECD PIAAC Cycle 2
// (adaptive testing, and a benchmark line on every score shown to a person).
//
//  - Engine (FS01 kernel, surface `assess`): the deterministic staircase nextItem() of src/domain/engines/future.ts with the
//    default weights (start at level 2, up after 2 right in a row, down after 1 wrong) gives the level of the next item and the
//    estimate = the highest level answered right at least twice (0-4). The model slot stays disabled (no gateway).
//  - Stop rule (the card's "stable estimate or 20 items"): stop at max_items (20), or once at least min_items (8) are answered and
//    the estimate has not changed over the last stable_window (4) answers; also when the bank has no unused item left.
//  - Calibration: each item has a calibrated difficulty 1.00-4.99 (SIMULATED pilot p-values); its whole part is the level the
//    staircase serves it at.
//  - Item choice (pickAdaptive), deterministic: active unused items of the bank; the level nearest the staircase level (lower
//    first on a tie); among them the facets used least so far in this attempt (content balance); ordered by distance of the
//    difficulty from the middle of the level (in hundredths), then id; index = form mod count. The form is fixed when the attempt
//    starts: the sum of the person id's character codes plus the attempt number - 1 (formOf), so first items spread across people
//    (item exposure) and a retake starts elsewhere. The same answers in the same form always give the same items.
//  - Safety-related skills (safety, plant systems, operations, emergency, radiation and chemistry, security areas, and the cyber
//    hygiene skills) are criterion-referenced: the result says whether the standard (cut level) is met, never a percentile. A
//    bank counts as safety-related when it says so or when any of its skills does (defence in depth).
//  - Developmental banks show a percentile against the latest completed attempt of every other person in the bank, only when that
//    group has 10 people or more (otherwise suppressed).
//  - Evidence: one F01 `assessment` row per bank skill (ref_table adaptive_attempts) at min(evidence_cap, estimate), only for an
//    estimate >= 1. The latest attempt of a bank replaces that bank's earlier evidence (kept, inactive).
//  - Retake: once per bank every retake_days (14) days; an open attempt resumes.
import type { Reason } from '../../domain/engines/types';
import { DEFAULT_ASSESS, nextItem } from '../../domain/engines/future.ts';

export const MAX_LEVEL = 4;
export const NORM_MIN = 10;
export const MIN_ITEMS_PER_LEVEL = 2;
export const OPTIONS_MIN = 3;
export const OPTIONS_MAX = 4;
export const STEM_MAX = 400;
export const OPTION_MAX = 200;
export const SAFETY_AREAS = ['safety', 'plant_systems', 'operations', 'emergency', 'radiation_chemistry', 'security'];
export const SAFETY_FS_AREAS = ['cyber_hygiene'];
/** Words an adaptive item may never carry: future-skills checks never touch plant security or exam content (CONTRACT 1.3). */
export const RESTRICTED_TERMS = ['vital area', 'protected area', 'security plan', 'guard force', 'design basis threat', 'safeguards', 'physical protection', 'alarm station',
  'access code', 'firewall rule', 'network diagram', 'ip address', 'clearance level', 'patrol route', 'camera coverage', 'exam answer'];

export type Mode = 'criterion' | 'normative';
export type Stop = 'stable' | 'max' | 'exhausted';
export interface SkillLite { id: string; area?: string | null; fs_area?: string | null }
export interface BankLite {
  id: string; skill_ids: string[]; safety_related: boolean; mode: Mode | string; cut_level: number; max_items: number; min_items: number; stable_window: number;
  evidence_cap: number; retake_days: number; gates?: string[] | null; status?: string;
}
export interface ItemLite { id: string; bank_id: string; skill_id: string; facet: string; level: number; difficulty: number; status: string }
export interface AdResponse { item_id: string; level: number; facet: string; choice: number; correct: boolean; at?: string | null }
export interface AdStep { done: boolean; level: number; item_id: string | null; stop: Stop | null }
export interface AdScore {
  estimate: number; stop: Stop; meets: boolean | null; percentile: number | null; norm_n: number | null; safety: boolean;
  evidence: { skill_id: string; level: number }[]; reasons: Reason[];
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
export const isSafetySkill = (s: SkillLite | null | undefined) => !!s && (SAFETY_AREAS.includes(String(s.area ?? '')) || SAFETY_FS_AREAS.includes(String(s.fs_area ?? '')));
/** Safety-related: the bank says so, or any of its skills is safety-related. Such banks are always criterion-referenced. */
export const bankIsSafety = (bank: Pick<BankLite, 'safety_related' | 'skill_ids'>, skills: Map<string, SkillLite>) =>
  !!bank.safety_related || (bank.skill_ids ?? []).some((id) => isSafetySkill(skills.get(id)));
/** The FS01 `assess` weights with the bank's stop rule. */
export const bankWeights = (bank: Pick<BankLite, 'max_items' | 'min_items' | 'stable_window'>) => ({
  ...DEFAULT_ASSESS, max_items: Number(bank.max_items), min_items: Number(bank.min_items), stop_streak: Number(bank.stable_window),
});
export const engineOf = (bank: BankLite, responses: Pick<AdResponse, 'level' | 'correct'>[]) =>
  nextItem(responses.map((r) => ({ level: Number(r.level), correct: !!r.correct })), bankWeights(bank));

/** The form of an attempt: character-code sum of the person id + attempt number - 1 (SQL kafaa_ad_form). */
export const formOf = (personId: string, attemptNo: number) => [...personId].reduce((s, c) => s + c.charCodeAt(0), 0) + attemptNo - 1;

/** The item for the staircase level (see header), or null when the bank has no unused active item left. */
export function pickAdaptive<T extends ItemLite>(items: T[], bankId: string, target: number, responses: Pick<AdResponse, 'item_id' | 'facet'>[], form: number): T | null {
  const used = new Set(responses.map((r) => r.item_id));
  const pool = items.filter((i) => i.bank_id === bankId && i.status === 'active' && !used.has(i.id));
  if (!pool.length) return null;
  let best = pool[0].level;
  for (const i of pool) {
    const d = Math.abs(Number(i.level) - target);
    const bd = Math.abs(best - target);
    if (d < bd || (d === bd && Number(i.level) < best)) best = Number(i.level);
  }
  const atLevel = pool.filter((i) => Number(i.level) === best);
  const use = new Map<string, number>();
  for (const r of responses) use.set(r.facet, (use.get(r.facet) ?? 0) + 1);
  const m = Math.min(...atLevel.map((i) => use.get(i.facet) ?? 0));
  const mid = best * 100 + 50;
  const c = atLevel.filter((i) => (use.get(i.facet) ?? 0) === m)
    .sort((a, b) => Math.abs(Math.round(Number(a.difficulty) * 100) - mid) - Math.abs(Math.round(Number(b.difficulty) * 100) - mid) || cmp(a.id, b.id));
  const n = c.length;
  return c[((form % n) + n) % n];
}

/** The stop after these answers (max items, or a stable estimate), or null to go on. */
export function stopOf(bank: BankLite, responses: Pick<AdResponse, 'level' | 'correct'>[]): Stop | null {
  const n = responses.length;
  if (n >= Number(bank.max_items)) return 'max';
  const w = Number(bank.stable_window);
  if (n >= Number(bank.min_items) && n >= w && engineOf(bank, responses).estimate === engineOf(bank, responses.slice(0, n - w)).estimate) return 'stable';
  return null;
}

/** What comes next after these answers: the next item, or the stop (stable estimate, 20 items, or an exhausted bank). */
export function adaptiveNext(bank: BankLite, items: ItemLite[], responses: AdResponse[], form: number): AdStep {
  const e = engineOf(bank, responses);
  const stop = stopOf(bank, responses);
  if (stop) return { done: true, level: e.level, item_id: null, stop };
  const it = pickAdaptive(items, bank.id, e.level, responses, form);
  if (!it) return { done: true, level: e.level, item_id: null, stop: 'exhausted' };
  return { done: false, level: e.level, item_id: it.id, stop: null };
}

/** Percentile rank (0-100, integer, half the ties counted below) of an estimate in a norm group; null under NORM_MIN people. */
export function percentileOf(estimate: number, others: number[]): number | null {
  const n = others.length;
  if (n < NORM_MIN) return null;
  const below = others.filter((x) => x < estimate).length;
  const eq = others.filter((x) => x === estimate).length;
  return Math.floor((200 * below + 100 * eq + n) / (2 * n));
}

export interface AttemptLite { id: string; bank_id: string; person_id: string; status: string; estimate: number | null; completed_at: string | null; counts?: boolean | null; responses?: AdResponse[] | null; started_at?: string | null; meets?: boolean | null }
/** The latest completed (counting) attempt per person in a bank, by (completed_at, id). */
export function latestPerPerson<T extends AttemptLite>(attempts: T[], bankId: string, before?: string | null): T[] {
  const m = new Map<string, T>();
  for (const a of attempts) {
    if (a.bank_id !== bankId || a.status !== 'completed' || a.counts === false || a.estimate == null) continue;
    if (before != null && !(String(a.completed_at) < before)) continue;
    const cur = m.get(a.person_id);
    if (!cur || String(a.completed_at) > String(cur.completed_at) || (String(a.completed_at) === String(cur.completed_at) && a.id > cur.id)) m.set(a.person_id, a);
  }
  return [...m.values()];
}
/** Norm group of a result: the latest counting attempt of every other person in the bank, completed before `before` when given. */
export const normGroup = (attempts: AttemptLite[], bankId: string, personId: string, before?: string | null) =>
  latestPerPerson(attempts, bankId, before).filter((a) => a.person_id !== personId).map((a) => Number(a.estimate));

/** Score a finished attempt: estimate, criterion result or percentile, capped evidence and the reasons. */
export function scoreAdaptive(bank: BankLite, safety: boolean, responses: AdResponse[], stop: Stop, norm: number[]): AdScore {
  const e = engineOf(bank, responses);
  const estimate = e.estimate;
  const criterion = safety || bank.mode === 'criterion';
  const meets = criterion ? estimate >= Number(bank.cut_level) : null;
  const percentile = criterion ? null : percentileOf(estimate, norm);
  const norm_n = criterion || percentile == null ? null : norm.length;
  const cap = Number(bank.evidence_cap);
  const evidence = estimate >= 1 ? [...(bank.skill_ids ?? [])].sort(cmp).map((skill_id) => ({ skill_id, level: Math.min(cap, estimate) })) : [];
  const n = responses.length;
  const reasons: Reason[] = [
    { code: 'fs21_estimate', key: 'm05.ad.reason.estimate', vars: { level: estimate, n } },
    { code: 'fs21_stop', key: `m05.ad.reason.stop.${stop}`, vars: { n, max: Number(bank.max_items), window: Number(bank.stable_window) } },
  ];
  if (criterion) {
    reasons.push({ code: meets ? 'fs21_meets' : 'fs21_below', key: `m05.ad.reason.${meets ? 'meets' : 'below'}`, vars: { cut: Number(bank.cut_level) } });
    reasons.push({ code: 'fs21_no_percentile', key: safety ? 'm05.ad.reason.noPercentileSafety' : 'm05.ad.reason.noPercentile' });
  } else if (percentile != null) {
    reasons.push({ code: 'fs21_percentile', key: 'm05.ad.reason.percentile', vars: { pct: percentile, n: norm.length } });
  } else {
    reasons.push({ code: 'fs21_percentile_suppressed', key: 'm05.ad.reason.pctSuppressed', vars: { min: NORM_MIN } });
  }
  if (estimate > cap) reasons.push({ code: 'fs21_cap', key: 'm05.ad.reason.cap', vars: { level: cap } });
  return { estimate, stop, meets, percentile, norm_n, safety, evidence, reasons };
}

// ───────────── Retake rule (UTC dates)
export const addDays = (d: string, n: number) => {
  const t = new Date(`${d.slice(0, 10)}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};
/** First date a new attempt on the bank may start, or null when one may start now. */
export function nextStartOn(bank: Pick<BankLite, 'id' | 'retake_days'>, mine: Pick<AttemptLite, 'bank_id' | 'status' | 'completed_at'>[], today: string): string | null {
  const last = mine.filter((a) => a.bank_id === bank.id && a.status === 'completed' && a.completed_at).map((a) => String(a.completed_at)).sort().pop();
  if (!last) return null;
  const on = addDays(last, Number(bank.retake_days));
  return on > today ? on : null;
}

// ───────────── My banks (adaptiveOverview), mirrored by SQL kafaa_ad_overview_for: ENEC line suppressed under minGroup
export interface BankCard {
  bank_id: string; criterion: boolean; safety: boolean; in_progress: string | null; can_start: boolean; next_on: string | null;
  latest: { attempt_id: string; estimate: number; meets: boolean | null; percentile: number | null; completed_at: string } | null;
  enec_avg: number | null; enec_meets_pct: number | null; enec_n: number | null; attempts: number;
}
type BankRow = BankLite & { sort?: number | null };
export function overviewFor(personId: string, banks: BankRow[], skills: Map<string, SkillLite>, attempts: AttemptLite[], today: string, minGroup: number): BankCard[] {
  const mine = attempts.filter((a) => a.person_id === personId);
  const r1 = (x: number) => Math.floor(x * 10 + 0.5) / 10;
  return banks.filter((b) => (b.status ?? 'active') === 'active').sort((x, y) => Number(x.sort ?? 0) - Number(y.sort ?? 0) || cmp(x.id, y.id)).map((bank) => {
    const safety = bankIsSafety(bank, skills);
    const criterion = safety || bank.mode === 'criterion';
    const open = mine.filter((a) => a.bank_id === bank.id && a.status === 'in_progress').sort((x, y) => cmp(String(y.started_at), String(x.started_at)))[0];
    const next = open ? null : nextStartOn(bank, mine, today);
    const latest = latestPerPerson(mine, bank.id)[0];
    const group = latestPerPerson(attempts, bank.id);
    const big = group.length >= minGroup;
    return {
      bank_id: bank.id, criterion, safety, in_progress: open?.id ?? null, can_start: !!open || next == null, next_on: next,
      latest: latest ? { attempt_id: latest.id, estimate: Number(latest.estimate), meets: latest.meets ?? null, percentile: (latest as AttemptLite & { percentile?: number | null }).percentile ?? null, completed_at: String(latest.completed_at) } : null,
      enec_avg: big && !criterion ? r1(group.reduce((s, a) => s + Number(a.estimate), 0) / group.length) : null,
      enec_meets_pct: big && criterion ? r1((100 * group.filter((a) => Number(a.estimate) >= Number(bank.cut_level)).length) / group.length) : null,
      enec_n: big ? group.length : null,
      attempts: mine.filter((a) => a.bank_id === bank.id && a.status === 'completed').length,
    };
  });
}

// ───────────── Bank statistics (training staff), mirrored by SQL kafaa_ad_stats_core: suppressed under minGroup
export interface BankStats {
  bank_id: string; tested: number; n: number | null; avg_estimate: number | null; dist: { level: number; n: number | null }[];
  pct_low: number | null; pct_meets: number | null; criterion: boolean;
}
const r1 = (x: number) => Math.floor(x * 10 + 0.5) / 10;
export function bankStats(bank: BankLite, safety: boolean, attempts: AttemptLite[], minGroup: number): BankStats {
  const latest = latestPerPerson(attempts, bank.id);
  const tested = latest.length;
  const big = tested >= minGroup;
  const est = latest.map((a) => Number(a.estimate));
  const criterion = safety || bank.mode === 'criterion';
  return {
    bank_id: bank.id, tested, n: big ? tested : null,
    avg_estimate: big ? r1(est.reduce((s, x) => s + x, 0) / tested) : null,
    dist: [0, 1, 2, 3, 4].map((l) => { const c = est.filter((x) => x === l).length; return { level: l, n: big && c >= minGroup ? c : null }; }),
    pct_low: big ? r1((100 * est.filter((x) => x <= 1).length) / tested) : null,
    pct_meets: big && criterion ? r1((100 * est.filter((x) => x >= Number(bank.cut_level)).length) / tested) : null,
    criterion,
  };
}
/** Per item: times seen in completed attempts, exposure share, observed p-value (only from 10 answers). */
export function itemUsage(items: Pick<ItemLite, 'id' | 'bank_id'>[], attempts: AttemptLite[]) {
  const done = attempts.filter((a) => a.status === 'completed');
  return items.map((i) => {
    const inBank = done.filter((a) => a.bank_id === i.bank_id);
    let seen = 0;
    let right = 0;
    for (const a of inBank) for (const r of a.responses ?? []) if (r.item_id === i.id) { seen++; if (r.correct) right++; }
    return { item_id: i.id, seen, exposure: inBank.length ? r1((100 * seen) / inBank.length) : 0, p_obs: seen >= NORM_MIN ? Math.floor((100 * right) / seen + 0.5) / 100 : null };
  });
}

// ───────────── Item checks (saveAdaptiveItem, seed): same rules in SQL kafaa_ad_item_problem
export interface AdItemInput {
  id?: string | null; bank_id: string; skill_id: string; facet: string; difficulty: number; stem_en: string; stem_ar: string; options_en: string[]; options_ar: string[];
  correct: number; explain_en?: string; explain_ar?: string; status?: 'active' | 'retired';
}
export const normText = (s: unknown) => (typeof s === 'string' ? s.trim().replace(/\s+/g, ' ').toLowerCase() : '');
export const hasRestrictedTerm = (text: string) => { const t = text.toLowerCase(); return RESTRICTED_TERMS.some((w) => t.includes(w)); };
export const levelOfDifficulty = (d: number) => Math.floor(Number(d));
/** First problem code or null: bank, skill, facet, difficulty, texts, options, key, restricted wording, copy of a secure-bank stem. */
export function adItemProblem(i: AdItemInput, banks: Pick<BankLite, 'id' | 'skill_ids'>[], secureStems: Set<string>): string | null {
  const bank = banks.find((b) => b.id === i.bank_id);
  if (!bank) return 'bank';
  if (!(bank.skill_ids ?? []).includes(i.skill_id)) return 'skill';
  if (typeof i.facet !== 'string' || !/^[a-z][a-z0-9_]{0,39}$/.test(i.facet)) return 'facet';
  const d = Number(i.difficulty);
  if (typeof i.difficulty !== 'number' || !Number.isFinite(d) || d < 1 || d >= 5 || Math.abs(Math.round(d * 100) - d * 100) > 1e-6) return 'difficulty';
  const s = (x: unknown) => (typeof x === 'string' ? x.trim() : '');
  if (!s(i.stem_en) || !s(i.stem_ar) || s(i.stem_en).length > STEM_MAX || s(i.stem_ar).length > STEM_MAX) return 'stem';
  const oe = Array.isArray(i.options_en) ? i.options_en : [];
  const oa = Array.isArray(i.options_ar) ? i.options_ar : [];
  if (oe.length < OPTIONS_MIN || oe.length > OPTIONS_MAX || oe.length !== oa.length) return 'options';
  if ([...oe, ...oa].some((o) => !s(o) || s(o).length > OPTION_MAX)) return 'options';
  if (!Number.isInteger(i.correct) || i.correct < 0 || i.correct >= oe.length) return 'correct';
  if (hasRestrictedTerm([i.stem_en, i.stem_ar, ...oe, ...oa, i.explain_en ?? '', i.explain_ar ?? ''].join(' '))) return 'restricted';
  if (secureStems.has(normText(i.stem_en)) || secureStems.has(normText(i.stem_ar))) return 'secure_copy';
  return null;
}
