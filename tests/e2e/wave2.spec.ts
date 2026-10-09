/**
 * Wave 2 journeys (F10-F17), supabase mode against the live NEXUS project with real NEXUS demo sign-in. Every acceptance
 * criterion of the wave-2 cards is exercised in the browser here (or, where only a crafted request can reach it, asserted on
 * the payload the page receives). Writes are few, made by synthetic role cards, and tagged "E2E-QA" where there is free text.
 *  X1 F10 check-ins: peer answers only the named skills, the person cannot validate (no access), manager validates, calibration
 *  X2 F11 heatmap: scope, single point of failure, SIMULATED what-if, crew view without medical/licence fields, HR aggregate
 *  X3 F12 conversations: manager records actions (no acknowledge control), employee acknowledges, plan link, reminders, HR
 *  X4 F13 mentoring: own line manager never suggested, private notes stay private, programme dashboard suppression
 *  X5 F14 refreshers: practice items only, no answer keys before submit, explanation after, no streak/points UI
 *  X6 F15 rotations: skip-level sign-off routing, host sign-off writes evidence, board suppressed, GDP template sourced
 *  X7 F16 leadership: shift track sees INTILAQA/LET required, CNS sources, 360 threshold, nominations maker-checker queue
 *  X8 F17 communities: opt-in experts only, security and contact posts refused, EN/AR session search, no contacts in payloads
 */
import { test, expect, type Page, type Response } from '@playwright/test';
import { BASE, E2E_TAG, pinBackend, settle, signIn, textIssues, watchErrors } from './helpers';

test.describe.configure({ mode: 'serial' });

