// [FS QA · wave B integration] PGlite checks for 20261010229001_kafaa_fs2qa_integration.sql (cross-feature wiring of FS07-FS16).
//  1. F35 supply never counts FS02 future-skill states: kafaa_so_base is unchanged when every FS02 state is removed, the stored
//     outlooks equal kafaa_so_for (w5e4 checks every one; here the stress test again reads "every family in scope falls short").
//  2. F36/F37: a concept role shortlisted first never becomes the digest's target (kafaa_dg_gather output unchanged, TS
//     defaultTargetRole likewise).
//  3. F12: a shortlisted concept role reads its FS05-profile readiness in the agenda (SQL kafaa_cc_agenda = TS buildAgenda, and
//     equal to kafaa_fs15_concept_readiness_compute; never F05's 0 %).
//  4. F23: kafaa_res_snapshot = TS snapshotFrom for every person, with no FS02 skill in any snapshot.
//  5. F26 data: forward proof (rows put back to the values loaded live become the seed), idempotent, guarded.
//  6. Grants: the redefined internals stay closed to anon and authenticated.
// Runs on its own fresh PGlite (migrations + seed once), because earlier validators write targets and evidence.
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const FILE = 'supabase/migrations/20261010229001_kafaa_fs2qa_integration.sql';

export default async function fsqa2Checks({ ok }) {
  const C = await import('../../src/modules/m18/conversations.ts');
  const R = await import('../../src/shell/digest/rules.ts');
  const RS = await import('../../src/modules/m20/reserve.ts');
  const seed = JSON.parse(readFileSync('src/seed/seed.json', 'utf8'));
  const T = seed.tables;
  const now = seed.meta.demo_today;
  const db = new PGlite();
  await db.exec(readFileSync('supabase/tests/nexus_stubs.sql', 'utf8'));
  for (const m of readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()) await db.exec(readFileSync(`supabase/migrations/${m}`, 'utf8'));
  await db.exec(readFileSync('supabase/seed.sql', 'utf8'));
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  const q1 = async (sql, p = []) => (await q(sql, p))[0];
  const norm = (x) => JSON.stringify(x, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((kk) => [kk, v[kk]])) : v));
  const sql = readFileSync(FILE, 'utf8');
  const concept = T.job_roles.filter((r) => r.lifecycle === 'concept').map((r) => r.id);
  const staff = T.people.filter((p) => p.kind === 'staff' && p.status === 'active');

  // 1. F35
  await db.exec('begin');
  try {
    const before = norm((await q1('select kafaa_so_base(null) b')).b);
    const n = (await q1(`select count(*)::int n from kafaa_person_skills where skill_id in (select id from kafaa_skills where fs_area is not null) and level >= 1`)).n;
    await db.exec(`select set_config('kafaa.seeding', 'on', true); update kafaa_person_skills set level = 0, active = false where skill_id in (select id from kafaa_skills where fs_area is not null)`);
    const after = norm((await q1('select kafaa_so_base(null) b')).b);
    ok(n > 500 && before === after, `F35: kafaa_so_base is the same with and without the ${n} FS02 skill states (fitness-check evidence is not supply)`);
  } finally { await db.exec('rollback'); }
  const stress = T.skill_outlooks.find((o) => o.id === 'so-attrition-stress');
  ok(stress.results.totals.families_short === stress.results.totals.visible, `F35: the stress test's summary holds again (${stress.results.totals.families_short} of ${stress.results.totals.visible} visible families fall short)`);
  const storedOk = [];
  for (const o of T.skill_outlooks) storedOk.push(norm((await q1('select kafaa_so_for($1::jsonb) r', [JSON.stringify(o.params)])).r.result) === norm(o.results));
  ok(storedOk.every(Boolean), `F35: all ${T.skill_outlooks.length} stored outlooks equal kafaa_so_for after the QA migration`);

  // 2. F36/F37 digest target
  const tsSame = staff.every((p) => {
    const short = T.career_targets.filter((t) => t.person_id === p.id && t.active !== false).sort((a, b) => a.rank - b.rank).map((t) => t.role_id);
    return R.defaultTargetRole(T.career_paths, p.job_role_id ?? null, [concept[0], ...short]) === R.defaultTargetRole(T.career_paths, p.job_role_id ?? null, short);
  });
  let dgDiff = 0, dgN = 0;
  const sample = staff.filter((p) => p.job_role_id).slice(0, 40);
  for (const p of sample) {
    const a = norm((await q1('select kafaa_dg_gather($1, $2::date, $3::jsonb) r', [p.id, now, '{}'])).r);
    await db.exec('begin');
    try {
      await q(`select set_config('kafaa.seeding', 'on', true)`);
      await q(`insert into kafaa_career_targets (id, person_id, role_id, rank, shared, active) values ($1, $2, $3, -1, false, true)`, [`ct:qa2:${p.id}`, p.id, concept[0]]);
      const b = norm((await q1('select kafaa_dg_gather($1, $2::date, $3::jsonb) r', [p.id, now, '{}'])).r);
      dgN++;
      if (a !== b) dgDiff++;
    } finally { await db.exec('rollback'); }
  }
  ok(tsSame && dgDiff === 0 && dgN === sample.length, `F36: a concept role shortlisted first never becomes the digest target (TS for ${staff.length} staff; SQL kafaa_dg_gather unchanged for ${dgN})`);

  // 3. F12 agenda with a shared concept target
  const pid = 'p-k-ro', role = 'fr-bwr-operator';
  const tgt = { id: 'ct:qa2:p-k-ro', person_id: pid, role_id: role, rank: 0, shared: true, active: true };
  const tablesFor = (id, extra) => ({
    people: T.people, roles: T.job_roles, edges: T.career_paths, roleComps: T.role_competencies, competencies: T.competencies, skills: T.skills,
    states: T.person_skills.filter((s) => s.person_id === id), licences: T.licences, standards: T.qual_standards, qualRecords: T.qual_records, programmes: T.programmes,
    courses: T.courses, trainingRecords: T.training_records, enrolments: T.enrolments, weights: T.engine_settings.find((s) => s.id === 'recommend')?.weights,
    skillRows: T.skills, competencyRows: T.competencies, personSkills: T.person_skills, targets: [...T.career_targets, ...extra], roadmaps: T.roadmaps, qualRows: T.qual_records,
    standardRows: T.qual_standards, goals: T.learning_goals, feedback: T.coach_feedback, training: T.training_records, conversations: T.career_conversations, versions: T.role_profile_versions,
  });
  await db.exec('begin');
  try {
    await q(`select set_config('kafaa.seeding', 'on', true)`);
    await q(`insert into kafaa_career_targets (id, person_id, role_id, rank, shared, active) values ($1, $2, $3, $4, $5, $6)`, [tgt.id, pid, role, tgt.rank, tgt.shared, tgt.active]);
    let diff = 0;
    for (const shared of [false, true]) {
      const s = (await q1('select kafaa_cc_agenda($1, true, true, $2, $3, $4::date) r', [pid, !shared, shared, now])).r;
      const t = C.buildAgenda(tablesFor(pid, [tgt]), pid, { targets: true, roadmap: true, coach: !shared, sharedOnly: shared }, now);
      if (norm(s) !== norm(t)) diff++;
    }
    const ag = (await q1('select kafaa_cc_agenda($1, true, true, false, true, $2::date) r', [pid, now])).r;
    const x = ag.targets.find((y) => y.role_id === role);
    const cr = (await q1('select kafaa_fs15_concept_readiness_compute($1, $2::text[], $3::date) r', [pid, [role], now])).r[0];
    ok(diff === 0 && x?.concept === true && x.pct === cr.pct && x.pct > 0 && x.band === cr.band && x.gate_status === 'none',
      `F12: a shared concept target reads its FS05-profile readiness in the agenda (${x?.pct} %, ${x?.band}; SQL = TS in the own and manager views)`);
  } finally { await db.exec('rollback'); }

  // 4. F23 snapshots
  const fsSkills = new Set(T.skills.filter((s) => s.fs_area).map((s) => s.id));
  let snDiff = 0;
  const holders = [...new Set(T.alumni.map((a) => a.person_id).filter(Boolean)), ...staff.slice(0, 60).map((p) => p.id)];
  for (const p of holders) {
    const s = (await q1('select kafaa_res_snapshot($1) r', [p])).r;
    const t = RS.snapshotFrom(T.person_skills.filter((x) => x.person_id === p), T.skills);
    if (norm(s) !== norm(t) || s.some((x) => fsSkills.has(x.skill_id))) snDiff++;
  }
  const noFs = T.alumni.every((a) => (a.skill_snapshot ?? []).every((x) => !fsSkills.has(x.skill_id)));
  ok(snDiff === 0 && noFs, `F23: kafaa_res_snapshot = snapshotFrom for ${holders.length} people; no FS02 skill in any snapshot (seeded reserve members included)`);

  // 5. F26 data: forward proof, idempotent, guarded
  const dm = [...sql.matchAll(/update kafaa_demand_snapshots set count = (\d+), detail = '([^']*)'::jsonb where id = '([^']+)' and count = (\d+) and detail = '([^']*)'::jsonb/g)];
  const sp = [...sql.matchAll(/update kafaa_session_proposals set demand = (\d+), shortfall = (\d+) where id = '([^']+)' and demand = (\d+) and shortfall = (\d+)/g)];
  const dig = async () => (await q1(`select md5(string_agg(x::text, '|' order by x.id collate "C")) d from (select id, count, detail::text from kafaa_demand_snapshots union all select id, demand, shortfall::text from kafaa_session_proposals) x`)).d;
  const final = await dig();
  ok(dm.length === 4 && sp.length === 1, 'F26: the migration names the four 2027-Q1 future demand snapshots and one session proposal');
  await db.exec('begin');
  try {
    await q(`select set_config('kafaa.seeding', 'on', true)`);
    for (const [, , , id, oc, od] of dm) await q(`update kafaa_demand_snapshots set count = $2, detail = $3::jsonb where id = $1`, [id, Number(oc), od]);
    for (const [, , , id, od, os] of sp) await q(`update kafaa_session_proposals set demand = $2, shortfall = $3 where id = $1`, [id, Number(od), Number(os)]);
    const live = await dig();
    await db.exec(sql);
    const after = await dig();
    await db.exec(sql);
    ok(live !== final && after === final && (await dig()) === final, 'F26: rows at their live values become the seed after the migration (SQL = TS seed); a second run changes nothing');
    await q(`update kafaa_session_proposals set demand = 61 where id = $1`, [sp[0][3]]);
    await db.exec(sql);
    ok((await q1('select demand from kafaa_session_proposals where id = $1', [sp[0][3]])).demand === 61, 'F26: guarded: a proposal edited live is left alone');
  } finally { await db.exec('rollback'); }
  ok(!/\b(drop|delete|truncate|alter)\b/i.test(sql.replace(/--.*$/gm, '')), 'the QA migration has no drop, delete, truncate or alter');

  // 6. grants
  const ex = async (role, fn) => (await q1(`select has_function_privilege($1, $2, 'execute') x`, [role, fn])).x;
  const fns = ['kafaa_so_base(text)', 'kafaa_dg_gather(text, date, jsonb)', 'kafaa_cc_agenda(text, boolean, boolean, boolean, boolean, date)', 'kafaa_res_snapshot(text)'];
  let open = 0;
  for (const f of fns) for (const r of ['anon', 'authenticated']) if (await ex(r, f)) open++;
  ok(open === 0, 'the four redefined internal functions stay closed to anon and authenticated');
  await db.close();
}
