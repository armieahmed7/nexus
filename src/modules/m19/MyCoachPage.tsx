// /my/coach (M19 · F07 Learning Coach): "This month for you" (5-8 ranked actions with reasons), saved and hidden
// suggestions, the optional private weekly goal, focus roles and "Ask the coach" (catalogue retrieval with citations).
// Progress, not rank: this page has no points, streaks, badges or leaderboards (spec commitment 5).
import { useEffect, useMemo, useState } from 'react';
import { Page, Card, Tabs, Async, EmptyState, Callout, Icon, StatusPill, WhyThis, EngineBadge, ConfirmDialog, useReasonText } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { L, useFormat, useLang, useT } from '../../i18n';
import { asRanked, type CoachCard } from './coach';
import { useCoachData } from './useCoachData';
import { AskCoach } from './AskCoach';
import { GoalCard, FocusCard } from './GoalCard';
import type { EngineKind, EngineStatus } from '../../domain/engines/types';
import { RecoOptedOut, UnrankedCatalogue, useRecoOptOut } from '../m16/optout'; // W3E5 (F24): per-surface opt-out

export const KIND_ICON: Record<string, string> = { refresher: 'shield', course: 'book', practice: 'check', ojt: 'briefcase', mentor: 'users', opportunity: 'sparkle', reading: 'info' };

export default function MyCoachPage() {
  const t = useT();
  const f = useFormat();
  const { q, result, eng } = useCoachData();
  // F02 model slot: when a gateway serves "recommend" it may re-rank the same candidates; without one the deterministic list stands.
  const [served, setServed] = useState<{ ids: string[] | null; kind: EngineKind; status: EngineStatus }>({ ids: null, kind: eng.kind, status: eng.status });
  useEffect(() => {
    let live = true;
    if (!result) return;
    void eng.run(() => asRanked(result.feed), { candidates: asRanked([...result.pool.values()]).map((x) => ({ id: x.id, reasons: x.reasons })), context: { surface: 'coach', person: result.input.personId } }).then((out) => {
      if (live) setServed({ ids: out.results.map((x) => x.id), kind: out.kind, status: out.status });
    });
    return () => { live = false; };
  }, [result, eng]);
  const feed = useMemo(() => {
    if (!result) return [];
    if (!served.ids) return result.feed;
    const byId = new Map([...result.pool, ...result.feed.map((c) => [c.id, c] as const)]);
    const list = served.ids.map((id) => byId.get(id)).filter((c): c is CoachCard => !!c && c.reasons.length > 0);
    return list.length ? list : result.feed;
  }, [result, served.ids]);

  const savedIds = new Set(result?.input.feedback.filter((x) => x.signal === 'saved').map((x) => `${x.item_kind}:${x.item_id}`) ?? []);
  const saved = result ? [...savedIds].map((id) => result.pool.get(id)).filter((c): c is CoachCard => !!c) : [];
  const hours = feed.reduce((n, c) => n + (c.hours != null && c.hours <= 80 ? c.hours : 0), 0);
  const optOut = useRecoOptOut('coach'); // W3E5 (F24): opted out -> no ranked cards, the unranked catalogue instead
  if (optOut.optedOut) return (
    <Page title={t('m19.routes.my-coach.title')} intro={t('m19.coach.intro')} eyebrow={t('m19.coach.eyebrow')} actions={<L to="/my/learning" className="btn-outline btn-sm"><Icon name="book" size={14} />{t('m19.coach.myLearning')}</L>}>
      <div className="space-y-5"><RecoOptedOut surface="coach" /><UnrankedCatalogue /></div>
    </Page>
  );

  return (
    <Page title={t('m19.routes.my-coach.title')} intro={t('m19.coach.intro')} eyebrow={t('m19.coach.eyebrow')}
      actions={<><EngineBadge engine={served} /><L to="/my/learning" className="btn-outline btn-sm"><Icon name="book" size={14} />{t('m19.coach.myLearning')}</L></>}>
      <Async state={q} isEmpty={(d) => !d} empty={<EmptyState title={t('m19.coach.noProfile')}>{t('m19.coach.noProfileBody')}</EmptyState>}>
        {() => !result ? <EmptyState title={t('m19.coach.noProfile')}>{t('m19.coach.noProfileBody')}</EmptyState> : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <FocusCard result={result} />
              <GoalCard result={result} feedHours={hours} />
              <Card eyebrow={t('m19.coach.monthEyebrow')} title={t('m19.coach.monthTitle', { n: f.num(feed.length) })}>
                <ul className="space-y-1.5 text-[13.5px] text-ink-2" data-testid="m19-month-summary">
                  <li className="flex items-center gap-2"><Icon name="alert" size={14} className="text-bad" />{t('m19.coach.monthPinned', { n: f.num(feed.filter((c) => c.pinned).length) })}</li>
                  <li className="flex items-center gap-2"><Icon name="calendar" size={14} />{t('m19.coach.monthHours', { n: f.num(Math.round(hours * 10) / 10) })}</li>
                  <li className="flex items-center gap-2"><Icon name="sparkle" size={14} />{t('m19.coach.monthKinds', { n: f.num(new Set(feed.map((c) => c.kind)).size) })}</li>
                </ul>
              </Card>
            </div>
            <RefreshTeaser />
            <Tabs initial="feed" tabs={[
              { id: 'feed', label: t('m19.coach.tabFeed'), badge: feed.length, content: <Feed cards={feed} /> },
              { id: 'saved', label: t('m19.coach.tabSaved'), badge: saved.length, content: saved.length ? <CardList cards={saved} testId="m19-saved" /> : <EmptyState icon="book" title={t('m19.coach.savedEmpty')}>{t('m19.coach.savedEmptyBody')}</EmptyState> },
              { id: 'ask', label: t('m19.coach.tabAsk'), content: <AskCoach t={result.t} /> },
              { id: 'hidden', label: t('m19.coach.tabHidden'), badge: result.hidden.length, content: <Hidden cards={result.hidden} feedback={result.input.feedback} /> },
            ]} />
            <Callout title={t('m19.coach.privacyTitle')}>{t('m19.coach.privacyBody')}</Callout>
          </div>
        )}
      </Async>
    </Page>
  );
}