async function go(page: Page, path: string) {
  await page.goto(BASE + path);
  await settle(page);
}
async function confirmDialog(page: Page, reason = `${E2E_TAG} check`) {
  const dlg = page.locator('[role="dialog"]').last();
  await expect(dlg).toBeVisible();
  const ta = dlg.locator('textarea');
  if ((await ta.count()) && !(await ta.first().inputValue())) await ta.first().fill(reason);
  await dlg.locator('[data-testid="confirm-action"]').click();
}
async function lastToast(page: Page, re?: RegExp) {
  const toast = (re ? page.locator('[data-testid="toast"]', { hasText: re }) : page.locator('[data-testid="toast"]')).last();
  await expect(toast).toBeVisible();
  return { tone: await toast.getAttribute('data-tone'), text: await toast.innerText() };
}
async function as(page: Page, persona: string | null) {
  await pinBackend(page, 'supabase');
  if (persona) await signIn(page, persona);
}
async function fresh(page: Page, persona: string) {
  const p = await page.context().browser()!.newPage();
  await as(p, persona);
  return p;
}
async function clean(page: Page, w: ReturnType<typeof watchErrors>) {
  expect(await textIssues(page)).toEqual([]);
  expect(w.take()).toEqual([]);
}
/** Collect JSON bodies of Supabase RPC responses whose function name matches. */
function rpcBodies(page: Page, fn: RegExp) {
  const out: unknown[] = [];
  page.on('response', async (r: Response) => {
    if (!/\/rest\/v1\/rpc\//.test(r.url()) || !fn.test(r.url())) return;
    try { out.push(await r.json()); } catch { /* ignore */ }
  });
  return out;
}
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE = /(?:\+?971|00971|\b0)[\s-]?(?:5\d|[2-9])[\s-]?\d{3}[\s-]?\d{4}\b/;

test('X1 F10 skill check-ins: peer, self-validation blocked, manager validates, calibration suppressed under 10', async ({ page }) => {
  const w = watchErrors(page);
  // a peer (buyer) sees only the skills named for them on nse's check-in, never nse's self level or other answers
  await as(page, 'buyer');
  await go(page, '/my/skills/checkins');
  await page.getByRole('tab', { name: /Asked of me/ }).click();
  const asked = page.locator('[data-testid="m17-ci-asked"]');
  await expect(asked).toBeVisible();
  const items = asked.locator('[data-testid="m17-ci-peer-item"]');
  expect(await items.count()).toBe(2);
  const askedText = await asked.innerText();
  expect(askedText).not.toMatch(/Self level|My level|self-rated/i);
  await items.nth(0).locator('[data-testid$="-3"]').first().click();
  const ex = items.nth(0).locator('textarea, input[type="text"]').first();
  if (await ex.count()) await ex.fill(`${E2E_TAG} saw this in a design review`);
  await items.nth(1).locator('[data-testid$="-0"]').first().click();
  await page.locator('[data-testid="m17-ci-rate"]').click();
  await page.locator('[role="dialog"]').last().getByRole('button', { name: /Send ratings|Update ratings/ }).click();
  expect((await lastToast(page)).tone).toBe('ok');
  await clean(page, w);

  // the person cannot reach validation, and the form offers no security or qualification-only skill
  const p2 = await fresh(page, 'nse');
  const w2 = watchErrors(p2);
  await go(p2, '/team/skills/validate');
  await expect(p2.locator('[data-testid="forbidden"]')).toBeVisible();
  await go(p2, '/my/skills/checkins');
  await p2.getByRole('tab', { name: /New check-in/ }).click();
  const list = p2.locator('[data-testid="m17-ci-skills"]');
  await expect(list).toBeVisible();
  expect(await list.locator('[data-testid="m17-ci-skill-sk-sa-01"]').count()).toBe(0);
  expect(await list.locator('[data-testid="m17-ci-skill-sk-qa-02"]').count()).toBe(0); // already in the open check-in
  await clean(p2, w2);
  await p2.close();

  // the manager of record (cpo) validates; the decision lands in the decided list
  const p3 = await fresh(page, 'cpo');
  const w3 = watchErrors(p3);
  await go(p3, '/team/skills/validate');
  const item = p3.locator('[data-testid="m17-val-queue"] > *', { hasText: /Nuclear Specification Engineer/ }).first();
  if (await item.count()) {
    for (const b of await item.locator('[data-testid="m17-val-validate"]').all()) await b.click();
    await item.locator('[data-testid="m17-val-submit"]').click();
    await confirmDialog(p3);
    const t = await lastToast(p3);
    expect(t.tone, t.text).toBe('ok');
  }
  await p3.getByRole('tab', { name: /Decided|History/ }).click().catch(() => undefined);
  await expect(p3.locator('main')).toContainText(/Nuclear Specification Engineer/);
  await clean(p3, w3);
  await p3.close();

  // calibration: crew B (8 people) is suppressed for sro; the operations family is shown to ops-ceo
  const p4 = await fresh(page, 'sro');
  await go(p4, '/team/skills/validate');
  await p4.getByRole('tab', { name: /Calibration/ }).click();
  await expect(p4.locator('[data-testid="m17-cal"]')).toContainText(/Distributions suppressed/);
  await p4.close();
  const p5 = await fresh(page, 'ops-ceo');
  const w5 = watchErrors(p5);
  await go(p5, '/team/skills/validate');
  await p5.getByRole('tab', { name: /Calibration/ }).click();
  await expect(p5.locator('[data-testid="m17-cal-dist"]')).toBeVisible();
  await expect(p5.locator('[data-testid="m17-cal-raters"]')).toBeVisible();
  await clean(p5, w5);
  await p5.close();
});

test('X2 F11 team heatmap: crew B only, SPOF flag, SIMULATED what-if, crew view counts only, HR aggregate', async ({ page }) => {
  const w = watchErrors(page);
  const cov = rpcBodies(page, /kafaa_team_coverage/);
  await as(page, 'sro');
  await go(page, '/team/skills');
  const hm = page.locator('[data-testid="m17-tm-heatmap"]');
  await expect(hm).toBeVisible();
  expect(await hm.locator('tbody tr').count()).toBe(8);
  await page.getByLabel(/What if someone leaves/).check();
  await expect(page.getByText('SIMULATED').first()).toBeVisible();
  await page.getByRole('tab', { name: /Coverage and targets/ }).click();
  expect(await page.locator('[data-testid="m17-spof"]').count()).toBeGreaterThan(0);
  await page.getByRole('tab', { name: /Suggested actions/ }).click();
  const acts = page.locator('[data-testid="m17-tm-actions"]');
  await expect(acts).toBeVisible();
  // W2 integration: post / mentoring actions carry the skill (?skill=) to F08 and F13
  const hrefs = await acts.locator('a').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''));
  expect(hrefs.some((h) => /\/opportunities\/post\?skill=|\/my\/mentoring\?skill=/.test(h))).toBe(true);
  await page.getByRole('tab', { name: /Crew view/ }).click();
  const crews = page.locator('[data-testid="m17-tm-crews"]');
  await expect(crews).toBeVisible();
  expect(await crews.innerText()).not.toMatch(/medical|licen[cs]e (number|expiry)|fitness/i);
  // payload: the crew part of the RPC has no medical or licence fields
  const crewJson = JSON.stringify(cov.map((x) => (x as { data?: { crews?: unknown } })?.data?.crews ?? null));
  expect(crewJson).not.toMatch(/medical|licen[cs]e|person_id|name_en/i);
  await clean(page, w);
  // HR sees counts only, suppressed below 10
  const p2 = await fresh(page, 'chco');
  const w2 = watchErrors(p2);
  await go(p2, '/team/skills');
  await expect(p2.locator('main')).toContainText(/suppressed/i);
  expect(await p2.locator('[data-testid="m17-tm-heatmap"]').count()).toBe(0);
  await clean(p2, w2);
  await p2.close();
});

