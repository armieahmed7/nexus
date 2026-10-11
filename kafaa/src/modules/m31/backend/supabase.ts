// M31 SupabaseBackend RPC mappings (owners: wave E E1 (FS38, FS39, FS40)). Installed by src/data/ext/supabase.ts.
// x.call('kafaa_<name>', { p_... }, ['<tables touched>']) for Result-returning RPCs; x.rpc(fn, args) for plain reads.
// SQL: supabase/migrations/20261010251001_kafaa_fs51_next_gen.sql. Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { TwinStats } from '../twin';
import type { M31Rpc, NextGenMatrix, PlantHost } from './rpc';

export function makeSupabaseM31(x: SupabaseExtCtx): M31Rpc {
  return {
    saveSmrDelta: (input) => x.call('kafaa_save_smr_delta', { p: input ?? {} }, ['smr_deltas']),
    nextGenMatrix: async () => (await x.rpc<NextGenMatrix | null>('kafaa_next_gen_matrix')) ?? null,
    plantHosts: async () => (await x.rpc<PlantHost[] | null>('kafaa_plant_hosts')) ?? [],
    logVisit: (input) => x.call('kafaa_log_visit', { p: input ?? {} }, ['plant_visits', 'notifications']),
    confirmVisit: (input) => x.call('kafaa_confirm_visit', { p: input ?? {} }, ['plant_visits', 'skill_evidence', 'person_skills', 'notifications']),
    withdrawVisit: (visitId) => x.call('kafaa_withdraw_visit', { p_visit_id: visitId }, ['plant_visits']),
    submitTwinDrill: (input) => x.call('kafaa_submit_twin_drill', { p: input ?? {} }, ['twin_attempts', 'skill_evidence', 'person_skills']),
    twinStats: async () => (await x.rpc<TwinStats | null>('kafaa_twin_stats')) ?? null,
    saveTwinScenario: (input) => x.call('kafaa_save_twin_scenario', { p: input ?? {} }, ['twin_scenarios', 'twin_keys']),
  };
}
