// G2 (M04 learning, M05 assessments): RLS and RPC checks against PGlite. Loaded by scripts/validate-migrations.mjs.
export default async function g2Checks({ db, ok }) {
  // Extra test identities (test-only NEXUS profiles; Kafa'a-only personas get one here too)
  const extra = { 'k-lo-trainee': 'Local Operator trainee', 'k-ro': 'Reactor Operator', 'ops-ceo': 'CEO ENEC Operations', sro: 'Shift Manager', 'training-mgr': 'Training Manager', 'k-instructor': 'Instructor' };
  const uid = {};
  let n = 900;
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
  const fails = async (persona, sql) => { try { await as(persona, sql); return false; } catch { return true; } };

  // ── M05 separation of duties and item security
  const own = await r('training-mgr', `select kafaa_item_review('it-get-13', 'approve') r`);
  ok(own.ok === false && own.code === 'maker_checker', 'G2: the item writer cannot approve their own item (maker_checker, audited)');
  const rev = await r('k-instructor', `select kafaa_item_review('it-reactor-theory-11', 'review') r`);
  const app = await r('training-mgr', `select kafaa_item_review('it-reactor-theory-11', 'approve') r`);
  ok(rev.ok && app.ok, 'G2: writer, reviewer and approver are three different people (review then approve succeeds)');
  ok(await fails('k-instructor', `insert into kafaa_items (id, bank, topic, current_version, status, writer_person_id) values ('it-x', 'secure', 'x', 1, 'approved', 'p-k-instructor')`), 'G2: items cannot be written directly (RPC only)');
  const secret = 'ZETA-SECURE-STEM-7731';
  const saved = await r('k-instructor', `select kafaa_save_item($1::jsonb) r`, [JSON.stringify({ bank: 'secure', topic: 'Reactor theory', competency_id: 'pf-01', difficulty: 'medium', reference: 'Generic', stem_en: `${secret} what is k-eff?`, stem_ar: `${secret} ما هو؟`, options: [{ id: 'a', en: 'One', ar: 'واحد' }, { id: 'b', en: 'Two', ar: 'اثنان' }], answer: 'a', rationale_en: '', rationale_ar: '', change_note: 'test' })]);
  const leak = (await db.query(`select count(*)::int n from kafaa_audit_events where reason ilike '%' || $1 || '%' or action ilike '%' || $1 || '%' or coalesce(entity_id, '') ilike '%' || $1 || '%'`, [secret])).rows[0].n;
  ok(saved.ok && leak === 0, 'G2: secure item text never appears in the audit log');
  ok((await as(null, `select count(*)::int n from kafaa_item_versions where stem_en like '${secret}%'`))[0].n === 0 && (await as('k-lo-trainee', `select count(*)::int n from kafaa_item_versions where stem_en like '${secret}%'`))[0].n === 0, 'G2: secure item text is readable only by the item bank roles');

  // ── M04 enrolment, approvals, waitlist
  const req = await r('sro', `select kafaa_decide_enrolment((select id from kafaa_enrolments where person_id = 'w-ro-01' and course_id = 'c-apr'), 'approve', '') r`);
  ok(req.ok && ['enrolled', 'waitlisted'].includes(req.data.status), 'G2: crew B manager approves an elective request in scope');
  const selfReq = await r('k-ro', `select kafaa_enrol_course('c-apr', 's-apr', null) r`);
  ok(selfReq.ok && selfReq.data.status === 'requested', 'G2: a learner choosing an elective sends a request for approval');
  const selfApprove = await r('k-ro', `select kafaa_decide_enrolment('${selfReq.data.id}', 'approve', '') r`);
  ok(!selfApprove.ok && selfApprove.code === 'forbidden', 'G2: learners cannot approve their own request');
  ok(await fails('k-ro', `update kafaa_enrolments set status = 'completed', certificate_no = 'KAF-2026-999999' where person_id = kafaa_me()`), 'G2: a learner cannot mark their own enrolment completed directly (guard trigger)');
  const wl = await r('training-mgr', `select kafaa_cancel_enrolment((select id from kafaa_enrolments where person_id = 'w-ro-01' and course_id = 'c-sam'), 'Crew rescheduled for outage') r`);
  const promoted = (await db.query(`select status from kafaa_enrolments where person_id = 'w-ro-05' and course_id = 'c-sam'`)).rows[0].status;
  ok(wl.ok && wl.data.promoted && promoted === 'enrolled', 'G2: cancelling a seat promotes the first person on the waitlist');

  // ── M04 completion gate: qualifying course needs its linked evaluation; certificate only after a pass
  const enr = (await db.query(`select id from kafaa_enrolments where person_id = 'p-k-lo-trainee' and course_id = 'c-hu'`)).rows[0].id;
  const noAtt = await r('k-instructor', `select kafaa_complete_enrolment('${enr}', 'passed', 90, '') r`);
  ok(!noAtt.ok, 'G2: completion needs attendance evidence first');
  const att = await r('k-instructor', `select kafaa_record_attendance('s-hu-past', $1::jsonb) r`, [JSON.stringify([{ enrolment_id: enr, attendance: 'present' }])]);
  const gate = await r('k-instructor', `select kafaa_complete_enrolment('${enr}', 'passed', 90, '') r`);
  ok(att.ok && !gate.ok && gate.code === 'evaluation_required', 'G2: a qualifying course cannot complete without its linked evaluation');
  const start = await r('k-lo-trainee', `select kafaa_start_attempt('at-5') r`);
  const delivered = start.data?.items ?? [];
  ok(start.ok && delivered.length === 6 && delivered.every((i) => !('answer' in i) && !('rationale_en' in i)), 'G2: exam delivery sends items without the key');
  const keys = (await db.query(`select v.item_id, v.answer from kafaa_item_versions v join kafaa_items i on i.id = v.item_id and i.current_version = v.version where v.item_id = any($1)`, [delivered.map((i) => i.item_id)])).rows;
  const sub = await r('k-lo-trainee', `select kafaa_submit_attempt('at-5', $1::jsonb) r`, [JSON.stringify(keys.map((k) => ({ item_id: k.item_id, answer: k.answer })))]);
  ok(sub.ok && (await as('k-lo-trainee', `select count(*)::int n from kafaa_responses`))[0].n === 0, 'G2: candidates submit but cannot read stored responses');
  const fbEarly = await r('k-lo-trainee', `select kafaa_attempt_feedback('at-5') r`);
  ok(!fbEarly.ok, 'G2: the result stays hidden until an evaluator releases it');
  const selfRel = await r('k-lo-trainee', `select kafaa_release_attempt('at-5', '') r`);
  const rel = await r('k-instructor', `select kafaa_release_attempt('at-5', 'Reviewed') r`);
  const fb = await r('k-lo-trainee', `select kafaa_attempt_feedback('at-5') r`);
  ok(!selfRel.ok && rel.ok && fb.ok && fb.data.score === 100, 'G2: an evaluator releases the result; the candidate then sees score and competency feedback');
  const done = await r('k-instructor', `select kafaa_complete_enrolment('${enr}', 'passed', null, 'HU core tools') r`);
  const cert = done.data?.certificate_no;
  const verify = cert ? (await as(null, `select kafaa_verify_certificate('${cert}') r`))[0].r : null;
  ok(done.ok && /^KAF-\d{4}-\d{6}$/.test(cert ?? '') && verify?.found === true, 'G2: passing with a released evaluation completes the course and issues a verifiable certificate');
  const selfDone = await r('k-instructor', `select kafaa_complete_enrolment((select id from kafaa_enrolments where person_id = 'p-k-instructor' and status in ('assigned','in_progress','enrolled') limit 1), 'passed', 95, '') r`);
  ok(!selfDone.ok && selfDone.code === 'self_sign', 'G2: an instructor cannot record completion of their own training');

  // ── M04 simulator priority (existing RPC) and curriculum sync after a role change
  const coct = (await db.query(`select id from kafaa_simulator_slots where booking_kind = 'coct' limit 1`)).rows[0].id;
  const disp = await r('training-mgr', `select kafaa_book_simulator('${coct}', 'elective', 'A') r`);
  ok(!disp.ok && disp.code === 'conflict', 'G2: a COCT booking cannot be displaced by an elective booking');
  await db.query(`update kafaa_people set job_role_id = 'reactor-operator' where id = 'w-lo-08'`);
  const sync = await r('training-mgr', `select kafaa_curriculum_sync('w-lo-08') r`);
  const coctNow = (await db.query(`select count(*)::int n from kafaa_enrolments where person_id = 'w-lo-08' and course_id = 'c-coct' and status = 'assigned'`)).rows[0].n;
  ok(sync.ok && sync.data.assigned > 0 && coctNow === 1, 'G2: a role change assigns the new role\'s mandatory curriculum within one sync cycle');

  // ── M05 retakes and appeals
  const retake = await r('training-mgr', `select kafaa_schedule_attempt('form-reactor-theory', 'w-lo-04', now() + interval '1 day', null) r`);
  const again = await r('training-mgr', `select kafaa_schedule_attempt('form-reactor-theory', 'w-lo-04', now() + interval '2 day', null) r`);
  ok(retake.ok && retake.data.attempt_no === 2 && !again.ok && again.code === 'result_pending', 'G2: retake rules allow one retake at a time');
  const passedAgain = await r('training-mgr', `select kafaa_schedule_attempt('form-reactor-theory', 'p-k-ro', now() + interval '1 day', null) r`);
  ok(!passedAgain.ok && passedAgain.code === 'already_passed', 'G2: no retake after a pass');
  const appeal = await r('training-mgr', `select kafaa_decide_appeal('ap-1', 'upheld', 'Arabic wording ambiguous; item voided', array['it-reactor-theory-07']) r`);
  const at4 = (await db.query(`select score, counts, voided_item_ids from kafaa_attempts where id = 'at-4'`)).rows[0];
  ok(appeal.ok && Number(at4.score) === 78 && at4.counts === false && at4.voided_item_ids.includes('it-reactor-theory-07'), 'G2: an upheld appeal voids the item and rescores the attempt');

  // ── decisions only through RPCs (guard triggers)
  ok(await fails('k-ro', `update kafaa_external_requests set status = 'approved' where id = 'xr-1'`), 'G2: a learner cannot approve their own external request directly');
  ok(!(await fails('k-ro', `insert into kafaa_external_requests (id, person_id, title, provider, justification, status) values ('xr-t1', kafaa_me(), 'Course', 'Provider', 'Needed', 'requested')`))
    && await fails('k-ro', `insert into kafaa_external_requests (id, person_id, title, provider, justification, status) values ('xr-t2', kafaa_me(), 'Course', 'Provider', 'Needed', 'approved')`), 'G2: learners can request external courses but cannot insert an approved request');
  ok(!(await fails('k-lo-trainee', `insert into kafaa_mentoring_requests (id, person_id, mentor_id, mentor_person_id, interest, status) values ('mr-t1', kafaa_me(), 'mt-2', 'w-ss-01', 'leadership', 'requested')`))
    && await fails('k-lo-trainee', `update kafaa_mentoring_requests set status = 'matched' where id = 'mr-t1'`), 'G2: mentoring requests are created by the learner and accepted only by the mentor');
  ok(await fails('k-lo-trainee', `update kafaa_dev_plans set status = 'active' where id = 'dp-k-lo'`), 'G2: a learner cannot activate their own development plan directly');
  const dp = await r('ops-ceo', `select kafaa_decide_dev_plan('dp-k-lo', 'approve', '') r`);
  ok(dp.ok, 'G2: a manager in scope approves a submitted development plan');

  // ── grants
  ok(await fails(null, `select kafaa_enrol_course('c-get', null, null)`), 'G2: anonymous callers cannot execute the G2 RPCs');
}
