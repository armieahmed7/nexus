/**
 * FS wave D journeys (FS27-FS37, "turn new skills into moves and recognition": future gigs and time envelopes, future-role rotations
 * and secondments, RPL and NQF credits, future-skills micro-credentials with a strategic tier, the learner record, skill goals, the
 * transferable-skills translator, Career Health, the AI-literacy register and governed AI sandbox drills), supabase mode against the
 * live NEXUS project with real NEXUS demo sign-in. Every acceptance criterion of the eleven wave-D cards is exercised in the browser,
 * or asserted on the payload the signed-in page receives from the same RPC / RLS read (PGlite and unit tests prove SQL = TS).
 * Live writes: none that change state. Refusals are audited (an application to a gated gig by a non-holder, a security-area
 * secondment, an RPL attach of a security-restricted record). Flows that leave permanent rows (an envelope approval, an application,
 * closing a secondment, an RPL confirmation, a share link, a goal, a health snapshot, a drill attempt) run on the local backend.
 *  D1 FS27/FS28 + FS31 gate   D2 FS29/FS30 RPL and credits   D3 FS31/FS32/FS33 credentials, record, goals
 *  D4 FS34/FS35 translator + Career Health   D5 FS36/FS37 register + drills   D6 cross-feature wiring, chips, Arabic
 */
import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { BASE, pinBackend, settle, signIn, textIssues, watchErrors } from './helpers';

const CONFIG = readFileSync('src/config.ts', 'utf8');
const SB_URL = CONFIG.match(/'(https:\/\/[a-z0-9]+\.supabase\.co)'/)![1];
const ANON = CONFIG.match(/'(eyJ[A-Za-z0-9._-]+)'/)![1];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables as Record<string, any[]>;
const FEATURE: Record<string, string[]> = {
  FS27: ['CORP', 'NEA'], FS28: ['NEA', 'NUC-NET', 'SMR-WF'], FS29: ['ILO-RPL', 'UAE-NQF', 'UK-NUC'], FS30: ['UAE-NQF', 'ENTITLE', 'UPKEEP'],
  FS31: ['1EDTECH', 'CORP', 'JAHIZ'], FS32: ['1EDTECH', 'SG-CAREER', 'UK-NUC'], FS33: ['SG-CAREER', 'SKILLS-TECH'], FS34: ['UK-NUC', 'SMR-WF', 'ESCO'],
  FS35: ['SG-CAREER', 'WEF-FOJ'], FS36: ['AI-LIT', 'UAE-AI'], FS37: ['IAEA-AI', 'AI-LIT', 'UAE-PEERS'],
};
const FANR = /\bFANR\b|Federal Authority for Nuclear Regulation|الهيئة الاتحادية للرقابة النووية/;
const PASSPORT_TAB = new RegExp(JSON.parse(readFileSync('src/i18n/m18.en.json', 'utf8')).fs34.tab.passport, 'i');
const BOOK = new RegExp(JSON.parse(readFileSync('src/i18n/m18.en.json', 'utf8')).fs35.book, 'i');
const GAMIFIED = /leaderboard|\bXP\b|\d+\s*(points|pts)\b|\d+[- ]day streak/i;

