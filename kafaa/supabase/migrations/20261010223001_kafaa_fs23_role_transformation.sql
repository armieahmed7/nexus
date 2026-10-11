-- [FS wave B · E3 · FS11 + FS12] My Role in 2030 (Role Transformation Maps) and the task exposure view (M30).
-- kafaa_rt_map mirrors transformRole() in src/modules/m30/transform.ts exactly: the task bands come from the FS06 rule
-- (kafaa_fx_exposure), the skills added from the FS05 published role profiles (now -> 2030 -> 2035), the bridge curriculum from the
-- course catalogue (shortest short course, else guided practice at 20 hours per level), and my time-to-ready from my own skill states
-- (2 months per level of gap, as the F05 Career Navigator). kafaa_exposure_aggregate / kafaa_transformation_overview mirror
-- exposureAggregate() / transformationOverview(): staff in current roles, suppressed under 10 people, security, safeguards and cyber
-- never broken out. kafaa_publish_transformation mirrors the LocalBackend RPC: the same checks in the same order (kafaa_rt_check =
-- checkTransformation), the same refusal codes and messages, one audit row, and the NEXUS ledger on publish.
-- PGlite parity: scripts/validate/fs23-role-transformation.mjs.
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file, RLS in the per-statement form.

-- ───────────── Tables (generated DDL)
-- M30 · Role transformation map per current role: archetype, technology drivers, staff and public summaries (FS11)
create table if not exists kafaa_role_transformations (
  id text primary key,
  role_id text not null unique,
  family_id text not null,
  archetype text check (archetype in ('mastery_builder', 'analytical_specialist', 'human_connector')),
  drivers text[] not null default '{}'::text[],
  summary_en text not null,
  summary_ar text not null,
  public_summary_en text not null,
  public_summary_ar text not null,
  sources jsonb not null default '[]'::jsonb,
  as_of date not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  is_public boolean not null default false,
  path_only boolean not null default false,
  version integer not null default 0,
  history jsonb not null default '[]'::jsonb,
  updated_by text,
  updated_at timestamptz not null default now(),
  published_by text,
  published_at timestamptz,
  sort integer not null default 0
);
comment on table kafaa_role_transformations is '[M30] Role transformation map per current role: archetype, technology drivers, staff and public summaries (FS11)';

-- M30 · Open draft of a role transformation map (editors read it through rpc.roleTransformation) (FS11)
create table if not exists kafaa_transformation_drafts (
  id text primary key,
  role_id text not null unique,
  content jsonb not null default '{}'::jsonb,
  open boolean not null default true,
  saved_by text,
  saved_at timestamptz not null default now()
);
comment on table kafaa_transformation_drafts is '[M30] Open draft of a role transformation map (editors read it through rpc.roleTransformation) (FS11)';

-- M30 · Role transformation timeline: OSSA support to around 2030, ADVANCE planning gates (SIMULATED), 2035 horizon (FS11)
create table if not exists kafaa_transformation_milestones (
  id text primary key,
  year integer not null,
  kind text not null check (kind in ('ossa', 'advance', 'profiles', 'horizon')),
  title_en text not null,
  title_ar text not null,
  body_en text not null,
  body_ar text not null,
  simulated boolean not null default false,
  families text[] not null default '{}'::text[],
  sources jsonb not null default '[]'::jsonb,
  as_of date not null,
  sort integer not null default 0
);
comment on table kafaa_transformation_milestones is '[M30] Role transformation timeline: OSSA support to around 2030, ADVANCE planning gates (SIMULATED), 2035 horizon (FS11)';

-- M30 · Role archetypes (SkillsFuture Singapore 2025): what each means for learning (FS11)
create table if not exists kafaa_transformation_archetypes (
  id text primary key,
  name_en text not null,
  name_ar text not null,
  meaning_en text not null,
  meaning_ar text not null,
  learning_en text not null,
  learning_ar text not null,
  example_en text not null,
  example_ar text not null,
  sources jsonb not null default '[]'::jsonb,
  as_of date not null,
  sort integer not null default 0
);
comment on table kafaa_transformation_archetypes is '[M30] Role archetypes (SkillsFuture Singapore 2025): what each means for learning (FS11)';

