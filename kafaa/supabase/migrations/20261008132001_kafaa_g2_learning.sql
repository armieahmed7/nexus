-- G2 · M04 learning and training, M05 assessments (Kafa'a). Additive and idempotent: kafaa_* objects only.
-- Mirrors src/data/local/rpc_g2.ts (LocalBackend) and src/domain/learning.ts. Change them together.
-- Every RPC is SECURITY DEFINER, refuses through kafaa_refuse (audited), audits success through kafaa_audit and appends
-- material actions to the NEXUS ledger through kafaa_ledger. Secure item text never goes into an audit reason.

-- ───────────── 1. Columns added by G2 (the generated schema has them on a fresh database; these cover existing tables)
alter table kafaa_sessions add column if not exists status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled'));
alter table kafaa_enrolments add column if not exists attendance text check (attendance in ('present', 'absent', 'excused'));
alter table kafaa_enrolments add column if not exists waitlisted_at timestamptz;
alter table kafaa_enrolments add column if not exists decided_by text;
alter table kafaa_enrolments add column if not exists decision_note text;
alter table kafaa_training_records add column if not exists enrolment_id text;
alter table kafaa_external_requests add column if not exists start_on date;
alter table kafaa_external_requests add column if not exists hours numeric;
alter table kafaa_external_requests add column if not exists decision_note text;
alter table kafaa_certificates add column if not exists enrolment_id text;
alter table kafaa_certificates add column if not exists issued_by text;
alter table kafaa_item_versions add column if not exists author_person_id text;
alter table kafaa_item_versions add column if not exists change_note text;
alter table kafaa_assessment_forms add column if not exists course_id text;
alter table kafaa_assessment_forms add column if not exists max_attempts integer not null default 3;
alter table kafaa_assessment_forms add column if not exists retake_wait_days integer not null default 7;
alter table kafaa_assessment_forms add column if not exists appeal_days integer not null default 10;
alter table kafaa_attempts add column if not exists attempt_no integer not null default 1;
alter table kafaa_attempts add column if not exists retake_of text;
alter table kafaa_attempts add column if not exists deadline_at timestamptz;
alter table kafaa_attempts add column if not exists late boolean not null default false;
alter table kafaa_attempts add column if not exists released_by text;
alter table kafaa_attempts add column if not exists released_at timestamptz;
alter table kafaa_attempts add column if not exists voided_item_ids text[] not null default '{}'::text[];
alter table kafaa_attempts add column if not exists counts boolean not null default true;
alter table kafaa_attempts add column if not exists evaluator_note text;
alter table kafaa_appeals add column if not exists item_id text;
alter table kafaa_appeals add column if not exists decision_note text;
alter table kafaa_appeals add column if not exists decided_at timestamptz;
alter table kafaa_dev_plans add column if not exists decision_note text;
alter table kafaa_dev_plans add column if not exists decided_at timestamptz;
alter table kafaa_mentoring_requests add column if not exists mentor_person_id text;
alter table kafaa_mentoring_requests add column if not exists message text not null default '';
alter table kafaa_mentoring_requests add column if not exists responded_at timestamptz;
create index if not exists kafaa_mentoring_requests_mentor_person_id_idx on kafaa_mentoring_requests (mentor_person_id);

-- ───────────── 2. Access changes (schema.ts: items, item_versions and appeals are now RPC-only; mentors read requests addressed to them;
--                staff may opt in and edit their own mentor offer)
revoke insert, update, delete on kafaa_items, kafaa_item_versions, kafaa_appeals from anon, authenticated;
do $$ begin
  if exists (select 1 from pg_policies where tablename = 'kafaa_mentoring_requests' and policyname = 'kafaa_read') then
    execute 'alter policy kafaa_read on kafaa_mentoring_requests using (kafaa_rule_read(''dev_plans'', person_id, null::text, true) or kafaa_rule_read(''dev_plans'', mentor_person_id, null::text, true))';
  end if;
  if exists (select 1 from pg_policies where tablename = 'kafaa_mentors' and policyname = 'kafaa_read') then
    execute 'alter policy kafaa_read on kafaa_mentors using (kafaa_rule_read(''internal_content'', null::text, null::text, true) or kafaa_rule_read(''dev_plans'', person_id, null::text, true))';
  end if;
  if exists (select 1 from pg_policies where tablename = 'kafaa_mentors' and policyname = 'kafaa_insert') then
    execute 'alter policy kafaa_insert on kafaa_mentors with check (kafaa_has_grant(''dev_plans'', array[''W'',''A'']) or (person_id = kafaa_me() and kafaa_has_grant(''dev_plans'', array[''Own'',''Scope''])))';
  end if;
  if exists (select 1 from pg_policies where tablename = 'kafaa_mentors' and policyname = 'kafaa_update') then
    execute 'alter policy kafaa_update on kafaa_mentors using (kafaa_has_grant(''dev_plans'', array[''W'',''A'']) or (person_id = kafaa_me() and kafaa_has_grant(''dev_plans'', array[''Own'',''Scope'']))) with check (kafaa_has_grant(''dev_plans'', array[''W'',''A'']) or (person_id = kafaa_me() and kafaa_has_grant(''dev_plans'', array[''Own'',''Scope''])))';
  end if;
  if exists (select 1 from pg_policies where tablename = 'kafaa_appeals' and policyname = 'kafaa_read') then
    execute 'alter policy kafaa_read on kafaa_appeals using (kafaa_rule_read(''qual_records'', person_id, null::text, true) or kafaa_rule_read(''secure_items'', null::text, null::text, true))';
  end if;
end $$;

-- Direct writes to enrolments (learners enrol and update progress) cannot record completion evidence: completion,
-- scores, certificates, attendance and approvals come only from the RPCs below (they run as the function owner).
-- Mirror: src/data/local/guards.ts
create or replace function kafaa_enrolments_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if kafaa_has_grant('training', array['W','A']) then return new; end if;
  if tg_op = 'INSERT' then
    if new.status in ('completed', 'failed', 'approved') or new.certificate_no is not null or new.score is not null or new.evaluation_id is not null
       or new.completed_at is not null or new.attendance is not null or new.decided_by is not null or new.decision_note is not null then
      raise exception 'Completion evidence is recorded by the training organisation' using errcode = '42501';
    end if;
  elsif (new.status is distinct from old.status and new.status in ('completed', 'failed', 'approved'))
     or new.certificate_no is distinct from old.certificate_no or new.score is distinct from old.score or new.evaluation_id is distinct from old.evaluation_id
     or new.completed_at is distinct from old.completed_at or new.attendance is distinct from old.attendance
     or new.decided_by is distinct from old.decided_by or new.decision_note is distinct from old.decision_note then
    raise exception 'Completion evidence is recorded by the training organisation' using errcode = '42501';
  end if;
  return new;
end $$;
create or replace trigger kafaa_enrolments_guard before insert or update on kafaa_enrolments for each row execute function kafaa_enrolments_guard();

-- Approvals and responses are recorded only through the audited RPCs (mirror: src/data/local/guards.ts).
create or replace function kafaa_g2_guard_decisions() returns trigger language plpgsql set search_path = public as $$
declare v_bad boolean := false; v_msg text;
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if tg_table_name = 'kafaa_external_requests' then
    v_msg := 'External requests are decided through the approval workflow';
    if tg_op = 'INSERT' then
      v_bad := new.status <> 'requested' or new.approver_person_id is not null or new.decided_at is not null or new.decision_note is not null;
    else
      v_bad := (new.status is distinct from old.status and new.status <> 'requested') or new.approver_person_id is distinct from old.approver_person_id
        or new.decided_at is distinct from old.decided_at or new.decision_note is distinct from old.decision_note;
    end if;
  elsif tg_table_name = 'kafaa_dev_plans' then
    v_msg := 'Development plans are approved by a line manager';
    if tg_op = 'INSERT' then
      v_bad := new.status not in ('draft', 'submitted', 'closed') or new.approved_by is not null or new.decided_at is not null or new.decision_note is not null;
    else
      v_bad := (new.status is distinct from old.status and new.status not in ('draft', 'submitted', 'closed')) or new.approved_by is distinct from old.approved_by
        or new.decided_at is distinct from old.decided_at or new.decision_note is distinct from old.decision_note;
    end if;
  elsif tg_table_name = 'kafaa_mentoring_requests' then
    v_msg := 'Only the mentor accepts or declines a request';
    if tg_op = 'INSERT' then
      v_bad := new.status <> 'requested' or new.responded_at is not null;
    else
      v_bad := (new.status is distinct from old.status and new.status <> 'closed') or new.responded_at is distinct from old.responded_at;
    end if;
  elsif tg_table_name = 'kafaa_courses' then
    if new.qualifying and new.evaluation_form_id is null then raise exception 'A qualifying course needs a linked evaluation form' using errcode = '23514'; end if;
  end if;
  if v_bad then raise exception '%', v_msg using errcode = '42501'; end if;
  return new;
end $$;
create or replace trigger kafaa_g2_guard before insert or update on kafaa_external_requests for each row execute function kafaa_g2_guard_decisions();
create or replace trigger kafaa_g2_guard before insert or update on kafaa_dev_plans for each row execute function kafaa_g2_guard_decisions();
create or replace trigger kafaa_g2_guard before insert or update on kafaa_mentoring_requests for each row execute function kafaa_g2_guard_decisions();
create or replace trigger kafaa_g2_guard before insert or update on kafaa_courses for each row execute function kafaa_g2_guard_decisions();

-- ───────────── 3. Helpers (internal)
create or replace function kafaa_g2_in_scope(p_person text) returns boolean language sql stable security definer set search_path = public as $$
  select kafaa_in_scope('qual_records', p_person) or kafaa_in_scope('dev_plans', p_person)
$$;
create or replace function kafaa_g2_taken(p_session text) returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from kafaa_enrolments where session_id = p_session and status in ('enrolled', 'in_progress', 'completed')
$$;
create or replace function kafaa_g2_next_cert(p_year integer) returns text language sql stable security definer set search_path = public as $$
  select 'KAF-' || p_year || '-' || lpad((coalesce(max(substring(id from 10 for 6)::int), 0) + 1)::text, 6, '0')
  from kafaa_certificates where id ~ ('^KAF-' || p_year || '-[0-9]{6}$')
$$;
-- Retake rules per standard (src/domain/learning.ts retakeEligibility)
create or replace function kafaa_g2_retake(p_form_id text, p_person text, p_when timestamptz, p_exclude text default null) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare f kafaa_assessment_forms; v_counted integer; v_any boolean; v_last kafaa_attempts; v_earliest date;
begin
  select * into f from kafaa_assessment_forms where id = p_form_id;
  select count(*) filter (where counts), count(*) > 0 into v_counted, v_any from kafaa_attempts where person_id = p_person and form_id = p_form_id and id is distinct from p_exclude;
  if exists (select 1 from kafaa_attempts where person_id = p_person and form_id = p_form_id and id is distinct from p_exclude and status <> 'released') then
    return jsonb_build_object('ok', false, 'code', 'result_pending', 'attempt_no', v_counted + 1);
  end if;
  if exists (select 1 from kafaa_attempts where person_id = p_person and form_id = p_form_id and id is distinct from p_exclude and passed) then
    return jsonb_build_object('ok', false, 'code', 'already_passed', 'attempt_no', v_counted + 1);
  end if;
  if not v_any then return jsonb_build_object('ok', true, 'code', 'first', 'attempt_no', 1); end if;
  if v_counted >= f.max_attempts then return jsonb_build_object('ok', false, 'code', 'retake_limit', 'attempt_no', v_counted + 1); end if;
  select * into v_last from kafaa_attempts where person_id = p_person and form_id = p_form_id and id is distinct from p_exclude order by submitted_at desc nulls last limit 1;
  v_earliest := ((coalesce(v_last.submitted_at, v_last.scheduled_for, now()) + make_interval(days => f.retake_wait_days)) at time zone 'UTC')::date;
  if p_when < (v_earliest::timestamp at time zone 'UTC') then
    return jsonb_build_object('ok', false, 'code', 'retake_wait', 'attempt_no', v_counted + 1, 'earliest', v_earliest, 'retake_of', v_last.id);
  end if;
  return jsonb_build_object('ok', true, 'code', 'ok', 'attempt_no', v_counted + 1, 'retake_of', v_last.id);
end $$;
create or replace function kafaa_g2_retake_message(p_code text, p_earliest text) returns text language sql immutable set search_path = public as $$
  select case p_code
    when 'result_pending' then 'A previous attempt is scheduled, in progress or not yet released'
    when 'already_passed' then 'This candidate has already passed this exam'
    when 'retake_limit' then 'The maximum number of attempts for this standard has been reached'
    when 'retake_wait' then 'The retake waiting period has not ended: earliest ' || coalesce(p_earliest, '')
    else 'Not allowed' end
$$;

-- ───────────── 4. M04 enrolment, sessions, completion, approvals
create or replace function kafaa_enrol_course(p_course_id text, p_session_id text default null, p_person_id text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_target text; v_self boolean; co kafaa_courses; pe kafaa_people; s kafaa_sessions; ex kafaa_enrolments;
  v_role text; v_source text; v_supplier boolean; v_missing text; v_status text; v_id text; a kafaa_audit_events;
begin
  p_session_id := nullif(p_session_id, '');
  if me is null then return kafaa_refuse('enrolment.enrol', 'enrolments', p_course_id, 'not_signed_in', 'Sign in to enrol'); end if;
  v_target := coalesce(nullif(p_person_id, ''), me);
  v_self := v_target = me;
  select * into co from kafaa_courses where id = p_course_id;
  if co.id is null then return kafaa_refuse('enrolment.enrol', 'enrolments', p_course_id, 'not_found', 'Course not found'); end if;
  select * into pe from kafaa_people where id = v_target;
  if pe.id is null then return kafaa_refuse('enrolment.enrol', 'enrolments', p_course_id, 'not_found', 'Person not found'); end if;
  v_supplier := co.audience in ('supplier', 'contractor');
  if v_self then
    v_role := kafaa_acting_role('training', array['Own','OwnOrg','W','A']);
    if v_role is null then return kafaa_refuse('enrolment.enrol', 'enrolments', p_course_id, 'forbidden', 'Training enrolment is not available for your role'); end if;
    v_source := 'self';
  elsif kafaa_has_grant('training', array['W']) then
    v_role := kafaa_acting_role('training', array['W']); v_source := 'coordinator';
  elsif kafaa_has_grant('training', array['A']) and kafaa_g2_in_scope(v_target) then
    v_role := kafaa_acting_role('training', array['A']); v_source := 'manager';
  elsif kafaa_has_grant('training', array['OwnOrg']) and pe.org_id is not null and pe.org_id = kafaa_my_org() and v_supplier then
    v_role := kafaa_acting_role('training', array['OwnOrg']); v_source := 'partner_admin';
  else
    return kafaa_refuse('enrolment.enrol', 'enrolments', p_course_id, 'forbidden', 'You cannot enrol this person');
  end if;
  if co.audience = 'staff' and pe.kind <> 'staff' then return kafaa_refuse('enrolment.enrol', 'enrolments', p_course_id, 'invalid', 'This course is for ENEC staff', v_role); end if;
  if p_session_id is not null then
    select * into s from kafaa_sessions where id = p_session_id;
    if s.id is null or s.course_id <> p_course_id then return kafaa_refuse('enrolment.enrol', 'enrolments', p_course_id, 'not_found', 'Session not found for this course', v_role); end if;
    if s.status <> 'scheduled' then return kafaa_refuse('enrolment.enrol', 'enrolments', p_course_id, 'invalid', 'This session is not open for enrolment', v_role); end if;
    if s.starts_at <= now() then return kafaa_refuse('enrolment.enrol', 'enrolments', p_course_id, 'invalid', 'This session has already started', v_role); end if;
  end if;
  select string_agg(coalesce(c2.code, pr), ', ') into v_missing
  from unnest(co.prerequisites) pr left join kafaa_courses c2 on c2.id = pr
  where not exists (select 1 from kafaa_training_records r where r.person_id = v_target and r.course_id = pr and r.result in ('passed', 'completed', 'attended'))
    and not exists (select 1 from kafaa_enrolments e where e.person_id = v_target and e.course_id = pr and e.status = 'completed');
  if v_missing is not null then return kafaa_refuse('enrolment.enrol', 'enrolments', p_course_id, 'prerequisite', 'Complete the prerequisites first: ' || v_missing, v_role); end if;
  select * into ex from kafaa_enrolments where person_id = v_target and course_id = p_course_id and status in ('assigned', 'requested', 'approved', 'waitlisted', 'enrolled', 'in_progress') order by enrolled_at limit 1;
  if ex.id is not null then
    if ex.status = 'requested' then return kafaa_refuse('enrolment.enrol', 'enrolments', ex.id, 'conflict', 'A request for this course is already waiting for approval', v_role); end if;
    if ex.session_id is not null and ex.session_id = p_session_id then return kafaa_refuse('enrolment.enrol', 'enrolments', ex.id, 'conflict', 'Already booked on this session', v_role); end if;
    if ex.session_id is not null then return kafaa_refuse('enrolment.enrol', 'enrolments', ex.id, 'conflict', 'Already booked on another session of this course; withdraw from it first', v_role); end if;
    if p_session_id is null then return kafaa_refuse('enrolment.enrol', 'enrolments', ex.id, 'conflict', 'Already enrolled in this course', v_role); end if;
    v_status := case when kafaa_g2_taken(p_session_id) < s.capacity then 'enrolled' else 'waitlisted' end;
    update kafaa_enrolments set session_id = p_session_id, status = v_status, waitlisted_at = case when v_status = 'waitlisted' then now() end where id = ex.id;
    a := kafaa_audit('enrolment.book', 'enrolments', ex.id, 'ok', format('%s %s %s', co.code, v_status, p_session_id), 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', case when v_status = 'waitlisted' then 'Added to the waitlist' else 'Seat booked' end, a, null, jsonb_build_object('id', ex.id, 'status', v_status));
  end if;
  if v_self and not co.mandatory and not v_supplier then v_status := 'requested';
  elsif p_session_id is null then v_status := 'enrolled';
  else v_status := case when kafaa_g2_taken(p_session_id) < s.capacity then 'enrolled' else 'waitlisted' end;
  end if;
  v_id := 'en-' || replace(gen_random_uuid()::text, '-', '');
  insert into kafaa_enrolments (id, person_id, course_id, session_id, org_id, status, source, assigned_by, enrolled_at, progress_pct, waitlisted_at)
  values (v_id, v_target, p_course_id, p_session_id, pe.org_id, v_status, v_source, case when v_self then null else me end, now(), 0, case when v_status = 'waitlisted' then now() end);
  a := kafaa_audit(case when v_status = 'requested' then 'enrolment.request' else 'enrolment.enrol' end, 'enrolments', v_id, 'ok', co.code || ' ' || v_status || coalesce(' ' || p_session_id, ''), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case v_status when 'requested' then 'Request sent to your manager for approval' when 'waitlisted' then 'Added to the waitlist' else 'Enrolled' end, a, null, jsonb_build_object('id', v_id, 'status', v_status));
end $$;

create or replace function kafaa_decide_enrolment(p_id text, p_decision text, p_note text default '') returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); e kafaa_enrolments; s kafaa_sessions; co kafaa_courses; v_role text := kafaa_acting_role('training', array['A']);
  v_status text := 'cancelled'; v_session text; a kafaa_audit_events; l integer;
begin
  if v_role is null or me is null then return kafaa_refuse('enrolment.decide', 'enrolments', p_id, 'forbidden', 'Only a manager or the training manager may approve training'); end if;
  select * into e from kafaa_enrolments where id = p_id;
  if e.id is null then return kafaa_refuse('enrolment.decide', 'enrolments', p_id, 'not_found', 'Enrolment not found', v_role); end if;
  if e.person_id = me then return kafaa_refuse('enrolment.decide', 'enrolments', p_id, 'maker_checker', 'You cannot approve your own training request', v_role); end if;
  if not kafaa_role_grant('training_manager', 'training', 'A') and not kafaa_g2_in_scope(e.person_id) then return kafaa_refuse('enrolment.decide', 'enrolments', p_id, 'not_found', 'Enrolment not found in your team', v_role); end if;
  if e.status <> 'requested' then return kafaa_refuse('enrolment.decide', 'enrolments', p_id, 'invalid', 'This enrolment is not awaiting a decision', v_role); end if;
  if p_decision not in ('approve', 'reject') then return kafaa_refuse('enrolment.decide', 'enrolments', p_id, 'invalid', 'Unknown decision', v_role); end if;
  if p_decision = 'reject' and length(trim(coalesce(p_note, ''))) < 5 then return kafaa_refuse('enrolment.decide', 'enrolments', p_id, 'invalid', 'Give a reason for the rejection', v_role); end if;
  v_session := e.session_id;
  if p_decision = 'approve' then
    select * into s from kafaa_sessions where id = e.session_id;
    if s.id is not null and s.status = 'scheduled' and s.starts_at > now() then v_status := case when kafaa_g2_taken(s.id) < s.capacity then 'enrolled' else 'waitlisted' end;
    elsif s.id is not null then v_status := 'approved'; v_session := null;
    else v_status := 'enrolled';
    end if;
  end if;
  update kafaa_enrolments set status = v_status, session_id = v_session, decided_by = me, decision_note = nullif(p_note, ''), waitlisted_at = case when v_status = 'waitlisted' then now() end where id = p_id;
  select * into co from kafaa_courses where id = e.course_id;
  l := kafaa_ledger('kafaa.training.enrolment_decision', format('Enrolment %s (%s) %s', p_id, coalesce(co.code, e.course_id), p_decision));
  a := kafaa_audit('enrolment.decide', 'enrolments', p_id, 'ok', p_decision || ': ' || v_status, case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when p_decision = 'approve' then 'Approved' else 'Rejected' end, a, l, jsonb_build_object('status', v_status));
end $$;

-- Seats taken and waitlist length per session (counts only): learners cannot read other people's enrolments.
create or replace function kafaa_session_availability(p_course_id text) returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not kafaa_has_grant('training', array['Own','OwnOrg','W','A','R']) then return jsonb_build_object('ok', false, 'code', 'forbidden', 'message', 'Sign in to see sessions'); end if;
  return jsonb_build_object('ok', true, 'code', 'ok', 'message', 'ok', 'data', coalesce((
    select jsonb_agg(jsonb_build_object('session_id', s.id, 'capacity', s.capacity, 'taken', kafaa_g2_taken(s.id),
      'waiting', (select count(*) from kafaa_enrolments e where e.session_id = s.id and e.status = 'waitlisted')) order by s.starts_at)
    from kafaa_sessions s where s.course_id = p_course_id), '[]'::jsonb));
end $$;

create or replace function kafaa_cancel_enrolment(p_id text, p_reason text default '') returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); e kafaa_enrolments; co kafaa_courses; v_self boolean; v_coord boolean; v_role text; v_mand boolean; v_status text; v_freed text; v_next text; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('enrolment.cancel', 'enrolments', p_id, 'not_signed_in', 'Sign in first'); end if;
  select * into e from kafaa_enrolments where id = p_id;
  if e.id is null then return kafaa_refuse('enrolment.cancel', 'enrolments', p_id, 'not_found', 'Enrolment not found'); end if;
  v_self := e.person_id = me;
  v_coord := kafaa_has_grant('training', array['W']) or kafaa_role_grant('training_manager', 'training', 'A') or (kafaa_has_grant('training', array['A']) and kafaa_g2_in_scope(e.person_id));
  if not v_self and not v_coord then return kafaa_refuse('enrolment.cancel', 'enrolments', p_id, 'not_found', 'Enrolment not found'); end if;
  v_role := case when v_self and not v_coord then kafaa_acting_role('training', array['Own','OwnOrg']) else kafaa_acting_role('training', array['W','A']) end;
  if e.status not in ('assigned', 'requested', 'approved', 'waitlisted', 'enrolled', 'in_progress') then return kafaa_refuse('enrolment.cancel', 'enrolments', p_id, 'invalid', 'This enrolment is already finished or cancelled', v_role); end if;
  select * into co from kafaa_courses where id = e.course_id;
  v_mand := e.source = 'role_rule' or coalesce(co.mandatory, false);
  if v_self and not v_coord then
    if v_mand and e.session_id is null then return kafaa_refuse('enrolment.cancel', 'enrolments', p_id, 'invalid', 'Mandatory training cannot be cancelled; you can only change the session', v_role); end if;
    v_status := case when v_mand then 'assigned' else 'cancelled' end;
  else
    if not v_self and length(trim(coalesce(p_reason, ''))) < 5 then return kafaa_refuse('enrolment.cancel', 'enrolments', p_id, 'invalid', 'Give a reason', v_role); end if;
    v_status := case when v_mand and e.session_id is not null then 'assigned' else 'cancelled' end;
  end if;
  v_freed := case when e.status in ('enrolled', 'in_progress', 'completed') then e.session_id end;
  update kafaa_enrolments set status = v_status, session_id = case when v_status = 'assigned' then null else session_id end, attendance = null, waitlisted_at = null, decided_by = me, decision_note = nullif(p_reason, '') where id = p_id;
  if v_freed is not null then
    select id into v_next from kafaa_enrolments where session_id = v_freed and status = 'waitlisted' order by coalesce(waitlisted_at, enrolled_at) limit 1;
    if v_next is not null then update kafaa_enrolments set status = 'enrolled', waitlisted_at = null where id = v_next; end if;
  end if;
  a := kafaa_audit('enrolment.cancel', 'enrolments', p_id, 'ok', v_status || coalesce('; promoted ' || v_next || ' from the waitlist', ''), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when v_status = 'assigned' then 'Withdrawn from the session; the assignment stays open' else 'Cancelled' end, a, null, jsonb_build_object('status', v_status, 'promoted', v_next));
end $$;

create or replace function kafaa_record_attendance(p_session_id text, p_marks jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare s kafaa_sessions; m jsonb; e kafaa_enrolments; v_n integer := 0; a kafaa_audit_events; v_role text := kafaa_acting_role('training', array['W','A']);
begin
  if v_role is null then return kafaa_refuse('session.attendance', 'sessions', p_session_id, 'forbidden', 'Only an instructor may record attendance'); end if;
  select * into s from kafaa_sessions where id = p_session_id;
  if s.id is null then return kafaa_refuse('session.attendance', 'sessions', p_session_id, 'not_found', 'Session not found', v_role); end if;
  if s.starts_at > now() then return kafaa_refuse('session.attendance', 'sessions', p_session_id, 'invalid', 'Attendance can be recorded once the session has started', v_role); end if;
  for m in select * from jsonb_array_elements(coalesce(p_marks, '[]'::jsonb)) loop
    select * into e from kafaa_enrolments where id = m->>'enrolment_id';
    continue when e.id is null or e.session_id is distinct from p_session_id or e.status not in ('enrolled', 'in_progress') or coalesce(m->>'attendance', '') not in ('present', 'absent', 'excused');
    update kafaa_enrolments set attendance = m->>'attendance', status = case when m->>'attendance' = 'present' and status = 'enrolled' then 'in_progress' else status end where id = e.id;
    v_n := v_n + 1;
  end loop;
  if v_n = 0 then return kafaa_refuse('session.attendance', 'sessions', p_session_id, 'invalid', 'No enrolment on this session could be marked', v_role); end if;
  a := kafaa_audit('session.attendance', 'enrolments', p_session_id, 'ok', v_n || ' marked', 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', format('Attendance recorded for %s', v_n), a, null, jsonb_build_object('updated', v_n));
end $$;

create or replace function kafaa_complete_enrolment(p_id text, p_result text, p_score numeric default null, p_note text default '') returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); e kafaa_enrolments; co kafaa_courses; s kafaa_sessions; pe kafaa_people; at kafaa_attempts; v_role text; v_eval text; v_score numeric := p_score;
  v_status text; v_rec text; v_cert text; a kafaa_audit_events; l integer; v_material boolean;
begin
  if me is null then return kafaa_refuse('training.complete', 'enrolments', p_id, 'not_signed_in', 'Sign in first'); end if;
  select * into e from kafaa_enrolments where id = p_id;
  if e.id is null then return kafaa_refuse('training.complete', 'enrolments', p_id, 'not_found', 'Enrolment not found'); end if;
  select * into co from kafaa_courses where id = e.course_id;
  if e.person_id = me then
    if not (co.modality = 'elearning' and not co.qualifying and p_result = 'completed' and e.progress_pct >= 100) then
      return kafaa_refuse('training.complete', 'enrolments', p_id, case when kafaa_has_grant('training', array['W','A']) then 'self_sign' else 'forbidden' end,
        'You cannot record completion of your own training; an instructor records it', kafaa_acting_role('training', array['W','A','Own']));
    end if;
    v_role := kafaa_acting_role('training', array['Own','OwnOrg']);
  else
    v_role := kafaa_acting_role('training', array['W','A']);
    if v_role is null then return kafaa_refuse('training.complete', 'enrolments', p_id, 'forbidden', 'Only an instructor or the training manager records completion'); end if;
  end if;
  if e.status not in ('enrolled', 'in_progress', 'assigned') then return kafaa_refuse('training.complete', 'enrolments', p_id, 'invalid', 'This enrolment is not active', v_role); end if;
  if p_result not in ('passed', 'failed', 'completed') then return kafaa_refuse('training.complete', 'enrolments', p_id, 'invalid', 'Result must be passed, failed or completed', v_role); end if;
  select * into s from kafaa_sessions where id = e.session_id;
  if s.id is not null and s.kind <> 'elearning' and e.attendance is distinct from 'present' then
    return kafaa_refuse('training.complete', 'enrolments', p_id, 'invalid', 'Record attendance first: completion needs evidence of attendance', v_role);
  end if;
  if co.qualifying then
    if p_result = 'completed' then return kafaa_refuse('training.complete', 'enrolments', p_id, 'invalid', 'A qualifying course completes as passed or failed', v_role); end if;
    if p_result = 'passed' then
      if co.evaluation_form_id is null then
        return kafaa_refuse('training.complete', 'enrolments', p_id, 'evaluation_required', 'A qualifying course cannot complete without its linked evaluation: no linked evaluation is defined for this course', v_role);
      end if;
      select * into at from kafaa_attempts where person_id = e.person_id and form_id = co.evaluation_form_id and status = 'released' and released and passed
      order by coalesce(released_at, submitted_at) desc nulls last limit 1;
      if at.id is null then
        return kafaa_refuse('training.complete', 'enrolments', p_id, 'evaluation_required', 'A qualifying course cannot complete without its linked evaluation: ' ||
          case when exists (select 1 from kafaa_attempts where person_id = e.person_id and form_id = co.evaluation_form_id and status = 'released' and released)
               then 'the linked evaluation was not passed' else 'the linked evaluation has not been passed and released' end, v_role);
      end if;
      v_eval := at.id;
      v_score := coalesce(at.score, p_score);
    end if;
  elsif p_result = 'passed' and co.pass_mark is not null and (p_score is null or p_score < co.pass_mark) then
    return kafaa_refuse('training.complete', 'enrolments', p_id, 'invalid', format('A pass needs a score of at least %s', co.pass_mark), v_role);
  end if;
  v_status := case when p_result = 'failed' then 'failed' else 'completed' end;
  v_rec := 'tr-' || replace(gen_random_uuid()::text, '-', '');
  insert into kafaa_training_records (id, person_id, course_id, completed_on, hours, result, source_system, evaluation_id, enrolment_id)
  values (v_rec, e.person_id, e.course_id, current_date, coalesce(co.duration_hours, 0),
          case when p_result = 'completed' then case when e.attendance = 'present' then 'attended' else 'completed' end else p_result end,
          'Kafa''a (pending sync to the training records system)', v_eval, p_id);
  if p_result = 'passed' then
    select * into pe from kafaa_people where id = e.person_id;
    v_cert := kafaa_g2_next_cert(extract(year from current_date)::int);
    insert into kafaa_certificates (id, person_id, org_id, holder_initials, course_id, issued_on, valid_to, status, enrolment_id, issued_by)
    values (v_cert, e.person_id, pe.org_id, coalesce(nullif(pe.initials, ''), '—'), e.course_id, current_date,
            case when co.validity_months is not null then (current_date + make_interval(months => co.validity_months))::date end, 'valid', p_id, me);
  end if;
  update kafaa_enrolments set status = v_status, completed_at = now(), score = v_score, certificate_no = v_cert, evaluation_id = v_eval,
    progress_pct = case when p_result = 'failed' then progress_pct else 100 end, decision_note = coalesce(nullif(p_note, ''), decision_note) where id = p_id;
  v_material := p_result = 'passed' and co.qualifying;
  if v_material then l := kafaa_ledger('kafaa.training.complete', format('%s %s for %s; certificate %s', co.code, p_result, e.person_id, v_cert)); end if;
  a := kafaa_audit('training.complete', 'enrolments', p_id, 'ok', co.code || ' ' || p_result || coalesce(' certificate ' || v_cert, ''),
    case when not v_material then 'not_applicable' when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case p_result when 'passed' then 'Passed: certificate issued' when 'failed' then 'Recorded as not passed' else 'Completion recorded' end, a, l,
    jsonb_build_object('status', v_status, 'certificate_no', v_cert, 'record_id', v_rec));
end $$;

create or replace function kafaa_decide_external_request(p_id text, p_decision text, p_note text default '') returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); x kafaa_external_requests; a kafaa_audit_events; l integer; v_role text := kafaa_acting_role('training', array['A']);
begin
  if v_role is null or me is null then return kafaa_refuse('external.decide', 'external_requests', p_id, 'forbidden', 'Only a manager or the training manager may decide external requests'); end if;
  select * into x from kafaa_external_requests where id = p_id;
  if x.id is null then return kafaa_refuse('external.decide', 'external_requests', p_id, 'not_found', 'Request not found', v_role); end if;
  if x.person_id = me then return kafaa_refuse('external.decide', 'external_requests', p_id, 'maker_checker', 'You cannot approve your own request', v_role); end if;
  if not kafaa_role_grant('training_manager', 'training', 'A') and not kafaa_g2_in_scope(x.person_id) then return kafaa_refuse('external.decide', 'external_requests', p_id, 'not_found', 'Request not found in your team', v_role); end if;
  if x.status <> 'requested' then return kafaa_refuse('external.decide', 'external_requests', p_id, 'invalid', 'This request is not awaiting a decision', v_role); end if;
  if p_decision not in ('approved', 'rejected') then return kafaa_refuse('external.decide', 'external_requests', p_id, 'invalid', 'Unknown decision', v_role); end if;
  if p_decision = 'rejected' and length(trim(coalesce(p_note, ''))) < 5 then return kafaa_refuse('external.decide', 'external_requests', p_id, 'invalid', 'Give a reason for the rejection', v_role); end if;
  update kafaa_external_requests set status = p_decision, approver_person_id = me, decided_at = now(), decision_note = nullif(p_note, '') where id = p_id;
  l := kafaa_ledger('kafaa.training.external_request', format('External course request %s: %s', p_id, p_decision));
  a := kafaa_audit('external.decide', 'external_requests', p_id, 'ok', p_decision, case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when p_decision = 'approved' then 'Approved' else 'Rejected' end, a, l);
end $$;

create or replace function kafaa_curriculum_sync(p_person_id text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_role text := coalesce(kafaa_acting_role('training', array['W','A']), case when kafaa_has_grant('users_roles', array['W']) then 'admin' end);
  v_people integer; v_assigned integer := 0; v_withdrawn integer := 0; a kafaa_audit_events;
begin
  p_person_id := nullif(p_person_id, '');
  if v_role is null then return kafaa_refuse('curriculum.sync', 'enrolments', coalesce(p_person_id, 'all'), 'forbidden', 'Only training administrators run the curriculum sync'); end if;
  select count(*) into v_people from kafaa_people p where p.kind = 'staff' and p.status = 'active' and p.job_role_id is not null and (p_person_id is null or p.id = p_person_id);
  if p_person_id is not null and v_people = 0 then return kafaa_refuse('curriculum.sync', 'enrolments', p_person_id, 'not_found', 'Person or role not found', v_role); end if;
  insert into kafaa_enrolments (id, person_id, course_id, status, source, assigned_by, due_on, org_id)
  select 'en-' || replace(gen_random_uuid()::text, '-', ''), p.id, c.course_id, 'assigned', 'role_rule', 'Curriculum rule', current_date + c.due_within_days, p.org_id
  from kafaa_people p join (select distinct on (role_id, course_id) * from kafaa_curriculum_rules where mandatory order by role_id, course_id, due_within_days) c on c.role_id = p.job_role_id
  where p.kind = 'staff' and p.status = 'active' and (p_person_id is null or p.id = p_person_id)
    and not exists (select 1 from kafaa_enrolments e where e.person_id = p.id and e.course_id = c.course_id and e.status not in ('cancelled', 'failed'));
  get diagnostics v_assigned = row_count;
  update kafaa_enrolments e set status = 'cancelled', decision_note = 'Withdrawn by curriculum sync: not required for ' || p.job_role_id
  from kafaa_people p
  where p.id = e.person_id and p.kind = 'staff' and p.status = 'active' and p.job_role_id is not null and (p_person_id is null or p.id = p_person_id)
    and e.source = 'role_rule' and e.status = 'assigned' and e.session_id is null
    and not exists (select 1 from kafaa_curriculum_rules c where c.role_id = p.job_role_id and c.mandatory and c.course_id = e.course_id);
  get diagnostics v_withdrawn = row_count;
  a := kafaa_audit('curriculum.sync', 'enrolments', coalesce(p_person_id, 'all'), 'ok', format('%s people, %s assigned, %s withdrawn', v_people, v_assigned, v_withdrawn), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', format('Sync complete: %s assigned, %s withdrawn', v_assigned, v_withdrawn), a, null, jsonb_build_object('people', v_people, 'assigned', v_assigned, 'withdrawn', v_withdrawn));
end $$;

create or replace function kafaa_decide_dev_plan(p_id text, p_decision text, p_note text default '') returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); p kafaa_dev_plans; a kafaa_audit_events; l integer; v_role text := kafaa_acting_role('dev_plans', array['A']);
begin
  if v_role is null or me is null then return kafaa_refuse('devplan.decide', 'dev_plans', p_id, 'forbidden', 'Only a line manager may approve a development plan'); end if;
  select * into p from kafaa_dev_plans where id = p_id;
  if p.id is null then return kafaa_refuse('devplan.decide', 'dev_plans', p_id, 'not_found', 'Plan not found', v_role); end if;
  if p.person_id = me then return kafaa_refuse('devplan.decide', 'dev_plans', p_id, 'maker_checker', 'You cannot approve your own plan', v_role); end if;
  if not kafaa_in_scope('dev_plans', p.person_id) then return kafaa_refuse('devplan.decide', 'dev_plans', p_id, 'not_found', 'Plan not found in your team', v_role); end if;
  if p.status <> 'submitted' then return kafaa_refuse('devplan.decide', 'dev_plans', p_id, 'invalid', 'This plan is not awaiting approval', v_role); end if;
  if p_decision not in ('approve', 'return') then return kafaa_refuse('devplan.decide', 'dev_plans', p_id, 'invalid', 'Unknown decision', v_role); end if;
  if p_decision = 'return' and length(trim(coalesce(p_note, ''))) < 5 then return kafaa_refuse('devplan.decide', 'dev_plans', p_id, 'invalid', 'Say what needs to change', v_role); end if;
  update kafaa_dev_plans set status = case when p_decision = 'approve' then 'active' else 'draft' end, approved_by = case when p_decision = 'approve' then me else approved_by end,
    decision_note = nullif(p_note, ''), decided_at = now() where id = p_id;
  if p_decision = 'approve' then l := kafaa_ledger('kafaa.devplan.approve', format('Development plan %s approved', p_id)); end if;
  a := kafaa_audit('devplan.decide', 'dev_plans', p_id, 'ok', p_decision, case when p_decision <> 'approve' then 'not_applicable' when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when p_decision = 'approve' then 'Plan approved' else 'Plan returned' end, a, l);
end $$;

create or replace function kafaa_respond_mentoring(p_id text, p_decision text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); r kafaa_mentoring_requests; mt kafaa_mentors; v_mentor_person text; a kafaa_audit_events; v_role text := kafaa_acting_role('dev_plans', array['Own','Scope','A']);
begin
  if me is null or v_role is null then return kafaa_refuse('mentoring.respond', 'mentoring_requests', p_id, 'forbidden', 'Mentoring is for staff'); end if;
  select * into r from kafaa_mentoring_requests where id = p_id;
  if r.id is null then return kafaa_refuse('mentoring.respond', 'mentoring_requests', p_id, 'not_found', 'Request not found', v_role); end if;
  select * into mt from kafaa_mentors where id = r.mentor_id;
  v_mentor_person := coalesce(r.mentor_person_id, mt.person_id);
  if p_decision = 'closed' then
    if me is distinct from r.person_id and me is distinct from v_mentor_person then return kafaa_refuse('mentoring.respond', 'mentoring_requests', p_id, 'not_found', 'Request not found', v_role); end if;
    if r.status in ('closed', 'declined') then return kafaa_refuse('mentoring.respond', 'mentoring_requests', p_id, 'invalid', 'Already closed', v_role); end if;
  elsif p_decision in ('matched', 'declined') then
    if me is distinct from v_mentor_person then return kafaa_refuse('mentoring.respond', 'mentoring_requests', p_id, 'forbidden', 'Only the mentor can accept or decline', v_role); end if;
    if r.status <> 'requested' then return kafaa_refuse('mentoring.respond', 'mentoring_requests', p_id, 'invalid', 'This request is not waiting for a response', v_role); end if;
    if p_decision = 'matched' and mt.id is not null and (select count(*) from kafaa_mentoring_requests where mentor_id = mt.id and status = 'matched') >= mt.capacity then
      return kafaa_refuse('mentoring.respond', 'mentoring_requests', p_id, 'conflict', 'You have no free mentoring capacity; raise it or close a match first', v_role);
    end if;
  else
    return kafaa_refuse('mentoring.respond', 'mentoring_requests', p_id, 'invalid', 'Unknown decision', v_role);
  end if;
  update kafaa_mentoring_requests set status = p_decision, responded_at = now() where id = p_id;
  a := kafaa_audit('mentoring.respond', 'mentoring_requests', p_id, 'ok', p_decision, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case p_decision when 'matched' then 'Match confirmed' when 'declined' then 'Request declined' else 'Closed' end, a);
end $$;

-- ───────────── 5. M05 item bank (replaces the foundation's kafaa_item_review: status checks; writer approving own item = maker_checker)
create or replace function kafaa_item_review(p_item_id text, p_action text) returns jsonb language plpgsql security definer set search_path = public as $$
declare i kafaa_items; me text := kafaa_me(); a kafaa_audit_events; v_role text := kafaa_acting_role('secure_items', array['W','A']);
begin
  if v_role is null then return kafaa_refuse('item.' || p_action, 'items', p_item_id, 'forbidden', 'Item bank access required'); end if;
  select * into i from kafaa_items where id = p_item_id;
  if i.id is null then return kafaa_refuse('item.' || p_action, 'items', p_item_id, 'not_found', 'Item not found', v_role); end if;
  if p_action = 'submit' then
    if i.writer_person_id is distinct from me then return kafaa_refuse('item.submit', 'items', p_item_id, 'forbidden', 'Only the writer submits for review', v_role); end if;
    if i.status <> 'draft' then return kafaa_refuse('item.submit', 'items', p_item_id, 'invalid', 'Only a draft can be submitted for review', v_role); end if;
    update kafaa_items set status = 'in_review' where id = p_item_id;
  elsif p_action = 'review' then
    if i.writer_person_id = me then return kafaa_refuse('item.review', 'items', p_item_id, 'separation_of_duties', 'The writer cannot review their own item', v_role); end if;
    if i.status <> 'in_review' then return kafaa_refuse('item.review', 'items', p_item_id, 'invalid', 'The item is not in review', v_role); end if;
    update kafaa_items set reviewer_person_id = me where id = p_item_id;
  elsif p_action = 'approve' then
    if not kafaa_has_grant('secure_items', array['A']) then return kafaa_refuse('item.approve', 'items', p_item_id, 'forbidden', 'Approver role required', v_role); end if;
    if i.writer_person_id = me then return kafaa_refuse('item.approve', 'items', p_item_id, 'maker_checker', 'You wrote this item: a different person must approve it', v_role); end if;
    if i.reviewer_person_id = me then return kafaa_refuse('item.approve', 'items', p_item_id, 'separation_of_duties', 'Writer, reviewer and approver must be different people', v_role); end if;
    if i.status <> 'in_review' or i.reviewer_person_id is null then return kafaa_refuse('item.approve', 'items', p_item_id, 'invalid', 'Item has not been reviewed', v_role); end if;
    update kafaa_items set status = 'approved', approver_person_id = me where id = p_item_id;
  else
    return kafaa_refuse('item.' || p_action, 'items', p_item_id, 'invalid', 'Unknown action', v_role);
  end if;
  a := kafaa_audit('item.' || p_action, 'items', p_item_id, 'ok', null, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Recorded', a);
end $$;

create or replace function kafaa_save_item(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text := kafaa_acting_role('secure_items', array['W','A']); i kafaa_items; v_id text := nullif(p->>'id', ''); v_ver integer := 1;
  v_opts jsonb := coalesce(p->'options', '[]'::jsonb); v_n integer; v_ids text[]; a kafaa_audit_events;
begin
  if v_role is null or me is null then return kafaa_refuse('item.save', 'items', v_id, 'forbidden', 'Item bank access required'); end if;
  if coalesce(trim(p->>'stem_en'), '') = '' or coalesce(trim(p->>'stem_ar'), '') = '' then return kafaa_refuse('item.save', 'items', v_id, 'invalid', 'The stem is required in English and Arabic', v_role); end if;
  if jsonb_typeof(v_opts) <> 'array' then v_opts := '[]'::jsonb; end if;
  v_n := jsonb_array_length(v_opts);
  select array_agg(o->>'id') into v_ids from jsonb_array_elements(v_opts) o;
  if v_n < 2 or v_n > 6 or (select count(distinct x) from unnest(v_ids) x) <> v_n
     or exists (select 1 from jsonb_array_elements(v_opts) o where coalesce(trim(o->>'en'), '') = '' or coalesce(trim(o->>'ar'), '') = '' or coalesce(o->>'id', '') = '') then
    return kafaa_refuse('item.save', 'items', v_id, 'invalid', 'Give 2 to 6 distinct options in both languages', v_role);
  end if;
  if not (coalesce(p->>'answer', '') = any(v_ids)) then return kafaa_refuse('item.save', 'items', v_id, 'invalid', 'The key must be one of the options', v_role); end if;
  if coalesce(p->>'bank', '') not in ('secure', 'practice') or coalesce(p->>'difficulty', '') not in ('easy', 'medium', 'hard') then return kafaa_refuse('item.save', 'items', v_id, 'invalid', 'Unknown bank or difficulty', v_role); end if;
  if v_id is not null then
    select * into i from kafaa_items where id = v_id;
    if i.id is null then return kafaa_refuse('item.save', 'items', v_id, 'not_found', 'Item not found', v_role); end if;
    if i.status = 'retired' then return kafaa_refuse('item.save', 'items', v_id, 'invalid', 'Retired items cannot be edited', v_role); end if;
    v_ver := i.current_version + 1;
    update kafaa_items set current_version = v_ver, status = 'draft', writer_person_id = me, reviewer_person_id = null, approver_person_id = null,
      topic = coalesce(p->>'topic', topic), competency_id = nullif(p->>'competency_id', ''), difficulty = p->>'difficulty', reference = nullif(p->>'reference', '') where id = v_id;
  else
    v_id := 'it-' || replace(gen_random_uuid()::text, '-', '');
    insert into kafaa_items (id, bank, is_practice, competency_id, task_id, topic, difficulty, reference, current_version, status, writer_person_id)
    values (v_id, p->>'bank', p->>'bank' = 'practice', nullif(p->>'competency_id', ''), null, coalesce(p->>'topic', ''), p->>'difficulty', nullif(p->>'reference', ''), 1, 'draft', me);
  end if;
  select * into i from kafaa_items where id = v_id;
  insert into kafaa_item_versions (id, item_id, version, is_practice, stem_en, stem_ar, options, answer, rationale_en, rationale_ar, author_person_id, change_note)
  values (v_id || '-v' || v_ver, v_id, v_ver, i.is_practice, trim(p->>'stem_en'), trim(p->>'stem_ar'), v_opts, p->>'answer', coalesce(p->>'rationale_en', ''), coalesce(p->>'rationale_ar', ''), me, nullif(p->>'change_note', ''));
  -- the audit reason carries the version and bank only: secure item text never enters the log
  a := kafaa_audit('item.save', 'items', v_id, 'ok', format('v%s saved (%s)', v_ver, i.bank), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when v_ver = 1 then 'Draft item created' else format('Version %s saved as a draft', v_ver) end, a, null, jsonb_build_object('id', v_id, 'version', v_ver));
end $$;

create or replace function kafaa_retire_item(p_id text, p_reason text default '') returns jsonb language plpgsql security definer set search_path = public as $$
declare i kafaa_items; a kafaa_audit_events; v_role text := kafaa_acting_role('secure_items', array['A']);
begin
  if v_role is null then return kafaa_refuse('item.retire', 'items', p_id, 'forbidden', 'Only the training manager may retire items'); end if;
  select * into i from kafaa_items where id = p_id;
  if i.id is null then return kafaa_refuse('item.retire', 'items', p_id, 'not_found', 'Item not found', v_role); end if;
  if i.status = 'retired' then return kafaa_refuse('item.retire', 'items', p_id, 'invalid', 'Already retired', v_role); end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then return kafaa_refuse('item.retire', 'items', p_id, 'invalid', 'Give a reason', v_role); end if;
  update kafaa_items set status = 'retired' where id = p_id;
  a := kafaa_audit('item.retire', 'items', p_id, 'ok', 'retired', 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Item retired', a);
end $$;

-- ───────────── 6. M05 delivery and results
create or replace function kafaa_schedule_attempt(p_form_id text, p_person_id text, p_scheduled_for timestamptz, p_proctor text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); f kafaa_assessment_forms; v_role text := kafaa_acting_role('secure_items', array['W','A']); v_proctor text; el jsonb; v_id text; a kafaa_audit_events;
begin
  if v_role is null or me is null then return kafaa_refuse('attempt.schedule', 'attempts', p_form_id, 'forbidden', 'Only an instructor may schedule exams'); end if;
  select * into f from kafaa_assessment_forms where id = p_form_id;
  if f.id is null then return kafaa_refuse('attempt.schedule', 'attempts', p_form_id, 'not_found', 'Form not found', v_role); end if;
  if f.is_practice or f.status <> 'approved' then return kafaa_refuse('attempt.schedule', 'attempts', p_form_id, 'invalid', 'Only an approved exam form can be scheduled', v_role); end if;
  if not exists (select 1 from kafaa_people where id = p_person_id) then return kafaa_refuse('attempt.schedule', 'attempts', p_form_id, 'not_found', 'Candidate not found', v_role); end if;
  if p_person_id = me then return kafaa_refuse('attempt.schedule', 'attempts', p_form_id, 'separation_of_duties', 'You cannot schedule your own exam', v_role); end if;
  v_proctor := coalesce(nullif(p_proctor, ''), me);
  if v_proctor = p_person_id then return kafaa_refuse('attempt.schedule', 'attempts', p_form_id, 'separation_of_duties', 'A candidate cannot proctor their own exam', v_role); end if;
  if p_scheduled_for is null then return kafaa_refuse('attempt.schedule', 'attempts', p_form_id, 'invalid', 'Give a valid date and time', v_role); end if;
  el := kafaa_g2_retake(p_form_id, p_person_id, p_scheduled_for);
  if not (el->>'ok')::boolean then return kafaa_refuse('attempt.schedule', 'attempts', p_form_id, el->>'code', kafaa_g2_retake_message(el->>'code', el->>'earliest'), v_role); end if;
  v_id := 'at-' || replace(gen_random_uuid()::text, '-', '');
  insert into kafaa_attempts (id, form_id, person_id, scheduled_for, status, proctor_person_id, released, attempt_no, retake_of)
  values (v_id, p_form_id, p_person_id, p_scheduled_for, 'scheduled', v_proctor, false, (el->>'attempt_no')::int, el->>'retake_of');
  a := kafaa_audit('attempt.schedule', 'attempts', v_id, 'ok', format('%s attempt %s', p_form_id, el->>'attempt_no'), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when (el->>'attempt_no')::int > 1 then format('Retake scheduled (attempt %s)', el->>'attempt_no') else 'Exam scheduled' end, a, null,
    jsonb_build_object('id', v_id, 'attempt_no', (el->>'attempt_no')::int));
end $$;

create or replace function kafaa_start_attempt(p_id text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); at kafaa_attempts; f kafaa_assessment_forms; v_role text; v_deadline timestamptz; v_items jsonb; a kafaa_audit_events;
begin
  select * into at from kafaa_attempts where id = p_id;
  if me is null or at.id is null or at.person_id <> me then return kafaa_refuse('attempt.start', 'attempts', p_id, 'not_found', 'Exam not found'); end if;
  v_role := coalesce(kafaa_acting_role('qual_records', array['Own']), kafaa_acting_role('training', array['Own','OwnOrg']));
  select * into f from kafaa_assessment_forms where id = at.form_id;
  if f.kind <> 'written' then return kafaa_refuse('attempt.start', 'attempts', p_id, 'invalid', 'This evaluation is recorded by an evaluator, not taken online', v_role); end if;
  v_deadline := at.deadline_at;
  if at.status = 'in_progress' then
    if v_deadline is not null and now() > v_deadline + interval '2 minutes' then return kafaa_refuse('attempt.start', 'attempts', p_id, 'invalid', 'Time is up for this exam; submit your answers', v_role); end if;
  elsif at.status = 'scheduled' then
    if at.scheduled_for is not null and now() < at.scheduled_for - interval '24 hours' then
      return kafaa_refuse('attempt.start', 'attempts', p_id, 'invalid', 'This exam opens on ' || to_char(at.scheduled_for at time zone 'UTC', 'YYYY-MM-DD'), v_role);
    end if;
    v_deadline := now() + make_interval(mins => f.time_limit_min);
    update kafaa_attempts set status = 'in_progress', started_at = now(), deadline_at = v_deadline where id = p_id;
  else
    return kafaa_refuse('attempt.start', 'attempts', p_id, 'invalid', 'This exam is not open', v_role);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('item_id', it.id, 'version', v.version, 'stem_en', v.stem_en, 'stem_ar', v.stem_ar,
           'options', (select coalesce(jsonb_agg(jsonb_build_object('id', o->>'id', 'en', o->>'en', 'ar', o->>'ar')), '[]'::jsonb) from jsonb_array_elements(v.options) o)) order by u.ord), '[]'::jsonb)
  into v_items
  from unnest(f.item_ids) with ordinality u(iid, ord)
  join kafaa_items it on it.id = u.iid and it.status <> 'retired'
  join kafaa_item_versions v on v.item_id = it.id and v.version = it.current_version;
  a := kafaa_audit('attempt.start', 'attempts', p_id, 'ok', format('%s: %s items delivered', f.id, jsonb_array_length(v_items)), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Exam started', a, null, jsonb_build_object('deadline_at', v_deadline, 'time_limit_min', f.time_limit_min, 'items', v_items));
end $$;

create or replace function kafaa_submit_attempt(p_id text, p_answers jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); at kafaa_attempts; f kafaa_assessment_forms; v_role text; v_total integer; v_correct integer; v_answered integer; v_score integer; v_late boolean; a kafaa_audit_events;
begin
  select * into at from kafaa_attempts where id = p_id;
  if me is null or at.id is null or at.person_id <> me then return kafaa_refuse('attempt.submit', 'attempts', p_id, 'not_found', 'Exam not found'); end if;
  v_role := coalesce(kafaa_acting_role('qual_records', array['Own']), kafaa_acting_role('training', array['Own','OwnOrg']));
  if at.status <> 'in_progress' then return kafaa_refuse('attempt.submit', 'attempts', p_id, 'invalid', 'This exam is not in progress', v_role); end if;
  select * into f from kafaa_assessment_forms where id = at.form_id;
  insert into kafaa_responses (id, attempt_id, item_id, version, answer, correct)
  select 'rs-' || replace(gen_random_uuid()::text, '-', ''), p_id, it.id, v.version, coalesce(g.answer, ''), g.answer is not null and g.answer = v.answer
  from unnest(f.item_ids) u(iid)
  join kafaa_items it on it.id = u.iid
  join kafaa_item_versions v on v.item_id = it.id and v.version = it.current_version
  left join lateral (select x->>'answer' as answer from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) x where x->>'item_id' = it.id limit 1) g on true;
  select count(*) filter (where not (item_id = any(at.voided_item_ids))), count(*) filter (where correct and not (item_id = any(at.voided_item_ids))), count(*) filter (where answer <> '')
  into v_total, v_correct, v_answered from kafaa_responses where attempt_id = p_id;
  v_score := case when v_total > 0 then round(v_correct * 100.0 / v_total) else 0 end;
  v_late := at.deadline_at is not null and now() > at.deadline_at + interval '2 minutes';
  update kafaa_attempts set status = 'graded', submitted_at = now(), score = v_score, passed = v_score >= f.pass_mark, late = v_late where id = p_id;
  a := kafaa_audit('attempt.submit', 'attempts', p_id, 'ok', format('%s/%s answered%s', v_answered, v_total, case when v_late then ' (late)' else '' end), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Submitted. Your result is released after an evaluator signs it off.', a, null, jsonb_build_object('late', v_late, 'answered', v_answered));
end $$;

create or replace function kafaa_release_attempt(p_id text, p_note text default '') returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); at kafaa_attempts; a kafaa_audit_events; l integer; v_role text := coalesce(kafaa_acting_role('secure_items', array['W','A']), kafaa_acting_role('signoff', array['A']));
begin
  if v_role is null or me is null then return kafaa_refuse('attempt.release', 'attempts', p_id, 'forbidden', 'Only an evaluator may release results'); end if;
  select * into at from kafaa_attempts where id = p_id;
  if at.id is null then return kafaa_refuse('attempt.release', 'attempts', p_id, 'not_found', 'Attempt not found', v_role); end if;
  if at.person_id = me then return kafaa_refuse('attempt.release', 'attempts', p_id, 'self_sign', 'You cannot release your own result', v_role); end if;
  if at.status <> 'graded' then return kafaa_refuse('attempt.release', 'attempts', p_id, 'invalid', 'Only a graded attempt can be released', v_role); end if;
  update kafaa_attempts set status = 'released', released = true, released_by = me, released_at = now(), evaluator_note = nullif(p_note, '') where id = p_id;
  l := kafaa_ledger('kafaa.assessment.release', format('Assessment result %s (%s) released: %s', p_id, at.form_id, case when at.passed then 'pass' else 'not passed' end));
  a := kafaa_audit('attempt.release', 'attempts', p_id, 'ok', case when at.passed then 'pass' else 'fail' end, case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Result released to the candidate', a, l, jsonb_build_object('passed', at.passed, 'score', at.score));
end $$;

create or replace function kafaa_record_performance(p_form_id text, p_person_id text, p_passed boolean, p_score numeric default null, p_note text default '') returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); f kafaa_assessment_forms; v_open kafaa_attempts; el jsonb; v_id text; a kafaa_audit_events; l integer; v_role text := kafaa_acting_role('signoff', array['A']);
begin
  if v_role is null or me is null then return kafaa_refuse('performance.record', 'attempts', p_form_id, 'forbidden', 'Only a qualified evaluator may record a performance evaluation'); end if;
  if p_person_id = me then return kafaa_refuse('performance.record', 'attempts', p_form_id, 'self_sign', 'An evaluator cannot evaluate themselves', v_role); end if;
  select * into f from kafaa_assessment_forms where id = p_form_id;
  if f.id is null then return kafaa_refuse('performance.record', 'attempts', p_form_id, 'not_found', 'Form not found', v_role); end if;
  if f.kind = 'written' or f.is_practice then return kafaa_refuse('performance.record', 'attempts', p_form_id, 'invalid', 'Written exams are taken by the candidate', v_role); end if;
  if not exists (select 1 from kafaa_people where id = p_person_id) then return kafaa_refuse('performance.record', 'attempts', p_form_id, 'not_found', 'Candidate not found', v_role); end if;
  if length(trim(coalesce(p_note, ''))) < 5 then return kafaa_refuse('performance.record', 'attempts', p_form_id, 'invalid', 'Record the evidence in a short note', v_role); end if;
  if p_score is not null and (p_score < 0 or p_score > 100) then return kafaa_refuse('performance.record', 'attempts', p_form_id, 'invalid', 'Score must be 0 to 100', v_role); end if;
  select * into v_open from kafaa_attempts where person_id = p_person_id and form_id = p_form_id and status = 'scheduled' order by scheduled_for limit 1;
  el := kafaa_g2_retake(p_form_id, p_person_id, now(), v_open.id);
  if not (el->>'ok')::boolean then return kafaa_refuse('performance.record', 'attempts', p_form_id, el->>'code', kafaa_g2_retake_message(el->>'code', el->>'earliest'), v_role); end if;
  if v_open.id is not null then
    v_id := v_open.id;
    update kafaa_attempts set started_at = now(), submitted_at = now(), score = p_score, passed = p_passed, status = 'released', released = true, released_by = me, released_at = now(),
      evaluator_note = p_note, proctor_person_id = me where id = v_id;
  else
    v_id := 'at-' || replace(gen_random_uuid()::text, '-', '');
    insert into kafaa_attempts (id, form_id, person_id, scheduled_for, started_at, submitted_at, score, passed, status, released, released_by, released_at, evaluator_note, proctor_person_id, attempt_no, retake_of)
    values (v_id, p_form_id, p_person_id, now(), now(), now(), p_score, p_passed, 'released', true, me, now(), p_note, me, (el->>'attempt_no')::int, el->>'retake_of');
  end if;
  l := kafaa_ledger('kafaa.assessment.performance', format('Performance evaluation %s for %s: %s', p_form_id, p_person_id, case when p_passed then 'pass' else 'not passed' end));
  a := kafaa_audit('performance.record', 'attempts', v_id, 'ok', p_form_id || case when p_passed then ' pass' else ' fail' end, case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Evaluation recorded', a, l, jsonb_build_object('id', v_id));
end $$;

-- Candidate feedback: score and per-competency breakdown only (never item text or keys). Read-only, not audited.
create or replace function kafaa_attempt_feedback(p_id text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); at kafaa_attempts; f kafaa_assessment_forms; v_staff boolean; v_by jsonb; v_total integer; v_correct integer;
begin
  select * into at from kafaa_attempts where id = p_id;
  if at.id is null then return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'Not found'); end if;
  v_staff := kafaa_has_grant('secure_items', array['W','A']) or kafaa_in_scope('qual_records', at.person_id);
  if not (at.person_id = me or v_staff) then return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'Not found'); end if;
  if at.person_id = me and not at.released then return jsonb_build_object('ok', false, 'code', 'invalid', 'message', 'Your result has not been released yet'); end if;
  select * into f from kafaa_assessment_forms where id = at.form_id;
  select coalesce(jsonb_agg(jsonb_build_object('competency_id', comp, 'correct', c, 'total', n)), '[]'::jsonb), coalesce(sum(n), 0), coalesce(sum(c), 0) into v_by, v_total, v_correct
  from (select it.competency_id as comp, count(*) filter (where r.correct)::int as c, count(*)::int as n
        from kafaa_responses r join kafaa_items it on it.id = r.item_id
        where r.attempt_id = p_id and not (r.item_id = any(at.voided_item_ids)) group by it.competency_id) g;
  return jsonb_build_object('ok', true, 'code', 'ok', 'message', 'ok', 'data', jsonb_build_object('score', at.score, 'passed', at.passed, 'pass_mark', f.pass_mark, 'total', v_total, 'correct', v_correct, 'by_competency', v_by));
end $$;

create or replace function kafaa_file_appeal(p_attempt_id text, p_reason text, p_item_id text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); at kafaa_attempts; f kafaa_assessment_forms; v_role text; v_close timestamptz; v_id text; a kafaa_audit_events;
begin
  select * into at from kafaa_attempts where id = p_attempt_id;
  if me is null or at.id is null or at.person_id <> me then return kafaa_refuse('appeal.file', 'appeals', p_attempt_id, 'not_found', 'Result not found'); end if;
  v_role := coalesce(kafaa_acting_role('qual_records', array['Own']), kafaa_acting_role('training', array['Own','OwnOrg']));
  select * into f from kafaa_assessment_forms where id = at.form_id;
  if at.status <> 'released' then return kafaa_refuse('appeal.file', 'appeals', p_attempt_id, 'invalid', 'You can appeal once the result is released', v_role); end if;
  v_close := coalesce(at.released_at, at.submitted_at, now()) + make_interval(days => f.appeal_days);
  if now() > v_close then return kafaa_refuse('appeal.file', 'appeals', p_attempt_id, 'invalid', 'The appeal window closed on ' || to_char(v_close at time zone 'UTC', 'YYYY-MM-DD'), v_role); end if;
  if exists (select 1 from kafaa_appeals where attempt_id = p_attempt_id and status = 'open') then return kafaa_refuse('appeal.file', 'appeals', p_attempt_id, 'conflict', 'An appeal on this result is already open', v_role); end if;
  if length(trim(coalesce(p_reason, ''))) < 10 then return kafaa_refuse('appeal.file', 'appeals', p_attempt_id, 'invalid', 'Explain the appeal in at least 10 characters', v_role); end if;
  if nullif(p_item_id, '') is not null and not (p_item_id = any(f.item_ids)) then return kafaa_refuse('appeal.file', 'appeals', p_attempt_id, 'invalid', 'That question is not on this exam', v_role); end if;
  v_id := 'ap-' || replace(gen_random_uuid()::text, '-', '');
  insert into kafaa_appeals (id, attempt_id, person_id, reason, status, item_id, created_at) values (v_id, p_attempt_id, me, trim(p_reason), 'open', nullif(p_item_id, ''), now());
  a := kafaa_audit('appeal.file', 'appeals', v_id, 'ok', 'appeal on ' || p_attempt_id, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Appeal filed; the training manager decides it', a, null, jsonb_build_object('id', v_id));
end $$;

create or replace function kafaa_decide_appeal(p_id text, p_decision text, p_note text, p_void_item_ids text[] default '{}') returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); ap kafaa_appeals; at kafaa_attempts; f kafaa_assessment_forms; v_voided text[]; v_score numeric; v_passed boolean; v_n integer; v_c integer;
  a kafaa_audit_events; l integer; v_role text := kafaa_acting_role('secure_items', array['A']);
begin
  if v_role is null or me is null then return kafaa_refuse('appeal.decide', 'appeals', p_id, 'forbidden', 'Only the training manager decides appeals'); end if;
  select * into ap from kafaa_appeals where id = p_id;
  if ap.id is null then return kafaa_refuse('appeal.decide', 'appeals', p_id, 'not_found', 'Appeal not found', v_role); end if;
  if ap.status <> 'open' then return kafaa_refuse('appeal.decide', 'appeals', p_id, 'invalid', 'This appeal is already decided', v_role); end if;
  if ap.person_id = me then return kafaa_refuse('appeal.decide', 'appeals', p_id, 'maker_checker', 'You cannot decide your own appeal', v_role); end if;
  select * into at from kafaa_attempts where id = ap.attempt_id;
  if at.released_by = me then return kafaa_refuse('appeal.decide', 'appeals', p_id, 'separation_of_duties', 'The evaluator who released the result cannot decide its appeal', v_role); end if;
  if p_decision not in ('upheld', 'rejected') then return kafaa_refuse('appeal.decide', 'appeals', p_id, 'invalid', 'Unknown decision', v_role); end if;
  if length(trim(coalesce(p_note, ''))) < 5 then return kafaa_refuse('appeal.decide', 'appeals', p_id, 'invalid', 'Record the reason for the decision', v_role); end if;
  v_score := at.score; v_passed := at.passed; v_voided := at.voided_item_ids;
  if p_decision = 'upheld' then
    select * into f from kafaa_assessment_forms where id = at.form_id;
    select coalesce(array_agg(distinct x), '{}') into v_voided from unnest(coalesce(at.voided_item_ids, '{}') || coalesce((select array_agg(v) from unnest(coalesce(p_void_item_ids, '{}')) v where v = any(f.item_ids)), '{}')) x;
    select count(*), count(*) filter (where correct) into v_n, v_c from kafaa_responses where attempt_id = at.id and not (item_id = any(v_voided));
    if v_n > 0 then v_score := round(v_c * 100.0 / v_n); v_passed := v_score >= f.pass_mark; end if;
    update kafaa_attempts set voided_item_ids = v_voided, score = v_score, passed = v_passed, counts = coalesce(v_passed, false) where id = at.id;
  end if;
  update kafaa_appeals set status = p_decision, decided_by = me, decided_at = now(), decision_note = p_note where id = p_id;
  l := kafaa_ledger('kafaa.assessment.appeal', format('Appeal %s on %s: %s', p_id, at.id, p_decision));
  a := kafaa_audit('appeal.decide', 'appeals', p_id, 'ok', format('%s; %s item(s) voided', p_decision, case when p_decision = 'upheld' then coalesce(array_length(v_voided, 1), 0) else 0 end), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when p_decision = 'upheld' then 'Appeal upheld' else 'Appeal rejected' end, a, l, jsonb_build_object('score', v_score, 'passed', v_passed));
end $$;

-- ───────────── 7. Grants: signed-in users only; helpers are internal
revoke execute on function
  kafaa_enrolments_guard(), kafaa_g2_guard_decisions(), kafaa_g2_in_scope(text), kafaa_g2_taken(text), kafaa_g2_next_cert(integer), kafaa_g2_retake(text, text, timestamptz, text), kafaa_g2_retake_message(text, text),
  kafaa_enrol_course(text, text, text), kafaa_session_availability(text), kafaa_decide_enrolment(text, text, text), kafaa_cancel_enrolment(text, text), kafaa_record_attendance(text, jsonb),
  kafaa_complete_enrolment(text, text, numeric, text), kafaa_decide_external_request(text, text, text), kafaa_curriculum_sync(text), kafaa_decide_dev_plan(text, text, text),
  kafaa_respond_mentoring(text, text), kafaa_item_review(text, text), kafaa_save_item(jsonb), kafaa_retire_item(text, text), kafaa_schedule_attempt(text, text, timestamptz, text),
  kafaa_start_attempt(text), kafaa_submit_attempt(text, jsonb), kafaa_release_attempt(text, text), kafaa_record_performance(text, text, boolean, numeric, text),
  kafaa_attempt_feedback(text), kafaa_file_appeal(text, text, text), kafaa_decide_appeal(text, text, text, text[])
from public, anon;
grant execute on function
  kafaa_enrol_course(text, text, text), kafaa_session_availability(text), kafaa_decide_enrolment(text, text, text), kafaa_cancel_enrolment(text, text), kafaa_record_attendance(text, jsonb),
  kafaa_complete_enrolment(text, text, numeric, text), kafaa_decide_external_request(text, text, text), kafaa_curriculum_sync(text), kafaa_decide_dev_plan(text, text, text),
  kafaa_respond_mentoring(text, text), kafaa_item_review(text, text), kafaa_save_item(jsonb), kafaa_retire_item(text, text), kafaa_schedule_attempt(text, text, timestamptz, text),
  kafaa_start_attempt(text), kafaa_submit_attempt(text, jsonb), kafaa_release_attempt(text, text), kafaa_record_performance(text, text, boolean, numeric, text),
  kafaa_attempt_feedback(text), kafaa_file_appeal(text, text, text), kafaa_decide_appeal(text, text, text, text[])
to authenticated;
-- Internal helpers and trigger functions are not callable by signed-in users either (the RPCs and triggers run them as the owner).
revoke execute on function kafaa_g2_in_scope(text), kafaa_g2_taken(text), kafaa_g2_next_cert(integer), kafaa_g2_retake(text, text, timestamptz, text), kafaa_g2_retake_message(text, text),
  kafaa_enrolments_guard(), kafaa_g2_guard_decisions() from authenticated;
