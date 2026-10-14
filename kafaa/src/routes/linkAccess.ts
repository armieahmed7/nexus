// Readiness fixes 2026-10-13 (finding 2): may this person open this link? The router's guard check (checkGuard in src/auth/guards.tsx,
// for someone signed in) over the generated route list, import-free so the digest rules, the seed builder and the PGlite validators can
// use it. SQL mirror: kafaa_route_ok_for() in supabase/migrations/20261013200005_kafaa_ready_route_guards.sql. Inside React use
// canOpen() from src/shell/GuardedLink.tsx (the same check over the live registry); tests/unit/ready-route-guards.test.ts proves the two
// agree for every route.
import { ROUTE_GUARDS, type GuardLite } from './guards.gen.ts';
import { grantsFor, type PlatformRole, type Resource, type Level } from '../auth/policy.ts';

const reOf = (p: string) => new RegExp(`^${p.replace(/[.+^$()|[\]\\]/g, '\\$&').replace(/:[A-Za-z0-9_]+/g, '[^/]+')}$`, 'i');
/** Static paths first, then parameter paths, each in router order (= routeForPath in src/routes/registry.ts). */
const RANKED: [RegExp, GuardLite, string][] = ROUTE_GUARDS.map(([p, g], i) => ({ p, g, i }))
  .sort((a, b) => Number(a.p.includes(':')) - Number(b.p.includes(':')) || a.i - b.i)
  .map(({ p, g }) => [reOf(p), g, p]);

/** The path part of an internal link (no query, hash, /ar prefix or trailing slash); null for an external or protocol-relative link. */
export function linkPath(link: string): string | null {
  if (typeof link !== 'string' || !link.startsWith('/') || link.startsWith('//')) return null;
  let p = link.split('#')[0].split('?')[0] || '/';
  if (p === '/ar' || p.startsWith('/ar/')) p = p.slice(3) || '/';
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}
/** The guard of the route a link opens, or null for an unknown link. */
export function guardOfLink(link: string): GuardLite | null {
  const p = linkPath(link);
  if (p == null) return null;
  for (const [re, g] of RANKED) if (re.test(p)) return g;
  return null;
}
/** True when someone signed in with these roles may open the link (unknown and external links: false). `roles` as kafaa_my_roles(). */
export function linkOpenFor(link: string, roles: readonly string[]): boolean {
  const g = guardOfLink(link);
  if (!g) return false;
  if (!g.signedIn && !g.anyRole && !g.grant) return true;
  if (!g.anyRole && !g.grant) return true;
  const rs = roles as readonly PlatformRole[];
  const roleOk = !!g.anyRole && g.anyRole.some((r) => rs.includes(r as PlatformRole));
  const grantOk = !!g.grant && g.grant.levels.some((l) => grantsFor(rs, g.grant!.res as Resource).has(l as Level));
  return roleOk || grantOk;
}
/** A person's roles on a day, as kafaa_my_roles(): active assignments not expired on that day, plus 'public'. */
export function rolesOn(assignments: readonly Record<string, unknown>[], person: string, day: string): string[] {
  const out = new Set<string>();
  for (const a of assignments) {
    if (a.person_id !== person || a.status !== 'active') continue;
    const exp = a.expires_at == null ? null : String(a.expires_at).slice(0, 10);
    if (exp != null && exp < day) continue;
    out.add(String(a.role));
  }
  return [...out, 'public'];
}