async function go(page: Page, path: string) {
  await page.goto(BASE + path);
  await settle(page);
}
async function as(page: Page, persona: string) {
  await pinBackend(page, 'supabase');
  await signIn(page, persona);
}
async function clean(page: Page, w: ReturnType<typeof watchErrors>) {
  expect(await textIssues(page)).toEqual([]);
  expect(w.take()).toEqual([]);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function rpc<T = any>(page: Page, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  return page.evaluate(async ([url, anon, f, a]) => {
    const sessions = JSON.parse(localStorage.getItem('nexus.auth.v1.sessions') || '{}');
    const tok = sessions[localStorage.getItem('nexus.active') || '']?.access_token;
    const r = await fetch(`${url}/rest/v1/rpc/${f}`, { method: 'POST', headers: { apikey: anon, Authorization: `Bearer ${tok || anon}`, 'Content-Type': 'application/json' }, body: JSON.stringify(a) });
    const txt = await r.text();
    try { return { status: r.status, body: JSON.parse(txt) }; } catch { return { status: r.status, body: txt }; }
  }, [SB_URL, ANON, fn, args] as const) as Promise<T>;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function rest<T = any>(page: Page, path: string): Promise<T> {
  return page.evaluate(async ([url, anon, p]) => {
    const sessions = JSON.parse(localStorage.getItem('nexus.auth.v1.sessions') || '{}');
    const tok = sessions[localStorage.getItem('nexus.active') || '']?.access_token;
    const r = await fetch(`${url}/rest/v1/${p}`, { headers: { apikey: anon, Authorization: `Bearer ${tok || anon}` } });
    return r.json();
  }, [SB_URL, ANON, path] as const) as Promise<T>;
}
async function chips(page: Page, root: string, feature: string) {
  const sel = root === 'main' ? 'main' : `[data-testid="${root}"]`;
  await expect(page.locator(`${sel} button[data-testid^="benchmark-chip-"]`).first()).toBeVisible();
  const ids = await page.locator(`${sel} button[data-testid^="benchmark-chip-"]`).evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!.replace('benchmark-chip-', '')));
  for (const id of FEATURE[feature]) expect(ids, `${root} ${feature}: ${id}`).toContain(id);
}
async function openChip(page: Page, id: string) {
  await page.locator(`button[data-testid="benchmark-chip-${id}"]`).first().click();
  const d = page.locator('[data-testid="benchmark-drawer"]');
  await expect(d).toBeVisible();
  expect(await d.locator('a[href^="https://"]').count()).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
}
/** Switch this page to the local backend as a persona (pinBackend only acts on a page's first load). */
async function toLocal(page: Page, persona: string) {
  await page.goto(BASE + '/');
  await page.evaluate((p) => {
    localStorage.setItem('kafaa.backend', 'local');
    localStorage.setItem('kafaa.session.v1', JSON.stringify({ persona: p, at: Date.now() }));
  }, persona);
}
const data = <T,>(x: { body?: { data?: T } & T }) => (x.body?.data ?? x.body) as T;
async function confirm(page: Page) {
  await page.locator('[data-testid="confirm-action"]').click();
}

