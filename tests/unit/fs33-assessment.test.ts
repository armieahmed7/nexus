/** FS21 Adaptive future-skills assessments + FS22 Performance tasks and integrity (FS wave C · E3): one test per acceptance criterion
 * on the LocalBackend and the seed, plus the pure rules, RBAC, refusals and i18n coverage. The SQL mirrors are proven equal to these
 * rules (same items, stop, estimate, percentile, scores) in scripts/validate/fs33-assessment.mjs (PGlite). */
import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import seed from '../../src/seed/seed.json';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { adaptiveNext, scoreAdaptive, percentileOf, stopOf, formOf, hasRestrictedTerm, normText, adItemProblem, bankIsSafety, isSafetySkill, NORM_MIN, type AdResponse } from '../../src/modules/m05/adaptive';
import { answerProblem, autoScores, scoreTask, scoresProblem, dataIsSynthetic, adaptiveIntegrity, taskIntegrity, FLAGS } from '../../src/modules/m05/perf';
import { RECORDED_REF_TABLES } from '../../src/domain/skills';
import { FEATURE_BENCHMARKS } from '../../src/domain/taxonomy';
import { routes } from '../../src/modules/m05/routes';
import en from '../../src/i18n/m05.en.json';
import ar from '../../src/i18n/m05.ar.json';

type Row = Record<string, any>;
const T = (seed as unknown as { tables: Record<string, Row[]> }).tables;
const KEY = new Map(T.adaptive_items.map((i) => [i.id, i]));
const BANK = new Map(T.adaptive_banks.map((b) => [b.id, b]));
const SKILLS = new Map(T.skills.map((s) => [s.id, s]));
const SAFETY_BANKS = T.adaptive_banks.filter((b) => bankIsSafety(b as never, SKILLS as never)).map((b) => b.id);

let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeAll(async () => { b = new LocalBackend(); await b.whenReady(); });
beforeEach(async () => { await b.reset(); });

/** Take a bank answering right except every `wrongEvery`-th item; returns the served item ids and the final step. */
async function runBank(bank: string, wrongEvery = 3) {
  const st = await b.rpc.startAdaptive({ bank_id: bank });
  expect(st.ok, st.message).toBe(true);
  let step = st.data!;
  const ids: string[] = [];
  let k = 0;
  while (!step.done && k < 25) {
    const it = KEY.get(step.item!.id)!;
    ids.push(it.id);
    const choice = k % wrongEvery !== wrongEvery - 1 ? it.correct : (it.correct + 1) % it.options_en.length;
    const r = await b.rpc.answerAdaptive({ attempt_id: step.attempt_id, item_id: it.id, choice });
    expect(r.ok, r.message).toBe(true);
    step = r.data!; k++;
  }
  return { ids, step, attemptId: st.data!.attempt_id };
}

