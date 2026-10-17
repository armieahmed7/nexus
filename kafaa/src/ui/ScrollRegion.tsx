/**
 * ScrollRegion: a box that scrolls (wide tables, grids, timelines, long lists). While its content overflows it is a keyboard
 * stop, so people who do not use a mouse can scroll it with the arrow keys (WCAG 2.1.1, axe scrollable-region-focusable), and
 * with `label` it is announced as a named region. When nothing overflows it stays a plain div and adds no tab stop.
 *   <ScrollRegion className="card overflow-x-auto" label={t('...')}>…</ScrollRegion>
 */
import { useLayoutEffect, useRef, useState, type HTMLAttributes } from 'react';

export function ScrollRegion({ label, className = 'overflow-x-auto', children, ...rest }: HTMLAttributes<HTMLDivElement> & { label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrolls, setScrolls] = useState(false);
  // Re-measured after every render and whenever the box or its direct children resize (viewport, fonts, data, pagination).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const check = () => setScrolls(el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1);
    const ro = new ResizeObserver(check);
    ro.observe(el);
    for (const c of Array.from(el.children)) ro.observe(c);
    check();
    return () => ro.disconnect();
  });
  return (
    <div
      ref={ref}
      {...rest}
      className={className}
      tabIndex={scrolls ? 0 : undefined}
      role={scrolls && label ? 'region' : rest.role}
      aria-label={scrolls && label ? label : rest['aria-label']}
    >
      {children}
    </div>
  );
}
