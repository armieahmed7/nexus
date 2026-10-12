// @vitest-environment jsdom
/** FS77 pages rendered with the real providers and the in-memory LocalBackend: the public starter (anonymous use stores nothing: no fetch,
 *  no RPC, no write, no browser storage; every fact shows its source and as-of date, secondary ones flagged; SMR "no deployment decision
 *  implied"; the intake preview reads the published baseline), the journey's starter section, a signed-in student keeping progress
 *  through saveStudentJourney (the rest of the journey unchanged), my induction plan (read from my intake-year baseline), and HR's
 *  intake baselines page (stale plans rebuilt, a draft published, mandatory modules locked, read-only for training staff). Arabic too. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import { getLocalBackend } from '../../src/data';
import seed from '../../src/seed/seed.json';
import StarterPage from '../../src/modules/m06/StarterPage';
import JourneyPage from '../../src/modules/m06/JourneyPage';
import MyInductionPage from '../../src/modules/m06/MyInductionPage';
import WorkforceIntakeBaselinesPage from '../../src/modules/m06/WorkforceIntakeBaselinesPage';
import { noScoreText } from '../../src/modules/m06/journey';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const TB = (seed as unknown as { tables: Record<string, Row[]> }).tables;
const W = { timeout: 30000 };
const FIRST = { timeout: 90000 };
const raw = (t: string) => getLocalBackend().raw(t as never) as unknown as Row[];
afterEach(() => vi.restoreAllMocks());

function spyAll() {
  const b = getLocalBackend();
  const fetchSpy = vi.spyOn(globalThis, 'fetch' as never);
  const setItem = vi.spyOn(Storage.prototype, 'setItem');
  const rpcSpies = Object.keys(b.rpc).filter((k) => typeof (b.rpc as any)[k] === 'function').map((k) => vi.spyOn(b.rpc as any, k));
  const writes = [vi.spyOn(b, 'insert' as never), vi.spyOn(b, 'update' as never), vi.spyOn(b, 'rawInsert' as never), vi.spyOn(b, 'rawUpdate' as never)];
  const audit0 = b.raw('audit_events').length;
  return () => {
    expect(fetchSpy).not.toHaveBeenCalled();
    for (const s of rpcSpies) expect(s).not.toHaveBeenCalled();
    for (const w of writes) expect(w).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(b.raw('audit_events').length).toBe(audit0);
  };
}

describe('FS77 starter (public)', () => {
  it('FS77 acceptance: anonymous use stores nothing: answering every self-check and using the intake preview sends and stores nothing', async () => {
    await renderPage(<StarterPage />, { path: '/pathways/journey/starter' });
    await waitFor(() => expect(screen.getAllByTestId('m06-starter-lesson').length).toBe(8), FIRST);
    await screen.findByTestId('m06-starter-plan', {}, W);
    const check = spyAll();
    for (const l of TB.starter_lessons) fireEvent.click(screen.getByTestId(`m06-starter-opt-${l.id}-${l.self_check.correct}`));
    fireEvent.click(screen.getByTestId('m06-starter-prog-gdp'));
    fireEvent.click(screen.getByTestId('m06-starter-year-2025'));
    expect(screen.getByTestId('m06-starter-progress-ai').textContent).toMatch(/5 of 5/);
    expect(screen.getByTestId('m06-starter-progress-smr').textContent).toMatch(/3 of 3/);
    expect(screen.getByTestId(`m06-starter-feedback-${TB.starter_lessons[0].id}`).textContent).toMatch(/That's right/);
    expect(screen.queryByTestId('m06-starter-save')).toBeNull();
    expect(screen.getByTestId('m06-starter-signin')).toBeTruthy();
    expect(screen.getByText(/Nothing on this page is stored or sent/)).toBeTruthy();
    await new Promise((r) => setTimeout(r, 300));
    check();
    expect(noScoreText(document.body.textContent ?? '')).toBe(true);
  }, 150000);

  it('FS77 acceptance: all facts cite sources: every lesson shows https sources with an as-of date, secondary ones flagged (EN and AR)', async () => {
    for (const path of ['/pathways/journey/starter', '/ar/pathways/journey/starter']) {
      await renderPage(<StarterPage />, { path });
      await waitFor(() => expect(screen.getAllByTestId('m06-starter-lesson').length).toBe(8), FIRST);
      for (const card of screen.getAllByTestId('m06-starter-lesson')) {
        const items = within(card).getAllByTestId('m06-starter-source');
        expect(items.length).toBeGreaterThan(0);
        for (const li of items) {
          expect(li.querySelector('a')?.getAttribute('href')).toMatch(/^https:\/\//);
          expect(li.textContent).toMatch(path.startsWith('/ar') ? /حتى/ : /as of/);
        }
      }
      const secondaryUrls = TB.starter_lessons.flatMap((l) => l.sources).filter((s) => s.secondary).map((s) => s.url);
      const flagged = screen.getAllByTestId('m06-starter-source').filter((li) => li.getAttribute('data-secondary') === 'true');
      expect(flagged.length).toBeGreaterThan(0);
      for (const li of flagged) expect(secondaryUrls).toContain(li.querySelector('a')?.getAttribute('href'));
      expect(within(flagged[0]).getByTestId('m06-starter-secondary').textContent).toMatch(path.startsWith('/ar') ? /مصدر ثانوي/ : /Secondary source/);
      // SMR orientation carries "no deployment decision implied"
      expect(within(screen.getByTestId('m06-starter-track-smr').parentElement!).getByText(path.startsWith('/ar') ? /لا يعني ذلك أي قرار بالنشر/ : /No deployment decision is implied/)).toBeTruthy();
      cleanup();
    }
  }, 200000);

  it('intake preview: the published baseline for the chosen year and programme shortens induction; mandatory modules stay full', async () => {
    await renderPage(<StarterPage />, { path: '/pathways/journey/starter' });
    const plan = await screen.findByTestId('m06-starter-plan', {}, FIRST);
    // default: newest published year (2026), DNT -> ib-2026-all-v2
    await waitFor(() => expect(within(plan).getAllByTestId('m06-plan-item').length).toBe(12), W);
    const action = (id: string) => within(plan).getAllByTestId('m06-plan-item').find((x) => x.getAttribute('data-module') === id)!.getAttribute('data-action');
    expect(action('ind-digital')).toBe('skip');
    expect(action('ind-ai-basics')).toBe('refresher');
    expect(action('ind-safety-culture')).toBe('full');
    expect(screen.getByTestId('m06-starter-planned').textContent).toMatch(/27\.5 h/);
    fireEvent.click(screen.getByTestId('m06-starter-prog-gdp'));
    await waitFor(() => expect(action('ind-data')).toBe('skip'), W); // GDP programme baseline: data held
    fireEvent.click(within(plan).getAllByTestId('m06-plan-why')[0]);
    expect(screen.getAllByTestId('m06-starter-module').filter((m) => m.getAttribute('data-mandatory') === 'true').length).toBe(6);
  }, 150000);

  it('the journey page shows the starter section; answering its self-check as a visitor stores nothing', async () => {
    await renderPage(<JourneyPage />, { path: '/pathways/journey' });
    const sec = await screen.findByTestId('m06-journey-starter', {}, FIRST);
    await waitFor(() => expect(within(sec).getAllByTestId('m06-starter-lesson').length).toBe(1), W);
    expect(within(sec).getByTestId('m06-journey-starter-open-ai').getAttribute('href')).toMatch(/\/pathways\/journey\/starter#ai$/);
    const check = spyAll();
    fireEvent.click(within(sec).getByTestId('m06-starter-opt-sl-ai-what-1'));
    expect(within(sec).getByTestId('m06-starter-feedback-sl-ai-what').textContent).toMatch(/That's right/);
    await new Promise((r) => setTimeout(r, 200));
    check();
  }, 150000);

  it('a signed-in student keeps their starter progress in their own journey; stage, route and checklist are unchanged', async () => {
    await renderPage(<StarterPage />, { persona: 'k-student', path: '/pathways/journey/starter' });
    await waitFor(() => expect(screen.getAllByTestId('m06-starter-lesson').length).toBe(8), FIRST);
    const before = { ...raw('student_journeys').find((j) => j.person_id === 'p-k-student')! };
    fireEvent.click(await screen.findByTestId('m06-starter-opt-sl-ai-what-1', {}, W));
    fireEvent.click(screen.getByTestId('m06-starter-opt-sl-smr-what-0'));
    fireEvent.click(screen.getByTestId('m06-starter-save'));
    await waitFor(() => expect(raw('student_journeys').find((j) => j.person_id === 'p-k-student')!.milestones.checklist['starter:sl-ai-what']).toBe('done'), W);
    const after = raw('student_journeys').find((j) => j.person_id === 'p-k-student')!;
    expect(after.milestones.checklist['starter:sl-smr-what']).toBe('done');
    expect([after.stage, after.route]).toEqual([before.stage, before.route]);
    expect(after.interests.answers).toEqual(before.interests.answers);
    for (const [k, v] of Object.entries(before.milestones.checklist)) expect(after.milestones.checklist[k]).toBe(v);
  }, 150000);
});

describe('FS77 my induction plan', () => {
  it('the DNT graduate persona sees the plan read from the 2026 baseline: skipped, refresher and mandatory modules with reasons', async () => {
    await renderPage(<MyInductionPage />, { persona: 'k-lo-trainee', path: '/my/induction' });
    const plan = await screen.findByTestId('m06-myind-plan', {}, FIRST);
    const mine = TB.induction_plans.find((p) => p.person_id === 'p-k-lo-trainee')!;
    expect(screen.getByTestId('m06-myind-baseline').textContent).toMatch(new RegExp(mine.baseline_id));
    expect(screen.getByTestId('m06-myind-saved').textContent).toMatch(new RegExp(`${mine.hours_saved} h`));
    await waitFor(() => expect(within(plan).getAllByTestId('m06-plan-item').length).toBe(12), W);
    fireEvent.click(within(plan).getAllByTestId('m06-plan-why')[0]);
    expect(screen.queryByTestId('m06-myind-stale')).toBeNull();
    expect(screen.getAllByText(/Not a qualification record/).length).toBeGreaterThan(0);
  }, 150000);

  it('someone without a plan sees an empty state; HR on their own page never sees another person\'s plan', async () => {
    await renderPage(<MyInductionPage />, { persona: 'k-hr-analyst', path: '/my/induction' });
    expect(await screen.findByText(/No induction plan yet/, {}, FIRST)).toBeTruthy();
    expect(screen.queryByTestId('m06-myind-plan')).toBeNull();
  }, 150000);

  it('Arabic: my induction plan renders in Arabic', async () => {
    await renderPage(<MyInductionPage />, { persona: 'k-lo-trainee', path: '/ar/my/induction' });
    await screen.findByTestId('m06-myind-plan', {}, FIRST);
    expect(screen.getAllByText(/يُدرَّس دائماً/).length).toBeGreaterThan(0);
  }, 150000);
});

describe('FS77 intake baselines (HR)', () => {
  it('HR rebuilds the stale plan, then publishes the 2027 draft: six 2027 plans become stale; mandatory modules are locked', async () => {
    await renderPage(<WorkforceIntakeBaselinesPage />, { persona: 'k-hr-analyst', path: '/workforce/intake-baselines' });
    await waitFor(() => expect(screen.getByTestId('m06-ibw-stale-count').textContent).toBe('1'), FIRST);
    // plans tab: rebuild the stale direct hire
    fireEvent.click(screen.getByRole('tab', { name: /Induction plans/ }));
    expect((await screen.findByTestId('m06-ibw-plan-state-w-lo-10', {}, W)).textContent).toMatch(/To rebuild/);
    fireEvent.click(screen.getByTestId('m06-ibw-plan-rebuild-w-lo-10'));
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Rebuild' }).length).toBeGreaterThan(1), W);
    fireEvent.click(screen.getAllByRole('button', { name: 'Rebuild' }).at(-1)!);
    await waitFor(() => expect(screen.getByTestId('m06-ibw-stale-count').textContent).toBe('0'), W);
    expect(raw('induction_plans').find((p) => p.person_id === 'w-lo-10')!.baseline_id).toBe('ib-2026-all-v2');
    // baselines tab: edit the 2027 draft and publish
    fireEvent.click(screen.getByRole('tab', { name: /Baselines/ }));
    fireEvent.click(await screen.findByTestId('m06-ibw-edit-2027-all', {}, W));
    const ed = await screen.findByTestId('m06-ibw-editor', {}, W);
    expect(within(ed).getByTestId('m06-ibw-locked-ind-safety-culture')).toBeTruthy();
    expect(within(ed).queryByTestId('m06-ibw-problem')).toBeNull();
    fireEvent.click(within(ed).getByTestId('m06-ibw-publish'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Publish' }).at(-1)!);
    await waitFor(() => expect(raw('intake_baselines').find((x) => x.id === 'ib-2027-all-v1')!.status).toBe('published'), W);
    await waitFor(() => expect(screen.getByTestId('m06-ibw-stale-count').textContent).toBe('6'), W);
  }, 200000);

  it('training staff read baselines and plans but cannot edit or build; the joiner list shows offered applicants', async () => {
    await renderPage(<WorkforceIntakeBaselinesPage />, { persona: 'training-mgr', path: '/workforce/intake-baselines' });
    await screen.findByTestId('m06-ibw-baselines', {}, FIRST);
    await waitFor(() => expect(screen.getAllByTestId('m06-ibw-baseline').length).toBe(TB.intake_baselines.length), W);
    expect(screen.queryByTestId('m06-ibw-new')).toBeNull();
    expect(screen.getByText(/Read only/)).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Joiners/ }));
    const list = await screen.findByTestId('m06-ibw-joiners', {}, W);
    const offer = within(list).getAllByTestId('m06-ibw-joiner').find((x) => x.getAttribute('data-person') === 'ap-128')!;
    expect(offer.getAttribute('data-source')).toBe('offer');
    expect(within(list).queryByTestId('m06-ibw-build-ap-128')).toBeNull();
  }, 150000);

  it('HR builds a plan for an offered applicant from the joiners tab; the editor shows the first problem before saving', async () => {
    await renderPage(<WorkforceIntakeBaselinesPage />, { persona: 'k-hr-analyst', path: '/workforce/intake-baselines' });
    fireEvent.click(await screen.findByTestId('m06-ibw-new', {}, FIRST));
    const ed = await screen.findByTestId('m06-ibw-editor', {}, W);
    expect(within(ed).getByTestId('m06-ibw-problem').textContent).toMatch(/at least one module/);
    fireEvent.click(screen.getByRole('tab', { name: /Joiners/ }));
    fireEvent.click(await screen.findByTestId('m06-ibw-build-ap-128', {}, W));
    await screen.findByTestId('m06-ibw-build-form', {}, W);
    fireEvent.click(screen.getAllByRole('button', { name: 'Build plan' }).at(-1)!);
    await waitFor(() => expect(raw('induction_plans').some((p) => p.person_id === 'ap-128')).toBe(true), W);
    expect(raw('notifications').some((n) => n.id === 'nt-ip-ap-128-r1')).toBe(true);
  }, 150000);
});
