# Audit fixes (2026-10-12) live-apply bundle: what each part does and what to compare afterwards

Built by hand from branch `audit-fixes` (2026-10-12) for the live Supabase project `hlirqxoddysxtdezwcgv`. **Nothing here has been applied.**
The wave generator (`kafaa/scripts/live-apply-bundle.mjs`) is not used because these fixes must revoke, drop and add a delete guard, which that
generator refuses by design ("no removal words"). Each part is one migration file of `kafaa/supabase/migrations/`, copied verbatim after a
two-line header; all are under 10 KB. Apply **in ORDER.txt order** with the Supabase `apply_migration` tool (name = file name without the number
prefix and `.sql`), run the checks below, and merge `audit-fixes` only after they pass: the front-end commit relies on part 05 for the
rate-limit message and on part 04 for the admin inbox's status update on a fresh build.

Every part is idempotent (a second run changes nothing) and touches `kafaa_*` objects only, except part 02 step 1, which revokes TRUNCATE,
REFERENCES, TRIGGER and MAINTAIN from `anon` and `authenticated` on **every** public table (NEXUS tables included) and in `postgres`'s default
privileges. No row is inserted, updated or deleted by any part.

## 0. Before you start (all read-only)

1. Live is PostgreSQL 17 (`select current_setting('server_version_num')` = 170006 on 2026-10-12), so part 02 includes MAINTAIN.
2. All public tables are owned by `postgres` and `apply_migration` runs as `postgres` (checked 2026-10-12).
3. The 22 foreign keys of part 03 validate when added: the orphan check below must return **no rows** (2026-10-12: 0 orphans for all 22).
   If it returns rows, stop: part 03 would fail as a whole (nothing partial is left).
4. `kafaa_verify_certificate(text)` must still be the original body: `md5(prosrc) = 539ef25763d8cbe1fb9528a1525da32e`, language `sql`, stable.
5. `kafaa_contact_requests` policy `kafaa_insert` still has `with_check = 'true'`.
6. If waves H or I were applied live after this bundle was built, apply this bundle anyway: part 02 derives its revokes at apply time, so new
   kafaa_* tables are handled; re-running part 02 later (after any future wave) is safe and brings new tables to the same rule.

