// M33 SupabaseBackend RPC mappings (owners: wave C E5 (FS25, FS26) and wave F E5 (FS58, FS59)). Installed by src/data/ext/supabase.ts.
// x.call('kafaa_<name>', { p_... }, ['<tables touched>']) for Result-returning RPCs; x.rpc(fn, args) for plain reads.
// FS25/FS26 SQL: supabase/migrations/20261010235001_kafaa_fs35_core_skills.sql. Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { CoreProfile, CoreStats } from '../coreSkills';
import type { SjtStats } from '../sjt';
import type { M33Rpc, SjtContext } from './rpc';

export function makeSupabaseM33(x: SupabaseExtCtx): M33Rpc {
  return {
    coreSkillsMine: async () => (await x.rpc<CoreProfile | null>('kafaa_core_skills_mine')) ?? null,
    coreSkillsStats: async () => (await x.rpc<CoreStats | null>('kafaa_core_skills_stats')) ?? null,
    startSjt: (input) => x.call('kafaa_start_sjt', { p: input ?? {} }, ['sjt_attempts']),
    submitSjt: (input) => x.call('kafaa_submit_sjt', { p: input ?? {} }, ['sjt_attempts']),
    sjtContext: async () => (await x.rpc<SjtContext | null>('kafaa_sjt_context')) ?? null,
    sjtStats: async () => (await x.rpc<SjtStats | null>('kafaa_sjt_stats')) ?? null,
    saveSjtItem: (input) => x.call('kafaa_save_sjt_item', { p: input ?? {} }, ['sjt_items']),
  };
}
