// FS78 /my/learning-balance · My learning balance and protected study time (SIMULATED). The annual balance in credits and hours (grants
// minus approved use, rpc.learningBalance = SQL kafaa_learning_balance), the mid-career top-up and why, the outcome-gated catalogue (FS18
// external resources with their published criteria: only gated items can be charged), asking for protected study hours (maker-checker:
// the line manager decides), my requests, and the credits I earned this year (FS30 ledger).
import { useMemo, useState } from 'react';
import {
  Async, BenchmarkChips, Callout, Card, ConfirmDialog, DataTable, Drawer, EmptyState, Page, RadioGroup, Section, StatusPill, TextArea, TextField, WhyThis, type Column,
} from '../../ui';
import { useQuery, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { catalogueCheck } from '../m19/pathways';
import { PATTERNS, checkRequest, gateReasons, hoursCap, yearOf, type Balance } from './balance';
import type { LearningBalanceView } from './backend/rpc';
import { BalanceTiles, Fs91Footer, StudyStatus, isoToday, useCreditsOf, useFs91Act, type Row } from './fs91ui';

export default function MyLearningBalancePage() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const me = s.identity.personId ?? '';
  const q = useQuery(['study_time_requests', 'learning_balances', 'external_resources', 'credit_ledger'], async () => {
    const safe = <T,>(p: Promise<T>, d: T) => p.catch(() => d);
    const [view, reqs, res, crit, skills, ledger] = await Promise.all([
      safe(repo.rpc.learningBalance(null, null), null as LearningBalanceView | null),
      safe(repo.list('study_time_requests', { filter: { person_id: me }, order: [['created_at', 'desc']] }) as Promise<Row[]>, [] as Row[]),
      safe(repo.list('external_resources', { order: [['sort', 'asc']] }) as Promise<Row[]>, [] as Row[]),
      safe(repo.list('catalogue_criteria', { order: [['sort', 'asc']] }) as Promise<Row[]>, [] as Row[]),
      safe(repo.list('skills', {}) as Promise<Row[]>, [] as Row[]),
      safe(repo.list('credit_ledger', { filter: { person_id: me } }) as Promise<Row[]>, [] as Row[]),
    ]);
    return { view, reqs: reqs.filter((r) => r.person_id === me), res, crit, skills, ledger };
  }, [me]);
  return (
    <Page title={t('m34.routes.my-learning-balance.title')} eyebrow={t('m34.sb.eyebrow')} intro={t('m34.sb.intro')} wide
      actions={<><L to="/my/credits" className="btn-outline">{t('m34.sb.toCredits')}</L><L to="/learn/external" className="btn-outline">{t('m34.sb.toCatalogue')}</L></>}>
      <div data-testid="m34-sb-bench"><BenchmarkChips feature="FS78" /></div>
      <Async state={q}>{(d) => <Body d={d} me={me} />}</Async>
      <Fs91Footer />
    </Page>
  );
}

