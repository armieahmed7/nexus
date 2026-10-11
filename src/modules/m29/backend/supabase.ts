// M29 SupabaseBackend RPC mappings (owners: wave B E2 (FS09, FS10), wave D E5 (FS36, FS37) and wave I E2 (FS80)). Installed by src/data/ext/supabase.ts.
// x.call('kafaa_<name>', { p_... }, ['<tables touched>']) for Result-returning RPCs; x.rpc(fn, args) for plain reads.
// FS09/FS10 SQL: supabase/migrations/20261010222001_kafaa_fs22_ai_fluency.sql. Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { FitnessStats } from '../fitness';
import type { AiCoverageView, AiFluencyStats, AiFluencyView, FitnessContext, M29Rpc } from './rpc';
import type { DrillStats } from '../drills';

export function makeSupabaseM29(x: SupabaseExtCtx): M29Rpc {
  return {
    aiFluency: async () => (await x.rpc<AiFluencyView | null>('kafaa_ai_fluency')) ?? null,
    aiFluencyStats: async () => (await x.rpc<AiFluencyStats | null>('kafaa_ai_fluency_stats')) ?? null,
    startFitness: () => x.call('kafaa_start_fitness', {}, ['fitness_attempts']),
    submitFitness: (input) => x.call('kafaa_submit_fitness', { p: input ?? {} }, ['fitness_attempts', 'skill_evidence', 'person_skills']),
    fitnessContext: async () => (await x.rpc<FitnessContext | null>('kafaa_fitness_context')) ?? null,
    fitnessStats: async () => (await x.rpc<FitnessStats | null>('kafaa_fitness_stats')) ?? null,
    saveFitnessItem: (input) => x.call('kafaa_save_fitness_item', { p: input ?? {} }, ['fitness_items']),
    // FS36/FS37: supabase/migrations/20261010245001_kafaa_fs45_ai_register_drills.sql
    aiLiteracyCoverage: async () => (await x.rpc<AiCoverageView | null>('kafaa_ai_literacy_coverage')) ?? null,
    saveAiSystem: (input) => x.call('kafaa_save_ai_system', { p: input ?? {} }, ['ai_systems', 'ai_system_users']),
    submitDrill: (input) => x.call('kafaa_submit_drill', { p: input ?? {} }, ['ai_drill_attempts', 'skill_evidence', 'person_skills']),
    drillStats: async () => (await x.rpc<DrillStats | null>('kafaa_drill_stats')) ?? null,
    saveDrill: (input) => x.call('kafaa_save_drill', { p: input ?? {} }, ['ai_drills', 'ai_drill_keys']),
  };
}
