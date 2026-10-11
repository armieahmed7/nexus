/**
 * FS wave C journeys (FS17-FS26, "close the gaps": pathways, external catalogue, course pack, academies, adaptive assessment,
 * performance tasks, descriptors, scale map and Authority, core skills and SJT practice), supabase mode against the live NEXUS
 * project with real NEXUS demo sign-in. Every acceptance criterion of the ten wave-C cards is exercised in the browser, or asserted
 * on the payload the signed-in page receives from the same RPC / RLS read (PGlite and unit tests prove SQL = TS).
 * Live writes: none that change state. Refusals are audited (publish of a failing external item, Authority by the proposer, a
 * second capstone sign-off). Flows that would leave permanent evidence or ledger rows (an adaptive attempt, a capstone sign-off,
 * a self-declared completion, an Authority approval, SJT practice) run on the local backend, where the same rules run in TS.
 *  C1 FS17/FS18 pathways + external catalogue  C2 FS19/FS20 course pack + academies  C3 FS21/FS22 adaptive + performance tasks
 *  C4 FS23/FS24 descriptors + scale + Authority  C5 FS25/FS26 core skills + SJT     C6 cross-feature wiring, chips, Arabic
 */
import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { BASE, pinBackend, settle, signIn, textIssues, watchErrors } from './helpers';

const CONFIG = readFileSync('src/config.ts', 'utf8');
const SB_URL = CONFIG.match(/'(https:\/\/[a-z0-9]+\.supabase\.co)'/)![1];
const ANON = CONFIG.match(/'(eyJ[A-Za-z0-9._-]+)'/)![1];
const FEATURE: Record<string, string[]> = {
  FS17: ['ENTITLE', 'CORP', 'LIGHTCAST'], FS18: ['ENTITLE', 'NUC-NET', 'NEA'], FS19: ['SMR-WF', 'UAE-PEERS', 'ENTITLE'], FS20: ['NUC-NET', 'UAE-PEERS'],
  FS21: ['SKILLS-TECH', 'OECD-PIAAC'], FS22: ['SKILLS-TECH', 'IAEA-AI'], FS23: ['SFIA9', 'SSG-SF', 'IAEA-1917'], FS24: ['SFIA9', 'DIGCOMP', 'UAE-NQF'],
  FS25: ['SSG-SF', 'WEF-FOJ', 'GREENCOMP', 'MCK-DELTA'], FS26: ['IAEA-1917', 'MCK-DELTA'],
};
const SECURITY = /\b(exploit|malware payload|zero[- ]day|privilege escalation|bypass (the )?firewall|attack vector|password list|vulnerability scan)\b/i;
const GAMIFIED = /leaderboard|\bXP\b|\d+\s*(points|pts)\b|\d+[- ]day streak|\bbadges? earned\b/i;

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
/** Switch this page to the local backend as a persona (pinBackend only acts on a page's first load). */
async function toLocal(page: Page, persona: string) {
  await page.goto(BASE + '/');
  await page.evaluate((p) => {
    localStorage.setItem('kafaa.backend', 'local');
    localStorage.setItem('kafaa.session.v1', JSON.stringify({ persona: p, at: Date.now() }));
  }, persona);
}
const data = <T,>(x: { body?: { data?: T } & T }) => (x.body?.data ?? x.body) as T;

