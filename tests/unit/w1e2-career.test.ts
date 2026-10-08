/** W1 · E2 acceptance: F05 Career Navigator and F06 Career Roadmap. Local path; the SQL path is scripts/validate/w1e2-career.mjs (PGlite). */
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { careerReadiness, careerFacts, readinessScore, competencyLevelsOf, evaluateRoutes, reachableRoles, READY_NOW, type CareerData } from '../../src/modules/m18/career';
import { buildRoadmap, routeOptions, roadmapCsv, developmentBlocks, addDays, nextIntake, DEFAULT_SCENARIO, type RoadmapInput } from '../../src/modules/m18/roadmap';
import { careerDataFrom } from '../../src/modules/m18/backend/local';
import { byCosine, careerMoves, lintRanked, readiness, roleVector } from '../../src/domain/engines';
import { checkGuard } from '../../src/auth/guards';
import { ROUTES } from '../../src/routes/registry';
import { hasKey, translate } from '../../src/i18n';
import seed from '../../src/seed/seed.json';

const T = (seed as unknown as { tables: Record<string, any[]>; meta: { demo_today: string } }).tables;
const NOW = (seed as unknown as { meta: { demo_today: string } }).meta.demo_today;
const DATA: CareerData = {
  people: T.people, roles: T.job_roles, edges: T.career_paths, roleComps: T.role_competencies, competencies: T.competencies, skills: T.skills, states: T.person_skills,
  licences: T.licences, standards: T.qual_standards, qualRecords: T.qual_records, programmes: T.programmes, courses: T.courses, trainingRecords: T.training_records, enrolments: T.enrolments,
  weights: T.engine_settings.find((s) => s.id === 'recommend')?.weights,
};
const ROLE_IDS = T.job_roles.map((r) => r.id);
const SECURITY = T.job_roles.filter((r) => r.security_sensitive).map((r) => r.id);
const roadmapInput = (person: string, target: string, now = NOW): RoadmapInput => {
  const f = careerFacts(DATA, person, now);
  return { now, roleId: f.role_id!, monthsInRole: f.months_in_role, qualifiedInRole: f.qualified_in_role, edges: T.career_paths, roles: T.job_roles, programmes: T.programmes, sources: T.sources, gapCourses: [], leadershipCourse: T.courses.find((c) => c.id === 'c-intilaqa') };
};

let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});

