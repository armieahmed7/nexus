// @vitest-environment jsdom
/** FS81 Transition plans and ladder-rung protection (FS wave I · E3, M30): one named test per acceptance criterion on the local path,
 *  plus the rules shared with SQL (rungAlert, practiceOptions, planProblem, reviews, progress), RBAC (person and HR only: managers in
 *  scope, the training manager, HR analysts, auditors and admins get nothing), the RPC flows (activation needs practice for every
 *  ladder-rung task, reviews, acknowledgement, closing, self plan), the seed, routes and i18n. The SQL path (SQL = TS parity, RLS, RPC
 *  flows in a rolled-back transaction, check constraints, grants, additivity) is checked by scripts/validate/fs93-transition-plans.mjs. */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { SCHEMA } from '../../src/data/schema';
import { grantsFor } from '../../src/auth/policy';
import en from '../../src/i18n/m30.en.json';
import ar from '../../src/i18n/m30.ar.json';
import seed from '../../src/seed/seed.json';
import { routes } from '../../src/modules/m30/routes';
import { FEATURE_BENCHMARKS } from '../../src/domain/taxonomy';
import { todayIso } from '../../src/domain/rules';
import {
  OJT_REPS, REVIEW_WINDOW, SIM_REPS, TP_MSG, addDays, daysFrom, isDate, juniorTasks, planAlert, planProblem, practiceOptions, practiceProgress, reviewsOk, roleRungAlerts,
  rungAlert, rungsBelow, type PlanRow, type RungWorld,
} from '../../src/modules/m30/transition';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const T = (seed as unknown as { tables: Record<string, Row[]> }).tables;
const W: RungWorld = { roles: T.job_roles, maps: T.role_transformations, paths: T.career_paths, tasks: T.jta_tasks, levels: T.ai_capability_levels, taskSkills: T.jta_task_skills, skills: T.skills, scenarios: T.sim_scenarios } as never;
const PLANS = T.transition_plans as unknown as PlanRow[];
const AR = /[؀-ۿ]/;
const flat = (o: Row, p = ''): [string, string][] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [[`${p}${k}`, String(v)]]));

let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
const raw = (t: string) => b.raw(t as never) as unknown as Row[];
beforeEach(async () => {
  try { localStorage.clear(); } catch { /* ignore */ }
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});

const alertSro = planAlert({ target_role_id: 'senior-reactor-operator', protected_role_id: 'reactor-operator', horizon: '2030', practice: [] }, W);
const FULL = alertSro.tasks.map((t) => { const o = t.options[0]; return { task_id: t.task_id, kind: o.kind, ref_id: o.ref_id, reps: o.kind === 'simulator' ? SIM_REPS.def : OJT_REPS.def }; });
const start = addDays(todayIso(), 7);
const BASE = {
  person_id: 'w-ro-02', protected_role_id: 'reactor-operator', protected_until: addDays(start, 400), target_role_id: 'senior-reactor-operator', horizon: '2030', trigger: 'task_automation',
  start_on: start, end_on: addDays(start, 720), review_dates: [addDays(start, 150), addDays(start, 320)], note_en: 'Routine logging moves to tools.', note_ar: 'ينتقل التسجيل الروتيني إلى الأدوات.',
  retraining: [{ kind: 'course', ref_id: 'c-exec-sim', title_en: 'Executive Simulator Course', title_ar: 'دورة المحاكي التنفيذية', hours: 16, due_on: addDays(start, 120) }],
  practice: FULL, activate: true,
};

