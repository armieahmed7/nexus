// M30 RPC signatures (owners: wave B E3 (FS11, FS12) and wave I E3 (FS81)). Merged into Rpc (src/data/types.ts) through src/data/ext/rpc.ts.
// Every RPC exists three times and they must agree: this signature, backend/local.ts and SQL kafaa_<name> (+ backend/supabase.ts mapping).
// SQL: supabase/migrations/20261010223001_kafaa_fs23_role_transformation.sql. PGlite parity: scripts/validate/fs23-role-transformation.mjs.
import type { Result } from '../../../data/types';
import type { ExposureAgg, Overview, RoleMap, RtInput } from '../transform';
import type { Candidate, PlanCode, PlanInput, PlanRow, ProgressRow, ReviewState, RungAlert } from '../transition';

export type { RoleMap, ExposureAgg, Overview, RtInput };
export interface RtDraft extends Omit<RtInput, 'publish' | 'role_id'> { saved_by: string | null; saved_at: string | null }
export interface RoleTransformationView {
  /** My current role (job_roles id) or null. */
  my_role_id: string | null;
  /** The map of the requested role (my role by default); null when the role is not a current role. */
  map: RoleMap | null;
  /** Training manager / HR director: may save and publish this map. */
  can_edit: boolean;
  /** The open draft (editors only). */
  draft: RtDraft | null;
}
export interface PublishResult { id: string; status: 'draft' | 'published'; version: number }

// ───────────── FS81 transition plans (SQL: supabase/migrations/20261010293001_kafaa_fs93_transition_plans.sql; PGlite parity:
// scripts/validate/fs93-transition-plans.mjs). Plans are visible to the person and to HR (transformation A) only.
export type { Candidate, PlanCode, PlanInput, PlanRow, ProgressRow, ReviewState, RungAlert };
export interface TransitionPlanView {
  plan: PlanRow & { person_name: string; person_name_ar: string };
  /** The ladder-rung alert of the plan's Mastery Builder role (target first, else protected), with the practice the plan adds. */
  alert: RungAlert;
  /** Practice the plan adds and the OJT repetitions acknowledged since it started (simulator runs: null, booked through F28). */
  progress: ProgressRow[];
  review_state: ReviewState;
  /** The caller is the person of the plan. */
  mine: boolean;
  /** The caller is HR (transformation A) and not the person. */
  can_decide: boolean;
}
export interface SavePlanResult { id: string; status: 'draft' | 'active'; revision: number; next_review_on: string | null }
export interface ReviewPlanInput { plan_id: string; outcome: string; note?: string | null; next_review_on?: string | null }
export interface ClosePlanInput { plan_id: string; outcome: string; note: string }

export interface M30Rpc {
  /** FS11/FS12: the role transformation map for a role (default: my role) with my time-to-ready at the horizon (2030 default).
   *  Any holder of `transformation` (staff R, auditors R). Security, safeguards and cyber roles return a path-only map. Null otherwise. */
  roleTransformation(roleId?: string | null, horizon?: '2030' | '2035'): Promise<RoleTransformationView | null>;
  /** FS11: save (draft) or publish a role transformation map. Training manager or HR director (transformation W/A). Checks: archetype,
   *  drivers, summaries, path-level for security roles, clean text (no headcount, sites or deployment claims), the FS12 copy check
   *  ("replace", "redundant" and their Arabic equivalents), no numbers in the public summary, a source to publish. Audited; ledger on publish. */
  publishTransformation(input: RtInput): Promise<Result<PublishResult>>;
  /** FS12: exposure of rated tasks by job family, family group and in total, weighted by the people in each role; groups under 10 people
   *  suppressed; security families never broken out. transformation Agg/A (HR). Null otherwise. */
  exposureAggregate(): Promise<ExposureAgg | null>;
  /** FS11: people already meeting their role's 2030 (or 2035) profile and the median months to get there, by family and group,
   *  suppressed under 10. transformation Agg/A (HR). Null otherwise. */
  transformationOverview(horizon?: '2030' | '2035'): Promise<Overview | null>;

  /** FS81: one transition plan with its ladder-rung alert, practice progress and review state. Default: my own plan (active first,
   *  then draft, then the latest closed one). The person or HR (transformation A) only; null for anyone else, managers included. */
  transitionPlanView(planId?: string | null): Promise<TransitionPlanView | null>;
  /** FS81: every transition plan (HR board), active first, then by next review. transformation A only; null otherwise. */
  transitionPlans(): Promise<TransitionPlanView[] | null>;
  /** FS81: role-level ladder-rung alerts (no person): every Mastery Builder role, the junior tasks moving to tools by the horizon and the
   *  eligible simulator / OJT practice. transformation W/A/Agg (training manager, HR); null otherwise. */
  rungAlerts(horizon?: '2030' | '2035'): Promise<RungAlert[] | null>;
  /** FS81: people HR can open a plan for (active staff in a current role) with their open plan. transformation A only; null otherwise. */
  transitionCandidates(): Promise<Candidate[] | null>;
  /** FS81: the editor preview, nothing saved: the first problem saving would refuse (planProblem) and the ladder-rung alert of the
   *  input's roles with its practice (planAlert). transformation A only; null otherwise. */
  previewTransitionPlan(input: Partial<PlanInput>): Promise<{ problem: PlanCode | null; alert: RungAlert } | null>;
  /** FS81: create or update a plan (draft, or activate). HR (transformation A), never on their own plan. Checks (planProblem, same order
   *  as SQL): person, self plan, one open plan, roles, horizon, trigger, dates, review cadence, retraining, practice, wording, and to
   *  activate: a retraining step and practice for every ladder-rung task. Audited; ledger and a notice to the person on activation. */
  saveTransitionPlan(input: PlanInput): Promise<Result<SavePlanResult>>;
  /** FS81: record the next review (from 14 days before it is due) with an outcome; the next date when none is left. HR only. Audited. */
  reviewTransitionPlan(input: ReviewPlanInput): Promise<Result<{ id: string; next_review_on: string | null }>>;
  /** FS81: complete (active) or withdraw (draft or active) a plan with a reason. HR only. Audited; ledger; a notice to the person. */
  closeTransitionPlan(input: ClosePlanInput): Promise<Result<{ id: string; status: 'completed' | 'withdrawn' }>>;
  /** FS81: the person acknowledges their active plan (once). Audited, no ledger. */
  acknowledgeTransitionPlan(planId: string): Promise<Result<{ id: string; acknowledged_at: string }>>;
}
