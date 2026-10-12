// @vitest-environment jsdom
/** FS56/FS57 pages rendered with the real providers and the in-memory LocalBackend: the skill-change table (suppressed rows, method and
 *  window on every measured row, the drawer, recompute for the training manager only), the course card on the F25 page, the coverage
 *  page (both horizons, the heatmap, the what-if that saves nothing until confirmed, then writes the decision and the ledger), the
 *  gap backlog (states, owners, decide/sync only for the training manager) and Arabic. */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import { getLocalBackend } from '../../src/data';
import SkillChangePage from '../../src/modules/m25/SkillChangePage';
import CoveragePage from '../../src/modules/m25/CoveragePage';
import BacklogPage from '../../src/modules/m25/BacklogPage';
import EffectivenessCoursePage from '../../src/modules/m25/EffectivenessCoursePage';
import { whatIf, type CoverageReport } from '../../src/modules/m25/coverage';
import seed from '../../src/seed/seed.json';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const W = { timeout: 25000 };
const T = (seed as unknown as { tables: Record<string, Row[]> }).tables;
const nSuppressed = T.skill_change_measures.filter((r) => r.verdict === 'suppressed').length;
const raw = (t: string) => getLocalBackend().raw(t as never) as unknown as Row[];

describe('FS56 skill-change page', () => {
  it('suppressed items show "suppressed" and nothing else; measured rows state their method and window; the drawer explains the method', async () => {
    await renderPage(<SkillChangePage />, { persona: 'chco', path: '/training/skill-change' });
    const table = await screen.findByTestId('m25-sc-table', {}, W);
    expect(screen.queryByTestId('m25-sc-compute')).toBeNull();
    fireEvent.change(screen.getByTestId('m25-sc-verdict-filter'), { target: { value: 'suppressed' } });
    await waitFor(() => expect(within(table).getAllByTestId(/^m25-sc-row-/).length).toBe(nSuppressed));
    expect(within(table).queryAllByTestId('m25-sc-net').length).toBe(0);
    expect(within(table).queryAllByTestId('m25-sc-window').length).toBe(nSuppressed); // the window is stated even when suppressed
    fireEvent.change(screen.getByTestId('m25-sc-verdict-filter'), { target: { value: 'moves' } });
    await waitFor(() => expect(within(table).getAllByTestId(/^m25-sc-row-/).length).toBe(T.skill_change_measures.filter((r) => r.verdict === 'moves').length));
    expect(within(table).getAllByTestId('m25-sc-method-chip').every((c) => /comparison|before/i.test(c.textContent ?? ''))).toBe(true);
    expect(within(table).getAllByTestId('m25-sc-window').every((c) => /90/.test(c.textContent ?? ''))).toBe(true);
    fireEvent.click(within(table).getByTestId('m25-sc-row-c-hu'));
    const drawer = await screen.findByTestId('m25-sc-drawer', {}, W);
    expect(within(drawer).getByTestId('m25-sc-drawer-method').textContent).toMatch(/90/);
    expect(within(drawer).getByTestId('m25-sc-skills').querySelectorAll('tbody tr').length).toBeGreaterThan(0);
  }, 90000);

  it('the training manager can recompute (after confirming); the stored table is replaced by the same rule', async () => {
    await renderPage(<SkillChangePage />, { persona: 'training-mgr', path: '/training/skill-change' });
    fireEvent.click(await screen.findByTestId('m25-sc-compute', {}, W));
    fireEvent.click(await screen.findByTestId('confirm-action'));
    await waitFor(() => expect(raw('skill_change_measures').every((r) => r.computed_by === 'p-training-mgr' && r.computed_at > '2026-10-09')).toBe(true), W);
    expect(raw('skill_change_measures').length).toBe(T.skill_change_measures.length);
  }, 90000);

  it('the F25 course page shows this course\'s skill change with its method and a link to the full table', async () => {
    await renderPage(<EffectivenessCoursePage />, { persona: 'training-mgr', path: '/training/effectiveness/c-hu', route: '/training/effectiveness/:courseId' });
    const card = await screen.findByTestId('m25-sc-card', {}, W);
    await waitFor(() => expect(within(card).getByTestId('m25-sc-method-chip').textContent).toMatch(/comparison|before/i), W);
    expect(within(card).getByTestId('m25-sc-card-window').textContent).toMatch(/90/);
    expect(screen.getByTestId('m25-sc-card-link').getAttribute('href')).toContain('/training/skill-change');
  }, 90000);

  it('Arabic: the page renders in Arabic with Arabic verdicts', async () => {
    await renderPage(<SkillChangePage />, { persona: 'chco', path: '/ar/training/skill-change' });
    const table = await screen.findByTestId('m25-sc-table', {}, W);
    await waitFor(() => expect(within(table).getAllByTestId('m25-sc-verdict')[0].textContent).toMatch(/[؀-ۿ]/));
    expect(screen.getByTestId('m25-sc-asof').textContent).toMatch(/[؀-ۿ]/);
  }, 90000);
});

