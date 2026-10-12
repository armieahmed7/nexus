// FS73 Emirati pipeline by competency (M37 National Alignment, FS wave H · E2). Pure, import-free rules shared by the page, the
// LocalBackend, the seed builder, the unit tests and the PGlite validator, mirrored 1:1 by SQL in
// supabase/migrations/20261010282001_kafaa_fs82_emirati_wallet.sql:
//   pipelineRoles()   = kafaa_ep_roles      the critical and future roles: current roles (never concept roles, never security-sensitive
//                                            roles) that are critical (job_roles.critical or a critical succession slate) or whose current
//                                            FS16 outlook label is "growing" (published criteria)
//   emiratiPipeline() = kafaa_ep_core       per competency area (the job family of the role) and in total: Emirati-ready successors by
//                                            readiness band and ready-by date (F19 slates, live), progression into authorised roles and
//                                            retention at 12, 24 and 36 months (the SIMULATED, de-identified HR mirror kafaa_pipeline_mirror)
// Aggregate only: nationality is read here for reporting and nowhere else; it never enters a score (no engine ranks anything here, and
// tests/unit/w3e5-no-protected-inputs.test.ts keeps proving it for every engine). Every count under 10 is suppressed (null); a share
// needs both its count and its base at 10 or above. Security, safeguards and cyber roles are never broken out (they are not in the set).
// Access (route guard and RPC): anyRole hr_analyst, hr_director, auditor. The workforce_analytics resource is NOT used for the guard
// because it grants observers and managers Agg (handover FS73 adjustment); observers and partners are refused.
import type { Reason } from '../../domain/engines/types';

export const FS73_ROLES = ['hr_analyst', 'hr_director', 'auditor'] as const;
export const EP_MIN = 10;
export const BANDS = ['ready_now', '1_2y', '3_5y'] as const;
export type Band = (typeof BANDS)[number];
export const BAND_RANK: Record<Band, number> = { ready_now: 0, '1_2y': 1, '3_5y': 2 };
/** Months to readiness when a successor row carries no estimate (upper end of the band). */
export const BAND_MONTHS: Record<Band, number> = { ready_now: 0, '1_2y': 24, '3_5y': 60 };
export const RETENTION_MONTHS = [12, 24, 36] as const;
export const SCOPES = ['all', 'critical', 'future'] as const;
export type Scope = (typeof SCOPES)[number];
export const PROGRESSION_MONTHS = 36;
export const SUCCESSOR_STATUSES = ['proposed', 'confirmed'];
export const EP_METHOD = 'fs73-v1';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const sup = (n: number) => (n >= EP_MIN ? n : null);
/** One-decimal percentage a / b, half up, in integers (identical in SQL kafaa_na_pct1). */
export const epPct = (a: number, b: number) => Math.floor((2000 * a + b) / (2 * b)) / 10;
const share = (n: number, base: number) => (n >= EP_MIN && base >= EP_MIN ? epPct(n, base) : null);

