// M04 · F28 Simulator scenario library LocalBackend RPCs (owner: W4 · E3). Spread into makeLocalM04 (backend/local.ts).
// 1:1 mirror of supabase/migrations/20261009143001_kafaa_w4e3_simulator.sql: same checks in the same order, the same refusal
// codes and messages (scenarios.ts SIM_MSG), one audit row per call and the same ledger events. Pages never import this file.
import type { LocalBackend } from '../../../data/local/LocalBackend';
import type { LocalRpcHelpers } from '../../../data/ext/types';
import type { Result } from '../../../data/types';
import { nowTs } from '../../../data/audit';
import { newId } from '../../../data/local/store';
import { applySkills } from '../../../data/local/rpc.w0';
import { todayIso } from '../../../domain/rules';
import {
  NOTE_MAX, NOTE_MIN, DEBRIEF_TEXT_MAX, SIM_MSG, cleanRatings, contentIssue, crewRoster, cycleCoverage, cycleItemId, debriefEvidence, debriefId, debriefMemberId,
  debriefStatements, gapCount, slotCheck, validatePlan, validateScenario,
  type CycleLite, type ObjectiveLite, type ScenarioLite, type SimMsgKey,
} from '../scenarios';
import type { DebriefResult, M04SimRpc, SimDebriefView } from './simulator.rpc';

type Row = Record<string, any>;

