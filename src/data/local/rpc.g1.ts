/**
 * G1 (M02 qualification, M03 licensing tracker) RPCs for the LocalBackend.
 * 1:1 mirror of supabase/migrations/20261008131000_kafaa_g1_quals_licensing.sql: same checks, refusal codes,
 * audit rows (success and refusal) and ledger behaviour. Change both files together.
 * Kafa'a is a tracker, not an authority: nothing here decides a licence or sends anything to FANR.
 */
import type { LocalBackend } from './LocalBackend';
import type { Result, RowOf } from '../types';
import { RULES } from '../../auth/policy';
import { addWorkingDays, daysBetween, isoDate, proficiency, quarterEnd, quarterOf, todayIso, toDate, withdrawalDate } from '../../domain/rules';
import { newId } from './store';

const addDays = (d: string, n: number) => isoDate(new Date(toDate(d).getTime() + n * 86_400_000));
const addMonths = (d: string, m: number) => {
  const x = toDate(d);
  x.setUTCMonth(x.getUTCMonth() + m);
  return isoDate(x);
};

export class G1LocalRpc {
  constructor(private readonly b: LocalBackend) {}
  private get ctx() {
    return this.b.access();
  }
  private get me() {
    return this.b.identity().personId;
  }
  private async refuse<T = unknown>(action: string, table: string | null, entity: string | null, code: string, message: string, role: string | null = null): Promise<Result<T>> {
    const a = await this.b.audit(action, table, entity, 'refused', `${code}: ${message}`, 'not_applicable', null, role);
    return { ok: false, code, message, audit_seq: a.seq as number };
  }
  private async done<T>(action: string, table: string, entity: string | null, reason: string | null, role: string | null, ledgerAction: string | null, ledgerReason: string, message: string, data: T, tables: string[]): Promise<Result<T>> {
    const l = ledgerAction ? await this.b.ledger(ledgerAction, ledgerReason) : null;
    const a = await this.b.audit(action, table, entity, 'ok', reason, ledgerAction ? (l == null ? 'skipped' : 'written') : 'not_applicable', l, role);
    this.b.changed(tables as never);
    return { ok: true, code: 'ok', message, data, audit_seq: a.seq as number, ledger_seq: l };
  }
  private notify(id: string, person_id: string, kind: string, title_en: string, title_ar: string, link: string, severity: 'info' | 'warn' | 'bad'): boolean {
    if (this.b.rawGet('notifications', id) || !this.b.rawGet('people', person_id)) return false;
    this.b.rawInsert('notifications', { id, person_id, kind, title_en, title_ar, link, severity });
    return true;
  }

  // ───────────── M02 supervisor acknowledgement
  async ackEvaluation(evaluationId: string, note: string): Promise<Result<{ ack_id: string }>> {
    await this.b.whenReady();
    type R = { ack_id: string };
    const me = this.me;
    const roles = this.b.identity().roles;
    const role = roles.includes('manager') ? 'manager' : roles.includes('training_manager') ? 'training_manager' : null;
    if (!me) return this.refuse<R>('evaluation.ack', 'evaluations', evaluationId, 'not_signed_in', 'Sign in to acknowledge evaluations');
    if (!role) return this.refuse<R>('evaluation.ack', 'evaluations', evaluationId, 'forbidden', 'Only a supervisor (line manager or training manager) may acknowledge an evaluation');
    const ev = this.b.rawGet('evaluations', evaluationId);
    if (!ev || !(this.ctx.inScope('qual_records', ev.person_id) || ev.person_id === me)) return this.refuse<R>('evaluation.ack', 'evaluations', evaluationId, 'not_found', 'Evaluation not found', role);
    if (ev.person_id === me) return this.refuse<R>('evaluation.ack', 'evaluations', ev.id, 'self_sign', 'You cannot acknowledge an evaluation of your own qualification', role);
    if (ev.evaluator_person_id === me) return this.refuse<R>('evaluation.ack', 'evaluations', ev.id, 'separation_of_duties', 'The evaluator cannot also give the supervisor acknowledgement', role);
    if (ev.result === 'pending') return this.refuse<R>('evaluation.ack', 'evaluations', ev.id, 'invalid', 'Only a signed evaluation can be acknowledged', role);
    if (ev.supervisor_ack_at || this.b.raw('evaluation_acks').some((a) => a.evaluation_id === ev.id)) return this.refuse<R>('evaluation.ack', 'evaluations', ev.id, 'conflict', 'This evaluation is already acknowledged', role);
    const id = newId('ack');
    this.b.rawInsert('evaluation_acks', { id, evaluation_id: ev.id, record_id: ev.record_id, person_id: ev.person_id, ack_by_person_id: me, ack_role: role === 'manager' ? 'Line manager / shift supervisor' : 'Training manager', note: note || null });
    return this.done<R>('evaluation.ack', 'evaluation_acks', id, `ack ${ev.id} (${ev.result})`, role, 'kafaa.qualification.ack', `Supervisor acknowledged evaluation ${ev.id} on ${ev.record_id}`, 'Acknowledgement recorded', { ack_id: id }, ['evaluation_acks']);
  }

