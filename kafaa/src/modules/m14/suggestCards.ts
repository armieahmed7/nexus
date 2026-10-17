/**
 * PUB-01: which role cards to offer first on /sign-in?next=<path> ("Suggested for what you were doing"). Pure; tested in
 * tests/unit/pub01-signin-suggested.test.tsx.
 *   restricted target  the cards whose roles pass the target route's guard (linkOpenFor: the router's own guard check over the
 *                      generated route list), narrowed to a kind where the link is plainly for them (My applications: applicants)
 *   public target      a page that is open to everyone but asks visitors to sign in for an action on it (Apply: submitting an
 *                      application needs the applications Own grant, and the action is for applicants)
 * Returns null (no suggestion: the page lists every card as before) for no or unknown `next`, a public page without such an
 * action, or when every card or no card qualifies.
 */
import { guardOfLink, linkOpenFor, linkPath } from '../../routes/linkAccess';
import { grantsFor, type Level, type PlatformRole, type Resource } from '../../auth/policy';

export interface CardLite { persona: string; roles: readonly string[]; kind: string }

/** Public pages whose sign-in link is for an action: the grant the action needs and the persona kinds it is meant for. */
const PUBLIC_ACTIONS: { re: RegExp; res: Resource; level: Level; kinds: string[] }[] = [
  { re: /^\/apply\/[^/]+$/, res: 'applications', level: 'Own', kinds: ['applicant'] },
];
/** Restricted targets with an obvious audience among the cards that may open them. */
const PREFER_KINDS: { re: RegExp; kinds: string[] }[] = [
  { re: /^\/my\/applications(\/|$)/, kinds: ['applicant'] },
];

const rolesOf = (c: CardLite) => [...c.roles, 'public'] as PlatformRole[];

export function suggestedPersonas(next: string | null | undefined, cards: readonly CardLite[]): Set<string> | null {
  const path = next ? linkPath(next) : null;
  if (!path) return null;
  const g = guardOfLink(path);
  if (!g) return null;
  let picks: CardLite[];
  if (!g.anyRole && !g.grant) {
    const action = PUBLIC_ACTIONS.find((a) => a.re.test(path));
    if (!action) return null;
    picks = cards.filter((c) => action.kinds.includes(c.kind) && grantsFor(rolesOf(c), action.res).has(action.level));
  } else {
    picks = cards.filter((c) => linkOpenFor(path, rolesOf(c)));
    const pref = PREFER_KINDS.find((p) => p.re.test(path));
    const narrowed = pref ? picks.filter((c) => pref.kinds.includes(c.kind)) : [];
    if (narrowed.length) picks = narrowed;
  }
  if (!picks.length || picks.length === cards.length) return null;
  return new Set(picks.map((c) => c.persona));
}
