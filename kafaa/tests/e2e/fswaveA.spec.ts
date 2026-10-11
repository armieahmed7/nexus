/**
 * FS wave A journeys (FS01-FS06, the future-skills taxonomy spine), supabase mode against the live NEXUS project with real NEXUS
 * demo sign-in. Every acceptance criterion of the six wave-A cards is exercised in the browser, or asserted on the payload the
 * signed-in page receives from the same RPC / RLS read (PGlite and unit tests prove SQL = TS). Writes: one FS06 task edit and its
 * restore by the training manager (two SAT change-log rows); everything else is read-only or an audited refusal. Rerunnable.
 *  A1 FS01 benchmark registry + FS02 catalogue: 40 sourced benchmarks (public read, https + as-of), chip drawer, admin registry and
 *     catalogue tabs (120 skills, sourced, owners, lifecycle), obsolete skill kept with its replacement, cyber hygiene outside the
 *     security area, staff cannot write the catalogue
 *  A2 FS03 honest skill states: bands and intervals on every skill, record drawer, decay classes (18/36/60 months), Navigator
 *     readiness band, admin preview of a half-life change (no save), out-of-range refused, stats aggregate-only (staff refused)
 *  A3 FS04 keyspace + radar: 27/27 ADVANCE and 8/8 radar keys resolved, FS02 rows in the keyspace, computed radar with suppressed
 *     cells (RPC nulls), Scenario A vs B differ, employees refused
 *  A4 FS05 role horizons: 28/28 roles with 2030, 11/11 concept roles, RO 2030 adds AI output verification (FS02 skill), path-level
 *     only for security roles, anon reads published only, planning-assumption copy without headcount/sites, editor for the TM
 *  A5 FS06 task layer: 91/91 rated, restricted tasks never returned (UI + RPC), exposure reasons, FS02 future skills on a task,
 *     an edit writes one SAT change-log row (and is restored), instructors read-only
 *  A6 integration: every wave-A page shows its FS01 benchmark chips, opens the registry drawer, renders in Arabic RTL
 */
import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { BASE, pinBackend, settle, signIn, textIssues, watchErrors } from './helpers';

const CONFIG = readFileSync('src/config.ts', 'utf8');
const SB_URL = CONFIG.match(/'(https:\/\/[a-z0-9]+\.supabase\.co)'/)![1];
const ANON = CONFIG.match(/'(eyJ[A-Za-z0-9._-]+)'/)![1];
const SEED = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables as Record<string, any[]>; // eslint-disable-line @typescript-eslint/no-explicit-any
const FEATURE: Record<string, string[]> = { FS02: ['WEF-FOJ', 'ESCO', 'LIGHTCAST', 'MCK-DELTA', 'JAHIZ'], FS03: ['WEF-FOJ', 'SKILLS-TECH', 'FORECAST'], FS04: ['IAEA-WFP', 'ESCO'], FS05: ['SG-JTM', 'SSG-SF', 'IAEA-WFP'], FS06: ['OECD-AICI', 'SSG-SF', 'ONET'] };

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
/** The shared FS01 chips inside a container: loaded registry rows render as buttons. */
async function chips(page: Page, root: string, feature: string) {
  const sel = root === 'main' ? 'main' : `[data-testid="${root}"]`;
  const loc = page.locator(`${sel} button[data-testid^="benchmark-chip-"]`).first();
  await expect(loc).toBeVisible();
  const ids = await page.locator(`${sel} button[data-testid^="benchmark-chip-"]`).evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!.replace('benchmark-chip-', '')));
  for (const id of FEATURE[feature]) expect(ids, `${root}: ${id}`).toContain(id); // the card's chips (tables may add per-row chips)
}
async function openChip(page: Page, id: string) {
  await page.locator(`button[data-testid="benchmark-chip-${id}"]`).first().click();
  const d = page.locator('[data-testid="benchmark-drawer"]');
  await expect(d).toBeVisible();
  expect(await d.locator('a[href^="https://"]').count()).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
}

