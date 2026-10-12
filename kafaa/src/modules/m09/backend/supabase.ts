// M09 extension SupabaseBackend RPC mappings (owner: W5 · E2, F33). Installed by src/data/ext/supabase.ts. Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { M09Rpc } from './rpc';

export function makeSupabaseM09(x: SupabaseExtCtx): M09Rpc {
  return {
    equivalencyPrecheck: (personId, standardId) => x.call('kafaa_equivalency_precheck', { p_person: personId, p_standard: standardId }, ['audit_events']),
    setContractRoleTarget: (input) => x.call('kafaa_set_contract_role_target', { p: input }, ['contract_role_targets']),
    issueContractorBadge: (certificateId) => x.call('kafaa_issue_contractor_badge', { p_cert: certificateId }, ['badges']),
    contractorBadges: async (personId) => (await x.rpc<unknown>('kafaa_contractor_badges', { p_person: personId })) as never,
    // FS68/FS69 (fsGe5)
    supplierFutureReadiness: async () => (await x.rpc<unknown>('kafaa_supplier_future_readiness')) as never,
    prearrivalShares: async () => (await x.rpc<unknown>('kafaa_prearrival_shares')) as never,
    prearrivalContractors: async () => (await x.rpc<unknown>('kafaa_prearrival_contractors')) as never,
    prearrivalItems: async (personId) => (await x.rpc<unknown>('kafaa_prearrival_items', { p_person: personId ?? null })) as never,
    createPrearrivalShare: (input) => x.call('kafaa_create_prearrival_share', { p: input }, ['prearrival_shares', 'record_shares', 'notifications']),
    revokePrearrivalShare: (id, reason) => x.call('kafaa_revoke_prearrival_share', { p_id: id, p_reason: reason ?? null }, ['prearrival_shares', 'record_shares']),
    prearrivalShare: (id) => x.call('kafaa_prearrival_share', { p_id: id }, ['audit_events']),
    precheckFromShare: (id, standardId) => x.call('kafaa_precheck_from_share', { p_id: id, p_standard: standardId ?? null }, ['prearrival_shares']),
  };
}
