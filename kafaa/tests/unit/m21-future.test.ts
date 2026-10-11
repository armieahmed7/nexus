/** F09 Future Me: readiness formula, bridge plan, horizon lanes, goals and the demand signal (LocalBackend = SQL mirror). */
import { beforeEach, describe, expect, it } from 'vitest';
import seed from '../../src/seed/seed.json';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { lintRanked } from '../../src/domain/engines';
import { publicTextIsClean } from '../../src/domain/future';
import {
  advLevels, bridgePlan, familyReadiness, goalTarget, laneLevel, rankBridges, rankFutureRoles, rankResources, readinessIndex, roleDistance, RELATION_FACTOR, TARGET_LEVEL,
  type StateLite,
} from '../../src/modules/m21/future';

type Row = Record<string, any>;
const T = (seed as unknown as { tables: Record<string, Row[]> }).tables;
const techs = T.adv_technologies as { id: string; family_en: string; family_ar: string }[];
const adv = T.adv_skills as never[];
const skills = T.skills as never[];
const statesOf = (p: string) => T.person_skills.filter((s) => s.person_id === p && s.active !== false) as StateLite[];
const goalData = { advSkills: adv, skills, bridges: T.skill_bridges as never[], roles: T.future_roles as never[], lanes: T.horizon_lanes as never[], jobRoles: T.job_roles as never[], techs };

describe('readiness index (F09 formula)', () => {
  it('weights transfers 1, adapts 0.5 and new 0, on levels capped at 3', () => {
    expect(RELATION_FACTOR).toEqual({ transfers: 1, adapts: 0.5, new: 0 });
    expect(TARGET_LEVEL).toBe(3);
    const a = [
      { id: 'a1', tech_id: 't', relation: 'transfers', skill_en: 'A1', skill_ar: 'A1' },
      { id: 'a2', tech_id: 't', relation: 'adapts', skill_en: 'A2', skill_ar: 'A2' },
      { id: 'a3', tech_id: 't', relation: 'new', skill_en: 'A3', skill_ar: 'A3' },
      { id: 'a4', tech_id: 't', relation: 'new', skill_en: 'A4', skill_ar: 'A4' },
    ];
    const lv = new Map([['a1', { level: 4, via: 's1', basis: 'verified' }], ['a2', { level: 3, via: 's2', basis: 'verified' }], ['a3', { level: 3, via: 's3', basis: 'verified' }]]);
    const f = familyReadiness('t', a, lv);
    // (1 × 3/3 + 0.5 × 3/3 + 0 + 0) / 4 = 0.375
    expect(f.index).toBe(37.5);
    expect(f.ceiling).toBe(37.5);
    expect(f.counts).toEqual({ transfers: 1, adapts: 1, new: 2 });
  });

  it('changing one verified skill changes the index deterministically (acceptance)', () => {
    const base: StateLite[] = statesOf('p-k-ro');
    const r0 = readinessIndex(techs, adv, skills, base);
    const r0b = readinessIndex(techs, adv, skills, base);
    expect(JSON.stringify(r0.families)).toBe(JSON.stringify(r0b.families));
    const bwr0 = r0.families.find((f) => f.tech_id === 'tech-bwr')!;
    // k-ro has no chemistry evidence: a verified level 2 on primary-side chemistry lifts "BWR water chemistry" (adapts).
    expect(base.some((s) => s.skill_id === 'sk-ch-01-primary' || s.skill_id === 'sk-ch-01')).toBe(false);
    const changed = [...base, { skill_id: 'sk-ch-01-primary', level: 2, basis: 'verified', active: true }];
    const r1 = readinessIndex(techs, adv, skills, changed);
    const bwr1 = r1.families.find((f) => f.tech_id === 'tech-bwr')!;
    const n = bwr0.n;
    const expected = Math.round((10 * 100 * (bwr0.items.reduce((s, i) => s + i.credit, 0) + 0.5 * (2 / 3))) / n) / 10;
    expect(bwr1.index).toBe(expected);
    expect(bwr1.index).toBeGreaterThan(bwr0.index);
    expect(r1.overall).toBeGreaterThan(r0.overall);
    // only the family that holds the changed skill moves
    for (const f of r1.families.filter((x) => x.tech_id !== 'tech-bwr' && x.tech_id !== 'tech-msr')) expect(f.index).toBe(r0.families.find((g) => g.tech_id === f.tech_id)!.index);
    // a new skill counts zero: evidence on it leaves the index unchanged
    const newOnly = readinessIndex(techs, adv, skills, [...base, { skill_id: 'sk-pf-02-advcool', level: 3, basis: 'verified', active: true }]);
    expect(newOnly.families.find((f) => f.tech_id === 'tech-htgr')!.index).toBe(r0.families.find((f) => f.tech_id === 'tech-htgr')!.index);
  });

  it('every one of the six families has an index between 0 and its ceiling, and reasons', () => {
    for (const p of ['p-k-ro', 'p-sro', 'p-k-lo-trainee', 'p-training-mgr', 'p-k-hr-analyst']) {
      const r = readinessIndex(techs, adv, skills, statesOf(p));
      expect(r.families).toHaveLength(6);
      for (const f of r.families) {
        expect(f.index).toBeGreaterThanOrEqual(0);
        expect(f.index).toBeLessThanOrEqual(f.ceiling);
        expect(f.reasons.length).toBeGreaterThan(0);
        expect(lintRanked([{ id: f.tech_id, score: f.index, reasons: f.reasons }])).toEqual([]);
      }
    }
  });

  it('a reactor operator already carries over conduct of operations and reactivity', () => {
    const lv = advLevels(adv, skills, statesOf('p-k-ro'));
    expect(lv.get('as-conduct-of-ops')!.level).toBeGreaterThanOrEqual(3);
    expect(lv.get('as-reactivity')!.level).toBeGreaterThanOrEqual(3);
  });

  it('security-area skills never count towards an ADVANCE skill', () => {
    const sec = (skills as Row[]).filter((s) => s.area === 'security');
    expect(sec.every((s) => s.adv_skill_ids.length === 0)).toBe(true);
    const lv = advLevels(adv, [...(skills as Row[]), { id: 'sk-x', competency_id: 'sa-01', area: 'security', adv_skill_ids: ['as-remote-ops'], name_en: 'x', name_ar: 'x' }] as never, [{ skill_id: 'sk-x', level: 4 }]);
    expect(lv.get('as-remote-ops')!.level).toBe(0);
  });
});

