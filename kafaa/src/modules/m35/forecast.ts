/**
 * M35 · FS51 Three-scenario skill forecasting bands (SIMULATED). Pure rules, import-free apart from types and the F35 outlook's pure
 * functions (src/modules/m07/outlook.ts, imported read-only: departures, bandWeight, growthOf, scenarioRef, inputFromTables, rnd and the
 * shared constants) and the M11 adoption rule. Node seed scripts and the PGlite validator load this file directly.
 * SQL mirror, change both together: supabase/migrations/20261010261001_kafaa_fs61_strategy_forecasts.sql (kafaa_sf_*).
 *
 * Unit = people-equivalents (the measured staff sample scaled to the SAMPLE organisation headcount, as F35 does). Every number is
 * SIMULATED: assumptions are inputs, results are a planning band, never a forecast of who will be hired.
 *
 *  Scope: every catalogue skill (FS02, 120) except security (career path only) and obsolete skills; `catalogue: 'established'` keeps
 *  the 71 F01 skills only (the pre-FS02 method of the 2025 pilot cycle).
 *  Demand per skill and level (holders needed at level >= L, L = 1..4) = staff whose role profile (FS05: latest published version of
 *  the role's now / 2030 / 2035 profile; a missing horizon takes the one before) requires the skill at level L or above, interpolated
 *  between the anchors 2026 (now), 2030 and 2035 on an "effective profile year" = 2026 + (year - 2026) x pace (pace 0 keeps today's
 *  profiles, 1 follows the published schedule, 1.5 reaches the 2035 profile by 2032), x the chosen M07 staffing scenario growth
 *  (F35 growthOf), x (1 + ADVANCE x intensity x ramp) for skills mapped to an ADVANCE technology (M11 adv_skills, or FS02
 *  advanced-reactor skills). Intensity = M11 adjustDemand(future-skills index, ADVANCE lever) / 100 (lever 0: no uplift); the ramp
 *  is F35's (0 before the start year, then linear to 1 over five years).
 *  Supply per skill and level: today's counted F01 states of active staff (verified, evidenced or validated; self-claims never count)
 *  at exact levels 1..4, scaled; each year: general attrition, band-weighted F20 KLRA departures of holders (F35 departures and band
 *  weights), F22 handover cohorts entering at the level their role needs (x the pipeline factor), the DNT intake entering at level 1
 *  for skills the Local Operator profile needs (from the base year + 2), then demand-led development: from the top level down, a
 *  share (the development rate) of the people at a level move up one level, never more than the shortfall at the level above, and
 *  staff whose role needs the skill but who hold no counted state start at level 1 the same way.
 *  A skill is shown only when 10 or more staff hold it (counted) and 10 or more staff are in roles that need it; otherwise only its id
 *  and "suppressed" leave the server. Skills no role profile names are listed as "not yet modelled".
 *  Generations (the plant's operating life beyond 2035): the working-level demand of 2035 is held flat (skill change after 2035 is
 *  not modelled); people to develop in each window = demand x (1 - (1 - attrition)^years), rounded.
 *  Floating point: base aggregates are integers; floats are made only in projectSkill / kafaa_sf_project in the same order.
 */
import type { Reason } from '../../domain/engines/types';
import { adjustDemand } from '../../domain/future.ts';
import { BASELINE, BASE_YEAR, EXCLUDED_AREAS, MIN_GROUP, RAMP_YEARS, INTAKE_DELAY, bandWeight, departures, growthOf, inputFromTables, rnd, scenarioRef, type OutlookInput, type ScenarioRef } from '../m07/outlook.ts';

export { BASE_YEAR, MIN_GROUP };
export const METHOD = 'fs51-v1';
export const HORIZON = 2035;
export const LEVELS = [1, 2, 3, 4] as const;
/** Working level (Practitioner, level 2) carries the headline numbers, as in F35. */
export const WORK_LEVEL = 2;
export const ANCHORS = { now: 2026, mid: 2030, far: 2035 } as const;
export const SCENARIOS = ['baseline', 'advance', 'accelerated'] as const;
export type ScenarioKey = (typeof SCENARIOS)[number];
export const CATALOGUES = ['all', 'established'] as const;
export type Catalogue = (typeof CATALOGUES)[number];
/** Plant operating life: each FANR operating licence runs for 60 years; Unit 4 entered commercial operation on 5 September 2024
 *  (seeded news page news-unit4-full-fleet, WNN source). The generations view runs to the end of Unit 4's licence. */
