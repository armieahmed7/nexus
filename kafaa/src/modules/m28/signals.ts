// FS70 (future skills, wave H · E1, M28) · ENEC Skills on the Rise and the annual manager pulse: pure rules.
// Import-free (the seed builder, the PGlite validator and both backends load it). SQL mirror, change both together:
// supabase/migrations/20261010281001_kafaa_fs81_skill_signals.sql (kafaa_rs_* functions: kafaa_rs_counts = signalCounts,
// kafaa_rs_compute = risingSkills, kafaa_mp_summary = pulseSummary, kafaa_rs_bounds = quarterBounds).
//
// Three internal signals per skill and quarter, each counted from data already in Kafa'a (published in full on /skills/rising/method):
//   goals_profiles  people (active staff) who added the skill to their goals (FS07/FS33 skill_goals created in the quarter) or whose
//                   profile shows the skill for the first time in the quarter (the earliest active F01 evidence row is observed then)
//   recent_hires    active staff hired in the 365 days up to the end of the quarter who hold the skill by the end of the quarter
//   demand          new demand items naming the skill: opportunities and gigs opened in the quarter (skills needed or gained; drafts
//                   excluded) plus role-profile versions (FS05) published in the quarter that require it
// A signal under 10 is suppressed: it shows as "suppressed" and moves nothing (small numbers are noise and could point at people).
// A skill is listed as "in demand now" when its demand signal is shown; otherwise as "growing" when goals/profiles or recent hires is
// shown and rose by at least 25 % against the previous quarter (or was suppressed then). Security-area and obsolete skills are never
// listed. Each listed skill carries the signals that moved it (moved_by) and their reasons. The list is published once per ended
// quarter and kept: a published quarter is never recomputed or overwritten.
// Manager pulse (annual): "what share of your team's core skills will change by 2030?" (0-100 %). Read only as an aggregate: fewer
// than 10 responses show nothing; every cell (a family, a band of answers) under 10 is suppressed.

export const SIGNALS = ['goals_profiles', 'recent_hires', 'demand'] as const;
export type SignalKey = (typeof SIGNALS)[number];
export const CATEGORIES = ['now', 'growing'] as const;
export type Category = (typeof CATEGORIES)[number];
/** a signal under this value is suppressed (MIN_GROUP_SIZE) */
export const MIN_SIGNAL = 10;
/** "recent hire": hired in the 365 days up to the end of the quarter */
export const HIRE_WINDOW_DAYS = 365;
/** "growing": the goals/profiles or recent-hire signal rose by at least this percentage against the previous quarter */
export const GROWTH_PCT = 25;
/** at most this many skills per category in a published list */
export const LIST_MAX = 12;
export const METHOD_VERSION = 'fs70-v1';
export const FIRST_QUARTER = '2025-Q1';
const QRE = /^(20\d\d)-Q([1-4])$/;
const DAY = 86_400_000;

type AnyRow = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const d10 = (v: unknown) => (v == null ? '' : String(v).slice(0, 10));
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** First and last day of a quarter (null when malformed). TS = SQL kafaa_rs_bounds. */
export function quarterBounds(q: string): { start: string; end: string } | null {
  const m = QRE.exec(typeof q === 'string' ? q : '');
  if (!m) return null;
  const y = Number(m[1]), n = Number(m[2]);
  const start = `${y}-${String(3 * n - 2).padStart(2, '0')}-01`;
  const end = iso(Date.UTC(n === 4 ? y + 1 : y, n === 4 ? 0 : 3 * n, 1) - DAY);
  return { start, end };
}
export const quarterOf = (date: string) => { const d = d10(date); return `${d.slice(0, 4)}-Q${Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1}`; };
export function prevQuarter(q: string): string {
  const m = QRE.exec(q);
  if (!m) return '';
  const y = Number(m[1]), n = Number(m[2]);
  return n === 1 ? `${y - 1}-Q4` : `${y}-Q${n - 1}`;
}
/** a quarter can be computed from FIRST_QUARTER up to the current one */
export const quarterComputable = (q: string, today: string) => { const b = quarterBounds(q); return !!b && q >= FIRST_QUARTER && b.start <= d10(today); };
/** a quarter can be published once it has ended */
export const quarterClosed = (q: string, today: string) => { const b = quarterBounds(q); return !!b && q >= FIRST_QUARTER && b.end < d10(today); };
/** the last ended quarter on a day */
export const lastClosedQuarter = (today: string) => prevQuarter(quarterOf(today));
/** quarters from FIRST_QUARTER to the given one, oldest first */
export function quartersTo(q: string): string[] {
  const out: string[] = [];
  for (let x = q; x && x >= FIRST_QUARTER && out.length < 40; x = prevQuarter(x)) out.unshift(x);
  return out;
}