  // ───────────── M02 expiry sweep (notices 90/60/30 by default; person and manager)
  async qualExpirySweep(): Promise<Result<{ notices: number; due: number; expired: number }>> {
    await this.b.whenReady();
    type R = { notices: number; due: number; expired: number };
    const role = this.ctx.actingRole('qual_records', ['Scope']);
    if (!role) return this.refuse<R>('qualification.expiry_sweep', 'qual_records', null, 'forbidden', 'Only a manager, instructor or coordinator with a scope may run the expiry sweep');
    const today = todayIso();
    let notices = 0, due = 0, expired = 0;
    for (const r of this.b.raw('qual_records')) {
      if (!r.expires_on || !['qualified', 'due', 'renewed'].includes(r.status)) continue;
      if (!this.ctx.inScope('qual_records', r.person_id)) continue;
      const d = daysBetween(today, r.expires_on);
      const std = this.b.rawGet('qual_standards', r.standard_id);
      const code = std?.code ?? r.standard_id;
      if (d < 0) {
        this.b.rawUpdate('qual_records', r.id, { status: 'expired' });
        expired++;
        continue;
      }
      if (d <= 30 && r.status !== 'due') {
        this.b.rawUpdate('qual_records', r.id, { status: 'due' });
        due++;
      }
      const rule = this.b.raw('requal_rules').find((x) => x.standard_id === r.standard_id);
      const days = ((Array.isArray(rule?.notice_days) && (rule!.notice_days as number[]).length ? rule!.notice_days : RULES.expiryNoticeDays) as number[]).map(Number).sort((a, b) => a - b);
      const n = days.find((x) => d <= x);
      if (n == null) continue;
      const sev = n <= 30 ? 'warn' : 'info';
      const person = this.b.rawGet('people', r.person_id);
      if (this.notify(`nt-qx-${r.id}-${n}-${r.person_id}`, r.person_id, 'expiry', `${code} expires in ${d} days (${r.expires_on})`, `ينتهي ${code} خلال ${d} يوماً (${r.expires_on})`, '/my/quals', sev)) notices++;
      if (person?.manager_id && this.notify(`nt-qx-${r.id}-${n}-${person.manager_id}`, person.manager_id, 'expiry', `Team: ${code} expires in ${d} days for ${person.initials || 'a team member'}`, `الفريق: ينتهي ${code} خلال ${d} يوماً لأحد أعضاء الفريق`, '/team/quals', sev)) notices++;
    }
    return this.done<R>('qualification.expiry_sweep', 'qual_records', null, `${notices} notices, ${due} due, ${expired} expired`, role, null, '', `${notices} notices sent`, { notices, due, expired }, ['qual_records', 'notifications']);
  }

