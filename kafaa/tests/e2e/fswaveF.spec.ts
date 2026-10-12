/**
 * FS wave F journeys (FS50-FS59, "workforce strategy and analytics": the critical future-skills register, three-scenario forecasting bands,
 * automation in the skills outlook, external benchmark lines kept apart from measured numbers, the skills council and change tracker,
 * engine cards / ontology datasheet / model-risk template, skill-change effectiveness, curriculum coverage and the gap backlog, adaptive
 * problem-solving practice and the role-play library), plus the wave-F cross-feature wiring.
 * Backend: LOCAL. The live project could not be reached from the wave-F QA session (no demo password, no Supabase access), so every
 * journey runs on the in-browser local backend, which implements the same rules as the SQL (proved in PGlite by fs61..fs65 and fsqa6).
 * Run in supabase mode again after the live apply (docs/kafaa/ref/live_apply/waveF). Every acceptance criterion of the ten cards is
 * exercised in the browser.
 *  F1 FS50/FS51 strategy   F2 FS52/FS53 outlook   F3 FS54/FS55 governance   F4 FS56/FS57 learning effect and coverage
 *  F5 FS58/FS59 practice   F6 cross-feature wiring, chips, Arabic
 */
import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { BASE, pinBackend, settle, textIssues, watchErrors } from './helpers';
import { FEATURE_BENCHMARKS } from '../../src/domain/taxonomy';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables as Record<string, any[]>;
const W = { timeout: 60_000 };

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

