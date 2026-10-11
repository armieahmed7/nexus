/**
 * M07 · F35 Skills supply-and-demand outlook (SIMULATED). Pure rules, import-free apart from types and the M11 adoption rule
 * (node seed scripts and the PGlite validator load this file directly). SQL mirror, change both together:
 * supabase/migrations/20261009154001_kafaa_w5e4_skills_outlook.sql (kafaa_so_base, kafaa_so_project, kafaa_so_compute).
 *
 * Unit = people holding a skill family at working level (Practitioner, level 2, or above) in the demo tenant. A skill family is
 * an F01 skill area (security is out of scope: career path only). Every number is SIMULATED: assumptions are inputs, results are
 * never forecasts.
 *
 *  Scale: the demo tenant's active staff are a sample; every staff count is multiplied by organisation headcount / staff count
 *  (latest SAMPLE workforce snapshot), so the outlook reads in organisation people-equivalents. Suppression uses the measured
 *  counts (below 10 measured holders or role holders: suppressed).
 *
 *  Demand per family and year = (d0 + handover(y)) x staffing growth(y) x (1 + ADVANCE share x adoption intensity x ramp(y))
 *    d0      active staff whose role profile (M01 role_competencies) needs a competency of the family (scaled)
 *    handover F22 positions held by KHNP OSSA or contractor cover in roles that need the family that come back to ENEC staff
 *            as the cover plan steps down (all of it after the OSSA end year)
 *    growth  the chosen saved M07 staffing scenario: (baseline + units x per unit) / baseline from its start year, else 1
 *    ADVANCE share of the family's skills mapped to M11 adv_skills (one technology when the scenario is a technology scenario);
 *            intensity = adjustDemand(mean M11 future-skills index, adoption factor) / 100; ramp 0 before the adoption start year,
 *            then linear to 1 over five years
 *  Supply per family: s0 = active staff holding the family at level 2 or above (F01 person_skills), then each year
 *    - attrition    S x attrition %
 *    - KLRA         known retirements and contract ends (within 5 years) of holders in F20 KLRA positions, spread over the
 *                   band's years and weighted by the KLRA risk band (high 1.0, medium 0.7, low 0.4) x the KLRA slider
 *    + pipeline     F22 cohorts earmarked for roles that need the family, at their ready year x the pipeline factor, plus the
 *                   annual graduate intake (DNT) into Local Operator families from the base year + 2
 *    + reskilling   awareness-level holders (level 1) converting at the reskilling rate (per family override allowed)
 *  A family is shown only when s0 and d0 are both 10 or more; otherwise only its key and "suppressed" leave the server.
 */
import type { Reason } from '../../domain/engines/types';
import { adjustDemand } from '../../domain/future.ts';

export const BASE_YEAR = 2026;
export const MIN_GROUP = 10;
export const HOLDER_LEVEL = 2;
/** Skill areas outside the outlook (security is a career path only, never a capacity figure). */
export const EXCLUDED_AREAS = ['security'];
export const RAMP_YEARS = 5;
export const INTAKE_DELAY = 2; // DNT is 24 months
export const METHOD = 'f35-v1';
export const COVER_LAST_YEAR = 2036;

export interface OutlookParams {
  horizon: number;
  scenario_id: string | null;
  attrition_pct: number;
  klra_weight: number;
  pipeline_factor: number;
  annual_intake: number;
  reskill_rate: number;
  reskill_overrides: Record<string, number>;
  adv_factor: number;
  adv_start: number;
  ossa_end: number;
}
export type NumParam = Exclude<keyof OutlookParams, 'scenario_id' | 'reskill_overrides'>;

export const BASELINE: OutlookParams = {
  horizon: 2035, scenario_id: null, attrition_pct: 4, klra_weight: 1, pipeline_factor: 1, annual_intake: 20, reskill_rate: 15,
  reskill_overrides: {}, adv_factor: 1, adv_start: 2030, ossa_end: 2030,
};
/** Slider limits [min, max, step]; integer params are whole numbers. */
export const LIMITS: Record<NumParam, [number, number, number]> = {
  horizon: [2031, 2036, 1],
  attrition_pct: [0, 15, 0.5],
  klra_weight: [0, 1.5, 0.1],
  pipeline_factor: [0, 2, 0.1],
  annual_intake: [0, 80, 1],
  reskill_rate: [0, 40, 1],
  adv_factor: [0.5, 1.5, 0.05],
  adv_start: [2027, 2036, 1],
  ossa_end: [2028, 2032, 1],
};
export const INT_PARAMS: NumParam[] = ['horizon', 'annual_intake', 'adv_start', 'ossa_end'];
export const NUM_PARAMS = Object.keys(LIMITS) as NumParam[];
/** The tornado: each assumption moved across a fixed plausible range, the others held where they are; the measure is the
 *  cumulative shortfall (people-years summed over the visible families and the years to the horizon). */
