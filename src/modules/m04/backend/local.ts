// M04 extension LocalBackend RPCs (owner: W2 · E3, F13 Mentoring 2.0). Installed on every LocalRpc instance by src/data/ext/local.ts.
// 1:1 mirror of supabase/migrations/20261009123001_kafaa_w2e3_mentoring_refreshers.sql: same checks in the same order, the same
// refusal codes and messages (src/modules/m04/mentoring.ts MSG), one audit row per call and the same ledger events. Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { Result } from '../../../data/types';
import { nowTs } from '../../../data/audit';
import { newId } from '../../../data/local/store';
import { applySkills } from '../../../data/local/rpc.w0';
import { todayIso } from '../../../domain/rules';
import { evidenceId } from '../../../domain/skills';
import {
  MESSAGE_MAX, MIN_MINUTES, MAX_MINUTES, MSG, NOTE_MAX, TOPICS_MAX, agreementIdFor, attainmentPct, cleanGoals, cleanRatings, cleanSkillIds, freePlaces, isIsoDate,
  isMentoringType, ktValidation, lineManagerOf, privateNoteId, programmeStats, reportingChain, termsError,
  type AgreementLite, type Goal, type MentoringCode, type MentorRowLite, type Rating, type SkillLite,
} from '../mentoring';
import type { CloseOutResult, M04Rpc, SmeNominee } from './rpc';

type Row = Record<string, any>;

