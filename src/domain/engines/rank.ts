/**
 * F02 RankEngine: deterministic strategies. Every result carries at least one human-readable reason (i18n key + vars).
 *   byGapClosure   Σ(level gain × importance weight × target weight) / effort hours
 *   byCoOccurrence lift of an item among a cohort (e.g. people who moved RO → SRO) against everyone, on synthetic histories
 *   byCosine       cosine similarity of skill vectors, with the strongest shared skills as reasons
 *   careerMoves    path search over career_paths (promoted careerGraph) scored by readiness, move type and distance
 * Pure functions: pages pass rows in (through useEngine), tests call them directly.
 */
import { findPaths, reachable, type PathEdge, type RoleComp } from '../careerGraph';
import type { BiText, Ranked, Reason, Weights } from './types';

export const IMPORTANCE: Record<string, keyof typeof DEFAULT_RECOMMEND> = { core: 'core', important: 'important', useful: 'useful' };
export const DEFAULT_RECOMMEND = { current_role: 1, target_role: 0.6, core: 3, important: 2, useful: 1 };
export const DEFAULT_MATCH = { skills: 0.7, development: 0.2, target: 0.1 };
const w = (ws: Weights | undefined, k: string, d: number) => (ws && typeof ws[k] === 'number' ? ws[k] : d);
const byScore = <T,>(a: Ranked<T>, b: Ranked<T>) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const r4 = (x: number) => Math.round(x * 10000) / 10000;
export const reason = (code: string, vars?: Reason['vars'], ref?: Reason['ref'], weight?: number): Reason => ({ code, key: `common.engines.reason.${code}`, vars, ref, weight });

// ───────────── gap closure
export interface GapNeed {
  /** What is needed (competency id or skill id). */
  key: string;
  need: number;
  have: number;
  importance: 'core' | 'important' | 'useful';
  /** Target weight: current role 1.0, shortlisted target 0.6 (weights current_role / target_role). */
  weight: number;
  label?: BiText;
  /** The role this need comes from (shown in the reason). */
  role?: BiText;
}
export interface GapCandidate<T = unknown> {
  id: string;
  effortHours: number | null | undefined;
  gives: { key: string; level: number }[];
  item?: T;
}
export function byGapClosure<T>(cands: GapCandidate<T>[], needs: GapNeed[], ws?: Weights): Ranked<T>[] {
  const best = new Map<string, GapNeed[]>();
  for (const n of needs) (best.get(n.key) ?? best.set(n.key, []).get(n.key)!).push(n);
  const out: Ranked<T>[] = [];
  for (const c of cands) {
    let gain = 0;
    const reasons: Reason[] = [];
    for (const g of c.gives) {
      let top: { v: number; n: GapNeed; to: number } | null = null;
      for (const n of best.get(g.key) ?? []) {
        const to = Math.min(g.level, n.need);
        const lift = Math.max(0, to - n.have);
        const v = lift * w(ws, n.importance, DEFAULT_RECOMMEND[n.importance]) * n.weight;
        if (v > 0 && (!top || v > top.v)) top = { v, n, to };
      }
      if (top) {
        gain += top.v;
        reasons.push(reason(top.n.role ? 'gap_role' : 'gap', { skill: top.n.label ?? top.n.key, from: top.n.have, to: top.to, ...(top.n.role ? { role: top.n.role } : {}) }, undefined, r4(top.v)));
      }
    }
    if (gain <= 0) continue;
    const hours = Math.max(1, Number(c.effortHours) || 1);
    if (c.effortHours) reasons.push(reason('effort', { hours: Number(c.effortHours) }));
    out.push({ id: c.id, score: r4(gain / hours), reasons: reasons.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0)), item: c.item });
  }
  return out.sort(byScore);
}

