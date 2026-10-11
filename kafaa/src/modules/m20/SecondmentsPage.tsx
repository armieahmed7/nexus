// /opportunities/secondments (M20 · FS28): external secondments. What a secondment is and how the return-and-transfer obligation works,
// my own secondments (host, objectives, host supervisor role, dates, the knowledge-capture session due within 60 days of return), my team's
// secondments for line managers, and the organisation overview (host-kind cells and people suppressed below 10). All data is synthetic.
import { Page, Section, Grid, Card, Async, EmptyState, Callout, StatTile, KeyValue, SimChip, SourceLink, BenchmarkChips, Icon, Stepper } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { L, useFormat, useLang, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { FS28_REFS, HOST_KINDS, phaseOf, transferState } from './secondment';
import { HostKindChip, SecPhasePill, TrackChip, TransferPill, FutureSkillChips, useRoleTitle, todayIso } from './fsUi';
import type { CaptureSessionsRow, JobRolesRow, SecondmentsRow, SkillsRow } from '../../data/types';
import type { SecDeskStats } from './secondment';

export default function SecondmentsPage() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const me = s.identity.personId;
  const q = useQuery(['secondments', 'capture_sessions', 'job_roles', 'skills'], async () => {
    const [rows, sessions, roles, skills, overview] = await Promise.all([
      repo.list('secondments', { order: [['start_on', 'desc']] }),
      repo.list('capture_sessions').catch(() => [] as CaptureSessionsRow[]),
      repo.list('job_roles', { order: [['sort', 'asc']] }),
      repo.list('skills', { order: [['sort', 'asc']] }),
      repo.rpc.secondmentOverview().catch(() => null),
    ]);
    return { rows, sessions, roles, skills, overview };
  }, [me]);
  return (
    <Page title={t('m20.routes.secondments.title')} eyebrow={<L to="/opportunities">{t('m20.sec.page.back')}</L>} intro={t('m20.sec.page.intro')} wide
      actions={<span className="flex gap-2"><L to="/opportunities/rotations/future" className="btn-outline btn-sm"><Icon name="sparkle" size={14} />{t('m20.sec.page.futureRotations')}</L></span>}>
      <div className="mb-4 flex flex-wrap items-center gap-2"><BenchmarkChips feature="FS28" /><SimChip label={t('m20.sec.page.synthetic')} /></div>
      <Async state={q} isEmpty={() => false}>{(d) => <Body {...d} me={me} />}</Async>
    </Page>
  );
}

