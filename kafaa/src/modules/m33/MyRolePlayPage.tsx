// FS59 /my/role-play (skills_profile Own): my role-play practice. Practise tab: the published scenarios with my latest rate and any open
// session. History tab (?tab=history): every session I ran, kept privately (ticks and word counts, never my words), visible to me only.
// A session at or above its mark can go to a reviewer I name (an instructor, the training manager or the HR authority; never myself) with a
// short practice context; once that reviewer validates it, it becomes rating evidence (basis validated) on the scenario's skills. I can
// withdraw a pending request. Speak-up wording in the context routes to the speak-up channels and is sent nowhere.
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Page, Card, Async, Callout, EmptyState, StatTile, WhyThis, BenchmarkChips, DataTable, Modal, ConfirmDialog, SelectField, TextArea, Tabs, StatusPill, type Column } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, useLang, usePick, useT } from '../../i18n';
import { speakUpTopic, type RpCriterion } from './roleplay';
import type { RpContext, RpReviewer } from './backend/rpc';
import { KindTag, ReviewTag, Ticks } from './fs65ui';
import type { Row } from './ui';

function useMine(personId: string | null) {
  const repo = useRepo();
  return useQuery(['roleplay_scenarios', 'roleplay_sessions'], async () => {
    const [scenarios, sessions, ctx, reviewers] = await Promise.all([
      repo.list('roleplay_scenarios' as never, { order: [['sort', 'asc']] } as never).catch(() => [] as Row[]) as Promise<Row[]>,
      repo.list('roleplay_sessions' as never, { filter: { person_id: personId ?? '__none__' } } as never).catch(() => [] as Row[]) as Promise<Row[]>,
      repo.rpc.roleplayContext(),
      repo.rpc.roleplayReviewers().catch(() => null),
    ]);
    return { scenarios: scenarios.filter((x) => x.status === 'published'), all: scenarios, sessions: [...sessions].sort((a, b) => String(b.started_at).localeCompare(String(a.started_at))), ctx, reviewers: reviewers ?? [] };
  }, [personId]);
}

export default function MyRolePlayPage() {
  const t = useT();
  const s = useSession();
  const q = useMine(s.identity.personId);
  return (
    <Page title={t('m33.routes.my-role-play.title')} intro={t('m33.rp.mine.intro')} wide eyebrow={<BenchmarkChips feature="FS59" />}
      actions={<L to="/learn/role-play" className="btn-outline btn-sm no-underline" data-testid="m33-rp-to-library">{t('m33.routes.learn-role-play.title')}</L>}>
      <Async state={q}>{(d) => <Mine {...d} reload={q.reload} />}</Async>
    </Page>
  );
}

function Mine({ scenarios, all, sessions, ctx, reviewers, reload }: { scenarios: Row[]; all: Row[]; sessions: Row[]; ctx: RpContext | null; reviewers: RpReviewer[]; reload?: () => void }) {
  const t = useT();
  const f = useFormat();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'history' ? 'history' : 'practise';
  const done = sessions.filter((x) => x.status === 'completed');
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="m33-rp-tiles">
        <StatTile label={t('m33.rp.mine.sessions')} value={f.num(sessions.length)} />
        <StatTile label={t('m33.rp.mine.completed')} value={f.num(done.length)} />
        <StatTile label={t('m33.rp.mine.ready')} value={f.num(done.filter((x) => x.ready).length)} tone="ok" />
        <StatTile label={t('m33.rp.mine.validated')} value={f.num(sessions.filter((x) => x.review_status === 'validated').length)} tone="info"
          sub={ctx?.enec_pct != null ? t('m33.rp.mine.enec', { pct: f.num(ctx.enec_pct) }) : t('m33.rp.mine.enecSuppressed')} />
      </div>
      <Tabs value={tab} onChange={(id) => { const p = new URLSearchParams(params); if (id === 'history') p.set('tab', 'history'); else p.delete('tab'); setParams(p, { replace: true }); }} tabs={[
        { id: 'practise', label: t('m33.rp.mine.tabPractise'), content: <Practise scenarios={scenarios} sessions={sessions} ctx={ctx} /> },
        { id: 'history', label: t('m33.rp.mine.tabHistory'), badge: <span className="num">{f.num(sessions.length)}</span>, content: <History all={all} sessions={sessions} reviewers={reviewers} reload={reload} /> },
      ]} />
      <Callout tone="info" title={t('m33.rp.mine.privateTitle')}>{t('m33.rp.mine.privateBody')}</Callout>
    </div>
  );
}

