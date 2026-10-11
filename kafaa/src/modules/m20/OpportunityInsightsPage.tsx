// /opportunities/insights (M20 · F08): HR oversight. Aggregates only (rpc.opportunityStats); family cells with fewer than 10
// applicants are suppressed; no names. Synthetic demo data, labelled.
import { Page, Section, Grid, Card, Async, StatTile, Funnel, BarChart, Callout, SimChip, EmptyState } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useFormat, usePick, useT } from '../../i18n';
import { OPP_KINDS } from './domain';

export default function OpportunityInsightsPage() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const q = useQuery(['opportunities', 'opportunity_applications', 'skill_evidence', 'job_families'], async () => {
    const [stats, families] = await Promise.all([repo.rpc.opportunityStats(), repo.list('job_families')]);
    return { stats, families };
  });
  return (
    <Page title={t('m20.routes.opportunities-insights.title')} intro={t('m20.insights.intro')} actions={<SimChip label={t('m20.insights.synthetic')} />}>
      <Async state={q} isEmpty={(d) => !d.stats} empty={<EmptyState icon="lock" title={t('m20.insights.noAccess')} />}>
        {({ stats: s, families }) => {
          if (!s) return null;
          const fam = (id: string) => pick(families.find((x) => x.id === id), 'name') || t('m20.common.unknownFamily');
          const fu = s.funnel;
          return (
            <div className="space-y-6" data-testid="m20-insights">
              <Grid cols={4}>
                <StatTile label={t('m20.insights.open')} value={f.num(s.opportunities.open)} sub={t('m20.insights.openSub', { f: f.num(s.opportunities.filled), c: f.num(s.opportunities.closed) })} />
                <StatTile label={t('m20.insights.emirati')} value={f.num(s.opportunities.emirati_open)} sub={t('m20.insights.emiratiSub')} />
                <StatTile label={t('m20.insights.kt')} value={f.num(s.opportunities.knowledge_transfer_open)} sub={t('m20.insights.ktSub')} />
                <StatTile label={t('m20.insights.evidence')} value={f.num(s.evidence_rows)} tone="ok" sub={t('m20.insights.evidenceSub')} />
              </Grid>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card title={t('m20.insights.funnel')} footer={fu.suppressed ? t('common.suppressed') : t('m20.insights.applicants', { n: f.num(fu.applicants ?? 0) })}>
                  <Funnel title={t('m20.insights.funnel')} stages={[
                    { label: t('m20.step.applied'), value: fu.applied, suppressed: fu.suppressed },
                    { label: t('m20.step.released'), value: fu.released, suppressed: fu.suppressed },
                    { label: t('m20.step.selected'), value: fu.selected, suppressed: fu.suppressed },
                    { label: t('m20.step.completed'), value: fu.completed, suppressed: fu.suppressed },
                  ]} />
                </Card>
                <Card title={t('m20.insights.byKind')}>
                  <BarChart title={t('m20.insights.byKind')} data={OPP_KINDS.map((k) => ({ label: t(`m20.kind.${k}`), value: s.by_kind.find((x) => x.kind === k)?.open ?? 0 }))} />
                </Card>
              </div>
              <Section title={t('m20.insights.byFamily')} description={t('m20.insights.byFamilySub', { n: f.num(s.min_group) })}>
                <div className="overflow-x-auto rounded-card border border-line">
                  <table className="table-base w-full" data-testid="m20-family-table">
                    <thead><tr><th scope="col">{t('m20.insights.family')}</th><th scope="col" className="text-end">{t('m20.insights.colApplicants')}</th><th scope="col" className="text-end">{t('m20.insights.colApplications')}</th><th scope="col" className="text-end">{t('m20.insights.colCompleted')}</th></tr></thead>
                    <tbody>
                      {s.by_family.map((r) => (
                        <tr key={r.family_id} data-suppressed={r.suppressed}>
                          <th scope="row" className="text-start font-normal">{fam(r.family_id)}</th>
                          {r.suppressed ? <td colSpan={3} className="text-end text-ink-3">{t('common.suppressed')}</td> : (
                            <><td className="num text-end">{f.num(r.applicants)}</td><td className="num text-end">{f.num(r.applications)}</td><td className="num text-end">{f.num(r.completed)}</td></>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
              <Callout title={t('m20.insights.noteTitle')}>{t('m20.insights.noteBody')}</Callout>
            </div>
          );
        }}
      </Async>
    </Page>
  );
}
