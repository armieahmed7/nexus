// F34 /workforce/journeys: student journey insights for HR (W5 · E3). Aggregate counts only, from rpc.journeyAggregate: every cell
// under 10 reads "suppressed". No student is listed, ranked or rejected here. The HR director (applications A) can issue the
// synthetic Mustaqbali starter credential to accepted participants, behind a confirmation.
import { useState, type ReactNode } from 'react';
import { useAction, useQuery, useRepo } from '../../data';
import { Can } from '../../auth/guards';
import { Async, BarChart, Callout, Card, ConfirmDialog, ErrorState, Grid, Icon, Page, Section, SimChip, StatTile } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';
import type { AggCell, AggRow, JourneyAggregate } from './journey';

export default function WorkforceJourneysPage() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const act = useAction();
  const [confirm, setConfirm] = useState(false);
  const q = useQuery(['student_journeys', 'student_portfolio', 'applications'], () => repo.rpc.journeyAggregate());
  const fams = useQuery('job_families', () => repo.list('job_families', { order: [['sort', 'asc']] }));
  const progs = useQuery('talent_programmes', () => repo.list('talent_programmes', {}));
  const famName = (id: string) => { const r = (fams.data ?? []).find((x) => x.id === id); return r ? pick(r, 'name') : id; };
  const routeName = (id: string) => { if (id === 'undecided') return t('m06.jinsights.undecided'); const r = (progs.data ?? []).find((x) => x.id === id); return r ? pick(r, 'name') : id; };
  const val = (c: AggCell) => (c.suppressed ? <span data-testid="m06-ji-suppressed">{t('m06.jinsights.suppressed')}</span> : f.num(c.n));

  return (
    <Page title={t('m06.routes.workforce-journeys.title')} eyebrow={t('m06.jinsights.eyebrow')} intro={t('m06.jinsights.intro')}>
      <Async state={q}>
        {(res) => {
          if (!res.ok || !res.data) return <ErrorState title={t('m06.jinsights.refused')} error={res.message} />;
          const a: JourneyAggregate = res.data;
          const shown = a.by_family.filter((r) => !r.suppressed);
          return (
            <div className="space-y-6">
              <div data-testid="m06-ji-tiles">
                <Grid cols={4}>
                  {(['total', 'routed', 'applied', 'credentials'] as const).map((k) => (
                    <div key={k} data-testid={`m06-ji-tile-${k}`}>
                      <StatTile label={t(`m06.jinsights.tile.${k}`)} value={val(a[k])} sub={t(`m06.jinsights.tileSub.${k}`)} sim />
                    </div>
                  ))}
                </Grid>
              </div>
              <Grid cols={2}>
                <AggTable title={t('m06.jinsights.byStage')} rows={a.by_stage} label={(k) => t(`m06.journey.stage.${k}`)} val={val} testId="m06-ji-stage" />
                <AggTable title={t('m06.jinsights.byRoute')} rows={a.by_route} label={routeName} val={val} testId="m06-ji-route" />
              </Grid>
              <Section title={t('m06.jinsights.byFamily')} description={t('m06.jinsights.byFamilyHint')}>
                <Grid cols={2}>
                  <Card>
                    {shown.length ? <BarChart title={t('m06.jinsights.byFamily')} data={shown.map((r) => ({ label: famName(r.key), value: r.n ?? 0 }))} /> : <p className="text-ink-3">{t('m06.jinsights.allSuppressed')}</p>}
                  </Card>
                  <AggTable title={t('m06.jinsights.familyTable')} rows={a.by_family} label={famName} val={val} testId="m06-ji-family" />
                </Grid>
              </Section>
              <Can res="applications" levels={['A']}>
                <Card title={t('m06.jinsights.credTitle')} eyebrow={t('m06.jinsights.credEyebrow')} actions={<SimChip label={t('m06.journey.synthetic')} />}>
                  <p className="text-[13px] text-ink-2">{t('m06.jinsights.credBody')}</p>
                  <p className="mt-2 text-[14px]" data-testid="m06-ji-pending">{t('m06.jinsights.pending', { n: f.num(a.pending_credentials ?? 0) })}</p>
                  <button type="button" className="btn-primary mt-3" disabled={!a.pending_credentials} onClick={() => setConfirm(true)} data-testid="m06-ji-issue">
                    <Icon name="shield" size={15} />
                    {t('m06.jinsights.issue')}
                  </button>
                  <ConfirmDialog
                    open={confirm}
                    onClose={() => setConfirm(false)}
                    title={t('m06.jinsights.issueTitle')}
                    consequence={t('m06.jinsights.issueConsequence', { n: f.num(a.pending_credentials ?? 0) })}
                    confirmLabel={t('m06.jinsights.issue')}
                    onConfirm={async () => {
                      await act(() => repo.rpc.issueStarterCredentials());
                      setConfirm(false);
                    }}
                  />
                </Card>
              </Can>
            </div>
          );
        }}
      </Async>
      <Callout tone="info" title={t('m06.jinsights.rulesTitle')}>
        {t('m06.jinsights.rulesBody')}{' '}
        <L to="/workforce/applications">{t('m06.jinsights.funnelLink')}</L>
      </Callout>
    </Page>
  );
}

function AggTable({ title, rows, label, val, testId }: { title: string; rows: AggRow[]; label: (k: string) => string; val: (c: AggCell) => ReactNode; testId: string }) {
  const t = useT();
  return (
    <Card title={title}>
      <table className="table-base w-full" data-testid={testId}>
        <thead>
          <tr>
            <th scope="col" className="text-start">{t('m06.jinsights.group')}</th>
            <th scope="col" className="text-end">{t('m06.jinsights.people')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td>{label(r.key)}</td>
              <td className="num text-end">{val(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
