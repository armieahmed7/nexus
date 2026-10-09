/** Notifications bell: the signed-in person's notices (RLS: own rows only). Marking read is a direct own-row update. */
import { useState } from 'react';
import { useQuery, useRepo } from '../data';
import { useSession } from '../auth/session';
import { L, useFormat, usePick, useT } from '../i18n';
import { Icon } from '../ui/Icon';
import { DigestBellCard } from './digest/DigestBellCard'; // W5E5 (F36)
import { useNoNudges } from './digest/useDigest';

export function Notifications() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const s = useSession();
  const pid = s.identity.personId;
  const [open, setOpen] = useState(false);
  const q = useQuery('notifications', () => (pid ? repo.list('notifications', { filter: { person_id: pid }, order: [['created_at', 'desc']], limit: 30 }) : Promise.resolve([])), [pid]);
  const noNudges = useNoNudges(); // W5E5 (F36): speak-up never shows a nudge
  const items = (q.data ?? []).filter((n) => !(noNudges && n.kind === 'digest'));
  const unread = items.filter((n) => !n.read_at).length;
  const markAll = async () => {
    const now = new Date().toISOString();
    for (const n of items.filter((x) => !x.read_at)) await repo.update('notifications', n.id, { read_at: now });
  };
  const sev: Record<string, string> = { bad: 'bg-bad', warn: 'bg-sim', ok: 'bg-ok', info: 'bg-info' };
  return (
    <div className="relative">
      <button className="btn-ghost btn-sm relative" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={t('shell.notifications.label', { n: unread })} data-testid="notifications">
        <Icon name="bell" />
        {unread > 0 && <span className="num absolute -top-0.5 end-0 grid h-4 min-w-[16px] place-items-center rounded-full bg-bad px-1 text-[10px] font-bold text-white">{unread}</span>}
      </button>
      {open && (
        <div className="card absolute end-0 top-full z-50 mt-1 w-[min(360px,90vw)] p-2" onMouseLeave={() => setOpen(false)}>
          <div className="flex items-center justify-between px-2 py-1">
            <span className="font-semibold">{t('shell.notifications.title')}</span>
            {unread > 0 && (
              <button className="text-[12px] text-accent" onClick={markAll}>
                {t('shell.notifications.markAll')}
              </button>
            )}
          </div>
          <DigestBellCard onNavigate={() => setOpen(false)} />
          <ul className="max-h-[60vh] overflow-auto">
            {items.length === 0 && <li className="p-4 text-center text-ink-3">{t('shell.notifications.empty')}</li>}
            {items.map((n) => (
              <li key={n.id} className={`rounded-btn p-2 ${n.read_at ? '' : 'bg-accent-soft/50'}`}>
                <div className="flex gap-2">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${sev[n.severity] ?? 'bg-info'}`} />
                  <div className="min-w-0">
                    {n.link ? (
                      <L to={n.link} className="font-semibold" onClick={() => setOpen(false)}>
                        {pick(n, 'title')}
                      </L>
                    ) : (
                      <div className="font-semibold">{pick(n, 'title')}</div>
                    )}
                    {pick(n, 'body') && <div className="text-[12.5px] text-ink-2">{pick(n, 'body')}</div>}
                    <div className="caps mt-0.5">{f.date(n.created_at)}</div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
