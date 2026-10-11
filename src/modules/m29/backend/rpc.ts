// M29 RPC signatures (owners: wave B E2 (FS09, FS10), wave D E5 (FS36, FS37) and wave I E2 (FS80)). Merged into Rpc (src/data/types.ts) through src/data/ext/rpc.ts.
// Every RPC exists three times and they must agree: this signature, backend/local.ts and SQL kafaa_<name> (+ backend/supabase.ts mapping).
// FS09/FS10 SQL: supabase/migrations/20261010222001_kafaa_fs22_ai_fluency.sql.
import type { Result } from '../../../data/types';
import type { AiRungResult, RungStats } from '../fluency';
import type { Band, FitnessStats, ItemInput } from '../fitness';
import type { Reason } from '../../../domain/engines/types';
import type { Coverage, SystemInput } from '../register';
import type { Answer, DrillInput, DrillScore, DrillStats, Flag } from '../drills';

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

// ── FS36
export interface AiCoverageView extends Coverage {
  /** 'all': ai_literacy Agg/A or audit_log R; 'owner': only the systems the caller owns. */
  scope: 'all' | 'owner';
  as_of: string;
}
// ── FS37
export interface DrillResult extends Omit<DrillScore, 'reasons'> {
  attempt_id: string;
  drill_id: string;
  attempt_no: number;
  /** The drill's pass mark (from the key; shown with the result). */
  pass_pct: number;
  evidence: { skill_id: string; level: number }[];
  reasons: Reason[];
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
  /** FS36: AI-literacy coverage per system and user group, computed from FS09 rungs (ai_literacy Agg or A, audit_log R; a system
   *  owner sees their own systems). Groups under 10 suppressed. Null when the caller may see no coverage. */
  aiLiteracyCoverage(): Promise<AiCoverageView | null>;
  /** FS36: add or edit a register entry with its user groups (ai_literacy A: admin / AI governance). Versioned; groups are
   *  deactivated, never deleted; "fully implemented" needs THRESHOLD % coverage; compliance or certification wording is refused. */
  saveAiSystem(input: SystemInput): Promise<Result<{ id: string; version: number; status: string; maturity: string }>>;
  /** FS37: submit a sandbox drill (ai_literacy Own): scored server-side against the key; a pass writes F01 assessment evidence <= L2. */
  submitDrill(input: { drill_id: string; flags: Flag[]; answers: Answer[] }): Promise<Result<DrillResult>>;
  /** FS37: drill results for training (ai_literacy W or Agg, or secure_items W/A): pass rates and missed error kinds, suppressed under 10. */
  drillStats(): Promise<DrillStats | null>;
  /** FS37: add, edit or retire a drill with its key (training manager: ai_literacy W and secure_items W/A). Versioned; synthetic only. */
  saveDrill(input: DrillInput): Promise<Result<{ id: string; version: number; status: string }>>;
}