export const PLANT_LIFE = {
  last_year: 2084,
  source: { label: 'WNN · Fourth Barakah unit receives operating licence', url: 'https://www.world-nuclear-news.org/articles/fourth-barakah-unit-receives-operating-licence', as_of: '2026-10-08' },
} as const;
/** Generation windows after the forecast horizon (inclusive years). */
export const GENERATIONS: [number, number][] = [[2036, 2050], [2051, 2065], [2066, 2084]];

export interface Levers { pace: number; advance: number; adv_start: number }
export interface ForecastParams {
  attrition_pct: number;
  klra_weight: number;
  pipeline_factor: number;
  annual_intake: number;
  develop_rate: number;
  scenario_id: string | null;
  catalogue: Catalogue;
  levers: Record<ScenarioKey, Levers>;
}
export type SharedParam = 'attrition_pct' | 'klra_weight' | 'pipeline_factor' | 'annual_intake' | 'develop_rate';
export type LeverParam = keyof Levers;

/** Defaults. The shared assumptions start from the F35 baseline (BASELINE in m07/outlook.ts); develop_rate = F35 reskill_rate. */
export const DEFAULTS: ForecastParams = {
  attrition_pct: BASELINE.attrition_pct, klra_weight: BASELINE.klra_weight, pipeline_factor: BASELINE.pipeline_factor, annual_intake: BASELINE.annual_intake,
  develop_rate: BASELINE.reskill_rate, scenario_id: null, catalogue: 'all',
  levers: {
    baseline: { pace: 1, advance: 0, adv_start: 2030 },
    advance: { pace: 1, advance: 1, adv_start: 2030 },
    accelerated: { pace: 1.5, advance: 1.5, adv_start: 2028 },
  },
};
export const SHARED_LIMITS: Record<SharedParam, [number, number, number]> = {
  attrition_pct: [0, 15, 0.5],
  klra_weight: [0, 1.5, 0.1],
  pipeline_factor: [0, 2, 0.1],
  annual_intake: [0, 80, 1],
  develop_rate: [0, 40, 1],
};
export const LEVER_LIMITS: Record<LeverParam, [number, number, number]> = {
  pace: [0, 2, 0.1],
  advance: [0, 1.5, 0.05],
  adv_start: [2027, 2035, 1],
};
export const SHARED_PARAMS = Object.keys(SHARED_LIMITS) as SharedParam[];
export const LEVER_PARAMS = Object.keys(LEVER_LIMITS) as LeverParam[];
const INT_PARAMS = ['annual_intake', 'adv_start'];

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const okNum = (v: unknown, [lo, hi]: [number, number, number], int: boolean) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi && (!int || Math.floor(v) === v);

