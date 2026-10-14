# Readiness fixes (2026-10-13) live-apply bundle: what each part does and what to compare afterwards

Built from branch `readiness-fixes` (PR "Kafa'a readiness fixes") for the live Supabase project `hlirqxoddysxtdezwcgv`. **Nothing here has
been applied.** Each part is one migration file of `kafaa/supabase/migrations/` (or a statement-boundary slice of one) copied verbatim after a
two-line header. Apply **in ORDER.txt order** with the Supabase `apply_migration` tool (name = file name without the number prefix and
`.sql`), run the checks below, and merge the PR only after they pass: the front end of the PR reads the new `*_ar` columns (part 08) and the
digest now hides items the person cannot open (part 07).

Every part is idempotent (a second run changes nothing) and touches `kafaa_*` objects only. No ENEC NEXUS object (table, grant, policy,
function) and no default privileges are changed. **No part in this folder updates or deletes a row**, no policy is dropped or created
(ALTER POLICY only) and no index is added. The one data change (Arabic values for the new columns) is an
UPDATE of existing rows, in `data_update/`, to apply only with the owner's explicit approval (section 6).

Dry run: `cd kafaa && node scripts/verify-ready-bundle.mjs origin/main` (PGlite, Supabase default privileges, every migration and the seed
of `main` at `cdc6e32`). It applies every part twice and the data part twice, compares the md5s, fingerprint and row counts below, checks
the NEXUS fingerprint is unchanged and runs the behaviour checks of `kafaa/scripts/validate/ready-fixes.mjs`. Result on 2026-10-13: all checks
passed, twice in a row.

**Lock impact.** `ALTER POLICY` (parts 02, 03) and `ADD COLUMN ... text` without a default (part 08) take a brief ACCESS EXCLUSIVE lock on
each table they touch (catalogue change only, no table rewrite); `create or replace function` locks nothing users wait on. Apply when no
long-running query holds a `kafaa_*` table (a few seconds per part; testers may see one request wait or retry).

## 0. Before you start (all read-only; live returned these numbers on 2026-10-13 ~22:05 UTC)

1. Live is PostgreSQL 17.6; all public tables are owned by `postgres`; `apply_migration` runs as `postgres`.
2. The functions this bundle replaces must still have these bodies (`md5(prosrc)`); they equal the bodies on `main`:

   | function | md5 before (live) |
   |---|---|
   | `kafaa_build_digest(p_hints jsonb)` | `67342b957d589b02bff20ebfee11c123` |
   | `kafaa_cec_stats_core()` | `3d99dcd0392fd6d466c32b4217189d0e` |
   | `kafaa_crew_availability()` | `6f384d4e66e1b097fa5d0668239ad18a` |
   | `kafaa_dg_compute(p_me text, p_today date, p_hints jsonb)` | `f5ca7a8547d4b5032d6e6b0365633172` |
   | `kafaa_sc_available(p_person text)` | `e484e06e7c68f9e7df17a131eb615614` |

   `kafaa_scope_people`, `kafaa_mirror_now`, `kafaa_route_guard`, `kafaa_route_ok_for` do not exist yet; none of the 7 `*_ar` columns exists.
3. Policies: live fingerprint (query 0c) `c78a8a370efaeba76085804b6616322b`, 508 `kafaa_*` policies, **161** of them call `kafaa_rule_read`
   per row. The dry-run model of `main` has `d17467eae9e4d630d9456c88c6f601ad` and 162: the only difference is `kafaa_rate_limits.kafaa_read`,
   which live holds in the hand-written audit2 form `( SELECT kafaa_has_grant('audit_log'::text, ARRAY['R'::text, 'W'::text, 'A'::text]) AS kafaa_has_grant)`
   (the generated RLS file of `main` still says `kafaa_rule_read('audit_log', null, null, true)`; same rule). Excluding that table, live and
   model agree policy by policy (507 policies, `md5` of `table|policy|md5(using|check)` = `faf24fbda7a757147e3feaec7ccf6e67` on both). Part 02
   sets that policy to `(SELECT kafaa_has_grant('audit_log', ...))`, the same rule, so after parts 02-03 live must show the model's "after"
   fingerprint (section 3). Any other difference means a policy was edited by hand since: stop and compare before applying parts 02-03
   (ALTER POLICY replaces the whole expression).
