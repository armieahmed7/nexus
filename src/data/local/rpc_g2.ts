/**
 * G2 RPCs for the LocalBackend (M04 learning and training, M05 assessments): 1:1 mirror of
 * supabase/migrations/20261008132001_kafaa_g2_learning.sql. Same checks, refusal codes, audit rows and ledger behaviour.
 * Rules shared with pages live in src/domain/learning.ts. Secure item text never goes into an audit reason.
 */
import type { LocalBackend } from './LocalBackend';
import type { Result, RowOf } from '../types';
import type { G2Rpc, DeliveredItem, AttemptFeedback, ItemInput } from '../rpc_g2';
import type { Level, PlatformRole } from '../../auth/policy';
import { isoDate, todayIso } from '../../domain/rules';
import {
  appealWindow, attemptDeadline, canOpenAttempt, evaluationGate, holdsSeat, initialEnrolmentStatus, isLate, isOpen, missingPrerequisites,
  nextCertificateNo, retakeEligibility, scoreAnswers, seatDecision,
} from '../../domain/learning';
import { newId } from './store';

const addMonths = (d: string, m: number) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCMonth(x.getUTCMonth() + m);
  return isoDate(x);
};
const RETAKE_MESSAGES: Record<string, string> = {
  result_pending: 'A previous attempt is scheduled, in progress or not yet released',
  already_passed: 'This candidate has already passed this exam',
  retake_limit: 'The maximum number of attempts for this standard has been reached',
  retake_wait: 'The retake waiting period has not ended',
};

