/** FS56 Skill-change effectiveness + FS57 Curriculum coverage scorer and gap-filling backlog (FS wave F · E4, M25): one named test per
 *  acceptance criterion on the local path, plus the shared rules, RBAC, the seed, routes and i18n. The SQL path (kafaa_sc_* = skillChange.ts,
 *  kafaa_cov_* = coverage.ts, RLS, RPC flows, grants, additivity) is proved by scripts/validate/fs64-skill-change-coverage.mjs (PGlite).
 *
 *  FS56  1 courses with fewer than 10 completers show "suppressed"
 *        2 TS and SQL agree on the seed (stored rows = the rule; SQL = TS in PGlite)
 *        3 each measured course states its comparison method and window
 *  FS57  1 coverage reproduces from the rule
 *        2 every uncovered skill appears in the backlog with an owner
 *        3 a what-if course raises the score by exactly the amount the rule predicts and is not saved unless confirmed */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { hasKey } from '../../src/i18n';
import { grantsFor, type PlatformRole } from '../../src/auth/policy';
import { checkGuard } from '../../src/auth/guards';
import { SCHEMA } from '../../src/data/schema';
import { todayIso } from '../../src/domain/rules';
import { OWNER_ROLES } from '../../src/domain/taxonomy';
import { MIN_N, WINDOW_DAYS, levelAt, evidenceIndex, participantsOf, plusDays, skillChange, skillChangeReportOf, skillChangeWorld, type SkillChangeWorld } from '../../src/modules/m25/skillChange';
import {
  LEARN_CEILING, backlogNeeds, backlogToCreate, courseSkills, coverage, coverageReport, decisionProblem, defaultOwner, restrictedSkills, scoreReqs, taughtBy, whatIf,
  type CoverageReport, type CoverageWorld,
} from '../../src/modules/m25/coverage';
import { FS56_MSG } from '../../src/modules/m25/backend/local.fs56';
import { routes } from '../../src/modules/m25/routes';
import en from '../../src/i18n/m25.en.json';
import ar from '../../src/i18n/m25.ar.json';
import seed from '../../src/seed/seed.json';

vi.setConfig({ testTimeout: 90000, hookTimeout: 120000 });
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const S = seed as unknown as { tables: Record<string, Row[]>; meta: { demo_today: string } };
const T = S.tables;
const NOW = S.meta.demo_today;
const cw = (tables: Record<string, Row[]>): CoverageWorld => ({
  skills: tables.skills, competencies: tables.competencies, courses: tables.courses, course_skill_links: tables.course_skill_links, pathways: tables.pathways, pathway_gaps: tables.pathway_gaps,
  external_resources: tables.external_resources, job_roles: tables.job_roles, role_profile_versions: tables.role_profile_versions,
});
let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
const raw = (t: string) => b.raw(t as never) as unknown as Row[];
const strip = (rows: Row[]) => rows.map(({ computed_at, computed_by, ...r }) => r); // eslint-disable-line @typescript-eslint/no-unused-vars
beforeAll(async () => { b = new LocalBackend(); await b.whenReady(); await b.reset(); });

