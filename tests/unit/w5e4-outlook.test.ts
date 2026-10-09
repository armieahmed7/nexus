/**
 * W5 · E4 acceptance: F35 Skills supply-and-demand outlook (SIMULATED), /workforce/skills-outlook. Pure rules
 * (src/modules/m07/outlook.ts) and the local path (LocalBackend RPCs and read rules). The SQL path is
 * scripts/validate/w5e4-outlook.mjs (PGlite: SQL = TS for the base aggregates and 52 assumption sets, RBAC, release guard).
 *
 * Card acceptance:
 *   A1 Every chart and number carries SIMULATED and a definitions link (metrics registry here; page test w5e4-pages.test.tsx).
 *   A2 Outputs are aggregates only; skill families with supply below 10 people are suppressed.
 *   A3 Resetting the sliders reproduces the baseline exactly.
 *   A4 The page passes the M11 publicTextIsClean guard on any text that could be released.
 * RBAC: workforce_analytics Agg (HR) runs it, HR director saves and releases; never public; line managers read released ones.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import {
  BASELINE, BASE_YEAR, LIMITS, MIN_GROUP, NUM_PARAMS, TORNADO, bandWeight, computeOutlook, departures, familyReasons, gatherBase, growthOf, inputFromTables,
  isBaseline, normalizeParams, outlookFamilies, outlookFor, paramsEqual, project, rnd, scenarioRef, simulatedName, type OutlookBase, type OutlookResult,
} from '../../src/modules/m07/outlook';
import { OUTLOOK_ROLES, RELEASED_ROLES } from '../../src/modules/m07/backend/outlook.local';
import { METRICS } from '../../src/modules/m07/metrics';
import { publicTextIsClean } from '../../src/domain/future';
import { lintRanked } from '../../src/domain/engines';
import { checkGuard } from '../../src/auth/guards';
import { MIN_GROUP_SIZE } from '../../src/auth/policy';
import { ROUTES } from '../../src/routes/registry';
import { SCHEMA } from '../../src/data/schema';
import en from '../../src/i18n/m07.en.json';
import ar from '../../src/i18n/m07.ar.json';
import seed from '../../src/seed/seed.json';

vi.setConfig({ testTimeout: 60000, hookTimeout: 60000 });
const T = (seed as unknown as { tables: Record<string, any[]> }).tables;
const inp = inputFromTables((t) => T[t] ?? []);
const fams = outlookFamilies(inp);
const get = (k: string, o: any): string | undefined => k.split('.').reduce((v, p) => (v == null ? v : v[p]), o);
const personIds = new Set((T.people as { id: string }[]).map((p) => p.id));
const leaks = (x: unknown) => { const s = JSON.stringify(x); return [...personIds].filter((id) => s.includes(`"${id}"`)); };

let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});

/** A tiny synthetic base: one large family, one with 9 holders. */
function tinyBase(): OutlookBase {
  const fam = (key: string, n_s: number, n_d: number) => ({ key, n_s, n_d, pool: 10, klra60: { [String(BASE_YEAR + 2)]: 60 }, cohort: { [String(BASE_YEAR + 1)]: 5 }, cover: Object.fromEntries(Array.from({ length: 11 }, (_, i) => [String(BASE_YEAR + i), i < 4 ? 20 - i * 5 : 5])), lo: true, adv_m: 1, adv_t: 4 });
  return { families: [fam('big', 50, 40), fam('small', 9, 30)], adv_sum: 200, adv_n: 4, org: 0, staff: 0, scenario: null };
}

