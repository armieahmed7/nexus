// @vitest-environment jsdom
/** F18/F19 pages rendered with the real providers and the in-memory LocalBackend: the review hub, the board with the 9-box grid,
 *  the evidence panel with "Why this?" and the placement flow, calibration and lock, HR aggregates (suppressed), the HiPo pool,
 *  the employee's priorities (no box), succession slates with flags and roll-up, and the slate page with gated candidates. */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import { getLocalBackend } from '../../src/data';
import TalentReviewPage from '../../src/modules/m23/TalentReviewPage';
import CyclePage from '../../src/modules/m23/CyclePage';
import CalibrationPage from '../../src/modules/m23/CalibrationPage';
import TalentInsightsPage from '../../src/modules/m23/TalentInsightsPage';
import HipoPoolPage from '../../src/modules/m23/HipoPoolPage';
import MyPrioritiesPage from '../../src/modules/m23/MyPrioritiesPage';
import SuccessionPage from '../../src/modules/m23/SuccessionPage';
import SlatePage from '../../src/modules/m23/SlatePage';

const T = { timeout: 15000 };

describe('F18 pages', () => {
  it('the hub lists the cycles in the shift supervisor\'s scope with their stage', async () => {
    await renderPage(<TalentReviewPage />, { persona: 'sro', path: '/talent/review' });
    const list = await screen.findByTestId('m23-cycles', {}, T);
    const cards = within(list).getAllByTestId('m23-cycle-card');
    expect(cards.length).toBe(1);
    expect(cards[0].getAttribute('data-status')).toBe('open');
    expect(screen.getByTestId('m23-confidential')).toBeTruthy();
  }, 90000); // FS wave C QA: the first test boots the 19 MB seed (about 27 s)
  it('the board shows the grid, the evidence panel with reasons and the aspiration signal, and the manager places k-ro', async () => {
    await renderPage(<CyclePage />, { persona: 'sro', path: '/talent/review/trc-2026h2-ops', route: '/talent/review/:cycleId' });
    await screen.findByTestId('m23-ninebox', {}, T);
    expect(screen.getAllByTestId('m23-box')).toHaveLength(9);
    const unplaced = screen.getByTestId('m23-unplaced');
    expect(unplaced.textContent).toMatch(/k-ro|Reactor Operator/i);
    fireEvent.click(within(unplaced).getAllByRole('button')[0]);
    const panel = await screen.findByTestId('m23-person-panel');
    expect(within(panel).getByTestId('m23-evidence')).toBeTruthy();
    expect(within(panel).getAllByTestId('m23-ev-part')).toHaveLength(6);
    fireEvent.click(within(panel).getByTestId('m23-why-evidence'));
    expect((await screen.findByTestId('m23-why-evidence-panel')).textContent).toMatch(/Evidence index/);
    await waitFor(() => expect(within(panel).getByTestId('m18-aspiration')).toBeTruthy());
    fireEvent.click(screen.getAllByTestId('m23-place-open').at(-1)!);
    const preview = await screen.findByTestId('m23-place-preview');
    expect(preview.textContent).toMatch(/·/);
    expect(screen.getByTestId('m23-suggestions').querySelectorAll('li').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId('m23-place-save'));
    fireEvent.click(await screen.findByTestId('confirm-action'));
    await waitFor(() => expect(getLocalBackend().raw('review_placements').some((p) => p.cycle_id === 'trc-2026h2-ops' && p.placed_by === 'p-sro' && p.updated_at > '2026-10-08T23')).toBe(true), T);
  }, 40000);
  it('renders the board in Arabic', async () => {
    await renderPage(<CyclePage />, { persona: 'ops-ceo', path: '/ar/talent/review/trc-2026h2-ops', route: '/ar/talent/review/:cycleId' });
    const grid = await screen.findByTestId('m23-ninebox', {}, T);
    expect(grid.textContent).toMatch(/قائد المستقبل/);
  }, 90000); // FS wave C QA: the first test boots the 19 MB seed (about 27 s)
  it('calibration: the HR director sees the lock (calibrated by the HR BP); the HR BP sees finish and the outliers', async () => {
    await renderPage(<CalibrationPage />, { persona: 'chco', path: '/talent/review/trc-2026h2-mne/calibration', route: '/talent/review/:cycleId/calibration' });
    const lock = await screen.findByTestId('m23-lock', {}, T);
    expect((lock as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByTestId('m23-raters')).toBeTruthy();
    fireEvent.click(lock);
    expect(await screen.findByTestId('confirm-action')).toBeTruthy();
  }, 90000); // FS wave C QA: the first test boots the 19 MB seed (about 27 s)
  it('calibration as the HR BP offers finish but no lock', async () => {
    await renderPage(<CalibrationPage />, { persona: 'k-hr-analyst', path: '/talent/review/trc-2026h2-ops/calibration', route: '/talent/review/:cycleId/calibration' });
    await screen.findByTestId('m23-cal-finish', {}, T);
    expect(screen.queryByTestId('m23-lock')).toBeNull();
  }, 90000); // FS wave C QA: the first test boots the 19 MB seed (about 27 s)
  it('HR insights show suppressed cells and no names', async () => {
    await renderPage(<TalentInsightsPage />, { persona: 'k-hr-analyst', path: '/talent/review/insights' });
    const grid = await screen.findByTestId('m23-ins-grid', {}, T);
    const cells = within(grid).getAllByTestId('m23-ins-cell');
    expect(cells).toHaveLength(9);
    expect(cells.some((c) => c.getAttribute('data-suppressed') === 'true')).toBe(true);
    expect(grid.textContent).not.toMatch(/w-|Reactor Operator \(/);
  }, 90000); // FS wave C QA: the first test boots the 19 MB seed (about 27 s)
  it('the HiPo pool lists locked-cycle HiPo people with nominations for managers', async () => {
    await renderPage(<HipoPoolPage />, { persona: 'chco', path: '/talent/review/pool' });
    const pool = await screen.findByTestId('m23-pool', {}, T);
    expect(within(pool).getAllByTestId('m23-hipo').length).toBeGreaterThan(0);
  }, 90000); // FS wave C QA: the first test boots the 19 MB seed (about 27 s)
  it('an employee sees agreed priorities and never a box or rating', async () => {
    await renderPage(<MyPrioritiesPage />, { persona: 'qc-inspector', path: '/my/development-priorities' });
    const list = await screen.findByTestId('m23-my-priorities', {}, T);
    expect(within(list).getAllByTestId('m23-my-priority').length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/Future leader|Growth candidate|Core contributor|potential 3|box \d/i);
  }, 90000); // FS wave C QA: the first test boots the 19 MB seed (about 27 s)
});

describe('F19 pages', () => {
  it('the HR director sees all slates with flags, aggregates and the roll-up', async () => {
    await renderPage(<SuccessionPage />, { persona: 'chco', path: '/talent/succession' });
    const list = await screen.findByTestId('m23-slates', {}, T);
    expect(within(list).getAllByTestId('m23-slate')).toHaveLength(11);
    expect(list.textContent).toMatch(/No ready-now successor/);
    expect(list.textContent).toMatch(/more than 2 slates/);
    expect(screen.getByTestId('m23-sx-agg')).toBeTruthy();
    expect(screen.getByTestId('m23-rollup')).toBeTruthy();
  }, 90000); // FS wave C QA: the first test boots the 19 MB seed (about 27 s)
  it('an executive sees their function read-only, without aggregates or roll-up', async () => {
    await renderPage(<SuccessionPage />, { persona: 'emergency-director', path: '/talent/succession' });
    const list = await screen.findByTestId('m23-slates', {}, T);
    expect(within(list).getAllByTestId('m23-slate')).toHaveLength(1);
    expect(screen.queryByTestId('m23-rollup')).toBeNull();
    expect(screen.queryByTestId('m23-sx-agg')).toBeNull();
  }, 90000); // FS wave C QA: the first test boots the 19 MB seed (about 27 s)
  it('the slate page shows gates and candidates; ready now is disabled for a candidate with a gate not met', async () => {
    await renderPage(<SlatePage />, { persona: 'chco', path: '/talent/succession/ss-shift-supervisor-2026h2', route: '/talent/succession/:slateId' });
    await screen.findByTestId('m23-successors', {}, T);
    expect(screen.getAllByTestId('m23-gates').length).toBeGreaterThan(0);
    const cands = await screen.findByTestId('m23-candidates', {}, T);
    const blocked = within(cands).getAllByTestId('m23-candidate').find((c) => c.querySelector('[data-met="false"]') && within(c).queryByTestId('m23-propose'));
    expect(blocked).toBeTruthy();
    fireEvent.click(within(blocked!).getByTestId('m23-propose'));
    const ready = await screen.findByTestId('m23-propose-readiness');
    expect((within(ready).getAllByRole('button')[0] as HTMLButtonElement).disabled).toBe(true);
  }, 40000);
});
