/**
 * F09 Future Me goals: what an "Add to my learning goals" target covers. Import-free (scripts/seed/ext/f09-future.mjs loads it
 * in node). SQL mirror: kafaa_set_future_goal in supabase/migrations/20261009115001_kafaa_w1e5_future.sql. Change both together.
 */
export const GOAL_KINDS = ['adv_skill', 'bridge', 'lane', 'future_role'] as const;
export type GoalKind = (typeof GOAL_KINDS)[number];
export const GOAL_TARGET_LEVEL = 2;
export const MAX_ACTIVE_GOALS = 12;
interface AdvSkillLite { id: string; tech_id: string; skill_en: string; skill_ar: string }
interface SkillLite { id: string; area: string; adv_skill_ids: string[] }
interface BridgeLite { id: string; from_role_id: string; tech_id: string }
interface FutureRoleLite { id: string; title_en: string; title_ar: string; skill_ids: string[]; tech_ids: string[] }
interface LaneLite { id: string; title_en: string; title_ar: string; skill_ids: string[] }
export interface GoalData {
  advSkills: AdvSkillLite[];
  skills: SkillLite[];
  bridges: BridgeLite[];
  roles: FutureRoleLite[];
  lanes: LaneLite[];
  jobRoles: { id: string; title_en: string; title_ar: string }[];
  techs: { id: string; family_en: string; family_ar: string }[];
}
export interface GoalTarget { tech_id: string | null; lane_id: string | null; skill_ids: string[]; adv_skill_ids: string[]; title_en: string; title_ar: string }
const byIdC = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
/** What a Future Me goal covers (same as kafaa_set_future_goal): the Kafa'a skills to grow, sorted by id, never security-area skills. */
export function goalTarget(kind: string, ref: string, d: GoalData): GoalTarget | null {
  const mapped = (adv: string[]) => d.skills.filter((s) => s.area !== 'security' && s.adv_skill_ids.some((k) => adv.includes(k))).map((s) => s.id).sort(byIdC);
  if (kind === 'adv_skill') {
    const a = d.advSkills.find((x) => x.id === ref);
    return a ? { tech_id: a.tech_id, lane_id: null, adv_skill_ids: [a.id], skill_ids: mapped([a.id]), title_en: a.skill_en, title_ar: a.skill_ar } : null;
  }
  if (kind === 'bridge') {
    const b = d.bridges.find((x) => x.id === ref);
    if (!b) return null;
    const role = d.jobRoles.find((r) => r.id === b.from_role_id);
    const tech = d.techs.find((t) => t.id === b.tech_id);
    const adv = d.advSkills.filter((a) => a.tech_id === b.tech_id).map((a) => a.id).sort(byIdC);
    return { tech_id: b.tech_id, lane_id: null, adv_skill_ids: adv, skill_ids: mapped(adv), title_en: `${role?.title_en ?? b.from_role_id} · ${tech?.family_en ?? b.tech_id}`, title_ar: `${role?.title_ar ?? b.from_role_id} · ${tech?.family_ar ?? b.tech_id}` };
  }
  if (kind === 'future_role') {
    const r = d.roles.find((x) => x.id === ref);
    if (!r) return null;
    const adv = [...r.skill_ids].sort(byIdC);
    return { tech_id: r.tech_ids[0] ?? null, lane_id: null, adv_skill_ids: adv, skill_ids: mapped(adv), title_en: r.title_en, title_ar: r.title_ar };
  }
  if (kind === 'lane') {
    const l = d.lanes.find((x) => x.id === ref);
    if (!l) return null;
    const sec = new Set(d.skills.filter((s) => s.area === 'security').map((s) => s.id));
    const known = new Set(d.skills.map((s) => s.id));
    return { tech_id: null, lane_id: l.id, adv_skill_ids: [], skill_ids: l.skill_ids.filter((s) => known.has(s) && !sec.has(s)).sort(byIdC), title_en: l.title_en, title_ar: l.title_ar };
  }
  return null;
}
export const goalId = (person: string, kind: string, ref: string) => `fg:${person}:${kind}:${ref}`;
export const interestId = (person: string, target: string) => `fi:${person}:${target}`;
