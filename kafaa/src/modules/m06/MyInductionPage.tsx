// FS77 /my/induction: my induction plan (FS wave H · E5). Signed in. The plan HR built from the published baseline for my intake year:
// full, refresher or skipped per module with the reason, the hours I already hold, and a notice when HR has published a newer baseline
// since the plan was built. Reads only my own row (own_profile Own); a plan shortens induction and is never a qualification record.
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { Async, BenchmarkChips, Callout, Card, EmptyState, Grid, Page, Section, StatTile } from '../../ui';
import { L, useFormat, useT } from '../../i18n';
import { planStale, type PlanItem } from './starter';
import { PlanTable, useStarterRefs } from './starterUi';

interface PlanRow {
  id: string;
  person_id: string;
  programme: string;
  intake_year: number;
  baseline_id: string | null;
  baseline_version: number | null;
  items: PlanItem[];
  hours_total: number;
  hours_planned: number;
  hours_saved: number;
  revision: number;
  built_at: string;
}

export default function MyInductionPage() {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const refs = useStarterRefs();
  const s = useSession();
  const pid = s.identity.personId;
  // HR and training staff read every plan; this page shows only the signed-in person's own one.
  const plans = useQuery('induction_plans', async () => ({ rows: pid ? ((await repo.list('induction_plans', { filter: { person_id: pid } })) as unknown as PlanRow[]) : [] }), [pid]);
  return (
    <Page title={t('m06.routes.my-induction.title')} eyebrow={t('m06.myind.eyebrow')} intro={t('m06.myind.intro')}>
      <BenchmarkChips feature="FS77" />
      <Async state={plans}>
        {({ rows }) => {
          const me = rows[0];
          if (!me)
            return (
              <EmptyState title={t('m06.myind.emptyTitle')} icon="calendar">
                {t('m06.myind.emptyBody')}
                <div className="mt-3">
                  <L to="/pathways/journey/starter" className="btn-outline btn-sm">{t('m06.myind.openStarter')}</L>
                </div>
              </EmptyState>
            );
          const year = Number(me.intake_year);
          const stale = refs.baselines.length > 0 && planStale(me, refs.baselines);
          const skipped = me.items.filter((i) => i.action === 'skip').length;
          const refreshers = me.items.filter((i) => i.action === 'refresher').length;
          return (
            <div className="space-y-5" data-testid="m06-myind">
              <Grid cols={4}>
                <StatTile label={t('m06.ind.totals.planned')} value={<span data-testid="m06-myind-planned">{t('m06.ind.hoursN', { n: f.num(Number(me.hours_planned)) })}</span>} sub={t('m06.ind.ofTotal', { n: f.num(Number(me.hours_total)) })} />
                <StatTile label={t('m06.ind.totals.saved')} value={<span data-testid="m06-myind-saved">{t('m06.ind.hoursN', { n: f.num(Number(me.hours_saved)) })}</span>} tone="ok" />
                <StatTile label={t('m06.ind.totals.skipped')} value={f.num(skipped)} />
                <StatTile label={t('m06.ind.totals.refreshers')} value={f.num(refreshers)} />
              </Grid>
              <Card>
                <div className="space-y-1 text-[13px]" data-testid="m06-myind-baseline">
                  <div className="font-semibold">{t('m06.myind.intake', { programme: t(`m06.ind.programme.${me.programme}`), year: f.num(year, { useGrouping: false }) })}</div>
                  <div className="text-ink-2">
                    {me.baseline_id ? t('m06.myind.baselineUsed', { id: me.baseline_id, version: f.num(Number(me.baseline_version)) }) : t('m06.myind.noBaseline')}
                  </div>
                  <div className="text-[12px] text-ink-3">{t('m06.myind.builtOn', { date: f.date(me.built_at), n: f.num(Number(me.revision)) })}</div>
                </div>
              </Card>
              {stale && <Callout tone="sim" title={t('m06.myind.staleTitle')}><span data-testid="m06-myind-stale">{t('m06.myind.stale')}</span></Callout>}
              <Section title={t('m06.myind.planTitle')} description={t('m06.myind.planHint')}>
                <Async state={refs.modulesState}>{() => <PlanTable plan={me} modules={refs.modules} year={year} testId="m06-myind-plan" />}</Async>
              </Section>
              <Callout tone="info" title={t('m06.myind.notAuthorityTitle')}>{t('m06.myind.notAuthority')}</Callout>
            </div>
          );
        }}
      </Async>
    </Page>
  );
}
