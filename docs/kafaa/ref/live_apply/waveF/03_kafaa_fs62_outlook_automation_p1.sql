-- kafaa_fs62_outlook_automation_p1 (1/1) · from supabase/migrations/20261010262001_kafaa_fs62_outlook_automation.sql
-- Apply with apply_migration name "kafaa_fs62_outlook_automation_p1". Additive and idempotent; kafaa_* objects only.
-- [FS wave F · E2 · FS52 + FS53] AI and automation exposure in the skills outlook; external benchmark lines kept apart from measured
-- numbers (M07, /workforce/skills-outlook and /workforce).
--
-- FS52: the F35 outlook gains an optional assumption automation_adoption (whole %, 0-100). Each skill family's automation share comes from
-- the FS06 task layer (kafaa_jta_tasks.exposure / change_horizon, linked through kafaa_jta_task_skills to established skills of the family):
-- partly automatable tasks count 5/10, augmented 2/10, human-core 0, each phasing in over 3 years from its change horizon (now -> 2027).
-- Demand x (1 - adoption x share(year)). Mirrors src/modules/m07/outlook.ts (gatherAutomation, autoShare, automationProfile,
-- normalizeParams, project, computeOutlook, outlookFor, automationFor).
--   * kafaa_so_normalize, kafaa_so_project, kafaa_so_compute and kafaa_so_for are redefined from their newest bodies (the w5e4 migration;
--     no later file redefines them). kafaa_so_base is NOT redefined (its newest body, with the FS02 fs_area and FS10 conditions, is in
--     20261010229001_kafaa_fs2qa_integration.sql and stays as it is); the task exposure is a separate aggregate, kafaa_so_auto_base().
--   * With adoption 0 (or the key absent) every function returns exactly what it returned before: the key is left out of the normalised
--     parameters, no 'automation' field and no automation tornado bar are added. The stored outlooks are reproduced byte for byte.
--   * New RPC kafaa_outlook_automation(p_params) (same access as kafaa_compute_outlook: HR analysts, the HR director, auditors): the
--     automation profile for any assumption set, adoption 0 included, so the page can draw the automation bar in the tornado.
-- FS53: table kafaa_benchmark_values (seed only; read with workforce_analytics Agg/R). Every row copies one sourced FS01 figure; the
-- BEFORE INSERT OR UPDATE trigger kafaa_bv_guard refuses a row whose value, unit, scale, labels, as-of date or source URL differ from
-- kafaa_benchmarks, a drawn row that is not "primary" in the research packs, or a held row without a reason (kafaa_bv_problems =
-- benchmarkValueProblems in src/modules/m07/market.ts). No function combines these values with outlook numbers.
-- Seed: scripts/seed/ext/fs52-outlook-automation.mjs (load kafaa_benchmark_values with insert ... on conflict (id) do nothing).
-- PGlite: scripts/validate/fs62-outlook-automation.mjs (TS = SQL for 52 assumption sets, stored outlooks byte for byte, RBAC, guard).
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.

-- ───────────── FS53 table (generated DDL, the same as 20261008120100_kafaa_schema.sql)
-- M07 · External benchmark values for workforce dashboards: copies of sourced FS01 figures, market statistics never summed with measured numbers (FS53)
create table if not exists kafaa_benchmark_values (
  id text primary key,
  benchmark_id text not null,
  figure_key text not null,
  metric text not null,
  label_en text not null,
  label_ar text not null,
  value numeric not null,
  unit text not null check (unit in ('pct', 'count', 'score')),
  scale_max numeric,
  as_of date not null,
  source_url text not null,
  verification text not null check (verification in ('primary', 'secondary', 'unverified')),
  shown boolean not null default false,
  held_reason_en text not null default '',
  held_reason_ar text not null default '',
  pack_ref text not null,
  compare_to text check (compare_to in ('ai_task_share', 'demand_growth_2030', 'digital_holders')),
  dashboards text[] not null default '{}'::text[],
  note_en text not null default '',
  note_ar text not null default '',
  sort integer not null default 0
);
comment on table kafaa_benchmark_values is '[M07] External benchmark values for workforce dashboards: copies of sourced FS01 figures, market statistics never summed with measured numbers (FS53)';
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_benchmark_values_benchmark_id_fk') then alter table kafaa_benchmark_values add constraint kafaa_benchmark_values_benchmark_id_fk foreign key (benchmark_id) references kafaa_benchmarks(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_benchmark_values_benchmark_id_idx on kafaa_benchmark_values (benchmark_id);
alter table kafaa_benchmark_values enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_benchmark_values' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_benchmark_values for select to anon, authenticated using (false)'; end if;
end $$;
alter policy kafaa_read on kafaa_benchmark_values using ((SELECT kafaa_has_grant('workforce_analytics'::text, ARRAY['Agg'::text, 'R'::text, 'W'::text, 'A'::text])));
revoke all on kafaa_benchmark_values from anon, authenticated;
grant select on kafaa_benchmark_values to anon, authenticated;

