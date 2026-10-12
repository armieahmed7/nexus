// M32 SupabaseBackend RPC mappings (owners: wave E E2 (FS41, FS42, FS43)). Installed by src/data/ext/supabase.ts.
// x.call('kafaa_<name>', { p_... }, ['<tables touched>']) for Result-returning RPCs; x.rpc(fn, args) for plain reads.
// FS41 SQL: supabase/migrations/20261010252001_kafaa_fs52_energy_transition.sql. Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { CecProfile, CecStats } from '../cec';
import type { M32Rpc } from './rpc';

export function makeSupabaseM32(x: SupabaseExtCtx): M32Rpc {
  return {
    cecMine: async () => (await x.rpc<CecProfile | null>('kafaa_cec_mine')) ?? null,
    cecStats: async () => (await x.rpc<CecStats | null>('kafaa_cec_stats')) ?? null,
  };
}
