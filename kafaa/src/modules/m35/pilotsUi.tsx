// M35 FS61 shared page pieces: the pilot data hook, the adoption-rate KPI against the Future Skills Centre reference (read from
// kafaa_benchmarks through rpc.pilotStats and <BenchmarkLine>, never typed), and a pilot result card used by HR and staff pages.
import { useQuery, useRepo } from '../../data';
import { Card, BenchmarkLine, SourceLink, StatusPill, Donut } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';
import { lift, type PilotMetric } from './pilots';
import type { PilotStats } from './backend/rpc';
import { AdoptionPill, PilotStatusPill, ResultPill } from './fs60ui';
import type { Row } from './ui';

export function usePilots() {
  const repo = useRepo();
  return useQuery(['skill_pilots', 'benchmarks'], async () => {
    const [stats, pilots] = await Promise.all([repo.rpc.pilotStats(), repo.list('skill_pilots', { order: [['sort', 'asc']] } as never) as Promise<Row[]>]);
    if (!stats.ok || !stats.data) throw new Error(stats.message);
    return { stats: stats.data, pilots };
  });
}

/** The adoption-rate KPI: computed from pilot statuses, with the FSC reference line and its source. */
export function AdoptionKpi({ s }: { s: PilotStats }) {
  const t = useT();
  const f = useFormat();
  const adopted = s.adopted + s.expanded + s.further_funded;
  return (
    <Card title={t('m35.sp.kpi.title')} eyebrow={t('m35.sp.kpi.eyebrow')}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]" data-testid="m35-sp-kpi" data-rate={s.rate ?? ''} data-reference={s.reference?.value ?? ''}>
        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="num text-[40px] font-semibold leading-none">{s.rate == null ? '—' : f.pct(s.rate)}</span>
            <span className="text-[13px] text-ink-2">{t('m35.sp.kpi.of', { a: f.num(adopted), n: f.num(s.closed) })}</span>
          </div>
          <BenchmarkLine value={s.rate} max={100} unit="pct" label={t('m35.sp.kpi.line')} benchmark={{ id: 'FSC', figure: 'adoption_rate' }} />
          {s.reference && (
            <p className="text-[12.5px] text-ink-2" data-testid="m35-sp-reference">
              {t('m35.sp.kpi.reference', { v: f.pct(s.reference.value, 0) })} <SourceLink href={s.reference.url} date={f.date(s.reference.as_of)}>{t('m35.sp.kpi.source')}</SourceLink>
            </p>
          )}
          <p className="text-[12px] text-ink-3">{t('m35.sp.kpi.definition')}</p>
        </div>
        <div>
          <Donut title={t('m35.sp.kpi.mix')} data={[
            { label: t('m35.sp.adoption.adopted'), value: s.adopted, tone: 'ok' }, { label: t('m35.sp.adoption.expanded'), value: s.expanded, tone: 'accent' },
            { label: t('m35.sp.adoption.further_funded'), value: s.further_funded, tone: 'info' }, { label: t('m35.sp.adoption.not_adopted'), value: s.not_adopted, tone: 'bad' },
          ]} center={<span className="num text-[18px] font-semibold">{f.num(s.closed)}</span>} />
        </div>
      </div>
    </Card>
  );
}

/** One pilot's result (title, statuses, the measured lift against the comparison group, the summary). Failures carry a visible badge. */
export function PilotResultCard({ p, to }: { p: Row; to?: string }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const metrics = (p.metrics ?? []) as PilotMetric[];
  return (
    <article className={`card space-y-2 p-4 ${p.result === 'failed' ? 'border-s-4 border-s-bad' : ''}`} data-testid="m35-sp-card" data-id={p.id} data-result={p.result ?? ''}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[15px] font-semibold">{to ? <L to={to}>{pick(p, 'title')}</L> : pick(p, 'title')}</h3>
        <PilotStatusPill status={p.status} />
        <ResultPill result={p.result} />
        {p.status === 'closed' && <AdoptionPill adoption={p.adoption} />}
        {p.result === 'failed' && <StatusPill tone="bad"><span data-testid="m35-sp-failure-visible">{t('m35.sp.failureVisible')}</span></StatusPill>}
      </div>
      <p className="text-[13px] text-ink-2">{pick(p, 'hypothesis')}</p>
      {p.result_en && <p className="text-[13px]">{pick(p, 'result')}</p>}
      {metrics.some((m) => m.pilot != null) && (
        <ul className="flex flex-wrap gap-2 text-[12px]">
          {metrics.map((m) => { const l = lift(m); return (
            <li key={m.key} className="rounded bg-sunken px-2 py-1">{pick(m as unknown as Row, 'label')}: <span className="num font-semibold">{f.num(m.pilot ?? 0, { maximumFractionDigits: 1 })}</span>
              {l != null && <span className="text-ink-3"> ({t('m35.sp.vsComparison', { d: `${l > 0 ? '+' : ''}${f.num(l, { maximumFractionDigits: 1 })}` })})</span>}</li>
          ); })}
        </ul>
      )}
      {p.lessons_en && <p className="text-[12px] text-ink-3"><b>{t('m35.sp.lessons')}</b> {pick(p, 'lessons')}</p>}
    </article>
  );
}
