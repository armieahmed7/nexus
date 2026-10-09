// M02 extension LocalBackend RPCs (owner: W4 · E5, F31 Instructor and SME pipeline). Installed on every LocalRpc by src/data/ext/local.ts.
// 1:1 mirror of supabase/migrations/20261009145001_kafaa_w4e5_instructors.sql: same checks in the same order, the same refusal codes and
// messages (INSMSG in src/modules/m02/instructors.ts), the same audit and ledger rows. Pages never import this file.
//
// Shared writes (only through these RPCs, like the SQL SECURITY DEFINER functions):
//   M02 evaluator_quals   `eq-ins-<person>-<standard>` rows (valid to the currency due date; cut to the lapse/withdrawal date)  [F31 contract request]
//   M04 enrolments        `en-ins-<track>` (status assigned) for the route's initial course when a nomination is accepted
//   F01 skill_evidence    `se:credential:<track>:sk-ld-01-instruct` (level 3, evidenced; status lapsed with the currency) + applySkills
//   M14 notifications     kind `instructor`, ids `nt-ins-...`
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { Result } from '../../../data/types';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import { evidenceId } from '../../../domain/skills';
import { applySkills } from '../../../data/local/rpc.w0';
import { lineManagerOf } from '../../m20/domain';
import {
  INITIAL_COURSE, INSMSG, INSTRUCT_LEVEL, INSTRUCT_SKILL, RESTRICTED_FAMILIES, addDays, addMonths, currencyView, deriveStage, initialDoneOn, observationGate,
  qualifyingSet, reinstateObservation, scoreObservation, sessionHours, standardSkills, validateHours, validateNomination, validateObservation, type ObsRow,
} from '../instructors';
import type { M02Rpc } from './rpc';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const rid = (p: string) => `${p}-${Array.from(crypto.getRandomValues(new Uint8Array(12)), (x) => x.toString(16).padStart(2, '0')).join('')}`;
const OPEN = ['active', 'qualified', 'lapsed'];
const T3 = ['instructor_tracks', 'instructor_observations', 'teaching_hours'];

