-- Kafa'a M07 (QA fix, 2026-10-08): observer release targets for the people who prepare and approve releases.
-- Observer organisations are not public (organisations RLS), so the HR authority could not see whom to release a report
-- to: the release form offered no organisations. This read returns only id and names, only to callers holding an
-- observer_release grant, and nothing else. Additive: one new kafaa_* function.
create or replace function kafaa_release_targets() returns jsonb language sql stable security definer set search_path = public as $$
  select case when kafaa_has_grant('observer_release', array['R', 'W', 'A'])
    then coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'name_en', o.name_en, 'name_ar', o.name_ar) order by o.id)
                   from kafaa_organisations o where o.kind = 'observer_org'), '[]'::jsonb)
    else '[]'::jsonb end
$$;
revoke all on function kafaa_release_targets() from public, anon;
grant execute on function kafaa_release_targets() to authenticated;
