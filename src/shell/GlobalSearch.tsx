/**
 * Global search (shell): pages the viewer can open, plus public catalogue data (roles, programmes, courses,
 * partners, glossary). Only public tables are searched so results never leak restricted rows.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Icon } from '../ui/Icon';
import { useNav, usePick, useT } from '../i18n';
import { useRepo } from '../data';
import { ROUTES, href } from '../routes/registry';
import { checkGuard } from '../auth/guards';
import { useSession } from '../auth/session';
import { routePurpose, routeTitle } from './util';

interface Hit {
  key: string;
  kind: string;
  title: string;
  sub?: string;
  to: string;
}

export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const pick = usePick();
  const nav = useNav();
  const repo = useRepo();
  const s = useSession();
  const [q, setQ] = useState('');
  const [data, setData] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQ('');
    let alive = true;
    (async () => {
      const [roles, progs, courses, orgs, gloss] = await Promise.all([
        repo.list('job_roles').catch(() => []),
        repo.list('talent_programmes').catch(() => []),
        repo.list('courses', { filter: { audience: ['public', 'staff'] } }).catch(() => []),
        repo.list('organisations', { filter: { public_listed: true } }).catch(() => []),
        repo.list('glossary').catch(() => []),
      ]);
      if (!alive) return;
      setData([
        ...roles.map((r) => ({ key: `r-${r.id}`, kind: t('shell.search.kind.role'), title: pick(r, 'title'), sub: pick(r, 'function'), to: href('careers-role', { slug: r.id }) })),
        ...progs.map((r) => ({ key: `p-${r.id}`, kind: t('shell.search.kind.programme'), title: pick(r, 'name'), sub: pick(r, 'duration'), to: href('pathways-programme', { programme: r.id }) })),
        ...courses.map((r) => ({ key: `c-${r.id}`, kind: t('shell.search.kind.course'), title: pick(r, 'title'), sub: r.code, to: href('learn-course', { id: r.id }) })),
        ...orgs.map((r) => ({ key: `o-${r.id}`, kind: t('shell.search.kind.partner'), title: pick(r, 'name'), sub: pick(r, 'relationship'), to: href('partners-detail', { slug: r.id }) })),
        ...gloss.map((r) => ({ key: `g-${r.id}`, kind: t('shell.search.kind.term'), title: pick(r, 'term'), sub: pick(r, 'definition'), to: '/faq' })),
      ]);
    })();
    return () => {
      alive = false;
    };
  }, [open, repo, pick, t]);

  const pages = useMemo<Hit[]>(
    () => ROUTES.filter((r) => !r.path.includes(':') && checkGuard(r.guard, s) === 'ok').map((r) => ({ key: `route-${r.id}`, kind: t('shell.search.kind.page'), title: routeTitle(t, r), sub: routePurpose(t, r), to: r.path })),
    [s, t],
  );
  const hits = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return pages.slice(0, 8);
    const score = (h: Hit) => (h.title.toLowerCase().startsWith(term) ? 0 : h.title.toLowerCase().includes(term) ? 1 : (h.sub ?? '').toLowerCase().includes(term) ? 2 : 9);
    return [...pages, ...data]
      .map((h) => [score(h), h] as const)
      .filter(([sc]) => sc < 9)
      .sort((a, b) => a[0] - b[0])
      .slice(0, 30)
      .map(([, h]) => h);
  }, [q, pages, data]);
  useEffect(() => setActive(0), [q]);

  const go = (h: Hit) => {
    onClose();
    nav(h.to);
  };
  return (
    <Modal open={open} onClose={onClose} title={t('shell.search.title')} size="md">
      <div className="relative">
        <Icon name="search" size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-3" />
        <input
          ref={inputRef}
          className="input h-11 ps-9 text-[15px]"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('shell.search.placeholder')}
          aria-label={t('shell.search.placeholder')}
          data-testid="search-input"
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setActive((a) => Math.min(hits.length - 1, a + 1));
            if (e.key === 'ArrowUp') setActive((a) => Math.max(0, a - 1));
            if (e.key === 'Enter' && hits[active]) go(hits[active]);
          }}
        />
      </div>
      <ul className="mt-3 max-h-[50vh] overflow-auto" role="listbox" data-testid="search-results">
        {hits.length === 0 && <li className="p-4 text-center text-ink-3">{t('shell.search.none')}</li>}
        {hits.map((h, i) => (
          <li key={h.key} role="option" aria-selected={i === active}>
            <button className={`flex w-full items-start gap-3 rounded-btn px-2 py-2 text-start ${i === active ? 'bg-navactive' : 'hover:bg-sunken'}`} onMouseEnter={() => setActive(i)} onClick={() => go(h)}>
              <span className="caps mt-0.5 w-20 shrink-0">{h.kind}</span>
              <span className="min-w-0">
                <span className="block font-semibold">{h.title}</span>
                {h.sub && <span className="block truncate text-[12.5px] text-ink-2">{h.sub}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
