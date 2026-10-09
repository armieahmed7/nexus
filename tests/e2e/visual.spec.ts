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
  // wave 1 (F03-F09)
  { name: 'w1-my-skills', path: '/my/skills', persona: 'sro' },
  { name: 'w1-wallet', path: '/my/skills/wallet', persona: 'sro' },
  { name: 'w1-verify-badge', path: '/verify/badge/kb3a512774a081' },
  { name: 'w1-my-career', path: '/my/career', persona: 'qc-inspector' },
  { name: 'w1-roadmap', path: '/my/career/roadmap?role=procurement-engineer', persona: 'qc-inspector' },
  { name: 'w1-my-coach', path: '/my/coach', persona: 'qc-inspector' },
  { name: 'w1-opportunities', path: '/opportunities', persona: 'qc-inspector' },
  { name: 'w1-opportunity', path: '/opportunities/opp-u3-outage-valve-walkdowns', persona: 'qc-inspector' },
  { name: 'w1-my-future', path: '/my/future', persona: 'qc-inspector' },
  { name: 'w1-future-interest', path: '/workforce/future/interest', persona: 'chco' },
  // wave 2 (F10-F17)
  { name: 'w2-checkins', path: '/my/skills/checkins', persona: 'nse' },
  { name: 'w2-validate', path: '/team/skills/validate', persona: 'cpo' },
  { name: 'w2-team-skills', path: '/team/skills', persona: 'sro' },
  { name: 'w2-conversations', path: '/my/career/conversations', persona: 'qc-inspector' },
  { name: 'w2-team-conversations', path: '/team/conversations', persona: 'head-sq' },
  { name: 'w2-mentoring', path: '/my/mentoring', persona: 'qc-inspector' },
  { name: 'w2-mentoring-agreement', path: '/my/mentoring/ma-mr-f13-001', persona: 'qc-inspector' },
  { name: 'w2-refresh', path: '/my/coach/refresh', persona: 'nse' },
  { name: 'w2-rotations', path: '/opportunities/rotations', persona: 'qc-inspector' },
  { name: 'w2-rotation-board', path: '/opportunities/rotations/board', persona: 'chco' },
  { name: 'w2-leadership', path: '/leadership', persona: 'sro' },
  { name: 'w2-leadership-360', path: '/leadership/360', persona: 'sro' },
  { name: 'w2-communities', path: '/communities', persona: 'qc-inspector' },
  { name: 'w2-experts', path: '/communities/experts', persona: 'qc-inspector' },
  // wave 3 (F18-F24)
  { name: 'w3-talent-review', path: '/talent/review', persona: 'chco' },
  { name: 'w3-cycle', path: '/talent/review/trc-2026h2-ops', persona: 'ops-ceo' },
  { name: 'w3-calibration', path: '/talent/review/trc-2026h2-mne/calibration', persona: 'chco' },
  { name: 'w3-succession', path: '/talent/succession', persona: 'chco' },
  { name: 'w3-slate', path: '/talent/succession/ss-shift-supervisor-2026h2', persona: 'chco' },
  { name: 'w3-my-priorities', path: '/my/development-priorities', persona: 'qc-inspector' },
  { name: 'w3-klra', path: '/knowledge/klra', persona: 'training-mgr' },
  { name: 'w3-klra-position', path: '/knowledge/klra/pos-w-sro-02', persona: 'training-mgr' },
  { name: 'w3-knowledge', path: '/knowledge', persona: 'qc-inspector' },
  { name: 'w3-capture', path: '/knowledge/capture', persona: 'training-mgr' },
  { name: 'w3-handover', path: '/workforce/handover', persona: 'chco' },
  { name: 'w3-reserve', path: '/opportunities/reserve', persona: 'qc-inspector' },
  { name: 'w3-reserve-me', path: '/opportunities/reserve/me', persona: 'sme-reviewer' },
  { name: 'w3-reserve-desk', path: '/opportunities/reserve/hr', persona: 'chco' },
  { name: 'w3-ai-transparency', path: '/admin/ai-transparency', persona: 'ai-governance' },
  { name: 'w3-settings-reco', path: '/my/settings', persona: 'nse' },
  // wave 4 (F25-F31)
  { name: 'w4-effectiveness', path: '/training/effectiveness', persona: 'training-mgr' },
  { name: 'w4-effectiveness-course', path: '/training/effectiveness/c-hu', persona: 'training-mgr' },
  { name: 'w4-observations', path: '/training/observations', persona: 'sro' },
  { name: 'w4-my-feedback', path: '/my/learning/feedback', persona: 'sro' },
  { name: 'w4-needs', path: '/training/needs', persona: 'training-mgr' },
  { name: 'w4-sat', path: '/training/sat', persona: 'training-mgr' },
  { name: 'w4-sat-role', path: '/training/sat/roles/local-operator', persona: 'training-mgr' },
  { name: 'w4-sat-task', path: '/training/sat/tasks/jt-qs-ro-t1', persona: 'training-mgr' },
  { name: 'w4-sat-changes', path: '/training/sat/changes', persona: 'training-mgr' },
  { name: 'w4-accreditation', path: '/training/accreditation', persona: 'training-mgr' },
  { name: 'w4-self-eval', path: '/training/accreditation/ase-coit-2026-H2', persona: 'training-mgr' },
  { name: 'w4-scenarios', path: '/training/simulator/scenarios', persona: 'training-mgr' },
  { name: 'w4-scenario', path: '/training/simulator/scenarios/scn-012', persona: 'training-mgr' },
  { name: 'w4-my-simulator', path: '/my/simulator', persona: 'sro' },
  { name: 'w4-my-learning-record', path: '/my/learning-record', persona: 'nse' },
  { name: 'w4-lrs', path: '/training/lrs', persona: 'training-mgr' },
  { name: 'w4-lrs-adapters', path: '/training/lrs/adapters', persona: 'ai-governance' },
  { name: 'w4-instructors', path: '/training/instructors', persona: 'training-mgr' },
  { name: 'w4-instructor-track', path: '/training/instructors/it-w-rp-02', persona: 'training-mgr' },
  { name: 'w4-my-instructor', path: '/my/instructor', persona: 'sme-reviewer' },
  { name: 'w4-team-instructors', path: '/team/instructors', persona: 'chem-sup' },
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
  // wave 1 (F03-F09)
  { name: 'w1-my-skills', path: '/my/skills', persona: 'sro' },
  { name: 'w1-wallet', path: '/my/skills/wallet', persona: 'sro' },
  { name: 'w1-verify-badge', path: '/verify/badge/kb3a512774a081' },
  { name: 'w1-my-career', path: '/my/career', persona: 'qc-inspector' },
  { name: 'w1-roadmap', path: '/my/career/roadmap?role=procurement-engineer', persona: 'qc-inspector' },
  { name: 'w1-my-coach', path: '/my/coach', persona: 'qc-inspector' },
  { name: 'w1-opportunities', path: '/opportunities', persona: 'qc-inspector' },
  { name: 'w1-my-future', path: '/my/future', persona: 'qc-inspector' },
  // wave 2 (F10-F17)
  { name: 'w2-checkins', path: '/my/skills/checkins', persona: 'nse' },
  { name: 'w2-validate', path: '/team/skills/validate', persona: 'cpo' },
  { name: 'w2-team-skills', path: '/team/skills', persona: 'sro' },
  { name: 'w2-conversations', path: '/my/career/conversations', persona: 'qc-inspector' },
  { name: 'w2-mentoring', path: '/my/mentoring', persona: 'qc-inspector' },
  { name: 'w2-refresh', path: '/my/coach/refresh', persona: 'nse' },
  { name: 'w2-rotations-my', path: '/opportunities/rotations/my', persona: 'qc-inspector' },
  { name: 'w2-leadership', path: '/leadership', persona: 'sro' },
  { name: 'w2-communities', path: '/communities/cop-eng', persona: 'qc-inspector' },
  { name: 'w2-sessions', path: '/communities/sessions', persona: 'qc-inspector' },
  { name: 'w2-mentoring-programme', path: '/my/mentoring/programme', persona: 'training-mgr' },
  { name: 'w2-refresher-insights', path: '/training/refreshers', persona: 'training-mgr' },
  { name: 'w2-validate-ops', path: '/team/skills/validate', persona: 'ops-ceo' },
  // wave 3 (F18-F24)
  { name: 'w3-talent-review', path: '/talent/review', persona: 'chco' },
  { name: 'w3-cycle', path: '/talent/review/trc-2026h2-ops', persona: 'ops-ceo' },
  { name: 'w3-calibration', path: '/talent/review/trc-2026h2-mne/calibration', persona: 'chco' },
  { name: 'w3-insights', path: '/talent/review/insights', persona: 'chco' },
  { name: 'w3-succession', path: '/talent/succession', persona: 'chco' },
  { name: 'w3-slate', path: '/talent/succession/ss-shift-supervisor-2026h2', persona: 'chco' },
  { name: 'w3-my-priorities', path: '/my/development-priorities', persona: 'qc-inspector' },
  { name: 'w3-klra', path: '/knowledge/klra', persona: 'training-mgr' },
  { name: 'w3-klra-position', path: '/knowledge/klra/pos-w-sro-02', persona: 'training-mgr' },
  { name: 'w3-knowledge', path: '/knowledge', persona: 'qc-inspector' },
  { name: 'w3-asset', path: '/knowledge/assets/kas-001', persona: 'qc-inspector' },
  { name: 'w3-capture', path: '/knowledge/capture', persona: 'training-mgr' },
  { name: 'w3-session', path: '/knowledge/capture/cs-001', persona: 'training-mgr' },
  { name: 'w3-review', path: '/knowledge/review', persona: 'training-mgr' },
  { name: 'w3-handover', path: '/workforce/handover', persona: 'chco' },
  { name: 'w3-reserve', path: '/opportunities/reserve', persona: 'qc-inspector' },
  { name: 'w3-reserve-me', path: '/opportunities/reserve/me', persona: 'sme-reviewer' },
  { name: 'w3-reserve-request', path: '/opportunities/reserve/request', persona: 'outage-manager' },
  { name: 'w3-reserve-desk', path: '/opportunities/reserve/hr', persona: 'chco' },
  { name: 'w3-ai-transparency', path: '/admin/ai-transparency', persona: 'ai-governance' },
  { name: 'w3-settings-reco', path: '/my/settings', persona: 'nse' },
  // wave 4 (F25-F31): every new route
  { name: 'w4-effectiveness', path: '/training/effectiveness', persona: 'training-mgr' },
  { name: 'w4-effectiveness-course', path: '/training/effectiveness/c-hu', persona: 'training-mgr' },
  { name: 'w4-observations', path: '/training/observations', persona: 'sro' },
  { name: 'w4-my-feedback', path: '/my/learning/feedback', persona: 'sro' },
  { name: 'w4-needs', path: '/training/needs', persona: 'training-mgr' },
  { name: 'w4-sat', path: '/training/sat', persona: 'training-mgr' },
  { name: 'w4-sat-role', path: '/training/sat/roles/local-operator', persona: 'training-mgr' },
  { name: 'w4-sat-task', path: '/training/sat/tasks/jt-qs-ro-t1', persona: 'training-mgr' },
  { name: 'w4-sat-changes', path: '/training/sat/changes', persona: 'training-mgr' },
  { name: 'w4-sat-report', path: '/training/sat/roles/local-operator/report', persona: 'training-mgr' },
  { name: 'w4-sat-survey', path: '/training/sat/survey', persona: 'sme-reviewer' },
  { name: 'w4-accreditation', path: '/training/accreditation', persona: 'training-mgr' },
  { name: 'w4-self-eval', path: '/training/accreditation/ase-coit-2026-H2', persona: 'training-mgr' },
  { name: 'w4-accr-report', path: '/training/accreditation/ase-coit-2026-H1/report', persona: 'presenter' },
  { name: 'w4-scenarios', path: '/training/simulator/scenarios', persona: 'training-mgr' },
  { name: 'w4-scenario', path: '/training/simulator/scenarios/scn-012', persona: 'training-mgr' },
  { name: 'w4-my-simulator', path: '/my/simulator', persona: 'sro' },
  { name: 'w4-my-learning-record', path: '/my/learning-record', persona: 'nse' },
  { name: 'w4-lrs', path: '/training/lrs', persona: 'training-mgr' },
  { name: 'w4-lrs-person', path: '/training/lrs/people/p-sro', persona: 'sro' },
  { name: 'w4-lrs-adapters', path: '/training/lrs/adapters', persona: 'ai-governance' },
  { name: 'w4-lrs-console', path: '/training/lrs/console', persona: 'ai-governance' },
  { name: 'w4-instructors', path: '/training/instructors', persona: 'training-mgr' },
  { name: 'w4-instructor-track', path: '/training/instructors/it-w-rp-02', persona: 'training-mgr' },
  { name: 'w4-my-instructor', path: '/my/instructor', persona: 'sme-reviewer' },
  { name: 'w4-team-instructors', path: '/team/instructors', persona: 'chem-sup' },
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

