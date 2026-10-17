/**
 * Floating "Ask Dalil" launcher. Hidden when the kill switch is off (dalil_settings.enabled = false), on /ask itself,
 * and on /speak-up (M08: no assistant, no telemetry on that route).
 * On phones (under 640 px) it must not cover content (WCAG 2.4.11): it is a 44 px icon button with its name kept for screen
 * readers, it tucks away while the page scrolls down or a text field has focus (the on-screen keyboard is up), comes back on
 * scroll up or when it takes keyboard focus, and a spacer under the footer lets the last links scroll clear of it.
 */
import { useEffect, useRef, useState } from 'react';
import { useQuery, useRepo } from '../data';
import { L, useI18n, useT } from '../i18n';
import { Icon } from '../ui/Icon';
import type { RouteDef } from '../routes/types';

export function DalilLauncher({ route }: { route: RouteDef | null }) {
  const t = useT();
  const repo = useRepo();
  const { path } = useI18n(); // G5: pass the current page so Dalil can boost nearby content
  const q = useQuery('dalil_settings', () => repo.list('dalil_settings'));
  // G5 (M13): re-read the kill switch every 30 s so a change made by the AI owner in another browser removes the
  // launcher from every page within one minute (same-tab changes already refetch through repo.subscribe).
  const { reload } = q;
  useEffect(() => {
    const t = setInterval(reload, 30_000);
    return () => clearInterval(t);
  }, [reload]);
  const [tucked, show] = useTuckOnPhones();
  const enabled = q.data ? q.data.every((s) => s.enabled) : false;
  if (!enabled || route?.id === 'ask' || route?.id === 'speak-up' || route?.guard.noTelemetry) return null;
  return (
    <>
      <div aria-hidden="true" className="no-print h-20 bg-panel sm:hidden" data-testid="dalil-launcher-spacer" />
      <L
        to={`/ask?from=${encodeURIComponent(path)}`}
        onFocus={show}
        className={`link-plain no-print fixed bottom-3 end-3 z-30 inline-flex h-11 w-11 items-center justify-center gap-2 rounded-full border border-line bg-panel text-[13px] font-semibold shadow-card transition-[transform,opacity] duration-200 hover:border-accent sm:bottom-4 sm:end-4 sm:h-auto sm:w-auto sm:px-4 sm:py-2.5 ${tucked ? 'pointer-events-none translate-y-[calc(100%+1rem)] opacity-0' : ''}`}
        data-testid="dalil-launcher"
        data-tucked={tucked ? 'true' : 'false'}
      >
        <Icon name="sparkle" className="text-accent" />
        <span className="sr-only sm:not-sr-only">{t('shell.dalil.launch')}</span>
      </L>
    </>
  );
}

const PHONE = '(max-width: 639.98px)';
const TEXT_FIELD = 'input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=reset]):not([type=range]):not([type=color]):not([type=file]), textarea, [contenteditable=""], [contenteditable="true"]';

/** Phones only: tucked while scrolling down (past the first screenful's top) or typing; shown on scroll up or on focus. */
function useTuckOnPhones(): [boolean, () => void] {
  const [tucked, setTucked] = useState(false);
  const st = useRef({ away: false, typing: false });
  useEffect(() => {
    const mq = typeof window.matchMedia === 'function' ? window.matchMedia(PHONE) : null;
    let lastY = window.scrollY;
    const update = () => setTucked(!!mq?.matches && (st.current.away || st.current.typing));
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - lastY) < 8) return;
      st.current.away = y > lastY && y > 64;
      lastY = y;
      update();
    };
    const onFocusIn = (e: FocusEvent) => {
      st.current.typing = e.target instanceof Element && e.target.matches(TEXT_FIELD);
      update();
    };
    const onFocusOut = () => {
      st.current.typing = false;
      update();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    mq?.addEventListener?.('change', update);
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      mq?.removeEventListener?.('change', update);
    };
  }, []);
  const show = () => {
    st.current = { away: false, typing: false };
    setTucked(false);
  };
  return [tucked, show];
}
