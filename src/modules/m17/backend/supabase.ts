// M17 SupabaseBackend RPC mappings (owner: W1). Installed by src/data/ext/supabase.ts.
// x.call('kafaa_<name>', { p_... }, ['<tables touched>']) for Result-returning RPCs; x.rpc(fn, args) for plain reads.
// Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { M17Rpc } from './rpc';

export function makeSupabaseM17(x: SupabaseExtCtx): M17Rpc {
  void x;
  return {};
}
