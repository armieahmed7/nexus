// M10 extension LocalBackend RPCs (owner: FS wave G · E4, FS66 University programme alignment + FS67 Fellowships). Installed on every
// LocalRpc by src/data/ext/local.ts (one-line hook, FS66). 1:1 mirror of supabase/migrations/20261010274001_kafaa_fs74_university_alignment.sql:
// the same checks in the same order, the same refusal codes and messages (UA_MSG, FW_MSG), the same audit and ledger rows. Pages never
// import this file. Shared writes, as in the SQL functions: F01 skill_evidence (`se:programme:<graduate>:<skill>`, kind credential,
// basis validated, ref_table programme_alignments) + applySkills, M14 notifications (kind `university`, ids `nt-ua-...` / `nt-fw-...`).
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { Result, Table } from '../../../data/types';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import { applySkills } from '../../../data/local/rpc.w0';
import {
  UA_MSG, addYears, autoCriteria, cleanSkills, decisionProblem, defaultCoversFrom, gradStatus, graduateEvidence, graduateId, hireProblem, programmeCoverage,
  programmeId, programmeProblem, type ProgrammeCoverage, type UaWorld,
} from '../alignment';
import { FW_MSG, fellowshipId, fellowshipProblem, fellowshipStats, isComplete, milestonePlan, milestoneProblem, type FwKind, type FwStats } from '../fellowship';
import type { M10Rpc } from './rpc';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const str = (v: unknown) => (typeof v === 'string' ? v.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '') : '');
const byId = (a: Row, b: Row) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const okR = <T>(message: string, data: T): Result<T> => ({ ok: true, code: 'ok', message, audit_seq: null, ledger_seq: null, data }) as Result<T>;

/** World for the FS66 rules from the LocalBackend tables (also used by tests). */
export function uaWorld(b: LocalBackend): UaWorld {
  const raw = (t: string) => b.raw(t as Table) as unknown as Row[];
  return { skills: raw('skills'), competencies: raw('competencies'), job_roles: raw('job_roles'), role_profile_versions: raw('role_profile_versions'), skill_alignments: raw('skill_alignments'), organisations: raw('organisations') };
}

