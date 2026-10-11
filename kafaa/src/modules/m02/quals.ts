/**
 * Pure qualification logic for M02 pages: task status from the append-only evaluation history (corrections supersede),
 * acknowledgement state, display masking for security-restricted standards, required-standard gap analysis per person,
 * and the "who is qualified for task X" lookup. Interprets mirrored records only; it never sets a status.
 */
import { qualView, type QualView } from '../../domain/rules';

export interface EvalLite {
  id: string;
  record_id: string;
  task_id?: string | null;
  person_id: string;
  method: string;
  evaluator_person_id?: string | null;
  evaluator_role: string;
  result: 'pass' | 'fail' | 'pending';
  date: string;
  critical_failed: boolean;
  supervisor_ack_by?: string | null;
  supervisor_ack_at?: string | null;
  correction_of?: string | null;
  correction_reason?: string | null;
  created_at: string;
}
export interface AckLite {
  evaluation_id: string;
  ack_role: string;
  created_at: string;
}
export interface RecordLite {
  id: string;
  person_id: string;
  standard_id: string;
  status: string;
  qualified_on?: string | null;
  expires_on?: string | null;
  needs_review: boolean;
  security_mirror_only: boolean;
}
export interface StandardLite {
  id: string;
  code: string;
  role_ids: string[] | null;
  discipline: string;
  status: string;
  security_restricted: boolean;
}

/** Evaluations that are still in force: not superseded by a correction. */
export function effective<E extends EvalLite>(evals: E[]): E[] {
  const corrected = new Set(evals.map((e) => e.correction_of).filter(Boolean) as string[]);
  return evals.filter((e) => !corrected.has(e.id));
}

export type AckState = 'acknowledged' | 'awaiting' | 'none';
export function ackState(e: EvalLite, acks: AckLite[]): AckState {
  if (e.result === 'pending') return 'none';
  if (e.supervisor_ack_at || acks.some((a) => a.evaluation_id === e.id)) return 'acknowledged';
  return 'awaiting';
}

export interface TaskRow<E extends EvalLite = EvalLite> {
  taskId: string;
  latest: E | null;
  status: 'passed' | 'failed' | 'pending' | 'not_started';
  history: E[];
}
/** Latest effective evaluation per task on a record (latest by date, then creation time). */
export function taskRows<E extends EvalLite>(taskIds: string[], recordId: string, evals: E[]): TaskRow<E>[] {
  const mine = evals.filter((e) => e.record_id === recordId);
  const eff = effective(mine);
  return taskIds.map((taskId) => {
    const history = mine.filter((e) => e.task_id === taskId).sort((a, b) => (b.date + b.created_at).localeCompare(a.date + a.created_at));
    const latest = eff.filter((e) => e.task_id === taskId).sort((a, b) => (b.date + b.created_at).localeCompare(a.date + a.created_at))[0] ?? null;
    const status = !latest ? 'not_started' : latest.result === 'pass' ? 'passed' : latest.result === 'fail' ? 'failed' : 'pending';
    return { taskId, latest, status, history };
  });
}

/** What a record shows. Security-restricted standards show qualified / not qualified only (spec, security track). */
export function displayView(r: RecordLite, now = new Date()): { view: QualView | 'not_qualified'; days: number | null; notice: number | null; masked: boolean } {
  const v = qualView(r, now);
  if (r.security_mirror_only) return { view: v.view === 'qualified' || v.view === 'due' || v.view === 'renewed' ? 'qualified' : 'not_qualified', days: null, notice: null, masked: true };
  return { view: v.view, days: v.daysToExpiry, notice: v.notice, masked: false };
}
export const viewTone = (v: string): 'ok' | 'sim' | 'bad' | 'info' | 'neutral' =>
  v === 'qualified' || v === 'renewed' ? 'ok' : v === 'due' ? 'sim' : v === 'expired' || v === 'suspended' || v === 'not_qualified' ? 'bad' : v === 'in_progress' ? 'info' : 'neutral';

/** Standards a role requires: those listing the role, plus all-staff standards (no role list). */
export function requiredStandards<S extends StandardLite>(stds: S[], roleId: string | null | undefined): S[] {
  return stds.filter((s) => s.status === 'current' && ((s.role_ids ?? []).length === 0 || (!!roleId && (s.role_ids ?? []).includes(roleId))));
}

export type GapStatus = 'held' | 'due' | 'expired' | 'in_progress' | 'suspended' | 'missing' | 'needs_review';
export interface QualGap<S> {
  standard: S;
  record: RecordLite | null;
  status: GapStatus;
}
/** Gap analysis for one person: each required standard against the person's records (matched by standard code across versions). */
export function qualGap<S extends StandardLite>(allStds: S[], records: RecordLite[], roleId: string | null | undefined, now = new Date()): QualGap<S>[] {
  const codeOf = new Map(allStds.map((s) => [s.id, s.code]));
  return requiredStandards(allStds, roleId).map((s) => {
    const rec = records.find((r) => codeOf.get(r.standard_id) === s.code) ?? null;
    let status: GapStatus = 'missing';
    if (rec) {
      const v = displayView(rec, now).view;
      status = rec.needs_review ? 'needs_review' : v === 'qualified' || v === 'renewed' ? 'held' : v === 'due' ? 'due' : v === 'expired' || v === 'not_qualified' ? 'expired' : v === 'suspended' ? 'suspended' : 'in_progress';
    }
    return { standard: s, record: rec, status };
  });
}

/** People currently qualified for a task: record on the task's standard is in force and the task has a passing effective evaluation. */
export function qualifiedForTask(records: RecordLite[], evals: EvalLite[], standardId: string, taskId: string, now = new Date()): RecordLite[] {
  return records.filter((r) => {
    if (r.standard_id !== standardId) return false;
    const v = displayView(r, now).view;
    if (!(v === 'qualified' || v === 'due' || v === 'renewed')) return false;
    if (r.security_mirror_only) return true;
    return taskRows([taskId], r.id, evals)[0].status === 'passed';
  });
}
