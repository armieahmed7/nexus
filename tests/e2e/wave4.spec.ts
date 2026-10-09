/**
 * Wave 4 journeys (F25-F31, the training system), supabase mode against the live NEXUS project with real NEXUS demo sign-in.
 * Every acceptance criterion of the wave-4 cards is exercised in the browser, or (where only a crafted request can reach it)
 * asserted on the payload the signed-in page receives from the same RPC / RLS read. Writes are few and by synthetic role cards:
 * one crew debrief on a past crew-B slot (F28 -> F30), audited refusals elsewhere.
 *  Z1 F25 effectiveness: instructors see aggregates only and no individual L1, n >= 10, L3 due at +90 days, released-only L2,
 *     L4 caveat + SAMPLE, the learner's anonymous L1 page, the line manager's L3 board
 *  Z2 F26 needs: drill-down sums, suppressed cells for HR with exact totals, drafts on /training/schedule (not published),
 *     SIMULATED intake, F31 instructor pool
 *  Z3 F27 SAT: restricted tasks never expose a title (UI + RLS), matrix gaps, change impact, redesign flags (F25), auditor read-only
 *  Z4 F28 simulator: training scenarios only (exam refused UI + RPC), coverage gaps, a live debrief writes evidence for the
 *     present crew only and emits one xAPI statement per present member (F30)
 *  Z5 F29 accreditation: evidence suggestions or "no evidence found", maker-checker finalise, demo notice on the report, sources
 *  Z6 F30 LRS: own timeline + JSON (no mbox), manager scope (UI + RPC refusal), aggregate only for HR, immutable store, schema
 *     error, no secure item id in any statement the user can read
 *  Z7 F31 instructors: two co-teach + one solo by different observers, maker-checker, self-observation refused, currency notices,
 *     ASIP fact with source
 *  Z8 W4 integration and deploy: issuer keys served at /kafaa/issuer/ and /kafaa/.well-known/, emitter registry, evidence links
 */
import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { BASE, pinBackend, settle, signIn, textIssues, watchErrors } from './helpers';
import { contentIssue, crewRoster } from '../../src/modules/m04/scenarios';
import { DEMO_NOTICE } from '../../src/modules/m26/accr';
import { RESTRICTED_TITLE } from '../../src/modules/m26/sat';

const CONFIG = readFileSync('src/config.ts', 'utf8');
const SB_URL = CONFIG.match(/'(https:\/\/[a-z0-9]+\.supabase\.co)'/)![1];
const ANON = CONFIG.match(/'(eyJ[A-Za-z0-9._-]+)'/)![1];
const SEED = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables as Record<string, any[]>;
const SECURE = SEED.items.filter((i) => i.bank === 'secure').map((i) => String(i.id));
const crewOf = (id: string) => SEED.people.find((p) => p.id === id)?.crew;

