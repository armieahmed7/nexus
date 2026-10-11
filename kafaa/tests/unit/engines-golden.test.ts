/**
 * F02 engine kernel: golden-case evaluation harness and kernel guarantees.
 * Wave engineers: add your surface's golden cases here (or in your own file) and run lintRanked over every ranked list.
 */
import { describe, expect, it } from 'vitest';
import seed from '../../src/seed/seed.json';
import {
  byCoOccurrence, byCosine, byGapClosure, careerMoves, competencyLevels, coursesForGaps, lintRanked, makeEngine, ModelGatewayEngine, readiness, resolveEngine,
  roleVector, skillVector, type BiText,
} from '../../src/domain/engines';
import { hasKey } from '../../src/i18n';
import { findPaths, reachable } from '../../src/modules/m01/careerGraph';
import { SearchIndex as DalilIndex } from '../../src/modules/m13/dalil/search';
import { SearchIndex } from '../../src/domain/search';

const T = (seed as unknown as { tables: Record<string, any[]> }).tables;
const roleLabels: Record<string, BiText> = Object.fromEntries(T.job_roles.map((r) => [r.id, { en: r.title_en, ar: r.title_ar }]));
const compLabels: Record<string, BiText> = Object.fromEntries(T.competencies.map((c) => [c.id, { en: c.name_en, ar: c.name_ar }]));
const statesOf = (p: string) => T.person_skills.filter((s) => s.person_id === p);
const pathOnly = T.job_roles.filter((r) => r.security_sensitive).map((r) => r.id);
const keysOk = (list: { reasons: { key: string }[] }[]) => list.every((r) => r.reasons.every((x) => hasKey(x.key)));

describe('golden cases (k-ro)', () => {
  const have = competencyLevels(statesOf('p-k-ro'), T.skills);
  const moves = careerMoves({ from: 'reactor-operator', edges: T.career_paths, roleComps: T.role_competencies, have, labels: roleLabels, pathOnly });
  it('the top career suggestion for k-ro is SRO', () => {
    expect(moves[0].id).toBe('senior-reactor-operator');
    expect(moves[0].reasons.map((r) => r.code)).toContain('move_vertical');
  });
  it('the top course gap closes an SRO-required competency', () => {
    const courses = T.courses.filter((c) => c.audience === 'staff');
    const ranked = coursesForGaps({ have, currentRole: 'reactor-operator', targets: ['senior-reactor-operator'], roleComps: T.role_competencies, courses, labels: compLabels, roleLabels });
    expect(ranked.length).toBeGreaterThan(0);
    const sro = T.role_competencies.filter((r) => r.role_id === 'senior-reactor-operator');
    const gapComps = new Set(sro.filter((r) => (have.get(r.competency_id) ?? 0) < r.required_level).map((r) => r.competency_id));
    expect(ranked[0].item!.competency_ids.some((c: string) => gapComps.has(c))).toBe(true);
    expect(ranked[0].reasons[0].code).toBe('gap_role');
  });
  it('security roles show the career path only (no readiness)', () => {
    const fromSec = careerMoves({ from: 'security-officer', edges: T.career_paths, roleComps: T.role_competencies, have, pathOnly, maxSteps: 3 });
    const all = careerMoves({ from: 'local-operator', edges: [...T.career_paths, { id: 'x', from_role_id: 'local-operator', to_role_id: 'security-officer', type: 'cross_functional', label_en: '', label_ar: '', conditions: [], basis: 'generic' }], roleComps: T.role_competencies, have, pathOnly });
    const sec = all.find((m) => m.id === 'security-officer')!;
    expect(sec.item!.readiness).toBeNull();
    expect(sec.reasons.map((r) => r.code)).toContain('path_only');
    expect(lintRanked(fromSec)).toEqual([]);
  });
});

