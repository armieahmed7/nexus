// FS44 Expert lecture library + FS45 Localisation countdown: LocalBackend RPCs (FS wave E · E3), spread into makeLocalM24.
// 1:1 mirror of supabase/migrations/20261010253001_kafaa_fs53_lectures_localisation.sql: the same checks in the same order, the same
// refusal codes and messages (LEC_MSG, LZ_MSG), the same audit rows, ledger rows and F01 evidence rows. Pages never import this file.
// Shared writes (like the SQL SECURITY DEFINER functions): F01 skill_evidence `se:contrib:<contribution>:<skill>` (kind rating, basis
// validated, ref_table lectures | knowledge_assets) + applySkills for the contributor; M14 notifications (kind knowledge, `nt-lc-*`).
// Reads (never writes) the F31 instructor pipeline of M02 (instructor_tracks, instructor_observations, teaching_hours, training_records)
// through M02's own pure rules (deriveStage, initialDoneOn, currencyView), exactly as SQL calls kafaa_ins_stage / kafaa_ins_currency.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import { nowTs } from '../../../data/audit';
import { todayIso } from '../../../domain/rules';
import { applySkills } from '../../../data/local/rpc.w0';
import { hasContactDetails, postGuard } from '../../m22/domain';
import { currencyView, deriveStage, initialDoneOn, type ObsRow, type HoursRow, type TrackRow } from '../../m02/instructors';
import {
  LEC_MSG, contributionEvidenceId, contributorsOf, contributionReasons, decideProblem, evidenceSkills, lectureProblem, resolvePosition, strList,
  type ContributionRow, type LectureInput as RuleInput, type PositionLite, type SkillLite,
} from '../lectures';
import { LZ_MSG, TARGET_MAX, computeBoard, overdueOf, readiness, statusProblem, type LocItem, type TrackState } from '../localisation';
import type { ContributionView, LectureReview, LocBoard, LocBoardItem, M24Rpc } from './rpc';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const hex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (x) => x.toString(16).padStart(2, '0')).join('');
const str = (s: unknown) => (typeof s === 'string' ? s.trim() : '');
const d10 = (v: unknown) => (v ? String(v).slice(0, 10) : null);

type Fs44Keys = 'saveLecture' | 'publishLecture' | 'withdrawLecture' | 'syncContributions' | 'contributionQueue' | 'validateContribution' | 'localisationBoard' | 'localisationOverdue' | 'setLocalisationStatus';