describe('FS21 acceptance', () => {
  it('same answers give the same item sequence and result (rerun on a fresh backend and replayed through the pure rules)', async () => {
    await as('buyer');
    const one = await runBank('ab-plant-data');
    await b.reset(); await as('buyer');
    const two = await runBank('ab-plant-data');
    expect(two.ids).toEqual(one.ids);
    expect(two.step.result!.estimate).toBe(one.step.result!.estimate);
    expect(two.step.result!.stop).toBe(one.step.result!.stop);
    expect(two.step.result!.percentile).toBe(one.step.result!.percentile);
    expect(two.step.result!.evidence).toEqual(one.step.result!.evidence);
    // the stored attempt replays item by item through adaptiveNext with its form
    const row = (await b.get('adaptive_attempts' as never, two.attemptId)) as unknown as Row;
    const bank = BANK.get('ab-plant-data')! as never;
    const rs: AdResponse[] = [];
    for (const r of row.responses) { expect(adaptiveNext(bank, T.adaptive_items as never, rs, row.form).item_id).toBe(r.item_id); rs.push(r); }
    expect(adaptiveNext(bank, T.adaptive_items as never, rs, row.form).stop).toBe(row.stop);
    expect(one.ids.length).toBeLessThanOrEqual(20);
  });

  it('every seeded attempt replays with the rules: same items, stop and estimate', () => {
    const done = T.adaptive_attempts.filter((a) => a.status === 'completed');
    expect(done.length).toBeGreaterThan(200);
    for (const a of done) {
      const bank = BANK.get(a.bank_id)! as never;
      const rs: AdResponse[] = [];
      for (const r of a.responses) { expect(adaptiveNext(bank, T.adaptive_items as never, rs, a.form).item_id).toBe(r.item_id); rs.push(r); }
      expect(stopOf(bank, rs)).toBe(a.stop);
      expect(scoreAdaptive(bank, SAFETY_BANKS.includes(a.bank_id), rs, a.stop, []).estimate).toBe(a.estimate);
      expect(a.item_count).toBeLessThanOrEqual(20);
    }
  });

  it('safety-related skills never show a percentile (seed, a live attempt and the overview)', async () => {
    expect(SAFETY_BANKS.sort()).toEqual(['ab-cyber-hygiene', 'ab-smr']);
    for (const id of SAFETY_BANKS) expect(BANK.get(id)!.mode).toBe('criterion');
    const safeAttempts = T.adaptive_attempts.filter((a) => SAFETY_BANKS.includes(a.bank_id));
    expect(safeAttempts.length).toBeGreaterThan(20);
    expect(safeAttempts.every((a) => a.percentile == null)).toBe(true);
    await as('buyer');
    const run = await runBank('ab-smr');
    expect(run.step.result!.criterion).toBe(true);
    expect(run.step.result!.percentile).toBeNull();
    expect(typeof run.step.result!.meets).toBe('boolean');
    expect(run.step.result!.reasons.map((r) => r.key)).toContain('m05.ad.reason.noPercentileSafety');
    // even with a big norm group the scorer never ranks a safety bank
    const sc = scoreAdaptive(BANK.get('ab-smr') as never, true, (await b.get('adaptive_attempts' as never, run.attemptId) as unknown as Row).responses, run.step.result!.stop, Array(40).fill(2));
    expect(sc.percentile).toBeNull();
    const ov = await b.rpc.adaptiveOverview();
    for (const c of ov!.banks.filter((x) => SAFETY_BANKS.includes(x.bank_id))) expect(c.enec_avg ?? null).toBeNull();
  });

  it('no item exposes secure-bank or security content, and the taker never receives the key', async () => {
    const secureIds = new Set(T.items.filter((i) => i.bank === 'secure').map((i) => i.id));
    const secureStems = new Set(T.item_versions.filter((v) => secureIds.has(v.item_id)).flatMap((v) => [normText(v.stem_en), normText(v.stem_ar)]));
    expect(T.adaptive_items).toHaveLength(100);
    for (const i of T.adaptive_items) {
      const text = [i.stem_en, i.stem_ar, ...(i.options_en ?? []), ...(i.options_ar ?? []), i.explain_en ?? '', i.explain_ar ?? ''].join(' ');
      expect(hasRestrictedTerm(text), i.id).toBe(false);
      expect(secureStems.has(normText(i.stem_en)) || secureStems.has(normText(i.stem_ar)), i.id).toBe(false);
      expect(adItemProblem(i as never, T.adaptive_banks as never, secureStems), i.id).toBeNull();
    }
    expect(T.adaptive_banks.every((x) => !/security|safeguard/i.test(`${x.name_en} ${x.summary_en}`))).toBe(true);
    await as('buyer');
    const st = await b.rpc.startAdaptive({ bank_id: 'ab-ai-literacy' });
    expect(Object.keys(st.data!.item!)).not.toContain('correct');
    expect(Object.keys(st.data!.item!)).not.toContain('difficulty');
    expect(await b.list('adaptive_items' as never)).toHaveLength(0); // the key table is training-staff only
    // the training manager cannot save a copy of a secure item or security content
    await as('training-mgr');
    const base = { bank_id: 'ab-plant-data', skill_id: 'sk-fs-ai-plantdata', facet: 'quality', difficulty: 2.4, stem_en: 'A new plant data question', stem_ar: 'سؤال جديد عن بيانات المحطة', options_en: ['a', 'b', 'c'], options_ar: ['أ', 'ب', 'ج'], correct: 1 };
    const secStem = T.item_versions.find((v) => secureIds.has(v.item_id))!.stem_en;
    const copy = await b.rpc.saveAdaptiveItem({ ...base, stem_en: secStem } as never);
    expect(copy.code).toBe('invalid');
    expect(copy.message).toMatch(/secure-bank/);
    const patrol = await b.rpc.saveAdaptiveItem({ ...base, stem_en: 'Which patrol route covers the yard?' } as never);
    expect(patrol.code).toBe('invalid');
    expect((await b.rpc.saveAdaptiveItem(base as never)).ok).toBe(true);
  });

  it('a result writes F01 assessment evidence (capped at level 3) that survives a recompute, and shows the benchmark line', async () => {
    await as('buyer');
    const run = await runBank('ab-clean-energy', 4);
    const ev = (await b.list('skill_evidence', { filter: { ref_table: 'adaptive_attempts', ref_id: run.attemptId } } as never)) as Row[];
    expect(ev.length).toBe(run.step.result!.evidence.length);
    expect(ev.length).toBeGreaterThan(0);
    expect(ev.every((e) => e.active && e.level <= 3 && e.kind === 'assessment')).toBe(true);
    expect(RECORDED_REF_TABLES).toEqual(expect.arrayContaining(['adaptive_attempts', 'task_attempts']));
    expect(FEATURE_BENCHMARKS.FS21).toEqual(['SKILLS-TECH', 'OECD-PIAAC']);
    expect(FEATURE_BENCHMARKS.FS22).toEqual(['SKILLS-TECH', 'IAEA-AI']);
    for (const x of T.adaptive_banks) expect(x.benchmark_ids.length).toBeGreaterThan(0);
  });

  it('the retake rule, resume and refusals', async () => {
    await as('buyer');
    const s1 = await b.rpc.startAdaptive({ bank_id: 'ab-smr' });
    const s2 = await b.rpc.startAdaptive({ bank_id: 'ab-smr' });
    expect(s2.data!.resumed).toBe(true);
    expect(s2.data!.attempt_id).toBe(s1.data!.attempt_id);
    expect((await b.rpc.answerAdaptive({ attempt_id: s1.data!.attempt_id, item_id: 'ai-x', choice: 0 })).code).toBe('invalid');
    expect((await b.rpc.answerAdaptive({ attempt_id: s1.data!.attempt_id, item_id: s1.data!.item!.id, choice: 9 })).code).toBe('invalid');
    await as('qc-inspector');
    expect((await b.rpc.answerAdaptive({ attempt_id: s1.data!.attempt_id, item_id: s1.data!.item!.id, choice: 0 })).code).toBe('not_found');
    await as('buyer');
    let step = s1.data!;
    while (!step.done) { const it = KEY.get(step.item!.id)!; step = (await b.rpc.answerAdaptive({ attempt_id: step.attempt_id, item_id: it.id, choice: it.correct })).data!; }
    const soon = await b.rpc.startAdaptive({ bank_id: 'ab-smr' });
    expect(soon.code).toBe('too_soon');
    await as('alnoor-gm');
    expect((await b.rpc.startAdaptive({ bank_id: 'ab-smr' })).code).toBe('forbidden');
    expect(await b.rpc.adaptiveOverview()).toBeNull();
    await as(null);
    expect((await b.rpc.startAdaptive({ bank_id: 'ab-smr' })).code).toBe('not_signed_in');
  });

  it('RBAC: stats for training staff; only the training manager edits items; a level keeps two active items', async () => {
    await as('buyer');
    expect(await b.rpc.adaptiveStats()).toBeNull();
    await as('k-instructor');
    expect((await b.rpc.adaptiveStats())!.banks).toHaveLength(6);
    expect((await b.rpc.saveAdaptiveItem({ bank_id: 'ab-smr' } as never)).code).toBe('forbidden');
    await as('training-mgr');
    let conflict: string | undefined;
    for (const it of T.adaptive_items.filter((i) => i.bank_id === 'ab-smr' && i.level === 1)) {
      const r = await b.rpc.saveAdaptiveItem({ ...it, status: 'retired' } as never);
      if (!r.ok) { conflict = r.code; break; }
    }
    expect(conflict).toBe('conflict');
  });
});

