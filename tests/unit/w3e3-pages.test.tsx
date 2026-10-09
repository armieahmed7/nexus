// @vitest-environment jsdom
/** F22 Handover 2030 board rendered with the real providers and the in-memory LocalBackend: SAMPLE/SIMULATED labels and
 *  definition links on every figure (A2), suppressed cells shown as "suppressed" (A1), the burn-down and the ranked risk list
 *  with reasons, the what-if (SIMULATED) controls, the role view, the observer-safe release for HR, the overview link, the
 *  definitions panel and the Arabic page. */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import HandoverPage from '../../src/modules/m07/HandoverPage';
import WorkforcePage from '../../src/modules/m07/WorkforcePage';
import WorkforceDefinitionsPage from '../../src/modules/m07/WorkforceDefinitionsPage';

const T = { timeout: 15000 };

describe('F22 pages', { timeout: 60000 }, () => {
  it('A1 + A2: tiles carry SAMPLE/SIMULATED and a definition link; small cells read "suppressed" and no number under 10 is shown', async () => {
    await renderPage(<HandoverPage />, { persona: 'chco', path: '/workforce/handover' });
    const tiles = await screen.findByTestId('m07-ho-tiles', {}, T);
    for (const k of ['handover_cover', 'handover_ready', 'handover_pipeline', 'handover_risk']) {
      const tile = within(tiles).getByTestId(`m07-tile-${k}`);
      const link = within(tile).getByRole('link', { name: /Definition/i });
      expect(link.getAttribute('href')).toBe(`/workforce/definitions#${k}`);
      expect(tile.textContent).toMatch(/SAMPLE|SIMULATED|Sample|Simulated/i);
    }
    expect(screen.getByTestId('m07-ho-labels').textContent).toMatch(/SAMPLE/i);
    const table = screen.getByTestId('m07-ho-table');
    expect(within(table).getAllByTestId('m07-ho-suppressed').length).toBeGreaterThan(5);
    for (const td of Array.from(table.querySelectorAll('td'))) {
      const n = td.textContent?.trim() ?? '';
      if (/^\d+$/.test(n)) expect(Number(n)).toBeGreaterThanOrEqual(10);
    }
    expect(screen.getByTestId('m07-ho-burndown')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /Definition/i }).length).toBeGreaterThanOrEqual(7);
  });
  it('the risk list ranks functions with a shortfall, each with "Why this?" reasons and links that degrade gracefully', async () => {
    await renderPage(<HandoverPage />, { persona: 'chco', path: '/workforce/handover' });
    const list = await screen.findByTestId('m07-ho-risks', {}, T);
    const items = within(list).getAllByTestId('m07-ho-risk');
    expect(items.length).toBeGreaterThan(0);
    fireEvent.click(within(items[0]).getByTestId('m07-ho-why'));
    expect((await screen.findByTestId('m07-ho-why-panel')).textContent).toMatch(/fall short|OSSA end/);
    expect(items[0].textContent).toMatch(/Knowledge loss risk|Knowledge capture|Succession/);
  });
  it('what-if: changing the OSSA end shows the SIMULATED notice and the reset; the role view lists roles with links', async () => {
    await renderPage(<HandoverPage />, { persona: 'chco', path: '/workforce/handover' });
    await screen.findByTestId('m07-ho-tiles', {}, T);
    expect(screen.queryByTestId('m07-ho-whatif')).toBeNull();
    fireEvent.change(screen.getByTestId('m07-ho-ossa'), { target: { value: '2029' } });
    fireEvent.change(screen.getByTestId('m07-ho-slip'), { target: { value: '12' } });
    expect((await screen.findByTestId('m07-ho-whatif', {}, T)).textContent).toMatch(/2029/);
    await waitFor(() => expect(screen.getByTestId('m07-ho-burndown').textContent).toBeTruthy(), T);
    fireEvent.click(screen.getByTestId('m07-ho-reset'));
    await waitFor(() => expect(screen.queryByTestId('m07-ho-whatif')).toBeNull(), T);
    fireEvent.click(screen.getByTestId('m07-ho-dim-roles'));
    const table = await screen.findByTestId('m07-ho-table');
    await waitFor(() => expect(within(table).getAllByRole('link').some((a) => a.getAttribute('href')?.startsWith('/careers/roles/'))).toBe(true), T);
  });
  it('HR prepares an observer-safe release draft through a confirmation; a line manager sees no release control', async () => {
    await renderPage(<HandoverPage />, { persona: 'chco', path: '/workforce/handover' });
    fireEvent.click(await screen.findByTestId('m07-ho-release', {}, T));
    fireEvent.click(await screen.findByTestId('confirm-action'));
    expect((await screen.findByTestId('m07-ho-release-done', {}, T)).textContent).toMatch(/or-ho-2026-q3-/);
  });
  it('a line manager reads the board without the release control', async () => {
    await renderPage(<HandoverPage />, { persona: 'sro', path: '/workforce/handover' });
    await screen.findByTestId('m07-ho-tiles', {}, T);
    expect(screen.queryByTestId('m07-ho-release')).toBeNull();
  });
  it('renders in Arabic with Arabic labels and the suppressed marker', async () => {
    await renderPage(<HandoverPage />, { persona: 'chco', path: '/ar/workforce/handover' });
    const tiles = await screen.findByTestId('m07-ho-tiles', {}, T);
    expect(tiles.textContent).toMatch(/[؀-ۿ]/);
    expect(screen.getAllByTestId('m07-ho-suppressed')[0].textContent).toBe('محجوب');
  });
  it('the workforce overview links to the board and the definitions panel defines every handover figure', async () => {
    await renderPage(<WorkforcePage />, { persona: 'chco', path: '/workforce' });
    await waitFor(() => expect(screen.getAllByRole('link').some((a) => a.getAttribute('href') === '/workforce/handover')).toBe(true), T);
    await renderPage(<WorkforceDefinitionsPage />, { persona: 'chco', path: '/workforce/definitions' });
    const defs = await screen.findByTestId('m07-definitions', {}, T);
    for (const k of ['handover_cover', 'handover_ready', 'handover_pipeline', 'handover_burndown', 'handover_risk', 'handover_emirati']) expect(defs.querySelector(`#${k}`)).toBeTruthy();
  });
});
