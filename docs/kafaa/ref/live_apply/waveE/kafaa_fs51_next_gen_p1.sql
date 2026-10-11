-- live apply part kafaa_fs51_next_gen_p1 (from supabase/migrations/20261010251001_kafaa_fs51_next_gen.sql, part 1 of 2)
-- [FS wave E · E1 · FS38 + FS39 + FS40] Next-Gen Nuclear Readiness (M31): SMR delta overlay, plant literacy log, digital-twin drills.
-- FS38: kafaa_smr_deltas (one current Barakah role x one ADVANCE technology family): what changes by dimension, what stays, skills,
--   delta training links and two or more https sources. Public summary for every role (skills_taxonomy R reads published rows); edits
--   through kafaa_save_smr_delta (frameworks W/A; versioned; ledger on publish); text must pass kafaa_rpv_text_clean (no headcount, site
--   or deployment claims: planning assumption, no deployment decision implied). Security, safeguards and cyber roles stay path-only.
--   HR view kafaa_next_gen_matrix (workforce_strategy Agg/R): readiness per technology and job family from the FS05 2035 profiles and
--   F01 states, cells under 10 suppressed. Mirror of src/modules/m31/nextgen.ts.
-- FS39: kafaa_plant_visits: reference-plant visits and simulator observations logged by staff and confirmed by the named host (never the
--   visitor). A confirmed visit writes F01 evidence (kind ojt, basis validated, ref_table plant_visits, level <= 2); logged, declined
--   and withdrawn visits write none. Mirror of src/modules/m31/literacy.ts. The plant explainer itself is static browser content.
-- FS40: kafaa_twin_scenarios (synthetic SIMULATED trend sets, SYN-TW codes, no answers), kafaa_twin_keys (secure_items only),
--   kafaa_twin_attempts (own rows only). Scored server-side by kafaa_tw_score (mirror of src/modules/m31/twin.ts); a pass writes F01
--   assessment evidence (ref_table twin_attempts) capped at level 2; the latest attempt on a drill replaces earlier evidence.
-- Shared redefinition (same signatures): kafaa_skill_states_v2 and kafaa_skills_apply treat ref_table 'plant_visits' and 'twin_attempts'
--   rows as recorded evidence (kept on recompute), on top of the FS45 list. TS mirror: RECORDED_REF_TABLES in src/domain/skills.ts.
-- PGlite parity and checks: scripts/validate/fs51-next-gen.mjs.
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file; RLS created once.

-- ───────────── Tables (generated DDL, additive)
-- M31 · SMR delta for one current Barakah role on one ADVANCE technology family: what changes (by dimension), what stays, skills, delta training and sources; planning assumption, no deployment decision implied (FS38)
create table if not exists kafaa_smr_deltas (
  id text primary key,
  role_id text not null,
  tech_id text not null,
  rank integer not null,
  path_only boolean not null default false,
  dims jsonb not null default '[]'::jsonb,
  changes_en text not null,
  changes_ar text not null,
  stays_en text not null,
  stays_ar text not null,
  skills jsonb not null default '[]'::jsonb,
  training jsonb not null default '[]'::jsonb,
  concept_role_ids text[] not null default '{}'::text[],
  sources jsonb not null default '[]'::jsonb,
  benchmark_ids text[] not null default '{}'::text[],
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  listed boolean not null default false,
  version integer not null default 1,
  as_of date not null,
  sort integer not null default 0,
  updated_by text,
  updated_at timestamptz not null default now()
);
comment on table kafaa_smr_deltas is '[M31] SMR delta for one current Barakah role on one ADVANCE technology family: what changes (by dimension), what stays, skills, delta training and sources; planning assumption, no deployment decision implied (FS38)';
-- M31 · Reference-plant visit or simulator observation logged by a person and confirmed (or declined) by the named host; confirmed visits write capped F01 evidence (FS39)
create table if not exists kafaa_plant_visits (
  id text primary key,
  person_id text not null,
  kind text not null check (kind in ('reference_plant', 'simulator_observation', 'partner_facility')),
  host_person_id text not null,
  visit_on date not null,
  hours numeric not null,
  note text not null default '',
  status text not null default 'logged' check (status in ('logged', 'confirmed', 'declined', 'withdrawn')),
  decided_by text,
  decided_at timestamptz,
  decline_reason text,
  level integer not null default 0,
  evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
comment on table kafaa_plant_visits is '[M31] Reference-plant visit or simulator observation logged by a person and confirmed (or declined) by the named host; confirmed visits write capped F01 evidence (FS39)';
-- M31 · Digital-twin diagnosis drill: synthetic plant-model trend set (SIMULATED, SYN-TW code), components, failure modes, checks, actions and rationales; no answers (the key is in twin_keys) (FS40)
create table if not exists kafaa_twin_scenarios (
  id text primary key,
  code text not null unique,
  title_en text not null,
  title_ar text not null,
  summary_en text not null,
  summary_ar text not null,
  scenario_en text not null,
  scenario_ar text not null,
  system_en text not null,
  system_ar text not null,
  difficulty integer not null,
  level integer not null,
  skill_ids text[] not null default '{}'::text[],
  series jsonb not null default '{}'::jsonb,
  components jsonb not null default '[]'::jsonb,
  modes jsonb not null default '[]'::jsonb,
  checks jsonb not null default '[]'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  rationales jsonb not null default '[]'::jsonb,
  max_checks integer not null default 3,
  est_minutes integer not null default 12,
  synthetic boolean not null default true,
  sources jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  listed boolean not null default false,
  version integer not null default 1,
  sort integer not null default 0,
  updated_by text,
  updated_at timestamptz not null default now()
);
comment on table kafaa_twin_scenarios is '[M31] Digital-twin diagnosis drill: synthetic plant-model trend set (SIMULATED, SYN-TW code), components, failure modes, checks, actions and rationales; no answers (the key is in twin_keys) (FS40)';
-- M31 · Answer key of a digital-twin drill: the degrading component and mode, useful and unsafe checks, conservative and unsafe actions, sound rationales; training staff only (FS40)
create table if not exists kafaa_twin_keys (
  id text primary key,
  scenario_id text not null unique,
  component_id text not null,
  mode_id text not null,
  useful_checks text[] not null default '{}'::text[],
  unsafe_checks text[] not null default '{}'::text[],
  conservative_actions text[] not null default '{}'::text[],
  best_action text not null,
  unsafe_actions text[] not null default '{}'::text[],
  sound_rationales text[] not null default '{}'::text[],
  explain jsonb not null default '{}'::jsonb,
  pass_pct integer not null default 70
);
comment on table kafaa_twin_keys is '[M31] Answer key of a digital-twin drill: the degrading component and mode, useful and unsafe checks, conservative and unsafe actions, sound rationales; training staff only (FS40)';
-- M31 · One person's submitted digital-twin drill: checks, diagnosis, action, rationales, score, pass, level and the capped evidence it wrote (FS40)
create table if not exists kafaa_twin_attempts (
  id text primary key,
  person_id text not null,
  scenario_id text not null,
  scenario_version integer not null,
  attempt_no integer not null,
  checks text[] not null default '{}'::text[],
  component_id text not null,
  mode_id text not null,
  action_id text not null,
  rationale_ids text[] not null default '{}'::text[],
  points integer not null,
  max_points integer not null,
  pct integer not null,
  critical_ok boolean not null,
  passed boolean not null,
  level integer not null default 0,
  feedback jsonb not null default '{}'::jsonb,
  reasons jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  submitted_at timestamptz not null default now()
);
comment on table kafaa_twin_attempts is '[M31] One person''s submitted digital-twin drill: checks, diagnosis, action, rationales, score, pass, level and the capped evidence it wrote (FS40)';
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_smr_deltas_role_id_fk') then alter table kafaa_smr_deltas add constraint kafaa_smr_deltas_role_id_fk foreign key (role_id) references kafaa_job_roles(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_smr_deltas_tech_id_fk') then alter table kafaa_smr_deltas add constraint kafaa_smr_deltas_tech_id_fk foreign key (tech_id) references kafaa_adv_technologies(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_plant_visits_person_id_fk') then alter table kafaa_plant_visits add constraint kafaa_plant_visits_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_plant_visits_host_person_id_fk') then alter table kafaa_plant_visits add constraint kafaa_plant_visits_host_person_id_fk foreign key (host_person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_twin_keys_scenario_id_fk') then alter table kafaa_twin_keys add constraint kafaa_twin_keys_scenario_id_fk foreign key (scenario_id) references kafaa_twin_scenarios(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_twin_attempts_person_id_fk') then alter table kafaa_twin_attempts add constraint kafaa_twin_attempts_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_twin_attempts_scenario_id_fk') then alter table kafaa_twin_attempts add constraint kafaa_twin_attempts_scenario_id_fk foreign key (scenario_id) references kafaa_twin_scenarios(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_smr_deltas_role_id_idx on kafaa_smr_deltas (role_id);
create index if not exists kafaa_smr_deltas_tech_id_idx on kafaa_smr_deltas (tech_id);
create index if not exists kafaa_smr_deltas_status_idx on kafaa_smr_deltas (status);
create index if not exists kafaa_plant_visits_person_id_idx on kafaa_plant_visits (person_id);
create index if not exists kafaa_plant_visits_kind_idx on kafaa_plant_visits (kind);
create index if not exists kafaa_plant_visits_host_person_id_idx on kafaa_plant_visits (host_person_id);
create index if not exists kafaa_plant_visits_status_idx on kafaa_plant_visits (status);
create index if not exists kafaa_twin_scenarios_status_idx on kafaa_twin_scenarios (status);
create index if not exists kafaa_twin_attempts_person_id_idx on kafaa_twin_attempts (person_id);
create index if not exists kafaa_twin_attempts_scenario_id_idx on kafaa_twin_attempts (scenario_id);

