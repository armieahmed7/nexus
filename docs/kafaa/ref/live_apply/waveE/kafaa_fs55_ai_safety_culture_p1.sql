-- live apply part kafaa_fs55_ai_safety_culture_p1 (from supabase/migrations/20261010255001_kafaa_fs55_ai_safety_culture.sql, part 1 of 3)
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

