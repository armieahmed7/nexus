// @vitest-environment jsdom
/** FS06 pages rendered with the real providers and the in-memory LocalBackend: the task-layer explorer (tiles, exposure mix,
 *  reference lines, driver badges with the published threshold, the explorer and the SAT analysts), the Future card on a task
 *  with the editor, the Future column and filter on a role's inventory, the SAT workbench summary and the change log, in English
 *  and Arabic. Restricted tasks never appear. */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import SatFuturePage from '../../src/modules/m26/SatFuturePage';
import SatTaskPage from '../../src/modules/m26/SatTaskPage';
import SatRolePage from '../../src/modules/m26/SatRolePage';
import SatPage from '../../src/modules/m26/SatPage';
import SatChangesPage from '../../src/modules/m26/SatChangesPage';
import { RESTRICTED_TITLE } from '../../src/modules/m26/sat';
import seed from '../../src/seed/seed.json';

const T = { timeout: 20000 };
const S = (seed as unknown as { tables: Record<string, any[]> }).tables; // eslint-disable-line @typescript-eslint/no-explicit-any

describe('FS06 pages', () => {
  it('the task layer shows tiles, benchmark ties, reference rows, driver badges, the explorer and the analysts (training manager)', async () => {
    await renderPage(<SatFuturePage />, { persona: 'training-mgr', path: '/training/sat/future' });
    const tiles = await screen.findByTestId('m26-fx-tiles', {}, T);
    const rated = S.jta_tasks.filter((t) => !t.restricted).length;
    expect(tiles.textContent).toContain(`${rated} / ${rated}`);
    await waitFor(() => expect(Array.from(screen.getByTestId('m26-fx-bench').querySelectorAll('button[data-testid^="benchmark-chip-"]')).map((x) => x.getAttribute('data-testid'))).toEqual(['benchmark-chip-OECD-AICI', 'benchmark-chip-SSG-SF', 'benchmark-chip-ONET'])); // FS01 shared chips (wave-A integration)
    expect(screen.getAllByTestId('m26-fx-ref').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByTestId('m26-fx-hot-criteria').textContent).toMatch(/30%/);
    expect(screen.getByTestId('m26-fx-rule')).toBeTruthy();
    expect(within(screen.getByTestId('m26-fx-levels')).getAllByRole('row').length).toBe(10);
    expect(screen.getByTestId('m26-fx-explorer').querySelectorAll('tbody tr').length).toBeGreaterThan(0);
    expect(screen.getByTestId('m26-fx-analysts').textContent).toMatch(/Designated/);
    expect(screen.getByTestId('m26-fx-designate')).toBeTruthy();
    expect(document.body.textContent).not.toContain(RESTRICTED_TITLE.en);
    fireEvent.click(screen.getByTestId('benchmark-chip-OECD-AICI'));
    expect((await screen.findByTestId('benchmark-drawer')).querySelector('a[href^="https://"]')).toBeTruthy();
  }, 40000);
  it('an auditor reads the layer without write or designation controls', async () => {
    await renderPage(<SatFuturePage />, { persona: 'k-auditor', path: '/training/sat/future' });
    expect(await screen.findByTestId('m26-fx-readonly', {}, T)).toBeTruthy();
    expect(screen.queryByTestId('m26-fx-designate')).toBeNull();
  }, 40000);
  it('a task shows its future card with reasons, needs bars and skills; the analyst opens the editor with a live preview', async () => {
    await renderPage(<SatTaskPage />, { persona: 'sq-lead', path: '/training/sat/tasks/jt-qs-ro-t4', route: '/training/sat/tasks/:taskId' });
    const card = await screen.findByTestId('m26-fx-summary', {}, T);
    expect(within(card).getByTestId('m26-fx-task-why')).toBeTruthy();
    expect(screen.getByTestId('m26-fx-needs').querySelectorAll('li').length).toBeGreaterThan(0);
    expect(screen.getByTestId('m26-fx-skills').querySelectorAll('li').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId('m26-fx-edit'));
    expect(await screen.findByTestId('m26-fx-editor')).toBeTruthy();
    expect(screen.getByTestId('m26-fx-preview-why')).toBeTruthy();
  }, 40000);
  it('an instructor who is not an analyst sees no edit button; a restricted task shows no future card', async () => {
    await renderPage(<SatTaskPage />, { persona: 'k-instructor', path: '/training/sat/tasks/jt-qs-ro-t4', route: '/training/sat/tasks/:taskId' });
    await screen.findByTestId('m26-fx-summary', {}, T);
    expect(screen.queryByTestId('m26-fx-edit')).toBeNull();
  }, 40000);
  it('a restricted task shows no future card', async () => {
    await renderPage(<SatTaskPage />, { persona: 'training-mgr', path: '/training/sat/tasks/jt-security-officer-r1', route: '/training/sat/tasks/:taskId' });
    await screen.findAllByTestId('m26-restricted', {}, T);
    expect(screen.queryByTestId('m26-fx-card')).toBeNull();
  }, 40000);
  it('the role inventory has a Future column and filter; the workbench shows the task-layer summary', async () => {
    await renderPage(<SatRolePage />, { persona: 'training-mgr', path: '/training/sat/roles/local-operator', route: '/training/sat/roles/:roleId' });
    await screen.findByTestId('m26-role-header', {}, T);
    expect((await screen.findAllByTestId('m26-fx-cell', {}, T)).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByTestId('m26-fx-filter'), { target: { value: 'human_core' } });
    const inv = screen.getByTestId('m26-inventory');
    const n = S.jta_tasks.filter((t) => t.role_id === 'local-operator' && t.exposure === 'human_core').length;
    expect(inv.querySelectorAll('tbody tr').length).toBe(n);
  }, 40000);
  it('the SAT workbench carries the task-layer summary with a link into it', async () => {
    await renderPage(<SatPage />, { persona: 'k-instructor', path: '/training/sat' });
    expect(await screen.findByTestId('m26-fx-sat', {}, T)).toBeTruthy();
    expect(screen.getByTestId('m26-fx-open')).toBeTruthy();
  }, 40000);
  it('the change log shows future edits with a before/after diff', async () => {
    await renderPage(<SatChangesPage />, { persona: 'training-mgr', path: '/training/sat/changes?status=closed&area=future' });
    const list = await screen.findByTestId('m26-changes', {}, T);
    expect(within(list).getAllByTestId('m26-fx-diff').length).toBe(S.sat_changes.filter((c) => c.area === 'future' && c.status === 'closed').length);
  }, 40000);
  it('renders in Arabic', async () => {
    await renderPage(<SatFuturePage />, { persona: 'training-mgr', path: '/ar/training/sat/future' });
    const tiles = await screen.findByTestId('m26-fx-tiles', {}, T);
    expect(tiles.textContent).toMatch(/[؀-ۿ]/);
    expect(document.body.textContent).toContain('مهمة بشرية أساسية');
  }, 40000);
});
