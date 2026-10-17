/**
 * DataTable: client-side sort, text filter, pagination and CSV export.
 *   <DataTable rows={rows} rowKey={(r) => r.id} columns={[
 *     { key: 'name', header: t('...'), value: (r) => pick(r,'title'), sortable: true },
 *     { key: 'status', header: '...', value: (r) => r.status, render: (r) => <StatusPill status={r.status} /> },
 *   ]} csvName="roles" />
 * `value` drives sort, search and CSV; `render` only changes display. CSV never includes columns marked csv: false.
 * With onRowClick, each row also ends in an "Open {label}" button (A11Y-02) so the row opens by keyboard and screen readers;
 * the label is `rowLabel(row)`, else the first column's value. A mouse click on the row moves focus to that button first, so a
 * drawer or dialog the row opens returns focus to the row when it closes.
 */
import { useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { Icon } from './Icon';
import { ScrollRegion } from './ScrollRegion';
import { useFormat, useT } from '../i18n';

export interface Column<T> {
  key: string;
  header: ReactNode;
  value?: (row: T) => string | number | null | undefined;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  csv?: boolean;
  align?: 'start' | 'end' | 'center';
  width?: string;
}
export interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  pageSize?: number;
  searchable?: boolean;
  csvName?: string;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  onRowClick?: (row: T) => void;
  /** Names the row in its "Open {label}" button (default: the first column's value). */
  rowLabel?: (row: T) => string;
  empty?: ReactNode;
  toolbar?: ReactNode;
  caption?: string;
  dense?: boolean;
}

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v);
  // Neutralise spreadsheet formulas and quote everything.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}
export function toCsv<T>(rows: T[], columns: Column<T>[]): string {
  const cols = columns.filter((c) => c.csv !== false && c.value);
  const head = cols.map((c) => csvEscape(typeof c.header === 'string' ? c.header : c.key)).join(',');
  return [head, ...rows.map((r) => cols.map((c) => csvEscape(c.value!(r))).join(','))].join('\r\n');
}
export function downloadText(name: string, text: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿' + text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A click that lands on a control inside a cell (a link, a button, a field) belongs to that control, not to the row's open button. */
const INTERACTIVE = 'a[href],button,input,select,textarea,label,summary,[role="button"],[role="link"],[tabindex]';

export function DataTable<T>({ rows, columns, rowKey, pageSize = 20, searchable = true, csvName, initialSort, onRowClick, rowLabel, empty, toolbar, caption, dense }: DataTableProps<T>) {
  const t = useT();
  const f = useFormat();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => columns.some((c) => c.value && String(c.value(r) ?? '').toLowerCase().includes(term)));
  }, [rows, columns, q]);
  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.value) return filtered;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const x = col.value!(a);
      const y = col.value!(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * dir;
    });
  }, [filtered, sort, columns]);
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const cur = Math.min(page, pages - 1);
  const visible = sorted.slice(cur * pageSize, cur * pageSize + pageSize);

  const toggleSort = (key: string) => setSort((s) => (s?.key === key ? (s.dir === 'asc' ? { key, dir: 'desc' } : null) : { key, dir: 'asc' }));
  const alignCls = (a?: string) => (a === 'end' ? 'text-end' : a === 'center' ? 'text-center' : 'text-start');
  const labelCol = columns.find((c) => c.value);
  const labelOf = (r: T) => (rowLabel ? rowLabel(r) : String(labelCol?.value?.(r) ?? rowKey(r)));
  const rowClick = (r: T) => (e: MouseEvent<HTMLTableRowElement>) => {
    const hit = (e.target as Element).closest?.(INTERACTIVE);
    if (!hit || !e.currentTarget.contains(hit)) e.currentTarget.querySelector<HTMLButtonElement>('[data-row-open]')?.focus({ preventScroll: true });
    onRowClick!(r);
  };

  return (
    <div className="card overflow-hidden" data-testid="data-table">
      {(searchable || csvName || toolbar) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-2.5">
          {searchable && (
            <label className="relative min-w-[200px] flex-1">
              <span className="sr-only">{t('common.filterRows')}</span>
              <Icon name="search" size={14} className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
              <input
                className="input h-8 ps-8 text-[13px]"
                value={q}
                placeholder={t('common.filterRows')}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(0);
                }}
              />
            </label>
          )}
          {toolbar}
          <div className="ms-auto flex items-center gap-2 text-[12px] text-ink-3">
            <span>{t('common.rowsCount', { n: f.num(sorted.length) })}</span>
            {csvName && (
              <button className="btn-outline btn-sm" onClick={() => downloadText(`${csvName}.csv`, toCsv(sorted, columns))}>
                <Icon name="download" size={14} />
                {t('common.exportCsv')}
              </button>
            )}
          </div>
        </div>
      )}
      <ScrollRegion label={caption}>
        <table className="table-base w-full border-collapse text-[13px]">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="bg-raised">
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={alignCls(c.align)} style={c.width ? { width: c.width } : undefined} aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                  {c.sortable && c.value ? (
                    <button className="inline-flex items-center gap-1 uppercase hover:text-ink" onClick={() => toggleSort(c.key)}>
                      {c.header}
                      <Icon name="sort" size={12} className={sort?.key === c.key ? 'text-accent' : 'opacity-40'} />
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
              {onRowClick && (
                <th scope="col" className="w-10">
                  <span className="sr-only">{t('common.openRowHeader')}</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (onRowClick ? 1 : 0)} className="py-8 text-center text-ink-3">
                  {empty ?? t('common.noRows')}
                </td>
              </tr>
            ) : (
              visible.map((r) => (
                <tr key={rowKey(r)} className={onRowClick ? 'cursor-pointer hover:bg-sunken' : ''} onClick={onRowClick ? rowClick(r) : undefined}>
                  {columns.map((c) => (
                    <td key={c.key} className={`${alignCls(c.align)} ${dense ? '!py-1.5' : ''}`}>
                      {c.render ? c.render(r) : (c.value?.(r) ?? '—')}
                    </td>
                  ))}
                  {onRowClick && (
                    <td className={`text-end ${dense ? '!py-1.5' : ''}`}>
                      <button
                        type="button"
                        className="btn-ghost btn-sm !px-1.5"
                        data-row-open
                        data-testid="row-open"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRowClick(r);
                        }}
                      >
                        <Icon name="chevron" size={14} />
                        <span className="sr-only">{t('common.openRow', { label: labelOf(r) })}</span>
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </ScrollRegion>
      {pages > 1 && (
        <div className="flex items-center justify-between border-t border-line p-2 text-[12px] text-ink-2">
          <span>{t('common.pageOf', { page: f.num(cur + 1), pages: f.num(pages) })}</span>
          <div className="flex gap-1">
            <button className="btn-outline btn-sm" disabled={cur === 0} onClick={() => setPage(cur - 1)}>
              {t('common.prev')}
            </button>
            <button className="btn-outline btn-sm" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>
              {t('common.next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
