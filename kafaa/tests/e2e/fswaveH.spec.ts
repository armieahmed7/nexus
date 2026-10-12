/**
 * FS wave H journeys (FS70-FS77, "signals, Emiratisation quality, reach": ENEC Skills on the Rise and the manager pulse, hot technologies,
 * "Skills you may have", the Emirati pipeline by competency, the Future Skills Wallet target, future-skills nudges in the digest, Dalil
 * future-skills mode and the student starter with intake baselines), plus the wave-H wiring.
 * Backend: LOCAL (E2E_BACKEND=local). The live project could not be reached from the wave-H QA session, so every journey runs on the
 * in-browser local backend, which implements the same rules as the SQL (proved in PGlite by fs81..fs85 and fsqa8). Run again in supabase
 * mode after the live apply (docs/kafaa/ref/live_apply/waveH). The browser clock is fixed on the release day (2026-10-12, 09:00 Abu Dhabi).
 *  H1 FS70 rising skills and pulse   H2 FS71 technologies   H3 FS72 suggestions   H4 FS73 Emirati pipeline   H5 FS74 wallet
 *  H6 FS75 digest + FS69 checks owed   H7 FS76 Dalil future mode   H8 FS77 starter and baselines   H9 wiring, entry links, Arabic
 */
import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { BASE, pinBackend, settle, textIssues, watchErrors } from './helpers';
import { FEATURE_BENCHMARKS } from '../../src/domain/taxonomy';
import { brandHits } from '../../src/modules/m28/technologies';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables as Record<string, any[]>;
const W = { timeout: 60_000 };
const DAY = new Date('2026-10-12T05:00:00Z');

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
const tid = (page: Page, id: string) => page.locator(`[data-testid="${id}"]`);
/** Rows of one table as the local backend holds them now (the seed when unchanged). */
async function rows(page: Page, table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = await page.evaluate((t) => { try { return JSON.parse(localStorage.getItem('kafaa.local.v1') ?? '{}').tables?.[t] ?? null; } catch { return null; } }, table) as any[] | null;
  return d ?? T[table];
}

test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(DAY); });

test('H1 FS70: staff see the quarterly list with the signals that moved each skill, signals under 10 suppressed, past quarters kept; the method page is public; HR computes and publishes an ended quarter; managers answer the pulse and HR reads only the aggregate', async ({ page }) => {
  test.setTimeout(12 * 60_000);
  const w = watchErrors(page);
  await asLocal(page, 'k-ro');
  await go(page, '/skills/rising');
  await chips(page, 'FS70');
  await openChip(page, FEATURE_BENCHMARKS.FS70[0]);
  await expect(tid(page, 'm28-rs')).toHaveAttribute('data-quarter', '2026-Q3', W);
  const rowsL = page.locator('[data-testid="m28-rs-row"]');
  expect(await rowsL.count()).toBeGreaterThan(3);
  for (let i = 0; i < await rowsL.count(); i++) {
    await expect(rowsL.nth(i).getByTestId('m28-rs-signal')).toHaveCount(3);
    await expect(rowsL.nth(i).getByTestId('m28-rs-movedby')).toContainText('Moved by:');
  }
  expect(await page.locator('[data-testid="m28-rs-signal"][data-value=""]').count()).toBeGreaterThan(0); // suppressed (< 10)
  await expect(page.locator('[data-testid="m28-rs-signal"][data-value=""]').first()).toContainText(/suppressed/);
  await rowsL.first().getByTestId('m28-rs-why').click();
  await expect(tid(page, 'm28-rs-why-panel')).toBeVisible();
  await tid(page, 'm28-rs-quarters').getByText(/2025 Q4/).click();
  await expect(tid(page, 'm28-rs')).toHaveAttribute('data-quarter', '2025-Q4', W);
  await expect(tid(page, 'm28-rs-published')).toContainText(/2025 Q4 list, published/);
  await clean(page, w);
  // the method page is public
  await asLocal(page, null);
  await go(page, '/skills/rising/method');
  await chips(page, 'FS70');
  await expect(tid(page, 'm28-sm-rules').locator('[data-signal]')).toHaveCount(3);
  await expect(page.locator('main')).toContainText(/under 10 is shown as suppressed/);
  await expect(tid(page, 'm28-sm-question')).toContainText(/by 2030/);
  await clean(page, w);
  // HR computes an ended quarter and publishes it after confirming; the pulse is an aggregate
  await asLocal(page, 'chco');
  await go(page, '/workforce/skill-signals');
  await chips(page, 'FS70');
  await tid(page, 'm28-sw-list').getByLabel('Quarter').selectOption('2025-Q3');
  await tid(page, 'm28-sw-compute').click();
  await expect(tid(page, 'm28-sw-preview')).toHaveAttribute('data-quarter', '2025-Q3', W);
  await tid(page, 'm28-sw-publish').click();
  await confirm(page);
  await expect.poll(async () => (await rows(page, 'skill_signal_runs')).some((r) => r.quarter === '2025-Q3'), W).toBe(true);
  expect((await rows(page, 'skill_signal_runs')).filter((r) => r.quarter === '2026-Q3').length).toBe(1); // a published quarter is kept, never overwritten
  await page.getByRole('tab', { name: 'Manager pulse' }).click();
  await expect(tid(page, 'm28-sw-pulse-summary')).toContainText(/Median/, W);
  await clean(page, w);
  await asLocal(page, 'sro');
  await go(page, '/my/manager-pulse');
  await expect(tid(page, 'm28-mp')).toHaveAttribute('data-open', '1', W);
  await tid(page, 'm28-mp-share').getByRole('spinbutton').fill('40');
  await expect(tid(page, 'm28-mp-band')).toContainText(/40-59%/);
  await tid(page, 'm28-mp-submit').click();
  await confirm(page);
  await expect(tid(page, 'm28-mp-mine')).toContainText(/40%/, W);
  await expect(page.locator('main')).toContainText(/at least 10 managers/);
  await clean(page, w);
});