/** ISO date plus n calendar months, clamped to the month end (identical to SQL date + interval 'n months'). */
export function addMonths(iso: string, n: number): string {
  const y = Number(iso.slice(0, 4)); const m = Number(iso.slice(5, 7)) - 1; const d = Number(iso.slice(8, 10));
  const t = y * 12 + m + n; const ny = Math.floor(t / 12); const nm = t - ny * 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${String(ny).padStart(4, '0')}-${String(nm + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}
const day = (v: unknown) => (v == null ? null : String(v).slice(0, 10));

export interface PipelineWorld {
  people: Row[]; job_roles: Row[]; job_families: Row[]; role_outlook_labels: Row[]; succession_slates: Row[]; successors: Row[]; pipeline_mirror: Row[];
}
export const EP_TABLES = ['people', 'job_roles', 'job_families', 'role_outlook_labels', 'succession_slates', 'successors', 'pipeline_mirror'] as const;
export function pipelineWorldFrom(raw: (t: string) => Row[]): PipelineWorld {
  return Object.fromEntries(EP_TABLES.map((t) => [t, raw(t) ?? []])) as unknown as PipelineWorld;
}

export interface EpRole { role_id: string; family_id: string; title_en: string; title_ar: string; critical: boolean; future: boolean; slate: boolean; regulated: boolean }

/** The current FS16 outlook label of a role: the newest non-archived label (year, then as-of date, then id). */
export function currentOutlook(labels: Row[], roleId: string): string | null {
  const l = labels.filter((x) => x.role_id === roleId && !x.archived)
    .sort((a, b) => Number(b.year) - Number(a.year) || cmp(String(b.as_of ?? ''), String(a.as_of ?? '')) || cmp(String(b.id), String(a.id)))[0];
  return l ? String(l.label) : null;
}

/** The critical and future roles, sorted by competency area and role id. Concept and security-sensitive roles never enter. */
export function pipelineRoles(w: Pick<PipelineWorld, 'job_roles' | 'role_outlook_labels' | 'succession_slates'>): EpRole[] {
  const out: EpRole[] = [];
  for (const r of w.job_roles) {
    if ((r.lifecycle ?? 'current') !== 'current' || r.security_sensitive || !r.family_id) continue;
    const critical = !!r.critical || w.succession_slates.some((s) => s.role_id === r.id && s.critical);
    const future = currentOutlook(w.role_outlook_labels, r.id) === 'growing';
    if (!critical && !future) continue;
    out.push({
      role_id: r.id, family_id: r.family_id, title_en: r.title_en, title_ar: r.title_ar, critical, future,
      slate: w.succession_slates.some((s) => s.role_id === r.id), regulated: !!r.regulated,
    });
  }
  return out.sort((a, b) => cmp(a.family_id, b.family_id) || cmp(a.role_id, b.role_id));
}

export const normScope = (s: unknown): Scope => (typeof s === 'string' && (SCOPES as readonly string[]).includes(s) ? (s as Scope) : 'all');
/** The ready-by horizons: the end of this year, of the next two years, and of 2030 (deduplicated, ascending). */
export function readyHorizons(today: string): string[] {
  const y = Number(today.slice(0, 4));
  return [...new Set([`${y}-12-31`, `${y + 1}-12-31`, `${y + 2}-12-31`, `${Math.max(2030, y)}-12-31`])].sort();
}

/** One successor entry for the pipeline: band (HR-confirmed readiness, else the computed one) and the date the person is expected ready. */
export function successorEntry(s: Row, today: string): { band: Band; ready_by: string } | null {
  const band = (s.readiness ?? s.computed_readiness) as Band | null;
  if (!band || !(band in BAND_RANK)) return null;
  if (band === 'ready_now') return { band, ready_by: today };
  const from = day(s.proposed_at) ?? today;
  const months = s.months == null ? BAND_MONTHS[band] : Math.max(0, Math.floor(Number(s.months)));
  return { band, ready_by: addMonths(from, months) };
}

export interface EpSuccessors { emirati: number | null; all: number | null; share_pct: number | null; bands: Record<Band, number | null> }
export interface EpReady { date: string; n: number | null; roles: number | null }
export interface EpProgression { emirati: number | null; all: number | null; share_pct: number | null; by_year: { year: number; n: number | null }[] }
export interface EpRetention { months: number; cohort: number | null; retained: number | null; pct: number | null; all_pct: number | null }
export interface EpArea { family_id: string | null; roles: number; slates: number; successors: EpSuccessors; ready_by: EpReady[]; progression: EpProgression; retention: EpRetention[] }
export interface EmiratiPipeline { as_of: string; method: string; min_group: number; scope: Scope; roles: EpRole[]; areas: EpArea[]; total: EpArea }

interface SuccPair { person_id: string; role_id: string; family_id: string; uae: boolean; band: Band; ready_by: string }

/** The pipeline for a scope ('all', 'critical' or 'future'); aggregate only, every count under 10 null. */
export function emiratiPipeline(w: PipelineWorld, scopeIn: unknown, today: string): EmiratiPipeline {
  const scope = normScope(scopeIn);
  const roles = pipelineRoles(w).filter((r) => scope === 'all' || (scope === 'critical' ? r.critical : r.future));
  const roleById = new Map(roles.map((r) => [r.role_id, r]));
  const people = new Map(w.people.map((p) => [p.id, p]));
  // successors: the latest slate period of each role; proposed or confirmed internal successors who are active staff
  const latest = new Map<string, string>();
  for (const s of w.succession_slates) if (roleById.has(s.role_id) && (!latest.has(s.role_id) || cmp(String(s.period), latest.get(s.role_id)!) > 0)) latest.set(s.role_id, String(s.period));
  const slates = new Map(w.succession_slates.filter((s) => roleById.has(s.role_id) && latest.get(s.role_id) === String(s.period)).map((s) => [s.id, s]));
  const pairs: SuccPair[] = [];
  for (const x of w.successors) {
    const sl = slates.get(x.slate_id);
    if (!sl || !SUCCESSOR_STATUSES.includes(x.status) || x.cover_source !== 'internal' || !x.person_id) continue;
    const p = people.get(x.person_id);
    if (!p || p.kind !== 'staff' || p.status !== 'active') continue;
    const e = successorEntry(x, today);
    if (!e) continue;
    pairs.push({ person_id: x.person_id, role_id: sl.role_id, family_id: roleById.get(sl.role_id)!.family_id, uae: p.nationality_flag === 'uae', band: e.band, ready_by: e.ready_by });
  }
  const spells = w.pipeline_mirror.filter((m) => roleById.has(m.role_id));
  const horizons = readyHorizons(today);
  const y = Number(today.slice(0, 4));
  const since = addMonths(today, -PROGRESSION_MONTHS);

  const area = (fam: string | null): EpArea => {
    const inArea = (roleId: string) => fam === null || roleById.get(roleId)!.family_id === fam;
    const ps = pairs.filter((p) => inArea(p.role_id));
    const best = new Map<string, { uae: boolean; band: Band; ready_by: string }>();
    for (const p of ps) {
      const b = best.get(p.person_id);
      if (!b) best.set(p.person_id, { uae: p.uae, band: p.band, ready_by: p.ready_by });
      else best.set(p.person_id, { uae: p.uae, band: BAND_RANK[p.band] < BAND_RANK[b.band] ? p.band : b.band, ready_by: cmp(p.ready_by, b.ready_by) < 0 ? p.ready_by : b.ready_by });
    }
    const emi = [...best.values()].filter((b) => b.uae);
    const bands = Object.fromEntries(BANDS.map((k) => [k, sup(emi.filter((b) => b.band === k).length)])) as Record<Band, number | null>;
    const ready_by = horizons.map((d) => {
      const n = emi.filter((b) => cmp(b.ready_by, d) <= 0).length;
      const covered = new Set(ps.filter((p) => p.uae && cmp(p.ready_by, d) <= 0).map((p) => p.role_id)).size;
      return { date: d, n: sup(n), roles: n >= EP_MIN ? covered : null };
    });
    const sp = spells.filter((m) => inArea(m.role_id));
    const auth = sp.filter((m) => m.authorised_on && cmp(day(m.authorised_on)!, since) > 0 && cmp(day(m.authorised_on)!, today) <= 0);
    const authE = auth.filter((m) => m.nationality_flag === 'uae').length;
    const by_year = [y - 5, y - 4, y - 3, y - 2, y - 1, y].map((yr) => ({
      year: yr, n: sup(sp.filter((m) => m.nationality_flag === 'uae' && m.authorised_on && Number(day(m.authorised_on)!.slice(0, 4)) === yr && cmp(day(m.authorised_on)!, today) <= 0).length),
    }));
    const retention = RETENTION_MONTHS.map((n) => {
      const cohort = sp.filter((m) => cmp(addMonths(day(m.hired_on)!, n), today) <= 0);
      const kept = cohort.filter((m) => !m.left_on || cmp(day(m.left_on)!, addMonths(day(m.hired_on)!, n)) >= 0);
      const ce = cohort.filter((m) => m.nationality_flag === 'uae'); const ke = kept.filter((m) => m.nationality_flag === 'uae');
      return { months: n, cohort: sup(ce.length), retained: ce.length >= EP_MIN ? sup(ke.length) : null, pct: share(ke.length, ce.length), all_pct: share(kept.length, cohort.length) };
    });
    const rs = roles.filter((r) => fam === null || r.family_id === fam);
    return {
      family_id: fam, roles: rs.length, slates: rs.filter((r) => latest.has(r.role_id)).length,
      successors: { emirati: sup(emi.length), all: sup(best.size), share_pct: share(emi.length, best.size), bands },
      ready_by, progression: { emirati: sup(authE), all: sup(auth.length), share_pct: share(authE, auth.length), by_year }, retention,
    };
  };
  const fams = [...new Set(roles.map((r) => r.family_id))].sort(cmp);
  return { as_of: today, method: EP_METHOD, min_group: EP_MIN, scope, roles, areas: fams.map((f) => area(f)), total: area(null) };
}

/** May this caller open the pipeline? anyRole hr_analyst, hr_director, auditor (identical in SQL kafaa_ep_allowed). */
export const pipelineAllowed = (roles: readonly string[]) => roles.some((r) => (FS73_ROLES as readonly string[]).includes(r));

/** Why an area reads the way it does (UI explanation; no ranking). */
export function areaReasons(a: EpArea): Reason[] {
  const r: Reason[] = [{ code: 'ep_roles', key: 'm37.ep.reason.roles', vars: { n: a.roles, slates: a.slates } }];
  r.push(a.successors.emirati == null
    ? { code: 'ep_suppressed', key: 'm37.ep.reason.suppressed', vars: { min: EP_MIN } }
    : { code: 'ep_successors', key: 'm37.ep.reason.successors', vars: { n: a.successors.emirati } });
  const ret = a.retention.find((x) => x.months === 36);
  if (ret && ret.pct != null) r.push({ code: 'ep_retention', key: 'm37.ep.reason.retention', vars: { pct: ret.pct } });
  r.push({ code: 'ep_mirror', key: 'm37.ep.reason.mirror' });
  return r;
}
