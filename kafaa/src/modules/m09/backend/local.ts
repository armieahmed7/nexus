// M09 extension LocalBackend RPCs (owner: W5 · E2, F33 Contractor and supplier skills passport). Installed on every LocalRpc by
// src/data/ext/local.ts. 1:1 mirror of supabase/migrations/20261009152001_kafaa_w5e2_contractor_passport.sql: same checks in the same
// order, the same refusal codes and messages (CPMSG in src/modules/m09/contractor.ts), the same audit and ledger rows. Pages never import it.
//
// Triggers mirrored here (installContractorPassport wraps rawInsert / rawUpdate, like the SQL triggers):
//   kafaa_cp_stamp       person_skills and skill_evidence rows of contractor people carry org_id and contractor = true (F33 read rules)
//   kafaa_cp_on_*        a supplier academy certificate (insert, status or validity change) or an equivalency decision re-syncs the
//                        contractor's passport evidence (kafaa_cp_sync = syncContractor) and recomputes the F01 skill state.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { Table } from '../../../data/types';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import { applySkills } from '../../../data/local/rpc.w0';
import { edSign, fromHex } from '../../m17/badgeCrypto';
import { buildCredential, signingBytes, withProof } from '../../m17/issuer';
import { CERT_SYSTEM, courseAlignment, securityComps, type CourseRow, type SkillRow } from '../../m17/badgeRules';
import {
  CPMSG, CP_REF_TABLES, HEADCOUNT_BANDS, RESTRICTED_FAMILIES, contractorEvidence, contractorOrgOf, precheck, targetId, type CpWorld, type Precheck,
} from '../contractor';
import type { ContractorBadge, M09Rpc } from './rpc';
import { makeLocalFs75 } from './local.fs75'; // FS68/FS69 (fsGe5)

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
/** Offline demo key of the in-browser backend (published in the issuer profile as key-offline; same as M17's). Not the server key. */
const OFFLINE_SEED = '80df5566f0f615286d25a424ee54b2c33e94253912786453b748dd943143864d';
const installed = new WeakSet<LocalBackend>();

/** World for contractorEvidence from the LocalBackend tables. */
export function cpWorld(b: LocalBackend): CpWorld {
  const raw = (t: string) => b.raw(t as Table) as unknown as Row[];
  return {
    skills: raw('skills') as never, comps: raw('competencies'), courses: raw('courses'), standards: raw('qual_standards'), roleComps: raw('role_competencies'),
    certificates: raw('certificates'), equivalency: raw('equivalency_requests'), engagements: raw('contractor_engagements'),
  };
}
/** kafaa_cp_org: the supplier organisation of a contractor person, or null. */
export function cpOrg(b: LocalBackend, personId: string | null | undefined): string | null {
  if (!personId) return null;
  return contractorOrgOf(b.rawGet('people', personId) as unknown as Row, (o) => (b.rawGet('organisations', o) as unknown as Row | undefined)?.kind);
}

/** kafaa_cp_sync: upsert the person's passport evidence, deactivate rows whose source is gone, recompute the skill state. */
export function syncContractor(b: LocalBackend, personId: string, today = todayIso()) {
  if (!cpOrg(b, personId)) return;
  const want = contractorEvidence(personId, cpWorld(b), today);
  const ids = new Set(want.map((e) => e.id));
  for (const e of want) {
    const cur = b.rawGet('skill_evidence', e.id) as unknown as Row | undefined;
    if (!cur) b.rawInsert('skill_evidence', { ...e, recorded_by: null, created_at: nowTs() } as never);
    else if (cur.level !== e.level || cur.basis !== e.basis || cur.status !== e.status || String(cur.observed_on).slice(0, 10) !== e.observed_on || cur.active !== e.active || cur.note !== e.note)
      b.rawUpdate('skill_evidence', e.id, { level: e.level, basis: e.basis, status: e.status, observed_on: e.observed_on, active: e.active, note: e.note } as never);
  }
  for (const e of b.raw('skill_evidence') as unknown as Row[])
    if (e.person_id === personId && e.active && CP_REF_TABLES.includes(e.ref_table) && (e.kind === 'credential' || e.kind === 'ojt') && !ids.has(e.id)) b.rawUpdate('skill_evidence', e.id, { active: false } as never);
  void applySkills(b, personId, today);
}

/** Install the stamp and sync triggers once per LocalBackend. */
export function installContractorPassport(b: LocalBackend) {
  if (installed.has(b)) return;
  installed.add(b);
  const ins = b.rawInsert.bind(b);
  const upd = b.rawUpdate.bind(b);
  const stamp = (table: string, row: Row) => {
    if (table !== 'person_skills' && table !== 'skill_evidence') return row;
    const org = cpOrg(b, row.person_id);
    return { ...row, org_id: org, contractor: org != null };
  };
  const resync = (pid: string | null | undefined) => {
    if (!pid || !cpOrg(b, pid)) return;
    syncContractor(b, pid);
    b.changed(['skill_evidence', 'person_skills'] as Table[]);
  };
  (b as unknown as { rawInsert: unknown }).rawInsert = (table: Table, row: Row) => {
    const full = ins(table, stamp(table, row) as never) as unknown as Row;
    if (table === 'certificates' || table === 'equivalency_requests') resync(full.person_id);
    return full;
  };
  (b as unknown as { rawUpdate: unknown }).rawUpdate = (table: Table, id: string, patch: Row) => {
    const before = table === 'certificates' || table === 'equivalency_requests' ? { ...((b.rawGet(table, id) as unknown as Row) ?? {}) } : null;
    upd(table, id, patch as never);
    if (!before) return;
    const after = b.rawGet(table, id) as unknown as Row | undefined;
    if (after && (after.status !== before.status || String(after.valid_to ?? '') !== String(before.valid_to ?? ''))) resync(after.person_id);
  };
}

