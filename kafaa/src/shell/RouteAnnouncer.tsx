/**
 * A11Y-01: tells screen-reader and keyboard users that an in-app navigation landed on a new page.
 * On a pathname change (not a query- or hash-only change) it waits for the new page's h1, moves focus to it (tabIndex -1,
 * shown with the site's normal :focus-visible style) and writes "<title>, page loaded" to a polite live region.
 * It never moves focus on the first load, when the URL has a #target (the page scrolls or focuses that target itself,
 * e.g. /help/glossary#term-x), when only the language changed (the language button keeps focus), when a modal dialog is
 * open (it manages focus), or when the user is typing in a field. The announcement is still made in those cases, except the first load.
 * Pages without <Page> (sign-in gate, not found) get a document title from their h1 here.
 */
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useI18n } from '../i18n';

/** How long to wait for a lazy page to render its heading before falling back to <main>. */
export const HEADING_WAIT_MS = 5000;

export type FocusSkip = 'first-load' | 'hash' | 'language' | 'dialog' | 'typing' | null;

/** Why focus should stay where it is after this navigation, or null to move it to the page heading. */
export function focusSkipReason(opts: { first: boolean; hash: string; langOnly: boolean; doc?: Document }): FocusSkip {
  const doc = opts.doc ?? document;
  if (opts.first) return 'first-load';
  if (opts.hash && opts.hash !== '#') return 'hash';
  if (opts.langOnly) return 'language';
  if (doc.querySelector('[role="dialog"][aria-modal="true"], dialog[open]')) return 'dialog';
  const a = doc.activeElement as HTMLElement | null;
  if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable)) return 'typing';
  return null;
}

/** Calls back with the first h1 in root that has text, or null after `ms`. The effect runs after the new route committed,
 *  so the previous page's heading is gone (a lazy page shows its skeleton until the chunk lands). */
function whenHeading(root: HTMLElement, cb: (h: HTMLElement | null) => void, ms: number): () => void {
  const find = () => {
    const h = root.querySelector<HTMLElement>('h1');
    return h && h.textContent?.trim() ? h : null;
  };
  let done = false;
  const finish = (h: HTMLElement | null) => {
    if (done) return;
    done = true;
    obs.disconnect();
    clearTimeout(timer);
    cb(h);
  };
  const obs = new MutationObserver(() => {
    const h = find();
    if (h) finish(h);
  });
  const timer = setTimeout(() => finish(null), ms);
  obs.observe(root, { childList: true, subtree: true, characterData: true });
  const now = find();
  if (now) queueMicrotask(() => finish(now));
  return () => {
    done = true;
    obs.disconnect();
    clearTimeout(timer);
  };
}

export function RouteAnnouncer() {
  const { t, path } = useI18n();
  const location = useLocation();
  const [message, setMessage] = useState('');
  const prev = useRef<{ pathname: string; path: string } | null>(null);
  const latest = useRef({ hash: location.hash, t, path });
  latest.current = { hash: location.hash, t, path };

  useEffect(() => {
    const before = prev.current;
    const main = document.getElementById('main');
    prev.current = { pathname: location.pathname, path: latest.current.path };
    if (!before || before.pathname === location.pathname || !main) return;
    const langOnly = before.path === latest.current.path;
    // Rendered ahead of <main>, so this effect runs before the new page's own effects: this is still the previous page's title.
    const titleBefore = document.title;
    let clear: ReturnType<typeof setTimeout> | undefined;
    const stop = whenHeading(
      main,
      (h) => {
        const { t: tr, hash } = latest.current;
        const title = h?.textContent?.replace(/\s+/g, ' ').trim() || document.title;
        if (!focusSkipReason({ first: false, hash, langOnly })) {
          const target = h ?? main;
          if (target !== main && !target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
          target.focus({ preventScroll: true });
        }
        // clear first so the same title read twice in a row is still announced
        setMessage('');
        clear = setTimeout(() => {
          // by now the page's own effects have run; <Page> and the home page set the title, the sign-in gate and 404 do not
          if (h && document.title === titleBefore) document.title = `${title} · ${tr('shell.brand')}`;
          setMessage(tr('shell.routeLoaded', { title }));
        }, 60);
      },
      HEADING_WAIT_MS,
    );
    return () => {
      stop();
      clearTimeout(clear);
    };
  }, [location.pathname]);

  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="route-announcer">
      {message}
    </div>
  );
}
