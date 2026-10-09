/** F28 Simulator scenario library and coverage (W4 · E3): every acceptance criterion on the local path, the rules, RBAC, the
 *  seed and i18n. The SQL path (SQL = TS parity, RLS) is checked by scripts/validate/w4e3-simulator.mjs (PGlite). */
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { lintRanked } from '../../src/domain/engines';
import { hasKey } from '../../src/i18n';
import {
  CATEGORY_TEXT, DIMENSIONS, SIM_CATEGORIES, SIM_MSG, contentIssue, crewRoster, cycleCoverage, debriefEvidence, debriefStatements, evidenceLevel, gapCount, slotCheck,
  suggestScenarios, validatePlan, validateScenario, type CycleLite, type ScenarioInput, type ScenarioLite,
} from '../../src/modules/m04/scenarios';
import seed from '../../src/seed/seed.json';

const T = (seed as unknown as { tables: Record<string, any[]> }).tables;
let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});
const audits = (action: string, outcome?: string) => b.raw('audit_events').filter((a) => a.action === action && (!outcome || a.outcome === outcome));
const objectives = new Map(T.sim_objectives.map((o) => [o.id, o]));
const comps = new Set(T.competencies.map((c) => c.id));
const scMap = new Map(T.sim_scenarios.map((s) => [s.id, s as ScenarioLite]));
const base: ScenarioInput = {
  purpose: 'training', title_en: 'Loss of instrument air to one header', title_ar: 'فقدان هواء الأجهزة لأحد الخطوط', summary_en: 'The crew responds to a loss of instrument air and protects affected valves.',
  summary_ar: 'يستجيب الطاقم لفقدان هواء الأجهزة ويحمي الصمامات المتأثرة.', category: 'abnormal', objective_ids: ['so-a1', 'so-t3'], positions: ['ss', 'sro', 'ro'], duration_min: 90, fidelity: 'full_scope', programmes: ['coct'],
};
/** A booked crew-B slot that ran yesterday (the seeded future slots have not started yet). */
const pastSlot = (crew = 'B', id = 'sim-test-b') => {
  const d = new Date(Date.now() - 86_400_000);
  b.rawInsert('simulator_slots', { id, simulator: 'FSS-1', starts_at: d.toISOString().replace(/\.\d{3}Z$/, 'Z'), ends_at: new Date(d.getTime() + 8 * 3_600_000).toISOString(), crew, session_id: null, booking_kind: 'coct', priority: 1, status: 'booked', booked_by: 'p-k-instructor' } as never);
  return id;
};
const ratings = { communication: 4, procedure_use: 3, diagnosis: 2, leadership: 5 };

describe('F28 seed', () => {
  it('a sourced objective catalogue and a library in every status, all training scenarios that pass the content check', () => {
    expect(T.sim_objectives.length).toBeGreaterThanOrEqual(25);
    expect(T.sim_objectives.every((o) => o.sources.some((s: any) => s.url.startsWith('https://')))).toBe(true);
    expect(new Set(T.sim_scenarios.map((s) => s.status))).toEqual(new Set(['draft', 'in_review', 'approved', 'retired']));
    expect(T.sim_scenarios.every((s) => s.purpose === 'training')).toBe(true);
    for (const s of T.sim_scenarios) {
      expect(contentIssue([s.title_en, s.title_ar, s.summary_en, s.summary_ar, s.events_en, s.events_ar]), s.id).toBeNull();
      expect(validateScenario({ ...s, purpose: 'training' } as ScenarioInput, { objectives, competencies: comps }).ok, s.id).toBe(true);
    }
  });
  it('imported debrief history carries no skills evidence, so earlier waves keep their seeded skill states', () => {
    expect(T.crew_debriefs.length).toBeGreaterThanOrEqual(100);
    expect(T.crew_debriefs.every((d) => d.source === 'import' && d.evidence_count === 0)).toBe(true);
    expect(T.skill_evidence.some((e) => e.ref_table === 'crew_debrief_members')).toBe(false);
    for (const d of T.crew_debriefs.slice(0, 20)) expect(contentIssue([d.strengths_en, d.strengths_ar, d.improvements_en, d.improvements_ar, d.critique_en, d.critique_ar])).toBeNull();
  });
  it('every debrief member was in the crew booked in its slot', () => {
    const slots = new Map(T.simulator_slots.map((s) => [s.id, s]));
    const deb = new Map(T.crew_debriefs.map((d) => [d.id, d]));
    for (const m of T.crew_debrief_members) {
      const slot = slots.get(deb.get(m.debrief_id)!.slot_id)!;
      expect(crewRoster(slot, T.people).some((r) => r.person_id === m.person_id), m.id).toBe(true);
    }
  });
});

