/**
 * [FS wave B · E4 · FS14] Horizon lanes 2.0. One test per acceptance criterion (11 lanes with 3+ sources and as-of dates; all lane
 * text passes publicTextIsClean; interest aggregates under 10 are suppressed) plus the lane links, milestones, gigs, the watch
 * lane and the F26 hand-off (lane interest keeps feeding training-needs forecasting).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import seed from '../../src/seed/seed.json';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { MIN_GROUP_SIZE } from '../../src/auth/policy';
import { publicTextIsClean } from '../../src/domain/future';
import { LANE_HORIZONS, MIN_LANE_SOURCES, axisPos, horizonOfYear, laneLevel2, laneMilestones, laneProblems, linksOf, openGigs } from '../../src/modules/m21/lanes';
import { computeDemand, periodsFrom } from '../../src/modules/m25/needs';
import { SCHEMA } from '../../src/data/schema';

type Row = Record<string, any>;
const S = seed as unknown as { tables: Record<string, Row[]>; meta: { demo_today: string } };
const T = S.tables;
const NEW = ['lane-robotics', 'lane-ai-maint', 'lane-manufacturing', 'lane-hydrogen', 'lane-grid', 'lane-fusion'];

describe('FS14 acceptance', () => {
  it('AC1: 11 lanes, each with 3 or more sources and as-of dates', () => {
    expect(T.horizon_lanes).toHaveLength(11);
    for (const id of NEW) expect(T.horizon_lanes.some((l) => l.id === id), id).toBe(true);
    for (const l of T.horizon_lanes) {
      expect(laneProblems(l as never), l.id).toEqual([]);
      expect(l.sources.length).toBeGreaterThanOrEqual(MIN_LANE_SOURCES);
      for (const s of l.sources) {
        expect(s.url).toMatch(/^https:\/\//);
        expect(s.as_of).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(s.label.length).toBeGreaterThan(5);
      }
      expect(l.as_of).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(laneProblems({ id: 'x', code: 'x', horizon: 'now', skill_ids: [], sources: T.horizon_lanes[0].sources.slice(0, 2) } as never)).toContain('sources');
    expect(laneProblems({ id: 'x', code: 'x', horizon: 'now', skill_ids: [], sources: [{ label: 'a', url: 'http://x', as_of: '2026-01-01' }, { label: 'b', url: 'https://y' }, { label: 'c', url: 'https://y', as_of: '2026-01-01' }] } as never)).toEqual(expect.arrayContaining(['https', 'as_of', 'duplicate_source']));
  });

  it('AC2: all lane text passes publicTextIsClean (lanes, milestones, links, the lane resources)', () => {
    expect(publicTextIsClean([...T.horizon_lanes, ...T.horizon_milestones, ...T.horizon_lane_links])).toBe(true);
    expect(publicTextIsClean(T.future_resources.filter((r) => r.lane_ids.some((x: string) => NEW.includes(x))))).toBe(true);
    expect(publicTextIsClean(['Training for 3,700 jobs at the new site'])).toBe(false); // the guard bites
    for (const t of ['horizon_lanes', 'horizon_lane_links', 'horizon_milestones']) expect(SCHEMA[t].read).toEqual([{ res: 'public_content' }]);
  });

  it('AC3: interest aggregates under 10 are suppressed (and goals follow the same rule)', async () => {
    const b = new LocalBackend();
    await b.whenReady();
    await b.reset();
    b.setPersona('k-hr-analyst');
    await b.whenReady();
    const rows = await b.rpc.futureDemand();
    const seedN = (src: 'interest' | 'goal', id: string) => new Set((src === 'interest' ? T.future_interest.filter((i) => i.active && i.lane_id === id) : T.future_goals.filter((g) => g.status === 'active' && g.lane_id === id)).map((x) => x.person_id)).size;
    for (const id of NEW) for (const src of ['interest', 'goal'] as const) {
      const n = seedN(src, id);
      const cell = rows.find((r) => r.source === src && r.target_id === id);
      if (n === 0) { expect(cell).toBeUndefined(); continue; }
      if (n < MIN_GROUP_SIZE) expect(cell).toMatchObject({ n: null, suppressed: true });
      else expect(cell).toMatchObject({ n, suppressed: false });
    }
    expect(rows.find((r) => r.source === 'interest' && r.target_id === 'lane-grid')).toMatchObject({ n: null, suppressed: true });
    expect(rows.find((r) => r.source === 'interest' && r.target_id === 'lane-manufacturing')).toMatchObject({ n: null, suppressed: true });
    expect(rows.find((r) => r.source === 'interest' && r.target_id === 'lane-ai-maint')!.n).toBeGreaterThanOrEqual(10);
    expect(rows.every((r) => (r.suppressed ? r.n === null : (r.n ?? 0) >= MIN_GROUP_SIZE))).toBe(true);
    b.setPersona('k-ro');
    await b.whenReady();
    await expect(b.rpc.futureDemand()).rejects.toThrow(); // individual staff never see the aggregate (nor anyone's rows)
  }, 60000);
});

describe('FS14 lanes: skills, learning, gigs, milestones', () => {
  it('lanes sit now / next / later; the fusion lane is a watch (awareness only) lane; codes HZ-1..HZ-11', () => {
    for (const h of Object.keys(LANE_HORIZONS)) expect(T.horizon_lanes.filter((l) => l.horizon === h).length).toBeGreaterThanOrEqual(3);
    expect(T.horizon_lanes.filter((l) => l.kind === 'watch').map((l) => l.id)).toEqual(['lane-fusion']);
    expect(T.horizon_lanes.map((l) => l.code).sort()).toEqual(Array.from({ length: 11 }, (_, i) => `HZ-${i + 1}`).sort());
  });
  it('every lane lists FS02 future skills (never a security skill) and its links resolve', () => {
    const sk = new Map(T.skills.map((s) => [s.id, s]));
    const ids = { course: new Set(T.courses.map((c) => c.id)), track: new Set(T.adv_tracks.map((t) => t.id)), gig: new Set(T.opportunities.map((o) => o.id)) };
    for (const l of T.horizon_lanes) {
      const lk = linksOf(T.horizon_lane_links as never, l.id);
      expect(lk.skill.length, l.id).toBeGreaterThanOrEqual(2);
      for (const s of lk.skill) { expect(sk.get(s.ref_id)?.fs_area).toBeTruthy(); expect(sk.get(s.ref_id)?.area).not.toBe('security'); }
      for (const c of lk.course) expect(ids.course.has(c.ref_id)).toBe(true);
      for (const c of lk.track) expect(ids.track.has(c.ref_id)).toBe(true);
      for (const c of lk.gig) expect(ids.gig.has(c.ref_id)).toBe(true);
      expect(lk.course.length + lk.track.length + lk.pathway.length, l.id).toBeGreaterThan(0);
      for (const s of l.skill_ids) expect(sk.has(s)).toBe(true);
    }
  });
  it('open gigs show only open, listed opportunities (a closed gig linked to a lane is not shown)', () => {
    const gigs = openGigs(T.horizon_lane_links as never, 'lane-ai-maint', T.opportunities as never);
    expect(gigs.map((g) => g.id)).toEqual(['opp-digital-twin-study', 'opp-outage-schedule-analytics']);
    expect(linksOf(T.horizon_lane_links as never, 'lane-ai-maint').gig.map((g) => g.ref_id)).toContain('opp-chem-trending-2026'); // closed
    expect(T.horizon_lanes.filter((l) => openGigs(T.horizon_lane_links as never, l.id, T.opportunities as never).length > 0).length).toBeGreaterThanOrEqual(5);
  });
  it('lanes are placed against dated, sourced milestones; the timeline axis maps them', () => {
    expect(T.horizon_milestones.length).toBeGreaterThanOrEqual(12);
    for (const m of T.horizon_milestones) {
      expect(m.sources.length).toBeGreaterThan(0);
      for (const s of m.sources) expect(s.url).toMatch(/^https:\/\//);
      expect(m.year).toBeGreaterThanOrEqual(2023);
      expect(m.year).toBeLessThanOrEqual(2035);
    }
    for (const l of T.horizon_lanes) {
      const ms = laneMilestones(l as never, T.horizon_milestones as never);
      expect(ms.length, l.id).toBe(l.milestone_ids.length);
      expect(ms.length).toBeGreaterThan(0);
    }
    expect(horizonOfYear(2025)).toBe('now');
    expect(horizonOfYear(2030)).toBe('next');
    expect(horizonOfYear(2034)).toBe('later');
    expect(axisPos(2023, 1)).toBe(0);
    expect(axisPos(2040)).toBe(1);
  });
  it('my lane level averages today\'s and future skills; security skills show qualified only', () => {
    const states = T.person_skills.filter((s) => s.person_id === 'p-k-ro');
    const lv = laneLevel2(T.horizon_lanes.find((l) => l.id === 'lane-cyber') as never, T.horizon_lane_links as never, T.skills as never, states as never);
    expect(lv.items.some((i) => i.future)).toBe(true);
    const sec = lv.items.find((i) => i.skill_id === 'sk-sa-01')!;
    expect(sec.security).toBe(true);
    expect(sec.level).toBe(0);
    const scored = lv.items.filter((i) => !i.security);
    expect(lv.level).toBe(Math.round((10 * scored.reduce((s, i) => s + i.level, 0)) / scored.length) / 10);
  });
});

describe('FS14 -> F26: lane interest keeps feeding training-needs forecasting', () => {
  it('interest in a new lane becomes a "future" course need for the courses tagged with it, and the seeded snapshots equal the rules', () => {
    const now = S.meta.demo_today;
    const input = { people: T.people, courses: T.courses, curriculum_rules: T.curriculum_rules, training_records: T.training_records, enrolments: T.enrolments, qual_records: T.qual_records,
      qual_standards: T.qual_standards, links: T.needs_links, roadmaps: T.roadmaps, coach_feedback: T.coach_feedback, future_interest: T.future_interest, future_resources: T.future_resources, klra_actions: T.klra_actions, klra_positions: T.klra_positions };
    const periods = periodsFrom(now);
    const all = periods.flatMap((p) => computeDemand(input as never, p, now));
    expect(all.some((r) => r.source === 'future' && r.course_id === 'c-eng-cont')).toBe(true); // hydrogen, grid and manufacturing lanes
    for (const p of periods) expect(computeDemand(input as never, p, now)).toEqual(T.demand_snapshots.filter((s) => s.period === p).map(({ computed_at, computed_by, open_read, ...r }) => r));
    const without = { ...input, future_interest: T.future_interest.filter((i) => !NEW.includes(i.lane_id)) };
    const sum = (x: Row[]) => x.filter((r) => r.source === 'future').reduce((s, r) => s + r.count, 0);
    expect(sum(all)).toBeGreaterThan(sum(periods.flatMap((p) => computeDemand(without as never, p, now))));
  });
});

describe('FS14 migration is additive', () => {
  it('no drop, delete or truncate; NEXUS objects untouched; data statements are guarded', () => {
    const sql = readFileSync('supabase/migrations/20261010224001_kafaa_fs24_future_readiness.sql', 'utf8').replace(/--.*$/gm, '');
    expect(/\b(drop|truncate|delete)\b/i.test(sql)).toBe(false);
    for (const m of sql.matchAll(/\b(?:alter table|create table if not exists|(?<!do )update|insert into)\s+([a-z_]+)/gi)) expect(m[1].startsWith('kafaa_'), m[0]).toBe(true);
    expect(sql).toContain("where id = 'lane-netzero' and as_of is null");
    expect(sql).toContain("where id = 'future' and version < 2");
  });
});

describe('FS14 RLS on the LocalBackend', () => {
  let b: LocalBackend;
  beforeEach(async () => { b = new LocalBackend(); await b.whenReady(); await b.reset(); });
  it('anonymous visitors read lanes, links and milestones (public reference data); nobody writes them directly', async () => {
    b.setPersona(null);
    await b.whenReady();
    expect((await b.list('horizon_lanes')).length).toBe(11);
    expect((await b.list('horizon_lane_links')).length).toBe(T.horizon_lane_links.length);
    expect((await b.list('horizon_milestones')).length).toBe(T.horizon_milestones.length);
    b.setPersona('k-admin');
    await b.whenReady();
    expect((await b.insert('horizon_lanes', { id: 'lane-x' } as never)).ok).toBe(false);
  });
});
