// /training/sat/survey (M26 · F27): the DIF survey for subject-matter experts. A person with an F21 SME profile who holds a role
// whose job analysis is in "DIF survey" rates each task of that role on difficulty, importance and frequency (1 to 5). Nobody
// else sees a survey here; training staff rate from the workbench. Restricted tasks never appear.
import { useState } from 'react';
import { Page, Card, Async, EmptyState, Callout, ProgressBar, TextField } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { useFormat, usePick, useT } from '../../i18n';
import type { DifSurvey, SurveyTask } from './backend/rpc';
import { RatingInputs } from './ui';

export default function DifSurveyPage() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const q = useQuery(['dif_ratings', 'jta_analyses', 'jta_tasks'], () => repo.rpc.difSurvey(), [s.identity.personId]);
  return (
    <Page title={t('m26.routes.training-sat-survey.title')} intro={t('m26.survey.intro')}>
      <Async state={q}>{(sv) => (sv.open ? <Survey sv={sv} /> : <EmptyState icon="info" title={t('m26.survey.noneTitle')}>{t('m26.survey.noneBody')}</EmptyState>)}</Async>
    </Page>
  );
}

function Survey({ sv }: { sv: DifSurvey }) {
  const t = useT();
  const f = useFormat();
  const done = sv.tasks.filter((x) => x.mine).length;
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
          <span>{t('m26.survey.progress', { a: f.num(done), b: f.num(sv.tasks.length) })}</span>
          <span className="text-ink-2">{t('m26.survey.anonymity')}</span>
        </div>
        <div className="mt-2"><ProgressBar value={sv.tasks.length ? (100 * done) / sv.tasks.length : 0} tone={done === sv.tasks.length ? 'ok' : 'accent'} label={t('m26.survey.progressLabel')} /></div>
      </Card>
      <Callout>{t('m26.survey.scales')}</Callout>
      <ol className="space-y-3" data-testid="m26-survey">
        {sv.tasks.map((x, k) => <li key={x.id}><SurveyItem x={x} n={k + 1} /></li>)}
      </ol>
    </div>
  );
}

function SurveyItem({ x, n }: { x: SurveyTask; n: number }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const [v, setV] = useState({ d: String(x.mine?.d ?? ''), i: String(x.mine?.i ?? ''), f: String(x.mine?.f ?? ''), note: x.mine?.note ?? '' });
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[12px] text-ink-3"><span className="num">{f.num(n)}</span> · {x.code}{pick(x, 'duty') ? ` · ${pick(x, 'duty')}` : ''}</div>
          <div className="font-semibold">{pick(x, 'title')}</div>
        </div>
        {x.mine ? <span className="chip border-ok-line bg-ok-bg text-ok">{t('m26.survey.rated')}</span> : <span className="chip border-line bg-sunken text-ink-2">{t('m26.survey.toRate')}</span>}
      </div>
      <div className="mt-3"><RatingInputs v={v} setV={setV as never} /></div>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <div className="min-w-[12rem] flex-1"><TextField label={t('m26.dif.note')} name={`note-${x.id}`} value={v.note} onChange={(z) => setV({ ...v, note: z })} /></div>
        <button className="btn-primary" disabled={!v.d || !v.i || !v.f} data-testid="m26-survey-save" onClick={() => run(() => repo.rpc.rateDif(x.id, Number(v.d), Number(v.i), Number(v.f), v.note))}>{x.mine ? t('m26.survey.update') : t('m26.survey.save')}</button>
      </div>
    </Card>
  );
}
