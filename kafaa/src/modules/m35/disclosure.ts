/**
 * M35 · FS60 ISO 30414 skills and capability disclosure pack. Pure rules, import-free apart from other pure rule files (node seed
 * scripts and the PGlite validator load this file directly). SQL mirror, change both together:
 * supabase/migrations/20261010271001_kafaa_fs71_disclosure_pilots.sql (kafaa_hcd_*).
 *
 * A metric library mapped to the ISO 30414 area "Skills, Capabilities and Development" (kafaa_hc_metrics: definition, formula, source,
 * owner) and quarterly disclosures (kafaa_hc_disclosures: the computed values, the owner narrative and variance explanation of every
 * metric, the approvals and a materiality statement). Every value is computed by computeDisclosure() from the platform's own records,
 * never typed: training records (M04), learning-record-store statements (M27 xAPI), FS30 credits, FS09 AI-fluency rungs and the FS50
 * critical-skills board. Any people count under 10 is suppressed (value and count), and participation equity is reported by site, shift
 * and grade only (never nationality or gender). A metric publishes only with a narrative and the approval of a second person who did not
 * write it (maker-checker). Everything is labelled SIMULATED in the demo.
 */
import type { Reason } from '../../domain/engines/types';

export const METHOD = 'fs60-v1';
export const MIN_GROUP = 10;
export const ISO_AREA = 'skills_capabilities_development';
export const FIRST_PERIOD = '2025-Q1';
export const METRIC_KEYS = ['trained_pct', 'active_learners_pct', 'hours_per_employee', 'ai_fundamentals_pct', 'critical_on_track_pct', 'credits_per_employee', 'participation_gap_pp'] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];
export const UNITS = ['pct', 'hours', 'credits', 'pp'] as const;
export type Unit = (typeof UNITS)[number];
export const BASES = ['ytd', 'quarter', 'point'] as const;
export type Basis = (typeof BASES)[number];
/** unit, period basis and whether a rise is good, per metric key (also stored on the kafaa_hc_metrics rows; checked by the seed). */
export const METRIC_SPEC: Record<MetricKey, { unit: Unit; basis: Basis; better: 'up' | 'down' }> = {
  trained_pct: { unit: 'pct', basis: 'ytd', better: 'up' },
  active_learners_pct: { unit: 'pct', basis: 'quarter', better: 'up' },
  hours_per_employee: { unit: 'hours', basis: 'ytd', better: 'up' },
  ai_fundamentals_pct: { unit: 'pct', basis: 'point', better: 'up' },
  critical_on_track_pct: { unit: 'pct', basis: 'point', better: 'up' },
  credits_per_employee: { unit: 'credits', basis: 'ytd', better: 'up' },
  participation_gap_pp: { unit: 'pp', basis: 'ytd', better: 'down' },
};
/** decimals kept for each unit (variance uses the same scale). */
export const SCALE: Record<Unit, number> = { pct: 10, hours: 10, credits: 100, pp: 10 };
export const DIMENSIONS = ['site', 'shift', 'grade'] as const;
export type Dimension = (typeof DIMENSIONS)[number];
/** key used when the person has no value for the dimension (no unit = corporate and support functions; no crew = day work). */
export const NONE_KEY: Record<Dimension, string> = { site: 'none', shift: 'day', grade: 'none' };
export const COMPLETED_RESULTS = ['passed', 'completed', 'attended'];
export const COMPLETION_VERBS = ['completed', 'passed'];
/** Training records also reach the learning record store through the m04_course emitter: their hours count once, from the record. */
export const LRS_DUPLICATE_SOURCE = 'm04_course';
export const NARRATIVE: [number, number] = [20, 1200];
export const VARIANCE: [number, number] = [10, 600];
export const MATERIALITY: [number, number] = [40, 1500];