describe('F28 rules', () => {
  it('A1 rule: purpose = exam is refused (exam_content), and exam wording in any text too', () => {
    const ctx = { objectives, competencies: comps };
    expect(validateScenario({ ...base, purpose: 'exam' }, ctx)).toMatchObject({ ok: false, code: 'exam_content' });
    expect(validateScenario({ ...base, title_en: 'NRC exam: loss of air' }, ctx)).toMatchObject({ ok: false, code: 'exam_content' });
    expect(validateScenario({ ...base, summary_ar: 'سيناريو امتحان الترخيص للطاقم على المحاكي.' }, ctx)).toMatchObject({ ok: false, code: 'exam_content' });
    expect(validateScenario({ ...base, purpose: 'assessment' }, ctx)).toMatchObject({ ok: false, code: 'invalid', key: 'invalid_purpose' });
  });
  it('A4 rule: no security content and malfunctions stay generic (tags, setpoints, malfunction codes)', () => {
    expect(contentIssue(['Respond to an intruder at the perimeter'])).toBe('security_content');
    expect(contentIssue(['سيناريو أمني للطاقم'])).toBe('security_content');
    expect(contentIssue(['Fail transmitter 1RC-PT-0455 low'])).toBe('specific_content');
    expect(contentIssue(['Pressure falls to 1500 psig'])).toBe('specific_content');
    expect(contentIssue(['Insert MF-RCS01'])).toBe('specific_content');
    expect(contentIssue(['APR-1400 reactor coolant system at 100% power', 'FANR-REG-16'])).toBeNull();
    expect(validateScenario({ ...base, competency_ids: ['sa-01'] }, { objectives, competencies: comps })).toMatchObject({ ok: false, code: 'security_content' });
  });
  it('the validator normalises lists (positions in crew order, programmes and competencies sorted, objective competencies added)', () => {
    const v = validateScenario({ ...base, positions: ['ro', 'ss', 'ro'], programmes: ['loct', 'coct'], competency_ids: ['hu-01'] }, { objectives, competencies: comps });
    expect(v.ok && v.value).toMatchObject({ positions: ['ss', 'ro'], programmes: ['coct', 'loct'], competency_ids: ['hu-01', 'pf-03'] });
    for (const bad of [{ duration_min: 95 }, { objective_ids: [] }, { positions: [] }, { fidelity: 'vr' }, { category: 'drill' }, { title_en: 'x' }]) {
      expect(validateScenario({ ...base, ...bad } as ScenarioInput, { objectives, competencies: comps }).ok).toBe(false);
    }
  });
  it('A2 rule: the coverage matrix flags required objectives not covered in the cycle', () => {
    const c = T.sim_cycles.find((x) => x.id === 'cyc-coct-2025-26') as CycleLite;
    const cov = cycleCoverage(c, T.sim_cycle_items, scMap, T.crew_debriefs);
    expect(cov.rows.filter((r) => r.status !== 'covered').map((r) => r.objective_id)).toEqual(['so-e6', 'so-s3']);
    expect(gapCount(cov)).toBe(2);
    expect(cov.runs).toBe(T.crew_debriefs.length);
    // remove the only planned SGTR runs: SO-E3 (min 2) becomes missing; a single run makes it under-covered
    const noSgtr = T.sim_cycle_items.filter((i) => i.scenario_id !== 'scn-013');
    const cov2 = cycleCoverage(c, noSgtr, scMap);
    expect(cov2.rows.find((r) => r.objective_id === 'so-e3')!.status).toBe('missing');
    const one = [...noSgtr, { cycle_id: c.id, scenario_id: 'scn-013', segment: 2, active: true }];
    expect(cycleCoverage(c, one, scMap).rows.find((r) => r.objective_id === 'so-e3')).toMatchObject({ status: 'under', planned: 1, min_runs: 2 });
    // competencies and categories
    const empty = cycleCoverage(c, [], scMap);
    expect(empty.competencies.every((x) => x.status === 'missing')).toBe(true);
    expect(empty.missing_categories).toEqual([...SIM_CATEGORIES]);
  });
  it('suggestions rank approved scenarios that close gaps, each with reasons (F02 lint)', () => {
    const c = T.sim_cycles.find((x) => x.id === 'cyc-coct-2027-28') as CycleLite;
    const cov = cycleCoverage(c, T.sim_cycle_items, scMap);
    const comp = (id: string) => ({ en: id, ar: id });
    const list = suggestScenarios(c, cov, T.sim_scenarios as ScenarioLite[], objectives as never, comp);
    expect(list.length).toBeGreaterThan(3);
    expect(lintRanked(list)).toEqual([]);
    expect(list.every((r) => r.item!.status === 'approved' && r.item!.programmes.includes('coct'))).toBe(true);
    expect(list.some((r) => r.id === 'scn-016')).toBe(false); // the ATWS scenario is still in review
    for (const r of list) for (const x of r.reasons) expect(hasKey(x.key), x.key).toBe(true);
    expect(list[0].score).toBeGreaterThanOrEqual(list[list.length - 1].score);
  });
  it('plans: only approved scenarios of the programme, segments in range, no duplicates, at most 16 hours per segment', () => {
    const c = T.sim_cycles.find((x) => x.id === 'cyc-coct-2027-28') as CycleLite;
    expect(validatePlan([{ scenario_id: 'scn-016', segment: 1 }], c, scMap)).toMatchObject({ code: 'scenario_not_approved' });
    expect(validatePlan([{ scenario_id: 'scn-020', segment: 1 }], c, scMap)).toMatchObject({ code: 'wrong_programme' });
    expect(validatePlan([{ scenario_id: 'scn-012', segment: 9 }], c, scMap)).toMatchObject({ code: 'invalid' });
    expect(validatePlan([{ scenario_id: 'scn-012', segment: 1 }, { scenario_id: 'scn-012', segment: 1 }], c, scMap)).toMatchObject({ code: 'duplicate' });
    expect(validatePlan(['scn-001', 'scn-015', 'scn-018', 'scn-012', 'scn-013'].map((s) => ({ scenario_id: s, segment: 2 })), c, scMap)).toMatchObject({ code: 'over_capacity' });
  });
  it('A3 rule: evidence only at or above standard, level 2-3, ojt / evidenced, never verified; statements one per present member', () => {
    expect([1, 2, 3, 4, 5].map(evidenceLevel)).toEqual([0, 0, 2, 3, 3]);
    const ev = debriefEvidence('cd:x:y:p-sro', 'p-sro', ratings, '2026-10-01', 'p-k-instructor', 'Test');
    expect(ev.map((e) => e.skill_id)).toEqual(['sk-co-01', 'sk-co-02', 'sk-ld-01']);
    expect(ev.every((e) => e.kind === 'ojt' && e.basis === 'evidenced' && e.level <= 3)).toBe(true);
    const st = debriefStatements({ id: 'cd:x:y', slot_id: 'x', scenario_id: 'y', crew: 'B', held_on: '2026-10-01', ratings }, [{ person_id: 'a', position: 'ro', present: true }, { person_id: 'b', position: 'lo', present: false }]);
    expect(st).toHaveLength(1);
    expect(st[0]).toMatchObject({ actor_person_id: 'a', object_type: 'scenario', result: { score: { scaled: 0.7 }, success: true } });
    expect(JSON.stringify(st)).not.toMatch(/strengths|critique|display_name/);
    expect(slotCheck(undefined, '2026-10-01')).toBe('slot_not_found');
    expect(slotCheck({ id: 'x', crew: 'B', booking_kind: 'free', status: 'free', starts_at: '2026-01-01T00:00:00Z' }, '2026-10-01')).toBe('slot_not_booked');
    expect(slotCheck({ id: 'x', crew: 'B', booking_kind: 'coct', status: 'booked', starts_at: '2027-01-01T00:00:00Z' }, '2026-10-01')).toBe('slot_not_started');
  });
});