  // ───────────── M02 change impact: review a record flagged by a standard revision
  async reviewQualRecord(recordId: string, decision: 'carry_over' | 'retrain', note: string): Promise<Result<{ record_status: string; standard_id: string }>> {
    await this.b.whenReady();
    type R = { record_status: string; standard_id: string };
    const role = this.ctx.actingRole('frameworks', ['W', 'A']);
    if (!role) return this.refuse<R>('qualification.review', 'qual_records', recordId, 'forbidden', 'Only a framework owner (instructor or training manager) may review flagged records');
    const rec = this.b.rawGet('qual_records', recordId);
    if (!rec || !this.ctx.inScope('qual_records', rec.person_id)) return this.refuse<R>('qualification.review', 'qual_records', recordId, 'not_found', 'Qualification record not found', role);
    if (!['carry_over', 'retrain'].includes(decision)) return this.refuse<R>('qualification.review', 'qual_records', recordId, 'invalid', 'Decision must be carry_over or retrain', role);
    if (!rec.needs_review) return this.refuse<R>('qualification.review', 'qual_records', recordId, 'invalid', 'This record is not flagged for review', role);
    if (!note || !note.trim()) return this.refuse<R>('qualification.review', 'qual_records', recordId, 'invalid', 'A review note is required', role);
    const old = this.b.rawGet('qual_standards', rec.standard_id);
    const cur = this.b.raw('qual_standards').filter((s) => s.code === old?.code && s.status === 'current').sort((a, b) => b.version - a.version)[0] ?? old;
    if (!cur) return this.refuse<R>('qualification.review', 'qual_standards', rec.standard_id, 'not_found', 'Current standard not found', role);
    const status = decision === 'retrain' ? 'in_progress' : rec.status;
    this.b.rawUpdate('qual_records', rec.id, { standard_id: cur.id, standard_version: cur.version, needs_review: false, review_reason: decision === 'retrain' ? `Retraining required: ${note}` : null, status: status as never });
    return this.done<R>('qualification.review', 'qual_records', rec.id, `${decision} to ${cur.id}: ${note}`, role, 'kafaa.qualification.review', `${rec.id} ${decision} to ${cur.code} v${cur.version}`, decision === 'retrain' ? 'Retraining required; record moved to the new version' : 'Record carried over to the new version', { record_status: status, standard_id: cur.id }, ['qual_records']);
  }

