// F36 (W5 · E5) digest RPC signatures. Merged into Rpc (src/data/types.ts) through src/data/ext/rpc.ts. Every RPC exists three
// times and they must agree: this signature, backend/local.ts and SQL kafaa_<name> in
// supabase/migrations/20261009155001_kafaa_w5e5_digest_dalil.sql (+ backend/supabase.ts).
import type { Result } from '../../../data/types';
import type { DigestFrequency, DigestHints, DigestItem, DigestStats } from '../rules';

export interface DigestBuildResult { run_id: string; period: string; created: boolean; items: DigestItem[]; notification_id: string | null }
export interface DigestPrefsInput { enabled: boolean; frequency: DigestFrequency; quiet_start: number | null; quiet_end: number | null; muted_kinds: string[] }

export interface DigestRpc {
  /** F36: build my digest for the current period (idempotent: a second call in the period returns the same run). Refuses when nudges
   *  are off (`nudges_off`) or during my quiet hours (`quiet_hours`). Writes one notification when the digest has items. Audited. */
  buildDigest(hints?: DigestHints | null): Promise<Result<DigestBuildResult>>;
  /** F36: save my nudge settings (on or off, frequency, quiet hours, muted kinds; expiry reminders cannot be muted). Audited. */
  setDigestPrefs(p: DigestPrefsInput): Promise<Result<{ id: string }>>;
  /** F36: open rate per period and items per kind for admins and auditors; every count under 10 is suppressed. */
  digestStats(): Promise<DigestStats>;
}