-- ───────────── FS53 guard: benchmarkValueProblems (codes in order: id, figure, label, source, as_of, verification, held_reason, compare, dashboards)
create or replace function kafaa_bv_problems(j jsonb) returns text[] language plpgsql stable security definer set search_path = public as $$
declare
  p text[] := '{}'::text[]; b kafaa_benchmarks; f jsonb := null; v_shown boolean := (j->'shown') = 'true'::jsonb;
  blank_ws text := E' \t\n\r';
begin
  select * into b from kafaa_benchmarks where id = j->>'benchmark_id';
  if b.id is not null then
    select x into f from jsonb_array_elements(case when jsonb_typeof(b.figures) = 'array' then b.figures else '[]'::jsonb end) x where x->>'key' = j->>'figure_key' limit 1;
  end if;
  if coalesce(btrim(j->>'id', blank_ws), '') = '' or (j->>'id') !~ '^bv-[a-z0-9-]{3,60}$' then p := p || 'id'::text; end if;
  if f is null or coalesce(jsonb_typeof(j->'value'), '') <> 'number' or (f->>'value')::numeric <> (j->>'value')::numeric
     or (f->>'unit') is distinct from (j->>'unit') or (f->>'scale_max')::numeric is distinct from (j->>'scale_max')::numeric then p := p || 'figure'::text; end if;
  if f is null or coalesce(btrim(j->>'label_en', blank_ws), '') = '' or coalesce(btrim(j->>'label_ar', blank_ws), '') = ''
     or (f->>'label_en') is distinct from (j->>'label_en') or (f->>'label_ar') is distinct from (j->>'label_ar') then p := p || 'label'::text; end if;
  if b.id is null or coalesce(btrim(j->>'source_url', blank_ws), '') = '' or (j->>'source_url') !~* '^https://[^\s/$.?#][^\s]*$'
     or not ((j->>'source_url') = any(coalesce(b.urls, '{}'::text[]))) then p := p || 'source'::text; end if;
  if b.id is null or (j->>'as_of') is distinct from b.as_of::text then p := p || 'as_of'::text; end if;
  if coalesce(j->>'verification', '') not in ('primary', 'secondary', 'unverified') or (v_shown and (j->>'verification') <> 'primary')
     or coalesce(btrim(j->>'pack_ref', blank_ws), '') = '' then p := p || 'verification'::text; end if;
  if not v_shown and (coalesce(btrim(j->>'held_reason_en', blank_ws), '') = '' or coalesce(btrim(j->>'held_reason_ar', blank_ws), '') = '') then p := p || 'held_reason'::text; end if;
  if (j->>'compare_to') is not null and ((j->>'compare_to') not in ('ai_task_share', 'demand_growth_2030', 'digital_holders') or (j->>'unit') is distinct from 'pct') then p := p || 'compare'::text; end if;
  if coalesce(jsonb_typeof(j->'dashboards'), '') <> 'array'
     or exists (select 1 from jsonb_array_elements(case when jsonb_typeof(j->'dashboards') = 'array' then j->'dashboards' else '[]'::jsonb end) d where d #>> '{}' not in ('skills_outlook', 'overview') or jsonb_typeof(d) <> 'string')
     or (v_shown and jsonb_typeof(j->'dashboards') = 'array' and jsonb_array_length(j->'dashboards') = 0) then p := p || 'dashboards'::text; end if;
  return p;
end $$;

create or replace function kafaa_bv_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare v text[] := kafaa_bv_problems(to_jsonb(new));
begin
  if cardinality(v) > 0 then raise exception 'kafaa_fs53: % (%)', v[1], new.id using errcode = 'check_violation'; end if;
  return new;
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'kafaa_bv_guard_trg') then
    create trigger kafaa_bv_guard_trg before insert or update on kafaa_benchmark_values for each row execute function kafaa_bv_guard();
  end if;
