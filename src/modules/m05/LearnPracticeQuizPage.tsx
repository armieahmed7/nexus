// /learn/practice/:form (M05, public): take a practice quiz one question at a time with instant explanations.
// Practice items are public by design; secure exam items never appear here. Nothing is sent to the server.
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Page, Card, Async, EmptyState, ProgressBar, Callout, Icon, StatTile, Grid } from '../../ui';
import { useQuery, useRepo } from '../../data';
import type { ItemVersionsRow } from '../../data/types';
import { L, useFormat, useLang, usePick, useT } from '../../i18n';
import { saveBest, readBest } from './practiceStore';

type Opt = { id: string; en: string; ar: string };

export default function LearnPracticeQuizPage() {
  const { form = '' } = useParams();
  const t = useT();
  const repo = useRepo();
  const pick = usePick();
  const q = useQuery(['assessment_forms', 'item_versions', 'items'], async () => {
    const f = await repo.get('assessment_forms', form);
    if (!f || !f.is_practice) return null;
    const [versions, items] = await Promise.all([repo.list('item_versions', { filter: { item_id: f.item_ids, is_practice: true } }), repo.list('items', { filter: { id: f.item_ids } })]);
    const current = f.item_ids.map((id) => { const it = items.find((x) => x.id === id && x.status === 'approved'); return it ? versions.find((v) => v.item_id === id && v.version === it.current_version) : undefined; }).filter(Boolean) as ItemVersionsRow[];
    return { f, questions: current };
  }, [form]);
  return (
    <Async state={q} isEmpty={(d) => !d || d.questions.length === 0} empty={<Page title={t('m05.routes.learn-practice-quiz.title')}><EmptyState icon="book" title={t('m05.quiz.notFound')} action={<L to="/learn/practice" className="btn-outline btn-sm">{t('m05.quiz.back')}</L>} /></Page>}>
      {(d) => d && <Quiz key={d.f.id} formId={d.f.id} title={pick(d.f, 'title')} audience={pick(d.f, 'audience')} minutes={d.f.time_limit_min} questions={d.questions} />}
    </Async>
  );
}

