/**
 * FS wave F · E2 · FS53 External benchmark lines, kept apart from measured numbers (M07). Pure rules (src/modules/m07/market.ts), the
 * seeded kafaa_benchmark_values and the local read rule. SQL guard parity: scripts/validate/fs62-outlook-automation.mjs.
 *
 * Card acceptance:
 *   A1 Every external value links its source and date.                                  -> 'A1: ...'
 *   A2 No external value is ever summed with an internal one (unit test).               -> 'A2: ...'
 *   A3 The two stylings are distinguishable without colour (label and line pattern).    -> 'A3: ...' (rendered: fs62-pages.test.tsx)
 * Settled decision: only figures already in kafaa_benchmarks that the research packs do not mark secondary or unverified are drawn.
 */
import { describe, expect, it, vi } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import {
  DASHBOARDS, LINE_STYLE, MEASURES, benchmarkValueProblems, heldValues, marketValues, measuresFrom, pairScale, position, sumMeasured, type BenchmarkValueRow, type MarketValue, type MeasuredValue,
} from '../../src/modules/m07/market';
import { automationFor, computeOutlook, gatherBase, inputFromTables, outlookFor, BASELINE, type OutlookResult } from '../../src/modules/m07/outlook';
import { SCHEMA } from '../../src/data/schema';
import en from '../../src/i18n/m07.en.json';
import ar from '../../src/i18n/m07.ar.json';
import seed from '../../src/seed/seed.json';

vi.setConfig({ testTimeout: 60000, hookTimeout: 60000 });
const T = (seed as unknown as { tables: Record<string, any[]> }).tables;
const rows = T.benchmark_values as BenchmarkValueRow[];
const inp = inputFromTables((t) => T[t] ?? []);
const res = (r: { code: string; result?: unknown }) => (r as { result: any }).result;
const get = (k: string, o: any): string | undefined => k.split('.').reduce((v, p) => (v == null ? v : v[p]), o);

