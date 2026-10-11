// M22 SupabaseBackend RPC mappings (owner: W2 · E5 · F16, F17). Installed by src/data/ext/supabase.ts.
// SQL: supabase/migrations/20261009125001_kafaa_w2e5_leadership.sql. Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { ExpertRow, LeadershipStats, M22Rpc, My360, QueueItem } from './rpc';

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
  };
}
