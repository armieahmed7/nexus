-- kafaa_ready_scope_people_p1 (1/1) · from kafaa/supabase/migrations/20261013200001_kafaa_ready_scope_people.sql (readiness fixes 2026-10-13, branch readiness-fixes)
-- Apply with apply_migration name "kafaa_ready_scope_people_p1", in ORDER.txt order. Idempotent; a second run changes nothing; kafaa_* objects only. See EXPECTED.md.
-- [Readiness fixes 2026-10-13 · finding 3] The people a caller may read for one resource, computed once per statement.
--
-- Before: 161 SELECT policies ended in "(select kafaa_has_grant(res, Scope)) and kafaa_rule_read(res, person_id, null, false)", a SECURITY
-- DEFINER call per row that re-resolves the caller (kafaa_me -> kafaa_my_persona -> the JWT claims, inside an exception block) four or five
-- times. For a Scope holder (instructor, manager, HR) a plain read of kafaa_person_skills (3,139 rows) took 4.4 s and of kafaa_people
-- 1.2 s on an idle database; under a few concurrent testers they hit the 8 s statement timeout and starved the 3 s anonymous reads.
--
-- kafaa_scope_people(res) returns, as an array, exactly the people kafaa_rule_read(res, <person>, null, false) admits:
--   the caller when they hold Own or Scope on res, plus every kafaa_people row in the scope of one of their active Scope assignments
--   (same joins and scope types as kafaa_in_scope). The policies then test "person_id = any ((select kafaa_scope_people(res))::text[])": one
--   InitPlan per statement instead of a function call per row (20261013200002_kafaa_ready_rls_scope.sql, generated, ALTER POLICY only).
-- Executable by anon and authenticated like kafaa_rule_read (policy expressions run as the caller); it reveals no more than
-- kafaa_rule_read already answers row by row. Idempotent (create or replace). Touches no table.

create or replace function kafaa_scope_people(p_res text) returns text[] language sql stable security definer set search_path = public as $$
  with me as (select kafaa_me() as id)
  select coalesce(array_agg(distinct x.id order by x.id), '{}'::text[]) from (
    select me.id from me where me.id is not null and kafaa_has_grant(p_res, array['Own', 'Scope'])
    union all
    select t.id
      from me
      join kafaa_role_assignments ra on ra.person_id = me.id and ra.status = 'active' and (ra.expires_at is null or ra.expires_at >= current_date)
      join kafaa_policy_matrix m on m.role = ra.role and m.resource = p_res and m.level = 'Scope'
      join kafaa_people t on (
           ra.scope_type = 'all'
        or (ra.scope_type = 'entity' and t.entity_id = ra.scope_value)
        or (ra.scope_type = 'family' and t.job_family_id = ra.scope_value)
        or (ra.scope_type = 'team' and t.team_id = ra.scope_value)
        or (ra.scope_type = 'crew' and t.crew = ra.scope_value)
        or (ra.scope_type = 'org' and t.org_id = ra.scope_value))
     where kafaa_has_grant(p_res, array['Scope'])
  ) x
$$;

revoke all on function kafaa_scope_people(text) from public;
grant execute on function kafaa_scope_people(text) to anon, authenticated;
