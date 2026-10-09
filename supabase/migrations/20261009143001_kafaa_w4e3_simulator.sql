-- [W4 · E3 · F28] Kafa'a simulator scenario library and coverage (M04): a generic training-objective catalogue, training scenarios
-- (metadata only; purpose is always 'training' and exam content is refused with exam_content), COCT/LOCT cycle plans with a
-- coverage matrix, and structured crew debriefs that feed F01 skill evidence (kind ojt, basis evidenced, never verified) for
-- crew members present in the booked slot only, plus xAPI-shaped statements on the debrief for the F30 learning record store.
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file, RLS in the per-statement form,
-- internal helpers and the RPCs. Rules: src/modules/m04/scenarios.ts (LocalBackend mirror: src/modules/m04/backend/simulator.local.ts).
-- PGlite checks: scripts/validate/w4e3-simulator.mjs (SQL = TS on validation, content checks, plans, gaps and debriefs).

-- ───────────── Tables (generated DDL)
create table if not exists kafaa_sim_objectives (
  id text primary key,
  code text not null unique,
  title_en text not null,
  title_ar text not null,
  category text not null check (category in ('normal', 'abnormal', 'emergency', 'severe_accident', 'team')),
  competency_id text not null,
  programmes text[] not null default '{}'::text[],
  active boolean not null default true,
  sort integer not null default 0,
  sources jsonb not null default '[]'::jsonb
);
comment on table kafaa_sim_objectives is '[M04] Simulator training objective catalogue (generic, sourced to IAEA SAT and simulator guidance) (F28)';

create table if not exists kafaa_sim_scenarios (
  id text primary key,
  code text not null unique,
  title_en text not null,
  title_ar text not null,
  summary_en text not null,
  summary_ar text not null,
  events_en text not null default '',
  events_ar text not null default '',
  category text not null check (category in ('normal', 'abnormal', 'emergency', 'severe_accident')),
  purpose text not null default 'training' check (purpose in ('training')),
  objective_ids text[] not null default '{}'::text[],
  competency_ids text[] not null default '{}'::text[],
  positions text[] not null default '{}'::text[],
  duration_min integer not null,
  fidelity text not null check (fidelity in ('full_scope', 'limited_scope', 'desktop')),
  programmes text[] not null default '{}'::text[],
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved', 'retired')),
  revision integer not null default 1,
  author_person_id text,
  last_edited_by text,
  submitted_at timestamptz,
  approved_by text,
  approved_at timestamptz,
  review_note text,
  last_run_on date,
  run_count integer not null default 0,
  history jsonb not null default '[]'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table kafaa_sim_scenarios is '[M04] Simulator training scenario (metadata only; never exam content): objectives, competencies, positions, fidelity, revision (F28)';

create table if not exists kafaa_sim_cycles (
  id text primary key,
  programme text not null check (programme in ('coct', 'loct')),
  label_en text not null,
  label_ar text not null,
  starts_on date not null,
  ends_on date not null,
  segments integer not null default 8,
  requirements jsonb not null default '[]'::jsonb,
  required_competency_ids text[] not null default '{}'::text[],
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'closed')),
  planned_by text,
  planned_at timestamptz,
  approved_by text,
  approved_at timestamptz,
  gap_note text,
  sources jsonb not null default '[]'::jsonb
);
comment on table kafaa_sim_cycles is '[M04] COCT/LOCT simulator cycle plan (two years in segments) with required objectives and competencies (F28)';

create table if not exists kafaa_sim_cycle_items (
  id text primary key,
  cycle_id text not null,
  scenario_id text not null,
  segment integer not null,
  active boolean not null default true,
  added_by text,
  added_at timestamptz not null default now()
);
comment on table kafaa_sim_cycle_items is '[M04] Scenario planned in a cycle segment (inactive when removed from the plan) (F28)';

create table if not exists kafaa_crew_debriefs (
  id text primary key,
  slot_id text not null,
  scenario_id text not null,
  cycle_id text,
  crew text not null,
  simulator text not null,
  held_on date not null,
  instructor_person_id text not null,
  ratings jsonb not null default '{}'::jsonb,
  self_ratings jsonb,
  strengths_en text,
  strengths_ar text,
  improvements_en text,
  improvements_ar text,
  critique_en text,
  critique_ar text,
  present_count integer not null default 0,
  absent_count integer not null default 0,
  evidence_count integer not null default 0,
  xapi jsonb not null default '[]'::jsonb,
  recorded_at timestamptz not null default now(),
  source text not null default 'kafaa' check (source in ('kafaa', 'import'))
);
comment on table kafaa_crew_debriefs is '[M04] Structured crew debrief after a simulator scenario: instructor team ratings, crew self-ratings and self-critique (F28)';

create table if not exists kafaa_crew_debrief_members (
  id text primary key,
  debrief_id text not null,
  person_id text not null,
  crew text not null,
  position text not null check (position in ('ss', 'sro', 'ro', 'sta', 'lo')),
  present boolean not null,
  scenario_id text not null,
  held_on date not null,
  evidence_ids text[] not null default '{}'::text[]
);
comment on table kafaa_crew_debrief_members is '[M04] Crew member on a debrief: position, present or absent, and the F01 evidence written for them (F28)';

