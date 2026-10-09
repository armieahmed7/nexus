/**
 * F38 OJT practice logbook (W5 · E1, module M02): pure rules shared by the pages, the offline queue, the LocalBackend
 * (src/modules/m02/backend/local.ojt.ts) and, line for line, the SQL in supabase/migrations/20261009151001_kafaa_w5e1_microcred_ojt.sql
 * (kafaa_ojt_*). The PGlite validator (scripts/validate/w5e1-microcred-ojt.mjs) proves SQL = TS. Import-free: node scripts load it.
 *
 * A trainee (or a qualified worker keeping a task fresh) logs each practice of a qualification task: the date, the conditions
 * (walkthrough, simulate, perform), the preceptor who watched, a confidence rating and a note. The preceptor acknowledges it on
 * their own device with feedback and, when they judge so, "ready for evaluation". This is practice, never a qualification
 * sign-off: nothing here writes qualification records or evaluations. A task is ready when it has at least N supervised
 * performances (acknowledged `perform` entries; N = 3, or 4 for a critical task) and the latest acknowledgement says "ready".
 * "Request evaluation" then hands the task to a qualified evaluator, who signs it off through M02 signoffEvaluation.
 */

export const OJT_MODES = ['walkthrough', 'simulate', 'perform'] as const;
export type OjtMode = (typeof OJT_MODES)[number];
export const LOG_STATUSES = ['pending_ack', 'acknowledged', 'returned'] as const;
export const REQ_STATUSES = ['requested', 'completed', 'declined', 'cancelled'] as const;
/** Task methods that can be practised on the job (classroom and written items are not). */
export const PRACTICE_METHODS = ['ojt', 'jpm', 'simulator'] as const;

export const OJT_RULES = {
  readyPerform: 3,
  readyPerformCritical: 4,
  confidenceMin: 1,
  confidenceMax: 5,
  noteMax: 500,
  feedbackMin: 3,
  feedbackMax: 500,
  backdateDays: 180,
  keyMin: 8,
  keyMax: 80,
} as const;
export const CLIENT_KEY_RE = /^[A-Za-z0-9:_-]{8,80}$/;

