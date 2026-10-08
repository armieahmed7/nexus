-- Kafa'a write RPCs for consequential actions (hand-written; mirrored 1:1 by src/data/local/rpc.ts).
-- Every RPC: SECURITY DEFINER, checks the caller's Kafa'a grants (kafaa_policy_matrix), writes an append-only
-- kafaa_audit_events row for success AND refusal, and appends material actions to the NEXUS evidence ledger
-- (nexus_append_ledger, plane PEOPLE) through kafaa_ledger(). Refusals return {ok:false, code, message}; they never raise,
-- so the refusal's audit row is committed. Additive only.

-- ───────────── helpers
create or replace function kafaa_result(p_ok boolean, p_code text, p_message text, p_audit kafaa_audit_events, p_ledger integer default null, p_data jsonb default '{}'::jsonb)
returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object('ok', p_ok, 'code', p_code, 'message', p_message, 'audit_seq', p_audit.seq, 'ledger_seq', p_ledger, 'data', p_data)
$$;

create or replace function kafaa_refuse(p_action text, p_table text, p_entity text, p_code text, p_message text, p_role text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a kafaa_audit_events;
begin
  a := kafaa_audit(p_action, p_table, p_entity, 'refused', p_code || ': ' || p_message, 'not_applicable', null, p_role);
  return kafaa_result(false, p_code, p_message, a);
end $$;

-- UAE working days: Monday-Friday (weekend Saturday and Sunday since 2022). Public holidays are not modelled in the demo.
create or replace function kafaa_add_working_days(p_from date, p_days integer) returns date language plpgsql immutable set search_path = public as $$
declare d date := p_from; n integer := 0;
begin
  while n < p_days loop
    d := d + 1;
    if extract(isodow from d) < 6 then n := n + 1; end if;
  end loop;
  return d;
end $$;

-- Which acting role label to record (first matching grant).
create or replace function kafaa_acting_role(p_res text, p_levels text[]) returns text language sql stable security definer set search_path = public as $$
  select m.role from kafaa_policy_matrix m where m.resource = p_res and m.level = any(p_levels) and m.role = any(kafaa_my_roles()) order by m.role limit 1
$$;

-- ───────────── M02 · qualification sign-off (trainee -> qualified evaluator; self-sign refused and audited)
create or replace function kafaa_signoff_evaluation(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); rec kafaa_qual_records; std kafaa_qual_standards; tsk kafaa_task_items; ev_id text; a kafaa_audit_events; l integer;
  v_result text := coalesce(p->>'result', 'pass'); v_crit boolean := coalesce((p->>'critical_failed')::boolean, false); v_date date := coalesce((p->>'date')::date, current_date);
  v_role text := kafaa_acting_role('signoff', array['A']); v_missing integer; v_status text;
begin
  if me is null then return kafaa_refuse('evaluation.signoff', 'qual_records', p->>'record_id', 'not_signed_in', 'Sign in to sign off evaluations'); end if;
  if v_role is null then return kafaa_refuse('evaluation.signoff', 'qual_records', p->>'record_id', 'forbidden', 'Only a qualified evaluator may sign off'); end if;
  select * into rec from kafaa_qual_records where id = p->>'record_id';
  if rec.id is null or not (kafaa_in_scope('qual_records', rec.person_id) or rec.person_id = me) then
    return kafaa_refuse('evaluation.signoff', 'qual_records', p->>'record_id', 'not_found', 'Qualification record not found', v_role);
  end if;
  if rec.person_id = me then
    return kafaa_refuse('evaluation.signoff', 'qual_records', rec.id, 'self_sign', 'An evaluator cannot sign off their own qualification', v_role);
  end if;
  if not exists (select 1 from kafaa_evaluator_quals q where q.person_id = me and q.standard_id = rec.standard_id and q.valid_to >= current_date) then
    return kafaa_refuse('evaluation.signoff', 'qual_records', rec.id, 'not_evaluator', 'You do not hold the evaluator qualification for this standard', v_role);
  end if;
  select * into std from kafaa_qual_standards where id = rec.standard_id;
  if p ? 'task_id' and p->>'task_id' is not null then
    select * into tsk from kafaa_task_items where id = p->>'task_id' and standard_id = rec.standard_id;
    if tsk.id is null then return kafaa_refuse('evaluation.signoff', 'task_items', p->>'task_id', 'not_found', 'Task not on this standard', v_role); end if;
  end if;
  if v_crit then v_result := 'fail'; end if;
  if v_result not in ('pass', 'fail') then return kafaa_refuse('evaluation.signoff', 'qual_records', rec.id, 'invalid', 'Result must be pass or fail', v_role); end if;
  if (p->>'correction_of') is not null and coalesce(p->>'correction_reason', '') = '' then
    return kafaa_refuse('evaluation.signoff', 'evaluations', p->>'correction_of', 'invalid', 'A correction needs a reason', v_role);
  end if;
  ev_id := 'ev-' || replace(gen_random_uuid()::text, '-', '');
  insert into kafaa_evaluations (id, record_id, task_id, person_id, method, evaluator_person_id, evaluator_role, result, date, critical_failed, correction_of, correction_reason)
  values (ev_id, rec.id, tsk.id, rec.person_id, coalesce(p->>'method', tsk.method, 'ojt'), me, coalesce(tsk.evaluator_role, 'Instructor / evaluator'), v_result, v_date, v_crit,
          p->>'correction_of', p->>'correction_reason');
  -- Qualified when every task on the standard has a passing evaluation on this record
  select count(*) into v_missing from kafaa_task_items t
   where t.standard_id = rec.standard_id
     and not exists (select 1 from kafaa_evaluations e where e.record_id = rec.id and e.task_id = t.id and e.result = 'pass'
                       and not exists (select 1 from kafaa_evaluations c where c.correction_of = e.id));
  v_status := rec.status;
  if v_missing = 0 and v_result = 'pass' then
    v_status := 'qualified';
    update kafaa_qual_records set status = 'qualified', qualified_on = v_date,
      expires_on = case when std.requal_months is null then null else (v_date + make_interval(months => std.requal_months))::date end,
      needs_review = false, review_reason = null, last_synced = now()
    where id = rec.id;
  elsif rec.status in ('planned') then
    v_status := 'in_progress';
    update kafaa_qual_records set status = 'in_progress' where id = rec.id;
  end if;
  l := kafaa_ledger('kafaa.qualification.signoff', format('Evaluation %s on %s (%s): %s', ev_id, rec.standard_id, coalesce(tsk.code, 'record'), v_result));
  a := kafaa_audit('evaluation.signoff', 'evaluations', ev_id, 'ok', format('%s %s; record now %s', coalesce(tsk.code, rec.standard_id), v_result, v_status),
                   case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Evaluation recorded', a, l, jsonb_build_object('evaluation_id', ev_id, 'record_status', v_status));
end $$;

-- ───────────── M03 · licence status change (mirror of the licensee record; lapse creates a 3-working-day task)
create or replace function kafaa_set_licence_status(p_licence_id text, p_status text, p_reason text) returns jsonb language plpgsql security definer set search_path = public as $$
declare lic kafaa_licences; a kafaa_audit_events; l integer; v_role text := kafaa_acting_role('licence', array['W']); v_due date; v_task text;
begin
  if v_role is null then return kafaa_refuse('licence.status', 'licences', p_licence_id, 'forbidden', 'Only the licensing coordinator may change a mirrored licence status'); end if;
  if p_status not in ('valid', 'lapsed', 'suspended', 'withdrawn', 'pending') then return kafaa_refuse('licence.status', 'licences', p_licence_id, 'invalid', 'Unknown status', v_role); end if;
  if coalesce(p_reason, '') = '' then return kafaa_refuse('licence.status', 'licences', p_licence_id, 'invalid', 'A reason (source record reference) is required', v_role); end if;
  select * into lic from kafaa_licences where id = p_licence_id;
  if lic.id is null then return kafaa_refuse('licence.status', 'licences', p_licence_id, 'not_found', 'Licence not found', v_role); end if;
  update kafaa_licences set status = p_status, lapsed_on = case when p_status = 'lapsed' then current_date else lapsed_on end, last_synced = now() where id = lic.id;
  if p_status = 'lapsed' then
    v_due := kafaa_add_working_days(current_date, 3);
    v_task := 'lt-' || replace(gen_random_uuid()::text, '-', '');
    insert into kafaa_licensing_tasks (id, kind, person_id, due_at, title_en, title_ar, rule_ref)
    values (v_task, 'lapse_report', lic.person_id, v_due, 'Report validity lapse within 3 working days', 'الإبلاغ عن انقضاء الصلاحية خلال 3 أيام عمل', 'FANR-REG-17 Art. 13');
    insert into kafaa_reporting_obligations (id, kind, title_en, title_ar, due_on, owner_role, person_id, rule_ref)
    values ('ro-' || v_task, 'lapse_report', 'Validity lapse report (draft for the named role to send)', 'تقرير انقضاء الصلاحية (مسودة)', v_due, 'Licensing coordinator', lic.person_id, 'FANR-REG-17 Art. 13');
  end if;
  l := kafaa_ledger('kafaa.licence.status', format('%s %s -> %s (%s)', lic.type, lic.cert_no, p_status, p_reason));
  a := kafaa_audit('licence.status', 'licences', lic.id, 'ok', format('%s -> %s: %s', lic.status, p_status, p_reason), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Licence status recorded', a, l, jsonb_build_object('due', v_due));
end $$;

-- Sweep: detect lapses and overdue medicals; create coordinator tasks (idempotent).
create or replace function kafaa_detect_licensing_events() returns jsonb language plpgsql security definer set search_path = public as $$
declare v_role text := kafaa_acting_role('licence', array['W']); n_lapse integer := 0; n_med integer := 0; r record; a kafaa_audit_events;
begin
  if v_role is null then return kafaa_refuse('licence.sweep', 'licences', null, 'forbidden', 'Only the licensing coordinator may run the sweep'); end if;
  for r in select * from kafaa_licences where status = 'valid' and expires_on < current_date loop
    perform kafaa_set_licence_status(r.id, 'lapsed', 'Detected by sweep: expiry date passed');
    n_lapse := n_lapse + 1;
  end loop;
  for r in select m.* from kafaa_medical_due m where m.due_on < current_date and m.flag <> 'fit'
           and not exists (select 1 from kafaa_licensing_tasks t where t.person_id = m.person_id and t.kind = 'medical_overdue' and t.status = 'open') loop
    insert into kafaa_licensing_tasks (id, kind, person_id, due_at, title_en, title_ar, rule_ref)
    values ('lt-' || replace(gen_random_uuid()::text, '-', ''), 'medical_overdue', r.person_id, kafaa_add_working_days(current_date, 5), 'Medical overdue: confirm new date', 'فحص طبي متأخر: تأكيد موعد جديد', 'FANR-REG-17 Art. 10');
    n_med := n_med + 1;
  end loop;
  a := kafaa_audit('licence.sweep', 'licences', null, 'ok', format('%s lapses, %s medical tasks', n_lapse, n_med), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Sweep complete', a, null, jsonb_build_object('lapses', n_lapse, 'medical', n_med));
end $$;

-- ───────────── M09 · partner onboarding decision (platform admin; maker != checker)
create or replace function kafaa_decide_partner_onboarding(p_id text, p_decision text, p_note text) returns jsonb language plpgsql security definer set search_path = public as $$
declare o kafaa_partner_onboarding; a kafaa_audit_events; l integer; v_role text := kafaa_acting_role('partner_org', array['A']);
begin
  if v_role is null then return kafaa_refuse('partner.decide', 'partner_onboarding', p_id, 'forbidden', 'Only a platform admin may decide partner onboarding'); end if;
  if p_decision not in ('approved', 'returned', 'handed_off') then return kafaa_refuse('partner.decide', 'partner_onboarding', p_id, 'invalid', 'Decision must be approved, returned or handed_off', v_role); end if;
  select * into o from kafaa_partner_onboarding where id = p_id;
  if o.id is null then return kafaa_refuse('partner.decide', 'partner_onboarding', p_id, 'not_found', 'Onboarding case not found', v_role); end if;
  if o.org_id = kafaa_my_org() then return kafaa_refuse('partner.decide', 'partner_onboarding', p_id, 'conflict', 'You cannot decide your own organisation''s case', v_role); end if;
  if p_decision = 'handed_off' and o.status <> 'approved' then return kafaa_refuse('partner.decide', 'partner_onboarding', p_id, 'invalid', 'Only an approved case can be handed off', v_role); end if;
  if p_decision in ('approved', 'returned') and o.status not in ('submitted', 'in_progress') then return kafaa_refuse('partner.decide', 'partner_onboarding', p_id, 'invalid', 'Case is not awaiting a decision', v_role); end if;
  update kafaa_partner_onboarding set status = p_decision, decided_at = now(), decided_by = kafaa_me(), decision_note = p_note,
    nexus_handoff_ref = case when p_decision = 'handed_off' then '/partner/readiness' else nexus_handoff_ref end where id = p_id;
  l := kafaa_ledger('kafaa.partner.' || p_decision, format('Partner onboarding %s (%s): %s', p_id, o.org_id, coalesce(p_note, '')));
  a := kafaa_audit('partner.decide', 'partner_onboarding', p_id, 'ok', p_decision || coalesce(': ' || p_note, ''), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Decision recorded', a, l);
end $$;

-- ───────────── M06 · application decision (mirrors the ENEC HR decision; Kafa'a never decides automatically)
create or replace function kafaa_decide_application(p_id text, p_stage text, p_note text) returns jsonb language plpgsql security definer set search_path = public as $$
declare ap kafaa_applications; a kafaa_audit_events; l integer; v_role text := kafaa_acting_role('applications', array['A']); v_decision text;
begin
  if v_role is null then return kafaa_refuse('application.decide', 'applications', p_id, 'forbidden', 'Only the HR authority may record an application decision'); end if;
  if p_stage not in ('screening', 'assessment', 'interview', 'offer', 'accepted', 'unsuccessful') then return kafaa_refuse('application.decide', 'applications', p_id, 'invalid', 'Unknown stage', v_role); end if;
  select * into ap from kafaa_applications where id = p_id;
  if ap.id is null then return kafaa_refuse('application.decide', 'applications', p_id, 'not_found', 'Application not found', v_role); end if;
  if ap.stage in ('withdrawn', 'unsuccessful', 'accepted') then return kafaa_refuse('application.decide', 'applications', p_id, 'invalid', 'Application is closed', v_role); end if;
  v_decision := case when p_stage in ('offer', 'accepted') then 'offer' when p_stage = 'unsuccessful' then 'unsuccessful' else 'none' end;
  update kafaa_applications set stage = p_stage, decision = v_decision, decision_source = 'ENEC HR (mirrored)', updated_at = now(),
    delete_after = case when p_stage = 'unsuccessful' then (current_date + interval '6 months')::date else delete_after end where id = p_id;
  insert into kafaa_application_events (id, application_id, person_id, stage, note_en, note_ar, by_role)
  values ('ae-' || replace(gen_random_uuid()::text, '-', ''), p_id, ap.person_id, p_stage, coalesce(p_note, ''), coalesce(p_note, ''), 'ENEC HR');
  l := kafaa_ledger('kafaa.application.decide', format('Application %s (%s) -> %s (mirrored from HR)', p_id, ap.programme_id, p_stage));
  a := kafaa_audit('application.decide', 'applications', p_id, 'ok', p_stage, case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Stage recorded', a, l);
end $$;

-- ───────────── M08 · ECP referral triage (metadata only; no concern text exists in Kafa'a)
create or replace function kafaa_triage_concern(p_id text, p_status text, p_priority text) returns jsonb language plpgsql security definer set search_path = public as $$
declare c kafaa_concern_cases; a kafaa_audit_events; l integer; v_role text := kafaa_acting_role('concern_cases', array['A']);
begin
  if v_role is null then return kafaa_refuse('ecp.triage', 'concern_cases', p_id, 'forbidden', 'Only the ECP officer may triage referrals'); end if;
  if p_status not in ('triaged', 'investigating', 'referred', 'closed') or p_priority not in ('routine', 'priority', 'urgent') then
    return kafaa_refuse('ecp.triage', 'concern_cases', p_id, 'invalid', 'Unknown status or priority', v_role);
  end if;
  select * into c from kafaa_concern_cases where id = p_id;
  if c.id is null then return kafaa_refuse('ecp.triage', 'concern_cases', p_id, 'not_found', 'Referral not found', v_role); end if;
  update kafaa_concern_cases set status = p_status, priority = p_priority, triage_owner_role = 'ECP officer', triaged_at = coalesce(triaged_at, now()) where id = p_id;
  l := kafaa_ledger('kafaa.ecp.triage', 'ECP referral triaged; no case content recorded');
  a := kafaa_audit('ecp.triage', 'concern_cases', p_id, 'ok', format('%s / %s', p_status, p_priority), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Triage recorded', a, l);
end $$;

-- ───────────── M09 · contractor equivalency decision (ENEC evaluator maps evidence to the standard)
create or replace function kafaa_decide_equivalency(p_id text, p_status text, p_note text) returns jsonb language plpgsql security definer set search_path = public as $$
declare r kafaa_equivalency_requests; a kafaa_audit_events; l integer; v_role text := kafaa_acting_role('equivalency', array['A']);
begin
  if v_role is null then return kafaa_refuse('equivalency.decide', 'equivalency_requests', p_id, 'forbidden', 'Only an ENEC evaluator may decide equivalency'); end if;
  if p_status not in ('under_review', 'equivalent', 'training_required', 'rejected') then return kafaa_refuse('equivalency.decide', 'equivalency_requests', p_id, 'invalid', 'Unknown decision', v_role); end if;
  select * into r from kafaa_equivalency_requests where id = p_id;
  if r.id is null then return kafaa_refuse('equivalency.decide', 'equivalency_requests', p_id, 'not_found', 'Request not found', v_role); end if;
  if p_status <> 'under_review' and not kafaa_has_role('training_manager')
     and not exists (select 1 from kafaa_evaluator_quals q where q.person_id = kafaa_me() and q.standard_id = r.standard_id and q.valid_to >= current_date) then
    return kafaa_refuse('equivalency.decide', 'equivalency_requests', p_id, 'not_evaluator', 'You do not hold the evaluator qualification for this standard', v_role);
  end if;
  if p_status <> 'under_review' and coalesce(p_note, '') = '' then return kafaa_refuse('equivalency.decide', 'equivalency_requests', p_id, 'invalid', 'A decision note is required', v_role); end if;
  update kafaa_equivalency_requests set status = p_status, decision_note = p_note, decider_role = 'Instructor / evaluator', decided_by = kafaa_me(),
    decided_at = case when p_status = 'under_review' then null else now() end where id = p_id;
  l := case when p_status = 'under_review' then null else kafaa_ledger('kafaa.equivalency.decide', format('Equivalency %s (%s, %s): %s', p_id, r.org_id, r.standard_id, p_status)) end;
  a := kafaa_audit('equivalency.decide', 'equivalency_requests', p_id, 'ok', p_status, case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Decision recorded', a, l);
end $$;

-- Read one equivalency request; not-found + audit for anything outside the caller's visibility (M09 acceptance).
create or replace function kafaa_get_equivalency(p_id text) returns jsonb language plpgsql security definer set search_path = public as $$
declare r kafaa_equivalency_requests; a kafaa_audit_events;
begin
  select * into r from kafaa_equivalency_requests where id = p_id;
  if r.id is null or not (kafaa_has_grant('equivalency', array['R','W','A']) or (r.org_id = kafaa_my_org() and kafaa_has_grant('equivalency', array['OwnOrg','OrgW']))) then
    a := kafaa_audit('equivalency.read', 'equivalency_requests', p_id, 'refused', 'not_found: record outside the caller''s organisation or does not exist');
    return kafaa_result(false, 'not_found', 'Not found', a);
  end if;
  return jsonb_build_object('ok', true, 'code', 'ok', 'data', to_jsonb(r));
end $$;

-- ───────────── M07 · observer report release (maker-checker by person, across sessions)
create or replace function kafaa_observer_report_action(p_id text, p_action text, p_org_ids text[] default '{}') returns jsonb language plpgsql security definer set search_path = public as $$
declare r kafaa_observer_reports; a kafaa_audit_events; l integer; me text := kafaa_me(); v_role text;
begin
  select * into r from kafaa_observer_reports where id = p_id;
  if r.id is null then return kafaa_refuse('observer_report.' || p_action, 'observer_reports', p_id, 'not_found', 'Report not found'); end if;
  if p_action = 'submit' then
    v_role := kafaa_acting_role('observer_release', array['W','A']);
    if v_role is null then return kafaa_refuse('observer_report.submit', 'observer_reports', p_id, 'forbidden', 'Only HR may prepare an observer report'); end if;
    if r.status <> 'draft' then return kafaa_refuse('observer_report.submit', 'observer_reports', p_id, 'invalid', 'Only a draft can be submitted', v_role); end if;
    update kafaa_observer_reports set status = 'pending_approval', prepared_by = me, released_to_org_ids = coalesce(p_org_ids, '{}') where id = p_id;
  elsif p_action = 'approve' then
    v_role := kafaa_acting_role('observer_release', array['A']);
    if v_role is null then return kafaa_refuse('observer_report.approve', 'observer_reports', p_id, 'forbidden', 'Release needs the named HR authority (CHCO office) or an admin'); end if;
    if r.status <> 'pending_approval' then return kafaa_refuse('observer_report.approve', 'observer_reports', p_id, 'invalid', 'Report is not awaiting approval', v_role); end if;
    if r.prepared_by = me then return kafaa_refuse('observer_report.approve', 'observer_reports', p_id, 'maker_checker', 'The preparer cannot approve their own release', v_role); end if;
    update kafaa_observer_reports set status = 'released', approved_by = me, approved_at = now(),
      released_to_org_ids = case when cardinality(coalesce(p_org_ids, '{}')) > 0 then p_org_ids else released_to_org_ids end where id = p_id;
  elsif p_action = 'withdraw' then
    v_role := kafaa_acting_role('observer_release', array['A']);
    if v_role is null then return kafaa_refuse('observer_report.withdraw', 'observer_reports', p_id, 'forbidden', 'Only an approver may withdraw a release'); end if;
    update kafaa_observer_reports set status = 'withdrawn' where id = p_id;
  else
    return kafaa_refuse('observer_report.' || p_action, 'observer_reports', p_id, 'invalid', 'Unknown action');
  end if;
  l := case when p_action = 'submit' then null else kafaa_ledger('kafaa.observer_report.' || p_action, format('Observer report %s %s', p_id, p_action)) end;
  a := kafaa_audit('observer_report.' || p_action, 'observer_reports', p_id, 'ok', array_to_string(p_org_ids, ','), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Recorded', a, l);
end $$;

-- ───────────── M10 · research challenge screening sign-off (publish only after both checks)
create or replace function kafaa_screen_research_challenge(p_id text, p_security_ok boolean, p_export_ok boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare c kafaa_research_challenges; a kafaa_audit_events; v_role text := kafaa_acting_role('research', array['A']); v_pub boolean := coalesce(p_security_ok, false) and coalesce(p_export_ok, false);
begin
  if v_role is null then return kafaa_refuse('research.screen', 'research_challenges', p_id, 'forbidden', 'Only a screening authority may sign off'); end if;
  select * into c from kafaa_research_challenges where id = p_id;
  if c.id is null then return kafaa_refuse('research.screen', 'research_challenges', p_id, 'not_found', 'Challenge not found', v_role); end if;
  update kafaa_research_challenges set security_ok = coalesce(p_security_ok, false), export_control_ok = coalesce(p_export_ok, false),
    screening_signed_by = kafaa_me(), screening_signed_at = now(), status = case when v_pub then 'published' else 'screening' end, is_published = v_pub where id = p_id;
  a := kafaa_audit('research.screen', 'research_challenges', p_id, 'ok', format('security=%s export=%s published=%s', p_security_ok, p_export_ok, v_pub), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when v_pub then 'Screening signed; challenge published' else 'Screening recorded; not published' end, a);
end $$;

-- ───────────── M13 · Dalil kill switch
create or replace function kafaa_set_dalil_enabled(p_enabled boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare a kafaa_audit_events; l integer; v_role text := kafaa_acting_role('dalil_config', array['A']);
begin
  if v_role is null then return kafaa_refuse('dalil.kill_switch', 'dalil_settings', 'global', 'forbidden', 'Only the AI owner (admin) may switch Dalil'); end if;
  update kafaa_dalil_settings set enabled = p_enabled, updated_at = now(), updated_by = kafaa_me() where id = 'global';
  l := kafaa_ledger('kafaa.dalil.' || case when p_enabled then 'enable' else 'disable' end, 'Dalil kill switch');
  a := kafaa_audit('dalil.kill_switch', 'dalil_settings', 'global', 'ok', case when p_enabled then 'enabled' else 'disabled' end, case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Dalil ' || case when p_enabled then 'enabled' else 'disabled' end, a, l);
end $$;

-- ───────────── M02 · revise a qualification standard (new version; affected records flagged for review)
create or replace function kafaa_revise_standard(p_id text, p_reason text) returns jsonb language plpgsql security definer set search_path = public as $$
declare s kafaa_qual_standards; v_new text; n integer; a kafaa_audit_events; l integer; v_role text := kafaa_acting_role('frameworks', array['W','A']);
begin
  if v_role is null then return kafaa_refuse('standard.revise', 'qual_standards', p_id, 'forbidden', 'Only a framework owner may revise a standard'); end if;
  if coalesce(p_reason, '') = '' then return kafaa_refuse('standard.revise', 'qual_standards', p_id, 'invalid', 'A change reason is required', v_role); end if;
  select * into s from kafaa_qual_standards where id = p_id and status = 'current';
  if s.id is null then return kafaa_refuse('standard.revise', 'qual_standards', p_id, 'not_found', 'Current standard not found', v_role); end if;
  v_new := regexp_replace(s.id, '-v\d+$', '') || '-v' || (s.version + 1);
  insert into kafaa_qual_standards (id, code, title_en, title_ar, role_ids, discipline, version, status, owner_role, requal_months, effective_date, supersedes_id, change_reason, security_restricted)
  values (v_new, s.code, s.title_en, s.title_ar, s.role_ids, s.discipline, s.version + 1, 'current', s.owner_role, s.requal_months, current_date, s.id, p_reason, s.security_restricted);
  insert into kafaa_task_items (id, standard_id, code, statement_en, statement_ar, conditions_en, standards_en, method, evaluator_role, critical, sort)
  select t.id || '-v' || (s.version + 1), v_new, t.code, t.statement_en, t.statement_ar, t.conditions_en, t.standards_en, t.method, t.evaluator_role, t.critical, t.sort from kafaa_task_items t where t.standard_id = s.id;
  update kafaa_qual_standards set status = 'superseded' where id = s.id;
  update kafaa_qual_records set needs_review = true, review_reason = format('Standard revised to v%s: %s', s.version + 1, p_reason) where standard_id = s.id and status in ('qualified', 'due', 'in_progress');
  get diagnostics n = row_count;
  l := kafaa_ledger('kafaa.standard.revise', format('%s v%s -> v%s; %s records flagged', s.code, s.version, s.version + 1, n));
  a := kafaa_audit('standard.revise', 'qual_standards', v_new, 'ok', format('%s records flagged: %s', n, p_reason), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'New version created', a, l, jsonb_build_object('new_id', v_new, 'flagged', n));
end $$;

-- ───────────── M14 · role grants (elevated roles need a second admin; partner admins manage their own org's users)
create or replace function kafaa_grant_role(p_person_id text, p_role text, p_scope_type text, p_scope_value text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); tgt kafaa_people; v_id text; v_status text := 'active'; a kafaa_audit_events; l integer; v_role text;
begin
  select * into tgt from kafaa_people where id = p_person_id;
  if tgt.id is null then return kafaa_refuse('role.grant', 'role_assignments', p_person_id, 'not_found', 'Person not found'); end if;
  if kafaa_has_grant('users_roles', array['W']) then
    v_role := 'admin';
    if p_role in ('admin', 'auditor', 'hr_director', 'licensing_coord', 'training_manager', 'ecp_officer', 'instructor', 'hr_analyst') then v_status := 'pending_second'; end if;
  elsif kafaa_has_grant('users_roles', array['OrgW']) and tgt.org_id = kafaa_my_org() and p_role in ('partner_user') then
    v_role := 'partner_admin';
  else
    return kafaa_refuse('role.grant', 'role_assignments', p_person_id, 'forbidden', 'You cannot grant this role');
  end if;
  if p_role = any(array['public']) or not exists (select 1 from kafaa_policy_matrix m where m.role = p_role) then
    return kafaa_refuse('role.grant', 'role_assignments', p_person_id, 'invalid', 'Unknown role', v_role);
  end if;
  v_id := 'ra-' || replace(gen_random_uuid()::text, '-', '');
  insert into kafaa_role_assignments (id, person_id, role, org_id, scope_type, scope_value, granted_by, status)
  values (v_id, p_person_id, p_role, tgt.org_id, coalesce(p_scope_type, 'self'), p_scope_value, me, v_status);
  l := kafaa_ledger('kafaa.role.grant', format('%s granted %s (%s)', p_person_id, p_role, v_status));
  a := kafaa_audit('role.grant', 'role_assignments', v_id, 'ok', format('%s %s %s', p_role, coalesce(p_scope_type, 'self'), v_status), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when v_status = 'pending_second' then 'Granted; needs a second admin''s approval' else 'Granted' end, a, l, jsonb_build_object('id', v_id, 'status', v_status));
end $$;

create or replace function kafaa_approve_role(p_id text) returns jsonb language plpgsql security definer set search_path = public as $$
declare r kafaa_role_assignments; me text := kafaa_me(); a kafaa_audit_events; l integer;
begin
  if not kafaa_has_grant('users_roles', array['W']) then return kafaa_refuse('role.approve', 'role_assignments', p_id, 'forbidden', 'Only an admin may approve'); end if;
  select * into r from kafaa_role_assignments where id = p_id;
  if r.id is null or r.status <> 'pending_second' then return kafaa_refuse('role.approve', 'role_assignments', p_id, 'not_found', 'No pending grant', 'admin'); end if;
  if r.granted_by = me then return kafaa_refuse('role.approve', 'role_assignments', p_id, 'maker_checker', 'A second admin must approve an elevated grant', 'admin'); end if;
  if r.person_id = me then return kafaa_refuse('role.approve', 'role_assignments', p_id, 'maker_checker', 'You cannot approve your own elevation', 'admin'); end if;
  update kafaa_role_assignments set status = 'active', second_approver = me where id = p_id;
  l := kafaa_ledger('kafaa.role.approve', format('%s %s approved', r.person_id, r.role));
  a := kafaa_audit('role.approve', 'role_assignments', p_id, 'ok', r.role, case when l is null then 'skipped' else 'written' end, l, 'admin');
  return kafaa_result(true, 'ok', 'Approved', a, l);
end $$;

create or replace function kafaa_revoke_role(p_id text, p_reason text) returns jsonb language plpgsql security definer set search_path = public as $$
declare r kafaa_role_assignments; a kafaa_audit_events;
begin
  select * into r from kafaa_role_assignments where id = p_id;
  if r.id is null then return kafaa_refuse('role.revoke', 'role_assignments', p_id, 'not_found', 'Not found'); end if;
  if not (kafaa_has_grant('users_roles', array['W']) or (kafaa_has_grant('users_roles', array['OrgW']) and r.org_id = kafaa_my_org() and r.role = 'partner_user')) then
    return kafaa_refuse('role.revoke', 'role_assignments', p_id, 'forbidden', 'You cannot revoke this role');
  end if;
  update kafaa_role_assignments set status = 'revoked' where id = p_id;
  a := kafaa_audit('role.revoke', 'role_assignments', p_id, 'ok', coalesce(p_reason, ''));
  return kafaa_result(true, 'ok', 'Revoked', a);
end $$;

-- ───────────── M05 · item review workflow (writer != reviewer != approver)
create or replace function kafaa_item_review(p_item_id text, p_action text) returns jsonb language plpgsql security definer set search_path = public as $$
declare i kafaa_items; me text := kafaa_me(); a kafaa_audit_events; v_role text := kafaa_acting_role('secure_items', array['W','A']);
begin
  if v_role is null then return kafaa_refuse('item.' || p_action, 'items', p_item_id, 'forbidden', 'Item bank access required'); end if;
  select * into i from kafaa_items where id = p_item_id;
  if i.id is null then return kafaa_refuse('item.' || p_action, 'items', p_item_id, 'not_found', 'Item not found', v_role); end if;
  if p_action = 'submit' then
    if i.writer_person_id is distinct from me then return kafaa_refuse('item.submit', 'items', p_item_id, 'forbidden', 'Only the writer submits for review', v_role); end if;
    update kafaa_items set status = 'in_review' where id = p_item_id;
  elsif p_action = 'review' then
    if i.writer_person_id = me then return kafaa_refuse('item.review', 'items', p_item_id, 'separation_of_duties', 'The writer cannot review their own item', v_role); end if;
    update kafaa_items set reviewer_person_id = me where id = p_item_id;
  elsif p_action = 'approve' then
    if not kafaa_has_grant('secure_items', array['A']) then return kafaa_refuse('item.approve', 'items', p_item_id, 'forbidden', 'Approver role required', v_role); end if;
    if i.writer_person_id = me or i.reviewer_person_id = me then return kafaa_refuse('item.approve', 'items', p_item_id, 'separation_of_duties', 'Writer, reviewer and approver must be different people', v_role); end if;
    if i.reviewer_person_id is null then return kafaa_refuse('item.approve', 'items', p_item_id, 'invalid', 'Item has not been reviewed', v_role); end if;
    update kafaa_items set status = 'approved', approver_person_id = me where id = p_item_id;
  else
    return kafaa_refuse('item.' || p_action, 'items', p_item_id, 'invalid', 'Unknown action', v_role);
  end if;
  a := kafaa_audit('item.' || p_action, 'items', p_item_id, 'ok', null, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Recorded', a);
end $$;

-- ───────────── M05 · JPM result (a failed critical step fails the JPM regardless of score)
create or replace function kafaa_record_jpm(p_jpm_id text, p_person_id text, p_steps jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare j kafaa_jpms; me text := kafaa_me(); v_crit boolean := false; v_pass integer := 0; v_total integer := 0; s jsonb; st jsonb; v_id text; v_result text; a kafaa_audit_events; v_role text := kafaa_acting_role('signoff', array['A']);
begin
  if v_role is null then return kafaa_refuse('jpm.record', 'jpm_results', p_jpm_id, 'forbidden', 'Only a qualified evaluator may record a JPM'); end if;
  if p_person_id = me then return kafaa_refuse('jpm.record', 'jpm_results', p_jpm_id, 'self_sign', 'An evaluator cannot evaluate themselves', v_role); end if;
  select * into j from kafaa_jpms where id = p_jpm_id;
  if j.id is null then return kafaa_refuse('jpm.record', 'jpm_results', p_jpm_id, 'not_found', 'JPM not found', v_role); end if;
  for s in select * from jsonb_array_elements(j.critical_steps) loop
    v_total := v_total + 1;
    select x into st from jsonb_array_elements(p_steps) x where (x->>'n')::int = (s->>'n')::int limit 1;
    if coalesce(st->>'result', 'fail') = 'pass' then v_pass := v_pass + 1;
    elsif coalesce((s->>'critical')::boolean, false) then v_crit := true; end if;
  end loop;
  v_result := case when v_crit then 'fail' when v_total > 0 and v_pass * 100 / v_total >= 80 then 'pass' else 'fail' end;
  v_id := 'jr-' || replace(gen_random_uuid()::text, '-', '');
  insert into kafaa_jpm_results (id, jpm_id, person_id, evaluator_person_id, date, steps, critical_failed, score_pct, result, signed)
  values (v_id, p_jpm_id, p_person_id, me, current_date, p_steps, v_crit, case when v_total > 0 then round(v_pass * 100.0 / v_total) else 0 end, v_result, true);
  a := kafaa_audit('jpm.record', 'jpm_results', v_id, 'ok', v_result || case when v_crit then ' (critical step failed)' else '' end, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'JPM recorded', a, null, jsonb_build_object('id', v_id, 'result', v_result, 'critical_failed', v_crit));
end $$;

-- ───────────── M04 · simulator booking (licence-critical training cannot be displaced by elective use)
create or replace function kafaa_book_simulator(p_slot_id text, p_kind text, p_crew text) returns jsonb language plpgsql security definer set search_path = public as $$
declare s kafaa_simulator_slots; a kafaa_audit_events; v_role text := kafaa_acting_role('training', array['W','A']); v_prio integer;
begin
  if v_role is null then return kafaa_refuse('simulator.book', 'simulator_slots', p_slot_id, 'forbidden', 'Only training schedulers may book simulators'); end if;
  if p_kind not in ('coct', 'requal', 'initial', 'elective', 'maintenance') then return kafaa_refuse('simulator.book', 'simulator_slots', p_slot_id, 'invalid', 'Unknown booking kind', v_role); end if;
  select * into s from kafaa_simulator_slots where id = p_slot_id;
  if s.id is null then return kafaa_refuse('simulator.book', 'simulator_slots', p_slot_id, 'not_found', 'Slot not found', v_role); end if;
  v_prio := case p_kind when 'coct' then 1 when 'requal' then 1 when 'initial' then 2 when 'maintenance' then 2 else 4 end;
  if s.status in ('booked', 'tentative') and s.booking_kind <> 'free' and s.priority <= v_prio then
    return kafaa_refuse('simulator.book', 'simulator_slots', p_slot_id, 'conflict', 'Slot holds equal or higher-priority training (licence-critical bookings cannot be displaced)', v_role);
  end if;
  update kafaa_simulator_slots set booking_kind = p_kind, crew = p_crew, priority = v_prio, status = 'booked', booked_by = kafaa_me() where id = p_slot_id;
  a := kafaa_audit('simulator.book', 'simulator_slots', p_slot_id, 'ok', format('%s crew %s%s', p_kind, coalesce(p_crew, '-'), case when s.booking_kind not in ('free') then ' (displaced ' || s.booking_kind || ')' else '' end), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Booked', a);
end $$;

-- ───────────── M04 · role change assigns the new role's mandatory curriculum (one sync cycle)
create or replace function kafaa_assign_curriculum(p_person_id text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pe kafaa_people; n integer; a kafaa_audit_events; v_role text := kafaa_acting_role('training', array['W','A']);
begin
  if v_role is null and not kafaa_has_grant('users_roles', array['W']) then return kafaa_refuse('curriculum.assign', 'enrolments', p_person_id, 'forbidden', 'Not allowed'); end if;
  select * into pe from kafaa_people where id = p_person_id;
  if pe.id is null or pe.job_role_id is null then return kafaa_refuse('curriculum.assign', 'enrolments', p_person_id, 'not_found', 'Person or role not found', v_role); end if;
  insert into kafaa_enrolments (id, person_id, course_id, status, source, assigned_by, due_on, org_id)
  select 'en-' || replace(gen_random_uuid()::text, '-', ''), pe.id, c.course_id, 'assigned', 'role_rule', 'Curriculum rule', current_date + c.due_within_days, pe.org_id
  from kafaa_curriculum_rules c
  where c.role_id = pe.job_role_id and c.mandatory
    and not exists (select 1 from kafaa_enrolments e where e.person_id = pe.id and e.course_id = c.course_id and e.status not in ('cancelled', 'failed'));
  get diagnostics n = row_count;
  a := kafaa_audit('curriculum.assign', 'enrolments', p_person_id, 'ok', format('%s courses assigned for %s', n, pe.job_role_id), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', format('%s courses assigned', n), a, null, jsonb_build_object('assigned', n));
end $$;

-- ───────────── Public · verify a Kafa'a-issued course certificate (never a FANR certificate); no personal data returned
create or replace function kafaa_verify_certificate(p_no text) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((
    select jsonb_build_object('found', true, 'certificate_no', c.id, 'status', case when c.status = 'valid' and c.valid_to is not null and c.valid_to < current_date then 'expired' else c.status end,
      'course_code', co.code, 'course_en', co.title_en, 'course_ar', co.title_ar, 'issued_on', c.issued_on, 'valid_to', c.valid_to, 'holder_initials', c.holder_initials,
      'note', 'Internal Kafa''a course certificate. Not an operator licence.')
    from kafaa_certificates c join kafaa_courses co on co.id = c.course_id where upper(c.id) = upper(trim(p_no))
  ), jsonb_build_object('found', false))
$$;

-- ───────────── M07 · aggregate with suppression (groups under 10 never return a value)
create or replace function kafaa_workforce_aggregate(p_period text, p_measure text) returns table (family_id text, level text, entity_id text, measure text, value numeric, group_size integer, suppressed boolean, source text, sample boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not kafaa_has_grant('workforce_analytics', array['Agg','R']) then raise exception 'Kafa''a · aggregate analytics are restricted' using errcode = '42501'; end if;
  return query
    select w.family_id, w.level, w.entity_id, w.measure,
           case when w.group_size < (kafaa_rules()->>'minGroupSize')::int then null else w.value end,
           case when w.group_size < (kafaa_rules()->>'minGroupSize')::int then null else w.group_size end,
           w.group_size < (kafaa_rules()->>'minGroupSize')::int, w.source, w.sample
    from kafaa_workforce_snapshots w where w.period = p_period and (p_measure is null or w.measure = p_measure);
end $$;

-- Application funnel counts for HR (aggregate; suppressed below the minimum group size)
create or replace function kafaa_application_funnel() returns table (programme_id text, stage text, n integer, suppressed boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not kafaa_has_grant('applications', array['Agg','R']) then raise exception 'Kafa''a · funnel is restricted' using errcode = '42501'; end if;
  return query select a.programme_id, a.stage, case when count(*) < (kafaa_rules()->>'minGroupSize')::int then null else count(*)::int end, count(*) < (kafaa_rules()->>'minGroupSize')::int
    from kafaa_applications a group by a.programme_id, a.stage;
end $$;

-- Record a client-side access denial (route guards) so denied attempts are audited too.
create or replace function kafaa_log_denied(p_route text, p_resource text) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_route like '/speak-up%' then return; end if; -- the speak-up route sends no audit events (M08)
  perform kafaa_audit('access.denied', null, left(p_route, 200), 'refused', 'route guard: ' || coalesce(p_resource, ''));
end $$;

revoke all on function kafaa_refuse(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function
  kafaa_signoff_evaluation(jsonb), kafaa_set_licence_status(text, text, text), kafaa_detect_licensing_events(), kafaa_decide_partner_onboarding(text, text, text),
  kafaa_decide_application(text, text, text), kafaa_triage_concern(text, text, text), kafaa_decide_equivalency(text, text, text), kafaa_get_equivalency(text),
  kafaa_observer_report_action(text, text, text[]), kafaa_screen_research_challenge(text, boolean, boolean), kafaa_set_dalil_enabled(boolean),
  kafaa_revise_standard(text, text), kafaa_grant_role(text, text, text, text), kafaa_approve_role(text), kafaa_revoke_role(text, text), kafaa_item_review(text, text),
  kafaa_record_jpm(text, text, jsonb), kafaa_book_simulator(text, text, text), kafaa_assign_curriculum(text), kafaa_workforce_aggregate(text, text),
  kafaa_application_funnel(), kafaa_log_denied(text, text), kafaa_add_working_days(date, integer)
to authenticated;
grant execute on function kafaa_verify_certificate(text), kafaa_add_working_days(date, integer), kafaa_log_denied(text, text) to anon;

-- Functions are executable by PUBLIC by default: write RPCs and internal helpers must not be callable anonymously.
revoke execute on function
  kafaa_signoff_evaluation(jsonb), kafaa_set_licence_status(text, text, text), kafaa_detect_licensing_events(), kafaa_decide_partner_onboarding(text, text, text),
  kafaa_decide_application(text, text, text), kafaa_triage_concern(text, text, text), kafaa_decide_equivalency(text, text, text), kafaa_get_equivalency(text),
  kafaa_observer_report_action(text, text, text[]), kafaa_screen_research_challenge(text, boolean, boolean), kafaa_set_dalil_enabled(boolean),
  kafaa_revise_standard(text, text), kafaa_grant_role(text, text, text, text), kafaa_approve_role(text), kafaa_revoke_role(text, text), kafaa_item_review(text, text),
  kafaa_record_jpm(text, text, jsonb), kafaa_book_simulator(text, text, text), kafaa_assign_curriculum(text), kafaa_workforce_aggregate(text, text),
  kafaa_application_funnel(), kafaa_acting_role(text, text[]), kafaa_result(boolean, text, text, kafaa_audit_events, integer, jsonb)
from public, anon;
grant execute on function kafaa_result(boolean, text, text, kafaa_audit_events, integer, jsonb) to authenticated;
