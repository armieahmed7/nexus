// [FS wave F · E4 · FS56 + FS57] PGlite checks for 20261010264001_kafaa_fs64_skill_change_coverage.sql (skill-change effectiveness, curriculum
// coverage, gap-filling backlog). Seed sanity (every stored measure states its method and 90-day window; items under 10 completers carry only
// "suppressed"; no stored cell comes from fewer than 10 people; every uncovered skill and open FS17 gap has a backlog row with an owner);
// SQL = TS parity on the shared database: kafaa_sc_compute = skillChange() (seed date and three more as-of dates, and the stored rows),
// kafaa_cov_taught = taughtBy(), kafaa_cov_roles = coverage(), kafaa_cov_needs = backlogNeeds(), kafaa_cov_whatif = whatIf() (every backlog
// skill x levels 1-3), kafaa_cov_decision_problem = decisionProblem() (generated cases), kafaa_cov_report = coverageReport() (both edit modes),
// kafaa_sc_report = skillChangeReportOf(); a what-if course raises the scores by exactly the predicted amount once it exists; RLS; RPC flows
// and RBAC (inside a rolled-back transaction); grants; additivity.
import { readFileSync } from 'node:fs';
import { skillChange, skillChangeReportOf, skillChangeWorld, MIN_N, WINDOW_DAYS } from '../../src/modules/m25/skillChange.ts';
import { backlogNeeds, coverage, coverageReport, decisionProblem, isActiveStaff, restrictedSkills, taughtBy, whatIf } from '../../src/modules/m25/coverage.ts';

const BANNED = [['dr', 'op'], ['del', 'ete'], ['trun', 'cate']].map((p) => p.join('')); // destructive SQL words, spelled so this file does not contain them
const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${k}:${canon(v[k])}`).join(',')}}` : typeof v === 'number' ? String(Number(v)) : JSON.stringify(v ?? null));
const MIG = 'supabase/migrations/20261010264001_kafaa_fs64_skill_change_coverage.sql';
const iso = (v) => (v instanceof Date ? v.toISOString() : v);
const norm = (rows) => rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, iso(v)])));
const first = (a, b) => { const x = canon(a), y = canon(b); if (x === y) return ''; let i = 0; while (i < x.length && x[i] === y[i]) i++; return ` (SQL …${x.slice(Math.max(0, i - 60), i + 80)} vs TS …${y.slice(Math.max(0, i - 60), i + 80)})`; };

