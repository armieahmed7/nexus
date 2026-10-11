-- FS wave C · E1 (branch fsCe1, module M19) · FS17 Future-skill learning pathways + FS18 Curated, outcome-gated external catalogue.
-- Tables: kafaa_pathways + kafaa_pathway_steps (a pathway per FS02 future skill and level L1-L3: learn, practice and assess steps, a 3-6 month
-- envelope and a weekly hour cost; staff read published rows, training staff and auditors drafts; written only by kafaa_save_pathway),
-- kafaa_pathway_enrolments (my progress; own rows), kafaa_pathway_gaps (the FS57 backlog of steps that resolve to nothing; training staff),
-- kafaa_external_resources + kafaa_catalogue_criteria (FS18 catalogue and its published admission criteria), kafaa_external_completions
-- (my self-declared completions; own rows).
-- Rules (mirror of src/modules/m19/pathways.ts, proven equal by scripts/validate/fs31-pathways.mjs): kafaa_pw_weeks = envelopeWeeks,
-- kafaa_pw_problems = pathwayProblems, kafaa_pw_resolve = resolvePathway (steps resolve at run time: pins, then courses whose objectives
-- carry { skill_id, level }, published external resources, open gigs, current micro-credentials and FS10 fitness areas), kafaa_pw_progress
-- = pathwayProgress(recordsOf()), kafaa_pw_peer = peerStats (suppressed under the minimum group size), kafaa_xr_check = catalogueCheck.
-- RPCs: kafaa_pathway_catalogue, kafaa_pathway_detail (internal_content R), kafaa_start_pathway / kafaa_complete_pathway / kafaa_withdraw_pathway
-- (skills_profile Own), kafaa_save_pathway / kafaa_refresh_pathway_gaps / kafaa_save_external_resource / kafaa_publish_external_resource
-- (refused unless the published criteria are met) / kafaa_retire_external_resource (training manager), kafaa_check_external_resource,
-- kafaa_record_external_completion (skills_profile Own; one F30 xAPI "experienced" statement, never skill evidence). Each write writes one
-- audit row (also on refusals); no NEXUS ledger rows.
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row. Seed rows: supabase/seed.sql
-- (live: insert ... on conflict do nothing). LocalBackend mirror: src/modules/m19/backend/local.fs17.ts.

-- ───────────── Tables (same DDL as the generated 20261008120100 schema file)
-- M19 · Future-skill learning pathway: one FS02 skill at one level (L1-L3), a 3-6 month envelope and a weekly hour cost (FS17)
create table if not exists kafaa_pathways (
  id text primary key,
  skill_id text not null,
  level integer not null,
  title_en text not null,
  title_ar text not null,
  summary_en text not null default '',
  summary_ar text not null default '',
  outcome_en text not null default '',
  outcome_ar text not null default '',
  envelope_months integer not null,
  weekly_hours numeric not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  listed boolean not null default false,
  version integer not null default 1,
  benchmark_ids text[] not null default '{}'::text[],
  sources jsonb not null default '[]'::jsonb,
  updated_by text,
  updated_at timestamptz not null default now(),
  sort integer not null default 0
);
comment on table kafaa_pathways is '[M19] Future-skill learning pathway: one FS02 skill at one level (L1-L3), a 3-6 month envelope and a weekly hour cost (FS17)';

-- M19 · Pathway step in sequence (learn, practice, assess) with hours; content resolves at run time from pins and items that teach the skill at the level (FS17)
create table if not exists kafaa_pathway_steps (
  id text primary key,
  pathway_id text not null,
  n integer not null,
  kind text not null check (kind in ('learn', 'practice', 'assess')),
  title_en text not null,
  title_ar text not null,
  hours numeric not null,
  pins text[] not null default '{}'::text[],
  auto boolean not null default true,
  version integer not null default 1
);
comment on table kafaa_pathway_steps is '[M19] Pathway step in sequence (learn, practice, assess) with hours; content resolves at run time from pins and items that teach the skill at the level (FS17)';

-- M19 · My progress on a pathway: started, completed or left; step completion is derived from my records, never typed in (FS17; private)
create table if not exists kafaa_pathway_enrolments (
  id text primary key,
  person_id text not null,
  pathway_id text not null,
  status text not null default 'active' check (status in ('active', 'completed', 'withdrawn')),
  started_on date not null,
  completed_on date,
  withdrawn_on date,
  withdrawn_reason text,
  steps_done jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
comment on table kafaa_pathway_enrolments is '[M19] My progress on a pathway: started, completed or left; step completion is derived from my records, never typed in (FS17; private)';

-- M19 · Gap backlog: a pathway step with no content that teaches its skill at its level ("requested"; feeds FS57) (FS17)
create table if not exists kafaa_pathway_gaps (
  id text primary key,
  pathway_id text not null,
  step_id text not null,
  skill_id text not null,
  level integer not null,
  kind text not null check (kind in ('learn', 'practice', 'assess')),
  status text not null default 'open' check (status in ('open', 'filled')),
  first_seen date not null,
  last_checked date not null,
  filled_on date
);
comment on table kafaa_pathway_gaps is '[M19] Gap backlog: a pathway step with no content that teaches its skill at its level ("requested"; feeds FS57) (FS17)';

-- M19 · External learning resource (IAEA, WNU, NEA, universities, AI courses): provider, hours, cost band, languages, skills taught, as-of; published only when it meets the criteria (FS18)
create table if not exists kafaa_external_resources (
  id text primary key,
  title_en text not null,
  title_ar text not null,
  provider_en text not null,
  provider_ar text not null,
  provider_url text not null,
  url text not null,
  format text not null check (format in ('elearning', 'mooc', 'course', 'fellowship', 'programme', 'webinar', 'reading')),
  hours numeric,
  duration_en text not null default '',
  duration_ar text not null default '',
  cost_band text not null check (cost_band in ('free', 'low', 'medium', 'high', 'varies')),
  languages text[] not null default '{}'::text[],
  skills jsonb not null default '[]'::jsonb,
  has_assessment boolean not null default false,
  summary_en text not null default '',
  summary_ar text not null default '',
  criteria jsonb not null default '{}'::jsonb,
  criteria_note_en text not null default '',
  criteria_note_ar text not null default '',
  as_of date not null,
  sources jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  listed boolean not null default false,
  version integer not null default 1,
  published_by text,
  published_on date,
  retired_reason text,
  retired_on date,
  created_by text,
  updated_by text,
  updated_at timestamptz not null default now(),
  sort integer not null default 0
);
comment on table kafaa_external_resources is '[M19] External learning resource (IAEA, WNU, NEA, universities, AI courses): provider, hours, cost band, languages, skills taught, as-of; published only when it meets the criteria (FS18)';

-- M19 · Published admission criteria for the external catalogue (relevance, provider standing, assessment, language) with a 0-3 scale and the minimum to publish (FS18)
create table if not exists kafaa_catalogue_criteria (
  id text primary key,
  name_en text not null,
  name_ar text not null,
  question_en text not null,
  question_ar text not null,
  scale jsonb not null default '[]'::jsonb,
  min_score integer not null default 0,
  required boolean not null default true,
  status text not null default 'published' check (status in ('published', 'retired')),
  benchmark_ids text[] not null default '{}'::text[],
  sources jsonb not null default '[]'::jsonb,
  as_of date not null,
  sort integer not null default 0
);
comment on table kafaa_catalogue_criteria is '[M19] Published admission criteria for the external catalogue (relevance, provider standing, assessment, language) with a 0-3 scale and the minimum to publish (FS18)';

-- M19 · My completion of an external resource: recorded through xAPI as "experienced", self-declared until verified (FS79); never verified evidence (FS18; private)
create table if not exists kafaa_external_completions (
  id text primary key,
  person_id text not null,
  resource_id text not null,
  completed_on date not null,
  note text,
  evidence text not null default 'self_declared' check (evidence in ('self_declared', 'verified')),
  statement_id text,
  created_at timestamptz not null default now()
);
comment on table kafaa_external_completions is '[M19] My completion of an external resource: recorded through xAPI as "experienced", self-declared until verified (FS79); never verified evidence (FS18; private)';

do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_pathways_skill_id_fk') then alter table kafaa_pathways add constraint kafaa_pathways_skill_id_fk foreign key (skill_id) references kafaa_skills(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_pathway_steps_pathway_id_fk') then alter table kafaa_pathway_steps add constraint kafaa_pathway_steps_pathway_id_fk foreign key (pathway_id) references kafaa_pathways(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_pathway_enrolments_person_id_fk') then alter table kafaa_pathway_enrolments add constraint kafaa_pathway_enrolments_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_pathway_enrolments_pathway_id_fk') then alter table kafaa_pathway_enrolments add constraint kafaa_pathway_enrolments_pathway_id_fk foreign key (pathway_id) references kafaa_pathways(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_pathway_gaps_pathway_id_fk') then alter table kafaa_pathway_gaps add constraint kafaa_pathway_gaps_pathway_id_fk foreign key (pathway_id) references kafaa_pathways(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_pathway_gaps_step_id_fk') then alter table kafaa_pathway_gaps add constraint kafaa_pathway_gaps_step_id_fk foreign key (step_id) references kafaa_pathway_steps(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_pathway_gaps_skill_id_fk') then alter table kafaa_pathway_gaps add constraint kafaa_pathway_gaps_skill_id_fk foreign key (skill_id) references kafaa_skills(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_external_completions_person_id_fk') then alter table kafaa_external_completions add constraint kafaa_external_completions_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_external_completions_resource_id_fk') then alter table kafaa_external_completions add constraint kafaa_external_completions_resource_id_fk foreign key (resource_id) references kafaa_external_resources(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_pathways_skill_id_idx on kafaa_pathways (skill_id);
create index if not exists kafaa_pathways_status_idx on kafaa_pathways (status);
create index if not exists kafaa_pathway_steps_pathway_id_idx on kafaa_pathway_steps (pathway_id);
create index if not exists kafaa_pathway_enrolments_person_id_idx on kafaa_pathway_enrolments (person_id);
create index if not exists kafaa_pathway_enrolments_pathway_id_idx on kafaa_pathway_enrolments (pathway_id);
create index if not exists kafaa_pathway_enrolments_status_idx on kafaa_pathway_enrolments (status);
create index if not exists kafaa_pathway_gaps_pathway_id_idx on kafaa_pathway_gaps (pathway_id);
create index if not exists kafaa_pathway_gaps_step_id_idx on kafaa_pathway_gaps (step_id);
create index if not exists kafaa_pathway_gaps_skill_id_idx on kafaa_pathway_gaps (skill_id);
create index if not exists kafaa_pathway_gaps_status_idx on kafaa_pathway_gaps (status);
create index if not exists kafaa_external_resources_status_idx on kafaa_external_resources (status);
create index if not exists kafaa_external_completions_person_id_idx on kafaa_external_completions (person_id);
create index if not exists kafaa_external_completions_resource_id_idx on kafaa_external_completions (resource_id);