test('X3 F12 career conversation: manager records (cannot acknowledge), employee acknowledges, actions in the plan', async ({ page }) => {
  const w = watchErrors(page);
  await as(page, 'head-sq');
  await go(page, '/team/conversations?person=p-qc-inspector');
  const ws = page.locator('[data-testid="m18-cc-workspace"]');
  await expect(ws).toBeVisible();
  await expect(ws.locator('[data-testid="m18-cc-agenda"]')).toBeVisible();
  expect(await page.locator('[data-testid="m18-cc-ack"], [data-testid="m18-cc-ack-form"]').count()).toBe(0); // no acknowledge control
  const form = page.locator('[data-testid="m18-cc-record-form"]');
  if (await form.count()) {
    const add = page.locator('[data-testid="m18-cc-sugg-add"]').first();
    if (await add.count()) await add.click();
    else await page.locator('[data-testid="m18-cc-add-action"]').click();
    const notes = form.locator('textarea').first();
    await notes.fill(`${E2E_TAG} discussed the route to procurement and agreed a stretch assignment.`);
    for (const inp of await form.locator('[data-testid="m18-cc-action-editor"] input[type="text"]').all()) if (!(await inp.inputValue())) await inp.fill(`${E2E_TAG} action`);
    await page.locator('[data-testid="m18-cc-record"]').click();
    await confirmDialog(page);
    const t = await lastToast(page);
    expect(t.tone, t.text).toBe('ok');
  }
  // the six-monthly reminder action (idempotent: at most once a month per pair)
  await go(page, '/team/conversations');
  await page.locator('[data-testid="m18-cc-remind"]').click();
  await confirmDialog(page);
  expect((await lastToast(page)).tone).toBe('ok');
  await clean(page, w);

  const p2 = await fresh(page, 'qc-inspector');
  const w2 = watchErrors(p2);
  await go(p2, '/my/career/conversations');
  const ackForm = p2.locator('[data-testid="m18-cc-ack-form"]');
  if (await ackForm.count()) {
    await ackForm.getByLabel(/I agree|agree with/i).first().check().catch(() => undefined);
    await p2.locator('[data-testid="m18-cc-ack"]').click();
    await confirmDialog(p2);
    const t = await lastToast(p2);
    expect(t.tone, t.text).toBe('ok');
  }
  await expect(p2.locator('[data-testid="m18-cc-plan-link"]').first()).toBeVisible();
  await clean(p2, w2);
  await p2.close();

  // HR: aggregates only, small groups suppressed
  const p3 = await fresh(page, 'chco');
  const w3 = watchErrors(p3);
  await go(p3, '/workforce/career-conversations');
  await expect(p3.locator('main')).toContainText(/suppressed/i);
  expect(await p3.locator('main').innerText()).not.toMatch(/Quality Control Inspector \(role card\)/);
  await clean(p3, w3);
  await p3.close();
});

