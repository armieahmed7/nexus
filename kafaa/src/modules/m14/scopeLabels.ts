// Sign-in role cards: persona scope codes ("instructor:entity=enec-ops", "hr_director:all") as readable EN/AR text.
// UI only; the codes themselves stay as they are in personas.json, the policy and the database.
import { entityName, hasKey } from '../../i18n';

type T = (key: string, vars?: Record<string, string | number>) => string;

/** One scope code as text, or null for ":self" (every signed-in person has it, so the card does not repeat it). */
export function scopeLabel(t: T, scope: string): string | null {
  const rest = scope.slice(scope.indexOf(':') + 1);
  if (rest === 'self') return null;
  if (rest === 'all') return t('m14.signIn.scopeAll');
  const eq = rest.indexOf('=');
  if (eq < 0) return rest;
  const kind = rest.slice(0, eq);
  const value = rest.slice(eq + 1);
  const name =
    kind === 'entity' ? entityName(t, value)
    : kind === 'team' && hasKey(`m14.team.${value}`) ? t(`m14.team.${value}`)
    : hasKey(`m14.signIn.scopeValue.${value}`) ? t(`m14.signIn.scopeValue.${value}`)
    : value;
  return `${hasKey(`m14.scope.${kind}`) ? t(`m14.scope.${kind}`) : kind}: ${name}`;
}

/** All of a card's scopes, de-duplicated (CHCO holds hr_director:all and hr_analyst:all), joined with " · ". */
export function scopeSummary(t: T, scopes: string[]): string {
  return [...new Set(scopes.map((s) => scopeLabel(t, s)).filter((x): x is string => !!x))].join(' · ');
}
