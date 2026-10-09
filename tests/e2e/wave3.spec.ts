/**
 * Wave 3 journeys (F18-F24), supabase mode against the live NEXUS project with real NEXUS demo sign-in. Every acceptance
 * criterion of the wave-3 cards is exercised in the browser, or (where only a crafted request can reach it) asserted on the
 * payload the signed-in page receives from the same RPC. Writes are few, by synthetic role cards, tagged "E2E-QA".
 *  Y1 F18 talent review: manager scope, no own placement, locked cycle refuses, outlier flags, HR aggregates suppressed,
 *     employee sees only agreed priorities, line manager refused aggregates, employee refused the board
 *  Y2 F19 succession: hard gates block ready-now (UI and RPC), flags, roll-up with audit + ledger, 403 for observer-like roles
 *  Y3 F20 KLRA: total = attrition x position, bands only (no age/birth), mitigation or overdue, heatmap suppression, threshold
 *     change audited (and restored), department head scope
 *  Y4 F21 knowledge: search returns asset + OE with citations, withdrawn asset never found, security text blocked (UI + RPC),
 *     publish refused without two reviews
 *  Y5 F22 handover: suppressed cells, SAMPLE/SIMULATED with definition links, no person ids in the payload, what-if, release
 *     control for HR only, employee forbidden
 *  Y6 F23 reserve: HR approval before an alumnus sees the team, contact data refused, consent withdrawal hides at once
 *  Y7 F24 transparency: coach opt-out shows the unranked catalogue, engine cards, fairness flags and suppression, weight change
 *     audited + ledgered in the change log (and restored), HR without change log, auditor without run button
 *  Y8 W3 integration links: slate -> KLRA, expert finder -> reserve, standard -> read before requal
 */
import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { BASE, E2E_TAG, pinBackend, settle, signIn, textIssues, watchErrors } from './helpers';

// independent journeys (not serial): one failure does not skip the rest

const CONFIG = readFileSync('src/config.ts', 'utf8');
const SB_URL = CONFIG.match(/'(https:\/\/[a-z0-9]+\.supabase\.co)'/)![1];
const ANON = CONFIG.match(/'(eyJ[A-Za-z0-9._-]+)'/)![1];
const PEOPLE = new Set((JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables.people as { id: string }[]).map((p) => p.id));

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
async function confirmDialog(page: Page, reason = `${E2E_TAG} check`) {
  const dlg = page.locator('[role="dialog"]').last();
  await expect(dlg).toBeVisible();
  const ta = dlg.locator('textarea');
  if ((await ta.count()) && !(await ta.first().inputValue())) await ta.first().fill(reason);
  await dlg.locator('[data-testid="confirm-action"]').click();
}
/** Call a PostgREST RPC as the signed-in persona (the token the app itself stored). */
async function rpc<T = any>(page: Page, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  return page.evaluate(async ([url, anon, f, a]) => {
    const sessions = JSON.parse(localStorage.getItem('nexus.auth.v1.sessions') || '{}');
    const tok = sessions[localStorage.getItem('nexus.active') || '']?.access_token;
    const r = await fetch(`${url}/rest/v1/rpc/${f}`, { method: 'POST', headers: { apikey: anon, Authorization: `Bearer ${tok || anon}`, 'Content-Type': 'application/json' }, body: JSON.stringify(a) });
    const txt = await r.text();
    try { return JSON.parse(txt); } catch { return { status: r.status, text: txt }; }
  }, [SB_URL, ANON, fn, args] as const);
}
/** Direct table read through PostgREST (RLS applies). */
async function rest<T = any>(page: Page, path: string): Promise<T> {
  return page.evaluate(async ([url, anon, p]) => {
    const sessions = JSON.parse(localStorage.getItem('nexus.auth.v1.sessions') || '{}');
    const tok = sessions[localStorage.getItem('nexus.active') || '']?.access_token;
    const r = await fetch(`${url}/rest/v1/${p}`, { headers: { apikey: anon, Authorization: `Bearer ${tok || anon}` } });
    return r.json();
  }, [SB_URL, ANON, path] as const);
}
const personIds = (x: unknown) => { const s = JSON.stringify(x); return [...PEOPLE].filter((id) => s.includes(`"${id}"`)); };
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