describe('bridge plan, learning and concept roles (F02 engines, reasons on every item)', () => {
  const edges = T.career_paths as never[];
  const r = readinessIndex(techs, adv, skills, statesOf('p-k-ro'));
  it('ranks 3 to 5 bridges, starting from my own role', () => {
    const ranked = rankBridges({ bridges: T.skill_bridges as never, families: r.families, myRole: 'reactor-operator', edges });
    expect(lintRanked(ranked)).toEqual([]);
    const plan = bridgePlan(ranked);
    expect(plan.length).toBeGreaterThanOrEqual(3);
    expect(plan.length).toBeLessThanOrEqual(5);
    expect(T.skill_bridges.find((b) => b.id === plan[0].id)!.from_role_id).toBe('reactor-operator');
    expect(roleDistance(edges, 'reactor-operator', 'senior-reactor-operator')).toBe(1);
    expect(roleDistance(edges, 'reactor-operator', 'chemistry-technician')).toBeNull();
  });
  it('ranks resources by gap closure and concept roles by link and overlap', () => {
    for (const f of r.families) {
      const res = rankResources(T.future_resources as never, f);
      expect(res.length).toBeGreaterThan(0);
      expect(lintRanked(res)).toEqual([]);
    }
    const roles = rankFutureRoles({ roles: T.future_roles as never, levels: r.levels, myRole: 'reactor-operator', edges });
    expect(lintRanked(roles)).toEqual([]);
    expect(roles[0].id).toBe('fr-bwr-operator');
  });
});

