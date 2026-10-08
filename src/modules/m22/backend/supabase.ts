// M22 SupabaseBackend RPC mappings (owner: W2). Installed by src/data/ext/supabase.ts.
// x.call('kafaa_<name>', { p_... }, ['<tables touched>']) for Result-returning RPCs; x.rpc(fn, args) for plain reads.
// Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { M22Rpc } from './rpc';

export function makeSupabaseM22(x: SupabaseExtCtx): M22Rpc {
  void x;
  return {};
}
