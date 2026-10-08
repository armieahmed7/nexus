/**
 * G2 RPC signatures (M04 learning and training, M05 assessments). Part of `Rpc` (src/data/types.ts extends this).
 * Every method exists three times and they agree:
 *   - LocalBackend:    src/data/local/rpc_g2.ts
 *   - SupabaseBackend: src/data/supabase/rpc_g2.ts  ->  SQL kafaa_* functions in supabase/migrations/20261008132001_kafaa_g2_learning.sql
 * Business refusals never throw; they return { ok:false, code, message } and write an audit row.
 */
import type { Result } from './types';

export type EnrolmentDecision = 'approve' | 'reject';
export type Attendance = 'present' | 'absent' | 'excused';
export type CompletionResult = 'passed' | 'failed' | 'completed';

export interface ItemOption {
  id: string;
  en: string;
  ar: string;
}
/** Create an item (no id) or a new version of an existing one (id). Writer = caller; the item goes back to draft. */
export interface ItemInput {
  id?: string | null;
  bank: 'secure' | 'practice';
  topic: string;
  competency_id: string | null;
  difficulty: 'easy' | 'medium' | 'hard';
  reference: string | null;
  stem_en: string;
  stem_ar: string;
  options: ItemOption[];
  answer: string;
  rationale_en: string;
  rationale_ar: string;
  change_note: string;
}
/** An item as delivered to a candidate: never carries the key or the rationale. */
export interface DeliveredItem {
  item_id: string;
  version: number;
  stem_en: string;
  stem_ar: string;
  options: ItemOption[];
}
export interface AttemptFeedback {
  score: number | null;
  passed: boolean | null;
  pass_mark: number;
  total: number;
  correct: number;
  by_competency: { competency_id: string | null; correct: number; total: number }[];
}

export interface G2Rpc {
  // ───── M04 enrolment, sessions, completion, approvals
  /** Enrol in a course (optionally a session). personId omitted = self. Electives a learner picks go to 'requested'. */
  enrolCourse(courseId: string, sessionId: string | null, personId?: string | null): Promise<Result<{ id: string; status: string }>>;
  /** Manager or training manager approves or rejects a requested enrolment (not their own). */
  decideEnrolment(enrolmentId: string, decision: EnrolmentDecision, note: string): Promise<Result<{ status: string }>>;
  /** Seats taken and waitlist length per session of a course (counts only, no names): learners cannot read others' enrolments. */
  sessionAvailability(courseId: string): Promise<Result<{ session_id: string; capacity: number; taken: number; waiting: number }[]>>;
  /** Learner withdraws (mandatory assignments go back to 'assigned') or a coordinator cancels; promotes the waitlist. */
  cancelEnrolment(enrolmentId: string, reason: string): Promise<Result<{ status: string; promoted: string | null }>>;
  /** Instructor records attendance for a session that has started. */
  recordAttendance(sessionId: string, marks: { enrolment_id: string; attendance: Attendance }[]): Promise<Result<{ updated: number }>>;
  /** Record completion. Qualifying courses need their linked evaluation passed and released; certificates only after a pass. */
  completeEnrolment(enrolmentId: string, result: CompletionResult, score: number | null, note: string): Promise<Result<{ status: string; certificate_no: string | null; record_id: string | null }>>;
  /** Manager or training manager decides an external course request. */
  decideExternalRequest(id: string, decision: 'approved' | 'rejected', note: string): Promise<Result>;
  /** One sync cycle: assign the mandatory curriculum of each person's current role and withdraw unstarted assignments of a previous role. */
  curriculumSync(personId: string | null): Promise<Result<{ people: number; assigned: number; withdrawn: number }>>;
  /** Manager approves or returns a submitted development plan. */
  decideDevPlan(planId: string, decision: 'approve' | 'return', note: string): Promise<Result>;
  /** Mentor accepts or declines; requester or mentor closes. Human matching only. */
  respondMentoring(requestId: string, decision: 'matched' | 'declined' | 'closed'): Promise<Result>;

  // ───── M05 item bank, delivery, results, appeals
  saveItem(p: ItemInput): Promise<Result<{ id: string; version: number }>>;
  retireItem(itemId: string, reason: string): Promise<Result>;
  /** Schedule an exam (first attempt or a retake under the form's rules). */
  scheduleAttempt(formId: string, personId: string, scheduledFor: string, proctorPersonId: string | null): Promise<Result<{ id: string; attempt_no: number }>>;
  /** Candidate opens a scheduled exam: starts the clock and receives the items without the key. */
  startAttempt(attemptId: string): Promise<Result<{ deadline_at: string; time_limit_min: number; items: DeliveredItem[] }>>;
  /** Candidate submits; scored on the server; the result stays hidden until an evaluator releases it. */
  submitAttempt(attemptId: string, answers: { item_id: string; answer: string | null }[]): Promise<Result<{ late: boolean; answered: number }>>;
  /** Evaluator sign-off: releases a graded result to the candidate. */
  releaseAttempt(attemptId: string, note: string): Promise<Result<{ passed: boolean | null; score: number | null }>>;
  /** Evaluator records a performance evaluation (OJT, JPM-based or simulator form) for a candidate; released on record. */
  recordPerformance(formId: string, personId: string, passed: boolean, score: number | null, note: string): Promise<Result<{ id: string }>>;
  /** Candidate feedback after release: score and per-competency breakdown, never item text or keys. */
  attemptFeedback(attemptId: string): Promise<Result<AttemptFeedback>>;
  fileAppeal(attemptId: string, reason: string, itemId: string | null): Promise<Result<{ id: string }>>;
  /** Training manager decides an appeal; upheld appeals can void items (rescored) and the attempt stops counting toward the limit. */
  decideAppeal(appealId: string, decision: 'upheld' | 'rejected', note: string, voidItemIds: string[]): Promise<Result<{ score: number | null; passed: boolean | null }>>;
}

/** Tables each G2 RPC touches (SupabaseBackend emits these so hooks refetch). */
export const G2_TOUCHED: Record<keyof G2Rpc, string[]> = {
  enrolCourse: ['enrolments'],
  decideEnrolment: ['enrolments'],
  sessionAvailability: [],
  cancelEnrolment: ['enrolments'],
  recordAttendance: ['enrolments'],
  completeEnrolment: ['enrolments', 'training_records', 'certificates'],
  decideExternalRequest: ['external_requests'],
  curriculumSync: ['enrolments'],
  decideDevPlan: ['dev_plans'],
  respondMentoring: ['mentoring_requests'],
  saveItem: ['items', 'item_versions'],
  retireItem: ['items'],
  scheduleAttempt: ['attempts'],
  startAttempt: ['attempts'],
  submitAttempt: ['attempts', 'responses'],
  releaseAttempt: ['attempts'],
  recordPerformance: ['attempts'],
  attemptFeedback: [],
  fileAppeal: ['appeals'],
  decideAppeal: ['appeals', 'attempts'],
};