```sql
-- 3. orphan check (expect no rows)
select * from (
  select 'kafaa_klra_positions_person_id_fk' fk, count(*) orphans from kafaa_klra_positions x where x.person_id is not null and not exists (select 1 from kafaa_people r where r.id = x.person_id)
  union all
  select 'kafaa_klra_positions_role_id_fk' fk, count(*) orphans from kafaa_klra_positions x where x.role_id is not null and not exists (select 1 from kafaa_job_roles r where r.id = x.role_id)
  union all
  select 'kafaa_klra_positions_family_id_fk' fk, count(*) orphans from kafaa_klra_positions x where x.family_id is not null and not exists (select 1 from kafaa_job_families r where r.id = x.family_id)
  union all
  select 'kafaa_klra_assessments_position_id_fk' fk, count(*) orphans from kafaa_klra_assessments x where x.position_id is not null and not exists (select 1 from kafaa_klra_positions r where r.id = x.position_id)
  union all
  select 'kafaa_klra_assessments_person_id_fk' fk, count(*) orphans from kafaa_klra_assessments x where x.person_id is not null and not exists (select 1 from kafaa_people r where r.id = x.person_id)
  union all
  select 'kafaa_klra_assessments_assessed_by_fk' fk, count(*) orphans from kafaa_klra_assessments x where x.assessed_by is not null and not exists (select 1 from kafaa_people r where r.id = x.assessed_by)
  union all
  select 'kafaa_klra_actions_assessment_id_fk' fk, count(*) orphans from kafaa_klra_actions x where x.assessment_id is not null and not exists (select 1 from kafaa_klra_assessments r where r.id = x.assessment_id)
  union all
  select 'kafaa_klra_actions_position_id_fk' fk, count(*) orphans from kafaa_klra_actions x where x.position_id is not null and not exists (select 1 from kafaa_klra_positions r where r.id = x.position_id)
  union all
  select 'kafaa_klra_actions_person_id_fk' fk, count(*) orphans from kafaa_klra_actions x where x.person_id is not null and not exists (select 1 from kafaa_people r where r.id = x.person_id)
  union all
  select 'kafaa_klra_actions_created_by_fk' fk, count(*) orphans from kafaa_klra_actions x where x.created_by is not null and not exists (select 1 from kafaa_people r where r.id = x.created_by)
  union all
  select 'kafaa_sme_profiles_person_id_fk' fk, count(*) orphans from kafaa_sme_profiles x where x.person_id is not null and not exists (select 1 from kafaa_people r where r.id = x.person_id)
  union all
  select 'kafaa_capture_sessions_sme_id_fk' fk, count(*) orphans from kafaa_capture_sessions x where x.sme_id is not null and not exists (select 1 from kafaa_people r where r.id = x.sme_id)
  union all
  select 'kafaa_capture_sessions_interviewer_id_fk' fk, count(*) orphans from kafaa_capture_sessions x where x.interviewer_id is not null and not exists (select 1 from kafaa_people r where r.id = x.interviewer_id)
  union all
  select 'kafaa_capture_sessions_created_by_fk' fk, count(*) orphans from kafaa_capture_sessions x where x.created_by is not null and not exists (select 1 from kafaa_people r where r.id = x.created_by)
  union all
  select 'kafaa_capture_sessions_position_id_fk' fk, count(*) orphans from kafaa_capture_sessions x where x.position_id is not null and not exists (select 1 from kafaa_klra_positions r where r.id = x.position_id)
  union all
  select 'kafaa_knowledge_assets_author_id_fk' fk, count(*) orphans from kafaa_knowledge_assets x where x.author_id is not null and not exists (select 1 from kafaa_people r where r.id = x.author_id)
  union all
  select 'kafaa_knowledge_assets_sme_id_fk' fk, count(*) orphans from kafaa_knowledge_assets x where x.sme_id is not null and not exists (select 1 from kafaa_people r where r.id = x.sme_id)
  union all
  select 'kafaa_asset_reviews_asset_id_fk' fk, count(*) orphans from kafaa_asset_reviews x where x.asset_id is not null and not exists (select 1 from kafaa_knowledge_assets r where r.id = x.asset_id)
  union all
  select 'kafaa_asset_reviews_asset_author_id_fk' fk, count(*) orphans from kafaa_asset_reviews x where x.asset_author_id is not null and not exists (select 1 from kafaa_people r where r.id = x.asset_author_id)
  union all
  select 'kafaa_asset_reviews_reviewer_id_fk' fk, count(*) orphans from kafaa_asset_reviews x where x.reviewer_id is not null and not exists (select 1 from kafaa_people r where r.id = x.reviewer_id)
  union all
  select 'kafaa_asset_uses_asset_id_fk' fk, count(*) orphans from kafaa_asset_uses x where x.asset_id is not null and not exists (select 1 from kafaa_knowledge_assets r where r.id = x.asset_id)
  union all
  select 'kafaa_asset_uses_person_id_fk' fk, count(*) orphans from kafaa_asset_uses x where x.person_id is not null and not exists (select 1 from kafaa_people r where r.id = x.person_id)
) s where orphans > 0;

-- 4 and 5
select p.proname, md5(p.prosrc), l.lanname, p.provolatile from pg_proc p join pg_language l on l.oid = p.prolang where p.proname = 'kafaa_verify_certificate';
select with_check from pg_policies where tablename = 'kafaa_contact_requests' and policyname = 'kafaa_insert';
```

## 1. Parts, in order

