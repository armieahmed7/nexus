// [FS wave I · E3 · FS81] PGlite checks for 20261010293001_kafaa_fs93_transition_plans.sql (transition plans and ladder-rung protection).
// Seed sanity (10 SIMULATED plans with review dates; every active, completed or withdrawn plan covers its ladder-rung alert; every
// alert names its tasks and the practice added); SQL = TS parity: kafaa_tp_rungs = rungsBelow(), kafaa_tp_options = practiceOptions(),
// kafaa_tp_alert = rungAlert() (every current role x both horizons, with and without practice, incl. invalid items),
// kafaa_tp_plan_alert = planAlert(), kafaa_tp_problem = planProblem() on generated inputs, kafaa_tp_reviews_ok = reviewsOk(),
// kafaa_tp_date = isDate(), kafaa_tp_progress = practiceProgress(), the HR board = the TS views; RLS per persona (the person reads their
// own plans; managers in scope, the training manager, HR analysts, auditors and anonymous visitors read none); RPC flows and RBAC inside
// a rolled-back transaction (activation needs practice for every rung task, ledger on activation and closing, reviews, acknowledgement,
// self plan refused); check constraints; grants; additivity.
import { readFileSync } from 'node:fs';
import {
  OJT_REPS, SIM_REPS, daysFrom, isDate, planAlert, planCandidates, planProblem, previewOf, practiceOptions, practiceProgress, reviewsOk, roleRungAlerts, rungAlert, rungsBelow, REVIEW_WINDOW,
} from '../../src/modules/m30/transition.ts';

const BANNED = [['dr', 'op'], ['del', 'ete'], ['trun', 'cate']].map((p) => p.join('')); // destructive SQL words, spelled so this file does not contain them
const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${k}:${canon(v[k])}`).join(',')}}` : typeof v === 'number' ? String(Number(v)) : JSON.stringify(v ?? null));
const MIG = 'supabase/migrations/20261010293001_kafaa_fs93_transition_plans.sql';
const first = (a, b) => { const x = canon(a), y = canon(b); if (x === y) return ''; let i = 0; while (i < x.length && x[i] === y[i]) i++; return ` (SQL …${x.slice(Math.max(0, i - 80), i + 80)} vs TS …${y.slice(Math.max(0, i - 80), i + 80)})`; };
const day = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v);
const DATES = new Set(['protected_until', 'start_on', 'end_on', 'next_review_on', 'on_date', 'decision_on', 'future_on', 'hire_date']);
const norm = (rows) => rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, DATES.has(k) ? day(v) : v instanceof Date ? v.toISOString() : v])));
const TEST = { 'k-ro': '00000000-0000-4000-8000-000000009301', 'k-lo-trainee': '00000000-0000-4000-8000-000000009302' };

