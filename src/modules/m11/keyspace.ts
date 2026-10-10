/**
 * [FS04] One future-skill keyspace and a computed future-skills radar (M11). Pure and import-free: the seed builder
 * (scripts/seed/ext/fs04-keyspace.mjs), the PGlite validator (scripts/validate/fs13-keyspace.mjs), the LocalBackend RPCs and the
 * pages all load this file. The SQL mirror is kafaa_fk_* / kafaa_future_radar in supabase/migrations/20261010213001_kafaa_fs13_keyspace.sql.
 *
 * Keyspace. Three key families used to live side by side without joining: ADVANCE skills (adv_skills, `as-*`), the radar keys of
 * future_skills.skill_key and the gap-plan keys of skill_gap_plans.skill_key (free strings such as "liquid-metal"). Every one of them
 * now resolves, through future_skill_map, to at least one catalogue skill (`sk-*`, F01). Each map row says how today's catalogue
 * skill carries into the future skill: `transfers` (carries over as it is), `adapts` (needs adapting) or `new` (the catalogue skill
 * names the new capability itself), and the level a person needs on it (need_level).
 *
 * Radar readiness (IAEA NG-T-3.10 step "assess the existing level of capability", computed instead of hand-entered):
 *   population   active ENEC staff (people.kind = 'staff', status = 'active'); contractors, applicants and leavers are out
 *   credit(p,k)  max over the key's active map rows of CREDIT[relation] when p holds sk at need_level or above, else 0
 *                CREDIT = transfers 1, adapts 0.5, new 1 (holding the new capability itself counts in full)
 *   readiness    100 x sum(credit) / population, one decimal; ready_n = people with credit > 0
 *   suppressed   when the population or ready_n is under MIN_GROUP_SIZE (10): value and count are withheld; the cell keeps an upper
 *                bound (readiness_max, what 9 fully ready people would score) so the gap can still be read as "at least"
 *   families     the same cell per job family (security, safeguards and cyber families are left out: career-path level only)
 * Demand stays scenario-specific (future_skills.value, SIMULATED, with a sourced assumption per row); readiness does not depend on
 * the scenario because it describes today's staff.
 */

export const RELATIONS = ['transfers', 'adapts', 'new'] as const;
export type Relation = (typeof RELATIONS)[number];
export const CREDIT: Record<Relation, number> = { transfers: 1, adapts: 0.5, new: 1 };
export const KEY_KINDS = ['adv_skill', 'radar', 'gap_plan'] as const;
export type KeyKind = (typeof KEY_KINDS)[number];
export const MIN_CELL = 10;
export const DEFAULT_TARGET_LEVEL = 2;
/** Families whose readiness is never broken out (security-sensitive roles appear at career-path level only). */
export const RESTRICTED_FAMILIES = ['security', 'safeguards', 'cyber'];
export const BENCHMARK_IDS = ['IAEA-WFP', 'ESCO'] as const;

export interface MapRow { id: string; key: string; key_kind: string; sk_id: string; relation: string; need_level: number; primary_sk?: boolean; active?: boolean; sort?: number; note_en?: string; note_ar?: string }
export interface FutureSkillRow { id: string; skill_key: string; skill_en: string; skill_ar: string; scenario: string; value: number | string; tech_ids?: string[]; sk_id?: string | null; target_level?: number | null; assumption_en?: string; assumption_ar?: string; sources?: unknown }
export interface PersonLite { id: string; kind: string; status: string; job_family_id?: string | null }
export interface StateLite { person_id: string; skill_id: string; level: number | string; active?: boolean | null }
export interface SkillLite { id: string; area: string; name_en: string; name_ar: string }
export interface ReasonLite { code: string; key: string; vars?: Record<string, string | number | { en: string; ar: string }> }

export interface RadarCell {
  key: string; skill_en: string; skill_ar: string; tech_ids: string[]; sk_id: string | null; sk_ids: string[];
  target_level: number; demand: number; population: number;
  readiness: number | null; ready_n: number | null; suppressed: boolean; readiness_max: number | null;
  assumption_en: string; assumption_ar: string; sources: unknown;
}
export interface FamilyCell { key: string; readiness: number | null; suppressed: boolean }
export interface FamilyRow { family_id: string; n: number | null; suppressed: boolean; cells: FamilyCell[] }
export interface FutureRadar { scenario: string; population: number; rows: RadarCell[]; families: FamilyRow[] }

