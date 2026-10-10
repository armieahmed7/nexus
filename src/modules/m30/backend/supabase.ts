// M30 SupabaseBackend RPC mappings (owners: wave B E3 (FS11, FS12) and wave I E3 (FS81)). Installed by src/data/ext/supabase.ts.
// x.call('kafaa_<name>', { p_... }, ['<tables touched>']) for Result-returning RPCs; x.rpc(fn, args) for plain reads.
// Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { M30Rpc } from './rpc';

export function makeSupabaseM30(x: SupabaseExtCtx): M30Rpc {
  void x;
  return {};
}
