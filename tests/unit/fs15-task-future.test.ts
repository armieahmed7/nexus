/** FS06 Task layer with AI exposure and change horizon (FS wave A · E5, M26): one test per acceptance criterion on the local path,
 *  the exposure rule shared with SQL, RBAC, the seed and i18n. The SQL path (TS = SQL parity, RLS, live RPC flows) is checked by
 *  scripts/validate/fs15-task-future.mjs (PGlite). */
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import en from '../../src/i18n/m26.en.json';
import ar from '../../src/i18n/m26.ar.json';
import { SCHEMA } from '../../src/data/schema';
import {
  DRIVERS, EXPOSURES, HORIZONS, HOT_DRIVER_PCT, TASK_DIMS, canonNeeds, exposureOf, futureSummary, hotDrivers, validNeeds, type CapLevel,
} from '../../src/modules/m26/future';
import { routes } from '../../src/modules/m26/routes';
import seed from '../../src/seed/seed.json';
import { readFileSync } from 'node:fs';

const T = (seed as unknown as { tables: Record<string, any[]> }).tables; // eslint-disable-line @typescript-eslint/no-explicit-any
let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});
const audits = () => b.raw('audit_events').length;
const ledger = () => b.raw('ledger_local').length;
const futureLog = (taskId: string) => (b.raw('sat_changes' as never) as any[]).filter((c) => c.task_id === taskId && c.area === 'future').length; // eslint-disable-line @typescript-eslint/no-explicit-any
const LV: CapLevel[] = TASK_DIMS.flatMap((d) => HORIZONS.map((h) => ({ dimension: d, horizon: h, level: 3 })));
const good = (task = 'jt-qs-ro-t4') => ({ task_id: task, needs: { language: 3, social: 3, learning_memory: 3 }, change_horizon: '2030' as const, tech_driver: 'ai_assist' as const,
  skills: [{ skill_id: 'sk-co-02', level: 3 }, { skill_id: 'sk-da-02-review', level: 2, kind: 'future' as const }] });

describe('FS06 · the exposure rule (exposureOf, mirrored by SQL kafaa_fx_exposure)', () => {
  it('covers the four branches in order, flags augmentable and explains each dimension and the horizon', () => {
    const none = exposureOf({ needs: { language: 4, social: 4, vision: 2 }, change_horizon: 'now', critical: false, restricted: false }, LV)!;
    expect([none.exposure, none.branch, none.augmentable, none.covered, none.gaps]).toEqual(['human_core', 'below_half', false, ['vision'], ['language', 'social']]);
    const crit = exposureOf({ needs: { language: 2, vision: 3 }, change_horizon: '2030', critical: true, restricted: false }, LV)!;
    expect([crit.exposure, crit.branch, crit.augmentable]).toEqual(['augment', 'critical_all', true]);
    const all = exposureOf({ needs: { language: 2, vision: 3 }, change_horizon: '2030', critical: false, restricted: false }, LV)!;
    expect([all.exposure, all.branch]).toEqual(['automate_partly', 'all_covered']);
    const some = exposureOf({ needs: { language: 2, vision: 5 }, change_horizon: '2035', critical: false, restricted: false }, LV)!;
    expect([some.exposure, some.branch]).toEqual(['augment', 'some_covered']);
    expect(some.reasons.map((r) => r.code)).toEqual(['fx_some_covered', 'fx_dim_covered', 'fx_dim_gap', 'fx_horizon']);
    expect(some.reasons.every((r) => r.key.startsWith('m26.reasons.'))).toBe(true);
  });
  it('compares at the task horizon; a missing reference level counts as no capability', () => {
    const lv: CapLevel[] = [{ dimension: 'vision', horizon: 'now', level: 2 }, { dimension: 'vision', horizon: '2035', level: 4 }];
    expect(exposureOf({ needs: { vision: 4 }, change_horizon: 'now', critical: false, restricted: false }, lv)!.exposure).toBe('human_core');
    expect(exposureOf({ needs: { vision: 4 }, change_horizon: '2035', critical: false, restricted: false }, lv)!.exposure).toBe('automate_partly');
    expect(exposureOf({ needs: { vision: 1 }, change_horizon: '2030', critical: false, restricted: false }, lv)!.exposure).toBe('human_core');
  });
  it('acceptance: restricted tasks are never scored (null), nor are unrated ones', () => {
    expect(exposureOf({ needs: { language: 1 }, change_horizon: 'now', critical: false, restricted: true }, LV)).toBeNull();
    expect(exposureOf({ needs: null, change_horizon: 'now', critical: false, restricted: false }, LV)).toBeNull();
    expect(exposureOf({ needs: { language: 1 }, change_horizon: null, critical: false, restricted: false }, LV)).toBeNull();
  });
  it('validates needs: 1-4 known task dimensions, whole levels 1-5; consciousness is not a task dimension', () => {
    expect(validNeeds({ language: 3 })).toBe(true);
    expect(validNeeds({ language: 1, social: 2, vision: 3, robotic: 4 })).toBe(true);
    for (const bad of [{}, { language: 0 }, { language: 6 }, { language: 2.5 }, { consciousness: 2 }, { language: '3' }, [1], null, { language: 1, social: 2, vision: 3, robotic: 4, creativity: 2 }]) expect(validNeeds(bad)).toBe(false);
    expect(Object.keys(canonNeeds({ vision: 2, language: 1 }))).toEqual(['language', 'vision']);
  });
  it('summaries and O*NET-style driver badges follow the published threshold', () => {
    const rows = T.jta_tasks.map((t) => ({ id: t.id, role_id: t.role_id, exposure: t.exposure, change_horizon: t.change_horizon, tech_driver: t.tech_driver, restricted: t.restricted, status: t.status }));
    const s = futureSummary(rows);
    expect(s.rated).toBe(s.total);
    expect(EXPOSURES.reduce((a, e) => a + s.byExposure[e], 0)).toBe(s.rated);
    expect(DRIVERS.reduce((a, e) => a + s.byDriver[e], 0)).toBe(s.rated);
    for (const r of new Set(rows.map((x) => x.role_id))) for (const bd of hotDrivers(rows, r)) expect(bd.pct).toBeGreaterThanOrEqual(HOT_DRIVER_PCT);
    expect(hotDrivers(rows, 'security-officer')).toEqual([]);
  });
});

