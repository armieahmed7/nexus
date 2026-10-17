/**
 * FS01: the benchmark registry (kafaa_benchmarks) for <BenchmarkChip>, <BenchmarkChips> and <BenchmarkLine> (src/ui).
 * One read per backend and persona, shared by every chip on a page; refreshed when the table changes or the persona
 * switches (the backend emits [] then). RLS decides what comes back: published rows for everyone, drafts and retired
 * rows for admins, auditors and SAT staff.
 */
import { useQuery, useRepo } from './index';
import type { Repository } from './types';
import type { BenchmarkRow } from '../domain/benchmarks';

const cache = new WeakMap<Repository, Promise<BenchmarkRow[]>>();
const watched = new WeakSet<Repository>();
export function loadBenchmarks(repo: Repository): Promise<BenchmarkRow[]> {
  if (!watched.has(repo)) {
    watched.add(repo);
    repo.subscribe((changed) => {
      if (changed.length === 0 || changed.includes('benchmarks')) cache.delete(repo);
    });
  }
  let p = cache.get(repo);
  if (!p) {
    p = repo.list('benchmarks', { order: [['sort', 'asc']] }).then((rows) => rows as unknown as BenchmarkRow[]);
    p.catch(() => cache.delete(repo));
    cache.set(repo, p);
  }
  return p;
}
export function useBenchmarks() {
  const repo = useRepo();
  return useQuery('benchmarks', () => loadBenchmarks(repo));
}
