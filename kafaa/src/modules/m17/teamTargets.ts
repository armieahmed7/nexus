/**
 * FS84 Team 2030 capability targets and an organisation skills inventory (future-skills wave I · E5, M17 Skills Passport).
 * Pure rules shared by the pages, the LocalBackend RPCs (backend/local.fs9.ts), the seed builder (scripts/seed/ext/fs84-team-targets.mjs),
 * the unit tests and the PGlite validator. Mirrored 1:1 by SQL in supabase/migrations/20261010295001_kafaa_fs95_team_targets_inventory.sql:
 *
 *   reqsOf()            = kafaa_tt_reqs          one FS05 profile version as skills: a competency requirement is its core skill (the first
 *                                                core skill by id), the highest level wins, security skills and unknown ids are left out,
 *                                                a path-only version has none
 *   publishedVersion()  = kafaa_tt_version       the published version of a role and horizon (highest version number, then id)
 *   roleNeed()          = kafaa_tt_need          what one role needs at a horizon: 2030 = its published 2030 profile; 2028 = the straight line
 *                                                from today's profile to the 2030 one, half-way and rounded up (n + ceil((l2030 - n) / 2) when
 *                                                the 2030 level is higher, else the 2030 level). A planning assumption, never a decision.
 *   futureTargets()     = kafaa_tt_derive        the team targets of a group at a horizon: per skill, the level most of the group's roles ask
 *                                                for (ties to the higher level) and how many people need at least that level; holders now
 *                                                (counted evidence only: verified, evidenced, validated), the gap, covered / thin / uncovered,
 *                                                new or raised against today's profile, the role-profile versions each target came from, the
 *                                                stored (adopted) target and whether it still matches; each member's readiness against their own
 *                                                role's profile (people mode only). Aggregate callers see a group under 10 suppressed.
 *   orgInventory()      = kafaa_tt_inventory     every non-security skill by area and by entity (or job family): people holding it at its key
 *                                                level with counted evidence; every cell under 10 is suppressed; security, safeguards and cyber
 *                                                families are never broken out
 *   dataQuality()       = kafaa_tt_quality       profile coverage (staff with a skills profile; role requirements with a recorded state),
 *                                                staleness (FS03: the newest evidence past its half-life; FS54: the skill definition past its
 *                                                review date) and the share validated (verified by a qualification or validated by a manager or
 *                                                peer), overall and per entity or family; any count naming fewer than 10 people is suppressed
 * Nobody is ranked: targets are ordered by gap, members by id. Import-free apart from type imports (node scripts load this file).
 */
import type { Reason } from '../../domain/engines/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

export const FT_HORIZONS = ['2028', '2030'] as const;
export type FtHorizon = (typeof FT_HORIZONS)[number];
/** team_skill_targets.horizon: 'current' is the F11 coverage target (default); 2028 and 2030 are adopted FS84 targets. */
export const TARGET_HORIZONS = ['current', '2028', '2030'] as const;
export const COUNTED = ['verified', 'evidenced', 'validated'];
export const TT_MIN = 10;
export const NO_BREAKOUT = ['security', 'safeguards', 'cyber'];
export const INV_DIMS = ['entity', 'family'] as const;
export type InvDim = (typeof INV_DIMS)[number];
export const NOTE_MAX = 300;
export const futureTargetId = (h: string, group: string, skill: string) => `tst:${h}:${group}:${skill}`;
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
/** Round half up of 100 n / d in integers (SQL: (200 n + d) / (2 d) with integer division). */
export const pctOf = (n: number, d: number): number | null => (d > 0 ? Math.floor((200 * n + d) / (2 * d)) : null);
export const isFtHorizon = (h: unknown): h is FtHorizon => h === '2028' || h === '2030';

