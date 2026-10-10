// M36 SupabaseBackend RPC mappings (owners: wave G E3 (FS64, FS65) and wave I E4 (FS82, FS83)). Installed by src/data/ext/supabase.ts.
// x.call('kafaa_<name>', { p_... }, ['<tables touched>']) for Result-returning RPCs; x.rpc(fn, args) for plain reads.
// Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { M36Rpc } from './rpc';

export function makeSupabaseM36(x: SupabaseExtCtx): M36Rpc {
  void x;
  return {};
}
