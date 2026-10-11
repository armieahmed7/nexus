// M05 extension RPC signatures (owner: FS wave C · E3, FS21 + FS22). Merged into Rpc (src/data/types.ts) through src/data/ext/rpc.ts.
// Every RPC exists three times and they must agree: this signature, backend/local.ts and SQL kafaa_<name> (+ backend/supabase.ts).
// SQL: supabase/migrations/20261010233001_kafaa_fs33_assessment.sql. The G2 M05 RPCs (itemReview, recordJpm, ...) are unchanged.
import type { Result } from '../../../data/types';
import type { Reason } from '../../../domain/engines/types';
import type { AdItemInput, BankCard, BankStats, Stop } from '../adaptive';
import type { IntegrityCore, TaskAnswer } from '../perf';

// ── FS21
/** An adaptive item as served to the taker: never the answer key or the calibration. */
export interface AdItemView { id: string; bank_id: string; facet: string; level: number; stem_en: string; stem_ar: string; options_en: string[]; options_ar: string[] }
export interface AdResult {
  attempt_id: string; bank_id: string; estimate: number; stop: Stop; criterion: boolean; meets: boolean | null; percentile: number | null; norm_n: number | null;
  evidence: { skill_id: string; level: number }[]; reasons: Reason[]; item_count: number; path: { level: number; correct: boolean }[]; integrity_id: string | null;
}
export interface AdStepView { attempt_id: string; done: boolean; answered: number; max: number; level: number; item: AdItemView | null; result: AdResult | null; resumed?: boolean }
export type AdBankCard = BankCard;
export interface AdOverview { banks: AdBankCard[] }
export interface AdStats { banks: BankStats[]; items: { item_id: string; seen: number; exposure: number; p_obs: number | null }[] }

// ── FS22
export interface TaskStartView { attempt_id: string; task_id: string; rubric_version: number; resumed: boolean }
export interface TaskSubmitView { attempt_id: string; resubmissions: number; integrity_id: string | null; integrity: IntegrityCore | null }
export interface TaskScoreView { attempt_id: string; total: number; max: number; pct: number; passed: boolean; critical_failed: boolean; evidence: { skill_id: string; level: number }[]; reasons: Reason[] }

export interface M05Rpc {
  /** FS21: my banks: mode, my latest result, whether I can start (retake rule), the ENEC line (suppressed under 10). Null without skills_profile Own. */
  adaptiveOverview(): Promise<AdOverview | null>;
  /** FS21: start (or resume) an attempt on a bank (skills_profile Own); the first item comes without its key. */
  startAdaptive(input: { bank_id: string }): Promise<Result<AdStepView>>;
  /** FS21: answer the current item; the server checks the key, runs the FS01 staircase and picks the next item, or scores the
   *  attempt (estimate, standard or percentile), writes F01 assessment evidence and, for a gating bank, the integrity report. */
  answerAdaptive(input: { attempt_id: string; item_id: string; choice: number }): Promise<Result<AdStepView>>;
  /** FS21: per bank results (suppressed under 10) and item exposure and observed p-values (training staff: secure_items W/A). */
  adaptiveStats(): Promise<AdStats | null>;
  /** FS21: add, edit or retire an adaptive item (training manager: secure_items A). Keeps two active items per bank level. */
  saveAdaptiveItem(input: AdItemInput): Promise<Result<{ id: string; version: number; status: string; level: number }>>;
  /** FS22: start (or resume) a performance task; refused unless the learner confirms they read the published rubric. */
  startPerformanceTask(input: { task_id: string; rubric_seen: boolean }): Promise<Result<TaskStartView>>;
  /** FS22: submit (or, before scoring, resubmit) an answer: auto rubric lines and, for a gating task, the integrity report. */
  submitPerformanceTask(input: { attempt_id: string; answer: TaskAnswer }): Promise<Result<TaskSubmitView>>;
  /** FS22: score a submitted attempt against the rubric (assessor: signoff A; never one's own attempt); a pass writes evidence. */
  scorePerformanceTask(input: { attempt_id: string; scores: Record<string, number>; comment?: string }): Promise<Result<TaskScoreView>>;
  /** FS22: accept or void a flagged integrity report (assessor: signoff A; not one's own). Voiding withdraws the attempt's evidence. */
  reviewIntegrity(input: { report_id: string; decision: 'accepted' | 'voided'; note: string }): Promise<Result<{ report_id: string; decision: string }>>;
}