-- ───────────── RLS (generated rules; policies created once)
do $$ begin
  execute 'alter table kafaa_smr_deltas enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_smr_deltas' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_smr_deltas for select to anon, authenticated using (kafaa_rule_read(''skills_taxonomy'', null::text, null::text, listed) or kafaa_rule_read(''audit_log'', null::text, null::text, true) or kafaa_rule_read(''sat'', null::text, null::text, true))'; end if;
  execute 'alter table kafaa_plant_visits enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_plant_visits' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_plant_visits for select to anon, authenticated using (kafaa_rule_read(''own_profile'', person_id, null::text, true) or kafaa_rule_read(''own_profile'', host_person_id, null::text, true))'; end if;
  execute 'alter table kafaa_twin_scenarios enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_twin_scenarios' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_twin_scenarios for select to anon, authenticated using (kafaa_rule_read(''internal_content'', null::text, null::text, listed) or kafaa_rule_read(''secure_items'', null::text, null::text, true))'; end if;
  execute 'alter table kafaa_twin_keys enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_twin_keys' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_twin_keys for select to anon, authenticated using (kafaa_rule_read(''secure_items'', null::text, null::text, true))'; end if;
  execute 'alter table kafaa_twin_attempts enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_twin_attempts' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_twin_attempts for select to anon, authenticated using (kafaa_rule_read(''own_profile'', person_id, null::text, true))'; end if;
end $$;
-- API roles read through RLS only; every write goes through the SECURITY DEFINER RPCs below.
revoke all on kafaa_smr_deltas, kafaa_plant_visits, kafaa_twin_scenarios, kafaa_twin_keys, kafaa_twin_attempts from anon, authenticated;
grant select on kafaa_smr_deltas, kafaa_plant_visits, kafaa_twin_scenarios, kafaa_twin_keys, kafaa_twin_attempts to anon, authenticated;

-- (shared kafaa_skill_states_v2 / kafaa_skills_apply redefinition stripped for the live apply: the unioned body is in kafaa_fs5qa_integration_p1)

-- ───────────── FS38 rules (mirror of src/modules/m31/nextgen.ts)
-- Array helpers for the checks below: the array itself or empty, and its length or -1 (no error on malformed input).
create or replace function kafaa_smr_arr(x jsonb) returns jsonb language sql immutable set search_path = public as $$
  select case when jsonb_typeof(x) = 'array' then x else '[]'::jsonb end
$$;
create or replace function kafaa_smr_alen(x jsonb) returns integer language sql immutable set search_path = public as $$
  select case when jsonb_typeof(x) = 'array' then jsonb_array_length(x) else -1 end
$$;
-- Truthiness of a JSON value (mirror of JavaScript !!x for the path_only flag).
create or replace function kafaa_smr_truthy(x jsonb) returns boolean language sql immutable set search_path = public as $$
  select case jsonb_typeof(x) when 'boolean' then (x #>> '{}')::boolean when 'string' then length(x #>> '{}') > 0 when 'number' then (x #>> '{}')::numeric <> 0
    when 'object' then true when 'array' then true else false end
$$;
-- Requirements of a role's latest published FS05 2035 profile ('[]' when none).
create or replace function kafaa_smr_profile(p_role text) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select v.requirements from kafaa_role_profile_versions v where v.role_id = p_role and v.horizon = '2035' and v.status = 'published' order by v.version desc limit 1), '[]'::jsonb)
$$;
-- The skills a delta asks for (mirror of needsFor): delta skills in order, then the profile's smr_design skills by id; the higher level wins.
create or replace function kafaa_smr_needs(p_delta jsonb, p_profile jsonb) returns jsonb language plpgsql immutable set search_path = public as $$
declare v jsonb := '[]'::jsonb; s jsonb; r jsonb; i integer; v_lvl integer; v_found boolean;
begin
  if kafaa_smr_truthy(p_delta -> 'path_only') then return '[]'::jsonb; end if;
  for s in select x from jsonb_array_elements(coalesce(p_delta -> 'skills', '[]'::jsonb)) with ordinality q(x, n) order by n loop
    if s is null or jsonb_typeof(s) <> 'object' then continue; end if;
    if exists (select 1 from jsonb_array_elements(v) o where o ->> 'skill_id' = s ->> 'skill_id') then continue; end if;
    v := v || jsonb_build_array(jsonb_build_object('skill_id', s ->> 'skill_id', 'need', least(3, greatest(1, floor((s ->> 'level')::numeric)))::integer, 'source', 'delta'));
  end loop;
  for r in select x from jsonb_array_elements(coalesce(p_profile, '[]'::jsonb)) x
           where x ->> 'kind' = 'skill' and coalesce(x ->> 'driver', '') = 'smr_design' order by x ->> 'ref_id' collate "C" loop
    v_lvl := least(4, greatest(1, floor((r ->> 'level')::numeric)))::integer;
    v_found := false;
    for i in 0 .. jsonb_array_length(v) - 1 loop
      if v -> i ->> 'skill_id' = r ->> 'ref_id' then
        v := jsonb_set(v, array[i::text], jsonb_build_object('skill_id', r ->> 'ref_id', 'need', greatest((v -> i ->> 'need')::integer, v_lvl),
          'source', case when v -> i ->> 'source' = 'delta' then 'both' else v -> i ->> 'source' end));
        v_found := true;
      end if;
    end loop;
    if not v_found then v := v || jsonb_build_array(jsonb_build_object('skill_id', r ->> 'ref_id', 'need', v_lvl, 'source', 'profile')); end if;
  end loop;
  return v;
