// FS wave C · E2 LocalBackend RPCs (FS19 course pack, FS20 academies). Spread into makeLocalM04 (backend/local.ts).
// 1:1 mirror of supabase/migrations/20261010232001_kafaa_fs32_course_pack_academies.sql: same checks in the same order, the same
// refusal codes and messages (ACAD_MSG, PACK_MSG), one audit row per call, the same ledger events and the same rows written.
// Shared writes (as the SQL SECURITY DEFINER functions do): F01 skills.evidence_keys (a pack course's id on the skills it teaches),
// F01 skill_evidence (`se:ojt:<capstone>:<skill>`, kind ojt, ref_table cohort_capstones) + applySkills, M14 notifications.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import { nowTs } from '../../../data/audit';
import { newId } from '../../../data/local/store';
import { applySkills } from '../../../data/local/rpc.w0';
import { todayIso } from '../../../domain/rules';
import { copyProblems, courseTexts, courseUrls, MAX_LINKS, OBJECTIVE_MAX, OBJECTIVE_MIN, type CopyProblem } from '../fsPack';
import {
  ACAD_MSG, ARTEFACT_KINDS, FEEDBACK_MAX, NOTE_MAX, OPEN_MEMBER, PARTICIPANT, RESULTS, SUMMARY_MAX, SUMMARY_MIN, TITLE_MAX, TITLE_MIN,
  academyEnrolmentId, academyStats, capstoneEvidence, capstoneId, memberId, type AcadCode,
} from '../academy';
import { lineManagerOf } from '../mentoring';
import type { M04FsRpc, Nominee, PackCheckResult, PackLinksResult, SignoffResult } from './fs.rpc';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** FS19 refusal messages (identical in SQL). */
export const PACK_MSG = {
  not_signed_in: 'Sign in to edit the course pack',
  forbidden: 'Only training staff edit the course pack',
  not_found: 'Course not in the future-skills pack',
  invalid_count: 'A pack course links 1 to 8 skills',
  invalid_skill: 'Unknown or obsolete skill: ',
  security_skill: 'Security skills are never linked to pack courses',
  invalid_level: 'Levels are 1, 2 or 3',
  invalid_objective: 'Each objective needs English and Arabic text (5-200 characters)',
  duplicate: 'Link each skill once',
  restricted: 'Course text never carries security-restricted wording: ',
} as const;

export const linkId = (courseId: string, skillId: string) => `csl-${courseId.replace(/^c-fs-/, '')}-${skillId.replace(/^sk-/, '')}`;