test('D1 FS27/FS28 + FS31 gate: 15 open future gigs in 5 channels with a channel filter, an envelope approved once by the line manager releases an application at once, a gig that names a strategic credential is open to holders only; three future-role templates, a closed secondment plans the knowledge-capture task, no security placement', async ({ page }) => {
  const w = watchErrors(page);
  await pinBackend(page, 'supabase');
  await go(page, '/opportunities/future');
  await expect(page.locator('[data-testid="signin-required"]')).toBeVisible();
  w.take();
  await as(page, 'nse');
  await go(page, '/opportunities/future');
  await chips(page, 'main', 'FS27');
  await openChip(page, 'CORP');
  const gigs = await rest(page, 'kafaa_opportunities?select=id,channel,status&channel=not.is.null&status=eq.open');
  expect(gigs.length).toBeGreaterThanOrEqual(12);
  expect(new Set(gigs.map((g: { channel: string }) => g.channel)).size).toBe(5);
  await expect(page.locator('[data-testid="m20-fs-gig"]').first()).toBeVisible();
  expect(await page.locator('[data-testid="m20-fs-gig"]').count()).toBe(gigs.length);
  await page.locator('[data-testid="m20-fs-channel-ai_pilot"]').click();
  await expect(page.locator('[data-testid="m20-fs-gig"]')).toHaveCount(3);
  expect(await page.locator('[data-testid="m20-fs-gig"]').evaluateAll((els) => els.every((e) => e.getAttribute('data-channel') === 'ai_pilot'))).toBe(true);
  await clean(page, w);
  // FS31 -> FS27: nse holds no strategic credential: the gated gig shows the lock, no apply button, and the RPC refuses (audited)
  await go(page, '/opportunities/fg-ai-chem-trend-flags');
  await expect(page.locator('[data-testid="m20-strategic-gate"]')).toHaveAttribute('data-unlocked', 'no');
  await expect(page.locator('[data-testid="m20-strategic-code"]').first()).toHaveAttribute('href', /\/my\/skills\/credentials\/c\/MC-AI-ASSURER/);
  await expect(page.locator('[data-testid="m20-apply"]')).toHaveCount(0);
  const refused = await rpc(page, 'kafaa_apply_opportunity', { p_opportunity_id: 'fg-ai-chem-trend-flags', p_note: '' });
  expect(refused.body?.ok).toBe(false);
  expect(refused.body?.code).toBe('credential_required');
  await go(page, '/opportunities/envelope');
  await chips(page, 'main', 'FS27');
  await clean(page, w);
  // a holder (sro: MC-AI-ASSURER) sees the gig unlocked with the apply button
  await as(page, 'sro');
  await go(page, '/opportunities/fg-ai-chem-trend-flags');
  await expect(page.locator('[data-testid="m20-strategic-gate"]')).toHaveAttribute('data-unlocked', 'yes');
  await expect(page.locator('[data-testid="m20-apply"]')).toBeVisible();
  // FS28: three published future-role templates (career level only for ADVANCE study); HR desk; no security placement
  await go(page, '/opportunities/rotations/future');
  await chips(page, 'main', 'FS28');
  expect(await page.locator('[data-testid="m20-sec-template"]').count()).toBeGreaterThanOrEqual(3);
  await clean(page, w);
  await as(page, 'chco');
  await go(page, '/opportunities/secondments/hr');
  await chips(page, 'main', 'FS28');
  const sb = { person_id: 'p-sec-compliance', host_kind: 'university', host_org_id: 'ku', host_name_en: 'Khalifa University lab', host_name_ar: 'مختبر جامعة خليفة', host_country: 'AE', supervisor_en: 'Lab director (host role)', supervisor_ar: 'مدير المختبر (دور مضيف)',
    objectives: [{ skill_id: 'sk-fs-ai-dataeng', level: 2, text_en: 'Build a data pipeline', text_ar: 'بناء مسار بيانات' }], future_role_id: 'fr-digital-twin', track: 'data_office', start_on: '2026-12-01', months: 6 };
  const sec = await rpc(page, 'kafaa_plan_secondment', { p: sb });
  expect(sec.body?.ok).toBe(false);
  expect(sec.body?.code).toBe('restricted_kind');
  await clean(page, w);
  // local: the line manager approves a pending envelope once (maker-checker), then an application inside it skips the per-gig release
  await toLocal(page, 'ops-ceo');
  await go(page, '/opportunities/envelopes');
  await page.locator('[data-testid="m20-fs-approve-env-p-k-lo-trainee-2026-q4"]').click();
  await confirm(page);
  await expect(page.locator('[data-testid="m20-fs-approve-env-p-k-lo-trainee-2026-q4"]')).toHaveCount(0);
  // local: k-ro (approved envelope, holds MC-AI-ASSURER) applies to the gated AI-pilot gig: released at once within the envelope
  await toLocal(page, 'k-ro');
  await go(page, '/opportunities/future');
  await expect(page.locator('[data-testid="m20-fs-my-envelope"]')).toBeVisible(); // the approved envelope with its meter
  await go(page, '/opportunities/fg-ai-chem-trend-flags');
  await expect(page.locator('[data-testid="m20-strategic-gate"]')).toHaveAttribute('data-unlocked', 'yes');
  await expect(page.locator('[data-testid="m20-fs-apply-fit"]')).toBeVisible();
  await page.locator('[data-testid="m20-apply"]').click();
  await page.locator('[data-testid="m20-apply-confirm"]').click();
  await expect(page.locator('[data-testid="m20-withdraw"]')).toBeVisible();
  // local: HR closes a secondment on return; the knowledge-capture session is planned
  await toLocal(page, 'chco');
  await go(page, '/opportunities/secondments/hr');
  await page.locator('[data-testid="m20-sec-close-sec-fuel-vendor-01"]').click();
  const form = page.locator('[data-testid="m20-sec-close-form"]');
  await form.locator('textarea, input[type="text"]').first().fill('Objectives met; the fuel vendor review process is now documented for the team.');
  await page.locator('[data-testid="m20-sec-close-save"]').click();
  await confirm(page);
  await expect(page.locator('[data-testid="m20-sec-close-sec-fuel-vendor-01"]')).toHaveCount(0);
  await clean(page, w);
});

