// M17 SupabaseBackend RPC mappings (owner: W1 · w1e1). Installed by src/data/ext/supabase.ts. Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { M17Rpc } from './rpc';

export function makeSupabaseM17(x: SupabaseExtCtx): M17Rpc {
  return {
    claimSkill: (i) => x.call('kafaa_claim_skill', { p_skill: i.skill_id, p_level: i.level, p_note: i.note, p_evidence_url: i.evidence_url ?? null }, ['skill_claims', 'skill_evidence', 'person_skills']),
    issueBadge: (sourceId) => x.call('kafaa_issue_badge', { p_source: sourceId }, ['badges', 'skill_evidence', 'person_skills']),
    revokeBadge: (badgeId, reason) => x.call('kafaa_revoke_badge', { p_badge: badgeId, p_reason: reason }, ['badges', 'skill_evidence', 'person_skills']),
    verifyBadge: (slug) => x.call('kafaa_verify_badge', { p_slug: slug }, []),
  };
}
