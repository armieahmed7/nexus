-- [FS wave F · E5 · FS58 + FS59] Adaptive problem-solving practice and the role-play practice library with saved feedback (M33 Human Skills Studio).
-- FS58: PIAAC-style scenarios (OECD Survey of Adult Skills, Cycle 2, adaptive problem solving): the first stage sets the plan; every later stage
--   is a mid-task change revealed only after the earlier choice (check kafaa_aps_scenarios_change_ck: at least one change). Per stage the person
--   judges which facts matter now (monitoring) and picks an option (expert effectiveness 0-3). Scored by kafaa_aps_score (= scoreAps in
--   src/modules/m33/aps.ts) on Kafa'a's own 0-100 practice scale with four bands; never the PIAAC scale, never converted to it. Practice only:
--   attempts are Own-only (RLS own_profile), never write skill evidence, never reach the ledger, never gate a qualification; HR sees suppressed
--   aggregates (kafaa_aps_stats_core = apsStats); the training manager edits the bank (secure_items A; kafaa_aps_problem = apsScenarioProblem).
-- FS59: ENEC-authored role-play scenarios (pre-job brief, shift turnover, raising a concern, inspection-style interview practice, knowledge
--   transfer, coaching a peer on an AI output) with the rubric published in EN and AR. The deterministic rubric (kafaa_rp_norm / kafaa_rp_eval /
--   kafaa_rp_summary = rpNorm / evaluateTurn / summarise in src/modules/m33/roleplay.ts) keeps the ticks and word counts, never the answer
--   text. A speak-up topic (kafaa_rp_speak_up = speakUpTopic) returns code speak_up before anything is written: no session change and no audit
--   row (M08 rule), and the page routes the person to /speak-up. A completed session at or above its mark can be sent to a named reviewer
--   (recognition A: instructor, training manager, HR authority; never the person); validation writes F01 evidence se:roleplay:<session>:<skill>
--   (kind rating, basis validated, ref_table roleplay_sessions, level 1-2), recomputes skills and writes one NEXUS ledger row.
-- Shared (handover 3.9): kafaa_skill_states_v2 / kafaa_skills_apply redefined from the fs5qa body; only the two recorded ref_table lists gain
--   'roleplay_sessions' (between @@SHARED-BEGIN@@ and @@SHARED-END@@). Integration lead: union with any other wave-F token in the fs6qa migration.
-- PGlite parity and checks: scripts/validate/fs65-aps-roleplay.mjs. Tests: tests/unit/fs65-*.
-- Additive and idempotent: kafaa_* objects only; ALTER only on kafaa_* tables; never touches a NEXUS object or row; nothing is removed.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file; policies created once (never replaced), then
-- given the perf form (caller-only helpers evaluated once per statement, as scripts/gen-rls-perf.mjs writes them).

