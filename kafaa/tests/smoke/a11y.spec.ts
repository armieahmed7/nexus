/**
 * Accessibility gate (CONTRACT M15): axe-core (WCAG 2.0/2.1 A + AA rules) on every public route in English at 1280 px and
 * in Arabic (RTL) at 390 px, plus signed-in pages for ten local-backend personas (a sample by default, all with KAFAA_A11Y_FULL=1).
 * Serious and critical violations fail the test; moderate and minor ones are reported as test annotations.
 * Run: npm run build && npx playwright test tests/smoke/a11y.spec.ts   (part of `npm run test:smoke`)
 * Optional: KAFAA_A11Y_OUT=<dir> writes one JSON file per page with every violation found;
 * KAFAA_A11Y_FULL=1 checks every signed-in route in English and Arabic instead of one page per module per persona.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';
import { loadRoutes, fill, guardOf, isPublic, type SmokeRoute } from './routes';
import { grantsFor, type Level, type PlatformRole, type Resource } from '../../src/auth/policy';
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

// Signed-in pages (local backend). Each signed-in route goes to the first persona below whose roles pass its guard
// (together they open all of them). By default the gate checks one page per module per persona (the module's first such
// route, plus the k-ro "my" pages) in English, and every other one in Arabic too; KAFAA_A11Y_FULL=1 checks every
// signed-in route in both directions (about 660 page views, for an occasional full run).
const FULL = !!process.env.KAFAA_A11Y_FULL;
const PERSONAS = ['k-ro', 'training-mgr', 'alnoor-gm', 'k-admin', 'chco', 'k-university', 'k-observer', 'k-licensing-coord', 'k-ecp', 'group-ceo'];
const ROLES = new Map(
  (JSON.parse(readFileSync('src/seed/personas.json', 'utf8')) as { persona: string; roles: PlatformRole[] }[]).map((p) => [p.persona, p.roles]),
);
function opens(r: SmokeRoute, roles: PlatformRole[]) {
  const g = guardOf(r);
  if (!g.anyRole && !g.grant) return true;
  return !!g.anyRole?.some((x) => roles.includes(x as PlatformRole)) || !!g.grant?.levels.some((l) => grantsFor(roles, g.grant!.res as Resource).has(l as Level));
}
const PINNED = new Set(['my', 'my-quals', 'my-licence', 'my-learning', 'my-plan', 'my-assessments']);
const seen = new Set<string>();
const SIGNED_IN = ROUTES.filter((r) => !isPublic(r)).flatMap((r) => {
  const persona = PERSONAS.find((p) => opens(r, ROLES.get(p) ?? []));
  if (!persona) return [];
  const group = `${r.module} ${persona}`;
  const pick = FULL || PINNED.has(r.id) || !seen.has(group);
  seen.add(group);
  return pick ? [{ r, persona }] : [];
});

test.describe('a11y signed-in', () => {
  test('every signed-in route has a persona that opens it', () => {
    expect(ROUTES.filter((r) => !isPublic(r) && !PERSONAS.some((p) => opens(r, ROLES.get(p) ?? []))).map((r) => r.id)).toEqual([]);
  });
  SIGNED_IN.forEach(({ r, persona }, i) => {
    for (const lang of FULL || PINNED.has(r.id) || i % 2 === 0 ? (['en', 'ar'] as const) : (['en'] as const)) {
      test(`a11y ${lang} ${persona} ${r.id}`, async ({ page }) => {
        await asPersona(page, persona);
        await check(page, `${lang}-${persona}-${r.id}`, fill(r), lang);
        await expect(page.locator('[data-testid="forbidden"], [data-testid="signin-required"]')).toHaveCount(0);
      });
    }
  });
});