test('Y1 F18 talent review: scope, no own placement, locked cycle refuses, outliers, suppressed aggregates, employee priorities', async ({ page }) => {
  const w = watchErrors(page);
  // sro (shift supervisor, crew B) is a manager and is placed in the ops cycle by ops-ceo: never sees their own placement
  await as(page, 'sro');
  await go(page, '/talent/review');
  const cards = page.locator('[data-testid="m23-cycle-card"]');
  await expect(cards.first()).toBeVisible();
  await expect(page.locator('[data-testid="m23-confidential"]')).toBeVisible();
  await go(page, '/talent/review/trc-2026h2-ops');
  await expect(page.locator('[data-testid="m23-ninebox"]')).toBeVisible();
  await expect(page.locator('[data-testid="m23-box"]')).toHaveCount(9);
  const board = await rpc(page, 'kafaa_talent_board', { p_cycle_id: 'trc-2026h2-ops' });
  expect(board.ok).toBe(true);
  const ids = new Set<string>((board.data.members ?? []).map((x: any) => x.person_id));
  expect(ids.size).toBeGreaterThan(0);
  expect(ids.has('p-sro')).toBe(false);
  expect((board.data.members ?? []).some((m: any) => m.person_id === 'p-sro' || m.placement?.id?.endsWith(':p-sro'))).toBe(false);
  // a manager reads no placement rows directly (RLS); the HR director (R) does
  expect(await rest(page, 'kafaa_review_placements?select=id')).toEqual([]);
  // the manager places someone in their scope (repeatable), with the evidence panel and reasons
  const unplaced = page.locator('[data-testid="m23-unplaced"]');
  const anyPerson = (await unplaced.count()) ? unplaced.getByRole('button').first() : page.locator('[data-testid="m23-box-person"]').first();
  await anyPerson.click();
  const panel = page.locator('[data-testid="m23-person-panel"]');
  await expect(panel).toBeVisible();
  await expect(panel.locator('[data-testid="m23-evidence"]')).toBeVisible();
  await expect(panel.locator('[data-testid="m23-ev-part"]')).toHaveCount(6);
  // line managers are refused the aggregates; a locked cycle refuses changes (cycle_locked)
  const agg = await rpc(page, 'kafaa_talent_aggregates', { p_cycle_id: 'trc-2026h2-ops' });
  expect(agg.ok).toBe(false);
  const locked = await rpc(page, 'kafaa_place_talent', { p: { cycle_id: 'trc-2026h1-tsv', person_id: 'w-chem-02', perf: 2, anchors: { learning: 2, leading: 2, delivering: 2 }, note: `${E2E_TAG} locked` } });
  expect(locked.ok).toBe(false);
  expect(['cycle_locked', 'forbidden']).toContain(locked.code);
  await clean(page, w);

  // the HR director: locked cycle refuses with cycle_locked (audited); calibration shows outlier flags; aggregates suppressed under 10
  const hr = await fresh(page, 'chco');
  const wh = watchErrors(hr);
  const lockedHr = await rpc(hr, 'kafaa_calibrate_cycle', { p_cycle_id: 'trc-2026h1-tsv', p_changes: [], p_finish: false });
  expect(lockedHr.code).toBe('cycle_locked');
  expect(lockedHr.audit_seq).not.toBeNull();
  expect((await rest(hr, 'kafaa_review_placements?select=id')).length).toBeGreaterThan(0);
  await go(hr, '/talent/review/trc-2026h2-mne/calibration');
  const outliers = hr.locator('[data-testid="m23-outliers"]');
  await expect(outliers).toBeVisible();
  const aggHr = await rpc(hr, 'kafaa_talent_aggregates', { p_cycle_id: null });
  expect(aggHr.ok).toBe(true);
  const nums: number[] = [];
  JSON.stringify(aggHr.data, (k, v) => { if (typeof v === 'number' && /^(n|count|total|women|emirati|hipo)$/.test(k)) nums.push(v); return v; });
  expect(nums.every((n) => n === 0 || n >= 10), `aggregate counts ${nums.join(',')}`).toBe(true);
  expect(personIds(aggHr.data)).toEqual([]);
  await go(hr, '/talent/review/insights');
  const grid = hr.locator('[data-testid="m23-ins-grid"]');
  await expect(grid.locator('[data-testid="m23-ins-cell"]')).toHaveCount(9);
  expect(await grid.locator('[data-testid="m23-ins-cell"][data-suppressed="true"]').count()).toBeGreaterThan(0);
  await go(hr, '/talent/review/pool');
  expect(await hr.locator('[data-testid="m23-hipo"]').count()).toBeGreaterThan(0);
  await clean(hr, wh);
  await hr.close();

  // an employee in the locked cycle sees "development priorities agreed", never a box or rating; the board is refused
  const emp = await fresh(page, 'qc-inspector');
  const we = watchErrors(emp);
  await go(emp, '/my/development-priorities');
  expect(await emp.locator('[data-testid="m23-my-priority"]').count()).toBeGreaterThan(0);
  expect(await emp.locator('main').innerText()).not.toMatch(/Future leader|Growth candidate|Core contributor|potential 3|box \d|9-box/i);
  expect(await rest(emp, 'kafaa_review_placements?select=id')).toEqual([]);
  const own = await rpc(emp, 'kafaa_talent_board', { p_cycle_id: 'trc-2026h1-tsv' });
  expect(own.ok).toBe(false);
  await go(emp, '/talent/review');
  await expect(emp.locator('[data-testid="forbidden"]')).toBeVisible();
  await clean(emp, we);
  await emp.close();
});