describe('FS06 · seed', () => {
  it('acceptance: all non-restricted JTA tasks are rated; restricted tasks have null values and no skill link', () => {
    const live = T.jta_tasks.filter((t) => !t.restricted);
    const res = T.jta_tasks.filter((t) => t.restricted);
    expect(live.length).toBeGreaterThanOrEqual(90);
    expect(res.length).toBeGreaterThan(0);
    for (const t of live) {
      expect(validNeeds(t.ai_capability_needed), t.code).toBe(true);
      expect(HORIZONS).toContain(t.change_horizon);
      expect(DRIVERS).toContain(t.tech_driver);
      expect(t.exposure).toBe(exposureOf({ needs: t.ai_capability_needed, change_horizon: t.change_horizon, critical: t.critical, restricted: false }, T.ai_capability_levels)!.exposure);
      expect(T.jta_task_skills.some((x) => x.task_id === t.id && x.active), t.code).toBe(true);
    }
    for (const t of res) {
      expect([t.ai_capability_needed, t.exposure, t.change_horizon, t.tech_driver]).toEqual([null, null, null, null]);
      expect(T.jta_task_skills.some((x) => x.task_id === t.id)).toBe(false);
    }
  });
  it('links no security skill; reference levels are SIMULATED; every benchmark figure is a sourced row with an as-of date', () => {
    const area = new Map(T.skills.map((s) => [s.id, s.area]));
    expect(T.jta_task_skills.every((x) => area.get(x.skill_id) && area.get(x.skill_id) !== 'security')).toBe(true);
    expect(T.ai_capability_levels.length).toBe(27);
    expect(T.ai_capability_levels.every((l) => l.simulated === true && l.level >= 1 && l.level <= 5 && l.basis_en && l.basis_ar)).toBe(true);
    expect(T.ai_exposure_refs.length).toBeGreaterThanOrEqual(3);
    expect(T.ai_exposure_refs.every((r) => r.as_of && r.sources.length && r.sources.every((s: { url: string }) => s.url.startsWith('https://')))).toBe(true);
    expect(T.sat_changes.filter((c) => c.area === 'future').length).toBeGreaterThanOrEqual(5);
    expect(T.sat_analysts.some((a) => a.active)).toBe(true);
  });
  it('the schema adds the FS06 columns and tables to M26 (additive)', () => {
    for (const c of ['ai_capability_needed', 'exposure', 'change_horizon', 'tech_driver', 'future_by', 'future_on']) expect(SCHEMA.jta_tasks.cols[c]).toBeTruthy();
    expect(SCHEMA.sat_changes.cols.area).toContain("='content'");
    for (const t of ['jta_task_skills', 'ai_capability_levels', 'ai_exposure_refs', 'sat_analysts']) expect(SCHEMA[t].module).toBe('M26');
    const sql = readFileSync('supabase/migrations/20261010215001_kafaa_fs15_task_future.sql', 'utf8');
    expect(/\bdrop\s+(table|column|function|policy|trigger)\b/i.test(sql)).toBe(false);
    expect(/\bdelete\s+from\b/i.test(sql)).toBe(false);
  });
});

