// M17 RPC signatures (owner: W1 · w1e1, F03 Skills Passport, F04 Credential Wallet). Merged into Rpc (src/data/types.ts)
// through src/data/ext/rpc.ts. Every RPC exists three times and they must agree: this signature, backend/local.ts and SQL
// kafaa_<name> in supabase/migrations/20261009111001_kafaa_w1e1_passport.sql (+ backend/supabase.ts mapping).
import type { Result } from '../../../data/types';

export interface ClaimInput {
  skill_id: string;
  /** 1 to 4 (proficiency levels). */
  level: number;
  /** Short note: what you did that shows this level (3 to 500 characters). */
  note: string;
  /** Optional link to evidence (http or https, up to 300 characters). */
  evidence_url?: string | null;
}
export interface BadgeCheck {
  found: boolean;
  slug: string;
  status?: 'active' | 'expired' | 'revoked';
  /** The signed OpenBadgeCredential (holder initials only, never a name). */
  credential?: Record<string, unknown>;
  key_id?: string;
  checked_on?: string;
  notice?: string;
}
export interface M17Rpc {
  /** F03: self-claim a skill level. Own only; 20 claims a day; refused for security competencies (security_restricted). */
  claimSkill(input: ClaimInput): Promise<Result<{ id: string; level: number; state_level: number }>>;
  /** F04: wrap one of my valid Kafa'a course certificates or course completions in a signed badge (not_eligible otherwise). */
  issueBadge(sourceId: string): Promise<Result<{ id: string; slug: string }>>;
  /** F04: revoke a badge: the holder (withdraw) or a training manager. Audited and recorded in the ledger. */
  revokeBadge(badgeId: string, reason: string): Promise<Result>;
  /** F04: public verification by share slug. Rate-limited and audited; returns the signed credential and its status. */
  verifyBadge(slug: string): Promise<Result<BadgeCheck>>;
}
