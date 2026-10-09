// F36 (W5 · E5) SupabaseBackend RPC mappings. Installed by src/data/ext/supabase.ts. Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { DigestStats } from '../rules';
import type { DigestBuildResult, DigestRpc } from './rpc';

export function makeSupabaseDigest(x: SupabaseExtCtx): DigestRpc {
  return {
    buildDigest: (hints = null) => x.call<DigestBuildResult>('kafaa_build_digest', { p_hints: hints ?? {} }, ['digest_runs', 'notifications']),
    setDigestPrefs: (p) => x.call<{ id: string }>('kafaa_set_digest_prefs', { p }, ['digest_prefs']),
    digestStats: () => x.rpc<DigestStats>('kafaa_digest_stats'),
  };
}