export const TORNADO: { param: NumParam; lo: number; hi: number }[] = [
  { param: 'attrition_pct', lo: 2, hi: 8 },
  { param: 'klra_weight', lo: 0.5, hi: 1.5 },
  { param: 'pipeline_factor', lo: 0.5, hi: 1.5 },
  { param: 'annual_intake', lo: 10, hi: 40 },
  { param: 'reskill_rate', lo: 5, hi: 30 },
  { param: 'adv_factor', lo: 0.5, hi: 1.5 },
  { param: 'ossa_end', lo: 2028, hi: 2032 },
];
export const OVERRIDE_MAX = 40;

/** Rounding used everywhere: half up, as Math.round (SQL kafaa_so_round: floor(x), plus 1 when x - floor(x) >= 0.5, exact in floats). */
export const rnd = (x: number) => Math.round(x);

/**
 * Normalises raw parameters (missing keys take the baseline). Returns null when any value is out of range, not a number, a
 * fractional integer parameter, an unknown override family or an override out of 0-40. `families` = the outlook's family keys.
 */
export function normalizeParams(raw: unknown, families: string[]): OutlookParams | null {
  const r = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const out = { ...BASELINE, reskill_overrides: {} } as OutlookParams;
  for (const k of NUM_PARAMS) {
    const v = r[k] == null ? BASELINE[k] : r[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
    const [lo, hi] = LIMITS[k];
    if (v < lo || v > hi) return null;
    if (INT_PARAMS.includes(k) && Math.floor(v) !== v) return null;
    out[k] = v;
  }
  const sid = r.scenario_id;
  if (sid != null && (typeof sid !== 'string' || sid.length > 80)) return null;
  out.scenario_id = sid == null || sid === '' ? null : sid;
  const ov = r.reskill_overrides;
  if (ov != null) {
    if (typeof ov !== 'object' || Array.isArray(ov)) return null;
    for (const [k, v] of Object.entries(ov as Record<string, unknown>)) {
      if (!families.includes(k) || typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > OVERRIDE_MAX) return null;
    }
    out.reskill_overrides = Object.fromEntries(Object.keys(ov as object).sort().map((k) => [k, (ov as Record<string, number>)[k]]));
  }
  return out;
}

/** True when the parameters equal the baseline (overrides compared by content). */
export function isBaseline(p: OutlookParams): boolean {
  return paramsEqual(p, BASELINE);
}
export function paramsEqual(a: OutlookParams, b: OutlookParams): boolean {
  if (NUM_PARAMS.some((k) => a[k] !== b[k]) || (a.scenario_id ?? null) !== (b.scenario_id ?? null)) return false;
  const ka = Object.keys(a.reskill_overrides).sort(), kb = Object.keys(b.reskill_overrides).sort();
  return ka.length === kb.length && ka.every((k, i) => k === kb[i] && a.reskill_overrides[k] === b.reskill_overrides[k]);
}

// ───────────── Inputs (definer side) and the base aggregates
export interface OutlookInput {
  people: { id: string; kind: string; status: string; job_role_id?: string | null }[];
  skills: { id: string; area: string; competency_id?: string | null; core?: boolean; adv_skill_ids?: string[] | null; fs_area?: string | null }[]; // FS02: fs_area
  states: { person_id: string; skill_id: string; level: number; active?: boolean | null }[];
  roleComps: { role_id: string; competency_id: string }[];
  klraPositions: { id: string; person_id?: string | null; kind?: string | null; contract_kind: string; retirement_band: string; contract_end_band: string; active?: boolean | null }[];
  klraAssessments: { period: string; position_id: string; total: number }[];
  klraThresholds: { high: number; medium: number };
  cohorts: { period: string; role_id: string; ready_on: string; trainees: number }[];
  cover: { period: string; role_id: string; year: number; cover_count: number }[];
  /** Organisation headcount (latest SAMPLE workforce snapshot total); the measured staff sample is scaled to it. */
  orgHeadcount: number | null;
  advSkills: { id: string; tech_id: string }[];
  futureSkills: { value: number | string }[];
  scenarios: { id: string; name: string; kind: string; params?: unknown }[];
}
/** Base aggregates: integers only, so SQL and TypeScript start from identical numbers (floats are made in project()). */
export interface FamilyBase {
  key: string;
  /** measured active staff holding the family at level 2+ and staff whose role needs it (the suppression basis) */
  n_s: number;
  n_d: number;
  /** measured awareness-level (level 1) staff who do not hold the family yet */
  pool: number;
  /** year -> band-weighted known departures of holders (F20), in 1/60ths of a person (weight x10 times share x6) */
  klra60: Record<string, number>;
  /** year -> trainees ready (F22 cohorts, organisation scale) */
  cohort: Record<string, number>;
  /** year -> F22 positions held by KHNP OSSA or contractor cover in roles that need the family (plan, before the OSSA cut-off) */
  cover: Record<string, number>;
  lo: boolean;
  /** skills of the family mapped to an ADVANCE skill, and all skills of the family */
  adv_m: number;
  adv_t: number;
}
export interface ScenarioRef { id: string; name: string; kind: string; units: number; start: number; per_unit: number; baseline: number; tech: string | null }
export interface OutlookBase {
  families: FamilyBase[];
  /** sum and count of the M11 future-skills index values */
  adv_sum: number;
  adv_n: number;
  /** organisation headcount (SAMPLE snapshot) and the measured staff sample */
  org: number;
  staff: number;
  scenario: ScenarioRef | null;
}
export const scaleOf = (b: OutlookBase) => (b.org > 0 && b.staff > 0 ? b.org / b.staff : 1);
export const advIndexOf = (b: OutlookBase) => (b.adv_n > 0 ? b.adv_sum / b.adv_n : 0);

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : d);