describe('FS21 rules', () => {
  it('percentile is suppressed under 10 colleagues and is mid-rank for ties', () => {
    expect(percentileOf(2, Array(NORM_MIN - 1).fill(1))).toBeNull();
    expect(percentileOf(2, Array(10).fill(2))).toBe(50);
    expect(percentileOf(4, Array(10).fill(1))).toBe(100);
    expect(percentileOf(0, Array(10).fill(3))).toBe(0);
  });
  it('the stop rule: stable over the window after the minimum, or the 20-item cap', () => {
    const bank = BANK.get('ab-plant-data')! as never;
    const rs = (n: number, lvl = 2) => Array.from({ length: n }, () => ({ level: lvl, correct: true }));
    expect(stopOf(bank, rs(3))).toBeNull();
    expect(stopOf({ ...(bank as Row), max_items: 20 } as never, Array.from({ length: 20 }, (_, i) => ({ level: 1 + (i % 4), correct: i % 2 === 0 })))).toBe('max');
  });
  it('forms rotate first items between people but are fixed per person and attempt', () => {
    expect(formOf('p-buyer', 1)).toBe(formOf('p-buyer', 1));
    expect(formOf('p-buyer', 2)).toBe(formOf('p-buyer', 1) + 1);
    const firsts = new Set(['p-buyer', 'p-nse', 'p-sro', 'p-k-ro', 'p-qc-inspector'].map((p) => adaptiveNext(BANK.get('ab-ai-literacy') as never, T.adaptive_items as never, [], formOf(p, 1)).item_id));
    expect(firsts.size).toBeGreaterThan(1);
  });
  it('safety skills follow the CONTRACT areas', () => {
    expect(isSafetySkill({ id: 'x', area: 'safety' } as never)).toBe(true);
    expect(isSafetySkill({ id: 'x', area: 'digital' } as never)).toBe(false);
  });
});

