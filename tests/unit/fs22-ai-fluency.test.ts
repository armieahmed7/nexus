/** FS09 AI Fluency Ladder + FS10 AI and Digital Fitness Check (FS wave B · E2, M29): one test per acceptance criterion on the local
 *  path, plus the rules shared with SQL, RBAC, the seed and i18n. The SQL path (TS = SQL parity for kafaa_ai_rung, kafaa_fit_next,
 *  kafaa_fit_pick, kafaa_fit_score, kafaa_fit_stats_core; RLS; live RPC flows) is checked by scripts/validate/fs22-ai-fluency.mjs (PGlite). */
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { applySkills } from '../../src/data/local/rpc.w0';
import { SCHEMA } from '../../src/data/schema';
import en from '../../src/i18n/m29.en.json';
import ar from '../../src/i18n/m29.ar.json';
import seed from '../../src/seed/seed.json';
import { routes } from '../../src/modules/m29/routes';
import { DIMENSIONS, aiRung, ladderProblems, rungStats, targetGap, type RungCell, type SkillTrackRow, type StateLite } from '../../src/modules/m29/fluency';
import { EVIDENCE_CAP, MAX_ITEMS, areaLevel, fitnessStats, itemProblem, nextStep, pickItem, quarterShift, scoreAttempt, windowQuarters, type FitArea, type FitItem, type FitResponse } from '../../src/modules/m29/fitness';
import { isDerivedEvidence, isRecordedEvidence } from '../../src/domain/skills';
import { todayIso } from '../../src/domain/rules';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const S = seed as unknown as { tables: Record<string, Row[]>; personas: Row[] };
const T = S.tables;
const cells = T.ai_rungs as unknown as RungCell[];
const tracks = T.ai_skill_tracks as unknown as SkillTrackRow[];
const areas = T.fitness_areas.map((a) => ({ ...a, weight: Number(a.weight) })) as FitArea[];
const items = T.fitness_items as Row[];
const STAFF_ROLES = ['employee', 'licensed_operator', 'manager', 'instructor', 'training_manager', 'licensing_coord', 'hr_analyst', 'hr_director', 'editor', 'ecp_officer', 'admin'];
const staffPersonas = S.personas.filter((p) => p.kind === 'staff' && (p.roles as string[]).some((r) => STAFF_ROLES.includes(r)));

let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});
const keyOf = (id: string) => Number(items.find((i) => i.id === id)!.correct);
/** Answer until the stop rule; `right(n)` decides whether answer n is right. */
async function takeCheck(right: (n: number) => boolean) {
  const st = await b.rpc.startFitness();
  expect(st.ok).toBe(true);
  let step = st.data!;
  let n = 0;
  while (!step.done && n < 30) {
    const it = step.item!;
    const c = right(n) ? keyOf(it.id) : (keyOf(it.id) + 1) % it.options_en.length;
    const r = await b.rpc.submitFitness({ attempt_id: step.attempt_id, item_id: it.id, choice: c });
    expect(r.ok).toBe(true);
    step = r.data!;
    n++;
  }
  return { step, n };
}