/** A saved M07 scenario as the outlook reads it (headcount: growth; technology: the ADVANCE technology). */
export function scenarioRef(s: { id: string; name: string; kind: string; params?: unknown }): ScenarioRef {
  const p = (s.params && typeof s.params === 'object' ? s.params : {}) as Record<string, unknown>;
  const head = s.kind === 'headcount';
  return {
    id: s.id, name: s.name, kind: s.kind,
    units: head ? num(p.units, 0) : 0,
    start: head ? num(p.startYear ?? p.start, 2032) : 2032,
    per_unit: head ? num(p.perUnit, 48) : 48,
    baseline: head ? num(p.baseline, 190) : 190,
    tech: s.kind === 'technology' && typeof p.technology === 'string' && p.technology ? p.technology : null,
  };
}
export function growthOf(sc: ScenarioRef | null, year: number): number {
  if (!sc || sc.baseline <= 0 || year < sc.start) return 1;
  return (sc.baseline + sc.units * sc.per_unit) / sc.baseline;
}

/**
 * When a KLRA position's holder is expected to leave, as [year, share in sixths] pairs: a retirement window (within 2 years: half in each
 * of the next two years; 2 to 5 years: a third in each of years 3 to 5) or the end of a fixed-term contract or secondment
 * (within 1 year, 1 to 2 years, 2 to 5 years spread the same way), whichever starts first. "5 years or more" and open-ended
 * contracts are left to the general attrition rate. Empty when no departure is known.
 */
export function departures(p: { contract_kind: string; retirement_band: string; contract_end_band: string }, base = BASE_YEAR): [number, number][] {
  const spread = (band: string): [number, number][] =>
    band === 'within_1' ? [[base + 1, 6]] : band === 'within_2' ? [[base + 1, 3], [base + 2, 3]] : band === '1_2' ? [[base + 2, 6]]
      : band === '2_5' ? [[base + 3, 2], [base + 4, 2], [base + 5, 2]] : [];
  const ret = spread(p.retirement_band);
  const fixed = p.contract_kind === 'fixed_term' || p.contract_kind === 'secondment';
  const con = fixed ? spread(p.contract_end_band) : [];
  if (!ret.length) return con;
  if (!con.length) return ret;
  return con[0][0] < ret[0][0] ? con : ret;
}
/** KLRA band weight x10: high 10, medium 7, low 4. */
export function bandWeight(total: number, th: { high: number; medium: number }): number {
  return total >= th.high ? 10 : total >= th.medium ? 7 : 4;
}
const latest = (xs: string[]) => [...xs].sort().at(-1) ?? null;

