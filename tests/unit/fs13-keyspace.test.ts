/** [FS wave A · E3 · FS04] One future-skill keyspace and a computed future-skills radar (M11), on the LocalBackend.
 *  One test per acceptance criterion of PLAN.md FS04, plus RBAC, the admin keyspace RPC and the re-keyed gap plans.
 *  SQL = TS on the seed is proved by the PGlite validator scripts/validate/fs13-keyspace.mjs. */
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import seed from '../../src/seed/seed.json';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { publicTextIsClean } from '../../src/domain/future';
import { lintRanked } from '../../src/domain/engines';
import { CREDIT, cell, cellReasons, futureRadar, mapProblems, radarGap, rowsOf, scenarioDifferences, unresolvedKeys, type MapRow } from '../../src/modules/m11/keyspace';

type Row = Record<string, any>;
const T = (seed as unknown as { tables: Record<string, Row[]> }).tables;
const A = 'Scenario A (SIMULATED)';
const B = 'Scenario B (SIMULATED)';
const map = T.future_skill_map as MapRow[];
let b: LocalBackend;
async function as(persona: string | null) { b.setPersona(persona); await b.whenReady(); }
beforeEach(async () => { b = new LocalBackend(); await b.whenReady(); await b.reset(); });

describe('FS04 acceptance', () => {
  it('AC1: every as-* id and every radar or gap-plan key resolves to at least one sk-* skill', () => {
    expect(T.adv_skills).toHaveLength(27);
    expect(unresolvedKeys({ advSkills: T.adv_skills as never, futureSkills: T.future_skills as never, plans: T.skill_gap_plans as never, map, skills: T.skills as never })).toEqual([]);
    const skills = new Set(T.skills.map((s) => s.id));
    for (const a of T.adv_skills) {
      expect(a.sk_ids.length, a.id).toBeGreaterThan(0);
      expect(a.sk_ids.every((s: string) => skills.has(s) && s.startsWith('sk-'))).toBe(true);
      expect(a.sk_ids).toEqual(rowsOf(map, a.id).map((m) => m.sk_id));
    }
    for (const f of T.future_skills) expect(skills.has(f.sk_id), f.skill_key).toBe(true);
    for (const p of T.skill_gap_plans) expect(skills.has(p.sk_id), p.id).toBe(true);
    // the F01 catalogue mapping (skills.adv_skill_ids) is fully represented in the keyspace
    for (const s of T.skills) for (const a of s.adv_skill_ids) expect(map.some((m) => m.key === a && m.sk_id === s.id)).toBe(true);
    // no security skill on the map (security roles stay at career-path level)
    const sec = new Set(T.skills.filter((s) => s.area === 'security').map((s) => s.id));
    expect(map.some((m) => sec.has(m.sk_id))).toBe(false);
  });

  it('AC2: Scenario A and B differ for at least 6 of 8 radar skills, each with a sourced SIMULATED assumption', () => {
    const d = scenarioDifferences(T.future_skills as never, A, B);
    expect(d.total).toBe(8);
    expect(d.differ).toBeGreaterThanOrEqual(6);
    for (const f of T.future_skills) {
      expect(f.assumption_en).toMatch(/SIMULATED/);
      expect(f.assumption_ar.length).toBeGreaterThan(10);
      expect(f.sources.length).toBeGreaterThan(0);
      for (const s of f.sources) { expect(s.url).toMatch(/^https:\/\//); expect(s.as_of).toMatch(/^\d{4}-\d{2}-\d{2}$/); }
    }
    // F35 regression: both scenarios keep the same total, so the mean ADVANCE index the skills outlook reads is unchanged
    const sum = (sc: string) => T.future_skills.filter((f) => f.scenario === sc).reduce((s, f) => s + Number(f.value), 0);
    expect(sum(A)).toBe(sum(B));
  });

  it('AC3: radar readiness equals the aggregate over person_skills, and cells under 10 people are suppressed', async () => {
    await as('k-hr-analyst');
    const r = await b.rpc.futureRadar(A);
    // independent recount for one key: staff whose best credit on bwr-ops rows is > 0
    const staff = T.people.filter((p) => p.kind === 'staff' && p.status === 'active');
    const rows = rowsOf(map, 'bwr-ops');
    let twice = 0; let ready = 0;
    for (const p of staff) {
      let c = 0;
      for (const m of rows) { const st = T.person_skills.find((s) => s.person_id === p.id && s.skill_id === m.sk_id && s.active !== false); if (st && st.level >= m.need_level) c = Math.max(c, CREDIT[m.relation as 'transfers']); }
      twice += c * 2; if (c > 0) ready++;
    }
    const bwr = r.rows.find((c) => c.key === 'bwr-ops')!;
    expect(r.population).toBe(staff.length);
    expect(bwr.ready_n).toBe(ready);
    expect(bwr.readiness).toBe(Math.round((500 * twice) / staff.length) / 10);
    // same as the pure function, so pages and SQL share one definition
    expect(r).toEqual(futureRadar({ futureSkills: T.future_skills as never, map, people: T.people as never, states: T.person_skills as never }, A));
    // suppression: every shown cell has 10+ people; suppressed cells withhold value and count but keep an upper bound
    expect(r.rows.some((c) => c.suppressed)).toBe(true);
    for (const c of r.rows) {
      if (c.suppressed) { expect(c.readiness).toBeNull(); expect(c.ready_n).toBeNull(); expect(c.readiness_max).toBeGreaterThan(0); }
      else expect(c.ready_n!).toBeGreaterThanOrEqual(10);
    }
    for (const f of r.families) {
      if (f.n === null) expect(f.cells.every((c) => c.suppressed && c.readiness === null)).toBe(true);
      expect(['security', 'safeguards', 'cyber']).not.toContain(f.family_id);
    }
    expect(r.rows.filter((c) => !c.suppressed).length).toBeGreaterThanOrEqual(6);
    // readiness is not hand-entered: changing a person's skill state moves the computed value
    const before = bwr.readiness!;
    const extra = staff.filter((p) => !T.person_skills.some((s) => s.person_id === p.id && rows.some((m) => m.sk_id === s.skill_id && s.level >= m.need_level))).slice(0, 3);
    for (const p of extra) b.rawInsert('person_skills', { id: `ps-test-${p.id}`, person_id: p.id, skill_id: 'sk-co-01', level: 3, confidence: 0.9, basis: 'verified', reasons: [], evidence_count: 1, active: true } as never);
    const after = (await b.rpc.futureRadar(A)).rows.find((c) => c.key === 'bwr-ops')!;
    expect(after.readiness!).toBeGreaterThan(before);
  });

  it('readiness is the same in both scenarios (it describes today\'s staff); demand differs', async () => {
    await as('chco');
    const [ra, rb] = [await b.rpc.futureRadar(A), await b.rpc.futureRadar(B)];
    expect(ra.rows.map((c) => c.readiness)).toEqual(rb.rows.map((c) => c.readiness));
    expect(ra.rows.filter((c, i) => c.demand !== rb.rows[i].demand).length).toBeGreaterThanOrEqual(6);
  });
});

describe('FS04 rules', () => {
  it('cell(): credit-weighted share, one decimal, suppressed under 10 with an upper bound', () => {
    expect(cell([1, 1, 0.5, 0], 4, 2)).toEqual({ readiness: 62.5, ready_n: 3, suppressed: false, readiness_max: null });
    expect(cell(Array(9).fill(1).concat(Array(91).fill(0)), 100)).toEqual({ readiness: null, ready_n: null, suppressed: true, readiness_max: 9 });
    expect(cell(Array(10).fill(0.5), 9)).toMatchObject({ suppressed: true });
    expect(radarGap(60, null, 8.5)).toEqual({ gap: 51.5, atLeast: true });
    expect(radarGap(60, 70, null)).toEqual({ gap: 0, atLeast: false });
  });
  it('"Why this?" reasons are i18n keys for every radar cell', async () => {
    await as('k-hr-analyst');
    const r = await b.rpc.futureRadar(B);
    const list = r.rows.map((c) => ({ id: c.key, reasons: cellReasons(c, map, T.skills as never) }));
    expect(lintRanked(list as never)).toEqual([]);
    const en = JSON.parse(readFileSync('src/i18n/m11.en.json', 'utf8'));
    for (const x of list) for (const rr of x.reasons) expect(en.why[rr.key.split('.').pop()!], rr.key).toBeTruthy();
  });
  it('mapProblems() validates a keyspace edit', () => {
    expect(mapProblems({ key: 'bwr-ops', key_kind: 'radar', sk_id: 'sk-co-02', relation: 'transfers', need_level: 3 })).toEqual([]);
    expect(mapProblems({ key: 'X', key_kind: 'nope', sk_id: 'co-02', relation: 'maybe', need_level: 7 })).toEqual(['key', 'key_kind', 'sk_id', 'relation', 'need_level']);
  });
});

describe('FS04 RBAC and RPCs', () => {
  it('radar: HR analyst, CHCO office and auditors read it; managers, training, observers and anonymous visitors are refused', async () => {
    for (const p of ['k-hr-analyst', 'chco', 'k-auditor']) { await as(p); expect((await b.rpc.futureRadar(A)).rows).toHaveLength(8); }
    for (const p of ['sro', 'training-mgr', 'k-observer', 'k-instructor', null]) { await as(p); await expect(b.rpc.futureRadar(A)).rejects.toThrow(); }
  });
  it('map: frameworks R for everyone (also anonymous); edits are admin-only, audited, never delete, and keep one active skill per key', async () => {
    await as(null);
    expect((await b.list('future_skill_map')).length).toBe(map.length);
    await as('k-hr-analyst');
    expect((await b.rpc.saveFutureSkillMap({ key: 'bwr-ops', key_kind: 'radar', sk_id: 'sk-co-02', relation: 'transfers', need_level: 3 })).code).toBe('forbidden');
    await as('k-admin');
    expect((await b.rpc.saveFutureSkillMap({ key: 'bwr-ops', key_kind: 'radar', sk_id: 'sk-sa-01', relation: 'transfers', need_level: 2 })).code).toBe('security_restricted');
    expect((await b.rpc.saveFutureSkillMap({ key: 'nope-key', key_kind: 'radar', sk_id: 'sk-co-02', relation: 'transfers', need_level: 2 })).code).toBe('not_found');
    expect((await b.rpc.saveFutureSkillMap({ key: 'as-lab-qa', key_kind: 'adv_skill', sk_id: 'sk-ch-02-labqa', relation: 'transfers', need_level: 2, active: false })).code).toBe('conflict');
    const r = await b.rpc.saveFutureSkillMap({ key: 'as-remote-ops', key_kind: 'adv_skill', sk_id: 'sk-co-01-rounds', relation: 'adapts', need_level: 3, primary_sk: true });
    expect(r.ok).toBe(true);
    expect(b.raw('audit_events').at(-1)).toMatchObject({ action: 'future.map', outcome: 'ok', actor_role: 'admin' });
    expect(b.rawGet('adv_skills', 'as-remote-ops')!.sk_ids[0]).toBe('sk-co-01-rounds');
    const off = await b.rpc.saveFutureSkillMap({ key: 'as-remote-ops', key_kind: 'adv_skill', sk_id: 'sk-co-01-rounds', relation: 'adapts', need_level: 3, active: false });
    expect(off.ok).toBe(true);
    expect(b.rawGet('future_skill_map', 'fsm:as-remote-ops:sk-co-01-rounds')!.active).toBe(false); // switched off, not deleted
    expect(b.rawGet('adv_skills', 'as-remote-ops')!.sk_ids).not.toContain('sk-co-01-rounds');
    expect(rowsOf(b.raw('future_skill_map') as never, 'as-remote-ops').some((m) => m.primary_sk)).toBe(true);
  });
  it('gap plans are re-keyed to sk-* ids and keep the old key as the label; sk-* keys are accepted directly', async () => {
    await as('k-hr-analyst');
    const y = new Date().getUTCFullYear() + 1;
    const r = await b.rpc.saveSkillGapPlan({ skill_key: 'salt-chemistry', scenario: A, action: 'partner', owner_role: 'Nuclear Training (role)', target_quarter: `${y}-Q3` });
    expect(r.ok).toBe(true);
    expect(b.rawGet('skill_gap_plans', r.data!.id)).toMatchObject({ skill_key: 'salt-chemistry', sk_id: 'sk-ch-01-advchem' });
    const d = await b.rpc.saveSkillGapPlan({ skill_key: 'sk-da-02', scenario: B, action: 'train', owner_role: 'Digital (role)', target_quarter: `${y}-Q4` });
    expect(b.rawGet('skill_gap_plans', d.data!.id)).toMatchObject({ skill_key: 'sk-da-02', sk_id: 'sk-da-02' });
    expect((await b.rpc.saveSkillGapPlan({ skill_key: 'sk-sa-01', scenario: B, action: 'train', owner_role: 'Digital (role)', target_quarter: `${y}-Q4` })).code).toBe('not_found');
    expect(T.skill_gap_plans.find((p) => p.id === 'gp-1')).toMatchObject({ skill_key: 'liquid-metal', sk_id: 'sk-pf-02-advcool' });
  });
  it('public /future payloads stay clean (the map is public reference data)', () => {
    const rows = [...T.future_skill_map, ...T.adv_skills, ...T.adv_technologies, ...T.future_roles];
    expect(publicTextIsClean(rows)).toBe(true);
    const en = JSON.parse(readFileSync('src/i18n/m11.en.json', 'utf8'));
    expect(publicTextIsClean([en.pub, en.ks, en.bench])).toBe(true);
  });
});
