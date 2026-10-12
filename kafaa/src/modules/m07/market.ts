/**
 * M07 · FS53 (wave F · E2) External benchmark lines, kept apart from measured numbers. Pure and import-free apart from types (node seed
 * scripts and the PGlite validator load this file directly). SQL mirror: kafaa_bv_problems in
 * supabase/migrations/20261010262001_kafaa_fs62_outlook_automation.sql (the guard trigger on kafaa_benchmark_values).
 *
 *  - A market value (kafaa_benchmark_values) is a copy of one sourced FS01 figure (kafaa_benchmarks.figures): same key, value, unit,
 *    labels, as-of date and one of the benchmark's https URLs. It is never typed: benchmarkValueProblems() (and the SQL guard) refuse a
 *    row whose value or labels drift from the figure. Figures the research packs flag as secondary or unverified are stored as
 *    "held" rows with a reason and are never drawn (their value is not shown either).
 *  - A measured value is computed at ENEC from the SIMULATED outlook or the FS06 task layer (measuresFrom()).
 *  - The two kinds never mix in arithmetic: sumMeasured() refuses anything that is not a measured value, position() only orders a
 *    market value against a measured one (above, below, level) and never returns a combined number, and measuresFrom() takes no
 *    market input at all. The pages draw market values dashed with the label "Market statistic" and measured values solid with
 *    "Measured at ENEC (SIMULATED)", so the two are distinguishable without colour.
 */
import type { AutomationProfile, OutlookResult } from './outlook';

export const MARKET_KIND = 'market' as const;
export const MEASURED_KIND = 'measured' as const;
export type ValueUnit = 'pct' | 'count' | 'score';
export const VERIFICATIONS = ['primary', 'secondary', 'unverified'] as const;
export type Verification = (typeof VERIFICATIONS)[number];
/** Where a market line may be drawn (M07 workforce dashboards). */
export const DASHBOARDS = ['skills_outlook', 'overview'] as const;
export type Dashboard = (typeof DASHBOARDS)[number];
/** Internal measures a market line can sit beside (all percentages). */
export const MEASURES = ['ai_task_share', 'demand_growth_2030', 'digital_holders'] as const;
export type MeasureKey = (typeof MEASURES)[number];
/** Line pattern and label per kind: the rule that keeps the two apart without colour (unit-tested). */
export const LINE_STYLE = {
  market: { pattern: 'dashed', label: 'm07.mk.marketLabel' },
  measured: { pattern: 'solid', label: 'm07.mk.measuredLabel' },
} as const;

/** One row of kafaa_benchmark_values. */
export interface BenchmarkValueRow {
  id: string;
  benchmark_id: string;
  figure_key: string;
  metric: string;
  label_en: string;
  label_ar: string;
  value: number;
  unit: string;
  scale_max?: number | null;
  as_of: string;
  source_url: string;
  verification: string;
  shown: boolean;
  held_reason_en: string;
  held_reason_ar: string;
  pack_ref: string;
  compare_to?: string | null;
  dashboards: string[];
  note_en: string;
  note_ar: string;
  sort?: number;
}
/** The FS01 benchmark fields the rule reads. */
export interface BenchmarkLite {
  id: string;
  urls: string[];
  as_of: string;
  figures: unknown;
}

export interface MarketValue {
  kind: typeof MARKET_KIND;
  id: string;
  benchmark_id: string;
  metric: string;
  value: number;
  unit: ValueUnit;
  scale_max: number | null;
  as_of: string;
  source_url: string;
  compare_to: MeasureKey | null;
}
export interface MeasuredValue {
  kind: typeof MEASURED_KIND;
  metric: MeasureKey | string;
  /** null when suppressed (fewer than 10 people behind it) or not computable */
  value: number | null;
  unit: ValueUnit;
  simulated: true;
  suppressed: boolean;
  /** people or tasks behind the number (shown as its basis) */
  basis: number | null;
}

