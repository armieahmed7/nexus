-- [FS wave E · E5 · FS49] Safety culture for an AI-augmented plant (M08).
-- Extends questioning attitude and conservative decision-making with AI and automation examples (kafaa_sc_traits.ai_*), adds AI-era HU
-- tool cards (automation bias, mode awareness, over-reliance and skill fade, verify against the controlled source) and an "AI in the loop"
-- angle on every classic HU tool (kafaa_hu_tools), and a sourced set of international lessons on automation and digital systems
-- (kafaa_oe_lessons.topic = 'ai_automation', every one with an https source, the source year and an as-of date).
-- RBAC unchanged (existing M08 rules): HU tools public + internal_content R, written directly by internal_content W (editors, instructors,
-- the training manager); OE lessons internal_content R/W. No RPC, no new policy resource, nothing on /speak-up (no telemetry added).
-- Content rule (every HU card in EN and AR, links at least one FS37 drill or OE lesson, known situation cues; sourced AI lessons) is
-- enforced for every writer by the BEFORE INSERT OR UPDATE trigger kafaa_fs49_content_guard, which calls
-- kafaa_fs49_hu_problems / kafaa_fs49_lesson_problems (= huCardProblems / lessonProblems in src/modules/m08/aiCulture.ts). References
-- (drills, lessons, traits) are checked except while kafaa.seeding is on (the seed loads M08 rows before the FS37 drills).
-- Existing live rows (hu-1..hu-8, trait-2, trait-5) receive the FS49 values through guarded updates below (only while still at the
-- defaults); the new rows (4 HU cards, 7 lessons) come from the seed with insert ... on conflict (id) do nothing (load the lessons before
-- the HU cards, or set kafaa.seeding, so the reference check finds them).
-- Seed: scripts/seed/ext/fs49-ai-safety-culture.mjs. PGlite parity and checks: scripts/validate/fs55-ai-safety-culture.mjs.
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.

-- ───────────── Columns on M08 tables (generated column DDL, additive)
alter table kafaa_sc_traits add column if not exists ai_behaviours jsonb not null default '[]'::jsonb;
alter table kafaa_sc_traits add column if not exists ai_prompts jsonb not null default '[]'::jsonb;
alter table kafaa_sc_traits add column if not exists ai_hu_ids text[] not null default '{}'::text[];
alter table kafaa_hu_tools add column if not exists topic text not null default 'classic' check (topic in ('classic', 'ai_automation'));
alter table kafaa_hu_tools add column if not exists sort integer not null default 0;
alter table kafaa_hu_tools add column if not exists ai_en text not null default '';
alter table kafaa_hu_tools add column if not exists ai_ar text not null default '';
alter table kafaa_hu_tools add column if not exists trap_en text not null default '';
alter table kafaa_hu_tools add column if not exists trap_ar text not null default '';
alter table kafaa_hu_tools add column if not exists practice jsonb not null default '[]'::jsonb;
alter table kafaa_hu_tools add column if not exists example_en text not null default '';
alter table kafaa_hu_tools add column if not exists example_ar text not null default '';
alter table kafaa_hu_tools add column if not exists cues text[] not null default '{}'::text[];
alter table kafaa_hu_tools add column if not exists trait_ids text[] not null default '{}'::text[];
alter table kafaa_hu_tools add column if not exists drill_ids text[] not null default '{}'::text[];
alter table kafaa_hu_tools add column if not exists lesson_ids text[] not null default '{}'::text[];
alter table kafaa_oe_lessons add column if not exists topic text not null default 'general' check (topic in ('general', 'ai_automation'));
alter table kafaa_oe_lessons add column if not exists sources jsonb not null default '[]'::jsonb;
alter table kafaa_oe_lessons add column if not exists hu_ids text[] not null default '{}'::text[];
alter table kafaa_oe_lessons add column if not exists drill_ids text[] not null default '{}'::text[];
create index if not exists kafaa_hu_tools_topic_idx on kafaa_hu_tools (topic);
create index if not exists kafaa_oe_lessons_topic_idx on kafaa_oe_lessons (topic);

