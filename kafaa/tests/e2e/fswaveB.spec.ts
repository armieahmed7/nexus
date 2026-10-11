/**
 * FS wave B journeys (FS07-FS16, the employee-facing future-skills core), supabase mode against the live NEXUS project with real
 * NEXUS demo sign-in. Every acceptance criterion of the ten wave-B cards is exercised in the browser, or asserted on the payload the
 * signed-in page receives from the same RPC / RLS read (PGlite and unit tests prove SQL = TS). The local backend is used only for
 * the Kafa'a-only persona k-ro (the FS15 criterion names it) and for one full fitness check (a live check is once per quarter).
 * Live writes: B5 shortlists a concept role for buyer and removes it again (career_targets, audited); B4 completes one ADVANCE track
 * step for nse and undoes it. Everything else is read-only or an audited refusal. Rerunnable.
 *  B1 FS07/FS08 catalogue explorer + crosswalk   B2 FS09/FS10 AI fluency + fitness check   B3 FS11/FS12 role 2030 + task exposure
 *  B4 FS13/FS14 Future Me v2 + horizon lanes      B5 FS15/FS16 future roles + outlook labels  B6 cross-feature wiring, chips, Arabic
 */
import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { BASE, pinBackend, settle, signIn, textIssues, watchErrors } from './helpers';
import { outlookLabel, thresholdsOf, type CriteriaRow } from '../../src/modules/m18/outlookLabels';
import { publicTextIsClean } from '../../src/domain/future';

const CONFIG = readFileSync('src/config.ts', 'utf8');
const SB_URL = CONFIG.match(/'(https:\/\/[a-z0-9]+\.supabase\.co)'/)![1];
const ANON = CONFIG.match(/'(eyJ[A-Za-z0-9._-]+)'/)![1];
const M11 = JSON.parse(readFileSync('src/i18n/m11.en.json', 'utf8'));
const M18 = JSON.parse(readFileSync('src/i18n/m18.en.json', 'utf8'));
const FEATURE: Record<string, string[]> = {
  FS07: ['SFIA9', 'ESCO', 'SSG-SF'], FS08: ['ESCO', 'SFIA9', 'ONET', 'DIGCOMP', '1EDTECH', 'OT-CYBER'], FS09: ['AI-LIT', 'UAE-AI', 'LINKEDIN', 'DIGCOMP'],
  FS10: ['DIGCOMP', 'SKILLS-TECH', 'OECD-PIAAC'], FS11: ['SG-JTM', 'SSG-SF', 'CORP'], FS12: ['SSG-SF', 'OECD-AICI', 'ENERGY-JOBS'], FS13: ['SMR-WF', 'NEA', 'IAEA-WFP'],
  FS14: ['IAEA-AI', 'ENERGY-JOBS', 'SMR-WF', 'NEA'], FS15: ['SG-CAREER', 'CORP'], FS16: ['ONET', 'CORP', 'FORECAST'],
};

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
/** The card's FS01 chips inside a container (loaded registry rows render as buttons). */
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
const n = (s: string | null) => Number((s ?? '').replace(/[^\d.]/g, ''));