describe('FS06 · RPCs on the local backend', () => {
  it('acceptance: each edit writes one SAT change-log row and one audit row (no ledger row)', async () => {
    await as('training-mgr');
    const a0 = audits(), l0 = ledger(), c0 = futureLog('jt-qs-ro-t4');
    const r = await b.rpc.setTaskFuture(good());
    expect(r.ok).toBe(true);
    expect([audits() - a0, futureLog('jt-qs-ro-t4') - c0, ledger() - l0]).toEqual([1, 1, 0]);
    const t = b.rawGet('jta_tasks' as never, 'jt-qs-ro-t4') as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const ex = exposureOf({ needs: good().needs, change_horizon: '2030', critical: t.critical, restricted: false }, T.ai_capability_levels)!;
    expect([t.exposure, t.change_horizon, t.tech_driver, r.data!.exposure]).toEqual([ex.exposure, '2030', 'ai_assist', ex.exposure]);
    expect(r.data!.reasons).toEqual(ex.reasons);
    const log = (b.raw('sat_changes' as never) as any[]).find((c) => c.id === r.data!.change_id); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect([log.status, log.kind, log.area]).toEqual(['closed', 'modified', 'future']);
    expect(log.after.skills).toContain('sk-da-02-review:2:future');
    // a second edit: links not in the new list are deactivated, never deleted
    const r2 = await b.rpc.setTaskFuture({ ...good(), skills: [{ skill_id: 'sk-co-02', level: 2 }] });
    expect(r2.ok).toBe(true);
    const links = (b.raw('jta_task_skills' as never) as any[]).filter((x) => x.task_id === 'jt-qs-ro-t4'); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(links.filter((x) => x.active).map((x) => x.skill_id)).toEqual(['sk-co-02']);
    expect(links.some((x) => x.skill_id === 'sk-da-02-review' && !x.active)).toBe(true);
    expect(futureLog('jt-qs-ro-t4') - c0).toBe(2);
  });
  it('RBAC: instructors and auditors read; the training manager or a designated SAT analyst writes', async () => {
    await as('k-instructor');
    expect((await b.rpc.setTaskFuture(good())).code).toBe('forbidden');
    const v = await b.rpc.taskFuture(null);
    expect(v && v.tasks.length > 0 && v.can_write === false && v.can_designate === false).toBe(true);
    await as('k-auditor');
    expect((await b.rpc.setTaskFuture(good())).code).toBe('forbidden');
    expect((await b.rpc.designateSatAnalyst('p-k-instructor', true)).code).toBe('forbidden');
    await as('k-ro');
    expect(await b.rpc.taskFuture(null)).toBeNull();
    await as('sq-lead'); // designated in the seed
    expect((await b.rpc.setTaskFuture(good())).ok).toBe(true);
    await as('training-mgr');
    const l0 = ledger();
    const d = await b.rpc.designateSatAnalyst('p-k-instructor', true);
    expect(d.ok && ledger() === l0 + 1).toBe(true);
    expect((await b.rpc.designateSatAnalyst('p-k-instructor', true)).code).toBe('no_change');
    expect((await b.rpc.designateSatAnalyst('p-k-ro', true)).code).toBe('invalid');
    expect((await b.rpc.designateSatAnalyst('p-training-mgr', true)).code).toBe('invalid');
    await as('k-instructor');
    expect((await b.rpc.setTaskFuture(good())).ok).toBe(true);
    await as('training-mgr');
    expect((await b.rpc.designateSatAnalyst('p-k-instructor', false)).ok).toBe(true);
    await as('k-instructor');
    expect((await b.rpc.setTaskFuture(good())).code).toBe('forbidden');
  });
  it('acceptance: restricted tasks are refused and never returned', async () => {
    await as('training-mgr');
    const r = await b.rpc.setTaskFuture(good('jt-security-officer-r1'));
    expect(r.code).toBe('restricted');
    const v = (await b.rpc.taskFuture(null))!;
    expect(v.tasks.some((x) => T.jta_tasks.find((t) => t.id === x.id)?.restricted)).toBe(false);
    expect(v.tasks.length).toBe(T.jta_tasks.filter((t) => !t.restricted && t.status === 'active').length);
    expect((await b.rpc.taskFuture('security-officer'))!.tasks).toEqual([]);
    expect(JSON.stringify(v)).not.toContain("Restricted task");
  });
  it('refuses invalid input with the SQL codes', async () => {
    await as('training-mgr');
    const cases: [object, string][] = [
      [{ needs: {} }, 'invalid'], [{ needs: { consciousness: 2 } }, 'invalid'], [{ change_horizon: '2040' }, 'invalid'], [{ tech_driver: 'quantum' }, 'invalid'],
      [{ skills: [] }, 'invalid'], [{ skills: [{ skill_id: 'sk-co-02', level: 5 }] }, 'invalid'], [{ skills: [{ skill_id: 'sk-co-02', level: 2 }, { skill_id: 'sk-co-02', level: 3 }] }, 'invalid'],
      [{ skills: [{ skill_id: 'sk-nope', level: 2 }] }, 'not_found'], [{ skills: [{ skill_id: 'sk-sa-01', level: 2 }] }, 'restricted'], [{ task_id: 'jt-nope' }, 'not_found'], [{ note: 'x'.repeat(501) }, 'invalid'],
    ];
    for (const [patch, code] of cases) {
      const a0 = audits();
      const r = await b.rpc.setTaskFuture({ ...good(), ...patch } as never);
      expect([r.ok, r.code], JSON.stringify(patch)).toEqual([false, code]);
      expect(audits()).toBe(a0 + 1); // refusals are audited
    }
  });
});