// ───────────── co-occurrence lift
/** histories: person -> items they completed. cohort: people who made the move of interest. */
export function byCoOccurrence(histories: Record<string, string[]>, cohort: string[], opts: { minSupport?: number; exclude?: string[]; labels?: Record<string, BiText> } = {}): Ranked[] {
  const people = Object.keys(histories);
  const inCohort = new Set(cohort.filter((p) => histories[p]));
  if (!people.length || !inCohort.size) return [];
  const all = new Map<string, number>();
  const coh = new Map<string, number>();
  for (const p of people) for (const it of new Set(histories[p])) {
    all.set(it, (all.get(it) ?? 0) + 1);
    if (inCohort.has(p)) coh.set(it, (coh.get(it) ?? 0) + 1);
  }
  const ex = new Set(opts.exclude ?? []);
  const out: Ranked[] = [];
  for (const [it, n] of coh) {
    if (ex.has(it) || n < (opts.minSupport ?? 2)) continue;
    const pc = n / inCohort.size;
    const pa = all.get(it)! / people.length;
    const lift = pc / pa;
    out.push({ id: it, score: r4(lift * pc), reasons: [reason('lift', { pct: Math.round(pc * 100), n: inCohort.size, lift: Math.round(lift * 10) / 10, item: opts.labels?.[it] ?? it })] });
  }
  return out.sort(byScore);
}

// ───────────── cosine
export type Vec = Map<string, number>;
export function cosine(a: Vec, b: Vec): number {
  let dot = 0, na = 0, nb = 0;
  for (const [k, v] of a) { na += v * v; const u = b.get(k); if (u) dot += v * u; }
  for (const v of b.values()) nb += v * v;
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}
export function byCosine<T>(target: Vec, cands: { id: string; vec: Vec; item?: T }[], opts: { min?: number; labels?: Record<string, BiText>; shared?: number } = {}): Ranked<T>[] {
  const out: Ranked<T>[] = [];
  for (const c of cands) {
    const s = cosine(target, c.vec);
    if (s <= (opts.min ?? 0)) continue;
    const shared = [...c.vec.keys()].filter((k) => target.has(k)).sort((x, y) => target.get(y)! * c.vec.get(y)! - target.get(x)! * c.vec.get(x)! || (x < y ? -1 : 1)).slice(0, opts.shared ?? 3);
    out.push({ id: c.id, score: r4(s), item: c.item, reasons: [reason('similar', { pct: Math.round(s * 100) }), ...shared.map((k) => reason('shared', { skill: opts.labels?.[k] ?? k }))] });
  }
  return out.sort(byScore);
}

