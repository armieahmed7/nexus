/**
 * F09 Future Me: personal ADVANCE readiness, bridge plan, horizon lanes and closest concept roles.
 * Pure functions (no React, no repository): pages pass rows in, unit tests call them directly, and the LocalBackend RPC
 * reuses goalTarget(). The SQL mirror of goalTarget() is kafaa_set_future_goal in
 * supabase/migrations/20261009115001_kafaa_w1e5_future.sql. Change both together.
 *
 * Readiness index per technology family (SIMULATED, 0-100; ENEC is evaluating these technologies, no deployment decision
 * is implied):
 *   my level on an ADVANCE skill = the best level among the Kafa'a skills mapped to it (skills.adv_skill_ids) and the
 *                                  core skill of each mapped skill's competency (sk-<competency>); security-area skills never count
 *   credit = factor(relation) × min(level, 3) / 3      factor: transfers 1 · adapts 0.5 · new 0
 *   index  = 100 × Σ credit / number of ADVANCE skills in the family (one decimal)
 *   ceiling = 100 × Σ factor / n: the most today's APR-1400 skills can carry over; the rest is new learning
 *   overall = mean of the family indices (one decimal)
 */
import { byGapClosure } from '../../domain/engines/rank';
import type { BiText, Ranked, Reason, Weights } from '../../domain/engines/types';

export const TARGET_LEVEL = 3;
export const RELATION_FACTOR = { transfers: 1, adapts: 0.5, new: 0 } as const;
export type Relation = keyof typeof RELATION_FACTOR;
export { GOAL_KINDS, GOAL_TARGET_LEVEL, MAX_ACTIVE_GOALS, type GoalKind } from './goals';
/** Horizon lanes: now 2026-2028, next 2029-2031, later 2032-2035. */
export const HORIZONS = { now: [2026, 2028], next: [2029, 2031], later: [2032, 2035] } as const;

export interface AdvSkillLite { id: string; tech_id: string; relation: Relation | string; skill_en: string; skill_ar: string; sort?: number }
export interface SkillLite { id: string; competency_id: string; area: string; adv_skill_ids: string[]; name_en: string; name_ar: string }
export interface StateLite { skill_id: string; level: number; basis?: string; active?: boolean }
export interface TechLite { id: string; family_en: string; family_ar: string }
export interface BridgeLite { id: string; from_role_id: string; tech_id: string }
export interface EdgeLite { from_role_id?: string | null; to_role_id: string; type?: string }
export interface FutureRoleLite { id: string; title_en: string; title_ar: string; from_role_ids: string[]; skill_ids: string[]; tech_ids: string[] }
export interface LaneLite { id: string; title_en: string; title_ar: string; skill_ids: string[] }
export interface ResourceLite { id: string; tech_ids: string[]; adv_skill_ids: string[]; level: number; hours?: number | string | null }

const r1 = (x: number) => Math.round(x * 10) / 10;
const r4 = (x: number) => Math.round(x * 10000) / 10000;
const bi = (row: { [k: string]: unknown } | undefined, f: string, fallback: string): BiText => ({ en: String(row?.[`${f}_en`] ?? fallback), ar: String(row?.[`${f}_ar`] ?? row?.[`${f}_en`] ?? fallback) });
export const m21Reason = (code: string, vars?: Reason['vars'], ref?: Reason['ref'], weight?: number): Reason => ({ code, key: `m21.reasons.${code}`, vars, ref, weight });
export const factorOf = (relation: string) => (RELATION_FACTOR as Record<string, number>)[relation] ?? 0;

/** My level per Kafa'a skill (active states only). */
export function levelMap(states: StateLite[]): Map<string, StateLite> {
  const m = new Map<string, StateLite>();
  for (const s of states) if (s.active !== false && s.level > 0) m.set(s.skill_id, s);
  return m;
}

