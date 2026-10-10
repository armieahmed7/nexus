/**
 * FS01 (future skills, wave A): which international benchmark a screen follows, and benchmark lines on scores.
 *   <BenchmarkChips feature="FS07" />            the benchmarks of an FS card (PLAN.md), each a chip that opens a drawer
 *   <BenchmarkChips ids={['ESCO', 'SFIA9']} />   any list of registry ids
 *   <BenchmarkChip id="OECD-PIAAC" />            one chip: short name and year, opens the drawer (owner, year, sources with
 *                                                as-of date, the published figures, what Kafa'a borrows, the FS cards using it)
 *   <BenchmarkLine value={238} max={500} label="Your adaptive problem solving score"
 *     lines={[{ kind: 'enec', label: 'ENEC average', value: 244 }]} benchmark={{ id: 'OECD-PIAAC', figure: 'aps_oecd_average' }} />
 * Numbers and years follow the reader's digit setting (useFormat); positions use logical insets, so RTL mirrors them.
 * Rows come from kafaa_benchmarks (src/data/useBenchmarks.ts): every figure is a sourced row, never typed into copy.
 */
import { useState, type ReactNode } from 'react';
import { useBenchmarks } from '../data/useBenchmarks';
import { useFormat, usePick, useT } from '../i18n';
import { figuresOf, hostOf, yearParts, type BenchmarkFigure, type BenchmarkRow } from '../domain/benchmarks';
import { FEATURE_BENCHMARKS } from '../domain/taxonomy';
import { Drawer } from './Modal';
import { SourceLink, StatusPill } from './Page';
import { Icon } from './Icon';

