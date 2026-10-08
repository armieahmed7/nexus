/**
 * [G4] LocalBackend mirror of supabase/migrations/20261008134001_kafaa_g4_partners.sql (M09 partners and suppliers, M11 future workforce).
 * Same checks, refusal codes, audit rows and ledger behaviour as the SQL functions. Rules come from src/domain/partners.ts
 * and src/domain/future.ts so pages, local RPCs and tests share one definition. Change this file and the SQL together.
 */
import type { LocalBackend } from './LocalBackend';
import type { EquivalencyInput, EquivalencyMapping, G4Rpc, GapPlanInput, IcvPlanInput, Result, RowOf } from '../types';
import type { PlatformRole } from '../../auth/policy';
import { newId } from './store';
import { todayIso, addWorkingDays } from '../../domain/rules';
import {
  buildSummary, certificateValidTo, DOC_CHECKLIST, DOC_KEYS, EVIDENCE_KINDS, equivalencyCoverage, icvCheck, icvSubmittable, readinessState, scoreCheck, SUPPLIER_TRANSITIONS,
} from '../../domain/partners';
import { validGapPlan } from '../../domain/future';

type Refuse = <T = unknown>(action: string, table: string | null, entity: string | null, code: string, message: string, role?: string | null) => Promise<Result<T>>;
type Done = <T>(action: string, table: string, entity: string | null, reason: string | null, role: string | null, ledgerAction: string | null, ledgerReason: string, message: string, data?: T, tables?: string[]) => Promise<Result<T>>;

const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const hist = (prev: unknown, action: string, status: string, byRole: string | null, note: string | null) => [
  ...(Array.isArray(prev) ? prev : []),
  { at: nowIso(), action, status, by_role: byRole, note: note || null },
];
const ICV_PROBLEM_TEXT: Record<string, string> = {
  baseline_range: 'Baseline must be between 0 and 100',
  target_range: 'Target must be above the baseline and at most 100',
  year_range: 'Target year must be between this year and ten years from now',
  no_levers: 'Add at least one improvement lever',
  lever_invalid: 'Each lever needs a name and a positive number of points',
  levers_short: 'The levers do not cover the gap between baseline and target',
  certificate_missing: 'Upload the current ICV certificate and its validity date',
  certificate_expired: 'The ICV certificate on file has expired',
};

export class G4LocalRpc implements G4Rpc {
  constructor(private readonly b: LocalBackend, private readonly refuse: Refuse, private readonly done: Done) {}

  private get ctx() {
    return this.b.access();
  }
  private get me() {
    return this.b.identity().personId;
  }
  private get myOrg() {
    return this.b.identity().orgId;
  }
  private hasRole(...r: PlatformRole[]) {
    return this.b.identity().roles.some((x) => r.includes(x));
  }

