/** FS84 Team 2030 capability targets and an organisation skills inventory (FS wave I · E5, M17): one named test per acceptance criterion
 *  on the local path, plus the rules (FS05 profiles as needs, the 2028 half-way rule, the target rule), the additive horizon column (F11
 *  coverage unchanged), the adopt RPC (scope, refusals, audit, rows switched off and never removed), RBAC, the seed, routes and i18n.
 *  The SQL path (kafaa_tt_* = teamTargets.ts, the three RPCs, the redefined kafaa_team_coverage, grants) is proved by
 *  scripts/validate/fs95-team-targets-inventory.mjs (PGlite). */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { SCHEMA } from '../../src/data/schema';
import { FEATURE_BENCHMARKS } from '../../src/domain/taxonomy';
import { checkGuard } from '../../src/auth/guards';
import { MIN_GROUP_SIZE, type PlatformRole } from '../../src/auth/policy';
import en from '../../src/i18n/m17.en.json';
import ar from '../../src/i18n/m17.ar.json';
import seed from '../../src/seed/seed.json';
import { routes } from '../../src/modules/m17/routes';
import { groupsOf } from '../../src/modules/m17/checkins';
import {
  TT_MIN, adoptPlan, dataQuality, futureTargetId, futureTargets, level2028, modeLevel, orgInventory, pctOf, publishedVersion, reqsOf, roleNeed, targetReasons, ttCtx,
  type StoredTarget,
} from '../../src/modules/m17/teamTargets';
// @ts-expect-error the seed builder is plain JavaScript (node loads it in build-seed.mjs)
import { ADOPTIONS, versionsAsOf } from '../../scripts/seed/ext/fs84-team-targets.mjs';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const T = (seed as unknown as { tables: Record<string, Row[]> }).tables;
const TODAY = new Date().toISOString().slice(0, 10);
const CTX = ttCtx(T as never);
const STAFF = T.people.filter((p) => p.kind === 'staff' && p.status === 'active');
const inG = (p: Row, key: string) => key === `team:${p.team_id}` || key === `family:${p.job_family_id}`;
const members = (key: string) => STAFF.filter((p) => inG(p, key)).map((p) => ({ id: p.id, job_role_id: p.job_role_id ?? null }));
const ft = (key: string, h: '2028' | '2030', people = true, stored = T.team_skill_targets as StoredTarget[]) =>
  futureTargets({ ctx: CTX, horizon: h, group: key, members: members(key), states: T.person_skills as never, stored, people });

let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
const raw = (t: string) => (b.raw(t as never) as unknown as Row[]);
beforeAll(async () => { b = new LocalBackend(); await b.whenReady(); await b.reset(); }, 120000);