describe('F35 rules', () => {
  it('departures: retirement windows and fixed-term ends are spread in sixths, the earlier one wins; 5+ years and permanent contracts are left to attrition', () => {
    expect(departures({ contract_kind: 'permanent', retirement_band: 'within_2', contract_end_band: 'none' })).toEqual([[2027, 3], [2028, 3]]);
    expect(departures({ contract_kind: 'permanent', retirement_band: '2_5', contract_end_band: 'within_1' })).toEqual([[2029, 2], [2030, 2], [2031, 2]]);
    expect(departures({ contract_kind: 'fixed_term', retirement_band: '2_5', contract_end_band: 'within_1' })).toEqual([[2027, 6]]);
    expect(departures({ contract_kind: 'secondment', retirement_band: 'na', contract_end_band: '1_2' })).toEqual([[2028, 6]]);
    expect(departures({ contract_kind: 'fixed_term', retirement_band: '5_plus', contract_end_band: '5_plus' })).toEqual([]);
    expect([bandWeight(20, { high: 16, medium: 8 }), bandWeight(8, { high: 16, medium: 8 }), bandWeight(3, { high: 16, medium: 8 })]).toEqual([10, 7, 4]);
  });
  it('staffing scenarios: headcount scenarios scale demand from their start year (start or startYear); technology scenarios set the ADVANCE technology', () => {
    const h = scenarioRef({ id: 'x', name: 'x', kind: 'headcount', params: { units: 2, start: 2032 } });
    expect(h).toMatchObject({ units: 2, start: 2032, per_unit: 48, baseline: 190, tech: null });
    expect(growthOf(h, 2031)).toBe(1);
    expect(growthOf(h, 2032)).toBeCloseTo((190 + 96) / 190, 12);
    expect(scenarioRef({ id: 'y', name: 'y', kind: 'headcount', params: { units: '1', startYear: 2030, perUnit: 50, baseline: 200 } })).toMatchObject({ units: 1, start: 2030, per_unit: 50, baseline: 200 });
    expect(scenarioRef({ id: 'z', name: 'z', kind: 'technology', params: { technology: 'tech-bwr' } })).toMatchObject({ units: 0, tech: 'tech-bwr' });
    expect(growthOf(null, 2040)).toBe(1);
  });
  it('parameters: missing keys take the baseline; out-of-range, fractional years, unknown override families and non-numbers are refused', () => {
    expect(normalizeParams({}, fams)).toEqual(BASELINE);
    expect(normalizeParams(null, fams)).toEqual(BASELINE);
    expect(normalizeParams({ attrition_pct: 6.5, reskill_overrides: { digital: 30 } }, fams)).toMatchObject({ attrition_pct: 6.5, reskill_overrides: { digital: 30 } });
    for (const bad of [{ horizon: 2030 }, { horizon: 2033.5 }, { attrition_pct: 16 }, { attrition_pct: '4' }, { adv_factor: 1.6 }, { ossa_end: 2027 }, { scenario_id: 5 },
      { reskill_overrides: { security: 10 } }, { reskill_overrides: { digital: 41 } }, { reskill_overrides: ['x'] }]) expect(normalizeParams(bad, fams)).toBeNull();
    for (const k of NUM_PARAMS) {
      expect(LIMITS[k][0]).toBeLessThanOrEqual(BASELINE[k]);
      expect(LIMITS[k][1]).toBeGreaterThanOrEqual(BASELINE[k]);
    }
    expect(LIMITS.horizon).toEqual([2031, 2036, 1]); // 5 to 10 years ahead
    expect(isBaseline(BASELINE)).toBe(true);
    expect(isBaseline({ ...BASELINE, reskill_overrides: { digital: 15 } })).toBe(false);
    expect(paramsEqual({ ...BASELINE, reskill_overrides: { a: 1, b: 2 } }, { ...BASELINE, reskill_overrides: { b: 2, a: 1 } })).toBe(true);
    expect([rnd(2.5), rnd(-2.5), rnd(0.49999999999999994)]).toEqual([3, -2, 0]);
    expect(simulatedName('Plan A')).toBe('Plan A (SIMULATED)');
    expect(simulatedName(' Already SIMULATED ')).toBe('Already SIMULATED');
  });
  it('A2: a family with fewer than 10 measured holders (or role holders) returns its key only; totals add up shown families only', () => {
    const r = computeOutlook(tinyBase(), BASELINE);
    const small = r.families.find((f) => f.key === 'small')!;
    expect(small).toEqual({ key: 'small', suppressed: true, s0: null, d0: null, basis_n: null, years: [], horizon_gap: null, peak_gap: null, first_gap_year: null, drivers: [] });
    const big = r.families.find((f) => f.key === 'big')!;
    expect(big.suppressed).toBe(false);
    expect(r.totals.visible).toBe(1);
    expect(r.totals.suppressed).toBe(1);
    expect(r.totals.shortfall).toBe(Math.max(0, big.horizon_gap!));
    expect(MIN_GROUP).toBe(MIN_GROUP_SIZE);
  });
  it('projection: supply loses attrition and KLRA departures and gains intakes and reskilling; the KHNP handover and growth raise demand', () => {
    const base = tinyBase();
    const r0 = project(base, BASELINE).families[0];
    expect(r0.years[0]).toEqual({ year: 2026, demand: 40, supply: 50, gap: -10 });
    const noAttr = project(base, { ...BASELINE, attrition_pct: 0 }).families[0];
    expect(noAttr.years[3].supply).toBeGreaterThan(r0.years[3].supply);
    const noKlra = project(base, { ...BASELINE, klra_weight: 0 }).families[0];
    expect(noKlra.years[2].supply - r0.years[2].supply).toBeGreaterThanOrEqual(1);
    // handover: cover 20 in 2026 falls to 5 by 2029 and to 0 after the OSSA end (2030): 15 then 20 positions come back
    expect(r0.years.find((c) => c.year === 2029)!.demand).toBe(40 + 15);
    expect(r0.years.find((c) => c.year === 2031)!.demand).toBeGreaterThanOrEqual(60);
    expect(project(base, { ...BASELINE, ossa_end: 2032 }).families[0].years.find((c) => c.year === 2031)!.demand).toBeLessThan(r0.years.find((c) => c.year === 2031)!.demand);
    expect(r0.drivers.map((d) => d.code)).toEqual(expect.arrayContaining(['attrition', 'klra', 'handover', 'intake', 'reskill', 'advance']));
    expect(r0.drivers.filter((d) => d.effect === 'narrows').map((d) => d.code).sort()).toEqual(['intake', 'reskill']);
  });
  it('tornado: one bar per assumption over a fixed range, sorted by swing, measured on the cumulative shortfall', () => {
    const r = computeOutlook(gatherBase(inp, null), BASELINE);
    expect(r.tornado.map((x) => x.param).sort()).toEqual(TORNADO.map((x) => x.param).sort());
    for (let i = 1; i < r.tornado.length; i++) expect(r.tornado[i - 1].swing).toBeGreaterThanOrEqual(r.tornado[i].swing);
    const att = r.tornado.find((x) => x.param === 'attrition_pct')!;
    expect(att.low).toBe(project(gatherBase(inp, null), { ...BASELINE, attrition_pct: 2 }).totals.cumulative);
    expect(att.high).toBeGreaterThan(att.low);
    expect(r.tornado[0].swing).toBeGreaterThan(0);
  });
  it('A3: resetting to the baseline reproduces the baseline exactly (deterministic, byte-identical)', () => {
    const a = outlookFor(inp, BASELINE);
    const moved = outlookFor(inp, { attrition_pct: 9, scenario_id: 'scn-1', reskill_overrides: { digital: 40 }, adv_factor: 1.5 });
    const back = outlookFor(inp, { ...BASELINE });
    expect(a.code).toBe('ok');
    expect(JSON.stringify((moved as { result: OutlookResult }).result)).not.toBe(JSON.stringify((a as { result: OutlookResult }).result));
    expect(JSON.stringify((back as { result: OutlookResult }).result)).toBe(JSON.stringify((a as { result: OutlookResult }).result));
  });
  it('seeded demo data: a credible baseline (some families short, some covered, at least one suppressed) and the two-units scenario widens the gap', () => {
    const base = (outlookFor(inp, {}) as { result: OutlookResult }).result;
    const units = (outlookFor(inp, { scenario_id: 'scn-1' }) as { result: OutlookResult }).result;
    expect(base.totals.families_short).toBeGreaterThan(0);
    expect(base.totals.families_short).toBeLessThan(base.totals.visible);
    expect(base.totals.suppressed).toBeGreaterThan(0);
    expect(base.families.some((f) => f.key === 'security')).toBe(false);
    expect(units.totals.shortfall).toBeGreaterThan(base.totals.shortfall);
    expect(base.org_headcount).toBeGreaterThan(base.staff_sample);
    expect(leaks(base)).toEqual([]);
  });
  it('WhyThis reasons: every family carries i18n-keyed reasons in EN and AR (suppressed ones say why)', () => {
    const r = (outlookFor(inp, {}) as { result: OutlookResult }).result;
    const ranked = r.families.map((f) => ({ id: f.key, score: f.horizon_gap ?? 0, reasons: familyReasons(f, r.params) }));
    expect(lintRanked(ranked)).toEqual([]);
    for (const f of ranked) for (const x of f.reasons) { expect(get(x.key, { m07: en })).toBeTruthy(); expect(get(x.key, { m07: ar })).toBeTruthy(); }
    expect(ranked.find((x) => r.families.find((f) => f.key === x.id)!.suppressed)!.reasons[0].code).toBe('so_suppressed');
  });
  it('seed: five outlooks with results equal to a fresh computation of their parameters; release texts are clean', () => {
    const so = T.skill_outlooks;
    expect(so.length).toBe(5);
    for (const o of so) {
      const r = outlookFor(inp, o.params) as { code: string; result: OutlookResult };
      expect(r.code).toBe('ok');
      expect(JSON.stringify(r.result)).toBe(JSON.stringify(o.results));
      expect(o.name).toMatch(/SIMULATED/);
      if (o.summary_en) expect(publicTextIsClean([o.name, o.summary_en, o.summary_ar])).toBe(true);
    }
    expect(so.filter((o) => o.status === 'released').map((o) => o.id)).toEqual(['so-baseline-2035']);
  });
  it('A1: every outlook figure has a definition (EN and AR), the SIMULATED mark and a definitions anchor', () => {
    const keys = ['outlook_supply', 'outlook_demand', 'outlook_gap', 'outlook_tornado'];
    for (const k of keys) {
      const m = METRICS.find((x) => x.key === k)!;
      expect(m.sim).toBe(true);
      expect(m.table).toBe('kafaa_skill_outlooks');
      expect(get(`metric.${k}`, en)).toBeTruthy(); expect(get(`metric.${k}`, ar)).toBeTruthy();
      expect(get(`def.${k}`, en)).toMatch(/SIMULATED/); expect(get(`def.${k}`, ar)).toMatch(/محاكاة/);
    }
  });
  it('table and route: rpc-only writes, HR plan read rule, never public; HR, managers and auditors pass the guard, observers, staff and anonymous do not', () => {
    const t = SCHEMA.skill_outlooks;
    expect(t.write.mode).toBe('rpc');
    expect(t.read).toEqual([{ res: 'observer_release' }]);
    const r = ROUTES.find((x) => x.id === 'workforce-skills-outlook')!;
    expect(r.path).toBe('/workforce/skills-outlook');
    expect(r.parent).toBe('workforce');
    expect(r.zone).toBe('staff');
    const g = (roles: string[]) => checkGuard(r.guard, { status: 'signed_in', roles } as never);
    for (const ok of ['hr_director', 'hr_analyst', 'manager', 'auditor']) expect(g([ok])).toBe('ok');
    for (const no of ['observer', 'employee', 'partner_admin']) expect(g([no])).not.toBe('ok');
    expect(checkGuard(r.guard, { status: 'anonymous', roles: ['public'] } as never)).not.toBe('ok');
    expect(OUTLOOK_ROLES).not.toContain('manager');
    expect([...OUTLOOK_ROLES, ...RELEASED_ROLES]).not.toContain('observer');
  });
});

