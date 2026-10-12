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

