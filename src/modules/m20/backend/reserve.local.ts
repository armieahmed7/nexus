// F23 Alumni and expert reserve: LocalBackend RPC implementations (owner: W3 · E4). Spread into makeLocalM20 (backend/local.ts).
// 1:1 mirror of supabase/migrations/20261009134001_kafaa_w3e4_reserve.sql: same checks in the same order, the same refusal codes
// and messages (src/modules/m20/reserve.ts ALMSG), the same audit rows and ledger rows. Change both together. Pages never import this.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { RowOf } from '../../../data/types';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import {
  ALMSG, BLOCKING_ENG, ERASE_AFTER_MONTHS, ENG_TRANSITIONS, OPEN_ENG, RESTRICTED_FAMILIES, addMonths, bandOf, computeBoard, computeDesk, dayNo, hasContactData, hrRoleOf, recount,
  snapshotFrom, validateJoin, validateRequest, type EngagementRow, type EngStatus, type MemberRow, type RequestRow, type ReserveBoard, type ReserveDesk,
} from '../reserve';
import type { F23Rpc } from './rpc';


type Req = RowOf<'reserve_requests'>;
type Eng = RowOf<'reserve_engagements'>;
const hex = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) => x.toString(16).padStart(2, '0')).join('');
const txt = (s: unknown) => (typeof s === 'string' ? s.trim() : '');