test('H2 FS71: hot across ENEC separate from in demand for my role, with published criteria; past badge lists kept per quarter; no vendor brand in any tag, and the admin form refuses one before sending', async ({ page }) => {
  test.setTimeout(10 * 60_000);
  const w = watchErrors(page);
  for (const t of T.technologies) expect(brandHits(`${t.name_en} ${t.name_ar} ${t.description_en} ${t.description_ar}`), t.id).toEqual([]);
  await asLocal(page, 'k-ro');
  await go(page, '/skills/technologies');
  await chips(page, 'FS71');
  const hot = tid(page, 'm28-ht-hot').getByTestId('m28-ht-badge');
  await expect(hot.first()).toBeVisible(W);
  expect(await hot.evaluateAll((els) => els.every((e) => e.getAttribute('data-scope') === 'enec'))).toBe(true);
  await expect(hot.first().getByTestId('m28-ht-counts')).toContainText(/sources/);
  await hot.first().getByTestId('m28-ht-why').click();
  await expect(tid(page, 'm28-ht-why-panel')).toContainText(/job families/);
  await expect(tid(page, 'm28-ht-criteria')).toBeVisible();
  if (await tid(page, 'm28-ht-roles').count()) expect(await tid(page, 'm28-ht-roles').getByTestId('m28-ht-badge').evaluateAll((els) => els.every((e) => e.getAttribute('data-scope') === 'role'))).toBe(true);
  await tid(page, 'm28-ht-quarters').getByText(/2026 Q2/).click();
  await expect(tid(page, 'm28-ht')).toHaveAttribute('data-quarter', '2026-Q2', W);
  // past badge lists are kept per quarter: 2026-Q2 published one role badge (reactor operator, k-ro's role) and no ENEC-wide one
  await expect(tid(page, 'm28-ht-roles').getByTestId('m28-ht-badge')).toHaveCount(T.technology_badges.filter((b) => b.quarter === '2026-Q2' && b.role_id === 'reactor-operator').length, W);
  await expect(tid(page, 'm28-ht-hot').getByTestId('m28-ht-badge')).toHaveCount(0);
  await tid(page, 'm28-ht-quarters').getByText(/2026 Q3/).click();
  await expect(tid(page, 'm28-ht-hot').getByTestId('m28-ht-badge')).toHaveCount(T.technology_badges.filter((b) => b.quarter === '2026-Q3' && b.scope === 'enec').length, W);
  await clean(page, w);
  await asLocal(page, 'training-mgr');
  await go(page, '/admin/skills/technologies');
  await chips(page, 'FS71');
  await tid(page, 'm28-hta-new').click();
  const form = tid(page, 'm28-hta-form');
  await form.getByLabel(/^Id/).fill('tech-log-search');
  await form.getByLabel(/Name \(English\)/).fill('Splunk log search');
  await form.getByLabel(/Name \(Arabic\)/).fill('بحث السجلات');
  await form.getByLabel(/Description \(English\)/).fill('Searching plant event logs to find patterns across systems.');
  await form.getByLabel(/Description \(Arabic\)/).fill('البحث في سجلات أحداث المحطة لإيجاد الأنماط عبر الأنظمة.');
  await form.getByLabel(/^Category/).selectOption('analytics');
  await expect(tid(page, 'm28-hta-brand')).toContainText(/splunk/i);
  await tid(page, 'm28-hta-save').click();
  await expect(tid(page, 'confirm-action')).toHaveCount(0);
  await form.getByLabel(/Name \(English\)/).fill('Plant log search');
  await expect(tid(page, 'm28-hta-brand')).toHaveCount(0);
  await tid(page, 'm28-hta-save').click();
  await confirm(page);
  await expect.poll(async () => (await rows(page, 'technologies')).some((r) => r.id === 'tech-log-search'), W).toBe(true);
  await clean(page, w);
});

