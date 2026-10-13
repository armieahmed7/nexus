-- kafaa_audit2_enrolment_open_unique_p1 (1/1) · from kafaa/supabase/migrations/20261013100009_kafaa_audit2_enrolment_open_unique.sql (final audit fixes 2026-10-13, branch audit2-fixes)
-- Apply with apply_migration name "kafaa_audit2_enrolment_open_unique_p1", in ORDER.txt order, LAST: it fails (raise exception, nothing changed) while duplicate open enrolments exist. Idempotent; a second run changes nothing. See EXPECTED.md.
-- [Audit2 2026-10-13 · finding 10] At most one open enrolment per person and course.
-- Three people held two open enrolments on the same course (a role-rule assignment next to a later enrolment: en-133/en-166,
-- en-140/en-164, en-173/en-244). The data clean-up of 2026-10-13 cancelled en-133, en-140 and en-173 on live (the seed does the same:
-- scripts/seed/ext/zz-audit2-integrity.mjs). Every enrol RPC already refuses or reuses an open enrolment of the same course
-- (kafaa_enrol_course, kafaa_assign_curriculum, kafaa_curriculum_sync, kafaa_enrol_supplier_course, the instructor and academy paths);
-- this partial unique index makes the rule hold for direct writes too. "Open" = the OPEN_ENROL statuses of the digest rules:
-- assigned, requested, approved, waitlisted, enrolled, in_progress.
-- Guard: the index cannot be built while duplicates exist. The block below raises an exception naming them first, so the part fails
-- as a whole and changes nothing until the duplicates are closed (it never closes them itself).
-- kafaa_* objects only; idempotent (create unique index if not exists).
do $$
declare v_dups text;
begin
  select string_agg(person_id || '/' || course_id || ': ' || ids, '; ') into v_dups from (
    select person_id, course_id, string_agg(id || ' ' || status, ', ' order by id) ids from kafaa_enrolments
     where status in ('assigned', 'requested', 'approved', 'waitlisted', 'enrolled', 'in_progress')
     group by person_id, course_id having count(*) > 1) d;
  if v_dups is not null then
    raise exception 'kafaa_enrolments has more than one open enrolment per person and course; close the duplicates first: %', v_dups;
  end if;
end $$;
create unique index if not exists kafaa_enrolments_open_person_course_uniq on kafaa_enrolments (person_id, course_id)
  where status in ('assigned', 'requested', 'approved', 'waitlisted', 'enrolled', 'in_progress');
