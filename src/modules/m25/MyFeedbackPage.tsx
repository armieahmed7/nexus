// /my/learning/feedback (F25 L1): the learner's short post-course form for each completion in the last 90 days, the forms already
// given, and the learner's own L3 observations. Answers are anonymous to instructors and managers: they see course results only
// when 10 or more people answered (the person id is kept only to stop duplicates and to schedule the L3 observation).
import { useMemo, useState } from 'react';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { MIN_GROUP_SIZE } from '../../auth/policy';
import { Async, Callout, Card, EmptyState, Icon, Page, Section, StatusPill } from '../../ui';
import { useFormat, useT } from '../../i18n';
import { todayIso } from '../../domain/rules';
import { completionsOf, l1Id, l1Open, l3Status, L1_ITEMS, L1_WINDOW_DAYS, type Completion, type L1Item } from './eff';
import { useM25Labels, useM25Refs } from './ui';

export default function MyFeedbackPage() {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const s = useSession();
  const me = s.identity.personId;
  const refs = useM25Refs();
  const lab = useM25Labels(refs.data);
  const q = useQuery(['training_records', 'enrolments', 'eval_responses', 'l3_observations', 'eval_surveys'], async () => {
    const [tr, en, resp, obs, surveys] = await Promise.all([
      repo.list('training_records', { filter: { person_id: me ?? '' } }),
      repo.list('enrolments', { filter: { person_id: me ?? '', status: 'completed' } }),
      repo.list('eval_responses', { filter: { person_id: me ?? '' } }),
      repo.list('l3_observations', { filter: { person_id: me ?? '' } }),
      repo.list('eval_surveys'),
    ]);
    return { comps: completionsOf(tr, en).filter((c) => c.person_id === me), resp, obs, surveys };
  }, [me]);
  const today = todayIso();
  const view = useMemo(() => {
    if (!q.data) return null;
    const answered = new Set(q.data.resp.map((r) => r.completion_ref));
    const surveyed = new Set(q.data.surveys.filter((x) => x.active !== false).map((x) => x.course_id));
    const pending = q.data.comps.filter((c) => surveyed.has(c.course_id) && l1Open(c, today) && !answered.has(c.ref)).sort((a, b) => (a.completed_on < b.completed_on ? 1 : -1));
    return { pending, given: [...q.data.resp].sort((a, b) => (a.submitted_at < b.submitted_at ? 1 : -1)), obs: q.data.obs };
  }, [q.data, today]);

  return (
    <Page title={t('m25.routes.my-learning-feedback.title')} intro={t('m25.my.intro', { days: L1_WINDOW_DAYS })}>
      <Callout tone="ok" title={t('m25.my.anonTitle')}>{t('m25.my.anon', { n: MIN_GROUP_SIZE })}</Callout>
      <Async state={q}>
        {() => view && (
          <>
            <Section title={t('m25.my.pending')} description={t('m25.my.pendingHint')}>
              {view.pending.length === 0 ? <EmptyState title={t('m25.my.nonePending')} /> : (
                <div className="space-y-4" data-testid="m25-my-pending">
                  {view.pending.map((c) => <L1Form key={c.ref} c={c} title={lab.course(c.course_id).title} code={lab.course(c.course_id).code} />)}
                </div>
              )}
            </Section>
            <Section title={t('m25.my.given')}>
              {view.given.length === 0 ? <EmptyState title={t('m25.my.noneGiven')} /> : (
                <ul className="divide-y divide-line rounded-card border border-line" data-testid="m25-my-given">
                  {view.given.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-3 p-3">
                      <Icon name="check" className="text-ok" />
                      <span className="font-semibold">{lab.course(r.course_id).title}</span>
                      <span className="text-[12.5px] text-ink-3">{t('m25.my.givenOn', { date: f.date(r.submitted_at) })}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
            <Section title={t('m25.my.l3')} description={t('m25.my.l3Hint')}>
              {view.obs.length === 0 ? <EmptyState title={t('m25.my.noL3')} /> : (
                <ul className="divide-y divide-line rounded-card border border-line" data-testid="m25-my-l3">
                  {view.obs.map((o) => {
                    const v = l3Status({ status: o.status, due_on: String(o.due_on) }, today);
                    return (
                      <li key={o.id} className="flex flex-wrap items-center gap-3 p-3">
                        <span className="font-semibold">{lab.course(o.course_id).title}</span>
                        <span className="text-[12.5px] text-ink-3">{t('m25.my.l3Due', { date: f.date(o.due_on) })}</span>
                        <StatusPill tone={v === 'done' ? 'ok' : v === 'overdue' ? 'sim' : 'info'}>{t(`m25.l3.view.${v}`)}</StatusPill>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>
          </>
        )}
      </Async>
    </Page>
  );
}

function L1Form({ c, title, code }: { c: Completion; title: string; code: string }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const [vals, setVals] = useState<Partial<Record<L1Item, number>>>({});
  const [rec, setRec] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const complete = L1_ITEMS.every((k) => vals[k]) && rec !== null;
  const submit = async () => {
    setBusy(true);
    await run(() => repo.rpc.submitL1({ completion_ref: c.ref, ratings: vals as Record<L1Item, number>, recommend: rec === true }));
    setBusy(false);
  };
  return (
    <Card title={title} eyebrow={<span className="ltr">{code}</span>} footer={<div className="flex items-center justify-between gap-2"><span className="text-[12px] text-ink-3">{t('m25.my.completedOn', { date: f.date(c.completed_on) })}</span><button type="button" className="btn-primary" disabled={!complete || busy} onClick={submit} data-testid={`m25-l1-submit-${l1Id(c.ref)}`}>{t('m25.my.submit')}</button></div>}>
      <div className="space-y-3" data-testid={`m25-l1-form-${c.course_id}`}>
        {L1_ITEMS.map((k) => (
          <fieldset key={k} className="flex flex-wrap items-center justify-between gap-2">
            <legend className="sr-only">{t(`m25.l1.q.${k}`)}</legend>
            <span className="text-[13.5px]" aria-hidden>{t(`m25.l1.q.${k}`)}</span>
            <span className="inline-flex gap-1" role="radiogroup" aria-label={t(`m25.l1.q.${k}`)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className={`grid h-8 w-8 cursor-pointer place-items-center rounded-full border text-[13px] font-semibold ${vals[k] === n ? 'border-accent bg-accent-soft text-eyebrow' : 'border-line hover:bg-sunken'}`} title={t(`m25.l1.scale.${n}`)}>
                  <input type="radio" className="sr-only" name={`${c.ref}-${k}`} value={n} checked={vals[k] === n} onChange={() => setVals((x) => ({ ...x, [k]: n }))} aria-label={`${n} · ${t(`m25.l1.scale.${n}`)}`} />
                  <span className="num">{f.num(n)}</span>
                </label>
              ))}
            </span>
          </fieldset>
        ))}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          <span className="text-[13.5px]">{t('m25.l1.q.recommend')}</span>
          <span className="inline-flex gap-1" role="radiogroup" aria-label={t('m25.l1.q.recommend')}>
            {([true, false] as const).map((v) => (
              <label key={String(v)} className={`cursor-pointer rounded-full border px-3 py-1 text-[13px] ${rec === v ? 'border-accent bg-accent-soft text-eyebrow' : 'border-line hover:bg-sunken'}`}>
                <input type="radio" className="sr-only" name={`${c.ref}-rec`} checked={rec === v} onChange={() => setRec(v)} />
                {v ? t('m25.common.yes') : t('m25.common.no')}
              </label>
            ))}
          </span>
        </div>
        <p className="text-[12px] text-ink-3">{t('m25.l1.scaleHint')}</p>
      </div>
    </Card>
  );
}