4. Record the NEXUS fingerprint (query 0d) before applying; it must be the same afterwards.

```sql
-- 0a. bodies
select p.proname, pg_get_function_identity_arguments(p.oid), md5(p.prosrc) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('kafaa_build_digest','kafaa_cec_stats_core','kafaa_crew_availability','kafaa_dg_compute',
   'kafaa_sc_available','kafaa_scope_people','kafaa_mirror_now','kafaa_route_guard','kafaa_route_ok_for') order by 1, 2;
-- 0b. new columns (expect 0 before, 7 after part 08)
select count(*) from information_schema.columns where table_schema = 'public' and (table_name, column_name) in (('kafaa_job_roles','regulation_ref_ar'),
  ('kafaa_career_paths','rule_ref_ar'),('kafaa_programmes','population_note_ar'),('kafaa_programmes','conflict_note_ar'),
  ('kafaa_talent_programmes','conflict_note_ar'),('kafaa_facts','conflict_note_ar'),('kafaa_vacancies','location_ar'));
-- 0c. policy fingerprint, count, per-row rule_read count
select md5(string_agg(tablename || '|' || policyname || '|' || cmd || '|' || coalesce(qual, '') || '|' || coalesce(with_check, ''), E'\n'
         order by tablename collate "C", policyname collate "C")) fingerprint, count(*) policies,
       count(*) filter (where qual like '%kafaa_rule_read(%' or with_check like '%kafaa_rule_read(%') per_row
  from pg_policies where schemaname = 'public' and tablename like 'kafaa\_%';
-- 0d. NEXUS fingerprint (non-kafaa grants, policies, functions, default privileges)
select md5(string_agg(x, '|' order by x)) from (
  select 'p:' || c.relname || ':' || r.rolname || ':' || x.p as x from pg_class c join pg_namespace s on s.oid = c.relnamespace
    cross join (values ('anon'), ('authenticated')) r(rolname) cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) x(p)
   where s.nspname = 'public' and c.relkind in ('r', 'p') and c.relname not like 'kafaa\_%' and has_table_privilege(r.rolname, c.oid, x.p)
  union all select 'pol:' || tablename || ':' || policyname || ':' || coalesce(qual, '') || ':' || coalesce(with_check, '') from pg_policies where schemaname = 'public' and tablename not like 'kafaa\_%'
  union all select 'fn:' || p.proname || ':' || md5(p.prosrc) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname not like 'kafaa\_%'
  union all select 'acl:' || coalesce(d.defaclacl::text, '') from pg_default_acl d) t;
```

## 1. Parts, in order