/** Refusal and result messages: identical in SQL. */
export const OJTMSG = {
  not_signed_in: 'Sign in to use the OJT logbook',
  forbidden: 'Only staff with qualification records can keep an OJT logbook',
  invalid: 'Check the entry: date (today or up to 180 days back), conditions, confidence 1 to 5 and a note of up to 500 characters',
  bad_key: 'The entry key is not valid',
  task_not_found: 'Task not found',
  security_restricted: 'Security-restricted tasks are managed outside Kafa\'a and cannot be logged',
  not_practice_task: 'Classroom and written items are not practised on the job',
  not_applicable: 'This task is not on a qualification standard of yours or of your role',
  self_preceptor: 'Choose a preceptor other than yourself',
  not_preceptor: 'The preceptor must be qualified on this standard (or an evaluator for it)',
  logged: 'Practice logged. It is practice, not a qualification sign-off.',
  duplicate: 'Already synced: this entry was recorded once',
  not_found_log: 'Entry not found',
  not_addressed: 'Only the preceptor named on the entry can acknowledge it',
  already_acked: 'This entry has already been answered',
  feedback_required: 'Add feedback for the trainee (3 to 500 characters)',
  acked: 'Practice acknowledged',
  returned: 'Entry returned to the trainee with your feedback',
  no_record: 'You need a qualification record on this standard before an evaluation can be requested',
  not_ready: 'Not ready yet: more supervised performances or a preceptor "ready" are needed',
  self_evaluator: 'You cannot evaluate your own task',
  not_evaluator: 'The evaluator must hold a current evaluator qualification for this standard',
  already_requested: 'An evaluation request for this task is already open',
  requested: 'Evaluation requested. The evaluator signs the task off in M02.',
  not_found_req: 'Request not found',
  not_open: 'This request is no longer open',
  no_evaluation: 'Sign the task off first (record the evaluation), then close the request',
  completed: 'Evaluation request closed with the recorded result',
  cancelled: 'Evaluation request cancelled',
  declined: 'Evaluation request declined',
  note_required: 'Add a short note (3 to 500 characters)',
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
export interface LogInput {
  /** Idempotency key generated on the device (8-80 characters: letters, digits, `:`, `_`, `-`). Re-sending it records nothing new. */
  client_key: string;
  task_id: string;
  on_date: string;
  mode: OjtMode;
  preceptor_person_id: string;
  confidence: number;
  conditions?: string | null;
  note?: string | null;
  /** The entry was written offline and synced later. */
  offline?: boolean;
}
export interface AckInput { log_id: string; decision: 'acknowledge' | 'return'; feedback: string; ready: boolean }
export interface LogRow {
  id: string; client_key: string; person_id: string; task_id: string; standard_id: string; on_date: string; mode: OjtMode; preceptor_person_id: string;
  confidence: number; conditions: string | null; note: string | null; status: string; feedback: string | null; preceptor_ready: boolean; ack_at: string | null;
  synced: string; created_at?: string; person_name?: string; person_name_ar?: string | null; preceptor_name?: string; preceptor_name_ar?: string | null;
}

const d10 = (v: unknown) => String(v ?? '').slice(0, 10);
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
export function addDays(d: string, n: number): string {
  const t = new Date(`${d.slice(0, 10)}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}
const isDate = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

/** Validate the shape of a practice entry (not the task or preceptor). Same as kafaa_ojt_validate. */
export function validateLog(x: LogInput, today: string): 'ok' | 'bad_key' | 'invalid' {
  if (!x || typeof x !== 'object') return 'invalid';
  if (typeof x.client_key !== 'string' || !CLIENT_KEY_RE.test(x.client_key)) return 'bad_key';
  if (!isDate(x.on_date) || x.on_date > today || x.on_date < addDays(today, -OJT_RULES.backdateDays)) return 'invalid';
  if (!(OJT_MODES as readonly string[]).includes(x.mode)) return 'invalid';
  const c = x.confidence;
  if (typeof c !== 'number' || !Number.isInteger(c) || c < OJT_RULES.confidenceMin || c > OJT_RULES.confidenceMax) return 'invalid';
  if (x.note != null && (typeof x.note !== 'string' || x.note.length > OJT_RULES.noteMax)) return 'invalid';
  if (x.conditions != null && (typeof x.conditions !== 'string' || x.conditions.length > 200)) return 'invalid';
  return 'ok';
}

/** Standards a person may practise: those of their qualification records, those of their job role, and the all-staff standard. */
export function myStandards(person: Row | undefined, quals: Row[], standards: Row[]): Set<string> {
  const out = new Set<string>();
  if (!person) return out;
  for (const q of quals) if (q.person_id === person.id) out.add(q.standard_id);
  for (const s of standards) if (s.status === 'current' && ((person.job_role_id && (s.role_ids ?? []).includes(person.job_role_id)) || (s.role_ids ?? []).length === 0)) out.add(s.id);
  return out;
}
/** Qualification states that make someone a preceptor for a standard (current, or due but not yet expired). */
export const PRECEPTOR_QUAL = ['qualified', 'renewed', 'due'];
/**
 * May `candidate` act as preceptor for `trainee` on `standardId`? A current qualification on the standard, or a current evaluator
 * qualification for it; never the trainee; staff only. Same as kafaa_ojt_preceptor_ok.
 */
export function preceptorOk(candidate: string, trainee: string, standardId: string, w: { today: string; people: Row[]; qual_records: Row[]; evaluator_quals: Row[] }): 'ok' | 'self_preceptor' | 'not_preceptor' {
  if (candidate === trainee) return 'self_preceptor';
  const p = w.people.find((x) => x.id === candidate);
  if (!p || p.kind !== 'staff' || p.status !== 'active') return 'not_preceptor';
  const q = w.qual_records.some((r) => r.person_id === candidate && r.standard_id === standardId && PRECEPTOR_QUAL.includes(r.status) && (!r.expires_on || d10(r.expires_on) >= w.today));
  const e = w.evaluator_quals.some((r) => r.person_id === candidate && r.standard_id === standardId && d10(r.valid_to) >= w.today);
  return q || e ? 'ok' : 'not_preceptor';
}
/** Eligible preceptors for a trainee and standard, same team first, then by name. */
export function preceptorsFor(trainee: string, standardId: string, w: { today: string; people: Row[]; qual_records: Row[]; evaluator_quals: Row[] }): { id: string; name_en: string; name_ar: string; job_role_id: string | null; same_team: boolean; evaluator: boolean }[] {
  const me = w.people.find((x) => x.id === trainee);
  const ids = new Set<string>([...w.qual_records.filter((r) => r.standard_id === standardId).map((r) => r.person_id), ...w.evaluator_quals.filter((r) => r.standard_id === standardId).map((r) => r.person_id)]);
  return [...ids].filter((id) => preceptorOk(id, trainee, standardId, w) === 'ok').map((id) => {
    const p = w.people.find((x) => x.id === id)!;
    return { id, name_en: String(p.display_name ?? id), name_ar: String(p.display_name_ar || p.display_name || id), job_role_id: p.job_role_id ?? null,
      same_team: !!me?.team_id && p.team_id === me.team_id, evaluator: w.evaluator_quals.some((r) => r.person_id === id && r.standard_id === standardId && d10(r.valid_to) >= w.today) };
  }).sort((a, b) => Number(b.same_team) - Number(a.same_team) || cmp(a.name_en, b.name_en) || cmp(a.id, b.id));
}

export interface Readiness {
  task_id: string;
  /** Acknowledged `perform` entries. */
  supervised: number;
  needed: number;
  practised: number;
  pending: number;
  preceptor_ready: boolean;
  last_ack_id: string | null;
  last_ack_on: string | null;
  ready: boolean;
}
/** Readiness of one task from the person's entries. Same as kafaa_ojt_readiness. */
export function readiness(task: { id: string; critical?: boolean | null }, logs: Pick<LogRow, 'id' | 'task_id' | 'mode' | 'status' | 'preceptor_ready' | 'ack_at' | 'on_date'>[]): Readiness {
  const mine = logs.filter((l) => l.task_id === task.id);
  const acked = mine.filter((l) => l.status === 'acknowledged').sort((a, b) => cmp(String(b.ack_at ?? ''), String(a.ack_at ?? '')) || cmp(d10(b.on_date), d10(a.on_date)) || cmp(b.id, a.id));
  const supervised = acked.filter((l) => l.mode === 'perform').length;
  const needed = task.critical ? OJT_RULES.readyPerformCritical : OJT_RULES.readyPerform;
  const last = acked[0] ?? null;
  const preceptor_ready = !!last && last.preceptor_ready === true;
  return { task_id: task.id, supervised, needed, practised: mine.length, pending: mine.filter((l) => l.status === 'pending_ack').length, preceptor_ready, last_ack_id: last?.id ?? null, last_ack_on: last ? d10(last.ack_at) : null, ready: supervised >= needed && preceptor_ready };
}

/** Reasons for the readiness indicator (rendered by <WhyThis>). */
export function readinessReasons(r: Readiness): { code: string; key: string; vars?: Record<string, number | string>; ref?: { table: string; id: string } }[] {
  const out: { code: string; key: string; vars?: Record<string, number | string>; ref?: { table: string; id: string } }[] = [
    { code: 'ojt_supervised', key: 'm02.reasons.ojt_supervised', vars: { n: r.supervised, needed: r.needed } },
  ];
  out.push(r.preceptor_ready && r.last_ack_id
    ? { code: 'ojt_ready_ack', key: 'm02.reasons.ojt_ready_ack', vars: { date: r.last_ack_on ?? '' }, ref: { table: 'ojt_logs', id: r.last_ack_id } }
    : { code: 'ojt_no_ready', key: 'm02.reasons.ojt_no_ready' });
  if (r.pending) out.push({ code: 'ojt_pending', key: 'm02.reasons.ojt_pending', vars: { n: r.pending } });
  out.push({ code: 'ojt_not_signoff', key: 'm02.reasons.ojt_not_signoff' });
  return out;
}

/** xAPI (F30) statement fields for an entry: verb `attempted`, object = the task. */
export const OJT_VERB = 'attempted';

/** A client key for a new entry on this device. */
export const newClientKey = (person: string) => `ojt:${person.replace(/[^A-Za-z0-9_-]/g, '')}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`.slice(0, 80);
