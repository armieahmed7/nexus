/** FS25 Nuclear Critical Core Skills + FS26 Situational judgement practice (FS wave C · E5, M33): one test per acceptance criterion on
 *  the local path, plus the rules shared with SQL, RBAC, the seed and i18n. The SQL path (TS = SQL parity for kafaa_cs_profile,
 *  kafaa_cs_stats_core, kafaa_sjt_pick / feedback / score / item_problem / stats_core; RLS; live RPC flows) is checked by
 *  scripts/validate/fs35-core-skills.mjs (PGlite). */
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { SCHEMA } from '../../src/data/schema';
import en from '../../src/i18n/m33.en.json';
import ar from '../../src/i18n/m33.ar.json';
import seed from '../../src/seed/seed.json';
import { routes } from '../../src/modules/m33/routes';
import { FEATURE_BENCHMARKS } from '../../src/domain/taxonomy';
import {
  CORE_SKILL_COUNT, MIN_BENCHMARK_MAPPINGS, approachSignature, benchmarkIdsOf, coreLevel, coreProfile, coreStats, inclusionProblems, pct1, practicePct,
  type CoreSkillRow, type StateLite,
} from '../../src/modules/m33/coreSkills';
import { MAX_EFF, SET_SIZE, feedbackOf, personSeed, pickSet, scoreSjt, sjtItemProblem, sjtStats, type SjtItem } from '../../src/modules/m33/sjt';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const S = seed as unknown as { tables: Record<string, Row[]>; personas: Row[] };
const T = S.tables;
const core = T.core_skills as unknown as (CoreSkillRow & Row)[];
const items = T.sjt_items as unknown as SjtItem[];
const ids = core.map((c) => c.id);
const names = core.map((c) => ({ id: c.id, name_en: c.name_en, name_ar: c.name_ar, sort: c.sort }));
const flat = (o: Row, p = ''): [string, string][] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [[`${p}${k}`, String(v)]]));

let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});