export interface SignalInput {
  skills: { id: string; area?: string | null; lifecycle?: string | null }[];
  people: { id: string; kind?: string | null; status?: string | null; hire_date?: string | null }[];
  evidence: { person_id: string; skill_id: string; observed_on?: string | null; active?: boolean | null }[];
  goals: { person_id: string; skill_id: string; created_at?: string | null }[];
  opportunities: { id: string; status?: string | null; created_at?: string | null; family_id?: string | null; skills_needed?: string[] | null; skills_gained?: string[] | null }[];
  versions: { id: string; role_id: string; status?: string | null; published_at?: string | null; requirements?: { kind?: string; ref_id?: string }[] | null }[];
  roles: { id: string; family_id?: string | null }[];
}
/** The rule's input from tables (raw rows; both backends and the seed builder). */
export function signalInputFromTables(raw: (t: string) => AnyRow[]): SignalInput {
  return {
    skills: raw('skills').map((s) => ({ id: s.id, area: s.area ?? null, lifecycle: s.lifecycle ?? null })),
    people: raw('people').map((p) => ({ id: p.id, kind: p.kind ?? null, status: p.status ?? null, hire_date: p.hire_date ?? null })),
    evidence: raw('skill_evidence').map((e) => ({ person_id: e.person_id, skill_id: e.skill_id, observed_on: e.observed_on ?? null, active: e.active ?? null })),
    goals: raw('skill_goals').map((g) => ({ person_id: g.person_id, skill_id: g.skill_id, created_at: g.created_at ?? null })),
    opportunities: raw('opportunities').map((o) => ({ id: o.id, status: o.status ?? null, created_at: o.created_at ?? null, family_id: o.family_id ?? null, skills_needed: o.skills_needed ?? [], skills_gained: o.skills_gained ?? [] })),
    versions: raw('role_profile_versions').map((v) => ({ id: v.id, role_id: v.role_id, status: v.status ?? null, published_at: v.published_at ?? null, requirements: v.requirements ?? [] })),
    roles: raw('job_roles').map((r) => ({ id: r.id, family_id: r.family_id ?? null })),
  };
}

export interface SignalCount { goals_profiles: number; recent_hires: number; demand: number; families: string[] }
/** Raw counts per skill for one quarter (before suppression). TS = SQL kafaa_rs_counts. */
export function signalCounts(x: SignalInput, q: string): Map<string, SignalCount> {
  const out = new Map<string, SignalCount>();
  const b = quarterBounds(q);
  if (!b) return out;
  const get = (s: string) => { let c = out.get(s); if (!c) { c = { goals_profiles: 0, recent_hires: 0, demand: 0, families: [] }; out.set(s, c); } return c; };
  const staff = new Set(x.people.filter((p) => p.kind === 'staff' && p.status === 'active').map((p) => p.id));
  const inQ = (d: string) => d >= b.start && d <= b.end;
  // goals and first profile appearance: distinct people per skill
  const first = new Map<string, string>();
  for (const e of x.evidence) {
    if (e.active !== true || !staff.has(e.person_id)) continue;
    const d = d10(e.observed_on);
    if (!d) continue;
    const k = `${e.person_id}|${e.skill_id}`;
    const cur = first.get(k);
    if (cur === undefined || d < cur) first.set(k, d);
  }
  const gp = new Map<string, Set<string>>();
  const addGp = (s: string, p: string) => { let set = gp.get(s); if (!set) { set = new Set(); gp.set(s, set); } set.add(p); };
  for (const [k, d] of first) if (inQ(d)) { const [p, s] = k.split('|'); addGp(s, p); }
  for (const g of x.goals) if (staff.has(g.person_id) && inQ(d10(g.created_at))) addGp(g.skill_id, g.person_id);
  for (const [s, set] of gp) get(s).goals_profiles = set.size;
  // recent hires holding the skill by the end of the quarter
  const hireFrom = iso(Date.parse(`${b.end}T00:00:00Z`) - HIRE_WINDOW_DAYS * DAY);
  const hires = new Set(x.people.filter((p) => staff.has(p.id) && d10(p.hire_date) > hireFrom && d10(p.hire_date) <= b.end).map((p) => p.id));
  const rh = new Map<string, Set<string>>();
  for (const [k, d] of first) {
    if (d > b.end) continue;
    const [p, s] = k.split('|');
    if (!hires.has(p)) continue;
    let set = rh.get(s); if (!set) { set = new Set(); rh.set(s, set); } set.add(p);
  }
  for (const [s, set] of rh) get(s).recent_hires = set.size;
  // demand items opened or published in the quarter
  const fam = new Map<string, Set<string>>();
  const addFam = (s: string, f: string | null | undefined) => { if (!f) return; let set = fam.get(s); if (!set) { set = new Set(); fam.set(s, set); } set.add(f); };
  for (const o of x.opportunities) {
    if (o.status === 'draft' || !inQ(d10(o.created_at))) continue;
    for (const s of new Set([...(o.skills_needed ?? []), ...(o.skills_gained ?? [])])) { get(s).demand += 1; addFam(s, o.family_id); }
  }
  const roleFam = new Map(x.roles.map((r) => [r.id, r.family_id ?? null] as const));
  for (const v of x.versions) {
    if (!(v.status === 'published' || v.status === 'superseded') || !inQ(d10(v.published_at))) continue;
    const ids = new Set((v.requirements ?? []).filter((r) => r && r.kind === 'skill' && typeof r.ref_id === 'string').map((r) => r.ref_id as string));
    for (const s of ids) { get(s).demand += 1; addFam(s, roleFam.get(v.role_id)); }
  }
  for (const [s, set] of fam) get(s).families = [...set].sort();
  return out;
}