/** Base aggregates for one scenario (null = current fleet). Throws 'not_found' for an unknown scenario id. */
export function gatherBase(inp: OutlookInput, scenarioId: string | null): OutlookBase {
  let scenario: ScenarioRef | null = null;
  if (scenarioId) {
    const s = inp.scenarios.find((x) => x.id === scenarioId);
    if (!s) throw new Error('not_found');
    scenario = scenarioRef(s);
  }
  const staff = new Map(inp.people.filter((p) => p.kind === 'staff' && p.status === 'active').map((p) => [p.id, p]));
  const skillById = new Map(inp.skills.map((s) => [s.id, s]));
  const areas = [...new Set(inp.skills.map((s) => s.area))].filter((a) => !EXCLUDED_AREAS.includes(a)).sort();
  const compArea = new Map<string, string>();
  for (const s of inp.skills) if (s.core && s.competency_id) compArea.set(s.competency_id, s.area);
  const roleAreas = new Map<string, Set<string>>();
  for (const rc of inp.roleComps) {
    const a = compArea.get(rc.competency_id);
    if (!a) continue;
    if (!roleAreas.has(rc.role_id)) roleAreas.set(rc.role_id, new Set());
    roleAreas.get(rc.role_id)!.add(a);
  }
  const holders = new Map<string, Set<string>>(), aware = new Map<string, Set<string>>();
  for (const a of areas) { holders.set(a, new Set()); aware.set(a, new Set()); }
  for (const st of inp.states) {
    if (st.active === false || !staff.has(st.person_id)) continue;
    const sk = skillById.get(st.skill_id);
    // FS wave-B integration: FS02 future skills (fs_area set) are not F35 supply (FS10 fitness-check evidence at level <= 2
    // would otherwise count every checked person as a digital holder); SQL kafaa_so_base (20261010229001).
    if (!sk || sk.fs_area || !holders.has(sk.area)) continue;
    if (st.level >= HOLDER_LEVEL) holders.get(sk.area)!.add(st.person_id);
    else if (st.level >= 1) aware.get(sk.area)!.add(st.person_id);
  }
  const period = latest(inp.klraAssessments.map((a) => a.period));
  const totals = new Map(inp.klraAssessments.filter((a) => a.period === period).map((a) => [a.position_id, Number(a.total)]));
  const cPeriod = latest(inp.cohorts.map((c) => c.period));
  const advTech = new Map(inp.advSkills.map((x) => [x.id, x.tech_id]));
  const fsVals = inp.futureSkills.map((x) => Number(x.value));
  const loAreas = roleAreas.get('local-operator') ?? new Set<string>();
  const vPeriod = latest(inp.cover.map((c) => c.period));
  const coverRows = inp.cover.filter((c) => c.period === vPeriod);
  const coverRoles = [...new Set(coverRows.map((c) => c.role_id))].sort();
  /** coverFor: a role's plan count for the year; past its last plan year the last year repeats (the OSSA cut-off applies later). */
  const coverFor = (role: string, y: number) => {
    const rows = coverRows.filter((c) => c.role_id === role);
    if (!rows.length) return 0;
    const yy = Math.min(y, Math.max(...rows.map((c) => c.year)));
    return rows.filter((c) => c.year === yy).reduce((s, c) => s + c.cover_count, 0);
  };

  const families: FamilyBase[] = areas.map((a) => {
    const h = holders.get(a)!;
    const pool = [...aware.get(a)!].filter((p) => !h.has(p)).length;
    let d0 = 0;
    for (const p of staff.values()) if (p.job_role_id && roleAreas.get(p.job_role_id)?.has(a)) d0++;
    const klra60: Record<string, number> = {};
    for (const pos of [...inp.klraPositions].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))) {
      if (pos.active === false || pos.kind !== 'staff' || !pos.person_id || !h.has(pos.person_id) || !totals.has(pos.id)) continue;
      const w = bandWeight(totals.get(pos.id)!, inp.klraThresholds);
      for (const [y, share] of departures(pos)) klra60[String(y)] = (klra60[String(y)] ?? 0) + w * share;
    }
    const cohort: Record<string, number> = {};
    for (const c of inp.cohorts) {
      if (c.period !== cPeriod || !roleAreas.get(c.role_id)?.has(a)) continue;
      const y = Math.max(BASE_YEAR + 1, Number(c.ready_on.slice(0, 4)));
      cohort[String(y)] = (cohort[String(y)] ?? 0) + c.trainees;
    }
    const fam = inp.skills.filter((s) => s.area === a && !s.fs_area); // FS02: established catalogue only (SQL kafaa_so_base)
    const mapped = fam.filter((s) => (s.adv_skill_ids ?? []).some((id) => (scenario?.tech ? advTech.get(id) === scenario.tech : advTech.has(id)))).length;
    const cover: Record<string, number> = {};
    for (let y = BASE_YEAR; y <= COVER_LAST_YEAR; y++) {
      let n = 0;
      for (const role of coverRoles) if (roleAreas.get(role)?.has(a)) n += coverFor(role, y);
      cover[String(y)] = n;
    }
    return { key: a, n_s: h.size, n_d: d0, pool, klra60, cohort, cover, lo: loAreas.has(a), adv_m: mapped, adv_t: fam.length };
  });
  return {
    families, adv_sum: fsVals.reduce((x, v) => x + v, 0), adv_n: fsVals.length,
    org: Math.max(0, Math.floor(Number(inp.orgHeadcount ?? 0))), staff: staff.size, scenario,
  };
}

