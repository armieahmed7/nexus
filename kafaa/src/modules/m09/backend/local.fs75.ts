// FS wave G · E5 (fsGe5, M09) LocalBackend RPCs: FS68 supplier future-skills readiness and FS69 contractor pre-arrival check with
// selective disclosure. Spread into makeLocalM09 (backend/local.ts). 1:1 mirror of the SQL in
// supabase/migrations/20261010275001_kafaa_fs75_supplier_readiness.sql: same checks in the same order, the same refusal codes and
// messages (PA_MSG), the same audit and ledger rows.
// Shared writes, only through these RPCs (like the SQL SECURITY DEFINER functions):
//   M17 record_shares   the FS32 share link behind a pre-arrival share (createPrearrivalShare inserts it, revokePrearrivalShare revokes it)
//   M14 notifications   kind `prearrival` (`nt-pa-<id>-created`) when an evaluator records a share on the contractor's behalf
// precheckFromShare writes only its own pre-arrival row (check summary) and an audit row: no skill evidence, no skill state, no
// qualification record, no equivalency status. Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import { todayIso } from '../../../domain/rules';
import { nowTs } from '../../../data/audit';
import { recordItems, type RecordItem, type RecordWorld } from '../../m17/learnerRecord';
import { contractorOrgOf } from '../contractor';
import { supplierFutureReadiness, FR_MIN_GROUP, type FrReport } from '../futureReadiness';
import { PA_MSG, SHARE_RULES, checkSummary, precheckFromShare, prearrivalProblem, sharedItems, shareView, type PrearrivalCheck, type PrearrivalInput } from '../prearrival';
import type { Fs75Rpc, PrearrivalContractor, PrearrivalDetail, PrearrivalItems, PrearrivalRow } from './rpc';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const hex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(Math.ceil(n / 2))), (x) => x.toString(16).padStart(2, '0')).join('').slice(0, n);
const trim = (x: unknown) => String(x ?? '').trim();
const d10 = (v: unknown) => (v == null ? null : String(v).slice(0, 10));
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const STATUS_ORDER: Record<string, number> = { active: 0, expired: 1, revoked: 2 };

