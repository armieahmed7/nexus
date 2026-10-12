// FS72 (future skills, wave H · E1, M28) · "Skills you may have": inferred-skill suggestions the person confirms, rejects or marks
// "not me". Pure rules, import-free (the seed builder, the PGlite validator and both backends load it). SQL mirror, change both
// together: supabase/migrations/20261010281001_kafaa_fs81_skill_signals.sql (kafaa_ssg_candidates = inferSuggestions).
//
// Five deterministic sources (no model; the engine card "skill_suggestions" explains them), each with its reason:
//   gig           a completed opportunity or gig (M20) used the skill, but the poster's signed-off outcome did not level it   30 points
//   contribution  a validated expert contribution (FS44 lecture or knowledge asset) sits next to the skill (adjacency)          25 points
//   xapi          learning-record statements (F30 xAPI, last 365 days): 3+ correct refresher answers on the skill's competency,
//                 or a completed simulator scenario on it, or a knowledge asset on the skill that I used                         20 points
//   co_occurrence among active staff (me excluded), people who hold a skill I hold also hold this one far more often than staff in
//                 general: lift of at least 1.5, with at least 10 holders of my skill and 5 holding both (groups under 10 never
//                 count)                                                                                          lift x 10, up to 30 points
//   adjacency     the catalogue lists the skill next to one I hold at level 2+ on evidence better than a self-rating             15 (+5 at level 3+)
// A suggestion needs 30 points (so adjacency alone never suggests), at most 6 per person, strongest first. Level 2 when a gig or a
// contribution backs it or it scores 60+, else level 1. Never suggested: skills I already hold, security-area and obsolete skills,
// a skill I confirmed, and a skill I rejected or marked "not me" in the last 180 days. Protected inputs (gender, nationality, age)
// are never read. Suggestions are private (own rows only, never a manager); a confirmed suggestion becomes my own claimed evidence
// (kind rating, basis claimed, ref_table skill_suggestions), never more than a claim.

export const SOURCES = ['gig', 'contribution', 'xapi', 'co_occurrence', 'adjacency'] as const;
export type SuggestSource = (typeof SOURCES)[number];
export const POINTS = { gig: 30, contribution: 25, xapi: 20, adjacency: 15, adjacency_strong: 5, co_max: 30 } as const;
export const THRESHOLD = 30;
export const MAX_PER_PERSON = 6;
export const LEVEL2_SCORE = 60;
export const SUPPRESS_DAYS = 180;
export const XAPI_DAYS = 365;
export const REFRESHER_MIN = 3;
export const CO = { min_holders: 10, min_both: 5, min_lift100: 150 } as const;
export const RESPONSES = ['confirm', 'reject', 'not_me'] as const;
export type SuggestResponse = (typeof RESPONSES)[number];
export const STATUSES = ['open', 'confirmed', 'rejected', 'not_me', 'expired'] as const;
export type SuggestStatus = (typeof STATUSES)[number];
const STRONG_BASIS = ['verified', 'evidenced', 'validated'];
const DAY = 86_400_000;