end $$;

-- ───────────── FS52 internal helpers (mirror of outlook.ts)
-- gatherAutomation(): task exposure per outlook family (integers only)
create or replace function kafaa_so_auto_base() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_fams jsonb := '[]'::jsonb; a text; h text; v_n jsonb; v_t integer; x jsonb;
begin
  foreach a in array kafaa_so_families() loop
    select count(*)::integer into v_t from kafaa_jta_tasks t
      where t.status = 'active' and t.restricted is distinct from true and t.exposure in ('automate_partly', 'augment', 'human_core') and t.change_horizon in ('now', '2030', '2035')
        and exists (select 1 from kafaa_jta_task_skills l join kafaa_skills sk on sk.id = l.skill_id where l.task_id = t.id and l.active is distinct from false and sk.fs_area is null and sk.area = a);
    v_n := '{}'::jsonb;
    foreach h in array array['now', '2030', '2035'] loop
      select jsonb_build_object('automate_partly', count(*) filter (where t.exposure = 'automate_partly'), 'augment', count(*) filter (where t.exposure = 'augment'),
                                'human_core', count(*) filter (where t.exposure = 'human_core')) into x
        from kafaa_jta_tasks t
        where t.status = 'active' and t.restricted is distinct from true and t.exposure in ('automate_partly', 'augment', 'human_core') and t.change_horizon = h
          and exists (select 1 from kafaa_jta_task_skills l join kafaa_skills sk on sk.id = l.skill_id where l.task_id = t.id and l.active is distinct from false and sk.fs_area is null and sk.area = a);
      v_n := v_n || jsonb_build_object(h, x);
    end loop;
    v_fams := v_fams || jsonb_build_array(jsonb_build_object('key', a, 'tasks', v_t, 'n', v_n));
  end loop;
  select jsonb_build_object('method', 'fs52-v1', 'families', v_fams,
    'rated', count(*) filter (where t.exposure in ('automate_partly', 'augment', 'human_core') and t.change_horizon in ('now', '2030', '2035')),
    'automate_partly', count(*) filter (where t.exposure = 'automate_partly' and t.change_horizon in ('now', '2030', '2035')),
    'augment', count(*) filter (where t.exposure = 'augment' and t.change_horizon in ('now', '2030', '2035')),
    'human_core', count(*) filter (where t.exposure = 'human_core' and t.change_horizon in ('now', '2030', '2035')),
    'unrated', count(*) filter (where not (coalesce(t.exposure, '') in ('automate_partly', 'augment', 'human_core') and coalesce(t.change_horizon, '') in ('now', '2030', '2035'))))
    into x from kafaa_jta_tasks t where t.status = 'active' and t.restricted is distinct from true;
  return x;
end $$;

-- autoShare(): share (0-1) of a family's demand that full adoption takes out in year y
create or replace function kafaa_so_auto_share(f jsonb, y integer) returns double precision language plpgsql immutable set search_path = public as $$
declare acc double precision := 0; h text; hy integer; ramp double precision; v_t integer;
begin
  if f is null or jsonb_typeof(f) <> 'object' then return 0; end if;
  v_t := coalesce((f->>'tasks')::integer, 0);
  if v_t <= 0 then return 0; end if;
  foreach h in array array['now', '2030', '2035'] loop
    hy := case h when 'now' then 2027 when '2030' then 2030 else 2035 end;
    ramp := case when y < hy then 0 else least(1::double precision, (y - hy + 1)::double precision / 3) end;
    acc := acc + (5 * coalesce((f->'n'->h->>'automate_partly')::integer, 0) + 2 * coalesce((f->'n'->h->>'augment')::integer, 0)) * ramp;
  end loop;
  return acc / (10 * v_t);
end $$;

-- automationProfile(): the profile beside the outlook (b must carry 'auto' from kafaa_so_auto_base)
create or replace function kafaa_so_auto_profile(b jsonb, p jsonb) returns jsonb language plpgsql immutable set search_path = public as $$
declare
  v_auto jsonb := coalesce(b->'auto', jsonb_build_object('method', 'fs52-v1', 'families', '[]'::jsonb, 'rated', 0, 'automate_partly', 0, 'augment', 0, 'human_core', 0, 'unrated', 0));
  bb jsonb := b || jsonb_build_object('auto', coalesce(b->'auto', jsonb_build_object('method', 'fs52-v1', 'families', '[]'::jsonb, 'rated', 0, 'automate_partly', 0, 'augment', 0, 'human_core', 0, 'unrated', 0)));
  v_h integer := (p->>'horizon')::integer;
  p0 jsonb; pn jsonb; ph jsonb; f jsonb; af jsonb; v_fams jsonb := '[]'::jsonb; d0 integer; dn integer; dh integer; v_rated integer; v_ad integer;