export interface AdvLevel { level: number; via: string | null; basis: string | null }
/** My level on each ADVANCE skill, with the Kafa'a skill it comes from. */
export function advLevels(advSkills: AdvSkillLite[], skills: SkillLite[], states: StateLite[]): Map<string, AdvLevel> {
  const mine = levelMap(states);
  const out = new Map<string, AdvLevel>();
  for (const a of advSkills) {
    let best: AdvLevel = { level: 0, via: null, basis: null };
    for (const s of skills) {
      if (s.area === 'security' || !s.adv_skill_ids.includes(a.id)) continue;
      for (const id of [s.id, `sk-${s.competency_id}`]) {
        const st = mine.get(id);
        if (st && (st.level > best.level || (st.level === best.level && best.via != null && id < best.via))) best = { level: st.level, via: id, basis: st.basis ?? null };
      }
    }
    out.set(a.id, best);
  }
  return out;
}

export interface ReadinessItem { adv_skill_id: string; relation: string; level: number; via: string | null; basis: string | null; factor: number; credit: number }
export interface FamilyReadiness { tech_id: string; index: number; ceiling: number; n: number; counts: Record<Relation, number>; items: ReadinessItem[]; reasons: Reason[] }

/** Readiness of one technology family from my ADVANCE-skill levels (see the formula at the top of this file). */
export function familyReadiness(techId: string, advSkills: AdvSkillLite[], levels: Map<string, AdvLevel>, labels?: { skills?: Record<string, BiText>; adv?: Record<string, BiText> }): FamilyReadiness {
  const list = advSkills.filter((a) => a.tech_id === techId);
  const counts: Record<Relation, number> = { transfers: 0, adapts: 0, new: 0 };
  const items: ReadinessItem[] = list.map((a) => {
    const lv = levels.get(a.id) ?? { level: 0, via: null, basis: null };
    const factor = factorOf(a.relation);
    if (a.relation in counts) counts[a.relation as Relation] += 1;
    return { adv_skill_id: a.id, relation: a.relation, level: lv.level, via: lv.via, basis: lv.basis, factor, credit: r4((factor * Math.min(lv.level, TARGET_LEVEL)) / TARGET_LEVEL) };
  });
  const n = items.length;
  const credit = items.reduce((s, i) => s + i.credit, 0);
  const ceil = items.reduce((s, i) => s + i.factor, 0);
  const index = n ? r1((100 * credit) / n) : 0;
  const ceiling = n ? r1((100 * ceil) / n) : 0;
  const reasons: Reason[] = [];
  const name = (id: string) => labels?.adv?.[id] ?? { en: id, ar: id };
  const via = (id: string | null) => (id ? labels?.skills?.[id] ?? { en: id, ar: id } : { en: '', ar: '' });
  for (const i of [...items].filter((x) => x.credit > 0).sort((a, b) => b.credit - a.credit || (a.adv_skill_id < b.adv_skill_id ? -1 : 1))) {
    reasons.push(m21Reason(i.relation === 'transfers' ? 'transfers' : 'adapts', { skill: name(i.adv_skill_id), via: via(i.via), level: i.level }, i.via ? { table: 'person_skills', id: i.via } : undefined, i.credit));
  }
  if (!reasons.length) reasons.push(m21Reason('no_carry', { n: counts.transfers + counts.adapts }));
  if (counts.new) reasons.push(m21Reason('new', { n: counts.new }));
  reasons.push(m21Reason('ceiling', { pct: ceiling }));
  return { tech_id: techId, index, ceiling, n, counts, items, reasons };
}

export interface Readiness { overall: number; ceiling: number; families: FamilyReadiness[]; levels: Map<string, AdvLevel> }
/** Readiness for every technology family plus the overall index (mean of the families). Deterministic. */
export function readinessIndex(techs: { id: string }[], advSkills: AdvSkillLite[], skills: SkillLite[], states: StateLite[], labels?: { skills?: Record<string, BiText>; adv?: Record<string, BiText> }): Readiness {
  const levels = advLevels(advSkills, skills, states);
  const families = techs.map((t) => familyReadiness(t.id, advSkills, levels, labels));
  const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
  return { overall: r1(mean(families.map((f) => f.index))), ceiling: r1(mean(families.map((f) => f.ceiling))), families, levels };
}

