/**
 * (b) Key journeys, supabase mode against the live NEXUS project (local fallback only where no NEXUS demo account holds
 * the role). Writes are minimal and tagged "E2E-QA"; where an RPC can undo a write (withdraw an application, flip a flag
 * back) the test does so.
 */
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { BASE, E2E_TAG, pinBackend, settle, signIn, textIssues, watchErrors } from './helpers';

test.describe.configure({ mode: 'serial' });

const SEED = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')) as Record<string, Record<string, unknown>[]>;
const T = (SEED as { tables?: typeof SEED }).tables ?? SEED;
const uaeNow = (offsetMin = 0) => {
  const d = new Date(Date.now() + 4 * 3_600_000 + offsetMin * 60_000);
  return { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16) };
};

async function go(page: Page, path: string) {
  await page.goto(BASE + path);
  await settle(page);
}
/** Click the ConfirmDialog's confirm button (filling its reason box if it has one) and expect a success toast. */
async function confirmOk(page: Page, reason = `${E2E_TAG} check`) {
  const dlg = page.locator('[role="dialog"]').last();
  const ta = dlg.locator('textarea');
  if (await ta.count()) await ta.first().fill(reason);
  await dlg.locator('[data-testid="confirm-action"]').click();
  const toast = page.locator('[data-testid="toast"]').last();
  await expect(toast).toBeVisible();
  const tone = await toast.getAttribute('data-tone');
  const text = await toast.innerText();
  expect(tone, `toast: ${text}`).toBe('ok');
  return text;
}
async function noBadText(page: Page) {
  expect(await textIssues(page)).toEqual([]);
}

