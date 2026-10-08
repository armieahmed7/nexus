// /opportunities/my (M20 · F08): my applications through release, selection and sign-off, my saved opportunities, and the
// skills evidence my signed-off work added to the passport.
import { useState } from 'react';
import { Page, Card, Async, EmptyState, Tabs, StatTile, Grid, ConfirmDialog, Callout, Icon } from '../../ui';
import { useAction, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { useMarket, useLabels, KindChip, AppPill, AppStepper, AppTimeline, usePersonName, useRange, OppPill, type MarketData, type App } from './ui';

export default function MyOpportunitiesPage() {
  const t = useT();
  const { q, me } = useMarket();
  return (
    <Page title={t('m20.routes.opportunities-my.title')} intro={t('m20.my.intro')} actions={<L to="/opportunities" className="btn-outline btn-sm"><Icon name="search" size={14} />{t('m20.my.browse')}</L>}>
      <Async state={q} isEmpty={() => false}>{(d) => <Mine d={d} me={me} />}</Async>
    </Page>
  );
}

function Mine({ d, me }: { d: MarketData; me: string | null }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lab = useLabels(d);
  const range = useRange();
  const repo = useRepo();
  const run = useAction();
  const apps = d.apps.filter((a) => a.person_id === me);
  const opp = new Map(d.opps.map((o) => [o.id, o]));
  const active = apps.filter((a) => ['applied', 'released', 'selected'].includes(a.status));
  const done = apps.filter((a) => a.status === 'completed');
  const closed = apps.filter((a) => ['declined_release', 'not_selected', 'withdrawn'].includes(a.status));
  const saved = d.saves.filter((s) => s.saved && s.person_id === me);
  const evidence = done.flatMap((a) => Object.entries((a.outcome_levels as Record<string, number>) ?? {}).map(([skill, level]) => ({ a, skill, level })));
  const list = (rows: App[], emptyKey: string) => rows.length === 0 ? <EmptyState icon="briefcase" title={t(emptyKey)} action={<L to="/opportunities" className="btn-outline btn-sm">{t('m20.my.browse')}</L>} /> : (
    <ul className="space-y-3" data-testid="m20-my-list">{rows.map((a) => <AppItem key={a.id} app={a} d={d} />)}</ul>
  );
  return (
    <div className="space-y-6">
      <Grid cols={4}>
        <StatTile label={t('m20.my.statActive')} value={f.num(active.length)} sub={t('m20.my.statActiveSub', { n: f.num(active.filter((a) => a.status === 'applied').length) })} />
        <StatTile label={t('m20.my.statSelected')} value={f.num(apps.filter((a) => a.status === 'selected').length)} tone="ok" />
        <StatTile label={t('m20.my.statDone')} value={f.num(done.length)} />
        <StatTile label={t('m20.my.statEvidence')} value={f.num(evidence.length)} sub={t('m20.my.statEvidenceSub')} />
      </Grid>
      <Tabs tabs={[
        { id: 'active', label: t('m20.my.tabActive'), badge: f.num(active.length), content: list(active, 'm20.my.noneActive') },
        { id: 'done', label: t('m20.my.tabDone'), badge: f.num(done.length), content: (
          <div className="space-y-4">
            {evidence.length > 0 && (
              <Card title={t('m20.my.evidenceTitle')} actions={<L to="/my/skills" className="btn-outline btn-sm">{t('m20.my.openPassport')}</L>}>
                <ul className="divide-y divide-line" data-testid="m20-my-evidence">
                  {evidence.map(({ a, skill, level }) => (
                    <li key={`${a.id}-${skill}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <div><div className="font-semibold">{lab.skill(skill)}</div><div className="text-[12px] text-ink-3">{opp.get(a.opportunity_id) ? pick(opp.get(a.opportunity_id), 'title') : ''} · {f.date(a.completed_at)}</div></div>
                      <span className="chip border-ok-line bg-ok-bg text-ok">{t('m20.my.evidenceChip', { lv: f.num(level) })}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            {list(done, 'm20.my.noneDone')}
          </div>
        ) },
        { id: 'saved', label: t('m20.my.tabSaved'), badge: f.num(saved.length), content: saved.length === 0 ? <EmptyState icon="book" title={t('m20.my.noneSaved')} /> : (
          <ul className="space-y-2" data-testid="m20-my-saved">
            {saved.map((s) => { const o = opp.get(s.opportunity_id); if (!o) return null; return (
              <li key={s.opportunity_id} className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-line bg-panel p-3">
                <div className="min-w-0"><div className="mb-1 flex gap-1.5"><KindChip kind={o.kind} /><OppPill status={o.status} /></div><L to={`/opportunities/${o.id}`} className="font-semibold">{pick(o, 'title')}</L><div className="text-[12px] text-ink-3">{range(o.start_on, o.end_on)}</div></div>
                <button className="btn-ghost btn-sm" onClick={() => run(() => repo.rpc.saveOpportunity(o.id, false))}>{t('m20.my.unsave')}</button>
              </li>
            ); })}
          </ul>
        ) },
        { id: 'closed', label: t('m20.my.tabClosed'), badge: f.num(closed.length), content: list(closed, 'm20.my.noneClosed') },
      ]} />
      <Callout tone="sim" title={t('m20.detail.mirrorTitle')}>{t('m20.detail.mirrorBody')}</Callout>
    </div>
  );
}

function AppItem({ app, d }: { app: App; d: MarketData }) {
  const t = useT();
  const pick = usePick();
  const range = useRange();
  const repo = useRepo();
  const run = useAction();
  const name = usePersonName();
  const lab = useLabels(d);
  const [hist, setHist] = useState(false);
  const [withdraw, setWithdraw] = useState(false);
  const o = d.opps.find((x) => x.id === app.opportunity_id);
  return (
    <li className="card p-4" data-testid="m20-my-app">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {o && <div className="mb-1"><KindChip kind={o.kind} /></div>}
          <L to={`/opportunities/${app.opportunity_id}`} className="text-[15px] font-semibold">{o ? pick(o, 'title') : app.opportunity_id}</L>
          {o && <div className="text-[12.5px] text-ink-3">{lab.role(o.host_role_id)} · {range(o.start_on, o.end_on)}</div>}
        </div>
        <AppPill status={app.status} />
      </div>
      <div className="mt-3"><AppStepper status={app.status} /></div>
      <p className="mt-2 text-[13px] text-ink-2">{t(`m20.next.${app.status}`)}</p>
      {app.skip_level && app.status === 'applied' && <p className="mt-1 text-[12.5px] text-info">{t('m20.detail.skipNote')}</p>}
      {app.status === 'completed' && app.outcome_note && <p className="mt-1 text-[13px] text-ink-2">“{app.outcome_note}”</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        <button className="btn-ghost btn-sm" aria-expanded={hist} onClick={() => setHist((x) => !x)}>{hist ? t('m20.common.hideHistory') : t('m20.common.history')}</button>
        {['applied', 'released', 'selected'].includes(app.status) && <button className="btn-ghost btn-sm" onClick={() => setWithdraw(true)} data-testid="m20-withdraw">{t('m20.my.withdraw')}</button>}
      </div>
      {hist && <div className="mt-3"><AppTimeline app={app} name={(id) => name(app, id)} /></div>}
      <ConfirmDialog open={withdraw} onClose={() => setWithdraw(false)} title={t('m20.my.withdrawTitle')} consequence={t('m20.my.withdrawBody')} danger confirmLabel={t('m20.my.withdraw')}
        onConfirm={async () => { await run(() => repo.rpc.withdrawOpportunityApplication(app.id)); }} />
    </li>
  );
}
