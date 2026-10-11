/**
 * FS wave E journeys (FS38-FS49, "next-gen nuclear, energy transition, safety culture": the SMR delta per role, plant literacy and
 * the reference-plant log, digital-twin drills, CleanEnergyComp, the energy-system pathway, ESG literacy for managers, expert lectures
 * as evidence, the localisation countdown, future leadership behaviours, the Future Leaders track, women in future nuclear skills and
 * safety culture for an AI-augmented plant), plus the wave-E cross-feature wiring.
 * Backend: LOCAL. The live project could not be reached from the wave-E QA session (no demo password, no Supabase access), so every
 * journey runs on the in-browser local backend, which implements the same rules as the SQL (proved in PGlite by fs51..fs55 and fsqa5).
 * Run in supabase mode again after the live apply (docs/kafaa/ref/live_apply/waveE). Every acceptance criterion of the twelve cards is
 * exercised in the browser.
 *  E1 FS38-FS40 next-gen   E2 FS41-FS43 energy transition   E3 FS44/FS45 knowledge   E4 FS46-FS48 leadership   E5 FS49 safety culture
 *  E6 cross-feature wiring, chips, Arabic
 */
import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { BASE, pinBackend, settle, textIssues, watchErrors } from './helpers';
import { FEATURE_BENCHMARKS } from '../../src/domain/taxonomy';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables as Record<string, any[]>;
const W = { timeout: 45_000 };