export const TT_MSG = {
  not_signed_in: 'Sign in to set team targets',
  forbidden: 'Only a manager in scope or the training manager can adopt team targets',
  invalid_group: 'Unknown team or group',
  invalid_horizon: 'Choose the 2028 or the 2030 horizon',
  no_profile: 'No published 2030 role profile covers this group, so there is nothing to adopt',
  adopted: 'Team targets adopted from the role profiles',
  unchanged: 'The team targets already match the role profiles',
  inventory_forbidden: "Kafa'a · the organisation skills inventory is aggregate-only (HR) and restricted",
} as const;

// ───────────── FS05 profiles as skill needs
export interface TtCtx { core: Map<string, string>; known: Set<string>; restricted: Set<string>; versions: Row[]; sort: Map<string, number>; area: Map<string, string>; keyLevel: Map<string, number>; reviewDue: Map<string, string | null> }
export function ttCtx(w: { skills: Row[]; competencies: Row[]; role_profile_versions: Row[] }): TtCtx {
  const secComps = new Set(w.competencies.filter((c) => c.domain === 'security').map((c) => String(c.id)));
  const byId = [...w.skills].sort((a, b) => cmp(String(a.id), String(b.id)));
  const core = new Map<string, string>();
  for (const s of byId) if (s.core === true && s.competency_id && !core.has(String(s.competency_id))) core.set(String(s.competency_id), String(s.id));
  return {
    core,
    known: new Set(w.skills.map((s) => String(s.id))),
    restricted: new Set(w.skills.filter((s) => s.area === 'security' || secComps.has(String(s.competency_id))).map((s) => String(s.id))),
    versions: w.role_profile_versions,
    sort: new Map(w.skills.map((s) => [String(s.id), Number(s.sort ?? 0)])),
    area: new Map(w.skills.map((s) => [String(s.id), String(s.area)])),
    keyLevel: new Map(w.skills.map((s) => [String(s.id), Number(s.key_level)])),
    reviewDue: new Map(w.skills.map((s) => [String(s.id), s.review_due ? String(s.review_due).slice(0, 10) : null])),
  };
}
export function publishedVersion(versions: Row[], roleId: string | null | undefined, horizon: string): Row | null {
  if (!roleId) return null;
  return versions.filter((v) => v.role_id === roleId && v.horizon === horizon && v.status === 'published')
    .sort((a, b) => Number(b.version) - Number(a.version) || cmp(String(a.id), String(b.id)))[0] ?? null;
}
export function reqsOf(version: Row | null, c: TtCtx): Map<string, number> {
  const m = new Map<string, number>();
  if (!version || version.path_only === true) return m;
  for (const r of (Array.isArray(version.requirements) ? version.requirements : []) as Row[]) {
    const sid = r?.kind === 'competency' ? c.core.get(String(r.ref_id)) : r?.kind === 'skill' ? String(r.ref_id) : undefined;
    const lv = typeof r?.level === 'number' ? r.level : NaN;
    if (!sid || !c.known.has(sid) || c.restricted.has(sid) || !Number.isInteger(lv) || lv < 1) continue;
    m.set(sid, Math.max(m.get(sid) ?? 0, lv));
  }
  return m;
}
export type NeedStatus = 'ok' | 'no_role' | 'no_profile' | 'path_only';
export interface RoleNeed { status: NeedStatus; v2030: { id: string; version: number } | null; vnow: { id: string; version: number } | null; needs: Map<string, number>; now: Map<string, number> }
/** 2028 = half-way from today's level to the 2030 level, rounded up (only where 2030 asks for more). */
export const level2028 = (now: number, l2030: number) => (l2030 > now ? now + Math.ceil((l2030 - now) / 2) : l2030);
export function roleNeed(roleId: string | null | undefined, horizon: FtHorizon, c: TtCtx): RoleNeed {
  if (!roleId) return { status: 'no_role', v2030: null, vnow: null, needs: new Map(), now: new Map() };
  const v30 = publishedVersion(c.versions, roleId, '2030');
  const vn = publishedVersion(c.versions, roleId, 'now');
  const ref = (v: Row | null) => (v ? { id: String(v.id), version: Number(v.version) } : null);
  if (!v30) return { status: 'no_profile', v2030: null, vnow: ref(vn), needs: new Map(), now: new Map() };
  if (v30.path_only === true) return { status: 'path_only', v2030: ref(v30), vnow: ref(vn), needs: new Map(), now: new Map() };
  const r30 = reqsOf(v30, c);
  const rn = reqsOf(vn, c);
  const needs = new Map<string, number>();
  for (const [s, l] of r30) needs.set(s, horizon === '2030' ? l : level2028(rn.get(s) ?? 0, l));
  return { status: 'ok', v2030: ref(v30), vnow: ref(vn), needs, now: rn };
}

