/**
 * FS16 Role outlook labels with published criteria (FS wave B · E5). Pure rules, import-free (node seed and validation scripts
 * load this file directly). SQL mirror, change both together: supabase/migrations/20261010225001_kafaa_fs25_future_roles.sql
 *   outlookLabel        = kafaa_fs16_label
 *   outlookComponents   = kafaa_fs16_components
 * scripts/validate/fs25-future-roles.mjs proves SQL = TS for every role and every stored row.
 *
 * Three labels, O*NET-style (a consumer label over the same numbers planners see; ONET), with honest change signals (CORP)
 * and "pressure now" kept apart from "demand later" (FORECAST). Components, all percentages (never headcount):
 *   growth_pct    demand later: projected demand growth from the outlook base year to the horizon year for the skill families
 *                 the role needs (F35 released outlook, SIMULATED), importance-weighted (core 3, important 2, useful 1)
 *   shortfall_pct pressure: projected demand above holders at the horizon year, as a share of demand (negative = surplus)
 *   change_pct    FS05 change size: what the 2030 profile adds or raises, as a share of today's requirement weight
 * Rule (criteria version 2, from 2026), first match wins (precedence published with the criteria):
 *   changing  change_pct >= change_min_pct
 *   growing   growth_pct >= growth_min_pct and shortfall_pct > shortfall_min_pct
 *   stable    otherwise
 * Criteria version 1 (2024-2025) had no change component (FS05 profiles did not exist). Each stored label keeps the criteria
 * version it was made under, so every label reproduces from its own components. Values are rounded to one decimal before the
 * rule runs (floor(x * 10 + 0.5) / 10 in TS and SQL). Security, safeguards and cyber roles (career path only) and concept roles
 * (no vacancy) carry no label.
 */

export type OutlookLabel = 'growing' | 'stable' | 'changing';
export const LABELS: OutlookLabel[] = ['growing', 'changing', 'stable'];
export const IMP_W: Record<string, number> = { core: 3, important: 2, useful: 1 };
export const EXCLUDED_AREAS = ['security'];

export interface Thresholds { growth_min_pct: number; shortfall_min_pct: number; change_min_pct: number | null; base_year: number; horizon_year: number }
export interface CriteriaRow { id: string; version: number; year_from: number; thresholds: Thresholds | unknown; precedence?: string[] }
export interface FamilyPart { key: string; weight: number; suppressed: boolean; growth_pct: number | null; shortfall_pct: number | null }
export interface ChangePart { now_id: string; to_id: string; added: number; raised: number; base: number; delta: number }
export interface Components {
  growth_pct: number | null;
  shortfall_pct: number | null;
  change_pct: number | null;
  families: FamilyPart[];
  change: ChangePart | null;
  outlook_id: string | null;
  base_year: number;
  horizon_year: number;
  archived?: boolean;
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
export const r1 = (x: number) => Math.floor(x * 10 + 0.5) / 10;
export const thresholdsOf = (c: Pick<CriteriaRow, 'thresholds'>): Thresholds => c.thresholds as Thresholds;

/** The criteria version in force for a year: the latest year_from <= year (then the highest version). */
export function criteriaFor<C extends CriteriaRow>(rows: C[], year: number): C | null {
  return [...rows].filter((c) => c.year_from <= year).sort((a, b) => b.year_from - a.year_from || b.version - a.version)[0] ?? null;
}

/** The label from the components and the thresholds: the published rule. */
export function outlookLabel(c: Pick<Components, 'growth_pct' | 'shortfall_pct' | 'change_pct'>, th: Thresholds): OutlookLabel {
  if (th.change_min_pct != null && c.change_pct != null && c.change_pct >= th.change_min_pct) return 'changing';
  if (c.growth_pct != null && c.shortfall_pct != null && c.growth_pct >= th.growth_min_pct && c.shortfall_pct > th.shortfall_min_pct) return 'growing';
  return 'stable';
}

export interface OutlookFamily { key: string; suppressed?: boolean; years?: { year: number; demand: number; supply: number; gap: number }[] }
export interface LabelData {
  roles: { id: string; lifecycle?: string | null; security_sensitive?: boolean | null }[];
  roleComps: { role_id: string; competency_id: string; importance: string }[];
  skills: { id?: string; competency_id: string; area: string; core: boolean; sort?: number | null }[];
  /** The released F35 outlook (latest), or null. */
  outlook: { id: string; results: unknown } | null;
  versions: { id: string; role_id: string; horizon: string; version: number; status: string; requirements: unknown }[];
}
export const labelledRole = (r: { lifecycle?: string | null; security_sensitive?: boolean | null } | undefined) => !!r && (r.lifecycle ?? 'current') === 'current' && !r.security_sensitive;

function latestPublished(versions: LabelData['versions'], roleId: string, horizon: string) {
  let best: LabelData['versions'][number] | null = null;
  for (const v of versions) if (v.role_id === roleId && v.horizon === horizon && v.status === 'published' && (!best || v.version > best.version)) best = v;
  return best;
}
type Req = { kind: string; ref_id: string; level: number; importance: string };
const reqs = (v: { requirements: unknown } | null): Req[] => (v && Array.isArray(v.requirements) ? (v.requirements as Req[]) : []);

/** Components for one current role (null for concept and security roles). Same arithmetic order as the SQL. */
export function outlookComponents(d: LabelData, roleId: string, th: Thresholds): Components | null {
  const role = d.roles.find((r) => r.id === roleId);
  if (!labelledRole(role)) return null;
  // families: the core skill area of each required competency, importance-weighted
  const areaOf = new Map<string, string>();
  const coreSkills = d.skills.filter((s) => s.core).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || cmp(a.id ?? '', b.id ?? ''));
  for (const s of coreSkills) if (!areaOf.has(s.competency_id)) areaOf.set(s.competency_id, s.area);
  const weights = new Map<string, number>();
  for (const rc of d.roleComps) {
    if (rc.role_id !== roleId) continue;
    const a = areaOf.get(rc.competency_id);
    if (!a || EXCLUDED_AREAS.includes(a)) continue;
    weights.set(a, (weights.get(a) ?? 0) + (IMP_W[rc.importance] ?? 1));
  }
  const res = (d.outlook?.results ?? null) as { families?: OutlookFamily[] } | null;
  const fams = new Map((res?.families ?? []).map((f) => [f.key, f]));
  const families: FamilyPart[] = [];
  let gNum = 0, sNum = 0, wSum = 0;
  for (const key of [...weights.keys()].sort(cmp)) {
    const w = weights.get(key)!;
    const f = fams.get(key);
    const y0 = f?.years?.find((y) => y.year === th.base_year);
    const yh = f?.years?.find((y) => y.year === th.horizon_year);
    if (!f || f.suppressed || !y0 || !yh || !(y0.demand > 0) || !(yh.demand > 0)) { families.push({ key, weight: w, suppressed: true, growth_pct: null, shortfall_pct: null }); continue; }
    const g = ((yh.demand - y0.demand) / y0.demand) * 100;
    const s = (yh.gap / yh.demand) * 100;
    gNum += w * g;
    sNum += w * s;
    wSum += w;
    families.push({ key, weight: w, suppressed: false, growth_pct: r1(g), shortfall_pct: r1(s) });
  }
  // FS05 change size: now -> 2030 (published, highest version)
  const now = latestPublished(d.versions, roleId, 'now');
  const fut = latestPublished(d.versions, roleId, '2030');
  let change: ChangePart | null = null;
  let changePct: number | null = null;
  if (now && fut) {
    const before = new Map(reqs(now).map((q) => [`${q.kind}:${q.ref_id}`, q.level]));
    let base = 0;
    for (const q of reqs(now)) base += (IMP_W[q.importance] ?? 1) * q.level;
    let delta = 0, added = 0, raised = 0;
    for (const q of [...reqs(fut)].sort((a, b) => cmp(`${a.kind}:${a.ref_id}`, `${b.kind}:${b.ref_id}`))) {
      const was = before.get(`${q.kind}:${q.ref_id}`);
      if (was == null) { added++; delta += (IMP_W[q.importance] ?? 1) * q.level; } else if (q.level > was) { raised++; delta += (IMP_W[q.importance] ?? 1) * (q.level - was); }
    }
    change = { now_id: now.id, to_id: fut.id, added, raised, base, delta };
    changePct = base > 0 ? r1((delta / base) * 100) : null;
  }
  return {
    growth_pct: wSum > 0 ? r1(gNum / wSum) : null,
    shortfall_pct: wSum > 0 ? r1(sNum / wSum) : null,
    change_pct: th.change_min_pct == null ? null : changePct,
    families,
    change: th.change_min_pct == null ? null : change,
    outlook_id: d.outlook?.id ?? null,
    base_year: th.base_year,
    horizon_year: th.horizon_year,
  };
}