type AnyRow = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export interface Bi { en: string; ar: string }
export interface ReasonLite { code: string; key: string; vars?: Record<string, string | number | Bi> }
export interface SuggestWorld {
  skills: { id: string; area?: string | null; lifecycle?: string | null; adjacent_ids?: string[] | null; competency_id?: string | null; core?: boolean | null; name_en: string; name_ar: string }[];
  people: { id: string; kind?: string | null; status?: string | null }[];
  states: { person_id: string; skill_id: string; level: number; basis?: string | null; active?: boolean | null }[];
  xapi: { actor_person_id?: string | null; verb?: string | null; object_type?: string | null; object_id?: string | null; result?: AnyRow | null; occurred_at?: string | null }[];
  scenarios: { id: string; competency_ids?: string[] | null }[];
  assets: { id: string; skill_ids?: string[] | null }[];
  opportunities: { id: string; title_en?: string | null; title_ar?: string | null; skills_needed?: string[] | null; skills_gained?: string[] | null }[];
  applications: { person_id: string; opportunity_id: string; status?: string | null; outcome_levels?: AnyRow | null }[];
  contributions: { id: string; person_id: string; status?: string | null; skill_ids?: string[] | null; title_en?: string | null; title_ar?: string | null }[];
  suggestions: { person_id: string; skill_id: string; status?: string | null; suppressed_until?: string | null }[];
}
export function ssgWorldFromTables(raw: (t: string) => AnyRow[]): SuggestWorld {
  return {
    skills: raw('skills').map((s) => ({ id: s.id, area: s.area ?? null, lifecycle: s.lifecycle ?? null, adjacent_ids: s.adjacent_ids ?? [], competency_id: s.competency_id ?? null, core: s.core ?? null, name_en: s.name_en, name_ar: s.name_ar })),
    people: raw('people').map((p) => ({ id: p.id, kind: p.kind ?? null, status: p.status ?? null })),
    states: raw('person_skills').map((x) => ({ person_id: x.person_id, skill_id: x.skill_id, level: Number(x.level), basis: x.basis ?? null, active: x.active ?? null })),
    xapi: raw('xapi_statements').map((x) => ({ actor_person_id: x.actor_person_id ?? null, verb: x.verb ?? null, object_type: x.object_type ?? null, object_id: x.object_id ?? null, result: x.result ?? null, occurred_at: x.occurred_at ?? null })),
    scenarios: raw('sim_scenarios').map((x) => ({ id: x.id, competency_ids: x.competency_ids ?? [] })),
    assets: raw('knowledge_assets').map((x) => ({ id: x.id, skill_ids: x.skill_ids ?? [] })),
    opportunities: raw('opportunities').map((o) => ({ id: o.id, title_en: o.title_en ?? null, title_ar: o.title_ar ?? null, skills_needed: o.skills_needed ?? [], skills_gained: o.skills_gained ?? [] })),
    applications: raw('opportunity_applications').map((a) => ({ person_id: a.person_id, opportunity_id: a.opportunity_id, status: a.status ?? null, outcome_levels: a.outcome_levels ?? null })),
    contributions: raw('contributions').map((c) => ({ id: c.id, person_id: c.person_id, status: c.status ?? null, skill_ids: c.skill_ids ?? [], title_en: c.title_en ?? null, title_ar: c.title_ar ?? null })),
    suggestions: raw('skill_suggestions').map((x) => ({ person_id: x.person_id, skill_id: x.skill_id, status: x.status ?? null, suppressed_until: x.suppressed_until ?? null })),
  };
}

