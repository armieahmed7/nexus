/** EMP-02: /my/plan suggested courses are ranked by the gap they help close (gap x importance) and leave out courses already done,
 *  enrolled or planned, and initial training below the person's current track stage. Checked on the seeded k-ro persona (a licensed
 *  Reactor Operator since 2018, target Senior Reactor Operator). */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import seed from '../../src/seed/seed.json';
import { hasKey, translate } from '../../src/i18n';
import { coursesBelowStage, IMPORTANCE_WEIGHT, ownCompetencyLevels, planGaps, rankPlanSuggestions, type PlanGap } from '../../src/modules/m04/plan';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const T = (seed as unknown as { tables: Record<string, Row[]> }).tables;
type RC = { id: string; role_id: string; competency_id: string; required_level: number; importance: string };
const INITIAL_CODES = /^(GET|ONB|LOIT|COIT|HU-101)/;

/** A role-to-role gap (target requirement minus the current role's), for the stage-rule cases that have no person. */
function gapsFor(current: string, target: string): PlanGap[] {
  const have = new Map(T.role_competencies.filter((x) => x.role_id === current).map((x) => [x.competency_id, x.required_level]));
  return T.role_competencies.filter((x) => x.role_id === target)
    .map((x) => ({ competency_id: x.competency_id, importance: x.importance, required_level: x.required_level, have: have.get(x.competency_id) ?? 0, gap: x.required_level - (have.get(x.competency_id) ?? 0) }))
    .filter((x) => x.gap > 0);
}
function inputFor(personId: string, opts: { enrolments?: boolean } = {}) {
  const p = T.people.find((x) => x.id === personId)!;
  const plan = T.dev_plans.find((d) => d.person_id === personId && d.status !== 'closed')!;
  return {
    // EMP-03: the page's gap rule, from the person's own skill states
    gaps: planGaps({ roleComps: T.role_competencies as RC[], targetRoleId: plan.target_role_id, currentRoleId: p.job_role_id, own: ownCompetencyLevels(T.person_skills.filter((x) => x.person_id === personId) as never[], T.skills as never[]) }),
    courses: T.courses as { id: string; code: string; audience: string; initial: boolean; competency_ids: string[]; duration_hours: number }[],
    planned: new Set(T.plan_activities.filter((a) => a.plan_id === plan.id && a.course_id).map((a) => a.course_id as string)),
    enrolments: (opts.enrolments === false ? [] : T.enrolments.filter((e) => e.person_id === personId)) as { course_id: string; status: string }[],
    roleId: p.job_role_id as string,
    quals: T.qual_records.filter((q) => q.person_id === personId) as { standard_id: string; status: string }[],
    standards: T.qual_standards as { id: string; role_ids: string[] }[],
    compName: (id: string) => { const c = T.competencies.find((x) => x.id === id); return c ? { en: c.name_en, ar: c.name_ar } : null; },
  };
}
const codes = (xs: { course: { code: string } }[]) => xs.map((x) => x.course.code);

