// M02 LocalBackend RPCs for F38 OJT practice logbook (owner: W5 · E1). Spread into makeLocalM02 (backend/local.ts).
// 1:1 mirror of kafaa_log_practice / kafaa_ack_practice / kafaa_request_evaluation / kafaa_close_evaluation_request /
// kafaa_ojt_preceptors in supabase/migrations/20261009151001_kafaa_w5e1_microcred_ojt.sql: same checks in the same order, the same
// refusal codes and messages (OJTMSG in src/modules/m02/ojt.ts), the same audit rows (no ledger: practice is not a sign-off).
// Never writes qual_records or evaluations. Shared writes: M14 notifications (kind `ojt`, ids `nt-ojt-...`); the F30 statement is
// appended by the LRS emitter on the ojt_logs insert (installLrsEmitters / SQL trigger kafaa_xapi_emit_ojt_logs).
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import { OJTMSG, OJT_RULES, PRACTICE_METHODS, myStandards, preceptorOk, preceptorsFor, readiness, validateLog, type LogRow, type Readiness } from '../ojt';
import type { M02Rpc } from './rpc';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const hex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (x) => x.toString(16).padStart(2, '0')).join('');
const trim = (x: unknown) => String(x ?? '').trim();

export function makeLocalM02Ojt(b: LocalBackend, h: LocalRpcHelpers): Pick<M02Rpc, 'logPractice' | 'ackPractice' | 'requestEvaluation' | 'closeEvaluationRequest' | 'ojtPreceptors'> {
  const raw = (t: string) => b.raw(t as never) as unknown as Row[];
  const get = (t: string, id: string | null | undefined) => (id ? (b.rawGet(t as never, id) as unknown as Row | undefined) : undefined);
  const ins = (t: string, row: Row) => b.rawInsert(t as never, row as never);
  const upd = (t: string, id: string, patch: Row) => b.rawUpdate(t as never, id, patch as never);
  const me = () => b.identity().personId;
  const ctx = () => b.access();
  const notify = (id: string, pid: string | null | undefined, en: string, ar: string, link: string, severity = 'info') => {
    if (!pid || !get('people', pid) || get('notifications', id)) return;
    ins('notifications', { id, person_id: pid, kind: 'ojt', title_en: en, title_ar: ar, link, severity, created_at: nowTs() });
  };
  const pw = (today: string) => ({ today, people: raw('people'), qual_records: raw('qual_records'), evaluator_quals: raw('evaluator_quals') });
  const nameOf = (id: string) => { const p = get('people', id); return { en: String(p?.display_name ?? id), ar: String(p?.display_name_ar || p?.display_name || id) }; };
  const readinessOf = (person: string, task: Row): Readiness => readiness(task as never, raw('ojt_logs').filter((l) => l.person_id === person) as LogRow[]);

  return {
    async logPractice(input) {
      await b.whenReady();
      type R = { id: string; duplicate: boolean; status: string };
      const A = 'ojt.log';
      const caller = me();
      const taskId = typeof input?.task_id === 'string' ? input.task_id : null;
      if (!caller) return h.refuse<R>(A, 'ojt_logs', taskId, 'not_signed_in', OJTMSG.not_signed_in);
      const role = ctx().actingRole('qual_records', ['Own']);
      const person = get('people', caller);
      if (!role || !person || person.kind !== 'staff') return h.refuse<R>(A, 'ojt_logs', taskId, 'forbidden', OJTMSG.forbidden, role);
      const today = todayIso();
      const key = typeof input?.client_key === 'string' ? input.client_key : '';
      // idempotent re-sync: the same device key never records twice
      const dup = raw('ojt_logs').find((l) => l.client_key === key && key !== '');
      if (dup) {
        if (dup.person_id !== caller) return h.refuse<R>(A, 'ojt_logs', taskId, 'bad_key', OJTMSG.bad_key, role);
        return h.done<R>(A, 'ojt_logs', dup.id, 'duplicate client key: nothing recorded', role, null, '', OJTMSG.duplicate, { id: dup.id, duplicate: true, status: dup.status }, ['ojt_logs']);
      }
      const shape = validateLog(input, today);
      if (shape === 'bad_key') return h.refuse<R>(A, 'ojt_logs', taskId, 'bad_key', OJTMSG.bad_key, role);
      const task = get('task_items', taskId);
      const std = get('qual_standards', task?.standard_id);
      if (!task || !std) return h.refuse<R>(A, 'ojt_logs', taskId, 'not_found', OJTMSG.task_not_found, role);
      if (std.security_restricted) return h.refuse<R>(A, 'ojt_logs', task.id, 'security_restricted', OJTMSG.security_restricted, role);
      if (!(PRACTICE_METHODS as readonly string[]).includes(task.method)) return h.refuse<R>(A, 'ojt_logs', task.id, 'not_practice_task', OJTMSG.not_practice_task, role);
      if (!myStandards(person, raw('qual_records'), raw('qual_standards')).has(std.id)) return h.refuse<R>(A, 'ojt_logs', task.id, 'not_applicable', OJTMSG.not_applicable, role);
      if (shape !== 'ok') return h.refuse<R>(A, 'ojt_logs', task.id, 'invalid', OJTMSG.invalid, role);
      const pre = String(input.preceptor_person_id ?? '');
      const pc = preceptorOk(pre, caller, std.id, pw(today));
      if (pc !== 'ok') return h.refuse<R>(A, 'ojt_logs', task.id, pc, OJTMSG[pc], role);
      const id = `ojt-${hex(8)}`;
      const me1 = nameOf(caller), pn = nameOf(pre);
      ins('ojt_logs', {
        id, client_key: key, person_id: caller, person_name: me1.en, person_name_ar: me1.ar, task_id: task.id, standard_id: std.id, on_date: input.on_date, mode: input.mode,
        preceptor_person_id: pre, preceptor_name: pn.en, preceptor_name_ar: pn.ar, confidence: Number(input.confidence), conditions: trim(input.conditions) || null, note: trim(input.note) || null,
        status: 'pending_ack', feedback: null, preceptor_ready: false, ack_at: null, synced: input.offline ? 'offline' : 'online', created_at: nowTs(),
      });
      notify(`nt-ojt-${id}`, pre, `Practice to acknowledge: ${task.code} (${me1.en})`, `تدريب عملي بانتظار تأكيدك: ${task.code} (${me1.ar})`, '/my/ojt?tab=acknowledge');
      return h.done<R>(A, 'ojt_logs', id, `${task.code} ${input.mode} on ${input.on_date}${input.offline ? ' (synced from offline)' : ''}`, role, null, '', OJTMSG.logged, { id, duplicate: false, status: 'pending_ack' }, ['ojt_logs', 'notifications', 'xapi_statements']);
    },

    async ackPractice(input) {
      await b.whenReady();
      type R = { id: string; status: string; readiness: Readiness };
      const A = 'ojt.ack';
      const caller = me();
      const logId = typeof input?.log_id === 'string' ? input.log_id : null;
      if (!caller) return h.refuse<R>(A, 'ojt_logs', logId, 'not_signed_in', OJTMSG.not_signed_in);
      const role = ctx().actingRole('own_profile', ['Own']);
      const l = get('ojt_logs', logId);
      if (!l || !role) return h.refuse<R>(A, 'ojt_logs', logId, 'not_found', OJTMSG.not_found_log, role);
      if (l.preceptor_person_id !== caller) return h.refuse<R>(A, 'ojt_logs', l.id, 'not_preceptor', OJTMSG.not_addressed, role);
      if (l.status !== 'pending_ack') return h.refuse<R>(A, 'ojt_logs', l.id, 'conflict', OJTMSG.already_acked, role);
      const fb = trim(input.feedback);
      if (fb.length < OJT_RULES.feedbackMin || fb.length > OJT_RULES.feedbackMax || (input.decision !== 'acknowledge' && input.decision !== 'return')) return h.refuse<R>(A, 'ojt_logs', l.id, 'invalid', OJTMSG.feedback_required, role);
      const status = input.decision === 'acknowledge' ? 'acknowledged' : 'returned';
      upd('ojt_logs', l.id, { status, feedback: fb, preceptor_ready: status === 'acknowledged' && input.ready === true, ack_at: nowTs() });
      const task = get('task_items', l.task_id)!;
      const r = readinessOf(l.person_id, task);
      notify(`nt-ojt-${l.id}-${status}`, l.person_id, status === 'acknowledged' ? `Practice acknowledged: ${task.code}${r.ready ? ' (ready for evaluation)' : ''}` : `Practice returned with feedback: ${task.code}`,
        status === 'acknowledged' ? `تم تأكيد التدريب العملي: ${task.code}${r.ready ? ' (جاهز للتقييم)' : ''}` : `أُعيد التدريب العملي مع ملاحظات: ${task.code}`, '/my/ojt', status === 'acknowledged' ? 'ok' : 'warn');
      return h.done<R>(A, 'ojt_logs', l.id, `${status}${status === 'acknowledged' && input.ready === true ? ', ready for evaluation' : ''}`, role, null, '', status === 'acknowledged' ? OJTMSG.acked : OJTMSG.returned, { id: l.id, status, readiness: r }, ['ojt_logs', 'notifications']);
    },

    async requestEvaluation(taskId, evaluatorId, note) {
      await b.whenReady();
      type R = { id: string };
      const A = 'ojt.request_evaluation';
      const caller = me();
      if (!caller) return h.refuse<R>(A, 'ojt_eval_requests', taskId || null, 'not_signed_in', OJTMSG.not_signed_in);
      const role = ctx().actingRole('qual_records', ['Own']);
      const person = get('people', caller);
      if (!role || !person || person.kind !== 'staff') return h.refuse<R>(A, 'ojt_eval_requests', taskId || null, 'forbidden', OJTMSG.forbidden, role);
      const task = get('task_items', taskId);
      const std = get('qual_standards', task?.standard_id);
      if (!task || !std) return h.refuse<R>(A, 'ojt_eval_requests', taskId || null, 'not_found', OJTMSG.task_not_found, role);
      if (std.security_restricted) return h.refuse<R>(A, 'ojt_eval_requests', task.id, 'security_restricted', OJTMSG.security_restricted, role);
      const rec = raw('qual_records').filter((q) => q.person_id === caller && q.standard_id === std.id && q.status !== 'suspended').sort((x, y) => (x.id < y.id ? -1 : 1))[0];
      if (!rec) return h.refuse<R>(A, 'ojt_eval_requests', task.id, 'no_record', OJTMSG.no_record, role);
      const r = readinessOf(caller, task);
      if (!r.ready) return h.refuse<R>(A, 'ojt_eval_requests', task.id, 'not_ready', OJTMSG.not_ready, role);
      const ev = String(evaluatorId ?? '');
      if (ev === caller) return h.refuse<R>(A, 'ojt_eval_requests', task.id, 'self_evaluator', OJTMSG.self_evaluator, role);
      const today = todayIso();
      const evp = get('people', ev);
      if (!evp || evp.status !== 'active' || !raw('evaluator_quals').some((q) => q.person_id === ev && q.standard_id === std.id && String(q.valid_to).slice(0, 10) >= today))
        return h.refuse<R>(A, 'ojt_eval_requests', task.id, 'not_evaluator', OJTMSG.not_evaluator, role);
      if (raw('ojt_eval_requests').some((x) => x.person_id === caller && x.task_id === task.id && x.status === 'requested')) return h.refuse<R>(A, 'ojt_eval_requests', task.id, 'already_requested', OJTMSG.already_requested, role);
      const n = trim(note);
      if (n.length > 500) return h.refuse<R>(A, 'ojt_eval_requests', task.id, 'invalid', OJTMSG.note_required, role);
      const id = `oer-${hex(8)}`;
      const me1 = nameOf(caller), en = nameOf(ev);
      ins('ojt_eval_requests', {
        id, person_id: caller, person_name: me1.en, person_name_ar: me1.ar, task_id: task.id, standard_id: std.id, record_id: rec.id, evaluator_person_id: ev, evaluator_name: en.en, evaluator_name_ar: en.ar,
        status: 'requested', readiness: { supervised: r.supervised, needed: r.needed, last_ack_id: r.last_ack_id }, note: n || null, requested_at: nowTs(), closed_at: null, closed_by: null, close_note: null, evaluation_id: null, result: null,
      });
      notify(`nt-ojt-${id}`, ev, `Evaluation requested: ${task.code} (${me1.en})`, `طلب تقييم: ${task.code} (${me1.ar})`, '/my/ojt?tab=evaluate');
      return h.done<R>(A, 'ojt_eval_requests', id, `${task.code} to ${ev}; ${r.supervised}/${r.needed} supervised, preceptor ready`, role, null, '', OJTMSG.requested, { id }, ['ojt_eval_requests', 'notifications']);
    },

    async closeEvaluationRequest(requestId, action, note) {
      await b.whenReady();
      type R = { id: string; status: string; evaluation_id: string | null; result: string | null };
      const A = 'ojt.close_request';
      const caller = me();
      if (!caller) return h.refuse<R>(A, 'ojt_eval_requests', requestId || null, 'not_signed_in', OJTMSG.not_signed_in);
      const role = ctx().actingRole('own_profile', ['Own']);
      const q = get('ojt_eval_requests', requestId);
      const mine = !!q && ((action === 'cancel' && q.person_id === caller) || (action !== 'cancel' && q.evaluator_person_id === caller));
      if (!q || !role || !mine) return h.refuse<R>(A, 'ojt_eval_requests', requestId || null, 'not_found', OJTMSG.not_found_req, role);
      if (q.status !== 'requested') return h.refuse<R>(A, 'ojt_eval_requests', q.id, 'conflict', OJTMSG.not_open, role);
      const n = trim(note);
      if (n.length > 500 || (action === 'decline' && n.length < 3) || !['complete', 'decline', 'cancel'].includes(action)) return h.refuse<R>(A, 'ojt_eval_requests', q.id, 'invalid', OJTMSG.note_required, role);
      let evaluation: Row | undefined;
      if (action === 'complete') {
        evaluation = raw('evaluations').filter((e) => e.record_id === q.record_id && e.task_id === q.task_id && e.evaluator_person_id === caller && e.result !== 'pending' && String(e.created_at ?? '') >= String(q.requested_at))
          .sort((x, y) => (String(y.created_at) < String(x.created_at) ? -1 : String(y.created_at) > String(x.created_at) ? 1 : x.id < y.id ? 1 : -1))[0];
        if (!evaluation) return h.refuse<R>(A, 'ojt_eval_requests', q.id, 'no_evaluation', OJTMSG.no_evaluation, role);
      }
      const status = action === 'complete' ? 'completed' : action === 'decline' ? 'declined' : 'cancelled';
      upd('ojt_eval_requests', q.id, { status, closed_at: nowTs(), closed_by: caller, close_note: n || null, evaluation_id: evaluation?.id ?? null, result: evaluation?.result ?? null });
      const task = get('task_items', q.task_id);
      if (action !== 'cancel') notify(`nt-ojt-${q.id}-${status}`, q.person_id, action === 'complete' ? `Evaluation recorded: ${task?.code} (${evaluation?.result})` : `Evaluation request declined: ${task?.code}`,
        action === 'complete' ? `سُجّل التقييم: ${task?.code} (${evaluation?.result === 'pass' ? 'ناجح' : 'غير ناجح'})` : `رُفض طلب التقييم: ${task?.code}`, '/my/ojt', action === 'complete' && evaluation?.result === 'pass' ? 'ok' : 'warn');
      return h.done<R>(A, 'ojt_eval_requests', q.id, `${status}${evaluation ? ` with ${evaluation.id} (${evaluation.result})` : ''}${n ? `: ${n}` : ''}`, role, null, '',
        action === 'complete' ? OJTMSG.completed : action === 'decline' ? OJTMSG.declined : OJTMSG.cancelled, { id: q.id, status, evaluation_id: evaluation?.id ?? null, result: evaluation?.result ?? null }, ['ojt_eval_requests', 'notifications']);
    },

    async ojtPreceptors(taskId) {
      await b.whenReady();
      const caller = me();
      const task = get('task_items', taskId);
      const std = get('qual_standards', task?.standard_id);
      if (!caller || !task || !std || std.security_restricted || !ctx().has('qual_records', ['Own'])) return [];
      return preceptorsFor(caller, std.id, pw(todayIso()));
    },
  };
}