  // ───────────── M09 supplier onboarding (supplier side)
  async partnerOnboardingAction(caseId: string, action: 'start' | 'submit' | 'withdraw') {
    await this.b.whenReady();
    type R = { status: string; summary?: unknown };
    const act = `partner.onboarding.${action}`;
    const role = this.ctx.actingRole('partner_org', ['OrgW']);
    if (!role) return this.refuse<R>(act, 'partner_onboarding', caseId, 'forbidden', "Only your organisation's partner admin may update the onboarding case");
    const c = this.b.rawGet('partner_onboarding', caseId);
    if (!c || c.org_id !== this.myOrg) return this.refuse<R>(act, 'partner_onboarding', caseId, 'not_found', 'Onboarding case not found', role);
    const tr = SUPPLIER_TRANSITIONS[action];
    if (!tr) return this.refuse<R>(act, 'partner_onboarding', caseId, 'invalid', 'Unknown action', role);
    if (!tr.from.includes(c.status)) return this.refuse<R>(act, 'partner_onboarding', caseId, 'invalid', `The case is ${c.status.replace(/_/g, ' ')}; it cannot be changed this way`, role);
    if (action === 'submit') {
      const steps = this.b.raw('supplier_readiness').filter((s) => s.org_id === c.org_id);
      const docs = this.b.raw('supplier_documents').filter((d) => d.org_id === c.org_id);
      const icv = this.b.raw('icv_plans').find((p) => p.org_id === c.org_id) ?? null;
      const st = readinessState(steps, docs, icv);
      if (!st.ready) {
        const parts = [
          st.missingSteps.length ? `${st.missingSteps.length} readiness step(s) open` : '',
          st.missingDocs.length ? `${st.missingDocs.length} required document(s) missing` : '',
          st.rejectedDocs.length ? `${st.rejectedDocs.length} document(s) rejected` : '',
          !st.icvReady ? 'ICV plan not submitted' : '',
        ].filter(Boolean);
        return this.refuse<R>(act, 'partner_onboarding', caseId, 'invalid', `Not ready to submit: ${parts.join('; ')}`, role);
      }
      const org = this.b.rawGet('organisations', c.org_id)!;
      const certs = this.b.raw('certificates').filter((x) => x.org_id === c.org_id && x.status === 'valid').map((x) => ({ id: x.id, course_id: x.course_id, issued_on: x.issued_on }));
      const summary = buildSummary({ org, steps, docs, icv, certificates: certs });
      this.b.rawUpdate('partner_onboarding', caseId, { status: 'submitted', submitted_at: nowIso(), summary: summary as never, history: hist(c.history, 'submit', 'submitted', role, `Readiness summary ${summary.ref}`) as never });
      return this.done<R>(act, 'partner_onboarding', caseId, `submitted ${summary.ref}`, role, 'kafaa.partner.submit', `Supplier readiness ${caseId} (${c.org_id}) submitted: ${summary.ref}`, 'Submitted for ENEC review', { status: 'submitted', summary });
    }
    this.b.rawUpdate('partner_onboarding', caseId, { status: tr.to as never, history: hist(c.history, action, tr.to, role, null) as never });
    return this.done<R>(act, 'partner_onboarding', caseId, `${c.status} -> ${tr.to}`, role, null, '', action === 'start' ? 'Onboarding started' : 'Submission withdrawn', { status: tr.to });
  }

  async uploadSupplierDocument(orgId: string, docKey: string, fileName: string, sizeKb: number, sha256: string) {
    await this.b.whenReady();
    type R = { id: string };
    const id = `sd-${orgId}-${docKey}`;
    const role = this.ctx.actingRole('partner_org', ['OrgW']);
    if (!role) return this.refuse<R>('partner.document.upload', 'supplier_documents', id, 'forbidden', "Only your organisation's partner admin may upload documents");
    if (orgId !== this.myOrg) return this.refuse<R>('partner.document.upload', 'supplier_documents', id, 'not_found', 'Organisation not found', role);
    if (!DOC_KEYS.includes(docKey)) return this.refuse<R>('partner.document.upload', 'supplier_documents', id, 'invalid', 'Unknown checklist document', role);
    const name = String(fileName ?? '').trim();
    if (!name || name.length > 200) return this.refuse<R>('partner.document.upload', 'supplier_documents', id, 'invalid', 'A file name of 1 to 200 characters is required', role);
    if (!(Number(sizeKb) > 0 && Number(sizeKb) <= 25600)) return this.refuse<R>('partner.document.upload', 'supplier_documents', id, 'invalid', 'Files must be larger than 0 and at most 25 MB', role);
    if (!/^[0-9a-f]{64}$/.test(String(sha256 ?? ''))) return this.refuse<R>('partner.document.upload', 'supplier_documents', id, 'invalid', 'A SHA-256 fingerprint of the file is required', role);
    const c = this.b.raw('partner_onboarding').find((x) => x.org_id === orgId);
    if (!c) return this.refuse<R>('partner.document.upload', 'supplier_documents', id, 'not_found', 'No onboarding case for your organisation', role);
    if (!['invited', 'in_progress', 'returned'].includes(c.status)) return this.refuse<R>('partner.document.upload', 'supplier_documents', id, 'conflict', 'The case is with ENEC or closed; withdraw the submission to change documents', role);
    const def = DOC_KEYS.indexOf(docKey);
    const patch = { status: 'uploaded' as const, file_name: name, size_kb: Math.round(Number(sizeKb)), sha256, uploaded_at: nowIso(), uploaded_by: this.me, reviewed_at: null, reviewed_by: null, review_note: null };
    if (this.b.rawGet('supplier_documents', id)) this.b.rawUpdate('supplier_documents', id, patch);
    else {
      const d = DOC_CHECKLIST[def];
      this.b.rawInsert('supplier_documents', { id, org_id: orgId, doc_key: docKey, required: d.required, step_key: d.step, ...patch });
    }
    return this.done<R>('partner.document.upload', 'supplier_documents', id, `${docKey}: ${name} (${sha256.slice(0, 12)})`, role, null, '', 'Document recorded', { id });
  }

