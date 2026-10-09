// M18 RPC signatures (owner: W1 engineer 2). Merged into Rpc (src/data/types.ts) through src/data/ext/rpc.ts.
// Every RPC exists three times and they must agree: this signature, backend/local.ts and SQL kafaa_<name> (+ backend/supabase.ts mapping).
import type { Result } from '../../../data/types';
import type { CareerReadiness } from '../career';
import type { Agenda, AspirationSignal, ConversationInsights, PrepInput, TeamRow } from '../conversations';

export interface RoadmapToPlanResult {
  plan_id: string;
  plan_created: boolean;
  created: number;
  existing: number;
}
/** F12: what the manager records (an existing shared conversation, or a new one for a report of record). */
export interface RecordConversationInput {
  conversation_id?: string | null;
  person_id?: string | null;
  held_on: string;
  notes: string;
  actions: { id?: string; kind: string; title: { en: string; ar: string }; due_on?: string | null; course_id?: string | null; owner?: string }[];
  focus_role_id?: string | null;
  coach_hours?: number | null;
}
export interface SubmitPrepResult { id: string; status: string; submitted: boolean; manager_person_id: string | null }
export interface RecordConversationResult { id: string; person_id: string; plan_id: string | null; created: number; updated: number }
export interface AcknowledgeResult { id: string; agree: boolean; coach_updated: boolean }
export interface ReminderResult { pairs: number; overdue: number; created: number }
export interface M18Rpc {
  /** F05: per-role readiness %, gates and reasons for a person (read-only; same computation in SQL and TS). Self, or a line manager in scope when the person shares a shortlist or roadmap. */
  careerReadiness(personId: string, roleIds: string[]): Promise<Result<CareerReadiness[]>>;
  /** F06: write a saved roadmap's development blocks into the person's development plan (draft plan created when none is open). Own roadmap only; idempotent; audited and ledgered. */
  roadmapToPlan(roadmapId: string): Promise<Result<RoadmapToPlanResult>>;
  /** F12: the pre-filled agenda, built on the server. Self: everything; the line manager of record: passport, expiring
   *  qualifications, the last conversation and only the shortlist and roadmap the person shares (never coach data). */
  conversationAgenda(personId: string): Promise<Result<Agenda>>;
  /** F12: save (submit=false) or share (submit=true) my preparation for the next conversation; builds the agenda snapshot with my include choices. */
  submitPrep(prep: PrepInput, submit: boolean): Promise<Result<SubmitPrepResult>>;
  /** F12: the line manager of record records the conversation: notes and agreed actions; actions become draft plan activities. Ledgered. */
  recordConversation(input: RecordConversationInput): Promise<Result<RecordConversationResult>>;
  /** F12: only the employee acknowledges (optionally disagreeing with a comment); can add the focus role and weekly hours to the coach. Ledgered. */
  acknowledgeConversation(id: string, agree: boolean, comment: string, addToCoach: boolean): Promise<Result<AcknowledgeResult>>;
  /** F12: the employee's consent to show the aspiration in talent review (F18). Ledgered. */
  setAspirationSharing(id: string, on: boolean): Promise<Result<{ id: string; share_with_talent_review: boolean }>>;
  /** F12 → F18: aspiration signals for people in the caller's talent-review scope; only shared ones carry content. Audited. */
  talentAspirations(personIds: string[]): Promise<Result<AspirationSignal[]>>;
  /** F12: HR aggregates by job family (skills_profile Agg/A), suppressed below MIN_GROUP_SIZE. */
  conversationInsights(): Promise<Result<ConversationInsights>>;
  /** F12: my reports of record (line manager) with cadence and the conversation I can see. */
  teamConversations(): Promise<Result<TeamRow[]>>;
  /** F12: six-monthly reminder sweep: notifications to both sides of each overdue pair (my reports; everyone for skills_profile A). Idempotent per month. */
  conversationReminders(): Promise<Result<ReminderResult>>;
}