test('Y2 F19 succession: hard gates block ready-now, flags, roll-up audited and ledgered, 403 for partner, auditor and employee', async ({ page }) => {
  const w = watchErrors(page);
  await as(page, 'chco');
  await go(page, '/talent/succession');
  const slates = page.locator('[data-testid="m23-slate"]');
  expect(await slates.count()).toBe(11);
  const txt = await page.locator('[data-testid="m23-slates"]').innerText();
  expect(txt).toMatch(/No ready-now successor/);
  expect(txt).toMatch(/more than 2 slates/);
  await expect(page.locator('[data-testid="m23-sx-agg"]')).toBeVisible();
  // aggregates: every count cell under 10 is suppressed (successors, Emirati, women, counts by readiness)
  const sb = await rpc(page, 'kafaa_succession_board');
  const ag = sb.data.aggregates;
  for (const v of [ag.successors, ag.emirati, ag.women, ...Object.values(ag.by_readiness)]) expect(v === null || (v as number) >= 10, `aggregate ${v}`).toBe(true);
  // the slate: gates shown; a candidate with an unmet gate cannot be proposed ready now (UI) and the RPC refuses gate_not_met
  await go(page, '/talent/succession/ss-shift-supervisor-2026h2');
  await expect(page.locator('[data-testid="m23-successors"]')).toBeVisible();
  expect(await page.locator('[data-testid="m23-gates"]').count()).toBeGreaterThan(0);
  const cands = page.locator('[data-testid="m23-candidate"]');
  await expect(cands.first()).toBeVisible();
  const n = await cands.count();
  let blocked = -1;
  for (let i = 0; i < n; i++) if ((await cands.nth(i).locator('[data-met="false"]').count()) && (await cands.nth(i).locator('[data-testid="m23-propose"]').count())) { blocked = i; break; }
  expect(blocked).toBeGreaterThanOrEqual(0);
  await cands.nth(blocked).locator('[data-testid="m23-propose"]').click();
  await expect(page.locator('[data-testid="m23-propose-readiness"] button').first()).toBeDisabled();
  await page.keyboard.press('Escape');
  const cl = await rpc(page, 'kafaa_succession_candidates', { p_slate_id: 'ss-shift-supervisor-2026h2' });
  const gated = (cl.data ?? []).find((c: any) => (c.gates ?? []).some((g: any) => g.met === false));
  expect(gated).toBeTruthy();
  const refused = await rpc(page, 'kafaa_propose_successor', { p: { slate_id: 'ss-shift-supervisor-2026h2', person_id: gated.person_id, readiness: 'ready_now', note: `${E2E_TAG} gate check` } });
  expect(refused.code).toBe('gate_not_met');
  // bench roll-up into critical_roles: audited and ledgered
  const roll = await rpc(page, 'kafaa_rollup_bench', { p_period: '2026-H2' });
  expect(roll.ok).toBe(true);
  expect(roll.audit_seq).not.toBeNull();
  expect(roll.ledger_seq).not.toBeNull();
  const crit = await rest(page, 'kafaa_critical_roles?select=id,qualified,in_training,pipeline&id=like.crit-*-2026h2');
  expect(crit.length).toBeGreaterThan(0);
  await clean(page, w);
  // 403 for a partner, the auditor persona and an employee
  for (const persona of ['alnoor-gm', 'presenter', 'nse']) {
    const p = await fresh(page, persona);
    await go(p, '/talent/succession');
    await expect(p.locator('[data-testid="forbidden"]')).toBeVisible();
    const b = await rpc(p, 'kafaa_succession_board');
    expect(b?.ok === true && (b.data?.slates ?? []).length > 0).toBe(false);
    await p.close();
  }
});