// a tiny synthetic world: one course teaching one skill; participants and colleagues with dated evidence
const mini = (n: number, opts: { measuredDays?: number; colleagues?: number } = {}): SkillChangeWorld => {
  const people: Row[] = [], tr: Row[] = [], ev: Row[] = [];
  const done = plusDays('2026-10-08', -(opts.measuredDays ?? 120));
  for (let i = 1; i <= n; i++) {
    people.push({ id: `p${i}`, kind: 'staff', status: 'active' });
    tr.push({ id: `tr${i}`, person_id: `p${i}`, course_id: 'c-x', completed_on: done, result: 'passed' });
    ev.push({ person_id: `p${i}`, skill_id: 'sk-x', level: 1, basis: 'evidenced', observed_on: plusDays(done, -30), ref_table: 'attempts', ref_id: `a${i}` });
    ev.push({ person_id: `p${i}`, skill_id: 'sk-x', level: 1, basis: 'evidenced', observed_on: done, ref_table: 'training_records', ref_id: `tr${i}` }); // own record: never counts
    if (i % 2 === 0) ev.push({ person_id: `p${i}`, skill_id: 'sk-x', level: 2, basis: 'evidenced', observed_on: plusDays(done, 40), ref_table: 'attempts', ref_id: `b${i}` });
    ev.push({ person_id: `p${i}`, skill_id: 'sk-x', level: 4, basis: 'claimed', observed_on: plusDays(done, 10), ref_table: 'skill_claims', ref_id: `c${i}` }); // self-claims never count
  }
  for (let j = 1; j <= (opts.colleagues ?? 0); j++) {
    people.push({ id: `q${j}`, kind: 'staff', status: 'active' });
    ev.push({ person_id: `q${j}`, skill_id: 'sk-x', level: 1, basis: 'evidenced', observed_on: plusDays(done, -60), ref_table: 'attempts', ref_id: `qa${j}` });
    if (j <= 2) ev.push({ person_id: `q${j}`, skill_id: 'sk-x', level: 2, basis: 'validated', observed_on: plusDays(done, 30), ref_table: 'skill_checkins', ref_id: `qc${j}` });
  }
  return {
    skills: [{ id: 'sk-x', competency_id: 'xx', core: false, key_level: 2, evidence_keys: ['c-x'], area: 'digital' }], competencies: [], courses: [{ id: 'c-x', competency_ids: [], qualifying: true, audience: 'staff' }],
    course_skill_links: [], pathways: [], training_records: tr, enrolments: [], pathway_enrolments: [], evidence: ev, people,
  };
};

describe('FS56 · skill change (acceptance)', () => {
  it('acceptance FS56-1: courses with fewer than 10 completers show "suppressed" (nothing else, in the rule, the seed and the RPC)', async () => {
    const r9 = skillChange(mini(9, { colleagues: 12 }), NOW)[0];
    expect(r9.verdict).toBe('suppressed');
    expect([r9.completers, r9.measured, r9.before_x100, r9.after_x100, r9.change_x100, r9.moved_pct, r9.comparison_people, r9.net_x100, r9.method]).toEqual([null, null, null, null, null, null, null, null, null]);
    expect(r9.skills.every((s) => s.before_x100 === null && s.pairs === null)).toBe(true);
    expect(r9.reasons.map((x) => x.code)).toEqual(['sc_suppressed']);
    const r10 = skillChange(mini(10, { colleagues: 12 }), NOW)[0];
    expect(r10.completers).toBe(10);
    await as('chco');
    const rep = await b.rpc.skillChangeReport();
    expect(rep.ok).toBe(true);
    const small = rep.data!.rows.filter((x) => x.suppressed);
    expect(small.length).toBeGreaterThan(0);
    expect(small.every((x) => x.completers === null && x.change_x100 === null && x.verdict === 'suppressed')).toBe(true);
    const counts = rep.data!.rows.flatMap((x) => [x.completers, x.measured, x.comparison_people, ...x.skills.map((s) => s.pairs)]).filter((v) => v !== null) as number[];
    expect(counts.every((v) => v >= MIN_N)).toBe(true);
  });

  it('acceptance FS56-2: the stored table reproduces from the rule on the seed (SQL = TS is proved in PGlite by fs64-skill-change-coverage.mjs)', () => {
    const rows = skillChange(skillChangeWorld(T), NOW);
    expect(rows.length).toBe(T.skill_change_measures.length);
    expect(JSON.stringify(strip(T.skill_change_measures))).toBe(JSON.stringify(rows));
    expect(rows.some((r) => r.method === 'matched') && rows.some((r) => r.verdict === 'moves') && rows.some((r) => r.verdict === 'window_open')).toBe(true);
  });

  it('acceptance FS56-3: each measured course states its comparison method and window', async () => {
    await as('k-auditor');
    const rep = (await b.rpc.skillChangeReport()).data!;
    const measured = rep.rows.filter((r) => r.change_x100 !== null);
    expect(measured.length).toBeGreaterThanOrEqual(8);
    expect(measured.every((r) => (r.method === 'matched' || r.method === 'before_after') && r.window_days === WINDOW_DAYS && r.reasons.some((x) => x.code === 'sc_matched' || x.code === 'sc_no_comparison') && r.reasons.some((x) => x.code === 'sc_change' && x.vars?.days === 90))).toBe(true);
    expect(rep.window_days).toBe(90);
    for (const k of ['m25.sc.method.matched', 'm25.sc.method.before_after', 'm25.sc.methodText.matched', 'm25.sc.methodText.before_after', 'm25.sc.windowDays']) expect(hasKey(k)).toBe(true);
  });
});

