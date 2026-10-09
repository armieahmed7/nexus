/**
 * F22 Handover 2030 readiness board: pure rules shared by both backends, the seed builder and the PGlite validator.
 * Import-free (node loads it directly). The SQL mirror is kafaa_ho_compute in 20261009133001_kafaa_w3e3_handover.sql;
 * the validator proves SQL = TS on the seed for both periods and several scenarios.
 *
 * Inputs are definer-side rows; the output holds counts only. Every count cell under MIN_GROUP (10), zero included, is
 * null ("suppressed"). No person id, name or person-level row ever leaves computeHandover.
 *
 *   cover(role, y)   positions held by external or partner staff (KHNP OSSA, contractors) in plan year y (SAMPLE plan,
 *                    kafaa_external_cover). After the OSSA end year it is 0; years past the last planned year repeat it.
 *   named successors ENEC people on an F19 succession slate for the role (readiness confirmed by HR), or, for roles with no
 *                    slate yet, staff who shortlisted the role (F05) with their F05 readiness band. Ready months come from
 *                    the F05/F06 estimate, kept inside the slate's readiness band.
 *   cohorts          trainees in COIT, LOIT, GPO, DNT and discipline cohorts earmarked for a covered role (SAMPLE); the
 *                    projected ready date comes from the programme length (SIMULATED).
 *   ready(y)         distinct named successors plus cohort trainees projected ready by the end of year y.
 *   shortfall(y)     positions handed over by y (cover at the as-of year minus cover in y) not matched by ready successors.
 */

export const MIN_GROUP = 10;
export const OSSA_END_DEFAULT = 2030;
export const HORIZON_END = 2031;
export const OSSA_END_RANGE = [2028, 2032] as const;
export const SLIP_RANGE = [0, 24] as const;
export const PIPE_ROUTES = ['coit', 'loit', 'gpo', 'dnt', 'discipline'] as const;
export type PipeRoute = (typeof PIPE_ROUTES)[number];
export const BANDS = ['now', 'y1_2', 'y3_5'] as const;
export type HoBand = (typeof BANDS)[number] | 'later';
/** Successor and slate statuses that take a row off the board. */
export const INACTIVE_STATUSES = ['withdrawn', 'removed', 'rejected', 'declined', 'archived', 'inactive', 'cancelled', 'superseded', 'retired'];
/** Months to ready inside each band (upper bounds) and the midpoint used when F05 gives no estimate. */
export const BAND_MAX = { now: 0, y1_2: 24, y3_5: 60 } as const;
export const BAND_MID = { now: 0, y1_2: 12, y3_5: 42 } as const;

export interface HoRole { id: string; family_id: string | null }
export interface CoverRow { role_id: string; year: number; cover_count: number }
export interface CohortRow { role_id: string; route: string; trainees: number; emirati: number; ready_on: string }
/** One named successor for one role; months = base months to ready (0 = ready now). */
export interface NamedEntry { role_id: string; person_id: string; months: number; emirati: boolean; source: 'f19' | 'f05' }
export interface HandoverInput { period: string; roles: HoRole[]; cover: CoverRow[]; cohorts: CohortRow[]; named: NamedEntry[] }
export interface Scenario { ossa_end: number; slip_months: number }
export type Cell = number | null;

export interface HoGroup {
  key: string;
  roles: string[];
  source: 'f19' | 'f05' | 'mixed';
  cover: Cell[];
  bands: { now: Cell; y1_2: Cell; y3_5: Cell };
  named: Cell;
  pipeline: Record<PipeRoute, Cell>;
  pipeline_total: Cell;
  ready: Cell[];
  shortfall: Cell[];
  max_shortfall: Cell;
  first_shortfall: number | null;
  /** Plan years with a shortfall (a flag per year, never a count). */
  at_risk_years: number[];
  risk: boolean;
  ready_total: Cell;
  emirati: Cell;
  emirati_share_pm: number | null;
}
export interface HandoverAggregate {
  period: string;
  as_of_year: number;
  years: number[];
  ossa_end: number;
  slip_months: number;
  simulated: boolean;
  min_group: number;
  total: HoGroup;
  functions: HoGroup[];
  roles: HoGroup[];
}

