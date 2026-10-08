/**
 * Column guards for DIRECT writes that row-level policies alone cannot express. Mirrors the SQL trigger
 * kafaa_enrolments_guard (supabase/migrations/20261008132001_kafaa_g2_learning.sql). RPCs write with definer rights
 * (rawInsert/rawUpdate here, SECURITY DEFINER functions in SQL) and are not affected.
 * Added by G2 (2026-10-08): a learner may enrol or update progress directly, but completion, scores, certificates,
 * attendance and approvals are recorded only by the training organisation (M04: a qualifying course cannot complete
 * without its linked evaluation; certificates are issued only after a pass).
 */
import type { AccessContext } from '../access';

const ENROLMENT_PROTECTED = ['certificate_no', 'score', 'evaluation_id', 'completed_at', 'attendance', 'decided_by', 'decision_note'] as const;
const ENROLMENT_PROTECTED_STATUS = ['completed', 'failed', 'approved'];

export function directWriteGuard(table: string, before: Record<string, unknown> | null, next: Record<string, unknown>, ctx: AccessContext): string | null {
  if (table === 'enrolments') {
    if (ctx.has('training', ['W', 'A'])) return null;
    const changed = (k: string) => (before ? JSON.stringify(before[k] ?? null) !== JSON.stringify(next[k] ?? null) : next[k] != null);
    if (changed('status') && ENROLMENT_PROTECTED_STATUS.includes(String(next.status))) return 'Completion and approval are recorded by the training organisation';
    if (ENROLMENT_PROTECTED.some(changed)) return 'Completion evidence is recorded by the training organisation';
  }
  return null;
}
