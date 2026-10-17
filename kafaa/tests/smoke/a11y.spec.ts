/**
 * Accessibility gate (CONTRACT M15): axe-core (WCAG 2.0/2.1 A + AA rules) on every public route in English at 1280 px and
 * in Arabic (RTL) at 390 px, plus a few signed-in pages for one local-backend persona.
 * Serious and critical violations fail the test; moderate and minor ones are reported as test annotations.
 * Run: npm run build && npx playwright test tests/smoke/a11y.spec.ts   (part of `npm run test:smoke`)
 * Optional: KAFAA_A11Y_OUT=<dir> writes one JSON file per page with every violation found.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';
import { loadRoutes, fill, isPublic } from './routes';
import { BASE, asPersona, visit } from './helpers';

const ROUTES = loadRoutes();
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const BLOCKING = new Set(['serious', 'critical']);
const OUT = process.env.KAFAA_A11Y_OUT;

// The global reduced-motion rule turns transitions off, so contrast is measured on the settled page, not mid-fade.
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const url = (path: string, lang: 'en' | 'ar') => (lang === 'ar' ? `${BASE}/ar${path === '/' ? '' : path}` : BASE + path);

async function check(page: Page, name: string, path: string, lang: 'en' | 'ar') {
  await page.setViewportSize(lang === 'ar' ? { width: 390, height: 844 } : { width: 1280, height: 900 });
  await visit(page, url(path, lang));
  await expect(page.locator('html')).toHaveAttribute('lang', lang);
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  if (OUT) {
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, `${name}.json`), JSON.stringify({ url: url(path, lang), violations }, null, 1));
  }
  const describe = (v: (typeof violations)[number]) =>
    `${v.id} (${v.impact}, ${v.nodes.length}x): ${v.help}\n    ${v.nodes
      .slice(0, 5)
      .map((n) => `${n.target.join(' ')}${n.failureSummary ? ` -- ${n.failureSummary.split('\n').slice(1).join(' ').trim()}` : ''}`)
      .join('\n    ')}`;
  for (const v of violations.filter((x) => !BLOCKING.has(x.impact ?? ''))) test.info().annotations.push({ type: `a11y ${v.impact}`, description: describe(v) });
  const blocking = violations.filter((x) => BLOCKING.has(x.impact ?? ''));
  expect(blocking.map(describe), `serious/critical axe violations on ${url(path, lang)}`).toEqual([]);
}

test.describe('a11y public', () => {
  for (const r of ROUTES.filter(isPublic)) {
    test(`a11y en ${r.id}`, async ({ page }) => {
      await asPersona(page, null);
      await check(page, `en-${r.id}`, fill(r), 'en');
    });
    test(`a11y ar ${r.id}`, async ({ page }) => {
      await asPersona(page, null);
      await check(page, `ar-${r.id}`, fill(r), 'ar');
    });
  }
});

// Signed in as a licensed operator (local backend): the staff home and key "my" pages, both directions.
test.describe('a11y signed-in k-ro', () => {
  for (const id of ['my', 'my-quals', 'my-licence', 'my-learning', 'my-plan', 'my-assessments']) {
    for (const lang of ['en', 'ar'] as const) {
      test(`a11y ${lang} k-ro ${id}`, async ({ page }) => {
        const r = ROUTES.find((x) => x.id === id);
        expect(r, `route ${id}`).toBeTruthy();
        await asPersona(page, 'k-ro');
        await check(page, `${lang}-k-ro-${id}`, fill(r!), lang);
      });
    }
  }
});