end $$;
-- Readiness of a person against needs (mirror of readinessOf): {pct, met, total}; pct null without needs.
create or replace function kafaa_smr_readiness(p_needs jsonb, p_person text) returns jsonb language sql stable security definer set search_path = public as $$
  with n as (select x ->> 'skill_id' as skill_id, (x ->> 'need')::integer as need from jsonb_array_elements(coalesce(p_needs, '[]'::jsonb)) x),
  h as (select n.skill_id, n.need, coalesce((select max(p.level) from kafaa_person_skills p where p.person_id = p_person and p.skill_id = n.skill_id and p.active), 0) as have from n),
  t as (select coalesce(sum(least(have, need)), 0)::integer as num, coalesce(sum(need), 0)::integer as den, count(*) filter (where have >= need)::integer as met, count(*)::integer as total from h)
  select jsonb_build_object('pct', case when den > 0 then (200 * num + den) / (2 * den) else null end, 'met', met, 'total', total) from t
$$;
-- HR view (mirror of matrixStats with MIN_GROUP_SIZE 10 and READY_PCT 50).
create or replace function kafaa_smr_matrix_core() returns jsonb language sql stable security definer set search_path = public as $$
  with d as (select * from kafaa_smr_deltas where status = 'published' and not path_only),
  rows as (
    select p.id as person, coalesce(p.job_family_id, '') as family, d.tech_id as tech,
           (kafaa_smr_readiness(kafaa_smr_needs(to_jsonb(d), kafaa_smr_profile(d.role_id)), p.id) ->> 'pct')::integer as pct
    from kafaa_people p join d on d.role_id = p.job_role_id
    where p.kind = 'staff' and p.status = 'active' and p.job_role_id is not null
  ),
  r as (select * from rows where pct is not null),
  techs as (
    select t.id as tech_id, (select count(*) from d where d.tech_id = t.id)::integer as deltas, count(r.person)::integer as n,
           count(r.person) filter (where r.pct >= 50)::integer as ready, avg(r.pct)::float8 as avg_pct
    from kafaa_adv_technologies t left join r on r.tech = t.id group by t.id
  ),
  fam as (select r.family, r.tech, count(*)::integer as n, count(*) filter (where r.pct >= 50)::integer as ready from r group by r.family, r.tech)
  select jsonb_build_object(
    'people', (select case when count(distinct person) >= 10 then count(distinct person)::integer else null end from r),
    'techs', coalesce((select jsonb_agg(jsonb_build_object('tech_id', tech_id, 'deltas', deltas,
        'n', case when n >= 10 then n else null end, 'ready', case when n >= 10 then ready else null end,
        'ready_pct', case when n >= 10 then floor((100.0::float8 * ready / n) * 10 + 0.5) / 10 else null end,
        'avg_pct', case when n >= 10 then floor(((select sum(r.pct) from r where r.tech = techs.tech_id)::float8 / n) * 10 + 0.5) / 10 else null end) order by tech_id collate "C") from techs), '[]'::jsonb),
    'families', coalesce((select jsonb_agg(jsonb_build_object('family_id', family, 'tech_id', tech, 'n', case when n >= 10 then n else null end,
        'ready_pct', case when n >= 10 then floor((100.0::float8 * ready / n) * 10 + 0.5) / 10 else null end) order by (family || '|' || tech) collate "C") from fam), '[]'::jsonb))
$$;
-- First problem code of an edited delta, or null (mirror of deltaProblem). p_family = the role's job family.
create or replace function kafaa_smr_problem(p jsonb, p_family text) returns text language plpgsql stable security definer set search_path = public as $$
declare v_path boolean := coalesce(p_family, '') in ('security', 'safeguards', 'cyber'); x jsonb; k kafaa_skills; v_texts text[];
begin
  if p is null or jsonb_typeof(p) <> 'object' or not kafaa_air_int(p -> 'rank', 1, 6) then return 'rank'; end if;
  if jsonb_typeof(p -> 'status') is distinct from 'string' or p ->> 'status' not in ('draft', 'published', 'retired') then return 'status'; end if;
  if kafaa_smr_truthy(p -> 'path_only') <> v_path then return 'security'; end if;
  if jsonb_typeof(p -> 'dims') is distinct from 'array' or kafaa_smr_alen(p -> 'dims') > 7 or (not v_path and kafaa_smr_alen(p -> 'dims') < 1) then return 'dims'; end if;
  for x in select e from jsonb_array_elements(kafaa_smr_arr(p -> 'dims')) e loop
    if jsonb_typeof(x) is distinct from 'object' or jsonb_typeof(x -> 'dim') is distinct from 'string'
       or x ->> 'dim' not in ('multi_module', 'passive_safety', 'digital_ic', 'factory_fab', 'maintenance', 'systems', 'delivery')
       or jsonb_typeof(x -> 'change') is distinct from 'string' or x ->> 'change' not in ('adapts', 'new') or not kafaa_air_str(x -> 'text_en', 400) or not kafaa_air_str(x -> 'text_ar', 400) then return 'dims'; end if;
  end loop;
  if (select count(distinct e ->> 'dim') from jsonb_array_elements(kafaa_smr_arr(p -> 'dims')) e) <> kafaa_smr_alen(p -> 'dims') then return 'dims'; end if;
  if not kafaa_air_str(p -> 'changes_en', 600) or not kafaa_air_str(p -> 'changes_ar', 600) or not kafaa_air_str(p -> 'stays_en', 600) or not kafaa_air_str(p -> 'stays_ar', 600) then return 'texts'; end if;
  if jsonb_typeof(p -> 'skills') is distinct from 'array' or kafaa_smr_alen(p -> 'skills') > 8 then return 'skills'; end if;
  if v_path and kafaa_smr_alen(p -> 'skills') > 0 then return 'security'; end if;
  for x in select e from jsonb_array_elements(kafaa_smr_arr(p -> 'skills')) with ordinality q(e, n) order by n loop
    k := null;
    if jsonb_typeof(x) = 'object' and jsonb_typeof(x -> 'skill_id') = 'string' then select * into k from kafaa_skills where id = x ->> 'skill_id'; end if;
    if k.id is null or not kafaa_air_int(x -> 'level', 1, 3) or k.lifecycle = 'obsolete' then return 'skills'; end if;
    if k.area = 'security' then return 'security'; end if;
  end loop;
  if (select count(distinct e ->> 'skill_id') from jsonb_array_elements(kafaa_smr_arr(p -> 'skills')) e) <> kafaa_smr_alen(p -> 'skills') then return 'skills'; end if;
  if jsonb_typeof(p -> 'training') is distinct from 'array' or kafaa_smr_alen(p -> 'training') > 8 then return 'training'; end if;
  for x in select e from jsonb_array_elements(kafaa_smr_arr(p -> 'training')) e loop
    if jsonb_typeof(x) is distinct from 'object' or jsonb_typeof(x -> 'kind') is distinct from 'string' or jsonb_typeof(x -> 'ref') is distinct from 'string'
       or not (case x ->> 'kind'
         when 'microcred' then exists (select 1 from kafaa_microcred_defs m where m.code = x ->> 'ref' and m.status = 'current')
         when 'course' then exists (select 1 from kafaa_courses c where c.id = x ->> 'ref')
         when 'pathway' then exists (select 1 from kafaa_pathways w where w.id = x ->> 'ref' and w.status = 'published')
         when 'lane' then exists (select 1 from kafaa_horizon_lanes l where l.id = x ->> 'ref')
         else false end) then return 'training'; end if;
  end loop;
  if (select count(distinct (e ->> 'kind') || ':' || (e ->> 'ref')) from jsonb_array_elements(kafaa_smr_arr(p -> 'training')) e) <> kafaa_smr_alen(p -> 'training') then return 'training'; end if;
  if jsonb_typeof(p -> 'sources') is distinct from 'array' or kafaa_smr_alen(p -> 'sources') > 6 then return 'sources'; end if;
  for x in select e from jsonb_array_elements(kafaa_smr_arr(p -> 'sources')) e loop
    if jsonb_typeof(x) is distinct from 'object' or not kafaa_air_str(x -> 'label', 200) or jsonb_typeof(x -> 'url') is distinct from 'string' or x ->> 'url' !~ '^https://\S+$' then return 'sources'; end if;
  end loop;
  if p ->> 'status' = 'published' and kafaa_smr_alen(p -> 'sources') < 2 then return 'sources'; end if;
  v_texts := array[p ->> 'changes_en', p ->> 'changes_ar', p ->> 'stays_en', p ->> 'stays_ar']
    || coalesce((select array_agg(t order by n, j) from jsonb_array_elements(kafaa_smr_arr(p -> 'dims')) with ordinality q(e, n), lateral (values (1, e ->> 'text_en'), (2, e ->> 'text_ar')) v(j, t)), '{}'::text[]);
  if not kafaa_rpv_text_clean(v_texts) then return 'unclean'; end if;
  return null;
