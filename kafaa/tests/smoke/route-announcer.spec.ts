/**
 * A11Y-01: an in-app navigation moves focus to the new page's h1 and a polite live region names the page (EN and AR).
 * The first load leaves focus alone, and a glossary #term link still focuses the term rather than the h1.
 * Run with the other smoke specs (npm run build && npm run test:smoke).
 */
import { test, expect } from '@playwright/test';
import { BASE, asPersona, visit } from './helpers';

test.use({ viewport: { width: 1280, height: 900 } });

const focusedTag = (page: import('@playwright/test').Page) => page.evaluate(() => document.activeElement?.tagName ?? '');

for (const [lang, prefix, re] of [
  ['en', '', /^.+, page loaded$/],
  ['ar', '/ar', /^تم تحميل الصفحة: .+/],
] as const) {
  test(`route announcer ${lang}: a nav link moves focus to the h1 and announces the page`, async ({ page }) => {
    await asPersona(page, null);
    await visit(page, `${BASE}${prefix}/`);
    const live = page.getByTestId('route-announcer');
    await expect(live).toHaveAttribute('aria-live', 'polite');
    await expect(live).toHaveText('');
    expect(await focusedTag(page)).toBe('BODY');

    await page.locator(`a[href="${BASE}${prefix}/careers"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/careers$`));
    const h1 = page.locator('main h1').first();
    await expect(h1).toBeFocused();
    await expect(h1).toHaveAttribute('tabindex', '-1');
    await expect(live).toHaveText(re);
    const title = (await h1.innerText()).trim();
    await expect(live).toContainText(title);
    await expect(page).toHaveTitle(new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
}

test('route announcer: a glossary #term link focuses the term, not the h1', async ({ page }) => {
  await asPersona(page, null);
  await visit(page, `${BASE}/help`);
  await page.locator('main a[href="/kafaa/help/glossary"]').first().click();
  await expect(page).toHaveURL(/\/help\/glossary/);
  await expect(page.locator('main h1').first()).toBeFocused();
  const firstTerm = await page.locator('[id^="term-"]').first().getAttribute('id');
  expect(firstTerm).toBeTruthy();
  await page.goBack();
  await expect(page).toHaveURL(/\/help$/);
  await page.evaluate((id) => {
    window.history.pushState({}, '', `/kafaa/help/glossary#${id}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, firstTerm);
  await expect(page.locator(`[id="${firstTerm}"]`)).toBeFocused();
  await expect(page.getByTestId('route-announcer')).toHaveText(/page loaded$/);
});