// Wave 1 feature set (F03-F09): saved to KAFAA_SHOTS_W1.
const SHOTS_W1 = process.env.KAFAA_SHOTS_W1 || 'test-results/shots_w1';
mkdirSync(SHOTS_W1, { recursive: true });
const SET_W1: Shot[] = [
  { name: '01-skills-passport-en', path: '/my/skills', persona: 'sro' },
  { name: '02-credential-wallet-en', path: '/my/skills/wallet', persona: 'sro' },
  { name: '03-verify-badge-public-en', path: '/verify/badge/kb3a512774a081' },
  { name: '04-career-navigator-en', path: '/my/career', persona: 'qc-inspector' },
  { name: '05-career-roadmap-whatif-en', path: '/my/career/roadmap?role=procurement-engineer', persona: 'qc-inspector', then: async (p) => { await p.locator('input[type="range"]').first().fill('2'); } },
  { name: '06-learning-coach-en', path: '/my/coach', persona: 'qc-inspector', then: async (p) => { await p.locator('[data-testid="m19-card"] [data-testid="why-this"]').nth(1).click(); } },
  { name: '07-opportunity-marketplace-en', path: '/opportunities', persona: 'qc-inspector' },
  { name: '08-future-me-en', path: '/my/future', persona: 'qc-inspector' },
  { name: '09-skills-passport-ar', path: '/my/skills', persona: 'sro', ar: true },
  { name: '10-future-me-mobile', path: '/my/future', persona: 'qc-inspector', mobile: true },
];
for (const s of SET_W1) {
  test(`shot w1 ${s.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, s);
    await page.screenshot({ path: join(SHOTS_W1, `${s.name}.png`), fullPage: false });
  });
}

// Wave 2 feature set (F10-F17): saved to KAFAA_SHOTS_W2.
const SHOTS_W2 = process.env.KAFAA_SHOTS_W2 || 'test-results/shots_w2';
mkdirSync(SHOTS_W2, { recursive: true });
const SET_W2: Shot[] = [
  { name: '01-skill-checkins-en', path: '/my/skills/checkins', persona: 'nse' },
  { name: '02-team-heatmap-en', path: '/team/skills', persona: 'sro' },
  { name: '03-career-conversation-en', path: '/team/conversations?person=p-qc-inspector', persona: 'head-sq' },
  { name: '04-mentoring-matches-en', path: '/my/mentoring', persona: 'qc-inspector' },
  { name: '05-knowledge-refresher-en', path: '/my/coach/refresh', persona: 'nse' },
  { name: '06-rotations-en', path: '/opportunities/rotations', persona: 'qc-inspector' },
  { name: '07-leadership-academy-en', path: '/leadership', persona: 'sro' },
  { name: '08-communities-experts-en', path: '/communities/experts', persona: 'qc-inspector' },
  { name: '09-leadership-academy-ar', path: '/leadership', persona: 'sro', ar: true },
  { name: '10-team-heatmap-mobile', path: '/team/skills', persona: 'sro', mobile: true },
];
for (const s of SET_W2) {
  test(`shot w2 ${s.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, s);
    await page.screenshot({ path: join(SHOTS_W2, `${s.name}.png`), fullPage: false });
  });
}