export const shown = (n: number | null | undefined) => (n != null && n >= MIN_SIGNAL ? n : null);
/** Whole-percent change, rounded half up (integer arithmetic, same in SQL); null without a shown previous value. */
export const changePct = (v: number | null, p: number | null) => (v == null || p == null || p <= 0 ? null : Math.floor(((v - p) * 200 + p) / (2 * p)));

export interface ReasonLite { code: string; key: string; vars?: Record<string, string | number> }
export interface SignalCell { key: SignalKey; value: number | null; prev: number | null; change_pct: number | null; moved: boolean }
export interface SignalRow { skill_id: string; category: Category; rank: number; score: number; moved_by: SignalKey[]; signals: SignalCell[]; families: string[]; reasons: ReasonLite[] }
export interface RisingResult {
  quarter: string; prev: string; method: string; start: string; end: string;
  rows: SignalRow[];
  counts: { now: number; growing: number; considered: number; suppressed: number; shown: number };
}
const R = (code: string, vars: Record<string, string | number>): ReasonLite => ({ code, key: `m28.rs.reason.${code}`, vars });

/** The quarterly "ENEC Skills on the Rise" list (TS = SQL kafaa_rs_compute). Null for a malformed quarter. */
export function risingSkills(x: SignalInput, q: string): RisingResult | null {
  const b = quarterBounds(q);
  if (!b) return null;
  const pq = prevQuarter(q);
  const cur = signalCounts(x, q), prv = signalCounts(x, pq);
  const listed: Omit<SignalRow, 'rank'>[] = [];
  let considered = 0, suppressed = 0, shownN = 0;
  const skills = [...x.skills].filter((s) => s.area !== 'security' && s.lifecycle !== 'obsolete').sort((a, c) => (a.id < c.id ? -1 : a.id > c.id ? 1 : 0));
  for (const s of skills) {
    const c = cur.get(s.id), p = prv.get(s.id);
    if (!c) continue;
    considered++;
    const cells: SignalCell[] = SIGNALS.map((k) => {
      const value = shown(c[k]), prev = shown(p ? p[k] : 0);
      const ch = changePct(value, prev);
      const moved = value != null && (k === 'demand' || prev == null || (ch != null && ch >= GROWTH_PCT));
      if (c[k] > 0 && value == null) suppressed++;
      if (value != null) shownN++;
      return { key: k, value, prev, change_pct: ch, moved };
    });
    const dem = cells[2], gp = cells[0], rh = cells[1];
    const category: Category | null = dem.moved ? 'now' : gp.moved || rh.moved ? 'growing' : null;
    if (!category) continue;
    const reasons: ReasonLite[] = [];
    for (const cell of cells) {
      if (!cell.moved) continue;
      if (cell.key === 'demand') reasons.push(R('demand', { n: cell.value as number, families: c.families.length }));
      else if (cell.prev == null) reasons.push(R(`${cell.key}_new`, { n: cell.value as number }));
      else reasons.push(R(`${cell.key}_up`, { n: cell.value as number, prev: cell.prev, pct: cell.change_pct as number }));
    }
    if (category === 'now' && (gp.moved || rh.moved)) reasons.push(R('also_growing', {}));
    listed.push({ skill_id: s.id, category, score: cells.reduce((a, cell) => a + (cell.value ?? 0), 0), moved_by: cells.filter((cell) => cell.moved).map((cell) => cell.key), signals: cells, families: c.families, reasons });
  }
  const rows: SignalRow[] = [];
  for (const cat of CATEGORIES) {
    const list = listed.filter((r) => r.category === cat).sort((a, c) => c.score - a.score || (a.skill_id < c.skill_id ? -1 : 1)).slice(0, LIST_MAX);
    list.forEach((r, i) => rows.push({ ...r, rank: i + 1 }));
  }
  return {
    quarter: q, prev: pq, method: METHOD_VERSION, start: b.start, end: b.end, rows,
    counts: { now: rows.filter((r) => r.category === 'now').length, growing: rows.filter((r) => r.category === 'growing').length, considered, suppressed, shown: shownN },
  };
}