describe('FS09 · the ladder rule (aiRung, mirrored by SQL kafaa_ai_rung)', () => {
  const st = (skill_id: string, level: number, basis = 'evidenced'): StateLite => ({ skill_id, level, basis, active: true, reasons: [{ evidence_id: `se:x:${skill_id}` }] });
  const allAt = (lv: number) => ['sk-fs-ai-use', 'sk-fs-ai-verify', 'sk-fs-ai-prompt', 'sk-fs-ai-plantdata'].map((s) => st(s, lv));
  it('the ladder definition is sound: 16 cells, literacy skills only, levels never fall as rungs rise', () => {
    expect(ladderProblems(cells, tracks)).toEqual([]);
    expect(cells.length).toBe(16);
  });
  it('the rung is the highest rung with every dimension met at it and below (spiral)', () => {
    expect(aiRung('x', cells, tracks, []).rung).toBe(0);
    expect(aiRung('x', cells, tracks, allAt(1)).rung).toBe(1);
    expect(aiRung('x', cells, tracks, allAt(2)).rung).toBe(2);
    const three = aiRung('x', cells, tracks, [...allAt(3), st('sk-da-02', 3)]);
    expect(three.rung).toBe(3);
    expect(three.next?.rung).toBe(4);
    const gap = aiRung('x', cells, tracks, [st('sk-fs-ai-use', 2), st('sk-fs-ai-verify', 2), st('sk-fs-ai-prompt', 2)]);
    expect(gap.rung).toBe(0);
    expect(gap.next).toEqual({ rung: 1, missing: ['air:1:design'] });
    expect(gap.reasons.map((r) => r.code)).toEqual(['fs09_rung', 'fs09_cell_met', 'fs09_cell_met', 'fs09_cell_met', 'fs09_cell_gap']);
    expect(gap.reasons.every((r) => r.key.startsWith('m29.reason.'))).toBe(true);
  });
  it('acceptance: an AI-engineering skill never changes the literacy rung, even at level 4 or when a cell names it', () => {
    const base = [...allAt(1)];
    const eng = ['sk-fs-ai-dataeng', 'sk-fs-ai-automation', 'sk-da-01-scripting', 'sk-da-01-twins', 'sk-fs-ai-twin'].map((s) => st(s, 4));
    expect(tracks.filter((x) => x.track === 'engineering').map((x) => x.skill_id).sort()).toEqual(eng.map((e) => e.skill_id).sort());
    const without = aiRung('x', cells, tracks, base);
    const withEng = aiRung('x', cells, tracks, [...base, ...eng]);
    expect(withEng.rung).toBe(without.rung);
    expect(withEng.cells).toEqual(without.cells);
    expect(withEng.engineering.length).toBe(5);
    expect(withEng.reasons.at(-1)?.code).toBe('fs09_engineering');
    const tampered = cells.map((c) => (c.rung === 2 ? { ...c, skill_ids: ['sk-fs-ai-dataeng', ...c.skill_ids] } : c));
    expect(aiRung('x', tampered, tracks, [...base, ...eng]).rung).toBe(1);
    expect(ladderProblems(tampered, tracks).length).toBeGreaterThan(0);
  });
  it('self-claimed levels alone never move anyone up the ladder', () => {
    expect(aiRung('x', cells, tracks, allAt(2).map((s) => ({ ...s, basis: 'claimed' }))).rung).toBe(0);
  });
  it('family targets: Practitioner plus a single higher cell (operators: the verification cell of Assurer)', () => {
    const ops = T.ai_role_targets.find((x) => x.family_id === 'operations')!;
    expect([ops.rung, ops.plus_cells]).toEqual([2, ['air:4:ethics']]);
    const r = aiRung('x', cells, tracks, allAt(2));
    expect(targetGap(r, { rung: 2, plus_cells: [] })).toEqual({ met: true, missing: [] });
    expect(targetGap(r, { rung: 2, plus_cells: ['air:4:ethics'] })).toEqual({ met: false, missing: ['air:4:ethics'] });
    const v4 = aiRung('x', cells, tracks, [...allAt(2), st('sk-fs-ai-verify', 4)]);
    expect(targetGap(v4, { rung: 2, plus_cells: ['air:4:ethics'] }).met).toBe(true);
  });
});