  // ───────────── M03 alerts
  async licensingAlerts(): Promise<Result<{ renewal: number; proficiency: number; exam_notice: number; withdrawal: number; medical_notices: number }>> {
    await this.b.whenReady();
    type R = { renewal: number; proficiency: number; exam_notice: number; withdrawal: number; medical_notices: number };
    const role = this.ctx.actingRole('licence', ['W']);
    if (!role) return this.refuse<R>('licence.alerts', 'licensing_tasks', null, 'forbidden', 'Only the licensing coordinator may raise licensing alerts');
    const today = todayIso();
    const out: R = { renewal: 0, proficiency: 0, exam_notice: 0, withdrawal: 0, medical_notices: 0 };
    const hasOpen = (person: string | null, kind: string) => this.b.raw('licensing_tasks').some((t) => t.person_id === person && t.kind === kind && t.status === 'open');
    const task = (id: string, kind: RowOf<'licensing_tasks'>['kind'], person_id: string | null, due_at: string, title_en: string, title_ar: string, rule_ref: string) => {
      if (this.b.rawGet('licensing_tasks', id)) return false;
      this.b.rawInsert('licensing_tasks', { id, kind, person_id, due_at, title_en, title_ar, rule_ref });
      return true;
    };
    const minDue = addWorkingDays(today, 5);
    const q = quarterOf(today);
    for (const l of this.b.raw('licences')) {
      if (l.status === 'valid' && l.expires_on >= today && l.expires_on <= addMonths(today, RULES.licenceRenewalTaskMonths) && !hasOpen(l.person_id, 'renewal')) {
        const due = addDays(l.expires_on, -90) < minDue ? minDue : addDays(l.expires_on, -90);
        if (task(`lt-rn-${l.id}-${l.expires_on}`, 'renewal', l.person_id, due, `Certificate renewal: start renewal tasks (expires ${l.expires_on})`, `تجديد الشهادة: بدء مهام التجديد (تنتهي ${l.expires_on})`, 'FANR-REG-17 Art. 8')) out.renewal++;
      }
      if (l.status === 'valid') {
        const sp = this.b.raw('shift_proficiency').find((s) => s.person_id === l.person_id && s.quarter === q);
        if (sp) {
          const p = proficiency(sp, l.type !== 'RO');
          if ((p.atRisk || p.sroAtRisk) && !hasOpen(l.person_id, 'proficiency_risk')) {
            const sro = !!p.sroAtRisk;
            if (task(`lt-pr-${l.person_id}-${q}`, 'proficiency_risk', l.person_id, quarterEnd(q), sro ? 'SRO-role shift minimum at risk this quarter' : 'Quarterly shift minimum at risk', sro ? 'الحد الأدنى لنوبات دور المشغّل الأول معرّض للخطر هذا الربع' : 'الحد الأدنى للنوبات ربع السنوية معرّض للخطر', 'FANR-REG-17 Art. 11')) {
              out.proficiency++;
              this.notify(`nt-pr-${l.person_id}-${q}`, l.person_id, 'licence', sro ? `${q}: SRO-role shift minimum at risk` : `${q}: quarterly shift minimum at risk`, sro ? `${q}: الحد الأدنى لنوبات دور المشغّل الأول معرّض للخطر` : `${q}: الحد الأدنى للنوبات معرّض للخطر`, '/my/licence', 'warn');
            }
          }
        }
      }
      if (l.status === 'lapsed' && l.lapsed_on) {
        const wd = withdrawalDate(l.lapsed_on);
        if (task(`lt-wd-${l.id}-${l.lapsed_on}`, 'withdrawal_risk', l.person_id, addMonths(l.lapsed_on, 12), `Validity lapsed on ${l.lapsed_on}: FANR withdraws the certificate on ${wd} unless validity is restored`, `انقضت الصلاحية في ${l.lapsed_on}: تسحب الهيئة الشهادة في ${wd} ما لم تُستعَد الصلاحية`, 'FANR-REG-17 (withdrawal after 2 years of non-validity)')) {
          out.withdrawal++;
          this.notify(`nt-wd-${l.id}-${l.lapsed_on}`, l.person_id, 'licence', `Your certificate validity lapsed on ${l.lapsed_on}; the licensing coordinator will contact you`, `انقضت صلاحية شهادتك في ${l.lapsed_on}؛ سيتواصل معك منسّق الترخيص`, '/my/licence', 'bad');
        }
      }
    }
    for (const m of this.b.raw('exam_milestones')) {
      if (m.kind !== 'fanr_written' || m.status !== 'planned') continue;
      if (today < addDays(m.due_on, -RULES.fanrExamReminderDays) || today >= m.due_on) continue;
      const prog = m.programme_id ? this.b.rawGet('licence_programmes', m.programme_id) : null;
      const name = prog?.name_en ?? m.programme_id ?? 'programme';
      if (task(`lt-xn-${m.id}`, 'exam_notice', null, addDays(m.due_on, -RULES.fanrExamNoticeDays), `Send the 60-day FANR exam notice for ${name} (exam ${m.due_on})`, `إرسال إخطار الهيئة قبل 60 يوماً لـ${prog?.name_ar ?? name} (الاختبار ${m.due_on})`, 'FANR-REG-17 Art. 7')) out.exam_notice++;
    }
    for (const m of this.b.raw('medical_due')) {
      const d = daysBetween(today, m.due_on);
      if (d < 0 || d > 30) continue;
      if (this.notify(`nt-md-${m.person_id}-${m.due_on}`, m.person_id, 'licence', `Annual medical due by ${m.due_on}`, `الفحص الطبي السنوي مستحق بحلول ${m.due_on}`, '/my/licence', 'info')) out.medical_notices++;
    }
    const n = out.renewal + out.proficiency + out.exam_notice + out.withdrawal;
    return this.done<R>('licence.alerts', 'licensing_tasks', null, `${out.renewal} renewal, ${out.proficiency} proficiency, ${out.exam_notice} exam notice, ${out.withdrawal} withdrawal, ${out.medical_notices} medical notices`, role, null, '', `${n} tasks raised`, out, ['licensing_tasks', 'notifications']);
  }

