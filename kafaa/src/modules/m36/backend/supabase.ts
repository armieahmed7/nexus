// M36 SupabaseBackend RPC mappings (owners: wave G E3 (FS64, FS65) and wave I E4 (FS82, FS83)). Installed by src/data/ext/supabase.ts.
// x.call('kafaa_<name>', { p_... }, ['<tables touched>']) for Result-returning RPCs; x.rpc(fn, args) for plain reads.
// SQL: supabase/migrations/20261010273001_kafaa_fs73_regional_pledges.sql. Pages never import this file.
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
  };
}