describe('FS84 · acceptance 1: cells under 10 are suppressed', () => {
  it('every inventory cell (area and skill, entity and family, totals) is null under 10, and a group under 10 staff shows no figures', () => {
    for (const dim of ['entity', 'family'] as const) {
      const inv = orgInventory({ ctx: CTX, skills: T.skills, people: T.people as never, states: T.person_skills as never, dim, today: TODAY });
      const cells = [...inv.areas, ...inv.skills].flatMap((r) => [r.total, ...r.cells]);
      expect(cells.every((c) => c.n === null || c.n >= TT_MIN)).toBe(true);
      expect(cells.every((c) => (c.n === null) === (c.pct === null))).toBe(true);
      expect(cells.some((c) => c.n === null)).toBe(true);
      expect(cells.some((c) => c.n !== null)).toBe(true);
      for (const g of inv.groups.filter((x) => x.staff === null)) expect([...inv.areas, ...inv.skills].every((r) => r.cells.find((c) => c.g === g.id)!.n === null)).toBe(true);
      if (dim === 'family') expect(inv.groups.map((g) => g.id)).not.toEqual(expect.arrayContaining(['security']));
    }
    expect(TT_MIN).toBe(MIN_GROUP_SIZE);
  });
  it('a group of 9 is suppressed and a group of 10 is shown (generated people at the key level)', () => {
    const skill = T.skills.find((s) => s.id === 'sk-da-01')!;
    const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `x-${i}`, kind: 'staff', status: 'active', entity_id: 'ent-x', job_family_id: 'operations' }));
    for (const [n, shown] of [[9, false], [10, true]] as const) {
      const ppl = [...mk(n), ...Array.from({ length: 5 }, (_, i) => ({ id: `y-${i}`, kind: 'staff', status: 'active', entity_id: 'ent-x', job_family_id: 'operations' }))];
      const states = mk(n).map((p) => ({ person_id: p.id, skill_id: skill.id, level: skill.key_level, basis: 'evidenced', active: true }));
      const inv = orgInventory({ ctx: CTX, skills: [skill], people: ppl as never, states, dim: 'entity', today: TODAY });
      expect(inv.skills[0].cells[0].n, `n=${n}`).toBe(shown ? n : null);
      expect(inv.skills[0].total.n).toBe(shown ? n : null);
    }
  });
  it('HR aggregates of a team under 10 hide counts, holders and members; managers in scope see their own team named', () => {
    const small = groupsOf(STAFF as never).filter((g) => g.size < TT_MIN);
    expect(small.length).toBeGreaterThan(5);
    for (const g of small) {
      const x = ft(g.key, '2030', false);
      expect(x.suppressed).toBe(true);
      expect(x.summary.readiness).toBeNull();
      expect(x.members).toEqual([]);
      expect(x.targets.every((t) => t.n === null && t.min_people === null && t.gap === null && t.status === 'suppressed' && !t.holders && t.roles.every((r) => r.people === null))).toBe(true);
    }
    const crew = ft('team:ops-crew-b', '2030', true);
    expect(crew.suppressed).toBe(false);
    expect(crew.members.length).toBe(8);
  });
  it('the local RPC applies it: HR (Agg) reads a small team as suppressed counts; the inventory carries no person ids', async () => {
    await as('chco');
    const r = await b.rpc.teamFutureTargets('team:rp', '2030');
    expect(r.mode).toBe('aggregate');
    expect(r.suppressed).toBe(true);
    expect(r.people).toEqual([]);
    const inv = await b.rpc.orgSkillInventory('entity');
    expect(JSON.stringify(inv)).not.toMatch(/"(p|w)-[a-z]/);
  });
});

