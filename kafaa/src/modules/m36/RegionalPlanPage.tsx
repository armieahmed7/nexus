// FS64 /ecosystem/regional-plan (ecosystem R/OwnOrg/Agg/W/A): the regional skills plan for Al Dhafra. ENEC's forward skill demand as
// RELEASED, SUPPRESSED aggregates (kafaa_regional_demand: built by rpc.releaseRegionalDemand from a released FS51 forecast; SIMULATED):
// per catalogue area and horizon year, the working-level demand band and gap band across the three planning scenarios and the gap under
// the forecast's planning scenario; cells of 1-9 suppressed; skills FS51 withheld are counted, never named. Providers (partners and
// universities) see their own commitments against each area's 2030 gap and commit provision; HR reaches every provider's commitments.
import { useMemo, useState } from 'react';
import { useQuery, useRepo } from '../../data';
import type { Table } from '../../data/types';
import { useSession } from '../../auth/session';
import { Page, Section, Async, Card, EmptyState, StatTile, Callout, Tabs, WhyThis, BenchmarkChips, ProgressBar, DataTable, type Column } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';
import { COVERAGE_YEAR, DEMAND_YEARS, MIN_GROUP, coverageByArea, demandReasons, commitmentView, type AreaCoverage } from './regional';
import { todayIso } from '../../domain/rules';
import { Band, DemoLabels, GapBar, Sup, useSkillName, useSkills, type Row } from './ui';

export default function RegionalPlanPage() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const canOrg = s.can('ecosystem', ['OwnOrg', 'OrgW', 'Agg', 'A']) || s.hasRole('auditor');
  const isProvider = s.can('ecosystem', ['OwnOrg', 'OrgW']);
  const demand = useQuery('regional_demand' as Table, () => repo.list('regional_demand' as never, { order: [['area', 'asc']] } as never) as unknown as Promise<Row[]>);
  const commitments = useQuery('provider_commitments' as Table, () => (canOrg ? (repo.list('provider_commitments' as never) as unknown as Promise<Row[]>).catch(() => [] as Row[]) : Promise.resolve([] as Row[])), [canOrg]);
  const skills = useSkills();
  return (
    <Page title={t('m36.routes.ecosystem-regional-plan.title')} intro={t('m36.rp.intro')} wide
      eyebrow={<div className="flex min-w-0 max-w-full flex-wrap items-center gap-2"><BenchmarkChips feature="FS64" /></div>}
      actions={<div className="flex flex-wrap gap-2">
        {canOrg && <L to="/ecosystem/regional-plan/commitments" className="btn-primary btn-sm no-underline" data-testid="m36-rp-to-commitments">{isProvider ? t('m36.rp.myCommitments') : t('m36.rp.allCommitments')}</L>}
        {s.can('workforce_strategy', ['Agg', 'W', 'A']) && <L to="/ecosystem/regional-plan/release" className="btn-outline btn-sm no-underline" data-testid="m36-rp-to-release">{t('m36.rp.toRelease')}</L>}
        <L to="/ecosystem/pledges" className="btn-outline btn-sm no-underline">{t('m36.rp.toPledges')}</L>
      </div>}>
      <Async state={demand}>{(rows) => {
        const cur = rows.filter((r) => r.status === 'current');
        if (!cur.length) return <EmptyState title={t('m36.rp.empty')}>{t('m36.rp.emptyBody')}</EmptyState>;
        return <Plan cur={cur} past={rows.filter((r) => r.status === 'superseded')} commitments={commitments.data ?? []} isProvider={isProvider} skills={skills.data} />;
      }}</Async>
    </Page>
  );
}