test('B1 FS07/FS08: every published skill listed and filtered, Arabic search, no person data for anon, sources with as-of, crosswalk coverage, CASE export, indicative rows, admin RBAC', async ({ page }) => {
  const w = watchErrors(page);
  await pinBackend(page, 'supabase');
  await go(page, '/skills');
  // anonymous payloads: published skills only, no goals, listed alignments only
  const skills = await rest(page, 'kafaa_skills?select=id,lifecycle,fs_area');
  const listed = skills.filter((s: { lifecycle: string }) => s.lifecycle !== 'obsolete');
  expect(skills.length).toBeGreaterThanOrEqual(110);
  expect(await rest(page, 'kafaa_skill_goals?select=id')).toEqual([]);
  expect(await rest(page, 'kafaa_person_skills?select=id&limit=1')).toEqual([]);
  const al = await rest(page, 'kafaa_skill_alignments?select=skill_id,status,source_url,as_of,reviewed_by');
  expect(al.every((a: { status: string }) => a.status === 'published')).toBe(true);
  expect(al.every((a: { source_url: string; as_of: string }) => a.source_url.startsWith('https://') && !!a.as_of)).toBe(true);
  const covered = new Set(al.map((a: { skill_id: string }) => a.skill_id));
  expect(covered.size / skills.length, 'at least 95 % of skills aligned').toBeGreaterThanOrEqual(0.95);
  // the explorer lists every published skill, with the FS07 chips
  await expect(page.locator('[data-testid="m28-skill-list"] > li')).toHaveCount(listed.length);
  expect(n(await page.locator('[data-testid="m28-count"]').innerText())).toBeGreaterThanOrEqual(listed.length);
  await chips(page, 'm28-bench-fs07', 'FS07');
  await openChip(page, 'SFIA9');
  await expect(page.locator('[data-testid="m28-card-held"]')).toHaveCount(0);
  // filters narrow (URL-synced)
  await go(page, '/skills?future=ai_data');
  await expect(page.locator('[data-testid="m28-skill-list"] > li')).toHaveCount(listed.filter((s: { fs_area: string | null }) => s.fs_area === 'ai_data').length);
  // Arabic search ranks the data-analysis skill first, with a reason
  await go(page, '/ar/skills');
  await page.locator('[data-testid="m28-search"]').fill('تحليل البيانات');
  await expect(page.locator('[data-testid="m28-skill-list"] li a').first()).toHaveAttribute('data-testid', 'm28-skill-sk-da-01-analysis');
  await expect(page.locator('[data-testid="m28-why-sk-da-01-analysis"]')).toBeVisible();
  // every skill page shows a source with an as-of date (sampled: an F01 skill, two FS02 skills, an obsolete one by direct link)
  for (const id of ['sk-co-01', 'sk-fs-ai-verify', 'sk-fs-tr-analytical']) {
    await go(page, `/skills/${id}?tab=sources`);
    const src = page.locator('[data-testid="m28-skill-sources"]');
    expect(await src.locator('li').count(), id).toBeGreaterThanOrEqual(1);
    await expect(src).toContainText(/read /);
    expect(await src.locator('a[href^="https://"]').count(), id).toBeGreaterThan(0);
  }
  await go(page, '/skills/sk-fs-dp-paperwp');
  await expect(page.locator('[data-testid="m28-obsolete"]')).toContainText(/Replaced by/);
  // crosswalk: indicative rows say so, in English and Arabic
  await go(page, '/skills/sk-fs-tr-analytical?tab=crosswalk');
  await chips(page, 'm28-bench-fs08', 'FS08');
  const unreviewed = al.filter((a: { skill_id: string; reviewed_by: string | null }) => a.skill_id === 'sk-fs-tr-analytical' && !a.reviewed_by).length;
  expect(unreviewed).toBeGreaterThan(0);
  await expect(page.locator('[data-testid="m28-crosswalk"] [data-testid="m28-indicative"]')).toHaveCount(unreviewed);
  await expect(page.locator('[data-testid="m28-crosswalk"]').first()).toContainText(/indicative/i);
  await go(page, '/ar/skills/sk-fs-tr-analytical?tab=crosswalk');
  await expect(page.locator('[data-testid="m28-crosswalk"]').first()).toContainText('إرشادي');
  // frameworks: coverage, gap list, export valid against the CASE-shaped schema
  await go(page, '/skills/frameworks');
  await expect(page.locator('[data-testid="m28-fw-tiles"]')).toContainText('100%');
  await expect(page.locator('[data-testid="m28-fw-cards"] > li')).toHaveCount(11);
  await expect(page.locator('[data-testid="m28-fw-gaps"]')).toContainText('UAE NQF');
  await expect(page.locator('[data-testid="m28-export-valid"]')).toContainText('validates');
  const dl = page.waitForEvent('download');
  await page.locator('[data-testid="m28-export-case"]').click();
  const file = await dl;
  const pkg = JSON.parse(readFileSync((await file.path())!, 'utf8'));
  expect(pkg.CFDocument && Array.isArray(pkg.CFItems) && Array.isArray(pkg.CFAssociations)).toBeTruthy();
  expect(pkg.CFItems.length).toBeGreaterThanOrEqual(listed.length);
  await clean(page, w);
  // signed in: "You hold this at L.." and the goal button
  await as(page, 'nse');
  await go(page, '/skills');
  const held = page.locator('[data-testid="m28-card-held"]');
  await expect(held.first()).toBeVisible();
  const heldHref = await page.locator('[data-testid="m28-skill-list"] li', { has: held }).first().locator('a').first().getAttribute('href');
  await go(page, heldHref!.replace(BASE, ''));
  await expect(page.locator('[data-testid="m28-mine-held"]')).toContainText(/You hold this at L\d/);
  await go(page, '/admin/skills/alignments');
  await expect(page.locator('[data-testid="forbidden"]')).toBeVisible();
  await clean(page, w);
  // training manager edits (live check); the auditor reads every row, controls hidden
  await as(page, 'training-mgr');
  await go(page, '/admin/skills/alignments');
  await page.locator('[data-testid="m28-add"]').click();
  await expect(page.locator('[data-testid="m28-editor-problem"]')).toBeVisible();
  await expect(page.locator('[data-testid="m28-editor-save"]')).toBeDisabled();
  await page.keyboard.press('Escape');
  await as(page, 'presenter');
  await go(page, '/admin/skills/alignments');
  await expect(page.locator('[data-testid="m28-admin-readonly"]')).toBeVisible();
  await expect(page.locator('[data-testid="m28-add"]')).toHaveCount(0);
  const r = await rpc(page, 'kafaa_save_alignment', { p: { skill_id: 'sk-co-01', framework: 'esco', label_en: 'x', match: 'close', source_url: 'https://esco.ec.europa.eu', as_of: '2026-10-10' } });
  expect(r.body?.ok === false || r.status >= 400).toBe(true);
  await clean(page, w);
});