describe('F05 readiness rules', () => {
  it('k-ro sees SRO with a gate list holding the three SRO routes and article references, plus a readiness % with reasons', () => {
    const [sro] = careerReadiness(DATA, 'p-k-ro', ['senior-reactor-operator'], NOW);
    const codes = sro.routes.map((r) => r.route_code);
    expect(codes).toEqual(expect.arrayContaining(['sro_ro24', 'sro_bsc', 'sro_other_plant']));
    for (const r of sro.routes.filter((x) => ['sro_ro24', 'sro_bsc', 'sro_other_plant'].includes(x.route_code ?? ''))) expect(r.rule_ref).toMatch(/FANR-REG-17 Art\. 4/);
    expect(sro.routes[0].route_code).toBe('sro_ro24'); // the route from k-ro's own role comes first
    expect(sro.routes[0].conditions.find((c) => c.kind === 'months')?.status).toBe('met'); // 26 months as RO on the mirrored licence
    expect(sro.pct).toBeGreaterThan(0);
    expect(sro.reasons.map((r) => r.code)).toEqual(expect.arrayContaining(['readiness', 'gates_pending']));
    expect(lintRanked([{ id: 'x', score: 1, reasons: sro.reasons }])).toEqual([]);
  });

  it('gates never inflate readiness: a not-met gate keeps a fully skilled person from "ready now", and the % ignores gates', () => {
    // Give k-lo-trainee every competency at the RO level: readiness 100%, but the 36-month LO gate is not met.
    const full = T.role_competencies.filter((r) => r.role_id === 'reactor-operator').map((r) => ({ person_id: 'p-k-lo-trainee', skill_id: `sk-${r.competency_id}`, level: 4, active: true }));
    const d = { ...DATA, states: [...DATA.states.filter((s) => s.person_id !== 'p-k-lo-trainee'), ...full] };
    const [ro] = careerReadiness(d, 'p-k-lo-trainee', ['reactor-operator'], NOW);
    expect(ro.score).toBe(1);
    expect(ro.gate_status).toBe('not_met');
    expect(ro.band).not.toBe('ready_now');
    expect(ro.reasons.some((r) => r.code === 'gates_not_met')).toBe(true);
    // the same person once the gate is met (k-ro's licence months): with the same skills the band can be ready now
    const [sro] = careerReadiness({ ...DATA, states: [...DATA.states, ...T.role_competencies.filter((r) => r.role_id === 'senior-reactor-operator').map((r) => ({ person_id: 'p-k-ro', skill_id: `sk-${r.competency_id}`, level: 4, active: true }))] }, 'p-k-ro', ['senior-reactor-operator'], NOW);
    expect(sro.gate_status).not.toBe('not_met');
    expect(sro.band).toBe('ready_now');
    // and over the whole seed: no result is "ready now" with a not-met gate
    for (const p of T.people.filter((x) => x.kind === 'staff')) for (const r of careerReadiness(DATA, p.id, ROLE_IDS, NOW)) {
      if (r.gate_status === 'not_met') expect(r.band, `${p.id}/${r.role_id}`).not.toBe('ready_now');
      if (r.band === 'ready_now') expect(r.score!).toBeGreaterThanOrEqual(READY_NOW);
    }
  });

  it('readiness equals the F02 engine readiness for every role (same formula, same weights)', () => {
    const have = competencyLevelsOf(DATA, 'p-k-ro');
    for (const id of ROLE_IDS) expect(readinessScore(have, DATA.roleComps, id, DATA.weights).score).toBe(readiness(have, DATA.roleComps, id, DATA.weights).score);
  });

  it('security, safeguards and cyber roles show no % and no gate detail', () => {
    const out = careerReadiness(DATA, 'p-k-ro', SECURITY, NOW);
    expect(out.length).toBe(SECURITY.length);
    for (const r of out) {
      expect(r.pct).toBeNull();
      expect(r.band).toBe('path_only');
      expect(r.routes).toEqual([]);
      expect(r.reasons[0].key).toBe('common.engines.reason.path_only');
    }
  });

  it('at least one lateral suggestion carries a "similar skills" reason (roles like mine)', () => {
    for (const role of ['reactor-operator', 'chemistry-technician', 'procurement-engineer', 'quality-assurance-qc']) {
      const reach = reachableRoles(T.career_paths, role, 2);
      const cands = T.job_roles.filter((r) => r.id !== role && !reach.has(r.id) && !r.security_sensitive).map((r) => ({ id: r.id, vec: roleVector(T.role_competencies, r.id) }));
      const sim = byCosine(roleVector(T.role_competencies, role), cands, { min: 0.35 });
      expect(sim.length, role).toBeGreaterThan(0);
      expect(sim[0].reasons[0].code).toBe('similar');
      expect(lintRanked(sim)).toEqual([]);
    }
    const chem = byCosine(roleVector(T.role_competencies, 'chemistry-technician'), T.job_roles.filter((r) => r.id !== 'chemistry-technician').map((r) => ({ id: r.id, vec: roleVector(T.role_competencies, r.id) })));
    expect(chem.slice(0, 3).map((x) => x.id)).toContain('radiation-protection-technician');
  });

  it('every ranked list on the page has reasons with i18n keys in English and Arabic', () => {
    const have = competencyLevelsOf(DATA, 'p-k-ro');
    const moves = careerMoves({ from: 'reactor-operator', edges: T.career_paths, roleComps: T.role_competencies, have, maxSteps: 2, pathOnly: SECURITY });
    expect(moves[0].id).toBe('senior-reactor-operator');
    expect(lintRanked(moves)).toEqual([]);
    const keys = new Set<string>();
    for (const p of ['p-k-ro', 'p-k-lo-trainee', 'p-nse', 'p-qc-inspector']) for (const r of careerReadiness(DATA, p, ROLE_IDS, NOW)) for (const x of r.reasons) keys.add(x.key);
    for (const k of keys) {
      expect(hasKey(k), k).toBe(true);
      expect(translate('ar', k), k).not.toBe(translate('en', k));
    }
  });

  it('experience counts from the person\'s own records (licence, qualification or hire date)', () => {
    expect(careerFacts(DATA, 'p-k-ro', NOW)).toMatchObject({ role_since_basis: 'licence', months_in_role: 26, qualified_in_role: true });
    expect(careerFacts(DATA, 'p-k-lo-trainee', NOW)).toMatchObject({ role_since_basis: 'none', qualified_in_role: false, months_in_role: 0 });
    const lo = evaluateRoutes(DATA, careerFacts(DATA, 'p-k-lo-trainee', NOW), 'reactor-operator')[0];
    expect(lo.edge_id).toBe('lo-ro');
    expect(lo.conditions.find((c) => c.kind === 'months')).toMatchObject({ status: 'not_met', note: 'not_qualified_yet', remaining_months: 36 });
  });
});

