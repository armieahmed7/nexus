// Shared helpers for the E2E QA suite (supabase mode by default; local only for roles with no NEXUS demo account).
import { expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const BASE = '/kafaa';
export const OUT = process.env.KAFAA_QA_OUT || 'test-results/e2e';
export const E2E_TAG = 'E2E-QA';

export type Backend = 'supabase' | 'local';

/** Collect page errors and console errors for the lifetime of the page. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}${m.location()?.url ? ` @ ${m.location().url}` : ''}`);
  });
  return {
    errors,
    take() {
      return errors.splice(0, errors.length);
    },
  };
}

/** Pin the backend for the browser before any app code runs (supabase is the app default; local is the env fallback). */
export async function pinBackend(page: Page, backend: Backend, localPersona: string | null = null) {
  await page.addInitScript(
    ([b, p]) => {
      try {
        if (sessionStorage.getItem('e2e.pinned')) return; // only on the first load of this page
        sessionStorage.setItem('e2e.pinned', '1');
        if (b === 'local') localStorage.setItem('kafaa.backend', 'local');
        else localStorage.removeItem('kafaa.backend');
        if (b === 'local' && p) localStorage.setItem('kafaa.session.v1', JSON.stringify({ persona: p, at: Date.now() }));
      } catch {
        /* ignore */
      }
    },
    [backend, localPersona] as const,
  );
}

/**
 * Readiness fixes 2026-10-13: the journeys write tagged rows (E2E-QA opportunities, sessions, notifications, ratings...) through the real
 * RPCs, and on the shared live demo database ENEC testers saw them. A journey that signs in to write now runs against the live project
 * (hlirqxoddysxtdezwcgv, the build's default VITE_SUPABASE_URL) only when KAFAA_E2E_LIVE_WRITES=1 is set on purpose, with the owner's
 * consent; otherwise it fails at sign-in with this message. Build against a Supabase branch (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
 * to run them freely. The read-only sweeps (sweep.spec.ts, visual.spec.ts) sign in with { readOnly: true } and are not affected.
 */
export const LIVE_PROJECT = 'hlirqxoddysxtdezwcgv';
export function assertWritableTarget() {
  const target = process.env.VITE_SUPABASE_URL || `https://${LIVE_PROJECT}.supabase.co`;
  if (target.includes(LIVE_PROJECT) && process.env.KAFAA_E2E_LIVE_WRITES !== '1') {
    throw new Error(`E2E journeys write E2E-QA rows; ${target} is the shared live demo database ENEC testers use. Point the build at a Supabase branch (VITE_SUPABASE_URL), or set KAFAA_E2E_LIVE_WRITES=1 only with the owner's consent.`);
  }
}

/** Sign in through the real sign-in screen (supabase: Supabase Auth password grant with the NEXUS demo account). */
export async function signIn(page: Page, persona: string, opts: { readOnly?: boolean } = {}) {
  if (!opts.readOnly) assertWritableTarget();
  await page.goto(`${BASE}/sign-in`);
  await page.locator(`[data-testid="persona-${persona}"]`).click();
  await expect(page.locator('[data-testid="account-menu"]')).toBeVisible({ timeout: 30_000 });
  await expect(page).not.toHaveURL(/\/sign-in/);
}

/** Wait until the page has settled: main rendered, skeletons gone, network quiet (bounded). */
export async function settle(page: Page) {
  await page.waitForSelector('main', { timeout: 30_000 });
  await expect(page.locator('main [data-testid="skeleton"]').first()).toHaveCount(0, { timeout: 30_000 });
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined);
  await expect(page.locator('main [data-testid="skeleton"]').first()).toHaveCount(0, { timeout: 30_000 });
}

const RAW_KEY = /\b(?:common|shell|digest|fs|m0[1-9]|m[1-3][0-9])\.[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)+\b/g;
const BAD_TEXT: [RegExp, string][] = [
  [/\bundefined\b/, 'undefined'],
  [/\bNaN\b/, 'NaN'],
  [/\[object Object\]/, '[object Object]'],
  [/\bInvalid Date\b/, 'Invalid Date'],
  [/\b(?:Lorem ipsum|TODO|TBD|FIXME)\b/i, 'placeholder text'],
  [/Module placeholder|وحدة مؤقتة/, 'module placeholder'],
  [/\{\{?\s*\w+\s*\}?\}/, 'unfilled template'],
];

/** Text-level checks on the visible page. */
export async function textIssues(page: Page): Promise<string[]> {
  const text = await page.locator('body').innerText();
  const out: string[] = [];
  const keys = [...new Set(text.match(RAW_KEY) ?? [])];
  if (keys.length) out.push(`raw i18n keys: ${keys.slice(0, 5).join(', ')}`);
  for (const [re, label] of BAD_TEXT) {
    const m = text.match(re);
    if (m) {
      const i = m.index ?? 0;
      out.push(`${label}: "…${text.slice(Math.max(0, i - 40), i + 40).replace(/\s+/g, ' ')}…"`);
    }
  }
  // Status chips that fell back to the raw enum value (no translation): "in_progress" shown as "in progress".
  const raw = await page.evaluate(() =>
    [...document.querySelectorAll('[data-status]')]
      .map((el) => ({ s: el.getAttribute('data-status') ?? '', txt: (el.textContent ?? '').trim() }))
      .filter((x) => x.s && /^[a-z_]+$/.test(x.s) && x.txt === x.s.replace(/_/g, ' '))
      .map((x) => x.s),
  );
  if (raw.length) out.push(`untranslated status: ${[...new Set(raw)].join(', ')}`);
  return out;
}

/** Horizontal overflow of the page (mobile check). */
export async function overflowX(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

export function writeOut(name: string, data: unknown) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), typeof data === 'string' ? data : JSON.stringify(data, null, 2));
}
