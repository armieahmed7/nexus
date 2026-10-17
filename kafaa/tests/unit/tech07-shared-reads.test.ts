/** TECH-07: Dalil's corpus reads its catalogue tables once per backend and persona (src/data/sharedReads.ts). A second build, the
 *  future-skills catalogue and the header search reuse those reads; a table change or a persona switch reads again; failures are
 *  not kept; every caller gets its own rows. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { sharedList, sharedReadCount } from '../../src/data/sharedReads';
import { buildCorpus } from '../../src/modules/m13/dalil/corpus';
import { loadFuturePublic } from '../../src/modules/m13/career/future';
import { loadSearchSources } from '../../src/shell/search/sources';
import type { Table } from '../../src/data/types';

let b: LocalBackend;
let reads: string[];
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
  b.setPersona(null);
  reads = [];
  const list = b.list.bind(b);
  vi.spyOn(b, 'list').mockImplementation(((table: Table, q?: unknown) => {
    reads.push(table);
    return list(table, q as never);
  }) as never);
});
const anon = { signedIn: false, personId: null };

describe('TECH-07: the Dalil corpus is read once per backend and persona', () => {
  it('a second build sends no reads and gives the same corpus', async () => {
    const first = await buildCorpus(b, anon);
    const n = reads.length;
    expect(n).toBeGreaterThanOrEqual(15);
    expect(new Set(reads).size).toBe(n); // one read per table (job_roles shares the ordered read)
    const second = await buildCorpus(b, anon);
    expect(reads.length).toBe(n);
    expect({ ...second, builtAt: '' }).toEqual({ ...first, builtAt: '' });
  });

  it('the future-skills catalogue and the header search reuse the corpus reads', async () => {
    await buildCorpus(b, anon);
    const before = reads.length;
    await loadFuturePublic(b, false);
    const future = reads.slice(before);
    expect(future).not.toContain('job_roles'); // ordered job_roles read is shared with the corpus
    expect(future).not.toContain('courses');
    const mid = reads.length;
    await loadSearchSources(b);
    const search = reads.slice(mid);
    for (const t of ['talent_programmes', 'organisations', 'glossary']) expect(search).not.toContain(t);
  });

  it('a change to a table reads that table again, and only that table', async () => {
    await buildCorpus(b, anon);
    const n = reads.length;
    b.changed(['faqs'] as Table[]);
    await buildCorpus(b, anon);
    expect(reads.slice(n)).toEqual(['faqs']);
  });

  it('a persona switch reads everything again (RLS may return other rows)', async () => {
    await buildCorpus(b, anon);
    const n = reads.length;
    b.setPersona('k-admin');
    const staff = await buildCorpus(b, { signedIn: true, personId: 'p-k-admin' });
    expect(reads.slice(n)).toEqual(expect.arrayContaining(['corpus_docs', 'job_roles', 'faqs', 'refusal_policies']));
    expect(staff.docs.some((d) => d.kind === 'internal')).toBe(true);
  });

  it('job_roles: the corpus keeps published roles only, as the server filter did', async () => {
    const c = await buildCorpus(b, anon);
    const published = (await b.list('job_roles', { filter: { status: 'published' } })).map((r) => `cd-role-${r.id}`).sort();
    expect(c.docs.filter((d) => d.kind === 'role').map((d) => d.id).sort()).toEqual(published);
  });
});

describe('TECH-07: sharedList', () => {
  it('a failed read is not kept: the next caller asks again', async () => {
    const spy = vi.mocked(b.list);
    spy.mockImplementationOnce((() => Promise.reject(new Error('offline'))) as never);
    await expect(sharedList(b, 'faqs')).rejects.toThrow('offline');
    expect(sharedReadCount(b)).toBe(0);
    expect((await sharedList(b, 'faqs')).length).toBeGreaterThan(0);
    expect(sharedReadCount(b)).toBe(1);
  });

  it('every caller gets its own rows (decorating one copy leaves the next untouched)', async () => {
    const a = await sharedList(b, 'faqs');
    (a[0] as unknown as Record<string, unknown>).q_en = 'changed';
    a.length = 0;
    const again = await sharedList(b, 'faqs');
    expect(again.length).toBeGreaterThan(0);
    expect(again[0].q_en).not.toBe('changed');
  });

  it('different queries on one table are separate reads', async () => {
    await sharedList(b, 'job_roles');
    await sharedList(b, 'job_roles', { order: [['sort', 'asc']] });
    await sharedList(b, 'job_roles');
    expect(reads.filter((t) => t === 'job_roles')).toHaveLength(2);
  });
});
