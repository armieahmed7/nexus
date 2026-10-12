// FS60 /workforce/disclosure/metrics (workforce_strategy R/W/A): the metric library mapped to the ISO 30414 area "Skills, Capabilities and
// Development". Each metric: definition, formula, data source (and the tables it reads), owner function and role card, unit, period basis,
// whether a rise is good, and the benchmarks it follows. The ISO 30414:2025 facts come from kafaa_benchmarks (with source and as-of date).
import { Page, Section, Card, Async, EmptyState, Callout, SimChip, StatusPill, SourceLink, BenchmarkChips, KeyValue } from '../../ui';
import { useBenchmarks } from '../../data/useBenchmarks';
import { L, useFormat, usePick, useT } from '../../i18n';
import { MIN_GROUP } from './disclosure';
import { useHc } from './fs60ui';
import type { Row } from './ui';

export default function DisclosureMetricsPage() {
  const t = useT();
  const hc = useHc();
  return (
    <Page title={t('m35.routes.workforce-disclosure-metrics.title')} intro={t('m35.hcm.intro')} wide
      eyebrow={<div className="flex min-w-0 max-w-full flex-wrap items-center gap-2"><BenchmarkChips feature="FS60" /><SimChip /></div>}
      actions={<L to="/workforce/disclosure" className="btn-ghost btn-sm no-underline">{t('m35.hcm.back')}</L>}>
      <Async state={hc} isEmpty={(d) => d.metrics.length === 0} empty={<EmptyState title={t('m35.hc.noMetrics')} />}>{(d) => <Library metrics={d.metrics} />}</Async>
    </Page>
  );
}

function Library({ metrics }: { metrics: Row[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const b = useBenchmarks();
  const iso = ((b.data ?? []) as unknown as Row[]).find((x) => x.id === 'ISO30414');
  return (
    <div className="space-y-6" data-testid="m35-hcm">
      {iso && (
        <Card title={pick(iso, 'name')} eyebrow={t('m35.hcm.isoEyebrow')}>
          <div className="space-y-2 text-[13.5px]" data-testid="m35-hcm-iso">
            <p>{pick(iso, 'fact')}</p>
            <p className="text-ink-2">{pick(iso, 'borrow')}</p>
            <SourceLink href={String((iso.urls ?? [])[0] ?? '')} date={iso.as_of ? f.date(String(iso.as_of)) : null}>{pick(iso, 'owner')}</SourceLink>
          </div>
        </Card>
      )}
      <Section title={t('m35.hcm.area')} description={t('m35.hcm.areaIntro', { n: f.num(metrics.length) })}>
        <ol className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="m35-hcm-list">
          {metrics.map((m, i) => (
            <li key={m.id} className="card space-y-2 p-4" data-testid="m35-hcm-metric" data-key={m.key}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="num text-ink-3">{f.num(i + 1)}.</span>
                <h3 className="text-[15px] font-semibold">{pick(m, 'name')}</h3>
                <StatusPill tone="info">{t(`m35.hc.unit.${m.unit}`)}</StatusPill>
                <StatusPill tone="neutral">{t(`m35.hc.basis.${m.basis}`)}</StatusPill>
                <StatusPill tone={m.better === 'down' ? 'reserved' : 'ok'}>{t(`m35.hcm.better.${m.better}`)}</StatusPill>
              </div>
              <p className="text-[13px]">{pick(m, 'definition')}</p>
              <KeyValue items={[
                [t('m35.hc.formula'), <span key="f" className="text-[12.5px] text-ink-2">{pick(m, 'formula')}</span>],
                [t('m35.hc.source'), <span key="s" className="text-[12.5px] text-ink-2">{pick(m, 'source')} <span className="font-mono text-[11px] text-ink-3">{(m.source_tables ?? []).join(' · ')}</span></span>],
                [t('m35.hc.owner'), <span key="o" className="text-[12.5px]">{t(`fs.owner.${m.owner_function}`)} · {pick(m, 'owner')}</span>],
                [t('m35.hcm.isoArea'), <span key="a" className="text-[12.5px]">{t('m35.hcm.areaName')}</span>],
              ]} />
              <BenchmarkChips ids={m.benchmark_ids ?? []} />
            </li>
          ))}
        </ol>
      </Section>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Callout tone="info" title={t('m35.hcm.rules.title')}>{t('m35.hcm.rules.body', { n: f.num(MIN_GROUP) })}</Callout>
        <Callout tone="sim" title={t('m35.hc.notAssurance.title')}>{t('m35.hc.notAssurance.body')}</Callout>
      </div>
    </div>
  );
}
