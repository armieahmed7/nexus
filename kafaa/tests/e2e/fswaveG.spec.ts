/**
 * FS wave G journeys (FS60-FS69, "disclosure, national alignment, ecosystem": the ISO 30414 disclosure pack, the skills pilots registry, the
 * national-strategy alignment layer, the MoHRE occupation mapping, the Al Dhafra regional skills plan, the skills pledges ledger, university
 * programme alignment, fellowships, supplier future-skills readiness and the contractor pre-arrival check), plus the wave-G wiring.
 * Backend: LOCAL. The live project could not be reached from the wave-G QA session (no demo password, no Supabase access), so every journey
 * runs on the in-browser local backend, which implements the same rules as the SQL (proved in PGlite by fs71..fs75 and fsqa7). Run again in
 * supabase mode after the live apply (docs/kafaa/ref/live_apply/waveG). Every acceptance criterion of the ten cards is exercised here.
 *  G1 FS60/FS61 disclosure and pilots   G2 FS62/FS63 national alignment   G3 FS64/FS65 regional plan and pledges
 *  G4 FS66/FS67 universities            G5 FS68/FS69 suppliers            G6 cross-feature wiring, chips, Arabic
 */
import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { BASE, pinBackend, settle, textIssues, watchErrors } from './helpers';
import { FEATURE_BENCHMARKS } from '../../src/domain/taxonomy';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables as Record<string, any[]>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const I = (m: string) => JSON.parse(readFileSync(`src/i18n/${m}.en.json`, 'utf8')) as Record<string, any>;
const m35 = I('m35'), m36 = I('m36'), m10 = I('m10');
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
/** Tables the local backend changed since the seed (persisted on their own under kafaa.local.v1). */
const dirty = (page: Page) => page.evaluate(() => { try { return Object.keys(JSON.parse(localStorage.getItem('kafaa.local.v1') ?? '{}').tables ?? {}); } catch { return []; } });
/** Rows of one table as the local backend holds them now (the seed when unchanged). */
async function rows(page: Page, table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = await page.evaluate((t) => { try { return JSON.parse(localStorage.getItem('kafaa.local.v1') ?? '{}').tables?.[t] ?? null; } catch { return null; } }, table) as any[] | null;
  return d ?? T[table];
}