// Wave 3 feature set (F18-F24): saved to KAFAA_SHOTS_W3.
const SHOTS_W3 = process.env.KAFAA_SHOTS_W3 || 'test-results/shots_w3';
mkdirSync(SHOTS_W3, { recursive: true });
const SET_W3: Shot[] = [
  { name: '01-talent-review-board-en', path: '/talent/review/trc-2026h2-ops', persona: 'ops-ceo' },
  { name: '02-succession-slate-en', path: '/talent/succession/ss-shift-supervisor-2026h2', persona: 'chco' },
  { name: '03-knowledge-loss-risk-en', path: '/knowledge/klra', persona: 'training-mgr' },
  { name: '04-knowledge-base-search-en', path: '/knowledge', persona: 'qc-inspector', then: async (p) => { await p.locator('[data-testid="m24-kb-search"]').fill('peer check redundant train'); await p.waitForTimeout(500); } },
  { name: '05-handover-2030-board-en', path: '/workforce/handover', persona: 'chco' },
  { name: '06-expert-reserve-en', path: '/opportunities/reserve/me', persona: 'sme-reviewer' },
  { name: '07-ai-fairness-monitor-en', path: '/admin/ai-transparency', persona: 'ai-governance', then: async (p) => { await p.getByRole('tab', { name: /Fairness monitor/ }).click(); } },
  { name: '08-recommendation-controls-en', path: '/my/settings', persona: 'nse', then: async (p) => { await p.locator('[data-testid="m16-reco-card"]').scrollIntoViewIfNeeded(); } },
  { name: '09-handover-2030-board-ar', path: '/workforce/handover', persona: 'chco', ar: true },
  { name: '10-succession-mobile', path: '/talent/succession', persona: 'chco', mobile: true },
];
for (const s of SET_W3) {
  test(`shot w3 ${s.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, s);
    await page.screenshot({ path: join(SHOTS_W3, `${s.name}.png`), fullPage: false });
  });
}

// Wave 4 feature set (F25-F31): saved to KAFAA_SHOTS_W4.
const SHOTS_W4 = process.env.KAFAA_SHOTS_W4 || 'test-results/shots_w4';
mkdirSync(SHOTS_W4, { recursive: true });
const SET_W4: Shot[] = [
  { name: '01-training-effectiveness-en', path: '/training/effectiveness/c-hu', persona: 'training-mgr' },
  { name: '02-training-needs-forecast-en', path: '/training/needs', persona: 'training-mgr' },
  { name: '03-sat-training-matrix-en', path: '/training/sat/roles/local-operator', persona: 'training-mgr', then: async (p) => { await p.getByRole('tab', { name: /Training matrix/ }).click(); } },
  { name: '04-simulator-coverage-en', path: '/training/simulator/scenarios', persona: 'training-mgr', then: async (p) => { await p.getByRole('tab', { name: /Cycle planner/ }).click(); } },
  { name: '05-accreditation-self-eval-en', path: '/training/accreditation/ase-coit-2026-H2', persona: 'training-mgr' },
  { name: '06-learning-record-store-en', path: '/training/lrs', persona: 'training-mgr' },
  { name: '07-my-learning-record-en', path: '/my/learning-record', persona: 'nse' },
  { name: '08-instructor-pipeline-en', path: '/training/instructors', persona: 'training-mgr' },
  { name: '09-sat-workbench-ar', path: '/training/sat', persona: 'training-mgr', ar: true },
  { name: '10-instructor-track-mobile', path: '/my/instructor', persona: 'sme-reviewer', mobile: true },
];
for (const s of SET_W4) {
  test(`shot w4 ${s.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, s);
    await page.screenshot({ path: join(SHOTS_W4, `${s.name}.png`), fullPage: false });
  });
}