export function makeLocalF23(b: LocalBackend, h: LocalRpcHelpers): F23Rpc {
  const me = () => b.identity().personId;
  const ctx = () => b.access();
  const hr = () => hrRoleOf(ctx().roles);
  const notify = (id: string, person: string | null | undefined, en: string, ar: string, link: string, severity: 'info' | 'ok' | 'warn' | 'bad' = 'info') => {
    if (!person || !b.rawGet('people', person) || b.rawGet('notifications', id)) return;
    b.rawInsert('notifications', { id, person_id: person, kind: 'reserve', title_en: en, title_ar: ar, link, severity, created_at: nowTs() } as never);
  };
  const hist = (e: Eng | undefined, status: string, note: string | null) => [...(((e?.history as unknown) as unknown[]) ?? []), { at: nowTs(), status, by: me(), note }];
  const activeMemberOf = (person: string) => b.raw('alumni').find((m) => m.person_id === person && m.status === 'active');
  /** Recompute interest, places taken and open/filled for a request (same as kafaa_res_recount). */
  const recountReq = (id: string) => {
    const r = b.rawGet('reserve_requests', id);
    if (!r) return;
    const c = recount(r, b.raw('reserve_engagements').filter((e) => e.request_id === id));
    if (c.interest_count !== r.interest_count || c.seats_taken !== r.seats_taken || c.status !== r.status) b.rawUpdate('reserve_requests', id, { ...c, updated_at: nowTs() } as never);
  };
  const reqVisible = (r: Req | undefined) => !!r && (r.posted_by === me() || !!hr() || ctx().has('audit_log', ['R']));
  const engVisible = (e: Eng | undefined) => !!e && ((!!me() && (e.person_id === me() || e.poster_read_id === me())) || !!hr() || ctx().has('audit_log', ['R']));

  return {
    async joinReserve(p) {
      await b.whenReady();
      type R = { id: string; status: string; erase_after: string | null; skills: number };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('reserve.join', 'alumni', null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', ALMSG.not_signed_in);
      const role = ctx().actingRole('opportunities', ['Own']);
      const pp = b.rawGet('people', who);
      if (!role || !pp || pp.kind !== 'staff') return refuse('forbidden', ALMSG.forbidden_join, role);
      if (RESTRICTED_FAMILIES.includes(pp.job_family_id ?? '')) return refuse('restricted_kind', ALMSG.restricted_join, role);
      const today = todayIso();
      const id = `alm:${who}`;
      if (p?.consent === false) {
        const m = activeMemberOf(who);
        if (!m) return refuse('not_member', ALMSG.not_member, role);
        const del = addMonths(today, ERASE_AFTER_MONTHS);
        const ts = nowTs();
        b.rawUpdate('alumni', m.id, { status: 'withdrawn', withdrawn_on: today, erase_after: del, finder_optin: false, finder_visible: false, updated_at: ts } as never);
        const touched = new Set<string>();
        for (const e of b.raw('reserve_engagements').filter((x) => x.alumni_id === m.id).sort((x, y) => (x.id < y.id ? -1 : 1))) {
          const open = OPEN_ENG.includes(e.status as EngStatus);
          b.rawUpdate('reserve_engagements', e.id, { ...(open ? { status: 'withdrawn', history: hist(e, 'withdrawn', 'Consent withdrawn') } : {}), alumni_name: '', alumni_name_ar: '', updated_at: ts } as never);
          if (open) touched.add(e.request_id);
        }
        for (const r of [...touched].sort()) recountReq(r);
        for (const s of b.raw('alumni_stories').filter((x) => x.alumni_id === m.id && x.listed)) b.rawUpdate('alumni_stories', s.id, { listed: false } as never);
        return h.done<R>('reserve.withdraw', 'alumni', m.id, `consent withdrawn; erasure after ${del}`, role, 'kafaa.reserve.withdraw', `Reserve consent withdrawn for ${m.id}; erasure scheduled ${del}`,
          `Consent withdrawn. You are hidden from the reserve and your record is erased after ${del}`, { id: m.id, status: 'withdrawn', erase_after: del, skills: 0 }, ['alumni', 'reserve_engagements', 'reserve_requests', 'alumni_stories']);
      }
      const bad = validateJoin(p);
      if (bad) return refuse(bad.code, bad.message, role);
      const snap = snapshotFrom(b.raw('person_skills').filter((s) => s.person_id === who) as never, b.raw('skills') as never);
      const existing = b.rawGet('alumni', id);
      const wasActive = existing?.status === 'active';
      const optin = p.finder_optin === true;
      const ts = nowTs();
      const row = {
        person_id: who, kind: 'pre_departure', name: pp.display_name, name_ar: pp.display_name_ar || pp.display_name, former_role_id: pp.job_role_id ?? null, former_family_id: pp.job_family_id ?? null,
        former_org: pp.org_id ?? null, departed_on: null, departure_reason: 'planned', departed_band: bandOf(null, today),
        years_service: pp.hire_date ? Math.floor((dayNo(today) - dayNo(pp.hire_date)) / 365) : null,
        skill_snapshot: snap, snapshot_on: today, availability: p.availability, hours_month: p.hours_month, engagement_prefs: [...(p.engagement_prefs ?? [])],
        finder_optin: optin, finder_visible: optin, headline_en: txt(p.headline_en) || null, headline_ar: txt(p.headline_ar) || null,
        consent_on: wasActive ? existing!.consent_on : today, consent_version: '1', status: 'active', withdrawn_on: null, erase_after: null, updated_at: ts,
      };
      if (existing) b.rawUpdate('alumni', id, row as never);
      else b.rawInsert('alumni', { id, created_at: ts, ...row } as never);
      return h.done<R>('reserve.join', 'alumni', id, `${wasActive ? 'updated' : 'joined'}; ${snap.length} skills frozen; finder ${optin ? 'on' : 'off'}`, role, 'kafaa.reserve.consent', `Reserve consent recorded for ${id}`,
        wasActive ? 'Reserve membership updated' : 'You are in the expert reserve', { id, status: 'active', erase_after: null, skills: snap.length }, ['alumni']);
    },

    async requestReserve(p) {
      await b.whenReady();
      type R = { id: string; status: string };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('reserve.request', 'reserve_requests', null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', ALMSG.not_signed_in);
      const role = ctx().actingRole('opportunities', ['W']);
      if (!role) return refuse('forbidden', ALMSG.forbidden_request);
      const today = todayIso();
      const bad = validateRequest(p, b.raw('skills') as never, today);
      if (bad) return refuse(bad.code, bad.message, role);
      const pp = b.rawGet('people', who)!;
      const jr = pp.job_role_id ? b.rawGet('job_roles', pp.job_role_id) : undefined;
      const fam = pp.job_family_id ? b.rawGet('job_families', pp.job_family_id) : undefined;
      const id = `rr-${hex()}`;
      const ts = nowTs();
      b.rawInsert('reserve_requests', {
        id, posted_by: who, poster_name: pp.display_name, poster_name_ar: pp.display_name_ar || pp.display_name, family_id: pp.job_family_id ?? null,
        host_team_en: jr ? `${jr.title_en} team` : fam ? `${fam.name_en} team` : 'Team', host_team_ar: jr ? `فريق ${jr.title_ar}` : fam ? `فريق ${fam.name_ar}` : 'الفريق',
        engagement: p.engagement, title_en: p.title_en.trim(), title_ar: p.title_ar.trim(), summary_en: p.summary_en.trim(), summary_ar: p.summary_ar.trim(), skills_needed: [...p.skills_needed],
        hours_total: p.hours_total, seats: p.seats ?? 1, seats_taken: 0, interest_count: 0, location_type: p.location_type, start_on: p.start_on, end_on: p.end_on,
        status: 'pending_hr', hr_by: null, hr_at: null, hr_note: null, open_read: false, created_at: ts, updated_at: ts,
      } as never);
      return h.done<R>('reserve.request', 'reserve_requests', id, `${p.engagement} pending_hr`, role, null, '', 'Request sent to HR for approval', { id, status: 'pending_hr' }, ['reserve_requests']);
    },

    async decideReserveRequest(requestId, decision, note = '') {
      await b.whenReady();
      type R = { status: string };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('reserve.request.decide', 'reserve_requests', requestId, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', ALMSG.not_signed_in);
      const r = b.rawGet('reserve_requests', requestId);
      if (!reqVisible(r)) return refuse('not_found', ALMSG.request_not_found);
      if (!['approve', 'decline', 'close'].includes(decision)) return refuse('invalid', ALMSG.invalid_decision);
      const hrRole = hr();
      const text = txt(note);
      const ts = nowTs();
      if (decision === 'close') {
        const role = hrRole ?? ctx().actingRole('opportunities', ['W', 'A']);
        if (r!.posted_by !== who && !hrRole) return refuse('forbidden', ALMSG.forbidden_close, role);
        if (!['pending_hr', 'open', 'filled'].includes(r!.status)) return refuse('invalid', ALMSG.invalid_transition, role);
        b.rawUpdate('reserve_requests', r!.id, { status: 'closed', updated_at: ts } as never);
        for (const e of b.raw('reserve_engagements').filter((x) => x.request_id === r!.id && (x.status === 'invited' || x.status === 'interested')))
          b.rawUpdate('reserve_engagements', e.id, { status: 'declined', history: hist(e, 'declined', 'Request closed'), updated_at: ts } as never);
        recountReq(r!.id);
        return h.done<R>('reserve.request.decide', 'reserve_requests', r!.id, `${r!.status} -> closed`, role, null, '', 'Request closed', { status: 'closed' }, ['reserve_requests', 'reserve_engagements']);
      }
      if (!hrRole) return refuse('forbidden', ALMSG.forbidden_hr, ctx().actingRole('opportunities', ['W', 'A', 'Own']));
      if (r!.posted_by === who) return refuse('maker_checker', ALMSG.maker_checker, hrRole);
      if (r!.status !== 'pending_hr') return refuse('invalid', ALMSG.not_pending, hrRole);
      if (decision === 'decline' && text.length < 5) return refuse('invalid', ALMSG.decline_reason, hrRole);
      const status = decision === 'approve' ? 'open' : 'declined';
      b.rawUpdate('reserve_requests', r!.id, { status, hr_by: who, hr_at: ts, hr_note: text || null, updated_at: ts } as never);
      notify(`nt-${r!.id}-${status}`, r!.posted_by, status === 'open' ? `HR approved your reserve request: ${r!.title_en}` : `HR declined your reserve request: ${r!.title_en}`,
        status === 'open' ? `وافقت الموارد البشرية على طلبك من الاحتياطي: ${r!.title_ar}` : `رفضت الموارد البشرية طلبك من الاحتياطي: ${r!.title_ar}`, '/opportunities/reserve/request', status === 'open' ? 'ok' : 'warn');
      return h.done<R>('reserve.request.decide', 'reserve_requests', r!.id, `pending_hr -> ${status}`, hrRole, status === 'open' ? 'kafaa.reserve.request.approve' : null, `Reserve request ${r!.id} approved and opened to alumni`,
        status === 'open' ? 'Request approved; alumni in the reserve can now see it' : 'Request declined', { status }, ['reserve_requests', 'notifications']);
    },

    async reserveInterest(requestId, note = '') {
      await b.whenReady();
      type R = { id: string; status: string };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('reserve.interest', 'reserve_requests', requestId, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', ALMSG.not_signed_in);
      const role = ctx().actingRole('opportunities', ['Own']);
      const m = activeMemberOf(who);
      if (!m) return refuse('not_member', ALMSG.not_member, role);
      const r = b.rawGet('reserve_requests', requestId);
      if (!r || r.status === 'pending_hr' || r.status === 'declined') return refuse('not_found', ALMSG.request_not_found, role);
      if (r.status !== 'open') return refuse('invalid', ALMSG.not_open, role);
      if (r.posted_by === who) return refuse('conflict', ALMSG.own_request, role);
      const text = txt(note);
      if (text.length > 500) return refuse('invalid', ALMSG.invalid_note, role);
      if (hasContactData(text)) return refuse('contact_data', ALMSG.contact_data, role);
      const id = `re:${r.id}:${m.id}`;
      const e = b.rawGet('reserve_engagements', id);
      if (e && e.status !== 'invited' && BLOCKING_ENG.includes(e.status as EngStatus)) return refuse('conflict', ALMSG.already_engaged, role);
      const ts = nowTs();
      const row = { status: 'interested', note: text || null, alumni_name: m.name, alumni_name_ar: m.name_ar, history: hist(e, 'interested', text || null), updated_at: ts };
      if (e) b.rawUpdate('reserve_engagements', id, row as never);
      else b.rawInsert('reserve_engagements', { id, request_id: r.id, alumni_id: m.id, person_id: who, poster_id: r.posted_by, poster_read_id: null, engagement: r.engagement, hr_by: null, hr_at: null, hr_note: null, outcome_note: null, completed_at: null, open_read: false, created_at: ts, ...row } as never);
      recountReq(r.id);
      return h.done<R>('reserve.interest', 'reserve_engagements', id, e?.status === 'invited' ? 'invitation accepted' : 'interest', role, null, '', 'Interest sent to HR', { id, status: 'interested' }, ['reserve_engagements', 'reserve_requests']);
    },

    async inviteReserve(requestId, alumniId, note = '') {
      await b.whenReady();
      type R = { id: string; status: string };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('reserve.invite', 'reserve_requests', requestId, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', ALMSG.not_signed_in);
      const hrRole = hr();
      if (!hrRole) return refuse('forbidden', ALMSG.forbidden_hr, ctx().actingRole('opportunities', ['W', 'A', 'Own']));
      const r = b.rawGet('reserve_requests', requestId);
      if (!r) return refuse('not_found', ALMSG.request_not_found, hrRole);
      if (r.status !== 'open') return refuse('invalid', ALMSG.not_open, hrRole);
      const m = b.rawGet('alumni', alumniId);
      if (!m || m.status !== 'active') return refuse('not_found', ALMSG.member_not_found, hrRole);
      if (m.person_id && m.person_id === r.posted_by) return refuse('conflict', ALMSG.own_request, hrRole);
      if (m.person_id && m.person_id === who) return refuse('maker_checker', ALMSG.maker_checker, hrRole);
      const text = txt(note);
      if (text.length > 500) return refuse('invalid', ALMSG.invalid_note, hrRole);
      if (hasContactData(text)) return refuse('contact_data', ALMSG.contact_data, hrRole);
      const id = `re:${r.id}:${m.id}`;
      const e = b.rawGet('reserve_engagements', id);
      if (e && BLOCKING_ENG.includes(e.status as EngStatus)) return refuse('conflict', ALMSG.already_engaged, hrRole);
      const ts = nowTs();
      const row = { status: 'invited', note: null, hr_note: text || null, alumni_name: m.name, alumni_name_ar: m.name_ar, history: hist(e, 'invited', text || null), updated_at: ts };
      if (e) b.rawUpdate('reserve_engagements', id, row as never);
      else b.rawInsert('reserve_engagements', { id, request_id: r.id, alumni_id: m.id, person_id: m.person_id ?? null, poster_id: r.posted_by, poster_read_id: null, engagement: r.engagement, hr_by: null, hr_at: null, outcome_note: null, completed_at: null, open_read: false, created_at: ts, ...row } as never);
      notify(`nt-${id}-invited`, m.person_id, `HR invites you to a reserve request: ${r.title_en}`, `تدعوك الموارد البشرية إلى طلب من الاحتياطي: ${r.title_ar}`, '/opportunities/reserve/me', 'info');
      recountReq(r.id);
      return h.done<R>('reserve.invite', 'reserve_engagements', id, `invited ${m.id}`, hrRole, null, '', 'Invitation sent', { id, status: 'invited' }, ['reserve_engagements', 'reserve_requests', 'notifications']);
    },

    async decideReserveEngagement(engagementId, decision, note = '') {
      await b.whenReady();
      type R = { status: string };
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('reserve.engagement', 'reserve_engagements', engagementId, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', ALMSG.not_signed_in);
      const e = b.rawGet('reserve_engagements', engagementId);
      if (!engVisible(e)) return refuse('not_found', ALMSG.eng_not_found);
      const tr = Object.prototype.hasOwnProperty.call(ENG_TRANSITIONS, decision) ? ENG_TRANSITIONS[decision] : undefined;
      if (!tr) return refuse('invalid', ALMSG.invalid_decision);
      const hrRole = hr();
      const role = hrRole ?? ctx().actingRole('opportunities', ['W', 'A', 'Own']);
      const r = b.rawGet('reserve_requests', e!.request_id)!;
      const text = txt(note);
      if (decision === 'approve' || decision === 'decline') {
        if (!hrRole) return refuse('forbidden', ALMSG.forbidden_hr, role);
        if (decision === 'approve' && (e!.poster_id === who || e!.person_id === who)) return refuse('maker_checker', ALMSG.maker_checker, role);
      } else if (decision === 'complete') {
        if (e!.poster_id !== who && !hrRole) return refuse('forbidden', ALMSG.forbidden_complete, role);
      } else if (e!.person_id !== who) return refuse('forbidden', ALMSG.forbidden_withdraw, role);
      if (!tr.from.includes(e!.status as EngStatus)) return refuse('invalid', ALMSG.invalid_transition, role);
      if (decision === 'approve' && r.status !== 'open') return refuse('invalid', ALMSG.not_open, role);
      if (decision === 'approve' && r.seats_taken >= r.seats) return refuse('conflict', ALMSG.no_seats, role);
      if (decision === 'decline' && text.length < 5) return refuse('invalid', ALMSG.decline_reason, role);
      if (decision === 'complete' && text.length < 5) return refuse('invalid', ALMSG.outcome_note, role);
      if (text.length > 500) return refuse('invalid', ALMSG.invalid_note, role);
      if (hasContactData(text)) return refuse('contact_data', ALMSG.contact_data, role);
      const ts = nowTs();
      const status = tr.to;
      b.rawUpdate('reserve_engagements', e!.id, {
        status, history: hist(e, status, text || null), updated_at: ts,
        ...(decision === 'approve' ? { poster_read_id: e!.poster_id, hr_by: who, hr_at: ts, hr_note: text || null } : {}),
        ...(decision === 'decline' ? { hr_by: who, hr_at: ts, hr_note: text } : {}),
        ...(decision === 'complete' ? { completed_at: ts, outcome_note: text } : {}),
      } as never);
      recountReq(r.id);
      if (decision === 'approve') {
        notify(`nt-${e!.id}-handed`, e!.poster_id, `HR approved an alumnus for: ${r.title_en}. HR arranges the engagement`, `اعتمدت الموارد البشرية خبيراً سابقاً لـ: ${r.title_ar}. تتولى الموارد البشرية الترتيبات`, '/opportunities/reserve/request', 'ok');
        notify(`nt-${e!.id}-handed-a`, e!.person_id, `HR approved your engagement: ${r.title_en}. HR will contact you`, `اعتمدت الموارد البشرية مشاركتك: ${r.title_ar}. ستتواصل معك الموارد البشرية`, '/opportunities/reserve/me', 'ok');
      }
      const ledger = decision === 'approve' ? 'kafaa.reserve.engagement.approve' : decision === 'complete' ? 'kafaa.reserve.engagement.complete' : null;
      const msg = decision === 'approve' ? 'Engagement approved and handed to HR' : decision === 'decline' ? 'Engagement declined' : decision === 'complete' ? 'Engagement completed' : 'You withdrew from this engagement';
      return h.done<R>('reserve.engagement', 'reserve_engagements', e!.id, `${e!.status} -> ${status}`, role, ledger, `Reserve engagement ${e!.id} on ${r.id}: ${status}`, msg, { status }, ['reserve_engagements', 'reserve_requests', 'notifications']);
    },

    async reserveBoard(): Promise<ReserveBoard | null> {
      await b.whenReady();
      const who = me();
      if (!who) return null;
      const m = b.raw('alumni').filter((x) => x.person_id === who).sort((x, y) => Number(y.status === 'active') - Number(x.status === 'active') || (x.id < y.id ? -1 : 1))[0];
      if (!m) return null;
      return computeBoard(m as unknown as MemberRow, b.raw('reserve_requests') as unknown as RequestRow[], b.raw('reserve_engagements') as unknown as EngagementRow[]);
    },

    async reserveDesk(): Promise<ReserveDesk | null> {
      await b.whenReady();
      if (!me() || !hr()) return null;
      return computeDesk(b.raw('alumni') as unknown as MemberRow[], b.raw('reserve_requests') as unknown as RequestRow[], b.raw('reserve_engagements') as unknown as EngagementRow[], todayIso());
    },
  };
}

