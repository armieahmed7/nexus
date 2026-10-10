// M18 SupabaseBackend RPC mappings (owner: W1 engineer 2). Installed by src/data/ext/supabase.ts. Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { M18Rpc } from './rpc';

export function makeSupabaseM18(x: SupabaseExtCtx): M18Rpc {
  return {
    careerReadiness: (personId, roleIds) => x.call('kafaa_career_readiness', { p_person: personId, p_role_ids: roleIds }, []),
    roadmapToPlan: (roadmapId) => x.call('kafaa_roadmap_to_plan', { p_roadmap: roadmapId }, ['roadmaps', 'dev_plans', 'plan_activities']),
    // F12 Career conversations
    conversationAgenda: (personId) => x.call('kafaa_conversation_agenda', { p_person: personId }, []),
    submitPrep: (prep, submit) => x.call('kafaa_submit_prep', { p_prep: prep, p_submit: submit }, ['career_conversations', 'notifications']),
    recordConversation: (input) => x.call('kafaa_record_conversation', { p_input: input }, ['career_conversations', 'dev_plans', 'plan_activities', 'notifications']),
    acknowledgeConversation: (id, agree, comment, addToCoach) => x.call('kafaa_acknowledge_conversation', { p_id: id, p_agree: agree, p_comment: comment, p_add_to_coach: addToCoach }, ['career_conversations', 'learning_goals', 'notifications']),
    setAspirationSharing: (id, on) => x.call('kafaa_set_aspiration_sharing', { p_id: id, p_on: on }, ['career_conversations']),
    talentAspirations: (personIds) => x.call('kafaa_talent_aspirations', { p_person_ids: personIds }, []),
    conversationInsights: () => x.call('kafaa_conversation_insights', {}, []),
    teamConversations: () => x.call('kafaa_team_conversations', {}, []),
    conversationReminders: () => x.call('kafaa_conversation_reminders', {}, ['notifications']),
    // FS15 / FS16 (FS wave B · E5)
    futureRoleReadiness: (personId, roleIds) => x.call('kafaa_future_role_readiness', { p_person: personId, p_role_ids: roleIds }, []),
    transitionEvidence: (fromRoleId, toRoleIds) => x.call('kafaa_transition_evidence', { p_from: fromRoleId, p_to: toRoleIds }, []),
    outlookLabelsPreview: (year) => x.call('kafaa_outlook_labels_preview', { p_year: year }, []),
    publishOutlookLabels: (year) => x.call('kafaa_publish_outlook_labels', { p_year: year }, ['role_outlook_labels', 'role_outlook_components']),
  };
}
