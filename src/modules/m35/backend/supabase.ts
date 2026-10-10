// M35 SupabaseBackend RPC mappings (owners: wave F E1 (FS50, FS51) and wave G E1 (FS60, FS61)). Installed by src/data/ext/supabase.ts.
// x.call('kafaa_<name>', { p_... }, ['<tables touched>']) for Result-returning RPCs; x.rpc(fn, args) for plain reads.
// Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { M35Rpc } from './rpc';

export function makeSupabaseM35(x: SupabaseExtCtx): M35Rpc {
  void x;
  return {};
}
