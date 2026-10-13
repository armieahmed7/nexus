// M34 LocalBackend RPC implementations (owners: wave D E2 (FS29, FS30) and wave I E1 (FS78, FS79)). Installed on every LocalRpc instance by src/data/ext/local.ts.
// Use b.raw/rawGet/rawInsert/rawUpdate (definer rights), b.access() for scope checks, h.refuse/h.done for audit + ledger.
// Pages never import this file.
//
// FS wave D · E2: 1:1 mirror of kafaa_submit_rpl / kafaa_attest_rpl / kafaa_decide_rpl / kafaa_export_rpl / kafaa_rpl_evidence_options /
// kafaa_tag_credit / kafaa_sync_credits in supabase/migrations/20261010242001_kafaa_fs42_rpl_credits.sql: same checks in the same order,
// the same refusal codes and messages (RPL_MSG, CR_MSG), one audit row per call; a ledger row only when an RPL decision is confirmed.
// Shared writes, as in the SQL functions: F01 skill_evidence (`se:rpl:<request>:<skill>`, kind credential, basis validated,
// ref_table rpl_requests) + applySkills, M14 notifications (kind `recognition`, ids `nt-rpl-...`).
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import { applySkills } from '../../../data/local/rpc.w0';
import {
  OPEN_STATUSES, RPL_MSG, SUBMIT_ACTIONS, buildRplPack, checkAttach, checkAttest, checkDecide, checkOpen, checkSubmit, creditedSkills, evidenceRowId, requestId,
  rplEvidenceId, rplMsgKey, rplOptions, rplResultCode, rplStatement, type OptionWorld, type RplOption,
} from '../rpl';
import { CR_MSG, checkTag, creditsFor, creditsOf, crResultCode, ledgerDiff, ledgerTotal, nqfForLevel, tagId, type CreditWorld } from '../credits';
import type { M34Rpc, RplAttestInput, RplDecideInput, RplSubmitInput } from './rpc';
import { makeLocalFs91 } from './local.fs91'; // FS wave I · E1 (FS78, FS79)

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const str = (v: unknown) => (typeof v === 'string' ? v.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '') : '');
const byId = (a: Row, b: Row) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
export const NQF_SOURCE = 'https://uaelegislation.gov.ae/en/legislations/2615/download';

/** World tables for rplOptions (also used by the seed builder and tests). */
export const optionWorld = (raw: (t: string) => Row[]): OptionWorld => ({
  ojt_logs: raw('ojt_logs'), task_items: raw('task_items'), qual_standards: raw('qual_standards'), crew_debrief_members: raw('crew_debrief_members'),
  sim_scenarios: raw('sim_scenarios'), competencies: raw('competencies'), qual_records: raw('qual_records'), skill_evidence: raw('skill_evidence'),
  opportunity_applications: raw('opportunity_applications'), opportunities: raw('opportunities'), rotation_placements: raw('rotation_placements'),
  contractor_engagements: raw('contractor_engagements'), job_roles: raw('job_roles'), skills: raw('skills'),
});
export const creditWorld = (raw: (t: string) => Row[]): CreditWorld => ({
  training_records: raw('training_records') as never, pathway_enrolments: raw('pathway_enrolments') as never, microcred_awards: raw('microcred_awards') as never,
  rpl_requests: raw('rpl_requests') as never, credit_tags: raw('credit_tags') as never, credit_stacks: raw('credit_stacks') as never,
});
/** People with anything that can earn credit, or a ledger row (the "everyone" of a full sync). */
export function creditPeople(raw: (t: string) => Row[]): string[] {
  const s = new Set<string>();
  for (const r of raw('training_records')) s.add(r.person_id);
  for (const r of raw('pathway_enrolments')) if (r.status === 'completed') s.add(r.person_id);
  for (const r of raw('microcred_awards')) if (r.status === 'awarded') s.add(r.person_id);
  for (const r of raw('rpl_requests')) if (r.status === 'decided') s.add(r.person_id);
  for (const r of raw('credit_ledger')) s.add(r.person_id);
  return [...s].sort();
}
/** Alignment of a micro-credential definition as {skill_id, level}[]. */
export const alignmentOf = (def: Row | undefined | null): { skill_id: string; level: number }[] =>
  (Array.isArray(def?.alignment) ? def!.alignment : []).filter((a: Row) => a && typeof a.skill_id === 'string').map((a: Row) => ({ skill_id: String(a.skill_id), level: Number(a.level) || 1 }));

