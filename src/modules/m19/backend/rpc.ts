// M19 RPC signatures (owner: W1 · E3, F07 Learning Coach). Merged into Rpc (src/data/types.ts) through src/data/ext/rpc.ts.
// Every RPC exists three times and they agree: this signature, backend/local.ts and SQL kafaa_<name>
// (supabase/migrations/20261009113001_kafaa_w1e3_coach.sql) + backend/supabase.ts mapping.
import type { Result } from '../../../data/types';

export type CoachItemKind = 'course' | 'practice' | 'ojt' | 'mentor' | 'opportunity' | 'reading' | 'refresher';
export type CoachSignal = 'saved' | 'dismissed' | 'enrolled' | 'cleared';
export const COACH_KINDS: CoachItemKind[] = ['refresher', 'course', 'practice', 'ojt', 'mentor', 'opportunity', 'reading'];
export const COACH_SIGNALS: CoachSignal[] = ['saved', 'dismissed', 'enrolled', 'cleared'];
/** A dismissed suggestion stays out of the feed for this many days. */
export const DISMISS_DAYS = 90;

export interface CoachFeedbackResult {
  id: string;
  signal: CoachSignal;
  hidden_until: string | null;
}
/** One aggregate cell. Values are null and suppressed is true when fewer than MIN_GROUP_SIZE people stand behind it. */
export interface CoachInsightCell {
  key: string;
  people: number | null;
  saved: number | null;
  enrolled: number | null;
  dismissed: number | null;
  acceptance_pct: number | null;
  suppressed: boolean;
}
export interface CoachInsights {
  min_group: number;
  total: CoachInsightCell;
  by_kind: CoachInsightCell[];
  by_family: CoachInsightCell[];
  /** People with a weekly goal and their median goal (suppressed below the minimum group). */
  goals: { people: number | null; median_hours: number | null; suppressed: boolean };
}

export interface M19Rpc {
  /**
   * F07: record the person's own feedback on a coach suggestion. saved | dismissed (hidden for 90 days) | enrolled | cleared
   * (undo). One row per person and suggestion; staff only (skills_profile Own); audited, no ledger.
   */
  coachFeedback(itemKind: CoachItemKind, itemId: string, signal: CoachSignal, competencyIds?: string[]): Promise<Result<CoachFeedbackResult>>;
  /** F07: aggregated acceptance rates of coach suggestions for HR (skills_profile Agg) and the training manager (A). Counts only; cells under 10 people are suppressed. */
  coachInsights(): Promise<Result<CoachInsights>>;
}
