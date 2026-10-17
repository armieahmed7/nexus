// F38 /my/ojt: OJT practice logbook (mobile first, works offline). Three views:
//   My practice     each qualification task I may practise (never security-restricted) with its readiness (N supervised performances
//                   plus a preceptor "ready", <WhyThis>), my entries, "Log practice" and "Request evaluation" (hand-off to an evaluator)
//   To acknowledge  entries that name me as preceptor: acknowledge with feedback and "ready for evaluation", or return
//   To evaluate     requests that name me as evaluator: sign the task off through M02 (rpc.signoffEvaluation), then close the request
// Offline: entries are queued on the device with an idempotent client key and synced once when back online; the service worker
// (public/ojt-sw.js, scope /kafaa/my/ojt only) keeps this page available offline. Practice is never a qualification sign-off.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Page, Async, Card, Callout, ConfirmDialog, EmptyState, Grid, Modal, RadioGroup, SelectField, StatTile, Tabs, TextArea, CheckboxField, WhyThis, Icon } from '../../ui';
import { useAction, useRepo, type Result } from '../../data';
import { useT, usePick, useFormat, useLang, L } from '../../i18n';
import { useSession } from '../../auth/session';
import { readinessReasons, type LogInput, type LogRow } from './ojt';
import { OJT_SW_FILE, OJT_SYNC_TAG, cachePreceptors, enqueue, discard, flushQueue, ojtSwScope, readQueue, type Queued } from './ojtQueue';
import { LogPracticeModal, LogStatus, ModeChip, PracticeNotice, ReadyRing, myTasks, readinessFor, useOjtData, type OjtData } from './ojtUi';
import type { PreceptorCard } from './backend/rpc';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
const TABS = ['practice', 'acknowledge', 'evaluate'] as const;

/** Register the logbook service worker (production builds only), scoped to this page. */
function useOjtServiceWorker(onSync: () => void) {
  const lang = useLang();
  useEffect(() => {
    if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const base = import.meta.env.BASE_URL ?? '/kafaa/';
    navigator.serviceWorker.register(`${base}${OJT_SW_FILE}`, { scope: ojtSwScope(base, lang === 'ar' ? 'ar' : 'en') }).catch(() => undefined);
    const msg = (e: MessageEvent) => { if (e.data?.type === OJT_SYNC_TAG) onSync(); };
    navigator.serviceWorker.addEventListener('message', msg);
    return () => navigator.serviceWorker.removeEventListener('message', msg);
  }, [lang, onSync]);
}