describe('FS25 acceptance', () => {
  it('each of the 16 core skills cites at least 2 benchmark mappings, all of them benchmark registry rows', () => {
    const registry = new Set(T.benchmarks.map((x) => x.id));
    expect(core.length).toBe(CORE_SKILL_COUNT);
    for (const c of core) {
      expect(benchmarkIdsOf(c).length, c.id).toBeGreaterThanOrEqual(MIN_BENCHMARK_MAPPINGS);
      expect(benchmarkIdsOf(c).every((x) => registry.has(x))).toBe(true);
      expect(c.benchmark_ids).toEqual(benchmarkIdsOf(c));
    }
    for (const id of FEATURE_BENCHMARKS.FS25) expect(core.some((c) => c.benchmark_ids.includes(id)), id).toBe(true);
  });
  it('every core skill has a development route and an assessment route of its own (the inclusion rule)', () => {
    expect(inclusionProblems(core)).toEqual([]);
    for (const c of core) {
      expect(c.development.some((r) => !(r.kind === 'practice' && r.ref === c.id)), c.id).toBe(true);
      expect(c.assessment.some((r) => !(r.kind === 'sjt' && r.ref === c.id)), c.id).toBe(true);
      expect(c.dev_approach_en && c.dev_approach_ar && c.assess_approach_en && c.assess_approach_ar).toBeTruthy();
    }
    expect(new Set(core.map(approachSignature)).size).toBe(16);
    // the rule bites: a skill with only generic practice, or a copy of another's approach, fails
    const generic = { ...core[0], development: [{ kind: 'practice', ref: core[0].id, title_en: 'x', title_ar: 'x' }] };
    expect(inclusionProblems([generic, ...core.slice(1)]).map((p) => p.code)).toContain('no_development');
    const copy = { ...core[1], development: core[0].development, assessment: core[0].assessment, id: core[0].id };
    expect(inclusionProblems([core[0], copy, ...core.slice(2)]).map((p) => p.code)).toContain('shared_approach');
  });
  it('no wellbeing competency is added: the rule refuses one and wellbeing is recorded as an outcome', () => {
    expect(core.some((c) => /well-?being|wellness/i.test(c.name_en))).toBe(false);
    const wb = { ...core[12], id: 'cs-wellbeing', name_en: 'Mental wellbeing', name_ar: 'العافية النفسية' };
    expect(inclusionProblems([...core.slice(0, 15), wb]).some((p) => p.id === 'cs-wellbeing' && p.code === 'wellbeing')).toBe(true);
    const cand = T.core_skill_candidates.find((c) => c.id === 'cand-wellbeing')!;
    expect(cand.decision).toBe('outcome');
    expect(cand.merged_into).toBe('cs-resilience');
    expect(core.find((c) => c.id === 'cs-resilience')!.outcome_en).toMatch(/Wellbeing is an outcome/);
  });
  it('the 16 skills sit in the three clusters, map to INPO traits in M08 and FS02 catalogue skills, with three EN/AR level descriptors', () => {
    expect(new Set(core.map((c) => c.cluster))).toEqual(new Set(['thinking_critically', 'interacting_with_others', 'staying_relevant']));
    const traits = new Set(T.sc_traits.map((x) => x.id));
    const skills = new Set(T.skills.map((x) => x.id));
    for (const c of core) {
      expect((c.trait_ids ?? []).every((x: string) => traits.has(x))).toBe(true);
      expect(c.skill_ids.every((x) => skills.has(x))).toBe(true);
      expect(c.descriptors.map((d: Row) => d.level)).toEqual([1, 2, 3]);
      expect(c.descriptors.every((d: Row) => d.en && d.ar)).toBe(true);
    }
    expect(core.filter((c) => c.skill_ids.some((x) => x.startsWith('sk-fs-tr-'))).length).toBeGreaterThanOrEqual(10);
    expect(T.core_skill_targets.length).toBe(T.job_families.length * 16);
  });
});