test('F1 FS50/FS51: the register computes progress (suppressed under 10), every row has an owner and a rationale, the quarterly review is recorded once; every forecast number is SIMULATED with a definitions link, a reset reproduces the baseline, suppressed skills carry no numbers', async ({ page }) => {
  test.setTimeout(15 * 60_000);
  const w = watchErrors(page);
  await asLocal(page, 'chco');
  await go(page, '/workforce/critical-skills');
  await chips(page, 'FS50');
  await openChip(page, FEATURE_BENCHMARKS.FS50[0]);
  const reg = tid(page, 'm35-cs-register');
  await expect(reg.locator('[data-testid="m35-cs-link"]').first()).toBeVisible(W);
  expect(await reg.locator('[data-testid="m35-cs-link"]').count()).toBeGreaterThanOrEqual(10);
  const statuses = await reg.locator('[data-testid="m35-progress-status"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-status')));
  expect(statuses).toContain('suppressed');
  expect(statuses.some((s) => s === 'met' || s === 'on_track')).toBe(true);
  // a suppressed progress cell shows no number
  for (const t of await reg.locator('[data-testid="m35-progress-status"][data-status="suppressed"]').allInnerTexts()) expect(t.replace(/<\s*10/g, '')).not.toMatch(/\d/);
  const att = await page.locator('[data-testid="m35-cs-attention-item"]').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-score'))));
  expect(att.length).toBeGreaterThan(0);
  expect([...att].sort((a, b) => b - a)).toEqual(att);
  await clean(page, w);
  // a register row: owner, decision with its rationale, computed progress, KPIs; record this quarter's review (once)
  const row = T.critical_skills.find((r) => r.id === 'cs-sk-hu-01');
  await go(page, '/workforce/critical-skills/cs-sk-hu-01');
  const d = tid(page, 'm35-csd');
  await expect(d).toBeVisible(W);
  await expect(tid(page, 'm35-csd-decision')).toContainText(row.rationale_en.slice(0, 60));
  await expect(tid(page, 'm35-csd-progress')).not.toHaveAttribute('data-status', '');
  expect(await tid(page, 'm35-csd-kpis').locator('[data-kind]').count()).toBeGreaterThan(0);
  expect(row.owner_function).toBeTruthy();
  const reviews0 = await tid(page, 'm35-csd-reviews').locator('li, tr').count();
  await tid(page, 'm35-csd-review').click();
  const form = tid(page, 'm35-csd-review-form');
  await expect(form).toBeVisible();
  await expect(tid(page, 'm35-csd-review-problem')).toBeVisible();
  await form.getByLabel('Note (English)').fill('Quarter review: steady progress, keep the build route.');
  await form.getByLabel('Note (Arabic)').fill('مراجعة ربعية: تقدم ثابت، نواصل مسار البناء.');
  await expect(tid(page, 'm35-csd-review-problem')).toHaveCount(0);
  await confirm(page);
  await expect(tid(page, 'm35-csd-review-form')).toHaveCount(0, W);
  await expect.poll(async () => tid(page, 'm35-csd-reviews').locator('li, tr').count(), W).toBeGreaterThan(reviews0);
  await clean(page, w);
  // FS51 workbench (training manager): SIMULATED labels and the definitions link; a what-if moves the band, reset reproduces the baseline
  await asLocal(page, 'training-mgr');
  await go(page, '/workforce/skill-forecasts');
  await chips(page, 'FS51');
  await expect(tid(page, 'm35-fc-tiles')).toBeVisible(W);
  await expect(tid(page, 'm35-fc-baseline')).toBeVisible();
  expect(await page.locator('[data-testid="m35-sim-labels"]').count()).toBeGreaterThan(0);
  expect(await page.locator('[data-testid="m35-definitions-link"]').first().getAttribute('href')).toContain('/workforce/skill-forecasts/method#definitions');
  const supp = tid(page, 'm35-fc-suppressed');
  expect(await supp.locator('[data-suppressed="true"]').count()).toBeGreaterThan(0);
  expect((await supp.innerText()).replace(/<\s*10/g, '')).not.toMatch(/\d/);
  const tile0 = await tid(page, 'm35-fc-tile-baseline').innerText();
  await tid(page, 'm35-param-attrition_pct').getByRole('slider').fill('9');
  await expect(tid(page, 'm35-fc-baseline')).toHaveCount(0, W);
  await expect.poll(async () => tid(page, 'm35-fc-tile-baseline').innerText(), W).not.toBe(tile0);
  await tid(page, 'm35-fc-reset').click();
  await expect(tid(page, 'm35-fc-baseline')).toBeVisible(W);
  await expect.poll(async () => tid(page, 'm35-fc-tile-baseline').innerText(), W).toBe(tile0);
  // the skill detail, versions (methodology change blocks the comparison), generations and the method page: SIMULATED everywhere
  await go(page, '/workforce/skill-forecasts/skills/sk-fs-ai-verify');
  await expect(page.locator('[data-testid="m35-fan-chart"]').first()).toBeVisible(W);
  for (const sc of ['baseline', 'advance', 'accelerated']) await expect(tid(page, `m35-fcd-why-${sc}`)).toBeVisible();
  expect(await page.locator('[data-testid="m35-definitions-link"]').count()).toBeGreaterThan(0);
  await go(page, '/workforce/skill-forecasts/versions');
  await expect(tid(page, 'm35-ver-blocked')).toHaveAttribute('data-blockers', /catalogue/, W);
  await go(page, '/workforce/skill-forecasts/generations');
  await expect(tid(page, 'm35-gen-life')).toContainText('2084', W);
  await go(page, '/workforce/skill-forecasts/method');
  await expect(page.locator('#definitions')).toBeVisible(W);
  await expect(page.locator('#not-modelled')).toBeAttached();
  await clean(page, w);
  // never public, no staff grant
  await asLocal(page, 'k-ro');
  await go(page, '/workforce/critical-skills');
  await expect(tid(page, 'm35-cs')).toHaveCount(0);
  w.take();
});

