// M04 extension SupabaseBackend RPC mappings (owner: W2 · E3, F13 Mentoring 2.0). Installed by src/data/ext/supabase.ts.
// SQL: supabase/migrations/20261009123001_kafaa_w2e3_mentoring_refreshers.sql. Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { ProgrammeStats } from '../mentoring';
import type { CloseOutResult, M04Rpc, ReportingLine, SmeNominee } from './rpc';
import type { DebriefResult, SimDebriefView } from './simulator.rpc';

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
    // W4E3 (F28) simulator scenario library: SQL in supabase/migrations/20261009143001_kafaa_w4e3_simulator.sql
    saveSimScenario: (input) => x.call('kafaa_save_sim_scenario', { p: input }, ['sim_scenarios']),
    reviewSimScenario: (scenarioId, decision, note) => x.call('kafaa_review_sim_scenario', { p_scenario_id: scenarioId, p_decision: decision, p_note: note ?? null }, ['sim_scenarios', 'notifications']),
    planCycle: (cycleId, items, submit) => x.call('kafaa_plan_cycle', { p_cycle_id: cycleId, p_items: items, p_submit: submit === true }, ['sim_cycles', 'sim_cycle_items']),
    approveCycle: (cycleId, gapNote) => x.call('kafaa_approve_cycle', { p_cycle_id: cycleId, p_gap_note: gapNote ?? null }, ['sim_cycles', 'notifications']),
    recordDebrief: (input) => x.call<DebriefResult>('kafaa_record_debrief', { p: input }, ['crew_debriefs', 'crew_debrief_members', 'sim_scenarios', 'skill_evidence', 'person_skills', 'notifications']),
    simDebriefs: async () => (await x.rpc<SimDebriefView[]>('kafaa_sim_debriefs')) ?? [],
  };
}