  // ───────────── M09 supplier onboarding (ENEC side)
  async reviewSupplierDocument(docId: string, decision: 'accepted' | 'rejected', note: string) {
    await this.b.whenReady();
    const role = this.ctx.actingRole('partner_org', ['A']);
    if (!role) return this.refuse('partner.document.review', 'supplier_documents', docId, 'forbidden', 'Only a platform admin may review supplier documents');
    if (!['accepted', 'rejected'].includes(decision)) return this.refuse('partner.document.review', 'supplier_documents', docId, 'invalid', 'Decision must be accepted or rejected', role);
    const d = this.b.rawGet('supplier_documents', docId);
    if (!d) return this.refuse('partner.document.review', 'supplier_documents', docId, 'not_found', 'Document not found', role);
    if (d.org_id === this.myOrg) return this.refuse('partner.document.review', 'supplier_documents', docId, 'conflict', "You cannot review your own organisation's documents", role);
    if (d.status === 'missing') return this.refuse('partner.document.review', 'supplier_documents', docId, 'invalid', 'Nothing has been uploaded yet', role);
    if (decision === 'rejected' && String(note ?? '').trim().length < 5) return this.refuse('partner.document.review', 'supplier_documents', docId, 'invalid', 'A rejection needs a note the supplier can act on', role);
    this.b.rawUpdate('supplier_documents', docId, { status: decision, reviewed_at: nowIso(), reviewed_by: this.me, review_note: note || null });
    return this.done('partner.document.review', 'supplier_documents', docId, `${d.doc_key} ${decision}${note ? `: ${note}` : ''}`, role, `kafaa.partner.document.${decision}`, `Supplier document ${d.doc_key} (${d.org_id}) ${decision}`, 'Review recorded');
  }

  // ───────────── M09 ICV
  async saveIcvPlan(orgId: string, plan: IcvPlanInput, submit: boolean) {
    await this.b.whenReady();
    type R = { id: string; status: string };
    const id = `icv-${orgId}`;
    const act = submit ? 'icv.submit' : 'icv.save';
    const role = this.ctx.actingRole('partner_org', ['OrgW']);
    if (!role) return this.refuse<R>(act, 'icv_plans', id, 'forbidden', "Only your organisation's partner admin may edit the ICV plan");
    if (orgId !== this.myOrg) return this.refuse<R>(act, 'icv_plans', id, 'not_found', 'Organisation not found', role);
    const p = { ...plan, levers: Array.isArray(plan.levers) ? plan.levers : [] };
    const chk = submit ? icvSubmittable(p) : { ok: icvCheck(p).valid, problems: icvCheck(p).problems };
    if (!chk.ok) return this.refuse<R>(act, 'icv_plans', id, 'invalid', chk.problems.map((x) => ICV_PROBLEM_TEXT[x] ?? x).join('; '), role);
    const cur = this.b.rawGet('icv_plans', id);
    if (cur?.status === 'submitted' && !submit) return this.refuse<R>(act, 'icv_plans', id, 'conflict', 'The plan is with ENEC for review', role);
    const status = submit ? 'submitted' : 'draft';
    const row = {
      baseline: Number(p.baseline), target: Number(p.target), target_year: Number(p.target_year), levers: p.levers as never, status: status as never,
      certificate_valid_to: p.certificate_valid_to || null, certificate_file: p.certificate_file || null, certificate_sha256: p.certificate_sha256 || null,
      submitted_at: submit ? nowIso() : cur?.submitted_at ?? null, reviewed_at: null, reviewed_by: null, review_note: cur?.review_note ?? null,
    };
    if (cur) this.b.rawUpdate('icv_plans', id, row);
    else this.b.rawInsert('icv_plans', { id, org_id: orgId, ...row });
    return this.done<R>(act, 'icv_plans', id, `${p.baseline} -> ${p.target} by ${p.target_year} (${status})`, role, submit ? 'kafaa.icv.submit' : null, `ICV plan ${id}: ${p.baseline} -> ${p.target} by ${p.target_year}`, submit ? 'Plan submitted for review' : 'Draft saved', { id, status });
  }