describe('FS53 rules and seed', () => {
  it('A1: every external value is a copy of a sourced FS01 figure and links its https source and as-of date', () => {
    expect(rows.length).toBe(10);
    for (const r of rows) {
      expect(benchmarkValueProblems(r, T.benchmarks)).toEqual([]);
      const b = T.benchmarks.find((x: any) => x.id === r.benchmark_id);
      const f = b.figures.find((x: any) => x.key === r.figure_key);
      expect([r.value, r.unit, r.label_en, r.label_ar]).toEqual([f.value, f.unit, f.label_en, f.label_ar]);
      expect(r.source_url).toMatch(/^https:\/\//);
      expect(b.urls).toContain(r.source_url);
      expect(r.as_of).toBe(b.as_of);
    }
  });

  it('only figures the research packs treat as primary are drawn; secondary ones are held with a reason (settled decision)', () => {
    const shown = rows.filter((r) => r.shown);
    expect(shown.map((r) => r.benchmark_id).sort()).toEqual(['DIGCOMP', 'FORECAST', 'SSG-SF', 'UK-NUC']);
    expect(shown.every((r) => r.verification === 'primary')).toBe(true);
    const held = heldValues(rows);
    expect(held.map((r) => `${r.benchmark_id}/${r.figure_key}`)).toEqual(['WEF-FOJ/core_skills_change_2030', 'ENERGY-JOBS/firms_reporting_shortages', 'ENERGY-JOBS/energy_jobs_2024',
      'EU-PACT/people_trained', 'SMR-WF/hires_2023_2033', 'UAE-PEERS/staff_trained_ai']);
    expect(held.every((r) => r.verification !== 'primary' && r.held_reason_en.trim() && r.held_reason_ar.trim() && r.dashboards.length === 0)).toBe(true);
    expect(marketValues(rows, 'skills_outlook').map((m) => m.benchmark_id)).toEqual(['SSG-SF', 'FORECAST', 'DIGCOMP', 'UK-NUC']);
    expect(marketValues(rows, 'overview').map((m) => m.compare_to)).toEqual(['ai_task_share', 'demand_growth_2030', 'digital_holders']);
    for (const d of DASHBOARDS) expect(marketValues(rows, d).some((m) => held.some((h) => h.id === m.id))).toBe(false);
  });

  it('the guard rule refuses drift: typed values, other labels, other sources, other dates, drawn secondary figures, held rows without a reason', () => {
    const r = rows.find((x) => x.id === 'bv-ssg-sf-ai-aided-tasks')!;
    const P = (x: Partial<BenchmarkValueRow>) => benchmarkValueProblems({ ...r, ...x }, T.benchmarks);
    expect(P({ value: 25 })).toEqual(['figure']);
    expect(P({ label_en: 'Typed' })).toEqual(['label']);
    expect(P({ source_url: 'https://example.org' })).toEqual(['source']);
    expect(P({ source_url: 'http://isomer-user-content.by.gov.sg/x' })).toEqual(['source']);
    expect(P({ as_of: '2026-01-01' })).toEqual(['as_of']);
    expect(P({ verification: 'secondary' })).toEqual(['verification']);
    expect(P({ shown: false })).toEqual(['held_reason']);
    expect(P({ compare_to: 'headcount' })).toEqual(['compare']);
    expect(P({ dashboards: ['overview', 'home'] })).toEqual(['dashboards']);
    expect(P({ id: 'X' })).toEqual(['id']);
    expect(P({ benchmark_id: 'NOPE' })).toEqual(['figure', 'label', 'source', 'as_of']);
    const count = rows.find((x) => x.id === 'bv-uk-nuc-new-jobs-2030')!;
    expect(benchmarkValueProblems({ ...count, compare_to: 'ai_task_share' }, T.benchmarks)).toEqual(['compare']);
  });

  it('A2: no external value is ever summed with an internal one', () => {
    const r = res(outlookFor(inp, {})) as OutlookResult;
    const auto = res(automationFor(inp, {}));
    const ms = Object.values(measuresFrom(r, auto)) as MeasuredValue[];
    const market = marketValues(rows, 'skills_outlook')[0];
    // the summing rule accepts measured values only
    expect(typeof sumMeasured(ms)).toBe('number');
    expect(() => sumMeasured([...ms, market as unknown as MeasuredValue])).toThrow('market_value_in_sum');
    expect(() => sumMeasured([{ value: 3 } as unknown as MeasuredValue])).toThrow('not_a_measured_value');
    // measured values come from the outlook and the task layer only: the same with or without market rows in the tenant
    const inpNoMarket = inputFromTables((t) => (t === 'benchmark_values' || t === 'benchmarks' ? [] : T[t] ?? []));
    expect(JSON.stringify(measuresFrom(res(outlookFor(inpNoMarket, {})), res(automationFor(inpNoMarket, {}))))).toBe(JSON.stringify(measuresFrom(r, auto)));
    expect(measuresFrom.length).toBe(2);
    // the outlook never reads benchmark values (its inputs and totals do not change)
    expect(Object.keys(inp)).not.toContain('benchmark_values');
    expect(JSON.stringify(computeOutlook(gatherBase(inpNoMarket, null), BASELINE))).toBe(JSON.stringify(computeOutlook(gatherBase(inp, null), BASELINE)));
    // a pair is only ordered, never combined into a number
    for (const m of marketValues(rows, 'overview')) {
      const p = position(m, measuresFrom(r, auto)[m.compare_to!]);
      expect(['above', 'below', 'level', 'not_comparable', 'suppressed']).toContain(p);
      expect(typeof p).toBe('string');
    }
  });

  it('position(): same unit and measure only; suppressed measured values are never placed', () => {
    const m: MarketValue = { kind: 'market', id: 'bv-x', benchmark_id: 'SSG-SF', metric: 'ai_task_share', value: 24, unit: 'pct', scale_max: 100, as_of: '2026-10-10', source_url: 'https://x', compare_to: 'ai_task_share' };
    const x = (value: number | null, metric = 'ai_task_share'): MeasuredValue => ({ kind: 'measured', metric, value, unit: 'pct', simulated: true, suppressed: value == null, basis: 91 });
    expect(position(m, x(64))).toBe('above');
    expect(position(m, x(10))).toBe('below');
    expect(position(m, x(24))).toBe('level');
    expect(position(m, x(null))).toBe('suppressed');
    expect(position(m, x(30, 'digital_holders'))).toBe('not_comparable');
    expect(position({ ...m, unit: 'count' }, x(30))).toBe('not_comparable');
    expect(pairScale(24, 63.7)).toBe(100);
    expect(pairScale(15, 17)).toBe(30);
  });

  it('measured values: demand growth from visible families, digital share from the measured sample, AI task share from FS06 (all SIMULATED)', () => {
    const r = res(outlookFor(inp, {})) as OutlookResult;
    const auto = res(automationFor(inp, {}));
    const m = measuresFrom(r, auto);
    const vis = r.families.filter((f) => !f.suppressed);
    const d0 = vis.reduce((s, f) => s + f.years[0].demand, 0), d30 = vis.reduce((s, f) => s + f.years.find((c) => c.year === 2030)!.demand, 0);
    expect(m.demand_growth_2030.value).toBe(Math.round((1000 * (d30 - d0)) / d0) / 10);
    expect(m.digital_holders.value).toBe(Math.round((1000 * vis.find((f) => f.key === 'digital')!.basis_n!) / r.staff_sample) / 10);
    expect(m.ai_task_share.value).toBe(auto.ai_task_share);
    expect(Object.values(m).every((x) => x.kind === 'measured' && x.simulated === true && x.unit === 'pct')).toBe(true);
    expect(MEASURES).toEqual(['ai_task_share', 'demand_growth_2030', 'digital_holders']);
    const none = measuresFrom(null, null);
    expect(Object.values(none).every((x) => x.suppressed && x.value === null)).toBe(true);
  });

  it('A3: the two stylings differ in label and line pattern (not only colour), in English and Arabic', () => {
    expect(LINE_STYLE.market.pattern).toBe('dashed');
    expect(LINE_STYLE.measured.pattern).toBe('solid');
    expect(LINE_STYLE.market.label).not.toBe(LINE_STYLE.measured.label);
    expect(get(LINE_STYLE.market.label.replace(/^m07\./, ''), en)).toBe('Market statistic');
    expect(get(LINE_STYLE.measured.label.replace(/^m07\./, ''), en)).toBe('Measured at ENEC (SIMULATED)');
    const arM = get(LINE_STYLE.market.label.replace(/^m07\./, ''), ar)!, arX = get(LINE_STYLE.measured.label.replace(/^m07\./, ''), ar)!;
    expect(arM).toMatch(/[؀-ۿ]/);
    expect(arX).toMatch(/[؀-ۿ]/);
    expect(arM).not.toBe(arX);
    expect(arX).toMatch(/محاكاة/);
  });

  it('schema: seed-only reference table read wherever a workforce dashboard is visible', async () => {
    const t = SCHEMA.benchmark_values;
    expect(t.module).toBe('M07');
    expect(t.write).toEqual({ mode: 'none' });
    expect(t.read).toEqual([{ res: 'workforce_analytics', special: 'agg_ok' }]);
    const b = new LocalBackend();
    await b.whenReady();
    await b.reset();
    const n = async (p: string | null) => { b.setPersona(p); await b.whenReady(); return (await b.list('benchmark_values' as never)).length; };
    expect(await n('chco')).toBe(10);
    expect(await n('k-hr-analyst')).toBe(10);
    expect(await n('k-auditor')).toBe(10);
    expect(await n('sro')).toBe(10);
    expect(await n('k-ro')).toBe(0);
    expect(await n(null)).toBe(0);
  });
});
