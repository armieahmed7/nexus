// F26 hand-off to M04 /training/schedule: draft sessions proposed from the training needs forecast. Drafts are never published and
// never create a session; the scheduler creates the session with "New session" (the M04 path) and then links the draft to it
// (rpc.linkProposal), or withdraws it. Read rule: training R/W/A (instructors, training manager, auditors), like the schedule.
import { useState } from 'react';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { Card, StatusPill } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';
import { quarterBounds } from './needs';

export function ProposedSessionsCard() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const canAct = s.can('learning_analytics', ['A']);
  const [pickFor, setPickFor] = useState<Record<string, string>>({});
  const q = useQuery(['session_proposals', 'sessions', 'courses'], async () => {
    const [drafts, sessions, courses] = await Promise.all([
      repo.list('session_proposals', { filter: { status: 'draft' }, order: [['period', 'asc']] }).catch(() => []),
      repo.list('sessions').catch(() => []),
      repo.list('courses').catch(() => []),
    ]);
    return { drafts, sessions, courses };
  });
  const d = q.data;
  if (!d || d.drafts.length === 0) return null;
  return (
    <Card title={t('m25.schedule.title')} eyebrow={<StatusPill tone="neutral">{t('m25.schedule.notPublished')}</StatusPill>} actions={<L to="/training/needs" className="link text-[13px]">{t('m25.schedule.toNeeds')}</L>}>
      <p className="mb-2 text-[12.5px] text-ink-2">{t('m25.schedule.intro')}</p>
      <ul className="divide-y divide-line" data-testid="m25-schedule-drafts">
        {d.drafts.map((p) => {
          const c = d.courses.find((x) => x.id === p.course_id);
          const b = quarterBounds(p.period);
          const options = d.sessions.filter((x) => x.course_id === p.course_id && x.status === 'scheduled' && x.starts_at.slice(0, 10) >= b.start && x.starts_at.slice(0, 10) <= b.end);
          return (
            <li key={p.id} className="flex flex-wrap items-center gap-3 py-2">
              <StatusPill tone="neutral">{t('m25.proposal.draft')}</StatusPill>
              <span className="font-semibold">{c ? pick(c, 'title') : p.course_id}</span>
              <span className="text-[12.5px] text-ink-2">{t('m25.proposal.size', { n: p.sessions, seats: p.seats_each, q: p.period })}</span>
              <span className="text-[12px] text-ink-3">{(p.dates ?? []).map((x) => f.date(x)).join(' · ')}</span>
              {canAct && (
                <span className="ms-auto flex flex-wrap items-center gap-2">
                  <select className="input h-8 text-[12.5px]" value={pickFor[p.id] ?? ''} onChange={(e) => setPickFor((x) => ({ ...x, [p.id]: e.target.value }))} aria-label={t('m25.schedule.pickSession')} data-testid={`m25-link-pick-${p.id}`}>
                    <option value="">{options.length ? t('m25.schedule.pickSession') : t('m25.schedule.noSession')}</option>
                    {options.map((x) => <option key={x.id} value={x.id}>{f.dateTime(x.starts_at)} · {pick(x, 'location')}</option>)}
                  </select>
                  <button type="button" className="btn-outline btn-sm" disabled={!pickFor[p.id]} onClick={() => run(() => repo.rpc.linkProposal(p.id, pickFor[p.id]))} data-testid={`m25-link-${p.id}`}>{t('m25.schedule.link')}</button>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => run(() => repo.rpc.withdrawProposal(p.id))}>{t('m25.proposal.withdraw')}</button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