describe('FS56 · the rule', () => {
  it('before is the day before the learning started, after is 90 days after completion; the completion record itself and self-claims never count', () => {
    const w = mini(12, { colleagues: 12 });
    const r = skillChange(w, NOW)[0];
    // every participant held level 1 from an earlier attempt (own course record ignored, claims ignored); half reached level 2 within 90 days
    expect(r.before_x100).toBe(100);
    expect(r.after_x100).toBe(150);
    expect(r.change_x100).toBe(50);
    expect(r.moved_pct).toBe(50);
    const ix = evidenceIndex(w.evidence);
    const p = participantsOf(w).get('course:c-x')!.get('p1')!;
    expect(levelAt(ix, 'p1', 'sk-x', p.done, false)).toBe(2 - 1); // own record (level 1) excluded? no: the earlier attempt is level 1
    expect(levelAt(ix, 'p1', 'sk-x', plusDays(p.done, 10), false, [])).toBe(1); // a level-4 self-claim never counts
  });
  it('matched comparison: colleagues with the same starting level over the same window; net = change minus theirs; under 10 colleagues it is before/after only', () => {
    const m = skillChange(mini(12, { colleagues: 12 }), NOW)[0];
    expect(m.method).toBe('matched');
    expect(m.comparison_people).toBe(12);
    expect(m.comparison_change_x100).toBe(17); // 2 of 12 colleagues moved 1 level: 0.1667
    expect(m.net_x100).toBe(33);
    expect(m.verdict).toBe('moves');
    const n = skillChange(mini(12, { colleagues: 5 }), NOW)[0];
    expect(n.method).toBe('before_after');
    expect(n.comparison_people).toBeNull();
    expect(n.net_x100).toBeNull();
    expect(n.reasons.find((x) => x.code === 'sc_no_comparison')?.vars).toEqual({ min: 10 });
  });
  it('a participant counts once their 90 days have passed; until 10 have, the item says when the tenth window closes', () => {
    const r = skillChange(mini(12, { measuredDays: 30 }), NOW)[0];
    expect(r.verdict).toBe('window_open');
    expect(r.measured).toBeNull();
    expect(r.next_on).toBe(plusDays(plusDays(NOW, -30), 90));
    expect(r.reasons[0].vars).toEqual({ min: 10, days: 90, date: r.next_on });
  });
  it('the report adds titles, sorts by kind then item and keeps the stored numbers', () => {
    const rep = skillChangeReportOf(T.skill_change_measures, T.courses, T.pathways, false);
    expect(rep.rows.map((r) => `${r.kind}:${r.item_id}`)).toEqual([...rep.rows.map((r) => `${r.kind}:${r.item_id}`)].sort());
    expect(rep.rows.every((r) => r.title_en && r.title_ar)).toBe(true);
    expect(rep.can_compute).toBe(false);
    expect(rep.as_of).toBe(NOW);
  });
  it('security-area skills are never measured (the security awareness course is left out)', () => {
    const restricted = restrictedSkills(T.skills, T.competencies);
    expect(T.skill_change_measures.flatMap((r) => r.skills.map((s: Row) => s.skill_id)).some((s: string) => restricted.has(s))).toBe(false);
    expect(T.skill_change_measures.some((r) => r.item_id === 'c-sec-aw')).toBe(false);
  });
});

