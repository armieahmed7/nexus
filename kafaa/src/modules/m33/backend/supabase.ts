// M33 SupabaseBackend RPC mappings (owners: wave C E5 (FS25, FS26) and wave F E5 (FS58, FS59)). Installed by src/data/ext/supabase.ts.
// x.call('kafaa_<name>', { p_... }, ['<tables touched>']) for Result-returning RPCs; x.rpc(fn, args) for plain reads.
// FS25/FS26 SQL: supabase/migrations/20261010235001_kafaa_fs35_core_skills.sql; FS58/FS59: 20261010265001_kafaa_fs65_aps_roleplay.sql. Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { CoreProfile, CoreStats } from '../coreSkills';
import type { SjtStats } from '../sjt';
import type { ApsStats } from '../aps';
import type { RpStats } from '../roleplay';
import type { ApsContext, M33Rpc, RpContext, RpQueue, RpReviewer, SjtContext } from './rpc';

export function makeSupabaseM33(x: SupabaseExtCtx): M33Rpc {
  return {
    coreSkillsMine: async () => (await x.rpc<CoreProfile | null>('kafaa_core_skills_mine')) ?? null,
    coreSkillsStats: async () => (await x.rpc<CoreStats | null>('kafaa_core_skills_stats')) ?? null,
    startSjt: (input) => x.call('kafaa_start_sjt', { p: input ?? {} }, ['sjt_attempts']),
    submitSjt: (input) => x.call('kafaa_submit_sjt', { p: input ?? {} }, ['sjt_attempts']),
    sjtContext: async () => (await x.rpc<SjtContext | null>('kafaa_sjt_context')) ?? null,
    sjtStats: async () => (await x.rpc<SjtStats | null>('kafaa_sjt_stats')) ?? null,
    saveSjtItem: (input) => x.call('kafaa_save_sjt_item', { p: input ?? {} }, ['sjt_items']),
    // FS58/FS59 (wave F · E5): supabase/migrations/20261010265001_kafaa_fs65_aps_roleplay.sql
    startAps: (input) => x.call('kafaa_start_aps', { p: input ?? {} }, ['aps_attempts']),
    submitAps: (input) => x.call('kafaa_submit_aps', { p: input ?? {} }, ['aps_attempts']),
    apsContext: async () => (await x.rpc<ApsContext | null>('kafaa_aps_context')) ?? null,
    apsStats: async () => (await x.rpc<ApsStats | null>('kafaa_aps_stats')) ?? null,
    saveApsScenario: (input) => x.call('kafaa_save_aps_scenario', { p: input ?? {} }, ['aps_scenarios']),
    startRoleplay: (input) => x.call('kafaa_start_roleplay', { p: input ?? {} }, ['roleplay_sessions']),
    roleplayTurn: (input) => x.call('kafaa_roleplay_turn', { p: input ?? {} }, ['roleplay_sessions']),
    roleplayContext: async () => (await x.rpc<RpContext | null>('kafaa_roleplay_context')) ?? null,
    roleplayReviewers: async () => (await x.rpc<RpReviewer[] | null>('kafaa_roleplay_reviewers')) ?? null,
    requestRoleplayReview: (input) => x.call('kafaa_request_roleplay_review', { p: input ?? {} }, ['roleplay_sessions', 'notifications']),
    withdrawRoleplayReview: (sessionId) => x.call('kafaa_withdraw_roleplay_review', { p_session_id: sessionId }, ['roleplay_sessions']),
    roleplayReviewQueue: async () => (await x.rpc<RpQueue | null>('kafaa_roleplay_review_queue')) ?? null,
    attachRoleplayEvidence: (input) => x.call('kafaa_attach_roleplay_evidence', { p: input ?? {} }, ['roleplay_sessions', 'skill_evidence', 'person_skills', 'notifications']),
    roleplayStats: async () => (await x.rpc<RpStats | null>('kafaa_roleplay_stats')) ?? null,
    saveRoleplayScenario: (input) => x.call('kafaa_save_roleplay_scenario', { p: input ?? {} }, ['roleplay_scenarios']),
  };
}