test('H3 FS72: my suggestions with reasons; confirming makes claimed evidence; a rejection stays hidden for 180 days; a manager sees no one else\'s suggestion; the surface has its engine card', async ({ page }) => {
  test.setTimeout(10 * 60_000);
  const w = watchErrors(page);
  await asLocal(page, 'k-ro');
  await go(page, '/my/skills/suggestions');
  await chips(page, 'FS72');
  const cards = page.locator('[data-testid="m28-ssg-open"] [data-testid="m28-ssg-card"], [data-testid="m28-ssg-card"]');
  await expect(cards.first()).toBeVisible(W);
  expect(await cards.count()).toBeLessThanOrEqual(6);
  // the seeded rejection (k-ro, 2026-08-20) is still hidden today and does not come back as an open card
  const rej = T.skill_suggestions.find((r) => r.person_id === 'p-k-ro' && r.status === 'rejected');
  expect(rej.suppressed_until).toBe('2027-02-16');
  expect(await page.locator(`[data-testid="m28-ssg-card"][data-skill="${rej.skill_id}"]`).count()).toBe(0);
  await expect(tid(page, 'm28-ssg-answered').locator(`[data-skill="${rej.skill_id}"]`)).toHaveAttribute('data-status', 'rejected');
  await cards.first().getByTestId('m28-ssg-why').click();
  await expect(tid(page, 'm28-ssg-why-panel')).toBeVisible();
  const skill = (await cards.first().getAttribute('data-skill'))!;
  await cards.first().getByTestId('m28-ssg-confirm').click();
  await confirm(page);
  await expect.poll(async () => (await rows(page, 'skill_evidence')).some((e) => e.person_id === 'p-k-ro' && e.skill_id === skill && e.ref_table === 'skill_suggestions' && e.basis === 'claimed' && e.kind === 'rating'), W).toBe(true);
  const second = page.locator(`[data-testid="m28-ssg-card"]:not([data-skill="${skill}"])`).first();
  const skill2 = (await second.getAttribute('data-skill'))!;
  await second.getByTestId('m28-ssg-reject').click();
  await expect(page.locator('body')).toContainText(/hidden for 180 days/);
  await confirm(page);
  await expect(tid(page, 'm28-ssg-answered').locator(`[data-skill="${skill2}"]`)).toHaveAttribute('data-status', 'rejected', W);
  await expect.poll(async () => (await rows(page, 'skill_suggestions')).find((r) => r.person_id === 'p-k-ro' && r.skill_id === skill2)?.suppressed_until, W).toBe('2027-04-10'); // 2026-10-12 + 180 days
  await tid(page, 'm28-ssg-refresh').click().catch(() => undefined);
  if (await tid(page, 'confirm-action').count()) await confirm(page);
  await expect.poll(async () => page.locator(`[data-testid="m28-ssg-card"][data-skill="${skill2}"]`).count(), W).toBe(0);
  await clean(page, w);
  // a manager reads only their own suggestions
  await asLocal(page, 'sro');
  await go(page, '/my/skills/suggestions');
  await expect(tid(page, 'm28-ssg')).toBeVisible(W);
  const own = T.skill_suggestions.filter((r) => r.person_id === 'p-sro' && r.status === 'open').length;
  await expect(page.locator('[data-testid="m28-ssg-card"]')).toHaveCount(Math.min(own, 6));
  expect(await page.locator('[data-testid="m28-ssg-card"]').evaluateAll((els) => els.length)).toBeLessThanOrEqual(6);
  // FS55: the engine card of the surface
  await asLocal(page, 'k-auditor');
  await go(page, '/admin/ai-transparency');
  const card = page.locator('[data-testid="m16-engine-card"][data-card="skill_suggestions"]');
  await expect(card).toBeVisible(W);
  await expect(card).toContainText(/Skills you may have/);
  await clean(page, w);
});

