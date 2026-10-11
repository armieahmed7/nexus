// QA (FS wave C): a narrowing hint for large person-keyed reads by Scope-only readers (managers). Postgres evaluates the RLS rule
// (kafaa_rule_read -> kafaa_in_scope) once per row, so a manager's unfiltered read of kafaa_person_skills scanned every row and
// could hit the 8 s statement timeout. Filtering by the person ids the caller can possibly see lets the person_id index do the work.
// It never widens access: RLS (and the LocalBackend mirror) still decide every row. Returns null when no narrowing is safe.
import { grantsFor, levelsOf } from '../auth/policy';
import type { Level, Resource } from '../auth/policy';
import type { Identity } from './types';

type PersonLike = { id: string; entity_id?: string | null; job_family_id?: string | null; team_id?: string | null; crew?: string | null; org_id?: string | null };

/** Superset of the person ids whose rows `resources` let the caller read through Own/Scope, or null (read everything / cannot narrow). */
export function scopedPersonIds(identity: Identity, people: PersonLike[], resources: Resource[]): string[] | null {
  const wide: Level[] = ['R', 'W', 'A', 'OwnOrg', 'OrgW'];
  for (const res of [...resources, 'equivalency' as Resource]) {
    const g = grantsFor(identity.roles, res);
    if (wide.some((l) => g.has(l))) return null;
  }
  const ids = new Set<string>();
  if (identity.personId) ids.add(identity.personId);
  for (const a of identity.assignments) {
    if (a.status !== 'active' || !resources.some((r) => levelsOf(a.role, r).includes('Scope'))) continue;
    if (a.scope_type === 'all') return null;
    for (const p of people) {
      const hit = (a.scope_type === 'entity' && p.entity_id === a.scope_value) || (a.scope_type === 'family' && p.job_family_id === a.scope_value)
        || (a.scope_type === 'team' && p.team_id === a.scope_value) || (a.scope_type === 'crew' && p.crew === a.scope_value) || (a.scope_type === 'org' && p.org_id === a.scope_value);
      if (hit) ids.add(p.id);
    }
  }
  return [...ids];
}
