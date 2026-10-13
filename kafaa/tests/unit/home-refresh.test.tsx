// @vitest-environment jsdom
/**
 * Homepage refresh (2026-10-13, requested by the platform owner): the home page is an upskilling front door, not a plant
 * brochure, and the header no longer carries a "Back to NEXUS" link. These tests pin that:
 *  - every homepage link is a registered route; public links open public routes, staff links are guarded routes that send
 *    signed-out visitors through /sign-in?next=…;
 *  - the page renders the journey, future-skills, audience and trust sections, with no plant statistics ("Barakah in numbers");
 *  - the header has no NEXUS link in English or Arabic.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import HomePage, { AUDIENCES, FOCUS, JOURNEY, TRUST, homeHref, type HomeLink } from '../../src/modules/m12/HomePage';
import { Layout } from '../../src/shell/Layout';
import { routeForPath } from '../../src/routes/registry';
import { checkGuard } from '../../src/auth/guards';
import { renderPage } from './g1-harness';

const ALL: HomeLink[] = [
  ...JOURNEY.flatMap((s) => s.links),
  ...AUDIENCES.flatMap((a) => a.links),
  ...FOCUS.map((f) => ({ to: f.to, key: f.id })),
  ...TRUST.map((x) => ({ to: x.to, key: x.id })),
];
const ANON = { status: 'anon' as const, roles: [] };

describe('homepage links', () => {
  it.each(ALL.map((l) => [l.to, l] as const))('%s is a registered route with the right access', (_to, link) => {
    const r = routeForPath(link.to);
    expect(r, `no route for ${link.to}`).not.toBeNull();
    if (link.staff) {
      expect(r!.def.zone).not.toBe('public');
      expect(checkGuard(r!.def.guard, ANON)).toBe('signin');
    } else {
      expect(r!.def.zone).toBe('public');
      expect(checkGuard(r!.def.guard, ANON)).toBe('ok');
    }
  });

  it('sends signed-out visitors to sign in first for staff links, then on to the page', () => {
    const staff = AUDIENCES.flatMap((a) => a.links).filter((l) => l.staff);
    expect(staff.length).toBeGreaterThan(0);
    for (const l of staff) {
      expect(homeHref(l, false)).toBe(`/sign-in?next=${encodeURIComponent(l.to)}`);
      expect(homeHref(l, true)).toBe(l.to);
    }
    expect(homeHref({ to: '/learn', key: 'catalogue' }, false)).toBe('/learn');
  });
});

describe('homepage content', () => {
  it('renders the upskilling sections and no plant statistics (EN)', async () => {
    const { container } = await renderPage(<HomePage />, { path: '/' });
    await waitFor(() => expect(screen.getByTestId('m12-home')).toBeTruthy());
    for (const id of ['m12-hero', 'm12-levels', 'm12-journey', 'm12-focus', 'm12-audiences', 'm12-trust', 'm12-next']) expect(screen.getByTestId(id)).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('skills');
    expect(container.textContent).not.toMatch(/Barakah in numbers|People behind Barakah/);
    expect(container.querySelector('[data-testid="m12-barakah-facts"], [data-testid="m12-people-facts"], [data-testid="m12-fact"]')).toBeNull();
    expect(screen.getByTestId('m12-cta-learn').getAttribute('href')).toBe('/learn');
    expect(screen.getByTestId('m12-cta-signin').getAttribute('href')).toBe('/sign-in');
    expect(screen.getByTestId('m12-aud-staff-passport').getAttribute('href')).toBe(`/sign-in?next=${encodeURIComponent('/my/skills')}`);
  });

  it('renders in Arabic with Arabic-prefixed links', async () => {
    const { container } = await renderPage(<HomePage />, { path: '/ar' });
    await waitFor(() => expect(screen.getByTestId('m12-home')).toBeTruthy());
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('المهارات');
    expect(screen.getByTestId('m12-cta-learn').getAttribute('href')).toBe('/ar/learn');
    expect(container.textContent).not.toMatch(/Barakah|براكة بالأرقام/);
  });

  it('offers My Kafa\'a instead of sign-in, and direct staff links, when signed in', async () => {
    await renderPage(<HomePage />, { path: '/', persona: 'nse' });
    await waitFor(() => expect(screen.getByTestId('m12-cta-my')).toBeTruthy());
    expect(screen.queryByTestId('m12-cta-signin')).toBeNull();
    expect(screen.getByTestId('m12-aud-staff-passport').getAttribute('href')).toBe('/my/skills');
  });
});

describe('header', () => {
  // The shell scrolls to the top on navigation; jsdom does not implement scrollTo.
  beforeAll(() => Object.defineProperty(window, 'scrollTo', { value: () => undefined, writable: true, configurable: true }));
  it.each([['/'], ['/ar']])('has no link back to NEXUS (%s)', async (path) => {
    const { container } = await renderPage(<Layout />, { path });
    await waitFor(() => expect(screen.getByTestId('lang-toggle')).toBeTruthy());
    expect(screen.queryByTestId('back-to-nexus')).toBeNull();
    const header = container.querySelector('header')!;
    expect(header.textContent).not.toMatch(/NEXUS/);
    for (const a of Array.from(header.querySelectorAll('a'))) expect(a.getAttribute('href') ?? '').not.toMatch(/enecai\.xyz|^https?:/);
  });
});
