// @vitest-environment jsdom
/**
 * Wave 2 integration (QA lead): the hand-offs between wave-2 features and earlier waves once the five branches are merged.
 *  - F12 -> F07: courses agreed in a held or acknowledged career conversation rank first among the coach's courses and say so.
 *  - F11 -> F08: the heatmap's "post an opportunity" action pre-fills the skill the gig develops (?skill=).
 *  - F11 -> F13: the heatmap's "request mentoring" action pre-selects the focus skill on /my/mentoring (?skill=).
 *  - F16 -> F10: leadership readiness links to a skill check-in with the unmet leadership skills pre-selected (?skills=).
 */
import { describe, expect, it } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import seed from '../../src/seed/seed.json';
import { buildCoachFeed } from '../../src/modules/m19/coach';
import { agreedCourses, coachInputFrom, type CoachTables } from '../../src/modules/m19/inputs';
import { lintRanked } from '../../src/domain/engines';
import { SCHEMA } from '../../src/data/schema';
import { renderPage } from './g1-harness';
import CheckinsPage from '../../src/modules/m17/CheckinsPage';
import PostOpportunityPage from '../../src/modules/m20/PostOpportunityPage';
import MyMentoringPage from '../../src/modules/m04/MyMentoringPage';
import LeadershipPage from '../../src/modules/m22/LeadershipPage';

type Rows = Record<string, any>[];
const S = seed as unknown as { tables: Record<string, Rows>; meta: { demo_today: string } };
const T = S.tables;
const NOW = S.meta.demo_today;
const WAIT = { timeout: 15000 };
const tablesFor = (personId: string, patch: (t: Record<string, Rows>) => void = () => {}): CoachTables => {
  const t = structuredClone(T);
  patch(t);
  return { ...(t as never as CoachTables), person: t.people.find((p) => p.id === personId) as never };
};

describe('wave 2 merged schema', () => {
  it('has every wave-2 table', () => {
    for (const t of ['skill_checkins', 'skill_ratings', 'team_skill_targets', 'career_conversations', 'mentoring_agreements', 'mentoring_sessions', 'mentoring_private_notes', 'refresh_state', 'refresh_prefs',
      'rotation_templates', 'rotation_cohorts', 'rotation_placements', 'shadow_hosts', 'shadow_requests', 'leadership_programmes', 'leadership_nominations', 'leadership_360_requests', 'leadership_360',
      'communities', 'community_members', 'threads', 'posts', 'expert_optin', 'expert_requests', 'ks_sessions'])
      expect(Object.prototype.hasOwnProperty.call(SCHEMA, t), t).toBe(true);
  });
});

