// M22 RPC signatures (owner: W2 · E5 · F16 Leadership journeys, F17 Communities of practice). Merged into Rpc
// (src/data/types.ts) through src/data/ext/rpc.ts. Every RPC exists three times and they must agree: this signature,
// backend/local.ts and SQL kafaa_<name> in supabase/migrations/20261009125001_kafaa_w2e5_leadership.sql (+ backend/supabase.ts).
import type { Result } from '../../../data/types';
import type { ExpertRow, LeadershipStats, My360 } from '../domain';
import type { FlReadiness, FlStats, ProgrammeStats, WfnStats } from '../future';

export type { ExpertRow, LeadershipStats, My360, FlReadiness, FlStats, ProgrammeStats, WfnStats };

/** FS48: opt in (active true, with areas and ways to take part) or withdraw (active false: no trace left in any ranking). */
export interface WfnOptinInput { active: boolean; interests?: string[]; strands?: string[]; mentor?: boolean }
/** FS47: the participant's policy project (draft or submit). */
export interface PolicyProjectInput { nomination_id: string; title: string; question: string; summary: string; sponsor_role: string; submit?: boolean }
/** FS48: a request row as the programme owner sees it (rpc.wfnDesk). */
export interface WfnDeskRow { id: string; offer_id: string; offer_title_en: string; offer_title_ar: string; strand: string; person_id: string; person_name: string; person_name_ar: string; statement: string; status: string; outcome: string | null; note: string | null; created_at: string; updated_at: string }

export interface PostInput {
  community_id: string;
  /** Reply to this thread; omit to start a new thread (then `title` is required). */
  thread_id?: string | null;
  title?: string | null;
  body: string;
  lang?: 'en' | 'ar';
}
export interface QueueItem {
  post_id: string;
  thread_id: string;
  thread_title: string;
  community_id: string;
  author_name: string;
  author_name_ar: string;
  body: string;
  first_post: boolean;
  created_at: string;
}

