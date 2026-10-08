/**
 * Row access rules in TypeScript: the exact mirror of kafaa_rule_read / kafaa_in_scope / the generated RLS policies.
 * Used by the LocalBackend (enforcement) and by pages (to decide what to show). Keep in lockstep with
 * scripts/gen-policy.mjs and scripts/gen-schema.mjs.
 */
import { SCHEMA, type ReadRule } from './schema';
import { grantsFor, levelsOf, MIN_GROUP_SIZE, type Level, type PlatformRole, type Resource } from '../auth/policy';
import type { Identity } from './types';

export interface PersonLite {
  id: string;
  entity_id?: string | null;
  job_family_id?: string | null;
  team_id?: string | null;
  crew?: string | null;
  org_id?: string | null;
}

export class AccessContext {
  constructor(public readonly who: Identity, private readonly people: Map<string, PersonLite>) {}

  get roles(): PlatformRole[] {
    return this.who.roles.includes('public') ? this.who.roles : [...this.who.roles, 'public'];
  }
  grants(res: string): Set<Level> {
    return grantsFor(this.roles, res as Resource);
  }
  has(res: string, levels: Level[]): boolean {
    const g = this.grants(res);
    return levels.some((l) => g.has(l));
  }
  /** Does the caller hold `role` and does that role carry `level` on `res`? */
  roleGrant(role: PlatformRole, res: string, level: Level): boolean {
    return this.roles.includes(role) && levelsOf(role, res as Resource).includes(level);
  }
  /** kafaa_in_scope: target person inside the scope of one of the caller's role assignments that has 'Scope' on res. */
  inScope(res: string, personId: string | null | undefined): boolean {
    if (!personId) return false;
    const t = this.people.get(personId);
    if (!t) return false;
    return this.who.assignments.some((a) => {
      if (a.status !== 'active') return false;
      if (!levelsOf(a.role, res as Resource).includes('Scope')) return false;
      switch (a.scope_type) {
        case 'all': return true;
        case 'entity': return t.entity_id === a.scope_value;
        case 'family': return t.job_family_id === a.scope_value;
        case 'team': return t.team_id === a.scope_value;
        case 'crew': return t.crew === a.scope_value;
        case 'org': return t.org_id === a.scope_value;
        default: return false;
      }
    });
  }
  /** kafaa_rule_read */
  ruleRead(res: string, person: string | null | undefined, org: string | null | undefined, where: boolean): boolean {
    const me = this.who.personId;
    if (where && this.has(res, ['R', 'W', 'A'])) return true;
    if (person != null && me && person === me && this.has(res, ['Own', 'Scope'])) return true;
    if (person != null && this.has(res, ['Scope']) && this.inScope(res, person)) return true;
    if (org != null && this.who.orgId && org === this.who.orgId && this.has(res, ['OwnOrg', 'OrgW'])) return true;
    return false;
  }
  private rule(r: ReadRule, row: Record<string, unknown>): boolean {
    const person = r.person ? (row[r.person] as string | null) : null;
    const org = r.org ? (row[r.org] as string | null) : null;
    const where = r.where ? Boolean(row[r.where]) : true;
    switch (r.special) {
      case 'agg_ok':
        return this.has(r.res, ['Agg', 'R', 'W', 'A']);
      case 'agg_suppressed':
        return this.has(r.res, ['R', 'W', 'A']) || (this.has(r.res, ['Agg']) && Number(row.group_size) >= MIN_GROUP_SIZE);
      case 'university_consent':
        return this.ruleRead(r.res, person, org, where) || (this.roleGrant('university', r.res, 'Scope') && row.university_org_id === this.who.orgId && row.consent_university === true);
      case 'observer_org':
        return this.has(r.res, ['Agg']) && row.status === 'released' && Array.isArray(row.released_to_org_ids) && !!this.who.orgId && (row.released_to_org_ids as string[]).includes(this.who.orgId);
      default:
        return this.ruleRead(r.res, person, org, where);
    }
  }
  canReadRow(table: string, row: Record<string, unknown>): boolean {
    const def = SCHEMA[table];
    if (!def) return false;
    return def.read.some((r) => this.rule(r, row));
  }
  /** Mirror of the generated insert/update policies. */
  canWriteRow(table: string, row: Record<string, unknown>, op: 'insert' | 'update'): boolean {
    const def = SCHEMA[table];
    const w = def?.write;
    if (!w || w.mode !== 'direct' || !w.res) return false;
    if (op === 'insert' && w.anonInsert) return true;
    if (!this.who.personId && op === 'update') return false;
    if (this.has(w.res, ['W', 'A'])) return true;
    const pcol = def.read.find((r) => r.person)?.person;
    const ocol = def.read.find((r) => r.org)?.org;
    if (w.own && pcol && this.who.personId && row[pcol] === this.who.personId && this.has(w.res, ['Own', 'Scope'])) return true;
    if (w.orgw && ocol && this.who.orgId && row[ocol] === this.who.orgId && this.has(w.res, ['OrgW'])) return true;
    return false;
  }
  /** First role (alphabetical, like kafaa_acting_role) that carries one of `levels` on `res`, or null. */
  actingRole(res: string, levels: Level[]): PlatformRole | null {
    for (const r of [...this.roles].sort()) if (levels.some((l) => levelsOf(r, res as Resource).includes(l))) return r;
    return null;
  }
}

/** Convenience for pages: does the signed-in identity carry any of these levels on a resource? */
export function can(who: Identity, res: Resource, levels: Level[]): boolean {
  const g = grantsFor(who.roles, res);
  return levels.some((l) => g.has(l));
}
