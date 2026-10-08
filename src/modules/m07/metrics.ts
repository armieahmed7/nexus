/**
 * M07 pure helpers (no React): metric registry, share computation with suppression, bench status, CSV watermark and the
 * SIMULATED scenario projection. Used by the workforce pages and unit-tested in tests/unit/m07-workforce.test.ts.
 */
import type { AggregateRow } from '../../data/types';
import { MIN_GROUP_SIZE } from '../../auth/policy';

export type Dim = 'family' | 'level' | 'entity';
export const DIM_COL: Record<Dim, 'family_id' | 'level' | 'entity_id'> = { family: 'family_id', level: 'level', entity: 'entity_id' };

/** Metric registry: every tile links to /workforce/definitions#<key>, which names the definition, GRI disclosure and source table. */
export interface MetricDef {
  key: string;
  table: 'kafaa_kpi_series' | 'kafaa_workforce_snapshots' | 'kafaa_critical_roles' | 'kafaa_scholar_cohorts' | 'kafaa_training_records' | 'kafaa_applications';
  kpi?: string; // kpi_series.metric
  gri?: string;
  unit: '%' | 'people' | 'h' | 'count' | 'days';
}
export const METRICS: MetricDef[] = [
  { key: 'emiratization', table: 'kafaa_kpi_series', kpi: 'emiratization', gri: 'GRI 405-1', unit: '%' },
  { key: 'emiratization_senior', table: 'kafaa_kpi_series', kpi: 'emiratization_senior', gri: 'GRI 405-1', unit: '%' },
  { key: 'top_positions_uae', table: 'kafaa_kpi_series', kpi: 'top_positions_uae', gri: 'GRI 405-1', unit: 'people' },
  { key: 'women', table: 'kafaa_kpi_series', kpi: 'women', gri: 'GRI 405-1', unit: '%' },
  { key: 'employees', table: 'kafaa_kpi_series', kpi: 'employees', gri: 'GRI 2-7', unit: 'people' },
  { key: 'training_hours', table: 'kafaa_kpi_series', kpi: 'training_hours', gri: 'GRI 404-1', unit: 'h' },
  { key: 'training_hours_per_employee', table: 'kafaa_kpi_series', kpi: 'training_hours_per_employee', gri: 'GRI 404-1', unit: 'h' },
  { key: 'attrition', table: 'kafaa_kpi_series', kpi: 'attrition', gri: 'GRI 401-1', unit: '%' },
  { key: 'hires', table: 'kafaa_kpi_series', kpi: 'hires', gri: 'GRI 401-1', unit: 'people' },
  { key: 'sro_ro', table: 'kafaa_kpi_series', kpi: 'sro_ro', unit: 'people' },
  { key: 'coct_population', table: 'kafaa_kpi_series', kpi: 'coct_population', unit: 'people' },
  { key: 'loct_population', table: 'kafaa_kpi_series', kpi: 'loct_population', unit: 'people' },
  { key: 'quals_renewed_on_time', table: 'kafaa_kpi_series', kpi: 'quals_renewed_on_time', unit: '%' },
  { key: 'lapses', table: 'kafaa_kpi_series', kpi: 'lapses', unit: 'count' },
  { key: 'jpm_to_signed_days', table: 'kafaa_kpi_series', kpi: 'jpm_to_signed_days', unit: 'days' },
  { key: 'equivalency_turnaround', table: 'kafaa_kpi_series', kpi: 'equivalency_turnaround', unit: 'days' },
  { key: 'share_emirati', table: 'kafaa_workforce_snapshots', gri: 'GRI 405-1', unit: '%' },
  { key: 'share_women', table: 'kafaa_workforce_snapshots', gri: 'GRI 405-1', unit: '%' },
  { key: 'headcount', table: 'kafaa_workforce_snapshots', gri: 'GRI 2-7', unit: 'people' },
  { key: 'attrition_rate', table: 'kafaa_workforce_snapshots', gri: 'GRI 401-1', unit: '%' },
  { key: 'hours_per_head', table: 'kafaa_workforce_snapshots', gri: 'GRI 404-1', unit: 'h' },
  { key: 'bench_depth', table: 'kafaa_critical_roles', unit: 'people' },
  { key: 'cohort_progress', table: 'kafaa_scholar_cohorts', unit: 'people' },
  { key: 'completions', table: 'kafaa_training_records', unit: 'count' },
  { key: 'funnel', table: 'kafaa_applications', unit: 'count' },
];
export const metricByKey = (k: string) => METRICS.find((m) => m.key === k);

export function latestPeriod(periods: string[]): string | null {
  return periods.length ? [...periods].sort().at(-1)! : null;
}

/** Rows that belong to exactly one dimension (the seed stores one dimension per row; totals have all three null). */
export function rowsFor(rows: AggregateRow[], dim: Dim | 'total'): AggregateRow[] {
  return rows.filter((r) => {
    const f = r.family_id != null, l = r.level != null, e = r.entity_id != null;
    if (dim === 'total') return !f && !l && !e;
    return dim === 'family' ? f && !l && !e : dim === 'level' ? l && !f && !e : e && !f && !l;
  });
}

