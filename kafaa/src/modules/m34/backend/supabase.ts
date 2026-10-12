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
    // FS wave I · E1 · FS78/FS79 (supabase/migrations/20261010291001_kafaa_fs91_balance_external_certs.sql)
    requestStudyTime: (input) => x.call('kafaa_request_study_time', { p: input ?? {} }, ['study_time_requests', 'learning_balances', 'notifications']),
    decideStudyTime: (input) => x.call('kafaa_decide_study_time', { p: input ?? {} }, ['study_time_requests', 'learning_balances', 'notifications']),
    learningBalance: (personId, year) => x.rpc('kafaa_learning_balance', { p_person: personId ?? null, p_year: year ?? null }),
    submitExternalCert: (input) => x.call('kafaa_submit_external_cert', { p: input ?? {} }, ['external_certs']),
    verifyExternalCert: (input) => x.call('kafaa_verify_external_cert', { p: input ?? {} }, ['external_certs', 'skill_evidence', 'person_skills', 'notifications']),
  };
}
