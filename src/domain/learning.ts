/**
 * G2 (M04 learning, M05 assessments): pure business rules shared by pages, the LocalBackend RPCs (src/data/local/rpc_g2.ts)
 * and mirrored in SQL (supabase/migrations/20261008132001_kafaa_g2_learning.sql). Change them together.
 * Added by G2 on 2026-10-08 (additive file; see CONTRACT.md changelog).
 */
import { DAY, toDate } from './rules';

// ───────────── M04 enrolment and seats
/** Statuses that hold a seat in a session. */
export const SEAT_STATUSES = ['enrolled', 'in_progress', 'completed'] as const;
/** Statuses that count as an open (not finished, not cancelled) enrolment. */
export const OPEN_STATUSES = ['assigned', 'requested', 'approved', 'waitlisted', 'enrolled', 'in_progress'] as const;
export const isOpen = (s: string) => (OPEN_STATUSES as readonly string[]).includes(s);
export const holdsSeat = (s: string) => (SEAT_STATUSES as readonly string[]).includes(s);

/** Seat decision for a session: enrolled while seats are free, otherwise waitlisted. */
export function seatDecision(capacity: number, taken: number): 'enrolled' | 'waitlisted' {
  return taken < capacity ? 'enrolled' : 'waitlisted';
}

/** Prerequisite course ids that the person has not completed. */
export function missingPrerequisites(prereqs: readonly string[], completedCourseIds: Iterable<string>): string[] {
  const done = new Set(completedCourseIds);
  return prereqs.filter((p) => !done.has(p));
}

/**
 * Which first status a new enrolment gets.
 *  - learner choosing an elective that nobody assigned -> 'requested' (manager approval, spec M04 "external course requests with approval")
 *  - otherwise seat logic (session) or 'enrolled' (self-paced)
 */
export function initialEnrolmentStatus(o: { self: boolean; mandatory: boolean; assigned: boolean; supplierCourse: boolean; hasSession: boolean; capacity: number; taken: number }): 'requested' | 'enrolled' | 'waitlisted' {
  if (o.self && !o.mandatory && !o.assigned && !o.supplierCourse) return 'requested';
  if (!o.hasSession) return 'enrolled';
  return seatDecision(o.capacity, o.taken);
}

