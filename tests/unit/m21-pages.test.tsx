// @vitest-environment jsdom
/** F09 pages: every index carries the SIMULATED chip and the no-decision line (EN and AR); the plan, lanes and goals render;
 * the HR demand page shows suppressed cells; goals hand off through the RPC. */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderPage } from './g1-harness';
import { getLocalBackend } from '../../src/data';
import MyFuturePage from '../../src/modules/m21/MyFuturePage';
import MyFutureTechPage from '../../src/modules/m21/MyFutureTechPage';
import FutureDemandPage from '../../src/modules/m21/FutureDemandPage';
import { routes } from '../../src/modules/m21/routes';
import en from '../../src/i18n/m11.en.json';
import ar from '../../src/i18n/m11.ar.json';

const indexesCarryChipAndLine = (line: string, chip: string, min = 7) => {
  const idx = screen.getAllByTestId(/^m21-index/);
  expect(idx.length).toBeGreaterThanOrEqual(min); // /my/future: overall + six families (+ concept roles)
  for (const el of idx) {
    expect(el.textContent).toContain(chip);
    expect(el.textContent).toContain(line);
  }
};

describe('/my/future', () => {
  it('renders the readiness, bridge plan, horizon lanes and roles for k-ro; every index is SIMULATED with the no-decision line', async () => {
    await renderPage(<MyFuturePage />, { persona: 'k-ro', path: '/my/future' });
    await waitFor(() => expect(screen.getAllByTestId('m21-family')).toHaveLength(6));
    indexesCarryChipAndLine(en.common.noDecision, 'SIMULATED');
    const plan = screen.getAllByTestId('m21-bridge');
    expect(plan.length).toBeGreaterThanOrEqual(3);
    expect(plan.length).toBeLessThanOrEqual(5);
    expect(screen.getAllByTestId('m21-lane')).toHaveLength(5);
    expect(screen.getAllByTestId('m21-future-role').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('why-this').length).toBeGreaterThan(10);
    expect(screen.getAllByTestId('m21-sources').length).toBeGreaterThanOrEqual(5);
  });

  it('renders in Arabic with the Arabic no-decision line on every index', async () => {
    await renderPage(<MyFuturePage />, { persona: 'k-ro', path: '/ar/my/future' });
    await waitFor(() => expect(screen.getAllByTestId('m21-family')).toHaveLength(6));
    indexesCarryChipAndLine(ar.common.noDecision, '');
    expect(document.body.textContent).toContain('خريطة الأفق');
  });

  it('"Add to my learning goals" stores a coach target through the RPC', async () => {
    await renderPage(<MyFuturePage />, { persona: 'k-ro', path: '/my/future' });
    await waitFor(() => expect(screen.getAllByTestId('m21-lane')).toHaveLength(5));
    const lane = screen.getAllByTestId('m21-lane')[0];
    fireEvent.click(lane.querySelector('[data-testid="m21-goal"]')!);
    await waitFor(() => expect(getLocalBackend().raw('future_goals').some((g) => g.person_id === 'p-k-ro' && g.status === 'active')).toBe(true));
    await waitFor(() => expect(screen.getByTestId('m21-goals').textContent).toContain('Digital I&C and plant data'));
  });
});

describe('/my/future/:tech and the HR demand page', () => {
  it('shows the skill breakdown for one family', async () => {
    await renderPage(<MyFutureTechPage />, { persona: 'k-ro', path: '/my/future/bwr', route: '/my/future/:tech' });
    await waitFor(() => expect(screen.getAllByTestId('m21-breakdown-row').length).toBe(5));
    indexesCarryChipAndLine(en.common.noDecision, 'SIMULATED', 2);
  });
  it('shows suppressed cells to HR and no individual rows', async () => {
    await renderPage(<FutureDemandPage />, { persona: 'k-hr-analyst', path: '/workforce/future/interest' });
    await waitFor(() => expect(screen.getByTestId('m21-demand').textContent).toContain('<10'));
    expect(document.body.textContent).not.toMatch(/p-k-ro|w-[a-z]+-\d+/);
  });
  it('declares three routes with staff guards', () => {
    expect(routes.map((r) => r.id)).toEqual(['my-future', 'my-future-tech', 'workforce-future-interest']);
    expect(routes.every((r) => r.guard.signedIn)).toBe(true);
    expect(routes[2].guard.grant).toEqual({ res: 'skills_profile', levels: ['Agg', 'A'] });
  });
});