test('C1 FS17/FS18: an L1 pathway for every future skill with envelope and weekly hours, Coach cards with reasons, peer times under 10 suppressed, FS21/FS22 items in assess steps; external items cite provider and as-of, a failing item cannot be published, self-declared completions are labelled', async ({ page }) => {
  const w = watchErrors(page);
  await pinBackend(page, 'supabase');
  await go(page, '/learn/pathways');
  await expect(page.locator('[data-testid="signin-required"]')).toBeVisible(); // staff content
  expect(await rest(page, 'kafaa_pathways?select=id&limit=1')).toEqual([]); // anon reads nothing
  w.take();
  await as(page, 'nse');
  await go(page, '/learn/pathways');
  await chips(page, 'main', 'FS17');
  await openChip(page, 'ENTITLE');
  const cat = data<{ pathways: { id: string; skill_id: string; level: number; envelope_months: number; weekly_hours: number }[] }>(await rpc(page, 'kafaa_pathway_catalogue'));
  const skills = await rest(page, 'kafaa_skills?select=id,fs_area,lifecycle,area&fs_area=not.is.null');
  const future = skills.filter((s: { lifecycle: string; area: string }) => s.lifecycle !== 'obsolete' && s.area !== 'security');
  expect(future.length).toBe(48);
  for (const s of future) expect(cat.pathways.some((p) => p.skill_id === s.id && p.level === 1), s.id).toBe(true);
  expect(cat.pathways.every((p) => p.envelope_months >= 3 && p.envelope_months <= 6 && Number(p.weekly_hours) > 0)).toBe(true);
  const cards = page.locator('[data-testid="m19-pw-card"]');
  expect(await cards.count()).toBe(cat.pathways.length);
  expect(await page.locator('[data-testid="m19-pw-card"] [data-testid="m19-envelope"]').count()).toBe(cat.pathways.length);
  // a pathway: learn -> practice -> assess, peer times suppressed under 10, FS21/FS22 items discovered, link to the FS23 level
  await go(page, '/learn/pathways/pw-ai-verify-l2');
  await expect(page.locator('[data-testid="m19-pw-step"]')).toHaveCount(3);
  expect(await page.locator('[data-testid="m19-pw-step"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-kind')))).toEqual(['learn', 'practice', 'assess']);
  await expect(page.locator('[data-testid="m19-pw-det-tiles"]')).toContainText(/months/);
  await expect(page.locator('[data-testid="m19-pw-det-tiles"]')).toContainText(/h|hours/);
  await expect(page.locator('[data-testid="m19-peer"]').first()).toHaveAttribute('data-suppressed', 'true');
  const det = data<{ peer: { suppressed: boolean; median_weeks: number | null }; resolved: { steps: { kind: string; items: { type: string; link: string }[] }[] } }>(await rpc(page, 'kafaa_pathway_detail', { p_id: 'pw-ai-verify-l2' }));
  expect(det.peer.suppressed && det.peer.median_weeks === null).toBe(true);
  const assess = det.resolved.steps.find((s) => s.kind === 'assess')!;
  expect(assess.items.map((i) => i.type)).toEqual(expect.arrayContaining(['adaptive', 'task']));
  const assessStep = page.locator('[data-testid="m19-pw-step"][data-kind="assess"]');
  await expect(assessStep.locator('[data-testid="m19-step-item"][data-type="adaptive"] a')).toHaveAttribute('href', /\/my\/assessments\/adaptive\/ab-ai-literacy/);
  await expect(page.locator('[data-testid="m19-pw-descriptor"]')).toHaveAttribute('href', /\/competencies\/descriptors\/sk-fs-ai-verify/);
  await clean(page, w);
  // the Coach: pathways ranked against 2030 and today's role gaps, each card with its reasons
  await go(page, '/my/coach');
  await page.getByRole('tab', { name: /future skills/i }).click();
  await expect(page.locator('[data-testid="m19-fs-coach"]')).toBeVisible();
  await chips(page, 'm19-fs-coach-bench', 'FS17');
  const coach = page.locator('[data-testid="m19-pw-coach-card"]');
  expect(await coach.count()).toBeGreaterThan(0);
  await coach.first().locator('button', { hasText: /why/i }).first().click();
  await expect(page.locator('[role="note"]').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await clean(page, w);
  // FS18 catalogue: provider URL, as-of and the external chip on every item
  await go(page, '/learn/external');
  await chips(page, 'main', 'FS18');
  const xr = page.locator('[data-testid="m19-xr-card"]');
  const nx = await xr.count();
  expect(nx).toBeGreaterThan(0);
  expect(await page.locator('[data-testid="m19-xr-card"] [data-testid="m19-xr-source"] a[href^="https://"]').count()).toBeGreaterThanOrEqual(nx);
  expect(await page.locator('[data-testid="m19-xr-card"] [data-testid="m19-external-chip"]').count()).toBe(nx);
  const pub = await rest(page, 'kafaa_external_resources?select=id,provider_url,as_of,status');
  expect(pub.length).toBe(nx);
  expect(pub.every((x: { provider_url: string; as_of: string; status: string }) => x.status === 'published' && x.provider_url.startsWith('https://') && /^\d{4}-\d{2}-\d{2}$/.test(x.as_of))).toBe(true);
  await clean(page, w);
  // the training manager cannot publish an item that fails the published criteria (audited refusal, no change)
  await as(page, 'training-mgr');
  await go(page, '/training/external');
  await chips(page, 'main', 'FS18');
  const ref = await rpc(page, 'kafaa_publish_external_resource', { p_id: 'xr-iaea-nuclear-security-elearning' });
  expect(ref.body?.ok).toBe(false);
  expect(ref.body?.code).toBe('criteria_failed');
  await go(page, '/training/pathways');
  await chips(page, 'main', 'FS17');
  await page.getByRole('tab', { name: /Gap backlog/ }).click();
  await expect(page.locator('[data-testid="m19-adm-refresh"]')).toBeVisible();
  await expect(page.locator('main')).toContainText(/172/); // open gaps after the wave-C refresh
  // the auditor reads the training pages, writes nothing; staff without a training role are refused
  await as(page, 'presenter');
  await go(page, '/training/pathways');
  await page.getByRole('tab', { name: /Gap backlog/ }).click();
  await expect(page.locator('[data-testid="m19-adm-refresh"]')).toHaveCount(0);
  await as(page, 'sro');
  await go(page, '/training/external');
  await expect(page.locator('[data-testid="forbidden"]')).toBeVisible();
  w.take();
  // self-declared completion (local backend: a live completion cannot be removed): labelled, never verified evidence
  await toLocal(page, 'k-ro');
  await go(page, '/learn/external');
  await page.locator('[data-testid="m19-xr-record"]').first().click();
  await expect(page.locator('[data-testid="m19-xr-self-note"]')).toBeVisible(); // "self-declared, never verified evidence" before confirming
  await page.locator('[data-testid="m19-xr-record-confirm"]').click();
  await expect(page.locator('[data-testid="m19-self-declared"]').first()).toBeVisible();
  await clean(page, w);
});