export function makeLocalM34(b: LocalBackend, h: LocalRpcHelpers): M34Rpc {
  const raw = (t: string) => ((b.raw(t as never) as unknown as Row[]) ?? []);
  const get = (t: string, id: string | null | undefined) => (id ? (b.rawGet(t as never, id) as unknown as Row | undefined) : undefined);
  const ins = (t: string, row: Row) => b.rawInsert(t as never, row as never);
  const upd = (t: string, id: string, patch: Row) => b.rawUpdate(t as never, id, patch as never);
  const me = () => b.identity().personId;
  const ctx = () => b.access();
  const notify = (id: string, pid: string | null | undefined, en: string, ar: string, link: string, severity = 'info') => {
    if (!pid || !get('people', pid) || get('notifications', id)) return;
    ins('notifications', { id, person_id: pid, kind: 'recognition', title_en: en, title_ar: ar, link, severity, created_at: nowTs() });
  };
  const activeRole = (role: string) => [...new Set(raw('role_assignments').filter((a) => a.role === role && a.status === 'active' && (!a.expires_at || a.expires_at >= todayIso())).map((a) => String(a.person_id)))].sort();
  const evidenceOf = (req: string) => raw('rpl_evidence').filter((e) => e.request_id === req).sort(byId);

  /** Rebuild one person's ledger (creditsFor); returns upserted / reversed counts. Mirror of kafaa_cr_sync. */
  const syncPerson = (pid: string) => {
    const want = creditsFor(pid, creditWorld(raw));
    const stored = raw('credit_ledger').filter((r) => r.person_id === pid) as never;
    const { upsert, reverse } = ledgerDiff(stored, want);
    const ts = nowTs();
    for (const r of upsert) {
      if (get('credit_ledger', r.id)) upd('credit_ledger', r.id, { ...r, status: 'counted', updated_at: ts });
      else ins('credit_ledger', { ...r, status: 'counted', updated_at: ts });
    }
    for (const id of reverse) upd('credit_ledger', id, { status: 'reversed', updated_at: ts });
    return { upserted: upsert.length, reversed: reverse.length };
  };
  const nqfOfTarget = (row: Row, level: number | null) => {
    if (row.target_kind === 'skill') return nqfForLevel(level);
    const tag = get('credit_tags', tagId('microcred', row.microcred_def_id));
    if (tag && tag.status === 'published') return Number(tag.nqf_level);
    const al = alignmentOf(get('microcred_defs', row.microcred_def_id));
    return nqfForLevel(al.reduce((m, a) => Math.max(m, a.level), 0) || null);
  };

  return {
    ...makeLocalFs91(b, h), // FS wave I · E1: requestStudyTime, decideStudyTime, learningBalance, submitExternalCert, verifyExternalCert
    async submitRpl(input: RplSubmitInput) {
      await b.whenReady();
      type R = { id: string; status: string; evidence_id?: string | null };
      const action = str(input?.action);
      const A = `rpl.${(SUBMIT_ACTIONS as readonly string[]).includes(action) ? action : 'invalid'}`;
      const entity = action === 'open' ? (str(input?.person_id) || me()) : (str(input?.id) || null);
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>(A, 'rpl_requests', entity, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', RPL_MSG.not_signed_in);
      if (!(SUBMIT_ACTIONS as readonly string[]).includes(action)) return refuse('invalid', RPL_MSG.action);
      const today = todayIso();
      if (action === 'open') {
        const pid = str(input.person_id) || who;
        const behalf = pid !== who;
        const role = behalf ? ctx().actingRole('recognition', ['A']) : ctx().actingRole('recognition', ['Own']);
        const person = get('people', pid);
        const tk = str(input.target_kind);
        const sk = tk === 'skill' ? get('skills', str(input.skill_id)) : undefined;
        const def = tk === 'credential' ? get('microcred_defs', str(input.microcred_def_id)) : undefined;
        const skills = new Map(raw('skills').map((k) => [k.id as string, k]));
        const al = alignmentOf(def);
        const range = sk ? raw('skill_level_ranges').find((r) => r.skill_id === sk.id) : undefined;
        const level = Number(input.level);
        const held = tk === 'skill'
          ? raw('person_skills').some((p) => p.person_id === pid && p.skill_id === sk?.id && p.active !== false && Number(p.level) >= level && (p.basis === 'verified' || p.basis === 'evidenced'))
          : raw('microcred_awards').some((a) => a.person_id === pid && a.def_id === def?.id && a.status === 'awarded');
        const open = raw('rpl_requests').some((r) => r.person_id === pid && OPEN_STATUSES.includes(r.status) && r.target_kind === tk && (tk === 'skill' ? r.skill_id === sk?.id : r.microcred_def_id === def?.id));
        const c = checkOpen(input, {
          me: who, assessor: ctx().has('recognition', ['A']), own: ctx().has('recognition', ['Own']),
          person: person ? { id: person.id, kind: person.kind, status: person.status } : null,
          skill: sk ? { id: sk.id, area: sk.area, fs_area: sk.fs_area ?? null, lifecycle: sk.lifecycle } : null,
          range: range ? { min_level: Number(range.min_level), max_level: Number(range.max_level) } : null,
          def: def ? { id: def.id, status: def.status, restricted: def.area === 'security' || al.some((a) => skills.get(a.skill_id)?.area === 'security' || skills.get(a.skill_id)?.fs_area === 'cyber_hygiene') } : null,
          held, open,
        });
        if (c !== 'ok') return refuse(rplResultCode(c), RPL_MSG[rplMsgKey(c)], role);
        const id = requestId(pid, raw('rpl_requests').filter((r) => r.person_id === pid).length + 1);
        const title = tk === 'skill' ? { en: String(sk!.name_en), ar: String(sk!.name_ar) } : { en: String(def!.title_en), ar: String(def!.title_ar) };
        ins('rpl_requests', {
          id, person_id: pid, person_name: person!.display_name ?? '', person_name_ar: person!.display_name_ar || person!.display_name || '', person_kind: person!.kind, org_id: person!.org_id ?? null,
          target_kind: tk, skill_id: tk === 'skill' ? sk!.id : null, microcred_def_id: tk === 'credential' ? def!.id : null, level: tk === 'skill' ? level : null,
          target_title_en: title.en, target_title_ar: title.ar, target_skill_ids: tk === 'skill' ? [sk!.id] : [...new Set(al.map((a) => a.skill_id))].sort(),
          narrative_en: str(input.narrative_en), narrative_ar: str(input.narrative_ar), status: 'draft', opened_by: who, opened_role: role, submitted_on: null,
          outcome: null, credited_level: null, hours: 0, nqf_level: null, rationale_en: null, rationale_ar: null, recommended_by: null, recommended_role: null, recommended_on: null,
          return_note: null, return_count: 0, decided_by: null, decided_role: null, decided_on: null, rpl_statement_en: null, rpl_statement_ar: null, evidence_ids: [],
          export_count: 0, exported_at: null, withdrawn_on: null, created_at: nowTs(), updated_at: nowTs(),
        });
        return h.done<R>(A, 'rpl_requests', id, `opened ${tk === 'skill' ? `${sk!.id} L${level}` : def!.id}${behalf ? ` for ${pid}` : ''}`, role, null, '', 'RPL request opened', { id, status: 'draft' }, ['rpl_requests']);
      }
      const id = str(input.id);
      const row = get('rpl_requests', id);
      if (!row) return refuse('not_found', RPL_MSG.not_found);
      if (row.opened_by !== who) return refuse('forbidden', RPL_MSG.owner);
      const role = row.opened_role ?? null;
      if (action === 'withdraw') {
        if (!OPEN_STATUSES.includes(row.status)) return refuse('invalid', RPL_MSG.state, role);
        upd('rpl_requests', id, { status: 'withdrawn', withdrawn_on: today, updated_at: nowTs() });
        return h.done<R>(A, 'rpl_requests', id, 'withdrawn', role, null, '', 'RPL request withdrawn', { id, status: 'withdrawn' }, ['rpl_requests']);
      }
      if (row.status !== 'draft') return refuse('invalid', RPL_MSG.state, role);
      const ev = evidenceOf(id);
      if (action === 'detach') {
        const e = get('rpl_evidence', str(input.evidence_id));
        if (!e || e.request_id !== id || !e.active) return refuse('not_found', RPL_MSG.not_found, role);
        upd('rpl_evidence', e.id, { active: false, updated_at: nowTs() });
        return h.done<R>(A, 'rpl_evidence', e.id, `detached ${e.kind}`, role, null, '', 'Evidence removed from the pack', { id, status: 'draft', evidence_id: e.id }, ['rpl_evidence']);
      }
      if (action === 'submit') {
        const c = checkSubmit(ev as never);
        if (c !== 'ok') return refuse('invalid', RPL_MSG[c], role);
        upd('rpl_requests', id, { status: 'submitted', submitted_on: today, updated_at: nowTs() });
        for (const p of activeRole('training_manager')) if (p !== who && p !== row.person_id) notify(`nt-rpl-${id}-submitted-${p}`, p, `RPL request to assess: ${row.target_title_en}`, `طلب اعتراف بالتعلم السابق للتقييم: ${row.target_title_ar}`, `/recognition/review/${id}`);
        return h.done<R>(A, 'rpl_requests', id, `submitted with ${ev.filter((e) => e.active).length} items`, role, null, '', 'RPL request submitted for assessment', { id, status: 'submitted' }, ['rpl_requests', 'notifications']);
      }
      // attach
      const kind = str(input.kind);
      const active = ev.filter((e) => e.active);
      const attester = kind === 'attestation' ? get('people', str(input.attester_id)) : undefined;
      const option: RplOption | null = kind && kind !== 'attestation'
        ? rplOptions(row.person_id, optionWorld(raw)).find((o) => o.ref_table === str(input.ref_table) && o.ref_id === str(input.ref_id)) ?? null : null;
      const duplicate = kind === 'attestation'
        ? active.some((e) => e.kind === 'attestation' && e.attester_id === str(input.attester_id) && e.attestation_status !== 'declined')
        : active.some((e) => e.ref_table === str(input.ref_table) && e.ref_id === str(input.ref_id));
      const c = checkAttach(input, { count: active.length, option, duplicate, attester: attester ? { id: attester.id, kind: attester.kind, status: attester.status } : null, person: row.person_id, opener: row.opened_by });
      if (c !== 'ok') return refuse(rplResultCode(c), RPL_MSG[c], role);
      const eid = evidenceRowId(id, ev.length + 1);
      const base = { id: eid, request_id: id, person_id: row.person_id, target_title_en: row.target_title_en, target_title_ar: row.target_title_ar, requester_name: row.person_name, requester_name_ar: row.person_name_ar, active: true, added_by: who, created_at: nowTs(), updated_at: nowTs() };
      if (kind === 'attestation') {
        const jr = attester!.job_role_id ? get('job_roles', attester!.job_role_id) : undefined;
        ins('rpl_evidence', {
          ...base, kind, ref_table: null, ref_id: null, title_en: 'Supervisor attestation', title_ar: 'إفادة المشرف', detail_en: jr ? String(jr.title_en) : '', detail_ar: jr ? String(jr.title_ar) : '',
          observed_on: null, mirror: false, mirror_status: null, skill_ids: [...(row.target_skill_ids ?? [])], attester_id: attester!.id,
          attester_role_en: jr ? String(jr.title_en) : 'Supervisor', attester_role_ar: jr ? String(jr.title_ar) : 'المشرف', request_note: str(input.note),
          attestation_status: 'requested', attestation_en: null, attestation_ar: null, attested_on: null,
        });
        notify(`nt-rpl-${eid}-attest`, attester!.id, `Attestation requested for an RPL pack: ${row.target_title_en}`, `طُلبت إفادتك لحزمة اعتراف بالتعلم السابق: ${row.target_title_ar}`, '/my/recognition?tab=attest');
        return h.done<R>(A, 'rpl_evidence', eid, `attestation requested from ${attester!.id}`, role, null, '', 'Attestation requested', { id, status: 'draft', evidence_id: eid }, ['rpl_evidence', 'notifications']);
      }
      ins('rpl_evidence', {
        ...base, kind, ref_table: option!.ref_table, ref_id: option!.ref_id, title_en: option!.title_en, title_ar: option!.title_ar, detail_en: option!.detail_en, detail_ar: option!.detail_ar,
        observed_on: option!.observed_on, mirror: option!.mirror, mirror_status: option!.mirror_status, skill_ids: option!.skill_ids, attester_id: null, attester_role_en: null, attester_role_ar: null,
        request_note: null, attestation_status: null, attestation_en: null, attestation_ar: null, attested_on: null,
      });
      return h.done<R>(A, 'rpl_evidence', eid, `attached ${option!.ref_table}:${option!.ref_id}`, role, null, '', 'Evidence attached', { id, status: 'draft', evidence_id: eid }, ['rpl_evidence']);
    },

    async attestRpl(input: RplAttestInput) {
      await b.whenReady();
      type R = { id: string; status: string };
      const eid = str(input?.evidence_id);
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('rpl.attest', 'rpl_evidence', eid || null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', RPL_MSG.not_signed_in);
      const row = get('rpl_evidence', eid);
      const req = row ? get('rpl_requests', row.request_id) : undefined;
      const role = ctx().actingRole('own_profile', ['Own']);
      const c = checkAttest(input ?? {}, row ? { kind: row.kind, attester_id: row.attester_id, attestation_status: row.attestation_status, active: row.active } : null, req?.status ?? null, who);
      if (c !== 'ok') return refuse(rplResultCode(c), RPL_MSG[c], role);
      const confirm = input.confirm === true;
      const status = confirm ? 'confirmed' : 'declined';
      upd('rpl_evidence', eid, { attestation_status: status, attestation_en: str(input.text_en), attestation_ar: confirm ? (str(input.text_ar) || null) : null, attested_on: todayIso(), updated_at: nowTs() });
      notify(`nt-rpl-${eid}-${status}`, req!.opened_by, confirm ? `Attestation confirmed: ${req!.target_title_en}` : `Attestation declined: ${req!.target_title_en}`,
        confirm ? `تأكدت الإفادة: ${req!.target_title_ar}` : `اعتذر المشرف عن الإفادة: ${req!.target_title_ar}`, `/my/recognition/rpl/${req!.id}`, confirm ? 'ok' : 'warn');
      return h.done<R>('rpl.attest', 'rpl_evidence', eid, status, role, null, '', confirm ? 'Attestation confirmed' : 'Attestation declined', { id: eid, status }, ['rpl_evidence', 'notifications']);
    },

    async decideRpl(input: RplDecideInput) {
      await b.whenReady();
      type R = { id: string; status: string; outcome?: string | null; evidence_ids?: string[]; credits?: number };
      const action = str(input?.action);
      const A = `rpl.${['recommend', 'confirm', 'return'].includes(action) ? action : 'invalid'}`;
      const id = str(input?.id);
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>(A, 'rpl_requests', id || null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', RPL_MSG.not_signed_in);
      if (!ctx().has('recognition', ['A'])) return refuse('forbidden', RPL_MSG.forbidden_assessor);
      const role = ctx().actingRole('recognition', ['A']);
      const row = get('rpl_requests', id);
      if (!row) return refuse('not_found', RPL_MSG.not_found, role);
      const def = row.target_kind === 'credential' ? get('microcred_defs', row.microcred_def_id) : undefined;
      const al = alignmentOf(def);
      const c = checkDecide(input ?? {}, { status: row.status, person_id: row.person_id, opened_by: row.opened_by, recommended_by: row.recommended_by, target_kind: row.target_kind, level: row.level }, who, al.reduce((m, a) => Math.max(m, a.level), 0));
      if (c !== 'ok') return refuse(rplResultCode(c), RPL_MSG[rplMsgKey(c, true)], role);
      const today = todayIso();
      if (action === 'recommend') {
        const outcome = str(input.outcome);
        const cl = row.target_kind === 'skill' && outcome !== 'not_yet' ? Number(input.credited_level) : null;
        const nqf = outcome === 'not_yet' ? null : nqfOfTarget(row, cl);
        upd('rpl_requests', id, {
          status: 'recommended', outcome, credited_level: cl, hours: Number(input.hours), nqf_level: nqf, rationale_en: str(input.rationale_en), rationale_ar: str(input.rationale_ar),
          recommended_by: who, recommended_role: role, recommended_on: today, updated_at: nowTs(),
        });
        for (const p of activeRole('training_manager')) if (p !== who && p !== row.person_id) notify(`nt-rpl-${id}-recommended-${row.return_count ?? 0}-${p}`, p, `RPL recommendation awaiting a second assessor: ${row.target_title_en}`, `توصية اعتراف بالتعلم السابق بانتظار مقيّم ثانٍ: ${row.target_title_ar}`, `/recognition/review/${id}`);
        return h.done<R>(A, 'rpl_requests', id, `recommended ${outcome}${cl ? ` L${cl}` : ''} ${Number(input.hours)}h`, role, null, '', 'Recommendation recorded: a second assessor confirms it', { id, status: 'recommended', outcome }, ['rpl_requests', 'notifications']);
      }
      if (action === 'return') {
        upd('rpl_requests', id, {
          status: 'submitted', return_note: str(input.note), return_count: Number(row.return_count ?? 0) + 1, outcome: null, credited_level: null, hours: 0, nqf_level: null,
          rationale_en: null, rationale_ar: null, recommended_by: null, recommended_role: null, recommended_on: null, updated_at: nowTs(),
        });
        notify(`nt-rpl-${id}-returned-${Number(row.return_count ?? 0) + 1}`, row.recommended_by, `RPL recommendation returned: ${row.target_title_en}`, `أُعيدت توصية الاعتراف بالتعلم السابق: ${row.target_title_ar}`, `/recognition/review/${id}`, 'warn');
        return h.done<R>(A, 'rpl_requests', id, 'returned to the recommender', role, null, '', 'Recommendation returned for another look', { id, status: 'submitted' }, ['rpl_requests', 'notifications']);
      }
      // confirm (checker)
      const ev = evidenceOf(id);
      const st = rplStatement({ id, outcome: row.outcome, credited_level: row.credited_level, hours: Number(row.hours), nqf_level: row.nqf_level, target_title_en: row.target_title_en, target_title_ar: row.target_title_ar, decided_on: today }, ev as never);
      const credited = creditedSkills(row as never, al);
      const evIds: string[] = [];
      for (const k of credited) {
        const eid = rplEvidenceId(id, k.skill_id);
        const patch = { level: k.level, basis: 'validated', status: 'current', observed_on: today, note: `RPL ${row.outcome}`, recorded_by: who, active: true };
        if (get('skill_evidence', eid)) upd('skill_evidence', eid, patch);
        else ins('skill_evidence', { id: eid, person_id: row.person_id, skill_id: k.skill_id, kind: 'credential', ref_table: 'rpl_requests', ref_id: id, ...patch, created_at: nowTs() });
        evIds.push(eid);
      }
      upd('rpl_requests', id, { status: 'decided', decided_by: who, decided_role: role, decided_on: today, rpl_statement_en: st.en, rpl_statement_ar: st.ar, evidence_ids: evIds, updated_at: nowTs() });
      if (evIds.length) await applySkills(b, row.person_id, today);
      syncPerson(row.person_id);
      const outEn = row.outcome === 'full' ? 'full credit' : row.outcome === 'partial' ? 'partial credit' : 'not yet';
      const outAr = row.outcome === 'full' ? 'اعتراف كامل' : row.outcome === 'partial' ? 'اعتراف جزئي' : 'ليس بعد';
      for (const p of [...new Set([row.person_id, row.opened_by])]) notify(`nt-rpl-${id}-decided-${p}`, p, `RPL decision: ${outEn} (${row.target_title_en})`, `قرار الاعتراف بالتعلم السابق: ${outAr} (${row.target_title_ar})`, `/my/recognition/rpl/${id}`, row.outcome === 'not_yet' ? 'info' : 'ok');
      return h.done<R>(A, 'rpl_requests', id, `decided ${row.outcome}`, role, 'kafaa.rpl.decide',
        `RPL ${row.outcome} for ${row.person_id} on ${row.target_kind === 'skill' ? row.skill_id : row.microcred_def_id}; recommended by ${row.recommended_by}, confirmed by ${who} (two assessors); internal recognition, not a regulatory decision`,
        'RPL decision confirmed', { id, status: 'decided', outcome: row.outcome, evidence_ids: evIds, credits: creditsOf(Number(row.hours)) },
        ['rpl_requests', 'skill_evidence', 'person_skills', 'credit_ledger', 'notifications']);
    },

    async exportRpl(id: string) {
      await b.whenReady();
      type R = Record<string, unknown>;
      const rid = str(id);
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('rpl.export', 'rpl_requests', rid || null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', RPL_MSG.not_signed_in);
      const row = get('rpl_requests', rid);
      if (!row) return refuse('not_found', RPL_MSG.not_found);
      const own = row.person_id === who;
      if (!own && !ctx().has('recognition', ['R', 'W', 'A'])) return refuse('forbidden', RPL_MSG.forbidden_export);
      const role = own ? ctx().actingRole('own_profile', ['Own']) : ctx().actingRole('recognition', ['R', 'W', 'A']);
      if (row.status !== 'decided') return refuse('invalid', RPL_MSG.state, role);
      const p = get('people', row.person_id);
      const pack = buildRplPack(row, evidenceOf(rid), { initials: String(p?.initials ?? ''), kind: row.person_kind, job_role_id: p?.job_role_id ?? null });
      upd('rpl_requests', rid, { export_count: Number(row.export_count ?? 0) + 1, exported_at: nowTs() });
      return h.done<R>('rpl.export', 'rpl_requests', rid, 'NQC-ready pack exported', role, null, '', 'RPL pack ready', pack, ['rpl_requests']);
    },

    async rplEvidenceOptions(personId?: string | null) {
      await b.whenReady();
      const who = me();
      if (!who) return [];
      const pid = str(personId) || who;
      if (pid !== who && !ctx().has('recognition', ['R', 'W', 'A'])) return [];
      return rplOptions(pid, optionWorld(raw));
    },

    async tagCredit(input) {
      await b.whenReady();
      type R = { id: string; status: string; credits: number; synced: number };
      const kind = str(input?.item_kind);
      const item = str(input?.item_id);
      const id = tagId(kind, item);
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('credit.tag', 'credit_tags', item ? id : null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', CR_MSG.not_signed_in);
      if (!ctx().has('frameworks', ['W', 'A'])) return refuse('forbidden', CR_MSG.forbidden);
      const role = ctx().actingRole('frameworks', ['W', 'A']);
      const src = kind === 'course' ? get('courses', item) : kind === 'pathway' ? get('pathways', item) : kind === 'microcred' ? get('microcred_defs', item) : undefined;
      const live = !!src && (kind === 'course' || (kind === 'pathway' && src.status === 'published') || (kind === 'microcred' && src.status === 'current'));
      const cur = get('credit_tags', id);
      const c = checkTag(input ?? {}, { item: src ? { id: src.id, live } : null, stacks: raw('credit_stacks').map((x) => x.id), existing: cur ? { id: cur.id, status: cur.status } : null });
      if (c !== 'ok') return refuse(crResultCode(c), CR_MSG[c], role);
      const retire = input.retire === true;
      const version = cur ? Number(cur.version ?? 1) + 1 : 1;
      if (retire) upd('credit_tags', id, { status: 'retired', listed: false, version, updated_by: who, updated_at: nowTs() });
      else {
        const hours = Number(input.notional_hours);
        const patch = {
          title_en: String(src!.title_en), title_ar: String(src!.title_ar), nqf_level: Number(input.nqf_level), notional_hours: hours, credits: creditsOf(hours), indicative: true,
          basis_en: str(input.basis_en), basis_ar: str(input.basis_ar), stack_ids: [...((input.stack_ids as string[] | undefined) ?? [])].sort(), status: 'published', listed: true,
          source_url: cur?.source_url ?? NQF_SOURCE, as_of: todayIso(), version, updated_by: who, updated_at: nowTs(),
        };
        if (cur) upd('credit_tags', id, patch);
        else ins('credit_tags', { id, item_kind: kind, item_id: item, ...patch });
      }
      const holders = new Set<string>();
      if (kind === 'course') for (const r of raw('training_records')) { if (r.course_id === item) holders.add(r.person_id); }
      if (kind === 'pathway') for (const r of raw('pathway_enrolments')) { if (r.pathway_id === item && r.status === 'completed') holders.add(r.person_id); }
      if (kind === 'microcred') for (const r of raw('microcred_awards')) { if (r.def_id === item && r.status === 'awarded') holders.add(r.person_id); }
      for (const r of raw('credit_ledger')) if (r.tag_id === id) holders.add(r.person_id);
      for (const p of [...holders].sort()) syncPerson(p);
      const row = get('credit_tags', id)!;
      return h.done<R>('credit.tag', 'credit_tags', id, `${retire ? 'retired' : `NQF ${row.nqf_level} ${row.notional_hours}h`} v${version}`, role, null, '', retire ? 'Tag retired' : 'Tag saved (indicative)',
        { id, status: row.status, credits: Number(row.credits), synced: holders.size } as R, ['credit_tags', 'credit_ledger']);
    },

    async syncCredits(personId?: string | null) {
      await b.whenReady();
      type R = { people: number; upserted: number; reversed: number; total: number };
      const pid = str(personId) || null;
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>('credit.sync', 'credit_ledger', pid, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', CR_MSG.not_signed_in);
      const wide = ctx().has('recognition', ['A']) || ctx().has('frameworks', ['W', 'A']);
      if (pid && pid !== who && !wide) return refuse('forbidden', CR_MSG.forbidden_sync);
      const role = pid && pid !== who || (!pid && wide) ? (ctx().actingRole('recognition', ['A']) ?? ctx().actingRole('frameworks', ['W', 'A'])) : ctx().actingRole('own_profile', ['Own']);
      const people = pid ? [pid] : wide ? creditPeople(raw) : [who];
      let up = 0;
      let rev = 0;
      for (const p of people) { const r = syncPerson(p); up += r.upserted; rev += r.reversed; }
      const set = new Set(people);
      const total = ledgerTotal(raw('credit_ledger').filter((r) => set.has(r.person_id)) as never);
      return h.done<R>('credit.sync', 'credit_ledger', pid ?? (wide ? 'all' : who), `${people.length} people, ${up} upserted, ${rev} reversed`, role, null, '', 'Credit ledger refreshed',
        { people: people.length, upserted: up, reversed: rev, total }, ['credit_ledger']);
    },
  };
}