describe('FS57 coverage page', () => {
  it('both horizons, the heatmap, role drawer with what teaches each requirement; read-only for an HR analyst', async () => {
    await renderPage(<CoveragePage />, { persona: 'chco', path: '/training/coverage' });
    expect(await screen.findByTestId('m25-cov-roles-2030', {}, W)).toBeTruthy(); // 2030 first: the horizon the catalogue must get ready for
    fireEvent.click(screen.getAllByRole('tab')[0]);
    const now = await screen.findByTestId('m25-cov-roles-now', {}, W);
    expect(now.querySelectorAll('[data-testid^="m25-cov-role-"]').length).toBeGreaterThan(0);
    expect(screen.getByTestId('m25-cov-heat')).toBeTruthy();
    expect(screen.queryByTestId('m25-cov-wi-save')).toBeNull();
    fireEvent.click(now.querySelectorAll('[data-testid^="m25-cov-role-"]')[0] as HTMLElement);
    const drawer = await screen.findByTestId('m25-cov-drawer', {}, W);
    expect(within(drawer).getAllByTestId('m25-cov-req').length).toBeGreaterThan(0);
  }, 90000);

  it('acceptance FS57-3 (page): the what-if shows exactly the predicted rise, saves nothing until the decision is confirmed, then records it', async () => {
    await renderPage(<CoveragePage />, { persona: 'training-mgr', path: '/training/coverage' });
    const card = await screen.findByTestId('m25-cov-whatif', {}, W);
    const b = getLocalBackend();
    const rep = (await b.rpc.curriculumCoverage()).data as CoverageReport;
    const pickId = (screen.getByTestId('m25-cov-wi-skill') as HTMLSelectElement).value;
    const row = rep.backlog.find((x) => x.id === pickId)!;
    const total = whatIf(rep.roles, row.skill_id, 2).reduce((s, m) => s + m.delta, 0);
    expect(total).toBeGreaterThan(0);
    expect(within(card).getByTestId('m25-cov-wi-total').textContent).toBe(`+${total}`);
    expect(within(card).getAllByTestId('m25-move').length).toBe(whatIf(rep.roles, row.skill_id, 2).length);
    expect(within(card).getByTestId('m25-cov-wi-unsaved')).toBeTruthy();
    const before = JSON.stringify(raw('gap_backlog'));
    const led0 = raw('ledger_local').length;
    fireEvent.change(within(card).getByTestId('m25-cov-wi-level'), { target: { value: '1' } });
    fireEvent.change(within(card).getByTestId('m25-cov-wi-level'), { target: { value: '2' } });
    fireEvent.click(within(card).getByTestId('m25-cov-wi-save'));
    const form = await screen.findByTestId('m25-dec-form', {}, W);
    expect(screen.queryByTestId('m25-dec-problem')?.getAttribute('data-code') ?? null).toBe(row.rationale ? null : 'rationale');
    fireEvent.change(within(form).getByTestId('m25-dec-rationale'), { target: { value: 'Build it with our instructors; two cohorts a year' } });
    await waitFor(() => expect(screen.queryByTestId('m25-dec-problem')).toBeNull());
    expect(JSON.stringify(raw('gap_backlog'))).toBe(before); // the what-if and the open form wrote nothing
    expect(raw('ledger_local').length).toBe(led0);
    fireEvent.click(screen.getByTestId('m25-dec-save'));
    fireEvent.click(await screen.findByTestId('confirm-action'));
    await waitFor(() => expect((b.rawGet('gap_backlog' as never, row.id) as unknown as Row).status).toBe('decided'), W);
    const saved = b.rawGet('gap_backlog' as never, row.id) as unknown as Row;
    expect(saved.predicted.reduce((s: number, m: Row) => s + m.delta, 0)).toBe(total);
    expect(saved.plan.level).toBe(2);
    await waitFor(() => expect(raw('ledger_local').length).toBe(led0 + 1), W); // the ledger hash is computed after the row is written
  }, 90000);
});

describe('FS57 gap backlog page', () => {
  it('every row has an owner; planned rows are the decided ones; decide and sync are for the training manager only', async () => {
    await renderPage(<BacklogPage />, { persona: 'chco', path: '/training/coverage/backlog' });
    const table = await screen.findByTestId('m25-gb-table', {}, W);
    expect(screen.queryByTestId('m25-gb-sync')).toBeNull();
    fireEvent.click(screen.getByTestId('m25-gb-filter-planned'));
    await waitFor(() => expect(within(table).getAllByTestId(/^m25-gb-row-/).length).toBe(6));
    expect(within(table).queryAllByTestId(/^m25-gb-decide-/).length).toBe(0);
    expect(within(table).getAllByTestId('m25-gb-owner').every((o) => (o.textContent ?? '').trim().length > 0)).toBe(true);
    fireEvent.click(within(table).getAllByTestId(/^m25-gb-row-/)[0]);
    const drawer = await screen.findByTestId('m25-gb-drawer', {}, W);
    expect(within(drawer).getByTestId('m25-gb-rationale').textContent!.length).toBeGreaterThan(10);
  }, 90000);

  it('the training manager can sync the backlog and open a decision; Arabic renders', async () => {
    await renderPage(<BacklogPage />, { persona: 'training-mgr', path: '/ar/training/coverage/backlog' });
    const table = await screen.findByTestId('m25-gb-table', {}, W);
    expect(screen.getByTestId('m25-gb-sync')).toBeTruthy();
    expect(within(table).getAllByTestId('m25-gb-state')[0].textContent).toMatch(/[؀-ۿ]/);
    fireEvent.click(within(table).getAllByTestId(/^m25-gb-decide-/)[0]);
    expect(await screen.findByTestId('m25-dec-form', {}, W)).toBeTruthy();
    fireEvent.click(screen.getByTestId('m25-gb-sync'));
    fireEvent.click(await screen.findByTestId('confirm-action'));
    await waitFor(() => expect(screen.queryByTestId('confirm-action')).toBeNull(), W);
    expect(raw('gap_backlog').length).toBe(T.gap_backlog.length);
  }, 90000);
});