test('G1 FS60/FS61: no metric publishes without a narrative and a second approver, every value is the formula, small cells are suppressed, the pack is SIMULATED; a pilot cannot close without the evaluator, failures stay visible, the adoption rate is computed against the FSC reference', async ({ page }) => {
  test.setTimeout(15 * 60_000);
  const w = watchErrors(page);
  const q3 = T.hc_disclosures.find((d) => d.period === '2026-Q3');
  const line = (id: string) => page.locator(`[data-testid="m35-hc-line"][data-metric="${id}"]`);
  await asLocal(page, 'chco');
  await go(page, '/workforce/disclosure');
  await chips(page, 'FS60');
  await openChip(page, FEATURE_BENCHMARKS.FS60[0]);
  await expect(tid(page, 'm35-hc-disclosure')).toBeVisible(W);
  await expect(page.locator('[data-testid="m35-hc-line"]')).toHaveCount(7);
  // every value = the stored formula result; small cells suppressed (no number)
  for (const m of q3.metric_values.metrics) await expect(line(m.metric_id).getByTestId('m35-hc-value')).toHaveAttribute('data-value', m.value == null ? '' : String(m.value));
  expect(await line('hcm-participation').locator('[data-testid="m35-hc-cell"][data-n=""]').count()).toBeGreaterThan(0);
  // no narrative / own line: blocked with the reason
  await expect(line('hcm-participation').getByTestId('m35-hc-approve')).toHaveAttribute('data-problem', 'no_narrative');
  await expect(line('hcm-critical').getByTestId('m35-hc-approve')).toHaveAttribute('data-problem', 'maker_checker');
  await expect(tid(page, 'm35-hc-materiality')).toContainText('Materiality');
  // a ready line is approved by the HR director after the confirmation
  await line('hcm-active-learners').getByTestId('m35-hc-approve').click();
  await confirm(page);
  await expect(line('hcm-active-learners')).toHaveAttribute('data-state', 'approved', W);
  await clean(page, w);
  // the HR analyst writes the missing narrative (EN and AR); the check guides until it is complete
  await asLocal(page, 'k-hr-analyst');
  await go(page, '/workforce/disclosure');
  await line('hcm-participation').getByTestId('m35-hc-edit').click();
  const ed = tid(page, 'm35-hc-editor');
  await expect(ed.getByTestId('m35-hc-editor-problem')).toHaveAttribute('data-problem', 'narrative');
  await ed.getByLabel(m35.hc.narrativeEn).fill('Corporate functions and senior grades trail the plant in learning this year.');
  await ed.getByLabel(m35.hc.narrativeAr).fill('تتأخر الوظائف المؤسسية والدرجات العليا عن المحطة في التعلّم هذا العام.');
  await ed.getByLabel(m35.hc.varianceEn).fill('No change against the previous published quarter.');
  await ed.getByLabel(m35.hc.varianceAr).fill('لا تغيير مقارنة بالربع المنشور السابق.');
  await expect(ed.getByTestId('m35-hc-editor-problem')).toHaveCount(0, W);
  await clean(page, w);
  // metric library (auditor R) and the print pack: values only for approved lines, SIMULATED
  await asLocal(page, 'k-auditor');
  await go(page, '/workforce/disclosure/metrics');
  await expect(page.locator('[data-testid="m35-hcm-metric"]')).toHaveCount(7, W);
  await go(page, '/workforce/disclosure/2026-Q3/pack');
  await expect(tid(page, 'm35-pack-statement')).toContainText('SIMULATED', W);
  for (const r of await page.locator('[data-testid="m35-pack-row"][data-published="false"]').all()) await expect(r.getByTestId('m35-pack-value')).toHaveText(I('m35').hcp.notPublished);
  expect(await page.locator('[data-testid="m35-pack-row"][data-published="true"]').count()).toBeGreaterThan(0);
  await clean(page, w);
  // staff cannot open the disclosure (never public, never staff)
  await asLocal(page, 'k-ro');
  await go(page, '/workforce/disclosure');
  await expect(page.locator('[data-testid="forbidden"], [data-testid="m14-forbidden"]').first().or(page.getByText(/not allowed|do not have access|No access/i).first())).toBeVisible(W);
  // FS61 staff view: published results only, both failures visible
  await go(page, '/skills/pilots');
  await chips(page, 'FS61');
  const list = tid(page, 'm35-spp-list');
  await expect(list.locator('[data-testid="m35-sp-card"]')).toHaveCount(T.skill_pilots.filter((p) => p.published).length, W);
  await expect(list.locator('[data-testid="m35-sp-failure-visible"]')).toHaveCount(2);
  await tid(page, 'm35-spp-filter-failed').click();
  await expect(tid(page, 'm35-spp-list').locator('[data-testid="m35-sp-card"]')).toHaveCount(2, W);
  await clean(page, w);
  // registry: the adoption rate computed from statuses against the FSC reference read from the benchmark registry
  await asLocal(page, 'training-mgr');
  await go(page, '/workforce/pilots');
  const kpi = tid(page, 'm35-sp-kpi');
  await expect(kpi).toHaveAttribute('data-rate', '75', W);
  const fsc = T.benchmarks.find((x) => x.id === 'FSC').figures.find((f: { key: string }) => f.key === 'adoption_rate').value;
  await expect(kpi).toHaveAttribute('data-reference', String(fsc));
  expect(await tid(page, 'm35-sp-reference').locator('a').first().getAttribute('href')).toMatch(/^https:\/\/fsc-ccf\.ca\//);
  await clean(page, w);
  // a running pilot cannot close without the evaluator; the named evaluator signs off; HR closes it
  await asLocal(page, 'chco');
  await go(page, '/workforce/pilots/sp-adaptive-requal');
  await expect(tid(page, 'm35-spd-close')).toHaveAttribute('data-blocked', 'no_signoff', W);
  await expect(tid(page, 'm35-spd-close')).toBeDisabled();
  await expect(tid(page, 'm35-spd-close-why')).toHaveText(m35.spd.blocked.no_signoff);
  await asLocal(page, 'independent-approver');
  await go(page, '/skills/pilots');
  const form = tid(page, 'm35-sso');
  await expect(form).toHaveAttribute('data-pilot', 'sp-adaptive-requal', W);
  await form.getByLabel(m35.sso.summaryEn).fill('Study time fell by a third with no drop in first-attempt passes.');
  await form.getByLabel(m35.sso.summaryAr).fill('انخفض وقت الدراسة بمقدار الثلث دون تراجع في النجاح من المحاولة الأولى.');
  await form.getByLabel(m35.sso.lessonsEn).fill('Keep the item bank fresh.');
  await form.getByLabel(m35.sso.lessonsAr).fill('إبقاء بنك الأسئلة محدّثاً.');
  await expect(form.getByTestId('m35-sso-problem')).toHaveCount(0, W);
  await form.getByTestId('m35-sso-submit').click();
  await confirm(page);
  await expect(tid(page, 'm35-sso')).toHaveCount(0, W);
  await asLocal(page, 'chco');
  await go(page, '/workforce/pilots/sp-adaptive-requal');
  await expect(tid(page, 'm35-spd-close')).toBeEnabled(W);
  await tid(page, 'm35-spd-close').click();
  await confirm(page);
  await expect(tid(page, 'm35-spd')).toHaveAttribute('data-status', 'closed', W);
  await clean(page, w);
});

test('G2 FS62/FS63: every tag cites a source (secondary ones flagged), reports are filters over the data with no typed totals, tags in EN and AR; no MoHRE code without verification, the not-a-MoHRE statement, the SIMULATED suppressed trend', async ({ page }) => {
  test.setTimeout(12 * 60_000);
  const w = watchErrors(page);
  await asLocal(page, 'chco');
  await go(page, '/national/alignment');
  await chips(page, 'FS62');
  await expect(page.locator('[data-testid="m37-hub-strategy"]')).toHaveCount(6, W);
  expect(await page.locator('[data-testid="m37-source-flag"]').count()).toBeGreaterThanOrEqual(3);
  await expect(tid(page, 'm37-not-gov')).toBeVisible();
  await clean(page, w);
  // a tag: EN and AR side by side, sources with tiers, items linked by data with WhyThis
  await asLocal(page, 'k-hr-analyst');
  await go(page, '/national/alignment/nt-ai-2031');
  await expect(tid(page, 'm37-tag')).toHaveAttribute('data-flagged', 'false', W);
  await expect(tid(page, 'm37-tag-bilingual')).toContainText('الاستراتيجية الوطنية للذكاء الاصطناعي 2031');
  expect(await tid(page, 'm37-sources').locator('a[href^="https://"]').count()).toBeGreaterThan(0);
  await expect(tid(page, 'm37-report')).toHaveAttribute('data-measures', 'true', W);
  await page.locator('[data-testid="m37-why"]').first().click();
  await expect(tid(page, 'm37-why-panel')).toContainText(/Linked by|Derived from the data/);
  await go(page, '/national/alignment/nt-we-uae-2031');
  await expect(tid(page, 'm37-tag')).toHaveAttribute('data-flagged', 'true', W);
  await expect(tid(page, 'm37-source-note')).toBeVisible();
  await clean(page, w);
  // the report builder filters and recomputes; exports what is shown
  await asLocal(page, 'chco');
  await go(page, '/national/report?strategy=net_zero_2050');
  const report = tid(page, 'm37-report');
  await expect(report).toBeVisible(W);
  const all = Number(await report.getAttribute('data-items'));
  expect(all).toBeGreaterThan(10);
  await tid(page, 'filter-bar').getByRole('combobox').nth(2).selectOption('target');
  await expect.poll(async () => Number(await tid(page, 'm37-report').getAttribute('data-items')), W).toBeLessThan(all);
  await expect(tid(page, 'm37-report-computed')).toContainText(/computed from the data/);
  await expect(tid(page, 'm37-export-csv')).toBeVisible();
  // maintenance: a typed total in a summary blocks the save; EN and AR are required
  await go(page, '/admin/national-tags');
  await tid(page, 'm37-admin-new').click();
  const ed = tid(page, 'm37-tag-editor');
  await expect(ed).toHaveAttribute('data-problem', 'code', W);
  const f = (n: string) => ed.locator(`[name="${n}"]`);
  await f('m37-te-code').fill('NES-TEST');
  await f('m37-te-name-en').fill('A test goal');
  await f('m37-te-name-ar').fill('هدف تجريبي');
  await f('m37-te-sum-en').fill('A goal that reaches 610,000 by 2031.');
  await f('m37-te-sum-ar').fill('هدف تجريبي للتحقق من الفحوص المباشرة.');
  await f('m37-te-src-label-0').fill('u.ae NES page');
  await f('m37-te-src-url-0').fill('https://u.ae/about-the-uae');
  await f('m37-te-src-asof-0').fill('2026-10-10');
  await expect(ed).toHaveAttribute('data-problem', 'typed_total', W);
  await expect(tid(page, 'm37-tag-save')).toBeDisabled();
  await f('m37-te-sum-en').fill('A goal added to check the live save checks.');
  await expect(ed).toHaveAttribute('data-problem', '', W);
  await clean(page, w);
  // FS63: 28 roles, every code pending review, the statement, the SIMULATED suppressed trend for HR; staff without the trend
  await asLocal(page, 'k-hr-analyst');
  await go(page, '/national/occupations');
  await chips(page, 'FS63');
  await expect(page.locator('[data-testid="m37-ro-code"]')).toHaveCount(28, W);
  expect(await page.locator('[data-testid="m37-ro-code"]:not([data-status="pending"])').count()).toBe(0);
  await expect(tid(page, 'm37-not-mohre')).toContainText(/does not issue, validate or submit/);
  await expect(tid(page, 'm37-ro-trend')).toHaveAttribute('data-simulated', 'true', W);
  expect(await tid(page, 'm37-ro-trend-table').locator('[data-suppressed="true"]').count()).toBeGreaterThan(0);
  await asLocal(page, 'sro');
  await go(page, '/national/occupations');
  await expect(page.locator('[data-testid="m37-ro-code"]')).toHaveCount(28, W);
  await expect(tid(page, 'm37-ro-trend')).toHaveCount(0);
  await asLocal(page, 'k-admin');
  await go(page, '/national/occupations');
  await expect(page.locator('[data-testid="m37-ro-verify"]')).toHaveCount(28, W);
  await clean(page, w);
});

test('G3 FS64/FS65: only released, suppressed aggregates reach partners, each commitment shows its delivery status, commitments go through the RPC; pledged, started and completed never merge, small counts are suppressed, each pledge names its organisation, area and date', async ({ page }) => {
  test.setTimeout(12 * 60_000);
  const w = watchErrors(page);
  await asLocal(page, 'alnoor-gm');
  await go(page, '/ecosystem/regional-plan');
  await chips(page, 'FS64');
  const rp = tid(page, 'm36-rp');
  await expect(rp).toHaveAttribute('data-release', 'rdr-2025-1', W);
  await expect(rp.getByTestId('m36-demo-labels')).toBeVisible();
  await expect(rp.locator('[data-testid="m36-gap-plan"]')).toHaveCount(T.regional_demand.filter((r) => r.year === 2030).length, W);
  for (const t of await rp.locator('[data-testid="m36-gap-plan"]').allInnerTexts()) expect(t).not.toMatch(/^\s*[1-9]\s*$/);
  // the partner never reads the FS51 forecast itself
  await go(page, '/workforce/skill-forecasts');
  await expect(page.locator('[data-testid="m35-sf-table"], [data-testid="m35-forecasts"]')).toHaveCount(0);
  // own commitments only, each with a delivery status; another organisation's reads as not found
  await go(page, '/ecosystem/regional-plan/commitments');
  const hrefs = await page.locator('[data-testid="m36-commitment-link"]').evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''));
  expect(hrefs.length).toBe(T.provider_commitments.filter((c) => c.org_id === 'org-alnoor').length);
  expect(hrefs.every((h) => h.includes('pc-org-alnoor-'))).toBe(true);
  await expect(page.locator('[data-testid="m36-commit-status"]')).toHaveCount(hrefs.length);
  // a delivery report goes through the RPC (with a confirmation)
  await go(page, '/ecosystem/regional-plan/commitments/pc-org-alnoor-1');
  const d = tid(page, 'm36-cd');
  await expect(d.getByTestId('m36-cd-status')).toBeVisible(W);
  await d.getByTestId('m36-cd-why').click();
  await expect(tid(page, 'm36-cd-why-panel')).toBeVisible();
  const repForm = d.getByTestId('m36-cd-report');
  await repForm.getByLabel(m36.cm.col.enrolled).fill('12');
  await repForm.getByLabel(m36.cm.col.completed).fill('11');
  await expect(repForm.getByTestId('m36-cd-report-submit')).toBeEnabled(W);
  await repForm.getByTestId('m36-cd-report-submit').click();
  await confirm(page);
  await expect.poll(async () => (await rows(page, 'audit_events')).some((a: { action: string }) => /commit/.test(a.action)), W).toBe(true);
  await clean(page, w);
  await asLocal(page, 'gulfhydro-qa');
  await go(page, '/ecosystem/regional-plan/commitments/pc-org-alnoor-1');
  await expect(page.getByText(m36.cd.notFound)).toBeVisible(W);
  await go(page, '/ecosystem/regional-plan/commitments');
  expect((await page.locator('[data-testid="m36-commitment-link"]').evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''))).every((h) => h.includes('pc-org-gulfhydro-'))).toBe(true);
  await clean(page, w);
  // HR director: statuses across providers and the release of a newer released forecast through the RPC
  await asLocal(page, 'chco');
  await go(page, '/ecosystem/regional-plan/commitments');
  const statuses = await page.locator('[data-testid="m36-commit-status"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-status')));
  for (const s of ['on_track', 'at_risk', 'behind', 'withdrawn']) expect(statuses).toContain(s);
  await go(page, '/ecosystem/regional-plan/release');
  const rel = tid(page, 'm36-rel');
  await expect(rel.getByTestId('m36-rel-pending')).toBeVisible(W);
  await rel.getByLabel(m36.rel.noteEn).fill('The 2026 annual refresh for the next intake.');
  await rel.getByLabel(m36.rel.noteAr).fill('التحديث السنوي لعام 2026 للدفعة القادمة.');
  await expect(rel.getByTestId('m36-rel-submit')).toBeEnabled(W);
  await rel.getByTestId('m36-rel-submit').click();
  await confirm(page);
  await expect.poll(async () => (await rows(page, 'regional_demand')).some((r: { release_id: string }) => r.release_id === 'rdr-2026-1'), W).toBe(true);
  expect((await rows(page, 'regional_demand')).every((r: Record<string, number | null>) => ['demand_low', 'demand_high', 'gap_low', 'gap_high', 'gap_plan'].every((k) => r[k] == null || r[k] === 0 || (r[k] as number) >= 10))).toBe(true);
  await clean(page, w);
  // FS65: three separate tiles, suppressed cells, no total
  await asLocal(page, 'nse');
  await go(page, '/ecosystem/pledges');
  await chips(page, 'FS65');
  const tiles = tid(page, 'm36-pl-tiles');
  for (const id of ['m36-tile-pledged', 'm36-tile-started', 'm36-tile-completed']) await expect(tiles.getByTestId(id)).toBeVisible(W);
  await expect(tiles.getByText(/total/i)).toHaveCount(0);
  expect(await tid(page, 'm36-pl-by-area').locator('[data-suppressed="true"]').count()).toBeGreaterThan(0);
  await clean(page, w);
  // partner admin: own pledges, each with organisation, area and date; progress recorded through the RPC
  await asLocal(page, 'alnoor-gm');
  await go(page, '/ecosystem/pledges/register');
  const pr = tid(page, 'm36-pr');
  await expect(pr.locator('[data-testid="m36-pr-open-pledge"]')).toHaveCount(T.pledges.filter((p) => p.org_id === 'org-alnoor').length, W);
  await pr.locator('[data-testid="m36-pr-open-pledge"]').first().click();
  const dr = tid(page, 'm36-pr-drawer');
  await expect(dr.getByTestId('m36-pr-three')).toBeVisible(W);
  const pid = (await dr.getAttribute('data-id'))!;
  const last = T.pledge_progress.filter((x) => x.pledge_id === pid).sort((a, c) => (a.as_of < c.as_of ? 1 : -1))[0];
  const rec = dr.getByTestId('m36-pr-record');
  await rec.getByLabel(m36.pl.started).fill(String((last?.started ?? 0) + 2));
  await rec.getByLabel(m36.pl.completed).fill(String((last?.completed ?? 0) + 1));
  await expect(rec.getByTestId('m36-pr-record-submit')).toBeEnabled(W);
  await rec.getByTestId('m36-pr-record-submit').click();
  await confirm(page);
  await expect.poll(async () => (await rows(page, 'pledge_progress')).length, W).toBe(T.pledge_progress.length + 1);
  await clean(page, w);
});

