-- [FS wave A · E3 · FS04] One future-skill keyspace and a computed future-skills radar (M11).
--   * kafaa_future_skill_map: every ADVANCE skill (kafaa_adv_skills, as-*), every radar key (kafaa_future_skills.skill_key) and every
--     gap-plan key resolves to at least one catalogue skill (kafaa_skills, sk-*) with a relation (transfers, adapts, new) and a need level.
--     Reference data readable like frameworks; changed only by an admin through kafaa_save_future_skill_map (audited, rows never removed).
--   * Additive columns: kafaa_adv_skills.sk_ids, kafaa_future_skills.sk_id / target_level / assumption_en / assumption_ar / sources,
--     kafaa_skill_gap_plans.sk_id (the plan's old skill_key stays as its label).
--   * kafaa_future_radar(scenario): SIMULATED demand per radar key with readiness computed from kafaa_person_skills (share of active staff
--     at the target level on the key's catalogue skills; transfers and new count 1, adapts 0.5), overall and per job family; cells under
--     the minimum group size (10) are suppressed. HR analyst / CHCO office and auditors only. TS mirror: src/modules/m11/keyspace.ts.
--   * kafaa_save_skill_gap_plan (G4) is redefined with the same checks plus sk_id (radar key resolved through the map, or an sk-* id).
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- LocalBackend mirror: src/modules/m11/backend/local.ts. PGlite checks: scripts/validate/fs13-keyspace.mjs.

-- ───────────── Tables and columns (same DDL as the generated 20261008120100 schema file)
-- M11 · One future-skill keyspace: ADVANCE, radar and gap-plan keys resolved to catalogue skills (FS04)
create table if not exists kafaa_future_skill_map (
  id text primary key,
  key text not null,
  key_kind text not null check (key_kind in ('adv_skill', 'radar', 'gap_plan')),
  sk_id text not null,
  relation text not null check (relation in ('transfers', 'adapts', 'new')),
  need_level integer not null default 2,
  primary_sk boolean not null default false,
  active boolean not null default true,
  note_en text not null default '',
  note_ar text not null default '',
  sort integer not null default 0,
  updated_by text,
  updated_at timestamptz not null default now()
);
comment on table kafaa_future_skill_map is '[M11] One future-skill keyspace: ADVANCE, radar and gap-plan keys resolved to catalogue skills (FS04)';

alter table kafaa_adv_skills add column if not exists sk_ids text[] not null default '{}';
alter table kafaa_future_skills add column if not exists sk_id text;
alter table kafaa_future_skills add column if not exists target_level integer not null default 2;
alter table kafaa_future_skills add column if not exists assumption_en text not null default '';
alter table kafaa_future_skills add column if not exists assumption_ar text not null default '';
alter table kafaa_future_skills add column if not exists sources jsonb not null default '[]'::jsonb;
alter table kafaa_skill_gap_plans add column if not exists sk_id text;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_future_skills_sk_id_fk') then alter table kafaa_future_skills add constraint kafaa_future_skills_sk_id_fk foreign key (sk_id) references kafaa_skills(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_gap_plans_sk_id_fk') then alter table kafaa_skill_gap_plans add constraint kafaa_skill_gap_plans_sk_id_fk foreign key (sk_id) references kafaa_skills(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_future_skill_map_sk_id_fk') then alter table kafaa_future_skill_map add constraint kafaa_future_skill_map_sk_id_fk foreign key (sk_id) references kafaa_skills(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_future_skills_sk_id_idx on kafaa_future_skills (sk_id);
create index if not exists kafaa_skill_gap_plans_sk_id_idx on kafaa_skill_gap_plans (sk_id);
create index if not exists kafaa_future_skill_map_key_idx on kafaa_future_skill_map (key);
create index if not exists kafaa_future_skill_map_key_kind_idx on kafaa_future_skill_map (key_kind);
create index if not exists kafaa_future_skill_map_sk_id_idx on kafaa_future_skill_map (sk_id);

-- ───────────── RLS (per-statement form): the map is reference data, readable like frameworks (every role holds R through public)
alter table kafaa_future_skill_map enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_future_skill_map' and policyname = 'kafaa_read') then
    create policy kafaa_read on kafaa_future_skill_map for select to anon, authenticated using (false);
  end if;
end $$;
alter policy kafaa_read on kafaa_future_skill_map using ((SELECT kafaa_has_grant('frameworks'::text, ARRAY['R'::text, 'W'::text, 'A'::text])));
grant select on kafaa_future_skill_map to anon, authenticated;
revoke insert, update, delete on kafaa_future_skill_map from anon, authenticated;

-- ───────────── Internal: active map rows of one key in resolution order (primary first, then sort, then skill id)
create or replace function kafaa_fk_rows(p_key text) returns setof kafaa_future_skill_map language sql stable security definer set search_path = public as $$
  select * from kafaa_future_skill_map m where m.key = p_key and m.active order by m.primary_sk desc, m.sort, m.sk_id collate "C";
$$;

-- Internal: re-sync kafaa_adv_skills.sk_ids and kafaa_future_skills.sk_id for one key (row-audit triggers stay quiet: the caller audits)
create or replace function kafaa_fk_sync(p_key text) returns void language plpgsql security definer set search_path = public as $$
declare v_prev text := current_setting('kafaa.seeding', true);
begin
  perform set_config('kafaa.seeding', 'on', true);
  update kafaa_adv_skills a set sk_ids = coalesce((select array_agg(r.sk_id order by r.primary_sk desc, r.sort, r.sk_id collate "C") from kafaa_fk_rows(p_key) r), '{}') where a.id = p_key;
  update kafaa_future_skills f set sk_id = (select r.sk_id from kafaa_fk_rows(p_key) r limit 1) where f.skill_key = p_key;
  perform set_config('kafaa.seeding', coalesce(v_prev, ''), true);
end $$;

-- ───────────── The computed radar for one scenario (mirror of futureRadar in src/modules/m11/keyspace.ts)
create or replace function kafaa_future_radar_compute(p_scenario text) returns jsonb language sql stable security definer set search_path = public as $$
  with
  mn as (select (kafaa_rules()->>'minGroupSize')::int as v),
  staff as (select p.id, p.job_family_id from kafaa_people p where p.kind = 'staff' and p.status = 'active'),
  pop as (select count(*)::int as n from staff),
  ks as (select f.* from kafaa_future_skills f where f.scenario = p_scenario),
  mp as (select m.key, m.sk_id, m.relation, m.need_level from kafaa_future_skill_map m where m.active),
  lv as (select ps.person_id, ps.skill_id, ps.level from kafaa_person_skills ps join staff s on s.id = ps.person_id where coalesce(ps.active, true)),
  cr as (
    select s.id as person_id, s.job_family_id, k.skill_key as key,
      coalesce(max(case when l.level >= mp.need_level then case mp.relation when 'adapts' then 1 else 2 end end), 0) as c2
    from staff s cross join ks k left join mp on mp.key = k.skill_key left join lv l on l.person_id = s.id and l.skill_id = mp.sk_id
    group by s.id, s.job_family_id, k.skill_key
  ),
  agg as (select cr.key, sum(cr.c2)::int as twice, count(*) filter (where cr.c2 > 0)::int as ready from cr group by cr.key),
  rws as (
    select k.skill_key, jsonb_build_object(
      'key', k.skill_key, 'skill_en', k.skill_en, 'skill_ar', k.skill_ar, 'tech_ids', to_jsonb(coalesce(k.tech_ids, '{}')),
      'sk_id', coalesce(k.sk_id, (select r.sk_id from kafaa_fk_rows(k.skill_key) r limit 1)),
      'sk_ids', coalesce((select jsonb_agg(r.sk_id order by r.primary_sk desc, r.sort, r.sk_id collate "C") from kafaa_fk_rows(k.skill_key) r), '[]'::jsonb),
      'target_level', coalesce(k.target_level, 2), 'demand', k.value, 'population', pop.n,
      'readiness', case when pop.n < mn.v or coalesce(a.ready, 0) < mn.v then null when pop.n = 0 then 0 else round(round(500.0 * coalesce(a.twice, 0) / pop.n) / 10, 1) end,
      'ready_n', case when pop.n < mn.v or coalesce(a.ready, 0) < mn.v then null else a.ready end,
      'suppressed', pop.n < mn.v or coalesce(a.ready, 0) < mn.v,
      'readiness_max', case when pop.n < mn.v or coalesce(a.ready, 0) < mn.v then (case when pop.n = 0 then null else round(100.0 * (mn.v - 1) / pop.n, 1) end) else null end,
      'assumption_en', k.assumption_en, 'assumption_ar', k.assumption_ar, 'sources', k.sources) as j
    from ks k cross join pop cross join mn left join agg a on a.key = k.skill_key
  ),
  fam as (
    select s.job_family_id as fid, count(*)::int as n from staff s
    where s.job_family_id is not null and s.job_family_id not in ('security', 'safeguards', 'cyber') group by s.job_family_id
  ),
  fcell as (
    select f.fid, k.skill_key, f.n, coalesce(sum(cr.c2), 0)::int as twice, count(*) filter (where cr.c2 > 0)::int as ready
    from fam f cross join ks k left join cr on cr.job_family_id = f.fid and cr.key = k.skill_key group by f.fid, k.skill_key, f.n
  ),
  frows as (
    select f.fid, jsonb_build_object('family_id', f.fid, 'n', case when f.n < mn.v then null else f.n end, 'suppressed', f.n < mn.v,
      'cells', coalesce((select jsonb_agg(jsonb_build_object('key', c.skill_key,
          'readiness', case when c.n < mn.v or c.ready < mn.v then null else round(round(500.0 * c.twice / c.n) / 10, 1) end,
          'suppressed', c.n < mn.v or c.ready < mn.v) order by c.skill_key collate "C") from fcell c where c.fid = f.fid), '[]'::jsonb)) as j
    from fam f cross join mn
  )
  select jsonb_build_object('scenario', p_scenario, 'population', (select n from pop),
    'rows', coalesce((select jsonb_agg(r.j order by r.skill_key collate "C") from rws r), '[]'::jsonb),
    'families', coalesce((select jsonb_agg(f.j order by f.fid collate "C") from frows f), '[]'::jsonb));
$$;

-- ───────────── RPC (read): HR analyst / CHCO office (workforce_analytics Agg) and auditors (R); everyone else is refused
create or replace function kafaa_future_radar(p_scenario text) returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not (kafaa_has_role('hr_analyst') or kafaa_has_role('hr_director') or kafaa_has_grant('workforce_analytics', array['R'])) then
    raise exception 'Kafa''a · the future-skills radar is for HR and auditors only' using errcode = '42501';
  end if;
  return kafaa_future_radar_compute(coalesce(p_scenario, ''));
end $$;

-- ───────────── RPC: admin edit of the keyspace (frameworks A). Audited, no ledger.
create or replace function kafaa_save_future_skill_map(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare a kafaa_audit_events; v_role text; v_key text := coalesce(p->>'key', ''); v_kind text := coalesce(p->>'key_kind', ''); v_sk text := coalesce(p->>'sk_id', '');
  v_rel text := coalesce(p->>'relation', ''); v_need integer; v_problems text[] := '{}'; v_known boolean; v_area text; v_id text;
  v_active boolean := coalesce((p->>'active')::boolean, true); v_primary boolean; v_first text;
begin
  v_role := case when kafaa_has_grant('frameworks', array['A']) then 'admin' end;
  if v_role is null then return kafaa_refuse('future.map', 'future_skill_map', null, 'forbidden', 'Only a platform admin may change the future-skill keyspace'); end if;
  v_need := case when coalesce(p->>'need_level', '') ~ '^\d+(\.0+)?$' then (p->>'need_level')::numeric::integer end;
  if v_key !~ '^[a-z0-9][a-z0-9-]{1,63}$' then v_problems := v_problems || 'key'::text; end if;
  if v_kind not in ('adv_skill', 'radar', 'gap_plan') then v_problems := v_problems || 'key_kind'::text; end if;
  if v_sk !~ '^sk-[a-z0-9-]+$' then v_problems := v_problems || 'sk_id'::text; end if;
  if v_rel not in ('transfers', 'adapts', 'new') then v_problems := v_problems || 'relation'::text; end if;
  if v_need is null or v_need < 1 or v_need > 4 then v_problems := v_problems || 'need_level'::text; end if;
  if cardinality(v_problems) > 0 then return kafaa_refuse('future.map', 'future_skill_map', null, 'invalid', 'Check: ' || array_to_string(v_problems, ', '), v_role); end if;
  v_known := case v_kind
    when 'adv_skill' then exists (select 1 from kafaa_adv_skills x where x.id = v_key)
    when 'radar' then exists (select 1 from kafaa_future_skills x where x.skill_key = v_key)
    else exists (select 1 from kafaa_skill_gap_plans x where x.skill_key = v_key) or exists (select 1 from kafaa_future_skills x where x.skill_key = v_key) end;
  select s.area into v_area from kafaa_skills s where s.id = v_sk;
  if not v_known or v_area is null then return kafaa_refuse('future.map', 'future_skill_map', null, 'not_found', case when not v_known then 'Unknown key' else 'Unknown catalogue skill' end, v_role); end if;
  if v_area = 'security' then return kafaa_refuse('future.map', 'future_skill_map', null, 'security_restricted', 'Security skills stay off the future-skill map (career-path level only)', v_role); end if;
  v_id := 'fsm:' || v_key || ':' || v_sk;
  if not v_active and not exists (select 1 from kafaa_fk_rows(v_key) r where r.id <> v_id) then
    return kafaa_refuse('future.map', 'future_skill_map', v_id, 'conflict', 'Every key must keep at least one active catalogue skill', v_role);
  end if;
  v_primary := coalesce((p->>'primary_sk')::boolean, false) and v_active;
  if v_primary then update kafaa_future_skill_map set primary_sk = false, updated_by = kafaa_me(), updated_at = now() where key = v_key and active and primary_sk and id <> v_id; end if;
  if exists (select 1 from kafaa_future_skill_map where id = v_id) then
    update kafaa_future_skill_map set key = v_key, key_kind = v_kind, sk_id = v_sk, relation = v_rel, need_level = v_need, primary_sk = v_primary, active = v_active,
      note_en = left(coalesce(p->>'note_en', ''), 300), note_ar = left(coalesce(p->>'note_ar', ''), 300), updated_by = kafaa_me(), updated_at = now() where id = v_id;
  else
    insert into kafaa_future_skill_map (id, key, key_kind, sk_id, relation, need_level, primary_sk, active, note_en, note_ar, sort, updated_by, updated_at)
    values (v_id, v_key, v_kind, v_sk, v_rel, v_need, v_primary, v_active, left(coalesce(p->>'note_en', ''), 300), left(coalesce(p->>'note_ar', ''), 300),
      900 + (select count(*)::int from kafaa_future_skill_map where key = v_key), kafaa_me(), now());
  end if;
  if not exists (select 1 from kafaa_fk_rows(v_key) r where r.primary_sk) then
    select r.id into v_first from kafaa_fk_rows(v_key) r limit 1;
    if v_first is not null then update kafaa_future_skill_map set primary_sk = true where id = v_first; end if;
  end if;
  perform kafaa_fk_sync(v_key);
  a := kafaa_audit('future.map', 'future_skill_map', v_id, 'ok', format('%s -> %s (%s, level %s%s)', v_key, v_sk, v_rel, v_need, case when v_active then '' else ', inactive' end), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Keyspace updated', a, null, jsonb_build_object('id', v_id));
end $$;

-- ───────────── RPC (G4, redefined): skills-gap plan actions now carry the catalogue skill (sk_id); skill_key stays the label.
-- A plan may name a radar key (resolved through the map) or a catalogue skill directly (sk-*, never a security skill).
create or replace function kafaa_save_skill_gap_plan(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare a kafaa_audit_events; v_role text; v_id text := nullif(p->>'id', ''); v_status text := coalesce(nullif(p->>'status', ''), 'draft');
  v_q text := coalesce(p->>'target_quarter', ''); v_year integer := extract(year from now() at time zone 'utc')::integer; v_problems text[] := '{}';
  v_key text := coalesce(p->>'skill_key', ''); v_sk text;
begin
  v_role := case when kafaa_has_role('hr_director') then 'hr_director' when kafaa_has_role('hr_analyst') then 'hr_analyst' end;
  if v_role is null then return kafaa_refuse('future.gap_plan', 'skill_gap_plans', v_id, 'forbidden', 'Only HR (analyst or CHCO office) may plan skills gaps'); end if;
  if v_key = '' then v_problems := v_problems || 'skill'::text; end if;
  if coalesce(p->>'action', '') not in ('train', 'reskill', 'hire', 'partner', 'research') then v_problems := v_problems || 'action'::text; end if;
  if length(trim(coalesce(p->>'owner_role', ''))) < 3 then v_problems := v_problems || 'owner'::text; end if;
  if v_q !~ '^\d{4}-Q[1-4]$' or left(v_q, 4)::integer < v_year or left(v_q, 4)::integer > v_year + 5 then v_problems := v_problems || 'quarter'::text; end if;
  if cardinality(v_problems) > 0 then return kafaa_refuse('future.gap_plan', 'skill_gap_plans', v_id, 'invalid', 'Check: ' || array_to_string(v_problems, ', '), v_role); end if;
  if v_key like 'sk-%' then
    select s.id into v_sk from kafaa_skills s where s.id = v_key and s.area <> 'security';
  elsif exists (select 1 from kafaa_future_skills f where f.skill_key = v_key) then
    select r.sk_id into v_sk from kafaa_fk_rows(v_key) r limit 1;
  end if;
  if v_sk is null then return kafaa_refuse('future.gap_plan', 'skill_gap_plans', null, 'not_found', 'Unknown skill', v_role); end if;
  if v_status not in ('draft', 'active', 'done') then return kafaa_refuse('future.gap_plan', 'skill_gap_plans', null, 'invalid', 'Unknown status', v_role); end if;
  if v_id is not null and exists (select 1 from kafaa_skill_gap_plans where id = v_id) then
    update kafaa_skill_gap_plans set skill_key = v_key, sk_id = v_sk, scenario = coalesce(p->>'scenario', ''), action = p->>'action', owner_role = trim(p->>'owner_role'),
      target_quarter = v_q, status = v_status, note = left(coalesce(p->>'note', ''), 500), updated_at = now() where id = v_id;
  else
    v_id := 'gp-' || left(replace(gen_random_uuid()::text, '-', ''), 16);
    insert into kafaa_skill_gap_plans (id, skill_key, sk_id, scenario, action, owner_role, target_quarter, status, note, created_by)
    values (v_id, v_key, v_sk, coalesce(p->>'scenario', ''), p->>'action', trim(p->>'owner_role'), v_q, v_status, left(coalesce(p->>'note', ''), 500), kafaa_me());
  end if;
  a := kafaa_audit('future.gap_plan', 'skill_gap_plans', v_id, 'ok', format('%s %s %s (%s; SIMULATED scenario)', v_key, p->>'action', v_q, v_status), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Plan saved', a, null, jsonb_build_object('id', v_id));
end $$;

revoke execute on function kafaa_fk_rows(text), kafaa_fk_sync(text), kafaa_future_radar_compute(text) from public, anon, authenticated;
revoke execute on function kafaa_future_radar(text), kafaa_save_future_skill_map(jsonb), kafaa_save_skill_gap_plan(jsonb) from public, anon;
grant execute on function kafaa_future_radar(text), kafaa_save_future_skill_map(jsonb), kafaa_save_skill_gap_plan(jsonb) to authenticated;
