// M11 SupabaseBackend RPC mappings (owner: FS wave A · E3, FS04). Installed by src/data/ext/supabase.ts. Pages never import this file.
// saveSkillGapPlan keeps its G4 mapping (kafaa_save_skill_gap_plan, redefined by the FS04 migration to stamp sk_id).
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { FutureRadar, M11Rpc } from './rpc';

export function makeSupabaseM11(x: SupabaseExtCtx): M11Rpc {
  return {
    futureRadar: async (scenario) => x.rpc<FutureRadar>('kafaa_future_radar', { p_scenario: scenario }),
    saveFutureSkillMap: (input) => x.call<{ id: string }>('kafaa_save_future_skill_map', { p: input }, ['future_skill_map', 'adv_skills', 'future_skills']),
  };
}
