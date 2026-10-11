// G1 (M01-M03) PGlite checks for supabase/migrations/20261008131000_kafaa_g1_quals_licensing.sql. Called by validate-migrations.mjs
// after the shared checks (so the k-instructor sign-off on qr-p-k-lo-trainee-qs-lo-turbine already exists).
export default async function g1Checks({ db, as, one, count, ok }) {
  console.log('G1 checks (career map, qualification, licensing tracker)');
  const n = async (sql) => Number((await db.query(sql)).rows[0].n);

  // M01: a role cannot publish with an empty source
  try { await db.exec(`update kafaa_job_roles set sources = '[]'::jsonb where id = 'reactor-operator'`); ok(false, 'published role with empty sources is rejected'); }
  catch { ok(true, 'a role cannot publish with an empty source (check constraint)'); }

  // M02: supervisor acknowledgement
  const ev = (await db.query(`select id from kafaa_evaluations where record_id = 'qr-p-k-lo-trainee-qs-lo-turbine' and evaluator_person_id = 'p-k-instructor' order by created_at desc limit 1`)).rows[0];
  ok(!!ev, 'G1 fixture: a fresh evaluation to acknowledge exists');
  const ackI = await one('k-instructor', `select kafaa_ack_evaluation($1, 'x') r`, [ev.id]);
  ok(ackI.r.ok === false && ackI.r.code === 'forbidden', 'an instructor without a supervisor role cannot acknowledge');
  const a0 = await n('select count(*)::int n from kafaa_audit_events');
  const ack = await one('training-mgr', `select kafaa_ack_evaluation($1, 'Observed on shift') r`, [ev.id]);
  const ack2 = await one('training-mgr', `select kafaa_ack_evaluation($1, 'again') r`, [ev.id]);
  ok(ack.r.ok === true && ack2.r.ok === false && ack2.r.code === 'conflict' && (await n('select count(*)::int n from kafaa_audit_events')) >= a0 + 2, 'supervisor acknowledgement recorded once; repeat refused and audited');
  try { await db.exec(`delete from kafaa_evaluation_acks`); ok(false, 'acks are append-only'); } catch { ok(true, 'evaluation acknowledgements are append-only'); }
  ok((await count('sro', 'kafaa_evaluation_acks', "person_id = 'p-k-lo-trainee'")) === 0, 'acknowledgements follow qualification-record RLS (out-of-scope supervisor sees none)');

  // M02: 30-day expiry notice to the person and the manager; matrix shows "due"
  const nt0 = await n(`select count(*)::int n from kafaa_notifications where person_id in ('w-lo-07','p-sro') and kind = 'expiry'`);
  const sw = await one('sro', 'select kafaa_qual_expiry_sweep() r');
  const nt1 = await n(`select count(*)::int n from kafaa_notifications where person_id in ('w-lo-07','p-sro') and kind = 'expiry'`);
  const sw2 = await one('sro', 'select kafaa_qual_expiry_sweep() r');
  const st = (await db.query(`select status from kafaa_qual_records where id = 'qr-w-lo-07-qs-lo-turbine'`)).rows[0].status;
  ok(sw.r.ok && nt1 >= nt0 + 2 && st === 'due' && sw2.r.data.notices === 0, '30 days before expiry: person and manager notified once; record shows due');

  // M02: change impact review after a revision
  const rv = await one('k-instructor', `select kafaa_revise_standard('qs-lo-aux', 'Procedure revision after OE lesson') r`);
  const flagged = (await db.query(`select id from kafaa_qual_records where standard_id = 'qs-lo-aux' and needs_review order by id limit 1`)).rows[0];
  const rq = await one('k-instructor', `select kafaa_review_qual_record($1, 'carry_over', 'No task affecting this person changed') r`, [flagged.id]);
  const moved = (await db.query(`select standard_id, needs_review from kafaa_qual_records where id = $1`, [flagged.id])).rows[0];
  ok(rv.r.ok && rq.r.ok && moved.standard_id === rv.r.data.new_id && moved.needs_review === false, 'revision flags records; review carries a record over to the new version');

  // M03: alerts, availability, medical date, task closing
  const fb = await one('sro', 'select kafaa_licensing_alerts() r');
  ok(fb.r.ok === false && fb.r.code === 'forbidden', 'a shift supervisor cannot raise licensing alerts');
  const al = await one('k-licensing-coord', 'select kafaa_licensing_alerts() r');
  const al2 = await one('k-licensing-coord', 'select kafaa_licensing_alerts() r');
  const tot = (d) => d.renewal + d.proficiency + d.exam_notice + d.withdrawal;
  ok(al.r.ok && al.r.data.proficiency >= 1 && al.r.data.renewal >= 1 && tot(al2.r.data) === 0, `licensing alerts raised (${JSON.stringify(al.r.data)}) and idempotent`);
  ok((await n(`select count(*)::int n from kafaa_licensing_tasks where person_id = 'w-ro-03' and kind = 'proficiency_risk' and status = 'open'`)) === 1, 'RO whose remaining scheduled shifts cannot meet the minimum gets a proficiency task');
  const av = await as('sro', 'select * from kafaa_crew_availability()');
  const crews = (await db.query(`select id, crew from kafaa_people where id = any($1)`, [av.map((r) => r.person_id)])).rows;
  ok(av.length > 0 && crews.every((c) => c.crew === 'B') && av.every((r) => Object.keys(r).sort().join() === 'available,person_id'), 'crew availability: crew B only, available / not available, no medical detail');
  const sw3 = await one('k-licensing-coord', 'select kafaa_detect_licensing_events() r');
  ok(sw3.r.ok, 'licensing sweep (with medical-overdue fix) runs');
  const md = await one('k-licensing-coord', `select kafaa_record_medical_date('w-ro-01', (current_date + 300), 'fit', 'OH record 2026-118') r`);
  ok(md.r.ok && md.r.data.closed >= 1 && (await n(`select count(*)::int n from kafaa_licensing_tasks where person_id = 'w-ro-01' and kind = 'medical_overdue' and status = 'open'`)) === 0, 'mirroring a new medical date closes the overdue task');
  const mdBad = await one('k-licensing-coord', `select kafaa_record_medical_date('w-ro-01', (current_date - 1), 'fit', 'OH record') r`);
  ok(mdBad.r.ok === false && mdBad.r.code === 'invalid', 'a medical date in the past is refused');
  const cl = await one('k-licensing-coord', `select kafaa_close_licensing_task('lt-1', 'no') r`);
  const cl2 = await one('k-licensing-coord', `select kafaa_close_licensing_task('lt-1', 'Lapse report sent by the licensing coordinator via the official channel') r`);
  ok(cl.r.ok === false && cl2.r.ok === true, 'closing a task needs a note of what was done');
  const anon = await as(null, `select has_function_privilege('anon', 'kafaa_licensing_alerts()', 'execute') x`);
  ok(anon[0].x === false, 'G1 write RPCs are not executable by anon');
}
