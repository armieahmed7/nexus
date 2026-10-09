// @vitest-environment jsdom
/** F35 Skills supply-and-demand outlook page rendered with the real providers and the in-memory LocalBackend:
 *  A1 SIMULATED and a definitions link on every figure and chart, A2 suppressed families shown as "suppressed" only,
 *  A3 reset reproduces the baseline, A4 the publicTextIsClean guard on the release text; the tornado, the reasons,
 *  saved and released outlooks, the line-manager view, the overview link, the definitions panel and the Arabic page. */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import SkillsOutlookPage from '../../src/modules/m07/SkillsOutlookPage';
import WorkforcePage from '../../src/modules/m07/WorkforcePage';
import WorkforceDefinitionsPage from '../../src/modules/m07/WorkforceDefinitionsPage';

const T = { timeout: 20000 };

describe('F35 page', { timeout: 90000 }, () => {
  it('A1 + A2: every tile and chart carries SIMULATED and a definition link; suppressed families show no value', async () => {
    await renderPage(<SkillsOutlookPage />, { persona: 'chco', path: '/workforce/skills-outlook' });
    const tiles = await screen.findByTestId('m07-so-tiles', {}, T);
    const tileEls = within(tiles).getAllByTestId(/m07-tile-outlook_/);
    expect(tileEls.length).toBe(4);
    for (const tile of tileEls) {
      expect(within(tile).getByRole('link', { name: /Definition/i }).getAttribute('href')).toMatch(/^\/workforce\/definitions#outlook_/);
      expect(tile.textContent).toMatch(/SIMULATED|Simulated/i);
    }
    for (const id of ['m07-so-gapbars', 'm07-so-trend', 'm07-so-tornado', 'm07-so-byyear']) {
      const card = screen.getAllByTestId(id)[0].closest('.card') as HTMLElement;
      expect(card.textContent).toMatch(/Simulated|SIMULATED/i);
      expect(within(card).getByRole('link', { name: /Definition/i })).toBeTruthy();
    }
    expect(screen.getByTestId('m07-so-labels').textContent).toMatch(/SIMULATED|Simulated/i);
    const table = screen.getByTestId('m07-so-table');
    expect(within(table).getAllByTestId('m07-so-suppressed').length).toBeGreaterThanOrEqual(2);
    const sup = screen.getAllByTestId('m07-so-bar-project')[0];
    expect(sup.textContent).toMatch(/Suppressed/);
    expect(sup.textContent).not.toMatch(/\d/);
    expect(screen.getByTestId('m07-so-method').textContent).toMatch(/fewer than 10/);
  });
  it('the tornado ranks the assumptions and the family trend explains its gap with reasons', async () => {
    await renderPage(<SkillsOutlookPage />, { persona: 'k-hr-analyst', path: '/workforce/skills-outlook' });
    const tor = await screen.findByTestId('m07-so-tornado', {}, T);
    expect(within(tor).getAllByTestId(/m07-so-tornado-/).length).toBe(7);
    fireEvent.change(screen.getByTestId('m07-so-family'), { target: { value: 'operations' } });
    fireEvent.click(screen.getByTestId('m07-so-why'));
    expect((await screen.findByTestId('m07-so-why-panel')).textContent).toMatch(/Measured on \d+ staff/);
    expect(screen.getByTestId('m07-so-drivers').textContent).toMatch(/Attrition|KHNP handover|Known departures/);
  });
  it('A3: moving a slider makes a what-if; reset brings back exactly the baseline figures', async () => {
    await renderPage(<SkillsOutlookPage />, { persona: 'chco', path: '/workforce/skills-outlook' });
    const tiles = await screen.findByTestId('m07-so-tiles', {}, T);
    await waitFor(() => expect(tiles.className).not.toMatch(/opacity-70/), T);
    const before = tiles.textContent;
    const slider = within(screen.getByTestId('m07-so-param-attrition_pct')).getByRole('slider');
    fireEvent.change(slider, { target: { value: '10' } });
    expect(screen.getByTestId('m07-so-controls').closest('.card')!.textContent).toMatch(/What-if/);
    await waitFor(() => expect(screen.getByTestId('m07-so-tiles').textContent).not.toBe(before), T);
    fireEvent.click(screen.getByTestId('m07-so-reset'));
    await waitFor(() => expect(screen.getByTestId('m07-so-tiles').textContent).toBe(before), T);
    expect(screen.getByTestId('m07-so-controls').closest('.card')!.textContent).toMatch(/Baseline/);
  });
  it('A4: the release text is checked with publicTextIsClean before the HR director can release; the release goes through a confirmation', async () => {
    await renderPage(<SkillsOutlookPage />, { persona: 'chco', path: '/workforce/skills-outlook' });
    fireEvent.click(await screen.findByTestId('m07-so-release-so-two-units-2032', {}, T));
    const next = await screen.findByTestId('m07-so-release-next');
    const [enBox, arBox] = screen.getAllByRole('textbox').slice(-2);
    fireEvent.change(enBox, { target: { value: 'We will need 120 operators more by 2032.' } });
    fireEvent.change(arBox, { target: { value: 'تظهر فجوات في العمليات بنهاية العقد.' } });
    expect(screen.getByTestId('m07-so-clean').textContent).toMatch(/Headcount or site wording/);
    expect((next as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(enBox, { target: { value: 'Shortfalls open in operations and safety once two more units come online.' } });
    expect(screen.getByTestId('m07-so-clean').textContent).toMatch(/clean/);
    fireEvent.click(next);
    fireEvent.click(await screen.findByTestId('confirm-action'));
    const released = await screen.findByTestId('m07-so-released', {}, T);
    await waitFor(() => expect(released.textContent).toMatch(/Two more APR-1400 units/), T);
  });
  it('the HR analyst saves an outlook (marked SIMULATED) and sees no release control', async () => {
    await renderPage(<SkillsOutlookPage />, { persona: 'k-hr-analyst', path: '/workforce/skills-outlook' });
    await screen.findByTestId('m07-so-tiles', {}, T);
    expect(screen.queryByTestId('m07-so-release-so-two-units-2032')).toBeNull();
    await waitFor(() => expect((screen.getByTestId('m07-so-save') as HTMLButtonElement).disabled).toBe(false), T);
    fireEvent.click(screen.getByTestId('m07-so-save'));
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Page test outlook' } });
    fireEvent.click(screen.getByTestId('m07-so-save-confirm'));
    const saved = screen.getByTestId('m07-so-saved');
    await waitFor(() => expect(saved.textContent).toMatch(/Page test outlook \(SIMULATED\)/), T);
  });
  it('a line manager sees only released outlooks (no live workbench); an auditor sees the workbench without save', async () => {
    await renderPage(<SkillsOutlookPage />, { persona: 'sro', path: '/workforce/skills-outlook' });
    const rel = await screen.findByTestId('m07-so-released', {}, T);
    expect(rel.textContent).toMatch(/Baseline skills outlook to 2035/);
    expect(screen.queryByTestId('m07-so-controls')).toBeNull();
    expect(screen.queryByTestId('m07-so-open-so-baseline-2035')).toBeNull();
    await renderPage(<SkillsOutlookPage />, { persona: 'k-auditor', path: '/workforce/skills-outlook' });
    await screen.findByTestId('m07-so-tiles', {}, T);
    expect(screen.queryByTestId('m07-so-save')).toBeNull();
  });
  it('renders in Arabic with Arabic labels and the suppressed marker', async () => {
    await renderPage(<SkillsOutlookPage />, { persona: 'chco', path: '/ar/workforce/skills-outlook' });
    const tiles = await screen.findByTestId('m07-so-tiles', {}, T);
    expect(tiles.textContent).toMatch(/[؀-ۿ]/);
    expect(screen.getAllByTestId('m07-so-suppressed')[0].textContent).toBe('محجوب');
  });
  it('the workforce overview links to the outlook and the definitions panel defines every outlook figure', async () => {
    await renderPage(<WorkforcePage />, { persona: 'chco', path: '/workforce' });
    await waitFor(() => expect(screen.getAllByRole('link').some((a) => a.getAttribute('href') === '/workforce/skills-outlook')).toBe(true), T);
    await renderPage(<WorkforceDefinitionsPage />, { persona: 'chco', path: '/workforce/definitions' });
    const defs = await screen.findByTestId('m07-definitions', {}, T);
    for (const k of ['outlook_supply', 'outlook_demand', 'outlook_gap', 'outlook_tornado']) expect(defs.querySelector(`#${k}`)).toBeTruthy();
  });
});