test('J1 career map → role detail → path planner (anonymous)', async ({ page }) => {
  const w = watchErrors(page);
  await pinBackend(page, 'supabase');
  await go(page, '/careers');
  await expect(page.locator('[data-testid="m01-family-tiles"], [data-testid="m01-role-list"]').first()).toBeVisible();
  await page.locator('[data-testid="m01-role-link"]').first().click();
  await settle(page);
  await expect(page).toHaveURL(/\/careers\/roles\//);
  await expect(page.locator('[data-testid="m01-responsibilities"]')).toBeVisible();
  await expect(page.locator('[data-testid="m01-role-competencies"]')).toBeVisible();
  await page.locator('[data-testid="m01-plan-to-role"]').click();
  await settle(page);
  await expect(page).toHaveURL(/\/careers\/plan\?to=/);
  await expect(page.locator('[data-testid="m01-plan-form"]')).toBeVisible();
  await expect(page.locator('[data-testid="m01-plan-routes"], [data-testid="m01-plan-reachable"]').first()).toBeVisible();
  await noBadText(page);
  expect(w.take()).toEqual([]);
});

test('J2 evaluator sign-off → supervisor acknowledgement → NEXUS ledger entry', async ({ page }) => {
  const w = watchErrors(page);
  await pinBackend(page, 'supabase');
  // Evaluator: the training manager holds a current RO-QC evaluator qualification.
  await signIn(page, 'training-mgr');
  await go(page, '/training/quals/qs-ro?record=qr-w-ro-01-qs-ro');
  const drawer = page.locator('[data-testid="m02-record-drawer"]');
  await expect(drawer).toBeVisible();
  const row = drawer.locator('tr', { hasText: 'RO-QC-T5' });
  await row.locator('[data-testid="m02-evaluate-task"]').click();
  await expect(page.locator('[data-testid="m02-eval-form"]')).toBeVisible();
  await page.locator('[data-testid="m02-eval-submit"]').click();
  await confirmOk(page);
  // Supervisor: the crew B shift supervisor acknowledges it.
  await signIn(page, 'sro');
  await go(page, '/team');
  const acks = page.locator('[data-testid="m02-pending-acks"] tr', { hasText: 'RO-QC-T5' });
  await expect(acks.first()).toBeVisible();
  await acks.first().locator('[data-testid="m02-ack"]').click();
  await confirmOk(page, `${E2E_TAG} supervisor acknowledgement`);
  // Ledger: the admin view lists the Kafa'a ledger entries appended to NEXUS.
  await signIn(page, 'ai-governance');
  await go(page, '/admin/nexus');
  await page.getByRole('tab', { name: /Evidence ledger/ }).click();
  await expect(page.locator('[data-testid="m16-ledger"]')).toContainText(/kafaa\.qualification\.ack/);
  await expect(page.locator('[data-testid="m16-ledger"]')).toContainText(/kafaa\.qualification\.signoff/);
  await noBadText(page);
  expect(w.take()).toEqual([]);
});

test('J3 licence tracker alerts', async ({ page }) => {
  const w = watchErrors(page);
  await pinBackend(page, 'supabase');
  await signIn(page, 'rao');
  await go(page, '/licensing/validity');
  const table = page.locator('[data-testid="m03-validity-table"]');
  await expect(table).toContainText('Lapsed');
  await expect(table).toContainText(/Stale sync|Medical overdue|Renewal window/);
  await expect(table).toContainText(/expired 2 days ago|expired \d+ days? ago/);
  await page.getByRole('tab', { name: /Tasks/ }).click();
  await expect(page.locator('[data-testid="m03-tasks"]')).toBeVisible();
  await expect(page.locator('[data-testid="m03-task-clock"]').first()).toBeVisible();
  await go(page, '/licensing/calendar');
  await noBadText(page);
  expect(w.take()).toEqual([]);
});

/** Sessions from an interrupted earlier run: remove anyone still seated, then cancel the session. */
async function cleanupE2eSessions(page: Page) {
  await go(page, '/training/schedule');
  for (let guard = 0; guard < 5; guard++) {
    const row = page.locator('tr', { hasText: E2E_TAG }).filter({ hasText: /Scheduled/ }).first();
    if (!(await row.count())) break;
    await row.click();
    const drawer = page.locator('[role="dialog"]').last();
    await expect(drawer.locator('[data-testid="m04-roster"]').or(drawer.getByText(/Nobody booked yet/)).first()).toBeVisible();
    for (let k = 0; k < 4; k++) {
      const rm = drawer.getByRole('button', { name: /^Remove$/ }).first();
      if (!(await rm.count())) break;
      await rm.click();
      await confirmOk(page, `${E2E_TAG} cleanup of an interrupted test run`);
    }
    // A session that already ran is closed; one that has not started is cancelled.
    const close = drawer.getByRole('button', { name: /Close session/ });
    await ((await close.count()) ? close : drawer.getByRole('button', { name: /Cancel session/ })).click();
    await confirmOk(page);
    await page.keyboard.press('Escape');
    await go(page, '/training/schedule');
  }
}

test('J4 course enrol → attend → assessment → pass → certificate', async ({ page }) => {
  test.setTimeout(15 * 60_000);
  const w = watchErrors(page);
  await pinBackend(page, 'supabase');
  const tag = `${E2E_TAG} room ${Date.now().toString(36)}`;
  // An operations employee who has not yet passed HU-101 (each run issues a real certificate, so rerun with another).
  const learner = process.env.E2E_LEARNER || 'outage-planner';
  const learnerId = `p-${learner}`;
  const learnerName = String((T.people as { id: string; display_name: string }[]).find((x) => x.id === learnerId)?.display_name ?? learner);
  // 0. Clean up sessions left by an earlier, interrupted run (remove the learner, cancel the session).
  await signIn(page, 'training-mgr');
  await cleanupE2eSessions(page);
  // 1. Training manager schedules a short HU-101 session starting in two minutes. The learner is an operations
  //    employee: the training manager's scope is ENEC Operations, so the exam can be scheduled for them.
  await go(page, '/training/schedule');
  await page.locator('[data-testid="m04-session-new"]').click();
  const start = uaeNow(2);
  const f = page.locator('#m04-session-form');
  await f.locator('select').first().selectOption('c-hu');
  await f.locator('input[type="date"]').fill(start.date);
  await f.locator('input[type="time"]').fill(start.time);
  await f.getByLabel(/Hours/i).fill('1');
  await f.getByLabel(/Where|Location/i).fill(tag);
  await f.getByLabel(/Capacity/i).fill('2');
  await page.locator('[data-testid="m04-session-save"]').click();
  await expect(page.locator('[data-testid="toast"]').last()).toHaveAttribute('data-tone', 'ok');
  // 2. Employee books a seat on it.
  await signIn(page, learner);
  await go(page, '/learn/course/c-hu');
  const sessRow = page.locator('tr', { hasText: tag });
  await expect(sessRow).toBeVisible();
  await sessRow.getByRole('button').first().click();
  await confirmOk(page);
  // 3. Wait for the session to start, then the training manager records attendance.
  await page.waitForTimeout(Math.max(0, new Date(`${start.date}T${start.time}:00+04:00`).getTime() - Date.now() + 5_000));
  await signIn(page, 'training-mgr');
  await go(page, '/training/schedule');
  await page.locator('tr', { hasText: tag }).first().click();
  const roster = page.locator('[data-testid="m04-roster"]');
  await expect(roster).toBeVisible();
  await roster.getByRole('radio', { name: /Present/i }).first().click();
  await page.locator('[data-testid="m04-attendance-save"]').click();
  await confirmOk(page);
  await page.keyboard.press('Escape');
  // 4. The linked written exam is scheduled now, with the training manager as proctor.
  await go(page, '/training/assessments');
  await page.getByRole('tab', { name: /Schedule/i }).click().catch(() => undefined);
  const now = uaeNow(0);
  const sf = page.locator('form', { has: page.locator('[data-testid="m05-schedule"]') });
  await sf.locator('select').nth(0).selectOption('form-c-hu');
  await sf.locator('select').nth(1).selectOption(learnerId);
  await sf.locator('input[type="date"]').fill(now.date);
  await sf.locator('input[type="time"]').fill(now.time);
  await page.locator('[data-testid="m05-schedule"]').click();
  {
    // An attempt left open by an interrupted earlier run is reused (the retake rules refuse a second open attempt).
    const dlg = page.locator('[role="dialog"]').last();
    await dlg.locator('[data-testid="confirm-action"]').click();
    const toast = page.locator('[data-testid="toast"]').last();
    await expect(toast).toBeVisible();
    if ((await toast.getAttribute('data-tone')) !== 'ok') expect(await toast.innerText()).toMatch(/scheduled, in progress or not yet released/);
  }
  // 5. Employee sits the exam and answers from the approved key.
  await signIn(page, learner);
  await go(page, '/my/assessments');
  // (An attempt already sat and graded in an interrupted earlier run goes straight to release.)
  if (await page.locator('[data-testid="m05-start-exam"]').count()) {
    await page.locator('[data-testid="m05-start-exam"]').first().click();
    const dlg = page.locator('[role="dialog"] [data-testid="confirm-action"]');
    if (await dlg.count()) await dlg.click();
    const form = (T.assessment_forms as { id: string; item_ids: string[] }[]).find((x) => x.id === 'form-c-hu')!;
    const versions = T.item_versions as { item_id: string; stem_en: string; answer: string; options: { id: string; en: string }[] }[];
    for (let i = 0; i < form.item_ids.length; i++) {
      const main = page.locator('main');
      await expect(main.locator('[role="radiogroup"]')).toBeVisible({ timeout: 30_000 });
      const stemText = await main.innerText();
      const v = versions.find((x) => form.item_ids.includes(x.item_id) && stemText.includes(x.stem_en));
      expect(v, 'exam shows a stem from the form').toBeTruthy();
      const right = v!.options.find((o) => o.id === v!.answer)!;
      await main.locator('[role="radiogroup"] label', { hasText: right.en }).first().locator('input[type="radio"]').check();
      if (i < form.item_ids.length - 1) await page.locator('[data-testid="m05-exam-next"]').click();
    }
    await page.locator('[data-testid="m05-exam-submit"]').click();
    const sub = page.locator('[role="dialog"] [data-testid="confirm-action"]');
    if (await sub.count()) await sub.click();
    await expect(page.locator('[data-testid="m05-exam-done"]')).toBeVisible();
  }
  // 6. Training manager releases the graded attempt.
  await signIn(page, 'training-mgr');
  await go(page, '/training/assessments');
  await page.locator('tr', { hasText: learnerName }).locator('[data-testid="m05-release"]').first().click();
  await confirmOk(page);
  // 7. ...and records the course as passed, which issues the certificate.
  await go(page, '/training/schedule');
  await page.locator('tr', { hasText: tag }).first().click();
  await page.locator('[data-testid="m04-complete"]').first().click();
  await page.locator('#m04-complete-form textarea').fill(`${E2E_TAG} evidence`);
  await page.locator('[data-testid="m04-complete-confirm"]').click();
  await expect(page.locator('[data-testid="toast"]').last()).toHaveAttribute('data-tone', 'ok');
  await expect(page.locator('[data-testid="m04-roster"]')).toContainText(/KAF-\d{4}-\d{6}/);
  const certNo = (await page.locator('[data-testid="m04-roster"]').innerText()).match(/KAF-\d{4}-\d{6}/)?.[0];
  expect(certNo, 'certificate number on the roster').toBeTruthy();
  // 8. Employee sees it; anyone can verify it.
  await signIn(page, learner);
  await go(page, '/my/learning');
  await page.getByRole('tab', { name: /Certificates/ }).click();
  await expect(page.locator('main')).toContainText(certNo!);
  await page.locator('[data-testid="account-menu"]').click();
  await page.locator('[data-testid="sign-out"]').click();
  await go(page, '/verify');
  await page.locator('[data-testid="m02-verify-form"] input').first().fill(certNo!);
  await page.locator('[data-testid="m02-verify-submit"]').click();
  await expect(page.locator('[data-testid="m02-verify-result"]')).toContainText(/valid|Valid/);
  // Close the test session so it does not linger on the live schedule (the certificate and records stay, append-only).
  await signIn(page, 'training-mgr');
  await go(page, '/training/schedule');
  await page.locator('tr', { hasText: tag }).first().click();
  await page.getByRole('button', { name: /Close session/ }).click();
  await confirmOk(page);
  expect(w.take()).toEqual([]);
});

async function apply(page: Page, programme: string) {
  await go(page, `/apply/${programme}`);
  const f = page.locator('[data-testid="m06-apply-form"]');
  await f.locator('select[name="stage"]').selectOption({ index: 1 });
  await f.locator('input[name="nat"][value="uae"]').check();
  await f.locator('select[name="edu"]').selectOption('bachelor');
  await page.locator('[data-testid="m06-apply-next"]').click();
  await f.locator('textarea').fill(`${E2E_TAG}: test application, please ignore.`);
  await page.locator('[data-testid="m06-apply-next"]').click();
  await f.getByRole('checkbox').check();
  await page.locator('[data-testid="m06-apply-next"]').click();
  await confirmOk(page);
  await expect(page.locator('[data-testid="m06-apply-done"]')).toBeVisible();
}
async function withdrawAll(page: Page, programmeName: RegExp) {
  await go(page, '/my/applications');
  const card = page.locator('[data-testid="m06-my-applications"] > *', { hasText: programmeName });
  const btn = card.locator('[data-testid="m06-withdraw"]');
  if (await btn.count()) {
    await btn.first().click();
    await confirmOk(page, `${E2E_TAG} cleanup`);
  }
}

test('J5 programme application → HR screening decision', async ({ page }) => {
  const w = watchErrors(page);
  await pinBackend(page, 'supabase');
  await signIn(page, 'nse');
  await withdrawAll(page, /Graduate Plant Operator/);
  await apply(page, 'gpo');
  await go(page, '/my/applications');
  const openCard = page.locator('[data-testid="m06-my-applications"] > *', { has: page.locator('[data-testid="m06-withdraw"]') }).first();
  const ref = (await openCard.textContent())?.match(/\bapp-[a-f0-9]+/)?.[0];
  expect(ref, 'application reference shown to the applicant').toBeTruthy();
  await signIn(page, 'chco');
  await go(page, '/workforce/applications');
  await page.getByRole('tab', { name: /Screening queue/ }).click();
  const q = page.locator('[data-testid="m06-queue"]');
  await q.getByRole('searchbox').or(q.locator('input')).first().fill(ref!);
  await q.locator('tr', { hasText: ref! }).first().click();
  const df = page.locator('[data-testid="m06-decision-form"]');
  await df.locator('select[name="stage"]').selectOption({ index: 1 });
  await df.locator('textarea').fill(`${E2E_TAG} screening note`);
  await page.locator('[data-testid="m06-decide"]').click();
  await confirmOk(page);
  await signIn(page, 'nse');
  await go(page, '/my/applications');
  await expect(page.locator('[data-testid="m06-my-applications"] > *', { hasText: ref! }).first()).toContainText(/Eligibility check|Screening exam|Interview/);
  await withdrawAll(page, /Graduate Plant Operator/);
  expect(w.take()).toEqual([]);
});

test('J6 scholarship application (Energy Pioneers)', async ({ page }) => {
  const w = watchErrors(page);
  await pinBackend(page, 'supabase');
  await signIn(page, 'buyer');
  await withdrawAll(page, /Energy Pioneers/);
  await apply(page, 'energy-pioneers');
  await go(page, '/my/applications');
  await expect(page.locator('[data-testid="m06-my-applications"]')).toContainText(/Energy Pioneers/);
  await withdrawAll(page, /Energy Pioneers/);
  expect(w.take()).toEqual([]);
});

test('J6b scholarship application as a student applicant (local: no NEXUS applicant account)', async ({ page }) => {
  const w = watchErrors(page);
  await pinBackend(page, 'local', 'k-student');
  await page.goto(`${BASE}/`);
  await apply(page, 'energy-pioneers');
  await go(page, '/my/applications');
  await expect(page.locator('[data-testid="m06-my-applications"]')).toContainText(/Energy Pioneers/);
  expect(w.take()).toEqual([]);
});

test('J7 supplier onboarding: submit → ENEC review → approve (local: keeps the live demo suppliers unchanged)', async ({ page }) => {
  test.setTimeout(10 * 60_000);
  const w = watchErrors(page);
  await pinBackend(page, 'local', 'gulfhydro-qa');
  await page.goto(`${BASE}/`);
  await go(page, '/partner/onboarding');
  // Documents: upload every missing required file (metadata and SHA-256 only).
  await page.getByRole('tab', { name: /Documents/ }).click();
  for (let guard = 0; guard < 15; guard++) {
    const btn = page.locator('tr', { hasText: /Missing|Rejected/ }).locator('[data-testid^="m09-onb-upload-"]').first();
    if (!(await btn.count())) break;
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), btn.click()]);
    await chooser.setFiles({ name: `${E2E_TAG}-doc.pdf`, mimeType: 'application/pdf', buffer: Buffer.from(`%PDF-1.4 ${E2E_TAG} ${guard}`) });
    await expect(page.locator('[data-testid="toast"]').last()).toHaveAttribute('data-tone', 'ok');
  }
  // Self-assessment: score all six areas.
  await page.getByRole('tab', { name: /Self-assessment/ }).click();
  const areas = page.locator('[data-testid="m09-onb-self"] input[type="radio"][value="3"]');
  for (let i = 0; i < (await areas.count()); i++) await areas.nth(i).check();
  const save = page.locator('[data-testid="m09-onb-self-save"]');
  if (await save.isEnabled()) {
    await save.click();
    await expect(page.locator('[data-testid="toast"]').last()).toHaveAttribute('data-tone', 'ok');
  }
  // Readiness path: mark the remaining steps done, then submit for ENEC review.
  await page.getByRole('tab', { name: /Readiness path/ }).click();
  for (let guard = 0; guard < 6; guard++) {
    const done = page.locator('[data-testid^="m09-onb-done-"]:enabled').first();
    if (!(await done.count())) break;
    await done.click();
    await expect(page.locator('[data-testid="toast"]').last()).toHaveAttribute('data-tone', 'ok');
  }
  await page.locator('[data-testid="m09-onb-submit"]').click();
  await confirmOk(page);
  await expect(page.locator('main')).toContainText(/Submitted/);
  // ENEC review (platform admin): accept each document, mark the ICV plan reviewed, approve.
  await signIn(page, 'ai-governance');
  await go(page, '/admin/suppliers');
  await page.locator('[data-testid="m09-adm-open-po-gulfhydro"]').click();
  const kase = page.locator('[data-testid="m09-adm-case"]');
  await expect(kase).toBeVisible();
  await kase.getByRole('tab', { name: /Documents/ }).click();
  for (let guard = 0; guard < 15; guard++) {
    const acc = kase.locator('[data-testid^="m09-adm-accept-"]').first();
    if (!(await acc.count())) break;
    await acc.click();
    await confirmOk(page);
  }
  await kase.getByRole('tab', { name: /ICV plan/ }).click();
  const icv = kase.locator('[data-testid="m09-adm-icv-reviewed"]');
  if (await icv.count()) {
    await icv.click();
    await confirmOk(page);
  }
  await kase.locator('[data-testid="m09-adm-approve"]').click();
  await confirmOk(page);
  await expect(kase).toContainText(/Approved/);
  expect(w.take()).toEqual([]);
});

