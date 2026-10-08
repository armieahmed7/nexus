// F07 "Ask the coach": retrieval Q&A over the catalogue, training paths and FAQ (F02 SearchEngine), answered with a
// template and citations. Never uses assessment items; questions asking for exam content get a fixed refusal.
import { useMemo, useState } from 'react';
import { Card, EngineBadge, Icon, StatusPill, Callout } from '../../ui';
import { useEngine } from '../../data';
import { L, useLang, useT } from '../../i18n';
import { TRAINING_PATHS } from '../m04/paths';
import { askCoach, buildAskCorpus, type AskAnswer, type AskDoc } from './ask';
import type { CoachTables } from './inputs';

export const ASK_EXAMPLES = ['radiation', 'chemistry', 'coit'] as const;

export function AskCoach({ t: tables }: { t: CoachTables }) {
  const t = useT();
  const lang = useLang();
  const eng = useEngine('search');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<AskAnswer | null>(null);
  const corpus = useMemo(() => {
    const docs = buildAskCorpus({ courses: tables.courses as never, modules: (tables.course_modules ?? []) as never, competencies: tables.competencies as never, forms: tables.assessment_forms as never, paths: TRAINING_PATHS as never, programmes: (tables.programmes ?? []) as never, faqs: (tables.faqs ?? []) as never });
    return { docs, index: eng.search<AskDoc>(docs) };
  }, [tables, eng]);
  const ask = (q: string) => {
    setQuestion(q);
    setAnswer(askCoach(q, corpus.docs, { roles: tables.job_roles as never, roleComps: tables.role_competencies as never, index: corpus.index }));
  };
  const pickT = (b: { en: string; ar: string } | undefined) => (b ? (lang === 'ar' && b.ar ? b.ar : b.en) : '');
  const vars = answer ? Object.fromEntries(Object.entries(answer.vars).map(([k, v]) => [k, typeof v === 'object' ? pickT(v) : String(v)])) : {};
  return (
    <div className="space-y-4">
      <Card title={t('m19.ask.title')} actions={<EngineBadge engine={eng} />}>
        <p className="mb-3 text-[13.5px] text-ink-2">{t('m19.ask.intro')}</p>
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); ask(question); }} role="search">
          <label htmlFor="m19-ask-input" className="sr-only">{t('m19.ask.label')}</label>
          <input id="m19-ask-input" className="input min-w-0 flex-1" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={t('m19.ask.placeholder')} data-testid="m19-ask-input" maxLength={300} />
          <button type="submit" className="btn-primary" data-testid="m19-ask-submit"><Icon name="search" size={14} />{t('m19.ask.submit')}</button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="text-[12.5px] text-ink-3">{t('m19.ask.tryLabel')}</span>
          {ASK_EXAMPLES.map((k) => <button key={k} type="button" className="chip border-line bg-sunken text-ink-2 hover:text-ink" onClick={() => ask(t(`m19.ask.examples.${k}`))}>{t(`m19.ask.examples.${k}`)}</button>)}
        </div>
      </Card>
      <div aria-live="polite" data-testid="m19-ask-answer">
        {answer && (
          answer.kind === 'answer' ? (
            <Card eyebrow={t('m19.ask.answerEyebrow')} title={t(answer.key, vars)}>
              <ol className="space-y-3" data-testid="m19-ask-citations">
                {answer.citations.map((c, i) => (
                  <li key={c.id} className="flex gap-3">
                    <span className="num mt-0.5 text-[12px] text-ink-3">[{i + 1}]</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <L to={c.route} className="font-semibold">{pickT(c.title)}</L>
                        <StatusPill tone="neutral">{t(`m19.ask.kind.${c.kind}`)}</StatusPill>
                        {c.role_match && <StatusPill tone="accent">{t('m19.ask.roleMatch')}</StatusPill>}
                      </div>
                      {c.meta && <div className="ltr text-[12px] text-ink-3">{pickT(c.meta)}</div>}
                      {pickT(c.snippet) && <p className="mt-0.5 text-[13px] text-ink-2">{pickT(c.snippet)}</p>}
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-[12px] text-ink-3">{t('m19.ask.footer')}</p>
            </Card>
          ) : (
            <Callout tone={answer.kind === 'exam_refused' ? 'bad' : 'info'} title={t(answer.key, vars)}>
              {answer.kind === 'exam_refused' ? <L to="/learn/practice">{t('m19.ask.practiceLink')}</L> : answer.kind === 'none' ? <L to="/learn">{t('m19.ask.catalogueLink')}</L> : null}
            </Callout>
          )
        )}
      </div>
    </div>
  );
}
