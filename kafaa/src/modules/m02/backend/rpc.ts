// M02 extension RPC signatures (owner: W4 · E5, F31 Instructor and SME pipeline). Merged into Rpc through src/data/ext/rpc.ts.
// Every RPC exists three times and they must agree: this signature, backend/local.ts and SQL kafaa_<name> (+ backend/supabase.ts).
import type { Result } from '../../../data/types';
import type { HoursInput, NominationInput, ObservationInput } from '../instructors';
import type { AckInput, LogInput, Readiness } from '../ojt'; // W5 · E1 (F38)
import type { DescriptorInput, RangeInput } from '../descriptors'; // FS wave C · E4 (FS23)
import type { ProposeInput } from '../authority'; // FS wave C · E4 (FS24)

export interface PreceptorCard { id: string; name_en: string; name_ar: string; job_role_id: string | null; same_team: boolean; evaluator: boolean }

/** FS24: rpc.recogniseAuthority input. `propose` needs person_id, skill_id, panel and the citation; the decisions need id (+ note). */
export interface AuthorityInput extends ProposeInput { id?: string | null; note?: string | null }
/** FS24: an Expert (level 4) holder the panel can consider, with any recognition already on the skill. */
export interface AuthorityCandidate {
  person_id: string; name_en: string; name_ar: string; job_role_id: string | null; skill_id: string; basis: string; confidence: number;
  recognition_id: string | null; recognition_status: string | null;
}

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
  // FS wave C · E4 · FS23/FS24 (SQL: supabase/migrations/20261010234001_kafaa_fs34_descriptors_scale.sql; rules: src/modules/m02/descriptors.ts, authority.ts)
  /** FS23: create or edit a skill's descriptor at one level (frameworks W/A). In-range levels are always published; out-of-range levels are drafts. Version bumps. Audited, no ledger. */
  saveDescriptor(input: DescriptorInput): Promise<Result<{ id: string; status: string; version: number }>>;
  /** FS23: set the levels where a skill exists with its rationale (frameworks W/A). Every level in range needs a descriptor; in-range drafts are published, published rows outside are archived (never deleted). Audited. */
  setLevelRange(input: RangeInput): Promise<Result<{ skill_id: string; min_level: number; max_level: number; published: number; archived: number; version: number }>>;
  /** FS24: propose (training manager or HR director), approve / not_yet (HR director, never the proposer) or withdraw an Authority recognition. Approve and withdraw of a current recognition write a ledger row. Never changes a skill level. */
  recogniseAuthority(input: AuthorityInput): Promise<Result<{ id: string; status: string }>>;
  /** FS24: Expert (level 4) holders on non-restricted, non-obsolete skills, with their recognition state (recognition R/W/A only; else []). */
  authorityCandidates(): Promise<AuthorityCandidate[]>;
}