test('B2 FS09/FS10: ladder and role targets, my rung with evidence reasons, literacy never raised by engineering, no gamification, adaptive check <= 20 items with evidence <= L2, once per quarter, org indicator suppressed under 10', async ({ page }) => {
  const w = watchErrors(page);
  await pinBackend(page, 'supabase');
  await go(page, '/learn/ai-fluency');
  await expect(page.locator('[data-testid="m29-lad-cell"]')).toHaveCount(16);
  await expect(page.locator('[data-testid="m29-lad-targets"] tbody tr')).toHaveCount(20);
  await expect(page.locator('[data-testid="m29-lad-engineering"] li')).toHaveCount(5);
  await chips(page, 'main', 'FS09');
  const fams = await rest(page, 'kafaa_job_families?select=id');
  const targets = await rest(page, 'kafaa_ai_role_targets?select=family_id');
  expect(new Set(targets.map((t: { family_id: string }) => t.family_id)).size).toBe(fams.length);
  expect(await rest(page, 'kafaa_fitness_items?select=id&limit=1')).toEqual([]); // the bank (with keys) is never public
  await clean(page, w);
  // my rung: reasons link to evidence; the target of my family; nothing gamified
  await as(page, 'nse');
  await go(page, '/my/ai-fluency');
  await expect(page.locator('[data-testid="m29-my-rung"]')).toBeVisible();
  expect(await page.locator('[data-testid="m29-my-evidence"]').count()).toBeGreaterThan(0);
  await expect(page.locator('[data-testid="m29-my-target"]')).toBeVisible();
  await page.locator('[data-testid="m29-my-why"]').click();
  await expect(page.locator('[data-testid="m29-my-why-panel"]')).toContainText(/Rung \d of 4/);
  await chips(page, 'main', 'FS09');
  expect(await page.locator('main').innerText()).not.toMatch(/leaderboard|\bXP\b|\d+\s*(points|pts)\b|\d+[- ]day streak/i); // the page says "no points and no streaks"; nothing is scored
  const me = await rpc(page, 'kafaa_ai_fluency');
  const view = me.body?.data ?? me.body;
  expect(view, 'aiFluency payload').toBeTruthy();
  expect(JSON.stringify(view)).not.toMatch(/"(points|streak|rank_position|leaderboard)"/);
  await go(page, '/workforce/ai-fluency');
  await expect(page.locator('[data-testid="forbidden"]')).toBeVisible();
  await clean(page, w);
  // sro took this quarter's check: next opening date, trend, no start; the server refuses a second one
  await as(page, 'sro');
  await go(page, '/my/ai-fluency/check');
  await expect(page.locator('[data-testid="m29-fit-next-on"]')).toBeVisible();
  expect(await page.locator('[data-testid="m29-fit-history"] > *').count()).toBeGreaterThan(0);
  await expect(page.locator('[data-testid="m29-fit-start"]')).toHaveCount(0);
  await chips(page, 'main', 'FS10');
  const again = await rpc(page, 'kafaa_start_fitness');
  expect(again.body?.ok).toBe(false);
  const ev = await rest(page, 'kafaa_skill_evidence?select=level,ref_table&ref_table=eq.fitness_attempts');
  expect(ev.length).toBeGreaterThan(0);
  expect(ev.every((e: { level: number }) => e.level <= 2)).toBe(true);
  await clean(page, w);
  // HR: % above basic, the dated leadership parameter, families under 10 suppressed
  await as(page, 'chco');
  await go(page, '/workforce/ai-fluency');
  await expect(page.locator('[data-testid="m29-wf-tiles"]')).toContainText('%');
  await expect(page.locator('[data-testid="m29-wf-param"]')).toContainText('60%');
  await expect(page.locator('[data-testid="m29-wf-families"]')).toContainText('<10');
  await expect(page.locator('[data-testid="m29-wf-families"]')).not.toContainText(/Security|Safeguards/);
  await chips(page, 'main', 'FS10');
  await clean(page, w);
  // item bank: the training manager writes (live wording check), instructors read
  await as(page, 'training-mgr');
  await go(page, '/training/ai-fitness/items');
  await page.locator('[data-testid="m29-bank-add"]').click();
  await expect(page.locator('[data-testid="m29-bank-problem"]')).toBeVisible();
  await expect(page.locator('[data-testid="m29-bank-save"]')).toBeDisabled();
  await page.keyboard.press('Escape');
  await as(page, 'sq-lead');
  await go(page, '/training/ai-fitness/items');
  await expect(page.locator('[data-testid="m29-bank-readonly"]')).toBeVisible();
  await clean(page, w);
});