function Plan({ cur, past, commitments, isProvider, skills }: { cur: Row[]; past: Row[]; commitments: Row[]; isProvider: boolean; skills: Map<string, Row> | undefined }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const skillName = useSkillName(skills);
  const [year, setYear] = useState<string>(String(COVERAGE_YEAR));
  const head = cur[0];
  const today = todayIso();
  const at = (y: number) => cur.filter((r) => Number(r.year) === y);
  const mid = at(COVERAGE_YEAR);
  const withheld = mid.reduce((n, r) => n + Number(r.withheld_n ?? 0), 0);
  const gapAreas = mid.filter((r) => r.gap_plan != null && Number(r.gap_plan) > 0).length;
  const supCells = cur.filter((r) => r.suppressed).length;
  const active = commitments.filter((c) => c.status !== 'withdrawn');
  const coverage = useMemo(() => coverageByArea(cur, commitments, today), [cur, commitments, today]);
  const scen = t(`m36.scenario.${head.scenario}`);
  const tableFor = (y: number) => {
    const rs = at(y);
    const max = Math.max(1, ...rs.map((r) => Number(r.gap_high ?? 0)));
    const cols: Column<Row>[] = [
      { key: 'area', header: t('m36.rp.col.area'), value: (r) => t(`m36.area.${r.area}`), sortable: true,
        render: (r) => <div className="min-w-0"><span className="font-semibold">{t(`m36.area.${r.area}`)}</span>
          <span className="mt-0.5 flex flex-wrap gap-1">{(r.skill_ids as string[]).map((id) => <span key={id} className="rounded bg-sunken px-1.5 py-0.5 text-[11.5px] text-ink-2">{skillName(id)}</span>)}</span></div> },
      { key: 'demand', header: t('m36.rp.col.demand'), align: 'end', value: (r) => Number(r.demand_high ?? -1), sortable: true, render: (r) => <Band lo={r.demand_low} hi={r.demand_high} /> },
      { key: 'gap', header: t('m36.rp.col.gap'), value: (r) => Number(r.gap_high ?? -1), sortable: true, width: '200px',
        render: (r) => <div className="space-y-1"><GapBar lo={r.gap_low} hi={r.gap_high} plan={r.gap_plan} max={max} /><span className="block text-[11.5px] text-ink-3"><Band lo={r.gap_low} hi={r.gap_high} /></span></div> },
      { key: 'plan', header: t('m36.rp.col.plan', { s: scen }), align: 'end', value: (r) => Number(r.gap_plan ?? -1), sortable: true,
        render: (r) => <span data-testid="m36-gap-plan"><Sup v={r.gap_plan} /></span> },
      { key: 'withheld', header: t('m36.rp.col.withheld'), align: 'end', value: (r) => Number(r.withheld_n), render: (r) => <span className="num">{f.num(Number(r.withheld_n))}</span> },
      { key: 'why', header: '', value: () => 0, render: (r) => <WhyThis reasons={demandReasons(r, head.scenario)} testId={`m36-rp-why-${r.area}-${r.year}`} /> },
    ];
    return (
      <div className="overflow-x-auto" data-testid="m36-demand-table" data-year={y}>
        <DataTable rows={rs} columns={cols} rowKey={(r) => r.id} searchable={false} pageSize={20} caption={t('m36.rp.tableCaption', { y: f.num(y, { useGrouping: false }) })} csvName={`regional-demand-${y}`} />
      </div>
    );
  };
  return (
    <div className="space-y-6" data-testid="m36-rp" data-release={head.release_id}>
      <DemoLabels />
      <Card title={t('m36.rp.release', { id: head.release_id })} eyebrow={t('m36.rp.releaseEyebrow')}>
        <div className="space-y-2 text-[13.5px]" data-testid="m36-rp-release">
          <p>{t('m36.rp.releaseBody', { name: head.forecast_name, date: f.date(head.released_at), s: scen })}</p>
          <blockquote className="border-s-4 border-accent/40 ps-3 text-ink-2">{pick(head, 'note')}</blockquote>
          <p className="text-[12px] text-ink-3">{t('m36.rp.noDecision')}</p>
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="m36-rp-tiles">
        <StatTile label={t('m36.rp.tile.areas')} value={f.num(mid.length)} sub={t('m36.rp.tile.areasSub', { y: f.num(COVERAGE_YEAR, { useGrouping: false }) })} sim />
        <StatTile label={t('m36.rp.tile.gapAreas')} value={f.num(gapAreas)} sub={t('m36.rp.tile.gapAreasSub', { s: scen })} tone="bad" sim />
        <StatTile label={t('m36.rp.tile.withheld')} value={f.num(withheld)} sub={t('m36.rp.tile.withheldSub', { n: f.num(MIN_GROUP), cells: f.num(supCells) })} tone="info" />
        {isProvider
          ? <StatTile label={t('m36.rp.tile.mine')} value={f.num(active.length)} sub={t('m36.rp.tile.mineSub', { n: f.num(active.filter((c) => ['behind', 'at_risk'].includes(commitmentView(c, today).status)).length) })} tone="ok" />
          : <StatTile label={t('m36.rp.tile.years')} value={DEMAND_YEARS.map((y) => f.num(y, { useGrouping: false })).join(' · ')} sub={t('m36.rp.tile.yearsSub')} />}
      </div>
      <Section title={t('m36.rp.demand')} description={t('m36.rp.demandIntro', { n: f.num(MIN_GROUP) })}>
        <Tabs value={year} onChange={setYear} tabs={DEMAND_YEARS.map((y) => ({ id: String(y), label: f.num(y, { useGrouping: false }), content: tableFor(y) }))} />
        <p className="mt-2 text-[11.5px] text-ink-3">{t('m36.rp.legend')}</p>
      </Section>
      {isProvider && <Coverage rows={coverage} />}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Callout tone="info" title={t('m36.rp.how.title')}>{t('m36.rp.how.body', { n: f.num(MIN_GROUP) })}</Callout>
        <Callout tone="sim" title={t('m36.rp.loop.title')}>{t('m36.rp.loop.body')}</Callout>
      </div>
      {past.length > 0 && (
        <Section title={t('m36.rp.past')}>
          <ul className="space-y-1 text-[13px]" data-testid="m36-rp-past">
            {[...new Set(past.map((r) => String(r.release_id)))].map((id) => { const r = past.find((x) => x.release_id === id)!; return <li key={id}><span className="num font-semibold">{id}</span> · {r.forecast_name} · {f.date(r.released_at)}</li>; })}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Coverage({ rows }: { rows: AreaCoverage[] }) {
  const t = useT();
  const f = useFormat();
  return (
    <Section title={t('m36.rp.coverage', { y: f.num(COVERAGE_YEAR, { useGrouping: false }) })} description={t('m36.rp.coverageIntro')}>
      <div className="overflow-x-auto" data-testid="m36-rp-coverage">
        <table className="w-full text-[13px]">
          <caption className="sr-only">{t('m36.rp.coverage', { y: String(COVERAGE_YEAR) })}</caption>
          <thead><tr className="text-ink-3">
            <th scope="col" className="py-1 text-start font-semibold">{t('m36.rp.col.area')}</th>
            <th scope="col" className="py-1 text-end font-semibold">{t('m36.rp.cov.gap')}</th>
            <th scope="col" className="py-1 text-end font-semibold">{t('m36.rp.cov.seats')}</th>
            <th scope="col" className="py-1 text-end font-semibold">{t('m36.rp.cov.completed')}</th>
            <th scope="col" className="py-1 text-start font-semibold">{t('m36.rp.cov.pct')}</th>
          </tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.area} className="border-t border-line" data-testid="m36-cov-row" data-area={r.area} data-pct={r.pct ?? ''}>
              <th scope="row" className="py-1.5 text-start font-medium">{t(`m36.area.${r.area}`)}</th>
              <td className="py-1.5 text-end"><Sup v={r.gap_plan} /></td>
              <td className="py-1.5 text-end num">{f.num(r.seats)}</td>
              <td className="py-1.5 text-end num">{f.num(r.completed)}</td>
              <td className="py-1.5 ps-3">{r.pct == null ? <span className="text-[12px] text-ink-3">{r.gap_plan === 0 ? t('m36.rp.cov.noGap') : t('m36.rp.cov.na')}</span>
                : <ProgressBar value={Math.min(100, r.pct)} tone={r.pct >= 100 ? 'ok' : 'accent'} label={`${f.num(r.pct)}%`} />}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </Section>
  );
}
