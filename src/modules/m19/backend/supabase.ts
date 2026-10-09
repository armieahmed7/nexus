// M19 SupabaseBackend RPC mappings (owner: W1 · E3, F07 Learning Coach). Installed by src/data/ext/supabase.ts.
// SQL: supabase/migrations/20261009113001_kafaa_w1e3_coach.sql. Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { M19Rpc } from './rpc';

export function makeSupabaseM19(x: SupabaseExtCtx): M19Rpc {
  return {
    coachFeedback: (itemKind, itemId, signal, competencyIds = []) =>
      x.call('kafaa_coach_feedback', { p_kind: itemKind, p_item: itemId, p_signal: signal, p_competency_ids: competencyIds }, ['coach_feedback']),
    coachInsights: () => x.call('kafaa_coach_insights', {}, []),
    // W2 · E3 · F14
    nextRefresher: (extra = false) => x.call('kafaa_next_refresher', { p_extra: extra }, []),
    submitRefresher: (answers) => x.call('kafaa_submit_refresher', { p_answers: answers }, ['refresh_state']),
    refresherItemStats: () => x.call('kafaa_refresher_item_stats', {}, []),
  };
}