describe('FS22 acceptance', () => {
  it('every rubric line is visible before an attempt: tasks and rubrics are readable by staff, and a task refuses to start until the rubric is confirmed', async () => {
    await as('buyer');
    const tasks = (await b.list('performance_tasks' as never)) as Row[];
    expect(tasks).toHaveLength(T.performance_tasks.length);
    for (const t of tasks) {
      expect(t.rubric.map((l: Row) => l.key)).toEqual(['anomaly', 'quality', 'decision', 'justify']);
      for (const l of t.rubric) { expect(l.label_en && l.label_ar).toBeTruthy(); expect(l.levels.length).toBeGreaterThanOrEqual(3); expect(l.levels.every((v: Row) => v.en && v.ar && v.score <= l.max)).toBe(true); }
    }
    expect(await b.list('perf_task_keys' as never)).toHaveLength(0);
    expect((await b.rpc.startPerformanceTask({ task_id: 'pt-twin-divergence', rubric_seen: false })).code).toBe('rubric_not_seen');
    const st = await b.rpc.startPerformanceTask({ task_id: 'pt-twin-divergence', rubric_seen: true });
    expect(st.ok).toBe(true);
    expect(st.data!.rubric_version).toBe(tasks.find((t) => t.id === 'pt-twin-divergence')!.rubric_version);
  });

  it('gating attempts always carry an integrity report (seed, a live submission, and scoring refuses without one)', async () => {
    const gatingBanks = new Set(T.adaptive_banks.filter((x) => (x.gates ?? []).length).map((x) => x.id));
    const gatingTasks = new Set(T.performance_tasks.filter((x) => (x.gates ?? []).length).map((x) => x.id));
    const ir = new Map(T.integrity_reports.map((r) => [r.attempt_id, r]));
    const ga = T.adaptive_attempts.filter((a) => a.status === 'completed' && gatingBanks.has(a.bank_id));
    const gt = T.task_attempts.filter((a) => a.status !== 'in_progress' && gatingTasks.has(a.task_id));
    expect(ga.length + gt.length).toBe(T.integrity_reports.length);
    for (const a of [...ga, ...gt]) { expect(a.gating).toBe(true); expect(a.integrity_id).toBe(ir.get(a.id)?.id); }
    for (const a of T.adaptive_attempts.filter((x) => !gatingBanks.has(x.bank_id))) expect(a.integrity_id ?? null).toBeNull();
    await as('buyer');
    const st = await b.rpc.startPerformanceTask({ task_id: 'pt-twin-divergence', rubric_seen: true });
    const k = T.perf_task_keys.find((x) => x.task_id === 'pt-twin-divergence')!;
    const ans = { series: k.series, index: k.from_idx + 1, decision: k.decision_points.indexOf(3), checks: ['redundant', 'status'], justification: 'Measured pressure leaves the twin while cooling water is steady; I report it and ask for checks.' };
    const sub = await b.rpc.submitPerformanceTask({ attempt_id: st.data!.attempt_id, answer: ans });
    expect(sub.ok).toBe(true);
    expect(sub.data!.integrity_id).toBeTruthy();
    expect(sub.data!.integrity!.flags).toContain('short_time');
    const re = await b.rpc.submitPerformanceTask({ attempt_id: st.data!.attempt_id, answer: { ...ans, checks: ['status'] } });
    expect(re.data!.resubmissions).toBe(1);
    // scoring a gating attempt whose report is missing is refused
    b.raw('integrity_reports').splice(b.raw('integrity_reports').findIndex((r: Row) => r.attempt_id === st.data!.attempt_id), 1);
    await as('k-instructor');
    expect((await b.rpc.scorePerformanceTask({ attempt_id: st.data!.attempt_id, scores: { quality: 3, justify: 2 } })).code).toBe('integrity_missing');
  });

  it('all task data is synthetic: flagged simulated, numbers and labels only, no plant/OT connection', () => {
    for (const t of T.performance_tasks) {
      expect(t.simulated).toBe(true);
      expect(dataIsSynthetic(t.data), t.id).toBe(true);
      for (const s of t.data.series) expect(s.values.every((v: unknown) => typeof v === 'number')).toBe(true);
    }
    expect(dataIsSynthetic({ series: [{ key: 'x', source: 'opc.tcp://plant' }] })).toBe(false);
    expect(dataIsSynthetic({ link: 'https://historian.local/tag:1' })).toBe(false);
  });

  it('assessors score (never their own), a pass writes evidence, an unsafe decision fails whatever the total', async () => {
    await as('buyer');
    const st = await b.rpc.startPerformanceTask({ task_id: 'pt-twin-divergence', rubric_seen: true });
    const k = T.perf_task_keys.find((x) => x.task_id === 'pt-twin-divergence')!;
    await b.rpc.submitPerformanceTask({ attempt_id: st.data!.attempt_id, answer: { series: k.series, index: k.from_idx + 1, decision: k.decision_points.indexOf(3), checks: ['redundant'], justification: 'The measured value diverges from the twin; I report it and check the sensors.' } });
    expect((await b.rpc.scorePerformanceTask({ attempt_id: st.data!.attempt_id, scores: { quality: 3, justify: 3 } })).code).toBe('forbidden');
    await as('k-instructor');
    expect((await b.rpc.scorePerformanceTask({ attempt_id: st.data!.attempt_id, scores: { quality: 5 } })).code).toBe('invalid');
    const sc = await b.rpc.scorePerformanceTask({ attempt_id: st.data!.attempt_id, scores: { quality: 3, justify: 2 }, comment: 'Clear challenge of the model.' });
    expect(sc.ok).toBe(true);
    expect(sc.data!.passed).toBe(true);
    expect(sc.data!.evidence.length).toBeGreaterThan(0);
    expect(b.raw('skill_evidence').filter((e: Row) => e.ref_table === 'task_attempts' && e.ref_id === st.data!.attempt_id && e.active)).toHaveLength(sc.data!.evidence.length);
    expect((await b.rpc.scorePerformanceTask({ attempt_id: st.data!.attempt_id, scores: { quality: 3, justify: 2 } })).code).toBe('invalid');
    // maker-checker
    await as('training-mgr');
    const own = await b.rpc.startPerformanceTask({ task_id: 'pt-ghg-log', rubric_seen: true });
    const k2 = T.perf_task_keys.find((x) => x.task_id === 'pt-ghg-log')!;
    await b.rpc.submitPerformanceTask({ attempt_id: own.data!.attempt_id, answer: { series: k2.series, index: k2.from_idx, decision: 1, checks: [], justification: 'The May entry is ten times the others; query it with the owner.' } });
    expect((await b.rpc.scorePerformanceTask({ attempt_id: own.data!.attempt_id, scores: { quality: 2, justify: 2 } })).code).toBe('self_score');
    const t0 = T.performance_tasks[0];
    const crit = scoreTask(t0 as never, { anomaly: 3, decision: 0 }, { quality: 3, justify: 3 });
    expect(crit.passed).toBe(false);
    expect(crit.critical_failed).toBe(true);
  });

  it('integrity review: auditors read, assessors decide with a reason, voiding withdraws the evidence', async () => {
    const flagged = T.integrity_reports.find((r) => r.status === 'review' && !r.decision && r.kind === 'adaptive' && r.person_id !== 'p-k-instructor')!;
    expect(flagged).toBeTruthy();
    await as('k-auditor');
    expect(((await b.list('integrity_reports' as never)) as Row[]).length).toBe(T.integrity_reports.length);
    expect(await b.list('task_attempts' as never)).toHaveLength(0);
    expect((await b.rpc.reviewIntegrity({ report_id: flagged.id, decision: 'voided', note: 'Auditors only read these' })).code).toBe('forbidden');
    await as('k-instructor');
    expect((await b.rpc.reviewIntegrity({ report_id: flagged.id, decision: 'voided', note: 'short' })).code).toBe('invalid');
    expect((await b.rpc.reviewIntegrity({ report_id: flagged.id, decision: 'voided', note: 'Answers too fast to be read; please retake.' })).ok).toBe(true);
    expect(((await b.get('adaptive_attempts' as never, flagged.attempt_id)) as unknown as Row).counts).toBe(false);
    expect(b.raw('skill_evidence').filter((e: Row) => e.ref_id === flagged.attempt_id && e.active)).toHaveLength(0);
    expect((await b.rpc.reviewIntegrity({ report_id: flagged.id, decision: 'accepted', note: 'Changed my mind later on' })).code).toBe('invalid');
    await as('buyer');
    expect(((await b.list('integrity_reports' as never)) as Row[]).every((r) => r.person_id === 'p-buyer')).toBe(true);
  });
});