export function makeLocalM04Sim(b: LocalBackend, h: LocalRpcHelpers): M04SimRpc {
  const me = () => b.identity().personId;
  const acc = () => b.access();
  const objectives = () => new Map((b.raw('sim_objectives' as never) as ObjectiveLite[]).map((o) => [o.id, o]));
  const scenarios = () => new Map((b.raw('sim_scenarios' as never) as unknown as ScenarioLite[]).map((s) => [s.id, s]));
  const cycleOf = (id: string) => b.rawGet('sim_cycles' as never, id) as unknown as (CycleLite & Row) | undefined;
  const items = (cycleId: string) => (b.raw('sim_cycle_items' as never) as Row[]).filter((i) => i.cycle_id === cycleId) as never[];
  const debriefs = () => b.raw('crew_debriefs' as never) as Row[];
  const notify = (person: string | null | undefined, en: string, ar: string, link: string, severity: 'info' | 'ok' | 'warn' = 'info') => {
    if (!person || !b.rawGet('people', person)) return;
    b.rawInsert('notifications', { id: newId('nt'), person_id: person, kind: 'simulator', title_en: en, title_ar: ar, link, severity, created_at: nowTs() } as never);
  };
  const hist = (x: Row | undefined, entry: Row) => [...((x?.history as Row[]) ?? []), { at: nowTs(), by: me(), ...entry }];

  return {
    async saveSimScenario(input) {
      await b.whenReady();
      type R = { id: string; status: string; revision: number };
      const no = (code: string, key: SimMsgKey, role: string | null = null) => h.refuse<R>('sim.scenario.save', 'sim_scenarios', input?.id ?? null, code, SIM_MSG[key], role);
      const who = me();
      if (!who) return no('not_signed_in', 'not_signed_in');
      const role = acc().actingRole('sat', ['W', 'A']);
      if (!role) return no('forbidden', 'forbidden');
      const cur = input?.id ? (b.rawGet('sim_scenarios' as never, input.id) as unknown as Row | undefined) : undefined;
      if (input?.id && !cur) return no('not_found', 'not_found', role);
      if (cur?.status === 'retired') return no('retired', 'retired', role);
      const v = validateScenario(input, { objectives: objectives(), competencies: new Set(b.raw('competencies').map((c) => c.id)) });
      if (!v.ok) return no(v.code, v.key, role);
      const submit = input.submit === true;
      const status = submit ? 'in_review' : 'draft';
      const ts = nowTs();
      let id: string;
      let revision: number;
      if (cur) {
        id = cur.id;
        revision = cur.status === 'approved' ? Number(cur.revision) + 1 : Number(cur.revision);
        b.rawUpdate('sim_scenarios' as never, id, {
          ...v.value, status, revision, last_edited_by: who, submitted_at: submit ? ts : null, approved_by: null, approved_at: null, review_note: null, updated_at: ts,
          history: hist(cur, { action: cur.status === 'approved' ? 'revised' : 'edited', revision, status }),
        } as never);
      } else {
        const codes = (b.raw('sim_scenarios' as never) as Row[]).map((s) => /^SCN-[0-9]+$/.test(s.code) ? Number(String(s.code).slice(4)) : 0);
        const n = Math.max(0, ...codes) + 1;
        id = newId('scn');
        revision = 1;
        b.rawInsert('sim_scenarios' as never, {
          id, code: `SCN-${String(n).padStart(3, '0')}`, ...v.value, purpose: 'training', status, revision, author_person_id: who, last_edited_by: who,
          submitted_at: submit ? ts : null, approved_by: null, approved_at: null, review_note: null, last_run_on: null, run_count: 0,
          history: hist(undefined, { action: 'created', revision, status }), sources: [], created_at: ts, updated_at: ts,
        } as never);
      }
      return h.done<R>('sim.scenario.save', 'sim_scenarios', id, `rev ${revision} ${status}`, role, null, '', submit ? 'Scenario submitted for review' : 'Scenario saved as a draft', { id, status, revision }, ['sim_scenarios']);
    },

    async reviewSimScenario(scenarioId, decision, note) {
      await b.whenReady();
      type R = { id: string; status: string };
      const no = (code: string, key: SimMsgKey, role: string | null = null) => h.refuse<R>('sim.scenario.review', 'sim_scenarios', scenarioId || null, code, SIM_MSG[key], role);
      const who = me();
      if (!who) return no('not_signed_in', 'not_signed_in');
      const role = acc().actingRole('sat', ['A']);
      if (!role) return no('forbidden', 'forbidden_approve');
      const x = b.rawGet('sim_scenarios' as never, String(scenarioId ?? '')) as unknown as Row | undefined;
      if (!x) return no('not_found', 'not_found', role);
      if (!['approve', 'return', 'retire'].includes(decision)) return no('invalid', 'invalid_decision', role);
      if (x.status === 'retired') return no('retired', 'retired', role);
      if (decision !== 'retire' && x.status !== 'in_review') return no('not_in_review', 'not_in_review', role);
      if (decision === 'approve' && x.last_edited_by === who) return no('maker_checker', 'maker_checker', role);
      const text = String(note ?? '').trim();
      if ((decision !== 'approve' && (text.length < NOTE_MIN || text.length > NOTE_MAX)) || text.length > NOTE_MAX) return no('invalid', 'note_required', role);
      const status = decision === 'approve' ? 'approved' : decision === 'return' ? 'draft' : 'retired';
      const ts = nowTs();
      b.rawUpdate('sim_scenarios' as never, x.id, {
        status, review_note: text || null, updated_at: ts, ...(decision === 'approve' ? { approved_by: who, approved_at: ts } : {}),
        history: hist(x, { action: decision, revision: x.revision, status, note: text || null }),
      } as never);
      if (decision !== 'retire') notify(x.last_edited_by, decision === 'approve' ? `Scenario approved: ${x.title_en}` : `Scenario returned for changes: ${x.title_en}`,
        decision === 'approve' ? `اعتُمد السيناريو: ${x.title_ar}` : `أُعيد السيناريو للتعديل: ${x.title_ar}`, '/training/simulator/scenarios', decision === 'approve' ? 'ok' : 'warn');
      const ledger = decision === 'approve' ? 'kafaa.sim.scenario.approve' : decision === 'retire' ? 'kafaa.sim.scenario.retire' : null;
      return h.done<R>('sim.scenario.review', 'sim_scenarios', x.id, `${decision} rev ${x.revision}`, role, ledger, `Simulator scenario ${x.code} rev ${x.revision}: ${decision}`,
        decision === 'approve' ? 'Scenario approved' : decision === 'return' ? 'Scenario returned to its author' : 'Scenario retired', { id: x.id, status }, ['sim_scenarios', 'notifications']);
    },

    async planCycle(cycleId, list, submit) {
      await b.whenReady();
      type R = { cycle_id: string; status: string; items: number; gaps: number };
      const no = (code: string, key: SimMsgKey, role: string | null = null) => h.refuse<R>('sim.cycle.plan', 'sim_cycles', cycleId || null, code, SIM_MSG[key], role);
      const who = me();
      if (!who) return no('not_signed_in', 'not_signed_in');
      const role = acc().actingRole('sat', ['W', 'A']);
      if (!role) return no('forbidden', 'forbidden');
      const c = cycleOf(String(cycleId ?? ''));
      if (!c) return no('not_found', 'cycle_not_found', role);
      if (c.status === 'closed') return no('cycle_closed', 'cycle_closed', role);
      const sc = scenarios();
      const v = validatePlan(list, c, sc);
      if (!v.ok) return no(v.code, v.key, role);
      const keep = new Set(v.value.map((i) => cycleItemId(c.id, i.scenario_id, i.segment)));
      const ts = nowTs();
      for (const it of items(c.id) as Row[]) if (!keep.has(it.id) && it.active !== false) b.rawUpdate('sim_cycle_items' as never, it.id, { active: false } as never);
      for (const i of v.value) {
        const id = cycleItemId(c.id, i.scenario_id, i.segment);
        const cur = b.rawGet('sim_cycle_items' as never, id) as unknown as Row | undefined;
        if (cur) { if (cur.active === false) b.rawUpdate('sim_cycle_items' as never, id, { active: true, added_by: who, added_at: ts } as never); }
        else b.rawInsert('sim_cycle_items' as never, { id, cycle_id: c.id, scenario_id: i.scenario_id, segment: i.segment, active: true, added_by: who, added_at: ts } as never);
      }
      const status = submit === true ? 'submitted' : 'draft';
      b.rawUpdate('sim_cycles' as never, c.id, { status, planned_by: who, planned_at: ts, approved_by: null, approved_at: null, gap_note: null } as never);
      const gaps = gapCount(cycleCoverage({ ...c, status }, items(c.id), sc, []));
      return h.done<R>('sim.cycle.plan', 'sim_cycles', c.id, `${v.value.length} items; ${gaps} gaps; ${status}`, role, null, '',
        status === 'submitted' ? 'Cycle plan submitted for approval' : 'Cycle plan saved', { cycle_id: c.id, status, items: v.value.length, gaps }, ['sim_cycles', 'sim_cycle_items']);
    },

    async approveCycle(cycleId, gapNote) {
      await b.whenReady();
      type R = { cycle_id: string; status: string; gaps: number };
      const no = (code: string, key: SimMsgKey, role: string | null = null) => h.refuse<R>('sim.cycle.approve', 'sim_cycles', cycleId || null, code, SIM_MSG[key], role);
      const who = me();
      if (!who) return no('not_signed_in', 'not_signed_in');
      const role = acc().actingRole('sat', ['A']);
      if (!role) return no('forbidden', 'forbidden_approve');
      const c = cycleOf(String(cycleId ?? ''));
      if (!c) return no('not_found', 'cycle_not_found', role);
      if (c.status !== 'submitted') return no('not_submitted', 'not_submitted', role);
      if (c.planned_by === who) return no('maker_checker', 'cycle_maker_checker', role);
      const gaps = gapCount(cycleCoverage(c, items(c.id), scenarios(), []));
      const text = String(gapNote ?? '').trim();
      if (gaps > 0 && (text.length < NOTE_MIN || text.length > NOTE_MAX)) return no('coverage_gaps', 'coverage_gaps', role);
      b.rawUpdate('sim_cycles' as never, c.id, { status: 'approved', approved_by: who, approved_at: nowTs(), gap_note: gaps > 0 ? text : null } as never);
      notify(c.planned_by, `Simulator cycle approved: ${c.label_en}`, `اعتُمدت خطة دورة المحاكي: ${c.label_ar}`, '/training/simulator/scenarios', 'ok');
      return h.done<R>('sim.cycle.approve', 'sim_cycles', c.id, `approved with ${gaps} gaps`, role, 'kafaa.sim.cycle.approve', `Simulator cycle ${c.id} approved (${gaps} coverage gaps)`,
        'Cycle plan approved', { cycle_id: c.id, status: 'approved', gaps }, ['sim_cycles', 'notifications']);
    },

    async recordDebrief(input) {
      await b.whenReady();
      type R = DebriefResult;
      const entity = input?.slot_id && input?.scenario_id ? debriefId(input.slot_id, input.scenario_id) : null;
      const no = (code: string, key: SimMsgKey, role: string | null = null) => h.refuse<R>('sim.debrief', 'crew_debriefs', entity, code, SIM_MSG[key], role);
      const who = me();
      if (!who) return no('not_signed_in', 'not_signed_in');
      const role = acc().actingRole('sat', ['W', 'A']);
      if (!role) return no('forbidden', 'forbidden_debrief');
      const slot = b.rawGet('simulator_slots', String(input?.slot_id ?? '')) as unknown as Row | undefined;
      const sk = slotCheck(slot as never, new Date().toISOString());
      if (sk) return no(sk, sk, role);
      const s = b.rawGet('sim_scenarios' as never, String(input.scenario_id ?? '')) as unknown as Row | undefined;
      if (!s) return no('not_found', 'not_found', role);
      if (s.status !== 'approved') return no('scenario_not_approved', 'scenario_not_approved', role);
      const heldOn = String(slot!.starts_at).slice(0, 10);
      const cycle = input.cycle_id ? cycleOf(input.cycle_id) : null;
      if (input.cycle_id && !cycle) return no('not_found', 'cycle_not_found', role);
      if (cycle && (!(s.programmes as string[]).includes(cycle.programme) || heldOn < String(cycle.starts_on) || heldOn > String(cycle.ends_on))) return no('wrong_cycle', 'wrong_cycle', role);
      const id = debriefId(slot!.id, s.id);
      if (b.rawGet('crew_debriefs' as never, id)) return no('already_recorded', 'already_recorded', role);
      const att = input.attendance;
      if (!Array.isArray(att) || !att.length || att.some((a) => !a || typeof a.person_id !== 'string' || typeof a.present !== 'boolean')
        || new Set(att.map((a) => a.person_id)).size !== att.length) return no('invalid', 'no_attendees', role);
      const roster = new Map(crewRoster(slot as never, b.raw('people') as never).map((r) => [r.person_id, r.position]));
      if (att.some((a) => !roster.has(a.person_id))) return no('not_in_slot', 'not_in_slot', role);
      if (!att.some((a) => a.present)) return no('no_attendees', 'no_attendees', role);
      const ratings = cleanRatings(input.ratings);
      const self = input.self_ratings == null ? null : cleanRatings(input.self_ratings);
      if (!ratings || (input.self_ratings != null && !self)) return no('invalid_ratings', 'invalid_ratings', role);
      const texts = [input.strengths ?? '', input.improvements ?? '', input.critique ?? ''].map((x) => String(x).trim());
      if (texts.some((x) => x.length > DEBRIEF_TEXT_MAX)) return no('invalid', 'invalid_debrief_text', role);
      const issue = contentIssue(texts);
      if (issue) return no(issue, issue, role);
      const lang = input.lang === 'ar' ? 'ar' : 'en';
      const ordered = [...att].sort((x, y) => (x.person_id < y.person_id ? -1 : 1));
      const members = ordered.map((a) => ({ id: debriefMemberId(id, a.person_id), person_id: a.person_id, position: roster.get(a.person_id)!, present: a.present }));
      const header = { id, slot_id: slot!.id, scenario_id: s.id, cycle_id: cycle?.id ?? null, crew: String(slot!.crew), held_on: heldOn, ratings };
      const statements = debriefStatements(header, members);
      let evidence = 0;
      for (const m of members) {
        const ev = m.present ? debriefEvidence(m.id, m.person_id, ratings, heldOn, who, s.title_en) : [];
        for (const e of ev) {
          if (b.rawGet('skill_evidence', e.id)) b.rawUpdate('skill_evidence', e.id, { level: e.level, observed_on: e.observed_on, active: true } as never);
          else b.rawInsert('skill_evidence', { ...e, created_at: nowTs() } as never);
        }
        evidence += ev.length;
        b.rawInsert('crew_debrief_members' as never, { id: m.id, debrief_id: id, person_id: m.person_id, crew: header.crew, position: m.position, present: m.present, scenario_id: s.id, held_on: heldOn, evidence_ids: ev.map((e) => e.id) } as never);
      }
      // F30 hand-off: the xAPI-shaped statements stay on the debrief (crew_debriefs.xapi); the learning record store's
      // f28_simulator emitter (W4 · E4) stores them from the debrief and its member rows.
      const present = members.filter((m) => m.present).length;
      b.rawInsert('crew_debriefs' as never, {
        ...header, simulator: String(slot!.simulator), instructor_person_id: who, self_ratings: self,
        [`strengths_${lang}`]: texts[0] || null, [`improvements_${lang}`]: texts[1] || null, [`critique_${lang}`]: texts[2] || null,
        present_count: present, absent_count: members.length - present, evidence_count: evidence, xapi: statements, recorded_at: nowTs(), source: 'kafaa',
      } as never);
      b.rawUpdate('sim_scenarios' as never, s.id, { last_run_on: !s.last_run_on || s.last_run_on < heldOn ? heldOn : s.last_run_on, run_count: Number(s.run_count ?? 0) + 1 } as never);
      for (const m of members) if (m.present) await applySkills(b, m.person_id, todayIso());
      for (const m of members) if (m.present) notify(m.person_id, `Simulator debrief recorded: ${s.title_en}`, `سُجّل استخلاص جلسة المحاكي: ${s.title_ar}`, '/my/simulator', 'info');
      return h.done<R>('sim.debrief', 'crew_debriefs', id, `crew ${header.crew}; ${present} present, ${members.length - present} absent; ${evidence} evidence rows`, role, 'kafaa.sim.debrief',
        `Crew ${header.crew} debrief for ${s.code} on ${heldOn} (${present} present)`, 'Debrief recorded; crew skills evidence updated',
        { id, present, absent: members.length - present, evidence, statements: statements.length },
        ['crew_debriefs', 'crew_debrief_members', 'sim_scenarios', 'skill_evidence', 'person_skills', 'notifications']);
    },

    async simDebriefs() {
      await b.whenReady();
      const who = me();
      if (!who) return [];
      const ctx = acc();
      const all = ctx.has('sat', ['R', 'W', 'A']);
      const mem = b.raw('crew_debrief_members' as never) as Row[];
      const visible = new Set(all ? debriefs().map((d) => d.id) : mem.filter((m) => ctx.ruleRead('skills_profile', m.person_id, null, false)).map((m) => m.debrief_id));
      const sc = new Map((b.raw('sim_scenarios' as never) as Row[]).map((s) => [s.id, s]));
      return debriefs()
        .filter((d) => visible.has(d.id))
        .sort((x, y) => (x.held_on === y.held_on ? (x.id < y.id ? -1 : 1) : x.held_on < y.held_on ? 1 : -1))
        .map((d): SimDebriefView => {
          const s = sc.get(d.scenario_id) ?? {};
          const ms = mem.filter((m) => m.debrief_id === d.id).sort((x, y) => (x.id < y.id ? -1 : 1));
          return {
            id: d.id, slot_id: d.slot_id, scenario_id: d.scenario_id, cycle_id: d.cycle_id ?? null, crew: d.crew, simulator: d.simulator, held_on: String(d.held_on).slice(0, 10),
            instructor_person_id: d.instructor_person_id, ratings: d.ratings, self_ratings: d.self_ratings ?? null,
            strengths_en: d.strengths_en ?? null, strengths_ar: d.strengths_ar ?? null, improvements_en: d.improvements_en ?? null, improvements_ar: d.improvements_ar ?? null,
            critique_en: d.critique_en ?? null, critique_ar: d.critique_ar ?? null,
            scenario: { id: d.scenario_id, code: s.code ?? '', title_en: s.title_en ?? '', title_ar: s.title_ar ?? '', category: s.category ?? '' },
            members: ms.map((m) => ({ person_id: m.person_id, position: m.position, present: !!m.present, evidence: (m.evidence_ids ?? []).length })),
            source: d.source === 'import' ? 'import' : 'kafaa',
            mine: ms.some((m) => m.person_id === who),
          };
        });
    },
  };
}
