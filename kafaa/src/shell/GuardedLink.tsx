// FS wave I integration (QA lead): an entry link that renders only for people the target route's guard lets in (same check as the router),
// so a cross-module entry link never leads to a "not allowed" page. Used by the wave-I entry links (FS81, FS83, FS84).
// Readiness fixes 2026-10-13 (finding 2): canOpen() also takes concrete links with parameters, a query or a hash (/opportunities/x?tab=y),
// matched with the router's own routeForPath, so dashboards and the digest drop links the person cannot open.
import type { ReactNode } from 'react';
import { useSession, type Session } from '../auth/session';
import { checkGuard } from '../auth/guards';
import { ROUTES, routeForPath } from '../routes/registry';
import { L } from '../i18n';

/** The route pattern a link opens (without /kafaa, /ar, query or hash), or null for an unknown or external link. */
export function routeOfLink(link: string) {
  if (!link.startsWith('/') || link.startsWith('//')) return null;
  let path = link.split('#')[0].split('?')[0] || '/';
  if (path === '/ar' || path.startsWith('/ar/')) path = path.slice(3) || '/';
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return routeForPath(path)?.def ?? null;
}
/** True when the route a link opens lets this session in (the router's own guard check). Unknown links are false. */
export function canOpen(link: string, s: Pick<Session, 'status' | 'roles'>): boolean {
  const def = routeOfLink(link);
  return !!def && checkGuard(def.guard, s) === 'ok';
}
export function useCanOpenLink(): (link: string) => boolean {
  const s = useSession();
  return (link: string) => canOpen(link, s);
}

export function useCanOpen(path: string): boolean {
  const s = useSession();
  const route = ROUTES.find((x) => x.path === path);
  return !!route && checkGuard(route.guard, s) === 'ok';
}

export function GuardedLink({ to, children, testId, className = 'btn-outline btn-sm no-underline' }: { to: string; children: ReactNode; testId?: string; className?: string }) {
  const ok = useCanOpen(to.split('?')[0]);
  return ok ? <L to={to} className={className} data-testid={testId}>{children}</L> : null;
}
