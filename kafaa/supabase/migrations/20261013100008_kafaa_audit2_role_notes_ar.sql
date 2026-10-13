-- [Audit2 2026-10-13 · finding 15] Arabic role notes. /ar/careers/roles/<role> showed the English basis_note ("Barakah title and
-- structure unconfirmed; follows IAEA SSG-75.") on Arabic pages. kafaa_job_roles gets basis_note_ar (nullable); the page renders
-- pick(role, 'basis_note'), which falls back to English while the Arabic value is empty, so this part is safe to apply alone.
-- The 16 Arabic values come from the seed (scripts/seed/ext/zz-audit2-integrity.mjs, BASIS_NOTE_AR) on a fresh build. On live they
-- need UPDATE statements on existing rows, so they are NOT in this migration: they are the separate, approval-gated live-apply part
-- docs/kafaa/ref/live_apply/audit2/data_update/01_kafaa_audit2_role_notes_ar_values_p1.sql.
-- Additive column only; kafaa_* objects only; idempotent.
alter table kafaa_job_roles add column if not exists basis_note_ar text;
