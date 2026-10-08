// M25 SupabaseBackend RPC mappings (owner: W4). Installed by src/data/ext/supabase.ts.
// x.call('kafaa_<name>', { p_... }, ['<tables touched>']) for Result-returning RPCs; x.rpc(fn, args) for plain reads.
// Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { M25Rpc } from './rpc';

export function makeSupabaseM25(x: SupabaseExtCtx): M25Rpc {
  void x;
  return {};
}
