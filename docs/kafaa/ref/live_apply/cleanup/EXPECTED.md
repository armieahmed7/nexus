# Sample-data clean-up (2026-10-13): what each part does and what to check

Live Supabase project `hlirqxoddysxtdezwcgv`, approved by the owner on 2026-10-13 10:43 UTC. Apply in ORDER.txt order with
`apply_migration` (name = file name without the number prefix and `.sql`). Each part touches only the rows it names, guards against
live being different from what is described below (it raises and rolls back as a whole), and is safe to run twice. No schema object,
grant, policy or ENEC NEXUS row is changed. `kafaa_audit_events` and `kafaa_xapi_statements` are never updated or deleted.

| part | apply_migration name | change | status |
|---|---|---|---|
| 01 | `kafaa_cleanup_dup_enrolments` | 3 kafaa_enrolments rows set to `cancelled` | applied 2026-10-13 10:54 UTC (version 20261013105442) |
| 02 | `kafaa_cleanup_fs31_award_notices` | 102 kafaa_notifications rows inserted | applied 2026-10-13 10:57 UTC (version 20261013105732) |
| 03 | `kafaa_cleanup_e2e_applications` | 37 kafaa_application_events + 15 kafaa_applications rows deleted | applied by hand in the Supabase SQL editor by the owner 2026-10-13 ~12:49 UTC (not via apply_migration, so no schema_migrations row); verified 12:51 UTC: applications 237→222, events 546→509, 0 `app-`+32-hex ids left, withdrawn gpo 0 / energy-pioneers 1, 0 orphan events, the 37 kafaa_audit_events rows still present, audit chain intact (15764 rows, 0 breaks) |
| 04 | `kafaa_cleanup_history_repair` | 12 supabase_migrations.schema_migrations rows inserted | applied 2026-10-13 10:59 UTC (version 20261013105914) |

## 01 · duplicate open enrolments

Three pairs had the same person and course open twice, both at 0 % progress. In each pair the older row is the role-rule assignment
with no session (`assigned`, source `role_rule`) and the newer one is the coordinator's booking into a session (`enrolled`). The older,
unscheduled row is closed, so nobody loses a seat:

| closed | kept | person | course | closed row before | kept row |
|---|---|---|---|---|---|
| en-133 | en-166 | p-k-lo-trainee | c-loct | assigned, 2026-09-25, no session | enrolled, 2026-10-02, s-loct-c |
| en-140 | en-164 | p-k-ro | c-coct | assigned, 2026-09-18, no session | enrolled, 2026-10-04, s-coct-b |
| en-173 | en-244 | w-sro-04 | c-coct | assigned, 2026-09-25, no session | enrolled, 2026-10-04, s-coct-b |

`kafaa_cancel_enrolment()` needs a signed-in caller, so the part does what its coordinator branch does for an unscheduled row
(status `cancelled`, reason in `decision_note`). The `kafaa_enrolments_audit` trigger wrote one audit row per update (seq 15761-15763).

```sql
select id, status, session_id, decision_note from kafaa_enrolments where id in ('en-133','en-166','en-140','en-164','en-173','en-244') order by id;
-- expect en-133/en-140/en-173 cancelled, note 'Duplicate enrolment closed in data clean-up 2026-10-13 (kept en-166|en-164|en-244)';
--        en-166/en-164/en-244 enrolled, unchanged
```

## 02 · FS31 "Micro-credential awarded" notifications

`kafaa/scripts/seed/ext/fs31-future-credentials.mjs` creates one `nt-mc-<award id>-awarded` notification per FS31 award. Live had
all 102 awards (`kafaa_microcred_awards`, status `awarded`) but none of the notifications. The rows are copied verbatim from
`kafaa/supabase/seed.sql` (seed.sql itself is not applied), inserted with `kafaa.seeding = 'on'` (no audit rows, as for seed rows).

```sql
select count(*), md5(string_agg(concat_ws('~', id, person_id, kind, title_en, title_ar, coalesce(body_en,''), coalesce(body_ar,''), coalesce(link,''), severity,
         to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'), coalesce(read_at::text,'')), '|' order by id collate "C"))
  from kafaa_notifications where id like 'nt-mc-mca-%-awarded' and id !~ 'mca-[0-9a-f]{16}-awarded$' and id <> 'nt-mc-mca-p-sro-mc-project-req-awarded';
-- before: 0 rows. after: 102, fe0124e803a04d592f9d8c7a70f2df4e (same digest computed from src/seed/seed.json)
select count(*) from kafaa_notifications; -- 810 before, 912 after
```

## 03 · withdrawn end-to-end test applications

`tests/e2e/journeys.spec.ts` submits and withdraws applications as p-nse (gpo) and p-buyer (energy-pioneers) on each run; the RPC
names them `app-` + 32 hex digits (seed ids are `app-<n>` and `app-p<nnn>`). Live had 15, all `withdrawn`: gpo/p-nse 9,
energy-pioneers/p-buyer 6. A search of every text/json column of every `kafaa_*` table found references only in
`kafaa_application_events` (37 rows, FK) and `kafaa_audit_events` (37: submit 15, withdraw 15, decide 7). No skill evidence,
notification or xAPI row refers to them. The part deletes the 37 events and the 15 applications; the audit rows stay as history.
There is no delete trigger on either table and no other FK into `kafaa_applications`.

```sql
select programme_id, stage, count(*) from kafaa_applications where stage = 'withdrawn' and programme_id in ('gpo','energy-pioneers') group by 1, 2;
-- before: gpo 9, energy-pioneers 7. after: gpo row gone (seed 0), energy-pioneers 1 (seed 1)
select (select count(*) from kafaa_applications) apps, (select count(*) from kafaa_application_events) events;
-- before 237 / 546. after 222 / 509 (= seed.json 222 / 509)
select count(*) from kafaa_application_events e where not exists (select 1 from kafaa_applications a where a.id = e.application_id); -- 0
```

## 04 · migration history for the 12 files run by hand

`audit_fixes/01-05` and `audit_fixes/backfill/01-07` were run by hand in the SQL editor on 2026-10-12 ~23:00-23:14 UTC, so the history
had no row for them. Their effects were checked first (back-fill 208/208/468; contact-form policy and certificate rate limit live).
Versions 20261012230001..20261012230012 in ORDER.txt order; `statements` holds the source path and sha256 of each file.

```sql
select version, name from supabase_migrations.schema_migrations where version between '20261012230001' and '20261012230012' order by version;
-- expect 12 rows: kafaa_audit_rpc_only_tables_p1, kafaa_audit_grants_p1, kafaa_audit_integrity_p1, kafaa_audit_contact_requests_p1,
-- kafaa_audit_verify_certificate_p1, kafaa_audit_backfill_p01 .. kafaa_audit_backfill_p07
```