describe('FS84 · acceptance 2: data-quality figures reproduce from rules (TS = SQL)', () => {
  it('the local RPC returns exactly dataQuality() and orgInventory() on the stored rows (the PGlite validator proves kafaa_tt_quality = dataQuality)', async () => {
    await as('k-hr-analyst');
    for (const dim of ['entity', 'family'] as const) {
      const r = (await b.rpc.orgSkillInventory(dim))!;
      const w = { ctx: ttCtx({ skills: raw('skills'), competencies: raw('competencies'), role_profile_versions: raw('role_profile_versions') }), skills: raw('skills'), people: raw('people') as never, states: raw('person_skills') as never, dim, today: TODAY };
      expect(r.quality).toEqual(dataQuality(w));
      expect(r.inventory).toEqual(orgInventory(w));
    }
  });
  it('the headline figures recompute by hand from the definitions shown on the page', () => {
    const q = dataQuality({ ctx: CTX, skills: T.skills, people: T.people as never, states: T.person_skills as never, dim: 'entity', today: TODAY });
    const ids = new Set(STAFF.map((p) => p.id));
    const st = T.person_skills.filter((s) => ids.has(s.person_id) && s.active !== false && s.level > 0 && s.basis !== 'none' && !CTX.restricted.has(s.skill_id));
    const prof = new Set(st.map((s) => s.person_id)).size;
    const due = new Map(T.skills.map((s) => [s.id, s.review_due]));
    const stale = st.filter((s) => (Array.isArray(s.reasons) && s.reasons[0]?.ageing === true) || (due.get(s.skill_id) && String(due.get(s.skill_id)) < TODAY)).length;
    const val = st.filter((s) => ['verified', 'validated'].includes(s.basis)).length;
    expect(q.staff).toBe(STAFF.length);
    expect(q.profiled_pct).toBe(Math.round((100 * prof) / STAFF.length));
    expect(q.states).toBe(st.length);
    expect(q.stale).toBe(stale);
    expect(q.stale_pct).toBe(pctOf(stale, st.length));
    expect(q.validated_pct).toBe(pctOf(val, st.length));
    expect(q.basis.claimed).toBe(st.filter((s) => s.basis === 'claimed').length);
    expect(q.req_pct).not.toBeNull();
    expect(q.overdue_skills).toBe(T.skills.filter((s) => !CTX.restricted.has(s.id) && s.review_due && String(s.review_due) < TODAY).length);
    expect(q.by_group.find((g) => g.g === 'enec-con')!.staff).toBeNull(); // one person: suppressed
  });
  it('a stale state is one whose newest evidence passed its half-life (FS03) or whose skill is past its review date (FS54); a claimed level never counts as validated', () => {
    const s = T.skills.find((x) => x.id === 'sk-da-01')!;
    const ppl = Array.from({ length: 24 }, (_, i) => ({ id: `z-${i}`, kind: 'staff', status: 'active', entity_id: 'e', job_role_id: null }));
    const states = ppl.map((p, i) => ({ person_id: p.id, skill_id: s.id, level: 2, basis: i < 4 ? 'claimed' : 'validated', active: true, reasons: [{ ageing: i % 2 === 0 }] }));
    const ctx = ttCtx({ skills: [{ ...s, review_due: '2099-01-01' }], competencies: T.competencies, role_profile_versions: [] });
    const q = dataQuality({ ctx, skills: [{ ...s, review_due: '2099-01-01' }], people: ppl as never, states, dim: 'entity', today: TODAY });
    expect(q.ageing).toBe(12);
    expect(q.validated).toBe(20);
    expect(q.basis.claimed).toBeNull(); // 4 people: suppressed
    const ctx2 = ttCtx({ skills: [{ ...s, review_due: '2020-01-01' }], competencies: T.competencies, role_profile_versions: [] });
    expect(dataQuality({ ctx: ctx2, skills: [{ ...s, review_due: '2020-01-01' }], people: ppl as never, states, dim: 'entity', today: TODAY }).stale).toBe(24);
  });
});

describe('FS84 · acceptance 3: each team target shows the 2030 role-profile version it came from', () => {
  it('every derived target in every group names, per role, the published 2030 profile version (id and number) and lists it in its versions', () => {
    const pub = new Map(T.role_profile_versions.filter((v) => v.horizon === '2030' && v.status === 'published').map((v) => [v.id, v]));
    let n = 0;
    for (const g of groupsOf(STAFF as never)) for (const h of ['2028', '2030'] as const) {
      for (const t of ft(g.key, h).targets) {
        n++;
        expect(t.roles.length).toBeGreaterThan(0);
        for (const r of t.roles) {
          expect(pub.get(r.version_id)?.role_id).toBe(r.role_id);
          expect(pub.get(r.version_id)?.version).toBe(r.version);
          expect(t.versions).toContain(r.version_id);
        }
        if (h === '2028') expect(t.roles.every((r) => !r.now_version_id || t.versions.includes(r.now_version_id))).toBe(true);
      }
    }
    expect(n).toBeGreaterThan(100);
  });
  it('the reasons behind each target name the role, its level and the profile version (Why this?)', () => {
    const x = ft('team:ops-crew-b', '2030').targets.find((t) => t.skill_id === 'sk-fs-ai-verify')!;
    const rs = targetReasons(x, '2030', (id) => ({ en: id, ar: id }));
    expect(rs[0].key).toBe('m17.tt.why.rule_2030');
    const ro = rs.find((r) => r.code === 'tt_role' && (r.vars!.role as { en: string }).en === 'reactor-operator')!;
    expect(ro.vars!.version).toBe(2);
    expect(ro.ref).toEqual({ table: 'role_profile_versions', id: 'rpv-reactor-operator-2030-v2' });
    expect(rs.some((r) => r.code === 'tt_new')).toBe(true);
    for (const r of rs) expect(r.key in flat(en) || r.key.replace(/^m17\./, '') in flat(en)).toBe(true);
  });
  it('stored targets keep their versions: crew B adopted on 2026-09-01 (reactor-operator 2030 v1) is flagged after v2 was published', async () => {
    await as('sro');
    const r = await b.rpc.teamFutureTargets(null, '2030');
    expect(r.group).toBe('team:ops-crew-b');
    expect(r.mode).toBe('people');
    const changed = r.targets.filter((t) => t.changed);
    expect(changed.length).toBeGreaterThan(0);
    expect(changed.some((t) => t.versions.includes('rpv-reactor-operator-2030-v2') && !t.adopted!.versions.includes('rpv-reactor-operator-2030-v2') && t.adopted!.versions.includes('rpv-reactor-operator-2030-v1'))).toBe(true);
    expect(r.adopted_at).toBe('2026-09-01T09:00:00Z');
    expect(r.adopted_by).toBe('p-sro');
  });
});