/** Normalises raw parameters (missing keys take the defaults; unknown keys are ignored). Null when anything is malformed or out of range. */
export function normalizeForecastParams(raw: unknown): ForecastParams | null {
  const r = isObj(raw) ? raw : {};
  const out: ForecastParams = { ...DEFAULTS, levers: { baseline: { ...DEFAULTS.levers.baseline }, advance: { ...DEFAULTS.levers.advance }, accelerated: { ...DEFAULTS.levers.accelerated } } };
  for (const k of SHARED_PARAMS) {
    const v = r[k] == null ? DEFAULTS[k] : r[k];
    if (!okNum(v, SHARED_LIMITS[k], INT_PARAMS.includes(k))) return null;
    out[k] = v as number;
  }
  const sid = r.scenario_id;
  if (sid != null && (typeof sid !== 'string' || sid.length > 80)) return null;
  out.scenario_id = sid == null || sid === '' ? null : sid;
  const cat = r.catalogue;
  if (cat != null && !CATALOGUES.includes(cat as Catalogue)) return null;
  out.catalogue = (cat as Catalogue | undefined) ?? 'all';
  const lv = r.levers;
  if (lv != null) {
    if (!isObj(lv)) return null;
    for (const s of SCENARIOS) {
      const x = lv[s];
      if (x == null) continue;
      if (!isObj(x)) return null;
      for (const k of LEVER_PARAMS) {
        const v = x[k] == null ? DEFAULTS.levers[s][k] : x[k];
        if (!okNum(v, LEVER_LIMITS[k], INT_PARAMS.includes(k))) return null;
        out.levers[s][k] = v as number;
      }
    }
  }
  return out;
}
export function paramsEqual(a: ForecastParams, b: ForecastParams): boolean {
  return SHARED_PARAMS.every((k) => a[k] === b[k]) && (a.scenario_id ?? null) === (b.scenario_id ?? null) && a.catalogue === b.catalogue
    && SCENARIOS.every((s) => LEVER_PARAMS.every((k) => a.levers[s][k] === b.levers[s][k]));
}
/** True when the assumptions equal the defaults ("reset assumptions" gives exactly this). */
export const isDefault = (p: ForecastParams) => paramsEqual(p, DEFAULTS);

// ───────────── Inputs (definer side)
export interface ProfileRow { role_id: string; horizon: string; status: string; version: number; requirements?: { kind: string; ref_id: string; level: number }[] | null }
export interface ForecastInput extends OutlookInput {
  profiles: ProfileRow[];
  skills: (OutlookInput['skills'][number] & { lifecycle?: string | null })[];
  states: (OutlookInput['states'][number] & { basis?: string | null })[];
}
type AnyRow = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
/** Definer-side input from raw tables (LocalBackend, seed builder and PGlite validator share it): the F35 input plus FS05 profiles. */
export function forecastInputFromTables(raw: (table: string) => AnyRow[]): ForecastInput {
  return { ...inputFromTables(raw), profiles: raw('role_profile_versions') as never } as ForecastInput;
}

/** Integer aggregates of one skill (arrays are indexed by level - 1). */
export interface SkillBase {
  skill_id: string;
  area: string;
  fs_area: string | null;
  /** measured counted holders (any level) and staff in roles that need the skill at any anchor: the suppression basis */
  n_s: number;
  n_d: number;
  /** counted holders at exact levels 1..4 */
  held: number[];
  /** staff in roles that need the skill without a counted state */
  pool: number;
  /** demand (staff needing level >= L) at the three anchors */
  d_now: number[];
  d_mid: number[];
  d_far: number[];
  /** level -> year -> band-weighted known departures of holders at that level, in 1/60ths of a person */
  klra60: Record<string, Record<string, number>>;
  /** level -> year -> F22 trainees ready at that level */
  cohort: Record<string, Record<string, number>>;
  lo: boolean;
  /** ADVANCE: the skill itself is mapped to an ADVANCE technology (M11 adv_skills) or is an FS02 advanced-reactor skill; otherwise
   *  the F35 family share applies: mapped / all established skills of its area (adv_m / adv_t) */
  direct: boolean;
  adv_m: number;
  adv_t: number;
}
export interface ForecastBase {
  catalogue: Catalogue;
  skills: SkillBase[];
  /** in-scope skills no profile names at any anchor (sorted ids) */
  no_demand: string[];
  adv_sum: number;
  adv_n: number;
  org: number;
  staff: number;
  scenario: ScenarioRef | null;
}
const HORIZONS = ['now', '2030', '2035'] as const;
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const latest = (xs: string[]) => [...xs].sort().at(-1) ?? null;
const clampLevel = (v: unknown) => Math.max(1, Math.min(4, Math.floor(Number(v) || 0)));