-- ───────────── RLS: published pathways and resources for staff (internal_content R), drafts for training staff and auditors; own progress
alter table kafaa_pathways enable row level security;
alter table kafaa_pathway_steps enable row level security;
alter table kafaa_pathway_enrolments enable row level security;
alter table kafaa_pathway_gaps enable row level security;
alter table kafaa_external_resources enable row level security;
alter table kafaa_catalogue_criteria enable row level security;
alter table kafaa_external_completions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_pathways' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_pathways for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_pathway_steps' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_pathway_steps for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_pathway_enrolments' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_pathway_enrolments for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_pathway_gaps' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_pathway_gaps for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_external_resources' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_external_resources for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_catalogue_criteria' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_catalogue_criteria for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_external_completions' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_external_completions for select to anon, authenticated using (false)'; end if;
end $$;
alter policy kafaa_read on kafaa_pathways using (kafaa_rule_read('internal_content', null::text, null::text, listed)
    or kafaa_rule_read('sat', null::text, null::text, true)
    or kafaa_rule_read('audit_log', null::text, null::text, true));
alter policy kafaa_read on kafaa_pathway_steps using (kafaa_rule_read('internal_content', null::text, null::text, true)
    or kafaa_rule_read('sat', null::text, null::text, true)
    or kafaa_rule_read('audit_log', null::text, null::text, true));
alter policy kafaa_read on kafaa_pathway_enrolments using (kafaa_rule_read('own_profile', person_id, null::text, true));
alter policy kafaa_read on kafaa_pathway_gaps using (kafaa_rule_read('sat', null::text, null::text, true)
    or kafaa_rule_read('audit_log', null::text, null::text, true));
alter policy kafaa_read on kafaa_external_resources using (kafaa_rule_read('internal_content', null::text, null::text, listed)
    or kafaa_rule_read('sat', null::text, null::text, true)
    or kafaa_rule_read('audit_log', null::text, null::text, true));
alter policy kafaa_read on kafaa_catalogue_criteria using (kafaa_rule_read('internal_content', null::text, null::text, true)
    or kafaa_rule_read('sat', null::text, null::text, true)
    or kafaa_rule_read('audit_log', null::text, null::text, true));
alter policy kafaa_read on kafaa_external_completions using (kafaa_rule_read('own_profile', person_id, null::text, true));
revoke insert, update, delete on kafaa_pathways, kafaa_pathway_steps, kafaa_pathway_enrolments, kafaa_pathway_gaps, kafaa_external_resources, kafaa_catalogue_criteria, kafaa_external_completions from anon, authenticated;
grant select on kafaa_pathways, kafaa_pathway_steps, kafaa_pathway_enrolments, kafaa_pathway_gaps, kafaa_external_resources, kafaa_catalogue_criteria, kafaa_external_completions to anon, authenticated;

-- ───────────── Integrity checks (mirror of pathwayProblems / catalogueCheck limits)
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_pathways_fs17_ck') then
  alter table kafaa_pathways add constraint kafaa_pathways_fs17_ck check (level between 1 and 3 and envelope_months between 3 and 6 and weekly_hours between 0.5 and 10 and listed = (status = 'published')); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_pathway_steps_fs17_ck') then
  alter table kafaa_pathway_steps add constraint kafaa_pathway_steps_fs17_ck check (hours > 0 and hours <= 200 and n between 1 and 8); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_external_resources_fs18_ck') then
  alter table kafaa_external_resources add constraint kafaa_external_resources_fs18_ck check (listed = (status = 'published')
    and url ~ '^https://[^[:space:]/$.?#][^[:space:]]*$' and provider_url ~ '^https://[^[:space:]/$.?#][^[:space:]]*$'
    and (status <> 'retired' or (retired_reason is not null and retired_on is not null))); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_external_completions_fs18_ck') then
  alter table kafaa_external_completions add constraint kafaa_external_completions_fs18_ck check (evidence = 'self_declared' or evidence = 'verified'); end if; end $$;

-- ───────────── Internal helpers (not executable by API roles). Mirror of src/modules/m19/pathways.ts.
create or replace function kafaa_pw_msgs() returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object(
    'not_signed_in', 'Sign in to use future-skill pathways', 'forbidden', 'Future-skill pathways are for ENEC staff',
    'forbidden_edit', 'Only the training manager edits pathways and the external catalogue', 'not_found', 'Pathway not found',
    'already', 'You already follow this pathway', 'held', 'You already hold this skill at this level',
    'too_many', 'You can follow up to three pathways at a time; finish or leave one first', 'steps_open', 'Some steps are not done yet',
    'not_active', 'This pathway is not active for you', 'invalid', 'Check the pathway: ', 'xr_not_found', 'Resource not found',
    'xr_invalid', 'Check the resource: ', 'xr_criteria', 'The resource does not meet the published criteria: ', 'xr_reason', 'Give a reason of 5 to 300 characters',
    'xr_not_published', 'Only published resources can be recorded', 'xr_date', 'The completion date must be a real date, not in the future',
    'xr_duplicate', 'You already recorded this resource', 'xr_note', 'Notes are limited to 300 characters')