-- ───────────── Tables (generated DDL, additive)
create table if not exists kafaa_aps_scenarios (
  id text primary key,
  code text not null unique,
  theme text not null check (theme in ('outage_schedule', 'conflicting_data', 'supply_delay', 'staffing_change', 'weather_logistics', 'procedure_revision', 'digital_tool_outage', 'priority_conflict')),
  title_en text not null,
  title_ar text not null,
  summary_en text not null,
  summary_ar text not null,
  context_en text not null,
  context_ar text not null,
  core_skill_ids text[] not null default '{}'::text[],
  skill_ids text[] not null default '{}'::text[],
  difficulty integer not null default 2,
  est_minutes integer not null default 10,
  stages jsonb not null default '[]'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  version integer not null default 1,
  sort integer not null default 0,
  updated_by text,
  updated_at timestamptz not null default now()
);
comment on table kafaa_aps_scenarios is '[M33] Adaptive problem-solving practice scenario (PIAAC-style, EN/AR): the first plan, then one or more mid-task changes revealed only after the earlier choice; per stage the facts to judge and 3-4 options with expert effectiveness 0-3, a why each and the debrief; training staff read the key, takers get stages without it (FS58)';
create table if not exists kafaa_aps_attempts (
  id text primary key,
  person_id text not null,
  scenario_id text not null,
  scenario_version integer not null default 1,
  attempt_no integer not null,
  period text not null,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  stage_ids text[] not null default '{}'::text[],
  responses jsonb not null default '[]'::jsonb,
  points integer,
  max_points integer,
  score integer,
  band text check (band in ('emerging', 'developing', 'adaptive', 'strategic')),
  dims jsonb not null default '{}'::jsonb,
  reasons jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
comment on table kafaa_aps_attempts is '[M33] One person''s adaptive problem-solving practice run: the stages answered (choice, facts picked, effectiveness), points, the 0-100 practice score, band and dimensions. Own only: never a manager, HR, talent review or a qualification (FS58)';
create table if not exists kafaa_roleplay_scenarios (
  id text primary key,
  code text not null unique,
  kind text not null check (kind in ('pre_job_brief', 'shift_turnover', 'raise_concern', 'regulator_interview', 'knowledge_transfer', 'ai_peer_coaching')),
  title_en text not null,
  title_ar text not null,
  summary_en text not null,
  summary_ar text not null,
  setting_en text not null,
  setting_ar text not null,
  counterpart_en text not null,
  counterpart_ar text not null,
  role_en text not null,
  role_ar text not null,
  core_skill_ids text[] not null default '{}'::text[],
  skill_ids text[] not null default '{}'::text[],
  level integer not null default 1,
  pass_pct integer not null default 70,
  est_minutes integer not null default 15,
  turns jsonb not null default '[]'::jsonb,
  rubric jsonb not null default '[]'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  listed boolean not null default false,
  version integer not null default 1,
  sort integer not null default 0,
  updated_by text,
  updated_at timestamptz not null default now()
);
comment on table kafaa_roleplay_scenarios is '[M33] ENEC-authored role-play practice scenario (EN/AR): the setting, the counterpart, 3-5 turns with hints and example answers, and the published deterministic rubric (criteria with what each looks for and a tip); staff read published ones (listed), training staff all (FS59)';
create table if not exists kafaa_roleplay_sessions (
  id text primary key,
  person_id text not null,
  scenario_id text not null,
  scenario_version integer not null default 1,
  period text not null,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  turns jsonb not null default '[]'::jsonb,
  passed integer,
  total integer,
  pct integer,
  ready boolean not null default false,
  reasons jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  review_status text not null default 'none' check (review_status in ('none', 'requested', 'validated', 'declined', 'withdrawn')),
  reviewer_id text,
  review_context text,
  requested_at timestamptz,
  reviewed_by text,
  reviewed_at timestamptz,
  review_note text,
  level integer not null default 0,
  evidence_ids text[] not null default '{}'::text[]
);
comment on table kafaa_roleplay_sessions is '[M33] One person''s role-play practice session: the rubric ticks and word count per turn and the summary (never the answer text); the review request to a named reviewer and, once validated, the evidence written. Own only; the named reviewer sees a requested session through the review queue RPC (FS59)';
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_aps_attempts_person_id_fk') then alter table kafaa_aps_attempts add constraint kafaa_aps_attempts_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_aps_attempts_scenario_id_fk') then alter table kafaa_aps_attempts add constraint kafaa_aps_attempts_scenario_id_fk foreign key (scenario_id) references kafaa_aps_scenarios(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_roleplay_sessions_person_id_fk') then alter table kafaa_roleplay_sessions add constraint kafaa_roleplay_sessions_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_roleplay_sessions_scenario_id_fk') then alter table kafaa_roleplay_sessions add constraint kafaa_roleplay_sessions_scenario_id_fk foreign key (scenario_id) references kafaa_roleplay_scenarios(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_roleplay_sessions_reviewer_id_fk') then alter table kafaa_roleplay_sessions add constraint kafaa_roleplay_sessions_reviewer_id_fk foreign key (reviewer_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_aps_scenarios_theme_idx on kafaa_aps_scenarios (theme);
create index if not exists kafaa_aps_scenarios_status_idx on kafaa_aps_scenarios (status);
create index if not exists kafaa_aps_attempts_person_id_idx on kafaa_aps_attempts (person_id);
create index if not exists kafaa_aps_attempts_scenario_id_idx on kafaa_aps_attempts (scenario_id);
create index if not exists kafaa_aps_attempts_period_idx on kafaa_aps_attempts (period);
create index if not exists kafaa_aps_attempts_status_idx on kafaa_aps_attempts (status);
create index if not exists kafaa_roleplay_scenarios_kind_idx on kafaa_roleplay_scenarios (kind);
create index if not exists kafaa_roleplay_scenarios_status_idx on kafaa_roleplay_scenarios (status);
create index if not exists kafaa_roleplay_sessions_person_id_idx on kafaa_roleplay_sessions (person_id);
create index if not exists kafaa_roleplay_sessions_scenario_id_idx on kafaa_roleplay_sessions (scenario_id);
create index if not exists kafaa_roleplay_sessions_period_idx on kafaa_roleplay_sessions (period);
create index if not exists kafaa_roleplay_sessions_status_idx on kafaa_roleplay_sessions (status);
create index if not exists kafaa_roleplay_sessions_review_status_idx on kafaa_roleplay_sessions (review_status);
create index if not exists kafaa_roleplay_sessions_reviewer_id_idx on kafaa_roleplay_sessions (reviewer_id);

-- ───────────── Checks (additive constraints on the new tables only)
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_aps_scenarios_change_ck') then
  alter table kafaa_aps_scenarios add constraint kafaa_aps_scenarios_change_ck check (jsonb_path_exists(stages, '$[*] ? (@.kind == "change")')); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_aps_attempts_score_ck') then
  alter table kafaa_aps_attempts add constraint kafaa_aps_attempts_score_ck check (score is null or score between 0 and 100); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_roleplay_sessions_level_ck') then
  alter table kafaa_roleplay_sessions add constraint kafaa_roleplay_sessions_level_ck check (level between 0 and 2); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_roleplay_sessions_review_ck') then
  alter table kafaa_roleplay_sessions add constraint kafaa_roleplay_sessions_review_ck check (review_status not in ('validated', 'declined') or reviewed_by is not null); end if; end $$;

-- ───────────── RLS (generated rules created once, then the perf form)
alter table kafaa_aps_scenarios enable row level security;
alter table kafaa_aps_attempts enable row level security;
alter table kafaa_roleplay_scenarios enable row level security;
alter table kafaa_roleplay_sessions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_aps_scenarios' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_aps_scenarios for select to anon, authenticated using (kafaa_rule_read(''secure_items'', null::text, null::text, true))'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_aps_attempts' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_aps_attempts for select to anon, authenticated using (kafaa_rule_read(''own_profile'', person_id, null::text, true))'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_roleplay_scenarios' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_roleplay_scenarios for select to anon, authenticated using (kafaa_rule_read(''internal_content'', null::text, null::text, listed) or kafaa_rule_read(''secure_items'', null::text, null::text, true))'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_roleplay_sessions' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_roleplay_sessions for select to anon, authenticated using (kafaa_rule_read(''own_profile'', person_id, null::text, true))'; end if;
end $$;
alter policy kafaa_read on kafaa_aps_scenarios using ((((SELECT kafaa_has_grant('secure_items'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_aps_attempts using ((((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false))));
alter policy kafaa_read on kafaa_roleplay_scenarios using ((((COALESCE(listed, false) AND (SELECT kafaa_has_grant('internal_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))) OR (((SELECT kafaa_has_grant('secure_items'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))))));
alter policy kafaa_read on kafaa_roleplay_sessions using ((((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false))));
revoke all on kafaa_aps_scenarios, kafaa_aps_attempts, kafaa_roleplay_scenarios, kafaa_roleplay_sessions from anon, authenticated;
grant select on kafaa_aps_scenarios, kafaa_aps_attempts, kafaa_roleplay_scenarios, kafaa_roleplay_sessions to anon, authenticated;

-- ───────────── FS58 rules (mirror of src/modules/m33/aps.ts)
-- apsPct: round half up, integers only.
create or replace function kafaa_aps_pct(p_pts integer, p_max integer) returns integer language sql immutable set search_path = public as $$
  select case when coalesce(p_max, 0) > 0 then (200 * p_pts + p_max) / (2 * p_max) else 0 end
$$;
create or replace function kafaa_aps_band(p_score integer) returns text language sql immutable set search_path = public as $$
  select case when p_score >= 80 then 'strategic' when p_score >= 60 then 'adaptive' when p_score >= 40 then 'developing' else 'emerging' end
$$;
create or replace function kafaa_aps_band_name(p_band text) returns jsonb language sql immutable set search_path = public as $$
  select case p_band when 'emerging' then '{"en":"Emerging","ar":"في البداية"}'::jsonb when 'developing' then '{"en":"Developing","ar":"قيد التطوير"}'::jsonb
    when 'adaptive' then '{"en":"Adaptive","ar":"متكيّف"}'::jsonb else '{"en":"Strategic","ar":"استراتيجي"}'::jsonb end
$$;
create or replace function kafaa_aps_dim_name(p_dim text) returns jsonb language sql immutable set search_path = public as $$
  select case p_dim when 'plan' then '{"en":"Setting the first plan","ar":"وضع الخطة الأولى"}'::jsonb when 'monitor' then '{"en":"Noticing what matters","ar":"ملاحظة ما يهم"}'::jsonb
    else '{"en":"Revising the plan when things change","ar":"مراجعة الخطة عند تغيّر الظروف"}'::jsonb end
$$;
create or replace function kafaa_aps_theme_name(p_theme text) returns jsonb language sql immutable set search_path = public as $$
  select case p_theme
    when 'outage_schedule' then '{"en":"Outage schedule slip","ar":"تأخر جدول الصيانة الدورية"}'::jsonb
    when 'conflicting_data' then '{"en":"Data that disagree","ar":"بيانات متعارضة"}'::jsonb
    when 'supply_delay' then '{"en":"Supply delay","ar":"تأخر التوريد"}'::jsonb
    when 'staffing_change' then '{"en":"Staffing change","ar":"تغيّر في الطاقم"}'::jsonb
    when 'weather_logistics' then '{"en":"Weather and logistics","ar":"الطقس والخدمات اللوجستية"}'::jsonb
    when 'procedure_revision' then '{"en":"Procedure revised mid-job","ar":"تعديل الإجراء أثناء العمل"}'::jsonb
    when 'digital_tool_outage' then '{"en":"Digital tool outage","ar":"تعطل أداة رقمية"}'::jsonb
    when 'priority_conflict' then '{"en":"Competing priorities","ar":"أولويات متنافسة"}'::jsonb
    else jsonb_build_object('en', p_theme, 'ar', p_theme) end
$$;
create or replace function kafaa_aps_changes(p_stages jsonb) returns integer language sql immutable set search_path = public as $$
  select count(*)::integer from jsonb_array_elements(coalesce(p_stages, '[]'::jsonb)) e where e ->> 'kind' = 'change'
$$;
create or replace function kafaa_aps_stage(p_stages jsonb, p_id text) returns jsonb language sql immutable set search_path = public as $$
  select e from jsonb_array_elements(coalesce(p_stages, '[]'::jsonb)) with ordinality q(e, i) where e ->> 'id' = p_id order by i limit 1
$$;
-- stageView: never the effectiveness, notes, keep flag, relevance or debrief.
create or replace function kafaa_aps_stage_view(p_st jsonb) returns jsonb language sql immutable set search_path = public as $$
  select case when p_st is null then null else jsonb_build_object('id', p_st -> 'id', 'kind', p_st -> 'kind', 'info_en', p_st -> 'info_en', 'info_ar', p_st -> 'info_ar',
    'question_en', p_st -> 'question_en', 'question_ar', p_st -> 'question_ar',
    'options', (select coalesce(jsonb_agg(jsonb_build_object('en', o -> 'en', 'ar', o -> 'ar') order by i), '[]'::jsonb) from jsonb_array_elements(p_st -> 'options') with ordinality q(o, i)),
    'cues', (select coalesce(jsonb_agg(jsonb_build_object('en', c -> 'en', 'ar', c -> 'ar') order by i), '[]'::jsonb) from jsonb_array_elements(coalesce(p_st -> 'cues', '[]'::jsonb)) with ordinality q(c, i))) end
$$;
create or replace function kafaa_aps_header(s kafaa_aps_scenarios) returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object('id', s.id, 'code', s.code, 'theme', s.theme, 'title_en', s.title_en, 'title_ar', s.title_ar, 'context_en', s.context_en, 'context_ar', s.context_ar,
    'difficulty', s.difficulty, 'est_minutes', s.est_minutes, 'stages', jsonb_array_length(s.stages), 'changes', kafaa_aps_changes(s.stages))
$$;
-- judgeStage: effectiveness of the chosen option, facts judged correctly, keep flags.
create or replace function kafaa_aps_judge(p_st jsonb, p_choice integer, p_picks integer[]) returns jsonb language plpgsql immutable set search_path = public as $$
declare v_effs integer[]; v_best integer; v_rel boolean[]; v_ok integer := 0; i integer;
begin
  select array_agg((o ->> 'eff')::integer order by k) into v_effs from jsonb_array_elements(p_st -> 'options') with ordinality q(o, k);
  select (k - 1)::integer into v_best from unnest(v_effs) with ordinality q(e, k) order by e desc, k limit 1;
  select coalesce(array_agg(coalesce((c ->> 'relevant')::boolean, false) order by k), '{}'::boolean[]) into v_rel from jsonb_array_elements(coalesce(p_st -> 'cues', '[]'::jsonb)) with ordinality q(c, k);
  for i in 1 .. coalesce(cardinality(v_rel), 0) loop
    if v_rel[i] = ((i - 1) = any(coalesce(p_picks, '{}'::integer[]))) then v_ok := v_ok + 1; end if;
  end loop;
  return jsonb_build_object('stage_id', p_st ->> 'id', 'kind', p_st ->> 'kind', 'choice', p_choice, 'eff', v_effs[p_choice + 1], 'best', v_best, 'effs', to_jsonb(v_effs),
    'notes_en', (select jsonb_agg(o -> 'note_en' order by k) from jsonb_array_elements(p_st -> 'options') with ordinality q(o, k)),
    'notes_ar', (select jsonb_agg(o -> 'note_ar' order by k) from jsonb_array_elements(p_st -> 'options') with ordinality q(o, k)),
    'relevant', to_jsonb(v_rel), 'picks', to_jsonb(coalesce(p_picks, '{}'::integer[])), 'cue_ok', v_ok, 'cue_n', coalesce(cardinality(v_rel), 0),
    'kept', coalesce(((p_st -> 'options' -> p_choice) ->> 'keep')::boolean, false), 'best_keep', coalesce(((p_st -> 'options' -> v_best) ->> 'keep')::boolean, false),
    'debrief_en', p_st ->> 'debrief_en', 'debrief_ar', p_st ->> 'debrief_ar');
end $$;
create or replace function kafaa_aps_response(p_fb jsonb) returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object('stage_id', p_fb -> 'stage_id', 'kind', p_fb -> 'kind', 'choice', p_fb -> 'choice', 'picks', p_fb -> 'picks', 'eff', p_fb -> 'eff',
    'cue_ok', p_fb -> 'cue_ok', 'cue_n', p_fb -> 'cue_n', 'kept', p_fb -> 'kept', 'best_keep', p_fb -> 'best_keep')
$$;
-- scoreAps: plan / monitor / adapt points, the 0-100 practice score, band and reasons.
create or replace function kafaa_aps_score(p_resp jsonb) returns jsonb language plpgsql immutable set search_path = public as $$
declare pp integer := 0; pm integer := 0; mp integer := 0; mm integer := 0; ap integer := 0; am integer := 0; r jsonb; v_pts integer; v_max integer; v_score integer; v_band text;
  v_dims jsonb; v_reasons jsonb; s record; d record; v_changes integer := 0; v_okc integer := 0; v_held boolean := false; v_over boolean := false;
begin
  for r in select e from jsonb_array_elements(coalesce(p_resp, '[]'::jsonb)) e loop
    if r ->> 'kind' = 'change' then
      ap := ap + (r ->> 'eff')::integer * 2; am := am + 6; v_changes := v_changes + 1;
      if (r ->> 'eff')::integer >= 2 then v_okc := v_okc + 1; end if;
      if coalesce((r ->> 'kept')::boolean, false) and not coalesce((r ->> 'best_keep')::boolean, false) then v_held := true; end if;
      if not coalesce((r ->> 'kept')::boolean, false) and coalesce((r ->> 'best_keep')::boolean, false) then v_over := true; end if;
    else
      pp := pp + (r ->> 'eff')::integer * 2; pm := pm + 6;
    end if;
    mp := mp + (r ->> 'cue_ok')::integer; mm := mm + (r ->> 'cue_n')::integer;
  end loop;
  v_pts := pp + mp + ap; v_max := pm + mm + am; v_score := kafaa_aps_pct(v_pts, v_max); v_band := kafaa_aps_band(v_score);
  v_dims := jsonb_build_object(
    'plan', jsonb_build_object('pts', pp, 'max', pm, 'pct', case when pm > 0 then kafaa_aps_pct(pp, pm) end),
    'monitor', jsonb_build_object('pts', mp, 'max', mm, 'pct', case when mm > 0 then kafaa_aps_pct(mp, mm) end),
    'adapt', jsonb_build_object('pts', ap, 'max', am, 'pct', case when am > 0 then kafaa_aps_pct(ap, am) end));
  v_reasons := jsonb_build_array(jsonb_build_object('code', 'aps_score', 'key', 'm33.aps.reason.score', 'vars', jsonb_build_object('score', v_score, 'band', kafaa_aps_band_name(v_band))));
  if (select count(*) from (values (pm), (mm), (am)) x(m) where m > 0) > 1 then
    select k, pct into s from (values ('plan', 1, case when pm > 0 then kafaa_aps_pct(pp, pm) end), ('monitor', 2, case when mm > 0 then kafaa_aps_pct(mp, mm) end),
      ('adapt', 3, case when am > 0 then kafaa_aps_pct(ap, am) end)) x(k, i, pct) where pct is not null order by pct desc, i limit 1;
    select k, pct into d from (values ('plan', 1, case when pm > 0 then kafaa_aps_pct(pp, pm) end), ('monitor', 2, case when mm > 0 then kafaa_aps_pct(mp, mm) end),
      ('adapt', 3, case when am > 0 then kafaa_aps_pct(ap, am) end)) x(k, i, pct) where pct is not null order by pct asc, i limit 1;
    if s.pct > d.pct then
      v_reasons := v_reasons || jsonb_build_array(
        jsonb_build_object('code', 'aps_strong', 'key', 'm33.aps.reason.strong', 'vars', jsonb_build_object('dim', kafaa_aps_dim_name(s.k), 'pct', s.pct)),
        jsonb_build_object('code', 'aps_develop', 'key', 'm33.aps.reason.develop', 'vars', jsonb_build_object('dim', kafaa_aps_dim_name(d.k), 'pct', d.pct)));
    end if;
  end if;
  if v_changes > 0 then v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'aps_changes', 'key', 'm33.aps.reason.changes', 'vars', jsonb_build_object('ok', v_okc, 'n', v_changes))); end if;
  if v_held then v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'aps_held', 'key', 'm33.aps.reason.held')); end if;
  if v_over then v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'aps_overreact', 'key', 'm33.aps.reason.overreact')); end if;
  v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'aps_private', 'key', 'm33.aps.reason.private'));
  return jsonb_build_object('points', v_pts, 'max_points', v_max, 'score', v_score, 'band', v_band, 'dims', v_dims, 'reasons', v_reasons);
end $$;
-- pickScenario: published scenarios rotated by the person's seed and the attempt number, least finished first.
create or replace function kafaa_aps_pick(p_person text, p_no integer) returns text language sql stable security definer set search_path = public as $$
  with pool as (select id, (row_number() over (order by sort, id collate "C") - 1)::integer as i from kafaa_aps_scenarios where status = 'published'),
  nn as (select count(*)::integer as n from pool),
  o as (select nn.n, case when nn.n = 0 then 0 else ((kafaa_sjt_seed(p_person) + (p_no - 1)) % nn.n + nn.n) % nn.n end as off from nn),
  dn as (select scenario_id, count(*)::integer as c from kafaa_aps_attempts where person_id = p_person and status = 'completed' group by 1)
  select pool.id from pool cross join o left join dn on dn.scenario_id = pool.id order by coalesce(dn.c, 0), (pool.i - o.off + o.n) % o.n limit 1
$$;
create or replace function kafaa_aps_next_reasons(p_theme text, p_stages jsonb, p_mine integer) returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_array(
    jsonb_build_object('code', 'aps_next', 'key', 'm33.aps.reason.next', 'vars', jsonb_build_object('theme', kafaa_aps_theme_name(p_theme), 'n', p_mine)),
    jsonb_build_object('code', 'aps_next_changes', 'key', 'm33.aps.reason.nextChanges', 'vars', jsonb_build_object('changes', kafaa_aps_changes(p_stages))))
$$;
create or replace function kafaa_aps_txt(p jsonb, p_max integer) returns boolean language sql immutable set search_path = public as $$
  select jsonb_typeof(p) = 'string' and char_length(btrim(p #>> '{}')) between 1 and p_max
$$;
create or replace function kafaa_aps_int(p jsonb, p_lo integer, p_hi integer) returns boolean language sql immutable set search_path = public as $$
  select jsonb_typeof(p) = 'number' and (p #>> '{}')::numeric = floor((p #>> '{}')::numeric) and (p #>> '{}')::numeric between p_lo and p_hi
$$;
-- apsScenarioProblem: the first problem with a scenario, or null.
create or replace function kafaa_aps_problem(p jsonb) returns text language plpgsql stable security definer set search_path = public as $$
declare st jsonb; o jsonb; c jsonb; n integer; v_keeps integer; v_all text;
begin
  if p is null or jsonb_typeof(p -> 'code') is distinct from 'string' or (p ->> 'code') !~ '^APS-[A-Z]{2}-[0-9]{3}$' then return 'code'; end if;
  if jsonb_typeof(p -> 'theme') is distinct from 'string' or (p ->> 'theme') not in ('outage_schedule', 'conflicting_data', 'supply_delay', 'staffing_change', 'weather_logistics',
      'procedure_revision', 'digital_tool_outage', 'priority_conflict') then return 'theme'; end if;
  if not (kafaa_aps_txt(p -> 'title_en', 140) and kafaa_aps_txt(p -> 'title_ar', 140) and kafaa_aps_txt(p -> 'summary_en', 400) and kafaa_aps_txt(p -> 'summary_ar', 400)
      and kafaa_aps_txt(p -> 'context_en', 1200) and kafaa_aps_txt(p -> 'context_ar', 1200)) then return 'text'; end if;
  if jsonb_typeof(p -> 'core_skill_ids') is distinct from 'array' or jsonb_array_length(p -> 'core_skill_ids') not between 1 and 3
     or exists (select 1 from jsonb_array_elements(p -> 'core_skill_ids') e where jsonb_typeof(e) <> 'string' or not exists (select 1 from kafaa_core_skills cs where cs.id = e #>> '{}' and cs.status = 'active')) then return 'core_skill'; end if;
  if jsonb_typeof(p -> 'skill_ids') is distinct from 'array' or jsonb_array_length(p -> 'skill_ids') not between 1 and 4
     or exists (select 1 from jsonb_array_elements(p -> 'skill_ids') e where jsonb_typeof(e) <> 'string' or not exists (select 1 from kafaa_skills s where s.id = e #>> '{}' and coalesce(s.lifecycle, '') <> 'obsolete')) then return 'skills'; end if;
  if not kafaa_aps_int(p -> 'difficulty', 1, 3) then return 'difficulty'; end if;
  if not kafaa_aps_int(p -> 'est_minutes', 5, 30) then return 'minutes'; end if;
  if jsonb_typeof(p -> 'stages') is distinct from 'array' or jsonb_array_length(p -> 'stages') not between 2 and 4 then return 'stages'; end if;
  if (p -> 'stages' -> 0 ->> 'kind') is distinct from 'initial'
     or exists (select 1 from jsonb_array_elements(p -> 'stages') with ordinality q(e, i) where jsonb_typeof(e) <> 'object' or jsonb_typeof(e -> 'id') is distinct from 'string'
       or (e ->> 'id') !~ '^[a-z0-9-]{1,24}$' or (i > 1 and (e ->> 'kind') is distinct from 'change' and (e ->> 'kind') is distinct from 'initial'))
     or (select count(distinct e ->> 'id') from jsonb_array_elements(p -> 'stages') e) <> jsonb_array_length(p -> 'stages') then return 'first_stage'; end if;
  if not exists (select 1 from jsonb_array_elements(p -> 'stages') with ordinality q(e, i) where i > 1 and e ->> 'kind' = 'change')
     or exists (select 1 from jsonb_array_elements(p -> 'stages') with ordinality q(e, i) where i > 1 and (e ->> 'kind') is distinct from 'change') then return 'no_change'; end if;
  for st in select e from jsonb_array_elements(p -> 'stages') with ordinality q(e, i) order by i loop
    if not (kafaa_aps_txt(st -> 'info_en', 900) and kafaa_aps_txt(st -> 'info_ar', 900) and kafaa_aps_txt(st -> 'question_en', 300) and kafaa_aps_txt(st -> 'question_ar', 300)
        and kafaa_aps_txt(st -> 'debrief_en', 900) and kafaa_aps_txt(st -> 'debrief_ar', 900)) then return 'stage_text'; end if;
    o := st -> 'options';
    if jsonb_typeof(o) is distinct from 'array' or jsonb_array_length(o) not between 3 and 4
       or exists (select 1 from jsonb_array_elements(o) x where jsonb_typeof(x) <> 'object' or not (kafaa_aps_txt(x -> 'en', 300) and kafaa_aps_txt(x -> 'ar', 300)
         and kafaa_aps_txt(x -> 'note_en', 400) and kafaa_aps_txt(x -> 'note_ar', 400))) then return 'options'; end if;
    if exists (select 1 from jsonb_array_elements(o) x where not kafaa_aps_int(x -> 'eff', 0, 3))
       or (select count(*) from jsonb_array_elements(o) x where (x ->> 'eff')::numeric = 3) <> 1 then return 'key'; end if;
    select count(*) into v_keeps from jsonb_array_elements(o) x where jsonb_typeof(x -> 'keep') = 'boolean' and (x ->> 'keep')::boolean;
    if (st ->> 'kind' = 'initial' and v_keeps > 0) or v_keeps > 1
       or exists (select 1 from jsonb_array_elements(o) x where x ? 'keep' and jsonb_typeof(x -> 'keep') not in ('null', 'boolean')) then return 'keep'; end if;
    c := case when st -> 'cues' is null or jsonb_typeof(st -> 'cues') = 'null' then '[]'::jsonb else st -> 'cues' end;
    if jsonb_typeof(c) <> 'array' then return 'cues'; end if;
    n := jsonb_array_length(c);
    if (n > 0 and n not between 3 and 5)
       or exists (select 1 from jsonb_array_elements(c) x where jsonb_typeof(x) <> 'object' or not (kafaa_aps_txt(x -> 'en', 240) and kafaa_aps_txt(x -> 'ar', 240)) or jsonb_typeof(x -> 'relevant') is distinct from 'boolean')
       or (n > 0 and (not exists (select 1 from jsonb_array_elements(c) x where (x ->> 'relevant')::boolean) or not exists (select 1 from jsonb_array_elements(c) x where not (x ->> 'relevant')::boolean))) then return 'cues'; end if;
  end loop;
  select lower(array_to_string(array[coalesce(p ->> 'title_en', ''), coalesce(p ->> 'title_ar', ''), coalesce(p ->> 'summary_en', ''), coalesce(p ->> 'summary_ar', ''),
      coalesce(p ->> 'context_en', ''), coalesce(p ->> 'context_ar', '')]
    || coalesce((select array_agg(t order by i, j) from jsonb_array_elements(p -> 'stages') with ordinality q(e, i) cross join lateral (
         select t, j from unnest(array[coalesce(e ->> 'info_en', ''), coalesce(e ->> 'info_ar', ''), coalesce(e ->> 'question_en', ''), coalesce(e ->> 'question_ar', ''),
           coalesce(e ->> 'debrief_en', ''), coalesce(e ->> 'debrief_ar', '')]) with ordinality u(t, j)
         union all
         select t, 6 + (k - 1) * 4 + jj from jsonb_array_elements(coalesce(e -> 'options', '[]'::jsonb)) with ordinality qo(x, k)
           cross join lateral unnest(array[coalesce(x ->> 'en', ''), coalesce(x ->> 'ar', ''), coalesce(x ->> 'note_en', ''), coalesce(x ->> 'note_ar', '')]) with ordinality u(t, jj)
         union all
         select t, 1000 + (k - 1) * 2 + jj from jsonb_array_elements(coalesce(e -> 'cues', '[]'::jsonb)) with ordinality qc(x, k)
           cross join lateral unnest(array[coalesce(x ->> 'en', ''), coalesce(x ->> 'ar', '')]) with ordinality u(t, jj)) z), '{}'::text[]), ' ')) into v_all;
  if exists (select 1 from unnest(array['vital area', 'protected area', 'security plan', 'guard force', 'design basis threat', 'safeguards', 'physical protection',
      'alarm station', 'access code', 'firewall rule', 'network diagram', 'ip address', 'patrol route', 'badge reader']) w where position(w in v_all) > 0) then return 'restricted'; end if;
  if p ? 'status' and jsonb_typeof(p -> 'status') <> 'null' and coalesce(p ->> 'status', '') not in ('draft', 'published', 'retired') then return 'status'; end if;
  return null;
end $$;
-- apsStats: completed runs by active staff in the last four quarters; pooled points; every cell under 10 people suppressed.
create or replace function kafaa_aps_stats_core(p_today date) returns jsonb language sql stable security definer set search_path = public as $$
  with win as (select kafaa_cs_quarter_shift(kafaa_cs_quarter(p_today), -k) as q, 3 - k as ord from generate_series(0, 3) k),
  done as (
    select a.id, a.person_id, a.scenario_id, a.period, a.points, a.max_points, a.band, a.dims, a.completed_at, s.theme
    from kafaa_aps_attempts a join kafaa_people pe on pe.id = a.person_id and pe.kind = 'staff' and pe.status = 'active'
    left join kafaa_aps_scenarios s on s.id = a.scenario_id
    where a.status = 'completed' and a.score is not null and a.max_points is not null and a.period in (select q from win)),
  tot as (select count(distinct person_id)::integer as ppl, count(*)::integer as n, coalesce(sum(points), 0)::integer as pts, coalesce(sum(max_points), 0)::integer as mx from done),
  latest as (select distinct on (person_id) person_id, band from done order by person_id, completed_at desc nulls last, period desc, id collate "C" desc)
  select jsonb_build_object(
    'participants', case when t.ppl >= 10 then t.ppl end,
    'attempts', case when t.ppl >= 10 then t.n end,
    'avg', case when t.ppl >= 10 and t.mx > 0 then kafaa_aps_pct(t.pts, t.mx) end,
    'bands', (select jsonb_agg(jsonb_build_object('band', b.band, 'people', case when t.ppl >= 10 and b.n >= 10 then b.n end) order by b.ord)
      from (select x.band, x.ord, (select count(*)::integer from latest l where l.band = x.band) as n from (values ('emerging', 1), ('developing', 2), ('adaptive', 3), ('strategic', 4)) x(band, ord)) b),
    'dims', (select jsonb_agg(jsonb_build_object('dim', dd.dim, 'pct', case when t.ppl >= 10 and dd.mx > 0 then kafaa_aps_pct(dd.pts, dd.mx) end) order by dd.ord)
      from (select x.dim, x.ord, coalesce((select sum(coalesce((d.dims -> x.dim ->> 'pts')::integer, 0)) from done d), 0)::integer as pts,
        coalesce((select sum(coalesce((d.dims -> x.dim ->> 'max')::integer, 0)) from done d), 0)::integer as mx from (values ('plan', 1), ('monitor', 2), ('adapt', 3)) x(dim, ord)) dd),
    'by_quarter', (select jsonb_agg(jsonb_build_object('period', w.q, 'people', case when g.p >= 10 then g.p end, 'attempts', case when g.p >= 10 then g.n end,
        'avg', case when g.p >= 10 and g.mx > 0 then kafaa_aps_pct(g.pts, g.mx) end) order by w.ord)
      from win w cross join lateral (select count(distinct person_id)::integer as p, count(*)::integer as n, coalesce(sum(points), 0)::integer as pts, coalesce(sum(max_points), 0)::integer as mx from done where period = w.q) g),
    'by_theme', (select jsonb_agg(jsonb_build_object('theme', th.theme, 'people', case when g.p >= 10 then g.p end, 'avg', case when g.p >= 10 and g.mx > 0 then kafaa_aps_pct(g.pts, g.mx) end) order by th.ord)
      from (values ('outage_schedule', 1), ('conflicting_data', 2), ('supply_delay', 3), ('staffing_change', 4), ('weather_logistics', 5), ('procedure_revision', 6), ('digital_tool_outage', 7), ('priority_conflict', 8)) th(theme, ord)
      cross join lateral (select count(distinct person_id)::integer as p, coalesce(sum(points), 0)::integer as pts, coalesce(sum(max_points), 0)::integer as mx from done where theme = th.theme) g))
  from tot t
$$;

-- ───────────── FS58 RPCs (skills_profile Own; HR Agg; bank secure_items A). Practice only: never skill evidence, never the ledger, never a gate.
create or replace function kafaa_aps_result(at kafaa_aps_attempts) returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object('attempt_id', at.id, 'scenario_id', at.scenario_id, 'period', at.period, 'points', at.points, 'max_points', at.max_points, 'score', at.score,
    'band', at.band, 'dims', at.dims, 'reasons', at.reasons, 'stages', jsonb_array_length(at.responses))
$$;
create or replace function kafaa_start_aps(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_in text := case when jsonb_typeof(p -> 'scenario_id') = 'string' then nullif(p ->> 'scenario_id', '') end; v_sid text;
  v_open kafaa_aps_attempts; sc kafaa_aps_scenarios; v_no integer; v_id text; v_n integer; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('aps.start', 'aps_attempts', null, 'not_signed_in', 'Sign in to practise adaptive problem solving'); end if;
  if not kafaa_has_grant('skills_profile', array['Own']) then return kafaa_refuse('aps.start', 'aps_attempts', null, 'forbidden', 'Problem-solving practice is for ENEC staff'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  select * into v_open from kafaa_aps_attempts where person_id = me and status = 'in_progress' order by started_at desc, id collate "C" desc limit 1;
  if v_open.id is not null and (v_in is null or v_open.scenario_id = v_in) then
    select * into sc from kafaa_aps_scenarios where id = v_open.scenario_id;
    if sc.id is not null then
      v_n := jsonb_array_length(v_open.responses);
      a := kafaa_audit('aps.start', 'aps_attempts', v_open.id, 'ok', 'resumed', 'not_applicable', null, v_role);
      return kafaa_result(true, 'ok', 'Practice resumed', a, null, jsonb_build_object('attempt_id', v_open.id, 'scenario', kafaa_aps_header(sc), 'done', false, 'answered', v_n,
        'total', coalesce(cardinality(v_open.stage_ids), 0), 'stage', kafaa_aps_stage_view(kafaa_aps_stage(sc.stages, v_open.stage_ids[v_n + 1])), 'feedback', null, 'result', null, 'resumed', true));
    end if;
  end if;
  v_sid := v_in;
  if v_sid is not null and not exists (select 1 from kafaa_aps_scenarios where id = v_sid and status = 'published') then
    return kafaa_refuse('aps.start', 'aps_attempts', null, 'not_found', 'Scenario not found or not published', v_role); end if;
  if v_open.id is not null then update kafaa_aps_attempts set status = 'abandoned' where id = v_open.id; end if;
  select count(*) + 1 into v_no from kafaa_aps_attempts where person_id = me;
  if v_sid is null then v_sid := kafaa_aps_pick(me, v_no); end if;
  if v_sid is null then return kafaa_refuse('aps.start', 'aps_attempts', null, 'unavailable', 'No published scenarios yet; ask the training manager', v_role); end if;
  select * into sc from kafaa_aps_scenarios where id = v_sid;
  v_id := 'aps-a-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
  insert into kafaa_aps_attempts (id, person_id, scenario_id, scenario_version, attempt_no, period, status, stage_ids, responses, points, max_points, score, band, dims, reasons, started_at, completed_at)
  values (v_id, me, v_sid, sc.version, v_no, kafaa_cs_quarter(current_date), 'in_progress', (select array_agg(e ->> 'id' order by i) from jsonb_array_elements(sc.stages) with ordinality q(e, i)),
    '[]'::jsonb, null, null, null, null, '{}'::jsonb, '[]'::jsonb, now(), null);
  a := kafaa_audit('aps.start', 'aps_attempts', v_id, 'ok', v_sid, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Practice started', a, null, jsonb_build_object('attempt_id', v_id, 'scenario', kafaa_aps_header(sc), 'done', false, 'answered', 0,
    'total', jsonb_array_length(sc.stages), 'stage', kafaa_aps_stage_view(sc.stages -> 0), 'feedback', null, 'result', null, 'resumed', false));
end $$;

create or replace function kafaa_submit_aps(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_aid text := case when jsonb_typeof(p -> 'attempt_id') = 'string' then p ->> 'attempt_id' else '' end; at kafaa_aps_attempts; sc kafaa_aps_scenarios;
  v_cur text; st jsonb; v_choice integer; v_cues integer; v_picks integer[]; v_fb jsonb; v_resp jsonb; v_next text; s jsonb; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('aps.answer', 'aps_attempts', nullif(v_aid, ''), 'not_signed_in', 'Sign in to practise adaptive problem solving'); end if;
  if not kafaa_has_grant('skills_profile', array['Own']) then return kafaa_refuse('aps.answer', 'aps_attempts', nullif(v_aid, ''), 'forbidden', 'Problem-solving practice is for ENEC staff'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  select * into at from kafaa_aps_attempts where id = v_aid for update;
  if at.id is null or at.person_id <> me then return kafaa_refuse('aps.answer', 'aps_attempts', nullif(v_aid, ''), 'not_found', 'Practice run not found', v_role); end if;
  if at.status <> 'in_progress' then return kafaa_refuse('aps.answer', 'aps_attempts', v_aid, 'invalid', 'This practice run is already complete', v_role); end if;
  v_cur := at.stage_ids[jsonb_array_length(at.responses) + 1];
  if jsonb_typeof(p -> 'stage_id') is distinct from 'string' or coalesce(p ->> 'stage_id', '') = '' or p ->> 'stage_id' is distinct from v_cur then
    return kafaa_refuse('aps.answer', 'aps_attempts', v_aid, 'invalid', 'Answer the stage on screen first', v_role); end if;
  select * into sc from kafaa_aps_scenarios where id = at.scenario_id;
  st := kafaa_aps_stage(sc.stages, v_cur);
  if sc.id is null or st is null then return kafaa_refuse('aps.answer', 'aps_attempts', v_aid, 'not_found', 'Scenario not found', v_role); end if;
  if jsonb_typeof(p -> 'choice') is distinct from 'number' or (p ->> 'choice')::numeric <> floor((p ->> 'choice')::numeric)
     or (p ->> 'choice')::numeric < 0 or (p ->> 'choice')::numeric >= jsonb_array_length(st -> 'options') then
    return kafaa_refuse('aps.answer', 'aps_attempts', v_aid, 'invalid', 'Choose one of the options', v_role); end if;
  v_choice := (p ->> 'choice')::integer;
  v_cues := jsonb_array_length(coalesce(st -> 'cues', '[]'::jsonb));
  if p -> 'picks' is null or jsonb_typeof(p -> 'picks') = 'null' then v_picks := '{}'::integer[];
  elsif jsonb_typeof(p -> 'picks') <> 'array' or exists (select 1 from jsonb_array_elements(p -> 'picks') e where jsonb_typeof(e) <> 'number'
      or (e #>> '{}')::numeric <> floor((e #>> '{}')::numeric) or (e #>> '{}')::numeric < 0 or (e #>> '{}')::numeric >= v_cues) then
    return kafaa_refuse('aps.answer', 'aps_attempts', v_aid, 'invalid', 'Pick facts from the list shown', v_role);
  else
    select coalesce(array_agg(x order by x), '{}'::integer[]) into v_picks from (select distinct ((e #>> '{}')::numeric)::integer as x from jsonb_array_elements(p -> 'picks') e) d;
  end if;
  v_fb := kafaa_aps_judge(st, v_choice, v_picks);
  v_resp := at.responses || jsonb_build_array(kafaa_aps_response(v_fb));
  v_next := at.stage_ids[jsonb_array_length(v_resp) + 1];
  if v_next is not null then
    update kafaa_aps_attempts set responses = v_resp where id = v_aid;
    a := kafaa_audit('aps.answer', 'aps_attempts', v_aid, 'ok', jsonb_array_length(v_resp)::text, 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Answer recorded', a, null, jsonb_build_object('attempt_id', v_aid, 'scenario', kafaa_aps_header(sc), 'done', false,
      'answered', jsonb_array_length(v_resp), 'total', coalesce(cardinality(at.stage_ids), 0), 'stage', kafaa_aps_stage_view(kafaa_aps_stage(sc.stages, v_next)), 'feedback', v_fb, 'result', null));
  end if;
  s := kafaa_aps_score(v_resp);
  update kafaa_aps_attempts set responses = v_resp, status = 'completed', completed_at = now(), points = (s ->> 'points')::integer, max_points = (s ->> 'max_points')::integer,
    score = (s ->> 'score')::integer, band = s ->> 'band', dims = s -> 'dims', reasons = s -> 'reasons' where id = v_aid returning * into at;
  a := kafaa_audit('aps.complete', 'aps_attempts', v_aid, 'ok', s ->> 'score', 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Practice complete', a, null, jsonb_build_object('attempt_id', v_aid, 'scenario', kafaa_aps_header(sc), 'done', true,
    'answered', jsonb_array_length(v_resp), 'total', coalesce(cardinality(at.stage_ids), 0), 'stage', null, 'feedback', v_fb, 'result', kafaa_aps_result(at)));
end $$;

create or replace function kafaa_aps_context() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); v_open kafaa_aps_attempts; v_no integer; v_next text; st jsonb; v_items jsonb; v_done integer;
begin
  if me is null or not kafaa_has_grant('skills_profile', array['Own']) then return null; end if;
  select * into v_open from kafaa_aps_attempts where person_id = me and status = 'in_progress' order by started_at desc, id collate "C" desc limit 1;
  select count(*) + 1 into v_no from kafaa_aps_attempts where person_id = me;
  select count(*) into v_done from kafaa_aps_attempts where person_id = me and status = 'completed';
  v_next := kafaa_aps_pick(me, v_no);
  st := kafaa_aps_stats_core(current_date);
  select coalesce(jsonb_agg(kafaa_aps_header(s) || jsonb_build_object('summary_en', s.summary_en, 'summary_ar', s.summary_ar, 'core_skill_ids', to_jsonb(s.core_skill_ids), 'skill_ids', to_jsonb(s.skill_ids),
      'mine', m.n, 'best', m.best, 'last', m.last) order by s.sort, s.id collate "C"), '[]'::jsonb) into v_items
  from kafaa_aps_scenarios s cross join lateral (
    select count(*)::integer as n, max(a.score) as best, (array_agg(a.score order by a.completed_at desc nulls last, a.id collate "C" desc))[1] as last
    from kafaa_aps_attempts a where a.person_id = me and a.scenario_id = s.id and a.status = 'completed') m
  where s.status = 'published';
  return jsonb_build_object('period', kafaa_cs_quarter(current_date),
    'in_progress', case when v_open.id is null then null else jsonb_build_object('attempt_id', v_open.id, 'scenario_id', v_open.scenario_id) end,
    'scenarios', v_items, 'completed', v_done, 'enec_avg', st -> 'avg', 'enec_n', case when st ->> 'avg' is null then null else st -> 'participants' end,
    'next', (select jsonb_build_object('scenario_id', s.id, 'reasons', kafaa_aps_next_reasons(s.theme, s.stages,
        (select count(*)::integer from kafaa_aps_attempts a where a.person_id = me and a.scenario_id = s.id and a.status = 'completed'))) from kafaa_aps_scenarios s where s.id = v_next));
end $$;

create or replace function kafaa_aps_stats() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if kafaa_me() is null or not kafaa_has_grant('skills_profile', array['Agg']) then return null; end if;
  return kafaa_aps_stats_core(current_date);
end $$;

create or replace function kafaa_save_aps_scenario(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_given text := case when jsonb_typeof(p -> 'id') = 'string' then nullif(p ->> 'id', '') end; cur kafaa_aps_scenarios; v_problem text;
  v_status text; v_id text; v_version integer; v_sort integer; v_stages jsonb; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('aps.scenario', 'aps_scenarios', v_given, 'not_signed_in', 'Sign in to practise adaptive problem solving'); end if;
  if not kafaa_has_grant('secure_items', array['A']) then return kafaa_refuse('aps.scenario', 'aps_scenarios', v_given, 'forbidden', 'Only the training manager edits the scenario bank'); end if;
  v_role := kafaa_acting_role('secure_items', array['A']);
  if v_given is not null then
    select * into cur from kafaa_aps_scenarios where id = v_given;
    if cur.id is null then return kafaa_refuse('aps.scenario', 'aps_scenarios', v_given, 'not_found', 'Scenario not found', v_role); end if;
  end if;
  v_problem := kafaa_aps_problem(p);
  if v_problem is not null then
    return kafaa_refuse('aps.scenario', 'aps_scenarios', v_given, 'invalid', 'Check the scenario: ' || case v_problem
      when 'code' then 'a code like APS-OS-001' when 'theme' then 'a known theme' when 'text' then 'title, summary and context in English and Arabic'
      when 'core_skill' then 'one to three core skills' when 'skills' then 'one to four catalogue skills' when 'difficulty' then 'difficulty 1 to 3' when 'minutes' then '5 to 30 minutes'
      when 'stages' then 'two to four stages' when 'first_stage' then 'the first stage sets the plan (stage ids a-z, 0-9, -)'
      when 'no_change' then 'every later stage is a mid-task change, and there is at least one'
      when 'stage_text' then 'every stage needs its situation, question and debrief in English and Arabic' when 'options' then 'three or four options with a why in both languages'
      when 'key' then 'rate every option 0-3 with exactly one best (3)' when 'keep' then 'only a change stage may mark one option as keeping the plan'
      when 'cues' then 'facts to judge: none, or three to five with at least one that matters and one that does not' when 'restricted' then 'scenarios never touch plant security'
      else 'status draft, published or retired' end, v_role);
  end if;
  if exists (select 1 from kafaa_aps_scenarios where code = p ->> 'code' and id is distinct from cur.id) then
    return kafaa_refuse('aps.scenario', 'aps_scenarios', v_given, 'conflict', 'Another scenario already uses this code', v_role); end if;
  v_status := case when p ->> 'status' in ('published', 'retired') then p ->> 'status' else 'draft' end;
  if cur.id is not null and cur.status = 'published' and v_status <> 'published' and (select count(*) from kafaa_aps_scenarios where status = 'published' and id <> cur.id) < 3 then
    return kafaa_refuse('aps.scenario', 'aps_scenarios', v_given, 'conflict', 'Keep at least three published scenarios', v_role); end if;
  select jsonb_agg(jsonb_build_object('id', e ->> 'id', 'kind', e ->> 'kind', 'info_en', btrim(e ->> 'info_en'), 'info_ar', btrim(e ->> 'info_ar'),
      'question_en', btrim(e ->> 'question_en'), 'question_ar', btrim(e ->> 'question_ar'),
      'options', (select jsonb_agg(jsonb_build_object('en', btrim(o ->> 'en'), 'ar', btrim(o ->> 'ar'), 'eff', ((o ->> 'eff')::numeric)::integer, 'note_en', btrim(o ->> 'note_en'), 'note_ar', btrim(o ->> 'note_ar'))
          || case when jsonb_typeof(o -> 'keep') = 'boolean' and (o ->> 'keep')::boolean then '{"keep":true}'::jsonb else '{}'::jsonb end order by k) from jsonb_array_elements(e -> 'options') with ordinality qo(o, k)),
      'cues', (select coalesce(jsonb_agg(jsonb_build_object('en', btrim(c ->> 'en'), 'ar', btrim(c ->> 'ar'), 'relevant', (c ->> 'relevant')::boolean) order by k), '[]'::jsonb)
          from jsonb_array_elements(case when jsonb_typeof(e -> 'cues') = 'array' then e -> 'cues' else '[]'::jsonb end) with ordinality qc(c, k)),
      'debrief_en', btrim(e ->> 'debrief_en'), 'debrief_ar', btrim(e ->> 'debrief_ar')) order by i) into v_stages
  from jsonb_array_elements(p -> 'stages') with ordinality q(e, i);
  if cur.id is not null then
    v_id := cur.id; v_version := cur.version + 1;
    update kafaa_aps_scenarios set code = p ->> 'code', theme = p ->> 'theme', title_en = btrim(p ->> 'title_en'), title_ar = btrim(p ->> 'title_ar'), summary_en = btrim(p ->> 'summary_en'),
      summary_ar = btrim(p ->> 'summary_ar'), context_en = btrim(p ->> 'context_en'), context_ar = btrim(p ->> 'context_ar'),
      core_skill_ids = array(select jsonb_array_elements_text(p -> 'core_skill_ids')), skill_ids = array(select jsonb_array_elements_text(p -> 'skill_ids')),
      difficulty = (p ->> 'difficulty')::integer, est_minutes = (p ->> 'est_minutes')::integer, stages = v_stages, status = v_status, version = v_version, updated_by = me, updated_at = now()
    where id = v_id;
  else
    v_id := 'aps-' || lower(p ->> 'code') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6); v_version := 1;
    select coalesce(max(sort), 0) + 1 into v_sort from kafaa_aps_scenarios;
    insert into kafaa_aps_scenarios (id, code, theme, title_en, title_ar, summary_en, summary_ar, context_en, context_ar, core_skill_ids, skill_ids, difficulty, est_minutes, stages, sources, status, version, sort, updated_by, updated_at)
    values (v_id, p ->> 'code', p ->> 'theme', btrim(p ->> 'title_en'), btrim(p ->> 'title_ar'), btrim(p ->> 'summary_en'), btrim(p ->> 'summary_ar'), btrim(p ->> 'context_en'), btrim(p ->> 'context_ar'),
      array(select jsonb_array_elements_text(p -> 'core_skill_ids')), array(select jsonb_array_elements_text(p -> 'skill_ids')), (p ->> 'difficulty')::integer, (p ->> 'est_minutes')::integer,
      v_stages, '[]'::jsonb, v_status, 1, v_sort, me, now());
  end if;
  a := kafaa_audit('aps.scenario', 'aps_scenarios', v_id, 'ok', 'v' || v_version || ' ' || v_status, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when cur.id is not null then 'Scenario saved' else 'Scenario added' end, a, null, jsonb_build_object('id', v_id, 'version', v_version, 'status', v_status));
end $$;

-- ───────────── FS59 rules (mirror of src/modules/m33/roleplay.ts)
-- rpNorm: ASCII lower case only (the same on every locale), Arabic diacritics and tatweel removed, alef / ya / ta marbuta / hamza forms
-- unified, Arabic-Indic digits to Latin, every listed punctuation or space character to one space, padded with one space on each side.
create or replace function kafaa_rp_norm(p text) returns text language sql immutable set search_path = public as $$
  select ' ' || btrim(regexp_replace(translate(regexp_replace(coalesce(p, ''), '[' || chr(1611) || '-' || chr(1631) || chr(1648) || chr(1600) || ']', '', 'g'),
    'ABCDEFGHIJKLMNOPQRSTUVWXYZإأآٱىةؤئ٠١٢٣٤٥٦٧٨٩' || ' ' || chr(9) || chr(10) || chr(13) || chr(160) || '.,;:!?"''()[]{}<>/\|@#$%^&*+=~`_،؛؟«»…–—-',
    'abcdefghijklmnopqrstuvwxyzاااايهوي0123456789' || repeat(' ', 45)), ' +', ' ', 'g')) || ' '
$$;
-- cueKey: the normalised words a cue looks for (a trailing "*" removed).
create or replace function kafaa_rp_cue_key(p_cue text) returns text language sql immutable set search_path = public as $$
  select btrim(kafaa_rp_norm(case when right(btrim(coalesce(p_cue, '')), 1) = '*' then left(btrim(coalesce(p_cue, '')), -1) else coalesce(p_cue, '') end))
$$;
-- cueHit: whole words; a cue ending in "*" matches the start of a word.
create or replace function kafaa_rp_cue_hit(p_norm text, p_cue text) returns boolean language sql immutable set search_path = public as $$
  select case when kafaa_rp_cue_key(p_cue) = '' then false
    when right(btrim(coalesce(p_cue, '')), 1) = '*' then position(' ' || kafaa_rp_cue_key(p_cue) in p_norm) > 0
    else position(' ' || kafaa_rp_cue_key(p_cue) || ' ' in p_norm) > 0 end
$$;
create or replace function kafaa_rp_words(p_norm text) returns integer language sql immutable set search_path = public as $$
  select case when btrim(coalesce(p_norm, '')) = '' then 0 else array_length(string_to_array(btrim(p_norm), ' '), 1) end
$$;
-- checkPasses: one rubric check on one answer.
create or replace function kafaa_rp_check(p_check jsonb, p_raw text, p_norm text) returns boolean language sql immutable set search_path = public as $$
  select case p_check ->> 'type'
    when 'cues' then (select count(distinct kafaa_rp_cue_key(q)) from jsonb_array_elements_text(coalesce(p_check -> 'cues', '[]'::jsonb)) q where kafaa_rp_cue_hit(p_norm, q))
      >= greatest(1, coalesce((p_check ->> 'min')::numeric, 1))
    when 'length' then kafaa_rp_words(p_norm) >= coalesce((p_check ->> 'min')::numeric, 0) and kafaa_rp_words(p_norm) <= coalesce((p_check ->> 'max')::numeric, 100000)
    when 'question' then position('?' in coalesce(p_raw, '')) > 0 or position('؟' in coalesce(p_raw, '')) > 0
    when 'digit' then p_norm ~ '[0-9]'
    else false end
$$;
-- evaluateTurn: the criteria the turn names, in the turn's order.
create or replace function kafaa_rp_eval(p_turn jsonb, p_rubric jsonb, p_text text) returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object('turn_id', p_turn ->> 'id', 'words', kafaa_rp_words(kafaa_rp_norm(p_text)),
    'criteria', (select coalesce(jsonb_agg(jsonb_build_object('id', cid, 'pass', coalesce((
        select kafaa_rp_check(r -> 'check', p_text, kafaa_rp_norm(p_text)) from jsonb_array_elements(coalesce(p_rubric, '[]'::jsonb)) with ordinality qr(r, j) where r ->> 'id' = cid order by j limit 1), false)) order by k), '[]'::jsonb)
      from jsonb_array_elements_text(coalesce(p_turn -> 'criteria', '[]'::jsonb)) with ordinality q(cid, k)))
$$;
-- speakUpTopic: what reads like a real complaint, a real incident or pressure on the person (never the skill of raising a concern).
create or replace function kafaa_rp_speak_up(p_text text) returns boolean language sql immutable set search_path = public as $$
  select exists (select 1 from unnest(array['i want to report', 'i would like to report', 'i need to report', 'make a complaint', 'file a complaint', 'formal complaint', 'whistleblow*', 'harass*', 'retaliat*', 'intimidat*', 'bullied', 'bullying', 'bully me', 'discriminat*', 'cover up', 'covered up', 'covering up', 'falsif*', 'threatened me', 'threaten me', 'afraid to speak', 'afraid to report', 'pressured to sign', 'pressured me', 'my supervisor told me to', 'my manager told me to', 'this really happened', 'this happened for real', 'happened to me', 'اريد الابلاغ', 'اود الابلاغ', 'شكوي', 'شكوى', 'مضايقه*', 'انتقام', 'تحرش*', 'ترهيب', 'تمييز', 'تستر', 'تزوير', 'حدث فعلا', 'حدث معي', 'ضغط علي للتوقيع']::text[]) c where kafaa_rp_cue_hit(kafaa_rp_norm(p_text), c))
$$;
create or replace function kafaa_rp_pct(p_a integer, p_b integer) returns integer language sql immutable set search_path = public as $$
  select case when coalesce(p_b, 0) > 0 then (200 * p_a + p_b) / (2 * p_b) else 0 end
$$;
-- summarise: criteria passed of all checked, %, pass flag against the mark, and the reasons.
create or replace function kafaa_rp_summary(p_turns jsonb, p_rubric jsonb, p_pass integer) returns jsonb language plpgsql immutable set search_path = public as $$
declare v_passed integer; v_total integer; v_pct integer; v_ready boolean; v_reasons jsonb; v_per jsonb; s jsonb; w jsonb;
begin
  select count(*) filter (where (c ->> 'pass')::boolean)::integer, count(*)::integer into v_passed, v_total
    from jsonb_array_elements(coalesce(p_turns, '[]'::jsonb)) t cross join lateral jsonb_array_elements(coalesce(t -> 'criteria', '[]'::jsonb)) c;
  v_pct := kafaa_rp_pct(v_passed, v_total);
  v_reasons := jsonb_build_array(jsonb_build_object('code', 'rp_score', 'key', 'm33.rp.reason.score', 'vars', jsonb_build_object('passed', v_passed, 'total', v_total, 'pct', v_pct)));
  select coalesce(jsonb_agg(jsonb_build_object('i', r.i, 'en', r.e ->> 'label_en', 'ar', r.e ->> 'label_ar', 'pct', kafaa_rp_pct(x.p, x.n)) order by r.i), '[]'::jsonb) into v_per
  from jsonb_array_elements(coalesce(p_rubric, '[]'::jsonb)) with ordinality r(e, i)
  cross join lateral (select count(*)::integer as n, count(*) filter (where (c ->> 'pass')::boolean)::integer as p
    from jsonb_array_elements(coalesce(p_turns, '[]'::jsonb)) t cross join lateral jsonb_array_elements(coalesce(t -> 'criteria', '[]'::jsonb)) c where c ->> 'id' = r.e ->> 'id') x
  where x.n > 0;
  if jsonb_array_length(v_per) > 1 then
    select e into s from jsonb_array_elements(v_per) e order by (e ->> 'pct')::integer desc, (e ->> 'i')::integer limit 1;
    select e into w from jsonb_array_elements(v_per) e order by (e ->> 'pct')::integer asc, (e ->> 'i')::integer limit 1;
    if (s ->> 'pct')::integer > (w ->> 'pct')::integer then
      v_reasons := v_reasons || jsonb_build_array(
        jsonb_build_object('code', 'rp_strong', 'key', 'm33.rp.reason.strong', 'vars', jsonb_build_object('criterion', jsonb_build_object('en', s ->> 'en', 'ar', s ->> 'ar'), 'pct', (s ->> 'pct')::integer)),
        jsonb_build_object('code', 'rp_develop', 'key', 'm33.rp.reason.develop', 'vars', jsonb_build_object('criterion', jsonb_build_object('en', w ->> 'en', 'ar', w ->> 'ar'), 'pct', (w ->> 'pct')::integer)));
    end if;
  end if;
  v_ready := v_total > 0 and v_pct >= p_pass;
  v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', case when v_ready then 'rp_ready' else 'rp_not_ready' end,
    'key', case when v_ready then 'm33.rp.reason.ready' else 'm33.rp.reason.notReady' end, 'vars', jsonb_build_object('mark', p_pass)),
    jsonb_build_object('code', 'rp_private', 'key', 'm33.rp.reason.private'));
  return jsonb_build_object('passed', v_passed, 'total', v_total, 'pct', v_pct, 'ready', v_ready, 'reasons', v_reasons);
end $$;
-- evidenceSkills: scenario skills that can carry the validated rating (existing, not obsolete, not security, not cyber hygiene), sorted.
create or replace function kafaa_rp_evidence_skills(p_ids text[]) returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(s.id order by s.id collate "C"), '{}'::text[]) from kafaa_skills s
  where s.id = any(coalesce(p_ids, '{}'::text[])) and coalesce(s.lifecycle, '') <> 'obsolete' and coalesce(s.area, '') <> 'security' and coalesce(s.fs_area, '') <> 'cyber_hygiene'
$$;
-- eligibleReviewers: active staff with an active instructor, training manager or HR authority assignment (recognition A), never the person.
create or replace function kafaa_rp_reviewers(p_person text) returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(p.id order by p.id collate "C"), '{}'::text[]) from kafaa_people p
  where p.kind = 'staff' and p.status = 'active' and p.id is distinct from p_person
    and exists (select 1 from kafaa_role_assignments r where r.person_id = p.id and r.status = 'active' and r.role in ('instructor', 'training_manager', 'hr_director'))
$$;
create or replace function kafaa_rp_role_of(p_person text) returns text language sql stable security definer set search_path = public as $$
  select coalesce((select x.r from (values ('hr_director', 1), ('training_manager', 2), ('instructor', 3)) x(r, o)
    where exists (select 1 from kafaa_role_assignments a where a.person_id = p_person and a.status = 'active' and a.role = x.r) order by x.o limit 1), '')
$$;
-- Notification (kind roleplay), idempotent by id; row-audit quiet like the LocalBackend.
create or replace function kafaa_rp_notify(p_id text, p_person text, p_en text, p_ar text, p_link text, p_sev text) returns boolean language plpgsql security definer set search_path = public as $$
declare v_prev text := current_setting('kafaa.seeding', true); n integer;
begin
  if p_person is null or not exists (select 1 from kafaa_people where id = p_person) or exists (select 1 from kafaa_notifications where id = p_id) then return false; end if;
  perform set_config('kafaa.seeding', 'on', true);
  insert into kafaa_notifications (id, person_id, kind, title_en, title_ar, link, severity) values (p_id, p_person, 'roleplay', p_en, p_ar, p_link, p_sev) on conflict (id) do nothing;
  get diagnostics n = row_count;
  perform set_config('kafaa.seeding', coalesce(v_prev, ''), true);
  return n > 0;
end $$;
create or replace function kafaa_rp_txt(p jsonb, p_max integer) returns boolean language sql immutable set search_path = public as $$
  select jsonb_typeof(p) = 'string' and char_length(btrim(p #>> '{}')) between 1 and p_max
$$;
-- checkProblem: true when a criterion's check is invalid.
create or replace function kafaa_rp_check_problem(c jsonb) returns boolean language sql immutable set search_path = public as $$
  select case
    when c is null or jsonb_typeof(c) <> 'object' then true
    when coalesce(c ->> 'type', '') not in ('cues', 'length', 'question', 'digit') or jsonb_typeof(c -> 'type') <> 'string' then true
    when c ->> 'type' = 'cues' and (jsonb_typeof(c -> 'cues') is distinct from 'array' or jsonb_array_length(c -> 'cues') not between 1 and 40
      or exists (select 1 from jsonb_array_elements(c -> 'cues') q where jsonb_typeof(q) <> 'string' or kafaa_rp_cue_key(q #>> '{}') = '' or char_length(q #>> '{}') > 60)) then true
    when c ->> 'type' = 'cues' and c ? 'min' and jsonb_typeof(c -> 'min') <> 'null' and not (kafaa_aps_int(c -> 'min', 1, 1000000) and (c ->> 'min')::numeric <= jsonb_array_length(c -> 'cues')) then true
    when c ->> 'type' = 'length' and not (kafaa_aps_int(c -> 'min', 1, 1000000) and kafaa_aps_int(c -> 'max', -1000000, 400) and (c ->> 'max')::numeric >= (c ->> 'min')::numeric) then true
    else false end
$$;
-- rpScenarioProblem: the first problem with a scenario, or null.
create or replace function kafaa_rp_problem(p jsonb) returns text language plpgsql stable security definer set search_path = public as $$
declare v_c jsonb; v_t jsonb; v_all text; v_ids text[];
begin
  if p is null or jsonb_typeof(p -> 'code') is distinct from 'string' or (p ->> 'code') !~ '^RP-[A-Z]{2}-[0-9]{2}$' then return 'code'; end if;
  if jsonb_typeof(p -> 'kind') is distinct from 'string' or (p ->> 'kind') not in ('pre_job_brief', 'shift_turnover', 'raise_concern', 'regulator_interview', 'knowledge_transfer', 'ai_peer_coaching') then return 'kind'; end if;
  if not (kafaa_rp_txt(p -> 'title_en', 140) and kafaa_rp_txt(p -> 'title_ar', 140) and kafaa_rp_txt(p -> 'summary_en', 400) and kafaa_rp_txt(p -> 'summary_ar', 400)
      and kafaa_rp_txt(p -> 'setting_en', 1200) and kafaa_rp_txt(p -> 'setting_ar', 1200) and kafaa_rp_txt(p -> 'counterpart_en', 120) and kafaa_rp_txt(p -> 'counterpart_ar', 120)
      and kafaa_rp_txt(p -> 'role_en', 120) and kafaa_rp_txt(p -> 'role_ar', 120)) then return 'text'; end if;
  if jsonb_typeof(p -> 'core_skill_ids') is distinct from 'array' or jsonb_array_length(p -> 'core_skill_ids') not between 1 and 3
     or exists (select 1 from jsonb_array_elements(p -> 'core_skill_ids') e where jsonb_typeof(e) <> 'string' or not exists (select 1 from kafaa_core_skills cs where cs.id = e #>> '{}' and cs.status = 'active')) then return 'core_skill'; end if;
  if jsonb_typeof(p -> 'skill_ids') is distinct from 'array' or jsonb_array_length(p -> 'skill_ids') not between 1 and 4
     or exists (select 1 from jsonb_array_elements(p -> 'skill_ids') e where jsonb_typeof(e) <> 'string' or not ((e #>> '{}') = any(kafaa_rp_evidence_skills(array[e #>> '{}'])))) then return 'skills'; end if;
  if not kafaa_aps_int(p -> 'level', 1, 2) then return 'level'; end if;
  if not kafaa_aps_int(p -> 'pass_pct', 50, 90) then return 'pass_pct'; end if;
  if not kafaa_aps_int(p -> 'est_minutes', 5, 40) then return 'minutes'; end if;
  if jsonb_typeof(p -> 'rubric') is distinct from 'array' or jsonb_array_length(p -> 'rubric') not between 3 and 8
     or (select count(distinct coalesce((e -> 'id')::text, '~undefined')) from jsonb_array_elements(p -> 'rubric') e) <> jsonb_array_length(p -> 'rubric') then return 'rubric'; end if;
  for v_c in select e from jsonb_array_elements(p -> 'rubric') with ordinality q(e, i) order by i loop
    if jsonb_typeof(v_c) <> 'object' or jsonb_typeof(v_c -> 'id') is distinct from 'string' or (v_c ->> 'id') !~ '^[a-z0-9_]{1,24}$'
       or not (kafaa_rp_txt(v_c -> 'label_en', 80) and kafaa_rp_txt(v_c -> 'label_ar', 80) and kafaa_rp_txt(v_c -> 'desc_en', 300) and kafaa_rp_txt(v_c -> 'desc_ar', 300)
         and kafaa_rp_txt(v_c -> 'tip_en', 300) and kafaa_rp_txt(v_c -> 'tip_ar', 300)) then return 'criterion'; end if;
    if kafaa_rp_check_problem(v_c -> 'check') then return 'check'; end if;
  end loop;
  if jsonb_typeof(p -> 'turns') is distinct from 'array' or jsonb_array_length(p -> 'turns') not between 3 and 5
     or (select count(distinct coalesce((e -> 'id')::text, '~undefined')) from jsonb_array_elements(p -> 'turns') e) <> jsonb_array_length(p -> 'turns') then return 'turns'; end if;
  select array_agg(e ->> 'id') into v_ids from jsonb_array_elements(p -> 'rubric') e;
  for v_t in select e from jsonb_array_elements(p -> 'turns') with ordinality q(e, i) order by i loop
    if jsonb_typeof(v_t) <> 'object' or jsonb_typeof(v_t -> 'id') is distinct from 'string' or (v_t ->> 'id') !~ '^[a-z0-9_]{1,24}$'
       or not (kafaa_rp_txt(v_t -> 'prompt_en', 600) and kafaa_rp_txt(v_t -> 'prompt_ar', 600) and kafaa_rp_txt(v_t -> 'hint_en', 300) and kafaa_rp_txt(v_t -> 'hint_ar', 300)
         and kafaa_rp_txt(v_t -> 'example_en', 1200) and kafaa_rp_txt(v_t -> 'example_ar', 1200)) then return 'turn'; end if;
    if jsonb_typeof(v_t -> 'criteria') is distinct from 'array' or jsonb_array_length(v_t -> 'criteria') not between 1 and 5
       or (select count(distinct e::text) from jsonb_array_elements(v_t -> 'criteria') e) <> jsonb_array_length(v_t -> 'criteria')
       or exists (select 1 from jsonb_array_elements(v_t -> 'criteria') e where jsonb_typeof(e) <> 'string' or not ((e #>> '{}') = any(v_ids))) then return 'turn_criteria'; end if;
  end loop;
  if exists (select 1 from unnest(v_ids) cid where not exists (select 1 from jsonb_array_elements(p -> 'turns') t cross join lateral jsonb_array_elements_text(t -> 'criteria') x where x = cid)) then return 'unused'; end if;
  select lower(array_to_string(array[coalesce(p ->> 'title_en', ''), coalesce(p ->> 'title_ar', ''), coalesce(p ->> 'summary_en', ''), coalesce(p ->> 'summary_ar', ''),
      coalesce(p ->> 'setting_en', ''), coalesce(p ->> 'setting_ar', ''), coalesce(p ->> 'counterpart_en', ''), coalesce(p ->> 'counterpart_ar', ''), coalesce(p ->> 'role_en', ''), coalesce(p ->> 'role_ar', '')]
    || coalesce((select array_agg(u.t order by q.i, u.j) from jsonb_array_elements(p -> 'turns') with ordinality q(e, i)
         cross join lateral unnest(array[coalesce(e ->> 'prompt_en', ''), coalesce(e ->> 'prompt_ar', ''), coalesce(e ->> 'hint_en', ''), coalesce(e ->> 'hint_ar', ''),
           coalesce(e ->> 'example_en', ''), coalesce(e ->> 'example_ar', '')]) with ordinality u(t, j)), '{}'::text[])
    || coalesce((select array_agg(u.t order by q.i, u.j) from jsonb_array_elements(p -> 'rubric') with ordinality q(e, i)
         cross join lateral unnest(array[coalesce(e ->> 'label_en', ''), coalesce(e ->> 'label_ar', ''), coalesce(e ->> 'desc_en', ''), coalesce(e ->> 'desc_ar', ''),
           coalesce(e ->> 'tip_en', ''), coalesce(e ->> 'tip_ar', '')]) with ordinality u(t, j)), '{}'::text[]), ' ')) into v_all;
  if exists (select 1 from unnest(array['vital area', 'protected area', 'security plan', 'guard force', 'design basis threat', 'safeguards', 'physical protection', 'alarm station', 'access code', 'firewall rule', 'network diagram', 'ip address', 'patrol route', 'badge reader']::text[]) w where position(w in v_all) > 0) then return 'restricted'; end if;
  if p ? 'status' and jsonb_typeof(p -> 'status') <> 'null' and coalesce(p ->> 'status', '') not in ('draft', 'published', 'retired') then return 'status'; end if;
  return null;
end $$;
-- rpStats: sessions of active staff in the last four quarters; pooled criteria rate; every cell under 10 people suppressed.
create or replace function kafaa_rp_stats_core(p_today date) returns jsonb language sql stable security definer set search_path = public as $$
  with win as (select kafaa_cs_quarter_shift(kafaa_cs_quarter(p_today), -k) as q from generate_series(0, 3) k),
  alls as (select s.*, sc.kind from kafaa_roleplay_sessions s join kafaa_people pe on pe.id = s.person_id and pe.kind = 'staff' and pe.status = 'active'
    left join kafaa_roleplay_scenarios sc on sc.id = s.scenario_id where s.period in (select q from win)),
  done as (select * from alls where status = 'completed' and total is not null and total > 0),
  t as (select (select count(distinct person_id)::integer from alls) as ppl, (select count(*)::integer from alls) as n, (select count(*)::integer from done) as d,
    (select coalesce(sum(passed), 0)::integer from done) as a, (select coalesce(sum(total), 0)::integer from done) as b,
    (select count(distinct person_id)::integer from alls where review_status = 'validated') as val)
  select jsonb_build_object('participants', case when t.ppl >= 10 then t.ppl end, 'sessions', case when t.ppl >= 10 then t.n end, 'completed', case when t.ppl >= 10 then t.d end,
    'pct', case when t.ppl >= 10 and t.b > 0 then kafaa_rp_pct(t.a, t.b) end, 'validated', case when t.ppl >= 10 and t.val >= 10 then t.val end,
    'by_kind', (select jsonb_agg(jsonb_build_object('kind', k.kind, 'people', case when g.p >= 10 then g.p end, 'pct', case when g.p >= 10 and g.b > 0 then kafaa_rp_pct(g.a, g.b) end) order by k.ord)
      from (values ('pre_job_brief', 1), ('shift_turnover', 2), ('raise_concern', 3), ('regulator_interview', 4), ('knowledge_transfer', 5), ('ai_peer_coaching', 6)) k(kind, ord)
      cross join lateral (select count(distinct person_id)::integer as p, coalesce(sum(passed), 0)::integer as a, coalesce(sum(total), 0)::integer as b from done where done.kind = k.kind) g))
  from t
$$;

-- ───────────── FS59 RPCs (skills_profile Own; reviewer recognition A; library secure_items A)
create or replace function kafaa_rp_result(s kafaa_roleplay_sessions) returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object('session_id', s.id, 'scenario_id', s.scenario_id, 'passed', s.passed, 'total', s.total, 'pct', s.pct, 'ready', s.ready, 'reasons', s.reasons, 'turns', s.turns)
$$;
create or replace function kafaa_start_roleplay(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_sid text := case when jsonb_typeof(p -> 'scenario_id') = 'string' then p ->> 'scenario_id' else '' end; sc kafaa_roleplay_scenarios;
  v_open kafaa_roleplay_sessions; v_n integer; v_id text; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('roleplay.start', 'roleplay_sessions', null, 'not_signed_in', 'Sign in to practise role-play'); end if;
  if not kafaa_has_grant('skills_profile', array['Own']) then return kafaa_refuse('roleplay.start', 'roleplay_sessions', null, 'forbidden', 'Role-play practice is for ENEC staff'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  select * into sc from kafaa_roleplay_scenarios where id = v_sid;
  if sc.id is null or sc.status <> 'published' then return kafaa_refuse('roleplay.start', 'roleplay_sessions', null, 'not_found', 'Scenario not found or not published', v_role); end if;
  select * into v_open from kafaa_roleplay_sessions where person_id = me and scenario_id = v_sid and status = 'in_progress' order by started_at desc, id collate "C" desc limit 1;
  if v_open.id is not null then
    v_n := jsonb_array_length(v_open.turns);
    a := kafaa_audit('roleplay.start', 'roleplay_sessions', v_open.id, 'ok', 'resumed', 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Practice resumed', a, null, jsonb_build_object('session_id', v_open.id, 'scenario_id', v_sid, 'done', false, 'answered', v_n,
      'total', jsonb_array_length(sc.turns), 'turn', sc.turns -> v_n, 'feedback', null, 'result', null, 'resumed', true));
  end if;
  v_id := 'rp-s-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
  insert into kafaa_roleplay_sessions (id, person_id, scenario_id, scenario_version, period, status, turns, passed, total, pct, ready, reasons, started_at, completed_at, review_status,
    reviewer_id, review_context, requested_at, reviewed_by, reviewed_at, review_note, level, evidence_ids)
  values (v_id, me, v_sid, sc.version, kafaa_cs_quarter(current_date), 'in_progress', '[]'::jsonb, null, null, null, false, '[]'::jsonb, now(), null, 'none', null, null, null, null, null, null, 0, '{}'::text[]);
  a := kafaa_audit('roleplay.start', 'roleplay_sessions', v_id, 'ok', v_sid, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Practice started', a, null, jsonb_build_object('session_id', v_id, 'scenario_id', v_sid, 'done', false, 'answered', 0,
    'total', jsonb_array_length(sc.turns), 'turn', sc.turns -> 0, 'feedback', null, 'result', null, 'resumed', false));
end $$;

-- A speak-up topic returns code speak_up before anything is written: no session change, no audit row (M08 rule), nothing of the text kept.
create or replace function kafaa_roleplay_turn(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_text text := case when jsonb_typeof(p -> 'text') = 'string' then p ->> 'text' else '' end; me text; v_role text;
  v_sid text := case when jsonb_typeof(p -> 'session_id') = 'string' then p ->> 'session_id' else '' end; s kafaa_roleplay_sessions; sc kafaa_roleplay_scenarios; v_turn jsonb;
  v_res jsonb; v_turns jsonb; v_fb jsonb; v_sum jsonb; v_passed integer; v_total integer; a kafaa_audit_events;
begin
  if kafaa_rp_speak_up(v_text) then
    return kafaa_result(false, 'speak_up', 'This sounds like a real concern, not practice. Use the speak-up channels; nothing you typed was stored.', null::kafaa_audit_events, null, jsonb_build_object('route', '/speak-up'));
  end if;
  me := kafaa_me();
  if me is null then return kafaa_refuse('roleplay.turn', 'roleplay_sessions', nullif(v_sid, ''), 'not_signed_in', 'Sign in to practise role-play'); end if;
  if not kafaa_has_grant('skills_profile', array['Own']) then return kafaa_refuse('roleplay.turn', 'roleplay_sessions', nullif(v_sid, ''), 'forbidden', 'Role-play practice is for ENEC staff'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  select * into s from kafaa_roleplay_sessions where id = v_sid for update;
  if s.id is null or s.person_id <> me then return kafaa_refuse('roleplay.turn', 'roleplay_sessions', nullif(v_sid, ''), 'not_found', 'Session not found', v_role); end if;
  if s.status <> 'in_progress' then return kafaa_refuse('roleplay.turn', 'roleplay_sessions', v_sid, 'invalid', 'This session is already complete', v_role); end if;
  select * into sc from kafaa_roleplay_scenarios where id = s.scenario_id;
  if sc.id is null then return kafaa_refuse('roleplay.turn', 'roleplay_sessions', v_sid, 'not_found', 'Scenario not found or not published', v_role); end if;
  v_turn := sc.turns -> jsonb_array_length(s.turns);
  if v_turn is null or jsonb_typeof(p -> 'turn_id') is distinct from 'string' or p ->> 'turn_id' is distinct from v_turn ->> 'id' then
    return kafaa_refuse('roleplay.turn', 'roleplay_sessions', v_sid, 'invalid', 'Answer the turn on screen first', v_role); end if;
  if char_length(regexp_replace(v_text, '^\s+|\s+$', '', 'g')) not between 3 and 2000 then return kafaa_refuse('roleplay.turn', 'roleplay_sessions', v_sid, 'invalid', 'Write between 3 and 2,000 characters', v_role); end if;
  if kafaa_cop_guard(v_text) is not null then
    return kafaa_refuse('roleplay.turn', 'roleplay_sessions', v_sid, 'security_restricted', 'Practice answers never touch plant security, safeguards or cyber details; nothing was stored', v_role); end if;
  v_res := kafaa_rp_eval(v_turn, sc.rubric, v_text) || jsonb_build_object('at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
  v_turns := s.turns || jsonb_build_array(v_res);
  select count(*) filter (where (c ->> 'pass')::boolean)::integer, count(*)::integer into v_passed, v_total from jsonb_array_elements(v_res -> 'criteria') c;
  v_fb := v_res || jsonb_build_object('passed', v_passed, 'total', v_total);
  if jsonb_array_length(v_turns) < jsonb_array_length(sc.turns) then
    update kafaa_roleplay_sessions set turns = v_turns where id = v_sid;
    a := kafaa_audit('roleplay.turn', 'roleplay_sessions', v_sid, 'ok', v_passed || '/' || v_total, 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Answer checked', a, null, jsonb_build_object('session_id', v_sid, 'scenario_id', sc.id, 'done', false, 'answered', jsonb_array_length(v_turns),
      'total', jsonb_array_length(sc.turns), 'turn', sc.turns -> jsonb_array_length(v_turns), 'feedback', v_fb, 'result', null));
  end if;
  v_sum := kafaa_rp_summary(v_turns, sc.rubric, sc.pass_pct);
  update kafaa_roleplay_sessions set turns = v_turns, status = 'completed', completed_at = now(), passed = (v_sum ->> 'passed')::integer, total = (v_sum ->> 'total')::integer,
    pct = (v_sum ->> 'pct')::integer, ready = (v_sum ->> 'ready')::boolean, reasons = v_sum -> 'reasons' where id = v_sid returning * into s;
  a := kafaa_audit('roleplay.complete', 'roleplay_sessions', v_sid, 'ok', v_sum ->> 'pct', 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Session complete', a, null, jsonb_build_object('session_id', v_sid, 'scenario_id', sc.id, 'done', true, 'answered', jsonb_array_length(v_turns),
    'total', jsonb_array_length(sc.turns), 'turn', null, 'feedback', v_fb, 'result', kafaa_rp_result(s)));
end $$;

create or replace function kafaa_roleplay_context() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); st jsonb;
begin
  if me is null or not kafaa_has_grant('skills_profile', array['Own']) then return null; end if;
  st := kafaa_rp_stats_core(current_date);
  return jsonb_build_object('period', kafaa_cs_quarter(current_date),
    'open', (select coalesce(jsonb_agg(jsonb_build_object('session_id', s.id, 'scenario_id', s.scenario_id) order by s.started_at desc, s.id collate "C" desc), '[]'::jsonb)
      from kafaa_roleplay_sessions s where s.person_id = me and s.status = 'in_progress'),
    'sessions', (select count(*) from kafaa_roleplay_sessions where person_id = me), 'completed', (select count(*) from kafaa_roleplay_sessions where person_id = me and status = 'completed'),
    'validated', (select count(*) from kafaa_roleplay_sessions where person_id = me and review_status = 'validated'),
    'enec_pct', st -> 'pct', 'enec_n', case when st ->> 'pct' is null then null else st -> 'participants' end);
end $$;

create or replace function kafaa_roleplay_reviewers() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me();
begin
  if me is null or not kafaa_has_grant('skills_profile', array['Own']) then return null; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name_en', coalesce(p.display_name, ''), 'name_ar', coalesce(nullif(p.display_name_ar, ''), p.display_name, ''),
    'role', kafaa_rp_role_of(p.id)) order by p.id collate "C"), '[]'::jsonb) from kafaa_people p where p.id = any(kafaa_rp_reviewers(me)));
end $$;

create or replace function kafaa_request_roleplay_review(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_ctx text := case when jsonb_typeof(p -> 'context') = 'string' then p ->> 'context' else '' end; me text; v_role text;
  v_sid text := case when jsonb_typeof(p -> 'session_id') = 'string' then p ->> 'session_id' else '' end; v_rid text := case when jsonb_typeof(p -> 'reviewer_id') = 'string' then p ->> 'reviewer_id' else '' end;
  s kafaa_roleplay_sessions; sc kafaa_roleplay_scenarios; v_c text; a kafaa_audit_events;
begin
  if kafaa_rp_speak_up(v_ctx) then
    return kafaa_result(false, 'speak_up', 'This sounds like a real concern, not practice. Use the speak-up channels; nothing you typed was stored.', null::kafaa_audit_events, null, jsonb_build_object('route', '/speak-up'));
  end if;
  me := kafaa_me();
  if me is null then return kafaa_refuse('roleplay.review.request', 'roleplay_sessions', nullif(v_sid, ''), 'not_signed_in', 'Sign in to practise role-play'); end if;
  if not kafaa_has_grant('skills_profile', array['Own']) then return kafaa_refuse('roleplay.review.request', 'roleplay_sessions', nullif(v_sid, ''), 'forbidden', 'Role-play practice is for ENEC staff'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  select * into s from kafaa_roleplay_sessions where id = v_sid for update;
  if s.id is null or s.person_id <> me then return kafaa_refuse('roleplay.review.request', 'roleplay_sessions', nullif(v_sid, ''), 'not_found', 'Session not found', v_role); end if;
  if s.status <> 'completed' then return kafaa_refuse('roleplay.review.request', 'roleplay_sessions', v_sid, 'invalid', 'Finish the session before asking for a review', v_role); end if;
  if s.review_status in ('requested', 'validated') then return kafaa_refuse('roleplay.review.request', 'roleplay_sessions', v_sid, 'conflict', 'A review is already requested or decided for this session', v_role); end if;
  if not s.ready then return kafaa_refuse('roleplay.review.request', 'roleplay_sessions', v_sid, 'invalid', 'This session is below the scenario''s mark; practise again before asking for a review', v_role); end if;
  if not (v_rid = any(kafaa_rp_reviewers(me))) then
    return kafaa_refuse('roleplay.review.request', 'roleplay_sessions', v_sid, 'invalid', 'Choose a reviewer from the list: an instructor, the training manager or the HR authority, never yourself', v_role); end if;
  v_c := regexp_replace(v_ctx, '^\s+|\s+$', '', 'g');
  if char_length(v_c) not between 5 and 400 then return kafaa_refuse('roleplay.review.request', 'roleplay_sessions', v_sid, 'invalid', 'Tell the reviewer the practice context in 5 to 400 characters', v_role); end if;
  if kafaa_cop_guard(v_ctx) is not null then
    return kafaa_refuse('roleplay.review.request', 'roleplay_sessions', v_sid, 'security_restricted', 'Practice answers never touch plant security, safeguards or cyber details; nothing was stored', v_role); end if;
  if kafaa_cop_contact(v_ctx) then return kafaa_refuse('roleplay.review.request', 'roleplay_sessions', v_sid, 'contact_details', 'Remove email addresses and phone numbers', v_role); end if;
  update kafaa_roleplay_sessions set review_status = 'requested', reviewer_id = v_rid, review_context = v_c, requested_at = now(), reviewed_by = null, reviewed_at = null, review_note = null where id = v_sid;
  select * into sc from kafaa_roleplay_scenarios where id = s.scenario_id;
  perform kafaa_rp_notify('nt-rp-' || v_sid || '-req-' || v_rid, v_rid, 'Role-play feedback to review: ' || coalesce(sc.title_en, ''), 'ملاحظات تمرين لعب أدوار بانتظار مراجعتك: ' || coalesce(sc.title_ar, ''),
    '/training/role-play?tab=reviews', 'info');
  a := kafaa_audit('roleplay.review.request', 'roleplay_sessions', v_sid, 'ok', v_rid, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Review requested: the reviewer sees this session''s feedback, never your answers', a, null, jsonb_build_object('review_status', 'requested'));
end $$;

create or replace function kafaa_withdraw_roleplay_review(p_session_id text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_sid text := coalesce(p_session_id, ''); s kafaa_roleplay_sessions; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('roleplay.review.withdraw', 'roleplay_sessions', nullif(v_sid, ''), 'not_signed_in', 'Sign in to practise role-play'); end if;
  if not kafaa_has_grant('skills_profile', array['Own']) then return kafaa_refuse('roleplay.review.withdraw', 'roleplay_sessions', nullif(v_sid, ''), 'forbidden', 'Role-play practice is for ENEC staff'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  select * into s from kafaa_roleplay_sessions where id = v_sid for update;
  if s.id is null or s.person_id <> me then return kafaa_refuse('roleplay.review.withdraw', 'roleplay_sessions', nullif(v_sid, ''), 'not_found', 'Session not found', v_role); end if;
  if s.review_status <> 'requested' then return kafaa_refuse('roleplay.review.withdraw', 'roleplay_sessions', v_sid, 'invalid', 'No review is waiting for this session', v_role); end if;
  update kafaa_roleplay_sessions set review_status = 'withdrawn' where id = v_sid;
  a := kafaa_audit('roleplay.review.withdraw', 'roleplay_sessions', v_sid, 'ok', null, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Review request withdrawn', a, null, jsonb_build_object('review_status', 'withdrawn'));
end $$;

create or replace function kafaa_rp_queue_item(s kafaa_roleplay_sessions) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('session_id', s.id, 'person_id', s.person_id, 'person_name', coalesce(pe.display_name, ''), 'person_name_ar', coalesce(nullif(pe.display_name_ar, ''), pe.display_name, ''),
    'scenario_id', s.scenario_id, 'code', coalesce(sc.code, ''), 'kind', coalesce(sc.kind, ''), 'title_en', coalesce(sc.title_en, ''), 'title_ar', coalesce(sc.title_ar, ''),
    'level', coalesce(sc.level, 1), 'pass_pct', coalesce(sc.pass_pct, 70), 'passed', coalesce(s.passed, 0), 'total', coalesce(s.total, 0), 'pct', coalesce(s.pct, 0), 'turns', s.turns,
    'rubric', coalesce(sc.rubric, '[]'::jsonb), 'completed_at', s.completed_at, 'requested_at', s.requested_at, 'review_context', s.review_context, 'review_status', s.review_status,
    'reviewed_at', s.reviewed_at, 'review_note', s.review_note, 'skills', to_jsonb(case when sc.id is null then '{}'::text[] else kafaa_rp_evidence_skills(sc.skill_ids) end),
    'evidence_ids', to_jsonb(s.evidence_ids))
  from (select 1) one left join kafaa_people pe on pe.id = s.person_id left join kafaa_roleplay_scenarios sc on sc.id = s.scenario_id
$$;
-- The reviewer's queue: only sessions sent to me (recognition A). Never anyone else's sessions.
create or replace function kafaa_roleplay_review_queue() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me();
begin
  if me is null or not kafaa_has_grant('recognition', array['A']) then return null; end if;
  return jsonb_build_object(
    'items', (select coalesce(jsonb_agg(kafaa_rp_queue_item(s) order by s.requested_at, s.id collate "C"), '[]'::jsonb) from kafaa_roleplay_sessions s where s.reviewer_id = me and s.review_status = 'requested'),
    'decided', (select coalesce(jsonb_agg(kafaa_rp_queue_item(x) order by x.reviewed_at desc, x.id collate "C"), '[]'::jsonb) from (
      select * from kafaa_roleplay_sessions s where s.reviewer_id = me and s.review_status in ('validated', 'declined') order by s.reviewed_at desc, s.id collate "C" limit 20) x));
end $$;

-- The named reviewer validates (F01 evidence kind rating, basis validated, ref_table roleplay_sessions, level 1-2; recompute; ledger) or declines.
create or replace function kafaa_attach_roleplay_evidence(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_sid text := case when jsonb_typeof(p -> 'session_id') = 'string' then p ->> 'session_id' else '' end; s kafaa_roleplay_sessions;
  sc kafaa_roleplay_scenarios; v_dec text := case when jsonb_typeof(p -> 'decision') = 'string' then p ->> 'decision' end;
  v_note text := case when jsonb_typeof(p -> 'note') = 'string' then btrim(p ->> 'note') else '' end; v_skills text[]; v_level integer; v_ids text[] := '{}'::text[]; v_eid text; k text;
  a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('roleplay.review.decide', 'roleplay_sessions', nullif(v_sid, ''), 'not_signed_in', 'Sign in to practise role-play'); end if;
  if not kafaa_has_grant('recognition', array['A']) then
    return kafaa_refuse('roleplay.review.decide', 'roleplay_sessions', nullif(v_sid, ''), 'forbidden', 'Only instructors, the training manager and the HR authority validate role-play feedback'); end if;
  v_role := kafaa_acting_role('recognition', array['A']);
  select * into s from kafaa_roleplay_sessions where id = v_sid for update;
  if s.id is null then return kafaa_refuse('roleplay.review.decide', 'roleplay_sessions', nullif(v_sid, ''), 'not_found', 'Session not found', v_role); end if;
  if s.person_id = me then return kafaa_refuse('roleplay.review.decide', 'roleplay_sessions', v_sid, 'maker_checker', 'You cannot validate your own session', v_role); end if;
  if s.review_status <> 'requested' then return kafaa_refuse('roleplay.review.decide', 'roleplay_sessions', v_sid, 'invalid', 'No review is waiting for this session', v_role); end if;
  if s.reviewer_id is distinct from me then return kafaa_refuse('roleplay.review.decide', 'roleplay_sessions', v_sid, 'forbidden', 'Only the reviewer this session was sent to can decide it', v_role); end if;
  if v_dec is null or v_dec not in ('validate', 'decline') or (v_dec = 'decline' and char_length(v_note) not between 5 and 300) or char_length(v_note) > 300 then
    return kafaa_refuse('roleplay.review.decide', 'roleplay_sessions', v_sid, 'invalid', 'Choose validate or decline; a decline needs a reason of 5 to 300 characters', v_role); end if;
  select * into sc from kafaa_roleplay_scenarios where id = s.scenario_id;
  v_skills := case when sc.id is null then '{}'::text[] else kafaa_rp_evidence_skills(sc.skill_ids) end;
  if v_dec = 'validate' and coalesce(cardinality(v_skills), 0) = 0 then return kafaa_refuse('roleplay.review.decide', 'roleplay_sessions', v_sid, 'invalid', 'This scenario names no skill that can carry evidence', v_role); end if;
  if v_dec = 'decline' then
    update kafaa_roleplay_sessions set review_status = 'declined', reviewed_by = me, reviewed_at = now(), review_note = v_note where id = v_sid;
    perform kafaa_rp_notify('nt-rp-' || v_sid || '-declined', s.person_id, 'Role-play feedback not validated yet: ' || coalesce(sc.title_en, ''), 'لم تُعتمد ملاحظات تمرين لعب الأدوار بعد: ' || coalesce(sc.title_ar, ''),
      '/my/role-play?tab=history', 'warn');
    a := kafaa_audit('roleplay.review.decide', 'roleplay_sessions', v_sid, 'ok', 'declined: ' || v_note, 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Returned with your reason; no evidence was written', a, null, jsonb_build_object('review_status', 'declined', 'evidence_ids', '[]'::jsonb));
  end if;
  v_level := greatest(1, least(2, sc.level));
  perform set_config('kafaa.seeding', 'on', true);
  foreach k in array v_skills loop
    v_eid := 'se:roleplay:' || v_sid || ':' || k;
    insert into kafaa_skill_evidence (id, person_id, skill_id, kind, ref_table, ref_id, level, basis, status, observed_on, note, recorded_by, active)
    values (v_eid, s.person_id, k, 'rating', 'roleplay_sessions', v_sid, v_level, 'validated', 'current', current_date,
      format('Validated role-play feedback (%s, %s of %s criteria)', sc.code, s.passed, s.total), me, true)
    on conflict (id) do update set level = excluded.level, basis = 'validated', status = 'current', observed_on = excluded.observed_on, note = excluded.note, recorded_by = me, active = true;
    v_ids := v_ids || v_eid;
  end loop;
  update kafaa_roleplay_sessions set review_status = 'validated', reviewed_by = me, reviewed_at = now(), review_note = nullif(v_note, ''), level = v_level, evidence_ids = v_ids where id = v_sid;
  perform kafaa_skills_apply(s.person_id, current_date);
  perform kafaa_rp_notify('nt-rp-' || v_sid || '-validated', s.person_id, 'Role-play feedback validated: ' || sc.title_en, 'اعتُمدت ملاحظات تمرين لعب الأدوار: ' || sc.title_ar, '/my/skills', 'ok');
  l := kafaa_ledger('kafaa.roleplay.evidence', format('Role-play session %s by %s validated by %s: %s skill evidence rows (validated rating, level %s); practice feedback, not a qualification',
    v_sid, s.person_id, me, cardinality(v_ids), v_level));
  a := kafaa_audit('roleplay.review.decide', 'roleplay_sessions', v_sid, 'ok', format('validated %s skills at level %s', cardinality(v_ids), v_level), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Validated: the evidence is on their skills profile', a, l, jsonb_build_object('review_status', 'validated', 'evidence_ids', to_jsonb(v_ids)));
end $$;

create or replace function kafaa_roleplay_stats() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if kafaa_me() is null or not kafaa_has_grant('skills_profile', array['Agg']) then return null; end if;
  return kafaa_rp_stats_core(current_date);
end $$;

create or replace function kafaa_save_roleplay_scenario(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_given text := case when jsonb_typeof(p -> 'id') = 'string' then nullif(p ->> 'id', '') end; cur kafaa_roleplay_scenarios; v_problem text;
  v_status text; v_id text; v_version integer; v_sort integer; v_turns jsonb; v_rubric jsonb; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('roleplay.scenario', 'roleplay_scenarios', v_given, 'not_signed_in', 'Sign in to practise role-play'); end if;
  if not kafaa_has_grant('secure_items', array['A']) then return kafaa_refuse('roleplay.scenario', 'roleplay_scenarios', v_given, 'forbidden', 'Only the training manager edits the role-play library'); end if;
  v_role := kafaa_acting_role('secure_items', array['A']);
  if v_given is not null then
    select * into cur from kafaa_roleplay_scenarios where id = v_given;
    if cur.id is null then return kafaa_refuse('roleplay.scenario', 'roleplay_scenarios', v_given, 'not_found', 'Scenario not found', v_role); end if;
  end if;
  v_problem := kafaa_rp_problem(p);
  if v_problem is not null then
    return kafaa_refuse('roleplay.scenario', 'roleplay_scenarios', v_given, 'invalid', 'Check the scenario: ' || case v_problem
      when 'code' then 'a code like RP-PB-01' when 'kind' then 'a known kind' when 'text' then 'title, summary, setting, counterpart and your role in English and Arabic'
      when 'core_skill' then 'one to three core skills' when 'skills' then 'one to four catalogue skills that can carry evidence' when 'level' then 'evidence level 1 or 2'
      when 'pass_pct' then 'a mark between 50 and 90%' when 'minutes' then '5 to 40 minutes' when 'rubric' then 'three to eight criteria with distinct ids'
      when 'criterion' then 'every criterion needs a label, what it looks for and a tip in English and Arabic'
      when 'check' then 'every criterion needs a valid check (cue words, length, a question or a number)' when 'turns' then 'three to five turns with distinct ids'
      when 'turn' then 'every turn needs the counterpart''s line, a hint and an example answer in English and Arabic' when 'turn_criteria' then 'every turn checks one to five known criteria'
      when 'unused' then 'every criterion is checked by at least one turn' when 'restricted' then 'scenarios never touch plant security'
      else 'status draft, published or retired' end, v_role);
  end if;
  if exists (select 1 from kafaa_roleplay_scenarios where code = p ->> 'code' and id is distinct from cur.id) then
    return kafaa_refuse('roleplay.scenario', 'roleplay_scenarios', v_given, 'conflict', 'Another scenario already uses this code', v_role); end if;
  v_status := case when p ->> 'status' in ('published', 'retired') then p ->> 'status' else 'draft' end;
  if cur.id is not null and cur.status = 'published' and v_status <> 'published' and (select count(*) from kafaa_roleplay_scenarios where status = 'published' and id <> cur.id) < 3 then
    return kafaa_refuse('roleplay.scenario', 'roleplay_scenarios', v_given, 'conflict', 'Keep at least three published scenarios', v_role); end if;
  select jsonb_agg(jsonb_build_object('id', e ->> 'id', 'prompt_en', btrim(e ->> 'prompt_en'), 'prompt_ar', btrim(e ->> 'prompt_ar'), 'hint_en', btrim(e ->> 'hint_en'), 'hint_ar', btrim(e ->> 'hint_ar'),
    'example_en', btrim(e ->> 'example_en'), 'example_ar', btrim(e ->> 'example_ar'), 'criteria', e -> 'criteria') order by i) into v_turns from jsonb_array_elements(p -> 'turns') with ordinality q(e, i);
  select jsonb_agg(jsonb_build_object('id', e ->> 'id', 'label_en', btrim(e ->> 'label_en'), 'label_ar', btrim(e ->> 'label_ar'), 'desc_en', btrim(e ->> 'desc_en'), 'desc_ar', btrim(e ->> 'desc_ar'),
    'tip_en', btrim(e ->> 'tip_en'), 'tip_ar', btrim(e ->> 'tip_ar'), 'check', e -> 'check') order by i) into v_rubric from jsonb_array_elements(p -> 'rubric') with ordinality q(e, i);
  if cur.id is not null then
    v_id := cur.id; v_version := cur.version + 1;
    update kafaa_roleplay_scenarios set code = p ->> 'code', kind = p ->> 'kind', title_en = btrim(p ->> 'title_en'), title_ar = btrim(p ->> 'title_ar'), summary_en = btrim(p ->> 'summary_en'),
      summary_ar = btrim(p ->> 'summary_ar'), setting_en = btrim(p ->> 'setting_en'), setting_ar = btrim(p ->> 'setting_ar'), counterpart_en = btrim(p ->> 'counterpart_en'),
      counterpart_ar = btrim(p ->> 'counterpart_ar'), role_en = btrim(p ->> 'role_en'), role_ar = btrim(p ->> 'role_ar'),
      core_skill_ids = array(select jsonb_array_elements_text(p -> 'core_skill_ids')), skill_ids = array(select jsonb_array_elements_text(p -> 'skill_ids')),
      level = (p ->> 'level')::integer, pass_pct = (p ->> 'pass_pct')::integer, est_minutes = (p ->> 'est_minutes')::integer, turns = v_turns, rubric = v_rubric, status = v_status,
      listed = v_status = 'published', version = v_version, updated_by = me, updated_at = now() where id = v_id;
  else
    v_id := 'rp-' || lower(p ->> 'code') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6); v_version := 1;
    select coalesce(max(sort), 0) + 1 into v_sort from kafaa_roleplay_scenarios;
    insert into kafaa_roleplay_scenarios (id, code, kind, title_en, title_ar, summary_en, summary_ar, setting_en, setting_ar, counterpart_en, counterpart_ar, role_en, role_ar, core_skill_ids, skill_ids,
      level, pass_pct, est_minutes, turns, rubric, sources, status, listed, version, sort, updated_by, updated_at)
    values (v_id, p ->> 'code', p ->> 'kind', btrim(p ->> 'title_en'), btrim(p ->> 'title_ar'), btrim(p ->> 'summary_en'), btrim(p ->> 'summary_ar'), btrim(p ->> 'setting_en'), btrim(p ->> 'setting_ar'),
      btrim(p ->> 'counterpart_en'), btrim(p ->> 'counterpart_ar'), btrim(p ->> 'role_en'), btrim(p ->> 'role_ar'), array(select jsonb_array_elements_text(p -> 'core_skill_ids')),
      array(select jsonb_array_elements_text(p -> 'skill_ids')), (p ->> 'level')::integer, (p ->> 'pass_pct')::integer, (p ->> 'est_minutes')::integer, v_turns, v_rubric, '[]'::jsonb,
      v_status, v_status = 'published', 1, v_sort, me, now());
  end if;
  a := kafaa_audit('roleplay.scenario', 'roleplay_scenarios', v_id, 'ok', 'v' || v_version || ' ' || v_status, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when cur.id is not null then 'Scenario saved' else 'Scenario added' end, a, null, jsonb_build_object('id', v_id, 'version', v_version, 'status', v_status));
end $$;

-- ───────────── Shared (handover 3.9): the recorded-evidence lists gain 'roleplay_sessions' (copied from the fs5qa body; only the two lists change)
-- @@SHARED-BEGIN@@
create or replace function kafaa_skill_states_v2(p_person text, p_now date, p_hl jsonb default null)
returns table (id text, person_id text, skill_id text, level integer, confidence numeric, basis text, reasons jsonb, evidence_count integer,
               confidence_band text, conf_low numeric, conf_high numeric)
language sql stable security definer set search_path = public as $$
  with hm as (select kafaa_skill_hl_months(p_hl) m),
  hl as (
    select (m ->> 'fast')::float8 as fm, (m ->> 'standard')::float8 as sm, (m ->> 'slow')::float8 as lm,
           floor((m ->> 'fast')::float8 * 30.4375 + 0.5)::integer as fd, floor((m ->> 'standard')::float8 * 30.4375 + 0.5)::integer as sd,
           floor((m ->> 'slow')::float8 * 30.4375 + 0.5)::integer as ld
    from hm
  ),
  ev as (
    select d.id, d.person_id, d.skill_id, d.kind, d.level, d.basis, d.status, d.observed_on from kafaa_skill_evidence_derive(p_person, p_now) d
    union all
    select e.id, e.person_id, e.skill_id, e.kind, e.level, e.basis, e.status, e.observed_on from kafaa_skill_evidence e
    where e.active and (e.kind in ('rating', 'ojt', 'credential') or e.ref_table in ('fitness_attempts', 'adaptive_attempts', 'task_attempts', 'ai_drill_attempts', 'plant_visits', 'twin_attempts', 'lectures', 'knowledge_assets', 'roleplay_sessions')) and (p_person is null or e.person_id = p_person)
  ),
  s1 as (
    select ev.*, (ev.kind = 'qual' and ev.status = 'current') as holds, greatest(0, p_now - ev.observed_on) as age,
           kafaa_skill_decay_class(k.area, to_jsonb(k) ->> 'decay_class') as cls
    from ev left join kafaa_skills k on k.id = ev.skill_id
  ),
  s2 as (
    select s1.*,
      case s1.cls when 'fast' then h.fd when 'slow' then h.ld else h.sd end as hld,
      case s1.cls when 'fast' then h.fm when 'slow' then h.lm else h.sm end as hlm
    from s1 cross join hl h
  ),
  s3 as (
    select s2.*,
      case when s2.holds then 1.0::float8 else floor(power(0.5::float8, s2.age::float8 / s2.hld::float8) * 10000 + 0.5) / 10000 end as decay,
      (not s2.holds and s2.age > s2.hld) as ageing,
      case s2.basis when 'verified' then 1.0::float8 when 'evidenced' then 0.8::float8 when 'validated' then 0.6::float8 else 0.3::float8 end as wt,
      case when s2.kind = 'qual' then 'qualification' when s2.kind = 'course' then 'training' when s2.kind in ('assessment', 'jpm') then 'assessment'
           when s2.kind = 'rating' then (case when s2.basis = 'claimed' then 'self' else 'validation' end) when s2.kind = 'ojt' then 'work' else 'credential' end as src
    from s2
  ),
  s4 as (
    select s3.*, case when s3.ageing then greatest(1, s3.level - 1) else s3.level end as eff, floor(s3.wt * s3.decay * 10000 + 0.5) / 10000 as conf,
      case s3.basis when 'verified' then 4 when 'evidenced' then 3 when 'validated' then 2 else 1 end as brank,
      case when s3.kind = 'qual' then (case when s3.status = 'lapsed' then 'qual_lapsed' else 'qual' end) when s3.kind = 'rating' then 'rating_' || s3.basis else s3.kind end as code
    from s3
  ),
  rk as (
    select s4.*, row_number() over (partition by s4.person_id, s4.skill_id
             order by (case when s4.basis = 'claimed' then 0 else 1 end) desc, s4.eff desc, s4.brank desc, s4.conf desc, s4.observed_on desc, s4.id collate "C" asc) as rn,
           count(*) over (partition by s4.person_id, s4.skill_id) as n
    from s4
  ),
  best as (select r.person_id, r.skill_id, r.src, max(r.conf) as c from rk r group by r.person_id, r.skill_id, r.src),
  bl as (select b.person_id, b.skill_id, kafaa_skill_blend(array_agg(b.c order by b.c desc)) as v from best b group by b.person_id, b.skill_id),
  ci as (select bl.person_id, bl.skill_id, floor(least(0.99::float8, bl.v[1]) * 100 + 0.5) / 100 as conf, bl.v[2] as n from bl),
  iv as (select ci.person_id, ci.skill_id, ci.conf, kafaa_skill_interval(ci.conf, ci.n) as v from ci)
  select 'ps:' || w.person_id || ':' || w.skill_id, w.person_id, w.skill_id, w.eff,
         i.conf::numeric,
         w.basis,
         (select jsonb_agg(jsonb_build_object('code', r.code, 'evidence_id', r.id, 'level', r.eff, 'basis', r.basis, 'observed_on', r.observed_on::text, 'ageing', r.ageing,
                                              'source', r.src, 'w', r.conf, 'hl', r.hlm) order by r.rn)
            from rk r where r.person_id = w.person_id and r.skill_id = w.skill_id),
         w.n::integer,
         kafaa_skill_band(i.v[1]), i.v[1]::numeric, i.v[2]::numeric
  from rk w join iv i on i.person_id = w.person_id and i.skill_id = w.skill_id
  where w.rn = 1
$$;

create or replace function kafaa_skills_apply(p_person text, p_now date) returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  insert into kafaa_skill_evidence (id, person_id, skill_id, kind, ref_table, ref_id, level, basis, status, observed_on, active)
  select d.id, d.person_id, d.skill_id, d.kind, d.ref_table, d.ref_id, d.level, d.basis, d.status, d.observed_on, true from kafaa_skill_evidence_derive(p_person, p_now) d
  on conflict (id) do update set level = excluded.level, basis = excluded.basis, status = excluded.status, observed_on = excluded.observed_on, active = true
  where (kafaa_skill_evidence.level, kafaa_skill_evidence.basis, kafaa_skill_evidence.status, kafaa_skill_evidence.observed_on, kafaa_skill_evidence.active)
        is distinct from (excluded.level, excluded.basis, excluded.status, excluded.observed_on, true);
  update kafaa_skill_evidence e set active = false
  where e.active and e.kind in ('qual', 'course', 'assessment', 'jpm') and e.ref_table not in ('fitness_attempts', 'adaptive_attempts', 'task_attempts', 'ai_drill_attempts', 'plant_visits', 'twin_attempts', 'lectures', 'knowledge_assets', 'roleplay_sessions') and (p_person is null or e.person_id = p_person)
    and e.id not in (select d.id from kafaa_skill_evidence_derive(p_person, p_now) d);
  insert into kafaa_person_skills (id, person_id, skill_id, level, confidence, basis, reasons, evidence_count, active, updated_at, confidence_band, conf_low, conf_high)
  select s.id, s.person_id, s.skill_id, s.level, s.confidence, s.basis, s.reasons, s.evidence_count, true, now(), s.confidence_band, s.conf_low, s.conf_high
  from kafaa_skill_states_v2(p_person, p_now, null) s
  on conflict (id) do update set level = excluded.level, confidence = excluded.confidence, basis = excluded.basis, reasons = excluded.reasons,
    evidence_count = excluded.evidence_count, active = true, updated_at = now(), confidence_band = excluded.confidence_band, conf_low = excluded.conf_low, conf_high = excluded.conf_high
  where (kafaa_person_skills.level, kafaa_person_skills.confidence, kafaa_person_skills.basis, kafaa_person_skills.reasons, kafaa_person_skills.evidence_count, kafaa_person_skills.active,
         kafaa_person_skills.confidence_band, kafaa_person_skills.conf_low, kafaa_person_skills.conf_high)
        is distinct from (excluded.level, excluded.confidence, excluded.basis, excluded.reasons, excluded.evidence_count, true, excluded.confidence_band, excluded.conf_low, excluded.conf_high);
  update kafaa_person_skills p set active = false, level = 0, confidence = 0, basis = 'none', reasons = '[]'::jsonb, evidence_count = 0, updated_at = now(),
    confidence_band = 'low', conf_low = 0, conf_high = 0
  where p.active and (p_person is null or p.person_id = p_person) and p.id not in (select s.id from kafaa_skill_states_v2(p_person, p_now, null) s);
  select jsonb_build_object(
    'people', (select count(distinct p.person_id) from kafaa_person_skills p where p.active and (p_person is null or p.person_id = p_person)),
    'states', (select count(*) from kafaa_person_skills p where p.active and (p_person is null or p.person_id = p_person)),
    'evidence', (select count(*) from kafaa_skill_evidence e where e.active and (p_person is null or e.person_id = p_person)),
    'digest', (select encode(sha256(convert_to(coalesce(string_agg(p.id || '|' || p.level || '|' || round(p.confidence * 100)::integer || '|' || p.basis, E'\n' order by p.id collate "C"), ''), 'UTF8')), 'hex')
               from kafaa_person_skills p where p.active and (p_person is null or p.person_id = p_person)))
  into v;
  return v;
end $$;
-- @@SHARED-END@@

-- ───────────── Grants: internal helpers are not executable by API roles; RPCs only by signed-in users.
revoke all on function kafaa_aps_pct(integer, integer), kafaa_aps_band(integer), kafaa_aps_band_name(text), kafaa_aps_dim_name(text), kafaa_aps_theme_name(text), kafaa_aps_changes(jsonb),
  kafaa_aps_stage(jsonb, text), kafaa_aps_stage_view(jsonb), kafaa_aps_header(kafaa_aps_scenarios), kafaa_aps_judge(jsonb, integer, integer[]), kafaa_aps_response(jsonb), kafaa_aps_score(jsonb),
  kafaa_aps_pick(text, integer), kafaa_aps_next_reasons(text, jsonb, integer), kafaa_aps_txt(jsonb, integer), kafaa_aps_int(jsonb, integer, integer), kafaa_aps_problem(jsonb),
  kafaa_aps_stats_core(date), kafaa_aps_result(kafaa_aps_attempts),
  kafaa_rp_norm(text), kafaa_rp_cue_key(text), kafaa_rp_cue_hit(text, text), kafaa_rp_words(text), kafaa_rp_check(jsonb, text, text), kafaa_rp_eval(jsonb, jsonb, text),
  kafaa_rp_speak_up(text), kafaa_rp_pct(integer, integer), kafaa_rp_summary(jsonb, jsonb, integer), kafaa_rp_evidence_skills(text[]), kafaa_rp_reviewers(text), kafaa_rp_role_of(text),
  kafaa_rp_notify(text, text, text, text, text, text), kafaa_rp_txt(jsonb, integer), kafaa_rp_check_problem(jsonb), kafaa_rp_problem(jsonb), kafaa_rp_stats_core(date),
  kafaa_rp_result(kafaa_roleplay_sessions), kafaa_rp_queue_item(kafaa_roleplay_sessions) from public, anon, authenticated;
revoke all on function kafaa_start_aps(jsonb), kafaa_submit_aps(jsonb), kafaa_aps_context(), kafaa_aps_stats(), kafaa_save_aps_scenario(jsonb), kafaa_start_roleplay(jsonb), kafaa_roleplay_turn(jsonb),
  kafaa_roleplay_context(), kafaa_roleplay_reviewers(), kafaa_request_roleplay_review(jsonb), kafaa_withdraw_roleplay_review(text), kafaa_roleplay_review_queue(),
  kafaa_attach_roleplay_evidence(jsonb), kafaa_roleplay_stats(), kafaa_save_roleplay_scenario(jsonb) from public, anon;
grant execute on function kafaa_start_aps(jsonb), kafaa_submit_aps(jsonb), kafaa_aps_context(), kafaa_aps_stats(), kafaa_save_aps_scenario(jsonb), kafaa_start_roleplay(jsonb), kafaa_roleplay_turn(jsonb),
  kafaa_roleplay_context(), kafaa_roleplay_reviewers(), kafaa_request_roleplay_review(jsonb), kafaa_withdraw_roleplay_review(text), kafaa_roleplay_review_queue(),
  kafaa_attach_roleplay_evidence(jsonb), kafaa_roleplay_stats(), kafaa_save_roleplay_scenario(jsonb) to authenticated;
