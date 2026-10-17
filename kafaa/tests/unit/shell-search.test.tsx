// @vitest-environment jsdom
/**
 * Header search (2026-10-17): Arabic-aware, bilingual, grouped and accessible.
 *  - engine: Arabic folding ("مشغل" = "مشغّل", "امن" = "أمن"), English and Arabic indexed together, AND matching across
 *    words in any order ("operator reactor"), prefix matching while typing, field-weighted ranking, groups capped with counts;
 *  - sources: skills, frameworks, FAQ, news, benchmarks, help and the catalogue; nothing the viewer cannot open;
 *  - component: combobox pattern, Up/Down/Home/End/Enter, live count, Enter navigates and the dialog closes (and stays
 *    closed), the dialog closes on any navigation, focus returns to the trigger, zero-result suggestions.
 */
import { useRef, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { foldText } from '../../src/domain/text';
import { translate } from '../../src/i18n';
import { getLocalBackend } from '../../src/data';
import { ROUTE_BY_ID } from '../../src/routes/registry';
import { buildIndex, matchWord, rank, searchGrouped, type SearchItem } from '../../src/shell/search/engine';
import { canOpen, dataItems, loadSearchSources, pageItems } from '../../src/shell/search/sources';
import { GlobalSearch } from '../../src/shell/GlobalSearch';
import { renderPage } from './g1-harness';

const ANON = { status: 'anon' as const, roles: [] };
const STAFF = { status: 'signed_in' as const, roles: ['employee', 'licensed_operator'] as never[] };
const tr = (l: 'en' | 'ar', k: string) => translate(l, k);

async function fullIndex(s: typeof ANON | typeof STAFF = ANON) {
  const b = getLocalBackend();
  await b.whenReady();
  const src = await loadSearchSources(b);
  const items = [...pageItems(s, tr), ...dataItems(src, s)];
  return { items, index: buildIndex(items), src };
}

describe('folding', () => {
  it('folds Arabic diacritics, hamza forms, ta marbuta, alef maqsura, tatweel, case and Latin accents', () => {
    expect(foldText('مشغّل')).toBe('مشغل');
    expect(foldText('أمن')).toBe('امن');
    expect(foldText('إدارة')).toBe('اداره');
    expect(foldText('مستوى')).toBe('مستوي');
    expect(foldText('الـمهارات')).toBe('المهارات');
    expect(foldText('Résumé, CAFÉ!')).toBe('resume cafe');
  });
});

describe('engine', () => {
  const item = (key: string, en: string, ar: string, extra: Partial<SearchItem> = {}): SearchItem => ({ key, kind: 'role', title: { en, ar }, to: '/careers', ...extra });
  const idx = buildIndex([
    item('ro', 'Reactor Operator', 'مشغّل المفاعل', { body: ['Operates the reactor from the main control room'] }),
    item('sec', 'Security Officer', 'ضابط الأمن'),
    item('eng', 'Systems Engineer', 'مهندس أنظمة', { body: ['Works with the reactor operator on plant systems'] }),
    item('alt', 'Data steward', 'أمين البيانات', { alt: ['data owner'] }),
  ]);

  it('matches a word exactly, as a prefix, after the Arabic article, as a singular, and inside a word', () => {
    expect(matchWord('reactor', ['reactor'])).toBe(1);
    expect(matchWord('reac', ['reactor'])).toBe(0.75);
    expect(matchWord('act', ['reactor'])).toBe(0.4);
    expect(matchWord('xyz', ['reactor'])).toBe(0);
    expect(rank(idx, 'امن').map((r) => r.item.key)).toEqual(['sec']); // "الأمن" indexes "امن" too
    expect(rank(idx, 'operators').map((r) => r.item.key)[0]).toBe('ro');
  });

  it('the four queries that failed before: "مشغل" = "مشغّل", "امن" = "أمن", "operator reactor" (any word order)', () => {
    expect(rank(idx, 'مشغل').map((r) => r.item.key)).toEqual(rank(idx, 'مشغّل').map((r) => r.item.key));
    expect(rank(idx, 'مشغل')[0].item.key).toBe('ro');
    expect(rank(idx, 'امن').length).toBe(rank(idx, 'أمن').length);
    expect(rank(idx, 'operator reactor')[0].item.key).toBe('ro');
  });

  it('is AND across words, ranks title above alternative labels above body, and prefixes the word being typed', () => {
    expect(rank(idx, 'reactor xyzzy')).toEqual([]);
    const r = rank(idx, 'reactor operator').map((x) => x.item.key);
    expect(r).toEqual(['ro', 'eng']); // title match beats the body match
    expect(rank(idx, 'reactor oper').map((x) => x.item.key)[0]).toBe('ro');
    expect(rank(idx, 'owner').map((x) => x.item.key)).toEqual(['alt']);
  });

  it('indexes both languages whatever the page language (English query, Arabic UI; Arabic query, English UI)', () => {
    expect(rank(idx, 'security', 'ar')[0].item.key).toBe('sec');
    expect(rank(idx, 'ضابط', 'en')[0].item.key).toBe('sec');
  });

  it('groups by kind with counts, caps each group and orders groups by their best hit', () => {
    const many = buildIndex(Array.from({ length: 9 }, (_, i) => item(`r${i}`, `Operator ${i}`, `مشغل ${i}`)).concat([{ key: 'p', kind: 'page', title: { en: 'Operator', ar: 'مشغل' }, to: '/careers' }]));
    const g = searchGrouped(many, 'operator', { perGroup: 5 });
    expect(g.total).toBe(10);
    expect(g.groups.map((x) => x.kind)).toEqual(['page', 'role']); // exact title match first
    expect(g.groups[1].total).toBe(9);
    expect(g.groups[1].hits.length).toBe(5);
  });
});

describe('sources (local backend)', () => {
  it('searches pages, help, skills, roles, programmes, courses, FAQ, glossary, frameworks, partners, news and benchmarks', async () => {
    const { items, src } = await fullIndex();
    const kinds = new Set(items.map((i) => i.kind));
    for (const k of ['page', 'guide', 'term', 'skill', 'role', 'programme', 'course', 'faq', 'framework', 'partner', 'news', 'benchmark']) expect(kinds, k).toContain(k);
    expect(items.filter((i) => i.kind === 'skill').length).toBe(src.skills.length);
    expect(items.find((i) => i.kind === 'faq')?.to).toMatch(/^\/faq#faq-/);
    expect(items.find((i) => i.kind === 'news')?.to).toMatch(/^\/news\/[a-z0-9-]+$/);
    // every item has both languages
    for (const i of items) expect(i.title.en.trim() && i.title.ar.trim(), i.key).toBeTruthy();
  });

  it('loads each source once per backend and persona (no request on a second open)', async () => {
    const b = getLocalBackend();
    await b.whenReady();
    expect(loadSearchSources(b)).toBe(loadSearchSources(b));
  });

  it('the four queries return results on the real data, in both UI languages', async () => {
    const { index } = await fullIndex();
    for (const q of ['مشغل', 'مشغّل', 'امن', 'أمن', 'operator reactor']) {
      expect(rank(index, q, 'en').length, q).toBeGreaterThan(0);
      expect(rank(index, q, 'ar').length, q).toBe(rank(index, q, 'en').length);
    }
    expect(rank(index, 'مشغل').length).toBe(rank(index, 'مشغّل').length);
    expect(rank(index, 'امن').length).toBe(rank(index, 'أمن').length);
    expect(rank(index, 'operator reactor').find((r) => r.item.kind === 'role')?.item.key).toBe('r-reactor-operator');
  });

  it('never offers a page the viewer cannot open', async () => {
    const anon = await fullIndex(ANON);
    expect(anon.items.every((i) => canOpen(i.to, ANON))).toBe(true);
    expect(anon.items.some((i) => i.to.startsWith('/my'))).toBe(false);
    expect(anon.items.some((i) => i.to.startsWith('/admin'))).toBe(false);
    const staff = await fullIndex(STAFF);
    expect(staff.items.some((i) => i.to === ROUTE_BY_ID['my'].path)).toBe(true);
    expect(staff.items.some((i) => i.to.startsWith('/admin'))).toBe(false);
    expect(canOpen('/admin/digest', ANON)).toBe(false);
    expect(canOpen('/faq#faq-1', ANON)).toBe(true);
  });
});

function Harness() {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const loc = useLocation();
  const navigate = useNavigate();
  return (
    <div>
      <button ref={btn} onClick={() => setOpen(true)} data-testid="open-search">
        open
      </button>
      <button onClick={() => navigate('/contact')} data-testid="elsewhere">
        elsewhere
      </button>
      <span data-testid="where">{loc.pathname + loc.search + loc.hash}</span>
      <GlobalSearch open={open} onClose={() => setOpen(false)} triggerRef={btn} />
    </div>
  );
}
async function openSearch() {
  fireEvent.click(screen.getByTestId('open-search'));
  const input = await screen.findByRole('combobox');
  await waitFor(() => expect(document.activeElement).toBe(input));
  return input as HTMLInputElement;
}
const type = (input: HTMLInputElement, v: string) => fireEvent.change(input, { target: { value: v } });
const key = (input: HTMLInputElement, k: string) => fireEvent.keyDown(input, { key: k });

describe('GlobalSearch component', () => {
  it('combobox pattern: focus in the input, options with aria-activedescendant, Up/Down/Home/End, live count', async () => {
    await renderPage(<Harness />, { path: '/' });
    const input = await openSearch();
    expect(input.getAttribute('aria-expanded')).toBe('true'); // suggested pages
    type(input, 'reactor operator');
    await waitFor(() => expect(screen.getAllByRole('option').some((o) => /Reactor Operator/.test(o.textContent ?? ''))).toBe(true));
    const list = screen.getByRole('listbox');
    expect(input.getAttribute('aria-controls')).toBe(list.id);
    const opts = screen.getAllByRole('option');
    expect(opts.every((o) => !o.querySelector('a,button,input'))).toBe(true);
    expect(input.getAttribute('aria-activedescendant')).toBe(opts[0].id);
    expect(opts[0].getAttribute('aria-selected')).toBe('true');
    key(input, 'ArrowDown');
    expect(input.getAttribute('aria-activedescendant')).toBe(opts[1].id);
    key(input, 'End');
    expect(input.getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option').at(-1)!.id);
    key(input, 'ArrowDown'); // wraps
    expect(input.getAttribute('aria-activedescendant')).toBe(opts[0].id);
    key(input, 'ArrowUp');
    key(input, 'Home');
    expect(input.getAttribute('aria-activedescendant')).toBe(opts[0].id);
    expect(screen.getAllByRole('group').length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByTestId('search-status').textContent).toMatch(/\d+ results?/));
  });

  it('Enter opens the active result, the dialog closes and stays closed, focus returns to the trigger', async () => {
    await renderPage(<Harness />, { path: '/faq' });
    const input = await openSearch();
    type(input, 'contact');
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(0));
    const first = screen.getAllByRole('option')[0];
    const label = first.textContent;
    key(input, 'Enter');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByTestId('where').textContent).not.toBe('/faq');
    expect(label).toBeTruthy();
    await act(async () => new Promise((r) => setTimeout(r, 20)));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByTestId('open-search'));
  });

  it('a highlighted result further down opens on Enter (and a click opens too)', async () => {
    await renderPage(<Harness />, { path: '/' });
    let input = await openSearch();
    type(input, 'operator');
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(2));
    key(input, 'ArrowDown');
    key(input, 'ArrowDown');
    const want = screen.getAllByRole('option')[2];
    expect(input.getAttribute('aria-activedescendant')).toBe(want.id);
    key(input, 'Enter');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const after = screen.getByTestId('where').textContent;
    expect(after).not.toBe('/');
    input = await openSearch();
    type(input, 'faq');
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByRole('option')[0]);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('closes when the page changes underneath it', async () => {
    await renderPage(<Harness />, { path: '/faq' });
    await openSearch();
    fireEvent.click(screen.getByTestId('elsewhere'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByTestId('where').textContent).toBe('/contact');
  });

  it('on /ar, an English query finds results shown in Arabic; Arabic without diacritics finds the role', async () => {
    await renderPage(<Harness />, { path: '/ar' });
    const input = await openSearch();
    type(input, 'reactor operator');
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(0));
    expect(screen.getAllByRole('option').some((o) => /[؀-ۿ]/.test(o.textContent ?? ''))).toBe(true);
    type(input, 'مشغل');
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.getByTestId('search-status').textContent).toMatch(/\d|واحدة/));
  });

  it('zero results: suggestions to the Help centre, the FAQ and Dalil with the query', async () => {
    await renderPage(<Harness />, { path: '/' });
    const input = await openSearch();
    type(input, 'zzqxv');
    await waitFor(() => expect(screen.getByTestId('search-try-ask')).toBeTruthy());
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByTestId('search-try-ask').getAttribute('href')).toBe('/ask?q=zzqxv');
    expect(screen.getByTestId('search-try-help').getAttribute('href')).toBe('/help?q=zzqxv');
    expect(screen.getByTestId('search-try-faq').getAttribute('href')).toBe('/faq?q=zzqxv');
    await waitFor(() => expect(screen.getByTestId('search-status').textContent).toContain('zzqxv'));
  });
});