describe('FS84 rules', () => {
  it('FS05 profiles become skill needs: competency -> core skill, highest level, security and unknown left out; path-only roles need nothing', () => {
    const v = publishedVersion(T.role_profile_versions, 'reactor-operator', '2030')!;
    expect(v.id).toBe('rpv-reactor-operator-2030-v2');
    const r = reqsOf(v, CTX);
    expect(r.get('sk-fs-ai-verify')).toBe(2);
    expect([...r.keys()].every((s) => !CTX.restricted.has(s))).toBe(true);
    const sec = T.role_profile_versions.find((x) => x.path_only && x.horizon === '2030' && x.status === 'published');
    if (sec) expect(roleNeed(sec.role_id, '2030', CTX).status).toBe('path_only');
    expect(roleNeed(null, '2030', CTX).status).toBe('no_role');
    expect(roleNeed('no-such-role', '2030', CTX).status).toBe('no_profile');
    const odd = reqsOf({ id: 'x', path_only: false, requirements: [{ kind: 'skill', ref_id: 'sk-da-01', level: 2.5 }, { kind: 'skill', ref_id: 'sk-da-01', level: '3' }, { kind: 'skill', ref_id: 'nope', level: 2 }, { kind: 'skill', ref_id: 'sk-da-01', level: 1 }] }, CTX);
    expect([...odd]).toEqual([['sk-da-01', 1]]);
  });
  it('2028 is half-way from today to 2030, rounded up; a lower 2030 level is kept', () => {
    expect([[0, 1], [0, 2], [0, 3], [1, 4], [2, 3], [3, 3], [3, 2]].map(([n, l]) => level2028(n, l))).toEqual([1, 1, 2, 3, 3, 3, 2]);
    const r28 = roleNeed('reactor-operator', '2028', CTX);
    const r30 = roleNeed('reactor-operator', '2030', CTX);
    expect(r28.needs.get('sk-fs-ai-verify')).toBe(1);
    expect(r30.needs.get('sk-fs-ai-verify')).toBe(2);
  });
  it('the target level is the mode of the roles\' levels (ties to the higher), the count is everyone needing at least that level; holders count counted evidence only', () => {
    expect(modeLevel([2, 2, 3])).toBe(2);
    expect(modeLevel([2, 3])).toBe(3);
    expect(modeLevel([4, 1, 1, 4])).toBe(4);
    const crew = ft('team:ops-crew-b', '2030');
    const da = crew.targets.find((t) => t.skill_id === 'sk-da-01')!;
    expect(da.min_people).toBe(8);
    const claimedOnly = crew.targets.find((t) => t.holders!.length === 0 && t.n === 0);
    expect(claimedOnly?.status ?? 'uncovered').toBe('uncovered');
    const states = (T.person_skills as Row[]).map((s) => (s.person_id === 'p-k-ro' && s.skill_id === 'sk-da-01' ? { ...s, basis: 'claimed', level: 4 } : s));
    const x = futureTargets({ ctx: CTX, horizon: '2030', group: 'team:ops-crew-b', members: members('team:ops-crew-b'), states: states as never, stored: [], people: true });
    expect(x.targets.find((t) => t.skill_id === 'sk-da-01')!.holders).not.toContain('p-k-ro');
  });
  it('targets are ordered by gap, members by id (never ranked by readiness)', () => {
    const x = ft('family:operations', '2030');
    const gaps = x.targets.map((t) => t.gap!);
    expect(gaps).toEqual([...gaps].sort((a, c) => c - a));
    expect(x.members.map((m) => m.id)).toEqual([...x.members.map((m) => m.id)].sort());
    const src = readFileSync('src/modules/m17/teamTargets.ts', 'utf8');
    expect(src).not.toMatch(/useEngine|lintRanked/);
  });
  it('adoptPlan writes only the targets that are new or changed and switches off the ones that no longer derive', () => {
    const crew = ft('team:ops-crew-b', '2030');
    const p = adoptPlan(crew);
    expect(p.write.length).toBe(crew.targets.filter((t) => !t.adopted || t.changed).length);
    expect(p.kept + p.write.length).toBe(crew.targets.length);
    const stale: StoredTarget = { id: futureTargetId('2030', 'team:ops-crew-b', 'sk-zz'), team_id: 'team:ops-crew-b', skill_id: 'sk-zz', min_people: 1, min_level: 1, horizon: '2030', active: true };
    expect(adoptPlan(ft('team:ops-crew-b', '2030', true, [...(T.team_skill_targets as StoredTarget[]), stale])).retire).toEqual(['sk-zz']);
  });
});

