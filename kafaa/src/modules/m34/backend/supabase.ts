// M34 SupabaseBackend RPC mappings (owners: wave D E2 (FS29, FS30) and wave I E1 (FS78, FS79)). Installed by src/data/ext/supabase.ts.
// x.call('kafaa_<name>', { p_... }, ['<tables touched>']) for Result-returning RPCs; x.rpc(fn, args) for plain reads.
// Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { M34Rpc } from './rpc';

export function makeSupabaseM34(x: SupabaseExtCtx): M34Rpc {
  return {
    // FS wave D · E2 · FS29/FS30 (supabase/migrations/20261010242001_kafaa_fs42_rpl_credits.sql)
    submitRpl: (input) => x.call('kafaa_submit_rpl', { p: input ?? {} }, ['rpl_requests', 'rpl_evidence', 'notifications']),
    attestRpl: (input) => x.call('kafaa_attest_rpl', { p: input ?? {} }, ['rpl_evidence', 'notifications']),
    decideRpl: (input) => x.call('kafaa_decide_rpl', { p: input ?? {} }, ['rpl_requests', 'skill_evidence', 'person_skills', 'credit_ledger', 'notifications']),
    exportRpl: (id) => x.call('kafaa_export_rpl', { p_id: id }, ['rpl_requests']),
    rplEvidenceOptions: (personId) => x.rpc('kafaa_rpl_evidence_options', { p_person: personId ?? null }),
    tagCredit: (input) => x.call('kafaa_tag_credit', { p: input ?? {} }, ['credit_tags', 'credit_ledger']),
    syncCredits: (personId) => x.call('kafaa_sync_credits', { p_person: personId ?? null }, ['credit_ledger']),
  };
}
