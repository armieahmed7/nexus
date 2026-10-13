/**
 * FS wave I journeys (FS78-FS84, "entitlements, transitions, partnerships": learning balance and protected study time, verified external
 * certificates with trust tiers, the automation gallery with builder credit, transition plans with ladder-rung protection, mobility
 * micro-grants, the UAE energy consortium cohort and team 2030 targets with the organisation skills inventory), plus the wave-I wiring.
 * Backend: LOCAL (E2E_BACKEND=local). The live project could not be reached from the wave-I QA session, so every journey runs on the
 * in-browser local backend, which implements the same rules as the SQL (proved in PGlite by fs91..fs95 and fsqa9). Run again in supabase
 * mode after the live apply (docs/kafaa/ref/live_apply/waveI). The browser clock is fixed on 2026-10-12, 09:00 Abu Dhabi.
 *  I1 FS78 balance and study time   I2 FS79 certificates + trust tier in M17   I3 FS80 gallery and builder credit   I4 FS81 plans and rungs
 *  I5 FS82 micro-grants   I6 FS83 consortium   I7 FS84 targets and inventory   I8 wiring, entry links, Arabic
 */
import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { BASE, pinBackend, settle, textIssues, watchErrors } from './helpers';
import { FEATURE_BENCHMARKS } from '../../src/domain/taxonomy';
import { dataQuality, ttCtx } from '../../src/modules/m17/teamTargets';

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