/** role -> horizon -> skill -> needed level (latest published version; a missing horizon takes the previous one). */
export function profileNeeds(inp: Pick<ForecastInput, 'profiles' | 'skills'>): Map<string, Record<(typeof HORIZONS)[number], Map<string, number>>> {
  const coreOf = new Map<string, string[]>();
  for (const s of [...inp.skills].sort((a, b) => cmp(a.id, b.id))) if (s.core && s.competency_id) coreOf.set(s.competency_id, [...(coreOf.get(s.competency_id) ?? []), s.id]);
  const best = new Map<string, ProfileRow>();
  for (const v of inp.profiles) {
    if (v.status !== 'published' || !HORIZONS.includes(v.horizon as never)) continue;
    const k = `${v.role_id}|${v.horizon}`;
    const cur = best.get(k);
    if (!cur || Number(v.version) > Number(cur.version)) best.set(k, v);
  }
  const toMap = (v: ProfileRow | undefined) => {
    if (!v) return null;
    const m = new Map<string, number>();
    for (const q of v.requirements ?? []) {
      const ids = q.kind === 'skill' ? [q.ref_id] : q.kind === 'competency' ? coreOf.get(q.ref_id) ?? [] : [];
      for (const id of ids) m.set(id, Math.max(m.get(id) ?? 0, clampLevel(q.level)));
    }
    return m;
  };
  const roles = [...new Set(inp.profiles.map((p) => p.role_id))].sort(cmp);
  const out = new Map<string, Record<(typeof HORIZONS)[number], Map<string, number>>>();
  for (const r of roles) {
    const now = toMap(best.get(`${r}|now`)) ?? new Map<string, number>();
    const mid = toMap(best.get(`${r}|2030`)) ?? now;
    const far = toMap(best.get(`${r}|2035`)) ?? mid;
    out.set(r, { now, '2030': mid, '2035': far });
  }
  return out;
}

/** Skills in scope (sorted by id). */
export function scopeSkills(inp: Pick<ForecastInput, 'skills'>, catalogue: Catalogue) {
  return inp.skills.filter((s) => !EXCLUDED_AREAS.includes(s.area) && (s.lifecycle ?? 'stable') !== 'obsolete' && (catalogue === 'all' || !s.fs_area)).sort((a, b) => cmp(a.id, b.id));
}

