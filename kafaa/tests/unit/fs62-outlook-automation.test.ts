/**
 * FS wave F · E2 · FS52 AI and automation exposure in the skills outlook (M07). Pure rules (src/modules/m07/outlook.ts) and the local
 * path (LocalBackend rpc.outlookAutomation / rpc.computeOutlook). The SQL path is scripts/validate/fs62-outlook-automation.mjs
 * (PGlite: TS = SQL for the task-exposure aggregate and 52 assumption sets, stored outlooks byte for byte, RBAC, grants).
 *
 * Card acceptance:
 *   A1 With adoption at 0 the outlook equals today's results exactly.            -> 'A1: ...' tests below
 *   A2 TS and SQL agree for 52 assumption sets (PGlite).                         -> validator; here 'A2: ...' (the 52 sets are deterministic and valid)
 *   A3 The automation assumption appears in the tornado chart with its range.    -> 'A3: ...' tests below (page: fs62-pages.test.tsx)
 * RBAC: existing F35 rules (HR analysts, the HR director and auditors run it; line managers, observers and staff are refused).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import {
  AUTO_HORIZON_YEAR, AUTO_LIMITS, AUTO_PARAM, AUTO_RAMP, AUTO_TORNADO, BASELINE, LIMITS, NUM_PARAMS, TORNADO, adoptionOf, autoShare, automationFor, automationProfile, automationReasons,
  baseFor, computeOutlook, familyReasons, gatherAutomation, gatherBase, inputFromTables, isBaseline, normalizeParams, outlookFamilies, outlookFor, paramsEqual, project, rankAutomation,
  withAutoBar, type AutoFamily, type OutlookResult,
} from '../../src/modules/m07/outlook';
import { lintRanked } from '../../src/domain/engines';
import seed from '../../src/seed/seed.json';

vi.setConfig({ testTimeout: 60000, hookTimeout: 60000 });
const T = (seed as unknown as { tables: Record<string, any[]> }).tables;
const inp = inputFromTables((t) => T[t] ?? []);
const fams = outlookFamilies(inp);
const ok = <R,>(r: { code: string; result?: R }) => { if (r.code !== 'ok') throw new Error(r.code); return (r as { result: R }).result; };
const personIds = new Set((T.people as { id: string }[]).map((p) => p.id));

describe('FS52 rules', () => {
  it('A1: with adoption at 0 the outlook equals today\'s stored results exactly (byte for byte, key absent or 0)', () => {
    const so = T.skill_outlooks as { id: string; params: Record<string, unknown>; results: OutlookResult }[];
    expect(so.length).toBe(5);
    for (const o of so) {
      expect(JSON.stringify(ok(outlookFor(inp, o.params)))).toBe(JSON.stringify(o.results));
      expect(JSON.stringify(ok(outlookFor(inp, { ...o.params, automation_adoption: 0 })))).toBe(JSON.stringify(o.results));
      expect('automation' in o.results).toBe(false);
      expect(o.results.tornado.map((b) => b.param)).not.toContain(AUTO_PARAM);
    }
    const stress = so.find((o) => o.id === 'so-attrition-stress')!;
    expect(stress.results.totals.families_short).toBe(stress.results.totals.visible); // the F35 stress test still reads 10 of 10
    expect(stress.results.totals.visible).toBe(10);
  });

  it('A1: adoption 0 normalises to the F35 parameters, compares equal to the baseline and leaves every projection unchanged', () => {
    const p0 = normalizeParams({ automation_adoption: 0 }, fams)!;
    expect(p0).toEqual(normalizeParams({}, fams));
    expect('automation_adoption' in p0).toBe(false);
    expect(isBaseline(p0)).toBe(true);
    expect(paramsEqual({ ...BASELINE, automation_adoption: 0 }, BASELINE)).toBe(true);
    expect(isBaseline(normalizeParams({ automation_adoption: 20 }, fams)!)).toBe(false);
    const b = baseFor(inp, BASELINE, true);
    expect(JSON.stringify(project(b, BASELINE))).toBe(JSON.stringify(project(gatherBase(inp, null), BASELINE)));
  });

  it('exported F35 signatures stay stable for FS51 (M35 imports them read-only)', () => {
    expect(NUM_PARAMS).toEqual(['horizon', 'attrition_pct', 'klra_weight', 'pipeline_factor', 'annual_intake', 'reskill_rate', 'adv_factor', 'adv_start', 'ossa_end']);
    expect(Object.keys(BASELINE)).toEqual(['horizon', 'scenario_id', 'attrition_pct', 'klra_weight', 'pipeline_factor', 'annual_intake', 'reskill_rate', 'reskill_overrides', 'adv_factor', 'adv_start', 'ossa_end']);
    expect(TORNADO.length).toBe(7);
    expect(Object.keys(LIMITS)).not.toContain(AUTO_PARAM);
    expect(gatherBase(inp, null).auto).toBeUndefined(); // kafaa_so_base parity is untouched
  });

  it('parameter guard: whole percentages 0-100 only', () => {
    expect(AUTO_LIMITS).toEqual([0, 100, 5]);
    for (const bad of [-5, 101, 12.5, '30', true, Number.NaN]) expect(normalizeParams({ automation_adoption: bad }, fams)).toBeNull();
    expect(normalizeParams({ automation_adoption: 35 }, fams)!.automation_adoption).toBe(35);
    expect(adoptionOf({ automation_adoption: 0 })).toBe(0);
    expect(adoptionOf({})).toBe(0);
  });

  it('task exposure per family comes from the FS06 task layer: active, non-restricted, rated tasks on established skills', () => {
    const a = gatherAutomation(inp);
    const live = T.jta_tasks.filter((t: any) => t.status === 'active' && !t.restricted);
    expect(a.rated + a.unrated).toBe(live.length);
    expect(a.automate_partly + a.augment + a.human_core).toBe(a.rated);
    expect(a.families.map((f) => f.key)).toEqual(fams);
    expect(a.families.some((f) => f.key === 'security')).toBe(false);
    for (const f of a.families) {
      const sum = (['now', '2030', '2035'] as const).reduce((s, h) => s + f.n[h].automate_partly + f.n[h].augment + f.n[h].human_core, 0);
      expect(sum).toBe(f.tasks);
    }
    // restricted tasks, FS02 future skills and inactive links never count
    const restricted = { ...inp, tasks: [{ id: 'x', status: 'active', restricted: true, exposure: 'automate_partly', change_horizon: 'now' }], taskSkills: [{ task_id: 'x', skill_id: inp.skills[0].id, active: true }] };
    expect(gatherAutomation(restricted).families.every((f) => f.tasks === 0)).toBe(true);
    const fsSkill = inp.skills.find((s) => s.fs_area)!;
    const future = { ...inp, tasks: [{ id: 'y', status: 'active', restricted: false, exposure: 'augment', change_horizon: '2030' }], taskSkills: [{ task_id: 'y', skill_id: fsSkill.id, active: true }] };
    expect(gatherAutomation(future).families.every((f) => f.tasks === 0)).toBe(true);
    const inactive = { ...future, taskSkills: [{ task_id: 'y', skill_id: inp.skills.find((s) => !s.fs_area && s.area === 'operations')!.id, active: false }] };
    expect(gatherAutomation(inactive).families.every((f) => f.tasks === 0)).toBe(true);
  });

  it('the automation share phases in over three years from each task\'s change horizon, with weights 5/10, 2/10, 0', () => {
    const z = { automate_partly: 0, augment: 0, human_core: 0 };
    const f: AutoFamily = { key: 'k', tasks: 4, n: { now: { ...z, automate_partly: 1 }, '2030': { ...z, augment: 2 }, '2035': { ...z, human_core: 1 } } };
    expect(AUTO_HORIZON_YEAR.now).toBe(2027);
    expect(AUTO_RAMP).toBe(3);
    expect(autoShare(f, 2026)).toBe(0);
    expect(autoShare(f, 2027)).toBeCloseTo((5 * 1 / 3) / 40, 12);
    expect(autoShare(f, 2029)).toBeCloseTo(5 / 40, 12);
    expect(autoShare(f, 2030)).toBeCloseTo((5 + 4 / 3) / 40, 12);
    expect(autoShare(f, 2036)).toBeCloseTo((5 + 4) / 40, 12); // human-core tasks never count
    expect(autoShare(null, 2030)).toBe(0);
    expect(autoShare({ ...f, tasks: 0 }, 2030)).toBe(0);
  });

  it('demand falls with adoption, supply is untouched, and the automation driver narrows the gap (WhyThis)', () => {
    const r0 = ok(outlookFor(inp, {})), r50 = ok(outlookFor(inp, { automation_adoption: 50 }));
    for (const f of r50.families.filter((x) => !x.suppressed)) {
      const g = r0.families.find((x) => x.key === f.key)!;
      f.years.forEach((c, i) => { expect(c.supply).toBe(g.years[i].supply); expect(c.demand).toBeLessThanOrEqual(g.years[i].demand); });
    }
    expect(r50.totals.cumulative).toBeLessThan(r0.totals.cumulative);
    const fam = r50.families.find((x) => !x.suppressed && x.drivers.some((d) => d.code === 'automation'))!;
    expect(fam.drivers.find((d) => d.code === 'automation')!.effect).toBe('narrows');
    const why = familyReasons(fam, r50.params);
    expect(why.find((x) => x.code === 'so_automation')!.vars).toMatchObject({ pct: 50 });
    expect(r0.families.every((x) => x.drivers.every((d) => d.code !== 'automation'))).toBe(true);
  });

  it('A3: the automation assumption appears in the tornado chart with its range (in the result when adoption > 0, from the profile at 0)', () => {
    const r = ok(outlookFor(inp, { automation_adoption: 40 }));
    const bar = r.tornado.find((b) => b.param === AUTO_PARAM)!;
    expect(r.tornado.length).toBe(8);
    expect([bar.lo, bar.hi]).toEqual([AUTO_TORNADO.lo, AUTO_TORNADO.hi]);
    expect(bar.high).toBeLessThan(bar.low);
    expect(bar.swing).toBe(bar.low - bar.high);
    expect(r.tornado.map((b) => b.swing)).toEqual([...r.tornado.map((b) => b.swing)].sort((a, b) => b - a));
    expect(r.automation!.adoption).toBe(40);
    expect(r.automation!.bar).toEqual(bar);
    const p0 = ok(automationFor(inp, {}));
    const r0 = ok(outlookFor(inp, {}));
    expect(p0.bar.low).toBe(r0.totals.cumulative);
    const merged = withAutoBar(r0.tornado, p0.bar);
    expect(merged.length).toBe(8);
    expect(merged.filter((b) => b.param === AUTO_PARAM).length).toBe(1);
    expect(withAutoBar(merged, p0.bar).length).toBe(8); // never doubled
  });

  it('A2: the 52 assumption sets of the PGlite parity check are valid and deterministic, and every one computes in TS', () => {
    // same generator as scripts/validate/fs62-outlook-automation.mjs (TS = SQL is proven there)
    let seedN = 62;
    const rand = () => { seedN = (seedN * 1103515245 + 12345) % 2147483648; return seedN / 2147483648; };
    const pick = (k: keyof typeof LIMITS) => { const [lo, hi, step] = LIMITS[k]; const n = Math.round((hi - lo) / step); return Math.round((lo + Math.floor(rand() * (n + 1)) * step) * 1000) / 1000; };
    const scen = [null, ...T.scenarios.map((s: any) => s.id)];
    const sets: Record<string, unknown>[] = [{}, { automation_adoption: 0 }, { automation_adoption: 5 }, { automation_adoption: 60 }, { automation_adoption: 100 }, { automation_adoption: 35, horizon: 2031 },
      { automation_adoption: 50, horizon: 2036 }, ...scen.filter(Boolean).map((s) => ({ scenario_id: s, automation_adoption: 40 })), { automation_adoption: 25, reskill_overrides: { digital: 30, maintenance: 0 } }];
    while (sets.length < 52) {
      const p: Record<string, unknown> = { automation_adoption: rand() < 0.15 ? 0 : 5 * Math.floor(rand() * 21) };
      for (const k of NUM_PARAMS) if (rand() < 0.5) p[k] = pick(k);
      if (rand() < 0.35) p.scenario_id = scen[1 + Math.floor(rand() * (scen.length - 1))];
      if (rand() < 0.25) p.reskill_overrides = { [fams[Math.floor(rand() * fams.length)]]: Math.floor(rand() * 41) };
      sets.push(p);
    }
    expect(sets.length).toBe(52);
    const results = sets.map((s) => outlookFor(inp, s));
    expect(results.every((r) => r.code === 'ok')).toBe(true);
    expect(sets.filter((s) => (s.automation_adoption as number) > 0).length).toBeGreaterThanOrEqual(40);
  });

  it('the automation profile: suppressed families carry nothing, no person or task id leaves, reasons pass lintRanked, ranking by share', () => {
    const prof = ok(automationFor(inp, { automation_adoption: 30 }));
    const base = ok(outlookFor(inp, {}));
    for (const f of prof.families) {
      const o = base.families.find((x) => x.key === f.key)!;
      expect(f.suppressed).toBe(o.suppressed);
      if (f.suppressed) expect([f.tasks, f.share_h, f.cut_now, f.cut_hi]).toEqual([null, null, null, null]);
      else { expect(f.cut_hi!).toBeGreaterThanOrEqual(f.cut_now!); expect(f.cut_now!).toBeGreaterThanOrEqual(0); }
    }
    const s = JSON.stringify(prof);
    expect([...personIds].filter((id) => s.includes(`"${id}"`))).toEqual([]);
    expect(s).not.toMatch(/"jt-/);
    expect(prof.ai_task_share).toBe(Math.round((1000 * (prof.augment + prof.automate_partly)) / prof.rated) / 10);
    const ranked = rankAutomation(prof.families);
    expect(lintRanked(ranked.map((f) => ({ id: f.key, score: f.share_h ?? 0, reasons: automationReasons(f, prof) })))).toEqual([]);
    const vis = ranked.filter((f) => !f.suppressed);
    expect(vis.map((f) => f.share_h)).toEqual([...vis.map((f) => f.share_h)].sort((a, b) => (b ?? 0) - (a ?? 0)));
    expect(ranked.slice(vis.length).every((f) => f.suppressed)).toBe(true);
    expect(automationReasons(vis[0], prof).map((r) => r.code)).toEqual(['so_auto_tasks', 'so_auto_share', 'so_auto_cut', 'so_auto_cut_hi']);
    expect(automationProfile(gatherBase(inp, null), BASELINE).rated).toBe(0); // without task data: an empty profile, not an error
  });

  it('computeOutlook carries the automation profile only when adoption > 0', () => {
    const b = baseFor(inp, { ...BASELINE, automation_adoption: 20 });
    const r = computeOutlook(b, { ...BASELINE, automation_adoption: 20 });
    expect(r.automation?.adoption).toBe(20);
    expect(computeOutlook(gatherBase(inp, null), BASELINE).automation).toBeUndefined();
  });
});

describe('FS52 local path (RBAC = existing F35 rules)', () => {
  let b: LocalBackend;
  const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
  beforeEach(async () => { b = new LocalBackend(); await b.whenReady(); await b.reset(); });

  it('HR director, HR analyst and auditor read the automation profile; managers, observers, staff and anonymous are refused (audited)', async () => {
    for (const p of ['chco', 'k-hr-analyst', 'k-auditor']) {
      await as(p);
      const r = await b.rpc.outlookAutomation({ automation_adoption: 25 });
      expect(r.ok).toBe(true);
      expect(r.data!.adoption).toBe(25);
      expect(r.data!.simulated).toBe(true);
    }
    const before = b.raw('audit_events').filter((e: any) => e.action === 'outlook.automation' && e.outcome === 'refused').length;
    for (const p of ['sro', 'k-observer', 'k-ro']) {
      await as(p);
      expect((await b.rpc.outlookAutomation({})).code).toBe('forbidden');
    }
    await as(null);
    expect((await b.rpc.outlookAutomation({})).code).toBe('not_signed_in');
    const after = b.raw('audit_events').filter((e: any) => e.action === 'outlook.automation' && e.outcome === 'refused').length;
    expect(after).toBe(before + 4);
  });

  it('invalid adoption and unknown scenarios are refused; computeOutlook accepts the assumption and matches the pure rules', async () => {
    await as('chco');
    expect((await b.rpc.outlookAutomation({ automation_adoption: 120 } as never)).code).toBe('invalid');
    expect((await b.rpc.outlookAutomation({ scenario_id: 'scn-nope' })).code).toBe('not_found');
    const r = await b.rpc.computeOutlook({ automation_adoption: 45 } as never);
    expect(r.ok).toBe(true);
    expect(JSON.stringify(r.data)).toBe(JSON.stringify(ok(outlookFor(inp, { automation_adoption: 45 }))));
    const p = await b.rpc.outlookAutomation({});
    expect(JSON.stringify(p.data)).toBe(JSON.stringify(ok(automationFor(inp, {}))));
  });
});
