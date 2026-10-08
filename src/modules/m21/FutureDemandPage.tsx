// M21 /workforce/future/interest (F09): the Future Me demand signal for HR and training (input to F26 training needs).
// Distinct people interested in each technology family and horizon lane, and with Future Me learning goals there.
// Aggregate only (rpc.futureDemand): any cell under the minimum group size shows "suppressed"; individual rows never reach HR.
import { Page, Section, Card, Async, EmptyState, Callout, BarChart, Grid, StatTile, DataTable } from '../../ui';
import { useT, usePick, useFormat } from '../../i18n';
import { useQuery, useRepo } from '../../data';
import { MIN_GROUP_SIZE } from '../../auth/policy';
import { NoDecision } from '../m11/shared';

export default function FutureDemandPage() {
  const t = useT();
  const repo = useRepo();
  const q = useQuery(['future_interest', 'future_goals', 'adv_technologies', 'horizon_lanes'], async () => {
    const [rows, techs, lanes] = await Promise.all([repo.rpc.futureDemand(), repo.list('adv_technologies', { order: [['sort', 'asc']] }), repo.list('horizon_lanes', { order: [['sort', 'asc']] })]);
    return { rows, techs, lanes };
  });
  return (
    <Page title={t('m21.routes.workforce-future-interest.title')} intro={t('m21.demand.intro')}>
      <NoDecision compact />
      <Callout tone="info" title={t('m21.demand.privacyTitle')}>{t('m21.demand.privacy', { n: MIN_GROUP_SIZE })}</Callout>
      <Async state={q} isEmpty={(d) => d.techs.length === 0} empty={<EmptyState title={t('m21.demand.empty')} />}>
        {(d) => <Body {...d} />}
      </Async>
    </Page>
  );
}

type Row = Awaited<ReturnType<ReturnType<typeof useRepo>['rpc']['futureDemand']>>[number];
function Body({ rows, techs, lanes }: { rows: Row[]; techs: { id: string; family_en: string; family_ar: string }[]; lanes: { id: string; title_en: string; title_ar: string; horizon: string }[] }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const cell = (src: string, id: string) => rows.find((r) => r.source === src && r.target_id === id) ?? { n: null, suppressed: true };
  const fmt = (c: { n: number | null; suppressed: boolean }) => (c.suppressed ? t('common.suppressedShort') : f.num(c.n));
  const shown = rows.filter((r) => !r.suppressed);
  const targets = [
    ...techs.map((x) => ({ id: x.id, kind: 'tech', name: pick(x, 'family') })),
    ...lanes.map((x) => ({ id: x.id, kind: 'lane', name: pick(x, 'title') })),
  ];
  return (
    <>
      <Grid cols={3}>
        <StatTile label={t('m21.demand.cells')} value={f.num(rows.length)} sub={t('m21.demand.cellsSub')} />
        <StatTile label={t('m21.demand.shown')} value={f.num(shown.length)} sub={t('m21.demand.shownSub', { n: MIN_GROUP_SIZE })} />
        <StatTile label={t('m21.demand.suppressed')} value={f.num(rows.length - shown.length)} sub={t('m21.demand.suppressedSub')} />
      </Grid>
      <Section title={t('m21.demand.techTitle')}>
        <Grid cols={2}>
          <Card title={t('m21.demand.interest')}><BarChart title={t('m21.demand.interest')} data={techs.map((x) => { const c = cell('interest', x.id); return { label: pick(x, 'family'), value: c.n, suppressed: c.suppressed }; })} /></Card>
          <Card title={t('m21.demand.goals')}><BarChart title={t('m21.demand.goals')} data={techs.map((x) => { const c = cell('goal', x.id); return { label: pick(x, 'family'), value: c.n, suppressed: c.suppressed, tone: 'leaf' }; })} /></Card>
        </Grid>
      </Section>
      <Section title={t('m21.demand.laneTitle')}>
        <Grid cols={2}>
          <Card title={t('m21.demand.interest')}><BarChart title={t('m21.demand.laneInterest')} data={lanes.map((x) => { const c = cell('interest', x.id); return { label: pick(x, 'title'), value: c.n, suppressed: c.suppressed, tone: 'sky' }; })} /></Card>
          <Card title={t('m21.demand.goals')}><BarChart title={t('m21.demand.laneGoals')} data={lanes.map((x) => { const c = cell('goal', x.id); return { label: pick(x, 'title'), value: c.n, suppressed: c.suppressed, tone: 'leaf' }; })} /></Card>
        </Grid>
      </Section>
      <Section title={t('m21.demand.tableTitle')}>
        <div data-testid="m21-demand">
          <DataTable
            rows={targets}
            rowKey={(r) => r.id}
            csvName="future-demand"
            columns={[
              { key: 'name', header: t('m21.demand.col.target'), value: (r) => r.name, sortable: true },
              { key: 'kind', header: t('m21.demand.col.kind'), value: (r) => t(`m21.demand.kind.${r.kind}`), sortable: true },
              { key: 'interest', header: t('m21.demand.col.interest'), value: (r) => fmt(cell('interest', r.id)), sortable: true, align: 'end' },
              { key: 'goals', header: t('m21.demand.col.goals'), value: (r) => fmt(cell('goal', r.id)), sortable: true, align: 'end' },
            ]}
          />
        </div>
        <p className="text-[12px] text-ink-3">{t('m21.demand.foot')}</p>
      </Section>
    </>
  );
}
