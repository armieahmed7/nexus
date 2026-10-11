// M01 RPC signatures added by FS05 (wave A · E4, fsAe4). Merged into Rpc (src/data/types.ts) through src/data/ext/rpc.ts.
// Every RPC exists three times and they must agree: this signature, backend/local.ts and SQL kafaa_<name> (+ backend/supabase.ts).
// SQL: supabase/migrations/20261010214001_kafaa_fs14_role_profiles.sql. PGlite parity: scripts/validate/fs14-role-profiles.mjs.
import type { Result } from '../../../data/types';
import type { Horizon, ProfileReq, ProfileSource } from '../roleProfiles';

export interface SaveRoleProfileInput {
  role_id: string;
  horizon: Horizon;
  requirements: ProfileReq[];
  drivers: string[];
  rationale_en: string;
  rationale_ar: string;
  sources: ProfileSource[];
  /** false saves (or updates) the open draft; true publishes it and supersedes the previous published version. */
  publish: boolean;
}
export interface SaveRoleProfileResult {
  id: string;
  version: number;
  status: 'draft' | 'published';
  supersedes_id: string | null;
}

export interface M01Rpc {
  /**
   * FS05: save or publish a role profile version for one role and horizon (now / 2030 / 2035). Training manager or admin only;
   * one open draft per role and horizon (saving again updates it); publishing supersedes the previous published version.
   * Audited; publishing also writes the NEXUS evidence ledger (kafaa.role_profile.publish).
   * Refusals: not_signed_in, forbidden, invalid, not_found, invalid_requirements, unknown_ref, security_restricted, unclean_text,
   * source_required, too_few.
   */
  saveRoleProfileVersion(input: SaveRoleProfileInput): Promise<Result<SaveRoleProfileResult>>;
}
