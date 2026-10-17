// @vitest-environment jsdom
/**
 * A11Y-02: DataTable rows with onRowClick open by keyboard. Each such row ends in an "Open {label}" button (EN/AR); the row
 * click stays for mouse users, moves focus to that button first (so a drawer it opens returns focus there), and a click on the
 * button or on a control inside a cell opens the row once.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useState } from 'react';
import { I18nProvider, translate } from '../../src/i18n';
import { DataTable, type Column } from '../../src/ui/DataTable';
import { Drawer } from '../../src/ui/Modal';

type Row = { id: string; name: string; n: number };
const ROWS: Row[] = [
  { id: 'r1', name: 'Alpha', n: 3 },
  { id: 'r2', name: 'Beta', n: 1 },
];
const COLS: Column<Row>[] = [
  { key: 'name', header: 'Name', value: (r) => r.name, sortable: true },
  { key: 'n', header: 'Count', value: (r) => r.n, render: (r) => <a href={`#n-${r.id}`}>{r.n}</a> },
];

function wrap(el: React.ReactElement, path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <I18nProvider>{el}</I18nProvider>
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe('A11Y-02 · clickable table rows work by keyboard', () => {
  it('each row has an "Open {label}" button that opens it with the keyboard', () => {
    const open = vi.fn();
    wrap(<DataTable rows={ROWS} rowKey={(r) => r.id} columns={COLS} onRowClick={open} searchable={false} />);
    // a named header cell for the extra column (axe: empty-table-header)
    expect(screen.getByRole('columnheader', { name: 'Open' })).toBeTruthy();
    const btn = screen.getByRole('button', { name: 'Open Beta' });
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.getAttribute('type')).toBe('button');
    btn.focus();
    expect(document.activeElement).toBe(btn);
    // a native button turns Enter and Space into a click; keyboard activation arrives here as that click
    fireEvent.keyDown(btn, { key: 'Enter' });
    fireEvent.click(btn);
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(ROWS[1]);
  });

  it('a mouse click on the row still opens it, once, and puts focus on the row\'s button', () => {
    const open = vi.fn();
    wrap(<DataTable rows={ROWS} rowKey={(r) => r.id} columns={COLS} onRowClick={open} searchable={false} />);
    const cell = screen.getByText('Alpha');
    fireEvent.click(cell);
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(ROWS[0]);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open Alpha' }));
    // a control inside a cell keeps its own focus; the row still opens as before
    open.mockClear();
    const link = within(cell.closest('tr')!).getByRole('link');
    link.focus();
    fireEvent.click(link);
    expect(open).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(link);
  });

  it('focus returns to the row\'s button when the drawer it opened closes', async () => {
    function Page() {
      const [sel, setSel] = useState<Row | null>(null);
      return (
        <>
          <DataTable rows={ROWS} rowKey={(r) => r.id} columns={COLS} onRowClick={setSel} searchable={false} />
          <Drawer open={!!sel} onClose={() => setSel(null)} title={sel?.name ?? ''}>
            <p>{sel?.name}</p>
          </Drawer>
        </>
      );
    }
    wrap(<Page />);
    fireEvent.click(screen.getByText('Beta'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open Beta' }));
  });

  it('rowLabel names the button; tables without onRowClick get no extra column', () => {
    wrap(<DataTable rows={ROWS} rowKey={(r) => r.id} columns={COLS} onRowClick={() => undefined} rowLabel={(r) => `${r.name} (${r.n})`} searchable={false} />);
    expect(screen.getByRole('button', { name: 'Open Alpha (3)' })).toBeTruthy();
    cleanup();
    wrap(<DataTable rows={ROWS} rowKey={(r) => r.id} columns={COLS} searchable={false} />);
    expect(screen.queryByRole('columnheader', { name: 'Open' })).toBeNull();
    expect(screen.queryAllByTestId('row-open')).toHaveLength(0);
    expect(screen.getAllByRole('columnheader')).toHaveLength(2);
  });

  it('the label reads in Arabic on Arabic pages', () => {
    expect(translate('en', 'common.openRow', { label: 'Alpha' })).toBe('Open Alpha');
    expect(translate('ar', 'common.openRow', { label: 'ألفا' })).toBe('فتح ألفا');
    wrap(<DataTable rows={[{ id: 'a', name: 'ألفا', n: 1 }]} rowKey={(r) => r.id} columns={COLS} onRowClick={() => undefined} searchable={false} />, '/ar/x');
    expect(screen.getByRole('button', { name: 'فتح ألفا' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'فتح' })).toBeTruthy();
  });
});