export function makeLocalFs44(b: LocalBackend, h: LocalRpcHelpers): Pick<M24Rpc, Fs44Keys> {
  const me = () => b.identity().personId;
  const ctx = () => b.access();
  const raw = (t: string) => b.raw(t as never) as unknown as Row[];
  const get = (t: string, id: string | null | undefined) => (id ? (b.rawGet(t as never, id) as unknown as Row | undefined) : undefined);
  const ins = (t: string, row: Row) => b.rawInsert(t as never, row as never);
  const upd = (t: string, id: string, patch: Row) => b.rawUpdate(t as never, id, patch as never);
  const today = () => todayIso();
  const has = (res: string, levels: ('R' | 'W' | 'A' | 'Scope' | 'Agg' | 'Own')[]) => ctx().has(res, levels);
  const person = (id: string | null | undefined) => get('people', id);
  const nameOf = (id: string | null | undefined) => { const p = person(id); return { en: p?.display_name ?? '', ar: p?.display_name_ar || p?.display_name || '' }; };
  const notify = (id: string, pid: string | null | undefined, en: string, ar: string, link: string, severity = 'info') => {
    if (!pid || !person(pid) || get('notifications', id)) return;
    ins('notifications', { id, person_id: pid, kind: 'knowledge', title_en: en, title_ar: ar, link, severity, created_at: nowTs() });
  };
  const policies = () => raw('refusal_policies').map((p) => ({ category: p.category, patterns: p.patterns ?? [], enabled: p.enabled }));
  const skillMap = () => new Map<string, SkillLite>(raw('skills').map((s) => [s.id, { id: s.id, area: s.area, competency_id: s.competency_id, lifecycle: s.lifecycle ?? null, fs_area: s.fs_area ?? null }]));
  const secComps = () => new Set(raw('competencies').filter((c) => c.domain === 'security').map((c) => c.id as string));
  const positionsOf = (pid: string): PositionLite[] => raw('klra_positions').filter((p) => p.person_id === pid && p.active).map((p) => ({ id: p.id, person_id: p.person_id, family_id: p.family_id ?? null, active: true, title_en: p.title_en, title_ar: p.title_ar }));
  const world = (speaker: string, position: PositionLite | null) => ({
    skills: skillMap(), secComps: secComps(), position, speakerPositions: positionsOf(speaker),
    guard: (text: string) => postGuard(text, policies()), contact: (text: string) => hasContactDetails(text), today: today(),
  });
  const hist = (status: string, note: string | null = null) => ({ at: nowTs(), status, by: me(), note });
  const sourceOf = (c: Row) => (c.ref_table === 'lectures' ? get('lectures', c.ref_id) : get('knowledge_assets', c.ref_id));
  const sourcePublished = (c: Row) => { const s = sourceOf(c); return !!s && s.status === 'published' && !!s.published; };

  // ── FS45 helpers: F31 track states (deriveStage + currencyView, as kafaa_ins_stage + kafaa_ins_currency)
  const trackStates = (on: string): TrackState[] => {
    const obs = raw('instructor_observations');
    const hours = raw('teaching_hours');
    const recs = raw('training_records');
    return raw('instructor_tracks').map((t) => {
      const init = initialDoneOn(t.person_id, t.route, recs as never);
      const stage = deriveStage(t as TrackRow, obs.filter((o) => o.track_id === t.id) as ObsRow[], init);
      const cur = currencyView(t as TrackRow, hours.filter((x) => x.person_id === t.person_id).map((x) => ({ ...x, delivered_on: String(x.delivered_on).slice(0, 10), hours: Number(x.hours) })) as HoursRow[], on);
      return { id: t.id, person_id: t.person_id, status: t.status, stage, discipline: t.discipline ?? '', standard_ids: [...(t.standard_ids ?? [])], currency: cur?.status ?? null };
    });
  };
  const locItem = (r: Row): LocItem => ({
    id: r.id, programme_id: r.programme_id ?? null, title_en: r.title_en, title_ar: r.title_ar, scope: r.scope, partner_org_id: r.partner_org_id, standard_ids: [...(r.standard_ids ?? [])],
    discipline: r.discipline ?? '', instructors_needed: Number(r.instructors_needed), baseline_on: String(r.baseline_on).slice(0, 10), target_on: String(r.target_on).slice(0, 10), status: r.status, sort: Number(r.sort ?? 0),
  });

  const contribView = (c: Row, skills: Map<string, SkillLite>, sec: Set<string>): ContributionView => {
    const src = sourceOf(c);
    const ev = evidenceSkills(c.skill_ids ?? [], skills, sec);
    const dec = c.decided_by ? nameOf(c.decided_by) : { en: '', ar: '' };
    return {
      id: c.id, person_id: c.person_id, person_name: c.person_name, person_name_ar: c.person_name_ar, kind: c.kind, contributor_role: c.contributor_role, ref_table: c.ref_table, ref_id: c.ref_id,
      title_en: c.title_en, title_ar: c.title_ar, skill_ids: [...(c.skill_ids ?? [])], evidence_skill_ids: ev, level: Number(c.level), status: c.status, submitted_on: String(c.submitted_on).slice(0, 10),
      decided_on: d10(c.decided_on), decided_by_name: dec.en, decided_by_name_ar: dec.ar, note: c.note ?? null, evidence_ids: [...(c.evidence_ids ?? [])],
      source_status: src?.status ?? 'missing', source_date: c.ref_table === 'lectures' ? d10(src?.delivered_on) : d10(src?.published_at), position_linked: !!src?.position_id,
      reasons: contributionReasons(c as ContributionRow, ev.length, !!src?.position_id) as never,
    };
  };
  const openContribution = (kind: 'lecture' | 'asset', src: Row): string[] => {
    const made: string[] = [];
    for (const k of contributorsOf(kind, src as never)) {
      if (get('contributions', k.id) || !person(k.person_id)) continue;
      const n = nameOf(k.person_id);
      ins('contributions', {
        id: k.id, person_id: k.person_id, person_name: n.en, person_name_ar: n.ar, kind, contributor_role: k.role, ref_table: kind === 'lecture' ? 'lectures' : 'knowledge_assets', ref_id: src.id,
        title_en: src.title_en, title_ar: src.title_ar, skill_ids: [...(src.skill_ids ?? [])], level: k.level, status: 'pending', submitted_on: today(), decided_by: null, decided_role: null,
        decided_on: null, note: null, evidence_ids: [], created_at: nowTs(),
      });
      made.push(k.id);
    }
    return made;
  };

  return {
    // ───────────────────────────── FS44
    async saveLecture(input) {
      await b.whenReady();
      type R = { id: string; status: string; position_id: string | null };
      const A = 'knowledge.lecture.save';
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>(A, 'lectures', str(input?.id) || null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', LEC_MSG.not_signed_in);
      if (!has('knowledge', ['R'])) return refuse('forbidden', LEC_MSG.forbidden);
      let role = ctx().actingRole('knowledge', ['R']);
      const id = str(input?.id);
      const row = id ? get('lectures', id) : undefined;
      if (id && (!row || !(row.created_by === who || row.speaker_id === who || has('knowledge', ['A'])))) return refuse('not_found', LEC_MSG.not_found, role);
      if (row && row.status !== 'draft' && row.status !== 'review') return refuse('invalid', LEC_MSG.not_editable, role);
      const speaker = row ? row.speaker_id : str(input?.speaker_id) || who;
      if (speaker !== who && !has('knowledge', ['A'])) return refuse('forbidden', LEC_MSG.forbidden_behalf, role);
      if (speaker !== who) role = ctx().actingRole('knowledge', ['A']);
      const sp = person(speaker);
      if (!sp || sp.kind !== 'staff' || sp.status !== 'active') return refuse('invalid', LEC_MSG.speaker, role);
      const pos = resolvePosition(input?.position_id, positionsOf(speaker));
      if (pos === false) return refuse('invalid', LEC_MSG.position, role);
      const bad = lectureProblem(input as RuleInput, world(speaker, pos));
      if (bad) return refuse(bad.code, bad.message, role);
      const status = input?.submit === true ? 'review' : 'draft';
      const n = nameOf(speaker);
      const chapters = (Array.isArray(input.chapters) ? input.chapters : []).map((c) => ({ at: c.at, en: c.en.trim(), ar: c.ar.trim() }));
      const lid = row?.id ?? `lec-${hex(12)}`;
      const patch = {
        title_en: input.title_en.trim(), title_ar: input.title_ar.trim(), abstract_en: input.abstract_en.trim(), abstract_ar: input.abstract_ar.trim(),
        speaker_id: speaker, speaker_name: n.en, speaker_name_ar: n.ar, speaker_role_id: sp.job_role_id ?? null, format: input.format, lang: input.lang, delivered_on: input.delivered_on,
        duration_min: input.duration_min, recording_code: str(input.recording_code) || null, chapters, skill_ids: strList(input.skill_ids)!,
        position_id: pos ? pos.id : null, position_title_en: pos ? pos.title_en ?? '' : '', position_title_ar: pos ? pos.title_ar ?? '' : '', system_family: input.system_family,
        status, published: false, history: [...(row?.history ?? []), hist(status)], updated_at: nowTs(),
      };
      if (row) upd('lectures', lid, patch);
      else ins('lectures', { id: lid, ...patch, published_by: null, published_at: null, withdrawn_reason: null, synthetic: true, created_by: who, created_at: nowTs() });
      return h.done<R>(A, 'lectures', lid, status, role, null, '', status === 'review' ? 'Submitted for publication' : 'Draft saved', { id: lid, status, position_id: pos ? pos.id : null }, ['lectures']);
    },

    async publishLecture(id) {
      await b.whenReady();
      type R = { status: string; contribution_id: string | null };
      const A = 'knowledge.lecture.publish';
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>(A, 'lectures', id || null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', LEC_MSG.not_signed_in);
      if (!has('knowledge', ['A'])) return refuse('forbidden', LEC_MSG.forbidden_owner);
      const role = ctx().actingRole('knowledge', ['A']);
      const row = get('lectures', id);
      if (!row) return refuse('not_found', LEC_MSG.not_found, role);
      if (row.status !== 'review') return refuse('invalid', LEC_MSG.not_in_review, role);
      if (row.speaker_id === who || row.created_by === who) return refuse('maker_checker', LEC_MSG.maker_checker, role);
      const positions = positionsOf(row.speaker_id);
      const pos = row.position_id ? positions.find((p) => p.id === row.position_id) ?? { id: row.position_id, family_id: get('klra_positions', row.position_id)?.family_id ?? null } : null;
      const bad = lectureProblem(row as RuleInput, world(row.speaker_id, pos as PositionLite | null));
      if (bad) return refuse(bad.code, bad.message, role);
      upd('lectures', id, { status: 'published', published: true, published_by: who, published_at: nowTs(), history: [...(row.history ?? []), hist('published')], updated_at: nowTs() });
      const made = openContribution('lecture', { ...row, status: 'published' });
      notify(`nt-lc-${id}-published`, row.speaker_id, `Your lecture is in the library: ${row.title_en}`, `محاضرتك متاحة في المكتبة: ${row.title_ar}`, `/knowledge/lectures/${id}`, 'ok');
      return h.done<R>(A, 'lectures', id, `published; contribution ${made[0] ?? 'existing'}`, role, 'kafaa.knowledge.lecture.publish', `Lecture ${id} published to the lecture library`,
        'Published to the lecture library', { status: 'published', contribution_id: made[0] ?? null }, ['lectures', 'contributions', 'notifications']);
    },

    async withdrawLecture(id, reason) {
      await b.whenReady();
      type R = { status: string };
      const A = 'knowledge.lecture.withdraw';
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>(A, 'lectures', id || null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', LEC_MSG.not_signed_in);
      if (!has('knowledge', ['R'])) return refuse('forbidden', LEC_MSG.forbidden);
      const row = get('lectures', id);
      const owner = has('knowledge', ['A']);
      const role = owner ? ctx().actingRole('knowledge', ['A']) : ctx().actingRole('knowledge', ['R']);
      if (!row || (!owner && row.speaker_id !== who && !row.published)) return refuse('not_found', LEC_MSG.not_found, role);
      if (!owner && row.speaker_id !== who) return refuse('forbidden', LEC_MSG.withdraw_forbidden, role);
      if (row.status !== 'review' && row.status !== 'published') return refuse('invalid', LEC_MSG.withdraw_state, role);
      const why = str(reason);
      if (why.length < 5 || why.length > 600) return refuse('invalid', LEC_MSG.withdraw_reason, role);
      const wasPublished = row.status === 'published';
      upd('lectures', id, { status: 'withdrawn', published: false, withdrawn_reason: why, history: [...(row.history ?? []), hist('withdrawn', why)], updated_at: nowTs() });
      return h.done<R>(A, 'lectures', id, why, role, wasPublished ? 'kafaa.knowledge.lecture.withdraw' : null, wasPublished ? `Lecture ${id} withdrawn from the lecture library` : '',
        'Lecture withdrawn', { status: 'withdrawn' }, ['lectures']);
    },

    async syncContributions() {
      await b.whenReady();
      type R = { created: number; ids: string[] };
      const A = 'knowledge.contribution.sync';
      const who = me();
      if (!who) return h.refuse<R>(A, 'contributions', null, 'not_signed_in', LEC_MSG.not_signed_in);
      if (!has('knowledge', ['A'])) return h.refuse<R>(A, 'contributions', null, 'forbidden', LEC_MSG.forbidden_owner);
      const role = ctx().actingRole('knowledge', ['A']);
      const ids: string[] = [];
      const byId = (x: Row, y: Row) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0);
      for (const l of raw('lectures').filter((x) => x.status === 'published' && x.published).sort(byId)) ids.push(...openContribution('lecture', l));
      for (const a of raw('knowledge_assets').filter((x) => x.status === 'published' && x.published).sort(byId)) ids.push(...openContribution('asset', a));
      return h.done<R>(A, 'contributions', null, `${ids.length} opened`, role, null, '', ids.length ? 'New contributions are waiting for validation' : 'Every published lecture and asset already has its contributions',
        { created: ids.length, ids }, ['contributions']);
    },

    async contributionQueue() {
      await b.whenReady();
      if (!me()) return null;
      const can = has('knowledge', ['A']);
      if (!can && !has('audit_log', ['R'])) return null;
      const skills = skillMap();
      const sec = secComps();
      const all = raw('contributions');
      const order = (x: Row, y: Row) => (String(x.submitted_on) < String(y.submitted_on) ? -1 : String(x.submitted_on) > String(y.submitted_on) ? 1 : x.id < y.id ? -1 : 1);
      const pending = all.filter((c) => c.status === 'pending').sort(order).map((c) => contribView(c, skills, sec));
      const decided = all.filter((c) => c.status !== 'pending').sort((x, y) => (String(y.decided_on) < String(x.decided_on) ? -1 : String(y.decided_on) > String(x.decided_on) ? 1 : x.id < y.id ? -1 : 1)).slice(0, 50).map((c) => contribView(c, skills, sec));
      const val = all.filter((c) => c.status === 'validated');
      const review: LectureReview[] = raw('lectures').filter((l) => l.status === 'review').sort((x, y) => (x.id < y.id ? -1 : 1)).map((l) => ({
        id: l.id, title_en: l.title_en, title_ar: l.title_ar, abstract_en: l.abstract_en, abstract_ar: l.abstract_ar, speaker_id: l.speaker_id, speaker_name: l.speaker_name, speaker_name_ar: l.speaker_name_ar,
        created_by: l.created_by, format: l.format, lang: l.lang, delivered_on: String(l.delivered_on).slice(0, 10), duration_min: Number(l.duration_min), skill_ids: [...(l.skill_ids ?? [])],
        position_id: l.position_id ?? null, position_title_en: l.position_title_en ?? '', position_title_ar: l.position_title_ar ?? '', system_family: l.system_family, chapters: l.chapters ?? [], recording_code: l.recording_code ?? null,
      }));
      return {
        can_decide: can, review, pending, decided,
        stats: { pending: pending.length, validated: val.length, rejected: all.filter((c) => c.status === 'rejected').length, people: new Set(val.map((c) => c.person_id)).size, evidence: val.reduce((a, c) => a + (c.evidence_ids ?? []).length, 0) },
      };
    },

    async validateContribution(id, decision, note = '') {
      await b.whenReady();
      type R = { status: string; evidence_ids: string[] };
      const A = 'knowledge.contribution.decide';
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>(A, 'contributions', id || null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', LEC_MSG.not_signed_in);
      if (!has('knowledge', ['A'])) return refuse('forbidden', LEC_MSG.forbidden_owner);
      const role = ctx().actingRole('knowledge', ['A']);
      const c = get('contributions', id);
      const skills = skillMap();
      const ev = c ? evidenceSkills(c.skill_ids ?? [], skills, secComps()) : [];
      const code = decideProblem(c as ContributionRow | undefined, who, decision, note, c ? sourcePublished(c) : false, ev.length);
      if (code === 'not_found') return refuse('not_found', LEC_MSG.contrib_not_found, role);
      if (code === 'decided') return refuse('invalid', LEC_MSG.contrib_decided, role);
      if (code === 'self') return refuse('maker_checker', LEC_MSG.contrib_self, role);
      if (code === 'decision') return refuse('invalid', LEC_MSG.contrib_decision, role);
      if (code === 'source') return refuse('source_unavailable', LEC_MSG.contrib_source, role);
      if (code === 'skills') return refuse('invalid', LEC_MSG.contrib_skills, role);
      const text = str(note);
      const on = today();
      if (decision === 'reject') {
        upd('contributions', id, { status: 'rejected', decided_by: who, decided_role: role, decided_on: on, note: text });
        notify(`nt-lc-${id}-rejected`, c!.person_id, `Contribution not validated yet: ${c!.title_en}`, `لم يُعتمد الإسهام بعد: ${c!.title_ar}`, '/knowledge/lectures?tab=mine', 'warn');
        return h.done<R>(A, 'contributions', id, `rejected: ${text}`, role, null, '', 'Contribution returned with your reason; no evidence was written', { status: 'rejected', evidence_ids: [] }, ['contributions', 'notifications']);
      }
      const ids: string[] = [];
      const refTable = c!.ref_table;
      for (const sk of ev) {
        const eid = contributionEvidenceId(id, sk);
        const patch = { level: Number(c!.level), basis: 'validated', status: 'current', observed_on: on, note: `Validated contribution (${c!.kind}, ${c!.contributor_role})`, recorded_by: who, active: true };
        if (get('skill_evidence', eid)) upd('skill_evidence', eid, patch);
        else ins('skill_evidence', { id: eid, person_id: c!.person_id, skill_id: sk, kind: 'rating', ref_table: refTable, ref_id: c!.ref_id, ...patch, created_at: nowTs() });
        ids.push(eid);
      }
      upd('contributions', id, { status: 'validated', decided_by: who, decided_role: role, decided_on: on, note: text || null, evidence_ids: ids });
      await applySkills(b, c!.person_id, on);
      notify(`nt-lc-${id}-validated`, c!.person_id, `Contribution validated: ${c!.title_en}`, `اعتُمد إسهامك: ${c!.title_ar}`, '/my/skills', 'ok');
      return h.done<R>(A, 'contributions', id, `validated ${ids.length} skills at level ${c!.level}`, role, 'kafaa.knowledge.contribution',
        `Contribution ${id} by ${c!.person_id} validated by ${who}: ${ids.length} skill evidence rows (validated rating, level ${c!.level}); internal recognition, not a qualification`,
        'Contribution validated: the evidence is on their skills profile', { status: 'validated', evidence_ids: ids }, ['contributions', 'skill_evidence', 'person_skills', 'notifications']);
    },

    // ───────────────────────────── FS45
    async localisationBoard() {
      await b.whenReady();
      if (!me() || !has('knowledge', ['R'])) return null;
      const on = today();
      const items = raw('localisation_items').map(locItem);
      const tracks = trackStates(on);
      const board = computeBoard(items, tracks, on);
      const people = has('sat', ['R', 'W', 'A']);
      const rows = new Map(raw('localisation_items').map((r) => [r.id, r]));
      const trackRows = new Map(raw('instructor_tracks').map((t) => [t.id, t]));
      const out: LocBoardItem[] = board.items.map((bi) => {
        const r = rows.get(bi.id)!;
        const pg = get('programmes', r.programme_id);
        const org = get('organisations', r.partner_org_id);
        const it = locItem(r);
        return {
          id: r.id, programme_id: r.programme_id ?? null, programme_code: pg?.code ?? null, programme_en: pg?.name_en ?? '', programme_ar: pg?.name_ar ?? '', title_en: r.title_en, title_ar: r.title_ar, scope: r.scope,
          partner_org_id: r.partner_org_id, partner_en: org?.name_en ?? '', partner_ar: org?.name_ar ?? '', partner_role_en: r.partner_role_en ?? '', partner_role_ar: r.partner_role_ar ?? '',
          standard_ids: it.standard_ids, discipline: it.discipline ?? '', instructors_needed: it.instructors_needed, baseline_on: it.baseline_on, target_on: it.target_on, status: r.status,
          status_note: r.status_note ?? '', status_at: r.status_at ?? null, history: r.history ?? [],
          readiness: { needed: bi.readiness.needed, ready_now: bi.readiness.ready_now, pipeline: bi.readiness.pipeline, lapsed: bi.readiness.lapsed, tenths: bi.readiness.tenths, pct: bi.readiness.pct, gap: bi.readiness.gap },
          risk: { level: bi.risk.level, overdue: bi.risk.overdue, days_left: bi.risk.days_left, regressed: bi.risk.regressed, reasons: bi.risk.reasons as never },
          instructors: people ? bi.readiness.lines.map((l) => ({ track_id: l.track_id, person_id: l.person_id, name: trackRows.get(l.track_id)?.person_name ?? '', name_ar: trackRows.get(l.track_id)?.person_name_ar ?? '', state: l.state, tenths: l.tenths })) : null,
        };
      });
      const result: LocBoard = { can_edit: ctx().roleGrant('training_manager', 'knowledge', 'W'), can_see_people: people, today: on, deadline: TARGET_MAX, items: out, summary: board.summary };
      return result;
    },

    async localisationOverdue() {
      await b.whenReady();
      if (!me() || !has('knowledge', ['R'])) return null;
      const on = today();
      const items = raw('localisation_items').map(locItem);
      const board = computeBoard(items, trackStates(on), on);
      const rows = new Map(raw('localisation_items').map((r) => [r.id, r]));
      return {
        today: on,
        items: overdueOf(items, board.items).map((o) => {
          const r = rows.get(o.id)!;
          const org = get('organisations', r.partner_org_id);
          return { id: r.id, title_en: r.title_en, title_ar: r.title_ar, partner_en: org?.name_en ?? '', partner_ar: org?.name_ar ?? '', programme_id: r.programme_id ?? null, target_on: String(r.target_on).slice(0, 10), days_overdue: o.days_overdue, pct: o.pct, status: r.status };
        }),
      };
    },

    async setLocalisationStatus(id, input) {
      await b.whenReady();
      type R = { status: string; target_on: string };
      const A = 'knowledge.localisation.status';
      const refuse = (code: string, msg: string, role: string | null = null) => h.refuse<R>(A, 'localisation_items', id || null, code, msg, role);
      const who = me();
      if (!who) return refuse('not_signed_in', LZ_MSG.not_signed_in);
      if (!ctx().roleGrant('training_manager', 'knowledge', 'W')) return refuse('forbidden', LZ_MSG.forbidden_edit);
      const role = 'training_manager';
      const row = get('localisation_items', id);
      if (!row) return refuse('not_found', LZ_MSG.not_found, role);
      const it = locItem(row);
      const r = readiness(it, trackStates(today()));
      const code = statusProblem(it, input ?? {}, r);
      if (code === 'status') return refuse('invalid', LZ_MSG.status, role);
      if (code === 'target') return refuse('invalid', LZ_MSG.target, role);
      if (code === 'unchanged') return refuse('invalid', LZ_MSG.unchanged, role);
      if (code === 'note_long') return refuse('invalid', LZ_MSG.note_long, role);
      if (code === 'note_required') return refuse('note_required', LZ_MSG.note_required, role);
      if (code === 'not_ready') return refuse('not_ready', `${LZ_MSG.not_ready} (${r.ready_now} of ${r.needed})`, role);
      const target = str(input?.target_on) || it.target_on;
      const note = str(input?.note);
      upd('localisation_items', id, {
        status: input.status, target_on: target, status_note: note, status_by: who, status_at: nowTs(), updated_at: nowTs(),
        history: [...(row.history ?? []), { at: nowTs(), by: who, status: input.status, target_on: target, note: note || null }],
      });
      return h.done<R>(A, 'localisation_items', id, `${it.status} -> ${input.status}; target ${target}`, role, 'kafaa.localisation.status',
        `Localisation item ${id}: ${it.status} -> ${input.status}, target ${target} (computed readiness ${r.pct}%, ${r.ready_now} of ${r.needed} in-house instructors current)`,
        'Localisation status updated', { status: input.status, target_on: target }, ['localisation_items']);
    },
  };
}
