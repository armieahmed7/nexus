// M30 SupabaseBackend RPC mappings (owner: FS wave B · E3, FS11 + FS12). Installed by src/data/ext/supabase.ts.
// SQL: supabase/migrations/20261010223001_kafaa_fs23_role_transformation.sql. Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { ExposureAgg, M30Rpc, Overview, RoleTransformationView } from './rpc';

export function makeSupabaseM30(x: SupabaseExtCtx): M30Rpc {
  return {
    roleTransformation: async (roleId = null, horizon = '2030') => (await x.rpc<RoleTransformationView | null>('kafaa_role_transformation', { p_role: roleId ?? null, p_horizon: horizon ?? '2030' })) ?? null,
    publishTransformation: (input) => x.call('kafaa_publish_transformation', { p: input ?? {} }, ['role_transformations', 'transformation_drafts']),
    exposureAggregate: async () => (await x.rpc<ExposureAgg | null>('kafaa_exposure_aggregate')) ?? null,
    transformationOverview: async (horizon = '2030') => (await x.rpc<Overview | null>('kafaa_transformation_overview', { p_horizon: horizon ?? '2030' })) ?? null,
  };
}