describe('FS25 rules (mirrored by SQL kafaa_cs_*)', () => {
  const st = (skill_id: string, level: number, basis = 'evidenced'): StateLite => ({ id: `ps:x:${skill_id}`, skill_id, level, basis, active: true });
  const targets = [{ family_id: 'operations', core_skill_id: 'cs-questioning', level: 3 }];
  const nm = new Map(T.skills.map((s) => [s.id, s as never]));
  it('level = highest linked state (capped at 3); status against the family target; reasons point at the evidence', () => {
    const p = coreProfile('x', 'operations', core, targets, [st('sk-sc-01', 2, 'claimed'), st('sk-fs-tr-analytical', 2, 'verified')], nm, [], '2026-10-10');
    const q = p.skills.find((v) => v.core_skill_id === 'cs-questioning')!;
    expect(q.level).toBe(2);
    expect(q.status).toBe('below');
    expect(q.top_basis).toBe('verified');
    expect(q.reasons[0].ref).toEqual({ table: 'person_skills', id: 'ps:x:sk-fs-tr-analytical' });
    expect(q.reasons.map((r) => r.code)).toEqual(['cs_evidence', 'cs_evidence', 'cs_below']);
    expect(coreLevel(5)).toBe(3);
    expect(p.skills.filter((v) => v.status === 'no_evidence').length).toBe(p.summary.no_evidence);
    expect(p.skills.find((v) => v.core_skill_id === 'cs-conservative')!.status).toBe('no_evidence');
    expect(coreProfile('x', null, core, targets, [st('sk-sc-01', 3)], nm, [], '2026-10-10').skills[0].status).toBe('no_target');
  });
  it('practice is shown beside the level and never changes it', () => {
    const att = [{ person_id: 'x', status: 'completed', period: '2026-Q4', by_skill: { 'cs-questioning': { n: 2, sum: 6 } } }];
    const a = coreProfile('x', 'operations', core, targets, [st('sk-sc-01', 1)], nm, [], '2026-10-10').skills[0];
    const b2 = coreProfile('x', 'operations', core, targets, [st('sk-sc-01', 1)], nm, att, '2026-10-10').skills[0];
    expect(b2.practice).toEqual({ n: 2, pct: 100 });
    expect(b2.level).toBe(a.level);
    expect(b2.status).toBe(a.status);
    const old = [{ ...att[0], period: '2025-Q3' }];
    expect(coreProfile('x', 'operations', core, targets, [], nm, old, '2026-10-10').skills[0].practice).toBeNull();
  });
  it('integer rounding helpers match SQL (half up)', () => {
    expect(practicePct(5, 2)).toBe(83);
    expect(practicePct(1, 2)).toBe(17);
    expect(pct1(1, 3)).toBe(33.3);
    expect(pct1(2, 3)).toBe(66.7);
  });
  it('the HR aggregate suppresses every cell under 10 and never breaks out security, safeguards or cyber', () => {
    const by = new Map<string, StateLite[]>();
    for (const s of T.person_skills) if (s.active) (by.get(s.person_id) ?? by.set(s.person_id, []).get(s.person_id)!).push(s as StateLite);
    const s = coreStats(T.people as never, core, T.core_skill_targets as never, by, 10);
    for (const r of s.by_skill) for (const v of [r.met, r.below, r.no_evidence]) expect(v == null || v >= 10).toBe(true);
    for (const f of s.by_family) expect(f.n == null || f.n >= 10).toBe(true);
    expect(s.by_family.some((f) => ['security', 'safeguards', 'cyber'].includes(f.family_id))).toBe(false);
    const small = coreStats((T.people as Row[]).filter((p) => p.kind === 'staff').slice(0, 9) as never, core, T.core_skill_targets as never, by, 10);
    expect(small.pct_met).toBeNull();
    expect(small.by_skill.every((r) => r.met == null && r.pct_met == null)).toBe(true);
  });
});

