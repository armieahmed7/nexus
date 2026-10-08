// M26 SupabaseBackend RPC mappings (owner: W4). Installed by src/data/ext/supabase.ts.
// x.call('kafaa_<name>', { p_... }, ['<tables touched>']) for Result-returning RPCs; x.rpc(fn, args) for plain reads.
// Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { M26Rpc } from './rpc';

export function makeSupabaseM26(x: SupabaseExtCtx): M26Rpc {
  void x;
  return {};
}
