/** M01 pure career-map logic: path finding, ladder, competency gap, compare parsing. */
import { describe, expect, it } from 'vitest';
import seed from '../../src/seed/seed.json';
import { competencyGap, edgeMonths, findPaths, ladderSteps, parseCompare, pathMonths, reachable, type PathEdge, type RoleComp } from '../../src/modules/m01/careerGraph';

const T = (seed as unknown as { tables: Record<string, unknown[]> }).tables;
const edges = T.career_paths as PathEdge[];
const rc = T.role_competencies as RoleComp[];

describe('career graph', () => {
  it('the ladder is Local Operator -> RO -> SRO -> Shift Supervisor with a condition on every step', () => {
    const s = ladderSteps(edges);
    expect(s.map((x) => x.role)).toEqual(['local-operator', 'reactor-operator', 'senior-reactor-operator', 'shift-supervisor']);
    expect(s.slice(1).every((x) => x.edge && Array.isArray(x.edge.conditions) && (x.edge.conditions as unknown[]).length > 0)).toBe(true);
    expect(edgeMonths(s[1].edge!)).toBe(36);
    expect(edgeMonths(s[2].edge!)).toBe(24);
  });
  it('finds the graduate route LO -> SRO as the shortest path and the RO route as an alternative', () => {
    const p = findPaths(edges, 'local-operator', 'senior-reactor-operator');
    expect(p[0].map((e) => e.id)).toEqual(['lo-sro-bsc']);
    expect(p.some((x) => x.map((e) => e.id).join() === 'lo-ro,ro-sro')).toBe(true);
    expect(pathMonths(p.find((x) => x.length === 2)!)).toBe(60);
  });
  it('returns no path for the same role or unreachable targets', () => {
    expect(findPaths(edges, 'reactor-operator', 'reactor-operator')).toEqual([]);
    expect(findPaths(edges, 'shift-supervisor', 'local-operator')).toEqual([]);
  });
  it('reachable roles carry their step count', () => {
    const r = reachable(edges, 'local-operator');
    expect(r.get('reactor-operator')).toBe(1);
    expect(r.get('shift-supervisor')).toBe(2);
  });
  it('competency gap lists target levels above the current role', () => {
    const g = competencyGap(rc, 'reactor-operator', 'senior-reactor-operator');
    expect(g.length).toBeGreaterThan(0);
    expect(g.every((x) => x.gap === Math.max(0, x.need - x.have))).toBe(true);
    const fromNothing = competencyGap(rc, null, 'reactor-operator');
    expect(fromNothing.every((x) => x.have === 0 && x.gap === x.need)).toBe(true);
  });
  it('compare keeps at most three known, unique roles', () => {
    const known = new Set(['a', 'b', 'c', 'd']);
    expect(parseCompare('a,b,a,x,c,d', known)).toEqual(['a', 'b', 'c']);
    expect(parseCompare(null, known)).toEqual([]);
  });
});