describe('FS81 acceptance', () => {
  it('FS81 acceptance: every alert names the tasks and the practice added', async () => {
    // seeded plans: every alert names each junior task (code, EN/AR title, why) and, for every non-draft plan, the practice added for it
    const firing = PLANS.map((p) => ({ p, a: planAlert(p, W) })).filter((x) => x.a.fires);
    expect(firing.length).toBe(9);
    for (const { p, a } of firing) {
      for (const t of a.tasks) {
        expect(t.code && t.title_en && AR.test(t.title_ar)).toBeTruthy();
        expect(t.reasons.map((r) => r.code)).toContain(t.rung === 'below' ? 'rung_task_below' : 'rung_task_own');
        expect(t.options.length).toBeGreaterThan(0);
        if (p.status !== 'draft') { expect(t.covered).toBe(true); expect(t.practice.length).toBeGreaterThan(0); }
      }
    }
    // a plan cannot become active while an alerted task has no practice; with practice, the view names tasks and practice
    await as('chco');
    const refused = await b.rpc.saveTransitionPlan({ ...BASE, practice: FULL.slice(1) });
    expect(refused.code).toBe('rung_practice_required');
    expect(refused.message).toBe(TP_MSG.rung_practice_required);
    const ok = await b.rpc.saveTransitionPlan(BASE);
    expect(ok.ok).toBe(true);
    const v = await b.rpc.transitionPlanView(ok.data!.id);
    expect(v!.alert.fires).toBe(true);
    expect(v!.alert.uncovered).toEqual([]);
    expect(v!.alert.tasks.map((t) => t.task_id)).toEqual(alertSro.tasks.map((t) => t.task_id));
    expect(v!.alert.tasks.every((t) => t.practice.length === 1 && t.practice[0].ref_id === FULL.find((x) => x.task_id === t.task_id)!.ref_id)).toBe(true);
    // role level (no person): each Mastery Builder role names its junior tasks and the practice to add
    await as('training-mgr');
    const roles = await b.rpc.rungAlerts('2030');
    expect(roles!.length).toBe(9);
    expect(roles!.filter((a) => a.fires).every((a) => a.tasks.every((t) => t.options.length > 0 && t.code))).toBe(true);
  });

  it('FS81 acceptance: plans are visible to the person and HR only (managers in scope, training manager, HR analysts, auditors and admins get nothing)', async () => {
    await as('k-ro');
    expect(raw('transition_plans').length).toBe(10); // raw store
    expect((await b.list('transition_plans')).map((r) => r.id)).toEqual(['tp-p-k-ro-1']);
    expect((await b.rpc.transitionPlanView(null))!.plan.id).toBe('tp-p-k-ro-1');
    expect(await b.rpc.transitionPlanView('tp-p-k-lo-trainee-1')).toBeNull();
    expect(await b.rpc.transitionPlans()).toBeNull();
    // the shift supervisor manages crew B (w-ro-01, w-lo-02 have plans) and reads only their own plan
    await as('sro');
    expect((await b.list('transition_plans')).map((r) => r.id)).toEqual(['tp-p-sro-1']);
    expect(await b.rpc.transitionPlanView('tp-w-ro-01-1')).toBeNull();
    expect(await b.rpc.transitionPlanView('tp-w-lo-02-1')).toBeNull();
    for (const p of ['sro', 'training-mgr', 'k-hr-analyst', 'k-auditor', 'k-admin', 'ops-ceo']) {
      await as(p);
      expect(await b.rpc.transitionPlans()).toBeNull();
      expect(await b.rpc.transitionCandidates()).toBeNull();
      expect(await b.rpc.transitionPlanView('tp-p-k-ro-1')).toBeNull();
      if (p !== 'sro') expect((await b.list('transition_plans')).length).toBe(0);
    }
    await as('chco');
    expect((await b.rpc.transitionPlans())!.length).toBe(10);
    expect((await b.list('transition_plans')).length).toBe(0); // HR reads through the RPCs only
    // the table names no `transformation` read rule (so manager Scope cannot reach it) and only HR holds transformation A
    expect(SCHEMA.transition_plans.read).toEqual([{ res: 'own_profile', person: 'person_id' }]);
    expect(grantsFor(['manager'], 'transformation').has('Scope')).toBe(true);
    for (const role of ['manager', 'training_manager', 'hr_analyst', 'auditor', 'admin', 'employee'] as const) expect(grantsFor([role], 'transformation').has('A')).toBe(false);
    expect(grantsFor(['hr_director'], 'transformation').has('A')).toBe(true);
    const hrRoutes = routes.filter((r) => ['workforce-transition-plans', 'workforce-transition-plan'].includes(r.id));
    expect(hrRoutes.every((r) => JSON.stringify(r.guard) === JSON.stringify({ signedIn: true, grant: { res: 'transformation', levels: ['A'] } }))).toBe(true);
  });

  it('FS81 acceptance: plans are labelled SIMULATED and carry review dates', async () => {
    expect(PLANS.length).toBe(10);
    for (const p of PLANS) {
      expect(p.simulated).toBe(true);
      expect(p.reviews.length).toBeGreaterThan(0);
      expect(reviewsOk(p.start_on, p.end_on, p.reviews.map((r) => r.due_on))).toBe(true);
      if (p.status === 'active') expect(isDate(p.next_review_on)).toBe(true);
    }
    await as('chco');
    expect((await b.rpc.saveTransitionPlan({ ...BASE, review_dates: [] })).code).toBe('reviews_required');
    expect((await b.rpc.saveTransitionPlan({ ...BASE, review_dates: [addDays(start, 200)] })).code).toBe('reviews_required'); // more than 183 days after the start
    const ok = await b.rpc.saveTransitionPlan(BASE);
    const row = raw('transition_plans').find((r) => r.id === ok.data!.id)!;
    expect(row.simulated).toBe(true);
    expect(row.reviews.map((r: Row) => r.due_on)).toEqual(BASE.review_dates);
    expect(row.next_review_on).toBe(BASE.review_dates[0]);
    expect(en.tp.simulated).toMatch(/SIMULATED/);
    expect(AR.test(ar.tp.simulated)).toBe(true);
  });
});

