// [W5 QA · integration] PGlite checks for 20261009159001_kafaa_w5qa_integration.sql: the F38 -> F36 digest approvals.
// A practice entry naming me as preceptor is an approval item in my digest until I acknowledge it (never before its date);
// an evaluation request addressed to me is one while it is open. SQL = TS for every seeded person is in w5e5-digest-dalil.mjs.
export default async function w5qaChecks({ db, one, ok }) {
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  const ids = async (person) => ((await q(`select kafaa_dg_gather($1, current_date, '{}'::jsonb) r`, [person]))[0].r || []).map((i) => i.id);
  const tpl = (await q(`select * from kafaa_ojt_logs where preceptor_person_id = 'p-sq-lead' order by id limit 1`))[0];
  ok(!!tpl, 'a seeded OJT log names p-sq-lead as preceptor');
  if (!tpl) return;
  await q(`insert into kafaa_ojt_logs (id, client_key, person_id, person_name, task_id, standard_id, on_date, mode, preceptor_person_id, preceptor_name, confidence, status, synced)
    values ('ojt-w5qa-1', 'ojt:w5qa:1', $1, $2, $3, $4, current_date, 'perform', 'p-sq-lead', $5, 3, 'pending_ack', 'online'),
           ('ojt-w5qa-2', 'ojt:w5qa:2', $1, $2, $3, $4, current_date + 1, 'perform', 'p-sq-lead', $5, 3, 'pending_ack', 'online') on conflict (id) do nothing`,
    [tpl.person_id, tpl.person_name, tpl.task_id, tpl.standard_id, tpl.preceptor_name]);
  let mine = await ids('p-sq-lead');
  ok(mine.includes('approval:ojt_logs:ojt-w5qa-1') && !mine.includes('approval:ojt_logs:ojt-w5qa-2'), 'F38 -> F36: a pending practice entry is an approval item for its preceptor; a future-dated one is not');
  ok(!(await ids(tpl.person_id)).includes('approval:ojt_logs:ojt-w5qa-1'), 'the trainee gets no approval item for their own entry');
  const item = ((await q(`select kafaa_dg_gather('p-sq-lead', current_date, '{}'::jsonb) r`))[0].r).find((i) => i.id === 'approval:ojt_logs:ojt-w5qa-1');
  ok(item?.link === '/my/ojt?tab=acknowledge' && item.why?.[0]?.code === 'approval_ojt_ack' && item.urgency === 2, 'the item links to the acknowledge tab with its reason');
  const r = (await one('sq-lead', 'select kafaa_ack_practice($1::jsonb) r', [JSON.stringify({ log_id: 'ojt-w5qa-1', decision: 'acknowledge', feedback: 'Steps followed; good place-keeping', ready: false })])).r;
  mine = await ids('p-sq-lead');
  ok(r.ok === true && !mine.includes('approval:ojt_logs:ojt-w5qa-1'), `acknowledging removes it from the preceptor digest (${r.code})`);
  const rq = (await q(`select * from kafaa_ojt_eval_requests where status = 'requested' order by id limit 1`))[0];
  if (rq) {
    ok((await ids(rq.evaluator_person_id)).includes(`approval:ojt_eval_requests:${rq.id}`), 'F38 -> F36: an open evaluation request is an approval item for its evaluator');
    await q(`insert into kafaa_ojt_eval_requests (id, person_id, task_id, standard_id, record_id, evaluator_person_id, status, requested_at)
      values ('oer-w5qa-x', $1, $2, $3, $4, $5, 'cancelled', now()) on conflict (id) do nothing`, [rq.person_id, rq.task_id, rq.standard_id, rq.record_id, rq.evaluator_person_id]);
    ok(!(await ids(rq.evaluator_person_id)).includes('approval:ojt_eval_requests:oer-w5qa-x'), 'a cancelled request is not');
  }
  const g = (await q(`select has_function_privilege('authenticated', 'kafaa_dg_gather(text,date,jsonb)', 'execute') a, has_function_privilege('anon', 'kafaa_dg_gather(text,date,jsonb)', 'execute') b`))[0];
  ok(!g.a && !g.b, 'kafaa_dg_gather stays closed to API roles');
}
