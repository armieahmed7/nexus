/**
 * M36 · FS65 Skills pledges ledger. Pure rules, import-free apart from types (seed scripts and the PGlite validator import this file).
 * SQL twins in supabase/migrations/20261010273001_kafaa_fs73_regional_pledges.sql (kafaa_pl_*), proved by
 * scripts/validate/fs73-regional-pledges.mjs.
 *
 * A pledge is a numeric commitment by one organisation: people x skill area x target date. Pledged, started and completed are three
 * separate numbers, three separate columns and three separate tiles; no rule here (or in the pages) ever adds them together, because a
 * pledge is a commitment, not a completion.
 *  - pledgeProblem() / progressProblem(): the register and progress checks (SQL kafaa_pl_problem, kafaa_pl_progress_problem).
 *  - pledgeStatus(): met, in progress, not started, lapsed (target date passed without meeting the pledge) or withdrawn.
 *  - pledgeLedger(): the aggregate ledger everyone with ecosystem R reads (staff, partners, universities, HR, auditors): totals, by skill
 *    area, by organisation type and by target year. A cell is suppressed when it holds 1 to 9 people or comes from fewer than two
 *    organisations (a single organisation's numbers never show through an aggregate). (SQL kafaa_pl_ledger)
 */
import type { Reason } from '../../domain/engines/types';

export const MIN_GROUP = 10;
/** An aggregate cell needs at least this many organisations, so no single organisation shows through. */
export const MIN_ORGS = 2;
export const MAX_PEOPLE = 5000;
export const MAX_PROGRESS = 100000;
export const LAST_TARGET = '2035-12-31';
/** Skill areas a pledge may name: the catalogue areas (security excluded) and the FS02 future-skill areas. */
export const PLEDGE_AREAS = [
  'plant_systems', 'operations', 'maintenance', 'radiation_chemistry', 'engineering', 'safety', 'human_performance', 'emergency', 'quality', 'leadership', 'digital', 'project',
  'ai_data', 'digital_plant', 'green_energy', 'advanced_reactor', 'cyber_hygiene', 'transversal',
] as const;
/** Organisation types in the ledger (organisations.kind -> type). */
export const ORG_TYPES = ['enec', 'supplier', 'university', 'partner'] as const;
export type OrgType = (typeof ORG_TYPES)[number];
export const orgTypeOf = (kind: string | null | undefined): OrgType => (kind === 'group_entity' ? 'enec' : kind === 'supplier' ? 'supplier' : kind === 'university' ? 'university' : 'partner');
/** ENEC entities the HR team registers pledges for (ENEC departments); partners and universities register their own. */
export const ENEC_ENTITIES = ['enec', 'enec-ops', 'enec-com', 'enec-con'] as const;

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const AR = /[؀-ۿ]/;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (s: unknown): s is string => typeof s === 'string' && ISO.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
/** ISO date plus n days (UTC). */
export const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

// ───────────── Checks
export interface PledgeInput {
  org_id?: string | null;
  area: string;
  people: number;
  target_date: string;
  title_en: string;
  title_ar: string;
  department_en?: string | null;
  department_ar?: string | null;
}
export type PledgeProblem = 'area' | 'people' | 'date' | 'title' | 'department';
/** The register check: area, a whole number of people (1-5000), a target date 30 days to 2035 ahead, a title in EN and AR. */
export function pledgeProblem(p: Partial<PledgeInput> | null | undefined, today: string): PledgeProblem | null {
  if (!p || typeof p !== 'object' || typeof p.area !== 'string' || !(PLEDGE_AREAS as readonly string[]).includes(p.area)) return 'area';
  if (!isInt(p.people) || p.people < 1 || p.people > MAX_PEOPLE) return 'people';
  if (!validDate(p.target_date) || p.target_date < addDays(today, 30) || p.target_date > LAST_TARGET) return 'date';
  const te = txt(p.title_en), ta = txt(p.title_ar);
  if (te.length < 5 || te.length > 160 || ta.length < 5 || ta.length > 160 || !AR.test(ta)) return 'title';
  const de = txt(p.department_en), da = txt(p.department_ar);
  if ((de === '') !== (da === '') || de.length > 120 || da.length > 120 || (da !== '' && !AR.test(da))) return 'department';
  return null;
}

export interface ProgressInput { pledge_id: string; as_of: string; started: number; completed: number; note_en?: string | null; note_ar?: string | null }
export type ProgressProblem = 'date' | 'numbers' | 'order' | 'decrease';
/** A progress snapshot: dated between the pledge date and today, completed never above started, later than and not below the previous one. */
export function progressProblem(x: Partial<ProgressInput> | null | undefined, pledge: { pledged_on: string }, prev: { as_of: string; started: number; completed: number } | null, today: string): ProgressProblem | null {
  if (!x || !validDate(x.as_of) || x.as_of < pledge.pledged_on || x.as_of > today) return 'date';
  if (!isInt(x.started) || !isInt(x.completed) || x.started < 0 || x.started > MAX_PROGRESS || x.completed < 0 || x.completed > x.started) return 'numbers';
  if (prev && x.as_of <= prev.as_of) return 'order';
  if (prev && (x.started < prev.started || x.completed < prev.completed)) return 'decrease';
  return null;
}