test('G4 FS66/FS67: evidence only for endorsed programmes, coverage by the FS57 rule, a university sees only its own programmes; completion rate from milestones (suppressed under 10), host project and supervisor role card, award counts only beside the rate', async ({ page }) => {
  test.setTimeout(12 * 60_000);
  const w = watchErrors(page);
  await asLocal(page, 'k-university');
  await go(page, '/partner/university/programmes');
  await chips(page, 'FS66');
  const cards = await tid(page, 'm10-ua-list').locator('[data-testid^="m10-ua-card-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
  expect(cards.sort()).toEqual(T.programme_alignments.filter((p) => p.university_org_id === 'ku').map((p) => `m10-ua-card-${p.id}`).sort());
  await expect(tid(page, 'm10-ua-card-ua-kings-msc-npp')).toHaveCount(0);
  await tid(page, 'm10-ua-new').click();
  await expect(tid(page, 'm10-ua-editor').getByTestId('m10-ua-coverage')).toBeVisible(W);
  await clean(page, w);
  // maker-checker: the submitter sees no decision controls
  await asLocal(page, 'ai-governance');
  await go(page, '/universities/programmes/ua-kings-msc-npp');
  await expect(tid(page, 'm10-ua-own-submission')).toBeVisible(W);
  await expect(tid(page, 'm10-ua-endorse')).toHaveCount(0);
  // the framework owner endorses after the reviewer criteria: evidence is written for the covered graduates only then
  await asLocal(page, 'k-admin');
  await go(page, '/universities/programmes/ua-ku-bsc-nuc');
  const panel = tid(page, 'm10-ua-endorse-panel');
  await expect(tid(page, 'm10-ua-crit-coverage')).toHaveAttribute('data-ok', 'yes', W);
  expect((await rows(page, 'skill_evidence')).filter((e: { ref_table: string }) => e.ref_table === 'programme_alignments').length).toBe(0);
  await expect(panel.getByTestId('m10-ua-endorse')).toBeDisabled();
  for (const k of ['assessment', 'placement', 'accreditation']) await panel.getByLabel(m10.ua.crit[k]).check();
  await panel.getByLabel(m10.ua.detail.note).fill('Assessment, placement and accreditation verified');
  await expect(panel.getByTestId('m10-ua-endorse')).toBeEnabled(W);
  await panel.getByTestId('m10-ua-endorse').click();
  await confirm(page);
  await expect(page.locator('[data-testid="m10-ua-status"]').first()).toHaveAttribute('data-status', 'endorsed', W);
  await expect.poll(async () => (await rows(page, 'skill_evidence')).filter((e: { ref_table: string }) => e.ref_table === 'programme_alignments').length, W).toBeGreaterThan(0);
  const ev = (await rows(page, 'skill_evidence')).filter((e: { ref_table: string }) => e.ref_table === 'programme_alignments');
  expect(ev.every((e: { ref_id: string; basis: string; kind: string }) => e.ref_id === 'ua-ku-bsc-nuc' && e.basis === 'validated' && e.kind === 'credential')).toBe(true);
  await clean(page, w);
  // HR: a graduate of a returned programme waits (no evidence)
  await asLocal(page, 'chco');
  await go(page, '/workforce/graduate-hires');
  const gh = tid(page, 'm10-gh-form');
  const lastYear = `${Number(new Date().toISOString().slice(0, 4)) - 1}-06-30`;
  await gh.getByLabel(m10.ua.gh.person).fill('ap-153');
  await gh.getByLabel(m10.ua.reg.cProgramme).selectOption('ua-adpoly-bsc-est');
  await gh.getByLabel(m10.ua.gh.graduated).fill(lastYear);
  await tid(page, 'm10-gh-record').click();
  await confirm(page);
  await expect.poll(async () => (await rows(page, 'programme_graduates')).find((g: { id: string }) => g.id === 'pg-ua-adpoly-bsc-est-ap-153')?.status, W).toBe('awaiting_endorsement');
  expect((await rows(page, 'skill_evidence')).filter((e: { ref_table: string; ref_id: string }) => e.ref_table === 'programme_alignments' && e.ref_id === 'ua-adpoly-bsc-est').length).toBe(0);
  await clean(page, w);
  // FS67: completion rate first, award counts only beside it, small groups suppressed
  await go(page, '/universities/fellowships');
  await chips(page, 'FS67');
  const head = tid(page, 'm10-fw-headline');
  await expect(head.locator('[data-testid="m10-fw-rate"]').first()).toHaveText(/\d+\s*%/, W);
  for (const p of await page.locator('[data-testid="m10-fw-pair"]').all()) expect(await p.evaluate((el) => [...el.children].map((c) => c.getAttribute('data-testid')))).toEqual(['m10-fw-rate', 'm10-fw-awarded']);
  expect(await page.locator('[data-testid="m10-fw-awarded"]').evaluateAll((els) => els.every((n) => n.closest('[data-testid="m10-fw-pair"]')))).toBe(true);
  const sup = head.locator('[data-testid^="m10-fw-cell-"][data-suppressed="yes"]');
  expect(await sup.count()).toBeGreaterThan(0);
  for (const c of await sup.all()) await expect(c.getByTestId('m10-fw-awarded')).toHaveCount(0);
  await clean(page, w);
  // a fellowship names its host project and supervisor role card; the supervisor signs off the last milestone
  const fw = T.fellowships.find((x) => x.id === 'fw-2024-ap-122');
  const pend = T.fellowship_milestones.find((m) => m.fellowship_id === fw.id && m.status === 'submitted');
  await asLocal(page, 'training-mgr');
  await go(page, '/universities/fellowships/fw-2024-ap-122');
  await expect(tid(page, 'm10-fw-host')).not.toBeEmpty(W);
  await expect(tid(page, 'm10-fw-supervisor')).toHaveText(fw.supervisor_name_en);
  await tid(page, `m10-fw-sign-${pend.n}`).click();
  await confirm(page);
  await expect(tid(page, `m10-fw-ms-status-${pend.n}`)).toHaveAttribute('data-status', 'signed_off', W);
  await expect.poll(async () => (await rows(page, 'fellowships')).find((x: { id: string }) => x.id === fw.id)?.status, W).toBe('completed');
  await clean(page, w);
});

test('G5 FS68/FS69: a partner sees only its own organisation, organisations under 10 are suppressed, suggestions carry F33 reasons; only shared items reach the evaluator, links expire, the pre-check writes no evidence and no qualification status', async ({ page }) => {
  test.setTimeout(12 * 60_000);
  const w = watchErrors(page);
  await asLocal(page, 'alnoor-gm');
  await go(page, '/partner/workforce/future-readiness');
  await chips(page, 'FS68');
  await expect(page.locator('[data-testid="m09-fr-org"]')).toHaveCount(1, W);
  await expect(tid(page, 'm09-fr-org')).toHaveAttribute('data-org', 'org-alnoor');
  await expect(tid(page, 'm09-fr-org').locator('[data-testid="m09-fr-group"]')).toHaveCount(4);
  await page.locator('[data-testid="m09-fr-sug-why"]').first().click();
  await expect(tid(page, 'm09-fr-sug-why-panel')).toContainText(/Evidences|course/, W);
  await clean(page, w);
  await asLocal(page, 'gulfhydro-qa');
  await go(page, '/partner/workforce/future-readiness');
  await expect(page.locator('[data-testid="m09-fr-org"]')).toHaveCount(1, W);
  await expect(tid(page, 'm09-fr-org')).toHaveAttribute('data-org', 'org-gulfhydro');
  await expect(tid(page, 'm09-fr-org')).toHaveAttribute('data-suppressed', 'yes');
  await expect(tid(page, 'm09-fr-org').locator('[data-testid="m09-fr-split"]')).toHaveCount(0);
  await clean(page, w);
  await asLocal(page, 'k-admin');
  await go(page, '/admin/suppliers/future-readiness');
  await expect(page.getByRole('tab')).toHaveCount(3, W);
  await page.getByRole('tab', { name: /Gulf Hydro/ }).click();
  await expect(tid(page, 'm09-fr-suppressed')).toBeVisible(W);
  await clean(page, w);
  // FS69: the contractor creates a share through the consent gates
  await asLocal(page, 'k-contractor');
  await go(page, '/partner/workforce/prearrival');
  await chips(page, 'FS69');
  await expect(page.locator('[data-testid="m09-pa-row"]')).toHaveCount(1, W);
  await tid(page, 'm09-pa-new').click();
  const items = tid(page, 'm09-pa-items');
  await items.getByRole('checkbox').nth(0).check();
  await items.getByRole('checkbox').nth(1).check();
  await page.getByLabel(/^Label/).fill('Unit 4 outage call-out');
  await expect(tid(page, 'm09-pa-preview').getByRole('listitem')).toHaveCount(2);
  await expect(tid(page, 'm09-pa-submit')).toBeDisabled();
  for (const c of await tid(page, 'm09-pa-consents').getByRole('checkbox').all()) await c.check();
  await tid(page, 'm09-pa-submit').click();
  await confirm(page);
  await expect(tid(page, 'm09-pa-created')).toBeVisible(W);
  await clean(page, w);
  // the evaluator sees only the shared items and runs the pre-check: no evidence, no qualification status written
  await asLocal(page, 'k-instructor');
  await go(page, '/training/equivalency/prearrival/pa-calnoor01-mech');
  const shared = tid(page, 'm09-pa-shared');
  await expect(shared).toBeVisible(W);
  const refs = await shared.locator('[data-testid="m09-pa-shared-item"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-ref')));
  const share = T.record_shares.find((s) => s.id === 'rs-pa-calnoor01-mech');
  expect(refs.sort()).toEqual([...share.items].sort());
  const before = await dirty(page);
  await tid(page, 'm09-pa-run').click();
  const res = tid(page, 'm09-pa-result');
  await expect(res.locator('[data-testid="m09-pa-task"]').first()).toBeVisible(W);
  await res.locator('[data-testid="m09-pa-why"]').first().click();
  await expect(tid(page, 'm09-pa-why-panel')).toBeVisible();
  await expect(res).toContainText(/Writes no skill evidence/);
  const after = await dirty(page);
  for (const t of ['skill_evidence', 'person_skills', 'qual_records', 'evaluations', 'equivalency_requests']) expect(after.includes(t) && !before.includes(t), t).toBe(false);
  await clean(page, w);
  // an expired link shows nothing personal
  await asLocal(page, 'k-auditor');
  await go(page, '/training/equivalency/prearrival/pa-cdhafra06-rp');
  await expect(tid(page, 'm09-pa-closed')).toBeVisible(W);
  await expect(tid(page, 'm09-pa-shared')).toHaveCount(0);
  await expect(tid(page, 'm09-pa-run')).toHaveCount(0);
  await clean(page, w);
});