// ───────────── Projection
export interface YearCell { year: number; demand: number; supply: number; gap: number }
export type DriverCode = 'attrition' | 'klra' | 'handover' | 'growth' | 'advance' | 'intake' | 'reskill';
export interface Driver { code: DriverCode; band: 'high' | 'medium' | 'low'; effect: 'widens' | 'narrows' }
export interface FamilyOutlook {
  key: string;
  suppressed: boolean;
  s0: number | null;
  d0: number | null;
  /** measured staff sample behind s0 (10 or more when shown) */
  basis_n: number | null;
  years: YearCell[];
  horizon_gap: number | null;
  peak_gap: number | null;
  first_gap_year: number | null;
  drivers: Driver[];
}
export interface TornadoBar { param: NumParam; lo: number; hi: number; low: number; high: number; swing: number }
export interface OutlookResult {
  simulated: true;
  method: string;
  base_year: number;
  horizon: number;
  years: number[];
  params: OutlookParams;
  scenario: { id: string; name: string; kind: string } | null;
  adv_index: number;
  org_headcount: number;
  staff_sample: number;
  min_group: number;
  families: FamilyOutlook[];
  totals: { visible: number; suppressed: number; families_short: number; shortfall: number; first_gap_year: number | null; shortfall_by_year: number[]; cumulative: number };
  tornado: TornadoBar[];
}

const bandOf = (m: number, s0: number): Driver['band'] => (m >= s0 * 0.25 ? 'high' : m >= s0 * 0.1 ? 'medium' : 'low');
const DRIVER_ORDER: DriverCode[] = ['attrition', 'klra', 'handover', 'growth', 'advance', 'intake', 'reskill'];