type D = { view: LearningBalanceView | null; reqs: Row[]; res: Row[]; crit: Row[]; skills: Row[]; ledger: Row[] };
function Body({ d, me }: { d: D; me: string }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const c = useCreditsOf();
  const [ask, setAsk] = useState<Row | null>(null);
  const [withdraw, setWithdraw] = useState<Row | null>(null);
  const run = useFs91Act();
  const repo = useRepo();
  const today = isoToday();
  const gated = useMemo(() => new Map(d.res.map((x) => [x.id, x.status === 'published' && x.listed === true && catalogueCheck(x, d.crit as never, d.skills as never, today).ok])), [d, today]);
  if (!d.view) return <EmptyState title={t('m34.sb.noBalance')}>{t('m34.sb.noBalanceBody')}</EmptyState>;
  const { balance, grant } = d.view;
  const year = d.view.year;
  const earned = d.ledger.filter((r) => r.status === 'counted' && String(r.completed_on).slice(0, 4) === String(year));
  const earnedH = earned.reduce((a, r) => a + Number(r.notional_hours || 0), 0);
  const items = d.res.filter((x) => x.listed !== false && x.status === 'published');
  const cols: Column<Row>[] = [
    { key: 'item', header: t('m34.sb.colItem'), value: (r) => pick(r, 'resource_title'), sortable: true, render: (r) => <span className="font-semibold">{pick(r, 'resource_title')}</span> },
    { key: 'hours', header: t('m34.sb.colHours'), value: (r) => Number(r.hours), sortable: true, render: (r) => <span className="num">{t('m34.sb.hoursCredits', { h: f.num(r.hours), c: c(r.hours) })}</span> },
    { key: 'when', header: t('m34.sb.colWhen'), value: (r) => String(r.starts_on), sortable: true, render: (r) => <span className="whitespace-nowrap">{f.date(String(r.starts_on).slice(0, 10))} – {f.date(String(r.ends_on).slice(0, 10))}</span> },
    { key: 'pattern', header: t('m34.sb.colPattern'), value: (r) => r.pattern, render: (r) => t(`m34.sb.pattern.${r.pattern}`) },
    { key: 'status', header: t('m34.sb.colStatus'), value: (r) => r.status, render: (r) => <StudyStatus status={r.status} /> },
    { key: 'by', header: t('m34.sb.colDecided'), value: (r) => r.decided_on ?? '', render: (r) => (r.decided_on ? <span className="text-[12px]">{t(r.decided_role === 'hr_director' ? 'm34.sb.byHr' : 'm34.sb.byManager')} · {f.date(String(r.decided_on).slice(0, 10))}{r.decision_note ? ` · ${r.decision_note}` : ''}</span> : <span className="text-[12px] text-ink-3">{r.line_manager_name ? t('m34.sb.waitingFor', { name: r.line_manager_name }) : '—'}</span>) },
    { key: 'act', header: '', value: () => '', render: (r) => ((r.status === 'requested' || (r.status === 'approved' && String(r.starts_on).slice(0, 10) > today)) ? <button type="button" className="btn-ghost btn-sm" onClick={() => setWithdraw(r)} data-testid={`m34-sb-withdraw-${r.id}`}>{t('m34.sb.withdraw')}</button> : null) },
  ];
  return (
    <div className="space-y-6">
      <Section title={t('m34.sb.balanceTitle', { y: f.num(year, { useGrouping: false }) })} description={t('m34.sb.balanceDesc')}>
        <BalanceTiles balance={balance} grant={grant} />
        <p className="mt-2 text-[13px] text-ink-2" data-testid="m34-sb-earned">{t('m34.sb.earned', { c: c(earnedH), n: f.num(earned.length) })} <L to="/my/credits" className="text-accent hover:underline">{t('m34.sb.toCredits')}</L></p>
      </Section>
      <Callout tone="info" title={t('m34.sb.howTitle')}>{t('m34.sb.howBody')}</Callout>
      <Section title={t('m34.sb.catTitle')} description={t('m34.sb.catDesc')}>
        <ul className="mb-3 flex flex-wrap gap-2" data-testid="m34-sb-criteria">
          {d.crit.filter((x) => x.status !== 'retired').map((x) => <li key={x.id}><StatusPill tone={x.required ? 'accent' : 'neutral'}>{t('m34.sb.criterion', { name: pick(x, 'name'), min: f.num(x.min_score) })}</StatusPill></li>)}
        </ul>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="m34-sb-catalogue">
          {items.map((x) => {
            const g = gated.get(x.id) === true;
            const open = d.reqs.some((r) => r.resource_id === x.id && Number(r.year) === year && (r.status === 'requested' || r.status === 'approved'));
            return (
              <Card key={x.id} title={pick(x, 'title')} eyebrow={pick(x, 'provider')}>
                <div className="flex flex-wrap items-center gap-2 text-[13px]">
                  <StatusPill tone={g ? 'ok' : 'bad'}>{g ? t('m34.sb.gated') : t('m34.sb.ungated')}</StatusPill>
                  <span className="text-ink-2">{x.hours != null ? t('m34.sb.itemHours', { h: f.num(Number(x.hours)), c: c(Number(x.hours)) }) : t('m34.sb.itemNoHours')}</span>
                  <span className="text-ink-3">· {t(`m34.sb.cost.${x.cost_band}`)}</span>
                </div>
                <p className="mt-2 text-[12px] text-ink-3">{t('m34.sb.maxAsk', { h: f.num(hoursCap(x)) })}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <WhyThis reasons={gateReasons(x, d.crit as never, g)} testId={`m34-sb-why-${x.id}`} />
                  {open ? <span className="text-[12px] text-sim">{t('m34.sb.alreadyOpen')}</span>
                    : <button type="button" className="btn-primary btn-sm" disabled={!g || balance.available_hours < 2} onClick={() => setAsk(x)} data-testid={`m34-sb-ask-${x.id}`}>{t('m34.sb.ask')}</button>}
                </div>
              </Card>
            );
          })}
        </div>
      </Section>
      <Section title={t('m34.sb.reqTitle')} description={t('m34.sb.reqDesc')}>
        {d.reqs.length === 0 ? <EmptyState title={t('m34.sb.reqEmpty')} /> : (
          <div data-testid="m34-sb-requests"><DataTable rows={d.reqs} columns={cols} rowKey={(r) => r.id} pageSize={10} caption={t('m34.sb.reqTitle')} csvName="kafaa-my-study-time.csv" /></div>
        )}
      </Section>
      {ask && <AskDrawer item={ask} me={me} balance={balance} reqs={d.reqs} gated={gated.get(ask.id) === true} onClose={() => setAsk(null)} />}
      <ConfirmDialog open={!!withdraw} onClose={() => setWithdraw(null)} title={t('m34.sb.withdrawTitle')} consequence={t('m34.sb.withdrawBody')}
        onConfirm={async () => { if (withdraw) await run(() => repo.rpc.requestStudyTime({ action: 'withdraw', id: withdraw.id }), t('m34.sb.withdrawn')); setWithdraw(null); }} />
    </div>
  );
}

