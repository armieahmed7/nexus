// M28 SupabaseBackend RPC mappings (owners: wave B E1 (FS07, FS08) and wave H E1 (FS70, FS71, FS72)). Installed by src/data/ext/supabase.ts.
// x.call('kafaa_<name>', { p_... }, ['<tables touched>']) for Result-returning RPCs; x.rpc(fn, args) for plain reads.
// Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { M28Rpc } from './rpc';

export function makeSupabaseM28(x: SupabaseExtCtx): M28Rpc {
  void x;
  return {};
}
