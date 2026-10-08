/**
 * LocalRpc: 1:1 mirror of supabase/migrations/20261008120400_kafaa_rpcs.sql for the LocalBackend.
 * Same checks, same refusal codes, same audit rows (success and refusal) and the same ledger behaviour
 * (NEXUS personas append to the local ledger mirror; Kafa'a-only personas are "skipped").
 * Change both files together.
 */
import type { LocalBackend } from './LocalBackend';
import type { AggregateRow, CertificateCheck, Result, Rpc, SignoffInput, RowOf, ObserverReportDraft, ScenarioInput, ResearchChallengeInput, ResearchProposalInput } from '../types';
import type { PlatformRole } from '../../auth/policy';
import { MIN_GROUP_SIZE } from '../../auth/policy';
import { addWorkingDays, isoDate, todayIso, bookingPriority, scoreJpm } from '../../domain/rules';
import { canonical, chainHash, GENESIS } from '../audit';
import { newId } from './store';
import { G1LocalRpc } from './rpc.g1';
import { makeG2LocalRpc } from './rpc_g2';
import type { G2Rpc } from '../rpc_g2';
import { G4LocalRpc } from './rpc.g4'; // [G4]
import { DOC_CHECKLIST, equivalencyCoverage, readinessState } from '../../domain/partners'; // [G4]

// [G3] shared with the SQL mirror: answers that must never be collected at application time, retention and IP route
export const G3_FORBIDDEN_ANSWER_KEYS = ['emirates_id', 'emiratesid', 'eid', 'passport', 'passport_no', 'dob', 'date_of_birth', 'birth_date'];
export const G3_RETENTION_MONTHS = 6;
export const G3_DEFAULT_IP_ROUTE = 'MoET patents route (May 2026 MoU)';
const ELEVATED: PlatformRole[] = ['admin', 'auditor', 'hr_director', 'licensing_coord', 'training_manager', 'ecp_officer', 'instructor', 'hr_analyst'];
const addMonths = (d: string, m: number) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCMonth(x.getUTCMonth() + m);
  return isoDate(x);
};

