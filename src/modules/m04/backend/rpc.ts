// M04 extension RPC signatures (owner: W2 · E3, F13 Mentoring 2.0). Merged into Rpc through src/data/ext/rpc.ts.
// Every RPC exists three times and they agree: this signature, backend/local.ts and SQL kafaa_<name>
// (supabase/migrations/20261009123001_kafaa_w2e3_mentoring_refreshers.sql) + backend/supabase.ts.
import type { Result } from '../../../data/types';
import type { Cadence, Goal, MentoringType, ProgrammeStats, Rating, SkipCode } from '../mentoring';

export interface MentoringRequestInput {
  mentor_id: string;
  mentoring_type: MentoringType;
  skill_ids?: string[];
  message?: string;
}
export interface AgreementTermsInput {
  goals: Goal[];
  cadence: Cadence;
  starts_on: string;
  ends_on: string;
}
export interface SessionInput {
  held_on: string;
  minutes: number;
  skill_ids: string[];
  topics?: string;
  note_shared?: string;
  /** Stored in mentoring_private_notes, readable by the author only. */
  note_private?: string;
}
export interface CloseOutInput {
  ratings: Rating[];
  note?: string;
  /** Mentor of a knowledge-transfer agreement only: validate the mentee's open claims on goals rated met or better (SME only). */
  validate?: boolean;
}
export interface CloseOutResult {
  status: 'closing' | 'closed';
  attainment_pct: number | null;
  validated: { skill_id: string; claim_id: string }[];
  skipped: { skill_id: string; code: SkipCode }[];
}
export interface ReportingLine {
  line_manager: string | null;
  /** My line manager and the managers above them (up to three levels). */
  chain: string[];
}
export interface SmeNominee {
  mentor_id: string;
  person_id: string;
  role_id: string | null;
  skill_ids: string[];
  sme: boolean;
  sme_skill_ids: string[];
  sme_nominated_on: string | null;
}

export interface M04Rpc {
  /** F13: ask an opted-in mentor for mentoring of a given type, naming up to five skills. Never your own line manager (own_manager). Audited. */
  requestMentoring(input: MentoringRequestInput): Promise<Result<{ id: string }>>;
  /** F13: either person on a matched request proposes (or revises) the agreement: skill goals, cadence and dates. Audited. */
  proposeAgreement(requestId: string, terms: AgreementTermsInput): Promise<Result<{ id: string; status: 'proposed' }>>;
  /** F13: the other person accepts (active) or declines (the proposer may revise). Audited; acceptance is a ledger event. */
  respondAgreement(agreementId: string, decision: 'accept' | 'decline', note?: string): Promise<Result<{ id: string; status: string }>>;
  /** F13: either person logs a session on an active agreement; the private note is readable by its author only. Audited (no note text). */
  logSession(agreementId: string, input: SessionInput): Promise<Result<{ id: string; logged: number }>>;
  /** F13: each person rates goal attainment; the second close-out closes the agreement. An SME mentor's knowledge-transfer close-out can validate claims. */
  closeAgreement(agreementId: string, input: CloseOutInput): Promise<Result<CloseOutResult>>;
  /** F13: the mentor's line manager (or the training manager) nominates or withdraws a subject-matter expert, optionally for named skills. Ledger. */
  nominateSme(mentorId: string, on: boolean, skillIds?: string[]): Promise<Result<{ mentor_id: string; sme: boolean }>>;
  /** F13: mentors the caller may nominate as SMEs (their line, or everyone for the training manager). Read only. */
  smeNominees(): Promise<SmeNominee[]>;
  /** F13: my line manager and reporting chain, so matching never suggests my own line manager. Read only. */
  myReportingLine(): Promise<ReportingLine>;
  /** F13: programme dashboard for the training manager: pairs by type, completion and attainment, suppressed under 10 pairs. */
  mentoringProgramme(): Promise<Result<ProgrammeStats>>;
}
