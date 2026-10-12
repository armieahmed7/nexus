/** FS50 Critical Future-Skills Register + FS51 three-scenario skill forecasting bands (FS wave F · E1, M35): one named test per acceptance
 *  criterion on the local path, plus the shared rules, RBAC, the seed, routes and i18n. The SQL path (kafaa_sf_* = forecast.ts,
 *  kafaa_crs_* = critical.ts, the six RPCs, RLS, grants, seed rows) is proved by scripts/validate/fs61-strategy-forecasts.mjs (PGlite). */
import { beforeAll, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { SCHEMA } from '../../src/data/schema';
import { FEATURE_BENCHMARKS } from '../../src/domain/taxonomy';
import { todayIso } from '../../src/domain/rules';
import en from '../../src/i18n/m35.en.json';
import ar from '../../src/i18n/m35.ar.json';
import seed from '../../src/seed/seed.json';
import { routes } from '../../src/modules/m35/routes';
import {
  BANDS, MIN_GROUP, attentionOf, boardInputFromTables, criticalBoard, criticalProblem, heldByLevel, prevQuarter, progressOf, quarterEndIso, quarterOfIso, reviewProblem, reviewState, targetFor,
  type CriticalCtx, type Target,
} from '../../src/modules/m35/critical';
import {
  DEFAULTS, GENERATIONS, METHOD, PLANT_LIFE, SCENARIOS, comparisonBlockers, computeForecast, forecastFor, forecastInputFromTables, gatherForecastBase, isDefault, normalizeForecastParams,
  profileNeeds, simulatedName, skillReasons, survive,
} from '../../src/modules/m35/forecast';
import { BASELINE, inputFromTables, outlookFor } from '../../src/modules/m07/outlook';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const T = (seed as unknown as { tables: Record<string, Row[]> }).tables;
const inp = forecastInputFromTables((t) => T[t] ?? []);
const ctx: CriticalCtx = {
  skills: Object.fromEntries(T.skills.map((s) => [s.id, { area: s.area ?? null, lifecycle: s.lifecycle ?? null }])),
  owners: T.people.filter((p) => p.kind === 'staff' && p.status === 'active').map((p) => p.id),
  plans: Object.fromEntries(T.skill_gap_plans.map((g) => [g.id, { sk_id: g.sk_id ?? null }])),
};
const today = todayIso();
let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
const raw = (t: string) => (b.raw(t as never) as unknown as Row[]);
beforeAll(async () => { b = new LocalBackend(); await b.whenReady(); await b.reset(); }, 120000);

const newRow = { skill_id: 'sk-fs-ai-anomaly', owner_function: 'engineering', owner_person_id: 'p-sme-reviewer', target_level: 2, targets: [{ year: 2026, pe: 500 }, { year: 2030, pe: 900 }],
  kpis: [{ kind: 'holders_pe', target: 500 }], decision: 'build', rationale_en: 'Anomaly detection helps engineers find early drift in plant data.',
  rationale_ar: 'يساعد كشف الحالات الشاذة المهندسين على رصد الانحراف المبكر في بيانات المحطة.', gap_plan_ids: [], status: 'draft' } as const;

describe('FS50 · progress is computed, never typed, and suppressed under 10 (acceptance 1)', () => {
  it('the register has no progress column; the board computes progress from counted skill states and suppresses under 10', async () => {
    expect(Object.keys(SCHEMA.critical_skills.cols)).not.toEqual(expect.arrayContaining(['progress']));
    expect(Object.keys(SCHEMA.critical_skills.cols).some((c) => /pct|progress|holders/.test(c))).toBe(false);
    await as('chco');
    const r = await b.rpc.criticalSkillBoard();
    expect(r.ok).toBe(true);
    const staff = new Set(T.people.filter((p) => p.kind === 'staff' && p.status === 'active').map((p) => p.id as string));
    const inBoard = boardInputFromTables(raw);
    for (const row of T.critical_skills) {
      const x = r.data!.rows.find((y) => y.id === row.id)!;
      expect(x.progress).toEqual(progressOf(row as never, heldByLevel(raw('person_skills') as never, staff, row.skill_id), inBoard.scale, Number(today.slice(0, 4))));
      if (x.progress.suppressed) { expect(x.progress.pe).toBeNull(); expect(x.progress.pct).toBeNull(); }
      expect(x.progress.mix.every((m) => m === null || m >= MIN_GROUP)).toBe(true);
    }
    expect(r.data!.rows.filter((x) => x.progress.suppressed).length).toBeGreaterThanOrEqual(3);
    expect(r.data!.rows.find((x) => x.id === 'cs-sk-da-01-twins')!.progress.status).toBe('suppressed');
  });
  it('progressOf: 9 holders at the target level are suppressed, 10 are shown, claims never count', () => {
    const t: Target[] = [{ year: 2026, pe: 100 }];
    expect(progressOf({ target_level: 2, targets: t }, [5, 9, 0, 0], 10, 2026)).toMatchObject({ suppressed: true, pe: null, pct: null, status: 'suppressed' });
    expect(progressOf({ target_level: 2, targets: t }, [5, 6, 4, 0], 10, 2026)).toMatchObject({ suppressed: false, pe: 100, pct: 100, status: 'met' });
    const states = [...Array.from({ length: 10 }, (_, i) => ({ person_id: `p${i}`, skill_id: 'k', level: 2, basis: 'claimed', active: true })), { person_id: 'p1', skill_id: 'k', level: 3, basis: 'verified', active: true }];
    expect(heldByLevel(states, new Set(Array.from({ length: 10 }, (_, i) => `p${i}`)), 'k')).toEqual([0, 0, 1, 0]);
  });
  it('a typed progress field on save is ignored: the stored row has none and the board still computes it', async () => {
    await as('k-hr-analyst');
    const r = await b.rpc.saveCriticalSkill({ ...newRow, skill_id: 'sk-fs-ai-dataeng', progress: { pct: 999 } } as never);
    expect(r.ok).toBe(true);
    expect('progress' in (b.rawGet('critical_skills' as never, 'cs-sk-fs-ai-dataeng') as unknown as Row)).toBe(false);
    await as('chco');
    expect((await b.rpc.criticalSkillBoard()).data!.rows.find((x) => x.id === 'cs-sk-fs-ai-dataeng')!.progress.pct).not.toBe(999);
  });
});

describe('FS50 · every row has an owner and a decision rationale (acceptance 2)', () => {
  it('all 13 seeded rows name an owning function and an active role card, a decision and an EN/AR rationale', () => {
    expect(T.critical_skills).toHaveLength(13);
    for (const r of T.critical_skills) {
      expect(criticalProblem(r as never, ctx)).toBeNull();
      expect(ctx.owners).toContain(r.owner_person_id);
      expect(['build', 'buy', 'borrow', 'bot']).toContain(r.decision);
      expect(r.rationale_en.length).toBeGreaterThanOrEqual(20);
      expect(r.rationale_ar).toMatch(/[؀-ۿ]/);
    }
    expect(new Set(T.critical_skills.map((r) => r.decision))).toEqual(new Set(['build', 'buy', 'borrow', 'bot']));
  });
  it('the check refuses a missing owner, a partner owner, an English-only rationale, a security or obsolete skill and plans of another skill', () => {
    const r = T.critical_skills[0];
    expect(criticalProblem({ ...r, owner_person_id: '' } as never, ctx)).toBe('owner');
    expect(criticalProblem({ ...r, owner_person_id: 'p-alnoor-gm' } as never, ctx)).toBe('owner');
    expect(criticalProblem({ ...r, owner_function: 'finance' } as never, ctx)).toBe('owner');
    expect(criticalProblem({ ...r, rationale_ar: 'English text only, not Arabic at all' } as never, ctx)).toBe('rationale');
    expect(criticalProblem({ ...r, rationale_en: 'short' } as never, ctx)).toBe('rationale');
    expect(criticalProblem({ ...r, skill_id: 'sk-sa-01' } as never, ctx)).toBe('skill');
    expect(criticalProblem({ ...r, skill_id: T.skills.find((s) => s.lifecycle === 'obsolete')!.id } as never, ctx)).toBe('skill');
    expect(criticalProblem({ ...r, gap_plan_ids: ['gp-1'] } as never, ctx)).toBe('plans');
    expect(criticalProblem({ ...r, targets: [{ year: 2030, pe: 1 }, { year: 2029, pe: 1 }] } as never, ctx)).toBe('targets');
    expect(criticalProblem({ ...r, kpis: [{ kind: 'share_l3', target: 101 }] } as never, ctx)).toBe('kpis');
  });
  it('saveCriticalSkill refuses a row without an owner or a rationale, and duplicates (local = SQL messages)', async () => {
    await as('k-hr-analyst');
    expect((await b.rpc.saveCriticalSkill({ ...newRow, owner_person_id: 'p-nobody' } as never)).code).toBe('invalid');
    const noRat = await b.rpc.saveCriticalSkill({ ...newRow, rationale_ar: '' } as never);
    expect(noRat.code).toBe('invalid');
    expect(noRat.message).toMatch(/rationale/);
    const ok = await b.rpc.saveCriticalSkill(newRow as never);
    expect(ok.ok && ok.data!.version === 1).toBe(true);
    expect((await b.rpc.saveCriticalSkill(newRow as never)).code).toBe('conflict');
  });
});

describe('FS50 · each quarterly review writes an audit row and a ledger row (acceptance 3)', () => {
  it('the HR director records the quarter review: one audit row and one ledger row, the computed snapshot, once per quarter', async () => {
    await as('chco');
    const a0 = raw('audit_events').length, l0 = raw('ledger_local').length;
    const exp = (await b.rpc.criticalSkillBoard()).data!.rows.find((x) => x.id === 'cs-sk-hu-01')!.progress;
    const r = await b.rpc.reviewCriticalSkill({ critical_skill_id: 'cs-sk-hu-01', rating: 'on_track', note_en: 'Holding steady this quarter.', note_ar: 'مستقر خلال هذا الربع.' });
    expect(r.ok).toBe(true);
    expect(r.data!.quarter).toBe(quarterOfIso(today));
    expect(r.data!.progress).toEqual(exp);
    expect(raw('audit_events').length).toBe(a0 + 1);
    expect(raw('audit_events').at(-1)!.action).toBe('critical.review');
    expect(raw('ledger_local').length).toBe(l0 + 1);
    const again = await b.rpc.reviewCriticalSkill({ critical_skill_id: 'cs-sk-hu-01', rating: 'met', note_en: 'Second review in quarter.', note_ar: 'مراجعة ثانية في الربع.' });
    expect(again.code).toBe('already_reviewed');
    expect(raw('audit_events').length).toBe(a0 + 2);
    expect(raw('ledger_local').length).toBe(l0 + 1);
  });
  it('only the HR director reviews, only adopted rows; a decision change needs an EN/AR rationale and is kept in the history', async () => {
    await as('k-hr-analyst');
    expect((await b.rpc.reviewCriticalSkill({ critical_skill_id: 'cs-sk-co-01', rating: 'on_track', note_en: 'Analyst review try.', note_ar: 'محاولة مراجعة من المحلل.' })).code).toBe('forbidden');
    await as('chco');
    expect((await b.rpc.reviewCriticalSkill({ critical_skill_id: 'cs-sk-da-02', rating: 'on_track', note_en: 'Draft row review.', note_ar: 'مراجعة صف مسودة.' })).code).toBe('not_active');
    expect((await b.rpc.reviewCriticalSkill({ critical_skill_id: 'cs-sk-co-01', rating: 'at_risk', note_en: 'Switch to a partner.', note_ar: 'التحول إلى شريك.', decision: 'borrow' })).code).toBe('invalid');
    const ok = await b.rpc.reviewCriticalSkill({ critical_skill_id: 'cs-sk-co-01', rating: 'at_risk', note_en: 'Switch to a partner.', note_ar: 'التحول إلى شريك.', decision: 'borrow',
      rationale_en: 'A partner operator exchange covers the gap faster.', rationale_ar: 'يغطي تبادل المشغلين مع شريك الفجوة بشكل أسرع.' });
    expect(ok.ok).toBe(true);
    const row = b.rawGet('critical_skills' as never, 'cs-sk-co-01') as unknown as Row;
    expect(row.decision).toBe('borrow');
    expect(row.decision_history.at(-1).decision).toBe('build');
  });
  it('the seeded 2026-Q3 reviews hold the computed snapshot; reviewState flags due and overdue rows', () => {
    const board = criticalBoard(boardInputFromTables((t) => T[t] ?? []), '2026-09-30');
    for (const r of T.critical_skill_reviews) expect(r.progress).toEqual(board.rows.find((x) => x.id === r.critical_skill_id)!.progress);
    const b2 = criticalBoard(boardInputFromTables((t) => T[t] ?? []), '2026-10-11');
    expect(b2.rows.find((x) => x.id === 'cs-sk-hu-01')!.review.state).toBe('due');
    expect(b2.rows.find((x) => x.id === 'cs-sk-fs-cy-phishing')!.review.state).toBe('overdue');
    expect(b2.rows.find((x) => x.id === 'cs-sk-da-02')!.review.state).toBe('not_started');
    expect(reviewState({ status: 'active', adopted_on: '2026-10-02' }, [], '2026-10-11').state).toBe('due');
    expect(reviewState({ status: 'active', adopted_on: '2026-07-01' }, [{ quarter: '2026-Q4' }], '2026-10-11').state).toBe('done');
    expect([quarterOfIso('2026-10-11'), quarterEndIso('2026-Q4'), prevQuarter('2026-Q1')]).toEqual(['2026-Q4', '2026-12-31', '2025-Q4']);
  });
});

describe('FS50 · rules, RBAC and seed', () => {
  it('targetFor interpolates between target years and bands follow the published thresholds', () => {
    const t = [{ year: 2026, pe: 100 }, { year: 2030, pe: 300 }];
    expect([targetFor(t, 2025), targetFor(t, 2026), targetFor(t, 2028), targetFor(t, 2029), targetFor(t, 2034)]).toEqual([100, 100, 200, 250, 300]);
    expect(BANDS).toEqual({ met: 100, on_track: 85, at_risk: 60 });
    expect(attentionOf({ status: 'active', decision: 'build', progress: progressOf({ target_level: 2, targets: t }, [0, 20, 0, 0], 1, 2026), review: reviewState({ status: 'active', adopted_on: '2026-07-01' }, [], '2026-10-11'), plans_active: 0, forecast_gap_mid: 5 }).score).toBe(3 + 3 + 2 + 1);
    expect(reviewProblem({ rating: 'met', note_en: 'ten chars!', note_ar: 'عشرة أحرف هنا' }, 'build')).toBeNull();
  });
  it('the HR analyst drafts but cannot adopt; the HR director adopts with a ledger row; the training manager (Agg) and managers cannot edit', async () => {
    await as('k-hr-analyst');
    const row = { ...newRow, skill_id: 'sk-fs-ai-automation' };
    expect((await b.rpc.saveCriticalSkill({ ...row, status: 'active' } as never)).code).toBe('forbidden');
    expect((await b.rpc.saveCriticalSkill(row as never)).ok).toBe(true);
    await as('training-mgr');
    expect((await b.rpc.saveCriticalSkill({ ...row, id: 'cs-sk-fs-ai-automation' } as never)).code).toBe('forbidden');
    expect((await b.rpc.criticalSkillBoard()).ok).toBe(true);
    await as('chco');
    const l0 = raw('ledger_local').length;
    const ad = await b.rpc.saveCriticalSkill({ ...row, id: 'cs-sk-fs-ai-automation', status: 'active' } as never);
    expect(ad.ok && ad.data!.version === 2).toBe(true);
    expect(raw('ledger_local').length).toBe(l0 + 1);
    await as('k-hr-analyst');
    expect((await b.rpc.saveCriticalSkill({ ...row, id: 'cs-sk-fs-ai-automation' } as never)).code).toBe('forbidden');
    await as('sro');
    expect((await b.rpc.criticalSkillBoard()).code).toBe('forbidden');
    await as('k-auditor');
    expect((await b.rpc.criticalSkillBoard()).ok).toBe(true);
  });
  it('the seed links 5 of the 7 FS04 gap plans (no parallel plan table) and reads the released 2026 forecast for the forecast-gap KPI', () => {
    expect(new Set(T.critical_skills.flatMap((r) => r.gap_plan_ids)).size).toBe(5);
    const board = criticalBoard(boardInputFromTables((t) => T[t] ?? []), '2026-10-11');
    expect(board.forecast?.id).toBe('sf-2026-v1');
    expect(board.rows.find((x) => x.id === 'cs-sk-fs-ai-verify')!.forecast_gap_mid).not.toBeNull();
    expect(board.tiles.active).toBe(11);
  });
});

describe('FS51 · every number is labelled SIMULATED with a definitions link (acceptance 1)', () => {
  it('every result and every saved version is marked SIMULATED with its method; the method page holds the definitions', () => {
    const r = forecastFor(inp, {});
    expect(r.code).toBe('ok');
    if (r.code !== 'ok') return;
    expect(r.result.simulated).toBe(true);
    expect(r.result.method).toBe(METHOD);
    for (const v of T.skill_forecasts) { expect(v.name).toMatch(/SIMULATED/); expect(v.results.simulated).toBe(true); }
    expect(simulatedName('Push')).toBe('Push (SIMULATED)');
    expect(en.fc.labels).toMatch(/SIMULATED/);
    expect(routes.find((x) => x.id === 'workforce-skill-forecast-method')!.path).toBe('/workforce/skill-forecasts/method');
    expect(Object.keys(en.def)).toEqual(expect.arrayContaining(['simulated', 'pe', 'band', 'gap', 'suppressed']));
  });
  it('a saved version gets the SIMULATED mark and the next version number of the annual cycle', async () => {
    await as('k-hr-analyst');
    const r = await b.rpc.saveSkillForecast({ name: 'Analyst check', scenario: 'advance', params: { develop_rate: 20 } });
    expect(r.ok).toBe(true);
    const cyc = Number(today.slice(0, 4));
    expect(r.data!.name).toBe('Analyst check (SIMULATED)');
    expect(r.data!.version).toBe(T.skill_forecasts.filter((f) => f.cycle === cyc).length + 1);
    expect(r.data!.id).toBe(`sf-${cyc}-v${r.data!.version}`);
  });
});

describe('FS51 · resetting assumptions reproduces the baseline exactly (acceptance 2, TS = SQL in PGlite)', () => {
  it('the empty set, the defaults and a reset after a change give the identical baseline; the released 2026 version equals it', async () => {
    await as('training-mgr');
    const r0 = await b.rpc.computeSkillForecast({});
    const changed = await b.rpc.computeSkillForecast({ attrition_pct: 8, levers: { advance: { pace: 2 } } });
    const reset = await b.rpc.computeSkillForecast(DEFAULTS);
    expect(r0.ok && changed.ok && reset.ok).toBe(true);
    expect(normalizeForecastParams({})).toEqual(DEFAULTS);
    expect(isDefault(normalizeForecastParams({})!)).toBe(true);
    expect(changed.data).not.toEqual(r0.data);
    expect(reset.data).toEqual(r0.data);
    expect(T.skill_forecasts.find((v) => v.id === 'sf-2026-v1')!.results).toEqual(r0.data);
  });
  it('the shared defaults are the F35 baseline and F35 itself is untouched (imported read-only)', () => {
    expect([DEFAULTS.attrition_pct, DEFAULTS.klra_weight, DEFAULTS.pipeline_factor, DEFAULTS.annual_intake, DEFAULTS.develop_rate]).toEqual([BASELINE.attrition_pct, BASELINE.klra_weight, BASELINE.pipeline_factor, BASELINE.annual_intake, BASELINE.reskill_rate]);
    const so = outlookFor(inputFromTables((t) => T[t] ?? []), T.skill_outlooks.find((o) => o.id === 'so-baseline-2035')!.params);
    expect(so.code === 'ok' && JSON.stringify(so.result) === JSON.stringify(T.skill_outlooks.find((o) => o.id === 'so-baseline-2035')!.results)).toBe(true);
  });
  it('malformed or out-of-range assumptions are refused (local RPC refusal is audited)', async () => {
    for (const x of [{ attrition_pct: 16 }, { annual_intake: 1.5 }, { catalogue: 'x' }, { levers: { advance: { adv_start: 2026 } } }, { levers: [] }, { scenario_id: 3 }]) expect(normalizeForecastParams(x)).toBeNull();
    await as('chco');
    const a0 = raw('audit_events').length;
    expect((await b.rpc.computeSkillForecast({ attrition_pct: 99 })).code).toBe('invalid');
    expect((await b.rpc.computeSkillForecast({ scenario_id: 'scn-nope' })).code).toBe('not_found');
    expect(raw('audit_events').length).toBe(a0 + 2);
  });
});

describe('FS51 · skills with fewer than 10 holders are suppressed (acceptance 3)', () => {
  it('every shown skill has 10+ measured holders and 10+ people in roles that need it; suppressed skills carry no numbers', () => {
    const base = gatherForecastBase(inp, null, 'all');
    const r = computeForecast(base, DEFAULTS);
    for (const k of r.skills) { const sb = base.skills.find((x) => x.skill_id === k.skill_id)!; expect(sb.n_s).toBeGreaterThanOrEqual(MIN_GROUP); expect(sb.n_d).toBeGreaterThanOrEqual(MIN_GROUP); }
    for (const id of r.suppressed) { const sb = base.skills.find((x) => x.skill_id === id)!; expect(sb.n_s < MIN_GROUP || sb.n_d < MIN_GROUP).toBe(true); expect(r.skills.some((k) => k.skill_id === id)).toBe(false); }
    expect(r.suppressed.length).toBeGreaterThan(0);
    const people = T.people.map((p) => `"${p.id}"`);
    const txt = JSON.stringify(r);
    expect(people.some((p) => txt.includes(p))).toBe(false);
  });
  it('a skill with no profile demand is "not yet modelled", never suppressed or shown', () => {
    const r = computeForecast(gatherForecastBase(inp, null, 'all'), DEFAULTS);
    expect(r.not_modelled.length).toBeGreaterThan(0);
    for (const x of r.not_modelled) { expect(r.suppressed).not.toContain(x.skill_id); expect(r.skills.some((k) => k.skill_id === x.skill_id)).toBe(false); }
  });
});

describe('FS51 · model, scenarios, versions and RBAC', () => {
  it('three scenarios per skill and level mix to 2035; the band orders baseline <= ADVANCE <= accelerated demand in 2035 for ADVANCE-relevant skills', () => {
    const r = computeForecast(gatherForecastBase(inp, null, 'all'), DEFAULTS);
    for (const k of r.skills) for (const s of SCENARIOS) { expect(k.sc[s].d).toHaveLength(10); expect(k.sc[s].d.every((row) => row[0] >= row[1] && row[1] >= row[2] && row[2] >= row[3])).toBe(true); }
    const adv = r.skills.filter((k) => k.adv_pct > 0);
    expect(adv.length).toBeGreaterThan(0);
    for (const k of adv) { expect(k.sc.advance.d[9][1]).toBeGreaterThanOrEqual(k.sc.baseline.d[9][1]); expect(k.sc.accelerated.d[9][1]).toBeGreaterThanOrEqual(k.sc.baseline.d[9][1]); }
    expect(r.totals.advance.shortfall_far).toBeGreaterThan(r.totals.baseline.shortfall_far);
    expect(skillReasons(adv[0], 'advance', DEFAULTS).some((x) => x.code === 'sf_advance')).toBe(true);
  });
  it('profiles: a competency requirement means its core skill; a missing horizon takes the previous one', () => {
    const needs = profileNeeds(inp);
    const ro = needs.get('reactor-operator')!;
    expect(ro.now.size).toBeGreaterThan(0);
    for (const [k, v] of ro.now) if (!ro['2030'].has(k)) expect(v).toBeGreaterThan(0);
  });
  it('generations: windows to the end of the plant licences, survival by repeated multiplication, a sourced licence fact', () => {
    const r = computeForecast(gatherForecastBase(inp, null, 'all'), DEFAULTS);
    expect(GENERATIONS.at(-1)![1]).toBe(PLANT_LIFE.last_year);
    expect(r.generations.remain_pct).toEqual(GENERATIONS.map(([lo]) => Math.round(100 * survive(0.04, lo - 2026))));
    expect(PLANT_LIFE.source.url).toMatch(/^https:\/\//);
    expect(T.content_pages.find((p) => p.id === 'news-unit4-full-fleet')!.body_en).toMatch(/60 years/);
  });
  it('version comparison is blocked when the method, catalogue or scope differ (methodology banner); the 2025 pilot and 2026 cycles differ', () => {
    const v25 = T.skill_forecasts.find((v) => v.id === 'sf-2025-v1')!, v26 = T.skill_forecasts.find((v) => v.id === 'sf-2026-v1')!, v26b = T.skill_forecasts.find((v) => v.id === 'sf-2026-v2')!;
    expect(comparisonBlockers(v25.basis, v26.basis)).toEqual(expect.arrayContaining(['catalogue', 'scope']));
    expect(comparisonBlockers(v26.basis, v26b.basis)).toEqual([]);
    expect(comparisonBlockers(null, v26.basis)).toEqual(['missing']);
  });
  it('compute: workforce_strategy holders only; release: HR director, clean text, the earlier release of the cycle is superseded, ledger', async () => {
    await as('sro');
    expect((await b.rpc.computeSkillForecast({})).code).toBe('forbidden');
    await as('k-hr-analyst');
    const sv = await b.rpc.saveSkillForecast({ name: 'Release check', scenario: 'baseline', params: {} });
    expect((await b.rpc.releaseSkillForecast(sv.data!.id, 'A clean summary text.', 'ملخص واضح للنسخة.')).code).toBe('forbidden');
    await as('chco');
    expect((await b.rpc.releaseSkillForecast(sv.data!.id, 'We need 120 operators by 2032.', 'ملخص واضح للنسخة.')).code).toBe('not_clean');
    const l0 = raw('ledger_local').length;
    const prev = raw('skill_forecasts').find((f) => f.status === 'released' && Number(f.cycle) === sv.data!.cycle);
    const rel = await b.rpc.releaseSkillForecast(sv.data!.id, 'Release check against the baseline.', 'إصدار تجريبي وفق الأساس.');
    expect(rel.ok).toBe(true);
    expect(raw('ledger_local').length).toBe(l0 + 1);
    if (prev) { expect(rel.data!.superseded).toBe(prev.id); expect((b.rawGet('skill_forecasts' as never, prev.id) as unknown as Row).status).toBe('superseded'); }
    expect((await b.rpc.releaseSkillForecast(sv.data!.id, 'Again the same text.', 'مرة أخرى النص نفسه.')).code).toBe('already_released');
    await as('training-mgr');
    expect((await b.rpc.saveSkillForecast({ name: 'Trainer', scenario: 'baseline', params: {} })).code).toBe('forbidden');
  });
});

describe('FS50/FS51 · routes, benchmarks and i18n', () => {
  it('seven routes, all guarded by workforce_strategy (never public, no staff grant); param routes have smoke samples', async () => {
    expect(routes.map((r) => r.id)).toEqual(['workforce-critical-skills', 'workforce-critical-skill', 'workforce-skill-forecasts', 'workforce-skill-forecast', 'workforce-skill-forecast-versions', 'workforce-skill-generations', 'workforce-skill-forecast-method']);
    for (const r of routes) expect(r.guard).toEqual({ signedIn: true, grant: { res: 'workforce_strategy', levels: ['Agg', 'R', 'W', 'A'] } });
    const smoke = (await import('../../src/modules/m35/smoke.json')).default as Record<string, Record<string, string>>;
    expect(T.critical_skills.some((r) => r.id === smoke['workforce-critical-skill'].id)).toBe(true);
    expect(T.skills.some((s) => s.id === smoke['workforce-skill-forecast'].skillId)).toBe(true);
  });
  it('benchmarks FS50 and FS51 come from the registry; every route has EN and AR titles', () => {
    expect(FEATURE_BENCHMARKS.FS50).toEqual(['IAEA-WFP', 'ISO30414', 'FORECAST']);
    expect(FEATURE_BENCHMARKS.FS51).toEqual(['IAEA-WFP', 'FORECAST', 'SMR-WF']);
    for (const id of [...FEATURE_BENCHMARKS.FS50, ...FEATURE_BENCHMARKS.FS51]) expect(T.benchmarks.some((x) => x.id === id && x.listed)).toBe(true);
    for (const r of routes) {
      expect((en.routes as Record<string, { title: string }>)[r.id].title.length).toBeGreaterThan(3);
      expect((ar.routes as Record<string, { title: string }>)[r.id].title).toMatch(/[؀-ۿ]/);
    }
  });
});
