/** Shared query helpers (filter/sort/paginate) used by the LocalBackend and by unit tests. */
import type { Query } from '../types';

function cmp(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

export function matches<T extends Record<string, unknown>>(row: T, q?: Query<T>): boolean {
  if (!q) return true;
  if (q.filter) {
    for (const [k, cond] of Object.entries(q.filter)) {
      const v = row[k];
      if (Array.isArray(cond)) {
        if (!cond.includes(v as never)) return false;
      } else if (cond !== null && typeof cond === 'object') {
        const c = cond as Record<string, unknown>;
        if ('neq' in c && v === c.neq) return false;
        if ('gte' in c && !(cmp(v, c.gte) >= 0)) return false;
        if ('lte' in c && !(cmp(v, c.lte) <= 0)) return false;
        if ('gt' in c && !(cmp(v, c.gt) > 0)) return false;
        if ('lt' in c && !(cmp(v, c.lt) < 0)) return false;
        if ('isNull' in c && (v == null) !== Boolean(c.isNull)) return false;
        if ('ilike' in c && !String(v ?? '').toLowerCase().includes(String(c.ilike).replace(/%/g, '').toLowerCase())) return false;
        if ('contains' in c && !(Array.isArray(v) && v.includes(c.contains))) return false;
      } else if (v !== cond) return false;
    }
  }
  if (q.search && q.search.term.trim()) {
    const t = q.search.term.trim().toLowerCase();
    if (!q.search.columns.some((c) => String(row[c] ?? '').toLowerCase().includes(t))) return false;
  }
  return true;
}

export function applyQuery<T extends Record<string, unknown>>(rows: T[], q?: Query<T>): T[] {
  let out = rows.filter((r) => matches(r, q));
  if (q?.order?.length) {
    out = [...out].sort((a, b) => {
      for (const [col, dir] of q.order!) {
        const c = cmp(a[col], b[col]);
        if (c !== 0) return dir === 'desc' ? -c : c;
      }
      return 0;
    });
  }
  const off = q?.offset ?? 0;
  if (q?.limit != null) out = out.slice(off, off + q.limit);
  else if (off) out = out.slice(off);
  return out;
}

export const newId = (prefix: string) => `${prefix}-${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