/** Projects every family (visible or suppressed) and the shortfall totals; no tornado. */
export function project(base: OutlookBase, p: OutlookParams): Pick<OutlookResult, 'families' | 'totals' | 'years'> {
  const H = p.horizon;
  const yearsList: number[] = [];
  for (let y = BASE_YEAR; y <= H; y++) yearsList.push(y);
  const scale = scaleOf(base);
  const intensity = adjustDemand(advIndexOf(base), p.adv_factor) / 100;
  const a = p.attrition_pct / 100;
  const byYear = yearsList.map(() => 0);
  const families: FamilyOutlook[] = base.families.map((f) => {
    if (f.n_s < MIN_GROUP || f.n_d < MIN_GROUP) return { key: f.key, suppressed: true, s0: null, d0: null, basis_n: null, years: [], horizon_gap: null, peak_gap: null, first_gap_year: null, drivers: [] };
    const c0 = f.cover[String(BASE_YEAR)] ?? 0;
    const ho = (y: number) => c0 - (y > p.ossa_end ? 0 : f.cover[String(y)] ?? 0);
    const r = (p.reskill_overrides[f.key] ?? p.reskill_rate) / 100;
    const s0 = f.n_s * scale, d0 = f.n_d * scale, adv = f.adv_t > 0 ? f.adv_m / f.adv_t : 0;
    let S = s0, pool = f.pool * scale;
    let cAttr = 0, cKlra = 0, cIntake = 0, cReskill = 0;
    const cells: YearCell[] = [];
    let lastD = 0;
    for (const y of yearsList) {
      if (y > BASE_YEAR) {
        const attr = S * a;
        S = S - attr;
        const kl = (f.klra60[String(y)] ?? 0) / 60 * scale * p.klra_weight;
        S = S - kl;
        const inc = (f.cohort[String(y)] ?? 0) * p.pipeline_factor + (f.lo && y >= BASE_YEAR + INTAKE_DELAY ? p.annual_intake : 0);
        S = S + inc;
        const rs = pool * r;
        pool = pool - rs;
        S = S + rs;
        if (S < 0) S = 0;
        cAttr += attr; cKlra += kl; cIntake += inc; cReskill += rs;
      }
      const ramp = y < p.adv_start ? 0 : Math.min(1, (y - p.adv_start + 1) / RAMP_YEARS);
      const D = (d0 + ho(y)) * growthOf(base.scenario, y) * (1 + adv * intensity * ramp);
      lastD = D;
      const dem = rnd(D), sup = rnd(S);
      cells.push({ year: y, demand: dem, supply: sup, gap: dem - sup });
    }
    cells.forEach((c, i) => { if (c.gap > 0) byYear[i] += c.gap; });
    const gH = growthOf(base.scenario, H);
    const hoH = ho(H);
    const mags: Record<DriverCode, number> = { attrition: cAttr, klra: cKlra, handover: hoH, growth: (d0 + hoH) * (gH - 1), advance: lastD - (d0 + hoH) * gH, intake: cIntake, reskill: cReskill };
    const drivers = DRIVER_ORDER.filter((c) => mags[c] > 0)
      .sort((x, y) => mags[y] - mags[x] || DRIVER_ORDER.indexOf(x) - DRIVER_ORDER.indexOf(y))
      .map((c) => ({ code: c, band: bandOf(mags[c], s0), effect: c === 'intake' || c === 'reskill' ? 'narrows' : 'widens' }) as Driver);
    const first = cells.find((c) => c.gap > 0)?.year ?? null;
    return {
      key: f.key, suppressed: false, s0: rnd(s0), d0: rnd(d0), basis_n: f.n_s, years: cells, horizon_gap: cells[cells.length - 1].gap,
      peak_gap: Math.max(...cells.map((c) => c.gap)), first_gap_year: first, drivers,
    };
  });
  const vis = families.filter((f) => !f.suppressed);
  const firsts = vis.map((f) => f.first_gap_year).filter((y): y is number => y != null);
  return {
    years: yearsList,
    families,
    totals: {
      visible: vis.length, suppressed: families.length - vis.length,
      families_short: vis.filter((f) => (f.horizon_gap ?? 0) > 0).length,
      shortfall: vis.reduce((s, f) => s + Math.max(0, f.horizon_gap ?? 0), 0),
      first_gap_year: firsts.length ? Math.min(...firsts) : null,
      shortfall_by_year: byYear,
      cumulative: byYear.reduce((x, v) => x + v, 0),
    },
  };
}

export function tornadoOf(base: OutlookBase, p: OutlookParams): TornadoBar[] {
  const bars = TORNADO.map((x) => {
    const low = project(base, { ...p, [x.param]: x.lo }).totals.cumulative;
    const high = project(base, { ...p, [x.param]: x.hi }).totals.cumulative;
    return { param: x.param, lo: x.lo, hi: x.hi, low, high, swing: Math.abs(high - low) };
  });
  return bars.sort((a, b) => b.swing - a.swing || TORNADO.findIndex((t) => t.param === a.param) - TORNADO.findIndex((t) => t.param === b.param));
}

