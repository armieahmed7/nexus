// @vitest-environment jsdom
/**
 * [G3] Render every M06/M07/M10 route as the personas its guard admits, in English and Arabic, on the LocalBackend.
 * Fails on an uncaught render error, on an ErrorState, or on a loading skeleton that never resolves.
 * (Browser smoke tests in tests/smoke cover the shell and guards; this checks the module pages themselves.)
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createElement as h, Suspense } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nProvider } from '../../src/i18n';
import { ToastProvider } from '../../src/ui/Toast';
import { SessionProvider, resetLocalDemo } from '../../src/auth/session';
import { config } from '../../src/config';
import { checkGuard } from '../../src/auth/guards';
import { PERSONAS } from '../../src/auth/session';
import { routes as m06 } from '../../src/modules/m06/routes';
import { routes as m07 } from '../../src/modules/m07/routes';
import { routes as m10 } from '../../src/modules/m10/routes';

const PERSONA_IDS = [null, 'k-student', 'k-hr-analyst', 'chco', 'sro', 'k-observer', 'k-university', 'alnoor-gm', 'k-admin', 'k-auditor', 'k-editor'];
const PARAMS: Record<string, string> = { ':programme': 'dnt' };
const urlOf = (path: string) => path.replace(/:[a-z]+/g, (m) => PARAMS[m] ?? 'x');

beforeAll(async () => {
  await resetLocalDemo();
});
afterEach(() => cleanup());

const cases = [...m06, ...m07, ...m10].flatMap((r) =>
  PERSONA_IDS.filter((p) => {
    const card = p ? PERSONAS.find((x) => x.persona === p) : null;
    return checkGuard(r.guard, { status: p ? 'signed_in' : 'anon', roles: card ? card.roles : ['public'] }) === 'ok';
  }).flatMap((p) => (['en', 'ar'] as const).map((lang) => ({ route: r, persona: p, lang }))),
);

describe('G3 routes render for every admitted persona', () => {
  it('has cases', () => expect(cases.length).toBeGreaterThan(40));
  it.each(cases.map((c) => [c.route.id, c.persona ?? 'anon', c.lang, c] as const))('%s as %s (%s)', async (_id, _p, _l, c) => {
    localStorage.clear();
    if (c.persona) localStorage.setItem(config.sessionKey, JSON.stringify({ persona: c.persona, at: Date.now() }));
    const errors: unknown[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...a) => {
      const msg = String(a[0] ?? '');
      if (!/act\(|not wrapped in act|React Router Future/.test(msg)) errors.push(a);
    });
    const url = `${c.lang === 'ar' ? '/ar' : ''}${urlOf(c.route.path)}`;
    const Page = c.route.component;
    render(
      h(MemoryRouter, { initialEntries: [url] },
        h(I18nProvider, null,
          h(ToastProvider, null,
            h(SessionProvider, null,
              h(Suspense, { fallback: h('div', { 'data-testid': 'suspense' }) },
                h(Routes, null, h(Route, { path: c.route.path, element: h(Page) }), h(Route, { path: `/ar${c.route.path}`, element: h(Page) }))))))),
    );
    await waitFor(() => {
      expect(screen.queryByTestId('suspense')).toBeNull();
      expect(document.querySelector('h1')).toBeTruthy();
      expect(screen.queryAllByTestId('skeleton')).toHaveLength(0);
    }, { timeout: 8000 });
    expect(screen.queryAllByTestId('error-state')).toHaveLength(0);
    spy.mockRestore();
    expect(errors).toEqual([]);
  }, 20000);
});