describe('FS57 · coverage (acceptance)', () => {
  it('acceptance FS57-1: coverage reproduces from the rule (the RPC returns exactly coverage() over the live tables)', async () => {
    await as('sro');
    const r = await b.rpc.curriculumCoverage();
    expect(r.ok).toBe(true);
    const rep = r.data as CoverageReport;
    const cov = coverage(cw(T));
    expect(JSON.stringify(rep.roles)).toBe(JSON.stringify(cov.roles));
    expect(rep.roles.filter((x) => x.horizon === 'now').length).toBe(28);
    expect(rep.roles.some((x) => x.path_only && x.score === null)).toBe(true);
    // recompute every score by hand from its requirements
    for (const x of rep.roles.filter((y) => !y.path_only)) {
      const num = x.reqs.reduce((s, q) => s + q.weight * Math.min(q.taught, q.target) * (2 / q.target), 0);
      const den = x.reqs.reduce((s, q) => s + q.weight * 2, 0);
      expect(x.score).toBe(Math.round((100 * num) / den));
    }
    expect(rep.can_edit).toBe(false);
    expect(rep.staff).toEqual([]);
  });

  it('acceptance FS57-2: every uncovered skill appears in the backlog with an owner (seed, and after a new FS17 gap is synced)', async () => {
    const cov = coverage(cw(T));
    const needs = backlogNeeds(cov.roles, T.pathway_gaps, restrictedSkills(T.skills, T.competencies));
    const rows = new Map(T.gap_backlog.map((r) => [r.id, r]));
    const uncovered = cov.roles.flatMap((r) => r.reqs.filter((q) => q.taught < q.target).map((q) => `gb:${q.skill_id}:${q.target}`));
    expect(uncovered.length).toBeGreaterThan(10);
    for (const id of uncovered) { expect(rows.has(id)).toBe(true); expect((OWNER_ROLES as readonly string[]).includes(rows.get(id)!.owner_role)).toBe(true); }
    expect(needs.every((n) => rows.has(n.id))).toBe(true);
    expect(backlogToCreate(cw(T), new Set(rows.keys()))).toEqual([]);
    await as('training-mgr');
    const fresh = T.skills.find((s) => s.area !== 'security' && !rows.has(`gb:${s.id}:3`))!;
    b.rawInsert('pathway_gaps' as never, { id: 'pg:fs64-unit', pathway_id: 'pw-tr-analytical-l1', step_id: 'pw-tr-analytical-l1:v1:s9', skill_id: fresh.id, level: 3, kind: 'assess', status: 'open', first_seen: NOW, last_checked: NOW, filled_on: null } as never);
    const s = await b.rpc.syncGapBacklog();
    expect(s.ok && s.data!.created).toBe(1);
    const row = b.rawGet('gap_backlog' as never, `gb:${fresh.id}:3`) as unknown as Row;
    expect(row.owner_role).toBe(defaultOwner(fresh));
    expect(row.status).toBe('open');
    const again = await b.rpc.syncGapBacklog();
    expect(again.ok && again.data!.created).toBe(0);
  });

  it('acceptance FS57-3: a what-if course raises the score by exactly the amount the rule predicts and is not saved unless confirmed', async () => {
    await b.reset();
    await as('training-mgr');
    const before = (await b.rpc.curriculumCoverage()).data!;
    const target = before.backlog.find((x) => x.state === 'open' && x.roles.length > 1)!;
    const predicted = whatIf(before.roles, target.skill_id, 2);
    expect(predicted.length).toBeGreaterThan(0);
    // computing the what-if writes nothing
    expect(JSON.stringify(raw('gap_backlog'))).toBe(JSON.stringify(T.gap_backlog));
    // the confirmed decision stores the prediction (and writes the ledger)
    const led0 = raw('ledger_local').length;
    const d = await b.rpc.decideGap({ id: target.id, owner_role: 'nuclear_training', owner_person_id: 'p-training-mgr', due_on: plusDays(todayIso(), 120), route: 'build', rationale: 'Build a blended module with our instructors', plan: { title: 'Blended module', level: 2, hours: 12 } });
    expect(d.ok).toBe(true);
    expect(JSON.stringify(d.data!.predicted)).toBe(JSON.stringify(predicted));
    expect(raw('ledger_local').length).toBe(led0 + 1);
    expect((b.rawGet('gap_backlog' as never, target.id) as unknown as Row).status).toBe('decided');
    // nothing moved yet: the plan is not a course
    const mid = (await b.rpc.curriculumCoverage()).data!;
    expect(JSON.stringify(mid.roles)).toBe(JSON.stringify(before.roles));
    // once the course exists, every predicted role moves by exactly the predicted amount, and no other role moves
    b.rawInsert('courses' as never, { id: 'c-fs64-unit', code: 'FS64-U', title_en: 'What-if course', title_ar: 'دورة الافتراض', modality: 'classroom', audience: 'staff', competency_ids: [], qualifying: false } as never);
    b.rawInsert('course_skill_links' as never, { id: 'csl-fs64-unit', course_id: 'c-fs64-unit', skill_id: target.skill_id, level: 2, objective_n: 1, objective_en: 'Test', objective_ar: 'اختبار', active: true } as never);
    const after = (await b.rpc.curriculumCoverage()).data!;
    const moved = after.roles.map((r, i) => ({ r, d: (r.score ?? 0) - (before.roles[i].score ?? 0) })).filter((x) => x.d !== 0).map((x) => ({ role_id: x.r.role_id, horizon: x.r.horizon, delta: x.d }));
    expect(moved).toEqual(predicted.map((m) => ({ role_id: m.role_id, horizon: m.horizon, delta: m.delta })));
    await b.reset();
  });
});