do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_role_transformations_role_id_fk') then alter table kafaa_role_transformations add constraint kafaa_role_transformations_role_id_fk foreign key (role_id) references kafaa_job_roles(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_role_transformations_family_id_fk') then alter table kafaa_role_transformations add constraint kafaa_role_transformations_family_id_fk foreign key (family_id) references kafaa_job_families(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_transformation_drafts_role_id_fk') then alter table kafaa_transformation_drafts add constraint kafaa_transformation_drafts_role_id_fk foreign key (role_id) references kafaa_job_roles(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_role_transformations_family_id_idx on kafaa_role_transformations (family_id);
create index if not exists kafaa_role_transformations_status_idx on kafaa_role_transformations (status);

-- ───────────── RLS (per-statement form). Maps: public when published, staff (transformation) all. Drafts: admin and auditors
-- (audit_log); editors read the draft through kafaa_role_transformation. Timeline and archetypes: public reference rows.
alter table kafaa_role_transformations enable row level security;
alter table kafaa_transformation_drafts enable row level security;
alter table kafaa_transformation_milestones enable row level security;
alter table kafaa_transformation_archetypes enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_role_transformations' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_role_transformations for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_transformation_drafts' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_transformation_drafts for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_transformation_milestones' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_transformation_milestones for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_transformation_archetypes' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_transformation_archetypes for select to anon, authenticated using (false)'; end if;
end $$;
alter policy kafaa_read on kafaa_role_transformations using (((COALESCE(is_public, false) AND (SELECT kafaa_has_grant('public_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))) OR ((SELECT kafaa_has_grant('transformation'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))));
alter policy kafaa_read on kafaa_transformation_drafts using ((((SELECT kafaa_has_grant('audit_log'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_transformation_milestones using ((((SELECT kafaa_has_grant('public_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_transformation_archetypes using ((((SELECT kafaa_has_grant('public_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
revoke insert, update, delete on kafaa_role_transformations, kafaa_transformation_drafts, kafaa_transformation_milestones, kafaa_transformation_archetypes from anon, authenticated;
grant select on kafaa_role_transformations, kafaa_transformation_drafts, kafaa_transformation_milestones, kafaa_transformation_archetypes to anon, authenticated;

-- ───────────── Rules (internal helpers; not executable by API roles)
create or replace function kafaa_rt_reason(p_code text, p_vars jsonb default '{}'::jsonb) returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object('code', p_code, 'key', 'm30.reasons.' || p_code, 'vars', coalesce(p_vars, '{}'::jsonb))
$$;
create or replace function kafaa_rt_drivers() returns text[] language sql immutable set search_path = public as $$
  select array['ai_assist', 'digital_ic', 'robotics', 'digital_twin', 'smr_design']
$$;
-- normDriver: FS05 writes ai_assistance (= FS06 ai_assist); anything outside the five drivers (incl. 'none') is null
create or replace function kafaa_rt_driver(p text) returns text language sql immutable set search_path = public as $$
  select case when p = 'ai_assistance' then 'ai_assist' when p = any(kafaa_rt_drivers()) then p end
$$;
create or replace function kafaa_rt_path_only(p_family text, p_sensitive boolean) returns boolean language sql immutable set search_path = public as $$
  select coalesce(p_sensitive, false) or coalesce(p_family, '') in ('security', 'safeguards', 'cyber')
$$;
create or replace function kafaa_rt_imp(p text) returns integer language sql immutable set search_path = public as $$
  select case p when 'core' then 0 when 'important' then 1 when 'useful' then 2 else 3 end
$$;
create or replace function kafaa_rt_pct(p_num numeric, p_den numeric) returns integer language sql immutable set search_path = public as $$
  select case when p_den > 0 then floor((200 * p_num + p_den) / (2 * p_den))::int end
$$;
-- the skill that carries a requirement (the skill itself, or the core skill of a competency)
create or replace function kafaa_rt_skill_of(p_kind text, p_ref text) returns text language sql stable security definer set search_path = public as $$
  select case when p_kind = 'skill' then p_ref else (select s.id from kafaa_skills s where s.core and s.competency_id = p_ref order by s.id collate "C" limit 1) end
$$;
-- my level on a requirement (skill state, or competency: core skill else best skill of the competency), 0 when none
create or replace function kafaa_rt_level_on(p_person text, p_kind text, p_ref text) returns integer language sql stable security definer set search_path = public as $$
  select case when p_kind = 'skill' then
      coalesce((select max(ps.level) from kafaa_person_skills ps where ps.person_id = p_person and ps.active and ps.skill_id = p_ref), 0)
    else coalesce(
      (select max(ps.level) from kafaa_person_skills ps join kafaa_skills s on s.id = ps.skill_id where ps.person_id = p_person and ps.active and s.core and s.competency_id = p_ref),
      (select max(ps.level) from kafaa_person_skills ps join kafaa_skills s on s.id = ps.skill_id where ps.person_id = p_person and ps.active and not s.core and s.competency_id = p_ref),
      0) end
$$;
-- the published requirements of a role at a horizon (highest published version)
create or replace function kafaa_rt_reqs(p_role text, p_h text) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select case when jsonb_typeof(v.requirements) = 'array' then v.requirements else '[]'::jsonb end from kafaa_role_profile_versions v
    where v.role_id = p_role and v.horizon = p_h and v.status = 'published' order by v.version desc limit 1), '[]'::jsonb)
$$;
create or replace function kafaa_rt_vdrivers(p_role text, p_h text) returns text[] language sql stable security definer set search_path = public as $$
  select coalesce((select v.drivers from kafaa_role_profile_versions v where v.role_id = p_role and v.horizon = p_h and v.status = 'published' order by v.version desc limit 1), '{}'::text[])
$$;
-- requirements new or raised from p_prev to p_next (diffAdded)
create or replace function kafaa_rt_added(p_prev jsonb, p_next jsonb, p_h text) returns jsonb language sql stable security definer set search_path = public as $$
  with n as (
    select r->>'kind' as kind, r->>'ref_id' as ref_id, (r->>'level')::numeric::int as lv, r->>'importance' as imp, kafaa_rt_driver(r->>'driver') as drv,
      (select (p->>'level')::numeric::int from jsonb_array_elements(p_prev) p where p->>'kind' = r->>'kind' and p->>'ref_id' = r->>'ref_id' limit 1) as pv
    from jsonb_array_elements(p_next) r
  ), a as (
    select *, case when pv is null then 'new' else 'raised' end as chg from n where pv is null or lv > pv
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'horizon', p_h, 'kind', kind, 'ref_id', ref_id, 'skill_id', kafaa_rt_skill_of(kind, ref_id), 'change', chg, 'from', coalesce(pv, 0), 'to', lv,
      'importance', imp, 'driver', drv,
      'reasons', jsonb_build_array(kafaa_rt_reason('added_' || chg, jsonb_build_object('horizon', p_h, 'from', coalesce(pv, 0), 'to', lv)))
        || case when drv is not null then jsonb_build_array(kafaa_rt_reason('driver_' || drv)) else '[]'::jsonb end
        || jsonb_build_array(kafaa_rt_reason('importance_' || imp)))
    order by case when chg = 'new' then 0 else 1 end, kafaa_rt_imp(imp), kind collate "C", ref_id collate "C"), '[]'::jsonb)
  from a
$$;
-- the shortest short course teaching a competency: staff, not initial training, at most 80 hours (bridgeCourse)
create or replace function kafaa_rt_bridge_course(p_comp text) returns kafaa_courses language sql stable security definer set search_path = public as $$
  select c.* from kafaa_courses c
  where p_comp is not null and c.audience = 'staff' and not coalesce(c.initial, false) and c.duration_hours is not null and c.duration_hours <= 80 and p_comp = any(c.competency_ids)
  order by c.duration_hours, c.id collate "C" limit 1
$$;
-- my time-to-ready for a set of requirements (readinessFor)
create or replace function kafaa_rt_readiness(p_person text, p_reqs jsonb, p_h text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb; v_have int; v_need int; s12 numeric := 0; n int := 0; v_gaps jsonb := '[]'::jsonb; v_levels int := 0; v_ng int := 0; v_months int;
begin
  for r in select e.value from jsonb_array_elements(coalesce(p_reqs, '[]'::jsonb)) with ordinality e(value, i) order by e.i loop
    n := n + 1;
    v_have := kafaa_rt_level_on(p_person, r->>'kind', r->>'ref_id');
    v_need := (r->>'level')::numeric::int;
    s12 := s12 + (12 * least(v_have, v_need))::numeric / v_need;
    if v_have < v_need then
      v_gaps := v_gaps || jsonb_build_array(jsonb_build_object('kind', r->>'kind', 'ref_id', r->>'ref_id', 'skill_id', kafaa_rt_skill_of(r->>'kind', r->>'ref_id'),
        'need', v_need, 'have', v_have, 'gap', v_need - v_have, 'importance', r->>'importance',
        'reasons', jsonb_build_array(kafaa_rt_reason('gap', jsonb_build_object('have', v_have, 'need', v_need, 'gap', v_need - v_have)), kafaa_rt_reason('importance_' || (r->>'importance')))));
      v_levels := v_levels + (v_need - v_have); v_ng := v_ng + 1;
    end if;
  end loop;
  select coalesce(jsonb_agg(g order by (g->>'gap')::int desc, kafaa_rt_imp(g->>'importance'), (g->>'kind') collate "C", (g->>'ref_id') collate "C"), '[]'::jsonb) into v_gaps
  from jsonb_array_elements(v_gaps) g;
  v_months := 2 * v_levels;
  return jsonb_build_object('horizon', p_h, 'gaps', v_gaps, 'levels', v_levels, 'months', v_months,
    'ready_pct', case when n > 0 then floor((100 * s12 + 6 * n) / (12 * n))::int else 100 end, 'requirements', n,
    'reasons', jsonb_build_array(case when v_levels = 0 then kafaa_rt_reason('time_ready', jsonb_build_object('horizon', p_h))
                                      else kafaa_rt_reason('time_rule', jsonb_build_object('levels', v_levels, 'per', 2, 'months', v_months)) end,
                                 kafaa_rt_reason('time_gaps', jsonb_build_object('n', v_ng, 'of', n))));
end $$;
-- rated, non-restricted, active tasks of a role with the FS06 exposure (mapTasks)
create or replace function kafaa_rt_tasks(p_role text) returns jsonb language sql stable security definer set search_path = public as $$
  with t as (
    select t.id, t.code, t.title_en, t.title_ar, t.critical, t.sort, t.change_horizon, kafaa_rt_driver(t.tech_driver) as drv,
      kafaa_fx_exposure(t.ai_capability_needed, t.change_horizon, t.critical, false) as ex
    from kafaa_jta_tasks t where t.role_id = p_role and not t.restricted and t.status = 'active'
  ), m as (
    select t.*, ex->>'exposure' as band, case ex->>'exposure' when 'human_core' then 'grow' when 'augment' then 'augmented' else 'shrink' end as mv from t where ex is not null
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'code', code, 'title_en', title_en, 'title_ar', title_ar, 'critical', critical, 'band', band, 'move', mv,
      'horizon', change_horizon, 'driver', drv, 'reasons', jsonb_build_array(kafaa_rt_reason('move_' || mv)) || (ex->'reasons'))
    order by case mv when 'grow' then 0 when 'augmented' then 1 else 2 end, sort, id collate "C"), '[]'::jsonb)
  from m
$$;

-- ───────────── transformRole: one role's map (p_person null: no time-to-ready)
create or replace function kafaa_rt_map(p_role text, p_person text, p_horizon text default '2030') returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  r kafaa_job_roles; m kafaa_role_transformations; v_h text := case when p_horizon = '2035' then '2035' else '2030' end;
  v_now jsonb; v_30 jsonb; v_35 jsonb; v_tasks jsonb; v_added jsonb; v_drivers jsonb; v_comp jsonb; v_bridge jsonb := '[]'::jsonb; v_hours numeric := 0;
  v_mapd text[]; v_profd text[]; a jsonb; i int := 0; v_comp_id text; c kafaa_courses; v_lv int; v_hr numeric; v_rated int; base jsonb;
begin
  select * into r from kafaa_job_roles where id = p_role;
  if r.id is null then return null; end if;
  select * into m from kafaa_role_transformations where role_id = p_role;
  base := jsonb_build_object('role_id', r.id, 'family_id', r.family_id, 'path_only', true, 'status', coalesce(m.status, 'none'), 'version', coalesce(m.version, 0),
    'archetype', null, 'horizon', v_h, 'drivers', '[]'::jsonb, 'tasks', '[]'::jsonb, 'counts', jsonb_build_object('rated', 0, 'grow', 0, 'augmented', 0, 'shrink', 0),
    'added', '[]'::jsonb, 'complements', '[]'::jsonb, 'bridge', '[]'::jsonb, 'bridge_hours', 0, 'me', null);
  if kafaa_rt_path_only(r.family_id, r.security_sensitive) then return base; end if;
  v_now := kafaa_rt_reqs(p_role, 'now'); v_30 := kafaa_rt_reqs(p_role, '2030'); v_35 := kafaa_rt_reqs(p_role, '2035');
  v_tasks := kafaa_rt_tasks(p_role);
  v_rated := jsonb_array_length(v_tasks);
  v_added := kafaa_rt_added(v_now, v_30, '2030') || kafaa_rt_added(v_30, v_35, '2035');
  select coalesce(array_agg(kafaa_rt_driver(d)) filter (where kafaa_rt_driver(d) is not null), '{}') into v_mapd from unnest(coalesce(m.drivers, '{}'::text[])) d;
  select coalesce(array_agg(kafaa_rt_driver(d)) filter (where kafaa_rt_driver(d) is not null), '{}') into v_profd from unnest(kafaa_rt_vdrivers(p_role, '2030') || kafaa_rt_vdrivers(p_role, '2035')) d;
  select coalesce(jsonb_agg(x.o order by x.i), '[]'::jsonb) into v_drivers from (
    select d.i, jsonb_build_object('driver', d.d, 'in_map', d.d = any(v_mapd), 'in_profile', d.d = any(v_profd),
      'reqs', (select count(*) from jsonb_array_elements(v_added) e where e->>'driver' = d.d),
      'tasks', (select count(*) from jsonb_array_elements(v_tasks) e where e->>'driver' = d.d)) as o
    from unnest(kafaa_rt_drivers()) with ordinality d(d, i)) x
  where (x.o->>'in_map')::boolean or (x.o->>'in_profile')::boolean or (x.o->>'reqs')::int > 0 or (x.o->>'tasks')::int > 0;
  if v_rated > 0 then
    select coalesce(jsonb_agg(jsonb_build_object('skill_id', q.skill_id, 'tasks', q.n, 'level', q.lv, 'source', 'tasks',
        'reasons', jsonb_build_array(kafaa_rt_reason('complement_tasks', jsonb_build_object('n', q.n, 'level', q.lv))))
      order by q.n desc, q.lv desc, q.skill_id collate "C"), '[]'::jsonb) into v_comp
    from (select x.skill_id, count(*)::int as n, max(x.level)::int as lv from kafaa_jta_task_skills x left join kafaa_skills s on s.id = x.skill_id
          where x.active and s.area is distinct from 'security'
            and x.task_id in (select e->>'id' from jsonb_array_elements(v_tasks) e where e->>'band' = 'human_core')
          group by x.skill_id) q;
  else
    select coalesce(jsonb_agg(jsonb_build_object('skill_id', q.sid, 'tasks', 0, 'level', q.lv, 'source', 'profile',
        'reasons', jsonb_build_array(kafaa_rt_reason('complement_profile', jsonb_build_object('level', q.lv, 'horizon', '2030'))))
      order by q.lv desc, q.sid collate "C"), '[]'::jsonb) into v_comp
    from (select k.sid, max(k.lv)::int as lv from (
            select kafaa_rt_skill_of(e->>'kind', e->>'ref_id') as sid, (e->>'level')::numeric::int as lv from jsonb_array_elements(v_30) e) k
          join kafaa_skills s on s.id = k.sid
          where s.area <> 'security' and (s.area in ('human_performance', 'leadership') or s.fs_area = 'transversal')
          group by k.sid) q;
  end if;
  for a in select e.value from jsonb_array_elements(v_added) with ordinality e(value, n) order by e.n loop
    i := i + 1;
    v_comp_id := case when a->>'kind' = 'competency' then a->>'ref_id' else (select s.competency_id from kafaa_skills s where s.id = a->>'ref_id') end;
    c := kafaa_rt_bridge_course(v_comp_id);
    v_lv := (a->>'to')::int - (a->>'from')::int;
    v_hr := case when c.id is not null then c.duration_hours else 20 * v_lv end;
    v_hours := v_hours + v_hr;
    v_bridge := v_bridge || jsonb_build_array(jsonb_build_object('step', i, 'horizon', a->>'horizon', 'kind', a->>'kind', 'ref_id', a->>'ref_id', 'skill_id', a->'skill_id',
      'from', (a->>'from')::int, 'to', (a->>'to')::int, 'mode', case when c.id is not null then 'course' else 'practice' end, 'course_id', c.id, 'hours', v_hr,
      'reasons', jsonb_build_array(case when c.id is not null then kafaa_rt_reason('bridge_course', jsonb_build_object('hours', v_hr))
                                        else kafaa_rt_reason('bridge_practice', jsonb_build_object('levels', v_lv, 'per', 20, 'hours', v_hr)) end,
                                   kafaa_rt_reason('bridge_for', jsonb_build_object('horizon', a->>'horizon')))));
  end loop;
  return base || jsonb_build_object('path_only', false, 'archetype', m.archetype, 'drivers', v_drivers, 'tasks', v_tasks,
    'counts', jsonb_build_object('rated', v_rated,
      'grow', (select count(*) from jsonb_array_elements(v_tasks) e where e->>'move' = 'grow'),
      'augmented', (select count(*) from jsonb_array_elements(v_tasks) e where e->>'move' = 'augmented'),
      'shrink', (select count(*) from jsonb_array_elements(v_tasks) e where e->>'move' = 'shrink')),
    'added', v_added, 'complements', v_comp, 'bridge', v_bridge, 'bridge_hours', v_hours,
    'me', case when p_person is null then null else kafaa_rt_readiness(p_person, case when v_h = '2035' then v_35 else v_30 end, v_h) end);
end $$;

-- ───────────── HR cohort: staff in current, non-restricted roles (protected attributes are never read)
create or replace function kafaa_rt_cohort() returns table (person_id text, role_id text, family_id text, grp text) language sql stable security definer set search_path = public as $$
  select p.id, r.id, f.id, f.grp from kafaa_people p join kafaa_job_roles r on r.id = p.job_role_id join kafaa_job_families f on f.id = r.family_id
  where p.kind = 'staff' and p.status = 'active' and coalesce(r.lifecycle, 'current') = 'current' and not kafaa_rt_path_only(r.family_id, r.security_sensitive)
$$;

-- ───────────── RPC: the map of a role (default my role) with my time-to-ready; any holder of transformation
create or replace function kafaa_role_transformation(p_role text default null, p_horizon text default '2030') returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); v_mine text; v_rid text; r kafaa_job_roles; v_edit boolean; d kafaa_transformation_drafts; v_map jsonb := null; v_draft jsonb := null;
begin
  if me is null or not kafaa_has_grant('transformation', array['R', 'Own', 'Scope', 'Agg', 'W', 'A']) then return null; end if;
  select jr.id into v_mine from kafaa_people p join kafaa_job_roles jr on jr.id = p.job_role_id where p.id = me and coalesce(jr.lifecycle, 'current') = 'current';
  v_rid := coalesce(nullif(btrim(coalesce(p_role, '')), ''), v_mine);
  v_edit := kafaa_has_grant('transformation', array['W', 'A']);
  select * into r from kafaa_job_roles where id = v_rid;
  if r.id is not null and coalesce(r.lifecycle, 'current') = 'current' then
    v_map := kafaa_rt_map(r.id, me, p_horizon);
    if v_edit then
      select * into d from kafaa_transformation_drafts where role_id = r.id and open;
      if d.id is not null then v_draft := kafaa_rt_content(d.content) || jsonb_build_object('saved_by', d.saved_by, 'saved_at', d.saved_at); end if;
    end if;
  end if;
  return jsonb_build_object('my_role_id', v_mine, 'map', v_map, 'can_edit', v_edit, 'draft', v_draft);
end $$;

-- ───────────── FS12: exposure by job family, family group and in total (HR: transformation Agg/A), suppressed under 10 people
create or replace function kafaa_rt_exp_cell(p_key text, p_n int, p_analysed int, p_a int, p_p int, p_h int) returns jsonb language sql immutable set search_path = public as $$
  select case when p_n < 10 then jsonb_build_object('key', p_key, 'people', null, 'suppressed', true, 'analysed', null, 'tasks', null, 'shares', null)
    else jsonb_build_object('key', p_key, 'people', p_n, 'suppressed', false, 'analysed', p_analysed, 'tasks', p_a + p_p + p_h,
      'shares', case when p_a + p_p + p_h > 0 then jsonb_build_object('augment', kafaa_rt_pct(p_a, p_a + p_p + p_h), 'automate_partly', kafaa_rt_pct(p_p, p_a + p_p + p_h), 'human_core', kafaa_rt_pct(p_h, p_a + p_p + p_h)) end) end
$$;
create or replace function kafaa_exposure_aggregate() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); v jsonb;
begin
  if me is null or not kafaa_has_grant('transformation', array['Agg', 'A']) then return null; end if;
  with c as (select * from kafaa_rt_cohort()),
  rb as (
    select t.role_id, count(*) filter (where e.ex = 'augment')::int as a, count(*) filter (where e.ex = 'automate_partly')::int as p, count(*) filter (where e.ex = 'human_core')::int as h
    from kafaa_jta_tasks t cross join lateral (select kafaa_fx_exposure(t.ai_capability_needed, t.change_horizon, t.critical, false)->>'exposure' as ex) e
    where not t.restricted and t.status = 'active' and e.ex is not null group by t.role_id
  ),
  pc as (select c.*, coalesce(rb.a, 0) as a, coalesce(rb.p, 0) as p, coalesce(rb.h, 0) as h from c left join rb on rb.role_id = c.role_id),
  fam as (select family_id as k, count(*)::int as n, count(*) filter (where a + p + h > 0)::int as an, sum(a)::int as a, sum(p)::int as p, sum(h)::int as h from pc group by family_id),
  grp as (select grp as k, count(*)::int as n, count(*) filter (where a + p + h > 0)::int as an, sum(a)::int as a, sum(p)::int as p, sum(h)::int as h from pc group by grp),
  tot as (select count(*)::int as n, count(*) filter (where a + p + h > 0)::int as an, coalesce(sum(a), 0)::int as a, coalesce(sum(p), 0)::int as p, coalesce(sum(h), 0)::int as h from pc)
  select jsonb_build_object('min_group', 10,
    'families', coalesce((select jsonb_agg(kafaa_rt_exp_cell(k, n, an, a, p, h) order by k collate "C") from fam), '[]'::jsonb),
    'groups', coalesce((select jsonb_agg(kafaa_rt_exp_cell(k, n, an, a, p, h) order by k collate "C") from grp), '[]'::jsonb),
    'total', (select kafaa_rt_exp_cell('all', n, an, a, p, h) from tot),
    'not_broken_out', jsonb_build_array('security', 'safeguards', 'cyber')) into v;
  return v;
end $$;

-- ───────────── FS11: readiness for the 2030 (or 2035) profile by family, group and in total (HR), suppressed under 10 people
create or replace function kafaa_rt_ready_cell(p_key text, p_months int[]) returns jsonb language sql immutable set search_path = public as $$
  select case when coalesce(cardinality(p_months), 0) < 10 then jsonb_build_object('key', p_key, 'people', null, 'suppressed', true, 'ready_now', null, 'ready_pct', null, 'median_months', null)
    else jsonb_build_object('key', p_key, 'people', cardinality(p_months), 'suppressed', false,
      'ready_now', (select count(*)::int from unnest(p_months) x where x = 0),
      'ready_pct', kafaa_rt_pct((select count(*) from unnest(p_months) x where x = 0), cardinality(p_months)),
      'median_months', (select x from unnest(p_months) with ordinality u(x, i) order by x, i offset ((cardinality(p_months) - 1) / 2) limit 1)) end
$$;
create or replace function kafaa_transformation_overview(p_horizon text default '2030') returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); v_h text := case when p_horizon = '2035' then '2035' else '2030' end; v jsonb;
begin
  if me is null or not kafaa_has_grant('transformation', array['Agg', 'A']) then return null; end if;
  with c as (select * from kafaa_rt_cohort()),
  pm as (select c.*, ((kafaa_rt_readiness(c.person_id, kafaa_rt_reqs(c.role_id, v_h), v_h))->>'months')::int as months from c)
  select jsonb_build_object('min_group', 10, 'horizon', v_h,
    'families', coalesce((select jsonb_agg(kafaa_rt_ready_cell(k, ms) order by k collate "C") from (select family_id as k, array_agg(months) as ms from pm group by family_id) f), '[]'::jsonb),
    'groups', coalesce((select jsonb_agg(kafaa_rt_ready_cell(k, ms) order by k collate "C") from (select grp as k, array_agg(months) as ms from pm group by grp) g), '[]'::jsonb),
    'total', kafaa_rt_ready_cell('all', coalesce((select array_agg(months) from pm), '{}'::int[])),
    'not_broken_out', jsonb_build_array('security', 'safeguards', 'cyber')) into v;
  return v;
end $$;

-- ───────────── publishTransformation: checks (checkTransformation), content (contentOf), the RPC
create or replace function kafaa_rt_str(p jsonb, k text) returns text language sql immutable set search_path = public as $$
  select case when jsonb_typeof(p->k) = 'string' then btrim(p->>k) end
$$;
create or replace function kafaa_rt_banned(p text) returns boolean language sql immutable set search_path = public as $$
  select coalesce(p, '') ~* '\y(replac(e|es|ed|ing|ement|ements)|redundan(t|cy|cies)|job (loss|losses|cuts?)|lay ?offs?|laid off|eliminat(e|es|ed|ing) (jobs?|roles?|positions?)|made surplus|headcount reduction)\y'
      or coalesce(p, '') ~ '(استبدال|يستبدل|تستبدل|سيستبدل|(سي|ست|ي|ت)حل( [^ ]+){0,4} محل|إحلال|فائض عن الحاجة|زائد عن الحاجة|الاستغناء عن|تسريح|إلغاء الوظائف|إلغاء الوظيفة|خفض عدد الموظفين)'
$$;
create or replace function kafaa_rt_check(p jsonb, r kafaa_job_roles) returns text language plpgsql stable set search_path = public as $$
declare v_path boolean; v_dr jsonb := p->'drivers'; v_arch text; t text; k text; v_texts text[];
begin
  if r.id is null or coalesce(r.lifecycle, 'current') <> 'current' then return 'not_found'; end if;
  v_path := kafaa_rt_path_only(r.family_id, r.security_sensitive);
  if v_dr is null or jsonb_typeof(v_dr) <> 'array'
     or exists (select 1 from jsonb_array_elements(v_dr) e where jsonb_typeof(e) <> 'string' or not ((e #>> '{}') = any(kafaa_rt_drivers())))
     or (select count(distinct e #>> '{}') from jsonb_array_elements(v_dr) e) <> jsonb_array_length(v_dr) then return 'invalid'; end if;
  if p->'archetype' is not null and jsonb_typeof(p->'archetype') not in ('null', 'string') then return 'invalid'; end if;
  v_arch := case when jsonb_typeof(p->'archetype') = 'string' then p->>'archetype' end;
  if v_arch is not null and v_arch not in ('mastery_builder', 'analytical_specialist', 'human_connector') then return 'invalid'; end if;
  if not v_path and v_arch is null then return 'invalid'; end if;
  foreach k in array array['summary_en', 'summary_ar'] loop
    t := kafaa_rt_str(p, k); if t is null or length(t) < 40 or length(t) > 700 then return 'invalid'; end if;
  end loop;
  foreach k in array array['public_summary_en', 'public_summary_ar'] loop
    t := kafaa_rt_str(p, k); if t is null or length(t) < 20 or length(t) > 320 then return 'invalid'; end if;
  end loop;
  if v_path and (v_arch is not null or jsonb_array_length(v_dr) > 0) then return 'security_restricted'; end if;
  v_texts := array[kafaa_rt_str(p, 'summary_en'), kafaa_rt_str(p, 'summary_ar'), kafaa_rt_str(p, 'public_summary_en'), kafaa_rt_str(p, 'public_summary_ar')];
  if not kafaa_rpv_text_clean(v_texts) then return 'unclean_text'; end if;
  if exists (select 1 from unnest(v_texts) x where kafaa_rt_banned(x)) then return 'banned_wording'; end if;
  if v_texts[3] ~ '[0-9٠-٩۰-۹]' or v_texts[4] ~ '[0-9٠-٩۰-۹]' then return 'public_numbers'; end if;
  if coalesce((p->>'publish')::boolean, false) and not exists (
      select 1 from jsonb_array_elements(case when jsonb_typeof(p->'sources') = 'array' then p->'sources' else '[]'::jsonb end) s
      where jsonb_typeof(s) = 'object' and jsonb_typeof(s->'url') = 'string' and (s->>'url') ~ '^https://' and jsonb_typeof(s->'label') = 'string' and length(btrim(s->>'label')) > 0) then
    return 'source_required'; end if;
  return 'ok';
end $$;
create or replace function kafaa_rt_message(p_code text) returns text language sql immutable set search_path = public as $$
  select case p_code
    when 'not_signed_in' then 'Sign in to edit role transformation maps'
    when 'forbidden' then 'Only the training manager or the HR director can edit role transformation maps'
    when 'not_found' then 'Role not found (current roles only)'
    when 'invalid' then 'Choose an archetype, known drivers (each once), a summary of 40 to 700 characters and a public summary of 20 to 320 characters, in English and Arabic'
    when 'security_restricted' then 'Security, safeguards and cyber roles stay at career-path level: no archetype and no drivers'
    when 'unclean_text' then 'Map text must not mention headcount, sites or a deployment decision'
    when 'banned_wording' then 'Describe how tasks change, not people: wording such as "replace" or "redundant" is not used (English and Arabic)'
    when 'public_numbers' then 'The public summary carries no numbers'
    when 'source_required' then 'Publishing needs at least one https source with a label'
    else p_code end
$$;
create or replace function kafaa_rt_content(p jsonb) returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object(
    'archetype', case when jsonb_typeof(p->'archetype') = 'string' then p->'archetype' else 'null'::jsonb end,
    'drivers', case when jsonb_typeof(p->'drivers') = 'array' then p->'drivers' else '[]'::jsonb end,
    'summary_en', coalesce(kafaa_rt_str(p, 'summary_en'), ''), 'summary_ar', coalesce(kafaa_rt_str(p, 'summary_ar'), ''),
    'public_summary_en', coalesce(kafaa_rt_str(p, 'public_summary_en'), ''), 'public_summary_ar', coalesce(kafaa_rt_str(p, 'public_summary_ar'), ''),
    'sources', coalesce((select jsonb_agg(jsonb_build_object('label', coalesce(kafaa_rt_str(s, 'label'), ''), 'url', coalesce(kafaa_rt_str(s, 'url'), ''),
        'as_of', nullif(coalesce(kafaa_rt_str(s, 'as_of'), ''), '')) order by i)
      from jsonb_array_elements(case when jsonb_typeof(p->'sources') = 'array' then p->'sources' else '[]'::jsonb end) with ordinality x(s, i)), '[]'::jsonb))
$$;
create or replace function kafaa_publish_transformation(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_rid text := coalesce(kafaa_rt_str(p, 'role_id'), ''); v_pub boolean := coalesce(jsonb_typeof(p->'publish') = 'boolean' and (p->>'publish')::boolean, false);
  v_action text; v_role text; r kafaa_job_roles; v_code text; c jsonb; cur kafaa_role_transformations; v_ver int; v_hist jsonb; a kafaa_audit_events; l integer; v_id text;
begin
  v_action := case when v_pub then 'transformation.publish' else 'transformation.save' end;
  if me is null then return kafaa_refuse(v_action, 'role_transformations', nullif(v_rid, ''), 'not_signed_in', kafaa_rt_message('not_signed_in')); end if;
  if not kafaa_has_grant('transformation', array['W', 'A']) then return kafaa_refuse(v_action, 'role_transformations', nullif(v_rid, ''), 'forbidden', kafaa_rt_message('forbidden')); end if;
  v_role := kafaa_acting_role('transformation', array['W', 'A']);
  select * into r from kafaa_job_roles where id = v_rid;
  v_code := kafaa_rt_check(p || jsonb_build_object('publish', v_pub), r);
  if v_code <> 'ok' then return kafaa_refuse(v_action, 'role_transformations', nullif(v_rid, ''), v_code, kafaa_rt_message(v_code), v_role); end if;
  c := kafaa_rt_content(p);
  v_id := 'rt-' || v_rid;
  select * into cur from kafaa_role_transformations where id = v_id;
  if not v_pub then
    insert into kafaa_transformation_drafts (id, role_id, content, open, saved_by, saved_at) values ('rtd-' || v_rid, v_rid, c, true, me, now())
    on conflict (id) do update set content = excluded.content, open = true, saved_by = me, saved_at = now();
    if cur.id is null then
      insert into kafaa_role_transformations (id, role_id, family_id, archetype, drivers, summary_en, summary_ar, public_summary_en, public_summary_ar, sources, as_of, status, is_public, path_only,
        version, history, updated_by, updated_at, published_by, published_at, sort)
      values (v_id, v_rid, r.family_id, c->>'archetype', array(select jsonb_array_elements_text(c->'drivers')), c->>'summary_en', c->>'summary_ar', c->>'public_summary_en', c->>'public_summary_ar',
        c->'sources', current_date, 'draft', false, kafaa_rt_path_only(r.family_id, r.security_sensitive), 0, '[]'::jsonb, me, now(), null, null, coalesce(r.sort, 0));
    end if;
    a := kafaa_audit(v_action, 'role_transformations', v_rid, 'ok', 'draft saved', 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Draft saved', a, null, jsonb_build_object('id', v_id, 'status', 'draft', 'version', coalesce(cur.version, 0)));
  end if;
  v_ver := coalesce(cur.version, 0) + 1;
  v_hist := coalesce(cur.history, '[]'::jsonb);
  if cur.id is not null and cur.status = 'published' then
    v_hist := v_hist || jsonb_build_array(jsonb_build_object('version', cur.version, 'archetype', cur.archetype, 'drivers', to_jsonb(cur.drivers), 'summary_en', cur.summary_en, 'summary_ar', cur.summary_ar,
      'public_summary_en', cur.public_summary_en, 'public_summary_ar', cur.public_summary_ar, 'published_by', cur.published_by, 'published_at', cur.published_at));
  end if;
  if cur.id is not null then
    update kafaa_role_transformations set archetype = c->>'archetype', drivers = array(select jsonb_array_elements_text(c->'drivers')), summary_en = c->>'summary_en', summary_ar = c->>'summary_ar',
      public_summary_en = c->>'public_summary_en', public_summary_ar = c->>'public_summary_ar', sources = c->'sources', as_of = current_date, status = 'published', is_public = true,
      path_only = kafaa_rt_path_only(r.family_id, r.security_sensitive), version = v_ver, history = v_hist, updated_by = me, updated_at = now(), published_by = me, published_at = now()
    where id = v_id;
  else
    insert into kafaa_role_transformations (id, role_id, family_id, archetype, drivers, summary_en, summary_ar, public_summary_en, public_summary_ar, sources, as_of, status, is_public, path_only,
      version, history, updated_by, updated_at, published_by, published_at, sort)
    values (v_id, v_rid, r.family_id, c->>'archetype', array(select jsonb_array_elements_text(c->'drivers')), c->>'summary_en', c->>'summary_ar', c->>'public_summary_en', c->>'public_summary_ar',
      c->'sources', current_date, 'published', true, kafaa_rt_path_only(r.family_id, r.security_sensitive), v_ver, v_hist, me, now(), me, now(), coalesce(r.sort, 0));
  end if;
  update kafaa_transformation_drafts set open = false, saved_by = me, saved_at = now() where role_id = v_rid and open;
  l := kafaa_ledger('kafaa.transformation.publish', v_rid || ' role transformation map v' || v_ver || ' published');
  a := kafaa_audit(v_action, 'role_transformations', v_rid, 'ok', 'v' || v_ver || ' published', case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Role transformation map published', a, l, jsonb_build_object('id', v_id, 'status', 'published', 'version', v_ver));
end $$;

-- ───────────── Grants: internal helpers are not executable by API roles; the four RPCs only by signed-in users.
revoke all on function kafaa_rt_reason(text, jsonb), kafaa_rt_drivers(), kafaa_rt_driver(text), kafaa_rt_path_only(text, boolean), kafaa_rt_imp(text), kafaa_rt_pct(numeric, numeric),
  kafaa_rt_skill_of(text, text), kafaa_rt_level_on(text, text, text), kafaa_rt_reqs(text, text), kafaa_rt_vdrivers(text, text), kafaa_rt_added(jsonb, jsonb, text),
  kafaa_rt_bridge_course(text), kafaa_rt_readiness(text, jsonb, text), kafaa_rt_tasks(text), kafaa_rt_map(text, text, text), kafaa_rt_cohort(),
  kafaa_rt_exp_cell(text, int, int, int, int, int), kafaa_rt_ready_cell(text, int[]), kafaa_rt_str(jsonb, text), kafaa_rt_banned(text), kafaa_rt_check(jsonb, kafaa_job_roles),
  kafaa_rt_message(text), kafaa_rt_content(jsonb) from public, anon, authenticated;
revoke all on function kafaa_role_transformation(text, text), kafaa_publish_transformation(jsonb), kafaa_exposure_aggregate(), kafaa_transformation_overview(text) from public, anon;
grant execute on function kafaa_role_transformation(text, text), kafaa_publish_transformation(jsonb), kafaa_exposure_aggregate(), kafaa_transformation_overview(text) to authenticated;