describe('FS09 · acceptance on the local backend', () => {
  it('acceptance: every staff persona sees a rung with at least one reason linking to evidence', async () => {
    expect(staffPersonas.length).toBeGreaterThan(30);
    const missing: string[] = [];
    for (const p of staffPersonas) {
      await as(p.persona);
      const v = await b.rpc.aiFluency();
      if (!v || !v.result.reasons.some((r) => r.ref?.table === 'skill_evidence' && T.skill_evidence.some((e) => e.id === r.ref!.id && e.person_id === p.person_id))) missing.push(p.persona);
    }
    expect(missing).toEqual([]);
  }, 60000);
  it('acceptance: all 20 job families have a role target, and every staff persona sees theirs', async () => {
    expect(T.job_families.length).toBe(20);
    for (const f of T.job_families) expect(T.ai_role_targets.some((x) => x.family_id === f.id), f.id).toBe(true);
    await as('k-ro');
    const v = await b.rpc.aiFluency();
    expect(v?.family_id).toBe('operations');
    expect(v?.target?.plus_cells).toEqual(['air:4:ethics']);
  });
  it('acceptance: an AI-engineering skill never changes the literacy rung (local path, through F01 evidence and recompute)', async () => {
    await as('k-ro');
    const before = (await b.rpc.aiFluency())!;
    for (const sid of ['sk-fs-ai-dataeng', 'sk-fs-ai-automation', 'sk-fs-ai-twin']) {
      b.rawInsert('skill_evidence' as never, { id: `se:credential:test:${sid}`, person_id: 'p-k-ro', skill_id: sid, kind: 'credential', ref_table: 'certificates', ref_id: 'test', level: 4, basis: 'verified', status: 'current', observed_on: todayIso(), note: null, recorded_by: 'p-k-ro', active: true, created_at: new Date().toISOString() } as never);
    }
    await applySkills(b, 'p-k-ro', todayIso());
    const after = (await b.rpc.aiFluency())!;
    expect(after.result.rung).toBe(before.result.rung);
    expect(after.result.cells).toEqual(before.result.cells);
    expect(after.result.engineering.map((e) => e.skill_id)).toEqual(expect.arrayContaining(['sk-fs-ai-dataeng', 'sk-fs-ai-automation', 'sk-fs-ai-twin']));
  });
  it('acceptance: no points, streaks or leaderboards anywhere in the feature', async () => {
    const cols = ['ai_rungs', 'ai_skill_tracks', 'ai_role_targets', 'ai_org_targets', 'fitness_areas', 'fitness_items', 'fitness_attempts'].flatMap((t) => Object.keys(SCHEMA[t].cols));
    expect(cols.filter((c) => /point|streak|rank|leader|badge|(^|_)xp(_|$)/i.test(c))).toEqual([]);
    const text = JSON.stringify(en).toLowerCase();
    expect(text).not.toMatch(/earn points|your points|leaderboard position|streak of/);
    await as('chco');
    const st = (await b.rpc.aiFluencyStats())!;
    expect(JSON.stringify(st)).not.toMatch(/"[pw]-[a-z0-9-]+"/); // no person ids in the HR aggregate
  });
  it('RBAC: Own for my rung; HR Agg (suppressed); nothing for partners or anonymous visitors', async () => {
    await as('alnoor-gm');
    expect(await b.rpc.aiFluency()).toBeNull();
    await as(null);
    expect(await b.rpc.aiFluency()).toBeNull();
    await as('k-ro');
    expect(await b.rpc.aiFluencyStats()).toBeNull();
    await as('k-hr-analyst');
    const st = (await b.rpc.aiFluencyStats())!;
    expect(st.staff).toBeGreaterThan(10);
    expect(st.distribution.every((x) => x.n === null || x.n >= 10)).toBe(true);
    expect(st.by_family.every((x) => !['security', 'safeguards', 'cyber'].includes(x.family_id))).toBe(true);
    expect(st.org_target?.pct).toBe(60);
    expect(rungStats(st.distribution.slice(0, 0).map(() => ({ person_id: '', family_id: null, rung: 0, target_met: false })), 10).practitioner.pct).toBeNull();
  });
});