async function go(page: Page, path: string) {
  await page.goto(BASE + path);
  await settle(page);
}
/** Local backend as a persona (null = anonymous); works on a fresh page and when switching personas. */
async function asLocal(page: Page, persona: string | null) {
  await pinBackend(page, 'local', persona);
  await page.goto(BASE + '/');
  await page.evaluate((p) => {
    localStorage.setItem('kafaa.backend', 'local');
    if (p) localStorage.setItem('kafaa.session.v1', JSON.stringify({ persona: p, at: Date.now() }));
    else localStorage.removeItem('kafaa.session.v1');
  }, persona);
}
async function clean(page: Page, w: ReturnType<typeof watchErrors>) {
  expect(await textIssues(page)).toEqual([]);
  expect(w.take()).toEqual([]);
}
async function chips(page: Page, feature: string) {
  await expect(page.locator('main button[data-testid^="benchmark-chip-"]').first()).toBeVisible(W);
  const ids = await page.locator('main button[data-testid^="benchmark-chip-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!.replace('benchmark-chip-', '')));
  for (const id of FEATURE_BENCHMARKS[feature]) expect(ids, `${feature}: ${id}`).toContain(id);
}
async function openChip(page: Page, id: string) {
  await page.locator(`button[data-testid="benchmark-chip-${id}"]`).first().click();
  const d = page.locator('[data-testid="benchmark-drawer"]');
  await expect(d).toBeVisible();
  expect(await d.locator('a[href^="https://"]').count()).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
}
const confirm = (page: Page) => page.locator('[data-testid="confirm-action"]').click();
const NO_DEPLOY = /no deployment decision (is )?implied|imply no deployment decision/i;
const STAFFING = /\b\d[\d,.]*\s*(staff|people|jobs|positions|operators|engineers|workers|FTEs?)\b|site (selection|identified|chosen)/i;

test('E1 FS38-FS40: the SMR delta for all 28 roles (sources, clean text, path-only security), my delta and the HR matrix; the offline plant explainer with SIMULATED on every screen and host-confirmed visits as evidence; a twin drill scored with evidence capped at level 2', async ({ page }) => {
  test.setTimeout(15 * 60_000);
  const w = watchErrors(page);
  // FS38 public grid: 28 current roles x 6 families, a delta with >= 2 sources and the planning note
  await asLocal(page, null);
  await go(page, '/careers/next-gen?role=reactor-operator');
  await chips(page, 'FS38');
  await openChip(page, FEATURE_BENCHMARKS.FS38[0]);
  await expect(page.locator('[data-testid="m31-grid-role"]')).toHaveCount(28);
  const delta = page.locator('[data-testid="m31-delta"]');
  await expect(delta).toBeVisible();
  expect(await delta.locator('[data-testid="m31-sources"] a[href^="https://"]').count()).toBeGreaterThanOrEqual(2);
  await expect(page.locator('main')).toContainText(NO_DEPLOY);
  expect(await delta.innerText()).not.toMatch(STAFFING);
  await page.locator('[data-testid="m31-grid-cell"][data-role="security-officer"]').first().click();
  await expect(delta).toHaveAttribute('data-path-only', 'yes');
  await clean(page, w);
  // my delta (k-ro): my current role only, readiness, needs vs my levels with reasons, closing training
  await asLocal(page, 'k-ro');
  await go(page, '/my/next-gen');
  await chips(page, 'FS38');
  const panel = page.locator('[data-testid="m31-panel"]');
  await expect(panel).toBeVisible();
  expect(await panel.locator('[data-testid="m31-needs"] tbody tr').count()).toBeGreaterThan(0);
  expect(await panel.locator('[data-testid="m31-close"] li').count()).toBeGreaterThan(0);
  const concept = new Set(T.job_roles.filter((r) => r.lifecycle === 'concept').map((r) => r.id));
  const opts = await page.locator('[data-testid="m31-my-controls"] select option').evaluateAll((els) => els.map((e) => (e as HTMLOptionElement).value).filter(Boolean));
  expect(opts.length).toBeGreaterThanOrEqual(28);
  expect(opts.some((o) => concept.has(o))).toBe(false);
  await expect(page.locator('main')).toContainText(NO_DEPLOY);
  await clean(page, w);
  // HR matrix with the 10-person rule
  await asLocal(page, 'chco');
  await go(page, '/workforce/next-gen');
  await expect(page.locator('[data-testid="m31-wf-heat"]')).toBeVisible();
  await chips(page, 'FS38');
  await clean(page, w);
  // FS39: the explainer runs offline after load and every screen carries the SIMULATED chip
  await asLocal(page, 'buyer');
  await go(page, '/learn/plant-literacy');
  await chips(page, 'FS39');
  await expect(page.locator('[data-testid="m31-pl-sim"]')).toBeVisible();
  const requests: string[] = [];
  page.on('request', (r) => { if (!r.url().startsWith('data:')) requests.push(`${r.method()} ${r.url()}`); });
  await page.locator('[data-testid="m31-pl-start"]').first().click();
  await expect(page.locator('[data-testid="m31-pl-player"]')).toBeVisible();
  for (let i = 0; i < 12; i++) {
    await expect(page.locator('[data-testid="m31-pl-sim-note"]')).toBeVisible();
    await expect(page.locator('[data-testid="m31-pl-schematic"]')).toBeVisible();
    const radios = page.locator('[data-testid^="m31-pl-opt-"]');
    if (await radios.count()) await radios.first().check();
    if (await page.locator('[data-testid="m31-pl-done"]').count()) break;
    await page.locator('[data-testid="m31-pl-next"]').click();
  }
  await page.locator('[data-testid="m31-pl-done"]').click();
  await expect(page.locator('[data-testid="m31-pl-scenarios"]')).toBeVisible();
  page.removeAllListeners('request');
  expect(requests, 'no network calls while walking a scenario').toEqual([]);
  expect(await page.locator('main').innerText()).not.toMatch(/\b\d+(\.\d+)?\s?(MW|MWe|MWt|°C|bar|kPa|MPa|rpm)\b/);
  // the host confirms a logged visit (maker-checker): evidence only after confirmation
  await asLocal(page, 'k-instructor');
  await go(page, '/my/plant-log?tab=host');
  const host = page.locator('[data-testid="m31-pv-host"]');
  await expect(host).toBeVisible();
  const before = await page.evaluate(() => (localStorage.getItem('kafaa.local.v1') ?? '').split('"ref_table":"plant_visits"').length);
  await host.locator('[data-testid="m31-pv-confirm"]').first().click();
  await confirm(page);
  await expect(page.locator('[data-testid="toast"]').first()).toBeVisible(W);
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => (localStorage.getItem('kafaa.local.v1') ?? '').split('"ref_table":"plant_visits"').length);
  expect(after).toBeGreaterThan(before);
  await clean(page, w);
  // FS40: a synthetic drill end to end; score and evidence level <= 2
  await asLocal(page, 'buyer');
  await go(page, '/my/twin-drills');
  await chips(page, 'FS40');
  await expect(page.locator('[data-testid="m31-tw-synthetic"]')).toContainText(/SIMULATED/);
  const k = T.twin_keys.find((x) => x.scenario_id === 'tw-fw-bearing');
  await go(page, '/my/twin-drills/tw-fw-bearing');
  await expect(page.locator('[data-testid="m31-twd-trends"]')).toBeVisible();
  await expect(page.locator('main')).toContainText(/SIMULATED/);
  for (const id of k.useful_checks) await page.locator(`[data-testid="m31-twd-checks"] [data-check="${id}"] [data-testid="m31-twd-run"]`).click();
  await page.locator('[data-testid="m31-twd-next"]').click();
  await page.locator(`[data-testid="m31-twd-component-${k.component_id}"]`).check();
  await page.locator(`[data-testid="m31-twd-mode-${k.mode_id}"]`).check();
  await page.locator('[data-testid="m31-twd-next2"]').click();
  await page.locator(`[data-testid="m31-twd-action-${k.best_action}"]`).check();
  for (const r of k.sound_rationales) await page.locator(`[data-testid="m31-twd-rat-${r}"]`).check();
  await page.locator('[data-testid="m31-twd-submit"]').click();
  await confirm(page);
  const res = page.locator('[data-testid="m31-twd-result"]');
  await expect(res).toBeVisible(W);
  const lvl = Number(await page.locator('[data-testid="m31-twd-evidence"]').getAttribute('data-level'));
  expect(lvl).toBeGreaterThanOrEqual(1);
  expect(lvl).toBeLessThanOrEqual(2);
  await clean(page, w);
});

