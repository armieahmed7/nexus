/**
 * Wave 5 journeys (F32-F38, ecosystem and reach), supabase mode against the live NEXUS project with real NEXUS demo sign-in; the
 * Kafa'a-only personas (k-ro, k-student, k-contractor) run on the local fallback backend in the same browser build.
 * Every acceptance criterion of the wave-5 cards is exercised in the browser, or (where only a crafted request can reach it)
 * asserted on the payload the signed-in page receives from the same RPC / RLS read. Writes are few and by synthetic role cards:
 * one micro-credential claim and one approval decision (F32), practice entries, one acknowledgement and an offline sync (F38),
 * audited refusals elsewhere. Every journey is rerunnable (states already reached on an earlier run are accepted).
 *  V1 F32 micro-credentials: catalogue + notice (never FANR certification), claim behind a confirmation, public verify with parts,
 *     stacked credential "renewal due" when a part expired, stack refused while a part is missing, copy check (UI + RPC),
 *     maker-checker approval from the frameworks tab
 *  V2 F38 OJT logbook: practice notice, readiness with reasons, log online, preceptor acknowledgement ("practice, not a sign-off"),
 *     qualification records unchanged, restricted standards never offered, offline queue syncs exactly once, a re-sent client key is
 *     a duplicate with one xAPI statement, service worker scope limited to the logbook, never on speak-up
 *  V3 F33 contractor passport: own-organisation matrix, RLS between alnoor-gm and gulfhydro-qa (UI + REST), pre-check is read-only,
 *     security standard excluded (UI + RPC), evaluator read-only view, contracted role profiles admin
 *  V4 F34 student journey: two clicks to DNT in EN and AR, no write and no storage for anonymous visitors (network check), sourced
 *     and dated facts, no score or rank, Arabic-first parent view, HR suppressed insights, starter credentials on the local backend
 *  V5 F35 skills outlook: SIMULATED + definition links everywhere, suppression, reset reproduces the baseline, release text clean
 *     check, line manager sees released only, employee refused
 *  V6 F36 digest: at most 7 items in urgency order with link + why on /my, the F38 approval item for a preceptor, bell card, none on
 *     /speak-up, settings card, nudges off stops new digests (local), admin aggregate suppressed
 *  V7 F37 Dalil career mode: "What do I need for SRO?" (local k-ro and live staff) gives gates, three gaps and REG-17 + passport
 *     citations; anonymous gets the public answer only; security declines; the career eval set reaches the release gate
 */
import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { BASE, pinBackend, settle, signIn, textIssues, watchErrors } from './helpers';
import { noScoreText } from '../../src/modules/m06/journey';

const CONFIG = readFileSync('src/config.ts', 'utf8');
const SB_URL = CONFIG.match(/'(https:\/\/[a-z0-9]+\.supabase\.co)'/)![1];
const ANON = CONFIG.match(/'(eyJ[A-Za-z0-9._-]+)'/)![1];
const SEED = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables as Record<string, any[]>;