export default async function fs64Checks({ db, one, ok, uid }) {
  console.log('FS wave F · E4 · FS56 skill-change effectiveness + FS57 curriculum coverage and gap backlog');
  await db.exec('reset role');
  const T = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables;
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  const tables = async (names) => Object.fromEntries(await Promise.all(names.map(async (n) => [n, norm(await q(`select * from kafaa_${n}`))])));
  const W = await tables(['skills', 'competencies', 'courses', 'course_skill_links', 'pathways', 'pathway_gaps', 'external_resources', 'job_roles', 'role_profile_versions',
    'training_records', 'enrolments', 'pathway_enrolments', 'skill_evidence', 'people', 'gap_backlog', 'skill_change_measures']);
  const scWorld = { ...W, evidence: W.skill_evidence };
  const seedDay = T.skill_change_measures[0]?.as_of ?? '2026-10-08';

  // ── seed sanity (acceptance FS56 #1, #3; FS57 #2)
  const stored = W.skill_change_measures;
  ok(stored.length === T.skill_change_measures.length && stored.length >= 20 && stored.every((r) => r.window_days === WINDOW_DAYS && (r.measured === null || ['matched', 'before_after'].includes(r.method))),
    `seed: ${stored.length} learning items, every measured one states its comparison method and the ${WINDOW_DAYS}-day window`);
  const small = stored.filter((r) => r.suppressed);
  ok(small.length > 0 && small.every((r) => r.completers === null && r.measured === null && r.before_x100 === null && r.change_x100 === null && r.verdict === 'suppressed' && r.skills.every((s) => s.before_x100 === null)),
    `acceptance (FS56): the ${small.length} courses and pathways with fewer than 10 completers show only "suppressed"`);
  const cells = stored.flatMap((r) => [r.completers, r.measured, r.comparison_people, ...r.skills.map((s) => s.pairs)]).filter((v) => v !== null);
  ok(cells.length > 0 && cells.every((v) => v >= MIN_N), 'seed: no stored count comes from fewer than 10 people');
  ok(stored.some((r) => r.method === 'matched') && stored.some((r) => r.verdict === 'window_open' && r.next_on) && stored.some((r) => r.verdict === 'moves'),
    'seed: the table shows matched comparisons, items still inside their window (with the date the tenth window closes) and items that move skills');

  // ── FS56 parity
  const tsAt = (day) => skillChange(scWorld, day);
  const strip = (rows) => rows.map(({ computed_at, computed_by, ...r }) => ({ ...r, as_of: String(r.as_of).slice(0, 10), next_on: r.next_on ? String(r.next_on).slice(0, 10) : null }));
  // SQL = TS on the live database (earlier validators may have left rows behind, so both read the same live tables); the stored rows = TS on
  // the seed tables (seed.json), which is what the seed builder computed.
  const sql0 = (await q('select kafaa_sc_compute($1::date) j', [seedDay]))[0].j;
  ok(canon(sql0) === canon(tsAt(seedDay)), `SQL kafaa_sc_compute equals skillChange() as of ${seedDay} on the live tables${first(sql0, tsAt(seedDay))}`);
  const tsSeed = skillChange(skillChangeWorld(T), seedDay);
  const storedSorted = strip(stored).sort((a, b) => (a.id < b.id ? -1 : 1));
  ok(canon(storedSorted) === canon([...tsSeed].sort((a, b) => (a.id < b.id ? -1 : 1))), `the ${stored.length} stored rows equal skillChange() on the seed tables as of ${seedDay}${first(storedSorted, [...tsSeed].sort((a, b) => (a.id < b.id ? -1 : 1)))}`);
  const days = ['2026-03-31', '2026-07-15', '2027-01-20'];
  const diffD = [];
  for (const d of days) { const s = (await q('select kafaa_sc_compute($1::date) j', [d]))[0].j; if (canon(s) !== canon(tsAt(d))) diffD.push(d + first(s, tsAt(d))); }
  ok(diffD.length === 0, `SQL kafaa_sc_compute equals skillChange() as of ${days.join(', ')}${diffD.length ? ` (${diffD[0]})` : ''}`);
  const rep = (await q('select kafaa_sc_report(true) j'))[0].j;
  const repTs = skillChangeReportOf(stored, W.courses, W.pathways, true);
  ok(canon(rep) === canon(repTs), `SQL kafaa_sc_report equals skillChangeReportOf() (titles, method, window)${first(rep, repTs)}`);

  // ── FS57 parity
  const restricted = restrictedSkills(W.skills, W.competencies);
  const cov = coverage(W);
  const teachSql = (await q('select kafaa_cov_taught() j'))[0].j;
  const teachTs = [...taughtBy(W)].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([skill_id, items]) => ({ skill_id, items }));
  ok(canon(teachSql) === canon(teachTs) && teachTs.length >= 80, `SQL kafaa_cov_taught equals taughtBy() for ${teachTs.length} skills (courses, pathways with a filled learn step, externals)${first(teachSql, teachTs)}`);
  const rolesSql = (await q('select kafaa_cov_roles(null, null) j'))[0].j;
  ok(canon(rolesSql) === canon(cov.roles) && cov.roles.length >= 50 && cov.roles.some((r) => r.path_only),
    `acceptance (FS57): coverage reproduces from the rule: SQL kafaa_cov_roles equals coverage() for ${cov.roles.length} role profiles (now and 2030, path-only roles unscored)${first(rolesSql, cov.roles)}`);
  const needs = backlogNeeds(cov.roles, W.pathway_gaps, restricted);
  const needsSql = (await q('select kafaa_cov_needs(kafaa_cov_roles(null, null)) j'))[0].j;
  ok(canon(needsSql) === canon(needs), `SQL kafaa_cov_needs equals backlogNeeds() (${needs.length} skill-levels: ${needs.filter((n) => n.roles.length).length} uncovered role requirements, ${needs.filter((n) => n.gap_ids.length).length} with open FS17 gaps)${first(needsSql, needs)}`);
  const ids = new Set(W.gap_backlog.map((r) => r.id));
  const owned = new Map(W.gap_backlog.map((r) => [r.id, r.owner_role]));
  ok(needs.every((n) => ids.has(n.id) && typeof owned.get(n.id) === 'string' && owned.get(n.id).length > 0) && needs.filter((n) => n.roles.length).length > 0,
    `acceptance (FS57): every uncovered skill (and open FS17 gap) appears in the backlog with an owner (${needs.length} of ${W.gap_backlog.length} rows)`);
  const diffW = [];
  const skillsW = [...new Set(W.gap_backlog.map((r) => r.skill_id))].sort();
  for (const s of skillsW) for (const l of [1, 2, 3]) {
    const a = (await q('select kafaa_cov_whatif($1::jsonb, $2, $3) j', [JSON.stringify(cov.roles), s, l]))[0].j;
    if (canon(a) !== canon(whatIf(cov.roles, s, l))) diffW.push(`${s}@${l}`);
  }
  ok(diffW.length === 0, `SQL kafaa_cov_whatif equals whatIf() for ${skillsW.length} backlog skills x levels 1-3${diffW.length ? ` (${diffW[0]})` : ''}`);
  const today = (await q('select current_date::text d'))[0].d;
  for (const [can, label] of [[true, 'training manager'], [false, 'aggregate viewer']]) {
    const a = (await q('select kafaa_cov_report($1::date, $2) j', [today, can]))[0].j;
    const b = coverageReport(W, today, can);
    ok(canon(a) === canon(b), `SQL kafaa_cov_report equals coverageReport() (${label}: ${b.backlog.length} backlog rows with live state, ${b.skills.length} skills, staff list ${b.staff.length})${first(a, b)}`);
  }
  const people = new Map(W.people.map((p) => [p.id, p]));
  const isStaff = (id) => isActiveStaff(people.get(id));
  const row0 = W.gap_backlog.find((r) => r.status === 'open');
  const base = { id: row0.id, route: 'build', owner_role: 'quality', owner_person_id: 'p-training-mgr', due_on: '2027-05-31', rationale: 'Build a short blended module for this skill', plan: { title: 'Blended module', level: 2, hours: 12 } };
  const muts = [{}, { route: 'make' }, { route: 7 }, { route: null }, { owner_role: 'hr' }, { owner_role: null }, { owner_person_id: '' }, { owner_person_id: null }, { owner_person_id: 'w-zz' }, { owner_person_id: 'ap-001' }, { owner_person_id: 42 },
    { due_on: '2026-01-01' }, { due_on: '2031-01-01' }, { due_on: '2027-02-30' }, { due_on: '27-05-31' }, { due_on: 20270531 }, { due_on: today }, { due_on: '2030-12-31' },
    { rationale: 'short' }, { rationale: '   too short   ' }, { rationale: 'x'.repeat(501) }, { rationale: 5 }, { plan: null }, { plan: 'x' }, { plan: [] }, { plan: { title: 'ab', level: 2, hours: 1 } },
    { plan: { title: 'Valid title', level: 4, hours: 10 } }, { plan: { title: 'Valid title', level: 1.5, hours: 10 } }, { plan: { title: 'Valid title', level: 2, hours: 201 } }, { plan: { title: 'Valid title', level: 2, hours: '10' } },
    { plan: { title: ' '.repeat(5), level: 2, hours: 10 } }, { plan: { title: 'Valid title', level: 3, hours: 200 } }];
  const diffP = [];
  for (const m of muts) for (const found of [true, false]) {
    const inp = { ...base, ...m };
    const s = (await q('select kafaa_cov_decision_problem($1::jsonb, $2, $3::date) c', [JSON.stringify(inp), found, today]))[0].c;
    const t = decisionProblem(inp, found ? row0 : undefined, today, isStaff);
    if ((s ?? null) !== t) diffP.push(`${JSON.stringify(m)}/${found}: ${s} vs ${t}`);
  }
  ok(diffP.length === 0, `SQL kafaa_cov_decision_problem equals decisionProblem() on ${muts.length * 2} generated decisions (route, owner, lead, dates, rationale, plan)${diffP.length ? ` (${diffP[0]})` : ''}`);
  const seeded = W.gap_backlog.filter((r) => r.status === 'decided');
  ok(seeded.length >= 5 && seeded.every((r) => canon(r.predicted) === canon(whatIf(cov.roles, r.skill_id, r.plan ? r.plan.level : r.level)) && r.route && r.due_on && r.rationale.length >= 10 && r.rationale_ar),
    `seed: ${seeded.length} decisions carry route, due date, owner, rationale (EN and AR) and the score moves the rule predicts on the final seed`);

  // ── RLS
  const cnt = async (who, sql) => Number((await one(who, sql)).n);
  ok(await cnt(null, 'select count(*)::int n from kafaa_skill_change_measures') === 0 && await cnt(null, 'select count(*)::int n from kafaa_gap_backlog') === 0
    && await cnt('alnoor-gm', 'select count(*)::int n from kafaa_gap_backlog') === 0, 'RLS: anonymous visitors and partners read neither table');
  ok(await cnt('chco', 'select count(*)::int n from kafaa_skill_change_measures') === stored.length && await cnt('k-auditor', 'select count(*)::int n from kafaa_gap_backlog') === W.gap_backlog.length
    && await cnt('training-mgr', 'select count(*)::int n from kafaa_gap_backlog') === W.gap_backlog.length, 'RLS: learning-analytics holders (HR aggregate, auditors, the training manager) read the stored aggregates and the backlog');

  // ── RPC flows (rolled back)
  await db.exec('begin');
  try {
    const r = async (who, sql, p = []) => (await one(who, sql, p)).r;
    const led = async () => Number((await q('select count(*)::int n from ledger_entries'))[0].n);
    const aud = async () => Number((await q('select count(*)::int n from kafaa_audit_events'))[0].n);
    const repH = await r('chco', 'select kafaa_skill_change_report() r');
    const repN = await r('k-ecp', 'select kafaa_skill_change_report() r');
    ok(repH.ok && repH.data.rows.length === stored.length && repH.data.can_compute === false && repN.code === 'forbidden', 'skillChangeReport: HR aggregate viewers read it; staff without a learning-analytics aggregate grant are refused');
    const a0 = await aud();
    const cF = await r('chco', 'select kafaa_compute_skill_change() r');
    const cT = await r('training-mgr', 'select kafaa_compute_skill_change() r');
    const after = norm(await q('select * from kafaa_skill_change_measures'));
    ok(cF.code === 'forbidden' && cT.ok && cT.data.as_of === today && (await aud()) === a0 + 2 && canon(strip(after).sort((a, b) => (a.kind + a.item_id < b.kind + b.item_id ? -1 : 1))) === canon(tsAt(today)),
      `computeSkillChange: training manager only (refusal audited); recomputes every row as of today (${cT.data?.rows} items, ${cT.data?.measured} measured) exactly as skillChange()`);
    const covS = await r('sro', 'select kafaa_curriculum_coverage() r');
    const covE = await r('k-ecp', 'select kafaa_curriculum_coverage() r');
    const covT = await r('training-mgr', 'select kafaa_curriculum_coverage() r');
    ok(covS.ok && covS.data.can_edit === false && covS.data.staff.length === 0 && covE.code === 'forbidden' && covT.ok && covT.data.can_edit === true && covT.data.staff.length > 0,
      'curriculumCoverage: managers and HR read it (no staff list, no edit); the training manager edits; others are refused');
    const target = W.gap_backlog.find((r) => r.status === 'open' && needs.find((n) => n.id === r.id)?.roles.length);
    const inp = { id: target.id, route: 'build', owner_role: 'nuclear_training', owner_person_id: 'p-training-mgr', due_on: '2027-06-30', rationale: 'Build it in house with the instructors', plan: { title: 'In-house module', level: 2, hours: 10 } };
    const dF = await r('chco', 'select kafaa_decide_gap($1::jsonb) r', [JSON.stringify(inp)]);
    const dBad = await r('training-mgr', 'select kafaa_decide_gap($1::jsonb) r', [JSON.stringify({ ...inp, due_on: '2031-01-01' })]);
    const dNo = await r('training-mgr', 'select kafaa_decide_gap($1::jsonb) r', [JSON.stringify({ ...inp, id: 'gb:zz:1' })]);
    const l0 = await led();
    const d = await r('training-mgr', 'select kafaa_decide_gap($1::jsonb) r', [JSON.stringify(inp)]);
    const saved = (await q('select * from kafaa_gap_backlog where id = $1', [target.id]))[0];
    const pred = whatIf(cov.roles, target.skill_id, 2);
    ok(dF.code === 'forbidden' && dBad.code === 'invalid' && dNo.code === 'not_found' && d.ok && (await led()) === l0 + 1 && saved.status === 'decided' && saved.route === 'build'
      && canon(saved.predicted) === canon(pred) && canon(d.data.predicted) === canon(pred) && pred.length > 0,
      `decideGap: training manager only; invalid dates refused; a decision stores owner, date, route, plan and the predicted moves (${pred.length} profiles) and writes the ledger`);
    // acceptance FS57 #3: the what-if is not saved until confirmed, and once the course exists the scores move by exactly the predicted amount
    const before = (await q('select kafaa_cov_roles(null, null) j'))[0].j;
    await db.exec(`insert into kafaa_courses (id, code, title_en, title_ar, modality, audience, competency_ids, qualifying) values ('c-fs64-test', 'FS64-T', 'What-if test course', 'دورة اختبار', 'classroom', 'staff', '{}', false)`);
    await db.query(`insert into kafaa_course_skill_links (id, course_id, skill_id, level, objective_n, objective_en, objective_ar, active) values ('csl-fs64-test', 'c-fs64-test', $1, 2, 1, 'Test objective', 'هدف اختبار', true)`, [target.skill_id]);
    const now = (await q('select kafaa_cov_roles(null, null) j'))[0].j;
    const moved = now.filter((x, i) => x.score !== before[i].score).map((x) => ({ role_id: x.role_id, horizon: x.horizon, after: x.score }));
    ok(canon(canon(before) === canon(cov.roles) ? moved : []) === canon(pred.map((m) => ({ role_id: m.role_id, horizon: m.horizon, after: m.after }))),
      `acceptance (FS57): a planned course raises the scores by exactly the amount the rule predicted (${pred.map((m) => `+${m.delta}`).join(' ')}), and nothing moved before the course existed`);
    const s0 = await r('training-mgr', 'select kafaa_sync_gap_backlog() r');
    const fresh = W.skills.filter((k) => !restricted.has(k.id) && !ids.has(`gb:${k.id}:3`)).sort((a, b) => (a.id < b.id ? -1 : 1))[0];
    await db.query(`insert into kafaa_pathway_gaps (id, pathway_id, step_id, skill_id, level, kind, status, first_seen, last_checked) values ('pg:fs64-test', 'pw-tr-analytical-l1', 'pw-tr-analytical-l1:v1:s9', $1, 3, 'assess', 'open', current_date, current_date)`, [fresh.id]);
    const s1 = await r('training-mgr', 'select kafaa_sync_gap_backlog() r');
    const nr = (await q(`select owner_role, status, first_seen::text f from kafaa_gap_backlog where id = $1`, [`gb:${fresh.id}:3`]))[0];
    const sF = await r('sro', 'select kafaa_sync_gap_backlog() r');
    ok(s0.ok && s0.data.created === 0 && s1.ok && s1.data.created === 1 && nr?.owner_role === (fresh.owner_role || 'nuclear_training') && nr.status === 'open' && nr.f === today && sF.code === 'forbidden',
      `syncGapBacklog: nothing is missing after the seed; a new open FS17 gap gets a backlog row with the skill's owner function; training manager only${s1.ok && s1.data?.created === 1 ? '' : ` (${JSON.stringify(s1)} ${JSON.stringify(nr)} ${sF.code})`}`);
  } finally { await db.exec('rollback'); }

  // ── grants and additivity
  let denied = 0;
  const helpers = ['select kafaa_cov_roles(null, null)', 'select kafaa_sc_compute(current_date)', 'select kafaa_cov_taught()', 'select kafaa_cov_report(current_date, true)', 'select kafaa_sc_report(true)', 'select kafaa_cov_needs(\'[]\'::jsonb)'];
  for (const sql of helpers) { try { await one('training-mgr', sql); } catch { denied++; } }
  ok(denied === helpers.length, 'grants: internal helpers are not executable by signed-in users');
  let anon = 0;
  for (const sql of ['select kafaa_skill_change_report()', 'select kafaa_curriculum_coverage()', 'select kafaa_decide_gap(\'{}\'::jsonb)', 'select kafaa_sync_gap_backlog()', 'select kafaa_compute_skill_change()']) { try { await one(null, sql); } catch { anon++; } }
  ok(anon === 5, 'grants: anonymous visitors execute none of the FS64 RPCs');
  const text = readFileSync(MIG, 'utf8');
  ok(!BANNED.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(text)) && !/\balter\s+table\s+(?!kafaa_)/i.test(text) && !/\balter\s+policy\s+\w+\s+on\s+(?!kafaa_)/i.test(text),
    'additive: the FS64 migration removes nothing (the words never appear) and alters only kafaa_* tables and policies');
}