  async reviewIcvPlan(planId: string, decision: 'reviewed' | 'returned', note: string) {
    await this.b.whenReady();
    const role = this.ctx.actingRole('partner_org', ['A']);
    if (!role) return this.refuse('icv.review', 'icv_plans', planId, 'forbidden', 'Only a platform admin may review ICV plans');
    if (!['reviewed', 'returned'].includes(decision)) return this.refuse('icv.review', 'icv_plans', planId, 'invalid', 'Decision must be reviewed or returned', role);
    const p = this.b.rawGet('icv_plans', planId);
    if (!p) return this.refuse('icv.review', 'icv_plans', planId, 'not_found', 'ICV plan not found', role);
    if (p.status !== 'submitted') return this.refuse('icv.review', 'icv_plans', planId, 'invalid', 'Only a submitted plan can be reviewed', role);
    if (decision === 'returned' && String(note ?? '').trim().length < 5) return this.refuse('icv.review', 'icv_plans', planId, 'invalid', 'Returning a plan needs a note the supplier can act on', role);
    this.b.rawUpdate('icv_plans', planId, { status: decision === 'reviewed' ? 'reviewed' : 'draft', reviewed_at: nowIso(), reviewed_by: this.me, review_note: note || null });
    return this.done('icv.review', 'icv_plans', planId, `${decision}${note ? `: ${note}` : ''}`, role, `kafaa.icv.${decision}`, `ICV plan ${planId} (${p.org_id}) ${decision}`, decision === 'reviewed' ? 'Plan marked reviewed' : 'Plan returned to the supplier');
  }