// ───────────── FS84 team targets (kafaa_tt_derive)
export interface MemberLite { id: string; job_role_id?: string | null }
export interface StateLite { person_id: string; skill_id: string; level: number; basis: string; active?: boolean | null }
export interface StoredTarget { id: string; team_id: string; skill_id: string; min_people: number; min_level: number; active?: boolean | null; horizon?: string | null; profile_version_ids?: string[] | null; set_by?: string | null; updated_at?: string | null; note?: string | null }
export interface Adopted { skill_id: string; min_people: number; min_level: number; versions: string[]; set_by: string | null; updated_at: string | null; note: string | null }
export interface FtRole { role_id: string; level: number; people: number | null; version_id: string; version: number; now_level: number; now_version_id: string | null }
export type FtStatus = 'covered' | 'thin' | 'uncovered' | 'suppressed';
export interface FtTarget {
  skill_id: string; min_level: number; min_people: number | null; n: number | null; gap: number | null; status: FtStatus;
  change: 'new' | 'raised' | 'kept'; roles: FtRole[]; versions: string[]; holders?: string[]; adopted: Adopted | null; changed: boolean;
}
export interface FtMember { id: string; role_id: string | null; status: NeedStatus; need: number; have: number; pct: number | null; gaps: number; top: string[] }
export interface FutureTargets {
  horizon: FtHorizon; group: string | null; size: number; suppressed: boolean; profiled: number | null; no_profile: number | null; path_only: number | null;
  targets: FtTarget[]; members: FtMember[]; retired: Adopted[]; adopted_at: string | null; adopted_by: string | null;
  summary: { targets: number; covered: number | null; thin: number | null; uncovered: number | null; gap: number | null; new_skills: number; raised: number; readiness: number | null };
}
export const adoptedOf = (t: StoredTarget): Adopted => ({
  skill_id: t.skill_id, min_people: Number(t.min_people), min_level: Number(t.min_level), versions: [...(t.profile_version_ids ?? [])].sort(cmp),
  set_by: t.set_by ?? null, updated_at: t.updated_at ?? null, note: t.note ?? null,
});
export const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
/** Mode of the levels, ties to the higher level. */
export function modeLevel(levels: number[]): number {
  const c = new Map<number, number>();
  for (const l of levels) c.set(l, (c.get(l) ?? 0) + 1);
  return [...c].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
}
export function futureTargets(i: {
  ctx: TtCtx; horizon: FtHorizon; group: string | null; members: MemberLite[]; states: StateLite[]; stored: StoredTarget[];
  /** people mode (Scope/R/W/A: holders and members named) or aggregate (Agg: counts only, a group under 10 suppressed) */
  people: boolean;
}): FutureTargets {
  const { ctx: c, horizon } = i;
  const mem = [...i.members].sort((a, b) => cmp(a.id, b.id));
  const ids = new Set(mem.map((m) => m.id));
  const size = mem.length;
  const supp = !i.people && size < TT_MIN;
  const have = new Map<string, number>();
  for (const s of i.states) {
    if (!ids.has(s.person_id) || s.active === false || !(Number(s.level) > 0) || !COUNTED.includes(s.basis)) continue;
    const k = `${s.person_id}|${s.skill_id}`;
    have.set(k, Math.max(have.get(k) ?? 0, Number(s.level)));
  }
  const lvl = (p: string, s: string) => have.get(`${p}|${s}`) ?? 0;
  const needOf = new Map<string, RoleNeed>();
  const nd = (role: string | null | undefined) => { const k = role ?? ''; if (!needOf.has(k)) needOf.set(k, roleNeed(role, horizon, c)); return needOf.get(k)!; };
  // per skill: the members who need it
  const bySkill = new Map<string, { person: string; role: string; level: number; now: number }[]>();
  const members: FtMember[] = [];
  let tNeed = 0, tHave = 0, nOk = 0, nNo = 0, nPath = 0;
  for (const m of mem) {
    const r = nd(m.job_role_id);
    if (r.status === 'ok') nOk++; else if (r.status === 'path_only') nPath++; else nNo++;
    let need = 0, got = 0;
    const short: { s: string; d: number }[] = [];
    for (const [s, l] of r.needs) {
      (bySkill.get(s) ?? bySkill.set(s, []).get(s)!).push({ person: m.id, role: String(m.job_role_id), level: l, now: r.now.get(s) ?? 0 });
      const h = Math.min(lvl(m.id, s), l);
      need += l; got += h;
      if (h < l) short.push({ s, d: l - h });
    }
    tNeed += need; tHave += got;
    if (i.people) members.push({
      id: m.id, role_id: m.job_role_id ?? null, status: r.status, need, have: got, pct: pctOf(got, need), gaps: short.length,
      top: short.sort((a, b) => b.d - a.d || cmp(a.s, b.s)).slice(0, 3).map((x) => x.s),
    });
  }
  const stored = i.stored.filter((t) => t.active !== false && t.horizon === horizon && i.group != null && t.team_id === i.group);
  const storedBy = new Map(stored.map((t) => [t.skill_id, t]));
  const targets: FtTarget[] = [];
  for (const [s, list] of bySkill) {
    const min_level = modeLevel(list.map((x) => x.level));
    const min_people = list.filter((x) => x.level >= min_level).length;
    const holders = mem.filter((m) => lvl(m.id, s) >= min_level).map((m) => m.id);
    const n = holders.length;
    const roleIds = [...new Set(list.map((x) => x.role))].sort(cmp);
    const roles: FtRole[] = roleIds.map((rid) => {
      const r = nd(rid);
      const x = list.find((y) => y.role === rid)!;
      return { role_id: rid, level: x.level, people: supp ? null : list.filter((y) => y.role === rid).length, version_id: r.v2030!.id, version: r.v2030!.version, now_level: x.now, now_version_id: r.vnow?.id ?? null };
    });
    const versions = [...new Set(roles.flatMap((r) => (horizon === '2028' && r.now_version_id ? [r.version_id, r.now_version_id] : [r.version_id])))].sort(cmp);
    const st = storedBy.get(s);
    const adopted = st ? adoptedOf(st) : null;
    const t: FtTarget = {
      skill_id: s, min_level, min_people: supp ? null : min_people, n: supp ? null : n, gap: supp ? null : Math.max(0, min_people - n),
      status: supp ? 'suppressed' : n >= min_people ? 'covered' : n === 0 ? 'uncovered' : 'thin',
      change: list.every((x) => x.now === 0) ? 'new' : list.some((x) => x.level > x.now) ? 'raised' : 'kept',
      roles, versions, adopted,
      changed: !!adopted && (adopted.min_people !== min_people || adopted.min_level !== min_level || !sameList(adopted.versions, versions)),
    };
    if (i.people) t.holders = holders;
    targets.push(t);
  }
  targets.sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0) || (b.min_people ?? 0) - (a.min_people ?? 0) || (c.sort.get(a.skill_id) ?? 0) - (c.sort.get(b.skill_id) ?? 0) || cmp(a.skill_id, b.skill_id));
  const derived = new Set(targets.map((t) => t.skill_id));
  const retired = stored.filter((t) => !derived.has(t.skill_id)).map(adoptedOf).sort((a, b) => cmp(a.skill_id, b.skill_id));
  const last = [...stored].sort((a, b) => cmp(String(b.updated_at ?? ''), String(a.updated_at ?? '')) || cmp(a.id, b.id))[0];
  return {
    horizon, group: i.group, size, suppressed: supp,
    profiled: supp ? null : nOk, no_profile: supp ? null : nNo, path_only: supp ? null : nPath,
    targets, members, retired, adopted_at: last?.updated_at ?? null, adopted_by: last?.set_by ?? null,
    summary: {
      targets: targets.length,
      covered: supp ? null : targets.filter((t) => t.status === 'covered').length,
      thin: supp ? null : targets.filter((t) => t.status === 'thin').length,
      uncovered: supp ? null : targets.filter((t) => t.status === 'uncovered').length,
      gap: supp ? null : targets.reduce((x, t) => x + (t.gap ?? 0), 0),
      new_skills: targets.filter((t) => t.change === 'new').length,
      raised: targets.filter((t) => t.change === 'raised').length,
      readiness: supp ? null : pctOf(tHave, tNeed),
    },
  };
}
/** What adoptFutureTargets writes: the rows to insert or update (only the ones that differ) and the stored rows to switch off. */
export function adoptPlan(ft: FutureTargets): { write: FtTarget[]; retire: string[]; kept: number } {
  const write = ft.targets.filter((t) => !t.adopted || t.changed);
  return { write, retire: ft.retired.map((r) => r.skill_id), kept: ft.targets.length - write.length };
}
/** "Why this target?" for <WhyThis>: the rule, then one line per role that asks for it (title, level, profile version). */
export function targetReasons(t: FtTarget, horizon: FtHorizon, roleName: (id: string) => { en: string; ar: string }): Reason[] {
  const out: Reason[] = [{ code: 'tt_rule', key: `m17.tt.why.rule_${horizon}`, vars: { level: t.min_level, people: t.min_people ?? '—' } }];
  for (const r of t.roles) out.push({ code: 'tt_role', key: horizon === '2028' ? 'm17.tt.why.role_2028' : 'm17.tt.why.role', vars: { role: roleName(r.role_id), level: r.level, now: r.now_level, version: r.version }, ref: { table: 'role_profile_versions', id: r.version_id } });
  if (t.change === 'new') out.push({ code: 'tt_new', key: 'm17.tt.why.new' });
  if (t.n != null) out.push({ code: 'tt_holders', key: 'm17.tt.why.holders', vars: { n: t.n, gap: t.gap ?? 0 } });
  return out;
}