// ───────────── readiness and career moves
export const IMPORTANCE_WEIGHT = (imp: string, ws?: Weights) => w(ws, imp, (DEFAULT_RECOMMEND as Record<string, number>)[imp] ?? 1);
/** Weighted coverage of a role's requirements: Σ min(have, need)/need × weight / Σ weight (0..1), plus the gaps. Gates are separate. */
export function readiness(have: Map<string, number>, roleComps: RoleComp[], roleId: string, ws?: Weights) {
  const req = roleComps.filter((r) => r.role_id === roleId);
  let num = 0, den = 0;
  const gaps: { competency_id: string; have: number; need: number; importance: string }[] = [];
  for (const r of req) {
    const h = have.get(r.competency_id) ?? 0;
    const wt = IMPORTANCE_WEIGHT(r.importance, ws);
    num += (Math.min(h, r.required_level) / r.required_level) * wt;
    den += wt;
    if (h < r.required_level) gaps.push({ competency_id: r.competency_id, have: h, need: r.required_level, importance: r.importance });
  }
  return { score: den ? r4(num / den) : 0, gaps: gaps.sort((a, b) => b.need - b.have - (a.need - a.have) || (a.competency_id < b.competency_id ? -1 : 1)) };
}
export const MOVE_TYPE_SCORE: Record<string, number> = { vertical: 1, lateral: 0.6, cross_functional: 0.5, entry: 0.3 };
export interface CareerMove { role_id: string; steps: number; type: string; readiness: number | null; path: string[] }
/** Roles reachable within maxSteps, ranked by 0.5 × readiness + 0.35 × move type + 0.15 / steps. Security roles: path only, no readiness. */
export function careerMoves(input: { from: string; edges: PathEdge[]; roleComps: RoleComp[]; have: Map<string, number>; maxSteps?: number; pathOnly?: string[]; labels?: Record<string, BiText>; weights?: Weights }): Ranked<CareerMove>[] {
  const out: Ranked<CareerMove>[] = [];
  const pathOnly = new Set(input.pathOnly ?? []);
  // FS wave-A integration: FS05 "future" edges lead to concept roles, which are not career moves today (FS13 brings them in).
  const edges = input.edges.filter((e) => ((e as { kind?: string | null }).kind ?? 'current') !== 'future');
  for (const [roleId, steps] of reachable(edges, input.from)) {
    if (steps > (input.maxSteps ?? 2)) continue;
    const p = findPaths(edges, input.from, roleId, input.maxSteps ?? 2, 1)[0] ?? [];
    const type = p[0]?.type ?? 'lateral';
    const reasons: Reason[] = [reason(`move_${type}`, { role: input.labels?.[roleId] ?? roleId }), reason('steps', { n: steps })];
    let ready: number | null = null;
    if (pathOnly.has(roleId)) reasons.push(reason('path_only'));
    else {
      ready = readiness(input.have, input.roleComps, roleId, input.weights).score;
      reasons.splice(1, 0, reason('readiness', { pct: Math.round(ready * 100) }));
    }
    const score = 0.5 * (ready ?? 0) + 0.35 * (MOVE_TYPE_SCORE[type] ?? 0.5) + 0.15 / steps;
    out.push({ id: roleId, score: r4(score), reasons, item: { role_id: roleId, steps, type, readiness: ready, path: p.map((e) => e.to_role_id) } });
  }
  return out.sort(byScore);
}

/** Courses ranked by how much they close the gaps to the current role (weight current_role) and target roles (target_role). */
export function coursesForGaps<C extends { id: string; competency_ids: string[]; qualifying?: boolean | null; duration_hours?: number | null }>(input: {
  have: Map<string, number>; currentRole: string | null; targets: string[]; roleComps: RoleComp[]; courses: C[]; labels?: Record<string, BiText>; roleLabels?: Record<string, BiText>; weights?: Weights;
}): Ranked<C>[] {
  const needs: GapNeed[] = [];
  const add = (roleId: string, weight: number) => {
    for (const r of input.roleComps.filter((x) => x.role_id === roleId)) needs.push({ key: r.competency_id, need: r.required_level, have: input.have.get(r.competency_id) ?? 0, importance: r.importance as GapNeed['importance'], weight, label: input.labels?.[r.competency_id], role: input.roleLabels?.[roleId] });
  };
  if (input.currentRole) add(input.currentRole, w(input.weights, 'current_role', DEFAULT_RECOMMEND.current_role));
  for (const t of input.targets) add(t, w(input.weights, 'target_role', DEFAULT_RECOMMEND.target_role));
  return byGapClosure(input.courses.map((c) => ({ id: c.id, effortHours: c.duration_hours, gives: c.competency_ids.map((k) => ({ key: k, level: c.qualifying ? 2 : 1 })), item: c })), needs, input.weights);
}

// ───────────── explanation lint
/** Problems with a ranked list: items without a reason, or reasons without a key. Used by tests in every wave. */
export function lintRanked(list: Ranked[]): string[] {
  const out: string[] = [];
  for (const r of list) {
    if (!r.reasons?.length) out.push(`${r.id}: no reason`);
    for (const x of r.reasons ?? []) if (!x.key || !/^[a-z0-9]+\.[\w.-]+$/i.test(x.key)) out.push(`${r.id}: reason without an i18n key`);
  }
  return out;
}
