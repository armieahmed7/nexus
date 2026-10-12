/**
 * M35 · FS50 Critical Future-Skills Register. Pure rules, import-free apart from the FS01 taxonomy vocabulary (node seed scripts and the
 * PGlite validator load this file directly). SQL mirror, change both together:
 * supabase/migrations/20261010261001_kafaa_fs61_strategy_forecasts.sql (kafaa_crs_*).
 *
 * A register row names one catalogue skill ENEC must secure: an owner (a function and a role card), a target level, targets in
 * people-equivalents by year, KPIs, a build / buy / borrow / bot decision with its rationale (EN and AR) and links to FS04 gap plans.
 * Progress is computed, never typed: counted F01 states of active staff (verified, evidenced, validated; self-claims never count) at the
 * target level or above, scaled to the SAMPLE organisation headcount like F35, against the target for the year (linear between the
 * target years). Under 10 measured people: suppressed. Quarterly reviews (HR director) snapshot the computed progress and write an audit
 * row and a ledger row.
 */
import type { Reason } from '../../domain/engines/types';
import { OWNER_ROLES } from '../../domain/taxonomy.ts';

export const MIN_GROUP = 10;
export const DECISIONS = ['build', 'buy', 'borrow', 'bot'] as const;
export type Decision = (typeof DECISIONS)[number];
export const KPI_KINDS = ['holders_pe', 'share_l3', 'plans_active', 'forecast_gap_mid'] as const;
export type KpiKind = (typeof KPI_KINDS)[number];
/** Lower is better for these KPIs (a gap target is a ceiling). */
export const KPI_DOWN: KpiKind[] = ['forecast_gap_mid'];
export const KPI_RANGE: Record<KpiKind, [number, number]> = { holders_pe: [0, 5000], share_l3: [0, 100], plans_active: [0, 10], forecast_gap_mid: [-5000, 5000] };
export const RATINGS = ['met', 'on_track', 'at_risk', 'off_track'] as const;
export type Rating = (typeof RATINGS)[number];
export const CS_STATUSES = ['draft', 'active', 'retired'] as const;
export type CsStatus = (typeof CS_STATUSES)[number];
export const OWNER_FUNCTIONS = OWNER_ROLES;
export const TARGET_YEARS: [number, number] = [2026, 2035];
export const PE_MAX = 5000;
export const RATIONALE: [number, number] = [20, 600];
export const NOTE: [number, number] = [10, 600];
/** Progress bands: share of this year's target reached. */
export const BANDS = { met: 100, on_track: 85, at_risk: 60 } as const;

export interface Target { year: number; pe: number }
export interface Kpi { kind: KpiKind; target: number }
export interface CriticalInput {
  id?: string | null;
  skill_id: string;
  owner_function: string;
  owner_person_id: string;
  target_level: number;
  targets: Target[];
  kpis: Kpi[];
  decision: Decision;
  rationale_en: string;
  rationale_ar: string;
  gap_plan_ids: string[];
  status: CsStatus;
}
export interface CriticalCtx {
  skills: Record<string, { area: string | null; lifecycle: string | null }>;
  /** people who may own a row: active staff */
  owners: string[];
  /** FS04 gap plans: id -> skill */
  plans: Record<string, { sk_id: string | null }>;
}
export type CriticalProblem = 'skill' | 'owner' | 'level' | 'targets' | 'kpis' | 'decision' | 'rationale' | 'plans' | 'status';

const isInt = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const ARABIC = /[\u0600-\u06FF]/;

