// M32 SupabaseBackend RPC mappings (owners: wave E E2 (FS41, FS42, FS43)). Installed by src/data/ext/supabase.ts.
// x.call('kafaa_<name>', { p_... }, ['<tables touched>']) for Result-returning RPCs; x.rpc(fn, args) for plain reads.
// Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { M32Rpc } from './rpc';

export function makeSupabaseM32(x: SupabaseExtCtx): M32Rpc {
  void x;
  return {};
}