/** The full outlook (what kafaa_so_compute returns). */
export function computeOutlook(base: OutlookBase, p: OutlookParams): OutlookResult {
  const pr = project(base, p);
  return {
    simulated: true, method: METHOD, base_year: BASE_YEAR, horizon: p.horizon, years: pr.years, params: p,
    scenario: base.scenario ? { id: base.scenario.id, name: base.scenario.name, kind: base.scenario.kind } : null,
    adv_index: rnd(advIndexOf(base) * 10) / 10, org_headcount: base.org, staff_sample: base.staff, min_group: MIN_GROUP, families: pr.families, totals: pr.totals, tornado: tornadoOf(base, p),
  };
}

// ───────────── Definer-side input from raw tables (LocalBackend, seed builder and PGlite validator share it)
type AnyRow = Record<string, any>;
export function inputFromTables(raw: (table: string) => AnyRow[]): OutlookInput {
  const settings = raw('klra_settings').find((s) => s.id === 'default');
  const snaps = raw('workforce_snapshots').filter((w) => w.measure === 'headcount' && w.family_id == null && w.level == null && w.entity_id == null);
  const last = [...snaps].sort((x, y) => (x.period < y.period ? -1 : x.period > y.period ? 1 : 0)).at(-1);
  return {
    people: raw('people') as never, skills: raw('skills') as never, states: raw('person_skills') as never, roleComps: raw('role_competencies') as never,
    klraPositions: raw('klra_positions') as never, klraAssessments: raw('klra_assessments') as never,
    klraThresholds: { high: Number(settings?.high_threshold ?? 16), medium: Number(settings?.medium_threshold ?? 8) },
    cohorts: raw('handover_cohorts') as never, cover: raw('external_cover') as never, orgHeadcount: last ? Number(last.value) : null,
    advSkills: raw('adv_skills') as never, futureSkills: raw('future_skills') as never, scenarios: raw('scenarios') as never,
  };
}
/** The outlook's family keys (skill areas in scope). SQL kafaa_so_families. */
export const outlookFamilies = (inp: OutlookInput) => [...new Set(inp.skills.map((s) => s.area))].filter((a) => !EXCLUDED_AREAS.includes(a)).sort();
/** Normalise, check the scenario and compute (SQL kafaa_so_for). */
export function outlookFor(inp: OutlookInput, raw: unknown): { code: 'ok'; result: OutlookResult } | { code: 'invalid' | 'not_found' } {
  const p = normalizeParams(raw, outlookFamilies(inp));
  if (!p) return { code: 'invalid' };
  if (p.scenario_id && !inp.scenarios.some((s) => s.id === p.scenario_id)) return { code: 'not_found' };
  return { code: 'ok', result: computeOutlook(gatherBase(inp, p.scenario_id), p) };
}

// ───────────── Release text guard and names
/** Release names get the "(SIMULATED)" mark, as saveScenario does. */
export const simulatedName = (name: string) => (/simulated/i.test(name) ? name.trim() : `${name.trim()} (SIMULATED)`);

// ───────────── Reasons (WhyThis) for a family row
const BAND_TEXT = {
  high: { en: 'major', ar: 'رئيسي' },
  medium: { en: 'moderate', ar: 'متوسط' },
  low: { en: 'minor', ar: 'محدود' },
} as const;
export function familyReasons(f: FamilyOutlook, p: OutlookParams): Reason[] {
  if (f.suppressed) return [{ code: 'so_suppressed', key: 'm07.reasons.so_suppressed', vars: { n: MIN_GROUP } }];
  const out: Reason[] = [];
  if (f.first_gap_year != null) out.push({ code: 'so_first_gap', key: 'm07.reasons.so_first_gap', vars: { year: String(f.first_gap_year) } });
  else out.push({ code: 'so_no_gap', key: 'm07.reasons.so_no_gap', vars: { year: String(p.horizon) } });
  for (const d of f.drivers) out.push({ code: `so_${d.code}`, key: `m07.reasons.so_${d.code}_${d.effect}`, vars: { band: BAND_TEXT[d.band] } });
  out.push({ code: 'so_basis', key: 'm07.reasons.so_basis', vars: { n: f.basis_n ?? 0 } });
  return out;
}