describe('FS81 rules (TS = SQL in PGlite)', () => {
  it('rungAlert: junior tasks are the rungs below plus own routine tasks that FS06 moves to tools by the horizon; Mastery Builder roles only', () => {
    expect(rungsBelow('senior-reactor-operator', W)).toEqual(['reactor-operator', 'local-operator']);
    expect(rungsBelow('local-operator', W)).toEqual([]);
    const sro = juniorTasks('senior-reactor-operator', '2030', W);
    expect(sro.every((t) => t.move === 'shrink' && t.horizon !== '2035')).toBe(true);
    expect(sro.filter((t) => t.rung === 'own').every((t) => !t.critical && t.role_id === 'senior-reactor-operator')).toBe(true);
    expect(sro.map((t) => t.code)).toContain('LO-WS-TB-T1'); // the routine operator round of the rung below
    expect(juniorTasks('chemistry-technician', '2035', W).length).toBeGreaterThan(juniorTasks('chemistry-technician', '2030', W).length); // 2035 adds later tasks
    expect(rungAlert('quality-assurance-qc', '2030', [], W).applies).toBe(false); // analytical specialist
    expect(rungAlert('security-officer', '2030', [], W).applies).toBe(false); // path-level only
    expect(roleRungAlerts('2030', W).map((a) => a.role_id)).toContain('local-operator');
    const opts = practiceOptions({ id: 'jt-qs-lo-turbine-t1', role_id: 'local-operator' }, 'senior-reactor-operator', W);
    expect(opts.some((o) => o.kind === 'simulator' && T.sim_scenarios.find((s) => s.id === o.ref_id)!.positions.includes('sro'))).toBe(true);
    expect(opts.find((o) => o.kind === 'ojt')!.ref_id).toBe('qs-lo-turbine-t1');
    expect(opts.every((o) => o.kind !== 'simulator' || T.sim_scenarios.find((s) => s.id === o.ref_id)!.status === 'approved')).toBe(true);
    // no simulator position for maintenance: OJT on a sibling qualification-card task when the task has none
    const mte = practiceOptions({ id: 'jt-maintenance-technician-engineer-g4', role_id: 'maintenance-technician-engineer' }, 'maintenance-technician-engineer', W);
    expect(mte.length).toBeGreaterThan(0);
    expect(mte.every((o) => o.kind === 'ojt' && o.basis === 'shared_skill')).toBe(true);
    // which role: target first, else protected
    expect(planAlert({ target_role_id: 'fr-bwr-operator', protected_role_id: 'shift-supervisor', horizon: '2035', practice: [] }, W).basis).toBe('protected');
    expect(planAlert({ target_role_id: 'procurement-engineer', protected_role_id: 'quality-assurance-qc', horizon: '2030', practice: [] }, W).applies).toBe(false);
  });

  it('planProblem: checks in order (person, self, one open plan, roles, horizon, trigger, dates, reviews, retraining, practice, wording, activation)', () => {
    const ctx = { me: 'p-chco', people: T.people as never, plans: PLANS, courseIds: T.courses.map((c) => c.id), world: W };
    expect(planProblem(BASE, null, ctx)).toBeNull();
    expect(planProblem({ ...BASE, person_id: 'p-alnoor-gm' }, null, ctx)).toBe('invalid_person');
    expect(planProblem({ ...BASE, person_id: 'p-chco', protected_role_id: 'corporate-professional' }, null, ctx)).toBe('self_plan');
    expect(planProblem({ ...BASE, person_id: 'w-ro-01' }, null, ctx)).toBe('open_plan_exists');
    expect(planProblem({ ...BASE, target_role_id: 'reactor-operator' }, null, ctx)).toBe('invalid_role');
    expect(planProblem({ ...BASE, horizon: '2040' }, null, ctx)).toBe('invalid_horizon');
    expect(planProblem({ ...BASE, trigger: 'x' }, null, ctx)).toBe('invalid_trigger');
    expect(planProblem({ ...BASE, end_on: start }, null, ctx)).toBe('invalid_dates');
    expect(planProblem({ ...BASE, retraining: [{ ...BASE.retraining[0], ref_id: 'nope' }] }, null, ctx)).toBe('invalid_retraining');
    expect(planProblem({ ...BASE, practice: [{ ...FULL[0], ref_id: 'scn-019' }] }, null, ctx)).toBe('invalid_practice'); // a draft scenario
    expect(planProblem({ ...BASE, note_en: 'Some posts become redundant' }, null, ctx)).toBe('banned_wording');
    expect(planProblem({ ...BASE, retraining: [] }, null, ctx)).toBe('retraining_required');
    expect(planProblem({ ...BASE, practice: [] }, null, ctx)).toBe('rung_practice_required');
    expect(planProblem({ ...BASE, practice: [], activate: false }, null, ctx)).toBeNull(); // a draft may wait
  });

  it('practiceProgress counts OJT repetitions acknowledged by a preceptor since the plan started; reviewsOk enforces the cadence', () => {
    const mnt = PLANS.find((p) => p.id === 'tp-w-mnt-03-1')!;
    const pr = practiceProgress(mnt, T.ojt_logs as never);
    expect(pr.some((x) => x.kind === 'ojt' && (x.done ?? 0) > 0)).toBe(true);
    expect(practiceProgress({ ...mnt, start_on: '2027-01-01' }, T.ojt_logs as never).every((x) => !x.done)).toBe(true);
    expect(reviewsOk('2026-01-01', '2027-01-01', ['2026-07-02'])).toBe(true);
    expect(reviewsOk('2026-01-01', '2027-01-01', ['2026-07-04'])).toBe(false); // 184 days
    expect(reviewsOk('2026-01-01', '2027-01-01', ['2026-03-01', '2026-02-01'])).toBe(false);
    expect(isDate('2026-02-29')).toBe(false);
    expect(isDate('2028-02-29')).toBe(true);
  });
});