test('H4 FS73: the HR director sees Emirati-ready successors, progression and retention by competency area with every cell under 10 suppressed; observers, partners, managers and admins are refused', async ({ page }) => {
  test.setTimeout(10 * 60_000);
  const w = watchErrors(page);
  await asLocal(page, 'chco');
  await go(page, '/national/emirati-pipeline');
  await chips(page, 'FS73');
  await openChip(page, 'NAFIS');
  await expect(tid(page, 'm37-ep-body')).toHaveAttribute('data-scope', 'all', W);
  const areas = page.locator('[data-testid="m37-ep-area"]');
  expect(await areas.count()).toBeGreaterThanOrEqual(5);
  await expect(areas.last()).toHaveAttribute('data-family', 'total');
  expect(await tid(page, 'm37-ep-areas').locator('[data-suppressed="true"]').count()).toBeGreaterThan(5);
  // no shown number is below 10
  const shown = await tid(page, 'm37-ep-areas').locator('[data-n]').evaluateAll((els) => els.map((e) => e.getAttribute('data-n')).filter((x) => x !== null && x !== ''));
  for (const n of shown) expect(Number(n)).toBeGreaterThanOrEqual(10);
  await areas.first().getByTestId('m37-ep-why').click();
  await expect(tid(page, 'm37-ep-why-panel')).toContainText(/critical or future roles/);
  await expect(tid(page, 'm37-ep-retention')).toHaveAttribute('data-simulated', 'true');
  await expect(tid(page, 'm37-ep-not-authority')).toContainText(/not issue/);
  await expect(tid(page, 'm37-ep-agg')).toContainText(/never enters any score/);
  await tid(page, 'm37-ep-scope-future').click();
  await expect(tid(page, 'm37-ep-body')).toHaveAttribute('data-scope', 'future', W);
  await clean(page, w);
  for (const p of ['k-hr-analyst', 'k-auditor']) {
    await asLocal(page, p);
    await go(page, '/national/emirati-pipeline');
    await expect(tid(page, 'm37-ep-body')).toBeVisible(W);
  }
  for (const p of ['k-observer', 'alnoor-gm', 'alnoor-qaqc', 'sro', 'k-admin', 'training-mgr']) {
    await asLocal(page, p);
    await go(page, '/national/emirati-pipeline');
    await expect(tid(page, 'forbidden'), p).toBeVisible(W);
    await expect(tid(page, 'm37-ep')).toHaveCount(0);
  }
  await clean(page, w);
});