export function makeLocalM10(b: LocalBackend, h: LocalRpcHelpers): M10Rpc {
  const me = () => b.identity().personId;
  const myOrg = () => b.identity().orgId;
  const ctx = () => b.access();
  const raw = (t: string) => b.raw(t as Table) as unknown as Row[];
  const get = (t: string, id: unknown) => (typeof id === 'string' && id ? (b.rawGet(t as Table, id) as unknown as Row | undefined) : undefined);
  const ins = (t: string, row: Row) => b.rawInsert(t as Table, row as never);
  const upd = (t: string, id: string, patch: Row) => b.rawUpdate(t as Table, id, patch as never);
  const notify = (id: string, person: string | null | undefined, title_en: string, title_ar: string, link: string, severity = 'info') => {
    if (!person || get('notifications', id)) return;
    ins('notifications', { id, person_id: person, kind: 'university', title_en, title_ar, body_en: null, body_ar: null, link, severity, created_at: nowTs(), read_at: null });
  };
  /** Write the validated evidence of one covered graduate (upsert) and return the evidence ids. */
  const writeEvidence = (grad: Row, prog: Row, who: string): string[] => {
    const rows = graduateEvidence({ id: grad.id, person_id: grad.person_id, graduated_on: String(grad.graduated_on).slice(0, 10) }, prog, uaWorld(b));
    for (const e of rows) {
      const patch = { level: e.level, basis: e.basis, status: e.status, observed_on: e.observed_on, note: e.note, recorded_by: who, active: true };
      if (get('skill_evidence', e.id)) upd('skill_evidence', e.id, patch);
      else ins('skill_evidence', { ...e, recorded_by: who, active: true, created_at: nowTs() });
    }
    return rows.map((e) => e.id);
  };

  return {
    async saveProgramme(input) {
      await b.whenReady();
      type R = { id: string; status: string; version: number; coverage: ProgrammeCoverage };
      const p = (input ?? {}) as Row;
      const who = me();
      const given = typeof p.id === 'string' && p.id ? p.id : null;
      if (!who) return h.refuse<R>('programme.save', 'programme_alignments', given, 'not_signed_in', UA_MSG.not_signed_in);
      const cur = given ? get('programme_alignments', given) : undefined;
      if (given && !cur) return h.refuse<R>('programme.save', 'programme_alignments', given, 'not_found', UA_MSG.not_found);
      const org = cur ? String(cur.university_org_id) : typeof p.university_org_id === 'string' ? p.university_org_id : null;
      const role = ctx().actingRole('partner_org', ['A']) ?? (org && myOrg() === org && ctx().has('ecosystem', ['OrgW']) ? ctx().actingRole('ecosystem', ['OrgW']) : null);
      if (!role) return h.refuse<R>('programme.save', 'programme_alignments', given, 'forbidden', UA_MSG.forbidden_save);
      if (cur && cur.status === 'submitted') return h.refuse<R>('programme.save', 'programme_alignments', given, 'invalid', UA_MSG.locked, role);
      const w = uaWorld(b);
      const code = programmeProblem({ ...p, university_org_id: org }, w);
      if (code) return h.refuse<R>('programme.save', 'programme_alignments', given, 'invalid', UA_MSG[code], role);
      const id = cur ? String(cur.id) : programmeId(org!, String(p.code));
      if (!cur && get('programme_alignments', id)) return h.refuse<R>('programme.save', 'programme_alignments', id, 'duplicate', UA_MSG.exists, role);
      const submit = p.submit === true;
      const version = cur ? Number(cur.version) + (cur.status === 'endorsed' ? 1 : 0) : 1;
      const status = submit ? 'submitted' : 'draft';
      const at = nowTs();
      const skills = cleanSkills(p.skills);
      const fields: Row = {
        code: str(p.code), title_en: str(p.title_en), title_ar: str(p.title_ar), degree: p.degree, nqf_level: p.nqf_level ?? null, field_en: str(p.field_en), field_ar: str(p.field_ar),
        summary_en: str(p.summary_en), summary_ar: str(p.summary_ar), target_role_ids: [...(p.target_role_ids as string[])], skills, placement: p.placement === true,
        accreditation_ref: str(p.accreditation_ref), status, version, updated_at: at,
        submitted_by: submit ? who : cur?.submitted_by ?? null, submitted_at: submit ? at : cur?.submitted_at ?? null,
        history: [...((cur?.history as Row[]) ?? []), { at, by: who, action: submit ? 'submitted' : 'saved', version }],
      };
      if (cur && cur.status === 'endorsed') Object.assign(fields, { decided_by: null, decided_at: null, decision_note: null, criteria: {}, covers_from: null, valid_to: null, coverage_snapshot: null });
      if (cur) upd('programme_alignments', id, fields);
      else ins('programme_alignments', { id, university_org_id: org, ...fields, decided_by: null, decided_at: null, decision_note: null, criteria: {}, covers_from: null, valid_to: null, coverage_snapshot: null, sample: false, created_by: who });
      const coverage = programmeCoverage({ skills, target_role_ids: fields.target_role_ids }, w);
      return h.done<R>('programme.save', 'programme_alignments', id, `${status} v${version}`, role, null, '', submit ? 'Programme submitted for endorsement review' : 'Programme saved as a draft',
        { id, status, version, coverage }, ['programme_alignments']);
    },

    async endorseProgramme(id, input) {
      await b.whenReady();
      type R = { id: string; status: string; evidence: number; graduates: number };
      const who = me();
      if (!who) return h.refuse<R>('programme.decide', 'programme_alignments', id ?? null, 'not_signed_in', UA_MSG.not_signed_in);
      const role = ctx().actingRole('frameworks', ['A']);
      if (!role) return h.refuse<R>('programme.decide', 'programme_alignments', id ?? null, 'forbidden', UA_MSG.forbidden_endorse);
      const row = get('programme_alignments', id);
      const w = uaWorld(b);
      const today = todayIso();
      const d = (input ?? {}) as Row;
      const auto = row ? autoCriteria(row, w) : null;
      const code = decisionProblem(d, row, who, auto, today);
      if (code === 'not_found') return h.refuse<R>('programme.decide', 'programme_alignments', id ?? null, 'not_found', UA_MSG.not_found, role);
      if (code === 'maker_checker') return h.refuse<R>('programme.decide', 'programme_alignments', id, 'maker_checker', UA_MSG.maker_checker, role);
      if (code) return h.refuse<R>('programme.decide', 'programme_alignments', id, 'invalid', UA_MSG[code], role);
      const at = nowTs();
      const note = str(d.note);
      const prog = row!;
      if (d.decision === 'return') {
        upd('programme_alignments', id, { status: 'returned', decided_by: who, decided_at: at, decision_note: note, updated_at: at, history: [...((prog.history as Row[]) ?? []), { at, by: who, action: 'returned', version: prog.version }] });
        notify(`nt-ua-${id}-v${prog.version}-returned`, prog.submitted_by, `Programme returned for changes: ${prog.title_en}`, `أُعيد البرنامج لإجراء تعديلات: ${prog.title_ar}`, `/universities/programmes/${id}`, 'warn');
        return h.done<R>('programme.decide', 'programme_alignments', id, 'returned', role, 'kafaa.programme.return', `Programme ${prog.code} (${prog.university_org_id}) returned to the university: ${note}`,
          'Programme returned to the university', { id, status: 'returned', evidence: 0, graduates: 0 }, ['programme_alignments', 'notifications']);
      }
      const coversFrom = typeof d.covers_from === 'string' ? d.covers_from : defaultCoversFrom(today);
      const validTo = addYears(today, 3);
      const snapshot = programmeCoverage(prog, w);
      upd('programme_alignments', id, {
        status: 'endorsed', decided_by: who, decided_at: at, decision_note: note, criteria: { outcomes: true, coverage: true, crosswalk: true, assessment: true, placement: true, accreditation: true },
        covers_from: coversFrom, valid_to: validTo, coverage_snapshot: snapshot, updated_at: at,
        history: [...((prog.history as Row[]) ?? []), { at, by: who, action: 'endorsed', version: prog.version }],
      });
      const fresh = get('programme_alignments', id)!;
      let evidence = 0, graduates = 0;
      const people: string[] = [];
      for (const g of raw('programme_graduates').filter((x) => x.programme_id === id && x.status !== 'evidence_written').sort(byId)) {
        const st = gradStatus(fresh, String(g.graduated_on).slice(0, 10));
        if (st === 'evidence_written') {
          const ids = writeEvidence(g, fresh, who);
          upd('programme_graduates', g.id, { status: st, evidence_ids: ids, evidence_on: today, updated_at: at });
          evidence += ids.length; graduates++; people.push(g.person_id);
          notify(`nt-ua-grad-${g.id}`, g.person_id, `Your degree now counts as validated skill evidence (${fresh.code})`, `أصبحت شهادتك دليلاً مُعتمداً على المهارات (${fresh.code})`, '/my/skills', 'ok');
        } else upd('programme_graduates', g.id, { status: st, updated_at: at });
      }
      for (const p of [...new Set(people)].sort()) await applySkills(b, p, today);
      notify(`nt-ua-${id}-v${prog.version}-endorsed`, prog.submitted_by, `Programme endorsed: ${prog.title_en}`, `اعتُمد البرنامج: ${prog.title_ar}`, `/universities/programmes/${id}`, 'ok');
      return h.done<R>('programme.decide', 'programme_alignments', id, `endorsed until ${validTo}`, role, 'kafaa.programme.endorse',
        `Programme ${prog.code} (${prog.university_org_id}) endorsed until ${validTo}; ${graduates} graduates received validated evidence (${evidence} skills)`,
        'Programme endorsed', { id, status: 'endorsed', evidence, graduates }, ['programme_alignments', 'programme_graduates', 'skill_evidence', 'person_skills', 'notifications']);
    },

    async recordGraduateHire(input) {
      await b.whenReady();
      type R = { id: string; status: string; evidence: number };
      const x = (input ?? {}) as Row;
      const who = me();
      if (!who) return h.refuse<R>('programme.graduate', 'programme_graduates', null, 'not_signed_in', UA_MSG.not_signed_in);
      const role = ctx().actingRole('applications', ['A']);
      if (!role) return h.refuse<R>('programme.graduate', 'programme_graduates', null, 'forbidden', UA_MSG.forbidden_hire);
      const person = get('people', x.person_id);
      const prog = get('programme_alignments', x.programme_id);
      const id = person && prog ? graduateId(prog.id, person.id) : null;
      const today = todayIso();
      const code = hireProblem(x, person, prog, !!id && !!get('programme_graduates', id), today);
      if (code === 'duplicate') return h.refuse<R>('programme.graduate', 'programme_graduates', id, 'duplicate', UA_MSG.duplicate, role);
      if (code) return h.refuse<R>('programme.graduate', 'programme_graduates', id, 'invalid', UA_MSG[code], role);
      const status = gradStatus(prog!, x.graduated_on);
      const at = nowTs();
      const grad: Row = { id: id!, person_id: person!.id, programme_id: prog!.id, university_org_id: prog!.university_org_id, graduated_on: x.graduated_on, hired_on: x.hired_on, status, evidence_ids: [], evidence_on: null, recorded_by: who, recorded_at: at, updated_at: at };
      ins('programme_graduates', grad);
      let ids: string[] = [];
      if (status === 'evidence_written') {
        ids = writeEvidence(grad, prog!, who);
        upd('programme_graduates', id!, { evidence_ids: ids, evidence_on: today });
        await applySkills(b, person!.id, today);
        notify(`nt-ua-grad-${id}`, person!.id, `Your degree now counts as validated skill evidence (${prog!.code})`, `أصبحت شهادتك دليلاً مُعتمداً على المهارات (${prog!.code})`, '/my/skills', 'ok');
      }
      return h.done<R>('programme.graduate', 'programme_graduates', id, `${status} (${ids.length} skills)`, role, 'kafaa.programme.graduate_hire',
        `Graduate hire recorded for programme ${prog!.code}: ${status === 'evidence_written' ? `${ids.length} skills recorded as validated evidence` : status === 'not_covered' ? 'graduation date outside the endorsement window, no evidence' : 'programme not endorsed yet, no evidence'}`,
        status === 'evidence_written' ? 'Hire recorded; validated evidence written for the mapped skills' : status === 'not_covered' ? 'Hire recorded; the graduation date is outside the endorsement window, so no evidence was written' : 'Hire recorded; evidence waits for the programme endorsement',
        { id: id!, status, evidence: ids.length }, ['programme_graduates', 'skill_evidence', 'person_skills', 'notifications']);
    },

    async saveFellowship(input) {
      await b.whenReady();
      type R = { id: string; milestones: number };
      const p = (input ?? {}) as Row;
      const who = me();
      if (!who) return h.refuse<R>('fellowship.award', 'fellowships', null, 'not_signed_in', FW_MSG.not_signed_in);
      const role = ctx().actingRole('ecosystem', ['A']);
      if (!role) return h.refuse<R>('fellowship.award', 'fellowships', null, 'forbidden', FW_MSG.forbidden_hr);
      const code = fellowshipProblem(p, { people: raw('people'), organisations: raw('organisations'), research_challenges: raw('research_challenges'), adv_technologies: raw('adv_technologies'), fellowships: raw('fellowships') });
      if (code === 'duplicate') return h.refuse<R>('fellowship.award', 'fellowships', fellowshipId(String(p.starts_on), String(p.fellow_person_id)), 'duplicate', FW_MSG.duplicate, role);
      if (code) return h.refuse<R>('fellowship.award', 'fellowships', null, 'invalid', FW_MSG[code], role);
      const id = fellowshipId(p.starts_on, p.fellow_person_id);
      const fellow = get('people', p.fellow_person_id)!, sup = get('people', p.supervisor_person_id)!;
      const uni = p.university_org_id ? String(p.university_org_id) : null;
      const at = nowTs();
      ins('fellowships', {
        id, kind: p.kind, title_en: str(p.title_en), title_ar: str(p.title_ar), fellow_person_id: fellow.id, fellow_initials: String(fellow.initials ?? ''), university_org_id: uni,
        host_kind: p.host_kind, host_ref: p.host_ref, supervisor_person_id: sup.id, supervisor_name_en: String(sup.display_name ?? ''), supervisor_name_ar: String(sup.display_name_ar || sup.display_name || ''),
        starts_on: p.starts_on, ends_on: p.ends_on, placement_en: str(p.placement_en), placement_ar: str(p.placement_ar), status: 'active', completed_on: null, withdrawn_on: null, withdraw_reason: null,
        sample: false, created_by: who, created_at: at, updated_at: at,
      });
      const plan = milestonePlan(id, p.kind as FwKind, p.starts_on, p.ends_on);
      for (const m of plan) ins('fellowship_milestones', { ...m, fellowship_id: id, fellow_person_id: fellow.id, university_org_id: uni, supervisor_person_id: sup.id, status: 'planned', submitted_by: null, submitted_at: null, note: '', signed_by: null, signed_at: null, return_note: null, updated_at: at });
      return h.done<R>('fellowship.award', 'fellowships', id, `${p.kind} ${p.host_kind}:${p.host_ref}`, role, 'kafaa.fellowship.award',
        `Fellowship ${id} (${p.kind}) hosted by ${p.host_kind} ${p.host_ref}, supervised by ${sup.id}, ${p.starts_on} to ${p.ends_on}`, 'Fellowship awarded with five milestones', { id, milestones: plan.length }, ['fellowships', 'fellowship_milestones']);
    },

    async updateMilestone(id, action, note) {
      await b.whenReady();
      type R = { id: string; status: string; fellowship_status: string };
      const who = me();
      if (!who) return h.refuse<R>('fellowship.milestone', 'fellowship_milestones', id ?? null, 'not_signed_in', FW_MSG.not_signed_in);
      const ms = get('fellowship_milestones', id);
      const fw = ms ? get('fellowships', ms.fellowship_id) : undefined;
      const hr = ctx().has('ecosystem', ['A']);
      const uniOrg = ctx().has('ecosystem', ['OrgW']) ? myOrg() : null;
      const role = action === 'submit' ? (fw && who === fw.fellow_person_id ? null : ctx().actingRole('ecosystem', ['OrgW'])) : (fw && who === fw.supervisor_person_id ? null : ctx().actingRole('ecosystem', ['A']));
      const code = milestoneProblem(action, ms, fw, { me: who, hr, uniOrg }, note);
      if (code === 'not_found') return h.refuse<R>('fellowship.milestone', 'fellowship_milestones', id ?? null, 'not_found', FW_MSG.not_found, role);
      if (code === 'forbidden') return h.refuse<R>('fellowship.milestone', 'fellowship_milestones', id, 'forbidden', FW_MSG.forbidden_ms, role);
      if (code === 'maker_checker') return h.refuse<R>('fellowship.milestone', 'fellowship_milestones', id, 'maker_checker', FW_MSG.maker_checker, role);
      if (code) return h.refuse<R>('fellowship.milestone', 'fellowship_milestones', id, 'invalid', FW_MSG[code], role);
      const at = nowTs();
      const n = str(note);
      const f = fw!, m = ms!;
      if (action === 'submit') {
        upd('fellowship_milestones', id, { status: 'submitted', submitted_by: who, submitted_at: at, note: n, return_note: null, updated_at: at });
        notify(`nt-fw-${id}-submitted`, f.supervisor_person_id, `Milestone to sign off: ${f.title_en}`, `مرحلة بانتظار الاعتماد: ${f.title_ar}`, `/universities/fellowships/${f.id}`);
        return h.done<R>('fellowship.milestone', 'fellowship_milestones', id, `submitted ${m.kind}`, role, null, '', 'Milestone submitted to the supervisor', { id, status: 'submitted', fellowship_status: f.status }, ['fellowship_milestones', 'notifications']);
      }
      if (action === 'return') {
        upd('fellowship_milestones', id, { status: 'planned', submitted_by: null, submitted_at: null, return_note: n, updated_at: at });
        return h.done<R>('fellowship.milestone', 'fellowship_milestones', id, `returned ${m.kind}`, role, null, '', 'Milestone returned with a note', { id, status: 'planned', fellowship_status: f.status }, ['fellowship_milestones']);
      }
      upd('fellowship_milestones', id, { status: 'signed_off', signed_by: who, signed_at: at, updated_at: at });
      const all = raw('fellowship_milestones').filter((x) => x.fellowship_id === f.id);
      const done = isComplete(all);
      if (done) upd('fellowships', f.id, { status: 'completed', completed_on: todayIso(), updated_at: at });
      return h.done<R>('fellowship.milestone', 'fellowship_milestones', id, `signed off ${m.kind}${done ? ' (fellowship complete)' : ''}`, role, 'kafaa.fellowship.milestone',
        `Fellowship ${f.id}: milestone ${m.n} (${m.kind}) signed off${done ? '; every required milestone is signed off, the fellowship is complete' : ''}`,
        done ? 'Milestone signed off; the fellowship is complete' : 'Milestone signed off', { id, status: 'signed_off', fellowship_status: done ? 'completed' : f.status }, ['fellowship_milestones', 'fellowships']);
    },

    async withdrawFellowship(id, reason) {
      await b.whenReady();
      type R = { id: string };
      const who = me();
      if (!who) return h.refuse<R>('fellowship.withdraw', 'fellowships', id ?? null, 'not_signed_in', FW_MSG.not_signed_in);
      const role = ctx().actingRole('ecosystem', ['A']);
      if (!role) return h.refuse<R>('fellowship.withdraw', 'fellowships', id ?? null, 'forbidden', FW_MSG.forbidden_hr);
      const f = get('fellowships', id);
      if (!f) return h.refuse<R>('fellowship.withdraw', 'fellowships', id ?? null, 'not_found', FW_MSG.not_found, role);
      if (f.status !== 'active') return h.refuse<R>('fellowship.withdraw', 'fellowships', id, 'invalid', FW_MSG.closed, role);
      const r = str(reason);
      if (r.length < 10 || r.length > 300) return h.refuse<R>('fellowship.withdraw', 'fellowships', id, 'invalid', FW_MSG.reason, role);
      upd('fellowships', id, { status: 'withdrawn', withdrawn_on: todayIso(), withdraw_reason: r, updated_at: nowTs() });
      return h.done<R>('fellowship.withdraw', 'fellowships', id, 'withdrawn', role, 'kafaa.fellowship.withdraw', `Fellowship ${id} withdrawn: ${r}`, 'Fellowship withdrawn; it stays in the completion rate', { id }, ['fellowships']);
    },

    async fellowshipStats() {
      await b.whenReady();
      if (!me()) return h.refuse<FwStats>('fellowship.stats', 'fellowships', null, 'not_signed_in', FW_MSG.not_signed_in);
      if (!ctx().has('ecosystem', ['R', 'Agg', 'W', 'A'])) return h.refuse<FwStats>('fellowship.stats', 'fellowships', null, 'forbidden', FW_MSG.forbidden_stats);
      return okR('Fellowship completion', fellowshipStats(raw('fellowships'), raw('fellowship_milestones'), todayIso()));
    },
  };
}
