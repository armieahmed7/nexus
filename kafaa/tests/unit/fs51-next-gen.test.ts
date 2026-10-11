/** FS38 SMR delta overlay + FS39 plant literacy and reference-plant log + FS40 digital-twin drills (FS wave E · E1, M31): one named test
 *  per acceptance criterion on the local path, plus the shared rules, RBAC, the seed and i18n. The SQL path (kafaa_smr_needs /
 *  kafaa_smr_readiness / kafaa_smr_matrix_core = needsFor / readinessOf / matrixStats, kafaa_smr_problem, kafaa_pv_problem / level /
 *  hosts, kafaa_tw_score = scoreTwinDrill on every seeded attempt plus 400 generated submissions, RLS, live RPC flows, grants) is proved
 *  by scripts/validate/fs51-next-gen.mjs (PGlite). The offline explainer test is in tests/unit/fs51-pages.test.tsx. */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { applySkills } from '../../src/data/local/rpc.w0';
import en from '../../src/i18n/m31.en.json';
import ar from '../../src/i18n/m31.ar.json';
import seed from '../../src/seed/seed.json';
import { routes } from '../../src/modules/m31/routes';
import { publicTextIsClean } from '../../src/domain/future';
import * as RP from '../../src/modules/m01/roleProfiles';
import { CONTACT_PATTERN as RESERVE_CONTACT } from '../../src/modules/m20/reserve';
import { RECORDED_REF_TABLES } from '../../src/domain/skills';
import { todayIso } from '../../src/domain/rules';
import { DEPLOYMENT_CLAIM, AR_UNCLEAN, HEADCOUNT_OR_SITE, DIMENSIONS, changeSize, deltaFor, deltaProblem, matrixStats, needsFor, readinessOf, sizeBand, textIsClean, type DeltaRow, type ProfileReq } from '../../src/modules/m31/nextgen';
import { CONTACT_PATTERN, L2_HOURS, VISIT_SKILL, eligibleHosts, logSummary, visitLevel, visitProblem } from '../../src/modules/m31/literacy';
import { SCENARIOS, quizScore, stepAt } from '../../src/modules/m31/plantModel';
import { LEVEL2_PCT, TWIN_EVIDENCE_CAP, TWIN_SKILLS, scoreTwinDrill, twinProblem, twinStats, twinSubProblem, type TwinKey } from '../../src/modules/m31/twin';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const T = (seed as unknown as { tables: Record<string, Row[]> }).tables;
const current = T.job_roles.filter((r) => (r.lifecycle ?? 'current') === 'current');
const pub = T.smr_deltas.filter((d) => d.status === 'published');
const famOf = (rid: string) => T.job_roles.find((r) => r.id === rid)?.family_id ?? null;
const skillsCtx = Object.fromEntries(T.skills.map((s) => [s.id, { area: s.area ?? null, lifecycle: s.lifecycle ?? null }]));
const refs = {
  microcred: T.microcred_defs.filter((m) => m.status === 'current').map((m) => m.code as string), course: T.courses.map((c) => c.id as string),
  pathway: T.pathways.filter((p) => p.status === 'published').map((p) => p.id as string), lane: T.horizon_lanes.map((l) => l.id as string),
};
const profile2035 = (rid: string) => T.role_profile_versions.filter((v) => v.role_id === rid && v.horizon === '2035' && v.status === 'published').sort((a, b) => b.version - a.version)[0]?.requirements as ProfileReq[] | undefined;
const keyOf = (id: string): TwinKey => { const k = T.twin_keys.find((x) => x.scenario_id === id)!; return { ...k } as TwinKey; };
const RESEARCH = readFileSync('../docs/kafaa/ref/research/nuclear_energy.md', 'utf8');

let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
const raw = (t: string) => b.raw(t as never) as unknown as Row[];
beforeAll(async () => { b = new LocalBackend(); await b.whenReady(); await b.reset(); }, 120000);