export interface M22Rpc {
  // ── F16
  /** A line manager nominates someone they manage for a leadership programme (never themselves: self_nominate). Audited. */
  nominateLeader(personId: string, programmeId: string, reason: string): Promise<Result<{ id: string; status: string }>>;
  /** The HR authority or training manager approves or declines a nomination. Maker-checker: never the nominator or nominee. Ledger row. */
  decideNomination(id: string, decision: 'approved' | 'declined', note?: string): Promise<Result<{ status: string }>>;
  /** Ask 5 to 12 colleagues for leadership behaviours feedback this half-year (a self rating is added). Audited. */
  request360(raters: { person_id: string; kind: 'manager' | 'peer' | 'report' }[]): Promise<Result<{ cycle: string; invited: number; added: number }>>;
  /** Submit a 360 rating (every behaviour 1-5). Only the invited rater, once. Stored without the rater's identity. */
  submit360(requestId: string, scores: Record<string, number>): Promise<Result<{ status: string }>>;
  /** My own 360: counts and, with at least 5 responses (self excluded), aggregates only. */
  my360(cycle?: string | null): Promise<My360>;
  /** HR aggregates (skills_profile or talent_review Agg/A, auditors): 360 by grade and nominations by status, < 10 suppressed. Null otherwise. */
  leadershipStats(): Promise<LeadershipStats | null>;
  // ── F17
  /** Join or leave a community (staff). Stewards cannot leave. */
  joinCommunity(communityId: string, join: boolean): Promise<Result<{ member: boolean }>>;
  /** Start a thread or reply. Members only; security/safeguards/cyber content and contact details refused (category audited, never the text). First posts are held for a steward. */
  postThread(input: PostInput): Promise<Result<{ thread_id: string; post_id: string; status: 'published' | 'held' }>>;
  /** A steward of the community (or the training manager) publishes a held post or hides a post with a reason. Never their own post. */
  moderatePost(postId: string, decision: 'publish' | 'hide', note?: string): Promise<Result<{ status: string }>>;
  /** Held posts in the communities I steward (all for the training manager). */
  moderationQueue(): Promise<QueueItem[]>;
  /** Opt in to (or hide myself from) the expert finder, for skills at level 3 or above. */
  setExpertOptin(skillIds: string[], visible: boolean, headline?: string): Promise<Result<{ visible: boolean; skill_ids: string[] }>>;
  /** Expert finder: visible opted-in people with their current level >= 3 on the skills they listed. No contact details. */
  findExperts(skillId?: string | null): Promise<ExpertRow[]>;
  /** Send an in-app request to an opted-in expert (5 a day; message screened like posts). */
  requestExpert(expertId: string, skillId: string, message: string): Promise<Result<{ id: string }>>;
  /** The expert accepts or declines a request, with an optional short reply. */
  answerExpertRequest(id: string, decision: 'accepted' | 'declined', reply?: string): Promise<Result<{ status: string }>>;
  // ── FS46 (wave E · E4): 360 form 2. request360 / submit360 / my360 keep their signatures (form version handled inside).
  /** HR view of 360 form 2 by academy programme (approved or completed nominations), cells under 10 subjects suppressed. Null for others. */
  leadershipProgrammeStats(): Promise<ProgrammeStats | null>;
  // ── FS47 Future Leaders track (nominations live in leadership_nominations; selection is decideNomination)
  /** HR (HR analyst or HR director) nominates a staff member for the Future Leaders track. Audited, no ledger. */
  nominateFutureLeader(personId: string, reason: string): Promise<Result<{ id: string; status: string; cohort_id: string }>>;
  /** Readiness on the five nuclear-management competencies, for me or for Future Leaders nominees I can see (HR, training manager). */
  flReadiness(personIds: string[]): Promise<FlReadiness[]>;
  /** The training manager records (or clears) a completed module for a selected participant of a running cohort. Audited. */
  recordFlModule(nominationId: string, moduleId: string, done: boolean): Promise<Result<{ modules_done: string[] }>>;
  /** The selected participant saves or submits their policy project (screened like community posts). Audited. */
  savePolicyProject(input: PolicyProjectInput): Promise<Result<{ project_status: string }>>;
  /** The training manager or HR authority accepts or returns a submitted project; never their own. Completing the track writes a ledger row. */
  reviewPolicyProject(nominationId: string, decision: 'accept' | 'return', note?: string): Promise<Result<{ project_status: string; completed: boolean }>>;
  /** Track statistics (nominations, cohorts, modules, projects), every count under 10 suppressed. Null for others. */
  futureLeadersStats(): Promise<FlStats | null>;
  // ── FS48 Women in future nuclear skills (opt-in; HR aggregates only)
  setWfnOptin(input: WfnOptinInput): Promise<Result<{ active: boolean }>>;
  /** Join or leave a mentor circle (opted-in participants; mentors take the mentor seat). */
  joinWfnCircle(circleId: string, join: boolean): Promise<Result<{ member: boolean; role: string | null }>>;
  /** Ask for a visiting placement or sponsored study (opted-in participants; three open requests at most). */
  requestWfnOffer(offerId: string, statement: string): Promise<Result<{ id: string }>>;
  /** The programme owner (training manager) shortlists, places, completes (with outcome) or declines a request. Placement writes a ledger row. */
  decideWfnRequest(id: string, decision: 'shortlist' | 'place' | 'complete' | 'decline', note?: string, outcome?: 'progressed' | 'same_role'): Promise<Result<{ status: string }>>;
  /** Requests made to offers, for the programme owner only (empty for everyone else). */
  wfnDesk(): Promise<WfnDeskRow[]>;
  /** Pipeline metrics (participation, completion, progression, the gender share per future-skills programme), suppressed under 10. Null for others. */
  wfnStats(): Promise<WfnStats | null>;
}
