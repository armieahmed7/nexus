// M35 RPC signatures (owners: wave F E1 (FS50, FS51) and wave G E1 (FS60, FS61)). Merged into Rpc (src/data/types.ts) through src/data/ext/rpc.ts.
// Every RPC exists three times and they must agree: this signature, backend/local.ts and SQL kafaa_<name> (+ backend/supabase.ts mapping).
// SQL: supabase/migrations/20261010261001_kafaa_fs61_strategy_forecasts.sql. PGlite parity: scripts/validate/fs61-strategy-forecasts.mjs.
import type { Result } from '../../../data/types';
import type { Board, CriticalInput, Progress, Rating } from '../critical';
import type { ForecastResult, ScenarioKey } from '../forecast';
import type { DisclosureValues, LineInput } from '../disclosure';
import type { Adoption, AdoptionStats, PilotInput, SignoffInput } from '../pilots';

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

// FS wave G · E1 (FS60, FS61). SQL: supabase/migrations/20261010271001_kafaa_fs71_disclosure_pilots.sql; PGlite: scripts/validate/fs71-disclosure-pilots.mjs.
export interface SaveDisclosureInput {
  /** the quarter, e.g. 2026-Q3 (must have ended) */
  period: string;
  /** materiality statement (which interpretation of materiality applies); omitted = keep */
  materiality_en?: string | null;
  materiality_ar?: string | null;
  /** owner narrative and variance explanation per metric; omitted lines keep what is stored; approved lines cannot change */
  lines?: LineInput[];
}
export interface PilotStats extends AdoptionStats {
  /** the Future Skills Centre reference read from kafaa_benchmarks (FSC, figure adoption_rate) */
  reference: { id: string; figure: string; value: number; url: string; as_of: string } | null;
}

export interface M35Rpc {
  /** FS60: compute every library metric for a quarter (2025-Q1 to the current quarter; workforce_strategy R/W/A). Read-only; people counts
   *  under 10 suppressed; a refusal is audited. TS = SQL (kafaa_hcd_compute). */
  computeDisclosure(period: string): Promise<Result<DisclosureValues>>;
  /** FS60: prepare or update the draft disclosure of an ended quarter (HR analyst or HR director: workforce_strategy W/A): recomputes the
   *  values of every unapproved metric, stores narratives and the materiality statement. Approved lines are frozen. Audited. */
  saveDisclosure(input: SaveDisclosureInput): Promise<Result<{ id: string; period: string; version: number; ready: number; approved: number }>>;
  /** FS60: the HR director approves metric lines (maker-checker: never a line they wrote; every line needs its narrative and variance
   *  explanation in EN and AR, a materiality statement and fresh values). When every metric is approved the disclosure is published.
   *  Audit row and ledger row. */
  approveDisclosure(id: string, metricIds: string[]): Promise<Result<{ id: string; approved: string[]; published: boolean }>>;
  /** FS61: adoption rate from pilot statuses (closed pilots adopted, expanded or further funded) with the FSC reference from
   *  kafaa_benchmarks (staff with internal_content R and workforce_strategy holders). */
  pilotStats(): Promise<Result<PilotStats>>;
  /** FS61: register or edit a draft or running pilot (workforce_strategy W/A); the evaluator must be independent. Audited. */
  savePilot(input: PilotInput): Promise<Result<{ id: string; version: number; status: string }>>;
  /** FS61: the named evaluator signs off a running pilot with the result (failures included), a recommendation and the measured values.
   *  Audit + ledger. */
  signoffPilot(id: string, input: SignoffInput): Promise<Result<{ id: string; status: string }>>;
  /** FS61: HR closes a signed-off pilot with the adoption decision; the result is published to staff (failures stay visible). Refused
   *  without the evaluator's sign-off. Audit + ledger. */
  closePilot(id: string, adoption: Adoption): Promise<Result<{ id: string; adoption: Adoption; rate: number | null }>>;

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
