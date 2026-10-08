/**
 * Pure career-map logic (M01): progression edges with structured conditions, path finding for the "path to role"
 * planner, competency gaps between roles and role comparison. No data access; pages pass rows in. Unit-tested.
 */
export interface Condition {
  kind: string;
  value: string | number;
  en: string;
  ar: string;
}
export interface PathEdge {
  id: string;
  from_role_id: string | null;
  to_role_id: string;
  type: 'entry' | 'vertical' | 'lateral' | 'cross_functional';
  route_code?: string | null;
  label_en: string;
  label_ar: string;
  from_label_en?: string | null;
  from_label_ar?: string | null;
  conditions: Condition[] | unknown;
  rule_ref?: string | null;
  basis: string;
  sort?: number;
}
export interface RoleComp {
  role_id: string;
  competency_id: string;
  required_level: number;
  importance: string;
}

export const conds = (e: Pick<PathEdge, 'conditions'>): Condition[] => (Array.isArray(e.conditions) ? (e.conditions as Condition[]) : []);

/** Outgoing (next) and incoming (previous) progression edges for a role. Entry edges come in from outside the map. */
export function neighbours<E extends PathEdge>(edges: E[], roleId: string) {
  return {
    next: edges.filter((e) => e.from_role_id === roleId),
    prev: edges.filter((e) => e.to_role_id === roleId && e.from_role_id),
    entry: edges.filter((e) => e.to_role_id === roleId && !e.from_role_id),
  };
}

/** Indicative minimum months on an edge: the largest "months" condition (others are "including" sub-periods). */
export function edgeMonths(e: Pick<PathEdge, 'conditions'>): number {
  return conds(e).reduce((m, c) => (c.kind === 'months' && typeof c.value === 'number' ? Math.max(m, c.value) : m), 0);
}

/**
 * Simple paths from one role to another over progression edges (entry edges excluded), shortest first.
 * Ties are broken by indicative months, then by preferring vertical moves.
 */
export function findPaths<E extends PathEdge>(edges: E[], from: string, to: string, maxDepth = 6, maxPaths = 5): E[][] {
  if (!from || !to || from === to) return [];
  const out: E[][] = [];
  const walk = (at: string, seen: Set<string>, acc: E[]) => {
    if (acc.length > maxDepth) return;
    for (const e of edges) {
      if (e.from_role_id !== at || seen.has(e.to_role_id)) continue;
      const next = [...acc, e];
      if (e.to_role_id === to) out.push(next);
      else {
        seen.add(e.to_role_id);
        walk(e.to_role_id, seen, next);
        seen.delete(e.to_role_id);
      }
    }
  };
  walk(from, new Set([from]), []);
  const vertical = (p: E[]) => p.filter((e) => e.type !== 'vertical').length;
  return out
    .sort((a, b) => a.length - b.length || pathMonths(a) - pathMonths(b) || vertical(a) - vertical(b))
    .slice(0, maxPaths);
}
export const pathMonths = (p: Pick<PathEdge, 'conditions'>[]) => p.reduce((s, e) => s + edgeMonths(e), 0);

/** Roles reachable from a role (any number of steps), with the shortest step count. */
export function reachable<E extends PathEdge>(edges: E[], from: string): Map<string, number> {
  const dist = new Map<string, number>([[from, 0]]);
  const q = [from];
  while (q.length) {
    const at = q.shift()!;
    for (const e of edges) {
      if (e.from_role_id === at && !dist.has(e.to_role_id)) {
        dist.set(e.to_role_id, dist.get(at)! + 1);
        q.push(e.to_role_id);
      }
    }
  }
  dist.delete(from);
  return dist;
}

export interface GapRow {
  competency_id: string;
  have: number;
  need: number;
  gap: number;
  importance: string;
}
/** Competency gap from a current role (or nothing) to a target role: the levels the target needs above the current role's. */
export function competencyGap(rc: RoleComp[], fromRole: string | null, toRole: string): GapRow[] {
  const have = new Map(rc.filter((r) => r.role_id === fromRole).map((r) => [r.competency_id, r.required_level]));
  return rc
    .filter((r) => r.role_id === toRole)
    .map((r) => {
      const h = have.get(r.competency_id) ?? 0;
      return { competency_id: r.competency_id, have: h, need: r.required_level, gap: Math.max(0, r.required_level - h), importance: r.importance };
    })
    .sort((a, b) => b.gap - a.gap || a.competency_id.localeCompare(b.competency_id));
}

/** The licensed operations ladder: Local Operator -> RO -> SRO -> Shift Supervisor, each with its progression edge. */
export const LADDER = ['local-operator', 'reactor-operator', 'senior-reactor-operator', 'shift-supervisor'] as const;
export function ladderSteps<E extends PathEdge>(edges: E[]): { role: string; edge: E | null }[] {
  return LADDER.map((role, i) => ({ role, edge: i === 0 ? null : (edges.find((e) => e.from_role_id === LADDER[i - 1] && e.to_role_id === role && e.type === 'vertical') ?? null) }));
}

/** Parse "a,b,c" from the compare query string (max 3, unique, known ids only). */
export function parseCompare(q: string | null, known: Set<string>): string[] {
  return [...new Set((q ?? '').split(',').map((s) => s.trim()).filter((s) => known.has(s)))].slice(0, 3);
}
