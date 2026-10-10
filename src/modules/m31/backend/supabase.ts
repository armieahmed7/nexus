// M31 SupabaseBackend RPC mappings (owners: wave E E1 (FS38, FS39, FS40)). Installed by src/data/ext/supabase.ts.
// x.call('kafaa_<name>', { p_... }, ['<tables touched>']) for Result-returning RPCs; x.rpc(fn, args) for plain reads.
// Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { M31Rpc } from './rpc';

export function makeSupabaseM31(x: SupabaseExtCtx): M31Rpc {
  void x;
  return {};
}