export interface ShareRow {
  key: string;
  value: number | null; // percentage
  numerator: number | null;
  denominator: number | null;
  suppressed: boolean;
}
/** Share of `measure` in headcount per group; suppressed when either cell is suppressed (never derive a hidden value). */
export function shareRows(rows: AggregateRow[], dim: Dim | 'total', measure: string): ShareRow[] {
  const sel = rowsFor(rows, dim);
  const col = dim === 'total' ? null : DIM_COL[dim];
  const keyOf = (r: AggregateRow) => (col ? String(r[col]) : 'total');
  const keys = Array.from(new Set(sel.map(keyOf)));
  // Groups without both rows have no data for this measure (not the same as suppressed): leave them out.
  return keys.filter((key) => sel.some((r) => keyOf(r) === key && r.measure === 'headcount') && sel.some((r) => keyOf(r) === key && r.measure === measure)).map((key) => {
    const hc = sel.find((r) => keyOf(r) === key && r.measure === 'headcount');
    const m = sel.find((r) => keyOf(r) === key && r.measure === measure);
    const suppressed = !hc || !m || hc.suppressed || m.suppressed || hc.value == null || m.value == null || (hc.value ?? 0) < MIN_GROUP_SIZE;
    if (suppressed) return { key, value: null, numerator: null, denominator: null, suppressed: true };
    const value = measure === 'training_hours' ? m!.value! / hc!.value! : (m!.value! / hc!.value!) * 100;
    return { key, value: Math.round(value * 10) / 10, numerator: m!.value, denominator: hc!.value, suppressed: false };
  });
}

/** Values of one measure per group (counts), suppression kept. */
export function valueRows(rows: AggregateRow[], dim: Dim | 'total', measure: string): ShareRow[] {
  const col = dim === 'total' ? null : DIM_COL[dim];
  return rowsFor(rows, dim)
    .filter((r) => r.measure === measure)
    .map((r) => ({ key: col ? String(r[col]) : 'total', value: r.suppressed ? null : r.value, numerator: r.suppressed ? null : r.value, denominator: r.group_size, suppressed: r.suppressed }));
}

export type BenchStatus = 'met' | 'at_risk' | 'critical';
/** Qualified people against the HR target: met at 100%, at risk from 90%, critical below 90%. */
export function benchStatus(r: { qualified: number; target_bench: number }): BenchStatus {
  if (r.target_bench <= 0 || r.qualified >= r.target_bench) return 'met';
  return r.qualified / r.target_bench >= 0.9 ? 'at_risk' : 'critical';
}

/** First line of every workforce export: aggregate-only marking, the requester's role and the date. */
export function csvWatermark(requester: string, date: string): string {
  return `"Kafa'a · AGGREGATE ONLY · groups under ${MIN_GROUP_SIZE} suppressed · exported by ${requester.replace(/"/g, "'")} on ${date} · not for onward release without CHCO approval"`;
}

// ───────────── Scenario planner (always SIMULATED; assumptions are inputs, never forecasts)
export interface ScenarioParams {
  units: number; // additional APR-1400-class units
  startYear: number; // first year the new units need licensed crews
  attritionPct: number; // annual attrition among licensed operators
  dntIntake: number; // DNT intake per year feeding the Local Operator pool
  horizon: number; // last year shown
  perUnit?: number; // licensed operators (RO + SRO) per unit
  baseline?: number; // licensed operators today
  inTraining?: number; // RO/SRO candidates currently in initial training
}
export interface ScenarioYear {
  year: number;
  required: number;
  available: number;
  gap: number;
}
export function projectScenario(p: ScenarioParams): { simulated: true; years: ScenarioYear[]; peakGap: number } {
  const perUnit = p.perUnit ?? 48;
  const baseline = p.baseline ?? 190;
  const inTraining = p.inTraining ?? 70;
  const first = 2026;
  const years: ScenarioYear[] = [];
  let available = baseline;
  for (let y = first; y <= Math.max(first, p.horizon); y++) {
    if (y > first) {
      const fromPipeline = y - first <= 3 ? Math.round(inTraining / 3) : 0; // current candidates license over ~3 years
      const fromDnt = y - first >= 5 ? Math.round(p.dntIntake * 0.5) : 0; // DNT (24 months) + 36 months as LO, half progress to RO
      available = Math.round(available * (1 - p.attritionPct / 100)) + fromPipeline + fromDnt;
    }
    const required = baseline + (y >= p.startYear ? p.units * perUnit : 0);
    years.push({ year: y, required, available, gap: Math.max(0, required - available) });
  }
  return { simulated: true, years, peakGap: Math.max(0, ...years.map((x) => x.gap)) };
}