export function makeLocalM04Fs(b: LocalBackend, h: LocalRpcHelpers): M04FsRpc {
  const me = () => b.identity().personId;
  const ctx = () => b.access();
  const raw = (t: string) => ((b.raw(t as never) as unknown as Row[]) ?? []);
  const get = (t: string, id: string | null | undefined) => (id ? (b.rawGet(t as never, id) as unknown as Row | undefined) : undefined);
  const ins = (t: string, row: Row) => b.rawInsert(t as never, row as never);
  const upd = (t: string, id: string, patch: Row) => b.rawUpdate(t as never, id, patch as never);
  const isStaff = (id: string | null | undefined) => { const p = get('people', id); return !!p && p.kind === 'staff' && p.status === 'active'; };
  const owner = () => ctx().has('training', ['W']) && ctx().has('training', ['A']);
  const lm = (person: string) => lineManagerOf(person, raw('people') as never, raw('role_assignments') as never, todayIso());
  const notify = (person: string | null | undefined, en: string, ar: string, link: string, severity: 'info' | 'ok' | 'warn' = 'info') => {
    if (!person || !get('people', person)) return;
    ins('notifications', { id: newId('nt'), person_id: person, kind: 'academy', title_en: en, title_ar: ar, link, severity, created_at: nowTs() });
  };
  const checkCourse = (c: Row, item: Row): CopyProblem[] => {
    const mods = raw('course_modules').filter((m) => m.course_id === c.id).sort((x, y) => Number(x.n) - Number(y.n));
    const links = raw('course_skill_links').filter((l) => l.course_id === c.id && l.active);
    const p = copyProblems(item.theme, courseTexts(c as never, mods, links as never), courseUrls(c as never));
    upd('course_pack_items', item.id, { copy_check: p.length ? 'failed' : 'passed', copy_problems: p, copy_checked_at: nowTs() });
    return p;
  };

  return {
    async saveCourseSkills(courseId, links) {
      await b.whenReady();
      type R = PackLinksResult;
      const no = (code: string, msg: string, role: string | null = null) => h.refuse<R>('course.pack.links', 'course_skill_links', courseId || null, code, msg, role);
      if (!me()) return no('not_signed_in', PACK_MSG.not_signed_in);
      if (!ctx().has('training', ['W'])) return no('forbidden', PACK_MSG.forbidden);
      const role = ctx().actingRole('training', ['W']);
      const item = raw('course_pack_items').find((x) => x.course_id === courseId);
      const c = get('courses', courseId);
      if (!item || !c) return no('not_found', PACK_MSG.not_found, role);
      if (!Array.isArray(links) || links.length < 1 || links.length > MAX_LINKS) return no('invalid', PACK_MSG.invalid_count, role);
      const seen = new Set<string>();
      for (const l of links) {
        const s = get('skills', l?.skill_id);
        if (!s || s.lifecycle === 'obsolete') return no('invalid', PACK_MSG.invalid_skill + String(l?.skill_id ?? ''), role);
        if (s.area === 'security') return no('security_skill', PACK_MSG.security_skill, role);
        if (!Number.isInteger(l.level) || l.level < 1 || l.level > 3) return no('invalid', PACK_MSG.invalid_level, role);
        const en = String(l.objective_en ?? '').trim();
        const ar = String(l.objective_ar ?? '').trim();
        if (en.length < OBJECTIVE_MIN || en.length > OBJECTIVE_MAX || ar.length < OBJECTIVE_MIN || ar.length > OBJECTIVE_MAX) return no('invalid', PACK_MSG.invalid_objective, role);
        if (seen.has(s.id)) return no('invalid', PACK_MSG.duplicate, role);
        seen.add(s.id);
      }
      const cp = copyProblems(item.theme, links.flatMap((l) => [l.objective_en, l.objective_ar]), []);
      if (cp.length) return no('restricted', PACK_MSG.restricted + cp[0].detail, role);
      const now = nowTs();
      links.forEach((l, i) => {
        const id = linkId(courseId, l.skill_id);
        const row = { course_id: courseId, skill_id: l.skill_id, level: l.level, objective_n: i + 1, objective_en: String(l.objective_en).trim(), objective_ar: String(l.objective_ar).trim(), active: true, updated_by: me(), updated_at: now };
        if (get('course_skill_links', id)) upd('course_skill_links', id, row); else ins('course_skill_links', { id, ...row });
      });
      for (const old of raw('course_skill_links').filter((x) => x.course_id === courseId && x.active && !seen.has(x.skill_id))) upd('course_skill_links', old.id, { active: false, updated_by: me(), updated_at: now });
      // the course's objectives mirror its active links ({ skill_id, level, en, ar }: what FS17 pathways resolve content from)
      const act = raw('course_skill_links').filter((x) => x.course_id === courseId && x.active).sort((x, y) => Number(x.objective_n) - Number(y.objective_n) || (x.id < y.id ? -1 : 1));
      upd('courses', courseId, { objectives: act.map((x) => ({ skill_id: x.skill_id, level: Number(x.level), en: x.objective_en, ar: x.objective_ar })) });
      // evidence keys follow the active links of this course
      for (const l of raw('course_skill_links').filter((x) => x.course_id === courseId)) {
        const s = get('skills', l.skill_id);
        if (!s) continue;
        const keys: string[] = [...(s.evidence_keys ?? [])];
        if (l.active && !keys.includes(courseId)) upd('skills', s.id, { evidence_keys: [...keys, courseId] });
        if (!l.active && keys.includes(courseId)) upd('skills', s.id, { evidence_keys: keys.filter((k) => k !== courseId) });
      }
      const p = checkCourse(c, item);
      return h.done<R>('course.pack.links', 'course_skill_links', courseId, `${links.length} links; copy check ${p.length ? 'failed' : 'passed'}`, role, null, '',
        p.length ? 'Links saved; the copy and link check found problems' : 'Links saved; copy and link check passed',
        { course_id: courseId, links: links.length, copy_check: p.length ? 'failed' : 'passed', problems: p }, ['course_skill_links', 'course_pack_items', 'skills']);
    },

    async checkCoursePack() {
      await b.whenReady();
      type R = PackCheckResult;
      const no = (code: string, msg: string) => h.refuse<R>('course.pack.check', 'course_pack_items', null, code, msg);
      if (!me()) return no('not_signed_in', PACK_MSG.not_signed_in);
      if (!ctx().has('training', ['W'])) return no('forbidden', PACK_MSG.forbidden);
      const role = ctx().actingRole('training', ['W']);
      const items = raw('course_pack_items').sort((x, y) => Number(x.sort) - Number(y.sort) || (x.course_id < y.course_id ? -1 : 1));
      const failed: R['failed'] = [];
      let checked = 0;
      for (const it of items) {
        const c = get('courses', it.course_id);
        if (!c) continue;
        checked++;
        const p = checkCourse(c, it);
        if (p.length) failed.push({ course_id: c.id, problems: p });
      }
      return h.done<R>('course.pack.check', 'course_pack_items', null, `${checked - failed.length}/${checked} passed`, role, null, '', 'Copy and link check complete',
        { checked, passed: checked - failed.length, failed }, ['course_pack_items']);
    },

    async nominateAcademy(input) {
      await b.whenReady();
      type R = { id: string; status: 'nominated' };
      const cohortId = String(input?.cohort_id ?? '');
      const no = (code: AcadCode, role: string | null = null, c: string = code) => h.refuse<R>('academy.nominate', 'academy_members', cohortId || null, c, ACAD_MSG[code], role);
      const pid = me();
      if (!pid) return no('not_signed_in', null, 'not_signed_in');
      if (!ctx().has('training', ['Own']) || !isStaff(pid)) return no('forbidden', null, 'forbidden');
      const role = ctx().actingRole('training', ['Own', 'W', 'A']);
      const c = get('academy_cohorts', cohortId);
      if (!c) return no('cohort_not_found', role, 'not_found');
      if (c.status !== 'nominating') return no('cohort_closed', role, 'closed');
      const target = String(input?.person_id || pid);
      if (!isStaff(target)) return no('person_not_found', role, 'not_found');
      const line = target === pid ? null : lm(target);
      if (target !== pid && line !== pid && !owner()) return no('not_your_team', role, 'forbidden');
      const note = String(input?.note ?? '').trim();
      if (note.length > NOTE_MAX) return no('invalid_note', role, 'invalid');
      const mine = raw('academy_members').filter((m) => m.academy_id === c.academy_id && m.person_id === target);
      if (mine.some((m) => (OPEN_MEMBER as string[]).includes(m.status))) return no('already_open', role, 'conflict');
      if (mine.some((m) => m.status === 'completed')) return no('already_completed', role, 'conflict');
      const source = target === pid ? 'self' : line === pid ? 'manager' : 'programme';
      const id = memberId(cohortId, target);
      const row = {
        cohort_id: cohortId, academy_id: c.academy_id, person_id: target, status: 'nominated', source, nominated_by: pid, nominated_at: nowTs(), note: note || null,
        decided_by: null, decided_at: null, decision_note: null, mentor_person_id: null, reviewer_person_id: null, completed_on: null,
      };
      if (get('academy_members', id)) upd('academy_members', id, row); else ins('academy_members', { id, ...row });
      const a = get('academies', c.academy_id);
      if (target !== pid) notify(target, `You were nominated for ${a?.name_en ?? 'an academy'}`, `رُشّحت للانضمام إلى ${a?.name_ar ?? 'أكاديمية'}`, '/my/academies');
      return h.done<R>('academy.nominate', 'academy_members', id, `${cohortId} ${source}`, role, null, '', 'Nomination sent to the programme owner', { id, status: 'nominated' }, ['academy_members', 'notifications']);
    },

    async decideAcademyNomination(input) {
      await b.whenReady();
      type R = { id: string; status: string; enrolled: number };
      const mid = String(input?.member_id ?? '');
      const no = (code: AcadCode, role: string | null = null, c: string = code) => h.refuse<R>('academy.decide', 'academy_members', mid || null, c, ACAD_MSG[code], role);
      const pid = me();
      if (!pid) return no('not_signed_in', null, 'not_signed_in');
      if (!owner()) return no('forbidden_owner', null, 'forbidden');
      const role = ctx().actingRole('training', ['A']);
      const m = get('academy_members', mid);
      if (!m) return no('not_found', role, 'not_found');
      if (m.status !== 'nominated') return no('not_pending', role, 'conflict');
      if (input?.decision !== 'accept' && input?.decision !== 'decline') return no('invalid_decision', role, 'invalid');
      const note = String(input?.note ?? '').trim();
      if (note.length > NOTE_MAX) return no('invalid_note', role, 'invalid');
      const c = get('academy_cohorts', m.cohort_id)!;
      const a = get('academies', m.academy_id)!;
      const now = nowTs();
      if (input.decision === 'decline') {
        upd('academy_members', mid, { status: 'declined', decided_by: pid, decided_at: now, decision_note: note || null });
        notify(m.person_id, `Academy nomination not taken forward: ${a.name_en}`, `لم يُعتمد الترشيح للأكاديمية: ${a.name_ar}`, '/my/academies');
        return h.done<R>('academy.decide', 'academy_members', mid, 'declined', role, null, '', 'Nomination declined', { id: mid, status: 'declined', enrolled: 0 }, ['academy_members', 'notifications']);
      }
      const mentor = String(input.mentor_person_id ?? '');
      const reviewer = String(input.reviewer_person_id ?? '');
      if (!isStaff(mentor) || mentor === m.person_id) return no('mentor_invalid', role, 'invalid');
      if (!isStaff(reviewer) || reviewer === m.person_id || reviewer === mentor) return no('reviewer_invalid', role, 'invalid');
      const taken = raw('academy_members').filter((x) => x.cohort_id === m.cohort_id && (PARTICIPANT as string[]).includes(x.status)).length;
      if (taken >= Number(c.capacity)) return no('cohort_full', role, 'conflict');
      const status = c.status === 'running' ? 'active' : 'accepted';
      let enrolled = 0;
      for (const course of (a.module_course_ids ?? []) as string[]) {
        if (raw('enrolments').some((e) => e.person_id === m.person_id && e.course_id === course && !['cancelled', 'failed'].includes(e.status))) continue;
        ins('enrolments', {
          id: academyEnrolmentId(mid, course), person_id: m.person_id, course_id: course, session_id: null, org_id: null, status: 'enrolled', source: 'coordinator', assigned_by: pid,
          due_on: String(c.ends_on).slice(0, 10), enrolled_at: now, progress_pct: 0, completed_at: null, score: null, certificate_no: null, evaluation_id: null, attendance: null,
          waitlisted_at: null, decided_by: pid, decision_note: `Academy place: ${a.name_en}`,
        });
        enrolled++;
      }
      const cid = capstoneId(mid);
      if (!get('cohort_capstones', cid)) {
        ins('cohort_capstones', {
          id: cid, member_id: mid, cohort_id: m.cohort_id, academy_id: m.academy_id, person_id: m.person_id, mentor_person_id: mentor, reviewer_person_id: reviewer,
          artefact_kind: a.artefact_kind, title: '', summary: '', lang: 'en', status: 'draft', result: null, feedback: null, submitted_at: null, reviewed_at: null, evidence_ids: [], updated_at: now,
        });
      } else upd('cohort_capstones', cid, { mentor_person_id: mentor, reviewer_person_id: reviewer, updated_at: now });
      upd('academy_members', mid, { status, decided_by: pid, decided_at: now, decision_note: note || null, mentor_person_id: mentor, reviewer_person_id: reviewer });
      notify(m.person_id, `Place offered: ${a.name_en}`, `عُرض عليك مقعد: ${a.name_ar}`, '/my/academies', 'ok');
      notify(mentor, `You are mentoring in ${a.name_en}`, `أنت مرشد في ${a.name_ar}`, '/my/academies');
      notify(reviewer, `You review capstones in ${a.name_en}`, `أنت مراجع المشاريع الختامية في ${a.name_ar}`, '/my/academies');
      return h.done<R>('academy.decide', 'academy_members', mid, `accepted; ${enrolled} module enrolments`, role, 'kafaa.academy.accept', `${a.code}: place offered`,
        'Place offered; mentor and reviewer named', { id: mid, status, enrolled }, ['academy_members', 'enrolments', 'cohort_capstones', 'notifications']);
    },

    async saveCapstone(input) {
      await b.whenReady();
      type R = { id: string; status: string };
      const mid = String(input?.member_id ?? '');
      const cid = capstoneId(mid);
      const no = (code: AcadCode, role: string | null = null, c: string = code) => h.refuse<R>('academy.capstone.save', 'cohort_capstones', mid ? cid : null, c, ACAD_MSG[code], role);
      const pid = me();
      if (!pid) return no('not_signed_in', null, 'not_signed_in');
      const role = ctx().actingRole('training', ['Own']);
      const m = get('academy_members', mid);
      if (!m || m.person_id !== pid) return no('capstone_not_found', role, 'not_found');
      const c = get('academy_cohorts', m.cohort_id);
      if (!(m.status === 'active' || (m.status === 'accepted' && ['running', 'completed'].includes(c?.status)))) return no('not_active', role, 'conflict');
      const cap = get('cohort_capstones', cid);
      if (!cap) return no('capstone_not_found', role, 'not_found');
      if (cap.status !== 'draft' && cap.status !== 'returned') return no('not_editable', role, 'conflict');
      const title = String(input?.title ?? '').trim();
      const summary = String(input?.summary ?? '').trim();
      const submit = input?.submit === true;
      if (title.length > TITLE_MAX || summary.length > SUMMARY_MAX || (submit && (title.length < TITLE_MIN || summary.length < SUMMARY_MIN))) return no('invalid_capstone', role, 'invalid');
      const kind = input?.artefact_kind ? String(input.artefact_kind) : cap.artefact_kind;
      if (!(ARTEFACT_KINDS as readonly string[]).includes(kind)) return no('invalid_kind', role, 'invalid');
      if (copyProblems('', [title, summary], []).length) return no('restricted', role, 'restricted');
      const status = submit ? 'submitted' : cap.status;
      const now = nowTs();
      upd('cohort_capstones', cid, { title, summary, lang: input?.lang === 'ar' ? 'ar' : 'en', artefact_kind: kind, status, submitted_at: submit ? now : cap.submitted_at, updated_at: now });
      if (submit) notify(cap.reviewer_person_id, 'Capstone submitted for your review', 'مشروع ختامي مقدّم لمراجعتك', '/my/academies');
      return h.done<R>('academy.capstone.save', 'cohort_capstones', cid, submit ? 'submitted' : 'draft saved', role, null, '', submit ? 'Capstone submitted to your reviewer' : 'Draft saved',
        { id: cid, status }, ['cohort_capstones', 'notifications']);
    },

    async signoffCapstone(input) {
      await b.whenReady();
      type R = SignoffResult;
      const cid = String(input?.capstone_id ?? '');
      const no = (code: AcadCode, role: string | null = null, c: string = code) => h.refuse<R>('academy.capstone.signoff', 'cohort_capstones', cid || null, c, ACAD_MSG[code], role);
      const pid = me();
      if (!pid) return no('not_signed_in', null, 'not_signed_in');
      const role = ctx().actingRole('training', ['Own', 'W', 'A']);
      const cap = get('cohort_capstones', cid);
      if (!cap) return no('capstone_not_found', role, 'not_found');
      if (cap.person_id === pid) return no('self_signoff', role, 'self');
      if (cap.reviewer_person_id !== pid) return no('not_reviewer', role, 'forbidden');
      if (cap.status !== 'submitted') return no('not_submitted', role, 'conflict');
      const result = String(input?.result ?? '');
      if (!(RESULTS as readonly string[]).includes(result)) return no('invalid_result', role, 'invalid');
      const feedback = String(input?.feedback ?? '').trim();
      if (feedback.length > FEEDBACK_MAX || (result === 'not_yet' && feedback.length < 5)) return no('feedback_required', role, 'invalid');
      const a = get('academies', cap.academy_id)!;
      const now = nowTs();
      const today = todayIso();
      if (result === 'not_yet') {
        upd('cohort_capstones', cid, { status: 'returned', result, feedback, reviewed_at: now, updated_at: now });
        notify(cap.person_id, `Capstone returned for rework: ${a.name_en}`, `أُعيد المشروع الختامي للتعديل: ${a.name_ar}`, '/my/academies', 'warn');
        const m0 = get('academy_members', cap.member_id);
        return h.done<R>('academy.capstone.signoff', 'cohort_capstones', cid, 'not_yet', role, null, '', 'Returned with feedback',
          { capstone_id: cid, status: 'returned', result: 'not_yet', member_status: m0?.status ?? 'active', evidence: [] }, ['cohort_capstones', 'notifications']);
      }
      const ev = capstoneEvidence(cid, cap.person_id, (a.capstone_skills ?? []) as never, result, today, pid, a.name_en);
      for (const e of ev) {
        if (get('skill_evidence', e.id)) upd('skill_evidence', e.id, { level: e.level, observed_on: e.observed_on, active: true, note: e.note, recorded_by: pid });
        else ins('skill_evidence', { ...e, created_at: now });
      }
      upd('cohort_capstones', cid, { status: 'signed_off', result, feedback: feedback || null, reviewed_at: now, evidence_ids: ev.map((e) => e.id), updated_at: now });
      upd('academy_members', cap.member_id, { status: 'completed', completed_on: today });
      await applySkills(b, cap.person_id, today);
      notify(cap.person_id, `Capstone signed off: ${a.name_en}`, `اعتُمد المشروع الختامي: ${a.name_ar}`, '/my/academies', 'ok');
      return h.done<R>('academy.capstone.signoff', 'cohort_capstones', cid, `${result}; ${ev.length} evidence rows`, role, 'kafaa.academy.capstone_signoff', `${a.code} capstone ${result}`,
        'Capstone signed off; skills updated', { capstone_id: cid, status: 'signed_off', result: result as R['result'], member_status: 'completed', evidence: ev.map((e) => ({ skill_id: e.skill_id, level: e.level })) },
        ['cohort_capstones', 'academy_members', 'skill_evidence', 'person_skills', 'notifications']);
    },

    async academyStats() {
      await b.whenReady();
      return academyStats(raw('academies') as never, raw('academy_cohorts') as never, raw('academy_members') as never, raw('cohort_capstones') as never, raw('enrolments') as never);
    },

    async academyNominees() {
      await b.whenReady();
      const pid = me();
      if (!pid || !ctx().has('training', ['Own']) || !isStaff(pid)) return [];
      const all = owner();
      const out: Nominee[] = [{ person_id: pid, self: true }];
      for (const p of raw('people').filter((x) => x.kind === 'staff' && x.status === 'active' && x.id !== pid).sort((x, y) => (x.id < y.id ? -1 : 1))) {
        if (all || lm(p.id) === pid) out.push({ person_id: p.id, self: false });
      }
      return out;
    },
  };
}