describe('FS10 · the adaptive rules (nextStep, areaLevel, scoreAttempt, pickItem; mirrored by SQL kafaa_fit_*)', () => {
  const play = (pattern: (n: number, area: string, d: number) => boolean, no = 1) => {
    const rs: FitResponse[] = [];
    for (;;) {
      const s = nextStep(areas, rs);
      if (!s) break;
      const it = pickItem(items as (FitItem & { correct: number })[], s, new Set(rs.map((r) => r.item_id)), no)!;
      const c = pattern(rs.length, s.area_id, s.difficulty);
      rs.push({ item_id: it.id, area_id: it.area_id, difficulty: it.difficulty, choice: c ? it.correct : (it.correct + 1) % 3, correct: c });
    }
    return rs;
  };
  it('acceptance: a result is reached in 20 items or fewer (18 to 20, whatever the answers)', () => {
    let seedN = 7;
    const rand = () => { seedN = (seedN * 1103515245 + 12345) % 2147483648; return seedN / 2147483648; };
    const lens = new Set<number>();
    for (let g = 0; g < 400; g++) { const p = rand(); lens.add(play(() => rand() < p, 1 + (g % 5)).length); }
    expect(Math.max(...lens)).toBeLessThanOrEqual(MAX_ITEMS);
    expect(Math.min(...lens)).toBeGreaterThanOrEqual(18);
    expect(play(() => true).length).toBe(18);
  });
  it('routing: difficulty 2 first, then 3 after a right answer or 1 after a wrong one; weighted split areas get a confirming item', () => {
    const rs = play((_n, area, d) => (area === 'fa-safety' ? d === 2 : true));
    const safety = rs.filter((r) => r.area_id === 'fa-safety');
    expect(safety.map((r) => [r.difficulty, r.correct])).toEqual([[2, true], [3, false], [3, false]]);
    expect(rs.filter((r) => r.area_id === 'fa-info').map((r) => r.difficulty)).toEqual([2, 3]);
    expect(areaLevel([{ correct: true }, { correct: false }, { correct: true }], true)).toBe(3);
    expect(areaLevel([{ correct: false }, { correct: true }, { correct: false }], true)).toBe(0);
    expect(areaLevel([{ correct: false }, { correct: true }], false)).toBe(1);
  });
  it('acceptance: evidence from the check never exceeds level 2, even with every answer right', () => {
    const sc = scoreAttempt(areas, play(() => true));
    expect(sc.score).toBe(100);
    expect(sc.band).toBe('advanced');
    expect(sc.evidence.length).toBeGreaterThan(0);
    expect(sc.evidence.every((e) => e.level === EVIDENCE_CAP)).toBe(true);
    expect(sc.reasons.some((r) => r.code === 'fs10_cap')).toBe(true);
    expect(scoreAttempt(areas, play(() => false)).evidence).toEqual([]);
  });
  it('item checks refuse malformed items and any plant-security wording', () => {
    const ids = areas.map((a) => a.id);
    const ok = items[0] as never;
    expect(itemProblem(ok, ids)).toBeNull();
    expect(itemProblem({ ...items[0], stem_en: 'Locate the vital area' } as never, ids)).toBe('restricted');
    expect(itemProblem({ ...items[0], difficulty: 4 } as never, ids)).toBe('difficulty');
    expect(itemProblem({ ...items[0], options_ar: ['a'] } as never, ids)).toBe('options');
    expect(items.every((i) => itemProblem(i as never, ids) === null)).toBe(true);
  });
  it('quarters: the re-take window and the indicator window', () => {
    expect(quarterShift('2026-Q1', -1)).toBe('2025-Q4');
    expect(windowQuarters('2026-10-10')).toEqual(['2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4']);
  });
});