type AnyRow = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export interface PersonLite { id: string; kind: string; status: string; unit?: string | null; crew?: string | null; level?: string | null }
export interface TrainingLite { person_id: string; completed_on: string; hours: number; result: string }
export interface StatementLite { actor_person_id: string; verb: string; source: string; result?: { duration?: unknown } | null; occurred_at: string }
export interface CreditLite { person_id: string; completed_on: string; notional_hours: number; status: string }
export interface RungLite { person_id: string; rung: number }
export interface BoardRowLite { id: string; progress: { suppressed: boolean; status: string } }
export interface MetricDef { id: string; key: string; status: string; sort: number }
export interface DisclosureLite { id: string; period: string; metric_values?: { metrics?: { metric_id: string; value: number | null }[] } | null; approvals?: Record<string, unknown> | null }
export interface HcInput {
  people: PersonLite[];
  training: TrainingLite[];
  statements: StatementLite[];
  credits: CreditLite[];
  /** FS09 rung of every active staff member (aiRung; SQL kafaa_air_people) */
  rungs: RungLite[];
  /** FS50 register rows (id, status) */
  critical: { id: string; status: string }[];
  metrics: MetricDef[];
  disclosures: DisclosureLite[];
}

// ───────────── periods
export const PERIOD_RE = /^20\d\d-Q[1-4]$/;
export const quarterOf = (d: string) => `${d.slice(0, 4)}-Q${Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1}`;
export interface Bounds { start: string; end: string; ytd: string }
/** Quarter bounds: first and last day, and 1 January of its year (year-to-date metrics). Null when the period is malformed. */
export function periodBounds(p: unknown): Bounds | null {
  if (typeof p !== 'string' || !PERIOD_RE.test(p)) return null;
  const y = p.slice(0, 4), q = Number(p.slice(6));
  const m0 = (q - 1) * 3 + 1, m1 = q * 3;
  const last = [31, 30, 30, 31][q - 1];
  return { start: `${y}-${String(m0).padStart(2, '0')}-01`, end: `${y}-${String(m1).padStart(2, '0')}-${last}`, ytd: `${y}-01-01` };
}
/** A period can be computed from FIRST_PERIOD up to the current quarter. */
export const periodComputable = (p: unknown, today: string) => !!periodBounds(p) && (p as string) >= FIRST_PERIOD && (p as string) <= quarterOf(today);
/** A disclosure is prepared only for a quarter that has ended. */
export const periodClosed = (p: unknown, today: string) => { const b = periodBounds(p); return !!b && b.end < today; };
export function prevPeriod(p: string): string {
  const y = Number(p.slice(0, 4)), q = Number(p.slice(6));
  return q === 1 ? `${y - 1}-Q4` : `${y}-Q${q - 1}`;
}

// ───────────── reading helpers (mirrors: kafaa_hcd_minutes, the date rule)
/** xAPI ISO 8601 duration in whole minutes (a working day counts 8 hours); 0 when absent or malformed. Same as m27 durationMinutes. */
export function minutesOf(d: unknown): number {
  if (typeof d !== 'string') return 0;
  const m = d.match(/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/);
  if (!m) return 0;
  const [, dd, hh, mm, ss] = m.map((x) => (x ? Number(x) : 0));
  return Math.floor(dd * 8 * 60 + hh * 60 + mm + ss / 60 + 0.5);
}
/** the UTC calendar day of a timestamp */
export const dayOf = (ts: string) => new Date(ts).toISOString().slice(0, 10);
const inRange = (d: string, a: string, b: string) => d >= a && d <= b;
const cmpC = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
/** whole percentage with one decimal; null when the denominator is under MIN_GROUP */
export const pct10 = (num: number, den: number) => Math.floor(1000 * num / den + 0.5);
const shown = (n: number) => (n >= MIN_GROUP ? n : null);

// ───────────── the computation
export interface Cell { dim: Dimension; key: string; n: number | null; trained: number | null; not_trained: number | null; pct: number | null }
export interface MetricValue {
  metric_id: string;
  key: MetricKey;
  unit: Unit;
  basis: Basis;
  value: number | null;
  /** numerator: people (suppressed under 10), total hours or credits, or register rows (count_kind) */
  num: number | null;
  den: number | null;
  count_kind: 'people' | 'hours' | 'credits' | 'register_rows' | 'cells';
  /** register rows left out (FS50 progress suppressed or no target this year); 0 elsewhere */
  excluded: number;
  suppressed: boolean;
  cells: Cell[];
  prev_period: string | null;
  prev_value: number | null;
  variance: number | null;
}
export interface DisclosureValues {
  period: string;
  start: string;
  end: string;
  ytd: string;
  method: string;
  simulated: true;
  min_group: number;
  headcount: number | null;
  metrics: MetricValue[];
}