export function makeLocalM02(b: LocalBackend, h: LocalRpcHelpers): M02Rpc {
  const me = () => b.identity().personId;
  const ctx = () => b.access();
  const raw = (t: string) => b.raw(t as never) as unknown as Row[];
  const get = (t: string, id: string | null | undefined) => (id ? (b.rawGet(t as never, id) as unknown as Row | undefined) : undefined);
  const ins = (t: string, row: Row) => b.rawInsert(t as never, row as never);
  const upd = (t: string, id: string, patch: Row) => b.rawUpdate(t as never, id, patch as never);
  const person = (id: string | null | undefined) => get('people', id);
  const notify = (id: string, pid: string | null | undefined, en: string, ar: string, link: string, severity = 'info'): boolean => {
    if (!pid || !person(pid) || get('notifications', id)) return false;
    ins('notifications', { id, person_id: pid, kind: 'instructor', title_en: en, title_ar: ar, link, severity, created_at: nowTs() });
    return true;
  };
  const obsOf = (trackId: string) => raw('instructor_observations').filter((o) => o.track_id === trackId) as ObsRow[];
  const initialOf = (t: Row) => t.initial_done_on ?? initialDoneOn(t.person_id, t.route, raw('training_records') as never);
  const tmRole = () => ctx().actingRole('sat', ['A']);
  const trainingManagers = () => [...new Set(raw('role_assignments').filter((a) => a.role === 'training_manager' && a.status === 'active').map((a) => a.person_id as string))].sort();
  /** evaluator_quals rows written by F31 for a track (one per standard). */
  const setEq = (t: Row, validTo: string, onlyIfLater: boolean) => {
    for (const s of [...t.standard_ids].sort()) {
      const id = `eq-ins-${t.person_id}-${s}`;
      const cur = get('evaluator_quals', id);
      if (!cur) { if (!onlyIfLater) ins('evaluator_quals', { id, person_id: t.person_id, standard_id: s, valid_to: validTo }); }
      else if (!onlyIfLater || cur.valid_to > validTo) upd('evaluator_quals', id, { valid_to: validTo });
    }
  };
  const setCredential = async (t: Row, status: 'current' | 'lapsed', today: string) => {
    const id = evidenceId('credential', t.id, INSTRUCT_SKILL);
    if (!get('skills', INSTRUCT_SKILL)) return;
    const cur = get('skill_evidence', id);
    if (!cur) {
      if (status === 'lapsed') return;
      ins('skill_evidence', { id, person_id: t.person_id, skill_id: INSTRUCT_SKILL, kind: 'credential', ref_table: 'instructor_tracks', ref_id: t.id, level: INSTRUCT_LEVEL, basis: 'evidenced', status, observed_on: today, note: 'Qualified instructor (F31)', recorded_by: me(), active: true, created_at: nowTs() });
    } else upd('skill_evidence', id, status === 'current' ? { status, observed_on: today, active: true } : { status });
    await applySkills(b, t.person_id, today);
  };

  return {
    async nominateInstructor(p) {
      await b.whenReady();
      type R = { id: string; status: string };
      const A = 'instructor.nominate';
      const caller = me();
      const pid = typeof p?.person_id === 'string' ? p.person_id : null;
      if (!caller) return h.refuse<R>(A, 'instructor_tracks', pid, 'not_signed_in', INSMSG.not_signed_in);
      const today = todayIso();
      let role: string | null = null;
      let kind = 'self';
      if (pid === caller) role = ctx().actingRole('own_profile', ['Own']);
      else if (tmRole()) { role = tmRole(); kind = 'training_manager'; }
      else if (pid && b.identity().roles.includes('manager' as never) && (lineManagerOf(pid, raw('people') as never, raw('role_assignments') as never, today) === caller || ctx().inScope('qual_records', pid))) { role = 'manager'; kind = 'manager'; }
      if (!role) return h.refuse<R>(A, 'instructor_tracks', pid, 'forbidden', INSMSG.nominate_forbidden);
      const pp = person(pid);
      if (!pp) return h.refuse<R>(A, 'instructor_tracks', pid, 'not_found', INSMSG.not_found_person, role);
      if (pp.kind !== 'staff' || pp.status === 'leaver') return h.refuse<R>(A, 'instructor_tracks', pid, 'forbidden', INSMSG.not_staff, role);
      if (RESTRICTED_FAMILIES.includes(pp.job_family_id ?? '')) return h.refuse<R>(A, 'instructor_tracks', pid, 'security_restricted', INSMSG.restricted, role);
      const bad = validateNomination(p, raw('qual_standards') as never, raw('skills') as never);
      if (bad) return h.refuse<R>(A, 'instructor_tracks', pid, bad.code, bad.message, role);
      if (raw('instructor_tracks').some((t) => t.person_id === pid && OPEN.includes(t.status))) return h.refuse<R>(A, 'instructor_tracks', pid, 'already_active', INSMSG.already_active, role);
      if (p.route === 'asip' && !raw('licences').some((l) => l.person_id === pid && (l.type === 'SRO' || l.type === 'SRO_QI') && l.status === 'valid' && l.expires_on >= today))
        return h.refuse<R>(A, 'instructor_tracks', pid, 'not_eligible', INSMSG.asip_needs_sro, role);
      const stds = [...p.standard_ids];
      const skills = p.skill_ids?.length ? [...p.skill_ids] : standardSkills(stds, raw('skills') as never).slice(0, 6);
      const std0 = get('qual_standards', stds[0]);
      const id = rid('it');
      const motivation = typeof p.motivation === 'string' && p.motivation.trim() ? p.motivation.trim() : null;
      ins('instructor_tracks', {
        id, person_id: pid, person_name: pp.display_name, person_name_ar: pp.display_name_ar || pp.display_name, route: p.route, discipline: std0?.discipline ?? '',
        standard_ids: stds, skill_ids: skills, stage: 'nominated', status: 'active', started_on: today, nominated_by: caller, nomination_kind: kind, motivation,
        accepted_on: null, accepted_by: null, initial_done_on: null, qualified_on: null, first_qualified_on: null, qualified_by: null, currency_due: null, currency_status: null,
        lapsed_on: null, decision_note: null, created_at: nowTs(), updated_at: nowTs(),
      });
      if (pid !== caller) notify(`nt-ins-${id}-nominated`, pid, 'You were nominated for the instructor track', 'تم ترشيحك لمسار المدربين', '/my/instructor');
      for (const tm of trainingManagers()) if (tm !== caller && tm !== pid) notify(`nt-ins-${id}-tm-${tm}`, tm, `Instructor nomination to decide: ${pp.display_name}`, `ترشيح مدرب بانتظار القرار: ${pp.display_name_ar || pp.display_name}`, `/training/instructors/${id}`);
      return h.done<R>(A, 'instructor_tracks', id, `${kind} nomination; ${p.route}; ${stds.join(',')}`, role, null, '', 'Nomination sent to the training manager', { id, status: 'active' }, ['instructor_tracks', 'notifications']);
    },

    async decideInstructorNomination(trackId, decision, note) {
      await b.whenReady();
      type R = { id: string; status: string; stage: string; enrolment_id: string | null };
      const A = 'instructor.decide';
      const caller = me();
      if (!caller) return h.refuse<R>(A, 'instructor_tracks', trackId ?? null, 'not_signed_in', INSMSG.not_signed_in);
      const role = tmRole();
      if (!role) return h.refuse<R>(A, 'instructor_tracks', trackId ?? null, 'forbidden', INSMSG.decide_forbidden);
      const t = get('instructor_tracks', trackId);
      if (!t) return h.refuse<R>(A, 'instructor_tracks', trackId ?? null, 'not_found', INSMSG.not_found_track, role);
      if (t.person_id === caller) return h.refuse<R>(A, 'instructor_tracks', t.id, 'maker_checker', INSMSG.own_track, role);
      if (t.status !== 'active' || t.accepted_on) return h.refuse<R>(A, 'instructor_tracks', t.id, 'invalid_state', INSMSG.not_nominated, role);
      const n = typeof note === 'string' ? note.trim() : '';
      if ((decision !== 'accept' && decision !== 'decline') || (decision === 'decline' && n.length < 5) || n.length > 600) return h.refuse<R>(A, 'instructor_tracks', t.id, 'invalid', INSMSG.invalid_decision, role);
      const today = todayIso();
      if (decision === 'decline') {
        upd('instructor_tracks', t.id, { status: 'declined', decision_note: n, updated_at: nowTs() });
        notify(`nt-ins-${t.id}-declined`, t.person_id, 'Your instructor nomination was declined', 'تم رفض ترشيحك لمسار المدربين', '/my/instructor', 'warn');
        return h.done<R>(A, 'instructor_tracks', t.id, `declined: ${n}`, role, 'kafaa.instructor.nomination', `Instructor nomination ${t.id} declined`, 'Nomination declined', { id: t.id, status: 'declined', stage: t.stage, enrolment_id: null }, ['instructor_tracks', 'notifications']);
      }
      const done = initialDoneOn(t.person_id, t.route, raw('training_records') as never);
      const course = INITIAL_COURSE[t.route as 'sme' | 'asip'];
      let enrolment: string | null = null;
      if (!done && !raw('enrolments').some((e) => e.person_id === t.person_id && e.course_id === course && !['cancelled', 'failed'].includes(e.status))) {
        enrolment = `en-ins-${t.id}`;
        if (!get('enrolments', enrolment)) ins('enrolments', { id: enrolment, person_id: t.person_id, course_id: course, session_id: null, org_id: person(t.person_id)?.org_id ?? null, status: 'assigned', source: 'coordinator', assigned_by: 'Instructor pipeline (F31)', due_on: addDays(today, 90), enrolled_at: nowTs(), progress_pct: 0 });
      }
      const stage = deriveStage({ status: 'active', stage: t.stage, accepted_on: today }, obsOf(t.id), done);
      upd('instructor_tracks', t.id, { accepted_on: today, accepted_by: caller, initial_done_on: done, stage, decision_note: n || null, updated_at: nowTs() });
      notify(`nt-ins-${t.id}-accepted`, t.person_id, 'Your instructor nomination was accepted: start the initial training', 'تم قبول ترشيحك لمسار المدربين: ابدأ التدريب الأولي', '/my/instructor', 'ok');
      return h.done<R>(A, 'instructor_tracks', t.id, `accepted; ${enrolment ? `assigned ${course}` : 'initial course already on record'}`, role, 'kafaa.instructor.nomination', `Instructor nomination ${t.id} accepted`, 'Nomination accepted', { id: t.id, status: 'active', stage, enrolment_id: enrolment }, ['instructor_tracks', 'enrolments', 'notifications']);
    },

    async recordInstructorObservation(p) {
      await b.whenReady();
      type R = { id: string; score: number; result: string; stage: string };
      const A = 'instructor.observe';
      const caller = me();
      const tid = typeof p?.track_id === 'string' ? p.track_id : null;
      if (!caller) return h.refuse<R>(A, 'instructor_observations', tid, 'not_signed_in', INSMSG.not_signed_in);
      const role = ctx().actingRole('sat', ['W']);
      if (!role) return h.refuse<R>(A, 'instructor_observations', tid, 'forbidden', INSMSG.observe_forbidden);
      const t = get('instructor_tracks', tid);
      if (!t) return h.refuse<R>(A, 'instructor_observations', tid, 'not_found', INSMSG.not_found_track, role);
      if (t.person_id === caller) return h.refuse<R>(A, 'instructor_observations', t.id, 'self_observation', INSMSG.self_observation, role);
      const today = todayIso();
      const bad = validateObservation(p, today);
      if (bad) return h.refuse<R>(A, 'instructor_observations', t.id, bad.code, bad.message, role);
      if ((p.session_id != null && (typeof p.session_id !== 'string' || !get('sessions', p.session_id))) || (p.course_id != null && (typeof p.course_id !== 'string' || !get('courses', p.course_id))))
        return h.refuse<R>(A, 'instructor_observations', t.id, 'invalid', INSMSG.invalid_observation, role);
      const obs = obsOf(t.id);
      const init = initialOf(t);
      const gate = observationGate(t as never, p.kind, obs, init, p.observed_on);
      if (gate) return h.refuse<R>(A, 'instructor_observations', t.id, gate.code, gate.message, role);
      const items = p.items.map((i) => ({ key: i.key, rating: i.rating }));
      const sc = scoreObservation(items);
      const ob = person(caller);
      const id = rid('io');
      const note = typeof p.note === 'string' && p.note.trim() ? p.note.trim() : null;
      const row = { id, track_id: t.id, person_id: t.person_id, observer_person_id: caller, observer_name: ob?.display_name ?? '', observer_name_ar: ob?.display_name_ar || ob?.display_name || '', kind: p.kind, observed_on: p.observed_on, items, score: sc.score, result: sc.result, session_id: p.session_id ?? null, course_id: p.course_id ?? null, note, created_at: nowTs() };
      ins('instructor_observations', row);
      const stage = deriveStage(t as never, [...obs, row as ObsRow], init);
      if (stage !== t.stage || init !== t.initial_done_on) upd('instructor_tracks', t.id, { stage, initial_done_on: init, updated_at: nowTs() });
      const kindEn = p.kind === 'co_teach' ? 'co-teach' : p.kind;
      const kindAr = p.kind === 'co_teach' ? 'التدريس المشترك' : p.kind === 'solo' ? 'التدريس المنفرد' : 'الحفاظ على الأهلية';
      notify(`nt-ins-${id}`, t.person_id, `Observation recorded (${kindEn}): ${sc.result}, ${sc.score}%`, `تم تسجيل ملاحظة (${kindAr}): ${sc.result === 'pass' ? 'ناجح' : 'غير ناجح'}، ${sc.score}%`, '/my/instructor', sc.result === 'pass' ? 'ok' : 'warn');
      return h.done<R>(A, 'instructor_observations', id, `${p.kind} ${sc.result} ${sc.score}% on ${t.id}`, role, 'kafaa.instructor.observation', `Instructor observation ${id} (${p.kind}, ${sc.result})`, 'Observation recorded', { id, score: sc.score, result: sc.result, stage }, ['instructor_observations', 'instructor_tracks', 'notifications']);
    },

    async qualifyInstructor(trackId, note) {
      await b.whenReady();
      type R = { id: string; qualified_on: string; currency_due: string; standards: number; reinstated: boolean };
      const A = 'instructor.qualify';
      const caller = me();
      if (!caller) return h.refuse<R>(A, 'instructor_tracks', trackId ?? null, 'not_signed_in', INSMSG.not_signed_in);
      const role = tmRole();
      if (!role) return h.refuse<R>(A, 'instructor_tracks', trackId ?? null, 'forbidden', INSMSG.qualify_forbidden);
      const t = get('instructor_tracks', trackId);
      if (!t) return h.refuse<R>(A, 'instructor_tracks', trackId ?? null, 'not_found', INSMSG.not_found_track, role);
      if (t.person_id === caller) return h.refuse<R>(A, 'instructor_tracks', t.id, 'maker_checker', INSMSG.own_track, role);
      if (t.status === 'qualified') return h.refuse<R>(A, 'instructor_tracks', t.id, 'invalid_state', INSMSG.already_qualified, role);
      if (t.status !== 'active' && t.status !== 'lapsed') return h.refuse<R>(A, 'instructor_tracks', t.id, 'invalid_state', INSMSG.not_active, role);
      const n = typeof note === 'string' ? note.trim() : '';
      if (n.length > 600) return h.refuse<R>(A, 'instructor_tracks', t.id, 'invalid', INSMSG.invalid_withdraw, role);
      const obs = obsOf(t.id);
      const reinstated = t.status === 'lapsed';
      if (reinstated) {
        if (!reinstateObservation(obs, t.lapsed_on)) return h.refuse<R>(A, 'instructor_tracks', t.id, 'not_ready', INSMSG.needs_currency_obs, role);
        if (!reinstateObservation(obs, t.lapsed_on, caller)) return h.refuse<R>(A, 'instructor_tracks', t.id, 'maker_checker', INSMSG.maker_checker, role);
      } else {
        const init = initialOf(t);
        if (!t.accepted_on || !init || !qualifyingSet(obs)) return h.refuse<R>(A, 'instructor_tracks', t.id, 'not_ready', INSMSG.not_ready, role);
        if (!qualifyingSet(obs, caller)) return h.refuse<R>(A, 'instructor_tracks', t.id, 'maker_checker', INSMSG.maker_checker, role);
      }
      const today = todayIso();
      const due = addMonths(today, 12);
      upd('instructor_tracks', t.id, {
        status: 'qualified', stage: 'qualified', qualified_on: today, first_qualified_on: t.first_qualified_on ?? today, qualified_by: caller, currency_due: due, currency_status: 'current',
        lapsed_on: null, initial_done_on: t.initial_done_on ?? initialOf(t), decision_note: n || t.decision_note || null, updated_at: nowTs(),
      });
      setEq(t, due, false);
      await setCredential(t, 'current', today);
      notify(`nt-ins-${t.id}-${reinstated ? 'reinstated' : 'qualified'}-${today}`, t.person_id, reinstated ? 'Your instructor currency is reinstated' : 'You are a qualified instructor', reinstated ? 'تمت إعادة أهليتك كمدرب' : 'أصبحت مدرباً مؤهلاً', '/my/instructor', 'ok');
      return h.done<R>(A, 'instructor_tracks', t.id, `${reinstated ? 'reinstated' : 'qualified'}; currency due ${due}; ${t.standard_ids.length} standards`, role, reinstated ? 'kafaa.instructor.reinstate' : 'kafaa.instructor.qualify',
        `Instructor ${t.id} ${reinstated ? 'reinstated' : 'qualified'} (maker-checker)`, reinstated ? 'Instructor reinstated' : 'Instructor qualified', { id: t.id, qualified_on: today, currency_due: due, standards: t.standard_ids.length, reinstated },
        ['instructor_tracks', 'evaluator_quals', 'skill_evidence', 'person_skills', 'notifications']);
    },

    async instructorCurrencySweep() {
      await b.whenReady();
      type R = { checked: number; renewed: number; lapsed: number; notices: number };
      const A = 'instructor.currency_sweep';
      if (!me()) return h.refuse<R>(A, 'instructor_tracks', null, 'not_signed_in', INSMSG.not_signed_in);
      const role = tmRole();
      if (!role) return h.refuse<R>(A, 'instructor_tracks', null, 'forbidden', INSMSG.sweep_forbidden);
      const today = todayIso();
      const out = { checked: 0, renewed: 0, lapsed: 0, notices: 0 };
      const tracks = raw('instructor_tracks').filter((t) => t.status === 'qualified').sort((a, c) => (a.id < c.id ? -1 : 1));
      for (const t of tracks) {
        out.checked++;
        const cv = currencyView(t as never, raw('teaching_hours').filter((x) => x.person_id === t.person_id) as never, today);
        if (!cv) continue;
        if (cv.status === 'lapsed') {
          upd('instructor_tracks', t.id, { status: 'lapsed', lapsed_on: cv.lapsed_on, currency_due: cv.due, currency_status: 'lapsed', updated_at: nowTs() });
          setEq(t, cv.lapsed_on!, true);
          await setCredential(t, 'lapsed', today);
          notify(`nt-ins-${t.id}-lapsed-${cv.lapsed_on}`, t.person_id, `Your instructor currency lapsed on ${cv.lapsed_on}`, `انتهت أهليتك كمدرب في ${cv.lapsed_on}`, '/my/instructor', 'bad');
          out.lapsed++;
          continue;
        }
        const patch: Row = {};
        if (cv.due !== t.currency_due) { patch.currency_due = cv.due; setEq(t, cv.due, false); out.renewed++; }
        if (cv.status !== t.currency_status) patch.currency_status = cv.status;
        if (Object.keys(patch).length) upd('instructor_tracks', t.id, { ...patch, updated_at: nowTs() });
        if (cv.notice && notify(`nt-ins-${t.id}-${cv.due}-${cv.notice}`, t.person_id, `Instructor currency due in ${cv.days} days: ${cv.hours} of 40 delivery hours, ${cv.cpd} of 8 development hours`,
          `تستحق أهليتك كمدرب خلال ${cv.days} يوماً: ${cv.hours} من 40 ساعة تدريس و${cv.cpd} من 8 ساعات تطوير`, '/my/instructor', cv.notice === 30 ? 'warn' : 'info')) out.notices++;
      }
      const material = out.lapsed + out.renewed > 0;
      return h.done<R>(A, 'instructor_tracks', null, `checked ${out.checked}; renewed ${out.renewed}; lapsed ${out.lapsed}; notices ${out.notices}`, role, material ? 'kafaa.instructor.currency_sweep' : null,
        `Instructor currency sweep: ${out.lapsed} lapsed, ${out.renewed} renewed`, 'Currency sweep complete', out, ['instructor_tracks', 'evaluator_quals', 'skill_evidence', 'person_skills', 'notifications']);
    },

    async logTeachingHours(p) {
      await b.whenReady();
      type R = { id: string };
      const A = 'instructor.hours';
      const caller = me();
      const pid = typeof p?.person_id === 'string' ? p.person_id : null;
      if (!caller) return h.refuse<R>(A, 'teaching_hours', pid, 'not_signed_in', INSMSG.not_signed_in);
      let role: string | null = null;
      let source = 'mirror';
      if (pid === caller && p.kind === 'cpd') { role = ctx().actingRole('own_profile', ['Own']); source = 'self'; }
      else role = tmRole();
      if (!role) return h.refuse<R>(A, 'teaching_hours', pid, 'forbidden', INSMSG.hours_forbidden);
      const today = todayIso();
      const bad = validateHours(p, today);
      if (bad) return h.refuse<R>(A, 'teaching_hours', pid, bad.code, bad.message, role);
      if (p.course_id != null && (typeof p.course_id !== 'string' || !get('courses', p.course_id))) return h.refuse<R>(A, 'teaching_hours', pid, 'invalid', INSMSG.invalid_hours, role);
      const t = raw('instructor_tracks').filter((x) => x.person_id === pid && OPEN.includes(x.status)).sort((a, c) => (a.id < c.id ? -1 : 1))[0];
      if (!t) return h.refuse<R>(A, 'teaching_hours', pid, 'not_found', INSMSG.no_track, role);
      const id = rid('th');
      ins('teaching_hours', { id, person_id: pid, track_id: t.id, kind: p.kind, source, session_id: null, course_id: p.course_id ?? null, delivered_on: p.delivered_on, hours: p.hours, note: typeof p.note === 'string' && p.note.trim() ? p.note.trim() : null, recorded_by: caller, created_at: nowTs() });
      return h.done<R>(A, 'teaching_hours', id, `${p.kind} ${p.hours} h on ${p.delivered_on}`, role, null, '', 'Hours logged', { id }, ['teaching_hours']);
    },

    async syncTeachingHours(personId) {
      await b.whenReady();
      type R = { added: number; hours: number };
      const A = 'instructor.hours_sync';
      const caller = me();
      if (!caller) return h.refuse<R>(A, 'teaching_hours', personId ?? null, 'not_signed_in', INSMSG.not_signed_in);
      const role = personId === caller ? ctx().actingRole('own_profile', ['Own']) : tmRole();
      if (!role) return h.refuse<R>(A, 'teaching_hours', personId ?? null, 'forbidden', INSMSG.sync_forbidden);
      const tracks = raw('instructor_tracks').filter((x) => OPEN.includes(x.status) && (personId == null || x.person_id === personId)).sort((a, c) => (a.id < c.id ? -1 : 1));
      if (personId != null && !tracks.length) return h.refuse<R>(A, 'teaching_hours', personId, 'not_found', INSMSG.no_track, role);
      const trackOf = new Map<string, string>();
      for (const t of tracks) if (!trackOf.has(t.person_id)) trackOf.set(t.person_id, t.id);
      const now = Date.now();
      const present = new Set(raw('enrolments').filter((e) => e.session_id && e.attendance === 'present').map((e) => e.session_id as string));
      let added = 0;
      let hours = 0;
      for (const s of raw('sessions').filter((x) => x.instructor_person_id && trackOf.has(x.instructor_person_id) && x.status !== 'cancelled' && Date.parse(x.ends_at) < now && present.has(x.id)).sort((a, c) => (a.id < c.id ? -1 : 1))) {
        const id = `th-ses-${s.id}`;
        const hh = sessionHours(s.starts_at, s.ends_at);
        if (get('teaching_hours', id) || hh <= 0) continue;
        ins('teaching_hours', { id, person_id: s.instructor_person_id, track_id: trackOf.get(s.instructor_person_id), kind: 'delivery', source: 'session', session_id: s.id, course_id: s.course_id, delivered_on: new Date(s.starts_at).toISOString().slice(0, 10), hours: hh, note: null, recorded_by: caller, created_at: nowTs() });
        added++;
        hours += hh;
      }
      return h.done<R>(A, 'teaching_hours', personId ?? null, `${added} sessions, ${hours} h`, role, null, '', added ? 'Teaching hours added from attended sessions' : 'No new attended sessions', { added, hours }, ['teaching_hours']);
    },

    async withdrawInstructorTrack(trackId, note) {
      await b.whenReady();
      type R = { id: string; status: string };
      const A = 'instructor.withdraw';
      const caller = me();
      if (!caller) return h.refuse<R>(A, 'instructor_tracks', trackId ?? null, 'not_signed_in', INSMSG.not_signed_in);
      const t = get('instructor_tracks', trackId);
      if (!t) return h.refuse<R>(A, 'instructor_tracks', trackId ?? null, 'not_found', INSMSG.not_found_track);
      const role = t.person_id === caller ? ctx().actingRole('own_profile', ['Own']) : tmRole();
      if (!role) return h.refuse<R>(A, 'instructor_tracks', t.id, 'forbidden', INSMSG.withdraw_forbidden);
      if (!OPEN.includes(t.status)) return h.refuse<R>(A, 'instructor_tracks', t.id, 'invalid_state', INSMSG.already_closed, role);
      const n = typeof note === 'string' ? note.trim() : '';
      if (n.length < 5 || n.length > 600) return h.refuse<R>(A, 'instructor_tracks', t.id, 'invalid', INSMSG.invalid_withdraw, role);
      const today = todayIso();
      const wasQual = t.status === 'qualified' || t.status === 'lapsed';
      upd('instructor_tracks', t.id, { status: 'withdrawn', decision_note: n, updated_at: nowTs() });
      if (wasQual) { setEq(t, today, true); await setCredential(t, 'lapsed', today); }
      if (t.person_id !== caller) notify(`nt-ins-${t.id}-withdrawn`, t.person_id, 'Your instructor track was closed', 'تم إغلاق مسارك كمدرب', '/my/instructor', 'warn');
      return h.done<R>(A, 'instructor_tracks', t.id, `withdrawn: ${n}`, role, null, '', 'Instructor track closed', { id: t.id, status: 'withdrawn' }, [...T3, 'evaluator_quals', 'skill_evidence', 'person_skills', 'notifications']);
    },
  };
}
