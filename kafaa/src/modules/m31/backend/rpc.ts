// M31 RPC signatures (owners: wave E E1 (FS38, FS39, FS40)). Merged into Rpc (src/data/types.ts) through src/data/ext/rpc.ts.
// Every RPC exists three times and they must agree: this signature, backend/local.ts and SQL kafaa_<name> (+ backend/supabase.ts mapping).
// SQL: supabase/migrations/20261010251001_kafaa_fs51_next_gen.sql. PGlite parity: scripts/validate/fs51-next-gen.mjs.
import type { Result } from '../../../data/types';
import type { Reason } from '../../../domain/engines/types';
import type { DeltaInput, MatrixStats } from '../nextgen';
import type { VisitInput } from '../literacy';
import type { TwinInput, TwinScore, TwinStats, TwinSubmission } from '../twin';

// ── FS38
export interface NextGenMatrix extends MatrixStats { as_of: string; ready_pct_line: number }
// ── FS39
export interface PlantHost { person_id: string; name_en: string; name_ar: string; role: string }
// ── FS40
export interface TwinResult extends Omit<TwinScore, 'reasons'> {
  attempt_id: string;
  scenario_id: string;
  attempt_no: number;
  pass_pct: number;
  /** explanations from the key, revealed with the result */
  explain: Record<string, { en: string; ar: string }>;
  evidence: { skill_id: string; level: number }[];
  reasons: Reason[];
}

export interface M31Rpc {
  /** FS38: add or edit an SMR delta for a current role and an ADVANCE technology (frameworks W/A). Versioned; security, safeguards and
   *  cyber roles stay path-only; text must pass the headcount, site and deployment-claim check; publishing needs two https sources. */
  saveSmrDelta(input: DeltaInput): Promise<Result<{ id: string; version: number; status: string }>>;
  /** FS38: HR view of readiness per technology and job family (workforce_strategy Agg or R); cells under 10 suppressed. Null otherwise. */
  nextGenMatrix(): Promise<NextGenMatrix | null>;
  /** FS39: the people I can name as host of a visit (active staff with an instructor, training manager or manager role, never me). */
  plantHosts(): Promise<PlantHost[]>;
  /** FS39: log a reference-plant visit or simulator observation for host confirmation (skills_profile Own). No evidence until confirmed. */
  logVisit(input: VisitInput): Promise<Result<{ id: string; status: string }>>;
  /** FS39: the named host confirms or declines a visit (never the visitor). Confirming writes capped F01 evidence (ojt, validated). */
  confirmVisit(input: { visit_id: string; decision: 'confirm' | 'decline'; reason?: string | null }): Promise<Result<{ id: string; status: string; level: number }>>;
  /** FS39: the visitor withdraws a visit still waiting for the host. */
  withdrawVisit(visitId: string): Promise<Result<{ id: string; status: string }>>;
  /** FS40: submit a digital-twin drill (skills_profile Own): scored server-side; a pass writes F01 assessment evidence <= L2. */
  submitTwinDrill(input: TwinSubmission & { scenario_id: string }): Promise<Result<TwinResult>>;
  /** FS40: drill results for training (secure_items W/A or skills_profile Agg), suppressed under 10. Null otherwise. */
  twinStats(): Promise<TwinStats | null>;
  /** FS40: add, edit or retire a drill with its key (training manager: secure_items A). Versioned; synthetic only; level <= 2. */
  saveTwinScenario(input: TwinInput): Promise<Result<{ id: string; version: number; status: string }>>;
}