const staffOf = (people: PersonLite[]) => people.filter((p) => p.kind === 'staff' && p.status === 'active');
const dimKey = (p: PersonLite, d: Dimension) => ((d === 'site' ? p.unit : d === 'shift' ? p.crew : p.level) ?? NONE_KEY[d]) as string;
const isNone = (d: Dimension, k: string) => k === NONE_KEY[d];

/** Previous published value of a metric: the latest earlier disclosure in which that metric line was approved. */
export function prevValueOf(disclosures: DisclosureLite[], period: string, metricId: string): { period: string; value: number | null } | null {
  const earlier = disclosures.filter((d) => d.period < period && d.approvals && Object.prototype.hasOwnProperty.call(d.approvals, metricId))
    .sort((a, b) => cmpC(b.period, a.period));
  for (const d of earlier) {
    const m = d.metric_values?.metrics?.find((x) => x.metric_id === metricId);
    if (m) return { period: d.period, value: m.value ?? null };
  }
  return null;
}
export function varianceOf(unit: Unit, value: number | null, prev: number | null): number | null {
  if (value == null || prev == null) return null;
  const f = SCALE[unit];
  return (Math.floor(value * f + 0.5) - Math.floor(prev * f + 0.5)) / f;
}

/** computeDisclosure: every metric of the library for one quarter (TS = SQL kafaa_hcd_compute). `board` = the FS50 board on the period's
 *  last day (criticalBoard / kafaa_crs_board_core). Null when the period is malformed. */
export function computeDisclosure(inp: HcInput, period: string, board: BoardRowLite[]): DisclosureValues | null {
  const b = periodBounds(period);
  if (!b) return null;
  const staff = staffOf(inp.people);
  const ids = new Set(staff.map((p) => p.id));
  const hc = staff.length;
  const den = hc >= MIN_GROUP ? hc : null;
  const ytdTraining = inp.training.filter((r) => ids.has(r.person_id) && COMPLETED_RESULTS.includes(r.result) && inRange(String(r.completed_on).slice(0, 10), b.ytd, b.end));
  const ytdStatements = inp.statements.filter((s) => ids.has(s.actor_person_id) && inRange(dayOf(s.occurred_at), b.ytd, b.end));
  const trained = new Set<string>([...ytdTraining.map((r) => r.person_id), ...ytdStatements.filter((s) => COMPLETION_VERBS.includes(s.verb)).map((s) => s.actor_person_id)]);
  const active = new Set<string>([
    ...ytdTraining.filter((r) => inRange(String(r.completed_on).slice(0, 10), b.start, b.end)).map((r) => r.person_id),
    ...ytdStatements.filter((s) => inRange(dayOf(s.occurred_at), b.start, b.end)).map((s) => s.actor_person_id),
  ]);
  const minutes = ytdTraining.reduce((m, r) => m + Math.floor(Number(r.hours) * 60 + 0.5), 0)
    + ytdStatements.filter((s) => s.source !== LRS_DUPLICATE_SOURCE).reduce((m, s) => m + minutesOf(s.result?.duration), 0);
  const creditHours = inp.credits.filter((c) => ids.has(c.person_id) && c.status === 'counted' && inRange(String(c.completed_on).slice(0, 10), b.ytd, b.end))
    .reduce((m, c) => m + Number(c.notional_hours), 0);
  const aware = inp.rungs.filter((r) => ids.has(r.person_id) && Number(r.rung) >= 1).length;
  const activeRows = new Set(inp.critical.filter((c) => c.status === 'active').map((c) => c.id));
  const rows = board.filter((r) => activeRows.has(r.id));
  const measured = rows.filter((r) => !r.progress.suppressed && r.progress.status !== 'no_target' && r.progress.status !== 'suppressed');
  const onTrack = measured.filter((r) => r.progress.status === 'met' || r.progress.status === 'on_track').length;
  // participation equity: share trained this year by site, shift and grade (suppressed under 10)
  const cells: Cell[] = [];
  for (const d of DIMENSIONS) {
    const keys = [...new Set(staff.map((p) => dimKey(p, d)))].sort((x, y) => Number(isNone(d, x)) - Number(isNone(d, y)) || cmpC(x, y));
    for (const k of keys) {
      const g = staff.filter((p) => dimKey(p, d) === k);
      const n = g.length, tr = g.filter((p) => trained.has(p.id)).length;
      cells.push(n >= MIN_GROUP ? { dim: d, key: k, n, trained: shown(tr), not_trained: shown(n - tr), pct: pct10(tr, n) / 10 } : { dim: d, key: k, n: null, trained: null, not_trained: null, pct: null });
    }
  }
  let gap10: number | null = null;
  for (const d of DIMENSIONS) {
    const ps = cells.filter((c) => c.dim === d && c.pct != null).map((c) => Math.floor((c.pct as number) * 10 + 0.5));
    if (ps.length >= 2) gap10 = Math.max(gap10 ?? 0, Math.max(...ps) - Math.min(...ps));
  }
  const base = (key: MetricKey) => ({ key, unit: METRIC_SPEC[key].unit, basis: METRIC_SPEC[key].basis, excluded: 0, cells: [] as Cell[] });
  const people = (key: MetricKey, n: number) => ({ ...base(key), value: den ? pct10(n, den) / 10 : null, num: den ? shown(n) : null, den, count_kind: 'people' as const });
  const byKey: Record<MetricKey, Omit<MetricValue, 'metric_id' | 'suppressed' | 'prev_period' | 'prev_value' | 'variance'>> = {
    trained_pct: people('trained_pct', trained.size),
    active_learners_pct: people('active_learners_pct', active.size),
    hours_per_employee: { ...base('hours_per_employee'), value: den ? Math.floor((10 * minutes) / (60 * den) + 0.5) / 10 : null, num: den ? Math.floor((10 * minutes) / 60 + 0.5) / 10 : null, den, count_kind: 'hours' },
    ai_fundamentals_pct: people('ai_fundamentals_pct', aware),
    critical_on_track_pct: { ...base('critical_on_track_pct'), value: measured.length ? pct10(onTrack, measured.length) / 10 : null, num: onTrack, den: measured.length, count_kind: 'register_rows', excluded: rows.length - measured.length },
    credits_per_employee: { ...base('credits_per_employee'), value: den ? Math.floor((100 * creditHours) / (10 * den) + 0.5) / 100 : null, num: den ? creditHours / 10 : null, den, count_kind: 'credits' },
    participation_gap_pp: { ...base('participation_gap_pp'), value: den && gap10 != null ? gap10 / 10 : null, num: null, den: null, count_kind: 'cells', cells: den ? cells : cells.map((c) => ({ ...c, n: null, trained: null, not_trained: null, pct: null })) },
  };
  const defs = inp.metrics.filter((m) => m.status === 'active' && (METRIC_KEYS as readonly string[]).includes(m.key)).sort((x, y) => x.sort - y.sort || cmpC(x.id, y.id));
  const metrics: MetricValue[] = defs.map((m) => {
    const v = byKey[m.key as MetricKey];
    const prev = prevValueOf(inp.disclosures, period, m.id);
    return { metric_id: m.id, ...v, suppressed: v.value == null, prev_period: prev?.period ?? null, prev_value: prev?.value ?? null, variance: varianceOf(v.unit, v.value, prev?.value ?? null) };
  });
  return { period, start: b.start, end: b.end, ytd: b.ytd, method: METHOD, simulated: true, min_group: MIN_GROUP, headcount: den, metrics };
}