describe('FS38 · acceptance', () => {
  it('acceptance 1: all 28 current roles have a published delta for at least their 3 most relevant technology families (never a concept role)', () => {
    expect(current).toHaveLength(28);
    for (const r of current) {
      const mine = pub.filter((d) => d.role_id === r.id).sort((a, b2) => a.rank - b2.rank);
      expect(mine.length, r.id).toBeGreaterThanOrEqual(3);
      expect(mine.slice(0, 3).map((d) => d.rank)).toEqual([1, 2, 3]);
    }
    expect(T.smr_deltas.every((d) => current.some((r) => r.id === d.role_id))).toBe(true);
    expect(new Set(pub.map((d) => d.tech_id)).size).toBe(6);
  });
  it('acceptance 2: every delta cites at least 2 https sources with as-of dates, all from the research packs', () => {
    for (const d of T.smr_deltas) {
      expect(d.sources.length, d.id).toBeGreaterThanOrEqual(2);
      for (const s of d.sources) { expect(s.url).toMatch(/^https:\/\//); expect(s.as_of).toMatch(/^\d{4}-\d{2}-\d{2}$/); expect(RESEARCH.includes(s.url), s.url).toBe(true); }
    }
  });
  it('acceptance 3: publicTextIsClean passes on every delta (EN and AR) and every delta says "no deployment decision implied"', () => {
    for (const d of T.smr_deltas) {
      const texts = [d.changes_en, d.changes_ar, d.stays_en, d.stays_ar, ...d.dims.flatMap((x: Row) => [x.text_en, x.text_ar])];
      expect(publicTextIsClean(texts), d.id).toBe(true);
      expect(textIsClean(texts), d.id).toBe(true);
      expect(d.changes_en).toMatch(/no deployment decision implied/i);
    }
    expect(en.ng.noDeploy).toMatch(/no deployment decision is implied/);
  });
});

describe('FS38 · rules', () => {
  it('the clean-text patterns are the FS05 ones (profileTextIsClean, SQL kafaa_rpv_text_clean): same regexes, same verdicts', () => {
    expect(HEADCOUNT_OR_SITE.source).toBe(RP.HEADCOUNT_OR_SITE.source);
    expect(DEPLOYMENT_CLAIM.source).toBe(RP.DEPLOYMENT_CLAIM.source);
    expect(AR_UNCLEAN.source).toBe(RP.AR_UNCLEAN.source);
    for (const s of ['We will need 40 operators.', 'The units will be built soon.', 'سيتم بناء الوحدات', 'Planning assumption; no deployment decision implied.']) expect(textIsClean([s])).toBe(RP.profileTextIsClean([s]));
  });
  it('deltaFor: the delta skills come first, 2035 smr_design skills join (the higher level wins), readiness rounds half up, gaps drive training', () => {
    const d = { id: 'x', role_id: 'r', tech_id: 't', rank: 1, path_only: false, dims: [{ dim: 'passive_safety', change: 'new', text_en: 'a', text_ar: 'b' }, { dim: 'digital_ic', change: 'adapts', text_en: 'a', text_ar: 'b' }],
      skills: [{ skill_id: 'a', level: 2 }, { skill_id: 'b', level: 1 }], training: [{ kind: 'course', ref: 'c1' }] } as DeltaRow;
    const prof: ProfileReq[] = [{ kind: 'skill', ref_id: 'b', level: 3, driver: 'smr_design' }, { kind: 'skill', ref_id: 'c', level: 1, driver: 'smr_design' }, { kind: 'skill', ref_id: 'z', level: 4, driver: 'ai_assistance' }];
    expect(needsFor(d, prof)).toEqual([{ skill_id: 'a', need: 2, source: 'delta' }, { skill_id: 'b', need: 3, source: 'both' }, { skill_id: 'c', need: 1, source: 'profile' }]);
    const v = deltaFor(d, prof, [{ skill_id: 'a', level: 2 }, { skill_id: 'b', level: 1 }], { 'course:c1': ['b', 'q'] });
    expect(v.readiness).toBe(50); // min(have, need): a 2, b 1, c 0 = 3 of 6
    expect(v.change_size).toBe(3);
    expect(v.band).toBe('small');
    expect(v.dims.map((x) => x.change)).toEqual(DIMENSIONS.map((x) => (x === 'passive_safety' ? 'new' : x === 'digital_ic' ? 'adapts' : 'same')));
    expect(v.training[0].closes).toEqual(['b']);
    expect(v.reasons.map((r) => r.code)).toEqual(['fs38_change', 'fs38_dims', 'fs38_profile', 'fs38_gap', 'fs38_ready']);
    expect(readinessOf([{ skill_id: 'a', need: 3 }], [{ skill_id: 'a', level: 1 }]).pct).toBe(33);
    expect(readinessOf([{ skill_id: 'a', need: 2 }], [{ skill_id: 'a', level: 1 }]).pct).toBe(50);
    expect(sizeBand(changeSize([{ dim: 'systems', change: 'new', text_en: '', text_ar: '' }, { dim: 'delivery', change: 'new', text_en: '', text_ar: '' }, { dim: 'maintenance', change: 'new', text_en: '', text_ar: '' }]))).toBe('moderate');
    const po = deltaFor({ ...d, path_only: true, skills: [] }, prof, [], {});
    expect(po.readiness).toBeNull();
    expect(po.needs).toEqual([]);
    expect(po.reasons.map((r) => r.code)).toContain('fs38_path_only');
  });
  it('security, safeguards and cyber roles stay path-only: the seed has no skills for them and the edit check refuses any', () => {
    const sec = T.smr_deltas.filter((d) => ['security', 'safeguards', 'cyber'].includes(famOf(d.role_id)));
    expect(sec.length).toBeGreaterThanOrEqual(9);
    expect(sec.every((d) => d.path_only && d.skills.length === 0)).toBe(true);
    const one = sec[0];
    expect(deltaProblem({ ...one, skills: [{ skill_id: 'sk-fs-adv-smr', level: 1 }] } as never, { family: famOf(one.role_id), skills: skillsCtx, refs })).toBe('security');
    expect(deltaProblem({ ...one, path_only: false } as never, { family: famOf(one.role_id), skills: skillsCtx, refs })).toBe('security');
    expect(T.smr_deltas.every((d) => deltaProblem(d as never, { family: famOf(d.role_id), skills: skillsCtx, refs }) === null)).toBe(true);
  });
  it('the delta training links point at existing content only (MC-SMR-FOUND, FS19 courses, FS17 pathways, FS14 lanes)', () => {
    const all = T.smr_deltas.flatMap((d) => d.training as Row[]);
    expect(all.some((x) => x.kind === 'microcred' && x.ref === 'MC-SMR-FOUND')).toBe(true);
    for (const x of all) expect((refs as Record<string, string[]>)[x.kind]).toContain(x.ref);
    expect(new Set(all.map((x) => x.kind))).toEqual(new Set(['microcred', 'course', 'pathway', 'lane']));
  });
});

describe('FS38 · RBAC, edits and the HR matrix', () => {
  it('saveSmrDelta: framework owners only; an edit versions the row, publishing writes the ledger; unclean text, concept roles and security skills are refused', async () => {
    const edit = { ...T.smr_deltas.find((d) => d.id === 'smrd:quality-assurance-qc:tech-micro')! };
    for (const p of ['buyer', 'chco']) { await as(p); expect((await b.rpc.saveSmrDelta(edit as never)).code).toBe('forbidden'); }
    await as('training-mgr');
    const led0 = raw('ledger_local').length;
    const r = await b.rpc.saveSmrDelta({ ...edit, stays_en: 'NQA-1 discipline stays the same.' } as never);
    expect(r.ok).toBe(true);
    expect(r.data!.version).toBe(2);
    expect(raw('ledger_local').length).toBe(led0 + 1);
    expect(raw('audit_events').some((a) => a.action === 'smr.delta.save' && a.outcome === 'ok')).toBe(true);
    const bad = await b.rpc.saveSmrDelta({ ...edit, changes_en: 'Construction will start soon with 40 engineers.' } as never);
    expect(bad.code).toBe('invalid');
    expect((await b.rpc.saveSmrDelta({ ...edit, role_id: 'fr-bwr-operator' } as never)).code).toBe('not_found');
    const sec = T.smr_deltas.find((d) => d.id === 'smrd:security-officer:tech-bwr')!;
    expect((await b.rpc.saveSmrDelta({ ...sec, skills: [{ skill_id: 'sk-fs-adv-smr', level: 1 }] } as never)).message).toMatch(/path only/);
    await as('k-instructor');
    const draft = await b.rpc.saveSmrDelta({ ...edit, tech_id: 'tech-fast', rank: 4, status: 'draft' } as never);
    expect(draft.ok).toBe(true);
    await as('buyer');
    expect((await b.list('smr_deltas' as never, { filter: { id: 'smrd:quality-assurance-qc:tech-fast' } } as never)).length).toBe(0);
    await as(null);
    expect((await b.list('smr_deltas' as never)).length).toBe(pub.length);
  });
  it('nextGenMatrix: HR and admins only; it equals matrixStats() and every shown cell covers 10 people or more', async () => {
    await as('buyer');
    expect(await b.rpc.nextGenMatrix()).toBeNull();
    const c = new LocalBackend(); await c.whenReady(); await c.reset();
    c.setPersona('chco'); await c.whenReady();
    const m = (await c.rpc.nextGenMatrix())!;
    const states = new Map<string, Row[]>();
    for (const s of c.raw('person_skills' as never) as unknown as Row[]) if (s.active) (states.get(s.person_id) ?? states.set(s.person_id, []).get(s.person_id)!).push(s);
    const profiles = new Map<string, ProfileReq[]>();
    for (const r of current) { const p = profile2035(r.id); if (p) profiles.set(r.id, p); }
    const t = matrixStats(T.smr_deltas as never, T.people as never, states as never, profiles, T.adv_technologies.map((x) => x.id), 10);
    const { as_of, ready_pct_line, ...rest } = m;
    expect(as_of).toBe(todayIso());
    expect(ready_pct_line).toBe(50);
    expect(rest).toEqual(t);
    expect(m.techs.filter((x) => x.n !== null).length).toBeGreaterThan(0);
    expect([...m.techs, ...m.families].every((x) => x.n === null || x.n >= 10)).toBe(true);
  });
});

describe('FS39 · acceptance', () => {
  it('acceptance 2: confirmed visits write evidence; unconfirmed ones do not (seed and local flow)', async () => {
    const conf = T.plant_visits.filter((v) => v.status === 'confirmed');
    const ev = T.skill_evidence.filter((e) => e.ref_table === 'plant_visits');
    expect(conf.length).toBeGreaterThan(0);
    expect(ev.map((e) => e.ref_id).sort()).toEqual(conf.map((v) => v.id).sort());
    expect(ev.every((e) => e.kind === 'ojt' && e.basis === 'validated' && e.skill_id === VISIT_SKILL && e.level >= 1 && e.level <= 2)).toBe(true);
    const c = new LocalBackend(); await c.whenReady(); await c.reset();
    c.setPersona('buyer'); await c.whenReady();
    const v = await c.rpc.logVisit({ kind: 'simulator_observation', host_person_id: 'p-k-instructor', visit_on: todayIso(), hours: 3, note: 'Crew scenario observed.' });
    expect(v.ok).toBe(true);
    const evOf = (id: string) => (c.raw('skill_evidence' as never) as unknown as Row[]).filter((e) => e.ref_table === 'plant_visits' && e.ref_id === id);
    expect(evOf(v.data!.id)).toEqual([]);
    c.setPersona('k-instructor'); await c.whenReady();
    const ok = await c.rpc.confirmVisit({ visit_id: v.data!.id, decision: 'confirm' });
    expect(ok.ok).toBe(true);
    expect(evOf(v.data!.id).map((e) => [e.kind, e.basis, e.active])).toEqual([['ojt', 'validated', true]]);
    // declined and withdrawn visits never write evidence
    c.setPersona('buyer'); await c.whenReady();
    const v2 = await c.rpc.logVisit({ kind: 'reference_plant', host_person_id: 'p-k-instructor', visit_on: todayIso(), hours: 2 });
    const v3 = await c.rpc.logVisit({ kind: 'reference_plant', host_person_id: 'p-k-instructor', visit_on: todayIso(), hours: 2 });
    expect((await c.rpc.withdrawVisit(v3.data!.id)).ok).toBe(true);
    c.setPersona('k-instructor'); await c.whenReady();
    expect((await c.rpc.confirmVisit({ visit_id: v2.data!.id, decision: 'decline', reason: 'no' })).code).toBe('invalid');
    expect((await c.rpc.confirmVisit({ visit_id: v2.data!.id, decision: 'decline', reason: 'I did not host this one.' })).ok).toBe(true);
    expect((await c.rpc.confirmVisit({ visit_id: v3.data!.id, decision: 'confirm' })).code).toBe('invalid');
    expect([...evOf(v2.data!.id), ...evOf(v3.data!.id)]).toEqual([]);
    // recorded evidence survives an F01 recompute
    await applySkills(c, 'p-buyer', todayIso());
    expect(evOf(v.data!.id)[0].active).toBe(true);
  });
  it('acceptance 3: the explainer contains no real plant parameters: illustrative indices 0-100 only, no units, SIMULATED wording', () => {
    const units = /(°|\bdeg\b|celsius|kelvin|\bMPa\b|\bkPa\b|\bbar\b|\bpsi\b|kg\/s|\bMWe?\b|\bMWt\b|\bGW\b|\bppm\b|\brpm\b|\bm3\b|setpoint|set point)/i;
    for (const s of SCENARIOS) for (const st of s.steps) {
      for (const k of ['power', 'heat', 'steam', 'output'] as const) { expect(Number.isInteger(st.state[k])).toBe(true); expect(st.state[k]).toBeGreaterThanOrEqual(0); expect(st.state[k]).toBeLessThanOrEqual(100); }
      const text = JSON.stringify([st.title_en, st.body_en, st.question ?? null]);
      expect(units.test(text), `${s.id}/${st.id}`).toBe(false);
      expect(/[0-9]/.test(st.body_en.replace(/APR-1400/g, '')), `${s.id}/${st.id} has a number`).toBe(false);
    }
    expect(en.pl.simBody).toMatch(/never plant temperatures, pressures, setpoints or flows/);
    expect(SCENARIOS.length).toBe(4);
    expect(SCENARIOS.find((s) => s.id === 'passive')!.link).toBe('next_gen');
    expect(stepAt('heat-to-grid', 99).last).toBe(true);
    expect(quizScore({ 'heat-to-grid:core': 0, 'heat-to-grid:sg': 2 })).toEqual({ asked: 2, right: 1 });
  });
});

describe('FS39 · rules and maker-checker', () => {
  it('the host can never be the visitor; only the named host confirms; partners are refused', async () => {
    const c = new LocalBackend(); await c.whenReady(); await c.reset();
    c.setPersona('k-instructor'); await c.whenReady();
    expect((await c.rpc.logVisit({ kind: 'reference_plant', host_person_id: 'p-k-instructor', visit_on: todayIso(), hours: 2 })).code).toBe('maker_checker');
    c.setPersona('buyer'); await c.whenReady();
    expect((await c.rpc.plantHosts()).some((h) => h.person_id === 'p-buyer')).toBe(false);
    expect((await c.rpc.logVisit({ kind: 'reference_plant', host_person_id: 'p-nse', visit_on: todayIso(), hours: 2 })).code).toBe('invalid');
    const v = await c.rpc.logVisit({ kind: 'reference_plant', host_person_id: 'p-training-mgr', visit_on: todayIso(), hours: 2 });
    expect((await c.rpc.confirmVisit({ visit_id: v.data!.id, decision: 'confirm' })).code).toBe('maker_checker');
    c.setPersona('k-instructor'); await c.whenReady();
    expect((await c.rpc.confirmVisit({ visit_id: v.data!.id, decision: 'confirm' })).code).toBe('forbidden');
    c.setPersona('alnoor-gm'); await c.whenReady();
    expect((await c.rpc.logVisit({ kind: 'reference_plant', host_person_id: 'p-k-instructor', visit_on: todayIso(), hours: 2 })).code).toBe('forbidden');
    expect(T.plant_visits.every((x) => x.host_person_id !== x.person_id)).toBe(true);
  });
  it('visitProblem, visitLevel, eligibleHosts and logSummary', () => {
    const today = '2026-10-08';
    const v = { kind: 'reference_plant', host_person_id: 'p-x', visit_on: '2026-09-01', hours: 3, note: 'ok' };
    expect(visitProblem(v, today)).toBeNull();
    expect(visitProblem({ ...v, kind: 'tour' }, today)).toBe('kind');
    expect(visitProblem({ ...v, host_person_id: '' }, today)).toBe('host');
    expect(visitProblem({ ...v, visit_on: '2026-10-09' }, today)).toBe('date');
    expect(visitProblem({ ...v, visit_on: '2025-10-07' }, today)).toBe('date');
    expect(visitProblem({ ...v, hours: 0.75 }, today)).toBe('hours');
    expect(visitProblem({ ...v, hours: 12.5 }, today)).toBe('hours');
    expect(visitProblem({ ...v, note: 'call +971 50 123 4567' }, today)).toBe('note');
    expect(visitLevel([], { kind: 'reference_plant', hours: 12 })).toBe(1);
    expect(visitLevel([{ id: 'a', kind: 'simulator_observation', hours: 6 }], { kind: 'reference_plant', hours: 6 })).toBe(2);
    expect(visitLevel([{ id: 'a', kind: 'reference_plant', hours: 6 }], { kind: 'reference_plant', hours: 6 })).toBe(1);
    expect(CONTACT_PATTERN).toBe(RESERVE_CONTACT);
    const hosts = eligibleHosts(T.people as never, T.role_assignments as never, 'p-k-instructor');
    expect(hosts).not.toContain('p-k-instructor');
    expect(hosts.length).toBeGreaterThanOrEqual(10);
    const s = logSummary([{ person_id: 'p', kind: 'reference_plant', hours: 8, status: 'confirmed', visit_on: today }, { person_id: 'p', kind: 'simulator_observation', hours: 4, status: 'confirmed', visit_on: today }, { person_id: 'p', kind: 'reference_plant', hours: 2, status: 'logged', visit_on: today }]);
    expect(s).toMatchObject({ confirmed: 2, pending: 1, hours: 12, kinds: 2, level: 2, toL2: 0 });
    expect(L2_HOURS).toBe(12);
    const qc = T.plant_visits.filter((x) => x.person_id === 'p-qc-inspector' && x.status === 'confirmed');
    expect(qc.length).toBe(2);
    expect(Math.max(...qc.map((x) => x.level))).toBe(2);
  });
  it('RLS: only the visitor and the named host read a visit', async () => {
    await as('qc-inspector');
    expect((await b.list('plant_visits' as never)).length).toBe(T.plant_visits.filter((v) => v.person_id === 'p-qc-inspector' || v.host_person_id === 'p-qc-inspector').length);
    await as(null);
    expect((await b.list('plant_visits' as never)).length).toBe(0);
  });
});

describe('FS40 · acceptance', () => {
  it('acceptance 1: all series are synthetic and labelled SIMULATED (SYN-TW codes, EN and AR)', () => {
    expect(T.twin_scenarios.length).toBe(5);
    for (const s of T.twin_scenarios) {
      expect(s.synthetic).toBe(true);
      expect(s.code).toMatch(/^SYN-TW-\d{3}$/);
      expect(s.system_en).toMatch(/SIMULATED/);
      expect(s.system_ar).toMatch(/محاكاة/);
      expect(twinProblem({ ...s, key: keyOf(s.id) } as never, TWIN_SKILLS)).toBeNull();
      expect('key' in s).toBe(false);
    }
    expect(twinProblem({ ...T.twin_scenarios[0], key: keyOf(T.twin_scenarios[0].id), code: 'PLANT-001' } as never, TWIN_SKILLS)).toBe('synthetic');
    expect(en.tw.simBody).toMatch(/SIMULATED/);
  });
  it('acceptance 2: scoring is identical in TS and SQL: every seeded attempt replays exactly with scoreTwinDrill (SQL parity in the PGlite validator)', async () => {
    for (const a of T.twin_attempts) {
      const sc = T.twin_scenarios.find((x) => x.id === a.scenario_id)!;
      const s = scoreTwinDrill(keyOf(a.scenario_id), a as never, sc.level);
      expect([s.pct, s.passed, s.level, s.points, s.max], a.id).toEqual([a.pct, a.passed, a.level, a.points, a.max_points]);
      expect(s.feedback).toEqual(a.feedback);
    }
    const v = readFileSync('scripts/validate/fs51-next-gen.mjs', 'utf8');
    expect(v).toMatch(/kafaa_tw_score\(\$1::jsonb, \$2::jsonb, \$3\)/);
    expect(v).toMatch(/400 generated submissions/);
    // the local RPC returns exactly the rule's score
    const c = new LocalBackend(); await c.whenReady(); await c.reset();
    c.setPersona('buyer'); await c.whenReady();
    const sc = T.twin_scenarios.find((x) => x.id === 'tw-hx-fouling')!;
    const sub = { checks: [sc.checks[0].id, sc.checks[1].id], component_id: sc.components[0].id, mode_id: sc.modes[0].id, action_id: sc.actions[0].id, rationale_ids: [sc.rationales[0].id] };
    const r = await c.rpc.submitTwinDrill({ scenario_id: sc.id, ...sub });
    const t = scoreTwinDrill(keyOf(sc.id), sub, sc.level);
    expect(r.ok).toBe(true);
    expect([r.data!.pct, r.data!.passed, r.data!.level, r.data!.points]).toEqual([t.pct, t.passed, t.level, t.points]);
  });
  it('acceptance 3: a completed drill writes evidence for the twin and plant-data skills it names, capped at level 2 (2,000 generated submissions, perfect run, retake, recompute)', async () => {
    let seedN = 40;
    const rnd = () => { seedN = (seedN * 1103515245 + 12345) % 2147483648; return seedN / 2147483648; };
    for (let i = 0; i < 2000; i++) {
      const sc = T.twin_scenarios[Math.floor(rnd() * T.twin_scenarios.length)];
      const k = keyOf(sc.id);
      const pick = (xs: Row[]) => xs[Math.floor(rnd() * xs.length)].id;
      const sub = rnd() < 0.4 ? { checks: [...k.useful_checks], component_id: k.component_id, mode_id: k.mode_id, action_id: k.best_action, rationale_ids: [...k.sound_rationales] }
        : { checks: sc.checks.filter(() => rnd() < 0.4).map((x: Row) => x.id), component_id: pick(sc.components), mode_id: pick(sc.modes), action_id: pick(sc.actions), rationale_ids: [pick(sc.rationales)] };
      expect(scoreTwinDrill(k, sub, rnd() < 0.2 ? 3 : sc.level).level).toBeLessThanOrEqual(TWIN_EVIDENCE_CAP);
    }
    const ev = T.skill_evidence.filter((e) => e.ref_table === 'twin_attempts');
    expect(ev.length).toBeGreaterThan(0);
    expect(ev.every((e) => e.kind === 'assessment' && e.level >= 1 && e.level <= 2 && TWIN_SKILLS.includes(e.skill_id))).toBe(true);
    const c = new LocalBackend(); await c.whenReady(); await c.reset();
    c.setPersona('buyer'); await c.whenReady();
    const sc = T.twin_scenarios.find((x) => x.id === 'tw-sensor-drift')!;
    const k = keyOf(sc.id);
    const perfect = { scenario_id: sc.id, checks: k.useful_checks, component_id: k.component_id, mode_id: k.mode_id, action_id: k.best_action, rationale_ids: k.sound_rationales };
    const r = await c.rpc.submitTwinDrill(perfect);
    expect(r.data!.passed).toBe(true);
    expect(r.data!.level).toBe(2);
    expect(r.data!.pct).toBeGreaterThanOrEqual(LEVEL2_PCT);
    const mine = () => (c.raw('skill_evidence' as never) as unknown as Row[]).filter((e) => e.person_id === 'p-buyer' && e.ref_table === 'twin_attempts');
    expect(mine().filter((e) => e.active).map((e) => e.skill_id).sort()).toEqual([...sc.skill_ids].sort());
    expect(mine().every((e) => e.level === 2)).toBe(true);
    // an unsafe retake fails whatever the score, writes nothing and replaces the earlier pass
    const bad = await c.rpc.submitTwinDrill({ ...perfect, checks: [k.useful_checks[0], k.unsafe_checks[0]] });
    expect(bad.data!.passed).toBe(false);
    expect(bad.data!.critical_ok).toBe(false);
    expect(mine().filter((e) => e.active)).toEqual([]);
    await c.rpc.submitTwinDrill(perfect);
    await applySkills(c, 'p-buyer', todayIso());
    expect(mine().filter((e) => e.active).length).toBe(sc.skill_ids.length);
  });
});

describe('FS40 · keys, submissions, statistics and authoring', () => {
  it('staff never read a key; the training manager does; attempts are Own only', async () => {
    await as('buyer');
    expect((await b.list('twin_keys' as never)).length).toBe(0);
    expect((await b.list('twin_scenarios' as never)).length).toBe(4);
    await as('training-mgr');
    expect((await b.list('twin_keys' as never)).length).toBe(5);
    await as('qc-inspector');
    expect((await b.list('twin_attempts' as never)).length).toBe(T.twin_attempts.filter((a) => a.person_id === 'p-qc-inspector').length);
  });
  it('submissions are checked against the drill shown: unknown checks, over-budget checks, drafts and partners are refused', async () => {
    const sc = T.twin_scenarios.find((x) => x.id === 'tw-fw-bearing')!;
    const ok = { checks: ['oil'], component_id: 'bearing', mode_id: 'lube', action_id: 'swap', rationale_ids: ['r1'] };
    expect(twinSubProblem(sc as never, ok)).toBeNull();
    expect(twinSubProblem(sc as never, { ...ok, checks: ['nope'] })).toBe('checks');
    expect(twinSubProblem(sc as never, { ...ok, checks: sc.checks.map((x: Row) => x.id) })).toBe('too_many');
    expect(twinSubProblem(sc as never, { ...ok, rationale_ids: [] })).toBe('rationales');
    await as('buyer');
    expect((await b.rpc.submitTwinDrill({ scenario_id: 'tw-fan-degradation', checks: [], component_id: 'x', mode_id: 'y', action_id: 'z', rationale_ids: ['r1'] })).code).toBe('invalid');
    await as('alnoor-gm');
    expect((await b.rpc.submitTwinDrill({ scenario_id: sc.id, ...ok })).code).toBe('forbidden');
  });
  it('twinStats: training staff and HR only; latest attempt per person; cells under 10 suppressed', async () => {
    await as('buyer');
    expect(await b.rpc.twinStats()).toBeNull();
    await as('training-mgr');
    const s = (await b.rpc.twinStats())!;
    expect(s.attempts).toBe(T.twin_attempts.length);
    expect(s.scenarios.every((x) => x.people === null || x.people >= 10)).toBe(true);
    expect(s.scenarios.some((x) => x.people !== null)).toBe(true);
    const small = twinStats(T.twin_attempts.slice(0, 5) as never, T.twin_keys as never, ['tw-fw-bearing'], 10);
    expect(small.scenarios[0].people).toBeNull();
  });
  it('saveTwinScenario: only the training manager authors; a reused or non-synthetic code and plant-security wording are refused', async () => {
    const base = { ...T.twin_scenarios.find((x) => x.id === 'tw-hx-fouling')!, key: keyOf('tw-hx-fouling') } as Row;
    const nt = { ...base, id: null, code: 'SYN-TW-199', status: 'draft' };
    for (const p of ['buyer', 'k-instructor']) { await as(p); expect((await b.rpc.saveTwinScenario(nt as never)).code).toBe('forbidden'); }
    await as('training-mgr');
    const r = await b.rpc.saveTwinScenario(nt as never);
    expect(r.ok).toBe(true);
    expect(r.data!.version).toBe(1);
    expect((await b.rpc.saveTwinScenario({ ...nt, id: r.data!.id, title_en: 'Edited' } as never)).data!.version).toBe(2);
    expect((await b.rpc.saveTwinScenario({ ...nt, code: 'SYN-TW-101' } as never)).code).toBe('conflict');
    expect((await b.rpc.saveTwinScenario({ ...nt, code: 'SYN-TW-198', scenario_en: 'Walk past the alarm station in the vital area.' } as never)).message).toMatch(/security/);
  });
});

describe('FS38/FS39/FS40 · routes, shared lists, seed and i18n', () => {
  it('9 routes with the planned guards; the editor, matrix and drill bank are not public; the param route has a smoke sample', () => {
    expect(routes.map((r) => r.id)).toEqual(['careers-next-gen', 'my-next-gen', 'workforce-next-gen', 'admin-next-gen', 'learn-plant-literacy', 'my-plant-log', 'my-twin-drills', 'my-twin-drill', 'training-twin-drills']);
    const g = Object.fromEntries(routes.map((r) => [r.id, r.guard]));
    expect(g['careers-next-gen']).toEqual({});
    expect(g['admin-next-gen']).toEqual({ signedIn: true, grant: { res: 'frameworks', levels: ['W', 'A'] } });
    expect(g['workforce-next-gen']).toEqual({ signedIn: true, grant: { res: 'workforce_strategy', levels: ['Agg', 'R'] } });
    expect(g['training-twin-drills']).toEqual({ signedIn: true, grant: { res: 'secure_items', levels: ['W', 'A'] } });
    expect(g['my-plant-log'].grant).toEqual({ res: 'skills_profile', levels: ['Own'] });
    expect(g['learn-plant-literacy']).toEqual({ signedIn: true });
    const smoke = JSON.parse(readFileSync('src/modules/m31/smoke.json', 'utf8'));
    expect(T.twin_scenarios.some((s) => s.id === smoke['my-twin-drill'].id && s.status === 'published')).toBe(true);
  });
  it('plant visits and twin attempts are recorded evidence (3.9): kept on recompute in TS and in the SQL redefinition', () => {
    expect(RECORDED_REF_TABLES).toEqual(expect.arrayContaining(['plant_visits', 'twin_attempts']));
    const mig = readFileSync('supabase/migrations/20261010251001_kafaa_fs51_next_gen.sql', 'utf8');
    expect((mig.match(/'ai_drill_attempts', 'plant_visits', 'twin_attempts'/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(/\b(drop|delete|truncate)\b/i.test(mig)).toBe(false);
  });
  it('every page text exists in English and Arabic, with the same variables', () => {
    const flat = (o: Row, p = ''): [string, string][] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [[`${p}${k}`, String(v)] as [string, string]]));
    const E = new Map(flat(en)); const A = new Map(flat(ar));
    expect([...E.keys()].sort()).toEqual([...A.keys()].sort());
    for (const [k, v] of E) expect((A.get(k)!.match(/\{\w+\}/g) ?? []).sort(), k).toEqual((v.match(/\{\w+\}/g) ?? []).sort());
    for (const r of routes) { expect((en.routes as Row)[r.id]?.title, r.id).toBeTruthy(); expect((ar.routes as Row)[r.id]?.purpose, r.id).toBeTruthy(); }
    for (const k of ['component', 'componentWrong', 'mode', 'modeWrong', 'checks', 'rationales', 'unsafe', 'level', 'notPassed']) expect((en.tw.reason as Row)[k]).toBeTruthy();
    for (const k of ['best', 'conservative', 'not_conservative', 'unsafe']) expect((ar.tw.reason.action as Row)[k]).toBeTruthy();
  });
});
