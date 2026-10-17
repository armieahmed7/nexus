/**
 * A11Y-03: at phone width (390 px) the floating Ask Dalil button must not cover content (WCAG 2.4.11). It is a 44 px icon
 * button, tucks away while the page scrolls down, comes back on scroll up, and at the bottom of the page the footer ends
 * above it. Run with the other smoke specs (npm run build && npm run test:smoke).
 */
import { test, expect, type Page } from '@playwright/test';
import { BASE, asPersona, visit } from './helpers';

test.use({ viewport: { width: 390, height: 844 }, contextOptions: { reducedMotion: 'reduce' } });

const scrollBy = (page: Page, dy: number) => page.evaluate((d) => window.scrollBy(0, d), dy);

for (const path of ['/learn', '/ar/learn']) {
  test(`phone launcher ${path}`, async ({ page }) => {
    await asPersona(page, null);
    await visit(page, BASE + path);
    const btn = page.locator('[data-testid="dalil-launcher"]');
    await expect(btn).toBeVisible();
    const box = (await btn.boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(48);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await expect(btn).toHaveAccessibleName(path.startsWith('/ar') ? /دليل/ : /Ask Dalil/);

    await scrollBy(page, 600);
    await expect(btn).toHaveAttribute('data-tucked', 'true');
    await scrollBy(page, -200);
    await expect(btn).toHaveAttribute('data-tucked', 'false');

    // At the very bottom (then a nudge up so the button shows), the last footer row ends above the button.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await scrollBy(page, -12);
    await expect(btn).toHaveAttribute('data-tucked', 'false');
    const footerBottom = await page.locator('[data-testid="concept-disclaimer"]').evaluate((el) => el.closest('div')!.getBoundingClientRect().bottom);
    const top = (await btn.boundingBox())!.y;
    expect(footerBottom).toBeLessThanOrEqual(top);
  });
}

test('phone launcher stays off /speak-up', async ({ page }) => {
  await asPersona(page, null);
  await visit(page, `${BASE}/speak-up`);
  await expect(page.locator('[data-testid="dalil-launcher"]')).toHaveCount(0);
});
