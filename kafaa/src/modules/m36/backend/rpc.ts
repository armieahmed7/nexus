// M36 RPC signatures (owners: wave G E3 (FS64, FS65) and wave I E4 (FS82, FS83)). Merged into Rpc (src/data/types.ts) through src/data/ext/rpc.ts.
// Every RPC exists three times and they must agree: this signature, backend/local.ts and SQL kafaa_<name> (+ backend/supabase.ts mapping).
// SQL: supabase/migrations/20261010273001_kafaa_fs73_regional_pledges.sql. PGlite parity: scripts/validate/fs73-regional-pledges.mjs.
import type { Result } from '../../../data/types';
import type { CommitmentInput, DeliveryInput } from '../regional';
import type { Ledger, PledgeInput, ProgressInput } from '../pledges';

export interface ReleaseDemandInput { forecast_id: string; note_en: string; note_ar: string }
export interface ReviewCommitmentInput { commitment_id: string; decision: 'acknowledged' | 'queried'; note?: string | null }

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
}