const r1 = (x: number) => Math.round(x * 10) / 10;
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
export const mapId = (key: string, sk: string) => `fsm:${key}:${sk}`;

/** Active map rows of one key, primary first, then by sort and skill id. */
export function rowsOf(map: MapRow[], key: string): MapRow[] {
  return map.filter((m) => m.key === key && m.active !== false).sort((a, b) => Number(!!b.primary_sk) - Number(!!a.primary_sk) || (a.sort ?? 0) - (b.sort ?? 0) || cmp(a.sk_id, b.sk_id));
}
/** The catalogue skill a key resolves to (primary row first); null when the key does not resolve. */
export function resolveSk(map: MapRow[], key: string): string | null {
  return rowsOf(map, key)[0]?.sk_id ?? null;
}
/** Credit of one person for one key: max over the key's rows of CREDIT[relation] when the level meets need_level. */
export function creditOf(rows: MapRow[], levels: Map<string, number>): number {
  let c = 0;
  for (const m of rows) if ((levels.get(m.sk_id) ?? 0) >= Number(m.need_level)) c = Math.max(c, CREDIT[m.relation as Relation] ?? 0);
  return c;
}

/** Share of a population at the target level (credit-weighted), one decimal, suppressed under MIN_CELL people. */
export function cell(credits: number[], population: number, min = MIN_CELL) {
  const ready = credits.filter((c) => c > 0).length;
  const twice = credits.reduce((s, c) => s + Math.round(c * 2), 0); // credits are multiples of 0.5: exact integer arithmetic
  const sup = population < min || ready < min;
  return {
    readiness: sup ? null : (population ? Math.round((500 * twice) / population) / 10 : 0),
    ready_n: sup ? null : ready,
    suppressed: sup,
    readiness_max: sup ? (population ? r1((100 * (min - 1)) / population) : null) : null,
  };
}

export interface RadarInput { futureSkills: FutureSkillRow[]; map: MapRow[]; people: PersonLite[]; states: StateLite[] }

/** The computed radar for one scenario (TS mirror of SQL kafaa_future_radar). */
export function futureRadar(inp: RadarInput, scenario: string, min = MIN_CELL): FutureRadar {
  const staff = inp.people.filter((p) => p.kind === 'staff' && p.status === 'active');
  const staffIds = new Set(staff.map((p) => p.id));
  const levels = new Map<string, Map<string, number>>();
  for (const s of inp.states) {
    if (s.active === false || !staffIds.has(s.person_id)) continue;
    (levels.get(s.person_id) ?? levels.set(s.person_id, new Map()).get(s.person_id)!).set(s.skill_id, Number(s.level));
  }
  const none = new Map<string, number>();
  const rows = inp.futureSkills.filter((f) => f.scenario === scenario).sort((a, b) => cmp(a.skill_key, b.skill_key));
  const keys = rows.map((r) => r.skill_key);
  const credits = new Map(keys.map((k) => {
    const mr = rowsOf(inp.map, k);
    return [k, new Map(staff.map((p) => [p.id, creditOf(mr, levels.get(p.id) ?? none)]))] as const;
  }));
  const out: RadarCell[] = rows.map((f) => {
    const mr = rowsOf(inp.map, f.skill_key);
    const c = cell([...credits.get(f.skill_key)!.values()], staff.length, min);
    const tl = Number(f.target_level ?? DEFAULT_TARGET_LEVEL);
    return {
      key: f.skill_key, skill_en: f.skill_en, skill_ar: f.skill_ar, tech_ids: f.tech_ids ?? [], sk_id: f.sk_id ?? resolveSk(inp.map, f.skill_key),
      sk_ids: mr.map((m) => m.sk_id), target_level: tl, demand: Number(f.value), population: staff.length, ...c,
      assumption_en: f.assumption_en ?? '', assumption_ar: f.assumption_ar ?? '', sources: f.sources ?? [],
    };
  });
  const fams = [...new Set(staff.map((p) => p.job_family_id).filter((x): x is string => !!x && !RESTRICTED_FAMILIES.includes(x)))].sort(cmp);
  const families: FamilyRow[] = fams.map((fid) => {
    const members = staff.filter((p) => p.job_family_id === fid);
    const n = members.length;
    return {
      family_id: fid, n: n < min ? null : n, suppressed: n < min,
      cells: keys.map((k) => {
        const cr = credits.get(k)!;
        const c = cell(members.map((p) => cr.get(p.id) ?? 0), n, min);
        return { key: k, readiness: c.readiness, suppressed: c.suppressed };
      }),
    };
  });
  return { scenario, population: staff.length, rows: out, families };
}