// G2 (2026-10-08): the M04/M05 RPCs are implemented in ./rpc_g2.ts and installed on every LocalRpc instance.
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface LocalRpc extends G2Rpc {}
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class LocalRpc implements Rpc {
  constructor(private readonly b: LocalBackend) {
    this.g1 = new G1LocalRpc(b);
    Object.assign(this, makeG2LocalRpc(b));
    this.g4 = new G4LocalRpc(b, (...a) => this.refuse(...a), (...a) => this.done(...a));
  }
  private readonly g1: G1LocalRpc;
  /** [G4] M09/M11 RPCs live in rpc.g4.ts and share refuse/done with this class. */
  private readonly g4: G4LocalRpc;
  invitePartner: Rpc['invitePartner'] = (...a) => this.g4.invitePartner(...a);
  partnerOnboardingAction: Rpc['partnerOnboardingAction'] = (...a) => this.g4.partnerOnboardingAction(...a);
  uploadSupplierDocument: Rpc['uploadSupplierDocument'] = (...a) => this.g4.uploadSupplierDocument(...a);
  reviewSupplierDocument: Rpc['reviewSupplierDocument'] = (...a) => this.g4.reviewSupplierDocument(...a);
  saveIcvPlan: Rpc['saveIcvPlan'] = (...a) => this.g4.saveIcvPlan(...a);
  reviewIcvPlan: Rpc['reviewIcvPlan'] = (...a) => this.g4.reviewIcvPlan(...a);
  submitEquivalency: Rpc['submitEquivalency'] = (...a) => this.g4.submitEquivalency(...a);
  mapEquivalency: Rpc['mapEquivalency'] = (...a) => this.g4.mapEquivalency(...a);
  enrolSupplierCourse: Rpc['enrolSupplierCourse'] = (...a) => this.g4.enrolSupplierCourse(...a);
  completeSupplierCourse: Rpc['completeSupplierCourse'] = (...a) => this.g4.completeSupplierCourse(...a);
  saveSkillGapPlan: Rpc['saveSkillGapPlan'] = (...a) => this.g4.saveSkillGapPlan(...a);

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
  private async done<T>(action: string, table: string, entity: string | null, reason: string | null, role: string | null, ledgerAction: string | null, ledgerReason: string, message: string, data?: T, tables: string[] = [table]): Promise<Result<T>> {
    const l = ledgerAction ? await this.b.ledger(ledgerAction, ledgerReason) : null;
    const a = await this.b.audit(action, table, entity, 'ok', reason, ledgerAction ? (l == null ? 'skipped' : 'written') : 'not_applicable', l, role);
    this.b.changed(tables as never);
    return { ok: true, code: 'ok', message, data, audit_seq: a.seq as number, ledger_seq: l };
  }

  // ───────────── M02 sign-off
  async signoffEvaluation(p: SignoffInput): ReturnType<Rpc['signoffEvaluation']> {
    await this.b.whenReady();
    const me = this.me;
    const role = this.ctx.actingRole('signoff', ['A']);
    if (!me) return this.refuse('evaluation.signoff', 'qual_records', p.record_id, 'not_signed_in', 'Sign in to sign off evaluations');
    if (!role) return this.refuse('evaluation.signoff', 'qual_records', p.record_id, 'forbidden', 'Only a qualified evaluator may sign off');
    const rec = this.b.rawGet('qual_records', p.record_id);
    if (!rec || !(this.ctx.inScope('qual_records', rec.person_id) || rec.person_id === me)) return this.refuse('evaluation.signoff', 'qual_records', p.record_id, 'not_found', 'Qualification record not found', role);
    if (rec.person_id === me) return this.refuse('evaluation.signoff', 'qual_records', rec.id, 'self_sign', 'An evaluator cannot sign off their own qualification', role);
    const today = todayIso();
    if (!this.b.raw('evaluator_quals').some((q) => q.person_id === me && q.standard_id === rec.standard_id && q.valid_to >= today))
      return this.refuse('evaluation.signoff', 'qual_records', rec.id, 'not_evaluator', 'You do not hold the evaluator qualification for this standard', role);
    const std = this.b.rawGet('qual_standards', rec.standard_id)!;
    let task: RowOf<'task_items'> | undefined;
    if (p.task_id) {
      task = this.b.raw('task_items').find((t) => t.id === p.task_id && t.standard_id === rec.standard_id);
      if (!task) return this.refuse('evaluation.signoff', 'task_items', p.task_id, 'not_found', 'Task not on this standard', role);
    }
    let result = p.result ?? 'pass';
    if (p.critical_failed) result = 'fail';
    if (!['pass', 'fail'].includes(result)) return this.refuse('evaluation.signoff', 'qual_records', rec.id, 'invalid', 'Result must be pass or fail', role);
    if (p.correction_of && !p.correction_reason) return this.refuse('evaluation.signoff', 'evaluations', p.correction_of, 'invalid', 'A correction needs a reason', role);
    const date = p.date ?? today;
    const evId = newId('ev');
    this.b.rawInsert('evaluations', {
      id: evId, record_id: rec.id, task_id: task?.id ?? null, person_id: rec.person_id, method: (p.method ?? task?.method ?? 'ojt') as never, evaluator_person_id: me,
      evaluator_role: task?.evaluator_role ?? 'Instructor / evaluator', result, date, critical_failed: !!p.critical_failed, correction_of: p.correction_of ?? null, correction_reason: p.correction_reason ?? null,
    });
    const evals = this.b.raw('evaluations').filter((e) => e.record_id === rec.id);
    const corrected = new Set(evals.map((e) => e.correction_of).filter(Boolean));
    const missing = this.b.raw('task_items').filter((t) => t.standard_id === rec.standard_id && !evals.some((e) => e.task_id === t.id && e.result === 'pass' && !corrected.has(e.id))).length;
    let status = rec.status;
    if (missing === 0 && result === 'pass') {
      status = 'qualified';
      this.b.rawUpdate('qual_records', rec.id, { status: 'qualified', qualified_on: date, expires_on: std.requal_months ? addMonths(date, std.requal_months) : null, needs_review: false, review_reason: null, last_synced: new Date().toISOString() });
    } else if (rec.status === 'planned') {
      status = 'in_progress';
      this.b.rawUpdate('qual_records', rec.id, { status: 'in_progress' });
    }
    return this.done('evaluation.signoff', 'evaluations', evId, `${task?.code ?? rec.standard_id} ${result}; record now ${status}`, role, 'kafaa.qualification.signoff',
      `Evaluation ${evId} on ${rec.standard_id} (${task?.code ?? 'record'}): ${result}`, 'Evaluation recorded', { evaluation_id: evId, record_status: status }, ['evaluations', 'qual_records']);
  }

  // ───────────── M03 licence status
  async setLicenceStatus(licenceId: string, status: string, reason: string) {
    await this.b.whenReady();
    const role = this.ctx.actingRole('licence', ['W']);
    if (!role) return this.refuse<{ due?: string }>('licence.status', 'licences', licenceId, 'forbidden', 'Only the licensing coordinator may change a mirrored licence status');
    if (!['valid', 'lapsed', 'suspended', 'withdrawn', 'pending'].includes(status)) return this.refuse<{ due?: string }>('licence.status', 'licences', licenceId, 'invalid', 'Unknown status', role);
    if (!reason) return this.refuse<{ due?: string }>('licence.status', 'licences', licenceId, 'invalid', 'A reason (source record reference) is required', role);
    const lic = this.b.rawGet('licences', licenceId);
    if (!lic) return this.refuse<{ due?: string }>('licence.status', 'licences', licenceId, 'not_found', 'Licence not found', role);
    const prev = lic.status;
    const today = todayIso();
    this.b.rawUpdate('licences', lic.id, { status: status as never, lapsed_on: status === 'lapsed' ? today : lic.lapsed_on, last_synced: new Date().toISOString() });
    let due: string | undefined;
    if (status === 'lapsed') {
      due = addWorkingDays(today, 3);
      const tid = newId('lt');
      this.b.rawInsert('licensing_tasks', { id: tid, kind: 'lapse_report', person_id: lic.person_id, due_at: due, title_en: 'Report validity lapse within 3 working days', title_ar: 'الإبلاغ عن انقضاء الصلاحية خلال 3 أيام عمل', rule_ref: 'FANR-REG-17 Art. 13' });
      this.b.rawInsert('reporting_obligations', { id: `ro-${tid}`, kind: 'lapse_report', title_en: 'Validity lapse report (draft for the named role to send)', title_ar: 'تقرير انقضاء الصلاحية (مسودة)', due_on: due, owner_role: 'Licensing coordinator', person_id: lic.person_id, rule_ref: 'FANR-REG-17 Art. 13' });
    }
    return this.done('licence.status', 'licences', lic.id, `${prev} -> ${status}: ${reason}`, role, 'kafaa.licence.status', `${lic.type} ${lic.cert_no} -> ${status} (${reason})`, 'Licence status recorded', { due }, ['licences', 'licensing_tasks', 'reporting_obligations']);
  }

  async detectLicensingEvents() {
    await this.b.whenReady();
    const role = this.ctx.actingRole('licence', ['W']);
    if (!role) return this.refuse<{ lapses: number; medical: number }>('licence.sweep', 'licences', null, 'forbidden', 'Only the licensing coordinator may run the sweep');
    const today = todayIso();
    let lapses = 0;
    let medical = 0;
    for (const l of this.b.raw('licences').filter((x) => x.status === 'valid' && x.expires_on < today)) {
      await this.setLicenceStatus(l.id, 'lapsed', 'Detected by sweep: expiry date passed');
      lapses++;
    }
    // [G1 fix] a past due date with no new date is overdue whatever the last flag said (M03 acceptance)
    for (const m of this.b.raw('medical_due').filter((x) => x.due_on < today)) {
      if (this.b.raw('licensing_tasks').some((t) => t.person_id === m.person_id && t.kind === 'medical_overdue' && t.status === 'open')) continue;
      this.b.rawInsert('licensing_tasks', { id: newId('lt'), kind: 'medical_overdue', person_id: m.person_id, due_at: addWorkingDays(today, 5), title_en: 'Medical overdue: confirm new date', title_ar: 'فحص طبي متأخر: تأكيد موعد جديد', rule_ref: 'FANR-REG-17 Art. 10' });
      medical++;
    }
    return this.done('licence.sweep', 'licences', null, `${lapses} lapses, ${medical} medical tasks`, role, null, '', 'Sweep complete', { lapses, medical }, ['licences', 'licensing_tasks']);
  }

  // ───────────── M09 partner onboarding
  async decidePartnerOnboarding(id: string, decision: 'approved' | 'returned' | 'handed_off', note: string) {
    await this.b.whenReady();
    const role = this.ctx.actingRole('partner_org', ['A']);
    if (!role) return this.refuse('partner.decide', 'partner_onboarding', id, 'forbidden', 'Only a platform admin may decide partner onboarding');
    if (!['approved', 'returned', 'handed_off'].includes(decision)) return this.refuse('partner.decide', 'partner_onboarding', id, 'invalid', 'Decision must be approved, returned or handed_off', role);
    const o = this.b.rawGet('partner_onboarding', id);
    if (!o) return this.refuse('partner.decide', 'partner_onboarding', id, 'not_found', 'Onboarding case not found', role);
    if (o.org_id === this.b.identity().orgId) return this.refuse('partner.decide', 'partner_onboarding', id, 'conflict', "You cannot decide your own organisation's case", role);
    if (decision === 'handed_off' && o.status !== 'approved') return this.refuse('partner.decide', 'partner_onboarding', id, 'invalid', 'Only an approved case can be handed off', role);
    if (decision !== 'handed_off' && !['submitted', 'in_progress'].includes(o.status)) return this.refuse('partner.decide', 'partner_onboarding', id, 'invalid', 'Case is not awaiting a decision', role);
    // [G4] a return needs a note the supplier can act on; a supplier approval needs every required document accepted
    if (decision === 'returned' && String(note ?? '').trim().length < 5) return this.refuse('partner.decide', 'partner_onboarding', id, 'invalid', 'Returning a case needs a note the supplier can act on', role);
    if (decision === 'approved' && o.kind === 'supplier') {
      const open = DOC_CHECKLIST.filter((k) => k.required && !this.b.raw('supplier_documents').some((d) => d.org_id === o.org_id && d.doc_key === k.key && d.status === 'accepted')).length;
      if (open > 0 || !readinessState(this.b.raw('supplier_readiness').filter((s) => s.org_id === o.org_id), this.b.raw('supplier_documents').filter((d) => d.org_id === o.org_id), this.b.raw('icv_plans').find((p) => p.org_id === o.org_id)).ready)
        return this.refuse('partner.decide', 'partner_onboarding', id, 'invalid', `Review the evidence first: ${open} required document(s) not accepted, or the readiness path is incomplete`, role);
    }
    const history = [...(Array.isArray(o.history) ? o.history : []), { at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), action: decision, status: decision, by_role: role, note: note || null }];
    this.b.rawUpdate('partner_onboarding', id, { status: decision, decided_at: new Date().toISOString(), decided_by: this.me, decision_note: note, nexus_handoff_ref: decision === 'handed_off' ? '/partner/readiness' : o.nexus_handoff_ref, history: history as never });
    if (decision === 'handed_off') for (const s of this.b.raw('supplier_readiness').filter((x) => x.org_id === o.org_id && x.step_key === 'handoff')) this.b.rawUpdate('supplier_readiness', s.id, { status: 'done', evidence: 'NEXUS /partner/readiness', updated_at: new Date().toISOString() });
    return this.done('partner.decide', 'partner_onboarding', id, `${decision}${note ? `: ${note}` : ''}`, role, `kafaa.partner.${decision}`, `Partner onboarding ${id} (${o.org_id}): ${note ?? ''}`, 'Decision recorded', undefined, ['partner_onboarding', 'supplier_readiness']);
  }

  // ───────────── M06 application decision (mirrored from HR)
  async decideApplication(id: string, stage: string, note: string) {
    await this.b.whenReady();
    const role = this.ctx.actingRole('applications', ['A']);
    if (!role) return this.refuse('application.decide', 'applications', id, 'forbidden', 'Only the HR authority may record an application decision');
    if (!['screening', 'assessment', 'interview', 'offer', 'accepted', 'unsuccessful'].includes(stage)) return this.refuse('application.decide', 'applications', id, 'invalid', 'Unknown stage', role);
    const ap = this.b.rawGet('applications', id);
    if (!ap) return this.refuse('application.decide', 'applications', id, 'not_found', 'Application not found', role);
    if (['withdrawn', 'unsuccessful', 'accepted'].includes(ap.stage)) return this.refuse('application.decide', 'applications', id, 'invalid', 'Application is closed', role);
    const decision = ['offer', 'accepted'].includes(stage) ? 'offer' : stage === 'unsuccessful' ? 'unsuccessful' : 'none';
    this.b.rawUpdate('applications', id, { stage: stage as never, decision: decision as never, decision_source: 'ENEC HR (mirrored)', updated_at: new Date().toISOString(), delete_after: stage === 'unsuccessful' ? addMonths(todayIso(), 6) : ap.delete_after });
    this.b.rawInsert('application_events', { id: newId('ae'), application_id: id, person_id: ap.person_id, stage, note_en: note ?? '', note_ar: note ?? '', by_role: 'ENEC HR' });
    return this.done('application.decide', 'applications', id, stage, role, 'kafaa.application.decide', `Application ${id} (${ap.programme_id}) -> ${stage} (mirrored from HR)`, 'Stage recorded', undefined, ['applications', 'application_events']);
  }

  // ───────────── M08 ECP referral triage
  async triageConcern(id: string, status: string, priority: string) {
    await this.b.whenReady();
    const role = this.ctx.actingRole('concern_cases', ['A']);
    if (!role) return this.refuse('ecp.triage', 'concern_cases', id, 'forbidden', 'Only the ECP officer may triage referrals');
    if (!['triaged', 'investigating', 'referred', 'closed'].includes(status) || !['routine', 'priority', 'urgent'].includes(priority)) return this.refuse('ecp.triage', 'concern_cases', id, 'invalid', 'Unknown status or priority', role);
    const c = this.b.rawGet('concern_cases', id);
    if (!c) return this.refuse('ecp.triage', 'concern_cases', id, 'not_found', 'Referral not found', role);
    this.b.rawUpdate('concern_cases', id, { status: status as never, priority: priority as never, triage_owner_role: 'ECP officer', triaged_at: c.triaged_at ?? new Date().toISOString() });
    return this.done('ecp.triage', 'concern_cases', id, `${status} / ${priority}`, role, 'kafaa.ecp.triage', 'ECP referral triaged; no case content recorded', 'Triage recorded');
  }

  // ───────────── M09 equivalency
  async decideEquivalency(id: string, status: string, note: string) {
    await this.b.whenReady();
    const role = this.ctx.actingRole('equivalency', ['A']);
    if (!role) return this.refuse('equivalency.decide', 'equivalency_requests', id, 'forbidden', 'Only an ENEC evaluator may decide equivalency');
    if (!['under_review', 'equivalent', 'training_required', 'rejected'].includes(status)) return this.refuse('equivalency.decide', 'equivalency_requests', id, 'invalid', 'Unknown decision', role);
    const r = this.b.rawGet('equivalency_requests', id);
    if (!r) return this.refuse('equivalency.decide', 'equivalency_requests', id, 'not_found', 'Request not found', role);
    const today = todayIso();
    const roles = this.b.identity().roles;
    if (status !== 'under_review' && !roles.includes('training_manager') && !this.b.raw('evaluator_quals').some((q) => q.person_id === this.me && q.standard_id === r.standard_id && q.valid_to >= today))
      return this.refuse('equivalency.decide', 'equivalency_requests', id, 'not_evaluator', 'You do not hold the evaluator qualification for this standard', role);
    if (status !== 'under_review' && !note) return this.refuse('equivalency.decide', 'equivalency_requests', id, 'invalid', 'A decision note is required', role);
    // [G4] decisions are final, and "equivalent" needs every task item covered by mapped evidence (rule M09-R4)
    if (['equivalent', 'training_required', 'rejected'].includes(r.status)) return this.refuse('equivalency.decide', 'equivalency_requests', id, 'invalid', 'The request has already been decided', role);
    if (status === 'equivalent' && !equivalencyCoverage(this.b.raw('task_items').filter((t) => t.standard_id === r.standard_id), r.mapping as never).complete)
      return this.refuse('equivalency.decide', 'equivalency_requests', id, 'invalid', 'Map evidence to every task item before recording an equivalent decision', role);
    const history = [...(Array.isArray(r.history) ? r.history : []), { at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), action: 'decide', status, by_role: role, note: note || null }];
    this.b.rawUpdate('equivalency_requests', id, { status: status as never, decision_note: note, decider_role: 'Instructor / evaluator', decided_by: this.me, decided_at: status === 'under_review' ? null : new Date().toISOString(), history: history as never });
    return this.done('equivalency.decide', 'equivalency_requests', id, status, role, status === 'under_review' ? null : 'kafaa.equivalency.decide', `Equivalency ${id} (${r.org_id}, ${r.standard_id}): ${status}`, 'Decision recorded');
  }
  async getEquivalency(id: string) {
    await this.b.whenReady();
    const r = this.b.rawGet('equivalency_requests', id);
    const c = this.ctx;
    if (!r || !(c.has('equivalency', ['R', 'W', 'A']) || (r.org_id === c.who.orgId && c.has('equivalency', ['OwnOrg', 'OrgW'])))) {
      const a = await this.b.audit('equivalency.read', 'equivalency_requests', id, 'refused', "not_found: record outside the caller's organisation or does not exist");
      return { ok: false, code: 'not_found', message: 'Not found', audit_seq: a.seq as number };
    }
    return { ok: true, code: 'ok', message: 'ok', data: structuredClone(r) };
  }

  // ───────────── M07 observer release
  async observerReportAction(id: string, action: 'submit' | 'approve' | 'withdraw', orgIds: string[] = []) {
    await this.b.whenReady();
    const r = this.b.rawGet('observer_reports', id);
    const me = this.me;
    if (!r) return this.refuse(`observer_report.${action}`, 'observer_reports', id, 'not_found', 'Report not found');
    let role: PlatformRole | null;
    if (action === 'submit') {
      role = this.ctx.actingRole('observer_release', ['W', 'A']);
      if (!role) return this.refuse('observer_report.submit', 'observer_reports', id, 'forbidden', 'Only HR may prepare an observer report');
      if (r.status !== 'draft') return this.refuse('observer_report.submit', 'observer_reports', id, 'invalid', 'Only a draft can be submitted', role);
      this.b.rawUpdate('observer_reports', id, { status: 'pending_approval', prepared_by: me, released_to_org_ids: orgIds });
    } else if (action === 'approve') {
      role = this.ctx.actingRole('observer_release', ['A']);
      if (!role) return this.refuse('observer_report.approve', 'observer_reports', id, 'forbidden', 'Release needs the named HR authority (CHCO office) or an admin');
      if (r.status !== 'pending_approval') return this.refuse('observer_report.approve', 'observer_reports', id, 'invalid', 'Report is not awaiting approval', role);
      if (r.prepared_by === me) return this.refuse('observer_report.approve', 'observer_reports', id, 'maker_checker', 'The preparer cannot approve their own release', role);
      this.b.rawUpdate('observer_reports', id, { status: 'released', approved_by: me, approved_at: new Date().toISOString(), released_to_org_ids: orgIds.length ? orgIds : r.released_to_org_ids });
    } else if (action === 'withdraw') {
      role = this.ctx.actingRole('observer_release', ['A']);
      if (!role) return this.refuse('observer_report.withdraw', 'observer_reports', id, 'forbidden', 'Only an approver may withdraw a release');
      this.b.rawUpdate('observer_reports', id, { status: 'withdrawn' });
    } else return this.refuse(`observer_report.${action}`, 'observer_reports', id, 'invalid', 'Unknown action');
    return this.done(`observer_report.${action}`, 'observer_reports', id, orgIds.join(','), role, action === 'submit' ? null : `kafaa.observer_report.${action}`, `Observer report ${id} ${action}`, 'Recorded');
  }

  // ───────────── M10 research screening
  async screenResearchChallenge(id: string, securityOk: boolean, exportOk: boolean) {
    await this.b.whenReady();
    const role = this.ctx.actingRole('research', ['A']);
    if (!role) return this.refuse('research.screen', 'research_challenges', id, 'forbidden', 'Only a screening authority may sign off');
    const c = this.b.rawGet('research_challenges', id);
    if (!c) return this.refuse('research.screen', 'research_challenges', id, 'not_found', 'Challenge not found', role);
    const pub = !!securityOk && !!exportOk;
    this.b.rawUpdate('research_challenges', id, { security_ok: !!securityOk, export_control_ok: !!exportOk, screening_signed_by: this.me, screening_signed_at: new Date().toISOString(), status: pub ? 'published' : 'screening', is_published: pub });
    return this.done('research.screen', 'research_challenges', id, `security=${securityOk} export=${exportOk} published=${pub}`, role, null, '', pub ? 'Screening signed; challenge published' : 'Screening recorded; not published');
  }

  // ───────────── M13 kill switch
  async setDalilEnabled(enabled: boolean) {
    await this.b.whenReady();
    const role = this.ctx.actingRole('dalil_config', ['A']);
    if (!role) return this.refuse('dalil.kill_switch', 'dalil_settings', 'global', 'forbidden', 'Only the AI owner (admin) may switch Dalil');
    this.b.rawUpdate('dalil_settings', 'global', { enabled, updated_at: new Date().toISOString(), updated_by: this.me });
    return this.done('dalil.kill_switch', 'dalil_settings', 'global', enabled ? 'enabled' : 'disabled', role, `kafaa.dalil.${enabled ? 'enable' : 'disable'}`, 'Dalil kill switch', `Dalil ${enabled ? 'enabled' : 'disabled'}`);
  }

  // ───────────── M02 standard revision
  async reviseStandard(id: string, reason: string) {
    await this.b.whenReady();
    const role = this.ctx.actingRole('frameworks', ['W', 'A']);
    if (!role) return this.refuse<{ new_id: string; flagged: number }>('standard.revise', 'qual_standards', id, 'forbidden', 'Only a framework owner may revise a standard');
    if (!reason) return this.refuse<{ new_id: string; flagged: number }>('standard.revise', 'qual_standards', id, 'invalid', 'A change reason is required', role);
    const s = this.b.raw('qual_standards').find((x) => x.id === id && x.status === 'current');
    if (!s) return this.refuse<{ new_id: string; flagged: number }>('standard.revise', 'qual_standards', id, 'not_found', 'Current standard not found', role);
    const newIdv = `${s.id.replace(/-v\d+$/, '')}-v${s.version + 1}`;
    this.b.rawInsert('qual_standards', { ...s, id: newIdv, version: s.version + 1, status: 'current', effective_date: todayIso(), supersedes_id: s.id, change_reason: reason });
    for (const t of this.b.raw('task_items').filter((x) => x.standard_id === s.id)) this.b.rawInsert('task_items', { ...t, id: `${t.id}-v${s.version + 1}`, standard_id: newIdv });
    this.b.rawUpdate('qual_standards', s.id, { status: 'superseded' });
    let flagged = 0;
    for (const r of this.b.raw('qual_records').filter((x) => x.standard_id === s.id && ['qualified', 'due', 'in_progress'].includes(x.status))) {
      this.b.rawUpdate('qual_records', r.id, { needs_review: true, review_reason: `Standard revised to v${s.version + 1}: ${reason}` });
      flagged++;
    }
    return this.done('standard.revise', 'qual_standards', newIdv, `${flagged} records flagged: ${reason}`, role, 'kafaa.standard.revise', `${s.code} v${s.version} -> v${s.version + 1}; ${flagged} records flagged`, 'New version created', { new_id: newIdv, flagged }, ['qual_standards', 'task_items', 'qual_records']);
  }

  // ───────────── M14 roles
  async grantRole(personId: string, role: PlatformRole, scopeType: string, scopeValue: string | null) {
    await this.b.whenReady();
    const c = this.ctx;
    const tgt = this.b.rawGet('people', personId);
    if (!tgt) return this.refuse<{ id: string; status: string }>('role.grant', 'role_assignments', personId, 'not_found', 'Person not found');
    let acting: string;
    let status: 'active' | 'pending_second' = 'active';
    if (c.has('users_roles', ['W'])) {
      acting = 'admin';
      if (ELEVATED.includes(role)) status = 'pending_second';
    } else if (c.has('users_roles', ['OrgW']) && tgt.org_id === c.who.orgId && role === 'partner_user') acting = 'partner_admin';
    else return this.refuse<{ id: string; status: string }>('role.grant', 'role_assignments', personId, 'forbidden', 'You cannot grant this role');
    if (role === 'public') return this.refuse<{ id: string; status: string }>('role.grant', 'role_assignments', personId, 'invalid', 'Unknown role', acting);
    const id = newId('ra');
    this.b.rawInsert('role_assignments', { id, person_id: personId, role, org_id: tgt.org_id ?? null, scope_type: (scopeType || 'self') as never, scope_value: scopeValue, granted_by: this.me, status });
    return this.done('role.grant', 'role_assignments', id, `${role} ${scopeType || 'self'} ${status}`, acting, 'kafaa.role.grant', `${personId} granted ${role} (${status})`, status === 'pending_second' ? "Granted; needs a second admin's approval" : 'Granted', { id, status });
  }
  async approveRole(id: string) {
    await this.b.whenReady();
    if (!this.ctx.has('users_roles', ['W'])) return this.refuse('role.approve', 'role_assignments', id, 'forbidden', 'Only an admin may approve');
    const r = this.b.rawGet('role_assignments', id);
    if (!r || r.status !== 'pending_second') return this.refuse('role.approve', 'role_assignments', id, 'not_found', 'No pending grant', 'admin');
    if (r.granted_by === this.me) return this.refuse('role.approve', 'role_assignments', id, 'maker_checker', "A second admin must approve an elevated grant", 'admin');
    if (r.person_id === this.me) return this.refuse('role.approve', 'role_assignments', id, 'maker_checker', 'You cannot approve your own elevation', 'admin');
    this.b.rawUpdate('role_assignments', id, { status: 'active', second_approver: this.me });
    return this.done('role.approve', 'role_assignments', id, r.role, 'admin', 'kafaa.role.approve', `${r.person_id} ${r.role} approved`, 'Approved');
  }
  async revokeRole(id: string, reason: string) {
    await this.b.whenReady();
    const r = this.b.rawGet('role_assignments', id);
    if (!r) return this.refuse('role.revoke', 'role_assignments', id, 'not_found', 'Not found');
    const c = this.ctx;
    if (!(c.has('users_roles', ['W']) || (c.has('users_roles', ['OrgW']) && r.org_id === c.who.orgId && r.role === 'partner_user'))) return this.refuse('role.revoke', 'role_assignments', id, 'forbidden', 'You cannot revoke this role');
    this.b.rawUpdate('role_assignments', id, { status: 'revoked' });
    return this.done('role.revoke', 'role_assignments', id, reason ?? '', null, null, '', 'Revoked');
  }

  // ───────────── M05 item workflow and JPMs
  async itemReview(itemId: string, action: 'submit' | 'review' | 'approve') {
    await this.b.whenReady();
    const role = this.ctx.actingRole('secure_items', ['W', 'A']);
    if (!role) return this.refuse(`item.${action}`, 'items', itemId, 'forbidden', 'Item bank access required');
    const i = this.b.rawGet('items', itemId);
    if (!i) return this.refuse(`item.${action}`, 'items', itemId, 'not_found', 'Item not found', role);
    const me = this.me;
    // G2 (2026-10-08): status checks added, and a writer approving their own item is refused as maker_checker (M05 acceptance).
    if (action === 'submit') {
      if (i.writer_person_id !== me) return this.refuse('item.submit', 'items', itemId, 'forbidden', 'Only the writer submits for review', role);
      if (i.status !== 'draft') return this.refuse('item.submit', 'items', itemId, 'invalid', 'Only a draft can be submitted for review', role);
      this.b.rawUpdate('items', itemId, { status: 'in_review' });
    } else if (action === 'review') {
      if (i.writer_person_id === me) return this.refuse('item.review', 'items', itemId, 'separation_of_duties', 'The writer cannot review their own item', role);
      if (i.status !== 'in_review') return this.refuse('item.review', 'items', itemId, 'invalid', 'The item is not in review', role);
      this.b.rawUpdate('items', itemId, { reviewer_person_id: me });
    } else if (action === 'approve') {
      if (!this.ctx.has('secure_items', ['A'])) return this.refuse('item.approve', 'items', itemId, 'forbidden', 'Approver role required', role);
      if (i.writer_person_id === me) return this.refuse('item.approve', 'items', itemId, 'maker_checker', 'You wrote this item: a different person must approve it', role);
      if (i.reviewer_person_id === me) return this.refuse('item.approve', 'items', itemId, 'separation_of_duties', 'Writer, reviewer and approver must be different people', role);
      if (i.status !== 'in_review' || !i.reviewer_person_id) return this.refuse('item.approve', 'items', itemId, 'invalid', 'Item has not been reviewed', role);
      this.b.rawUpdate('items', itemId, { status: 'approved', approver_person_id: me });
    } else return this.refuse(`item.${action}`, 'items', itemId, 'invalid', 'Unknown action', role);
    return this.done(`item.${action}`, 'items', itemId, null, role, null, '', 'Recorded');
  }
  async recordJpm(jpmId: string, personId: string, steps: { n: number; result: 'pass' | 'fail' }[]) {
    await this.b.whenReady();
    const role = this.ctx.actingRole('signoff', ['A']);
    type R = { id: string; result: string; critical_failed: boolean };
    if (!role) return this.refuse<R>('jpm.record', 'jpm_results', jpmId, 'forbidden', 'Only a qualified evaluator may record a JPM');
    if (personId === this.me) return this.refuse<R>('jpm.record', 'jpm_results', jpmId, 'self_sign', 'An evaluator cannot evaluate themselves', role);
    const j = this.b.rawGet('jpms', jpmId);
    if (!j) return this.refuse<R>('jpm.record', 'jpm_results', jpmId, 'not_found', 'JPM not found', role);
    const s = scoreJpm(j.critical_steps as { n: number; critical: boolean }[], steps);
    const id = newId('jr');
    this.b.rawInsert('jpm_results', { id, jpm_id: jpmId, person_id: personId, evaluator_person_id: this.me!, date: todayIso(), steps, critical_failed: s.criticalFailed, score_pct: s.scorePct, result: s.result, signed: true });
    return this.done<R>('jpm.record', 'jpm_results', id, `${s.result}${s.criticalFailed ? ' (critical step failed)' : ''}`, role, null, '', 'JPM recorded', { id, result: s.result, critical_failed: s.criticalFailed });
  }

  // ───────────── M04 simulator and curriculum
  async bookSimulator(slotId: string, kind: string, crew: string | null) {
    await this.b.whenReady();
    const role = this.ctx.actingRole('training', ['W', 'A']);
    if (!role) return this.refuse('simulator.book', 'simulator_slots', slotId, 'forbidden', 'Only training schedulers may book simulators');
    if (!['coct', 'requal', 'initial', 'elective', 'maintenance'].includes(kind)) return this.refuse('simulator.book', 'simulator_slots', slotId, 'invalid', 'Unknown booking kind', role);
    const s = this.b.rawGet('simulator_slots', slotId);
    if (!s) return this.refuse('simulator.book', 'simulator_slots', slotId, 'not_found', 'Slot not found', role);
    const prio = bookingPriority(kind);
    if (['booked', 'tentative'].includes(s.status) && s.booking_kind !== 'free' && s.priority <= prio)
      return this.refuse('simulator.book', 'simulator_slots', slotId, 'conflict', 'Slot holds equal or higher-priority training (licence-critical bookings cannot be displaced)', role);
    const displaced = s.booking_kind !== 'free' ? ` (displaced ${s.booking_kind})` : '';
    this.b.rawUpdate('simulator_slots', slotId, { booking_kind: kind as never, crew, priority: prio, status: 'booked', booked_by: this.me });
    return this.done('simulator.book', 'simulator_slots', slotId, `${kind} crew ${crew ?? '-'}${displaced}`, role, null, '', 'Booked');
  }
  async assignCurriculum(personId: string) {
    await this.b.whenReady();
    const role = this.ctx.actingRole('training', ['W', 'A']);
    if (!role && !this.ctx.has('users_roles', ['W'])) return this.refuse<{ assigned: number }>('curriculum.assign', 'enrolments', personId, 'forbidden', 'Not allowed');
    const pe = this.b.rawGet('people', personId);
    if (!pe || !pe.job_role_id) return this.refuse<{ assigned: number }>('curriculum.assign', 'enrolments', personId, 'not_found', 'Person or role not found', role);
    let n = 0;
    const today = todayIso();
    for (const c of this.b.raw('curriculum_rules').filter((x) => x.role_id === pe.job_role_id && x.mandatory)) {
      if (this.b.raw('enrolments').some((e) => e.person_id === pe.id && e.course_id === c.course_id && !['cancelled', 'failed'].includes(e.status))) continue;
      const due = new Date(`${today}T00:00:00Z`);
      due.setUTCDate(due.getUTCDate() + c.due_within_days);
      this.b.rawInsert('enrolments', { id: newId('en'), person_id: pe.id, course_id: c.course_id, status: 'assigned', source: 'role_rule', assigned_by: 'Curriculum rule', due_on: isoDate(due), org_id: pe.org_id ?? null });
      n++;
    }
    return this.done('curriculum.assign', 'enrolments', personId, `${n} courses assigned for ${pe.job_role_id}`, role, null, '', `${n} courses assigned`, { assigned: n });
  }

  // ───────────── Public and aggregate reads
  async verifyCertificate(no: string): Promise<CertificateCheck> {
    await this.b.whenReady();
    const c = this.b.raw('certificates').find((x) => x.id.toUpperCase() === no.trim().toUpperCase());
    if (!c) return { found: false };
    const co = this.b.rawGet('courses', c.course_id);
    const status = c.status === 'valid' && c.valid_to && c.valid_to < todayIso() ? 'expired' : c.status;
    return { found: true, certificate_no: c.id, status, course_code: co?.code, course_en: co?.title_en, course_ar: co?.title_ar, issued_on: c.issued_on, valid_to: c.valid_to ?? null, holder_initials: c.holder_initials, note: "Internal Kafa'a course certificate. Not an operator licence." };
  }
  async workforceAggregate(period: string, measure: string | null): Promise<AggregateRow[]> {
    await this.b.whenReady();
    if (!this.ctx.has('workforce_analytics', ['Agg', 'R'])) throw new Error("Kafa'a · aggregate analytics are restricted");
    return this.b.raw('workforce_snapshots')
      .filter((w) => w.period === period && (measure == null || w.measure === measure))
      .map((w) => {
        const sup = w.group_size < MIN_GROUP_SIZE;
        return { family_id: w.family_id ?? null, level: w.level ?? null, entity_id: w.entity_id ?? null, measure: w.measure, value: sup ? null : w.value, group_size: sup ? null : w.group_size, suppressed: sup, source: w.source, sample: w.sample };
      });
  }
  async applicationFunnel() {
    await this.b.whenReady();
    if (!this.ctx.has('applications', ['Agg', 'R'])) throw new Error("Kafa'a · funnel is restricted");
    const m = new Map<string, number>();
    for (const a of this.b.raw('applications')) m.set(`${a.programme_id}|${a.stage}`, (m.get(`${a.programme_id}|${a.stage}`) ?? 0) + 1);
    return [...m.entries()].map(([k, n]) => {
      const [programme_id, stage] = k.split('|');
      return { programme_id, stage, n: n < MIN_GROUP_SIZE ? null : n, suppressed: n < MIN_GROUP_SIZE };
    });
  }
  // ───────────── [G3] M06 applications (applicant side), M07 HR planning, M10 research. Mirror of 20261008133001_kafaa_g3_rpcs.sql.
  private g3HrRole(): PlatformRole | null {
    const roles = this.b.identity().roles;
    return roles.includes('hr_director') ? 'hr_director' : roles.includes('hr_analyst') ? 'hr_analyst' : null;
  }
  async submitApplication(programmeId: string, answers: Record<string, string>) {
    await this.b.whenReady();
    const me = this.me;
    if (!me) return this.refuse<{ id: string; stage: string }>('application.submit', 'applications', programmeId, 'not_signed_in', 'Sign in with an applicant account to apply');
    const role = this.ctx.actingRole('applications', ['Own']);
    if (!role) return this.refuse<{ id: string; stage: string }>('application.submit', 'applications', programmeId, 'forbidden', 'This account cannot apply to talent programmes');
    const prog = this.b.rawGet('talent_programmes', programmeId);
    if (!prog) return this.refuse<{ id: string; stage: string }>('application.submit', 'applications', programmeId, 'not_found', 'Programme not found', role);
    if (prog.apply_mode !== 'in_kafaa') return this.refuse<{ id: string; stage: string }>('application.submit', 'applications', programmeId, 'invalid', "This programme takes applications on ENEC's official channel", role);
    const a = answers && typeof answers === 'object' ? answers : {};
    if (Object.keys(a).some((k) => G3_FORBIDDEN_ANSWER_KEYS.includes(k.toLowerCase()))) return this.refuse<{ id: string; stage: string }>('application.submit', 'applications', programmeId, 'invalid', 'Do not send an Emirates ID, passport number or date of birth: they are collected later through UAE Pass if a stage needs them', role);
    if (JSON.stringify(a).length > 4000 || Object.values(a).some((v) => typeof v !== 'string')) return this.refuse<{ id: string; stage: string }>('application.submit', 'applications', programmeId, 'invalid', 'Answers are too long or not text', role);
    if (this.b.raw('applications').some((x) => x.person_id === me && x.programme_id === programmeId && !['withdrawn', 'unsuccessful'].includes(x.stage)))
      return this.refuse<{ id: string; stage: string }>('application.submit', 'applications', programmeId, 'conflict', 'You already have an open application for this programme', role);
    const id = newId('app');
    const stage = a.mode === 'interest' ? 'interest' : 'submitted';
    const now = new Date().toISOString();
    const nat = a.nationality === 'uae' || a.nationality === 'other' ? a.nationality : 'unknown';
    this.b.rawInsert('applications', { id, person_id: me, programme_id: programmeId, stage: stage as never, submitted_at: now, updated_at: now, decision: 'none', decision_source: null, consent_version: '1', delete_after: null, answers: a as never, nationality_flag: nat as never, gender: null });
    this.b.rawInsert('application_events', { id: newId('ae'), application_id: id, person_id: me, ts: now, stage, note_en: stage === 'interest' ? 'Interest registered' : 'Application received', note_ar: stage === 'interest' ? 'تم تسجيل الاهتمام' : 'تم استلام الطلب', by_role: 'Applicant' });
    return this.done('application.submit', 'applications', id, `${programmeId} ${stage}`, role, 'kafaa.application.submit', `Application ${id} to ${programmeId} (${stage})`, stage === 'interest' ? 'Interest registered' : 'Application submitted', { id, stage }, ['applications', 'application_events']);
  }
  async withdrawApplication(id: string, reason: string) {
    await this.b.whenReady();
    const me = this.me;
    if (!me) return this.refuse('application.withdraw', 'applications', id, 'not_signed_in', 'Sign in to manage your applications');
    const role = this.ctx.actingRole('applications', ['Own']);
    const ap = this.b.rawGet('applications', id);
    if (!ap || ap.person_id !== me || !role) return this.refuse('application.withdraw', 'applications', id, 'not_found', 'Application not found', role);
    if (['withdrawn', 'unsuccessful', 'accepted'].includes(ap.stage)) return this.refuse('application.withdraw', 'applications', id, 'invalid', 'Application is closed', role);
    const now = new Date().toISOString();
    this.b.rawUpdate('applications', id, { stage: 'withdrawn', decision: 'withdrawn', updated_at: now, delete_after: addMonths(todayIso(), G3_RETENTION_MONTHS) });
    const note = (reason ?? '').slice(0, 300);
    this.b.rawInsert('application_events', { id: newId('ae'), application_id: id, person_id: me, ts: now, stage: 'withdrawn', note_en: note || 'Withdrawn by applicant', note_ar: note || 'سحبه المتقدم', by_role: 'Applicant' });
    return this.done('application.withdraw', 'applications', id, 'withdrawn', role, 'kafaa.application.withdraw', `Application ${id} (${ap.programme_id}) withdrawn by the applicant`, 'Application withdrawn', undefined, ['applications', 'application_events']);
  }
  async draftObserverReport(p: ObserverReportDraft) {
    await this.b.whenReady();
    const role = this.ctx.actingRole('observer_release', ['W', 'A']);
    if (!role) return this.refuse<{ id: string }>('observer_report.draft', 'observer_reports', null, 'forbidden', 'Only HR may prepare an observer report');
    const tiles = Array.isArray(p?.tiles) ? p.tiles : [];
    if (!p || (p.title_en ?? '').trim().length < 5 || (p.title_ar ?? '').trim().length < 5 || !(p.period ?? '').trim()) return this.refuse<{ id: string }>('observer_report.draft', 'observer_reports', null, 'invalid', 'A report needs an English and an Arabic title and a period', role);
    if (tiles.length < 1 || tiles.length > 12 || tiles.some((x) => !x || typeof x.k !== 'string' || typeof x.v !== 'string' || !x.k || !x.v || x.v.length > 60)) return this.refuse<{ id: string }>('observer_report.draft', 'observer_reports', null, 'invalid', 'Choose between 1 and 12 aggregate tiles', role);
    const id = newId('or');
    this.b.rawInsert('observer_reports', { id, title_en: p.title_en.trim(), title_ar: p.title_ar.trim(), period: p.period.trim(), body: { tiles: tiles.map((x) => ({ k: x.k, v: x.v, src: x.src ?? '' })), note: p.note ?? 'Aggregate only; groups under 10 suppressed.' } as never, status: 'draft', prepared_by: this.me, approved_by: null, approved_at: null, released_to_org_ids: [] });
    return this.done('observer_report.draft', 'observer_reports', id, `${tiles.length} tiles`, role, null, '', 'Draft saved', { id });
  }
  async saveScenario(p: ScenarioInput) {
    await this.b.whenReady();
    const role = this.g3HrRole();
    if (!role) return this.refuse<{ id: string }>('scenario.save', 'scenarios', p?.id ?? null, 'forbidden', 'Only HR analysts may save workforce scenarios');
    if (!p || (p.name ?? '').trim().length < 3 || !['headcount', 'technology', 'programme'].includes(p.kind)) return this.refuse<{ id: string }>('scenario.save', 'scenarios', p?.id ?? null, 'invalid', 'A scenario needs a name and a kind', role);
    const name = /simulated/i.test(p.name) ? p.name.trim() : `${p.name.trim()} (SIMULATED)`;
    if (p.id) {
      const cur = this.b.rawGet('scenarios', p.id);
      if (!cur || cur.owner_person_id !== this.me) return this.refuse<{ id: string }>('scenario.save', 'scenarios', p.id, 'not_found', 'Scenario not found', role);
      this.b.rawUpdate('scenarios', p.id, { name, kind: p.kind, params: (p.params ?? {}) as never, results: (p.results ?? {}) as never, simulated: true });
      return this.done('scenario.save', 'scenarios', p.id, name, role, null, '', 'Scenario saved', { id: p.id });
    }
    const id = newId('scn');
    this.b.rawInsert('scenarios', { id, name, kind: p.kind, params: (p.params ?? {}) as never, results: (p.results ?? {}) as never, simulated: true, owner_person_id: this.me, created_at: new Date().toISOString() });
    return this.done('scenario.save', 'scenarios', id, name, role, null, '', 'Scenario saved', { id });
  }
  async setBenchTarget(id: string, target: number, reason: string) {
    await this.b.whenReady();
    const role = this.g3HrRole();
    if (!role) return this.refuse('bench.target', 'critical_roles', id, 'forbidden', 'Only HR sets bench-depth targets');
    const r = this.b.rawGet('critical_roles', id);
    if (!r) return this.refuse('bench.target', 'critical_roles', id, 'not_found', 'Critical role not found', role);
    if (!Number.isInteger(target) || target < 0 || target > 1000) return this.refuse('bench.target', 'critical_roles', id, 'invalid', 'Target must be a whole number from 0 to 1000', role);
    if ((reason ?? '').trim().length < 5) return this.refuse('bench.target', 'critical_roles', id, 'invalid', 'Give a reason of at least 5 characters', role);
    this.b.rawUpdate('critical_roles', id, { target_bench: target });
    return this.done('bench.target', 'critical_roles', id, `${r.target_bench} -> ${target}: ${reason.trim()}`, role, 'kafaa.workforce.bench_target', `Bench target for ${r.role_id} set to ${target}`, 'Target updated');
  }
  async saveResearchChallenge(p: ResearchChallengeInput) {
    await this.b.whenReady();
    type R = { id: string; status: string };
    const role = this.ctx.actingRole('research', ['A']);
    if (!role) return this.refuse<R>('research.challenge_save', 'research_challenges', p?.id ?? null, 'forbidden', 'Only the research screening authority may edit challenges');
    if (!p || [p.title_en, p.title_ar, p.summary_en, p.summary_ar, p.theme].some((x) => !x || x.trim().length < 3)) return this.refuse<R>('research.challenge_save', 'research_challenges', p?.id ?? null, 'invalid', 'Titles, summaries (English and Arabic) and a theme are required', role);
    const fields = { title_en: p.title_en.trim(), title_ar: p.title_ar.trim(), theme: p.theme.trim(), summary_en: p.summary_en.trim(), summary_ar: p.summary_ar.trim(), closes_on: p.closes_on || null };
    if (p.id) {
      const c = this.b.rawGet('research_challenges', p.id);
      if (!c) return this.refuse<R>('research.challenge_save', 'research_challenges', p.id, 'not_found', 'Challenge not found', role);
      if (c.status === 'closed') return this.refuse<R>('research.challenge_save', 'research_challenges', p.id, 'invalid', 'A closed challenge cannot be edited', role);
      // Any edit to a screened or published challenge needs a fresh screening sign-off before it is public again.
      const status = c.status === 'draft' && !p.submit ? 'draft' : 'screening';
      this.b.rawUpdate('research_challenges', p.id, { ...fields, status, is_published: false, security_ok: false, export_control_ok: false, screening_signed_by: null, screening_signed_at: null });
      return this.done<R>('research.challenge_save', 'research_challenges', p.id, `edited; now ${status}`, role, null, '', status === 'screening' ? 'Saved; awaiting screening sign-off' : 'Draft saved', { id: p.id, status });
    }
    const id = newId('rc');
    const status = p.submit ? 'screening' : 'draft';
    this.b.rawInsert('research_challenges', { id, ...fields, status, is_published: false, screening_signed_by: null, screening_signed_at: null, security_ok: false, export_control_ok: false });
    return this.done<R>('research.challenge_save', 'research_challenges', id, `created; ${status}`, role, null, '', status === 'screening' ? 'Saved; awaiting screening sign-off' : 'Draft saved', { id, status });
  }
  async saveResearchProposal(p: ResearchProposalInput) {
    await this.b.whenReady();
    type R = { id: string; status: string };
    const me = this.me;
    const org = this.b.identity().orgId;
    if (!me) return this.refuse<R>('research.proposal_save', 'research_proposals', p?.id ?? null, 'not_signed_in', 'Sign in to propose research');
    const role = this.ctx.actingRole('research', ['OrgW']);
    if (!role || !org) return this.refuse<R>('research.proposal_save', 'research_proposals', p?.id ?? null, 'forbidden', 'Only partner organisations may submit research proposals');
    if (!p || (p.title ?? '').trim().length < 5 || (p.summary ?? '').trim().length < 20 || p.summary.length > 4000 || p.title.length > 200) return this.refuse<R>('research.proposal_save', 'research_proposals', p?.id ?? null, 'invalid', 'A proposal needs a title (5-200 characters) and a summary (20-4000 characters)', role);
    if (p.challenge_id) {
      const c = this.b.rawGet('research_challenges', p.challenge_id);
      if (!c || !c.is_published) return this.refuse<R>('research.proposal_save', 'research_proposals', p.id ?? null, 'invalid', 'Respond to a published challenge, or leave the challenge empty for an open proposal', role);
    }
    const ip = (p.ip_route ?? '').trim() || G3_DEFAULT_IP_ROUTE;
    const status = p.submit ? 'submitted' : 'draft';
    if (p.id) {
      const cur = this.b.rawGet('research_proposals', p.id);
      if (!cur || cur.org_id !== org) return this.refuse<R>('research.proposal_save', 'research_proposals', p.id, 'not_found', 'Proposal not found', role);
      if (cur.status !== 'draft') return this.refuse<R>('research.proposal_save', 'research_proposals', p.id, 'invalid', 'A submitted proposal cannot be edited', role);
      this.b.rawUpdate('research_proposals', p.id, { challenge_id: p.challenge_id || null, title: p.title.trim(), summary: p.summary.trim(), ip_route: ip, status, submitted_at: p.submit ? new Date().toISOString() : null });
      return this.done<R>('research.proposal_save', 'research_proposals', p.id, status, role, p.submit ? 'kafaa.research.proposal_submit' : null, `Research proposal ${p.id} submitted by ${org}`, p.submit ? 'Proposal submitted for screening' : 'Draft saved', { id: p.id, status });
    }
    const id = newId('rp');
    this.b.rawInsert('research_proposals', { id, challenge_id: p.challenge_id || null, org_id: org, title: p.title.trim(), summary: p.summary.trim(), status, ip_route: ip, screened: false, submitted_at: p.submit ? new Date().toISOString() : null });
    return this.done<R>('research.proposal_save', 'research_proposals', id, status, role, p.submit ? 'kafaa.research.proposal_submit' : null, `Research proposal ${id} submitted by ${org}`, p.submit ? 'Proposal submitted for screening' : 'Draft saved', { id, status });
  }
  async decideResearchProposal(id: string, decision: 'screening' | 'accepted' | 'declined', securityOk: boolean, note: string) {
    await this.b.whenReady();
    const role = this.ctx.actingRole('research', ['A']);
    if (!role) return this.refuse('research.proposal_decide', 'research_proposals', id, 'forbidden', 'Only the research screening authority may decide proposals');
    if (!['screening', 'accepted', 'declined'].includes(decision)) return this.refuse('research.proposal_decide', 'research_proposals', id, 'invalid', 'Unknown decision', role);
    const r = this.b.rawGet('research_proposals', id);
    if (!r) return this.refuse('research.proposal_decide', 'research_proposals', id, 'not_found', 'Proposal not found', role);
    if (!['submitted', 'screening'].includes(r.status)) return this.refuse('research.proposal_decide', 'research_proposals', id, 'invalid', 'Only submitted proposals can be screened or decided', role);
    const screened = r.screened || !!securityOk;
    if (decision === 'accepted' && !screened) return this.refuse('research.proposal_decide', 'research_proposals', id, 'invalid', 'Screen the proposal for security sensitivity and export control before accepting it', role);
    if (decision !== 'screening' && (note ?? '').trim().length < 5) return this.refuse('research.proposal_decide', 'research_proposals', id, 'invalid', 'A decision note of at least 5 characters is required', role);
    this.b.rawUpdate('research_proposals', id, { status: decision, screened });
    return this.done('research.proposal_decide', 'research_proposals', id, `${decision}; screened=${screened}${note ? `; ${note.trim().slice(0, 200)}` : ''}`, role, decision === 'screening' ? null : 'kafaa.research.proposal_decide', `Research proposal ${id} (${r.org_id}): ${decision}`, 'Decision recorded');
  }

  async logDenied(route: string, resource: string) {
    await this.b.whenReady();
    if (route.startsWith('/speak-up') || route.startsWith('/ar/speak-up')) return; // M08: the speak-up route sends no audit events
    await this.b.audit('access.denied', null, route.slice(0, 200), 'refused', `route guard: ${resource}`);
  }
  // ───────────── G1 additions (src/data/local/rpc.g1.ts)
  ackEvaluation(evaluationId: string, note: string) { return this.g1.ackEvaluation(evaluationId, note); }
  qualExpirySweep() { return this.g1.qualExpirySweep(); }
  reviewQualRecord(recordId: string, decision: 'carry_over' | 'retrain', note: string) { return this.g1.reviewQualRecord(recordId, decision, note); }
  licensingAlerts() { return this.g1.licensingAlerts(); }
  closeLicensingTask(taskId: string, note: string) { return this.g1.closeLicensingTask(taskId, note); }
  recordMedicalDate(personId: string, dueOn: string, flag: 'fit' | 'not_confirmed', sourceRef: string) { return this.g1.recordMedicalDate(personId, dueOn, flag, sourceRef); }
  crewAvailability() { return this.g1.crewAvailability(); }

  async auditVerify() {
    await this.b.whenReady();
    if (!this.ctx.has('audit_log', ['R'])) return { ok: false, code: 'forbidden', message: 'Audit log is restricted' };
    let prev = GENESIS;
    const rows = [...this.b.raw('audit_events')].sort((a, b) => a.seq - b.seq);
    for (const e of rows) {
      const h = await chainHash(prev, e as never);
      if (e.prev_hash !== prev || e.hash !== h) return { ok: false, code: 'error', message: `Audit chain broken at seq ${e.seq}`, data: { entries: e.seq } };
      prev = e.hash;
    }
    void canonical;
    return { ok: true, code: 'ok', message: `Chain verified (${rows.length} entries)`, data: { entries: rows.length } };
  }
}