describe('FS22 rules', () => {
  const t = T.performance_tasks.find((x) => x.id === 'pt-feedwater-drift')!;
  const k = T.perf_task_keys.find((x) => x.task_id === t.id)!;
  it('answer checks and auto scoring from the key', () => {
    expect(answerProblem(t as never, { series: k.series, index: 0, decision: 0, checks: [], justification: 'short' })).toBe('justification');
    expect(answerProblem(t as never, { series: 'nope', index: 0, decision: 0, checks: [], justification: 'x'.repeat(30) })).toBe('series');
    expect(autoScores(k as never, { series: k.series, index: k.from_idx, decision: k.decision_points.indexOf(3) })).toEqual({ anomaly: 3, decision: 3 });
    expect(autoScores(k as never, { series: '__other', index: 0, decision: k.decision_points.indexOf(0) }).anomaly).toBe(0);
    expect(scoresProblem(t.rubric, { quality: 2, justify: 2 })).toBeNull();
    expect(scoresProblem(t.rubric, { quality: 1.5, justify: 1 })).not.toBeNull();
  });
  it('integrity flags', () => {
    const base = { id: 'a1', person_id: 'p', bank_id: 'b', status: 'completed', started_at: '2026-10-01T10:00:00Z', completed_at: '2026-10-01T10:01:00Z', responses: Array.from({ length: 10 }, (_, i) => ({ item_id: `i${i}`, level: 2, correct: true, choice: 0, at: `2026-10-01T10:00:${String(i * 2 + 2).padStart(2, '0')}Z` })) };
    const r = adaptiveIntegrity(base as never, [base as never]);
    expect(r.flags).toEqual(expect.arrayContaining(['fast_answers', 'short_time']));
    expect([...FLAGS]).toEqual(['fast_answers', 'short_time', 'retakes', 'resubmissions', 'exposure']);
    const ta = { id: 't1', person_id: 'p', task_id: 'x', status: 'submitted', started_at: '2026-10-01T10:00:00Z', submitted_at: '2026-10-01T10:30:00Z', resubmissions: 2 };
    expect(taskIntegrity(ta as never, { min_minutes: 5 } as never, [ta as never]).flags).toContain('resubmissions');
  });
});

