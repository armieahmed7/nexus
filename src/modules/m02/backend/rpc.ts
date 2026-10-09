// M02 extension RPC signatures (owner: W4 · E5, F31 Instructor and SME pipeline). Merged into Rpc through src/data/ext/rpc.ts.
// Every RPC exists three times and they must agree: this signature, backend/local.ts and SQL kafaa_<name> (+ backend/supabase.ts).
import type { Result } from '../../../data/types';
import type { HoursInput, NominationInput, ObservationInput } from '../instructors';
import type { AckInput, LogInput, Readiness } from '../ojt'; // W5 · E1 (F38)

export interface PreceptorCard { id: string; name_en: string; name_ar: string; job_role_id: string | null; same_team: boolean; evaluator: boolean }

export interface M02Rpc {
  /** F31: nominate an SME for the instructor track: yourself (volunteer), a person in your team (line manager or qual_records Scope) or anyone (training manager, sat A). */
  nominateInstructor(input: NominationInput): Promise<Result<{ id: string; status: string }>>;
  /** F31: the training manager accepts (assigns the initial-training course) or declines a nomination; never their own. Ledger. */
  decideInstructorNomination(trackId: string, decision: 'accept' | 'decline', note?: string | null): Promise<Result<{ id: string; status: string; stage: string; enrolment_id: string | null }>>;
  /** F31: an instructor (sat W) records a co-teach, solo or currency observation; never on their own track. Ledger. */
  recordInstructorObservation(input: ObservationInput): Promise<Result<{ id: string; score: number; result: string; stage: string }>>;
  /** F31: the training manager qualifies a ready candidate (2 co-teach + 1 solo by three different observers; maker-checker) or reinstates a lapsed one. Writes evaluator_quals and F01 credential evidence. Ledger. */
  qualifyInstructor(trackId: string, note?: string | null): Promise<Result<{ id: string; qualified_on: string; currency_due: string; standards: number; reinstated: boolean }>>;
  /** F31: annual currency sweep (training manager): lapses instructors whose 12-month window ended short, renews the rest, sends 90/60/30-day notices. */
  instructorCurrencySweep(): Promise<Result<{ checked: number; renewed: number; lapsed: number; notices: number }>>;
  /** F31: log continuing development for yourself, or delivery/CPD hours for anyone on the track (training manager). */
  logTeachingHours(input: HoursInput): Promise<Result<{ id: string }>>;
  /** F31: add delivery hours from attended M04 sessions taught by the person (yourself, or everyone for the training manager with null). */
  syncTeachingHours(personId: string | null): Promise<Result<{ added: number; hours: number }>>;
  /** F31: close a track (the person or the training manager); a qualified instructor's evaluator rows end today. */
  withdrawInstructorTrack(trackId: string, note: string): Promise<Result<{ id: string; status: string }>>;
  // W5 · E1 · F38 OJT practice logbook (SQL: supabase/migrations/20261009151001_kafaa_w5e1_microcred_ojt.sql; rules: src/modules/m02/ojt.ts)
  /** F38: log a practice of a qualification task (own). Idempotent by client_key (offline re-sync records once). Never changes a qualification record. Refused for security-restricted tasks. */
  logPractice(input: LogInput): Promise<Result<{ id: string; duplicate: boolean; status: string }>>;
  /** F38: the preceptor named on an entry acknowledges it (feedback, "ready for evaluation") or returns it. */
  ackPractice(input: AckInput): Promise<Result<{ id: string; status: string; readiness: Readiness }>>;
  /** F38: hand a ready task to a qualified evaluator (own; a qualification record on the standard is needed). */
  requestEvaluation(taskId: string, evaluatorId: string, note?: string | null): Promise<Result<{ id: string }>>;
  /** F38: close a request: the evaluator completes it after signing the task off in M02 (or declines it); the trainee cancels it. */
  closeEvaluationRequest(requestId: string, action: 'complete' | 'decline' | 'cancel', note?: string | null): Promise<Result<{ id: string; status: string; evaluation_id: string | null; result: string | null }>>;
  /** F38: who can precept (or evaluate) a task for me (read): qualified on the standard or an evaluator for it. */
  ojtPreceptors(taskId: string): Promise<PreceptorCard[]>;
}