/** HcInput from table rows (LocalBackend raw tables, seed builder, validator). `rungs` is computed by the caller (aiRung). */
export function hcInputFromTables(raw: (t: string) => AnyRow[], rungs: RungLite[]): HcInput {
  return {
    people: raw('people').map((p) => ({ id: p.id, kind: p.kind, status: p.status, unit: p.unit ?? null, crew: p.crew ?? null, level: p.level ?? null })),
    training: raw('training_records').map((r) => ({ person_id: r.person_id, completed_on: String(r.completed_on).slice(0, 10), hours: Number(r.hours ?? 0), result: r.result })),
    statements: raw('xapi_statements').map((s) => ({ actor_person_id: s.actor_person_id, verb: s.verb, source: s.source, result: s.result ?? null, occurred_at: String(s.occurred_at) })),
    credits: raw('credit_ledger').map((c) => ({ person_id: c.person_id, completed_on: String(c.completed_on).slice(0, 10), notional_hours: Number(c.notional_hours ?? 0), status: c.status })),
    rungs,
    critical: raw('critical_skills').map((c) => ({ id: c.id, status: c.status })),
    metrics: raw('hc_metrics').map((m) => ({ id: m.id, key: m.key, status: m.status, sort: Number(m.sort ?? 0) })),
    disclosures: raw('hc_disclosures').map((d) => ({ id: d.id, period: d.period, metric_values: d.metric_values ?? null, approvals: d.approvals ?? null })),
  };
}