test('H5 FS74: my wallet is computed from evidence with next steps and links to my plan; the counter shows its definition, target date and who set it when; the HR director sets a new target after confirming; FS62 tags the target', async ({ page }) => {
  test.setTimeout(12 * 60_000);
  const w = watchErrors(page);
  await asLocal(page, 'k-ro');
  await go(page, '/my/future-wallet');
  await chips(page, 'FS74');
  const items = page.locator('[data-testid="m37-fw-item"]');
  await expect(items).toHaveCount(5, W);
  expect(await items.evaluateAll((els) => els.map((e) => e.getAttribute('data-key')))).toEqual(['ai_rung2', 'cyber_hygiene', 'plant_data', 'core_skill', 'cec_l1']);
  const open = page.locator('[data-testid="m37-fw-item"][data-met="false"]');
  for (let i = 0; i < await open.count(); i++) await expect(open.nth(i).getByTestId('m37-fw-next')).toBeVisible();
  await expect(items.nth(2).getByTestId('m37-fw-in-plan')).toContainText(/in progress/);
  await expect(tid(page, 'm37-fw-target-value')).toContainText(/60/);
  await expect(tid(page, 'm37-fw-target-who')).toContainText(/Chief Human Capital Officer \(role card\)/);
  await items.first().getByTestId('m37-fw-why').click();
  await expect(tid(page, 'm37-fw-why-panel')).toContainText(/self-ratings never/);
  await clean(page, w);
  // a person with open items adds them to their plan after confirming
  await asLocal(page, 'k-lo-trainee');
  await go(page, '/my/future-wallet');
  await expect(items).toHaveCount(5, W);
  const before = await tid(page, 'm37-fw-in-plan').count();
  await tid(page, 'm37-fw-add-plan').click();
  await page.getByRole('dialog').getByRole('button', { name: /confirm/i }).click();
  await expect.poll(async () => tid(page, 'm37-fw-in-plan').count(), W).toBeGreaterThan(before);
  await expect(tid(page, 'm37-fw-add-plan')).toBeDisabled();
  const added = (await tid(page, 'm37-fw-in-plan').count()) - before;
  await expect.poll(async () => (await rows(page, 'plan_activities')).filter((a) => String(a.id).startsWith('pa-fs74-p-k-lo-trainee-')).length, W).toBe(added);
  await clean(page, w);
  // the counter (HR director): definition, date, who/when; set a new target after confirming
  await asLocal(page, 'chco');
  await go(page, '/national/future-wallet');
  await chips(page, 'FS74');
  await expect(tid(page, 'm37-fwc-definition').locator('li')).toHaveCount(5, W);
  await expect(tid(page, 'm37-fwc-tiles')).toContainText(/2027/);
  await expect(tid(page, 'm37-fw-target-who')).toContainText(/Set by .*role card/);
  await expect(tid(page, 'm37-fwc-suppressed')).toBeVisible(); // fewer than 10 hold all five today
  await page.getByLabel(/Share of staff/).fill('65');
  await page.getByLabel(/Note \(English\)/).fill('Leadership raised the demo target.');
  await page.getByLabel(/Note \(Arabic\)/).fill('رفعت القيادة هدف العرض التوضيحي.');
  await tid(page, 'm37-fwc-save').click();
  await page.getByRole('dialog').getByRole('button', { name: /confirm/i }).click();
  await expect(tid(page, 'm37-fw-target')).toHaveAttribute('data-version', '2', W);
  await expect(tid(page, 'm37-fwc-history').locator('tbody tr')).toHaveCount(1);
  await clean(page, w);
  // the HR analyst reads the counter, cannot set it
  await asLocal(page, 'k-hr-analyst');
  await go(page, '/national/future-wallet');
  await expect(tid(page, 'm37-fwc')).toBeVisible(W);
  await expect(tid(page, 'm37-fwc-set')).toHaveCount(0);
  // FS62: the wallet target is tagged to Jahiz and links to the counter
  await asLocal(page, 'chco');
  await go(page, '/national/alignment/nt-jahiz');
  await expect(page.locator('[data-testid="m37-item-link"][href$="/national/future-wallet"]').first()).toBeVisible(W);
  await clean(page, w);
});

