-- [W1 · E5 · F09] Future Me: personal ADVANCE readiness, bridge plan and horizon roadmap (module M21).
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file, RLS in the per-statement
-- form (like 20261008140000_kafaa_rls_perf.sql), and the two RPCs. LocalBackend mirror: src/modules/m21/backend/local.ts;
-- goal targets mirror src/modules/m21/goals.ts. PGlite checks: scripts/validate/w1e5-future.mjs.

-- ───────────── Tables (generated DDL)
-- M21 · Horizon roadmap lanes 2026-2035 with public sources (F09; no headcount, no sites)
create table if not exists kafaa_horizon_lanes (
  id text primary key,
  code text not null unique,
  title_en text not null,
  title_ar text not null,
  summary_en text not null,
  summary_ar text not null,
  why_en text not null,
  why_ar text not null,
  skill_ids text[] not null default '{}'::text[],
  horizon text not null check (horizon in ('now', 'next', 'later')),
  path_only_role_ids text[] not null default '{}'::text[],
  role_ids text[] not null default '{}'::text[],
  sources jsonb not null default '[]'::jsonb,
  sort integer not null default 0
);
comment on table kafaa_horizon_lanes is '[M21] Horizon roadmap lanes 2026-2035 with public sources (F09; no headcount, no sites)';

-- M21 · Source-linked learning suggestions for ADVANCE skill bridges (F09)
create table if not exists kafaa_future_resources (
  id text primary key,
  kind text not null check (kind in ('course', 'track', 'programme', 'event', 'reading')),
  title_en text not null,
  title_ar text not null,
  summary_en text not null,
  summary_ar text not null,
  provider_en text not null default '',
  provider_ar text not null default '',
  tech_ids text[] not null default '{}'::text[],
  adv_skill_ids text[] not null default '{}'::text[],
  lane_ids text[] not null default '{}'::text[],
  course_id text,
  track_id text,
  org_id text,
  level integer not null default 1,
  hours numeric,
  sources jsonb not null default '[]'::jsonb,
  sort integer not null default 0
);
comment on table kafaa_future_resources is '[M21] Source-linked learning suggestions for ADVANCE skill bridges (F09)';

-- M21 · My interest in a technology family or horizon lane (own rows; HR sees the aggregate only) (F09)
create table if not exists kafaa_future_interest (
  id text primary key,
  person_id text not null,
  target_kind text not null check (target_kind in ('tech', 'lane')),
  tech_id text,
  lane_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table kafaa_future_interest is '[M21] My interest in a technology family or horizon lane (own rows; HR sees the aggregate only) (F09)';

-- M21 · Future Me learning goals handed to the Learning Coach as coach targets (F09 -> F07)
create table if not exists kafaa_future_goals (
  id text primary key,
  person_id text not null,
  kind text not null check (kind in ('adv_skill', 'bridge', 'lane', 'future_role')),
  ref_id text not null,
  tech_id text,
  lane_id text,
  skill_ids text[] not null default '{}'::text[],
  adv_skill_ids text[] not null default '{}'::text[],
  target_level integer not null default 2,
  title_en text not null,
  title_ar text not null,
  status text not null default 'active' check (status in ('active', 'removed')),
  source text not null default 'future_me',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table kafaa_future_goals is '[M21] Future Me learning goals handed to the Learning Coach as coach targets (F09 -> F07)';

-- Foreign keys and indexes
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_future_resources_course_id_fk') then alter table kafaa_future_resources add constraint kafaa_future_resources_course_id_fk foreign key (course_id) references kafaa_courses(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_future_resources_track_id_fk') then alter table kafaa_future_resources add constraint kafaa_future_resources_track_id_fk foreign key (track_id) references kafaa_adv_tracks(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_future_resources_org_id_fk') then alter table kafaa_future_resources add constraint kafaa_future_resources_org_id_fk foreign key (org_id) references kafaa_organisations(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_future_interest_person_id_fk') then alter table kafaa_future_interest add constraint kafaa_future_interest_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_future_interest_tech_id_fk') then alter table kafaa_future_interest add constraint kafaa_future_interest_tech_id_fk foreign key (tech_id) references kafaa_adv_technologies(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_future_interest_lane_id_fk') then alter table kafaa_future_interest add constraint kafaa_future_interest_lane_id_fk foreign key (lane_id) references kafaa_horizon_lanes(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_future_goals_person_id_fk') then alter table kafaa_future_goals add constraint kafaa_future_goals_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_future_goals_tech_id_fk') then alter table kafaa_future_goals add constraint kafaa_future_goals_tech_id_fk foreign key (tech_id) references kafaa_adv_technologies(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_future_goals_lane_id_fk') then alter table kafaa_future_goals add constraint kafaa_future_goals_lane_id_fk foreign key (lane_id) references kafaa_horizon_lanes(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_future_resources_kind_idx on kafaa_future_resources (kind);
create index if not exists kafaa_future_resources_course_id_idx on kafaa_future_resources (course_id);
create index if not exists kafaa_future_resources_track_id_idx on kafaa_future_resources (track_id);
create index if not exists kafaa_future_resources_org_id_idx on kafaa_future_resources (org_id);
create index if not exists kafaa_future_interest_person_id_idx on kafaa_future_interest (person_id);
create index if not exists kafaa_future_interest_tech_id_idx on kafaa_future_interest (tech_id);
create index if not exists kafaa_future_interest_lane_id_idx on kafaa_future_interest (lane_id);
create index if not exists kafaa_future_goals_person_id_idx on kafaa_future_goals (person_id);
create index if not exists kafaa_future_goals_ref_id_idx on kafaa_future_goals (ref_id);
create index if not exists kafaa_future_goals_tech_id_idx on kafaa_future_goals (tech_id);
create index if not exists kafaa_future_goals_lane_id_idx on kafaa_future_goals (lane_id);

-- ───────────── RLS (policies created when missing, then set to the per-statement form)
alter table kafaa_horizon_lanes enable row level security;
alter table kafaa_future_resources enable row level security;
alter table kafaa_future_interest enable row level security;
alter table kafaa_future_goals enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_horizon_lanes' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_horizon_lanes for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_future_resources' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_future_resources for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_future_interest' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_future_interest for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_future_interest' and policyname = 'kafaa_insert') then
    execute 'create policy kafaa_insert on kafaa_future_interest for insert to anon, authenticated with check (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_future_interest' and policyname = 'kafaa_update') then
    execute 'create policy kafaa_update on kafaa_future_interest for update to authenticated using (false) with check (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_future_goals' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_future_goals for select to anon, authenticated using (false)'; end if;
