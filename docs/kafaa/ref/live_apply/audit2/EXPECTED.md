# Final audit fixes (2026-10-13) live-apply bundle: what each part does and what to compare afterwards

Built from branch `audit2-fixes` (PR "Kafa'a final audit fixes") for the live Supabase project `hlirqxoddysxtdezwcgv`. **Nothing here has
been applied.** Each part is one migration file of `kafaa/supabase/migrations/` copied verbatim after a two-line header (all under 10 KB).
Apply **in ORDER.txt order** with the Supabase `apply_migration` tool (name = file name without the number prefix and `.sql`), run the
checks below, and merge the PR only after they pass: the front end of the PR calls `kafaa_submit_contact` (part 04), so the contact and
supplier forms need part 04 live first.

Every part is idempotent (a second run changes nothing) and touches `kafaa_*` objects only. No ENEC NEXUS object (table, grant, policy,
function) and no default privileges are changed. **No part updates or deletes a row.** The one data change (16 Arabic role notes, an
UPDATE of existing rows) is a separate part in `data_update/`, to apply only with the owner's explicit approval (section 6).

Dry run: `cd kafaa && node scripts/verify-audit2-bundle.mjs origin/main` (PGlite, Supabase default privileges, every migration and the
seed of `main` at `28d0456`, then the 2026-10-13 live clean-up of the three duplicate enrolments). It applies every part twice and the
data part twice, compares the md5s and counts below, checks the NEXUS fingerprint is unchanged and runs the behaviour checks of
`kafaa/scripts/validate/audit2-fixes.mjs` (62 checks). Result on 2026-10-13: all checks passed. The "before" numbers of the dry run are
the numbers live returned on 2026-10-13 (read-only queries below).

## 0. Before you start (all read-only)

1. Live is PostgreSQL 17 (170006); all public tables are owned by `postgres`; `apply_migration` runs as `postgres`.
2. The functions this bundle replaces must still have these bodies (`md5(prosrc)`, checked live 2026-10-13):

   | function | md5 before (live) |
   |---|---|
   | `kafaa_dalil_turn(p jsonb)` | `3e26c385e22768d94f1be46384b34774` (repo body `7d1279e5…`; live differs only by a stripped comment line) |
   | `kafaa_verify_badge(p_slug text)` | `531170af8d1e449e9173550fd3b3f11f` |
   | `kafaa_verify_microcred(p_slug text)` | `bde90b648104c4498e6ec77047ef939c` |
   | `kafaa_verify_record_share(p_token text)` | `dd8c0943fe598f88dcd94794b47e1872` |
   | `kafaa_dg_compose(p_items jsonb, p_muted text[])` | `057f34bc056b6d44728a65491591a51f` |
   | `kafaa_submit_application(p_programme_id text, p_answers jsonb)` | `fbc25be53eb17ab5ad87fe182616c39e` |
   | `kafaa_mnt_trim(p text)` / `kafaa_mnt_ratings(p jsonb)` | `d173d666…` / `336276477…` (bodies unchanged; only `search_path` is set) |

3. Part 09 needs **no duplicate open enrolment** (the data clean-up of 2026-10-13 cancelled en-133, en-140, en-173; live returned 0 on
   2026-10-13). If the query below returns rows, part 09 raises an exception naming them and changes nothing; close them first (that is a
   data change: owner approval).
4. Record the NEXUS fingerprint (query 4c) before applying; it must be the same afterwards.

```sql
select p.proname, pg_get_function_identity_arguments(p.oid), md5(p.prosrc) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('kafaa_dalil_turn','kafaa_verify_badge','kafaa_verify_microcred','kafaa_verify_record_share',
   'kafaa_dg_compose','kafaa_submit_application','kafaa_mnt_trim','kafaa_mnt_ratings') order by 1;
-- 3. duplicate open enrolments: expect no rows
select person_id, course_id, string_agg(id || ' ' || status, ', ') from kafaa_enrolments
 where status in ('assigned','requested','approved','waitlisted','enrolled','in_progress') group by 1, 2 having count(*) > 1;
```

## 1. Parts, in order

