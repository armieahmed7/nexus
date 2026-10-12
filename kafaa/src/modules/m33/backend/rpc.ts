// M33 RPC signatures (owners: wave C E5 (FS25, FS26) and wave F E5 (FS58, FS59)). Merged into Rpc (src/data/types.ts) through src/data/ext/rpc.ts.
// Every RPC exists three times and they must agree: this signature, backend/local.ts and SQL kafaa_<name> (+ backend/supabase.ts mapping).
// FS25/FS26 SQL: supabase/migrations/20261010235001_kafaa_fs35_core_skills.sql. FS58/FS59 SQL: supabase/migrations/20261010265001_kafaa_fs65_aps_roleplay.sql.
import type { Result } from '../../../data/types';
import type { CoreProfile, CoreStats } from '../coreSkills';
import type { SjtFeedback, SjtItemInput, SjtItemView, SjtStats } from '../sjt';
import type { Reason } from '../../../domain/engines/types';
import type { ApsBand, ApsDim, ApsDimScore, ApsFeedback, ApsScenarioInput, ApsStageView, ApsStats } from '../aps';
import type { RpCriterion, RpScenarioInput, RpStats, RpTurn, TurnResult } from '../roleplay';

// ── FS58
export interface ApsHeader {
  id: string; code: string; theme: string; title_en: string; title_ar: string; context_en: string; context_ar: string; difficulty: number; est_minutes: number;
  stages: number; changes: number;
}
export interface ApsResult {
  attempt_id: string; scenario_id: string; period: string; points: number; max_points: number; score: number; band: ApsBand; dims: Record<ApsDim, ApsDimScore>;
  reasons: Reason[]; stages: number;
}
export interface ApsStep {
  attempt_id: string; scenario: ApsHeader; done: boolean; answered: number; total: number;
  /** The stage on screen (its change is revealed only now), without the key. */
  stage: ApsStageView | null;
  /** The key, notes, relevance of each fact and the debrief for the stage just answered (null on start). */
  feedback: ApsFeedback | null;
  result: ApsResult | null;
  resumed?: boolean;
}
export interface ApsCatalogItem extends ApsHeader {
  summary_en: string; summary_ar: string; core_skill_ids: string[]; skill_ids: string[];
  /** My completed runs of this scenario, my best and latest score. */
  mine: number; best: number | null; last: number | null;
}
export interface ApsContext {
  period: string;
  in_progress: { attempt_id: string; scenario_id: string } | null;
  scenarios: ApsCatalogItem[];
  completed: number;
  enec_avg: number | null;
  enec_n: number | null;
  /** The scenario suggested next (least practised first, rotated per person), with why. Ranks content, never people. */
  next: { scenario_id: string; reasons: Reason[] } | null;
}

// ── FS59
export interface RpTurnFeedback extends TurnResult { passed: number; total: number }
export interface RpResultView { session_id: string; scenario_id: string; passed: number; total: number; pct: number; ready: boolean; reasons: Reason[]; turns: TurnResult[] }
export interface RpStep {
  session_id: string; scenario_id: string; done: boolean; answered: number; total: number;
  /** The counterpart's next line (null when done). */
  turn: RpTurn | null;
  /** The rubric ticks for the answer just checked (never the answer itself). */
  feedback: RpTurnFeedback | null;
  result: RpResultView | null;
  resumed?: boolean;
}
export interface RpContext {
  period: string;
  open: { session_id: string; scenario_id: string }[];
  sessions: number;
  completed: number;
  validated: number;
  enec_pct: number | null;
  enec_n: number | null;
}
export interface RpReviewer { id: string; name_en: string; name_ar: string; role: string }
export interface RpQueueItem {
  session_id: string; person_id: string; person_name: string; person_name_ar: string; scenario_id: string; code: string; kind: string; title_en: string; title_ar: string;
  level: number; pass_pct: number; passed: number; total: number; pct: number; turns: TurnResult[]; rubric: RpCriterion[]; completed_at: string | null; requested_at: string | null;
  review_context: string | null; review_status: string; reviewed_at: string | null; review_note: string | null; skills: string[]; evidence_ids: string[];
}
export interface RpQueue { items: RpQueueItem[]; decided: RpQueueItem[] }

// ── FS26
export interface SjtResult { attempt_id: string; period: string; score: number; by_skill: Record<string, { n: number; sum: number }>; reasons: Reason[]; item_count: number }
export interface SjtStep {
  attempt_id: string;
  done: boolean;
  answered: number;
  total: number;
  item: SjtItemView | null;
  /** The expert key, notes and rationale for the item just answered (null on start). */
  feedback: SjtFeedback | null;
  result: SjtResult | null;
  resumed?: boolean;
}
export interface SjtContext {
  period: string;
  in_progress: string | null;
  completed: number;
  bank: { core_skill_id: string; items: number }[];
  enec_avg: number | null;
  enec_n: number | null;
}

