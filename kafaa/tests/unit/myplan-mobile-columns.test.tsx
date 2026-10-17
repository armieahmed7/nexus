// @vitest-environment jsdom
/**
 * My plan on phones: DataTable columns marked hideBelow: 'sm' hide below Tailwind sm (header and cells) but still export to
 * CSV, and the row's "Open {label}" button (A11Y-02) stays. The folded second line the plan page uses has EN/AR text.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider, translate } from '../../src/i18n';
import { DataTable, toCsv, type Column } from '../../src/ui/DataTable';

type Row = { id: string; name: string; asks: number; need: number };
const ROWS: Row[] = [{ id: 'r1', name: 'Alpha', asks: 2, need: 3 }];
const COLS: Column<Row>[] = [
  { key: 'name', header: 'Name', value: (r) => r.name },
  { key: 'asks', header: 'Asks', value: (r) => r.asks, hideBelow: 'sm' },
  { key: 'need', header: 'Needs', value: (r) => r.need },
];

afterEach(cleanup);

describe('My plan · narrow-screen columns', () => {
  it('hides a hideBelow column below sm in header and body, keeps the others and the open button', () => {
    render(<MemoryRouter><I18nProvider><DataTable rows={ROWS} rowKey={(r) => r.id} columns={COLS} onRowClick={vi.fn()} searchable={false} /></I18nProvider></MemoryRouter>);
    const th = screen.getByRole('columnheader', { name: 'Asks' });
    expect(th.className).toMatch(/(^|\s)hidden sm:table-cell(\s|$)/);
    const td = screen.getByText('2').closest('td')!;
    expect(td.className).toContain('hidden sm:table-cell');
    for (const name of ['Name', 'Needs']) expect(screen.getByRole('columnheader', { name }).className).not.toContain('hidden');
    expect(screen.getByText('Alpha').closest('td')!.className).not.toContain('hidden');
    expect(screen.getByRole('button', { name: 'Open Alpha' })).toBeTruthy();
  });

  it('a hidden column still exports to CSV', () => {
    expect(toCsv(ROWS, COLS).split('\r\n')[0]).toBe('"Name","Asks","Needs"');
  });

  it('the folded gap line reads in EN and AR', () => {
    const args = { imp: 'X', asks: '2', need: '3' };
    expect(translate('en', 'm04.plan.gapFolded', args)).toBe('X · Current role asks for 2 · Target role needs 3');
    const ar = translate('ar', 'm04.plan.gapFolded', args);
    expect(ar).toContain('2');
    expect(ar).toContain('3');
    expect(ar).not.toBe(translate('en', 'm04.plan.gapFolded', args));
  });
});
