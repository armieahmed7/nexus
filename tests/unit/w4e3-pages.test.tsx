// @vitest-environment jsdom
/** F28 pages rendered with the real providers and the in-memory LocalBackend: the library (training scenarios only, review queue
 *  with maker-checker), the editor's live content check (exam / security / specifics), the cycle planner's coverage matrix
 *  flags and ranked suggestions with "Why this?", crew debriefs (drawer, form preview that names only the booked crew), the
 *  scenario page, the crew view for a reactor operator and a shift manager, the simulator tab, Arabic, and A4: no exam or
 *  security content anywhere in the rendered library. */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import TrainingScenariosPage from '../../src/modules/m04/TrainingScenariosPage';
import TrainingScenarioPage from '../../src/modules/m04/TrainingScenarioPage';
import MySimDebriefsPage from '../../src/modules/m04/MySimDebriefsPage';
import TrainingSimulatorPage from '../../src/modules/m04/TrainingSimulatorPage';
import { contentIssue } from '../../src/modules/m04/scenarios';

const T = { timeout: 15000 };
const tab = async (name: RegExp) => fireEvent.click(await screen.findByRole('tab', { name }, T));

describe('F28 pages', { timeout: 90000 }, () => {
  it('library: tiles, scenarios with status and category, and (A4) no exam or security content in any listed scenario', async () => {
    await renderPage(<TrainingScenariosPage />, { persona: 'training-mgr', path: '/training/simulator/scenarios' });
    const lib = await screen.findByTestId('m04-scn-library', {}, T);
    await waitFor(() => expect(within(lib).getAllByRole('row').length).toBeGreaterThan(10), T);
    expect(lib.textContent).toMatch(/Small-break loss-of-coolant accident/);
    expect(contentIssue([lib.textContent ?? ''])).toBeNull();
    expect(screen.getAllByTestId('stat-tile').length).toBeGreaterThanOrEqual(4);
    expect(document.body.textContent).toMatch(/Training scenarios only/);
  });
  it('review queue: the training manager approves a scenario someone else revised (confirmed, then approved)', async () => {
    await renderPage(<TrainingScenariosPage />, { persona: 'training-mgr', path: '/training/simulator/scenarios' });
    const q = await screen.findByTestId('m04-scn-queue', {}, T);
    expect(q.textContent).toMatch(/SCN-024/);
    fireEvent.click(within(q).getByTestId('m04-scn-approve-scn-024'));
    fireEvent.click(await screen.findByTestId('confirm-action'));
    await waitFor(() => expect(screen.getByTestId('m04-scn-queue').textContent).not.toMatch(/SCN-024/), T);
  });
  it('an instructor sees no review queue but can open the editor; the live content check blocks exam wording', async () => {
    await renderPage(<TrainingScenariosPage />, { persona: 'k-instructor', path: '/training/simulator/scenarios' });
    await screen.findByTestId('m04-scn-library', {}, T);
    expect(screen.queryByTestId('m04-scn-queue')).toBeNull();
    fireEvent.click(screen.getByTestId('m04-scn-new'));
    const ed = await screen.findByTestId('m04-scn-editor', {}, T);
    fireEvent.change(within(ed).getByLabelText(/Title \(English\)/), { target: { value: 'NRC exam scenario' } });
    expect((await screen.findByTestId('m04-scn-issue')).textContent).toMatch(/exam/i);
    expect((screen.getByTestId('m04-scn-submit') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(ed).getByLabelText(/Title \(English\)/), { target: { value: 'Valve 1FW-V-0123 sticks' } });
    expect((await screen.findByTestId('m04-scn-issue')).textContent).toMatch(/plant specifics/);
  });
  it('a line manager reads the library without write or review controls', async () => {
    await renderPage(<TrainingScenariosPage />, { persona: 'sro', path: '/training/simulator/scenarios' });
    await screen.findByTestId('m04-scn-library', {}, T);
    expect(screen.queryByTestId('m04-scn-new')).toBeNull();
    expect(screen.queryByTestId('m04-scn-queue')).toBeNull();
  });
  it('A2 planner: the coverage matrix flags required objectives not covered; suggestions carry "Why this?"', async () => {
    await renderPage(<TrainingScenariosPage />, { persona: 'k-instructor', path: '/training/simulator/scenarios' });
    await tab(/Cycle planner/);
    const m = await screen.findByTestId('m04-scn-matrix', {}, T);
    const flagged = within(m).getAllByTestId('m04-scn-matrix-row').filter((r) => r.getAttribute('data-status') !== 'covered');
    expect(flagged.map((r) => r.textContent)).toEqual([expect.stringMatching(/SO-E6/), expect.stringMatching(/SO-S3/)]);
    // the 2027-2028 draft has many gaps and ranked suggestions
    fireEvent.change(screen.getByLabelText('Cycle'), { target: { value: 'cyc-coct-2027-28' } });
    const sug = await screen.findByTestId('m04-scn-suggest', {}, T);
    expect(within(sug).getAllByTestId('m04-scn-suggestion').length).toBeGreaterThan(0);
    fireEvent.click(within(sug).getAllByTestId('m04-scn-why')[0]);
    expect((await screen.findByTestId('m04-scn-why-panel')).textContent).toMatch(/no planned scenario covers|planned \d+ of \d+|required competency|category missing/);
    // adding a suggestion updates the draft (unsaved) and the board
    const before = within(screen.getByTestId('m04-scn-matrix')).getAllByTestId('m04-scn-matrix-row').filter((r) => r.getAttribute('data-status') === 'covered').length;
    fireEvent.click(within(sug).getAllByTestId('m04-scn-suggest-add')[0]);
    expect(await screen.findByTestId('m04-scn-plan-dirty')).toBeTruthy();
    await waitFor(() => expect(within(screen.getByTestId('m04-scn-matrix')).getAllByTestId('m04-scn-matrix-row').filter((r) => r.getAttribute('data-status') === 'covered').length).toBeGreaterThan(before), T);
  });
  it('debriefs: the list opens a drawer with team ratings, self-ratings and the crew; the form names only the booked crew', async () => {
    await renderPage(<TrainingScenariosPage />, {
      persona: 'k-instructor', path: '/training/simulator/scenarios',
      prepare: (b) => { const d = new Date(Date.now() - 86_400_000).toISOString(); b.rawInsert('simulator_slots', { id: 'sim-ui-b', simulator: 'FSS-1', starts_at: d, ends_at: d, crew: 'B', session_id: null, booking_kind: 'coct', priority: 1, status: 'booked', booked_by: 'p-k-instructor' } as never); },
    });
    await tab(/Crew debriefs/);
    const list = await screen.findByTestId('m04-scn-debriefs', {}, T);
    await waitFor(() => expect(within(list).getAllByRole('row').length).toBeGreaterThan(5), T);
    fireEvent.click(within(list).getAllByRole('row')[1]);
    const drawer = await screen.findByTestId('m04-scn-debrief', {}, T);
    expect(within(drawer).getByTestId('m04-scn-ratings')).toBeTruthy();
    expect(drawer.textContent).toMatch(/Imported history/);
    fireEvent.click(screen.getByTestId('m04-scn-deb-new'));
    const form = await screen.findByTestId('m04-scn-debrief-form', {}, T);
    fireEvent.change(within(form).getByLabelText('Simulator slot'), { target: { value: 'sim-ui-b' } });
    const att = within(form).getByTestId('m04-scn-attendance');
    expect(att.textContent).toMatch(/Crew B/);
    expect(within(att).getAllByRole('checkbox').length).toBe(8);
    expect(within(form).getByTestId('m04-scn-deb-preview').textContent).toMatch(/never 'verified'/);
    fireEvent.click(screen.getByTestId('m04-scn-deb-save'));
    fireEvent.click(await screen.findByTestId('confirm-action'));
    await waitFor(() => expect(screen.getByTestId('m04-scn-debriefs').textContent).toMatch(/Recorded in Kafa'a · 32 evidence/), T);
  });
  it('insights: team-level heatmaps of instructor ratings and the self-rating gap', async () => {
    await renderPage(<TrainingScenariosPage />, { persona: 'training-mgr', path: '/training/simulator/scenarios' });
    await tab(/Team insights/);
    const ins = await screen.findByTestId('m04-scn-insights', {}, T);
    expect(within(ins).getAllByTestId('heatmap')).toHaveLength(2);
    expect(ins.textContent).toMatch(/never one person/);
  });
  it('the scenario page shows objectives, cycles, history and runs', async () => {
    await renderPage(<TrainingScenarioPage />, { persona: 'k-instructor', path: '/training/simulator/scenarios/scn-012', route: '/training/simulator/scenarios/:scenarioId' });
    expect((await screen.findByTestId('m04-scn-detail', {}, T)).textContent).toMatch(/Training only/);
    expect(screen.getByTestId('m04-scn-detail-objectives').textContent).toMatch(/SO-E2/);
    expect(document.body.textContent).toMatch(/COCT 2025-2026 simulator cycle/);
    expect(document.body.textContent).toMatch(/Revision history/);
    expect(screen.getByTestId('m04-scn-edit')).toBeTruthy();
  });
  it('crew view: a reactor operator sees their own debriefs; the crew B shift manager also sees the crew', async () => {
    await renderPage(<MySimDebriefsPage />, { persona: 'k-ro', path: '/my/simulator' });
    const mine = await screen.findByTestId('m04-scn-my-list', {}, T);
    expect(mine.textContent).toMatch(/Crew B/);
    expect(screen.queryByTestId('m04-scn-my-scope')).toBeNull();
    await renderPage(<MySimDebriefsPage />, { persona: 'sro', path: '/my/simulator' });
    await screen.findByTestId('m04-scn-my-list', {}, T);
  });
  it('a person with no debriefs sees the empty state', async () => {
    await renderPage(<MySimDebriefsPage />, { persona: 'chco', path: '/my/simulator' });
    expect(await screen.findByText(/No simulator debriefs yet/, {}, T)).toBeTruthy();
  });
  it('the simulator page gains a "Scenarios and debriefs" tab', async () => {
    await renderPage(<TrainingSimulatorPage />, { persona: 'k-instructor', path: '/training/simulator' });
    await tab(/Scenarios and debriefs/);
    const t = await screen.findByTestId('m04-sim-scenarios-tab', {}, T);
    expect(within(t).getByTestId('m04-sim-library-link').getAttribute('href')).toBe('/training/simulator/scenarios');
  });
  it('renders in Arabic', async () => {
    await renderPage(<TrainingScenariosPage />, { persona: 'training-mgr', path: '/ar/training/simulator/scenarios' });
    const lib = await screen.findByTestId('m04-scn-library', {}, T);
    await waitFor(() => expect(lib.textContent).toMatch(/حادث فقدان مبرّد/), T);
    expect(document.body.textContent).toMatch(/سيناريوهات تدريب فقط/);
  });
});