describe('FS84 · additive horizon column and the F11 coverage', () => {
  it('team_skill_targets gains horizon (current | 2028 | 2030, default current) and profile_version_ids; the 24 F11 rows stay current', () => {
    const cols = SCHEMA.team_skill_targets.cols as Record<string, string>;
    expect(cols.horizon).toMatch(/enum:current\|2028\|2030 ='current'/);
    expect(cols.profile_version_ids).toBe('text[] =[]');
    const cur = T.team_skill_targets.filter((t) => t.horizon === 'current');
    expect(cur.length).toBe(24);
    expect(cur.every((t) => t.id === `tst:${t.team_id}:${t.skill_id}` && t.profile_version_ids.length === 0)).toBe(true);
    const sql = readFileSync('supabase/migrations/20261010295001_kafaa_fs95_team_targets_inventory.sql', 'utf8');
    expect(sql).toMatch(/alter table kafaa_team_skill_targets add column if not exists horizon text not null default 'current'/);
    expect(sql).not.toMatch(/\b(drop|delete|truncate)\b/i);
  });
  it('F11 teamCoverage reads current targets only: adopted 2028/2030 targets never change coverage or the crew profile', async () => {
    await as('sro');
    const c = await b.rpc.teamCoverage('team:ops-crew-b');
    const cur = T.team_skill_targets.filter((t) => t.horizon === 'current' && t.team_id === 'team:ops-crew-b');
    expect(c.targets.length).toBe(cur.length);
    expect(c.crew_profile.length).toBe(T.team_skill_targets.filter((t) => t.team_id === 'crew:profile').length);
  });
});