$$;
create or replace function kafaa_pw_weeks(p_months numeric) returns integer language sql immutable set search_path = public as $$
  select round(p_months * 52 / 12.0)::integer
$$;
create or replace function kafaa_pw_is_date(v text) returns boolean language plpgsql immutable set search_path = public as $$
begin
  if v is null or v !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
  return to_char(v::date, 'YYYY-MM-DD') = v;
exception when others then return false;
end $$;
create or replace function kafaa_pw_len(v jsonb, lo integer, hi integer) returns boolean language sql immutable set search_path = public as $$
  select coalesce(jsonb_typeof(v) = 'string' and length(btrim(v #>> '{}', E' \t\r\n')) between lo and hi, false)
$$;
create or replace function kafaa_pw_is_int(v jsonb) returns boolean language sql immutable set search_path = public as $$
  select coalesce(jsonb_typeof(v) = 'number' and (v #>> '{}')::numeric = trunc((v #>> '{}')::numeric), false)
$$;
create or replace function kafaa_pw_numv(v jsonb) returns numeric language sql immutable set search_path = public as $$
  select case when jsonb_typeof(v) = 'number' then (v #>> '{}')::numeric end
$$;
-- pathwaySkillOk(): an FS02 future skill, not obsolete, never in the security area
create or replace function kafaa_pw_skill_ok(p_skill text) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select s.fs_area is not null and s.lifecycle <> 'obsolete' and s.area <> 'security' from kafaa_skills s where s.id = p_skill), false)
$$;
-- pathwayProblems(): codes in the TS order
create or replace function kafaa_pw_problems(p jsonb) returns text[] language plpgsql stable security definer set search_path = public as $$
declare out text[] := '{}'; v_steps jsonb := p->'steps'; v_ok boolean; v_order integer[]; v_total numeric; s jsonb; i integer;
begin
  if not kafaa_pw_skill_ok(case when jsonb_typeof(p->'skill_id') = 'string' then p->>'skill_id' end) then out := out || 'skill'::text; end if;
  if not (kafaa_pw_is_int(p->'level') and kafaa_pw_numv(p->'level') between 1 and 3) then out := out || 'level'::text; end if;
  if not (kafaa_pw_len(p->'title_en', 3, 140) and kafaa_pw_len(p->'title_ar', 3, 140)) then out := out || 'title'::text; end if;
  if not (kafaa_pw_is_int(p->'envelope_months') and kafaa_pw_numv(p->'envelope_months') between 3 and 6) then out := out || 'envelope'::text; end if;
  if not coalesce(jsonb_typeof(p->'weekly_hours') = 'number' and kafaa_pw_numv(p->'weekly_hours') between 0.5 and 10, false) then out := out || 'weekly'::text; end if;
  v_ok := coalesce(jsonb_typeof(v_steps) = 'array' and jsonb_array_length(v_steps) between 3 and 8, false);
  if v_ok then
    for s in select x from jsonb_array_elements(v_steps) x loop
      if not coalesce(jsonb_typeof(s) = 'object' and coalesce(s->>'kind', '') in ('learn', 'practice', 'assess') and jsonb_typeof(s->'hours') = 'number'
        and kafaa_pw_numv(s->'hours') > 0 and kafaa_pw_numv(s->'hours') <= 200 and kafaa_pw_len(s->'title_en', 3, 140) and kafaa_pw_len(s->'title_ar', 3, 140), false) then v_ok := false; end if;
    end loop;
  end if;
  if not v_ok then out := out || 'steps'::text; end if;
  if v_ok then
    select array_agg(case x->>'kind' when 'learn' then 0 when 'practice' then 1 else 2 end order by o) into v_order from jsonb_array_elements(v_steps) with ordinality t(x, o);
    v_ok := true;
    for i in 2 .. array_length(v_order, 1) loop if v_order[i] < v_order[i - 1] then v_ok := false; end if; end loop;
    if not v_ok or not (0 = any(v_order) and 1 = any(v_order) and 2 = any(v_order)) then out := out || 'sequence'::text; end if;
    if kafaa_pw_is_int(p->'envelope_months') and jsonb_typeof(p->'weekly_hours') = 'number' and not ('envelope' = any(out)) and not ('weekly' = any(out)) then
      select round(sum((x->>'hours')::numeric), 2) into v_total from jsonb_array_elements(v_steps) x;
      if v_total > round(kafaa_pw_weeks(kafaa_pw_numv(p->'envelope_months')) * kafaa_pw_numv(p->'weekly_hours'), 2) then out := out || 'over_envelope'::text; end if;
    end if;
    if exists (select 1 from jsonb_array_elements(v_steps) x where x ? 'pins' and jsonb_typeof(x->'pins') <> 'null' and (jsonb_typeof(x->'pins') <> 'array' or jsonb_array_length(x->'pins') > 6
      or exists (select 1 from jsonb_array_elements(x->'pins') q where jsonb_typeof(q) <> 'string' or (q #>> '{}') !~ '^(course|external|opportunity|credential|fitness):[A-Za-z0-9._:-]{1,80}$'))) then
      out := out || 'pins'::text; end if;
  end if;
  return out;
end $$;

-- One resolved item (ResolvedItem). p_type in course | external | opportunity | credential | fitness.
create or replace function kafaa_pw_item(p_type text, r jsonb, p_pinned boolean) returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object('type', p_type, 'id', r->>'id',
    'title_en', case when p_type = 'fitness' then r->>'name_en' else r->>'title_en' end,
    'title_ar', coalesce(nullif(case when p_type = 'fitness' then r->>'name_ar' else r->>'title_ar' end, ''), case when p_type = 'fitness' then r->>'name_en' else r->>'title_en' end),
    'hours', case p_type when 'course' then r->'duration_hours' when 'external' then r->'hours' when 'opportunity' then r->'hours_week' when 'credential' then r->'hours' else 'null'::jsonb end,
    'external', p_type = 'external', 'pinned', p_pinned,
    'link', case p_type when 'course' then '/learn/course/' || (r->>'id') when 'external' then '/learn/external?item=' || (r->>'id') when 'opportunity' then '/opportunities/' || (r->>'id')
      when 'credential' then '/my/skills/credentials' else '/my/ai-fluency/check' end)
$$;
-- A pinned item that is live right now, or null.
create or replace function kafaa_pw_pin(p_ref text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare i integer := strpos(p_ref, ':'); t text; v_id text; r jsonb;
begin
  if i < 2 then return null; end if;
  t := substr(p_ref, 1, i - 1); v_id := substr(p_ref, i + 1);
  if t = 'course' then select to_jsonb(c) into r from kafaa_courses c where c.id = v_id and c.audience in ('staff', 'public');
  elsif t = 'external' then select to_jsonb(x) into r from kafaa_external_resources x where x.id = v_id and x.status = 'published';
  elsif t = 'opportunity' then select to_jsonb(o) into r from kafaa_opportunities o where o.id = v_id and o.status = 'open' and coalesce(o.listed, true) and o.kind not in ('security', 'protected_area', 'cyber', 'safeguards');
  elsif t = 'credential' then select to_jsonb(d) into r from kafaa_microcred_defs d where d.id = v_id and d.status = 'current';
  elsif t = 'fitness' then select to_jsonb(f) into r from kafaa_fitness_areas f where f.id = v_id;
  else return null; end if;
  if r is null then return null; end if;
  return kafaa_pw_item(t, r, true);
end $$;
-- discover(): automatic discovery for one step, in type order then id
create or replace function kafaa_pw_discover(p_kind text, p_skill text, p_level integer) returns jsonb language sql stable security definer set search_path = public as $$
  with c as (
    select c.* from kafaa_courses c where c.audience in ('staff', 'public')
      and exists (select 1 from jsonb_array_elements(case when jsonb_typeof(c.objectives) = 'array' then c.objectives else '[]'::jsonb end) o
                  where jsonb_typeof(o) = 'object' and o->>'skill_id' = p_skill and coalesce((o->>'level')::numeric, 1) = p_level)
  ), x as (
    select x.* from kafaa_external_resources x where x.status = 'published'
      and exists (select 1 from jsonb_array_elements(case when jsonb_typeof(x.skills) = 'array' then x.skills else '[]'::jsonb end) o
                  where jsonb_typeof(o) = 'object' and o->>'skill_id' = p_skill and (o->>'level')::numeric = p_level)
  ), items as (
    select 1 as t, c.id, kafaa_pw_item('course', to_jsonb(c), false) as j from c
      where (p_kind = 'learn' and c.modality in ('classroom', 'elearning', 'blended', 'external')) or (p_kind = 'practice' and c.modality in ('ojt', 'drill', 'simulator', 'clinic'))
    union all
    select 2, x.id, kafaa_pw_item('external', to_jsonb(x), false) from x
      where (p_kind = 'learn' and x.format in ('elearning', 'mooc', 'course')) or (p_kind = 'practice' and x.format in ('fellowship', 'programme')) or (p_kind = 'assess' and x.has_assessment)
    union all
    select 3, o.id, kafaa_pw_item('opportunity', to_jsonb(o), false) from kafaa_opportunities o
      where p_kind = 'practice' and p_level <= 2 and o.status = 'open' and coalesce(o.listed, true) and o.kind not in ('security', 'protected_area', 'cyber', 'safeguards') and p_skill = any(o.skills_gained)
    union all
    select 4, d.id, kafaa_pw_item('credential', to_jsonb(d), false) from kafaa_microcred_defs d
      where p_kind = 'assess' and d.status = 'current'
        and exists (select 1 from jsonb_array_elements(case when jsonb_typeof(d.alignment) = 'array' then d.alignment else '[]'::jsonb end) o where o->>'skill_id' = p_skill and (o->>'level')::numeric = p_level)
    union all
    select 5, f.id, kafaa_pw_item('fitness', to_jsonb(f), false) from kafaa_fitness_areas f
      where p_kind = 'assess' and p_level <= 2 and p_skill = any(f.skill_ids)
  )
  select coalesce(jsonb_agg(j order by t, id collate "C"), '[]'::jsonb) from items
$$;
-- resolvePathway(): every step of the pathway's current version with its live content (pins first, then discovery; at most 4)
create or replace function kafaa_pw_resolve(p_id text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare p kafaa_pathways; s kafaa_pathway_steps; v_items jsonb; v_seen text[]; v_ref text; it jsonb; v_steps jsonb := '[]'::jsonb; v_weeks integer; v_cap numeric; v_total numeric := 0; v_req integer := 0;
begin
  select * into p from kafaa_pathways where id = p_id;
  if p.id is null then return null; end if;
  for s in select * from kafaa_pathway_steps where pathway_id = p.id and version = p.version order by n, id collate "C" loop
    v_items := '[]'::jsonb; v_seen := '{}';
    foreach v_ref in array coalesce(s.pins, '{}') loop
      it := kafaa_pw_pin(v_ref);
      if it is not null and not ((it->>'type') || ':' || (it->>'id')) = any(v_seen) then
        v_seen := v_seen || ((it->>'type') || ':' || (it->>'id')); v_items := v_items || jsonb_build_array(it); end if;
    end loop;
    if coalesce(s.auto, true) then
      for it in select x from jsonb_array_elements(kafaa_pw_discover(s.kind, p.skill_id, p.level)) x loop
        if not ((it->>'type') || ':' || (it->>'id')) = any(v_seen) then v_seen := v_seen || ((it->>'type') || ':' || (it->>'id')); v_items := v_items || jsonb_build_array(it); end if;
      end loop;
    end if;
    select coalesce(jsonb_agg(x order by o), '[]'::jsonb) into v_items from jsonb_array_elements(v_items) with ordinality t(x, o) where o <= 4;
    if jsonb_array_length(v_items) = 0 then v_req := v_req + 1; end if;
    v_total := v_total + s.hours;
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step_id', s.id, 'n', s.n, 'kind', s.kind, 'title_en', s.title_en, 'title_ar', s.title_ar, 'hours', s.hours,
      'status', case when jsonb_array_length(v_items) > 0 then 'resolved' else 'requested' end, 'items', v_items));
  end loop;
  v_weeks := kafaa_pw_weeks(p.envelope_months);
  v_cap := round(v_weeks * p.weekly_hours, 2);
  v_total := round(v_total, 2);
  return jsonb_build_object('pathway_id', p.id, 'skill_id', p.skill_id, 'level', p.level, 'weeks', v_weeks, 'capacity', v_cap, 'total_hours', v_total,
    'fits', v_total <= v_cap, 'requested', v_req, 'steps', v_steps);
end $$;
-- pathwayProgress(resolvePathway(), recordsOf(person)): step done when any resolved item is done; a self-declared external counts but is labelled
create or replace function kafaa_pw_progress(p_person text, p_id text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_res jsonb := kafaa_pw_resolve(p_id); s jsonb; it jsonb; v_via text; v_self boolean; v_hit boolean; v_sd boolean; v_out jsonb := '[]'::jsonb; v_done integer := 0; v_sdn integer := 0; v_n integer := 0;
  c_courses text[]; c_ext text[]; c_ver text[]; c_opp text[]; c_cred text[]; c_fit boolean;
begin
  if v_res is null then return null; end if;
  select coalesce(array_agg(distinct course_id), '{}') into c_courses from kafaa_training_records where person_id = p_person and result in ('passed', 'completed', 'attended');
  select coalesce(array_agg(distinct resource_id), '{}') into c_ext from kafaa_external_completions where person_id = p_person;
  select coalesce(array_agg(distinct resource_id), '{}') into c_ver from kafaa_external_completions where person_id = p_person and evidence = 'verified';
  select coalesce(array_agg(distinct opportunity_id), '{}') into c_opp from kafaa_opportunity_applications where person_id = p_person and status = 'completed';
  select coalesce(array_agg(distinct def_id), '{}') into c_cred from kafaa_microcred_awards where person_id = p_person and status = 'awarded';
  select exists (select 1 from kafaa_fitness_attempts where person_id = p_person and status = 'completed') into c_fit;
  for s in select x from jsonb_array_elements(v_res->'steps') x loop
    v_n := v_n + 1; v_via := null; v_self := false;
    for it in select x from jsonb_array_elements(s->'items') x loop
      v_hit := case it->>'type' when 'course' then (it->>'id') = any(c_courses) when 'external' then (it->>'id') = any(c_ext) or (it->>'id') = any(c_ver)
        when 'opportunity' then (it->>'id') = any(c_opp) when 'credential' then (it->>'id') = any(c_cred) else c_fit end;
      if not v_hit then continue; end if;
      v_sd := (it->>'type') = 'external' and not ((it->>'id') = any(c_ver));
      if v_via is null or (v_self and not v_sd) then v_via := (it->>'type') || ':' || (it->>'id'); v_self := v_sd; end if;
    end loop;
    if v_via is not null then v_done := v_done + 1; if v_self then v_sdn := v_sdn + 1; end if; end if;
    v_out := v_out || jsonb_build_array(jsonb_build_object('step_id', s->>'step_id', 'done', v_via is not null, 'via', v_via, 'self_declared', v_via is not null and v_self));
  end loop;
  return jsonb_build_object('steps', v_out, 'done', v_done, 'total', v_n, 'pct', case when v_n > 0 then round(100.0 * v_done / v_n)::integer else 0 end,
    'self_declared', v_sdn, 'complete', v_n > 0 and v_done = v_n);
end $$;
-- peerStats(): colleagues' completion times; under p_min completions everything but a started count of p_min or more is suppressed
create or replace function kafaa_pw_peer(p_id text, p_min integer) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_started integer; v_done integer; v_med numeric;
begin
  select count(*) into v_started from kafaa_pathway_enrolments where pathway_id = p_id and status <> 'withdrawn';
  select count(*), percentile_cont(0.5) within group (order by greatest(1, ceil((completed_on - started_on)::numeric / 7)))
    into v_done, v_med from kafaa_pathway_enrolments where pathway_id = p_id and status = 'completed' and completed_on is not null and started_on is not null;
  if v_done < p_min then
    return jsonb_build_object('started', case when v_started >= p_min then v_started end, 'completed', null, 'median_weeks', null, 'suppressed', true);
  end if;
  return jsonb_build_object('started', v_started, 'completed', v_done, 'median_weeks', round(v_med * 10) / 10, 'suppressed', false);
end $$;
-- catalogueCheck(): structural problems and failing required criteria (FS18 publish gate)
create or replace function kafaa_xr_check(x jsonb, p_today date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_prob text[] := '{}'; v_fail text[]; v_sc jsonb; v_sk jsonb := x->'skills'; v_l jsonb := x->'languages'; h text := '^https://[^[:space:]/$.?#][^[:space:]]*$';
begin
  if not (kafaa_pw_len(x->'title_en', 3, 200) and kafaa_pw_len(x->'title_ar', 3, 200)) then v_prob := v_prob || 'title'::text; end if;
  if not (kafaa_pw_len(x->'provider_en', 2, 140) and kafaa_pw_len(x->'provider_ar', 2, 140)) then v_prob := v_prob || 'provider'::text; end if;
  if not (coalesce(jsonb_typeof(x->'url') = 'string' and (x->>'url') ~ h, false) and coalesce(jsonb_typeof(x->'provider_url') = 'string' and (x->>'provider_url') ~ h, false)) then v_prob := v_prob || 'url'::text; end if;
  if not coalesce(jsonb_typeof(x->'as_of') = 'string' and kafaa_pw_is_date(x->>'as_of') and (x->>'as_of') <= to_char(p_today, 'YYYY-MM-DD'), false) then v_prob := v_prob || 'as_of'::text; end if;
  if not coalesce(jsonb_typeof(v_sk) = 'array' and jsonb_array_length(v_sk) between 1 and 8 and not exists (select 1 from jsonb_array_elements(v_sk) e
      where not (jsonb_typeof(e) = 'object' and kafaa_pw_skill_ok(case when jsonb_typeof(e->'skill_id') = 'string' then e->>'skill_id' end) and kafaa_pw_is_int(e->'level') and kafaa_pw_numv(e->'level') between 1 and 3)), false) then
    v_prob := v_prob || 'skills'::text; end if;
  if not coalesce(jsonb_typeof(v_l) = 'array' and jsonb_array_length(v_l) > 0 and not exists (select 1 from jsonb_array_elements(v_l) e
      where not (jsonb_typeof(e) = 'string' and (e #>> '{}') in ('en', 'ar', 'fr', 'es', 'pt', 'zh', 'ru', 'de', 'ko', 'ja'))), false) then v_prob := v_prob || 'languages'::text; end if;
  if not (coalesce(case when jsonb_typeof(x->'cost_band') = 'string' then x->>'cost_band' end, '') in ('free', 'low', 'medium', 'high', 'varies')) then v_prob := v_prob || 'cost'::text; end if;
  if not coalesce((case when jsonb_typeof(x->'format') = 'string' then x->>'format' else '' end) in ('elearning', 'mooc', 'course', 'fellowship', 'programme', 'webinar', 'reading'), false) then v_prob := v_prob || 'format'::text; end if;
  if x ? 'hours' and jsonb_typeof(x->'hours') <> 'null' and not (jsonb_typeof(x->'hours') = 'number' and kafaa_pw_numv(x->'hours') > 0 and kafaa_pw_numv(x->'hours') <= 2000) then v_prob := v_prob || 'hours'::text; end if;
  v_sc := case when jsonb_typeof(x->'criteria') = 'object' then x->'criteria' else '{}'::jsonb end;
  select coalesce(array_agg(c.id order by c.sort, c.id collate "C"), '{}') into v_fail from kafaa_catalogue_criteria c
    where c.status = 'published' and c.required and not (kafaa_pw_is_int(v_sc->c.id) and kafaa_pw_numv(v_sc->c.id) >= c.min_score and kafaa_pw_numv(v_sc->c.id) <= 3);
  return jsonb_build_object('ok', cardinality(v_prob) = 0 and cardinality(v_fail) = 0, 'problems', to_jsonb(v_prob), 'failing', to_jsonb(v_fail));
end $$;
create or replace function kafaa_xr_slug(t text) returns text language sql immutable set search_path = public as $$
  select rtrim(left(btrim(regexp_replace(normalize(lower(coalesce(t, '')), NFKD), '[^a-z0-9]+', '-', 'g'), '-'), 40), '-')
$$;

-- ───────────── RPCs: reads (staff, internal_content R)
create or replace function kafaa_pathway_catalogue() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); v_min integer := (kafaa_rules()->>'minGroupSize')::integer; v_list jsonb;
begin
  if me is null or not kafaa_has_grant('internal_content', array['R']) then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'skill_id', p.skill_id, 'level', p.level, 'envelope_months', p.envelope_months, 'weekly_hours', p.weekly_hours,
      'weeks', r->'weeks', 'total_hours', r->'total_hours', 'steps', jsonb_array_length(r->'steps'), 'requested', r->'requested', 'peer', kafaa_pw_peer(p.id, v_min),
      'mine', (select e.status from kafaa_pathway_enrolments e where e.id = 'pe:' || me || ':' || p.id)) order by p.sort, p.id collate "C"), '[]'::jsonb)
    into v_list from kafaa_pathways p cross join lateral kafaa_pw_resolve(p.id) r where p.status = 'published';
  return jsonb_build_object('min_group', v_min, 'pathways', v_list);
end $$;
create or replace function kafaa_pathway_detail(p_id text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); p kafaa_pathways; e kafaa_pathway_enrolments; v_own boolean; v_min integer := (kafaa_rules()->>'minGroupSize')::integer;
begin
  if me is null or not kafaa_has_grant('internal_content', array['R']) then return null; end if;
  select * into p from kafaa_pathways where id = p_id;
  if p.id is null or (p.status <> 'published' and not (kafaa_has_grant('sat', array['R', 'W', 'A']) or kafaa_has_grant('audit_log', array['R']))) then return null; end if;
  select * into e from kafaa_pathway_enrolments where id = 'pe:' || me || ':' || p.id;
  v_own := kafaa_has_grant('skills_profile', array['Own']);
  return jsonb_build_object('pathway_id', p.id, 'resolved', kafaa_pw_resolve(p.id), 'peer', kafaa_pw_peer(p.id, v_min),
    'mine', case when e.id is not null and v_own then jsonb_build_object('enrolment_id', e.id, 'status', e.status, 'started_on', e.started_on, 'completed_on', e.completed_on,
      'progress', kafaa_pw_progress(me, p.id)) end,
    'can_follow', v_own and p.status = 'published');
end $$;

-- ───────────── RPCs: my progress (skills_profile Own)
create or replace function kafaa_start_pathway(p_id text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; p kafaa_pathways; e kafaa_pathway_enrolments; v_id text; a kafaa_audit_events; m jsonb := kafaa_pw_msgs();
begin
  if me is null then return kafaa_refuse('pathway.start', 'pathway_enrolments', p_id, 'not_signed_in', m->>'not_signed_in'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  if v_role is null then return kafaa_refuse('pathway.start', 'pathway_enrolments', p_id, 'forbidden', m->>'forbidden'); end if;
  select * into p from kafaa_pathways where id = p_id;
  if p.id is null or p.status <> 'published' then return kafaa_refuse('pathway.start', 'pathway_enrolments', p_id, 'not_found', m->>'not_found', v_role); end if;
  v_id := 'pe:' || me || ':' || p.id;
  select * into e from kafaa_pathway_enrolments where id = v_id;
  if e.id is not null and e.status <> 'withdrawn' then return kafaa_refuse('pathway.start', 'pathway_enrolments', p_id, 'already', m->>'already', v_role); end if;
  if exists (select 1 from kafaa_person_skills s where s.person_id = me and s.skill_id = p.skill_id and coalesce(s.active, true) and s.level >= p.level) then
    return kafaa_refuse('pathway.start', 'pathway_enrolments', p_id, 'held', m->>'held', v_role); end if;
  if (select count(*) from kafaa_pathway_enrolments where person_id = me and status = 'active') >= 3 then
    return kafaa_refuse('pathway.start', 'pathway_enrolments', p_id, 'too_many', m->>'too_many', v_role); end if;
  if e.id is not null then
    update kafaa_pathway_enrolments set status = 'active', started_on = current_date, completed_on = null, withdrawn_on = null, withdrawn_reason = null, steps_done = '[]'::jsonb, updated_at = now() where id = v_id;
  else
    insert into kafaa_pathway_enrolments (id, person_id, pathway_id, status, started_on, steps_done, updated_at) values (v_id, me, p.id, 'active', current_date, '[]'::jsonb, now());
  end if;
  a := kafaa_audit('pathway.start', 'pathway_enrolments', v_id, 'ok', p.id || ' started', 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Pathway started', a, null, jsonb_build_object('id', v_id, 'status', 'active'));
end $$;
create or replace function kafaa_complete_pathway(p_id text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; p kafaa_pathways; e kafaa_pathway_enrolments; v_id text; v_pr jsonb; a kafaa_audit_events; m jsonb := kafaa_pw_msgs();
begin
  if me is null then return kafaa_refuse('pathway.complete', 'pathway_enrolments', p_id, 'not_signed_in', m->>'not_signed_in'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  if v_role is null then return kafaa_refuse('pathway.complete', 'pathway_enrolments', p_id, 'forbidden', m->>'forbidden'); end if;
  select * into p from kafaa_pathways where id = p_id;
  v_id := 'pe:' || me || ':' || coalesce(p.id, '');
  select * into e from kafaa_pathway_enrolments where id = v_id;
  if p.id is null or e.id is null or e.status <> 'active' then return kafaa_refuse('pathway.complete', 'pathway_enrolments', p_id, 'not_active', m->>'not_active', v_role); end if;
  v_pr := kafaa_pw_progress(me, p.id);
  if not (v_pr->>'complete')::boolean then return kafaa_refuse('pathway.complete', 'pathway_enrolments', p_id, 'steps_open', m->>'steps_open', v_role); end if;
  update kafaa_pathway_enrolments set status = 'completed', completed_on = current_date, steps_done = v_pr->'steps', updated_at = now() where id = v_id;
  a := kafaa_audit('pathway.complete', 'pathway_enrolments', v_id, 'ok', p.id || ' completed (' || (v_pr->>'self_declared') || ' self-declared step(s))', 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Pathway complete', a, null, jsonb_build_object('id', v_id, 'status', 'completed', 'self_declared', (v_pr->>'self_declared')::integer));
end $$;
create or replace function kafaa_withdraw_pathway(p_id text, p_reason text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; e kafaa_pathway_enrolments; v_id text; v_why text := nullif(btrim(coalesce(p_reason, ''), E' \t\r\n'), ''); a kafaa_audit_events; m jsonb := kafaa_pw_msgs();
begin
  if me is null then return kafaa_refuse('pathway.withdraw', 'pathway_enrolments', p_id, 'not_signed_in', m->>'not_signed_in'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  if v_role is null then return kafaa_refuse('pathway.withdraw', 'pathway_enrolments', p_id, 'forbidden', m->>'forbidden'); end if;
  v_id := 'pe:' || me || ':' || coalesce(p_id, '');
  select * into e from kafaa_pathway_enrolments where id = v_id;
  if e.id is null or e.status <> 'active' then return kafaa_refuse('pathway.withdraw', 'pathway_enrolments', p_id, 'not_active', m->>'not_active', v_role); end if;
  if v_why is not null and length(v_why) > 300 then return kafaa_refuse('pathway.withdraw', 'pathway_enrolments', p_id, 'invalid', m->>'xr_note', v_role); end if;
  update kafaa_pathway_enrolments set status = 'withdrawn', withdrawn_on = current_date, withdrawn_reason = v_why, updated_at = now() where id = v_id;
  a := kafaa_audit('pathway.withdraw', 'pathway_enrolments', v_id, 'ok', p_id || ' left', 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Pathway left', a, null, jsonb_build_object('id', v_id, 'status', 'withdrawn'));
end $$;

-- ───────────── RPCs: the training manager edits pathways and refreshes the gap backlog
create or replace function kafaa_save_pathway(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_status text; v_prob text[]; v_id text; o kafaa_pathways; v_ver integer; s jsonb; i bigint; a kafaa_audit_events; m jsonb := kafaa_pw_msgs();
  v_eid text := case when jsonb_typeof(p->'id') = 'string' then p->>'id' end;
begin
  if me is null then return kafaa_refuse('pathway.save', 'pathways', v_eid, 'not_signed_in', m->>'not_signed_in'); end if;
  if not kafaa_has_role('training_manager') then return kafaa_refuse('pathway.save', 'pathways', v_eid, 'forbidden', m->>'forbidden_edit', kafaa_acting_role('internal_content', array['R'])); end if;
  v_status := coalesce(p->>'status', 'draft');
  v_prob := kafaa_pw_problems(p);
  if v_status not in ('draft', 'published', 'retired') then v_prob := v_prob || 'status'::text; end if;
  if cardinality(v_prob) > 0 then return kafaa_refuse('pathway.save', 'pathways', v_eid, 'invalid', (m->>'invalid') || array_to_string(v_prob, ', '), 'training_manager'); end if;
  v_id := coalesce(nullif(v_eid, ''), 'pw-' || regexp_replace(p->>'skill_id', '^sk-fs-', '') || '-l' || (p->>'level'));
  select * into o from kafaa_pathways where id = v_id;
  if nullif(v_eid, '') is null and o.id is not null then return kafaa_refuse('pathway.save', 'pathways', v_eid, 'conflict', 'A pathway for this skill and level already exists; edit it instead', 'training_manager'); end if;
  if o.id is not null and (o.skill_id <> p->>'skill_id' or o.level <> (p->>'level')::numeric) then return kafaa_refuse('pathway.save', 'pathways', v_eid, 'invalid', (m->>'invalid') || 'skill', 'training_manager'); end if;
  v_ver := coalesce(o.version, 0) + 1;
  if o.id is not null then
    update kafaa_pathways set title_en = btrim(p->>'title_en', E' \t\r\n'), title_ar = btrim(p->>'title_ar', E' \t\r\n'), summary_en = btrim(coalesce(p->>'summary_en', ''), E' \t\r\n'),
      summary_ar = btrim(coalesce(p->>'summary_ar', ''), E' \t\r\n'), outcome_en = btrim(coalesce(p->>'outcome_en', ''), E' \t\r\n'), outcome_ar = btrim(coalesce(p->>'outcome_ar', ''), E' \t\r\n'),
      envelope_months = (p->>'envelope_months')::numeric, weekly_hours = (p->>'weekly_hours')::numeric, status = v_status, listed = v_status = 'published', version = v_ver, updated_by = me, updated_at = now()
      where id = v_id;
  else
    insert into kafaa_pathways (id, skill_id, level, title_en, title_ar, summary_en, summary_ar, outcome_en, outcome_ar, envelope_months, weekly_hours, status, listed, version, benchmark_ids, sources, updated_by, updated_at, sort)
    values (v_id, p->>'skill_id', (p->>'level')::numeric, btrim(p->>'title_en', E' \t\r\n'), btrim(p->>'title_ar', E' \t\r\n'), btrim(coalesce(p->>'summary_en', ''), E' \t\r\n'), btrim(coalesce(p->>'summary_ar', ''), E' \t\r\n'),
      btrim(coalesce(p->>'outcome_en', ''), E' \t\r\n'), btrim(coalesce(p->>'outcome_ar', ''), E' \t\r\n'), (p->>'envelope_months')::numeric, (p->>'weekly_hours')::numeric, v_status, v_status = 'published', 1,
      array['ENTITLE', 'CORP', 'LIGHTCAST'], '[]'::jsonb, me, now(), 9000);
  end if;
  for s, i in select x, o2 from jsonb_array_elements(p->'steps') with ordinality t(x, o2) loop
    insert into kafaa_pathway_steps (id, pathway_id, n, kind, title_en, title_ar, hours, pins, auto, version)
    values (v_id || ':v' || v_ver || ':s' || i, v_id, i, s->>'kind', btrim(s->>'title_en', E' \t\r\n'), btrim(s->>'title_ar', E' \t\r\n'), (s->>'hours')::numeric,
      case when jsonb_typeof(s->'pins') = 'array' then array(select jsonb_array_elements_text(s->'pins')) else '{}' end, coalesce((s->>'auto')::boolean, true), v_ver);
  end loop;
  a := kafaa_audit('pathway.save', 'pathways', v_id, 'ok', v_id || ' v' || v_ver || ' ' || v_status, 'not_applicable', null, 'training_manager');
  return kafaa_result(true, 'ok', 'Pathway saved', a, null, jsonb_build_object('id', v_id, 'version', v_ver, 'status', v_status));
end $$;
create or replace function kafaa_refresh_pathway_gaps() returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); p kafaa_pathways; s jsonb; v_want text[] := '{}'; v_gid text; v_added integer := 0; v_open integer; v_filled integer; a kafaa_audit_events; m jsonb := kafaa_pw_msgs();
begin
  if me is null then return kafaa_refuse('pathway.gaps', 'pathway_gaps', null, 'not_signed_in', m->>'not_signed_in'); end if;
  if not kafaa_has_role('training_manager') then return kafaa_refuse('pathway.gaps', 'pathway_gaps', null, 'forbidden', m->>'forbidden_edit', kafaa_acting_role('internal_content', array['R'])); end if;
  for p in select * from kafaa_pathways where status = 'published' order by id collate "C" loop
    for s in select x from jsonb_array_elements(kafaa_pw_resolve(p.id)->'steps') x where x->>'status' = 'requested' loop
      v_gid := 'pg:' || (s->>'step_id');
      v_want := v_want || v_gid;
      if exists (select 1 from kafaa_pathway_gaps where id = v_gid) then
        update kafaa_pathway_gaps set status = 'open', last_checked = current_date, filled_on = null where id = v_gid;
      else
        insert into kafaa_pathway_gaps (id, pathway_id, step_id, skill_id, level, kind, status, first_seen, last_checked) values (v_gid, p.id, s->>'step_id', p.skill_id, p.level, s->>'kind', 'open', current_date, current_date);
        v_added := v_added + 1;
      end if;
    end loop;
  end loop;
  update kafaa_pathway_gaps set status = 'filled', filled_on = current_date, last_checked = current_date where status = 'open' and not (id = any(v_want));
  select count(*) filter (where status = 'open'), count(*) filter (where status = 'filled') into v_open, v_filled from kafaa_pathway_gaps;
  a := kafaa_audit('pathway.gaps', 'pathway_gaps', null, 'ok', v_open || ' open, ' || v_filled || ' filled, ' || v_added || ' new', 'not_applicable', null, 'training_manager');
  return kafaa_result(true, 'ok', 'Gap backlog refreshed', a, null, jsonb_build_object('open', v_open, 'filled', v_filled, 'added', v_added));
end $$;

-- ───────────── RPCs: FS18 external catalogue
create or replace function kafaa_check_external_resource(p jsonb) returns jsonb language sql stable security definer set search_path = public as $$
  select kafaa_xr_check(coalesce(p, '{}'::jsonb), current_date)
$$;
create or replace function kafaa_save_external_resource(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_chk jsonb; v_id text; o kafaa_external_resources; v_ver integer; v_status text; a kafaa_audit_events; m jsonb := kafaa_pw_msgs();
  v_eid text := case when jsonb_typeof(p->'id') = 'string' then p->>'id' end;
  t text := E' \t\r\n';
begin
  if me is null then return kafaa_refuse('external.save', 'external_resources', v_eid, 'not_signed_in', m->>'not_signed_in'); end if;
  if not kafaa_has_role('training_manager') then return kafaa_refuse('external.save', 'external_resources', v_eid, 'forbidden', m->>'forbidden_edit', kafaa_acting_role('internal_content', array['R'])); end if;
  v_chk := kafaa_xr_check(coalesce(p, '{}'::jsonb), current_date);
  if jsonb_array_length(v_chk->'problems') > 0 then
    return kafaa_refuse('external.save', 'external_resources', v_eid, 'invalid', (m->>'xr_invalid') || (select string_agg(x, ', ' order by o) from jsonb_array_elements_text(v_chk->'problems') with ordinality t(x, o)), 'training_manager'); end if;
  v_id := coalesce(nullif(v_eid, ''), 'xr-' || kafaa_xr_slug(p->>'title_en'));
  select * into o from kafaa_external_resources where id = v_id;
  if nullif(v_eid, '') is null and o.id is not null then return kafaa_refuse('external.save', 'external_resources', v_eid, 'conflict', 'A resource with this title already exists; edit it instead', 'training_manager'); end if;
  if o.id is not null and o.status = 'published' and jsonb_array_length(v_chk->'failing') > 0 then
    return kafaa_refuse('external.save', 'external_resources', v_eid, 'criteria_failed', (m->>'xr_criteria') || (select string_agg(x, ', ' order by o2) from jsonb_array_elements_text(v_chk->'failing') with ordinality t(x, o2)), 'training_manager'); end if;
  v_ver := coalesce(o.version, 0) + 1;
  v_status := coalesce(o.status, 'draft');
  if o.id is not null then
    update kafaa_external_resources set title_en = p->>'title_en', title_ar = p->>'title_ar', provider_en = p->>'provider_en', provider_ar = p->>'provider_ar', provider_url = p->>'provider_url', url = p->>'url',
      format = p->>'format', hours = kafaa_pw_numv(p->'hours'), duration_en = btrim(coalesce(p->>'duration_en', ''), t), duration_ar = btrim(coalesce(p->>'duration_ar', ''), t), cost_band = p->>'cost_band',
      languages = array(select jsonb_array_elements_text(p->'languages')), skills = p->'skills', has_assessment = coalesce((p->>'has_assessment')::boolean, false),
      summary_en = btrim(coalesce(p->>'summary_en', ''), t), summary_ar = btrim(coalesce(p->>'summary_ar', ''), t), criteria = coalesce(p->'criteria', '{}'::jsonb),
      criteria_note_en = btrim(coalesce(p->>'criteria_note_en', ''), t), criteria_note_ar = btrim(coalesce(p->>'criteria_note_ar', ''), t), as_of = (p->>'as_of')::date,
      version = v_ver, listed = v_status = 'published', updated_by = me, updated_at = now() where id = v_id;
  else
    insert into kafaa_external_resources (id, title_en, title_ar, provider_en, provider_ar, provider_url, url, format, hours, duration_en, duration_ar, cost_band, languages, skills, has_assessment,
      summary_en, summary_ar, criteria, criteria_note_en, criteria_note_ar, as_of, sources, status, listed, version, created_by, updated_by, updated_at, sort)
    values (v_id, p->>'title_en', p->>'title_ar', p->>'provider_en', p->>'provider_ar', p->>'provider_url', p->>'url', p->>'format', kafaa_pw_numv(p->'hours'), btrim(coalesce(p->>'duration_en', ''), t),
      btrim(coalesce(p->>'duration_ar', ''), t), p->>'cost_band', array(select jsonb_array_elements_text(p->'languages')), p->'skills', coalesce((p->>'has_assessment')::boolean, false),
      btrim(coalesce(p->>'summary_en', ''), t), btrim(coalesce(p->>'summary_ar', ''), t), coalesce(p->'criteria', '{}'::jsonb), btrim(coalesce(p->>'criteria_note_en', ''), t), btrim(coalesce(p->>'criteria_note_ar', ''), t),
      (p->>'as_of')::date, '[]'::jsonb, 'draft', false, 1, me, me, now(), 9000);
  end if;
  a := kafaa_audit('external.save', 'external_resources', v_id, 'ok', v_id || ' v' || v_ver, 'not_applicable', null, 'training_manager');
  return kafaa_result(true, 'ok', 'Resource saved', a, null, jsonb_build_object('id', v_id, 'version', v_ver, 'status', v_status, 'check', v_chk));
end $$;
create or replace function kafaa_publish_external_resource(p_id text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); o kafaa_external_resources; v_chk jsonb; a kafaa_audit_events; m jsonb := kafaa_pw_msgs();
begin
  if me is null then return kafaa_refuse('external.publish', 'external_resources', p_id, 'not_signed_in', m->>'not_signed_in'); end if;
  if not kafaa_has_role('training_manager') then return kafaa_refuse('external.publish', 'external_resources', p_id, 'forbidden', m->>'forbidden_edit', kafaa_acting_role('internal_content', array['R'])); end if;
  select * into o from kafaa_external_resources where id = p_id;
  if o.id is null then return kafaa_refuse('external.publish', 'external_resources', p_id, 'not_found', m->>'xr_not_found', 'training_manager'); end if;
  v_chk := kafaa_xr_check(to_jsonb(o), current_date);
  if jsonb_array_length(v_chk->'problems') > 0 then
    return kafaa_refuse('external.publish', 'external_resources', p_id, 'invalid', (m->>'xr_invalid') || (select string_agg(x, ', ' order by n) from jsonb_array_elements_text(v_chk->'problems') with ordinality t(x, n)), 'training_manager'); end if;
  if jsonb_array_length(v_chk->'failing') > 0 then
    return kafaa_refuse('external.publish', 'external_resources', p_id, 'criteria_failed', (m->>'xr_criteria') || (select string_agg(x, ', ' order by n) from jsonb_array_elements_text(v_chk->'failing') with ordinality t(x, n)), 'training_manager'); end if;
  update kafaa_external_resources set status = 'published', listed = true, published_by = me, published_on = current_date, retired_reason = null, retired_on = null, updated_at = now() where id = p_id;
  a := kafaa_audit('external.publish', 'external_resources', p_id, 'ok', p_id || ' published', 'not_applicable', null, 'training_manager');
  return kafaa_result(true, 'ok', 'Resource published', a, null, jsonb_build_object('id', p_id, 'status', 'published'));
end $$;
create or replace function kafaa_retire_external_resource(p_id text, p_reason text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); o kafaa_external_resources; v_why text := btrim(coalesce(p_reason, ''), E' \t\r\n'); a kafaa_audit_events; m jsonb := kafaa_pw_msgs();
begin
  if me is null then return kafaa_refuse('external.retire', 'external_resources', p_id, 'not_signed_in', m->>'not_signed_in'); end if;
  if not kafaa_has_role('training_manager') then return kafaa_refuse('external.retire', 'external_resources', p_id, 'forbidden', m->>'forbidden_edit', kafaa_acting_role('internal_content', array['R'])); end if;
  select * into o from kafaa_external_resources where id = p_id;
  if o.id is null then return kafaa_refuse('external.retire', 'external_resources', p_id, 'not_found', m->>'xr_not_found', 'training_manager'); end if;
  if length(v_why) < 5 or length(v_why) > 300 then return kafaa_refuse('external.retire', 'external_resources', p_id, 'invalid', m->>'xr_reason', 'training_manager'); end if;
  update kafaa_external_resources set status = 'retired', listed = false, retired_reason = v_why, retired_on = current_date, updated_at = now() where id = p_id;
  a := kafaa_audit('external.retire', 'external_resources', p_id, 'ok', p_id || ' retired: ' || v_why, 'not_applicable', null, 'training_manager');
  return kafaa_result(true, 'ok', 'Resource retired', a, null, jsonb_build_object('id', p_id, 'status', 'retired'));
end $$;
-- Self-declared completion: one row per person and resource + one F30 xAPI statement ("experienced", source console, stored_by the
-- learner, context evidence self-declared). Never writes kafaa_skill_evidence: self-declared completions are not verified evidence.
create or replace function kafaa_record_external_completion(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; o kafaa_external_resources; v_rid text := p->>'resource_id'; v_on text := p->>'completed_on';
  v_note text := nullif(btrim(coalesce(p->>'note', ''), E' \t\r\n'), ''); v_id text; v_ts timestamptz := date_trunc('second', now()); st kafaa_xapi_statements; a kafaa_audit_events; m jsonb := kafaa_pw_msgs();
begin
  if me is null then return kafaa_refuse('external.complete', 'external_completions', v_rid, 'not_signed_in', m->>'not_signed_in'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  if v_role is null then return kafaa_refuse('external.complete', 'external_completions', v_rid, 'forbidden', m->>'forbidden'); end if;
  select * into o from kafaa_external_resources where id = v_rid;
  if o.id is null or o.status <> 'published' then return kafaa_refuse('external.complete', 'external_completions', v_rid, 'not_published', m->>'xr_not_published', v_role); end if;
  if jsonb_typeof(p->'completed_on') <> 'string' or not kafaa_pw_is_date(v_on) or v_on::date > current_date then return kafaa_refuse('external.complete', 'external_completions', v_rid, 'invalid', m->>'xr_date', v_role); end if;
  if v_note is not null and length(v_note) > 300 then return kafaa_refuse('external.complete', 'external_completions', v_rid, 'invalid', m->>'xr_note', v_role); end if;
  v_id := 'xc:' || me || ':' || o.id;
  if exists (select 1 from kafaa_external_completions where id = v_id) then return kafaa_refuse('external.complete', 'external_completions', v_rid, 'duplicate', m->>'xr_duplicate', v_role); end if;
  st := kafaa_xapi_make('console', 'fs18:' || v_id, me, 'experienced', 'activity', 'external/' || o.id, jsonb_build_object('en', o.title_en, 'ar', coalesce(nullif(o.title_ar, ''), o.title_en)),
    '{"completion": true}'::jsonb, jsonb_build_object('extensions', jsonb_build_object('https://kafaa.example/xapi/ext/record', 'external_completions/' || v_id, 'https://kafaa.example/xapi/ext/evidence', 'self-declared')),
    kafaa_xapi_noon(v_on::date), v_ts);
  st.stored_by := me;
  insert into kafaa_external_completions (id, person_id, resource_id, completed_on, note, evidence, statement_id, created_at) values (v_id, me, o.id, v_on::date, v_note, 'self_declared', st.id, v_ts);
  perform kafaa_xapi_emit(st);
  a := kafaa_audit('external.complete', 'external_completions', v_id, 'ok', o.id || ' self-declared', 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Completion recorded (self-declared)', a, null, jsonb_build_object('id', v_id, 'evidence', 'self_declared', 'statement_id', st.id));
end $$;

-- ───────────── Grants: helpers are internal; RPCs for signed-in users only
revoke all on function kafaa_pw_msgs(), kafaa_pw_weeks(numeric), kafaa_pw_is_date(text), kafaa_pw_len(jsonb, integer, integer), kafaa_pw_is_int(jsonb), kafaa_pw_numv(jsonb), kafaa_pw_skill_ok(text),
  kafaa_pw_problems(jsonb), kafaa_pw_item(text, jsonb, boolean), kafaa_pw_pin(text), kafaa_pw_discover(text, text, integer), kafaa_pw_resolve(text), kafaa_pw_progress(text, text),
  kafaa_pw_peer(text, integer), kafaa_xr_check(jsonb, date), kafaa_xr_slug(text) from public, anon, authenticated;
revoke all on function kafaa_pathway_catalogue(), kafaa_pathway_detail(text), kafaa_start_pathway(text), kafaa_complete_pathway(text), kafaa_withdraw_pathway(text, text), kafaa_save_pathway(jsonb),
  kafaa_refresh_pathway_gaps(), kafaa_check_external_resource(jsonb), kafaa_save_external_resource(jsonb), kafaa_publish_external_resource(text), kafaa_retire_external_resource(text, text),
  kafaa_record_external_completion(jsonb) from public, anon;
grant execute on function kafaa_pathway_catalogue(), kafaa_pathway_detail(text), kafaa_start_pathway(text), kafaa_complete_pathway(text), kafaa_withdraw_pathway(text, text), kafaa_save_pathway(jsonb),
  kafaa_refresh_pathway_gaps(), kafaa_check_external_resource(jsonb), kafaa_save_external_resource(jsonb), kafaa_publish_external_resource(text), kafaa_retire_external_resource(text, text),
  kafaa_record_external_completion(jsonb) to authenticated;
