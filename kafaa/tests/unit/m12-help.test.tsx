// @vitest-environment jsdom
/**
 * Help centre (2026-10-17): /help, /help/:guide and /help/glossary.
 *  - content: every guide and glossary term exists in English and Arabic, ids are unique, links use registered routes,
 *    sources are https with an as-of date and come from the verified source list, nothing claims Kafa'a regulates;
 *  - search: Arabic-normalised and bilingual ("مشغل" finds "مشغّل", English works on /ar);
 *  - pages: render in EN and AR, guide links resolve, glossary anchors exist (static and database terms);
 *  - wiring: public routes in the Help menu with the FAQ, header search items, Dalil corpus documents.
 */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import HelpPage from '../../src/modules/m12/HelpPage';
import HelpGuidePage from '../../src/modules/m12/HelpGuidePage';
import HelpGlossaryPage from '../../src/modules/m12/HelpGlossaryPage';
import { GUIDES, GUIDE_BY_ID, HELP_CATEGORIES, START_HERE } from '../../src/modules/m12/help/content';
import { GLOSSARY } from '../../src/modules/m12/help/glossary';
import { SRC, READ_ON } from '../../src/modules/m12/help/sources';
import { HELP_INDEX, foldText, helpSearchItems, isReplacedDbTerm, searchHelp, termHref } from '../../src/modules/m12/help/search';
import type { Bi, HelpLink, HelpSource } from '../../src/modules/m12/help/types';
import { ROUTE_BY_ID, href, routeForPath } from '../../src/routes/registry';
import { checkGuard } from '../../src/auth/guards';
import { getLocalBackend } from '../../src/data';
import { buildCorpus } from '../../src/modules/m13/dalil/corpus';
import { renderPage } from './g1-harness';

const AR = /[؀-ۿ]/;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const ANON = { status: 'anon' as const, roles: [] };
const VERIFIED = new Set(Object.values(SRC).map((s) => s.url));