describe('FS84 RPCs (local)', () => {
  it('teamFutureTargets: managers read their scope in people mode (= futureTargets); auditors and anonymous visitors are refused', async () => {
    await as('sro');
    const r = await b.rpc.teamFutureTargets('team:ops-crew-b', '2028');
    const { mode, groups, people, ...core } = r;
    expect(mode).toBe('people');
    expect(groups.some((g) => g.key === 'team:ops-crew-b')).toBe(true);
    expect(people.length).toBe(8);
    expect(core).toEqual(futureTargets({ ctx: ttCtx({ skills: raw('skills'), competencies: raw('competencies'), role_profile_versions: raw('role_profile_versions') }), horizon: '2028', group: 'team:ops-crew-b',
      members: members('team:ops-crew-b'), states: raw('person_skills') as never, stored: raw('team_skill_targets') as never, people: true }));
    await as('k-auditor');
    await expect(b.rpc.teamFutureTargets(null, '2030')).rejects.toThrow(/managers in scope/);
    await as(null);
    await expect(b.rpc.teamFutureTargets(null, '2030')).rejects.toThrow();
  });
  it('orgSkillInventory: HR (Agg) and the training manager (A) read it; managers, auditors, observers, employees and partners get null', async () => {
    for (const p of ['chco', 'k-hr-analyst', 'training-mgr']) { await as(p); expect(await b.rpc.orgSkillInventory('entity'), p).not.toBeNull(); }
    for (const p of ['sro', 'k-auditor', 'k-observer', 'nse', 'k-admin', 'alnoor-gm']) { await as(p); expect(await b.rpc.orgSkillInventory('entity'), p).toBeNull(); }
    await as('chco');
    expect((await b.rpc.orgSkillInventory('bogus' as never))!.inventory.dim).toBe('entity');
  });
  it('adoptFutureTargets: refusals in order, the manager adopts crew B (changed rows written, the rest kept), again is unchanged; every call audited, no ledger', async () => {
    const audits = () => raw('audit_events').length;
    const ledger = () => raw('ledger_local').length;
    const a0 = audits(), l0 = ledger();
    await as('nse');
    expect((await b.rpc.adoptFutureTargets({ team_id: 'team:ops-crew-b', horizon: '2030' })).code).toBe('forbidden');
    await as('chco');
    expect((await b.rpc.adoptFutureTargets({ team_id: 'team:ops-crew-b', horizon: '2030' })).code).toBe('forbidden');
    await as('sro');
    expect((await b.rpc.adoptFutureTargets({ team_id: 'team:rp', horizon: '2030' })).code).toBe('forbidden');
    expect((await b.rpc.adoptFutureTargets({ team_id: 'crew:profile', horizon: '2030' })).code).toBe('invalid');
    expect((await b.rpc.adoptFutureTargets({ team_id: 'team:ops-crew-b', horizon: '2035' as never })).code).toBe('invalid');
    expect((await b.rpc.adoptFutureTargets({ team_id: 'team:nobody', horizon: '2030' })).code).toBe('not_found');
    const before = await b.rpc.teamFutureTargets('team:ops-crew-b', '2030');
    const want = before.targets.filter((t) => !t.adopted || t.changed).length;
    const r = await b.rpc.adoptFutureTargets({ team_id: 'team:ops-crew-b', horizon: '2030', note: ' After the v2 profiles. ' });
    expect(r.ok).toBe(true);
    expect(r.data).toEqual({ written: want, retired: 0, kept: before.targets.length - want });
    const again = await b.rpc.adoptFutureTargets({ team_id: 'team:ops-crew-b', horizon: '2030' });
    expect(again.code).toBe('unchanged');
    const after = await b.rpc.teamFutureTargets('team:ops-crew-b', '2030');
    expect(after.targets.every((t) => t.adopted && !t.changed)).toBe(true);
    const rows = raw('team_skill_targets').filter((t) => t.team_id === 'team:ops-crew-b' && t.horizon === '2030');
    expect(rows.filter((t) => t.note === 'After the v2 profiles.').length).toBe(want);
    expect(audits()).toBe(a0 + 8);
    expect(ledger()).toBe(l0);
    await as('training-mgr');
    expect((await b.rpc.adoptFutureTargets({ team_id: 'team:eng', horizon: '2028' })).ok).toBe(true);
  });
  it('a stored target that no longer derives is switched off on the next adoption and kept (never removed)', async () => {
    await as('sro');
    const id = futureTargetId('2030', 'team:ops-crew-b', 'sk-zz-gone');
    b.rawInsert('team_skill_targets', { id, team_id: 'team:ops-crew-b', skill_id: 'sk-zz-gone', min_people: 1, min_level: 1, note: null, active: true, set_by: 'p-sro', updated_at: '2026-09-01T09:00:00Z', horizon: '2030', profile_version_ids: [] } as never);
    const n0 = raw('team_skill_targets').length;
    const r = await b.rpc.adoptFutureTargets({ team_id: 'team:ops-crew-b', horizon: '2030' });
    expect(r.ok).toBe(true);
    expect(r.data!.retired).toBe(1);
    expect((b.rawGet('team_skill_targets', id) as Row).active).toBe(false);
    expect(raw('team_skill_targets').length).toBe(n0);
  });
});