  // ───────────── M09 contractor equivalency
  async submitEquivalency(input: EquivalencyInput) {
    await this.b.whenReady();
    type R = { id: string };
    const role = this.ctx.actingRole('equivalency', ['OrgW']);
    if (!role) return this.refuse<R>('equivalency.submit', 'equivalency_requests', null, 'forbidden', "Only your organisation's partner admin may submit equivalency requests");
    const org = this.myOrg;
    const label = String(input?.person_label ?? '').trim();
    if (!label || label.length > 80) return this.refuse<R>('equivalency.submit', 'equivalency_requests', null, 'invalid', 'A person reference of 1 to 80 characters is required', role);
    if (input.person_id) {
      const p = this.b.rawGet('people', input.person_id);
      if (!p || p.org_id !== org) return this.refuse<R>('equivalency.submit', 'equivalency_requests', input.person_id, 'not_found', 'Person not found in your organisation', role);
    }
    const std = this.b.rawGet('qual_standards', input.standard_id);
    if (!std || std.status !== 'current') return this.refuse<R>('equivalency.submit', 'equivalency_requests', input.standard_id, 'not_found', 'Qualification standard not found', role);
    if (std.security_restricted) return this.refuse<R>('equivalency.submit', 'equivalency_requests', input.standard_id, 'invalid', "Security qualifications are not handled through equivalency in Kafa'a", role);
    const ev = Array.isArray(input.evidence) ? input.evidence : [];
    if (ev.length < 1 || ev.length > 10) return this.refuse<R>('equivalency.submit', 'equivalency_requests', null, 'invalid', 'Attach between 1 and 10 evidence items', role);
    if (ev.some((e) => !String(e?.name ?? '').trim() || !(EVIDENCE_KINDS as readonly string[]).includes(e.kind))) return this.refuse<R>('equivalency.submit', 'equivalency_requests', null, 'invalid', 'Each evidence item needs a name and a known kind', role);
    const key = input.person_id ?? label.toLowerCase();
    if (this.b.raw('equivalency_requests').some((r) => r.org_id === org && r.standard_id === std.id && ['submitted', 'under_review'].includes(r.status) && (r.person_id ?? r.person_label.toLowerCase()) === key))
      return this.refuse<R>('equivalency.submit', 'equivalency_requests', null, 'conflict', 'An open request already exists for this person and standard', role);
    const id = newId('eq');
    const evidence = ev.map((e) => ({ name: String(e.name).trim(), kind: e.kind, sha256: e.sha256 ?? null, size_kb: e.size_kb ?? null }));
    this.b.rawInsert('equivalency_requests', {
      id, org_id: org!, person_id: input.person_id ?? null, person_label: label, standard_id: std.id, evidence: evidence as never, status: 'submitted', submitted_at: nowIso(),
      submitted_by: this.me, mapping: [] as never, history: hist([], 'submit', 'submitted', role, `${evidence.length} evidence items`) as never,
    });
    return this.done<R>('equivalency.submit', 'equivalency_requests', id, `${std.code} for ${label} (${evidence.length} evidence)`, role, null, '', 'Request submitted', { id });
  }

  private evaluatorFor(standardId: string) {
    const today = todayIso();
    return this.b.identity().roles.includes('training_manager') || this.b.raw('evaluator_quals').some((q) => q.person_id === this.me && q.standard_id === standardId && q.valid_to >= today);
  }

  async mapEquivalency(id: string, mapping: EquivalencyMapping[]) {
    await this.b.whenReady();
    type R = { covered: number; total: number };
    const role = this.ctx.actingRole('equivalency', ['A']);
    if (!role) return this.refuse<R>('equivalency.map', 'equivalency_requests', id, 'forbidden', 'Only an ENEC evaluator may map equivalency evidence');
    const r = this.b.rawGet('equivalency_requests', id);
    if (!r) return this.refuse<R>('equivalency.map', 'equivalency_requests', id, 'not_found', 'Request not found', role);
    if (!this.evaluatorFor(r.standard_id)) return this.refuse<R>('equivalency.map', 'equivalency_requests', id, 'not_evaluator', 'You do not hold the evaluator qualification for this standard', role);
    if (!['submitted', 'under_review'].includes(r.status)) return this.refuse<R>('equivalency.map', 'equivalency_requests', id, 'invalid', 'The request has already been decided', role);
    const tasks = this.b.raw('task_items').filter((t) => t.standard_id === r.standard_id);
    const ids = new Set(tasks.map((t) => t.id));
    const evN = Array.isArray(r.evidence) ? (r.evidence as unknown[]).length : 0;
    const m = Array.isArray(mapping) ? mapping : [];
    if (m.some((x) => !ids.has(x.task_id) || (x.evidence ?? []).some((i) => !(Number.isInteger(i) && i >= 0 && i < evN)) || (x.covered && !(x.evidence ?? []).length)))
      return this.refuse<R>('equivalency.map', 'equivalency_requests', id, 'invalid', 'Each mapping row must name a task on this standard, and a covered task must cite at least one evidence item', role);
    const clean = m.map((x) => ({ task_id: x.task_id, covered: !!x.covered, evidence: x.evidence ?? [], note: String(x.note ?? '').slice(0, 300) }));
    const cov = equivalencyCoverage(tasks, clean);
    this.b.rawUpdate('equivalency_requests', id, { mapping: clean as never, status: 'under_review', history: hist(r.history, 'map', 'under_review', role, `${cov.covered}/${cov.total} tasks covered`) as never });
    return this.done<R>('equivalency.map', 'equivalency_requests', id, `${cov.covered}/${cov.total} tasks covered`, role, null, '', 'Mapping saved', { covered: cov.covered, total: cov.total });
  }