describe('F28 local RPCs', () => {
  it('A1: creating a scenario with purpose = exam is refused with exam_content (audited)', async () => {
    await as('k-instructor');
    const n = audits('sim.scenario.save', 'refused').length;
    const r = await b.rpc.saveSimScenario({ ...base, purpose: 'exam' });
    expect(r).toMatchObject({ ok: false, code: 'exam_content', message: SIM_MSG.exam_content });
    expect(audits('sim.scenario.save', 'refused').length).toBe(n + 1);
    expect(b.raw('sim_scenarios').some((s) => s.title_en === base.title_en)).toBe(false);
  });
  it('RBAC: instructors write, the training manager approves (never their own revision); managers, auditors and employees cannot write', async () => {
    for (const p of ['sro', 'k-auditor', 'k-ro', 'chco']) {
      await as(p);
      expect((await b.rpc.saveSimScenario(base)).code, p).toBe('forbidden');
    }
    await as('k-instructor');
    const c = await b.rpc.saveSimScenario({ ...base, submit: true });
    expect(c).toMatchObject({ ok: true, data: { status: 'in_review', revision: 1 } });
    expect((await b.rpc.reviewSimScenario(c.data!.id, 'approve')).code).toBe('forbidden');
    await as('training-mgr');
    expect(await b.rpc.reviewSimScenario(c.data!.id, 'approve')).toMatchObject({ ok: true, data: { status: 'approved' } });
    const rev = await b.rpc.saveSimScenario({ ...base, id: c.data!.id, summary_en: `${base.summary_en} Revised.`, submit: true });
    expect(rev.data).toMatchObject({ revision: 2, status: 'in_review' });
    expect((await b.rpc.reviewSimScenario(c.data!.id, 'approve')).code).toBe('maker_checker');
    expect((await b.rpc.reviewSimScenario(c.data!.id, 'return', 'short')).code).toBe('invalid');
    expect((await b.rpc.reviewSimScenario('scn-023', 'approve')).code).toBe('retired');
    expect(b.raw('ledger_local').some((l: any) => l.action === 'kafaa.sim.scenario.approve')).toBe(true);
  });
  it('the library is for training staff: an employee reads no scenario, a line manager does', async () => {
    await as('k-ro');
    expect(await b.list('sim_scenarios')).toHaveLength(0);
    await as('sro');
    expect((await b.list('sim_scenarios')).length).toBe(T.sim_scenarios.length);
    expect(await b.list('crew_debriefs')).toHaveLength(0);
  });
  it('A2: planCycle stores the plan and returns the gap count; approval with gaps needs a reason and another person', async () => {
    await as('k-instructor');
    const p = await b.rpc.planCycle('cyc-coct-2027-28', [{ scenario_id: 'scn-012', segment: 1 }, { scenario_id: 'scn-013', segment: 2 }], true);
    expect(p).toMatchObject({ ok: true, data: { status: 'submitted', items: 2 } });
    expect(p.data!.gaps).toBeGreaterThan(10);
    expect(b.raw('sim_cycle_items').filter((i) => i.cycle_id === 'cyc-coct-2027-28' && !i.active).map((i) => i.id).sort()).toEqual(['sci:cyc-coct-2027-28:scn-004:1', 'sci:cyc-coct-2027-28:scn-001:2'].sort());
    expect((await b.rpc.planCycle('cyc-coct-2027-28', [{ scenario_id: 'scn-016', segment: 1 }])).code).toBe('scenario_not_approved');
    await as('training-mgr');
    expect((await b.rpc.approveCycle('cyc-coct-2027-28')).code).toBe('coverage_gaps');
    expect(await b.rpc.approveCycle('cyc-coct-2027-28', 'Remaining segments are planned next quarter.')).toMatchObject({ ok: true, data: { status: 'approved' } });
    expect(await b.rpc.approveCycle('cyc-loct-2026-27')).toMatchObject({ ok: true, data: { gaps: 0 } });
    await b.rpc.planCycle('cyc-coct-2025-26', T.sim_cycle_items.filter((i) => i.cycle_id === 'cyc-coct-2025-26').map((i) => ({ scenario_id: i.scenario_id, segment: i.segment })), true);
    expect((await b.rpc.approveCycle('cyc-coct-2025-26', 'Reason long enough.')).code).toBe('maker_checker');
  });
  it('A3: a debrief writes evidence only for crew members present in the booked slot', async () => {
    const slot = pastSlot();
    await as('k-instructor');
    const roster = crewRoster(b.rawGet('simulator_slots', slot) as never, b.raw('people') as never);
    expect(roster.map((r) => r.person_id)).toContain('p-k-ro');
    const att = roster.map((r) => ({ person_id: r.person_id, present: r.person_id !== 'w-lo-07' }));
    const input = { slot_id: slot, scenario_id: 'scn-012', attendance: att, ratings, self_ratings: { communication: 5, procedure_use: 4, diagnosis: 3, leadership: 4 }, critique: 'We rushed the first diagnosis.' };
    expect((await b.rpc.recordDebrief({ ...input, attendance: [...att, { person_id: 'w-ro-03', present: true }] })).code).toBe('not_in_slot');
    expect((await b.rpc.recordDebrief({ ...input, attendance: att.map((a) => ({ ...a, present: false })) })).code).toBe('no_attendees');
    expect((await b.rpc.recordDebrief({ ...input, critique: 'Like the licensing exam' })).code).toBe('exam_content');
    expect((await b.rpc.recordDebrief({ ...input, scenario_id: 'scn-016' })).code).toBe('scenario_not_approved');
    const r = await b.rpc.recordDebrief(input);
    expect(r).toMatchObject({ ok: true, data: { present: roster.length - 1, absent: 1, statements: roster.length - 1 } });
    const ev = b.raw('skill_evidence').filter((e) => e.ref_table === 'crew_debrief_members' && e.ref_id.startsWith(r.data!.id));
    expect(ev.length).toBe(r.data!.evidence);
    expect(ev.length).toBe((roster.length - 1) * 3);
    expect(ev.some((e) => e.person_id === 'w-lo-07')).toBe(false);
    expect(ev.every((e) => e.kind === 'ojt' && e.basis === 'evidenced' && e.active)).toBe(true);
    expect(ev.some((e) => e.skill_id === 'sk-pf-03')).toBe(false); // diagnosis rated 2: below standard, no evidence
    const st = b.raw('person_skills').find((s) => s.person_id === 'p-k-ro' && s.skill_id === 'sk-ld-01')!;
    expect(st.reasons.some((x: any) => x.code === 'ojt' && x.evidence_id.startsWith(`se:ojt:${r.data!.id}`))).toBe(true);
    expect(b.raw('person_skills').filter((s) => s.person_id === 'w-lo-07').every((s) => !s.reasons.some((x: any) => String(x.evidence_id).includes(r.data!.id)))).toBe(true);
    const members = b.raw('crew_debrief_members').filter((m) => m.debrief_id === r.data!.id);
    expect(members.find((m) => m.person_id === 'w-lo-07')).toMatchObject({ present: false, evidence_ids: [] });
    expect((b.rawGet('crew_debriefs', r.data!.id) as any).source).toBe('kafaa');
    expect(b.raw('notifications').some((n) => n.person_id === 'p-k-ro' && n.kind === 'simulator')).toBe(true);
    expect(audits('sim.debrief', 'ok')).toHaveLength(1); // ledger row written for NEXUS role cards; skipped for this Kafa'a-only instructor
    expect(audits('sim.debrief', 'ok')[0].ledger_status).toBe('skipped');
    expect((await b.rpc.recordDebrief(input)).code).toBe('already_recorded');
  });
  it('A3: a future or free slot, a manager, or ratings out of range are refused', async () => {
    await as('k-instructor');
    const next = new Date(Date.now() + 2 * 86_400_000).toISOString();
    b.rawInsert('simulator_slots', { id: 'sim-test-next', simulator: 'FSS-2', starts_at: next, ends_at: next, crew: 'B', session_id: null, booking_kind: 'coct', priority: 1, status: 'booked', booked_by: 'p-k-instructor' } as never);
    expect((await b.rpc.recordDebrief({ slot_id: 'sim-test-next', scenario_id: 'scn-012', attendance: [], ratings })).code).toBe('slot_not_started');
    const free = T.simulator_slots.find((s) => s.booking_kind === 'free')!;
    expect((await b.rpc.recordDebrief({ slot_id: free.id, scenario_id: 'scn-012', attendance: [], ratings })).code).toBe('slot_not_booked');
    const slot = pastSlot();
    expect((await b.rpc.recordDebrief({ slot_id: slot, scenario_id: 'scn-012', attendance: [{ person_id: 'p-sro', present: true }], ratings: { ...ratings, diagnosis: 6 } })).code).toBe('invalid_ratings');
    await as('sro');
    expect((await b.rpc.recordDebrief({ slot_id: slot, scenario_id: 'scn-012', attendance: [{ person_id: 'p-sro', present: true }], ratings })).code).toBe('forbidden');
  });
  it('crews read their own debriefs, managers their crew, instructors all, HR none', async () => {
    await as('k-ro');
    const mine = await b.rpc.simDebriefs();
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((d) => d.mine && d.crew === 'B')).toBe(true);
    expect((await b.list('crew_debrief_members')).every((m) => m.person_id === 'p-k-ro')).toBe(true);
    await as('sro');
    const crew = await b.rpc.simDebriefs();
    expect(crew.every((d) => d.crew === 'B')).toBe(true);
    expect((await b.list('crew_debrief_members')).every((m) => m.crew === 'B')).toBe(true);
    await as('k-instructor');
    expect((await b.rpc.simDebriefs()).length).toBe(T.crew_debriefs.length);
    await as('chco');
    expect(await b.rpc.simDebriefs()).toHaveLength(0);
  });
});

describe('F28 i18n', () => {
  it('every label, reason and message key exists in both languages', () => {
    for (const d of DIMENSIONS) expect(hasKey(`m04.scn.dim.${d}`)).toBe(true);
    for (const c of [...SIM_CATEGORIES, 'team']) expect(hasKey(`m04.scn.cat.${c}`)).toBe(true);
    for (const k of ['scn_missing', 'scn_under', 'scn_comp', 'scn_category', 'scn_duration']) expect(hasKey(`m04.reasons.${k}`)).toBe(true);
    for (const r of ['training-sim-scenarios', 'training-sim-scenario', 'my-simulator']) expect(hasKey(`m04.routes.${r}.title`)).toBe(true);
    expect(Object.values(CATEGORY_TEXT).every((x) => x.en && x.ar)).toBe(true);
  });
});
