// M20 SupabaseBackend RPC mappings (owner: W1 · F08). Installed by src/data/ext/supabase.ts.
// SQL: supabase/migrations/20261009114001_kafaa_w1e4_opportunities.sql. Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { M20Rpc } from './rpc';
import type { OppStats } from '../domain';
import type { RotationBoard, RotationCandidate } from '../rotation';
import type { ReserveBoard, ReserveDesk } from '../reserve';
import type { FutureGigStats } from '../futureGigs';
import type { SecDeskStats } from '../secondment';
import type { SecondmentDesk } from './rpc';

const APPS = ['opportunity_applications', 'notifications'] as const;
export function makeSupabaseM20(x: SupabaseExtCtx): M20Rpc {
  return {
    postOpportunity: (input) => x.call('kafaa_post_opportunity', { p: input }, ['opportunities']),
    setOpportunityStatus: (id, status) => x.call('kafaa_set_opportunity_status', { p_id: id, p_status: status }, ['opportunities', 'opportunity_applications']),
    applyOpportunity: (opportunityId, note) => x.call('kafaa_apply_opportunity', { p_opportunity_id: opportunityId, p_note: note ?? '' }, [...APPS, 'time_envelopes']),
    releaseDecision: (applicationId, decision, note = '') => x.call('kafaa_release_decision', { p_application_id: applicationId, p_decision: decision, p_note: note ?? '' }, [...APPS]),
    selectApplicant: (applicationId, decision, note = '') => x.call('kafaa_select_applicant', { p_application_id: applicationId, p_decision: decision, p_note: note ?? '' }, [...APPS, 'opportunities']),
    completeOpportunity: (applicationId, levels, note) =>
      x.call('kafaa_complete_opportunity', { p_application_id: applicationId, p_levels: levels ?? {}, p_note: note ?? '' }, [...APPS, 'skill_evidence', 'person_skills']),
    withdrawOpportunityApplication: (applicationId) => x.call('kafaa_withdraw_opportunity_application', { p_application_id: applicationId }, ['opportunity_applications', 'opportunities']),
    saveOpportunity: (opportunityId, saved) => x.call('kafaa_save_opportunity', { p_opportunity_id: opportunityId, p_saved: saved }, ['opportunity_saves']),
    opportunityStats: async () => (await x.rpc<OppStats | null>('kafaa_opportunity_stats')) ?? null,
    // F15 Rotations and shadowing (W2 · E4): supabase/migrations/20261009124001_kafaa_w2e4_rotations.sql
    saveRotationTemplate: (input) => x.call('kafaa_save_rotation_template', { p: input }, ['rotation_templates']),
    saveRotationCohort: (input) => x.call('kafaa_save_rotation_cohort', { p: input }, ['rotation_cohorts']),
    enrolRotation: (templateId, personId, cohortId, startOn) =>
      x.call('kafaa_enrol_rotation', { p_template_id: templateId, p_person_id: personId, p_cohort_id: cohortId ?? null, p_start_on: startOn }, ['rotation_placements', 'notifications']),
    placementCheckin: (placementId, progress, note) => x.call('kafaa_placement_checkin', { p_placement_id: placementId, p_progress: progress ?? {}, p_note: note ?? '' }, ['rotation_placements', 'notifications']),
    signoffPlacement: (placementId, levels, note) =>
      x.call('kafaa_signoff_placement', { p_placement_id: placementId, p_levels: levels ?? {}, p_note: note ?? '' }, ['rotation_placements', 'skill_evidence', 'person_skills', 'notifications']),
    setShadowHost: (input) => x.call('kafaa_set_shadow_host', { p: input }, ['shadow_hosts']),
    requestShadow: (input) => x.call('kafaa_request_shadow', { p: input }, ['shadow_requests', 'notifications']),
    decideShadow: (requestId, decision, note = '') =>
      x.call('kafaa_decide_shadow', { p_request_id: requestId, p_decision: decision, p_note: note ?? '' }, ['shadow_requests', 'skill_evidence', 'person_skills', 'notifications']),
    rotationBoard: async () => (await x.rpc<RotationBoard | null>('kafaa_rotation_board')) ?? null,
    rotationCandidates: async (templateId) => (await x.rpc<RotationCandidate[] | null>('kafaa_rotation_candidates', { p_template_id: templateId })) ?? null,
    // F23 Alumni and expert reserve (W3 · E4): supabase/migrations/20261009134001_kafaa_w3e4_reserve.sql
    joinReserve: (input) => x.call('kafaa_join_reserve', { p: input }, ['alumni', 'reserve_engagements', 'reserve_requests', 'alumni_stories']),
    requestReserve: (input) => x.call('kafaa_request_reserve', { p: input }, ['reserve_requests']),
    decideReserveRequest: (requestId, decision, note = '') => x.call('kafaa_decide_reserve_request', { p_request_id: requestId, p_decision: decision, p_note: note ?? '' }, ['reserve_requests', 'reserve_engagements', 'notifications']),
    reserveInterest: (requestId, note = '') => x.call('kafaa_reserve_interest', { p_request_id: requestId, p_note: note ?? '' }, ['reserve_engagements', 'reserve_requests']),
    inviteReserve: (requestId, alumniId, note = '') => x.call('kafaa_invite_reserve', { p_request_id: requestId, p_alumni_id: alumniId, p_note: note ?? '' }, ['reserve_engagements', 'reserve_requests', 'notifications']),
    decideReserveEngagement: (engagementId, decision, note = '') =>
      x.call('kafaa_decide_reserve_engagement', { p_engagement_id: engagementId, p_decision: decision, p_note: note ?? '' }, ['reserve_engagements', 'reserve_requests', 'notifications']),
    reserveBoard: async () => (await x.rpc<ReserveBoard | null>('kafaa_reserve_board')) ?? null,
    reserveDesk: async () => (await x.rpc<ReserveDesk | null>('kafaa_reserve_desk')) ?? null,
    // FS27 + FS28 (FS wave D · E1): supabase/migrations/20261010241001_kafaa_fs41_future_gigs_secondments.sql
    requestEnvelope: (input) => x.call('kafaa_request_envelope', { p: input }, ['time_envelopes', 'notifications']),
    approveEnvelope: (id, decision, note = '') => x.call('kafaa_approve_envelope', { p_id: id, p_decision: decision, p_note: note ?? '' }, ['time_envelopes', 'notifications']),
    futureGigStats: async () => (await x.rpc<FutureGigStats | null>('kafaa_future_gig_stats')) ?? null,
    tagFutureRotation: (input) => x.call('kafaa_tag_future_rotation', { p: input }, ['rotation_templates']),
    planSecondment: (input) => x.call('kafaa_plan_secondment', { p: input }, ['secondments', 'notifications']),
    closeSecondment: (id, decision, input) => x.call('kafaa_close_secondment', { p_id: id, p_decision: decision, p: input ?? {} }, ['secondments', 'capture_sessions', 'notifications']),
    secondmentDesk: async () => (await x.rpc<SecondmentDesk | null>('kafaa_secondment_desk')) ?? null,
    secondmentOverview: async () => (await x.rpc<SecDeskStats | null>('kafaa_secondment_overview')) ?? null,
  };
}