-- ───────────── Existing rows: the FS49 values (guarded: only rows still at the defaults change; same values as the seed builder)
update kafaa_hu_tools set topic = 'classic', sort = 10, ai_en = 'With AI in the loop: Stop before acting on a tool''s output, Think about what you expected, Act from the controlled procedure, Review the result against the plant.', ai_ar = 'مع الذكاء الاصطناعي: توقف قبل التصرف بناءً على مخرَج أداة، وفكّر فيما توقعته، ونفّذ من الإجراء الخاضع للرقابة، وراجع النتيجة مقابل المحطة.',
  cues = array['time_pressure', 'routine']::text[], trait_ids = array['trait-1']::text[], drill_ids = array['ad-valve-lineup']::text[], lesson_ids = array['oe-ai-01']::text[]
  where id = 'hu-1' and ai_en = '' and cardinality(drill_ids) = 0 and cardinality(lesson_ids) = 0;
update kafaa_hu_tools set topic = 'classic', sort = 20, ai_en = 'When you pass on a tool''s output, say where it came from ("the summariser says..."); the receiver repeats it back and you confirm.', ai_ar = 'عندما تنقل مخرَج أداة، اذكر مصدره («يقول الملخِّص...»)، فيكرره المستلم وتؤكده أنت.',
  cues = array['handover', 'translation']::text[], trait_ids = array['trait-3']::text[], drill_ids = array['ad-shift-turnover']::text[], lesson_ids = '{}'::text[]
  where id = 'hu-2' and ai_en = '' and cardinality(drill_ids) = 0 and cardinality(lesson_ids) = 0;
update kafaa_hu_tools set topic = 'classic', sort = 30, ai_en = 'The controlled procedure is the authority, never a summary of it: stop when a tool''s version and the procedure differ.', ai_ar = 'الإجراء الخاضع للرقابة هو المرجع لا ملخصه: توقف حين تختلف نسخة الأداة عن الإجراء.',
  cues = array['controlled_source', 'summary']::text[], trait_ids = array['trait-10']::text[], drill_ids = array['ad-feedwater-sample']::text[], lesson_ids = array['oe-ai-04']::text[]
  where id = 'hu-3' and ai_en = '' and cardinality(drill_ids) = 0 and cardinality(lesson_ids) = 0;
update kafaa_hu_tools set topic = 'classic', sort = 40, ai_en = 'Brief which tools will be used, what each is approved for, and which steps you will check by hand.', ai_ar = 'اذكر في الإحاطة الأدوات التي ستُستخدم وما اعتُمدت له كل أداة والخطوات التي ستتحقق منها يدوياً.',
  cues = array['recommendation', 'routine']::text[], trait_ids = array['trait-10']::text[], drill_ids = array['ad-rwp-briefing']::text[], lesson_ids = array['oe-ai-04']::text[]
  where id = 'hu-4' and ai_en = '' and cardinality(drill_ids) = 0 and cardinality(lesson_ids) = 0;
update kafaa_hu_tools set topic = 'classic', sort = 50, ai_en = 'Question AI outputs like any other input: how does the tool know, and what would prove it wrong? When unsure, stop.', ai_ar = 'تساءل عن مخرجات الذكاء الاصطناعي كأي مُدخل آخر: كيف تعرف الأداة، وما الذي قد يثبت خطأها؟ وعند الشك توقف.',
  cues = array['disagree', 'confident']::text[], trait_ids = array['trait-2']::text[], drill_ids = array['ad-shift-turnover']::text[], lesson_ids = array['oe-ai-03']::text[]
  where id = 'hu-5' and ai_en = '' and cardinality(drill_ids) = 0 and cardinality(lesson_ids) = 0;
update kafaa_hu_tools set topic = 'classic', sort = 60, ai_en = 'A tool is not a peer: a colleague still confirms the intended action, especially when a tool prepared it.', ai_ar = 'الأداة ليست زميلاً: ما زال على زميل أن يؤكد الإجراء المقصود، خصوصاً حين تكون أداة قد أعدّته.',
  cues = array['autofill', 'recommendation']::text[], trait_ids = array['trait-1']::text[], drill_ids = array['ad-mov-pm']::text[], lesson_ids = '{}'::text[]
  where id = 'hu-6' and ai_en = '' and cardinality(drill_ids) = 0 and cardinality(lesson_ids) = 0;
update kafaa_hu_tools set topic = 'classic', sort = 70, ai_en = 'An AI check is not an independent verification: the second check is done separately by a qualified person.', ai_ar = 'التحقق بالذكاء الاصطناعي ليس تحققاً مستقلاً: يجري التحقق الثاني شخص مؤهل بشكل منفصل.',
  cues = array['autofill', 'summary']::text[], trait_ids = array['trait-10']::text[], drill_ids = array['ad-requisition-qa']::text[], lesson_ids = array['oe-ai-05']::text[]
  where id = 'hu-7' and ai_en = '' and cardinality(drill_ids) = 0 and cardinality(lesson_ids) = 0;