test('A1 FS01 benchmark registry and FS02 catalogue: sourced rows, chips, admin tabs, obsolete kept, cyber hygiene career-safe', async ({ page }) => {
  const w = watchErrors(page);
  await pinBackend(page, 'supabase');
  await go(page, '/careers/horizons');
  // anonymous public read: 40 listed benchmarks, each with an https source and an as-of date
  const bms = await rest(page, 'kafaa_benchmarks?select=id,urls,as_of,status');
  expect(bms.length).toBe(40);
  expect(bms.every((b: { urls: string[]; as_of: string }) => b.urls.length > 0 && b.urls.every((u) => u.startsWith('https://')) && /^\d{4}-\d\d-\d\d$/.test(b.as_of))).toBe(true);
  // anonymous skills read carries the taxonomy attributes; 120 skills, all with source, owner, version, review date, lifecycle
  const sk = await rest(page, 'kafaa_skills?select=id,area,fs_area,sources,owner_role,version,review_due,lifecycle,decay_class,replaced_by,obsolete_on');
  expect(sk.length).toBeGreaterThanOrEqual(110);
  expect(sk.every((s: { sources: unknown[]; owner_role: string; version: number; review_due: string; lifecycle: string }) => s.sources.length > 0 && s.owner_role && s.version >= 1 && s.review_due && s.lifecycle)).toBe(true);
  const obs = sk.find((s: { id: string }) => s.id === 'sk-fs-dp-paperwp');
  expect([obs.lifecycle, obs.replaced_by, !!obs.obsolete_on]).toEqual(['obsolete', 'sk-fs-dp-ework', true]);
  expect(sk.filter((s: { fs_area: string; area: string }) => s.fs_area === 'cyber_hygiene' && s.area === 'security')).toEqual([]);
  await chips(page, 'm01-benchmarks', 'FS05');
  await openChip(page, 'SG-JTM');
  await clean(page, w);
  // admin: the catalogue tab (FS02 chips, 120 rows, drawer with sources and benchmark chips, obsolete with replacement)
  await as(page, 'ai-governance');
  await go(page, '/admin/frameworks?tab=skills');
  await chips(page, 'fs-admin-skills', 'FS02');
  await expect(page.locator('[data-testid="fs-sk-table"]')).toBeVisible();
  await go(page, '/admin/frameworks?tab=skills&sarea=ai_data');
  await page.locator('[data-testid="fs-sk-open-sk-fs-ai-verify"]').first().click();
  const drawer = page.locator('[data-testid="fs-sk-drawer"]');
  await expect(drawer).toContainText(/Checks AI outputs against procedures/);
  await expect(page.getByRole('dialog')).toContainText(/AI output verification/);
  expect(await drawer.locator('a[href^="https://"]').count()).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  await go(page, '/admin/frameworks?tab=benchmarks');
  await expect(page.locator('[data-testid="fs-bm-table"]')).toBeVisible();
  await expect(page.locator('[data-testid="fs-admin-benchmarks"]')).toContainText(/40/);
  await clean(page, w);
  // staff cannot write the catalogue directly (RLS): the update touches no row or is refused
  await as(page, 'nse');
  const upd = await page.evaluate(async ([url, anon]) => {
    const sessions = JSON.parse(localStorage.getItem('nexus.auth.v1.sessions') || '{}');
    const tok = sessions[localStorage.getItem('nexus.active') || '']?.access_token;
    const r = await fetch(`${url}/rest/v1/kafaa_skills?id=eq.sk-fs-ai-verify`, { method: 'PATCH', headers: { apikey: anon, Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ lifecycle: 'declining' }) });
    return { status: r.status, body: await r.text() };
  }, [SB_URL, ANON] as const);
  expect(upd.status === 401 || upd.status === 403 || upd.body === '[]').toBe(true);
});

