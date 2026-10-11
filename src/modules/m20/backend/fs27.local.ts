// FS27 + FS28 LocalBackend RPCs (FS wave D · E1, M20): time envelopes for future-skills gigs, future-role rotation tags and external
// secondments. 1:1 mirror of supabase/migrations/20261010241001_kafaa_fs41_future_gigs_secondments.sql: same checks in the same order,
// the same refusal codes and messages (futureGigs.ts EMSG, secondment.ts SMSG), the same audit rows and ledger rows. Change both together.
// The FS27 changes to postOpportunity / applyOpportunity live in backend/local.ts (same file as F08). Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { Level, PlatformRole } from '../../../auth/policy';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import { lineManagerOf } from '../domain';
import { ownerRoleOf, RMSG } from '../rotation';
import { hrRoleOf } from '../reserve';
import { EMSG, capHours, computeFutureStats, quarterBounds, sortChannels, validateEnvelope } from '../futureGigs';
import {
  CAREER_LEVEL_TRACKS, SMSG, captureTitle, capturePlannedOn, endOf, objectivesOf, secondmentStats, transferDue, validateClose, validateSecondment, validateTag,
} from '../secondment';
import type { FS27Rpc, FS28Rpc, SecondmentDesk } from './rpc';

const rid = (p: string) => `${p}-${Array.from(crypto.getRandomValues(new Uint8Array(12)), (x) => x.toString(16).padStart(2, '0')).join('')}`;
type Hist = { at: string; status: string; by: string | null; note: string | null };