/** "2025", "2022 / 2025", "2024–2025", "current (read 2026)": years are numbers, so digits follow the reader's setting. */
export function useBenchmarkYear() {
  const t = useT();
  const f = useFormat();
  return (b: Pick<BenchmarkRow, 'year_from' | 'year_to' | 'year_kind'>) => {
    const y = yearParts(b);
    const n = (v: number | null) => (v == null ? '' : f.num(v, { useGrouping: false }));
    return t(`fs.bm.year.${y.to == null && (y.kind === 'range' || y.kind === 'editions') ? 'single' : y.kind}`, { from: n(y.from), to: n(y.to) });
  };
}
/** Short display name: the benchmark name up to its first bracket, colon or semicolon. */
const shortName = (name: string) => name.split(/\s[(:;]|[:;]\s/)[0].trim();

export function useFigureText() {
  const f = useFormat();
  return (fig: Pick<BenchmarkFigure, 'value' | 'unit' | 'scale_max'>) =>
    fig.unit === 'pct' ? f.pct(fig.value, 0) : fig.unit === 'score' && fig.scale_max ? `${f.num(fig.value)} / ${f.num(fig.scale_max)}` : f.num(fig.value);
}

export function BenchmarkChip({ id, row: given }: { id: string; row?: BenchmarkRow }) {
  const t = useT();
  const pick = usePick();
  const year = useBenchmarkYear();
  const q = useBenchmarks();
  const [open, setOpen] = useState(false);
  const row = given ?? q.data?.find((b) => b.id === id);
  if (!row) {
    return (
      <span className="chip border-line bg-sunken text-ink-3" data-testid={`benchmark-chip-${id}`} title={q.loading ? undefined : t('fs.bm.unknown', { id })}>
        <bdi dir="ltr">{id}</bdi>
      </span>
    );
  }
  const name = pick(row, 'name');
  return (
    <>
      <button
        type="button"
        className="chip max-w-full border-accent/30 bg-accent-soft text-eyebrow hover:border-accent"
        onClick={() => setOpen(true)}
        title={name}
        aria-haspopup="dialog"
        aria-label={t('fs.bm.chip.aria', { name, year: year(row) })}
        data-testid={`benchmark-chip-${id}`}
      >
        <Icon name="book" size={12} />
        <span className="max-w-[15rem] truncate">{shortName(name)}</span>
        <span className="num text-ink-3">{year(row)}</span>
      </button>
      <BenchmarkDrawer row={row} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function BenchmarkChips({ ids, feature, label }: { ids?: string[]; feature?: string; label?: ReactNode }) {
  const t = useT();
  const list = [...new Set([...(ids ?? []), ...(feature ? FEATURE_BENCHMARKS[feature] ?? [] : [])])];
  if (!list.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5" data-testid="benchmark-chips">
      <span className="caps me-1">{label ?? t('fs.bm.follows')}</span>
      {list.map((id) => (
        <BenchmarkChip key={id} id={id} />
      ))}
    </div>
  );
}

export function BenchmarkDrawer({ row, open, onClose }: { row: BenchmarkRow; open: boolean; onClose: () => void }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const year = useBenchmarkYear();
  const fig = useFigureText();
  const figures = figuresOf(row);
  return (
    <Drawer open={open} onClose={onClose} title={pick(row, 'name')}>
      <div className="space-y-4 text-[14px]" data-testid="benchmark-drawer">
        <div className="flex flex-wrap gap-1.5">
          <StatusPill tone="accent">{t(`fs.bm.category.${row.category}`)}</StatusPill>
          {row.status !== 'published' && <StatusPill status={row.status}>{t(`fs.bm.status.${row.status}`)}</StatusPill>}
          <StatusPill tone="neutral">
            <bdi dir="ltr">{row.id}</bdi>
          </StatusPill>
        </div>
        <dl className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] gap-x-3 gap-y-1.5">
          <dt className="text-ink-3">{t('fs.bm.owner')}</dt>
          <dd>{pick(row, 'owner')}</dd>
          <dt className="text-ink-3">{t('fs.bm.where')}</dt>
          <dd>{pick(row, 'country')}</dd>
          <dt className="text-ink-3">{t('fs.bm.year.label')}</dt>
          <dd className="num">{year(row)}</dd>
          <dt className="text-ink-3">{t('fs.bm.asOf')}</dt>
          <dd>{f.date(row.as_of)}</dd>
        </dl>
        <section>
          <h3 className="caps mb-1">{t('fs.bm.fact')}</h3>
          <p className="text-ink-2">{pick(row, 'fact')}</p>
        </section>
        {figures.length > 0 && (
          <section>
            <h3 className="caps mb-2">{t('fs.bm.figures')}</h3>
            <ul className="space-y-3">
              {figures.map((x) => (
                <li key={x.key} data-testid={`benchmark-figure-${x.key}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-ink-2">{pick(x as unknown as Record<string, unknown>, 'label')}</span>
                    <span className="num font-semibold">{fig(x)}</span>
                  </div>
                  {(x.unit === 'pct' || (x.unit === 'score' && x.scale_max)) && (
                    <BenchmarkLine max={x.unit === 'pct' ? 100 : x.scale_max!} unit={x.unit} label={pick(x as unknown as Record<string, unknown>, 'label')} lines={[{ kind: 'benchmark', label: shortName(pick(row, 'name')), value: x.value }]} compact />
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
        <section>
          <h3 className="caps mb-1">{t('fs.bm.borrow')}</h3>
          <p className="text-ink-2">{pick(row, 'borrow')}</p>
        </section>
        <section>
          <h3 className="caps mb-1">{t('fs.bm.sources')}</h3>
          <ul className="space-y-1">
            {row.urls.map((u) => (
              <li key={u}>
                <SourceLink href={u} date={f.date(row.as_of)}>
                  <bdi dir="ltr">{hostOf(u)}</bdi>
                </SourceLink>
              </li>
            ))}
          </ul>
        </section>
        {row.feature_ids?.length > 0 && (
          <section>
            <h3 className="caps mb-1">{t('fs.bm.usedBy', { n: f.num(row.feature_ids.length) })}</h3>
            <div className="flex flex-wrap gap-1">
              {row.feature_ids.map((id) => (
                <span key={id} className="chip border-line bg-sunken text-ink-2">
                  <bdi dir="ltr">{id}</bdi>
                </span>
              ))}
            </div>
          </section>
        )}
        <p className="rounded-card border border-line bg-sunken p-3 text-[12.5px] text-ink-3">{t('fs.bm.notEndorsed')}</p>
      </div>
    </Drawer>
  );
}

export type BenchmarkLineKind = 'benchmark' | 'enec' | 'target';
export interface BenchmarkLineMark {
  kind: BenchmarkLineKind;
  label: string;
  value: number;
}
const MARK: Record<BenchmarkLineKind, string> = { benchmark: 'bg-accent', enec: 'bg-[rgb(var(--sky))]', target: 'bg-[rgb(var(--ok))]' };
/**
 * A score on a scale with labelled comparison lines (OECD average, ENEC average, role target). The person's own value is
 * the filled bar; each line is a marker with its label. `benchmark` adds the line for a registry figure (with its chip).
 * A screen-reader table lists every value.
 */
export function BenchmarkLine({
  value,
  min = 0,
  max,
  label,
  unit = 'score',
  lines = [],
  benchmark,
  compact,
}: {
  value?: number | null;
  min?: number;
  max: number;
  label: string;
  unit?: 'pct' | 'score' | 'count';
  lines?: BenchmarkLineMark[];
  benchmark?: { id: string; figure: string };
  compact?: boolean;
}) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const q = useBenchmarks();
  const row = benchmark ? q.data?.find((b) => b.id === benchmark.id) : undefined;
  const fig = row ? figuresOf(row).find((x) => x.key === benchmark!.figure) : undefined;
  const all: BenchmarkLineMark[] = [...lines, ...(fig && row ? [{ kind: 'benchmark' as const, label: pick(fig as unknown as Record<string, unknown>, 'label'), value: fig.value }] : [])];
  const span = Math.max(1e-9, max - min);
  const pos = (v: number) => Math.max(0, Math.min(100, ((v - min) / span) * 100));
  const fmt = (v: number) => (unit === 'pct' ? f.pct(v, 0) : f.num(v));
  return (
    <figure className={compact ? 'mt-1' : 'space-y-1.5'} data-testid="benchmark-line">
      {!compact && (
        <figcaption className="flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
          <span className="font-semibold">{label}</span>
          {value != null && <span className="num font-semibold">{fmt(value)}</span>}
        </figcaption>
      )}
      <div className="relative h-2.5 w-full rounded-full bg-sunken" aria-hidden="true">
        {value != null && <div className="absolute inset-y-0 start-0 rounded-full bg-[rgb(var(--accent))] opacity-80" style={{ width: `${pos(value)}%` }} />}
        {all.map((m, i) => (
          <span key={`${m.kind}-${i}`} className={`absolute -top-1 h-[18px] w-[3px] rounded-sm ${MARK[m.kind]}`} style={{ insetInlineStart: `calc(${pos(m.value)}% - 1.5px)` }} data-kind={m.kind} />
        ))}
      </div>
      {!compact && (
        <div className="flex justify-between text-[11px] text-ink-3" aria-hidden="true">
          <span className="num">{fmt(min)}</span>
          <span className="num">{fmt(max)}</span>
        </div>
      )}
      {all.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-2" aria-hidden="true">
          {all.map((m, i) => (
            <li key={`${m.kind}-l-${i}`} className="inline-flex items-center gap-1.5">
              <span className={`inline-block h-3 w-[3px] rounded-sm ${MARK[m.kind]}`} />
              <span>{m.label}</span>
              <span className="num font-semibold">{fmt(m.value)}</span>
            </li>
          ))}
        </ul>
      )}
      {fig && row && !compact && (
        <div className="pt-0.5">
          <BenchmarkChip id={row.id} row={row} />
        </div>
      )}
      <div className="sr-only">
        <table>
          <caption>{label}</caption>
          <tbody>
            {value != null && (
              <tr>
                <th scope="row">{t('fs.bm.line.value')}</th>
                <td>{fmt(value)}</td>
              </tr>
            )}
            {all.map((m, i) => (
              <tr key={`${m.kind}-sr-${i}`}>
                <th scope="row">{`${t(`fs.bm.line.${m.kind}`)}: ${m.label}`}</th>
                <td>{fmt(m.value)}</td>
              </tr>
            ))}
            <tr>
              <th scope="row">{t('fs.bm.line.scale')}</th>
              <td>{`${fmt(min)} – ${fmt(max)}`}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </figure>
  );
}
