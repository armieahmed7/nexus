// M22 SupabaseBackend RPC mappings (owner: W2 · E5 · F16, F17). Installed by src/data/ext/supabase.ts.
// SQL: supabase/migrations/20261009125001_kafaa_w2e5_leadership.sql. Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { ExpertRow, FlReadiness, FlStats, LeadershipStats, M22Rpc, My360, ProgrammeStats, QueueItem, WfnDeskRow, WfnStats } from './rpc';

export function makeSupabaseM22(x: SupabaseExtCtx): M22Rpc {
  return {
    nominateLeader: (personId, programmeId, reason) => x.call('kafaa_nominate_leader', { p_person_id: personId, p_programme_id: programmeId, p_reason: reason ?? '' }, ['leadership_nominations', 'notifications']),
    decideNomination: (id, decision, note = '') => x.call('kafaa_decide_nomination', { p_id: id, p_decision: decision, p_note: note ?? '' }, ['leadership_nominations', 'notifications']),
    request360: (raters) => x.call('kafaa_request_360', { p_raters: raters ?? [] }, ['leadership_360_requests', 'notifications']),
    submit360: (requestId, scores) => x.call('kafaa_submit_360', { p_request_id: requestId, p_scores: scores ?? {} }, ['leadership_360_requests', 'leadership_360']),
    my360: async (cycle = null) => x.rpc<My360>('kafaa_my_360', { p_cycle: cycle ?? null }),
    leadershipStats: async () => (await x.rpc<LeadershipStats | null>('kafaa_leadership_stats')) ?? null,
    joinCommunity: (communityId, join) => x.call('kafaa_join_community', { p_community_id: communityId, p_join: join !== false }, ['community_members']),
    postThread: (input) => x.call('kafaa_post_thread', { p: input ?? {} }, ['threads', 'posts', 'notifications']),
    moderatePost: (postId, decision, note = '') => x.call('kafaa_moderate_post', { p_post_id: postId, p_decision: decision, p_note: note ?? '' }, ['posts', 'threads', 'notifications']),
    moderationQueue: async () => (await x.rpc<QueueItem[] | null>('kafaa_moderation_queue')) ?? [],
    setExpertOptin: (skillIds, visible, headline = '') => x.call('kafaa_set_expert_optin', { p_skill_ids: skillIds ?? [], p_visible: visible !== false, p_headline: headline ?? '' }, ['expert_optin']),
    findExperts: async (skillId = null) => (await x.rpc<ExpertRow[] | null>('kafaa_find_experts', { p_skill_id: skillId ?? null })) ?? [],
    requestExpert: (expertId, skillId, message) => x.call('kafaa_request_expert', { p_expert_id: expertId, p_skill_id: skillId, p_message: message ?? '' }, ['expert_requests', 'notifications']),
    answerExpertRequest: (id, decision, reply = '') => x.call('kafaa_answer_expert_request', { p_id: id, p_decision: decision, p_reply: reply ?? '' }, ['expert_requests', 'notifications']),
    // FS46-FS48 (wave E · E4): SQL in supabase/migrations/20261010254001_kafaa_fs54_future_leadership.sql
    leadershipProgrammeStats: async () => (await x.rpc<ProgrammeStats | null>('kafaa_leadership_programme_stats')) ?? null,
    nominateFutureLeader: (personId, reason) => x.call('kafaa_nominate_future_leader', { p_person_id: personId, p_reason: reason ?? '' }, ['leadership_nominations', 'notifications']),
    flReadiness: async (personIds) => (await x.rpc<FlReadiness[] | null>('kafaa_fl_readiness', { p_person_ids: personIds ?? [] })) ?? [],
    recordFlModule: (nominationId, moduleId, done) => x.call('kafaa_record_fl_module', { p_nomination_id: nominationId, p_module_id: moduleId, p_done: done !== false }, ['fl_participants']),
    savePolicyProject: (input) => x.call('kafaa_save_policy_project', { p: input ?? {} }, ['fl_participants']),
    reviewPolicyProject: (nominationId, decision, note = '') => x.call('kafaa_review_policy_project', { p_nomination_id: nominationId, p_decision: decision, p_note: note ?? '' }, ['fl_participants', 'leadership_nominations', 'notifications']),
    futureLeadersStats: async () => (await x.rpc<FlStats | null>('kafaa_future_leaders_stats')) ?? null,
    setWfnOptin: (input) => x.call('kafaa_set_wfn_optin', { p: input ?? { active: false } }, ['wfn_participants', 'wfn_circle_members', 'wfn_requests']),
    joinWfnCircle: (circleId, join) => x.call('kafaa_join_wfn_circle', { p_circle_id: circleId, p_join: join !== false }, ['wfn_circle_members']),
    requestWfnOffer: (offerId, statement) => x.call('kafaa_request_wfn_offer', { p_offer_id: offerId, p_statement: statement ?? '' }, ['wfn_requests']),
    decideWfnRequest: (id, decision, note = '', outcome) => x.call('kafaa_decide_wfn_request', { p_id: id, p_decision: decision, p_note: note ?? '', p_outcome: outcome ?? null }, ['wfn_requests', 'notifications']),
    wfnDesk: async () => (await x.rpc<WfnDeskRow[] | null>('kafaa_wfn_desk')) ?? [],
    wfnStats: async () => (await x.rpc<WfnStats | null>('kafaa_wfn_stats')) ?? null,
  };
}