// ───────────── Status
export type PledgeStatus = 'withdrawn' | 'met' | 'lapsed' | 'not_started' | 'in_progress';
/** The latest snapshot dated on or before today (null when none). */
export function latestProgress(progress: Row[], pledgeId: string, today: string): Row | null {
  let best: Row | null = null;
  for (const r of progress) if (r.pledge_id === pledgeId && String(r.as_of) <= today && (!best || String(r.as_of) > String(best.as_of))) best = r;
  return best;
}
export function pledgeStatus(p: Row, latest: Row | null, today: string): PledgeStatus {
  if (p.status === 'withdrawn') return 'withdrawn';
  const completed = latest ? Number(latest.completed) : 0, started = latest ? Number(latest.started) : 0;
  if (completed >= Number(p.people)) return 'met';
  if (String(p.target_date) < today) return 'lapsed';
  if (started === 0) return 'not_started';
  return 'in_progress';
}
export function pledgeReasons(p: Row, latest: Row | null, today: string): Reason[] {
  const r = (code: string, vars?: Reason['vars']): Reason => ({ code, key: `m36.reasons.${code}`, vars });
  const st = pledgeStatus(p, latest, today);
  const out: Reason[] = [r(`pl_${st}`, { date: String(p.target_date) })];
  if (latest) out.push(r('pl_latest', { date: String(latest.as_of) }));
  else out.push(r('pl_no_progress'));
  return out;
}

// ───────────── Aggregate ledger
export interface Cell { value: number | null; suppressed: boolean }
/** Suppressed when fewer than MIN_ORGS organisations stand behind the cell or it holds 1 to 9 people. */
export const cellOf = (v: number, orgs: number): Cell => (orgs < MIN_ORGS || (v > 0 && v < MIN_GROUP) ? { value: null, suppressed: true } : { value: v, suppressed: false });
/** Counts of pledges (not people): suppressed only when fewer than MIN_ORGS organisations stand behind them (0 stays 0). */
export const countOf = (v: number, orgs: number): Cell => (v > 0 && orgs < MIN_ORGS ? { value: null, suppressed: true } : { value: v, suppressed: false });
export interface LedgerGroup { key: string; pledged: Cell; started: Cell; completed: Cell; pledges: number; orgs: number }
export interface Ledger {
  as_of: string;
  min_group: number;
  min_orgs: number;
  totals: LedgerGroup;
  by_area: LedgerGroup[];
  by_type: LedgerGroup[];
  by_year: LedgerGroup[];
  statuses: { key: PledgeStatus; pledges: Cell }[];
}
export interface LedgerInput { pledges: Row[]; progress: Row[]; orgs: Record<string, string | null | undefined> }

export function pledgeLedger(inp: LedgerInput, today: string): Ledger {
  const items = inp.pledges.filter((p) => p.status !== 'withdrawn').map((p) => {
    const latest = latestProgress(inp.progress, String(p.id), today);
    return {
      p, area: String(p.area), type: orgTypeOf(inp.orgs[String(p.org_id)]), year: String(p.target_date).slice(0, 4), org: String(p.org_id),
      pledged: Number(p.people), started: latest ? Number(latest.started) : 0, completed: latest ? Number(latest.completed) : 0, status: pledgeStatus(p, latest, today),
    };
  });
  type It = (typeof items)[number];
  const group = (key: string, xs: It[]): LedgerGroup => {
    const orgs = new Set(xs.map((x) => x.org)).size;
    let pl = 0, st = 0, co = 0;
    for (const x of xs) { pl = pl + x.pledged; st = st + x.started; co = co + x.completed; }
    return { key, pledged: cellOf(pl, orgs), started: cellOf(st, orgs), completed: cellOf(co, orgs), pledges: xs.length, orgs };
  };
  const by = (keys: readonly string[], f: (x: It) => string) => keys.filter((k) => items.some((x) => f(x) === k)).map((k) => group(k, items.filter((x) => f(x) === k)));
  const years = [...new Set(items.map((x) => x.year))].sort();
  const STATUSES: PledgeStatus[] = ['met', 'in_progress', 'not_started', 'lapsed'];
  return {
    as_of: today, min_group: MIN_GROUP, min_orgs: MIN_ORGS,
    totals: group('all', items),
    by_area: by(PLEDGE_AREAS, (x) => x.area),
    by_type: by(ORG_TYPES, (x) => x.type),
    by_year: by(years, (x) => x.year),
    statuses: STATUSES.map((s) => { const xs = items.filter((x) => x.status === s); return { key: s, pledges: countOf(xs.length, new Set(xs.map((x) => x.org)).size) }; }),
  };
}