/** The first problem of a register row (null = fine). Same checks, same order as kafaa_crs_problem. */
export function criticalProblem(x: Partial<CriticalInput> | null | undefined, ctx: CriticalCtx): CriticalProblem | null {
  const i = (x ?? {}) as Record<string, unknown>;
  const sk = typeof i.skill_id === 'string' ? ctx.skills[i.skill_id] : undefined;
  if (!sk || sk.area === 'security' || sk.lifecycle === 'obsolete') return 'skill';
  if (typeof i.owner_function !== 'string' || !(OWNER_FUNCTIONS as readonly string[]).includes(i.owner_function) || typeof i.owner_person_id !== 'string' || !ctx.owners.includes(i.owner_person_id)) return 'owner';
  if (!isInt(i.target_level, 1, 4)) return 'level';
  const tg = i.targets;
  if (!Array.isArray(tg) || tg.length < 1 || tg.length > 6) return 'targets';
  let prev = 0;
  for (const t of tg as Record<string, unknown>[]) {
    if (!t || typeof t !== 'object' || !isInt(t.year, TARGET_YEARS[0], TARGET_YEARS[1]) || !isInt(t.pe, 0, PE_MAX) || (t.year as number) <= prev) return 'targets';
    prev = t.year as number;
  }
  const kp = i.kpis;
  if (!Array.isArray(kp) || kp.length < 1 || kp.length > 4) return 'kpis';
  const seen: string[] = [];
  for (const k of kp as Record<string, unknown>[]) {
    if (!k || typeof k !== 'object' || typeof k.kind !== 'string' || !(KPI_KINDS as readonly string[]).includes(k.kind) || seen.includes(k.kind)) return 'kpis';
    const [lo, hi] = KPI_RANGE[k.kind as KpiKind];
    if (!isInt(k.target, lo, hi)) return 'kpis';
    seen.push(k.kind);
  }
  if (typeof i.decision !== 'string' || !(DECISIONS as readonly string[]).includes(i.decision)) return 'decision';
  const en = txt(i.rationale_en), ar = txt(i.rationale_ar);
  if (en.length < RATIONALE[0] || en.length > RATIONALE[1] || ar.length < RATIONALE[0] || ar.length > RATIONALE[1] || !ARABIC.test(ar)) return 'rationale';
  const gp = i.gap_plan_ids;
  if (!Array.isArray(gp) || gp.length > 5) return 'plans';
  const gs: string[] = [];
  for (const g of gp) {
    if (typeof g !== 'string' || gs.includes(g) || !ctx.plans[g] || ctx.plans[g].sk_id !== i.skill_id) return 'plans';
    gs.push(g);
  }
  if (typeof i.status !== 'string' || !(CS_STATUSES as readonly string[]).includes(i.status)) return 'status';
  return null;
}

// ───────────── Quarterly review input
export interface ReviewInputLite { critical_skill_id: string; rating: string; note_en: string; note_ar: string; decision?: string | null; rationale_en?: string | null; rationale_ar?: string | null }
/** The first problem of a review input (null = fine). Same order as kafaa_crs_review_problem. */
export function reviewProblem(i: Partial<ReviewInputLite> | null | undefined, current: string): string | null {
  const x = (i ?? {}) as Record<string, unknown>;
  if (typeof x.rating !== 'string' || !(RATINGS as readonly string[]).includes(x.rating)) return 'rating';
  const en = txt(x.note_en), ar = txt(x.note_ar);
  if (en.length < NOTE[0] || en.length > NOTE[1] || ar.length < NOTE[0] || ar.length > NOTE[1]) return 'notes';
  if (x.decision != null && x.decision !== '') {
    if (typeof x.decision !== 'string' || !(DECISIONS as readonly string[]).includes(x.decision)) return 'decision';
    if (x.decision !== current) {
      const re = txt(x.rationale_en), ra = txt(x.rationale_ar);
      if (re.length < RATIONALE[0] || re.length > RATIONALE[1] || ra.length < RATIONALE[0] || ra.length > RATIONALE[1] || !ARABIC.test(ra)) return 'rationale';
    }
  }
  return null;
}


// ───────────── Quarters (UTC dates as YYYY-MM-DD)
export const quarterOfIso = (d: string) => `${d.slice(0, 4)}-Q${Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1}`;
export function quarterEndIso(q: string): string {
  const y = Number(q.slice(0, 4)), n = Number(q.slice(6));
  return `${y}-${['03-31', '06-30', '09-30', '12-31'][n - 1]}`;
}
export function prevQuarter(q: string): string {
  const y = Number(q.slice(0, 4)), n = Number(q.slice(6));
  return n === 1 ? `${y - 1}-Q4` : `${y}-Q${n - 1}`;
}