export interface LabelRow { id: string; role_id: string; year: number; label: OutlookLabel; criteria_id: string; components: Components }
export const labelId = (roleId: string, year: number) => `rol-${roleId}-${year}`;

/** Labels for every labelled role for one year under the criteria in force (sorted by role id). */
export function computeLabels(d: LabelData, criteria: CriteriaRow, year: number): LabelRow[] {
  const th = thresholdsOf(criteria);
  const out: LabelRow[] = [];
  for (const r of [...d.roles].filter(labelledRole).sort((a, b) => cmp(a.id, b.id))) {
    const c = outlookComponents(d, r.id, th);
    if (!c) continue;
    out.push({ id: labelId(r.id, year), role_id: r.id, year, label: outlookLabel(c, th), criteria_id: criteria.id, components: c });
  }
  return out;
}

export interface ReasonLike { code: string; key: string; vars?: Record<string, string | number | { en: string; ar: string }> }
/** "Why this label?" lines (i18n keys under m18.fs16.reason). */
export function labelReasons(c: Pick<Components, 'growth_pct' | 'shortfall_pct' | 'change_pct' | 'archived'> & Partial<Pick<Components, 'base_year' | 'horizon_year'>>, th: Thresholds, label: OutlookLabel): ReasonLike[] {
  const out: ReasonLike[] = [{ code: `fs16_${label}`, key: `m18.fs16.reason.${label}` }];
  if (th.change_min_pct != null) out.push(c.change_pct == null ? { code: 'fs16_change_none', key: 'm18.fs16.reason.change_none' } : { code: 'fs16_change', key: 'm18.fs16.reason.change', vars: { pct: c.change_pct, min: th.change_min_pct } });
  out.push(c.growth_pct == null ? { code: 'fs16_growth_none', key: 'm18.fs16.reason.growth_none' } : { code: 'fs16_growth', key: 'm18.fs16.reason.growth', vars: { pct: c.growth_pct, min: th.growth_min_pct, from: String(c.base_year ?? th.base_year), to: String(c.horizon_year ?? th.horizon_year) } });
  if (c.shortfall_pct != null) out.push({ code: 'fs16_shortfall', key: 'm18.fs16.reason.shortfall', vars: { pct: c.shortfall_pct, year: String(c.horizon_year ?? th.horizon_year) } });
  if (c.archived) out.push({ code: 'fs16_archived', key: 'm18.fs16.reason.archived' });
  out.push({ code: 'fs16_simulated', key: 'm18.fs16.reason.simulated' });
  return out;
}