  async closeLicensingTask(taskId: string, note: string): Promise<Result> {
    await this.b.whenReady();
    const role = this.ctx.actingRole('licence', ['W']);
    if (!role) return this.refuse('licence.task_close', 'licensing_tasks', taskId, 'forbidden', 'Only the licensing coordinator may close licensing tasks');
    const t = this.b.rawGet('licensing_tasks', taskId);
    if (!t) return this.refuse('licence.task_close', 'licensing_tasks', taskId, 'not_found', 'Task not found', role);
    if (t.status !== 'open') return this.refuse('licence.task_close', 'licensing_tasks', taskId, 'invalid', 'Task is already closed', role);
    if (!note || note.trim().length < 5) return this.refuse('licence.task_close', 'licensing_tasks', taskId, 'invalid', 'Record what was done (at least 5 characters)', role);
    this.b.rawUpdate('licensing_tasks', taskId, { status: 'done' });
    return this.done('licence.task_close', 'licensing_tasks', taskId, `${t.kind}: ${note}`, role, 'kafaa.licence.task_close', `${t.kind} task ${taskId} closed: ${note}`, 'Task closed', undefined, ['licensing_tasks']);
  }

  async recordMedicalDate(personId: string, dueOn: string, flag: 'fit' | 'not_confirmed', sourceRef: string): Promise<Result<{ closed: number }>> {
    await this.b.whenReady();
    type R = { closed: number };
    const role = this.ctx.actingRole('licence', ['W']);
    if (!role || !this.ctx.has('medical_flag', ['Scope'])) return this.refuse<R>('licence.medical_date', 'medical_due', personId, 'forbidden', 'Only the licensing coordinator may mirror a medical due date');
    if (!this.b.rawGet('people', personId)) return this.refuse<R>('licence.medical_date', 'medical_due', personId, 'not_found', 'Person not found', role);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueOn || '') || dueOn < todayIso()) return this.refuse<R>('licence.medical_date', 'medical_due', personId, 'invalid', 'The new due date must be today or later', role);
    if (!['fit', 'not_confirmed'].includes(flag)) return this.refuse<R>('licence.medical_date', 'medical_due', personId, 'invalid', 'Flag must be fit or not_confirmed', role);
    if (!sourceRef || sourceRef.trim().length < 3) return this.refuse<R>('licence.medical_date', 'medical_due', personId, 'invalid', 'A source record reference is required', role);
    const cur = this.b.raw('medical_due').find((m) => m.person_id === personId);
    const now = new Date().toISOString();
    if (cur) this.b.rawUpdate('medical_due', cur.id, { due_on: dueOn, flag, last_synced: now });
    else this.b.rawInsert('medical_due', { id: `med-${personId}`, person_id: personId, due_on: dueOn, flag, last_synced: now });
    let closed = 0;
    for (const t of this.b.raw('licensing_tasks').filter((x) => x.person_id === personId && x.kind === 'medical_overdue' && x.status === 'open')) {
      this.b.rawUpdate('licensing_tasks', t.id, { status: 'done' });
      closed++;
    }
    return this.done<R>('licence.medical_date', 'medical_due', personId, `due date and flag mirrored from ${sourceRef}; ${closed} task(s) closed`, role, null, '', 'Medical due date recorded', { closed }, ['medical_due', 'licensing_tasks']);
  }

  async crewAvailability(): Promise<{ person_id: string; available: boolean | null }[]> {
    await this.b.whenReady();
    if (!this.ctx.has('licence', ['Scope', 'R', 'W', 'Own'])) throw new Error("Kafa'a · crew availability is restricted");
    const today = todayIso();
    const out: { person_id: string; available: boolean | null }[] = [];
    for (const l of this.b.raw('licences')) {
      if (!this.ctx.canReadRow('licences', l as never)) continue;
      const stale = (Date.now() - toDate(l.last_synced).getTime()) / 3_600_000 > RULES.staleSyncHours;
      const med = this.b.raw('medical_due').find((m) => m.person_id === l.person_id);
      out.push({ person_id: l.person_id, available: stale ? null : l.status === 'valid' && l.expires_on >= today && !!med && med.due_on >= today });
    }
    return out;
  }
}
