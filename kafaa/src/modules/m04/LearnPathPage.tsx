// /learn/paths/:track (M04, public): one training path as an interactive timeline. Signed-in staff see their own progress
// (from their own records only). The security track is career-level only: status is qualified / not qualified.
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Page, Card, Callout, EmptyState, Icon, KeyValue, ProgressRing, Timeline, Skeleton } from '../../ui';
import { L, useFormat, useLang, useNav, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { PATH_BY_ID, TRAINING_PATHS, pathProgress, trackForRole, type StageState } from './paths';
import { Chip, G2Pill, SourceIds, useCatalogue, useMyEvidence } from './ui';

const DOT: Record<StageState, string> = { done: 'bg-ok text-white border-ok', current: 'bg-accent text-accent-ink border-accent', upcoming: 'bg-panel text-ink-3 border-line-strong' };

export default function LearnPathPage() {
  const { track = '' } = useParams();
  const t = useT();
  const lang = useLang();
  const pick = usePick();
  const f = useFormat();
  const nav = useNav();
  const s = useSession();
  const cat = useCatalogue();
  const ev = useMyEvidence();
  const path = PATH_BY_ID[track];
  const prog = useMemo(() => (path && ev.data ? pathProgress(path, ev.data) : null), [path, ev.data]);
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => {
    if (!path) return;
    setSel((cur) => cur ?? prog?.stages.find((x) => x.here)?.id ?? prog?.stages.find((x) => x.state === 'current')?.id ?? path.stages[0].id);
  }, [path, prog]);

  if (!path) {
    return (
      <Page title={t('m04.routes.learn-path.title')}>
        <EmptyState icon="info" title={t('m04.paths.notFound')} action={<L to="/learn/paths" className="btn-outline btn-sm">{t('m04.paths.all')}</L>} />
      </Page>
    );
  }
  const stage = path.stages.find((x) => x.id === sel) ?? path.stages[0];
  const sp = prog?.stages.find((x) => x.id === stage.id);
  const isMine = trackForRole(s.person?.job_role_id)?.id === path.id;
  const courseState = (cid: string) => (ev.data?.completedCourses.has(cid) ? 'completed' : ev.data?.activeCourses.has(cid) ? 'in_progress' : 'not_started');
  const stdState = (sid: string) => (ev.data?.qualifiedStandards.has(sid) ? 'qualified' : path.careerOnly ? 'not_qualified' : ev.data?.activeStandards.has(sid) ? 'in_progress' : 'not_started');

  return (
    <Page title={path.title[lang]} eyebrow={t('m04.paths.eyebrow')} intro={path.summary[lang]}
      actions={
        <label className="flex items-center gap-2">
          <span className="caps">{t('m04.paths.switch')}</span>
          <select className="input h-9 min-w-[200px]" value={path.id} onChange={(e) => { setSel(null); nav(`/learn/paths/${e.target.value}`); }} data-testid="m04-path-switch">
            {TRAINING_PATHS.map((p) => <option key={p.id} value={p.id}>{p.title[lang]}</option>)}
          </select>
        </label>
      }>
      {path.note && <Callout tone={path.careerOnly ? 'sim' : 'info'} title={path.careerOnly ? t('m04.paths.careerOnlyTitle') : t('m04.paths.noteTitle')}>{path.note[lang]}</Callout>}

      {s.status === 'signed_in' && ev.loading && !ev.data ? <Skeleton lines={2} /> : prog && (
        <Card className="flex flex-wrap items-center gap-4" padded>
          <ProgressRing value={prog.pct} size={64} tone={prog.pct === 100 ? 'ok' : 'accent'} />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{isMine ? t('m04.paths.yourProgress') : prog.onTrack ? t('m04.paths.progressOther') : t('m04.paths.notYourTrack')}</div>
            <div className="text-[13px] text-ink-2">{t('m04.paths.progressBody', { done: f.num(prog.stages.filter((x) => x.state === 'done').length), total: f.num(prog.stages.length) })}</div>
          </div>
          <L to="/my/learning" className="btn-outline btn-sm">{t('m04.learn.myLearning')}</L>
        </Card>
      )}
      {s.status !== 'signed_in' && <Callout title={t('m04.paths.signInTitle')}>{t('m04.paths.signInBody')} <L to={`/sign-in?next=/learn/paths/${path.id}`}>{t('m04.course.signIn')}</L></Callout>}

      <nav aria-label={t('m04.paths.timeline')} className="card overflow-x-auto p-4" data-testid="m04-path-timeline">
        <ol className="flex min-w-max items-start">
          {path.stages.map((st, i) => {
            const state: StageState = prog?.stages[i].state ?? 'upcoming';
            const here = prog?.stages[i].here;
            const active = st.id === stage.id;
            return (
              <li key={st.id} className="flex items-start">
                <button type="button" onClick={() => setSel(st.id)} aria-current={active ? 'step' : undefined} aria-pressed={active}
                  className={`group flex w-[150px] flex-col items-center gap-1.5 rounded-btn px-2 py-1 text-center ${active ? 'bg-accent-soft' : 'hover:bg-sunken'}`} data-testid={`m04-stage-${st.id}`}>
                  <span className={`num grid h-8 w-8 place-items-center rounded-full border-2 text-[12px] font-semibold ${prog ? DOT[state] : active ? DOT.current : DOT.upcoming}`}>
                    {prog && state === 'done' ? <Icon name="check" size={14} /> : f.num(i + 1)}
                  </span>
                  <span className={`text-[12.5px] leading-snug ${active ? 'font-semibold text-ink' : 'text-ink-2'}`}>{st.title[lang]}</span>
                  {here && <span className="chip border-accent/30 bg-accent-soft text-eyebrow">{t('m04.paths.youAreHere')}</span>}
                </button>
                {i < path.stages.length - 1 && <span className={`mt-4 h-0.5 w-8 ${prog && state === 'done' ? 'bg-ok' : 'bg-line-strong'}`} aria-hidden />}
              </li>
            );
          })}
        </ol>
      </nav>

      <Card as="section" eyebrow={t('m04.paths.stageN', { n: f.num(path.stages.indexOf(stage) + 1), total: f.num(path.stages.length) })} title={stage.title[lang]}
        actions={sp ? <G2Pill status={sp.state === 'done' ? 'completed' : sp.state === 'current' ? 'in_progress' : 'not_started'} /> : undefined}>
        <p>{stage.content[lang]}</p>
        <div className="mt-3">
          <KeyValue items={[
            ...(stage.length ? [[t('m04.paths.length'), stage.length[lang]] as [string, string]] : []),
            ...(stage.gate ? [[t('m04.paths.gate'), stage.gate[lang]] as [string, string]] : []),
          ]} />
        </div>
        {(stage.courses?.length ?? 0) > 0 && (
          <div className="mt-4">
            <div className="caps mb-1.5">{t('m04.paths.courses')}</div>
            <ul className="divide-y divide-line rounded-btn border border-line">
              {stage.courses!.map((cid) => {
                const c = cat.course.get(cid);
                return (
                  <li key={cid} className="flex items-center justify-between gap-2 px-3 py-2 text-[13.5px]">
                    {c ? <L to={`/learn/course/${cid}`}>{c.code} · {pick(c, 'title')}</L> : <span className="text-ink-2">{t('m04.paths.internalCourse')}</span>}
                    {ev.data && <G2Pill status={courseState(cid)} />}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {ev.data && (stage.standards?.length ?? 0) > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="caps">{t('m04.paths.qualification')}</span>
            {stage.standards!.map((sid) => <G2Pill key={sid} status={stdState(sid)} tone={stdState(sid) === 'qualified' ? 'ok' : path.careerOnly ? 'neutral' : undefined} />)}
            <span className="text-[12px] text-ink-3">{t('m04.paths.mirror')}</span>
          </div>
        )}
        {ev.data && stage.licence && <div className="mt-2 flex items-center gap-2"><span className="caps">{t('m04.paths.licence')}</span><G2Pill status={ev.data.licences.has(stage.licence) ? 'valid' : 'not_held'} tone={ev.data.licences.has(stage.licence) ? 'ok' : 'neutral'} /><span className="text-[12px] text-ink-3">{t('m04.paths.licenceMirror')}</span></div>}
        {(stage.links?.length ?? 0) > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">{stage.links!.map((k) => <L key={k.to} to={k.to} className="btn-outline btn-sm">{k.label[lang]}<Icon name="chevron" size={14} /></L>)}</div>
        )}
        <div className="mt-3 border-t border-line pt-2"><SourceIds ids={stage.sources} /></div>
      </Card>

      <Card title={t('m04.paths.allStages')}>
        <Timeline items={path.stages.map((st, i) => ({
          id: st.id, when: t('m04.paths.stageN', { n: f.num(i + 1), total: f.num(path.stages.length) }), title: st.title[lang],
          detail: [st.length?.[lang], st.gate ? `${t('m04.paths.gate')}: ${st.gate[lang]}` : null].filter(Boolean).join(' · '),
          tone: prog ? (prog.stages[i].state === 'done' ? 'ok' : prog.stages[i].state === 'current' ? 'accent' : 'neutral') : 'neutral',
        }))} />
      </Card>
      {isMine && <div className="flex flex-wrap gap-1.5"><Chip tone="accent">{t('m04.paths.yourTrack')}</Chip></div>}
    </Page>
  );
}