test('Y3 F20 KLRA: total = attrition x position, bands only, mitigation or overdue, heatmap suppressed, threshold audited, scope', async ({ page }) => {
  const w = watchErrors(page);
  await as(page, 'training-mgr');
  await go(page, '/knowledge/klra');
  await expect(page.locator('[data-testid="m24-klra-register"]')).toBeVisible();
  await page.getByRole('tab', { name: /matrix/i }).click();
  await expect(page.locator('[data-testid="m24-risk-matrix"]')).toBeVisible();
  for (const period of ['2026-Q3', '2026-Q4']) {
    const reg = await rpc(page, 'kafaa_klra_register', { p_period: period });
    expect(reg.mode).toBe('all');
    expect(reg.rows.length).toBeGreaterThan(50);
    for (const r of reg.rows) expect(r.total).toBe(r.attrition_factor * r.position_factor);
    const s = JSON.stringify(reg);
    expect(s).not.toMatch(/birth|"age"|date_of_birth|"dob"/i);
    // every high-risk row has a mitigation action before the quarter closes, or shows overdue
    const high = reg.rows.filter((r: any) => r.band === 'high');
    expect(high.length).toBeGreaterThan(0);
    if (period === '2026-Q3') expect(high.every((r: any) => r.actions.length > 0 || r.mitigation === 'overdue')).toBe(true);
    else expect(high.every((r: any) => r.actions.length > 0 || ['needed', 'overdue'].includes(r.mitigation))).toBe(true);
  }
  const pos = await rpc(page, 'kafaa_klra_position', { p_id: 'pos-w-sro-02' });
  expect(JSON.stringify(pos)).not.toMatch(/birth|"age"|date_of_birth/i);
  expect(pos.position.retirement_band).toMatch(/within_2|2_5|5_plus|na/);
  // the KM owner changes the threshold (audited and ledgered), then restores the default
  const t1 = await rpc(page, 'kafaa_set_klra_thresholds', { p_high: 15, p_medium: 8 });
  expect(t1.ok).toBe(true);
  expect(t1.audit_seq).not.toBeNull();
  const t2 = await rpc(page, 'kafaa_set_klra_thresholds', { p_high: 16, p_medium: 8 });
  expect(t2.ok).toBe(true);
  await go(page, '/knowledge/klra/pos-w-sro-02');
  await expect(page.locator('[data-testid="m24-position-head"]')).toBeVisible();
  await clean(page, w);
  // HR: heatmap only, cells under 10 suppressed, no register, refused direct reads
  const hr = await fresh(page, 'chco');
  await go(hr, '/knowledge/klra');
  const heat = hr.locator('[data-testid="m24-klra-heatmap"]');
  await expect(heat).toBeVisible();
  await expect(hr.locator('[data-testid="m24-klra-register"]')).toHaveCount(0);
  const hm = await rpc(hr, 'kafaa_klra_heatmap', { p_period: null });
  const cells: (number | null)[] = [];
  const take = (o: any) => { for (const k of ['n', 'high', 'medium', 'low', 'mitigated']) if (o?.[k] && typeof o[k] === 'object') cells.push(o[k].n); };
  for (const d of hm.departments ?? []) take(d);
  take(hm.total);
  for (const t of hm.trend ?? []) take(t);
  expect(cells.length).toBeGreaterThan(0);
  expect(cells.every((c) => c === null || c === 0 || c >= 10), `heatmap cells ${cells.join(',')}`).toBe(true);
  expect((await rpc(hr, 'kafaa_klra_register', { p_period: null })).rows ?? []).toEqual([]);
  expect(await rest(hr, 'kafaa_klra_positions?select=id')).toEqual([]);
  await hr.close();
  // department head (sro, crew B): own scope only
  const dh = await fresh(page, 'sro');
  const regB = await rpc(dh, 'kafaa_klra_register', { p_period: null });
  expect(regB.mode).toBe('scope');
  expect(regB.rows.length).toBeGreaterThan(0);
  expect(regB.rows.every((r: any) => r.position.crew === 'B' || r.position.crew == null)).toBe(true);
  await dh.close();
});