function Body({ rows, sessions, roles, skills, overview, me }: { rows: SecondmentsRow[]; sessions: CaptureSessionsRow[]; roles: JobRolesRow[]; skills: SkillsRow[]; overview: SecDeskStats | null; me: string | null }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const mine = rows.filter((r) => r.person_id === me);
  const team = rows.filter((r) => r.line_manager_id === me && r.person_id !== me);
  return (
    <div className="space-y-6">
      {overview && (
        <Grid cols={4}>
          <StatTile label={t('m20.sec.page.statActive')} value={f.num(overview.by_phase.on_secondment)} sub={t('m20.sec.page.statActiveSub', { n: f.num(overview.by_phase.upcoming) })} tone="info" />
          <StatTile label={t('m20.sec.page.statReturned')} value={f.num(overview.by_phase.returned)} sub={t('m20.sec.page.statReturnedSub')} tone="ok" />
          <StatTile label={t('m20.sec.page.statTransfer')} value={f.num(overview.transfer.done)} sub={t('m20.sec.page.statTransferSub', { due: f.num(overview.transfer.due), overdue: f.num(overview.transfer.overdue) })} />
          <StatTile label={t('m20.sec.page.statPeople')} value={overview.suppressed ? t('m20.fs.hr.suppressedShort') : f.num(overview.people ?? 0)} sub={overview.suppressed ? t('m20.sec.page.suppressed', { n: f.num(overview.min_group) }) : t('m20.sec.page.statPeopleSub')} />
        </Grid>
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Section title={t('m20.sec.page.mine')} description={t('m20.sec.page.mineSub')}>
            {mine.length === 0 ? <EmptyState icon="globe" title={t('m20.sec.page.noneMine')}>{t('m20.sec.page.noneMineBody')}</EmptyState> : (
              <ul className="space-y-4" data-testid="m20-sec-mine">{mine.map((r) => <li key={r.id}><SecondmentCard r={r} sessions={sessions} roles={roles} skills={skills} /></li>)}</ul>
            )}
          </Section>
          {team.length > 0 && (
            <Section title={t('m20.sec.page.team')} description={t('m20.sec.page.teamSub')}>
              <ul className="space-y-4" data-testid="m20-sec-team">{team.map((r) => <li key={r.id}><SecondmentCard r={r} sessions={sessions} roles={roles} skills={skills} showName /></li>)}</ul>
            </Section>
          )}
        </div>
        <aside className="space-y-4">
          <Card title={t('m20.sec.page.howTitle')}>
            <Stepper steps={['plan', 'away', 'return', 'transfer'].map((k) => ({ id: k, label: t(`m20.sec.page.step.${k}`) }))} current={0} />
            <ol className="mt-3 list-decimal space-y-1.5 ps-5 text-[13px] text-ink-2"><li>{t('m20.sec.page.how1')}</li><li>{t('m20.sec.page.how2')}</li><li>{t('m20.sec.page.how3')}</li><li>{t('m20.sec.page.how4')}</li></ol>
          </Card>
          {overview && (
            <Card title={t('m20.sec.page.byHost')}>
              <ul className="space-y-1.5 text-[13px]" data-testid="m20-sec-hosts">
                {HOST_KINDS.map((k) => { const c = overview.by_host.find((x) => x.host_kind === k); return <li key={k} className="flex items-center justify-between gap-2"><HostKindChip kind={k} /><span className="num text-ink-2">{c?.suppressed ? t('m20.fs.hr.suppressedShort') : f.num(c?.n ?? 0)}</span></li>; })}
              </ul>
              <p className="mt-2 text-[12px] text-ink-3">{t('m20.sec.page.suppressed', { n: f.num(overview.min_group) })}</p>
            </Card>
          )}
          <Callout tone="info" title={t('m20.sec.page.securityTitle')}>{t('m20.sec.page.security')}</Callout>
          <Card title={t('m20.fs.hub.refsTitle')}>
            <ul className="space-y-2 text-[12.5px]">{FS28_REFS.map((r) => <li key={r.id}><SourceLink href={r.url} date={r.as_of}>{lang === 'ar' ? r.label_ar : r.label_en}</SourceLink></li>)}</ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}

export function SecondmentCard({ r, sessions, roles, skills, showName }: { r: SecondmentsRow; sessions: { id: string; status: string; planned_on?: string | null }[]; roles: JobRolesRow[]; skills: SkillsRow[]; showName?: boolean }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const pick = usePick();
  const roleTitle = useRoleTitle(roles);
  const today = todayIso();
  const phase = phaseOf(r, today);
  const session = r.capture_session_id ? sessions.find((s) => s.id === r.capture_session_id) : undefined;
  const tr = transferState(r, session ?? null, today);
  const objs = (r.objectives as unknown as { id: string; skill_id: string; level: number; text_en: string; text_ar: string }[]) ?? [];
  const met = (r.objectives_met as unknown as Record<string, boolean>) ?? {};
  return (
    <Card title={<span className="flex flex-wrap items-center gap-2">{showName && <span>{lang === 'ar' ? r.person_name_ar || r.person_name : r.person_name} ·</span>}{pick(r, 'host_name')}</span>} actions={<span className="flex flex-wrap gap-1.5"><SecPhasePill phase={phase} /><TransferPill state={tr} /></span>}>
      <div className="mb-3 flex flex-wrap gap-1.5"><HostKindChip kind={r.host_kind} /><TrackChip track={r.track} />{r.future_role_id && <L to={`/careers/roles/${r.future_role_id}`} className="chip border-accent/30 bg-accent-soft text-eyebrow hover:underline"><Icon name="briefcase" size={11} />{roleTitle(r.future_role_id)}</L>}</div>
      <KeyValue items={[
        [t('m20.sec.f.dates'), `${f.date(r.start_on)} – ${f.date(r.end_on)} · ${t('m20.sec.rot.months', { n: f.num(r.months) })}`],
        [t('m20.sec.f.country'), r.host_country],
        [t('m20.sec.f.supervisor'), pick(r, 'supervisor')],
        ...(r.returned_on ? [[t('m20.sec.f.returned'), f.date(r.returned_on)] as [string, string]] : []),
      ]} />
      <div className="mt-3">
        <div className="caps mb-1">{t('m20.sec.f.objectives')}</div>
        <ul className="space-y-1.5" data-testid="m20-sec-objectives">
          {objs.map((o) => (
            <li key={o.id} className="flex items-start gap-2 text-[13px]">
              <Icon name={met[o.id] === true ? 'check' : met[o.id] === false ? 'close' : 'sparkle'} size={13} className={met[o.id] === true ? 'mt-0.5 text-ok' : met[o.id] === false ? 'mt-0.5 text-bad' : 'mt-0.5 text-ink-3'} />
              <span className="flex-1">{lang === 'ar' ? o.text_ar : o.text_en}<span className="ms-1"><FutureSkillChips ids={[o.skill_id]} skills={skills} /></span></span>
            </li>
          ))}
        </ul>
      </div>
      {r.status === 'returned' && r.transfer_due_on && (
        <Callout tone={tr === 'overdue' ? 'bad' : tr === 'done' ? 'ok' : 'info'} title={t('m20.sec.f.transferTitle')}>
          <span data-testid="m20-sec-transfer">{t(`m20.sec.f.transfer.${tr}`, { due: f.date(r.transfer_due_on), planned: session?.planned_on ? f.date(String(session.planned_on)) : '—' })}</span>{' '}
          <L to={session ? `/knowledge/capture/${session.id}` : "/knowledge/capture"} className="font-semibold underline">{t('m20.sec.f.openCapture')}</L>
        </Callout>
      )}
      {r.status === 'cancelled' && r.outcome_note && <p className="mt-2 text-[12.5px] text-ink-3">{t('m20.sec.f.cancelled')}: {r.outcome_note}</p>}
    </Card>
  );
}