test('H6 FS75 + FS69: the release-day digest holds at most 7 items with future-skills nudges, each with a deep link and a why in EN and AR; it is built once per period; nothing on speak-up; the evaluator who opened a pre-arrival share owes its check', async ({ page }) => {
  test.setTimeout(12 * 60_000);
  const w = watchErrors(page);
  await asLocal(page, 'k-ro');
  await go(page, '/my');
  const list = tid(page, 'digest-items');
  await expect(list).toBeVisible(W);
  const items = list.getByTestId('digest-item');
  expect(await items.count()).toBeLessThanOrEqual(7);
  const fut = list.locator('[data-testid="digest-item"][data-kind="future"]');
  expect(await fut.count()).toBeGreaterThan(0);
  for (let i = 0; i < await fut.count(); i++) {
    expect(await fut.nth(i).getByTestId('digest-link').getAttribute('href')).toMatch(/^\/kafaa\/[a-z]/);
    await fut.nth(i).getByTestId('digest-why').click();
    await expect(fut.nth(i).getByTestId('digest-why-panel')).not.toContainText('digest.why.');
  }
  const strip = tid(page, 'digest-future');
  await expect(strip.getByTestId('benchmark-chips')).toBeVisible();
  const runs1 = (await rows(page, 'digest_runs')).filter((r) => r.person_id === 'p-k-ro' && r.period === '2026-W42');
  expect(runs1.length).toBe(1);
  await page.reload(); await settle(page);
  await expect(list).toBeVisible(W);
  expect((await rows(page, 'digest_runs')).filter((r) => r.person_id === 'p-k-ro' && r.period === '2026-W42').length).toBe(1); // idempotent per period
  await clean(page, w);
  // Arabic
  await go(page, '/ar/my');
  const futAr = tid(page, 'digest-items').locator('[data-testid="digest-item"][data-kind="future"]');
  await expect(futAr.first()).toBeVisible(W);
  await expect(futAr.first()).toContainText(/[؀-ۿ]/);
  expect(await futAr.first().getByTestId('digest-link').getAttribute('href')).toMatch(/\/kafaa\/ar\//);
  await futAr.first().getByTestId('digest-why').click();
  await expect(futAr.first().getByTestId('digest-why-panel')).toContainText(/[؀-ۿ]{4}/);
  // no nudge on speak-up routes (EN and AR)
  for (const p of ['/speak-up', '/ar/speak-up']) {
    await go(page, p);
    await expect(tid(page, 'digest-panel')).toHaveCount(0);
    await expect(tid(page, 'digest-future')).toHaveCount(0);
  }
  await clean(page, w);
  // FS69: the training manager opened two shares on contractors' behalf and owes their checks (dated by mobilisation)
  await asLocal(page, 'training-mgr');
  await go(page, '/my');
  const owed = tid(page, 'digest-items').locator('[data-testid="digest-item"][data-kind="approval"]').filter({ hasText: 'Pre-arrival check to run' });
  await expect(owed.first()).toBeVisible(W);
  const href = (await owed.first().getByTestId('digest-link').getAttribute('href'))!;
  expect(href).toMatch(/^\/kafaa\/training\/equivalency\/prearrival\/pa-(calnoor01-mech|cdhafra04-rp)$/);
  await owed.first().getByTestId('digest-why').click();
  await expect(owed.first().getByTestId('digest-why-panel')).toContainText(/on a contractor's behalf/);
  const contractor = T.people.find((p) => p.id === T.prearrival_shares.find((x) => href.endsWith(x.id)).person_id);
  if (contractor?.display_name) await expect(owed.first()).not.toContainText(contractor.display_name);
  await owed.first().getByTestId('digest-link').click();
  await expect(page).toHaveURL(/\/training\/equivalency\/prearrival\/pa-/);
  await settle(page);
  await clean(page, w);
  // settings: "Future skills" is a kind I can mute
  await asLocal(page, 'k-ro');
  await go(page, '/my/settings');
  const card = tid(page, 'digest-settings');
  await expect(card).toBeVisible(W);
  await expect(card.getByTestId('digest-kinds').getByLabel(/^Future skills/)).toBeEnabled();
  await clean(page, w);
});

test('H7 FS76: future-skills mode answers the four intents with citations; anonymous questions get public content with no personal data; security questions decline; the AI owner switches an intent off with a reason; the release gate runs the future set', async ({ page }) => {
  test.setTimeout(15 * 60_000);
  const w = watchErrors(page);
  const ask = async (q: string) => {
    const n = await page.locator('[data-testid="m13-answer"]').count();
    await tid(page, 'm13-input').fill(q);
    await expect(tid(page, 'm13-send')).toBeEnabled(W);
    await tid(page, 'm13-send').click();
    await expect.poll(async () => page.locator('[data-testid="m13-answer"]').count(), W).toBeGreaterThan(n);
    return page.locator('[data-testid="m13-answer"]').last();
  };
  await asLocal(page, null);
  await go(page, '/ask?mode=future');
  await expect(tid(page, 'm13-future-banner')).toHaveAttribute('data-personal', 'false', W);
  await chips(page, 'FS76');
  await expect(tid(page, 'm13-future-intents').getByTestId('m13-future-intent')).toHaveCount(4);
  let a = await ask('How will the senior reactor operator role change by 2030?');
  await expect(a).toHaveAttribute('data-intent', 'future.role_2030.public');
  expect(await a.getByTestId('m13-citations').innerHTML()).toContain('/careers/roles/senior-reactor-operator/transformation');
  expect(await a.getByTestId('m13-citations').innerHTML()).not.toContain('/my/');
  await expect(a).toContainText(/no deployment decision/);
  a = await ask('Which AI rung do the guards who patrol the perimeter need?');
  await expect(a).toHaveAttribute('data-refused', /security/);
  a = await ask('What is the ESCO equivalent of digital twin validation?');
  await expect(a).toHaveAttribute('data-intent', /future\.skill_crosswalk/);
  expect(await a.getByTestId('m13-citations').innerHTML()).toContain('/skills/');
  await clean(page, w);
  // staff: personal answers from my own records
  await asLocal(page, 'k-ro');
  await go(page, '/ask?mode=future');
  await expect(tid(page, 'm13-future-banner')).toHaveAttribute('data-personal', 'true', W);
  a = await ask('Which AI rung do I need?');
  await expect(a).toHaveAttribute('data-intent', 'future.ai_rung.personal');
  expect(await a.getByTestId('m13-citations').innerHTML()).toContain('/my/ai-fluency');
  a = await ask('How will my role change by 2030?');
  await expect(a).toHaveAttribute('data-intent', /future\.role_2030/);
  a = await ask('Which pathway closes my gap?');
  await expect(a).toHaveAttribute('data-intent', /future\.pathway_gap/);
  a = await ask('How will the plant security arrangements change by 2030?');
  await expect(a).toHaveAttribute('data-refused', /security/);
  // QA_B: a concept role asked about directly reads FS15
  await go(page, '/ask?mode=career');
  a = await ask('What do I need to become a digital twin engineer?');
  await expect(a).toHaveAttribute('data-intent', 'career.concept_gap');
  await clean(page, w);
  // the AI owner switches an intent off with a reason
  await asLocal(page, 'ai-governance');
  await go(page, '/admin/dalil');
  await page.getByRole('tab', { name: /Future skills/ }).click();
  const rung = tid(page, 'm13-intent-list').locator('[data-testid="m13-intent"][data-intent="future.ai_rung"]');
  await rung.getByTestId('m13-intent-toggle').click();
  await expect(tid(page, 'confirm-action')).toBeDisabled();
  await page.getByLabel(/Reason/).fill('Ladder targets under review this week');
  await confirm(page);
  await expect(rung).toHaveAttribute('data-enabled', 'false', W);
  await clean(page, w);
  // the release gate runs F14, F37 and the FS76 set
  await asLocal(page, 'k-admin');
  await go(page, '/admin/dalil');
  await page.getByRole('tab', { name: /Evaluation/ }).click();
  await tid(page, 'm13-eval-run').click();
  await expect(tid(page, 'm13-eval-future')).toContainText(/Future skills mode/, { timeout: 180_000 });
  await expect(tid(page, 'm13-eval-result')).toContainText(/pass/i);
  await clean(page, w);
});

test('H8 FS77: the public starter cites every fact with a source and as-of date and stores nothing for an anonymous visitor; the joiner\'s induction plan reads their intake-year baseline; HR rebuilds stale plans and publishes a baseline', async ({ page }) => {
  test.setTimeout(12 * 60_000);
  const w = watchErrors(page);
  await asLocal(page, null);
  const writes: string[] = [];
  page.on('request', (r) => { if (r.method() !== 'GET' && r.method() !== 'HEAD') writes.push(`${r.method()} ${r.url()}`); });
  await go(page, '/pathways/journey/starter');
  await chips(page, 'FS77');
  await expect(page.locator('[data-testid="m06-starter-lesson"]')).toHaveCount(8, W);
  for (const src of await page.locator('[data-testid="m06-starter-source"]').all()) {
    expect(await src.locator('a').first().getAttribute('href')).toMatch(/^https:\/\//);
    await expect(src).toContainText(/as of/);
  }
  expect(await page.locator('[data-testid="m06-starter-source"][data-secondary="true"]').count()).toBeGreaterThan(0);
  await expect(page.locator('main')).toContainText(/No deployment decision is implied/);
  const store0 = await page.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)])));
  for (const l of T.starter_lessons) await tid(page, `m06-starter-opt-${l.id}-${l.self_check.correct}`).click();
  await tid(page, 'm06-starter-prog-gdp').click();
  await expect(tid(page, 'm06-starter-progress-ai')).toContainText(/5 of 5/);
  await expect(tid(page, 'm06-starter-save')).toHaveCount(0);
  const store1 = await page.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)])));
  expect(store1).toBe(store0); // anonymous use stores nothing
  expect(writes).toEqual([]); // and sends nothing
  await clean(page, w);
  // the joiner's plan reads the baseline of their intake year
  await asLocal(page, 'k-lo-trainee');
  await go(page, '/my/induction');
  await chips(page, 'FS77');
  const mine = T.induction_plans.find((p) => p.person_id === 'p-k-lo-trainee');
  await expect(tid(page, 'm06-myind-baseline')).toContainText(mine.baseline_id, W);
  await expect(tid(page, 'm06-myind-plan').getByTestId('m06-plan-item')).toHaveCount(12);
  await expect(tid(page, 'm06-myind-stale')).toHaveCount(0);
  await clean(page, w);
  // HR: rebuild the stale plan, then publish the 2027 draft (six 2027 plans become stale); mandatory modules are locked
  await asLocal(page, 'k-hr-analyst');
  await go(page, '/workforce/intake-baselines');
  await expect(tid(page, 'm06-ibw-stale-count')).toHaveText('1', W);
  await page.getByRole('tab', { name: /Induction plans/ }).click();
  await expect(tid(page, 'm06-ibw-plan-state-w-lo-10')).toContainText(/To rebuild/, W);
  await tid(page, 'm06-ibw-plan-rebuild-w-lo-10').click();
  await page.getByRole('button', { name: 'Rebuild' }).last().click();
  await expect(tid(page, 'm06-ibw-stale-count')).toHaveText('0', W);
  await page.getByRole('tab', { name: /Baselines/ }).click();
  await tid(page, 'm06-ibw-edit-2027-all').click();
  const ed = tid(page, 'm06-ibw-editor');
  await expect(ed.getByTestId('m06-ibw-locked-ind-safety-culture')).toBeVisible(W);
  await ed.getByTestId('m06-ibw-publish').click();
  await page.getByRole('button', { name: 'Publish' }).last().click();
  await expect(tid(page, 'm06-ibw-stale-count')).toHaveText('6', W);
  await clean(page, w);
});

