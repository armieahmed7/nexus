/**
 * The typed repository interface every page uses. Two implementations:
 *   - LocalBackend   (src/data/local)     in-browser store seeded from src/seed/seed.json, same rules as RLS
 *   - SupabaseBackend (src/data/supabase) kafaa_* tables and RPCs in the NEXUS project, NEXUS session tokens
 * Rule: any new method must be added to BOTH backends and, if it writes, to a SQL RPC in supabase/migrations.
 */
import type { Table, RowOf } from './types.gen';
import type { PlatformRole } from '../auth/policy';
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

// ───────────── G5 additions (M08, M13, M14, M16). Logged in CONTRACT.md changelog on branch g5.
export type DalilMode = 'public' | 'applicant' | 'staff' | 'partner';
export interface DalilCitation {
  label: string;
  url: string;
}
export interface DalilTurnInput {
  session_id?: string | null;
  /** Random per-browser key for anonymous rate limiting (no identity). */
  client_key?: string | null;
  mode: DalilMode;
  page_context?: string | null;
  question: string;
  answer: string;
  citations: DalilCitation[];
  refused: boolean;
  refusal_category?: string | null;
  intent?: string | null;
  confidence?: number | null;
  /** Concerns are never stored: the question text is replaced by a marker. */
  redact_question?: boolean;
}
export interface DalilTurnResult {
  session_id: string;
  used: number;
  limit: number;
  remaining: number;
}
export interface ConcernReferralInput {
  received_on: string;
  channel: string;
  anonymous: boolean;
  category: string;
  ecp_system_ref: string;
  priority?: string;
}
export interface LedgerEntry {
  seq: number;
  ts: string;
  actor: string;
  role: string;
  plane: string;
  domain: string;
  action: string;
  evidence_class: string;
  reason: string | null;
  prev_hash: string;
  hash: string;
  actor_persona_id: string | null;
}

/** Consequential actions. Each one audits (success and refusal) and, where material, appends to the NEXUS ledger. */
export interface Rpc {
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
  // ── G5 (M13) Dalil: log a turn with server-side kill switch, mode and rate-limit checks; request / resolve a human hand-off
  dalilTurn(p: DalilTurnInput): Promise<Result<DalilTurnResult>>;
  dalilHandoff(sessionId: string, target: 'careers' | 'training' | 'partner_desk', consent: boolean, note: string): Promise<Result>;
  resolveDalilHandoff(sessionId: string, status: 'picked_up' | 'closed'): Promise<Result>;
  // ── G5 (M08) ECP referral log (metadata only) and triage with closure outcome
  logConcernReferral(p: ConcernReferralInput): Promise<Result<{ id: string; ref_no: string }>>;
  triageConcernV2(id: string, status: string, priority: string, outcome: string | null): Promise<Result>;
  // ── G5 (M14) quarterly access review of an elevated grant
  reviewRoleAccess(assignmentId: string, decision: 'keep' | 'revoke', note: string): Promise<Result>;
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
  /** G5 (M16): NEXUS evidence-ledger entries written by Kafa'a (domain KAFAA). Admin and auditor only. */
  ledger(): Promise<LedgerEntry[]>;
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
