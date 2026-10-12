// FS78 + FS79 LocalBackend RPCs (FS wave I · E1, M34): learning balance and protected study time, verified external certificates.
// 1:1 mirror of supabase/migrations/20261010291001_kafaa_fs91_balance_external_certs.sql: same checks in the same order, the same
// refusal codes and messages (balance.ts SB_MSG, extcerts.ts XC_MSG), one audit row per call, a ledger row only when study time is
// approved or a certificate is verified or revoked. Spread into makeLocalM34 (backend/local.ts). Pages never import this file.
// Shared writes, as in the SQL functions: F01 skill_evidence (`se:xc:<cert>:<skill>`, kind credential, ref_table external_certs) +
// applySkills; M14 notifications (kind `recognition`, ids `nt-str-...` / `nt-xc-...`). Reads: M19 external_resources +
// catalogue_criteria (catalogueCheck, read-only import), M28 skill_alignments, M20 lineManagerOf (read-only import).
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import { applySkills } from '../../../data/local/rpc.w0';
import { catalogueCheck } from '../../m19/pathways';
import { lineManagerOf } from '../../m20/domain';
import {
  SB_MSG, balanceId, balanceOf, checkDecide, checkRequest, checkWithdraw, creditsOfHours, grantFor, sbResultCode, yearOf, type Balance, type BalanceRowLite, type RequestLite,
} from '../balance';
import {
  XC_MSG, certEvidence, certMapping, checkSubmit, checkVerify, checkWithdrawCert, issuerTier, trustTier, xcMsgKey, xcResultCode, type AlignmentLite, type CertLite, type SkillLite,
} from '../extcerts';
import type { CertSubmitInput, CertVerifyInput, LearningBalanceView, M34Rpc, StudyDecideInput, StudyRequestInput } from './rpc';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const str = (v: unknown) => (typeof v === 'string' ? v.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '') : '');
const rid = (p: string) => `${p}-${Array.from(crypto.getRandomValues(new Uint8Array(12)), (x) => x.toString(16).padStart(2, '0')).join('')}`;
type Fs91Rpc = Pick<M34Rpc, 'requestStudyTime' | 'decideStudyTime' | 'learningBalance' | 'submitExternalCert' | 'verifyExternalCert'>;

/** Is an external resource part of the outcome-gated catalogue today (published, listed, every published required criterion met)? */
export function gatedResource(x: Row | undefined | null, criteria: Row[], skills: Row[], today: string): boolean {
  return !!x && x.status === 'published' && x.listed === true && catalogueCheck(x, criteria as never, skills as never, today).ok;
}
export const alignmentMap = (rows: Row[]) => new Map<string, AlignmentLite>(rows.map((a) => [String(a.id), a as AlignmentLite]));
export const skillMap = (rows: Row[]) => new Map<string, SkillLite>(rows.map((k) => [String(k.id), k as SkillLite]));

