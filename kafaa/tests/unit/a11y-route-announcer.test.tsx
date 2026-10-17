// @vitest-environment jsdom
/**
 * A11Y-01: after an in-app navigation, focus moves to the new page's h1 and a polite live region says which page loaded
 * (EN/AR). Focus is left alone on the first load, for #targets (the glossary focuses the term), for a language switch,
 * while a modal dialog is open, and for query-only changes. Pages without a title of their own get one from their h1.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { Link, MemoryRouter, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { I18nProvider } from '../../src/i18n';
import { RouteAnnouncer, focusSkipReason } from '../../src/shell/RouteAnnouncer';

afterEach(() => {
  cleanup();
  document.title = '';
});

let go: (to: string) => void = () => undefined;
function NavHook() {
  const n = useNavigate();
  useEffect(() => {
    go = (to) => act(() => n(to));
  }, [n]);
  return null;
}

function Shell() {
  return (
    <>
      <RouteAnnouncer />
      <NavHook />
      <nav>
        <Link to="/two">Two</Link>
      </nav>
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
    </>
  );
}

function Titled({ title }: { title: string }) {
  useEffect(() => {
    document.title = `${title} · Kafa'a`;
  }, [title]);
  return <h1>{title}</h1>;
}

function Gate() {
  return <h1>Sign in to continue</h1>; // like the sign-in gate: no <Page>, no title of its own
}

function Dialog() {
  return (
    <>
      <h1>Behind a dialog</h1>
      <div role="dialog" aria-modal="true">
        <input aria-label="Search" autoFocus />
      </div>
    </>
  );
}

function renderApp(path = '/one') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <I18nProvider>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/one" element={<Titled title="Page one" />} />
            <Route path="/two" element={<Titled title="Page two" />} />
            <Route path="/gate" element={<Gate />} />
            <Route path="/dialog" element={<Dialog />} />
            <Route path="/glossary" element={<Titled title="Glossary" />} />
            <Route path="/ar/one" element={<Titled title="الصفحة الأولى" />} />
            <Route path="/ar/two" element={<Titled title="الصفحة الثانية" />} />
          </Route>
        </Routes>
      </I18nProvider>
    </MemoryRouter>,
  );
}

const live = () => screen.getByTestId('route-announcer');
const h1 = () => document.querySelector('main h1') as HTMLElement;

describe('RouteAnnouncer', () => {
  it('does nothing on the first load', async () => {
    renderApp('/one');
    await new Promise((r) => setTimeout(r, 120));
    expect(document.activeElement).toBe(document.body);
    expect(live().textContent).toBe('');
    expect(live().getAttribute('aria-live')).toBe('polite');
  });

  it('moves focus to the new h1 and announces the page after a link click', async () => {
    renderApp('/one');
    fireEvent.click(screen.getByText('Two'));
    await waitFor(() => expect(live().textContent).toBe('Page two, page loaded'));
    expect(document.activeElement).toBe(h1());
    expect(h1().textContent).toBe('Page two');
    expect(h1().getAttribute('tabindex')).toBe('-1');
  });

  it('announces in Arabic on /ar pages', async () => {
    renderApp('/ar/one');
    go('/ar/two');
    await waitFor(() => expect(live().textContent).toBe('تم تحميل الصفحة: الصفحة الثانية'));
    expect(document.activeElement).toBe(h1());
  });

  it('leaves focus for the page to put on a #target, but still announces', async () => {
    renderApp('/one');
    go('/glossary#term-npp');
    await waitFor(() => expect(live().textContent).toBe('Glossary, page loaded'));
    expect(document.activeElement).not.toBe(h1());
  });

  it('ignores query-only and hash-only changes', async () => {
    renderApp('/one');
    go('/one?q=abc');
    go('/one#section');
    await new Promise((r) => setTimeout(r, 150));
    expect(live().textContent).toBe('');
    expect(document.activeElement).toBe(document.body);
  });

  it('keeps focus on the language button when only the language changes', async () => {
    renderApp('/one');
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    btn.focus();
    go('/ar/one');
    await waitFor(() => expect(live().textContent).toBe('تم تحميل الصفحة: الصفحة الأولى'));
    expect(document.activeElement).toBe(btn);
    btn.remove();
  });

  it('does not take focus from an open modal dialog', async () => {
    renderApp('/one');
    go('/dialog');
    await waitFor(() => expect(live().textContent).toBe('Behind a dialog, page loaded'));
    expect(document.activeElement).not.toBe(h1());
  });

  it('gives a page without its own title one from its h1', async () => {
    renderApp('/one');
    await waitFor(() => expect(document.title).toBe("Page one · Kafa'a"));
    go('/gate');
    await waitFor(() => expect(live().textContent).toBe('Sign in to continue, page loaded'));
    expect(document.title).toMatch(/^Sign in to continue · /);
    go('/two');
    await waitFor(() => expect(live().textContent).toBe('Page two, page loaded'));
    expect(document.title).toBe("Page two · Kafa'a");
  });
});

describe('focusSkipReason', () => {
  it('names why focus stays put', () => {
    expect(focusSkipReason({ first: true, hash: '', langOnly: false })).toBe('first-load');
    expect(focusSkipReason({ first: false, hash: '#term-x', langOnly: false })).toBe('hash');
    expect(focusSkipReason({ first: false, hash: '#', langOnly: false })).toBe(null);
    expect(focusSkipReason({ first: false, hash: '', langOnly: true })).toBe('language');
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    expect(focusSkipReason({ first: false, hash: '', langOnly: false })).toBe('typing');
    input.remove();
    expect(focusSkipReason({ first: false, hash: '', langOnly: false })).toBe(null);
  });
});
