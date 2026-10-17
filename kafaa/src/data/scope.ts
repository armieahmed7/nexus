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
    for (const p of people) if (inAssignment(a, p)) ids.add(p.id);
  }
  return [...ids];
}

// MGR-01: the people a Scope reader may see for one resource, exactly as RLS decides it. kafaa_scope_people(res) (SQL,
// 20261013200001_kafaa_ready_scope_people.sql) and the LocalBackend's AccessContext.ruleRead admit: the caller when they hold Own
// or Scope on res, plus every person in the scope of one of their active assignments whose role has Scope on res. A caller who reads
// res with R, W or A sees every row, so the answer is 'all'. Pages use this instead of "every person I can read" (the directory is
// readable far more widely than the records), so a crew manager's "People in scope" is their crew, not the whole company.
export function scopePeople(identity: Identity, people: PersonLike[], res: Resource): Set<string> | 'all' {
  const g = grantsFor(identity.roles, res);
  if (g.has('R') || g.has('W') || g.has('A')) return 'all';
  const ids = new Set<string>();
  if (identity.personId && (g.has('Own') || g.has('Scope'))) ids.add(identity.personId);
  for (const a of identity.assignments) {
    if (a.status !== 'active' || !levelsOf(a.role, res).includes('Scope')) continue;
    if (a.scope_type === 'all') return 'all';
    for (const p of people) if (inAssignment(a, p)) ids.add(p.id);
  }
  return ids;
}

/** The active assignments that give Scope on res (what the scope is made of: a crew, a team, a family, an entity...). */
export function scopeAssignments(identity: Identity, res: Resource): { type: string; value: string | null }[] {
  const seen = new Set<string>();
  const out: { type: string; value: string | null }[] = [];
  for (const a of identity.assignments) {
    if (a.status !== 'active' || !levelsOf(a.role, res).includes('Scope') || a.scope_type === 'self') continue;
    const k = `${a.scope_type}:${a.scope_value ?? ''}`;
    if (!seen.has(k)) { seen.add(k); out.push({ type: a.scope_type, value: a.scope_value }); }
  }
  return out;
}

function inAssignment(a: { scope_type: string; scope_value: string | null }, p: PersonLike): boolean {
  return (a.scope_type === 'entity' && p.entity_id === a.scope_value) || (a.scope_type === 'family' && p.job_family_id === a.scope_value)
    || (a.scope_type === 'team' && p.team_id === a.scope_value) || (a.scope_type === 'crew' && p.crew === a.scope_value) || (a.scope_type === 'org' && p.org_id === a.scope_value);
}