  // ───────────── M09 supplier academy
  async enrolSupplierCourse(courseId: string, personId: string | null) {
    await this.b.whenReady();
    type R = { id: string };
    const me = this.me;
    if (!me) return this.refuse<R>('academy.enrol', 'enrolments', courseId, 'not_signed_in', 'Sign in to enrol');
    const role = this.ctx.actingRole('partner_org', ['OwnOrg', 'OrgW']);
    if (!role || !this.hasRole('partner_user', 'partner_admin')) return this.refuse<R>('academy.enrol', 'enrolments', courseId, 'forbidden', 'The supplier academy is for supplier and contractor accounts');
    const course = this.b.rawGet('courses', courseId);
    if (!course || course.audience !== 'supplier') return this.refuse<R>('academy.enrol', 'enrolments', courseId, 'not_found', 'Supplier course not found', role);
    const target = personId ?? me;
    let source: 'self' | 'partner_admin' = 'self';
    if (target !== me) {
      const adminRole = this.ctx.actingRole('partner_org', ['OrgW']);
      const p = this.b.rawGet('people', target);
      if (!adminRole) return this.refuse<R>('academy.enrol', 'enrolments', target, 'forbidden', 'Only a partner admin may enrol someone else', role);
      if (!p || p.org_id !== this.myOrg) return this.refuse<R>('academy.enrol', 'enrolments', target, 'not_found', 'Person not found in your organisation', adminRole);
      source = 'partner_admin';
    }
    if (this.b.raw('enrolments').some((e) => e.person_id === target && e.course_id === courseId && !['cancelled', 'failed'].includes(e.status)))
      return this.refuse<R>('academy.enrol', 'enrolments', courseId, 'conflict', 'Already enrolled in this course', role);
    const id = newId('en');
    this.b.rawInsert('enrolments', { id, person_id: target, course_id: courseId, org_id: this.myOrg, status: 'enrolled', source, assigned_by: source === 'partner_admin' ? me : null, due_on: addWorkingDays(todayIso(), 40), progress_pct: 0 });
    return this.done<R>('academy.enrol', 'enrolments', id, `${course.code} for ${target === me ? 'self' : target}`, role, null, '', 'Enrolled', { id });
  }