describe('FS81 RPC flows (LocalBackend = SQL)', () => {
  it('saveTransitionPlan: HR only, never on their own plan; one open plan per person; activation writes the ledger and notifies the person', async () => {
    for (const p of ['sro', 'training-mgr', 'k-hr-analyst', 'k-admin', 'k-ro']) { await as(p); expect((await b.rpc.saveTransitionPlan(BASE)).code).toBe('forbidden'); }
    await as('chco');
    expect((await b.rpc.saveTransitionPlan({ ...BASE, person_id: 'p-chco', protected_role_id: 'corporate-professional', target_role_id: 'procurement-engineer', practice: [] })).code).toBe('self_plan');
    const led0 = raw('ledger_local').length;
    const d = await b.rpc.saveTransitionPlan({ ...BASE, practice: [], activate: false });
    expect(d.ok && d.data!.status === 'draft' && d.data!.id === 'tp-w-ro-02-1').toBe(true);
    expect((await b.rpc.saveTransitionPlan({ ...BASE, activate: false })).code).toBe('open_plan_exists');
    expect(raw('ledger_local').length).toBe(led0);
    const a = await b.rpc.saveTransitionPlan({ ...BASE, plan_id: d.data!.id });
    expect(a.ok && a.data!.status === 'active' && a.data!.revision === 2).toBe(true);
    expect(raw('ledger_local').length).toBe(led0 + 1);
    expect(raw('notifications').some((n) => n.id === `nt-tp-${d.data!.id}-r2` && n.person_id === 'w-ro-02' && n.kind === 'transition' && n.link === '/my/transition-plan')).toBe(true);
    // an active plan stays active and must keep every rung task covered
    expect((await b.rpc.saveTransitionPlan({ ...BASE, plan_id: d.data!.id, practice: FULL.slice(2), activate: false })).code).toBe('rung_practice_required');
    const audits = raw('audit_events').filter((e) => e.entity_table === 'transition_plans');
    expect(audits.some((e) => e.action === 'transition.activate' && e.outcome === 'ok')).toBe(true);
    expect(audits.some((e) => e.outcome === 'refused')).toBe(true);
  });

  it('reviewTransitionPlan, closeTransitionPlan and acknowledgeTransitionPlan follow the same rules as SQL', async () => {
    const today = todayIso();
    await as('chco');
    const lo = PLANS.find((p) => p.id === 'tp-w-lo-02-1')!;
    const due = lo.reviews.find((r) => !r.done_on)!.due_on;
    const r1 = await b.rpc.reviewTransitionPlan({ plan_id: lo.id, outcome: 'at_risk', note: 'Two repetitions moved' });
    if (daysFrom(today, due) <= REVIEW_WINDOW) {
      expect(r1.ok).toBe(true);
      const row = raw('transition_plans').find((x) => x.id === lo.id)!;
      expect(row.reviews.find((x: Row) => x.due_on === due).outcome).toBe('at_risk');
      expect(row.next_review_on).toBe(lo.reviews.filter((r) => !r.done_on)[1].due_on);
    } else expect(r1.code).toBe('no_review_due');
    expect((await b.rpc.reviewTransitionPlan({ plan_id: lo.id, outcome: 'great' })).code).toMatch(/invalid_outcome|no_review_due/);
    expect((await b.rpc.closeTransitionPlan({ plan_id: 'tp-w-ro-01-1', outcome: 'completed', note: 'Done here' })).code).toBe('not_active');
    expect((await b.rpc.closeTransitionPlan({ plan_id: 'tp-w-mnt-03-1', outcome: 'completed', note: 'ok' })).code).toBe('invalid_close');
    const led0 = raw('ledger_local').length;
    expect((await b.rpc.closeTransitionPlan({ plan_id: 'tp-w-ro-01-1', outcome: 'withdrawn', note: 'Person stays in role' })).ok).toBe(true);
    expect((await b.rpc.closeTransitionPlan({ plan_id: 'tp-w-chem-02-1', outcome: 'completed', note: 'All practice done' })).ok).toBe(true);
    expect(raw('ledger_local').length).toBe(led0 + 2);
    expect((await b.rpc.saveTransitionPlan({ ...BASE, person_id: 'w-chem-02', plan_id: 'tp-w-chem-02-1' })).code).toBe('not_editable');
    expect((await b.rpc.acknowledgeTransitionPlan('tp-p-k-lo-trainee-1')).code).toBe('not_found'); // HR cannot acknowledge for the person
    await as('k-lo-trainee');
    expect((await b.rpc.acknowledgeTransitionPlan('tp-p-k-lo-trainee-1')).ok).toBe(true);
    expect((await b.rpc.acknowledgeTransitionPlan('tp-p-k-lo-trainee-1')).code).toBe('already');
    await as('k-ro');
    expect((await b.rpc.acknowledgeTransitionPlan('tp-p-k-lo-trainee-1')).code).toBe('not_found');
  });

  it('the editor preview equals what saving would refuse; candidates are active staff with their open plan', async () => {
    await as('chco');
    const pv = await b.rpc.previewTransitionPlan({ ...BASE, practice: FULL.slice(1) });
    expect(pv!.problem).toBe('rung_practice_required');
    expect(pv!.alert.uncovered).toEqual([FULL[0].task_id]);
    expect((await b.rpc.previewTransitionPlan({ ...BASE, activate: false, practice: [] }))!.problem).toBeNull();
    const c = await b.rpc.transitionCandidates();
    expect(c!.find((x) => x.person_id === 'w-ro-01')!.open_plan_id).toBe('tp-w-ro-01-1');
    expect(c!.filter((x) => x.open_plan_id).length).toBe(8);
    await as('training-mgr');
    expect(await b.rpc.previewTransitionPlan(BASE)).toBeNull();
  });
});