/** "Why this?" reasons for one radar cell (i18n keys m11.why.*), built from the cell and the key's map rows. */
export function cellReasons(c: Pick<RadarCell, 'key' | 'population' | 'readiness' | 'ready_n' | 'suppressed' | 'readiness_max' | 'demand'>, map: MapRow[], skills: SkillLite[], min = MIN_CELL): ReasonLite[] {
  const name = new Map(skills.map((s) => [s.id, s]));
  return [
    { code: 'population', key: 'm11.why.population', vars: { n: c.population } },
    ...rowsOf(map, c.key).map((m): ReasonLite => {
      const s = name.get(m.sk_id);
      return { code: `map:${m.relation}`, key: `m11.why.${m.relation}`, vars: { skill: { en: s?.name_en ?? m.sk_id, ar: s?.name_ar ?? m.sk_id }, level: Number(m.need_level), credit: CREDIT[m.relation as Relation] ?? 0 } };
    }),
    c.suppressed
      ? { code: 'suppressed', key: 'm11.why.suppressed', vars: { min, max: c.readiness_max ?? 0 } }
      : { code: 'share', key: 'm11.why.share', vars: { n: c.ready_n ?? 0, pct: c.readiness ?? 0 } },
    { code: 'demand', key: 'm11.why.demand', vars: { value: c.demand } },
  ];
}

/** Gap between demand and readiness; a suppressed readiness gives a lower bound (demand minus the cell's upper bound). */
export function radarGap(demand: number, readiness: number | null, readinessMax: number | null): { gap: number; atLeast: boolean } {
  if (readiness == null) return { gap: Math.max(0, r1(demand - (readinessMax ?? 0))), atLeast: true };
  return { gap: Math.max(0, r1(demand - readiness)), atLeast: false };
}

/** Keys that do not resolve to a catalogue skill: every ADVANCE skill, radar key and gap-plan key must resolve (acceptance). */
export function unresolvedKeys(d: { advSkills: { id: string }[]; futureSkills: { skill_key: string }[]; plans: { skill_key: string; sk_id?: string | null }[]; map: MapRow[]; skills: { id: string }[] }): string[] {
  const known = new Set(d.skills.map((s) => s.id));
  const ok = (k: string) => rowsOf(d.map, k).some((m) => known.has(m.sk_id));
  const keys = new Set<string>([...d.advSkills.map((a) => a.id), ...d.futureSkills.map((f) => f.skill_key), ...d.plans.filter((p) => !p.skill_key.startsWith('sk-')).map((p) => p.skill_key)]);
  const bad = [...keys].filter((k) => !ok(k));
  for (const p of d.plans) if (p.skill_key.startsWith('sk-') && !known.has(p.skill_key)) bad.push(p.skill_key);
  return bad.sort(cmp);
}

/** Number of radar keys whose demand differs between two scenarios (acceptance: at least 6 of 8). */
export function scenarioDifferences(futureSkills: FutureSkillRow[], a: string, b: string): { differ: number; total: number } {
  const va = new Map(futureSkills.filter((f) => f.scenario === a).map((f) => [f.skill_key, Number(f.value)]));
  const vb = new Map(futureSkills.filter((f) => f.scenario === b).map((f) => [f.skill_key, Number(f.value)]));
  const keys = [...new Set([...va.keys(), ...vb.keys()])];
  return { differ: keys.filter((k) => va.get(k) !== vb.get(k)).length, total: keys.length };
}

/** Validation for an admin map edit (TS mirror of kafaa_save_future_skill_map). Returns problem codes. */
export function mapProblems(p: { key?: string; key_kind?: string; sk_id?: string; relation?: string; need_level?: number }): string[] {
  const out: string[] = [];
  if (!p.key || !/^[a-z0-9][a-z0-9-]{1,63}$/.test(p.key)) out.push('key');
  if (!KEY_KINDS.includes(p.key_kind as KeyKind)) out.push('key_kind');
  if (!p.sk_id || !/^sk-[a-z0-9-]+$/.test(p.sk_id)) out.push('sk_id');
  if (!RELATIONS.includes(p.relation as Relation)) out.push('relation');
  const n = Number(p.need_level);
  if (!Number.isInteger(n) || n < 1 || n > 4) out.push('need_level');
  return out;
}
