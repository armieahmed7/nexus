/**
 * Column guards for DIRECT writes that row-level policies alone cannot express. Mirrors the SQL triggers
 * kafaa_g2_guard_* (supabase/migrations/20261008132001_kafaa_g2_learning.sql). RPCs write with definer rights
 * (rawInsert/rawUpdate here, SECURITY DEFINER functions in SQL) and are not affected.
 * Added by G2 (2026-10-08). Decisions and completion evidence are recorded only through the audited RPCs:
 *  - enrolments: completion, scores, certificates, attendance and approvals (training W/A may edit directly)
 *  - external_requests, dev_plans, mentoring_requests: approvals and responses (decideExternalRequest, decideDevPlan, respondMentoring)
 *  - courses: a qualifying course needs a linked evaluation form (M04: it cannot complete without one)
 */
import type { AccessContext } from '../access';

type Row = Record<string, unknown>;
const changed = (before: Row | null, next: Row, k: string) => (before ? JSON.stringify(before[k] ?? null) !== JSON.stringify(next[k] ?? null) : next[k] != null);
const statusTo = (before: Row | null, next: Row, allowed: string[]) => (before ? before.status !== next.status : true) && next.status != null && !allowed.includes(String(next.status));

export function directWriteGuard(table: string, before: Row | null, next: Row, ctx: AccessContext): string | null {
  switch (table) {
    case 'enrolments': {
      if (ctx.has('training', ['W', 'A'])) return null;
      if (changed(before, next, 'status') && ['completed', 'failed', 'approved'].includes(String(next.status))) return 'Completion and approval are recorded by the training organisation';
      if (['certificate_no', 'score', 'evaluation_id', 'completed_at', 'attendance', 'decided_by', 'decision_note'].some((k) => changed(before, next, k))) return 'Completion evidence is recorded by the training organisation';
      return null;
    }
    case 'external_requests':
      if (statusTo(before, next, ['requested']) || ['approver_person_id', 'decided_at', 'decision_note'].some((k) => changed(before, next, k))) return 'External requests are decided through the approval workflow';
      return null;
    case 'dev_plans':
      if (statusTo(before, next, ['draft', 'submitted', 'closed']) || ['approved_by', 'decided_at', 'decision_note'].some((k) => changed(before, next, k))) return 'Development plans are approved by a line manager';
      return null;
    case 'mentoring_requests':
      if (statusTo(before, next, before ? ['closed'] : ['requested']) || changed(before, next, 'responded_at')) return 'Only the mentor accepts or declines a request';
      return null;
    case 'mentors': // W2E3 (F13): SME nomination is recorded only through rpc.nominateSme (mirror: kafaa_w2e3_mentor_guard)
      if (['sme', 'sme_skill_ids', 'sme_nominated_by', 'sme_nominated_on'].some((k) => changed(before, next, k) && !(before == null && (next[k] == null || next[k] === false || (Array.isArray(next[k]) && !(next[k] as unknown[]).length)))))
        return 'Subject-matter expert nominations are recorded by the line manager';
      return null;
    case 'courses':
      if (next.qualifying === true && !next.evaluation_form_id) return 'A qualifying course needs a linked evaluation form';
      return null;
    default:
      return null;
  }
}