describe('FS84 seed, routes, benchmarks and i18n', () => {
  it('the three adopted sets reproduce futureTargets() on the profiles published on their adoption date', () => {
    for (const a of ADOPTIONS) {
      const ctx = ttCtx({ skills: T.skills, competencies: T.competencies, role_profile_versions: versionsAsOf(T.role_profile_versions, a.asOf) });
      const x = futureTargets({ ctx, horizon: a.horizon as '2028' | '2030', group: a.group, members: members(a.group), states: [], stored: [], people: true });
      const got = T.team_skill_targets.filter((t) => t.team_id === a.group && t.horizon === a.horizon);
      expect(got.length, a.group).toBe(x.targets.length);
      for (const t of x.targets) {
        const g = got.find((y) => y.skill_id === t.skill_id)!;
        expect([g.min_people, g.min_level, [...g.profile_version_ids].sort()]).toEqual([t.min_people, t.min_level, t.versions]);
        expect(g.set_by).toBe(a.by);
      }
    }
    expect(T.team_skill_targets.filter((t) => t.horizon !== 'current').every((t) => !String(t.updated_at).startsWith('2026-10-1'))).toBe(true);
  });
  it('two routes: /team/skills/future (skills_profile Scope/A/Agg) and /workforce/skills-inventory (skills_profile Agg/A)', () => {
    const f = routes.find((r) => r.id === 'team-skills-future')!;
    const i = routes.find((r) => r.id === 'workforce-skills-inventory')!;
    expect(f.path).toBe('/team/skills/future');
    expect(f.guard.grant).toEqual({ res: 'skills_profile', levels: ['Scope', 'A', 'Agg'] });
    expect(i.path).toBe('/workforce/skills-inventory');
    expect(i.guard.grant).toEqual({ res: 'skills_profile', levels: ['Agg', 'A'] });
    const can = (g: typeof f.guard, rs: PlatformRole[]) => checkGuard(g, { status: 'signed_in', roles: rs } as never) === 'ok';
    expect(can(f.guard, ['manager'])).toBe(true);
    expect(can(f.guard, ['hr_director'])).toBe(true);
    expect(can(f.guard, ['employee'])).toBe(false);
    expect(can(i.guard, ['hr_analyst'])).toBe(true);
    expect(can(i.guard, ['training_manager'])).toBe(true);
    expect(can(i.guard, ['manager'])).toBe(false);
    expect(can(i.guard, ['auditor'])).toBe(false);
    expect(can(i.guard, ['observer'])).toBe(false);
    expect(checkGuard(i.guard, { status: 'anonymous', roles: ['public'] } as never)).toBe('signin');
  });
  it('the pages show the FS84 benchmark chips (ISO 30414, IAEA workforce planning)', () => {
    expect(FEATURE_BENCHMARKS.FS84).toEqual(['ISO30414', 'IAEA-WFP']);
    for (const f of ['TeamFutureTargetsPage.tsx', 'SkillsInventoryPage.tsx']) expect(readFileSync(`src/modules/m17/${f}`, 'utf8')).toMatch(/<BenchmarkChips feature="FS84" \/>/);
  });
  it('EN and AR keys are in parity for the new sections and route titles; pages use logical classes only', () => {
    const e = flat(en), a = flat(ar);
    const mine = Object.keys(e).filter((k) => /^(tt|inv)\.|^routes\.(team-skills-future|workforce-skills-inventory)\./.test(k));
    expect(mine.length).toBeGreaterThan(100);
    for (const k of mine) expect(a[k], k).toBeTruthy();
    for (const f of ['TeamFutureTargetsPage.tsx', 'SkillsInventoryPage.tsx']) expect(readFileSync(`src/modules/m17/${f}`, 'utf8')).not.toMatch(/\b(ml|mr|pl|pr)-\d|\b(left|right)-\d|text-(left|right)\b/);
  });
});

function flat(o: Record<string, unknown>, p = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v && typeof v === 'object') Object.assign(out, flat(v as Record<string, unknown>, `${p}${k}.`));
    else out[`${p}${k}`] = String(v);
  }
  return out;
}
