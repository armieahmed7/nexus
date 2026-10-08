// M24 SupabaseBackend RPC mappings (owner: W3). Installed by src/data/ext/supabase.ts.
// x.call('kafaa_<name>', { p_... }, ['<tables touched>']) for Result-returning RPCs; x.rpc(fn, args) for plain reads.
// Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { M24Rpc } from './rpc';

export function makeSupabaseM24(x: SupabaseExtCtx): M24Rpc {
  void x;
  return {};
}
