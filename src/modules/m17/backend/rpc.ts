// M17 RPC signatures (owner: W1 · w1e1, F03 Skills Passport, F04 Credential Wallet). Merged into Rpc (src/data/types.ts)
// through src/data/ext/rpc.ts. Every RPC exists three times and they must agree: this signature, backend/local.ts and SQL
// kafaa_<name> in supabase/migrations/20261009111001_kafaa_w1e1_passport.sql (+ backend/supabase.ts mapping).
import type { Result } from '../../../data/types';
import type { CheckinSkill, CoverageRow, CrewRow, Distribution, Group, RaterOffset, TargetRow } from '../checkins';
import type { AwardView, DefInput, Eligibility } from '../microcred'; // W5 · E1 (F32)
import type { ConfidenceStats, HalfLivesInput } from '../decay'; // FS03 (future-skills wave A · E2)
import type { UnlockInput, UnlockView, ReportRow } from '../futureCreds'; // FS31 (wave D · E3)
import type { RecordItem, ShareInput, VerifyResult } from '../learnerRecord'; // FS32
import type { GoalInput } from '../skillGoals'; // FS33

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

// ───────────── W5 · E1 · F32 Stackable micro-credentials
// SQL: supabase/migrations/20261009151001_kafaa_w5e1_microcred_ojt.sql. Rules: src/modules/m17/microcred.ts.
export interface MicrocredCheck {
  found: boolean;
  slug: string;
  status?: AwardView;
  /** The signed OpenBadgeCredential (holder initials only, never a name). */
  credential?: Record<string, unknown>;
  key_id?: string;
  checked_on?: string;
  notice?: string;
  /** Components of a stacked credential with their status (public, no person data). */
  components?: { code: string; title_en: string; title_ar: string; slug: string | null; status: AwardView | 'none' }[];
}
export interface MicrocredStat { code: string; title_en: string; title_ar: string; kind: string; holders: number | null; pending: number | null; renewal_due: number | null; suppressed: boolean }
export type EligibilityResult = { allowed: true; person_id: string; items: Eligibility[] } | { allowed: false; code: 'not_signed_in' | 'forbidden' | 'not_found'; items: [] };
// ───────────── FS · wave A · E2 · FS03 Honest skill states. SQL: supabase/migrations/20261010212001_kafaa_fs12_decay.sql. Rules: src/modules/m17/decay.ts.
export interface SetHalfLivesResult {
  change_id: string;
  surface: 'skills';
  months: { fast: number; standard: number; slow: number };
  /** kafaa_skills_apply output for everyone after the change (people, states, evidence, digest). */
  recompute: { people: number; states: number; evidence: number; digest: string };
  /** Active states whose band or level changed; how many lost or gained a level. */
  moved: number;
  level_down: number;
  level_up: number;
}
export interface Fs03Rpc {
  /** FS03: decay classes, half-lives, bands by class and area, ageing, the micro-credential evidence back-fill and an optional what-if preview
   *  of other half-lives (read; platform admins and auditors, the training manager, HR aggregates; cells naming fewer than 10 people are null). */
  skillConfidenceStats(halfLives?: Record<string, number> | null): Promise<ConfidenceStats>;
  /** FS03: platform admins set the three half-lives (whole months 6-120, fast <= standard <= slow) with a rationale; logged as an engine
   *  change (cards versioned, ledger kafaa.ai.engine_change) and every skill state is recomputed. */
  setSkillHalfLives(input: HalfLivesInput): Promise<Result<SetHalfLivesResult>>;
}
// ───────────── FS · wave D · E3 · FS31 strategic tier, FS32 learner record, FS33 skill goals.
// SQL: supabase/migrations/20261010243001_kafaa_fs43_credentials_record_goals.sql. Rules: futureCreds.ts, learnerRecord.ts, skillGoals.ts.
export interface StrategicReport { allowed: boolean; rows: ReportRow[]; baseline: { people: number | null; moved: number | null; rate: number | null; suppressed: boolean }; window_days: number }
export interface TargetCheck { named: boolean; unlocked: boolean; codes: string[]; held: string[] }
export interface Fs4Rpc {
  /** FS31: framework owners put a published micro-credential in (or out of) the strategic tier, with a reason. Audited; ledger. */
  setMicrocredStrategic(code: string, strategic: boolean, note: string): Promise<Result<{ code: string; strategic: boolean }>>;
  /** FS31: framework owners name a strategic credential on a gig (F08 opportunity) or rotation (F15 template), or switch it off. Audited. */
  setCredentialUnlock(input: UnlockInput): Promise<Result<{ id: string; active: boolean }>>;
  /** FS31: the gigs and rotations that name a credential, with my state (read; yourself, a person in your scope, or anyone with skills_profile A). */
  credentialUnlocks(personId?: string | null): Promise<{ allowed: boolean; person_id: string | null; items: UnlockView[] }>;
  /** FS31 eligibility rule extension (F08/F15 hand-off): does a gig or rotation name a strategic credential, and do I hold one of them? */
  credentialTargetCheck(kind: 'opportunity' | 'rotation', targetId: string): Promise<TargetCheck>;
  /** FS31: strategic credentials against internal moves (correlation, never causation; under 10 suppressed). Training manager, HR, auditors. */
  strategicReport(): Promise<StrategicReport>;
  /** FS32: my shareable record items and the CLR-shaped bundle for a selection (all items when refs is null). Own read. */
  learnerRecord(refs?: string[] | null): Promise<{ allowed: boolean; items: RecordItem[]; bundle: Record<string, unknown> | null }>;
  /** FS32: create a share link after the three consent gates (1-30 items, expiry 1-90 days, up to 10 active links). Audited; ledger. */
  createRecordShare(input: ShareInput): Promise<Result<{ id: string; token: string; expires_on: string }>>;
  /** FS32: revoke one of my share links (the link then shows nothing personal). Audited; ledger. */
  revokeRecordShare(id: string, reason?: string | null): Promise<Result<{ id: string }>>;
  /** FS32: public verification by token (anyone; rate-limited; audited). Active: the shared items only, initials only. */
  verifyRecordShare(token: string): Promise<Result<VerifyResult>>;
  /** FS33: set or change a skill goal with a target level and date (and whether my manager may see it). Own; audited. */
  saveSkillGoal(input: GoalInput): Promise<Result<{ id: string; status: string; shared: boolean }>>;
  /** FS33: withdraw a goal at any time (it is unshared and the Coach stops weighing it). Own; audited. */
  withdrawSkillGoal(skillId: string): Promise<Result<{ id: string }>>;
  /** FS33: share an active goal with my manager, or make it private again. Own; audited. */
  shareSkillGoal(skillId: string, shared: boolean): Promise<Result<{ id: string; shared: boolean }>>;
}
export interface M17Rpc extends Fs03Rpc, Fs4Rpc {
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
  // W5 · E1 · F32 Stackable micro-credentials
  /** F32: eligibility for every published micro-credential (or one code) from F01 evidence (read): yourself, a person in your scope, or anyone (training manager). */
  microcredEligibility(personId: string | null, code?: string | null): Promise<EligibilityResult>;
  /** F32: earn a micro-credential (own): issued and signed when every criterion is met; sent for training-manager approval when it has manual criteria; renews an award due for renewal. */
  awardMicrocred(code: string): Promise<Result<{ id: string; status: string; slug: string | null }>>;
  /** F32: a training manager approves (re-checks the evidence, signs) or declines a request; never their own (maker_checker). Ledger. */
  decideMicrocredAward(awardId: string, decision: 'approve' | 'decline', note: string): Promise<Result<{ id: string; status: string; slug: string | null }>>;
  /** F32: withdraw (holder) or revoke (training manager) an award; stacked credentials that use it become "renewal due". Ledger. */
  revokeMicrocred(awardId: string, reason: string): Promise<Result>;
  /** F32: public verification by share slug (anyone; rate-limited; audited). */
  verifyMicrocred(slug: string): Promise<Result<MicrocredCheck>>;
  /** F32: framework owners save a draft definition (new code, or a new version of a published one). Copy check: no FANR certificate or licence wording. */
  saveMicrocredDef(input: DefInput): Promise<Result<{ id: string; version: number }>>;
  /** F32: publish a draft (the previous version is superseded) or retire a published definition. Ledger. */
  setMicrocredDefStatus(defId: string, status: 'current' | 'retired', note?: string | null): Promise<Result<{ id: string; status: string }>>;
  /** F32: training manager renewal sweep: notices for awards inside the renewal window, stacks with lapsed components, and expiries. */
  microcredSweep(): Promise<Result<{ checked: number; notices: number }>>;
  /** F32: holders, requests and renewals per micro-credential (read; exact for the training manager, under 10 suppressed for HR aggregates). */
  microcredStats(): Promise<{ allowed: boolean; exact: boolean; rows: MicrocredStat[] }>;
}