describe('FS81 routes, benchmarks, i18n and seed', () => {
  it('routes, guards and benchmark chips', () => {
    const ids = routes.map((r) => r.id);
    for (const id of ['my-transition-plan', 'workforce-transition-plans', 'workforce-transition-plan', 'workforce-rung-alerts']) expect(ids).toContain(id);
    expect(routes.find((r) => r.id === 'workforce-rung-alerts')!.guard).toEqual({ signedIn: true, grant: { res: 'transformation', levels: ['Agg', 'W', 'A'] } });
    expect(JSON.parse(readFileSync('src/modules/m30/smoke.json', 'utf8'))['workforce-transition-plan']).toEqual({ planId: 'tp-p-k-ro-1' });
    expect(FEATURE_BENCHMARKS.FS81).toEqual(expect.arrayContaining(['SSG-SF', 'SG-JTM', 'CORP']));
  });

  it('i18n: every FS81 key exists in English and Arabic, and the Arabic is Arabic', () => {
    const e = new Map(flat({ tp: en.tp, ra: en.ra }));
    const a = new Map(flat({ tp: ar.tp, ra: ar.ra }));
    expect([...e.keys()].sort()).toEqual([...a.keys()].sort());
    for (const [k, v] of a) if (!/listSep/.test(k)) expect(AR.test(v), k).toBe(true);
    for (const code of ['opt_sim', 'opt_ojt_own', 'opt_ojt_sibling', 'rung_task_below', 'rung_task_own', 'rung_covered', 'rung_uncovered', 'rung_mastery', 'rung_not_mastery', 'rung_no_role', 'rung_tasks', 'rung_none', 'rung_role_target', 'rung_role_protected', 'opt_fidelity_full_scope', 'opt_fidelity_limited_scope', 'opt_fidelity_desktop']) {
      expect((en.reasons as Row)[code]).toBeTruthy();
      expect(AR.test((ar.reasons as Row)[code])).toBe(true);
    }
    for (const code of Object.keys(TP_MSG).filter((k) => !['not_signed_in', 'forbidden', 'not_found', 'not_editable', 'invalid_outcome', 'invalid_close', 'not_active', 'not_person', 'already'].includes(k))) expect((en.tp.err as Row)[code], code).toBeTruthy();
  });

  it('seed: synthetic people, no banned wording, seeded dates on or before 2026-10-11, no notification written', () => {
    for (const p of PLANS) {
      expect(T.people.find((x) => x.id === p.person_id)!.synthetic).not.toBe(false);
      expect(p.created_at.slice(0, 10) <= '2026-10-11').toBe(true);
      expect(/\b(replac|redundan)/i.test(JSON.stringify([p.note_en, p.retraining]))).toBe(false);
    }
    expect(T.notifications.some((n) => n.kind === 'transition')).toBe(false);
  });
});