/** Base aggregates for one staffing scenario (null = current fleet). Throws 'not_found' for an unknown scenario id. */
export function gatherForecastBase(inp: ForecastInput, scenarioId: string | null, catalogue: Catalogue = 'all'): ForecastBase {
  let scenario: ScenarioRef | null = null;
  if (scenarioId) {
    const s = inp.scenarios.find((x) => x.id === scenarioId);
    if (!s) throw new Error('not_found');
    scenario = scenarioRef(s);
  }
  const staff = new Map(inp.people.filter((p) => p.kind === 'staff' && p.status === 'active').map((p) => [p.id, p]));
  const needs = profileNeeds(inp);
  const empty = new Map<string, number>();
  const needOf = (role: string | null | undefined, h: (typeof HORIZONS)[number]) => (role ? needs.get(role)?.[h] ?? empty : empty);
  // counted states: person -> skill -> best level (verified, evidenced, validated; never claimed)
  const held = new Map<string, Map<string, number>>();
  for (const st of inp.states) {
    if (st.active === false || !staff.has(st.person_id) || st.basis === 'claimed' || !(Number(st.level) >= 1)) continue;
    const m = held.get(st.skill_id) ?? new Map<string, number>();
    m.set(st.person_id, Math.max(m.get(st.person_id) ?? 0, clampLevel(st.level)));
    held.set(st.skill_id, m);
  }
  const period = latest(inp.klraAssessments.map((a) => a.period));
  const totals = new Map(inp.klraAssessments.filter((a) => a.period === period).map((a) => [a.position_id, Number(a.total)]));
  const positions = [...inp.klraPositions].sort((x, y) => cmp(x.id, y.id));
  const cPeriod = latest(inp.cohorts.map((c) => c.period));
  const advTech = new Map(inp.advSkills.map((x) => [x.id, x.tech_id]));
  const staffList = [...staff.values()].sort((a, b) => cmp(a.id, b.id));
  const skills: SkillBase[] = [];
  const noDemand: string[] = [];
  for (const s of scopeSkills(inp, catalogue)) {
    const h = held.get(s.id) ?? new Map<string, number>();
    const heldBy = [0, 0, 0, 0];
    for (const lv of h.values()) heldBy[lv - 1]++;
    const d = { now: [0, 0, 0, 0], '2030': [0, 0, 0, 0], '2035': [0, 0, 0, 0] } as Record<(typeof HORIZONS)[number], number[]>;
    let nd = 0, pool = 0;
    for (const p of staffList) {
      let any = false;
      for (const hz of HORIZONS) {
        const lv = needOf(p.job_role_id, hz).get(s.id) ?? 0;
        if (lv > 0) any = true;
        for (let L = 1; L <= lv; L++) d[hz][L - 1]++;
      }
      if (any) { nd++; if (!h.has(p.id)) pool++; }
    }
    if (nd === 0) noDemand.push(s.id);
    const klra60: Record<string, Record<string, number>> = {};
    for (const pos of positions) {
      if (pos.active === false || pos.kind !== 'staff' || !pos.person_id || !h.has(pos.person_id) || !totals.has(pos.id)) continue;
      const L = String(h.get(pos.person_id));
      const w = bandWeight(totals.get(pos.id)!, inp.klraThresholds);
      for (const [y, share] of departures(pos)) {
        const m = (klra60[L] ??= {});
        m[String(y)] = (m[String(y)] ?? 0) + w * share;
      }
    }
    const cohort: Record<string, Record<string, number>> = {};
    for (const c of inp.cohorts) {
      if (c.period !== cPeriod) continue;
      const lv = needOf(c.role_id, 'now').get(s.id) ?? 0;
      if (!lv) continue;
      const y = String(Math.max(BASE_YEAR + 1, Number(c.ready_on.slice(0, 4))));
      const m = (cohort[String(lv)] ??= {});
      m[y] = (m[y] ?? 0) + c.trainees;
    }
    const isMapped = (x: { adv_skill_ids?: string[] | null }) => (x.adv_skill_ids ?? []).some((id) => (scenario?.tech ? advTech.get(id) === scenario.tech : advTech.has(id)));
    const fam = inp.skills.filter((x) => x.area === s.area && !x.fs_area);
    skills.push({
      skill_id: s.id, area: s.area, fs_area: s.fs_area ?? null, n_s: h.size, n_d: nd, held: heldBy, pool,
      d_now: d.now, d_mid: d['2030'], d_far: d['2035'], klra60, cohort, lo: (needOf('local-operator', 'now').get(s.id) ?? 0) > 0,
      direct: isMapped(s) || s.fs_area === 'advanced_reactor', adv_m: fam.filter(isMapped).length, adv_t: fam.length,
    });
  }
  const fsVals = inp.futureSkills.map((x) => Number(x.value));
  return {
    catalogue, skills, no_demand: noDemand, adv_sum: fsVals.reduce((x, v) => x + v, 0), adv_n: fsVals.length,
    org: Math.max(0, Math.floor(Number(inp.orgHeadcount ?? 0))), staff: staff.size, scenario,
  };
}

// ───────────── Projection
export interface ScenarioSeries {
  /** per year: demand (holders needed at level >= L) and supply (holders at level >= L), people-equivalents, L = 1..4 */
  d: number[][];
  s: number[][];
  /** working-level gap (demand - supply at level 2+) in 2030 and 2035; first year with a working-level gap */
  gap_mid: number;
  gap_far: number;
  first_gap_year: number | null;
  /** the level with the widest gap in 2035 (level mix) and that gap */
  bind_level: number;
  bind_gap: number;
  /** people to develop in each generation window (working level) */
  gen: number[];
}
export interface SkillForecast {
  skill_id: string;
  area: string;
  fs_area: string | null;
  /** ADVANCE share applied to demand, in whole percent (100 when the skill itself is mapped) */
  adv_pct: number;
  /** measured basis (10 or more when shown) */
  basis_n: number;
  /** today's counted holders at level >= L (people-equivalents) */
  s0: number[];
  sc: Record<ScenarioKey, ScenarioSeries>;
}
export interface ScenarioTotals { short_mid: number; short_far: number; shortfall_mid: number; shortfall_far: number; first_gap_year: number | null; gen: number[] }
export interface ForecastResult {
  simulated: true;
  method: string;
  base_year: number;
  horizon: number;
  years: number[];
  params: ForecastParams;
  scenario: { id: string; name: string; kind: string } | null;
  adv_index: number;
  org_headcount: number;
  staff_sample: number;
  min_group: number;
  basis: { method: string; catalogue: Catalogue; skills_in_scope: number; base_year: number };
  skills: SkillForecast[];
  suppressed: string[];
  not_modelled: { skill_id: string; reason: 'no_profile_demand' }[];
  totals: Record<ScenarioKey, ScenarioTotals>;
  generations: { windows: [number, number][]; remain_pct: number[]; last_year: number };
}