| # | apply_migration name | from | what it does |
|---|---|---|---|
| 1 | `kafaa_audit_rpc_only_tables_p1` | `20261012151001_kafaa_audit_rpc_only_tables.sql` | drops (if exists) policy `kafaa_insert`, policy `kafaa_update` and trigger `kafaa_<t>_audit` on the ten RPC-only tables: advisor_sessions, advisor_turns, appeals, applications, equivalency_requests, icv_plans, item_versions, items, partner_onboarding, research_proposals (main's rls.sql no longer creates them; `kafaa_read` and `kafaa_cp_on_equivalency_requests` are kept) |
| 2 | `kafaa_audit_grants_p1` | `20261012152001_kafaa_audit_grants.sql` | revokes TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on all public tables from anon/authenticated and in postgres's default privileges for tables; on kafaa_* tables revokes DELETE (both roles), anon INSERT/UPDATE (except INSERT on kafaa_contact_requests), and authenticated INSERT/UPDATE wherever no INSERT/UPDATE policy admits authenticated. Must follow part 1 |
| 3 | `kafaa_audit_integrity_p1` | `20261012153001_kafaa_audit_integrity.sql` | adds the 22 W3E2 foreign keys (`kafaa_<table>_<column>_fk`, deferrable initially deferred, guarded by name), indexes `kafaa_career_targets_role_id_idx`, `kafaa_roadmaps_target_role_id_idx`, `kafaa_health_snapshots_role_id_idx` (if not exists), and trigger `kafaa_xapi_statements_no_delete` (BEFORE DELETE, `kafaa_append_only()`) when no BEFORE DELETE append-only trigger exists |
| 4 | `kafaa_audit_contact_requests_p1` | `20261012154001_kafaa_audit_contact_requests.sql` | `alter policy kafaa_insert on kafaa_contact_requests` with the bounded check below; revokes table-level UPDATE from anon/authenticated and grants `update (status)` to authenticated |
| 5 | `kafaa_audit_verify_certificate_p1` | `20261012155001_kafaa_audit_verify_certificate.sql` | `create or replace function kafaa_verify_certificate(text)` as plpgsql volatile with the kafaa_verify_badge rate-limit block (20 checks per number / 600 in total per minute, counted from `certificate.verify` audit rows); revokes PUBLIC execute, grants anon and authenticated |

Effects to expect on live data: none at apply time. Afterwards (a) Dalil turns, appeals, item reviews and the other RPCs on the ten tables stop
writing the extra trigger-made `insert:/update:kafaa_<t>` audit rows (the RPCs' own audit rows are unchanged; a build from main never had the
extra rows); (b) every certificate check writes one `certificate.verify` audit row (as badge checks already do).

## 2. Function bodies after the apply (`md5(prosrc)`, local PGlite)

| function | md5 before (live 2026-10-12) | md5 after |
|---|---|---|
| `kafaa_verify_certificate(p_no text)` | `539ef25763d8cbe1fb9528a1525da32e` (sql, stable) | `417ff37db0b2aa58f948149bebe2931f` (plpgsql, volatile, security definer) |

```sql
select p.proname, pg_get_function_identity_arguments(p.oid), md5(p.prosrc), p.provolatile, p.prosecdef, p.proacl
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'kafaa_verify_certificate';
-- expect 417ff37db0b2aa58f948149bebe2931f, 'v', true, and an ACL with anon and authenticated execute and no PUBLIC (=X) entry
```

No other function is created or changed.

## 3. Policies and triggers after the apply

```sql
-- a. the ten RPC-only tables: expect 0 rows from both
select tablename, policyname from pg_policies where schemaname = 'public' and policyname in ('kafaa_insert', 'kafaa_update')
   and tablename in ('kafaa_advisor_sessions','kafaa_advisor_turns','kafaa_appeals','kafaa_applications','kafaa_equivalency_requests',
                     'kafaa_icv_plans','kafaa_item_versions','kafaa_items','kafaa_partner_onboarding','kafaa_research_proposals');
select tgname from pg_trigger where tgname in ('kafaa_advisor_sessions_audit','kafaa_advisor_turns_audit','kafaa_appeals_audit','kafaa_applications_audit',
   'kafaa_equivalency_requests_audit','kafaa_icv_plans_audit','kafaa_item_versions_audit','kafaa_items_audit','kafaa_partner_onboarding_audit','kafaa_research_proposals_audit');
-- b. write policies left on kafaa_* tables: expect 68 tables with INSERT and 68 with UPDATE (before: 78 / 78), none for DELETE or ALL
select cmd, count(distinct tablename) from pg_policies where schemaname = 'public' and tablename like 'kafaa\_%' and cmd <> 'SELECT' group by 1;
-- c. integrity: expect 22, 3, and one row kafaa_xapi_statements_no_delete with tgtype 11 (row, before, delete)
select count(*) from pg_constraint where contype = 'f' and conname like any (array['kafaa_asset_reviews_%_fk','kafaa_asset_uses_%_fk','kafaa_capture_sessions_%_fk',
   'kafaa_klra_actions_%_fk','kafaa_klra_assessments_%_fk','kafaa_klra_positions_%_fk','kafaa_knowledge_assets_%_fk','kafaa_sme_profiles_%_fk']);
select count(*) from pg_indexes where indexname in ('kafaa_career_targets_role_id_idx','kafaa_roadmaps_target_role_id_idx','kafaa_health_snapshots_role_id_idx');
select tgname, tgtype from pg_trigger where tgrelid = 'kafaa_xapi_statements'::regclass and not tgisinternal order by 1;
-- d. contact form insert check
select with_check from pg_policies where tablename = 'kafaa_contact_requests' and policyname = 'kafaa_insert';
```

Expected `with_check` for (d), as PostgreSQL 16 (PGlite) prints it; PostgreSQL 17 should print the same text:

```
((status = ANY (ARRAY['new'::text, 'routed'::text])) AND (route_to =
CASE topic
    WHEN 'careers'::text THEN 'Careers team (role mailbox)'::text
    WHEN 'programmes'::text THEN 'Talent programmes team (role mailbox)'::text
    WHEN 'suppliers'::text THEN 'Supplier development (role mailbox)'::text
    WHEN 'universities'::text THEN 'University partnerships (role mailbox)'::text
    WHEN 'media'::text THEN 'Media relations (role mailbox)'::text
    WHEN 'accessibility'::text THEN 'Digital accessibility (role mailbox)'::text
    WHEN 'other'::text THEN 'General enquiries (role mailbox)'::text
    ELSE NULL::text
END) AND (length(id) <= 64) AND ((length(message) >= 1) AND (length(message) <= 4000)) AND (COALESCE(length(name), 0) <= 200) AND (COALESCE(length(email), 0) <= 320) AND ((retention_until IS NULL) OR (retention_until <= (CURRENT_DATE + 400))))
```

## 4. Grants after the apply

On a build from main (PGlite, 344 kafaa_* tables incl. waves E-G) the privileges after all five migrations are:

| role | SELECT | INSERT | UPDATE (table) | DELETE | TRUNCATE / REFERENCES / TRIGGER / MAINTAIN |
|---|---|---|---|---|---|
| anon | 344 | 1 (`kafaa_contact_requests`) | 0 | 0 | 0 (on every public table) |
| authenticated | 344 | 68 (the tables with a kafaa_insert policy, incl. contact_requests) | 67 (the tables with a kafaa_update policy, minus contact_requests) | 0 | 0 (on every public table) |

plus column UPDATE on `kafaa_contact_requests.status` for authenticated. Live must give the same numbers if it holds exactly these 344 kafaa_*
tables (more if wave H/I tables exist: then compare against the policy rule, query 4b). Live on 2026-10-12 before the apply: anon INSERT 100,
UPDATE 100, DELETE 200 on kafaa_* tables (repo intent: 1 / 0 / 0); TRUNCATE on 334 public tables for anon and 338 for authenticated.

```sql
-- 4a. counts per role and privilege on kafaa_* tables
select r.rolname, x.p, count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
  cross join (values ('anon'), ('authenticated')) r(rolname) cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) x(p)
 where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relname like 'kafaa\_%' and has_table_privilege(r.rolname, c.oid, x.p) group by 1, 2 order by 1, 2;
-- 4b. authenticated INSERT/UPDATE exactly where a policy admits it: expect 0 rows
select c.relname, x.cmd from pg_class c join pg_namespace n on n.oid = c.relnamespace cross join (values ('INSERT'), ('UPDATE')) x(cmd)
 where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relname like 'kafaa\_%' and c.relname <> 'kafaa_contact_requests'
   and has_table_privilege('authenticated', c.oid, x.cmd) <> exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname
         and p.cmd in (x.cmd, 'ALL') and p.roles && array['authenticated', 'public']::name[]);
-- 4c. no API role holds TRUNCATE/REFERENCES/TRIGGER/MAINTAIN on any public table: expect 0
select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace cross join (values ('anon'), ('authenticated')) r(rolname)
 where n.nspname = 'public' and c.relkind in ('r', 'p') and (has_table_privilege(r.rolname, c.oid, 'TRUNCATE') or has_table_privilege(r.rolname, c.oid, 'REFERENCES')
       or has_table_privilege(r.rolname, c.oid, 'TRIGGER') or has_table_privilege(r.rolname, c.oid, 'MAINTAIN'));
-- 4d. default privileges of postgres for new tables: anon and authenticated show arwd (no D, x, t, m)
select defaclacl from pg_default_acl d join pg_namespace n on n.oid = d.defaclnamespace where n.nspname = 'public' and d.defaclrole = 'postgres'::regrole and d.defaclobjtype = 'r';
-- 4e. contact requests: expect f, t, f
select has_table_privilege('authenticated', 'kafaa_contact_requests', 'UPDATE'), has_column_privilege('authenticated', 'kafaa_contact_requests', 'status', 'UPDATE'),
       has_column_privilege('authenticated', 'kafaa_contact_requests', 'message', 'UPDATE');
```

Not changed: service_role and the owner keep every privilege; SELECT grants; NEXUS tables' INSERT/UPDATE/DELETE grants; function EXECUTE grants
(except PUBLIC on kafaa_verify_certificate); default privileges of `supabase_admin` (postgres cannot alter them; no public table is owned by it).

## 5. Behaviour checks after the apply (optional, read-only through rollback)

```sql
-- contact form as anon: the first insert succeeds, the second fails with "new row violates row-level security policy"
begin; set local role anon;
insert into kafaa_contact_requests (id, topic, route_to, message, status, retention_until) values ('con-check-1', 'careers', 'Careers team (role mailbox)', 'Bundle check', 'routed', current_date + 180);
rollback;
begin; set local role anon;
insert into kafaa_contact_requests (id, topic, route_to, message, status) values ('con-check-2', 'careers', 'Careers team (role mailbox)', 'Bundle check', 'closed');
rollback;
-- xAPI delete as the owner fails with "kafaa_xapi_statements is append-only"
begin; delete from kafaa_xapi_statements where id = (select id from kafaa_xapi_statements limit 1); rollback;
```

Local proof: `kafaa/scripts/validate/audit-fixes.mjs` (run by `npm run migrations:validate`) and `kafaa/tests/unit/audit-fixes.test.ts`.