function Quiz({ formId, title, audience, minutes, questions }: { formId: string; title: string; audience: string; minutes: number; questions: ItemVersionsRow[] }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const [started, setStarted] = useState(false);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!started || done) return;
    const h = setInterval(() => setElapsed((x) => x + 1), 1000);
    return () => clearInterval(h);
  }, [started, done]);
  const correct = useMemo(() => questions.filter((v) => answers[v.item_id] === v.answer).length, [questions, answers]);
  const score = Math.round((correct * 100) / questions.length);
  useEffect(() => { if (done) saveBest(formId, score); }, [done, formId, score]);
  const best = readBest(formId);
  const q = questions[i];
  const opts = (q?.options ?? []) as Opt[];
  const txt = (o: { en: string; ar: string }) => (lang === 'ar' ? o.ar || o.en : o.en);
  const mmss = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
  const restart = () => { setAnswers({}); setChecked({}); setI(0); setDone(false); setElapsed(0); setStarted(true); };

  if (!started) {
    return (
      <Page title={title} eyebrow={t('m05.practice.eyebrow')} intro={audience} actions={<L to="/learn/practice" className="btn-outline btn-sm"><Icon name="back" size={14} />{t('m05.quiz.back')}</L>}>
        <Card title={t('m05.quiz.ready')}>
          <ul className="list-disc space-y-1 ps-5 text-ink-2">
            <li>{t('m05.quiz.rule1', { n: f.num(questions.length) })}</li>
            <li>{t('m05.quiz.rule2', { n: f.num(minutes) })}</li>
            <li>{t('m05.quiz.rule3')}</li>
          </ul>
          {best != null && <p className="mt-2 text-[13px]">{t('m05.practice.best', { n: f.pct(best, 0) })}</p>}
          <button className="btn-primary mt-4" onClick={() => setStarted(true)} data-testid="m05-quiz-start">{t('m05.practice.start')}</button>
        </Card>
      </Page>
    );
  }

  if (done) {
    return (
      <Page title={title} eyebrow={t('m05.quiz.result')}>
        <Grid cols={3}>
          <StatTile label={t('m05.quiz.score')} value={f.pct(score, 0)} tone={score >= 80 ? 'ok' : 'info'} sub={t('m05.quiz.correctOf', { n: f.num(correct), total: f.num(questions.length) })} />
          <StatTile label={t('m05.quiz.time')} value={<span className="ltr">{mmss}</span>} sub={t('m05.quiz.timeSub', { n: f.num(minutes) })} />
          <StatTile label={t('m05.quiz.bestLabel')} value={f.pct(Math.max(best ?? 0, score), 0)} sub={t('m05.quiz.bestSub')} />
        </Grid>
        {score >= 80 && <Callout tone="ok" title={t('m05.quiz.badgeTitle')}>{t('m05.quiz.badge')}</Callout>}
        <Card title={t('m05.quiz.review')}>
          <ol className="space-y-3" data-testid="m05-quiz-review">
            {questions.map((v, k) => {
              const ok = answers[v.item_id] === v.answer;
              const right = (v.options as Opt[]).find((o) => o.id === v.answer);
              return (
                <li key={v.id} className="rounded-btn border border-line p-3">
                  <div className="flex items-start gap-2"><Icon name={ok ? 'check' : 'close'} className={ok ? 'text-ok' : 'text-bad'} /><div><div className="font-semibold">{f.num(k + 1)}. {txt({ en: v.stem_en, ar: v.stem_ar })}</div>
                    <div className="mt-1 text-[13px]">{t('m05.quiz.correctAnswer')}: {right ? txt(right) : '—'}</div>
                    <div className="text-[13px] text-ink-2">{txt({ en: v.rationale_en, ar: v.rationale_ar })}</div></div></div>
                </li>
              );
            })}
          </ol>
        </Card>
        <div className="flex gap-2"><button className="btn-primary" onClick={restart} data-testid="m05-quiz-retake">{t('m05.quiz.retake')}</button><L to="/learn/practice" className="btn-outline">{t('m05.quiz.other')}</L><L to="/learn" className="btn-ghost">{t('m05.quiz.toLearn')}</L></div>
      </Page>
    );
  }

  const chosen = answers[q.item_id];
  const isChecked = checked[q.item_id];
  return (
    <Page title={title} eyebrow={t('m05.quiz.questionOf', { n: f.num(i + 1), total: f.num(questions.length) })} actions={<span className="num chip border-line bg-sunken text-ink-2" aria-live="off"><Icon name="calendar" size={12} /><span className="ltr">{mmss}</span></span>}>
      <ProgressBar value={((i + (isChecked ? 1 : 0)) * 100) / questions.length} label={t('m05.quiz.progress')} />
      <Card>
        <fieldset>
          <legend className="text-[17px] font-semibold leading-snug">{txt({ en: q.stem_en, ar: q.stem_ar })}</legend>
          <div className="mt-4 space-y-2" role="radiogroup">
            {opts.map((o) => {
              const sel = chosen === o.id;
              const state = isChecked ? (o.id === q.answer ? 'right' : sel ? 'wrong' : '') : '';
              return (
                <label key={o.id} className={`flex cursor-pointer items-center gap-3 rounded-btn border p-3 ${state === 'right' ? 'border-ok-line bg-ok-bg' : state === 'wrong' ? 'border-bad-line bg-bad-bg' : sel ? 'border-accent bg-accent-soft' : 'border-line hover:bg-sunken'}`}>
                  <input type="radio" name={q.item_id} value={o.id} checked={sel} disabled={isChecked} onChange={() => setAnswers({ ...answers, [q.item_id]: o.id })} className="accent-[rgb(var(--accent))]" />
                  <span className="num w-5 font-semibold uppercase text-ink-3">{o.id}</span><span>{txt(o)}</span>
                  {state === 'right' && <Icon name="check" className="ms-auto text-ok" />}{state === 'wrong' && <Icon name="close" className="ms-auto text-bad" />}
                </label>
              );
            })}
          </div>
        </fieldset>
        {isChecked && (
          <div aria-live="polite" className="mt-4">
            <Callout tone={chosen === q.answer ? 'ok' : 'bad'} title={chosen === q.answer ? t('m05.quiz.right') : t('m05.quiz.wrong')}>{txt({ en: q.rationale_en, ar: q.rationale_ar })}</Callout>
          </div>
        )}
        <div className="mt-4 flex justify-between gap-2">
          <button className="btn-ghost" disabled={i === 0} onClick={() => setI(i - 1)}><Icon name="back" size={14} />{t('common.prev')}</button>
          {!isChecked ? <button className="btn-primary" disabled={!chosen} onClick={() => setChecked({ ...checked, [q.item_id]: true })} data-testid="m05-quiz-check">{t('m05.quiz.check')}</button>
            : i < questions.length - 1 ? <button className="btn-primary" onClick={() => setI(i + 1)} data-testid="m05-quiz-next">{t('common.next')}<Icon name="chevron" size={14} /></button>
            : <button className="btn-primary" onClick={() => setDone(true)} data-testid="m05-quiz-finish">{t('m05.quiz.finish')}</button>}
        </div>
      </Card>
    </Page>
  );
}