end $$;
alter policy kafaa_read on kafaa_horizon_lanes using ((SELECT kafaa_has_grant('public_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text])));
alter policy kafaa_read on kafaa_future_resources using ((SELECT kafaa_has_grant('public_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text])));
alter policy kafaa_read on kafaa_future_interest using (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false)));
alter policy kafaa_insert on kafaa_future_interest with check (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['W'::text, 'A'::text])) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text])))));
alter policy kafaa_update on kafaa_future_interest using (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['W'::text, 'A'::text])) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))))) with check (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['W'::text, 'A'::text])) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text])))));
alter policy kafaa_read on kafaa_future_goals using (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false)));
-- Reference tables and goals: read only for API roles (goals change only through kafaa_set_future_goal). Interest: own rows, direct.
revoke all on kafaa_horizon_lanes, kafaa_future_resources, kafaa_future_interest, kafaa_future_goals from anon, authenticated;
grant select on kafaa_horizon_lanes, kafaa_future_resources, kafaa_future_interest, kafaa_future_goals to anon, authenticated;
grant insert, update on kafaa_future_interest to authenticated;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'kafaa_future_interest_audit') then
    execute 'create trigger kafaa_future_interest_audit after insert or update on kafaa_future_interest for each row execute function kafaa_audit_row()'; end if;
end $$;

-- ───────────── RPC: "Add to my learning goals" (F09 -> F07 coach targets). Staff with a skills profile; audited, no ledger.
-- Same rules as goalTarget() in src/modules/m21/goals.ts: skill ids sorted by id, never security-area skills.
create or replace function kafaa_set_future_goal(p_kind text, p_ref text, p_active boolean default true) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; a kafaa_audit_events; v_entity text := coalesce(p_kind, '') || ':' || coalesce(p_ref, '');
  v_id text; v_cur kafaa_future_goals; v_tech text; v_lane text; v_adv text[] := '{}'::text[]; v_skills text[]; v_en text; v_ar text; v_found boolean;
