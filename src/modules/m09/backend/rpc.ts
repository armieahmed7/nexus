// M09 extension RPC signatures (owner: W5 · E2, F33 Contractor and supplier skills passport). Merged into Rpc through src/data/ext/rpc.ts.
// Every RPC exists three times and they must agree: this signature, backend/local.ts and SQL kafaa_<name> (+ backend/supabase.ts).
import type { Result } from '../../../data/types';
import type { Precheck, TargetInput } from '../contractor';

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

export interface M09Rpc {
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