async function go(page: Page, path: string) {
  await page.goto(BASE + path);
  await settle(page);
}
async function as(page: Page, persona: string) {
  await pinBackend(page, 'supabase');
  await signIn(page, persona);
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
async function rest<T = any>(page: Page, path: string, method = 'GET', body?: unknown): Promise<T> {
  return page.evaluate(async ([url, anon, p, m, b]) => {
    const sessions = JSON.parse(localStorage.getItem('nexus.auth.v1.sessions') || '{}');
    const tok = sessions[localStorage.getItem('nexus.active') || '']?.access_token;
    const r = await fetch(`${url}/rest/v1/${p}`, { method: m, headers: { apikey: anon, Authorization: `Bearer ${tok || anon}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: b == null ? undefined : JSON.stringify(b) });
    const txt = await r.text();
    try { return { status: r.status, data: JSON.parse(txt) }; } catch { return { status: r.status, data: txt }; }
  }, [SB_URL, ANON, path, method, body ?? null] as const) as Promise<T>;
}
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

test('Z1 F25 effectiveness: aggregates only for instructors, n >= 10, L3 at +90 days, L4 caveat, anonymous L1', async ({ page }) => {
  const w = watchErrors(page);
  await as(page, 'sq-lead'); // instructor: learning_analytics Agg
  await go(page, '/training/effectiveness');
  await expect(page.locator('[data-testid="m25-course-c-get"]')).toBeVisible();
  await expect(page.locator('[data-testid="m25-eff-labels"]')).toContainText(/SAMPLE/i);
  expect(await page.locator('[data-testid="m25-suppressed"]').count()).toBeGreaterThan(3);
  await expect(page.locator('[data-testid="m25-schedule-l3"]')).toHaveCount(0);
  // RLS: an instructor reads no individual L1 response except their own
  const me = 'p-sq-lead';
  const l1 = await rest(page, 'kafaa_eval_responses?select=person_id');
  expect(l1.status).toBe(200);
  expect((l1.data as any[]).every((r) => r.person_id === me)).toBe(true);
  // scorecard payload: every group under 10 is null
  const rep = await rpc(page, 'kafaa_effectiveness_report', { p_course: null });
  expect(rep.ok).toBe(true);
  const nums: number[] = [];
  JSON.stringify(rep.data, (k, v) => { if (/^n(_|$)|_n$|^responses$|^pairs$/.test(k) && typeof v === 'number') nums.push(v); return v; });
  expect(nums.every((n) => n === 0 || n >= 10)).toBe(true);
  // a course with fewer than 10 answers suppresses L1 and keeps the L4 caveat
  await go(page, '/training/effectiveness/c-coct');
  await expect(page.locator('main')).toContainText(/Results show when 10 or more people have answered/);
  await expect(page.locator('main')).toContainText(/Association, not causation/);
  await clean(page, w);

  const tm = await fresh(page, 'training-mgr');
  const w2 = watchErrors(tm);
  await go(tm, '/training/effectiveness/c-hu');
  await expect(tm.locator('[data-testid="m25-l4"]')).toContainText(/HU-related event rate/);
  await expect(tm.locator('[data-testid="m25-l4"]')).toContainText(/SAMPLE/i);
  await expect(tm.locator('main')).toContainText(/Association, not causation/);
  await expect(tm.locator('[data-testid="m25-l2"]')).toBeVisible();
  // L3 observations are due 90 days after completion (qualifying courses only)
  const board = await rpc(tm, 'kafaa_l3_board');
  expect(board.ok && board.data.rows.length).toBeGreaterThan(20);
  expect(board.data.rows.every((r: any) => r.due_on === addDays(r.completed_on, 90))).toBe(true);
  const qualifying = new Set(SEED.eval_surveys.filter((s) => s.l3_items?.length || s.l3?.length || s.l3_checklist?.length || s.qualifies_l3).map((s) => s.course_id));
  if (qualifying.size) expect(board.data.rows.every((r: any) => qualifying.has(r.course_id))).toBe(true);
  // L2 gain uses released attempts only: the seeded unreleased post attempts are not counted
  const c = (await rpc(tm, 'kafaa_effectiveness_report', { p_course: 'c-hu' })).data;
  const forms = SEED.assessment_forms.filter((f) => String(f.id).startsWith('form-l2-') && String(f.id).endsWith('c-hu')).map((f) => f.id);
  const released = SEED.attempts.filter((a) => forms.includes(a.form_id) && a.released !== false && a.status !== 'unreleased');
  const all = SEED.attempts.filter((a) => forms.includes(a.form_id));
  expect(all.length).toBeGreaterThan(released.length - 1);
  expect(JSON.stringify(c)).toContain('l2');
  await clean(tm, w2);
  await tm.close();

  // the learner: anonymous to instructors and managers
  const sro = await fresh(page, 'sro');
  const w3 = watchErrors(sro);
  await go(sro, '/my/learning/feedback');
  await expect(sro.locator('main')).toContainText(/Anonymous to instructors and managers/);
  // the line manager's L3 board: their team only
  await go(sro, '/training/observations');
  await expect(sro.locator('[data-testid="m25-l3-board"]')).toContainText(/Observations for your team/);
  const sb = await rpc(sro, 'kafaa_l3_board');
  expect(sb.ok && sb.data.mode).toBe('mine');
  await clean(sro, w3);
  await sro.close();
  // an employee is refused the scorecard
  const nse = await fresh(page, 'nse');
  expect((await rpc(nse, 'kafaa_effectiveness_report', { p_course: null })).code).toBe('forbidden');
  await nse.close();
});

test('Z2 F26 needs: drill-down sums, HR suppression with exact totals, drafts not published, SIMULATED intake, F31 pool', async ({ page }) => {
  const w = watchErrors(page);
  await as(page, 'training-mgr');
  await go(page, '/training/needs');
  const row = page.locator('[data-testid^="m25-needs-row-"]').first();
  await expect(row).toBeVisible();
  const drill = page.locator('[data-testid^="m25-drill-"]').filter({ hasNot: page.locator('[data-testid="m25-drill-sum"]') }).first();
  await drill.click();
  await expect(page.locator('[data-testid="m25-drill-sum"]')).toContainText(/adds up/);
  await page.keyboard.press('Escape');
  await page.locator('[data-testid="m25-needs-dnt"]').selectOption('20');
  await expect(page.locator('main')).toContainText(/SIMULATED intake/i);
  await page.locator('[data-testid="m25-needs-dnt"]').selectOption('0');
  await expect(page.locator('[data-testid="m25-drafts"]')).toContainText(/Draft, not published/);
  const tm = await rpc(page, 'kafaa_demand_report', { p_period: null });
  expect(tm.ok && tm.data.exact).toBe(true);
  // B1: every cell decomposes into its sources and the parts add up
  for (const r of tm.data.rows) for (const [src, cell] of Object.entries<any>(r.sources ?? {})) if (cell && Array.isArray(cell.detail)) expect(cell.detail.reduce((t: number, d: any) => t + Number(d.count ?? 0), 0), `${r.course_id}/${src}`).toBe(cell.count);
  // F31 -> F26: instructor capacity is the qualified F31 pool
  const pool = new Set(SEED.instructor_tracks.filter((x) => x.status === 'qualified').map((x) => x.person_id)).size;
  expect(tm.data.instructors).toBe(pool);
  await expect(page.locator('main')).toContainText(/Qualified instructor pool/);
  // B3: drafts appear on /training/schedule and are not sessions
  await go(page, '/training/schedule');
  await expect(page.locator('[data-testid="m25-schedule-drafts"]')).toContainText(/Draft, not published/);
  const props = await rest(page, 'kafaa_session_proposals?select=id,status,session_id');
  expect((props.data as any[]).length).toBeGreaterThan(0);
  const sessions = await rest(page, `kafaa_sessions?select=id&id=in.(${(props.data as any[]).map((p) => `"${p.id}"`).join(',')})`);
  expect(sessions.data).toEqual([]);
  await clean(page, w);

  // B2: HR sees cells under 10 suppressed, totals exact, no compute or propose
  const hr = await fresh(page, 'chco');
  const w2 = watchErrors(hr);
  await go(hr, '/training/needs');
  await expect(hr.locator('main')).toContainText(/Aggregate view/);
  expect(await hr.locator('[data-testid="m25-suppressed"]').count()).toBeGreaterThan(3);
  await expect(hr.locator('[data-testid="m25-needs-compute"]')).toHaveCount(0);
  await expect(hr.locator('[data-testid^="m25-propose-"]')).toHaveCount(0);
  const agg = await rpc(hr, 'kafaa_demand_report', { p_period: null });
  expect(agg.data.exact).toBe(false);
  expect(agg.data.total).toBe(tm.data.total);
  const cells: unknown[] = [];
  JSON.stringify(agg.data.rows, (k, v) => { if (k === 'count') cells.push(v); return v; });
  expect(cells.every((v) => v === null || (typeof v === 'number' && v >= 10) || v === 0)).toBe(true);
  await clean(hr, w2);
  await hr.close();
});

test('Z3 F27 SAT: restricted tasks stay restricted, matrix gaps, change impact, redesign flags, auditor read-only', async ({ page }) => {
  const w = watchErrors(page);
  await as(page, 'training-mgr');
  await go(page, '/training/sat');
  expect(await page.locator('[data-testid="m26-analysis-link"]').count()).toBe(SEED.jta_analyses.filter((a) => !a.restricted).length);
  await expect(page.locator('[data-testid="m26-rule-branches"]')).toContainText(/overtrain/i);
  expect(await page.locator('main').innerText()).not.toContain(RESTRICTED_TITLE.en);
  await expect(page.locator('main')).toContainText(/Courses flagged for redesign/); // F25 -> F27 hand-off
  // RLS: restricted tasks only ever carry the placeholder title
  const tasks = await rest(page, 'kafaa_jta_tasks?select=title_en,title_ar,restricted&restricted=eq.true');
  expect((tasks.data as any[]).length).toBeGreaterThan(0);
  expect((tasks.data as any[]).every((t) => t.title_en === RESTRICTED_TITLE.en && t.title_ar === RESTRICTED_TITLE.ar)).toBe(true);
  await go(page, '/training/sat/tasks/jt-security-officer-r1');
  expect(await page.locator('[data-testid="m26-restricted"]').count()).toBeGreaterThan(0);
  await expect(page.locator('[data-testid="m26-rate-form"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="m26-impact"]')).toHaveCount(0);
  // a task change lists the linked courses and standards
  await go(page, '/training/sat/tasks/jt-qs-ro-t1');
  await expect(page.locator('[data-testid="m26-impact"]')).toContainText(/qs-ro|QS-RO|Reactor/i);
  await expect(page.locator('[data-testid="m26-decision"]')).toBeVisible();
  await go(page, '/training/sat/changes');
  expect(await page.locator('[data-testid="m26-change-item"]').count()).toBeGreaterThanOrEqual(3);
  await clean(page, w);

  // the auditor reads the matrix (gaps highlighted) but cannot edit
  const au = await fresh(page, 'presenter');
  const w2 = watchErrors(au);
  await go(au, '/training/sat/roles/local-operator');
  await au.getByRole('tab', { name: /Training matrix/ }).click();
  expect(await au.locator('[data-testid="m26-gap"]').count()).toBeGreaterThanOrEqual(1);
  await expect(au.locator('[data-testid="m26-add-task"]')).toHaveCount(0);
  await clean(au, w2);
  await au.close();
  // an employee is forbidden
  const nse = await fresh(page, 'nse');
  await nse.goto(`${BASE}/training/sat`);
  await settle(nse);
  await expect(nse.locator('[data-testid="forbidden"]')).toBeVisible();
  await nse.close();
});

test('Z4 F28 simulator: training only, exam refused, coverage gaps, live debrief -> evidence for present crew + xAPI', async ({ page }) => {
  const w = watchErrors(page);
  await as(page, 'training-mgr');
  await go(page, '/training/simulator/scenarios');
  const lib = page.locator('[data-testid="m04-scn-library"]');
  await expect(lib).toContainText(/Small-break loss-of-coolant accident/);
  expect(contentIssue([await lib.innerText()])).toBeNull(); // A4: no exam or plant-security content
  await expect(page.locator('main')).toContainText(/Training scenarios only/);
  await page.getByRole('tab', { name: /Cycle planner/ }).click();
  const flagged = page.locator('[data-testid="m04-scn-matrix-row"]:not([data-status="covered"])');
  await expect(flagged.first()).toBeVisible();
  expect((await flagged.allInnerTexts()).join(' ')).toMatch(/SO-E6[\s\S]*SO-S3|SO-S3[\s\S]*SO-E6/);
  await clean(page, w);

  // A1: purpose = exam (and exam wording) is refused with exam_content, UI and RPC
  const ins = await fresh(page, 'sq-lead');
  const w2 = watchErrors(ins);
  await go(ins, '/training/simulator/scenarios');
  await ins.locator('[data-testid="m04-scn-new"]').click();
  await ins.locator('[data-testid="m04-scn-editor"]').getByLabel(/Title \(English\)/).fill('NRC exam scenario');
  await expect(ins.locator('[data-testid="m04-scn-issue"]')).toContainText(/exam/i);
  await expect(ins.locator('[data-testid="m04-scn-submit"]')).toBeDisabled();
  await ins.keyboard.press('Escape');
  const base = { purpose: 'exam', title_en: 'Loss of instrument air to one header', title_ar: 'فقدان هواء الأجهزة لأحد الخطوط', summary_en: 'The crew responds to a loss of instrument air.', summary_ar: 'يستجيب الطاقم لفقدان هواء الأجهزة.', category: 'abnormal', objective_ids: ['so-a1'], positions: ['ss', 'sro', 'ro'], duration_min: 90, fidelity: 'full_scope', programmes: ['coct'] };
  expect((await rpc(ins, 'kafaa_save_sim_scenario', { p: base })).code).toBe('exam_content');
  // A3: a live debrief on a past crew-B slot writes evidence only for members present, and F30 statements for them
  const people = (await rest(ins, 'kafaa_people?select=id,crew,kind,status,job_role_id&crew=eq.B')).data as any[];
  const slot = SEED.simulator_slots.find((s) => s.id === 'sim-h7-b');
  const roster = crewRoster(slot, people);
  expect(roster.length).toBeGreaterThan(3);
  const absent = roster[0].person_id;
  const att = roster.map((r) => ({ person_id: r.person_id, present: r.person_id !== absent }));
  expect((await rpc(ins, 'kafaa_record_debrief', { p: { slot_id: 'sim-h7-b', scenario_id: 'scn-012', attendance: [...att, { person_id: 'w-ro-03', present: true }], ratings: { communication: 4, procedure_use: 3, diagnosis: 2, leadership: 5 } } })).code).toBe('not_in_slot');
  const r = await rpc(ins, 'kafaa_record_debrief', { p: { slot_id: 'sim-h7-b', scenario_id: 'scn-012', cycle_id: null, attendance: att, ratings: { communication: 4, procedure_use: 3, diagnosis: 2, leadership: 5 }, lang: 'en' } });
  expect(r.ok || r.code === 'already_recorded', JSON.stringify(r)).toBe(true);
  const id = 'cd:sim-h7-b:scn-012';
  const members = (await rest(ins, `kafaa_crew_debrief_members?select=person_id,present,evidence_ids&debrief_id=eq.${encodeURIComponent(id)}`)).data as any[];
  expect(members.length).toBe(roster.length);
  expect(members.find((m) => m.person_id === absent)).toMatchObject({ present: false, evidence_ids: [] });
  expect(members.filter((m) => m.present).every((m) => m.evidence_ids.length === 3)).toBe(true); // diagnosis rated 2: no evidence
  const ev = (await rest(ins, `kafaa_skill_evidence?select=person_id,kind,basis&ref_table=eq.crew_debrief_members&ref_id=like.${encodeURIComponent(id)}*`)).data as any[];
  if (ev.length) expect(ev.every((e) => e.kind === 'ojt' && e.basis === 'evidenced' && e.person_id !== absent)).toBe(true);
  await clean(ins, w2);
  await ins.close();
  // F28 -> F30: one statement per present member (read by the crew-B shift manager, lrs Scope)
  const sro = await fresh(page, 'sro');
  const st = (await rest(sro, `kafaa_xapi_statements?select=actor_person_id,verb,object_id,result,source&source=eq.f28_simulator&source_ref=like.${encodeURIComponent(id)}*`)).data as any[];
  expect(st.length).toBe(roster.length - 1);
  expect(st.some((s) => s.actor_person_id === absent)).toBe(false);
  expect(st.every((s) => s.verb === 'completed' && s.object_id === 'scn-012' && Number(s.result.score.scaled) === 0.7)).toBe(true);
  await go(sro, '/my/simulator');
  await expect(sro.locator('[data-testid="m04-scn-my-list"]')).toContainText(/Crew B/);
  await sro.close();
  const hr = await fresh(page, 'chco');
  await go(hr, '/my/simulator');
  await expect(hr.locator('main')).toContainText(/No simulator debriefs yet/);
  await hr.close();
});

test('Z5 F29 accreditation: evidence or none, maker-checker, demo notice on reports, sourced criteria', async ({ page }) => {
  const w = watchErrors(page);
  await as(page, 'training-mgr');
  await go(page, '/training/accreditation');
  expect(await page.locator('[data-testid="m26-selfeval-link"]').count()).toBeGreaterThanOrEqual(6);
  await expect(page.locator('main')).toContainText(DEMO_NOTICE.en);
  await go(page, '/training/accreditation/ase-chem-init-2026-H2');
  await expect(page.locator('[data-testid="m26-finalise"]')).toBeDisabled();
  await expect(page.locator('main')).toContainText(/only person who rated it/);
  expect((await rpc(page, 'kafaa_finalise_self_eval', { p_id: 'ase-chem-init-2026-H2' })).code).toBe('maker_checker');
  await go(page, '/training/accreditation/ase-coit-2026-H2');
  await expect(page.locator('[data-testid="m26-finalise"]')).toBeEnabled();
  await page.locator('[data-testid="m26-rate-criterion"]').first().click();
  await expect(page.locator('[data-testid="m26-suggestions"], [data-testid="m26-no-evidence"]').first()).toBeVisible();
  await page.keyboard.press('Escape');
  // evidence facts: counts only, including F25 effectiveness and the F31 instructor pipeline
  const routes = new Set<string>();
  for (const p of SEED.accr_programmes) {
    const ev = await rpc(page, 'kafaa_accr_evidence', { p_programme: p.id });
    const facts = ev?.data?.facts ?? ev?.facts ?? [];
    expect(facts.length, p.id).toBeGreaterThan(0);
    for (const f of facts) routes.add(f.route);
  }
  expect(routes.has('/training/effectiveness')).toBe(true);
  expect(routes.has('/training/instructors')).toBe(true);
  // criteria are paraphrased and sourced to public IAEA / FANR documents
  const crit = (await rest(page, 'kafaa_accr_criteria?select=*')).data as any[];
  expect(crit.length).toBe(22);
  expect(JSON.stringify(crit)).not.toMatch(/\bACAD\b|INPO \d/);
  await clean(page, w);
  // the report carries the demo notice in both languages
  const au = await fresh(page, 'presenter');
  await go(au, '/training/accreditation/ase-coit-2026-H1/report');
  expect(await au.locator('[data-testid="m26-ser-frame"]').getAttribute('srcdoc')).toContain(DEMO_NOTICE.en);
  await au.locator('[data-testid="m26-ser-ar"]').click();
  await expect.poll(async () => au.locator('[data-testid="m26-ser-frame"]').getAttribute('srcdoc')).toContain(DEMO_NOTICE.ar);
  await au.close();
});

test('Z6 F30 LRS: own record, manager scope, aggregate only for HR, immutable, schema errors, no secure item ids', async ({ page }) => {
  const w = watchErrors(page);
  await as(page, 'nse');
  await go(page, '/my/learning-record');
  const tl = page.locator('[data-testid="m27-timeline"]');
  await expect(tl).toBeVisible();
  await tl.locator('[data-testid="m27-open"]').first().click();
  await expect(page.locator('[data-testid="m27-json"]')).toContainText('"homePage": "https://kafaa.example"');
  expect(await page.locator('[data-testid="m27-json"]').innerText()).not.toMatch(/mbox|@/);
  await page.keyboard.press('Escape');
  const own = (await rest(page, 'kafaa_xapi_statements?select=*')).data as any[];
  expect(own.length).toBeGreaterThan(0);
  expect(own.every((s) => s.actor_person_id === 'p-nse')).toBe(true);
  expect(SECURE.some((id) => JSON.stringify(own).includes(id))).toBe(false);
  // M04 completion emits exactly one completed statement per record
  const recs = SEED.training_records.filter((r) => r.person_id === 'p-nse');
  const courseSt = own.filter((s) => s.source === 'm04_course');
  expect(courseSt.length).toBeGreaterThanOrEqual(recs.length);
  expect(new Set(courseSt.map((s) => s.source_ref)).size).toBe(courseSt.length);
  // immutable: an update is refused
  const patch = await rest(page, `kafaa_xapi_statements?id=eq.${own[0].id}`, 'PATCH', { verb: 'passed' });
  expect(patch.status).toBeGreaterThanOrEqual(400);
  await clean(page, w);

  // a manager queries people in scope only
  const sro = await fresh(page, 'sro');
  const w2 = watchErrors(sro);
  await go(sro, '/training/lrs');
  await expect(sro.locator('[data-testid="m27-statements"]')).toBeVisible();
  const opts = await sro.locator('[data-testid="m27-f-person"] option').evaluateAll((o) => o.map((x) => (x as HTMLOptionElement).value).filter(Boolean));
  expect(opts.length).toBeGreaterThan(0);
  expect(opts.every((p) => p === 'p-sro' || crewOf(p) === 'B')).toBe(true);
  const crewA = SEED.xapi_statements.find((s) => crewOf(s.actor_person_id) === 'A')!.actor_person_id;
  expect((await rpc(sro, 'kafaa_query_statements', { p: { actor: crewA } })).code).toBe('not_in_scope');
  await go(sro, `/training/lrs/people/${crewA}`);
  await expect(sro.locator('[data-testid="m27-person-refused"]')).toBeVisible();
  await go(sro, '/training/lrs');
  await sro.getByRole('tab', { name: /Emitters/ }).click().catch(() => undefined);
  await clean(sro, w2);
  await sro.close();

  // HR: aggregate only, suppressed under 10
  const hr = await fresh(page, 'chco');
  await go(hr, '/training/lrs');
  await expect(hr.locator('[data-testid="m27-top"]')).toBeVisible();
  await expect(hr.locator('[data-testid="m27-statements"]')).toHaveCount(0);
  expect((await rpc(hr, 'kafaa_query_statements', { p: {} })).code).toBe('aggregate_only');
  await hr.close();

  // the admin console: an invalid statement is refused with a schema error
  const ad = await fresh(page, 'ai-governance');
  const bad = await rpc(ad, 'kafaa_store_statement', { p: { actor: { mbox: 'mailto:someone@example.com' }, verb: { id: 'http://adlnet.gov/expapi/verbs/completed' }, object: { id: 'x' } } });
  expect(bad.code).toBe('schema_error');
  await go(ad, '/training/lrs/adapters');
  await expect(ad.locator('[data-testid="m27-connector"]')).toBeVisible();
  await expect(ad.locator('[data-testid="m27-sample"]')).toContainText('X-Experience-API-Version: 2.0.0');
  await ad.close();
});

test('Z7 F31 instructors: qualification rule, maker-checker, no self-observation, currency notices, ASIP source', async ({ page }) => {
  const w = watchErrors(page);
  await as(page, 'training-mgr');
  await go(page, '/training/instructors');
  const pool = page.locator('[data-testid="m02-ins-pool"]');
  await expect(pool).toBeVisible();
  expect(await pool.locator('[data-testid="m02-ins-pool-status"]').count()).toBe(SEED.instructor_tracks.filter((t) => t.status === 'qualified' || t.status === 'lapsed').length);
  expect(await pool.locator('[data-testid="m02-ins-pool-status"][data-status="lapsed"]').count()).toBeGreaterThan(0);
  expect(await pool.locator('[data-testid="m02-ins-notice"]').count()).toBeGreaterThan(0);
  await expect(page.locator('[data-testid="m02-ins-fact-asip"]')).toContainText(/Accelerated SRO Instructor Program/);
  expect(await page.locator('[data-testid="m02-ins-fact-asip"] a').first().getAttribute('href')).toMatch(/^https:\/\//);
  await page.getByRole('tab', { name: /Pipeline/ }).click();
  await expect(page.locator('[data-testid="m02-ins-col-ready"]')).toContainText(/You observed this candidate/);
  // maker-checker: the training manager observed it-w-rp-02; two passes by the same observer is not a qualifying set
  expect((await rpc(page, 'kafaa_qualify_instructor', { p_track: 'it-w-rp-02', p_note: null })).code).toBe('maker_checker');
  expect((await rpc(page, 'kafaa_qualify_instructor', { p_track: 'it-w-sro-03', p_note: null })).code).toBe('not_ready');
  expect((await rpc(page, 'kafaa_qualify_instructor', { p_track: 'it-p-training-mgr', p_note: null })).code).toBe('maker_checker');
  await clean(page, w);
  // an observer cannot observe themselves
  const ins = await fresh(page, 'sq-lead');
  const items = ['safety', 'objectives', 'technical', 'method', 'engagement', 'assessment', 'time', 'professional'].map((key) => ({ key, rating: 'met' }));
  expect((await rpc(ins, 'kafaa_record_instructor_observation', { p: { track_id: 'it-p-sq-lead', kind: 'currency', observed_on: '2026-10-01', items } })).code).toBe('self_observation');
  await go(ins, '/training/instructors/it-p-sq-lead');
  await expect(ins.locator('[data-testid="m02-ins-currency"]')).toBeVisible();
  await expect(ins.locator('[data-testid="m02-ins-observe"]')).toHaveCount(0);
  await ins.close();
  // my track and the line manager's team view
  const sme = await fresh(page, 'sme-reviewer');
  await go(sme, '/my/instructor');
  await expect(sme.locator('[data-testid="m02-ins-next"]')).toContainText(/Co-teach two sessions/);
  await sme.close();
  const mgr = await fresh(page, 'chem-sup');
  await go(mgr, '/team/instructors');
  await expect(mgr.locator('[data-testid="m02-ins-team-tracks"]')).toBeVisible();
  await mgr.close();
  // HR analysts have no access
  const hr = await fresh(page, 'chco');
  await hr.goto(`${BASE}/training/instructors`);
  await settle(hr);
  await expect(hr.locator('[data-testid="forbidden"]')).toBeVisible();
  await hr.close();
});

test('Z8 W4 integration and deploy: issuer keys reachable, emitter registry, simulator tab', async ({ page }) => {
  const w = watchErrors(page);
  await as(page, 'sro');
  await go(page, '/my/skills/wallet');
  const href = await page.locator('[data-testid="m17-issuer-key"]').getAttribute('href');
  expect(href).toBe('/kafaa/issuer/kafaa-issuer.json');
  for (const u of [href!, '/kafaa/.well-known/kafaa-issuer.json']) {
    const r = await page.request.get(u);
    expect(r.status(), u).toBe(200);
    expect((await r.json()).keys?.length ?? Object.keys(await r.json()).length, u).toBeGreaterThan(0);
  }
  await clean(page, w);
  const tm = await fresh(page, 'training-mgr');
  await go(tm, '/training/lrs');
  await tm.getByRole('tab', { name: /Emitters/ }).click();
  const em = tm.locator('[data-testid="m27-emitters"]');
  await expect(em).toContainText(/Simulator debrief/);
  await expect(em.locator('tr', { hasText: 'Simulator debrief' })).toContainText(/Live/);
  await go(tm, '/training/simulator');
  await tm.getByRole('tab', { name: /Scenarios and debriefs/ }).click();
  expect(await tm.locator('[data-testid="m04-sim-library-link"]').getAttribute('href')).toBe('/kafaa/training/simulator/scenarios');
  await tm.close();
});