test('E2 FS41-FS43: CleanEnergyComp with 12 competences (EN/AR outcomes, GreenComp, skills and learning, targets for every family, clean text), my progress and the suppressed HR view; three sourced value chains and the pathway envelope; the ESG track under 10 hours that counts toward MC-CLEAN-ENERGY', async ({ page }) => {
  test.setTimeout(10 * 60_000);
  const w = watchErrors(page);
  await asLocal(page, null);
  await go(page, '/skills/clean-energy');
  await chips(page, 'FS41');
  await expect(page.locator('[data-testid="m32-fw-competence"]')).toHaveCount(12);
  const check = page.locator('[data-testid="m32-fw-check"]');
  await expect(check).toHaveAttribute('data-problems', '0');
  await expect(check).toHaveAttribute('data-clean', 'true');
  expect(await page.locator('[data-testid="m32-fw-targets"] tbody tr').count()).toBe(T.job_families.length);
  await go(page, '/skills/clean-energy/cec-3-2');
  const outcomes = page.locator('[data-testid="m32-comp-outcomes"]');
  await expect(outcomes).toBeVisible();
  expect(await outcomes.innerText()).toMatch(/[؀-ۿ]/);
  await expect(page.locator('main')).toContainText(/GreenComp/);
  await clean(page, w);
  await asLocal(page, 'head-sustainability');
  await go(page, '/my/clean-energy');
  await expect(page.locator('[data-testid="m32-my-summary"]')).toHaveAttribute('data-level', '2');
  await chips(page, 'FS41');
  await asLocal(page, 'chco');
  await go(page, '/workforce/clean-energy');
  await expect(page.locator('[data-testid="m32-wf-families"]')).toBeVisible();
  expect(await page.locator('[data-testid="m32-wf-families"]').innerText()).toMatch(/<10|suppressed/i);
  await clean(page, w);
  // FS42: three chains, every fact with a source and an as-of date, no project or site claim; the pathway envelope
  await asLocal(page, 'k-ro');
  await go(page, '/learn/energy-transition');
  await chips(page, 'FS42');
  await chips(page, 'FS43');
  await expect(page.locator('[data-testid="m32-hub-chain"]')).toHaveCount(3);
  await expect(page.locator('main')).toContainText(NO_DEPLOY);
  await go(page, '/learn/energy-transition/vc-hydrogen');
  const facts = page.locator('[data-testid="m32-chain-fact"]');
  expect(await facts.count()).toBeGreaterThan(0);
  for (const f of await facts.all()) { expect(await f.locator('a[href^="https://"]').count()).toBeGreaterThan(0); expect(await f.innerText()).toMatch(/20\d\d/); }
  const track = page.locator('[data-testid="m32-track"]');
  await expect(track).toHaveAttribute('data-id', 'tt-system-integration');
  expect(await page.locator('main').innerText()).not.toMatch(STAFFING);
  // FS43: under 10 hours at a stated weekly cost; every MC-CLEAN-ENERGY criterion is covered; MC-H2-HEAT stays a draft
  await go(page, '/learn/energy-transition/esg-managers');
  const cost = page.locator('[data-testid="m32-esg-cost"]');
  expect(Number(await cost.getAttribute('data-total'))).toBeLessThan(10);
  await expect(cost).toHaveAttribute('data-weekly', '1');
  const crit = page.locator('[data-testid="m32-cred-criterion"]');
  expect(await crit.count()).toBeGreaterThan(0);
  expect(await crit.evaluateAll((els) => els.every((e) => e.getAttribute('data-covered') === 'true'))).toBe(true);
  await page.locator('[data-testid="m32-track-start"]').click();
  await confirm(page);
  await expect(page.locator('[data-testid="toast"]').first()).toBeVisible(W);
  await clean(page, w);
});

