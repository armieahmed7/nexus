// /opportunities/envelope (M20 · FS27): my time envelope. Ask my line manager once for a share of my time (5-20 % of a 40-hour week) for
// future-skills gigs in this or next quarter; see what is used and what is left; withdraw it. Gigs inside an approved envelope are
// released at once (no per-gig release); the rule is shown, not hidden.
import { useState } from 'react';
import { Page, Section, Card, Async, EmptyState, Callout, Icon, ConfirmDialog, Timeline, KeyValue, BenchmarkChips, CheckboxField, TextArea, SelectField, RadioGroup } from '../../ui';
import { useAction, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { CHANNELS, ENV_PCTS, capHours, openPeriods, validateEnvelope } from './futureGigs';
import { useFutureData, useMyEnvelopes, useRuleMessage, ChannelChip, EnvelopeMeter, EnvelopePill, todayIso, type FutureData } from './fsUi';
import { AppPill } from './ui';
import type { TimeEnvelopesRow } from '../../data/types';

export default function EnvelopePage() {
  const t = useT();
  const { q, me } = useFutureData();
  return (
    <Page title={t('m20.routes.opportunities-envelope.title')} eyebrow={<L to="/opportunities/future">{t('m20.fs.env.back')}</L>} intro={t('m20.fs.env.intro')}>
      <div className="mb-4"><BenchmarkChips feature="FS27" /></div>
      <Async state={q} isEmpty={() => false}>{(d) => <Body d={d} me={me} />}</Async>
    </Page>
  );
}

type Hist = { at: string; status: string; by: string | null; note: string | null };

function Body({ d, me }: { d: FutureData; me: string | null }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const env = useMyEnvelopes(d, me);
  const [withdraw, setWithdraw] = useState<TimeEnvelopesRow | null>(null);
  const today = todayIso();
  const periods = openPeriods(today);
  const live = env.mine.filter((e) => e.status === 'requested' || e.status === 'approved');
  const canAsk = periods.some((p) => !live.some((e) => e.period === p));
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        {env.mine.length === 0 ? (
          <EmptyState icon="calendar" title={t('m20.fs.env.none')}>{t('m20.fs.env.noneBody')}</EmptyState>
        ) : (
          <ul className="space-y-4" data-testid="m20-fs-envelopes">
            {env.mine.map((e) => {
              const v = env.viewOf(e);
              const counted = d.apps.filter((a) => a.envelope_id === e.id);
              return (
                <li key={e.id}>
                  <Card title={t('m20.fs.env.cardTitle', { pct: f.num(e.pct), period: e.period })} actions={<EnvelopePill status={e.status === 'approved' ? v.phase : e.status} />}>
                    <div className="space-y-3">
                      <KeyValue items={[
                        [t('m20.fs.env.dates'), `${f.date(e.starts_on)} – ${f.date(e.ends_on)}`],
                        [t('m20.fs.env.cap'), t('m20.fs.env.capValue', { pct: f.num(e.pct), h: f.num(e.cap_hours) })],
                        [t('m20.fs.env.channels'), <span key="c" className="flex flex-wrap gap-1">{(e.channels ?? []).map((c) => <ChannelChip key={c} channel={c} />)}</span>],
                        [t('m20.fs.env.manager'), t('m20.fs.env.managerValue')],
                      ]} />
                      {e.status === 'approved' && <EnvelopeMeter used={v.used} cap={v.cap} />}
                      {e.status === 'declined' && e.decision_note && <Callout tone="bad" title={t('m20.fs.env.declinedTitle')}>{e.decision_note}</Callout>}
                      {counted.length > 0 && (
                        <div>
                          <div className="caps mb-1">{t('m20.fs.env.counted')}</div>
                          <ul className="space-y-1 text-[13px]" data-testid="m20-fs-env-apps">
                            {counted.map((a) => { const o = env.gigs.get(a.opportunity_id); return <li key={a.id} className="flex flex-wrap items-center justify-between gap-2"><L to={`/opportunities/${a.opportunity_id}`} className="hover:underline">{o ? pick(o, 'title') : a.opportunity_id}</L><span className="flex items-center gap-2"><span className="num text-ink-3">{t('m20.common.hoursWeek', { n: f.num(o?.hours_week ?? 0) })}</span><AppPill status={a.status} /></span></li>; })}
                          </ul>
                        </div>
                      )}
                      <details className="text-[12.5px]"><summary className="cursor-pointer text-ink-2">{t('m20.common.history')}</summary>
                        <div className="mt-2"><Timeline items={((e.history as unknown as Hist[]) ?? []).slice().reverse().map((h, i) => ({ id: `${h.at}-${i}`, when: f.dateTime(h.at), title: t(`m20.fs.envStatus.${h.status}`), detail: h.note ?? undefined }))} /></div>
                      </details>
                      {(e.status === 'requested' || e.status === 'approved') && <button className="btn-ghost btn-sm" onClick={() => setWithdraw(e)} data-testid="m20-fs-env-withdraw">{t('m20.fs.env.withdraw')}</button>}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
        <ConfirmDialog open={!!withdraw} onClose={() => setWithdraw(null)} title={t('m20.fs.env.withdrawTitle')} consequence={t('m20.fs.env.withdrawBody')} danger confirmLabel={t('m20.fs.env.withdraw')}
          onConfirm={async () => { if (withdraw) await run(() => repo.rpc.approveEnvelope(withdraw.id, 'withdraw')); }} />
      </div>
      <aside className="space-y-4">
        {canAsk ? <RequestCard periods={periods.filter((p) => !live.some((e) => e.period === p))} /> : <Callout tone="ok" title={t('m20.fs.env.allSet')}>{t('m20.fs.env.allSetBody')}</Callout>}
        <Section title={t('m20.fs.hub.howTitle')}>
          <ol className="list-decimal space-y-1.5 ps-5 text-[13px] text-ink-2"><li>{t('m20.fs.hub.how1')}</li><li>{t('m20.fs.hub.how2')}</li><li>{t('m20.fs.hub.how3')}</li><li>{t('m20.fs.hub.how4')}</li></ol>
        </Section>
      </aside>
    </div>
  );
}

function RequestCard({ periods }: { periods: string[] }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const [pct, setPct] = useState('10');
  const [period, setPeriod] = useState(periods[0]);
  const [channels, setChannels] = useState<string[]>([...CHANNELS]);
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState(false);
  const input = { pct: Number(pct), period, channels, reason };
  const problem = validateEnvelope(input, todayIso());
  const msg = useRuleMessage();
  return (
    <Card title={t('m20.fs.env.askTitle')}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!problem) setConfirm(true); }} data-testid="m20-fs-env-form">
        <RadioGroup label={t('m20.fs.env.pct')} name="pct" value={pct} onChange={setPct} options={ENV_PCTS.map((p) => ({ value: String(p), label: t('m20.fs.env.pctOption', { pct: f.num(p), h: f.num(capHours(p)) }) }))} />
        <SelectField label={t('m20.fs.env.period')} name="period" value={period} onChange={setPeriod} options={periods.map((p) => ({ value: p, label: p }))} />
        <fieldset>
          <legend className="caps mb-1">{t('m20.fs.env.channels')}</legend>
          <div className="space-y-1">
            {CHANNELS.map((c) => <CheckboxField key={c} label={t(`m20.fs.channel.${c}`)} checked={channels.includes(c)} onChange={(v) => setChannels((x) => (v ? [...x, c] : x.filter((y) => y !== c)))} />)}
          </div>
        </fieldset>
        <TextArea label={t('m20.fs.env.reason')} name="reason" value={reason} onChange={setReason} hint={t('m20.fs.env.reasonHint')} />
        {problem && reason.length > 0 && <p className="text-[12.5px] text-bad" role="alert">{msg(problem.message)}</p>}
        <button type="submit" className="btn-primary w-full" disabled={!!problem} data-testid="m20-fs-env-ask"><Icon name="check" size={14} />{t('m20.fs.env.ask')}</button>
      </form>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m20.fs.env.confirmTitle')} consequence={t('m20.fs.env.confirmBody', { pct: f.num(input.pct), h: f.num(capHours(input.pct)), period })} confirmLabel={t('m20.fs.env.ask')}
        onConfirm={async () => { const r = await run(() => repo.rpc.requestEnvelope(input)); if (r.ok) setReason(''); }} />
    </Card>
  );
}
