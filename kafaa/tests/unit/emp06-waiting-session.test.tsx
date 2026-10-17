// @vitest-environment jsdom
/** EMP-06: an assigned classroom course with no session to book is not a dead end. k-ro's mandatory HU-101 (c-hu) is in progress,
 *  due 22 Nov, and its only seeded session was on 7 Oct: the course page says "Waiting for a session", who schedules and what happens
 *  next, the due date with a plural-aware day count, the progress the record holds, and links to My learning. Module ticks come from
 *  the learner's own module statements when there are any. Withdraw is a secondary button for a role-assigned course. */
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderPage } from './g1-harness';
import LearnCoursePage, { daysUntil, modulesWithRecord } from '../../src/modules/m04/LearnCoursePage';

const T = { timeout: 30000 };
const stmt = (id: string, object_id: string, verb = 'completed') => ({
  id, actor_person_id: 'p-k-ro', verb, object_type: 'module', object_id, object_name: { 'en-US': object_id }, result: null, context: {},
  occurred_at: '2026-10-10T08:00:00Z', stored_at: '2026-10-10T08:00:00Z', source: 'm04_course', source_ref: id, stored_by: null, version: '1.0.3',
});

describe('EMP-06 · helpers', () => {
  it('modulesWithRecord counts only this course’s modules with a completion-type statement', () => {
    const mods = [{ id: 'c-hu-m1' }, { id: 'c-hu-m2' }, { id: 'c-hu-m3' }];
    const got = modulesWithRecord(mods, [stmt('a', 'c-hu-m1'), stmt('b', 'c-hu-m2', 'attempted'), stmt('c', 'other-m1'), { ...stmt('d', 'c-hu-m3'), object_type: 'course' }, stmt('e', 'c-hu-m1', 'passed')]);
    expect([...got]).toEqual(['c-hu-m1']);
  });
  it('daysUntil works in whole UTC days', () => {
    expect(daysUntil('2026-11-22', '2026-10-17')).toBe(36);
    expect(daysUntil('2026-10-16', '2026-10-17')).toBe(-1);
    expect(daysUntil('2026-10-17', '2026-10-17')).toBe(0);
  });
});

describe('EMP-06 · the course page as k-ro', () => {
  it('HU-101 with no upcoming session shows the waiting callout, due date, progress and the way on', async () => {
    await renderPage(<LearnCoursePage />, { persona: 'k-ro', path: '/learn/course/c-hu', route: '/learn/course/:id' });
    const box = await screen.findByTestId('m04-waiting-session', {}, T);
    expect(box.textContent).toContain('Waiting for a session');
    expect(box.textContent).toContain('required for your role');
    expect(box.textContent).toMatch(/Nuclear Training schedules the sessions/);
    const due = screen.getByTestId('m04-waiting-due').textContent ?? '';
    expect(due).toMatch(/^Due 22 Nov 2026 \((in \d+ days?|overdue by \d+ days?)\)\.$/);
    expect(due).not.toMatch(/\b1 days\b/);
    expect(screen.getByTestId('m04-waiting-progress').textContent).toBe('Progress recorded so far: 75%.');
    expect(screen.getByTestId('m04-waiting-my-learning').getAttribute('href')).toMatch(/\/my\/learning$/);
    // prerequisite c-get is completed for k-ro, so the meanwhile line is the general one
    expect(box.textContent).toContain('keep up with the rest of your learning');
    // Withdraw stays available but is secondary for a role-assigned course
    expect(screen.getByTestId('m04-withdraw').className).toContain('btn-ghost');
    expect(screen.getAllByTestId('m04-module').every((m) => m.getAttribute('data-recorded') === 'no')).toBe(true);
  }, 90000);

  it('module statements in my own record tick the modules and say "2 of 4 modules recorded"', async () => {
    await renderPage(<LearnCoursePage />, {
      persona: 'k-ro', path: '/learn/course/c-hu', route: '/learn/course/:id',
      prepare: (b) => { b.rawInsert('xapi_statements', stmt('emp06-1', 'c-hu-m1') as never); b.rawInsert('xapi_statements', stmt('emp06-2', 'c-hu-m2', 'attended') as never); },
    });
    await screen.findByTestId('m04-waiting-session', {}, T);
    await waitFor(() => expect(screen.getByTestId('m04-waiting-progress').textContent).toBe('2 of 4 modules recorded in your learning record.'), T);
    expect(screen.getAllByTestId('m04-module').map((m) => m.getAttribute('data-recorded'))).toEqual(['yes', 'yes', 'no', 'no']);
  }, 90000);

  it('Arabic: the callout, the due date with an Arabic day count, and progress', async () => {
    await renderPage(<LearnCoursePage />, { persona: 'k-ro', path: '/ar/learn/course/c-hu', route: '/ar/learn/course/:id' });
    const box = await screen.findByTestId('m04-waiting-session', {}, T);
    expect(box.textContent).toContain('بانتظار جلسة');
    expect(box.textContent).toContain('التدريب النووي');
    expect(screen.getByTestId('m04-waiting-due').textContent).toMatch(/^الاستحقاق .+\((خلال|متأخر منذ) .+\)\.$/);
    expect(screen.getByTestId('m04-waiting-progress').textContent).toMatch(/^التقدّم المسجّل حتى الآن: /);
  }, 90000);

  it('a course with an upcoming session or no enrolment shows no waiting callout', async () => {
    // c-coct: k-ro is booked on s-coct-b
    await renderPage(<LearnCoursePage />, { persona: 'k-ro', path: '/learn/course/c-coct', route: '/learn/course/:id' });
    await screen.findByTestId('m04-course-chips', {}, T);
    await waitFor(() => expect(screen.getByText('Sessions')).toBeTruthy(), T);
    expect(screen.queryByTestId('m04-waiting-session')).toBeNull();
  }, 90000);
});