begin
  p0 := kafaa_so_project(bb, p || jsonb_build_object('automation_adoption', 0));
  pn := kafaa_so_project(bb, p);
  ph := kafaa_so_project(bb, p || jsonb_build_object('automation_adoption', 60));
  for f in select * from jsonb_array_elements(p0->'families') loop
    if (f->>'suppressed')::boolean then
      v_fams := v_fams || jsonb_build_array(jsonb_build_object('key', f->>'key', 'suppressed', true, 'tasks', null, 'automate_partly', null, 'augment', null, 'human_core', null,
        'share_2030', null, 'share_h', null, 'cut_now', null, 'cut_hi', null));
      continue;
    end if;
    select x into af from jsonb_array_elements(coalesce(v_auto->'families', '[]'::jsonb)) x where x->>'key' = f->>'key' limit 1;
    select coalesce((select (c->>'demand')::integer from jsonb_array_elements(f->'years') c where (c->>'year')::integer = v_h), 0) into d0;
    select coalesce((select (c->>'demand')::integer from jsonb_array_elements(z->'years') c where (c->>'year')::integer = v_h), 0) into dn
      from jsonb_array_elements(pn->'families') z where z->>'key' = f->>'key';
    select coalesce((select (c->>'demand')::integer from jsonb_array_elements(z->'years') c where (c->>'year')::integer = v_h), 0) into dh
      from jsonb_array_elements(ph->'families') z where z->>'key' = f->>'key';
    v_fams := v_fams || jsonb_build_array(jsonb_build_object('key', f->>'key', 'suppressed', false,
      'tasks', coalesce((af->>'tasks')::integer, 0),
      'automate_partly', coalesce((af->'n'->'now'->>'automate_partly')::integer + (af->'n'->'2030'->>'automate_partly')::integer + (af->'n'->'2035'->>'automate_partly')::integer, 0),
      'augment', coalesce((af->'n'->'now'->>'augment')::integer + (af->'n'->'2030'->>'augment')::integer + (af->'n'->'2035'->>'augment')::integer, 0),
      'human_core', coalesce((af->'n'->'now'->>'human_core')::integer + (af->'n'->'2030'->>'human_core')::integer + (af->'n'->'2035'->>'human_core')::integer, 0),
      'share_2030', kafaa_so_round(kafaa_so_auto_share(af, 2030) * 1000)::double precision / 10,
      'share_h', kafaa_so_round(kafaa_so_auto_share(af, v_h) * 1000)::double precision / 10,
      'cut_now', d0 - coalesce(dn, 0), 'cut_hi', d0 - coalesce(dh, 0)));
  end loop;
  v_rated := coalesce((v_auto->>'rated')::integer, 0);
  v_ad := case when jsonb_typeof(p->'automation_adoption') = 'number' and (p->>'automation_adoption')::numeric > 0 then (p->>'automation_adoption')::integer else 0 end;
  return jsonb_build_object('simulated', true, 'method', 'fs52-v1', 'adoption', v_ad, 'horizon', v_h,
    'rated', v_rated, 'unrated', coalesce((v_auto->>'unrated')::integer, 0), 'automate_partly', coalesce((v_auto->>'automate_partly')::integer, 0),
    'augment', coalesce((v_auto->>'augment')::integer, 0), 'human_core', coalesce((v_auto->>'human_core')::integer, 0),
    'ai_task_share', case when v_rated > 0 then kafaa_so_round((1000 * (coalesce((v_auto->>'augment')::integer, 0) + coalesce((v_auto->>'automate_partly')::integer, 0)))::double precision / v_rated)::double precision / 10 else null end,
    'families', v_fams,
    'bar', jsonb_build_object('param', 'automation_adoption', 'lo', 0, 'hi', 60, 'low', (p0->'totals'->>'cumulative')::integer, 'high', (ph->'totals'->>'cumulative')::integer,
      'swing', abs((ph->'totals'->>'cumulative')::integer - (p0->'totals'->>'cumulative')::integer)));
