// M35 RPC signatures (owners: wave F E1 (FS50, FS51) and wave G E1 (FS60, FS61)). Merged into Rpc (src/data/types.ts) through src/data/ext/rpc.ts.
// Every RPC exists three times and they must agree: this signature, backend/local.ts and SQL kafaa_<name> (+ backend/supabase.ts mapping).
// SQL: supabase/migrations/20261010261001_kafaa_fs61_strategy_forecasts.sql. PGlite parity: scripts/validate/fs61-strategy-forecasts.mjs.
import type { Result } from '../../../data/types';
import type { Board, CriticalInput, Progress, Rating } from '../critical';
import type { ForecastResult, ScenarioKey } from '../forecast';

export interface CriticalReviewInput {
  critical_skill_id: string;
  rating: Rating;
  note_en: string;
  note_ar: string;
  /** optional decision change (build, buy, borrow, bot) with its new rationale */
  decision?: string | null;
  rationale_en?: string | null;
  rationale_ar?: string | null;
}
export interface SaveForecastInput {
  /** an own draft to update; omitted = a new version in the current annual cycle */
  id?: string | null;
  name: string;
  /** the scenario to plan against */
  scenario: ScenarioKey;
  params: unknown;
}

export interface M35Rpc {
  /** FS50: the register with computed progress (suppressed under 10), KPIs, review state and attention reasons (workforce_strategy
   *  Agg/R/W/A). Read-only; a refusal is audited. */
  criticalSkillBoard(): Promise<Result<Board>>;
  /** FS50: add or edit a register row (workforce_strategy W drafts; A adopts, edits adopted rows or retires). Versioned; one row per skill;
   *  adopting or retiring writes a ledger row. */
  saveCriticalSkill(input: CriticalInput): Promise<Result<{ id: string; version: number; status: string }>>;
  /** FS50: the quarterly review (HR director: workforce_strategy A). One per row and quarter; snapshots the computed progress; may change
   *  the decision (with a new rationale); always an audit row and a ledger row. */
  reviewCriticalSkill(input: CriticalReviewInput): Promise<Result<{ id: string; quarter: string; progress: Progress }>>;
  /** FS51: the three-scenario forecast for a set of assumptions (workforce_strategy Agg/R/W/A); aggregate only, skills under 10 holders
   *  suppressed. Read-only; a refusal is audited. */
  computeSkillForecast(params: unknown): Promise<Result<ForecastResult>>;
  /** FS51: save a forecast version in the current annual cycle (HR analyst or HR director: workforce_strategy W); "(SIMULATED)" name. */
  saveSkillForecast(input: SaveForecastInput): Promise<Result<{ id: string; cycle: number; version: number; name: string }>>;
  /** FS51: the HR director releases a version (recomputed server-side; summaries in EN and AR pass publicTextIsClean); the version
   *  released earlier in the same cycle is superseded; ledger. */
  releaseSkillForecast(id: string, summaryEn: string, summaryAr: string): Promise<Result<{ id: string; superseded: string | null }>>;
}