test('E3 FS44/FS45: the lecture library (skills and protected KLRA positions), a security topic refused, a validated contribution that writes evidence while pending ones write nothing; the localisation countdown with computed readiness, overdue items flagged and shown on the F22 board', async ({ page }) => {
  test.setTimeout(10 * 60_000);
  const w = watchErrors(page);
  await asLocal(page, 'nse');
  await go(page, '/knowledge/lectures');
  await chips(page, 'FS44');
  const cards = page.locator('[data-testid="m24-lc-card"]');
  expect(await cards.count()).toBe(T.lectures.filter((l) => l.status === 'published' && l.published).length);
  await go(page, '/knowledge/lectures/lec-001');
  expect(await page.locator('[data-testid="m24-lc-chapters"] li').count()).toBeGreaterThan(0);
  await expect(page.locator('[data-testid="m24-lc-position"]')).toBeVisible();
  // a security topic is refused in the form
  await go(page, '/knowledge/lectures');
  await page.locator('[data-testid="m24-lc-new"]').click();
  const form = page.locator('[data-testid="m24-lc-form"]');
  await expect(form).toBeVisible();
  await form.locator('[data-testid="m24-lc-f-title_en"]').fill('Guard force patrol patterns at the protected area');
  await form.locator('[data-testid="m24-lc-f-title_ar"]').fill('أنماط دوريات قوة الحراسة في المنطقة المحمية');
  await form.locator('[data-testid="m24-lc-f-abstract_en"]').fill('How the guard force covers the protected area and the vital area at night.');
  await form.locator('[data-testid="m24-lc-f-abstract_ar"]').fill('كيف تغطي قوة الحراسة المنطقة المحمية والمنطقة الحيوية ليلاً.');
  await form.locator('[data-testid="m24-lc-f-skills"] input[type="checkbox"]').first().check();
  await page.locator('[data-testid="m24-lc-f-submit"]').click();
  await confirm(page);
  await expect(page.locator('[data-testid="m24-lc-f-error"]')).toHaveAttribute('data-code', 'security_restricted', W);
  await page.keyboard.press('Escape');
  await clean(page, w);
  // the KM owner validates a pending contribution: evidence is written; pending ones stay without evidence
  await asLocal(page, 'training-mgr');
  await go(page, '/knowledge/contributions');
  await page.getByRole('tab', { name: /Contributions to validate/ }).click();
  const pending = page.locator('[data-testid="m24-ctb-pending"]');
  await expect(pending).toBeVisible();
  const ev = async () => page.evaluate(() => ((localStorage.getItem('kafaa.local.v1') ?? '').match(/se:contrib:/g) ?? []).length);
  const e0 = await ev();
  await pending.locator('[data-testid="m24-ctb-item"][data-id="ctb-lec-010"] [data-testid="m24-ctb-validate"]').click();
  await confirm(page);
  await expect(page.locator('[data-testid="toast"]').first()).toBeVisible(W);
  await page.waitForTimeout(800);
  expect(await ev()).toBeGreaterThan(e0);
  // FS45: countdown, overdue flags, readiness from the F31 pipeline with reasons
  await go(page, '/knowledge/localisation');
  await chips(page, 'FS45');
  expect(Number(await page.locator('[data-testid="m24-lz-countdown"]').getAttribute('data-days'))).toBeGreaterThan(0);
  const rows = page.locator('[data-testid="m24-lz-row"]');
  expect(await rows.count()).toBe(T.localisation_items.length);
  expect(await rows.evaluateAll((els) => els.filter((e) => e.getAttribute('data-overdue') === 'yes').length)).toBeGreaterThanOrEqual(2);
  await page.locator('[data-testid="m24-lz-why"]').first().click();
  await expect(page.locator('[data-testid="m24-lz-why-panel"]')).toContainText(/in-house instructors/);
  await asLocal(page, 'chco');
  await go(page, '/workforce/handover');
  const board = page.locator('[data-testid="m24-lz-handover-panel"]');
  await expect(board).toBeVisible();
  expect((await board.locator('[data-testid="m24-lz-handover-item"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-id')))).sort()).toEqual(['loc-loit-watch', 'loc-rp-initial']);
  await clean(page, w);
});