| # | apply_migration name | from | what it does | finding |
|---|---|---|---|---|
| 1 | `kafaa_ready_scope_people_p1` | `20261013200001_kafaa_ready_scope_people.sql` | new `kafaa_scope_people(res) returns text[]` (SECURITY DEFINER, stable): the people `kafaa_rule_read(res, person, null, false)` admits for the caller (self with Own/Scope, plus everyone in an active Scope assignment's scope). Executable by anon and authenticated (policy expressions run as the caller), like `kafaa_rule_read` | 3 |
| 2 | `kafaa_ready_rls_scope_p1` | `20261013200002_kafaa_ready_rls_scope.sql`, the first 105 `alter policy` statements | GENERATED (`scripts/gen-rls-scope.mjs`): `alter policy` on 163 `kafaa_*` policies; every per-row `kafaa_rule_read(res, person, org, where)` becomes its own logic with `person = any ((select kafaa_scope_people(res))::text[])`, one InitPlan per statement. The generator proves equivalence: the rows each of 34 test identities sees on each of the 372 tables are identical before and after | 3 |
| 3 | `kafaa_ready_rls_scope_p2` | same file, the remaining 58 statements | (continued) | 3 |
| 4 | `kafaa_ready_mirror_clock_p1` | `20261013200003_kafaa_ready_mirror_clock.sql` | new internal `kafaa_mirror_now()` = `least(now(), 2026-10-08 08:00 UTC)` (the demo mirror's as-of time, same constant as `src/domain/mirrorClock.ts`); `kafaa_crew_availability` and `kafaa_sc_available` judge the 72 h licence-sync rule at that clock, so the seeded licences stop expiring into "stale sync" with the calendar (one record, w-sro-05 synced 2 Oct, stays stale on purpose). Same signatures and grants | 1 |
| 5 | `kafaa_ready_cec_stats_p1` | `20261013200004_kafaa_ready_cec_stats.sql` | `kafaa_cec_stats_core()` set-based (one pass over the people and their skills instead of a profile call per person); same result (checked on live data in a read-only transaction: equal, `md5` of the result `3d822aeff081869dad67b9f946c23563`), 1,649 ms → 3.9 ms | 3 |
| 6 | `kafaa_ready_route_guards_p1` | `20261013200005_kafaa_ready_route_guards.sql` | GENERATED (`scripts/gen-route-guards.mjs`, from the 401 routes of `src/routes`): `kafaa_route_guard(path)` (immutable) and `kafaa_route_ok_for(person, link, day)`; the SQL twin of the router's guard check. Executable by no API role | 2 |
| 7 | `kafaa_ready_digest_access_p1` | `20261013200006_kafaa_ready_digest_access.sql` | `kafaa_dg_compute` keeps only gathered items whose page the person may open (`kafaa_route_ok_for`); `kafaa_build_digest` builds through `kafaa_dg_compute` (same output for staff with access; students, partners and observers no longer get staff-only items). Grants: `kafaa_build_digest` authenticated only (as before), `kafaa_dg_compute` none | 2 |
| 8 | `kafaa_ready_ar_columns_p1` | `20261013200007_kafaa_ready_ar_columns.sql` | `add column if not exists` (text, nullable, no default): `kafaa_job_roles.regulation_ref_ar`, `kafaa_career_paths.rule_ref_ar`, `kafaa_programmes.population_note_ar` and `.conflict_note_ar`, `kafaa_talent_programmes.conflict_note_ar`, `kafaa_facts.conflict_note_ar`, `kafaa_vacancies.location_ar`. The pages fall back to English while a value is empty | 6 |

## 2. Function bodies before and after (`md5(prosrc)`, query 0a)

| function | md5 before | md5 after |
|---|---|---|
| `kafaa_build_digest(p_hints jsonb)` | `67342b957d589b02bff20ebfee11c123` | `4a36d274eeb2548664449834b94222d1` |
| `kafaa_cec_stats_core()` | `3d99dcd0392fd6d466c32b4217189d0e` | `0bf5f91923c3c50c10190019f9922ec5` |
| `kafaa_crew_availability()` | `6f384d4e66e1b097fa5d0668239ad18a` | `b399c38eac77c9c301b6cc8ae80845ad` |
| `kafaa_dg_compute(p_me text, p_today date, p_hints jsonb)` | `f5ca7a8547d4b5032d6e6b0365633172` | `4d470117ab0cecd9b70636b201041e69` |
| `kafaa_mirror_now()` | `-` | `55b4c9128fda3497fafd15778a687f17` |
| `kafaa_route_guard(p_path text)` | `-` | `1bb49789a6fb8de91962460a84f024df` |
| `kafaa_route_ok_for(p_person text, p_link text, p_day date)` | `-` | `37f0d1da8b2aba60d4a85618bf1dba1d` |
| `kafaa_sc_available(p_person text)` | `e484e06e7c68f9e7df17a131eb615614` | `4e49fd104c2cd67f3490895c6eb36131` |
| `kafaa_scope_people(p_res text)` | `-` | `7189611ffe20a51dd2ae3fb6200e3900` |

## 3. Policies (query 0c)

Fingerprint (dry-run model of `main`) before: `d17467eae9e4d630d9456c88c6f601ad`, after: `27cb0419618134fab11d43fabadc0d61`.

Live before: `c78a8a370efaeba76085804b6616322b` (section 0.3). **Live after parts 02-03 must be `27cb0419618134fab11d43fabadc0d61`**, still
508 policies (INSERT 68, SELECT 372, UPDATE 68), and `per_row` must be **0**; 134 policies then read `kafaa_scope_people`.

## 4. Grants

- Table grants on `kafaa_*` unchanged: anon SELECT 372; authenticated SELECT 372, INSERT 68, UPDATE 68.
- Execute: `kafaa_scope_people` anon + authenticated; `kafaa_build_digest` authenticated only; `kafaa_mirror_now`, `kafaa_route_guard`,
  `kafaa_route_ok_for`, `kafaa_dg_compute`, `kafaa_cec_stats_core` no API role; `kafaa_crew_availability` and `kafaa_sc_available` as before.
- NEXUS fingerprint (query 0d) unchanged.

```sql
select p.proname, has_function_privilege('anon', p.oid, 'execute') anon, has_function_privilege('authenticated', p.oid, 'execute') auth
  from pg_proc p where p.proname in ('kafaa_scope_people','kafaa_build_digest','kafaa_mirror_now','kafaa_route_guard','kafaa_route_ok_for',
    'kafaa_dg_compute','kafaa_cec_stats_core','kafaa_crew_availability','kafaa_sc_available') order by 1;
```

## 5. Behaviour checks after applying (read-only)

```sql
-- 5a. mirror clock and availability: kafaa_mirror_now() = 2026-10-08 08:00:00+00; only w-sro-05 is unknown (stale sync)
select kafaa_mirror_now(), count(*) filter (where kafaa_sc_available(person_id) is null) unknown,
       string_agg(person_id, ',') filter (where kafaa_sc_available(person_id) is null) who from kafaa_licences;
-- 5b. route guards: expect t, f, t, f
select kafaa_route_ok_for(null, '/learn', current_date), kafaa_route_ok_for(null, '/my', current_date),
       kafaa_route_ok_for('p-k-student', '/my', current_date), kafaa_route_ok_for('p-k-student', '/my/induction', current_date);
-- 5c. no digest item the person cannot open (expect 0)
select count(*) from kafaa_people p cross join lateral jsonb_array_elements(kafaa_dg_compute(p.id, current_date, '{}'::jsonb)) i
 where not kafaa_route_ok_for(p.id, i ->> 'link', current_date);
-- 5d. speed (as an instructor, a Scope holder; was 4.4 s): expect well under 1 s and the same 1,000 rows
begin read only;
select set_config('request.jwt.claims', '{"sub":"51a4e02c-341e-46d2-b18e-94e1a2041746","role":"authenticated","app_metadata":{"kafaa_persona":"k-instructor"}}', true);
set local role authenticated;
explain (analyze, buffers) select * from kafaa_person_skills where active limit 1000;
rollback;
```

Measured on live before (EXPLAIN ANALYZE, idle database) and on live data with the new predicate inlined (read-only, same rows):
`kafaa_person_skills` active, k-instructor 4,409 ms → 160 ms; `kafaa_people`, k-instructor 1,157 ms → ~30 ms; `kafaa_cec_stats`
(hr-analyst) 1,649 ms → 3.9 ms.

## 6. Data part (UPDATE of existing rows: owner approval needed)

| # | apply_migration name | what it changes | rows |
|---|---|---|---|
| d1 | `kafaa_ready_ar_values_p1` | fills the new `*_ar` columns with the Arabic texts a fresh build seeds (46 guarded statements: only while the English value is the seeded text and the Arabic one is empty). Apply after part 08 | job_roles 13, career_paths 12, programmes 25, talent_programmes 3, facts 2, vacancies 8 |

Expected: first run: 63 rows changed (live returned 63 matching rows on 2026-10-13); a second run changes 0. Each changed row writes one
audit row through the table's existing `*_audit` trigger. Without this part the pages stay correct (Arabic pages fall back to the English
text).

## 7. Not in this bundle

- **No index.** The slow reads were CPU in the per-row policy function, not scans: the tables are small and their indexes are used.
- **No row is deleted.** The E2E-QA rows left by earlier live journeys are listed in `E2E_RESIDUE.md` for the owner to decide; the
  journeys now refuse to write to the live project unless `KAFAA_E2E_LIVE_WRITES=1` is set.
- **No job role for the four staff personas without one** (review finding 8: `p-k-licensing-coord`, `p-k-editor`, `p-k-admin`,
  `p-k-auditor`, live 2026-10-13: all four `job_role_id` null). A persona's role feeds the seeded demand snapshots, F35 outlooks, FS51
  forecasts and opportunity match scores that live stores as released results; setting roles would make those stored results disagree
  with a recompute (8 unit tests catch exactly that). It needs the owner's choice of roles and a regenerated snapshot set, so it is left out.
- The generated schema/RLS files and `supabase/seed.sql` are never applied live.