/** Certificate number: KAF-<year>-<6 digits>, next in sequence for that year. */
export function nextCertificateNo(existing: Iterable<string>, year: number): string {
  let max = 0;
  const re = new RegExp(`^KAF-${year}-(\\d{6})$`);
  for (const id of existing) {
    const m = re.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `KAF-${year}-${String(max + 1).padStart(6, '0')}`;
}

/**
 * A qualifying course cannot complete without its linked evaluation (spec M04 business rule).
 * The evaluation counts only once an evaluator has released it (spec M05: results count only after sign-off).
 */
export function evaluationGate<A extends { form_id: string; status: string; passed?: boolean | null; released: boolean; submitted_at?: string | null; released_at?: string | null }>(
  course: { qualifying: boolean; evaluation_form_id?: string | null },
  attempts: A[],
): { ok: boolean; code: 'ok' | 'no_form' | 'evaluation_required' | 'evaluation_failed'; attempt?: A } {
  if (!course.qualifying) return { ok: true, code: 'ok' };
  if (!course.evaluation_form_id) return { ok: false, code: 'no_form' };
  const mine = attempts
    .filter((a) => a.form_id === course.evaluation_form_id && a.status === 'released' && a.released)
    .sort((a, b) => String(b.released_at ?? b.submitted_at ?? '').localeCompare(String(a.released_at ?? a.submitted_at ?? '')));
  const pass = mine.find((a) => a.passed === true);
  if (pass) return { ok: true, code: 'ok', attempt: pass };
  if (mine.length) return { ok: false, code: 'evaluation_failed', attempt: mine[0] };
  return { ok: false, code: 'evaluation_required' };
}

// ───────────── M05 attempts: timing, scoring, retakes, appeals
/** Grace period after the deadline before a submission is flagged late. */
export const SUBMIT_GRACE_MIN = 2;
/** An exam may be opened from this many hours before its scheduled time. */
export const OPEN_EARLY_HOURS = 24;

export function attemptDeadline(startedAt: string | Date, limitMin: number): string {
  return new Date(toDate(startedAt).getTime() + limitMin * 60_000).toISOString();
}
export function isLate(deadline: string, submittedAt: string | Date): boolean {
  return toDate(submittedAt).getTime() > toDate(deadline).getTime() + SUBMIT_GRACE_MIN * 60_000;
}
export function canOpenAttempt(scheduledFor: string | null | undefined, now = new Date()): boolean {
  if (!scheduledFor) return true;
  return now.getTime() >= toDate(scheduledFor).getTime() - OPEN_EARLY_HOURS * 3_600_000;
}

/** Score a set of answers against the key. Voided items (appeal upheld) are left out of the denominator. */
export function scoreAnswers(itemIds: readonly string[], answers: Record<string, string | null | undefined>, key: Record<string, string>, voided: readonly string[] = []) {
  const counted = itemIds.filter((i) => !voided.includes(i));
  let correct = 0;
  for (const i of counted) if (answers[i] != null && answers[i] === key[i]) correct++;
  const score = counted.length ? Math.round((correct * 100) / counted.length) : 0;
  return { correct, total: counted.length, score };
}

export interface RetakeRules {
  max_attempts: number;
  retake_wait_days: number;
}
export interface AttemptLite {
  id: string;
  status: string;
  passed?: boolean | null;
  released: boolean;
  counts?: boolean;
  submitted_at?: string | null;
  released_at?: string | null;
  scheduled_for?: string | null;
}
export type RetakeCode = 'ok' | 'first' | 'already_passed' | 'result_pending' | 'retake_limit' | 'retake_wait';
/**
 * Retake rules per standard (spec M05 "Appeals and re-take rules per standard"):
 *  - no new attempt while one is scheduled, running or not yet released
 *  - no retake after a pass
 *  - at most max_attempts counted attempts (an upheld appeal makes an attempt not count)
 *  - a retake no earlier than retake_wait_days after the failed attempt
 */
export function retakeEligibility(rules: RetakeRules, previous: AttemptLite[], when: string | Date): { ok: boolean; code: RetakeCode; attemptNo: number; earliest?: string; retakeOf?: string } {
  const counted = previous.filter((a) => a.counts !== false);
  const attemptNo = counted.length + 1;
  if (previous.some((a) => a.status !== 'released')) return { ok: false, code: 'result_pending', attemptNo };
  if (previous.some((a) => a.passed === true)) return { ok: false, code: 'already_passed', attemptNo };
  if (!previous.length) return { ok: true, code: 'first', attemptNo: 1 };
  if (counted.length >= rules.max_attempts) return { ok: false, code: 'retake_limit', attemptNo };
  const last = [...previous].sort((a, b) => String(b.submitted_at ?? '').localeCompare(String(a.submitted_at ?? '')))[0];
  const base = toDate(last.submitted_at ?? last.scheduled_for ?? new Date());
  const earliest = new Date(base.getTime() + rules.retake_wait_days * DAY);
  earliest.setUTCHours(0, 0, 0, 0);
  if (toDate(when).getTime() < earliest.getTime()) return { ok: false, code: 'retake_wait', attemptNo, earliest: earliest.toISOString().slice(0, 10), retakeOf: last.id };
  return { ok: true, code: 'ok', attemptNo, retakeOf: last.id };
}

/** Appeals are open for appeal_days after the result was released. */
export function appealWindow(attempt: { status: string; released_at?: string | null; submitted_at?: string | null }, appealDays: number, now = new Date()): { open: boolean; closesOn: string | null } {
  if (attempt.status !== 'released') return { open: false, closesOn: null };
  const base = toDate(attempt.released_at ?? attempt.submitted_at ?? now);
  const close = new Date(base.getTime() + appealDays * DAY);
  return { open: now.getTime() <= close.getTime(), closesOn: close.toISOString().slice(0, 10) };
}

// ───────────── M05 item analysis (classical test theory, computed from responses; never shows item text)
export interface ItemStat {
  item_id: string;
  n: number;
  p: number | null; // difficulty index: proportion correct
  d: number | null; // discrimination: upper-lower 27% index
  flag: 'ok' | 'too_hard' | 'too_easy' | 'poor_discrimination' | 'low_n';
}
export const ITEM_ANALYSIS_MIN_N = 5;
export function itemAnalysis(attempts: { id: string; score: number | null; counts?: boolean }[], responses: { attempt_id: string; item_id: string; correct: boolean }[]): ItemStat[] {
  const scored = attempts.filter((a) => a.score != null && a.counts !== false);
  const scoreOf = new Map(scored.map((a) => [a.id, a.score as number]));
  const ranked = [...scored].sort((a, b) => (b.score as number) - (a.score as number));
  const k = Math.max(1, Math.round(ranked.length * 0.27));
  const upper = new Set(ranked.slice(0, k).map((a) => a.id));
  const lower = new Set(ranked.slice(-k).map((a) => a.id));
  const byItem = new Map<string, { attempt_id: string; correct: boolean }[]>();
  for (const r of responses) {
    if (!scoreOf.has(r.attempt_id)) continue;
    (byItem.get(r.item_id) ?? byItem.set(r.item_id, []).get(r.item_id)!).push(r);
  }
  const out: ItemStat[] = [];
  for (const [item_id, rs] of byItem) {
    const n = rs.length;
    const p = n ? rs.filter((r) => r.correct).length / n : null;
    const u = rs.filter((r) => upper.has(r.attempt_id));
    const l = rs.filter((r) => lower.has(r.attempt_id));
    const d = u.length && l.length ? u.filter((r) => r.correct).length / u.length - l.filter((r) => r.correct).length / l.length : null;
    let flag: ItemStat['flag'] = 'ok';
    if (n < ITEM_ANALYSIS_MIN_N) flag = 'low_n';
    else if (p != null && p < 0.3) flag = 'too_hard';
    else if (p != null && p > 0.9) flag = 'too_easy';
    else if (d != null && d < 0.2) flag = 'poor_discrimination';
    out.push({ item_id, n, p: p == null ? null : Math.round(p * 100) / 100, d: d == null ? null : Math.round(d * 100) / 100, flag });
  }
  return out.sort((a, b) => a.item_id.localeCompare(b.item_id));
}

/** Evaluator calibration: per evaluator pass rate and critical-step failure rate (spec M05 "evaluator calibration reports"). */
export function evaluatorCalibration(results: { evaluator_person_id: string; result: string; critical_failed: boolean; score_pct: number }[]) {
  const m = new Map<string, { n: number; pass: number; crit: number; score: number }>();
  for (const r of results) {
    const x = m.get(r.evaluator_person_id) ?? { n: 0, pass: 0, crit: 0, score: 0 };
    x.n++;
    if (r.result === 'pass') x.pass++;
    if (r.critical_failed) x.crit++;
    x.score += r.score_pct;
    m.set(r.evaluator_person_id, x);
  }
  return [...m.entries()].map(([evaluator, x]) => ({ evaluator, n: x.n, passRate: Math.round((x.pass * 100) / x.n), critRate: Math.round((x.crit * 100) / x.n), meanScore: Math.round(x.score / x.n) }));
}

/** Secure item text must never leave the bank: this is the list of item fields that may appear in exports or logs. */
export const ITEM_EXPORT_FIELDS = ['id', 'bank', 'topic', 'competency_id', 'difficulty', 'reference', 'current_version', 'status', 'p_value', 'discrimination'] as const;