export const scaleOfBase = (b: Pick<ForecastBase, 'org' | 'staff'>) => (b.org > 0 && b.staff > 0 ? b.org / b.staff : 1);
export const advIndexOfBase = (b: Pick<ForecastBase, 'adv_sum' | 'adv_n'>) => (b.adv_n > 0 ? b.adv_sum / b.adv_n : 0);
export const yearsList = () => Array.from({ length: HORIZON - BASE_YEAR + 1 }, (_, i) => BASE_YEAR + i);

/** Survival factor (1 - a)^n by repeated multiplication (the same operations in SQL). */
export function survive(a: number, n: number): number {
  let q = 1;
  for (let i = 0; i < n; i++) q = q * (1 - a);
  return q;
}

/** One visible skill under one scenario's levers. */
export function projectSkill(k: SkillBase, base: Pick<ForecastBase, 'org' | 'staff' | 'adv_sum' | 'adv_n' | 'scenario'>, p: ForecastParams, lv: Levers): ScenarioSeries {
  const scale = scaleOfBase(base);
  const a = p.attrition_pct / 100;
  const r = p.develop_rate / 100;
  const intensity = lv.advance > 0 ? adjustDemand(advIndexOfBase(base), lv.advance) / 100 : 0;
  const S = [k.held[0] * scale, k.held[1] * scale, k.held[2] * scale, k.held[3] * scale];
  let P = k.pool * scale;
  const dOut: number[][] = [], sOut: number[][] = [];
  const demandAt = (y: number): number[] => {
    const e = Math.min(HORIZON, BASE_YEAR + (y - BASE_YEAR) * lv.pace);
    const g = growthOf(base.scenario, y);
    const ramp = y < lv.adv_start ? 0 : Math.min(1, (y - lv.adv_start + 1) / RAMP_YEARS);
    const up = 1 + advShare(k) * intensity * ramp;
    const out: number[] = [];
    for (let i = 0; i < 4; i++) {
      const v = e <= ANCHORS.mid ? k.d_now[i] + (k.d_mid[i] - k.d_now[i]) * (e - ANCHORS.now) / 4 : k.d_mid[i] + (k.d_far[i] - k.d_mid[i]) * (e - ANCHORS.mid) / 5;
      out.push(v * scale * g * up);
    }
    return out;
  };
  const above = (from: number) => { let t = 0; for (let j = from; j < 4; j++) t = t + S[j]; return t; };
  for (let y = BASE_YEAR; y <= HORIZON; y++) {
    const D = demandAt(y);
    if (y > BASE_YEAR) {
      for (let i = 0; i < 4; i++) S[i] = S[i] - S[i] * a;
      for (let i = 0; i < 4; i++) {
        const kl = (k.klra60[String(i + 1)]?.[String(y)] ?? 0) / 60 * scale * p.klra_weight;
        S[i] = S[i] - kl;
        if (S[i] < 0) S[i] = 0;
      }
      for (let i = 0; i < 4; i++) S[i] = S[i] + (k.cohort[String(i + 1)]?.[String(y)] ?? 0) * p.pipeline_factor;
      if (k.lo && y >= BASE_YEAR + INTAKE_DELAY) S[0] = S[0] + p.annual_intake;
      for (let i = 2; i >= 0; i--) {
        const need = D[i + 1] - above(i + 1);
        if (need > 0) { const mv = Math.min(S[i] * r, need); S[i] = S[i] - mv; S[i + 1] = S[i + 1] + mv; }
      }
      const need0 = D[0] - above(0);
      if (need0 > 0) { const mv = Math.min(P * r, need0); P = P - mv; S[0] = S[0] + mv; }
    }
    dOut.push(D.map(rnd));
    sOut.push([rnd(above(0)), rnd(above(1)), rnd(above(2)), rnd(above(3))]);
  }
  const W = WORK_LEVEL - 1;
  const gapAt = (yi: number) => dOut[yi][W] - sOut[yi][W];
  const last = dOut.length - 1;
  let first: number | null = null;
  for (let yi = 0; yi <= last; yi++) if (gapAt(yi) > 0) { first = BASE_YEAR + yi; break; }
  let bind = 1, bindGap = dOut[last][0] - sOut[last][0];
  for (let i = 1; i < 4; i++) { const gp = dOut[last][i] - sOut[last][i]; if (gp > bindGap) { bind = i + 1; bindGap = gp; } }
  const hold = dOut[last][W];
  const gen = GENERATIONS.map(([lo, hi]) => rnd(hold * (1 - survive(a, hi - lo + 1))));
  return { d: dOut, s: sOut, gap_mid: gapAt(ANCHORS.mid - BASE_YEAR), gap_far: gapAt(last), first_gap_year: first, bind_level: bind, bind_gap: bindGap, gen };
}