describe('F35 local backend', () => {
  it('A2: HR director, HR analyst and auditor run the outlook; suppressed families carry no value and no person id leaves the RPC', async () => {
    for (const p of ['chco', 'k-hr-analyst', 'k-auditor']) {
      await as(p);
      const r = await b.rpc.computeOutlook({});
      expect(r.ok).toBe(true);
      expect(r.data!.simulated).toBe(true);
      expect(leaks(r.data)).toEqual([]);
      for (const f of r.data!.families) if (f.suppressed) expect([f.s0, f.d0, f.years.length]).toEqual([null, null, 0]); else expect(f.basis_n!).toBeGreaterThanOrEqual(10);
    }
  });
  it('line managers, observers, employees and anonymous callers are refused the live outlook with an audit row', async () => {
    const audits = () => b.raw('audit_events').filter((e) => e.action === 'outlook.compute' && e.outcome === 'refused').length;
    const before = audits();
    for (const [p, code] of [['sro', 'forbidden'], ['k-observer', 'forbidden'], ['k-ro', 'forbidden'], [null, 'not_signed_in']] as const) {
      await as(p);
      expect((await b.rpc.computeOutlook({})).code).toBe(code);
    }
    expect(audits()).toBe(before + 4);
  });
  it('invalid assumptions and unknown scenarios are refused; reading the outlook writes no audit row', async () => {
    await as('chco');
    const n = b.raw('audit_events').length;
    expect((await b.rpc.computeOutlook({ horizon: 2050 })).code).toBe('invalid');
    expect((await b.rpc.computeOutlook({ scenario_id: 'scn-nope' })).code).toBe('not_found');
    expect(b.raw('audit_events').length).toBe(n + 2);
    await b.rpc.computeOutlook({ attrition_pct: 6 });
    expect(b.raw('audit_events').length).toBe(n + 2);
  });
  it('A3 (local RPC): baseline, a what-if, then the baseline again returns the identical baseline', async () => {
    await as('k-hr-analyst');
    const a = await b.rpc.computeOutlook(BASELINE);
    const w = await b.rpc.computeOutlook({ ...BASELINE, klra_weight: 1.5, pipeline_factor: 0.5 });
    const c = await b.rpc.computeOutlook({});
    expect(JSON.stringify(w.data)).not.toBe(JSON.stringify(a.data));
    expect(JSON.stringify(c.data)).toBe(JSON.stringify(a.data));
  });
  it('saved outlooks: HR and auditors read the table; line managers and observers read none', async () => {
    await as('chco');
    expect((await b.list('skill_outlooks')).length).toBe(5);
    await as('k-auditor');
    expect((await b.list('skill_outlooks')).length).toBe(5);
    await as('sro');
    expect((await b.list('skill_outlooks')).length).toBe(0);
    await as('k-observer');
    expect((await b.list('skill_outlooks')).length).toBe(0);
  });
  it('save (saveScenario rules): HR analyst saves with "(SIMULATED)" and server-computed results; updates own drafts only; a manager cannot save', async () => {
    await as('sro');
    expect((await b.rpc.saveOutlook({ name: 'Manager outlook', params: {} })).code).toBe('forbidden');
    await as('k-hr-analyst');
    expect((await b.rpc.saveOutlook({ name: 'ab', params: {} })).code).toBe('invalid');
    expect((await b.rpc.saveOutlook({ name: 'Bad', params: { horizon: 2040 } })).code).toBe('invalid');
    const s = await b.rpc.saveOutlook({ name: 'Unit test outlook', params: { attrition_pct: 5 } });
    expect(s.ok).toBe(true);
    const row = b.raw('skill_outlooks').find((r) => r.id === s.data!.id)!;
    expect(row.name).toBe('Unit test outlook (SIMULATED)');
    expect(row.status).toBe('draft');
    expect(row.created_by).toBe('p-k-hr-analyst');
    expect(JSON.stringify(row.results)).toBe(JSON.stringify((outlookFor(inputFromTables((t) => b.raw(t as never) as any[]), { attrition_pct: 5 }) as { result: OutlookResult }).result));
    const u = await b.rpc.saveOutlook({ id: s.data!.id, name: 'Unit test outlook v2', params: { attrition_pct: 6 } });
    expect(u.ok).toBe(true);
    const row2 = b.raw('skill_outlooks').find((r) => r.id === s.data!.id)!;
    expect([(row2.params as any).attrition_pct, row2.name]).toEqual([6, 'Unit test outlook v2 (SIMULATED)']);
    await as('chco');
    expect((await b.rpc.saveOutlook({ id: s.data!.id, name: 'Not mine', params: {} })).code).toBe('not_found');
  });
  it('A4 + release: only the HR director releases; headcount or site wording is refused by publicTextIsClean; release and withdrawal reach the ledger', async () => {
    await as('k-hr-analyst');
    const s = await b.rpc.saveOutlook({ name: 'Release test', params: {} });
    expect((await b.rpc.releaseOutlook(s.data!.id, 'Shortfalls open in operations by the end of the decade.', 'تظهر فجوات في العمليات بنهاية العقد.')).code).toBe('forbidden');
    await as('chco');
    expect((await b.rpc.releaseOutlook(s.data!.id, 'short', 'قصير')).code).toBe('invalid');
    expect((await b.rpc.releaseOutlook(s.data!.id, 'We will need 120 operators more by 2032.', 'تظهر فجوات في العمليات بنهاية العقد.')).code).toBe('not_clean');
    expect((await b.rpc.releaseOutlook(s.data!.id, 'Headcount grows in operations from 2030.', 'تظهر فجوات في العمليات بنهاية العقد.')).code).toBe('not_clean');
    expect((await b.rpc.releaseOutlook('so-nope', 'Shortfalls open in operations.', 'تظهر فجوات في العمليات.')).code).toBe('not_found');
    const ledger0 = b.raw('ledger_local').length;
    const r = await b.rpc.releaseOutlook(s.data!.id, 'Shortfalls open in operations by the end of the decade.', 'تظهر فجوات في العمليات بنهاية العقد.');
    expect(r.ok).toBe(true);
    expect(b.raw('ledger_local').length).toBe(ledger0 + 1);
    expect((await b.rpc.releaseOutlook(s.data!.id, 'Shortfalls open in operations again.', 'تظهر فجوات في العمليات مجدداً.')).code).toBe('already_released');
    await as('k-hr-analyst');
    expect((await b.rpc.saveOutlook({ id: s.data!.id, name: 'Release test', params: {} })).code).toBe('released');
    await as('sro');
    const rel = await b.rpc.releasedOutlooks();
    expect(rel.ok).toBe(true);
    expect(rel.data!.map((o) => o.id)).toEqual(expect.arrayContaining([s.data!.id, 'so-baseline-2035']));
    expect(leaks(rel.data)).toEqual([]);
    await as('k-observer');
    expect((await b.rpc.releasedOutlooks()).code).toBe('forbidden');
    await as('k-ro');
    expect((await b.rpc.releasedOutlooks()).code).toBe('forbidden');
    await as('k-hr-analyst');
    expect((await b.rpc.withdrawOutlook(s.data!.id, 'Not allowed to withdraw')).code).toBe('forbidden');
    await as('chco');
    expect((await b.rpc.withdrawOutlook(s.data!.id, 'no')).code).toBe('invalid');
    expect((await b.rpc.withdrawOutlook(s.data!.id, 'Superseded by a newer outlook')).ok).toBe(true);
    expect((await b.rpc.withdrawOutlook(s.data!.id, 'Superseded by a newer outlook')).code).toBe('not_released');
    expect(b.raw('ledger_local').length).toBe(ledger0 + 2);
    await as('sro');
    expect((await b.rpc.releasedOutlooks()).data!.some((o) => o.id === s.data!.id)).toBe(false);
  });
});
