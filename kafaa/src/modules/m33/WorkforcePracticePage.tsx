// FS58/FS59 /workforce/core-skills/practice (skills_profile Agg: HR): practice participation in aggregate only. Adaptive problem-solving:
// people, runs, the ENEC average on the practice scale, the band spread, the three dimensions, the trend by quarter and by theme.
// Role-play: people, sessions, the pooled criteria rate, validated sessions and the rate by conversation kind (rpc.apsStats /
// rpc.roleplayStats; SQL kafaa_aps_stats_core / kafaa_rp_stats_core = aps.ts apsStats / roleplay.ts rpStats). Every cell naming fewer than
// 10 people is suppressed and no person is ever listed. Practice never gates a qualification and is never used in talent review.
import type { ReactNode } from 'react';
import { Page, Section, Card, Async, Callout, EmptyState, StatTile, BenchmarkChips, BarChart, LineChart, DataTable, type Column } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useFormat, useT } from '../../i18n';
import type { ApsStats } from './aps';
import type { RpStats } from './roleplay';
import { DimBars, KindTag, ScaleCard } from './fs65ui';

export default function WorkforcePracticePage() {
  const t = useT();
  const repo = useRepo();
  const q = useQuery(['aps_attempts', 'roleplay_sessions'], async () => {
    const [aps, rp] = await Promise.all([repo.rpc.apsStats(), repo.rpc.roleplayStats()]);
    return { aps, rp };
  }, []);
  return (
    <Page title={t('m33.routes.workforce-core-practice.title')} intro={t('m33.wp.intro')} wide eyebrow={<span className="flex flex-wrap gap-2"><BenchmarkChips feature="FS58" /><BenchmarkChips feature="FS59" /></span>}>
      <Async state={q}>{(d) => (d.aps || d.rp ? <Body aps={d.aps} rp={d.rp} /> : <EmptyState title={t('m33.wp.none')} />)}</Async>
    </Page>
  );
}

function Body({ aps, rp }: { aps: ApsStats | null; rp: RpStats | null }) {
  const t = useT();
  const f = useFormat();
  const sup = t('common.suppressedShort');
  const n = (v: number | null | undefined): ReactNode => (v == null ? <span className="text-ink-3" title={t('common.suppressed')}>{sup}</span> : f.num(v));
  const p = (v: number | null | undefined): ReactNode => (v == null ? <span className="text-ink-3" title={t('common.suppressed')}>{sup}</span> : f.pct(v, 0));
  type Q = ApsStats['by_quarter'][number];
  type K = RpStats['by_kind'][number];
  const qCols: Column<Q>[] = [
    { key: 'period', header: t('m33.wp.period'), value: (r) => r.period },
    { key: 'people', header: t('m33.wp.people'), align: 'end', value: (r) => r.people ?? -1, render: (r) => n(r.people) },
    { key: 'runs', header: t('m33.wp.runs'), align: 'end', value: (r) => r.attempts ?? -1, render: (r) => n(r.attempts) },
    { key: 'avg', header: t('m33.wp.avg'), align: 'end', value: (r) => r.avg ?? -1, render: (r) => n(r.avg) },
  ];
  const kCols: Column<K>[] = [
    { key: 'kind', header: t('m33.rp.col.kind'), value: (r) => r.kind, render: (r) => <KindTag kind={r.kind} /> },
    { key: 'people', header: t('m33.wp.people'), align: 'end', value: (r) => r.people ?? -1, render: (r) => n(r.people) },
    { key: 'pct', header: t('m33.rp.col.pct'), align: 'end', value: (r) => r.pct ?? -1, render: (r) => p(r.pct) },
  ];
  return (
    <div className="space-y-6">
      {aps && (
        <Section title={t('m33.wp.aps.title')} description={t('m33.wp.aps.intro')}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="m33-wp-aps-tiles">
            <StatTile label={t('m33.wp.people')} value={n(aps.participants)} />
            <StatTile label={t('m33.wp.runs')} value={n(aps.attempts)} />
            <StatTile label={t('m33.wp.avg')} value={n(aps.avg)} tone="info" sub={t('m33.wp.avgSub')} />
            <StatTile label={t('m33.wp.strategic')} value={n(aps.bands.find((b) => b.band === 'strategic')?.people)} tone="ok" />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card title={t('m33.wp.bands')} eyebrow={t('m33.wp.bandsEyebrow')}>
              <ul className="space-y-1.5 text-[13px]" data-testid="m33-wp-bands">
                {aps.bands.map((b) => <li key={b.band} className="flex items-center justify-between gap-2" data-band={b.band} data-people={b.people ?? 'suppressed'}><span>{t(`m33.aps.band.${b.band}`)}</span><span className="num font-semibold">{n(b.people)}</span></li>)}
              </ul>
            </Card>
            <Card title={t('m33.aps.res.dims')} eyebrow={t('m33.wp.dimsEyebrow')}>
              <DimBars dims={Object.fromEntries(aps.dims.map((x) => [x.dim, { pts: 0, max: 0, pct: x.pct }]))} testId="m33-wp-dims" />
            </Card>
            <Card title={t('m33.wp.byTheme')}>
              {aps.by_theme.some((x) => x.avg != null)
                ? <BarChart title={t('m33.wp.byTheme')} max={100} data={aps.by_theme.filter((x) => x.avg != null).map((x) => ({ label: t(`m33.aps.theme.${x.theme}`), value: x.avg as number }))} />
                : <p className="text-[13px] text-ink-3">{t('common.suppressed')}</p>}
            </Card>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <Card title={t('m33.wp.trend')}>
              <LineChart title={t('m33.wp.trend')} yMin={0} yMax={100} series={[{ name: t('m33.wp.avg'), points: aps.by_quarter.map((x) => ({ x: x.period, y: x.avg })) }]} />
              <div className="mt-3" data-testid="m33-wp-quarters"><DataTable rows={aps.by_quarter} columns={qCols} rowKey={(r) => r.period} searchable={false} caption={t('m33.wp.trend')} dense /></div>
            </Card>
            <Card title={t('m33.aps.scale.title')} eyebrow={t('m33.aps.scale.eyebrow')}><ScaleCard score={aps.avg} testId="m33-wp-scale" /></Card>
          </div>
        </Section>
      )}
      {rp && (
        <Section title={t('m33.wp.rp.title')} description={t('m33.wp.rp.intro')}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="m33-wp-rp-tiles">
            <StatTile label={t('m33.wp.people')} value={n(rp.participants)} />
            <StatTile label={t('m33.rp.mine.sessions')} value={n(rp.sessions)} />
            <StatTile label={t('m33.wp.rp.rate')} value={p(rp.pct)} tone="info" />
            <StatTile label={t('m33.rp.mine.validated')} value={n(rp.validated)} tone="ok" />
          </div>
          <Card title={t('m33.wp.rp.byKind')}><div data-testid="m33-wp-kinds"><DataTable rows={rp.by_kind} columns={kCols} rowKey={(r) => r.kind} searchable={false} caption={t('m33.wp.rp.byKind')} dense /></div></Card>
        </Section>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Callout tone="info" title={t('m33.wp.privacyTitle')}>{t('m33.wp.privacyBody')}</Callout>
        <Callout tone="ok" title={t('m33.aps.gate.title')}>{t('m33.wp.gateBody')}</Callout>
      </div>
    </div>
  );
}