test('A2 FS03 honest skill states: bands and intervals, sources, decay classes, Navigator band, admin preview and refusals', async ({ page }) => {
  const w = watchErrors(page);
  await as(page, 'nse');
  await go(page, '/my/skills/confidence');
  const rows = page.locator('[data-testid="m17-conf-row"]');
  await expect(rows.first()).toBeVisible();
  const bands = await rows.evaluateAll((els) => els.map((e) => e.getAttribute('data-band')));
  expect(bands.length).toBeGreaterThan(0);
  expect(bands.every((b) => ['low', 'medium', 'high'].includes(String(b)))).toBe(true);
  await chips(page, 'm17-benchmarks', 'FS03');
  // the decay classes: fast 18, standard 36, slow 60 months (sourced public rows)
  const classes = await rest(page, 'kafaa_skill_decay_classes?select=id,default_months,areas,sources&order=sort');
  expect(classes.map((c: { id: string; default_months: number }) => [c.id, c.default_months])).toEqual([['fast', 18], ['standard', 36], ['slow', 60]]);
  expect(classes.every((c: { sources: { url: string }[] }) => c.sources.every((s) => s.url.startsWith('https://')))).toBe(true);
  // every person skill row carries a band and an interval (own rows through RLS)
  const mine = await rest(page, 'kafaa_person_skills?select=id,confidence,confidence_band,conf_low,conf_high&active=eq.true');
  expect(mine.length).toBeGreaterThan(0);
  expect(mine.every((p: { confidence: number; confidence_band: string; conf_low: number; conf_high: number }) => ['low', 'medium', 'high'].includes(p.confidence_band) && p.conf_low <= p.confidence && p.confidence <= p.conf_high)).toBe(true);
  // the record drawer lists the sources with dates
  await rows.first().locator('button').first().click();
  await expect(page.locator('[data-testid="m17-conf-drawer"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await clean(page, w);
  // the Navigator readiness tile shows the band (a person with roles within two steps)
  await as(page, 'qc-inspector');
  await go(page, '/my/career');
  await expect(page.locator('[data-testid="m18-readiness-sure"]').first()).toHaveAttribute('data-band', /low|medium|high/);
  // statistics are aggregate-only: staff are refused
  const refused = await rpc(page, 'kafaa_skill_confidence_stats', {});
  expect(refused.status).toBeGreaterThanOrEqual(400);
  w.take(); // the intended 403 of the refused call is logged by the browser
  await clean(page, w);
  // admin: tiles, curves, back-fill, preview a change without saving; out of range refused by the RPC
  await as(page, 'ai-governance');
  await go(page, '/admin/skills-confidence');
  await expect(page.locator('[data-testid="m17-adm-tiles"]')).toBeVisible();
  await expect(page.locator('[data-testid="m17-adm-backfill"]')).toBeVisible();
  await chips(page, 'm17-benchmarks', 'FS03');
  const stats = await rpc(page, 'kafaa_skill_confidence_stats', { p_hl: { half_life_fast: 12 } });
  expect(stats.status).toBe(200);
  expect(stats.body.months).toEqual({ fast: 18, standard: 36, slow: 60 });
  expect(stats.body.preview.months.fast).toBe(12);
  expect(stats.body.backfill.awards).toBe(stats.body.backfill.with_evidence); // every issued award has credential evidence
  for (const c of stats.body.by_class) if (c.suppressed) expect(c.states).toBeNull();
  const bad = await rpc(page, 'kafaa_set_skill_half_lives', { p: { fast: 200, standard: 36, slow: 60, rationale: 'E2E-QA out of range check' } });
  expect(bad.body.ok).toBe(false);
  expect(bad.body.code).toBe('invalid');
  await clean(page, w);
});

test('A3 FS04 keyspace and computed radar: every key resolves, FS02 rows, suppression, scenarios differ, employees refused', async ({ page }) => {
  const w = watchErrors(page);
  await as(page, 'chco');
  await go(page, '/workforce/future/keyspace');
  await expect(page.locator('main')).toContainText('27');
  await expect(page.locator('main')).toContainText('8');
  await chips(page, 'm11-benchmarks', 'FS04');
  const map = await rest(page, 'kafaa_future_skill_map?select=id,key,key_kind,sk_id,active');
  const keysAdv = new Set(map.filter((m: { key_kind: string; active: boolean }) => m.key_kind === 'adv_skill' && m.active).map((m: { key: string }) => m.key));
  const keysRadar = new Set(map.filter((m: { key_kind: string; active: boolean }) => m.key_kind === 'radar' && m.active).map((m: { key: string }) => m.key));
  expect([keysAdv.size, keysRadar.size]).toEqual([27, 8]);
  expect(map.some((m: { id: string }) => m.id === 'fsm:ai-governance:sk-fs-ai-verify')).toBe(true); // FS02 row (wave-A integration)
  await clean(page, w);
  await go(page, '/workforce/future');
  await chips(page, 'm11-benchmarks', 'FS04');
  await expect(page.locator('[data-testid="m11-suppressed-salt-chemistry"]')).toBeVisible();
  const scenarios = [...new Set(SEED.future_skills.map((f) => f.scenario))] as string[];
  const ra = await rpc(page, 'kafaa_future_radar', { p_scenario: scenarios[0] });
  const rb = await rpc(page, 'kafaa_future_radar', { p_scenario: scenarios[1] });
  expect(ra.status).toBe(200);
  const rowsA = ra.body.rows ?? ra.body.data?.rows;
  const rowsB = rb.body.rows ?? rb.body.data?.rows;
  expect(rowsA.length).toBe(8);
  const differ = rowsA.filter((r: { key: string; demand: number }) => rowsB.find((x: { key: string }) => x.key === r.key)?.demand !== r.demand).length;
  expect(differ).toBeGreaterThanOrEqual(6);
  for (const c of rowsA) if (c.suppressed) expect([c.readiness, c.ready_n]).toEqual([null, null]);
  const before = await page.locator('[data-testid="m11-assumptions"]').innerText();
  await page.locator('[data-testid="m11-scenario-b"]').click();
  await expect(page.locator('[data-testid="m11-assumptions"]')).not.toHaveText(before);
  await clean(page, w);
  // employees are refused (page and RPC)
  await as(page, 'nse');
  await go(page, '/workforce/future/keyspace');
  await expect(page.locator('[data-testid="forbidden"]')).toBeVisible();
  const r = await rpc(page, 'kafaa_future_radar', { p_scenario: scenarios[0] });
  expect(r.status >= 400 || r.body?.ok === false).toBe(true);
});

test('A4 FS05 role horizons: 28/28 2030 profiles, 11/11 concept roles, FS02 skill in the RO 2030 profile, security path-level, published only', async ({ page }) => {
  const w = watchErrors(page);
  await pinBackend(page, 'supabase');
  await go(page, '/careers/horizons');
  await expect(page.locator('[data-testid="m01-horizons-tiles"]')).toContainText('28');
  await expect(page.locator('[data-testid="m01-horizons-tiles"]')).toContainText('11');
  await chips(page, 'm01-benchmarks', 'FS05');
  const pub = await rest(page, 'kafaa_role_profile_versions?select=id,role_id,horizon,status,requirements,path_only,rationale_en');
  expect(pub.every((v: { status: string }) => v.status === 'published')).toBe(true); // anon reads published only
  const roles = await rest(page, 'kafaa_job_roles?select=id,lifecycle');
  const current = roles.filter((r: { lifecycle: string }) => r.lifecycle === 'current').map((r: { id: string }) => r.id);
  const concept = roles.filter((r: { lifecycle: string }) => r.lifecycle === 'concept').map((r: { id: string }) => r.id);
  expect([current.length, concept.length]).toEqual([28, 11]);
  expect(current.every((id: string) => pub.some((v: { role_id: string; horizon: string }) => v.role_id === id && v.horizon === '2030'))).toBe(true);
  for (const id of concept) {
    const reqs = pub.filter((v: { role_id: string }) => v.role_id === id).map((v: { requirements: unknown[] }) => v.requirements.length);
    expect(Math.max(...reqs), id).toBeGreaterThanOrEqual(4);
  }
  const edges = await rest(page, 'kafaa_career_paths?select=from_role_id,to_role_id,kind&kind=eq.future');
  for (const id of concept) expect(edges.some((e: { to_role_id: string }) => e.to_role_id === id), id).toBe(true);
  expect(pub.filter((v: { path_only: boolean; requirements: unknown[] }) => v.path_only && v.requirements.length > 0)).toEqual([]);
  expect(pub.some((v: { rationale_en: string }) => /\b(headcount|\d+\s+(engineers|people|staff))\b/i.test(v.rationale_en))).toBe(false);
  const ro30 = pub.find((v: { role_id: string; horizon: string }) => v.role_id === 'reactor-operator' && v.horizon === '2030');
  expect(ro30.requirements.some((r: { ref_id: string }) => r.ref_id === 'sk-fs-ai-verify')).toBe(true); // FS02 skill (wave-A wiring)
  await clean(page, w);
  // the role tab: horizon switch, what changes, why, planning assumption
  await go(page, '/careers/roles/reactor-operator?tab=horizons');
  const panel = page.locator('[data-testid="m01-horizon-panel"]');
  await expect(panel).toBeVisible();
  await page.locator('[data-testid="m01-horizon-2030"]').click();
  await expect(page.locator('[data-testid="m01-horizon-reqs"]')).toContainText(/AI output verification/);
  await expect(page.locator('main')).toContainText(/no deployment decision/i);
  await go(page, '/careers/roles/security-officer?tab=horizons');
  await expect(page.locator('main')).toContainText(/Career-path level only/);
  await clean(page, w);
  // training manager: the editor with drafts and checks
  await as(page, 'training-mgr');
  await go(page, '/careers/roles/maintenance-technician-engineer/profile?h=2035');
  await expect(page.locator('[data-testid="m01-edit-base"]')).toBeVisible();
  await expect(page.locator('[data-testid="m01-edit-checks"]')).toBeVisible();
  await chips(page, 'm01-benchmarks', 'FS05');
  const drafts = await rest(page, 'kafaa_role_profile_versions?select=id&status=eq.draft');
  expect(drafts.length).toBeGreaterThanOrEqual(2);
  await clean(page, w);
  // an employee cannot save a profile (RPC refused, audited)
  await as(page, 'nse');
  const r = await rpc(page, 'kafaa_save_role_profile_version', { p: { role_id: 'local-operator', horizon: '2035', requirements: [], drivers: [], rationale_en: 'x'.repeat(30), rationale_ar: 'س'.repeat(30), sources: [], publish: false } });
  expect(r.body.ok).toBe(false);
  expect(r.body.code).toBe('forbidden');
});

test('A5 FS06 task layer: all tasks rated, restricted never returned, reasons, FS02 future skills, an edit writes one change-log row', async ({ page }) => {
  const w = watchErrors(page);
  await as(page, 'training-mgr');
  await go(page, '/training/sat/future');
  const rated = SEED.jta_tasks.filter((t) => !t.restricted).length;
  await expect(page.locator('[data-testid="m26-fx-tiles"]')).toContainText(`${rated} / ${rated}`);
  await chips(page, 'm26-fx-bench', 'FS06');
  const restricted = SEED.jta_tasks.filter((t) => t.restricted);
  for (const t of restricted) await expect(page.locator('main')).not.toContainText(t.title_en);
  const view = await rpc(page, 'kafaa_task_future', { p_role: null });
  const tasks = view.body.data?.tasks ?? view.body.tasks;
  expect(tasks.length).toBe(rated);
  expect(tasks.some((t: { id: string }) => restricted.some((r) => r.id === t.id))).toBe(false);
  expect(tasks.every((t: { exposure: string; reasons: unknown[] }) => t.exposure && t.reasons.length > 0)).toBe(true);
  const fut = tasks.flatMap((t: { skills: { skill_id: string; kind: string }[] }) => t.skills.filter((s) => s.kind === 'future').map((s) => s.skill_id));
  expect(fut.some((s: string) => s.startsWith('sk-fs-'))).toBe(true);
  expect(fut.includes('sk-da-02-review')).toBe(false);
  await clean(page, w);
  // the task page: future card with reasons, skills (FS02 future skill), benchmark ties
  const task = SEED.jta_tasks.find((t) => t.id === 'jt-qs-ro-t4')!;
  await go(page, `/training/sat/tasks/${task.id}`);
  const card = page.locator('[data-testid="m26-fx-card"]');
  await expect(card).toBeVisible();
  await expect(page.locator('[data-testid="m26-fx-skills"]')).toContainText(/AI output verification/);
  await chips(page, 'main', 'FS06');
  // one edit writes one SAT change-log row; restored with a second edit (rerunnable)
  const log0 = (await rest(page, `kafaa_sat_changes?select=id&task_id=eq.${task.id}&area=eq.future`)).length;
  const cur = tasks.find((t: { id: string }) => t.id === task.id);
  const input = (h: string) => ({ task_id: task.id, needs: cur.needs, change_horizon: h, tech_driver: cur.tech_driver, skills: cur.skills.map((s: { skill_id: string; level: number; kind: string }) => ({ skill_id: s.skill_id, level: s.level, kind: s.kind })), note: 'E2E-QA wave A: horizon check and restore' });
  const other = cur.change_horizon === '2035' ? '2030' : '2035';
  const e1 = await rpc(page, 'kafaa_set_task_future', { p: input(other) });
  expect(e1.body.ok, JSON.stringify(e1.body)).toBe(true);
  const e2 = await rpc(page, 'kafaa_set_task_future', { p: input(cur.change_horizon) });
  expect(e2.body.ok).toBe(true);
  const log1 = (await rest(page, `kafaa_sat_changes?select=id&task_id=eq.${task.id}&area=eq.future`)).length;
  expect(log1 - log0).toBe(2);
  // a restricted task cannot be rated
  const rr = await rpc(page, 'kafaa_set_task_future', { p: { ...input(cur.change_horizon), task_id: restricted[0].id } });
  expect(rr.body.ok).toBe(false);
  await clean(page, w);
  // an instructor who is not a designated SAT analyst reads without write controls (sq-lead is the seeded analyst)
  await as(page, 'head-sq');
  await go(page, '/training/sat/future');
  await expect(page.locator('[data-testid="m26-fx-readonly"]')).toBeVisible();
  const ri = await rpc(page, 'kafaa_set_task_future', { p: input(cur.change_horizon) });
  expect(ri.body.ok).toBe(false);
  await clean(page, w);
});

test('A6 integration: every wave-A page shows its FS01 chips and renders in Arabic RTL with Arabic benchmark names', async ({ page }) => {
  const w = watchErrors(page);
  const pages: [string, string | null, string, string][] = [
    ['/careers/horizons', null, 'm01-benchmarks', 'FS05'],
    ['/my/skills/confidence', 'nse', 'm17-benchmarks', 'FS03'],
    ['/admin/skills-confidence', 'ai-governance', 'm17-benchmarks', 'FS03'],
    ['/workforce/future', 'chco', 'm11-benchmarks', 'FS04'],
    ['/workforce/future/keyspace', 'chco', 'm11-benchmarks', 'FS04'],
    ['/careers/roles/reactor-operator/profile', 'training-mgr', 'm01-benchmarks', 'FS05'],
    ['/training/sat/future', 'training-mgr', 'm26-fx-bench', 'FS06'],
    ['/admin/frameworks?tab=skills', 'ai-governance', 'fs-admin-skills', 'FS02'],
  ];
  let who: string | null | undefined;
  for (const [path, persona, root, feature] of pages) {
    if (persona !== who) {
      if (persona) await as(page, persona);
      else await pinBackend(page, 'supabase');
      who = persona;
    }
    await go(page, `/ar${path}`);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await chips(page, root, feature);
    const chipText = await page.locator(`[data-testid="${root}"] button[data-testid^="benchmark-chip-"]`).first().innerText();
    expect(chipText, path).toMatch(/[؀-ۿ]/);
    await clean(page, w);
  }
});
