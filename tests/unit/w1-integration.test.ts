/**
 * Wave 1 integration (QA lead): the hand-offs between F05 (shortlist), F07 (coach), F08 (marketplace) and F09 (Future Me)
 * once the five branches are merged.
 *  - F05 -> F07: the coach plans for the active shortlist (archived targets drop out).
 *  - F09 -> F07: an active Future Me goal is a coach target (its non-security skills become needs at the target weight).
 *  - F08 -> F07: opportunity cards come only from listed, open rows with seats left and open the opportunity itself.
 *  - F05 -> F08: the marketplace's default target role is the top shortlisted role.
 */
import { describe, expect, it } from 'vitest';
import seed from '../../src/seed/seed.json';
import { buildCoachFeed } from '../../src/modules/m19/coach';
import { coachInputFrom, targetCandidates, type CoachTables } from '../../src/modules/m19/inputs';
import { defaultTarget } from '../../src/modules/m20/ui';
import { SCHEMA } from '../../src/data/schema';

type Rows = Record<string, any>[];
const S = seed as unknown as { tables: Record<string, Rows>; meta: { demo_today: string } };
const T = S.tables;
const NOW = S.meta.demo_today;
const tablesFor = (personId: string, patch: (t: Record<string, Rows>) => void = () => {}): CoachTables => {
  const t = structuredClone(T);
  patch(t);
  return { ...(t as never as CoachTables), person: t.people.find((p) => p.id === personId) as never };
};
const feed = (personId: string, patch?: (t: Record<string, Rows>) => void) => {
  const input = coachInputFrom(tablesFor(personId, patch), NOW)!;
  return { input, res: buildCoachFeed(input) };
};

describe('wave 1 merged schema', () => {
  it('has every wave-1 table', () => {
    for (const t of ['skill_claims', 'badges', 'career_targets', 'roadmaps', 'coach_feedback', 'learning_goals', 'opportunities', 'opportunity_applications', 'opportunity_saves', 'horizon_lanes', 'future_resources', 'future_interest', 'future_goals'])
      expect(Object.prototype.hasOwnProperty.call(SCHEMA, t), t).toBe(true);
  });
});

describe('F05 -> F07: shortlist targets', () => {
  it('k-ro: the coach plans for the active shortlist in rank order, after the focus roles', () => {
    const mine = T.career_targets.filter((x) => x.person_id === 'p-k-ro' && x.active !== false).sort((a, b) => a.rank - b.rank).map((x) => x.role_id);
    expect(mine.length).toBeGreaterThan(0);
    const cands = targetCandidates(tablesFor('p-k-ro'));
    const pos = mine.map((r) => cands.indexOf(r));
    expect(pos.every((p) => p >= 0)).toBe(true);
    expect([...pos].sort((a, b) => a - b)).toEqual(pos);
  });
  it('an archived target (active = false) is not planned for', () => {
    const victim = T.career_targets.find((x) => x.person_id === 'p-k-ro' && x.active !== false && x.role_id !== 'senior-reactor-operator')!;
    const before = targetCandidates(tablesFor('p-k-ro'));
    expect(before).toContain(victim.role_id);
    const after = targetCandidates(tablesFor('p-k-ro', (t) => { t.career_targets.find((x) => x.id === victim.id)!.active = false; }));
    const stillFromElsewhere = T.dev_plans.some((p) => p.person_id === 'p-k-ro' && p.target_role_id === victim.role_id) || (T.learning_goals.find((g) => g.person_id === 'p-k-ro')?.focus_role_ids ?? []).includes(victim.role_id);
    if (!stillFromElsewhere) expect(after).not.toContain(victim.role_id);
  });
});

