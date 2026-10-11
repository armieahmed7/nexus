// M17 LocalBackend RPCs for F32 Stackable micro-credentials (owner: W5 · E1). Spread into makeLocalM17 (backend/local.ts).
// 1:1 mirror of the kafaa_mc_* functions in supabase/migrations/20261009151001_kafaa_w5e1_microcred_ojt.sql: same checks in the same
// order, the same refusal codes and messages (MCMSG in src/modules/m17/microcred.ts), the same audit and ledger rows.
// Shared writes, only through these RPCs (like the SQL SECURITY DEFINER functions):
//   F01 skill_evidence   `se:credential:<award>:<skill>` (kind credential, basis evidenced, level <= 2) + applySkills
//   M14 notifications    kind `microcred`, ids `nt-mc-...`
// Signing: the in-browser backend signs with the labelled offline demo key (key-offline), like F04 badges.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { M17Rpc, MicrocredCheck, MicrocredStat, EligibilityResult } from './rpc';
import { todayIso } from '../../../domain/rules';
import { evidenceId } from '../../../domain/skills';
import { applySkills } from '../../../data/local/rpc.w0';
import { nowTs } from '../../../data/audit';
import { MIN_GROUP_SIZE } from '../../../auth/policy';
import { edSign, fromHex } from '../badgeCrypto';
import { signingBytes, withProof, NOTICE_EN } from '../issuer';
import {
  MCMSG, addMonths, alignedSkills, defFor, awardView, buildMicrocredCredential, componentsOf, currentDef, eligibility, evidenceSnapshot, latestAward, resolveRenewal, validateDef,
  type AwardRow, type DefInput, type DefRow, type Eligibility, type McWorld,
} from '../microcred';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const hex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (x) => x.toString(16).padStart(2, '0')).join('');
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const trim = (x: unknown) => String(x ?? '').trim();
export const MC_VERIFY_PER_SLUG_PER_MIN = 20;
export const MC_VERIFY_PER_MIN = 600;
const T_AW = ['microcred_awards', 'skill_evidence', 'person_skills', 'notifications'];

