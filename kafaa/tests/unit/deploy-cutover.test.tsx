// @vitest-environment jsdom
/**
 * Audit 2026-10-12 (site sweep, problem 1): after a deploy, open tabs asked for chunks of the previous build. The SPA fallback
 * answered them with index.html (200 text/html), the import failed, React.lazy and loadSeed kept the rejected promise, "Try again"
 * re-rendered the same error and a local-demo user was shown as signed out. These tests pin the fix:
 * _redirects 404s missing assets, a chunk failure reloads the page once (loop-guarded), the crash screen's "Try again" reloads,
 * a failed seed load is retried, and a session that cannot be resolved shows an error instead of the sign-in gate.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lazy, Suspense } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { I18nProvider } from '../../src/i18n';
import { Boundary } from '../../src/shell/RouteView';
import { RELOAD_KEY, RELOAD_WINDOW_MS, installChunkReload, isChunkLoadError, reloadOnce, retryableOnce } from '../../src/shell/chunkReload';
import { RequireGuard, checkGuard } from '../../src/auth/guards';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { renderPage } from './g1-harness';

const CHUNK = 'Failed to fetch dynamically imported module: https://enec-kafaa.netlify.app/kafaa/assets/MyCoachPage-ChghK_kM.js';

class MemStorage {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
}

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('_redirects: assets of an earlier deploy 404 instead of falling through to index.html', () => {
  const rules = readFileSync('public/_redirects', 'utf8').split('\n').map((l) => l.trim().replace(/\s+/g, ' ')).filter(Boolean);
  it('has the /kafaa/assets/* 404 rule above the SPA fallback, with a published body', () => {
    const a = rules.indexOf('/kafaa/assets/* /kafaa/asset-missing.txt 404');
    expect(a).toBeGreaterThan(-1);
    expect(a).toBeLessThan(rules.indexOf('/kafaa/* /kafaa/index.html 200'));
    expect(readFileSync('public/asset-missing.txt', 'utf8')).toMatch(/reload/i);
  });
  it('make-deploy checks the rule and its order', () => {
    const s = readFileSync('scripts/make-deploy.mjs', 'utf8');
    expect(s).toContain("'/kafaa/assets/* /kafaa/asset-missing.txt 404'");
    expect(s).toMatch(/rules\.indexOf\(ASSETS_404\) > rules\.indexOf\(SPA\)/);
  });
});

describe('chunk-load errors', () => {
  it('recognises the browsers\' messages and nothing else', () => {
    expect(isChunkLoadError(new TypeError(CHUNK))).toBe(true);
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module: https://x/kafaa/assets/a.js'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('Unable to preload CSS for /kafaa/assets/index-abc.css'))).toBe(true);
    expect(isChunkLoadError(new TypeError("'text/html' is not a valid JavaScript MIME type."))).toBe(true);
    expect(isChunkLoadError(Object.assign(new Error('x'), { name: 'ChunkLoadError' }))).toBe(true);
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'id')"))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });

  it('reloads once per window, never in a loop, and not at all without sessionStorage', () => {
    const storage = new MemStorage();
    const reload = vi.fn();
    expect(reloadOnce({ storage, reload, now: 1_000_000 })).toBe(true);
    expect(reloadOnce({ storage, reload, now: 1_000_000 + RELOAD_WINDOW_MS - 1 })).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(reloadOnce({ storage, reload, now: 1_000_000 + RELOAD_WINDOW_MS + 1 })).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
    expect(reloadOnce({ storage: null, reload })).toBe(false);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('a vite:preloadError reloads the page once', () => {
    const reload = vi.fn();
    const off = installChunkReload(window, reload);
    const fire = () => window.dispatchEvent(Object.assign(new Event('vite:preloadError', { cancelable: true }), { payload: new TypeError(CHUNK) }));
    fire();
    fire();
    off();
    fire();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(RELOAD_KEY)).toMatch(/^\d+$/);
  });

  it('retryableOnce caches a success but forgets a failure (loadSeed after a stale seed chunk)', async () => {
    let calls = 0;
    const load = retryableOnce(async () => {
      calls++;
      if (calls === 1) throw new TypeError(CHUNK);
      return calls;
    });
    await expect(load()).rejects.toThrow(/dynamically imported module/);
    await expect(load()).resolves.toBe(2);
    await expect(load()).resolves.toBe(2);
    expect(calls).toBe(2);
  });
});

describe('route error boundary', () => {
  const mount = (child: JSX.Element, reload: () => void) =>
    render(
      <MemoryRouter>
        <I18nProvider>
          <Boundary lang="en" routeId="t" reload={reload}>
            <Suspense fallback={<div>loading</div>}>{child}</Suspense>
          </Boundary>
        </I18nProvider>
      </MemoryRouter>,
    );

  it('a stale page chunk reloads once by itself; "Try again" does a full reload', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const reload = vi.fn();
    const Page = lazy(() => Promise.reject(new TypeError(CHUNK)));
    mount(<Page />, reload);
    await screen.findByTestId('page-crash');
    expect(reload).toHaveBeenCalledTimes(1); // automatic, guarded
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reload).toHaveBeenCalledTimes(2); // the person's choice: always a full reload
  });

  it('any other error keeps the in-place retry and never reloads', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const reload = vi.fn();
    let broken = true;
    const Flaky = () => {
      if (broken) throw new Error('render bug');
      return <div data-testid="fine">fine</div>;
    };
    mount(<Flaky />, reload);
    await screen.findByTestId('page-crash');
    broken = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByTestId('fine');
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('session: a failed resolve is an error, not "signed out"', () => {
  it('checkGuard maps the error status to an error result for signed-in routes only', () => {
    expect(checkGuard({ signedIn: true }, { status: 'error', roles: ['public'] })).toBe('error');
    expect(checkGuard({}, { status: 'error', roles: ['public'] })).toBe('ok');
  });

  it('shows the session error with a retry that resolves the session again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await renderPage(
      <RequireGuard guard={{ signedIn: true }} routeId="t">
        <div data-testid="inside">inside</div>
      </RequireGuard>,
      { persona: 'nse', prepare: () => vi.spyOn(LocalBackend.prototype, 'whoami').mockRejectedValueOnce(new Error('seed failed')) },
    );
    await screen.findByTestId('session-error');
    expect(screen.queryByTestId('signin-required')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByTestId('inside')).toBeTruthy());
  });
});