update kafaa_hu_tools set topic = 'classic', sort = 80, ai_en = 'Mark progress on the controlled procedure, not on a tool-generated checklist.', ai_ar = 'علّم التقدم على الإجراء الخاضع للرقابة لا على قائمة تحقق ولّدتها أداة.',
  cues = array['autofill', 'handover']::text[], trait_ids = array['trait-10']::text[], drill_ids = array['ad-mov-pm']::text[], lesson_ids = '{}'::text[]
  where id = 'hu-8' and ai_en = '' and cardinality(drill_ids) = 0 and cardinality(lesson_ids) = 0;
update kafaa_sc_traits set ai_behaviours = '[{"en":"Asks how the tool knows before using an output: which data, which revision, which time window.","ar":"يسأل كيف تعرف الأداة قبل استخدام مخرَجها: أي بيانات، وأي مراجعة، وأي فترة زمنية."},{"en":"Treats a confident, fluent answer as a claim to check, not as a fact.","ar":"يعامل الإجابة الواثقة السلسة كادعاء يُتحقق منه لا كحقيقة."},{"en":"Stops when a tool and a plant indication disagree, and resolves it with the controlled source.","ar":"يتوقف حين تختلف الأداة ومؤشر المحطة، ويحسم الأمر بالمصدر الخاضع للرقابة."},{"en":"Reports a wrong or surprising output so others learn from it.","ar":"يبلّغ عن المخرَج الخاطئ أو المفاجئ ليتعلم منه الآخرون."}]'::jsonb,
  ai_prompts = '[{"en":"When did a tool last tell you something you did not expect? What did you do next?","ar":"متى أخبرتك أداة آخر مرة بشيء لم تتوقعه؟ وماذا فعلت بعدها؟"},{"en":"Which tool output would you be least likely to question, and why?","ar":"أي مخرَج لأداة هو الأقل احتمالاً أن تتساءل عنه، ولماذا؟"}]'::jsonb,
  ai_hu_ids = array['hu-ai-bias', 'hu-ai-verify', 'hu-5']::text[]
  where id = 'trait-2' and ai_behaviours = '[]'::jsonb and cardinality(ai_hu_ids) = 0;
update kafaa_sc_traits set ai_behaviours = '[{"en":"When a model''s recommendation and conservative judgement differ, takes the conservative path and escalates.","ar":"حين تختلف توصية النموذج عن الحكم المتحفظ، يسلك الطريق المتحفظ ويصعّد الأمر."},{"en":"Uses a tool to inform a decision, never to own it: the decision and its basis stay with a person.","ar":"يستخدم الأداة لدعم القرار لا لامتلاكه: يبقى القرار وأساسه لدى شخص."},{"en":"Says in the brief which parts of a decision rest on a tool''s output.","ar":"يوضح في الإحاطة أي أجزاء القرار تستند إلى مخرَج أداة."},{"en":"Does not let time pressure turn a tool''s all-clear into permission to proceed.","ar":"لا يسمح لضغط الوقت بأن يحوّل إشارة «لا مشكلة» من أداة إلى إذن بالمضي."}]'::jsonb,
  ai_prompts = '[{"en":"Think of a decision a tool informed. Could you explain its basis without the tool?","ar":"فكّر في قرار دعمته أداة. هل يمكنك شرح أساسه من دون الأداة؟"},{"en":"What would make you set a tool''s recommendation aside?","ar":"ما الذي يجعلك تضع توصية الأداة جانباً؟"}]'::jsonb,
  ai_hu_ids = array['hu-ai-reliance', 'hu-ai-mode', 'hu-4']::text[]
  where id = 'trait-5' and ai_behaviours = '[]'::jsonb and cardinality(ai_hu_ids) = 0;

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

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'kafaa_fs49_hu_tools_guard') then
    create trigger kafaa_fs49_hu_tools_guard before insert or update on kafaa_hu_tools for each row execute function kafaa_fs49_content_guard();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'kafaa_fs49_oe_lessons_guard') then
    create trigger kafaa_fs49_oe_lessons_guard before insert or update on kafaa_oe_lessons for each row execute function kafaa_fs49_content_guard();
  end if;
end $$;