| # | apply_migration name | from | what it does | finding |
|---|---|---|---|---|
| 1 | `kafaa_audit2_rate_limits_p1` | `20261013100001_kafaa_audit2_rate_limits.sql` | new table `kafaa_rate_limits` (counter per bucket and key, RLS: auditors read, nobody writes directly; `select` granted like every kafaa table), `kafaa_client_ip()` (cf-connecting-ip, else the **last** X-Forwarded-For hop), `kafaa_rl_hit(bucket, key, window)`; helpers executable by no API role | 2, 6, 7 |
| 2 | `kafaa_audit2_dalil_turn_p1` | `20261013100002_kafaa_audit2_dalil_turn.sql` | `kafaa_advisor_turns.answer_source` (nullable, `browser`/`server`); `kafaa_dalil_turn` keys anonymous use on `kafaa_client_ip()`, adds a global cap of 120 anonymous questions a minute (refusal audited once a minute), marks every recorded answer `answer_source = 'browser'`, stores non-array citations as `[]`. Same signature and grants | 2 |
| 3 | `kafaa_audit2_verify_links_p1` | `20261013100003_kafaa_audit2_verify_links.sql` | `kafaa_verify_badge` / `_microcred` / `_record_share`: rate limits counted in `kafaa_rate_limits` (20 a minute per link, **60 a minute per client IP** across kinds, 600 a minute per kind); **one audit row per link, outcome and hour** instead of one per page view; helpers `kafaa_verify_limited` / `kafaa_verify_audit` / `kafaa_verify_refuse` (no API role). Same signatures and grants | 6 |
| 4 | `kafaa_audit2_contact_rpc_p1` | `20261013100004_kafaa_audit2_contact_rpc.sql` | new `kafaa_submit_contact(p jsonb)` (SECURITY DEFINER, anon + authenticated): the part-04 bounds, mailbox derived from the topic, 5 requests per 10 minutes per client and 30 a minute in total; `kafaa_insert` policy on `kafaa_contact_requests` now admits admins only (users_roles W/A); **anon loses INSERT** on the table | 7 |
| 5 | `kafaa_audit2_people_scholars_p1` | `20261013100005_kafaa_audit2_people_scholars.sql` | `kafaa_people`: authenticated INSERT/UPDATE become column grants (no UPDATE of `id`, `persona_id`, `status`, `org_id`; no INSERT of `persona_id`); `kafaa_scholars` insert/update policies lose the self branch (cohorts W/A only); drops the duplicate SELECT policy `kafaa_g3_read_university` on `kafaa_scholar_cohorts` (its rule is a branch of `kafaa_read`); `search_path = public` on `kafaa_mnt_trim` and `kafaa_mnt_ratings` | 8, 9, 20 |
| 6 | `kafaa_audit2_digest_order_p1` | `20261013100006_kafaa_audit2_digest_order.sql` | `kafaa_dg_compose`: from 2026-10-12 an approval dated in the future sorts after the owed ones (undated, due or overdue); earlier days unchanged (seeded W38-W41 digests identical). SQL = TS (`dayKey` in `rules.ts`) | 4 |
| 7 | `kafaa_audit2_reapply_p1` | `20261013100007_kafaa_audit2_reapply.sql` | `kafaa_submit_application`: re-applying after withdrawing reopens the caller's latest withdrawn application for the programme (same id, decision and deletion schedule cleared, new event "Application received again"), so the live E2E journeys stop adding rows | 5 |
| 8 | `kafaa_audit2_role_notes_ar_p1` | `20261013100008_kafaa_audit2_role_notes_ar.sql` | `alter table kafaa_job_roles add column if not exists basis_note_ar text` (no values: see section 6) | 15 |
| 9 | `kafaa_audit2_enrolment_open_unique_p1` | `20261013100009_kafaa_audit2_enrolment_open_unique.sql` | **last**: raises an exception (nothing changed) while any person holds two open enrolments of one course; otherwise creates the partial unique index `kafaa_enrolments_open_person_course_uniq` on `(person_id, course_id) where status in (assigned, requested, approved, waitlisted, enrolled, in_progress)` | 10 |

