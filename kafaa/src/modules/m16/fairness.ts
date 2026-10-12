/**
 * F24 fairness monitor rules (pure; node seed and validation scripts load this file directly, so imports carry .ts).
 * Mirrored 1:1 by kafaa_fairness_compute in supabase/migrations/20261009135001_kafaa_w3e5_transparency.sql;
 * scripts/validate/w3e5-transparency.mjs proves SQL = TS on the seed. Change both together.
 *
 * Outcome rates per group, compared with the four-fifths rule (29 CFR 1607.4(D)): a group whose rate is below 80% of the
 * best group's rate is flagged. Only gender (f/m) and nationality (uae/other) are compared; people with no recorded value are
 * left out of that comparison. A comparison is shown only when every group has at least MIN_GROUP_SIZE (10) people:
 * with two groups, suppressing one cell alone would let anyone work it out by subtraction, so the whole comparison is
 * suppressed. This file is a MONITOR: it reads gender and nationality to measure outcomes. No scoring function does
 * (tests/unit/w3e5-no-protected-inputs.test.ts).
 *
 * Population: active staff with a job role, hired on or before the as-of date. Metrics (as of a date; history-aware):
 *  navigator_ready      (Career Navigator)  at least one role within two steps of mine is "ready now" or "ready within 3 years"
 *                                            (F05 careerReadiness, path-only roles excluded). People who opted out are left out.
 *  opportunity_selected (Marketplace)       applicants (status as of the date not withdrawn) selected or completed at least once.
 *  mentoring_matched    (Mentoring)         people who asked for mentoring and were matched (or have since closed the pairing).
 *  hipo_pool            (Talent review)     in the high-potential pool: F18 talent-review placements (potential 3, performance 2+)
 *                                            when that feature holds rows, else the F16 leadership pipeline (nomination approved
 *                                            or completed), which is what the pool feeds.
 */
import { MIN_GROUP_SIZE } from '../../auth/policy.ts';
import { careerReadiness, reachableRoles, type CareerData } from '../m18/career.ts';

export const FOUR_FIFTHS = 0.8;
export const OPTOUT_SURFACES = ['navigator', 'coach', 'marketplace'] as const;
export type OptoutSurface = (typeof OPTOUT_SURFACES)[number];
export const METRICS = [
  { metric: 'navigator_ready', surface: 'navigator' },
  { metric: 'opportunity_selected', surface: 'marketplace' },
  { metric: 'mentoring_matched', surface: 'mentoring' },
  { metric: 'hipo_pool', surface: 'talent_evidence' },
] as const;
export type MetricId = (typeof METRICS)[number]['metric'];
export const DIMENSIONS = [
  { dimension: 'gender', col: 'gender', groups: ['f', 'm'] },
  { dimension: 'nationality', col: 'nationality_flag', groups: ['uae', 'other'] },
] as const;
export const SELECTED = ['selected', 'completed'];
export const MATCHED = ['matched', 'closed'];
export const PIPELINE = ['approved', 'completed'];

export interface FairnessRow {
  id: string;
  period: string;
  as_of: string;
  surface: string;
  metric: MetricId;
  dimension: 'gender' | 'nationality';
  group_key: string;
  n: number | null;
  positives: number | null;
  rate: number | null;
  ratio: number | null;
  suppressed: boolean;
  flagged: boolean;
  source: string;
}

type Hist = { at: string; status: string }[];
export interface FairnessData extends Omit<CareerData, 'people'> {
  people: { id: string; kind: string; status: string; job_role_id?: string | null; hire_date?: string | null; gender?: string | null; nationality_flag?: string | null }[];
  optouts: { person_id: string; surface: string; opted_out: boolean }[];
  applications: { person_id: string; history: Hist | unknown }[];
  mentoring: { person_id: string; status: string; created_at: string; responded_at?: string | null }[];
  nominations: { person_id: string; history: Hist | unknown }[];
  /** F18 talent-review placements, when that feature exists (columns per the BACKLOG F18 card). */
  placements?: { person_id: string; perf?: number | null; potential?: number | null }[] | null;
}

const r4 = (x: number) => Math.round(x * 10000) / 10000;
const DAY = 86_400_000;

