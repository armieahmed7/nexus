// M04 extension SupabaseBackend RPC mappings (owner: W2 · E3, F13 Mentoring 2.0). Installed by src/data/ext/supabase.ts.
// SQL: supabase/migrations/20261009123001_kafaa_w2e3_mentoring_refreshers.sql. Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { ProgrammeStats } from '../mentoring';
import type { CloseOutResult, M04Rpc, ReportingLine, SmeNominee } from './rpc';

export function makeSupabaseM04(x: SupabaseExtCtx): M04Rpc {
  return {
    requestMentoring: (input) => x.call('kafaa_request_mentoring', { p: input }, ['mentoring_requests', 'notifications']),
    proposeAgreement: (requestId, terms) => x.call('kafaa_propose_agreement', { p_request_id: requestId, p: terms }, ['mentoring_agreements', 'notifications']),
    respondAgreement: (agreementId, decision, note) => x.call('kafaa_respond_agreement', { p_agreement_id: agreementId, p_decision: decision, p_note: note ?? null }, ['mentoring_agreements', 'notifications']),
    logSession: (agreementId, input) => x.call('kafaa_log_session', { p_agreement_id: agreementId, p: input }, ['mentoring_sessions', 'mentoring_private_notes']),
    closeAgreement: (agreementId, input) =>
      x.call<CloseOutResult>('kafaa_close_agreement', { p_agreement_id: agreementId, p: input }, ['mentoring_agreements', 'mentoring_requests', 'notifications', 'skill_claims', 'skill_evidence', 'person_skills']),
    nominateSme: (mentorId, on, skillIds = []) => x.call('kafaa_nominate_sme', { p_mentor_id: mentorId, p_on: on, p_skill_ids: skillIds }, ['mentors', 'notifications']),
    smeNominees: async () => (await x.rpc<SmeNominee[]>('kafaa_sme_nominees')) ?? [],
    myReportingLine: async () => (await x.rpc<ReportingLine>('kafaa_my_reporting_line')) ?? { line_manager: null, chain: [] },
    mentoringProgramme: () => x.call<ProgrammeStats>('kafaa_mentoring_programme', {}, []),
  };
}