export function makeLocalM17W5(b: LocalBackend, h: LocalRpcHelpers, offlineSeed: string): Pick<M17Rpc,
  'microcredEligibility' | 'awardMicrocred' | 'decideMicrocredAward' | 'revokeMicrocred' | 'verifyMicrocred' | 'saveMicrocredDef' | 'setMicrocredDefStatus' | 'microcredSweep' | 'microcredStats'> {
  const raw = (t: string) => b.raw(t as never) as unknown as Row[];
  const get = (t: string, id: string | null | undefined) => (id ? (b.rawGet(t as never, id) as unknown as Row | undefined) : undefined);
  const ins = (t: string, row: Row) => b.rawInsert(t as never, row as never);
  const upd = (t: string, id: string, patch: Row) => b.rawUpdate(t as never, id, patch as never);
  const me = () => b.identity().personId;
  const ctx = () => b.access();
  const defs = () => raw('microcred_defs') as unknown as DefRow[];
  const awards = () => raw('microcred_awards') as unknown as AwardRow[];
  const world = (today: string): McWorld => ({
    today, defs: defs(), awards: awards(), courses: raw('courses'), training_records: raw('training_records'), attempts: raw('attempts'),
    opportunities: raw('opportunities'), opportunity_applications: raw('opportunity_applications'), person_skills: raw('person_skills'),
    // FS31: FS21/FS22 results for the adaptive and task criteria
    adaptive_attempts: raw('adaptive_attempts'), task_attempts: raw('task_attempts'), integrity_reports: raw('integrity_reports'),
  });
  const notify = (id: string, pid: string | null | undefined, en: string, ar: string, link: string, severity = 'info'): boolean => {
    if (!pid || !get('people', pid) || get('notifications', id)) return false;
    ins('notifications', { id, person_id: pid, kind: 'microcred', title_en: en, title_ar: ar, link, severity, created_at: nowTs() });
    return true;
  };
  const trainingManagers = () => [...new Set(raw('role_assignments').filter((a) => a.role === 'training_manager' && a.status === 'active').map((a) => String(a.person_id)))].sort();

  /** Sign and store an award (new or approved), supersede the renewed one, write F01 credential evidence. */
  const issue = async (def: DefRow, person: string, e: Eligibility, approvedBy: string | null, existing: Row | null, today: string) => {
    const prev = latestAward(awards(), person, def.code);
    const slug = `mc${hex(6)}`;
    const id = existing?.id ?? `mca-${hex(8)}`;
    const initials = String(get('people', person)?.initials || '—');
    const skills = alignedSkills(def, raw('skills'), raw('competencies'));
    const comps = e.components.map((c) => ({ slug: String(get('microcred_awards', c.award_id)?.public_slug ?? ''), code: c.code, title_en: c.title_en }));
    const validTo = addMonths(today, Number(def.validity_months));
    const cred = buildMicrocredCredential({ slug, def, holderInitials: initials, issuedOn: today, validTo, alignment: skills, components: comps, keyId: 'key-offline' });
    const signed = withProof(cred, edSign(signingBytes(cred), fromHex(offlineSeed)));
    const row = {
      def_id: def.id, def_code: def.code, def_version: Number(def.version), person_id: person, holder_initials: initials, status: 'awarded', issued_on: today, valid_to: validTo,
      evidence: evidenceSnapshot(e, approvedBy, today), component_award_ids: e.components.map((c) => c.award_id).filter(Boolean) as string[], credential: signed, key_id: 'key-offline',
      public_slug: slug, renewed_from: prev && prev.id !== id ? prev.id : null, decided_by: approvedBy, decided_at: approvedBy ? nowTs() : null,
    };
    if (existing) upd('microcred_awards', id, row);
    else ins('microcred_awards', { id, requested_at: nowTs(), decision_note: null, revoked_at: null, revoke_reason: null, created_at: nowTs(), ...row });
    if (prev && prev.id !== id) {
      upd('microcred_awards', prev.id, { status: 'superseded' });
      for (const ev of raw('skill_evidence').filter((x) => x.ref_table === 'microcred_awards' && x.ref_id === prev.id && x.active)) upd('skill_evidence', ev.id, { active: false });
    }
    for (const s of skills) {
      const ev = evidenceId('credential', id, s.id);
      if (get('skill_evidence', ev)) upd('skill_evidence', ev, { active: true });
      else ins('skill_evidence', { id: ev, person_id: person, skill_id: s.id, kind: 'credential', ref_table: 'microcred_awards', ref_id: id, level: s.level, basis: 'evidenced', status: 'current', observed_on: today, note: null, recorded_by: approvedBy ?? person, active: true, created_at: nowTs() });
    }
    await applySkills(b, person, today);
    notify(`nt-mc-${id}-awarded`, person, `Micro-credential awarded: ${def.code} ${def.title_en}`, `مُنح الاعتماد المصغّر: ${def.code} ${def.title_ar}`, '/my/skills/credentials', 'ok');
    return { id, slug, renewed: !!(prev && prev.id !== id) };
  };

  return {
    async microcredEligibility(personId, code) {
      await b.whenReady();
      const caller = me();
      const deny = (c: 'not_signed_in' | 'forbidden' | 'not_found'): EligibilityResult => ({ allowed: false, code: c, items: [] });
      if (!caller) return deny('not_signed_in');
      const pid = personId || caller;
      const c = ctx();
      const allowed = pid === caller ? c.has('skills_profile', ['Own', 'Scope', 'A']) : c.has('skills_profile', ['A']) || (c.has('skills_profile', ['Scope']) && c.inScope('skills_profile', pid));
      if (!allowed) return deny('forbidden');
      if (!get('people', pid)) return deny('not_found');
      const today = todayIso();
      const w = world(today);
      const list = w.defs.filter((d) => d.status === 'current' && (!code || d.code === code)).sort((x, y) => (Number(x.sort) || 0) - (Number(y.sort) || 0) || cmp(x.code, y.code));
      if (code && !list.length) return deny('not_found');
      return { allowed: true, person_id: pid, items: list.map((d) => eligibility(d, pid, w)) };
    },

    async awardMicrocred(codeIn) {
      await b.whenReady();
      type R = { id: string; status: string; slug: string | null };
      const A = 'microcred.award';
      const code = trim(codeIn);
      const caller = me();
      if (!caller) return h.refuse<R>(A, 'microcred_awards', code || null, 'not_signed_in', MCMSG.not_signed_in);
      const role = ctx().actingRole('skills_profile', ['Own']);
      if (!role) return h.refuse<R>(A, 'microcred_awards', code || null, 'forbidden', MCMSG.forbidden_award);
      const today = todayIso();
      const w = world(today);
      const def = currentDef(w.defs, code);
      if (!def) return h.refuse<R>(A, 'microcred_awards', code || null, 'not_found', MCMSG.not_found_def, role);
      if (w.awards.some((a) => a.person_id === caller && a.def_code === code && a.status === 'pending_approval')) return h.refuse<R>(A, 'microcred_awards', code, 'already_requested', MCMSG.already_requested, role);
      const prev = latestAward(w.awards, caller, code);
      if (prev && awardView(prev, today, w.awards).status === 'active') return h.refuse<R>(A, 'microcred_awards', code, 'already_awarded', MCMSG.already_awarded, role);
      const e = eligibility(def, caller, w);
      if (!e.auto_met) return h.refuse<R>(A, 'microcred_awards', code, 'not_eligible', MCMSG.not_eligible, role);
      if (e.manual > 0) {
        const id = `mca-${hex(8)}`;
        ins('microcred_awards', {
          id, def_id: def.id, def_code: def.code, def_version: Number(def.version), person_id: caller, holder_initials: String(get('people', caller)?.initials || '—'), status: 'pending_approval',
          requested_at: nowTs(), issued_on: null, valid_to: null, evidence: evidenceSnapshot(e, null, today), component_award_ids: e.components.map((c) => c.award_id).filter(Boolean),
          credential: {}, key_id: null, public_slug: null, renewed_from: null, decided_by: null, decided_at: null, decision_note: null, revoked_at: null, revoke_reason: null, created_at: nowTs(),
        });
        for (const tm of trainingManagers()) if (tm !== caller) notify(`nt-mc-${id}-${tm}`, tm, `Micro-credential to confirm: ${def.code}`, `اعتماد مصغّر بانتظار التأكيد: ${def.code}`, '/admin/frameworks?tab=microcredentials', 'info');
        return h.done<R>(A, 'microcred_awards', id, `${def.code} v${def.version} pending approval`, role, null, '', MCMSG.pending_sent, { id, status: 'pending_approval', slug: null }, ['microcred_awards', 'notifications']);
      }
      const r = await issue(def, caller, e, null, null, today);
      return h.done<R>(A, 'microcred_awards', r.id, `${def.code} v${def.version} awarded${r.renewed ? ' (renewal)' : ''}`, role, 'kafaa.microcred.award', `Micro-credential ${r.slug} awarded for ${def.code}`, MCMSG.awarded, { id: r.id, status: 'awarded', slug: r.slug }, T_AW);
    },

    async decideMicrocredAward(awardId, decision, note) {
      await b.whenReady();
      type R = { id: string; status: string; slug: string | null };
      const A = 'microcred.decide';
      const caller = me();
      if (!caller) return h.refuse<R>(A, 'microcred_awards', awardId || null, 'not_signed_in', MCMSG.not_signed_in);
      const role = ctx().actingRole('skills_profile', ['A']);
      if (!role) return h.refuse<R>(A, 'microcred_awards', awardId || null, 'forbidden', MCMSG.forbidden_decide);
      const a = get('microcred_awards', awardId);
      if (!a) return h.refuse<R>(A, 'microcred_awards', awardId || null, 'not_found', MCMSG.not_found_award, role);
      if (a.person_id === caller) return h.refuse<R>(A, 'microcred_awards', a.id, 'maker_checker', MCMSG.maker_checker, role);
      if (a.status !== 'pending_approval') return h.refuse<R>(A, 'microcred_awards', a.id, 'conflict', MCMSG.not_pending, role);
      const n = trim(note);
      if (n.length < 3 || n.length > 500 || (decision !== 'approve' && decision !== 'decline')) return h.refuse<R>(A, 'microcred_awards', a.id, 'invalid', MCMSG.note_required, role);
      const today = todayIso();
      if (decision === 'decline') {
        upd('microcred_awards', a.id, { status: 'declined', decided_by: caller, decided_at: nowTs(), decision_note: n });
        notify(`nt-mc-${a.id}-declined`, a.person_id, `Micro-credential request declined: ${a.def_code}`, `رُفض طلب الاعتماد المصغّر: ${a.def_code}`, '/my/skills/credentials', 'warn');
        return h.done<R>(A, 'microcred_awards', a.id, `declined: ${n}`, role, null, '', MCMSG.declined, { id: a.id, status: 'declined', slug: null }, ['microcred_awards', 'notifications']);
      }
      const w = world(today);
      const def = currentDef(w.defs, a.def_code);
      if (!def) return h.refuse<R>(A, 'microcred_awards', a.id, 'not_found', MCMSG.not_found_def, role);
      const e = eligibility(def, a.person_id, w);
      if (!e.auto_met) return h.refuse<R>(A, 'microcred_awards', a.id, 'not_eligible', MCMSG.not_eligible, role);
      const r = await issue(def, a.person_id, e, caller, a, today);
      upd('microcred_awards', a.id, { decision_note: n });
      return h.done<R>(A, 'microcred_awards', a.id, `approved ${def.code} v${def.version}: ${n}`, role, 'kafaa.microcred.approve', `Micro-credential ${r.slug} approved for ${def.code}`, MCMSG.awarded, { id: a.id, status: 'awarded', slug: r.slug }, T_AW);
    },

    async revokeMicrocred(awardId, reason) {
      await b.whenReady();
      const A = 'microcred.revoke';
      const caller = me();
      if (!caller) return h.refuse(A, 'microcred_awards', awardId || null, 'not_signed_in', MCMSG.not_signed_in);
      const c = ctx();
      const a = get('microcred_awards', awardId);
      const own = !!a && a.person_id === caller && c.has('skills_profile', ['Own']);
      if (!a || (!own && !c.has('skills_profile', ['A']))) return h.refuse(A, 'microcred_awards', awardId || null, 'not_found', MCMSG.forbidden_revoke);
      const role = own ? c.actingRole('skills_profile', ['Own']) : c.actingRole('skills_profile', ['A']);
      if (a.status !== 'awarded' && a.status !== 'pending_approval') return h.refuse(A, 'microcred_awards', a.id, 'conflict', MCMSG.already_revoked, role);
      const why = trim(reason);
      if (why.length < 3 || why.length > 500) return h.refuse(A, 'microcred_awards', a.id, 'invalid', MCMSG.note_required, role);
      upd('microcred_awards', a.id, { status: 'revoked', revoked_at: nowTs(), revoke_reason: why });
      for (const ev of raw('skill_evidence').filter((x) => x.ref_table === 'microcred_awards' && x.ref_id === a.id && x.active)) upd('skill_evidence', ev.id, { active: false });
      await applySkills(b, a.person_id, todayIso());
      return h.done(A, 'microcred_awards', a.id, `${own ? 'withdrawn by holder' : 'revoked'}: ${why}`, role, 'kafaa.microcred.revoke', `Micro-credential ${a.public_slug ?? a.id} revoked`, own ? MCMSG.revoked_own : MCMSG.revoked, undefined, T_AW);
    },

    async verifyMicrocred(slugIn) {
      await b.whenReady();
      const A = 'microcred.verify';
      const slug = trim(slugIn).slice(0, 64);
      const since = new Date(Date.now() - 60_000).toISOString();
      const recent = raw('audit_events').filter((x) => x.action === A && String(x.ts) > since);
      if (recent.filter((x) => x.entity_id === slug).length >= MC_VERIFY_PER_SLUG_PER_MIN || recent.length >= MC_VERIFY_PER_MIN) return h.refuse<MicrocredCheck>(A, 'microcred_awards', slug || null, 'rate_limited', MCMSG.rate_limited);
      const a = slug ? (awards().find((x) => x.public_slug === slug) as Row | undefined) : undefined;
      if (!a) return h.refuse<MicrocredCheck>(A, 'microcred_awards', slug || null, 'not_found', MCMSG.verify_not_found);
      const today = todayIso();
      const all = awards();
      const status = awardView(a as AwardRow, today, all).status;
      const components = (a.component_award_ids ?? []).map((id: string) => {
        const c = resolveRenewal(id, all);
        const d = defFor(defs(), c?.def_code ?? '');
        return { code: c?.def_code ?? '', title_en: d?.title_en ?? '', title_ar: d?.title_ar ?? '', slug: c?.public_slug ?? null, status: c ? awardView({ ...c, component_award_ids: [] }, today, []).status : ('none' as const) };
      });
      const data: MicrocredCheck = { found: true, slug, status, credential: a.credential as Record<string, unknown>, key_id: a.key_id, checked_on: today, notice: NOTICE_EN, components };
      return h.done<MicrocredCheck>(A, 'microcred_awards', slug, status, null, null, '', 'Micro-credential found', data, ['audit_events']);
    },

    async saveMicrocredDef(input: DefInput) {
      await b.whenReady();
      type R = { id: string; version: number };
      const A = 'microcred.def_save';
      const caller = me();
      const code = trim(input?.code);
      if (!caller) return h.refuse<R>(A, 'microcred_defs', code || null, 'not_signed_in', MCMSG.not_signed_in);
      const role = ctx().actingRole('frameworks', ['W', 'A']);
      if (!role) return h.refuse<R>(A, 'microcred_defs', code || null, 'forbidden', MCMSG.forbidden_def);
      const all = defs();
      const v = validateDef(input, { defs: all, courses: raw('courses'), forms: raw('assessment_forms'), opportunities: raw('opportunities'), skills: raw('skills'), competencies: raw('competencies'), job_roles: raw('job_roles'), qual_standards: raw('qual_standards'),
        adaptive_banks: raw('adaptive_banks'), performance_tasks: raw('performance_tasks') }); // FS31: adaptive / task criteria
      if (v.code !== 'ok') return h.refuse<R>(A, 'microcred_defs', code || null, v.code, v.message, role);
      const base = input.id ? all.find((d) => d.id === input.id) : undefined;
      if (input.id && (!base || base.code !== code)) return h.refuse<R>(A, 'microcred_defs', code, 'invalid', MCMSG.invalid_def, role);
      if (!input.id && all.some((d) => d.code === code)) return h.refuse<R>(A, 'microcred_defs', code, 'conflict', MCMSG.code_taken, role);
      const fields = {
        kind: input.kind, area: input.area, level: input.level, title_en: trim(input.title_en), title_ar: trim(input.title_ar), summary_en: trim(input.summary_en), summary_ar: trim(input.summary_ar),
        criteria: input.criteria.map((c) => ({ key: c.key, kind: c.kind, ref: c.ref, min_level: c.kind === 'skill' ? Number(c.min_level) : null, label_en: trim(c.label_en), label_ar: trim(c.label_ar) })),
        stacks_into: input.stacks_into || null, alignment: input.alignment.map((a) => ({ skill_id: a.skill_id, level: Number(a.level) })), role_ids: [...input.role_ids],
        validity_months: Number(input.validity_months), hours: input.hours == null ? null : Number(input.hours), change_reason: trim(input.change_reason) || null,
        updated_by: caller, updated_at: nowTs(),
      };
      const draft = all.find((d) => d.code === code && d.status === 'draft');
      if (draft) {
        upd('microcred_defs', draft.id, fields);
        return h.done<R>(A, 'microcred_defs', draft.id, `${code} v${draft.version} draft updated`, role, null, '', MCMSG.saved, { id: draft.id, version: Number(draft.version) }, ['microcred_defs']);
      }
      const version = base ? Math.max(...all.filter((d) => d.code === code).map((d) => Number(d.version))) + 1 : 1;
      const id = `mcd-${code.toLowerCase()}-v${version}`;
      const cur = all.find((d) => d.code === code && d.status === 'current');
      const sort = base ? Number(base.sort) || 0 : Math.max(0, ...all.map((d) => Number(d.sort) || 0)) + 10;
      ins('microcred_defs', { id, code, version, status: 'draft', effective_date: null, supersedes_id: cur?.id ?? base?.id ?? null, sort, published_by: null, published_at: null, ...fields });
      return h.done<R>(A, 'microcred_defs', id, `${code} v${version} draft created`, role, null, '', MCMSG.saved, { id, version }, ['microcred_defs']);
    },

    async setMicrocredDefStatus(defId, status, note) {
      await b.whenReady();
      type R = { id: string; status: string };
      const A = 'microcred.def_status';
      const caller = me();
      if (!caller) return h.refuse<R>(A, 'microcred_defs', defId || null, 'not_signed_in', MCMSG.not_signed_in);
      const role = ctx().actingRole('frameworks', ['W', 'A']);
      if (!role) return h.refuse<R>(A, 'microcred_defs', defId || null, 'forbidden', MCMSG.forbidden_def);
      const d = get('microcred_defs', defId) as DefRow | undefined;
      if (!d) return h.refuse<R>(A, 'microcred_defs', defId || null, 'not_found', MCMSG.not_found_def, role);
      const n = trim(note);
      if (status === 'current') {
        if (d.status !== 'draft') return h.refuse<R>(A, 'microcred_defs', d.id, 'conflict', MCMSG.not_draft, role);
        if (d.kind === 'stack' && componentsOf(defs(), d.code).length < 2) return h.refuse<R>(A, 'microcred_defs', d.id, 'invalid', MCMSG.stack_needs_parts, role);
        for (const o of defs().filter((x) => x.code === d.code && x.status === 'current')) upd('microcred_defs', o.id, { status: 'superseded' });
        upd('microcred_defs', d.id, { status: 'current', effective_date: todayIso(), published_by: caller, published_at: nowTs(), change_reason: n || d.change_reason });
        return h.done<R>(A, 'microcred_defs', d.id, `${d.code} v${d.version} published${n ? `: ${n}` : ''}`, role, 'kafaa.microcred.publish', `Micro-credential ${d.code} v${d.version} published`, MCMSG.published, { id: d.id, status: 'current' }, ['microcred_defs']);
      }
      if (status === 'retired') {
        if (d.status !== 'current') return h.refuse<R>(A, 'microcred_defs', d.id, 'conflict', MCMSG.not_current, role);
        if (n.length < 3 || n.length > 500) return h.refuse<R>(A, 'microcred_defs', d.id, 'invalid', MCMSG.note_required, role);
        upd('microcred_defs', d.id, { status: 'retired', change_reason: n, updated_by: caller, updated_at: nowTs() });
        return h.done<R>(A, 'microcred_defs', d.id, `${d.code} v${d.version} retired: ${n}`, role, 'kafaa.microcred.retire', `Micro-credential ${d.code} retired`, MCMSG.retired, { id: d.id, status: 'retired' }, ['microcred_defs']);
      }
      return h.refuse<R>(A, 'microcred_defs', d.id, 'invalid', MCMSG.invalid_def, role);
    },

    async microcredSweep() {
      await b.whenReady();
      type R = { checked: number; notices: number };
      const A = 'microcred.sweep';
      const caller = me();
      if (!caller) return h.refuse<R>(A, 'microcred_awards', null, 'not_signed_in', MCMSG.not_signed_in);
      const role = ctx().actingRole('skills_profile', ['A']);
      if (!role) return h.refuse<R>(A, 'microcred_awards', null, 'forbidden', MCMSG.forbidden_sweep);
      const today = todayIso();
      const all = awards();
      let checked = 0;
      let notices = 0;
      for (const a of all.filter((x) => x.status === 'awarded').sort((x, y) => cmp(x.id, y.id))) {
        checked++;
        const v = awardView(a, today, all);
        if (v.status === 'expired' && notify(`nt-mc-${a.id}-exp`, a.person_id, `Micro-credential expired: ${a.def_code}`, `انتهت صلاحية الاعتماد المصغّر: ${a.def_code}`, '/my/skills/credentials', 'warn')) notices++;
        if (v.status === 'renewal_due' && v.reason === 'window' && notify(`nt-mc-${a.id}-due`, a.person_id, `Micro-credential due for renewal: ${a.def_code}`, `الاعتماد المصغّر مستحق التجديد: ${a.def_code}`, '/my/skills/credentials', 'info')) notices++;
        if (v.status === 'renewal_due' && v.reason === 'component' && notify(`nt-mc-${a.id}-part`, a.person_id, `Renewal due: a component of ${a.def_code} has lapsed`, `التجديد مستحق: انتهى أحد مكوّنات ${a.def_code}`, '/my/skills/credentials', 'warn')) notices++;
      }
      return h.done<R>(A, 'microcred_awards', null, `${checked} awards checked, ${notices} notices`, role, null, '', 'Renewal sweep complete', { checked, notices }, ['notifications']);
    },

    async microcredStats() {
      await b.whenReady();
      const c = ctx();
      const exact = c.has('skills_profile', ['A', 'R', 'W']);
      if (!me() || (!exact && !c.has('skills_profile', ['Agg']))) return { allowed: false, exact: false, rows: [] };
      const today = todayIso();
      const all = awards();
      const rows: MicrocredStat[] = defs().filter((d) => d.status === 'current').sort((x, y) => (Number(x.sort) || 0) - (Number(y.sort) || 0) || cmp(x.code, y.code)).map((d) => {
        const people = [...new Set(all.filter((a) => a.def_code === d.code).map((a) => a.person_id))];
        let holders = 0;
        let due = 0;
        for (const p of people) {
          const la = latestAward(all, p, d.code);
          const s = la ? awardView(la, today, all).status : null;
          if (s === 'active' || s === 'renewal_due') holders++;
          if (s === 'renewal_due') due++;
        }
        const pending = all.filter((a) => a.def_code === d.code && a.status === 'pending_approval').length;
        const sup = !exact && holders < MIN_GROUP_SIZE;
        return { code: d.code, title_en: d.title_en, title_ar: d.title_ar, kind: d.kind, holders: sup ? null : holders, pending: !exact && pending < MIN_GROUP_SIZE ? null : pending, renewal_due: sup || (!exact && due < MIN_GROUP_SIZE) ? null : due, suppressed: sup };
      });
      return { allowed: true, exact, rows };
    },
  };
}
