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
  };
}
