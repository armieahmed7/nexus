/** FS60 ISO 30414 skills and capability disclosure pack + FS61 skills pilots registry (FS wave G · E1, M35): one named test per acceptance
 *  criterion on the local path, plus the rules, RBAC, the seed, routes and i18n. The SQL path (kafaa_hcd_* = disclosure.ts, kafaa_spl_* =
 *  pilots.ts, the seven RPCs, RLS, grants, check constraints, seed rows) is proved by scripts/validate/fs71-disclosure-pilots.mjs (PGlite). */
import { beforeAll, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { SCHEMA } from '../../src/data/schema';
import { FEATURE_BENCHMARKS } from '../../src/domain/taxonomy';
import en from '../../src/i18n/m35.en.json';
import ar from '../../src/i18n/m35.ar.json';
import seed from '../../src/seed/seed.json';
import { routes } from '../../src/modules/m35/routes';
import {
  METRIC_KEYS, METRIC_SPEC, MIN_GROUP, approveProblem, buildPack, computeDisclosure, lineProblem, lineState, materialityOk, minutesOf, packRows, periodBounds, periodClosed,
  periodComputable, prevPeriod, varianceOf, type HcInput,
} from '../../src/modules/m35/disclosure';
import { disclosureFromTables, staffRungs } from '../../src/modules/m35/disclosureData';
import { ADOPTED, adoptionRate, closeProblem, pilotProblem, referenceOf, signoffProblem } from '../../src/modules/m35/pilots';
import { durationMinutes } from '../../src/modules/m27/xapi';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const T = (seed as unknown as { tables: Record<string, Row[]> }).tables;
let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
const raw = (t: string) => (b.raw(t as never) as unknown as Row[]);
beforeAll(async () => { b = new LocalBackend(); await b.whenReady(); await b.reset(); }, 120000);

const LINE = (metric_id: string, tag = '') => ({ metric_id, narrative_en: `Corporate functions and senior grades trail the plant in learning this year.${tag}`, narrative_ar: 'تتأخر الوظائف المؤسسية والدرجات العليا عن المحطة في التعلّم هذا العام.',
  variance_en: 'No change against the previous published quarter.', variance_ar: 'لا تغيير مقارنة بالربع المنشور السابق.' });
const PILOT = { id: 'sp-unit-check', title_en: 'A unit check pilot', title_ar: 'تجربة فحص الوحدة', hypothesis_en: 'Doing the check this way makes the result better.', hypothesis_ar: 'إجراء الفحص بهذه الطريقة يحسّن النتيجة كثيراً.',
  comparison_en: 'Teams on the old way.', comparison_ar: 'فرق تعمل بالطريقة القديمة.', pilot_n: 12, comparison_n: 14, owner_person_id: 'p-training-mgr', evaluator_person_id: 'p-compliance',
  metrics: [{ key: 'first_pass', label_en: 'First pass', label_ar: 'النجاح الأول', unit: 'pct', baseline: 80, target: 90 }], skill_ids: ['sk-co-01'], start_on: '2026-01-01', end_on: '2026-06-30', status: 'running' as const };
const SIGNOFF = { result: 'success' as const, recommendation: 'adopted' as const, result_en: 'The first-pass rate rose clearly above the comparison group.', result_ar: 'ارتفع معدل النجاح الأول بوضوح فوق مجموعة المقارنة.',
  lessons_en: 'Keep it simple.', lessons_ar: 'الإبقاء على البساطة.', metric_results: [{ key: 'first_pass', pilot: 91, comparison: 84 }] };

describe('FS60 · no metric publishes without a narrative and a second approver (acceptance 1)', () => {
  it('approveDisclosure refuses a line without a narrative, a line the approver wrote (maker-checker) and anyone but the HR director; a complete line approved by a second person publishes', async () => {
    await as('chco');
    const noNar = await b.rpc.approveDisclosure('hcd-2026-Q3', ['hcm-participation']);
    const own = await b.rpc.approveDisclosure('hcd-2026-Q3', ['hcm-critical']);
    expect(noNar.code).toBe('no_narrative');
    expect(own.code).toBe('maker_checker');
    expect(own.message).toMatch(/second person/);
    await as('k-hr-analyst');
    expect((await b.rpc.approveDisclosure('hcd-2026-Q3', ['hcm-active-learners'])).code).toBe('forbidden');
    const saved = await b.rpc.saveDisclosure({ period: '2026-Q3', lines: [LINE('hcm-participation'), { ...LINE('hcm-critical', ' Checked by the analyst.') }] });
    expect(saved.ok).toBe(true);
    await as('chco');
    const l0 = raw('ledger_local').length;
    const ok1 = await b.rpc.approveDisclosure('hcd-2026-Q3', ['hcm-active-learners', 'hcm-ai-fundamentals', 'hcm-credits']);
    expect(ok1.ok && !ok1.data!.published).toBe(true);
    expect(raw('ledger_local').length).toBe(l0 + 1);
    const ok2 = await b.rpc.approveDisclosure('hcd-2026-Q3', ['hcm-critical', 'hcm-participation']);
    expect(ok2.ok && ok2.data!.published).toBe(true);
    const row = raw('hc_disclosures').find((d) => d.id === 'hcd-2026-Q3')!;
    expect(row.status).toBe('published');
    for (const m of Object.keys(row.approvals)) expect(row.narratives[m].by).not.toBe(row.approvals[m].by);
    expect((await b.rpc.saveDisclosure({ period: '2026-Q3' })).code).toBe('published');
    await b.reset();
  }, 120000);
  it('the seeded quarters keep the rule: every approval sits on a complete EN/AR narrative written by someone else; the pack carries no value for an unapproved line', () => {
    const ids = T.hc_metrics.map((m) => m.id as string);
    for (const d of T.hc_disclosures) for (const [m, a] of Object.entries(d.approvals as Record<string, { by: string }>)) {
      expect(lineProblem({ metric_id: m, ...d.narratives[m] }, ids)).toBeNull();
      expect(d.narratives[m].by).not.toBe(a.by);
    }
    const q3 = T.hc_disclosures.find((d) => d.period === '2026-Q3')!;
    expect(lineState(q3.narratives, q3.approvals, 'hcm-participation')).toBe('missing');
    expect(approveProblem(q3 as never, 'hcm-critical', 'p-chco')).toBe('maker_checker');
    const pack = buildPack(q3, T.hc_metrics);
    expect(pack.simulated && pack.not_an_assurance).toBe(true);
    for (const m of pack.metrics) {
      expect(m.published).toBe(!!q3.approvals[m.metric_id]);
      if (!m.published) { expect(m.value).toBeNull(); expect(m.narrative_en).toBeNull(); }
    }
    expect(packRows(pack).every((r) => r.label === 'SIMULATED')).toBe(true);
  });
  it('saveDisclosure: HR analysts and the HR director only; an open quarter, an approved line and an incomplete narrative are refused (local = SQL messages)', async () => {
    await as('training-mgr');
    expect((await b.rpc.saveDisclosure({ period: '2026-Q3', lines: [LINE('hcm-participation')] })).code).toBe('forbidden');
    await as('k-hr-analyst');
    const open = await b.rpc.saveDisclosure({ period: '2026-Q4' });
    expect(['period_open', 'invalid']).toContain(open.code);
    const locked = await b.rpc.saveDisclosure({ period: '2026-Q3', lines: [{ ...T.hc_disclosures[1].narratives['hcm-trained'], metric_id: 'hcm-trained', narrative_en: 'An edited narrative that is long enough.' }] });
    expect(locked.code).toBe('locked');
    const enOnly = await b.rpc.saveDisclosure({ period: '2026-Q3', lines: [{ ...LINE('hcm-participation'), narrative_ar: 'English only, not Arabic at all' }] });
    expect(enOnly.code).toBe('invalid');
    expect(enOnly.message).toBe('Check the disclosure: an owner narrative of 20 to 1200 characters in English and in Arabic');
    await b.reset();
  }, 120000);
});

describe('FS60 · every value reproduces from its formula (acceptance 2)', () => {
  it('computeDisclosure (RPC) equals the formula on the raw tables for every quarter, and the stored seed values equal a recompute', async () => {
    await as('chco');
    const rungs = staffRungs(raw);
    for (const p of ['2025-Q1', '2025-Q4', '2026-Q1', '2026-Q2', '2026-Q3']) {
      const r = await b.rpc.computeDisclosure(p);
      expect(r.ok).toBe(true);
      expect(r.data).toEqual(disclosureFromTables(raw, p, rungs));
    }
    const q2 = T.hc_disclosures.find((d) => d.period === '2026-Q2')!;
    const q3 = T.hc_disclosures.find((d) => d.period === '2026-Q3')!;
    const seedRaw = (t: string) => T[t] ?? [];
    expect(q2.metric_values).toEqual(disclosureFromTables((t) => (t === 'hc_disclosures' ? [] : seedRaw(t)), '2026-Q2'));
    expect(q3.metric_values).toEqual(disclosureFromTables((t) => (t === 'hc_disclosures' ? [q2] : seedRaw(t)), '2026-Q3'));
  }, 120000);
  it('the formula by hand: trained share, learning hours (training records counted once) and credits for 2026-Q3 match an independent count', () => {
    const staff = new Set(T.people.filter((p) => p.kind === 'staff' && p.status === 'active').map((p) => p.id as string));
    const inYtd = (d: string) => d >= '2026-01-01' && d <= '2026-09-30';
    const trained = new Set([...T.training_records.filter((r) => staff.has(r.person_id) && ['passed', 'completed', 'attended'].includes(r.result) && inYtd(String(r.completed_on))).map((r) => r.person_id),
      ...T.xapi_statements.filter((s) => staff.has(s.actor_person_id) && ['completed', 'passed'].includes(s.verb) && inYtd(String(s.occurred_at).slice(0, 10))).map((s) => s.actor_person_id)]);
    const minutes = T.training_records.filter((r) => staff.has(r.person_id) && inYtd(String(r.completed_on))).reduce((m, r) => m + Number(r.hours) * 60, 0)
      + T.xapi_statements.filter((s) => staff.has(s.actor_person_id) && s.source !== 'm04_course' && inYtd(String(s.occurred_at).slice(0, 10))).reduce((m, s) => m + durationMinutes(s.result?.duration), 0);
    const credits = T.credit_ledger.filter((c) => staff.has(c.person_id) && c.status === 'counted' && inYtd(String(c.completed_on))).reduce((m, c) => m + Number(c.notional_hours), 0);
    const v = T.hc_disclosures.find((d) => d.period === '2026-Q3')!.metric_values.metrics as Row[];
    const by = (k: string) => v.find((m) => m.key === k)!;
    expect(by('trained_pct').value).toBe(Math.round(1000 * trained.size / staff.size) / 10);
    expect(by('hours_per_employee').value).toBe(Math.round(10 * minutes / 60 / staff.size) / 10);
    expect(by('credits_per_employee').value).toBe(Math.round(100 * credits / 10 / staff.size) / 100);
    expect(by('hours_per_employee').variance).toBe(varianceOf('hours', by('hours_per_employee').value, by('hours_per_employee').prev_value));
  });
  it('rules: quarter bounds, closed and computable periods, ISO 8601 durations (= M27 durationMinutes), variance on the unit scale', () => {
    expect(periodBounds('2026-Q3')).toEqual({ start: '2026-07-01', end: '2026-09-30', ytd: '2026-01-01' });
    expect(periodBounds('2026-Q5')).toBeNull();
    expect(periodClosed('2026-Q3', '2026-10-01')).toBe(true);
    expect(periodClosed('2026-Q4', '2026-12-31')).toBe(false);
    expect(periodComputable('2024-Q4', '2026-10-12')).toBe(false);
    expect(periodComputable('2026-Q4', '2026-10-12')).toBe(true);
    expect(prevPeriod('2026-Q1')).toBe('2025-Q4');
    for (const d of ['PT60M', 'PT1.5H', 'P1D', 'P2DT3H', 'PT90S', 'x', 'P']) expect(minutesOf(d)).toBe(durationMinutes(d));
    expect(varianceOf('credits', 2.91, 1.81)).toBe(1.1);
    expect(varianceOf('pct', 60.4, 65.1)).toBe(-4.7);
    expect(Object.keys(METRIC_SPEC)).toEqual([...METRIC_KEYS]);
  });
  it('approveDisclosure refuses stale values: new learning after the save must be recomputed (saved again) before approval', async () => {
    await as('chco');
    const pick = T.people.find((p) => p.kind === 'staff' && p.status === 'active' && !T.training_records.some((r) => r.person_id === p.id)
      && !T.xapi_statements.some((s) => s.actor_person_id === p.id && String(s.occurred_at) >= '2026-07-01' && String(s.occurred_at) < '2026-10-01'))!;
    b.rawInsert('training_records' as never, { id: 'tr-fs71-unit', person_id: pick.id, course_id: 'c-get', completed_on: '2026-08-15', hours: 2, result: 'passed', source_system: 'Training records system', evaluation_id: null, enrolment_id: null } as never);
    expect((await b.rpc.approveDisclosure('hcd-2026-Q3', ['hcm-active-learners'])).code).toBe('stale');
    await as('k-hr-analyst');
    expect((await b.rpc.saveDisclosure({ period: '2026-Q3' })).ok).toBe(true);
    await as('chco');
    expect((await b.rpc.approveDisclosure('hcd-2026-Q3', ['hcm-active-learners'])).ok).toBe(true);
    await b.reset();
  }, 120000);
});

describe('FS60 · all cells under 10 are suppressed (acceptance 3)', () => {
  const mk = (n: number, unit: string | null, crew: string | null, level: string | null, trained: boolean) => Array.from({ length: n }, (_, i) => ({ id: `x-${unit}-${crew}-${level}-${trained}-${i}`, kind: 'staff', status: 'active', unit, crew, level, trained }));
  const input = (people: ReturnType<typeof mk>): HcInput => ({
    people, training: people.filter((p) => p.trained).map((p) => ({ person_id: p.id, completed_on: '2026-08-01', hours: 2, result: 'passed' })), statements: [], credits: [],
    rungs: people.slice(0, 9).map((p) => ({ person_id: p.id, rung: 1 })), critical: [],
    metrics: METRIC_KEYS.map((k, i) => ({ id: `m-${k}`, key: k, status: 'active', sort: i })), disclosures: [],
  });
  it('a group of 9 is suppressed and a group of 10 is shown; people counts under 10 never appear; a headcount under 10 suppresses everything', () => {
    const people = [...mk(10, 'U1', 'A', 'senior', true), ...mk(9, 'U2', 'B', 'entry', false), ...mk(12, 'U3', null, 'senior', false)];
    const r = computeDisclosure(input(people), '2026-Q3', [])!;
    const cells = r.metrics.find((m) => m.key === 'participation_gap_pp')!.cells;
    expect(cells.find((c) => c.dim === 'site' && c.key === 'U2')).toEqual({ dim: 'site', key: 'U2', n: null, trained: null, not_trained: null, pct: null });
    expect(cells.find((c) => c.dim === 'site' && c.key === 'U1')).toMatchObject({ n: 10, trained: 10, not_trained: null, pct: 100 });
    expect(cells.find((c) => c.dim === 'shift' && c.key === 'day')).toMatchObject({ n: 12, pct: 0 });
    for (const c of cells) for (const k of ['n', 'trained', 'not_trained'] as const) expect(c[k] === null || (c[k] as number) >= MIN_GROUP).toBe(true);
    const ai = r.metrics.find((m) => m.key === 'ai_fundamentals_pct')!;
    expect(ai.num).toBeNull();
    expect(ai.value).toBe(29);
    expect(r.metrics.find((m) => m.key === 'trained_pct')!.num).toBe(10);
    const tiny = computeDisclosure(input(mk(9, 'U1', 'A', 'senior', true)), '2026-Q3', [])!;
    expect(tiny.headcount).toBeNull();
    expect(tiny.metrics.filter((m) => m.key !== 'critical_on_track_pct').every((m) => m.value === null && m.suppressed && (m.num === null))).toBe(true);
    expect(tiny.metrics.find((m) => m.key === 'participation_gap_pp')!.cells.every((c) => c.n === null && c.pct === null)).toBe(true);
  });
  it('the seeded disclosure suppresses every small group and reads site, shift crew and grade only (never nationality or gender)', () => {
    const q3 = T.hc_disclosures.find((d) => d.period === '2026-Q3')!.metric_values;
    const cells = (q3.metrics as Row[]).flatMap((m) => m.cells);
    expect(cells.some((c) => c.n === null)).toBe(true);
    expect(cells.every((c) => ['site', 'shift', 'grade'].includes(c.dim))).toBe(true);
    for (const m of q3.metrics as Row[]) if (m.count_kind === 'people') expect(m.num === null || m.num >= MIN_GROUP).toBe(true);
    const ids = T.people.map((p) => p.id as string);
    expect(ids.some((id) => JSON.stringify(q3).includes(`"${id}"`))).toBe(false);
    expect(JSON.stringify(q3)).not.toMatch(/nationality|gender/);
  });
});

describe('FS61 · a pilot cannot close without an evaluator sign-off (acceptance 1)', () => {
  it('closing a running pilot is refused; only the named evaluator signs off (ledger); then HR closes it (ledger); the evaluator never closes their own evaluation', async () => {
    await as('k-hr-analyst');
    expect((await b.rpc.savePilot(PILOT)).ok).toBe(true);
    await as('chco');
    const noSign = await b.rpc.closePilot('sp-unit-check', 'adopted');
    expect(noSign.code).toBe('no_signoff');
    expect(noSign.message).toBe("A pilot cannot close without the evaluator's sign-off");
    expect((await b.rpc.signoffPilot('sp-unit-check', SIGNOFF)).code).toBe('not_evaluator');
    await as('compliance');
    const l0 = raw('ledger_local').length;
    const so = await b.rpc.signoffPilot('sp-unit-check', SIGNOFF);
    expect(so.ok).toBe(true);
    expect(raw('ledger_local').length).toBe(l0 + 1);
    expect((await b.rpc.closePilot('sp-unit-check', 'adopted')).code).toBe('forbidden');
    await as('chco'); // a NEXUS role card: its ledger row is written (Kafa'a-only personas are skipped)
    const closed = await b.rpc.closePilot('sp-unit-check', 'adopted');
    expect(closed.ok).toBe(true);
    expect(raw('ledger_local').length).toBe(l0 + 2);
    const row = raw('skill_pilots').find((p) => p.id === 'sp-unit-check')!;
    expect(row).toMatchObject({ status: 'closed', adoption: 'adopted', published: true, signoff_by: 'p-compliance' });
    await as('k-hr-analyst');
    expect((await b.rpc.savePilot({ ...PILOT, id: 'sp-unit-two', evaluator_person_id: 'p-chco' })).ok).toBe(true);
    await as('chco');
    expect((await b.rpc.signoffPilot('sp-unit-two', SIGNOFF)).ok).toBe(true);
    expect((await b.rpc.closePilot('sp-unit-two', 'adopted')).code).toBe('maker_checker');
    await b.reset();
  }, 120000);
  it('the evaluator is independent: never the owner or the person registering the pilot (TS check = SQL messages)', async () => {
    const ctx = { staff: T.people.filter((p) => p.kind === 'staff' && p.status === 'active').map((p) => p.id as string), skills: T.skills.map((s) => s.id as string), creator: 'p-k-hr-analyst' };
    expect(pilotProblem(PILOT, ctx, true)).toBeNull();
    expect(pilotProblem({ ...PILOT, evaluator_person_id: 'p-training-mgr' }, ctx, true)).toBe('independence');
    expect(pilotProblem({ ...PILOT, evaluator_person_id: 'p-k-hr-analyst' }, ctx, true)).toBe('independence');
    await as('k-hr-analyst');
    const r = await b.rpc.savePilot({ ...PILOT, id: 'sp-unit-three', evaluator_person_id: 'p-training-mgr' });
    expect(r.message).toBe('Check the pilot: an independent evaluator: not the pilot owner and not the person who registered it');
    expect(signoffProblem({ ...SIGNOFF, result: 'failed' }, ['first_pass'])).toBe('recommendation');
    expect(closeProblem('expanded', 'failed')).toBe('adoption');
    expect(closeProblem('further_funded', 'failed')).toBeNull();
    for (const p of T.skill_pilots.filter((x) => x.status === 'closed' || x.status === 'evaluating')) expect(p.signoff_by).toBe(p.evaluator_person_id);
    await b.reset();
  }, 120000);
});

describe('FS61 · failed pilots stay visible (acceptance 2)', () => {
  it('both seeded failures are closed, published and read by staff; a failure closed now is published too; a closed pilot can no longer be edited', async () => {
    const failed = T.skill_pilots.filter((p) => p.result === 'failed');
    expect(failed.length).toBe(2);
    expect(failed.every((p) => p.status === 'closed' && p.published && p.adoption === 'not_adopted')).toBe(true);
    await as('k-ro');
    const seen = await b.list('skill_pilots' as never) as unknown as Row[];
    expect(seen.length).toBe(T.skill_pilots.filter((p) => p.published).length);
    expect(failed.every((f) => seen.some((s) => s.id === f.id))).toBe(true);
    await as('k-hr-analyst');
    await b.rpc.savePilot(PILOT);
    await as('compliance');
    await b.rpc.signoffPilot('sp-unit-check', { ...SIGNOFF, result: 'failed', recommendation: 'not_adopted', result_en: 'No change in the first-pass rate against the comparison group.' });
    await as('chco');
    expect((await b.rpc.closePilot('sp-unit-check', 'adopted')).code).toBe('invalid');
    expect((await b.rpc.closePilot('sp-unit-check', 'not_adopted')).ok).toBe(true);
    await as('k-ro');
    expect(((await b.list('skill_pilots' as never)) as unknown as Row[]).some((p) => p.id === 'sp-unit-check' && p.result === 'failed')).toBe(true);
    await as('chco');
    expect((await b.rpc.savePilot({ ...PILOT, status: 'running' })).code).toBe('locked');
    expect(Object.keys((b.rpc as unknown as Record<string, unknown>))).not.toEqual(expect.arrayContaining(['unpublishPilot', 'removePilot']));
    await b.reset();
  }, 120000);
});

describe('FS61 · the adoption rate is computed from pilot statuses and shows the FSC reference with its source (acceptance 3)', () => {
  it('pilotStats = adoptionRate over the rows; the reference is the FSC figure from kafaa_benchmarks with its https source; the 78 is never typed into copy', async () => {
    await as('k-ro');
    const r = await b.rpc.pilotStats();
    expect(r.ok).toBe(true);
    expect({ ...r.data, reference: undefined }).toEqual({ ...adoptionRate(T.skill_pilots as never), reference: undefined });
    expect(r.data!.rate).toBe(75);
    const fsc = T.benchmarks.find((x) => x.id === 'FSC')!;
    expect(r.data!.reference).toEqual(referenceOf(T.benchmarks));
    expect(r.data!.reference!.value).toBe(fsc.figures.find((f: Row) => f.key === 'adoption_rate').value);
    expect(r.data!.reference!.url).toMatch(/^https:\/\/fsc-ccf\.ca\//);
    expect(JSON.stringify(en)).not.toMatch(/\b78\b/);
    expect(JSON.stringify(ar)).not.toMatch(/\b78\b|٧٨/);
    await as('alnoor-gm');
    expect((await b.rpc.pilotStats()).code).toBe('forbidden');
  }, 120000);
  it('adoptionRate: adopted, expanded and further funded count; failures stay in the denominator; no closed pilot gives no rate', () => {
    expect(ADOPTED).toEqual(['adopted', 'expanded', 'further_funded']);
    const s = adoptionRate([{ id: 'a', status: 'closed', adoption: 'adopted' }, { id: 'b', status: 'closed', adoption: 'not_adopted', result: 'failed' }, { id: 'c', status: 'closed', adoption: 'further_funded' }, { id: 'd', status: 'running' }]);
    expect(s).toMatchObject({ closed: 3, failed: 1, running: 1, rate: 66.7 });
    expect(adoptionRate([{ id: 'x', status: 'running' }]).rate).toBeNull();
  });
});

describe('FS60/FS61 · RBAC, routes, benchmarks and i18n', () => {
  it('the disclosure pack is read with workforce_strategy R/W/A only; the registry by HR, L&D, admins and auditors; staff read published pilots only', async () => {
    for (const [p, n] of [['chco', 2], ['k-hr-analyst', 2], ['k-auditor', 2], ['k-admin', 2], ['training-mgr', 0], ['k-ro', 0], ['alnoor-gm', 0]] as const) {
      await as(p);
      expect(((await b.list('hc_disclosures' as never)) as unknown[]).length, p).toBe(n);
    }
    for (const [p, n] of [['training-mgr', 11], ['k-auditor', 11], ['buyer', 8], ['alnoor-gm', 0]] as const) {
      await as(p);
      expect(((await b.list('skill_pilots' as never)) as unknown[]).length, p).toBe(n);
    }
    await as('head-sq');
    expect(((await b.list('skill_pilots' as never)) as Row[]).map((x) => x.id)).toEqual(expect.arrayContaining(['sp-rotation-buddies']));
    await as('training-mgr');
    expect((await b.rpc.computeDisclosure('2026-Q3')).code).toBe('forbidden');
    expect(SCHEMA.hc_disclosures.write.mode).toBe('rpc');
    expect(SCHEMA.skill_pilots.write.mode).toBe('rpc');
    expect(Object.keys(SCHEMA.hc_metrics.cols).some((c) => /value|pct/.test(c))).toBe(false);
  }, 120000);
  it('six routes: the pack needs workforce_strategy R/W/A, the registry WS, the staff page internal_content R; benchmarks; EN/AR keys', () => {
    const r = Object.fromEntries(routes.map((x) => [x.id, x]));
    for (const id of ['workforce-disclosure', 'workforce-disclosure-metrics', 'workforce-disclosure-pack']) expect((r[id].guard as Row).grant).toEqual({ res: 'workforce_strategy', levels: ['R', 'W', 'A'] });
    for (const id of ['workforce-pilots', 'workforce-pilot']) expect((r[id].guard as Row).grant.levels).toEqual(['Agg', 'R', 'W', 'A']);
    expect((r['skills-pilots'].guard as Row).grant).toEqual({ res: 'internal_content', levels: ['R'] });
    expect(FEATURE_BENCHMARKS.FS60).toEqual(['ISO30414', 'EU-PACT', 'UAE-PEERS']);
    expect(FEATURE_BENCHMARKS.FS61).toEqual(['FSC']);
    for (const id of ['workforce-disclosure', 'workforce-disclosure-metrics', 'workforce-disclosure-pack', 'workforce-pilots', 'workforce-pilot', 'skills-pilots']) {
      expect((en.routes as Row)[id].title).toBeTruthy();
      expect((ar.routes as Row)[id].title).toMatch(/[؀-ۿ]/);
    }
    expect(materialityOk(T.hc_disclosures[0].materiality_en, T.hc_disclosures[0].materiality_ar)).toBe(true);
  });
});