test('H9 wiring: Dalil future mode, the wallet and the starter are linked from the pages that hand off to them; FS70 lists drive the rising-skill nudge; Arabic RTL on the wave-H pages', async ({ page }) => {
  test.setTimeout(12 * 60_000);
  const w = watchErrors(page);
  await asLocal(page, 'k-ro');
  await go(page, '/my/role-2030');
  const ask = tid(page, 'm30-ask-dalil');
  expect(await ask.getAttribute('href')).toMatch(/\/kafaa\/ask\?mode=future&q=How%20will%20my%20role%20change%20by%202030%3F$/);
  await ask.click();
  await expect(page).toHaveURL(/\/ask\?mode=future/);
  await expect(tid(page, 'm13-future-banner')).toHaveAttribute('data-personal', 'true', W);
  await go(page, '/my/ai-fluency');
  expect(await tid(page, 'm29-my-to-wallet').getAttribute('href')).toMatch(/\/kafaa\/my\/future-wallet$/);
  expect(await tid(page, 'm29-my-ask-dalil').getAttribute('href')).toMatch(/\/kafaa\/ask\?mode=future&q=/);
  await go(page, '/my/plan');
  await tid(page, 'm04-plan-to-wallet').click();
  await expect(tid(page, 'm37-fw')).toBeVisible(W);
  await go(page, '/my/pathways');
  expect(await tid(page, 'm19-pw-ask-dalil').getAttribute('href')).toMatch(/q=Which%20pathway%20closes%20my%20gap%3F$/);
  await go(page, '/skills/sk-fs-ai-use');
  expect(await tid(page, 'm28-skill-ask-dalil').getAttribute('href')).toMatch(/\/kafaa\/ask\?mode=future&q=What%20is%20the%20ESCO%20equivalent%20of%20/);
  await clean(page, w);
  await asLocal(page, null);
  await go(page, '/learn/ai-fluency');
  await tid(page, 'm29-lad-to-starter').click();
  await expect(page.locator('[data-testid="m06-starter-lesson"]')).toHaveCount(8, W);
  await clean(page, w);
  // FS70 -> FS75: the rising-skill nudge points at a skill on the published 2026-Q3 list
  const growing = new Set(T.skill_signals.filter((s) => s.quarter === '2026-Q3' && s.category === 'growing').map((s) => s.skill_id));
  await asLocal(page, 'nse'); // p-nse: an ops-family growing skill on the 2026-Q3 list, held below level 2
  await go(page, '/my');
  const rising = tid(page, 'digest-items').locator('[data-testid="digest-item"][data-kind="future"]').filter({ hasText: 'Rising at ENEC' });
  await expect(rising.first()).toBeVisible(W);
  const h = (await rising.first().getByTestId('digest-link').getAttribute('href'))!;
  expect(growing.has(h.split('/').pop()!), h).toBe(true);
  await rising.first().getByTestId('digest-why').click();
  await expect(rising.first().getByTestId('digest-why-panel')).toContainText(/2026-Q3|2026 Q3/);
  await clean(page, w);
  // Arabic RTL on wave-H pages
  for (const [persona, p] of [['k-ro', '/ar/skills/rising'], ['k-ro', '/ar/skills/technologies'], ['k-ro', '/ar/my/skills/suggestions'], ['chco', '/ar/national/emirati-pipeline'], ['k-ro', '/ar/my/future-wallet'],
    ['chco', '/ar/national/future-wallet'], [null, '/ar/ask?mode=future'], [null, '/ar/pathways/journey/starter'], ['k-lo-trainee', '/ar/my/induction'], ['k-hr-analyst', '/ar/workforce/intake-baselines']] as const) {
    await asLocal(page, persona);
    await go(page, p);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('h1').first()).toHaveText(/[؀-ۿ]/, W);
  }
  await clean(page, w);
});
