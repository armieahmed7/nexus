// M18 SupabaseBackend RPC mappings (owner: W1 engineer 2). Installed by src/data/ext/supabase.ts. Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { M18Rpc } from './rpc';

export function makeSupabaseM18(x: SupabaseExtCtx): M18Rpc {
  return {
    careerReadiness: (personId, roleIds) => x.call('kafaa_career_readiness', { p_person: personId, p_role_ids: roleIds }, []),
    roadmapToPlan: (roadmapId) => x.call('kafaa_roadmap_to_plan', { p_roadmap: roadmapId }, ['roadmaps', 'dev_plans', 'plan_activities']),
  };
}
