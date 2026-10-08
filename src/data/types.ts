/**
 * The typed repository interface every page uses. Two implementations:
 *   - LocalBackend   (src/data/local)     in-browser store seeded from src/seed/seed.json, same rules as RLS
 *   - SupabaseBackend (src/data/supabase) kafaa_* tables and RPCs in the NEXUS project, NEXUS session tokens
 * Rule: any new method must be added to BOTH backends and, if it writes, to a SQL RPC in supabase/migrations.
 */
import type { Table, RowOf } from './types.gen';
import type { PlatformRole } from '../auth/policy';
import type { G2Rpc } from './rpc_g2';
export type * from './rpc_g2';
export type { Table, RowOf } from './types.gen';
export * from './types.gen';

export type FilterValue<V> = V | V[] | { neq?: V; gte?: V; lte?: V; gt?: V; lt?: V; ilike?: string; isNull?: boolean; contains?: string };
export type Filter<T> = { [K in keyof T]?: FilterValue<T[K]> };
export interface Query<T> {
  filter?: Filter<T>;
  /** Free-text search across the given columns (case-insensitive, OR). */
  search?: { columns: (keyof T & string)[]; term: string };
  order?: [keyof T & string, 'asc' | 'desc'][];
  limit?: number;
  offset?: number;
}

export interface Result<T = unknown> {
  ok: boolean;
  code: 'ok' | 'forbidden' | 'not_found' | 'not_signed_in' | 'self_sign' | 'not_evaluator' | 'invalid' | 'conflict' | 'maker_checker' | 'separation_of_duties' | 'error' | string;
  message: string;
  data?: T;
  audit_seq?: number | null;
  ledger_seq?: number | null;
}

export interface Assignment {
  role: PlatformRole;
  scope_type: string;
  scope_value: string | null;
  status: string;
}
export interface Identity {
  personId: string | null;
  personaId: string | null;
  orgId: string | null;
  roles: PlatformRole[];
  assignments: Assignment[];
}

export interface SignoffInput {
  record_id: string;
  task_id?: string | null;
  method?: string;
  result: 'pass' | 'fail';
  date?: string;
  critical_failed?: boolean;
  correction_of?: string | null;
  correction_reason?: string | null;
}
export interface AggregateRow {
  family_id: string | null;
  level: string | null;
  entity_id: string | null;
  measure: string;
  value: number | null;
  group_size: number | null;
  suppressed: boolean;
  source: string;
  sample: boolean;
}
export interface CertificateCheck {
  found: boolean;
  certificate_no?: string;
  status?: string;
  course_code?: string;
  course_en?: string;
  course_ar?: string;
  issued_on?: string;
  valid_to?: string | null;
  holder_initials?: string;
  note?: string;
}