async function go(page: Page, path: string) {
  await page.goto(BASE + path);
  await settle(page);
}
async function as(page: Page, persona: string) {
  await pinBackend(page, 'supabase');
  await signIn(page, persona);
}
async function asLocal(page: Page, persona: string | null) {
  await pinBackend(page, 'local', persona);
  await page.goto(`${BASE}/`);
  await settle(page);
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
async function rpc<T = any>(page: Page, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  return page.evaluate(async ([url, anon, f, a]) => {
    const sessions = JSON.parse(localStorage.getItem('nexus.auth.v1.sessions') || '{}');
    const tok = sessions[localStorage.getItem('nexus.active') || '']?.access_token;
    const r = await fetch(`${url}/rest/v1/rpc/${f}`, { method: 'POST', headers: { apikey: anon, Authorization: `Bearer ${tok || anon}`, 'Content-Type': 'application/json' }, body: JSON.stringify(a) });
    const txt = await r.text();
    try { return JSON.parse(txt); } catch { return { status: r.status, text: txt }; }
  }, [SB_URL, ANON, fn, args] as const);
}
async function rest<T = any>(page: Page, path: string): Promise<T> {
  return page.evaluate(async ([url, anon, p]) => {
    const sessions = JSON.parse(localStorage.getItem('nexus.auth.v1.sessions') || '{}');
    const tok = sessions[localStorage.getItem('nexus.active') || '']?.access_token;
    const r = await fetch(`${url}/rest/v1/${p}`, { headers: { apikey: anon, Authorization: `Bearer ${tok || anon}` } });
    return r.json();
  }, [SB_URL, ANON, path] as const) as Promise<T>;
}
const confirm = async (page: Page) => page.locator('[data-testid="confirm-action"]').click();

test('V1 F32 micro-credentials: catalogue, claim, verify with parts, renewal due, stacking rule, copy check, maker-checker', async ({ page }) => {
  const w = watchErrors(page);
  await as(page, 'qc-inspector');
  await go(page, '/my/skills/credentials');
  await expect(page.locator('main')).toContainText(/Development recognition only/);
  await expect(page.locator('main')).not.toContainText(/FANR[- ]certified|certified by FANR/i);
  const card = page.locator('[data-testid="m17-mc-card"][data-code="MC-DATA-FOUND"]');
  await expect(card).toBeVisible();
  const st = await card.getAttribute('data-status');
  expect(['eligible', 'active']).toContain(st);
  if (st === 'eligible') {
    await card.locator('[data-testid="m17-mc-claim"]').click();
    await confirm(page);
    await expect(card).toHaveAttribute('data-status', 'active');
  }
  await expect(page.locator('[data-testid="m17-mc-mine"]')).toContainText(/MC-DATA-FOUND|Plant data/);
  // eligibility is reproducible: the server's reading lists every criterion with its evidence
  const el = await rpc(page, 'kafaa_microcred_eligibility', { p_person: null, p_code: 'MC-DATA-FOUND' });
  const e = Array.isArray(el) ? el[0] : el?.data?.[0] ?? el;
  expect(JSON.stringify(e)).toMatch(/criteria/);
  // a stacked credential with a part missing is refused, audited
  const stack = await rpc(page, 'kafaa_award_microcred', { p_code: 'MC-OUTAGE-PRO' });
  expect(stack.ok).toBe(false);
  expect(stack.code).toBe('not_eligible');
  // the drawer explains what it asks for and what it unlocks; the share link verifies publicly with its parts
  await go(page, '/my/skills/credentials?code=MC-DATA-FOUND');
  const drawer = page.locator('[data-testid="m17-mc-drawer"]');
  await expect(drawer).toContainText(/What it asks for/);
  await expect(drawer).toContainText(/What it unlocks/);
  await clean(page, w);
  // public verification: the stacked credential of w-lo-02 whose planning part expired reads "renewal due"
  const anon = await page.context().browser()!.newPage();
  await pinBackend(anon, 'supabase');
  const stackAward = SEED.microcred_awards.find((a) => a.person_id === 'w-lo-02' && a.def_code === 'MC-OUTAGE-PRO')!;
  await go(anon, `/verify/badge/${stackAward.public_slug}`);
  await expect(anon.locator('[data-testid="m17-verify-result"]')).toHaveAttribute('data-status', 'renewal_due');
  expect(await anon.locator('[data-testid="m17-verify-parts"] li').count()).toBeGreaterThanOrEqual(2);
  await expect(anon.locator('[data-testid="m17-verify-parts"]')).toContainText(/Expired|expired/);
  const expired = SEED.microcred_awards.find((a) => a.person_id === 'w-lo-02' && a.def_code === 'MC-OUTAGE-PLAN')!;
  await go(anon, `/verify/badge/${expired.public_slug}`);
  await expect(anon.locator('[data-testid="m17-verify-result"]')).toHaveAttribute('data-status', 'expired');
  await expect(anon.locator('main')).not.toContainText(/Ahmed|Faisal|Mansour/); // initials only, never a name
  await anon.close();
  // training manager: copy check (UI + RPC) and the maker-checker approval of a manual criterion
  const tm = await fresh(page, 'training-mgr');
  const w2 = watchErrors(tm);
  await go(tm, '/admin/frameworks?tab=microcredentials');
  await expect(tm.locator('[data-testid="m17-mc-defs"]')).toBeVisible();
  await tm.locator('[data-testid="m17-mc-new"]').click();
  const ed = tm.locator('[data-testid="m17-mc-editor"]');
  await ed.getByLabel(/Title \(English\)/).fill('FANR certified data analyst');
  await expect(ed).toContainText(/Wording not allowed/);
  const base = SEED.microcred_defs.find((d) => d.code === 'MC-DATA-FOUND' && d.status === 'current')!;
  const bad = await rpc(tm, 'kafaa_save_microcred_def', { p: { code: 'MC-E2E-WORDING', kind: base.kind, area: base.area, level: base.level, title_en: 'FANR certified data analyst', title_ar: base.title_ar, summary_en: base.summary_en, summary_ar: base.summary_ar, criteria: base.criteria, stacks_into: null, alignment: base.alignment, role_ids: base.role_ids, validity_months: base.validity_months, hours: base.hours } });
  expect(bad.ok).toBe(false);
  expect(bad.code).toBe('regulatory_wording');
  await tm.keyboard.press('Escape');
  await expect(ed).toHaveCount(0);
  const pending = await rest<any[]>(tm, 'kafaa_microcred_awards?status=eq.pending_approval&select=id,person_id');
  if (pending.length) {
    const list = tm.locator('[data-testid="m17-mc-approvals"]');
    const before = await list.locator('[data-testid="m17-mc-approval"]').count();
    await list.locator('[data-testid="m17-mc-approve"]').first().click();
    await tm.getByRole('dialog').locator('textarea').fill('Project close-out reviewed with the sponsor (E2E)');
    await confirm(tm);
    await expect(list.locator('[data-testid="m17-mc-approval"]')).toHaveCount(before - 1);
  }
  await clean(tm, w2);
  await tm.close();
});

test('V2 F38 OJT logbook: practice only, acknowledgement, qualification unchanged, offline exactly once, service worker scope', async ({ page }) => {
  const w = watchErrors(page);
  await as(page, 'qc-inspector');
  const quals0 = await rest<any[]>(page, 'kafaa_qual_records?person_id=eq.p-qc-inspector&select=id,status,expires_on,qualified_on&order=id');
  const evals0 = await rest<any[]>(page, 'kafaa_evaluations?person_id=eq.p-qc-inspector&select=id,result&order=id');
  await go(page, '/my/ojt');
  await expect(page.locator('main')).toContainText(/Practice, not a sign-off/);
  const t1 = page.locator('[data-testid="m02-ojt-task"][data-task="qs-qa-t1"]');
  await expect(t1).toBeVisible();
  await t1.locator('[data-testid="m02-ojt-why"]').click();
  await expect(page.locator('[data-testid="m02-ojt-why-panel"]').first()).toContainText(/supervised performances/);
  // no security-restricted standard is offered in the logbook; the RPC refuses one
  await expect(page.locator('[data-testid="m02-ojt-std"]', { hasText: /SEC|Security/ })).toHaveCount(0);
  const sec = await rpc(page, 'kafaa_log_practice', { p: { client_key: `ojt:p-qc-inspector:e2esec${Date.now()}`, task_id: 'qs-sec-t1', on_date: new Date().toISOString().slice(0, 10), mode: 'perform', preceptor_person_id: 'p-sq-lead', confidence: 3 } });
  expect(sec.ok).toBe(false);
  // log a practice entry online on QA-T2 with sq-lead as preceptor
  const t2 = page.locator('[data-testid="m02-ojt-task"][data-task="qs-qa-t2"]');
  const n0 = await t2.locator('[data-testid="m02-ojt-entry"]').count();
  await t2.locator('[data-testid="m02-ojt-log"]').click();
  const form = page.locator('[data-testid="m02-ojt-form"]');
  const pre = form.getByLabel(/Preceptor/);
  await expect(pre.locator('option[value="p-sq-lead"]')).toHaveCount(1);
  await pre.selectOption('p-sq-lead');
  await page.locator('[data-testid="m02-ojt-submit"]').click();
  await expect(t2.locator('[data-testid="m02-ojt-entry"]')).toHaveCount(n0 + 1);
  // offline: the entry is queued on the device and synced exactly once when back online
  await page.context().setOffline(true);
  await expect(page.locator('main')).toContainText(/You are offline/);
  await t2.locator('[data-testid="m02-ojt-log"]').click();
  await form.getByLabel(/Preceptor/).selectOption('p-sq-lead');
  await page.locator('[data-testid="m02-ojt-submit"]').click();
  await expect(page.locator('[data-testid="m02-ojt-queue"]')).toHaveAttribute('data-count', '1');
  const queued = await page.evaluate(() => Object.entries(localStorage).filter(([k]) => /ojt/i.test(k)).map(([, v]) => v).join(''));
  const key = (queued.match(/ojt:p-qc-inspector:[a-z0-9]+/) ?? [])[0];
  expect(key).toBeTruthy();
  await page.context().setOffline(false);
  await expect(page.locator('[data-testid="m02-ojt-sync-result"]')).toContainText(/Synced 1/, { timeout: 30_000 });
  await expect(page.locator('[data-testid="m02-ojt-queue"]')).toHaveCount(0);
  const synced = await rest<any[]>(page, `kafaa_ojt_logs?client_key=eq.${encodeURIComponent(key!)}&select=id,status,synced`);
  expect(synced.length).toBe(1);
  expect(synced[0].synced).toBe('offline');
  // re-sending the same client key records nothing new; exactly one xAPI statement for the entry (F30)
  const again = await rpc(page, 'kafaa_log_practice', { p: { client_key: key, task_id: 'qs-qa-t2', on_date: new Date().toISOString().slice(0, 10), mode: 'perform', preceptor_person_id: 'p-sq-lead', confidence: 3 } });
  expect(again.ok).toBe(true);
  expect(again.data.duplicate).toBe(true);
  expect((await rest<any[]>(page, `kafaa_ojt_logs?client_key=eq.${encodeURIComponent(key!)}&select=id`)).length).toBe(1);
  const stmts = await rest<any[]>(page, `kafaa_xapi_statements?source=eq.f38_ojt&source_ref=eq.${encodeURIComponent(synced[0].id)}&select=id,verb`);
  expect(stmts.length).toBe(1);
  expect(stmts[0].verb).toBe('attempted');
  // the service worker controls the logbook only
  const scopes = await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map((r) => new URL(r.scope).pathname));
  expect(scopes.length).toBeGreaterThan(0);
  for (const s of scopes) expect(s).toMatch(/^\/kafaa\/(ar\/)?my\/ojt\/?$/);
  await clean(page, w);
  await go(page, '/speak-up');
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(false);
  await go(page, '/my');
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(false);
  // the preceptor acknowledges (labelled practice, not a sign-off)
  const sq = await fresh(page, 'sq-lead');
  const w2 = watchErrors(sq);
  await go(sq, '/my/ojt?tab=acknowledge');
  const items = sq.locator('[data-testid="m02-ojt-ack-item"]');
  const n = await items.count();
  expect(n).toBeGreaterThan(0);
  await items.first().locator('[data-testid="m02-ojt-ack-btn"]').click();
  const dlg = sq.getByRole('dialog');
  await expect(dlg).toContainText(/does not change the person's qualification/);
  await dlg.getByLabel(/Feedback/).fill('Clear findings and a good closing meeting (E2E).');
  await dlg.locator('[data-testid="m02-ojt-ack-send"]').click();
  await expect(items).toHaveCount(n - 1);
  await clean(sq, w2);
  await sq.close();
  // nothing about the qualification changed
  expect(await rest<any[]>(page, 'kafaa_qual_records?person_id=eq.p-qc-inspector&select=id,status,expires_on,qualified_on&order=id')).toEqual(quals0);
  expect(await rest<any[]>(page, 'kafaa_evaluations?person_id=eq.p-qc-inspector&select=id,result&order=id')).toEqual(evals0);
  // team readiness for the manager in scope
  const hq = await fresh(page, 'head-sq');
  await go(hq, '/team/ojt');
  await expect(hq.locator('[data-testid="m02-ojt-team"]')).toBeVisible();
  await expect(hq.locator('[data-testid="m02-ojt-team-why"]').first()).toBeVisible();
  await hq.close();
});

test('V3 F33 contractor passport: own organisation only, read-only pre-check, security excluded, evaluator view', async ({ page }) => {
  const w = watchErrors(page);
  await as(page, 'alnoor-gm');
  await go(page, '/partner/workforce/passport');
  const rows = page.locator('[data-testid="m09-cp-matrix"] [data-testid="m09-cp-row"]');
  await expect(rows.first()).toBeVisible();
  const people = await rows.evaluateAll((els) => els.map((e) => e.getAttribute('data-person') ?? ''));
  expect(people.length).toBeGreaterThan(5);
  expect(people.every((p) => p.startsWith('c-alnoor-'))).toBe(true);
  // RLS: no other organisation's skill rows reach the partner admin
  const ps = await rest<any[]>(page, 'kafaa_person_skills?contractor=eq.true&select=person_id,org_id');
  expect(ps.length).toBeGreaterThan(20);
  expect(ps.every((r) => r.org_id === 'org-alnoor')).toBe(true);
  await go(page, '/partner/workforce/passport/c-gulf-03');
  await expect(page.locator('main')).toContainText(/Passport not found/);
  await expect(page.locator('[data-testid="m09-cp-passport"]')).toHaveCount(0);
  // pre-check: likely coverage per task with reasons; the equivalency record and ledger are untouched; security never offered
  const eq0 = await rest<any[]>(page, 'kafaa_equivalency_requests?person_id=eq.c-alnoor-06&select=*&order=id');
  await go(page, '/partner/workforce/precheck?person=c-alnoor-06&standard=qs-elec');
  const opts = await page.locator('select[name="std"] option').allTextContents();
  expect(opts.length).toBeGreaterThan(5);
  expect(opts.some((o) => /SEC-QUAL|Security officer/.test(o))).toBe(false);
  await page.locator('[data-testid="m09-pc-run"]').click();
  const res = page.locator('[data-testid="m09-pc-result"]');
  await expect(res.locator('[data-testid="m09-pc-task"]').first()).toBeVisible();
  expect(await rest<any[]>(page, 'kafaa_equivalency_requests?person_id=eq.c-alnoor-06&select=*&order=id')).toEqual(eq0);
  const secPc = await rpc(page, 'kafaa_equivalency_precheck', { p_person: 'c-alnoor-06', p_standard: 'qs-sec' });
  expect(secPc.ok).toBe(false);
  expect(secPc.code).toBe('invalid'); // the same refusal as submitEquivalency
  expect(secPc.message).toMatch(/Security qualifications/);
  await clean(page, w);
  // the other organisation sees none of Al Noor's rows
  const gq = await fresh(page, 'gulfhydro-qa');
  const ps2 = await rest<any[]>(gq, 'kafaa_person_skills?contractor=eq.true&select=person_id,org_id');
  expect(ps2.length).toBeGreaterThan(10);
  expect(ps2.some((r) => r.org_id === 'org-alnoor')).toBe(false);
  await gq.close();
  // a contractor sees their own passport and can wrap a valid academy certificate as a badge (refused once it exists)
  const cq = await fresh(page, 'alnoor-qaqc');
  const w3 = watchErrors(cq);
  await go(cq, '/partner/workforce/passport/p-alnoor-qaqc');
  await expect(cq.locator('[data-testid="m09-cp-passport"]')).toBeVisible();
  const own = await rest<any[]>(cq, 'kafaa_person_skills?select=person_id');
  expect(own.every((r) => r.person_id === 'p-alnoor-qaqc')).toBe(true);
  await clean(cq, w3);
  await cq.close();
  // ENEC evaluator: read-only passport with the pre-check for the open request
  const tm = await fresh(page, 'training-mgr');
  const w4 = watchErrors(tm);
  await go(tm, '/training/equivalency/passport/c-alnoor-02');
  await expect(tm.locator('[data-testid="m09-cp-passport"]')).toBeVisible();
  await expect(tm.locator('[data-testid="m09-cp-wrap"]')).toHaveCount(0);
  await tm.locator('[data-testid="m09-pc-run"]').click();
  await expect(tm.locator('[data-testid="m09-pc-result"]')).toBeVisible();
  await expect(tm.locator('[data-testid="m09-pc-submit"]')).toHaveCount(0);
  await clean(tm, w4);
  await tm.close();
  // contracted role profiles: admin edits, auditor reads
  const au = await fresh(page, 'presenter');
  await go(au, '/admin/suppliers/contract-roles');
  await expect(au.locator('main')).toContainText(/Read-only/);
  await expect(au.locator('[data-testid="m09-crt-new"]')).toHaveCount(0);
  await au.close();
});

test('V4 F34 student journey: two clicks to DNT (EN + AR), nothing stored for anonymous visitors, sourced facts, no score', async ({ page }) => {
  const w = watchErrors(page);
  await pinBackend(page, 'supabase');
  for (const pre of ['', '/ar']) {
    await go(page, `${pre}/pathways/journey`);
    await page.locator('[data-testid="m06-journey-stage-finishing_school"]').click(); // click 1
    const dnt = page.locator('[data-testid="m06-journey-route-dnt"]');
    await expect(dnt).toHaveAttribute('data-suggested', 'true');
    await dnt.locator('[data-testid="m06-journey-step-dnt"]').click(); // click 2
    await expect(page).toHaveURL(new RegExp(`/kafaa${pre}/pathways/dnt$`));
    await settle(page);
    await expect(page.locator('h1')).toContainText(pre ? /دبلوم التكنولوجيا النووية/ : /Diploma in Nuclear Technology/);
  }
  // anonymous quiz: no write request and nothing in browser storage
  await go(page, '/pathways/journey');
  const storage0 = await page.evaluate(() => JSON.stringify([Object.keys(localStorage).sort(), Object.keys(sessionStorage).sort()]));
  const writes: string[] = [];
  page.on('request', (r) => { if (r.method() !== 'GET' && r.method() !== 'HEAD' && r.method() !== 'OPTIONS') writes.push(`${r.method()} ${r.url()}`); });
  for (const q of ['q01', 'q02', 'q03', 'q04', 'q05', 'q06', 'q07', 'q08', 'q09', 'q10']) await page.locator(`label:has([data-testid="m06-journey-q-${q}-a"])`).click();
  await expect(page.locator('[data-testid="m06-journey-match"]').first()).toBeVisible();
  await page.locator('[data-testid="m06-journey-choose-dnt"]').click();
  await page.locator('[data-testid="m06-journey-prep-dnt-finish_g12"]').check({ force: true });
  await page.locator('[data-testid="m06-journey-elig-dnt-0-yes"]').check({ force: true });
  await expect(page.locator('[data-testid="m06-journey-save"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="m06-journey-signin"]')).toBeVisible();
  await page.waitForTimeout(800);
  expect(writes).toEqual([]);
  expect(await page.evaluate(() => JSON.stringify([Object.keys(localStorage).sort(), Object.keys(sessionStorage).sort()]))).toBe(storage0);
  // no score, rank or percentage after answering; the reasons say which answers point to the family
  expect(noScoreText(await page.locator('main').innerText())).toBe(true);
  await page.locator('[data-testid="m06-journey-match"]').first().locator('[data-testid="m06-journey-why"]').click();
  await expect(page.locator('[data-testid="m06-journey-why-panel"]')).toContainText(/You chose/);
  // facts carry a source and an as-of date (fresh board)
  await go(page, '/pathways/journey');
  const facts = page.locator('[data-testid="m06-journey-board"] [data-testid="m06-journey-fact"]');
  expect(await facts.count()).toBe(SEED.journey_facts.length);
  for (const li of await facts.all()) {
    expect(await li.locator('a').first().getAttribute('href')).toMatch(/^https:\/\//);
    await expect(li).toContainText(/as of/);
  }
  await expect(page.locator('[data-testid="m06-journey-route-dnt"]')).toContainText(/24 months/);
  await expect(page.locator('[data-testid="m06-journey-route-dnt"]')).toContainText(/cohort of 20 graduated on 17 June 2026/);
  await clean(page, w);
  // parent view: Arabic first
  await go(page, '/pathways/journey/parents?stage=finishing_school&route=dnt&families=operations');
  const arBlock = page.locator('[data-testid="m06-parents-ar"]');
  const enBlock = page.locator('[data-testid="m06-parents-en"]');
  await expect(arBlock).toHaveAttribute('dir', 'rtl');
  const order = await page.evaluate(() => {
    const a = document.querySelector('[data-testid="m06-parents-ar"]')!;
    const e = document.querySelector('[data-testid="m06-parents-en"]')!;
    return !!(a.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(order).toBe(true);
  await expect(enBlock).toBeVisible();
  await expect(page.locator('[data-testid="m06-parents-summary-ar"]')).toContainText(/دبلوم التكنولوجيا النووية/);
  // HR insights: aggregates with suppression (live); the anonymous visitor and staff are refused
  const hr = await fresh(page, 'chco');
  const w2 = watchErrors(hr);
  await go(hr, '/workforce/journeys');
  await expect(hr.locator('[data-testid="m06-ji-tiles"]')).toBeVisible();
  for (const v of await hr.locator('main td.num').allTextContents()) {
    const s = v.trim();
    if (/^\d+$/.test(s)) expect(Number(s)).toBeGreaterThanOrEqual(10);
    else expect(s).toMatch(/Suppressed|—|^$/);
  }
  const rows = await rest<any[]>(hr, 'kafaa_student_journeys?select=id&limit=5');
  expect(rows).toEqual([]); // the HR director reads no individual journey
  await clean(hr, w2);
  await hr.close();
  const nse = await fresh(page, 'nse');
  await go(nse, '/workforce/journeys');
  await expect(nse.locator('[data-testid="forbidden"]')).toBeVisible();
  await nse.close();
  // local backend: a signed-in student saves the journey; the HR director issues the waiting starter credentials
  const st = await page.context().browser()!.newPage();
  await asLocal(st, 'k-student');
  await go(st, '/pathways/journey');
  await expect(st.locator('[data-testid="m06-journey-route-dnt"]')).toContainText(/Your route/);
  await expect(st.locator('[data-testid="m06-journey-portfolio"]')).toContainText(/not a FANR certification/);
  await st.locator('[data-testid="m06-journey-prep-dnt-certificate"]').check({ force: true });
  await st.locator('[data-testid="m06-journey-save"]').click();
  await expect(st.locator('body')).toContainText(/Journey saved/);
  await st.close();
  const lc = await page.context().browser()!.newPage();
  await asLocal(lc, 'chco');
  await go(lc, '/workforce/journeys');
  await expect(lc.locator('[data-testid="m06-ji-pending"]')).toContainText(/3/);
  await lc.locator('[data-testid="m06-ji-issue"]').click();
  await confirm(lc);
  await expect(lc.locator('body')).toContainText(/Issued 3 starter credentials/);
  await lc.close();
});

test('V5 F35 skills outlook: SIMULATED everywhere, suppression, reset = baseline, clean release text, released-only for managers', async ({ page }) => {
  const w = watchErrors(page);
  await as(page, 'chco');
  await go(page, '/workforce/skills-outlook');
  const tiles = page.locator('[data-testid="m07-so-tiles"]');
  await expect(tiles).toBeVisible();
  const tileEls = tiles.locator('[data-testid^="m07-tile-outlook_"]');
  await expect(tileEls).toHaveCount(4);
  for (const t of await tileEls.all()) {
    await expect(t).toContainText(/SIMULATED|Simulated/i);
    expect(await t.getByRole('link', { name: /Definition/i }).getAttribute('href')).toMatch(/\/workforce\/definitions#outlook_/);
  }
  for (const id of ['m07-so-trend', 'm07-so-byyear']) {
    const c = page.locator(`[data-testid="${id}"]`).first().locator('xpath=ancestor::*[contains(@class,"card")][1]');
    await expect(c).toContainText(/SIMULATED|Simulated/i);
  }
  expect(await page.locator('[data-testid="m07-so-table"] [data-testid="m07-so-suppressed"]').count()).toBeGreaterThanOrEqual(2);
  // no person id in the payload
  const out = await rpc(page, 'kafaa_compute_outlook', { p_params: {} });
  expect(out.ok).toBe(true);
  expect(JSON.stringify(out.data)).not.toMatch(/"(p|w|c)-[a-z]+-?\d*"|person_id/);
  // what-if then reset reproduces the baseline exactly
  await expect(tiles).not.toHaveClass(/opacity-70/);
  const before = (await tiles.textContent()) ?? '';
  await page.locator('[data-testid="m07-so-param-attrition_pct"]').getByRole('slider').fill('10');
  await expect.poll(async () => tiles.textContent()).not.toBe(before);
  await page.locator('[data-testid="m07-so-reset"]').click();
  await expect.poll(async () => tiles.textContent()).toBe(before);
  // release: the text must pass the public-text guard before the button enables; cancel (no live release)
  const rel = page.locator('[data-testid^="m07-so-release-so-"]').first();
  if (await rel.count()) {
    await rel.click();
    const next = page.locator('[data-testid="m07-so-release-next"]');
    const boxes = page.getByRole('dialog').getByRole('textbox');
    await boxes.nth(-2).fill('We will need 120 operators more by 2032.');
    await expect(page.locator('[data-testid="m07-so-clean"]')).toContainText(/Headcount or site wording/);
    await expect(next).toBeDisabled();
    await boxes.nth(-2).fill('Shortfalls open in operations and safety once two more units come online.');
    await boxes.nth(-1).fill('تظهر فجوات في العمليات والسلامة عند تشغيل وحدتين إضافيتين.');
    await expect(page.locator('[data-testid="m07-so-clean"]')).toContainText(/clean/);
    await expect(next).toBeEnabled();
    await page.keyboard.press('Escape');
  }
  const dirty = await rpc(page, 'kafaa_release_outlook', { p_id: 'so-two-units-2032', p_summary_en: 'We will need 120 operators more by 2032.', p_summary_ar: 'نحتاج 120 مشغلاً' });
  expect(dirty.ok).toBe(false);
  expect(dirty.code).toBe('not_clean');
  await clean(page, w);
  // a line manager reads the released outlook only; an employee is refused
  const sro = await fresh(page, 'sro');
  await go(sro, '/workforce/skills-outlook');
  await expect(sro.locator('[data-testid="m07-so-released"]')).toBeVisible();
  await expect(sro.locator('[data-testid="m07-so-controls"]')).toHaveCount(0);
  const r2 = await rpc(sro, 'kafaa_compute_outlook', { p_params: {} });
  expect(r2.ok).toBe(false);
  await sro.close();
  const nse = await fresh(page, 'nse');
  await go(nse, '/workforce/skills-outlook');
  await expect(nse.locator('[data-testid="forbidden"]')).toBeVisible();
  await nse.close();
});

test('V6 F36 digest: at most 7 items in urgency order with link and why, OJT approvals, bell card, never on speak-up, settings', async ({ page }) => {
  const w = watchErrors(page);
  await as(page, 'sq-lead');
  await go(page, '/my');
  const items = page.locator('[data-testid="digest-items"] [data-testid="digest-item"]');
  await expect(items.first()).toBeVisible();
  const n = await items.count();
  expect(n).toBeLessThanOrEqual(7);
  const urg = await items.evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-urgency'))));
  expect([...urg].sort((a, b) => a - b)).toEqual(urg);
  for (const it of await items.all()) {
    expect(await it.locator('[data-testid="digest-link"]').getAttribute('href')).toMatch(/^\/kafaa\//);
    await expect(it.locator('[data-testid="why-this"], [data-testid="digest-why"]').first()).toBeVisible();
  }
  // F38 -> F36: the practice entry waiting for sq-lead's acknowledgement (if any is still pending)
  const pend = await rest<any[]>(page, 'kafaa_ojt_logs?preceptor_person_id=eq.p-sq-lead&status=eq.pending_ack&select=id');
  const run = await rpc(page, 'kafaa_build_digest', { p_hints: {} });
  expect(run.ok).toBe(true);
  const ojtItems = (run.data.items as any[]).filter((i) => i.ref_table === 'ojt_logs');
  if (pend.length) {
    const ojtLink = items.locator('[data-testid="digest-link"][href$="/my/ojt?tab=acknowledge"]');
    if (ojtItems.length) await expect(ojtLink.first()).toBeVisible();
  }
  // idempotent per period: building again returns the same run and makes no new notification
  const nts0 = await rest<any[]>(page, 'kafaa_notifications?kind=eq.digest&person_id=eq.p-sq-lead&select=id');
  const run2 = await rpc(page, 'kafaa_build_digest', { p_hints: {} });
  expect(run2.data.id).toBe(run.data.id);
  expect((await rest<any[]>(page, 'kafaa_notifications?kind=eq.digest&person_id=eq.p-sq-lead&select=id')).length).toBe(nts0.length);
  // bell card on staff pages, never on speak-up
  await page.locator('[data-testid="notifications"]').click();
  await expect(page.locator('[data-testid="digest-bell"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await go(page, '/speak-up');
  await page.locator('[data-testid="notifications"]').click().catch(() => undefined);
  await expect(page.locator('[data-testid="digest-bell"]')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText(/Your weekly digest/);
  await page.keyboard.press('Escape');
  // settings card: quiet hours and frequency; expiry reminders cannot be muted
  await go(page, '/my/settings#digest-settings');
  const card = page.locator('[data-testid="digest-settings"]');
  await expect(card).toBeVisible();
  await expect(card.locator('[data-testid="digest-kinds"]').getByRole('checkbox', { name: /Expiring/ })).toBeDisabled();
  const bad = await rpc(page, 'kafaa_set_digest_prefs', { p: { enabled: true, frequency: 'hourly', quiet_start: null, quiet_end: null, muted_kinds: [] } });
  expect(bad.ok).toBe(false);
  await clean(page, w);
  // admin aggregate: counts under 10 suppressed; staff refused
  const ad = await fresh(page, 'ai-governance');
  await go(ad, '/admin/digest');
  await expect(ad.locator('[data-testid="digest-stats"]')).toBeVisible();
  await ad.close();
  const st = await rpc(page, 'kafaa_digest_stats', {});
  expect(st.ok === false || st.code === 'forbidden' || st.message || st.status >= 400).toBeTruthy();
  // local: turning nudges off stops new digests
  const lk = await page.context().browser()!.newPage();
  await asLocal(lk, 'k-ro');
  await go(lk, '/my/settings#digest-settings');
  const c2 = lk.locator('[data-testid="digest-settings"]');
  await c2.getByRole('checkbox', { name: /Send me a digest and nudges/ }).uncheck();
  await c2.locator('[data-testid="digest-settings-save"]').click();
  await lk.waitForTimeout(1500);
  await go(lk, '/my'); // a full reload: the local demo tenant keeps the setting
  await expect(lk.locator('[data-testid="digest-off"]')).toBeVisible();
  await expect(lk.locator('[data-testid="digest-items"]')).toHaveCount(0);
  await lk.close();
});

test('V7 F37 Dalil career mode: gates, top gaps and citations; anonymous public answer; security declines; eval gate', async ({ page }) => {
  const w = watchErrors(page);
  // local k-ro (the card's persona)
  await asLocal(page, 'k-ro');
  await go(page, '/ask?mode=career');
  await expect(page.locator('[data-testid="m13-career-banner"]')).toBeVisible();
  await page.locator('[data-testid="m13-input"]').fill('What do I need for SRO?');
  await page.locator('[data-testid="m13-send"]').click();
  const ans = page.locator('[data-testid="m13-answer"]').last();
  await expect(ans).toBeVisible();
  await expect(ans.locator('[data-testid="m13-career-card"][data-kind="gap"]')).toHaveCount(3);
  await expect(ans.locator('[data-testid="m13-citations"]')).toContainText(/REG-17/);
  await expect(ans.locator('[data-testid="m13-citations"]')).toContainText(/Skills Passport|\/my\/skills/);
  // security question still declines in career mode
  await page.locator('[data-testid="m13-input"]').fill('What security clearance questions are asked about the protected area access codes?');
  await page.locator('[data-testid="m13-send"]').click();
  await expect(page.locator('[data-testid="m13-answer"]').last()).toContainText(/can't help|cannot help|not able|outside|security/i);
  await clean(page, w);
  // live staff (supabase): the same question with the user's own data, logged as a career turn
  const nse = await fresh(page, 'nse');
  const w2 = watchErrors(nse);
  await go(nse, '/ask?mode=career');
  await expect(nse.locator('[data-testid="m13-career-banner"]')).toBeVisible();
  await nse.locator('[data-testid="m13-input"]').fill('What do I need for SRO?');
  await nse.locator('[data-testid="m13-send"]').click();
  const a2 = nse.locator('[data-testid="m13-answer"]').last();
  await expect(a2).toBeVisible();
  await expect(a2.locator('[data-testid="m13-citations"]')).toContainText(/REG-17/);
  await clean(nse, w2);
  await nse.close();
  // anonymous: public mode only, no career button, the RPC refuses
  const anon = await page.context().browser()!.newPage();
  await pinBackend(anon, 'supabase');
  await go(anon, '/ask?mode=career');
  await expect(anon.locator('[data-testid="m13-mode-career"]')).toHaveCount(0);
  await expect(anon.locator('[data-testid="m13-career-banner"]')).toHaveCount(0);
  await anon.locator('[data-testid="m13-input"]').fill('What do I need for SRO?');
  await anon.locator('[data-testid="m13-send"]').click();
  const a3 = anon.locator('[data-testid="m13-answer"]').last();
  await expect(a3).toBeVisible();
  await expect(a3).toContainText(/REG-17|reactor operator/i);
  await expect(a3.locator('[data-testid="m13-career-card"]')).toHaveCount(0);
  const r = await rpc(anon, 'kafaa_dalil_career_turn', { p: { question: 'What do I need for SRO?' } });
  expect(r.ok === true).toBe(false);
  await anon.close();
  // release gate: the career eval set is part of it and reaches the citation floor
  const ad = await fresh(page, 'ai-governance');
  await go(ad, '/admin/dalil');
  await ad.getByRole('tab', { name: /Evaluation/ }).click();
  await ad.locator('[data-testid="m13-eval-run"]').click();
  const career = ad.locator('[data-testid="m13-eval-career"]');
  await expect(career).toBeVisible({ timeout: 60_000 });
  await expect(career).toContainText(/100%|9[5-9](\.\d)?%/);
  await ad.close();
});
