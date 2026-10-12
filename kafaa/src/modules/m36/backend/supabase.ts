// M36 SupabaseBackend RPC mappings (owners: wave G E3 (FS64, FS65) and wave I E4 (FS82, FS83)). Installed by src/data/ext/supabase.ts.
// x.call('kafaa_<name>', { p_... }, ['<tables touched>']) for Result-returning RPCs; x.rpc(fn, args) for plain reads.
// SQL: supabase/migrations/20261010273001_kafaa_fs73_regional_pledges.sql and 20261010294001_kafaa_fs94_grants_consortium.sql. Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { M36Rpc } from './rpc';

export function makeSupabaseM36(x: SupabaseExtCtx): M36Rpc {
  return {
    releaseRegionalDemand: (input) => x.call('kafaa_release_regional_demand', { p: input ?? {} }, ['regional_demand']),
    commitProvision: (input) => x.call('kafaa_commit_provision', { p: input ?? {} }, ['provider_commitments']),
    reportCommitmentDelivery: (input) => x.call('kafaa_report_commitment_delivery', { p: input ?? {} }, ['provider_commitments']),
    reviewCommitment: (input) => x.call('kafaa_review_commitment', { p: input ?? {} }, ['provider_commitments']),
    registerPledge: (input) => x.call('kafaa_register_pledge', { p: input ?? {} }, ['pledges']),
    recordPledgeProgress: (input) => x.call('kafaa_record_pledge_progress', { p: input ?? {} }, ['pledge_progress']),
    pledgeLedger: () => x.call('kafaa_pledge_ledger', {}, []),
    // FS82
    scheduleGrantRound: (input) => x.call('kafaa_schedule_grant_round', { p: input ?? {} }, ['grant_rounds']),
    applyGrant: (input) => x.call('kafaa_apply_grant', { p: input ?? {} }, ['grant_applications']),
    withdrawGrant: (id) => x.call('kafaa_withdraw_grant', { p_id: id }, ['grant_applications']),
    decideGrant: (input) => x.call('kafaa_decide_grant', { p: input ?? {} }, ['grant_applications', 'notifications']),
    submitGrantOutput: (input) => x.call('kafaa_submit_grant_output', { p: input ?? {} }, ['grant_applications']),
    reviewGrantOutput: (input) => x.call('kafaa_review_grant_output', { p: input ?? {} }, ['grant_applications', 'skill_evidence', 'person_skills', 'notifications']),
    grantStats: () => x.call('kafaa_grant_stats', {}, []),
    // FS83
    nominateConsortiumTrainee: (input) => x.call('kafaa_nominate_consortium_trainee', { p: input ?? {} }, ['consortium_members']),
    decideConsortiumMember: (input) => x.call('kafaa_decide_consortium_member', { p: input ?? {} }, ['consortium_members', 'notifications']),
    logConsortiumVisit: (input) => x.call('kafaa_log_consortium_visit', { p: input ?? {} }, ['consortium_visits']),
    confirmConsortiumVisit: (input) => x.call('kafaa_confirm_consortium_visit', { p: input ?? {} }, ['consortium_visits', 'skill_evidence', 'person_skills', 'notifications']),
    withdrawConsortiumVisit: (id) => x.call('kafaa_withdraw_consortium_visit', { p_id: id }, ['consortium_visits']),
    consortiumHostVisits: () => x.call('kafaa_consortium_host_visits', {}, []),
    consortiumStats: () => x.call('kafaa_consortium_stats', {}, []),
  };
}
