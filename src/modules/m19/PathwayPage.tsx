// FS17 /learn/pathways/:id (staff): one pathway resolved at run time (rpc.pathwayDetail = SQL kafaa_pathway_detail): the envelope and
// weekly hour cost against total hours, colleagues' completion time (suppressed under 10), the learn -> practice -> assess steps with the
// items that teach the skill at this level (external items carry a chip; a step with nothing is "requested" and sits in the gap backlog),
// and my progress, derived from my records (self-declared external completions are labelled). Start, complete and leave are audited RPCs.
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Page, Section, Card, Async, EmptyState, StatTile, BenchmarkChips, Icon, StatusPill, Callout, ConfirmDialog, ProgressBar, WhyThis, SourceLink } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { L, useFormat, useLang, usePick, useT } from '../../i18n';
import { ExternalChip, ItemLink, KIND_ICON, LevelPill, PeerLine, SelfDeclaredChip, CompleteExternalModal, useFsCoach, useMyCompletions, usePwRef, skillName, type Row } from './fsui';
import type { PathwayDetail } from './backend/rpc';

export default function PathwayPage() {
  const t = useT();
  const { id = '' } = useParams();
  const repo = useRepo();
  const ref = usePwRef();
  const det = useQuery(['pathways', 'pathway_steps', 'pathway_enrolments', 'external_completions', 'training_records'], () => repo.rpc.pathwayDetail(id), [id]);
  return (
    <Page title={t('m19.routes.learn-pathway.title')} intro={t('m19.pw.det.intro')} wide eyebrow={<BenchmarkChips feature="FS17" />}
      actions={<L to="/learn/pathways" className="btn-outline btn-sm no-underline"><Icon name="back" size={14} className="rtl:-scale-x-100" /> {t('m19.pw.det.back')}</L>}>
      <Async state={ref}>{(d) => (
        <Async state={det} isEmpty={(x) => !x} empty={<EmptyState title={t('m19.pw.det.notFound')}>{t('m19.pw.det.notFoundBody')}</EmptyState>}>
          {(x) => x && <Detail d={x} skills={d.skills} pathway={d.pathways.find((q) => q.id === id) ?? null} externals={d.externals} />}
        </Async>
      )}</Async>
    </Page>
  );
}

