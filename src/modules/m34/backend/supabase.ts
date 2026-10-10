// M34 SupabaseBackend RPC mappings (owners: wave D E2 (FS29, FS30) and wave I E1 (FS78, FS79)). Installed by src/data/ext/supabase.ts.
// x.call('kafaa_<name>', { p_... }, ['<tables touched>']) for Result-returning RPCs; x.rpc(fn, args) for plain reads.
// Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { M34Rpc } from './rpc';

export function makeSupabaseM34(x: SupabaseExtCtx): M34Rpc {
  void x;
  return {};
}
