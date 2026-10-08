/** F02 SkillsEngine: wraps the F01 skill derivation (src/domain/skills.ts) with vector and level helpers for ranking. */
import { deriveSkillState, deriveStates, gatherEvidence, skillReasons, type SkillState } from '../skills';
import type { Vec } from './rank';

type StateLike = Pick<SkillState, 'skill_id' | 'level'> & { confidence?: number | string; active?: boolean };
type SkillLike = { id: string; competency_id: string; core: boolean };

/** Competency level per competency: the level of its core skill (sk-<competency>), else the best of its skills. */
export function competencyLevels(states: StateLike[], skills: SkillLike[]): Map<string, number> {
  const byId = new Map(skills.map((s) => [s.id, s]));
  const core = new Map<string, number>();
  const any = new Map<string, number>();
  for (const s of states) {
    if (s.active === false) continue;
    const sk = byId.get(s.skill_id);
    if (!sk) continue;
    const m = sk.core ? core : any;
    m.set(sk.competency_id, Math.max(m.get(sk.competency_id) ?? 0, s.level));
  }
  for (const [k, v] of any) if (!core.has(k)) core.set(k, v);
  return core;
}
/** Person skill vector: level weighted by confidence. */
export const skillVector = (states: StateLike[]): Vec => new Map(states.filter((s) => s.active !== false && s.level > 0).map((s) => [s.skill_id, s.level * Number(s.confidence ?? 1)]));
/** Role skill vector: required level on the core skill of each competency the role needs. */
export const roleVector = (roleComps: { role_id: string; competency_id: string; required_level: number }[], roleId: string): Vec =>
  new Map(roleComps.filter((r) => r.role_id === roleId).map((r) => [`sk-${r.competency_id}`, r.required_level]));

export const SkillsEngine = { gatherEvidence, deriveSkillState, deriveStates, skillReasons, competencyLevels, skillVector, roleVector };
