// FS17 + FS18 (FS wave C · E1, M19) RPC signatures, merged into M19Rpc (backend/rpc.ts). Every RPC exists three times and they agree:
// this signature, backend/local.fs17.ts and SQL kafaa_<name> in supabase/migrations/20261010231001_kafaa_fs31_pathways_catalogue.sql
// (+ backend/supabase.ts mapping). Reads return plain data (null when the caller may not read); writes return Result and are audited.
import type { Result } from '../../../data/types';
import type { CatalogueCheck, PathwayInput, PathwayProgress, PeerStats, ResolvedPathway } from '../pathways';

export interface PathwaySummary {
  id: string;
  skill_id: string;
  level: number;
  envelope_months: number;
  weekly_hours: number;
  weeks: number;
  total_hours: number;
  steps: number;
  requested: number;
  peer: PeerStats;
  /** My enrolment status on it (active | completed | withdrawn), or null. */
  mine: string | null;
}
export interface PathwayCatalogue { min_group: number; pathways: PathwaySummary[] }
export interface PathwayDetail {
  pathway_id: string;
  resolved: ResolvedPathway;
  peer: PeerStats;
  /** My enrolment and progress (derived from my records); null when I have none or may not follow pathways. */
  mine: { enrolment_id: string; status: string; started_on: string; completed_on: string | null; progress: PathwayProgress } | null;
  can_follow: boolean;
}
export interface PathwayGapsResult { open: number; filled: number; added: number }
export interface ExternalInput {
  id?: string;
  title_en?: string; title_ar?: string; provider_en?: string; provider_ar?: string; provider_url?: string; url?: string; format?: string;
  hours?: number | null; duration_en?: string; duration_ar?: string; cost_band?: string; languages?: string[]; skills?: { skill_id: string; level: number }[];
  has_assessment?: boolean; summary_en?: string; summary_ar?: string; criteria?: Record<string, number>; criteria_note_en?: string; criteria_note_ar?: string; as_of?: string;
}

export interface M19PathwaysRpc {
  /** FS17: every published pathway with its envelope, weekly hours, requested steps, colleagues' completion times (suppressed under 10) and my status. Staff (internal_content R). */
  pathwayCatalogue(): Promise<PathwayCatalogue | null>;
  /** FS17: one pathway resolved at run time (resolvePathway), peers (suppressed under 10) and my derived progress. */
  pathwayDetail(pathwayId: string): Promise<PathwayDetail | null>;
  /** FS17: start a published pathway (skills_profile Own). Refused when already following it, already holding the level, or with three active. Audited. */
  startPathway(pathwayId: string): Promise<Result<{ id: string; status: string }>>;
  /** FS17: mark my pathway complete; refused while any step is not done (progress derived from my records). Audited. */
  completePathway(pathwayId: string): Promise<Result<{ id: string; status: string; self_declared: number }>>;
  /** FS17: leave a pathway (optional reason). Audited. */
  withdrawPathway(pathwayId: string, reason?: string | null): Promise<Result<{ id: string; status: string }>>;
  /** FS17: create or edit a pathway and its steps (training manager). Checked by pathwayProblems; a published edit bumps the version. Audited. */
  savePathway(input: PathwayInput): Promise<Result<{ id: string; version: number; status: string }>>;
  /** FS17: recompute the FS57 gap backlog from the requested steps of published pathways (training manager). Audited. */
  refreshPathwayGaps(): Promise<Result<PathwayGapsResult>>;
  /** FS18: the publish gate for a draft (any staff reader may preview it): problems and failing criteria. */
  checkExternalResource(input: ExternalInput): Promise<CatalogueCheck>;
  /** FS18: create or edit an external resource as a draft (training manager). Audited. */
  saveExternalResource(input: ExternalInput): Promise<Result<{ id: string; version: number; status: string; check: CatalogueCheck }>>;
  /** FS18: publish; refused (criteria_failed / invalid) unless the resource meets every required published criterion. Audited. */
  publishExternalResource(id: string): Promise<Result<{ id: string; status: string }>>;
  /** FS18: retire with a reason (never deleted). Audited. */
  retireExternalResource(id: string, reason: string): Promise<Result<{ id: string; status: string }>>;
  /** FS18: record my completion of a published resource: self-declared, an xAPI "experienced" statement; never verified skill evidence. Audited. */
  recordExternalCompletion(input: { resource_id: string; completed_on: string; note?: string | null }): Promise<Result<{ id: string; evidence: 'self_declared'; statement_id: string }>>;
}
