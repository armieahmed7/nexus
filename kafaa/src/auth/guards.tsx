/**
 * Route guards. Deny by default: anything not explicitly public needs sign-in, and role/grant conditions are checked
 * against the policy matrix. Denials are logged through rpc.logDenied (never on noTelemetry routes such as /speak-up).
 * The guard is a convenience for the UI; RLS (supabase) and the LocalBackend access mirror are the real enforcement.
 */
import { useEffect, type ReactNode } from 'react';
import type { Guard } from '../routes/types';
import { useSession, type Session } from './session';
import { grantsFor, type Level, type PlatformRole, type Resource } from './policy';
import { L, useI18n, useT } from '../i18n';
import { Icon } from '../ui/Icon';
import { ErrorState, Skeleton } from '../ui/Page';

export type GuardResult = 'ok' | 'loading' | 'signin' | 'forbidden' | 'error';

export function checkGuard(guard: Guard, s: Pick<Session, 'status' | 'roles'>): GuardResult {
  const needsSignIn = guard.signedIn || !!guard.anyRole || !!guard.grant;
  if (!needsSignIn) return 'ok';
  if (s.status === 'loading') return 'loading';
  if (s.status === 'error') return 'error';
  if (s.status !== 'signed_in') return 'signin';
  if (!guard.anyRole && !guard.grant) return 'ok';
  const roleOk = !!guard.anyRole && guard.anyRole.some((r) => s.roles.includes(r));
  const grantOk = !!guard.grant && guard.grant.levels.some((l) => grantsFor(s.roles, guard.grant!.res).has(l));
  return roleOk || grantOk ? 'ok' : 'forbidden';
}

export function RequireGuard({ guard, routeId, children }: { guard: Guard; routeId: string; children: ReactNode }) {
  const session = useSession();
  const res = checkGuard(guard, session);
  useEffect(() => {
    if (res === 'forbidden' && !guard.noTelemetry) {
      void session.repo.rpc.logDenied(routeId, guard.grant?.res ?? (guard.anyRole ?? []).join('|')).catch(() => undefined);
    }
  }, [res, routeId, guard, session.repo]);
  if (res === 'loading') return <div className="mx-auto max-w-6xl p-6"><Skeleton lines={5} /></div>;
  if (res === 'error') return <SessionError />;
  if (res === 'signin') return <SignInRequired />;
  if (res === 'forbidden') return <Forbidden />;
  return <>{children}</>;
}

export function SignInRequired() {
  const t = useT();
  const { path } = useI18n();
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center" data-testid="signin-required">
      <Icon name="lock" size={32} className="mx-auto text-ink-3" />
      <h1 className="mt-3 text-[22px] font-semibold">{t('shell.guard.signInTitle')}</h1>
      <p className="mt-2 text-ink-2">{t('shell.guard.signInBody')}</p>
      <L to={`/sign-in?next=${encodeURIComponent(path)}`} className="btn-primary mt-5">
        {t('shell.signIn')}
      </L>
    </div>
  );
}

/** The session could not be resolved (see Session.error): say so, never show the sign-in gate to someone who chose a persona. */
export function SessionError() {
  const t = useT();
  const session = useSession();
  return (
    <div className="mx-auto max-w-xl px-4 py-16" data-testid="session-error">
      <ErrorState title={t('shell.guard.sessionErrorTitle')} error={t('shell.guard.sessionErrorBody')} retry={session.retry} />
    </div>
  );
}

export function Forbidden() {
  const t = useT();
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center" data-testid="forbidden">
      <Icon name="shield" size={32} className="mx-auto text-ink-3" />
      <h1 className="mt-3 text-[22px] font-semibold">{t('shell.guard.forbiddenTitle')}</h1>
      <p className="mt-2 text-ink-2">{t('shell.guard.forbiddenBody')}</p>
      <L to="/" className="btn-outline mt-5">
        {t('shell.guard.goHome')}
      </L>
    </div>
  );
}

/** Inline guard for parts of a page: <Can res="training" levels={['W']}>...</Can> */
export function Can({ res, levels, roles, children, fallback = null }: { res?: Resource; levels?: Level[]; roles?: PlatformRole[]; children: ReactNode; fallback?: ReactNode }) {
  const s = useSession();
  const ok = (roles ? roles.some((r) => s.roles.includes(r)) : false) || (res && levels ? s.can(res, levels) : false);
  return <>{ok ? children : fallback}</>;
}