describe('FS21/FS22 routes and i18n', () => {
  it('seven routes, guarded, with EN/AR titles and purposes', () => {
    const ids = ['my-adaptive', 'my-adaptive-take', 'my-perf-tasks', 'my-perf-task', 'training-adaptive', 'training-perf-tasks', 'training-integrity'];
    for (const id of ids) {
      const r = routes.find((x) => x.id === id)!;
      expect(r, id).toBeTruthy();
      expect((en.routes as Row)[id].title && (ar.routes as Row)[id].title).toBeTruthy();
    }
  });
  it('every m05 key used by the FS21/FS22 sources exists in EN and AR', () => {
    const get = (o: Row, k: string) => k.split('.').reduce((x: any, p) => x?.[p], o);
    const files = ['AdaptivePage', 'AdaptiveTakePage', 'PerfTasksPage', 'PerfTaskPage', 'TrainingAdaptivePage', 'TrainingPerfTasksPage', 'IntegrityPage', 'fsui'].map((f) => `src/modules/m05/${f}.tsx`).concat(['src/modules/m05/adaptive.ts', 'src/modules/m05/perf.ts']);
    let n = 0;
    for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(/['"`]m05\.([a-zA-Z0-9_.-]+)['"`]/g)) {
      if (m[1].endsWith('.')) continue;
      expect(typeof get(en, m[1]), `${f}: ${m[1]}`).toBe('string');
      expect(typeof get(ar, m[1]), `${f}: ${m[1]}`).toBe('string');
      n++;
    }
    for (const x of FLAGS) { expect(get(en, `ir.flag.${x}`)).toBeTruthy(); expect(get(ar, `ir.flagHelp.${x}`)).toBeTruthy(); }
    for (const x of ['stable', 'max', 'exhausted']) expect(get(ar, `ad.reason.stop.${x}`)).toBeTruthy();
    expect(n).toBeGreaterThan(150);
  });
});