// ───────────── organisation inventory (kafaa_tt_inventory) and data quality (kafaa_tt_quality)
export interface InvPerson { id: string; kind?: string; status?: string; entity_id?: string | null; job_family_id?: string | null; job_role_id?: string | null }
export interface InvState { person_id: string; skill_id: string; level: number; basis: string; active?: boolean | null; reasons?: unknown }
export interface InvCell { g: string; n: number | null; pct: number | null }
export interface InvTotal { n: number | null; pct: number | null }
export interface OrgInventory {
  dim: InvDim; as_of: string; staff: number;
  groups: { id: string; staff: number | null }[];
  areas: { area: string; skills: number; total: InvTotal; cells: InvCell[] }[];
  skills: { skill_id: string; area: string; total: InvTotal; cells: InvCell[] }[];
}
export interface QualityRow { g: string; staff: number | null; profiled_pct: number | null; req_pct: number | null; stale_pct: number | null; validated_pct: number | null }
export interface DataQuality {
  as_of: string; staff: number; profiled: number | null; profiled_pct: number | null;
  req_total: number | null; req_recorded: number | null; req_pct: number | null;
  states: number | null; ageing: number | null; review_overdue: number | null; stale: number | null; stale_pct: number | null; overdue_skills: number;
  validated: number | null; validated_pct: number | null;
  basis: { verified: number | null; evidenced: number | null; validated: number | null; claimed: number | null };
  by_group: QualityRow[];
}
export const isActiveStaff = (p: InvPerson) => p.kind === 'staff' && p.status === 'active';
export const groupOf = (p: InvPerson, dim: InvDim): string | null => {
  const g = dim === 'entity' ? p.entity_id : p.job_family_id;
  return g && !(dim === 'family' && NO_BREAKOUT.includes(g)) ? g : null;
};
const gate = (n: number, people: number) => (people < TT_MIN ? null : n);
export function orgInventory(i: { ctx: TtCtx; skills: Row[]; people: InvPerson[]; states: InvState[]; dim: InvDim; today: string }): OrgInventory {
  const c = i.ctx;
  const staff = i.people.filter(isActiveStaff).sort((a, b) => cmp(a.id, b.id));
  const gOf = new Map(staff.map((p) => [p.id, groupOf(p, i.dim)]));
  const gIds = [...new Set(staff.map((p) => gOf.get(p.id)).filter((g): g is string => !!g))].sort(cmp);
  const gStaff = new Map(gIds.map((g) => [g, staff.filter((p) => gOf.get(p.id) === g).length]));
  const skills = i.skills.filter((s) => !c.restricted.has(String(s.id))).sort((a, b) => cmp(String(a.area), String(b.area)) || Number(a.sort ?? 0) - Number(b.sort ?? 0) || cmp(String(a.id), String(b.id)));
  const holders = new Map<string, Set<string>>(); // skill -> people at key level with counted evidence
  for (const s of i.states) {
    if (!gOf.has(s.person_id) || s.active === false || !COUNTED.includes(s.basis) || c.restricted.has(s.skill_id) || !c.known.has(s.skill_id)) continue;
    if (Number(s.level) >= (c.keyLevel.get(s.skill_id) ?? 99)) (holders.get(s.skill_id) ?? holders.set(s.skill_id, new Set()).get(s.skill_id)!).add(s.person_id);
  }
  const cellsOf = (who: Set<string>): { total: InvTotal; cells: InvCell[] } => {
    const tn = who.size;
    return {
      total: { n: tn < TT_MIN ? null : tn, pct: tn < TT_MIN ? null : pctOf(tn, staff.length) },
      cells: gIds.map((g) => {
        const gs = gStaff.get(g)!;
        const n = [...who].filter((p) => gOf.get(p) === g).length;
        return gs < TT_MIN || n < TT_MIN ? { g, n: null, pct: null } : { g, n, pct: pctOf(n, gs) };
      }),
    };
  };
  const areaIds = [...new Set(skills.map((s) => String(s.area)))].sort(cmp);
  return {
    dim: i.dim, as_of: i.today, staff: staff.length,
    groups: gIds.map((g) => ({ id: g, staff: gStaff.get(g)! < TT_MIN ? null : gStaff.get(g)! })),
    areas: areaIds.map((a) => {
      const ss = skills.filter((s) => String(s.area) === a);
      const who = new Set<string>();
      for (const s of ss) for (const p of holders.get(String(s.id)) ?? []) who.add(p);
      return { area: a, skills: ss.length, ...cellsOf(who) };
    }),
    skills: skills.map((s) => ({ skill_id: String(s.id), area: String(s.area), ...cellsOf(holders.get(String(s.id)) ?? new Set()) })),
  };
}
export const isAgeing = (reasons: unknown) => Array.isArray(reasons) && !!reasons[0] && (reasons[0] as Row).ageing === true;
export const reviewOverdue = (due: string | null | undefined, today: string) => !!due && String(due).slice(0, 10) < today;
export function dataQuality(i: { ctx: TtCtx; skills: Row[]; people: InvPerson[]; states: InvState[]; dim: InvDim; today: string }): DataQuality {
  const c = i.ctx;
  const staff = i.people.filter(isActiveStaff).sort((a, b) => cmp(a.id, b.id));
  const sIds = new Set(staff.map((p) => p.id));
  const st = i.states.filter((s) => sIds.has(s.person_id) && s.active !== false && Number(s.level) > 0 && s.basis !== 'none' && c.known.has(s.skill_id) && !c.restricted.has(s.skill_id))
    .map((s) => ({ p: s.person_id, s: s.skill_id, b: s.basis, age: isAgeing(s.reasons), rev: reviewOverdue(c.reviewDue.get(s.skill_id), i.today) }));
  const has = new Set(st.map((x) => `${x.p}|${x.s}`));
  const reqOf = new Map<string, string[]>();
  const reqs = (role: string | null | undefined) => {
    const k = role ?? '';
    if (!reqOf.has(k)) reqOf.set(k, [...reqsOf(publishedVersion(c.versions, role, 'now'), c).keys()]);
    return reqOf.get(k)!;
  };
  const block = (who: InvPerson[]) => {
    const ids = new Set(who.map((p) => p.id));
    const mine = st.filter((x) => ids.has(x.p));
    const ppl = (rows: typeof st) => new Set(rows.map((x) => x.p)).size;
    const profiled = ppl(mine);
    let rt = 0, rr = 0, rp = 0;
    for (const p of who) {
      const r = reqs(p.job_role_id);
      if (!r.length) continue;
      rp++; rt += r.length; rr += r.filter((s) => has.has(`${p.id}|${s}`)).length;
    }
    const sub = (f: (x: (typeof st)[number]) => boolean) => { const rows = mine.filter(f); return gate(rows.length, ppl(rows)); };
    const stale = sub((x) => x.age || x.rev);
    const validated = sub((x) => x.b === 'verified' || x.b === 'validated');
    const states = gate(mine.length, profiled);
    return {
      staff: who.length, profiled: gate(profiled, profiled), states,
      req_total: gate(rt, rp), req_recorded: gate(rr, rp),
      ageing: sub((x) => x.age), review_overdue: sub((x) => x.rev), stale, validated,
      basis: { verified: sub((x) => x.b === 'verified'), evidenced: sub((x) => x.b === 'evidenced'), validated: sub((x) => x.b === 'validated'), claimed: sub((x) => x.b === 'claimed') },
      profiled_pct: profiled < TT_MIN ? null : pctOf(profiled, who.length),
      req_pct: rp < TT_MIN ? null : pctOf(rr, rt),
      stale_pct: stale == null || states == null ? null : pctOf(stale, states),
      validated_pct: validated == null || states == null ? null : pctOf(validated, states),
    };
  };
  const all = block(staff);
  const gIds = [...new Set(staff.map((p) => groupOf(p, i.dim)).filter((g): g is string => !!g))].sort(cmp);
  return {
    as_of: i.today, staff: all.staff, profiled: all.profiled, profiled_pct: all.profiled_pct,
    req_total: all.req_total, req_recorded: all.req_recorded, req_pct: all.req_pct,
    states: all.states, ageing: all.ageing, review_overdue: all.review_overdue, stale: all.stale, stale_pct: all.stale_pct,
    overdue_skills: i.skills.filter((s) => !c.restricted.has(String(s.id)) && reviewOverdue(s.review_due, i.today)).length,
    validated: all.validated, validated_pct: all.validated_pct, basis: all.basis,
    by_group: gIds.map((g) => {
      const who = staff.filter((p) => groupOf(p, i.dim) === g);
      if (who.length < TT_MIN) return { g, staff: null, profiled_pct: null, req_pct: null, stale_pct: null, validated_pct: null };
      const b = block(who);
      return { g, staff: b.staff, profiled_pct: b.profiled_pct, req_pct: b.req_pct, stale_pct: b.stale_pct, validated_pct: b.validated_pct };
    }),
  };
}
