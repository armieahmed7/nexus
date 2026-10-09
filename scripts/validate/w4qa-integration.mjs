// [W4 QA · integration] PGlite checks for 20261009149001_kafaa_w4qa_integration.sql: the F28 -> F30 emitter (a recorded crew debrief
// appends exactly one statement per crew member present, none for absentees, the same row the TS emitter builds; nothing during
// seeding), the F31 -> F26 instructor capacity (qualified pool) and the helper grants. The seeded SQL = TS parity of the f28
// statements is part of scripts/validate/w4e4-lrs.mjs (kafaa_xapi_source_rows equals seed.json).
import { readFileSync } from 'node:fs';
import { crewRoster } from '../../src/modules/m04/scenarios.ts';

export default async function w4qaChecks({ db, one, ok }) {
  const T = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables;
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  const rpc = async (persona, sql, p = []) => (await one(persona, sql, p)).r;

  const presentIds = T.crew_debrief_members.filter((m) => m.present === true).map((m) => m.id);
  const present = presentIds.length;
  const seeded = (await q(`select count(*)::int n from kafaa_xapi_statements where source = 'f28_simulator' and source_ref = any($1::text[])`, [presentIds]))[0].n;
  ok(seeded === present && present > 100, `F28 -> F30: the seed holds one simulator statement per present crew member (${seeded})`);

  await db.query(`insert into kafaa_simulator_slots (id, simulator, starts_at, ends_at, crew, booking_kind, priority, status, booked_by) values
    ('sim-w4qa-b', 'FSS-1', date_trunc('day', now()) - interval '1 day' + interval '7 hours', date_trunc('day', now()) - interval '1 day' + interval '15 hours', 'B', 'coct', 1, 'booked', 'p-k-instructor')
    on conflict (id) do nothing`);
  const slot = (await q(`select * from kafaa_simulator_slots where id = 'sim-w4qa-b'`))[0];
  const people = await q('select id, crew, kind, status, job_role_id from kafaa_people');
  const roster = crewRoster(slot, people);
  const att = roster.map((r, i) => ({ person_id: r.person_id, present: i !== 0 }));
  const ratings = { communication: 4, procedure_use: 3, diagnosis: 2, leadership: 5 };
  const before = (await q(`select count(*)::int n from kafaa_xapi_statements where source = 'f28_simulator'`))[0].n;
  const r = await rpc('k-instructor', `select kafaa_record_debrief($1::jsonb) as r`, [JSON.stringify({ slot_id: 'sim-w4qa-b', scenario_id: 'scn-012', cycle_id: null, attendance: att, ratings, lang: 'en' })]);
  ok(r.ok === true, `a debrief is recorded on a past booked slot (${r.code})`);
  const mine = await q(`select * from kafaa_xapi_statements where source = 'f28_simulator' and source_ref like $1 order by id`, [`${r.data?.id}:%`]);
  ok(mine.length === roster.length - 1 && (await q(`select count(*)::int n from kafaa_xapi_statements where source = 'f28_simulator'`))[0].n === before + roster.length - 1,
    `F28 -> F30: the debrief appends one statement per present member (${mine.length} of ${roster.length}), none for the absentee`);
  ok(!mine.some((s) => s.actor_person_id === roster[0].person_id), 'no statement for the crew member marked absent');
  ok(mine.every((s) => s.verb === 'completed' && s.object_type === 'scenario' && s.object_id === 'scn-012' && Number(s.result.score.scaled) === 0.7 && s.result.success === true
    && s.context.extensions['https://kafaa.example/xapi/ext/record'] === `crew_debrief_members/${s.source_ref}`), 'the statements carry the scenario, the mean rating as the score and the member record');
  ok(!mine.some((s) => /critique|strengths|improvements|\bexam(s|ination)?\b/i.test(JSON.stringify(s))), 'no free-text debrief or exam content in the statements');
  ok((await q(`select kafaa_xapi_backfill() n`))[0].n === 0, 'the backfill finds nothing missing after a live debrief (emitter = source rows)');

  const pool = new Set(T.instructor_tracks.filter((x) => x.status === 'qualified').map((x) => x.person_id)).size;
  const rep = await rpc('training-mgr', 'select kafaa_demand_report() as r');
  ok(rep.ok && rep.data.instructors === pool, `F31 -> F26: the needs report counts the qualified instructor pool (${rep.data?.instructors} = ${pool})`);

  let denied = false;
  try { await one('k-admin', `select kafaa_xapi_d_simulator(m, now()) r from kafaa_crew_debrief_members m limit 1`); } catch { denied = true; }
  ok(denied, 'the F28 emitter helper is not executable by API roles');
  ok((await q(`select count(*)::int n from pg_trigger where tgname = 'kafaa_xapi_emit_crew_debriefs'`))[0].n === 1, 'the crew debrief emitter trigger exists');
}