export interface M33Rpc {
  /** FS25: my level per core skill from my skill evidence, my family target, the status, evidence, reasons and my practice signal (skills_profile Own). Null without Own. */
  coreSkillsMine(): Promise<CoreProfile | null>;
  /** FS25: share of staff meeting their family target per core skill, cluster and family (skills_profile Agg; under 10 suppressed). Null without Agg. */
  coreSkillsStats(): Promise<CoreStats | null>;
  /** FS26: start (or resume) a practice set of up to 8 items, mixed or for one core skill (skills_profile Own). Items come without the key. */
  startSjt(input?: { core_skill_id?: string | null }): Promise<Result<SjtStep>>;
  /** FS26: answer the item on screen; returns the expert key, notes and rationale, then the next item or, after the last, the result.
   *  Development only: never writes skill evidence and never gates anything. */
  submitSjt(input: { attempt_id: string; item_id: string; choice: number }): Promise<Result<SjtStep>>;
  /** FS26: what my practice page needs: an open set, my completed sets, the bank size per core skill and the ENEC average (suppressed under 10). */
  sjtContext(): Promise<SjtContext | null>;
  /** FS26: participation and average practice score by quarter and core skill (skills_profile Agg; under 10 suppressed; never a person). */
  sjtStats(): Promise<SjtStats | null>;
  /** FS26: add, edit or retire a practice item (secure_items A: the training manager). Both languages, four responses with a key, notes and rationale. */
  saveSjtItem(input: SjtItemInput): Promise<Result<{ id: string; version: number; status: string }>>;

  // ── FS58 Adaptive problem-solving practice (skills_profile Own; HR Agg; bank secure_items A). Practice only: never skill evidence, never a gate.
  /** Start (or resume) a scenario: the chosen one, or the one suggested next. Only the first stage is served, without the key. */
  startAps(input?: { scenario_id?: string | null }): Promise<Result<ApsStep>>;
  /** Answer the stage on screen (the option and the facts that matter now): returns the key and debrief, then the next stage (the change is
   *  revealed only now) or, after the last, the scored result on the 0-100 practice scale. */
  submitAps(input: { attempt_id: string; stage_id: string; choice: number; picks: number[] }): Promise<Result<ApsStep>>;
  /** What my problem-solving page needs: my open run, the published scenarios with my runs, the ENEC average (suppressed under 10), the suggestion. */
  apsContext(): Promise<ApsContext | null>;
  /** Participation, pooled score, band shares, dimensions, quarters and themes (skills_profile Agg; under 10 suppressed; never a person). */
  apsStats(): Promise<ApsStats | null>;
  /** Add, edit, publish or retire a scenario (secure_items A: the training manager). Every scenario needs at least one mid-task change. */
  saveApsScenario(input: ApsScenarioInput): Promise<Result<{ id: string; version: number; status: string }>>;

  // ── FS59 Role-play practice library with saved feedback (skills_profile Own; reviewer recognition A; library secure_items A)
  /** Start (or resume) a published scenario: returns its first (or next) turn. */
  startRoleplay(input: { scenario_id: string }): Promise<Result<RpStep>>;
  /** Check my answer to the turn on screen against the published rubric. Keeps the ticks and the word count, never the text. A speak-up
   *  topic returns code `speak_up` (route /speak-up) and stores nothing: no session change, no audit row. */
  roleplayTurn(input: { session_id: string; turn_id: string; text: string }): Promise<Result<RpStep>>;
  /** My open sessions, counts and the ENEC pooled criteria rate (suppressed under 10). */
  roleplayContext(): Promise<RpContext | null>;
  /** Who can validate a session (instructors, the training manager, the HR authority; never me). */
  roleplayReviewers(): Promise<RpReviewer[] | null>;
  /** Ask a named reviewer to validate a completed session at or above the scenario's mark (context for the reviewer, 5-400 characters). */
  requestRoleplayReview(input: { session_id: string; reviewer_id: string; context: string }): Promise<Result<{ review_status: string }>>;
  withdrawRoleplayReview(sessionId: string): Promise<Result<{ review_status: string }>>;
  /** The sessions waiting for me as reviewer and the ones I decided (recognition A). Never anyone else's sessions. */
  roleplayReviewQueue(): Promise<RpQueue | null>;
  /** The named reviewer validates (writes the rating evidence, level 1-2, ledger) or declines with a reason. Never the person. */
  attachRoleplayEvidence(input: { session_id: string; decision: 'validate' | 'decline'; note?: string }): Promise<Result<{ review_status: string; evidence_ids: string[] }>>;
  /** Participation, pooled criteria rate by kind, validations (skills_profile Agg; under 10 suppressed; never a person). */
  roleplayStats(): Promise<RpStats | null>;
  /** Add, edit, publish or retire a scenario (secure_items A). The rubric is published in English and Arabic. */
  saveRoleplayScenario(input: RpScenarioInput): Promise<Result<{ id: string; version: number; status: string }>>;
}
