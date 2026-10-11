// M37 SupabaseBackend RPC mappings (owners: wave G E2 (FS62, FS63) and wave H E2 (FS73, FS74)). Installed by src/data/ext/supabase.ts.
// x.call('kafaa_<name>', { p_... }, ['<tables touched>']) for Result-returning RPCs; x.rpc(fn, args) for plain reads.
// Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { M37Rpc } from './rpc';

export function makeSupabaseM37(x: SupabaseExtCtx): M37Rpc {
  void x;
  return {};
}
