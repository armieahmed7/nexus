/** [G3] M07 workforce analytics: suppression, observer release, HR planning RPCs on the LocalBackend. */
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { shareRows, latestPeriod, csvWatermark, benchStatus, projectScenario } from '../../src/modules/m07/metrics';

let b: LocalBackend;
async function as(persona: string | null) {
  b.setPersona(persona);
  await b.whenReady();
}
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});

describe('aggregate analytics', () => {
  it('filtering to a group of 7 people shows suppressed rather than values', async () => {
    await as('k-hr-analyst');
    const rows = await b.rpc.workforceAggregate('2026-Q3', null);
    const shares = shareRows(rows, 'family', 'emirati');
    const safeguards = shares.find((s) => s.key === 'safeguards')!;
    expect(safeguards.suppressed).toBe(true);
    expect(safeguards.value).toBeNull();
    const ops = shares.find((s) => s.key === 'operations')!;
    expect(ops.suppressed).toBe(false);
    expect(ops.value).toBeGreaterThan(0);
  });
  it('managers (aggregate) never receive suppressed snapshot rows through a direct read', async () => {
    await as('sro');
    const raw = await b.list('workforce_snapshots');
    expect(raw.length).toBeGreaterThan(0);
    expect(raw.every((r) => r.group_size >= 10)).toBe(true);
  });
  it('latest period and watermark helpers', () => {
    expect(latestPeriod(['2026-Q1', '2026-Q3', '2026-Q2'])).toBe('2026-Q3');
    const w = csvWatermark('HR analyst', '2026-10-08');
    expect(w).toMatch(/HR analyst/);
    expect(w).toMatch(/2026-10-08/);
    expect(w).toMatch(/AGGREGATE/);
  });
  it('bench status compares qualified people with the HR target', () => {
    expect(benchStatus({ qualified: 84, target_bench: 90 })).toBe('at_risk');
    expect(benchStatus({ qualified: 90, target_bench: 90 })).toBe('met');
    expect(benchStatus({ qualified: 70, target_bench: 90 })).toBe('critical');
  });
  it('scenario projection is deterministic and labelled simulated', () => {
    const p = projectScenario({ units: 2, startYear: 2032, attritionPct: 5, dntIntake: 30, horizon: 2036 });
    expect(p.simulated).toBe(true);
    expect(p.years[0].year).toBeLessThanOrEqual(2027);
    expect(p.years.at(-1)!.year).toBe(2036);
    expect(p.years.at(-1)!.required).toBeGreaterThan(p.years[0].required);
  });
});

describe('observer release and HR planning', () => {
  it('an observer sees only reports released to its organisation; a fresh draft stays hidden until approved', async () => {
    await as('k-hr-analyst');
    const d = await b.rpc.draftObserverReport({ title_en: 'Emiratization Q3 2026', title_ar: 'التوطين الربع الثالث', period: '2026-Q3', tiles: [{ k: 'emiratization', v: '54.7%', src: 'SR2024' }] });
    expect(d.ok).toBe(true);
    expect((await b.rpc.observerReportAction(d.data!.id, 'submit', ['org-observer'])).ok).toBe(true);
    expect((await b.rpc.observerReportAction(d.data!.id, 'approve')).code).toBe('forbidden');
    await as('k-observer');
    expect((await b.list('observer_reports')).map((r) => r.id)).toEqual(['or-1']);
    await as('chco');
    expect((await b.rpc.observerReportAction(d.data!.id, 'approve')).ok).toBe(true);
    await as('k-observer');
    expect((await b.list('observer_reports')).map((r) => r.id).sort()).toEqual([d.data!.id, 'or-1'].sort());
  });
  it('a draft needs bilingual titles and 1-12 tiles', async () => {
    await as('k-hr-analyst');
    expect((await b.rpc.draftObserverReport({ title_en: 'x', title_ar: '', period: '2026-Q3', tiles: [] })).code).toBe('invalid');
    await as('sro');
    expect((await b.rpc.draftObserverReport({ title_en: 'Report title', title_ar: 'عنوان التقرير', period: '2026-Q3', tiles: [{ k: 'a', v: '1', src: '' }] })).code).toBe('forbidden');
  });
  it('only HR sets bench targets (with a reason) and saves SIMULATED scenarios', async () => {
    await as('sro');
    expect((await b.rpc.setBenchTarget('crit-shift-supervisor', 26, 'Fifth crew')).code).toBe('forbidden');
    await as('k-hr-analyst');
    expect((await b.rpc.setBenchTarget('crit-shift-supervisor', 26, 'no')).code).toBe('invalid');
    expect((await b.rpc.setBenchTarget('crit-shift-supervisor', 26, 'Fifth crew planned')).ok).toBe(true);
    expect((await b.get('critical_roles', 'crit-shift-supervisor'))?.target_bench).toBe(26);
    const s = await b.rpc.saveScenario({ name: 'Fifth crew', kind: 'headcount', params: { crews: 6 }, results: {} });
    expect(s.ok).toBe(true);
    expect((await b.get('scenarios', s.data!.id))?.name).toMatch(/SIMULATED/);
  });
});
