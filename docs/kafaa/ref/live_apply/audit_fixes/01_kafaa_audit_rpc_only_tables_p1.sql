-- kafaa_audit_rpc_only_tables_p1 (1/1) · from supabase/migrations/20261012151001_kafaa_audit_rpc_only_tables.sql (audit 2026-10-12 fixes, branch audit-fixes)
-- Apply with apply_migration name "kafaa_audit_rpc_only_tables_p1", in ORDER.txt order. Idempotent; a second run changes nothing. See EXPECTED.md.
-- [Audit 2026-10-12 · fix b] RPC-only tables: remove the stale direct-write policies and row audit triggers that live still carries.
-- G2 (commit cf684d7, 2026-10-08) moved these ten tables to RPC writes: every RPC writes its own audit row, and the regenerated
-- 20261008120300_kafaa_rls.sql no longer creates kafaa_insert / kafaa_update policies or a <table>_audit trigger on them. Live was built
-- from the earlier rls.sql, so it still has both: the policies are inert today (no client INSERT/UPDATE grant is intended), but the audit
-- triggers fire on every RPC write, so for example each Dalil turn writes extra hash-chained audit rows that a build from main does not.
-- kafaa_applications_audit and kafaa_research_proposals_audit are already disabled live (20261008133001_kafaa_g3_rpcs.sql).
-- Guarded with "if exists": on a fresh build (and in PGlite) none of these objects exist and every statement is a no-op.
-- Must run before 20261012152001_kafaa_audit_grants.sql, which revokes client INSERT/UPDATE wherever no write policy remains.
-- kafaa_* objects only; kafaa_read policies, grants and the other triggers on these tables (kafaa_cp_on_equivalency_requests) are kept.
do $$
declare t text;
begin
  foreach t in array array['kafaa_advisor_sessions', 'kafaa_advisor_turns', 'kafaa_appeals', 'kafaa_applications', 'kafaa_equivalency_requests',
                           'kafaa_icv_plans', 'kafaa_item_versions', 'kafaa_items', 'kafaa_partner_onboarding', 'kafaa_research_proposals']::text[] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
    execute format('drop policy if exists kafaa_insert on public.%I', t);
    execute format('drop policy if exists kafaa_update on public.%I', t);
  end loop;
end $$;