/** ISO-8601 week label of a date, e.g. 2026-10-08 -> 2026-W41 (SQL: to_char(d, 'IYYY-"W"IW')). */
export function isoWeek(date: string): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Monday 0
  const thu = new Date(d.getTime() + (3 - dow) * DAY);
  const y = thu.getUTCFullYear();
  const week = Math.ceil(((thu.getTime() - Date.UTC(y, 0, 1)) / DAY + 1) / 7);
  return `${y}-W${String(week).padStart(2, '0')}`;
}

/** Status of a history-tracked row at the end of a day: the last entry (array order) stamped before the next midnight UTC. */
export function statusAsOf(history: unknown, asOf: string): string | null {
  const cut = Date.parse(`${asOf.slice(0, 10)}T00:00:00Z`) + DAY;
  let st: string | null = null;
  for (const e of Array.isArray(history) ? (history as Hist) : []) if (e && typeof e.at === 'string' && Date.parse(e.at) < cut) st = e.status;
  return st;
}

/** F18 rows are used only when present and shaped as the card says (numeric perf and potential). */
export function placementsUsable(p: FairnessData['placements']): boolean {
  return Array.isArray(p) && p.some((x) => typeof x.potential === 'number' && typeof x.perf === 'number');
}

/** Per metric: the people in the population and whether each had the positive outcome. */
export function outcomes(d: FairnessData, asOf: string): { metric: MetricId; surface: string; source: string; people: Map<string, boolean> }[] {
  const day = asOf.slice(0, 10);
  const cut = Date.parse(`${day}T00:00:00Z`) + DAY;
  // hire dates compare as dates (a malformed 5-digit year is in the future, as in SQL), not as strings
  const base = basePopulation(d.people, day);
  const inBase = new Set(base.map((p) => p.id));
  // navigator
  const optedOut = new Set(d.optouts.filter((o) => o.surface === 'navigator' && o.opted_out).map((o) => o.person_id));
  const nav = new Map<string, boolean>();
  for (const p of base) {
    if (optedOut.has(p.id)) continue;
    const ids = [...reachableRoles(d.edges, p.job_role_id!, 2).keys()];
    const rd = careerReadiness({ ...d, people: d.people } as CareerData, p.id, ids, day);
    nav.set(p.id, rd.some((r) => !r.path_only && (r.band === 'ready_now' || r.band === 'ready_in')));
  }
  // marketplace
  const opp = new Map<string, boolean>();
  for (const a of d.applications) {
    if (!inBase.has(a.person_id)) continue;
    const st = statusAsOf(a.history, day);
    if (!st || st === 'withdrawn') continue;
    opp.set(a.person_id, (opp.get(a.person_id) ?? false) || SELECTED.includes(st));
  }
  // mentoring
  const men = new Map<string, boolean>();
  for (const r of d.mentoring) {
    if (!inBase.has(r.person_id) || !(Date.parse(r.created_at) < cut)) continue;
    const st = r.responded_at && Date.parse(r.responded_at) < cut ? r.status : 'requested';
    men.set(r.person_id, (men.get(r.person_id) ?? false) || MATCHED.includes(st));
  }
  // high-potential pool
  const f18 = placementsUsable(d.placements);
  const pool = new Set<string>();
  if (f18) for (const x of d.placements!) { if (x.potential === 3 && (x.perf ?? 0) >= 2) pool.add(x.person_id); }
  else for (const n of d.nominations) { const st = statusAsOf(n.history, day); if (st && PIPELINE.includes(st)) pool.add(n.person_id); }
  const hipo = new Map(base.map((p) => [p.id, pool.has(p.id)] as const));
  return [
    { metric: 'navigator_ready', surface: 'navigator', source: 'career_readiness', people: nav },
    { metric: 'opportunity_selected', surface: 'marketplace', source: 'opportunity_applications', people: opp },
    { metric: 'mentoring_matched', surface: 'mentoring', source: 'mentoring_requests', people: men },
    { metric: 'hipo_pool', surface: 'talent_evidence', source: f18 ? 'review_placements' : 'leadership_nominations', people: hipo },
  ];
}