begin
  if me is null then return kafaa_refuse('future.goal', 'future_goals', v_entity, 'not_signed_in', 'Sign in to set learning goals'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  if v_role is null then return kafaa_refuse('future.goal', 'future_goals', v_entity, 'forbidden', 'Future Me goals are for staff with a skills profile'); end if;
  if p_kind is null or p_kind not in ('adv_skill', 'bridge', 'lane', 'future_role') or coalesce(p_ref, '') = '' then
    return kafaa_refuse('future.goal', 'future_goals', v_entity, 'invalid', 'Unknown goal kind', v_role);
  end if;
  v_id := 'fg:' || me || ':' || p_kind || ':' || p_ref;
  select * into v_cur from kafaa_future_goals where id = v_id;
  if p_active is false then
    if v_cur.id is null or v_cur.status = 'removed' then return kafaa_refuse('future.goal', 'future_goals', v_entity, 'not_found', 'This goal is not on your list', v_role); end if;
    update kafaa_future_goals set status = 'removed', updated_at = now() where id = v_id;
    a := kafaa_audit('future.goal', 'future_goals', v_id, 'ok', 'removed ' || p_kind || ' ' || p_ref, 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Removed from your learning goals', a, null, jsonb_build_object('id', v_id, 'status', 'removed', 'skill_ids', to_jsonb(v_cur.skill_ids)));
  end if;
  if p_kind = 'adv_skill' then
    select s.tech_id, s.skill_en, s.skill_ar, true into v_tech, v_en, v_ar, v_found from kafaa_adv_skills s where s.id = p_ref;
    v_adv := array[p_ref];
  elsif p_kind = 'bridge' then
    select b.tech_id, coalesce(r.title_en, b.from_role_id) || ' · ' || coalesce(t.family_en, b.tech_id), coalesce(r.title_ar, b.from_role_id) || ' · ' || coalesce(t.family_ar, b.tech_id), true
      into v_tech, v_en, v_ar, v_found
      from kafaa_skill_bridges b left join kafaa_job_roles r on r.id = b.from_role_id left join kafaa_adv_technologies t on t.id = b.tech_id where b.id = p_ref;
    v_adv := coalesce((select array_agg(s.id order by s.id collate "C") from kafaa_adv_skills s where s.tech_id = v_tech), '{}'::text[]);
  elsif p_kind = 'future_role' then
    select f.tech_ids[1], f.title_en, f.title_ar, true, coalesce((select array_agg(x order by x collate "C") from unnest(f.skill_ids) x), '{}'::text[])
      into v_tech, v_en, v_ar, v_found, v_adv from kafaa_future_roles f where f.id = p_ref;
  else
    select l.id, l.title_en, l.title_ar, true into v_lane, v_en, v_ar, v_found from kafaa_horizon_lanes l where l.id = p_ref;
    v_adv := '{}'::text[];
  end if;
  if not coalesce(v_found, false) then return kafaa_refuse('future.goal', 'future_goals', v_entity, 'not_found', 'Goal target not found', v_role); end if;
  if p_kind = 'lane' then
    v_skills := coalesce((select array_agg(s.id order by s.id collate "C") from kafaa_skills s join kafaa_horizon_lanes l on l.id = v_lane where s.id = any(l.skill_ids) and s.area <> 'security'), '{}'::text[]);
  else
    v_skills := coalesce((select array_agg(s.id order by s.id collate "C") from kafaa_skills s where s.area <> 'security' and s.adv_skill_ids && v_adv), '{}'::text[]);
  end if;
  if (v_cur.id is null or v_cur.status <> 'active') and (select count(*) from kafaa_future_goals g where g.person_id = me and g.status = 'active') >= 12 then
    return kafaa_refuse('future.goal', 'future_goals', v_entity, 'limit', 'You can keep up to 12 Future Me goals; remove one first', v_role);
  end if;
  insert into kafaa_future_goals (id, person_id, kind, ref_id, tech_id, lane_id, skill_ids, adv_skill_ids, target_level, title_en, title_ar, status, source, created_at, updated_at)
  values (v_id, me, p_kind, p_ref, v_tech, v_lane, v_skills, v_adv, 2, v_en, v_ar, 'active', 'future_me', now(), now())
  on conflict (id) do update set tech_id = excluded.tech_id, lane_id = excluded.lane_id, skill_ids = excluded.skill_ids, adv_skill_ids = excluded.adv_skill_ids,
    target_level = excluded.target_level, title_en = excluded.title_en, title_ar = excluded.title_ar, status = 'active', updated_at = now();
  a := kafaa_audit('future.goal', 'future_goals', v_id, 'ok', format('added %s %s (%s skills)', p_kind, p_ref, coalesce(array_length(v_skills, 1), 0)), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Added to your learning goals', a, null, jsonb_build_object('id', v_id, 'status', 'active', 'skill_ids', to_jsonb(v_skills)));
end $$;

-- ───────────── RPC: demand signal for HR and training (F26): distinct people per technology family or lane, suppressed below 10.
create or replace function kafaa_future_demand() returns table (source text, target_kind text, target_id text, n integer, suppressed boolean)
language plpgsql stable security definer set search_path = public as $$
declare v_min int := (kafaa_rules()->>'minGroupSize')::int;
begin
  if not kafaa_has_grant('skills_profile', array['Agg', 'R', 'A']) then raise exception 'Kafa''a · future demand is aggregate-only and restricted' using errcode = '42501'; end if;
  return query
    with x as (
      select 'interest'::text as src, i.target_kind as tk, coalesce(i.tech_id, i.lane_id) as tid, i.person_id from kafaa_future_interest i where i.active and coalesce(i.tech_id, i.lane_id) is not null
      union all
      select 'goal'::text, case when g.lane_id is not null then 'lane' else 'tech' end, coalesce(g.lane_id, g.tech_id), g.person_id from kafaa_future_goals g where g.status = 'active' and coalesce(g.lane_id, g.tech_id) is not null
    ), c as (select x.src, x.tk, x.tid, count(distinct x.person_id)::int as k from x group by x.src, x.tk, x.tid)
    select c.src, c.tk, c.tid, case when c.k < v_min then null else c.k end, c.k < v_min from c
    order by c.src collate "C", c.tk collate "C", c.tid collate "C";
end $$;

revoke execute on function kafaa_set_future_goal(text, text, boolean), kafaa_future_demand() from public, anon;
grant execute on function kafaa_set_future_goal(text, text, boolean), kafaa_future_demand() to authenticated;