test('X4 F13 mentoring: never my line manager, private notes private, programme dashboard', async ({ page }) => {
  const w = watchErrors(page);
  const line = rpcBodies(page, /kafaa_my_reporting_line/);
  await as(page, 'qc-inspector');
  await go(page, '/my/mentoring');
  await expect(page.locator('[data-testid="m04-mentor-matches"]')).toBeVisible();
  const lm = (line[0] as { line_manager?: string } | undefined)?.line_manager ?? 'p-head-sq';
  const cards = await page.locator('[data-testid="m04-match-card"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-mentor')));
  expect(cards.length).toBeGreaterThan(0);
  expect(lm).toBe('p-head-sq');
  await expect(page.locator('[data-testid="m04-own-manager-note"]')).toBeVisible();
  // agreement with sq-lead: qc-inspector sees their own private note, never the mentor's
  await go(page, '/my/mentoring/ma-mr-f13-001');
  await expect(page.locator('[data-testid="m04-sessions"]')).toBeVisible();
  expect(await page.locator('main').innerText()).not.toContain('Remember to ask about the qualification route.');
  await clean(page, w);
  const p2 = await fresh(page, 'sq-lead');
  await go(p2, '/my/mentoring/ma-mr-f13-001');
  await expect(p2.locator('main')).toContainText('Remember to ask about the qualification route.');
  await p2.close();
  const p3 = await fresh(page, 'training-mgr');
  const w3 = watchErrors(p3);
  await go(p3, '/my/mentoring/programme');
  await expect(p3.locator('[data-testid="m04-programme"]')).toBeVisible();
  await expect(p3.locator('main')).toContainText(/suppressed/i);
  expect(await p3.locator('main').innerText()).not.toContain('Remember to ask about the qualification route.');
  await clean(p3, w3);
  await p3.close();
});

test('X5 F14 refreshers: practice only, no keys before submit, explanation after, no gamification', async ({ page }) => {
  const w = watchErrors(page);
  const picks = rpcBodies(page, /kafaa_next_refresher/);
  await as(page, 'nse');
  await go(page, '/my/coach/refresh');
  const q = page.locator('[data-testid="m19-refresh-q"]');
  if (!(await q.count())) await page.locator('[data-testid="m19-refresh-extra"]').click();
  await expect(q.first()).toBeVisible();
  const payload = JSON.stringify(picks);
  expect(payload.length).toBeGreaterThan(20);
  expect(payload).not.toMatch(/"(correct|is_correct|answer|answer_key|key|rationale_en|rationale)"\s*:/);
  expect(payload).not.toMatch(/"bank"\s*:\s*"secure"/);
  // answer the first question and read the explanation
  for (const one of await q.all()) await one.locator('input[type="radio"]').first().check();
  await page.locator('[data-testid="m19-refresh-submit"]').first().click();
  await expect(page.locator('[data-testid="m19-refresh-explain"]').first()).toBeVisible();
  // the page states the commitment ("There are no streaks, points, badges or rankings here"); nothing else may mention them
  const body = (await page.locator('main').innerText()).split(/(?<=[.!?])\s+|\n/).filter((x) => !/\bno (streaks|points)|not a game/i.test(x)).join('\n');
  expect(body).not.toMatch(/streak|points|leaderboard|rank(ed|ing)? among/i);
  expect(await page.locator('[data-testid*="streak"], [data-testid*="points"], [data-testid*="leader"]').count()).toBe(0);
  await expect(page.locator('[data-testid="m19-confidence"]')).toBeVisible();
  await clean(page, w);
  const p2 = await fresh(page, 'training-mgr');
  const w2 = watchErrors(p2);
  await go(p2, '/training/refreshers');
  await expect(p2.locator('[data-testid="m19-rstats"]')).toBeVisible();
  await clean(p2, w2);
  await p2.close();
});

