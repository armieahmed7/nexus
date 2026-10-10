// M29 SupabaseBackend RPC mappings (owners: wave B E2 (FS09, FS10), wave D E5 (FS36, FS37) and wave I E2 (FS80)). Installed by src/data/ext/supabase.ts.
// x.call('kafaa_<name>', { p_... }, ['<tables touched>']) for Result-returning RPCs; x.rpc(fn, args) for plain reads.
// Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { M29Rpc } from './rpc';

export function makeSupabaseM29(x: SupabaseExtCtx): M29Rpc {
  void x;
  return {};
}