end $$;

-- ───────────── Redefined F35 functions (newest bodies from 20261009154001_kafaa_w5e4_skills_outlook.sql; changes marked FS52)
create or replace function kafaa_so_normalize(p_raw jsonb, p_families text[]) returns jsonb language plpgsql immutable set search_path = public as $$
declare
  r jsonb := case when jsonb_typeof(p_raw) = 'object' then p_raw else '{}'::jsonb end;
  spec jsonb := '[["horizon",2035,2031,2036,true],["attrition_pct",4,0,15,false],["klra_weight",1,0,1.5,false],["pipeline_factor",1,0,2,false],
                  ["annual_intake",20,0,80,true],["reskill_rate",15,0,40,false],["adv_factor",1,0.5,1.5,false],["adv_start",2030,2027,2036,true],["ossa_end",2030,2028,2032,true]]';
  s jsonb; k text; v jsonb; out jsonb := '{}'::jsonb; ov jsonb; e record; ovo jsonb := '{}'::jsonb;
begin
  for s in select * from jsonb_array_elements(spec) loop
    k := s->>0; v := r->k;
    if v is null or jsonb_typeof(v) = 'null' then v := s->1; end if;
    if jsonb_typeof(v) <> 'number' then return null; end if;
    if v::numeric < (s->>2)::numeric or v::numeric > (s->>3)::numeric then return null; end if;
    if (s->>4)::boolean and v::numeric <> floor(v::numeric) then return null; end if;
    out := out || jsonb_build_object(k, v);
  end loop;
  v := r->'scenario_id';
  if v is null or jsonb_typeof(v) = 'null' then out := out || jsonb_build_object('scenario_id', null);
  elsif jsonb_typeof(v) <> 'string' or char_length(v #>> '{}') > 80 then return null;
  else out := out || jsonb_build_object('scenario_id', nullif(v #>> '{}', '')); end if;
  ov := r->'reskill_overrides';
  if ov is not null and jsonb_typeof(ov) <> 'null' then
    if jsonb_typeof(ov) <> 'object' then return null; end if;
    for e in select * from jsonb_each(ov) loop
      if not (e.key = any(p_families)) or jsonb_typeof(e.value) <> 'number' or e.value::numeric < 0 or e.value::numeric > 40 then return null; end if;
      ovo := ovo || jsonb_build_object(e.key, e.value);
    end loop;
  end if;
  out := out || jsonb_build_object('reskill_overrides', ovo);
  -- FS52: automation_adoption, whole percentages 0-100; 0 is left out so an outlook without automation keeps its exact F35 parameters
  v := r->'automation_adoption';
  if v is not null and jsonb_typeof(v) <> 'null' then
    if jsonb_typeof(v) <> 'number' or v::numeric < 0 or v::numeric > 100 or v::numeric <> floor(v::numeric) then return null; end if;
    if v::numeric > 0 then out := out || jsonb_build_object('automation_adoption', v); end if;
  end if;
  return out;
end $$;

create or replace function kafaa_so_project(b jsonb, p jsonb) returns jsonb language plpgsql immutable set search_path = public as $$
declare
  v_base integer := 2026; v_h integer := (p->>'horizon')::integer; v_ossa integer := (p->>'ossa_end')::integer; v_adv_start integer := (p->>'adv_start')::integer;
  v_scale double precision; v_int double precision; v_a double precision := (p->>'attrition_pct')::double precision / 100;
  v_kw double precision := (p->>'klra_weight')::double precision; v_pf double precision := (p->>'pipeline_factor')::double precision;
  v_ai double precision := (p->>'annual_intake')::double precision; sc jsonb := b->'scenario';
  f jsonb; v_fams jsonb := '[]'::jsonb; v_by integer[]; n integer; y integer; i integer;
  r double precision; s0 double precision; d0 double precision; adv double precision; s double precision; pool double precision;
  c0 integer; ho integer; ho_h integer; attr double precision; kl double precision; inc double precision; rs double precision; ramp double precision;
  d double precision; last_d double precision; g_h double precision; c_attr double precision; c_klra double precision; c_inc double precision; c_rs double precision;
  dem integer; sup integer; gap integer; cells jsonb; v_first integer; v_peak integer; v_hgap integer; drivers jsonb;
  v_vis integer := 0; v_sup integer := 0; v_short integer := 0; v_shortfall integer := 0; v_first_all integer := null;
  -- FS52: adoption (0-1) and the family's task exposure; pre = demand before the automation factor
  v_ad double precision := case when jsonb_typeof(p->'automation_adoption') = 'number' and (p->>'automation_adoption')::double precision > 0 then (p->>'automation_adoption')::double precision else 0 end / 100;
  v_af jsonb; pre double precision; last_pre double precision;
begin
  v_scale := case when (b->>'org')::integer > 0 and (b->>'staff')::integer > 0 then (b->>'org')::double precision / (b->>'staff')::double precision else 1 end;
  v_int := kafaa_so_adjust(case when (b->>'adv_n')::integer > 0 then (b->>'adv_sum')::double precision / (b->>'adv_n')::double precision else 0 end, (p->>'adv_factor')::double precision) / 100;
  n := v_h - v_base + 1;
  v_by := array_fill(0, array[n]);
  for f in select * from jsonb_array_elements(b->'families') loop
    if (f->>'n_s')::integer < 10 or (f->>'n_d')::integer < 10 then
      v_sup := v_sup + 1;
      v_fams := v_fams || jsonb_build_array(jsonb_build_object('key', f->>'key', 'suppressed', true, 's0', null, 'd0', null, 'basis_n', null, 'years', '[]'::jsonb,
        'horizon_gap', null, 'peak_gap', null, 'first_gap_year', null, 'drivers', '[]'::jsonb));
      continue;
    end if;
    v_vis := v_vis + 1;
    c0 := coalesce((f->'cover'->>v_base::text)::integer, 0);
    r := coalesce((p->'reskill_overrides'->>(f->>'key'))::double precision, (p->>'reskill_rate')::double precision) / 100;
    s0 := (f->>'n_s')::integer * v_scale; d0 := (f->>'n_d')::integer * v_scale;
    adv := case when (f->>'adv_t')::integer > 0 then (f->>'adv_m')::integer::double precision / (f->>'adv_t')::integer else 0 end;
    s := s0; pool := (f->>'pool')::integer * v_scale;
    c_attr := 0; c_klra := 0; c_inc := 0; c_rs := 0; cells := '[]'::jsonb; last_d := 0; last_pre := 0; v_first := null; v_peak := null;
    v_af := null;
    if v_ad > 0 then select x into v_af from jsonb_array_elements(coalesce(b->'auto'->'families', '[]'::jsonb)) x where x->>'key' = f->>'key' limit 1; end if;
    for i in 1 .. n loop
      y := v_base + i - 1;
      if y > v_base then
        attr := s * v_a; s := s - attr;
        kl := coalesce((f->'klra60'->>y::text)::integer, 0)::double precision / 60 * v_scale * v_kw; s := s - kl;
        inc := coalesce((f->'cohort'->>y::text)::integer, 0) * v_pf + (case when (f->>'lo')::boolean and y >= v_base + 2 then v_ai else 0 end); s := s + inc;
        rs := pool * r; pool := pool - rs; s := s + rs;
        if s < 0 then s := 0; end if;
        c_attr := c_attr + attr; c_klra := c_klra + kl; c_inc := c_inc + inc; c_rs := c_rs + rs;
      end if;
      ramp := case when y < v_adv_start then 0 else least(1, (y - v_adv_start + 1)::double precision / 5) end;
      ho := c0 - (case when y > v_ossa then 0 else coalesce((f->'cover'->>y::text)::integer, 0) end);
      pre := (d0 + ho) * kafaa_so_growth(sc, y) * (1 + adv * v_int * ramp);
      if v_ad > 0 then d := pre * (1 - v_ad * kafaa_so_auto_share(v_af, y)); else d := pre; end if;
      last_pre := pre;
      last_d := d;
      dem := kafaa_so_round(d); sup := kafaa_so_round(s); gap := dem - sup;
      cells := cells || jsonb_build_array(jsonb_build_object('year', y, 'demand', dem, 'supply', sup, 'gap', gap));
      if gap > 0 then v_by[i] := v_by[i] + gap; if v_first is null then v_first := y; end if; end if;
      v_peak := greatest(coalesce(v_peak, gap), gap);
      v_hgap := gap;
    end loop;
    ho_h := c0 - (case when v_h > v_ossa then 0 else coalesce((f->'cover'->>v_h::text)::integer, 0) end);
    g_h := kafaa_so_growth(sc, v_h);
    -- driver magnitudes stay doubles (never read back from jsonb)
    select coalesce(jsonb_agg(jsonb_build_object('code', z.code, 'band', case when z.m >= s0 * 0.25 then 'high' when z.m >= s0 * 0.1 then 'medium' else 'low' end,
             'effect', case when z.code in ('intake', 'reskill', 'automation') then 'narrows' else 'widens' end) order by z.m desc, z.o), '[]'::jsonb)
      into drivers
      from (select x.code, x.m, x.o from (values
              ('attrition', c_attr, 1), ('klra', c_klra, 2), ('handover', ho_h::double precision, 3), ('growth', (d0 + ho_h) * (g_h - 1), 4),
              ('advance', last_pre - (d0 + ho_h) * g_h, 5), ('intake', c_inc, 6), ('reskill', c_rs, 7), ('automation', last_pre - last_d, 8)) as x(code, m, o) where x.m > 0) z;
    if v_hgap > 0 then v_short := v_short + 1; v_shortfall := v_shortfall + v_hgap; end if;
    if v_first is not null then v_first_all := least(coalesce(v_first_all, v_first), v_first); end if;
    v_fams := v_fams || jsonb_build_array(jsonb_build_object('key', f->>'key', 'suppressed', false, 's0', kafaa_so_round(s0), 'd0', kafaa_so_round(d0), 'basis_n', (f->>'n_s')::integer,
      'years', cells, 'horizon_gap', v_hgap, 'peak_gap', v_peak, 'first_gap_year', v_first, 'drivers', drivers));
  end loop;
  return jsonb_build_object(
    'years', (select jsonb_agg(v_base + k - 1 order by k) from generate_series(1, n) k),
    'families', v_fams,
    'totals', jsonb_build_object('visible', v_vis, 'suppressed', v_sup, 'families_short', v_short, 'shortfall', v_shortfall, 'first_gap_year', v_first_all,
      'shortfall_by_year', to_jsonb(v_by), 'cumulative', (select coalesce(sum(x), 0)::integer from unnest(v_by) x)));
end $$;

create or replace function kafaa_so_compute(b jsonb, p jsonb) returns jsonb language plpgsql immutable set search_path = public as $$
declare
  pr jsonb := kafaa_so_project(b, p);
  spec jsonb := '[["attrition_pct",2,8],["klra_weight",0.5,1.5],["pipeline_factor",0.5,1.5],["annual_intake",10,40],["reskill_rate",5,30],["adv_factor",0.5,1.5],["ossa_end",2028,2032]]';
  t jsonb; i integer; lo integer; hi integer; bars jsonb := '[]'::jsonb;
  v_auto boolean := jsonb_typeof(p->'automation_adoption') = 'number' and (p->>'automation_adoption')::double precision > 0; prof jsonb := null; -- FS52
begin
  for i in 0 .. jsonb_array_length(spec) - 1 loop
    t := spec->i;
    lo := (kafaa_so_project(b, p || jsonb_build_object(t->>0, t->1))->'totals'->>'cumulative')::integer;
    hi := (kafaa_so_project(b, p || jsonb_build_object(t->>0, t->2))->'totals'->>'cumulative')::integer;
    bars := bars || jsonb_build_array(jsonb_build_object('param', t->>0, 'lo', t->1, 'hi', t->2, 'low', lo, 'high', hi, 'swing', abs(hi - lo), 'o', i));
  end loop;
  -- FS52: with automation in use, the automation bar joins the tornado (ties after the F35 assumptions) and the profile joins the result
  if v_auto then
    prof := kafaa_so_auto_profile(b, p);
    bars := bars || jsonb_build_array((prof->'bar') || jsonb_build_object('o', jsonb_array_length(spec)));
  end if;
  select jsonb_agg(x - 'o' order by (x->>'swing')::integer desc, (x->>'o')::integer) into bars from jsonb_array_elements(bars) x;
  return case when v_auto then jsonb_build_object('automation', prof) else '{}'::jsonb end || jsonb_build_object('simulated', true, 'method', 'f35-v1', 'base_year', 2026, 'horizon', (p->>'horizon')::integer, 'years', pr->'years', 'params', p,
    'scenario', case when b->'scenario' is null or jsonb_typeof(b->'scenario') = 'null' then null
                     else jsonb_build_object('id', b->'scenario'->'id', 'name', b->'scenario'->'name', 'kind', b->'scenario'->'kind') end,
    'adv_index', kafaa_so_round(case when (b->>'adv_n')::integer > 0 then (b->>'adv_sum')::double precision / (b->>'adv_n')::double precision else 0 end * 10)::double precision / 10,
    'org_headcount', (b->>'org')::integer, 'staff_sample', (b->>'staff')::integer, 'min_group', 10,
    'families', pr->'families', 'totals', pr->'totals', 'tornado', bars);
end $$;

create or replace function kafaa_so_for(p_raw jsonb) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare p jsonb := kafaa_so_normalize(coalesce(p_raw, '{}'::jsonb), kafaa_so_families()); b jsonb;
begin
  if p is null then return jsonb_build_object('code', 'invalid'); end if;
  if p->>'scenario_id' is not null and not exists (select 1 from kafaa_scenarios where id = p->>'scenario_id') then return jsonb_build_object('code', 'not_found'); end if;
  b := kafaa_so_base(p->>'scenario_id');
  if jsonb_typeof(p->'automation_adoption') = 'number' and (p->>'automation_adoption')::numeric > 0 then b := b || jsonb_build_object('auto', kafaa_so_auto_base()); end if; -- FS52
  return jsonb_build_object('code', 'ok', 'result', kafaa_so_compute(b, p));
end $$;

-- automationFor(): normalised params + scenario check + the profile (adoption 0 included); {code, result}
create or replace function kafaa_so_auto_for(p_raw jsonb) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare p jsonb := kafaa_so_normalize(coalesce(p_raw, '{}'::jsonb), kafaa_so_families()); b jsonb;
begin
  if p is null then return jsonb_build_object('code', 'invalid'); end if;
  if p->>'scenario_id' is not null and not exists (select 1 from kafaa_scenarios where id = p->>'scenario_id') then return jsonb_build_object('code', 'not_found'); end if;
  b := kafaa_so_base(p->>'scenario_id') || jsonb_build_object('auto', kafaa_so_auto_base());
  return jsonb_build_object('code', 'ok', 'result', kafaa_so_auto_profile(b, p));
end $$;

-- ───────────── RPC: the automation profile (HR and auditors, exactly the kafaa_compute_outlook guard). Read-only; refusals audited.
create or replace function kafaa_outlook_automation(p_params jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; r jsonb;
begin
  if me is null then return kafaa_refuse('outlook.automation', 'skill_outlooks', null, 'not_signed_in', 'Sign in to see the skills outlook'); end if;
  if kafaa_has_grant('workforce_analytics', array['Agg', 'R']) then
    select x into v_role from unnest(array['hr_director', 'hr_analyst', 'auditor']) with ordinality as u(x, o) where kafaa_has_role(x) order by o limit 1;
  end if;
  if v_role is null then return kafaa_refuse('outlook.automation', 'skill_outlooks', null, 'forbidden', 'The skills outlook is for HR and auditors; line managers see released outlooks'); end if;
  r := kafaa_so_auto_for(p_params);
  if r->>'code' = 'invalid' then return kafaa_refuse('outlook.automation', 'skill_outlooks', null, 'invalid', 'An assumption is outside its range', v_role); end if;
  if r->>'code' = 'not_found' then return kafaa_refuse('outlook.automation', 'skill_outlooks', p_params->>'scenario_id', 'not_found', 'Staffing scenario not found', v_role); end if;
  return jsonb_build_object('ok', true, 'code', 'ok', 'message', 'Automation exposure (SIMULATED)', 'audit_seq', null, 'ledger_seq', null, 'data', r->'result');
end $$;

-- ───────────── Grants: internal helpers for no API role; the RPC for signed-in users only (it checks roles itself)
revoke execute on function kafaa_bv_problems(jsonb), kafaa_bv_guard(), kafaa_so_auto_base(), kafaa_so_auto_share(jsonb, integer), kafaa_so_auto_profile(jsonb, jsonb),
  kafaa_so_auto_for(jsonb), kafaa_so_normalize(jsonb, text[]), kafaa_so_project(jsonb, jsonb), kafaa_so_compute(jsonb, jsonb), kafaa_so_for(jsonb) from public, anon, authenticated;
revoke execute on function kafaa_outlook_automation(jsonb) from public, anon;
grant execute on function kafaa_outlook_automation(jsonb) to authenticated;
