-- live apply part kafaa_fs55_ai_safety_culture_p3 (from supabase/migrations/20261010255001_kafaa_fs55_ai_safety_culture.sql, part 3 of 3)
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'kafaa_fs49_hu_tools_guard') then
    create trigger kafaa_fs49_hu_tools_guard before insert or update on kafaa_hu_tools for each row execute function kafaa_fs49_content_guard();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'kafaa_fs49_oe_lessons_guard') then
    create trigger kafaa_fs49_oe_lessons_guard before insert or update on kafaa_oe_lessons for each row execute function kafaa_fs49_content_guard();
  end if;
end $$;
