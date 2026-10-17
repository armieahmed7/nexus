/**
 * Smoke test: every registered route renders without a crash, as an anonymous visitor and as three personas,
 * in English, plus an Arabic (RTL) pass. Guarded routes must show the sign-in prompt to anonymous visitors.
 * Run: npm run build && npm run test:smoke   (serves dist/ with vite preview on :4173/kafaa/)
 */
import { test, expect } from '@playwright/test';
import { loadRoutes, fill, isPublic } from './routes';
import { BASE, asPersona, visit } from './helpers';

const ROUTES = loadRoutes();

test('registry is non-empty', () => {
  expect(ROUTES.length).toBeGreaterThan(80);
});

test.describe('anonymous', () => {
  for (const r of ROUTES) {
    test(`anon ${r.id}`, async ({ page }) => {
      await asPersona(page, null);
      await visit(page, BASE + fill(r));
      await expect(page.locator('[data-testid="concept-disclaimer"]')).toBeVisible();
      if (isPublic(r)) await expect(page.locator('[data-testid="signin-required"]')).toHaveCount(0);
      else await expect(page.locator('[data-testid="signin-required"]')).toBeVisible();
    });
  }
});

// Three personas across tiers: a licensed operator, an elevated staff role, and a supplier partner admin.
const PERSONAS: { persona: string; allowed: string[]; denied: string[] }[] = [
  { persona: 'k-ro', allowed: ['my', 'my-licence', 'my-quals', 'my-learning'], denied: ['admin-audit', 'partner-workforce', 'licensing-validity'] },
  { persona: 'training-mgr', allowed: ['training', 'training-courses', 'training-jpm', 'my'], denied: ['admin-ecp', 'observer'] },
  { persona: 'alnoor-gm', allowed: ['partner', 'partner-workforce', 'partner-onboarding'], denied: ['workforce', 'team', 'admin-audit'] },
];
for (const p of PERSONAS) {
  test.describe(`persona ${p.persona}`, () => {
    for (const r of ROUTES) {
      test(`${p.persona} ${r.id}`, async ({ page }) => {
        await asPersona(page, p.persona);
        await visit(page, BASE + fill(r));
        await expect(page.locator('[data-testid="signin-required"]')).toHaveCount(0);
        if (p.allowed.includes(r.id)) await expect(page.locator('[data-testid="forbidden"]')).toHaveCount(0);
        if (p.denied.includes(r.id)) await expect(page.locator('[data-testid="forbidden"]')).toBeVisible();
      });
    }
  });
}

test.describe('arabic', () => {
  for (const id of ['home', 'careers', 'careers-role', 'my', 'admin', 'sign-in', 'speak-up']) {
    test(`ar ${id}`, async ({ page }) => {
      const r = ROUTES.find((x) => x.id === id)!;
      await asPersona(page, id === 'admin' ? 'k-admin' : id === 'my' ? 'k-ro' : null);
      await visit(page, `${BASE}/ar${fill(r) === '/' ? '' : fill(r)}`);
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    });
  }
});

test('sign-in flow: choose a role card, see role nav, sign out', async ({ page }) => {
  await asPersona(page, null);
  await visit(page, `${BASE}/sign-in`);
  await page.click('[data-testid="persona-k-licensing-coord"]');
  await page.waitForURL(/\/kafaa\/my$/);
  await expect(page.locator('[data-testid="side-nav"]')).toContainText('Licensing candidates');
  await page.click('[data-testid="account-menu"]');
  await page.click('[data-testid="sign-out"]');
  await expect(page.locator('[data-testid="sign-in-link"]')).toBeVisible();
});

test('opening a URL never signs anyone in (B-01)', async ({ page }) => {
  await asPersona(page, null);
  await visit(page, `${BASE}/my?persona=k-admin&as=k-admin`);
  await expect(page.locator('[data-testid="signin-required"]')).toBeVisible();
});

test('speak-up sends no telemetry', async ({ page }) => {
  const posts: string[] = [];
  page.on('request', (r) => {
    if (r.method() !== 'GET') posts.push(r.url());
  });
  await asPersona(page, 'k-ro');
  await visit(page, `${BASE}/speak-up`);
  await expect(page.locator('[data-testid="dalil-launcher"]')).toHaveCount(0);
  expect(posts).toEqual([]);
  const audit = await page.evaluate(() => localStorage.getItem('kafaa.local.v1') ?? '');
  expect(audit.includes('speak-up')).toBe(false);
});
