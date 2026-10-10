// M33 SupabaseBackend RPC mappings (owners: wave C E5 (FS25, FS26) and wave F E5 (FS58, FS59)). Installed by src/data/ext/supabase.ts.
// x.call('kafaa_<name>', { p_... }, ['<tables touched>']) for Result-returning RPCs; x.rpc(fn, args) for plain reads.
// Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { M33Rpc } from './rpc';

export function makeSupabaseM33(x: SupabaseExtCtx): M33Rpc {
  void x;
  return {};
}