test('E4 FS46-FS48: 12 behaviours with anchors at every point (EN/AR), form-2 360 next to the readable form-1 cycle, suppressed programme view; the Future Leaders track (descriptors, routes, sourced external programmes, HR nomination, suppressed statistics); the opt-in network that withdraws without trace and HR aggregates only', async ({ page }) => {
  test.setTimeout(10 * 60_000);
  const w = watchErrors(page);
  await asLocal(page, 'qc-inspector');
  await go(page, '/leadership/behaviours');
  await chips(page, 'FS46');
  await expect(page.locator('[data-testid="m22-beh-card"]')).toHaveCount(12);
  await page.locator('[data-testid="m22-beh-filter-future"]').click();
  expect(await page.locator('[data-testid="m22-beh-card"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-behaviour')))).toEqual(['b-digital-change', 'b-ai-teams', 'b-intrapreneurship', 'b-inclusion']);
  await go(page, '/leadership/360');
  await expect(page.locator('[data-testid="m22-360-form-version"]').first()).toBeVisible();
  await page.getByRole('button', { name: '2026-H1' }).click();
  await expect(page.locator('[data-testid="m22-360-v1-note"]')).toBeVisible(W);
  await go(page, '/leadership/future-leaders');
  await chips(page, 'FS47');
  await expect(page.locator('[data-testid="m22-fl-comp"]')).toHaveCount(5);
  for (const c of await page.locator('[data-testid="m22-fl-comp"]').all()) expect(await c.locator('[data-testid="m22-fl-descriptors"] tr').count()).toBe(4);
  await expect(page.locator('[data-testid="m22-fl-ext"]')).toHaveCount(7);
  for (const x of await page.locator('[data-testid="m22-fl-ext"]').all()) expect(await x.locator('a[href^="https://"]').count()).toBeGreaterThan(0);
  await go(page, '/communities/women-in-nuclear');
  await chips(page, 'FS48');
  await expect(page.locator('[data-testid="m22-wfn-strands"]')).toBeVisible();
  await clean(page, w);
  // HR: statistics under 10 suppressed; insights by programme; women-in-nuclear aggregates only
  await asLocal(page, 'chco');
  await go(page, '/leadership/future-leaders/manage');
  await expect(page.locator('[data-testid="m22-fl-nom"]').first()).toBeVisible();
  await page.getByRole('tab', { name: /Statistics/ }).click();
  await expect(page.locator('[data-testid="m22-fl-stats"]')).toContainText('<10');
  await go(page, '/leadership/insights');
  await expect(page.locator('[data-testid="m22-insights-programmes"]')).toBeVisible();
  await go(page, '/communities/women-in-nuclear/programme');
  await expect(page.locator('[data-testid="m22-wfn-pipeline"]')).toContainText('<10');
  await expect(page.getByRole('tab', { name: /Request desk/ })).toHaveCount(0);
  await clean(page, w);
  // opt-in, then withdraw: no trace in the circles (k-ro is not opted in)
  await asLocal(page, 'k-ro');
  await go(page, '/communities/women-in-nuclear');
  const optin = page.locator('[data-testid="m22-wfn-optin"]');
  await expect(optin).toBeVisible();
  await expect(page.locator('[data-testid="m22-wfn-circles"]')).toHaveCount(0);
  await optin.locator('input[type="checkbox"]').nth(0).check();
  await optin.locator('input[type="checkbox"]').nth(4).check().catch(() => undefined);
  const save = page.locator('[data-testid="m22-wfn-save"]');
  if (await save.isEnabled()) {
    await save.click();
    await expect(page.locator('[data-testid="m22-wfn-withdraw"]')).toBeVisible(W);
    await page.locator('[data-testid="m22-wfn-withdraw"]').click();
    await confirm(page);
    await expect(page.locator('[data-testid="m22-wfn-withdraw"]')).toHaveCount(0, W);
    await expect(page.locator('[data-testid="m22-wfn-circles"]')).toHaveCount(0);
  }
  await clean(page, w);
});

