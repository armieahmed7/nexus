// M19 SupabaseBackend RPC mappings (owner: W1 · E3, F07 Learning Coach). Installed by src/data/ext/supabase.ts.
// SQL: supabase/migrations/20261009113001_kafaa_w1e3_coach.sql. Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { M19Rpc, PathwayCatalogue, PathwayDetail } from './rpc';
import type { CatalogueCheck } from '../pathways';

export function makeSupabaseM19(x: SupabaseExtCtx): M19Rpc {
  return {
    coachFeedback: (itemKind, itemId, signal, competencyIds = []) =>
      x.call('kafaa_coach_feedback', { p_kind: itemKind, p_item: itemId, p_signal: signal, p_competency_ids: competencyIds }, ['coach_feedback']),
    coachInsights: () => x.call('kafaa_coach_insights', {}, []),
    // W2 · E3 · F14
    nextRefresher: (extra = false) => x.call('kafaa_next_refresher', { p_extra: extra }, []),
    submitRefresher: (answers) => x.call('kafaa_submit_refresher', { p_answers: answers }, ['refresh_state']),
    refresherItemStats: () => x.call('kafaa_refresher_item_stats', {}, []),
    // FS wave C · E1 · FS17/FS18 (SQL: supabase/migrations/20261010231001_kafaa_fs31_pathways_catalogue.sql)
    pathwayCatalogue: async () => (await x.rpc<PathwayCatalogue | null>('kafaa_pathway_catalogue')) ?? null,
    pathwayDetail: async (pathwayId) => (await x.rpc<PathwayDetail | null>('kafaa_pathway_detail', { p_id: pathwayId })) ?? null,
    startPathway: (pathwayId) => x.call('kafaa_start_pathway', { p_id: pathwayId }, ['pathway_enrolments']),
    completePathway: (pathwayId) => x.call('kafaa_complete_pathway', { p_id: pathwayId }, ['pathway_enrolments']),
    withdrawPathway: (pathwayId, reason = null) => x.call('kafaa_withdraw_pathway', { p_id: pathwayId, p_reason: reason }, ['pathway_enrolments']),
    savePathway: (input) => x.call('kafaa_save_pathway', { p: input ?? {} }, ['pathways', 'pathway_steps']),
    refreshPathwayGaps: () => x.call('kafaa_refresh_pathway_gaps', {}, ['pathway_gaps']),
    checkExternalResource: (input) => x.rpc<CatalogueCheck>('kafaa_check_external_resource', { p: input ?? {} }),
    saveExternalResource: (input) => x.call('kafaa_save_external_resource', { p: input ?? {} }, ['external_resources']),
    publishExternalResource: (id) => x.call('kafaa_publish_external_resource', { p_id: id }, ['external_resources']),
    retireExternalResource: (id, reason) => x.call('kafaa_retire_external_resource', { p_id: id, p_reason: reason }, ['external_resources']),
    recordExternalCompletion: (input) => x.call('kafaa_record_external_completion', { p: input ?? {} }, ['external_completions', 'xapi_statements']),
  };
}
