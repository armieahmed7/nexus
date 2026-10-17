// @vitest-environment jsdom
/**
 * Accessibility and polish fixes (2026-10-17, survey section 9):
 *   1 <Async empty={null}> renders nothing when empty (no orphan "Nothing here yet" box); omitting `empty` keeps the default box
 *   2 header popovers (public nav dropdowns, account menu, backend chip) close on Escape (focus back to the trigger) and on an
 *     outside press or focus move, with aria-expanded / aria-controls in sync
 *   3 English inside Arabic pages is tagged lang="en" (source titles, glossary terms)
 *   4 the path graph's accessible name is translated
 *   5 the demo issuer name is localised on /ar/verify/badge (display only)
 *   6 sign-in role cards show readable scopes, not codes such as "instructor:entity=enec-ops"
 *   7 signed-out visitors get a theme toggle in the header
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderPage } from './g1-harness';
import { Async, SourceLink } from '../../src/ui/Page';
import { PathGraph } from '../../src/ui/CareerLadder';
import { Layout } from '../../src/shell/Layout';
import { hasKey, translate } from '../../src/i18n';
import { PERSONAS } from '../../src/auth/session';
import { scopeLabel, scopeSummary } from '../../src/modules/m14/scopeLabels';
import SignInPage from '../../src/modules/m14/SignInPage';
import VerifyBadgePage from '../../src/modules/m17/VerifyBadgePage';
import PathwaysProgrammePage from '../../src/modules/m06/PathwaysProgrammePage';
import { ISSUER_NAME } from '../../src/modules/m17/issuer';
import seed from '../../src/seed/seed.json';

const W = { timeout: 30000 };
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const T = (seed as unknown as { tables: Record<string, Row[]> }).tables;
const done = { data: [] as number[], loading: false, error: null };

beforeAll(() => Object.defineProperty(window, 'scrollTo', { value: () => undefined, writable: true, configurable: true }));

describe('1 · Async empty={null}', () => {
  it('renders nothing for an explicit null, the default box when empty is omitted, and the custom node otherwise', async () => {
    const { container, unmount } = await renderPage(<div data-testid="host"><Async state={done} empty={null}>{() => <p>rows</p>}</Async></div>);
    expect(screen.getByTestId('host').innerHTML).toBe('');
    expect(container.querySelector('[data-testid="empty-state"]')).toBeNull();
    unmount();
    await renderPage(<Async state={done}>{() => <p>rows</p>}</Async>);
    expect(screen.getByTestId('empty-state')).toBeTruthy();
    await renderPage(<Async state={done} empty={<span data-testid="custom" />}>{() => <p>rows</p>}</Async>);
    expect(screen.getByTestId('custom')).toBeTruthy();
  });

  it('/pathways/mustaqbali has no orphan "Nothing here yet" box', async () => {
    const { container } = await renderPage(<PathwaysProgrammePage />, { path: '/pathways/mustaqbali', route: '/pathways/:programme' });
    await waitFor(() => expect(container.querySelector('h1')).toBeTruthy(), W);
    await waitFor(() => expect(container.querySelector('[data-testid="skeleton"]')).toBeNull(), W);
    expect(container.querySelector('[data-testid="empty-state"]')).toBeNull();
  }, 90000);
});

describe('2 · header popovers close on Escape and outside interaction', () => {
  const expectClosed = (btn: HTMLElement) => {
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(document.getElementById(btn.getAttribute('aria-controls')!)).toBeNull();
  };
  const expectOpen = (btn: HTMLElement) => {
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById(btn.getAttribute('aria-controls')!)).toBeTruthy();
  };

  it('public nav dropdown: Escape closes and returns focus; an outside press and focus elsewhere close it', async () => {
    await renderPage(<Layout />, { path: '/' });
    const btn = await screen.findByTestId('nav-menu-careers', {}, W);
    expectClosed(btn);
    fireEvent.click(btn);
    expectOpen(btn);
    const firstLink = document.getElementById(btn.getAttribute('aria-controls')!)!.querySelector('a')!;
    act(() => firstLink.focus());
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expectClosed(btn);
    expect(document.activeElement).toBe(btn);
    fireEvent.click(btn);
    expectOpen(btn);
    fireEvent.pointerDown(document.body);
    expectClosed(btn);
    fireEvent.click(btn);
    act(() => screen.getByTestId('lang-toggle').focus());
    expectClosed(btn);
  });

  it('account menu and backend chip close on Escape with focus back on their trigger', async () => {
    await renderPage(<Layout />, { path: '/', persona: 'nse' });
    for (const id of ['account-menu', 'backend-chip']) {
      const btn = await screen.findByTestId(id, {}, W);
      fireEvent.click(btn);
      expectOpen(btn);
      fireEvent.keyDown(document, { key: 'Escape' });
      expectClosed(btn);
      expect(document.activeElement).toBe(btn);
    }
  });
});

describe('3 · English inside Arabic pages', () => {
  it('an English source title on an Arabic page is tagged lang="en"; Arabic titles and English pages are left alone', async () => {
    const { container, unmount } = await renderPage(<><SourceLink href="https://example.org/a">IAEA Nuclear Energy Series</SourceLink><SourceLink href="https://example.org/b">الهيئة الاتحادية</SourceLink></>, { path: '/ar' });
    const tagged = container.querySelectorAll('bdi[lang="en"]');
    expect(tagged).toHaveLength(1);
    expect(tagged[0].textContent).toBe('IAEA Nuclear Energy Series');
    expect(tagged[0].getAttribute('dir')).toBe('ltr');
    unmount();
    const en = await renderPage(<SourceLink href="https://example.org/a">IAEA Nuclear Energy Series</SourceLink>, { path: '/' });
    expect(en.container.querySelector('bdi[lang="en"]')).toBeNull();
  });
});

describe('4 · path graph name', () => {
  it('uses the translated accessible name', async () => {
    const nodes = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }];
    const edges = [{ from: 'a', to: 'b' }];
    const { container } = await renderPage(<PathGraph nodes={nodes} edges={edges} rtl />, { path: '/ar' });
    expect(container.querySelector('svg[role="img"]')!.getAttribute('aria-label')).toBe(translate('ar', 'common.pathGraph'));
    expect(translate('ar', 'common.pathGraph')).not.toBe(translate('en', 'common.pathGraph'));
  });
});

describe('5 · issuer name on /ar/verify/badge', () => {
  it('shows the Arabic issuer name; the signed credential keeps its bytes', async () => {
    const bd = T.badges.find((b) => b.person_id === 'p-k-ro')!;
    expect(bd.credential.issuer.name).toBe(ISSUER_NAME);
    await renderPage(<VerifyBadgePage />, { path: `/ar/verify/badge/${bd.public_slug}`, route: '/ar/verify/badge/:id' });
    const res = await screen.findByTestId('m17-verify-result', {}, W);
    expect(res.getAttribute('data-outcome')).toBe('valid');
    expect(res.textContent).toContain(translate('ar', 'm17.verify.issuerName'));
    expect(res.textContent).not.toContain(ISSUER_NAME);
  }, 30000);
});

describe('6 · sign-in scope labels', () => {
  const t = (lang: 'en' | 'ar') => (k: string, v?: Record<string, string | number>) => translate(lang, k, v);
  it('maps scope codes to readable EN and AR text', () => {
    expect(scopeLabel(t('en'), 'employee:self')).toBeNull();
    expect(scopeLabel(t('en'), 'instructor:entity=enec-ops')).toBe('Entity: ENEC Operations (Nawah Energy Company PJSC)');
    expect(scopeLabel(t('en'), 'manager:family=radiation-protection')).toBe('Job family: Radiation protection');
    expect(scopeLabel(t('en'), 'manager:team=ops-wc')).toBe('Team: Work control');
    expect(scopeLabel(t('en'), 'partner_admin:org=org-alnoor')).toBe('Organisation: Al Noor Precision Engineering');
    expect(scopeLabel(t('ar'), 'manager:crew=B')).toBe('الطاقم: B');
    expect(scopeSummary(t('en'), ['employee:self', 'hr_director:all', 'hr_analyst:all'])).toBe('Whole organisation');
    expect(scopeSummary(t('ar'), ['employee:self', 'hr_director:all'])).toBe('المؤسسة كاملة');
  });
  it.each([['en' as const], ['ar' as const]])('no persona scope renders as a raw code (%s)', (lang) => {
    for (const p of PERSONAS) {
      const s = scopeSummary(t(lang), p.scopes);
      expect(s, `${p.persona}: ${s}`).not.toMatch(/=|[a-z]_[a-z]|:all|:self/);
      for (const code of p.scopes) {
        const [kind, value] = code.slice(code.indexOf(':') + 1).split('=');
        // every value has a name, except crew letters which read as they are
        if (value && kind !== 'crew') expect(hasKey(kind === 'entity' ? `common.entities.${value}` : kind === 'team' ? `m14.team.${value}` : `m14.signIn.scopeValue.${value}`), `${p.persona} ${code}`).toBe(true);
      }
    }
  });
  it('/sign-in and /ar/sign-in show readable scopes', async () => {
    const { container, unmount } = await renderPage(<SignInPage />, { path: '/sign-in' });
    await screen.findByTestId('persona-chco', {}, W);
    expect(container.textContent).not.toMatch(/hr_director:all|instructor:entity=|:family=|:org=/);
    expect(screen.getByTestId('persona-chco').textContent).toContain('Whole organisation');
    unmount();
    await renderPage(<SignInPage />, { path: '/ar/sign-in' });
    expect((await screen.findByTestId('persona-chco', {}, W)).textContent).toContain('المؤسسة كاملة');
  }, 30000);
});

describe('7 · theme toggle for signed-out visitors', () => {
  it('is in the header when signed out and switches the theme; signed in, the account menu keeps it', async () => {
    try { localStorage.removeItem('kafaa.theme'); } catch { /* ignore */ }
    const { unmount } = await renderPage(<Layout />, { path: '/' });
    const btn = await screen.findByTestId('theme-toggle', {}, W);
    expect(btn.getAttribute('aria-label')).toBe(translate('en', 'shell.account.dark'));
    fireEvent.click(btn);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(btn.getAttribute('aria-label')).toBe(translate('en', 'shell.account.light'));
    fireEvent.click(btn);
    expect(document.documentElement.dataset.theme).toBe('light');
    unmount();
    await renderPage(<Layout />, { path: '/', persona: 'nse' });
    await screen.findByTestId('account-menu', {}, W);
    expect(screen.queryByTestId('theme-toggle')).toBeNull();
  });
});