export function makeLocalM04(b: LocalBackend, h: LocalRpcHelpers): M04Rpc {
  const me = () => b.identity().personId;
  const staffRole = () => b.access().actingRole('dev_plans', ['Own', 'Scope', 'A']);
  const skills = () => new Map((b.raw('skills') as unknown as SkillLite[]).map((s) => [s.id, s]));
  const people = () => b.raw('people') as never[];
  const assignments = () => b.raw('role_assignments') as never[];
  const lm = (person: string) => lineManagerOf(person, people(), assignments(), todayIso());
  const notify = (person: string | null | undefined, en: string, ar: string, link: string, severity: 'info' | 'ok' | 'warn' = 'info') => {
    if (!person || !b.rawGet('people', person)) return;
    b.rawInsert('notifications', { id: newId('nt'), person_id: person, kind: 'mentoring', title_en: en, title_ar: ar, link, severity, created_at: nowTs() } as never);
  };
  const party = (a: Row | undefined, who: string) => !!a && (a.person_id === who || a.mentor_person_id === who);

  return {
    async requestMentoring(input) {
      await b.whenReady();
      type R = { id: string };
      const who = me();
      const mentorId = String(input?.mentor_id ?? '');
      const no = (code: MentoringCode, role: string | null = null) => h.refuse<R>('mentoring.request', 'mentoring_requests', mentorId || null, code, MSG[code], role);
      if (!who) return no('not_signed_in');
      const role = staffRole();
      if (!role) return no('forbidden');
      const m = b.rawGet('mentors', mentorId) as unknown as MentorRowLite | undefined;
      if (!m) return no('mentor_not_found', role);
      if (!isMentoringType(input.mentoring_type)) return no('invalid_type', role);
      if (m.person_id === who) return no('self', role);
      if (!m.opt_in) return no('not_opted_in', role);
      if (lm(who) === m.person_id) return no('own_manager', role);
      const ids = cleanSkillIds(input.skill_ids ?? [], skills());
      if (!ids) return no('invalid_skills', role);
      const message = String(input.message ?? '').trim();
      if (message.length > MESSAGE_MAX) return no('invalid_message', role);
      const reqs = b.raw('mentoring_requests') as Row[];
      if (reqs.some((r) => r.person_id === who && r.mentor_id === m.id && ['requested', 'matched'].includes(r.status))
        || (b.raw('mentoring_agreements') as Row[]).some((a) => a.person_id === who && a.mentor_id === m.id && ['proposed', 'active', 'closing'].includes(a.status))) return no('already_open', role);
      if (freePlaces(m, reqs as never) === 0) return no('no_capacity', role);
      const id = newId('mr');
      b.rawInsert('mentoring_requests', { id, person_id: who, mentor_id: m.id, mentor_person_id: m.person_id, interest: input.mentoring_type, message, status: 'requested', created_at: nowTs(), responded_at: null, mentoring_type: input.mentoring_type, skill_ids: ids } as never);
      notify(m.person_id, 'New mentoring request', 'طلب إرشاد جديد', '/my/mentoring');
      return h.done<R>('mentoring.request', 'mentoring_requests', id, `${m.id} ${input.mentoring_type} ${ids.length} skills`, role, null, '', 'Request sent. The mentor decides whether to accept.', { id }, ['mentoring_requests', 'notifications']);
    },

    async proposeAgreement(requestId, terms) {
      await b.whenReady();
      type R = { id: string; status: 'proposed' };
      const who = me();
      const no = (code: MentoringCode, role: string | null = null) => h.refuse<R>('mentoring.propose', 'mentoring_agreements', requestId || null, code, MSG[code], role);
      if (!who) return no('not_signed_in');
      const role = staffRole();
      if (!role) return no('forbidden');
      const r = b.rawGet('mentoring_requests', requestId) as Row | undefined;
      const mentorPerson = r ? (r.mentor_person_id ?? (r.mentor_id ? (b.rawGet('mentors', r.mentor_id) as Row | undefined)?.person_id : null)) : null;
      if (!r || (who !== r.person_id && who !== mentorPerson)) return no('request_not_found', role);
      if (r.status !== 'matched' || !r.mentor_id || !mentorPerson) return no('not_matched', role);
      if (lm(r.person_id) === mentorPerson) return h.refuse<R>('mentoring.propose', 'mentoring_agreements', requestId, 'own_manager', MSG.own_manager_pair, role);
      const aid = agreementIdFor(r.id);
      const cur = b.rawGet('mentoring_agreements', aid) as Row | undefined;
      if (cur && ['active', 'closing', 'closed'].includes(cur.status)) return no('agreement_exists', role);
      const goals = cleanGoals(terms?.goals, skills());
      if (!goals) return no('invalid_goals', role);
      const bad = termsError(terms?.cadence, terms?.starts_on, terms?.ends_on, todayIso());
      if (bad) return no(bad, role);
      const ts = nowTs();
      const row = {
        mentor_id: r.mentor_id, person_id: r.person_id, mentor_person_id: mentorPerson, mentoring_type: r.mentoring_type ?? 'career', goals, cadence: terms.cadence,
        starts_on: terms.starts_on, ends_on: terms.ends_on, status: 'proposed', proposed_by: who, proposed_at: ts, responded_at: null, decline_note: null, updated_at: ts,
      };
      if (cur) b.rawUpdate('mentoring_agreements', aid, row as never);
      else b.rawInsert('mentoring_agreements', { id: aid, request_id: r.id, ...row, mentee_ratings: null, mentor_ratings: null, mentee_note: null, mentor_note: null, mentee_closed_at: null, mentor_closed_at: null, closed_at: null, attainment_pct: null, validated_skill_ids: [], validated_claim_ids: [] } as never);
      notify(who === r.person_id ? mentorPerson : r.person_id, 'Mentoring agreement proposed: please review', 'اقتراح اتفاقية إرشاد: يُرجى المراجعة', `/my/mentoring/${aid}`);
      return h.done<R>('mentoring.propose', 'mentoring_agreements', aid, `${row.mentoring_type} ${goals.length} goals ${terms.cadence} ${terms.starts_on}..${terms.ends_on}`, role, null, '', 'Agreement proposed. The other person accepts or declines it.', { id: aid, status: 'proposed' }, ['mentoring_agreements', 'notifications']);
    },

    async respondAgreement(agreementId, decision, note) {
      await b.whenReady();
      type R = { id: string; status: string };
      const who = me();
      const no = (code: MentoringCode | 'invalid_message', role: string | null = null) => h.refuse<R>('mentoring.respond_agreement', 'mentoring_agreements', agreementId || null, code, MSG[code], role);
      if (!who) return no('not_signed_in');
      const role = staffRole();
      if (!role) return no('forbidden');
      const a = b.rawGet('mentoring_agreements', agreementId) as Row | undefined;
      if (!a || !party(a, who)) return no('agreement_not_found', role);
      if (decision !== 'accept' && decision !== 'decline') return no('invalid_decision', role);
      if (a.status !== 'proposed') return no('not_proposed', role);
      if (a.proposed_by === who) return no('own_proposal', role);
      const text = String(note ?? '').trim();
      if (text.length > MESSAGE_MAX) return no('invalid_message', role);
      const ts = nowTs();
      if (decision === 'decline') {
        b.rawUpdate('mentoring_agreements', a.id, { status: 'declined', responded_at: ts, decline_note: text || null, updated_at: ts } as never);
        notify(a.proposed_by, 'Mentoring agreement returned: revise and propose again', 'أُعيدت اتفاقية الإرشاد: عدّلها واقترحها مجدداً', `/my/mentoring/${a.id}`, 'warn');
        return h.done<R>('mentoring.respond_agreement', 'mentoring_agreements', a.id, 'declined', role, null, '', 'Agreement returned to the proposer', { id: a.id, status: 'declined' }, ['mentoring_agreements', 'notifications']);
      }
      b.rawUpdate('mentoring_agreements', a.id, { status: 'active', responded_at: ts, decline_note: null, updated_at: ts } as never);
      notify(a.proposed_by, 'Mentoring agreement accepted', 'قُبلت اتفاقية الإرشاد', `/my/mentoring/${a.id}`, 'ok');
      return h.done<R>('mentoring.respond_agreement', 'mentoring_agreements', a.id, 'accepted', role, 'kafaa.mentoring.agreement', `Mentoring agreement ${a.id} (${a.mentoring_type}) active until ${a.ends_on}`, 'Agreement accepted: mentoring is under way', { id: a.id, status: 'active' }, ['mentoring_agreements', 'notifications']);
    },

    async logSession(agreementId, input) {
      await b.whenReady();
      type R = { id: string; logged: number };
      const who = me();
      const no = (code: MentoringCode, role: string | null = null) => h.refuse<R>('mentoring.session', 'mentoring_sessions', agreementId || null, code, MSG[code], role);
      if (!who) return no('not_signed_in');
      const role = staffRole();
      if (!role) return no('forbidden');
      const a = b.rawGet('mentoring_agreements', agreementId) as Row | undefined;
      if (!a || !party(a, who)) return no('agreement_not_found', role);
      if (a.status !== 'active') return no('not_active', role);
      const today = todayIso();
      const goalSkills = new Set((a.goals as Goal[]).map((g) => g.skill_id));
      const ids = Array.isArray(input?.skill_ids) ? input.skill_ids : null;
      const minutes = input?.minutes;
      if (!isIsoDate(input?.held_on) || input.held_on < a.starts_on || input.held_on > today || typeof minutes !== 'number' || !Number.isInteger(minutes) || minutes < MIN_MINUTES || minutes > MAX_MINUTES
        || !ids || ids.length < 1 || new Set(ids).size !== ids.length || ids.some((s) => typeof s !== 'string' || !goalSkills.has(s))) return no('invalid_session', role);
      const topics = String(input.topics ?? '').trim();
      const shared = String(input.note_shared ?? '').trim();
      const priv = String(input.note_private ?? '').trim();
      if (topics.length > TOPICS_MAX || shared.length > NOTE_MAX || priv.length > NOTE_MAX) return no('invalid_note', role);
      const id = newId('ms');
      const ts = nowTs();
      b.rawInsert('mentoring_sessions', { id, agreement_id: a.id, person_id: a.person_id, mentor_person_id: a.mentor_person_id, held_on: input.held_on, minutes, skill_ids: [...ids].sort(), topics, note_shared: shared, logged_by: who, logged_at: ts } as never);
      if (priv) b.rawInsert('mentoring_private_notes', { id: privateNoteId(id, who), session_id: id, agreement_id: a.id, author_person_id: who, note: priv, updated_at: ts } as never);
      const logged = (b.raw('mentoring_sessions') as Row[]).filter((s) => s.agreement_id === a.id).length;
      return h.done<R>('mentoring.session', 'mentoring_sessions', id, `${a.id} ${input.held_on} ${minutes} min ${ids.length} skills${priv ? ' +private note' : ''}`, role, null, '', 'Session logged', { id, logged }, ['mentoring_sessions', 'mentoring_private_notes']);
    },

    async closeAgreement(agreementId, input) {
      await b.whenReady();
      type R = CloseOutResult;
      const who = me();
      const no = (code: MentoringCode, role: string | null = null) => h.refuse<R>('mentoring.close', 'mentoring_agreements', agreementId || null, code, MSG[code], role);
      if (!who) return no('not_signed_in');
      const role = staffRole();
      if (!role) return no('forbidden');
      const a = b.rawGet('mentoring_agreements', agreementId) as Row | undefined;
      if (!a || !party(a, who)) return no('agreement_not_found', role);
      if (!['active', 'closing'].includes(a.status)) return no('not_closable', role);
      const side = who === a.person_id ? 'mentee' : 'mentor';
      if (a[`${side}_closed_at`]) return no('already_closed', role);
      const ratings = cleanRatings(input?.ratings, a.goals as Goal[]);
      if (!ratings) return no('invalid_ratings', role);
      const note = String(input?.note ?? '').trim();
      if (note.length > NOTE_MAX) return no('invalid_note', role);
      let kt: ReturnType<typeof ktValidation> = { validated: [], skipped: [] };
      if (input?.validate) {
        if (side !== 'mentor' || a.mentoring_type !== 'knowledge_transfer') return no('validate_kt_only', role);
        const mentor = b.rawGet('mentors', a.mentor_id) as unknown as MentorRowLite | undefined;
        if (!mentor?.sme) return no('not_sme', role);
        kt = ktValidation({
          goals: a.goals, mentorRatings: ratings, mentor, menteeId: a.person_id, claims: b.raw('skill_claims') as never, skills: skills(),
          standardIds: new Set(b.raw('qual_standards').map((s) => s.id)),
        });
      }
      const ts = nowTs();
      const other = side === 'mentee' ? 'mentor' : 'mentee';
      const finished = !!a[`${other}_closed_at`];
      const patch: Row = { [`${side}_ratings`]: ratings, [`${side}_note`]: note || null, [`${side}_closed_at`]: ts, updated_at: ts };
      let pct: number | null = null;
      if (finished) {
        pct = attainmentPct(side === 'mentee' ? ratings : (a.mentee_ratings as Rating[]), side === 'mentor' ? ratings : (a.mentor_ratings as Rating[]));
        Object.assign(patch, { status: 'closed', closed_at: ts, attainment_pct: pct });
      } else patch.status = 'closing';
      if (kt.validated.length) {
        const today = todayIso();
        for (const v of kt.validated) {
          b.rawUpdate('skill_claims', v.claim_id, { status: 'validated', decided_by: who, decided_at: ts, decision_note: `Validated by the subject-matter expert mentor at the close-out of knowledge-transfer agreement ${a.id}` } as never);
          const ev = evidenceId('rating', v.claim_id, v.skill_id);
          if (b.rawGet('skill_evidence', ev)) b.rawUpdate('skill_evidence', ev, { basis: 'validated', active: true } as never);
        }
        patch.validated_skill_ids = [...new Set([...(a.validated_skill_ids ?? []), ...kt.validated.map((v) => v.skill_id)])].sort();
        patch.validated_claim_ids = [...new Set([...(a.validated_claim_ids ?? []), ...kt.validated.map((v) => v.claim_id)])].sort();
        await applySkills(b, a.person_id, today);
      }
      b.rawUpdate('mentoring_agreements', a.id, patch as never);
      if (finished && a.request_id && b.rawGet('mentoring_requests', a.request_id)) b.rawUpdate('mentoring_requests', a.request_id, { status: 'closed' } as never);
      notify(side === 'mentee' ? a.mentor_person_id : a.person_id, finished ? 'Mentoring closed: see the attainment summary' : 'Your mentoring partner submitted their close-out', finished ? 'أُغلق الإرشاد: اطّلع على ملخص الإنجاز' : 'قدّم شريكك في الإرشاد تقييم الإغلاق', `/my/mentoring/${a.id}`, finished ? 'ok' : 'info');
      const ledger = kt.validated.length ? 'kafaa.mentoring.validate' : finished ? 'kafaa.mentoring.close' : null;
      const ledgerReason = kt.validated.length ? `Knowledge-transfer close-out of ${a.id}: ${kt.validated.length} claims validated by SME mentor` : `Mentoring agreement ${a.id} closed: attainment ${pct ?? 0}%`;
      const reason = `${side} close-out${finished ? `; closed, attainment ${pct ?? 0}%` : ''}${input?.validate ? `; validated ${kt.validated.length}, skipped ${kt.skipped.length}` : ''}`;
      const tables = ['mentoring_agreements', 'mentoring_requests', 'notifications', ...(kt.validated.length ? ['skill_claims', 'skill_evidence', 'person_skills'] : [])];
      return h.done<R>('mentoring.close', 'mentoring_agreements', a.id, reason, role, ledger, ledgerReason, finished ? 'Mentoring closed' : 'Close-out recorded; waiting for the other person', { status: finished ? 'closed' : 'closing', attainment_pct: pct, validated: kt.validated, skipped: kt.skipped }, tables);
    },

    async nominateSme(mentorId, on, skillIds = []) {
      await b.whenReady();
      type R = { mentor_id: string; sme: boolean };
      const who = me();
      const no = (code: MentoringCode, role: string | null = null) => h.refuse<R>('mentoring.sme', 'mentors', mentorId || null, code, MSG[code], role);
      if (!who) return no('not_signed_in');
      const m = b.rawGet('mentors', mentorId) as unknown as MentorRowLite | undefined;
      if (!m) return no('mentor_not_found');
      if (m.person_id === who) return no('self_nominate');
      const tm = b.access().roles.includes('training_manager');
      const role = tm ? 'training_manager' : b.access().actingRole('dev_plans', ['A', 'Scope', 'Own']);
      if (!tm && lm(m.person_id) !== who) return no('forbidden_nominate', role);
      const flag = on !== false;
      let ids: string[] = [];
      if (flag) {
        const clean = cleanSkillIds(skillIds ?? [], skills(), 10);
        if (!clean || clean.some((s) => !(m.skill_ids ?? []).includes(s))) return no('invalid_skills', role);
        ids = [...clean].sort();
      }
      b.rawUpdate('mentors', m.id, { sme: flag, sme_skill_ids: ids, sme_nominated_by: flag ? who : null, sme_nominated_on: flag ? todayIso() : null } as never);
      notify(m.person_id, flag ? 'You are nominated as a subject-matter expert mentor' : 'Your subject-matter expert nomination was withdrawn', flag ? 'رُشّحت مرشداً خبيراً في الموضوع' : 'سُحب ترشيحك مرشداً خبيراً', '/my/mentoring', flag ? 'ok' : 'info');
      return h.done<R>('mentoring.sme', 'mentors', m.id, `${flag ? 'nominated' : 'withdrawn'}${flag ? ` (${ids.length || 'all offered'} skills)` : ''}`, role, 'kafaa.mentoring.sme', `SME ${flag ? 'nomination' : 'withdrawal'} for mentor ${m.id}`, flag ? 'Subject-matter expert nominated' : 'Nomination withdrawn', { mentor_id: m.id, sme: flag }, ['mentors', 'notifications']);
    },

    async smeNominees() {
      await b.whenReady();
      const who = me();
      if (!who) return [];
      const tm = b.access().roles.includes('training_manager');
      return (b.raw('mentors') as unknown as MentorRowLite[] & Row[])
        .filter((m) => m.person_id !== who && (tm || lm(m.person_id) === who))
        .sort((x, y) => (x.id < y.id ? -1 : 1))
        .map((m): SmeNominee => ({ mentor_id: m.id, person_id: m.person_id, role_id: m.role_id ?? null, skill_ids: m.skill_ids ?? [], sme: !!m.sme, sme_skill_ids: m.sme_skill_ids ?? [], sme_nominated_on: (m as Row).sme_nominated_on ?? null }));
    },

    async myReportingLine() {
      await b.whenReady();
      const who = me();
      if (!who) return { line_manager: null, chain: [] };
      return { line_manager: lm(who), chain: reportingChain(who, people(), assignments(), todayIso()) };
    },

    async mentoringProgramme() {
      await b.whenReady();
      const who = me();
      if (!who) return h.refuse('mentoring.programme', 'mentoring_agreements', null, 'not_signed_in', MSG.not_signed_in);
      if (!b.access().roles.includes('training_manager')) return h.refuse('mentoring.programme', 'mentoring_agreements', null, 'forbidden', MSG.programme_forbidden, b.access().actingRole('dev_plans', ['Own', 'Scope', 'A']));
      const data = programmeStats(b.raw('mentoring_agreements') as unknown as AgreementLite[], b.raw('mentoring_sessions') as never, b.raw('mentors') as never, b.raw('mentoring_requests') as never, todayIso());
      return { ok: true, code: 'ok', message: 'Mentoring programme', data } as Result<typeof data>;
    },
  };
}
