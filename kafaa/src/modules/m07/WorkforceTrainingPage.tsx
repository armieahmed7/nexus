// M07 /workforce/training: training hours (public GRI series and per-family demo snapshot), continuing-training populations,
// completions by course (aggregate, cells under 10 suppressed) and sample quality indicators.
import { useMemo, useState } from 'react';
import { useRepo, useQuery } from '../../data';
import { Page, Section, Grid, Card, Async, EmptyState, BarChart, LineChart, DataTable, StatusPill, SimChip } from '../../ui';
import { useFormat, usePick, useT } from '../../i18n';
import { MIN_GROUP_SIZE } from '../../auth/policy';
import { suppress } from '../../domain/rules';
import { shareRows } from './metrics';
import { DefLink, ExportButton, KpiTile, PeriodSelect, SampleBanner, kpiSeries, useAggregates, useDimLabels, useKpis, usePeriods, useWatermarkedExport } from './shared';

export default function WorkforceTrainingPage() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const kpis = useKpis();
  const periods = usePeriods();
  const [period, setPeriod] = useState('');
  const cur = period || periods.data?.latest || '';
  const agg = useAggregates(cur);
  const labels = useDimLabels();
  const exportCsv = useWatermarkedExport();
  const perFamily = useMemo(() => shareRows(agg.data ?? [], 'family', 'training_hours'), [agg.data]);
  // Quarterly organisation-wide hours per head (all periods)
  const trend = useQuery('workforce_snapshots', async () => {
    const ps = periods.data?.periods ?? [];
    const out: { x: string; y: number | null }[] = [];
    for (const p of ps) {
      const r = shareRows(await repo.rpc.workforceAggregate(p, null), 'total', 'training_hours')[0];
      out.push({ x: p, y: r && !r.suppressed ? r.value : null });
    }
    return out;
  }, [periods.data?.periods.join(',')]);
  const completions = useQuery(['training_records', 'courses'], async () => {
    const [recs, courses] = await Promise.all([repo.list('training_records'), repo.list('courses')]);
    const m = new Map<string, { n: number; hours: number }>();
    for (const r of recs) {
      const x = m.get(r.course_id) ?? { n: 0, hours: 0 };
      x.n += 1;
      x.hours += Number(r.hours) || 0;
      m.set(r.course_id, x);
    }
    return [...m.entries()].map(([course_id, x]) => {
      const c = courses.find((y) => y.id === course_id);
      const s = suppress(x.n, x.n);
      return { course_id, code: c?.code ?? course_id, name: pick(c, 'title') || course_id, n: s.value, hours: s.suppressed ? null : x.hours, suppressed: s.suppressed };
    });
  });

  return (
    <Page title={t('m07.routes.workforce-training.title')} intro={t('m07.tr.intro')} wide>
      <Section title={t('m07.tr.publicTitle')} description={t('m07.tr.publicHint')}>
        <Async state={kpis}>
          {(k) => (
            <>
              <Grid cols={4}>
                <KpiTile rows={k} metric="training_hours" />
                <KpiTile rows={k} metric="training_hours_per_employee" />
                <KpiTile rows={k} metric="coct_population" />
                <KpiTile rows={k} metric="loct_population" />
              </Grid>
              <Grid cols={2}>
                <Card title={t('m07.tr.hoursTrend')} actions={<DefLink metric="training_hours" />}>
                  <LineChart title={t('m07.tr.hoursTrend')} series={[{ name: t('m07.metric.training_hours'), points: kpiSeries(k, 'training_hours').map((x) => ({ x: x.period, y: x.value })) }]} />
                </Card>
                <Card title={t('m07.tr.perEmployeeTrend')} actions={<DefLink metric="training_hours_per_employee" />}>
                  <LineChart title={t('m07.tr.perEmployeeTrend')} series={[{ name: t('m07.metric.training_hours_per_employee'), points: kpiSeries(k, 'training_hours_per_employee').map((x) => ({ x: x.period, y: x.value })), tone: 'leaf' }]} />
                </Card>
              </Grid>
            </>
          )}
        </Async>
      </Section>

      <Section title={t('m07.tr.tenantTitle')} description={t('m07.tr.tenantHint', { n: MIN_GROUP_SIZE })}>
        <SampleBanner />
        <div className="flex flex-wrap items-end gap-3">{periods.data && <PeriodSelect periods={periods.data.periods} value={cur} onChange={setPeriod} />}</div>
        <Grid cols={2}>
          <Card title={t('m07.tr.perFamily', { period: cur })} actions={<DefLink metric="hours_per_head" />}>
            <Async state={agg} empty={<EmptyState title={t('m07.noData')} />}>
              {() => (
                <div data-testid="m07-training-family">
                  <BarChart title={t('m07.tr.perFamily', { period: cur })} unit={` ${t('m07.unit.h')}`} data={perFamily.map((r) => ({ label: labels.label('family', r.key), value: r.value, suppressed: r.suppressed }))} />
                </div>
              )}
            </Async>
            <div className="mt-3">
              <ExportButton onClick={() => exportCsv(`training-hours-per-head-${cur}`, ['job_family', 'hours_per_head', 'hours', 'headcount', 'note'], perFamily.map((r) => [labels.label('family', r.key), r.value, r.numerator, r.denominator, r.suppressed ? `suppressed (<${MIN_GROUP_SIZE})` : '']))} />
            </div>
          </Card>
          <Card title={t('m07.tr.quarterTrend')} actions={<DefLink metric="hours_per_head" />}>
            <Async state={trend}>{(pts) => <LineChart title={t('m07.tr.quarterTrend')} series={[{ name: t('m07.metric.hours_per_head'), points: pts }]} />}</Async>
          </Card>
        </Grid>
      </Section>

      <Section title={t('m07.tr.completionsTitle')} description={t('m07.tr.completionsHint', { n: MIN_GROUP_SIZE })}>
        <Async state={completions} empty={<EmptyState title={t('m07.tr.noCompletions')}>{t('m07.tr.noCompletionsBody')}</EmptyState>}>
          {(rows) => (
            <div data-testid="m07-completions">
              <DataTable
                rows={rows}
                rowKey={(r) => r.course_id}
                toolbar={<span className="flex items-center gap-2"><DefLink metric="completions" /><ExportButton onClick={() => exportCsv('training-completions', ['course', 'completions', 'hours', 'note'], rows.map((r) => [`${r.code} ${r.name}`, r.n, r.hours, r.suppressed ? `suppressed (<${MIN_GROUP_SIZE})` : '']))} /></span>}
                columns={[
                  { key: 'course', header: t('m07.tr.course'), value: (r) => `${r.code} · ${r.name}`, sortable: true },
                  { key: 'n', header: t('m07.tr.completions'), value: (r) => r.n, sortable: true, align: 'end', render: (r) => (r.suppressed ? <StatusPill tone="sim">{t('m07.suppressed')}</StatusPill> : <span className="num">{f.num(r.n)}</span>) },
                  { key: 'h', header: t('m07.tr.hours'), value: (r) => r.hours, sortable: true, align: 'end', render: (r) => (r.suppressed ? '—' : <span className="num">{f.num(r.hours, { maximumFractionDigits: 1 })}</span>) },
                ]}
              />
            </div>
          )}
        </Async>
      </Section>

      <Section title={t('m07.tr.qualityTitle')} description={t('m07.tr.qualityHint')}>
        <Async state={kpis}>
          {(k) => (
            <Grid cols={4}>
              {['quals_renewed_on_time', 'lapses', 'jpm_to_signed_days', 'equivalency_turnaround'].map((m) => (
                <KpiTile key={m} rows={k} metric={m} />
              ))}
            </Grid>
          )}
        </Async>
        <div><SimChip label={t('m07.tr.qualitySample')} /></div>
      </Section>
    </Page>
  );
}