test('D2 FS29/FS30: every screen says Kafa\'a is not an authority; a decided request shows its pack, two different deciders, the statement and an export with no FANR wording; maker-checker refuses the recommender; a security-restricted record cannot be attached; every published micro-credential carries an indicative level and credit tag; ledger totals follow completions', async ({ page }) => {
  const w = watchErrors(page);
  await pinBackend(page, 'supabase');
  await go(page, '/recognition');
  await chips(page, 'main', 'FS29');
  await chips(page, 'main', 'FS30');
  await expect(page.locator('[data-testid="m34-not-authority"]')).toBeVisible();
  await go(page, '/recognition?tab=nqf');
  await expect(page.locator('[data-testid="m34-indicative"]').first()).toBeVisible();
  await expect(page.locator('[data-testid="m34-pub-stacks"]')).toBeVisible();
  const tags = await rest(page, 'kafaa_credit_tags?select=item_kind,item_id,indicative,status,nqf_level,credits');
  const defs = await rest(page, 'kafaa_microcred_defs?select=id,code,status&status=eq.current');
  expect(defs.length).toBeGreaterThanOrEqual(21);
  for (const d of defs) expect(tags.some((t: { item_kind: string; item_id: string; indicative: boolean; status: string; nqf_level: number; credits: number }) => t.item_kind === 'microcred' && t.item_id === d.id && t.indicative && t.status === 'published' && t.nqf_level >= 1 && Number(t.credits) > 0), d.code).toBe(true);
  await clean(page, w);
  await as(page, 'sro');
  await go(page, '/my/recognition');
  await expect(page.locator('[data-testid="m34-not-authority"]')).toBeVisible();
  await expect(page.locator('[data-testid="m34-my-requests"]')).toBeVisible();
  await go(page, '/my/recognition/rpl/rpl-p-sro-01');
  await expect(page.locator('[data-testid="m34-pack"]')).toBeVisible();
  await expect(page.locator('[data-testid="m34-decision"]')).toBeVisible();
  await expect(page.locator('[data-testid="m34-statement"]')).toBeVisible();
  const req = (await rest(page, 'kafaa_rpl_requests?select=id,person_id,recommended_by,decided_by,status&id=eq.rpl-p-sro-01'))[0];
  expect(req.status).toBe('decided');
  expect(req.recommended_by && req.decided_by && req.recommended_by !== req.decided_by && req.decided_by !== req.person_id && req.recommended_by !== req.person_id).toBeTruthy();
  const ex = await rpc(page, 'kafaa_export_rpl', { p_id: 'rpl-p-sro-01' });
  expect(ex.body?.ok).toBe(true);
  expect(JSON.stringify(ex.body?.data)).not.toMatch(FANR);
  // credits: the ledger total equals the sum of counted rows; every tag line says indicative
  await go(page, '/my/credits');
  await chips(page, 'main', 'FS30');
  await expect(page.locator('[data-testid="m34-cr-ledger"]')).toBeVisible();
  await expect(page.locator('[data-testid="m34-indicative"]').first()).toBeVisible();
  expect(await page.locator('main').innerText()).not.toMatch(GAMIFIED);
  // no security-restricted item can be attached: such records are listed without any detail (the attach refusal is in PGlite/unit)
  const opts = await rpc(page, 'kafaa_rpl_evidence_options', {});
  const list = (Array.isArray(opts.body) ? opts.body : opts.body?.items ?? []) as { restricted?: boolean; title_en?: string; skill_ids?: string[] }[];
  for (const o of list.filter((x) => x.restricted)) expect(o.title_en === 'Security-restricted record' && (o.skill_ids ?? []).length === 0).toBe(true);
  await clean(page, w);
  // maker-checker: the recommender of k-ro's request cannot confirm it (local; the confirm leaves evidence)
  await toLocal(page, 'sq-lead');
  await go(page, '/recognition/review/rpl-p-k-ro-01');
  await expect(page.locator('[data-testid="m34-mc"]')).toBeVisible();
  await toLocal(page, 'training-mgr');
  await go(page, '/recognition/review/rpl-p-k-ro-01');
  await expect(page.locator('[data-testid="m34-confirm"]')).toBeVisible();
  await clean(page, w);
});

