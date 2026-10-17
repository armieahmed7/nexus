-- [Arabic parity 2026-10-17] Arabic training-session locations. /ar/learn/course/<id>, /ar/training/*, /ar/my/learning and the session
-- picker showed kafaa_sessions.location in English ("Simulator Training Center") on Arabic pages. kafaa_sessions gets location_ar
-- (nullable, no default); pages render pick(session, 'location'), which falls back to the English value while the Arabic one is empty,
-- and the schedule form takes an optional Arabic location for new sessions.
-- Grants and RLS: kafaa_sessions has table-level grants only (no column-level ACLs; checked 2026-10-17), so the new column is read and
-- written exactly like the rest of the row. Policies are row-based and unchanged.
-- Values: the seeded locations, from scripts/seed/ext/zz-ar-parity.mjs (a fresh build seeds the same; tests/unit/ar-parity.test.ts checks
-- the two agree). Guarded: a row changes only while its English value is the seeded text and its Arabic value is still empty, so a second
-- run, or a row a trainer edited, changes nothing. The table's audit trigger writes one audit row per changed row.
-- Additive column and kafaa_sessions rows only; kafaa_* objects only; idempotent.
alter table public.kafaa_sessions add column if not exists location_ar text;
update public.kafaa_sessions set location_ar = 'أبوظبي' where location = 'Abu Dhabi' and coalesce(location_ar, '') = '';
update public.kafaa_sessions set location_ar = 'أبوظبي (أكاديمية الموردين)' where location = 'Abu Dhabi (supplier academy)' and coalesce(location_ar, '') = '';
update public.kafaa_sessions set location_ar = 'براكة' where location = 'Barakah' and coalesce(location_ar, '') = '';
update public.kafaa_sessions set location_ar = 'مركز التدريب في براكة' where location = 'Barakah training centre' and coalesce(location_ar, '') = '';
update public.kafaa_sessions set location_ar = 'تعلم إلكتروني' where location = 'E-learning' and coalesce(location_ar, '') = '';
update public.kafaa_sessions set location_ar = 'مركز تدريب المشغّلين' where location = 'Operator Training Center' and coalesce(location_ar, '') = '';
update public.kafaa_sessions set location_ar = 'مركز التدريب على المحاكاة' where location = 'Simulator Training Center' and coalesce(location_ar, '') = '';
-- Rows left by the live E2E runs ("E2E-QA room <run id>", listed for removal in docs/kafaa/ref/live_apply/ready/E2E_RESIDUE.md):
-- the run id is kept as written. No such rows exist on a fresh build.
update public.kafaa_sessions set location_ar = 'قاعة E2E-QA ' || substring(location from 13) where location like 'E2E-QA room %' and coalesce(location_ar, '') = '';