describe('F05 local RPC and RBAC', () => {
  it('careerReadiness: self; the line manager in scope only when shared; others refused', async () => {
    await as('k-ro');
    const self = await b.rpc.careerReadiness('p-k-ro', ['senior-reactor-operator', 'security-officer']);
    expect(self.ok).toBe(true);
    expect(self.data!.map((r) => r.role_id)).toEqual(['senior-reactor-operator', 'security-officer']);
    expect(self.data).toEqual(careerReadiness(careerDataFrom(b, 'p-k-ro'), 'p-k-ro', ['senior-reactor-operator', 'security-officer'], new Date().toISOString().slice(0, 10)));
    expect((await b.rpc.careerReadiness('w-ro-01', ['senior-reactor-operator'])).code).toBe('forbidden');
    await as('sro');
    expect((await b.rpc.careerReadiness('p-k-ro', ['senior-reactor-operator'])).ok).toBe(true);
    const unshared = T.people.find((p) => p.crew === 'B' && p.kind === 'staff' && !['p-k-ro', 'p-sro'].includes(p.id) && !T.career_targets.some((t) => t.person_id === p.id && t.shared) && !T.roadmaps.some((r) => r.person_id === p.id && r.shared))!;
    expect((await b.rpc.careerReadiness(unshared.id, ['senior-reactor-operator'])).code).toBe('forbidden');
    await as('k-hr-analyst');
    expect((await b.rpc.careerReadiness('p-k-ro', ['senior-reactor-operator'])).code).toBe('forbidden');
    await as(null);
    expect((await b.rpc.careerReadiness('p-k-ro', ['senior-reactor-operator'])).code).toBe('not_signed_in');
  });

  it('the shortlist is own; a manager in scope reads it only while shared', async () => {
    await as('sro');
    const seen = await b.list('career_targets');
    expect(seen.some((x) => x.id === 'ct:p-k-ro:senior-reactor-operator')).toBe(true);
    expect(seen.some((x) => x.id === 'ct:p-k-ro:human-performance-specialist')).toBe(false);
    expect(seen.filter((x) => x.person_id !== 'p-sro').every((x) => x.shared)).toBe(true);
    await as('k-hr-analyst');
    expect((await b.list('career_targets')).filter((x) => x.person_id !== 'p-k-hr-analyst')).toEqual([]);
    await as('k-ro');
    const add = await b.insert('career_targets', { id: 'ct:p-k-ro:nuclear-oversight-npi', person_id: 'p-k-ro', role_id: 'nuclear-oversight-npi', rank: 3 });
    expect(add.ok).toBe(true);
    expect((await b.insert('career_targets', { id: 'ct:p-nse:x', person_id: 'p-nse', role_id: 'procurement-engineer' })).code).toBe('forbidden');
    expect((await b.update('career_targets', 'ct:p-k-ro:human-performance-specialist', { shared: true, shared_person_id: 'p-k-ro' })).ok).toBe(true);
    await as('sro');
    expect((await b.list('career_targets')).some((x) => x.id === 'ct:p-k-ro:human-performance-specialist')).toBe(true);
  });

  it('routes: signed-in staff only (anonymous visitors go to sign-in; partners are refused); the team view needs Scope', () => {
    const r = (id: string) => ROUTES.find((x) => x.id === id)!;
    for (const id of ['my-career', 'my-career-roadmap', 'team-career']) expect(checkGuard(r(id).guard, { status: 'anon', roles: ['public'] })).toBe('signin');
    expect(checkGuard(r('my-career').guard, { status: 'signed_in', roles: ['employee', 'licensed_operator'] })).toBe('ok');
    expect(checkGuard(r('my-career').guard, { status: 'signed_in', roles: ['partner_admin'] })).toBe('forbidden');
    expect(checkGuard(r('team-career').guard, { status: 'signed_in', roles: ['employee'] })).toBe('forbidden');
    expect(checkGuard(r('team-career').guard, { status: 'signed_in', roles: ['employee', 'manager'] })).toBe('ok');
  });
});