/** The ADVANCE share of a skill (1 when mapped itself, else its area's F35 share). */
export const advShare = (k: Pick<SkillBase, 'direct' | 'adv_m' | 'adv_t'>) => (k.direct ? 1 : k.adv_t > 0 ? k.adv_m / k.adv_t : 0);
export const isVisible = (k: SkillBase) => k.n_s >= MIN_GROUP && k.n_d >= MIN_GROUP;

/** The full three-scenario forecast (what kafaa_sf_compute returns). */
export function computeForecast(base: ForecastBase, p: ForecastParams): ForecastResult {
  const scale = scaleOfBase(base);
  const skills: SkillForecast[] = [];
  const suppressed: string[] = [];
  for (const k of base.skills) {
    if (k.n_d === 0) continue;
    if (!isVisible(k)) { suppressed.push(k.skill_id); continue; }
    const sc = {} as Record<ScenarioKey, ScenarioSeries>;
    for (const s of SCENARIOS) sc[s] = projectSkill(k, base, p, p.levers[s]);
    const S = k.held.map((h) => h * scale);
    const s0 = [0, 1, 2, 3].map((i) => { let t = 0; for (let j = i; j < 4; j++) t = t + S[j]; return rnd(t); });
    skills.push({ skill_id: k.skill_id, area: k.area, fs_area: k.fs_area, adv_pct: rnd(advShare(k) * 100), basis_n: k.n_s, s0, sc });
  }
  const totals = {} as Record<ScenarioKey, ScenarioTotals>;
  for (const s of SCENARIOS) {
    const xs = skills.map((k) => k.sc[s]);
    const firsts = xs.map((x) => x.first_gap_year).filter((y): y is number => y != null);
    totals[s] = {
      short_mid: xs.filter((x) => x.gap_mid > 0).length, short_far: xs.filter((x) => x.gap_far > 0).length,
      shortfall_mid: xs.reduce((t, x) => t + Math.max(0, x.gap_mid), 0), shortfall_far: xs.reduce((t, x) => t + Math.max(0, x.gap_far), 0),
      first_gap_year: firsts.length ? Math.min(...firsts) : null,
      gen: GENERATIONS.map((_, i) => xs.reduce((t, x) => t + x.gen[i], 0)),
    };
  }
  const a = p.attrition_pct / 100;
  return {
    simulated: true, method: METHOD, base_year: BASE_YEAR, horizon: HORIZON, years: yearsList(), params: p,
    scenario: base.scenario ? { id: base.scenario.id, name: base.scenario.name, kind: base.scenario.kind } : null,
    adv_index: rnd(advIndexOfBase(base) * 10) / 10, org_headcount: base.org, staff_sample: base.staff, min_group: MIN_GROUP,
    basis: { method: METHOD, catalogue: base.catalogue, skills_in_scope: base.skills.length, base_year: BASE_YEAR },
    skills, suppressed, not_modelled: base.no_demand.map((id) => ({ skill_id: id, reason: 'no_profile_demand' as const })), totals,
    generations: { windows: GENERATIONS, remain_pct: GENERATIONS.map(([lo]) => rnd(100 * survive(a, lo - BASE_YEAR))), last_year: PLANT_LIFE.last_year },
  };
}