end $$;

-- ───────────── RPC: add or edit an SMR delta (frameworks W/A)
create or replace function kafaa_save_smr_delta(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_rid text := coalesce(p ->> 'role_id', ''); v_tid text := coalesce(p ->> 'tech_id', ''); v_entity text; jr kafaa_job_roles; v_problem text;
  v_id text; cur kafaa_smr_deltas; v_version integer; v_pub boolean; a kafaa_audit_events; l integer;
begin
  v_entity := case when v_rid <> '' and v_tid <> '' then 'smrd:' || v_rid || ':' || v_tid else null end;
  if me is null then return kafaa_refuse('smr.delta.save', 'smr_deltas', v_entity, 'not_signed_in', 'Sign in to edit SMR deltas'); end if;
  if not kafaa_has_grant('frameworks', array['W', 'A']) then
    return kafaa_refuse('smr.delta.save', 'smr_deltas', v_entity, 'forbidden', 'Only framework owners (instructors, the training manager and admins) edit SMR deltas'); end if;
  v_role := kafaa_acting_role('frameworks', array['W', 'A']);
  select * into jr from kafaa_job_roles where id = v_rid;
  if jr.id is null or coalesce(jr.lifecycle, 'current') <> 'current' then
    return kafaa_refuse('smr.delta.save', 'smr_deltas', v_entity, 'not_found', 'Role not found: deltas cover the current Barakah roles only', v_role); end if;
  if not exists (select 1 from kafaa_adv_technologies where id = v_tid) then return kafaa_refuse('smr.delta.save', 'smr_deltas', v_entity, 'not_found', 'Technology family not found', v_role); end if;
  v_problem := kafaa_smr_problem(p, jr.family_id);
  if v_problem is not null then
    return kafaa_refuse('smr.delta.save', 'smr_deltas', v_entity, 'invalid', 'Check the delta: ' || case v_problem
      when 'rank' then 'a relevance rank from 1 to 6' when 'status' then 'choose draft, published or retired'
      when 'security' then 'security, safeguards and cyber roles stay at career-path level: path only, no skills'
      when 'dims' then 'one to seven distinct dimensions, each adapts or new, with English and Arabic text (up to 400 characters)'
      when 'texts' then 'what changes and what stays, in English and Arabic (up to 600 characters each)'
      when 'skills' then 'up to 8 distinct catalogue skills (not obsolete) at level 1 to 3'
      when 'training' then 'up to 8 distinct links to existing micro-credentials, courses, pathways or horizon lanes'
      when 'sources' then 'https sources with labels (at least two to publish)' else 'no headcount, site or deployment claims; no deployment decision is implied' end, v_role);
  end if;
  v_id := 'smrd:' || v_rid || ':' || v_tid;
  select * into cur from kafaa_smr_deltas where id = v_id;
  v_version := coalesce(cur.version + 1, 1);
  v_pub := p ->> 'status' = 'published';
  if cur.id is not null then
    update kafaa_smr_deltas set rank = (p ->> 'rank')::integer, path_only = coalesce(jr.family_id, '') in ('security', 'safeguards', 'cyber'),
      dims = (select coalesce(jsonb_agg(jsonb_build_object('dim', e ->> 'dim', 'change', e ->> 'change', 'text_en', btrim(e ->> 'text_en', E' \t\n\r'), 'text_ar', btrim(e ->> 'text_ar', E' \t\n\r')) order by n), '[]'::jsonb) from jsonb_array_elements(p -> 'dims') with ordinality q(e, n)),
      changes_en = btrim(p ->> 'changes_en', E' \t\n\r'), changes_ar = btrim(p ->> 'changes_ar', E' \t\n\r'), stays_en = btrim(p ->> 'stays_en', E' \t\n\r'), stays_ar = btrim(p ->> 'stays_ar', E' \t\n\r'),
      skills = (select coalesce(jsonb_agg(jsonb_build_object('skill_id', e ->> 'skill_id', 'level', (e ->> 'level')::integer) order by n), '[]'::jsonb) from jsonb_array_elements(p -> 'skills') with ordinality q(e, n)),
      training = (select coalesce(jsonb_agg(jsonb_build_object('kind', e ->> 'kind', 'ref', e ->> 'ref') order by n), '[]'::jsonb) from jsonb_array_elements(p -> 'training') with ordinality q(e, n)),
      sources = (select coalesce(jsonb_agg(jsonb_build_object('label', btrim(e ->> 'label', E' \t\n\r'), 'url', e ->> 'url', 'as_of', case when coalesce(e ->> 'as_of', '') ~ '^\d{4}-\d{2}-\d{2}$' then e ->> 'as_of' else current_date::text end) order by n), '[]'::jsonb) from jsonb_array_elements(p -> 'sources') with ordinality q(e, n)),
      status = p ->> 'status', listed = v_pub, version = v_version, as_of = current_date, updated_by = me, updated_at = now() where id = v_id;
  else
    insert into kafaa_smr_deltas (id, role_id, tech_id, rank, path_only, dims, changes_en, changes_ar, stays_en, stays_ar, skills, training, concept_role_ids, sources, benchmark_ids,
      status, listed, version, as_of, sort, updated_by, updated_at)
    values (v_id, v_rid, v_tid, (p ->> 'rank')::integer, coalesce(jr.family_id, '') in ('security', 'safeguards', 'cyber'),
      (select coalesce(jsonb_agg(jsonb_build_object('dim', e ->> 'dim', 'change', e ->> 'change', 'text_en', btrim(e ->> 'text_en', E' \t\n\r'), 'text_ar', btrim(e ->> 'text_ar', E' \t\n\r')) order by n), '[]'::jsonb) from jsonb_array_elements(p -> 'dims') with ordinality q(e, n)),
      btrim(p ->> 'changes_en', E' \t\n\r'), btrim(p ->> 'changes_ar', E' \t\n\r'), btrim(p ->> 'stays_en', E' \t\n\r'), btrim(p ->> 'stays_ar', E' \t\n\r'),
      (select coalesce(jsonb_agg(jsonb_build_object('skill_id', e ->> 'skill_id', 'level', (e ->> 'level')::integer) order by n), '[]'::jsonb) from jsonb_array_elements(p -> 'skills') with ordinality q(e, n)),
      (select coalesce(jsonb_agg(jsonb_build_object('kind', e ->> 'kind', 'ref', e ->> 'ref') order by n), '[]'::jsonb) from jsonb_array_elements(p -> 'training') with ordinality q(e, n)),
      '{}'::text[],
      (select coalesce(jsonb_agg(jsonb_build_object('label', btrim(e ->> 'label', E' \t\n\r'), 'url', e ->> 'url', 'as_of', case when coalesce(e ->> 'as_of', '') ~ '^\d{4}-\d{2}-\d{2}$' then e ->> 'as_of' else current_date::text end) order by n), '[]'::jsonb) from jsonb_array_elements(p -> 'sources') with ordinality q(e, n)),
      array['SMR-WF', 'IAEA-WFP'], p ->> 'status', v_pub, 1, current_date, (select coalesce(max(sort), 0) + 1 from kafaa_smr_deltas), me, now());
  end if;
  if v_pub then l := kafaa_ledger('kafaa.nextgen.delta_publish', 'SMR delta ' || v_rid || ' x ' || v_tid || ' v' || v_version || ' published'); end if;
  a := kafaa_audit('smr.delta.save', 'smr_deltas', v_id, 'ok', 'v' || v_version || ' ' || (p ->> 'status'), case when not v_pub then 'not_applicable' when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when cur.id is not null then 'SMR delta saved' else 'SMR delta added' end, a, l, jsonb_build_object('id', v_id, 'version', v_version, 'status', p ->> 'status'));
end $$;

-- ───────────── RPC: HR view of readiness per technology and job family (workforce_strategy Agg or R; suppressed under 10)
create or replace function kafaa_next_gen_matrix() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if kafaa_me() is null then return null; end if;
  if not kafaa_has_grant('workforce_strategy', array['Agg', 'R']) then return null; end if;
  return kafaa_smr_matrix_core() || jsonb_build_object('as_of', current_date::text, 'ready_pct_line', 50);
end $$;

-- ───────────── FS39 rules (mirror of src/modules/m31/literacy.ts)
-- First problem code of a visit to log, or null (mirror of visitProblem): kind, host, date, hours, note.
create or replace function kafaa_pv_problem(p jsonb, p_today date) returns text language plpgsql immutable set search_path = public as $$
declare v_on date; v_h numeric; v_note text;
begin
  if p is null or jsonb_typeof(p) <> 'object' or jsonb_typeof(p -> 'kind') is distinct from 'string' or p ->> 'kind' not in ('reference_plant', 'simulator_observation', 'partner_facility') then return 'kind'; end if;
  if not kafaa_air_str(p -> 'host_person_id', 1000000) then return 'host'; end if;
  if jsonb_typeof(p -> 'visit_on') is distinct from 'string' or p ->> 'visit_on' !~ '^\d{4}-\d{2}-\d{2}$' then return 'date'; end if;
  begin v_on := (p ->> 'visit_on')::date; exception when others then return 'date'; end;
  if to_char(v_on, 'YYYY-MM-DD') <> p ->> 'visit_on' or p_today - v_on < 0 or p_today - v_on > 365 then return 'date'; end if;
  if jsonb_typeof(p -> 'hours') is distinct from 'number' then return 'hours'; end if;
  v_h := (p ->> 'hours')::numeric;
  if v_h < 0.5 or v_h > 12 or v_h * 2 <> round(v_h * 2) then return 'hours'; end if;
  if p -> 'note' is null or jsonb_typeof(p -> 'note') = 'null' then v_note := '';
  elsif jsonb_typeof(p -> 'note') <> 'string' then return 'note';
  else v_note := p ->> 'note'; end if;
  if length(btrim(v_note, E' \t\n\r')) > 300 or kafaa_res_contact(v_note) then return 'note'; end if;
  return null;
end $$;
-- Evidence level of a visit confirmed now (mirror of visitLevel): 2 at 12+ confirmed hours over 2+ kinds (this visit included), else 1.
create or replace function kafaa_pv_level(p_person text, p_visit text, p_kind text, p_hours numeric) returns integer language sql stable security definer set search_path = public as $$
  with c as (select kind, hours from kafaa_plant_visits where person_id = p_person and status = 'confirmed' and id <> p_visit union all select p_kind, p_hours)
  select case when sum(hours) >= 12 and count(distinct kind) >= 2 then 2 else 1 end from c
$$;
-- Eligible hosts for a visitor (mirror of eligibleHosts): active staff with an active instructor, training manager or manager role, never the visitor.
create or replace function kafaa_pv_hosts(p_visitor text) returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(p.id order by p.id collate "C"), '{}'::text[]) from kafaa_people p
  where p.kind = 'staff' and p.status = 'active' and p.id is distinct from p_visitor
    and exists (select 1 from kafaa_role_assignments r where r.person_id = p.id and r.status = 'active' and r.role in ('instructor', 'training_manager', 'manager'))