export interface Candidate { skill_id: string; score: number; level: number; sources: SuggestSource[]; reasons: ReasonLite[] }
const d10 = (v: unknown) => (v == null ? '' : String(v).slice(0, 10));
const addDays = (d: string, n: number) => new Date(Date.parse(`${d10(d)}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
export const suppressedUntil = (respondedOn: string) => addDays(respondedOn, SUPPRESS_DAYS);
const R = (code: SuggestSource, vars: Record<string, string | number | Bi>): ReasonLite => ({ code, key: `m28.ssg.reason.${code}`, vars });
/** lift x 100, rounded half up, in integer arithmetic (same in SQL) */
export const lift100 = (nAB: number, n: number, nA: number, nB: number) => Math.floor((nAB * n * 200 + nA * nB) / (2 * nA * nB));
/** a whole percentage, rounded half up */
export const pctOf = (k: number, n: number) => Math.floor((k * 200 + n) / (2 * n));

/** Is a (person, skill) blocked by an earlier answer on the day? A confirmed skill never returns; a rejected or "not me" one returns on
 *  the 180th day after the answer. */
export function blocked(rows: SuggestWorld['suggestions'], personId: string, skillId: string, today: string): boolean {
  return rows.some((r) => r.person_id === personId && r.skill_id === skillId
    && (r.status === 'confirmed' || ((r.status === 'rejected' || r.status === 'not_me') && !!r.suppressed_until && d10(today) < d10(r.suppressed_until))));
}

/** The suggestions for one person on a day (TS = SQL kafaa_ssg_candidates), strongest first. */
export function inferSuggestions(w: SuggestWorld, personId: string, today: string): Candidate[] {
  const day = d10(today);
  const skill = new Map(w.skills.map((s) => [s.id, s] as const));
  const bi = (id: string): Bi => { const s = skill.get(id); return { en: s?.name_en ?? id, ar: s?.name_ar ?? id }; };
  const staff = new Set(w.people.filter((p) => p.kind === 'staff' && p.status === 'active').map((p) => p.id));
  const held = new Map<string, { level: number; basis: string }>();
  const holders = new Map<string, Set<string>>();
  for (const s of w.states) {
    if (s.active !== true || !(Number(s.level) >= 1)) continue;
    if (s.person_id === personId) held.set(s.skill_id, { level: Number(s.level), basis: String(s.basis ?? '') });
    if (staff.has(s.person_id) && s.person_id !== personId) { let set = holders.get(s.skill_id); if (!set) { set = new Set(); holders.set(s.skill_id, set); } set.add(s.person_id); }
  }
  const eligible = (id: string) => { const s = skill.get(id); return !!s && !held.has(id) && s.area !== 'security' && s.lifecycle !== 'obsolete' && !blocked(w.suggestions, personId, id, day); };
  const found = new Map<string, Partial<Record<SuggestSource, { points: number; reason: ReasonLite }>>>();
  const put = (id: string, src: SuggestSource, points: number, reason: ReasonLite) => {
    if (!eligible(id)) return;
    let f = found.get(id); if (!f) { f = {}; found.set(id, f); }
    if (!f[src]) f[src] = { points, reason };
  };
  // gig: completed opportunities whose skills were not levelled in the signed-off outcome
  const opp = new Map(w.opportunities.map((o) => [o.id, o] as const));
  for (const a of [...w.applications].filter((x) => x.person_id === personId && x.status === 'completed').sort((x, y) => (x.opportunity_id < y.opportunity_id ? -1 : 1))) {
    const o = opp.get(a.opportunity_id);
    if (!o) continue;
    const levelled = new Set(Object.keys(a.outcome_levels && typeof a.outcome_levels === 'object' ? a.outcome_levels : {}));
    for (const s of [...(o.skills_needed ?? []), ...(o.skills_gained ?? [])]) if (!levelled.has(s)) put(s, 'gig', POINTS.gig, R('gig', { gig: { en: o.title_en ?? o.id, ar: o.title_ar ?? o.id } }));
  }
  // contribution: skills next to a validated contribution's skills
  for (const c of [...w.contributions].filter((x) => x.person_id === personId && x.status === 'validated').sort((x, y) => (x.id < y.id ? -1 : 1)))
    for (const s of c.skill_ids ?? []) for (const n of skill.get(s)?.adjacent_ids ?? [])
      put(n, 'contribution', POINTS.contribution, R('contribution', { title: { en: c.title_en ?? c.id, ar: c.title_ar ?? c.id }, skill: bi(s) }));
  // xapi: learning-record statements in the last 365 days
  const from = addDays(day, -XAPI_DAYS);
  const cores = new Map<string, string[]>();
  for (const s of w.skills) if (s.core === true && s.competency_id) { const l = cores.get(s.competency_id) ?? []; l.push(s.id); cores.set(s.competency_id, l); }
  const scen = new Map(w.scenarios.map((x) => [x.id, x.competency_ids ?? []] as const));
  const asset = new Map(w.assets.map((x) => [x.id, x.skill_ids ?? []] as const));
  const xr = new Map<string, { refresher: number; other: number }>();
  const bump = (s: string, k: 'refresher' | 'other') => { const c = xr.get(s) ?? { refresher: 0, other: 0 }; c[k] += 1; xr.set(s, c); };
  for (const x of w.xapi) {
    const d = d10(x.occurred_at);
    if (x.actor_person_id !== personId || !(d > from && d <= day)) continue;
    if (x.object_type === 'refresher' && x.verb === 'answered' && x.result?.success === true) for (const s of cores.get(String(x.object_id)) ?? []) bump(s, 'refresher');
    else if (x.object_type === 'scenario' && x.verb === 'completed') for (const c of scen.get(String(x.object_id)) ?? []) for (const s of cores.get(c) ?? []) bump(s, 'other');
    else if (x.object_type === 'knowledge_asset' && x.verb === 'experienced') for (const s of asset.get(String(x.object_id)) ?? []) bump(s, 'other');
  }
  for (const s of [...xr.keys()].sort()) { const c = xr.get(s)!; if (c.refresher >= REFRESHER_MIN || c.other >= 1) put(s, 'xapi', POINTS.xapi, R('xapi', { n: c.refresher + c.other })); }
  // co-occurrence lift among staff (me excluded); my skills ordered by id, the best lift kept
  const n = [...staff].filter((p) => p !== personId).length;
  const mine = [...held.keys()].sort();
  const co = new Map<string, { l: number; a: string; pct: number }>();
  for (const a of mine) {
    const ha = holders.get(a);
    if (!ha || ha.size < CO.min_holders) continue;
    for (const [b, hb] of holders) {
      if (b === a || hb.size < CO.min_holders) continue;
      let both = 0; for (const p of ha) if (hb.has(p)) both++;
      if (both < CO.min_both) continue;
      const l = lift100(both, n, ha.size, hb.size);
      if (l < CO.min_lift100) continue;
      const cur = co.get(b);
      if (!cur || l > cur.l) co.set(b, { l, a, pct: pctOf(both, ha.size) });
    }
  }
  for (const b of [...co.keys()].sort()) { const c = co.get(b)!; put(b, 'co_occurrence', Math.min(POINTS.co_max, Math.floor(c.l / 10)), R('co_occurrence', { skill: bi(c.a), pct: c.pct, lift: c.l / 100 })); }
  // adjacency: next to a skill I hold at level 2+ on better-than-claimed evidence (strongest of my skills first)
  for (const a of [...held.entries()].filter(([, v]) => v.level >= 2 && STRONG_BASIS.includes(v.basis)).sort(([x, vx], [y, vy]) => vy.level - vx.level || (x < y ? -1 : 1)))
    for (const b of skill.get(a[0])?.adjacent_ids ?? []) put(b, 'adjacency', POINTS.adjacency + (a[1].level >= 3 ? POINTS.adjacency_strong : 0), R('adjacency', { skill: bi(a[0]), level: a[1].level }));
  const out: Candidate[] = [];
  for (const [id, f] of found) {
    const srcs = SOURCES.filter((s) => f[s]);
    const score = Math.min(100, srcs.reduce((t, s) => t + f[s]!.points, 0));
    if (score < THRESHOLD) continue;
    out.push({ skill_id: id, score, level: f.gig || f.contribution || score >= LEVEL2_SCORE ? 2 : 1, sources: srcs, reasons: srcs.map((s) => f[s]!.reason) });
  }
  return out.sort((x, y) => y.score - x.score || (x.skill_id < y.skill_id ? -1 : 1)).slice(0, MAX_PER_PERSON);
}

export interface StoredSuggestion { id: string; person_id: string; skill_id: string; status: string; level?: number; score?: number; sources?: string[]; reasons?: unknown; first_on?: string | null;
  generated_on?: string | null; responded_on?: string | null; suppressed_until?: string | null; evidence_id?: string | null; history?: unknown; version?: number }
/** What a refresh writes for one person (TS = SQL kafaa_refresh_skill_suggestions): a new candidate inserts an open row; an open or
 *  expired row takes the new reasons; a rejected or "not me" row whose 180 days have passed reopens (the old answer kept in history);
 *  an open row no longer backed by any source expires. Confirmed rows never change. */
export function refreshPlan(personId: string, rows: StoredSuggestion[], cands: Candidate[], today: string) {
  const day = d10(today);
  const mine = new Map(rows.filter((r) => r.person_id === personId).map((r) => [r.skill_id, r] as const));
  const inserts: StoredSuggestion[] = [];
  const updates: { id: string; patch: Partial<StoredSuggestion> }[] = [];
  let added = 0, expired = 0;
  const want = new Set<string>();
  for (const c of cands) {
    want.add(c.skill_id);
    const cur = mine.get(c.skill_id);
    const body = { status: 'open', level: c.level, score: c.score, sources: [...c.sources], reasons: c.reasons, generated_on: day };
    if (!cur) { inserts.push({ id: suggestionId(personId, c.skill_id), person_id: personId, skill_id: c.skill_id, ...body, first_on: day, responded_on: null, suppressed_until: null, evidence_id: null, history: [], version: 1 }); added++; }
    else if (cur.status === 'open' || cur.status === 'expired') { updates.push({ id: cur.id, patch: { ...body, version: Number(cur.version ?? 1) + 1 } }); if (cur.status === 'expired') added++; }
    else if (cur.status === 'rejected' || cur.status === 'not_me') {
      updates.push({ id: cur.id, patch: { ...body, responded_on: null, suppressed_until: null, history: [...(Array.isArray(cur.history) ? cur.history : []), { status: cur.status, responded_on: d10(cur.responded_on) }], version: Number(cur.version ?? 1) + 1 } });
      added++;
    }
  }
  for (const [s, cur] of [...mine.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) if (cur.status === 'open' && !want.has(s)) { updates.push({ id: cur.id, patch: { status: 'expired', generated_on: day, version: Number(cur.version ?? 1) + 1 } }); expired++; }
  // every candidate ends open (confirmed and recently answered skills are never candidates)
  const open = cands.length;
  return { inserts, updates, added, expired, open };
}

/** The status a response sets, and the check (TS = SQL): only an open suggestion of mine can be answered. */
export const responseStatus = (r: SuggestResponse): SuggestStatus => (r === 'confirm' ? 'confirmed' : r === 'reject' ? 'rejected' : 'not_me');
export const evidenceId = (personId: string, skillId: string) => `se:rating:ssg:${personId}:${skillId}`;
export const suggestionId = (personId: string, skillId: string) => `ssg:${personId}:${skillId}`;

export const SSG_MSG = {
  not_signed_in: 'Sign in to see skills you may have',
  forbidden: 'Skill suggestions are for staff with a skills profile',
  not_found: 'Suggestion not found',
  invalid: 'Choose confirm, reject or not me',
  closed: 'This suggestion is already answered',
  forbidden_fairness: 'Only a platform admin or AI governance lead may run the fairness snapshot',
  invalid_date: 'Choose a date within the last year',
  forbidden_stats: 'Suggestion statistics are aggregates for HR, admins and auditors',
} as const;

// ───────────── fairness outcome (the surface's FS55 snapshot is built in suggestFairness.ts with the F24 group rules)
export const FAIRNESS = { metric: 'suggestion_offered', card: 'skill_suggestions', source: 'skill_suggestions', prefix: 'ssf' } as const;
/** People reached by the surface by a day: staff with at least one suggestion first made on or before it. */
export const reachedBy = (rows: { person_id: string; first_on?: string | null }[], asOf: string) => new Set(rows.filter((r) => !!r.first_on && d10(r.first_on) <= d10(asOf)).map((r) => r.person_id));