describe('EMP-02 · k-ro (licensed Reactor Operator, target SRO)', () => {
  const x = inputFor('p-k-ro');
  const out = rankPlanSuggestions(x);

  it('the old rule (first 8 catalogue courses touching any gap) offered initial training: the case this fixes', () => {
    const gapIds = new Set(x.gaps.map((g) => g.competency_id));
    const old = x.courses.filter((c) => c.audience === 'staff' && (c.competency_ids ?? []).some((k) => gapIds.has(k)) && !x.planned.has(c.id)).slice(0, 8);
    expect(old.map((c) => c.code).some((c) => INITIAL_CODES.test(c))).toBe(true);
  });
  it('no initial-training course (GET, ONB, HU-101, LOIT, COIT) is suggested', () => {
    expect(out.length).toBeGreaterThan(0);
    expect(codes(out).filter((c) => INITIAL_CODES.test(c))).toEqual([]);
  });
  it('still none when the enrolment records are missing: the track stage alone rules out LOIT and COIT, and GET/ONB once established', () => {
    const bare = rankPlanSuggestions(inputFor('p-k-ro', { enrolments: false }));
    expect(codes(bare).filter((c) => INITIAL_CODES.test(c))).toEqual([]);
    const { below, hereIdx } = coursesBelowStage('reactor-operator');
    expect(hereIdx).toBeGreaterThan(0);
    for (const c of ['c-loit-sys', 'c-loit-ojt', 'c-coit-gf', 'c-coit-sim', 'c-coit-exam']) expect(below.has(c), c).toBe(true);
  });
  it('leaves out courses completed, enrolled or already on the plan (GET-101 completed, HU-101 in progress, COCT enrolled, INTILAQA planned)', () => {
    const ids = out.map((s) => s.course.id);
    for (const c of ['c-get', 'c-hu', 'c-coct', 'c-intilaqa']) expect(ids, c).not.toContain(c);
  });
  it('ranks by gap x importance, then the shorter course, then id; the top card builds a leadership or emergency-preparedness gap', () => {
    for (let i = 1; i < out.length; i++) expect(out[i - 1].score).toBeGreaterThanOrEqual(out[i].score);
    const top = out[0];
    expect(top.covers.some((g) => ['ld-01', 'ld-02', 'ep-01'].includes(g.competency_id))).toBe(true);
    expect(top.score).toBe(top.covers.reduce((s, g) => s + g.gap * IMPORTANCE_WEIGHT[g.importance], 0));
    expect(out.length).toBeLessThanOrEqual(8);
  });
  it('each card carries Why this? reasons that exist in English and Arabic', () => {
    for (const s of out) {
      expect(s.reasons.length).toBeGreaterThan(1);
      for (const r of s.reasons) expect(hasKey(r.key), r.key).toBe(true);
    }
    const r = out[0].reasons[0];
    const en = translate('en', r.key, { comp: (r.vars!.comp as { en: string }).en, need: Number(r.vars!.need), gap: Number(r.vars!.gap) });
    expect(en).toMatch(/^Builds .+ of the target role: level \d needed, gap of \d$/);
  });
});

describe('EMP-02 · the stage rule keeps the next stage', () => {
  it('a Local Operator aiming for Reactor Operator is not offered LOIT (behind them) but may be offered COIT (their next stage)', () => {
    const base = { gaps: gapsFor('local-operator', 'reactor-operator'), courses: T.courses as never[], planned: new Set<string>(), enrolments: [], roleId: 'local-operator', limit: 70 };
    const out = codes(rankPlanSuggestions(base));
    expect(out.filter((c) => c.startsWith('LOIT'))).toEqual([]);
    expect(out.some((c) => c.startsWith('COIT'))).toBe(true);
  });
  it('someone not on a track and not yet qualified can still be offered initial training', () => {
    const gaps: PlanGap[] = [{ competency_id: 'hu-01', gap: 2, have: 0, required_level: 2, importance: 'core' }];
    const out = rankPlanSuggestions({ gaps, courses: T.courses as never[], planned: new Set(), enrolments: [], roleId: null });
    expect(codes(out)).toContain('GET-101');
  });
});

describe('EMP-02 · page wiring and the honest "your level" label', () => {
  it('MyPlanPage uses the ranker and shows WhyThis on each suggestion', () => {
    const src = readFileSync('src/modules/m04/MyPlanPage.tsx', 'utf8');
    expect(src).toContain('rankPlanSuggestions({');
    expect(src).toContain('<WhyThis reasons={reasons} testId="m04-plan-why" />');
    expect(src).not.toContain('.slice(0, 8)');
  });
  it('the gap column says it is the current role\'s requirement, not the person\'s recorded level', () => {
    expect(translate('en', 'm04.plan.currentLevel')).toBe('Your current role asks for');
    expect(translate('en', 'm04.plan.gapIntro')).not.toMatch(/your recorded level/);
    expect(translate('ar', 'm04.plan.currentLevel')).toBe('ما يتطلبه دورك الحالي');
  });
});