function Detail({ d, skills, pathway, externals }: { d: PathwayDetail; skills: Row[]; pathway: Row | null; externals: Row[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lang = useLang();
  const repo = useRepo();
  const run = useAction();
  const coach = useFsCoach();
  const mine = useMyCompletions();
  const [confirm, setConfirm] = useState<'start' | 'complete' | 'leave' | null>(null);
  const [record, setRecord] = useState<Row | null>(null);
  const r = d.resolved;
  const skill = skills.find((s) => s.id === r.skill_id);
  const prog = d.mine?.progress ?? null;
  const stepProg = new Map((prog?.steps ?? []).map((s) => [s.step_id, s]));
  const ranked = coach.data?.ranked.find((x) => x.id === d.pathway_id);
  const active = d.mine?.status === 'active';
  const title = pathway ? pick(pathway, 'title') : d.pathway_id;
  return (
    <div className="space-y-6">
      <Card eyebrow={<span className="flex flex-wrap items-center gap-2"><LevelPill level={r.level} />{skill && <L to={`/skills/${skill.id}`}>{pick(skill, 'name')}</L>}{pathway?.status !== 'published' && <StatusPill tone="sim">{t(`m19.pw.status.${pathway?.status ?? 'draft'}`)}</StatusPill>}</span>}
        title={<span data-testid="m19-pw-title">{title}</span>}
        actions={ranked ? <WhyThis reasons={ranked.reasons} testId="m19-pw-det-why" /> : undefined}>
        {pathway && <p className="text-[14px] text-ink-2">{pick(pathway, 'summary')}</p>}
        {pathway && pick(pathway, 'outcome') && <p className="mt-2 text-[13.5px]"><span className="font-semibold">{t('m19.pw.det.outcome')}</span> {pick(pathway, 'outcome')}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {d.can_follow && !d.mine && <button type="button" className="btn-primary btn-sm" onClick={() => setConfirm('start')} data-testid="m19-pw-start"><Icon name="plus" size={14} />{t('m19.pw.det.start')}</button>}
          {d.can_follow && d.mine?.status === 'withdrawn' && <button type="button" className="btn-primary btn-sm" onClick={() => setConfirm('start')} data-testid="m19-pw-start">{t('m19.pw.det.restart')}</button>}
          {active && <button type="button" className="btn-primary btn-sm" disabled={!prog?.complete} title={prog?.complete ? undefined : t('m19.pw.det.completeHint')} onClick={() => setConfirm('complete')} data-testid="m19-pw-complete"><Icon name="check" size={14} />{t('m19.pw.det.complete')}</button>}
          {active && <button type="button" className="btn-ghost btn-sm" onClick={() => setConfirm('leave')} data-testid="m19-pw-leave">{t('m19.pw.det.leave')}</button>}
          {d.mine && <StatusPill tone={d.mine.status === 'completed' ? 'ok' : d.mine.status === 'active' ? 'accent' : 'neutral'}>{t(`m19.pw.mine.${d.mine.status}`)}</StatusPill>}
          {d.mine && <span className="text-[12.5px] text-ink-3">{d.mine.completed_on ? t('m19.pw.det.completedOn', { date: f.date(d.mine.completed_on) }) : t('m19.pw.det.startedOn', { date: f.date(d.mine.started_on) })}</span>}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="m19-pw-det-tiles">
        <StatTile label={t('m19.pw.det.tileEnvelope')} value={t('m19.pw.monthsN', { n: f.num(Number(pathway?.envelope_months ?? 0)) })} sub={t('m19.pw.det.tileEnvelopeSub', { n: f.num(r.weeks) })} />
        <StatTile label={t('m19.pw.det.tileWeekly')} value={t('m19.pw.hoursN', { n: f.num(Number(pathway?.weekly_hours ?? 0)) })} sub={t('m19.pw.det.tileWeeklySub')} />
        <StatTile label={t('m19.pw.det.tileTotal')} value={t('m19.pw.hoursN', { n: f.num(r.total_hours) })} sub={t('m19.pw.det.tileTotalSub', { cap: f.num(r.capacity) })} tone={r.fits ? 'ok' : 'bad'} />
        <StatTile label={t('m19.pw.det.tilePeers')} value={d.peer.suppressed ? <span className="text-[18px]">{t('m19.pw.suppressed')}</span> : t('m19.pw.weeksN', { n: f.num(d.peer.median_weeks) })}
          sub={d.peer.suppressed ? t('m19.pw.det.tilePeersSuppressed') : t('m19.pw.det.tilePeersSub', { n: f.num(d.peer.completed) })} />
      </div>

      {prog && (
        <Card title={t('m19.pw.det.progressTitle')} eyebrow={t('m19.pw.det.progressEyebrow')}>
          <div data-testid="m19-pw-progress" data-pct={prog.pct}><ProgressBar value={prog.pct} label={t('m19.pw.det.progressLabel', { done: f.num(prog.done), total: f.num(prog.total) })} /></div>
          <p className="mt-2 text-[13px] text-ink-2">{t('m19.pw.det.progressBody', { done: f.num(prog.done), total: f.num(prog.total) })}</p>
          {prog.self_declared > 0 && <p className="mt-1 text-[12.5px] text-ink-3"><SelfDeclaredChip /> {t('m19.pw.det.progressSelf', { n: f.num(prog.self_declared) })}</p>}
        </Card>
      )}

      <Section title={t('m19.pw.det.stepsTitle')} description={t('m19.pw.det.stepsIntro')}>
        <ol className="relative space-y-3 border-s-2 border-line ps-5" data-testid="m19-pw-steps">
          {r.steps.map((s) => {
            const sp = stepProg.get(s.step_id);
            return (
              <li key={s.step_id} className="relative" data-testid="m19-pw-step" data-kind={s.kind} data-status={s.status} data-done={sp?.done ? 'true' : 'false'}>
                <span className={`absolute -start-[31px] top-3 flex h-6 w-6 items-center justify-center rounded-full border-2 ${sp?.done ? 'border-ok bg-ok-bg text-ok' : s.status === 'requested' ? 'border-sim-line bg-sim-bg text-ink-3' : 'border-accent/50 bg-panel text-eyebrow'}`} aria-hidden="true">
                  <Icon name={sp?.done ? 'check' : KIND_ICON[s.kind]} size={12} />
                </span>
                <div className={`card p-3.5 ${s.status === 'requested' ? 'border-dashed' : ''}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="num text-[12px] text-ink-3">{f.num(s.n)}.</span>
                    <span className="caps">{t(`m19.pw.kind.${s.kind}`)}</span>
                    <span className="font-semibold">{lang === 'ar' ? s.title_ar : s.title_en}</span>
                    <span className="text-[12.5px] text-ink-3">{t('m19.pw.hoursN', { n: f.num(s.hours) })}</span>
                    {sp?.done && <StatusPill tone="ok">{t('m19.pw.det.stepDone')}</StatusPill>}
                    {sp?.self_declared && <SelfDeclaredChip />}
                    {s.status === 'requested' && <StatusPill tone="sim">{t('m19.pw.det.requested')}</StatusPill>}
                  </div>
                  {s.status === 'requested' ? (
                    <p className="mt-2 text-[13px] text-ink-2" data-testid="m19-pw-requested-note">{t('m19.pw.det.requestedBody')}</p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {s.items.map((it) => {
                        const ext = it.type === 'external' ? externals.find((x) => x.id === it.id) : null;
                        return (
                          <li key={`${it.type}:${it.id}`} className="flex flex-wrap items-center justify-between gap-2">
                            <ItemLink item={it} />
                            {ext && active && !mine.get(ext.id) && <button type="button" className="btn-ghost btn-sm" onClick={() => setRecord(ext)} data-testid="m19-pw-record">{t('m19.xr.record')}</button>}
                            {ext && mine.get(ext.id) && <SelfDeclaredChip />}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </Section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Callout title={t('m19.pw.det.peersTitle')}><PeerLine peer={d.peer} /><span className="mt-1 block text-[12.5px]">{t('m19.pw.det.peersBody')}</span></Callout>
        <Callout tone="sim" title={t('m19.pw.det.externalTitle')}><span className="flex flex-wrap items-center gap-1"><ExternalChip /> {t('m19.pw.det.externalBody')}</span></Callout>
      </div>
      {pathway && (pathway.sources ?? []).length > 0 && (
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-[12px]" data-testid="m19-pw-sources">
          {(pathway.sources as Row[]).map((s) => <SourceLink key={s.url} href={s.url} date={s.accessed ?? null}>{s.label}</SourceLink>)}
        </p>
      )}
      <p className="text-[12px] text-ink-3">{t('m19.pw.det.skillLink', { skill: skill ? skillName(skills, skill.id, pick) : r.skill_id })}</p>

      <ConfirmDialog open={confirm === 'start'} onClose={() => setConfirm(null)} title={t('m19.pw.det.startTitle')}
        consequence={t('m19.pw.det.startBody', { months: f.num(Number(pathway?.envelope_months ?? 0)), hours: f.num(Number(pathway?.weekly_hours ?? 0)) })}
        onConfirm={() => run(() => repo.rpc.startPathway(d.pathway_id), { success: t('m19.pw.det.started') })} />
      <ConfirmDialog open={confirm === 'complete'} onClose={() => setConfirm(null)} title={t('m19.pw.det.completeTitle')}
        consequence={prog?.self_declared ? t('m19.pw.det.completeBodySelf', { n: f.num(prog.self_declared) }) : t('m19.pw.det.completeBody')}
        onConfirm={() => run(() => repo.rpc.completePathway(d.pathway_id), { success: t('m19.pw.det.completed') })} />
      <ConfirmDialog open={confirm === 'leave'} onClose={() => setConfirm(null)} title={t('m19.pw.det.leaveTitle')} consequence={t('m19.pw.det.leaveBody')} danger
        onConfirm={(reason) => run(() => repo.rpc.withdrawPathway(d.pathway_id, reason || null), { success: t('m19.pw.det.left') })} />
      <CompleteExternalModal resource={record} open={!!record} onClose={() => setRecord(null)} />
    </div>
  );
}
