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

/** Sign in through the real sign-in screen (supabase: Supabase Auth password grant with the NEXUS demo account). */
export async function signIn(page: Page, persona: string) {
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

const RAW_KEY = /\b(?:common|shell|m0[1-9]|m1[0-6])\.[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)+\b/g;
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