test('F2 FS52/FS53: adoption 0 equals today\'s outlook and the automation assumption is in the tornado with its range; market statistics are dashed, sourced and dated, measured values solid and SIMULATED, never summed; held figures show no value', async ({ page }) => {
  test.setTimeout(12 * 60_000);
  const w = watchErrors(page);
  await asLocal(page, 'chco');
  await go(page, '/workforce/skills-outlook');
  const tor = tid(page, 'm07-so-tornado');
  await expect(tor).toBeVisible(W);
  const bar = tid(page, 'm07-so-tornado-automation_adoption');
  await expect(bar).toContainText('AI and automation adoption', W);
  await expect(bar).toContainText('0%');
  await expect(bar).toContainText('60%');
  const card = tid(page, 'm07-au-card');
  await expect(card).toBeVisible(W);
  await expect(card.getByTestId('benchmark-chips')).toBeVisible();
  await card.locator('[data-testid="m07-au-why-operations"]').click();
  await expect(tid(page, 'm07-au-why-operations-panel')).toBeVisible();
  await chips(page, 'FS52');
  // adoption 0 = the outlook before the slider; 50 % narrows it; back to 0 gives the identical tiles
  const tiles = tid(page, 'm07-so-tiles');
  await expect(tiles).not.toHaveClass(/opacity-70/, W);
  const before = await tiles.innerText();
  await tid(page, 'm07-au-preset-50').click();
  await expect.poll(async () => tid(page, 'm07-so-tiles').innerText(), W).not.toBe(before);
  await expect(tid(page, 'm07-so-drivers')).toContainText('AI and automation', W);
  await tid(page, 'm07-au-preset-0').click();
  await expect.poll(async () => tid(page, 'm07-so-tiles').innerText(), W).toBe(before);
  // FS53 market panel
  const panel = tid(page, 'm07-mk-panel-skills_outlook');
  await expect(panel.locator('[data-kind="measured"][data-pattern="solid"]')).toHaveCount(3, W);
  const pairs = panel.locator('[data-testid^="m07-mk-pair-"]');
  await expect(pairs).toHaveCount(3);
  for (let i = 0; i < 3; i++) {
    const p = pairs.nth(i);
    await expect(p.locator('[data-kind="market"][data-pattern="dashed"]')).toHaveCount(1);
    await expect(p).toContainText('Market statistic');
    await expect(p).toContainText('Measured at ENEC (SIMULATED)');
    const link = p.locator('a[href^="https://"]').first();
    await expect(link).toContainText('as of');
    await expect(p.getByTestId('m07-mk-position')).toContainText(/ENEC (above|below|level)/);
  }
  const legend = tid(page, 'm07-mk-legend');
  await expect(legend.locator('[data-pattern="solid"]')).toContainText('Measured at ENEC');
  await expect(legend.locator('[data-pattern="dashed"]')).toContainText('Market statistic');
  const held = tid(page, 'm07-mk-held');
  await expect(held).toContainText('secondary');
  expect(await held.innerText()).not.toMatch(/39%|60%|76,000,000|10,000,000/);
  await chips(page, 'FS53');
  await clean(page, w);
  // a line manager sees the market lines beside the released outlook, without the live workbench
  await asLocal(page, 'sro');
  await go(page, '/workforce');
  const ov = tid(page, 'm07-mk-panel-overview');
  await expect(ov.locator('[data-testid^="m07-mk-pair-"]')).toHaveCount(3, W);
  await expect(ov.getByTestId('m07-mk-pair-ai_task_share')).toContainText('Suppressed');
  await go(page, '/workforce/skills-outlook');
  await expect(tid(page, 'm07-mk-panel-skills_outlook')).toBeVisible(W);
  await expect(tid(page, 'm07-au-card')).toHaveCount(0);
  await clean(page, w);
});