describe('F09 -> F07: Future Me goals are coach targets', () => {
  const lane = T.horizon_lanes.find((l) => l.id === 'lane-digital')!;
  const goal = { id: 'fg:p-k-ro:lane:lane-digital', person_id: 'p-k-ro', kind: 'lane', ref_id: 'lane-digital', lane_id: 'lane-digital', tech_id: null, skill_ids: lane.skill_ids, adv_skill_ids: [], target_level: 2, title_en: lane.title_en, title_ar: lane.title_ar, status: 'active', source: 'future_me' };
  it('an active goal adds needs at the target-role weight, labelled with the goal, and some candidate names it', () => {
    const { input, res } = feed('p-k-ro', (t) => { t.future_goals = [...(t.future_goals ?? []), goal]; });
    expect(input.futureGoals?.map((g) => g.id)).toContain(goal.id);
    const needs = res.needs.filter((n) => n.role_id === `future:${goal.id}`);
    expect(needs.length).toBeGreaterThan(0);
    expect(needs.every((n) => n.weight === 0.6 && n.need === 2)).toBe(true);
    const skills = new Map(T.skills.map((s) => [s.id, s]));
    const comps = new Set(lane.skill_ids.map((id: string) => skills.get(id)?.competency_id));
    expect(needs.every((n) => comps.has(n.competency_id))).toBe(true);
    const named = [...res.pool.values()].some((c) => c.reasons.some((r) => (r.vars?.role as { en?: string } | undefined)?.en === lane.title_en));
    expect(named).toBe(true);
  });
  it('a paused goal or another person\'s goal adds nothing', () => {
    const paused = feed('p-k-ro', (t) => { t.future_goals = [{ ...goal, status: 'paused' }, { ...goal, id: 'fg:x', person_id: 'p-sro' }]; });
    expect(paused.res.needs.some((n) => n.role_id.startsWith('future:'))).toBe(false);
  });
  it('security-area skills in a goal never become needs', () => {
    const sec = T.skills.filter((s) => s.area === 'security').map((s) => s.id);
    expect(sec.length).toBeGreaterThan(0);
    const { res } = feed('p-k-ro', (t) => { t.future_goals = [{ ...goal, skill_ids: [...sec, ...lane.skill_ids] }]; });
    const secComps = new Set(T.skills.filter((s) => s.area === 'security').map((s) => s.competency_id));
    const onlySecurityComps = [...secComps].filter((c) => !T.skills.some((s) => s.competency_id === c && s.area !== 'security' && lane.skill_ids.includes(s.id)));
    expect(res.needs.filter((n) => n.role_id.startsWith('future:')).some((n) => onlySecurityComps.includes(n.competency_id))).toBe(false);
  });
});

describe('F08 -> F07: opportunity cards', () => {
  it('link to the opportunity itself and skip unlisted or full rows', () => {
    const { input, res } = feed('p-k-ro');
    const listed = new Set(T.opportunities.filter((o) => o.listed !== false && Number(o.seats_taken ?? 0) < Number(o.seats)).map((o) => o.id));
    expect(input.opportunities!.every((o) => listed.has(o.id))).toBe(true);
    const opp = [...res.pool.values()].filter((c) => c.kind === 'opportunity');
    expect(opp.length).toBeGreaterThan(0);
    for (const c of opp) expect(c.link).toBe(`/opportunities/${c.itemId}`);
    const full = feed('p-k-ro', (t) => { for (const o of t.opportunities) o.seats_taken = o.seats; });
    expect([...full.res.pool.values()].some((c) => c.kind === 'opportunity')).toBe(false);
  });
});

describe('F05 -> F08: marketplace target role', () => {
  it('defaults to the top shortlisted role, else the next vertical step', () => {
    const paths = T.career_paths as never;
    const nextStep = defaultTarget(paths, 'reactor-operator');
    expect(nextStep).toBe('senior-reactor-operator');
    expect(defaultTarget(paths, 'reactor-operator', ['human-performance-specialist', 'senior-reactor-operator'])).toBe('human-performance-specialist');
    expect(defaultTarget(paths, 'reactor-operator', ['reactor-operator'])).toBe('senior-reactor-operator');
    expect(defaultTarget(paths, null, [])).toBeNull();
  });
});