$$;
-- Notification (kind plant_visit), idempotent by id; row-audit quiet like the LocalBackend.
create or replace function kafaa_pv_notify(p_id text, p_person text, p_en text, p_ar text, p_link text, p_sev text) returns boolean language plpgsql security definer set search_path = public as $$
declare v_prev text := current_setting('kafaa.seeding', true); n integer;
begin
  if p_person is null or not exists (select 1 from kafaa_people where id = p_person) or exists (select 1 from kafaa_notifications where id = p_id) then return false; end if;
  perform set_config('kafaa.seeding', 'on', true);
  insert into kafaa_notifications (id, person_id, kind, title_en, title_ar, link, severity) values (p_id, p_person, 'plant_visit', p_en, p_ar, p_link, p_sev) on conflict (id) do nothing;
  get diagnostics n = row_count;
  perform set_config('kafaa.seeding', coalesce(v_prev, ''), true);
  return n > 0;
end $$;

-- ───────────── RPC: the people I can name as host (skills_profile Own)
create or replace function kafaa_plant_hosts() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me();
begin
  if me is null or not kafaa_has_grant('skills_profile', array['Own']) then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('person_id', p.id, 'name_en', p.display_name, 'name_ar', coalesce(p.display_name_ar, p.display_name),
      'role', coalesce((select r.role from kafaa_role_assignments r where r.person_id = p.id and r.status = 'active' and r.role in ('instructor', 'training_manager', 'manager')
                        order by case r.role when 'instructor' then 1 when 'training_manager' then 2 else 3 end limit 1), 'manager')) order by p.id collate "C")
    from kafaa_people p where p.id = any (kafaa_pv_hosts(me))), '[]'::jsonb);
