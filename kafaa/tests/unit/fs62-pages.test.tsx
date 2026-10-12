// @vitest-environment jsdom
/** FS wave F · E2 pages: FS52 automation in the skills outlook and FS53 market statistics on the workforce dashboards, rendered with the real
 *  providers and the in-memory LocalBackend. FS52 A3 (the automation bar in the tornado with its range) and the adoption slider; FS53 A1
 *  (source link and as-of date on every drawn value), A3 (label and line pattern, not only colour) and the held list without values;
 *  the line-manager overview and the Arabic page; BenchmarkChips FS52/FS53 on both features. */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import SkillsOutlookPage from '../../src/modules/m07/SkillsOutlookPage';
import WorkforcePage from '../../src/modules/m07/WorkforcePage';

const T = { timeout: 30000 };

describe('FS52 + FS53 pages', { timeout: 120000 }, () => {
  it('FS52 A3: the tornado shows the AI and automation assumption with its 0-60 % range at adoption 0; the automation card ranks families with WhyThis', async () => {
    await renderPage(<SkillsOutlookPage />, { persona: 'chco', path: '/workforce/skills-outlook' });
    const tor = await screen.findByTestId('m07-so-tornado', {}, T);
    const bar = await within(tor).findByTestId('m07-so-tornado-automation_adoption', {}, T);
    expect(bar.textContent).toMatch(/AI and automation adoption/);
    expect(bar.textContent).toMatch(/0%/);
    expect(bar.textContent).toMatch(/60%/);
    const card = await screen.findByTestId('m07-au-card', {}, T);
    expect(card.closest('.card')!.textContent).toMatch(/Simulated|SIMULATED/i);
    expect(within(card.closest('.card') as HTMLElement).getByRole('link', { name: /Definition/i }).getAttribute('href')).toBe('/workforce/definitions#outlook_automation');
    expect(within(card).getByTestId('benchmark-chips').textContent).toMatch(/OECD|SkillsFuture|IEA|Energy/i);
    const fams = within(card).getByTestId('m07-au-families');
    expect(within(fams).getAllByRole('listitem').length).toBe(12);
    expect(within(fams).getByTestId('m07-au-family-project').textContent).toMatch(/Suppressed/);
    fireEvent.click(within(fams).getByTestId('m07-au-why-operations'));
    expect((await screen.findByTestId('m07-au-why-operations-panel')).textContent).toMatch(/rated tasks need this family/);
  });

  it('FS52: moving the adoption slider (or a preset) narrows the outlook and adds the automation driver; reset brings back the baseline', async () => {
    await renderPage(<SkillsOutlookPage />, { persona: 'k-hr-analyst', path: '/workforce/skills-outlook' });
    const tiles = await screen.findByTestId('m07-so-tiles', {}, T);
    await waitFor(() => expect(tiles.className).not.toMatch(/opacity-70/), T);
    const before = tiles.textContent;
    fireEvent.click(screen.getByTestId('m07-au-preset-50'));
    expect(within(screen.getByTestId('m07-so-param-automation_adoption')).getByRole('slider')).toHaveProperty('value', '50');
    await waitFor(() => expect(screen.getByTestId('m07-so-tiles').textContent).not.toBe(before), T);
    expect(screen.getByTestId('m07-so-controls').closest('.card')!.textContent).toMatch(/What-if/);
    await waitFor(() => expect(screen.getByTestId('m07-so-drivers').textContent).toMatch(/AI and automation/), T);
    await waitFor(() => expect(screen.getByTestId('m07-so-trend-auto').textContent).toMatch(/50%/), T);
    fireEvent.click(screen.getByTestId('m07-so-reset'));
    await waitFor(() => expect(screen.getByTestId('m07-so-tiles').textContent).toBe(before), T);
  });

  it('FS53 A1 + A3: market lines carry source, as-of date and a dashed pattern labelled "Market statistic"; measured values are solid and SIMULATED; held figures show no value', async () => {
    await renderPage(<SkillsOutlookPage />, { persona: 'chco', path: '/workforce/skills-outlook' });
    await screen.findByTestId('m07-mk-panel-skills_outlook', {}, T);
    const P = () => screen.getByTestId('m07-mk-panel-skills_outlook'); // re-read: the workbench re-renders while the profile loads
    await waitFor(() => expect(within(P()).getAllByTestId(/m07-mk-pair-/).length).toBe(3), T);
    await waitFor(() => expect(P().querySelectorAll('[data-kind="measured"][data-pattern="solid"]').length).toBe(3), T); // the FS06 share arrives with the automation profile
    const panel = P();
    for (const pair of within(panel).getAllByTestId(/m07-mk-pair-/)) {
      const market = pair.querySelector('[data-kind="market"][data-pattern="dashed"]');
      const measured = pair.querySelector('[data-kind="measured"][data-pattern="solid"]');
      expect(market && measured).toBeTruthy();
      expect(pair.textContent).toMatch(/Market statistic/);
      expect(pair.textContent).toMatch(/Measured at ENEC \(SIMULATED\)/);
      const link = within(pair).getAllByRole('link').find((a) => /^https:\/\//.test(a.getAttribute('href') ?? ''))!;
      expect(link.textContent).toMatch(/as of/);
      expect(within(pair).getByTestId('m07-mk-position').textContent).toMatch(/ENEC (above|below|level)/);
    }
    expect(within(panel).getByTestId('m07-mk-pair-ai_task_share').textContent).toMatch(/24%/);
    const ctx = within(panel).getByTestId('m07-mk-context-new_nuclear_jobs_2030');
    expect(ctx.getAttribute('data-pattern')).toBe('dashed');
    expect(ctx.textContent).toMatch(/40,000/);
    const legend = within(panel).getByTestId('m07-mk-legend');
    expect(legend.querySelector('[data-pattern="solid"]')!.textContent).toMatch(/Measured at ENEC/);
    expect(legend.querySelector('[data-pattern="dashed"]')!.textContent).toMatch(/Market statistic/);
    const held = within(panel).getByTestId('m07-mk-held');
    expect(held.textContent).toMatch(/Held back until verified \(6\)/);
    expect(held.textContent).toMatch(/secondary/);
    expect(held.textContent).not.toMatch(/39%|60%|76,000,000|10,000,000|100,000|40,000/);
    expect(within(panel).getByTestId('benchmark-chips')).toBeTruthy();
  });

  it('FS53 on the workforce overview for a line manager: three market lines beside the latest released outlook; the FS06 task share stays with HR', async () => {
    await renderPage(<WorkforcePage />, { persona: 'sro', path: '/workforce' });
    const panel = await screen.findByTestId('m07-mk-panel-overview', {}, T);
    await waitFor(() => expect(within(panel).getAllByTestId(/m07-mk-pair-/).length).toBe(3), T);
    await waitFor(() => expect(within(panel).getByTestId('m07-mk-pair-demand_growth_2030').textContent).toMatch(/Baseline skills outlook to 2035/), T);
    const ai = within(panel).getByTestId('m07-mk-pair-ai_task_share');
    expect(ai.textContent).toMatch(/Suppressed/);
    expect(ai.textContent).toMatch(/shown to HR and auditors/);
    expect(within(ai).getByTestId('m07-mk-position').textContent).toMatch(/suppressed/);
    expect(within(panel).queryByTestId(/m07-mk-context-/)).toBeNull();
  });

  it('a line manager also sees the market panel on the outlook page, without the live workbench', async () => {
    await renderPage(<SkillsOutlookPage />, { persona: 'sro', path: '/workforce/skills-outlook' });
    await screen.findByTestId('m07-mk-panel-skills_outlook', {}, T);
    expect(screen.queryByTestId('m07-au-card')).toBeNull();
    expect(screen.queryByTestId('m07-so-param-automation_adoption')).toBeNull();
  });

  it('renders in Arabic: automation card and market labels in Arabic', async () => {
    await renderPage(<SkillsOutlookPage />, { persona: 'chco', path: '/ar/workforce/skills-outlook' });
    const card = await screen.findByTestId('m07-au-card', {}, T);
    expect(card.closest('.card')!.textContent).toMatch(/الاصطناعي والأتمتة/);
    const panel = await screen.findByTestId('m07-mk-panel-skills_outlook', {}, T);
    await waitFor(() => expect(panel.textContent).toMatch(/إحصاء السوق/), T);
    expect(panel.textContent).toMatch(/مقيس في المؤسسة \(محاكاة\)/);
  });
});
