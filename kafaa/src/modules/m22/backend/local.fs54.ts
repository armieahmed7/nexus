// FS46-FS48 (wave E · E4, fsEe4) LocalBackend RPCs: 1:1 mirror of supabase/migrations/20261010254001_kafaa_fs54_future_leadership.sql
// (same checks in the same order, same codes and messages from ../future.ts FL_MSG / WFN_MSG, one audit row per call, the same
// ledger rows). Spread into makeLocalM22 (./local.ts). Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import { MIN_GROUP_SIZE } from '../../../auth/policy';
import { BEHAVIOUR_IDS_V2, COP_MSG, cycleOf, hasContactDetails, postGuard, restrictedMessage } from '../domain';
import {
  FL_MSG, FL_PROGRAMME_ID, WFN_INTERESTS, WFN_MAX_OPEN_REQUESTS, WFN_MSG, WFN_STRANDS, circleOpen, computeFlStats, computeProgrammeStats, flCohortFor, flReadiness, wfnStats,
  type FlComp, type FlReadiness, type WfnMember,
} from '../future';
import type { M22Rpc, WfnDeskRow } from './rpc';

type FsRpc = Pick<M22Rpc, 'leadershipProgrammeStats' | 'nominateFutureLeader' | 'flReadiness' | 'recordFlModule' | 'savePolicyProject' | 'reviewPolicyProject' | 'futureLeadersStats'
  | 'setWfnOptin' | 'joinWfnCircle' | 'requestWfnOffer' | 'decideWfnRequest' | 'wfnDesk' | 'wfnStats'>;
type Row = Record<string, any>;
const rid = (p: string) => `${p}-${Array.from(crypto.getRandomValues(new Uint8Array(12)), (x) => x.toString(16).padStart(2, '0')).join('')}`;
const len = (s: unknown) => String(s ?? '').trim().length;