end $$;

-- ───────────── RPC: log a visit for host confirmation (skills_profile Own); no evidence until confirmed
create or replace function kafaa_log_visit(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_problem text; v_id text; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('plant.visit.log', 'plant_visits', null, 'not_signed_in', 'Sign in to log a plant visit'); end if;
  if not kafaa_has_grant('skills_profile', array['Own']) then return kafaa_refuse('plant.visit.log', 'plant_visits', null, 'forbidden', 'The plant visit log is for ENEC staff'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  v_problem := kafaa_pv_problem(p, current_date);
  if v_problem is not null then
    return kafaa_refuse('plant.visit.log', 'plant_visits', null, 'invalid', 'Check the visit: ' || case v_problem
      when 'kind' then 'choose a reference-plant visit, a simulator observation or a partner reference plant' when 'host' then 'name the host'
      when 'date' then 'a date in the last 365 days, not in the future' when 'hours' then '0.5 to 12 hours in half-hour steps'
      else 'a note of up to 300 characters without contact details' end, v_role);
  end if;
  if p ->> 'host_person_id' = me then return kafaa_refuse('plant.visit.log', 'plant_visits', null, 'maker_checker', 'You cannot host your own visit; name a host who was there', v_role); end if;
  if not (p ->> 'host_person_id') = any (kafaa_pv_hosts(me)) then
    return kafaa_refuse('plant.visit.log', 'plant_visits', null, 'invalid', 'Check the visit: the host must be an ENEC instructor, training manager or line manager', v_role); end if;
  v_id := 'pv-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
  insert into kafaa_plant_visits (id, person_id, kind, host_person_id, visit_on, hours, note, status, decided_by, decided_at, decline_reason, level, evidence, created_at)
  values (v_id, me, p ->> 'kind', p ->> 'host_person_id', (p ->> 'visit_on')::date, (p ->> 'hours')::numeric, btrim(coalesce(p ->> 'note', ''), E' \t\n\r'), 'logged', null, null, null, 0, '[]'::jsonb, now());
  perform kafaa_pv_notify('nt-pv-' || v_id || '-host', p ->> 'host_person_id', 'A plant visit to confirm as host', 'زيارة للمحطة بانتظار تأكيدك بصفتك المضيف', '/my/plant-log?tab=host', 'info');
  a := kafaa_audit('plant.visit.log', 'plant_visits', v_id, 'ok', (p ->> 'kind') || ' ' || ((p ->> 'hours')::numeric)::text || 'h host ' || (p ->> 'host_person_id'), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Visit logged; your host will confirm it', a, null, jsonb_build_object('id', v_id, 'status', 'logged'));
end $$;

-- ───────────── RPC: the named host confirms or declines (never the visitor); confirming writes capped F01 evidence (ojt, validated)
create or replace function kafaa_confirm_visit(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_vid text := coalesce(p ->> 'visit_id', ''); v kafaa_plant_visits; v_reason text; v_level integer; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('plant.visit.decide', 'plant_visits', nullif(v_vid, ''), 'not_signed_in', 'Sign in to log a plant visit'); end if;
  if not kafaa_has_grant('skills_profile', array['Own']) then return kafaa_refuse('plant.visit.decide', 'plant_visits', nullif(v_vid, ''), 'forbidden', 'The plant visit log is for ENEC staff'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  select * into v from kafaa_plant_visits where id = v_vid;
  if v.id is null then return kafaa_refuse('plant.visit.decide', 'plant_visits', nullif(v_vid, ''), 'not_found', 'Visit not found', v_role); end if;
  if v.person_id = me then return kafaa_refuse('plant.visit.decide', 'plant_visits', v_vid, 'maker_checker', 'You cannot confirm your own visit', v_role); end if;
  if v.host_person_id <> me then return kafaa_refuse('plant.visit.decide', 'plant_visits', v_vid, 'forbidden', 'Only the named host confirms this visit', v_role); end if;
  if v.status <> 'logged' then return kafaa_refuse('plant.visit.decide', 'plant_visits', v_vid, 'invalid', 'This visit is already decided', v_role); end if;
  if coalesce(p ->> 'decision', '') not in ('confirm', 'decline') or jsonb_typeof(p -> 'decision') <> 'string' then
    return kafaa_refuse('plant.visit.decide', 'plant_visits', v_vid, 'invalid', 'Choose confirm or decline', v_role); end if;
  if p ->> 'decision' = 'decline' then
    v_reason := case when jsonb_typeof(p -> 'reason') = 'string' then btrim(p ->> 'reason', E' \t\n\r') else '' end;
    if length(v_reason) < 5 or length(v_reason) > 300 then return kafaa_refuse('plant.visit.decide', 'plant_visits', v_vid, 'invalid', 'Give a reason (5 to 300 characters) when you decline', v_role); end if;
    update kafaa_plant_visits set status = 'declined', decided_by = me, decided_at = now(), decline_reason = v_reason where id = v_vid;
    perform kafaa_pv_notify('nt-pv-' || v_vid || '-declined', v.person_id, 'Your plant visit was not confirmed', 'لم يُؤكَّد سجل زيارتك للمحطة', '/my/plant-log', 'warn');
    a := kafaa_audit('plant.visit.decide', 'plant_visits', v_vid, 'ok', 'declined', 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Visit declined', a, null, jsonb_build_object('id', v_vid, 'status', 'declined', 'level', 0));
  end if;
  v_level := kafaa_pv_level(v.person_id, v_vid, v.kind, v.hours);
  update kafaa_plant_visits set status = 'confirmed', decided_by = me, decided_at = now(), level = v_level,
    evidence = jsonb_build_array(jsonb_build_object('skill_id', 'sk-fs-tr-techlit', 'level', v_level)) where id = v_vid;
  insert into kafaa_skill_evidence (id, person_id, skill_id, kind, ref_table, ref_id, level, basis, status, observed_on, note, recorded_by, active)
  values ('se:ojt:' || v_vid || ':sk-fs-tr-techlit', v.person_id, 'sk-fs-tr-techlit', 'ojt', 'plant_visits', v_vid, v_level, 'validated', 'current', v.visit_on, 'Plant visit ' || v.kind || ' confirmed by host', me, true)
  on conflict (id) do nothing;
  perform kafaa_skills_apply(v.person_id, current_date);
  perform kafaa_pv_notify('nt-pv-' || v_vid || '-confirmed', v.person_id, 'Your plant visit was confirmed', 'تم تأكيد زيارتك للمحطة', '/my/plant-log', 'ok');
  l := kafaa_ledger('kafaa.plant.visit_confirm', 'Plant visit ' || v_vid || ' confirmed by the host (level ' || v_level || ')');
  a := kafaa_audit('plant.visit.decide', 'plant_visits', v_vid, 'ok', 'confirmed L' || v_level, case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Visit confirmed', a, l, jsonb_build_object('id', v_vid, 'status', 'confirmed', 'level', v_level));
end $$;

-- ───────────── RPC: the visitor withdraws a visit still waiting for the host
create or replace function kafaa_withdraw_visit(p_visit_id text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_vid text := coalesce(p_visit_id, ''); v kafaa_plant_visits; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('plant.visit.withdraw', 'plant_visits', nullif(v_vid, ''), 'not_signed_in', 'Sign in to log a plant visit'); end if;
  if not kafaa_has_grant('skills_profile', array['Own']) then return kafaa_refuse('plant.visit.withdraw', 'plant_visits', nullif(v_vid, ''), 'forbidden', 'The plant visit log is for ENEC staff'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  select * into v from kafaa_plant_visits where id = v_vid;
  if v.id is null then return kafaa_refuse('plant.visit.withdraw', 'plant_visits', nullif(v_vid, ''), 'not_found', 'Visit not found', v_role); end if;
  if v.person_id <> me then return kafaa_refuse('plant.visit.withdraw', 'plant_visits', v_vid, 'forbidden', 'Only the visitor withdraws a visit', v_role); end if;
  if v.status <> 'logged' then return kafaa_refuse('plant.visit.withdraw', 'plant_visits', v_vid, 'invalid', 'This visit is already decided', v_role); end if;
  update kafaa_plant_visits set status = 'withdrawn' where id = v_vid;
  a := kafaa_audit('plant.visit.withdraw', 'plant_visits', v_vid, 'ok', 'withdrawn', 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Visit withdrawn', a, null, jsonb_build_object('id', v_vid, 'status', 'withdrawn'));
end $$;

-- ───────────── FS40 rules (mirror of src/modules/m31/twin.ts)
-- Strings of a JSON array, first occurrence kept, in order (mirror of uniq()).
create or replace function kafaa_tw_uniq(p jsonb) returns text[] language sql immutable set search_path = public as $$
  select coalesce(array_agg(z.v order by z.i), '{}'::text[]) from (
    select x #>> '{}' as v, i, row_number() over (partition by x #>> '{}' order by i) rn
    from jsonb_array_elements(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end) with ordinality q(x, i) where jsonb_typeof(x) = 'string') z where z.rn = 1
$$;
-- Score one submission against the key (mirror of scoreTwinDrill).
create or replace function kafaa_tw_score(p_key jsonb, p_sub jsonb, p_level integer) returns jsonb language plpgsql immutable set search_path = public as $$
declare
  v_checks text[] := kafaa_tw_uniq(p_sub -> 'checks'); v_rats text[] := kafaa_tw_uniq(p_sub -> 'rationale_ids');
  v_comp text := case when jsonb_typeof(p_sub -> 'component_id') = 'string' then p_sub ->> 'component_id' else '' end;
  v_mode text := case when jsonb_typeof(p_sub -> 'mode_id') = 'string' then p_sub ->> 'mode_id' else '' end;
  v_act text := case when jsonb_typeof(p_sub -> 'action_id') = 'string' then p_sub ->> 'action_id' else '' end;
  v_useful text[] := array(select jsonb_array_elements_text(p_key -> 'useful_checks')); v_unsafe text[] := array(select jsonb_array_elements_text(p_key -> 'unsafe_checks'));
  v_cons text[] := array(select jsonb_array_elements_text(p_key -> 'conservative_actions')); v_uacts text[] := array(select jsonb_array_elements_text(p_key -> 'unsafe_actions'));
  v_sound text[] := array(select jsonb_array_elements_text(p_key -> 'sound_rationales'));
  v_points integer := 0; v_comp_ok boolean; v_mode_ok boolean; v_u integer := 0; v_w integer := 0; v_x integer := 0; v_fc jsonb := '[]'::jsonb; c text; v_action text;
  v_s integer := 0; v_us integer := 0; v_fr jsonb := '[]'::jsonb; v_max integer; v_pct integer; v_crit boolean; v_passed boolean; v_cap integer; v_level integer; v_reasons jsonb; v_pass integer := (p_key ->> 'pass_pct')::integer;
begin
  v_comp_ok := v_comp = p_key ->> 'component_id';
  v_mode_ok := v_comp_ok and v_mode = p_key ->> 'mode_id';
  if v_comp_ok then v_points := v_points + 4; end if;
  if v_mode_ok then v_points := v_points + 2; end if;
  foreach c in array v_checks loop
    if c = any (v_unsafe) then v_x := v_x + 1; v_points := v_points - 2; v_fc := v_fc || jsonb_build_array(jsonb_build_object('id', c, 'verdict', 'unsafe'));
    elsif c = any (v_useful) then v_u := v_u + 1; v_points := v_points + 1; v_fc := v_fc || jsonb_build_array(jsonb_build_object('id', c, 'verdict', 'useful'));
    else v_w := v_w + 1; v_points := v_points - 1; v_fc := v_fc || jsonb_build_array(jsonb_build_object('id', c, 'verdict', 'wasted')); end if;
  end loop;
  v_action := case when v_act = any (v_uacts) then 'unsafe' when v_act = p_key ->> 'best_action' then 'best' when v_act = any (v_cons) then 'conservative' else 'not_conservative' end;
  if v_action = 'best' then v_points := v_points + 3; elsif v_action = 'conservative' then v_points := v_points + 2; end if;
  foreach c in array v_rats loop
    if c = any (v_sound) then v_s := v_s + 1; v_points := v_points + 1; v_fr := v_fr || jsonb_build_array(jsonb_build_object('id', c, 'sound', true));
    else v_us := v_us + 1; v_points := v_points - 1; v_fr := v_fr || jsonb_build_array(jsonb_build_object('id', c, 'sound', false)); end if;
  end loop;
  v_max := 4 + 2 + coalesce(array_length(v_useful, 1), 0) + 3 + coalesce(array_length(v_sound, 1), 0);
  v_points := greatest(0, v_points);
  v_pct := case when v_max > 0 then (200 * v_points + v_max) / (2 * v_max) else 0 end;
  v_crit := v_x = 0 and v_action <> 'unsafe';
  v_passed := v_crit and v_comp_ok and v_action in ('best', 'conservative') and v_pct >= v_pass;
  v_cap := least(2, greatest(1, floor(p_level)::integer));
  v_level := case when not v_passed then 0 when v_cap >= 2 and v_mode_ok and v_u = coalesce(array_length(v_useful, 1), 0) and v_w = 0 and v_pct >= 85 then 2 else 1 end;
  v_reasons := jsonb_build_array(
    jsonb_build_object('code', case when v_comp_ok then 'fs40_component' else 'fs40_component_wrong' end, 'key', case when v_comp_ok then 'm31.tw.reason.component' else 'm31.tw.reason.componentWrong' end),
    jsonb_build_object('code', case when v_mode_ok then 'fs40_mode' else 'fs40_mode_wrong' end, 'key', case when v_mode_ok then 'm31.tw.reason.mode' else 'm31.tw.reason.modeWrong' end),
    jsonb_build_object('code', 'fs40_checks', 'key', 'm31.tw.reason.checks', 'vars', jsonb_build_object('useful', v_u, 'total', coalesce(array_length(v_useful, 1), 0), 'wasted', v_w)),
    jsonb_build_object('code', 'fs40_action_' || v_action, 'key', 'm31.tw.reason.action.' || v_action),
    jsonb_build_object('code', 'fs40_rationales', 'key', 'm31.tw.reason.rationales', 'vars', jsonb_build_object('sound', v_s, 'total', coalesce(array_length(v_sound, 1), 0), 'unsound', v_us)));
  if not v_crit then v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'fs40_unsafe', 'key', 'm31.tw.reason.unsafe')); end if;
  v_reasons := v_reasons || jsonb_build_array(case when v_passed then jsonb_build_object('code', 'fs40_level', 'key', 'm31.tw.reason.level', 'vars', jsonb_build_object('level', v_level, 'pct', v_pct))
    else jsonb_build_object('code', 'fs40_not_passed', 'key', 'm31.tw.reason.notPassed', 'vars', jsonb_build_object('pct', v_pct, 'pass', v_pass)) end);
  return jsonb_build_object('points', v_points, 'max', v_max, 'pct', v_pct, 'component_ok', v_comp_ok, 'mode_ok', v_mode_ok, 'useful_found', v_u, 'useful_total', coalesce(array_length(v_useful, 1), 0),
    'wasted', v_w, 'unsafe_checks', v_x, 'action', v_action, 'sound', v_s, 'unsound', v_us, 'critical_ok', v_crit, 'passed', v_passed, 'level', v_level,
    'feedback', jsonb_build_object(
      'checks', v_fc,
      'missed_checks', coalesce((select jsonb_agg(u order by n) from unnest(v_useful) with ordinality q(u, n) where not (u = any (v_checks))), '[]'::jsonb),
      'component', jsonb_build_object('chosen', v_comp, 'correct', p_key ->> 'component_id', 'right', v_comp_ok),
      'mode', jsonb_build_object('chosen', v_mode, 'correct', p_key ->> 'mode_id', 'right', v_mode_ok),
      'action', jsonb_build_object('chosen', v_act, 'best', p_key ->> 'best_action', 'verdict', v_action),
      'rationales', v_fr,
      'missed_rationales', coalesce((select jsonb_agg(u order by n) from unnest(v_sound) with ordinality q(u, n) where not (u = any (v_rats))), '[]'::jsonb)),
    'reasons', v_reasons);
end $$;
-- Problems in a submission against the drill shown (mirror of twinSubProblem). p_sc carries components, modes, checks, actions, rationales, max_checks.
create or replace function kafaa_tw_sub_problem(p_sc jsonb, p_sub jsonb) returns text language plpgsql immutable set search_path = public as $$
declare x jsonb;
begin
  if p_sub is null or jsonb_typeof(p_sub) <> 'object' or jsonb_typeof(p_sub -> 'checks') is distinct from 'array' or jsonb_typeof(p_sub -> 'rationale_ids') is distinct from 'array' then return 'shape'; end if;
  for x in select e from jsonb_array_elements(kafaa_smr_arr(p_sub -> 'checks')) e loop
    if jsonb_typeof(x) <> 'string' or not exists (select 1 from jsonb_array_elements(kafaa_smr_arr(p_sc -> 'checks')) o where o ->> 'id' = x #>> '{}') then return 'checks'; end if;
  end loop;
  if (select count(distinct e #>> '{}') from jsonb_array_elements(kafaa_smr_arr(p_sub -> 'checks')) e) <> kafaa_smr_alen(p_sub -> 'checks') then return 'checks'; end if;
  if kafaa_smr_alen(p_sub -> 'checks') > (p_sc ->> 'max_checks')::integer then return 'too_many'; end if;
  if jsonb_typeof(p_sub -> 'component_id') is distinct from 'string' or not exists (select 1 from jsonb_array_elements(kafaa_smr_arr(p_sc -> 'components')) o where o ->> 'id' = p_sub ->> 'component_id') then return 'component'; end if;
  if jsonb_typeof(p_sub -> 'mode_id') is distinct from 'string' or not exists (select 1 from jsonb_array_elements(kafaa_smr_arr(p_sc -> 'modes')) o where o ->> 'id' = p_sub ->> 'mode_id') then return 'mode'; end if;
  if jsonb_typeof(p_sub -> 'action_id') is distinct from 'string' or not exists (select 1 from jsonb_array_elements(kafaa_smr_arr(p_sc -> 'actions')) o where o ->> 'id' = p_sub ->> 'action_id') then return 'action'; end if;
  if kafaa_smr_alen(p_sub -> 'rationale_ids') < 1 or kafaa_smr_alen(p_sub -> 'rationale_ids') > 3 then return 'rationales'; end if;
  for x in select e from jsonb_array_elements(kafaa_smr_arr(p_sub -> 'rationale_ids')) e loop
    if jsonb_typeof(x) <> 'string' or not exists (select 1 from jsonb_array_elements(kafaa_smr_arr(p_sc -> 'rationales')) o where o ->> 'id' = x #>> '{}') then return 'rationales'; end if;
  end loop;
  if (select count(distinct e #>> '{}') from jsonb_array_elements(kafaa_smr_arr(p_sub -> 'rationale_ids')) e) <> kafaa_smr_alen(p_sub -> 'rationale_ids') then return 'rationales'; end if;
  return null;
end $$;
-- An option list: lo..hi objects with id (<= 30), en and ar (<= 240), unique ids (mirror of optsOk).
create or replace function kafaa_tw_opts(x jsonb, p_lo integer, p_hi integer) returns boolean language sql immutable set search_path = public as $$
  select coalesce(jsonb_typeof(x) = 'array' and kafaa_smr_alen(x) between p_lo and p_hi
    and not exists (select 1 from jsonb_array_elements(kafaa_smr_arr(x)) o where jsonb_typeof(o) <> 'object' or not kafaa_air_str(o -> 'id', 30) or not kafaa_air_str(o -> 'en', 240) or not kafaa_air_str(o -> 'ar', 240))
    and (select count(distinct o ->> 'id') from jsonb_array_elements(kafaa_smr_arr(x)) o) = kafaa_smr_alen(x), false)
$$;
-- Ids of a key list are strings naming options of the drill, each once (mirror of sub()).
create or replace function kafaa_tw_sub(p_ids jsonb, p_opts jsonb) returns boolean language sql immutable set search_path = public as $$
  select coalesce(jsonb_typeof(p_ids) = 'array'
    and not exists (select 1 from jsonb_array_elements(kafaa_smr_arr(p_ids)) i where jsonb_typeof(i) <> 'string' or not exists (select 1 from jsonb_array_elements(kafaa_smr_arr(p_opts)) o where o ->> 'id' = i #>> '{}'))
    and (select count(distinct i #>> '{}') from jsonb_array_elements(kafaa_smr_arr(p_ids)) i) = kafaa_smr_alen(p_ids), false)
$$;