/** Count cell: values under MIN_GROUP (zero included) are suppressed. */
export const cell = (n: number): Cell => (n >= MIN_GROUP ? n : null);

/** As-of year and the 0-based month at the end of the period ('2026-Q3' -> 2026, 8; '2026-H1' -> 5; '2026' -> 11). */
export function periodEnd(period: string): { year: number; month0: number } | null {
  const m = /^(\d{4})(?:-(Q[1-4]|H[12]))?$/.exec(period ?? '');
  if (!m) return null;
  const year = Number(m[1]);
  const p = m[2];
  const month0 = !p ? 11 : p[0] === 'Q' ? Number(p[1]) * 3 - 1 : Number(p[1]) * 6 - 1;
  return { year, month0 };
}

export function bandOf(d: number): HoBand {
  if (d <= 0) return 'now';
  if (d <= BAND_MAX.y1_2) return 'y1_2';
  if (d <= BAND_MAX.y3_5) return 'y3_5';
  return 'later';
}

/** Normalise an F19 readiness value ('ready_now', '1_2y', '3-5 years', ...) to a band, or null when it is not a band. */
export function normReadiness(v: unknown): Exclude<HoBand, 'later'> | null {
  const s = String(v ?? '').toLowerCase();
  if (!s) return null;
  if (s.includes('now')) return 'now';
  if (s.includes('1') && s.includes('2')) return 'y1_2';
  if (s.includes('3') || s.includes('5')) return 'y3_5';
  return null;
}

/** Base months to ready for an HR-confirmed band, keeping the F05/F06 estimate inside the band. */
export function namedMonths(band: Exclude<HoBand, 'later'>, f05Months: number | null | undefined): number {
  if (band === 'now') return 0;
  const lo = band === 'y1_2' ? 1 : BAND_MAX.y1_2 + 1;
  const hi = BAND_MAX[band];
  const m = f05Months == null || !Number.isFinite(f05Months) ? BAND_MID[band] : Math.round(f05Months);
  return Math.min(hi, Math.max(lo, m));
}

/** Months to ready from an F05 readiness result for shortlisted (not yet slated) staff; null = not a successor. */
export function f05Months(band: string | null | undefined, months: number | null | undefined): number | null {
  if (band === 'ready_now') return 0;
  if (band === 'ready_in' || band === 'stretch') return months == null ? null : Math.max(1, Math.round(months));
  return null;
}

const isInactive = (s: unknown) => INACTIVE_STATUSES.includes(String(s ?? '').toLowerCase());
/** True when an F19 row (successor or slate) is live: no inactive status and not `active = false`. */
export function liveRow(r: Record<string, unknown>): boolean {
  return !isInactive(r.status) && r.active !== false;
}

export function validScenario(s: Partial<Scenario> | null | undefined): Scenario | null {
  const ossa = s?.ossa_end ?? OSSA_END_DEFAULT;
  const slip = s?.slip_months ?? 0;
  if (!Number.isInteger(ossa) || ossa < OSSA_END_RANGE[0] || ossa > OSSA_END_RANGE[1]) return null;
  if (!Number.isInteger(slip) || slip < SLIP_RANGE[0] || slip > SLIP_RANGE[1]) return null;
  return { ossa_end: ossa, slip_months: slip };
}

export function yearsFor(asOfYear: number, ossaEnd: number): number[] {
  const out: number[] = [];
  for (let y = asOfYear; y <= Math.max(HORIZON_END, ossaEnd + 1); y++) out.push(y);
  return out;
}

/** Cover for one role in year y under the scenario (0 after the OSSA end; past the plan, the last planned year repeats). */
export function coverFor(rows: CoverRow[], roleId: string, y: number, ossaEnd: number): number {
  const mine = rows.filter((r) => r.role_id === roleId);
  if (!mine.length || y > ossaEnd) return 0;
  const last = Math.max(...mine.map((r) => r.year));
  const look = Math.min(y, last);
  return mine.filter((r) => r.year === look).reduce((s, r) => s + r.cover_count, 0);
}

/** Months from the end of the as-of period to a cohort's ready date (month granularity; <= 0 means ready now). */
export function cohortMonths(readyOn: string, y0: number, m0: number): number {
  const ry = Number(readyOn.slice(0, 4));
  const rm = Number(readyOn.slice(5, 7));
  return (ry - y0) * 12 + (rm - 1) - m0;
}

