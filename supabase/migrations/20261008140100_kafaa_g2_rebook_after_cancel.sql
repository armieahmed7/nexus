-- Kafa'a M04 (QA fix, 2026-10-08): a learner whose booked session was cancelled can book another session of the course.
-- Before, the enrolment kept pointing at the cancelled session and kafaa_enrol_course refused with "Already booked on
-- another session". Rebooking also clears the attendance mark carried over from the cancelled session. Same signature
-- and grants as 20261008132001_kafaa_g2_learning.sql; additive (create or replace of a kafaa_* function only).
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
    -- A booking on a session that was cancelled (or closed) does not block booking another one.
    if ex.session_id is not null and exists (select 1 from kafaa_sessions x where x.id = ex.session_id and x.status = 'scheduled') then return kafaa_refuse('enrolment.enrol', 'enrolments', ex.id, 'conflict', 'Already booked on another session of this course; withdraw from it first', v_role); end if;
    if p_session_id is null then return kafaa_refuse('enrolment.enrol', 'enrolments', ex.id, 'conflict', 'Already enrolled in this course', v_role); end if;
    v_status := case when kafaa_g2_taken(p_session_id) < s.capacity then 'enrolled' else 'waitlisted' end;
    update kafaa_enrolments set session_id = p_session_id, status = v_status, attendance = null, waitlisted_at = case when v_status = 'waitlisted' then now() end where id = ex.id;
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