test('F3 FS54/FS55: a staff proposal to retire a skill passes the inclusion rule, two different council members publish it, the skill becomes obsolete and stays in the catalogue, the public log shows it; staleness and orphans drill down; every ranked surface has a card; fairness, datasheet and model-risk template', async ({ page }) => {
  test.setTimeout(15 * 60_000);
  const w = watchErrors(page);
  const open = new Set(T.skill_change_requests.filter((r) => ['submitted', 'first_approved', 'first_rejected'].includes(r.status)).map((r) => r.skill_id));
  const sk = T.skills.find((s) => s.lifecycle !== 'obsolete' && !open.has(s.id) && s.fs_area);
  // propose (staff, skills_taxonomy W)
  await asLocal(page, 'k-ro');
  await go(page, `/skills/changes/propose?skill=${sk.id}&kind=retire`);
  await chips(page, 'FS54');
  await expect(tid(page, 'm16-propose-form')).toBeVisible(W);
  await expect(tid(page, 'm16-propose-submit')).toBeDisabled();
  await page.locator('[name="development"]').fill('Developed by the transition course only; the newer skill replaces it in every pathway.');
  await page.locator('[name="assessment"]').fill('Assessed by an observed walk-through that the newer skill now covers.');
  await page.locator('[name="rationale"]').fill('Superseded: nothing teaches or requires it separately any more.');
  await expect(page.locator('[data-testid="m16-inclusion"]').first()).toHaveAttribute('data-ok', 'true', W);
  await tid(page, 'm16-propose-submit').click();
  await confirm(page);
  await expect(tid(page, 'm16-my-requests')).toContainText(/Waiting for the first council vote/, W);
  await clean(page, w);
  // council: first vote (training manager), second vote (HR director); both confirmed
  for (const persona of ['training-mgr', 'chco']) {
    await asLocal(page, persona);
    await go(page, '/admin/skills-council');
    const req = tid(page, 'm16-council-list').locator('[data-testid="m16-request"]').filter({ hasText: sk.name_en }).first();
    await expect(req).toBeVisible(W);
    await req.getByTestId('m16-request-approve').click();
    await confirm(page);
    await expect(page.locator('[data-testid="confirm-action"]')).toHaveCount(0, W);
  }
  // the skill is obsolete, still in the catalogue; the public change log shows the retirement
  await asLocal(page, null);
  await go(page, `/skills/${sk.id}`);
  await expect(page.locator('main')).toContainText(/obsolete/i, W);
  await go(page, '/skills/changes');
  await tid(page, 'm16-log-kind').selectOption('retire');
  const ch = tid(page, 'm16-change-log').locator('[data-testid="m16-change"]').filter({ hasText: sk.name_en }).first();
  await expect(ch).toBeVisible(W);
  await ch.getByTestId('m16-change-toggle').click();
  await expect(ch.getByTestId('m16-change-detail')).toContainText(/Obsolete/);
  await clean(page, w);
  // staleness and orphan audit with drill-downs (HR director)
  await asLocal(page, 'chco');
  await go(page, '/admin/skills-health');
  await expect(tid(page, 'm16-health-tiles')).toBeVisible(W);
  for (const f of ['overdue', 'orphan', 'untaught']) {
    const chip = tid(page, 'm16-health-filters').locator(`[data-filter="${f}"]`);
    expect(Number(await chip.getAttribute('data-n')), f).toBeGreaterThan(0);
    await chip.click();
    await expect(tid(page, 'm16-health-table')).toHaveAttribute('data-filter', f);
    expect(await tid(page, 'm16-health-table').locator('tbody tr').count(), f).toBeGreaterThan(0);
  }
  await clean(page, w);
  // FS55: every ranked surface has a card (registry tab shows none missing), surface fairness, datasheet, model-risk template
  await asLocal(page, 'k-admin');
  await go(page, '/admin/ai-transparency');
  await expect(page.locator('[data-testid="m16-engine-card"]')).toHaveCount(34, W);
  await page.getByRole('tab', { name: /Ranked surfaces/ }).click();
  await expect(tid(page, 'm16-reg-table')).toHaveAttribute('data-missing', '0', W);
  await page.getByRole('tab', { name: /Surface fairness/ }).click();
  await expect(page.locator('[data-testid="m16-sf-comparison"]').first()).toBeVisible(W);
  expect(await page.locator('[data-testid="m16-sf-comparison"]').count()).toBeGreaterThanOrEqual(9);
  await clean(page, w);
  await asLocal(page, null);
  await go(page, '/skills/datasheet');
  await chips(page, 'FS55');
  await expect(tid(page, 'm16-datasheet')).toHaveAttribute('data-skills', String(T.skills.length), W);
  for (let i = 1; i <= 6; i++) await expect(tid(page, `m16-ds-section-${i}`)).toBeVisible();
  await asLocal(page, 'k-auditor');
  await go(page, '/admin/ai-transparency/model-risk');
  await expect(tid(page, 'm16-mr-status')).toHaveAttribute('data-gateway', 'off', W);
  await tid(page, 'm16-mr-card').selectOption('critical_attention');
  await expect(tid(page, 'm16-mr-sections').locator('[data-field="use.purpose"]')).toContainText(/register/i);
  await clean(page, w);
});