describe('FS57 · the rule', () => {
  it('the catalogue teaches up to level 2: a level-4 need is fully covered by a level-2 course; half a target counts half; core skills weigh twice', () => {
    expect(LEARN_CEILING).toBe(2);
    const reqs = [{ skill_id: 'a', need: 4, weight: 2 }, { skill_id: 'b', need: 2, weight: 1 }, { skill_id: 'c', need: 1, weight: 1 }];
    const s = scoreReqs(reqs, (k) => ({ a: 2, b: 1, c: 0 } as Record<string, number>)[k] ?? 0);
    expect(s.reqs.map((q) => [q.target, q.credit])).toEqual([[2, 2], [2, 1], [1, 0]]);
    expect(s.score).toBe(Math.round((100 * (2 * 2 + 1 * 1 + 0)) / (2 * 2 + 1 * 2 + 1 * 2)));
    expect(s.covered).toBe(1);
  });
  it('"taught by" (shared with FS56): F01 mapping, FS19 links, pathways only with a filled learn step, published externals; supplier courses and security skills never count', () => {
    const restricted = restrictedSkills(T.skills, T.competencies);
    const taught = taughtBy(cw(T));
    expect([...taught.keys()].some((s) => restricted.has(s))).toBe(false);
    expect([...taught.values()].flat().some((i) => i.kind === 'course' && T.courses.find((c) => c.id === i.id)?.audience === 'supplier')).toBe(false);
    const openLearn = new Set(T.pathway_gaps.filter((g) => g.status === 'open' && g.kind === 'learn').map((g) => g.pathway_id));
    expect([...taught.values()].flat().filter((i) => i.kind === 'pathway').every((i) => !openLearn.has(i.id))).toBe(true);
    expect([...taught.values()].flat().some((i) => i.kind === 'external')).toBe(true);
    const plantdata = courseSkills(T.courses.find((c) => c.id === 'c-fs-plantdata')!, T.skills, T.course_skill_links, restricted);
    expect(plantdata.size).toBeGreaterThanOrEqual(2);
  });
  it('decision checks: route, owner function, active-staff lead, due date up to 2030, rationale 10-500, plan shape', () => {
    const row = T.gap_backlog[0];
    const staff = (id: string) => T.people.some((p) => p.id === id && p.kind === 'staff' && p.status === 'active');
    const ok = { id: row.id, route: 'buy', owner_role: 'quality', owner_person_id: '', due_on: '2027-01-31', rationale: 'Licensed seats are cheaper than building', plan: null };
    expect(decisionProblem(ok, row, NOW, staff)).toBeNull();
    expect(decisionProblem(ok, undefined, NOW, staff)).toBe('not_found');
    expect(decisionProblem({ ...ok, route: 'lease' }, row, NOW, staff)).toBe('route');
    expect(decisionProblem({ ...ok, owner_role: 'hr' }, row, NOW, staff)).toBe('owner');
    expect(decisionProblem({ ...ok, owner_person_id: 'ap-001' }, row, NOW, staff)).toBe('person');
    expect(decisionProblem({ ...ok, due_on: '2031-01-01' }, row, NOW, staff)).toBe('due');
    expect(decisionProblem({ ...ok, due_on: '2026-01-01' }, row, NOW, staff)).toBe('due');
    expect(decisionProblem({ ...ok, rationale: 'short' }, row, NOW, staff)).toBe('rationale');
    expect(decisionProblem({ ...ok, plan: { title: 'ok title', level: 5, hours: 3 } }, row, NOW, staff)).toBe('plan');
  });
  it('the seeded decisions carry route, owner, date, bilingual rationale and the moves the rule predicts on the final seed', () => {
    const roles = coverage(cw(T)).roles;
    const decided = T.gap_backlog.filter((r) => r.status === 'decided');
    expect(decided.length).toBe(6);
    expect(new Set(decided.map((r) => r.route))).toEqual(new Set(['build', 'partner', 'buy']));
    for (const r of decided) {
      expect(r.rationale.length).toBeGreaterThanOrEqual(10);
      expect(r.rationale_ar.length).toBeGreaterThanOrEqual(10);
      expect(JSON.stringify(r.predicted)).toBe(JSON.stringify(whatIf(roles, r.skill_id, r.plan ? r.plan.level : r.level)));
    }
  });
  it('the report gives the backlog its live state: covered when nothing needs a row any more', () => {
    const rep = coverageReport({ ...cw(T), people: T.people, gap_backlog: [...T.gap_backlog, { ...T.gap_backlog[0], id: 'gb:sk-zz:1', skill_id: 'sk-zz', level: 1, status: 'open' }] }, NOW, true);
    expect(rep.backlog.find((x) => x.id === 'gb:sk-zz:1')!.state).toBe('covered');
    expect(rep.backlog.filter((x) => x.status === 'decided').every((x) => x.state === 'planned')).toBe(true);
    expect(rep.staff.length).toBeGreaterThan(50);
  });
});

