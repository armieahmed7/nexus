-- kafaa_fs61_strategy_forecasts_p1 (1/2) · from supabase/migrations/20261010261001_kafaa_fs61_strategy_forecasts.sql
-- Apply with apply_migration name "kafaa_fs61_strategy_forecasts_p1". Additive and idempotent; kafaa_* objects only.
-- [FS wave F · E1 · FS50 + FS51] Workforce Strategy and Disclosure (M35): the Critical Future-Skills Register and three-scenario skill
-- forecasting bands (SIMULATED).
-- FS50: kafaa_critical_skills (one row per catalogue skill: owner function + role card, target level, people-equivalent targets by year,
--   KPIs, build/buy/borrow/bot decision with its rationale EN/AR, decision history, FS04 gap plans of the same skill) and
--   kafaa_critical_skill_reviews (quarterly reviews by the HR director with the computed progress snapshot). Progress is computed, never
--   stored: counted F01 states (verified, evidenced, validated; never self-claims) of active staff at the target level or above, scaled
--   to the SAMPLE organisation headcount (F35 scale), against the target for the year; under 10 measured people suppressed
--   (kafaa_crs_progress = progressOf in src/modules/m35/critical.ts; kafaa_crs_board_core = criticalBoard).
-- FS51: kafaa_skill_forecasts (annual cycles of saved versions, MATCH pattern: params, aggregate suppressed results, method basis,
--   release). The model reuses the F35 helpers read-only (kafaa_so_round, kafaa_so_adjust, kafaa_so_departures, kafaa_so_growth,
--   kafaa_so_num; never redefined here) and mirrors src/modules/m35/forecast.ts exactly (kafaa_sf_*): per skill and level mix, demand from
--   the FS05 role profiles (now / 2030 / 2035, effective profile year by pace), the M07 staffing scenario and the ADVANCE uplift; supply
--   from counted F01 states minus attrition and F20 KLRA departures plus F22 cohorts, the DNT intake and demand-led development; three
--   scenarios (baseline, ADVANCE, accelerated); skills under 10 holders suppressed; a generations view to the end of the plant licences.
-- RPCs (TS + local + SQL SECURITY DEFINER + supabase map; authenticated only; the kafaa_crs_* / kafaa_sf_* helpers executable by nobody):
--   kafaa_critical_skill_board(), kafaa_save_critical_skill(p) (W drafts; A adopts, edits adopted rows or retires; ledger on adoption and
--   retirement), kafaa_review_critical_skill(p) (A; one per row and quarter; audit + ledger always), kafaa_compute_skill_forecast(p_params),
--   kafaa_save_skill_forecast(p) (W), kafaa_release_skill_forecast(p_id, p_summary_en, p_summary_ar) (A; supersedes the version released
--   earlier in the cycle; ledger). Policy resource: workforce_strategy (hr_analyst Agg/W, hr_director Agg/W/A, training_manager Agg,
--   admin R, auditor R); never public, no staff grant.
-- PGlite parity and checks: scripts/validate/fs61-strategy-forecasts.mjs. Tests: tests/unit/fs61-*.
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects; never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file; RLS in the per-statement (perf) form.

-- ───────────── Tables (generated DDL, additive)
-- M35 · Critical future skill on the strategic register: owner (function and role card), target level, people-equivalent targets by year, KPIs, build/buy/borrow/bot decision with rationale, FS04 gap plans; progress is computed, never stored (FS50)
create table if not exists kafaa_critical_skills (
  id text primary key,
  skill_id text not null unique,
  owner_function text not null,
  owner_person_id text not null,
  target_level integer not null,
  targets jsonb not null default '[]'::jsonb,
  kpis jsonb not null default '[]'::jsonb,
  decision text not null check (decision in ('build', 'buy', 'borrow', 'bot')),
  rationale_en text not null,
  rationale_ar text not null,
  decision_history jsonb not null default '[]'::jsonb,
  gap_plan_ids text[] not null default '{}'::text[],
  status text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  adopted_on date,
  version integer not null default 1,
  sort integer not null default 0,
  benchmark_ids text[] not null default '{}'::text[],
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_by text,
  updated_at timestamptz not null default now()
);
comment on table kafaa_critical_skills is '[M35] Critical future skill on the strategic register: owner (function and role card), target level, people-equivalent targets by year, KPIs, build/buy/borrow/bot decision with rationale, FS04 gap plans; progress is computed, never stored (FS50)';

-- M35 · Quarterly review of a critical future skill by the HR director: rating, the computed progress snapshot, notes EN/AR and any decision change; audited and ledgered (FS50)
create table if not exists kafaa_critical_skill_reviews (
  id text primary key,
  critical_skill_id text not null,
  quarter text not null,
  rating text not null check (rating in ('met', 'on_track', 'at_risk', 'off_track')),
  progress jsonb not null default '{}'::jsonb,
  note_en text not null,
  note_ar text not null,
  decision_before text not null,
  decision_after text not null,
  reviewed_by text not null,
  reviewed_at timestamptz not null default now()
);
comment on table kafaa_critical_skill_reviews is '[M35] Quarterly review of a critical future skill by the HR director: rating, the computed progress snapshot, notes EN/AR and any decision change; audited and ledgered (FS50)';

-- M35 · Saved three-scenario skill forecast (baseline, ADVANCE, accelerated; SIMULATED): annual cycle and version, assumptions, aggregate suppressed results, method basis, release (FS51)
create table if not exists kafaa_skill_forecasts (
  id text primary key,
  cycle integer not null,
  version integer not null,
  name text not null,
  scenario text not null default 'baseline' check (scenario in ('baseline', 'advance', 'accelerated')),
  params jsonb not null default '{}'::jsonb,
  results jsonb not null default '{}'::jsonb,
  basis jsonb not null default '{}'::jsonb,
  method text not null,
  status text not null default 'draft' check (status in ('draft', 'released', 'superseded')),
  summary_en text not null default '',
  summary_ar text not null default '',
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  released_by text,
  released_at timestamptz,
  superseded_by text,
  simulated boolean not null default true
);
comment on table kafaa_skill_forecasts is '[M35] Saved three-scenario skill forecast (baseline, ADVANCE, accelerated; SIMULATED): annual cycle and version, assumptions, aggregate suppressed results, method basis, release (FS51)';

