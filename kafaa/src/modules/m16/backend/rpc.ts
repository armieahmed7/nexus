// M16 RPC signatures added by W3 · E5 (F24 Recommendation transparency, opt-out and fairness monitor). Merged into Rpc
// (src/data/types.ts) through src/data/ext/rpc.ts. Every RPC exists three times and they must agree: this signature,
// backend/local.ts and SQL kafaa_<name> in supabase/migrations/20261009135001_kafaa_w3e5_transparency.sql (+ backend/supabase.ts).
import type { Result } from '../../../data/types';
import type { FairnessRow, OptoutSurface } from '../fairness';
import type { Decision, HealthSummary, ProposeInput, RequestRow, RequestStatus, SkillHealth } from '../taxonomyGov'; // FS54

export interface OptoutResult { id: string; surface: OptoutSurface; opted_out: boolean }
export interface SnapshotResult { period: string; as_of: string; rows: number; flagged: number; suppressed: number; hipo_source: string }
export interface EngineChangeResult { change_id: string; surface: string; engine: string; cards: string[] }
/** Per-surface opt-out counts for governance; n is null when fewer than MIN_GROUP_SIZE people opted out. */
export interface OptoutStat { surface: OptoutSurface; n: number | null; suppressed: boolean }

export interface M16Rpc {
  /** F24: opt out of (or back into) ranked recommendations on one surface (navigator, coach, marketplace). Staff with a skills profile; audited and ledgered. */
  setRecoOptout(surface: OptoutSurface, optedOut: boolean, reason?: string | null): Promise<Result<OptoutResult>>;
  /** F24: compute this week's fairness snapshot (or as of a past date) and store it. Platform admins (integrations A); audited and ledgered. */
  runFairnessSnapshot(asOf?: string | null): Promise<Result<SnapshotResult>>;
  /** F24 + F02: change a surface's engine and weights with a rationale; logged in engine_changes, bumps the engine cards, audited and ledgered. */
  changeEngineWeights(surface: string, engine: 'deterministic' | 'model', weights: Record<string, number> | null, rationale: string): Promise<Result<EngineChangeResult>>;
  /** F02 (redefined by F24): same checks and messages as wave 0; every call is now also logged in engine_changes and ledgered. */
  setEngineWeights(surface: string, engine: 'deterministic' | 'model', weights?: Record<string, number> | null): Promise<Result>;
  /** F24: how many people opted out per surface (admins, auditors, HR aggregates); suppressed below 10. */
  optoutStats(): Promise<OptoutStat[]>;
  // ── FS54 (wave F · E3): skills council and taxonomy change tracker. SQL in 20261010263001_kafaa_fs63_taxonomy_governance.sql.
  /** FS54: propose a change to the skills catalogue (skills_taxonomy W: staff). Checked against the inclusion rule; audited (no ledger). */
  proposeSkillChange(input: ProposeInput): Promise<Result<ProposeResult>>;
  /** FS54: a council vote (skills_taxonomy A). Maker-checker: two different members, neither the proposer; every vote writes a ledger row; the second agreeing approval publishes the change. */
  decideSkillChange(id: string, decision: Decision, note?: string | null): Promise<Result<DecideResult>>;
  /** FS54: every request with its votes, for council members (skills_taxonomy A) and auditors (audit_log R). Throws otherwise. */
  skillCouncilQueue(): Promise<RequestRow[]>;
  /** FS54: staleness and the orphan-rate audit of the live catalogue, computed (signed-in readers of the catalogue). */
  taxonomyHealth(): Promise<TaxonomyHealth>;
  // ── FS55 (wave F · E3)
  /** FS55: fairness snapshot of the ranked surfaces added since F24 (integrations A); audited and ledgered like the F24 snapshot. */
  runSurfaceFairness(asOf?: string | null): Promise<Result<SurfaceSnapshotResult>>;
}
export interface ProposeResult { id: string; status: RequestStatus; title_en: string; title_ar: string }
export interface DecideResult { id: string; status: RequestStatus; change_id: string | null; new_skill_ids: string[] }
export interface TaxonomyHealth { summary: HealthSummary; skills: SkillHealth[] }
export interface SurfaceSnapshotResult { period: string; as_of: string; rows: number; flagged: number; suppressed: number }
export type { FairnessRow };
