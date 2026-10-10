// M29 RPC signatures (owners: wave B E2 (FS09, FS10), wave D E5 (FS36, FS37) and wave I E2 (FS80)). Merged into Rpc (src/data/types.ts) through src/data/ext/rpc.ts.
// Every RPC exists three times and they must agree: this signature, backend/local.ts and SQL kafaa_<name> (+ backend/supabase.ts mapping).
// FS09/FS10 SQL: supabase/migrations/20261010222001_kafaa_fs22_ai_fluency.sql.
import type { Result } from '../../../data/types';
import type { AiRungResult, RungStats } from '../fluency';
import type { Band, FitnessStats, ItemInput } from '../fitness';
import type { Reason } from '../../../domain/engines/types';

// ── FS09
export interface AiFluencyView {
  person_id: string;
  family_id: string | null;
  result: AiRungResult;
  target: { rung: number; plus_cells: string[]; fitness_target: number; rationale_en: string; rationale_ar: string } | null;
  target_met: boolean;
  target_missing: string[];
}
export interface AiFluencyStats extends RungStats {
  org_target: { id: string; pct: number; due_on: string } | null;
}

// ── FS10
/** An item as served to the taker: never the answer key. */
export interface FitnessItemView { id: string; area_id: string; difficulty: number; stem_en: string; stem_ar: string; options_en: string[]; options_ar: string[] }
export interface FitnessResult {
  attempt_id: string;
  period: string;
  score: number;
  band: Band;
  above_basic: boolean;
  area_levels: Record<string, number>;
  evidence: { skill_id: string; level: number }[];
  reasons: Reason[];
  item_count: number;
}
export interface FitnessStep { attempt_id: string; done: boolean; answered: number; max: number; item: FitnessItemView | null; result: FitnessResult | null; resumed?: boolean }
export interface FitnessContext {
  period: string;
  family_id: string | null;
  can_start: boolean;
  in_progress: string | null;
  next_on: string | null;
  role_target: number | null;
  enec_avg: number | null;
  enec_n: number | null;
}

export interface M29Rpc {
  /** FS09: my AI fluency rung (Own): the 16 cells with evidence, the rung, reasons, the next rung's gaps and my family target. Null when signed out or without ai_literacy Own. */
  aiFluency(): Promise<AiFluencyView | null>;
  /** FS09: rung distribution, Practitioner share and family-target share (ai_literacy Agg; cells under 10 suppressed). Null without Agg. */
  aiFluencyStats(): Promise<AiFluencyStats | null>;
  /** FS10: start (or resume) this quarter's fitness check (ai_literacy Own). Refused when this quarter's check is already complete. */
  startFitness(): Promise<Result<FitnessStep>>;
  /** FS10: answer the current item; the server checks the key, routes the next item and, after the stop rule, scores the attempt and
   *  writes F01 assessment evidence (level <= 2). */
  submitFitness(input: { attempt_id: string; item_id: string; choice: number }): Promise<Result<FitnessStep>>;
  /** FS10: what my check page needs: the quarter, whether I can start, my family's target score and the ENEC average (suppressed under 10). */
  fitnessContext(): Promise<FitnessContext | null>;
  /** FS10: the organisation indicator "% of staff above basic" with trend, families and areas (ai_literacy Agg; suppressed under 10). */
  fitnessStats(): Promise<FitnessStats | null>;
  /** FS10: add, edit or retire an item (ai_literacy W: training manager). Keeps two active items per area and difficulty. */
  saveFitnessItem(input: ItemInput): Promise<Result<{ id: string; version: number; status: string }>>;
}