const readyYear = (y0: number, m0: number, d: number) => y0 + Math.floor((m0 + Math.max(0, d)) / 12);

function group(key: string, roleIds: string[], inp: HandoverInput, sc: Scenario, y0: number, m0: number, years: number[], f19Roles: Set<string>): HoGroup {
  const roles = [...roleIds].sort();
  const inSet = new Set(roles);
  const cover = years.map((y) => roles.reduce((s, r) => s + coverFor(inp.cover, r, y, sc.ossa_end), 0));
  const need0 = cover[0];
  // named successors: one entry per person in the group, with the earliest ready month
  const per = new Map<string, { d: number; emirati: boolean }>();
  for (const e of inp.named) {
    if (!inSet.has(e.role_id)) continue;
    const d = e.months <= 0 ? 0 : e.months + sc.slip_months;
    const cur = per.get(e.person_id);
    if (!cur || d < cur.d) per.set(e.person_id, { d, emirati: e.emirati });
  }
  const bandN = { now: 0, y1_2: 0, y3_5: 0 };
  const readyN = years.map(() => 0);
  let emirati = 0;
  const lastYear = Math.min(sc.ossa_end, years[years.length - 1]);
  for (const { d, emirati: em } of per.values()) {
    const b = bandOf(d);
    if (b !== 'later') bandN[b] += 1;
    const ry = readyYear(y0, m0, d);
    years.forEach((y, i) => { if (ry <= y) readyN[i] += 1; });
    if (em && ry <= lastYear) emirati += 1;
  }
  const pipe: Record<PipeRoute, number> = { coit: 0, loit: 0, gpo: 0, dnt: 0, discipline: 0 };
  for (const c of inp.cohorts) {
    if (!inSet.has(c.role_id)) continue;
    const raw = cohortMonths(c.ready_on, y0, m0);
    const d = raw <= 0 ? 0 : raw + sc.slip_months;
    const b = bandOf(d);
    if (b !== 'later') bandN[b] += c.trainees;
    if ((PIPE_ROUTES as readonly string[]).includes(c.route)) pipe[c.route as PipeRoute] += c.trainees;
    const ry = readyYear(y0, m0, d);
    years.forEach((y, i) => { if (ry <= y) readyN[i] += c.trainees; });
    if (ry <= lastYear) emirati += c.emirati;
  }
  const short = years.map((_, i) => Math.max(0, need0 - cover[i] - readyN[i]));
  const firstIdx = short.findIndex((s) => s > 0);
  const readyTotal = readyN[years.indexOf(lastYear)];
  const pipeTotal = PIPE_ROUTES.reduce((s, r) => s + pipe[r], 0);
  const srcs = new Set(roles.map((r) => (f19Roles.has(r) ? 'f19' : 'f05')));
  return {
    key,
    roles,
    source: srcs.size === 1 ? ([...srcs][0] as 'f19' | 'f05') : 'mixed',
    cover: cover.map(cell),
    bands: { now: cell(bandN.now), y1_2: cell(bandN.y1_2), y3_5: cell(bandN.y3_5) },
    named: cell(per.size),
    pipeline: { coit: cell(pipe.coit), loit: cell(pipe.loit), gpo: cell(pipe.gpo), dnt: cell(pipe.dnt), discipline: cell(pipe.discipline) },
    pipeline_total: cell(pipeTotal),
    ready: readyN.map(cell),
    shortfall: short.map(cell),
    max_shortfall: cell(Math.max(0, ...short)),
    first_shortfall: firstIdx < 0 ? null : years[firstIdx],
    at_risk_years: years.filter((_, i) => short[i] > 0),
    risk: firstIdx >= 0,
    ready_total: cell(readyTotal),
    emirati: cell(emirati),
    emirati_share_pm: readyTotal >= MIN_GROUP && emirati >= MIN_GROUP ? Math.floor((2000 * emirati + readyTotal) / (2 * readyTotal)) : null,
  };
}