describe('FS10 · acceptance on the local backend', () => {
  it('acceptance: a live check reaches its result in 20 items or fewer, scored server-side identically to the rule', async () => {
    await as('k-ro');
    const st = await b.rpc.startFitness();
    expect(st.ok).toBe(true);
    expect(st.data!.item).not.toHaveProperty('correct');
    await b.rpc.startFitness(); // resumes the same attempt
    const { step, n } = await takeCheck((k) => k % 3 !== 1);
    expect(step.done).toBe(true);
    expect(n).toBeLessThanOrEqual(20);
    const row = (b.raw('fitness_attempts' as never) as Row[]).find((a) => a.id === step.attempt_id)!;
    const sc = scoreAttempt(areas, row.responses);
    expect([row.score, row.band, row.status]).toEqual([sc.score, sc.band, 'completed']);
    expect(step.result!.score).toBe(sc.score);
  });
  it('acceptance: evidence from the check never exceeds level 2, replaces earlier check evidence and survives recompute', async () => {
    await as('k-ro');
    const { step } = await takeCheck(() => true);
    const ev = (b.raw('skill_evidence') as Row[]).filter((e) => e.person_id === 'p-k-ro' && e.ref_table === 'fitness_attempts');
    const mine = ev.filter((e) => e.ref_id === step.attempt_id);
    expect(mine.length).toBeGreaterThan(0);
    expect(ev.every((e) => e.level <= 2 && e.kind === 'assessment')).toBe(true);
    expect(ev.filter((e) => e.active).every((e) => e.ref_id === step.attempt_id)).toBe(true);
    expect(mine.every((e) => isRecordedEvidence(e as never) && !isDerivedEvidence(e as never))).toBe(true);
    await applySkills(b, null, todayIso());
    expect((b.raw('skill_evidence') as Row[]).filter((e) => e.ref_id === step.attempt_id && e.active).length).toBe(mine.length);
    const states = (b.raw('person_skills') as Row[]).filter((p) => p.person_id === 'p-k-ro' && mine.some((e) => e.skill_id === p.skill_id));
    expect(states.every((s) => s.active && s.level >= 1)).toBe(true);
  });
  it('acceptance: the organisation indicator is suppressed under 10', async () => {
    await as('k-hr-analyst');
    const st = (await b.rpc.fitnessStats())!;
    expect(st.tested).toBeGreaterThanOrEqual(10);
    expect(typeof st.pct_above_basic).toBe('number');
    expect([...st.trend, ...st.by_family].every((x) => x.n === null || x.n >= 10)).toBe(true);
    const few = fitnessStats((T.fitness_attempts as never[]).slice(0, 9), T.people as never, areas, '2026-10-10', 10);
    expect([few.pct_above_basic, few.avg_score, few.above_basic, few.coverage_pct]).toEqual([null, null, null, null]);
    expect(few.bands.every((x) => x.n === null)).toBe(true);
  });
  it('one check per quarter: refused after completion with the next opening date; context says so', async () => {
    await as('sro');
    const r = await b.rpc.startFitness();
    expect(r.code).toBe('too_soon');
    expect(r.message).toMatch(/opens on \d{4}-\d{2}-01/);
    const ctx = (await b.rpc.fitnessContext())!;
    expect(ctx.can_start).toBe(false);
    expect(ctx.next_on).toMatch(/-01$/);
    expect(ctx.role_target).toBeGreaterThan(0);
  });
  it('RBAC: answers only for my own attempt and the item on screen; partners refused; aggregates for HR only', async () => {
    await as('k-ro');
    const st = (await b.rpc.startFitness()).data!;
    expect((await b.rpc.submitFitness({ attempt_id: st.attempt_id, item_id: 'fi-nope', choice: 0 })).code).toBe('invalid');
    expect((await b.rpc.submitFitness({ attempt_id: st.attempt_id, item_id: st.item!.id, choice: 7 })).code).toBe('invalid');
    await as('buyer');
    expect((await b.rpc.submitFitness({ attempt_id: st.attempt_id, item_id: st.item!.id, choice: 0 })).code).toBe('not_found');
    expect(await b.rpc.fitnessStats()).toBeNull();
    await as('alnoor-gm');
    expect((await b.rpc.startFitness()).code).toBe('forbidden');
    expect(await b.rpc.fitnessContext()).toBeNull();
  });
  it('item bank: the training manager writes (versioned, two active per cell kept, no security wording); others are refused', async () => {
    const base = { area_id: 'fa-ai-ethics', difficulty: 2, stem_en: 'New stem', stem_ar: 'سؤال جديد', options_en: ['a', 'b', 'c'], options_ar: ['أ', 'ب', 'ج'], correct: 0 };
    await as('k-ro');
    expect((await b.rpc.saveFitnessItem(base)).code).toBe('forbidden');
    await as('training-mgr');
    const add = await b.rpc.saveFitnessItem(base);
    expect([add.ok, add.data?.version]).toEqual([true, 1]);
    expect((await b.rpc.saveFitnessItem({ ...base, explain_en: 'See the security plan' })).code).toBe('invalid');
    const it1 = items.find((i) => i.area_id === 'fa-ai-tech' && i.difficulty === 1)!;
    expect((await b.rpc.saveFitnessItem({ ...(it1 as Record<string, unknown>), status: 'retired' } as never)).code).toBe('conflict');
    const ed = await b.rpc.saveFitnessItem({ ...(it1 as Record<string, unknown>), explain_en: 'Edited' } as never);
    expect(ed.data?.version).toBe(2);
    const aud = (b.raw('audit_events') as Row[]).filter((a) => a.action === 'ai.fitness.item');
    expect(aud.length).toBeGreaterThanOrEqual(4);
  });
});

