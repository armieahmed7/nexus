// M25 RPC signatures (owner: W4 · E1 · F25 Training effectiveness, F26 Training needs forecast). Merged into Rpc (src/data/types.ts)
// through src/data/ext/rpc.ts. Every RPC exists three times and they must agree: this signature, backend/local.ts and SQL
// kafaa_<name> in supabase/migrations/20261009141001_kafaa_w4e1_effectiveness.sql (+ backend/supabase.ts).
import type { Result } from '../../../data/types';
import type { CourseCard, L1Item, L3Item, L3Rating } from '../eff';
import type { NeedsReport } from '../needs';

export type { CourseCard, NeedsReport };

export interface EffectivenessReport { as_of: string; min_group: number; cards: CourseCard[] }
export interface L1Input { completion_ref: string; ratings: Record<L1Item, number>; recommend: boolean }
export interface L3View {
  id: string; person_id: string; person_name: string; person_name_ar: string; course_id: string; completed_on: string; due_on: string; opens_on: string;
  observer_person_id: string | null; observer_name: string; observer_name_ar: string; status: string; view: 'scheduled' | 'due' | 'overdue' | 'done' | 'cancelled';
  items: L3Item[]; note: string | null; recorded_at: string | null; can_record: boolean;
}
export interface L3Board { mode: 'all' | 'mine'; rows: L3View[] }
export interface L3Input { items: { key: string; rating: L3Rating }[]; note?: string }
export interface DemandReportResult extends NeedsReport { periods: string[]; can_compute: boolean; instructors: number }

export interface M25Rpc {
  /** L1: the learner's own reaction form for one of their completions (once, within 90 days). Schedules the L3 observation of a qualifying course. */
  submitL1(input: L1Input): Promise<Result<{ id: string; l3_id: string | null }>>;
  /** L3: schedule observations 90 days after each completion of a qualifying course (training manager). */
  scheduleL3(courseId?: string | null): Promise<Result<{ scheduled: number }>>;
  /** L3 board: all observations (training manager, auditors) or the caller's own team (observer of record / line manager). */
  l3Board(): Promise<Result<L3Board>>;
  /** L3: the observer of record, the person's line manager or the training manager records the checklist (from day 60). */
  recordL3(id: string, input: L3Input): Promise<Result<{ id: string }>>;
  /** Kirkpatrick scorecard: every value from groups under 10 is null. learning_analytics Agg/R/A. */
  effectivenessReport(courseId?: string | null): Promise<Result<EffectivenessReport>>;
  /** Flag a course for redesign (training manager); the flag feeds the F27 SAT workbench. */
  flagRedesign(courseId: string, note: string): Promise<Result<{ id: string }>>;
  /** F26: recompute the demand snapshot of one quarter (current quarter + 3) from the six sources (training manager). */
  computeDemand(period: string): Promise<Result<{ period: string; rows: number; total: number }>>;
  /** F26: demand vs capacity for one quarter; exact for the training manager and auditors, cells under 10 suppressed for aggregate viewers. */
  demandReport(period?: string | null): Promise<Result<DemandReportResult>>;
  /** F26: draft sessions to close a course's shortfall (training manager). Drafts are never published. */
  proposeSessions(period: string, courseId: string, note?: string): Promise<Result<{ id: string; sessions: number }>>;
  /** F26: withdraw a draft proposal. */
  withdrawProposal(id: string): Promise<Result<{ id: string }>>;
  /** F26: link a draft to the session the scheduler created through the M04 schedule (status scheduled). */
  linkProposal(id: string, sessionId: string): Promise<Result<{ id: string }>>;
}
