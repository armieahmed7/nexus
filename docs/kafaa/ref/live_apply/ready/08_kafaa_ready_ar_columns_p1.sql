-- kafaa_ready_ar_columns_p1 (1/1) · from kafaa/supabase/migrations/20261013200007_kafaa_ready_ar_columns.sql (readiness fixes 2026-10-13, branch readiness-fixes)
-- Apply with apply_migration name "kafaa_ready_ar_columns_p1", in ORDER.txt order. Idempotent; a second run changes nothing; kafaa_* objects only. See EXPECTED.md.
-- [Readiness fixes 2026-10-13 · finding 6] Arabic columns for English-only data shown on Arabic pages.
-- /ar/careers/*, /ar/learn, /ar/about, /ar/careers/jobs and /ar/pathways showed these English values inside Arabic text. Pages render them
-- with pick() (the Arabic value when there is one, else the English). Nullable, no default: no row changes here; the values are a separate,
-- approval-gated data part (docs/kafaa/ref/live_apply/ready/data_update/01_kafaa_ready_ar_values_p1.sql). Grants and policies are per
-- table, so the new columns are readable exactly like the rest of each row. Idempotent (add column if not exists).

alter table kafaa_job_roles add column if not exists regulation_ref_ar text;
alter table kafaa_career_paths add column if not exists rule_ref_ar text;
alter table kafaa_programmes add column if not exists population_note_ar text;
alter table kafaa_programmes add column if not exists conflict_note_ar text;
alter table kafaa_talent_programmes add column if not exists conflict_note_ar text;
alter table kafaa_facts add column if not exists conflict_note_ar text;
alter table kafaa_vacancies add column if not exists location_ar text;
