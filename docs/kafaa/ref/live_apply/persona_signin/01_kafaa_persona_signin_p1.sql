-- kafaa_persona_signin_p1 (1/1) · from kafaa/supabase/migrations/20261012161001_kafaa_persona_signin.sql
-- Apply with apply_migration name "kafaa_persona_signin_p1". Idempotent (create or replace + revoke on two new helpers); kafaa_* functions only.
-- No table, row, NEXUS object, auth user or default privilege is changed. See EXPECTED.md in this folder.
-- [Persona sign-in 2026-10-12] The 14 Kafa'a-only demo personas (persona ids k-*) sign in for real on the live site.
-- Before: kafaa_me() resolved the caller only through the NEXUS profile of the JWT (nexus_my_persona(), public.profiles), and only the
-- 43 NEXUS demo accounts have a profile, so a Kafa'a-only persona could sign in nowhere but the in-browser local demo.
-- Now: the Edge Function kafaa-persona-signin (kafaa/supabase/functions/kafaa-persona-signin) keeps one Supabase Auth user per Kafa'a
-- persona (<persona>@personas.kafaa.demo) and stamps app_metadata.kafaa_persona on it. app_metadata is writable by the service role only
-- (a user cannot change it with updateUser), and it is carried in the JWT, so the database can trust it. kafaa_me() and kafaa_whoami()
-- now resolve the caller's persona as: the NEXUS profile first (unchanged for every NEXUS account), else that claim.
-- The claim is accepted only for role 'authenticated' and only for a k-* persona id, so it can never name a NEXUS persona; kafaa_me()
-- still requires a kafaa_people row with that persona_id (the 14 rows and their role assignments are already live).
-- Scope: Kafa'a functions only. No NEXUS object, NEXUS auth user, profile row or default privilege is touched; NEXUS's own functions
-- (nexus_my_persona, nexus_uid, ...) and kafaa_ledger (which still needs a NEXUS profile, so these personas add no NEXUS ledger rows)
-- are unchanged. Idempotent: create or replace keeps the existing grants of kafaa_me / kafaa_whoami.

-- The Kafa'a persona named by the caller's JWT app_metadata (set only by the kafaa-persona-signin function), or null.
create or replace function kafaa_jwt_persona() returns text language plpgsql stable set search_path = public as $$
declare c jsonb; v text;
begin
  begin
    c := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  exception when others then c := null;
  end;
  if c is null or coalesce(c ->> 'role', '') <> 'authenticated' then return null; end if;
  v := c -> 'app_metadata' ->> 'kafaa_persona';
  if v is null or v !~ '^k-[a-z0-9-]{1,40}$' then return null; end if;
  return v;
end $$;

-- The caller's persona: the NEXUS profile wins; a Kafa'a persona account falls back to its app_metadata claim.
create or replace function kafaa_my_persona() returns text language sql stable security definer set search_path = public as $$
  select coalesce(nexus_my_persona(), kafaa_jwt_persona())
$$;

-- The caller's Kafa'a person id (people.persona_id = the caller's persona), or null for anonymous.
create or replace function kafaa_me() returns text language sql stable security definer set search_path = public as $$
  select p.id from kafaa_people p where p.persona_id = kafaa_my_persona() and p.status <> 'leaver' limit 1
$$;

create or replace function kafaa_whoami() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('persona_id', kafaa_my_persona(), 'person_id', kafaa_me(), 'org_id', kafaa_my_org(), 'roles', to_jsonb(kafaa_my_roles()),
    'assignments', coalesce((select jsonb_agg(jsonb_build_object('role', ra.role, 'scope_type', ra.scope_type, 'scope_value', ra.scope_value, 'status', ra.status))
                             from kafaa_role_assignments ra where ra.person_id = kafaa_me()), '[]'::jsonb))
$$;

-- Internal helpers: only ever called from the SECURITY DEFINER functions above (which run as the owner).
revoke execute on function kafaa_jwt_persona() from public, anon, authenticated;
revoke execute on function kafaa_my_persona() from public, anon, authenticated;