/** How close my current role is to a role: 0 same role, n = career-path steps either way (max 2), null = not linked. */
export function roleDistance(edges: EdgeLite[], from: string | null, to: string): number | null {
  if (!from) return null;
  if (from === to) return 0;
  const bfs = (a: string, b: string) => {
    const dist = new Map<string, number>([[a, 0]]);
    const q = [a];
    while (q.length) {
      const at = q.shift()!;
      if ((dist.get(at) ?? 0) >= 2) continue;
      for (const e of edges) if (e.from_role_id === at && !dist.has(e.to_role_id)) { dist.set(e.to_role_id, dist.get(at)! + 1); q.push(e.to_role_id); }
    }
    return dist.get(b) ?? null;
  };
  const d1 = bfs(from, to);
  const d2 = bfs(to, from);
  return d1 == null ? d2 : d2 == null ? d1 : Math.min(d1, d2);
}
export const roleFit = (d: number | null) => (d === 0 ? 1 : d != null ? 0.6 : 0.3);

export interface BridgeRank { bridge: BridgeLite; fit: number; distance: number | null; uplift: number; family: FamilyReadiness | undefined }
/**
 * Bridge plan: the skill bridges that move me most. score = role fit × (index points still available from my
 * transferable and adaptable skills + 5), role fit 1 (my role) · 0.6 (within two career steps) · 0.3 (other roles).
 */
export function rankBridges(input: { bridges: BridgeLite[]; families: FamilyReadiness[]; myRole: string | null; edges: EdgeLite[]; roleLabels?: Record<string, BiText>; techLabels?: Record<string, BiText> }): Ranked<BridgeRank>[] {
  const fam = new Map(input.families.map((f) => [f.tech_id, f]));
  const out: Ranked<BridgeRank>[] = [];
  for (const b of input.bridges) {
    const f = fam.get(b.tech_id);
    const distance = roleDistance(input.edges, input.myRole, b.from_role_id);
    const fit = roleFit(distance);
    const uplift = f ? r1(Math.max(0, f.ceiling - f.index)) : 0;
    const role = input.roleLabels?.[b.from_role_id] ?? { en: b.from_role_id, ar: b.from_role_id };
    const tech = input.techLabels?.[b.tech_id] ?? { en: b.tech_id, ar: b.tech_id };
    const reasons: Reason[] = [
      distance === 0 ? m21Reason('bridge_mine', { role }) : distance != null ? m21Reason('bridge_near', { role, n: distance }) : m21Reason('bridge_other', { role }),
      uplift > 0 ? m21Reason('bridge_uplift', { pts: uplift, tech }) : m21Reason('bridge_full', { tech }),
    ];
    if (f?.counts.new) reasons.push(m21Reason('new', { n: f.counts.new }));
    out.push({ id: b.id, score: r4(fit * (uplift + 5)), reasons, item: { bridge: b, fit, distance, uplift, family: f } });
  }
  return out.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
}
/** 3 to 5 bridges: every bridge at my role or near it (fit >= 0.6), at least 3 and at most 5. */
export function bridgePlan<T>(ranked: Ranked<T & { fit: number }>[]): Ranked<T & { fit: number }>[] {
  const near = ranked.filter((r) => (r.item?.fit ?? 0) >= 0.6).length;
  return ranked.slice(0, Math.min(5, Math.max(3, near)));
}

