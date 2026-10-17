/**
 * TECH-07: catalogue reads shared across pages for one backend and persona.
 *
 * /ask built Dalil's corpus from about 30 tables on every visit (each read also costs a CORS preflight on Supabase), and the
 * header search and the future-skills answers read several of the same tables again. sharedList() keeps the answer of each
 * distinct read (table + query) per repository and hands every caller its own copy of the rows, like loadBenchmarks() and
 * loadSearchSources() do. A cached read is dropped when the backend reports that its table changed (a write through the
 * repository or an RPC that touched it) or that the persona switched (the backends then emit [] or every table), so a write
 * or a sign-in is seen on the next read. A failed read is not kept: the next caller asks again.
 *
 * Use it only for catalogue tables that every caller of the page reads the same way (published content, reference lists);
 * personal records keep reading through repo.list().
 */
import type { Query, Repository, RowOf, Table } from './types';
import { copyRows, readKey } from './supabase/readPolicy';

interface Entry {
  table: string;
  rows: Promise<unknown[]>;
}
const caches = new WeakMap<Repository, Map<string, Entry>>();

function cacheFor(repo: Repository): Map<string, Entry> {
  let c = caches.get(repo);
  if (!c) {
    const m = new Map<string, Entry>();
    caches.set(repo, m);
    repo.subscribe((changed) => {
      if (changed.length === 0) m.clear();
      else for (const [k, e] of m) if (changed.includes(e.table as Table)) m.delete(k);
    });
    c = m;
  }
  return c;
}

/** repo.list() read once per backend and persona until its table changes; every caller gets its own copy of the rows. */
export function sharedList<K extends Table>(repo: Repository, table: K, q?: Query<RowOf<K>>): Promise<RowOf<K>[]> {
  const c = cacheFor(repo);
  const key = readKey('list', table, q);
  let e = c.get(key);
  if (!e) {
    const entry: Entry = { table, rows: repo.list(table, q) };
    entry.rows.catch(() => {
      if (c.get(key) === entry) c.delete(key);
    });
    c.set(key, entry);
    e = entry;
  }
  return e.rows.then((rows) => copyRows(rows as RowOf<K>[]));
}

/** Number of reads kept for a repository (tests). */
export function sharedReadCount(repo: Repository): number {
  return caches.get(repo)?.size ?? 0;
}
