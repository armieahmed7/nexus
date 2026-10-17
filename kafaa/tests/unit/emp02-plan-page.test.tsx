// @vitest-environment jsdom
/** EMP-02 on the page: /my/plan as k-ro (licensed Reactor Operator, target SRO) on the local backend shows ranked suggestions with
 *  "Why this?" and no initial-training course, and the gap column is labelled as the current role's requirement. */
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderPage } from './g1-harness';
import MyPlanPage from '../../src/modules/m04/MyPlanPage';

const W = { timeout: 30000 };
describe('EMP-02 · /my/plan as k-ro', () => {
  it('suggests no GET, ONB, HU-101, LOIT or COIT course, each card has Why this?, and the column says "Your current role asks for"', async () => {
    const { container } = await renderPage(<MyPlanPage />, { persona: 'k-ro', path: '/my/plan' });
    await waitFor(() => expect(screen.getAllByTestId('m04-plan-suggestion').length).toBeGreaterThan(0), W);
    const courses = screen.getAllByTestId('m04-plan-suggestion').map((e) => e.getAttribute('data-course'));
    for (const c of ['c-get', 'c-onb', 'c-hu', 'c-loit-sys', 'c-loit-ojt', 'c-coit-gf', 'c-coit-sim', 'c-coit-exam', 'c-coct', 'c-intilaqa']) expect(courses, c).not.toContain(c);
    expect(screen.getAllByTestId('m04-plan-why').length).toBe(courses.length);
    expect(container.textContent).toContain('Your current role asks for');
  }, 90000);
});