do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_critical_skills_skill_id_fk') then alter table kafaa_critical_skills add constraint kafaa_critical_skills_skill_id_fk foreign key (skill_id) references kafaa_skills(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_critical_skills_owner_person_id_fk') then alter table kafaa_critical_skills add constraint kafaa_critical_skills_owner_person_id_fk foreign key (owner_person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_critical_skill_reviews_critical_skill_id_fk') then alter table kafaa_critical_skill_reviews add constraint kafaa_critical_skill_reviews_critical_skill_id_fk foreign key (critical_skill_id) references kafaa_critical_skills(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_critical_skills_owner_person_id_idx on kafaa_critical_skills (owner_person_id);
create index if not exists kafaa_critical_skills_status_idx on kafaa_critical_skills (status);
create index if not exists kafaa_critical_skill_reviews_critical_skill_id_idx on kafaa_critical_skill_reviews (critical_skill_id);
create index if not exists kafaa_skill_forecasts_cycle_idx on kafaa_skill_forecasts (cycle);
create index if not exists kafaa_skill_forecasts_status_idx on kafaa_skill_forecasts (status);
-- one review per register row and quarter; one version number per cycle; every forecast name marked SIMULATED
create unique index if not exists kafaa_critical_skill_reviews_quarter_uq on kafaa_critical_skill_reviews (critical_skill_id, quarter);
create unique index if not exists kafaa_skill_forecasts_cycle_version_uq on kafaa_skill_forecasts (cycle, version);
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_forecasts_simulated_ck') then
  alter table kafaa_skill_forecasts add constraint kafaa_skill_forecasts_simulated_ck check (simulated and name ~* 'simulated'); end if; end $$;

-- ───────────── RLS (per-statement form): workforce_strategy Agg/R/W/A reads (aggregate rows, no person-level data); writes only via RPCs
alter table kafaa_critical_skills enable row level security;
alter table kafaa_critical_skill_reviews enable row level security;
alter table kafaa_skill_forecasts enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_critical_skills' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_critical_skills for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_critical_skill_reviews' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_critical_skill_reviews for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_skill_forecasts' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_skill_forecasts for select to anon, authenticated using (false)'; end if;
end $$;
alter policy kafaa_read on kafaa_critical_skills using ((SELECT kafaa_has_grant('workforce_strategy'::text, ARRAY['Agg'::text, 'R'::text, 'W'::text, 'A'::text])));
alter policy kafaa_read on kafaa_critical_skill_reviews using ((SELECT kafaa_has_grant('workforce_strategy'::text, ARRAY['Agg'::text, 'R'::text, 'W'::text, 'A'::text])));
alter policy kafaa_read on kafaa_skill_forecasts using ((SELECT kafaa_has_grant('workforce_strategy'::text, ARRAY['Agg'::text, 'R'::text, 'W'::text, 'A'::text])));
revoke all on kafaa_critical_skills, kafaa_critical_skill_reviews, kafaa_skill_forecasts from anon, authenticated;
grant select on kafaa_critical_skills, kafaa_critical_skill_reviews, kafaa_skill_forecasts to anon, authenticated;

-- ═════════════ FS51 model (mirror of src/modules/m35/forecast.ts). Internal: not executable by API roles.
-- normalizeForecastParams(): missing keys take the defaults (shared ones = the F35 baseline); null when anything is out of range
create or replace function kafaa_sf_normalize(p_raw jsonb) returns jsonb language plpgsql immutable set search_path = public as $$
declare
  r jsonb := case when jsonb_typeof(p_raw) = 'object' then p_raw else '{}'::jsonb end;
  spec jsonb := '[["attrition_pct",4,0,15,false],["klra_weight",1,0,1.5,false],["pipeline_factor",1,0,2,false],["annual_intake",20,0,80,true],["develop_rate",15,0,40,false]]';
  lspec jsonb := '[["pace",0,2,false],["advance",0,1.5,false],["adv_start",2027,2035,true]]';
  dl jsonb := '{"baseline":{"pace":1,"advance":0,"adv_start":2030},"advance":{"pace":1,"advance":1,"adv_start":2030},"accelerated":{"pace":1.5,"advance":1.5,"adv_start":2028}}';
  s jsonb; k text; v jsonb; out jsonb := '{}'::jsonb; lv jsonb; x jsonb; sc text; o jsonb; levers jsonb := '{}'::jsonb;
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
  v := r->'catalogue';
  if v is null or jsonb_typeof(v) = 'null' then out := out || jsonb_build_object('catalogue', 'all');
  elsif jsonb_typeof(v) <> 'string' or (v #>> '{}') not in ('all', 'established') then return null;
  else out := out || jsonb_build_object('catalogue', v #>> '{}'); end if;
  lv := r->'levers';
  if lv is not null and jsonb_typeof(lv) <> 'null' and jsonb_typeof(lv) <> 'object' then return null; end if;
  foreach sc in array array['baseline', 'advance', 'accelerated'] loop
    x := case when lv is null or jsonb_typeof(lv) <> 'object' then null else lv->sc end;
    o := dl->sc;
    if x is not null and jsonb_typeof(x) <> 'null' then
      if jsonb_typeof(x) <> 'object' then return null; end if;
      for s in select * from jsonb_array_elements(lspec) loop
        k := s->>0; v := x->k;
        if v is null or jsonb_typeof(v) = 'null' then v := (dl->sc)->k; end if;
        if jsonb_typeof(v) <> 'number' then return null; end if;
        if v::numeric < (s->>1)::numeric or v::numeric > (s->>2)::numeric then return null; end if;
        if (s->>3)::boolean and v::numeric <> floor(v::numeric) then return null; end if;
        o := o || jsonb_build_object(k, v);
      end loop;
    end if;
    levers := levers || jsonb_build_object(sc, o);
  end loop;
  return out || jsonb_build_object('levers', levers);
end $$;

-- profileNeeds(): role x horizon x skill -> needed level (latest published FS05 version; a missing horizon takes the previous one;
-- a competency requirement means its core skill; levels clamped to 1..4)
create or replace function kafaa_sf_needs() returns table (role_id text, hz text, skill_id text, lvl integer) language sql stable security definer set search_path = public as $$
  with best as (
    select distinct on (v.role_id, v.horizon) v.role_id, v.horizon, v.requirements
    from kafaa_role_profile_versions v where v.status = 'published' and v.horizon in ('now', '2030', '2035')
    order by v.role_id, v.horizon, v.version desc
  ), req as (
    select b.role_id, b.horizon, x.sid as skill_id, max(greatest(1, least(4, coalesce(floor((q->>'level')::numeric), 0))))::integer as lvl
    from best b
    cross join lateral jsonb_array_elements(case when jsonb_typeof(b.requirements) = 'array' then b.requirements else '[]'::jsonb end) q
    cross join lateral (select q->>'ref_id' as sid where q->>'kind' = 'skill'
                        union all select s.id from kafaa_skills s where q->>'kind' = 'competency' and s.core and s.competency_id = q->>'ref_id') x
    where x.sid is not null
    group by 1, 2, 3
  ), src as (
    select r.role_id, h.hz,
      case h.hz
        when 'now' then case when exists (select 1 from best b where b.role_id = r.role_id and b.horizon = 'now') then 'now' end
        when '2030' then case when exists (select 1 from best b where b.role_id = r.role_id and b.horizon = '2030') then '2030'
                              when exists (select 1 from best b where b.role_id = r.role_id and b.horizon = 'now') then 'now' end
        else case when exists (select 1 from best b where b.role_id = r.role_id and b.horizon = '2035') then '2035'
                  when exists (select 1 from best b where b.role_id = r.role_id and b.horizon = '2030') then '2030'
                  when exists (select 1 from best b where b.role_id = r.role_id and b.horizon = 'now') then 'now' end end as src
    from (select distinct b.role_id from best b) r cross join (values ('now'), ('2030'), ('2035')) h(hz)
  )
  select s.role_id, s.hz, q.skill_id, q.lvl from src s join req q on q.role_id = s.role_id and q.horizon = s.src
$$;

-- gatherForecastBase(): integer aggregates per in-scope skill for one staffing scenario (null = current fleet); null for an unknown scenario
create or replace function kafaa_sf_base(p_scenario text, p_catalogue text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_base integer := 2026; sc kafaa_scenarios; v_p jsonb; v_head boolean; v_tech text := null; v_sc jsonb := null;
  v_kperiod text; v_cperiod text; v_high numeric; v_med numeric; v_org integer; v_staff integer; v_skills jsonb; v_nodem jsonb;
begin
  if p_scenario is not null then
    select * into sc from kafaa_scenarios where id = p_scenario;
    if sc.id is null then return null; end if;
    v_p := case when jsonb_typeof(sc.params) = 'object' then sc.params else '{}'::jsonb end;
    v_head := sc.kind = 'headcount';
    if sc.kind = 'technology' and jsonb_typeof(v_p->'technology') = 'string' and (v_p->>'technology') <> '' then v_tech := v_p->>'technology'; end if;
    v_sc := jsonb_build_object('id', sc.id, 'name', sc.name, 'kind', sc.kind,
      'units', case when v_head then kafaa_so_num(v_p->'units', 0) else 0 end,
      'start', case when v_head then kafaa_so_num(coalesce(v_p->'startYear', v_p->'start'), 2032) else 2032 end,
      'per_unit', case when v_head then kafaa_so_num(v_p->'perUnit', 48) else 48 end,
      'baseline', case when v_head then kafaa_so_num(v_p->'baseline', 190) else 190 end,
      'tech', v_tech);
  end if;
  select max(period collate "C") into v_kperiod from kafaa_klra_assessments;
  select max(period collate "C") into v_cperiod from kafaa_handover_cohorts;
  select coalesce(max(high_threshold) filter (where id = 'default'), 16), coalesce(max(medium_threshold) filter (where id = 'default'), 8) into v_high, v_med from kafaa_klra_settings;
  select count(*)::integer into v_staff from kafaa_people p where p.kind = 'staff' and p.status = 'active';
  select greatest(0, floor(w.value))::integer into v_org from kafaa_workforce_snapshots w
    where w.measure = 'headcount' and w.family_id is null and w.level is null and w.entity_id is null order by w.period collate "C" desc limit 1;

  with staff as (select p.id, p.job_role_id from kafaa_people p where p.kind = 'staff' and p.status = 'active'),
  needs as (select * from kafaa_sf_needs()),
  scope as (select s.id, s.area, s.fs_area, s.adv_skill_ids from kafaa_skills s
            where s.area <> all(array['security']) and coalesce(s.lifecycle, 'stable') <> 'obsolete' and (p_catalogue = 'all' or s.fs_area is null)),
  held as (select ps.skill_id, ps.person_id, max(least(4, floor(ps.level)))::integer as lv
           from kafaa_person_skills ps join staff st on st.id = ps.person_id
           where ps.active is distinct from false and ps.basis is distinct from 'claimed' and ps.level >= 1 group by 1, 2),
  pneed as (select n.skill_id, st.id as person_id, n.hz, n.lvl from staff st join needs n on n.role_id = st.job_role_id),
  dem as (select pn.skill_id, pn.hz, g.l, count(*)::integer as n from pneed pn cross join generate_series(1, 4) g(l) where pn.lvl >= g.l group by 1, 2, 3),
  basis as (select pn.skill_id, count(distinct pn.person_id)::integer as nd,
                   count(distinct pn.person_id) filter (where not exists (select 1 from held h where h.skill_id = pn.skill_id and h.person_id = pn.person_id))::integer as pool
            from pneed pn group by 1),
  kl as (select h.skill_id, h.lv, (d.e->>0)::integer as y, sum(w.w * (d.e->>1)::integer)::integer as n
         from kafaa_klra_positions kp
         join held h on h.person_id = kp.person_id
         join lateral (select ka.total from kafaa_klra_assessments ka where ka.position_id = kp.id and ka.period = v_kperiod order by ka.id collate "C" desc limit 1) t on true
         cross join lateral (select case when t.total >= v_high then 10 when t.total >= v_med then 7 else 4 end as w) w
         cross join lateral jsonb_array_elements(kafaa_so_departures(kp.contract_kind, kp.retirement_band, kp.contract_end_band, v_base)) d(e)
         where kp.active is distinct from false and kp.kind = 'staff' and kp.person_id is not null
         group by 1, 2, 3),
  co as (select n.skill_id, n.lvl, greatest(v_base + 1, extract(year from c.ready_on)::integer) as y, sum(c.trainees)::integer as n
         from kafaa_handover_cohorts c join needs n on n.role_id = c.role_id and n.hz = 'now'
         where c.period = v_cperiod group by 1, 2, 3)
  select coalesce(jsonb_agg(jsonb_build_object(
      'skill_id', s.id, 'area', s.area, 'fs_area', s.fs_area,
      'n_s', (select count(*)::integer from held h where h.skill_id = s.id),
      'n_d', coalesce((select bs.nd from basis bs where bs.skill_id = s.id), 0),
      'held', (select jsonb_agg((select count(*)::integer from held h where h.skill_id = s.id and h.lv = g.l) order by g.l) from generate_series(1, 4) g(l)),
      'pool', coalesce((select bs.pool from basis bs where bs.skill_id = s.id), 0),
      'd_now', (select jsonb_agg(coalesce((select dm.n from dem dm where dm.skill_id = s.id and dm.hz = 'now' and dm.l = g.l), 0) order by g.l) from generate_series(1, 4) g(l)),
      'd_mid', (select jsonb_agg(coalesce((select dm.n from dem dm where dm.skill_id = s.id and dm.hz = '2030' and dm.l = g.l), 0) order by g.l) from generate_series(1, 4) g(l)),
      'd_far', (select jsonb_agg(coalesce((select dm.n from dem dm where dm.skill_id = s.id and dm.hz = '2035' and dm.l = g.l), 0) order by g.l) from generate_series(1, 4) g(l)),
      'klra60', coalesce((select jsonb_object_agg(z.lv::text, z.ys) from (select k.lv, jsonb_object_agg(k.y::text, k.n) as ys from kl k where k.skill_id = s.id group by k.lv) z), '{}'::jsonb),
      'cohort', coalesce((select jsonb_object_agg(z.lvl::text, z.ys) from (select c.lvl, jsonb_object_agg(c.y::text, c.n) as ys from co c where c.skill_id = s.id group by c.lvl) z), '{}'::jsonb),
      'lo', exists (select 1 from needs n where n.role_id = 'local-operator' and n.hz = 'now' and n.skill_id = s.id),
      'direct', exists (select 1 from unnest(coalesce(s.adv_skill_ids, '{}'::text[])) x join kafaa_adv_skills ad on ad.id = x where v_tech is null or ad.tech_id = v_tech)
                or coalesce(s.fs_area, '') = 'advanced_reactor',
      'adv_m', (select count(*)::integer from kafaa_skills x where x.area = s.area and x.fs_area is null
                and exists (select 1 from unnest(coalesce(x.adv_skill_ids, '{}'::text[])) y join kafaa_adv_skills ad on ad.id = y where v_tech is null or ad.tech_id = v_tech)),
      'adv_t', (select count(*)::integer from kafaa_skills x where x.area = s.area and x.fs_area is null)
    ) order by s.id collate "C"), '[]'::jsonb),
    coalesce(jsonb_agg(to_jsonb(s.id) order by s.id collate "C") filter (where not exists (select 1 from basis bs where bs.skill_id = s.id and bs.nd > 0)), '[]'::jsonb)
    into v_skills, v_nodem
  from scope s;
  return jsonb_build_object('catalogue', p_catalogue, 'skills', v_skills, 'no_demand', v_nodem,
    'adv_sum', (select coalesce(sum(value), 0) from kafaa_future_skills), 'adv_n', (select count(*)::integer from kafaa_future_skills),
    'org', coalesce(v_org, 0), 'staff', v_staff, 'scenario', v_sc);
end $$;

-- survive(): (1 - a)^n by repeated multiplication (the same operations as TS)
create or replace function kafaa_sf_survive(a double precision, n integer) returns double precision language plpgsql immutable set search_path = public as $$
declare q double precision := 1; i integer;
begin
  for i in 1 .. n loop q := q * (1 - a); end loop;
  return q;
end $$;

-- projectSkill(): one visible skill under one scenario's levers
create or replace function kafaa_sf_project(k jsonb, b jsonb, p jsonb, lv jsonb) returns jsonb language plpgsql immutable set search_path = public as $$
declare
  v_base integer := 2026; v_h integer := 2035; y integer; i integer; j integer;
  v_scale double precision; a double precision := (p->>'attrition_pct')::double precision / 100; r double precision := (p->>'develop_rate')::double precision / 100;
  v_kw double precision := (p->>'klra_weight')::double precision; v_pf double precision := (p->>'pipeline_factor')::double precision; v_ai double precision := (p->>'annual_intake')::double precision;
  v_pace double precision := (lv->>'pace')::double precision; v_adv double precision := (lv->>'advance')::double precision; v_start integer := (lv->>'adv_start')::integer;
  v_int double precision; v_share double precision; s double precision[]; dd double precision[]; pl double precision; e double precision; g double precision; ramp double precision; up double precision;
  v double precision; t double precision; need double precision; mv double precision; kl double precision;
  dn integer[]; dmid integer[]; dfar integer[]; sc jsonb := b->'scenario'; v_lo boolean := (k->>'lo')::boolean;
  d_out jsonb := '[]'::jsonb; s_out jsonb := '[]'::jsonb; drow integer[]; srow integer[]; v_first integer := null; last_d integer[]; last_s integer[];
  v_bind integer; v_bgap integer; gp integer; v_hold integer; gens jsonb := '[]'::jsonb; w jsonb; v_mid integer;
begin
  v_scale := case when (b->>'org')::integer > 0 and (b->>'staff')::integer > 0 then (b->>'org')::double precision / (b->>'staff')::double precision else 1 end;
  v_int := case when v_adv > 0 then kafaa_so_adjust(case when (b->>'adv_n')::integer > 0 then (b->>'adv_sum')::double precision / (b->>'adv_n')::double precision else 0 end, v_adv) / 100 else 0 end;
  v_share := case when (k->>'direct')::boolean then 1 when (k->>'adv_t')::integer > 0 then (k->>'adv_m')::integer::double precision / (k->>'adv_t')::integer else 0 end;
  s := array[(k->'held'->>0)::integer * v_scale, (k->'held'->>1)::integer * v_scale, (k->'held'->>2)::integer * v_scale, (k->'held'->>3)::integer * v_scale];
  pl := (k->>'pool')::integer * v_scale;
  dn := array[(k->'d_now'->>0)::integer, (k->'d_now'->>1)::integer, (k->'d_now'->>2)::integer, (k->'d_now'->>3)::integer];
  dmid := array[(k->'d_mid'->>0)::integer, (k->'d_mid'->>1)::integer, (k->'d_mid'->>2)::integer, (k->'d_mid'->>3)::integer];
  dfar := array[(k->'d_far'->>0)::integer, (k->'d_far'->>1)::integer, (k->'d_far'->>2)::integer, (k->'d_far'->>3)::integer];
  for y in v_base .. v_h loop
    -- demandAt(y)
    e := least(v_h::double precision, v_base + (y - v_base) * v_pace);
    g := kafaa_so_growth(sc, y);
    ramp := case when y < v_start then 0 else least(1::double precision, (y - v_start + 1)::double precision / 5) end;
    up := 1 + v_share * v_int * ramp;
    dd := array[0, 0, 0, 0]::double precision[];
    for i in 1 .. 4 loop
      v := case when e <= 2030 then dn[i] + (dmid[i] - dn[i]) * (e - 2026) / 4 else dmid[i] + (dfar[i] - dmid[i]) * (e - 2030) / 5 end;
      dd[i] := v * v_scale * g * up;
    end loop;
    if y > v_base then
      for i in 1 .. 4 loop s[i] := s[i] - s[i] * a; end loop;
      for i in 1 .. 4 loop
        kl := coalesce((k->'klra60'->(i::text)->>(y::text))::integer, 0)::double precision / 60 * v_scale * v_kw;
        s[i] := s[i] - kl;
        if s[i] < 0 then s[i] := 0; end if;
      end loop;
      for i in 1 .. 4 loop s[i] := s[i] + coalesce((k->'cohort'->(i::text)->>(y::text))::integer, 0) * v_pf; end loop;
      if v_lo and y >= v_base + 2 then s[1] := s[1] + v_ai; end if;
      for i in reverse 3 .. 1 loop
        t := 0; for j in i + 1 .. 4 loop t := t + s[j]; end loop;
        need := dd[i + 1] - t;
        if need > 0 then mv := least(s[i] * r, need); s[i] := s[i] - mv; s[i + 1] := s[i + 1] + mv; end if;
      end loop;
      t := 0; for j in 1 .. 4 loop t := t + s[j]; end loop;
      need := dd[1] - t;
      if need > 0 then mv := least(pl * r, need); pl := pl - mv; s[1] := s[1] + mv; end if;
    end if;
    drow := array[kafaa_so_round(dd[1]), kafaa_so_round(dd[2]), kafaa_so_round(dd[3]), kafaa_so_round(dd[4])];
    srow := array[0, 0, 0, 0];
    for i in 1 .. 4 loop t := 0; for j in i .. 4 loop t := t + s[j]; end loop; srow[i] := kafaa_so_round(t); end loop;
    d_out := d_out || jsonb_build_array(to_jsonb(drow)); s_out := s_out || jsonb_build_array(to_jsonb(srow));
    if v_first is null and drow[2] - srow[2] > 0 then v_first := y; end if;
    if y = 2030 then v_mid := drow[2] - srow[2]; end if;
    last_d := drow; last_s := srow;
  end loop;
  v_bind := 1; v_bgap := last_d[1] - last_s[1];
  for i in 2 .. 4 loop gp := last_d[i] - last_s[i]; if gp > v_bgap then v_bind := i; v_bgap := gp; end if; end loop;
  v_hold := last_d[2];
  for w in select * from jsonb_array_elements('[[2036,2050],[2051,2065],[2066,2084]]'::jsonb) loop
    gens := gens || to_jsonb(kafaa_so_round(v_hold * (1 - kafaa_sf_survive(a, (w->>1)::integer - (w->>0)::integer + 1))));
  end loop;
  return jsonb_build_object('d', d_out, 's', s_out, 'gap_mid', v_mid, 'gap_far', last_d[2] - last_s[2], 'first_gap_year', v_first,
    'bind_level', v_bind, 'bind_gap', v_bgap, 'gen', gens);
end $$;

-- computeForecast(): the three scenarios for every visible skill, totals, generations and the method basis
create or replace function kafaa_sf_compute(b jsonb, p jsonb) returns jsonb language plpgsql immutable set search_path = public as $$
declare
  v_base integer := 2026; v_scale double precision; k jsonb; v_skills jsonb := '[]'::jsonb; v_sup jsonb := '[]'::jsonb; sc text; ser jsonb; scs jsonb;
  v_share double precision; s0 jsonb; i integer; j integer; t double precision; hs double precision[]; v_tot jsonb := '{}'::jsonb; a double precision := (p->>'attrition_pct')::double precision / 100;
  v_rem jsonb := '[]'::jsonb; w jsonb;
begin
  v_scale := case when (b->>'org')::integer > 0 and (b->>'staff')::integer > 0 then (b->>'org')::double precision / (b->>'staff')::double precision else 1 end;
  for k in select * from jsonb_array_elements(b->'skills') loop
    if (k->>'n_d')::integer = 0 then continue; end if;
    if (k->>'n_s')::integer < 10 or (k->>'n_d')::integer < 10 then v_sup := v_sup || to_jsonb(k->>'skill_id'); continue; end if;
    scs := '{}'::jsonb;
    foreach sc in array array['baseline', 'advance', 'accelerated'] loop
      scs := scs || jsonb_build_object(sc, kafaa_sf_project(k, b, p, p->'levers'->sc));
    end loop;
    hs := array[(k->'held'->>0)::integer * v_scale, (k->'held'->>1)::integer * v_scale, (k->'held'->>2)::integer * v_scale, (k->'held'->>3)::integer * v_scale];
    s0 := '[]'::jsonb;
    for i in 1 .. 4 loop t := 0; for j in i .. 4 loop t := t + hs[j]; end loop; s0 := s0 || to_jsonb(kafaa_so_round(t)); end loop;
    v_share := case when (k->>'direct')::boolean then 1 when (k->>'adv_t')::integer > 0 then (k->>'adv_m')::integer::double precision / (k->>'adv_t')::integer else 0 end;
    v_skills := v_skills || jsonb_build_array(jsonb_build_object('skill_id', k->'skill_id', 'area', k->'area', 'fs_area', k->'fs_area', 'adv_pct', kafaa_so_round(v_share * 100),
      'basis_n', (k->>'n_s')::integer, 's0', s0, 'sc', scs));
  end loop;
  foreach sc in array array['baseline', 'advance', 'accelerated'] loop
    select jsonb_build_object(
      'short_mid', count(*) filter (where (x->'sc'->sc->>'gap_mid')::integer > 0),
      'short_far', count(*) filter (where (x->'sc'->sc->>'gap_far')::integer > 0),
      'shortfall_mid', coalesce(sum(greatest(0, (x->'sc'->sc->>'gap_mid')::integer)), 0),
      'shortfall_far', coalesce(sum(greatest(0, (x->'sc'->sc->>'gap_far')::integer)), 0),
      'first_gap_year', min((x->'sc'->sc->>'first_gap_year')::integer),
      'gen', jsonb_build_array(coalesce(sum((x->'sc'->sc->'gen'->>0)::integer), 0), coalesce(sum((x->'sc'->sc->'gen'->>1)::integer), 0), coalesce(sum((x->'sc'->sc->'gen'->>2)::integer), 0)))
    into ser from jsonb_array_elements(v_skills) x;
    v_tot := v_tot || jsonb_build_object(sc, ser);
  end loop;
  for w in select * from jsonb_array_elements('[[2036,2050],[2051,2065],[2066,2084]]'::jsonb) loop
    v_rem := v_rem || to_jsonb(kafaa_so_round(100 * kafaa_sf_survive(a, (w->>0)::integer - v_base)));
  end loop;
  return jsonb_build_object('simulated', true, 'method', 'fs51-v1', 'base_year', v_base, 'horizon', 2035,
    'years', (select jsonb_agg(v_base + q - 1 order by q) from generate_series(1, 10) q), 'params', p,
    'scenario', case when b->'scenario' is null or jsonb_typeof(b->'scenario') = 'null' then null
                     else jsonb_build_object('id', b->'scenario'->'id', 'name', b->'scenario'->'name', 'kind', b->'scenario'->'kind') end,
    'adv_index', kafaa_so_round(case when (b->>'adv_n')::integer > 0 then (b->>'adv_sum')::double precision / (b->>'adv_n')::double precision else 0 end * 10)::double precision / 10,
    'org_headcount', (b->>'org')::integer, 'staff_sample', (b->>'staff')::integer, 'min_group', 10,
    'basis', jsonb_build_object('method', 'fs51-v1', 'catalogue', b->'catalogue', 'skills_in_scope', jsonb_array_length(b->'skills'), 'base_year', v_base),
    'skills', v_skills, 'suppressed', v_sup,
    'not_modelled', (select coalesce(jsonb_agg(jsonb_build_object('skill_id', x, 'reason', 'no_profile_demand') order by n), '[]'::jsonb) from jsonb_array_elements(b->'no_demand') with ordinality z(x, n)),
    'totals', v_tot,
    'generations', jsonb_build_object('windows', '[[2036,2050],[2051,2065],[2066,2084]]'::jsonb, 'remain_pct', v_rem, 'last_year', 2084));
end $$;

-- forecastFor(): normalised params + scenario check + compute; {code, result}
create or replace function kafaa_sf_for(p_raw jsonb) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare p jsonb := kafaa_sf_normalize(coalesce(p_raw, '{}'::jsonb)); b jsonb;
begin
  if p is null then return jsonb_build_object('code', 'invalid'); end if;
  if p->>'scenario_id' is not null and not exists (select 1 from kafaa_scenarios where id = p->>'scenario_id') then return jsonb_build_object('code', 'not_found'); end if;
  b := kafaa_sf_base(p->>'scenario_id', p->>'catalogue');
  return jsonb_build_object('code', 'ok', 'result', kafaa_sf_compute(b, p));
end $$;

-- ═════════════ FS50 rules (mirror of src/modules/m35/critical.ts). Internal: not executable by API roles.
-- criticalProblem(): the first problem of a register row (null = fine)
create or replace function kafaa_crs_problem(p jsonb) returns text language plpgsql stable security definer set search_path = public as $$
declare sk kafaa_skills; e jsonb; v_prev integer := 0; v_seen text[] := '{}'; v_lo integer; v_hi integer; v_en text; v_ar text; v_gs text[] := '{}';
  isint boolean;
begin
  if jsonb_typeof(p->'skill_id') = 'string' then select * into sk from kafaa_skills where id = p->>'skill_id'; end if;
  if sk.id is null or sk.area = 'security' or sk.lifecycle = 'obsolete' then return 'skill'; end if;
  if jsonb_typeof(p->'owner_function') is distinct from 'string' or not (p->>'owner_function' = any(array['nuclear_training', 'operations', 'maintenance', 'engineering',
       'radiation_chemistry', 'safety_licensing', 'human_performance', 'emergency_preparedness', 'quality', 'leadership_development', 'digital_ai_governance', 'sustainability',
       'advanced_reactors', 'cyber_awareness']))
     or jsonb_typeof(p->'owner_person_id') is distinct from 'string'
     or not exists (select 1 from kafaa_people pe where pe.id = p->>'owner_person_id' and pe.kind = 'staff' and pe.status = 'active') then return 'owner'; end if;
  if jsonb_typeof(p->'target_level') is distinct from 'number' or (p->>'target_level')::numeric <> floor((p->>'target_level')::numeric) or (p->>'target_level')::numeric < 1 or (p->>'target_level')::numeric > 4 then return 'level'; end if;
  if jsonb_typeof(p->'targets') is distinct from 'array' or jsonb_array_length(p->'targets') < 1 or jsonb_array_length(p->'targets') > 6 then return 'targets'; end if;
  for e in select * from jsonb_array_elements(p->'targets') loop
    if jsonb_typeof(e) <> 'object' or jsonb_typeof(e->'year') is distinct from 'number' or jsonb_typeof(e->'pe') is distinct from 'number' then return 'targets'; end if;
    if (e->>'year')::numeric <> floor((e->>'year')::numeric) or (e->>'year')::numeric < 2026 or (e->>'year')::numeric > 2035
       or (e->>'pe')::numeric <> floor((e->>'pe')::numeric) or (e->>'pe')::numeric < 0 or (e->>'pe')::numeric > 5000 or (e->>'year')::numeric <= v_prev then return 'targets'; end if;
    v_prev := (e->>'year')::integer;
  end loop;
  if jsonb_typeof(p->'kpis') is distinct from 'array' or jsonb_array_length(p->'kpis') < 1 or jsonb_array_length(p->'kpis') > 4 then return 'kpis'; end if;
  for e in select * from jsonb_array_elements(p->'kpis') loop
    if jsonb_typeof(e) <> 'object' or jsonb_typeof(e->'kind') is distinct from 'string' or not (e->>'kind' = any(array['holders_pe', 'share_l3', 'plans_active', 'forecast_gap_mid']))
       or e->>'kind' = any(v_seen) then return 'kpis'; end if;
    v_lo := case e->>'kind' when 'holders_pe' then 0 when 'share_l3' then 0 when 'plans_active' then 0 else -5000 end;
    v_hi := case e->>'kind' when 'holders_pe' then 5000 when 'share_l3' then 100 when 'plans_active' then 10 else 5000 end;
    isint := jsonb_typeof(e->'target') = 'number' and (e->>'target')::numeric = floor((e->>'target')::numeric);
    if not isint or (e->>'target')::numeric < v_lo or (e->>'target')::numeric > v_hi then return 'kpis'; end if;
    v_seen := v_seen || (e->>'kind');
  end loop;
  if jsonb_typeof(p->'decision') is distinct from 'string' or not (p->>'decision' = any(array['build', 'buy', 'borrow', 'bot'])) then return 'decision'; end if;
  v_en := case when jsonb_typeof(p->'rationale_en') = 'string' then btrim(p->>'rationale_en', E' \t\n\r') else '' end;
  v_ar := case when jsonb_typeof(p->'rationale_ar') = 'string' then btrim(p->>'rationale_ar', E' \t\n\r') else '' end;
  if char_length(v_en) < 20 or char_length(v_en) > 600 or char_length(v_ar) < 20 or char_length(v_ar) > 600 or v_ar !~ '[؀-ۿ]' then return 'rationale'; end if;
  if jsonb_typeof(p->'gap_plan_ids') is distinct from 'array' or jsonb_array_length(p->'gap_plan_ids') > 5 then return 'plans'; end if;
  for e in select * from jsonb_array_elements(p->'gap_plan_ids') loop
    if jsonb_typeof(e) <> 'string' or (e #>> '{}') = any(v_gs)
       or not exists (select 1 from kafaa_skill_gap_plans g where g.id = (e #>> '{}') and g.sk_id is not distinct from p->>'skill_id') then return 'plans'; end if;
    v_gs := v_gs || (e #>> '{}');
  end loop;
  if jsonb_typeof(p->'status') is distinct from 'string' or not (p->>'status' = any(array['draft', 'active', 'retired'])) then return 'status'; end if;
  return null;
end $$;

-- quarters ('YYYY-Qn') of a date, its end date and the quarter before
create or replace function kafaa_crs_quarter(d date) returns text language sql immutable set search_path = public as $$
  select to_char(d, 'YYYY') || '-Q' || extract(quarter from d)::integer
$$;
create or replace function kafaa_crs_quarter_end(q text) returns text language sql immutable set search_path = public as $$
  select substr(q, 1, 4) || '-' || (array['03-31', '06-30', '09-30', '12-31'])[substr(q, 7, 1)::integer]
$$;
create or replace function kafaa_crs_prev_quarter(q text) returns text language sql immutable set search_path = public as $$
  select case when substr(q, 7, 1) = '1' then (substr(q, 1, 4)::integer - 1)::text || '-Q4' else substr(q, 1, 4) || '-Q' || (substr(q, 7, 1)::integer - 1)::text end
$$;

-- heldByLevel(): counted holders of a skill at exact levels 1..4 (best counted state per active staff member; claims never count)
create or replace function kafaa_crs_held(p_skill text) returns integer[] language sql stable security definer set search_path = public as $$
  with h as (select ps.person_id, max(least(4, floor(ps.level)))::integer as lv from kafaa_person_skills ps
             join kafaa_people st on st.id = ps.person_id and st.kind = 'staff' and st.status = 'active'
             where ps.skill_id = p_skill and ps.active is distinct from false and ps.basis is distinct from 'claimed' and ps.level >= 1 group by 1)
  select array[(select count(*) from h where lv = 1), (select count(*) from h where lv = 2), (select count(*) from h where lv = 3), (select count(*) from h where lv = 4)]::integer[]
$$;

-- targetFor(): this year's target (first target before its year, last after, linear in between, half up)
create or replace function kafaa_crs_target_for(p_targets jsonb, p_year integer) returns integer language plpgsql immutable set search_path = public as $$
declare t jsonb; n integer; i integer; lo jsonb; hi jsonb;
begin
  select coalesce(jsonb_agg(x order by (x->>'year')::integer, o), '[]'::jsonb) into t from jsonb_array_elements(coalesce(p_targets, '[]'::jsonb)) with ordinality z(x, o);
  n := jsonb_array_length(t);
  if n = 0 then return 0; end if;
  if p_year <= (t->0->>'year')::integer then return (t->0->>'pe')::integer; end if;
  if p_year >= (t->(n - 1)->>'year')::integer then return (t->(n - 1)->>'pe')::integer; end if;
  for i in 1 .. n - 1 loop
    if p_year <= (t->i->>'year')::integer then
      lo := t->(i - 1); hi := t->i;
      return kafaa_so_round((lo->>'pe')::integer + ((hi->>'pe')::integer - (lo->>'pe')::integer) * (p_year - (lo->>'year')::integer) / ((hi->>'year')::integer - (lo->>'year')::integer)::double precision);
    end if;
  end loop;
  return (t->(n - 1)->>'pe')::integer;
end $$;

-- progressOf(): computed progress of a register row (suppressed under 10 measured people)
create or replace function kafaa_crs_progress(p_level integer, p_targets jsonb, p_held integer[], p_scale double precision, p_year integer) returns jsonb language plpgsql immutable set search_path = public as $$
declare n integer := 0; l integer; v_all integer := p_held[1] + p_held[2] + p_held[3] + p_held[4]; n3 integer := p_held[3] + p_held[4]; v_tpe integer; v_mix jsonb; v_share jsonb; v_pe integer; v_pct integer;
begin
  for l in p_level .. 4 loop n := n + p_held[l]; end loop;
  v_tpe := kafaa_crs_target_for(p_targets, p_year);
  v_mix := jsonb_build_array(case when p_held[1] >= 10 then to_jsonb(p_held[1]) else 'null'::jsonb end, case when p_held[2] >= 10 then to_jsonb(p_held[2]) else 'null'::jsonb end,
                             case when p_held[3] >= 10 then to_jsonb(p_held[3]) else 'null'::jsonb end, case when p_held[4] >= 10 then to_jsonb(p_held[4]) else 'null'::jsonb end);
  v_share := case when v_all >= 10 and n3 >= 10 then to_jsonb(kafaa_so_round((100 * n3)::double precision / v_all)) else 'null'::jsonb end;
  if n < 10 then
    return jsonb_build_object('suppressed', true, 'pe', null, 'target_year', p_year, 'target_pe', v_tpe, 'pct', null, 'status', 'suppressed', 'mix', v_mix, 'share_l3', v_share);
  end if;
  v_pe := kafaa_so_round(n * p_scale);
  v_pct := case when v_tpe > 0 then kafaa_so_round((100 * v_pe)::double precision / v_tpe) end;
  return jsonb_build_object('suppressed', false, 'pe', v_pe, 'target_year', p_year, 'target_pe', v_tpe, 'pct', v_pct,
    'status', case when v_pct is null then 'no_target' when v_pct >= 100 then 'met' when v_pct >= 85 then 'on_track' when v_pct >= 60 then 'at_risk' else 'off_track' end,
    'mix', v_mix, 'share_l3', v_share);
end $$;

-- reviewState(): quarterly review state of a register row on a day
create or replace function kafaa_crs_review_state(p_id text, p_status text, p_adopted date, p_today date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare q text := kafaa_crs_quarter(p_today); v_last text; v_state text;
begin
  select max(quarter collate "C") into v_last from kafaa_critical_skill_reviews where critical_skill_id = p_id;
  v_state := case
    when p_status = 'draft' then 'not_started'
    when p_status = 'retired' then 'retired'
    when exists (select 1 from kafaa_critical_skill_reviews where critical_skill_id = p_id and quarter = q) then 'done'
    when kafaa_crs_quarter(coalesce(p_adopted, p_today)) collate "C" >= q collate "C"
      or exists (select 1 from kafaa_critical_skill_reviews where critical_skill_id = p_id and quarter = kafaa_crs_prev_quarter(q)) then 'due'
    else 'overdue' end;
  return jsonb_build_object('quarter', q, 'due_on', kafaa_crs_quarter_end(q), 'state', v_state, 'last_quarter', v_last);
end $$;

-- criticalBoard(): every register row with computed progress, KPIs, review state and attention reasons, plus the tiles
create or replace function kafaa_crs_board_core(p_today date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_year integer := extract(year from p_today)::integer; v_staff integer; v_org integer; v_scale double precision; fc kafaa_skill_forecasts; r kafaa_critical_skills;
  v_prog jsonb; v_rev jsonb; v_pa integer; v_gap integer; v_kpis jsonb; v_reasons jsonb; v_score integer; v_rows jsonb := '[]'::jsonb; e jsonb; v_val jsonb; v_fs jsonb;
  v_act integer := 0; v_draft integer := 0; c_met integer := 0; c_on integer := 0; c_risk integer := 0; c_off integer := 0; c_sup integer := 0; c_due integer := 0; c_over integer := 0;
  c_build integer := 0; c_buy integer := 0; c_borrow integer := 0; c_bot integer := 0;
begin
  select count(*)::integer into v_staff from kafaa_people p where p.kind = 'staff' and p.status = 'active';
  select greatest(0, floor(w.value))::integer into v_org from kafaa_workforce_snapshots w
    where w.measure = 'headcount' and w.family_id is null and w.level is null and w.entity_id is null order by w.period collate "C" desc limit 1;
  v_scale := case when coalesce(v_org, 0) > 0 and v_staff > 0 then v_org::double precision / v_staff else 1 end;
  select * into fc from kafaa_skill_forecasts f where f.status = 'released' order by (f.cycle = v_year) desc, f.cycle desc, f.released_at desc nulls last, f.id collate "C" limit 1;
  for r in select * from kafaa_critical_skills order by sort, id collate "C" loop
    v_prog := kafaa_crs_progress(r.target_level, r.targets, kafaa_crs_held(r.skill_id), v_scale, v_year);
    select count(*)::integer into v_pa from unnest(r.gap_plan_ids) g where exists (select 1 from kafaa_skill_gap_plans gp where gp.id = g and gp.status = 'active');
    v_gap := null;
    if fc.id is not null then
      select x into v_fs from jsonb_array_elements(coalesce(fc.results->'skills', '[]'::jsonb)) x where x->>'skill_id' = r.skill_id limit 1;
      if v_fs is not null then v_gap := (v_fs->'sc'->fc.scenario->>'gap_mid')::integer; end if;
      v_fs := null;
    end if;
    v_rev := kafaa_crs_review_state(r.id, r.status, r.adopted_on, p_today);
    v_kpis := '[]'::jsonb;
    for e in select * from jsonb_array_elements(coalesce(r.kpis, '[]'::jsonb)) loop
      v_val := case e->>'kind' when 'holders_pe' then v_prog->'pe' when 'share_l3' then v_prog->'share_l3' when 'plans_active' then to_jsonb(v_pa) else coalesce(to_jsonb(v_gap), 'null'::jsonb) end;
      v_kpis := v_kpis || jsonb_build_array(jsonb_build_object('kind', e->'kind', 'target', e->'target', 'value', v_val,
        'met', case when jsonb_typeof(v_val) = 'null' then 'null'::jsonb when e->>'kind' = 'forecast_gap_mid' then to_jsonb((v_val #>> '{}')::numeric <= (e->>'target')::numeric)
                    else to_jsonb((v_val #>> '{}')::numeric >= (e->>'target')::numeric) end));
    end loop;
    v_score := 0; v_reasons := '[]'::jsonb;
    if r.status = 'active' then
      if v_rev->>'state' = 'overdue' then v_score := v_score + 3; v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'cs_review_overdue', 'key', 'm35.reasons.cs_review_overdue', 'vars', jsonb_build_object('quarter', v_rev->'quarter')));
      elsif v_rev->>'state' = 'due' then v_score := v_score + 1; v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'cs_review_due', 'key', 'm35.reasons.cs_review_due', 'vars', jsonb_build_object('date', v_rev->'due_on'))); end if;
      if v_prog->>'status' = 'off_track' then v_score := v_score + 3; v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'cs_off_track', 'key', 'm35.reasons.cs_off_track', 'vars', jsonb_build_object('pct', coalesce(v_prog->'pct', to_jsonb(0)))));
      elsif v_prog->>'status' = 'at_risk' then v_score := v_score + 2; v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'cs_at_risk', 'key', 'm35.reasons.cs_at_risk', 'vars', jsonb_build_object('pct', coalesce(v_prog->'pct', to_jsonb(0)))));
      elsif v_prog->>'status' = 'suppressed' then v_score := v_score + 1; v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'cs_suppressed', 'key', 'm35.reasons.cs_suppressed', 'vars', jsonb_build_object('n', 10))); end if;
      if v_gap is not null and v_gap > 0 then v_score := v_score + 2; v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'cs_forecast_gap', 'key', 'm35.reasons.cs_forecast_gap', 'vars', jsonb_build_object('gap', v_gap))); end if;
      if v_pa = 0 then v_score := v_score + 1; v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'cs_no_plan', 'key', 'm35.reasons.cs_no_plan', 'vars', '{}'::jsonb)); end if;
      if jsonb_array_length(v_reasons) = 0 then v_reasons := jsonb_build_array(jsonb_build_object('code', 'cs_on_course', 'key', 'm35.reasons.cs_on_course', 'vars', '{}'::jsonb)); end if;
      v_act := v_act + 1;
      c_met := c_met + (v_prog->>'status' = 'met')::integer; c_on := c_on + (v_prog->>'status' = 'on_track')::integer; c_risk := c_risk + (v_prog->>'status' = 'at_risk')::integer;
      c_off := c_off + (v_prog->>'status' = 'off_track')::integer; c_sup := c_sup + (v_prog->>'status' = 'suppressed')::integer;
      c_due := c_due + (v_rev->>'state' = 'due')::integer; c_over := c_over + (v_rev->>'state' = 'overdue')::integer;
      c_build := c_build + (r.decision = 'build')::integer; c_buy := c_buy + (r.decision = 'buy')::integer; c_borrow := c_borrow + (r.decision = 'borrow')::integer; c_bot := c_bot + (r.decision = 'bot')::integer;
    elsif r.status = 'draft' then v_draft := v_draft + 1;
    end if;
    v_rows := v_rows || jsonb_build_array(jsonb_build_object('id', r.id, 'skill_id', r.skill_id, 'progress', v_prog, 'kpis', v_kpis, 'review', v_rev, 'plans_active', v_pa,
      'forecast_gap_mid', v_gap, 'score', v_score, 'reasons', v_reasons));
  end loop;
  return jsonb_build_object('as_of', p_today::text, 'year', v_year, 'quarter', kafaa_crs_quarter(p_today), 'scale', v_scale, 'min_group', 10,
    'forecast', case when fc.id is null then null else jsonb_build_object('id', fc.id, 'name', fc.name, 'cycle', fc.cycle, 'scenario', fc.scenario) end,
    'rows', v_rows,
    'tiles', jsonb_build_object('active', v_act, 'draft', v_draft, 'met', c_met, 'on_track', c_on, 'at_risk', c_risk, 'off_track', c_off, 'suppressed', c_sup, 'due', c_due, 'overdue', c_over,
      'decisions', jsonb_build_object('build', c_build, 'buy', c_buy, 'borrow', c_borrow, 'bot', c_bot)));
end $$;

-- reviewProblem(): the first problem of a review input (null = fine)
create or replace function kafaa_crs_review_problem(p jsonb, p_current text) returns text language plpgsql immutable set search_path = public as $$
declare v_en text; v_ar text; d jsonb := p->'decision';
begin
  if jsonb_typeof(p->'rating') is distinct from 'string' or not (p->>'rating' = any(array['met', 'on_track', 'at_risk', 'off_track'])) then return 'rating'; end if;
  v_en := case when jsonb_typeof(p->'note_en') = 'string' then btrim(p->>'note_en', E' \t\n\r') else '' end;
  v_ar := case when jsonb_typeof(p->'note_ar') = 'string' then btrim(p->>'note_ar', E' \t\n\r') else '' end;
  if char_length(v_en) < 10 or char_length(v_en) > 600 or char_length(v_ar) < 10 or char_length(v_ar) > 600 then return 'notes'; end if;
  if d is not null and jsonb_typeof(d) <> 'null' and not (jsonb_typeof(d) = 'string' and (d #>> '{}') = '') then
    if jsonb_typeof(d) <> 'string' or not ((d #>> '{}') = any(array['build', 'buy', 'borrow', 'bot'])) then return 'decision'; end if;
    if (d #>> '{}') <> p_current then
      v_en := case when jsonb_typeof(p->'rationale_en') = 'string' then btrim(p->>'rationale_en', E' \t\n\r') else '' end;
      v_ar := case when jsonb_typeof(p->'rationale_ar') = 'string' then btrim(p->>'rationale_ar', E' \t\n\r') else '' end;
      if char_length(v_en) < 20 or char_length(v_en) > 600 or char_length(v_ar) < 20 or char_length(v_ar) > 600 or v_ar !~ '[؀-ۿ]' then return 'rationale'; end if;
    end if;
  end if;
  return null;
end $$;

-- ═════════════ RPCs
-- FS50: the register board (workforce_strategy Agg/R/W/A). Read-only; refusals audited.
create or replace function kafaa_critical_skill_board() returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if kafaa_me() is null then return kafaa_refuse('critical.board', 'critical_skills', null, 'not_signed_in', 'Sign in to use the critical skills register'); end if;
  if not kafaa_has_grant('workforce_strategy', array['Agg', 'R', 'W', 'A']) then
    return kafaa_refuse('critical.board', 'critical_skills', null, 'forbidden', 'The critical skills register is for HR, the training manager, admins and auditors'); end if;
  return jsonb_build_object('ok', true, 'code', 'ok', 'message', 'Critical skills register', 'audit_seq', null, 'ledger_seq', null, 'data', kafaa_crs_board_core(current_date));
end $$;

-- FS50: add or edit a register row (W drafts; A adopts, edits an adopted row or retires; ledger on adoption and retirement)
create or replace function kafaa_save_critical_skill(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; v_skill text; v_given text; v_entity text; v_id text; cur kafaa_critical_skills; v_problem text; v_version integer;
  v_active boolean; v_retired boolean; v_hist jsonb; v_status text; v_ledger text; a kafaa_audit_events; l integer;
begin
  v_skill := case when jsonb_typeof(p->'skill_id') = 'string' then p->>'skill_id' else '' end;
  v_given := case when jsonb_typeof(p->'id') = 'string' and p->>'id' <> '' then p->>'id' end;
  v_entity := coalesce(v_given, case when v_skill <> '' then 'cs-' || v_skill end);
  if me is null then return kafaa_refuse('critical.save', 'critical_skills', v_entity, 'not_signed_in', 'Sign in to use the critical skills register'); end if;
  if not kafaa_has_grant('workforce_strategy', array['W', 'A']) then
    return kafaa_refuse('critical.save', 'critical_skills', v_entity, 'forbidden', 'Only HR analysts and the HR director edit the critical skills register'); end if;
  v_role := kafaa_acting_role('workforce_strategy', array['W', 'A']);
  v_id := coalesce(v_given, 'cs-' || v_skill);
  select * into cur from kafaa_critical_skills where id = v_id;
  if v_given is not null and (cur.id is null or cur.skill_id <> v_skill) then return kafaa_refuse('critical.save', 'critical_skills', v_entity, 'not_found', 'Register row not found', v_role); end if;
  if v_given is null and cur.id is not null then return kafaa_refuse('critical.save', 'critical_skills', v_entity, 'conflict', 'This skill is already on the register', v_role); end if;
  v_problem := kafaa_crs_problem(p);
  if v_problem is not null then
    return kafaa_refuse('critical.save', 'critical_skills', v_entity, 'invalid', 'Check the register row: ' || case v_problem
      when 'skill' then 'choose a catalogue skill that is not obsolete and not a security skill'
      when 'owner' then 'name an owning function and an active staff role card as owner'
      when 'level' then 'a target level from 1 to 4'
      when 'targets' then 'one to six targets, years 2026 to 2035 in rising order, whole people-equivalents from 0 to 5000'
      when 'kpis' then 'one to four distinct KPIs with whole-number targets in range'
      when 'decision' then 'choose build, buy, borrow or bot'
      when 'rationale' then 'a decision rationale of 20 to 600 characters in English and in Arabic'
      when 'plans' then 'up to five FS04 gap plans for the same skill'
      else 'choose draft, active or retired' end, v_role);
  end if;
  v_status := p->>'status';
  if v_status <> 'draft' or (cur.id is not null and cur.status <> 'draft') then
    if not kafaa_has_grant('workforce_strategy', array['A']) then
      return kafaa_refuse('critical.save', 'critical_skills', v_entity, 'forbidden', 'Only the HR director adopts, edits an adopted row or retires a critical skill', v_role); end if;
    v_role := kafaa_acting_role('workforce_strategy', array['A']);
  end if;
  v_version := coalesce(cur.version + 1, 1);
  v_active := v_status = 'active' and (cur.id is null or cur.status <> 'active');
  v_retired := v_status = 'retired' and (cur.id is null or cur.status <> 'retired');
  v_hist := coalesce(cur.decision_history, '[]'::jsonb);
  if cur.id is not null and cur.decision <> p->>'decision' then
    v_hist := v_hist || jsonb_build_array(jsonb_build_object('decision', cur.decision, 'rationale_en', cur.rationale_en, 'rationale_ar', cur.rationale_ar, 'until', current_date::text, 'by', me));
  end if;
  if cur.id is not null then
    update kafaa_critical_skills set owner_function = p->>'owner_function', owner_person_id = p->>'owner_person_id', target_level = (p->>'target_level')::integer,
      targets = (select jsonb_agg(jsonb_build_object('year', (e->>'year')::integer, 'pe', (e->>'pe')::integer) order by n) from jsonb_array_elements(p->'targets') with ordinality q(e, n)),
      kpis = (select jsonb_agg(jsonb_build_object('kind', e->>'kind', 'target', (e->>'target')::integer) order by n) from jsonb_array_elements(p->'kpis') with ordinality q(e, n)),
      decision = p->>'decision', rationale_en = btrim(p->>'rationale_en', E' \t\n\r'), rationale_ar = btrim(p->>'rationale_ar', E' \t\n\r'), decision_history = v_hist,
      gap_plan_ids = (select coalesce(array_agg(e #>> '{}' order by n), '{}'::text[]) from jsonb_array_elements(p->'gap_plan_ids') with ordinality q(e, n)),
      status = v_status, adopted_on = case when v_active then current_date else cur.adopted_on end, version = v_version, updated_by = me, updated_at = now()
    where id = v_id;
  else
    insert into kafaa_critical_skills (id, skill_id, owner_function, owner_person_id, target_level, targets, kpis, decision, rationale_en, rationale_ar, decision_history, gap_plan_ids,
      status, adopted_on, version, sort, benchmark_ids, created_by, created_at, updated_by, updated_at)
    values (v_id, v_skill, p->>'owner_function', p->>'owner_person_id', (p->>'target_level')::integer,
      (select jsonb_agg(jsonb_build_object('year', (e->>'year')::integer, 'pe', (e->>'pe')::integer) order by n) from jsonb_array_elements(p->'targets') with ordinality q(e, n)),
      (select jsonb_agg(jsonb_build_object('kind', e->>'kind', 'target', (e->>'target')::integer) order by n) from jsonb_array_elements(p->'kpis') with ordinality q(e, n)),
      p->>'decision', btrim(p->>'rationale_en', E' \t\n\r'), btrim(p->>'rationale_ar', E' \t\n\r'), '[]'::jsonb,
      (select coalesce(array_agg(e #>> '{}' order by n), '{}'::text[]) from jsonb_array_elements(p->'gap_plan_ids') with ordinality q(e, n)),
      v_status, case when v_active then current_date end, 1, (select coalesce(max(sort), 0) + 1 from kafaa_critical_skills), array['IAEA-WFP', 'ISO30414', 'FORECAST'], me, now(), me, now());
  end if;
  v_ledger := case when v_active then 'kafaa.workforce.critical_skill_adopt' when v_retired then 'kafaa.workforce.critical_skill_retire' end;
  if v_ledger is not null then l := kafaa_ledger(v_ledger, 'Critical skill ' || case when v_active then 'adopted' else 'retired' end || ': ' || v_skill); end if;
  a := kafaa_audit('critical.save', 'critical_skills', v_id, 'ok', 'v' || v_version || ' ' || v_status || ' ' || (p->>'decision'),
    case when v_ledger is null then 'not_applicable' when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when cur.id is not null then 'Register row saved' else 'Critical skill added to the register' end, a, l,
    jsonb_build_object('id', v_id, 'version', v_version, 'status', v_status));
end $$;