  async completeSupplierCourse(enrolmentId: string, answers: { check_id: string; answer: number }[]) {
    await this.b.whenReady();
    type R = { score: number; passed: boolean; certificate_no: string | null };
    const me = this.me;
    const e = this.b.rawGet('enrolments', enrolmentId);
    if (!me || !e || e.person_id !== me) return this.refuse<R>('academy.complete', 'enrolments', enrolmentId, 'not_found', 'Enrolment not found');
    const course = this.b.rawGet('courses', e.course_id);
    if (!course || course.audience !== 'supplier') return this.refuse<R>('academy.complete', 'enrolments', enrolmentId, 'not_found', 'Supplier course not found');
    if (e.status === 'completed') return this.refuse<R>('academy.complete', 'enrolments', enrolmentId, 'conflict', 'This course is already completed');
    if (['cancelled', 'failed'].includes(e.status)) return this.refuse<R>('academy.complete', 'enrolments', enrolmentId, 'invalid', 'This enrolment is closed');
    const checks = new Set(this.b.raw('academy_checks').filter((c) => c.course_id === course.id).map((c) => c.id));
    const keys = this.b.raw('academy_check_keys').filter((k) => checks.has(k.check_id)).map((k) => ({ check_id: k.check_id, answer: k.answer }));
    if (!keys.length) return this.refuse<R>('academy.complete', 'enrolments', enrolmentId, 'invalid', 'This course has no knowledge check yet');
    const s = scoreCheck(keys, Array.isArray(answers) ? answers : [], course.pass_mark ?? 80);
    if (!s.passed) {
      this.b.rawUpdate('enrolments', enrolmentId, { status: 'in_progress', progress_pct: Math.max(e.progress_pct ?? 0, 90), score: s.score });
      return this.done<R>('academy.complete', 'enrolments', enrolmentId, `${course.code} not passed: ${s.score}%`, null, null, '', `Not passed: ${s.score}% (pass mark ${course.pass_mark ?? 80}%). Review the modules and try again.`, { score: s.score, passed: false, certificate_no: null }, ['enrolments']);
    }
    const issued = todayIso();
    const certNo = `SA-${issued.slice(0, 4)}-${newId('x').slice(2, 10).toUpperCase()}`;
    const person = this.b.rawGet('people', me);
    this.b.rawInsert('certificates', { id: certNo, person_id: me, org_id: e.org_id ?? person?.org_id ?? null, holder_initials: person?.initials || '—', course_id: course.id, issued_on: issued, valid_to: certificateValidTo(issued, course.validity_months), status: 'valid' });
    this.b.rawUpdate('enrolments', enrolmentId, { status: 'completed', progress_pct: 100, completed_at: nowIso(), score: s.score, certificate_no: certNo });
    return this.done<R>('academy.complete', 'enrolments', enrolmentId, `${course.code} passed ${s.score}%; ${certNo}`, null, 'kafaa.academy.certificate', `Supplier academy ${course.code} certificate ${certNo}`, `Passed with ${s.score}%. Certificate ${certNo} issued.`, { score: s.score, passed: true, certificate_no: certNo }, ['enrolments', 'certificates']);
  }

  // ───────────── M11 skills-gap planning
  async saveSkillGapPlan(plan: GapPlanInput) {
    await this.b.whenReady();
    type R = { id: string };
    const role = (['hr_director', 'hr_analyst'] as PlatformRole[]).find((r) => this.b.identity().roles.includes(r)) ?? null;
    if (!role) return this.refuse<R>('future.gap_plan', 'skill_gap_plans', plan?.id ?? null, 'forbidden', 'Only HR (analyst or CHCO office) may plan skills gaps');
    const problems = validGapPlan(plan);
    if (problems.length) return this.refuse<R>('future.gap_plan', 'skill_gap_plans', plan?.id ?? null, 'invalid', `Check: ${problems.join(', ')}`, role);
    if (!this.b.raw('future_skills').some((f) => f.skill_key === plan.skill_key)) return this.refuse<R>('future.gap_plan', 'skill_gap_plans', null, 'not_found', 'Unknown skill', role);
    const status = plan.status ?? 'draft';
    if (!['draft', 'active', 'done'].includes(status)) return this.refuse<R>('future.gap_plan', 'skill_gap_plans', null, 'invalid', 'Unknown status', role);
    const row = { skill_key: plan.skill_key, scenario: plan.scenario, action: plan.action, owner_role: plan.owner_role.trim(), target_quarter: plan.target_quarter, status, note: String(plan.note ?? '').slice(0, 500) };
    let id = plan.id ?? null;
    if (id && this.b.rawGet('skill_gap_plans', id)) this.b.rawUpdate('skill_gap_plans', id, { ...row, updated_at: nowIso() } as Partial<RowOf<'skill_gap_plans'>>);
    else {
      id = newId('gp');
      this.b.rawInsert('skill_gap_plans', { id, ...row, created_by: this.me } as Partial<RowOf<'skill_gap_plans'>>);
    }
    return this.done<R>('future.gap_plan', 'skill_gap_plans', id, `${plan.skill_key} ${plan.action} ${plan.target_quarter} (${status}; SIMULATED scenario)`, role, null, '', 'Plan saved', { id });
  }
}
