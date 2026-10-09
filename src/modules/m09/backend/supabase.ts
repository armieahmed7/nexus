// M09 extension SupabaseBackend RPC mappings (owner: W5 · E2, F33). Installed by src/data/ext/supabase.ts. Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { M09Rpc } from './rpc';

export function makeSupabaseM09(x: SupabaseExtCtx): M09Rpc {
  return {
    equivalencyPrecheck: (personId, standardId) => x.call('kafaa_equivalency_precheck', { p_person: personId, p_standard: standardId }, ['audit_events']),
    setContractRoleTarget: (input) => x.call('kafaa_set_contract_role_target', { p: input }, ['contract_role_targets']),
    issueContractorBadge: (certificateId) => x.call('kafaa_issue_contractor_badge', { p_cert: certificateId }, ['badges']),
    contractorBadges: async (personId) => (await x.rpc<unknown>('kafaa_contractor_badges', { p_person: personId })) as never,
  };
}
