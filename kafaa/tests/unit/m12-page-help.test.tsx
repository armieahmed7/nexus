// @vitest-environment jsdom
/**
 * "Help with this page" (KB-01) and the single glossary (KB-10):
 *  - the route → guides index is derived from the guides' own links: every mapped route id exists, every guide link is
 *    mapped, links with params only match that page, at most three guides per page, the help centre itself is skipped;
 *  - the shell row renders the guides for a public and a signed-in page in English and Arabic, and nothing elsewhere;
 *  - the FAQ no longer lists glossary terms: it links to /help/glossary and its old #glossary anchor redirects there;
 *  - Dalil indexes each glossary term once, citing /help/glossary.
 */
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { GUIDES } from '../../src/modules/m12/help/content';
import { GLOSSARY } from '../../src/modules/m12/help/glossary';
import { GUIDES_BY_ROUTE, PAGE_HELP_MAX, PAGE_HELP_SKIP, guidesForPage } from '../../src/modules/m12/help/pageHelp';
import { isReplacedDbTerm, termHref } from '../../src/modules/m12/help/search';
import { PageHelp } from '../../src/shell/PageHelp';
import FaqPage from '../../src/modules/m12/FaqPage';
import { ROUTE_BY_ID } from '../../src/routes/registry';
import { foldText } from '../../src/domain/text';
import { getLocalBackend } from '../../src/data';
import { buildCorpus } from '../../src/modules/m13/dalil/corpus';
import { renderPage } from './g1-harness';

const ids = (routeId: string, params?: Record<string, string>) => guidesForPage(routeId, params).map((g) => g.id);

describe('route → guides index', () => {
  it('maps only registered routes, and every route a guide links to (except the help centre itself)', () => {
    expect(GUIDES_BY_ROUTE.size).toBeGreaterThan(40);
    for (const id of GUIDES_BY_ROUTE.keys()) {
      expect(ROUTE_BY_ID[id], `unknown route ${id}`).toBeTruthy();
      expect(PAGE_HELP_SKIP.has(id)).toBe(false);
    }
    for (const g of GUIDES)
      for (const l of g.links) {
        if (PAGE_HELP_SKIP.has(l.route)) continue;
        expect(GUIDES_BY_ROUTE.get(l.route)?.some((m) => m.guide.id === g.id), `${g.id} → ${l.route}`).toBe(true);
      }
    for (const id of PAGE_HELP_SKIP) expect(ROUTE_BY_ID[id], id).toBeTruthy();
  });

  it('puts the guide mainly about a page first, caps the list, and never repeats a guide', () => {
    expect(ids('skills')[0]).toBe('reading-a-skill');
    expect(ids('my-skills')).toEqual(['evidence-and-validation', 'skills-passport', 'start-employees']);
    expect(ids('verify')).toEqual(['verify-a-credential']);
    expect(ids('learn-ai-fluency')).toContain('ai-fluency-ladder');
    expect(ids('ask')).toContain('using-dalil');
    for (const id of GUIDES_BY_ROUTE.keys()) {
      const list = ids(id);
      expect(list.length).toBeLessThanOrEqual(PAGE_HELP_MAX);
      expect(new Set(list).size).toBe(list.length);
    }
  });

  it('matches links with params only on that page, and gives nothing for pages no guide covers', () => {
    expect(ids('legal', { page: 'privacy' })).toEqual(['privacy-and-speak-up']);
    expect(ids('legal', { page: 'accessibility' })).toEqual(['arabic-accessibility']);
    expect(ids('legal', { page: 'terms' })).toEqual(['demo-and-data']);
    expect(ids('legal', {})).toEqual([]);
    expect(ids('home')).toEqual([]);
    expect(ids('help')).toEqual([]);
    expect(ids('no-such-route')).toEqual([]);
  });
});