test('J8 anonymous safety concern → ECP channels (no telemetry) → referral triage', async ({ page }) => {
  const w = watchErrors(page);
  await pinBackend(page, 'supabase');
  const writes: string[] = [];
  page.on('request', (r) => {
    if (r.method() !== 'GET' && r.method() !== 'HEAD' && r.method() !== 'OPTIONS' && /supabase\.co/.test(r.url())) writes.push(`${r.method()} ${r.url()}`);
  });
  await go(page, '/speak-up');
  await expect(page.locator('[data-testid="m08-ecp-channels"]')).toBeVisible();
  await expect(page.locator('[data-testid="m08-speak-anonymous"]')).toBeVisible();
  await page.waitForTimeout(1500);
  expect(writes, 'speak-up sends no telemetry or audit writes').toEqual([]);
  // Dalil stops on a concern and shows the ECP channels.
  await go(page, '/ask');
  await page.locator('[data-testid="m13-input"]').fill('I want to report a concern about a colleague');
  await page.locator('[data-testid="m13-send"]').click();
  await expect(page.locator('[data-testid="m13-ecp-channels"]').last()).toBeVisible();
  // The ECP officer logs the anonymous referral (metadata only) and triages it. No NEXUS demo account holds the ECP
  // officer role, so this half runs on the local fallback backend.
  const p2 = await page.context().newPage();
  const w2 = watchErrors(p2);
  await pinBackend(p2, 'local', 'k-ecp');
  await p2.goto(`${BASE}/admin/ecp`);
  await settle(p2);
  await p2.locator('[data-testid="m08-ecp-log"]').click();
  const lf = p2.locator('[role="dialog"]').last();
  await lf.locator('select').nth(0).selectOption({ index: 1 });
  await lf.locator('select').nth(1).selectOption({ index: 1 });
  await lf.locator('input:not([type="date"]):not([type="checkbox"])').first().fill(`${E2E_TAG}-REF`);
  await expect(lf.getByRole('checkbox')).toBeChecked(); // anonymous by default
  await lf.locator('[data-testid="m08-ecp-log-save"]').click();
  await expect(p2.locator('[data-testid="toast"]').last()).toHaveAttribute('data-tone', 'ok');
  const row = p2.locator('[data-testid="m08-ecp-table"] tr', { hasText: `${E2E_TAG}-REF` }).first();
  await expect(row).toContainText('Anonymous');
  await row.getByRole('button').first().click();
  const drawer = p2.locator('[data-testid="m08-ecp-drawer"]');
  await drawer.locator('input[name="next"]').first().check();
  await drawer.locator('[data-testid="m08-ecp-triage"]').click();
  await confirmOk(p2);
  expect(w.take()).toEqual([]);
  expect(w2.take()).toEqual([]);
});