// ───────────── Manager pulse (annual)
export const PULSE_OPEN_MD = '09-15';
export const PULSE_CLOSE_MD = '12-15';
export const PULSE_BANDS: [number, number][] = [[0, 19], [20, 39], [40, 59], [60, 79], [80, 100]];
export const pulseWindow = (year: number) => ({ open: `${year}-${PULSE_OPEN_MD}`, close: `${year}-${PULSE_CLOSE_MD}` });
export const pulseOpen = (today: string) => { const d = d10(today); const w = pulseWindow(Number(d.slice(0, 4))); return d >= w.open && d <= w.close; };
export const shareOk = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100;
export const teamOk = (v: unknown) => v == null || (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 500);

export interface PulseSummary {
  year: number; responses: number | null; suppressed: boolean; median: number | null; p25: number | null; p75: number | null;
  bands: { lo: number; hi: number; n: number | null }[];
  families: { family_id: string; n: number | null; median: number | null }[];
}
const medianOf = (v: number[]) => (v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2);
/** nearest-rank percentile (integer index ceil(p/100 * n) - 1, integer arithmetic) */
const rankAt = (v: number[], pct: number) => v[Math.max(0, Math.floor((pct * v.length + 99) / 100) - 1)];
/** The pulse as an aggregate (TS = SQL kafaa_mp_summary): nothing under 10 responses; bands and families under 10 suppressed. */
export function pulseSummary(rows: { year: number; share_pct: number; family_id?: string | null }[], year: number): PulseSummary {
  const mine = rows.filter((r) => Number(r.year) === year && shareOk(Number(r.share_pct)));
  const vals = mine.map((r) => Number(r.share_pct)).sort((a, c) => a - c);
  const sup = vals.length < MIN_SIGNAL;
  const fams = [...new Set(mine.map((r) => r.family_id ?? 'none'))].sort();
  return {
    year, responses: sup ? null : vals.length, suppressed: sup,
    median: sup ? null : medianOf(vals), p25: sup ? null : rankAt(vals, 25), p75: sup ? null : rankAt(vals, 75),
    bands: PULSE_BANDS.map(([lo, hi]) => { const n = vals.filter((v) => v >= lo && v <= hi).length; return { lo, hi, n: sup || n < MIN_SIGNAL ? null : n }; }),
    families: sup ? [] : fams.map((f) => { const v = mine.filter((r) => (r.family_id ?? 'none') === f).map((r) => Number(r.share_pct)).sort((a, c) => a - c); return { family_id: f, n: v.length < MIN_SIGNAL ? null : v.length, median: v.length < MIN_SIGNAL ? null : medianOf(v) }; }),
  };
}

export const RS_MSG = {
  not_signed_in: 'Sign in to see ENEC Skills on the Rise',
  forbidden_compute: 'The signal workbench is for HR, the training manager, admins and auditors',
  forbidden_publish: 'Only HR analysts and the HR director publish the quarterly list',
  invalid_quarter: 'Choose a quarter from 2025-Q1 to the current quarter',
  open_quarter: 'A quarter is published only after it has ended',
  published: 'This quarter is already published; past lists are kept as they were',
  pulse_forbidden: 'The manager pulse is answered by line managers',
  pulse_closed: 'The manager pulse is open from 15 September to 15 December',
  pulse_invalid: 'Give a whole percentage from 0 to 100 (and a team size from 1 to 500 if you add one)',
  pulse_read_forbidden: 'Pulse results are aggregates for HR, the training manager, admins and auditors',
} as const;
