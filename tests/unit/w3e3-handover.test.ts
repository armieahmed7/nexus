/**
 * W3 · E3 acceptance: F22 Handover 2030 readiness board. Pure rules (src/modules/m07/handover.ts) and the local path
 * (LocalBackend RPCs and the read rules). The SQL path is scripts/validate/w3e3-handover.mjs (PGlite: SQL = TS for both periods
 * and four scenarios, the F19 path, RBAC and the observer-safe release).
 *
 * Card acceptance:
 *   A1 All cells below 10 show "suppressed".
 *   A2 Every number carries SAMPLE or SIMULATED with a definition link (/workforce/definitions) -> metrics registry here, page test.
 *   A3 The burn-down recomputes when F19 readiness changes.
 *   A4 No person-level row reaches the client.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import {
  bandOf, cell, cohortMonths, computeHandover, coverFor, f05Months, gatherNamed, groupReasons, isWhatIf, liveRow, namedMonths, normReadiness, periodEnd,
  releaseTiles, riskList, validScenario, yearsFor, MIN_GROUP, OSSA_END_DEFAULT, type HandoverAggregate, type HoGroup,
} from '../../src/modules/m07/handover';
import { HANDOVER_ROLES } from '../../src/modules/m07/backend/local';
import { METRICS } from '../../src/modules/m07/metrics';
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
const BASE = { ossa_end: 2030, slip_months: 0 };

let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});

const cellsOf = (g: HoGroup) => [...g.cover, ...g.ready, ...g.shortfall, ...Object.values(g.bands), ...Object.values(g.pipeline), g.named, g.pipeline_total, g.max_shortfall, g.ready_total, g.emirati];
const allCells = (a: HandoverAggregate) => [a.total, ...a.functions, ...a.roles].flatMap(cellsOf);
const personIds = new Set((T.people as { id: string }[]).map((p) => p.id));
const leaks = (x: unknown) => { const s = JSON.stringify(x); return [...personIds].filter((id) => s.includes(`"${id}"`)); };
const get = (k: string, o: any): string | undefined => k.split('.').reduce((v, p) => (v == null ? v : v[p]), o);

describe('F22 rules', () => {
  it('period ends, bands, F19 readiness normalisation and HR-band months', () => {
    expect(periodEnd('2026-Q3')).toEqual({ year: 2026, month0: 8 });
    expect(periodEnd('2026-H1')).toEqual({ year: 2026, month0: 5 });
    expect(periodEnd('2027')).toEqual({ year: 2027, month0: 11 });
    expect(periodEnd('Q3')).toBeNull();
    expect([0, -3, 1, 24, 25, 60, 61].map(bandOf)).toEqual(['now', 'now', 'y1_2', 'y1_2', 'y3_5', 'y3_5', 'later']);
    expect(['ready_now', 'Ready now', '1_2y', '1-2 years', 'ready_1_2', '3_5y', '3 to 5 years', 'emergency', '', null].map(normReadiness)).toEqual(['now', 'now', 'y1_2', 'y1_2', 'y1_2', 'y3_5', 'y3_5', null, null, null]);
    expect([namedMonths('now', 30), namedMonths('y1_2', 0), namedMonths('y1_2', 40), namedMonths('y1_2', null), namedMonths('y3_5', 10), namedMonths('y3_5', null)]).toEqual([0, 1, 24, 12, 25, 42]);
    expect([f05Months('ready_now', 7), f05Months('ready_in', 14), f05Months('stretch', 70), f05Months('current', 0), f05Months('path_only', null)]).toEqual([0, 14, 70, null, null]);
    expect(liveRow({ status: 'Archived' })).toBe(false);
    expect(liveRow({ active: false })).toBe(false);
    expect(liveRow({ status: 'confirmed' })).toBe(true);
    expect(cohortMonths('2027-03-31', 2026, 8)).toBe(6);
    expect(cohortMonths('2026-06-30', 2026, 8)).toBe(-3);
  });
  it('cover ends after the OSSA year and the last planned year repeats in an extension', () => {
    const rows = [{ role_id: 'r', year: 2026, cover_count: 20 }, { role_id: 'r', year: 2030, cover_count: 4 }, { role_id: 'r', year: 2030, cover_count: 2 }];
    expect(coverFor(rows, 'r', 2026, 2030)).toBe(20);
    expect(coverFor(rows, 'r', 2030, 2030)).toBe(6);
    expect(coverFor(rows, 'r', 2031, 2030)).toBe(0);
    expect(coverFor(rows, 'r', 2032, 2032)).toBe(6);
    expect(coverFor(rows, 'x', 2026, 2030)).toBe(0);
    expect(yearsFor(2026, 2030)).toEqual([2026, 2027, 2028, 2029, 2030, 2031]);
    expect(yearsFor(2026, 2032)).toEqual([2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033]);
  });
  it('scenario validation: OSSA end 2028-2032 and slip 0-24 whole months', () => {
    expect(validScenario(null)).toEqual(BASE);
    expect(validScenario({ ossa_end: 2027 })).toBeNull();
    expect(validScenario({ ossa_end: 2031, slip_months: 25 })).toBeNull();
    expect(validScenario({ slip_months: 6.5 })).toBeNull();
    expect(isWhatIf(BASE)).toBe(false);
    expect(isWhatIf({ ossa_end: 2029, slip_months: 0 })).toBe(true);
  });
  it('A1: a cell under 10, zero included, is suppressed (null); 10 and above are shown', () => {
    expect([0, 1, 9, 10, 412].map(cell)).toEqual([null, null, null, 10, 412]);
    expect(MIN_GROUP).toBe(MIN_GROUP_SIZE);
  });
  it('shortfall: positions handed over minus ready successors; the risk flag and years carry no counts', () => {
    const inp = {
      period: '2026-Q3', roles: [{ id: 'a', family_id: 'f' }, { id: 'b', family_id: 'f' }],
      cover: [2026, 2027, 2028, 2029, 2030].flatMap((y, i) => [{ role_id: 'a', year: y, cover_count: [40, 30, 20, 10, 0][i] }, { role_id: 'b', year: y, cover_count: 12 }]),
      cohorts: [{ role_id: 'a', route: 'coit', trainees: 15, emirati: 12, ready_on: '2027-06-30' }, { role_id: 'a', route: 'gpo', trainees: 12, emirati: 12, ready_on: '2029-09-30' }],
      named: [{ role_id: 'a', person_id: 'w-1', months: 0, emirati: true, source: 'f05' as const }],
    };
    const a = computeHandover(inp, BASE);
    const fam = a.functions[0];
    expect(a.years).toEqual([2026, 2027, 2028, 2029, 2030, 2031]);
    expect(fam.cover).toEqual([52, 42, 32, 22, 12, null]);
    // handed over: 0,10,20,30,40,52; ready: 1,16,16,28,28,28 -> shortfall 0,0,4,2,12,24
    expect(fam.ready).toEqual([null, 16, 16, 28, 28, 28]);
    expect(fam.shortfall).toEqual([null, null, null, null, 12, 24]);
    expect(fam.first_shortfall).toBe(2028);
    expect(fam.at_risk_years).toEqual([2028, 2029, 2030, 2031]);
    expect(fam.max_shortfall).toBe(24);
    expect(fam.bands).toEqual({ now: null, y1_2: 15, y3_5: 12 });
    expect(fam.pipeline).toEqual({ coit: 15, loit: null, gpo: 12, dnt: null, discipline: null });
    expect(fam.emirati).toBe(25);
    expect(fam.emirati_share_pm).toBe(893); // 25 / 28 = 89.3 %
    expect(fam.source).toBe('f05');
    // a 12-month slip pushes the COIT cohort to 2028 and the GPO cohort to 2030
    const s = computeHandover(inp, { ossa_end: 2030, slip_months: 12 }).functions[0];
    expect(s.ready).toEqual([null, null, 16, 16, 28, 28]);
    expect(s.first_shortfall).toBe(2027);
  });
  it('deterministic: the same input gives byte-identical output', () => {
    const inp = { period: '2026-Q3', roles: T.job_roles, cover: T.external_cover.filter((c) => c.period === '2026-Q3'), cohorts: T.handover_cohorts.filter((c) => c.period === '2026-Q3'), named: [] };
    expect(JSON.stringify(computeHandover(inp, BASE))).toBe(JSON.stringify(computeHandover(structuredClone(inp), BASE)));
  });
  it('gatherNamed: F19 live slates replace F05 shortlists for their roles; leavers, inactive rows and non-bands are ignored', () => {
    const people = [
      { id: 'w-1', kind: 'staff', status: 'active', job_role_id: 'reactor-operator', nationality_flag: 'uae' },
      { id: 'w-2', kind: 'staff', status: 'active', job_role_id: 'local-operator', nationality_flag: 'other' },
      { id: 'w-3', kind: 'staff', status: 'leaver', job_role_id: 'reactor-operator', nationality_flag: 'uae' },
      { id: 'w-4', kind: 'staff', status: 'active', job_role_id: 'senior-reactor-operator', nationality_flag: 'uae' },
    ];
    const targets = [{ person_id: 'w-1', role_id: 'senior-reactor-operator', active: true }, { person_id: 'w-2', role_id: 'reactor-operator', active: true },
      { person_id: 'w-4', role_id: 'senior-reactor-operator', active: true }, { person_id: 'w-2', role_id: 'chemistry-technician', active: false }];
    const slates = [{ id: 's1', role_id: 'senior-reactor-operator', status: 'confirmed' }, { id: 's2', role_id: 'reactor-operator', status: 'archived' }];
    const successors = [
      { slate_id: 's1', person_id: 'w-1', readiness: '1_2y' }, { slate_id: 's1', person_id: 'w-1', readiness: 'ready_now' }, { slate_id: 's1', person_id: 'w-3', readiness: 'ready_now' },
      { slate_id: 's1', person_id: 'w-2', readiness: 'emergency' }, { slate_id: 's1', person_id: 'w-4', readiness: '3_5y', status: 'withdrawn' }, { slate_id: 's2', person_id: 'w-2', readiness: 'ready_now' },
    ];
    const r = gatherNamed({ people, targets, slates, successors }, ['senior-reactor-operator', 'reactor-operator', 'chemistry-technician'], () => ({ band: 'ready_in', months: 18 }));
    expect(r.f19Roles).toEqual(['senior-reactor-operator']);
    expect(r.named).toEqual([
      { role_id: 'reactor-operator', person_id: 'w-2', months: 18, emirati: false, source: 'f05' },
      { role_id: 'senior-reactor-operator', person_id: 'w-1', months: 0, emirati: true, source: 'f19' },
    ]);
  });
  it('A3: an F19 readiness change recomputes the burn-down', () => {
    const period = '2026-Q3';
    const cover = T.external_cover.filter((c) => c.period === period);
    const roles = [...new Set(cover.map((c) => c.role_id))];
    const ops = (T.people as any[]).filter((p) => p.kind === 'staff' && p.status === 'active' && p.job_family_id === 'operations').slice(0, 12);
    const slates = [{ id: 'ss-1', role_id: 'shift-supervisor', status: 'confirmed' }];
    const mk = (band: string) => ops.map((p) => ({ slate_id: 'ss-1', person_id: p.id, readiness: band }));
    const board = (succ: Record<string, unknown>[]) => {
      const { named, f19Roles } = gatherNamed({ people: T.people, targets: T.career_targets, slates, successors: succ }, roles, () => null);
      return computeHandover({ period, roles: T.job_roles, cover, cohorts: T.handover_cohorts.filter((c) => c.period === period), named }, BASE, f19Roles);
    };
    const before = board(mk('ready_now')), after = board(mk('3_5y'));
    const ss = (a: HandoverAggregate) => a.roles.find((g) => g.key === 'shift-supervisor')!;
    expect(ss(before).source).toBe('f19');
    expect(ss(before).bands.now).toBe(12);
    expect(ss(after).bands.now).toBeNull();
    expect(ss(after).bands.y3_5).toBeGreaterThanOrEqual(12);
    expect(JSON.stringify(before.total.ready)).not.toBe(JSON.stringify(after.total.ready));
    expect(JSON.stringify(ss(before).ready)).not.toBe(JSON.stringify(ss(after).ready));
  });
  it('risk list: ranked with an i18n reason on every item (F02 lint); reasons never carry a count under 10', () => {
    const a = computeHandover({ period: '2026-Q3', roles: T.job_roles, cover: T.external_cover.filter((c) => c.period === '2026-Q3'), cohorts: T.handover_cohorts.filter((c) => c.period === '2026-Q3'), named: [] }, { ossa_end: 2029, slip_months: 12 });
    const list = riskList(a.functions, a);
    expect(list.length).toBeGreaterThan(0);
    expect(lintRanked(list)).toEqual([]);
    for (const g of [a.total, ...a.functions, ...a.roles]) for (const r of groupReasons(g, a)) {
      expect(get(r.key, { m07: en })).toBeTruthy();
      expect(get(r.key, { m07: ar })).toBeTruthy();
      if (typeof r.vars?.n === 'number') expect(r.vars.n).toBeGreaterThanOrEqual(10);
    }
    expect(list.map((r) => r.item.first_shortfall)).toEqual([...list.map((r) => r.item.first_shortfall)].sort((x, y) => (x ?? 0) - (y ?? 0)));
  });
  it('observer release tiles: eight aggregate tiles, suppressed or ≥ 10 counts, each with an EN and AR label', () => {
    const a = computeHandover({ period: '2026-Q3', roles: T.job_roles, cover: T.external_cover.filter((c) => c.period === '2026-Q3'), cohorts: T.handover_cohorts.filter((c) => c.period === '2026-Q3'), named: [] }, BASE);
    const tiles = releaseTiles(a);
    expect(tiles).toHaveLength(8);
    for (const x of tiles) {
      expect(x.v.length).toBeLessThanOrEqual(60);
      expect(get(`metric.${x.k}`, en)).toBeTruthy();
      expect(get(`metric.${x.k}`, ar)).toBeTruthy();
      if (/^\d+$/.test(x.v) && x.k !== 'handover_functions_at_risk' && x.k !== 'handover_first_shortfall') expect(Number(x.v)).toBeGreaterThanOrEqual(10);
    }
  });
});

describe('F22 seed and registry', () => {
  it('two SAMPLE plan periods, about 400 positions in 2026, no security role, cohorts within each critical role\'s bench pipeline', () => {
    expect([...new Set(T.external_cover.map((c) => c.period))].sort()).toEqual(['2026-Q2', '2026-Q3']);
    const y26 = T.external_cover.filter((c) => c.period === '2026-Q3' && c.year === 2026).reduce((s, c) => s + c.cover_count, 0);
    expect(y26).toBeGreaterThanOrEqual(380);
    expect(y26).toBeLessThanOrEqual(420);
    expect(T.external_cover.every((c) => c.sample && c.function === T.job_roles.find((r) => r.id === c.role_id)?.family_id)).toBe(true);
    const sec = new Set(T.job_roles.filter((r) => ['security', 'safeguards', 'cyber'].includes(r.family_id)).map((r) => r.id));
    expect(T.external_cover.some((c) => sec.has(c.role_id)) || T.handover_cohorts.some((c) => sec.has(c.role_id))).toBe(false);
    for (const cr of T.critical_roles) {
      const n = T.handover_cohorts.filter((c) => c.period === cr.period && c.role_id === cr.role_id).reduce((s, c) => s + c.trainees, 0);
      expect(n).toBeLessThanOrEqual(cr.in_training + cr.pipeline);
    }
    expect(T.handover_cohorts.every((c) => c.emirati <= c.trainees && c.ready_on >= c.starts_on)).toBe(true);
    expect(T.handover_cohorts.filter((c) => c.route === 'gpo' || c.route === 'dnt').every((c) => c.emirati === c.trainees)).toBe(true);
  });
  it('A4: the plan tables hold no person column and are readable only by HR plan maintainers and auditors', () => {
    for (const t of ['external_cover', 'handover_cohorts']) {
      const def = (SCHEMA as any)[t];
      expect(Object.keys(def.cols).some((c) => /person|name|email/.test(c) && !/^label_/.test(c))).toBe(false);
      expect(def.read).toEqual([{ res: 'observer_release' }]);
      expect(def.write.mode).toBe('none');
    }
  });
  it('A2: every handover metric has a definition (EN and AR), SAMPLE/SIMULATED marking and a definitions anchor', () => {
    const keys = METRICS.filter((m) => m.key.startsWith('handover_'));
    expect(keys.map((m) => m.key)).toEqual(['handover_cover', 'handover_ready', 'handover_pipeline', 'handover_burndown', 'handover_risk', 'handover_emirati']);
    for (const m of keys) {
      expect(m.sim).toBe(true);
      expect(get(`def.${m.key}`, en)).toBeTruthy();
      expect(get(`def.${m.key}`, ar)).toBeTruthy();
      expect(get(`metric.${m.key}`, ar)).toBeTruthy();
    }
  });
  it('route: staff zone under /workforce; HR, managers and auditors pass the guard, observers and employees do not', () => {
    const r = ROUTES.find((x) => x.id === 'workforce-handover')!;
    expect(r.path).toBe('/workforce/handover');
    expect(r.parent).toBe('workforce');
    const g = (roles: string[]) => checkGuard(r.guard, { status: 'signed_in', roles } as never);
    expect(g(['hr_director'])).toBe('ok');
    expect(g(['manager'])).toBe('ok');
    expect(g(['auditor'])).toBe('ok');
    expect(g(['observer'])).not.toBe('ok');
    expect(g(['employee'])).not.toBe('ok');
    expect(HANDOVER_ROLES).not.toContain('observer');
  });
});

describe('F22 local backend', () => {
  it('A1 + A4: the HR director reads a suppressed board with no person id; the latest period opens by default', async () => {
    await as('chco');
    const r = await b.rpc.handoverAggregate('', null);
    expect(r.ok).toBe(true);
    const a = r.data!;
    expect(a.period).toBe('2026-Q3');
    expect(a.periods).toEqual(['2026-Q2', '2026-Q3']);
    expect(allCells(a).every((c) => c === null || c >= 10)).toBe(true);
    expect(allCells(a).some((c) => c === null)).toBe(true);
    expect(leaks(a)).toEqual([]);
    expect(a.total.cover[0]).toBeGreaterThanOrEqual(380);
    expect(a.functions.some((g) => g.risk)).toBe(true);
    expect(a.simulated).toBe(true);
  });
  it('managers and auditors read the board; observers, employees and anonymous callers are refused with an audit row', async () => {
    for (const p of ['sro', 'k-auditor', 'k-hr-analyst']) {
      await as(p);
      expect((await b.rpc.handoverAggregate('2026-Q2')).ok).toBe(true);
    }
    const audits = () => b.raw('audit_events').filter((e) => e.action === 'handover.read' && e.outcome === 'refused').length;
    const before = audits();
    await as('k-observer');
    expect((await b.rpc.handoverAggregate('2026-Q3')).code).toBe('forbidden');
    await as('k-ro');
    expect((await b.rpc.handoverAggregate('2026-Q3')).code).toBe('forbidden');
    await as(null);
    expect((await b.rpc.handoverAggregate('2026-Q3')).code).toBe('not_signed_in');
    expect(audits()).toBe(before + 3);
  });
  it('unknown periods and out-of-range what-ifs are refused; a what-if is returned with its settings', async () => {
    await as('chco');
    expect((await b.rpc.handoverAggregate('2025-Q1')).code).toBe('not_found');
    expect((await b.rpc.handoverAggregate('2026-Q3', { ossa_end: 2033 })).code).toBe('invalid');
    expect((await b.rpc.handoverAggregate('2026-Q3', { slip_months: -1 })).code).toBe('invalid');
    const w = await b.rpc.handoverAggregate('2026-Q3', { ossa_end: 2029, slip_months: 12 });
    expect(w.data).toMatchObject({ ossa_end: 2029, slip_months: 12, simulated: true });
    expect(w.data!.years).toEqual([2026, 2027, 2028, 2029, 2030, 2031]);
  });
  it('A4: the plan tables are not readable by managers or observers through the repository', async () => {
    await as('sro');
    expect(await b.list('external_cover')).toEqual([]);
    expect(await b.list('handover_cohorts')).toEqual([]);
    await as('chco');
    expect((await b.list('external_cover')).length).toBeGreaterThan(100);
    await as('k-auditor');
    expect((await b.list('handover_cohorts')).length).toBeGreaterThan(20);
  });
  it('A3 (local): the board follows F19 slates when the succession tables hold rows, and moves when readiness changes', async () => {
    await as('chco');
    const tables = (b as any).tables as Record<string, any[]>;
    const ops = b.raw('people').filter((p) => p.kind === 'staff' && p.status === 'active' && p.job_family_id === 'operations').slice(0, 12);
    tables.succession_slates = [{ id: 'ss-t', role_id: 'shift-supervisor', period: '2026', status: 'confirmed' }];
    tables.successors = ops.map((p, i) => ({ id: `su-${i}`, slate_id: 'ss-t', person_id: p.id, readiness: 'ready_now', status: 'proposed' }));
    const r1 = (await b.rpc.handoverAggregate('2026-Q3')).data!;
    tables.successors.forEach((s) => { s.readiness = '3_5y'; });
    const r2 = (await b.rpc.handoverAggregate('2026-Q3')).data!;
    const ss = (a: HandoverAggregate) => a.roles.find((g) => g.key === 'shift-supervisor')!;
    expect(ss(r1).source).toBe('f19');
    expect(ss(r1).bands.now).toBe(12);
    expect(ss(r2).bands.now).toBeNull();
    expect(JSON.stringify(r1.total.ready)).not.toBe(JSON.stringify(r2.total.ready));
    expect(leaks(r1)).toEqual([]);
    delete tables.successors;
    delete tables.succession_slates;
  });
  it('the F05 path also recomputes: removing shortlists changes the named successors', async () => {
    await as('chco');
    const r1 = (await b.rpc.handoverAggregate('2026-Q3')).data!;
    for (const t of b.raw('career_targets').filter((x) => x.role_id === 'senior-reactor-operator')) b.rawUpdate('career_targets', t.id, { active: false });
    const r2 = (await b.rpc.handoverAggregate('2026-Q3')).data!;
    const sro = (a: HandoverAggregate) => a.roles.find((g) => g.key === 'senior-reactor-operator')!;
    expect(sro(r1).named).toBeGreaterThanOrEqual(10);
    expect(sro(r2).named).toBeNull();
    expect(JSON.stringify(sro(r1).ready)).not.toBe(JSON.stringify(sro(r2).ready));
  });
  it('observer-safe release: HR drafts it (audited, no ledger), a line manager cannot; the draft goes through the existing maker-checker', async () => {
    await as('sro');
    expect((await b.rpc.prepareHandoverRelease('2026-Q3')).code).toBe('forbidden');
    await as('chco');
    const r = await b.rpc.prepareHandoverRelease('2026-Q3');
    expect(r.ok).toBe(true);
    const row = b.rawGet('observer_reports', r.data!.id)!;
    expect(row.status).toBe('draft');
    const body = row.body as any;
    expect(body.kind).toBe('handover');
    expect(body.tiles).toHaveLength(8);
    expect(body.burndown.years[0]).toBe(2026);
    expect(leaks(body)).toEqual([]);
    expect(b.raw('audit_events').some((e) => e.action === 'observer_report.draft_handover' && e.entity_id === r.data!.id)).toBe(true);
    expect((await b.rpc.prepareHandoverRelease('2025-Q1')).code).toBe('not_found');
    expect((await b.rpc.observerReportAction(r.data!.id, 'submit', ['org-observer'])).ok).toBe(true);
    expect((await b.rpc.observerReportAction(r.data!.id, 'approve')).code).toBe('maker_checker');
    await as('k-observer');
    expect((await b.list('observer_reports')).some((x) => x.id === r.data!.id)).toBe(false);
  });
});