export default function OjtLogbookPage() {
  const t = useT();
  const s = useSession();
  const me = s.identity.personId;
  const q = useOjtData(me);
  const [params, setParams] = useSearchParams();
  const tab = (TABS as readonly string[]).includes(params.get('tab') ?? '') ? (params.get('tab') as string) : 'practice';
  const repo = useRepo();
  const [queue, setQueue] = useState<Queued[]>(() => (me ? readQueue(me) : []));
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const sync = useCallback(async () => {
    if (!me) return;
    if (!readQueue(me).length) return;
    const r = await flushQueue(me, (i) => repo.rpc.logPractice(i));
    setQueue(readQueue(me));
    setSyncMsg(t('m02.ojt.synced', { n: String(r.synced), d: String(r.duplicates), f: String(r.refused), k: String(r.kept) }));
    q.reload?.();
  }, [me, repo, t, q]);
  const syncRef = useRef(sync);
  syncRef.current = sync;
  const fireSync = useCallback(() => void syncRef.current(), []);
  useOjtServiceWorker(fireSync);
  useEffect(() => {
    const on = () => { setOnline(true); fireSync(); };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [fireSync]);
  // once the session is known: show this device's queue and send it if we are online
  useEffect(() => {
    if (!me) return;
    setQueue(readQueue(me));
    if (typeof navigator === 'undefined' || navigator.onLine !== false) fireSync();
  }, [me, fireSync]);
  return (
    <Page title={t('m02.routes.my-ojt.title')} eyebrow={t('m02.ojt.eyebrow')} intro={t('m02.ojt.intro')}>
      <div aria-live="polite" className="space-y-2">
        {!online && <Callout tone="info" title={t('m02.ojt.offlineTitle')}>{t('m02.ojt.offlineBody')}</Callout>}
        {queue.length > 0 && (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2" data-testid="m02-ojt-queue" data-count={queue.length}>
              <span className="text-[13px]"><Icon name="reset" size={14} className="inline" /> {t('m02.ojt.queued', { n: String(queue.length) })}</span>
              <button type="button" className="btn-outline btn-sm" onClick={() => void sync()} disabled={!online} data-testid="m02-ojt-sync">{t('m02.ojt.syncNow')}</button>
            </div>
            <ul className="mt-2 space-y-1 text-[12.5px]">
              {queue.map((x) => (
                <li key={x.input.client_key} className="flex flex-wrap items-center justify-between gap-2">
                  <span><span className="num">{x.input.task_id}</span> · {x.input.on_date} · {t(`m02.ojt.mode.${x.input.mode}`)}{x.message && <span className="text-bad"> · {x.message}</span>}</span>
                  {x.code && me && <button type="button" className="btn-ghost btn-sm" onClick={() => setQueue(discard(me, x.input.client_key))}>{t('m02.ojt.discard')}</button>}
                </li>
              ))}
            </ul>
          </Card>
        )}
        {syncMsg && <p className="text-[12.5px] text-ink-3" data-testid="m02-ojt-sync-result">{syncMsg}</p>}
      </div>
      <PracticeNotice />
      <Async state={q}>
        {(d) => (
          <Tabs value={tab} onChange={(id) => { const p = new URLSearchParams(params); p.set('tab', id); setParams(p, { replace: true }); }}
            tabs={[
              { id: 'practice', label: t('m02.ojt.tab.practice'), content: <MyPractice d={d} online={online} onQueued={() => me && setQueue(readQueue(me))} /> },
              { id: 'acknowledge', label: `${t('m02.ojt.tab.acknowledge')} (${d.logs.filter((l) => l.preceptor_person_id === d.me && l.status === 'pending_ack').length})`, content: <Acknowledge d={d} /> },
              { id: 'evaluate', label: `${t('m02.ojt.tab.evaluate')} (${d.requests.filter((r) => r.evaluator_person_id === d.me && r.status === 'requested').length})`, content: <Evaluate d={d} /> },
            ]} />
        )}
      </Async>
    </Page>
  );
}

function MyPractice({ d, online, onQueued }: { d: OjtData; online: boolean; onQueued: () => void }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const repo = useRepo();
  const act = useAction();
  const groups = useMemo(() => myTasks(d), [d]);
  const [stdId, setStdId] = useState<string>(() => groups.find((g) => d.quals.some((q) => q.standard_id === g.std.id && ['in_progress', 'planned'].includes(q.status)))?.std.id ?? groups[0]?.std.id ?? '');
  const [log, setLog] = useState<{ task: Row; std: Row } | null>(null);
  const [req, setReq] = useState<{ task: Row; std: Row } | null>(null);
  const [cancel, setCancel] = useState<Row | null>(null);
  // W5 QA: while online, keep each practice task's preceptor choices on the device so the log form works offline too.
  useEffect(() => {
    const me = d.person?.id;
    if (!online || !me) return;
    let live = true;
    (async () => {
      for (const x of groups) for (const task of x.tasks) {
        if (!live) return;
        try { const r = await repo.rpc.ojtPreceptors(task.id); if (r.length) cachePreceptors(me, task.id, r); } catch { /* next time */ }
      }
    })();
    return () => { live = false; };
  }, [online, groups, repo, d.person?.id]);
  if (!d.person || d.person.kind !== 'staff' || !groups.length) return <EmptyState title={t('m02.ojt.noTasks')}>{t('m02.ojt.noTasksBody')}</EmptyState>;
  const g = groups.find((x) => x.std.id === stdId) ?? groups[0];
  const mine = d.logs.filter((l) => l.person_id === d.me);
  const rec = d.quals.find((q) => q.standard_id === g.std.id);
  const send = async (input: LogInput): Promise<boolean> => {
    if (!online) { enqueue(d.me, input); onQueued(); return true; }
    let r: Result<{ id: string; duplicate: boolean; status: string }> | null = null;
    try { r = await repo.rpc.logPractice(input); } catch { r = null; }
    if (!r) { enqueue(d.me, input); onQueued(); return true; }
    if (!r.ok) { await act(async () => r!); return false; }
    await act(async () => r!);
    return true;
  };
  return (
    <div className="space-y-4" data-testid="m02-ojt-practice">
      <Grid cols={4}>
        <StatTile label={t('m02.ojt.tile.entries')} value={f.num(mine.length)} sub={t('m02.ojt.tile.entriesSub', { n: f.num(mine.filter((l) => l.on_date >= addDaysIso(d.today, -30)).length) })} />
        <StatTile label={t('m02.ojt.tile.pending')} value={f.num(mine.filter((l) => l.status === 'pending_ack').length)} sub={t('m02.ojt.tile.pendingSub')} tone="info" />
        <StatTile label={t('m02.ojt.tile.ready')} value={f.num(groups.flatMap((x) => x.tasks).filter((tk) => readinessFor(d, d.me, tk).ready).length)} sub={t('m02.ojt.tile.readySub')} tone="ok" />
        <StatTile label={t('m02.ojt.tile.requests')} value={f.num(d.requests.filter((r) => r.person_id === d.me && r.status === 'requested').length)} sub={t('m02.ojt.tile.requestsSub')} />
      </Grid>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('m02.ojt.standards')}>
        {groups.map((x) => (
          <button key={x.std.id} type="button" aria-pressed={x.std.id === g.std.id} className={`chip ${x.std.id === g.std.id ? 'border-accent bg-accent/10 text-eyebrow' : 'border-line text-ink-2'}`} onClick={() => setStdId(x.std.id)} data-testid="m02-ojt-std">
            <span className="num">{x.std.code}</span>
          </button>
        ))}
      </div>
      <p className="text-[13px] text-ink-2">{pick(g.std, 'title')}{rec ? <> · {t(`m02.status.${rec.status}`)}</> : null} · <L to="/my/quals">{t('m02.ojt.toQuals')}</L></p>
      <ul className="space-y-3" data-testid="m02-ojt-tasks">
        {g.tasks.map((task) => {
          const r = readinessFor(d, d.me, task);
          const entries = mine.filter((l) => l.task_id === task.id);
          const open = d.requests.find((x) => x.person_id === d.me && x.task_id === task.id && x.status === 'requested');
          const done = d.requests.find((x) => x.person_id === d.me && x.task_id === task.id && x.status === 'completed');
          return (
            <li key={task.id} data-testid="m02-ojt-task" data-task={task.id} data-ready={r.ready ? 'yes' : 'no'}>
              <Card>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5"><span className="num font-semibold">{task.code}</span><span className="chip border-line text-ink-2">{t(`m02.method.${task.method}`)}</span>{task.critical && <span className="chip border-bad/40 text-bad">{t('m02.ojt.critical')}</span>}</div>
                    <p className="text-[14px] font-semibold leading-snug">{pick(task, 'statement')}</p>
                    <div className="flex flex-wrap items-center gap-3"><ReadyRing r={r} /><WhyThis reasons={readinessReasons(r)} testId="m02-ojt-why" /></div>
                    {open && <p className="text-[12.5px] text-info">{t('m02.ojt.requestOpen', { name: pick({ title_en: open.evaluator_name, title_ar: open.evaluator_name_ar }, 'title'), date: f.date(String(open.requested_at).slice(0, 10)) })} <button type="button" className="btn-ghost btn-sm" onClick={() => setCancel(open)}>{t('m02.ojt.cancelRequest')}</button></p>}
                    {done && <p className="text-[12.5px] text-ok">{t('m02.ojt.requestDone', { result: t(`m02.ojt.result.${done.result ?? 'pass'}`) })}</p>}
                  </div>
                  <div className="flex shrink-0 flex-row gap-2 sm:flex-col">
                    <button type="button" className="btn-primary btn-sm" onClick={() => setLog({ task, std: g.std })} data-testid="m02-ojt-log">{t('m02.ojt.log')}</button>
                    <button type="button" className="btn-outline btn-sm" disabled={!r.ready || !!open || !rec} onClick={() => setReq({ task, std: g.std })} data-testid="m02-ojt-request" title={!rec ? t('m02.ojt.noRecord') : undefined}>{t('m02.ojt.request')}</button>
                  </div>
                </div>
                {entries.length > 0 && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-[12.5px] text-ink-2">{t('m02.ojt.entries', { n: f.num(entries.length) })}</summary>
                    <ol className="mt-2 space-y-2 border-s border-line ps-3">
                      {entries.map((l) => (
                        <li key={l.id} className="text-[12.5px]" data-testid="m02-ojt-entry" data-status={l.status}>
                          <div className="flex flex-wrap items-center gap-1.5"><span className="num">{f.date(l.on_date)}</span><ModeChip mode={l.mode} /><LogStatus status={l.status} />{l.preceptor_ready && <span className="chip border-ok/40 text-ok">{t('m02.ojt.readyMark')}</span>}{l.synced === 'offline' && <span className="chip border-line text-ink-3">{t('m02.ojt.offlineMark')}</span>}</div>
                          <div className="text-ink-3">{t('m02.ojt.withPreceptor', { name: pick({ title_en: l.preceptor_name, title_ar: (l as Row).preceptor_name_ar }, 'title') })} · {t('m02.ojt.confShort', { n: f.num(l.confidence) })}{l.conditions ? ` · ${l.conditions}` : ''}</div>
                          {l.note && <div className="text-ink-2">{l.note}</div>}
                          {l.feedback && <div className="mt-0.5 rounded-card bg-sunken px-2 py-1 text-ink-2"><span className="caps">{t('m02.ojt.feedback')}</span> {l.feedback}</div>}
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
              </Card>
            </li>
          );
        })}
      </ul>
      {log && <LogPracticeModal task={log.task} std={log.std} onClose={() => setLog(null)} onSubmit={send} />}
      {req && <RequestModal task={req.task} onClose={() => setReq(null)} />}
      <ConfirmDialog open={!!cancel} onClose={() => setCancel(null)} title={t('m02.ojt.cancelRequest')} consequence={t('m02.ojt.cancelBody')}
        onConfirm={async () => { if (cancel) await act(() => repo.rpc.closeEvaluationRequest(cancel.id, 'cancel', null)); }} />
    </div>
  );
}
const addDaysIso = (d: string, n: number) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

function RequestModal({ task, onClose }: { task: Row; onClose: () => void }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const act = useAction();
  const [list, setList] = useState<PreceptorCard[] | null>(null);
  const [ev, setEv] = useState('');
  const [note, setNote] = useState('');
  useEffect(() => { let live = true; repo.rpc.ojtPreceptors(task.id).then((r) => live && setList(r.filter((p) => p.evaluator)), () => live && setList([])); return () => { live = false; }; }, [repo, task.id]);
  return (
    <Modal open onClose={onClose} title={<span><span className="num">{task.code}</span> · {t('m02.ojt.request')}</span>}
      footer={<div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>{t('common.cancel')}</button><button type="button" className="btn-primary" disabled={!ev} data-testid="m02-ojt-request-send"
        onClick={async () => { const r = await act(() => repo.rpc.requestEvaluation(task.id, ev, note || null)); if (r.ok) onClose(); }}>{t('m02.ojt.requestSend')}</button></div>}>
      <div className="space-y-3">
        <p className="text-[13px] text-ink-2">{t('m02.ojt.requestBody')}</p>
        <SelectField label={t('m02.ojt.evaluator')} name="ev" value={ev} onChange={setEv} placeholder={list ? (list.length ? t('m02.ojt.chooseEvaluator') : t('m02.ojt.noEvaluator')) : t('common.working')} options={(list ?? []).map((p) => ({ value: p.id, label: pick(p, 'name') }))} />
        <TextArea label={t('m02.ojt.requestNote')} name="note" value={note} onChange={setNote} rows={2} />
      </div>
    </Modal>
  );
}

function Acknowledge({ d }: { d: OjtData }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const repo = useRepo();
  const act = useAction();
  const [sel, setSel] = useState<{ log: LogRow; decision: 'acknowledge' | 'return' } | null>(null);
  const [fb, setFb] = useState('');
  const [ready, setReady] = useState(false);
  const pending = d.logs.filter((l) => l.preceptor_person_id === d.me && l.status === 'pending_ack');
  const answered = d.logs.filter((l) => l.preceptor_person_id === d.me && l.status !== 'pending_ack').slice(0, 8);
  const task = (id: string) => d.tasks.find((x) => x.id === id);
  return (
    <div className="space-y-4" data-testid="m02-ojt-ack">
      <p className="text-[13px] text-ink-2">{t('m02.ojt.ackIntro')}</p>
      {pending.length === 0 ? <EmptyState title={t('m02.ojt.ackEmpty')}>{t('m02.ojt.ackEmptyBody')}</EmptyState> : (
        <ul className="space-y-3">
          {pending.map((l) => {
            const tk = task(l.task_id);
            return (
              <li key={l.id}>
                <Card>
                  <div className="space-y-2" data-testid="m02-ojt-ack-item">
                    <div className="flex flex-wrap items-center gap-1.5"><span className="font-semibold">{pick({ title_en: l.person_name, title_ar: (l as Row).person_name_ar }, 'title')}</span><span className="num text-ink-3">{tk?.code}</span><ModeChip mode={l.mode} /><span className="num text-[12px] text-ink-3">{f.date(l.on_date)}</span></div>
                    <p className="text-[13px]">{tk ? pick(tk, 'statement') : l.task_id}</p>
                    <p className="text-[12.5px] text-ink-3">{t('m02.ojt.confShort', { n: f.num(l.confidence) })}{l.conditions ? ` · ${l.conditions}` : ''}</p>
                    {l.note && <p className="rounded-card bg-sunken px-2 py-1 text-[12.5px]">{l.note}</p>}
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn-primary btn-sm" onClick={() => { setFb(''); setReady(false); setSel({ log: l, decision: 'acknowledge' }); }} data-testid="m02-ojt-ack-btn">{t('m02.ojt.ack')}</button>
                      <button type="button" className="btn-ghost btn-sm" onClick={() => { setFb(''); setReady(false); setSel({ log: l, decision: 'return' }); }}>{t('m02.ojt.return')}</button>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      {answered.length > 0 && (
        <Card title={t('m02.ojt.ackRecent')}>
          <ul className="divide-y divide-line text-[12.5px]">{answered.map((l) => <li key={l.id} className="flex flex-wrap items-center gap-1.5 py-1.5"><span>{pick({ title_en: l.person_name, title_ar: (l as Row).person_name_ar }, 'title')}</span><span className="num text-ink-3">{task(l.task_id)?.code}</span><LogStatus status={l.status} />{l.preceptor_ready && <span className="chip border-ok/40 text-ok">{t('m02.ojt.readyMark')}</span>}</li>)}</ul>
        </Card>
      )}
      <Modal open={!!sel} onClose={() => setSel(null)} title={sel?.decision === 'acknowledge' ? t('m02.ojt.ackTitle') : t('m02.ojt.returnTitle')}
        footer={<div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setSel(null)}>{t('common.cancel')}</button><button type="button" className="btn-primary" disabled={fb.trim().length < 3} data-testid="m02-ojt-ack-send"
          onClick={async () => { if (!sel) return; const r = await act(() => repo.rpc.ackPractice({ log_id: sel.log.id, decision: sel.decision, feedback: fb, ready })); if (r.ok) setSel(null); }}>{sel?.decision === 'acknowledge' ? t('m02.ojt.ack') : t('m02.ojt.return')}</button></div>}>
        <div className="space-y-3">
          <Callout tone="sim">{t('m02.ojt.ackNotSignoff')}</Callout>
          <TextArea label={t('m02.ojt.feedback')} name="fb" value={fb} onChange={setFb} rows={3} hint={t('m02.ojt.feedbackHint')} />
          {sel?.decision === 'acknowledge' && <CheckboxField label={t('m02.ojt.readyCheck')} checked={ready} onChange={setReady} hint={t('m02.ojt.readyHint')} />}
        </div>
      </Modal>
    </div>
  );
}

function Evaluate({ d }: { d: OjtData }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const repo = useRepo();
  const act = useAction();
  const [sel, setSel] = useState<Row | null>(null);
  const [result, setResult] = useState<'pass' | 'fail'>('pass');
  const [decline, setDecline] = useState<Row | null>(null);
  const open = d.requests.filter((r) => r.evaluator_person_id === d.me && r.status === 'requested');
  const closed = d.requests.filter((r) => r.evaluator_person_id === d.me && r.status !== 'requested').slice(0, 8);
  const task = (id: string) => d.tasks.find((x) => x.id === id);
  const signOff = async () => {
    if (!sel) return;
    const tk = task(sel.task_id);
    const so = await act(() => repo.rpc.signoffEvaluation({ record_id: sel.record_id, task_id: sel.task_id, method: tk?.method ?? 'ojt', result }));
    if (so.ok) { await act(() => repo.rpc.closeEvaluationRequest(sel.id, 'complete', null)); setSel(null); }
  };
  return (
    <div className="space-y-4" data-testid="m02-ojt-evaluate">
      <p className="text-[13px] text-ink-2">{t('m02.ojt.evalIntro')}</p>
      {open.length === 0 ? <EmptyState title={t('m02.ojt.evalEmpty')}>{t('m02.ojt.evalEmptyBody')}</EmptyState> : (
        <ul className="space-y-3">
          {open.map((r) => {
            const tk = task(r.task_id);
            return (
              <li key={r.id}>
                <Card>
                  <div className="space-y-2" data-testid="m02-ojt-eval-item">
                    <div className="flex flex-wrap items-center gap-1.5"><span className="font-semibold">{pick({ title_en: r.person_name, title_ar: r.person_name_ar }, 'title')}</span><span className="num text-ink-3">{tk?.code}</span><span className="num text-[12px] text-ink-3">{f.date(String(r.requested_at).slice(0, 10))}</span></div>
                    <p className="text-[13px]">{tk ? pick(tk, 'statement') : r.task_id}</p>
                    <p className="text-[12.5px] text-ink-3">{t('m02.ojt.evalReadiness', { n: f.num(r.readiness?.supervised ?? 0), needed: f.num(r.readiness?.needed ?? 3) })}{r.note ? ` · ${r.note}` : ''}</p>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn-primary btn-sm" onClick={() => { setResult('pass'); setSel(r); }} data-testid="m02-ojt-signoff">{t('m02.ojt.signoff')}</button>
                      <button type="button" className="btn-ghost btn-sm" onClick={() => setDecline(r)}>{t('m02.ojt.decline')}</button>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      {closed.length > 0 && <Card title={t('m02.ojt.evalRecent')}><ul className="divide-y divide-line text-[12.5px]">{closed.map((r) => <li key={r.id} className="flex flex-wrap gap-1.5 py-1.5"><span>{pick({ title_en: r.person_name, title_ar: r.person_name_ar }, 'title')}</span><span className="num text-ink-3">{task(r.task_id)?.code}</span><span>{t(`m02.ojt.reqStatus.${r.status}`)}{r.result ? ` · ${t(`m02.ojt.result.${r.result}`)}` : ''}</span></li>)}</ul></Card>}
      <Modal open={!!sel} onClose={() => setSel(null)} title={t('m02.ojt.signoffTitle')}
        footer={<div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setSel(null)}>{t('common.cancel')}</button><button type="button" className="btn-primary" onClick={signOff} data-testid="m02-ojt-signoff-send">{t('m02.ojt.signoffConfirm')}</button></div>}>
        <div className="space-y-3">
          <Callout tone="info">{t('m02.ojt.signoffBody')}</Callout>
          <RadioGroup label={t('m02.ojt.resultLabel')} name="result" value={result} onChange={(v) => setResult(v as 'pass' | 'fail')} options={['pass', 'fail'].map((v) => ({ value: v, label: t(`m02.ojt.result.${v}`) }))} />
        </div>
      </Modal>
      <ConfirmDialog open={!!decline} onClose={() => setDecline(null)} title={t('m02.ojt.decline')} consequence={t('m02.ojt.declineBody')} requireReason reasonLabel={t('m02.ojt.requestNote')}
        onConfirm={async (note) => { if (decline) await act(() => repo.rpc.closeEvaluationRequest(decline.id, 'decline', note)); }} />
    </div>
  );
}
