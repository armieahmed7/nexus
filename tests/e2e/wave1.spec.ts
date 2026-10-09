/**
 * Wave 1 journeys (F03-F09), supabase mode against the live NEXUS project with real NEXUS demo sign-in. Writes are
 * minimal and tagged "E2E-QA" where the schema has free text (opportunity title, application note, release reason).
 *  W1 passport: derived skills with reasons, Verified chip opens the evidence drawer
 *  W2 credential wallet + public verify page (anonymous); tampering is covered by unit and PGlite tests
 *  W3 career navigator: readiness % with reasons, gates shown separately in the role detail
 *  W4 roadmap what-if (delay slider moves the end date) then "send to my development plan"
 *  W5 learning coach: a recommendation with "Why this?", then enrol through the confirm dialog
 *  W6 marketplace: manager posts a gig -> employee applies -> line manager releases -> poster selects
 *  W7 Future Me readiness: SIMULATED chip and the no-decision line on every index
 */
import { test, expect, type Page } from '@playwright/test';
import { BASE, E2E_TAG, pinBackend, settle, signIn, textIssues, watchErrors } from './helpers';

test.describe.configure({ mode: 'serial' });

async function go(page: Page, path: string) {
  await page.goto(BASE + path);
  await settle(page);
}
async function confirmOk(page: Page, reason = `${E2E_TAG} check`) {
  const dlg = page.locator('[role="dialog"]').last();
  const ta = dlg.locator('textarea');
  if (await ta.count()) await ta.first().fill(reason);
  await dlg.locator('[data-testid="confirm-action"]').click();
  const toast = page.locator('[data-testid="toast"]').last();
  await expect(toast).toBeVisible();
  const text = await toast.innerText();
  expect(await toast.getAttribute('data-tone'), `toast: ${text}`).toBe('ok');
  return text;
}
async function as(page: Page, persona: string | null) {
  await pinBackend(page, 'supabase');
  if (persona) await signIn(page, persona);
}
async function clean(page: Page, w: ReturnType<typeof watchErrors>) {
  expect(await textIssues(page)).toEqual([]);
  expect(w.take()).toEqual([]);
}

test('W1 F03 passport: derived skills with reasons and a Verified chip that names its record', async ({ page }) => {
  const w = watchErrors(page);
  await as(page, 'sro');
  await go(page, '/my/skills');
  await expect(page.locator('[data-testid="m17-profile"]')).toBeVisible();
  await expect(page.locator('[data-testid="m17-radar"]')).toBeVisible();
  const rows = page.locator('[data-testid^="m17-skill-"]');
  expect(await rows.count()).toBeGreaterThan(5);
  // a derived skill explains itself
  const why = page.locator('[data-testid^="why-this-sk-"]').first();
  await why.click();
  await expect(page.locator('[data-testid$="-panel"]').first()).toBeVisible();
  expect((await page.locator('[data-testid$="-panel"]').first().innerText()).trim().length).toBeGreaterThan(5);
  // a Verified chip opens the evidence drawer naming the record and the source system
  await page.locator('[data-testid^="m17-basis-verified-"]').first().click();
  const drawer = page.locator('[data-testid="m17-evidence-drawer"]');
  await expect(drawer).toBeVisible();
  expect(await drawer.locator('[data-testid="m17-evidence-row"]').count()).toBeGreaterThan(0);
  await expect(drawer).toContainText(/recorded in/i);
  await page.keyboard.press('Escape');
  // Shift Supervisor is the top of the ladder (no outgoing career path): the card says so instead of listing strengths
  await expect(page.locator('[data-testid="m17-strengths"]').or(page.getByText('No transferable strength found for the roles you can reach.'))).toBeVisible();
  await clean(page, w);
});

test('W2 F04 wallet and public verify: signed badge in the wallet, public page valid with the not-a-licence banner', async ({ page }) => {
  const w = watchErrors(page);
  await as(page, 'sro');
  await go(page, '/my/skills/wallet');
  const card = page.locator('[data-testid="m17-badge-card"]').first();
  await expect(card).toBeVisible();
  await expect(card.locator('[data-testid="m17-sig"]')).toBeVisible();
  await clean(page, w);
  // anonymous public verification
  const p2 = await page.context().browser()!.newPage();
  const w2 = watchErrors(p2);
  await pinBackend(p2, 'supabase');
  await p2.goto(`${BASE}/verify/badge/kb3a512774a081`);
  await settle(p2);
  const res = p2.locator('[data-testid="m17-verify-result"]');
  await expect(res).toBeVisible();
  await expect(res).toHaveAttribute('data-outcome', 'valid');
  await expect(p2.locator('main')).toContainText(/not a FANR certificate or licence/i);
  const txt = await p2.locator('main').innerText();
  expect(txt).not.toMatch(/@/); // no emails
  await clean(p2, w2);
  await p2.close();
});

