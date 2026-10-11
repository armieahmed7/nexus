// /training (M04): training administration hub for instructors and the training manager: upcoming sessions, seats and
// waitlists, approvals, simulator use, assessment work queues and links to every tool.
import { Page, Section, Grid, Card, StatTile, Async, Donut, BarChart, DataTable, Icon } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { holdsSeat } from '../../domain/learning';
import { G2Pill, useCatalogue, useLabels } from './ui';
import { TeamApprovals } from './TeamApprovals';

const TOOLS = [
  { to: '/training/courses', icon: 'book', key: 'courses' },
  { to: '/training/schedule', icon: 'calendar', key: 'schedule' },
  { to: '/training/simulator', icon: 'chart', key: 'simulator' },
  { to: '/training/cohorts', icon: 'users', key: 'cohorts' },
  { to: '/training/jpm', icon: 'check', key: 'jpm' },
  { to: '/training/items', icon: 'lock', key: 'items' },
  { to: '/training/assessments', icon: 'shield', key: 'assessments' },
  { to: '/training/quals', icon: 'grad', key: 'quals' },
];

export default function TrainingPage() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lab = useLabels();
  const repo = useRepo();
  const s = useSession();
  const cat = useCatalogue();
  const me = s.identity.personId;
  const q = useQuery(['sessions', 'enrolments', 'simulator_slots', 'items', 'attempts', 'appeals', 'external_requests'], async () => {
    const [sessions, enrolments, slots, items, attempts, appeals, external] = await Promise.all([
      repo.list('sessions', { order: [['starts_at', 'asc']] }), repo.list('enrolments'), repo.list('simulator_slots'),
      repo.list('items', { filter: { bank: 'secure' } }).catch(() => []), repo.list('attempts').catch(() => []), repo.list('appeals').catch(() => []), repo.list('external_requests', { filter: { status: 'requested' } }),
    ]);
    return { sessions, enrolments, slots, items, attempts, appeals, external };
  }, []);
  return (
    <Page title={t('m04.routes.training.title')} intro={t('m04.hub.intro')} wide>
      <Async state={q}>
        {(d) => {
          const now = new Date().toISOString();
          const in14 = new Date(Date.now() + 14 * 86_400_000).toISOString();
          const upcoming = d.sessions.filter((x) => x.status === 'scheduled' && x.starts_at >= now && x.starts_at <= in14);
          const seats = upcoming.reduce((n, x) => n + x.capacity, 0);
          const taken = upcoming.reduce((n, x) => n + d.enrolments.filter((e) => e.session_id === x.id && holdsSeat(e.status)).length, 0);
          const waitlisted = d.enrolments.filter((e) => e.status === 'waitlisted').length;
          const requested = d.enrolments.filter((e) => e.status === 'requested').length + d.external.length;
          const inReview = d.items.filter((i) => i.status === 'in_review').length;
          const toRelease = d.attempts.filter((a) => a.status === 'graded').length;
          const openAppeals = d.appeals.filter((a) => a.status === 'open').length;
          const statusCounts = ['assigned', 'requested', 'waitlisted', 'enrolled', 'in_progress', 'completed', 'failed'].map((st) => ({ label: t(`m04.status.${st}`), value: d.enrolments.filter((e) => e.status === st).length, tone: st === 'completed' ? 'ok' : st === 'failed' ? 'bad' : st === 'waitlisted' || st === 'requested' ? 'sim' : st === 'in_progress' ? 'info' : undefined }));
          const futureSlots = d.slots.filter((x) => x.starts_at >= now);
          const simKinds = ['coct', 'requal', 'initial', 'maintenance', 'elective', 'free'].map((k) => ({ label: lab.booking(k), value: futureSlots.filter((x) => x.booking_kind === k).length, tone: k === 'coct' || k === 'requal' ? 'bad' : k === 'free' ? 'ink' : undefined }));
          const mine = d.sessions.filter((x) => x.instructor_person_id === me && x.status === 'scheduled' && x.starts_at >= new Date(Date.now() - 7 * 86_400_000).toISOString());
          return (
            <div className="space-y-6">
              <Grid cols={4}>
                <StatTile label={t('m04.hub.sessions14')} value={f.num(upcoming.length)} sub={t('m04.hub.seatsFilled', { pct: f.pct(seats ? (taken * 100) / seats : 0, 0) })} />
                <StatTile label={t('m04.hub.waitlisted')} value={f.num(waitlisted)} tone={waitlisted ? 'sim' : undefined} sub={t('m04.hub.waitlistedSub')} />
                <StatTile label={t('m04.hub.approvals')} value={f.num(requested)} tone={requested ? 'info' : undefined} sub={t('m04.hub.approvalsSub')} />
                <StatTile label={t('m04.hub.assessQueue')} value={f.num(inReview + toRelease + openAppeals)} sub={t('m04.hub.assessQueueSub', { items: f.num(inReview), results: f.num(toRelease), appeals: f.num(openAppeals) })} />
              </Grid>
              <Grid cols={2}>
                <Card title={t('m04.hub.enrolmentMix')}><Donut title={t('m04.hub.enrolmentMix')} data={statusCounts.filter((x) => x.value > 0)} center={<span className="num text-[18px] font-semibold">{f.num(d.enrolments.length)}</span>} /></Card>
                <Card title={t('m04.hub.simulatorMix')}><BarChart title={t('m04.hub.simulatorMix')} data={simKinds} /><p className="mt-2 text-[12.5px] text-ink-3">{t('m04.sim.ruleBody')}</p></Card>
              </Grid>
              <Section title={t('m04.hub.tools')}>
                <Grid cols={4}>
                  {TOOLS.map((x) => (
                    <L key={x.to} to={x.to} className="card link-plain flex items-start gap-3 p-4 hover:border-accent" data-testid={`m04-tool-${x.key}`}>
                      <Icon name={x.icon} size={20} className="mt-0.5 text-eyebrow" />
                      <div><div className="font-semibold">{t(`m04.hub.tool.${x.key}`)}</div><div className="text-[12.5px] text-ink-2">{t(`m04.hub.toolSub.${x.key}`)}</div></div>
                    </L>
                  ))}
                </Grid>
              </Section>
              <Section title={t('m04.hub.mySessions')} actions={<L to="/training/schedule?mine=1" className="btn-outline btn-sm">{t('common.viewAll')}</L>}>
                <DataTable rows={mine} rowKey={(r) => r.id} searchable={false} pageSize={6} empty={t('m04.hub.noMySessions')} columns={[
                  { key: 'when', header: t('m04.common.when'), value: (r) => r.starts_at, render: (r) => f.dateTime(r.starts_at), sortable: true },
                  { key: 'course', header: t('m04.common.course'), value: (r) => { const c = cat.course.get(r.course_id); return c ? pick(c, 'title') : r.course_id; } },
                  { key: 'where', header: t('m04.common.where'), value: (r) => r.location },
                  { key: 'seats', header: t('m04.common.seats'), value: (r) => d.enrolments.filter((e) => e.session_id === r.id && holdsSeat(e.status)).length, render: (r) => <span className="num">{f.num(d.enrolments.filter((e) => e.session_id === r.id && holdsSeat(e.status)).length)} / {f.num(r.capacity)}</span> },
                  { key: 'status', header: t('m04.common.status'), value: (r) => r.status, render: (r) => <G2Pill status={r.status} /> },
                ]} />
              </Section>
              {s.can('training', ['A']) && <Section title={t('m04.hub.approvalsTitle')}><TeamApprovals /></Section>}
            </div>
          );
        }}
      </Async>
    </Page>
  );
}
