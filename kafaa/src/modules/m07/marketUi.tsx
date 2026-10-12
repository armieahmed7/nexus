// M07 · FS53 External benchmark lines, kept apart from measured numbers: the React pieces. A market statistic is always drawn as a DASHED
// line labelled "Market statistic" with its source link and as-of date; a number measured at ENEC is always a SOLID bar labelled
// "Measured at ENEC (SIMULATED)" with the SIMULATED chip. Label and line pattern differ, so the two read apart without colour. The
// pair only orders the two values (position()); nothing here adds, subtracts or averages a market value with an internal one.
import type { ReactNode } from 'react';
import { useRepo, useQuery } from '../../data';
import type { Table } from '../../data/types';
import { BenchmarkChip, BenchmarkChips, Card, EmptyState, SimChip, SourceLink, Icon, Async } from '../../ui';
import { useFormat, usePick, useT } from '../../i18n';
import { hostOf } from '../../domain/benchmarks';
import { useSession } from '../../auth/session';
import { LINE_STYLE, heldValues, marketValues, measuresFrom, pairScale, position, type BenchmarkValueRow, type Dashboard, type MarketValue, type MeasureKey, type MeasuredValue } from './market';

export function useBenchmarkValues() {
  const repo = useRepo();
  return useQuery('benchmark_values' as Table, () => repo.list('benchmark_values' as never, { order: [['sort', 'asc']] }) as unknown as Promise<BenchmarkValueRow[]>);
}

/** The two stylings side by side: the legend every market panel carries. */
export function MarketLegend() {
  const t = useT();
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-2" data-testid="m07-mk-legend">
      <span className="inline-flex items-center gap-1.5" data-pattern={LINE_STYLE.measured.pattern}>
        <span aria-hidden className="inline-block h-2.5 w-6 rounded-sm bg-[rgb(var(--accent))]" />
        <span className="font-semibold">{t(LINE_STYLE.measured.label)}</span>
        <span className="text-ink-3">{t('m07.mk.measuredHint')}</span>
      </span>
      <span className="inline-flex items-center gap-1.5" data-pattern={LINE_STYLE.market.pattern}>
        <span aria-hidden className="inline-block h-4 w-0 border-s-2 border-dashed border-ink" />
        <span className="font-semibold">{t(LINE_STYLE.market.label)}</span>
        <span className="text-ink-3">{t('m07.mk.marketHint')}</span>
      </span>
    </p>
  );
}