describe('FS06 · route and i18n', () => {
  it('registers /training/sat/future behind the sat grant', () => {
    const r = routes.find((x) => x.id === 'training-sat-future')!;
    expect(r.path).toBe('/training/sat/future');
    expect(r.guard).toEqual({ signedIn: true, grant: { res: 'sat', levels: ['R', 'W', 'A'] } });
  });
  it('every reason, exposure, horizon, driver and dimension label exists in English and Arabic', () => {
    const keys = ['fx_human_core', 'fx_critical_keep', 'fx_all_covered', 'fx_some_covered', 'fx_dim_covered', 'fx_dim_gap', 'fx_horizon'].map((k) => `m26.reasons.${k}`)
      .concat(EXPOSURES.map((e) => `m26.fx.exposure.${e}`), HORIZONS.map((h) => `m26.fx.horizon.${h}`), DRIVERS.map((d) => `m26.fx.driver.${d}`), TASK_DIMS.map((d) => `m26.fx.dim.${d}`),
        ['below_half', 'critical_all', 'all_covered', 'some_covered'].map((k) => `m26.fx.rule.${k}`), ['m26.routes.training-sat-future.title']);
    const get = (o: unknown, k: string) => k.split('.').slice(1).reduce<unknown>((x, p) => (x && typeof x === 'object' ? (x as Record<string, unknown>)[p] : undefined), o);
    for (const k of keys) { expect(typeof get(en, k) === 'string' && (get(en, k) as string).length > 0, k).toBe(true); expect(typeof get(ar, k) === 'string' && (get(ar, k) as string).length > 0, k).toBe(true); }
  });
});