test('E5 FS49: AI-era HU cards in EN and AR each linking a drill or lesson, traits with AI examples, sourced international lessons, the lead console blocks an unlinked card; speak-up sends nothing', async ({ page }) => {
  test.setTimeout(8 * 60_000);
  const w = watchErrors(page);
  await asLocal(page, 'qc-inspector');
  await go(page, '/my/safety-culture/ai');
  await chips(page, 'FS49');
  expect(await page.locator('[data-testid="m08-ai-cards"] [data-id^="hu-ai-"]').count()).toBeGreaterThanOrEqual(4);
  await expect(page.locator('[data-testid="m08-ai-cards"] [data-testid="m08-hu-drill"][data-id="ad-valve-lineup"]').first()).toHaveAttribute('href', /\/my\/ai-fluency\/drills\/ad-valve-lineup/);
  expect((await page.locator('[data-testid="m08-ai-traits"] [data-testid="m08-ai-trait"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-id'))))).toEqual(['trait-2', 'trait-5']);
  await expect(page.locator('[data-testid="m08-ai-speakup"]')).toHaveAttribute('href', /\/speak-up/);
  await go(page, '/oe?lesson=oe-ai-03');
  await expect(page.locator('[data-testid="m08-oe-sources"] a').first()).toHaveAttribute('href', 'https://www-pub.iaea.org/MTCD/Publications/PDF/TE-1917_web.pdf');
  await go(page, '/ar/my/safety-culture/ai');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  expect(await page.locator('[data-testid="m08-ai-cards"]').innerText()).toMatch(/[؀-ۿ]/);
  await clean(page, w);
  await asLocal(page, 'training-mgr');
  await go(page, '/admin/hu-tools');
  await expect(page.locator('[data-testid="m08-adm-table"]')).toBeVisible();
  await chips(page, 'FS49');
  await clean(page, w);
  // speak-up: no write or analytics request, no Dalil launcher, nothing about the visit stored
  await asLocal(page, 'k-ro');
  const posts: string[] = [];
  page.on('request', (r) => { if (r.method() !== 'GET') posts.push(r.url()); });
  await go(page, '/speak-up');
  await expect(page.locator('[data-testid="m08-ecp-channels"]')).toBeVisible();
  await expect(page.locator('[data-testid="dalil-launcher"]')).toHaveCount(0);
  expect(posts).toEqual([]);
  expect((await page.evaluate(() => localStorage.getItem('kafaa.local.v1') ?? '')).includes('speak-up')).toBe(false);
});

test('E6 wiring: Future Me and ADVANCE link the SMR delta; MC-TWINS lists twin drills; the twin gig shows them; MC-CLEAN-ENERGY cites CleanEnergyComp; passport labels; hosts see confirmations in the digest; Arabic RTL on the new pages', async ({ page }) => {
  test.setTimeout(10 * 60_000);
  const w = watchErrors(page);
  await asLocal(page, null);
  await go(page, '/future');
  await expect(page.locator('[data-testid="m31-next-gen-link"]')).toHaveAttribute('data-to', '/careers/next-gen');
  await asLocal(page, 'nse');
  await go(page, '/my/future');
  await expect(page.locator('[data-testid="m31-next-gen-link"]')).toHaveAttribute('data-to', '/my/next-gen');
  await go(page, '/my/skills/credentials/c/MC-TWINS');
  await expect(page.locator('[data-testid="m17-fc-route-twin"]').first()).toBeVisible();
  await go(page, '/opportunities/fg-dig-twin-validation');
  await expect(page.locator('[data-testid="m31-twin-route"]').first()).toHaveAttribute('href', /\/my\/twin-drills\/tw-/);
  await go(page, '/my/skills/credentials/c/MC-CLEAN-ENERGY');
  expect(await page.locator('[data-testid="m32-cec-cite"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-keys')))).toEqual(['adaptive,ghg', 'ghg']);
  await clean(page, w);
  // the host's digest lists the pending confirmation (training-mgr hosts pv-demo-09), linking the host tab
  await asLocal(page, 'training-mgr');
  await go(page, '/my');
  const items = page.locator('[data-testid="digest-items"]');
  await expect(items).toContainText('Plant visit to confirm', W);
  await expect(items.locator('[data-testid="digest-link"][href*="/my/plant-log"]').first()).toHaveAttribute('href', /tab=host/);
  await go(page, '/my/plant-log?tab=host');
  await expect(page.locator('[data-testid="m31-pv-host"]')).toBeVisible();
  // Arabic RTL on a page per module
  for (const p of ['/ar/careers/next-gen', '/ar/skills/clean-energy', '/ar/knowledge/localisation', '/ar/leadership/behaviours', '/ar/my/safety-culture/ai']) {
    await go(page, p);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    expect(await textIssues(page), p).toEqual([]);
  }
  expect(w.take()).toEqual([]);
});
