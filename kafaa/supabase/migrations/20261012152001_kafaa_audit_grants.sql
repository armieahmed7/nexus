-- [Audit 2026-10-12 · fix a] Table privileges of the API roles (anon, authenticated) on Kafa'a tables: defence in depth.
-- Live inherited Supabase's default privileges (`grant all on tables to anon, authenticated`), so the API roles hold TRUNCATE, REFERENCES,
-- TRIGGER and MAINTAIN on most kafaa_* tables, and INSERT / UPDATE / DELETE on Kafa'a tables the repo grants SELECT only. RLS keeps the extra
-- INSERT/UPDATE/DELETE inert (no policy admits them) but does not govern TRUNCATE, and nothing in the app needs any of these.
-- service_role and the table owner keep everything; SECURITY DEFINER RPCs (which run as the owner) are not affected.
-- Scope: kafaa_* tables only. ENEC NEXUS objects share the public schema and are not changed (handover rule): no NEXUS table grant and no
-- default privileges are touched, so NEXUS tables, including ones it creates later, keep whatever NEXUS gives them. New kafaa_* tables are
-- covered by the repo's migration validator (write grants must match the policies) and by re-running this file, which derives its revokes
-- at apply time.
--   1. revoke TRUNCATE, REFERENCES, TRIGGER (and MAINTAIN on PostgreSQL 17+) from anon and authenticated. PostgREST has no verb that uses them.
--   2. derived from the repo's grants (a PGlite build of every migration, which has no Supabase defaults):
--      - DELETE: the repo never grants it on a Kafa'a table and there is no DELETE policy -> revoked everywhere.
--      - anon: SELECT only, plus INSERT on kafaa_contact_requests (the public contact form) -> other INSERT/UPDATE revoked.
--      - authenticated: INSERT / UPDATE exactly where an INSERT / UPDATE policy admits it (the repo's 67 + 1 tables); revoked elsewhere.
--        This is the repo's own rule (rls.sql grants select, insert, update with each kafaa_insert/kafaa_update pair).
--      Proof that a fresh build is unchanged by this file: PGlite privileges before and after it are identical (see the live-apply bundle
--      docs/kafaa/ref/live_apply/audit_fixes/EXPECTED.md).
-- Runs after 20261012151001_kafaa_audit_rpc_only_tables.sql (which removes the stale write policies of the ten RPC-only tables).
-- kafaa_contact_requests UPDATE for staff is narrowed to the status column in 20261012154001_kafaa_audit_contact_requests.sql.
-- Idempotent: revokes only; a second run changes nothing.
do $$
declare
  v_extra text := case when current_setting('server_version_num')::int >= 170000 then ', maintain' else '' end;
  r record;
  has_pol boolean;
begin
  for r in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relname like 'kafaa\_%' order by 1 loop
    -- 1. privileges no API role needs
    execute format('revoke truncate, references, trigger%s on public.%I from anon, authenticated', v_extra, r.relname);
    -- 2. writes
    execute format('revoke delete on public.%I from anon, authenticated', r.relname);
    if r.relname = 'kafaa_contact_requests' then
      execute format('revoke update on public.%I from anon', r.relname);
    else
      execute format('revoke insert, update on public.%I from anon', r.relname);
    end if;
    select exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = r.relname and p.cmd in ('INSERT', 'ALL')
                    and (p.roles && array['authenticated', 'public']::name[])) into has_pol;
    if not has_pol then execute format('revoke insert on public.%I from authenticated', r.relname); end if;
    select exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = r.relname and p.cmd in ('UPDATE', 'ALL')
                    and (p.roles && array['authenticated', 'public']::name[])) into has_pol;
    if not has_pol then execute format('revoke update on public.%I from authenticated', r.relname); end if;
  end loop;
end $$;
