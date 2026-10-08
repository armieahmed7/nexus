// M07 /workforce/emiratization: Emiratization and women's share by entity, job family and level (aggregate only; groups
// under 10 suppressed by rpc.workforceAggregate), public GRI trend with the reconciliation note, watermarked CSV.
import { useMemo } from 'react';
import { Page, Section, Grid, Card, Async, EmptyState, Callout, BarChart, LineChart, DataTable, StatusPill, FilterBar, useFilters, SourceLink, StatTile } from '../../ui';
import { useFormat, useT } from '../../i18n';
import { MIN_GROUP_SIZE } from '../../auth/policy';
import { shareRows, type Dim } from './metrics';
import { ExportButton, KpiTile, MetricTile, PeriodSelect, SR2024, SampleBanner, kpiSeries, useAggregates, useDimLabels, useKpis, usePeriods, useWatermarkedExport } from './shared';

export default function WorkforceEmiratizationPage() {
  const t = useT();
  const f = useFormat();
  const periods = usePeriods();
  const [flt, setFlt] = useFilters({ period: '', dim: 'family', measure: 'emirati', group: '' }, true);
  const period = flt.period || periods.data?.latest || '';
  const agg = useAggregates(period);
  const kpis = useKpis();
  const labels = useDimLabels();
  const exportCsv = useWatermarkedExport();
  const dim = (['family', 'level', 'entity'].includes(flt.dim) ? flt.dim : 'family') as Dim;
  const measure = flt.measure === 'women' ? 'women' : 'emirati';

  const rows = useMemo(() => {
    const all = shareRows(agg.data ?? [], dim, measure);
    return flt.group ? all.filter((r) => r.key === flt.group) : all;
  }, [agg.data, dim, measure, flt.group]);
  const groupOptions = useMemo(() => shareRows(agg.data ?? [], dim, measure).map((r) => ({ value: r.key, label: labels.label(dim, r.key) })), [agg.data, dim, measure, labels]);
  const single = flt.group ? rows[0] : null;
  const metricKey = measure === 'women' ? 'share_women' : 'share_emirati';

  return (
    <Page title={t('m07.routes.workforce-emiratization.title')} intro={t('m07.em.intro')} wide>
      <Section title={t('m07.em.publicTitle')} description={t('m07.em.publicHint')}>
        <Async state={kpis}>
          {(k) => (
            <Grid cols={4}>
              <KpiTile rows={k} metric="emiratization" />
              <KpiTile rows={k} metric="emiratization_senior" />
              <KpiTile rows={k} metric="top_positions_uae" />
              <KpiTile rows={k} metric="women" />
            </Grid>
          )}
        </Async>
        <Grid cols={2}>
          <Card title={t('m07.em.trendTitle')}>
            <Async state={kpis}>
              {(k) => (
                <LineChart
                  title={t('m07.em.trendTitle')}
                  unit="%"
                  yMin={40}
                  yMax={75}
                  series={[
                    { name: t('m07.metric.emiratization'), points: kpiSeries(k, 'emiratization').map((x) => ({ x: x.period, y: x.value })) },
                    { name: t('m07.metric.emiratization_senior'), points: kpiSeries(k, 'emiratization_senior').map((x) => ({ x: x.period, y: x.value })), dashed: true },
                  ]}
                />
              )}
            </Async>
          </Card>
          <Callout tone="sim" title={t('m07.reconcile.title')}>
            {t('m07.reconcile.body')} <SourceLink href={SR2024}>SR2024 p.90</SourceLink>
          </Callout>
        </Grid>
      </Section>

      <Section title={t('m07.em.breakdownTitle', { period })} description={t('m07.em.breakdownHint', { n: MIN_GROUP_SIZE })}>
        <SampleBanner />
        <FilterBar
          value={flt}
          onChange={(v) => setFlt('dim' in v ? { ...v, group: '' } : v)}
          fields={[
            { key: 'dim', label: t('m07.em.dimension'), options: (['family', 'level', 'entity'] as const).map((d) => ({ value: d, label: t(`m07.dim.${d}`) })) },
            { key: 'measure', label: t('m07.em.measure'), options: [{ value: 'emirati', label: t('m07.metric.share_emirati') }, { value: 'women', label: t('m07.metric.share_women') }] },
            { key: 'group', label: t('m07.em.group'), options: groupOptions },
          ]}
          extra={periods.data ? <PeriodSelect periods={periods.data.periods} value={period} onChange={(p) => setFlt({ period: p })} /> : undefined}
        />
        <Async state={agg} empty={<EmptyState title={t('m07.noData')} />}>
          {() =>
            rows.length === 0 ? (
              <EmptyState title={t('m07.noData')} />
            ) : (
              <div className="space-y-4">
                {single && (
                  <div className="max-w-sm" data-testid="m07-single-group">
                    <MetricTile
                      metric={metricKey}
                      label={`${t(`m07.metric.${metricKey}`)} · ${labels.label(dim, single.key)}`}
                      value={single.suppressed ? t('m07.suppressed') : f.pct(single.value)}
                      sub={single.suppressed ? t('common.suppressed') : t('m07.em.ofPeople', { a: f.num(single.numerator), b: f.num(single.denominator) })}
                      source="kafaa_workforce_snapshots"
                      asOf={period}
                      sample
                      tone={single.suppressed ? 'sim' : undefined}
                    />
                  </div>
                )}
                <Grid cols={2}>
                  <Card title={t(`m07.metric.${metricKey}`)}>
                    <div data-testid="m07-em-chart">
                      <BarChart title={t(`m07.metric.${metricKey}`)} unit="%" max={100} data={rows.map((r) => ({ label: labels.label(dim, r.key), value: r.value, suppressed: r.suppressed }))} />
                    </div>
                  </Card>
                  <div className="space-y-3">
                    <StatTile label={t('m07.em.suppressedGroups')} value={f.num(rows.filter((r) => r.suppressed).length)} sub={t('m07.em.suppressedGroupsSub', { n: MIN_GROUP_SIZE })} />
                    <Callout tone="info" title={t('m07.em.howTitle')}>{t(`m07.em.how.${measure}`)}</Callout>
                  </div>
                </Grid>
                <div data-testid="m07-em-table">
                  <DataTable
                    rows={rows}
                    rowKey={(r) => r.key}
                    searchable={false}
                    toolbar={
                      <ExportButton
                        onClick={() =>
                          exportCsv(`emiratization-${dim}-${measure}-${period}`, ['group', 'measure', 'share_pct', 'count', 'headcount', 'note'], rows.map((r) => [labels.label(dim, r.key), measure, r.suppressed ? null : r.value, r.numerator, r.denominator, r.suppressed ? `suppressed (<${MIN_GROUP_SIZE})` : '']))
                        }
                      />
                    }
                    columns={[
                      { key: 'group', header: t(`m07.dim.${dim}`), value: (r) => labels.label(dim, r.key), sortable: true },
                      { key: 'share', header: t(`m07.metric.${metricKey}`), value: (r) => r.value, sortable: true, align: 'end', render: (r) => (r.suppressed ? <StatusPill tone="sim">{t('m07.suppressed')}</StatusPill> : <span className="num">{f.pct(r.value)}</span>) },
                      { key: 'n', header: t(`m07.em.count.${measure}`), value: (r) => r.numerator, align: 'end', render: (r) => (r.suppressed ? '—' : <span className="num">{f.num(r.numerator)}</span>) },
                      { key: 'hc', header: t('m07.metric.headcount'), value: (r) => r.denominator, align: 'end', render: (r) => (r.suppressed ? '—' : <span className="num">{f.num(r.denominator)}</span>) },
                    ]}
                  />
                </div>
              </div>
            )
          }
        </Async>
      </Section>
    </Page>
  );
}