// ───────────── Progress
export interface StateLite { person_id: string; skill_id: string; level: number; basis?: string | null; active?: boolean | null }
/** Counted holders of a skill at exact levels 1..4 (best counted state per active staff member; claims never count). */
export function heldByLevel(states: StateLite[], staff: Set<string>, skillId: string): number[] {
  const best = new Map<string, number>();
  for (const s of states) {
    if (s.skill_id !== skillId || s.active === false || s.basis === 'claimed' || !staff.has(s.person_id) || !(Number(s.level) >= 1)) continue;
    best.set(s.person_id, Math.max(best.get(s.person_id) ?? 0, Math.min(4, Math.floor(Number(s.level)))));
  }
  const out = [0, 0, 0, 0];
  for (const lv of best.values()) out[lv - 1]++;
  return out;
}
/** This year's target: the first target before its year, the last after its year, linear in between; rounded half up. */
export function targetFor(targets: Target[], year: number): number {
  const t = [...targets].sort((a, b) => a.year - b.year);
  if (!t.length) return 0;
  if (year <= t[0].year) return t[0].pe;
  const last = t[t.length - 1];
  if (year >= last.year) return last.pe;
  for (let i = 1; i < t.length; i++) {
    if (year <= t[i].year) {
      const lo = t[i - 1], hi = t[i];
      return Math.round(lo.pe + (hi.pe - lo.pe) * (year - lo.year) / (hi.year - lo.year));
    }
  }
  return last.pe;
}
export type ProgressStatus = Rating | 'suppressed' | 'no_target';
export interface Progress {
  suppressed: boolean;
  /** people-equivalents at the target level or above (null when suppressed) */
  pe: number | null;
  target_year: number;
  target_pe: number;
  pct: number | null;
  status: ProgressStatus;
  /** counted holders at exact levels 1..4; a cell under 10 is null (suppressed) */
  mix: (number | null)[];
  /** share of counted holders at level 3 or above, whole percent (null when either count is under 10) */
  share_l3: number | null;
}
export function bandOf(pct: number): Rating {
  return pct >= BANDS.met ? 'met' : pct >= BANDS.on_track ? 'on_track' : pct >= BANDS.at_risk ? 'at_risk' : 'off_track';
}
export function progressOf(row: { target_level: number; targets: Target[] }, held: number[], scale: number, year: number): Progress {
  let n = 0;
  for (let L = row.target_level; L <= 4; L++) n += held[L - 1];
  const all = held[0] + held[1] + held[2] + held[3];
  const n3 = held[2] + held[3];
  const target_pe = targetFor(row.targets, year);
  const mix = held.map((v) => (v >= MIN_GROUP ? v : null));
  const share_l3 = all >= MIN_GROUP && n3 >= MIN_GROUP ? Math.round(100 * n3 / all) : null;
  if (n < MIN_GROUP) return { suppressed: true, pe: null, target_year: year, target_pe, pct: null, status: 'suppressed', mix, share_l3 };
  const pe = Math.round(n * scale);
  const pct = target_pe > 0 ? Math.round(100 * pe / target_pe) : null;
  return { suppressed: false, pe, target_year: year, target_pe, pct, status: pct == null ? 'no_target' : bandOf(pct), mix, share_l3 };
}

// ───────────── KPIs and reviews
export interface KpiValue { kind: KpiKind; target: number; value: number | null; met: boolean | null }
export function kpiValues(kpis: Kpi[], v: { progress: Progress; plans_active: number; forecast_gap_mid: number | null }): KpiValue[] {
  return kpis.map((k) => {
    const value = k.kind === 'holders_pe' ? v.progress.pe : k.kind === 'share_l3' ? v.progress.share_l3 : k.kind === 'plans_active' ? v.plans_active : v.forecast_gap_mid;
    const met = value == null ? null : KPI_DOWN.includes(k.kind) ? value <= k.target : value >= k.target;
    return { kind: k.kind, target: k.target, value, met };
  });
}
export type ReviewStateCode = 'done' | 'due' | 'overdue' | 'not_started' | 'retired';
export interface ReviewState { quarter: string; due_on: string; state: ReviewStateCode; last_quarter: string | null }
/** Quarterly review state of a row on a day. */
export function reviewState(row: { status: string; adopted_on?: string | null }, reviews: { quarter: string }[], today: string): ReviewState {
  const q = quarterOfIso(today);
  const qs = reviews.map((r) => r.quarter).sort();
  const last = qs.length ? qs[qs.length - 1] : null;
  const base = { quarter: q, due_on: quarterEndIso(q), last_quarter: last };
  if (row.status === 'draft') return { ...base, state: 'not_started' };
  if (row.status === 'retired') return { ...base, state: 'retired' };
  if (qs.includes(q)) return { ...base, state: 'done' };
  const adoptedQ = quarterOfIso(row.adopted_on ?? today);
  if (adoptedQ >= q || qs.includes(prevQuarter(q))) return { ...base, state: 'due' };
  return { ...base, state: 'overdue' };
}