function AskDrawer({ item, me, balance, reqs, gated, onClose }: { item: Row; me: string; balance: Balance; reqs: Row[]; gated: boolean; onClose: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const c = useCreditsOf();
  const s = useSession();
  const repo = useRepo();
  const run = useFs91Act();
  const today = isoToday();
  const y = today.slice(0, 4);
  const [hours, setHours] = useState(String(Math.min(hoursCap(item), Math.max(2, Math.min(10, balance.available_hours)))));
  const [pattern, setPattern] = useState<string>('release_days');
  const [starts, setStarts] = useState('');
  const [ends, setEnds] = useState('');
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState(false);
  const input = { resource_id: item.id, hours: Number(hours), starts_on: starts, ends_on: ends, pattern, reason };
  const yr = yearOf(starts);
  const code = checkRequest(input, {
    today, person: s.person ? { id: me, kind: (s.person as Row).kind, status: (s.person as Row).status, hire_date: (s.person as Row).hire_date } : null,
    item: { id: item.id, hours: item.hours == null ? null : Number(item.hours), gated }, available: yr == null || String(yr) === y ? balance.available_hours : Number.MAX_SAFE_INTEGER,
    openSame: reqs.some((r) => r.resource_id === item.id && (r.status === 'requested' || r.status === 'approved') && Number(r.year) === (yr ?? Number(y))), lineManager: 'line-manager',
  });
  return (
    <Drawer open onClose={onClose} title={t('m34.sb.askTitle', { item: pick(item, 'title') })}>
      <div className="space-y-3" data-testid="m34-sb-ask-drawer">
        <p className="text-[13px] text-ink-2">{t('m34.sb.askBody', { a: c(balance.available_hours), h: f.num(balance.available_hours) })}</p>
        <TextField name="hours" type="number" label={t('m34.sb.fHours', { max: f.num(hoursCap(item)) })} value={hours} onChange={setHours} hint={t('m34.sb.fHoursHint', { c: c(Number(hours) || 0) })} />
        <RadioGroup label={t('m34.sb.fPattern')} name="pattern" value={pattern} onChange={setPattern} options={PATTERNS.map((p) => ({ value: p, label: t(`m34.sb.pattern.${p}`) }))} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField name="starts" type="date" label={t('m34.sb.fStarts')} value={starts} onChange={setStarts} />
          <TextField name="ends" type="date" label={t('m34.sb.fEnds')} value={ends} onChange={setEnds} />
        </div>
        <TextArea name="reason" label={t('m34.sb.fReason')} rows={3} value={reason} onChange={setReason} />
        {code === 'ok' ? <Callout tone="ok" title={t('m34.sb.okTitle')}>{t('m34.sb.okBody')}</Callout> : <Callout tone="bad" title={t('m34.sb.failTitle')}><span data-testid="m34-sb-check">{t(`m34.sbmsg.${code}`)}</span></Callout>}
        <button type="button" className="btn-primary" disabled={code !== 'ok'} onClick={() => setConfirm(true)} data-testid="m34-sb-send">{t('m34.sb.send')}</button>
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m34.sb.confirmTitle')} consequence={t('m34.sb.confirmBody', { h: f.num(Number(hours)), c: c(Number(hours)) })}
        onConfirm={async () => { const r = await run(() => repo.rpc.requestStudyTime({ action: 'request', ...input }), t('m34.sb.sent')); setConfirm(false); if (r.ok) onClose(); }} />
    </Drawer>
  );
}