// ───────────── narratives, approvals and the maker-checker rule (mirrors: kafaa_hcd_line_problem, the approve RPC)
export interface LineInput { metric_id: string; narrative_en: string; narrative_ar: string; variance_en: string; variance_ar: string }
export type LineProblem = 'metric' | 'narrative' | 'variance';
const len = (v: unknown) => (typeof v === 'string' ? v.trim().length : -1);
const between = (v: unknown, [lo, hi]: [number, number]) => len(v) >= lo && len(v) <= hi;
const ARABIC = /[؀-ۿ]/;
/** A narrative line is complete: a known metric, the owner narrative (20-1200) and the variance explanation (10-600) in EN and AR
 *  (the Arabic text must contain Arabic script). */
export function lineProblem(l: Partial<LineInput> | null | undefined, metricIds: string[]): LineProblem | null {
  if (!l || typeof l.metric_id !== 'string' || !metricIds.includes(l.metric_id)) return 'metric';
  if (!between(l.narrative_en, NARRATIVE) || !between(l.narrative_ar, NARRATIVE) || !ARABIC.test(String(l.narrative_ar))) return 'narrative';
  if (!between(l.variance_en, VARIANCE) || !between(l.variance_ar, VARIANCE) || !ARABIC.test(String(l.variance_ar))) return 'variance';
  return null;
}
export const materialityOk = (en: unknown, ar: unknown) => between(en, MATERIALITY) && between(ar, MATERIALITY) && ARABIC.test(String(ar));
export interface Narrative { narrative_en: string; narrative_ar: string; variance_en: string; variance_ar: string; by: string; at: string }
export interface Approval { by: string; at: string }
export type LineState = 'missing' | 'ready' | 'approved';
/** missing = no complete narrative; ready = a narrative waits for a second person's approval; approved = published. */
export function lineState(narratives: Record<string, Narrative> | null | undefined, approvals: Record<string, Approval> | null | undefined, metricId: string): LineState {
  if (approvals && approvals[metricId]) return 'approved';
  const n = narratives?.[metricId];
  return n && lineProblem({ metric_id: metricId, ...n }, [metricId]) === null ? 'ready' : 'missing';
}
/** Approval refusal for one line, in the RPC's order: already approved, no narrative, the approver wrote it (maker-checker). */
export function approveProblem(d: { narratives?: Record<string, Narrative> | null; approvals?: Record<string, Approval> | null }, metricId: string, me: string): 'already_approved' | 'no_narrative' | 'maker_checker' | null {
  if (d.approvals && d.approvals[metricId]) return 'already_approved';
  const n = d.narratives?.[metricId];
  if (!n || lineProblem({ metric_id: metricId, ...n }, [metricId]) !== null) return 'no_narrative';
  if (n.by === me) return 'maker_checker';
  return null;
}
export const allApproved = (approvals: Record<string, unknown> | null | undefined, metricIds: string[]) => metricIds.length > 0 && metricIds.every((m) => !!approvals?.[m]);

