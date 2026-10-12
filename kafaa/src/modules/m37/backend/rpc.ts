// M37 RPC signatures (owners: wave G E2 (FS62, FS63) and wave H E2 (FS73, FS74)). Merged into Rpc (src/data/types.ts) through src/data/ext/rpc.ts.
// Every RPC exists three times and they must agree: this signature, backend/local.ts and SQL kafaa_<name> (+ backend/supabase.ts mapping).
// FS62/FS63 SQL: supabase/migrations/20261010272001_kafaa_fs72_national_alignment.sql. PGlite parity: scripts/validate/fs72-national-alignment.mjs.
import type { Result } from '../../../data/types';
import type { LinkInput, NationalReport, ReportFilter, TagInput } from '../national';
import type { CodeInput, OccupationInput, OccupationTrend } from '../occupations';

export interface M37Rpc {
  /** FS62: the filtered national-alignment report (national_alignment R/Agg/W/A): tags in scope with item counts, the linked items with
   *  live status and reasons; measures and people reached (suppressed under 10) only for Agg/W/A (HR analyst, HR director, admin).
   *  Read-only, never audited. Null without a national_alignment grant. */
  nationalReport(filter?: ReportFilter | null): Promise<NationalReport | null>;
  /** FS62: add or edit a national tag (national_alignment W: HR director, admin). EN and AR, sources (the most official first is
   *  computed), no typed totals; one strategy-level tag per strategy; versioned; ledger when a tag is added or retired. */
  saveNationalTag(input: TagInput): Promise<Result<{ id: string; version: number; status: string }>>;
  /** FS62: link or unlink a skill, competence, programme, pathway, credential or target row (national_alignment W). Links derived
   *  from data (Jahiz groups, Net Zero competences) are refused; unlinking deactivates the row; audited, no ledger. */
  setTagLink(input: LinkInput): Promise<Result<{ id: string; active: boolean }>>;
  /** FS63: edit a current role's occupation label and indicative skill level (national_alignment W). Concept roles get no mapping. */
  saveRoleOccupation(input: OccupationInput): Promise<Result<{ id: string; version: number }>>;
  /** FS63: record a verified MoHRE code with its official source (national_alignment A: admin; never the last editor of the row). Ledger. */
  verifyOccupationCode(input: CodeInput): Promise<Result<{ id: string; code: string }>>;
  /** FS63: return a code to "pending review" with a reason (national_alignment A). Ledger. */
  clearOccupationCode(roleId: string, reason: string): Promise<Result<{ id: string }>>;
  /** FS63: the SIMULATED skill-level uplift trend (national_alignment Agg/W/A), every cell under 10 suppressed. Null otherwise. */
  occupationTrend(): Promise<OccupationTrend | null>;
}