/** Consequential actions. Each one audits (success and refusal) and, where material, appends to the NEXUS ledger. */
// G2 (2026-10-08): M04/M05 RPCs are declared in ./rpc_g2.ts and merged here.
export interface Rpc extends G2Rpc {
  signoffEvaluation(p: SignoffInput): Promise<Result<{ evaluation_id: string; record_status: string }>>;
  setLicenceStatus(licenceId: string, status: string, reason: string): Promise<Result<{ due?: string }>>;
  detectLicensingEvents(): Promise<Result<{ lapses: number; medical: number }>>;
  decidePartnerOnboarding(id: string, decision: 'approved' | 'returned' | 'handed_off', note: string): Promise<Result>;
  decideApplication(id: string, stage: string, note: string): Promise<Result>;
  triageConcern(id: string, status: string, priority: string): Promise<Result>;
  decideEquivalency(id: string, status: string, note: string): Promise<Result>;
  getEquivalency(id: string): Promise<Result<RowOf<'equivalency_requests'>>>;
  observerReportAction(id: string, action: 'submit' | 'approve' | 'withdraw', orgIds?: string[]): Promise<Result>;
  screenResearchChallenge(id: string, securityOk: boolean, exportOk: boolean): Promise<Result>;
  setDalilEnabled(enabled: boolean): Promise<Result>;
  reviseStandard(id: string, reason: string): Promise<Result<{ new_id: string; flagged: number }>>;
  grantRole(personId: string, role: PlatformRole, scopeType: string, scopeValue: string | null): Promise<Result<{ id: string; status: string }>>;
  approveRole(assignmentId: string): Promise<Result>;
  revokeRole(assignmentId: string, reason: string): Promise<Result>;
  itemReview(itemId: string, action: 'submit' | 'review' | 'approve'): Promise<Result>;
  recordJpm(jpmId: string, personId: string, steps: { n: number; result: 'pass' | 'fail' }[]): Promise<Result<{ id: string; result: string; critical_failed: boolean }>>;
  bookSimulator(slotId: string, kind: string, crew: string | null): Promise<Result>;
  assignCurriculum(personId: string): Promise<Result<{ assigned: number }>>;
  verifyCertificate(no: string): Promise<CertificateCheck>;
  workforceAggregate(period: string, measure: string | null): Promise<AggregateRow[]>;
  applicationFunnel(): Promise<{ programme_id: string; stage: string; n: number | null; suppressed: boolean }[]>;
  logDenied(route: string, resource: string): Promise<void>;
  auditVerify(): Promise<Result<{ entries: number }>>;
  // ───── G1 additions (M02 qualification, M03 licensing tracker). SQL: supabase/migrations/20261008131000_kafaa_g1_quals_licensing.sql
  /** Supervisor acknowledges a signed evaluation in their scope (not their own, not one they evaluated). */
  ackEvaluation(evaluationId: string, note: string): Promise<Result<{ ack_id: string }>>;
  /** Expiry sweep over records in the caller's scope: notices at the standard's intervals (default 90/60/30) to person and manager; due/expired status. */
  qualExpirySweep(): Promise<Result<{ notices: number; due: number; expired: number }>>;
  /** Decide a record flagged by a standard revision: carry it over to the new version, or require retraining. */
  reviewQualRecord(recordId: string, decision: 'carry_over' | 'retrain', note: string): Promise<Result<{ record_status: string; standard_id: string }>>;
  /** Licensing alerts: renewal tasks from 12 months out, quarterly proficiency risk, 75-day FANR exam-notice reminders, withdrawal escalation, medical-due notices. */
  licensingAlerts(): Promise<Result<{ renewal: number; proficiency: number; exam_notice: number; withdrawal: number; medical_notices: number }>>;
  /** Close a coordinator task (the named role sent the notice through official channels; Kafa'a sends nothing to FANR). */
  closeLicensingTask(taskId: string, note: string): Promise<Result>;
  /** Mirror a new medical due date and fitness flag from the occupational health record (no medical content). Closes open medical tasks. */
  recordMedicalDate(personId: string, dueOn: string, flag: 'fit' | 'not_confirmed', sourceRef: string): Promise<Result<{ closed: number }>>;
  /** Crew availability for shift supervisors: available / not available only (null when the source sync is stale). Never medical detail. */
  crewAvailability(): Promise<{ person_id: string; available: boolean | null }[]>;
}

/** Read-only views over existing NEXUS tables (SECURITY DEFINER kafaa_nexus_* functions; a static snapshot in local mode). */
export interface NexusReads {
  personas(): Promise<{ id: string; role: string; title: string; lens: string; org_id: string; plane: string; decides: string }[]>;
  authority(): Promise<{ decision_key: string; decision: string; domain: string; authority_role: string; evidence_required: string; authority_ref: string; requires_second: boolean }[]>;
  trainingPrograms(): Promise<{ id: string; name: string; kind: string; duration_months: number | null; participants: number | null; description: string; basis: string }[]>;
  peopleQuals(): Promise<{ id: string; cohort: string; program_id: string | null; qualification: string; status: string; expires_at: string | null; progress_pct: number; headcount: number | null; suppressed: boolean }[]>;
  ecoCourses(): Promise<{ id: string; code: string; title: string; topic: string; summary: string; hours: number; format: string; pass_mark: number; validity_months: number; audience: string }[]>;
  ecoEnrolments(): Promise<{ id: string; org_id: string; persona_id: string; course_id: string; status: string; score: number | null; certificate_no: string | null }[]>;
  ecoScholarships(): Promise<Record<string, unknown>[]>;
  ecoPartnerships(): Promise<Record<string, unknown>[]>;
  /** Where the data came from: 'live' (Supabase) or 'snapshot' (bundled, read-only). */
  source: 'live' | 'snapshot';
}

export interface Repository {
  readonly backend: 'local' | 'supabase';
  list<K extends Table>(table: K, q?: Query<RowOf<K>>): Promise<RowOf<K>[]>;
  get<K extends Table>(table: K, id: string): Promise<RowOf<K> | null>;
  count<K extends Table>(table: K, q?: Query<RowOf<K>>): Promise<number>;
  /** Direct writes, allowed only where the table's write rule permits (src/data/schema.ts). Consequential actions use rpc. */
  insert<K extends Table>(table: K, row: Partial<RowOf<K>>): Promise<Result<RowOf<K>>>;
  update<K extends Table>(table: K, id: string, patch: Partial<RowOf<K>>): Promise<Result<RowOf<K>>>;
  rpc: Rpc;
  nexus: NexusReads;
  whoami(): Promise<Identity>;
  /** Switch the acting persona (null = anonymous). Called by the session provider only. */
  setPersona(persona: string | null): void;
  /** Fires with the tables that changed so hooks can refetch. */
  subscribe(fn: (tables: Table[]) => void): () => void;
  /** Local backend only: restore the seeded demo tenant. */
  reset?(): Promise<void>;
}