export function makeG2LocalRpc(b: LocalBackend): G2Rpc {
  const ctx = () => b.access();
  const me = () => b.identity().personId;
  const now = () => new Date().toISOString();
  const refuse = async <T = unknown>(action: string, table: string | null, entity: string | null, code: string, message: string, role: string | null = null): Promise<Result<T>> => {
    const a = await b.audit(action, table, entity, 'refused', `${code}: ${message}`, 'not_applicable', null, role);
    return { ok: false, code, message, audit_seq: a.seq as number };
  };
  const done = async <T>(action: string, table: string, entity: string | null, reason: string | null, role: string | null, ledgerAction: string | null, ledgerReason: string, message: string, data?: T, tables: string[] = [table]): Promise<Result<T>> => {
    const l = ledgerAction ? await b.ledger(ledgerAction, ledgerReason) : null;
    const a = await b.audit(action, table, entity, 'ok', reason, ledgerAction ? (l == null ? 'skipped' : 'written') : 'not_applicable', l, role);
    b.changed(tables as never);
    return { ok: true, code: 'ok', message, data, audit_seq: a.seq as number, ledger_seq: l };
  };
  const acting = (res: string, levels: Level[]) => ctx().actingRole(res, levels);
  /** Manager-level scope over a person (team, crew, family, entity), as kafaa_in_scope on qualification records or plans. */
  const inScope = (personId: string) => ctx().inScope('qual_records', personId) || ctx().inScope('dev_plans', personId);
  const taken = (sessionId: string) => b.raw('enrolments').filter((e) => e.session_id === sessionId && holdsSeat(e.status)).length;
  const completedCourses = (personId: string) => [
    ...b.raw('training_records').filter((r) => r.person_id === personId && ['passed', 'completed', 'attended'].includes(r.result)).map((r) => r.course_id),
    ...b.raw('enrolments').filter((e) => e.person_id === personId && e.status === 'completed').map((e) => e.course_id),
  ];

  return {
    // ───────────── M04 enrolment
    async enrolCourse(courseId, sessionId, personId) {
      await b.whenReady();
      type R = { id: string; status: string };
      const caller = me();
      if (!caller) return refuse<R>('enrolment.enrol', 'enrolments', courseId, 'not_signed_in', 'Sign in to enrol');
      const c = ctx();
      const target = personId || caller;
      const self = target === caller;
      const course = b.rawGet('courses', courseId);
      if (!course) return refuse<R>('enrolment.enrol', 'enrolments', courseId, 'not_found', 'Course not found');
      const pe = b.rawGet('people', target);
      if (!pe) return refuse<R>('enrolment.enrol', 'enrolments', courseId, 'not_found', 'Person not found');
      const supplierCourse = course.audience === 'supplier' || course.audience === 'contractor';
      let role: string | null;
      let source: RowOf<'enrolments'>['source'];
      if (self) {
        role = acting('training', ['Own', 'OwnOrg', 'W', 'A']);
        if (!role) return refuse<R>('enrolment.enrol', 'enrolments', courseId, 'forbidden', 'Training enrolment is not available for your role');
        source = 'self';
      } else if (c.has('training', ['W'])) {
        role = acting('training', ['W']);
        source = 'coordinator';
      } else if (c.has('training', ['A']) && inScope(target)) {
        role = acting('training', ['A']);
        source = 'manager';
      } else if (c.has('training', ['OwnOrg']) && pe.org_id && pe.org_id === b.identity().orgId && supplierCourse) {
        role = acting('training', ['OwnOrg']);
        source = 'partner_admin';
      } else return refuse<R>('enrolment.enrol', 'enrolments', courseId, 'forbidden', 'You cannot enrol this person');
      if (course.audience === 'staff' && pe.kind !== 'staff') return refuse<R>('enrolment.enrol', 'enrolments', courseId, 'invalid', 'This course is for ENEC staff', role);
      let session: RowOf<'sessions'> | undefined;
      if (sessionId) {
        session = b.rawGet('sessions', sessionId);
        if (!session || session.course_id !== courseId) return refuse<R>('enrolment.enrol', 'enrolments', courseId, 'not_found', 'Session not found for this course', role);
        if (session.status !== 'scheduled') return refuse<R>('enrolment.enrol', 'enrolments', courseId, 'invalid', 'This session is not open for enrolment', role);
        if (session.starts_at <= now()) return refuse<R>('enrolment.enrol', 'enrolments', courseId, 'invalid', 'This session has already started', role);
      }
      const missing = missingPrerequisites(course.prerequisites ?? [], completedCourses(target));
      if (missing.length) {
        const codes = missing.map((m) => b.rawGet('courses', m)?.code ?? m).join(', ');
        return refuse<R>('enrolment.enrol', 'enrolments', courseId, 'prerequisite', `Complete the prerequisites first: ${codes}`, role);
      }
      const ex = b.raw('enrolments').find((e) => e.person_id === target && e.course_id === courseId && isOpen(e.status));
      if (ex) {
        if (ex.status === 'requested') return refuse<R>('enrolment.enrol', 'enrolments', ex.id, 'conflict', 'A request for this course is already waiting for approval', role);
        if (ex.session_id && ex.session_id === sessionId) return refuse<R>('enrolment.enrol', 'enrolments', ex.id, 'conflict', 'Already booked on this session', role);
        if (ex.session_id) return refuse<R>('enrolment.enrol', 'enrolments', ex.id, 'conflict', 'Already booked on another session of this course; withdraw from it first', role);
        if (!sessionId) return refuse<R>('enrolment.enrol', 'enrolments', ex.id, 'conflict', 'Already enrolled in this course', role);
        const status = seatDecision(session!.capacity, taken(sessionId));
        b.rawUpdate('enrolments', ex.id, { session_id: sessionId, status, waitlisted_at: status === 'waitlisted' ? now() : null });
        return done<R>('enrolment.book', 'enrolments', ex.id, `${course.code} ${status} ${sessionId}`, role, null, '', status === 'waitlisted' ? 'Added to the waitlist' : 'Seat booked', { id: ex.id, status });
      }
      const status = initialEnrolmentStatus({ self, mandatory: course.mandatory, assigned: false, supplierCourse, hasSession: !!sessionId, capacity: session?.capacity ?? 0, taken: sessionId ? taken(sessionId) : 0 });
      const id = newId('en');
      b.rawInsert('enrolments', {
        id, person_id: target, course_id: courseId, session_id: sessionId ?? null, org_id: pe.org_id ?? null, status, source, assigned_by: self ? null : caller,
        due_on: null, enrolled_at: now(), progress_pct: 0, waitlisted_at: status === 'waitlisted' ? now() : null,
      });
      const msg = status === 'requested' ? 'Request sent to your manager for approval' : status === 'waitlisted' ? 'Added to the waitlist' : 'Enrolled';
      return done<R>(status === 'requested' ? 'enrolment.request' : 'enrolment.enrol', 'enrolments', id, `${course.code} ${status}${sessionId ? ` ${sessionId}` : ''}`, role, null, '', msg, { id, status });
    },

    async decideEnrolment(id, decision, note) {
      await b.whenReady();
      type R = { status: string };
      const caller = me();
      const c = ctx();
      const role = acting('training', ['A']);
      if (!role || !caller) return refuse<R>('enrolment.decide', 'enrolments', id, 'forbidden', 'Only a manager or the training manager may approve training');
      const e = b.rawGet('enrolments', id);
      if (!e) return refuse<R>('enrolment.decide', 'enrolments', id, 'not_found', 'Enrolment not found', role);
      if (e.person_id === caller) return refuse<R>('enrolment.decide', 'enrolments', id, 'maker_checker', 'You cannot approve your own training request', role);
      if (!c.roleGrant('training_manager', 'training', 'A') && !inScope(e.person_id)) return refuse<R>('enrolment.decide', 'enrolments', id, 'not_found', 'Enrolment not found in your team', role);
      if (e.status !== 'requested') return refuse<R>('enrolment.decide', 'enrolments', id, 'invalid', 'This enrolment is not awaiting a decision', role);
      if (!['approve', 'reject'].includes(decision)) return refuse<R>('enrolment.decide', 'enrolments', id, 'invalid', 'Unknown decision', role);
      if (decision === 'reject' && (note ?? '').trim().length < 5) return refuse<R>('enrolment.decide', 'enrolments', id, 'invalid', 'Give a reason for the rejection', role);
      let status: RowOf<'enrolments'>['status'] = 'cancelled';
      let sessionId = e.session_id;
      if (decision === 'approve') {
        const s = e.session_id ? b.rawGet('sessions', e.session_id) : undefined;
        if (s && s.status === 'scheduled' && s.starts_at > now()) status = seatDecision(s.capacity, taken(s.id));
        else if (s) {
          status = 'approved';
          sessionId = null;
        } else status = 'enrolled';
      }
      b.rawUpdate('enrolments', id, { status, session_id: sessionId, decided_by: caller, decision_note: note || null, waitlisted_at: status === 'waitlisted' ? now() : null });
      const co = b.rawGet('courses', e.course_id);
      return done<R>('enrolment.decide', 'enrolments', id, `${decision}: ${status}`, role, 'kafaa.training.enrolment_decision', `Enrolment ${id} (${co?.code ?? e.course_id}) ${decision}`, decision === 'approve' ? 'Approved' : 'Rejected', { status });
    },

    async sessionAvailability(courseId) {
      await b.whenReady();
      if (!ctx().has('training', ['Own', 'OwnOrg', 'W', 'A', 'R'])) return { ok: false, code: 'forbidden', message: 'Sign in to see sessions' };
      const data = b.raw('sessions').filter((x) => x.course_id === courseId).map((x) => ({ session_id: x.id, capacity: x.capacity, taken: taken(x.id), waiting: b.raw('enrolments').filter((e) => e.session_id === x.id && e.status === 'waitlisted').length }));
      return { ok: true, code: 'ok', message: 'ok', data };
    },

    async cancelEnrolment(id, reason) {
      await b.whenReady();
      type R = { status: string; promoted: string | null };
      const caller = me();
      const c = ctx();
      if (!caller) return refuse<R>('enrolment.cancel', 'enrolments', id, 'not_signed_in', 'Sign in first');
      const e = b.rawGet('enrolments', id);
      if (!e) return refuse<R>('enrolment.cancel', 'enrolments', id, 'not_found', 'Enrolment not found');
      const self = e.person_id === caller;
      const coord = c.has('training', ['W']) || c.roleGrant('training_manager', 'training', 'A') || (c.has('training', ['A']) && inScope(e.person_id));
      if (!self && !coord) return refuse<R>('enrolment.cancel', 'enrolments', id, 'not_found', 'Enrolment not found');
      const role = self && !coord ? acting('training', ['Own', 'OwnOrg']) : acting('training', ['W', 'A']);
      if (!isOpen(e.status)) return refuse<R>('enrolment.cancel', 'enrolments', id, 'invalid', 'This enrolment is already finished or cancelled', role);
      const course = b.rawGet('courses', e.course_id);
      const mandatory = e.source === 'role_rule' || !!course?.mandatory;
      let status: RowOf<'enrolments'>['status'];
      if (self && !coord) {
        if (mandatory && !e.session_id) return refuse<R>('enrolment.cancel', 'enrolments', id, 'invalid', 'Mandatory training cannot be cancelled; you can only change the session', role);
        status = mandatory ? 'assigned' : 'cancelled';
      } else {
        if (!self && (reason ?? '').trim().length < 5) return refuse<R>('enrolment.cancel', 'enrolments', id, 'invalid', 'Give a reason', role);
        status = mandatory && e.session_id ? 'assigned' : 'cancelled';
      }
      const freed = holdsSeat(e.status) && e.session_id ? e.session_id : null;
      b.rawUpdate('enrolments', id, { status, session_id: status === 'assigned' ? null : e.session_id, attendance: null, waitlisted_at: null, decided_by: caller, decision_note: reason || null });
      let promoted: string | null = null;
      if (freed) {
        const next = b.raw('enrolments').filter((x) => x.session_id === freed && x.status === 'waitlisted').sort((x, y) => String(x.waitlisted_at ?? x.enrolled_at).localeCompare(String(y.waitlisted_at ?? y.enrolled_at)))[0];
        if (next) {
          b.rawUpdate('enrolments', next.id, { status: 'enrolled', waitlisted_at: null });
          promoted = next.id;
        }
      }
      return done<R>('enrolment.cancel', 'enrolments', id, `${status}${promoted ? `; promoted ${promoted} from the waitlist` : ''}`, role, null, '', status === 'assigned' ? 'Withdrawn from the session; the assignment stays open' : 'Cancelled', { status, promoted });
    },

    async recordAttendance(sessionId, marks) {
      await b.whenReady();
      type R = { updated: number };
      const role = acting('training', ['W', 'A']);
      if (!role) return refuse<R>('session.attendance', 'sessions', sessionId, 'forbidden', 'Only an instructor may record attendance');
      const s = b.rawGet('sessions', sessionId);
      if (!s) return refuse<R>('session.attendance', 'sessions', sessionId, 'not_found', 'Session not found', role);
      if (s.starts_at > now()) return refuse<R>('session.attendance', 'sessions', sessionId, 'invalid', 'Attendance can be recorded once the session has started', role);
      let updated = 0;
      for (const m of marks ?? []) {
        const e = b.rawGet('enrolments', m.enrolment_id);
        if (!e || e.session_id !== sessionId || !['enrolled', 'in_progress'].includes(e.status)) continue;
        if (!['present', 'absent', 'excused'].includes(m.attendance)) continue;
        b.rawUpdate('enrolments', e.id, { attendance: m.attendance, status: m.attendance === 'present' && e.status === 'enrolled' ? 'in_progress' : e.status });
        updated++;
      }
      if (!updated) return refuse<R>('session.attendance', 'sessions', sessionId, 'invalid', 'No enrolment on this session could be marked', role);
      return done<R>('session.attendance', 'enrolments', sessionId, `${updated} marked`, role, null, '', `Attendance recorded for ${updated}`, { updated });
    },

    async completeEnrolment(id, result, score, note) {
      await b.whenReady();
      type R = { status: string; certificate_no: string | null; record_id: string | null };
      const caller = me();
      const c = ctx();
      if (!caller) return refuse<R>('training.complete', 'enrolments', id, 'not_signed_in', 'Sign in first');
      const e = b.rawGet('enrolments', id);
      if (!e) return refuse<R>('training.complete', 'enrolments', id, 'not_found', 'Enrolment not found');
      const course = b.rawGet('courses', e.course_id)!;
      let role: string | null;
      if (e.person_id === caller) {
        const selfPaced = course.modality === 'elearning' && !course.qualifying && result === 'completed' && e.progress_pct >= 100;
        if (!selfPaced) return refuse<R>('training.complete', 'enrolments', id, c.has('training', ['W', 'A']) ? 'self_sign' : 'forbidden', 'You cannot record completion of your own training; an instructor records it', acting('training', ['W', 'A', 'Own']));
        role = acting('training', ['Own', 'OwnOrg']);
      } else {
        role = acting('training', ['W', 'A']);
        if (!role) return refuse<R>('training.complete', 'enrolments', id, 'forbidden', 'Only an instructor or the training manager records completion');
      }
      if (!['enrolled', 'in_progress', 'assigned'].includes(e.status)) return refuse<R>('training.complete', 'enrolments', id, 'invalid', 'This enrolment is not active', role);
      if (!['passed', 'failed', 'completed'].includes(result)) return refuse<R>('training.complete', 'enrolments', id, 'invalid', 'Result must be passed, failed or completed', role);
      const session = e.session_id ? b.rawGet('sessions', e.session_id) : undefined;
      if (session && session.kind !== 'elearning' && e.attendance !== 'present') return refuse<R>('training.complete', 'enrolments', id, 'invalid', 'Record attendance first: completion needs evidence of attendance', role);
      let evaluationId: string | null = null;
      let finalScore = score;
      if (course.qualifying) {
        if (result === 'completed') return refuse<R>('training.complete', 'enrolments', id, 'invalid', 'A qualifying course completes as passed or failed', role);
        if (result === 'passed') {
          const gate = evaluationGate(course, b.raw('attempts').filter((a) => a.person_id === e.person_id));
          if (!gate.ok) {
            const why = gate.code === 'no_form' ? 'no linked evaluation is defined for this course' : gate.code === 'evaluation_failed' ? 'the linked evaluation was not passed' : 'the linked evaluation has not been passed and released';
            return refuse<R>('training.complete', 'enrolments', id, 'evaluation_required', `A qualifying course cannot complete without its linked evaluation: ${why}`, role);
          }
          evaluationId = gate.attempt?.id ?? null;
          finalScore = gate.attempt?.score ?? score;
        }
      } else if (result === 'passed' && course.pass_mark != null && (finalScore == null || finalScore < course.pass_mark)) {
        return refuse<R>('training.complete', 'enrolments', id, 'invalid', `A pass needs a score of at least ${course.pass_mark}`, role);
      }
      const today = todayIso();
      const status: RowOf<'enrolments'>['status'] = result === 'failed' ? 'failed' : 'completed';
      const recId = newId('tr');
      b.rawInsert('training_records', {
        id: recId, person_id: e.person_id, course_id: e.course_id, completed_on: today, hours: course.duration_hours ?? 0,
        result: result === 'completed' ? (e.attendance === 'present' ? 'attended' : 'completed') : result, source_system: "Kafa'a (pending sync to the training records system)", evaluation_id: evaluationId, enrolment_id: id,
      });
      let cert: string | null = null;
      if (result === 'passed') {
        const pe = b.rawGet('people', e.person_id);
        cert = nextCertificateNo(b.raw('certificates').map((x) => x.id), Number(today.slice(0, 4)));
        b.rawInsert('certificates', {
          id: cert, person_id: e.person_id, org_id: pe?.org_id ?? null, holder_initials: pe?.initials || '—', course_id: e.course_id, issued_on: today,
          valid_to: course.validity_months ? addMonths(today, course.validity_months) : null, status: 'valid', enrolment_id: id, issued_by: caller,
        });
      }
      b.rawUpdate('enrolments', id, { status, completed_at: now(), score: finalScore ?? null, certificate_no: cert, evaluation_id: evaluationId, progress_pct: result === 'failed' ? e.progress_pct : 100, decision_note: note || e.decision_note });
      const material = result === 'passed' && course.qualifying;
      return done<R>('training.complete', 'enrolments', id, `${course.code} ${result}${cert ? ` certificate ${cert}` : ''}`, role, material ? 'kafaa.training.complete' : null,
        `${course.code} ${result} for ${e.person_id}${cert ? `; certificate ${cert}` : ''}`, result === 'passed' ? 'Passed: certificate issued' : result === 'failed' ? 'Recorded as not passed' : 'Completion recorded',
        { status, certificate_no: cert, record_id: recId }, ['enrolments', 'training_records', 'certificates']);
    },

    async decideExternalRequest(id, decision, note) {
      await b.whenReady();
      const caller = me();
      const c = ctx();
      const role = acting('training', ['A']);
      if (!role || !caller) return refuse('external.decide', 'external_requests', id, 'forbidden', 'Only a manager or the training manager may decide external requests');
      const x = b.rawGet('external_requests', id);
      if (!x) return refuse('external.decide', 'external_requests', id, 'not_found', 'Request not found', role);
      if (x.person_id === caller) return refuse('external.decide', 'external_requests', id, 'maker_checker', 'You cannot approve your own request', role);
      if (!c.roleGrant('training_manager', 'training', 'A') && !inScope(x.person_id)) return refuse('external.decide', 'external_requests', id, 'not_found', 'Request not found in your team', role);
      if (x.status !== 'requested') return refuse('external.decide', 'external_requests', id, 'invalid', 'This request is not awaiting a decision', role);
      if (!['approved', 'rejected'].includes(decision)) return refuse('external.decide', 'external_requests', id, 'invalid', 'Unknown decision', role);
      if (decision === 'rejected' && (note ?? '').trim().length < 5) return refuse('external.decide', 'external_requests', id, 'invalid', 'Give a reason for the rejection', role);
      b.rawUpdate('external_requests', id, { status: decision, approver_person_id: caller, decided_at: now(), decision_note: note || null });
      return done('external.decide', 'external_requests', id, decision, role, 'kafaa.training.external_request', `External course request ${id}: ${decision}`, decision === 'approved' ? 'Approved' : 'Rejected');
    },

    async curriculumSync(personId) {
      await b.whenReady();
      type R = { people: number; assigned: number; withdrawn: number };
      const c = ctx();
      const role = acting('training', ['W', 'A']) ?? (c.has('users_roles', ['W']) ? 'admin' : null);
      if (!role) return refuse<R>('curriculum.sync', 'enrolments', personId ?? 'all', 'forbidden', 'Only training administrators run the curriculum sync');
      let people = b.raw('people').filter((p) => p.kind === 'staff' && p.status === 'active' && p.job_role_id);
      if (personId) {
        people = people.filter((p) => p.id === personId);
        if (!people.length) return refuse<R>('curriculum.sync', 'enrolments', personId, 'not_found', 'Person or role not found', role);
      }
      const today = todayIso();
      let assigned = 0;
      let withdrawn = 0;
      const rules = b.raw('curriculum_rules');
      for (const pe of people) {
        const required = rules.filter((r) => r.role_id === pe.job_role_id && r.mandatory);
        const req = new Set(required.map((r) => r.course_id));
        for (const r of required) {
          if (b.raw('enrolments').some((e) => e.person_id === pe.id && e.course_id === r.course_id && !['cancelled', 'failed'].includes(e.status))) continue;
          const due = new Date(`${today}T00:00:00Z`);
          due.setUTCDate(due.getUTCDate() + r.due_within_days);
          b.rawInsert('enrolments', { id: newId('en'), person_id: pe.id, course_id: r.course_id, status: 'assigned', source: 'role_rule', assigned_by: 'Curriculum rule', due_on: isoDate(due), org_id: pe.org_id ?? null });
          assigned++;
        }
        for (const e of b.raw('enrolments').filter((x) => x.person_id === pe.id && x.source === 'role_rule' && x.status === 'assigned' && !x.session_id && !req.has(x.course_id))) {
          b.rawUpdate('enrolments', e.id, { status: 'cancelled', decision_note: `Withdrawn by curriculum sync: not required for ${pe.job_role_id}` });
          withdrawn++;
        }
      }
      return done<R>('curriculum.sync', 'enrolments', personId ?? 'all', `${people.length} people, ${assigned} assigned, ${withdrawn} withdrawn`, role, null, '', `Sync complete: ${assigned} assigned, ${withdrawn} withdrawn`, { people: people.length, assigned, withdrawn });
    },

    async decideDevPlan(planId, decision, note) {
      await b.whenReady();
      const caller = me();
      const role = acting('dev_plans', ['A']);
      if (!role || !caller) return refuse('devplan.decide', 'dev_plans', planId, 'forbidden', 'Only a line manager may approve a development plan');
      const p = b.rawGet('dev_plans', planId);
      if (!p) return refuse('devplan.decide', 'dev_plans', planId, 'not_found', 'Plan not found', role);
      if (p.person_id === caller) return refuse('devplan.decide', 'dev_plans', planId, 'maker_checker', 'You cannot approve your own plan', role);
      if (!ctx().inScope('dev_plans', p.person_id)) return refuse('devplan.decide', 'dev_plans', planId, 'not_found', 'Plan not found in your team', role);
      if (p.status !== 'submitted') return refuse('devplan.decide', 'dev_plans', planId, 'invalid', 'This plan is not awaiting approval', role);
      if (!['approve', 'return'].includes(decision)) return refuse('devplan.decide', 'dev_plans', planId, 'invalid', 'Unknown decision', role);
      if (decision === 'return' && (note ?? '').trim().length < 5) return refuse('devplan.decide', 'dev_plans', planId, 'invalid', 'Say what needs to change', role);
      b.rawUpdate('dev_plans', planId, { status: decision === 'approve' ? 'active' : 'draft', approved_by: decision === 'approve' ? caller : p.approved_by, decision_note: note || null, decided_at: now() });
      return done('devplan.decide', 'dev_plans', planId, decision, role, decision === 'approve' ? 'kafaa.devplan.approve' : null, `Development plan ${planId} approved`, decision === 'approve' ? 'Plan approved' : 'Plan returned');
    },

    async respondMentoring(requestId, decision) {
      await b.whenReady();
      const caller = me();
      const role = acting('dev_plans', ['Own', 'Scope', 'A']);
      if (!caller || !role) return refuse('mentoring.respond', 'mentoring_requests', requestId, 'forbidden', 'Mentoring is for staff');
      const r = b.rawGet('mentoring_requests', requestId);
      if (!r) return refuse('mentoring.respond', 'mentoring_requests', requestId, 'not_found', 'Request not found', role);
      const mentor = r.mentor_id ? b.rawGet('mentors', r.mentor_id) : undefined;
      const mentorPerson = r.mentor_person_id ?? mentor?.person_id ?? null;
      if (decision === 'closed') {
        if (caller !== r.person_id && caller !== mentorPerson) return refuse('mentoring.respond', 'mentoring_requests', requestId, 'not_found', 'Request not found', role);
        if (['closed', 'declined'].includes(r.status)) return refuse('mentoring.respond', 'mentoring_requests', requestId, 'invalid', 'Already closed', role);
      } else if (decision === 'matched' || decision === 'declined') {
        if (caller !== mentorPerson) return refuse('mentoring.respond', 'mentoring_requests', requestId, 'forbidden', 'Only the mentor can accept or decline', role);
        if (r.status !== 'requested') return refuse('mentoring.respond', 'mentoring_requests', requestId, 'invalid', 'This request is not waiting for a response', role);
        if (decision === 'matched' && mentor && b.raw('mentoring_requests').filter((x) => x.mentor_id === mentor.id && x.status === 'matched').length >= mentor.capacity)
          return refuse('mentoring.respond', 'mentoring_requests', requestId, 'conflict', 'You have no free mentoring capacity; raise it or close a match first', role);
      } else return refuse('mentoring.respond', 'mentoring_requests', requestId, 'invalid', 'Unknown decision', role);
      b.rawUpdate('mentoring_requests', requestId, { status: decision, responded_at: now() });
      return done('mentoring.respond', 'mentoring_requests', requestId, decision, role, null, '', decision === 'matched' ? 'Match confirmed' : decision === 'declined' ? 'Request declined' : 'Closed');
    },

    // ───────────── M05 item bank
    async saveItem(p: ItemInput) {
      await b.whenReady();
      type R = { id: string; version: number };
      const caller = me();
      const role = acting('secure_items', ['W', 'A']);
      if (!role || !caller) return refuse<R>('item.save', 'items', p?.id ?? null, 'forbidden', 'Item bank access required');
      const opts = Array.isArray(p.options) ? p.options : [];
      const ids = opts.map((o) => o.id);
      if (!p.stem_en?.trim() || !p.stem_ar?.trim()) return refuse<R>('item.save', 'items', p.id ?? null, 'invalid', 'The stem is required in English and Arabic', role);
      if (opts.length < 2 || opts.length > 6 || new Set(ids).size !== ids.length || opts.some((o) => !o.en?.trim() || !o.ar?.trim())) return refuse<R>('item.save', 'items', p.id ?? null, 'invalid', 'Give 2 to 6 distinct options in both languages', role);
      if (!ids.includes(p.answer)) return refuse<R>('item.save', 'items', p.id ?? null, 'invalid', 'The key must be one of the options', role);
      if (!['secure', 'practice'].includes(p.bank) || !['easy', 'medium', 'hard'].includes(p.difficulty)) return refuse<R>('item.save', 'items', p.id ?? null, 'invalid', 'Unknown bank or difficulty', role);
      let id = p.id ?? '';
      let version = 1;
      if (p.id) {
        const i = b.rawGet('items', p.id);
        if (!i) return refuse<R>('item.save', 'items', p.id, 'not_found', 'Item not found', role);
        if (i.status === 'retired') return refuse<R>('item.save', 'items', p.id, 'invalid', 'Retired items cannot be edited', role);
        version = i.current_version + 1;
        b.rawUpdate('items', p.id, { current_version: version, status: 'draft', writer_person_id: caller, reviewer_person_id: null, approver_person_id: null, topic: p.topic ?? i.topic, competency_id: p.competency_id ?? null, difficulty: p.difficulty, reference: p.reference ?? null });
      } else {
        id = newId('it');
        b.rawInsert('items', { id, bank: p.bank, is_practice: p.bank === 'practice', competency_id: p.competency_id ?? null, task_id: null, topic: p.topic ?? '', difficulty: p.difficulty, reference: p.reference ?? null, current_version: 1, status: 'draft', writer_person_id: caller });
      }
      const it = b.rawGet('items', id)!;
      b.rawInsert('item_versions', { id: `${id}-v${version}`, item_id: id, version, is_practice: it.is_practice, stem_en: p.stem_en.trim(), stem_ar: p.stem_ar.trim(), options: opts, answer: p.answer, rationale_en: p.rationale_en ?? '', rationale_ar: p.rationale_ar ?? '', author_person_id: caller, change_note: p.change_note || null });
      // Audit reason carries the version and bank only: secure item text never enters the log.
      return done<R>('item.save', 'items', id, `v${version} saved (${it.bank})`, role, null, '', version === 1 ? 'Draft item created' : `Version ${version} saved as a draft`, { id, version }, ['items', 'item_versions']);
    },

    async retireItem(itemId, reason) {
      await b.whenReady();
      const role = acting('secure_items', ['A']);
      if (!role) return refuse('item.retire', 'items', itemId, 'forbidden', 'Only the training manager may retire items');
      const i = b.rawGet('items', itemId);
      if (!i) return refuse('item.retire', 'items', itemId, 'not_found', 'Item not found', role);
      if (i.status === 'retired') return refuse('item.retire', 'items', itemId, 'invalid', 'Already retired', role);
      if ((reason ?? '').trim().length < 5) return refuse('item.retire', 'items', itemId, 'invalid', 'Give a reason', role);
      b.rawUpdate('items', itemId, { status: 'retired' });
      return done('item.retire', 'items', itemId, 'retired', role, null, '', 'Item retired');
    },

    // ───────────── M05 delivery and results
    async scheduleAttempt(formId, personId, scheduledFor, proctorPersonId) {
      await b.whenReady();
      type R = { id: string; attempt_no: number };
      const caller = me();
      const role = acting('secure_items', ['W', 'A']);
      if (!role || !caller) return refuse<R>('attempt.schedule', 'attempts', formId, 'forbidden', 'Only an instructor may schedule exams');
      const f = b.rawGet('assessment_forms', formId);
      if (!f) return refuse<R>('attempt.schedule', 'attempts', formId, 'not_found', 'Form not found', role);
      if (f.is_practice || f.status !== 'approved') return refuse<R>('attempt.schedule', 'attempts', formId, 'invalid', 'Only an approved exam form can be scheduled', role);
      if (!b.rawGet('people', personId)) return refuse<R>('attempt.schedule', 'attempts', formId, 'not_found', 'Candidate not found', role);
      if (personId === caller) return refuse<R>('attempt.schedule', 'attempts', formId, 'separation_of_duties', 'You cannot schedule your own exam', role);
      const proctor = proctorPersonId || caller;
      if (proctor === personId) return refuse<R>('attempt.schedule', 'attempts', formId, 'separation_of_duties', 'A candidate cannot proctor their own exam', role);
      const when = scheduledFor && !Number.isNaN(Date.parse(scheduledFor)) ? new Date(scheduledFor).toISOString() : '';
      if (!when) return refuse<R>('attempt.schedule', 'attempts', formId, 'invalid', 'Give a valid date and time', role);
      const el = retakeEligibility(f, b.raw('attempts').filter((a) => a.person_id === personId && a.form_id === formId), when);
      if (!el.ok) return refuse<R>('attempt.schedule', 'attempts', formId, el.code, el.code === 'retake_wait' ? `${RETAKE_MESSAGES.retake_wait}: earliest ${el.earliest}` : RETAKE_MESSAGES[el.code] ?? 'Not allowed', role);
      const id = newId('at');
      b.rawInsert('attempts', { id, form_id: formId, person_id: personId, scheduled_for: when, status: 'scheduled', proctor_person_id: proctor, released: false, attempt_no: el.attemptNo, retake_of: el.retakeOf ?? null });
      return done<R>('attempt.schedule', 'attempts', id, `${formId} attempt ${el.attemptNo}`, role, null, '', el.attemptNo > 1 ? `Retake scheduled (attempt ${el.attemptNo})` : 'Exam scheduled', { id, attempt_no: el.attemptNo });
    },

    async startAttempt(attemptId) {
      await b.whenReady();
      type R = { deadline_at: string; time_limit_min: number; items: DeliveredItem[] };
      const caller = me();
      const a = b.rawGet('attempts', attemptId);
      if (!caller || !a || a.person_id !== caller) return refuse<R>('attempt.start', 'attempts', attemptId, 'not_found', 'Exam not found');
      const role = acting('qual_records', ['Own']) ?? acting('training', ['Own', 'OwnOrg']);
      const f = b.rawGet('assessment_forms', a.form_id)!;
      if (f.kind !== 'written') return refuse<R>('attempt.start', 'attempts', attemptId, 'invalid', 'This evaluation is recorded by an evaluator, not taken online', role);
      let deadline = a.deadline_at;
      if (a.status === 'in_progress') {
        if (deadline && isLate(deadline, new Date())) return refuse<R>('attempt.start', 'attempts', attemptId, 'invalid', 'Time is up for this exam; submit your answers', role);
      } else if (a.status === 'scheduled') {
        if (!canOpenAttempt(a.scheduled_for)) return refuse<R>('attempt.start', 'attempts', attemptId, 'invalid', `This exam opens on ${String(a.scheduled_for).slice(0, 10)}`, role);
        const started = now();
        deadline = attemptDeadline(started, f.time_limit_min);
        b.rawUpdate('attempts', attemptId, { status: 'in_progress', started_at: started, deadline_at: deadline });
      } else return refuse<R>('attempt.start', 'attempts', attemptId, 'invalid', 'This exam is not open', role);
      const items: DeliveredItem[] = [];
      for (const itemId of f.item_ids) {
        const it = b.rawGet('items', itemId);
        if (!it || it.status === 'retired') continue;
        const v = b.raw('item_versions').find((x) => x.item_id === itemId && x.version === it.current_version);
        if (!v) continue;
        items.push({ item_id: itemId, version: v.version, stem_en: v.stem_en, stem_ar: v.stem_ar, options: (v.options as DeliveredItem['options']).map((o) => ({ id: o.id, en: o.en, ar: o.ar })) });
      }
      return done<R>('attempt.start', 'attempts', attemptId, `${f.id}: ${items.length} items delivered`, role, null, '', 'Exam started', { deadline_at: deadline!, time_limit_min: f.time_limit_min, items });
    },

    async submitAttempt(attemptId, answers) {
      await b.whenReady();
      type R = { late: boolean; answered: number };
      const caller = me();
      const a = b.rawGet('attempts', attemptId);
      if (!caller || !a || a.person_id !== caller) return refuse<R>('attempt.submit', 'attempts', attemptId, 'not_found', 'Exam not found');
      const role = acting('qual_records', ['Own']) ?? acting('training', ['Own', 'OwnOrg']);
      if (a.status !== 'in_progress') return refuse<R>('attempt.submit', 'attempts', attemptId, 'invalid', 'This exam is not in progress', role);
      const f = b.rawGet('assessment_forms', a.form_id)!;
      const given: Record<string, string | null> = {};
      for (const x of answers ?? []) if (f.item_ids.includes(x.item_id)) given[x.item_id] = x.answer;
      const key: Record<string, string> = {};
      const ver: Record<string, number> = {};
      for (const itemId of f.item_ids) {
        const it = b.rawGet('items', itemId);
        const v = it && b.raw('item_versions').find((x) => x.item_id === itemId && x.version === it.current_version);
        if (v) {
          key[itemId] = v.answer;
          ver[itemId] = v.version;
        }
      }
      const delivered = f.item_ids.filter((i) => key[i] !== undefined);
      for (const itemId of delivered) b.rawInsert('responses', { id: newId('rs'), attempt_id: attemptId, item_id: itemId, version: ver[itemId], answer: given[itemId] ?? '', correct: given[itemId] != null && given[itemId] === key[itemId] });
      const sc = scoreAnswers(delivered, given, key, a.voided_item_ids ?? []);
      const late = a.deadline_at ? isLate(a.deadline_at, new Date()) : false;
      const answered = delivered.filter((i) => given[i] != null && given[i] !== '').length;
      b.rawUpdate('attempts', attemptId, { status: 'graded', submitted_at: now(), score: sc.score, passed: sc.score >= f.pass_mark, late });
      return done<R>('attempt.submit', 'attempts', attemptId, `${answered}/${delivered.length} answered${late ? ' (late)' : ''}`, role, null, '', 'Submitted. Your result is released after an evaluator signs it off.', { late, answered }, ['attempts', 'responses']);
    },

    async releaseAttempt(attemptId, note) {
      await b.whenReady();
      type R = { passed: boolean | null; score: number | null };
      const caller = me();
      const role = acting('secure_items', ['W', 'A']) ?? acting('signoff', ['A']);
      if (!role || !caller) return refuse<R>('attempt.release', 'attempts', attemptId, 'forbidden', 'Only an evaluator may release results');
      const a = b.rawGet('attempts', attemptId);
      if (!a) return refuse<R>('attempt.release', 'attempts', attemptId, 'not_found', 'Attempt not found', role);
      if (a.person_id === caller) return refuse<R>('attempt.release', 'attempts', attemptId, 'self_sign', 'You cannot release your own result', role);
      if (a.status !== 'graded') return refuse<R>('attempt.release', 'attempts', attemptId, 'invalid', 'Only a graded attempt can be released', role);
      b.rawUpdate('attempts', attemptId, { status: 'released', released: true, released_by: caller, released_at: now(), evaluator_note: note || null });
      return done<R>('attempt.release', 'attempts', attemptId, a.passed ? 'pass' : 'fail', role, 'kafaa.assessment.release', `Assessment result ${attemptId} (${a.form_id}) released: ${a.passed ? 'pass' : 'not passed'}`, 'Result released to the candidate', { passed: a.passed ?? null, score: a.score ?? null });
    },

    async recordPerformance(formId, personId, passed, score, note) {
      await b.whenReady();
      type R = { id: string };
      const caller = me();
      const role = acting('signoff', ['A']);
      if (!role || !caller) return refuse<R>('performance.record', 'attempts', formId, 'forbidden', 'Only a qualified evaluator may record a performance evaluation');
      if (personId === caller) return refuse<R>('performance.record', 'attempts', formId, 'self_sign', 'An evaluator cannot evaluate themselves', role);
      const f = b.rawGet('assessment_forms', formId);
      if (!f) return refuse<R>('performance.record', 'attempts', formId, 'not_found', 'Form not found', role);
      if (f.kind === 'written' || f.is_practice) return refuse<R>('performance.record', 'attempts', formId, 'invalid', 'Written exams are taken by the candidate', role);
      if (!b.rawGet('people', personId)) return refuse<R>('performance.record', 'attempts', formId, 'not_found', 'Candidate not found', role);
      if ((note ?? '').trim().length < 5) return refuse<R>('performance.record', 'attempts', formId, 'invalid', 'Record the evidence in a short note', role);
      if (score != null && (score < 0 || score > 100)) return refuse<R>('performance.record', 'attempts', formId, 'invalid', 'Score must be 0 to 100', role);
      const prev = b.raw('attempts').filter((a) => a.person_id === personId && a.form_id === formId);
      const open = prev.find((a) => a.status === 'scheduled');
      const el = retakeEligibility(f, prev.filter((a) => a.id !== open?.id), new Date());
      if (!el.ok) return refuse<R>('performance.record', 'attempts', formId, el.code, el.code === 'retake_wait' ? `${RETAKE_MESSAGES.retake_wait}: earliest ${el.earliest}` : RETAKE_MESSAGES[el.code] ?? 'Not allowed', role);
      const t = now();
      const patch = { started_at: t, submitted_at: t, score, passed, status: 'released' as const, released: true, released_by: caller, released_at: t, evaluator_note: note, proctor_person_id: caller };
      let id: string;
      if (open) {
        id = open.id;
        b.rawUpdate('attempts', id, patch);
      } else {
        id = newId('at');
        b.rawInsert('attempts', { id, form_id: formId, person_id: personId, scheduled_for: t, attempt_no: el.attemptNo, retake_of: el.retakeOf ?? null, ...patch });
      }
      return done<R>('performance.record', 'attempts', id, `${formId} ${passed ? 'pass' : 'fail'}`, role, 'kafaa.assessment.performance', `Performance evaluation ${formId} for ${personId}: ${passed ? 'pass' : 'not passed'}`, 'Evaluation recorded', { id });
    },

    async attemptFeedback(attemptId) {
      await b.whenReady();
      const caller = me();
      const c = ctx();
      const a = b.rawGet('attempts', attemptId);
      const staffView = !!a && (c.has('secure_items', ['W', 'A']) || c.inScope('qual_records', a.person_id));
      if (!a || !(a.person_id === caller || staffView)) return { ok: false, code: 'not_found', message: 'Not found' };
      if (a.person_id === caller && !a.released) return { ok: false, code: 'invalid', message: 'Your result has not been released yet' };
      const f = b.rawGet('assessment_forms', a.form_id)!;
      const voided = new Set(a.voided_item_ids ?? []);
      const groups = new Map<string | null, { correct: number; total: number }>();
      let correct = 0;
      let total = 0;
      for (const r of b.raw('responses').filter((x) => x.attempt_id === attemptId && !voided.has(x.item_id))) {
        const comp = b.rawGet('items', r.item_id)?.competency_id ?? null;
        const g = groups.get(comp) ?? { correct: 0, total: 0 };
        g.total++;
        total++;
        if (r.correct) {
          g.correct++;
          correct++;
        }
        groups.set(comp, g);
      }
      const data: AttemptFeedback = { score: a.score ?? null, passed: a.passed ?? null, pass_mark: f.pass_mark, total, correct, by_competency: [...groups.entries()].map(([competency_id, g]) => ({ competency_id, ...g })) };
      return { ok: true, code: 'ok', message: 'ok', data };
    },

    async fileAppeal(attemptId, reason, itemId) {
      await b.whenReady();
      type R = { id: string };
      const caller = me();
      const a = b.rawGet('attempts', attemptId);
      if (!caller || !a || a.person_id !== caller) return refuse<R>('appeal.file', 'appeals', attemptId, 'not_found', 'Result not found');
      const role = acting('qual_records', ['Own']) ?? acting('training', ['Own', 'OwnOrg']);
      const f = b.rawGet('assessment_forms', a.form_id)!;
      const w = appealWindow(a, f.appeal_days);
      if (!w.open) return refuse<R>('appeal.file', 'appeals', attemptId, 'invalid', a.status !== 'released' ? 'You can appeal once the result is released' : `The appeal window closed on ${w.closesOn}`, role);
      if (b.raw('appeals').some((x) => x.attempt_id === attemptId && x.status === 'open')) return refuse<R>('appeal.file', 'appeals', attemptId, 'conflict', 'An appeal on this result is already open', role);
      if ((reason ?? '').trim().length < 10) return refuse<R>('appeal.file', 'appeals', attemptId, 'invalid', 'Explain the appeal in at least 10 characters', role);
      if (itemId && !f.item_ids.includes(itemId)) return refuse<R>('appeal.file', 'appeals', attemptId, 'invalid', 'That question is not on this exam', role);
      const id = newId('ap');
      b.rawInsert('appeals', { id, attempt_id: attemptId, person_id: caller, reason: reason.trim(), status: 'open', item_id: itemId ?? null, created_at: now() });
      return done<R>('appeal.file', 'appeals', id, `appeal on ${attemptId}`, role, null, '', 'Appeal filed; the training manager decides it', { id });
    },

    async decideAppeal(appealId, decision, note, voidItemIds) {
      await b.whenReady();
      type R = { score: number | null; passed: boolean | null };
      const caller = me();
      const role = acting('secure_items', ['A']);
      if (!role || !caller) return refuse<R>('appeal.decide', 'appeals', appealId, 'forbidden', 'Only the training manager decides appeals');
      const ap = b.rawGet('appeals', appealId);
      if (!ap) return refuse<R>('appeal.decide', 'appeals', appealId, 'not_found', 'Appeal not found', role);
      if (ap.status !== 'open') return refuse<R>('appeal.decide', 'appeals', appealId, 'invalid', 'This appeal is already decided', role);
      if (ap.person_id === caller) return refuse<R>('appeal.decide', 'appeals', appealId, 'maker_checker', 'You cannot decide your own appeal', role);
      const a = b.rawGet('attempts', ap.attempt_id)!;
      if (a.released_by === caller) return refuse<R>('appeal.decide', 'appeals', appealId, 'separation_of_duties', 'The evaluator who released the result cannot decide its appeal', role);
      if (!['upheld', 'rejected'].includes(decision)) return refuse<R>('appeal.decide', 'appeals', appealId, 'invalid', 'Unknown decision', role);
      if ((note ?? '').trim().length < 5) return refuse<R>('appeal.decide', 'appeals', appealId, 'invalid', 'Record the reason for the decision', role);
      let score = a.score ?? null;
      let passed = a.passed ?? null;
      let voidedCount = 0;
      if (decision === 'upheld') {
        const f = b.rawGet('assessment_forms', a.form_id)!;
        const voided = [...new Set([...(a.voided_item_ids ?? []), ...(voidItemIds ?? []).filter((i) => f.item_ids.includes(i))])];
        voidedCount = voided.length;
        const rs = b.raw('responses').filter((r) => r.attempt_id === a.id && !voided.includes(r.item_id));
        if (rs.length) {
          score = Math.round((rs.filter((r) => r.correct).length * 100) / rs.length);
          passed = score >= f.pass_mark;
        }
        b.rawUpdate('attempts', a.id, { voided_item_ids: voided, score, passed, counts: passed ? true : false });
      }
      b.rawUpdate('appeals', appealId, { status: decision, decided_by: caller, decided_at: now(), decision_note: note });
      return done<R>('appeal.decide', 'appeals', appealId, `${decision}; ${voidedCount} item(s) voided`, role, 'kafaa.assessment.appeal', `Appeal ${appealId} on ${a.id}: ${decision}`, decision === 'upheld' ? 'Appeal upheld' : 'Appeal rejected', { score, passed }, ['appeals', 'attempts']);
    },
  };
}

/** Roles that may act as a session instructor (used by pages to label the acting role). */
export const G2_INSTRUCTOR_ROLES: PlatformRole[] = ['instructor', 'training_manager'];
