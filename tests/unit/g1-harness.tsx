/** Render a page as a given persona (or anonymous) with the real providers and the in-memory LocalBackend. */
import type { ReactElement } from 'react';
import { render, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nProvider } from '../../src/i18n';
import { ToastProvider } from '../../src/ui/Toast';
import { SessionProvider } from '../../src/auth/session';
import { getLocalBackend } from '../../src/data';
import { config } from '../../src/config';

afterEach(() => cleanup());

export async function renderPage(el: ReactElement, opts: { persona?: string | null; path?: string; route?: string; prepare?: (b: ReturnType<typeof getLocalBackend>) => void } = {}) {
  const b = getLocalBackend();
  await b.whenReady();
  await b.reset();
  opts.prepare?.(b);
  if (opts.persona) localStorage.setItem(config.sessionKey, JSON.stringify({ persona: opts.persona, at: Date.now() }));
  else localStorage.removeItem(config.sessionKey);
  return render(
    <MemoryRouter initialEntries={[opts.path ?? '/']}>
      <I18nProvider>
        <ToastProvider>
          <SessionProvider>
            <Routes>
              <Route path={opts.route ?? '*'} element={el} />
            </Routes>
          </SessionProvider>
        </ToastProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
}