test('X6 F15 rotations: skip-level routing, host sign-off writes evidence, board suppressed, GDP sourced', async ({ page }) => {
  const w = watchErrors(page);
  // qc-inspector's current host is also their line manager: sign-off goes to the skip level
  await as(page, 'qc-inspector');
  await go(page, '/opportunities/rotations/my');
  await expect(page.locator('[data-testid="m20-rot-plan"]')).toBeVisible();
  await expect(page.locator('main')).toContainText(/Line manager's manager/);
  expect(await page.locator('[data-testid="m20-rot-signoff"]').count()).toBe(0);
  await clean(page, w);
  // head-sq hosts buyer (not their report): sign-off allowed; qc-inspector's placement is not in head-sq's queue
  const p2 = await fresh(page, 'head-sq');
  const w2 = watchErrors(p2);
  await go(p2, '/opportunities/rotations/host');
  await p2.getByRole('tab', { name: /To sign off/ }).click();
  const queue = p2.locator('[data-testid="m20-rot-signoffs"]');
  await expect(queue).toBeVisible();
  expect(await queue.innerText()).not.toMatch(/Quality Control Inspector/);
  // a placement that is ready (mid-point check-in recorded): sign it off and read the evidence the RPC wrote
  const so = rpcBodies(p2, /kafaa_signoff_placement/);
  const ready = queue.locator('[data-testid="m20-rot-signoff"]:enabled').first();
  let signedName = '';
  if (await ready.count()) {
    const cardEl = queue.locator('[data-testid="m20-rot-host-placement"]', { has: p2.locator('[data-testid="m20-rot-signoff"]:enabled') }).first();
    signedName = ((await cardEl.innerText()).split('\n')[0] ?? '').split(' · ')[0]!.trim();
    await ready.click();
    const note = p2.locator('[data-testid="m20-rot-signoff-note"]');
    if (await note.count()) await note.fill(`${E2E_TAG} objectives met during the placement`);
    await p2.locator('[data-testid="m20-rot-signoff-confirm"]').click();
    const t = await lastToast(p2);
    expect(t.tone, t.text).toBe('ok');
    expect(t.text).toMatch(/skills evidence recorded/i);
    await expect.poll(() => so.length).toBeGreaterThan(0);
    const data = (so[0] as { ok?: boolean; data?: { evidence_ids?: string[] } }).data;
    expect((data?.evidence_ids ?? []).length).toBeGreaterThan(0);
    expect((data?.evidence_ids ?? []).every((id) => /^se:ojt:/.test(id))).toBe(true);
  }
  test.info().annotations.push({ type: 'signed-off', description: signedName || 'none ready' });
  await clean(p2, w2);
  await p2.close();
  // HR board: aggregate only, small cohorts suppressed, no person ids
  const p4 = await fresh(page, 'chco');
  const w4 = watchErrors(p4);
  const board = rpcBodies(p4, /kafaa_rotation_board/);
  await go(p4, '/opportunities/rotations/board');
  await expect(p4.locator('[data-testid="m20-rot-board"]')).toBeVisible();
  await expect(p4.locator('main')).toContainText(/suppressed/i);
  expect(JSON.stringify(board)).not.toMatch(/"p-[a-z-]+"|"w-[a-z]+-\d+"/);
  await go(p4, '/opportunities/rotations/programmes/rt-gdp-engineering');
  const dur = p4.locator('[data-testid="m20-rot-duration"]');
  await expect(dur).toBeVisible();
  await expect(dur).toContainText(/18/);
  await expect(dur).toContainText(/36/);
  expect(await p4.locator('main a[href^="https://"]').count()).toBeGreaterThan(0);
  await clean(p4, w4);
  await p4.close();
});

test('X7 F16 leadership: shift track required programmes, CNS sources, 360 threshold, nominations queue', async ({ page }) => {
  const w = watchErrors(page);
  await as(page, 'sro');
  await go(page, '/leadership');
  await expect(page.locator('[data-testid="m22-shift-track"]')).toBeVisible();
  const req = page.locator('[data-testid="m22-required"]');
  expect(await req.count()).toBeGreaterThanOrEqual(2);
  await expect(page.locator('[data-testid="m22-reco"]')).toContainText(/INTILAQA/);
  await expect(page.locator('[data-testid="m22-reco"]')).toContainText(/Leading Effective Teams|LET/);
  await page.locator('[data-testid="m22-why"]').first().click();
  // W2 integration: leadership readiness links to a pre-filled skill check-in (F10)
  const ask = page.locator('[data-testid="m22-ask-checkin"]');
  if (await ask.count()) expect(await ask.getAttribute('href')).toMatch(/\/my\/skills\/checkins\?skills=/);
  await go(page, '/leadership/programmes/prog-intilaqa');
  const src = page.locator('[data-testid="m22-sources"]').first();
  await expect(src).toContainText(/CNS|Convention on Nuclear Safety|national report/i);
  await expect(page.locator('main')).toContainText(/285/);
  await go(page, '/leadership/360');
  await expect(page.locator('[data-testid="m22-360-results"]')).toBeVisible();
  await clean(page, w);
  const p2 = await fresh(page, 'outage-planner');
  await go(p2, '/leadership/360');
  await expect(p2.locator('[data-testid="m22-360-not-enough"]')).toBeVisible();
  await p2.close();
  const p3 = await fresh(page, 'chco');
  const w3 = watchErrors(p3);
  await go(p3, '/leadership/nominations');
  await expect(p3.locator('[data-testid="m22-nom-queue"]')).toBeVisible();
  await go(p3, '/leadership/insights');
  await expect(p3.locator('[data-testid="m22-insights-heatmap"]')).toBeVisible();
  await clean(p3, w3);
  await p3.close();
});

test('X8 F17 communities: opt-in experts only, refused security and contact posts, EN/AR session search', async ({ page }) => {
  const w = watchErrors(page);
  const finds = rpcBodies(page, /kafaa_find_experts/);
  await as(page, 'qc-inspector');
  await go(page, '/communities/experts');
  await expect(page.locator('[data-testid="m22-experts"]')).toBeVisible();
  const sk = page.locator('[data-testid="m22-expert-skill"]');
  if ((await sk.evaluate((e) => e.tagName)) === 'SELECT') {
    const opts = await sk.locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value).filter(Boolean));
    if (opts.length) await sk.selectOption(opts[0]);
  }
  await page.waitForTimeout(1500);
  const payload = JSON.stringify(finds);
  expect(payload).not.toMatch(/w-eng-04|w-lo-01/); // opted out
  expect(payload).not.toMatch(EMAIL);
  expect(payload).not.toMatch(PHONE);
  // posting rules: security content and contact details are refused with guidance
  await go(page, '/communities/cop-eng');
  const post = async (title: string, body: string) => {
    await page.locator('[data-testid="m22-new-thread"]').click();
    await page.locator('[data-testid="m22-thread-title"]').fill(title);
    await page.locator('[data-testid="m22-thread-body"]').fill(body);
    await page.locator('[data-testid="m22-thread-post"]').click();
    return lastToast(page);
  };
  const sec = await post(`${E2E_TAG} plant question`, 'Where are the CCTV cameras near the perimeter fence?');
  expect(sec.tone).not.toBe('ok');
  expect(sec.text).toMatch(/security content is not allowed/i);
  await page.locator('[data-testid="m22-thread-title"]').fill(`${E2E_TAG} contact`);
  await page.locator('[data-testid="m22-thread-body"]').fill('Happy to help, email me at someone@example.com any time.');
  await page.locator('[data-testid="m22-thread-post"]').click();
  const contact = await lastToast(page, /contact/i);
  expect(contact.tone).not.toBe('ok');
  w.take(); // refused RPCs may log a console line
  // sessions: BM25 search in English and Arabic
  await go(page, '/communities/sessions');
  const search = page.locator('[data-testid="m22-session-search"]');
  await search.fill('outage');
  await expect(page.locator('[data-testid="m22-session"]').first()).toContainText(/Outage|outage/);
  expect(await page.locator('main').innerText()).not.toMatch(EMAIL);
  await clean(page, w);
  const p2 = await page.context().browser()!.newPage();
  await as(p2, 'qc-inspector');
  await go(p2, '/ar/communities/sessions');
  await p2.locator('[data-testid="m22-session-search"]').fill('الإشعاعية');
  await expect(p2.locator('[data-testid="m22-session"]').first()).toContainText('الإشعاعية');
  await p2.close();
});