describe('FS26 acceptance', () => {
  it('a bank of at least 40 items in EN and AR; every item has an expert rationale in both languages', () => {
    expect(items.length).toBeGreaterThanOrEqual(40);
    for (const i of items) {
      expect(sjtItemProblem(i, ids), i.id).toBeNull();
      expect(i.rationale_en.trim().length).toBeGreaterThan(40);
      expect(i.rationale_ar.trim().length).toBeGreaterThan(40);
      expect(/[؀-ۿ]/.test(i.rationale_ar) && /[؀-ۿ]/.test(i.stem_ar)).toBe(true);
      expect(i.notes_en.length === 4 && i.notes_ar.length === 4).toBe(true);
    }
    expect(sjtItemProblem({ ...items[0], rationale_ar: ' ' }, ids)).toBe('rationale');
    for (const theme of ['conservative_decisions', 'questioning', 'raising_concerns', 'teamwork_pressure']) expect(items.some((i) => i.theme === theme), theme).toBe(true);
    for (const id of ids) expect(items.filter((i) => i.core_skill_id === id).length).toBeGreaterThanOrEqual(2);
  });
  it('results never appear in talent review: attempts are Own only (RLS) and no talent-review payload carries them', async () => {
    const all = T.sjt_attempts.length;
    expect(all).toBeGreaterThan(100);
    for (const p of ['chco', 'k-hr-analyst', 'sro', 'training-mgr', 'k-admin', 'k-auditor', 'ops-ceo']) {
      await as(p);
      const me = b.identity().personId;
      const rows = (await b.list('sjt_attempts' as never)) as Row[];
      expect(rows.every((r) => r.person_id === me), p).toBe(true);
    }
    expect(SCHEMA.sjt_attempts.read).toEqual([{ res: 'own_profile', person: 'person_id' }]);
    await as('chco');
    const cycles = await b.rpc.talentCycles();
    expect(cycles.ok).toBe(true);
    for (const c of cycles.data ?? []) {
      const board = await b.rpc.talentBoard(c.id);
      expect(JSON.stringify(board)).not.toMatch(/sjt|situational/i);
    }
    const agg = await b.rpc.sjtStats();
    expect(agg).not.toBeNull();
    expect(JSON.stringify(agg)).not.toMatch(/"p-|person_id/);
  });
  it('no gamification: no points, streaks, badges, ranks or leaderboards in the tables, the RPC results or the copy', async () => {
    const cols = ['core_skills', 'core_skill_targets', 'sjt_items', 'sjt_attempts'].flatMap((t) => Object.keys(SCHEMA[t].cols));
    expect(cols.filter((c) => /(^|_)(points?|streaks?|badges?|leaderboards?|ranks?|xp|rewards?)($|_)/.test(c))).toEqual([]);
    await as('k-ro');
    const st = await b.rpc.startSjt({});
    expect(st.ok).toBe(true);
    const r = await b.rpc.submitSjt({ attempt_id: st.data!.attempt_id, item_id: st.data!.item!.id, choice: 0 });
    expect(JSON.stringify(r.data)).not.toMatch(/points|streak|badge|leaderboard|"rank/i);
    for (const [k, v] of [...flat(en), ...flat(ar)]) {
      expect(k).not.toMatch(/points|streak|badge|leaderboard|rank/i);
      expect(v).not.toMatch(/you earned|level up|leaderboard position|streak of/i);
    }
  });
});

describe('FS26 rules (mirrored by SQL kafaa_sjt_*)', () => {
  it('pickSet is deterministic, rotates by person and attempt, prefers unseen items and respects a focus skill', () => {
    const a = pickSet(items, new Map(), 1, null, personSeed('p-a'));
    expect(a.length).toBe(SET_SIZE);
    expect(pickSet(items, new Map(), 1, null, personSeed('p-a'))).toEqual(a);
    expect(pickSet(items, new Map(), 1, null, personSeed('p-bb'))).not.toEqual(a);
    const seen = new Map(a.map((x) => [x, 1]));
    expect(pickSet(items, seen, 2, null, personSeed('p-a')).some((x) => a.includes(x))).toBe(false);
    const f = pickSet(items, new Map(), 1, 'cs-speak-up', 0);
    expect(f.length).toBe(3);
    expect(f.every((x) => items.find((i) => i.id === x)!.core_skill_id === 'cs-speak-up')).toBe(true);
    expect(pickSet(items.map((i) => ({ ...i, status: 'retired' })), new Map(), 1, null)).toEqual([]);
  });
  it('feedback reveals the expert key, the best response, notes and rationale; scoring is the share of the expert best', () => {
    const it0 = items[0];
    const fb = feedbackOf(it0, 0);
    expect(fb.key).toEqual(it0.expert_key);
    expect(fb.key[fb.best]).toBe(MAX_EFF);
    expect(fb.rationale_ar).toBe(it0.rationale_ar);
    const resp = [{ item_id: 'a', core_skill_id: 'cs-questioning', choice: 0, eff: 3 }, { item_id: 'b', core_skill_id: 'cs-conservative', choice: 1, eff: 0 }];
    const sc = scoreSjt(resp, names);
    expect(sc.score).toBe(50);
    expect(sc.by_skill).toEqual({ 'cs-conservative': { n: 1, sum: 0 }, 'cs-questioning': { n: 1, sum: 3 } });
    expect(sc.reasons.map((r) => r.code)).toEqual(['sjt_score', 'sjt_strong', 'sjt_develop', 'sjt_private']);
  });
  it('the item check refuses missing languages, two best responses and plant-security wording', () => {
    const i = items[0];
    expect(sjtItemProblem({ ...i, options_ar: i.options_ar.slice(0, 3) }, ids)).toBe('options');
    expect(sjtItemProblem({ ...i, expert_key: [3, 3, 1, 0] }, ids)).toBe('key');
    expect(sjtItemProblem({ ...i, notes_ar: ['', ...i.notes_ar.slice(1)] }, ids)).toBe('notes');
    expect(sjtItemProblem({ ...i, stem_en: `${i.stem_en} Near the vital area door.` }, ids)).toBe('restricted');
    expect(sjtItemProblem({ ...i, core_skill_id: 'cs-x' }, ids)).toBe('core_skill');
  });
  it('the HR practice aggregate is suppressed under 10 people', () => {
    const s = sjtStats(T.sjt_attempts as never, T.people as never, names, '2026-10-10', 10);
    expect(s.participants).toBeGreaterThanOrEqual(10);
    for (const q of s.by_quarter) expect(q.people == null || q.people >= 10).toBe(true);
    const few = sjtStats((T.sjt_attempts as Row[]).filter((a) => a.person_id === 'p-k-ro') as never, T.people as never, names, '2026-10-10', 10);
    expect(few.participants).toBeNull();
    expect(few.avg).toBeNull();
  });
  it('seeded practice sets replay with the server rules and write no skill evidence', () => {
    expect(T.skill_evidence.some((e) => e.ref_table === 'sjt_attempts')).toBe(false);
    const sample = T.sjt_attempts.slice(0, 30);
    for (const a of sample) expect(scoreSjt(a.responses, names).score).toBe(a.score);
  });
});

describe('FS25/FS26 local RPC flows and RBAC', () => {
  it('my core skills: Own only (staff), null for anonymous and partners', async () => {
    await as('k-ro');
    const p = await b.rpc.coreSkillsMine();
    expect(p?.skills.length).toBe(16);
    expect(p!.summary.met + p!.summary.below).toBeGreaterThanOrEqual(3);
    expect(p!.skills.some((v) => v.practice)).toBe(true);
    await as(null);
    expect(await b.rpc.coreSkillsMine()).toBeNull();
    await as('alnoor-gm');
    expect(await b.rpc.coreSkillsMine()).toBeNull();
  });
  it('the aggregates are for HR only (skills_profile Agg); a line manager gets nothing', async () => {
    await as('k-hr-analyst');
    expect((await b.rpc.coreSkillsStats())?.staff).toBeGreaterThan(10);
    expect((await b.rpc.sjtStats())?.participants).toBeGreaterThanOrEqual(10);
    await as('sro');
    expect(await b.rpc.coreSkillsStats()).toBeNull();
    expect(await b.rpc.sjtStats()).toBeNull();
  });
  it('a practice set runs end to end: items without the key, feedback after each answer, a result, no evidence and no ledger', async () => {
    await as('k-lo-trainee');
    const ev0 = (b.raw('skill_evidence' as never) as unknown as Row[]).length;
    const st = await b.rpc.startSjt({ core_skill_id: null });
    expect(st.ok).toBe(true);
    expect(Object.keys(st.data!.item!)).not.toContain('expert_key');
    const again = await b.rpc.startSjt({});
    expect(again.data!.resumed).toBe(true);
    let step = st.data!;
    const bad = await b.rpc.submitSjt({ attempt_id: step.attempt_id, item_id: step.item!.id, choice: 9 });
    expect(bad.ok).toBe(false);
    expect(bad.code).toBe('invalid');
    let n = 0;
    while (!step.done && n < 10) {
      const r = await b.rpc.submitSjt({ attempt_id: step.attempt_id, item_id: step.item!.id, choice: n % 4 });
      expect(r.ok).toBe(true);
      expect(r.data!.feedback!.rationale_en.length).toBeGreaterThan(10);
      step = r.data!;
      n++;
    }
    expect(n).toBe(SET_SIZE);
    expect(step.result!.score).toBeGreaterThanOrEqual(0);
    expect((b.raw('skill_evidence' as never) as unknown as Row[]).length).toBe(ev0);
    const ledger = (b.raw('ledger_local' as never) as unknown as Row[]).filter((l) => /sjt/i.test(JSON.stringify(l)));
    expect(ledger).toEqual([]);
    const ctx = await b.rpc.sjtContext();
    expect(ctx!.in_progress).toBeNull();
    expect(ctx!.bank.length).toBe(16);
  });
  it('another person cannot answer my set; an unknown core skill is refused', async () => {
    await as('k-ro');
    const st = await b.rpc.startSjt({});
    await as('sro');
    const r = await b.rpc.submitSjt({ attempt_id: st.data!.attempt_id, item_id: st.data!.item!.id, choice: 0 });
    expect(r.code).toBe('not_found');
    const u = await b.rpc.startSjt({ core_skill_id: 'cs-wellbeing' });
    expect(u.ok).toBe(false);
    expect(u.code).toBe('invalid');
  });
  it('the item bank: training manager writes (versioned), instructors read only, two active items per core skill are kept', async () => {
    const it0 = items.find((i) => i.core_skill_id === 'cs-systems')!;
    const input = { ...it0, id: null, status: 'active' as const, stem_en: 'A new practice scenario about shared supplies.', stem_ar: 'سيناريو تمرين جديد عن الإمدادات المشتركة.' };
    await as('k-instructor');
    expect((await b.rpc.saveSjtItem(input)).code).toBe('forbidden');
    expect(((await b.list('sjt_items' as never)) as Row[]).length).toBe(items.length);
    await as('training-mgr');
    const add = await b.rpc.saveSjtItem(input);
    expect(add.ok).toBe(true);
    const edit = await b.rpc.saveSjtItem({ ...input, id: add.data!.id, rationale_en: 'Updated rationale for the scenario.' });
    expect(edit.data!.version).toBe(2);
    const sys = items.filter((i) => i.core_skill_id === 'cs-systems');
    expect((await b.rpc.saveSjtItem({ ...sys[0], status: 'retired' })).ok).toBe(true);
    expect((await b.rpc.saveSjtItem({ ...sys[1], status: 'retired' })).ok).toBe(true);
    expect((await b.rpc.saveSjtItem({ ...input, id: add.data!.id, status: 'retired' })).code).toBe('conflict');
    expect((await b.rpc.saveSjtItem({ ...input, rationale_ar: '' })).code).toBe('invalid');
  });
});

describe('FS25/FS26 routes and i18n', () => {
  it('six routes with the right guards; EN and AR complete; every page shows its benchmark chips', () => {
    expect(routes.map((r) => r.id)).toEqual(['learn-core-skills', 'learn-core-skill', 'my-core-skills', 'my-core-practice', 'workforce-core-skills', 'training-sjt-items']);
    expect(routes.find((r) => r.id === 'learn-core-skills')!.guard).toEqual({});
    expect(routes.find((r) => r.id === 'my-core-practice')!.guard.grant).toEqual({ res: 'skills_profile', levels: ['Own'] });
    expect(routes.find((r) => r.id === 'workforce-core-skills')!.guard.grant).toEqual({ res: 'skills_profile', levels: ['Agg'] });
    const E = new Map(flat(en));
    const A = new Map(flat(ar));
    expect([...E.keys()].sort()).toEqual([...A.keys()].sort());
    for (const r of routes) expect(E.get(`routes.${r.id}.title`) && A.get(`routes.${r.id}.title`)).toBeTruthy();
    expect(FEATURE_BENCHMARKS.FS25).toEqual(['SSG-SF', 'WEF-FOJ', 'GREENCOMP', 'MCK-DELTA']);
    expect(FEATURE_BENCHMARKS.FS26).toEqual(['IAEA-1917', 'MCK-DELTA']);
  });
});