describe('FS09/FS10 · seed, routes and i18n', () => {
  it('seed: 54 bilingual items, two per area and difficulty; attempts replay; evidence capped; Q4 already taken by the demo persona sro', () => {
    expect(items.length).toBe(54);
    for (const a of areas) for (const d of [1, 2, 3]) expect(items.filter((i) => i.area_id === a.id && i.difficulty === d).length).toBe(2);
    expect(T.skill_evidence.filter((e) => e.ref_table === 'fitness_attempts').every((e) => e.level <= 2)).toBe(true);
    expect(T.fitness_attempts.some((a) => a.person_id === 'p-sro' && a.period === '2026-Q4')).toBe(true);
    expect(T.fitness_attempts.some((a) => a.person_id === 'p-k-ro' && a.period === '2026-Q4')).toBe(false);
    const states = new Map<string, StateLite[]>();
    for (const s of T.person_skills) if (s.active) (states.get(s.person_id) ?? states.set(s.person_id, []).get(s.person_id)!).push(s as StateLite);
    const kro = aiRung('p-k-ro', cells, tracks, states.get('p-k-ro') ?? []);
    expect(kro.rung).toBeGreaterThanOrEqual(1);
    expect(DIMENSIONS.length).toBe(4);
  });
  it('routes: five M29 routes with the right guards; i18n EN/AR in parity with titles for every route', () => {
    // FS wave D QA: M29 also holds the seven FS36/FS37 routes (tests/unit/fs45-*); the five FS09/FS10 routes come first
    expect(routes.map((r) => r.id).slice(0, 5)).toEqual(['learn-ai-fluency', 'my-ai-fluency', 'my-ai-fitness', 'workforce-ai-fluency', 'training-ai-fitness-items']);
    expect(routes.length).toBe(12);
    expect(routes[0].guard).toEqual({});
    expect(routes[3].guard.grant).toEqual({ res: 'ai_literacy', levels: ['Agg'] });
    const flat = (o: Row, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [`${p}${k}`]));
    expect(flat(en).sort()).toEqual(flat(ar).sort());
    for (const r of routes) { expect((en.routes as Row)[r.id].title).toBeTruthy(); expect((ar.routes as Row)[r.id].title).toBeTruthy(); }
    expect(flat(ar).every((k) => String(k.split('.').reduce((o: Row, x) => o?.[x], ar as Row)).trim().length > 0)).toBe(true);
  });
});