const HTTPS = /^https:\/\/[^\s/$.?#][^\s]*$/i;
const ID = /^bv-[a-z0-9-]{3,60}$/;
const blank = (s: unknown) => typeof s !== 'string' || s.trim() === '';
const figs = (b: BenchmarkLite | undefined) => (b && Array.isArray(b.figures) ? (b.figures as Record<string, unknown>[]) : []);

/**
 * Problems that block a benchmark value row (empty = fine), in this order: id, figure, label, source, as_of, verification, held_reason,
 * compare, dashboards. Same rule as SQL kafaa_bv_problems.
 */
export function benchmarkValueProblems(r: Partial<BenchmarkValueRow>, benchmarks: BenchmarkLite[]): string[] {
  const p: string[] = [];
  const b = benchmarks.find((x) => x.id === r.benchmark_id);
  const f = figs(b).find((x) => x.key === r.figure_key);
  if (blank(r.id) || !ID.test(String(r.id))) p.push('id');
  if (!f || typeof r.value !== 'number' || Number(f.value) !== r.value || f.unit !== r.unit || (f.scale_max ?? null) !== (r.scale_max ?? null)) p.push('figure');
  if (!f || blank(r.label_en) || blank(r.label_ar) || f.label_en !== r.label_en || f.label_ar !== r.label_ar) p.push('label');
  if (!b || blank(r.source_url) || !HTTPS.test(String(r.source_url)) || !b.urls.includes(String(r.source_url))) p.push('source');
  if (!b || r.as_of !== b.as_of) p.push('as_of');
  if (!(VERIFICATIONS as readonly string[]).includes(String(r.verification)) || (r.shown === true && r.verification !== 'primary') || blank(r.pack_ref)) p.push('verification');
  if (r.shown !== true && (blank(r.held_reason_en) || blank(r.held_reason_ar))) p.push('held_reason');
  if (r.compare_to != null && (!(MEASURES as readonly string[]).includes(r.compare_to) || r.unit !== 'pct')) p.push('compare');
  const ds = Array.isArray(r.dashboards) ? r.dashboards : null;
  if (!ds || ds.some((d) => !(DASHBOARDS as readonly string[]).includes(d)) || (r.shown === true && ds.length === 0)) p.push('dashboards');
  return p;
}

/** Shown rows of one dashboard as market values, in sort order. */
export function marketValues(rows: BenchmarkValueRow[], dashboard: Dashboard): MarketValue[] {
  return rows
    .filter((r) => r.shown && r.verification === 'primary' && (r.dashboards ?? []).includes(dashboard))
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((r) => ({
      kind: MARKET_KIND, id: r.id, benchmark_id: r.benchmark_id, metric: r.metric, value: r.value, unit: r.unit as ValueUnit, scale_max: r.scale_max ?? null,
      as_of: r.as_of, source_url: r.source_url, compare_to: (r.compare_to ?? null) as MeasureKey | null,
    }));
}
/** Rows held back (secondary or unverified in the research packs): shown as a list with the reason, never with the value. */
export const heldValues = (rows: BenchmarkValueRow[]) => rows.filter((r) => !r.shown).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || (a.id < b.id ? -1 : 1));

const measured = (metric: MeasureKey, value: number | null, basis: number | null, suppressed = false): MeasuredValue =>
  ({ kind: MEASURED_KIND, metric, value: suppressed ? null : value, unit: 'pct', simulated: true, suppressed: suppressed || value == null, basis });
const pct1 = (num: number, den: number) => Math.round((1000 * num) / den) / 10;

/**
 * The internal measures, computed only from the SIMULATED outlook and the FS06 automation profile (never from a market value):
 *   demand_growth_2030  demand in 2030 over demand in the base year, visible skill families only, minus 1, in %
 *   digital_holders     share of the measured staff sample holding the digital family at Practitioner or above, in % (suppressed with the family)
 *   ai_task_share       share of rated FS06 tasks that AI can augment or partly automate, in % (a count of tasks, not people)
 */
export function measuresFrom(r: OutlookResult | null | undefined, auto?: AutomationProfile | null): Record<MeasureKey, MeasuredValue> {
  const vis = (r?.families ?? []).filter((f) => !f.suppressed);
  const d0 = vis.reduce((s, f) => s + (f.years.find((c) => c.year === r!.base_year)?.demand ?? 0), 0);
  const d30 = vis.reduce((s, f) => s + (f.years.find((c) => c.year === 2030)?.demand ?? 0), 0);
  const growth = r && vis.length && d0 > 0 && r.horizon >= 2030 ? pct1(d30 - d0, d0) : null;
  const dig = vis.find((f) => f.key === 'digital');
  const digital = r && dig && r.staff_sample > 0 ? pct1(dig.basis_n ?? 0, r.staff_sample) : null;
  const basisAll = vis.reduce((s, f) => s + (f.basis_n ?? 0), 0);
  return {
    demand_growth_2030: measured('demand_growth_2030', growth, vis.length ? basisAll : null, !r || !vis.length),
    digital_holders: measured('digital_holders', digital, dig?.basis_n ?? null, !dig),
    ai_task_share: measured('ai_task_share', auto?.ai_task_share ?? null, auto?.rated ?? null, !auto || auto.rated === 0),
  };
}

/** Adds measured values only. Throws on anything else: a market statistic is never summed with a number measured at ENEC. */
export function sumMeasured(xs: readonly MeasuredValue[]): number | null {
  for (const x of xs as readonly unknown[]) {
    const k = (x as { kind?: unknown } | null)?.kind;
    if (k !== MEASURED_KIND) throw new TypeError(k === MARKET_KIND ? 'market_value_in_sum' : 'not_a_measured_value');
  }
  if (xs.some((x) => x.suppressed || x.value == null)) return null;
  return xs.reduce((s, x) => s + (x.value as number), 0);
}

export type Position = 'above' | 'below' | 'level' | 'not_comparable' | 'suppressed';
/** Orders a measured value against a market value (no combined number): only for the same unit on a percentage scale. */
export function position(m: MarketValue, x: MeasuredValue): Position {
  if (m.kind !== MARKET_KIND || x.kind !== MEASURED_KIND) return 'not_comparable';
  if (x.suppressed || x.value == null) return 'suppressed';
  if (m.unit !== 'pct' || x.unit !== 'pct' || m.compare_to !== x.metric) return 'not_comparable';
  return x.value > m.value ? 'above' : x.value < m.value ? 'below' : 'level';
}

/** Axis maximum for a percentage pair: 100, or the next multiple of 10 above both values when both are small (kept readable). */
export function pairScale(a: number | null, b: number | null): number {
  const hi = Math.max(a ?? 0, b ?? 0);
  return hi > 60 ? 100 : Math.max(20, Math.ceil((hi * 1.25) / 10) * 10);
}