/** Attention score and reasons of an active row (ranks register rows, never people). */
export function attentionOf(x: { status: string; decision: string; progress: Progress; review: ReviewState; plans_active: number; forecast_gap_mid: number | null }): { score: number; reasons: Reason[] } {
  const reasons: Reason[] = [];
  let score = 0;
  if (x.status !== 'active') return { score, reasons };
  if (x.review.state === 'overdue') { score += 3; reasons.push({ code: 'cs_review_overdue', key: 'm35.reasons.cs_review_overdue', vars: { quarter: x.review.quarter } }); }
  else if (x.review.state === 'due') { score += 1; reasons.push({ code: 'cs_review_due', key: 'm35.reasons.cs_review_due', vars: { date: x.review.due_on } }); }
  const p = x.progress;
  if (p.status === 'off_track') { score += 3; reasons.push({ code: 'cs_off_track', key: 'm35.reasons.cs_off_track', vars: { pct: p.pct ?? 0 } }); }
  else if (p.status === 'at_risk') { score += 2; reasons.push({ code: 'cs_at_risk', key: 'm35.reasons.cs_at_risk', vars: { pct: p.pct ?? 0 } }); }
  else if (p.status === 'suppressed') { score += 1; reasons.push({ code: 'cs_suppressed', key: 'm35.reasons.cs_suppressed', vars: { n: MIN_GROUP } }); }
  if (x.forecast_gap_mid != null && x.forecast_gap_mid > 0) { score += 2; reasons.push({ code: 'cs_forecast_gap', key: 'm35.reasons.cs_forecast_gap', vars: { gap: x.forecast_gap_mid } }); }
  if (x.plans_active === 0) { score += 1; reasons.push({ code: 'cs_no_plan', key: 'm35.reasons.cs_no_plan', vars: {} }); }
  if (!reasons.length) reasons.push({ code: 'cs_on_course', key: 'm35.reasons.cs_on_course', vars: {} });
  return { score, reasons };
}