describe('F12 -> F07: agreed conversation actions reach the coach', () => {
  const pick = (rows: Rows) => agreedCourses(rows);
  it('takes employee course actions of held or acknowledged conversations only', () => {
    const base = { id: 'cc-x', person_id: 'p-x', held_on: '2026-09-01', employee_agrees: true, actions: [
      { kind: 'course', course_id: 'c-a', owner: 'employee' }, { kind: 'course', course_id: 'c-b', owner: 'manager' }, { kind: 'ojt', course_id: null, owner: 'employee' }] };
    expect(pick([{ ...base, status: 'held' }])).toEqual([{ course_id: 'c-a', conversation_id: 'cc-x', held_on: '2026-09-01' }]);
    expect(pick([{ ...base, status: 'acknowledged' }])).toHaveLength(1);
    expect(pick([{ ...base, status: 'draft' }])).toEqual([]);
    expect(pick([{ ...base, status: 'acknowledged', employee_agrees: false }])).toEqual([]);
  });
  it('an agreed course ranks first among courses with the "agreed" reason', () => {
    const person = 'p-qc-inspector';
    const base = buildCoachFeed(coachInputFrom(tablesFor(person), NOW)!);
    const seen = new Set([...base.pool.values()].filter((c) => c.kind === 'course').map((c) => c.itemId));
    const done = new Set([...T.training_records.filter((r) => r.person_id === person).map((r) => r.course_id), ...T.enrolments.filter((e) => e.person_id === person).map((e) => e.course_id)]);
    const eligible = T.courses.filter((c) => c.audience === 'staff' && !done.has(c.id) && (c.prerequisites ?? []).every((p: string) => done.has(p)));
    const course = eligible.find((c) => !seen.has(c.id)) ?? eligible[eligible.length - 1]!;
    expect(course).toBeTruthy();
    const conv = { id: 'cc-it-1', person_id: person, status: 'acknowledged', held_on: '2026-09-15', employee_agrees: true, actions: [{ id: 'a1', kind: 'course', course_id: course.id, owner: 'employee', title: { en: 'x', ar: 'x' }, due_on: null }] };
    const input = coachInputFrom(tablesFor(person, (t) => { t.career_conversations = [...(t.career_conversations ?? []).filter((c) => c.person_id !== person), conv]; }), NOW)!;
    expect(input.agreedCourses).toEqual([{ course_id: course.id, conversation_id: 'cc-it-1', held_on: '2026-09-15' }]);
    const res = buildCoachFeed(input);
    const card = res.pool.get(`course:${course.id}`)!;
    expect(card.reasons[0]).toMatchObject({ code: 'agreed', key: 'm19.reasons.agreed', ref: { table: 'career_conversations', id: 'cc-it-1' } });
    const courses = res.feed.filter((c) => c.kind === 'course' && !c.pinned);
    expect(courses[0]?.itemId).toBe(course.id);
    expect(lintRanked(res.feed.map((c) => ({ id: c.id, score: c.score, reasons: c.reasons })))).toEqual([]);
  });
});

describe('cross-feature links (pages)', () => {
  it('F11 -> F08: /opportunities/post?skill= pre-fills the skill the gig develops', async () => {
    await renderPage(<PostOpportunityPage />, { persona: 'training-mgr', path: '/opportunities/post?skill=sk-hu-02' });
    const gain = await screen.findByTestId('m20-pick-gain', {}, WAIT);
    expect(gain.textContent).toMatch(/\(1\/6\)/);
    expect(within(gain).getAllByRole('button', { name: /^Remove / })).toHaveLength(1);
    expect((gain.querySelector('input[type="checkbox"]:checked') as HTMLInputElement | null)).toBeTruthy();
  }, 40000);
  it('F11 -> F13: /my/mentoring?skill= pre-selects the focus skill', async () => {
    await renderPage(<MyMentoringPage />, { persona: 'qc-inspector', path: '/my/mentoring?skill=sk-hu-02' });
    const focus = await screen.findByTestId('m04-focus-skills', {}, WAIT);
    const on = within(focus).getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(on).toHaveLength(1);
  }, 40000);
  it('F16 -> F10: leadership readiness links to a check-in with the unmet skills, which open pre-selected', async () => {
    await renderPage(<LeadershipPage />, { persona: 'k-ro', path: '/leadership' });
    const link = await screen.findByTestId('m22-ask-checkin', {}, WAIT);
    const href = link.getAttribute('href')!;
    expect(href).toMatch(/\/my\/skills\/checkins\?skills=/);
    const ids = decodeURIComponent(href.split('skills=')[1]).split(',');
    expect(ids.length).toBeGreaterThanOrEqual(1);
    await renderPage(<CheckinsPage />, { persona: 'k-ro', path: `/my/skills/checkins?skills=${ids.join(',')}` });
    const list = await screen.findByTestId('m17-ci-skills', {}, WAIT);
    const checked = [...list.querySelectorAll('input[type="checkbox"]:checked')].map((x) => x.getAttribute('data-testid')!.replace('m17-ci-skill-', ''));
    expect(checked.length).toBeGreaterThanOrEqual(1);
    expect(checked.every((id) => ids.includes(id))).toBe(true);
  }, 60000);
});
