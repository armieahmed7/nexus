# Audit back-fill (2026-10-12): the 208 seeded pool applications missing on live

Audit finding 2 (live DB audit, 2026-10-12): live `kafaa_skill_evidence` has 416 `rating` rows with `ref_table = 'applications'` and
`ref_id` `app-p001`..`app-p208`, but those 208 applications (the synthetic pool that makes the funnel cells reach the minimum group
size, CONTRACT.md) were never loaded live. Their applicant people `ap-001`..`ap-208` exist live. This bundle loads the missing rows,
copied verbatim from `kafaa/supabase/seed.sql` on main, so live matches a build from main:

| part | apply_migration name | table | rows | ids | digest |
|---|---|---|---|---|---|
| 01 | `kafaa_audit_backfill_p01` | kafaa_consents | 160 | cn-app-p001..cn-app-p160 | 2d2149433c169916 |
| 02 | `kafaa_audit_backfill_p02` | kafaa_consents | 48 | cn-app-p161..cn-app-p208 | 79c2b6364f24d2e7 |
| 03 | `kafaa_audit_backfill_p03` | kafaa_applications | 146 | app-p001..app-p146 | 2b9daf8a350b55c9 |
| 04 | `kafaa_audit_backfill_p04` | kafaa_applications | 62 | app-p147..app-p208 | 561cafa1a020c726 |
| 05 | `kafaa_audit_backfill_p05` | kafaa_application_events | 159 | app-p001-e1..app-p068-e2 | c9ac9aacd29d35f7 |
| 06 | `kafaa_audit_backfill_p06` | kafaa_application_events | 161 | app-p068-e3..app-p146-e5 | d7cdb04eae56b5a9 |
| 07 | `kafaa_audit_backfill_p07` | kafaa_application_events | 148 | app-p147-e1..app-p208-e5 | 5a5ab94c242bd03d |

Apply in ORDER.txt order (consents and applications before their events) with `apply_migration`. Every part is under 30 KB, sets
`kafaa.seeding = 'on'` for its own transaction (as seed.sql does, so the `kafaa_consents_audit` row trigger writes no audit rows),
inserts with `on conflict (id) do nothing`, and ends with a guard that recounts and re-digests the rows this transaction inserted
(`xmin` = current transaction): if the count or digest differs, including when any id already existed live, the part raises and rolls
back as a whole. No row is updated or deleted, and no schema object is changed. Built by `scratchpad/bf/gen.py` + `guard.mjs`
(the guard passes on a clean target in PGlite; a second run of each insert inserts nothing).

## Before (read-only)

```sql
select (select count(*) from kafaa_applications where id like 'app-p%') apps,             -- expect 0
       (select count(*) from kafaa_application_events where application_id like 'app-p%') events, -- expect 0
       (select count(*) from kafaa_consents where id like 'cn-app-p%') consents,          -- expect 0
       (select count(*) from kafaa_people where id ~ '^ap-[0-9]{3}$') people,              -- expect 208
       (select count(*) from kafaa_skill_evidence e where e.ref_table = 'applications'
          and not exists (select 1 from kafaa_applications a where a.id = e.ref_id)) orphan_evidence; -- 416 before
```

The programmes used (`dnt`, `mustaqbali`, `gdp`, `gpo`, `internships`, `energy-pioneers`, `train-for-work`, `mawaheb`, `ku-msc`) must exist in
`kafaa_talent_programmes` (FKs are deferred, so a missing one fails the part at commit).

## After

```sql
set timezone = 'UTC';
select 'consents' t, count(*), left(md5(string_agg((jsonb_build_object('id', t.id, 'person_id', t.person_id, 'type', t.type, 'purpose', t.purpose, 'version', t.version, 'granted_at', t.granted_at, 'withdrawn_at', t.withdrawn_at))::text, '|' order by t.id collate "C")), 16)
  from kafaa_consents t where t.id like 'cn-app-p%'
union all
select 'applications', count(*), left(md5(string_agg((jsonb_build_object('id', t.id, 'person_id', t.person_id, 'programme_id', t.programme_id, 'stage', t.stage, 'submitted_at', t.submitted_at, 'updated_at', t.updated_at, 'decision', t.decision, 'decision_source', t.decision_source, 'consent_version', t.consent_version, 'delete_after', t.delete_after, 'answers', t.answers, 'nationality_flag', t.nationality_flag, 'gender', t.gender))::text, '|' order by t.id collate "C")), 16)
  from kafaa_applications t where t.id like 'app-p%'
union all
select 'events', count(*), left(md5(string_agg((jsonb_build_object('id', t.id, 'application_id', t.application_id, 'person_id', t.person_id, 'ts', t.ts, 'stage', t.stage, 'note_en', t.note_en, 'note_ar', t.note_ar, 'by_role', t.by_role))::text, '|' order by t.id collate "C")), 16)
  from kafaa_application_events t where t.application_id like 'app-p%';
-- expect consents 208 e3f8bfeaaed136c0, applications 208 94e3f305fd95adea, events 468 28b9b27191e10d53
select count(*) from kafaa_skill_evidence e where e.ref_table = 'applications' and not exists (select 1 from kafaa_applications a where a.id = e.ref_id); -- expect 0
```

Skill states: neither `kafaa_skill_evidence_derive` nor `kafaa_skill_states_v2` reads `kafaa_applications`, so the 416 rating rows already
feed `kafaa_person_skills` and the back-fill changes no skill state. Live `ap-*` states were last refreshed with `p_now = 2026-10-10`
(2026-10-10 10:46 UTC; `kafaa_skill_states_v2(person, '2026-10-10', null)` equals all 416 live rows, while '2026-10-08', the seed date,
differs only in the decayed weights inside `reasons`). Replay `kafaa_skills_apply(person, '2026-10-10')` for the 208 `ap-*` people as a
consistency check: expect 0 changed `kafaa_person_skills` / `kafaa_skill_evidence` rows (anyone's `updated_at` unchanged).
