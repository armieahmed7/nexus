/**
 * Global search (shell, "/" or Ctrl/Cmd+K): pages the viewer may open, help guides and glossary terms, skills, roles,
 * programmes, courses, FAQ entries, skills frameworks, partners, news and international benchmarks. Bilingual and
 * Arabic-aware (src/shell/search/engine.ts): English and Arabic text are both indexed whatever the page language, results
 * show in the page language, grouped by kind with a count. Only public tables are read (RLS) and every result's route
 * passes the viewer's guard, so results never lead to a page the viewer cannot open.
 *
 * Accessibility (WAI-ARIA combobox with a listbox popup): focus stays in the input; Up/Down/Home/End move the active
 * option (aria-activedescendant), Enter opens it, Escape closes; options are not interactive elements; a polite live
 * region announces the result count; focus returns to the header search button on close. The dialog closes on any
 * navigation, and Enter is never passed on to the element that receives focus when it closes (which reopened it).
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { useLocation } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Icon } from '../ui/Icon';
import { L, isLangLoaded, loadLang, translate, useFormat, useLang, useNav, useT } from '../i18n';
import { isArabic } from '../domain/text';
import { useRepo } from '../data';
import { useSession } from '../auth/session';
import { buildIndex, searchGrouped, type SearchItem, type SearchKind } from './search/engine';
import { canOpen, dataItems, loadSearchSources, pageItems, type SearchSources } from './search/sources';

const PER_GROUP = 5;
const SUGGESTED = 8;

interface ViewGroup {
  kind: SearchKind | 'suggested';
  total: number;
  hits: SearchItem[];
}

export function GlobalSearch({ open, onClose, triggerRef }: { open: boolean; onClose: () => void; triggerRef?: RefObject<HTMLElement | null> }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const nav = useNav();
  const repo = useRepo();
  const s = useSession();
  const loc = useLocation();
  const uid = useId();
  const listId = `${uid}-list`;
  const hintId = `${uid}-hint`;
  const [q, setQ] = useState('');
  const [armed, setArmed] = useState(false); // the index is built on first open, then kept
  const [src, setSrc] = useState<SearchSources | null>(null);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setActive(0);
    setArmed(true);
    let alive = true;
    void loadSearchSources(repo).then((x) => alive && setSrc(x));
    return () => {
      alive = false;
    };
  }, [open, repo]);

  // Close on any navigation (a result, a suggestion link, the browser's back button).
  const where = loc.pathname + loc.search + loc.hash;
  const seen = useRef(where);
  useEffect(() => {
    if (seen.current === where) return;
    seen.current = where;
    if (open) onClose();
  }, [where, open, onClose]);

  // Page titles come from the dictionaries. The other language's dictionary (about 0.4 MB) loads only when a query is written
  // in it (Latin letters on /ar, Arabic script on English pages); until then both sides use the page language. Catalogue and
  // help items are bilingual from the start. `t` changes when a dictionary lands, which rebuilds the page items.
  const other = lang === 'ar' ? 'en' : 'ar';
  const wantsOther = armed && (other === 'ar' ? isArabic(q) : /[a-z]/i.test(q));
  useEffect(() => {
    if (wantsOther && !isLangLoaded(other)) void loadLang(other).catch(() => undefined);
  }, [wantsOther, other]);
  const pages = useMemo(() => (armed ? pageItems(s, (l, k) => translate(isLangLoaded(l) ? l : lang, k)) : []), [armed, s, t, lang]);
  const index = useMemo(() => buildIndex([...pages, ...(src ? dataItems(src, s) : [])]), [pages, src, s]);
  const term = q.trim();
  const view = useMemo<{ groups: ViewGroup[]; total: number }>(() => {
    if (!term) return { groups: pages.length ? [{ kind: 'suggested', total: Math.min(SUGGESTED, pages.length), hits: pages.slice(0, SUGGESTED) }] : [], total: 0 };
    const r = searchGrouped(index, term, { lang, perGroup: PER_GROUP });
    return { groups: r.groups.map((g) => ({ kind: g.kind, total: g.total, hits: g.hits.map((h) => h.item) })), total: r.total };
  }, [term, index, pages, lang]);
  const flat = useMemo(() => view.groups.flatMap((g) => g.hits), [view]);
  const act = flat.length ? Math.min(active, flat.length - 1) : -1;
  const optId = (i: number) => `${uid}-opt-${i}`;
  useEffect(() => setActive(0), [term]);
  useEffect(() => {
    if (act >= 0) document.getElementById(`${uid}-opt-${act}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [act, uid]);

  // Live region: the count, announced once typing pauses.
  const statusNow = !term ? '' : !src && view.total === 0 ? t('shell.search.loading') : view.total === 0 ? t('shell.search.noneFor', { q: term }) : view.total === 1 ? t('shell.search.countOne') : t('shell.search.countMany', { n: f.num(view.total) });
  const [status, setStatus] = useState('');
  useEffect(() => {
    const h = setTimeout(() => setStatus(statusNow), 350);
    return () => clearTimeout(h);
  }, [statusNow]);

  const go = useCallback(
    (item: SearchItem) => {
      if (!canOpen(item.to, s)) return;
      onClose();
      nav(item.to);
    },
    [nav, onClose, s],
  );
  const move = (to: (i: number, n: number) => number) => setActive((a) => (flat.length ? to(Math.min(a, flat.length - 1), flat.length) : 0));
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      move((i, n) => (i + 1) % n);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      move((i, n) => (i - 1 + n) % n);
    } else if ((e.key === 'Home' || e.key === 'End') && flat.length) {
      e.preventDefault();
      setActive(e.key === 'Home' ? 0 : flat.length - 1);
    } else if (e.key === 'Enter') {
      // Never let Enter through: focus moves back to the header button as the dialog closes, and a default Enter there reopened it.
      e.preventDefault();
      if (act >= 0) go(flat[act]);
    }
  };

  const expanded = flat.length > 0;
  const enc = encodeURIComponent(term);
  let n = -1;
  return (
    <Modal open={open} onClose={onClose} title={t('shell.search.title')} size="md" initialFocus={inputRef} returnFocus={triggerRef}>
      <div className="relative">
        <Icon name="search" size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-3" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={expanded}
          aria-controls={expanded ? listId : undefined}
          aria-activedescendant={act >= 0 ? optId(act) : undefined}
          aria-autocomplete="list"
          aria-describedby={hintId}
          aria-label={t('shell.search.label')}
          autoComplete="off"
          spellCheck={false}
          className="input h-11 ps-9 text-[15px]"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t('shell.search.placeholder')}
          data-testid="search-input"
        />
      </div>
      <p id={hintId} className="mt-1.5 text-[12px] text-ink-3">
        {t('shell.search.hint')}
      </p>
      <div role="status" className="sr-only" data-testid="search-status">
        {status}
      </div>
      {expanded && (
        <div id={listId} role="listbox" aria-label={t('shell.search.results')} className="mt-2 max-h-[55vh] overflow-auto" data-testid="search-results">
          {view.groups.map((g) => {
            const headId = `${uid}-g-${g.kind}`;
            const label = g.kind === 'suggested' ? t('shell.search.suggested') : t(`shell.search.group.${g.kind}`);
            return (
              <div key={g.kind} role="group" aria-labelledby={headId} className="mb-2" data-testid={`search-group-${g.kind}`}>
                <div id={headId} className="caps px-2 pb-1 pt-2">
                  {g.kind === 'suggested' ? label : t('shell.search.groupHeading', { label, n: f.num(g.total) })}
                </div>
                {g.hits.map((h) => {
                  n += 1;
                  const i = n;
                  const sub = h.sub?.[lang] || h.sub?.en;
                  return (
                    <div
                      key={h.key}
                      id={optId(i)}
                      role="option"
                      aria-selected={i === act}
                      className={`cursor-pointer rounded-btn px-2 py-2 ${i === act ? 'bg-navactive' : 'hover:bg-sunken'}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseMove={() => i !== act && setActive(i)}
                      onClick={() => go(h)}
                      data-testid="search-option"
                    >
                      <span className="block font-semibold">{h.title[lang] || h.title.en}</span>
                      {sub && <span className="block truncate text-[12.5px] text-ink-2">{sub}</span>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
      {term && expanded && !src && <p className="mt-1 px-2 text-[12.5px] text-ink-3">{t('shell.search.loading')}</p>}
      {term && !expanded && (
        <div className="mt-3 rounded-btn border border-line p-4" data-testid="search-none">
          <p className="font-semibold">{src ? t('shell.search.noneFor', { q: term }) : t('shell.search.loading')}</p>
          {src && (
            <>
              <p className="mt-1 text-[13px] text-ink-2">{t('shell.search.noneHint')}</p>
              <ul className="mt-2 space-y-1.5 text-[13.5px]">
                {canOpen('/help', s) && (
                  <li>
                    <L to={`/help?q=${enc}`} onClick={onClose} data-testid="search-try-help">
                      {t('shell.search.tryHelp', { q: term })}
                    </L>
                  </li>
                )}
                <li>
                  <L to={`/faq?q=${enc}`} onClick={onClose} data-testid="search-try-faq">
                    {t('shell.search.tryFaq', { q: term })}
                  </L>
                </li>
                <li>
                  <L to={`/ask?q=${enc}`} onClick={onClose} data-testid="search-try-ask">
                    {t('shell.search.askDalil', { q: term })}
                  </L>
                </li>
              </ul>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