function bi(label: string, v: Bi | undefined) {
  expect(v, label).toBeTruthy();
  expect(v!.en.trim().length, `${label} (en)`).toBeGreaterThan(1);
  expect(v!.ar.trim().length, `${label} (ar)`).toBeGreaterThan(1);
  expect(AR.test(v!.ar), `${label}: Arabic text expected`).toBe(true);
  expect(v!.en, `${label}: no Arabic in the English text`).not.toMatch(/[؀-ۿ]{4,}.*[؀-ۿ]{4,}.*[؀-ۿ]{4,}/);
}
function link(label: string, l: HelpLink) {
  expect(ROUTE_BY_ID[l.route], `${label}: unknown route ${l.route}`).toBeTruthy();
  const path = href(l.route, l.params ?? {});
  expect(path, `${label}: missing params for ${l.route}`).not.toMatch(/\/\/|\/$/);
  expect(routeForPath(path)?.def.id, `${label}: ${path} resolves to ${l.route}`).toBe(l.route);
}
function source(label: string, s: HelpSource) {
  expect(s.url, label).toMatch(/^https:\/\//);
  expect(VERIFIED.has(s.url), `${label}: ${s.url} is not in the verified source list`).toBe(true);
  expect(s.title.trim().length, label).toBeGreaterThan(3);
  expect(s.as_of, label).toMatch(ISO);
  expect(s.as_of <= new Date().toISOString().slice(0, 10)).toBe(true);
}

describe('help content', () => {
  it('has 14-20 guides with unique slugs in known categories, and every category has a guide', () => {
    expect(GUIDES.length).toBeGreaterThanOrEqual(14);
    expect(GUIDES.length).toBeLessThanOrEqual(20);
    expect(new Set(GUIDES.map((g) => g.id)).size).toBe(GUIDES.length);
    for (const g of GUIDES) {
      expect(g.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(g.id).not.toBe('glossary'); // /help/glossary is its own page
      expect(HELP_CATEGORIES).toContain(g.category);
      expect(g.audiences.length).toBeGreaterThan(0);
    }
    for (const c of HELP_CATEGORIES) expect(GUIDES.some((g) => g.category === c), c).toBe(true);
    for (const s of START_HERE) expect(GUIDE_BY_ID[s.guide]?.category).toBe('start');
  });

  it.each(GUIDES.map((g) => [g.id, g] as const))('guide %s is complete in English and Arabic, with valid links, related guides and sources', (_id, g) => {
    bi(`${g.id} title`, g.title);
    bi(`${g.id} summary`, g.summary);
    if (g.note) bi(`${g.id} note`, g.note);
    expect(g.steps.length).toBeGreaterThanOrEqual(3);
    g.steps.forEach((s, i) => {
      bi(`${g.id} step ${i + 1} title`, s.title);
      bi(`${g.id} step ${i + 1} body`, s.body);
    });
    expect(g.links.length).toBeGreaterThan(0);
    g.links.forEach((l) => link(g.id, l));
    for (const r of g.related) {
      expect(GUIDE_BY_ID[r], `${g.id}: related ${r}`).toBeTruthy();
      expect(r).not.toBe(g.id);
    }
    g.sources.forEach((s) => source(g.id, s));
    expect(g.reviewed).toMatch(ISO);
  });

  it('has 30-40 sourced glossary terms with unique ids, both languages and valid "where you meet it" links', async () => {
    expect(GLOSSARY.length).toBeGreaterThanOrEqual(30);
    expect(GLOSSARY.length).toBeLessThanOrEqual(40);
    expect(new Set(GLOSSARY.map((t) => t.id)).size).toBe(GLOSSARY.length);
    const b = getLocalBackend();
    await b.whenReady();
    const dbIds = new Set((await b.list('glossary')).map((r) => r.id));
    for (const t of GLOSSARY) {
      expect(t.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(dbIds.has(t.id), `${t.id} collides with a database glossary id`).toBe(false);
      bi(`${t.id} term`, t.term);
      bi(`${t.id} definition`, t.definition);
      if (t.inKafaa) bi(`${t.id} inKafaa`, t.inKafaa);
      expect(t.sources.length, `${t.id} needs a public source`).toBeGreaterThan(0);
      t.sources.forEach((s) => source(t.id, s));
      expect(t.where.length).toBeGreaterThan(0);
      t.where.forEach((l) => link(t.id, l));
      for (const r of t.replacesDb ?? []) expect(dbIds.has(r), `${t.id} replaces unknown ${r}`).toBe(true);
    }
  });

  it('reads every source on one date and never presents Kafa\'a as a regulator or certifier', () => {
    for (const s of Object.values(SRC)) expect(s.as_of).toBe(READ_ON);
    const texts = [
      ...GUIDES.flatMap((g) => [g.title, g.summary, g.note, ...g.steps.flatMap((s) => [s.title, s.body])]),
      ...GLOSSARY.flatMap((t) => [t.term, t.definition, t.inKafaa]),
    ].filter((x): x is Bi => !!x);
    for (const x of texts) {
      expect(x.en).not.toMatch(/\bKafa'a (licen[cs]es|certifies|regulates|approves|qualifies)\b/i);
      expect(x.en).not.toMatch(/\bKafa'a is (a|the) (regulator|certification body|authority)\b/i);
    }
  });
});

describe('help search', () => {
  it('folds Arabic diacritics, tatweel, hamza, ta marbuta and alef maqsura', () => {
    expect(foldText('مشغّل')).toBe(foldText('مشغل'));
    expect(foldText('أمن')).toBe(foldText('امن'));
    expect(foldText('إدارة')).toBe('اداره');
    expect(foldText('مستوى')).toBe('مستوي');
    expect(foldText('الـمهارات')).toBe('المهارات');
    expect(foldText('Skills, Passport!')).toBe('skills passport');
  });

  it('finds the same results with and without shadda, and matches both languages', () => {
    const a = searchHelp('مشغل').map((h) => h.id);
    const b = searchHelp('مشغّل').map((h) => h.id);
    expect(a.length).toBeGreaterThan(0);
    expect(a).toEqual(b);
    expect(searchHelp('passport').some((h) => h.id === 'skills-passport')).toBe(true);
    expect(searchHelp('جواز').some((h) => h.id === 'skills-passport')).toBe(true);
    expect(searchHelp('RPL').map((h) => h.id)).toContain('rpl');
    expect(searchHelp('digital twin')[0].id).toBe('digital-twin');
    expect(searchHelp('التوأم الرقمي')[0].id).toBe('digital-twin');
    expect(searchHelp('')).toEqual([]);
    expect(searchHelp('zzzz-nothing')).toEqual([]);
  });

  it('indexes every guide and term once, and term hits deep-link to their glossary anchor', () => {
    expect(HELP_INDEX.length).toBe(GUIDES.length + GLOSSARY.length);
    for (const e of HELP_INDEX) {
      if (e.kind === 'term') expect(e.to).toBe(termHref(e.id));
      else expect(e.to).toBe(`/help/${e.id}`);
      expect(routeForPath(e.to.split('#')[0])).not.toBeNull();
    }
    const items = helpSearchItems('ar');
    expect(items.find((i) => i.key === 'help-term-smr')?.to).toBe('/help/glossary#term-smr');
    expect(items.every((i) => AR.test(i.title) || /^[A-Z0-9 *()-]+$/.test(i.title) || /\(/.test(i.title))).toBe(true);
    expect(isReplacedDbTerm('gl-11')).toBe(true);
    expect(isReplacedDbTerm('gl-1')).toBe(false);
  });
});

describe('help routes and wiring', () => {
  it('registers three public routes, with the help centre, glossary and FAQ in the Help menu', () => {
    for (const id of ['help', 'help-glossary', 'help-guide']) {
      expect(ROUTE_BY_ID[id].zone).toBe('public');
      expect(checkGuard(ROUTE_BY_ID[id].guard, ANON)).toBe('ok');
    }
    expect(['help', 'help-glossary', 'faq'].map((id) => ROUTE_BY_ID[id].nav?.section)).toEqual(['help', 'help', 'help']);
    expect(routeForPath('/help/glossary')?.def.id).toBe('help-glossary');
    expect(routeForPath('/help/how-kafaa-works')?.def.id).toBe('help-guide');
  });

  it('adds the guides and future-skills terms to Dalil\'s corpus, citing the help pages', async () => {
    const b = getLocalBackend();
    await b.whenReady();
    const c = await buildCorpus(b, { signedIn: false, personId: null });
    const guides = c.docs.filter((d) => d.id.startsWith('cd-guide-'));
    const terms = c.docs.filter((d) => d.id.startsWith('cd-term-'));
    expect(guides.length).toBe(GUIDES.length);
    expect(terms.length).toBe(GLOSSARY.length);
    expect(guides.every((d) => d.cite.url.startsWith('/help/') && d.modes.includes('public'))).toBe(true);
    expect(terms.find((d) => d.id === 'cd-term-smr')?.cite.url).toBe('/help/glossary#term-smr');
  });
});

describe('help pages', () => {
  it('renders the help centre in English: start here, categories, A-Z, and search-as-you-type', async () => {
    const { container } = await renderPage(<HelpPage />, { path: '/help' });
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Help centre'));
    expect(screen.getByTestId('m12-help-start').querySelectorAll('li').length).toBe(4);
    for (const c of HELP_CATEGORIES.filter((x) => x !== 'start')) expect(screen.getByTestId(`m12-help-cat-${c}`)).toBeTruthy();
    await waitFor(() => expect(container.querySelector('[data-testid="m12-help-az"] a[href="/help/glossary#term-gl-1"]')).toBeTruthy());
    expect(container.querySelector('a[href="/help/glossary#term-smr"]')).toBeTruthy();
    fireEvent.change(screen.getByTestId('m12-help-q'), { target: { value: 'مشغل' } });
    await waitFor(() => expect(screen.getByTestId('m12-help-results')).toBeTruthy());
    const hits = Array.from(screen.getByTestId('m12-help-results').querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hits).toContain('/help/glossary#term-gl-1'); // Reactor Operator (RO) · مشغّل المفاعل, from the database glossary
    fireEvent.change(screen.getByTestId('m12-help-q'), { target: { value: 'zzzz' } });
    await waitFor(() => expect(screen.getByTestId('m12-help-none')).toBeTruthy());
  });

  it('renders the help centre in Arabic with Arabic-prefixed links and finds English terms too', async () => {
    const { container } = await renderPage(<HelpPage />, { path: '/ar/help' });
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('مركز المساعدة'));
    expect(container.querySelector('a[href="/ar/help/start-students"]')).toBeTruthy();
    fireEvent.change(screen.getByTestId('m12-help-q'), { target: { value: 'passport' } });
    await waitFor(() => expect(container.querySelector('[data-testid="m12-help-results"] a[href="/ar/help/skills-passport"]')).toBeTruthy());
  });

  it.each([['/help/how-kafaa-works', '/help/:guide', 'en'], ['/ar/help/recognition-and-credits', '/ar/help/:guide', 'ar']] as const)('renders guide %s with steps, links that resolve, sources and the review date', async (path, route, lang) => {
    const id = path.split('/').pop()!;
    const g = GUIDE_BY_ID[id];
    const { container } = await renderPage(<HelpGuidePage />, { path, route });
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(g.title[lang]));
    expect(screen.getByTestId('m12-help-steps').querySelectorAll('h3').length).toBe(g.steps.length);
    const links = Array.from(screen.getByTestId('m12-help-links').querySelectorAll('a')).map((a) => a.getAttribute('href')!);
    expect(links.length).toBe(g.links.length);
    for (const l of links) {
      const target = decodeURIComponent(l.replace(/^\/ar/, '').replace(/^\/sign-in\?next=/, '')).split('#')[0] || '/';
      expect(routeForPath(target), l).not.toBeNull();
      if (lang === 'ar') expect(l.startsWith('/ar/')).toBe(true);
    }
    expect(screen.getByTestId('m12-help-reviewed').textContent).toMatch(lang === 'ar' ? /آخر مراجعة/ : /Last reviewed/);
    expect(screen.getByTestId('m12-help-print')).toBeTruthy();
    if (g.sources.length) expect(screen.getByTestId('m12-help-sources').querySelectorAll('a[href^="https://"]').length).toBe(g.sources.length);
    expect(container.textContent).not.toMatch(/m12\.help\./); // no raw keys
  });

  it('sends signed-out visitors to sign in for staff pages, and opens them directly when signed in', async () => {
    await renderPage(<HelpGuidePage />, { path: '/help/start-employees', route: '/help/:guide' });
    await waitFor(() => expect(screen.getByTestId('help-go-my-skills')).toBeTruthy());
    expect(screen.getByTestId('help-go-my-skills').getAttribute('href')).toBe(`/sign-in?next=${encodeURIComponent('/my/skills')}`);
    await renderPage(<HelpGuidePage />, { path: '/help/start-employees', route: '/help/:guide', persona: 'nse' });
    await waitFor(() => expect(screen.getAllByTestId('help-go-my-skills').at(-1)!.getAttribute('href')).toBe('/my/skills'));
  });

  it('shows a not-found state for an unknown guide', async () => {
    await renderPage(<HelpGuidePage />, { path: '/help/nope', route: '/help/:guide' });
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Guide not found'));
  });

  it('renders the glossary with an anchor for every term (static and database), the replaced row hidden, and highlights the deep-linked term', async () => {
    const { container } = await renderPage(<HelpGlossaryPage />, { path: '/help/glossary#term-smr' });
    await waitFor(() => expect(container.querySelector('#term-gl-1')).toBeTruthy());
    for (const t of GLOSSARY) expect(container.querySelector(`#term-${t.id}`), t.id).toBeTruthy();
    expect(container.querySelector('#term-gl-11')).toBeNull(); // Emiratization: replaced by the sourced "Emiratisation"
    expect(container.querySelector('#term-smr')!.className).toContain('ring-2');
    expect(container.querySelector('#term-smr a[href^="https://world-nuclear.org/"]')).toBeTruthy();
    fireEvent.change(screen.getByTestId('m12-gl-q'), { target: { value: 'التوأم' } });
    await waitFor(() => expect(container.querySelector('#term-smr')).toBeNull());
    expect(container.querySelector('#term-digital-twin')).toBeTruthy();
  });

  it('renders the glossary in Arabic, sorted by the Arabic term', async () => {
    const { container } = await renderPage(<HelpGlossaryPage />, { path: '/ar/help/glossary' });
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('مسرد مهارات المستقبل'));
    await waitFor(() => expect(container.querySelector('#term-gl-1')).toBeTruthy());
    const firstLetter = container.querySelector('[data-testid="m12-glossary-list"] h2')!.textContent!;
    expect(AR.test(firstLetter)).toBe(true);
    expect(container.querySelector('#term-smr a[href="/ar/careers/next-gen"]')).toBeTruthy();
  });
});