/** One market line beside one measured value on a shared percentage scale. */
export function MarketPair({ row, m, x, basis }: { row: BenchmarkValueRow; m: MarketValue; x: MeasuredValue; basis?: ReactNode }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const max = pairScale(m.value, x.value);
  const pos = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  const where = position(m, x);
  const pct = (v: number) => f.pct(v, Number.isInteger(v) ? 0 : 1);
  return (
    <figure className="space-y-2" data-testid={`m07-mk-pair-${m.metric}`}>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[13.5px] font-semibold">{t(`m07.mk.measure.${x.metric}.title`)}</span>
        <span className={`chip ${where === 'above' || where === 'below' || where === 'level' ? 'border-line bg-sunken text-ink-2' : 'border-line bg-sunken text-ink-3'}`} data-testid="m07-mk-position">
          {t(`m07.mk.position.${where}`)}
        </span>
      </figcaption>
      <div className="relative h-7 rounded bg-sunken" aria-hidden="true">
        {x.value != null && (
          <span className="absolute inset-y-1.5 start-0 rounded-e bg-[rgb(var(--accent))]" style={{ width: pos(x.value) }} data-pattern={LINE_STYLE.measured.pattern} data-kind="measured" />
        )}
        <span className="absolute -top-1 -bottom-1 w-0 border-s-2 border-dashed border-ink" style={{ insetInlineStart: pos(m.value) }} data-pattern={LINE_STYLE.market.pattern} data-kind="market" />
      </div>
      <div className="flex justify-between text-[11px] text-ink-3" aria-hidden="true"><span className="num">{pct(0)}</span><span className="num">{pct(max)}</span></div>
      <dl className="grid grid-cols-1 gap-2 text-[12.5px] sm:grid-cols-2">
        <div className="rounded border border-line p-2" data-kind="measured">
          <dt className="flex flex-wrap items-center gap-1.5">
            <span aria-hidden className="inline-block h-2.5 w-5 rounded-sm bg-[rgb(var(--accent))]" />
            <span className="font-semibold">{t(LINE_STYLE.measured.label)}</span>
            <SimChip />
          </dt>
          <dd className="mt-1">
            <span className="num text-[18px] font-semibold">{x.suppressed || x.value == null ? t('m07.so.suppressed') : pct(x.value)}</span>
            <span className="block text-ink-3">{t(`m07.mk.measure.${x.metric}.what`)}{basis ? <> · {basis}</> : null}</span>
          </dd>
        </div>
        <div className="rounded border border-dashed border-ink-3 p-2" data-kind="market">
          <dt className="flex flex-wrap items-center gap-1.5">
            <span aria-hidden className="inline-block h-4 w-0 border-s-2 border-dashed border-ink" />
            <span className="font-semibold">{t(LINE_STYLE.market.label)}</span>
            <BenchmarkChip id={row.benchmark_id} />
          </dt>
          <dd className="mt-1">
            <span className="num text-[18px] font-semibold">{pct(m.value)}</span>
            <span className="block text-ink-3">{pick(row as unknown as Record<string, unknown>, 'label')}</span>
            <SourceLink href={row.source_url} date={t('m07.mk.asOf', { date: f.date(row.as_of) })}><bdi dir="ltr">{hostOf(row.source_url)}</bdi></SourceLink>
          </dd>
        </div>
      </dl>
      {(row.note_en || row.note_ar) && <p className="text-[12px] text-ink-3">{pick(row as unknown as Record<string, unknown>, 'note')}</p>}
      <div className="sr-only">
        <table>
          <caption>{t(`m07.mk.measure.${x.metric}.title`)}</caption>
          <tbody>
            <tr><th scope="row">{`${t(LINE_STYLE.measured.label)} (${t('m07.mk.solid')})`}</th><td>{x.value == null ? t('m07.so.suppressed') : pct(x.value)}</td></tr>
            <tr><th scope="row">{`${t(LINE_STYLE.market.label)} (${t('m07.mk.dashed')}): ${pick(row as unknown as Record<string, unknown>, 'label')}`}</th><td>{pct(m.value)}</td></tr>
          </tbody>
        </table>
      </div>
    </figure>
  );
}

/** A market statistic with no ENEC counterpart (a count): context only, never compared. */
export function MarketContext({ row }: { row: BenchmarkValueRow }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  return (
    <div className="rounded-card border-2 border-dashed border-ink-3 p-3" data-kind="market" data-pattern={LINE_STYLE.market.pattern} data-testid={`m07-mk-context-${row.metric}`}>
      <p className="flex flex-wrap items-center gap-1.5 text-[12px]">
        <span aria-hidden className="inline-block h-4 w-0 border-s-2 border-dashed border-ink" />
        <span className="font-semibold">{t(LINE_STYLE.market.label)}</span>
        <BenchmarkChip id={row.benchmark_id} />
      </p>
      <p className="num mt-1 text-[22px] font-semibold">{row.unit === 'pct' ? f.pct(row.value, 0) : f.num(row.value)}</p>
      <p className="text-[13px] text-ink-2">{pick(row as unknown as Record<string, unknown>, 'label')}</p>
      <p className="mt-1 text-[12px] text-ink-3">{pick(row as unknown as Record<string, unknown>, 'note')}</p>
      <SourceLink href={row.source_url} date={t('m07.mk.asOf', { date: f.date(row.as_of) })}><bdi dir="ltr">{hostOf(row.source_url)}</bdi></SourceLink>
    </div>
  );
}

