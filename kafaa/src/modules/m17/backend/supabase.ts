// M17 SupabaseBackend RPC mappings (owner: W1 · w1e1). Installed by src/data/ext/supabase.ts. Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { M17Rpc } from './rpc';

export function makeSupabaseM17(x: SupabaseExtCtx): M17Rpc {
  return {
    claimSkill: (i) => x.call('kafaa_claim_skill', { p_skill: i.skill_id, p_level: i.level, p_note: i.note, p_evidence_url: i.evidence_url ?? null }, ['skill_claims', 'skill_evidence', 'person_skills']),
    issueBadge: (sourceId) => x.call('kafaa_issue_badge', { p_source: sourceId }, ['badges', 'skill_evidence', 'person_skills']),
    revokeBadge: (badgeId, reason) => x.call('kafaa_revoke_badge', { p_badge: badgeId, p_reason: reason }, ['badges', 'skill_evidence', 'person_skills']),
    verifyBadge: (slug) => x.call('kafaa_verify_badge', { p_slug: slug }, []),
    // W2 · w2e1 (supabase/migrations/20261009121001_kafaa_w2e1_checkins.sql)
    requestCheckin: (i) => x.call('kafaa_request_checkin', { p: i }, ['skill_checkins', 'skill_ratings', 'notifications']),
    submitRating: (i) => x.call('kafaa_submit_rating', { p: i }, ['skill_ratings', 'notifications']),
    validateCheckin: (i) => x.call('kafaa_validate_checkin', { p: i }, ['skill_checkins', 'skill_ratings', 'skill_evidence', 'skill_claims', 'person_skills', 'notifications']),
    withdrawCheckin: (id, reason) => x.call('kafaa_withdraw_checkin', { p_id: id, p_reason: reason ?? null }, ['skill_checkins', 'skill_ratings']),
    checkinPeers: () => x.rpc('kafaa_checkin_peers'),
    checkinInbox: () => x.rpc('kafaa_checkin_inbox'),
    checkinCalibration: (g) => x.rpc('kafaa_checkin_calibration', { p_group: g }),
    teamCoverage: (g) => x.rpc('kafaa_team_coverage', { p_group: g }),
    setTeamTarget: (i) => x.call('kafaa_set_team_target', { p: i }, ['team_skill_targets']),
    // W5 · w5e1 · F32 (supabase/migrations/20261009151001_kafaa_w5e1_microcred_ojt.sql)
    microcredEligibility: (personId, code) => x.rpc('kafaa_microcred_eligibility', { p_person: personId ?? null, p_code: code ?? null }),
    awardMicrocred: (code) => x.call('kafaa_award_microcred', { p_code: code }, ['microcred_awards', 'skill_evidence', 'person_skills', 'notifications']),
    decideMicrocredAward: (id, decision, note) => x.call('kafaa_decide_microcred_award', { p_award: id, p_decision: decision, p_note: note }, ['microcred_awards', 'skill_evidence', 'person_skills', 'notifications']),
    revokeMicrocred: (id, reason) => x.call('kafaa_revoke_microcred', { p_award: id, p_reason: reason }, ['microcred_awards', 'skill_evidence', 'person_skills']),
    verifyMicrocred: (slug) => x.call('kafaa_verify_microcred', { p_slug: slug }, ['audit_events']),
    saveMicrocredDef: (input) => x.call('kafaa_save_microcred_def', { p: input }, ['microcred_defs']),
    setMicrocredDefStatus: (id, status, note) => x.call('kafaa_set_microcred_def_status', { p_def: id, p_status: status, p_note: note ?? null }, ['microcred_defs']),
    microcredSweep: () => x.call('kafaa_microcred_sweep', {}, ['notifications']),
    microcredStats: () => x.rpc('kafaa_microcred_stats'),
    // FS · wave A · E2 · FS03 (supabase/migrations/20261010212001_kafaa_fs12_decay.sql)
    skillConfidenceStats: (hl) => x.rpc('kafaa_skill_confidence_stats', { p_hl: hl ?? null }),
    setSkillHalfLives: (i) => x.call('kafaa_set_skill_half_lives', { p: i }, ['engine_settings', 'engine_changes', 'engine_cards', 'person_skills', 'skill_evidence']),
    // FS · wave D · E3 · FS31/FS32/FS33 (supabase/migrations/20261010243001_kafaa_fs43_credentials_record_goals.sql)
    setMicrocredStrategic: (code, strategic, note) => x.call('kafaa_set_microcred_strategic', { p_code: code, p_strategic: strategic, p_note: note }, ['microcred_defs']),
    setCredentialUnlock: (i) => x.call('kafaa_set_credential_unlock', { p: i }, ['microcred_unlocks']),
    credentialUnlocks: (personId) => x.rpc('kafaa_credential_unlocks', { p_person: personId ?? null }),
    credentialTargetCheck: (kind, targetId) => x.rpc('kafaa_credential_target_check', { p_kind: kind, p_target: targetId }),
    strategicReport: () => x.rpc('kafaa_strategic_report'),
    learnerRecord: (refs) => x.rpc('kafaa_learner_record', { p_refs: refs ?? null }),
    createRecordShare: (i) => x.call('kafaa_create_record_share', { p: i }, ['record_shares']),
    revokeRecordShare: (id, reason) => x.call('kafaa_revoke_record_share', { p_id: id, p_reason: reason ?? null }, ['record_shares']),
    verifyRecordShare: (token) => x.call('kafaa_verify_record_share', { p_token: token }, ['audit_events']),
    saveSkillGoal: (i) => x.call('kafaa_save_skill_goal', { p: i }, ['skill_goals', 'skill_goal_plans']),
    withdrawSkillGoal: (skillId) => x.call('kafaa_withdraw_skill_goal', { p_skill: skillId }, ['skill_goals', 'skill_goal_plans']),
    shareSkillGoal: (skillId, shared) => x.call('kafaa_share_skill_goal', { p_skill: skillId, p_shared: shared }, ['skill_goal_plans']),
  };
}