function Practise({ scenarios, sessions, ctx }: { scenarios: Row[]; sessions: Row[]; ctx: RpContext | null }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  if (!scenarios.length) return <EmptyState title={t('m33.rp.lib.none')} />;
  return (
    <div className="grid grid-cols-1 gap-3 pt-3 md:grid-cols-2 xl:grid-cols-3" data-testid="m33-rp-mine-list">
      {scenarios.map((sc) => {
        const mine = sessions.filter((x) => x.scenario_id === sc.id);
        const last = mine.find((x) => x.status === 'completed');
        const open = ctx?.open.some((o) => o.scenario_id === sc.id);
        return (
          <Card key={sc.id} as="article" className="flex flex-col">
            <div className="flex h-full flex-col gap-2" data-testid="m33-rp-mine-scenario" data-id={sc.id}>
              <KindTag kind={sc.kind} />
              <div className="font-semibold"><span className="num me-1.5 text-[11.5px] text-ink-3">{sc.code}</span>{pick(sc, 'title')}</div>
              <p className="text-[12.5px] text-ink-2">{pick(sc, 'summary')}</p>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
                <span className="text-[12px] text-ink-3">{last ? t('m33.rp.mine.lastPct', { pct: f.num(Number(last.pct)), mark: f.num(Number(sc.pass_pct)) }) : t('m33.aps.notYet')}</span>
                <L to={`/my/role-play/${sc.id}`} className={`${open ? 'btn-primary' : 'btn-outline'} btn-sm no-underline`} data-testid="m33-rp-go">{open ? t('m33.rp.resume') : last ? t('m33.rp.again') : t('m33.rp.start')}</L>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function History({ all, sessions, reviewers, reload }: { all: Row[]; sessions: Row[]; reviewers: RpReviewer[]; reload?: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lang = useLang();
  const repo = useRepo();
  const act = useAction();
  const [params, setParams] = useSearchParams();
  const byId = useMemo(() => new Map(all.map((x) => [x.id, x])), [all]);
  const [open, setOpen] = useState<Row | null>(null);
  const reviewId = params.get('review');
  const [ask, setAsk] = useState<Row | null>(() => (reviewId ? sessions.find((x) => x.id === reviewId && x.ready && (x.review_status === 'none' || x.review_status === 'declined' || x.review_status === 'withdrawn')) ?? null : null));
  const [withdraw, setWithdraw] = useState<Row | null>(null);
  const [reviewer, setReviewer] = useState('');
  const [context, setContext] = useState('');
  const [speak, setSpeak] = useState(false);
  const canAsk = (x: Row) => x.status === 'completed' && x.ready && ['none', 'declined', 'withdrawn'].includes(x.review_status);
  const revName = (id: string | null) => { const r = reviewers.find((x) => x.id === id); return r ? (lang === 'ar' ? r.name_ar : r.name_en) : '—'; };
  const closeAsk = () => { setAsk(null); setReviewer(''); setContext(''); setSpeak(false); if (reviewId) { const p = new URLSearchParams(params); p.delete('review'); setParams(p, { replace: true }); } };
  const send = async () => {
    if (!ask) return;
    if (speakUpTopic(context)) { setSpeak(true); setContext(''); return; }
    const r = await act(() => repo.rpc.requestRoleplayReview({ session_id: ask.id, reviewer_id: reviewer, context }));
    if (r.code === 'speak_up') { setSpeak(true); setContext(''); return; }
    if (r.ok) { closeAsk(); reload?.(); }
  };
  const cols: Column<Row>[] = [
    { key: 'when', header: t('m33.aps.hist.when'), value: (x) => String(x.completed_at ?? x.started_at), render: (x) => f.date(String(x.completed_at ?? x.started_at).slice(0, 10)), sortable: true },
    { key: 'scenario', header: t('m33.aps.hist.scenario'), value: (x) => (byId.get(x.scenario_id) ? pick(byId.get(x.scenario_id), 'title') : x.scenario_id) },
    { key: 'pct', header: t('m33.rp.col.pct'), align: 'end', value: (x) => Number(x.pct ?? -1), render: (x) => (x.status === 'completed' ? <span className="num font-semibold">{f.num(Number(x.pct))}%</span> : <StatusPill tone="info">{t('m33.rp.inProgress')}</StatusPill>), sortable: true },
    { key: 'ready', header: t('m33.rp.col.ready'), value: (x) => (x.ready ? 1 : 0), render: (x) => (x.status === 'completed' ? <StatusPill tone={x.ready ? 'ok' : 'neutral'}>{x.ready ? t('m33.rp.ready') : t('m33.rp.notReady')}</StatusPill> : null) },
    { key: 'review', header: t('m33.rp.col.review'), value: (x) => x.review_status, render: (x) => <ReviewTag status={x.review_status} /> },
    { key: 'act', header: <span className="sr-only">{t('m33.rp.col.actions')}</span>, value: () => '', render: (x) => (
      <span className="flex flex-wrap justify-end gap-1.5">
        {canAsk(x) && <button type="button" className="btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); setAsk(x); }} data-testid="m33-rp-ask">{t('m33.rp.askReview')}</button>}
        {x.review_status === 'requested' && <button type="button" className="btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); setWithdraw(x); }} data-testid="m33-rp-withdraw">{t('m33.rp.withdraw')}</button>}
        {x.status === 'in_progress' && <L to={`/my/role-play/${x.scenario_id}`} className="btn-outline btn-sm no-underline">{t('m33.rp.resume')}</L>}
      </span>
    ) },
  ];
  const sc = open ? byId.get(open.scenario_id) : null;
  return (
    <div className="space-y-3 pt-3">
      {sessions.length ? (
        <div data-testid="m33-rp-history"><DataTable rows={sessions} columns={cols} rowKey={(x) => x.id} onRowClick={(x) => setOpen(x)} searchable={false} pageSize={10} caption={t('m33.rp.mine.tabHistory')} /></div>
      ) : <EmptyState title={t('m33.rp.mine.noHistory')} action={<L to="/learn/role-play" className="btn-outline btn-sm no-underline">{t('m33.routes.learn-role-play.title')}</L>} />}

      <Modal open={!!open} onClose={() => setOpen(null)} size="lg" title={open && sc ? `${sc.code} · ${pick(sc, 'title')}` : ''}>
        {open && sc && (
          <div className="space-y-4" data-testid="m33-rp-session-detail" data-id={open.id}>
            <div className="flex flex-wrap items-center gap-2">
              <KindTag kind={sc.kind} /><ReviewTag status={open.review_status} />
              {open.status === 'completed' && <span className="num font-semibold">{f.num(Number(open.pct))}%</span>}
              {(open.reasons ?? []).length > 0 && <WhyThis reasons={open.reasons} testId="m33-rp-history-why" />}
            </div>
            {open.review_status !== 'none' && (
              <p className="text-[12.5px] text-ink-2" data-testid="m33-rp-review-line">{t(`m33.rp.reviewLine.${open.review_status}`, { name: revName(open.reviewer_id), date: f.date(String(open.reviewed_at ?? open.requested_at ?? '').slice(0, 10) || '2026-01-01') })}
                {open.review_note ? ` "${open.review_note}"` : ''}</p>
            )}
            {(open.turns ?? []).map((tr: Row, i: number) => (
              <div key={tr.turn_id} className="rounded-card border border-line p-2.5">
                <div className="caps mb-1 text-[10.5px]">{t('m33.rp.turnN', { n: f.num(i + 1) })} · {t('m33.rp.words', { n: f.num(tr.words) })}</div>
                <Ticks results={tr.criteria} rubric={sc.rubric as RpCriterion[]} testId={`m33-rp-hticks-${i}`} />
              </div>
            ))}
            <p className="text-[12px] text-ink-3">{t('m33.rp.notStoredLong')}</p>
          </div>
        )}
      </Modal>

      <Modal open={!!ask} onClose={closeAsk} title={t('m33.rp.ask.title')}
        footer={<div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={closeAsk}>{t('common.cancel')}</button>
          <button type="button" className="btn-primary" disabled={!reviewer || context.trim().length < 5} onClick={send} data-testid="m33-rp-ask-send">{t('m33.rp.ask.send')}</button>
        </div>}>
        {ask && (
          <div className="space-y-3" data-testid="m33-rp-ask-form">
            <p className="text-[13px] text-ink-2">{t('m33.rp.ask.body')}</p>
            {reviewers.length ? <SelectField name="reviewer" label={t('m33.rp.ask.reviewer')} value={reviewer} onChange={setReviewer} placeholder={t('m33.rp.ask.choose')}
              options={reviewers.map((r) => ({ value: r.id, label: `${lang === 'ar' ? r.name_ar : r.name_en} · ${t(`m33.rp.role.${r.role}`)}` }))} />
              : <Callout tone="sim">{t('m33.rp.ask.noReviewers')}</Callout>}
            <TextArea name="context" label={t('m33.rp.ask.context')} hint={t('m33.rp.ask.contextHint')} value={context} onChange={setContext} rows={3} required />
            {speak && <div role="alert" data-testid="m33-rp-speakup"><Callout tone="sim" title={t('m33.rp.speak.title')}>{t('m33.rp.speak.routed')} <L to="/speak-up" className="font-semibold">{t('m33.rp.speak.link')}</L></Callout></div>}
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!withdraw} onClose={() => setWithdraw(null)} title={t('m33.rp.withdrawTitle')} consequence={t('m33.rp.withdrawBody', { name: revName(withdraw?.reviewer_id ?? null) })} confirmLabel={t('m33.rp.withdraw')}
        onConfirm={async () => { if (withdraw) { const r = await act(() => repo.rpc.withdrawRoleplayReview(withdraw.id)); if (r.ok) reload?.(); } setWithdraw(null); }} />
    </div>
  );
}