test('W3 F05 navigator: readiness with reasons; gates listed separately', async ({ page }) => {
  const w = watchErrors(page);
  await as(page, 'qc-inspector');
  await go(page, '/my/career');
  await expect(page.locator('[data-testid="m18-map"]')).toBeVisible();
  const move = page.locator('[data-testid="m18-move"]').first();
  await expect(move).toBeVisible();
  await expect(move.locator('[data-testid="m18-band"]')).toBeVisible();
  await move.locator('[data-testid="m18-why"]').click();
  await expect(move.locator('[data-testid="m18-why-panel"]')).toBeVisible();
  await move.locator('[data-testid="m18-details"]').click();
  const detail = page.locator('[data-testid="m18-detail"]');
  await expect(detail).toBeVisible();
  await expect(detail.locator('[data-testid="m18-gates"]')).toBeVisible();
  expect(await detail.locator('[data-testid="m18-gate"]').count()).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  await clean(page, w);
});

test('W4 F06 roadmap: what-if moves the end date, then send to my development plan', async ({ page }) => {
  const w = watchErrors(page);
  await as(page, 'qc-inspector');
  await go(page, '/my/career/roadmap?role=procurement-engineer');
  await expect(page.locator('[data-testid="m18-gantt"]').first()).toBeVisible();
  const end = page.locator('[data-testid="m18-rm-end"]').first();
  const before = await end.innerText();
  const slider = page.locator('input[type="range"]').first();
  await slider.fill('4');
  await expect(end).not.toHaveText(before);
  await slider.fill('0');
  await expect(end).toHaveText(before);
  // send: the scenario is saved first ("Scenario saved"), then the RPC reports the plan outcome; wait for that toast
  const sendAndRead = async () => {
    await page.locator('[data-testid="m18-rm-send"]').click();
    await page.locator('[role="dialog"]').last().locator('[data-testid="confirm-action"]').click();
    const toast = page.locator('[data-testid="toast"]', { hasText: /development plan/i }).last();
    await expect(toast).toBeVisible();
    expect(await toast.getAttribute('data-tone')).toBe('ok');
    return toast.innerText();
  };
  expect(await sendAndRead()).toMatch(/(Added to|Already in) your development plan/);
  // re-sending never duplicates the plan activities
  expect(await sendAndRead()).toMatch(/Already in your development plan/);
  await clean(page, w);
});

test('W5 F07 coach: a recommendation explains itself, then enrol', async ({ page }) => {
  const w = watchErrors(page);
  await as(page, 'outage-planner'); // a staff persona whose feed has bookable courses
  await go(page, '/my/coach');
  const feed = page.locator('[data-testid="m19-feed"]');
  await expect(feed).toBeVisible();
  const cards = feed.locator('[data-testid="m19-card"]');
  expect(await cards.count()).toBeGreaterThanOrEqual(5);
  const first = cards.first();
  await first.locator('[data-testid="why-this"]').click();
  expect(await first.locator('[data-testid="why-this-panel"] li').count()).toBeGreaterThan(0);
  const enrolCard = feed.locator('[data-testid="m19-card"]:has([data-testid="m19-enrol"])').first();
  await expect(enrolCard).toBeVisible();
  await enrolCard.locator('[data-testid="m19-enrol"]').click();
  await confirmOk(page);
  await expect(page.locator('main')).not.toContainText(/\b(streak|leaderboard)\b/i);
  await clean(page, w);
});

let oppUrl = '';
const oppTitle = `${E2E_TAG} outage walkdown support ${Date.now().toString(36)}`;
test('W6a F08 manager posts a gig', async ({ page }) => {
  const w = watchErrors(page);
  await as(page, 'training-mgr');
  await go(page, '/opportunities/post');
  const f = page.locator('[data-testid="m20-post-form"]');
  await f.locator('input[name="title_en"]').fill(oppTitle);
  await f.locator('input[name="title_ar"]').fill('دعم جولات التفتيش أثناء الإيقاف (اختبار)');
  await f.locator('textarea[name="summary_en"]').fill('Support the outage team with pre-job walkdowns and briefings for two weeks. E2E-QA test posting.');
  await f.locator('textarea[name="summary_ar"]').fill('دعم فريق الإيقاف في جولات ما قبل العمل والإحاطات لمدة أسبوعين. منشور اختبار.');
  await f.locator('[data-testid="m20-pick-need"] input[type="checkbox"]').first().check();
  await f.locator('[data-testid="m20-pick-gain"] input[type="checkbox"]').nth(1).check();
  await page.locator('[data-testid="m20-post-open"]').click();
  await expect(page.locator('[data-testid="m20-post-problem"]')).toHaveCount(0);
  await confirmOk(page);
  await page.waitForURL(/\/opportunities\/(?!post)[^/?]+$/);
  oppUrl = new URL(page.url()).pathname.replace(BASE, '');
  await settle(page);
  await expect(page.locator('main')).toContainText(oppTitle);
  await clean(page, w);
});

