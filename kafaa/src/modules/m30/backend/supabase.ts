// M30 SupabaseBackend RPC mappings (owner: FS wave B · E3, FS11 + FS12). Installed by src/data/ext/supabase.ts.
// SQL: supabase/migrations/20261010223001_kafaa_fs23_role_transformation.sql. Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { Candidate, ExposureAgg, M30Rpc, Overview, PlanCode, RoleTransformationView, RungAlert, TransitionPlanView } from './rpc';

export function makeSupabaseM30(x: SupabaseExtCtx): M30Rpc {
  return {
    roleTransformation: async (roleId = null, horizon = '2030') => (await x.rpc<RoleTransformationView | null>('kafaa_role_transformation', { p_role: roleId ?? null, p_horizon: horizon ?? '2030' })) ?? null,
    publishTransformation: (input) => x.call('kafaa_publish_transformation', { p: input ?? {} }, ['role_transformations', 'transformation_drafts']),
    exposureAggregate: async () => (await x.rpc<ExposureAgg | null>('kafaa_exposure_aggregate')) ?? null,
    transformationOverview: async (horizon = '2030') => (await x.rpc<Overview | null>('kafaa_transformation_overview', { p_horizon: horizon ?? '2030' })) ?? null,
    // FS81 (FS wave I · E3): supabase/migrations/20261010293001_kafaa_fs93_transition_plans.sql
    transitionPlanView: async (planId = null) => (await x.rpc<TransitionPlanView | null>('kafaa_transition_plan_view', { p_plan: planId ?? null })) ?? null,
    transitionPlans: async () => (await x.rpc<TransitionPlanView[] | null>('kafaa_transition_plans')) ?? null,
    rungAlerts: async (horizon = '2030') => (await x.rpc<RungAlert[] | null>('kafaa_rung_alerts', { p_horizon: horizon ?? '2030' })) ?? null,
    transitionCandidates: async () => (await x.rpc<Candidate[] | null>('kafaa_transition_candidates')) ?? null,
    previewTransitionPlan: async (input) => (await x.rpc<{ problem: PlanCode | null; alert: RungAlert } | null>('kafaa_preview_transition_plan', { p: input ?? {} })) ?? null,
    saveTransitionPlan: (input) => x.call('kafaa_save_transition_plan', { p: input ?? {} }, ['transition_plans', 'notifications']),
    reviewTransitionPlan: (input) => x.call('kafaa_review_transition_plan', { p: input ?? {} }, ['transition_plans']),
    closeTransitionPlan: (input) => x.call('kafaa_close_transition_plan', { p: input ?? {} }, ['transition_plans', 'notifications']),
    acknowledgeTransitionPlan: (planId) => x.call('kafaa_acknowledge_transition_plan', { p_plan: planId ?? null }, ['transition_plans']),
  };
}
