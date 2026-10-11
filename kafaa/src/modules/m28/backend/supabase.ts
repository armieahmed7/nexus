// M28 SupabaseBackend RPC mappings (owners: wave B E1 (FS07, FS08) and wave H E1 (FS70, FS71, FS72)). Installed by src/data/ext/supabase.ts.
// x.call('kafaa_<name>', { p_... }, ['<tables touched>']) for Result-returning RPCs; x.rpc(fn, args) for plain reads.
// Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { M28Rpc } from './rpc';

export function makeSupabaseM28(x: SupabaseExtCtx): M28Rpc {
  return {
    saveAlignment: (input) => x.call('kafaa_save_alignment', { p: input ?? {} }, ['skill_alignments']),
    reviewAlignment: (id) => x.call('kafaa_review_alignment', { p_id: id ?? '' }, ['skill_alignments']),
    retireAlignment: (id, reason) => x.call('kafaa_retire_alignment', { p_id: id ?? '', p_reason: reason ?? '' }, ['skill_alignments']),
    setSkillGoal: (skillId, targetLevel, active) => x.call('kafaa_set_skill_goal', { p_skill: skillId ?? '', p_level: targetLevel ?? null, p_active: active !== false }, ['skill_goals']),
  };
}