describe('every ranked list carries human-readable reasons (lint over the engine outputs)', () => {
  const have = competencyLevels(statesOf('p-k-ro'), T.skills);
  it('gap closure, co-occurrence, cosine and career moves', () => {
    const lists = [
      careerMoves({ from: 'local-operator', edges: T.career_paths, roleComps: T.role_competencies, have, labels: roleLabels, pathOnly }),
      coursesForGaps({ have, currentRole: 'reactor-operator', targets: ['senior-reactor-operator'], roleComps: T.role_competencies, courses: T.courses, labels: compLabels, roleLabels }),
      byGapClosure([{ id: 'c', effortHours: 10, gives: [{ key: 'ld-01', level: 2 }] }], [{ key: 'ld-01', need: 3, have: 0, importance: 'core', weight: 1 }]),
      byCoOccurrence(Object.fromEntries(T.people.map((p) => [p.id, T.training_records.filter((t) => t.person_id === p.id).map((t) => t.course_id)])), T.people.filter((p) => p.job_role_id === 'senior-reactor-operator').map((p) => p.id)),
      byCosine(skillVector(statesOf('w-chem-01').length ? statesOf('w-chem-01') : statesOf('p-k-ro')), T.job_roles.map((r) => ({ id: r.id, vec: roleVector(T.role_competencies, r.id) }))),
    ];
    for (const l of lists) {
      expect(l.length).toBeGreaterThan(0);
      expect(lintRanked(l)).toEqual([]);
      expect(keysOk(l)).toBe(true);
    }
  });
  it('readiness never exceeds 1 and lists gaps', () => {
    const r = readiness(have, T.role_competencies, 'senior-reactor-operator');
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThan(1);
    expect(r.gaps.length).toBeGreaterThan(0);
  });
  it('lintRanked flags items without reasons', () => {
    expect(lintRanked([{ id: 'a', score: 1, reasons: [] }])).toEqual(['a: no reason']);
  });
});

describe('model slot', () => {
  it('switching a surface to model without a URL falls back to deterministic with "model unavailable", without errors', async () => {
    const r = resolveEngine('recommend', { engine: 'model', weights: { core: 5 } }, null);
    expect(r).toMatchObject({ requested: 'model', kind: 'deterministic', status: 'model_unavailable' });
    expect(r.weights.core).toBe(5);
    const eng = makeEngine(r, new ModelGatewayEngine(null));
    const out = await eng.run(() => [{ id: 'x', score: 1, reasons: [{ code: 'gap', key: 'common.engines.reason.gap' }] }], { candidates: [] });
    expect(out.kind).toBe('deterministic');
    expect(out.status).toBe('model_unavailable');
    expect(out.results[0].id).toBe('x');
    await expect(new ModelGatewayEngine(null).rank('recommend', [], {})).rejects.toThrow('model unavailable');
    expect(hasKey('common.engines.badge.model_unavailable')).toBe(true);
  });
  it('a configured but failing gateway also falls back', async () => {
    const r = resolveEngine('match', { engine: 'model' }, 'http://127.0.0.1:9/none');
    expect(r.kind).toBe('model');
    const eng = makeEngine(r, new ModelGatewayEngine('http://127.0.0.1:9/none'));
    const out = await eng.run(() => [], { candidates: [] });
    expect(out.status).toBe('model_unavailable');
  });
  it('defaults serve when no setting exists; non-numeric weights are ignored', () => {
    const r = resolveEngine('search', { engine: 'deterministic', weights: { title: 'x' } });
    expect(r.status).toBe('active');
    expect(r.weights.title).toBe(3);
  });
});

describe('promotions keep m01 and m13 behaviour', () => {
  it('m01/careerGraph re-exports the domain module', () => {
    expect(reachable(T.career_paths, 'local-operator').get('reactor-operator')).toBe(1);
    const p = findPaths(T.career_paths, 'local-operator', 'senior-reactor-operator')[0];
    expect(p.length).toBeGreaterThan(0);
    expect(p[p.length - 1].to_role_id).toBe('senior-reactor-operator');
  });
  it('the Dalil index is the promoted SearchEngine', () => {
    const docs = [{ id: 'a', kind: 'faq', title: { en: 'Radiation protection basics', ar: 'أساسيات الوقاية من الإشعاع' }, text: { en: 'Dose limits and ALARA', ar: 'حدود الجرعات' } }];
    expect(new DalilIndex(docs as never)).toBeInstanceOf(SearchIndex);
    expect(new SearchIndex(docs).search('radiation protection')[0].doc.id).toBe('a');
  });
});
