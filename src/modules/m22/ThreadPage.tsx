// /communities/thread/:threadId (M22 · F17): one Q&A thread. Published posts for everyone in the community area, my own held
// posts flagged "waiting for a steward", reply box for members, and the steward's hide action (with a reason; never their own post).
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Page, Async, EmptyState, Callout, ConfirmDialog, Icon } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { useCommunities, isMember, isStewardOf, M22Pill } from './ui';

export default function ThreadPage() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const me = s.identity.personId;
  const { threadId = '' } = useParams();
  const cop = useCommunities();
  const q = useQuery(['threads', 'posts'], async () => {
    const [thread, posts] = await Promise.all([repo.get('threads', threadId).catch(() => null), repo.list('posts', { filter: { thread_id: threadId }, order: [['created_at', 'asc']] })]);
    return { thread, posts };
  }, [threadId, me]);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [hide, setHide] = useState<string | null>(null);
  const th = q.data?.thread;
  const c = cop.q.data?.communities.find((x) => x.id === th?.community_id);
  const member = !!(cop.q.data && th && isMember(cop.q.data, th.community_id, me));
  const moderator = !!(cop.q.data && th && (isStewardOf(cop.q.data, th.community_id, me) || s.can('knowledge', ['A'])));
  return (
    <Page title={th?.title ?? t('m22.routes.community-thread.title')} eyebrow={c ? <L to={`/communities/${c.id}`}>{pick(c, 'name')}</L> : <L to="/communities">{t('m22.cop.back')}</L>}>
      <Async state={q} isEmpty={(d) => !d.thread} empty={<EmptyState icon="chat" title={t('m22.cop.threadNotFound')} action={<L to="/communities" className="btn-outline btn-sm">{t('m22.cop.back')}</L>} />}>
        {(d) => (
          <div className="space-y-4">
            <ol className="space-y-3" data-testid="m22-posts">
              {d.posts.map((p, i) => (
                <li key={p.id} className={`card p-4 ${p.status !== 'published' ? 'border-sim-line' : ''}`} lang={p.lang} dir={p.lang === 'ar' ? 'rtl' : undefined}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{pick({ name_en: p.author_name, name_ar: p.author_name_ar }, 'name')}{i === 0 && <span className="ms-2 text-[11.5px] font-normal text-ink-3">{t('m22.cop.asked')}</span>}</span>
                    <span className="flex items-center gap-2 text-[12px] text-ink-3">{f.dateTime(p.created_at)}{p.status !== 'published' && <M22Pill status={p.status} />}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed">{p.body}</p>
                  {p.status === 'held' && <p className="mt-2 text-[12.5px] text-sim">{t('m22.cop.heldNote')}</p>}
                  {p.status === 'hidden' && p.moderation_note && <p className="mt-2 text-[12.5px] text-bad">{t('m22.cop.hiddenNote', { note: p.moderation_note })}</p>}
                  {moderator && p.status === 'published' && p.author_id !== me && <button className="btn-ghost btn-sm mt-2" onClick={() => setHide(p.id)} data-testid="m22-hide">{t('m22.cop.hide')}</button>}
                </li>
              ))}
            </ol>
            {member && d.thread!.status === 'open' ? (
              <div className="card space-y-2 p-4">
                <label className="block"><span className="caps">{t('m22.cop.reply')}</span><textarea className="input mt-1" rows={3} maxLength={2000} value={reply} onChange={(e) => setReply(e.target.value)} data-testid="m22-reply" /></label>
                <p className="text-[12px] text-ink-3">{t('m22.cop.postHint')}</p>
                <button className="btn-primary btn-sm" disabled={busy || reply.trim().length < 10} data-testid="m22-reply-post" onClick={async () => {
                  setBusy(true);
                  try { const r = await run(() => repo.rpc.postThread({ community_id: d.thread!.community_id, thread_id: d.thread!.id, body: reply.trim() })); if (r.ok) setReply(''); } finally { setBusy(false); }
                }}><Icon name="chat" size={14} />{busy ? t('common.working') : t('m22.cop.post')}</button>
              </div>
            ) : <Callout>{t('m22.cop.joinToPost')}</Callout>}
            <Callout tone="bad" title={t('m22.cop.rulesTitle')}>{t('m22.cop.rulesBody')}</Callout>
            <ConfirmDialog open={!!hide} onClose={() => setHide(null)} requireReason reasonLabel={t('m22.cop.hideReason')} danger title={t('m22.cop.hideTitle')} consequence={t('m22.cop.hideBody')} confirmLabel={t('m22.cop.hide')}
              onConfirm={async (reason) => { if (hide) await run(() => repo.rpc.moderatePost(hide, 'hide', reason)); }} />
          </div>
        )}
      </Async>
    </Page>
  );
}