/** Figures held back until verified: benchmark, label and reason, never the value. */
export function HeldList({ rows }: { rows: BenchmarkValueRow[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  if (!rows.length) return null;
  return (
    <details className="rounded-card border border-line bg-sunken p-3 text-[13px]" data-testid="m07-mk-held">
      <summary className="cursor-pointer font-semibold">{t('m07.mk.heldTitle', { n: f.num(rows.length) })}</summary>
      <p className="mt-2 text-[12.5px] text-ink-2">{t('m07.mk.heldBody')}</p>
      <ul className="mt-2 space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-col gap-1 border-t border-line pt-2" data-testid={`m07-mk-held-${r.id}`}>
            <span className="flex flex-wrap items-center gap-1.5">
              <BenchmarkChip id={r.benchmark_id} />
              <span className="font-semibold">{pick(r as unknown as Record<string, unknown>, 'label')}</span>
              <span className="chip border-line bg-panel text-ink-3">{t(`m07.mk.tier.${r.verification}`)}</span>
            </span>
            <span className="text-ink-2">{pick(r as unknown as Record<string, unknown>, 'held_reason')}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * The FS53 panel for one workforce dashboard: market lines beside measured values (pairs), market context (counts) and the held list.
 * `measures` comes from measuresFrom() (outlook and automation profile only); `basis` gives each measure's basis text.
 */
export function MarketPanel({ dashboard, measures, basis, note }: { dashboard: Dashboard; measures: Record<MeasureKey, MeasuredValue>; basis?: Partial<Record<MeasureKey, ReactNode>>; note?: ReactNode }) {
  const t = useT();
  const q = useBenchmarkValues();
  return (
    <Card title={t('m07.mk.title')} eyebrow={t(`m07.mk.eyebrow.${dashboard}`)} actions={<span className="flex items-center gap-2"><Icon name="globe" size={14} /><SimChip /></span>}>
      <div className="space-y-4" data-testid={`m07-mk-panel-${dashboard}`}>
        <BenchmarkChips feature="FS53" />
        <MarketLegend />
        <Async state={q} empty={<EmptyState title={t('m07.mk.none')} />}>
          {(rows) => {
            const lines = marketValues(rows, dashboard);
            const pairs = lines.filter((m) => m.compare_to);
            const context = lines.filter((m) => !m.compare_to);
            return (
              <div className="space-y-4">
                {pairs.length > 0 && (
                  <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                    {pairs.map((m) => <MarketPair key={m.id} row={rows.find((r) => r.id === m.id)!} m={m} x={measures[m.compare_to!]} basis={basis?.[m.compare_to!]} />)}
                  </div>
                )}
                {context.length > 0 && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {context.map((m) => <MarketContext key={m.id} row={rows.find((r) => r.id === m.id)!} />)}
                  </div>
                )}
                <HeldList rows={heldValues(rows)} />
              </div>
            );
          }}
        </Async>
        <p className="text-[12px] text-ink-3">{note ?? t('m07.mk.rule')}</p>
      </div>
    </Card>
  );
}

/**
 * The FS53 panel fed by the latest released outlook (line managers read released outlooks; HR and auditors also get the FS06 task share
 * from rpc.outlookAutomation). Used on the workforce overview and, for line managers, on the outlook page.
 */
export function ReleasedMarketPanel({ dashboard }: { dashboard: Dashboard }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const s = useSession();
  const hr = s.hasRole('hr_director', 'hr_analyst', 'auditor');
  const rel = useQuery('skill_outlooks' as Table, async () => {
    const r = await repo.rpc.releasedOutlooks();
    return r.ok && r.data ? r.data : [];
  });
  const auto = useQuery(['jta_tasks', 'jta_task_skills'] as unknown as Table[], async () => {
    if (!hr) return null;
    const r = await repo.rpc.outlookAutomation({});
    return r.ok && r.data ? r.data : null;
  }, [hr]);
  const latest = rel.data?.[0] ?? null;
  const measures = measuresFrom(latest?.results ?? null, latest?.results.automation ?? auto.data ?? null);
  return (
    <MarketPanel dashboard={dashboard} measures={measures}
      basis={{
        demand_growth_2030: latest ? t('m07.mk.basisReleased', { name: latest.name, date: f.date(latest.released_at) }) : t('m07.mk.noReleased'),
        digital_holders: latest ? t('m07.mk.basisSample', { n: f.num(measures.digital_holders.basis ?? 0) }) : t('m07.mk.noReleased'),
        ai_task_share: measures.ai_task_share.suppressed ? t('m07.mk.basisHrOnly') : t('m07.mk.basisTasks', { n: f.num(measures.ai_task_share.basis ?? 0) }),
      }}
      note={t('m07.mk.ruleReleased')} />
  );
}