describe('horizon lanes and goals', () => {
  it('each lane cites a public source with an as-of date and public rows are clean (no headcount, no site)', () => {
    expect(T.horizon_lanes).toHaveLength(11); // FS14 Horizon lanes 2.0: 5 F09 lanes + 6
    for (const l of T.horizon_lanes) {
      expect(l.sources.length).toBeGreaterThan(0);
      for (const s of l.sources) {
        expect(s.url).toMatch(/^https:\/\//);
        expect(s.as_of).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
    expect(publicTextIsClean([...T.horizon_lanes, ...T.future_resources])).toBe(true);
    expect(publicTextIsClean([{ why_en: 'We will need 40 engineers at the candidate site' }])).toBe(false);
  });
  it('lane level averages non-security skills; security skills show qualified or not only', () => {
    const cyber = T.horizon_lanes.find((l) => l.id === 'lane-cyber')!;
    const lv = laneLevel(cyber as never, skills, statesOf('p-k-ro'));
    const sec = lv.items.find((i) => i.skill_id === 'sk-sa-01')!;
    expect(sec.security).toBe(true);
    expect(sec.level).toBe(0);
    expect(sec.qualified).toBe(true);
    const others = lv.items.filter((i) => !i.security);
    expect(lv.level).toBe(Math.round((10 * others.reduce((s, i) => s + i.level, 0)) / others.length) / 10);
    expect(cyber.path_only_role_ids).toContain('cyber-security-engineer');
  });
  it('goal targets never include security skills', () => {
    for (const l of T.horizon_lanes) expect(goalTarget('lane', l.id, goalData)!.skill_ids).not.toContain('sk-sa-01');
    const b = goalTarget('bridge', 'br-1', goalData)!;
    expect(b.tech_id).toBe('tech-bwr');
    expect(b.adv_skill_ids).toEqual([...b.adv_skill_ids].sort());
    expect(goalTarget('adv_skill', 'nope', goalData)).toBeNull();
  });
});

describe('LocalBackend: interest, goals and the demand signal', () => {
  let b: LocalBackend;
  const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
  beforeEach(async () => {
    b = new LocalBackend();
    await b.whenReady();
    await b.reset();
  });
  it('interest rows are own-only direct writes', async () => {
    await as('k-ro');
    expect((await b.insert('future_interest', { id: 'fi:p-k-ro:lane-ai', person_id: 'p-k-ro', target_kind: 'lane', lane_id: 'lane-ai' })).ok).toBe(true);
    expect((await b.insert('future_interest', { id: 'fi:p-sro:lane-ai', person_id: 'p-sro', target_kind: 'lane', lane_id: 'lane-ai' })).ok).toBe(false);
    expect((await b.list('future_interest')).every((r) => r.person_id === 'p-k-ro')).toBe(true);
    await as('training-mgr');
    expect((await b.list('future_interest')).filter((r) => r.person_id !== 'p-training-mgr')).toEqual([]);
    await as('k-hr-analyst');
    expect((await b.list('future_goals')).filter((r) => r.person_id !== 'p-k-hr-analyst')).toEqual([]);
  });
  it('setFutureGoal stores a coach target, is audited without a ledger write and refuses correctly', async () => {
    await as('k-ro');
    const led0 = b.raw('ledger_local').length;
    const r = await b.rpc.setFutureGoal('lane', 'lane-digital');
    expect(r.ok).toBe(true);
    const row = b.rawGet('future_goals', 'fg:p-k-ro:lane:lane-digital')!;
    expect(row.status).toBe('active');
    expect(row.skill_ids).toEqual(goalTarget('lane', 'lane-digital', goalData)!.skill_ids);
    const aud = b.raw('audit_events').filter((a) => a.action === 'future.goal').at(-1)!;
    expect(aud.outcome).toBe('ok');
    expect(aud.ledger_status).toBe('not_applicable');
    expect(b.raw('ledger_local').length).toBe(led0);
    expect((await b.rpc.setFutureGoal('lane', 'lane-digital', false)).data?.status).toBe('removed');
    expect((await b.rpc.setFutureGoal('lane', 'lane-digital', false)).code).toBe('not_found');
    expect((await b.rpc.setFutureGoal('salary' as never, 'x')).code).toBe('invalid');
    expect((await b.rpc.setFutureGoal('future_role', 'nope')).code).toBe('not_found');
    const targets = [...T.adv_skills.map((x) => ['adv_skill', x.id]), ...T.horizon_lanes.map((x) => ['lane', x.id])].slice(0, 13);
    const results = [];
    for (const [k, id] of targets) results.push(await b.rpc.setFutureGoal(k as never, id));
    expect(results.slice(0, 12).every((x) => x.ok)).toBe(true);
    expect(results[12].code).toBe('limit');
    await as('k-observer');
    expect((await b.rpc.setFutureGoal('lane', 'lane-ai')).code).toBe('forbidden');
    await as(null);
    expect((await b.rpc.setFutureGoal('lane', 'lane-ai')).code).toBe('not_signed_in');
  });
  it('futureDemand is aggregate-only and suppresses cells under 10 (acceptance)', async () => {
    await as('k-hr-analyst');
    const rows = await b.rpc.futureDemand();
    const bwr = rows.find((x) => x.source === 'interest' && x.target_id === 'tech-bwr')!;
    const msr = rows.find((x) => x.source === 'interest' && x.target_id === 'tech-msr')!;
    expect(bwr.n).toBeGreaterThanOrEqual(10);
    expect(msr.suppressed).toBe(true);
    expect(msr.n).toBeNull();
    expect(rows.every((x) => (x.suppressed ? x.n === null : (x.n ?? 0) >= 10))).toBe(true);
    expect(rows.some((x) => x.suppressed) && rows.some((x) => !x.suppressed)).toBe(true);
    await as('k-ro');
    await expect(b.rpc.futureDemand()).rejects.toThrow(/aggregate-only/);
  });
});