// ───────────── the export pack (CSV, JSON and the print view; SIMULATED). Unapproved lines never carry a value.
export const PACK_STATEMENT = {
  en: 'SIMULATED demonstration data. Prepared in the shape of the ISO 30414:2025 Skills, Capabilities and Development area; Kafa\'a is not an auditor or a certification body and this pack is not an assurance statement.',
  ar: 'بيانات محاكاة لأغراض العرض. أُعدّت هذه الحزمة على نمط مجال المهارات والقدرات والتطوير في المعيار ISO 30414:2025؛ وكفاءة ليست جهة تدقيق أو اعتماد، وهذه الحزمة ليست بيان ضمان.',
};
export interface PackMetric {
  metric_id: string; key: string; name_en: string; name_ar: string; unit: string; basis: string; published: boolean; value: number | null; prev_period: string | null; prev_value: number | null;
  variance: number | null; definition_en: string; formula_en: string; source_en: string; owner_en: string; narrative_en: string | null; narrative_ar: string | null; variance_en: string | null;
  variance_ar: string | null; prepared_by: string | null; approved_by: string | null; approved_at: string | null; cells: Cell[];
}
export interface Pack {
  kind: 'kafaa.iso30414_skills_pack'; version: 1; simulated: true; not_an_assurance: true; iso_area: string; period: string; as_of: string; status: string; method: string;
  statement_en: string; statement_ar: string; materiality_en: string; materiality_ar: string; headcount: number | null; metrics: PackMetric[];
}
export function buildPack(d: AnyRow, metrics: AnyRow[]): Pack {
  const vals = (d.metric_values?.metrics ?? []) as MetricValue[];
  const nar = (d.narratives ?? {}) as Record<string, Narrative>;
  const apr = (d.approvals ?? {}) as Record<string, Approval>;
  const defs = [...metrics].sort((x, y) => Number(x.sort) - Number(y.sort) || cmpC(x.id, y.id));
  return {
    kind: 'kafaa.iso30414_skills_pack', version: 1, simulated: true, not_an_assurance: true, iso_area: ISO_AREA, period: d.period, as_of: String(d.period_end ?? '').slice(0, 10), status: d.status,
    method: d.method ?? METHOD, statement_en: PACK_STATEMENT.en, statement_ar: PACK_STATEMENT.ar, materiality_en: d.materiality_en ?? '', materiality_ar: d.materiality_ar ?? '',
    headcount: d.metric_values?.headcount ?? null,
    metrics: defs.filter((m) => vals.some((v) => v.metric_id === m.id)).map((m) => {
      const v = vals.find((x) => x.metric_id === m.id)!;
      const ok = !!apr[m.id];
      const n = nar[m.id];
      return {
        metric_id: m.id, key: m.key, name_en: m.name_en, name_ar: m.name_ar, unit: m.unit, basis: m.basis, published: ok, value: ok ? v.value : null,
        prev_period: ok ? v.prev_period : null, prev_value: ok ? v.prev_value : null, variance: ok ? v.variance : null, definition_en: m.definition_en, formula_en: m.formula_en, source_en: m.source_en,
        owner_en: m.owner_en, narrative_en: ok ? n?.narrative_en ?? null : null, narrative_ar: ok ? n?.narrative_ar ?? null : null, variance_en: ok ? n?.variance_en ?? null : null,
        variance_ar: ok ? n?.variance_ar ?? null : null, prepared_by: n?.by ?? null, approved_by: ok ? apr[m.id].by : null, approved_at: ok ? apr[m.id].at : null, cells: ok ? v.cells : [],
      };
    }),
  };
}
/** Flat CSV rows (one row per metric; participation cells as extra rows). Every row says SIMULATED. */
export function packRows(p: Pack): Record<string, string | number | null>[] {
  const out: Record<string, string | number | null>[] = [];
  for (const m of p.metrics) {
    out.push({ period: p.period, metric: m.metric_id, name: m.name_en, iso_area: p.iso_area, unit: m.unit, basis: m.basis, status: m.published ? 'published' : 'not published (awaiting narrative or second approver)',
      value: m.published ? (m.value ?? 'suppressed') : null, previous: m.prev_value, variance: m.variance, narrative: m.narrative_en, variance_explanation: m.variance_en, approved_by: m.approved_by, label: 'SIMULATED' });
    for (const c of m.cells) out.push({ period: p.period, metric: `${m.metric_id}:${c.dim}:${c.key}`, name: `${m.name_en} · ${c.dim} ${c.key}`, iso_area: p.iso_area, unit: 'pct', basis: m.basis, status: 'published',
      value: c.pct ?? 'suppressed', previous: null, variance: null, narrative: null, variance_explanation: null, approved_by: m.approved_by, label: 'SIMULATED' });
  }
  return out;
}

/** "Why this value?" for a metric (formula inputs; pages only). */
export function metricReasons(v: MetricValue): Reason[] {
  const sup = { en: 'suppressed', ar: 'محجوب' };
  const r: Reason[] = [{ code: 'fs60_formula', key: `m35.hc.reason.${v.key}`, vars: { num: v.num ?? sup, den: v.den ?? sup, excluded: v.excluded } }];
  if (v.suppressed) r.push({ code: 'fs60_suppressed', key: 'm35.hc.reason.suppressed', vars: { n: MIN_GROUP } });
  if (v.prev_period) r.push({ code: 'fs60_prev', key: 'm35.hc.reason.prev', vars: { period: v.prev_period } });
  r.push({ code: 'fs60_basis', key: `m35.hc.reason.basis.${v.basis}`, vars: {} });
  return r;
}