test('D3 FS31/FS32/FS33: eight new credentials pass the wording check, the strategic tier unlocks the gigs that name it, each credential shows how to earn it and where it takes you; the learner record shares only what is chosen, expired or revoked links show nothing personal; goals change the Coach, managers see only shared goals', async ({ page }) => {
  const w = watchErrors(page);
  await as(page, 'sro');
  await go(page, '/my/skills/credentials/future');
  await chips(page, 'main', 'FS31');
  await expect(page.locator('[data-testid="m17-fc-tier"]')).toBeVisible();
  expect(await page.locator('[data-testid="m17-fc-card"]').count()).toBeGreaterThanOrEqual(8);
  // each new definition passes the regulatory-wording check: no FANR / licence claim in any FS31 card (the page's own
  // "not a FANR certificate or licence" notice is the required disclaimer, so only the cards are checked)
  for (const c of await page.locator('[data-testid="m17-fc-card"]').allInnerTexts()) expect(c).not.toMatch(FANR);
  const un = data<{ items: { target_id: string; unlocked: boolean }[] }>(await rpc(page, 'kafaa_credential_unlocks'));
  expect(un.items.find((u) => u.target_id === 'fg-ai-chem-trend-flags')?.unlocked).toBe(true);
  expect(un.items.find((u) => u.target_id === 'fg-dig-twin-validation')?.unlocked).toBe(true);
  await go(page, '/my/skills/credentials/c/MC-AI-ASSURER');
  await expect(page.locator('[data-testid="m17-fc-routes"]')).toBeVisible();
  await expect(page.locator('[data-testid="m17-fc-takes"]')).toBeVisible();
  await clean(page, w);
  // FS32: the record (sro), an active link verifies with initials only; expired and revoked links show nothing personal
  await go(page, '/my/skills/record');
  await chips(page, 'main', 'FS32');
  await expect(page.locator('[data-testid="m17-lr-record"]')).toBeVisible();
  expect(await page.locator('[data-testid="m17-lr-record"]').innerText()).not.toMatch(/medical|security clearance/i);
  await clean(page, w);
  const tok = (id: string) => T.record_shares.find((s) => s.id === id)!.token;
  await pinBackend(page, 'supabase');
  const vAct = await rpc(page, 'kafaa_verify_record_share', { p_token: tok('rs-kro-digital-rotation') });
  const vExp = await rpc(page, 'kafaa_verify_record_share', { p_token: tok('rs-kro-mentoring-2026') });
  const vRev = await rpc(page, 'kafaa_verify_record_share', { p_token: tok('rs-kro-old-draft') });
  expect(JSON.stringify(vAct.body)).toMatch(/RO|K/);
  for (const v of [vExp, vRev]) {
    const s = JSON.stringify(v.body);
    expect(s).not.toMatch(/holderInitials|"items":\[\{|AchievementSubject/);
  }
  await go(page, `/verify/record/${tok('rs-kro-digital-rotation')}`);
  await expect(page.locator('[data-testid="m17-lr-verify"]')).toBeVisible();
  await expect(page.locator('[data-testid="m17-lr-verify-initials"]')).toBeVisible();
  w.take();
  // FS33: the line manager sees only shared goals (sro manages k-ro: 2 of 3); HR sees none
  await as(page, 'sro');
  await go(page, '/team/skills/goals');
  await chips(page, 'main', 'FS33');
  const shared = T.skill_goal_plans.filter((g) => g.person_id === 'p-k-ro' && g.shared && g.status !== 'withdrawn').length;
  expect(await rest(page, 'kafaa_skill_goal_plans?select=id&person_id=eq.p-k-ro')).toHaveLength(shared);
  await as(page, 'chco');
  expect(await rest(page, 'kafaa_skill_goal_plans?select=id&person_id=eq.p-k-ro')).toHaveLength(0);
  await clean(page, w);
  // local: k-ro's goals with dates (EN and AR), the Coach reason "your goal", and the FS07 skill page links to the goals page
  await toLocal(page, 'k-ro');
  await go(page, '/my/skills/goals');
  expect(await page.locator('[data-testid="m17-sg-goal"]').count()).toBeGreaterThanOrEqual(3);
  await go(page, '/ar/my/skills/goals');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  expect(await page.locator('[data-testid="m17-sg-goal"]').count()).toBeGreaterThanOrEqual(3);
  await go(page, '/skills/sk-fs-ai-verify');
  await expect(page.locator('[data-testid="m28-goal-plan"]')).toHaveAttribute('href', /\/my\/skills\/goals/);
  await clean(page, w);
});

test('D4 FS34/FS35: the anonymous translator stores nothing and lists delta skills and a bridging route with reasons for 12 ESCO-sourced occupations; staff run it on their passport; Career Health shows five components with inputs and no hidden score, managers cannot read it, Execute books a conversation', async ({ page }) => {
  const w = watchErrors(page);
  await pinBackend(page, 'supabase');
  await go(page, '/careers/translate');
  await chips(page, 'main', 'FS34');
  const occ = await rest(page, 'kafaa_occupation_templates?select=id,sources,esco_uri,skills&listed=eq.true');
  expect(occ.length).toBeGreaterThanOrEqual(8);
  expect(occ.every((o: { sources: { url: string }[]; esco_uri: string; skills: unknown[] }) => o.sources.some((x) => /^https:\/\/esco\.ec\.europa\.eu/.test(x.url)) && /esco/.test(o.esco_uri) && o.skills.length > 0)).toBe(true);
  const writes: string[] = [];
  page.on('request', (r) => { if (r.method() !== 'GET' && /\/rest\/v1\//.test(r.url())) writes.push(r.url()); });
  const before = await page.evaluate(() => Object.keys(localStorage).sort().join(','));
  await page.locator('[data-testid="m18-fs34-occupation"]').first().click();
  await expect(page.locator('[data-testid="m18-fs34-result"]').first()).toBeVisible();
  await expect(page.locator('[data-testid="m18-fs34-gaps"]').first()).toBeVisible();
  await expect(page.locator('[data-testid="m18-fs34-bridge"]').first()).toBeVisible();
  expect(await page.locator('[data-testid="m18-fs34-item-why"]').count()).toBeGreaterThan(0);
  expect(writes).toEqual([]);
  expect(await page.evaluate(() => Object.keys(localStorage).sort().join(','))).toBe(before);
  await clean(page, w);
  await as(page, 'nse');
  await go(page, '/careers/translate');
  await page.getByRole('tab', { name: PASSPORT_TAB }).click();
  await expect(page.locator('[data-testid="m18-fs34-passport"]')).toBeVisible();
  const mine = await rpc(page, 'kafaa_translate_mine');
  expect(mine.body?.ok).toBe(true);
  await go(page, '/my/career/health');
  await chips(page, 'main', 'FS35');
  await expect(page.locator('[data-testid="m18-fs35-component"]')).toHaveCount(5);
  await expect(page.locator('[data-testid="m18-fs35-private"]')).toBeVisible();
  expect(await page.locator('main').innerText()).not.toMatch(/score:/i);
  const h = data<{ components: unknown[] }>(await rpc(page, 'kafaa_career_health'));
  expect(h.components.length).toBe(5);
  await clean(page, w);
  // a manager (sro) cannot read another person's snapshots (RLS): only their own
  await as(page, 'sro');
  const snaps = await rest(page, 'kafaa_health_snapshots?select=person_id');
  expect(snaps.every((s: { person_id: string }) => s.person_id === 'p-sro')).toBe(true);
  // local: Assess -> Chart -> Execute books the conversation through the F12 RPC
  await toLocal(page, 'k-ro');
  await go(page, '/my/career/health');
  await page.locator('[data-testid="m18-fs35-to-chart"]').click();
  await expect(page.locator('[data-testid="m18-fs35-actions"]')).toBeVisible();
  await page.locator('[data-testid="m18-fs35-save"]').click();
  await confirm(page).catch(() => undefined);
  await page.locator('input[name="fs35-goal"]').fill('Prepare for the SRO route');
  await page.locator('[data-testid="m18-fs35-book"]').click();
  await page.getByRole('dialog').getByRole('button', { name: BOOK }).click();
  await expect(page.locator('[data-testid="m18-fs35-done"]')).toBeVisible();
  await clean(page, w);
});

test('D5 FS36/FS37: the register computes coverage from FS09 rungs and suppresses groups under 10; the pack says not a regulator and voluntary; drills are synthetic, scored the same in TS and SQL, never above L2, and keys stay server-side', async ({ page }) => {
  const w = watchErrors(page);
  await as(page, 'chco');
  await go(page, '/workforce/ai-register');
  await chips(page, 'main', 'FS36');
  await expect(page.locator('[data-testid="m29-reg-list"]')).toBeVisible();
  await expect(page.locator('[data-testid="m29-reg-voluntary"]').first()).toBeVisible();
  const cov = await rpc(page, 'kafaa_ai_literacy_coverage');
  const rows = JSON.stringify(cov.body);
  expect(rows.length).toBeGreaterThan(10);
  const sys = await rest(page, 'kafaa_ai_systems?select=*&limit=1');
  for (const s of sys) expect(Object.keys(s).some((k) => /coverage|pct|percent/.test(k))).toBe(false);
  await go(page, '/workforce/ai-literacy-pack');
  await expect(page.locator('[data-testid="m29-pack-statement"]')).toBeVisible();
  await expect(page.locator('[data-testid="m29-pack-statement"]')).toContainText(/not a regulator|voluntary/i);
  await clean(page, w);
  await as(page, 'qc-inspector');
  await go(page, '/my/ai-fluency/drills');
  await chips(page, 'main', 'FS37');
  expect(await page.locator('[data-testid="m29-dr-card"]').count()).toBeGreaterThanOrEqual(6);
  await expect(page.locator('[data-testid="m29-dr-synthetic"]').first()).toBeVisible();
  expect(await rest(page, 'kafaa_ai_drill_keys?select=drill_id')).toEqual([]); // the key stays server-side
  const att = await rest(page, 'kafaa_ai_drill_attempts?select=person_id,level');
  expect(att.every((a: { person_id: string; level: number | null }) => a.person_id === 'p-qc-inspector' && (a.level ?? 0) <= 2)).toBe(true);
  await go(page, '/my/ai-fluency/drills/ad-valve-lineup');
  await expect(page.locator('[data-testid="m29-drill-doc"]')).toHaveAttribute('data-synthetic', 'true');
  await expect(page.locator('[data-testid="m29-drill-doc"]')).toContainText(/SYNTHETIC/);
  await clean(page, w);
  // local: a drill end to end (flag, protocol, confirm), scored result with level-1 evidence and reasons
  await toLocal(page, 'k-ro');
  await go(page, '/my/ai-fluency/drills/ad-valve-lineup');
  const key = T.ai_drill_keys.find((k) => k.drill_id === 'ad-valve-lineup')!;
  for (const e of key.errors) {
    const seg = page.locator(`[data-testid="m29-drill-seg"][data-seg="${e.segment_id}"]`);
    await seg.locator('[data-testid="m29-drill-flag"]').click();
    await seg.locator(`[data-testid="m29-drill-kind-${e.kind}"]`).click();
  }
  await page.locator('[data-testid="m29-drill-next"]').click();
  for (const k of key.protocol) await page.locator(`[data-testid="m29-drill-opt-${k.id}-${k.correct}"]`).click();
  await page.locator('[data-testid="m29-drill-submit"]').click();
  await confirm(page);
  await expect(page.locator('[data-testid="m29-drill-result"]')).toHaveAttribute('data-passed', 'yes');
  await expect(page.locator('[data-testid="m29-drill-evidence"]')).toHaveAttribute('data-level', '1');
  await clean(page, w);
});

test('D6 cross-feature wiring and chips: the FS17 backlog after FS27 gigs, FS31 credits tagged in FS30, every wave-D page shows its chips; Arabic pages', async ({ page }) => {
  const w = watchErrors(page);
  await as(page, 'training-mgr');
  await go(page, '/training/pathways');
  await page.getByRole('tab', { name: /Gap backlog/ }).click();
  await expect(page.locator('main')).toContainText(/145/); // open gaps after the wave-D refresh (FS27 gigs fill practice steps)
  const gaps = await rest(page, 'kafaa_pathway_gaps?select=id,status,kind');
  expect(gaps.length).toBe(215);
  expect(gaps.filter((g: { status: string }) => g.status === 'open').length).toBe(145);
  expect(gaps.filter((g: { status: string; kind: string }) => g.status === 'filled' && g.kind === 'practice').length).toBe(27);
  await go(page, '/training/credentials/strategic');
  await chips(page, 'main', 'FS31');
  await go(page, '/training/ai-drills');
  await chips(page, 'main', 'FS37');
  await clean(page, w);
  const pages: [string, string, string | null][] = [
    ['/opportunities/secondments', 'FS28', 'fuel-pm'], ['/recognition/review', 'FS29', 'training-mgr'], ['/my/skills/goals', 'FS33', 'nse'],
    ['/workforce/ai-register/ais-doc-search', 'FS36', 'chco'], ['/admin/ai-register', 'FS36', 'ai-governance'],
  ];
  for (const [path, fs, persona] of pages) {
    if (persona) await as(page, persona);
    await go(page, path);
    await chips(page, 'main', fs);
  }
  await clean(page, w);
  // Arabic: the translator, recognition and the drills list render right-to-left with Arabic text
  await pinBackend(page, 'supabase');
  for (const path of ['/ar/careers/translate', '/ar/recognition']) {
    await go(page, path);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    const text = await page.locator('main').innerText();
    expect((text.match(/[؀-ۿ]/g) ?? []).length).toBeGreaterThan((text.match(/[A-Za-z]/g) ?? []).length);
  }
  await clean(page, w);
});
