// M36 RPC signatures (owners: wave G E3 (FS64, FS65) and wave I E4 (FS82, FS83)). Merged into Rpc (src/data/types.ts) through src/data/ext/rpc.ts.
// Every RPC exists three times and they must agree: this signature, backend/local.ts and SQL kafaa_<name> (+ backend/supabase.ts mapping).
// SQL: supabase/migrations/20261010273001_kafaa_fs73_regional_pledges.sql (FS64/FS65) and 20261010294001_kafaa_fs94_grants_consortium.sql
// (FS82/FS83). PGlite parity: scripts/validate/fs73-regional-pledges.mjs, scripts/validate/fs94-grants-consortium.mjs.
import type { Result } from '../../../data/types';
import type { CommitmentInput, DeliveryInput } from '../regional';
import type { Ledger, PledgeInput, ProgressInput } from '../pledges';
import type { ApplicationInput, DecisionInput, GrantStats, OutputInput, ScheduleInput } from '../grants';
import type { ConsortiumStats, MemberDecisionInput, NominationInput, VisitInput as ConsortiumVisitInput } from '../consortium';

export interface ReleaseDemandInput { forecast_id: string; note_en: string; note_ar: string }
export interface ReviewCommitmentInput { commitment_id: string; decision: 'acknowledged' | 'queried'; note?: string | null }

export interface ReviewOutputInput { application_id: string; decision: 'accept' | 'return'; note?: string | null }
export interface ConfirmConsortiumVisitInput { visit_id: string; decision: 'confirm' | 'decline'; reason?: string | null; host_ref?: string | null }
/** A visit as its host sees it: trainee code and visiting organisation only (never a member row or a person). */
export interface HostVisit {
  id: string; cohort_id: string; trainee_code: string; org_id: string; org_name_en: string; org_name_ar: string; host_org_id: string; module_id: string | null;
  visit_on: string; hours: number; note: string; skill_id: string; status: string; level: number; confirmed_via: string | null; route: 'host' | 'enec_host' | 'on_behalf';
}

export interface M36Rpc {
  /** FS64: the HR director (workforce_strategy A and ecosystem W) releases a RELEASED FS51 forecast to providers as regional aggregates
   *  (cells of 1-9 suppressed; security skills never); the previous release becomes superseded; the note EN/AR passes the headcount/site
   *  check; audit + ledger. */
  releaseRegionalDemand(input: ReleaseDemandInput): Promise<Result<{ release_id: string; rows: number; superseded: string | null }>>;
  /** FS64: a partner or university administrator (ecosystem OrgW) creates, revises or withdraws a commitment for their own organisation
   *  only; started terms are locked; another organisation's commitment reads as not found; audit + ledger. */
  commitProvision(input: CommitmentInput): Promise<Result<{ id: string; version: number; status: string }>>;
  /** FS64: the provider reports one term's delivery (enrolled, completed) for a term that has started; audited. */
  reportCommitmentDelivery(input: DeliveryInput): Promise<Result<{ id: string; term: string; status: string }>>;
  /** FS64: HR (ecosystem W) acknowledges a commitment or queries it with a note; audited. */
  reviewCommitment(input: ReviewCommitmentInput): Promise<Result<{ id: string; hr_status: string }>>;
  /** FS65: register a pledge: a partner or university administrator (OrgW) for their own organisation, HR (ecosystem W) for an ENEC
   *  entity; audit + ledger. */
  registerPledge(input: PledgeInput): Promise<Result<{ id: string }>>;
  /** FS65: record a dated progress snapshot (started, completed; cumulative, never decreasing); same organisation rule; audited. */
  recordPledgeProgress(input: ProgressInput): Promise<Result<{ id: string; status: string }>>;
  /** FS65: the aggregate ledger (ecosystem R/Agg/W/A or OwnOrg): pledged, started and completed kept apart; cells under 10 people or from
   *  fewer than two organisations suppressed. Read-only; a refusal is audited. */
  pledgeLedger(): Promise<Result<Ledger>>;

  // ───────────── FS82 Rolling mobility micro-grants
  /** FS82: HR (ecosystem W/A + workforce_strategy W/A) schedules the next bi-monthly round (dates computed: contiguous, deadline the 10th of
   *  an even month); only when no round is waiting to open; budget and maximum award SIMULATED; audit + ledger. */
  scheduleGrantRound(input: ScheduleInput): Promise<Result<{ id: string; opens_on: string; closes_on: string; decide_by: string }>>;
  /** FS82: an early-career staff member applies in the open round (one application per round); HR (ecosystem W) files for a student on an
   *  ENEC-sponsored placement with a consent reference (assessor-on-behalf); audited. */
  applyGrant(input: ApplicationInput): Promise<Result<{ id: string; round_id: string; amount: number }>>;
  /** FS82: the applicant withdraws a submitted application; audited. */
  withdrawGrant(applicationId: string): Promise<Result<{ id: string; status: string }>>;
  /** FS82: the HR director decides after the round's deadline (never their own application), within the round's SIMULATED budget; audit + ledger. */
  decideGrant(input: DecisionInput): Promise<Result<{ id: string; status: string; awarded: number | null; committed: number }>>;
  /** FS82: the grantee logs the promised output (report or presentation) after the activity; audited. */
  submitGrantOutput(input: OutputInput): Promise<Result<{ id: string; output_status: string }>>;
  /** FS82: HR (never the grantee) accepts the output (evidence: F01 rating/validated on the named skill for staff) or returns it with a note; audit + ledger on accept. */
  reviewGrantOutput(input: ReviewOutputInput): Promise<Result<{ id: string; output_status: string; level: number | null; profile_evidence: boolean }>>;
  /** FS82: programme statistics for staff, HR and auditors; every count of 1-9 suppressed. Read-only; a refusal is audited. */
  grantStats(): Promise<Result<GrantStats>>;

  // ───────────── FS83 UAE energy consortium trainee cohort
  /** FS83: a partner administrator (ecosystem OrgW) nominates a pseudonymous trainee of their own organisation; HR (ecosystem W) nominates
   *  an ENEC staff trainee; audited. */
  nominateConsortiumTrainee(input: NominationInput): Promise<Result<{ id: string; trainee_code: string }>>;
  /** FS83: the HR director accepts (mentor from another consortium organisation + project team) or declines with a note; audit + ledger. */
  decideConsortiumMember(input: MemberDecisionInput): Promise<Result<{ id: string; status: string }>>;
  /** FS83: the trainee, their employer's administrator or the programme office logs a cross-site visit to another consortium organisation; audited. */
  logConsortiumVisit(input: ConsortiumVisitInput): Promise<Result<{ id: string; status: string }>>;
  /** FS83: only the host confirms or declines (host administrator; ENEC programme office for ENEC sites; programme office on behalf of a host
   *  without Kafa'a access with the host's reference); never the visitor or the logger. Confirmation writes evidence; audit + ledger. */
  confirmConsortiumVisit(input: ConfirmConsortiumVisitInput): Promise<Result<{ id: string; status: string; level: number; profile_evidence: boolean }>>;
  /** FS83: the trainee or whoever logged it withdraws a visit still waiting for the host; audited. */
  withdrawConsortiumVisit(visitId: string): Promise<Result<{ id: string; status: string }>>;
  /** FS83: the visits my organisation hosts (or, for the programme office, ENEC sites and hosts without Kafa'a access), as the host sees them. */
  consortiumHostVisits(): Promise<Result<HostVisit[]>>;
  /** FS83: cohort aggregates for every ecosystem reader; counts of 1-9 suppressed. */
  consortiumStats(): Promise<Result<ConsortiumStats>>;
}