/** The suppressed board for one period and scenario. Deterministic: the same input always gives the same output. */
export function computeHandover(inp: HandoverInput, scenario: Scenario, f19Roles: string[] = []): HandoverAggregate {
  const pe = periodEnd(inp.period) ?? { year: Number(String(inp.period).slice(0, 4)) || 2026, month0: 11 };
  const y0 = pe.year;
  const years = yearsFor(y0, scenario.ossa_end);
  const coverRoles = [...new Set(inp.cover.map((c) => c.role_id))].sort();
  const fam = new Map(inp.roles.map((r) => [r.id, r.family_id ?? 'other']));
  const f19 = new Set(f19Roles);
  const byFam = new Map<string, string[]>();
  for (const r of coverRoles) {
    const f = fam.get(r) ?? 'other';
    byFam.set(f, [...(byFam.get(f) ?? []), r]);
  }
  return {
    period: inp.period,
    as_of_year: y0,
    years,
    ossa_end: scenario.ossa_end,
    slip_months: scenario.slip_months,
    simulated: true,
    min_group: MIN_GROUP,
    total: group('total', coverRoles, inp, scenario, y0, pe.month0, years, f19),
    functions: [...byFam.keys()].sort().map((f) => group(f, byFam.get(f)!, inp, scenario, y0, pe.month0, years, f19)),
    roles: coverRoles.map((r) => group(r, [r], inp, scenario, y0, pe.month0, years, f19)),
  };
}

/** True when a scenario departs from the baseline plan (OSSA ends 2030, no slip). */
export const isWhatIf = (s: Scenario) => s.ossa_end !== OSSA_END_DEFAULT || s.slip_months !== 0;

// ───────────── Explanations (rendered by <WhyThis>; counts under MIN_GROUP are never put into a reason)
export interface HoReason { code: string; key: string; vars?: Record<string, string | number> }
export function groupReasons(g: HoGroup, a: Pick<HandoverAggregate, 'years' | 'as_of_year' | 'ossa_end' | 'slip_months'>): HoReason[] {
  const out: HoReason[] = [];
  const c0 = g.cover[0];
  out.push(c0 == null ? { code: 'cover_suppressed', key: 'm07.ho.reason.cover_suppressed', vars: { year: a.as_of_year } } : { code: 'cover', key: 'm07.ho.reason.cover', vars: { n: c0, year: a.as_of_year } });
  out.push({ code: 'ossa', key: 'm07.ho.reason.ossa', vars: { year: a.ossa_end } });
  if (g.risk && g.first_shortfall != null) out.push({ code: 'shortfall', key: 'm07.ho.reason.shortfall', vars: { year: g.first_shortfall } });
  else out.push({ code: 'on_track', key: 'm07.ho.reason.on_track', vars: { year: a.years[a.years.length - 1] } });
  out.push({ code: `source_${g.source}`, key: `m07.ho.reason.source_${g.source}` });
  if (g.pipeline_total != null) out.push({ code: 'pipeline', key: 'm07.ho.reason.pipeline', vars: { n: g.pipeline_total } });
  else out.push({ code: 'pipeline_small', key: 'm07.ho.reason.pipeline_small' });
  if (a.slip_months > 0) out.push({ code: 'slip', key: 'm07.ho.reason.slip', vars: { months: a.slip_months } });
  return out;
}

/** Risk list: functions (or roles) at risk, earliest shortfall first, each with reasons (ranked list, F02 lint applies). */
export function riskList(groups: HoGroup[], a: Pick<HandoverAggregate, 'years' | 'as_of_year' | 'ossa_end' | 'slip_months'>) {
  return groups
    .filter((g) => g.risk)
    .map((g) => ({ id: g.key, score: (a.years[a.years.length - 1] - (g.first_shortfall ?? 0) + 1) * 1000 + (g.max_shortfall ?? 0), reasons: groupReasons(g, a), item: g }))
    .sort((x, y) => y.score - x.score || x.id.localeCompare(y.id));
}

