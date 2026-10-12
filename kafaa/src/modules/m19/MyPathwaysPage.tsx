// FS17 /my/pathways (skills_profile Own): the pathways I follow (progress derived from my records, never typed in), the ones I
// finished or left, my self-declared external completions (FS18; labelled, never verified evidence), and the Coach's ranked
// pathways for my 2030 role gaps as well as today's. Private: nobody else reads these rows.
import { Page, Section, Async, EmptyState, BenchmarkChips, Icon, StatusPill, Tabs, ProgressBar, Callout } from '../../ui';
import { useQuery, useRepo, type Table } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { EnvelopeLine, LevelPill, SelfDeclaredChip, skillName, usePwRef, type PwRef, type Row } from './fsui';
import { FutureSkillsCoach } from './FutureSkillsCoach';

export default function MyPathwaysPage() {
  const t = useT();
  const ref = usePwRef();
  return (
    <Page title={t('m19.routes.my-pathways.title')} intro={t('m19.pw.my.intro')} wide eyebrow={<BenchmarkChips feature="FS17" />}
      actions={<span className="flex flex-wrap gap-2">
        <L to="/learn/pathways" className="btn-outline btn-sm no-underline"><Icon name="grad" size={14} /> {t('m19.pw.my.browse')}</L>
        <L to={`/ask?mode=future&q=${encodeURIComponent(t('m19.pw.my.askQ'))}`} className="btn-outline btn-sm no-underline" data-testid="m19-pw-ask-dalil">{t('m19.pw.my.askDalil')}</L>{/* FS76 (wave-H integration) */}
      </span>}>
      <Async state={ref}>{(d) => <Mine d={d} />}</Async>
    </Page>
  );
}

function Mine({ d }: { d: PwRef }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const s = useSession();
  const me = s.identity.personId;
  const q = useQuery(['pathway_enrolments', 'external_completions', 'training_records'] as Table[], async () => {
    if (!me) return null;
    const enrol = (await repo.list('pathway_enrolments' as Table, { filter: { person_id: me } } as never).catch(() => [])) as Row[];
    const details = await Promise.all(enrol.map((e) => repo.rpc.pathwayDetail(e.pathway_id).catch(() => null)));
    const done = (await repo.list('external_completions' as Table, { filter: { person_id: me } } as never).catch(() => [])) as Row[];
    return { enrol, details, done };
  }, [me]);
  return (
    <Async state={q}>{(x) => {
      if (!x) return <EmptyState title={t('m19.pw.my.none')} />;
      const rows = x.enrol.map((e, i) => ({ e, det: x.details[i], p: d.pathways.find((p) => p.id === e.pathway_id) })).filter((r) => r.p);
      const list = (status: string) => rows.filter((r) => r.e.status === status);
      const card = ({ e, det, p }: (typeof rows)[number]) => (
        <li key={e.id} className="card p-4" data-testid="m19-my-pw" data-status={e.status} data-pathway={e.pathway_id}>
          <div className="flex flex-wrap items-center gap-2"><LevelPill level={Number(p!.level)} /><span className="text-[12.5px] text-ink-3">{skillName(d.skills, p!.skill_id, pick)}</span>
            <StatusPill tone={e.status === 'completed' ? 'ok' : e.status === 'active' ? 'accent' : 'neutral'}>{t(`m19.pw.mine.${e.status}`)}</StatusPill></div>
          <h3 className="mt-1 text-[15px] font-semibold"><L to={`/learn/pathways/${e.pathway_id}`}>{pick(p!, 'title')}</L></h3>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1"><EnvelopeLine months={Number(p!.envelope_months)} weekly={Number(p!.weekly_hours)} />
            <span className="text-[12.5px] text-ink-3">{e.completed_on ? t('m19.pw.det.completedOn', { date: f.date(e.completed_on) }) : e.withdrawn_on ? t('m19.pw.my.leftOn', { date: f.date(e.withdrawn_on) }) : t('m19.pw.det.startedOn', { date: f.date(e.started_on) })}</span></div>
          {e.status === 'active' && det?.mine && (
            <div className="mt-3" data-testid="m19-my-pw-progress" data-pct={det.mine.progress.pct}>
              <ProgressBar value={det.mine.progress.pct} label={t('m19.pw.det.progressLabel', { done: f.num(det.mine.progress.done), total: f.num(det.mine.progress.total) })} />
              <p className="mt-1 text-[12.5px] text-ink-3">{t('m19.pw.det.progressBody', { done: f.num(det.mine.progress.done), total: f.num(det.mine.progress.total) })}{det.mine.progress.self_declared ? ` · ${t('m19.pw.det.progressSelf', { n: f.num(det.mine.progress.self_declared) })}` : ''}</p>
            </div>
          )}
          {e.withdrawn_reason && <p className="mt-2 text-[12.5px] text-ink-3">{e.withdrawn_reason}</p>}
        </li>
      );
      const ext = (id: string) => d.externals.find((z) => z.id === id);
      return (
        <div className="space-y-6">
          <Tabs initial="active" tabs={[
            { id: 'active', label: t('m19.pw.my.tabActive'), badge: list('active').length, content: list('active').length ? <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="m19-my-active">{list('active').map(card)}</ul> : <EmptyState icon="grad" title={t('m19.pw.my.activeEmpty')} action={<L to="/learn/pathways" className="btn-primary btn-sm">{t('m19.pw.my.browse')}</L>}>{t('m19.pw.my.activeEmptyBody')}</EmptyState> },
            { id: 'completed', label: t('m19.pw.my.tabDone'), badge: list('completed').length, content: list('completed').length ? <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">{list('completed').map(card)}</ul> : <EmptyState icon="check" title={t('m19.pw.my.doneEmpty')} /> },
            { id: 'withdrawn', label: t('m19.pw.my.tabLeft'), badge: list('withdrawn').length, content: list('withdrawn').length ? <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">{list('withdrawn').map(card)}</ul> : <EmptyState icon="info" title={t('m19.pw.my.leftEmpty')} /> },
            { id: 'external', label: t('m19.pw.my.tabExternal'), badge: x.done.length, content: x.done.length ? (
              <ul className="space-y-2" data-testid="m19-my-external">
                {x.done.map((c) => (
                  <li key={c.id} className="card flex flex-wrap items-center justify-between gap-2 p-3">
                    <span className="min-w-0"><span className="font-semibold">{ext(c.resource_id) ? pick(ext(c.resource_id)!, 'title') : c.resource_id}</span>
                      <span className="block text-[12.5px] text-ink-3">{t('m19.xr.recordedOn', { date: f.date(c.completed_on) })}{c.note ? ` · ${c.note}` : ''}</span></span>
                    {c.evidence === 'verified' ? <StatusPill tone="ok">{t('m19.xr.verified')}</StatusPill> : <SelfDeclaredChip />}
                  </li>
                ))}
              </ul>
            ) : <EmptyState icon="external" title={t('m19.pw.my.externalEmpty')} action={<L to="/learn/external" className="btn-outline btn-sm">{t('m19.pw.cat.toExternal')}</L>} /> },
          ]} />
          <Section title={t('m19.pw.my.coachTitle')} description={t('m19.pw.my.coachIntro')}><FutureSkillsCoach compact /></Section>
          <Callout title={t('m19.coach.privacyTitle')}>{t('m19.pw.my.privacy')}</Callout>
        </div>
      );
    }}</Async>
  );
}