export function makeLocalM22Fs(b: LocalBackend, h: LocalRpcHelpers): FsRpc {
  const me = () => b.identity().personId;
  const ctx = () => b.access();
  const raw = (t: string) => b.raw(t as never) as unknown as Row[];
  const get = (t: string, id: string) => b.rawGet(t as never, id) as unknown as Row | undefined;
  const ins = (t: string, row: Row) => b.rawInsert(t as never, row as never);
  const upd = (t: string, id: string, patch: Row) => b.rawUpdate(t as never, id, patch as never);
  const person = (id: string) => get('people', id);
  const notify = (id: string, pid: string | null | undefined, kind: string, en: string, ar: string, link: string, severity = 'info') => {
    if (!pid || !person(pid) || get('notifications', id)) return;
    ins('notifications', { id, person_id: pid, kind, title_en: en, title_ar: ar, link, severity, created_at: nowTs() });
  };
  const policies = () => raw('refusal_policies').map((p) => ({ category: p.category, patterns: p.patterns ?? [], enabled: p.enabled }));
  const screen = (text: string): { code: string; msg: string } | null => {
    const cat = postGuard(text, policies());
    if (cat) return { code: 'restricted_content', msg: restrictedMessage(cat) };
    if (hasContactDetails(text)) return { code: 'contact_details', msg: COP_MSG.contact };
    return null;
  };
  const statsGate = () => { const c = ctx(); return !!me() && (c.has('skills_profile', ['Agg', 'A']) || c.has('talent_review', ['Agg', 'A']) || c.has('audit_log', ['R'])); };
  const isTm = () => ctx().roleGrant('training_manager', 'skills_profile', 'A');
  const hist = (status: string, note: string | null = null) => ({ at: nowTs(), status, by: me(), note });
  const staffActive = (p: Row | undefined) => !!p && p.kind === 'staff' && p.status === 'active';
  const flComps = () => raw('fl_competencies') as unknown as FlComp[];
  const levelsOf = (pid: string) => new Map(raw('person_skills').filter((s) => s.person_id === pid && s.active).map((s) => [s.skill_id as string, { level: s.level as number }]));
  const flNom = (id: string) => { const n = get('leadership_nominations', id); return n && n.programme_id === FL_PROGRAMME_ID ? n : undefined; };
  const partOf = (n: Row): Row => get('fl_participants', `flp:${n.id}`) ?? {
    id: `flp:${n.id}`, nomination_id: n.id, person_id: n.person_id, cohort_id: flCohortFor(n.cycle), person_name: n.person_name, person_name_ar: n.person_name_ar,
    modules_done: [], project_status: 'none', status: 'active', history: [], _new: true,
  };
  const savePart = (p: Row, patch: Row) => {
    const { _new, ...rest } = p;
    if (_new) ins('fl_participants', { ...rest, project_title: null, project_question: null, project_summary: null, project_sponsor_role: null, project_submitted_on: null, project_reviewed_by: null, project_review_note: null, project_decided_on: null, completed_on: null, ...patch, updated_at: nowTs() });
    else upd('fl_participants', p.id, { ...patch, updated_at: nowTs() });
  };
  const wfnPart = (pid: string | null) => (pid ? get('wfn_participants', `wp:${pid}`) : undefined);

  return {
    // ═════════════ FS46
    async leadershipProgrammeStats() {
      await b.whenReady();
      if (!statsGate()) return null;
      const progs = raw('leadership_programmes').sort((x, y) => x.sort - y.sort || (x.id < y.id ? -1 : 1)).map((g) => g.id as string);
      return computeProgrammeStats(raw('leadership_360') as never, raw('leadership_nominations') as never, progs, BEHAVIOUR_IDS_V2, MIN_GROUP_SIZE);
    },

    // ═════════════ FS47
    async nominateFutureLeader(personId, reason) {
      await b.whenReady();
      type R = { id: string; status: string; cohort_id: string };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('future_leaders.nominate', 'leadership_nominations', `${FL_PROGRAMME_ID}:${personId ?? ''}`, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', FL_MSG.not_signed_in);
      const c = ctx();
      const role = c.roleGrant('hr_director', 'talent_review', 'A') ? 'hr_director' : c.roleGrant('hr_analyst', 'talent_review', 'Agg') ? 'hr_analyst' : null;
      if (!role) return refuse('forbidden', FL_MSG.forbidden_nominate);
      if (personId === who) return refuse('self_nominate', FL_MSG.self_nominate, role);
      const p = person(personId);
      if (!staffActive(p)) return refuse('not_found', FL_MSG.not_found_person, role);
      const text = String(reason ?? '').trim();
      if (text.length < 10 || text.length > 500) return refuse('invalid', FL_MSG.reason, role);
      if (raw('leadership_nominations').some((n) => n.person_id === personId && n.programme_id === FL_PROGRAMME_ID && (n.status === 'nominated' || n.status === 'approved'))) return refuse('conflict', FL_MSG.duplicate, role);
      const nm = person(who)!;
      const id = rid('ln');
      const ts = nowTs();
      const cycle = cycleOf(todayIso());
      ins('leadership_nominations', {
        id, person_id: personId, programme_id: FL_PROGRAMME_ID, nominated_by: who, reason: text, cycle, status: 'nominated',
        person_name: p!.display_name, person_name_ar: p!.display_name_ar || p!.display_name, person_role_id: p!.job_role_id ?? null, person_family_id: p!.job_family_id ?? null,
        nominator_name: nm.display_name, nominator_name_ar: nm.display_name_ar || nm.display_name, decided_by: null, decided_at: null, decision_note: null,
        history: [{ at: ts, status: 'nominated', by: who, note: null }], created_at: ts, updated_at: ts,
      });
      notify(`nt-${id}-fl-nominated`, personId, 'leadership', 'You were nominated for the Future Leaders track', 'تم ترشيحك لمسار قادة المستقبل', '/leadership/future-leaders', 'ok');
      return h.done<R>('future_leaders.nominate', 'leadership_nominations', id, `${FL_PROGRAMME_ID} for ${personId}`, role, null, '', 'Nomination sent for selection', { id, status: 'nominated', cohort_id: flCohortFor(cycle) }, ['leadership_nominations', 'notifications']);
    },

    async flReadiness(personIds) {
      await b.whenReady();
      const who = me();
      if (!who) return [];
      const c = ctx();
      const wide = c.has('talent_review', ['R', 'A']) || isTm();
      const ids = [...new Set((Array.isArray(personIds) ? personIds : []).filter((x) => typeof x === 'string'))].sort();
      const allowed = ids.filter((pid) => pid === who || (raw('leadership_nominations').some((n) => n.person_id === pid && n.programme_id === FL_PROGRAMME_ID && n.status !== 'declined')
        && (wide || (c.has('talent_review', ['Scope']) && c.inScope('talent_review', pid)))));
      const out: FlReadiness[] = allowed.map((pid) => flReadiness(pid, levelsOf(pid), flComps()));
      const others = allowed.filter((x) => x !== who);
      if (others.length) await h.done('future_leaders.readiness_read', 'fl_participants', null, `${others.length} people`, c.actingRole('talent_review', ['R', 'A', 'Scope']) ?? 'training_manager', null, '', '', null, ['audit_events']);
      return out;
    },

    async recordFlModule(nominationId, moduleId, done) {
      await b.whenReady();
      type R = { modules_done: string[] };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('future_leaders.module', 'fl_participants', nominationId ?? null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', FL_MSG.not_signed_in);
      if (!isTm()) return refuse('forbidden', FL_MSG.forbidden_record);
      const role = 'training_manager';
      const n = flNom(nominationId);
      if (!n || n.status !== 'approved') return refuse('not_found', FL_MSG.not_found, role);
      const p = partOf(n);
      const cohort = get('fl_cohorts', p.cohort_id);
      if (!cohort || cohort.status !== 'running') return refuse('invalid', FL_MSG.not_running, role);
      if (!(cohort.modules ?? []).some((m: Row) => m.id === moduleId)) return refuse('invalid', FL_MSG.module, role);
      const mods = (cohort.modules as Row[]).map((m) => m.id as string).filter((m) => (m === moduleId ? done !== false : (p.modules_done ?? []).includes(m)));
      savePart(p, { modules_done: mods, history: [...(p.history ?? []), hist(done !== false ? `module:${moduleId}` : `module_cleared:${moduleId}`)] });
      return h.done<R>('future_leaders.module', 'fl_participants', p.id, `${moduleId} ${done !== false ? 'done' : 'cleared'}`, role, null, '', done !== false ? 'Module recorded' : 'Module cleared', { modules_done: mods }, ['fl_participants']);
    },

    async savePolicyProject(input) {
      await b.whenReady();
      type R = { project_status: string };
      const x = input ?? ({} as never);
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('future_leaders.project', 'fl_participants', x.nomination_id ?? null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', FL_MSG.not_signed_in);
      const role = ctx().actingRole('skills_profile', ['Own']);
      const n = flNom(x.nomination_id);
      if (!n || n.person_id !== who || n.status !== 'approved') return refuse('forbidden', FL_MSG.not_participant, role);
      const p = partOf(n);
      if (p.project_status === 'accepted') return refuse('conflict', FL_MSG.project_locked, role);
      if (len(x.title) < 5 || len(x.title) > 140) return refuse('invalid', FL_MSG.title, role);
      if (len(x.question) < 10 || len(x.question) > 300) return refuse('invalid', FL_MSG.question, role);
      if (len(x.summary) < 20 || len(x.summary) > 1500) return refuse('invalid', FL_MSG.summary, role);
      if (len(x.sponsor_role) < 3 || len(x.sponsor_role) > 80) return refuse('invalid', FL_MSG.sponsor, role);
      const bad = screen(`${x.title} ${x.question} ${x.summary} ${x.sponsor_role}`);
      if (bad) return refuse(bad.code, bad.msg, role);
      const status = x.submit ? 'submitted' : 'draft';
      savePart(p, {
        project_title: String(x.title).trim(), project_question: String(x.question).trim(), project_summary: String(x.summary).trim(), project_sponsor_role: String(x.sponsor_role).trim(),
        project_status: status, project_submitted_on: x.submit ? todayIso() : p.project_submitted_on ?? null, history: [...(p.history ?? []), hist(`project:${status}`)],
      });
      return h.done<R>('future_leaders.project', 'fl_participants', p.id, status, role, null, '', x.submit ? 'Policy project submitted for review' : 'Draft saved', { project_status: status }, ['fl_participants']);
    },

    async reviewPolicyProject(nominationId, decision, note = '') {
      await b.whenReady();
      type R = { project_status: string; completed: boolean };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('future_leaders.review', 'fl_participants', nominationId ?? null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', FL_MSG.not_signed_in);
      const c = ctx();
      const role = c.has('talent_review', ['A']) ? c.actingRole('talent_review', ['A']) : isTm() ? 'training_manager' : null;
      if (!role) return refuse('forbidden', FL_MSG.forbidden_review);
      const n = flNom(nominationId);
      if (!n || n.status !== 'approved') return refuse('not_found', FL_MSG.not_found, role);
      if (n.person_id === who) return refuse('maker_checker', FL_MSG.maker_checker, role);
      const p = get('fl_participants', `flp:${n.id}`);
      if (!p || p.project_status !== 'submitted') return refuse('invalid', FL_MSG.not_submitted, role);
      if (decision !== 'accept' && decision !== 'return') return refuse('invalid', FL_MSG.invalid_decision, role);
      const text = String(note ?? '').trim();
      if (decision === 'return' && (text.length < 5 || text.length > 500)) return refuse('invalid', FL_MSG.return_note, role);
      const today = todayIso();
      const cohort = get('fl_cohorts', p.cohort_id);
      const allDone = decision === 'accept' && !!cohort && (cohort.modules as Row[]).every((m) => (p.modules_done ?? []).includes(m.id));
      const status = decision === 'accept' ? 'accepted' : 'returned';
      upd('fl_participants', p.id, {
        project_status: status, project_reviewed_by: who, project_review_note: text || null, project_decided_on: today,
        status: allDone ? 'completed' : p.status, completed_on: allDone ? today : p.completed_on ?? null, history: [...(p.history ?? []), hist(`project:${status}`, text || null)], updated_at: nowTs(),
      });
      if (allDone) upd('leadership_nominations', n.id, { status: 'completed', history: [...((n.history as unknown[]) ?? []), hist('completed', 'Future Leaders track completed')], updated_at: nowTs() });
      notify(`nt-${p.id}-project-${status}`, n.person_id, 'leadership', decision === 'accept' ? 'Your Future Leaders policy project was accepted' : 'Your Future Leaders policy project was returned with a note',
        decision === 'accept' ? 'تم قبول مشروع السياسات الخاص بك في مسار قادة المستقبل' : 'أُعيد مشروع السياسات الخاص بك في مسار قادة المستقبل مع ملاحظة', '/leadership/future-leaders', decision === 'accept' ? 'ok' : 'info');
      return h.done<R>('future_leaders.review', 'fl_participants', p.id, allDone ? 'accepted; track completed' : status, role, allDone ? 'kafaa.leadership.future_leaders_complete' : null, `Future Leaders track completed (${n.id})`,
        allDone ? 'Project accepted: the participant completed the track' : decision === 'accept' ? 'Project accepted' : 'Project returned to the participant', { project_status: status, completed: allDone }, ['fl_participants', 'leadership_nominations', 'notifications']);
    },

    async futureLeadersStats() {
      await b.whenReady();
      if (!statsGate()) return null;
      return computeFlStats(raw('leadership_nominations') as never, raw('fl_participants') as never, raw('fl_cohorts') as never, MIN_GROUP_SIZE);
    },

    // ═════════════ FS48
    async setWfnOptin(input) {
      await b.whenReady();
      type R = { active: boolean };
      const who = me();
      const x = input ?? ({ active: false } as never);
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>(x.active ? 'wfn.optin' : 'wfn.withdraw', 'wfn_participants', who ? `wp:${who}` : null, code, msg, role);
      if (!who) return refuse('not_signed_in', WFN_MSG.not_signed_in);
      const role = ctx().actingRole('knowledge', ['R']);
      if (!role || !staffActive(person(who))) return refuse('forbidden', WFN_MSG.forbidden, role);
      const id = `wp:${who}`;
      const cur = get('wfn_participants', id);
      const today = todayIso();
      if (x.active) {
        const interests = [...new Set(Array.isArray(x.interests) ? x.interests : [])];
        const strands = [...new Set(Array.isArray(x.strands) ? x.strands : [])];
        if (interests.length < 1 || interests.length > 4 || interests.some((i) => !(WFN_INTERESTS as readonly string[]).includes(i))) return refuse('invalid', WFN_MSG.interests, role);
        if (strands.length < 1 || strands.some((s) => !(WFN_STRANDS as readonly string[]).includes(s))) return refuse('invalid', WFN_MSG.strands, role);
        const row = { active: true, interests: [...interests].sort(), strands: WFN_STRANDS.filter((s) => strands.includes(s)), mentor: x.mentor === true, withdrawn_on: null, updated_at: nowTs() };
        if (cur) upd('wfn_participants', id, { ...row, joined_on: cur.active ? cur.joined_on : today });
        else ins('wfn_participants', { id, person_id: who, ...row, joined_on: today });
        return h.done<R>('wfn.optin', 'wfn_participants', id, 'opted in', role, null, '', 'You joined the network. Only you can see your choices', { active: true }, ['wfn_participants']);
      }
      // withdraw: no trace left in any ranking (choices blanked, memberships ended, open requests withdrawn)
      if (cur) upd('wfn_participants', id, { active: false, interests: [], strands: [], mentor: false, withdrawn_on: today, updated_at: nowTs() });
      for (const m of raw('wfn_circle_members').filter((m) => m.person_id === who && m.active)) upd('wfn_circle_members', m.id, { active: false, left_on: today });
      for (const q of raw('wfn_requests').filter((q) => q.person_id === who && ['interested', 'shortlisted'].includes(q.status))) upd('wfn_requests', q.id, { status: 'withdrawn', history: [...(q.history ?? []), hist('withdrawn')], updated_at: nowTs() });
      return h.done<R>('wfn.withdraw', 'wfn_participants', id, 'withdrawn', role, null, '', 'You left the network. Your choices were cleared and you no longer appear anywhere in it', { active: false }, ['wfn_participants', 'wfn_circle_members', 'wfn_requests']);
    },

    async joinWfnCircle(circleId, join) {
      await b.whenReady();
      type R = { member: boolean; role: string | null };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('wfn.circle', 'wfn_circle_members', circleId ?? null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', WFN_MSG.not_signed_in);
      const role = ctx().actingRole('knowledge', ['R']);
      if (!role) return refuse('forbidden', WFN_MSG.forbidden);
      const p = wfnPart(who);
      if (!p || !p.active) return refuse('forbidden', WFN_MSG.not_opted_in, role);
      const circ = get('wfn_circles', circleId);
      if (!circ) return refuse('not_found', WFN_MSG.not_found_circle, role);
      const id = `wcm:${circleId}:${who}`;
      const cur = get('wfn_circle_members', id);
      const today = todayIso();
      if (join === false) {
        if (cur && cur.active) upd('wfn_circle_members', id, { active: false, left_on: today });
        return h.done<R>('wfn.circle', 'wfn_circle_members', id, 'left', role, null, '', 'You left the circle', { member: false, role: null }, ['wfn_circle_members']);
      }
      if (circ.status !== 'active') return refuse('invalid', WFN_MSG.circle_closed, role);
      if (cur && cur.active) return h.done<R>('wfn.circle', 'wfn_circle_members', id, `already ${cur.role}`, role, null, '', 'You are already in this circle', { member: true, role: cur.role }, ['wfn_circle_members']);
      const members = raw('wfn_circle_members') as unknown as WfnMember[];
      const asMentor = p.mentor === true && !members.some((m) => m.circle_id === circleId && m.active && m.role === 'mentor');
      if (!asMentor && !circleOpen(circ as never, members)) return refuse('conflict', WFN_MSG.circle_full, role);
      const r = asMentor ? 'mentor' : 'member';
      if (cur) upd('wfn_circle_members', id, { active: true, role: r, joined_on: today, left_on: null });
      else ins('wfn_circle_members', { id, circle_id: circleId, person_id: who, role: r, active: true, joined_on: today, left_on: null });
      return h.done<R>('wfn.circle', 'wfn_circle_members', id, `joined as ${r}`, role, null, '', asMentor ? 'You joined the circle as its mentor' : 'You joined the circle', { member: true, role: r }, ['wfn_circle_members']);
    },

    async requestWfnOffer(offerId, statement) {
      await b.whenReady();
      type R = { id: string };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('wfn.request', 'wfn_requests', offerId ?? null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', WFN_MSG.not_signed_in);
      const role = ctx().actingRole('knowledge', ['R']);
      if (!role) return refuse('forbidden', WFN_MSG.forbidden);
      const p = wfnPart(who);
      if (!p || !p.active) return refuse('forbidden', WFN_MSG.not_opted_in, role);
      const o = get('wfn_offers', offerId);
      if (!o) return refuse('not_found', WFN_MSG.not_found_offer, role);
      if (o.status !== 'open' || o.closes_on < todayIso()) return refuse('invalid', WFN_MSG.offer_closed, role);
      const open = raw('wfn_requests').filter((q) => q.person_id === who && ['interested', 'shortlisted'].includes(q.status));
      if (raw('wfn_requests').some((q) => q.person_id === who && q.offer_id === offerId && ['interested', 'shortlisted', 'placed'].includes(q.status))) return refuse('conflict', WFN_MSG.duplicate, role);
      if (open.length >= WFN_MAX_OPEN_REQUESTS) return refuse('limit', WFN_MSG.limit, role);
      const text = String(statement ?? '').trim();
      if (text.length < 20 || text.length > 600) return refuse('invalid', WFN_MSG.statement, role);
      const bad = screen(text);
      if (bad) return refuse(bad.code, bad.msg, role);
      const pp = person(who)!;
      const id = rid('wr');
      const ts = nowTs();
      ins('wfn_requests', { id, offer_id: offerId, person_id: who, person_name: pp.display_name, person_name_ar: pp.display_name_ar || pp.display_name, statement: text, status: 'interested', outcome: null, decided_by: null, decided_on: null, note: null, history: [hist('interested')], created_at: ts, updated_at: ts });
      return h.done<R>('wfn.request', 'wfn_requests', id, offerId, role, null, '', 'Request sent to the programme owner', { id }, ['wfn_requests']);
    },

    async decideWfnRequest(id, decision, note = '', outcome) {
      await b.whenReady();
      type R = { status: string };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('wfn.decide', 'wfn_requests', id ?? null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', WFN_MSG.not_signed_in);
      if (!isTm()) return refuse('forbidden', WFN_MSG.forbidden_decide);
      const role = 'training_manager';
      const q = get('wfn_requests', id);
      if (!q || q.status === 'withdrawn') return refuse('not_found', WFN_MSG.not_found, role);
      if (q.person_id === who) return refuse('maker_checker', WFN_MSG.maker_checker, role);
      const next: Record<string, Record<string, string>> = { interested: { shortlist: 'shortlisted', decline: 'declined' }, shortlisted: { place: 'placed', decline: 'declined' }, placed: { complete: 'completed' } };
      const to = next[q.status]?.[decision];
      if (!to) return refuse('invalid', WFN_MSG.transition, role);
      const text = String(note ?? '').trim();
      if (to === 'declined' && (text.length < 5 || text.length > 300)) return refuse('invalid', WFN_MSG.decline_note, role);
      if (to === 'completed' && outcome !== 'progressed' && outcome !== 'same_role') return refuse('invalid', WFN_MSG.outcome, role);
      upd('wfn_requests', id, { status: to, outcome: to === 'completed' ? outcome : q.outcome ?? null, decided_by: who, decided_on: todayIso(), note: text || null, history: [...(q.history ?? []), hist(to, text || null)], updated_at: nowTs() });
      const o = get('wfn_offers', q.offer_id);
      notify(`nt-${id}-${to}`, q.person_id, 'community', `Your request for ${o?.title_en ?? q.offer_id}: ${to}`, `طلبك لـ ${o?.title_ar ?? q.offer_id}: ${({ shortlisted: 'في القائمة المختصرة', placed: 'تم التنسيب', completed: 'مكتمل', declined: 'لم يُقبل' } as Record<string, string>)[to]}`, '/communities/women-in-nuclear', to === 'declined' ? 'info' : 'ok');
      return h.done<R>('wfn.decide', 'wfn_requests', id, to, role, to === 'placed' ? 'kafaa.wfn.placement' : null, `Placement or sponsored study ${id} placed`, `Request ${to}`, { status: to }, ['wfn_requests', 'notifications']);
    },

    async wfnDesk() {
      await b.whenReady();
      if (!me() || !isTm()) return [];
      const offers = new Map(raw('wfn_offers').map((o) => [o.id, o]));
      return raw('wfn_requests').filter((q) => q.status !== 'withdrawn').sort((x, y) => (x.created_at < y.created_at ? 1 : x.created_at > y.created_at ? -1 : x.id < y.id ? -1 : 1)).map((q): WfnDeskRow => {
        const o = offers.get(q.offer_id);
        return { id: q.id, offer_id: q.offer_id, offer_title_en: o?.title_en ?? q.offer_id, offer_title_ar: o?.title_ar ?? q.offer_id, strand: o?.strand ?? '', person_id: q.person_id, person_name: q.person_name, person_name_ar: q.person_name_ar, statement: q.statement, status: q.status, outcome: q.outcome ?? null, note: q.note ?? null, created_at: q.created_at, updated_at: q.updated_at };
      });
    },

    async wfnStats() {
      await b.whenReady();
      if (!statsGate()) return null;
      const chan = new Map(raw('opportunities').map((o) => [o.id, (o.channel as string | null) ?? null]));
      return wfnStats({
        participants: raw('wfn_participants') as never, members: raw('wfn_circle_members') as never, circles: raw('wfn_circles') as never, requests: raw('wfn_requests') as never,
        people: raw('people') as never, academyMembers: raw('academy_members') as never,
        gigApplications: raw('opportunity_applications').map((a) => ({ person_id: a.person_id, status: a.status, channel: chan.get(a.opportunity_id) ?? null })),
        nominations: raw('leadership_nominations') as never,
      }, MIN_GROUP_SIZE);
    },
  };
}
