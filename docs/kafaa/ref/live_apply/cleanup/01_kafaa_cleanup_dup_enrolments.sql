-- kafaa_cleanup_dup_enrolments (1/4) · data clean-up 2026-10-13: close 3 duplicate open course enrolments
-- Apply with apply_migration name "kafaa_cleanup_dup_enrolments", in ORDER.txt order. kafaa_enrolments rows en-133, en-140, en-173 only.
-- Each pair is the same person + course, both open, both 0 % progress. The older row of each pair is the role-rule assignment with no
-- session ('assigned', source role_rule); the newer row is the coordinator's booking into a session ('enrolled'). The older, unscheduled
-- row is closed so the person keeps the session seat. kafaa_cancel_enrolment() needs a signed-in caller (kafaa_me()), so it cannot run
-- here; this does what its coordinator branch does for an unscheduled row (status 'cancelled', attendance/waitlisted_at cleared, reason
-- in decision_note) and frees no seat (the closed rows have no session). The kafaa_enrolments_audit row trigger records each update in
-- kafaa_audit_events. A second run changes nothing.
do $c$
declare n integer; done integer;
begin
  select count(*) into done from kafaa_enrolments where id in ('en-133', 'en-140', 'en-173') and status = 'cancelled'
    and decision_note like 'Duplicate enrolment closed in data clean-up 2026-10-13%';
  if done = 3 then raise notice 'already applied'; return; end if;
  -- guard: the 3 pairs are still open duplicates, closed row older and not more progressed than the kept row
  select count(*) into n
    from (values ('en-133', 'en-166'), ('en-140', 'en-164'), ('en-173', 'en-244')) v(close_id, keep_id)
    join kafaa_enrolments o on o.id = v.close_id
    join kafaa_enrolments k on k.id = v.keep_id
   where o.person_id = k.person_id and o.course_id = k.course_id
     and o.status = 'assigned' and o.session_id is null and o.completed_at is null and o.certificate_no is null
     and k.status in ('assigned', 'requested', 'approved', 'waitlisted', 'enrolled', 'in_progress')
     and o.enrolled_at < k.enrolled_at and o.progress_pct <= k.progress_pct;
  if n <> 3 then raise exception 'cleanup 01: expected 3 open duplicate pairs, found %', n; end if;
  update kafaa_enrolments e
     set status = 'cancelled', attendance = null, waitlisted_at = null,
         decision_note = 'Duplicate enrolment closed in data clean-up 2026-10-13 (kept ' || v.keep_id || ')'
    from (values ('en-133', 'en-166'), ('en-140', 'en-164'), ('en-173', 'en-244')) v(close_id, keep_id)
   where e.id = v.close_id and e.status = 'assigned';
  get diagnostics n = row_count;
  if n <> 3 then raise exception 'cleanup 01: expected 3 rows updated, got %', n; end if;
end $c$;
