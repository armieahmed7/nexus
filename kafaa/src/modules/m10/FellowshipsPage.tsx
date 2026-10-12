// FS67 /universities/fellowships: NEST-style fellowships inside ENEC research challenges or ADVANCE technology studies, and sponsored study paired
// with a placement (the MSCFP design). The headline is the completion rate computed from milestones (suppressed under 10), with the award count
// beside it, never alone. Below: the fellowships I take part in (as fellow, supervisor role card or host university; HR sees all; RLS decides).
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { can } from '../../data/access';
import { Async, BenchmarkChips, Callout, Card, DataTable, EmptyState, Grid, Page, Section } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';
import { CompletionPair, FwStatusPill, StatsTable, useFwLabels, useFwStats } from './fw';
import { isOverdue } from './fellowship';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export default function FellowshipsPage() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const who = useSession().identity;
  const allowed = can(who, 'ecosystem', ['R', 'Agg', 'W', 'A']);
  const stats = useFwStats(allowed);
  const lab = useFwLabels();
  const q = useQuery(['fellowships', 'fellowship_milestones'], async () => {
    const [fws, ms] = await Promise.all([repo.list('fellowships', { order: [['starts_on', 'desc']] }), repo.list('fellowship_milestones')]);
    return { fws: fws as Row[], ms: ms as Row[] };
  });
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Page title={t('m10.routes.universities-fellowships.title')} intro={t('m10.fw.intro')} wide
      actions={can(who, 'ecosystem', ['A', 'W', 'Agg']) ? <L to="/workforce/fellowships" className="btn-outline btn-sm">{t('m10.fw.toWorkforce')}</L> : undefined}>
      <BenchmarkChips feature="FS67" />
      <Grid cols={2}>
        <Card title={t('m10.fw.nestTitle')} eyebrow={t('m10.fw.patternEyebrow')}><p className="text-[13.5px] text-ink-2">{t('m10.fw.nestBody')}</p></Card>
        <Card title={t('m10.fw.mscfpTitle')} eyebrow={t('m10.fw.patternEyebrow')}><p className="text-[13.5px] text-ink-2">{t('m10.fw.mscfpBody')}</p></Card>
      </Grid>
      <Section title={t('m10.fw.headline')} description={t('m10.fw.headlineBody', { n: 10 })}>
        {!allowed ? <Callout tone="info" title={t('m10.fw.noStatsTitle')}>{t('m10.fw.noStatsBody')}</Callout> : (
          <Async state={{ ...stats, data: stats.data ?? undefined }} empty={<EmptyState />}>
            {(s) => (
              <div className="space-y-4" data-testid="m10-fw-headline">
                <Card title={t('m10.fw.overall')} eyebrow={t('m10.fw.asOf', { date: f.date(s.as_of) })}>
                  <CompletionPair cell={s.overall} big />
                  <p className="mt-2 text-[12.5px] text-ink-3">{t('m10.fw.definition')}</p>
                </Card>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                  <StatsTable title={t('m10.fw.byKind')} cells={s.by_kind} label={(k) => t(`m10.fw.k.${k}`)} />
                  <StatsTable title={t('m10.fw.byHost')} cells={s.by_host} label={(k) => t(`m10.fw.k.${k}`)} />
                  <StatsTable title={t('m10.fw.byUniversity')} cells={s.by_university} label={lab.key} />
                </div>
              </div>
            )}
          </Async>
        )}
      </Section>
      <Section title={t('m10.fw.mine')} description={t('m10.fw.mineBody')}>
        <Async state={q}>
          {({ fws, ms }) => fws.length === 0 ? <EmptyState title={t('m10.fw.mineNone')} /> : (
            <div data-testid="m10-fw-list">
              <DataTable rows={fws} rowKey={(x) => x.id} pageSize={50} columns={[
                { key: 'title', header: t('m10.fw.cTitle'), value: (x) => pick(x, 'title'), sortable: true, render: (x) => <L to={`/universities/fellowships/${x.id}`}>{pick(x, 'title')}</L> },
                { key: 'kind', header: t('m10.fw.cKind'), value: (x) => t(`m10.fw.k.${x.kind}`) },
                { key: 'host', header: t('m10.fw.cHost'), value: (x) => lab.host(x) },
                { key: 'sup', header: t('m10.fw.cSupervisor'), value: (x) => pick(x, 'supervisor_name') },
                { key: 'uni', header: t('m10.fw.cUniversity'), value: (x) => lab.org(x.university_org_id) },
                { key: 'end', header: t('m10.fw.cEnds'), value: (x) => x.ends_on, sortable: true, render: (x) => f.date(x.ends_on) },
                { key: 'ms', header: t('m10.fw.cMilestones'), value: (x) => ms.filter((m) => m.fellowship_id === x.id && m.status === 'signed_off').length,
                  render: (x) => { const mm = ms.filter((m) => m.fellowship_id === x.id); const od = mm.filter((m) => isOverdue(m, x, today)).length; return <span className="num">{t('m10.fw.msDone', { done: f.num(mm.filter((m) => m.status === 'signed_off').length), n: f.num(mm.length) })}{od > 0 ? ` · ${t('m10.fw.msOverdue', { n: f.num(od) })}` : ''}</span>; } },
                { key: 'status', header: t('m10.fw.cStatus'), value: (x) => x.status, render: (x) => <FwStatusPill f={x} /> },
              ]} />
            </div>
          )}
        </Async>
      </Section>
      <p className="text-[12px] text-ink-3">{t('m10.fw.footer')}</p>
    </Page>
  );
}