/** Resources (courses, ADVANCE tracks, partner programmes) ranked by how far they close my gaps in one family (F02 gap closure). */
export function rankResources<R extends ResourceLite>(resources: R[], family: FamilyReadiness, labels?: Record<string, BiText>, weights?: Weights): Ranked<R>[] {
  const imp: Record<string, 'core' | 'important' | 'useful'> = { transfers: 'core', adapts: 'important', new: 'useful' };
  const needs = family.items.map((i) => ({ key: i.adv_skill_id, need: TARGET_LEVEL, have: i.level, importance: imp[i.relation] ?? 'useful', weight: 1, label: labels?.[i.adv_skill_id] }));
  const keys = new Set(family.items.map((i) => i.adv_skill_id));
  const cands = resources
    .filter((r) => r.tech_ids.includes(family.tech_id) || r.adv_skill_ids.some((k) => keys.has(k)))
    .map((r) => ({ id: r.id, effortHours: r.hours == null ? null : Number(r.hours), gives: r.adv_skill_ids.filter((k) => keys.has(k)).map((k) => ({ key: k, level: r.level })), item: r }));
  return byGapClosure(cands, needs, weights);
}

/** Concept future roles I am closest to: 0.5 × role link (1 from my role, 0.5 within two steps) + 0.5 × skill overlap. */
export function rankFutureRoles<F extends FutureRoleLite>(input: { roles: F[]; levels: Map<string, AdvLevel>; myRole: string | null; edges: EdgeLite[]; roleLabels?: Record<string, BiText>; advLabels?: Record<string, BiText> }): Ranked<F & { overlap: number; link: number }>[] {
  const out: Ranked<F & { overlap: number; link: number }>[] = [];
  for (const fr of input.roles) {
    let best: { d: number; role: string } | null = null;
    for (const id of fr.from_role_ids) {
      const d = roleDistance(input.edges, input.myRole, id);
      if (d != null && (!best || d < best.d || (d === best.d && id < best.role))) best = { d, role: id };
    }
    const link = !best ? 0 : best.d === 0 ? 1 : 0.5;
    const lv = fr.skill_ids.map((k) => ({ k, level: input.levels.get(k)?.level ?? 0 }));
    const overlap = lv.length ? lv.reduce((s, x) => s + Math.min(x.level, TARGET_LEVEL) / TARGET_LEVEL, 0) / lv.length : 0;
    const score = r4(0.5 * link + 0.5 * overlap);
    if (score <= 0) continue;
    const reasons: Reason[] = [];
    const roleLabel = (id: string) => input.roleLabels?.[id] ?? { en: id, ar: id };
    if (best?.d === 0) reasons.push(m21Reason('role_from', { role: roleLabel(best.role) }));
    else if (best) reasons.push(m21Reason('role_near', { role: roleLabel(best.role), n: best.d }));
    else reasons.push(m21Reason('role_none'));
    reasons.push(m21Reason('overlap', { pct: Math.round(overlap * 100) }));
    for (const x of lv.filter((y) => y.level > 0).sort((a, b) => b.level - a.level || (a.k < b.k ? -1 : 1)).slice(0, 2)) reasons.push(m21Reason('shared', { skill: input.advLabels?.[x.k] ?? { en: x.k, ar: x.k }, level: x.level }));
    out.push({ id: fr.id, score, reasons, item: { ...fr, overlap: r4(overlap), link } });
  }
  return out.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
}

export interface LaneSkill { skill_id: string; level: number; security: boolean; qualified: boolean }
/** My current level on a horizon lane: mean level (0-4) of its non-security skills; security skills show qualified / not qualified only. */
export function laneLevel(lane: { skill_ids: string[] }, skills: SkillLite[], states: StateLite[]): { level: number | null; items: LaneSkill[] } {
  const mine = levelMap(states);
  const byId = new Map(skills.map((s) => [s.id, s]));
  const items = lane.skill_ids.filter((id) => byId.has(id)).map((id) => {
    const security = byId.get(id)!.area === 'security';
    const lv = mine.get(id)?.level ?? 0;
    return { skill_id: id, level: security ? 0 : lv, security, qualified: lv > 0 };
  });
  const scored = items.filter((i) => !i.security);
  return { level: scored.length ? r1(scored.reduce((s, i) => s + i.level, 0) / scored.length) : null, items };
}

// Goal targets live in ./goals.ts (import-free: the seed builder loads it in node).
export { goalTarget, goalId, interestId, type GoalData, type GoalTarget } from './goals';