export function makeLocalFS27(b: LocalBackend, h: LocalRpcHelpers): FS27Rpc & FS28Rpc {
  const me = () => b.identity().personId;
  const ctx = () => b.access();
  const notify = (id: string, person: string | null | undefined, en: string, ar: string, link: string, severity: 'info' | 'ok' | 'warn' | 'bad' = 'info') => {
    if (!person || !b.rawGet('people', person) || b.rawGet('notifications', id)) return;
    b.rawInsert('notifications', { id, person_id: person, kind: 'opportunity', title_en: en, title_ar: ar, link, severity, created_at: nowTs() } as never);
  };
  const push = (hist: unknown, status: string, note: string | null): Hist[] => [...((hist as Hist[] | null) ?? []), { at: nowTs(), status, by: me(), note }];
  const name = (id: string | null | undefined, ar = false) => {
    const p = id ? b.rawGet('people', id) : undefined;
    return p ? (ar ? p.display_name_ar || p.display_name : p.display_name) : '';
  };
  const hr = () => hrRoleOf(ctx().roles);

  return {
    // ───────────── FS27 time envelopes
    async requestEnvelope(p) {
      await b.whenReady();
      type R = { id: string; status: string; line_manager_id: string; cap_hours: number };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('envelope.request', 'time_envelopes', null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', EMSG.not_signed_in);
      const role = ctx().actingRole('opportunities', ['Own']);
      if (!role) return refuse('forbidden', EMSG.forbidden_request);
      const today = todayIso();
      const bad = validateEnvelope(p, today);
      if (bad) return refuse(bad.code, bad.message, role);
      if (b.raw('time_envelopes').some((e) => e.person_id === who && e.period === p.period && (e.status === 'requested' || e.status === 'approved'))) return refuse('conflict', EMSG.duplicate, role);
      const lm = lineManagerOf(who, b.raw('people') as never, b.raw('role_assignments') as never, today);
      if (!lm) return refuse('no_line_manager', EMSG.no_line_manager, role);
      const person = b.rawGet('people', who)!;
      const bounds = quarterBounds(p.period)!;
      const id = rid('env');
      const ts = nowTs();
      const reason = p.reason.trim();
      b.rawInsert('time_envelopes', {
        id, person_id: who, line_manager_id: lm, approver_id: null, pct: p.pct, cap_hours: capHours(p.pct), period: p.period, starts_on: bounds.start, ends_on: bounds.end,
        channels: sortChannels(p.channels), reason, status: 'requested', decision_note: null, decided_at: null,
        person_name: person.display_name, person_name_ar: person.display_name_ar || person.display_name, person_role_id: person.job_role_id ?? null, person_family_id: person.job_family_id ?? null,
        history: [{ at: ts, status: 'requested', by: who, note: reason }], open_read: false, created_at: ts, updated_at: ts,
      } as never);
      notify(`nt-${id}-requested`, lm, `Time envelope request: ${person.display_name} (${p.pct}% in ${p.period})`, `طلب وقت مخصص: ${person.display_name_ar || person.display_name} (${p.pct}% في ${p.period})`, '/opportunities/envelopes', 'info');
      return h.done<R>('envelope.request', 'time_envelopes', id, `${p.pct}% ${p.period} -> ${lm}`, role, null, '', 'Time envelope sent to your line manager', { id, status: 'requested', line_manager_id: lm, cap_hours: capHours(p.pct) }, ['time_envelopes', 'notifications']);
    },

    async approveEnvelope(id, decision, note = '') {
      await b.whenReady();
      type R = { status: string };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('envelope.decide', 'time_envelopes', id, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', EMSG.not_signed_in);
      const e = b.rawGet('time_envelopes', id);
      if (!e || !ctx().canReadRow('time_envelopes', e as never)) return refuse('not_found', EMSG.not_found);
      const role = ctx().actingRole('opportunities', ['A', 'Own']);
      if (decision !== 'approve' && decision !== 'decline' && decision !== 'withdraw') return refuse('invalid', EMSG.invalid_decision, role);
      const text = String(note ?? '').trim();
      const ts = nowTs();
      if (decision === 'withdraw') {
        if (e.person_id !== who) return refuse('forbidden', EMSG.forbidden_withdraw, role);
        if (e.status !== 'requested' && e.status !== 'approved') return refuse('invalid', EMSG.not_withdrawable, role);
        b.rawUpdate('time_envelopes', id, { status: 'withdrawn', history: push(e.history, 'withdrawn', text || null), updated_at: ts } as never);
        return h.done<R>('envelope.decide', 'time_envelopes', id, `${e.status} -> withdrawn`, role, null, '', 'Time envelope withdrawn', { status: 'withdrawn' }, ['time_envelopes']);
      }
      if (e.person_id === who) return refuse('maker_checker', EMSG.maker_checker, role);
      if (e.line_manager_id !== who) return refuse('forbidden', EMSG.forbidden_decide, role);
      if (e.status !== 'requested') return refuse('invalid', EMSG.not_requested, role);
      if (decision === 'decline' && text.length < 5) return refuse('invalid', EMSG.decline_reason, role);
      const status = decision === 'approve' ? 'approved' : 'declined';
      b.rawUpdate('time_envelopes', id, { status, approver_id: decision === 'approve' ? who : null, decision_note: text || null, decided_at: ts, history: push(e.history, status, text || null), updated_at: ts } as never);
      notify(`nt-${id}-${status}`, e.person_id, status === 'approved' ? `Time envelope approved: ${e.pct}% in ${e.period}` : `Time envelope declined: ${e.period}`, status === 'approved' ? `تمت الموافقة على الوقت المخصص: ${e.pct}% في ${e.period}` : `رُفض الوقت المخصص: ${e.period}`, '/opportunities/envelope', status === 'approved' ? 'ok' : 'warn');
      return h.done<R>('envelope.decide', 'time_envelopes', id, `requested -> ${status}`, role, status === 'approved' ? 'kafaa.envelope.approve' : null, `Time envelope ${id} (${e.pct}% ${e.period}) approved for ${e.person_id}`,
        status === 'approved' ? 'Time envelope approved' : 'Time envelope declined', { status }, ['time_envelopes', 'notifications']);
    },

    async futureGigStats() {
      await b.whenReady();
      const c = ctx();
      if (!me() || !(c.has('opportunities', ['Agg', 'A']) || c.has('audit_log', ['R']))) return null;
      const opps = b.raw('opportunities');
      const future = new Set(opps.filter((o) => o.channel).map((o) => o.id));
      const apps = b.raw('opportunity_applications');
      const futureApps = new Set(apps.filter((a) => future.has(a.opportunity_id)).map((a) => a.id));
      const ev = b.raw('skill_evidence').filter((e) => e.kind === 'ojt' && e.ref_table === 'opportunity_applications' && e.active && futureApps.has(String(e.ref_id))).length;
      return computeFutureStats(opps as never, apps as never, b.raw('time_envelopes') as never, ev);
    },

    // ───────────── FS28 future-role rotations
    async tagFutureRotation(p) {
      await b.whenReady();
      type R = { id: string; future_track: string | null };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('rotation.future.tag', 'rotation_templates', p?.template_id ?? null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', SMSG.not_signed_in);
      const role = ownerRoleOf((r, lv) => ctx().roleGrant(r as PlatformRole, 'opportunities', lv as Level));
      if (!role) return refuse('forbidden', SMSG.forbidden_owner);
      const t = b.rawGet('rotation_templates', String(p?.template_id ?? ''));
      if (!t) return refuse('not_found', SMSG.template_not_found, role);
      if (t.owner_id !== who && role !== 'training_manager') return refuse('forbidden', RMSG.forbidden_template, role);
      const bad = validateTag(p, b.raw('job_roles') as never);
      if (bad) return refuse(bad.code, bad.message, role);
      const track = p.track ?? null;
      b.rawUpdate('rotation_templates', t.id, { future_track: track, future_role_ids: track ? [...p.future_role_ids] : [], career_level_only: !!track && CAREER_LEVEL_TRACKS.includes(track), updated_at: nowTs() } as never);
      return h.done<R>('rotation.future.tag', 'rotation_templates', t.id, track ? `future ${track}: ${p.future_role_ids.join(',')}` : 'future untagged', role, null, '', track ? 'Marked as a future-role rotation' : 'Future-role tag removed', { id: t.id, future_track: track }, ['rotation_templates']);
    },

    // ───────────── FS28 secondments
    async planSecondment(p) {
      await b.whenReady();
      type R = { id: string; end_on: string; line_manager_id: string };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('secondment.plan', 'secondments', null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', SMSG.not_signed_in);
      const role = hr();
      if (!role) return refuse('forbidden', SMSG.forbidden_hr, ctx().actingRole('opportunities', ['W', 'A', 'Own']));
      const today = todayIso();
      const bad = validateSecondment(p, { people: b.raw('people') as never, skills: b.raw('skills') as never, roles: b.raw('job_roles') as never, orgs: b.raw('organisations').map((o) => o.id) }, today);
      if (bad) return refuse(bad.code, bad.message, role);
      const end = endOf(p.start_on, p.months);
      if (b.raw('secondments').some((s) => s.person_id === p.person_id && s.status === 'planned' && s.start_on <= end && s.end_on >= p.start_on)) return refuse('conflict', SMSG.overlap, role);
      const lm = lineManagerOf(p.person_id, b.raw('people') as never, b.raw('role_assignments') as never, today);
      if (!lm) return refuse('no_line_manager', SMSG.no_line_manager, role);
      const person = b.rawGet('people', p.person_id)!;
      const id = rid('sec');
      const ts = nowTs();
      b.rawInsert('secondments', {
        id, person_id: p.person_id, host_kind: p.host_kind as never, host_org_id: p.host_org_id || null, host_name_en: p.host_name_en.trim(), host_name_ar: p.host_name_ar.trim(), host_country: p.host_country,
        supervisor_en: p.supervisor_en.trim(), supervisor_ar: p.supervisor_ar.trim(), objectives: objectivesOf(p.objectives), future_role_id: p.future_role_id || null, track: (p.track || null) as never,
        start_on: p.start_on, end_on: end, months: p.months, line_manager_id: lm, planned_by: who, status: 'planned', returned_on: null, closed_by: null, closed_at: null, outcome_note: null, objectives_met: {},
        transfer_due_on: null, capture_session_id: null, person_name: person.display_name, person_name_ar: person.display_name_ar || person.display_name, person_role_id: person.job_role_id ?? null, person_family_id: person.job_family_id ?? null,
        history: [{ at: ts, status: 'planned', by: who, note: null }], open_read: false, created_at: ts, updated_at: ts,
      } as never);
      notify(`nt-${id}-planned`, p.person_id, `Secondment planned: ${p.host_name_en}`, `تم التخطيط لإعارة: ${p.host_name_ar}`, '/opportunities/secondments', 'ok');
      notify(`nt-${id}-manager`, lm, `Secondment planned for ${person.display_name}: ${p.host_name_en}`, `تم التخطيط لإعارة ${person.display_name_ar || person.display_name}: ${p.host_name_ar}`, '/opportunities/secondments', 'info');
      return h.done<R>('secondment.plan', 'secondments', id, `${p.person_id} -> ${p.host_kind} ${p.start_on}..${end}`, role, 'kafaa.secondment.plan', `Secondment ${id} planned for ${p.person_id} (${p.host_kind}, ${p.months} months)`,
        'Secondment planned', { id, end_on: end, line_manager_id: lm }, ['secondments', 'notifications']);
    },

    async closeSecondment(id, decision, p) {
      await b.whenReady();
      type R = { status: string; capture_session_id: string | null; transfer_due_on: string | null };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('secondment.close', 'secondments', id, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', SMSG.not_signed_in);
      const role = hr();
      if (!role) return refuse('forbidden', SMSG.forbidden_hr, ctx().actingRole('opportunities', ['W', 'A', 'Own']));
      const s = b.rawGet('secondments', id);
      if (!s) return refuse('not_found', SMSG.not_found, role);
      const today = todayIso();
      const bad = validateClose(s as never, decision, p ?? {}, today);
      if (bad) return refuse(bad.code, bad.message, role);
      const ts = nowTs();
      const text = String(p?.outcome_note ?? '').trim();
      if (decision === 'cancel') {
        b.rawUpdate('secondments', id, { status: 'cancelled', outcome_note: text, closed_by: who, closed_at: ts, history: push(s.history, 'cancelled', text), updated_at: ts } as never);
        notify(`nt-${id}-cancelled`, s.person_id, `Secondment cancelled: ${s.host_name_en}`, `أُلغيت الإعارة: ${s.host_name_ar}`, '/opportunities/secondments', 'warn');
        return h.done<R>('secondment.close', 'secondments', id, 'planned -> cancelled', role, null, '', 'Secondment cancelled', { status: 'cancelled', capture_session_id: null, transfer_due_on: null }, ['secondments', 'notifications']);
      }
      const iv = s.line_manager_id;
      const ivp = iv ? b.rawGet('people', iv) : undefined;
      if (!iv || iv === s.person_id || !ivp || ivp.status !== 'active') return refuse('no_interviewer', SMSG.no_interviewer, role);
      const returned = p.returned_on as string;
      const due = transferDue(returned);
      const cs = `cs-sec-${id}`;
      const objs = (s.objectives as { skill_id: string }[] | null) ?? [];
      if (!b.rawGet('capture_sessions', cs))
        b.rawInsert('capture_sessions', {
          id: cs, sme_id: s.person_id, interviewer_id: iv, created_by: who, template: 'critical_decisions', title: captureTitle(s.host_name_en), lang: 'en', status: 'planned',
          planned_on: capturePlannedOn(returned, today), held_on: null, duration_min: 60, skill_ids: objs.map((o) => o.skill_id), standard_ids: [], position_id: null, action_id: null,
          transcript: '', transcript_words: 0, notes: `Return-and-transfer obligation for secondment ${id}; due by ${due}`, asset_id: null,
          sme_name: name(s.person_id), sme_name_ar: name(s.person_id, true), interviewer_name: name(iv), interviewer_name_ar: name(iv, true),
          history: [{ at: ts, status: 'planned', by: who, note: null }], created_at: ts, updated_at: ts,
        } as never);
      b.rawUpdate('secondments', id, {
        status: 'returned', returned_on: returned, outcome_note: text, objectives_met: { ...(p.met as Record<string, boolean>) }, transfer_due_on: due, capture_session_id: cs,
        closed_by: who, closed_at: ts, history: push(s.history, 'returned', text), updated_at: ts,
      } as never);
      notify(`nt-${id}-returned`, s.person_id, `Welcome back. Share what you learned at ${s.host_name_en} by ${due}`, `مرحباً بعودتك. شارك ما تعلمته في ${s.host_name_ar} قبل ${due}`, '/knowledge/capture', 'info');
      notify(`nt-${id}-capture`, iv, `Knowledge-capture session to run with ${s.person_name} by ${due}`, `جلسة التقاط معرفة مع ${s.person_name_ar || s.person_name} قبل ${due}`, '/knowledge/capture', 'info');
      return h.done<R>('secondment.close', 'secondments', id, `planned -> returned; capture ${cs} due ${due}`, role, 'kafaa.secondment.return', `Secondment ${id} closed on return; knowledge-capture session ${cs} due ${due}`,
        'Secondment closed; knowledge-capture session created', { status: 'returned', capture_session_id: cs, transfer_due_on: due }, ['secondments', 'capture_sessions', 'notifications']);
    },

    async secondmentDesk(): Promise<SecondmentDesk | null> {
      await b.whenReady();
      const role = hr();
      const audit = ctx().has('audit_log', ['R']);
      if (!me() || (!role && !audit)) return null;
      const rows = [...b.raw('secondments')].sort((x, y) => (x.start_on < y.start_on ? 1 : x.start_on > y.start_on ? -1 : x.id < y.id ? -1 : 1));
      const ids = new Set(rows.map((r) => r.capture_session_id).filter(Boolean) as string[]);
      const sessions = b.raw('capture_sessions').filter((c) => ids.has(c.id)).map((c) => ({ id: c.id, status: c.status, planned_on: c.planned_on })).sort((x, y) => (x.id < y.id ? -1 : 1));
      const today = todayIso();
      const people = b.raw('people')
        .filter((x) => x.kind === 'staff' && x.status === 'active' && !['security', 'cyber', 'safeguards'].includes(String(x.job_family_id ?? '')))
        .map((x) => ({ id: x.id, name: x.display_name, name_ar: x.display_name_ar || x.display_name, family_id: x.job_family_id ?? null, role_id: x.job_role_id ?? null }))
        .sort((x, y) => (x.id < y.id ? -1 : 1));
      return { rows: rows as never, sessions, stats: secondmentStats(rows as never, new Map(sessions.map((x) => [x.id, x])), today), people, can_edit: !!role };
    },

    async secondmentOverview() {
      await b.whenReady();
      if (!me() || !ctx().has('opportunities', ['R'])) return null;
      const rows = b.raw('secondments');
      const ids = new Set(rows.map((r) => r.capture_session_id).filter(Boolean) as string[]);
      const sessions = new Map(b.raw('capture_sessions').filter((c) => ids.has(c.id)).map((c) => [c.id, { status: c.status }]));
      return secondmentStats(rows as never, sessions, todayIso());
    },
  };
}
