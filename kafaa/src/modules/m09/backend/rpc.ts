// M09 extension RPC signatures (owner: W5 · E2, F33 Contractor and supplier skills passport). Merged into Rpc through src/data/ext/rpc.ts.
// Every RPC exists three times and they must agree: this signature, backend/local.ts and SQL kafaa_<name> (+ backend/supabase.ts).
import type { Result } from '../../../data/types';
import type { Precheck, TargetInput } from '../contractor';
import type { FrReport } from '../futureReadiness';
import type { CheckSummary, PrearrivalCheck, PrearrivalInput } from '../prearrival';
import type { RecordItem } from '../../m17/learnerRecord';

export interface ContractorBadge {
  id: string;
  public_slug: string;
  course_id: string;
  achievement: Record<string, unknown>;
  issued_on: string;
  valid_to: string | null;
  status: string;
  /** Signed OpenBadgeCredential: for the holder and their partner admin only. */
  credential: Record<string, unknown> | null;
}

// ───────────── FS wave G · E5 (fsGe5): FS68 supplier future-skills readiness, FS69 contractor pre-arrival check.
// SQL: supabase/migrations/20261010275001_kafaa_fs75_supplier_readiness.sql. Rules: futureReadiness.ts, prearrival.ts.
export type PrearrivalStatus = 'active' | 'expired' | 'revoked';
export interface PrearrivalRow {
  id: string; share_id: string; person_id: string; initials: string; org_id: string; org_name_en: string; org_name_ar: string;
  standard_id: string; standard_code: string; standard_title_en: string; standard_title_ar: string; label: string; mobilise_on: string;
  expires_on: string; status: PrearrivalStatus; created_via: 'self' | 'on_behalf'; created_at: string; item_count: number; views: number;
  checked_at: string | null; check_summary: CheckSummary | null;
}
export interface PrearrivalDetail extends PrearrivalRow {
  consent_ref: string; note: string; revoked_at: string | null; revoke_reason: string | null;
  /** The shared items still shareable today (empty unless the link is active). */
  items: RecordItem[];
}
export interface PrearrivalItems {
  allowed: boolean;
  person: { id: string; initials: string; org_id: string; org_name_en: string; org_name_ar: string; job_role_id: string | null } | null;
  items: RecordItem[];
}
export interface PrearrivalContractor { id: string; initials: string; org_id: string; org_name_en: string; org_name_ar: string; job_role_id: string | null; ref: string }
export interface Fs75Rpc {
  /** FS68: contractor coverage of the 2030 versions of the contracted ENEC role profiles per supplier organisation (partner_org OwnOrg:
   *  own organisation; ENEC evaluators equivalency A/R and supplier management partner_org A/R: all). Under 10 contractors: suppressed. */
  supplierFutureReadiness(): Promise<FrReport>;
  /** FS69: pre-arrival shares the caller may see (own; own organisation for a partner admin; all for evaluators and auditors). No items. */
  prearrivalShares(): Promise<PrearrivalRow[]>;
  /** FS69: contractors an ENEC evaluator may record a share for (initials and organisation only). */
  prearrivalContractors(): Promise<PrearrivalContractor[]>;
  /** FS69: the items a contractor may share (the contractor, or an evaluator recording the contractor's consent). */
  prearrivalItems(personId?: string | null): Promise<PrearrivalItems>;
  /** FS69: create a pre-arrival share (FS32 link + standard + mobilisation date). Self, or an evaluator on behalf with a consent reference. Ledger. */
  createPrearrivalShare(input: PrearrivalInput): Promise<Result<{ id: string; share_id: string; token: string; expires_on: string }>>;
  /** FS69: revoke a pre-arrival share (the contractor, or an evaluator on the contractor's request with a reason). Ledger. */
  revokePrearrivalShare(id: string, reason?: string | null): Promise<Result<{ id: string }>>;
  /** FS69: one share with the shared items only while the link is active (the contractor, evaluators, auditors). Audited. */
  prearrivalShare(id: string): Promise<Result<PrearrivalDetail>>;
  /** FS69: the F33 pre-check against the shared skills only (evaluators, equivalency A). Writes no evidence and no qualification status. Audited. */
  precheckFromShare(id: string, standardId?: string | null): Promise<Result<PrearrivalCheck>>;
}

export interface M09Rpc extends Fs75Rpc {
  /** F33: read-only equivalency pre-check: the person's passport against the standard's tasks (likely / partial / gap, with reasons).
   *  The contractor, their organisation's partner admin, or an ENEC evaluator (equivalency A/R). Never changes the equivalency record;
   *  security standards are refused as in submitEquivalency. Audited, no ledger. */
  equivalencyPrecheck(personId: string, standardId: string): Promise<Result<Precheck>>;
  /** F33: ENEC (partner_org A) sets the ENEC role profile an organisation is contracted to staff, with a headcount band. Ledger. */
  setContractRoleTarget(input: TargetInput): Promise<Result<{ id: string }>>;
  /** F33 → F04: a contractor wraps their own valid supplier academy certificate as a signed Open Badges 3.0 credential. Ledger. */
  issueContractorBadge(certificateId: string): Promise<Result<{ id: string; slug: string }>>;
  /** F33: the contractor's credentials (self and their partner admin with the signed credential; ENEC evaluators without it). */
  contractorBadges(personId: string): Promise<ContractorBadge[]>;
}
