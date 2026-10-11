// M21 RPC signatures (owner: W1 · E5, F09 Future Me). Merged into Rpc (src/data/types.ts) through src/data/ext/rpc.ts.
// Every RPC exists three times and they must agree: this signature, backend/local.ts and SQL kafaa_<name> (+ backend/supabase.ts mapping).
// SQL: supabase/migrations/20261009115001_kafaa_w1e5_future.sql.
import type { Result } from '../../../data/types';
import type { RV2 } from '../readiness';

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

/** FS13: my readiness v2 (SIMULATED) with the person it is for. */
export interface FutureReadiness extends RV2 { person_id: string }
export interface TrackStepResult { id: string; track_id: string; status: 'in_progress' | 'completed'; steps_done: number[]; steps: number; completed_at: string | null }

export interface M21Rpc {
  /**
   * F09 "Add to my learning goals": add (active true) or remove (false) a Future Me goal for the signed-in person. The goal is a
   * coach target the Learning Coach (F07, M19) reads from future_goals. Staff with a skills profile only; audited, no ledger.
   * Refusals: not_signed_in, forbidden, invalid, not_found, limit (12 active goals).
   */
  setFutureGoal(kind: FutureGoalKind, refId: string, active?: boolean): Promise<Result<FutureGoalResult>>;
  /** F09 demand signal for HR and training (F26): interest and goal counts per technology / lane, suppressed below 10. skills_profile Agg, R or A. */
  futureDemand(): Promise<FutureDemandRow[]>;
  /**
   * FS13 readiness v2 for the signed-in person (skills_profile Own): carry from today's skills, direct new-capability skills and
   * recorded learning, through the FS04 keyspace. Same numbers as kafaa_future_readiness() / kafaa_fm_readiness_of(person) in SQL and
   * readinessV2() in src/modules/m21/readiness.ts. Throws for callers without a skills profile.
   */
  futureReadiness(): Promise<FutureReadiness>;
  /**
   * FS13: mark one step of an ADVANCE learning track done (done true) or not done (false). When every step is done the track is
   * completed and counts as level-1 learning evidence in readiness v2. Own rows only; audited, no ledger.
   * Refusals: not_signed_in, forbidden, invalid (step out of range), not_found (unknown track).
   */
  recordTrackStep(trackId: string, step: number, done?: boolean): Promise<Result<TrackStepResult>>;
}
