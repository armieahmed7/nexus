-- [Audit2 2026-10-13 · findings 8, 9, 20] Row-write rules on people and scholars, one duplicate policy, two helper search paths.
--
-- 8. kafaa_people: signed-in users held table-level INSERT and UPDATE, and the policy's OrgW branch lets a partner admin write the people
--    of its own organisation, so a partner admin could set persona_id (bind a NEXUS persona with no Kafa'a row to one of its people),
--    status or org_id. Those three columns are identity and lifecycle, not profile: authenticated now gets column-level UPDATE on every
--    other column (id excluded too) and column-level INSERT on every column but persona_id. Persona binding, leavers and organisation
--    moves stay with the SECURITY DEFINER RPCs and migrations, which the app already uses (the client never writes these columns; the
--    profile page edits language, digits and similar fields only). The policies are unchanged. The column lists are derived from the
--    table at apply time, so a column added later must be granted explicitly.
-- 9. kafaa_scholars: the insert/update policies had a self branch (person_id = kafaa_me() with cohorts Own/Scope), so an applicant could
--    create or edit their own scholar record, and kafaa_apply_grant accepts status 'in_study' there as grant eligibility. The self
--    branch is removed: only cohorts W/A (HR) and SECURITY DEFINER RPCs write scholar records (src/data/schema.ts scholars: no `own`).
-- 20. kafaa_scholar_cohorts had a second permissive SELECT policy for authenticated (kafaa_g3_read_university) whose rule is already
--    one branch of kafaa_read (partner_org on university_org_id): it is dropped, so one policy is evaluated per row with the same access.
--    kafaa_mnt_trim(text) and kafaa_mnt_ratings(jsonb) get search_path = public (security advisor function_search_path_mutable).
-- kafaa_* objects only; idempotent.

-- 8. people: column-level writes for signed-in users
revoke insert, update on kafaa_people from authenticated;
do $$
declare v_ins text; v_upd text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_ins
    from information_schema.columns where table_schema = 'public' and table_name = 'kafaa_people' and column_name not in ('persona_id');
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_upd
    from information_schema.columns where table_schema = 'public' and table_name = 'kafaa_people' and column_name not in ('id', 'persona_id', 'status', 'org_id');
  execute format('grant insert (%s) on kafaa_people to authenticated', v_ins);
  execute format('grant update (%s) on kafaa_people to authenticated', v_upd);
end $$;

-- 9. scholars: HR (cohorts W/A) only
alter policy kafaa_insert on kafaa_scholars with check ((select kafaa_has_grant('cohorts'::text, array['W'::text, 'A'::text])));
alter policy kafaa_update on kafaa_scholars using ((select kafaa_has_grant('cohorts'::text, array['W'::text, 'A'::text])))
  with check ((select kafaa_has_grant('cohorts'::text, array['W'::text, 'A'::text])));

-- 20. one SELECT policy on scholar cohorts; fixed search paths
drop policy if exists kafaa_g3_read_university on kafaa_scholar_cohorts;
alter function kafaa_mnt_trim(text) set search_path = public;
alter function kafaa_mnt_ratings(jsonb) set search_path = public;
