// /communities/:id (M22 · F17): one community of practice. Charter and steward role card, the posting rules (no security,
// safeguards or cyber content; no contact details), moderated Q&A threads, "start a thread", the stewards' moderation queue,
// and this community's knowledge-sharing sessions.
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Page, Section, Card, Async, EmptyState, Callout, ConfirmDialog, Icon, Tabs } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { useCommunities, isMember, isStewardOf, M22Pill, type CopData } from './ui';

export default function CommunityPage() {
  const t = useT();
  const pick = usePick();
  const { id = '' } = useParams();
  const { q, me } = useCommunities();
  const c = q.data?.communities.find((x) => x.id === id);
  return (
    <Page title={c ? pick(c, 'name') : t('m22.routes.communities-detail.title')} eyebrow={<L to="/communities">{t('m22.cop.back')}</L>} wide>
      <Async state={q} isEmpty={(d) => !d.communities.some((x) => x.id === id)} empty={<EmptyState icon="users" title={t('m22.cop.notFound')} action={<L to="/communities" className="btn-outline btn-sm">{t('m22.cop.back')}</L>} />}>
        {(d) => <Body d={d} id={id} me={me} />}
      </Async>
    </Page>
  );
}

function Body({ d, id, me }: { d: CopData; id: string; me: string | null }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const c = d.communities.find((x) => x.id === id)!;
  const member = isMember(d, id, me);
  const steward = isStewardOf(d, id, me);
  const moderator = steward || s.can('knowledge', ['A']);
  const members = d.members.filter((m) => m.community_id === id && m.active);
  const stewards = members.filter((m) => m.role === 'steward');
  const threads = d.threads.filter((x) => x.community_id === id && (x.visible || x.author_id === me));
  const sessions = d.sessions.filter((x) => x.community_id === id);
  const [leave, setLeave] = useState(false);
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <Card>
          <p className="text-[14.5px] leading-relaxed">{pick(c, 'charter')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {!member && <button className="btn-primary btn-sm" onClick={() => run(() => repo.rpc.joinCommunity(id, true))} data-testid="m22-join"><Icon name="plus" size={14} />{t('m22.cop.join')}</button>}
            {member && !steward && <button className="btn-ghost btn-sm" onClick={() => setLeave(true)}>{t('m22.cop.leave')}</button>}
            {steward && <span className="chip border-accent/30 bg-accent-soft text-eyebrow">{t('m22.cop.youSteward')}</span>}
          </div>
        </Card>
        <Tabs tabs={[
          { id: 'threads', label: t('m22.cop.threads'), content: (
            <div className="space-y-4 pt-4">
              {member ? <NewThread cid={id} /> : <Callout>{t('m22.cop.joinToPost')}</Callout>}
              {threads.length === 0 ? <EmptyState icon="chat" title={t('m22.cop.noThreads')} /> : (
                <ul className="space-y-2" data-testid="m22-threads">
                  {threads.map((x) => (
                    <li key={x.id} className="card p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <L to={`/communities/thread/${x.id}`} className="font-semibold">{x.title}</L>
                        {!x.visible && <M22Pill status="held" />}
                      </div>
                      <div className="mt-1 text-[12.5px] text-ink-2">{t('m22.cop.threadMeta', { name: pick({ name_en: x.author_name, name_ar: x.author_name_ar }, 'name'), n: f.num(x.reply_count), date: f.date(x.last_post_at) })}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) },
          ...(moderator ? [{ id: 'moderate', label: t('m22.cop.moderation'), content: <Moderation cid={id} /> }] : []),
          { id: 'sessions', label: t('m22.cop.sessionsTab'), content: (
            <ul className="space-y-2 pt-4">
              {sessions.length === 0 ? <EmptyState icon="book" title={t('m22.sessions.none')} /> : sessions.map((x) => (
                <li key={x.id} className="card flex flex-wrap items-center justify-between gap-2 p-3">
                  <div><div className="font-semibold">{pick(x, 'title')}</div><div className="text-[12.5px] text-ink-2">{f.date(x.held_on)} · {pick(x, 'presenter_role')}</div></div>
                  <M22Pill kind="session" status={x.status} />
                </li>
              ))}
            </ul>
          ) },
        ]} />
      </div>
      <aside className="space-y-4">
        <Card title={t('m22.cop.about')}>
          <dl className="space-y-2 text-[13px]">
            <div><dt className="caps">{t('m22.cop.stewardRole')}</dt><dd>{pick(c, 'steward_role')}</dd></div>
            <div><dt className="caps">{t('m22.cop.stewards')}</dt><dd>{stewards.map((m) => pick({ name_en: m.person_name, name_ar: m.person_name_ar }, 'name')).join(' · ') || '—'}</dd></div>
            <div><dt className="caps">{t('m22.cop.membersLabel')}</dt><dd className="num">{f.num(members.length)}</dd></div>
          </dl>
        </Card>
        <Callout tone="bad" title={t('m22.cop.rulesTitle')}>{t('m22.cop.rulesBody')}</Callout>
        <L to="/communities/experts" className="btn-outline btn-sm w-full"><Icon name="search" size={14} />{t('m22.cop.findExpert')}</L>
      </aside>
      <ConfirmDialog open={leave} onClose={() => setLeave(false)} title={t('m22.cop.leaveTitle')} consequence={t('m22.cop.leaveBody')} confirmLabel={t('m22.cop.leave')} onConfirm={async () => { await run(() => repo.rpc.joinCommunity(id, false)); }} />
    </div>
  );
}

function NewThread({ cid }: { cid: string }) {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  if (!open) return <button className="btn-primary btn-sm" onClick={() => setOpen(true)} data-testid="m22-new-thread"><Icon name="plus" size={14} />{t('m22.cop.newThread')}</button>;
  const valid = title.trim().length >= 5 && title.trim().length <= 140 && body.trim().length >= 10 && body.trim().length <= 2000;
  return (
    <div className="card space-y-3 p-4" data-testid="m22-thread-form">
      <label className="block"><span className="caps">{t('m22.cop.titleLabel')}</span><input className="input mt-1" value={title} maxLength={140} onChange={(e) => setTitle(e.target.value)} data-testid="m22-thread-title" /></label>
      <label className="block"><span className="caps">{t('m22.cop.bodyLabel')}</span><textarea className="input mt-1" rows={4} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} data-testid="m22-thread-body" /></label>
      <p className="text-[12px] text-ink-3">{t('m22.cop.postHint')}</p>
      <div className="flex gap-2">
        <button className="btn-primary btn-sm" disabled={!valid || busy} data-testid="m22-thread-post" onClick={async () => {
          setBusy(true);
          try { const r = await run(() => repo.rpc.postThread({ community_id: cid, title: title.trim(), body: body.trim() })); if (r.ok) { setTitle(''); setBody(''); setOpen(false); } } finally { setBusy(false); }
        }}>{busy ? t('common.working') : t('m22.cop.post')}</button>
        <button className="btn-ghost btn-sm" onClick={() => setOpen(false)}>{t('common.cancel')}</button>
      </div>
    </div>
  );
}

function Moderation({ cid }: { cid: string }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const me = useSession().identity.personId;
  const q = useQuery(['posts', 'threads'], () => repo.rpc.moderationQueue(), [me]);
  const [act, setAct] = useState<{ id: string; decision: 'publish' | 'hide' } | null>(null);
  return (
    <div className="pt-4">
      <Async state={q} isEmpty={(rows) => rows.filter((x) => x.community_id === cid).length === 0} empty={<EmptyState icon="check" title={t('m22.cop.queueEmpty')} />}>
        {(rows) => (
          <ul className="space-y-3" data-testid="m22-queue">
            {rows.filter((x) => x.community_id === cid).map((x) => (
              <li key={x.post_id} className="card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{x.thread_title}</span>
                  <span className="text-[12px] text-ink-3">{pick({ name_en: x.author_name, name_ar: x.author_name_ar }, 'name')} · {f.dateTime(x.created_at)}{x.first_post ? ` · ${t('m22.cop.firstPost')}` : ''}</span>
                </div>
                <p className="mt-2 whitespace-pre-line text-[13.5px]">{x.body}</p>
                <div className="mt-3 flex gap-2">
                  <button className="btn-primary btn-sm" onClick={() => setAct({ id: x.post_id, decision: 'publish' })} data-testid="m22-publish">{t('m22.cop.publish')}</button>
                  <button className="btn-outline btn-sm" onClick={() => setAct({ id: x.post_id, decision: 'hide' })}>{t('m22.cop.hide')}</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Async>
      <ConfirmDialog open={!!act} onClose={() => setAct(null)} requireReason={act?.decision === 'hide'} reasonLabel={t('m22.cop.hideReason')} danger={act?.decision === 'hide'}
        title={act?.decision === 'hide' ? t('m22.cop.hideTitle') : t('m22.cop.publishTitle')} consequence={t(act?.decision === 'hide' ? 'm22.cop.hideBody' : 'm22.cop.publishBody')}
        confirmLabel={act?.decision === 'hide' ? t('m22.cop.hide') : t('m22.cop.publish')}
        onConfirm={async (reason) => { if (act) await run(() => repo.rpc.moderatePost(act.id, act.decision, reason)); }} />
    </div>
  );
}