describe('FS56/FS57 · RBAC and refusals (local path)', () => {
  it('reads are for learning-analytics aggregate holders; only the training manager recomputes, syncs and decides', async () => {
    await b.reset();
    await as('nse');
    expect((await b.rpc.skillChangeReport()).code).toBe('forbidden');
    expect((await b.rpc.curriculumCoverage()).message).toBe(FS56_MSG.forbidden_report);
    await as(null);
    expect((await b.rpc.curriculumCoverage()).code).toBe('not_signed_in');
    await as('chco');
    expect((await b.rpc.curriculumCoverage()).ok).toBe(true);
    expect((await b.rpc.computeSkillChange()).code).toBe('forbidden');
    expect((await b.rpc.syncGapBacklog()).code).toBe('forbidden');
    expect((await b.rpc.decideGap({ id: T.gap_backlog[0].id, owner_role: 'quality', due_on: '2027-01-31', route: 'buy', rationale: 'A valid rationale here' })).code).toBe('forbidden');
    await as('training-mgr');
    const c = await b.rpc.computeSkillChange();
    expect(c.ok).toBe(true);
    expect(c.data!.rows).toBe(T.skill_change_measures.length);
    expect(JSON.stringify(strip(raw('skill_change_measures')).sort((x, y) => (x.id < y.id ? -1 : 1)))).toBe(JSON.stringify(skillChange(skillChangeWorld(Object.fromEntries(['skills', 'competencies', 'courses', 'course_skill_links', 'pathways', 'training_records', 'enrolments', 'pathway_enrolments', 'skill_evidence', 'people'].map((n) => [n, raw(n)]))), todayIso()).sort((x, y) => (x.id < y.id ? -1 : 1))));
    const bad = await b.rpc.decideGap({ id: T.gap_backlog[0].id, owner_role: 'quality', due_on: '2031-01-31', route: 'buy', rationale: 'A valid rationale here' });
    expect([bad.code, bad.message]).toEqual(['invalid', FS56_MSG.due]);
    expect((await b.rpc.decideGap({ id: 'gb:nothing:1', owner_role: 'quality', due_on: '2027-01-31', route: 'buy', rationale: 'A valid rationale here' })).code).toBe('not_found');
    await b.reset();
  });
});