export function makeLocalFs75(b: LocalBackend, h: LocalRpcHelpers): Fs75Rpc {
  const raw = (t: string) => ((b.raw(t as never) as unknown as Row[] | undefined) ?? []);
  const get = (t: string, id: string | null | undefined) => (id ? (b.rawGet(t as never, id) as unknown as Row | undefined) : undefined);
  const ins = (t: string, row: Row) => b.rawInsert(t as never, row as never);
  const upd = (t: string, id: string, patch: Row) => b.rawUpdate(t as never, id, patch as never);
  const me = () => b.identity().personId;
  const ctx = () => b.access();
  /** kafaa_cp_org: the supplier organisation of a contractor person, or null. */
  const cpOrg = (pid: string | null | undefined) => (pid ? contractorOrgOf(get('people', pid), (o) => get('organisations', o)?.kind) : null);
  const recordWorld = (person: string, today: string): RecordWorld => ({
    today, person, initials: String(get('people', person)?.initials || '—'), microcred_awards: raw('microcred_awards'), microcred_defs: raw('microcred_defs'), badges: raw('badges'),
    certificates: raw('certificates'), qual_records: raw('qual_records'), qual_standards: raw('qual_standards'), person_skills: raw('person_skills'), skills: raw('skills'), competencies: raw('competencies'),
    external_certs: raw('external_certs'), // FS79 -> FS32 (wave I integration)
  });
  const itemsOf = (person: string, today: string): RecordItem[] => recordItems(recordWorld(person, today));
  const isEvaluator = () => ctx().has('equivalency', ['A']);
  const rowView = (r: Row, today: string): PrearrivalRow => {
    const s = get('record_shares', r.share_id) ?? {};
    const o = get('organisations', r.org_id) ?? {};
    const std = get('qual_standards', r.standard_id) ?? {};
    return {
      id: r.id, share_id: r.share_id, person_id: r.person_id, initials: String(s.holder_initials || get('people', r.person_id)?.initials || '—'), org_id: r.org_id,
      org_name_en: String(o.name_en ?? r.org_id), org_name_ar: String(o.name_ar ?? o.name_en ?? r.org_id), standard_id: r.standard_id, standard_code: String(std.code ?? ''),
      standard_title_en: String(std.title_en ?? ''), standard_title_ar: String(std.title_ar ?? ''), label: String(s.label ?? ''), mobilise_on: d10(r.mobilise_on)!,
      expires_on: d10(s.expires_on)!, status: shareView(s as never, today), created_via: r.created_via, created_at: String(r.created_at), item_count: (s.items ?? []).length,
      views: Number(s.views ?? 0), checked_at: r.checked_at ?? null, check_summary: (r.check_summary as never) ?? null,
    };
  };
  const sortRows = (rows: PrearrivalRow[]) => rows.sort((a, c) => STATUS_ORDER[a.status] - STATUS_ORDER[c.status] || cmp(a.mobilise_on, c.mobilise_on) || cmp(a.id, c.id));
  const notify = (id: string, pid: string, en: string, ar: string) => {
    if (get('notifications', id)) return;
    ins('notifications', { id, person_id: pid, kind: 'prearrival', title_en: en, title_ar: ar, body_en: null, body_ar: null, link: '/partner/workforce/prearrival', severity: 'info', created_at: nowTs(), read_at: null });
  };

  return {
    async supplierFutureReadiness() {
      await b.whenReady();
      const empty: FrReport = { allowed: false, scope: 'none', min_group: FR_MIN_GROUP, orgs: [] };
      if (!me()) return empty;
      const c = ctx();
      const w = {
        orgs: raw('organisations'), people: raw('people'), states: raw('person_skills'), skills: raw('skills') as never, comps: raw('competencies'), targets: raw('contract_role_targets'),
        profiles: raw('role_profile_versions'), roles: raw('job_roles'), courses: raw('courses'),
      };
      if (c.has('equivalency', ['A', 'R']) || c.has('partner_org', ['A', 'R'])) return { allowed: true, scope: 'all', min_group: FR_MIN_GROUP, orgs: supplierFutureReadiness(w, null) };
      if (c.has('partner_org', ['OwnOrg', 'OrgW'])) {
        const org = b.identity().orgId;
        return { allowed: true, scope: 'own', min_group: FR_MIN_GROUP, orgs: org ? supplierFutureReadiness(w, [org]) : [] };
      }
      return empty;
    },

    async prearrivalShares() {
      await b.whenReady();
      const caller = me();
      if (!caller) return [];
      const today = todayIso();
      const c = ctx();
      const all = c.has('equivalency', ['A', 'R']);
      const org = c.has('equivalency', ['OwnOrg', 'OrgW']) ? b.identity().orgId : null;
      return sortRows(raw('prearrival_shares').filter((r) => all || r.person_id === caller || (org != null && r.org_id === org)).map((r) => rowView(r, today)));
    },

    async prearrivalContractors() {
      await b.whenReady();
      if (!me() || !isEvaluator()) return [];
      return raw('people')
        .filter((p) => p.kind === 'contractor' && p.status === 'active' && cpOrg(p.id))
        .map((p): PrearrivalContractor => {
          const o = get('organisations', p.org_id) ?? {};
          return { id: p.id, initials: String(p.initials || '—'), org_id: p.org_id, org_name_en: String(o.name_en ?? p.org_id), org_name_ar: String(o.name_ar ?? o.name_en ?? p.org_id), job_role_id: p.job_role_id ?? null, ref: p.id };
        })
        .sort((a, c) => cmp(a.org_id, c.org_id) || cmp(a.id, c.id));
    },

    async prearrivalItems(personId = null) {
      await b.whenReady();
      const caller = me();
      const none: PrearrivalItems = { allowed: false, person: null, items: [] };
      if (!caller) return none;
      const pid = trim(personId) || caller;
      if (pid === caller ? !cpOrg(caller) : !(isEvaluator() && cpOrg(pid))) return none;
      const p = get('people', pid)!;
      const o = get('organisations', p.org_id) ?? {};
      return {
        allowed: true, person: { id: pid, initials: String(p.initials || '—'), org_id: p.org_id, org_name_en: String(o.name_en ?? p.org_id), org_name_ar: String(o.name_ar ?? o.name_en ?? p.org_id), job_role_id: p.job_role_id ?? null },
        items: itemsOf(pid, todayIso()),
      };
    },

    async createPrearrivalShare(input) {
      await b.whenReady();
      type R = { id: string; share_id: string; token: string; expires_on: string };
      const A = 'prearrival.share';
      const x = (input ?? {}) as PrearrivalInput;
      const caller = me();
      if (!caller) return h.refuse<R>(A, 'prearrival_shares', null, 'not_signed_in', PA_MSG.not_signed_in);
      const pid = trim(x.person_id) || caller;
      const onBehalf = pid !== caller;
      let role: string | null;
      if (!onBehalf) {
        role = ctx().actingRole('own_profile', ['Own']);
        if (!cpOrg(caller) || !role) return h.refuse<R>(A, 'prearrival_shares', null, 'forbidden', PA_MSG.not_contractor, role);
      } else {
        role = ctx().actingRole('equivalency', ['A']);
        if (!role) return h.refuse<R>(A, 'prearrival_shares', null, 'forbidden', PA_MSG.forbidden);
        if (!cpOrg(pid)) return h.refuse<R>(A, 'prearrival_shares', null, 'not_found', PA_MSG.not_contractor, role);
      }
      const std = get('qual_standards', x.standard_id);
      if (!std || std.status !== 'current') return h.refuse<R>(A, 'prearrival_shares', null, 'not_found', PA_MSG.standard, role);
      if (std.security_restricted) return h.refuse<R>(A, 'prearrival_shares', null, 'invalid', PA_MSG.security, role);
      const today = todayIso();
      const chk = prearrivalProblem(x, itemsOf(pid, today), today, onBehalf);
      if (chk !== 'ok') return h.refuse<R>(A, 'prearrival_shares', null, chk, PA_MSG[chk], role);
      if (raw('record_shares').filter((s) => s.person_id === pid && shareView(s as never, today) === 'active').length >= SHARE_RULES.maxActive) return h.refuse<R>(A, 'prearrival_shares', null, 'too_many', PA_MSG.too_many, role);
      const shareId = `rs-${hex(16)}`;
      const id = `pa-${hex(16)}`;
      const token = hex(32);
      const at = nowTs();
      const consentRef = onBehalf ? trim(x.consent_ref) : '';
      ins('record_shares', {
        id: shareId, person_id: pid, token, label: trim(x.label), items: [...x.items], holder_initials: String(get('people', pid)?.initials || '—'),
        consents: { items: true, preview: true, share: true, at, purpose: 'prearrival', on_behalf: onBehalf, recorded_by: onBehalf ? caller : null, consent_ref: consentRef || null },
        expires_on: x.expires_on, revoked_at: null, revoke_reason: null, views: 0, last_viewed_at: null, created_at: at,
      });
      ins('prearrival_shares', {
        id, share_id: shareId, person_id: pid, org_id: cpOrg(pid), standard_id: std.id, mobilise_on: x.mobilise_on, created_via: onBehalf ? 'on_behalf' : 'self', created_by: caller,
        consent_ref: consentRef, note: trim(x.note).slice(0, 300), checked_by: null, checked_at: null, check_summary: null, created_at: at,
      });
      if (onBehalf) notify(`nt-pa-${id}-created`, pid, `An ENEC evaluator recorded your pre-arrival share for ${std.code} (consent ${consentRef})`, `سجّل مقيّم من مؤسسة الإمارات للطاقة النووية مشاركتك قبل الوصول لمعيار ${std.code} (الموافقة ${consentRef})`);
      const why = `${std.code} for ${pid}: ${x.items.length} items until ${x.expires_on}, mobilising ${x.mobilise_on}${onBehalf ? ` (on behalf, consent ${consentRef})` : ''}`;
      return h.done<R>(A, 'prearrival_shares', id, why, role, 'kafaa.prearrival.share', `Pre-arrival share ${id} (${x.items.length} items, until ${x.expires_on})`, PA_MSG.created,
        { id, share_id: shareId, token, expires_on: x.expires_on }, ['prearrival_shares', 'record_shares', 'notifications']);
    },

    async revokePrearrivalShare(id, reason = null) {
      await b.whenReady();
      type R = { id: string };
      const A = 'prearrival.revoke';
      const caller = me();
      const pid0 = trim(id);
      if (!caller) return h.refuse<R>(A, 'prearrival_shares', pid0 || null, 'not_signed_in', PA_MSG.not_signed_in);
      const r = get('prearrival_shares', pid0);
      const self = !!r && r.person_id === caller;
      const role = self ? ctx().actingRole('own_profile', ['Own']) : ctx().actingRole('equivalency', ['A']);
      if (!r || !role) return h.refuse<R>(A, 'prearrival_shares', pid0 || null, 'not_found', PA_MSG.not_found, role);
      const s = get('record_shares', r.share_id);
      if (!s || shareView(s as never, todayIso()) !== 'active') return h.refuse<R>(A, 'prearrival_shares', r.id, 'already_closed', PA_MSG.already_closed, role);
      const why = trim(reason).slice(0, 300);
      if (!self && why.length < 3) return h.refuse<R>(A, 'prearrival_shares', r.id, 'invalid', PA_MSG.revoke_reason, role);
      upd('record_shares', s.id, { revoked_at: nowTs(), revoke_reason: why || null });
      return h.done<R>(A, 'prearrival_shares', r.id, why || 'revoked by the contractor', role, 'kafaa.prearrival.revoke', `Pre-arrival share ${r.id} revoked`, PA_MSG.revoked, { id: r.id }, ['prearrival_shares', 'record_shares']);
    },

    async prearrivalShare(id) {
      await b.whenReady();
      type R = PrearrivalDetail;
      const A = 'prearrival.view';
      const caller = me();
      const key = trim(id);
      if (!caller) return h.refuse<R>(A, 'prearrival_shares', key || null, 'not_signed_in', PA_MSG.not_signed_in);
      const r = get('prearrival_shares', key);
      const role = r && r.person_id === caller ? ctx().actingRole('own_profile', ['Own']) : ctx().actingRole('equivalency', ['A', 'R']);
      if (!r || !role) return h.refuse<R>(A, 'prearrival_shares', key || null, 'not_found', PA_MSG.not_found, role);
      const today = todayIso();
      const v = rowView(r, today);
      const s = get('record_shares', r.share_id) ?? {};
      const items = v.status === 'active' ? sharedItems(itemsOf(r.person_id, today), s.items ?? []) : [];
      const data: R = { ...v, consent_ref: String(r.consent_ref ?? ''), note: String(r.note ?? ''), revoked_at: s.revoked_at ?? null, revoke_reason: s.revoke_reason ?? null, items };
      return h.done<R>(A, 'prearrival_shares', r.id, `${v.status}: ${items.length} shared items`, role, null, '', PA_MSG.view_ok, data, ['audit_events']);
    },

    async precheckFromShare(id, standardId = null) {
      await b.whenReady();
      type R = PrearrivalCheck;
      const A = 'prearrival.precheck';
      const caller = me();
      const key = trim(id);
      if (!caller) return h.refuse<R>(A, 'prearrival_shares', key || null, 'not_signed_in', PA_MSG.not_signed_in);
      const role = ctx().actingRole('equivalency', ['A']);
      if (!role) return h.refuse<R>(A, 'prearrival_shares', key || null, 'forbidden', PA_MSG.check_forbidden);
      const r = get('prearrival_shares', key);
      if (!r) return h.refuse<R>(A, 'prearrival_shares', key || null, 'not_found', PA_MSG.not_found, role);
      const today = todayIso();
      const s = get('record_shares', r.share_id) ?? {};
      const status = shareView(s as never, today);
      if (status === 'expired') return h.refuse<R>(A, 'prearrival_shares', r.id, 'expired', PA_MSG.expired, role);
      if (status === 'revoked') return h.refuse<R>(A, 'prearrival_shares', r.id, 'revoked', PA_MSG.revoked_closed, role);
      const std = get('qual_standards', trim(standardId) || r.standard_id);
      if (!std || std.status !== 'current') return h.refuse<R>(A, 'prearrival_shares', r.id, 'not_found', PA_MSG.standard, role);
      if (std.security_restricted) return h.refuse<R>(A, 'prearrival_shares', r.id, 'invalid', PA_MSG.security, role);
      const shared = sharedItems(itemsOf(r.person_id, today), s.items ?? []);
      const p = precheckFromShare(r.id, r.person_id, shared, {
        standard: std, tasks: raw('task_items'), links: raw('task_skill_links'), skills: raw('skills') as never, comps: raw('competencies'), courses: raw('courses'),
      });
      upd('prearrival_shares', r.id, { checked_by: caller, checked_at: nowTs(), check_summary: checkSummary(p) });
      return h.done<R>(A, 'prearrival_shares', r.id, `${std.code}: ${p.likely}/${p.total} likely from ${p.skills_used} shared skills, outlook ${p.outlook}`, role, null, '', PA_MSG.check_ok, p, ['prearrival_shares']);
    },
  };
}
