// M30 RPC signatures (owners: wave B E3 (FS11, FS12) and wave I E3 (FS81)). Merged into Rpc (src/data/types.ts) through src/data/ext/rpc.ts.
// Every RPC exists three times and they must agree: this signature, backend/local.ts and SQL kafaa_<name> (+ backend/supabase.ts mapping).
// SQL: supabase/migrations/20261010223001_kafaa_fs23_role_transformation.sql. PGlite parity: scripts/validate/fs23-role-transformation.mjs.
import type { Result } from '../../../data/types';
import type { ExposureAgg, Overview, RoleMap, RtInput } from '../transform';

export type { RoleMap, ExposureAgg, Overview, RtInput };
export interface RtDraft extends Omit<RtInput, 'publish' | 'role_id'> { saved_by: string | null; saved_at: string | null }
export interface RoleTransformationView {
  /** My current role (job_roles id) or null. */
  my_role_id: string | null;
  /** The map of the requested role (my role by default); null when the role is not a current role. */
  map: RoleMap | null;
  /** Training manager / HR director: may save and publish this map. */
  can_edit: boolean;
  /** The open draft (editors only). */
  draft: RtDraft | null;
}
export interface PublishResult { id: string; status: 'draft' | 'published'; version: number }

export interface M30Rpc {
  /** FS11/FS12: the role transformation map for a role (default: my role) with my time-to-ready at the horizon (2030 default).
   *  Any holder of `transformation` (staff R, auditors R). Security, safeguards and cyber roles return a path-only map. Null otherwise. */
  roleTransformation(roleId?: string | null, horizon?: '2030' | '2035'): Promise<RoleTransformationView | null>;
  /** FS11: save (draft) or publish a role transformation map. Training manager or HR director (transformation W/A). Checks: archetype,
   *  drivers, summaries, path-level for security roles, clean text (no headcount, sites or deployment claims), the FS12 copy check
   *  ("replace", "redundant" and their Arabic equivalents), no numbers in the public summary, a source to publish. Audited; ledger on publish. */
  publishTransformation(input: RtInput): Promise<Result<PublishResult>>;
  /** FS12: exposure of rated tasks by job family, family group and in total, weighted by the people in each role; groups under 10 people
   *  suppressed; security families never broken out. transformation Agg/A (HR). Null otherwise. */
  exposureAggregate(): Promise<ExposureAgg | null>;
  /** FS11: people already meeting their role's 2030 (or 2035) profile and the median months to get there, by family and group,
   *  suppressed under 10. transformation Agg/A (HR). Null otherwise. */
  transformationOverview(horizon?: '2030' | '2035'): Promise<Overview | null>;
}
