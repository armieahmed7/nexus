// M21 RPC signatures (owner: W1 · E5, F09 Future Me). Merged into Rpc (src/data/types.ts) through src/data/ext/rpc.ts.
// Every RPC exists three times and they must agree: this signature, backend/local.ts and SQL kafaa_<name> (+ backend/supabase.ts mapping).
// SQL: supabase/migrations/20261009115001_kafaa_w1e5_future.sql.
import type { Result } from '../../../data/types';

export type FutureGoalKind = 'adv_skill' | 'bridge' | 'lane' | 'future_role';
export interface FutureGoalResult { id: string; status: 'active' | 'removed'; skill_ids: string[] }
/** One aggregate cell of the Future Me demand signal: distinct people per technology family or horizon lane. */
export interface FutureDemandRow {
  source: 'interest' | 'goal';
  target_kind: 'tech' | 'lane';
  target_id: string;
  /** null when suppressed (fewer than MIN_GROUP_SIZE people). */
  n: number | null;
  suppressed: boolean;
}

export interface M21Rpc {
  /**
   * F09 "Add to my learning goals": add (active true) or remove (false) a Future Me goal for the signed-in person. The goal is a
   * coach target the Learning Coach (F07, M19) reads from future_goals. Staff with a skills profile only; audited, no ledger.
   * Refusals: not_signed_in, forbidden, invalid, not_found, limit (12 active goals).
   */
  setFutureGoal(kind: FutureGoalKind, refId: string, active?: boolean): Promise<Result<FutureGoalResult>>;
  /** F09 demand signal for HR and training (F26): interest and goal counts per technology / lane, suppressed below 10. skills_profile Agg, R or A. */
  futureDemand(): Promise<FutureDemandRow[]>;
}
