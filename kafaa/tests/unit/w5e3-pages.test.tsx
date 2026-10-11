// @vitest-environment jsdom
/** F34 Student-to-career journey pages, rendered with the real providers and the in-memory LocalBackend.
 *  A1 two clicks from the journey to the DNT step (EN and AR, and from /pathways via the teaser); A2 the explorer stores nothing
 *  for anonymous visitors (no fetch, no RPC, no write, no browser storage); A3 every board fact shows a source link and an as-of
 *  date; A4 no score or rank is shown; plus the explorer's roles-like-this links and reasons, the readiness checklist, the saved
 *  journey for a signed-in student, the portfolio, the Arabic-first parent view and the suppressed HR insights. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { I18nProvider } from '../../src/i18n';
import { ToastProvider } from '../../src/ui/Toast';
import { SessionProvider } from '../../src/auth/session';
import { getLocalBackend } from '../../src/data';
import { config } from '../../src/config';
import { renderPage } from './g1-harness';
import JourneyPage from '../../src/modules/m06/JourneyPage';
import JourneyParentsPage from '../../src/modules/m06/JourneyParentsPage';
import WorkforceJourneysPage from '../../src/modules/m06/WorkforceJourneysPage';
import PathwaysPage from '../../src/modules/m06/PathwaysPage';
import PathwaysProgrammePage from '../../src/modules/m06/PathwaysProgrammePage';
import { noScoreText, starterEligible } from '../../src/modules/m06/journey';
import seed from '../../src/seed/seed.json';

const T = { timeout: 20000 };
const FACTS = (seed as unknown as { tables: Record<string, any[]> }).tables.journey_facts;
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function Where() {
  const l = useLocation();
  return <div data-testid="where">{l.pathname}</div>;
}
/** The journey, the programme page and /pathways under real paths (EN and /ar), so clicks navigate between pages. */
async function renderApp(path: string, persona: string | null = null) {
  const b = getLocalBackend();
  await b.whenReady();
  await b.reset();
  if (persona) localStorage.setItem(config.sessionKey, JSON.stringify({ persona, at: Date.now() }));
  else localStorage.removeItem(config.sessionKey);
  const routes = (pre: string) => [
    <Route key={`${pre}j`} path={`${pre}/pathways/journey`} element={<JourneyPage />} />,
    <Route key={`${pre}p`} path={`${pre}/pathways/:programme`} element={<PathwaysProgrammePage />} />,
    <Route key={`${pre}h`} path={`${pre}/pathways`} element={<PathwaysPage />} />,
  ];
  return render(
    <MemoryRouter initialEntries={[path]}>
      <I18nProvider>
        <ToastProvider>
          <SessionProvider>
            <Where />
            <Routes>{[...routes(''), ...routes('/ar')]}</Routes>
          </SessionProvider>
        </ToastProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe('F34 journey pages', { timeout: 90000 }, () => {
  it('A1 (English): a school leaver reaches the DNT step in two clicks: "I am finishing school", then the DNT step', async () => {
    await renderApp('/pathways/journey');
    fireEvent.click(await screen.findByTestId('m06-journey-stage-finishing_school', {}, T));      // click 1
    expect((await screen.findByTestId('m06-journey-you-are-here', {}, T)).closest('[data-testid="m06-journey-station-route"]')).toBeTruthy();
    const dnt = await screen.findByTestId('m06-journey-route-dnt', {}, T);
    expect(dnt.getAttribute('data-suggested')).toBe('true');
    fireEvent.click(within(dnt).getByTestId('m06-journey-step-dnt'));                               // click 2
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/pathways/dnt'), T);
    expect(await screen.findByRole('heading', { name: /Diploma in Nuclear Technology/ }, T)).toBeTruthy();
    expect(screen.getAllByTestId('m06-apply').length).toBeGreaterThan(0);
  });
  it('A1 (Arabic): the same two clicks land on the Arabic DNT page', async () => {
    await renderApp('/ar/pathways/journey');
    fireEvent.click(await screen.findByTestId('m06-journey-stage-finishing_school', {}, T));
    fireEvent.click(within(await screen.findByTestId('m06-journey-route-dnt', {}, T)).getByTestId('m06-journey-step-dnt'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/ar/pathways/dnt'), T);
    expect(await screen.findByRole('heading', { name: /دبلوم التكنولوجيا النووية/ }, T)).toBeTruthy();
  });
  it('A1 (from the pathways page): the teaser opens the journey, whose DNT step is one more click', async () => {
    await renderApp('/pathways');
    fireEvent.click(await screen.findByTestId('m06-journey-teaser-open', {}, T));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/pathways/journey'), T);
    fireEvent.click(within(await screen.findByTestId('m06-journey-route-dnt', {}, T)).getByTestId('m06-journey-step-dnt'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/pathways/dnt'), T);
  });

  it('A2: an anonymous visitor answers all 10 questions, ticks the checklist and picks a route: no fetch, no RPC, no write, nothing in browser storage', async () => {
    await renderApp('/pathways/journey');
    await screen.findByTestId('m06-journey-explorer', {}, T);
    const b = getLocalBackend();
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as never);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const rpcSpies = Object.keys(b.rpc).filter((k) => typeof (b.rpc as any)[k] === 'function').map((k) => vi.spyOn(b.rpc as any, k));
    const writes = [vi.spyOn(b, 'insert' as never), vi.spyOn(b, 'update' as never), vi.spyOn(b, 'rawInsert' as never), vi.spyOn(b, 'rawUpdate' as never)];
    const audit0 = b.raw('audit_events').length;
    const rows0 = b.raw('student_journeys').length;
    for (const q of ['q01', 'q02', 'q03', 'q04', 'q05', 'q06', 'q07', 'q08', 'q09', 'q10']) fireEvent.click(screen.getByTestId(`m06-journey-q-${q}-a`));
    expect((await screen.findAllByTestId('m06-journey-match', {}, T)).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId('m06-journey-choose-dnt'));
    fireEvent.click(await screen.findByTestId('m06-journey-prep-dnt-finish_g12', {}, T));
    fireEvent.click(screen.getByTestId('m06-journey-elig-dnt-0-yes'));
    expect(screen.queryByTestId('m06-journey-save')).toBeNull();
    expect(screen.getByTestId('m06-journey-signin')).toBeTruthy();
    expect(screen.getByText(/Nothing on this page is stored or sent/)).toBeTruthy();
    await new Promise((r) => setTimeout(r, 300));
    expect(fetchSpy).not.toHaveBeenCalled();
    for (const s of rpcSpies) expect(s).not.toHaveBeenCalled();
    for (const w of writes) expect(w).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(b.raw('audit_events').length).toBe(audit0);
    expect(b.raw('student_journeys').length).toBe(rows0);
  });

  it('A3: every fact on the board shows a source link and an as-of date (all seeded facts, both languages)', async () => {
    for (const path of ['/pathways/journey', '/ar/pathways/journey']) {
      await renderApp(path);
      const board = await screen.findByTestId('m06-journey-board', {}, T);
      await waitFor(() => expect(within(board).getAllByTestId('m06-journey-fact').length).toBe(FACTS.length), T);
      for (const li of within(board).getAllByTestId('m06-journey-fact')) {
        const a = li.querySelector('a');
        expect(a?.getAttribute('href')).toMatch(/^https:\/\//);
        expect(li.textContent).toMatch(path.startsWith('/ar') ? /حتى/ : /as of/);
      }
      const dnt = within(screen.getByTestId('m06-journey-route-dnt'));
      expect(dnt.getAllByTestId('m06-journey-fact').map((x) => x.textContent).join(' ')).toMatch(path.startsWith('/ar') ? /24 شهراً.*20 طالباً/s : /24 months.*cohort of 20 graduated on 17 June 2026/s);
      cleanup();
    }
  });

  it('A4: after answering, the explorer shows families with reasons and roles-like-this links, but no score, rank or percentage (EN and AR)', async () => {
    for (const path of ['/pathways/journey', '/ar/pathways/journey']) {
      await renderApp(path);
      await screen.findByTestId('m06-journey-explorer', {}, T);
      for (const [q, o] of [['q01', 'a'], ['q02', 'b'], ['q03', 'a'], ['q04', 'a'], ['q05', 'a'], ['q06', 'a'], ['q07', 'a'], ['q08', 'c'], ['q09', 'a'], ['q10', 'a']]) fireEvent.click(screen.getByTestId(`m06-journey-q-${q}-${o}`));
      const matches = await screen.findAllByTestId('m06-journey-match', {}, T);
      expect(matches[0].getAttribute('data-family')).toBe('operations');
      const links = within(matches[0]).getAllByTestId('m06-journey-role-link');
      expect(links.some((a) => a.getAttribute('href')?.endsWith('/careers/roles/local-operator'))).toBe(true);
      fireEvent.click(within(matches[0]).getByTestId('m06-journey-why'));
      expect((await screen.findByTestId('m06-journey-why-panel')).textContent).toMatch(path.startsWith('/ar') ? /اخترت/ : /You chose/);
      const text = document.body.textContent ?? '';
      expect(noScoreText(text)).toBe(true);
      expect(within(screen.getByTestId('m06-journey-matches')).queryByText(/\d/)).toBeNull();
      cleanup();
    }
  });

  it('a signed-in student gets their saved journey back, saves changes through the RPC and sees the portfolio (not a FANR certification)', async () => {
    await renderApp('/pathways/journey', 'k-student');
    await waitFor(() => expect(screen.getByTestId('m06-journey-route-dnt').textContent).toMatch(/Your route/), T);
    expect(screen.getByTestId('m06-journey-stage-finishing_school').getAttribute('aria-checked')).toBe('true');
    expect((screen.getByTestId('m06-journey-prep-dnt-finish_g12') as HTMLInputElement).checked).toBe(true);
    expect(screen.getByTestId('m06-journey-next-dnt').textContent).toMatch(/high-school certificate/);
    const portfolio = await screen.findByTestId('m06-journey-portfolio', {}, T);
    expect(within(portfolio).getByTestId('m06-journey-portfolio-pending')).toBeTruthy();
    expect(within(portfolio).getAllByTestId('m06-journey-portfolio-item').length).toBeGreaterThanOrEqual(2);
    expect(portfolio.textContent).toMatch(/not a FANR certification/);
    fireEvent.click(screen.getByTestId('m06-journey-prep-dnt-certificate'));
    fireEvent.click(screen.getByTestId('m06-journey-save'));
    await waitFor(() => {
      const row = getLocalBackend().rawGet('student_journeys', 'sj-p-k-student') as any;
      expect(row.milestones.checklist['prep:dnt:certificate']).toBe('done');
    }, T);
    expect(await screen.findByText(/Journey saved/, {}, T)).toBeTruthy();
  });

  it('the parent view is Arabic first, carries the shared choices from the link only, and every fact has a source and date', async () => {
    await renderPage(<JourneyParentsPage />, { path: '/pathways/journey/parents?stage=finishing_school&route=dnt&families=operations,maintenance,nope' });
    const arBlock = await screen.findByTestId('m06-parents-ar', {}, T);
    const enBlock = screen.getByTestId('m06-parents-en');
    expect(arBlock.compareDocumentPosition(enBlock) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(arBlock.getAttribute('dir')).toBe('rtl');
    const sum = within(arBlock).getByTestId('m06-parents-summary-ar').textContent ?? '';
    expect(sum).toMatch(/العمليات/);
    expect(sum).toMatch(/دبلوم التكنولوجيا النووية/);
    expect(sum).not.toMatch(/nope/);
    await waitFor(() => expect(within(arBlock).getAllByTestId('m06-journey-fact').length).toBeGreaterThan(5), T);
    for (const li of within(arBlock).getAllByTestId('m06-journey-fact')) {
      expect(li.querySelector('a')?.getAttribute('href')).toMatch(/^https:\/\//);
      expect(li.getAttribute('lang')).toBe('ar');
    }
    expect(noScoreText(document.body.textContent ?? '')).toBe(true);
  });
  it('in Arabic the parent view shows only the Arabic block', async () => {
    await renderPage(<JourneyParentsPage />, { path: '/ar/pathways/journey/parents' });
    await screen.findByTestId('m06-parents-ar', {}, T);
    expect(screen.queryByTestId('m06-parents-en')).toBeNull();
  });

  it('HR insights: counts only, cells under 10 read "suppressed"; the HR director issues the waiting starter credentials behind a confirmation', async () => {
    await renderPage(<WorkforceJourneysPage />, { persona: 'chco', path: '/workforce/journeys' });
    const tiles = await screen.findByTestId('m06-ji-tiles', {}, T);
    expect(within(tiles).getByTestId('m06-ji-tile-credentials').textContent).toMatch(/Suppressed/);
    for (const id of ['m06-ji-stage', 'm06-ji-route', 'm06-ji-family']) {
      for (const td of Array.from(screen.getByTestId(id).querySelectorAll('td.num'))) {
        const v = td.textContent?.trim() ?? '';
        if (/^\d+$/.test(v)) expect(Number(v)).toBeGreaterThanOrEqual(10);
        else expect(v).toBe('Suppressed');
      }
    }
    expect(screen.getAllByTestId('m06-ji-suppressed').length).toBeGreaterThan(3);
    expect(screen.getByTestId('m06-ji-pending').textContent).toMatch(/3/);
    fireEvent.click(screen.getByTestId('m06-ji-issue'));
    fireEvent.click(await screen.findByTestId('confirm-action'));
    await waitFor(() => expect(starterEligible(getLocalBackend().raw('applications'), getLocalBackend().raw('student_portfolio'))).toEqual([]), T);
    expect(await screen.findByText(/Issued 3 starter credentials/, {}, T)).toBeTruthy();
  });
  it('HR analyst reads the insights without the issuing control; the Arabic page shows the Arabic suppressed marker', async () => {
    await renderPage(<WorkforceJourneysPage />, { persona: 'k-hr-analyst', path: '/ar/workforce/journeys' });
    await screen.findByTestId('m06-ji-tiles', {}, T);
    expect(screen.queryByTestId('m06-ji-issue')).toBeNull();
    expect(screen.getAllByTestId('m06-ji-suppressed')[0].textContent).toBe('محجوب');
  });
});