Effects on live data at apply time: none (no row is inserted, updated or deleted; part 1 creates an empty table). Afterwards: verification
links write at most one audit row per link and hour; anonymous Dalil sessions are keyed on the platform's client IP; the contact forms
write one `contact.submit` audit row (plus the table trigger's row) per request; existing `kafaa_advisor_turns` rows keep
`answer_source = null`.

## 2. Function bodies after the apply (`md5(prosrc)`, PGlite dry run)

| function | md5 after |
|---|---|
| `kafaa_client_ip()` | `2e083f1646a75dc136da93cc4d02b597` |
| `kafaa_rl_hit(p_bucket text, p_key text, p_window interval)` | `b9bd15bb47c11c3190f03e27973522ad` |
| `kafaa_dalil_turn(p jsonb)` | `5e847bf2a3c9052196514ea11b313e45` |
| `kafaa_verify_limited(p_kind text, p_key text)` | `5bb177c002fde902bf9e9b65b26ab2c8` |
| `kafaa_verify_audit(p_action text, p_table text, p_entity text, p_reason text, p_outcome text)` | `a1b2c601a739fdee7cdf777452f7c446` |
| `kafaa_verify_refuse(p_action text, p_table text, p_entity text, p_code text, p_message text)` | `d8066f3381679902b08c9d225622f99b` |
| `kafaa_verify_badge(p_slug text)` | `99dd1e5cb63b252716a7ef7442211f9c` |
| `kafaa_verify_microcred(p_slug text)` | `8464b164cb263fcd6240ed05fab94783` |
| `kafaa_verify_record_share(p_token text)` | `69fc6c84fc399dd1abb0afb89f9f8c20` |
| `kafaa_submit_contact(p jsonb)` | `b92ab10f49735c14da752fbff2c9f663` |
| `kafaa_dg_compose(p_items jsonb, p_muted text[])` | `0d928eff2cdbdf503bb51ca82238172f` |
| `kafaa_submit_application(p_programme_id text, p_answers jsonb)` | `f7d534fad842a67d8dd31246f30ba552` |
| `kafaa_mnt_trim(p text)` | `d173d66609191e910620e3df3bd46f12` |
| `kafaa_mnt_ratings(p jsonb)` | `336276477fa2a6612d7f7017712ef447` |

`apply_migration` keeps comments inside function bodies, so these md5s should match exactly; if a tool strips comment lines, compare
`regexp_replace(prosrc, '--[^\n]*', '', 'g')` instead. Execute grants after the apply: anon and authenticated on `kafaa_dalil_turn`,
`kafaa_verify_badge`, `kafaa_verify_microcred`, `kafaa_verify_record_share`, `kafaa_submit_contact`; authenticated only on
`kafaa_submit_application`; **no API role** on `kafaa_client_ip`, `kafaa_rl_hit`, `kafaa_verify_limited`, `kafaa_verify_audit`,
`kafaa_verify_refuse`, `kafaa_dg_compose`, `kafaa_mnt_trim`, `kafaa_mnt_ratings`; no PUBLIC entry on any of them.

```sql
select p.proname, pg_get_function_identity_arguments(p.oid) args, md5(p.prosrc), p.prosecdef, p.proconfig,
       has_function_privilege('anon', p.oid, 'execute') anon, has_function_privilege('authenticated', p.oid, 'execute') auth, p.proacl
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('kafaa_client_ip','kafaa_rl_hit','kafaa_dalil_turn','kafaa_verify_limited','kafaa_verify_audit','kafaa_verify_refuse',
   'kafaa_verify_badge','kafaa_verify_microcred','kafaa_verify_record_share','kafaa_submit_contact','kafaa_dg_compose','kafaa_submit_application','kafaa_mnt_trim','kafaa_mnt_ratings')
 order by 1;
```

## 3. Policies, columns and the index after the apply

```sql
-- a. policy counts on kafaa_* tables: expect SELECT 372, INSERT 68, UPDATE 68 (before: the same; -1 kafaa_g3_read_university, +1 kafaa_read on kafaa_rate_limits)
select cmd, count(*) from pg_policies where schemaname = 'public' and tablename like 'kafaa\_%' group by 1 order by 1;
-- b. scholars: no kafaa_me() in the write policies; scholar cohorts: one SELECT policy (kafaa_read); contact requests insert = admins only
select tablename, policyname, cmd, roles, with_check from pg_policies
 where tablename in ('kafaa_scholars', 'kafaa_scholar_cohorts', 'kafaa_contact_requests', 'kafaa_rate_limits') order by 1, 2;
-- c. new columns and the index: expect 3 rows
select table_name, column_name from information_schema.columns where (table_name, column_name) in (('kafaa_advisor_turns', 'answer_source'), ('kafaa_job_roles', 'basis_note_ar'))
union all select tablename, indexname from pg_indexes where indexname = 'kafaa_enrolments_open_person_course_uniq';
-- d. kafaa_mnt_* search path: expect {search_path=public} twice
select proname, proconfig from pg_proc where proname in ('kafaa_mnt_trim', 'kafaa_mnt_ratings');
```

## 4. Grants after the apply

Counts of kafaa_* tables on which the role holds the privilege at table level or on any column (PGlite dry run = live before, 2026-10-13):

| role | privilege | before | after |
|---|---|---|---|
| anon | SELECT | 371 | 372 |
| anon | INSERT | 1 | 0 |
| anon | UPDATE | 0 | 0 |
| anon | DELETE | 0 | 0 |
| anon | TRUNCATE | 0 | 0 |
| authenticated | SELECT | 371 | 372 |
| authenticated | INSERT | 68 | 68 |
| authenticated | UPDATE | 68 | 68 |
| authenticated | DELETE | 0 | 0 |
| authenticated | TRUNCATE | 0 | 0 |

The new table `kafaa_rate_limits` gets SELECT only (RLS: auditors). `kafaa_contact_requests`: anon has nothing but SELECT; authenticated keeps
INSERT (the policy admits admins only) and UPDATE(status). `kafaa_people`: authenticated holds column-level INSERT (every column but
`persona_id`) and UPDATE (every column but `id`, `persona_id`, `status`, `org_id`) instead of table-level grants.

```sql
-- 4a. counts per role and privilege (table level or any column)
select r.rolname, x.p, count(*) from pg_class c join pg_namespace s on s.oid = c.relnamespace
  cross join (values ('anon'), ('authenticated')) r(rolname) cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) x(p)
 where s.nspname = 'public' and c.relkind in ('r', 'p') and c.relname like 'kafaa\_%'
   and (has_table_privilege(r.rolname, c.oid, x.p) or (x.p in ('SELECT', 'INSERT', 'UPDATE') and has_any_column_privilege(r.rolname, c.oid, x.p)))
 group by 1, 2 order by 1, 2;
-- 4b. people and contact requests: expect f f f t f f / f t
select has_column_privilege('authenticated', 'kafaa_people', 'persona_id', 'UPDATE'), has_column_privilege('authenticated', 'kafaa_people', 'status', 'UPDATE'),
       has_column_privilege('authenticated', 'kafaa_people', 'org_id', 'UPDATE'), has_column_privilege('authenticated', 'kafaa_people', 'language', 'UPDATE'),
       has_column_privilege('authenticated', 'kafaa_people', 'persona_id', 'INSERT'), has_table_privilege('authenticated', 'kafaa_people', 'UPDATE');
select has_any_column_privilege('anon', 'kafaa_contact_requests', 'INSERT'), has_column_privilege('authenticated', 'kafaa_contact_requests', 'status', 'UPDATE');
-- 4c. NEXUS fingerprint: run before and after; the two values must be equal
select md5(string_agg(x, '|' order by x)) from (
  select 'p:' || c.relname || ':' || r.rolname || ':' || x.p as x from pg_class c join pg_namespace s on s.oid = c.relnamespace cross join (values ('anon'), ('authenticated')) r(rolname)
    cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) x(p)
   where s.nspname = 'public' and c.relkind in ('r', 'p') and c.relname not like 'kafaa\_%' and has_table_privilege(r.rolname, c.oid, x.p)
  union all select 'pol:' || tablename || ':' || policyname || ':' || coalesce(qual, '') || ':' || coalesce(with_check, '') from pg_policies where schemaname = 'public' and tablename not like 'kafaa\_%'
  union all select 'fn:' || p.proname || ':' || md5(p.prosrc) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname not like 'kafaa\_%'
  union all select 'acl:' || coalesce(d.defaclacl::text, '') from pg_default_acl d) t;
```

## 5. Behaviour checks after the apply (read-only through rollback)

Each block runs in a transaction that is rolled back; nothing stays behind.

```sql
-- a. the anonymous Dalil key ignores a spoofed first X-Forwarded-For hop: expect two equal keys (ip-<md5 of 198.51.100.50>)
begin;
select set_config('request.headers', '{"x-forwarded-for":"203.0.113.1, 198.51.100.50"}', true);
set local role anon;
select kafaa_dalil_turn('{"mode":"public","client_key":"bundle-check","question":"What are the RO entry requirements?","answer":"Three routes.","citations":[],"intent":"check"}'::jsonb) -> 'data' ->> 'session_id';
reset role;
select client_key from kafaa_advisor_sessions order by started_at desc limit 1;
select answer_source, speaker from kafaa_advisor_turns order by ts desc, id desc limit 2;   -- expect 'browser' on the dalil turn, null on the user turn
rollback;
-- b. contact form: the RPC works signed out; a direct insert does not
begin; set local role anon;
select kafaa_submit_contact('{"topic":"careers","message":"Bundle check","status":"routed"}'::jsonb) ->> 'ok';      -- true
select kafaa_submit_contact('{"topic":"careers","message":"Bundle check","status":"closed"}'::jsonb) ->> 'code';    -- invalid
rollback;
begin; set local role anon;
insert into kafaa_contact_requests (id, topic, route_to, message) values ('con-check', 'careers', 'Careers team (role mailbox)', 'x');  -- ERROR: permission denied
rollback;
-- c. verification: two views of one badge write one audit row
begin; set local role anon;
select kafaa_verify_badge((select public_slug from kafaa_badges where public_slug is not null order by id limit 1)) ->> 'ok';
select kafaa_verify_badge((select public_slug from kafaa_badges where public_slug is not null order by id limit 1)) ->> 'audit_seq';  -- null on the second view
rollback;
-- d. digest order for the training manager today: expect plant_visits and roleplay_sessions among the approvals, no prearrival_shares
select i ->> 'ref_table' from jsonb_array_elements(kafaa_dg_compute('p-training-mgr', current_date, '{}'::jsonb)) i where i ->> 'kind' = 'approval';
-- e. a second open enrolment is refused by the index
begin;
insert into kafaa_enrolments (id, person_id, course_id, status, source)
  select 'en-bundle-check', person_id, course_id, 'assigned', 'manager' from kafaa_enrolments where status = 'enrolled' order by id limit 1;  -- ERROR: duplicate key
rollback;
```

After the apply and once real traffic has passed, check that anonymous Dalil sessions are not all collapsing onto one key (which would
mean the platform's last hop is a shared proxy address rather than the client):
`select client_key, count(*) from kafaa_advisor_sessions where person_id is null and started_at > now() - interval '1 day' group by 1 order by 2 desc limit 5;`
If one key holds nearly every session, report it: `kafaa_client_ip()` should then read the header the platform sets for the client.

## 6. Data update (separate, needs the owner's approval)

`data_update/01_kafaa_audit2_role_notes_ar_values_p1.sql` (apply_migration name `kafaa_audit2_role_notes_ar_values_p1`, any time after
part 8) sets `kafaa_job_roles.basis_note_ar` on the 16 roles with an English `basis_note`: 16 guarded `update ... where id = … and
basis_note = <seeded English> and basis_note_ar is null`. These are UPDATE statements on existing rows, so they are kept out of the main
bundle. Expected: 16 rows changed on the first run, 0 on the second; `select count(*) from kafaa_job_roles where basis_note is not null and
basis_note_ar is null` = 0 afterwards. Until it is applied, /ar/careers/roles/* keeps showing the English note (the page falls back to
English; nothing breaks).

## 7. Not in this bundle

- The 15 withdrawn `app-<uuid>` E2E applications already on live and the duplicate-enrolment clean-up are handled by the separate data
  clean-up (owner-approved). Part 7 stops new ones accumulating.
- `kafaa_verify_certificate` (audit fix part 05) still writes one audit row per check; it was not in the final-audit findings.
- Migration history: the parts are applied with `apply_migration`, so they appear in `supabase_migrations.schema_migrations` under the
  names above.