test('F4 FS56/FS57: items under 10 completers show only "suppressed", measured rows state method and 90-day window; coverage reproduces from the rule, every uncovered skill is in the backlog with an owner, a what-if raises the score by exactly the predicted amount and saves nothing until confirmed', async ({ page }) => {
  test.setTimeout(12 * 60_000);
  const w = watchErrors(page);
  const nSupp = T.skill_change_measures.filter((r) => r.verdict === 'suppressed').length;
  await asLocal(page, 'chco');
  await go(page, '/training/skill-change');
  await chips(page, 'FS56');
  const table = tid(page, 'm25-sc-table');
  await expect(table).toBeVisible(W);
  await tid(page, 'm25-sc-verdict-filter').selectOption('suppressed');
  await expect(table.locator('[data-testid^="m25-sc-row-"]')).toHaveCount(nSupp, W);
  await expect(table.locator('[data-testid="m25-sc-net"]')).toHaveCount(0);
  await tid(page, 'm25-sc-verdict-filter').selectOption('moves');
  await expect(table.locator('[data-testid^="m25-sc-row-"]')).toHaveCount(T.skill_change_measures.filter((r) => r.verdict === 'moves').length, W);
  for (const t of await table.locator('[data-testid="m25-sc-method-chip"]').allInnerTexts()) expect(t).toMatch(/comparison|before/i);
  for (const t of await table.locator('[data-testid="m25-sc-window"]').allInnerTexts()) expect(t).toMatch(/90/);
  await table.locator('[data-testid^="m25-sc-row-"]').first().click();
  await expect(tid(page, 'm25-sc-drawer-method')).toContainText('90', W);
  await page.keyboard.press('Escape');
  await clean(page, w);
  // backlog: every row has an owner; six planned decisions
  await go(page, '/training/coverage/backlog');
  await chips(page, 'FS57');
  const gb = tid(page, 'm25-gb-table');
  await expect(gb).toBeVisible(W);
  await tid(page, 'm25-gb-filter-planned').click();
  await expect(gb.locator('[data-testid^="m25-gb-row-"]')).toHaveCount(6, W);
  for (const t of await gb.locator('[data-testid="m25-gb-owner"]').allInnerTexts()) expect(t.trim().length).toBeGreaterThan(0);
  await expect(tid(page, 'm25-gb-sync')).toHaveCount(0);
  await clean(page, w);
  // coverage: what-if (training manager) shows the predicted rise, unsaved; a confirmed decision records it
  await asLocal(page, 'training-mgr');
  await go(page, '/training/coverage');
  await expect(tid(page, 'm25-cov-heat')).toBeVisible(W);
  const card = tid(page, 'm25-cov-whatif');
  await expect(card).toBeVisible(W);
  const total = Number((await card.getByTestId('m25-cov-wi-total').innerText()).replace('+', ''));
  const moves = await card.locator('[data-testid="m25-move"]').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-delta') ?? (e.textContent ?? '').match(/[+-]\d+/)?.[0] ?? 0)));
  expect(total).toBeGreaterThan(0);
  expect(moves.reduce((s, x) => s + x, 0)).toBe(total);
  await expect(card.getByTestId('m25-cov-wi-unsaved')).toBeVisible();
  const picked = await card.getByTestId('m25-cov-wi-skill').inputValue();
  await card.getByTestId('m25-cov-wi-save').click();
  const form = tid(page, 'm25-dec-form');
  await expect(form).toBeVisible(W);
  await form.getByTestId('m25-dec-rationale').fill('Build it with our instructors; two cohorts a year from 2027.');
  await expect(tid(page, 'm25-dec-problem')).toHaveCount(0);
  await tid(page, 'm25-dec-save').click();
  await confirm(page);
  await expect(page.locator('[data-testid="confirm-action"]')).toHaveCount(0, W);
  await go(page, '/training/coverage/backlog');
  await tid(page, 'm25-gb-filter-planned').click();
  await expect(tid(page, 'm25-gb-table').locator(`[data-testid="m25-gb-row-${picked}"]`)).toBeVisible(W); // the confirmed decision is now planned
  const planned = T.gap_backlog.filter((r) => r.status === 'decided').length + (T.gap_backlog.find((r) => r.id === picked)?.status === 'decided' ? 0 : 1);
  await expect(tid(page, 'm25-gb-table').locator('[data-testid^="m25-gb-row-"]')).toHaveCount(planned, W);
  await clean(page, w);
});

