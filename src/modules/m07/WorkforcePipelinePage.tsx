// M07 /workforce/pipeline: from programme intake to placement (aggregate): published programme facts, scholar cohorts
// (cohorts under 10 suppressed), licensed operator pipeline (LO -> RO -> SRO -> Shift Supervisor) and NEXUS cohort progress.
import { useMemo } from 'react';
import { useRepo, useQuery } from '../../data';
import { useSession } from '../../auth/session';
import { Page, Section, Grid, Card, Async, EmptyState, Callout, Funnel, BarChart, DataTable, StatusPill, SimChip, ProgressBar } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';
import { MIN_GROUP_SIZE } from '../../auth/policy';
import { suppress } from '../../domain/rules';
import { SourceList } from '../m06/shared';
import { DefLink, ExportButton, KpiTile, useKpis, useWatermarkedExport } from './shared';

const OPERATOR_LADDER = ['local-operator', 'reactor-operator', 'senior-reactor-operator', 'shift-supervisor'];

export default function WorkforcePipelinePage() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const s = useSession();
  const exportCsv = useWatermarkedExport();
  const kpis = useKpis();
  const programmes = useQuery('talent_programmes', () => repo.list('talent_programmes', { order: [['sort', 'asc']] }));
  const cohorts = useQuery('scholar_cohorts', () => repo.list('scholar_cohorts', { order: [['intake_year', 'desc']] }));
  const crit = useQuery(['critical_roles', 'job_roles'], async () => {
    const [c, roles] = await Promise.all([repo.list('critical_roles', { filter: { role_id: OPERATOR_LADDER } }), repo.list('job_roles', { filter: { id: OPERATOR_LADDER } })]);
    const latest = [...new Set(c.map((x) => x.period))].sort().at(-1);
    return OPERATOR_LADDER.map((id) => ({ role: roles.find((r) => r.id === id), row: c.find((x) => x.role_id === id && x.period === latest) })).filter((x) => x.row);
  });
  const nexus = useQuery([], () => repo.nexus.peopleQuals());

  const cohortRows = useMemo(
    () =>
      (cohorts.data ?? []).map((c) => {
        const size = suppress(c.size, c.size);
        const hide = size.suppressed;
        return { ...c, hide, size: hide ? null : c.size, in_study: hide ? null : c.in_study, graduated: hide ? null : c.graduated, placed: hide ? null : c.placed, women_pct: hide ? null : c.women_pct };
      }),
    [cohorts.data],
  );
  const visible = cohortRows.filter((c) => !c.hide);
  const sum = (k: 'size' | 'in_study' | 'graduated' | 'placed') => visible.reduce((n, c) => n + (c[k] ?? 0), 0);

  return (
    <Page title={t('m07.routes.workforce-pipeline.title')} intro={t('m07.pipe.intro')} wide>
      <Section title={t('m07.pipe.programmesTitle')} description={t('m07.pipe.programmesHint')}>
        <Async state={programmes} empty={<EmptyState />}>
          {(rows) => (
            <div data-testid="m07-programme-facts">
              <DataTable
                rows={rows}
                rowKey={(r) => r.id}
                searchable={false}
                columns={[
                  { key: 'name', header: t('m07.pipe.programme'), value: (r) => pick(r, 'name'), render: (r) => <L to={`/pathways/${r.id}`}>{pick(r, 'name')}</L> },
                  { key: 'facts', header: t('m07.pipe.published'), value: (r) => pick(r, 'facts') },
                  { key: 'src', header: t('common.source'), csv: false, render: (r) => <SourceList sources={r.sources} /> },
                ]}
              />
            </div>
          )}
        </Async>
        {s.can('applications', ['Agg', 'A', 'R']) && (
          <Callout tone="info" title={t('m07.pipe.funnelTitle')}>
            {t('m07.pipe.funnelBody')} <L to="/workforce/applications">{t('m07.pipe.funnelLink')}</L>
          </Callout>
        )}
      </Section>

      <Section title={t('m07.pipe.cohortsTitle')} description={t('m07.pipe.cohortsHint', { n: MIN_GROUP_SIZE })}>
        <Async state={cohorts} empty={<EmptyState title={t('m07.pipe.noCohorts')} />}>
          {() => (
            <Grid cols={2}>
              <Card title={t('m07.pipe.cohortFunnel')} actions={<span className="flex items-center gap-2"><DefLink metric="cohort_progress" /><SimChip label={t('common.sample')} /></span>}>
                <Funnel
                  title={t('m07.pipe.cohortFunnel')}
                  stages={[
                    { label: t('m07.pipe.enrolled'), value: sum('size') },
                    { label: t('m07.pipe.inStudy'), value: sum('in_study') },
                    { label: t('m07.pipe.graduated'), value: sum('graduated') },
                    { label: t('m07.pipe.placed'), value: sum('placed') },
                  ]}
                />
                <p className="mt-2 text-[12px] text-ink-3">{t('m07.pipe.excluded', { n: cohortRows.length - visible.length })}</p>
              </Card>
              <div data-testid="m07-cohorts">
                <DataTable
                  rows={cohortRows}
                  rowKey={(r) => r.id}
                  searchable={false}
                  toolbar={<ExportButton onClick={() => exportCsv('scholar-cohorts', ['programme', 'intake', 'destination', 'size', 'in_study', 'graduated', 'placed', 'women_pct'], cohortRows.map((c) => [c.programme_id, c.intake_year, c.destination, c.hide ? `suppressed (<${MIN_GROUP_SIZE})` : c.size, c.in_study, c.graduated, c.placed, c.women_pct]))} />}
                  columns={[
                    { key: 'dest', header: t('m07.pipe.destination'), value: (r) => `${r.destination} · ${r.pathway}` },
                    { key: 'year', header: t('m07.pipe.intake'), value: (r) => r.intake_year, sortable: true, align: 'end' },
                    { key: 'size', header: t('m07.pipe.enrolled'), value: (r) => r.size, align: 'end', render: (r) => (r.hide ? <StatusPill tone="sim">{t('m07.suppressed')}</StatusPill> : <span className="num">{f.num(r.size)}</span>) },
                    { key: 'grad', header: t('m07.pipe.graduated'), value: (r) => r.graduated, align: 'end', render: (r) => (r.hide ? '—' : <span className="num">{f.num(r.graduated)}</span>) },
                    { key: 'placed', header: t('m07.pipe.placed'), value: (r) => r.placed, align: 'end', render: (r) => (r.hide ? '—' : <span className="num">{f.num(r.placed)}</span>) },
                  ]}
                />
              </div>
            </Grid>
          )}
        </Async>
      </Section>

      <Section title={t('m07.pipe.operatorTitle')} description={t('m07.pipe.operatorHint')}>
        <Async state={kpis}>
          {(k) => (
            <Grid cols={3}>
              <KpiTile rows={k} metric="sro_ro" />
              <KpiTile rows={k} metric="coct_population" />
              <KpiTile rows={k} metric="loct_population" />
            </Grid>
          )}
        </Async>
        <Async state={crit} empty={<EmptyState />}>
          {(rows) => (
            <Card title={t('m07.pipe.ladderTitle')} actions={<span className="flex items-center gap-2"><DefLink metric="bench_depth" /><SimChip label={t('common.sample')} /></span>}>
              <ol className="grid grid-cols-1 gap-3 md:grid-cols-4" data-testid="m07-operator-ladder">
                {rows.map(({ role, row }, i) => (
                  <li key={row!.id} className="rounded-card border border-line p-3">
                    <div className="caps">{t('m07.pipe.step', { n: i + 1 })}</div>
                    <div className="font-semibold">{pick(role, 'title')}</div>
                    <dl className="mt-2 grid grid-cols-[1fr_auto] gap-y-1 text-[13px]">
                      <dt className="text-ink-2">{t('m07.cr.qualified')}</dt><dd className="num text-end">{f.num(row!.qualified)}</dd>
                      <dt className="text-ink-2">{t('m07.cr.inTraining')}</dt><dd className="num text-end">{f.num(row!.in_training)}</dd>
                      <dt className="text-ink-2">{t('m07.cr.pipeline')}</dt><dd className="num text-end">{f.num(row!.pipeline)}</dd>
                    </dl>
                    <div className="mt-2"><ProgressBar value={Math.min(100, (row!.qualified / Math.max(1, row!.target_bench)) * 100)} label={t('m07.cr.coverage')} /></div>
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-[12px] text-ink-3">{t('m07.pipe.ladderNote')}</p>
            </Card>
          )}
        </Async>
      </Section>

      <Section title={t('m07.pipe.nexusTitle')} description={t('m07.pipe.nexusHint')}>
        <Async state={nexus} empty={<EmptyState title={t('m07.pipe.noNexus')} />}>
          {(rows) => (
            <Card actions={repo.nexus.source === 'snapshot' ? <SimChip label={t('m07.pipe.snapshot')} /> : <StatusPill tone="ok">{t('m07.pipe.live')}</StatusPill>}>
              <BarChart title={t('m07.pipe.nexusTitle')} unit="%" max={100} data={rows.map((q) => ({ label: `${q.cohort} · ${q.qualification}`, value: q.suppressed ? null : q.progress_pct, suppressed: q.suppressed }))} />
              <p className="mt-2 text-[12px] text-ink-3">{t('m07.pipe.nexusNote')}</p>
            </Card>
          )}
        </Async>
      </Section>
    </Page>
  );
}