test('W6b F08 employee applies (match reasons shown)', async ({ page }) => {
  expect(oppUrl).toMatch(/^\/opportunities\//);
  const w = watchErrors(page);
  await as(page, 'qc-inspector');
  await go(page, '/opportunities');
  expect(await page.locator('[data-testid="m20-card"]').count()).toBeGreaterThan(0);
  // every card (its header carries data-testid="m20-card") has its own "Why this?" with at least one reason
  expect(await page.locator('main [data-testid="m20-why"]').count()).toBe(await page.locator('[data-testid="m20-card"]').count());
  await page.locator('main [data-testid="m20-why"]').first().click();
  expect(await page.locator('[data-testid="m20-why-panel"] li').count()).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  await go(page, oppUrl);
  await page.locator('[data-testid="m20-apply"]').click();
  await page.locator('[data-testid="m20-apply-note"]').fill(`${E2E_TAG}: I would like the outage exposure.`);
  await page.locator('[data-testid="m20-apply-confirm"]').click();
  await expect(page.locator('[data-testid="toast"]').last()).toHaveAttribute('data-tone', 'ok');
  await expect(page.locator('main').getByText('Waiting for release').first()).toBeVisible();
  await clean(page, w);
});

test('W6c F08 poster cannot select before release; line manager releases', async ({ page }) => {
  const w = watchErrors(page);
  // poster tries to select first: refused with release_required
  await as(page, 'training-mgr');
  await go(page, oppUrl);
  const app = page.locator('[data-testid="m20-pipeline"] [data-testid="m20-applicant"]').first();
  await expect(app).toBeVisible();
  await app.locator('[data-testid="m20-select"]').click();
  await page.locator('[role="dialog"]').last().locator('[data-testid="confirm-action"]').click();
  const toast = page.locator('[data-testid="toast"]').last();
  await expect(toast).toBeVisible();
  expect(await toast.getAttribute('data-tone')).not.toBe('ok');
  await expect(toast).toContainText(/release/i);
  w.take(); // the refused RPC logs a console error by design
  // line manager (head-sq) releases
  const p2 = await page.context().browser()!.newPage();
  const w2 = watchErrors(p2);
  await as(p2, 'head-sq');
  await go(p2, '/opportunities/manage');
  const card = p2.locator('[data-testid="m20-release-card"]', { hasText: oppTitle });
  await expect(card).toBeVisible();
  await card.locator('[data-testid="m20-release"]').click();
  await confirmOk(p2, `${E2E_TAG} released for two weeks`);
  await clean(p2, w2);
  await p2.close();
});

test('W6d F08 poster selects the released applicant', async ({ page }) => {
  const w = watchErrors(page);
  await as(page, 'training-mgr');
  await go(page, oppUrl);
  const app = page.locator('[data-testid="m20-pipeline"] [data-testid="m20-applicant"]').first();
  await app.locator('[data-testid="m20-select"]').click();
  await confirmOk(page);
  await settle(page);
  await expect(page.locator('[data-testid="m20-pipeline"]')).toContainText(/selected/i);
  await clean(page, w);
});

test('W7 F09 Future Me: readiness index with SIMULATED and the no-decision line', async ({ page }) => {
  const w = watchErrors(page);
  await as(page, 'qc-inspector');
  await go(page, '/my/future');
  const idx = page.locator('[data-testid^="m21-index"]');
  expect(await idx.count()).toBeGreaterThan(1);
  for (let i = 0; i < Math.min(await idx.count(), 8); i++) {
    await expect(idx.nth(i)).toContainText(/SIMULATED/i);
    await expect(idx.nth(i)).toContainText(/no deployment decision/i);
  }
  await expect(page.locator('[data-testid="m21-horizon"]')).toBeVisible();
  expect(await page.locator('[data-testid="m21-lane"]').count()).toBe(5);
  await expect(page.locator('[data-testid="m21-bridge-plan"]')).toBeVisible();
  await clean(page, w);
});