/** W2 · E3 · F14: today's knowledge refresher (counts only; questions are served on /my/coach/refresh). No streaks or points. */
function RefreshTeaser() {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const q = useQuery(['refresh_state', 'refresh_prefs'], () => repo.rpc.nextRefresher(false), []);
  const d = q.data?.ok ? q.data.data : null;
  if (!d || d.cadence === 'paused') return null;
  const ready = d.items.length;
  return (
    <div className="card flex flex-wrap items-center gap-3 border-s-4 border-info-line p-3" data-testid="m19-refresh-teaser">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-eyebrow" aria-hidden><Icon name="reset" size={16} /></div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{ready ? t('m19.refresh.teaserReady', { n: f.num(ready) }) : t(`m19.refresh.done.${d.window}`)}</div>
        <div className="text-[12.5px] text-ink-3">{t('m19.refresh.teaserBody', { due: f.num(d.due_count) })}</div>
      </div>
      <L to="/my/coach/refresh" className={ready ? 'btn-primary btn-sm' : 'btn-outline btn-sm'}>{ready ? t('m19.refresh.start') : t('m19.refresh.open')}<Icon name="chevron" size={14} className="rtl:-scale-x-100" /></L>
    </div>
  );
}

function Feed({ cards }: { cards: CoachCard[] }) {
  const t = useT();
  if (!cards.length) return <EmptyState icon="sparkle" title={t('m19.coach.feedEmpty')}>{t('m19.coach.feedEmptyBody')}</EmptyState>;
  return (
    <div className="space-y-3">
      <p className="text-[13.5px] text-ink-2">{t('m19.coach.feedIntro')}</p>
      <CardList cards={cards} testId="m19-feed" numbered />
    </div>
  );
}

function CardList({ cards, testId, numbered }: { cards: CoachCard[]; testId: string; numbered?: boolean }) {
  const [enrol, setEnrol] = useState<CoachCard | null>(null);
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const repo = useRepo();
  const run = useAction();
  return (
    <>
      <ol className="space-y-3" data-testid={testId}>
        {cards.map((c, i) => <CoachCardView key={c.id} card={c} n={numbered ? i + 1 : null} onEnrol={() => setEnrol(c)} />)}
      </ol>
      <ConfirmDialog open={!!enrol} onClose={() => setEnrol(null)} title={t('m19.card.enrolTitle')}
        consequence={enrol ? (enrol.session ? t(enrol.session.left > 0 ? 'm19.card.enrolSession' : 'm19.card.enrolWaitlist', { course: lang === 'ar' ? enrol.title.ar : enrol.title.en, date: f.dateTime(enrol.session.starts_at) }) : t('m19.card.enrolNoSession', { course: lang === 'ar' ? enrol.title.ar : enrol.title.en })) : ''}
        onConfirm={async () => {
          if (!enrol || enrol.action.type !== 'enrol') return;
          const a = enrol.action;
          const res = await run(() => repo.rpc.enrolCourse(a.courseId, a.sessionId));
          if (res.ok) await repo.rpc.coachFeedback(enrol.kind, enrol.itemId, 'enrolled', enrol.competencyIds);
        }} />
    </>
  );
}

