// M17 RPC signatures (owner: W1 · w1e1, F03 Skills Passport, F04 Credential Wallet). Merged into Rpc (src/data/types.ts)
// through src/data/ext/rpc.ts. Every RPC exists three times and they must agree: this signature, backend/local.ts and SQL
// kafaa_<name> in supabase/migrations/20261009111001_kafaa_w1e1_passport.sql (+ backend/supabase.ts mapping).
import type { Result } from '../../../data/types';
import type { CheckinSkill, CoverageRow, CrewRow, Distribution, Group, RaterOffset, TargetRow } from '../checkins';

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

// ───────────── W2 · E1 · F10 Skill check-ins and F11 Team capability heatmap
// SQL: supabase/migrations/20261009121001_kafaa_w2e1_checkins.sql. Rules: src/modules/m17/checkins.ts.
export interface CheckinRequestInput {
  /** One to five skills, each with a self level (1-4) and an evidence note (3-300 characters). */
  skills: { skill_id: string; self_level: number; note: string }[];
  /** Up to two peers from the same team (job family when the person has no team); see rpc.checkinPeers(). */
  peer_ids: string[];
  /** Optional note to the raters (up to 300 characters). */
  message?: string | null;
}
export interface RatingInput {
  checkin_id: string;
  /** One row per skill addressed to me as a peer. level 1-4 with a one-line example (3-200), or 0 = "not observed". */
  ratings: { skill_id: string; level: number; example?: string | null }[];
}
export interface ValidateInput {
  checkin_id: string;
  /** One decision per skill: validate (at the self level), adjust (other level + reason) or not_yet (reason). */
  decisions: { skill_id: string; outcome: 'validate' | 'adjust' | 'not_yet'; level?: number | null; reason?: string | null }[];
  note?: string | null;
}
export interface TargetInput { team_id: string; skill_id: string; min_people: number; min_level: number; note?: string | null; active?: boolean }
export interface PersonCard { id: string; name_en: string; name_ar: string; job_role_id: string | null }
export interface CheckinPeers { me: string; manager: PersonCard | null; basis: 'team' | 'family' | null; peers: PersonCard[] }
export interface InboxItem {
  checkin_id: string; requester: PersonCard; requested_at: string; due_on: string; message: string | null; status: string;
  /** Only the skills named for me; never the requester's self levels, other skills or other raters' answers. */
  items: { skill_id: string; level: number | null; example: string | null; status: string }[];
}
export interface TeamMember { id: string; name_en: string; name_ar: string; initials: string; job_role_id: string | null; crew: string | null; team_id: string | null }
export interface TeamCoverage {
  mode: 'people' | 'aggregate';
  groups: Group[];
  group: string | null;
  size: number;
  suppressed: boolean;
  members: TeamMember[];
  skills: string[];
  /** Heatmap cells (people mode only): p person, s skill, l level, b basis. */
  cells: { p: string; s: string; l: number; b: string }[];
  coverage: CoverageRow[];
  targets: TargetRow[];
  crew_profile: TargetRow[];
  /** Crew view: counts and availability counts only (people mode). */
  crews: CrewRow[];
}
export interface CheckinCalibration {
  groups: Group[];
  group: string | null;
  size: number;
  suppressed: boolean;
  checkins: number;
  distributions: Distribution[];
  raters: (RaterOffset & { name_en: string; name_ar: string })[];
}
export type { CheckinSkill };
export interface M17Rpc {
  /** F03: self-claim a skill level. Own only; 20 claims a day; refused for security competencies (security_restricted). */
  claimSkill(input: ClaimInput): Promise<Result<{ id: string; level: number; state_level: number }>>;
  /** F04: wrap one of my valid Kafa'a course certificates or course completions in a signed badge (not_eligible otherwise). */
  issueBadge(sourceId: string): Promise<Result<{ id: string; slug: string }>>;
  /** F04: revoke a badge: the holder (withdraw) or a training manager. Audited and recorded in the ledger. */
  revokeBadge(badgeId: string, reason: string): Promise<Result>;
  /** F04: public verification by share slug. Rate-limited and audited; returns the signed credential and its status. */
  verifyBadge(slug: string): Promise<Result<BadgeCheck>>;
  /** F10: ask my line manager (and up to two peers) to validate up to five self-rated skills. Own; audited. */
  requestCheckin(input: CheckinRequestInput): Promise<Result<{ id: string; manager_id: string; due_on: string }>>;
  /** F10: a peer answers the rating rows addressed to them (level 1-4 + example, or 0 = not observed). Audited. */
  submitRating(input: RatingInput): Promise<Result<{ submitted: number }>>;
  /** F10: the line manager (or a manager in scope / training manager) validates or adjusts each skill. Never the person (self_validate). Writes validated rating evidence; ledger. */
  validateCheckin(input: ValidateInput): Promise<Result<{ status: string; written: number }>>;
  /** F10: the person withdraws an open check-in. Audited. */
  withdrawCheckin(checkinId: string, reason?: string | null): Promise<Result>;
  /** F10: my line manager and the colleagues I may ask as peers (read). */
  checkinPeers(): Promise<CheckinPeers>;
  /** F10: rating requests addressed to me as a peer (read). */
  checkinInbox(): Promise<InboxItem[]>;
  /** F10: calibration for a group in my scope: level distributions (suppressed below 10) and rater offsets (read; managers in scope). */
  checkinCalibration(groupKey: string | null): Promise<CheckinCalibration>;
  /** F11: people x skills heatmap, coverage against targets, single points of failure and the crew view (read; Scope/A people, Agg counts only). */
  teamCoverage(groupKey: string | null): Promise<TeamCoverage>;
  /** F11: set (or clear with active=false) a group's coverage target for a skill. Scope over the group or A; audited. */
  setTeamTarget(input: TargetInput): Promise<Result<{ id: string }>>;
}