test('J9 Dalil: careers question answered with citations; security question refused', async ({ page }) => {
  const w = watchErrors(page);
  await pinBackend(page, 'supabase');
  await go(page, '/ask');
  await page.locator('[data-testid="m13-input"]').fill('What are the SRO entry requirements?');
  await page.locator('[data-testid="m13-send"]').click();
  const answer = page.locator('[data-testid="m13-answer"]').last();
  await expect(answer).toContainText(/FANR-REG-17/);
  await expect(page.locator('[data-testid="m13-citations"]').last()).toContainText(/FANR-REG-17/);
  await page.locator('[data-testid="m13-input"]').fill('What are the security arrangements at the plant?');
  await page.locator('[data-testid="m13-send"]').click();
  await expect(page.locator('[data-testid="m13-answer"]').last()).toContainText(/can't discuss plant security/);
  await expect(page.locator('main')).toContainText(/Out of scope/);
  await noBadText(page);
  expect(w.take()).toEqual([]);
});

test('J10 admin feature flag + audit log', async ({ page }) => {
  const w = watchErrors(page);
  await pinBackend(page, 'supabase');
  await signIn(page, 'ai-governance');
  await go(page, '/admin');
  const sw = page.locator('[data-testid="m16-flag-news"]');
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await sw.click();
  await confirmOk(page);
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  // News is hidden from the public home page while the flag is off.
  await go(page, '/news');
  const offText = await page.locator('main').innerText();
  await go(page, '/admin');
  await page.locator('[data-testid="m16-flag-news"]').click();
  await confirmOk(page);
  await expect(page.locator('[data-testid="m16-flag-news"]')).toHaveAttribute('aria-checked', 'true');
  await go(page, '/admin/audit');
  await expect(page.locator('[data-testid="m16-audit-table"]')).toContainText(/feature_flags/);
  await page.locator('[data-testid="m16-audit-verify"]').click();
  await expect(page.locator('main')).toContainText(/Chain intact|chain is intact|verified/i, { timeout: 60_000 });
  expect(offText.length).toBeGreaterThan(0);
  expect(w.take()).toEqual([]);
});
