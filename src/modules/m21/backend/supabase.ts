// M21 SupabaseBackend RPC mappings (owner: W1 · E5, F09). Installed by src/data/ext/supabase.ts.
// Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { FutureDemandRow, FutureGoalResult, M21Rpc } from './rpc';

export function makeSupabaseM21(x: SupabaseExtCtx): M21Rpc {
  return {
    setFutureGoal: (kind, refId, active = true) => x.call<FutureGoalResult>('kafaa_set_future_goal', { p_kind: kind, p_ref: refId, p_active: active }, ['future_goals']),
    futureDemand: async () => ((await x.rpc<FutureDemandRow[]>('kafaa_future_demand')) ?? []).map((r) => ({ ...r, n: r.n == null ? null : Number(r.n) })),
  };
}