export default async function fs93Checks({ db, one, ok }) {
  console.log('FS wave I · E3 · FS81 transition plans and ladder-rung protection');
  await db.exec('reset role');
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  const tables = async (names) => Object.fromEntries(await Promise.all(names.map(async (n) => [n, norm(await q(`select * from kafaa_${n} order by id`))])));
  const W = await tables(['transition_plans', 'job_roles', 'role_transformations', 'career_paths', 'jta_tasks', 'ai_capability_levels', 'jta_task_skills', 'skills', 'sim_scenarios', 'people', 'courses', 'ojt_logs']);
  const world = { roles: W.job_roles, maps: W.role_transformations, paths: W.career_paths, tasks: W.jta_tasks, levels: W.ai_capability_levels, taskSkills: W.jta_task_skills, skills: W.skills, scenarios: W.sim_scenarios };
  const today = (await q('select current_date::text d'))[0].d;
  const plans = W.transition_plans;

  for (const [persona, uid] of Object.entries(TEST)) await db.query(`insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,'enec-ops','employee',$4) on conflict do nothing`, [uid, `${persona}@fs93.test`, persona, ['Test']]);
  const asT = async (persona, sql, p = []) => {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: TEST[persona] })]);
    await db.exec('set role authenticated');
    try { return (await db.query(sql, p)).rows; } finally { await db.exec('reset role'); }
  };

  // ── seed sanity + acceptance
  const alerts = plans.map((p) => ({ p, a: planAlert(p, world) }));
  ok(plans.length === 10 && plans.every((p) => p.simulated === true && Array.isArray(p.reviews) && p.reviews.length >= 1 && p.reviews.every((r) => isDate(r.due_on)))
    && plans.filter((p) => p.status === 'active').every((p) => isDate(p.next_review_on)) && plans.filter((p) => p.status === 'active').length === 7,
    `acceptance (FS81 plans are labelled SIMULATED and carry review dates): ${plans.length} seeded plans, every one simulated with dated reviews; the 7 active ones have a next review date`);
  const firing = alerts.filter((x) => x.a.fires);
  ok(firing.length === 9 && firing.every((x) => x.a.tasks.every((t) => t.code && t.title_en && t.title_ar && t.options.length > 0 && t.reasons.length >= 3))
    && alerts.filter((x) => x.p.status !== 'draft').every((x) => x.a.uncovered.length === 0 && x.a.tasks.every((t) => t.covered && t.practice.length > 0))
    && alerts.find((x) => x.p.id === 'tp-w-ro-01-1').a.uncovered.length > 0,
    `acceptance (FS81 every alert names the tasks and the practice added): ${firing.length} plan alerts name ${firing.reduce((n, x) => n + x.a.tasks.length, 0)} junior tasks; every active, completed or withdrawn plan names practice for each; the draft still shows uncovered tasks`);

  // ── parity
  const roleIds = W.job_roles.map((r) => r.id);
  const rd = [];
  for (const id of roleIds) { const a = (await q('select kafaa_tp_rungs($1) r', [id]))[0].r; if (canon(a) !== canon(rungsBelow(id, world))) rd.push(id); }
  const ad = [];
  for (const h of ['2030', '2035']) for (const id of roleIds) {
    const a = (await q(`select kafaa_tp_alert($1, $2, '[]'::jsonb, 'target') j`, [id, h]))[0].j;
    const t = rungAlert(id, h, [], world);
    if (canon(a) !== canon(t)) ad.push(`${id}@${h}${first(a, t)}`);
  }
  const nullA = (await q(`select kafaa_tp_alert(null, '2030', '[]'::jsonb, 'target') j`))[0].j;
  ok(rd.length === 0 && ad.length === 0 && canon(nullA) === canon(rungAlert(null, '2030', [], world)),
    `SQL kafaa_tp_rungs = rungsBelow() and kafaa_tp_alert = rungAlert() for all ${roleIds.length} roles x 2 horizons (incl. options, reasons and the no-role case)${rd[0] ? ` rungs ${rd[0]}` : ''}${ad[0] ? ` ${ad[0]}` : ''}`);
  const od = [];
  for (const id of roleIds) for (const t of rungAlert(id, '2035', [], world).tasks) {
    const a = (await q('select kafaa_tp_options($1, $2, $3) j', [t.task_id, t.role_id, id]))[0].j;
    const b = practiceOptions({ id: t.task_id, role_id: t.role_id }, id, world);
    if (canon(a) !== canon(b)) od.push(`${id}/${t.task_id}${first(a, b)}`);
  }
  const pd = [];
  for (const { p, a: t } of alerts) {
    const a = (await q('select kafaa_tp_plan_alert($1, $2, $3, $4::jsonb) j', [p.target_role_id, p.protected_role_id, p.horizon, JSON.stringify(p.practice)]))[0].j;
    if (canon(a) !== canon(t)) pd.push(`${p.id}${first(a, t)}`);
    const mixed = [...p.practice.slice(0, 2), { task_id: 'nope', kind: 'ojt', ref_id: 'x', reps: 1 }, { ...(p.practice[0] ?? { task_id: 'x' }), ref_id: 'scn-999' }, 'bad', null, { ...(p.practice[0] ?? {}), reps: 'x' }];
    const a2 = (await q('select kafaa_tp_plan_alert($1, $2, $3, $4::jsonb) j', [p.target_role_id, p.protected_role_id, p.horizon === '2030' ? '2035' : '2030', JSON.stringify(mixed)]))[0].j;
    const t2 = planAlert({ ...p, horizon: p.horizon === '2030' ? '2035' : '2030', practice: mixed }, world);
    if (canon(a2) !== canon(t2)) pd.push(`${p.id} mixed${first(a2, t2)}`);
  }
  ok(od.length === 0 && pd.length === 0, `SQL kafaa_tp_options = practiceOptions() on every alerted task; kafaa_tp_plan_alert = planAlert() on the 10 seeded plans and on mixed valid/invalid practice${od[0] ? ` ${od[0]}` : ''}${pd[0] ? ` ${pd[0]}` : ''}`);
  const prd = [];
  for (const p of plans) {
    const a = (await q('select kafaa_tp_progress(t) j from kafaa_transition_plans t where id = $1', [p.id]))[0].j;
    const t = practiceProgress(p, W.ojt_logs);
    if (canon(a) !== canon(t)) prd.push(`${p.id}${first(a, t)}`);
  }
  const mnt = practiceProgress(plans.find((p) => p.id === 'tp-w-mnt-03-1'), W.ojt_logs);
  const dd = [];
  for (const s of ['2026-02-29', '2028-02-29', '2026-13-01', '2026-1-01', '2026-10-12', ' 2026-10-12', '2026-10-12T00:00:00Z', 20261012, null, '0000-01-01', '2026-04-31']) {
    const a = (await q('select kafaa_tp_date($1::jsonb) d', [JSON.stringify(s)]))[0].d;
    if ((a !== null) !== isDate(s)) dd.push(String(s));
  }
  const rcases = [['2026-01-01', '2027-01-01', ['2026-06-01', '2026-12-01']], ['2026-01-01', '2027-01-01', ['2026-07-04']], ['2026-01-01', '2027-01-01', ['2026-07-02', '2026-12-31']], ['2026-01-01', '2026-06-01', ['2026-06-02']],
    ['2026-01-01', '2027-01-01', []], ['2026-01-01', '2027-01-01', ['2026-03-01', '2026-02-01']], ['2026-01-01', '2027-01-01', ['2026-01-01']], ['2026-01-01', '2030-01-01', Array.from({ length: 13 }, (_, i) => `2026-${String(i % 12 + 1).padStart(2, '0')}-28`)], ['2026-01-01', '2027-01-01', ['x']]];
  const rv = [];
  for (const [s, e, d] of rcases) { const a = (await q('select kafaa_tp_reviews_ok($1::date, $2::date, $3::jsonb) b', [s, e, JSON.stringify(d)]))[0].b; if (a !== reviewsOk(s, e, d)) rv.push(`${s}..${e} ${d.join(',')}`); }
  ok(prd.length === 0 && mnt.some((x) => x.kind === 'ojt' && x.done > 0) && dd.length === 0 && rv.length === 0,
    `SQL kafaa_tp_progress = practiceProgress() for every plan (acknowledged OJT repetitions since the start, e.g. w-mnt-03 ${mnt.filter((x) => x.done).map((x) => `${x.done}/${x.reps}`).join(', ')}); kafaa_tp_date = isDate(); kafaa_tp_reviews_ok = reviewsOk() on ${rcases.length} cadences${prd[0] ?? ''}${dd[0] ? ` date ${dd[0]}` : ''}${rv[0] ? ` reviews ${rv[0]}` : ''}`);

  // planProblem parity on generated inputs (base: a new plan for w-ro-02, RO -> SRO, every rung task covered)
  const ctx = (cur) => ({ me: 'p-chco', people: W.people, plans, courseIds: W.courses.map((c) => c.id), world });
  const alertRo = planAlert({ target_role_id: 'senior-reactor-operator', protected_role_id: 'reactor-operator', horizon: '2030', practice: [] }, world);
  const full = alertRo.tasks.map((t) => { const o = t.options[0]; return { task_id: t.task_id, kind: o.kind, ref_id: o.ref_id, reps: o.kind === 'simulator' ? SIM_REPS.def : OJT_REPS.def }; });
  const base = {
    person_id: 'w-ro-02', protected_role_id: 'reactor-operator', protected_until: '2027-12-31', target_role_id: 'senior-reactor-operator', horizon: '2030', trigger: 'task_automation',
    start_on: '2026-11-01', end_on: '2028-10-31', review_dates: ['2027-02-01', '2027-08-01'], note_en: 'Plan note', note_ar: 'ملاحظة',
    retraining: [{ kind: 'course', ref_id: 'c-exec-sim', title_en: 'Executive Simulator Course', title_ar: 'دورة المحاكي', hours: 16, due_on: '2027-03-31' }, { kind: 'practice', title_en: 'Guided practice', title_ar: 'ممارسة', hours: 20, due_on: '2027-06-30' }],
    practice: full, activate: true,
  };
  const r0 = base.retraining[0], p0 = full[0];
  const muts = [{}, { activate: false }, { person_id: 'p-alnoor-gm' }, { person_id: 'nobody' }, { person_id: 'p-chco', protected_role_id: 'corporate-professional' }, { person_id: 'w-ro-01' }, { person_id: 7 },
    { protected_role_id: 'senior-reactor-operator' }, { target_role_id: 'reactor-operator' }, { target_role_id: 'fr-bwr-operator', practice: [] }, { target_role_id: 'zz' }, { target_role_id: 'procurement-engineer', practice: [] },
    { horizon: '2040' }, { horizon: 2030 }, { trigger: 'restructure' }, { start_on: '2026-02-30' }, { end_on: '2026-10-01' }, { protected_until: '2029-01-01' }, { protected_until: '2026-10-31' },
    { review_dates: [] }, { review_dates: 'x' }, { review_dates: ['2027-06-01'] }, { review_dates: ['2027-02-01', '2027-01-01'] }, { review_dates: ['2027-02-01', '2029-01-01'] }, { review_dates: [20270201] },
    { retraining: [] }, { retraining: [], activate: false }, { retraining: 'x' }, { retraining: [{ ...r0, kind: 'webinar' }] }, { retraining: [{ ...r0, title_en: ' ' }] }, { retraining: [{ ...r0, title_ar: 'x'.repeat(161) }] },
    { retraining: [{ ...r0, hours: 0 }] }, { retraining: [{ ...r0, hours: 2.5 }] }, { retraining: [{ ...r0, hours: '16' }] }, { retraining: [{ ...r0, due_on: '2026-10-31' }] }, { retraining: [{ ...r0, ref_id: 'c-none' }] },
    { retraining: [{ ...r0, kind: 'practice', ref_id: 5 }] }, { retraining: ['x'] }, { retraining: [{ ...r0, title_en: 'Plan to replace the role' }] },
    { practice: [] }, { practice: [], activate: false }, { practice: full.slice(1), activate: false }, { practice: full.slice(1) }, { practice: [...full, p0] }, { practice: [{ ...p0, reps: 0 }] }, { practice: [{ ...p0, reps: 11 }] },
    { practice: [{ ...p0, kind: 'simulator', reps: 7 }] }, { practice: [{ ...p0, ref_id: 'scn-019' }] }, { practice: [{ ...p0, task_id: 'jt-qs-ro-t1' }] }, { practice: ['x'] }, { practice: 'x' },
    { note_en: 'x'.repeat(601) }, { note_ar: 5 }, { note_en: null }, { note_ar: 'سيتم الاستغناء عن الوظيفة' }, { note_en: 'A redundant position' }];
  const md = [];
  for (const m of muts) {
    const inp = { ...base, ...m };
    const a = (await q('select kafaa_tp_problem($1::jsonb, null::kafaa_transition_plans, $2) c', [JSON.stringify(inp), 'p-chco']))[0].c;
    const b = planProblem(inp, null, ctx(null));
    if ((a ?? null) !== b) md.push(`${JSON.stringify(m).slice(0, 80)}: ${a} vs ${b}`);
  }
  // with a stored plan: done reviews are kept in the cadence; the person cannot change
  const lo2 = plans.find((p) => p.id === 'tp-w-lo-02-1');
  const lo2In = { person_id: lo2.person_id, protected_role_id: lo2.protected_role_id, protected_until: lo2.protected_until, target_role_id: lo2.target_role_id, horizon: lo2.horizon, trigger: lo2.trigger,
    start_on: lo2.start_on, end_on: lo2.end_on, review_dates: lo2.reviews.filter((r) => !r.done_on).map((r) => r.due_on), retraining: lo2.retraining, practice: lo2.practice, note_en: lo2.note_en, note_ar: lo2.note_ar, activate: true };
  for (const m of [{}, { review_dates: ['2026-05-01'] }, { person_id: 'w-lo-07' }, { practice: [] }, { review_dates: ['2027-03-15'] }]) {
    const inp = { ...lo2In, ...m };
    const a = (await q('select kafaa_tp_problem($1::jsonb, t, $2) c from kafaa_transition_plans t where id = $3', [JSON.stringify(inp), 'p-chco', lo2.id]))[0].c;
    const b = planProblem(inp, lo2, ctx(lo2));
    if ((a ?? null) !== b) md.push(`stored ${JSON.stringify(m)}: ${a} vs ${b}`);
  }
  const codes = new Set(muts.map((m) => planProblem({ ...base, ...m }, null, ctx(null))));
  ok(md.length === 0 && codes.size >= 12 && planProblem(base, null, ctx(null)) === null && planProblem({ ...base, practice: full.slice(1) }, null, ctx(null)) === 'rung_practice_required',
    `SQL kafaa_tp_problem = planProblem() on ${muts.length + 5} generated inputs (${codes.size} distinct outcomes; activation without practice for a rung task is refused)${md[0] ? ` (${md[0]})` : ''}`);

  // ── RLS
  const cnt = async (who, sql) => Number((await one(who, sql)).n);
  const own = await asT('k-ro', 'select id from kafaa_transition_plans');
  const sroRows = await one('sro', 'select array_agg(id order by id) ids from kafaa_transition_plans');
  ok(own.length === 1 && own[0].id === 'tp-p-k-ro-1' && canon(sroRows.ids) === canon(['tp-p-sro-1'])
    && await cnt(null, 'select count(*)::int n from kafaa_transition_plans') === 0 && await cnt('training-mgr', 'select count(*)::int n from kafaa_transition_plans') === 0
    && await cnt('k-hr-analyst', 'select count(*)::int n from kafaa_transition_plans') === 0 && await cnt('k-auditor', 'select count(*)::int n from kafaa_transition_plans') === 0
    && await cnt('chco', 'select count(*)::int n from kafaa_transition_plans') === 0 && await cnt('k-admin', 'select count(*)::int n from kafaa_transition_plans') === 0,
    'acceptance (FS81 plans are visible to the person and HR only), RLS: k-ro reads only their own plan; the shift supervisor (manager of crew B) reads only their own, none of the crew-B plans; anonymous, training manager, HR analyst, auditor, admin read no row directly (HR reads through the RPCs)');
  const board = (await one('chco', 'select kafaa_transition_plans() j')).j;
  const vSro = (await one('sro', `select kafaa_transition_plan_view('tp-w-ro-01-1') j`)).j;
  const vSroLo = (await one('sro', `select kafaa_transition_plan_view('tp-w-lo-02-1') j`)).j;
  const vMine = (await asT('k-ro', 'select kafaa_transition_plan_view(null) j'))[0].j;
  const vOther = (await asT('k-ro', `select kafaa_transition_plan_view('tp-p-k-lo-trainee-1') j`))[0].j;
  const nulls = [(await one('sro', 'select kafaa_transition_plans() j')).j, (await one('k-hr-analyst', 'select kafaa_transition_plans() j')).j, (await one('training-mgr', 'select kafaa_transition_plans() j')).j,
    (await one('k-auditor', 'select kafaa_transition_plans() j')).j, (await one('k-admin', `select kafaa_transition_plan_view('tp-p-k-ro-1') j`)).j, (await one('training-mgr', `select kafaa_transition_plan_view('tp-p-k-ro-1') j`)).j];
  const boardTs = [...plans].sort((a, b) => ({ active: 0, draft: 1, completed: 2, withdrawn: 3 }[a.status] - { active: 0, draft: 1, completed: 2, withdrawn: 3 }[b.status]) || String(a.next_review_on ?? '9999').localeCompare(String(b.next_review_on ?? '9999')) || (a.id < b.id ? -1 : 1));
  const stateOf = (p) => (p.status !== 'active' || !p.next_review_on ? 'none' : daysFrom(today, p.next_review_on) < 0 ? 'overdue' : daysFrom(today, p.next_review_on) <= REVIEW_WINDOW ? 'due_soon' : 'on_time');
  const bd = Array.isArray(board) ? board.filter((v, i) => v.plan.id !== boardTs[i].id || canon(v.alert) !== canon(planAlert(boardTs[i], world)) || canon(v.progress) !== canon(practiceProgress(boardTs[i], W.ojt_logs)) || v.review_state !== stateOf(boardTs[i]) || v.can_decide !== true || v.mine !== false) : ['none'];
  ok(Array.isArray(board) && board.length === 10 && bd.length === 0 && vSro === null && vSroLo === null && nulls.every((x) => x === null) && vMine?.plan?.id === 'tp-p-k-ro-1' && vMine.mine === true && vMine.can_decide === false && vOther === null,
    `RPC reads: the HR director reads the 10 plans (= TS: order, alert, progress, review state); the shift supervisor cannot open crew-B plans; HR analyst, training manager, auditor and admin get nothing; k-ro opens only their own${bd[0] ? ` (${bd[0]?.plan?.id ?? bd[0]})` : ''}`);
  const ra = (await one('training-mgr', `select kafaa_rung_alerts('2030') j`)).j;
  const raH = (await one('k-hr-analyst', `select kafaa_rung_alerts('2035') j`)).j;
  ok(canon(ra) === canon(roleRungAlerts('2030', world)) && canon(raH) === canon(roleRungAlerts('2035', world)) && ra.length === 9 && (await one('sro', `select kafaa_rung_alerts('2030') j`)).j === null,
    `role-level ladder-rung alerts (no person): training manager and HR read ${ra?.length} Mastery Builder roles = roleRungAlerts() at 2030 and 2035; a manager gets nothing${first(ra, roleRungAlerts('2030', world))}`);

  const cand = (await one('chco', 'select kafaa_transition_candidates() j')).j;
  const candTs = planCandidates(W.people, W.job_roles, plans);
  const pv = [];
  for (const m of [{}, { practice: full.slice(1) }, { activate: false, practice: [] }, { horizon: 2035 }, { target_role_id: ' procurement-engineer ', practice: [] }, { plan_id: 'tp-w-lo-02-1' }, { practice: 'x' }]) {
    const inp = { ...base, ...m };
    const a = (await one('chco', 'select kafaa_preview_transition_plan($1::jsonb) j', [JSON.stringify(inp)])).j;
    const cur = m.plan_id ? plans.find((x) => x.id === m.plan_id) : null;
    const t = previewOf(inp, cur, ctx(cur));
    if (canon(a) !== canon(t)) pv.push(`${JSON.stringify(m)}${first(a, t)}`);
  }
  ok(canon(cand) === canon(candTs) && candTs.length >= 80 && candTs.filter((c) => c.open_plan_id).length === 8 && pv.length === 0
    && (await one('sro', 'select kafaa_transition_candidates() j')).j === null && (await one('training-mgr', `select kafaa_preview_transition_plan('{}'::jsonb) j`)).j === null,
    `HR editor reads: kafaa_transition_candidates = planCandidates() (${candTs.length} active staff, 8 with an open plan); kafaa_preview_transition_plan = previewOf() (problem + alert, nothing saved); others get nothing${pv[0] ? ` (${pv[0]})` : ''}${first(cand, candTs)}`);

  // ── RPC flows (rolled back)
  await db.exec('begin');
  try {
    const r = async (who, sql, p = []) => (await one(who, sql, p)).r;
    const led = async () => Number((await q('select count(*)::int n from ledger_entries'))[0].n);
    const aud = async () => Number((await q('select count(*)::int n from kafaa_audit_events'))[0].n);
    const save = (who, inp) => r(who, 'select kafaa_save_transition_plan($1::jsonb) r', [JSON.stringify(inp)]);
    const fs = [await save('sro', base), await save('training-mgr', base), await save('k-hr-analyst', base), await save('k-admin', base)];
    const self = await save('chco', { ...base, person_id: 'p-chco', protected_role_id: 'corporate-professional', target_role_id: 'procurement-engineer', practice: [] });
    ok(fs.every((x) => x.code === 'forbidden') && self.code === 'self_plan', 'saveTransitionPlan: HR (transformation A) only (manager, training manager, HR analyst, admin refused); the HR director cannot decide their own plan');
    const a0 = await aud(), l0 = await led();
    const noPr = await save('chco', { ...base, practice: full.slice(2) });
    const a1 = await aud();
    const draft = await save('chco', { ...base, practice: full.slice(2), activate: false });
    const dup = await save('chco', { ...base, activate: false });
    const l1 = await led();
    const act = await save('chco', { ...base, plan_id: draft.data?.id });
    const row = norm(await q('select * from kafaa_transition_plans where id = $1', [draft.data?.id]))[0];
    const note = await q(`select kind, link from kafaa_notifications where id = $1`, [`nt-tp-${draft.data?.id}-r2`]);
    ok(noPr.code === 'rung_practice_required' && a1 === a0 + 1 && draft.ok && draft.data.id === 'tp-w-ro-02-1' && draft.data.status === 'draft' && dup.code === 'open_plan_exists' && l1 === l0
      && act.ok && act.data.status === 'active' && act.data.revision === 2 && (await led()) === l1 + 1 && row.next_review_on === '2027-02-01' && row.simulated === true && row.activated_by === 'p-chco'
      && canon(row.practice) === canon(full) && note.length === 1 && note[0].kind === 'transition' && note[0].link === '/my/transition-plan',
      `acceptance (FS81 ladder-rung alert): activating a plan without practice for every rung task is refused (${noPr.code}, audited); a draft can wait; one open plan per person; activation with practice for all ${full.length} tasks writes the ledger and notifies the person`);
    const lo = plans.find((p) => p.id === 'tp-w-lo-02-1');
    const due = lo.reviews.find((x) => !x.done_on).due_on;
    const rvF = await r('sro', 'select kafaa_review_transition_plan($1::jsonb) r', [JSON.stringify({ plan_id: lo.id, outcome: 'on_track' })]);
    const rvBad = await r('chco', 'select kafaa_review_transition_plan($1::jsonb) r', [JSON.stringify({ plan_id: lo.id, outcome: 'great' })]);
    const rv = await r('chco', 'select kafaa_review_transition_plan($1::jsonb) r', [JSON.stringify({ plan_id: lo.id, outcome: 'at_risk', note: 'Two repetitions moved' })]);
    const loRow = norm(await q('select * from kafaa_transition_plans where id = $1', [lo.id]))[0];
    const ro = plans.find((p) => p.id === 'tp-p-k-ro-1');
    const roDue = ro.reviews.find((x) => !x.done_on).due_on;
    const rvEarly = await r('chco', 'select kafaa_review_transition_plan($1::jsonb) r', [JSON.stringify({ plan_id: ro.id, outcome: 'on_track' })]);
    const expectEarly = daysFrom(today, roDue) > REVIEW_WINDOW ? 'no_review_due' : 'ok';
    ok(rvF.code === 'forbidden' && rvBad.code === 'invalid_outcome' && (daysFrom(today, due) > REVIEW_WINDOW ? rv.code === 'no_review_due' : rv.ok && loRow.reviews.find((x) => x.due_on === due).outcome === 'at_risk' && loRow.next_review_on === '2027-03-15')
      && rvEarly.code === expectEarly,
      `reviewTransitionPlan: HR only; the review due on ${due} is recorded with its outcome and the next date follows; a review more than ${REVIEW_WINDOW} days ahead (${roDue}) is ${expectEarly}`);
    const clF = await r('chco', 'select kafaa_close_transition_plan($1::jsonb) r', [JSON.stringify({ plan_id: 'tp-w-ro-01-1', outcome: 'completed', note: 'Done here' })]);
    const l2 = await led();
    const clW = await r('chco', 'select kafaa_close_transition_plan($1::jsonb) r', [JSON.stringify({ plan_id: 'tp-w-ro-01-1', outcome: 'withdrawn', note: 'Person stays in role' })]);
    const clC = await r('chco', 'select kafaa_close_transition_plan($1::jsonb) r', [JSON.stringify({ plan_id: 'tp-w-chem-02-1', outcome: 'completed', note: 'All practice done' })]);
    const clShort = await r('chco', 'select kafaa_close_transition_plan($1::jsonb) r', [JSON.stringify({ plan_id: 'tp-w-mnt-03-1', outcome: 'completed', note: 'ok' })]);
    const reopen = await save('chco', { ...base, person_id: 'w-chem-02', plan_id: 'tp-w-chem-02-1' });
    ok(clF.code === 'not_active' && clW.ok && clC.ok && (await led()) === l2 + 2 && clShort.code === 'invalid_close' && reopen.code === 'not_editable',
      'closeTransitionPlan: a draft can only be withdrawn; completing and withdrawing write the ledger; a reason is required; closed plans cannot be edited');
    const ak = (await asT('k-lo-trainee', `select kafaa_acknowledge_transition_plan('tp-p-k-lo-trainee-1') r`))[0].r;
    const ak2 = (await asT('k-lo-trainee', `select kafaa_acknowledge_transition_plan('tp-p-k-lo-trainee-1') r`))[0].r;
    const akO = (await asT('k-ro', `select kafaa_acknowledge_transition_plan('tp-p-k-lo-trainee-1') r`))[0].r;
    const akHr = await r('chco', `select kafaa_acknowledge_transition_plan('tp-p-k-lo-trainee-1') r`);
    const akSro = await r('sro', `select kafaa_acknowledge_transition_plan('tp-p-sro-1') r`);
    ok(ak.ok && ak2.code === 'already' && akO.code === 'not_found' && akHr.code === 'not_found' && akSro.code === 'already', 'acknowledgeTransitionPlan: the person acknowledges once; nobody else can (not found)');
    let ck = 0;
    for (const sql of [`update kafaa_transition_plans set simulated = false where id = 'tp-p-k-ro-1'`, `update kafaa_transition_plans set reviews = '[]'::jsonb where id = 'tp-p-k-ro-1'`, `update kafaa_transition_plans set next_review_on = null where id = 'tp-p-k-ro-1'`]) {
      try { await db.exec('savepoint s1'); await db.exec(sql); await db.exec('rollback to savepoint s1'); } catch { ck++; await db.exec('rollback to savepoint s1'); }
    }
    let direct = 0;
    for (const sql of [`update kafaa_transition_plans set status = 'completed' where id = 'tp-p-k-ro-1' returning id`, `insert into kafaa_transition_plans (id) values ('x') returning id`]) { try { const x = await asT('k-ro', sql); if (!x.length) direct++; } catch { direct++; } }
    ok(ck === 3 && direct === 2, 'database checks: a plan is always SIMULATED, carries review dates and an active plan has a next review; nobody writes plans directly (RPC only)');
  } finally { await db.exec('rollback'); }

  // ── grants and additivity
  let denied = 0;
  const helpers = [`select kafaa_tp_alert('local-operator', '2030', '[]'::jsonb, 'target')`, "select kafaa_tp_rungs('reactor-operator')", `select kafaa_tp_options('x', 'y', 'z')`, `select kafaa_tp_plan_alert('a', 'b', '2030', '[]'::jsonb)`,
    `select kafaa_tp_problem('{}'::jsonb, null::kafaa_transition_plans, 'x')`, "select kafaa_tp_notify('x', 'p-k-ro', 'a', 'b')", `select kafaa_tp_date('"2026-01-01"'::jsonb)`];
  for (const sql of helpers) { try { await one('training-mgr', sql); } catch { denied++; } }
  ok(denied === helpers.length, 'grants: internal helpers (rules, checks, notice writer) are not executable by signed-in users');
  let anon = 0;
  const rpcs = ['select kafaa_transition_plan_view(null)', 'select kafaa_transition_plans()', 'select kafaa_transition_candidates()', "select kafaa_preview_transition_plan('{}'::jsonb)", "select kafaa_rung_alerts('2030')", "select kafaa_save_transition_plan('{}'::jsonb)", "select kafaa_review_transition_plan('{}'::jsonb)",
    "select kafaa_close_transition_plan('{}'::jsonb)", "select kafaa_acknowledge_transition_plan('x')"];
  for (const sql of rpcs) { try { await one(null, sql); } catch { anon++; } }
  ok(anon === rpcs.length, 'grants: anonymous visitors execute none of the FS93 RPCs');
  const pol = await q(`select qual from pg_policies where tablename = 'kafaa_transition_plans' and policyname = 'kafaa_read'`);
  ok(pol.length === 1 && /SELECT kafaa_has_grant/i.test(pol[0].qual) && !/transformation/.test(pol[0].qual), 'RLS: the per-statement policy form, and no rule names transformation (so manager Scope never reads a plan)');
  const text = readFileSync(MIG, 'utf8');
  ok(!BANNED.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(text)) && !/\balter\s+table\s+(?!kafaa_)/i.test(text) && !/\balter\s+policy\s+\w+\s+on\s+(?!kafaa_)/i.test(text) && !/\bupdate\s+(?!kafaa_)\w+\s+set\b/i.test(text),
    'additive: the FS93 migration removes nothing (the words never appear), alters and updates only kafaa_* objects');
}