test('Y4 F21 knowledge: search with citations, withdrawn never found, security text blocked, publish needs two reviews', async ({ page }) => {
  const w = watchErrors(page);
  await as(page, 'qc-inspector');
  await go(page, '/knowledge');
  await page.locator('[data-testid="m24-kb-search"]').fill('peer check redundant train');
  const res = page.locator('[data-testid="m24-kb-results"]');
  await expect(res.locator('[data-testid="m24-kb-hit-asset"]').first()).toContainText(/redundant trains/);
  expect(await res.locator('[data-testid="m24-kb-hit-oe"]').count()).toBeGreaterThan(0);
  expect(await res.locator('[data-testid="m24-kb-citation"]').count()).toBeGreaterThanOrEqual(2);
  await expect(res).toContainText(/Used by 14 colleagues/);
  // the withdrawn asset (kas-010, drill controller) is not searchable and not readable
  await page.locator('[data-testid="m24-kb-search"]').fill('drill controller looks for');
  await page.waitForTimeout(600);
  expect(await page.locator('[data-testid="m24-kb-results"]').innerText()).not.toMatch(/What the drill controller looks for/);
  expect(await rest(page, 'kafaa_knowledge_assets?select=id&id=eq.kas-010')).toEqual([]);
  await clean(page, w);
  // an interviewer: restricted text is blocked live (upload disabled) and refused by the server
  const iv = await fresh(page, 'head-sq');
  await go(iv, '/knowledge/capture/cs-011');
  const ta = iv.locator('[data-testid="m24-session-transcript"]');
  await expect(ta).toBeVisible();
  await ta.fill('We discussed the CCTV coverage of the protected area perimeter and the guard patrol timing in detail for the new interview.');
  await expect(iv.locator('main')).toContainText(/Security content found/);
  await expect(iv.locator('[data-testid="m24-session-upload"]')).toBeDisabled();
  const sub = await rpc(iv, 'kafaa_submit_asset', { p: { title_en: 'E2E-QA restricted', title_ar: 'اختبار', summary_en: 'Perimeter CCTV coverage and guard patrol timing for the protected area', summary_ar: 'ملخص اختبار لمحتوى مقيد يجب أن يرفضه الخادم دائماً', body: 'The CCTV cameras on the protected area perimeter and the guard patrol routes were discussed at length in this interview.', key_points: [{ en: 'Patrol timing and camera blind spots at the perimeter', ar: 'توقيت الدوريات والنقاط العمياء للكاميرات عند المحيط' }], skill_ids: [], standard_ids: [], system_family: 'human_performance', submit: true } });
  expect(sub.ok).toBe(false);
  expect(sub.message).toMatch(/security|restricted/i);
  await iv.close();
  // the KM owner cannot publish an asset with only one (technical) review
  const km = await fresh(page, 'training-mgr');
  await go(km, '/knowledge/review');
  await expect(km.locator('[data-testid="m24-review-queue"]')).toBeVisible();
  const pub = await rpc(km, 'kafaa_publish_asset', { p_id: 'kas-007' });
  expect(pub.ok).toBe(false);
  await km.close();
});

