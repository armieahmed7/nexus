// M34 RPC signatures (owners: wave D E2 (FS29, FS30) and wave I E1 (FS78, FS79)). Merged into Rpc (src/data/types.ts) through src/data/ext/rpc.ts.
// Every RPC exists three times and they must agree: this signature, backend/local.ts and SQL kafaa_<name> (+ backend/supabase.ts mapping).
// Migration slot: supabase/migrations/202610102<w><e>NNN_kafaa_fs<w><e>_<topic>.sql (PLAN.md section 2).
import type { Result } from '../../../data/types';
import type { AttachInput, DecideInput, OpenInput, RplOption } from '../rpl';
import type { TagInput } from '../credits';

/** FS29: rpc.submitRpl input. `open` (target + narrative; person_id only when an assessor opens for a contractor), `attach`
 *  (kind + ref_table + ref_id, or kind 'attestation' + attester_id + note), `detach` (evidence_id), `submit`, `withdraw` (id). */
export interface RplSubmitInput extends OpenInput, AttachInput {
  action: 'open' | 'attach' | 'detach' | 'submit' | 'withdraw';
  id?: string | null;
  evidence_id?: string | null;
}
/** FS29: rpc.decideRpl input. `recommend` (maker: outcome, credited_level, hours, rationale EN/AR), `confirm` or `return` (+ note) by a second assessor. */
export interface RplDecideInput extends DecideInput {
  id: string;
  action: 'recommend' | 'confirm' | 'return';
}
export interface RplAttestInput {
  evidence_id: string;
  confirm: boolean;
  text_en?: string | null;
  text_ar?: string | null;
}

export interface M34Rpc {
  // FS wave D · E2 · FS29/FS30 (SQL: supabase/migrations/20261010242001_kafaa_fs42_rpl_credits.sql; rules: src/modules/m34/rpl.ts, credits.ts)
  /** FS29: open, assemble, submit or withdraw an RPL request (the person; an assessor for a contractor). Security-restricted records are refused (`security_restricted`). Audited, no ledger. */
  submitRpl(input: RplSubmitInput): Promise<Result<{ id: string; status: string; evidence_id?: string | null }>>;
  /** FS29: the named supervisor confirms (with a statement) or declines an attestation. Audited, no ledger. */
  attestRpl(input: RplAttestInput): Promise<Result<{ id: string; status: string }>>;
  /** FS29: maker-checker decision. `recommend` by an assessor; `confirm` or `return` by a different assessor (never the person). Confirmation writes validated F01 evidence, recomputes skills, stores the RPL statement, refreshes the credit ledger and writes a ledger row. */
  decideRpl(input: RplDecideInput): Promise<Result<{ id: string; status: string; outcome?: string | null; evidence_ids?: string[]; credits?: number }>>;
  /** FS29: NQC-ready pack of a decided request (the person, recognition R/W/A). Initials only, roles not names, no FANR wording. Audited. */
  exportRpl(id: string): Promise<Result<Record<string, unknown>>>;
  /** FS29: the person's attachable records (self, or recognition A for anyone). Security-restricted items are listed without detail, flagged `restricted`. */
  rplEvidenceOptions(personId?: string | null): Promise<RplOption[]>;
  /** FS30: tag (or retire the tag of) a course, pathway or micro-credential with an indicative NQF level and notional hours (frameworks W/A). Re-syncs the ledgers of people who completed it. Audited, no ledger. */
  tagCredit(input: TagInput): Promise<Result<{ id: string; status: string; credits: number; synced: number }>>;
  /** FS30: rebuild a credit ledger from completed items (self; recognition A or frameworks W/A for anyone; null = everyone for them). Audited. */
  syncCredits(personId?: string | null): Promise<Result<{ people: number; upserted: number; reversed: number; total: number }>>;
}
