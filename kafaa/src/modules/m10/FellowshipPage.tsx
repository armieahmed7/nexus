// FS67 /universities/fellowships/:id: one fellowship (fellow, supervisor role card, host university, HR; RLS decides, anyone else "not found").
// Host project (a published research challenge or an ADVANCE technology study: planning assumption, no deployment decision implied), the
// supervisor role card, the placement and the five milestones with the actions the signed-in person may take (rpc.updateMilestone).
import { useParams } from 'react-router-dom';
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { can } from '../../data/access';
import { Async, BenchmarkChips, Callout, Card, EmptyState, Grid, Icon, KeyValue, Page, SimChip } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';
import { FwStatusPill, MilestoneList, useFwLabels } from './fw';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export default function FellowshipPage() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const { id = '' } = useParams();
  const who = useSession().identity;
  const lab = useFwLabels();
  const q = useQuery(['fellowships', 'fellowship_milestones'], async () => {
    const [fw, ms] = await Promise.all([repo.get('fellowships', id), repo.list('fellowship_milestones', { filter: { fellowship_id: id } })]);
    return { fw: fw as Row | null, ms: ms as Row[] };
  }, [id]);
  return (
    <Page title={q.data?.fw ? pick(q.data.fw, 'title') : t('m10.routes.university-fellowship.title')} eyebrow={t('m10.fw.detailEyebrow')} wide
      actions={<L to="/universities/fellowships" className="btn-outline btn-sm"><Icon name="back" className="rtl:-scale-x-100" />{t('m10.fw.back')}</L>}>
      <BenchmarkChips feature="FS67" />
      <Async state={{ ...q, data: q.data }}>
        {({ fw, ms }) => !fw ? <EmptyState title={t('m10.fw.notFound')}>{t('m10.fw.notFoundBody')}</EmptyState> : (
          <div className="space-y-4" data-testid="m10-fw-detail">
            {fw.host_kind === 'advance_study' && <Callout tone="sim" title={t('m10.fw.advanceTitle')}>{t('m10.fw.advanceBody')}</Callout>}
            <Grid cols={2}>
              <Card title={t(`m10.fw.k.${fw.kind}`)} actions={<FwStatusPill f={fw} />}>
                <KeyValue items={[
                  [t('m10.fw.cHost'), <span key="h" data-testid="m10-fw-host">{lab.host(fw)}</span>],
                  [t('m10.fw.cSupervisor'), <span key="s" data-testid="m10-fw-supervisor">{pick(fw, 'supervisor_name')}</span>],
                  [t('m10.fw.fellow'), <span key="f" className="num">{fw.fellow_initials || '—'}</span>],
                  [t('m10.fw.cUniversity'), lab.org(fw.university_org_id)],
                  [t('m10.fw.span'), t('m10.fw.spanValue', { from: f.date(fw.starts_on), to: f.date(fw.ends_on) })],
                  ...(fw.status === 'completed' ? [[t('m10.fw.completedOn'), f.date(fw.completed_on)] as [string, string]] : []),
                  ...(fw.status === 'withdrawn' ? [[t('m10.fw.withdrawnOn'), `${f.date(fw.withdrawn_on)} · ${fw.withdraw_reason ?? ''}`] as [string, string]] : []),
                ]} />
              </Card>
              <Card title={t('m10.fw.placement')}>
                <p className="text-[13.5px] text-ink-2">{pick(fw, 'placement') || '—'}</p>
                <p className="mt-3 text-[12.5px] text-ink-3">{t(`m10.fw.patternNote.${fw.kind}`)}</p>
                {fw.sample && <div className="mt-2"><SimChip label={t('m10.fw.sample')} /></div>}
              </Card>
            </Grid>
            <Card title={t('m10.fw.ms.title')}>
              <MilestoneList f={fw} ms={ms} me={who.personId} hr={can(who, 'ecosystem', ['A'])} uniOrg={can(who, 'ecosystem', ['OrgW']) ? who.orgId : null} />
              <p className="mt-2 text-[12px] text-ink-3">{t('m10.fw.ms.rule')}</p>
            </Card>
          </div>
        )}
      </Async>
    </Page>
  );
}
