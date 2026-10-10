// [FS04] Benchmark ties for M11 future-skills pages. Since the wave-A integration they render the FS01 shared chips
// (src/ui/Benchmark.tsx, rows from kafaa_benchmarks): each chip names the benchmark and year and opens the registry drawer
// (owner, sources with as-of date, published figures, what Kafa'a borrows). The ids are the PLAN section 4 ids.
import { BenchmarkChips as SharedBenchmarkChips } from '../../ui';
import { useT } from '../../i18n';

/** Chips naming the international benchmarks a page follows (FS01 <BenchmarkChip>s). */
export function BenchmarkChips({ ids }: { ids: readonly string[] }) {
  const t = useT();
  return (
    <div data-testid="m11-benchmarks">
      <SharedBenchmarkChips ids={[...ids]} label={t('m11.bench.follows')} />
    </div>
  );
}
