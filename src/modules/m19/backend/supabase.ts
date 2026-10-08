// M19 SupabaseBackend RPC mappings (owner: W1). Installed by src/data/ext/supabase.ts.
// x.call('kafaa_<name>', { p_... }, ['<tables touched>']) for Result-returning RPCs; x.rpc(fn, args) for plain reads.
// Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { M19Rpc } from './rpc';

export function makeSupabaseM19(x: SupabaseExtCtx): M19Rpc {
  void x;
  return {};
}