describe('F06 roadmap rules', () => {
  it('k-lo-trainee → RO: COIT with its published duration and source, and the FANR exam with the 60-day notice', () => {
    const input = roadmapInput('p-k-lo-trainee', 'reactor-operator');
    const path = routeOptions(T.career_paths, 'local-operator', 'reactor-operator')[0];
    expect(path.map((e) => e.id)).toEqual(['lo-ro']);
    const r = buildRoadmap(input, { path: path.map((e) => e.id), ...DEFAULT_SCENARIO });
    const coit = r.blocks.find((x) => x.kind === 'programme')!;
    expect(coit.title.en).toContain('COIT');
    expect(coit.weeks).toBe(91);
    expect(coit.indicative).toBe(false);
    expect(coit.source?.id).toBe('sr2024');
    const exam = r.blocks.find((x) => x.kind === 'fanr_exam')!;
    const notice = r.blocks.find((x) => x.kind === 'fanr_notice')!;
    expect(addDays(notice.start, 60)).toBe(exam.start);
    expect(notice.source?.id).toBe('fanr-reg17');
    expect(r.blocks.find((x) => x.kind === 'certification')!.start > exam.start).toBe(true);
    // not yet qualified as LO: qualification first, then the 36 months, then COIT at the next intake
    const exp = r.blocks.find((x) => x.kind === 'experience')!;
    expect(r.blocks[0].kind === 'qualify' || r.blocks.some((x) => x.kind === 'qualify')).toBe(true);
    expect(exp.months).toBe(36);
    expect(coit.start).toBe(nextIntake(exp.end));
  });

  it('moving the COIT start moves every dependent milestone; the start is never before the gates allow', () => {
    const input = roadmapInput('p-k-lo-trainee', 'reactor-operator');
    const base = buildRoadmap(input, { path: ['lo-ro'], ...DEFAULT_SCENARIO });
    const later = buildRoadmap(input, { path: ['lo-ro'], ...DEFAULT_SCENARIO, delayQ: 4 });
    const days = (a: string, c: string) => (Date.parse(c) - Date.parse(a)) / 86400000;
    const shift = days(base.blocks.find((x) => x.kind === 'programme')!.start, later.blocks.find((x) => x.kind === 'programme')!.start);
    expect(shift).toBeGreaterThan(360);
    for (const k of ['internal_exam', 'fanr_notice', 'fanr_exam', 'certification', 'move'] as const) expect(days(base.blocks.find((x) => x.kind === k)!.start, later.blocks.find((x) => x.kind === k)!.start), k).toBe(shift);
    expect(later.earliest).toBe(base.end);
    expect(later.end > base.end).toBe(true);
    // over every staff member, route and delay: no programme starts before its experience gate is complete
    for (const p of T.people.filter((x) => x.kind === 'staff' && x.job_role_id)) {
      for (const [to] of reachableRoles(T.career_paths, p.job_role_id, 3)) {
        for (const path of routeOptions(T.career_paths, p.job_role_id, to)) for (const delayQ of [0, 3]) for (const rotation of [false, true]) {
          const r = buildRoadmap(roadmapInput(p.id, to), { path: path.map((e) => e.id), ...DEFAULT_SCENARIO, delayQ, rotation });
          path.forEach((e, i) => {
            const gate = [r.blocks.find((x) => x.id === `exp-${i}`)?.end, i === 0 ? r.blocks.find((x) => x.id === 'qualify')?.end : undefined, i === 0 && rotation ? r.blocks.find((x) => x.id === 'dev-rotation')?.end : undefined].filter(Boolean) as string[];
            const prog = r.blocks.find((x) => x.id === `prog-${i}-0`);
            if (prog) for (const g of gate) expect(prog.start >= g, `${p.id} ${path.map((x) => x.id)} ${delayQ}`).toBe(true);
          });
        }
      }
    }
  });

  it('a rotation taken first pushes the intake back and joins the critical path (k-ro → SRO)', () => {
    const input = roadmapInput('p-k-ro', 'senior-reactor-operator');
    const a = buildRoadmap(input, { path: ['ro-sro'], ...DEFAULT_SCENARIO });
    const b2 = buildRoadmap(input, { path: ['ro-sro'], ...DEFAULT_SCENARIO, rotation: true });
    expect(b2.end > a.end).toBe(true);
    expect(b2.blocks.find((x) => x.kind === 'rotation')!.critical).toBe(true);
    expect(a.blocks.some((x) => x.kind === 'experience')).toBe(false); // 26 of 24 months already served
  });

  it('exports label durations from generic or sample sources as indicative', () => {
    const r = buildRoadmap(roadmapInput('p-k-ro', 'senior-reactor-operator'), { path: ['ro-sro'], ...DEFAULT_SCENARIO });
    const csv = roadmapCsv(r, 'en', { indicative: 'indicative', published: 'published', header: ['Block', 'Lane', 'Start', 'End', 'Duration', 'Basis', 'Source'] });
    const lines = csv.split('\r\n').slice(1);
    const prog = r.blocks.find((x) => x.kind === 'programme')!; // COIT-SRO content has no published length
    expect(prog.indicative).toBe(true);
    expect(lines.find((l) => l.includes(prog.title.en.replace(/"/g, '""')))).toContain('"indicative"');
    for (const blk of r.blocks.filter((x) => x.indicative)) expect(lines.some((l) => l.startsWith(`"${blk.title.en.replace(/"/g, '""')}"`) && l.includes('"indicative"'))).toBe(true);
    const lo = buildRoadmap(roadmapInput('p-k-lo-trainee', 'reactor-operator'), { path: ['lo-ro'], ...DEFAULT_SCENARIO });
    const loCsv = roadmapCsv(lo, 'ar', { indicative: 'استرشادي', published: 'منشور', header: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] });
    expect(loCsv).toContain('منشور');
    expect(loCsv).toContain('استرشادي');
  });
});

describe('F06 roadmapToPlan (local RPC)', () => {
  it('extends the open plan for the same target; re-sending does not duplicate; each call is audited', async () => {
    await as('k-ro');
    const auditsBefore = b.raw('audit_events').filter((a) => a.action === 'roadmap.to_plan').length;
    const dev = developmentBlocks({ blocks: T.roadmaps.find((r) => r.id === 'rm-k-ro-sro')!.plan as never });
    const r1 = await b.rpc.roadmapToPlan('rm-k-ro-sro');
    expect(r1.ok).toBe(true);
    expect(r1.data).toMatchObject({ plan_id: 'dp-k-ro', plan_created: false, created: dev.length, existing: 0 });
    expect(b.raw('plan_activities').filter((a) => a.plan_id === 'dp-k-ro' && a.id.startsWith('pa-rm-rm-k-ro-sro-')).length).toBe(dev.length);
    const r2 = await b.rpc.roadmapToPlan('rm-k-ro-sro');
    expect(r2.data).toMatchObject({ created: 0, existing: dev.length });
    expect(b.raw('plan_activities').filter((a) => a.id.startsWith('pa-rm-rm-k-ro-sro-')).length).toBe(dev.length);
    const audits = b.raw('audit_events').filter((a) => a.action === 'roadmap.to_plan' && a.outcome === 'ok');
    expect(audits.length - auditsBefore).toBe(2);
    expect(b.rawGet('roadmaps', 'rm-k-ro-sro')!.sent_plan_id).toBe('dp-k-ro');
  });

  it('with no open plan for the target it creates a draft plan with one activity per development block', async () => {
    await as('qc-inspector');
    const rm = T.roadmaps.find((r) => r.id === 'rm-qc-procurement')!;
    const dev = (rm.plan as { lane: string; plan_kind: string }[]).filter((x) => x.lane === 'development');
    const r = await b.rpc.roadmapToPlan(rm.id);
    expect(r.ok).toBe(true);
    expect(r.data!.plan_created).toBe(true);
    const plan = b.rawGet('dev_plans', r.data!.plan_id)!;
    expect(plan.status).toBe('draft');
    expect(plan.target_role_id).toBe('procurement-engineer');
    const acts = b.raw('plan_activities').filter((a) => a.plan_id === plan.id);
    expect(acts.length).toBe(dev.length);
    expect(acts.every((a) => a.status === 'planned')).toBe(true);
    expect(acts.map((a) => a.kind).sort()).toEqual(dev.map((x) => x.plan_kind).sort());
  });

  it('refuses another person\'s roadmap (not found), anonymous callers and roadmaps without development blocks', async () => {
    await as('sro');
    expect((await b.rpc.roadmapToPlan('rm-k-ro-sro')).code).toBe('not_found');
    await as(null);
    expect((await b.rpc.roadmapToPlan('rm-k-ro-sro')).code).toBe('not_signed_in');
    await as('k-ro');
    b.rawUpdate('roadmaps', 'rm-k-ro-sro', { plan: (b.rawGet('roadmaps', 'rm-k-ro-sro')!.plan as { lane: string }[]).filter((x) => x.lane !== 'development') } as never);
    expect((await b.rpc.roadmapToPlan('rm-k-ro-sro')).code).toBe('invalid');
  });

  it('the seed has shortlists and roadmaps for the demo personas, and every seeded roadmap is reproducible from its scenario', () => {
    expect(T.career_targets.filter((t) => t.person_id === 'p-k-ro' && t.active).length).toBe(3);
    expect(T.career_targets.length).toBeGreaterThan(50);
    expect(T.career_targets.every((t) => (t.shared ? t.shared_person_id === t.person_id : t.shared_person_id === null))).toBe(true);
    const byPerson = new Map<string, number>();
    for (const t of T.career_targets.filter((x) => x.active)) byPerson.set(t.person_id, (byPerson.get(t.person_id) ?? 0) + 1);
    expect(Math.max(...byPerson.values())).toBeLessThanOrEqual(3);
    for (const id of ['rm-k-ro-sro', 'rm-k-lo-ro', 'rm-k-lo-ro-later', 'rm-qc-procurement']) expect(T.roadmaps.some((r) => r.id === id), id).toBe(true);
    for (const rm of T.roadmaps) {
      expect(rm.scenario.delayQ, rm.id).toBeGreaterThanOrEqual(0);
      const prog = (rm.plan as { kind: string; start: string }[]).filter((x) => x.kind === 'programme');
      expect(rm.end_on >= (prog[prog.length - 1]?.start ?? NOW)).toBe(true);
    }
  });
});
