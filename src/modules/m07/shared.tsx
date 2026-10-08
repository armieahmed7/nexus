/** M07 shared React pieces: data hooks, metric tiles with definition and source links, watermarked CSV export. */
import type { ReactNode } from 'react';
import { useRepo, useQuery } from '../../data';
import type { KpiSeriesRow } from '../../data/types';
import { useSession, roleLabel } from '../../auth/session';
import { StatTile, SourceLink, SimChip, Icon, downloadText } from '../../ui';
import { L, useFormat, usePick, useT, useLang } from '../../i18n';
import { todayIso } from '../../domain/rules';
import { MIN_GROUP_SIZE } from '../../auth/policy';
import { csvWatermark, latestPeriod } from './metrics';

/** Distinct snapshot periods (from the organisation-total rows, which are never suppressed). */
export function usePeriods() {
  const repo = useRepo();
  return useQuery('workforce_snapshots', async () => {
    const rows = await repo.list('workforce_snapshots', { filter: { measure: 'headcount', family_id: { isNull: true }, level: { isNull: true }, entity_id: { isNull: true } } });
    const ps = Array.from(new Set(rows.map((r) => r.period))).sort();
    return { periods: ps, latest: latestPeriod(ps) };
  });
}

export function useAggregates(period: string | null | undefined) {
  const repo = useRepo();
  return useQuery('workforce_snapshots', () => (period ? repo.rpc.workforceAggregate(period, null) : Promise.resolve([])), [period]);
}

export function useKpis() {
  const repo = useRepo();
  return useQuery('kpi_series', () => repo.list('kpi_series', { order: [['period', 'asc']] }));
}
export const kpiSeries = (rows: KpiSeriesRow[] | undefined, metric: string) => (rows ?? []).filter((r) => r.metric === metric).sort((a, b) => a.period.localeCompare(b.period));
export const kpiLatest = (rows: KpiSeriesRow[] | undefined, metric: string) => kpiSeries(rows, metric).at(-1) ?? null;

/** Names for job families and group entities (both public). */
export function useDimLabels() {
  const repo = useRepo();
  const pick = usePick();
  const t = useT();
  const q = useQuery(['job_families', 'organisations'], async () => {
    const [fams, orgs] = await Promise.all([repo.list('job_families', { order: [['sort', 'asc']] }), repo.list('organisations', { filter: { kind: 'group_entity' } })]);
    return { fams, orgs };
  });
  return {
    ready: !!q.data,
    families: q.data?.fams ?? [],
    entities: q.data?.orgs ?? [],
    label: (dim: string, key: string) => {
      if (dim === 'family') return pick(q.data?.fams.find((f) => f.id === key), 'name') || key;
      if (dim === 'entity') return pick(q.data?.orgs.find((o) => o.id === key), 'name') || key;
      if (dim === 'level') return t(`m07.level.${key}`);
      return t('m07.total');
    },
  };
}

/** A KPI tile that links to its definition (and source table) and cites its public source with an as-of date. */
export function MetricTile({ metric, label, value, sub, sourceUrl, source, asOf, sample, tone }: { metric: string; label: ReactNode; value: ReactNode; sub?: ReactNode; sourceUrl?: string | null; source?: string | null; asOf?: string | null; sample?: boolean; tone?: 'ok' | 'bad' | 'info' | 'sim' }) {
  const t = useT();
  return (
    <div data-testid={`m07-tile-${metric}`}>
      <StatTile
        label={label}
        value={value}
        sub={sub}
        sim={sample}
        tone={tone}
        source={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <L to={`/workforce/definitions#${metric}`} className="inline-flex items-center gap-1">
              <Icon name="info" size={12} />
              {t('m07.tile.definition')}
            </L>
            {sourceUrl ? <SourceLink href={sourceUrl} date={asOf ?? undefined}>{source ?? t('common.source')}</SourceLink> : source ? <span>{source}{asOf ? ` (${asOf})` : ''}</span> : null}
          </span>
        }
      />
    </div>
  );
}

/** KPI tile straight from kpi_series (latest period), with the value formatted by unit. */
export function KpiTile({ rows, metric, label }: { rows: KpiSeriesRow[] | undefined; metric: string; label?: ReactNode }) {
  const f = useFormat();
  const pick = usePick();
  const t = useT();
  const k = kpiLatest(rows, metric);
  if (!k) return null;
  const v = k.unit === '%' ? f.pct(k.value, 2) : k.unit === 'h' ? `${f.num(k.value, { maximumFractionDigits: 2 })} ${t('m07.unit.h')}` : f.num(k.value, { maximumFractionDigits: 1 });
  const prev = kpiSeries(rows, metric).at(-2);
  const delta = prev ? k.value - prev.value : null;
  return (
    <MetricTile
      metric={metric}
      label={label ?? pick(k, 'label')}
      value={v}
      sub={delta != null ? t('m07.tile.vs', { delta: `${delta >= 0 ? '+' : ''}${f.num(delta, { maximumFractionDigits: 2 })}${k.unit === '%' ? ' pp' : ''}`, period: prev!.period }) : k.period}
      sourceUrl={k.source_url}
      source={k.source}
      asOf={k.period}
      sample={k.sample}
    />
  );
}

/** Export rows as CSV with the aggregate-only watermark, the requester's role and the date (spec M07). */
export function useWatermarkedExport() {
  const s = useSession();
  const lang = useLang();
  const role = s.roles.find((r) => r !== 'public' && r !== 'employee') ?? s.roles[0];
  const requester = `${s.persona?.title_en ?? 'unknown'} · ${role ? roleLabel(role, 'en') : ''}`;
  return (name: string, header: string[], rows: (string | number | null | undefined)[][]) => {
    const esc = (v: string | number | null | undefined) => `"${String(v ?? '').replace(/"/g, '""').replace(/^([=+\-@])/, "'$1")}"`;
    const lines = [csvWatermark(requester, todayIso()), header.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))];
    downloadText(`${name}-${todayIso()}${lang === 'ar' ? '-ar' : ''}.csv`, lines.join('\r\n'));
  };
}

/** Link to a metric's definition and source table (every tile and chart carries one). */
export function DefLink({ metric }: { metric: string }) {
  const t = useT();
  return (
    <L to={`/workforce/definitions#${metric}`} className="inline-flex items-center gap-1 text-[12px]">
      <Icon name="info" size={12} />
      {t('m07.tile.definition')}
    </L>
  );
}

export function ExportButton({ onClick }: { onClick: () => void }) {
  const t = useT();
  return (
    <button className="btn-outline btn-sm" onClick={onClick} data-testid="m07-export">
      <Icon name="download" size={14} />
      {t('m07.exportCsv')}
    </button>
  );
}

export function SampleBanner() {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-2">
      <SimChip label={t('m07.sampleTenant')} />
      <span>{t('m07.sampleNote', { n: MIN_GROUP_SIZE })}</span>
    </div>
  );
}

export function PeriodSelect({ periods, value, onChange }: { periods: string[]; value: string; onChange: (p: string) => void }) {
  const t = useT();
  return (
    <label className="flex flex-col gap-1">
      <span className="caps">{t('m07.period')}</span>
      <select className="input min-w-[140px]" value={value} onChange={(e) => onChange(e.target.value)} data-testid="m07-period">
        {periods.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
    </label>
  );
}

export const SR2024 = 'https://www.enec.ae/doc/sustainability-program-2024-23102025-low-69009902e1673.pdf';
