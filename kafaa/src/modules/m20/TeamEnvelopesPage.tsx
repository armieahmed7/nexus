// /opportunities/envelopes (M20 · FS27): the line manager's view of time envelopes. Approve once (maker-checker: never my own; only as the
// line manager of record), decline with a reason, and see how much of each approved envelope my reports have used, gig by gig.
import { useState } from 'react';
import { Page, Section, Grid, Card, Async, EmptyState, StatTile, ConfirmDialog, DataTable, Icon, BenchmarkChips, Callout } from '../../ui';
import { useAction, useRepo } from '../../data';
import { L, useFormat, useLang, usePick, useT } from '../../i18n';
import { useFutureData, ChannelChip, EnvelopeMeter, EnvelopePill, todayIso, type FutureData } from './fsUi';
import { envelopeView } from './futureGigs';
import type { TimeEnvelopesRow } from '../../data/types';

export default function TeamEnvelopesPage() {
  const t = useT();
  const { q, me } = useFutureData();
  return (
    <Page title={t('m20.routes.opportunities-envelopes.title')} eyebrow={<L to="/opportunities/future">{t('m20.fs.env.back')}</L>} intro={t('m20.fs.team.intro')} wide>
      <div className="mb-4"><BenchmarkChips feature="FS27" /></div>
      <Async state={q} isEmpty={() => false}>{(d) => <Body d={d} me={me} />}</Async>
    </Page>
  );
}