test('G6 wiring: partner and university homes link the regional plan and pledges, endorsement writes recorded evidence at hire, the verify page labels a pre-arrival share, the FS48 mentoring card, chips and Arabic', async ({ page }) => {
  test.setTimeout(12 * 60_000);
  const w = watchErrors(page);
  await asLocal(page, 'alnoor-gm');
  await go(page, '/partner');
  expect(await tid(page, 'm09-home-link-regional').getAttribute('href')).toMatch(/\/ecosystem\/regional-plan$/);
  expect(await tid(page, 'm09-home-link-pledgesRegister').getAttribute('href')).toMatch(/\/ecosystem\/pledges\/register$/);
  await tid(page, 'm09-home-link-regional').click();
  await expect(tid(page, 'm36-rp')).toBeVisible(W);
  await asLocal(page, 'k-university');
  await go(page, '/partner/university');
  expect(await tid(page, 'm10-link-regional').getAttribute('href')).toMatch(/\/ecosystem\/regional-plan$/);
  await tid(page, 'm10-link-pledges').click();
  await expect(tid(page, 'm36-pr')).toBeVisible(W);
  await clean(page, w);
  // FS69 -> FS32: the public verify page labels a pre-arrival share
  const tok = T.record_shares.find((s) => s.id === 'rs-pa-calnoor01-mech').token;
  await asLocal(page, null);
  await go(page, `/verify/record/${tok}`);
  await expect(tid(page, 'm17-lr-verify-purpose')).toContainText(/pre-arrival check/, W);
  await clean(page, w);
  // FS66 -> F01: the endorsement writes validated evidence at hire for the covered graduates, recorded as kind credential (kept by every
  // recompute). The graduates are applicants, who have no passport page; the passport label itself is proved by fsqa7-integration.test.tsx.
  await asLocal(page, 'k-admin');
  await go(page, '/universities/programmes/ua-ku-bsc-nuc');
  const panel = tid(page, 'm10-ua-endorse-panel');
  for (const k of ['assessment', 'placement', 'accreditation']) await panel.getByLabel(m10.ua.crit[k]).check();
  await panel.getByLabel(m10.ua.detail.note).fill('Assessment, placement and accreditation verified');
  await panel.getByTestId('m10-ua-endorse').click();
  await confirm(page);
  await expect(page.locator('[data-testid="m10-ua-status"]').first()).toHaveAttribute('data-status', 'endorsed', W);
  await expect.poll(async () => (await rows(page, 'skill_evidence')).some((e: { ref_table: string; person_id: string }) => e.ref_table === 'programme_alignments' && e.person_id === 'p-k-graduate'), W).toBe(true);
  await asLocal(page, 'chco');
  await go(page, '/workforce/graduate-hires');
  await expect(tid(page, 'm10-gh-table')).toContainText(/Evidence written|evidence written/i, W);
  await clean(page, w);
  // FS48: the mentoring card lists the circle and offer rankers and the opt-in limitation
  await asLocal(page, 'k-auditor');
  await go(page, '/admin/ai-transparency');
  const card = page.locator('[data-testid="m16-engine-card"][data-card="mentoring"]');
  await expect(card).toBeVisible(W);
  await expect(card).toContainText('(FS48)');
  await clean(page, w);
  // Arabic RTL on wave-G pages
  for (const [persona, p] of [['chco', '/ar/workforce/disclosure'], ['k-hr-analyst', '/ar/national/occupations'], ['alnoor-gm', '/ar/ecosystem/regional-plan'], ['chco', '/ar/universities/fellowships'], ['k-instructor', '/ar/training/equivalency/prearrival']] as const) {
    await asLocal(page, persona);
    await go(page, p);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('h1').first()).toHaveText(/[؀-ۿ]/, W);
  }
  await clean(page, w);
});