test('Y5 F22 handover board: suppressed, SAMPLE/SIMULATED with definitions, no person rows, what-if, HR-only release, employee forbidden', async ({ page }) => {
  const w = watchErrors(page);
  await as(page, 'chco');
  const bodies: unknown[] = [];
  page.on('response', async (r) => { if (/rpc\/kafaa_handover_aggregate/.test(r.url())) { try { bodies.push(await r.json()); } catch { /* ignore */ } } });
  await go(page, '/workforce/handover');
  const tiles = page.locator('[data-testid="m07-ho-tiles"]');
  await expect(tiles).toBeVisible();
  expect(await tiles.innerText()).toMatch(/SAMPLE|SIMULATED/i);
  expect(await tiles.locator('a[href*="/workforce/definitions"]').count()).toBeGreaterThan(0);
  await expect(page.locator('[data-testid="m07-ho-labels"]')).toContainText(/SAMPLE/i);
  const table = page.locator('[data-testid="m07-ho-table"]');
  expect(await table.locator('[data-testid="m07-ho-suppressed"]').count()).toBeGreaterThan(5);
  const tableNums = (await table.locator('td').allInnerTexts()).map((x) => x.trim()).filter((x) => /^\d+$/.test(x)).map(Number).filter((x) => x > 0 && x < 10);
  expect(tableNums, 'no count under 10 in the table').toEqual([]);
  await expect(page.locator('[data-testid="m07-ho-burndown"]')).toBeVisible();
  expect(bodies.length).toBeGreaterThan(0);
  for (const b of bodies) expect(personIds(b)).toEqual([]);
  // what-if is SIMULATED and resets
  await page.locator('[data-testid="m07-ho-ossa"]').selectOption('2029');
  await expect(page.locator('[data-testid="m07-ho-whatif"]')).toBeVisible();
  await page.locator('[data-testid="m07-ho-reset"]').click();
  await expect(page.locator('[data-testid="m07-ho-whatif"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="m07-ho-release"]')).toBeVisible();
  // risk list with reasons and links to KLRA/capture/succession (all routes exist now)
  const risk = page.locator('[data-testid="m07-ho-risk"]').first();
  await expect(risk).toBeVisible();
  expect(await page.locator('[data-testid="m07-ho-risks"] a[href*="/knowledge/klra"], [data-testid="m07-ho-risks"] a[href*="/talent/succession"], [data-testid="m07-ho-risks"] a[href*="/knowledge/capture"]').count()).toBeGreaterThan(0);
  await clean(page, w);
  // a line manager reads it without the release control; an employee is refused
  const mgr = await fresh(page, 'sro');
  await go(mgr, '/workforce/handover');
  await expect(mgr.locator('[data-testid="m07-ho-tiles"]')).toBeVisible();
  await expect(mgr.locator('[data-testid="m07-ho-release"]')).toHaveCount(0);
  await mgr.close();
  const emp = await fresh(page, 'nse');
  await go(emp, '/workforce/handover');
  await expect(emp.locator('[data-testid="forbidden"]')).toBeVisible();
  const r = await rpc(emp, 'kafaa_handover_aggregate', { p_period: '2026-Q3', p_ossa_end: null, p_slip: null });
  expect(r?.ok === true && r.data).toBeFalsy();
  await emp.close();
});

test('Y6 F23 reserve: HR approval before the team shows, contact data refused, consent withdrawal hides at once', async ({ page }) => {
  const w = watchErrors(page);
  // a manager posts a request: it waits for HR
  await as(page, 'outage-manager');
  const start = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const end = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
  const base = { engagement: 'mentor', title_en: `${E2E_TAG} outage mentoring`, title_ar: 'اختبار إرشاد الانقطاع', summary_en: 'Short mentoring on outage walk-downs for a new planner.', summary_ar: 'إرشاد قصير حول جولات الانقطاع لمخطط جديد.', skills_needed: ['sk-mp-01-mech'], hours_total: 8, seats: 1, location_type: 'office', start_on: start, end_on: end };
  const phone = await rpc(page, 'kafaa_request_reserve', { p: { ...base, summary_en: 'Please call me on +971 50 123 4567 for details.' } });
  expect(phone.code).toBe('contact_data');
  const req = await rpc(page, 'kafaa_request_reserve', { p: base });
  expect(req.ok).toBe(true);
  expect(req.data.status).toBe('pending_hr');
  await go(page, '/opportunities/reserve/request');
  await expect(page.locator('[data-testid="m20-res-my-requests"]')).toContainText(E2E_TAG);
  await clean(page, w);
  // the pre-departure member (sme-reviewer) cannot see it yet
  const mem = await fresh(page, 'sme-reviewer');
  const b1 = await rpc(mem, 'kafaa_reserve_board');
  expect((b1.requests ?? []).some((r: any) => r.id === req.data.id)).toBe(false);
  expect((await rpc(mem, 'kafaa_reserve_interest', { p_request_id: req.data.id, p_note: '' })).code).toBe('not_found');
  // HR approves (not the poster): now the member sees it, with the host team and never the poster
  const hr = await fresh(page, 'chco');
  await go(hr, '/opportunities/reserve/hr');
  await expect(hr.locator('[data-testid="m20-res-pending"]')).toContainText(E2E_TAG);
  const ok = await rpc(hr, 'kafaa_decide_reserve_request', { p_request_id: req.data.id, p_decision: 'approve', p_note: `${E2E_TAG} approved` });
  expect(ok.ok).toBe(true);
  expect(await hr.locator('main').innerText()).not.toMatch(EMAIL);
  await hr.close();
  const b2 = await rpc(mem, 'kafaa_reserve_board');
  const seen = (b2.requests ?? []).find((r: any) => r.id === req.data.id);
  expect(seen).toBeTruthy();
  expect(seen.host_team_en).toBeTruthy();
  expect(JSON.stringify(seen)).not.toMatch(/p-outage-manager|poster/);
  await go(mem, '/opportunities/reserve/me');
  await expect(mem.locator('[data-testid="m20-res-board"]')).toContainText(E2E_TAG);
  await mem.close();
  // nse joins with consent and opts into the finder; staff see them; withdrawal hides them at the next read
  const nse = await fresh(page, 'nse');
  const join = await rpc(nse, 'kafaa_join_reserve', { p: { consent: true, availability: 'limited', hours_month: 4, engagement_prefs: ['mentor'], finder_optin: true, headline_en: `${E2E_TAG} electrical systems`, headline_ar: 'اختبار' } });
  expect(join.ok).toBe(true);
  const staff = await fresh(page, 'qc-inspector');
  const vis1 = await rest(staff, 'kafaa_alumni?select=id,person_id&person_id=eq.p-nse');
  expect(vis1.length).toBe(1);
  const wd = await rpc(nse, 'kafaa_join_reserve', { p: { consent: false } });
  expect(wd.ok).toBe(true);
  expect(wd.data.erase_after).toBeTruthy();
  const days = (Date.parse(wd.data.erase_after) - Date.now()) / 86400000;
  expect(days).toBeGreaterThan(170);
  expect(days).toBeLessThan(190);
  expect(await rest(staff, 'kafaa_alumni?select=id&person_id=eq.p-nse')).toEqual([]);
  await go(staff, '/opportunities/reserve');
  expect(await staff.locator('[data-testid="m20-res-experts"]').innerText()).not.toContain(E2E_TAG);
  const hr2 = await fresh(page, 'chco');
  const desk = await rpc(hr2, 'kafaa_reserve_desk');
  expect(JSON.stringify(desk)).not.toMatch(EMAIL);
  await hr2.close();
  await staff.close();
  await nse.close();
  // tidy up: the poster closes every open E2E-QA request (audited), so the members' boards hold demo requests only
  const mine = await rest(page, `kafaa_reserve_requests?select=id,status&title_en=like.${encodeURIComponent(E2E_TAG)}*`);
  for (const r of mine.filter((x: any) => ['pending_hr', 'open', 'filled'].includes(x.status))) {
    expect((await rpc(page, 'kafaa_decide_reserve_request', { p_request_id: r.id, p_decision: 'close', p_note: `${E2E_TAG} done` })).ok).toBe(true);
  }
});