function Body({ d, me }: { d: FutureData; me: string | null }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const [act, setAct] = useState<{ e: TimeEnvelopesRow; decision: 'approve' | 'decline' } | null>(null);
  const today = todayIso();
  const gigs = new Map(d.opps.map((o) => [o.id, o]));
  const team = d.envs.filter((e) => e.line_manager_id === me && e.person_id !== me);
  const pending = team.filter((e) => e.status === 'requested');
  const approved = team.filter((e) => e.status === 'approved');
  const name = (e: TimeEnvelopesRow) => (lang === 'ar' ? e.person_name_ar || e.person_name : e.person_name);
  const views = new Map(approved.map((e) => [e.id, envelopeView(e as never, d.apps as never, gigs, today)]));
  const hours = approved.filter((e) => e.ends_on >= today).reduce((s, e) => s + e.cap_hours, 0);
  const used = [...views.values()].reduce((s, v) => s + v.used, 0);
  if (!team.length) return <EmptyState icon="users" title={t('m20.fs.team.none')}>{t('m20.fs.team.noneBody')}</EmptyState>;
  return (
    <div className="space-y-6">
      <Grid cols={4}>
        <StatTile label={t('m20.fs.team.pending')} value={f.num(pending.length)} tone={pending.length ? 'info' : undefined} sub={t('m20.fs.team.pendingSub')} />
        <StatTile label={t('m20.fs.team.approved')} value={f.num(approved.length)} sub={t('m20.fs.team.approvedSub')} tone="ok" />
        <StatTile label={t('m20.fs.team.hours')} value={t('m20.fs.hours', { n: f.num(hours) })} sub={t('m20.fs.team.hoursSub')} />
        <StatTile label={t('m20.fs.team.used')} value={t('m20.fs.hours', { n: f.num(used) })} sub={t('m20.fs.team.usedSub')} />
      </Grid>

      <Section title={t('m20.fs.team.pendingTitle')} description={t('m20.fs.team.pendingDesc')}>
        {pending.length === 0 ? <p className="text-[13px] text-ink-3">{t('m20.fs.team.nothingPending')}</p> : (
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="m20-fs-team-pending">
            {pending.map((e) => (
              <li key={e.id}>
                <Card title={name(e)} actions={<EnvelopePill status={e.status} />}>
                  <p className="text-[13px]"><span className="font-semibold">{t('m20.fs.env.cardTitle', { pct: f.num(e.pct), period: e.period })}</span> · {t('m20.fs.env.capValue', { pct: f.num(e.pct), h: f.num(e.cap_hours) })}</p>
                  <div className="mt-2 flex flex-wrap gap-1">{(e.channels ?? []).map((c) => <ChannelChip key={c} channel={c} />)}</div>
                  <blockquote className="mt-2 border-s-2 border-line ps-3 text-[13px] text-ink-2">“{e.reason}”</blockquote>
                  <div className="mt-3 flex gap-2">
                    <button className="btn-primary btn-sm" onClick={() => setAct({ e, decision: 'approve' })} data-testid={`m20-fs-approve-${e.id}`}><Icon name="check" size={14} />{t('m20.fs.team.approve')}</button>
                    <button className="btn-outline btn-sm" onClick={() => setAct({ e, decision: 'decline' })} data-testid={`m20-fs-decline-${e.id}`}>{t('m20.fs.team.decline')}</button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t('m20.fs.team.usageTitle')} description={t('m20.fs.team.usageDesc')}>
        {approved.length === 0 ? <p className="text-[13px] text-ink-3">{t('m20.fs.team.noneApproved')}</p> : (
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="m20-fs-team-usage">
            {approved.map((e) => {
              const v = views.get(e.id)!;
              return (
                <li key={e.id}>
                  <Card title={name(e)} actions={<EnvelopePill status={v.phase} />}>
                    <p className="mb-2 text-[12.5px] text-ink-2">{t('m20.fs.env.cardTitle', { pct: f.num(e.pct), period: e.period })}</p>
                    <EnvelopeMeter used={v.used} cap={v.cap} />
                    {v.apps.length > 0 && (
                      <ul className="mt-2 space-y-1 text-[12.5px]">
                        {v.apps.map((a) => { const o = gigs.get(a.opportunity_id); return <li key={a.id} className="flex justify-between gap-2"><span className="truncate">{o ? pick(o, 'title') : a.opportunity_id}</span><span className="num shrink-0 text-ink-3">{t('m20.common.hoursWeek', { n: f.num(o?.hours_week ?? 0) })}</span></li>; })}
                      </ul>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title={t('m20.fs.team.allTitle')}>
        <DataTable rows={team} rowKey={(e) => e.id} csvName="time-envelopes.csv" caption={t('m20.fs.team.allTitle')}
          columns={[
            { key: 'person', header: t('m20.fs.team.colPerson'), value: (e) => name(e) },
            { key: 'period', header: t('m20.fs.team.colPeriod'), value: (e) => e.period },
            { key: 'pct', header: t('m20.fs.team.colPct'), value: (e) => e.pct, render: (e) => `${f.num(e.pct)}% · ${t('m20.fs.hours', { n: f.num(e.cap_hours) })}`, align: 'end' },
            { key: 'status', header: t('m20.fs.team.colStatus'), value: (e) => e.status, render: (e) => <EnvelopePill status={e.status} /> },
            { key: 'decided', header: t('m20.fs.team.colDecided'), value: (e) => e.decided_at ?? '', render: (e) => (e.decided_at ? f.date(e.decided_at) : '—') },
          ]} />
      </Section>
      <Callout tone="info" title={t('m20.fs.team.ruleTitle')}>{t('m20.fs.team.rule')}</Callout>

      <ConfirmDialog open={!!act} onClose={() => setAct(null)} requireReason={act?.decision === 'decline'} reasonLabel={t('m20.fs.team.reason')}
        title={act?.decision === 'approve' ? t('m20.fs.team.approveTitle', { name: act ? name(act.e) : '' }) : t('m20.fs.team.declineTitle', { name: act ? name(act.e) : '' })}
        consequence={act?.decision === 'approve' ? t('m20.fs.team.approveBody', { pct: f.num(act.e.pct), h: f.num(act.e.cap_hours), period: act.e.period }) : t('m20.fs.team.declineBody')}
        confirmLabel={act?.decision === 'approve' ? t('m20.fs.team.approve') : t('m20.fs.team.decline')}
        onConfirm={async (reason) => { if (act) await run(() => repo.rpc.approveEnvelope(act.e.id, act.decision, reason)); }} />
    </div>
  );
}
