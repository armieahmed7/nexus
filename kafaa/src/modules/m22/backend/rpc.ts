// M22 RPC signatures (owner: W2 · E5 · F16 Leadership journeys, F17 Communities of practice). Merged into Rpc
// (src/data/types.ts) through src/data/ext/rpc.ts. Every RPC exists three times and they must agree: this signature,
// backend/local.ts and SQL kafaa_<name> in supabase/migrations/20261009125001_kafaa_w2e5_leadership.sql (+ backend/supabase.ts).
import type { Result } from '../../../data/types';
import type { ExpertRow, LeadershipStats, My360 } from '../domain';

export type { ExpertRow, LeadershipStats, My360 };

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
}