export function makeLocalFs91(b: LocalBackend, h: LocalRpcHelpers): Fs91Rpc {
  const raw = (t: string) => ((b.raw(t as never) as unknown as Row[]) ?? []);
  const get = (t: string, id: string | null | undefined) => (id ? (b.rawGet(t as never, id) as unknown as Row | undefined) : undefined);
  const ins = (t: string, row: Row) => b.rawInsert(t as never, row as never);
  const upd = (t: string, id: string, patch: Row) => b.rawUpdate(t as never, id, patch as never);
  const me = () => b.identity().personId;
  const ctx = () => b.access();
  const hr = () => ctx().roles.includes('hr_director' as never);
  const notify = (id: string, pid: string | null | undefined, en: string, ar: string, link: string, severity = 'info') => {
    if (!pid || !get('people', pid) || get('notifications', id)) return;
    ins('notifications', { id, person_id: pid, kind: 'recognition', title_en: en, title_ar: ar, link, severity, created_at: nowTs() });
  };
  const hist = (prev: unknown, status: string, note: string | null) => [...((prev as Row[] | null) ?? []), { at: nowTs(), status, by: me(), note }];
  const requestsOf = (pid: string, year: number) => raw('study_time_requests').filter((r) => r.person_id === pid && Number(r.year) === year) as RequestLite[];
  /** The stored balance row, or the rule's grant when none is stored yet (no write). */
  const balanceBase = (pid: string, year: number): BalanceRowLite => {
    const row = get('learning_balances', balanceId(pid, year));
    if (row) return row as BalanceRowLite;
    const g = grantFor(get('people', pid) as never, year);
    return { person_id: pid, year, base_hours: g.base_hours, topup_hours: g.topup_hours };
  };
  /** Insert the balance row from the rule when missing, then store balanceOf() (mirror of kafaa_lb_refresh). */
  const refreshBalance = (pid: string, year: number): Balance => {
    const id = balanceId(pid, year);
    const ts = nowTs();
    if (!get('learning_balances', id)) {
      const g = grantFor(get('people', pid) as never, year);
      const pp = get('people', pid);
      ins('learning_balances', { id, person_id: pid, person_name: pp?.display_name ?? '', person_name_ar: pp?.display_name_ar || pp?.display_name || '', entity_id: pp?.entity_id ?? null, job_family_id: pp?.job_family_id ?? null, year, base_hours: g.base_hours, topup_hours: g.topup_hours, topup_basis: g.topup_basis, service_years: g.service_years,
        granted_hours: g.granted_hours, used_hours: 0, pending_hours: 0, remaining_hours: g.granted_hours, simulated: true, open_read: false, refreshed_at: ts, created_at: ts });
    }
    const bal = balanceOf(get('learning_balances', id) as BalanceRowLite, requestsOf(pid, year));
    upd('learning_balances', id, { granted_hours: bal.granted_hours, used_hours: bal.used_hours, pending_hours: bal.pending_hours, remaining_hours: bal.remaining_hours, refreshed_at: ts });
    return bal;
  };
  const canSeeBalance = (pid: string) => {
    const c = ctx();
    return (pid === me() && c.has('recognition', ['Own', 'Scope'])) || (c.has('recognition', ['Scope']) && c.inScope('recognition', pid)) || c.has('workforce_strategy', ['R', 'W', 'A']);
  };

  return {
    // ───────────── FS78 protected study time
    async requestStudyTime(input: StudyRequestInput) {
      await b.whenReady();
      type R = { id: string; status: string; line_manager_id?: string | null; balance?: Balance };
      const action = str(input?.action);
      const A = `study.${action === 'request' || action === 'withdraw' ? action : 'invalid'}`;
      const entity = action === 'withdraw' ? str(input?.id) || null : null;
      const who = me();
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>(A, 'study_time_requests', entity, code, msg, role);
      if (!who) return refuse('not_signed_in', SB_MSG.not_signed_in);
      const role = ctx().actingRole('recognition', ['Own']);
      if (action !== 'request' && action !== 'withdraw') return refuse('invalid', SB_MSG.invalid, role);
      const today = todayIso();
      if (action === 'withdraw') {
        const r = get('study_time_requests', entity);
        if (!r || !ctx().canReadRow('study_time_requests', r)) return refuse('not_found', SB_MSG.not_found, role);
        const c = checkWithdraw(r as RequestLite, who, today);
        if (c !== 'ok') return refuse(sbResultCode(`w_${c}`), SB_MSG[`w_${c}`], role);
        upd('study_time_requests', r.id, { status: 'withdrawn', history: hist(r.history, 'withdrawn', null), updated_at: nowTs() });
        const bal = refreshBalance(r.person_id, Number(r.year));
        return h.done<R>(A, 'study_time_requests', r.id, `${r.status} -> withdrawn`, role, null, '', 'Study-time request withdrawn', { id: r.id, status: 'withdrawn', balance: bal }, ['study_time_requests', 'learning_balances']);
      }
      if (!role) return refuse('forbidden', SB_MSG.forbidden_request);
      const person = get('people', who);
      const item = get('external_resources', str(input.resource_id));
      const gated = gatedResource(item, raw('catalogue_criteria'), raw('skills'), today);
      const year = yearOf(input.starts_on) ?? Number(today.slice(0, 4));
      const reqs = requestsOf(who, year);
      const bal = balanceOf(balanceBase(who, year), reqs);
      const lm = lineManagerOf(who, raw('people') as never, raw('role_assignments') as never, today);
      const c = checkRequest(input as never, {
        today, person: person ? { id: person.id, kind: person.kind, status: person.status, hire_date: person.hire_date } : null,
        item: item ? { id: item.id, hours: item.hours == null ? null : Number(item.hours), gated } : null,
        available: bal.available_hours, openSame: reqs.some((r) => r.resource_id === item?.id && (r.status === 'requested' || r.status === 'approved')), lineManager: lm,
      });
      if (c !== 'ok') return refuse(sbResultCode(c), SB_MSG[c], role);
      const id = rid('str');
      const hours = Number(input.hours);
      const ts = nowTs();
      ins('study_time_requests', {
        id, person_id: who, person_name: person!.display_name ?? '', person_name_ar: person!.display_name_ar || person!.display_name || '', line_manager_id: lm, line_manager_name: get('people', lm)?.display_name ?? '', year,
        resource_id: item!.id, resource_title_en: item!.title_en, resource_title_ar: item!.title_ar, hours, credits: creditsOfHours(hours),
        starts_on: input.starts_on, ends_on: input.ends_on, pattern: str(input.pattern), reason: str(input.reason), status: 'requested', decided_by: null, decided_role: null,
        decided_on: null, decision_note: null, history: hist([], 'requested', str(input.reason)), open_read: false, created_at: ts, updated_at: ts,
      });
      const nb = refreshBalance(who, year);
      notify(`nt-${id}-requested`, lm, `Study-time request: ${person!.display_name} (${hours} h, ${item!.title_en})`, `طلب وقت دراسة: ${person!.display_name_ar || person!.display_name} (${hours} ساعة، ${item!.title_ar})`, '/team/study-time');
      return h.done<R>(A, 'study_time_requests', id, `${hours}h ${item!.id} ${year} -> ${lm}`, role, null, '', 'Study time sent to your line manager', { id, status: 'requested', line_manager_id: lm, balance: nb },
        ['study_time_requests', 'learning_balances', 'notifications']);
    },

    async decideStudyTime(input: StudyDecideInput) {
      await b.whenReady();
      type R = { id: string; status: string; balance?: Balance };
      const id = str(input?.id);
      const who = me();
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('study.decide', 'study_time_requests', id || null, code, msg, role);
      if (!who) return refuse('not_signed_in', SB_MSG.not_signed_in);
      const r = get('study_time_requests', id);
      if (!r || !ctx().canReadRow('study_time_requests', r)) return refuse('not_found', SB_MSG.not_found);
      const isHr = hr();
      const role = r.line_manager_id === who ? (ctx().actingRole('recognition', ['Scope']) ?? ctx().actingRole('recognition', ['Own'])) : isHr ? 'hr_director' : ctx().actingRole('recognition', ['Own']);
      const today = todayIso();
      const bal = balanceOf(balanceBase(r.person_id, Number(r.year)), requestsOf(r.person_id, Number(r.year)));
      const c = checkDecide(input as never, r as RequestLite, who, { today, hr: isHr, remaining: bal.remaining_hours });
      if (c !== 'ok') return refuse(sbResultCode(c), SB_MSG[c], role);
      const approve = str(input.decision) === 'approve';
      const status = approve ? 'approved' : 'declined';
      const note = str(input.note) || null;
      upd('study_time_requests', id, { status, decided_by: who, decided_role: role, decided_on: today, decision_note: note, history: hist(r.history, status, note), updated_at: nowTs() });
      const nb = refreshBalance(r.person_id, Number(r.year));
      notify(`nt-${id}-${status}`, r.person_id, approve ? `Study time approved: ${r.hours} h for ${r.resource_title_en}` : `Study time declined: ${r.resource_title_en}`,
        approve ? `تمت الموافقة على وقت الدراسة: ${r.hours} ساعة لـ ${r.resource_title_ar}` : `رُفض وقت الدراسة: ${r.resource_title_ar}`, '/my/learning-balance', approve ? 'ok' : 'warn');
      return h.done<R>('study.decide', 'study_time_requests', id, `requested -> ${status} (${r.hours}h)`, role, approve ? 'kafaa.study_time.approve' : null,
        `Protected study time ${id} (${r.hours} h) approved for ${r.person_id}`, approve ? 'Study time approved' : 'Study time declined', { id, status, balance: nb },
        ['study_time_requests', 'learning_balances', 'notifications']);
    },

    async learningBalance(personId?: string | null, year?: number | null): Promise<LearningBalanceView | null> {
      await b.whenReady();
      const who = me();
      if (!who) return null;
      const pid = str(personId) || who;
      if (!canSeeBalance(pid)) return null;
      const y = Number.isInteger(year) ? Number(year) : Number(todayIso().slice(0, 4));
      const p = get('people', pid);
      if (!p) return null;
      const stored = get('learning_balances', balanceId(pid, y)) ?? null;
      return { person_id: pid, year: y, grant: grantFor(p as never, y), balance: balanceOf(balanceBase(pid, y), requestsOf(pid, y)), stored: stored ? structuredClone(stored) : null };
    },

    // ───────────── FS79 external certificates
    async submitExternalCert(input: CertSubmitInput) {
      await b.whenReady();
      type R = { id: string; status: string; tier: 'claimed' | 'enec_assessed' | 'accredited' | 'vendor_self_serve'; mapping?: ReturnType<typeof certMapping> };
      const action = str(input?.action);
      const A = `xcert.${action === 'submit' || action === 'withdraw' ? action : 'invalid'}`;
      const entity = action === 'withdraw' ? str(input?.id) || null : null;
      const who = me();
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>(A, 'external_certs', entity, code, msg, role);
      if (!who) return refuse('not_signed_in', XC_MSG.not_signed_in);
      const role = ctx().actingRole('recognition', ['Own']);
      if (!role) return refuse('forbidden', XC_MSG.forbidden_submit);
      if (action !== 'submit' && action !== 'withdraw') return refuse('invalid', XC_MSG.invalid, role);
      if (action === 'withdraw') {
        const cx = get('external_certs', entity);
        if (!cx || !ctx().canReadRow('external_certs', cx)) return refuse('not_found', XC_MSG.not_found, role);
        const c = checkWithdrawCert(cx as CertLite, who);
        if (c !== 'ok') return refuse(xcResultCode(`w_${c}`), XC_MSG[`w_${c}`], role);
        upd('external_certs', cx.id, { status: 'withdrawn', history: hist(cx.history, 'withdrawn', null), updated_at: nowTs() });
        return h.done<R>(A, 'external_certs', cx.id, 'submitted -> withdrawn', role, null, '', 'Certificate withdrawn', { id: cx.id, status: 'withdrawn', tier: 'claimed' }, ['external_certs']);
      }
      const today = todayIso();
      const al = alignmentMap(raw('skill_alignments'));
      const sk = skillMap(raw('skills'));
      const url = str(input.verification_url);
      const dup = raw('external_certs').some((x) => x.person_id === who && x.verification_url === url && (x.status === 'submitted' || x.status === 'verified'));
      const c = checkSubmit(input as never, { today, alignments: al, skills: sk, duplicate: dup });
      if (c !== 'ok') return refuse(xcResultCode(c), XC_MSG[c], role);
      const person = get('people', who)!;
      const id = rid('xc');
      const ts = nowTs();
      const exp = str(input.expires_on) || null;
      const row = {
        id, person_id: who, person_name: person.display_name ?? '', title: str(input.title), issuer: str(input.issuer), issuer_kind: str(input.issuer_kind),
        accreditation_ref: str(input.accreditation_ref) || null, credential_ref: str(input.credential_ref), issued_on: input.issued_on, expires_on: exp, verification_url: url,
        resource_id: get('external_resources', str(input.resource_id)) ? str(input.resource_id) : null, alignment_ids: [...(input.alignment_ids ?? [])].sort(),
        levels: input.levels ?? {}, note: str(input.note) || null, status: 'submitted', tier: null, method: null, verified_by: null, verified_role: null, verified_on: null,
        decision_note: null, mapped: [], evidence_ids: [], history: hist([], 'submitted', null), created_at: ts, updated_at: ts,
      };
      ins('external_certs', row);
      const mapping = certMapping(row, issuerTier(row), al, sk);
      return h.done<R>(A, 'external_certs', id, `submitted ${row.issuer_kind}, ${row.alignment_ids.length} crosswalk entries`, role, null, '', 'Certificate added: a verifier will check it',
        { id, status: 'submitted', tier: 'claimed', mapping }, ['external_certs']);
    },

    async verifyExternalCert(input: CertVerifyInput) {
      await b.whenReady();
      type R = { id: string; status: string; tier: 'claimed' | 'enec_assessed' | 'accredited' | 'vendor_self_serve'; evidence_ids?: string[]; mapping?: ReturnType<typeof certMapping> };
      const id = str(input?.id);
      const who = me();
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('xcert.verify', 'external_certs', id || null, code, msg, role);
      if (!who) return refuse('not_signed_in', XC_MSG.not_signed_in);
      const role = ctx().actingRole('recognition', ['A']);
      if (!role) return refuse('forbidden', XC_MSG.forbidden_verify);
      const cx = get('external_certs', id);
      if (!cx) return refuse('not_found', XC_MSG.not_found, role);
      const today = todayIso();
      const c = checkVerify(input as never, cx as CertLite, who, today);
      if (c !== 'ok') return refuse(xcResultCode(c), XC_MSG[xcMsgKey(c)], role);
      const d = str(input.decision);
      const note = str(input.note) || null;
      const ts = nowTs();
      if (d === 'reject') {
        upd('external_certs', id, { status: 'rejected', verified_by: who, verified_role: role, decision_note: note, history: hist(cx.history, 'rejected', note), updated_at: ts });
        notify(`nt-xc-${id}-rejected`, cx.person_id, `External certificate not verified: ${cx.title}`, `لم يُتحقق من الشهادة الخارجية: ${cx.title}`, '/my/recognition/certificates', 'warn');
        return h.done<R>('xcert.verify', 'external_certs', id, 'submitted -> rejected', role, null, '', 'Certificate not verified', { id, status: 'rejected', tier: 'claimed' }, ['external_certs', 'notifications']);
      }
      if (d === 'revoke') {
        for (const eid of (cx.evidence_ids ?? []) as string[]) if (get('skill_evidence', eid)) upd('skill_evidence', eid, { active: false });
        upd('external_certs', id, { status: 'revoked', decision_note: note, history: hist(cx.history, 'revoked', note), updated_at: ts });
        if ((cx.evidence_ids ?? []).length) await applySkills(b, cx.person_id, today);
        notify(`nt-xc-${id}-revoked`, cx.person_id, `External certificate revoked: ${cx.title}`, `أُلغي التحقق من الشهادة الخارجية: ${cx.title}`, '/my/recognition/certificates', 'warn');
        return h.done<R>('xcert.verify', 'external_certs', id, `verified -> revoked (${(cx.evidence_ids ?? []).length} evidence rows inactive)`, role, 'kafaa.xcert.revoke',
          `External certificate ${id} revoked for ${cx.person_id}`, 'Verification revoked: its evidence no longer counts', { id, status: 'revoked', tier: 'claimed', evidence_ids: cx.evidence_ids ?? [] },
          ['external_certs', 'skill_evidence', 'person_skills', 'notifications']);
      }
      const tier = issuerTier(cx as CertLite);
      const mapping = certMapping(cx, tier, alignmentMap(raw('skill_alignments')), skillMap(raw('skills')));
      const ev = certEvidence({ ...(cx as CertLite), status: 'verified', tier }, mapping, today, who);
      for (const e of ev) {
        const patch = { level: e.level, basis: e.basis, status: 'current', observed_on: e.observed_on, note: e.note, recorded_by: who, active: true };
        if (get('skill_evidence', e.id)) upd('skill_evidence', e.id, patch);
        else ins('skill_evidence', { ...e, created_at: ts, org_id: null, contractor: false });
      }
      const ids = ev.map((e) => e.id);
      upd('external_certs', id, { status: 'verified', tier, method: str(input.method), verified_by: who, verified_role: role, verified_on: today, decision_note: note, mapped: mapping.rows,
        evidence_ids: ids, history: hist(cx.history, 'verified', note), updated_at: ts });
      if (ids.length) await applySkills(b, cx.person_id, today);
      notify(`nt-xc-${id}-verified`, cx.person_id, `External certificate verified: ${cx.title} (${ids.length} skills)`, `تم التحقق من الشهادة الخارجية: ${cx.title} (${ids.length} مهارات)`, '/my/recognition/certificates', 'ok');
      return h.done<R>('xcert.verify', 'external_certs', id, `submitted -> verified ${tier} (${ids.length} skills)`, role, 'kafaa.xcert.verify',
        `External certificate ${id} verified (${tier}) for ${cx.person_id}`, 'Certificate verified', { id, status: 'verified', tier: trustTier({ ...(cx as CertLite), status: 'verified', tier }), evidence_ids: ids, mapping },
        ['external_certs', 'skill_evidence', 'person_skills', 'notifications']);
    },
  };
}