/** The snapshot rows for one as-of date, in a fixed order (metric, dimension, group). */
export function fairnessSnapshot(d: FairnessData, asOf: string, minGroup = MIN_GROUP_SIZE): FairnessRow[] {
  const day = asOf.slice(0, 10);
  const byId = new Map(d.people.map((p) => [p.id, p]));
  const rows: FairnessRow[] = [];
  for (const m of outcomes(d, day)) rows.push(...groupRows(m, byId, day, minGroup));
  return rows;
}

/**
 * FS55: the rows of one outcome (people in the population -> positive outcome) per dimension and group, with the suppression and
 * four-fifths rules above. Shared by the F24 snapshot and the FS55 surface snapshot (prefix 'sf'); SQL kafaa_fairness_rows.
 */
export function groupRows(m: { metric: string; surface: string; source: string; people: Map<string, boolean> }, byId: Map<string, Record<string, unknown> | { id: string }>, asOf: string, minGroup = MIN_GROUP_SIZE, prefix = 'fs'): FairnessRow[] {
  const day = asOf.slice(0, 10);
  const period = isoWeek(day);
  const rows: FairnessRow[] = [];
  for (const dim of DIMENSIONS) {
    const cells = dim.groups.map((g) => {
      let n = 0, pos = 0;
      for (const [pid, ok] of m.people) {
        const v = (byId.get(pid) as Record<string, unknown> | undefined)?.[dim.col];
        if (v === g) { n++; if (ok) pos++; }
      }
      return { g, n, pos };
    });
    const suppressed = cells.some((c) => c.n < minGroup);
    const best = suppressed ? 0 : Math.max(...cells.map((c) => c.pos / c.n));
    for (const c of cells) {
      const rate = suppressed ? null : r4(c.pos / c.n);
      const ratio = suppressed || best <= 0 ? null : r4(c.pos / c.n / best);
      rows.push({
        id: `${prefix}:${period}:${m.metric}:${dim.dimension}:${c.g}`, period, as_of: day, surface: m.surface, metric: m.metric as MetricId, dimension: dim.dimension, group_key: c.g,
        n: suppressed ? null : c.n, positives: suppressed ? null : c.pos, rate, ratio, suppressed, flagged: ratio != null && ratio < FOUR_FIFTHS, source: m.source,
      });
    }
  }
  return rows;
}

/** FS55: the population of every fairness comparison (active staff with a job role, hired by the as-of date). */
export function basePopulation<P extends FairnessData['people'][number]>(people: P[], asOf: string): P[] {
  const day = asOf.slice(0, 10);
  return people.filter((p) => p.kind === 'staff' && p.status === 'active' && !!p.job_role_id && (!p.hire_date || Date.parse(String(p.hire_date).slice(0, 10)) <= Date.parse(day)));
}

/** One comparison (metric x dimension) of a snapshot: its groups, the lowest ratio and whether it is flagged or suppressed. */
export interface Comparison { metric: MetricId; surface: string; dimension: 'gender' | 'nationality'; rows: FairnessRow[]; minRatio: number | null; flagged: boolean; suppressed: boolean }
export function comparisons(rows: FairnessRow[]): Comparison[] {
  const out: Comparison[] = [];
  for (const m of METRICS)
    for (const dim of DIMENSIONS) {
      const rs = rows.filter((r) => r.metric === m.metric && r.dimension === dim.dimension);
      if (!rs.length) continue;
      const ratios = rs.map((r) => r.ratio).filter((x): x is number => x != null);
      out.push({ metric: m.metric, surface: m.surface, dimension: dim.dimension, rows: rs, minRatio: ratios.length ? Math.min(...ratios) : null, flagged: rs.some((r) => r.flagged), suppressed: rs.some((r) => r.suppressed) });
    }
  return out;
}

/** The as-of dates of the weekly history the seed holds: `weeks` weekly steps back from today (oldest first). */
export function weeklyDates(today: string, weeks: number): string[] {
  const t = Date.parse(`${today.slice(0, 10)}T00:00:00Z`);
  return Array.from({ length: weeks }, (_, i) => new Date(t - (weeks - 1 - i) * 7 * DAY).toISOString().slice(0, 10));
}
