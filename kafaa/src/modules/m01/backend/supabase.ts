// M01 SupabaseBackend RPC mappings (FS05, fsAe4). Installed by src/data/ext/supabase.ts. Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { M01Rpc, SaveRoleProfileResult } from './rpc';

export function makeSupabaseM01(x: SupabaseExtCtx): M01Rpc {
  return {
    saveRoleProfileVersion: (input) => x.call<SaveRoleProfileResult>('kafaa_save_role_profile_version', { p: input }, ['role_profile_versions']),
  };
}
