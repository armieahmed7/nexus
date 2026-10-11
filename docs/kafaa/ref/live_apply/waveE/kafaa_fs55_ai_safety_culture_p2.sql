-- live apply part kafaa_fs55_ai_safety_culture_p2 (from supabase/migrations/20261010255001_kafaa_fs55_ai_safety_culture.sql, part 2 of 3)
-- ───────────── Content rules (= src/modules/m08/aiCulture.ts). Internal helpers: not executable by API roles.
-- Situation cues (= CUE_IDS).
create or replace function kafaa_fs49_cue_ids() returns text[] language sql immutable set search_path = public as $$
  select array['confident', 'disagree', 'summary', 'controlled_source', 'revision', 'mode', 'alarm', 'autofill', 'routine', 'time_pressure', 'handover', 'recommendation', 'translation']::text[]
$$;

-- A JSON value that is not a string, or a string of only spaces, tabs or line breaks (= blank() over str()).
create or replace function kafaa_fs49_blank(p jsonb) returns boolean language sql immutable set search_path = public as $$
  select jsonb_typeof(p) is distinct from 'string' or translate(p #>> '{}', E' \t\n\r', '') = ''
$$;

-- An {en, ar} object with both texts present (= biOk).
create or replace function kafaa_fs49_bi_ok(p jsonb) returns boolean language sql immutable set search_path = public as $$
  select jsonb_typeof(p) = 'object' and not kafaa_fs49_blank(p -> 'en') and not kafaa_fs49_blank(p -> 'ar')
$$;

-- Problems of an HU tool card in a fixed order (= huCardProblems): name, description, ai_angle, ai_text, practice, cues, links, and with
-- references drill_unknown, lesson_unknown, trait_unknown.
create or replace function kafaa_fs49_hu_problems(p jsonb, p_refs boolean) returns text[] language plpgsql stable set search_path = public as $$
declare
  v text[] := '{}'::text[];
  v_ai boolean := (p ->> 'topic') is not distinct from 'ai_automation';
  v_pr jsonb := p -> 'practice';
  v_cues jsonb := case when jsonb_typeof(p -> 'cues') = 'array' then p -> 'cues' else '[]'::jsonb end;
  v_dr jsonb := case when jsonb_typeof(p -> 'drill_ids') = 'array' then p -> 'drill_ids' else '[]'::jsonb end;
  v_ls jsonb := case when jsonb_typeof(p -> 'lesson_ids') = 'array' then p -> 'lesson_ids' else '[]'::jsonb end;
  v_tr jsonb := case when jsonb_typeof(p -> 'trait_ids') = 'array' then p -> 'trait_ids' else '[]'::jsonb end;
  v_bad boolean;
begin
  if kafaa_fs49_blank(p -> 'name_en') or kafaa_fs49_blank(p -> 'name_ar') then v := v || 'name'::text; end if;
  if kafaa_fs49_blank(p -> 'description_en') or kafaa_fs49_blank(p -> 'description_ar') then v := v || 'description'::text; end if;
  if not v_ai and (kafaa_fs49_blank(p -> 'ai_en') or kafaa_fs49_blank(p -> 'ai_ar')) then v := v || 'ai_angle'::text; end if;
  if v_ai and (kafaa_fs49_blank(p -> 'trap_en') or kafaa_fs49_blank(p -> 'trap_ar') or kafaa_fs49_blank(p -> 'example_en') or kafaa_fs49_blank(p -> 'example_ar')) then
    v := v || 'ai_text'::text;
  end if;
  if jsonb_typeof(v_pr) is distinct from 'array' then v_bad := true;
  else v_bad := exists (select 1 from jsonb_array_elements(v_pr) e where not kafaa_fs49_bi_ok(e)) or (v_ai and jsonb_array_length(v_pr) < 2);
  end if;
  if v_bad then v := v || 'practice'::text; end if;
  if exists (select 1 from jsonb_array_elements(v_cues) e where jsonb_typeof(e) <> 'string' or not ((e #>> '{}') = any (kafaa_fs49_cue_ids())))
     or (v_ai and jsonb_array_length(v_cues) = 0) then
    v := v || 'cues'::text;
  end if;
  if jsonb_array_length(v_dr) + jsonb_array_length(v_ls) = 0 then v := v || 'links'::text; end if;
  if p_refs then
    if exists (select 1 from jsonb_array_elements_text(v_dr) d where not exists (select 1 from kafaa_ai_drills x where x.id = d)) then v := v || 'drill_unknown'::text; end if;
    if exists (select 1 from jsonb_array_elements_text(v_ls) d where not exists (select 1 from kafaa_oe_lessons x where x.id = d)) then v := v || 'lesson_unknown'::text; end if;
    if exists (select 1 from jsonb_array_elements_text(v_tr) d where not exists (select 1 from kafaa_sc_traits x where x.id = d)) then v := v || 'trait_unknown'::text; end if;
  end if;
  return v;
end $$;

-- Problems of an OE lesson (= lessonProblems): for topic ai_automation text, sources, source_label, source_url, source_year, source_as_of;
-- with references (any topic) drill_unknown.
create or replace function kafaa_fs49_lesson_problems(p jsonb, p_refs boolean) returns text[] language plpgsql stable set search_path = public as $$
declare
  v text[] := '{}'::text[];
  v_src jsonb := p -> 'sources';
  v_dr jsonb := case when jsonb_typeof(p -> 'drill_ids') = 'array' then p -> 'drill_ids' else '[]'::jsonb end;
begin
  if (p ->> 'topic') is not distinct from 'ai_automation' then
    if kafaa_fs49_blank(p -> 'title_en') or kafaa_fs49_blank(p -> 'title_ar') or kafaa_fs49_blank(p -> 'summary_en') or kafaa_fs49_blank(p -> 'summary_ar')
       or kafaa_fs49_blank(p -> 'lesson_en') or kafaa_fs49_blank(p -> 'lesson_ar') then
      v := v || 'text'::text;
    end if;
    if jsonb_typeof(v_src) is distinct from 'array' or jsonb_array_length(v_src) = 0 then
      v := v || 'sources'::text;
    else
      if exists (select 1 from jsonb_array_elements(v_src) e where kafaa_fs49_blank(e -> 'label')) then v := v || 'source_label'::text; end if;
      if exists (select 1 from jsonb_array_elements(v_src) e where jsonb_typeof(e -> 'url') is distinct from 'string' or not ((e ->> 'url') ~ E'^https://[^ \t\n\r]+$')) then
        v := v || 'source_url'::text;
      end if;
      if exists (select 1 from jsonb_array_elements(v_src) e where not (case when jsonb_typeof(e -> 'year') = 'number'
                   then (e ->> 'year')::numeric = trunc((e ->> 'year')::numeric) and (e ->> 'year')::numeric between 1990 and 2100 else false end)) then
        v := v || 'source_year'::text;
      end if;
      if exists (select 1 from jsonb_array_elements(v_src) e where jsonb_typeof(e -> 'as_of') is distinct from 'string' or not ((e ->> 'as_of') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')) then
        v := v || 'source_as_of'::text;
      end if;
    end if;
  end if;
  if p_refs and exists (select 1 from jsonb_array_elements_text(v_dr) d where not exists (select 1 from kafaa_ai_drills x where x.id = d)) then
    v := v || 'drill_unknown'::text;
  end if;
  return v;
end $$;

-- The guard: every insert or update of an HU card or OE lesson, by any writer (direct RLS writes and migrations alike). SECURITY DEFINER
-- so the internal rule functions run for API writers; the first problem code is in the message (kafaa_fs49: <code> (<id>)).
create or replace function kafaa_fs49_content_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_refs boolean := coalesce(current_setting('kafaa.seeding', true), '') <> 'on';
  v text[];
begin
  if tg_table_name = 'kafaa_hu_tools' then v := kafaa_fs49_hu_problems(to_jsonb(new), v_refs);
  else v := kafaa_fs49_lesson_problems(to_jsonb(new), v_refs);
  end if;
  if cardinality(v) > 0 then
    raise exception 'kafaa_fs49: % (%)', v[1], new.id using errcode = 'check_violation';
  end if;
  return new;
end $$;

revoke execute on function kafaa_fs49_cue_ids() from public, anon, authenticated;
revoke execute on function kafaa_fs49_blank(jsonb) from public, anon, authenticated;
revoke execute on function kafaa_fs49_bi_ok(jsonb) from public, anon, authenticated;
revoke execute on function kafaa_fs49_hu_problems(jsonb, boolean) from public, anon, authenticated;
revoke execute on function kafaa_fs49_lesson_problems(jsonb, boolean) from public, anon, authenticated;
revoke execute on function kafaa_fs49_content_guard() from public, anon, authenticated;

