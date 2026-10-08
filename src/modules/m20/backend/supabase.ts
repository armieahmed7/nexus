// M20 SupabaseBackend RPC mappings (owner: W1 · F08). Installed by src/data/ext/supabase.ts.
// SQL: supabase/migrations/20261009114001_kafaa_w1e4_opportunities.sql. Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { M20Rpc } from './rpc';
import type { OppStats } from '../domain';

const APPS = ['opportunity_applications', 'notifications'] as const;
export function makeSupabaseM20(x: SupabaseExtCtx): M20Rpc {
  return {
    postOpportunity: (input) => x.call('kafaa_post_opportunity', { p: input }, ['opportunities']),
    setOpportunityStatus: (id, status) => x.call('kafaa_set_opportunity_status', { p_id: id, p_status: status }, ['opportunities', 'opportunity_applications']),
    applyOpportunity: (opportunityId, note) => x.call('kafaa_apply_opportunity', { p_opportunity_id: opportunityId, p_note: note ?? '' }, [...APPS]),
    releaseDecision: (applicationId, decision, note = '') => x.call('kafaa_release_decision', { p_application_id: applicationId, p_decision: decision, p_note: note ?? '' }, [...APPS]),
    selectApplicant: (applicationId, decision, note = '') => x.call('kafaa_select_applicant', { p_application_id: applicationId, p_decision: decision, p_note: note ?? '' }, [...APPS, 'opportunities']),
    completeOpportunity: (applicationId, levels, note) =>
      x.call('kafaa_complete_opportunity', { p_application_id: applicationId, p_levels: levels ?? {}, p_note: note ?? '' }, [...APPS, 'skill_evidence', 'person_skills']),
    withdrawOpportunityApplication: (applicationId) => x.call('kafaa_withdraw_opportunity_application', { p_application_id: applicationId }, ['opportunity_applications', 'opportunities']),
    saveOpportunity: (opportunityId, saved) => x.call('kafaa_save_opportunity', { p_opportunity_id: opportunityId, p_saved: saved }, ['opportunity_saves']),
    opportunityStats: async () => (await x.rpc<OppStats | null>('kafaa_opportunity_stats')) ?? null,
  };
}
