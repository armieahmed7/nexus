// @vitest-environment jsdom
/** [G3] Component tests (testing-library) for key M06/M07/M10 screens on the LocalBackend, in English and Arabic. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createElement as h, type ComponentType } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nProvider } from '../../src/i18n';
import { ToastProvider } from '../../src/ui/Toast';
import { SessionProvider, resetLocalDemo } from '../../src/auth/session';
import { config } from '../../src/config';
import PathwaysPage from '../../src/modules/m06/PathwaysPage';
import PathwaysProgrammePage from '../../src/modules/m06/PathwaysProgrammePage';
import WorkforceEmiratizationPage from '../../src/modules/m07/WorkforceEmiratizationPage';
import ObserverPage from '../../src/modules/m07/ObserverPage';
import PartnerUniversityPage from '../../src/modules/m10/PartnerUniversityPage';
import WorkforceApplicationsPage from '../../src/modules/m06/WorkforceApplicationsPage';

function mount(Page: ComponentType, url: string, pattern: string, persona: string | null = null) {
  localStorage.clear();
  if (persona) localStorage.setItem(config.sessionKey, JSON.stringify({ persona, at: Date.now() }));
  return render(
    h(MemoryRouter, { initialEntries: [url] },
      h(I18nProvider, null,
        h(ToastProvider, null,
          h(SessionProvider, null,
            h(Routes, null, h(Route, { path: pattern, element: h(Page) }), h(Route, { path: `/ar${pattern}`, element: h(Page) })))))),
  );
}

beforeEach(async () => {
  await resetLocalDemo();
});
afterEach(() => cleanup());

describe('M06 pathways', () => {
  it('a school leaver reaches the DNT page from /pathways in one more step; the card states eligibility, duration and a source', async () => {
    mount(PathwaysPage, '/pathways', '/pathways');
    const link = await screen.findByTestId('m06-programme-dnt', {}, { timeout: 5000 });
    expect(link.getAttribute('href')).toBe('/pathways/dnt');
    const card = link.closest('article')!;
    expect(within(card).getAllByText('UAE nationals only').length).toBeGreaterThan(0);
    expect(within(card).getByText('24 months')).toBeTruthy();
    expect(within(card).getByText('UAE high-school graduates')).toBeTruthy();
    expect(card.querySelector('a[href^="https://www.enec.ae"]')).toBeTruthy();
  });
  it('the stage finder narrows programmes and keeps the Arabic prefix on links', async () => {
    mount(PathwaysPage, '/ar/pathways?stage=finishing_school', '/pathways');
    const link = await screen.findByTestId('m06-programme-dnt', {}, { timeout: 5000 });
    expect(link.getAttribute('href')).toBe('/ar/pathways/dnt');
    expect(screen.queryByTestId('m06-programme-gdp')).toBeNull();
  });
  it('the eligibility check explains criteria and never decides', async () => {
    mount(PathwaysProgrammePage, '/pathways/dnt', '/pathways/:programme');
    const box = await screen.findByTestId('m06-eligibility', {}, { timeout: 5000 });
    const radios = within(box).getAllByRole('radio');
    // first question "No", second "Yes"
    fireEvent.click(radios[1]);
    fireEvent.click(radios[3]);
    const result = await screen.findByTestId('m06-eligibility-result');
    expect(result.textContent).toMatch(/may not meet/);
    expect(result.textContent).toMatch(/not a decision/);
  });
  it('the HR analyst sees the funnel with suppressed cells and no screening queue', async () => {
    mount(WorkforceApplicationsPage, '/workforce/applications', '/workforce/applications', 'k-hr-analyst');
    const funnel = await screen.findByTestId('m06-funnel', {}, { timeout: 5000 });
    expect(funnel.textContent).toMatch(/\d/);
    expect(screen.queryByRole('tab', { name: 'Screening queue' })).toBeNull();
  });
});

describe('M07 workforce', () => {
  it('filtering Emiratization to a group of 7 people shows "suppressed" rather than values', async () => {
    mount(WorkforceEmiratizationPage, '/workforce/emiratization?dim=family&group=safeguards', '/workforce/emiratization', 'k-hr-analyst');
    const tile = await screen.findByTestId('m07-single-group', {}, { timeout: 5000 });
    await waitFor(() => expect(tile.textContent).toMatch(/Suppressed/));
    expect(tile.textContent).not.toMatch(/%/);
    expect(tile.querySelector('a[href="/workforce/definitions#share_emirati"]')).toBeTruthy();
  });
  it('an observer sees only the report released to its organisation', async () => {
    mount(ObserverPage, '/observer', '/observer', 'k-observer');
    const list = await screen.findByTestId('m07-observer-reports', {}, { timeout: 5000 });
    expect(list.textContent).toMatch(/Workforce and training indicators, H1 2026/);
    expect(list.textContent).not.toMatch(/bench depth, Q3 2026/);
  });
});

describe('M10 university workspace', () => {
  it('lists only consenting scholars', async () => {
    mount(PartnerUniversityPage, '/partner/university', '/partner/university', 'k-university');
    fireEvent.click(await screen.findByRole('tab', { name: 'Scholars' }, { timeout: 5000 }));
    const table = await screen.findByTestId('m10-scholars', {}, { timeout: 5000 });
    expect(table.textContent).toMatch(/sc-2/);
    expect(table.textContent).not.toMatch(/sc-3/);
    expect(table.textContent).not.toMatch(/sc-6/);
  });
});