/** Observer-safe tiles for a release draft (strings; suppressed cells read "suppressed"). Max 12 tiles. */
export function releaseTiles(a: HandoverAggregate): { k: string; v: string; src: string }[] {
  const sv = (c: Cell) => (c == null ? 'suppressed' : String(c));
  const at = (y: number) => a.years.indexOf(y);
  const y28 = at(2028) >= 0 ? at(2028) : Math.min(2, a.years.length - 1);
  const yEnd = a.years.indexOf(Math.min(a.ossa_end, a.years[a.years.length - 1]));
  const src = "Kafa'a handover board · SAMPLE plan · SIMULATED projection";
  const pm = a.total.emirati_share_pm;
  return [
    { k: 'handover_cover', v: sv(a.total.cover[0]), src },
    { k: 'handover_cover_2028', v: sv(a.total.cover[y28]), src },
    { k: 'handover_ready_2028', v: sv(a.total.ready[y28]), src },
    { k: 'handover_ready_end', v: sv(a.total.ready[yEnd]), src },
    { k: 'handover_pipeline', v: sv(a.total.pipeline_total), src },
    { k: 'handover_functions_at_risk', v: String(a.functions.filter((g) => g.risk).length), src },
    { k: 'handover_first_shortfall', v: a.total.first_shortfall == null ? 'none' : String(a.total.first_shortfall), src },
    { k: 'handover_emirati_share', v: pm == null ? 'suppressed' : `${Math.floor(pm / 10)}.${pm % 10}%`, src },
  ];
}

// ───────────── Named successors (F19 slates first, F05 shortlists for roles with no slate). Same rules as kafaa_ho_named.
export interface GatherTables {
  people: { id: string; kind?: string | null; status?: string | null; job_role_id?: string | null; nationality_flag?: string | null }[];
  targets: { person_id: string; role_id: string; active?: boolean | null }[];
  /** F19 rows when the succession tables exist (any extra columns are ignored). */
  slates: Record<string, unknown>[];
  successors: Record<string, unknown>[];
}
export type ReadinessFn = (personId: string, roleId: string) => { band: string; months: number | null } | null;

export function gatherNamed(t: GatherTables, coverRoles: string[], readiness: ReadinessFn): { named: NamedEntry[]; f19Roles: string[] } {
  const cover = new Set(coverRoles);
  const people = new Map(t.people.map((p) => [p.id, p]));
  const liveSlates = t.slates.filter((s) => cover.has(String(s.role_id ?? '')) && liveRow(s));
  const slateRole = new Map(liveSlates.map((s) => [String(s.id), String(s.role_id)]));
  const f19Roles = [...new Set(liveSlates.map((s) => String(s.role_id)))].sort();
  const f19 = new Set(f19Roles);
  const named: NamedEntry[] = [];
  const seen = new Set<string>();
  for (const s of t.successors) {
    const role = slateRole.get(String(s.slate_id ?? ''));
    const pid = String(s.person_id ?? '');
    const p = people.get(pid);
    if (!role || !p || p.status === 'leaver' || !liveRow(s)) continue;
    const band = normReadiness(s.readiness);
    if (!band) continue;
    const r = readiness(pid, role);
    const entry: NamedEntry = { role_id: role, person_id: pid, months: namedMonths(band, r?.months ?? null), emirati: p.nationality_flag === 'uae', source: 'f19' };
    const k = `${role}|${pid}`;
    const prev = named.findIndex((e) => `${e.role_id}|${e.person_id}` === k);
    if (prev >= 0) { if (entry.months < named[prev].months) named[prev] = entry; continue; }
    named.push(entry);
    seen.add(k);
  }
  for (const tg of t.targets) {
    if (tg.active === false || !cover.has(tg.role_id) || f19.has(tg.role_id)) continue;
    const p = people.get(tg.person_id);
    if (!p || p.kind !== 'staff' || p.status !== 'active' || p.job_role_id === tg.role_id) continue;
    const k = `${tg.role_id}|${tg.person_id}`;
    if (seen.has(k)) continue;
    const r = readiness(tg.person_id, tg.role_id);
    const m = f05Months(r?.band, r?.months);
    if (m == null) continue;
    seen.add(k);
    named.push({ role_id: tg.role_id, person_id: tg.person_id, months: m, emirati: p.nationality_flag === 'uae', source: 'f05' });
  }
  named.sort((a, b) => (a.role_id < b.role_id ? -1 : a.role_id > b.role_id ? 1 : a.person_id < b.person_id ? -1 : a.person_id > b.person_id ? 1 : 0));
  return { named, f19Roles };
}
