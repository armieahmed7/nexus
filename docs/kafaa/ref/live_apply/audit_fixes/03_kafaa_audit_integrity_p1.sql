-- kafaa_audit_integrity_p1 (1/1) · from supabase/migrations/20261012153001_kafaa_audit_integrity.sql (audit 2026-10-12 fixes, branch audit-fixes)
-- Apply with apply_migration name "kafaa_audit_integrity_p1", in ORDER.txt order. Idempotent; a second run changes nothing. See EXPECTED.md.
-- [Audit 2026-10-12 · fix c] Integrity objects that a build from main has and live never got.
-- The live W3E2 part created the M24 knowledge tables without their foreign keys, and three FK-covering indexes and the DELETE half of the
-- xAPI append-only guard were added to the generated 20261008120100_kafaa_schema.sql after live was built from it. On a fresh build every
-- statement below is a no-op (same names, guarded); on live it creates the missing objects. Additive; kafaa_* objects only.
-- Live check on 2026-10-12: 0 orphan rows for all 22 keys, so each constraint validates when added (deferrable, as in schema.sql).

-- 1. 22 foreign keys on the W3E2 (M24) tables, copied verbatim from 20261008120100_kafaa_schema.sql.
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_klra_positions_person_id_fk') then alter table kafaa_klra_positions add constraint kafaa_klra_positions_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_klra_positions_role_id_fk') then alter table kafaa_klra_positions add constraint kafaa_klra_positions_role_id_fk foreign key (role_id) references kafaa_job_roles(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_klra_positions_family_id_fk') then alter table kafaa_klra_positions add constraint kafaa_klra_positions_family_id_fk foreign key (family_id) references kafaa_job_families(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_klra_assessments_position_id_fk') then alter table kafaa_klra_assessments add constraint kafaa_klra_assessments_position_id_fk foreign key (position_id) references kafaa_klra_positions(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_klra_assessments_person_id_fk') then alter table kafaa_klra_assessments add constraint kafaa_klra_assessments_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_klra_assessments_assessed_by_fk') then alter table kafaa_klra_assessments add constraint kafaa_klra_assessments_assessed_by_fk foreign key (assessed_by) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_klra_actions_assessment_id_fk') then alter table kafaa_klra_actions add constraint kafaa_klra_actions_assessment_id_fk foreign key (assessment_id) references kafaa_klra_assessments(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_klra_actions_position_id_fk') then alter table kafaa_klra_actions add constraint kafaa_klra_actions_position_id_fk foreign key (position_id) references kafaa_klra_positions(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_klra_actions_person_id_fk') then alter table kafaa_klra_actions add constraint kafaa_klra_actions_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_klra_actions_created_by_fk') then alter table kafaa_klra_actions add constraint kafaa_klra_actions_created_by_fk foreign key (created_by) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_sme_profiles_person_id_fk') then alter table kafaa_sme_profiles add constraint kafaa_sme_profiles_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_capture_sessions_sme_id_fk') then alter table kafaa_capture_sessions add constraint kafaa_capture_sessions_sme_id_fk foreign key (sme_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_capture_sessions_interviewer_id_fk') then alter table kafaa_capture_sessions add constraint kafaa_capture_sessions_interviewer_id_fk foreign key (interviewer_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_capture_sessions_created_by_fk') then alter table kafaa_capture_sessions add constraint kafaa_capture_sessions_created_by_fk foreign key (created_by) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_capture_sessions_position_id_fk') then alter table kafaa_capture_sessions add constraint kafaa_capture_sessions_position_id_fk foreign key (position_id) references kafaa_klra_positions(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_knowledge_assets_author_id_fk') then alter table kafaa_knowledge_assets add constraint kafaa_knowledge_assets_author_id_fk foreign key (author_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_knowledge_assets_sme_id_fk') then alter table kafaa_knowledge_assets add constraint kafaa_knowledge_assets_sme_id_fk foreign key (sme_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_asset_reviews_asset_id_fk') then alter table kafaa_asset_reviews add constraint kafaa_asset_reviews_asset_id_fk foreign key (asset_id) references kafaa_knowledge_assets(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_asset_reviews_asset_author_id_fk') then alter table kafaa_asset_reviews add constraint kafaa_asset_reviews_asset_author_id_fk foreign key (asset_author_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_asset_reviews_reviewer_id_fk') then alter table kafaa_asset_reviews add constraint kafaa_asset_reviews_reviewer_id_fk foreign key (reviewer_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_asset_uses_asset_id_fk') then alter table kafaa_asset_uses add constraint kafaa_asset_uses_asset_id_fk foreign key (asset_id) references kafaa_knowledge_assets(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_asset_uses_person_id_fk') then alter table kafaa_asset_uses add constraint kafaa_asset_uses_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;

-- 2. Indexes that cover foreign keys (Supabase advisor unindexed_foreign_keys), copied from 20261008120100_kafaa_schema.sql.
create index if not exists kafaa_career_targets_role_id_idx on kafaa_career_targets (role_id);
create index if not exists kafaa_roadmaps_target_role_id_idx on kafaa_roadmaps (target_role_id);
create index if not exists kafaa_health_snapshots_role_id_idx on kafaa_health_snapshots (role_id);

-- 3. xAPI statements are append-only for deletes too. schema.sql guards `before update or delete`; live has `before update` only, because the
--    guarded create in 20261009144001_kafaa_w4e4_lrs.sql (left unchanged: applied migrations are not edited in this repo) found the trigger
--    name already taken. Additive: a second trigger for DELETE, created only when no BEFORE DELETE append-only trigger exists on the table
--    (so a fresh build, where kafaa_xapi_statements_append_only already covers DELETE, is unchanged).
do $$ begin
  if to_regclass('public.kafaa_xapi_statements') is not null and not exists (
       select 1 from pg_trigger t where t.tgrelid = 'public.kafaa_xapi_statements'::regclass and not t.tgisinternal
          and t.tgfoid = 'public.kafaa_append_only()'::regprocedure and (t.tgtype & 2) <> 0 and (t.tgtype & 8) <> 0) then
    create trigger kafaa_xapi_statements_no_delete before delete on kafaa_xapi_statements for each row execute function kafaa_append_only();
  end if;
end $$;
