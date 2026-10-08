// [W1 · E3 · F07] PGlite checks for 20261009113001_kafaa_w1e3_coach.sql: privacy of coach feedback and weekly goals (RLS),
// kafaa_coach_feedback RBAC / validation / 90-day hide / audit without ledger, kafaa_coach_insights RBAC, suppression and
// SQL = TS parity with src/modules/m19/insights.ts, and no secure assessment item referenced by any coach row.
import { readFileSync } from 'node:fs';
import { coachInsightsOf } from '../../src/modules/m19/insights.ts';

export default async function w1e3Checks({ db, ok }) {
  const seed = JSON.parse(readFileSync('src/seed/seed.json', 'utf8'));
  const T = seed.tables;
  // Test identities (test-only NEXUS profiles; reuse a profile another check created for the same persona)
  const extra = { 'k-ro': 'Reactor Operator', 'k-instructor': 'Instructor', 'k-hr-analyst': 'HR analyst', 'training-mgr': 'Training Manager', 'k-auditor': 'Auditor', 'gulfhydro-qa': 'Partner', sro: 'Shift Manager' };
  const uid = {};
  let n = 1130;
  for (const [persona, role] of Object.entries(extra)) {
    const row = (await db.query('select user_id from profiles where persona_id = $1', [persona])).rows[0];
    if (row) uid[persona] = row.user_id;
    else {
      uid[persona] = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
      await db.query('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, 'enec-ops', 'employee', [role]]);
    }
  }
  const as = async (persona, sql, params = []) => {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claims', $1, false)`, [persona ? JSON.stringify({ sub: uid[persona] }) : '']);
    await db.exec(persona ? 'set role authenticated' : 'set role anon');
    try { return (await db.query(sql, params)).rows; } finally { await db.exec('reset role'); }
  };
  const r = async (persona, sql, params) => (await as(persona, sql, params))[0].r;
  const fails = async (persona, sql, params) => { try { await as(persona, sql, params); return false; } catch { return true; } };
  const q = async (sql, params = []) => (await db.query(sql, params)).rows;
  const cnt = async (persona, table, where = 'true') => Number((await as(persona, `select count(*)::int n from ${table} where ${where}`))[0].n);

  // ── seed and privacy (RLS)
  ok(Number((await q('select count(*)::int n from kafaa_coach_feedback'))[0].n) >= T.coach_feedback.length && Number((await q('select count(*)::int n from kafaa_learning_goals'))[0].n) >= T.learning_goals.length,
    `coach seed loaded (${T.coach_feedback.length} feedback rows, ${T.learning_goals.length} weekly goals)`);
  ok((await cnt(null, 'kafaa_coach_feedback')) === 0 && (await cnt(null, 'kafaa_learning_goals')) === 0, 'anonymous visitors read no coach feedback or goals');
  const kro = await as('k-ro', 'select distinct person_id from kafaa_coach_feedback union select distinct person_id from kafaa_learning_goals');
  ok(kro.length === 1 && kro[0].person_id === 'p-k-ro', 'k-ro reads only their own feedback and goal');
  ok((await cnt('sro', 'kafaa_coach_feedback', "person_id <> 'p-sro'")) === 0 && (await cnt('sro', 'kafaa_learning_goals', "person_id <> 'p-sro'")) === 0, 'a line manager (Scope on skills) still reads no team member\'s coach feedback or goal');
  ok((await cnt('k-hr-analyst', 'kafaa_coach_feedback', "person_id <> 'p-k-hr-analyst'")) === 0 && (await cnt('training-mgr', 'kafaa_coach_feedback', "person_id <> 'p-training-mgr'")) === 0,
    'HR and the training manager read no individual coach feedback (aggregates only)');
  ok((await cnt('k-auditor', 'kafaa_learning_goals')) === 0 && (await cnt('gulfhydro-qa', 'kafaa_coach_feedback')) === 0, 'auditors and partners read no coach rows');
  ok(await fails('training-mgr', `insert into kafaa_coach_feedback (id, person_id, item_kind, item_id, signal) values ('x', 'p-k-ro', 'course', 'c-get', 'saved')`), 'coach feedback cannot be written directly (RPC only)');

  // ── weekly goal: direct own writes only, bounded
  ok(!(await fails('k-instructor', `insert into kafaa_learning_goals (id, person_id, hours_per_week) values ('lg:p-k-instructor', 'p-k-instructor', 3) on conflict (id) do update set hours_per_week = 3`)), 'a person can set their own weekly goal');
  ok(await fails('k-instructor', `insert into kafaa_learning_goals (id, person_id, hours_per_week) values ('lg:x', 'p-k-ro', 9)`), 'nobody can set another person\'s goal');
  await as('k-instructor', `update kafaa_learning_goals set hours_per_week = 9 where person_id = 'p-k-ro'`);
  ok(Number((await q(`select hours_per_week from kafaa_learning_goals where person_id = 'p-k-ro'`))[0].hours_per_week) !== 9, 'nobody can change another person\'s goal');
  ok(await fails('k-instructor', `update kafaa_learning_goals set hours_per_week = 50 where person_id = 'p-k-instructor'`) && await fails('k-instructor', `update kafaa_learning_goals set focus_role_ids = array['a','b','c','d'] where person_id = 'p-k-instructor'`),
    'a goal is 0 to 40 hours a week with at most three focus roles');

  // ── kafaa_coach_feedback
  const led0 = Number((await q('select count(*)::int n from ledger_entries'))[0].n);
  const save = await r('k-instructor', `select kafaa_coach_feedback('course', 'c-mcc', 'saved', array['ld-01']) r`);
  const row = (await q(`select * from kafaa_coach_feedback where id = 'cf:p-k-instructor:course:c-mcc'`))[0];
  const aud = (await q(`select outcome, ledger_status, entity_id, reason from kafaa_audit_events where action = 'coach.feedback' order by seq desc limit 1`))[0];
  ok(save.ok && row?.signal === 'saved' && row.competency_ids.join() === 'ld-01' && row.hidden_until === null && aud.outcome === 'ok' && aud.ledger_status === 'not_applicable' && aud.entity_id === row.id,
    'saving a suggestion records one row per person and item, audited without a ledger write');
  const dis = await r('k-instructor', `select kafaa_coach_feedback('course', 'c-mcc', 'dismissed', '{}') r`);
  const hid = (await q(`select hidden_until::text h, (current_date + 90)::text e, (select count(*)::int from kafaa_coach_feedback where id = 'cf:p-k-instructor:course:c-mcc') n from kafaa_coach_feedback where id = 'cf:p-k-instructor:course:c-mcc'`))[0];
  ok(dis.ok && hid.h === hid.e && hid.n === 1 && dis.data.hidden_until === hid.e, 'not relevant hides the suggestion for 90 days (same row updated)');
  const clr = await r('k-instructor', `select kafaa_coach_feedback('course', 'c-mcc', 'cleared') r`);
  ok(clr.ok && (await q(`select hidden_until from kafaa_coach_feedback where id = 'cf:p-k-instructor:course:c-mcc'`))[0].hidden_until === null, 'clearing feedback shows the suggestion again');
  const bad = await r('k-instructor', `select kafaa_coach_feedback('exam', 'it-ro-01', 'saved') r`);
  const bad2 = await r('k-instructor', `select kafaa_coach_feedback('course', '  ', 'saved') r`);
  const bad3 = await r('k-instructor', `select kafaa_coach_feedback('course', 'c-get', 'liked') r`);
  ok(bad.code === 'invalid' && bad2.code === 'invalid' && bad3.code === 'invalid', 'unknown kinds, empty items and unknown signals are refused (invalid)');
  const partner = await r('gulfhydro-qa', `select kafaa_coach_feedback('course', 'c-get', 'saved') r`);
  const auditor = await r('k-auditor', `select kafaa_coach_feedback('course', 'c-get', 'saved') r`);
  const refused = (await q(`select count(*)::int n from kafaa_audit_events where action = 'coach.feedback' and outcome = 'refused'`))[0].n;
  ok(partner.code === 'forbidden' && auditor.code === 'forbidden' && refused >= 5, 'partners and auditors cannot use the coach; refusals are audited');
  ok(await fails(null, `select kafaa_coach_feedback('course', 'c-get', 'saved')`), 'anonymous callers cannot execute the coach RPCs');
  const led1 = Number((await q('select count(*)::int n from ledger_entries'))[0].n);
  ok(led1 === led0, 'coach feedback writes no NEXUS ledger entry');

  // ── kafaa_coach_insights: RBAC, suppression, SQL = TS
  const hr = await r('k-hr-analyst', 'select kafaa_coach_insights() r');
  const tm = await r('training-mgr', 'select kafaa_coach_insights() r');
  const emp = await r('k-ro', 'select kafaa_coach_insights() r');
  ok(hr.ok && tm.ok && emp.code === 'forbidden', 'coach insights: HR (Agg) and the training manager (A) allowed; an employee is refused');
  const cells = [hr.data.total, ...hr.data.by_kind, ...hr.data.by_family];
  ok(cells.every((c) => (c.suppressed ? c.people === null && c.acceptance_pct === null && c.saved === null : c.people >= 10)) && hr.data.by_family.some((c) => c.suppressed) && hr.data.by_kind.some((c) => !c.suppressed),
    'every aggregate cell under 10 people is suppressed (no values); larger cells show counts');
  const fb = await q('select person_id, item_kind, signal from kafaa_coach_feedback');
  const goals = await q('select person_id, hours_per_week from kafaa_learning_goals');
  const people = await q('select id, job_family_id from kafaa_people');
  const ts = coachInsightsOf(fb, goals.map((g) => ({ ...g, hours_per_week: Number(g.hours_per_week) })), people);
  // canonical JSON: sorted keys (jsonb reorders them), numeric strings as numbers
  const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v);
  const norm = (x) => JSON.stringify(canon(x));
  if (norm(ts) !== norm(hr.data)) console.log("TS ", norm(ts).slice(0, 900), "\nSQL", norm(hr.data).slice(0, 900));
  ok(norm(ts) === norm(hr.data), `kafaa_coach_insights equals the TS twin (coachInsightsOf) on the same rows`);

  // ── secure items are never referenced by coach rows
  const secure = await q(`select count(*)::int n from kafaa_coach_feedback f where f.item_id in (select id from kafaa_items where bank = 'secure')
    or (f.item_kind = 'practice' and exists (select 1 from kafaa_assessment_forms a, unnest(a.item_ids) i join kafaa_items it on it.id = i where a.id = f.item_id and it.bank = 'secure'))`);
  const practiceForms = await q(`select count(*)::int n from kafaa_coach_feedback f join kafaa_assessment_forms a on a.id = f.item_id where f.item_kind = 'practice' and not a.is_practice`);
  ok(secure[0].n === 0 && practiceForms[0].n === 0, 'no coach row references a secure item or a non-practice form');
}
