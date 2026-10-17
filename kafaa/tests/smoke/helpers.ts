// Shared by the smoke specs (smoke.spec.ts, a11y.spec.ts): local-backend persona setup and a settled page visit.
import { expect, type Page } from '@playwright/test';

export const BASE = '/kafaa';

export async function asPersona(page: Page, persona: string | null) {
  await page.addInitScript((p) => {
    try {
      localStorage.setItem('kafaa.backend', 'local');
      if (p) localStorage.setItem('kafaa.session.v1', JSON.stringify({ persona: p, at: Date.now() }));
      else localStorage.removeItem('kafaa.session.v1');
    } catch {
      /* ignore */
    }
  }, persona);
}

export async function visit(page: Page, url: string) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForSelector('main', { timeout: 20_000 });
  // Wait until the guard/session has settled (skeletons gone from main) or a terminal state is visible.
  await expect(page.locator('main [data-testid="skeleton"]').first()).toHaveCount(0, { timeout: 20_000 });
  await expect(page.locator('[data-testid="page-crash"]')).toHaveCount(0);
  expect(errors, `page errors on ${url}`).toEqual([]);
}
