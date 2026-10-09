// /communities (M22 · F17): communities of practice by discipline (charter, steward role card, members, latest questions),
// join or leave, upcoming knowledge-sharing events, and the ways in to the expert finder and the session catalogue.
import { useState } from 'react';
import { Page, Section, Async, EmptyState, Callout, ConfirmDialog, Icon, StatTile, Grid } from '../../ui';
import { useAction, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { useCommunities, isMember, isStewardOf, M22Pill, type CopData } from './ui';

export default function CommunitiesPage() {
  const t = useT();
  const { q, me } = useCommunities();
  return (
    <Page title={t('m22.routes.communities.title')} intro={t('m22.cop.intro')} wide
      actions={<div className="flex flex-wrap gap-2">
        <L to="/communities/experts" className="btn-outline btn-sm"><Icon name="search" size={14} />{t('m22.cop.findExpert')}</L>
        <L to="/communities/sessions" className="btn-outline btn-sm"><Icon name="book" size={14} />{t('m22.cop.sessions')}</L>
      </div>}>
      <Async state={q} isEmpty={(d) => d.communities.length === 0} empty={<EmptyState icon="users" title={t('m22.cop.empty')} />}>
        {(d) => <Body d={d} me={me} />}
      </Async>
    </Page>
  );
}

function Body({ d, me }: { d: CopData; me: string | null }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const [leave, setLeave] = useState<string | null>(null);
  const mine = d.communities.filter((c) => isMember(d, c.id, me));
  const upcoming = d.sessions.filter((s) => s.status === 'upcoming').sort((a, b) => (a.held_on < b.held_on ? -1 : 1));
  const threads = d.threads.filter((x) => x.visible);
  return (
    <div className="space-y-8">
      <Grid cols={4}>
        <StatTile label={t('m22.cop.statCommunities')} value={f.num(d.communities.length)} />
        <StatTile label={t('m22.cop.statMine')} value={f.num(mine.length)} />
        <StatTile label={t('m22.cop.statThreads')} value={f.num(threads.length)} />
        <StatTile label={t('m22.cop.statEvents')} value={f.num(upcoming.length)} />
      </Grid>
      <Section title={t('m22.cop.allTitle')} description={t('m22.cop.allSub')}>
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="m22-communities">
          {d.communities.map((c) => {
            const members = d.members.filter((m) => m.community_id === c.id && m.active);
            const member = isMember(d, c.id, me);
            const steward = isStewardOf(d, c.id, me);
            const latest = threads.filter((x) => x.community_id === c.id)[0];
            return (
              <li key={c.id} className="card flex flex-col p-4" data-testid="m22-community-card">
                <div className="flex items-start justify-between gap-2">
                  <L to={`/communities/${c.id}`} className="text-[16px] font-semibold">{pick(c, 'name')}</L>
                  {steward ? <span className="chip border-accent/30 bg-accent-soft text-eyebrow">{t('m22.cop.steward')}</span> : member ? <span className="chip border-ok-line bg-ok-bg text-ok">{t('m22.cop.member')}</span> : null}
                </div>
                <p className="mt-1 line-clamp-3 text-[13px] text-ink-2">{pick(c, 'charter')}</p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-ink-2">
                  <span className="inline-flex items-center gap-1"><Icon name="users" size={13} />{t('m22.cop.members', { n: f.num(members.length) })}</span>
                  <span className="inline-flex items-center gap-1"><Icon name="user" size={13} />{pick(c, 'steward_role')}</span>
                </div>
                {latest && <L to={`/communities/thread/${latest.id}`} className="mt-3 block rounded border border-line bg-sunken/50 p-2 text-[12.5px]"><span className="caps block">{t('m22.cop.latest')}</span>{latest.title}</L>}
                <div className="mt-auto flex flex-wrap gap-2 pt-3">
                  <L to={`/communities/${c.id}`} className="btn-outline btn-sm">{t('m22.cop.open')}</L>
                  {!member && <button className="btn-primary btn-sm" data-testid="m22-join" onClick={() => run(() => repo.rpc.joinCommunity(c.id, true))}><Icon name="plus" size={14} />{t('m22.cop.join')}</button>}
                  {member && !steward && <button className="btn-ghost btn-sm" onClick={() => setLeave(c.id)}>{t('m22.cop.leave')}</button>}
                </div>
              </li>
            );
          })}
        </ul>
      </Section>
      <Section title={t('m22.cop.eventsTitle')} description={t('m22.cop.eventsSub')} actions={<L to="/communities/sessions" className="btn-ghost btn-sm">{t('m22.cop.sessions')}</L>}>
        {upcoming.length === 0 ? <EmptyState icon="calendar" title={t('m22.cop.noEvents')} /> : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="m22-events">
            {upcoming.map((s) => (
              <li key={s.id} className="card flex gap-3 p-3">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-card bg-accent-soft text-center text-eyebrow"><span className="num text-[12px] font-semibold leading-tight">{f.date(s.held_on, 'short')}</span></div>
                <div className="min-w-0">
                  <div className="font-semibold">{pick(s, 'title')}</div>
                  <div className="text-[12.5px] text-ink-2">{pick(s, 'presenter_role')} · {t('m22.sessions.minutes', { n: f.num(s.duration_min) })}</div>
                  <div className="mt-1"><M22Pill kind="session" status={s.status} /></div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Callout title={t('m22.cop.rulesTitle')}>{t('m22.cop.rulesBody')}</Callout>
      <ConfirmDialog open={!!leave} onClose={() => setLeave(null)} title={t('m22.cop.leaveTitle')} consequence={t('m22.cop.leaveBody')} confirmLabel={t('m22.cop.leave')}
        onConfirm={async () => { if (leave) await run(() => repo.rpc.joinCommunity(leave, false)); }} />
    </div>
  );
}