/** Normalise, check the scenario and compute (SQL kafaa_sf_for). */
export function forecastFor(inp: ForecastInput, raw: unknown): { code: 'ok'; result: ForecastResult } | { code: 'invalid' | 'not_found' } {
  const p = normalizeForecastParams(raw);
  if (!p) return { code: 'invalid' };
  if (p.scenario_id && !inp.scenarios.some((s) => s.id === p.scenario_id)) return { code: 'not_found' };
  return { code: 'ok', result: computeForecast(gatherForecastBase(inp, p.scenario_id, p.catalogue), p) };
}

// ───────────── Versions and the methodology rule
export interface VersionBasis { method: string; catalogue: string; skills_in_scope: number; base_year: number }
/** Why two saved versions may not be compared side by side (empty = comparable). A methodology change voids year-on-year comparison. */
export function comparisonBlockers(a: VersionBasis | null | undefined, b: VersionBasis | null | undefined): ('method' | 'catalogue' | 'scope' | 'base_year' | 'missing')[] {
  if (!a || !b) return ['missing'];
  const out: ('method' | 'catalogue' | 'scope' | 'base_year')[] = [];
  if (a.method !== b.method) out.push('method');
  if (a.catalogue !== b.catalogue) out.push('catalogue');
  if (a.skills_in_scope !== b.skills_in_scope) out.push('scope');
  if (a.base_year !== b.base_year) out.push('base_year');
  return out;
}
export const simulatedName = (name: string) => (/simulated/i.test(name) ? name.trim() : `${name.trim()} (SIMULATED)`);

// ───────────── Reading helpers (pages)
export const workGap = (x: ScenarioSeries, yi: number) => x.d[yi][WORK_LEVEL - 1] - x.s[yi][WORK_LEVEL - 1];
/** Demand band of a skill in one year (index into years): min and max working-level demand across the three scenarios. */
export function bandAt(k: SkillForecast, yi: number): [number, number] {
  const v = SCENARIOS.map((s) => k.sc[s].d[yi][WORK_LEVEL - 1]);
  return [Math.min(...v), Math.max(...v)];
}
/** Explanations (WhyThis) for one skill under one scenario. */
export function skillReasons(k: SkillForecast, s: ScenarioKey, p: ForecastParams): Reason[] {
  const x = k.sc[s];
  const out: Reason[] = [];
  const last = x.d.length - 1;
  const dNow = x.d[0][WORK_LEVEL - 1], dFar = x.d[last][WORK_LEVEL - 1];
  out.push(x.first_gap_year != null ? { code: 'sf_first_gap', key: 'm35.reasons.sf_first_gap', vars: { year: String(x.first_gap_year) } } : { code: 'sf_no_gap', key: 'm35.reasons.sf_no_gap', vars: { year: String(HORIZON) } });
  if (dFar > dNow) out.push({ code: 'sf_demand_up', key: 'm35.reasons.sf_demand_up', vars: { from: dNow, to: dFar } });
  else if (dFar < dNow) out.push({ code: 'sf_demand_down', key: 'm35.reasons.sf_demand_down', vars: { from: dNow, to: dFar } });
  if (k.adv_pct > 0 && p.levers[s].advance > 0) out.push({ code: 'sf_advance', key: 'm35.reasons.sf_advance', vars: { year: String(p.levers[s].adv_start), pct: k.adv_pct } });
  if (x.bind_level !== WORK_LEVEL && x.bind_gap > 0) out.push({ code: 'sf_level_mix', key: 'm35.reasons.sf_level_mix', vars: { level: x.bind_level, gap: x.bind_gap } });
  if (p.levers[s].pace !== 1) out.push({ code: 'sf_pace', key: 'm35.reasons.sf_pace', vars: { pace: p.levers[s].pace } });
  out.push({ code: 'sf_basis', key: 'm35.reasons.sf_basis', vars: { n: k.basis_n } });
  return out;
}