describe('"Help with this page" row', () => {
  it('shows the guides for a public page in English, linking to /help/<guide>', async () => {
    await renderPage(<PageHelp route={ROUTE_BY_ID.skills} />, { path: '/skills' });
    await waitFor(() => expect(screen.getByTestId('page-help')).toBeTruthy());
    const row = screen.getByTestId('page-help');
    expect(row.tagName).toBe('NAV');
    expect(row.textContent).toContain('Help with this page');
    const first = screen.getByTestId('page-help-reading-a-skill');
    expect(first.getAttribute('href')).toBe('/help/reading-a-skill');
    expect(first.textContent).toBe(GUIDES.find((g) => g.id === 'reading-a-skill')!.title.en);
    expect(row.querySelectorAll('a').length).toBeLessThanOrEqual(PAGE_HELP_MAX);
  });

  it('shows the guides for a signed-in page in Arabic, with Arabic titles and /ar links', async () => {
    await renderPage(<PageHelp route={ROUTE_BY_ID['my-skills']} />, { path: '/ar/my/skills', persona: 'nse' });
    await waitFor(() => expect(screen.getByTestId('page-help')).toBeTruthy());
    expect(screen.getByTestId('page-help').textContent).toContain('مساعدة حول هذه الصفحة');
    const a = screen.getByTestId('page-help-skills-passport');
    expect(a.getAttribute('href')).toBe('/ar/help/skills-passport');
    expect(a.textContent).toBe(GUIDES.find((g) => g.id === 'skills-passport')!.title.ar);
  });

  it('uses the page params (/legal/privacy) and renders nothing on a page no guide covers', async () => {
    await renderPage(<PageHelp route={ROUTE_BY_ID.legal} />, { path: '/legal/privacy' });
    await waitFor(() => expect(screen.getByTestId('page-help-privacy-and-speak-up')).toBeTruthy());
    expect(screen.queryByTestId('page-help-arabic-accessibility')).toBeNull();
    const { container } = await renderPage(<PageHelp route={ROUTE_BY_ID.help} />, { path: '/help' });
    await new Promise((r) => setTimeout(r, 50));
    expect(container.querySelector('[data-testid="page-help"]')).toBeNull();
  });
});

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{loc.pathname + loc.hash}</div>;
}

describe('one glossary (FAQ and Dalil)', () => {
  it('replaces the FAQ glossary with a link to /help/glossary', async () => {
    const { container } = await renderPage(<FaqPage />, { path: '/faq' });
    await waitFor(() => expect(screen.getByTestId('m12-faq-glossary')).toBeTruthy());
    expect(container.querySelector('#glossary')).toBeTruthy();
    expect(screen.getByTestId('m12-faq-glossary').querySelector('a')!.getAttribute('href')).toBe('/help/glossary');
    expect(container.querySelector('[data-testid="m12-glossary"]')).toBeNull();
    expect(container.textContent).not.toContain('Reactor Operator (RO)');
  });

  it('sends old /faq#glossary links to the help centre glossary, in Arabic too', async () => {
    await renderPage(
      <Routes>
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/ar/faq" element={<FaqPage />} />
        <Route path="*" element={<Where />} />
      </Routes>,
      { path: '/ar/faq#glossary' },
    );
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/ar/help/glossary'));
  });

  it('indexes every glossary term once in Dalil, citing its anchor on /help/glossary', async () => {
    const b = getLocalBackend();
    await b.whenReady();
    const c = await buildCorpus(b, { signedIn: false, personId: null });
    const terms = c.docs.filter((d) => d.kind === 'glossary');
    const db = await b.list('glossary');
    expect(terms.length).toBe(GLOSSARY.length + db.filter((r) => !isReplacedDbTerm(r.id)).length);
    expect(terms.some((d) => d.id === 'cd-glossary-gl-11')).toBe(false); // Emiratization: the sourced "Emiratisation" covers it
    for (const lang of ['en', 'ar'] as const) {
      const titles = terms.map((d) => foldText(d.title[lang]).replace(/s(?=ation)/g, 'z'));
      expect(new Set(titles).size, `duplicate ${lang} glossary titles`).toBe(titles.length);
    }
    for (const d of terms) {
      expect(d.cite.url.startsWith('/help/glossary#term-'), d.id).toBe(true);
      expect(d.route).toBe('/help/glossary');
      expect(JSON.stringify(d.cite)).not.toContain('/faq');
    }
    expect(terms.find((d) => d.id === 'cd-glossary-gl-1')?.cite.url).toBe(termHref('gl-1'));
  });
});