test('I1 FS78: the balance equals grants minus approved use; only outcome-gated catalogue items can be charged; a study-time request is decided by a second person (the line manager) with an audit row; HR reads the published rule and suppressed groups', async ({ page }) => {
  test.setTimeout(12 * 60_000);
  const w = watchErrors(page);
  await asLocal(page, 'k-ro');
  await go(page, '/my/learning-balance');
  await chips(page, 'FS78');
  await openChip(page, FEATURE_BENCHMARKS.FS78[0]);
  await expect(tid(page, 'm34-fs91-sim')).toContainText(/simulated/i, W);
  const lb = (await rows(page, 'learning_balances')).find((r) => r.id === 'lb:p-k-ro:2026');
  expect(lb.remaining_hours).toBe(lb.granted_hours - lb.used_hours); // grants minus approved use
  await expect(tid(page, 'm34-sb-tiles')).toContainText(`${(lb.used_hours / 10).toFixed(1)} credits${lb.used_hours} hours`, W); // approved use
  await expect(tid(page, 'm34-sb-tiles')).toContainText(`${lb.remaining_hours} hours left after approved use`);
  // the catalogue lists outcome-gated items only (published, listed, criteria met)
  const xr = new Map(T.external_resources.map((x) => [x.id, x]));
  const asks = await page.locator('[data-testid^="m34-sb-ask-xr-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!.replace('m34-sb-ask-', '')));
  expect(asks.length).toBeGreaterThan(5);
  for (const id of asks) expect(xr.get(id)?.status === 'published' && xr.get(id)?.listed === true, id).toBe(true);
  expect(asks.some((id) => xr.get(id)?.status !== 'published')).toBe(false);
  // ask for 12 hours on a gated item
  await tid(page, 'm34-sb-ask-xr-openlearn-systems').click();
  const dr = tid(page, 'm34-sb-ask-drawer');
  await dr.getByLabel(/^Hours/).fill('12');
  await dr.getByLabel('Starts').fill('2026-12-01');
  await dr.getByLabel('Ends').fill('2026-12-17');
  await dr.getByLabel('What the study time is for').fill('Systems thinking for my requalification project');
  await expect(dr.getByTestId('m34-sb-send')).toBeEnabled(W);
  await dr.getByTestId('m34-sb-send').click();
  await confirm(page);
  await expect.poll(async () => (await rows(page, 'study_time_requests')).filter((r) => r.person_id === 'p-k-ro' && r.resource_id === 'xr-openlearn-systems' && r.status === 'requested').length, W).toBe(1);
  const req = (await rows(page, 'study_time_requests')).find((r) => r.person_id === 'p-k-ro' && r.resource_id === 'xr-openlearn-systems' && r.status === 'requested');
  expect(req.line_manager_id).toBe('p-sro');
  await clean(page, w);
  // the requester cannot decide: the team queue is the line manager's
  await go(page, '/team/study-time');
  await expect(page.locator(`[data-testid="m34-sb-approve-${req.id}"]`)).toHaveCount(0);
  // the line manager approves (maker-checker), audited; the balance moves by the approved hours
  await asLocal(page, 'sro');
  await go(page, '/team/study-time');
  await chips(page, 'FS78');
  await tid(page, `m34-sb-approve-${req.id}`).click();
  await confirm(page);
  await expect.poll(async () => (await rows(page, 'study_time_requests')).find((r) => r.id === req.id)?.status, W).toBe('approved');
  const done = (await rows(page, 'study_time_requests')).find((r) => r.id === req.id);
  expect(done.decided_by).toBe('p-sro');
  expect((await rows(page, 'audit_events')).some((e) => e.entity_id === req.id && /study/.test(String(e.action)))).toBe(true);
  const lb2 = (await rows(page, 'learning_balances')).find((r) => r.id === 'lb:p-k-ro:2026');
  expect(lb2.used_hours).toBe(lb.used_hours + 12);
  expect(lb2.remaining_hours).toBe(lb2.granted_hours - lb2.used_hours);
  await clean(page, w);
  // HR: the published rule (never age, gender or nationality), suppressed groups
  await asLocal(page, 'chco');
  await go(page, '/workforce/learning-balances');
  await expect(tid(page, 'm34-sb-hr-tiles')).toContainText('106', W);
  await expect(tid(page, 'm34-sb-rule')).toContainText(/never inputs/);
  await expect(tid(page, 'm34-sb-stats')).toContainText(/Suppressed/);
  await clean(page, w);
});

test('I2 FS79 + M17: unverified certificates write no evidence and read "claimed"; a verifier (never the holder) verifies through reviewed crosswalk rows only; the trust tier shows on the certificate page, the wallet, the micro-credentials page, the learner record and the passport evidence', async ({ page }) => {
  test.setTimeout(14 * 60_000);
  const w = watchErrors(page);
  await asLocal(page, 'k-ro');
  await go(page, '/my/recognition/certificates');
  await chips(page, 'FS79');
  await expect(tid(page, 'm34-tier-legend')).toBeVisible(W);
  await expect(tid(page, 'm34-xc-cert-xc-p-k-ro-01').getByTestId('m34-tier')).toHaveAttribute('data-tier', 'vendor_self_serve', W);
  const waiting = tid(page, 'm34-xc-cert-xc-p-k-ro-02');
  await expect(waiting.getByTestId('m34-tier')).toHaveAttribute('data-tier', 'claimed');
  expect((await rows(page, 'skill_evidence')).filter((e) => e.ref_id === 'xc-p-k-ro-02').length).toBe(0); // unverified: no evidence at all
  await expect(tid(page, 'm34-xc-cert-xc-p-k-ro-01').getByTestId('m34-xc-mapping').locator('[data-state="unreviewed"]')).toHaveCount(1); // an unreviewed crosswalk row never maps
  await expect(tid(page, 'm34-not-authority')).toBeVisible();
  await clean(page, w);
  // the verifier queue (training manager): verify k-ro's waiting certificate
  await asLocal(page, 'training-mgr');
  await go(page, '/recognition/certificates');
  await tid(page, 'm34-xc-open-xc-p-k-ro-02').click();
  await tid(page, 'm34-xc-verify').click();
  await confirm(page);
  await expect.poll(async () => (await rows(page, 'external_certs')).find((c) => c.id === 'xc-p-k-ro-02')?.status, W).toBe('verified');
  const ev = (await rows(page, 'skill_evidence')).filter((e) => e.ref_id === 'xc-p-k-ro-02');
  const al = new Map(T.skill_alignments.map((a) => [a.id, a]));
  const cert = (await rows(page, 'external_certs')).find((c) => c.id === 'xc-p-k-ro-02');
  expect(ev.length).toBeGreaterThan(0);
  for (const e of ev) {
    expect(e.kind).toBe('credential');
    expect(cert.alignment_ids.some((a: string) => al.get(a)?.skill_id === e.skill_id && al.get(a)?.status === 'published' && al.get(a)?.reviewed_by && al.get(a)?.reviewed_on), e.skill_id).toBe(true);
  }
  await clean(page, w);
  // the holder never verifies their own: the HR director's own certificate shows the maker-checker refusal
  await asLocal(page, 'chco');
  await go(page, '/recognition/certificates');
  await tid(page, 'm34-xc-open-xc-p-chco-01').click();
  await expect(tid(page, 'm34-xc-mc')).toBeVisible(W);
  await expect(tid(page, 'm34-xc-verify')).toHaveCount(0);
  // M17: the wallet and the micro-credentials page list both certificates with their tier
  await asLocal(page, 'k-ro');
  await go(page, '/my/skills/wallet');
  const box = tid(page, 'm17-xcerts');
  await expect(box.getByTestId('m17-xcert')).toHaveCount(2, W);
  expect((await box.getByTestId('m17-xcert').evaluateAll((els) => els.map((e) => e.getAttribute('data-tier')))).sort()).toEqual([cert.tier, 'vendor_self_serve'].sort());
  await go(page, '/my/skills/credentials');
  await expect(tid(page, 'm17-xcerts').getByTestId('m17-xcert')).toHaveCount(2, W);
  // M17 learner record: verified certificates are items of kind xcert with the tier badge
  await go(page, '/my/skills/record');
  const xi = tid(page, 'm17-lr-record').locator('[data-testid="m17-lr-item"][data-kind="xcert"]');
  await expect(xi).toHaveCount(2, W);
  for (let i = 0; i < 2; i++) await expect(xi.nth(i).getByTestId('m34-tier')).not.toHaveAttribute('data-tier', 'claimed');
  // the passport evidence drawer shows the certificate with its tier
  const skill = ev[0].skill_id;
  await go(page, '/my/skills');
  await page.locator(`[data-testid^="m17-basis-"][data-testid$="-${skill}"]`).first().click();
  const drawer = tid(page, 'm17-evidence-drawer');
  await expect(drawer.locator('[data-testid="m17-evidence-row"][data-kind="credential"]').filter({ hasText: 'External certificate' }).getByTestId('m34-tier')).toHaveAttribute('data-tier', cert.tier, W);
  await clean(page, w);
});

test('I3 FS80: the gallery holds metadata only (nothing runs in Kafa\'a), each entry links its AI-system register row; approval alone writes no evidence; the first adoption of an approved entry writes the builder\'s credit; a builder never adopts their own', async ({ page }) => {
  test.setTimeout(12 * 60_000);
  const w = watchErrors(page);
  await asLocal(page, 'k-ro');
  await go(page, '/workforce/ai-automations');
  await chips(page, 'FS80');
  await expect(tid(page, 'm29-atm-metadata')).toContainText(/nothing runs in Kafa'a/, W);
  const cards = tid(page, 'm29-atm-list').getByTestId('m29-atm-card');
  await expect(cards).toHaveCount(T.automations.filter((a) => a.status === 'approved').length, W);
  const sys = await cards.evaluateAll((els) => els.map((e) => e.querySelector('[data-testid="m29-atm-system"]')?.getAttribute('data-system')));
  const reg = new Set(T.ai_systems.map((s) => s.id));
  for (const s of sys) expect(reg.has(String(s)), String(s)).toBe(true);
  expect(await page.locator('main a[href^="http"]').filter({ hasNotText: /./ }).count()).toBe(0);
  // AI governance approves a submitted entry: approval alone writes no evidence
  await asLocal(page, 'ai-governance');
  await go(page, '/admin/ai-automations');
  const item = tid(page, 'm29-atm-queue').locator('[data-testid="m29-atm-queue-item"][data-id="atm-eng-change-impact"]');
  await item.getByTestId('m29-atm-approve').click();
  await confirm(page);
  await expect.poll(async () => (await rows(page, 'automations')).find((a) => a.id === 'atm-eng-change-impact')?.status, W).toBe('approved');
  expect((await rows(page, 'skill_evidence')).filter((e) => e.ref_table === 'automations' && e.ref_id === 'atm-eng-change-impact').length).toBe(0);
  await clean(page, w);
  // the first adoption of an approved entry with no adopter writes the builder's credit (level 2)
  const target = (await rows(page, 'automations')).find((a) => a.id === 'atm-bilingual-notice');
  expect((await rows(page, 'skill_evidence')).filter((e) => e.ref_table === 'automations' && e.ref_id === target.id).length).toBe(0);
  await asLocal(page, 'k-ro');
  await go(page, `/workforce/ai-automations/${target.id}`);
  await expect(tid(page, 'm29-atm-credit')).toHaveAttribute('data-level', '0', W);
  await tid(page, 'm29-atm-adopt').click();
  await confirm(page);
  await expect(tid(page, 'm29-atm-counter')).toHaveAttribute('data-n', '1', W);
  await expect(tid(page, 'm29-atm-credit')).toHaveAttribute('data-level', '2');
  await expect.poll(async () => (await rows(page, 'skill_evidence')).filter((e) => e.ref_table === 'automations' && e.ref_id === target.id).length, W).toBe(1); // the local store persists after the RPC
  const cr = (await rows(page, 'skill_evidence')).filter((e) => e.ref_table === 'automations' && e.ref_id === target.id);
  expect(cr[0]).toMatchObject({ person_id: target.builder_person_id, kind: 'ojt', level: 2 });
  await clean(page, w);
  // a builder cannot adopt their own entry
  await asLocal(page, 'outage-planner');
  await go(page, '/workforce/ai-automations/atm-outage-lookahead');
  await expect(tid(page, 'm29-atm-block')).toHaveAttribute('data-code', 'own_build', W);
  await expect(tid(page, 'm29-atm-adopt')).toHaveCount(0);
  await clean(page, w);
});

test('I4 FS81: my plan is SIMULATED with review dates and names every alerted task with the practice added; plans are for the person and HR only (the crew B manager, the training manager and HR analysts get nothing); rung alerts name no person', async ({ page }) => {
  test.setTimeout(12 * 60_000);
  const w = watchErrors(page);
  await asLocal(page, 'k-ro');
  await go(page, '/my/transition-plan');
  await expect(tid(page, 'm30-tp-mine')).toBeVisible(W);
  await expect(tid(page, 'm30-bench').first()).toBeVisible();
  await chips(page, 'FS81');
  await expect(page.getByText('SIMULATED HR record').first()).toBeVisible();
  await expect(tid(page, 'm30-tp-privacy')).toContainText(/Only you and HR/);
  const tasks = tid(page, 'm30-tp-alert').getByTestId('m30-tp-task');
  expect(await tasks.count()).toBeGreaterThan(0);
  for (let i = 0; i < await tasks.count(); i++) await expect(tasks.nth(i).getByTestId('m30-tp-practice')).toContainText(/Simulator|OJT/);
  await expect(tid(page, 'm30-tp-reviews')).toContainText(/Next review/);
  await clean(page, w);
  for (const p of ['sro', 'training-mgr', 'k-hr-analyst']) {
    await asLocal(page, p);
    await go(page, '/workforce/transition-plans');
    await expect(tid(page, 'm30-tp-board')).toHaveCount(0);
    await go(page, '/workforce/transition-plans/tp-w-lo-02-1');
    await expect(tid(page, 'm30-tp-plan')).toHaveCount(0);
  }
  await asLocal(page, 'chco');
  await go(page, '/workforce/transition-plans');
  await expect(tid(page, 'm30-tp-row')).toHaveCount(T.transition_plans.length, W);
  await clean(page, w);
  await asLocal(page, 'training-mgr');
  await go(page, '/workforce/rung-alerts');
  await expect(tid(page, 'm30-ra-list').getByTestId('m30-tp-alert').first()).toBeVisible(W);
  const text = await page.locator('main').innerText();
  for (const pr of T.people.filter((x) => T.transition_plans.some((t) => t.person_id === x.id))) expect(text.includes(pr.display_name), pr.id).toBe(false);
  await clean(page, w);
});

test('I5 FS82: rounds open and close on schedule (the round to 10 Oct is closed, the round to 10 Dec open); budgets are SIMULATED; statistics under 10 are suppressed; the HR director decides after the deadline, audited; auditors read only', async ({ page }) => {
  test.setTimeout(12 * 60_000);
  const w = watchErrors(page);
  await asLocal(page, 'nse');
  await go(page, '/my/grants');
  await chips(page, 'FS82');
  const my = tid(page, 'm36-gr-my');
  await expect(my).toHaveAttribute('data-open', 'gr-2026-12', W);
  expect(await my.getByTestId('m36-round').evaluateAll((els) => els.map((e) => e.getAttribute('data-phase')))).toEqual(['closed', 'closed', 'closed', 'open']);
  await expect(my.getByTestId('m36-gr-labels')).toContainText(/SIMULATED/i);
  await go(page, '/ecosystem/grants');
  await expect(tid(page, 'm36-grp').locator('[data-suppressed="true"]').first()).toBeVisible(W);
  await clean(page, w);
  await asLocal(page, 'chco');
  await go(page, '/workforce/grants');
  const c = tid(page, 'm36-grh');
  await expect(c).toHaveAttribute('data-director', 'yes', W);
  await expect(c.getByTestId('m36-grh-budget').first()).toBeVisible();
  await c.locator('[data-testid="m36-grh-app"][data-id="ga-2026-10-01"]').getByTestId('m36-grh-approve').click();
  await page.getByRole('button', { name: 'Approve' }).last().click();
  await expect.poll(async () => (await rows(page, 'grant_applications')).find((a) => a.id === 'ga-2026-10-01')?.status, W).toBe('approved');
  expect((await rows(page, 'audit_events')).some((e) => e.action === 'grant.decide' && e.entity_id === 'ga-2026-10-01')).toBe(true);
  await expect(c.locator('[data-testid="m36-grh-app"][data-id="ga-2026-12-02"]').getByTestId('m36-grh-approve')).toHaveCount(0); // open round: not before the deadline
  await clean(page, w);
  await asLocal(page, 'k-auditor');
  await go(page, '/workforce/grants');
  await expect(tid(page, 'm36-grh')).toHaveAttribute('data-director', 'no', W);
  await expect(tid(page, 'm36-grh-approve')).toHaveCount(0);
  await clean(page, w);
});

test('I6 FS83: partner organisations are synthetic and labelled; each partner sees only its own trainees; a visit writes evidence only after host confirmation (here the programme office on behalf, with the host reference)', async ({ page }) => {
  test.setTimeout(12 * 60_000);
  const w = watchErrors(page);
  await asLocal(page, null);
  await go(page, '/ecosystem/consortium');
  await chips(page, 'FS83');
  const cohort = tid(page, 'm36-cc-cohort');
  await expect(cohort.getByTestId('m36-cc-partner')).toHaveCount(6, W);
  await expect(cohort.locator('[data-testid="m36-cc-partner"][data-synthetic="yes"]')).toHaveCount(5);
  await expect(cohort.getByTestId('m36-cc-budget')).toHaveAttribute('data-simulated', 'yes');
  await clean(page, w);
  await asLocal(page, 'alnoor-gm');
  await go(page, '/ecosystem/consortium/cc-2026');
  const ws = tid(page, 'm36-ccw');
  await expect(ws).toHaveAttribute('data-scope', 'org', W);
  const orgs = await ws.getByTestId('m36-ccw-member').evaluateAll((els) => els.map((e) => e.getAttribute('data-org')));
  expect(orgs.length).toBeGreaterThan(0);
  expect(new Set(orgs)).toEqual(new Set(['org-alnoor']));
  await clean(page, w);
  const v = (await rows(page, 'consortium_visits')).find((x) => x.id === 'cv-cc-2026-033');
  expect(v.status).toBe('logged');
  expect((await rows(page, 'skill_evidence')).filter((e) => e.ref_table === 'consortium_visits' && e.ref_id === v.id).length).toBe(0);
  await asLocal(page, 'chco');
  await go(page, '/ecosystem/consortium/cc-2026');
  await page.getByRole('tab', { name: /Host queue/ }).click();
  const card = tid(page, 'm36-ccw-host').locator('[data-testid="m36-ccw-host-visit"][data-id="cv-cc-2026-033"]');
  await expect(card).toHaveAttribute('data-route', 'on_behalf', W);
  await expect(card.getByTestId('m36-ccw-confirm')).toBeDisabled();
  await card.getByLabel('Host confirmation reference').fill('SGS-HOST-CONF-2026-10-09');
  await card.getByTestId('m36-ccw-confirm').click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).last().click();
  await expect.poll(async () => (await rows(page, 'consortium_visits')).find((x) => x.id === v.id)?.status, W).toBe('confirmed');
  const ce = (await rows(page, 'skill_evidence')).filter((e) => e.ref_table === 'consortium_visits' && e.ref_id === v.id);
  expect(ce.length).toBe(1);
  expect(ce[0].kind).toBe('ojt');
  await clean(page, w);
});

test('I7 FS84: each team target shows the 2030 role-profile version it came from; the inventory suppresses cells under 10; the data-quality figures equal the rule (dataQuality on the seed)', async ({ page }) => {
  test.setTimeout(12 * 60_000);
  const w = watchErrors(page);
  await asLocal(page, 'sro');
  await go(page, '/team/skills/future');
  await chips(page, 'FS84');
  const rowsL = tid(page, 'm17-tt-row');
  await expect(rowsL.first()).toBeVisible(W);
  for (let i = 0; i < await rowsL.count(); i++) expect(await rowsL.nth(i).getByTestId('m17-tt-from').locator('[data-version]').count()).toBeGreaterThan(0);
  await expect(tid(page, 'm17-tt-from').locator('[data-version="rpv-reactor-operator-2030-v2"]').first()).toBeVisible();
  await clean(page, w);
  await asLocal(page, 'chco');
  await go(page, '/workforce/skills-inventory');
  await expect(tid(page, 'm17-inv-areas')).toContainText('<10', W);
  const q = dataQuality({ ctx: ttCtx({ skills: T.skills, competencies: T.competencies, role_profile_versions: T.role_profile_versions }), skills: T.skills, people: T.people as never, states: T.person_skills as never, dim: 'entity', today: '2026-10-12' });
  const tiles = tid(page, 'm17-inv-quality');
  for (const v of [q.profiled_pct, q.req_pct, q.stale_pct, q.validated_pct]) if (v != null) await expect(tiles).toContainText(`${v}%`);
  await expect(tiles).toContainText(`of ${q.staff}`);
  await clean(page, w);
});

test('I8 wiring: the inventory from the skills outlook (HR only), the consortium from the energy academy, rung alerts from the simulator page; Arabic RTL on the wave-I pages', async ({ page }) => {
  test.setTimeout(16 * 60_000);
  const w = watchErrors(page);
  await asLocal(page, 'chco');
  await go(page, '/workforce/skills-outlook');
  await tid(page, 'm07-so-to-inventory').click();
  await expect(tid(page, 'm17-inv')).toBeVisible(W);
  await asLocal(page, 'sro');
  await go(page, '/workforce/skills-outlook');
  await expect(tid(page, 'm07-so-labels')).toBeVisible(W);
  await expect(tid(page, 'm07-so-to-inventory')).toHaveCount(0);
  await asLocal(page, null);
  await go(page, '/learn/academies/ac-energy');
  await tid(page, 'm04-acad-to-consortium').locator('a').click();
  await expect(tid(page, 'm36-cc')).toBeVisible(W);
  await asLocal(page, 'training-mgr');
  await go(page, '/training/simulator');
  await tid(page, 'm04-sim-to-rung-alerts').click();
  await expect(tid(page, 'm30-ra-list')).toBeVisible(W);
  await clean(page, w);
  for (const [persona, p] of [['k-ro', '/ar/my/learning-balance'], ['sro', '/ar/team/study-time'], ['chco', '/ar/workforce/learning-balances'], ['k-ro', '/ar/my/recognition/certificates'],
    ['training-mgr', '/ar/recognition/certificates'], ['k-ro', '/ar/workforce/ai-automations'], ['nse', '/ar/my/ai-fluency/builds'], ['ai-governance', '/ar/admin/ai-automations'],
    ['k-ro', '/ar/my/transition-plan'], ['chco', '/ar/workforce/transition-plans'], ['training-mgr', '/ar/workforce/rung-alerts'], ['nse', '/ar/my/grants'], [null, '/ar/ecosystem/consortium'],
    ['k-lo-trainee', '/ar/my/consortium'], ['sro', '/ar/team/skills/future'], ['chco', '/ar/workforce/skills-inventory'], ['k-ro', '/ar/my/skills/wallet'], ['sro', '/ar/my/skills/record']] as const) {
    await asLocal(page, persona);
    await go(page, p);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('h1').first()).toHaveText(/[؀-ۿ]/, W);
  }
  await clean(page, w);
});