test('F5 FS58/FS59: every scenario has a mid-task change revealed only after the plan, results show the benchmark line and the scale and gate nothing; role-play rubrics in EN and AR, a speak-up topic routes to /speak-up and is not stored, feedback history is private, a named reviewer validates it into evidence', async ({ page }) => {
  test.setTimeout(15 * 60_000);
  const w = watchErrors(page);
  const sc = T.aps_scenarios.find((x) => x.id === 'aps-os-001');
  await asLocal(page, 'k-lo-trainee');
  await go(page, '/my/core-skills/problem-solving');
  await chips(page, 'FS58');
  const cards = page.locator('[data-testid="m33-aps-scenario"]');
  await expect(cards).toHaveCount(6, W);
  for (const n of await cards.evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-changes'))))) expect(n).toBeGreaterThanOrEqual(1);
  await cards.filter({ has: page.locator('[data-testid="m33-aps-start"]') }).and(page.locator('[data-id="aps-os-001"]')).getByTestId('m33-aps-start').click();
  for (let i = 0; i < sc.stages.length; i++) {
    const stage = tid(page, 'm33-aps-stage');
    await expect(stage).toHaveAttribute('data-stage', sc.stages[i].id, W);
    await expect(stage).toHaveAttribute('data-kind', i === 0 ? 'initial' : 'change');
    if (i === 0) expect(await page.locator('main').innerText()).not.toContain(sc.stages[1].info_en.slice(0, 40));
    else await expect(tid(page, 'm33-aps-change')).toBeVisible();
    await expect(tid(page, 'm33-aps-key')).toHaveCount(0);
    const best = sc.stages[i].options.findIndex((o: { eff: number }) => o.eff === 3);
    for (const [k, c] of (sc.stages[i].cues ?? []).entries()) if (c.relevant) await tid(page, `m33-aps-cue-${k}`).click();
    await tid(page, `m33-aps-opt-${best}`).click();
    await tid(page, 'm33-aps-submit').click();
    await expect(tid(page, 'm33-aps-key')).toBeVisible(W);
    await expect(tid(page, 'm33-aps-verdict')).toHaveAttribute('data-verdict', '3');
    await tid(page, 'm33-aps-continue').click();
  }
  const res = tid(page, 'm33-aps-result');
  await expect(res).toHaveAttribute('data-score', '100', W);
  await expect(tid(page, 'm33-aps-line').getByTestId('benchmark-line')).toBeVisible();
  await expect(tid(page, 'm33-aps-result-piaac')).toBeVisible();
  await expect(tid(page, 'm33-aps-scale').locator('[data-band="strategic"]')).toHaveAttribute('data-on', 'yes');
  await tid(page, 'm33-aps-why').click();
  await expect(tid(page, 'm33-aps-why-panel')).toContainText(/never a qualification/i);
  await clean(page, w);
  // role-play library: each rubric in English and Arabic
  await asLocal(page, 'nse');
  await go(page, '/learn/role-play');
  await chips(page, 'FS59');
  const rp = page.locator('[data-testid="m33-rp-scenario"]');
  await expect(rp).toHaveCount(6, W);
  await rp.first().getByTestId('m33-rp-open-rubric').click();
  await expect(tid(page, 'm33-rp-rubric-en').locator('[data-criterion]').first()).toBeVisible(W);
  await expect(tid(page, 'm33-rp-rubric-ar')).toHaveAttribute('dir', 'rtl');
  await clean(page, w);
  // a session: a speak-up topic routes to /speak-up and nothing is sent or kept; the example answers meet the rubric
  const rs = T.roleplay_scenarios.find((x) => x.id === 'rp-st-01');
  await asLocal(page, 'qc-inspector');
  await go(page, '/my/role-play/rp-st-01');
  await tid(page, 'm33-rp-start').click();
  const box = tid(page, 'm33-rp-answer');
  await box.fill('Honestly, I want to report that my supervisor told me to falsify the turnover log.');
  await tid(page, 'm33-rp-submit').click();
  await expect(tid(page, 'm33-rp-speakup')).toBeVisible(W);
  expect(await tid(page, 'm33-rp-speakup-link').getAttribute('href')).toMatch(/\/speak-up$/);
  await expect(box).toHaveValue('');
  for (let i = 0; i < rs.turns.length; i++) {
    await expect(tid(page, 'm33-rp-turn')).toHaveAttribute('data-turn', rs.turns[i].id, W);
    await tid(page, 'm33-rp-answer').fill(rs.turns[i].example_en);
    await tid(page, 'm33-rp-submit').click();
    const fb = tid(page, 'm33-rp-feedback');
    await expect(fb).toBeVisible(W);
    expect(await fb.getAttribute('data-passed')).toBe(await fb.getAttribute('data-total'));
    await tid(page, 'm33-rp-continue').click();
  }
  await expect(tid(page, 'm33-rp-result')).toHaveAttribute('data-ready', 'yes', W);
  const stored = await page.evaluate(() => Object.keys(localStorage).map((k) => localStorage.getItem(k) ?? '').join('\n'));
  expect(stored).not.toContain('falsify the turnover');
  await clean(page, w);
  // my history is private: k-ro sees two sessions; the training manager's own history does not list them
  await asLocal(page, 'k-ro');
  await go(page, '/my/role-play?tab=history');
  await expect(tid(page, 'm33-rp-history').locator('tbody tr')).toHaveCount(2, W);
  await asLocal(page, 'training-mgr');
  await go(page, '/my/role-play?tab=history');
  await expect(page.locator('[data-testid="m33-rp-history"] tbody tr')).toHaveCount(T.roleplay_sessions.filter((x) => x.person_id === 'p-training-mgr').length, W);
  // the named reviewer validates a session sent to them: it leaves the queue and becomes rating evidence
  await go(page, '/training/role-play');
  const item = page.locator('[data-testid="m33-rp-queue-item"][data-id="rp-s-0003"]');
  await expect(item).toBeVisible(W);
  await expect(item.getByTestId('m33-rp-queue-rubric')).toBeVisible();
  await item.getByTestId('m33-rp-validate').click();
  await confirm(page);
  await expect(page.locator('[data-testid="m33-rp-queue-item"][data-id="rp-s-0003"]')).toHaveCount(0, W);
  // HR sees aggregates only
  await asLocal(page, 'chco');
  await go(page, '/workforce/core-skills/practice');
  await expect(tid(page, 'm33-wp-aps-tiles')).toBeVisible(W);
  await expect(tid(page, 'm33-wp-bands').locator('li')).toHaveCount(4);
  await clean(page, w);
});

test('F6 wiring: the methodology banner on the outlook and the FS51 pages, one taught-by rule on the health page, cards for the wave-F ranked lists, the passport label for role-play evidence, role-play reviews owed in the digest, chips and Arabic', async ({ page }) => {
  test.setTimeout(12 * 60_000);
  const w = watchErrors(page);
  await asLocal(page, 'chco');
  await go(page, '/workforce/skills-outlook');
  const b1 = page.locator('[data-testid="m16-methodology-banner"][data-dashboard="skills_outlook"]');
  await expect(b1).toBeVisible(W);
  expect(await b1.locator('a').first().getAttribute('href')).toMatch(/\/skills\/changes$/);
  for (const p of ['/workforce/skill-forecasts', '/workforce/skill-forecasts/method']) {
    await go(page, p);
    await expect(page.locator('[data-testid="m16-methodology-banner"][data-dashboard="skill_forecasts"]').first()).toBeVisible(W);
  }
  await go(page, '/admin/skills-health');
  await expect(tid(page, 'm16-taught-by')).toContainText(/external resource/i, W);
  await expect(page.getByRole('columnheader', { name: 'External resource' })).toBeVisible();
  await clean(page, w);
  await asLocal(page, 'k-auditor');
  await go(page, '/admin/ai-transparency');
  for (const id of ['critical_attention', 'outlook_automation', 'aps_next']) {
    const c = page.locator(`[data-testid="m16-engine-card"][data-card="${id}"]`);
    await expect(c).toBeVisible(W);
    await expect(c).toContainText(/ranks|people|never/i);
  }
  await clean(page, w);
  // passport: validated role-play feedback carries its own label
  await asLocal(page, 'k-ro');
  await go(page, '/my/skills');
  const ev = page.locator('[data-testid="m17-evidence-sk-fs-tr-analytical"]');
  if (await ev.count()) {
    await ev.first().click();
    await expect(tid(page, 'm17-evidence-sources')).toContainText('Validated role-play feedback', W);
  } else {
    await go(page, '/my/skills?tab=future');
    await page.locator('[data-testid="m17-evidence-sk-fs-tr-analytical"]').first().click();
    await expect(tid(page, 'm17-evidence-sources')).toContainText('Validated role-play feedback', W);
  }
  await clean(page, w);
  // digest: the named reviewer sees the role-play review owed under approvals
  await asLocal(page, 'training-mgr');
  await go(page, '/my');
  const items = tid(page, 'digest-items');
  await expect(items).toBeVisible(W);
  await expect(items.locator('[data-testid="digest-item"]').filter({ hasText: 'Role-play feedback to review' }).first()).toBeVisible(W);
  expect(await items.locator('a[href*="/training/role-play"]').count()).toBeGreaterThan(0);
  await clean(page, w);
  // Arabic RTL on wave-F pages
  for (const [persona, p] of [['chco', '/ar/workforce/critical-skills'], ['training-mgr', '/ar/training/coverage'], [null, '/ar/skills/changes'], ['nse', '/ar/learn/role-play']] as const) {
    await asLocal(page, persona);
    await go(page, p);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('h1').first()).toHaveText(/[؀-ۿ]/, W);
  }
  await clean(page, w);
});