// ───────────── The board (what kafaa_crs_board_core returns)
export interface CriticalRow {
  id: string; skill_id: string; status: string; decision: string; target_level: number; targets: Target[]; kpis: Kpi[]; gap_plan_ids: string[];
  adopted_on?: string | null; sort?: number | null;
}
export interface ReleasedForecastLite { id: string; name: string; cycle: number; scenario: string; status: string; released_at?: string | null; results?: { skills?: { skill_id: string; sc: Record<string, { gap_mid: number }> }[] } | null }
export interface BoardInput {
  rows: CriticalRow[];
  reviews: { critical_skill_id: string; quarter: string }[];
  plans: { id: string; status: string }[];
  forecasts: ReleasedForecastLite[];
  states: StateLite[];
  staff: string[];
  /** organisation headcount / measured staff sample (F35 scale) */
  scale: number;
}
export interface BoardRow { id: string; skill_id: string; progress: Progress; kpis: KpiValue[]; review: ReviewState; plans_active: number; forecast_gap_mid: number | null; score: number; reasons: Reason[] }
export interface Board {
  as_of: string; year: number; quarter: string; scale: number; min_group: number;
  forecast: { id: string; name: string; cycle: number; scenario: string } | null;
  rows: BoardRow[];
  tiles: { active: number; draft: number; met: number; on_track: number; at_risk: number; off_track: number; suppressed: number; due: number; overdue: number; decisions: Record<Decision, number> };
}
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
/** The released forecast the register reads: the latest released version of the current cycle (else of any cycle). */
export function boardForecast(forecasts: ReleasedForecastLite[], year: number): ReleasedForecastLite | null {
  const rel = forecasts.filter((f) => f.status === 'released').sort((a, b) => (b.cycle - a.cycle) || cmp(b.released_at ?? '', a.released_at ?? '') || cmp(a.id, b.id));
  return rel.find((f) => f.cycle === year) ?? rel[0] ?? null;
}
export function criticalBoard(inp: BoardInput, today: string): Board {
  const year = Number(today.slice(0, 4));
  const staff = new Set(inp.staff);
  const fc = boardForecast(inp.forecasts, year);
  const rows = [...inp.rows].sort((a, b) => (Number(a.sort ?? 0) - Number(b.sort ?? 0)) || cmp(a.id, b.id));
  const out: BoardRow[] = rows.map((r) => {
    const progress = progressOf(r, heldByLevel(inp.states, staff, r.skill_id), inp.scale, year);
    const plans_active = r.gap_plan_ids.filter((g) => inp.plans.some((p) => p.id === g && p.status === 'active')).length;
    const fs = fc?.results?.skills?.find((s) => s.skill_id === r.skill_id);
    const forecast_gap_mid = fs ? fs.sc[fc!.scenario]?.gap_mid ?? null : null;
    const review = reviewState(r, inp.reviews.filter((v) => v.critical_skill_id === r.id), today);
    const at = attentionOf({ status: r.status, decision: r.decision, progress, review, plans_active, forecast_gap_mid });
    return { id: r.id, skill_id: r.skill_id, progress, kpis: kpiValues(r.kpis, { progress, plans_active, forecast_gap_mid }), review, plans_active, forecast_gap_mid, score: at.score, reasons: at.reasons };
  });
  const act = rows.filter((r) => r.status === 'active').map((r) => out.find((o) => o.id === r.id)!);
  const decisions = Object.fromEntries(DECISIONS.map((d) => [d, rows.filter((r) => r.status === 'active' && r.decision === d).length])) as Record<Decision, number>;
  return {
    as_of: today, year, quarter: quarterOfIso(today), scale: inp.scale, min_group: MIN_GROUP,
    forecast: fc ? { id: fc.id, name: fc.name, cycle: fc.cycle, scenario: fc.scenario } : null,
    rows: out,
    tiles: {
      active: act.length, draft: rows.filter((r) => r.status === 'draft').length,
      met: act.filter((r) => r.progress.status === 'met').length, on_track: act.filter((r) => r.progress.status === 'on_track').length,
      at_risk: act.filter((r) => r.progress.status === 'at_risk').length, off_track: act.filter((r) => r.progress.status === 'off_track').length,
      suppressed: act.filter((r) => r.progress.status === 'suppressed').length,
      due: act.filter((r) => r.review.state === 'due').length, overdue: act.filter((r) => r.review.state === 'overdue').length, decisions,
    },
  };
}
/** Board input from raw tables (LocalBackend, seed builder and PGlite validator share it). */
type AnyRow = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export function boardInputFromTables(raw: (t: string) => AnyRow[]): BoardInput {
  const staff = raw('people').filter((p) => p.kind === 'staff' && p.status === 'active').map((p) => p.id as string);
  const snaps = raw('workforce_snapshots').filter((w) => w.measure === 'headcount' && w.family_id == null && w.level == null && w.entity_id == null);
  const last = [...snaps].sort((x, y) => cmp(x.period, y.period)).at(-1);
  const org = last ? Math.max(0, Math.floor(Number(last.value))) : 0;
  return {
    rows: raw('critical_skills') as never, reviews: raw('critical_skill_reviews') as never, plans: raw('skill_gap_plans') as never,
    forecasts: raw('skill_forecasts').filter((f) => f.status === 'released') as never, states: raw('person_skills') as never, staff,
    scale: org > 0 && staff.length > 0 ? org / staff.length : 1,
  };
}
