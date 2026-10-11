// M16 RPC signatures added by W3 · E5 (F24 Recommendation transparency, opt-out and fairness monitor). Merged into Rpc
// (src/data/types.ts) through src/data/ext/rpc.ts. Every RPC exists three times and they must agree: this signature,
// backend/local.ts and SQL kafaa_<name> in supabase/migrations/20261009135001_kafaa_w3e5_transparency.sql (+ backend/supabase.ts).
import type { Result } from '../../../data/types';
import type { FairnessRow, OptoutSurface } from '../fairness';

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
}
export type { FairnessRow };