describe('FS56/FS57 · schema, routes, guards and i18n', () => {
  it('two new tables (rpc writes; aggregate readers) and three routes guarded by learning_analytics Agg/R/A', () => {
    expect(SCHEMA.skill_change_measures.write.mode).toBe('rpc');
    expect(SCHEMA.gap_backlog.write.mode).toBe('rpc');
    const ids = ['training-skill-change', 'training-coverage', 'training-coverage-backlog'];
    for (const id of ids) {
      const r = routes.find((x) => x.id === id)!;
      expect(r).toBeTruthy();
      expect(hasKey(`m25.routes.${id}.title`) && hasKey(`m25.routes.${id}.purpose`)).toBe(true);
      const can = (rs: PlatformRole[]) => checkGuard(r.guard, { status: 'signed_in', roles: rs } as never) === 'ok';
      expect(can(['employee', 'hr_analyst'] as PlatformRole[])).toBe(true);
      expect(can(['employee', 'manager'] as PlatformRole[])).toBe(true);
      expect(can(['auditor'] as PlatformRole[])).toBe(true);
      expect(can(['employee'] as PlatformRole[])).toBe(false);
      expect(can(['partner_user'] as PlatformRole[])).toBe(false);
    }
    expect(grantsFor(['training_manager'], 'learning_analytics').has('A')).toBe(true);
  });
  it('every FS56/FS57 string exists in English and Arabic (reason keys included)', () => {
    const flat = (o: Row, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [`${p}${k}`]));
    const e = flat(en as Row).filter((k) => /^(sc|cov|gb|dec)\.|^reasons\.(sc|gb)_/.test(k));
    const a = new Set(flat(ar as Row));
    expect(e.length).toBeGreaterThan(200);
    expect(e.filter((k) => !a.has(k))).toEqual([]);
    for (const code of ['sc_suppressed', 'sc_window', 'sc_change', 'sc_moved', 'sc_matched', 'sc_no_comparison', 'sc_verdict_moves', 'sc_verdict_some', 'sc_verdict_flat', 'gb_covered', 'gb_roles', 'gb_gaps']) expect(hasKey(`m25.reasons.${code}`)).toBe(true);
  });
});
