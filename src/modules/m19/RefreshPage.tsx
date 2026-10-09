// /my/coach/refresh (M19 · F14 knowledge refreshers): five questions a day or a week from the OPEN PRACTICE BANK only, picked by the
// server with a Leitner schedule (due items first, then new ones weighted to my role and upcoming requalification). Answers are
// checked server-side; keys and explanations arrive only after I submit. Progress is private: competency confidence bars only.
// No streaks, points, badges or rankings (spec commitment 5).
import { useMemo, useState } from 'react';
import { Page, Section, Card, Async, EmptyState, ErrorState, Callout, Icon, StatusPill, ProgressBar, RadioGroup, WhyThis, Skeleton } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { L, useFormat, useLang, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { BOX_DAYS, MAX_BOX, confidenceByCompetency, type RefreshCadence } from './refresh';
import type { RefresherOutcome, RefresherQuestion, RefresherSet } from './backend/rpc';
import type { Reason } from '../../domain/engines/types';

const r = (code: string, vars?: Reason['vars']): Reason => ({ code, key: `m19.reasons.${code}`, vars });

export default function RefreshPage() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const me = s.identity.personId;
  const [extra, setExtra] = useState(false);
  const [round, setRound] = useState(0);
  const set = useQuery(['refresh_prefs'], () => repo.rpc.nextRefresher(extra), [extra, round]);
  const ctx = useQuery(['refresh_state', 'refresh_prefs'], async () => {
    const mine = { filter: { person_id: me } } as never;
    const [states, prefs, items, comps, standards, courses] = await Promise.all([
      repo.list('refresh_state', mine), repo.list('refresh_prefs', mine), repo.list('items', { filter: { bank: 'practice' } }), repo.list('competencies'), repo.list('qual_standards').catch(() => []), repo.list('courses').catch(() => []),
    ]);
    return { states, pref: prefs[0] ?? null, items, comps, standards, courses };
  }, [me]);
  return (
    <Page title={t('m19.routes.my-coach-refresh.title')} intro={t('m19.refresh.intro')} eyebrow={<L to="/my/coach">{t('m19.refresh.back')}</L>}
      actions={<L to="/learn/practice" className="btn-outline btn-sm"><Icon name="check" size={14} />{t('m19.refresh.quizzes')}</L>}>
      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <Async state={ctx} isEmpty={() => false}>{(c) => <CadenceCard pref={c.pref} me={me} />}</Async>
          <Card eyebrow={t('m19.refresh.howEyebrow')} title={t('m19.refresh.howTitle')}>
            <ol className="flex items-end gap-1" aria-label={t('m19.refresh.howTitle')} data-testid="m19-boxes">
              {[1, 2, 3, 4, 5].map((b) => (
                <li key={b} className="flex flex-1 flex-col items-center gap-1">
                  <div className="w-full rounded-t bg-accent-soft" style={{ height: `${10 + b * 8}px` }} aria-hidden />
                  <span className="text-[11.5px] text-ink-3">{t('m19.refresh.box', { n: b })}</span>
                  <span className="num text-[11px] text-ink-3">{t('m19.refresh.days', { n: BOX_DAYS[b] })}</span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-[12.5px] text-ink-2">{t('m19.refresh.howBody')}</p>
          </Card>
          <Card eyebrow={t('m19.refresh.privateEyebrow')} title={t('m19.refresh.privateTitle')}>
            <p className="text-[13px] text-ink-2">{t('m19.refresh.privateBody')}</p>
            <p className="mt-2 flex items-center gap-1 text-[12px] text-ink-3"><Icon name="lock" size={12} />{t('m19.refresh.bankOnly')}</p>
          </Card>
        </div>
        <Async state={set} isEmpty={() => false}>
          {(res) => !res.ok || !res.data ? <ErrorState error={res.message} /> : (
            <Async state={ctx} isEmpty={() => false}>
              {(c) => <Round key={`${round}-${extra}`} set={res.data!} ctx={c} onNext={(x) => { setExtra(x); setRound((n) => n + 1); }} />}
            </Async>
          )}
        </Async>
        <Async state={ctx} isEmpty={() => false}>{(c) => <ConfidenceSection ctx={c} />}</Async>
      </div>
    </Page>
  );
}

type Ctx = { states: { item_id: string; box: number; due_on: string; competency_id?: string | null }[]; pref: { id: string; cadence: string } | null; items: { id: string; bank: string; is_practice: boolean; status: string; competency_id?: string | null }[]; comps: { id: string; name_en: string; name_ar: string; code?: string }[]; standards: { id: string; title_en: string; title_ar: string }[]; courses: { id: string; title_en: string; title_ar: string; competency_ids: string[]; audience?: string }[] };

function CadenceCard({ pref, me }: { pref: Ctx['pref']; me: string | null }) {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const cadence = (pref?.cadence ?? 'weekly') as RefreshCadence;
  const save = async (v: string) => {
    if (!me || v === cadence) return;
    const row = { cadence: v, updated_at: new Date().toISOString() };
    await run(() => (pref ? repo.update('refresh_prefs', pref.id, row as never) : repo.insert('refresh_prefs', { id: `rp:${me}`, person_id: me, ...row } as never)), { success: t('m19.refresh.cadenceSaved') });
  };
  return (
    <Card eyebrow={t('m19.refresh.cadenceEyebrow')} title={t(`m19.refresh.cadence.${cadence}`)}>
      <div data-testid="m19-cadence">
        <RadioGroup label={t('m19.refresh.cadenceLabel')} name="m19-cadence" value={cadence} onChange={save} options={(['daily', 'weekly', 'paused'] as const).map((c) => ({ value: c, label: t(`m19.refresh.cadenceOpt.${c}`) }))} />
      </div>
    </Card>
  );
}

function Round({ set, ctx, onNext }: { set: RefresherSet; ctx: Ctx; onNext: (extra: boolean) => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lang = useLang();
  const repo = useRepo();
  const run = useAction();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<RefresherOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  const comp = (id: string) => ctx.comps.find((c) => c.id === id);
  const std = (id: string | null) => ctx.standards.find((s) => s.id === id);
  const reasons = (q: RefresherQuestion): Reason[] => [
    q.state === 'due' ? r('refresh_due', { box: q.box, date: q.due_on ?? '' }) : r('refresh_new'),
    ...(q.requal_standard_id ? [r('refresh_requal', { qual: std(q.requal_standard_id) ? { en: std(q.requal_standard_id)!.title_en, ar: std(q.requal_standard_id)!.title_ar } : q.requal_standard_id, n: q.requal_days ?? 0 })] : []),
    ...(q.role ? [r('refresh_role', { skill: comp(q.competency_id) ? { en: comp(q.competency_id)!.name_en, ar: comp(q.competency_id)!.name_ar } : q.competency_id })] : []),
    r('refresh_bank'),
  ];
  if (!set.items.length && !result) {
    const when = set.next_due_on ? f.date(set.next_due_on) : null;
    return (
      <Section title={t('m19.refresh.todayTitle')}>
        <EmptyState icon="check" title={set.limit === 0 ? t(`m19.refresh.done.${set.window}`) : t('m19.refresh.nothing')}
          action={<button className="btn-outline btn-sm" onClick={() => onNext(true)} data-testid="m19-refresh-extra">{t('m19.refresh.extra')}</button>}>
          {when ? t('m19.refresh.nextDue', { date: when }) : t('m19.refresh.noneDue')}
        </EmptyState>
      </Section>
    );
  }
  const byItem = new Map(result?.results.map((x) => [x.item_id, x]) ?? []);
  const answered = Object.keys(answers).length;
  return (
    <Section title={t('m19.refresh.todayTitle')} description={t('m19.refresh.todayBody', { due: f.num(set.due_count), fresh: f.num(set.new_count) })}
      actions={<StatusPill tone="info">{t(`m19.refresh.quota.${set.window}`, { used: f.num(set.used), n: f.num(5) })}</StatusPill>}>
      <ol className="space-y-3" data-testid="m19-refresh-set">
        {set.items.map((q, i) => {
          const res = byItem.get(q.item_id);
          const opt = (id: string) => q.options.find((o) => o.id === id);
          const c = comp(q.competency_id);
          const course = ctx.courses.find((x) => (x.competency_ids ?? []).includes(q.competency_id) && x.audience !== 'supplier');
          return (
            <li key={q.item_id} className={`card border-s-4 p-4 ${res ? (res.correct ? 'border-ok' : 'border-bad') : 'border-line'}`} data-testid="m19-refresh-q" data-state={q.state}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="num text-[12px] text-ink-3">{t('m19.refresh.qOf', { n: f.num(i + 1), total: f.num(set.items.length) })}</span>
                <span className="caps">{c ? pick(c, 'name') : q.topic}</span>
                <StatusPill tone="neutral">{t(`m19.refresh.diff.${q.difficulty}`)}</StatusPill>
                <StatusPill tone={q.state === 'due' ? 'sim' : 'info'}>{q.state === 'due' ? t('m19.refresh.dueBox', { n: q.box }) : t('m19.refresh.new')}</StatusPill>
              </div>
              <fieldset className="mt-2" disabled={!!result}>
                <legend className="text-[15px] font-semibold leading-snug">{lang === 'ar' ? q.stem_ar : q.stem_en}</legend>
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {q.options.map((o) => {
                    const chosen = answers[q.item_id] === o.id;
                    const isKey = res && res.key === o.id;
                    return (
                      <label key={o.id} className={`flex cursor-pointer items-start gap-2 rounded-btn border p-2 text-[13.5px] ${isKey ? 'border-ok bg-ok-bg' : chosen && res && !res.correct ? 'border-bad bg-bad-bg' : chosen ? 'border-accent bg-accent-soft' : 'border-line'}`}>
                        <input type="radio" name={`q-${q.item_id}`} value={o.id} checked={chosen} onChange={() => setAnswers((cur) => ({ ...cur, [q.item_id]: o.id }))} className="mt-0.5 accent-[rgb(var(--accent))]" />
                        <span>{lang === 'ar' ? o.ar : o.en}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              {res && (
                <div className="mt-3 rounded-btn border border-line bg-sunken p-3 text-[13.5px]" data-testid="m19-refresh-explain" aria-live="polite">
                  <div className="flex flex-wrap items-center gap-2 font-semibold">
                    <Icon name={res.correct ? 'check' : 'alert'} size={15} className={res.correct ? 'text-ok' : 'text-bad'} />
                    {res.correct ? t('m19.refresh.correct') : t('m19.refresh.wrong', { key: lang === 'ar' ? opt(res.key)?.ar ?? res.key : opt(res.key)?.en ?? res.key })}
                  </div>
                  <p className="mt-1 text-ink-2">{lang === 'ar' ? res.rationale_ar : res.rationale_en}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-3">
                    <span>{t('m19.refresh.moved', { from: res.box_before, to: res.box_after, date: f.date(res.due_on) })}</span>
                    {res.reference && <span>{t('m19.refresh.reference', { ref: res.reference })}</span>}
                    <L to="/competencies" className="link">{t('m19.refresh.readCompetency', { name: c ? pick(c, 'name') : q.competency_id })}</L>
                    {course && <L to={`/learn/course/${course.id}`} className="link">{t('m19.refresh.readCourse', { name: pick(course, 'title') })}</L>}
                  </div>
                </div>
              )}
              {!res && <div className="mt-2"><WhyThis reasons={reasons(q)} /></div>}
            </li>
          );
        })}
      </ol>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {!result ? (
          <button className="btn-primary" disabled={!answered || busy} data-testid="m19-refresh-submit" onClick={async () => {
            setBusy(true);
            const out = await run(() => repo.rpc.submitRefresher(Object.entries(answers).map(([item_id, answer]) => ({ item_id, answer }))), { success: t('m19.refresh.checked') });
            setBusy(false);
            if (out.ok && out.data) setResult(out.data);
          }}>{t('m19.refresh.check', { n: answered })}</button>
        ) : (
          <>
            <p className="text-[13.5px] text-ink-2" data-testid="m19-refresh-summary">{t('m19.refresh.summary', { n: f.num(result.correct), total: f.num(result.total) })}</p>
            <button className="btn-primary btn-sm" onClick={() => onNext(false)}>{t('m19.refresh.nextSet')}</button>
            <button className="btn-outline btn-sm" onClick={() => onNext(true)}>{t('m19.refresh.extra')}</button>
          </>
        )}
        {!result && answered < set.items.length && <span className="text-[12.5px] text-ink-3">{t('m19.refresh.partial')}</span>}
      </div>
    </Section>
  );
}

function ConfidenceSection({ ctx }: { ctx: Ctx }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const conf = useMemo(() => confidenceByCompetency(ctx.items as never, ctx.states as never), [ctx]);
  return (
    <Section title={t('m19.refresh.confidenceTitle')} description={t('m19.refresh.confidenceBody', { max: MAX_BOX })}>
      {conf.length === 0 ? <Skeleton lines={3} /> : (
        <ul className="grid gap-3 md:grid-cols-2" data-testid="m19-confidence">
          {conf.map((c) => {
            const comp = ctx.comps.find((x) => x.id === c.competency_id);
            return (
              <li key={c.competency_id} className="card p-3">
                <div className="flex items-center justify-between gap-2 text-[13.5px]"><span className="font-semibold">{comp ? pick(comp, 'name') : c.competency_id}</span><span className="num text-ink-2">{f.num(c.pct)}%</span></div>
                <div className="mt-1.5"><ProgressBar value={c.pct} tone={c.pct >= 60 ? 'ok' : 'accent'} label={comp ? pick(comp, 'name') : c.competency_id} /></div>
                <div className="mt-1 text-[12px] text-ink-3">{t('m19.refresh.confidenceLine', { seen: f.num(c.seen), items: f.num(c.items), mastered: f.num(c.mastered) })}</div>
              </li>
            );
          })}
        </ul>
      )}
      <Callout title={t('m19.refresh.noGamesTitle')}>{t('m19.refresh.noGamesBody')}</Callout>
    </Section>
  );
}