test('C2 FS19/FS20: 18 pack courses plus 2 cross-overs, each linked to a skill at a level, every nobody-held skill gains a course, cyber hygiene passes the copy and link check; four academies with modules, project and mentor, small cohorts suppressed, a signed-off capstone writes evidence', async ({ page }) => {
  const w = watchErrors(page);
  await pinBackend(page, 'supabase');
  await go(page, '/learn/future-skills');
  await chips(page, 'main', 'FS19');
  const pack = await rest(page, 'kafaa_course_pack_items?select=course_id,kind,copy_check,copy_problems');
  const links = await rest(page, 'kafaa_course_skill_links?select=course_id,skill_id,level,active');
  expect(pack.length).toBe(20);
  expect(pack.filter((p: { kind: string }) => p.kind === 'crossover').length).toBe(2);
  for (const p of pack) expect(links.some((l: { course_id: string; level: number; active: boolean }) => l.course_id === p.course_id && l.active && l.level >= 1 && l.level <= 3), p.course_id).toBe(true);
  expect(await page.locator('[data-testid="m04-fsc-course"]').count()).toBeGreaterThanOrEqual(18);
  expect(await page.locator('[data-testid="m04-fsc-crossover"] > *').count()).toBe(2);
  await expect(page.locator('[data-testid="m04-fsc-copycheck"]')).toBeVisible();
  const cyber = pack.find((p: { course_id: string }) => p.course_id === 'c-fs-cyber');
  expect(cyber.copy_check).toBe('passed');
  expect(cyber.copy_problems ?? []).toEqual([]);
  expect(await page.locator('main').innerText()).not.toMatch(SECURITY);
  await clean(page, w);
  // "picked for me" with reasons
  await as(page, 'outage-planner');
  await go(page, '/learn/future-skills');
  await expect(page.locator('[data-testid="m04-fsc-forme"]')).toBeVisible();
  expect(await page.locator('[data-testid="m04-fsc-forme"] button', { hasText: /why/i }).count()).toBeGreaterThan(0);
  // every skill nobody held before the pack has a course (from the published links; the held count reads the live passport)
  const zero = ['sk-fs-adv-factoryqa', 'sk-fs-adv-multimodule', 'sk-fs-dp-procurement', 'sk-fs-ai-xr', 'sk-fs-gr-h2heat', 'sk-fs-dp-robotics'];
  for (const s of zero) expect(links.some((l: { skill_id: string }) => l.skill_id === s), s).toBe(true);
  await clean(page, w);
  // academies: module + project + mentor triad, small cohorts suppressed
  await go(page, '/learn/academies');
  await chips(page, 'main', 'FS20');
  await expect(page.locator('[data-testid="m04-acad-card"]')).toHaveCount(4);
  for (const id of ['ac-ai', 'ac-twin', 'ac-smr', 'ac-energy']) {
    await go(page, `/learn/academies/${id}`);
    await expect(page.locator('[data-testid="m04-acad-modules"]')).toBeVisible();
    await expect(page.locator('[data-testid="m04-acad-project"]')).toBeVisible();
    await expect(page.locator('[data-testid="m04-triad-mentor"]')).toBeVisible();
  }
  await expect(page.locator('[data-testid="m04-suppressed"]').first()).toBeVisible(); // the Energy Transition cohort is small
  const stats = await rpc(page, 'kafaa_academy_stats');
  expect(JSON.stringify(stats.body)).toMatch(/suppressed"?:true/);
  await go(page, '/my/academies');
  await chips(page, 'main', 'FS20');
  await clean(page, w);
  // the programme owner decides nominations; instructors read the console
  await as(page, 'training-mgr');
  await go(page, '/training/academies');
  expect(await page.locator('[data-testid="m04-tra-decide"]').count()).toBeGreaterThan(0);
  await go(page, '/training/future-skills');
  await expect(page.locator('[data-testid="m04-fst-coverage"]')).toBeVisible();
  await as(page, 'sq-lead');
  await go(page, '/training/academies');
  await expect(page.locator('[data-testid="m04-tra-decide"]')).toHaveCount(0);
  // a member never signs off their own capstone (audited refusal)
  await as(page, 'buyer');
  const self = await rpc(page, 'kafaa_signoff_capstone', { p: { capstone_id: 'cc-ai-2026b-buyer', result: 'pass', feedback: 'self sign-off attempt' } });
  expect(self.body?.ok).toBe(false);
  w.take();
  // the named reviewer signs off (local backend: a live sign-off writes permanent evidence)
  await toLocal(page, 'ai-governance');
  await go(page, '/my/academies');
  await page.locator('[data-testid="m04-review-open"]').first().click();
  await expect(page.locator('[data-testid="m04-review-records"]')).toBeVisible();
  await page.locator('[data-testid="m04-review-confirm"]').click();
  await expect(page.locator('body')).toContainText(/signed off; skills updated/);
  await clean(page, w);
});

test('C3 FS21/FS22: the same answers give the same result, safety banks never show a percentile, no secure or security content; every rubric line before the attempt, gating attempts carry an integrity report, synthetic data only', async ({ page }) => {
  const w = watchErrors(page);
  await as(page, 'nse');
  await go(page, '/my/assessments/adaptive');
  await chips(page, 'main', 'FS21');
  await expect(page.locator('[data-testid="m05-ad-banks"]')).toBeVisible();
  const banks = await rest(page, 'kafaa_adaptive_banks?select=id,safety_related,mode');
  expect(banks.length).toBe(6);
  expect(banks.filter((b: { safety_related: boolean }) => b.safety_related).every((b: { mode: string }) => b.mode === 'criterion')).toBe(true);
  expect(await rest(page, 'kafaa_adaptive_items?select=id&limit=1')).toEqual([]); // the bank (with keys) is never readable by a taker
  expect(await rest(page, 'kafaa_perf_task_keys?select=id&limit=1')).toEqual([]);
  const attempts = await rest(page, 'kafaa_adaptive_attempts?select=bank_id,mode,percentile,status');
  expect(attempts.length).toBeGreaterThan(0);
  for (const a of attempts) if (a.mode === 'criterion') expect(a.percentile).toBeNull();
  await clean(page, w);
  // performance task: the rubric first, start only once it is read; the task data is SIMULATED
  await go(page, '/my/assessments/tasks');
  await chips(page, 'main', 'FS22');
  await go(page, '/my/assessments/tasks/pt-feedwater-drift');
  const lines = page.locator('[data-testid^="m05-rubric-line-"]');
  expect(await lines.count()).toBeGreaterThan(2);
  await expect(page.locator('[data-testid="m05-pt-start"]')).toBeDisabled();
  await expect(page.locator('[data-testid="m05-pt-start-box"]')).toBeVisible();
  await expect(page.locator('[data-testid="m05-pt-reading"]')).toHaveCount(0); // the scenario opens only after the rubric is confirmed
  const tasks = await rest(page, 'kafaa_performance_tasks?select=id,simulated,data,rubric');
  expect(tasks.every((t: { simulated: boolean; data: unknown }) => t.simulated && !/https?:\/\//.test(JSON.stringify(t.data)))).toBe(true);
  expect(await page.locator('main').innerText()).toMatch(/SIMULATED|Simulated/);
  const noRubric = await rpc(page, 'kafaa_start_performance_task', { p: { task_id: 'pt-feedwater-drift', rubric_seen: false } });
  expect(noRubric.body?.ok).toBe(false);
  await clean(page, w);
  // integrity reports: the auditor reads them all, cannot decide; every gating attempt has one
  await as(page, 'presenter');
  await go(page, '/training/integrity');
  await chips(page, 'main', 'FS22');
  await expect(page.locator('[data-testid="m05-ir-table"]')).toBeVisible();
  await expect(page.locator('[data-testid="m05-ir-accept"], [data-testid="m05-ir-void"]')).toHaveCount(0);
  const reports = await rest(page, 'kafaa_integrity_reports?select=id');
  expect(reports.length).toBe(105);
  await clean(page, w);
  await as(page, 'training-mgr'); // signoff A: reads every attempt
  for (const t of ['kafaa_task_attempts', 'kafaa_adaptive_attempts']) {
    const gating = await rest(page, `${t}?select=id,gating,integrity_id,status&gating=eq.true`);
    expect(gating.length, t).toBeGreaterThan(0);
    expect(gating.filter((a: { status: string }) => a.status !== 'in_progress').every((a: { integrity_id: string | null }) => !!a.integrity_id), t).toBe(true);
  }
  await go(page, '/training/adaptive');
  await chips(page, 'main', 'FS21');
  await page.getByRole('tab', { name: 'How it works' }).click();
  await expect(page.locator('[data-testid="m05-tr-engine"]')).toBeVisible();
  w.take();
  // a full adaptive attempt twice with the same answers (local backend; a live attempt writes evidence): same items, same result
  const run = async () => {
    await toLocal(page, 'buyer');
    await page.evaluate(() => localStorage.removeItem('kafaa.local.v1')); // a pristine local tenant for each run
    await go(page, '/my/assessments/adaptive/ab-cyber-hygiene');
    await page.locator('[data-testid="m05-take-start"]').click();
    const seq: string[] = [];
    for (let k = 0; k < 22; k++) {
      const q = page.locator('[data-testid="m05-take-question"]');
      if (!(await q.isVisible().catch(() => false))) { await page.waitForTimeout(400); if (!(await q.isVisible().catch(() => false))) break; }
      const id = (await q.getAttribute('data-item'))!;
      seq.push(id);
      expect(await q.innerText()).not.toMatch(SECURITY);
      await q.locator('[data-testid="m05-take-opt-0"]').click();
      await q.locator('[data-testid="m05-take-next"]').click();
      await expect.poll(async () => ((await q.isVisible().catch(() => false)) ? await q.getAttribute('data-item') : 'done')).not.toBe(id);
    }
    const res = page.locator('[data-testid="m05-take-result"]');
    await expect(res).toBeVisible();
    expect(await res.getAttribute('data-criterion')).toBe('yes');
    expect(await res.getAttribute('data-percentile')).toBe('');
    await expect(page.locator('[data-testid="m05-take-no-pct"]')).toBeVisible();
    expect(seq.length).toBeLessThanOrEqual(20);
    return { seq, level: await res.getAttribute('data-level') };
  };
  const a = await run();
  const b = await run();
  expect(b.seq).toEqual(a.seq);
  expect(b.level).toBe(a.level);
  await expect(page.locator('[data-testid="m05-take-learn"]')).toBeVisible(); // wave C: courses and pathways for the bank's skills
  await clean(page, w);
});

test('C4 FS23/FS24: descriptors at every defined level with EN and AR indicators, never the template sentence, check-in raters see them; every scale row cites its source, Authority needs two different approvers and never changes the level', async ({ page }) => {
  const w = watchErrors(page);
  await pinBackend(page, 'supabase');
  await go(page, '/competencies/levels');
  await chips(page, 'main', 'FS23');
  await expect(page.locator('[data-testid^="m02-lv-level-"]')).toHaveCount(4);
  await expect(page.locator('[data-testid="m02-lv-attrs"]')).toBeVisible();
  const ranges = await rest(page, 'kafaa_skill_level_ranges?select=skill_id,min_level,max_level');
  const descs = await rest(page, 'kafaa_skill_descriptors?select=skill_id,level,indicators_en,indicators_ar,essence_en&status=eq.published');
  expect(ranges.length).toBe(120);
  for (const r of ranges) for (let lv = r.min_level; lv <= r.max_level; lv++) expect(descs.some((d: { skill_id: string; level: number }) => d.skill_id === r.skill_id && d.level === lv), `${r.skill_id} L${lv}`).toBe(true);
  for (const d of descs) {
    expect(d.indicators_en.length).toBeGreaterThanOrEqual(2);
    expect(d.indicators_ar.length).toBe(d.indicators_en.length);
    expect(d.indicators_ar.join(' ')).toMatch(/[؀-ۿ]/);
    expect(d.essence_en).not.toMatch(/applies .* on routine work with some supervision, using procedures and checking own work/);
  }
  await go(page, '/competencies/descriptors/sk-fs-ai-verify');
  await chips(page, 'main', 'FS23');
  expect(await page.locator('[data-testid^="m02-dp-level-"]').count()).toBeGreaterThanOrEqual(3);
  await go(page, '/competencies/descriptors/sk-fs-cy-phishing');
  await expect(page.locator('[data-testid^="m02-dp-undefined-"]').first()).toBeVisible(); // awareness-only: not defined above level 2, with the rationale
  await go(page, '/ar/competencies/descriptors/sk-fs-ai-verify');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  expect(await page.locator('[data-testid="m02-dp-ladder"]').innerText()).toMatch(/[؀-ۿ]{8}/);
  await clean(page, w);
  // FS24 scale map: every row cites an https source and an as-of date; the NQF column is indicative
  await go(page, '/competencies/scale');
  await chips(page, 'main', 'FS24');
  const maps = await rest(page, 'kafaa_scale_maps?select=id,source_url,as_of,framework');
  expect(maps.length).toBe(35);
  expect(maps.every((m: { source_url: string; as_of: string }) => m.source_url.startsWith('https://') && !!m.as_of)).toBe(true);
  await expect(page.locator('[data-testid="m02-sc-grid"]')).toBeVisible();
  expect(await page.locator('main').innerText()).toMatch(/not a recognition authority|indicative/i);
  await clean(page, w);
  // check-in raters see the indicators for the skill and level they rate (nothing is submitted)
  await as(page, 'nse');
  await go(page, '/my/skills/checkins');
  await page.getByRole('tab', { name: 'New check-in' }).click();
  const box = page.locator('[data-testid^="m17-ci-skill-"]').first();
  const skillId = (await box.getAttribute('data-testid'))!.replace('m17-ci-skill-', '');
  await box.check();
  await page.locator(`[data-testid="m17-level-self-${skillId}-2"]`).click();
  await expect(page.locator(`[data-testid="m02-ci-indicators-${skillId}"], [data-testid="m02-ci-undefined-${skillId}"]`).first()).toBeVisible();
  await go(page, '/my/levels');
  await chips(page, 'main', 'FS23');
  await clean(page, w);
  // Authority: maker-checker. The proposer (training manager) cannot approve; decided rows name a different approver; level stays 4
  await as(page, 'training-mgr');
  await go(page, '/admin/authority');
  await chips(page, 'main', 'FS24');
  await expect(page.locator('[data-testid="m02-au-mc-ar:w-rp-01:sk-rp-01:1"]')).toBeVisible();
  const mine = await rpc(page, 'kafaa_recognise_authority', { p: { action: 'approve', id: 'ar:w-rp-01:sk-rp-01:1', note: 'E2E maker-checker check' } });
  expect(mine.body?.ok).toBe(false);
  const reg = await rest(page, 'kafaa_authority_recognitions?select=id,person_id,skill_id,status,proposed_by,decided_by,level_at_proposal');
  for (const r of reg.filter((x: { status: string }) => x.status === 'recognised')) {
    expect(r.decided_by).not.toBe(r.proposed_by);
    expect(r.level_at_proposal).toBe(4);
  }
  await as(page, 'sro');
  const ps = await rest(page, 'kafaa_person_skills?select=level&person_id=eq.p-sro&skill_id=eq.sk-ld-02');
  expect(ps[0]?.level).toBe(4); // recognised as Authority, still level 4
  await go(page, '/my/levels');
  await expect(page.locator('[data-testid="m02-ml-authority"]')).toBeVisible();
  w.take();
  // the HR director approves the training manager's proposal (local backend: a live approval writes a ledger row)
  await toLocal(page, 'chco');
  await go(page, '/admin/authority');
  await page.locator('[data-testid="m02-au-approve-ar:w-rp-01:sk-rp-01:1"]').click();
  await page.locator('[data-testid="confirm-action"]').click();
  await expect(page.locator('[data-testid="m02-au-register"]')).toContainText(/recognised/i);
  await clean(page, w);
});

test('C5 FS25/FS26: 16 core skills in 3 clusters, each with 2+ benchmark mappings and its own development and assessment routes, no wellbeing competency; 48 SJT items with EN/AR rationales, results never in talent review, no gamification, development only', async ({ page }) => {
  const w = watchErrors(page);
  await pinBackend(page, 'supabase');
  await go(page, '/learn/core-skills');
  await chips(page, 'main', 'FS25');
  const core = await rest(page, 'kafaa_core_skills?select=id,cluster,benchmark_ids,development,assessment,name_en');
  expect(core.length).toBe(16);
  expect(new Set(core.map((c: { cluster: string }) => c.cluster)).size).toBe(3);
  for (const c of core) {
    expect(c.benchmark_ids.length, c.id).toBeGreaterThanOrEqual(2);
    expect(c.development.length, c.id).toBeGreaterThan(0);
    expect(c.assessment.length, c.id).toBeGreaterThan(0);
    expect(c.name_en).not.toMatch(/wellbeing|well-being|career health/i);
  }
  await expect(page.locator('[data-testid="m33-fw-candidates"]')).toContainText(/wellbeing|Wellbeing/);
  await go(page, '/learn/core-skills/cs-systems');
  await chips(page, 'main', 'FS25');
  await expect(page.locator('[data-testid="m33-cs-levels"] li')).toHaveCount(3);
  await expect(page.locator('[data-testid="m33-cs-learn-courses"]')).toBeVisible(); // wave C: the FS19 pack courses for its skills
  await expect(page.locator('[data-testid="m33-cs-learn-pathways"]')).toHaveCount(0); // anon: no pathways
  expect(await rest(page, 'kafaa_sjt_items?select=id&limit=1')).toEqual([]);
  expect(await rest(page, 'kafaa_sjt_attempts?select=id&limit=1')).toEqual([]);
  await clean(page, w);
  // my core skills: evidence per core skill against the role target; practice beside the level, never changing it
  await as(page, 'nse');
  await go(page, '/my/core-skills');
  await chips(page, 'main', 'FS25');
  expect(await page.locator('[data-testid="m33-my-skill"]').count()).toBe(16);
  const mine = await rest(page, 'kafaa_sjt_attempts?select=person_id');
  expect(mine.length).toBeGreaterThan(0);
  expect(mine.every((a: { person_id: string }) => a.person_id === 'p-nse')).toBe(true);
  await go(page, '/my/core-skills/practice');
  await chips(page, 'main', 'FS26');
  expect(await page.locator('main').innerText()).not.toMatch(GAMIFIED);
  await clean(page, w);
  // talent review never sees practice results: HR and the manager read no attempts; HR sees the aggregate, suppressed under 10
  await as(page, 'chco');
  expect((await rest(page, 'kafaa_sjt_attempts?select=person_id')).every((a: { person_id: string }) => a.person_id === 'p-chco')).toBe(true); // own practice only
  await go(page, '/workforce/core-skills');
  await chips(page, 'main', 'FS25');
  await expect(page.locator('[data-testid="m33-wf-families"]')).toBeVisible();
  await expect(page.locator('[data-testid="m33-wf-families"]')).not.toContainText(/Security|Safeguards/);
  await page.getByRole('tab', { name: 'Practice' }).click();
  await expect(page.locator('[data-testid="m33-wf-sjt-tiles"]')).toBeVisible();
  await as(page, 'chem-sup');
  expect((await rest(page, 'kafaa_sjt_attempts?select=person_id')).every((a: { person_id: string }) => a.person_id === 'p-chem-sup')).toBe(true); // a manager never reads the team's practice
  // the item bank: training manager writes, instructors read
  await as(page, 'sq-lead');
  await go(page, '/training/sjt/items');
  await expect(page.locator('[data-testid="m33-bank-readonly"]')).toBeVisible();
  await as(page, 'training-mgr');
  await go(page, '/training/sjt/items');
  await chips(page, 'main', 'FS26');
  await expect(page.locator('[data-testid="m33-bank-add"]')).toBeVisible();
  const items = await rest(page, 'kafaa_sjt_items?select=id,rationale_en,rationale_ar,core_skill_id');
  expect(items.length).toBe(48);
  expect(items.every((i: { rationale_en: string; rationale_ar: string }) => i.rationale_en.length > 20 && /[؀-ۿ]/.test(i.rationale_ar))).toBe(true);
  await clean(page, w);
  // a full practice set (local backend): expert key and rationale after each item, a score, the trend; no skill evidence
  await toLocal(page, 'k-lo-trainee');
  await go(page, '/my/core-skills/practice');
  await page.locator('[data-testid="m33-sjt-start"]').click();
  let n = 0;
  for (; n < 10; n++) {
    const q = page.locator('[data-testid="m33-sjt-question"]');
    if (!(await q.isVisible().catch(() => false))) { await page.waitForTimeout(400); if (!(await q.isVisible().catch(() => false))) break; }
    await page.locator('[data-testid="m33-sjt-opt-1"]').click();
    await page.locator('[data-testid="m33-sjt-submit"]').click();
    await expect(page.locator('[data-testid="m33-sjt-rationale"]')).toBeVisible();
    await page.locator('[data-testid="m33-sjt-continue"]').click();
  }
  expect(n).toBe(8);
  await expect(page.locator('[data-testid="m33-sjt-result"]')).toBeVisible();
  expect(await page.locator('[data-testid="benchmark-line"]').count()).toBeGreaterThan(0);
  expect(await page.locator('main').innerText()).not.toMatch(GAMIFIED);
  await clean(page, w);
});

test('C6 integration: FS21/FS22 items in pathways, FS23 indicators on skill pages, core skills and adaptive results link courses and pathways, chips on every wave-C page, Arabic RTL with Arabic-Indic digits', async ({ page }) => {
  const w = watchErrors(page);
  await pinBackend(page, 'supabase');
  await go(page, '/skills/sk-fs-ai-verify');
  expect(await page.locator('[data-testid="m28-ladder"] [data-testid="m02-ci-indicators-sk-fs-ai-verify"]').count()).toBeGreaterThanOrEqual(2);
  await expect(page.locator('[data-testid="m28-to-descriptors"]')).toHaveAttribute('href', /\/competencies\/descriptors\/sk-fs-ai-verify/);
  await clean(page, w);
  await as(page, 'nse');
  await go(page, '/learn/core-skills/cs-systems');
  expect(await page.locator('[data-testid="m33-cs-learn-pathways"] li').count()).toBeGreaterThan(0);
  await expect(page.locator('[data-testid="m33-cs-learn-courses"]')).toContainText(/Systems thinking/);
  await go(page, '/my/assessments/adaptive/ab-ai-literacy');
  await expect(page.locator('[data-testid="m05-take-result"]')).toBeVisible(); // nse's last result
  expect(await page.locator('[data-testid="m05-take-learn-pathways"] li').count()).toBeGreaterThan(0);
  await clean(page, w);
  // every wave-C page in Arabic: RTL, chips from the registry, Arabic-Indic digits
  await as(page, 'training-mgr');
  await page.evaluate(() => localStorage.setItem('kafaa.prefs.v1', JSON.stringify({ digits: 'arab', calendar: 'gregorian' })));
  const AR: [string, string][] = [
    ['/learn/pathways', 'FS17'], ['/learn/external', 'FS18'], ['/learn/future-skills', 'FS19'], ['/learn/academies', 'FS20'], ['/my/assessments/adaptive', 'FS21'],
    ['/training/integrity', 'FS22'], ['/competencies/levels', 'FS23'], ['/competencies/scale', 'FS24'], ['/learn/core-skills', 'FS25'], ['/training/sjt/items', 'FS26'],
  ];
  for (const [p, fs] of AR) {
    await go(page, `/ar${p}`);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await chips(page, 'main', fs);
    expect(await page.locator('main').innerText(), p).toMatch(/[٠-٩]/);
    expect(await textIssues(page), p).toEqual([]);
  }
  expect(w.take()).toEqual([]);
});