export function CoachCardView({ card: c, n, onEnrol }: { card: CoachCard; n: number | null; onEnrol: () => void }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const repo = useRepo();
  const run = useAction();
  const text = useReasonText();
  const title = lang === 'ar' ? c.title.ar : c.title.en;
  const meta = c.meta ? (lang === 'ar' ? c.meta.ar : c.meta.en) : null;
  const tone = c.pinned === 'expiry' ? (c.days != null && c.days <= 30 ? 'border-bad-line' : 'border-sim-line') : c.pinned === 'must_keep' ? 'border-info-line' : 'border-line';
  const feedback = (signal: 'saved' | 'dismissed' | 'cleared', msg: string) => run(() => repo.rpc.coachFeedback(c.kind, c.itemId, signal, c.competencyIds), { success: msg });
  const actionLabel = c.action.type === 'enrol' ? (c.pinned === 'must_keep' || c.kind === 'refresher' ? (c.action.full ? t('m19.card.joinWaitlist') : t('m19.card.book')) : c.action.full ? t('m19.card.joinWaitlist') : t('m19.card.enrol')) : t(`m19.card.${c.action.label}`);
  return (
    <li className={`card border-s-4 p-4 ${tone}`} data-testid="m19-card" data-kind={c.kind} data-pinned={c.pinned ?? ''}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-eyebrow" aria-hidden="true">
          <Icon name={KIND_ICON[c.kind] ?? 'info'} size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {n != null && <span className="num text-[12px] text-ink-3">{f.num(n)}.</span>}
            <span className="caps">{t(`m19.kind.${c.kind}`)}</span>
            {c.pinned === 'expiry' && <StatusPill tone={c.days != null && c.days <= 30 ? 'bad' : 'sim'}>{c.days != null && c.days < 0 ? t('m19.card.pinExpired', { n: f.num(-c.days) }) : t('m19.card.pinExpiry', { n: f.num(c.days ?? 0) })}</StatusPill>}
            {c.pinned === 'must_keep' && <StatusPill tone={c.days != null && c.days < 0 ? 'bad' : 'info'}>{t('m19.card.pinMustKeep')}</StatusPill>}
            {c.saved && <StatusPill tone="accent">{t('m19.card.saved')}</StatusPill>}
          </div>
          <h3 className="mt-0.5 text-[15.5px] font-semibold leading-snug"><L to={c.link}>{title}</L></h3>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12.5px] text-ink-3">
            {meta && <span className="ltr">{meta}</span>}
            {c.hours != null && <span>{t('m19.card.hours', { n: f.num(c.hours < 1 ? Math.round(c.hours * 60) : c.hours) , unit: c.hours < 1 ? t('m19.card.min') : t('m19.card.h') })}</span>}
            {c.session && <span>{c.session.left > 0 ? t('m19.card.seats', { n: f.num(c.session.left), date: f.date(c.session.starts_at) }) : t('m19.card.full', { date: f.date(c.session.starts_at) })}</span>}
          </div>
          <p className="mt-2 text-[13.5px] text-ink-2" data-testid="m19-top-reason">{c.reasons[0] ? text(c.reasons[0]) : ''}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <WhyThis reasons={c.reasons} />
        <div className="flex flex-wrap gap-2">
          {!c.pinned && (c.saved
            ? <button type="button" className="btn-ghost btn-sm" onClick={() => feedback('cleared', t('m19.card.unsaved'))} data-testid="m19-unsave">{t('m19.card.unsave')}</button>
            : <button type="button" className="btn-ghost btn-sm" onClick={() => feedback('saved', t('m19.card.savedToast'))} data-testid="m19-save"><Icon name="plus" size={14} />{t('m19.card.save')}</button>)}
          {!c.pinned && <button type="button" className="btn-ghost btn-sm" onClick={() => feedback('dismissed', t('m19.card.dismissedToast'))} data-testid="m19-dismiss" title={t('m19.card.dismissHint')}>{t('m19.card.dismiss')}</button>}
          {c.action.type === 'enrol'
            ? <button type="button" className="btn-primary btn-sm" onClick={onEnrol} data-testid="m19-enrol">{actionLabel}</button>
            : <L to={c.action.to} className="btn-outline btn-sm" data-testid="m19-open">{actionLabel}<Icon name="chevron" size={14} className="rtl:-scale-x-100" /></L>}
        </div>
      </div>
    </li>
  );
}

function Hidden({ cards, feedback }: { cards: CoachCard[]; feedback: { item_kind: string; item_id: string; signal: string; hidden_until?: string | null }[] }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const repo = useRepo();
  const run = useAction();
  if (!cards.length) return <EmptyState icon="info" title={t('m19.coach.hiddenEmpty')}>{t('m19.coach.hiddenEmptyBody')}</EmptyState>;
  const until = new Map(feedback.filter((x) => x.signal === 'dismissed').map((x) => [`${x.item_kind}:${x.item_id}`, x.hidden_until]));
  return (
    <ul className="space-y-2" data-testid="m19-hidden">
      {cards.map((c) => (
        <li key={c.id} className="card flex flex-wrap items-center justify-between gap-2 p-3">
          <div className="min-w-0">
            <span className="caps me-2">{t(`m19.kind.${c.kind}`)}</span>
            <span className="font-semibold">{lang === 'ar' ? c.title.ar : c.title.en}</span>
            <div className="text-[12.5px] text-ink-3">{t('m19.coach.hiddenUntil', { date: f.date(until.get(c.id) ?? null) })}</div>
          </div>
          <button type="button" className="btn-outline btn-sm" onClick={() => run(() => repo.rpc.coachFeedback(c.kind, c.itemId, 'cleared', c.competencyIds), { success: t('m19.coach.restored') })} data-testid="m19-restore">{t('m19.coach.restore')}</button>
        </li>
      ))}
    </ul>
  );
}