export function makeLocalM09(b: LocalBackend, h: LocalRpcHelpers): M09Rpc {
  installContractorPassport(b);
  const me = () => b.identity().personId;
  const ctx = () => b.access();
  const raw = (t: string) => b.raw(t as Table) as unknown as Row[];
  const get = (t: string, id: string | null | undefined) => (id ? (b.rawGet(t as Table, id) as unknown as Row | undefined) : undefined);
  /** kafaa_cp_access: the acting role that may read this contractor's passport, or null (staff, other organisations, nobody). */
  const access = (pid: string): string | null => {
    const caller = me();
    const org = cpOrg(b, pid);
    if (!caller || !org) return null;
    const c = ctx();
    if (pid === caller) return c.actingRole('own_profile', ['Own']);
    if (c.has('equivalency', ['OwnOrg', 'OrgW']) && org === b.identity().orgId) return c.actingRole('equivalency', ['OwnOrg', 'OrgW']);
    if (c.has('equivalency', ['R', 'W', 'A'])) return c.actingRole('equivalency', ['R', 'W', 'A']);
    return null;
  };

  return {
    ...makeLocalFs75(b, h), // FS68/FS69 (fsGe5)
    async equivalencyPrecheck(personId, standardId) {
      await b.whenReady();
      type R = Precheck;
      const A = 'equivalency.precheck';
      const pid = String(personId ?? '');
      if (!me()) return h.refuse<R>(A, 'equivalency_requests', pid || null, 'not_signed_in', CPMSG.not_signed_in);
      const role = access(pid);
      if (!role) return h.refuse<R>(A, 'equivalency_requests', pid || null, 'not_found', CPMSG.not_found_person);
      const std = get('qual_standards', standardId);
      if (!std || std.status !== 'current') return h.refuse<R>(A, 'equivalency_requests', pid, 'not_found', CPMSG.not_found_standard, role);
      if (std.security_restricted) return h.refuse<R>(A, 'equivalency_requests', pid, 'invalid', CPMSG.security, role);
      const r = precheck({
        person_id: pid, standard: std, tasks: raw('task_items'), links: raw('task_skill_links'), states: raw('person_skills').filter((s) => s.person_id === pid),
        skills: raw('skills') as never, comps: raw('competencies'), requests: raw('equivalency_requests'), courses: raw('courses'),
      });
      return h.done<R>(A, 'equivalency_requests', pid, `${std.code}: ${r.likely}/${r.total} likely, ${r.critical_gaps} critical gaps, outlook ${r.outlook}`, role, null, '', CPMSG.precheck_ok, r, ['audit_events']);
    },

    async setContractRoleTarget(input) {
      await b.whenReady();
      type R = { id: string };
      const A = 'contractor.role_target';
      const p = (input ?? {}) as Row;
      const entity = p.org_id && p.role_id ? targetId(String(p.org_id), String(p.role_id)) : null;
      if (!me()) return h.refuse<R>(A, 'contract_role_targets', entity, 'not_signed_in', CPMSG.not_signed_in);
      const role = ctx().actingRole('partner_org', ['A']);
      if (!role) return h.refuse<R>(A, 'contract_role_targets', entity, 'forbidden', CPMSG.target_forbidden);
      const org = get('organisations', p.org_id);
      if (!org || org.kind !== 'supplier') return h.refuse<R>(A, 'contract_role_targets', entity, 'not_found', CPMSG.target_org, role);
      const jr = get('job_roles', p.role_id);
      if (!jr || jr.status !== 'published') return h.refuse<R>(A, 'contract_role_targets', entity, 'not_found', CPMSG.target_role, role);
      if (jr.security_sensitive || RESTRICTED_FAMILIES.includes(jr.family_id)) return h.refuse<R>(A, 'contract_role_targets', entity, 'security_restricted', CPMSG.target_security, role);
      if (!(HEADCOUNT_BANDS as readonly string[]).includes(p.headcount_band)) return h.refuse<R>(A, 'contract_role_targets', entity, 'invalid', CPMSG.target_band, role);
      const ref = String(p.contract_ref ?? '').trim();
      const en = String(p.scope_en ?? '').trim();
      const ar = String(p.scope_ar ?? '').trim();
      if (ref.length > 200 || en.length > 200 || ar.length > 200) return h.refuse<R>(A, 'contract_role_targets', entity, 'invalid', CPMSG.target_text, role);
      const id = targetId(org.id, jr.id);
      const active = p.active !== false;
      const row = { org_id: org.id, role_id: jr.id, headcount_band: p.headcount_band, contract_ref: ref, scope_en: en, scope_ar: ar, active, set_by: me(), updated_at: nowTs() };
      if (get('contract_role_targets', id)) b.rawUpdate('contract_role_targets' as Table, id, row as never);
      else b.rawInsert('contract_role_targets' as Table, { id, ...row, valid_from: todayIso(), valid_to: null } as never);
      const why = `${org.id} ${jr.id} ${p.headcount_band}${active ? '' : ' (inactive)'}`;
      return h.done<R>(A, 'contract_role_targets', id, why, role, 'kafaa.contractor.role_target', `Contracted role profile ${why}`, CPMSG.target_ok, { id }, ['contract_role_targets']);
    },

    async issueContractorBadge(certificateId) {
      await b.whenReady();
      type R = { id: string; slug: string };
      const A = 'badge.issue';
      const src = String(certificateId ?? '').trim();
      const caller = me();
      if (!caller) return h.refuse<R>(A, 'badges', src || null, 'not_signed_in', CPMSG.not_signed_in);
      if (!cpOrg(b, caller)) return h.refuse<R>(A, 'badges', src || null, 'forbidden', CPMSG.badge_forbidden);
      const role = ctx().actingRole('own_profile', ['Own']);
      const cert = raw('certificates').find((c) => c.id === src && c.person_id === caller);
      const course = cert ? get('courses', cert.course_id) : undefined;
      if (!cert || !course || course.audience !== 'supplier') return h.refuse<R>(A, 'badges', src || null, 'not_found', CPMSG.badge_not_found, role);
      const today = todayIso();
      if (cert.status === 'revoked') return h.refuse<R>(A, 'badges', src, 'not_eligible', CPMSG.badge_revoked, role);
      if (cert.status !== 'valid' || (cert.valid_to && String(cert.valid_to).slice(0, 10) < today)) return h.refuse<R>(A, 'badges', src, 'not_eligible', CPMSG.badge_expired, role);
      const sec = securityComps(raw('competencies') as never);
      if ((course.competency_ids ?? []).some((id: string) => sec.has(id))) return h.refuse<R>(A, 'badges', src, 'security_restricted', CPMSG.badge_security, role);
      if (raw('badges').some((x) => x.person_id === caller && x.course_id === course.id && x.status === 'active')) return h.refuse<R>(A, 'badges', src, 'already_issued', CPMSG.badge_duplicate, role);
      const person = get('people', caller);
      const initials = String(cert.holder_initials || person?.initials || '—');
      const aligned = courseAlignment(course as CourseRow, raw('skills') as unknown as SkillRow[], sec);
      const slug = `kb${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
      const id = `bdg-${slug}`;
      const validTo = cert.valid_to ? String(cert.valid_to).slice(0, 10) : null;
      const cred = buildCredential({ slug, kind: 'certificate', certificateNo: cert.id, course: course as never, holderInitials: initials, issuedOn: today, validTo, sourceDate: String(cert.issued_on).slice(0, 10), sourceSystem: CERT_SYSTEM, alignment: aligned, keyId: 'key-offline' });
      const signed = withProof(cred, edSign(signingBytes(cred), fromHex(OFFLINE_SEED)));
      b.rawInsert('badges', {
        id, person_id: caller, source_table: 'certificates', source_id: cert.id, course_id: course.id, holder_initials: initials,
        achievement: { kind: 'certificate', code: course.code, name_en: course.title_en, name_ar: course.title_ar, skills: aligned.map((a) => a.id) },
        credential: signed, issued_on: today, valid_to: validTo, status: 'active', key_id: 'key-offline', public_slug: slug, revoked_at: null, revoke_reason: null, created_at: nowTs(),
      } as never);
      return h.done<R>(A, 'badges', id, `${course.code} certificate ${cert.id} (contractor)`, role, 'kafaa.badge.issue', `Badge ${slug} issued for ${course.code} (certificate)`, CPMSG.badge_ok, { id, slug }, ['badges']);
    },

    async contractorBadges(personId) {
      await b.whenReady();
      const pid = String(personId ?? '');
      const role = access(pid);
      if (!role) return [];
      const full = pid === me() || (ctx().has('equivalency', ['OwnOrg', 'OrgW']) && cpOrg(b, pid) === b.identity().orgId);
      return raw('badges')
        .filter((x) => x.person_id === pid)
        .sort((a, c) => (String(c.issued_on) < String(a.issued_on) ? -1 : String(c.issued_on) > String(a.issued_on) ? 1 : a.id < c.id ? -1 : 1))
        .map((x): ContractorBadge => ({ id: x.id, public_slug: x.public_slug, course_id: x.course_id, achievement: x.achievement, issued_on: String(x.issued_on).slice(0, 10), valid_to: x.valid_to ? String(x.valid_to).slice(0, 10) : null, status: x.status, credential: full ? x.credential : null }));
    },
  };
}
