// FS wave I integration (QA lead): an entry link that renders only for people the target route's guard lets in (same check as the router),
// so a cross-module entry link never leads to a "not allowed" page. Used by the wave-I entry links (FS81, FS83, FS84).
import type { ReactNode } from 'react';
import { useSession } from '../auth/session';
import { checkGuard } from '../auth/guards';
import { ROUTES } from '../routes/registry';
import { L } from '../i18n';

export function useCanOpen(path: string): boolean {
  const s = useSession();
  const route = ROUTES.find((x) => x.path === path);
  return !!route && checkGuard(route.guard, s) === 'ok';
}

export function GuardedLink({ to, children, testId, className = 'btn-outline btn-sm no-underline' }: { to: string; children: ReactNode; testId?: string; className?: string }) {
  const ok = useCanOpen(to.split('?')[0]);
  return ok ? <L to={to} className={className} data-testid={testId}>{children}</L> : null;
}