test('Y7 F24 transparency: coach opt-out, engine cards, fairness, audited weight change, HR and auditor views', async ({ page }) => {
  const w = watchErrors(page);
  await as(page, 'nse');
  await go(page, '/my/settings');
  const card = page.locator('[data-testid="m16-reco-card"]');
  await expect(card).toBeVisible();
  const sw = page.locator('[data-testid="m16-optout-coach"]');
  if ((await sw.getAttribute('aria-checked')) !== 'false') {
    await sw.click();
    await confirmDialog(page, `${E2E_TAG} opt-out check`);
    await expect(sw).toHaveAttribute('aria-checked', 'false');
  }
  await go(page, '/my/coach');
  await expect(page.locator('[data-testid="m16-unranked-catalogue"]')).toBeVisible();
  await expect(page.locator('[data-testid="m19-card"]')).toHaveCount(0);
  await expect(page.locator('main [data-testid="why-this"]')).toHaveCount(0);
  // switch the coach back on: the ranked feed returns
  const on = await rpc(page, 'kafaa_set_reco_optout', { p_surface: 'coach', p_opted_out: false, p_reason: null });
  expect(on.ok).toBe(true);
  expect(on.ledger_seq).not.toBeNull();
  await go(page, '/my/coach');
  await expect(page.locator('[data-testid="m16-unranked-catalogue"]')).toHaveCount(0);
  // "what Kafa'a infers about me": JSON without protected attributes
  await go(page, '/my/settings');
  const dl = page.waitForEvent('download');
  await page.locator('[data-testid="m16-export-inferences"]').click();
  const file = await dl;
  const json = readFileSync((await file.path())!, 'utf8');
  expect(json.length).toBeGreaterThan(100);
  expect(json).not.toMatch(/"(gender|nationality_flag|age|birth_date)"\s*:/);
  await clean(page, w);
  // admin / AI governance: 8 cards, each with the 3 excluded inputs; fairness flags and suppression; audited weight change
  const ai = await fresh(page, 'ai-governance');
  await go(ai, '/admin/ai-transparency');
  const cards = ai.locator('[data-testid="m16-engine-card"]');
  await expect(cards).toHaveCount(8);
  for (let i = 0; i < 8; i++) await expect(cards.nth(i).locator('[data-testid="m16-card-excluded"] li')).toHaveCount(3);
  await ai.getByRole('tab', { name: /Fairness monitor/ }).click();
  const comps = ai.locator('[data-testid="m16-fair-comparisons"]');
  await expect(comps).toBeVisible();
  expect(await comps.locator('[data-testid="m16-fair-comparison"][data-flagged="true"]').count()).toBeGreaterThan(0);
  expect(await comps.locator('[data-testid="m16-fair-suppressed"]').count()).toBeGreaterThan(0);
  await expect(ai.locator('[data-testid="m16-fair-run"]')).toBeVisible();
  const snaps = await rest(ai, 'kafaa_fairness_snapshots?select=n,suppressed,ratio,flagged');
  expect(snaps.every((s: any) => (s.suppressed ? s.n == null : s.n >= 10))).toBe(true);
  expect(snaps.every((s: any) => s.suppressed || s.flagged === (s.ratio != null && s.ratio < 0.8))).toBe(true);
  const before = (await rest(ai, 'kafaa_engine_settings?select=weights&id=eq.match'))[0].weights;
  await ai.getByRole('tab', { name: /Change log/ }).click();
  await ai.locator('[data-testid="m16-change-weights"]').click();
  await ai.locator('[data-testid="m16-weight-development"]').fill('0.25');
  await ai.locator('[data-testid="m16-weights-rationale"]').fill(`${E2E_TAG} pilot feedback weight check`);
  await ai.locator('[data-testid="m16-weights-save"]').click();
  await confirmDialog(ai);
  await expect(ai.locator('[data-testid="m16-change-log"]')).toContainText(`${E2E_TAG} pilot feedback weight check`);
  const changes = await rest(ai, `kafaa_engine_changes?select=audit_seq,ledger_seq,rationale&rationale=eq.${encodeURIComponent(`${E2E_TAG} pilot feedback weight check`)}`);
  expect(changes.length).toBeGreaterThan(0);
  expect(changes.every((c: any) => c.audit_seq != null && c.ledger_seq != null)).toBe(true);
  const revert = await rpc(ai, 'kafaa_change_engine_weights', { p_surface: 'match', p_engine: 'deterministic', p_weights: before, p_rationale: `${E2E_TAG} restore the previous weights` });
  expect(revert.ok).toBe(true);
  await ai.close();
  // HR: cards and fairness, never the change log; the auditor reads all without the run button
  const hr = await fresh(page, 'chco');
  await go(hr, '/admin/ai-transparency');
  await expect(hr.locator('[data-testid="m16-engine-cards"]')).toBeVisible();
  await expect(hr.getByRole('tab', { name: /Change log/ })).toHaveCount(0);
  await hr.close();
  const au = await fresh(page, 'presenter');
  await go(au, '/admin/ai-transparency');
  await au.getByRole('tab', { name: /Fairness monitor/ }).click();
  await expect(au.locator('[data-testid="m16-fair-comparisons"]')).toBeVisible();
  await expect(au.locator('[data-testid="m16-fair-run"]')).toHaveCount(0);
  await expect(au.getByRole('tab', { name: /Change log/ })).toBeVisible();
  await au.close();
});

test('Y8 wave-3 integration links: slate -> KLRA, expert finder -> reserve, standard -> read before requal', async ({ page }) => {
  const w = watchErrors(page);
  await as(page, 'chco');
  await go(page, '/talent/succession/ss-senior-reactor-operator-2026h2');
  const kl = page.locator('[data-testid="m24-klra-role-links"]');
  await expect(kl).toBeVisible();
  await expect(kl.locator('a[href*="/knowledge/klra"]').first()).toBeVisible();
  await clean(page, w);
  const tm = await fresh(page, 'training-mgr');
  await go(tm, '/training/quals/qs-mech');
  const rb = tm.locator('[data-testid="m24-read-before-requal"]');
  await expect(rb).toBeVisible();
  await expect(rb.locator('a[href*="/knowledge/assets/kas-001"]')).toBeVisible();
  await go(tm, '/talent/succession');
  await tm.close();
  const st = await fresh(page, 'qc-inspector');
  await go(st, '/communities/experts');
  const note = st.locator('[data-testid="m20-reserve-experts-note"]');
  await expect(note).toBeVisible();
  await expect(note.locator('a[href*="/opportunities/reserve"]')).toBeVisible();
  expect(await note.innerText()).not.toMatch(EMAIL);
  await st.close();
});
