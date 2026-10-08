/**
 * (c) Arabic RTL pages, (d) mobile width, and the polished screenshot set. Supabase mode (live data). Screenshots go to
 * KAFAA_SHOTS (default test-results/shots); RTL/mobile captures go to KAFAA_QA_OUT for review by eye.
 */
import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { BASE, OUT, overflowX, pinBackend, settle, signIn, textIssues, watchErrors } from './helpers';

const SHOTS = process.env.KAFAA_SHOTS || 'test-results/shots';
mkdirSync(SHOTS, { recursive: true });
mkdirSync(join(OUT, 'rtl'), { recursive: true });
mkdirSync(join(OUT, 'mobile'), { recursive: true });

type Shot = { name: string; path: string; persona?: string; ar?: boolean; mobile?: boolean; then?: (p: Page) => Promise<void> };

async function open(page: Page, s: Shot) {
  await pinBackend(page, 'supabase');
  if (s.persona) await signIn(page, s.persona);
  if (s.mobile) await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}${s.ar ? '/ar' : ''}${s.path === '/' && s.ar ? '' : s.path}`);
  await settle(page);
  if (s.then) {
    await s.then(page);
    await settle(page);
  }
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}

const ask = async (p: Page) => {
  await p.locator('[data-testid="m13-input"]').fill(p.url().includes('/ar/') ? 'ما هي متطلبات مشغل المفاعل الأول؟' : 'What are the SRO entry requirements?');
  await p.locator('[data-testid="m13-send"]').click();
  await expect(p.locator('[data-testid="m13-answer"]').last()).toBeVisible();
};

const RTL: Shot[] = [
  { name: 'home', path: '/' },
  { name: 'careers', path: '/careers' },
  { name: 'careers-role', path: '/careers/roles/senior-reactor-operator' },
  { name: 'careers-plan', path: '/careers/plan?to=senior-reactor-operator' },
  { name: 'learn', path: '/learn' },
  { name: 'pathways', path: '/pathways' },
  { name: 'ask', path: '/ask', then: ask },
  { name: 'sign-in', path: '/sign-in' },
  { name: 'my', path: '/my', persona: 'sro' },
  { name: 'licensing-validity', path: '/licensing/validity', persona: 'rao' },
  { name: 'workforce', path: '/workforce', persona: 'chco' },
  { name: 'admin', path: '/admin', persona: 'ai-governance' },
  { name: 'partner-onboarding', path: '/partner/onboarding', persona: 'alnoor-gm' },
];
for (const s of RTL) {
  test(`rtl ${s.name}`, async ({ page }) => {
    const w = watchErrors(page);
    await open(page, { ...s, ar: true });
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    expect(await overflowX(page), 'no horizontal scroll').toBeLessThanOrEqual(1);
    expect(await textIssues(page)).toEqual([]);
    // Most visible text is Arabic (Latin allowed for codes, names and numbers).
    const text = await page.locator('main').innerText();
    const ar = (text.match(/[؀-ۿ]/g) ?? []).length;
    const lat = (text.match(/[A-Za-z]/g) ?? []).length;
    expect(ar, `${s.name}: Arabic letters ${ar} vs Latin ${lat}`).toBeGreaterThan(lat);
    await page.screenshot({ path: join(OUT, 'rtl', `${s.name}.png`), fullPage: true });
    expect(w.take()).toEqual([]);
  });
}

const MOBILE: Shot[] = [
  { name: 'home', path: '/' },
  { name: 'careers', path: '/careers' },
  { name: 'careers-role', path: '/careers/roles/reactor-operator' },
  { name: 'ask', path: '/ask', then: ask },
  { name: 'sign-in', path: '/sign-in' },
  { name: 'my', path: '/my', persona: 'nse' },
  { name: 'learn-course', path: '/learn/course/c-hu', persona: 'nse' },
  { name: 'partner-onboarding', path: '/partner/onboarding', persona: 'alnoor-gm' },
  { name: 'licensing-validity', path: '/licensing/validity', persona: 'rao' },
];
for (const s of MOBILE) {
  test(`mobile ${s.name}`, async ({ page }) => {
    const w = watchErrors(page);
    await open(page, { ...s, mobile: true });
    expect(await overflowX(page), `${s.name}: page scrolls sideways at 390 px`).toBeLessThanOrEqual(1);
    expect(await textIssues(page)).toEqual([]);
    await page.screenshot({ path: join(OUT, 'mobile', `${s.name}.png`), fullPage: true });
    expect(w.take()).toEqual([]);
  });
}

const SET: Shot[] = [
  { name: '01-home-en', path: '/' },
  { name: '02-careers-role-en', path: '/careers/roles/senior-reactor-operator' },
  { name: '03-careers-plan-en', path: '/careers/plan?to=senior-reactor-operator' },
  { name: '04-my-dashboard-sro-en', path: '/my', persona: 'sro' },
  { name: '05-team-quals-sro-en', path: '/team/quals', persona: 'sro' },
  { name: '06-licensing-validity-en', path: '/licensing/validity', persona: 'rao' },
  { name: '07-training-schedule-en', path: '/training/schedule', persona: 'training-mgr' },
  { name: '08-workforce-en', path: '/workforce', persona: 'chco' },
  { name: '09-ask-dalil-en', path: '/ask', then: ask },
  { name: '10-partner-onboarding-en', path: '/partner/onboarding', persona: 'gulfhydro-qa' },
  { name: '11-admin-en', path: '/admin', persona: 'ai-governance' },
  { name: '12-home-ar', path: '/', ar: true },
  { name: '13-careers-role-ar', path: '/careers/roles/senior-reactor-operator', ar: true },
  { name: '14-my-dashboard-ar', path: '/my', persona: 'sro', ar: true },
  { name: '15-home-mobile', path: '/', mobile: true },
  { name: '16-ask-dalil-mobile', path: '/ask', mobile: true, then: ask },
];
for (const s of SET) {
  test(`shot ${s.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, s);
    await page.screenshot({ path: join(SHOTS, `${s.name}.png`), fullPage: false });
  });
}
