// /opportunities/manage (M20 · F08): the decision desk. Line managers release (or decline) their people; posters select
// released applicants and sign off outcomes; drafts are published and opportunities closed. Maker-checker: the poster never
// releases, so a poster's own direct reports are routed to the poster's line manager.
import { useState } from 'react';
import { Page, Card, Async, EmptyState, Tabs, StatTile, Grid, ConfirmDialog, Callout, Icon } from '../../ui';
import { useAction, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { Can } from '../../auth/guards';
import { useMarket, useLabels, KindChip, OppPill, useRange, seatsLeft, type MarketData, type Opp } from './ui';
import { ApplicantCard, ReleaseCard } from './Pipeline';

export default function ManageOpportunitiesPage() {
  const t = useT();
  const { q, me } = useMarket();
  return (
    <Page title={t('m20.routes.opportunities-manage.title')} intro={t('m20.manage.intro')} wide
      actions={<Can res="opportunities" levels={['W']}><L to="/opportunities/post" className="btn-primary btn-sm"><Icon name="plus" size={14} />{t('m20.market.post')}</L></Can>}>
      <Async state={q} isEmpty={() => false}>{(d) => <Desk d={d} me={me} />}</Async>
    </Page>
  );
}

function Desk({ d, me }: { d: MarketData; me: string | null }) {
  const t = useT();
  const f = useFormat();
  const lab = useLabels(d);
  const opp = new Map(d.opps.map((o) => [o.id, o]));
  const releases = d.apps.filter((a) => a.releaser_id === me && a.person_id !== me);
  const pending = releases.filter((a) => a.status === 'applied');
  const decided = releases.filter((a) => a.status !== 'applied');
  const mine = d.opps.filter((o) => o.posted_by === me);
  const toSelect = d.apps.filter((a) => a.poster_id === me && a.status === 'released').length;
  const toSign = d.apps.filter((a) => a.poster_id === me && a.status === 'selected').length;
  return (
    <div className="space-y-6">
      <Grid cols={4}>
        <StatTile label={t('m20.manage.statRelease')} value={f.num(pending.length)} tone={pending.length ? 'info' : undefined} sub={t('m20.manage.statReleaseSub')} />
        <StatTile label={t('m20.manage.statSelect')} value={f.num(toSelect)} sub={t('m20.manage.statSelectSub')} />
        <StatTile label={t('m20.manage.statSign')} value={f.num(toSign)} sub={t('m20.manage.statSignSub')} />
        <StatTile label={t('m20.manage.statPosted')} value={f.num(mine.length)} sub={t('m20.manage.statPostedSub', { n: f.num(mine.filter((o) => o.status === 'open').length) })} />
      </Grid>
      <Callout title={t('m20.manage.makerTitle')}>{t('m20.manage.makerBody')}</Callout>
      <Tabs initial={pending.length || !mine.length ? 'release' : 'postings'} tabs={[
        { id: 'release', label: t('m20.manage.tabRelease'), badge: f.num(pending.length), content: (
          <div className="space-y-4">
            {pending.length === 0 ? <EmptyState icon="check" title={t('m20.manage.noRelease')}>{t('m20.manage.noReleaseBody')}</EmptyState> : <ul className="space-y-2" data-testid="m20-release-list">{pending.map((a) => <ReleaseCard key={a.id} app={a} opp={opp.get(a.opportunity_id)} lab={lab} me={me} />)}</ul>}
            {decided.length > 0 && (
              <details className="rounded-card border border-line p-3">
                <summary className="cursor-pointer font-semibold">{t('m20.manage.decided', { n: f.num(decided.length) })}</summary>
                <ul className="mt-3 space-y-2">{decided.map((a) => <ReleaseCard key={a.id} app={a} opp={opp.get(a.opportunity_id)} lab={lab} me={me} />)}</ul>
              </details>
            )}
          </div>
        ) },
        { id: 'postings', label: t('m20.manage.tabPostings'), badge: f.num(mine.length), content: mine.length === 0 ? (
          <EmptyState icon="briefcase" title={t('m20.manage.noPostings')} action={<Can res="opportunities" levels={['W']}><L to="/opportunities/post" className="btn-primary btn-sm">{t('m20.market.post')}</L></Can>} />
        ) : <div className="space-y-4" data-testid="m20-postings">{mine.map((o) => <Posting key={o.id} o={o} d={d} />)}</div> },
      ]} />
    </div>
  );
}

function Posting({ o, d }: { o: Opp; d: MarketData }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const lab = useLabels(d);
  const range = useRange();
  const [act, setAct] = useState<'open' | 'closed' | null>(null);
  const apps = d.apps.filter((a) => a.opportunity_id === o.id);
  const order = ['released', 'applied', 'selected', 'completed', 'declined_release', 'not_selected', 'withdrawn'];
  const sorted = [...apps].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  const counts = (s: string) => apps.filter((a) => a.status === s).length;
  return (
    <Card as="article" eyebrow={<span className="flex flex-wrap gap-1.5"><KindChip kind={o.kind} /><OppPill status={o.status} /></span>}
      title={<L to={`/opportunities/${o.id}`} className="link-plain hover:underline">{pick(o, 'title')}</L>}
      actions={
        <div className="flex gap-2">
          {(o.status === 'draft' || o.status === 'closed') && <button className="btn-primary btn-sm" onClick={() => setAct('open')} data-testid="m20-publish">{o.status === 'draft' ? t('m20.manage.publish') : t('m20.manage.reopen')}</button>}
          {o.status !== 'closed' && <button className="btn-outline btn-sm" onClick={() => setAct('closed')}>{t('m20.manage.close')}</button>}
        </div>
      }
      footer={<>{range(o.start_on, o.end_on)} · {t('m20.common.hoursWeek', { n: f.num(o.hours_week) })} · {t('m20.common.seatsLeft', { n: f.num(seatsLeft(o)), of: f.num(o.seats) })}</>}>
      <div className="mb-3 flex flex-wrap gap-2 text-[12.5px]">
        {(['applied', 'released', 'selected', 'completed'] as const).map((s) => <span key={s} className="chip border-line bg-sunken text-ink-2">{t(`m20.appStatus.${s}`)}: <span className="num">{f.num(counts(s))}</span></span>)}
      </div>
      {sorted.length === 0 ? <p className="text-[13px] text-ink-3">{t('m20.manage.noApplicants')}</p> : <ul className="space-y-2">{sorted.map((a) => <ApplicantCard key={a.id} app={a} opp={o} lab={lab} />)}</ul>}
      <ConfirmDialog open={!!act} onClose={() => setAct(null)} title={act === 'open' ? t('m20.manage.openTitle') : t('m20.manage.closeTitle')} consequence={act === 'open' ? t('m20.manage.openBody') : t('m20.manage.closeBody')}
        actingAs={t('m20.common.poster')} danger={act === 'closed'} onConfirm={async () => { if (act) await run(() => repo.rpc.setOpportunityStatus(o.id, act)); }} />
    </Card>
  );
}