do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_sim_objectives_competency_id_fk') then alter table kafaa_sim_objectives add constraint kafaa_sim_objectives_competency_id_fk foreign key (competency_id) references kafaa_competencies(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_sim_scenarios_author_person_id_fk') then alter table kafaa_sim_scenarios add constraint kafaa_sim_scenarios_author_person_id_fk foreign key (author_person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_sim_scenarios_last_edited_by_fk') then alter table kafaa_sim_scenarios add constraint kafaa_sim_scenarios_last_edited_by_fk foreign key (last_edited_by) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_sim_scenarios_approved_by_fk') then alter table kafaa_sim_scenarios add constraint kafaa_sim_scenarios_approved_by_fk foreign key (approved_by) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_sim_cycles_planned_by_fk') then alter table kafaa_sim_cycles add constraint kafaa_sim_cycles_planned_by_fk foreign key (planned_by) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_sim_cycles_approved_by_fk') then alter table kafaa_sim_cycles add constraint kafaa_sim_cycles_approved_by_fk foreign key (approved_by) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_sim_cycle_items_cycle_id_fk') then alter table kafaa_sim_cycle_items add constraint kafaa_sim_cycle_items_cycle_id_fk foreign key (cycle_id) references kafaa_sim_cycles(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_sim_cycle_items_scenario_id_fk') then alter table kafaa_sim_cycle_items add constraint kafaa_sim_cycle_items_scenario_id_fk foreign key (scenario_id) references kafaa_sim_scenarios(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_sim_cycle_items_added_by_fk') then alter table kafaa_sim_cycle_items add constraint kafaa_sim_cycle_items_added_by_fk foreign key (added_by) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_crew_debriefs_slot_id_fk') then alter table kafaa_crew_debriefs add constraint kafaa_crew_debriefs_slot_id_fk foreign key (slot_id) references kafaa_simulator_slots(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_crew_debriefs_scenario_id_fk') then alter table kafaa_crew_debriefs add constraint kafaa_crew_debriefs_scenario_id_fk foreign key (scenario_id) references kafaa_sim_scenarios(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_crew_debriefs_cycle_id_fk') then alter table kafaa_crew_debriefs add constraint kafaa_crew_debriefs_cycle_id_fk foreign key (cycle_id) references kafaa_sim_cycles(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_crew_debriefs_instructor_person_id_fk') then alter table kafaa_crew_debriefs add constraint kafaa_crew_debriefs_instructor_person_id_fk foreign key (instructor_person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_crew_debrief_members_debrief_id_fk') then alter table kafaa_crew_debrief_members add constraint kafaa_crew_debrief_members_debrief_id_fk foreign key (debrief_id) references kafaa_crew_debriefs(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_crew_debrief_members_person_id_fk') then alter table kafaa_crew_debrief_members add constraint kafaa_crew_debrief_members_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_crew_debrief_members_scenario_id_fk') then alter table kafaa_crew_debrief_members add constraint kafaa_crew_debrief_members_scenario_id_fk foreign key (scenario_id) references kafaa_sim_scenarios(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_sim_objectives_category_idx on kafaa_sim_objectives (category);
create index if not exists kafaa_sim_objectives_competency_id_idx on kafaa_sim_objectives (competency_id);
create index if not exists kafaa_sim_scenarios_category_idx on kafaa_sim_scenarios (category);
create index if not exists kafaa_sim_scenarios_status_idx on kafaa_sim_scenarios (status);
create index if not exists kafaa_sim_scenarios_author_person_id_idx on kafaa_sim_scenarios (author_person_id);
create index if not exists kafaa_sim_scenarios_last_edited_by_idx on kafaa_sim_scenarios (last_edited_by);
create index if not exists kafaa_sim_scenarios_approved_by_idx on kafaa_sim_scenarios (approved_by);
create index if not exists kafaa_sim_cycles_programme_idx on kafaa_sim_cycles (programme);
create index if not exists kafaa_sim_cycles_status_idx on kafaa_sim_cycles (status);
create index if not exists kafaa_sim_cycles_planned_by_idx on kafaa_sim_cycles (planned_by);
create index if not exists kafaa_sim_cycles_approved_by_idx on kafaa_sim_cycles (approved_by);
create index if not exists kafaa_sim_cycle_items_cycle_id_idx on kafaa_sim_cycle_items (cycle_id);
create index if not exists kafaa_sim_cycle_items_scenario_id_idx on kafaa_sim_cycle_items (scenario_id);
create index if not exists kafaa_sim_cycle_items_added_by_idx on kafaa_sim_cycle_items (added_by);
create index if not exists kafaa_crew_debriefs_slot_id_idx on kafaa_crew_debriefs (slot_id);
create index if not exists kafaa_crew_debriefs_scenario_id_idx on kafaa_crew_debriefs (scenario_id);
create index if not exists kafaa_crew_debriefs_cycle_id_idx on kafaa_crew_debriefs (cycle_id);
create index if not exists kafaa_crew_debriefs_held_on_idx on kafaa_crew_debriefs (held_on);
create index if not exists kafaa_crew_debriefs_instructor_person_id_idx on kafaa_crew_debriefs (instructor_person_id);
create index if not exists kafaa_crew_debrief_members_debrief_id_idx on kafaa_crew_debrief_members (debrief_id);
create index if not exists kafaa_crew_debrief_members_person_id_idx on kafaa_crew_debrief_members (person_id);
create index if not exists kafaa_crew_debrief_members_scenario_id_idx on kafaa_crew_debrief_members (scenario_id);

-- ───────────── RLS: library and plans for training staff (sat / training R/W/A); debriefs for sat; member rows own or in scope
alter table kafaa_sim_objectives enable row level security;
alter table kafaa_sim_scenarios enable row level security;
alter table kafaa_sim_cycles enable row level security;
alter table kafaa_sim_cycle_items enable row level security;
alter table kafaa_crew_debriefs enable row level security;
alter table kafaa_crew_debrief_members enable row level security;
do $$ declare t text; begin
  foreach t in array array['kafaa_sim_objectives', 'kafaa_sim_scenarios', 'kafaa_sim_cycles', 'kafaa_sim_cycle_items', 'kafaa_crew_debriefs', 'kafaa_crew_debrief_members'] loop
    if not exists (select 1 from pg_policies where tablename = t and policyname = 'kafaa_read') then
      execute format('create policy kafaa_read on %I for select to anon, authenticated using (false)', t);
    end if;
  end loop;
end $$;
alter policy kafaa_read on kafaa_sim_objectives using (((SELECT kafaa_has_grant('internal_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((SELECT kafaa_has_grant('sat'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))));
alter policy kafaa_read on kafaa_sim_scenarios using (((SELECT kafaa_has_grant('sat'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((SELECT kafaa_has_grant('training'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))));
alter policy kafaa_read on kafaa_sim_cycles using (((SELECT kafaa_has_grant('sat'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((SELECT kafaa_has_grant('training'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))));
alter policy kafaa_read on kafaa_sim_cycle_items using (((SELECT kafaa_has_grant('sat'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((SELECT kafaa_has_grant('training'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))));
alter policy kafaa_read on kafaa_crew_debriefs using (((SELECT kafaa_has_grant('sat'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))));
alter policy kafaa_read on kafaa_crew_debrief_members using (((SELECT kafaa_has_grant('sat'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((SELECT kafaa_has_grant('skills_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('skills_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('skills_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('skills_profile'::text, person_id, NULL::text, false)));
revoke all on kafaa_sim_objectives, kafaa_sim_scenarios, kafaa_sim_cycles, kafaa_sim_cycle_items, kafaa_crew_debriefs, kafaa_crew_debrief_members from anon, authenticated;
grant select on kafaa_sim_objectives, kafaa_sim_scenarios, kafaa_sim_cycles, kafaa_sim_cycle_items, kafaa_crew_debriefs, kafaa_crew_debrief_members to anon, authenticated;

-- ───────────── Rules (mirror of src/modules/m04/scenarios.ts; lists and messages generated from it)
create or replace function kafaa_sim_msg(p_key text) returns text language sql immutable set search_path = public as $$
  select ('{"not_signed_in":"Sign in first","forbidden":"Only simulator instructors and the training manager may change the scenario library","forbidden_approve":"Only the training manager approves scenarios and cycle plans","forbidden_debrief":"Only simulator instructors record crew debriefs","exam_content":"Exam scenarios are managed outside Kafa''a; the library holds training scenarios only","security_content":"Security, safeguards and cyber content is not allowed in simulator scenarios","specific_content":"Keep malfunctions generic: no equipment tags, setpoints or malfunction codes","invalid_purpose":"A scenario purpose must be training","invalid_text":"Give an English and an Arabic title (5 to 120 characters) and summary (20 to 1,000 characters); malfunction notes are limited to 600 characters","invalid_category":"Choose a scenario category","invalid_objectives":"Pick 1 to 12 training objectives from the catalogue","invalid_competencies":"Pick at most 10 competencies from the framework","invalid_positions":"Pick at least one crew position","invalid_duration":"Duration must be 30 to 480 minutes in steps of 15","invalid_fidelity":"Choose the simulator fidelity the scenario needs","invalid_programmes":"Choose COCT, LOCT or both","not_found":"Scenario not found","retired":"A retired scenario cannot be changed","not_in_review":"Only a scenario in review can be approved or returned","maker_checker":"The author of a revision cannot approve it","note_required":"Give a reason (10 to 1,000 characters)","invalid_decision":"Unknown decision","cycle_not_found":"Cycle not found","cycle_closed":"A closed cycle cannot be changed","scenario_not_approved":"Only approved scenarios can be planned or run","wrong_programme":"This scenario is not written for the programme of this cycle","invalid_items":"Each planned item needs a scenario and a segment of this cycle","duplicate":"A scenario is planned twice in the same segment","over_capacity":"Planned simulator time in a segment exceeds 16 hours","not_submitted":"Only a submitted cycle can be approved","coverage_gaps":"Required objectives are not covered; give a reason to approve with gaps","cycle_maker_checker":"The planner of a cycle cannot approve it","slot_not_found":"Simulator slot not found","slot_not_booked":"Debriefs are recorded for booked crew slots only","slot_not_started":"This slot has not started yet","already_recorded":"This scenario already has a debrief for this slot","not_in_slot":"Everyone on the debrief must be a member of the crew booked in the slot","no_attendees":"Mark at least one crew member present","invalid_ratings":"Rate each team competency from 1 to 5","invalid_debrief_text":"Debrief notes are limited to 2,000 characters each","wrong_cycle":"The cycle is not for this scenario or slot"}'::jsonb)->>p_key
$$;
create or replace function kafaa_sim_no(p_action text, p_table text, p_entity text, p_code text, p_key text, p_role text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  return kafaa_refuse(p_action, p_table, p_entity, p_code, kafaa_sim_msg(p_key), p_role);
end $$;
create or replace function kafaa_sim_trim(t text) returns text language sql immutable set search_path = public as $$
  select regexp_replace(coalesce(t, ''), '^\s+|\s+$', '', 'g')
$$;
create or replace function kafaa_sim_slen(j jsonb) returns integer language sql immutable set search_path = public as $$
  select case when jsonb_typeof(j) = 'string' then length(kafaa_sim_trim(j #>> '{}')) else -1 end
$$;
create or replace function kafaa_sim_str_arr(j jsonb) returns boolean language sql immutable set search_path = public as $$
  select coalesce(jsonb_typeof(j) = 'array' and not exists (select 1 from jsonb_array_elements(j) e where jsonb_typeof(e) <> 'string'), false)
$$;
create or replace function kafaa_sim_sortu(p text[]) returns text[] language sql immutable set search_path = public as $$
  select coalesce(array(select z.y from (select distinct u as y from unnest(p) u) z order by z.y collate "C"), '{}'::text[])
$$;
-- normWords: lower-case, everything but a-z, 0-9 and Arabic letters becomes one space, padded with spaces
create or replace function kafaa_sim_norm(t text) returns text language sql immutable set search_path = public as $$
  select ' ' || kafaa_sim_trim(regexp_replace(lower(coalesce(t, '')), '[^a-z0-9ء-ي]+', ' ', 'g')) || ' '
$$;
-- contentIssue: exam content first, then security, then plant specifics (tags, setpoints, malfunction codes)
create or replace function kafaa_sim_content_issue(p_texts text[]) returns text language plpgsql immutable set search_path = public as $$
declare t text; k text;
begin
  foreach t in array p_texts loop
    foreach k in array array['exam', 'exams', 'examination', 'examinations', 'answer key', 'answer keys', 'licensing test', 'licence test', 'license test', 'test bank', 'امتحان', 'الامتحان', 'امتحانات', 'الامتحانات', 'اختبار الترخيص', 'مفتاح الإجابة', 'بنك الأسئلة']::text[] loop
      if position(' ' || k || ' ' in kafaa_sim_norm(t)) > 0 then return 'exam_content'; end if;
    end loop;
  end loop;
  foreach t in array p_texts loop
    foreach k in array array['security', 'safeguards', 'cyber', 'cybersecurity', 'sabotage', 'intruder', 'intruders', 'intrusion', 'armed', 'adversary', 'vital area', 'protected area', 'perimeter', 'cctv', 'guard force', 'insider threat', 'design basis threat', 'أمن', 'الأمن', 'أمني', 'الأمني', 'الأمنية', 'الضمانات', 'سيبراني', 'السيبراني', 'السيبرانية', 'تخريب', 'التخريب', 'تسلل', 'متسلل', 'كاميرات المراقبة', 'التهديد الداخلي']::text[] loop
      if position(' ' || k || ' ' in kafaa_sim_norm(t)) > 0 then return 'security_content'; end if;
    end loop;
  end loop;
  foreach t in array p_texts loop
    if coalesce(t, '') ~ '(^|[^A-Za-z0-9])[0-9]?[A-Z]{2,3}-[A-Z]{1,3}-?[0-9]{2,4}[A-Z]?([^A-Za-z0-9]|$)'
       or lower(coalesce(t, '')) ~ '[0-9]+([.,][0-9]+)? ?(psig|psia|mpa|kpa|kg/cm2|gpm|degc|°c|ppm)([^a-z0-9]|$)' or lower(coalesce(t, '')) ~ '(^|[^a-z0-9])mf[-_ ]?[a-z]{2,4}[0-9]{2,}' then return 'specific_content'; end if;
  end loop;
  return null;
end $$;

-- validateScenario: {ok:false, code, key} or {ok:true, value}
create or replace function kafaa_sim_validate(p jsonb) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_issue text; v_obj text[]; v_comps jsonb; v_all text[]; v_pos text[]; v_prog text[];
  bad constant jsonb := '{"ok":false,"code":"invalid"}'::jsonb;
begin
  if p ? 'purpose' and jsonb_typeof(p->'purpose') <> 'null' and p->'purpose' <> '"training"'::jsonb then
    if p->'purpose' = '"exam"'::jsonb then return '{"ok":false,"code":"exam_content","key":"exam_content"}'::jsonb; end if;
    return bad || '{"key":"invalid_purpose"}'::jsonb;
  end if;
  v_issue := kafaa_sim_content_issue(array[p->>'title_en', p->>'title_ar', p->>'summary_en', p->>'summary_ar', coalesce(p->>'events_en', ''), coalesce(p->>'events_ar', '')]);
  if v_issue is not null then return jsonb_build_object('ok', false, 'code', v_issue, 'key', v_issue); end if;
  if kafaa_sim_slen(p->'title_en') not between 5 and 120 or kafaa_sim_slen(p->'title_ar') not between 5 and 120
     or kafaa_sim_slen(p->'summary_en') not between 20 and 1000 or kafaa_sim_slen(p->'summary_ar') not between 20 and 1000
     or kafaa_sim_slen(p->'events_en') > 600 or kafaa_sim_slen(p->'events_ar') > 600 then return bad || '{"key":"invalid_text"}'::jsonb; end if;
  if coalesce(jsonb_typeof(p->'category') = 'string' and (p->>'category') = any(array['normal', 'abnormal', 'emergency', 'severe_accident']::text[]), false) is not true then return bad || '{"key":"invalid_category"}'::jsonb; end if;
  if not kafaa_sim_str_arr(p->'objective_ids') then return bad || '{"key":"invalid_objectives"}'::jsonb; end if;
  v_obj := kafaa_sim_sortu(array(select jsonb_array_elements_text(p->'objective_ids')));
  if cardinality(v_obj) < 1 or cardinality(v_obj) > 12 or cardinality(v_obj) <> jsonb_array_length(p->'objective_ids')
     or exists (select 1 from unnest(v_obj) o where not exists (select 1 from kafaa_sim_objectives so where so.id = o and so.active)) then return bad || '{"key":"invalid_objectives"}'::jsonb; end if;
  v_comps := case when p ? 'competency_ids' and jsonb_typeof(p->'competency_ids') <> 'null' then p->'competency_ids' else '[]'::jsonb end;
  if not kafaa_sim_str_arr(v_comps) or exists (select 1 from jsonb_array_elements_text(v_comps) c where not exists (select 1 from kafaa_competencies k where k.id = c)) then
    return bad || '{"key":"invalid_competencies"}'::jsonb; end if;
  v_all := kafaa_sim_sortu(array(select jsonb_array_elements_text(v_comps)) || array(select so.competency_id from kafaa_sim_objectives so where so.id = any(v_obj)));
  if v_all && array['sa-01']::text[] then return '{"ok":false,"code":"security_content","key":"security_content"}'::jsonb; end if;
  if cardinality(v_all) > 10 then return bad || '{"key":"invalid_competencies"}'::jsonb; end if;
  if not kafaa_sim_str_arr(p->'positions') or jsonb_array_length(p->'positions') = 0
     or exists (select 1 from jsonb_array_elements_text(p->'positions') x where not (x = any(array['ss', 'sro', 'ro', 'sta', 'lo']::text[]))) then return bad || '{"key":"invalid_positions"}'::jsonb; end if;
  v_pos := array(select z.y from (select distinct x as y from jsonb_array_elements_text(p->'positions') x) z order by array_position(array['ss', 'sro', 'ro', 'sta', 'lo']::text[], z.y));
  if jsonb_typeof(p->'duration_min') is distinct from 'number' or (p->>'duration_min')::numeric <> trunc((p->>'duration_min')::numeric)
     or (p->>'duration_min')::numeric not between 30 and 480 or mod((p->>'duration_min')::numeric, 15) <> 0 then return bad || '{"key":"invalid_duration"}'::jsonb; end if;
  if coalesce(jsonb_typeof(p->'fidelity') = 'string' and (p->>'fidelity') = any(array['full_scope', 'limited_scope', 'desktop']::text[]), false) is not true then return bad || '{"key":"invalid_fidelity"}'::jsonb; end if;
  if not kafaa_sim_str_arr(p->'programmes') or jsonb_array_length(p->'programmes') = 0
     or exists (select 1 from jsonb_array_elements_text(p->'programmes') x where not (x = any(array['coct', 'loct']::text[]))) then return bad || '{"key":"invalid_programmes"}'::jsonb; end if;
  v_prog := kafaa_sim_sortu(array(select jsonb_array_elements_text(p->'programmes')));
  return jsonb_build_object('ok', true, 'value', jsonb_build_object(
    'title_en', kafaa_sim_trim(p->>'title_en'), 'title_ar', kafaa_sim_trim(p->>'title_ar'), 'summary_en', kafaa_sim_trim(p->>'summary_en'), 'summary_ar', kafaa_sim_trim(p->>'summary_ar'),
    'events_en', kafaa_sim_trim(p->>'events_en'), 'events_ar', kafaa_sim_trim(p->>'events_ar'), 'category', p->>'category',
    'objective_ids', to_jsonb(v_obj), 'competency_ids', to_jsonb(v_all), 'positions', to_jsonb(v_pos), 'duration_min', (p->>'duration_min')::numeric::integer,
    'fidelity', p->>'fidelity', 'programmes', to_jsonb(v_prog)));
end $$;

create or replace function kafaa_sim_hist(p_action text, p_revision integer, p_status text, p_note text default null) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'by', kafaa_me(), 'action', p_action, 'revision', p_revision, 'status', p_status)
    || case when p_action in ('approve', 'return', 'retire') then jsonb_build_object('note', p_note) else '{}'::jsonb end
$$;
create or replace function kafaa_sim_notify(p_person text, p_en text, p_ar text, p_link text, p_sev text) returns void language plpgsql security definer set search_path = public as $$
declare v_prev text := current_setting('kafaa.seeding', true);
begin
  if p_person is null or not exists (select 1 from kafaa_people where id = p_person) then return; end if;
  perform set_config('kafaa.seeding', 'on', true);
  insert into kafaa_notifications (id, person_id, kind, title_en, title_ar, link, severity)
  values ('nt-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16), p_person, 'simulator', p_en, p_ar, p_link, p_sev) on conflict (id) do nothing;
  perform set_config('kafaa.seeding', coalesce(v_prev, ''), true);
end $$;

-- ───────────── RPC: create or revise a training scenario (sat W/A)
create or replace function kafaa_save_sim_scenario(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; cur kafaa_sim_scenarios; v jsonb; x jsonb; v_submit boolean := coalesce(jsonb_typeof(p->'submit') = 'boolean' and (p->>'submit')::boolean, false);
  v_status text; v_rev integer; v_id text; v_n integer; a kafaa_audit_events; v_ts timestamptz := date_trunc('second', now()); v_has_id boolean := coalesce(p->>'id', '') <> '';
begin
  if me is null then return kafaa_sim_no('sim.scenario.save', 'sim_scenarios', p->>'id', 'not_signed_in', 'not_signed_in'); end if;
  v_role := kafaa_acting_role('sat', array['W', 'A']);
  if v_role is null then return kafaa_sim_no('sim.scenario.save', 'sim_scenarios', p->>'id', 'forbidden', 'forbidden'); end if;
  if v_has_id then select * into cur from kafaa_sim_scenarios where id = p->>'id'; end if;
  if v_has_id and cur.id is null then return kafaa_sim_no('sim.scenario.save', 'sim_scenarios', p->>'id', 'not_found', 'not_found', v_role); end if;
  if cur.status = 'retired' then return kafaa_sim_no('sim.scenario.save', 'sim_scenarios', p->>'id', 'retired', 'retired', v_role); end if;
  v := kafaa_sim_validate(p);
  if not (v->>'ok')::boolean then return kafaa_sim_no('sim.scenario.save', 'sim_scenarios', p->>'id', v->>'code', v->>'key', v_role); end if;
  x := v->'value';
  v_status := case when v_submit then 'in_review' else 'draft' end;
  if cur.id is not null then
    v_id := cur.id;
    v_rev := case when cur.status = 'approved' then cur.revision + 1 else cur.revision end;
    update kafaa_sim_scenarios set title_en = x->>'title_en', title_ar = x->>'title_ar', summary_en = x->>'summary_en', summary_ar = x->>'summary_ar',
      events_en = x->>'events_en', events_ar = x->>'events_ar', category = x->>'category',
      objective_ids = array(select jsonb_array_elements_text(x->'objective_ids')), competency_ids = array(select jsonb_array_elements_text(x->'competency_ids')),
      positions = array(select jsonb_array_elements_text(x->'positions')), duration_min = (x->>'duration_min')::integer, fidelity = x->>'fidelity',
      programmes = array(select jsonb_array_elements_text(x->'programmes')), status = v_status, revision = v_rev, last_edited_by = me,
      submitted_at = case when v_submit then v_ts end, approved_by = null, approved_at = null, review_note = null, updated_at = v_ts,
      history = history || jsonb_build_array(kafaa_sim_hist(case when cur.status = 'approved' then 'revised' else 'edited' end, v_rev, v_status))
    where id = v_id;
  else
    select coalesce(max(substring(code from 5)::integer), 0) + 1 into v_n from kafaa_sim_scenarios where code ~ '^SCN-[0-9]+$';
    v_id := 'scn-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
    v_rev := 1;
    insert into kafaa_sim_scenarios (id, code, title_en, title_ar, summary_en, summary_ar, events_en, events_ar, category, purpose, objective_ids, competency_ids, positions,
      duration_min, fidelity, programmes, status, revision, author_person_id, last_edited_by, submitted_at, history, sources, created_at, updated_at)
    values (v_id, 'SCN-' || case when v_n < 1000 then lpad(v_n::text, 3, '0') else v_n::text end, x->>'title_en', x->>'title_ar', x->>'summary_en', x->>'summary_ar',
      x->>'events_en', x->>'events_ar', x->>'category', 'training', array(select jsonb_array_elements_text(x->'objective_ids')), array(select jsonb_array_elements_text(x->'competency_ids')),
      array(select jsonb_array_elements_text(x->'positions')), (x->>'duration_min')::integer, x->>'fidelity', array(select jsonb_array_elements_text(x->'programmes')),
      v_status, 1, me, me, case when v_submit then v_ts end, jsonb_build_array(kafaa_sim_hist('created', 1, v_status)), '[]'::jsonb, v_ts, v_ts);
  end if;
  a := kafaa_audit('sim.scenario.save', 'sim_scenarios', v_id, 'ok', format('rev %s %s', v_rev, v_status), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when v_submit then 'Scenario submitted for review' else 'Scenario saved as a draft' end, a, null,
    jsonb_build_object('id', v_id, 'status', v_status, 'revision', v_rev));
end $$;

-- ───────────── RPC: approve / return / retire (training manager: sat A; maker-checker on approval)
create or replace function kafaa_review_sim_scenario(p_scenario_id text, p_decision text, p_note text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; x kafaa_sim_scenarios; v_note text := kafaa_sim_trim(p_note); v_status text; l integer; a kafaa_audit_events; v_ledger text;
begin
  if me is null then return kafaa_sim_no('sim.scenario.review', 'sim_scenarios', nullif(p_scenario_id, ''), 'not_signed_in', 'not_signed_in'); end if;
  v_role := kafaa_acting_role('sat', array['A']);
  if v_role is null then return kafaa_sim_no('sim.scenario.review', 'sim_scenarios', nullif(p_scenario_id, ''), 'forbidden', 'forbidden_approve'); end if;
  select * into x from kafaa_sim_scenarios where id = coalesce(p_scenario_id, '');
  if x.id is null then return kafaa_sim_no('sim.scenario.review', 'sim_scenarios', nullif(p_scenario_id, ''), 'not_found', 'not_found', v_role); end if;
  if coalesce(p_decision, '') not in ('approve', 'return', 'retire') then return kafaa_sim_no('sim.scenario.review', 'sim_scenarios', x.id, 'invalid', 'invalid_decision', v_role); end if;
  if x.status = 'retired' then return kafaa_sim_no('sim.scenario.review', 'sim_scenarios', x.id, 'retired', 'retired', v_role); end if;
  if p_decision <> 'retire' and x.status <> 'in_review' then return kafaa_sim_no('sim.scenario.review', 'sim_scenarios', x.id, 'not_in_review', 'not_in_review', v_role); end if;
  if p_decision = 'approve' and x.last_edited_by = me then return kafaa_sim_no('sim.scenario.review', 'sim_scenarios', x.id, 'maker_checker', 'maker_checker', v_role); end if;
  if (p_decision <> 'approve' and length(v_note) not between 10 and 1000) or length(v_note) > 1000 then
    return kafaa_sim_no('sim.scenario.review', 'sim_scenarios', x.id, 'invalid', 'note_required', v_role); end if;
  v_status := case p_decision when 'approve' then 'approved' when 'return' then 'draft' else 'retired' end;
  update kafaa_sim_scenarios set status = v_status, review_note = nullif(v_note, ''), updated_at = date_trunc('second', now()),
    approved_by = case when p_decision = 'approve' then me else approved_by end, approved_at = case when p_decision = 'approve' then date_trunc('second', now()) else approved_at end,
    history = history || jsonb_build_array(kafaa_sim_hist(p_decision, x.revision, v_status, nullif(v_note, '')))
  where id = x.id;
  if p_decision <> 'retire' then
    perform kafaa_sim_notify(x.last_edited_by, case when p_decision = 'approve' then 'Scenario approved: ' else 'Scenario returned for changes: ' end || x.title_en,
      case when p_decision = 'approve' then 'اعتُمد السيناريو: ' else 'أُعيد السيناريو للتعديل: ' end || x.title_ar, '/training/simulator/scenarios', case when p_decision = 'approve' then 'ok' else 'warn' end);
  end if;
  v_ledger := case p_decision when 'approve' then 'kafaa.sim.scenario.approve' when 'retire' then 'kafaa.sim.scenario.retire' end;
  if v_ledger is not null then l := kafaa_ledger(v_ledger, format('Simulator scenario %s rev %s: %s', x.code, x.revision, p_decision)); end if;
  a := kafaa_audit('sim.scenario.review', 'sim_scenarios', x.id, 'ok', format('%s rev %s', p_decision, x.revision),
    case when v_ledger is null then 'not_applicable' when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case p_decision when 'approve' then 'Scenario approved' when 'return' then 'Scenario returned to its author' else 'Scenario retired' end, a, l,
    jsonb_build_object('id', x.id, 'status', v_status));
end $$;

-- ───────────── Cycle plan (validatePlan, gapCount)
create or replace function kafaa_sim_validate_plan(p_items jsonb, c kafaa_sim_cycles) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare e jsonb; s kafaa_sim_scenarios; v_out jsonb := '[]'::jsonb; k integer; bad constant jsonb := '{"ok":false,"code":"invalid","key":"invalid_items"}'::jsonb;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 80 then return bad; end if;
  for e in select x from jsonb_array_elements(p_items) with ordinality as t(x, n) order by n loop
    if jsonb_typeof(e) <> 'object' or jsonb_typeof(e->'scenario_id') is distinct from 'string' or jsonb_typeof(e->'segment') is distinct from 'number'
       or (e->>'segment')::numeric <> trunc((e->>'segment')::numeric) then return bad; end if;
    if (e->>'segment')::numeric < 1 or (e->>'segment')::numeric > c.segments then return bad; end if;
    select * into s from kafaa_sim_scenarios where id = e->>'scenario_id';
    if s.id is null then return bad; end if;
    if s.status <> 'approved' then return '{"ok":false,"code":"scenario_not_approved","key":"scenario_not_approved"}'::jsonb; end if;
    if not (c.programme = any(s.programmes)) then return '{"ok":false,"code":"wrong_programme","key":"wrong_programme"}'::jsonb; end if;
    v_out := v_out || jsonb_build_array(jsonb_build_object('scenario_id', s.id, 'segment', (e->>'segment')::numeric::integer));
  end loop;
  if (select count(*) from jsonb_array_elements(v_out)) <> (select count(distinct (o->>'segment') || '|' || (o->>'scenario_id')) from jsonb_array_elements(v_out) o) then
    return '{"ok":false,"code":"duplicate","key":"duplicate"}'::jsonb; end if;
  for k in 1..c.segments loop
    if coalesce((select sum(sc.duration_min) from jsonb_array_elements(v_out) o join kafaa_sim_scenarios sc on sc.id = o->>'scenario_id' where (o->>'segment')::integer = k), 0) > 960 then
      return '{"ok":false,"code":"over_capacity","key":"over_capacity"}'::jsonb; end if;
  end loop;
  return jsonb_build_object('ok', true, 'value', coalesce((select jsonb_agg(o order by (o->>'segment')::integer, o->>'scenario_id' collate "C") from jsonb_array_elements(v_out) o), '[]'::jsonb));
end $$;
create or replace function kafaa_sim_gap_count(p_cycle text) returns integer language sql stable security definer set search_path = public as $$
  select count(*)::integer from kafaa_sim_cycles c cross join lateral jsonb_array_elements(c.requirements) r
  where c.id = p_cycle and (select count(*) from kafaa_sim_cycle_items i join kafaa_sim_scenarios s on s.id = i.scenario_id
                            where i.cycle_id = c.id and i.active and (r->>'objective_id') = any(s.objective_ids)) < (r->>'min_runs')::integer
$$;

-- ───────────── RPC: plan the scenarios of a cycle (sat W/A); optionally submit for approval
create or replace function kafaa_plan_cycle(p_cycle_id text, p_items jsonb, p_submit boolean default false) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; c kafaa_sim_cycles; v jsonb; v_keep text[]; o jsonb; v_status text := case when p_submit is true then 'submitted' else 'draft' end;
  v_ts timestamptz := date_trunc('second', now()); v_gaps integer; a kafaa_audit_events; v_n integer;
begin
  if me is null then return kafaa_sim_no('sim.cycle.plan', 'sim_cycles', nullif(p_cycle_id, ''), 'not_signed_in', 'not_signed_in'); end if;
  v_role := kafaa_acting_role('sat', array['W', 'A']);
  if v_role is null then return kafaa_sim_no('sim.cycle.plan', 'sim_cycles', nullif(p_cycle_id, ''), 'forbidden', 'forbidden'); end if;
  select * into c from kafaa_sim_cycles where id = coalesce(p_cycle_id, '');
  if c.id is null then return kafaa_sim_no('sim.cycle.plan', 'sim_cycles', nullif(p_cycle_id, ''), 'not_found', 'cycle_not_found', v_role); end if;
  if c.status = 'closed' then return kafaa_sim_no('sim.cycle.plan', 'sim_cycles', c.id, 'cycle_closed', 'cycle_closed', v_role); end if;
  v := kafaa_sim_validate_plan(p_items, c);
  if not (v->>'ok')::boolean then return kafaa_sim_no('sim.cycle.plan', 'sim_cycles', c.id, v->>'code', v->>'key', v_role); end if;
  v_keep := array(select 'sci:' || c.id || ':' || (x->>'scenario_id') || ':' || (x->>'segment') from jsonb_array_elements(v->'value') x);
  update kafaa_sim_cycle_items set active = false where cycle_id = c.id and active and not (id = any(v_keep));
  for o in select x from jsonb_array_elements(v->'value') x loop
    insert into kafaa_sim_cycle_items (id, cycle_id, scenario_id, segment, active, added_by, added_at)
    values ('sci:' || c.id || ':' || (o->>'scenario_id') || ':' || (o->>'segment'), c.id, o->>'scenario_id', (o->>'segment')::integer, true, me, v_ts)
    on conflict (id) do update set active = true, added_by = excluded.added_by, added_at = excluded.added_at where kafaa_sim_cycle_items.active = false;
  end loop;
  update kafaa_sim_cycles set status = v_status, planned_by = me, planned_at = v_ts, approved_by = null, approved_at = null, gap_note = null where id = c.id;
  v_gaps := kafaa_sim_gap_count(c.id);
  v_n := jsonb_array_length(v->'value');
  a := kafaa_audit('sim.cycle.plan', 'sim_cycles', c.id, 'ok', format('%s items; %s gaps; %s', v_n, v_gaps, v_status), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when v_status = 'submitted' then 'Cycle plan submitted for approval' else 'Cycle plan saved' end, a, null,
    jsonb_build_object('cycle_id', c.id, 'status', v_status, 'items', v_n, 'gaps', v_gaps));
end $$;

-- ───────────── RPC: approve a submitted cycle (sat A, not the planner; gaps need a reason)
create or replace function kafaa_approve_cycle(p_cycle_id text, p_gap_note text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; c kafaa_sim_cycles; v_gaps integer; v_note text := kafaa_sim_trim(p_gap_note); l integer; a kafaa_audit_events;
begin
  if me is null then return kafaa_sim_no('sim.cycle.approve', 'sim_cycles', nullif(p_cycle_id, ''), 'not_signed_in', 'not_signed_in'); end if;
  v_role := kafaa_acting_role('sat', array['A']);
  if v_role is null then return kafaa_sim_no('sim.cycle.approve', 'sim_cycles', nullif(p_cycle_id, ''), 'forbidden', 'forbidden_approve'); end if;
  select * into c from kafaa_sim_cycles where id = coalesce(p_cycle_id, '');
  if c.id is null then return kafaa_sim_no('sim.cycle.approve', 'sim_cycles', nullif(p_cycle_id, ''), 'not_found', 'cycle_not_found', v_role); end if;
  if c.status <> 'submitted' then return kafaa_sim_no('sim.cycle.approve', 'sim_cycles', c.id, 'not_submitted', 'not_submitted', v_role); end if;
  if c.planned_by = me then return kafaa_sim_no('sim.cycle.approve', 'sim_cycles', c.id, 'maker_checker', 'cycle_maker_checker', v_role); end if;
  v_gaps := kafaa_sim_gap_count(c.id);
  if v_gaps > 0 and length(v_note) not between 10 and 1000 then return kafaa_sim_no('sim.cycle.approve', 'sim_cycles', c.id, 'coverage_gaps', 'coverage_gaps', v_role); end if;
  update kafaa_sim_cycles set status = 'approved', approved_by = me, approved_at = date_trunc('second', now()), gap_note = case when v_gaps > 0 then v_note end where id = c.id;
  perform kafaa_sim_notify(c.planned_by, 'Simulator cycle approved: ' || c.label_en, 'اعتُمدت خطة دورة المحاكي: ' || c.label_ar, '/training/simulator/scenarios', 'ok');
  l := kafaa_ledger('kafaa.sim.cycle.approve', format('Simulator cycle %s approved (%s coverage gaps)', c.id, v_gaps));
  a := kafaa_audit('sim.cycle.approve', 'sim_cycles', c.id, 'ok', format('approved with %s gaps', v_gaps), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Cycle plan approved', a, l, jsonb_build_object('cycle_id', c.id, 'status', 'approved', 'gaps', v_gaps));
end $$;

-- ───────────── Crew debriefs
create or replace function kafaa_sim_position(p_role text) returns text language sql immutable set search_path = public as $$
  select case p_role when 'shift-supervisor' then 'ss' when 'senior-reactor-operator' then 'sro' when 'reactor-operator' then 'ro' when 'shift-technical-advisor' then 'sta' when 'local-operator' then 'lo' end
$$;
-- cleanRatings: all four team competencies, integers 1..5, no other keys; null otherwise
create or replace function kafaa_sim_clean_ratings(j jsonb) returns jsonb language plpgsql immutable set search_path = public as $$
declare d text; v_out jsonb := '{}'::jsonb;
begin
  if jsonb_typeof(j) is distinct from 'object' then return null; end if;
  if exists (select 1 from jsonb_object_keys(j) k where not (k = any(array['communication', 'procedure_use', 'diagnosis', 'leadership']::text[]))) then return null; end if;
  foreach d in array array['communication', 'procedure_use', 'diagnosis', 'leadership']::text[] loop
    if jsonb_typeof(j->d) is distinct from 'number' or (j->>d)::numeric <> trunc((j->>d)::numeric) or (j->>d)::numeric not between 1 and 5 then return null; end if;
    v_out := v_out || jsonb_build_object(d, (j->>d)::numeric::integer);
  end loop;
  return v_out;
end $$;
create or replace function kafaa_sim_evidence_level(p integer) returns integer language sql immutable set search_path = public as $$
  select case when p >= 4 then 3 when p = 3 then 2 else 0 end
$$;
-- debriefStatements: xAPI 2.0-shaped "completed" statement for one crew member present
create or replace function kafaa_sim_statement(p_debrief text, p_slot text, p_scenario text, p_cycle text, p_crew text, p_held date, p_ratings jsonb, p_person text, p_position text)
returns jsonb language sql immutable set search_path = public as $$
  with m as (select floor(((p_ratings->>'communication')::integer + (p_ratings->>'procedure_use')::integer + (p_ratings->>'diagnosis')::integer + (p_ratings->>'leadership')::integer) * 100 / 4.0 + 0.5) / 100 as v)
  select jsonb_build_object('actor_person_id', p_person, 'verb', 'http://adlnet.gov/expapi/verbs/completed', 'object_type', 'scenario', 'object_id', p_scenario,
    'result', jsonb_build_object('score', jsonb_build_object('scaled', (round(floor((m.v / 5) * 100 + 0.5) / 100, 2))::float8), 'success', m.v >= 3,
      'extensions', jsonb_build_object('communication', (p_ratings->>'communication')::integer, 'procedure_use', (p_ratings->>'procedure_use')::integer, 'diagnosis', (p_ratings->>'diagnosis')::integer, 'leadership', (p_ratings->>'leadership')::integer)),
    'context', jsonb_build_object('platform', 'kafaa', 'registration', p_debrief, 'extensions', jsonb_build_object('slot_id', p_slot, 'crew', p_crew, 'cycle_id', p_cycle, 'position', p_position)),
    'timestamp', to_char(p_held, 'YYYY-MM-DD') || 'T00:00:00Z')
  from m
$$;

create or replace function kafaa_record_debrief(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; v_entity text; sl kafaa_simulator_slots; s kafaa_sim_scenarios; c kafaa_sim_cycles; v_id text; v_held date; v_att jsonb := p->'attendance';
  v_ratings jsonb; v_self jsonb; v_texts text[]; v_issue text; v_lang text := case when p->>'lang' = 'ar' then 'ar' else 'en' end; r record; v_mid text; v_eids text[];
  v_level integer; v_skill text; d text; v_evidence integer := 0; v_present integer := 0; v_total integer := 0; v_stmts jsonb := '[]'::jsonb;
  l integer; a kafaa_audit_events;
begin
  v_entity := case when coalesce(p->>'slot_id', '') <> '' and coalesce(p->>'scenario_id', '') <> '' then 'cd:' || (p->>'slot_id') || ':' || (p->>'scenario_id') end;
  if me is null then return kafaa_sim_no('sim.debrief', 'crew_debriefs', v_entity, 'not_signed_in', 'not_signed_in'); end if;
  v_role := kafaa_acting_role('sat', array['W', 'A']);
  if v_role is null then return kafaa_sim_no('sim.debrief', 'crew_debriefs', v_entity, 'forbidden', 'forbidden_debrief'); end if;
  select * into sl from kafaa_simulator_slots where id = coalesce(p->>'slot_id', '');
  if sl.id is null then return kafaa_sim_no('sim.debrief', 'crew_debriefs', v_entity, 'slot_not_found', 'slot_not_found', v_role); end if;
  if sl.status <> 'booked' or sl.crew is null or sl.booking_kind in ('free', 'maintenance') then return kafaa_sim_no('sim.debrief', 'crew_debriefs', v_entity, 'slot_not_booked', 'slot_not_booked', v_role); end if;
  if sl.starts_at > now() then return kafaa_sim_no('sim.debrief', 'crew_debriefs', v_entity, 'slot_not_started', 'slot_not_started', v_role); end if;
  select * into s from kafaa_sim_scenarios where id = coalesce(p->>'scenario_id', '');
  if s.id is null then return kafaa_sim_no('sim.debrief', 'crew_debriefs', v_entity, 'not_found', 'not_found', v_role); end if;
  if s.status <> 'approved' then return kafaa_sim_no('sim.debrief', 'crew_debriefs', v_entity, 'scenario_not_approved', 'scenario_not_approved', v_role); end if;
  v_held := (sl.starts_at at time zone 'UTC')::date;
  if coalesce(p->>'cycle_id', '') <> '' then
    select * into c from kafaa_sim_cycles where id = p->>'cycle_id';
    if c.id is null then return kafaa_sim_no('sim.debrief', 'crew_debriefs', v_entity, 'not_found', 'cycle_not_found', v_role); end if;
    if not (c.programme = any(s.programmes)) or v_held < c.starts_on or v_held > c.ends_on then return kafaa_sim_no('sim.debrief', 'crew_debriefs', v_entity, 'wrong_cycle', 'wrong_cycle', v_role); end if;
  end if;
  v_id := 'cd:' || sl.id || ':' || s.id;
  if exists (select 1 from kafaa_crew_debriefs where id = v_id) then return kafaa_sim_no('sim.debrief', 'crew_debriefs', v_entity, 'already_recorded', 'already_recorded', v_role); end if;
  if jsonb_typeof(v_att) is distinct from 'array' or jsonb_array_length(v_att) = 0
     or exists (select 1 from jsonb_array_elements(v_att) e where jsonb_typeof(e) <> 'object' or jsonb_typeof(e->'person_id') is distinct from 'string' or jsonb_typeof(e->'present') is distinct from 'boolean')
     or (select count(distinct e->>'person_id') from jsonb_array_elements(v_att) e) <> jsonb_array_length(v_att) then
    return kafaa_sim_no('sim.debrief', 'crew_debriefs', v_entity, 'invalid', 'no_attendees', v_role); end if;
  if exists (select 1 from jsonb_array_elements(v_att) e where not exists (
      select 1 from kafaa_people pp where pp.id = e->>'person_id' and pp.crew = sl.crew and pp.kind = 'staff' and pp.status = 'active' and kafaa_sim_position(pp.job_role_id) is not null)) then
    return kafaa_sim_no('sim.debrief', 'crew_debriefs', v_entity, 'not_in_slot', 'not_in_slot', v_role); end if;
  if not exists (select 1 from jsonb_array_elements(v_att) e where (e->>'present')::boolean) then return kafaa_sim_no('sim.debrief', 'crew_debriefs', v_entity, 'no_attendees', 'no_attendees', v_role); end if;
  v_ratings := kafaa_sim_clean_ratings(p->'ratings');
  v_self := case when jsonb_typeof(p->'self_ratings') is null or jsonb_typeof(p->'self_ratings') = 'null' then null else kafaa_sim_clean_ratings(p->'self_ratings') end;
  if v_ratings is null or (jsonb_typeof(p->'self_ratings') is not null and jsonb_typeof(p->'self_ratings') <> 'null' and v_self is null) then
    return kafaa_sim_no('sim.debrief', 'crew_debriefs', v_entity, 'invalid_ratings', 'invalid_ratings', v_role); end if;
  v_texts := array[kafaa_sim_trim(p->>'strengths'), kafaa_sim_trim(p->>'improvements'), kafaa_sim_trim(p->>'critique')];
  if exists (select 1 from unnest(v_texts) t where length(t) > 2000) then return kafaa_sim_no('sim.debrief', 'crew_debriefs', v_entity, 'invalid', 'invalid_debrief_text', v_role); end if;
  v_issue := kafaa_sim_content_issue(v_texts);
  if v_issue is not null then return kafaa_sim_no('sim.debrief', 'crew_debriefs', v_entity, v_issue, v_issue, v_role); end if;
  for r in select e->>'person_id' as pid, (e->>'present')::boolean as present, kafaa_sim_position(pp.job_role_id) as pos
           from jsonb_array_elements(v_att) e join kafaa_people pp on pp.id = e->>'person_id' order by e->>'person_id' collate "C" loop
    v_mid := v_id || ':' || r.pid;
    v_eids := '{}'::text[];
    v_total := v_total + 1;
    if r.present then
      v_present := v_present + 1;
      foreach d in array array['procedure_use', 'communication', 'leadership', 'diagnosis']::text[] loop
        v_level := kafaa_sim_evidence_level((v_ratings->>d)::integer);
        continue when v_level = 0;
        v_skill := case d when 'communication' then 'sk-co-02' when 'procedure_use' then 'sk-co-01' when 'diagnosis' then 'sk-pf-03' when 'leadership' then 'sk-ld-01' end;
        insert into kafaa_skill_evidence (id, person_id, skill_id, kind, ref_table, ref_id, level, basis, status, observed_on, note, recorded_by, active, created_at)
        values ('se:ojt:' || v_mid || ':' || v_skill, r.pid, v_skill, 'ojt', 'crew_debrief_members', v_mid, v_level, 'evidenced', 'current', v_held,
                'Simulator crew debrief: ' || s.title_en, me, true, now())
        on conflict (id) do update set level = excluded.level, observed_on = excluded.observed_on, active = true;
        v_eids := v_eids || ('se:ojt:' || v_mid || ':' || v_skill);
      end loop;
      v_evidence := v_evidence + cardinality(v_eids);
      v_stmts := v_stmts || jsonb_build_array(kafaa_sim_statement(v_id, sl.id, s.id, c.id, sl.crew, v_held, v_ratings, r.pid, r.pos));
    end if;
    insert into kafaa_crew_debrief_members (id, debrief_id, person_id, crew, position, present, scenario_id, held_on, evidence_ids)
    values (v_mid, v_id, r.pid, sl.crew, r.pos, r.present, s.id, v_held, v_eids);
  end loop;
  -- F30 hand-off: the statements stay on the debrief (kafaa_crew_debriefs.xapi); the LRS f28_simulator emitter (W4 · E4) stores them
  insert into kafaa_crew_debriefs (id, slot_id, scenario_id, cycle_id, crew, simulator, held_on, instructor_person_id, ratings, self_ratings,
    strengths_en, strengths_ar, improvements_en, improvements_ar, critique_en, critique_ar, present_count, absent_count, evidence_count, xapi, recorded_at, source)
  values (v_id, sl.id, s.id, c.id, sl.crew, sl.simulator, v_held, me, v_ratings, v_self,
    case when v_lang = 'en' then nullif(v_texts[1], '') end, case when v_lang = 'ar' then nullif(v_texts[1], '') end,
    case when v_lang = 'en' then nullif(v_texts[2], '') end, case when v_lang = 'ar' then nullif(v_texts[2], '') end,
    case when v_lang = 'en' then nullif(v_texts[3], '') end, case when v_lang = 'ar' then nullif(v_texts[3], '') end,
    v_present, v_total - v_present, v_evidence, v_stmts, date_trunc('second', now()), 'kafaa');
  update kafaa_sim_scenarios set last_run_on = greatest(coalesce(last_run_on, v_held), v_held), run_count = run_count + 1 where id = s.id;
  for r in select e->>'person_id' as pid from jsonb_array_elements(v_att) e where (e->>'present')::boolean order by e->>'person_id' collate "C" loop
    perform kafaa_skills_apply(r.pid, current_date);
    perform kafaa_sim_notify(r.pid, 'Simulator debrief recorded: ' || s.title_en, 'سُجّل استخلاص جلسة المحاكي: ' || s.title_ar, '/my/simulator', 'info');
  end loop;
  l := kafaa_ledger('kafaa.sim.debrief', format('Crew %s debrief for %s on %s (%s present)', sl.crew, s.code, v_held, v_present));
  a := kafaa_audit('sim.debrief', 'crew_debriefs', v_id, 'ok', format('crew %s; %s present, %s absent; %s evidence rows', sl.crew, v_present, v_total - v_present, v_evidence),
    case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Debrief recorded; crew skills evidence updated', a, l, jsonb_build_object('id', v_id, 'present', v_present, 'absent', v_total - v_present,
    'evidence', v_evidence, 'statements', jsonb_array_length(v_stmts)));
end $$;

-- ───────────── Read RPC: debriefs the caller may see (sat: all; else own or in scope through skills_profile)
create or replace function kafaa_sim_debriefs() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); v_all boolean;
begin
  if me is null then return '[]'::jsonb; end if;
  v_all := kafaa_has_grant('sat', array['R', 'W', 'A']);
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', d.id, 'slot_id', d.slot_id, 'scenario_id', d.scenario_id, 'cycle_id', d.cycle_id, 'crew', d.crew, 'simulator', d.simulator, 'held_on', to_char(d.held_on, 'YYYY-MM-DD'),
      'instructor_person_id', d.instructor_person_id, 'ratings', d.ratings, 'self_ratings', d.self_ratings,
      'strengths_en', d.strengths_en, 'strengths_ar', d.strengths_ar, 'improvements_en', d.improvements_en, 'improvements_ar', d.improvements_ar,
      'critique_en', d.critique_en, 'critique_ar', d.critique_ar,
      'scenario', jsonb_build_object('id', d.scenario_id, 'code', coalesce(s.code, ''), 'title_en', coalesce(s.title_en, ''), 'title_ar', coalesce(s.title_ar, ''), 'category', coalesce(s.category, '')),
      'members', coalesce((select jsonb_agg(jsonb_build_object('person_id', m.person_id, 'position', m.position, 'present', m.present, 'evidence', cardinality(m.evidence_ids)) order by m.id collate "C")
                           from kafaa_crew_debrief_members m where m.debrief_id = d.id), '[]'::jsonb),
      'source', d.source,
      'mine', exists (select 1 from kafaa_crew_debrief_members m where m.debrief_id = d.id and m.person_id = me))
    order by d.held_on desc, d.id collate "C")
    from kafaa_crew_debriefs d left join kafaa_sim_scenarios s on s.id = d.scenario_id
    where v_all or exists (select 1 from kafaa_crew_debrief_members m where m.debrief_id = d.id and kafaa_rule_read('skills_profile', m.person_id, null, false))), '[]'::jsonb);
end $$;

revoke execute on function kafaa_sim_msg(text), kafaa_sim_no(text, text, text, text, text, text), kafaa_sim_trim(text), kafaa_sim_slen(jsonb), kafaa_sim_str_arr(jsonb),
  kafaa_sim_sortu(text[]), kafaa_sim_norm(text), kafaa_sim_content_issue(text[]), kafaa_sim_validate(jsonb), kafaa_sim_hist(text, integer, text, text),
  kafaa_sim_notify(text, text, text, text, text), kafaa_sim_validate_plan(jsonb, kafaa_sim_cycles), kafaa_sim_gap_count(text), kafaa_sim_position(text),
  kafaa_sim_clean_ratings(jsonb), kafaa_sim_evidence_level(integer), kafaa_sim_statement(text, text, text, text, text, date, jsonb, text, text) from public, anon, authenticated;
revoke execute on function kafaa_save_sim_scenario(jsonb), kafaa_review_sim_scenario(text, text, text), kafaa_plan_cycle(text, jsonb, boolean), kafaa_approve_cycle(text, text),
  kafaa_record_debrief(jsonb), kafaa_sim_debriefs() from public, anon;
grant execute on function kafaa_save_sim_scenario(jsonb), kafaa_review_sim_scenario(text, text, text), kafaa_plan_cycle(text, jsonb, boolean), kafaa_approve_cycle(text, text),
  kafaa_record_debrief(jsonb), kafaa_sim_debriefs() to authenticated;