test('B2b FS10 (local backend, k-ro): a full adaptive check reaches a result in 18-20 items, with benchmark lines and evidence capped at level 2', async ({ page }) => {
  const w = watchErrors(page);
  await pinBackend(page, 'local', 'k-ro');
  await go(page, '/my/ai-fluency/check');
  await page.locator('[data-testid="m29-fit-start"]').click();
  let items = 0;
  for (; items < 25; items++) {
    const q = page.locator('[data-testid="m29-fit-question"]');
    if (!(await q.isVisible().catch(() => false))) {
      await page.waitForTimeout(500);
      if (!(await q.isVisible().catch(() => false))) break;
    }
    const id = await q.getAttribute('data-item');
    await page.locator('[data-testid="m29-fit-opt-0"]').click();
    await page.locator('[data-testid="m29-fit-next"]').click();
    await expect.poll(async () => ((await q.isVisible().catch(() => false)) ? await q.getAttribute('data-item') : 'done')).not.toBe(id);
  }
  expect(items).toBeGreaterThanOrEqual(18);
  expect(items).toBeLessThanOrEqual(20);
  await expect(page.locator('[data-testid="m29-fit-result"]')).toBeVisible();
  expect(await page.locator('[data-testid="benchmark-line"]').count()).toBeGreaterThan(0);
  for (const l of await page.locator('[data-testid="m29-fit-evidence"] li').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-level'))))) expect(l).toBeLessThanOrEqual(2);
  await expect(page.locator('[data-testid="m29-fit-next-on"]')).toBeVisible();
  await clean(page, w);
});

test('B3 FS11/FS12: all 28 roles mapped, time-to-ready from my gaps, public summary clean with no numbers, security path-level only, task bands with reasons, aggregates suppressed under 10, copy check EN/AR', async ({ page }) => {
  const w = watchErrors(page);
  await pinBackend(page, 'supabase');
  await go(page, '/');
  // public: published summaries only, no numbers, no headcount; security roles path-level only
  const maps = await rest(page, 'kafaa_role_transformations?select=role_id,status,public_summary_en,public_summary_ar');
  expect(maps.length).toBe(28);
  expect(publicTextIsClean(maps.flatMap((m: { public_summary_en: string; public_summary_ar: string }) => [m.public_summary_en, m.public_summary_ar]))).toBe(true);
  expect(await rest(page, 'kafaa_transformation_drafts?select=id')).toEqual([]);
  await go(page, '/careers/roles/reactor-operator/transformation');
  await expect(page.locator('[data-testid="m30-pub-summary"]')).toBeVisible();
  expect(await page.locator('[data-testid="m30-pub-summary"]').innerText()).not.toMatch(/[0-9]/);
  expect(await page.locator('[data-testid="m30-public"]').innerText()).not.toMatch(/%|\bmonths\b|[0-9]+ (people|staff|employees|positions)/i);
  await chips(page, 'main', 'FS11');
  await go(page, '/ar/careers/roles/security-officer/transformation');
  await expect(page.locator('[data-testid="m30-path-only"]')).toBeVisible();
  await expect(page.locator('[data-testid="m30-pub-skills"]')).toHaveCount(0);
  await clean(page, w);
  // staff: my role in 2030 (sro, a manager, also explores the Reactor Operator map)
  await as(page, 'sro');
  await go(page, '/my/role-2030?role=reactor-operator');
  await expect(page.locator('[data-testid="m30-hero"]')).toBeVisible();
  await chips(page, 'm30-bench', 'FS11');
  expect(await page.locator('[data-testid="m30-drivers"] [data-testid="m30-driver"]').count()).toBeGreaterThan(0);
  expect(await page.locator('[data-testid="m30-move-grow"] li').count()).toBeGreaterThan(0);
  expect(await page.locator('[data-testid="m30-added"] tbody tr').count()).toBeGreaterThan(0);
  expect(await page.locator('[data-testid="m30-bridge"] li').count()).toBeGreaterThan(0);
  await expect(page.locator('[data-testid="m30-months"]')).toContainText(/month/);
  expect(await page.locator('[data-testid="m30-gaps"] li').count(), 'time-to-ready lists its gaps').toBeGreaterThan(0);
  await page.locator('[data-testid="m30-ready-why"]').click();
  await expect(page.locator('[data-testid="m30-ready-why-panel"]')).toContainText('2 months per level');
  await expect(page.locator('[data-testid="m30-timeline"]')).toContainText('OSSA');
  await expect(page.locator('[data-testid="m30-archetype"]')).toBeVisible();
  await go(page, '/my/role-2030?role=security-officer');
  await expect(page.locator('[data-testid="m30-path-only"]')).toBeVisible();
  await expect(page.locator('[data-testid="m30-gaps"]')).toHaveCount(0);
  // FS12: every task in a band with its reason; skills that complement AI; no banned wording
  await go(page, '/my/role-2030/tasks?role=reactor-operator');
  const reasons = page.locator('[data-testid="m30-bands"] [data-testid="m30-band-reason"]');
  expect(await reasons.count()).toBeGreaterThan(0);
  for (const t of await reasons.allInnerTexts()) expect(t.trim().length).toBeGreaterThan(10);
  expect(await page.locator('[data-testid="m30-complements"] li').count()).toBeGreaterThan(0);
  await chips(page, 'm30-bench', 'FS12');
  expect(await page.locator('main').innerText()).not.toMatch(/\breplac|redundan|layoff/i);
  await go(page, '/workforce/transformation');
  await expect(page.locator('[data-testid="forbidden"]')).toBeVisible();
  await clean(page, w);
  // HR: 28 / 28 maps; exposure and readiness cells under 10 suppressed (no numbers); security never broken out
  await as(page, 'chco');
  await go(page, '/workforce/transformation');
  await expect(page.locator('[data-testid="m30-wf-tiles"]')).toContainText('28 / 28');
  await expect(page.locator('[data-testid="m30-wf-maps"] tbody tr')).toHaveCount(28);
  await page.getByRole('tab', { name: /Task exposure/ }).click();
  const ex = page.locator('[data-testid="m30-wf-exposure"]');
  expect(await ex.locator('tr[data-suppressed="true"]').count()).toBeGreaterThan(0);
  expect(await ex.locator('tr[data-suppressed="false"]').count()).toBeGreaterThan(0);
  for (const row of await ex.locator('tr[data-suppressed="true"]').all()) expect(await row.locator('td.num').count()).toBe(0);
  expect(await ex.innerText()).not.toMatch(/Security/);
  const agg = await rpc(page, 'kafaa_exposure_aggregate');
  const cells = JSON.stringify(agg.body);
  expect(agg.status).toBe(200);
  expect(cells).not.toMatch(/"family_id":"(security|safeguards|cyber)/);
  await clean(page, w);
  // the training manager's editor flags banned wording live, in English and Arabic (nothing saved)
  await as(page, 'training-mgr');
  await go(page, '/workforce/transformation/chemistry-technician');
  const enBox = page.getByLabel('Staff summary (English)');
  const orig = await enBox.inputValue();
  await enBox.fill(`${orig} Analysers replace manual sampling.`);
  await expect(page.locator('[data-testid="m30-ed-banned"]')).toContainText(/replace/);
  await expect(page.locator('[data-testid="m30-ed-save"]')).toBeDisabled();
  await enBox.fill(orig);
  const arBox = page.getByLabel('Staff summary (Arabic)');
  const origAr = await arBox.inputValue();
  await arBox.fill(`${origAr} سيتم استبدال العينات اليدوية.`);
  await expect(page.locator('[data-testid="m30-ed-banned"]')).toBeVisible();
  await expect(page.locator('[data-testid="m30-ed-save"]')).toBeDisabled();
  await arBox.fill(origAr);
  await expect(page.locator('[data-testid="m30-ed-banned"]')).toHaveCount(0);
  await clean(page, w);
});

test('B4 FS13/FS14: readiness v2 with both ceilings and what raises it, preview equals the card, an ADVANCE step moves the index (and is undone), 11 lanes with 3+ dated sources, clean text, interest suppressed under 10', async ({ page }) => {
  const w = watchErrors(page);
  await pinBackend(page, 'supabase');
  await go(page, '/');
  const lanes = await rest(page, 'kafaa_horizon_lanes?select=id,code,kind,sources,as_of,title_en,title_ar,summary_en,summary_ar,why_en,why_ar');
  expect(lanes.length).toBe(11);
  for (const l of lanes) {
    const src = (l.sources ?? []) as { url: string; as_of?: string; accessed?: string }[];
    expect(src.length, l.id).toBeGreaterThanOrEqual(3);
    expect(src.every((s) => s.url.startsWith('https://') && !!(s.as_of || s.accessed)), l.id).toBe(true);
  }
  expect(publicTextIsClean(lanes.flatMap((l: Record<string, string>) => [l.title_en, l.title_ar, l.summary_en, l.summary_ar, l.why_en, l.why_ar]))).toBe(true);
  expect(lanes.filter((l: { kind: string }) => l.kind === 'watch').map((l: { id: string }) => l.id)).toEqual(['lane-fusion']);
  await as(page, 'nse');
  await go(page, '/my/future');
  await expect.poll(() => page.locator('[data-testid="m21-raise"]').count()).toBeGreaterThanOrEqual(3);
  await expect(page.locator('[data-testid="m21-v2-meter"]')).toBeVisible();
  for (const t of await page.locator('[data-testid^="m21-index"]').allInnerTexts()) { expect(t).toContain('SIMULATED'); expect(t).toContain(M11.common.noDecision); }
  for (const d of await page.locator('[data-testid="m21-raise-delta"]').allInnerTexts()) expect(n(d)).toBeGreaterThan(0);
  await chips(page, 'm21-bench-fs13', 'FS13');
  await chips(page, 'm21-bench-fs14', 'FS14');
  await expect(page.locator('[data-testid="m21-lane"]')).toHaveCount(11);
  // the preview shows exactly the +points of its card
  const card = page.locator('[data-testid="m21-raise"]').first();
  const plus = n(await card.locator('[data-testid="m21-raise-delta"]').innerText());
  await card.locator('[data-testid="m21-preview-open"]').click();
  await expect(page.locator('[data-testid="m21-preview"]')).toBeVisible();
  expect(n(await page.locator('[data-testid="m21-preview-delta"]').innerText())).toBe(plus);
  await page.keyboard.press('Escape');
  // learning moves the index: complete one open ADVANCE track step, then undo it
  const overall = async () => n(await page.locator('[data-testid="m21-index-overall"] .num').first().innerText());
  const before = await overall();
  // a track counts once every step is done: finish the open track with the fewest open steps, then undo those steps
  const tracks = page.locator('[data-testid="m21-track"]');
  let pick = -1, fewest = 99;
  for (let i = 0; i < (await tracks.count()); i++) {
    const open = await tracks.nth(i).locator('[data-testid="m21-track-step"][aria-pressed="false"]').count();
    if (open > 0 && open < fewest) { fewest = open; pick = i; }
  }
  expect(pick).toBeGreaterThanOrEqual(0);
  const track = tracks.nth(pick);
  const openIdx: number[] = [];
  const steps = track.locator('[data-testid="m21-track-step"]');
  for (let i = 0; i < (await steps.count()); i++) if ((await steps.nth(i).getAttribute('aria-pressed')) === 'false') openIdx.push(i);
  for (const i of openIdx) {
    await steps.nth(i).click();
    await expect(steps.nth(i)).toHaveAttribute('aria-pressed', 'true');
  }
  await expect.poll(overall).toBeGreaterThan(before);
  for (const i of openIdx.reverse()) {
    await steps.nth(i).click();
    await expect(steps.nth(i)).toHaveAttribute('aria-pressed', 'false');
  }
  await expect.poll(overall).toBe(before);
  // a lane drawer: FS02 skills linked to the catalogue, 3+ sources; the fusion lane is awareness only
  const lane = page.locator('[data-testid="m21-lane"]', { hasText: 'AI-augmented maintenance' });
  await lane.locator('[data-testid="m21-lane-open"]').click();
  const drawer = page.locator('[data-testid="m21-lane-drawer"]');
  await expect(drawer).toBeVisible();
  expect(await drawer.locator('[data-testid="m21-lane-skills"] li').count()).toBeGreaterThanOrEqual(3);
  expect(await drawer.locator('[data-testid="m21-lane-skill-link"]').count()).toBeGreaterThan(0);
  expect(await drawer.locator('[data-testid="m21-sources"] li').count()).toBeGreaterThanOrEqual(3);
  await page.keyboard.press('Escape');
  await go(page, '/my/future?lane=lane-fusion');
  const fusion = page.locator('[role="dialog"]', { has: page.locator('[data-testid="m21-lane-drawer"]') });
  await expect(fusion).toBeVisible();
  await expect(fusion.locator('[data-testid="m21-goal"]')).toHaveCount(0);
  await go(page, '/my/future/bwr');
  await expect.poll(() => page.locator('[data-testid="m21-credit"]').count()).toBe(5);
  await chips(page, 'm21-bench-fs13', 'FS13');
  await clean(page, w);
  // HR: eleven lanes by horizon, small cells suppressed
  await as(page, 'chco');
  await go(page, '/workforce/future/interest');
  const demand = page.locator('[data-testid="m21-demand"]');
  for (const c of ['HZ-6', 'HZ-7', 'HZ-8', 'HZ-9', 'HZ-10', 'HZ-11']) await expect(demand).toContainText(c);
  await expect(demand.locator('tr', { hasText: 'HZ-10' })).toContainText(/suppressed|<\s?10/i);
  await chips(page, 'm21-bench-fs14', 'FS14');
  await clean(page, w);
});

test('B5 FS15/FS16: shortlist a concept role and build a roadmap to it (removed again), readiness from the FS05 profile with reasons, transitions under 10 suppressed, criteria list every threshold, labels reproduce from the rule, no headcount in public', async ({ page }) => {
  const w = watchErrors(page);
  await pinBackend(page, 'supabase');
  // FS16 public: thresholds, rules, versions, label-only table, no components, clean text
  await go(page, '/careers/outlook-criteria');
  const th = page.locator('[data-testid="m18-fs16-thresholds"]');
  expect(await th.locator('tbody tr').evaluateAll((rs) => rs.map((r) => r.getAttribute('data-key')))).toEqual(['change_min_pct', 'growth_min_pct', 'shortfall_min_pct']);
  await expect(th).toContainText('30%');
  await expect(th).toContainText('5%');
  await expect(page.locator('[data-testid="m18-fs16-rules"] li')).toHaveCount(3);
  await expect(page.locator('[data-testid="m18-fs16-version"]')).toHaveCount(2);
  await expect(page.locator('[data-testid="m18-fs16-table"] thead th')).toHaveCount(3);
  await expect(page.locator('[data-testid="m18-fs16-why"]')).toHaveCount(0);
  const pub = await page.locator('main').innerText();
  expect(publicTextIsClean([pub])).toBe(true);
  expect(pub).not.toMatch(/headcount|people-equivalent/i);
  expect(await rest(page, 'kafaa_role_outlook_components?select=id&limit=1')).toEqual([]);
  expect(await rest(page, 'kafaa_role_moves?select=id&limit=1')).toEqual([]);
  await chips(page, 'main', 'FS16');
  await clean(page, w);
  // staff: components, and every stored label reproduces from its components and criteria
  await as(page, 'chco');
  await go(page, '/careers/outlook-criteria');
  await expect(page.locator('[data-testid="m18-fs16-table"] thead th')).toHaveCount(6);
  expect(await page.locator('[data-testid="m18-fs16-why"]').count()).toBe(await page.locator('[data-testid="m18-fs16-row"]').count());
  await page.locator('[data-testid="m18-fs16-preview"]').click();
  await expect(page.locator('[data-testid="m18-fs16-preview-result"]')).toBeVisible();
  const labels = await rest(page, 'kafaa_role_outlook_labels?select=id,label,criteria_id');
  const comps = new Map((await rest(page, 'kafaa_role_outlook_components?select=id,components')).map((c: { id: string; components: unknown }) => [c.id, c.components]));
  const crit = new Map((await rest(page, 'kafaa_role_outlook_criteria?select=*')).map((c: CriteriaRow) => [c.id, c]));
  expect(labels.length).toBe(75);
  for (const l of labels) expect(outlookLabel(comps.get(l.id) as never, thresholdsOf(crit.get(l.criteria_id) as CriteriaRow)), l.id).toBe(l.label);
  await clean(page, w);
  // FS15 as buyer (Procurement Engineer, bridged to the owner's-engineer concept role): 11 concept roles with FS05-profile readiness and the banner; shortlist one, roadmap to it, then remove it
  await as(page, 'buyer');
  await go(page, '/my/career');
  const list = page.locator('[data-testid="m18-fs15-list"]');
  await expect(list.locator('[data-testid="m18-fs15-card"]')).toHaveCount(11);
  await expect(page.locator('[data-testid="m18-fs15-banner"]').first()).toBeVisible();
  await chips(page, 'm18-fs15', 'FS15');
  if (await page.locator('[data-testid="m18-moves"]').count()) await chips(page, 'm18-bench-fs16', 'FS16'); // labelled moves only when the role has moves
  for (const t of await page.locator('[data-testid="m18-fs15-transition"]').allInnerTexts()) {
    const m = t.match(/(\d+) colleagues/);
    if (m) expect(Number(m[1]), t).toBeGreaterThanOrEqual(10);
  }
  const card = list.locator('[data-testid="m18-fs15-card"]').first();
  const role = (await card.getAttribute('data-role'))!;
  expect(role).toBe('fr-owners-engineer'); // my own bridge ranks first
  await expect(card.locator('[data-testid="m18-fs15-bridge"]')).toHaveAttribute('data-mine', 'true');
  const rd = await rpc(page, 'kafaa_future_role_readiness', { p_person: 'p-buyer', p_role_ids: [role] });
  const r0 = (rd.body?.data ?? rd.body)[0];
  expect(r0.concept).toBe(true);
  expect(r0.reasons.some((x: { ref?: { table: string } }) => x.ref?.table === 'role_profile_versions')).toBe(true);
  await card.locator('[data-testid="m18-fs15-details"]').click();
  await expect(page.locator('[data-testid="m18-fs15-detail-gaps"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await card.locator('[data-testid="m18-fs15-add"]').click();
  await expect(page.locator('[data-testid="m18-shortlist"] [data-concept="true"]')).toHaveCount(1);
  try {
    await go(page, `/my/career/roadmap?role=${role}`);
    const box = page.locator('[data-testid="m18-rm-concept"]');
    await expect(box.locator('[data-testid="m18-fs15-banner"]')).toBeVisible();
    await expect(box.locator('[data-testid="m18-fs15-band"]')).toBeVisible();
    await expect(page.locator('[data-testid="m18-gantt"] [data-kind="bridge"]').first()).toBeVisible();
    await chips(page, 'main', 'FS15');
    // F12 integration: the agenda reads the concept target's FS05-profile readiness
    await go(page, '/my/career/conversations');
    const tgt = page.locator('[data-testid="m18-cc-ag-target"][data-concept="true"]');
    await expect(tgt).toHaveCount(1);
    await expect(tgt.locator('[data-testid="m18-fs15-concept-chip"]')).toBeVisible();
    await expect(tgt.locator('[data-testid="m18-fs15-band"]')).toHaveAttribute('data-band', r0.band);
  } finally {
    await go(page, '/my/career');
    await page.locator('[data-testid="m18-shortlist"] li[data-concept="true"] [data-testid="m18-short-remove"]').click();
    await expect(page.locator('[data-testid="m18-shortlist"] [data-concept="true"]')).toHaveCount(0);
  }
  await clean(page, w);
});

test('B5b FS15 (local backend, k-ro): k-ro shortlists a concept role and builds a roadmap to it', async ({ page }) => {
  const w = watchErrors(page);
  await pinBackend(page, 'local', 'k-ro');
  await go(page, '/my/career');
  const shortlist = page.locator('[data-testid="m18-shortlist"]');
  await shortlist.locator('[data-testid="m18-short-remove"]').nth(2).click();
  const bwr = page.locator('[data-testid="m18-fs15-card"][data-role="fr-bwr-operator"]');
  await expect(bwr.locator('[data-testid="m18-fs15-add"]')).toBeEnabled();
  await bwr.locator('[data-testid="m18-fs15-add"]').click();
  await expect(shortlist.locator('[data-concept="true"]')).toHaveCount(1);
  await go(page, '/my/career/roadmap?role=fr-bwr-operator');
  await expect(page.locator('[data-testid="m18-rm-concept"] [data-testid="m18-fs15-banner"]')).toBeVisible();
  await expect(page.locator('[data-testid="m18-gantt"] [data-kind="bridge"]').first()).toBeVisible();
  await clean(page, w);
});

test('B6 integration: outlook labels on career pages, transformation and roadmap links, AI ladder on skill pages, concept readiness in Future Me, chips on every wave-B page, Arabic RTL with Arabic-Indic digits', async ({ page }) => {
  const w = watchErrors(page);
  await pinBackend(page, 'supabase');
  await go(page, '/careers/roles/reactor-operator?tab=horizons');
  await expect(page.locator('[data-testid="m18-fs16-line"] [data-testid="m18-fs16-label"]')).toHaveAttribute('data-label', /^(growing|changing|stable)$/);
  await expect(page.locator('[data-testid="m01-to-transformation"]')).toHaveAttribute('href', /\/careers\/roles\/reactor-operator\/transformation/);
  await go(page, '/careers');
  expect(await page.locator('[data-testid="m01-role-list"] [data-testid="m18-fs16-label"]').count()).toBe(25);
  await go(page, '/careers/roles/fr-bwr-operator');
  await expect(page.locator('[data-testid="m01-concept-roadmap"]')).toHaveAttribute('href', /\/my\/career\/roadmap\?role=fr-bwr-operator/);
  await go(page, '/skills/sk-fs-ai-verify');
  await expect(page.locator('[data-testid="m28-ai-track"]')).toHaveAttribute('data-track', 'literacy');
  await expect(page.locator('[data-testid="m28-to-ai-ladder"]')).toHaveAttribute('href', /\/learn\/ai-fluency/);
  await go(page, '/learn/ai-fluency');
  expect(await page.locator('[data-testid="m29-skill-link"]').count()).toBeGreaterThan(0);
  await clean(page, w);
  await as(page, 'nse');
  await go(page, '/my/future');
  await expect(page.locator('[data-testid="m21-concept-readiness"]').first()).toBeVisible();
  await expect(page.locator('[data-testid="m21-to-roadmap"]').first()).toHaveAttribute('href', /\/my\/career\/roadmap\?role=fr-/);
  await go(page, '/my/role-2030');
  await expect(page.locator('[data-testid="m30-skill-link"]').first()).toHaveAttribute('href', /\/skills\/sk-/);
  await clean(page, w);
  // every wave-B page in Arabic: RTL, chips loaded from the registry, Arabic-Indic digits
  await as(page, 'chco');
  await page.evaluate(() => localStorage.setItem('kafaa.prefs.v1', JSON.stringify({ digits: 'arab', calendar: 'gregorian' }))); // the user's digit setting
  const AR: [string, string][] = [
    ['/skills', 'FS07'], ['/skills/frameworks', 'FS08'], ['/learn/ai-fluency', 'FS09'], ['/workforce/ai-fluency', 'FS10'], ['/my/role-2030?role=reactor-operator', 'FS11'],
    ['/my/role-2030/tasks?role=reactor-operator', 'FS12'], ['/my/future', 'FS13'], ['/workforce/future/interest', 'FS14'], ['/my/career', 'FS15'], ['/careers/outlook-criteria', 'FS16'],
  ];
  for (const [p, fs] of AR) {
    await go(page, `/ar${p}`);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await chips(page, 'main', fs);
    expect(await page.locator('main').innerText(), p).toMatch(/[٠-٩]/);
    expect(await textIssues(page), p).toEqual([]);
  }
  expect(w.take()).toEqual([]);
  expect(M18.fs15.conceptChip).toBeTruthy();
});
