-- kafaa_fs73_regional_pledges_p1 (1/2) · from supabase/migrations/20261010273001_kafaa_fs73_regional_pledges.sql
-- Apply with apply_migration name "kafaa_fs73_regional_pledges_p1". Additive and idempotent; kafaa_* objects only.
-- [FS wave G · E3 · FS64 + FS65] Skills Ecosystem (M36): the regional skills plan for Al Dhafra and the skills pledges ledger.
-- FS64: kafaa_regional_demand holds ONLY released, suppressed aggregates: rpc.releaseRegionalDemand (HR director: workforce_strategy A and
--   ecosystem W) turns a RELEASED FS51 forecast (kafaa_skill_forecasts, M35) into rows per catalogue area and horizon year (2028, 2030,
--   2035): working-level demand and gap bands across the three FS51 scenarios and the planning-scenario gap; cells of 1-9
--   people-equivalents are null (also enforced by a check constraint); security skills are never released (kafaa_rg_rows = demandRows in
--   src/modules/m36/regional.ts). kafaa_provider_commitments: a provider's planned cohorts or course changes per academic term against
--   the release, delivery reported each term, ENEC acknowledgement; written only through rpc.commitProvision /
--   reportCommitmentDelivery (ecosystem OrgW, own organisation) and reviewCommitment (ecosystem W); every call audited.
-- FS65: kafaa_pledges (people x skill area x target date, one organisation) and kafaa_pledge_progress (dated, cumulative started and
--   completed); rpc.registerPledge / recordPledgeProgress (OrgW for the own organisation; ecosystem W for the ENEC entities) and the
--   aggregate rpc.pledgeLedger (pledged, started and completed never merged; cells under 10 people or from fewer than two organisations
--   suppressed; kafaa_pl_ledger = pledgeLedger in src/modules/m36/pledges.ts).
-- RLS: regional_demand readable by ecosystem R/W/A where released (every row) and workforce_strategy Agg/R/W/A. The organisation tables
--   carry an always-false open_read column, so partners and universities read only their own organisation (OwnOrg) and HR, admins and
--   auditors read all rows through workforce_strategy R/W/A; ENEC staff see the suppressed ledger only.
-- PGlite parity and checks: scripts/validate/fs73-regional-pledges.mjs. Tests: tests/unit/fs73-*.
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects; never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file; RLS in the per-statement (perf) form.

-- ───────────── Tables (generated DDL, additive)
-- M36 · Released regional skill demand for Al Dhafra (SIMULATED): per catalogue area and horizon year, the working-level demand and gap bands across the three FS51 scenarios and the planning-scenario gap, cells of 1-9 suppressed; built only by rpc.releaseRegionalDemand from a released FS51 forecast (FS64)
create table if not exists kafaa_regional_demand (
  id text primary key,
  release_id text not null,
  forecast_id text not null,
  forecast_name text not null,
  cycle integer not null,
  region text not null default 'al_dhafra',
  scenario text not null check (scenario in ('baseline', 'advance', 'accelerated')),
  area text not null,
  year integer not null,
  demand_low integer,
  demand_high integer,
  gap_low integer,
  gap_high integer,
  gap_plan integer,
  skills_n integer not null default 0,
  withheld_n integer not null default 0,
  skill_ids text[] not null default '{}'::text[],
  suppressed boolean not null default false,
  note_en text not null default '',
  note_ar text not null default '',
  status text not null default 'current' check (status in ('current', 'superseded')),
  released boolean not null default true,
  released_by text not null,
  released_at timestamptz not null default now(),
  simulated boolean not null default true
);
comment on table kafaa_regional_demand is '[M36] Released regional skill demand for Al Dhafra (SIMULATED): per catalogue area and horizon year, the working-level demand and gap bands across the three FS51 scenarios and the planning-scenario gap, cells of 1-9 suppressed; built only by rpc.releaseRegionalDemand from a released FS51 forecast (FS64)';

-- M36 · A provider's commitment against the released regional demand: planned cohorts or course changes per academic term, delivery reported each term, ENEC acknowledgement; one organisation's rows (FS64)
create table if not exists kafaa_provider_commitments (
  id text primary key,
  org_id text not null,
  org_name_en text not null,
  org_name_ar text not null,
  org_kind text not null,
  release_id text not null,
  area text not null,
  kind text not null check (kind in ('cohort', 'course_change', 'new_course', 'apprenticeship')),
  title_en text not null,
  title_ar text not null,
  summary_en text not null,
  summary_ar text not null,
  skill_ids text[] not null default '{}'::text[],
  level integer not null,
  plan jsonb not null default '[]'::jsonb,
  delivery jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('active', 'withdrawn')),
  withdrawn_reason text,
  hr_status text not null default 'pending' check (hr_status in ('pending', 'acknowledged', 'queried')),
  hr_note text,
  hr_by text,
  hr_at timestamptz,
  version integer not null default 1,
  history jsonb not null default '[]'::jsonb,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_by text,
  updated_at timestamptz not null default now(),
  open_read boolean not null default false,
  sample boolean not null default false
);
comment on table kafaa_provider_commitments is '[M36] A provider''s commitment against the released regional demand: planned cohorts or course changes per academic term, delivery reported each term, ENEC acknowledgement; one organisation''s rows (FS64)';

-- M36 · A numeric upskilling pledge by one organisation: people x skill area x target date; pledged, started and completed are never merged (FS65)
create table if not exists kafaa_pledges (
  id text primary key,
  org_id text not null,
  org_name_en text not null,
  org_name_ar text not null,
  org_kind text not null,
  area text not null,
  people integer not null,
  target_date date not null,
  pledged_on date not null,
  title_en text not null,
  title_ar text not null,
  department_en text,
  department_ar text,
  status text not null default 'active' check (status in ('active', 'withdrawn')),
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  open_read boolean not null default false,
  sample boolean not null default false
);
comment on table kafaa_pledges is '[M36] A numeric upskilling pledge by one organisation: people x skill area x target date; pledged, started and completed are never merged (FS65)';

-- M36 · A dated progress snapshot of a pledge: people started and people completed, cumulative and never decreasing (FS65)
create table if not exists kafaa_pledge_progress (
  id text primary key,
  pledge_id text not null,
  org_id text not null,
  as_of date not null,
  started integer not null,
  completed integer not null,
  note_en text,
  note_ar text,
  reported_by text not null,
  reported_at timestamptz not null default now(),
  open_read boolean not null default false
);
comment on table kafaa_pledge_progress is '[M36] A dated progress snapshot of a pledge: people started and people completed, cumulative and never decreasing (FS65)';

do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_regional_demand_forecast_id_fk') then alter table kafaa_regional_demand add constraint kafaa_regional_demand_forecast_id_fk foreign key (forecast_id) references kafaa_skill_forecasts(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_provider_commitments_org_id_fk') then alter table kafaa_provider_commitments add constraint kafaa_provider_commitments_org_id_fk foreign key (org_id) references kafaa_organisations(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_pledges_org_id_fk') then alter table kafaa_pledges add constraint kafaa_pledges_org_id_fk foreign key (org_id) references kafaa_organisations(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_pledge_progress_pledge_id_fk') then alter table kafaa_pledge_progress add constraint kafaa_pledge_progress_pledge_id_fk foreign key (pledge_id) references kafaa_pledges(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_pledge_progress_org_id_fk') then alter table kafaa_pledge_progress add constraint kafaa_pledge_progress_org_id_fk foreign key (org_id) references kafaa_organisations(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_regional_demand_release_id_idx on kafaa_regional_demand (release_id);
create index if not exists kafaa_regional_demand_forecast_id_idx on kafaa_regional_demand (forecast_id);
create index if not exists kafaa_regional_demand_area_idx on kafaa_regional_demand (area);
create index if not exists kafaa_regional_demand_status_idx on kafaa_regional_demand (status);
create index if not exists kafaa_provider_commitments_org_id_idx on kafaa_provider_commitments (org_id);
create index if not exists kafaa_provider_commitments_area_idx on kafaa_provider_commitments (area);
create index if not exists kafaa_provider_commitments_status_idx on kafaa_provider_commitments (status);
create index if not exists kafaa_pledges_org_id_idx on kafaa_pledges (org_id);
create index if not exists kafaa_pledges_area_idx on kafaa_pledges (area);
create index if not exists kafaa_pledges_status_idx on kafaa_pledges (status);
create index if not exists kafaa_pledge_progress_pledge_id_idx on kafaa_pledge_progress (pledge_id);
create index if not exists kafaa_pledge_progress_org_id_idx on kafaa_pledge_progress (org_id);

-- one snapshot per pledge and date; numbers and the released-cell rule enforced in the database too
create unique index if not exists kafaa_pledge_progress_date_uq on kafaa_pledge_progress (pledge_id, as_of);
create unique index if not exists kafaa_regional_demand_cell_uq on kafaa_regional_demand (release_id, area, year);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'kafaa_regional_demand_cells_ck') then
    alter table kafaa_regional_demand add constraint kafaa_regional_demand_cells_ck check (simulated and released
      and (demand_low is null or demand_low = 0 or demand_low >= 10) and (demand_high is null or demand_high = 0 or demand_high >= 10)
      and (gap_low is null or gap_low = 0 or gap_low >= 10) and (gap_high is null or gap_high = 0 or gap_high >= 10) and (gap_plan is null or gap_plan = 0 or gap_plan >= 10)); end if;
  if not exists (select 1 from pg_constraint where conname = 'kafaa_pledges_people_ck') then
    alter table kafaa_pledges add constraint kafaa_pledges_people_ck check (people between 1 and 5000 and target_date > pledged_on); end if;
  if not exists (select 1 from pg_constraint where conname = 'kafaa_pledge_progress_numbers_ck') then
    alter table kafaa_pledge_progress add constraint kafaa_pledge_progress_numbers_ck check (started >= 0 and completed >= 0 and completed <= started); end if;
end $$;

-- ───────────── RLS (per-statement form). regional_demand: ecosystem R/W/A where released (every stored row is a released, suppressed
-- aggregate) or workforce_strategy Agg/R/W/A. The organisation tables: OwnOrg only for partners and universities (open_read is always
-- false, so the ecosystem R branch never applies) plus workforce_strategy R/W/A (HR analyst, HR director, admin, auditor).
alter table kafaa_regional_demand enable row level security;
alter table kafaa_provider_commitments enable row level security;
alter table kafaa_pledges enable row level security;
alter table kafaa_pledge_progress enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_regional_demand' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_regional_demand for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_provider_commitments' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_provider_commitments for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_pledges' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_pledges for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_pledge_progress' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_pledge_progress for select to anon, authenticated using (false)'; end if;
end $$;
alter policy kafaa_read on kafaa_regional_demand using ((((COALESCE(released, false) AND (SELECT kafaa_has_grant('ecosystem'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))) OR (SELECT kafaa_has_grant('workforce_strategy'::text, ARRAY['Agg'::text, 'R'::text, 'W'::text, 'A'::text]))));
alter policy kafaa_read on kafaa_provider_commitments using ((((COALESCE(open_read, false) AND (SELECT kafaa_has_grant('ecosystem'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((org_id = (SELECT kafaa_my_org())) AND (SELECT kafaa_has_grant('ecosystem'::text, ARRAY['OwnOrg'::text, 'OrgW'::text])))) OR (((SELECT kafaa_has_grant('workforce_strategy'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))))));
alter policy kafaa_read on kafaa_pledges using ((((COALESCE(open_read, false) AND (SELECT kafaa_has_grant('ecosystem'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((org_id = (SELECT kafaa_my_org())) AND (SELECT kafaa_has_grant('ecosystem'::text, ARRAY['OwnOrg'::text, 'OrgW'::text])))) OR (((SELECT kafaa_has_grant('workforce_strategy'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))))));
alter policy kafaa_read on kafaa_pledge_progress using ((((COALESCE(open_read, false) AND (SELECT kafaa_has_grant('ecosystem'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((org_id = (SELECT kafaa_my_org())) AND (SELECT kafaa_has_grant('ecosystem'::text, ARRAY['OwnOrg'::text, 'OrgW'::text])))) OR (((SELECT kafaa_has_grant('workforce_strategy'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))))));
revoke all on kafaa_regional_demand, kafaa_provider_commitments, kafaa_pledges, kafaa_pledge_progress from anon, authenticated;
grant select on kafaa_regional_demand, kafaa_provider_commitments, kafaa_pledges, kafaa_pledge_progress to anon, authenticated;

-- ═════════════ FS64 rules (mirror of src/modules/m36/regional.ts). Internal: not executable by API roles.
-- demandRows(): released rows from a released FS51 result (working level 2+; bands across the three scenarios; 1-9 suppressed)
create or replace function kafaa_rg_rows(p_results jsonb, p_plan text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  areas text[] := array['plant_systems', 'operations', 'maintenance', 'radiation_chemistry', 'engineering', 'safety', 'human_performance', 'emergency', 'quality', 'leadership', 'digital', 'project'];
  scs text[] := array['baseline', 'advance', 'accelerated'];
  yrs integer[] := array[2028, 2030, 2035];
  a text; y integer; yi integer; s text; k jsonb; ks jsonb[]; d numeric; g numeric; dv numeric; sv numeric; arr_d numeric[]; arr_g numeric[]; basis numeric; wn integer;
  plan_i integer; cells numeric[]; c numeric; outc jsonb; out jsonb := '[]'::jsonb; ids jsonb; small boolean; sup boolean; i integer;
  years jsonb := case when jsonb_typeof(p_results->'years') = 'array' then p_results->'years' else '[]'::jsonb end;
  skills jsonb := case when jsonb_typeof(p_results->'skills') = 'array' then p_results->'skills' else '[]'::jsonb end;
  withheld jsonb := case when jsonb_typeof(p_results->'suppressed') = 'array' then p_results->'suppressed' else '[]'::jsonb end;
begin
  plan_i := coalesce(array_position(scs, p_plan), 1);
  foreach a in array areas loop
    select coalesce(array_agg(x order by x->>'skill_id' collate "C"), '{}'::jsonb[]) into ks from jsonb_array_elements(skills) x where x->>'area' = a;
    select count(*)::integer into wn from jsonb_array_elements_text(withheld) w join kafaa_skills sk on sk.id = w where sk.area = a;
    if coalesce(array_length(ks, 1), 0) = 0 then continue; end if;
    basis := 0;
    foreach k in array ks loop basis := basis + coalesce((k->>'basis_n')::numeric, 0); end loop;
    select coalesce(jsonb_agg(to_jsonb(x->>'skill_id') order by x->>'skill_id' collate "C"), '[]'::jsonb) into ids from unnest(ks) x;
    foreach y in array yrs loop
      yi := null;
      for i in 0 .. jsonb_array_length(years) - 1 loop
        if (years->>i)::numeric = y then yi := i; exit; end if;
      end loop;
      if yi is null then continue; end if;
      arr_d := '{}'; arr_g := '{}';
      foreach s in array scs loop
        d := 0; g := 0;
        foreach k in array ks loop
          dv := coalesce((k->'sc'->s->'d'->yi->>1)::numeric, 0);
          sv := coalesce((k->'sc'->s->'s'->yi->>1)::numeric, 0);
          d := d + dv;
          g := g + greatest(0, dv - sv);
        end loop;
        arr_d := arr_d || d; arr_g := arr_g || g;
      end loop;
      small := basis < 10;
      cells := array[least(arr_d[1], arr_d[2], arr_d[3]), greatest(arr_d[1], arr_d[2], arr_d[3]), least(arr_g[1], arr_g[2], arr_g[3]), greatest(arr_g[1], arr_g[2], arr_g[3]), arr_g[plan_i]];
      sup := false;
      outc := '[]'::jsonb;
      foreach c in array cells loop
        if small or (c > 0 and c < 10) then outc := outc || 'null'::jsonb; sup := true; else outc := outc || to_jsonb(c::integer); end if;
      end loop;
      out := out || jsonb_build_array(jsonb_build_object('area', a, 'year', y, 'demand_low', outc->0, 'demand_high', outc->1, 'gap_low', outc->2, 'gap_high', outc->3,
        'gap_plan', outc->4, 'skills_n', array_length(ks, 1), 'withheld_n', wn, 'skill_ids', ids, 'suppressed', sup));
    end loop;
  end loop;
  return out;
end $$;

-- academic terms: "<y>S1" = 1 Sep y .. 31 Jan y+1; "<y>S2" = 1 Feb .. 31 Jul y+1
create or replace function kafaa_rg_term_ord(p text) returns integer language sql immutable set search_path = public as $$
  select case when p ~ '^20[0-9]{2}S[12]$' then substr(p, 1, 4)::integer * 2 + substr(p, 6, 1)::integer - 1 else -1 end
$$;
create or replace function kafaa_rg_term_of_ord(o integer) returns text language sql immutable set search_path = public as $$
  select (o / 2)::text || 'S' || ((o % 2) + 1)::text
$$;
create or replace function kafaa_rg_term_start(p text) returns date language sql immutable set search_path = public as $$
  select case when p !~ '^20[0-9]{2}S[12]$' then null when substr(p, 6, 1) = '1' then make_date(substr(p, 1, 4)::integer, 9, 1) else make_date(substr(p, 1, 4)::integer + 1, 2, 1) end
$$;
create or replace function kafaa_rg_term_end(p text) returns date language sql immutable set search_path = public as $$
  select case when p !~ '^20[0-9]{2}S[12]$' then null when substr(p, 6, 1) = '1' then make_date(substr(p, 1, 4)::integer + 1, 1, 31) else make_date(substr(p, 1, 4)::integer + 1, 7, 31) end
$$;
create or replace function kafaa_rg_term_state(p text, p_today date) returns text language sql immutable set search_path = public as $$
  select case when p_today < kafaa_rg_term_start(p) then 'future' when p_today > kafaa_rg_term_end(p) then 'past' else 'current' end
$$;
create or replace function kafaa_rg_first_open(p_today date) returns text language plpgsql immutable set search_path = public as $$
declare y integer := extract(year from p_today)::integer; o integer;
begin
  for o in (y - 1) * 2 .. (y + 2) * 2 - 1 loop
    if kafaa_rg_term_end(kafaa_rg_term_of_ord(o)) >= p_today then return kafaa_rg_term_of_ord(o); end if;
  end loop;
  return kafaa_rg_term_of_ord((y + 2) * 2);
end $$;
-- lockedTerms(): plan entries whose term has started (current or past)
create or replace function kafaa_rg_locked(p_plan jsonb, p_today date) returns jsonb language sql immutable set search_path = public as $$
  select coalesce(jsonb_agg(e order by n), '[]'::jsonb) from jsonb_array_elements(case when jsonb_typeof(p_plan) = 'array' then p_plan else '[]'::jsonb end) with ordinality q(e, n)
  where kafaa_rg_term_state(e->>'term', p_today) <> 'future'
$$;
create or replace function kafaa_rg_is_int(v jsonb) returns boolean language sql immutable set search_path = public as $$
  select coalesce(jsonb_typeof(v) = 'number' and (v #>> '{}')::numeric = floor((v #>> '{}')::numeric), false)
$$;
create or replace function kafaa_rg_txt(v jsonb) returns text language sql immutable set search_path = public as $$
  select case when jsonb_typeof(v) = 'string' then btrim(v #>> '{}', E' \t\n\r') else '' end
$$;

-- commitmentProblem(): area, kind, title, summary, skills, level, plan, locked
create or replace function kafaa_rg_commit_problem(p jsonb, p_areas text[], p_locked jsonb, p_today date) returns text language plpgsql stable security definer set search_path = public as $$
declare te text; ta text; se text; sa text; ids jsonb; e jsonb; o integer; prev integer := -1; v_open integer; l jsonb; sk record;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return 'area'; end if;
  if jsonb_typeof(p->'area') is distinct from 'string' or not ((p->>'area') = any(p_areas)) then return 'area'; end if;
  if jsonb_typeof(p->'kind') is distinct from 'string' or not ((p->>'kind') = any(array['cohort', 'course_change', 'new_course', 'apprenticeship'])) then return 'kind'; end if;
  te := kafaa_rg_txt(p->'title_en'); ta := kafaa_rg_txt(p->'title_ar');
  if char_length(te) < 5 or char_length(te) > 160 or char_length(ta) < 5 or char_length(ta) > 160 or ta !~ '[؀-ۿ]' then return 'title'; end if;
  se := kafaa_rg_txt(p->'summary_en'); sa := kafaa_rg_txt(p->'summary_ar');
  if char_length(se) < 10 or char_length(se) > 600 or char_length(sa) < 10 or char_length(sa) > 600 or sa !~ '[؀-ۿ]' then return 'summary'; end if;
  ids := p->'skill_ids';
  if jsonb_typeof(ids) is distinct from 'array' or jsonb_array_length(ids) > 8 or (select count(distinct x) from jsonb_array_elements(ids) x) <> jsonb_array_length(ids) then return 'skills'; end if;
  for e in select * from jsonb_array_elements(ids) loop
    if jsonb_typeof(e) <> 'string' then return 'skills'; end if;
    select id, area, lifecycle into sk from kafaa_skills where id = e #>> '{}';
    if sk.id is null or coalesce(sk.lifecycle, '') = 'obsolete' or coalesce(sk.area, '') = 'security' then return 'skills'; end if;
  end loop;
  if not kafaa_rg_is_int(p->'level') or (p->>'level')::numeric < 1 or (p->>'level')::numeric > 4 then return 'level'; end if;
  if jsonb_typeof(p->'plan') is distinct from 'array' or jsonb_array_length(p->'plan') < 1 or jsonb_array_length(p->'plan') > 8 then return 'plan'; end if;
  v_open := kafaa_rg_term_ord(kafaa_rg_first_open(p_today));
  for e in select * from jsonb_array_elements(p->'plan') loop
    if jsonb_typeof(e) <> 'object' or jsonb_typeof(e->'term') is distinct from 'string' or (e->>'term') !~ '^20[0-9]{2}S[12]$' or not kafaa_rg_is_int(e->'seats')
      or (e->>'seats')::numeric < 1 or (e->>'seats')::numeric > 500 then return 'plan'; end if;
    o := kafaa_rg_term_ord(e->>'term');
    if o <= prev or o > kafaa_rg_term_ord('2030S2') then return 'plan'; end if;
    prev := o;
    if o < v_open and not exists (select 1 from jsonb_array_elements(coalesce(p_locked, '[]'::jsonb)) x where x->>'term' = e->>'term') then return 'plan'; end if;
  end loop;
  for l in select * from jsonb_array_elements(coalesce(p_locked, '[]'::jsonb)) loop
    if not exists (select 1 from jsonb_array_elements(p->'plan') x where x->>'term' = l->>'term' and (x->>'seats')::numeric = (l->>'seats')::numeric) then return 'locked'; end if;
  end loop;
  return null;
end $$;

-- deliveryProblem(): term of the plan, started, enrolled 0-1000 and completed 0..enrolled
create or replace function kafaa_rg_delivery_problem(p jsonb, p_plan jsonb, p_today date) returns text language plpgsql immutable set search_path = public as $$
begin
  if p is null or jsonb_typeof(p->'term') is distinct from 'string'
    or not exists (select 1 from jsonb_array_elements(case when jsonb_typeof(p_plan) = 'array' then p_plan else '[]'::jsonb end) x where x->>'term' = p->>'term') then return 'term'; end if;
  if kafaa_rg_term_state(p->>'term', p_today) = 'future' then return 'future'; end if;
  if not kafaa_rg_is_int(p->'enrolled') or not kafaa_rg_is_int(p->'completed') or (p->>'enrolled')::numeric < 0 or (p->>'enrolled')::numeric > 1000
    or (p->>'completed')::numeric < 0 or (p->>'completed')::numeric > (p->>'enrolled')::numeric then return 'numbers'; end if;
  return null;
end $$;

-- commitmentView().status: withdrawn | behind | at_risk | delivered | not_started | on_track
create or replace function kafaa_rg_status(p_plan jsonb, p_delivery jsonb, p_status text, p_today date) returns text language plpgsql immutable set search_path = public as $$
declare e jsonb; r jsonb; st text; pct integer; ts text; n integer := 0; bad integer := 0; warn integer := 0; past integer := 0; fut integer := 0;
begin
  if p_status = 'withdrawn' then return 'withdrawn'; end if;
  for e in select * from jsonb_array_elements(case when jsonb_typeof(p_plan) = 'array' then p_plan else '[]'::jsonb end) loop
    n := n + 1;
    select x into r from jsonb_array_elements(case when jsonb_typeof(p_delivery) = 'array' then p_delivery else '[]'::jsonb end) x where x->>'term' = e->>'term' limit 1;
    st := kafaa_rg_term_state(e->>'term', p_today);
    pct := case when r is null or not kafaa_rg_is_int(r->'enrolled') then null when (e->>'seats')::numeric > 0 then round((r->>'enrolled')::numeric * 100 / (e->>'seats')::numeric)::integer else 0 end;
    if st = 'future' then ts := 'planned'; fut := fut + 1;
    elsif st = 'current' then ts := case when pct is null then 'awaiting_report' when pct >= 90 then 'on_track' when pct >= 60 then 'at_risk' else 'behind' end;
    else ts := case when pct is null then 'not_reported' when pct >= 90 then 'delivered' when pct >= 60 then 'partly' else 'missed' end; past := past + 1; end if;
    if ts in ('missed', 'not_reported', 'behind') then bad := bad + 1; elsif ts in ('partly', 'at_risk') then warn := warn + 1; end if;
    r := null;
  end loop;
  if bad > 0 then return 'behind'; end if;
  if warn > 0 then return 'at_risk'; end if;
  if n > 0 and past = n then return 'delivered'; end if;
  if fut = n then return 'not_started'; end if;
  return 'on_track';
end $$;

-- ═════════════ FS65 rules (mirror of src/modules/m36/pledges.ts). Internal.
create or replace function kafaa_pl_date(v jsonb) returns date language plpgsql immutable set search_path = public as $$
declare s text; d date;
begin
  if jsonb_typeof(v) is distinct from 'string' then return null; end if;
  s := v #>> '{}';
  if s !~ '^\d{4}-\d{2}-\d{2}$' then return null; end if;
  begin d := s::date; exception when others then return null; end;
  if to_char(d, 'YYYY-MM-DD') <> s then return null; end if;
  return d;
end $$;
-- pledgeProblem(): area, people, date, title, department
create or replace function kafaa_pl_problem(p jsonb, p_today date) returns text language plpgsql immutable set search_path = public as $$
declare d date; te text; ta text; de text; da text;
begin
  if p is null or jsonb_typeof(p) <> 'object' or jsonb_typeof(p->'area') is distinct from 'string' or not ((p->>'area') = any(array['plant_systems', 'operations', 'maintenance', 'radiation_chemistry',
    'engineering', 'safety', 'human_performance', 'emergency', 'quality', 'leadership', 'digital', 'project', 'ai_data', 'digital_plant', 'green_energy', 'advanced_reactor', 'cyber_hygiene', 'transversal'])) then return 'area'; end if;
  if not kafaa_rg_is_int(p->'people') or (p->>'people')::numeric < 1 or (p->>'people')::numeric > 5000 then return 'people'; end if;
  d := kafaa_pl_date(p->'target_date');
  if d is null or d < p_today + 30 or d > date '2035-12-31' then return 'date'; end if;
  te := kafaa_rg_txt(p->'title_en'); ta := kafaa_rg_txt(p->'title_ar');
  if char_length(te) < 5 or char_length(te) > 160 or char_length(ta) < 5 or char_length(ta) > 160 or ta !~ '[؀-ۿ]' then return 'title'; end if;
  de := kafaa_rg_txt(p->'department_en'); da := kafaa_rg_txt(p->'department_ar');
  if (de = '') <> (da = '') or char_length(de) > 120 or char_length(da) > 120 or (da <> '' and da !~ '[؀-ۿ]') then return 'department'; end if;
  return null;
end $$;
-- progressProblem(): date, numbers, order, decrease (p_prev = {as_of, started, completed} or null)
create or replace function kafaa_pl_progress_problem(p jsonb, p_pledged_on date, p_prev jsonb, p_today date) returns text language plpgsql immutable set search_path = public as $$
declare d date := kafaa_pl_date(p->'as_of');
begin
  if p is null or d is null or d < p_pledged_on or d > p_today then return 'date'; end if;
  if not kafaa_rg_is_int(p->'started') or not kafaa_rg_is_int(p->'completed') or (p->>'started')::numeric < 0 or (p->>'started')::numeric > 100000
    or (p->>'completed')::numeric < 0 or (p->>'completed')::numeric > (p->>'started')::numeric then return 'numbers'; end if;
  if p_prev is not null and jsonb_typeof(p_prev) = 'object' then
    if d <= (p_prev->>'as_of')::date then return 'order'; end if;
    if (p->>'started')::numeric < (p_prev->>'started')::numeric or (p->>'completed')::numeric < (p_prev->>'completed')::numeric then return 'decrease'; end if;
  end if;
  return null;
end $$;
-- pledgeStatus()
create or replace function kafaa_pl_status(p_people integer, p_target date, p_status text, p_started integer, p_completed integer, p_today date) returns text language sql immutable set search_path = public as $$
  select case when p_status = 'withdrawn' then 'withdrawn' when coalesce(p_completed, 0) >= p_people then 'met' when p_target < p_today then 'lapsed'
    when coalesce(p_started, 0) = 0 then 'not_started' else 'in_progress' end
$$;
-- one ledger cell: suppressed under two organisations or 1-9 people; pledge counts only by the organisation rule (0 stays 0)
create or replace function kafaa_pl_cell(v bigint, orgs bigint) returns jsonb language sql immutable set search_path = public as $$
  select case when orgs < 2 or (v > 0 and v < 10) then jsonb_build_object('value', null, 'suppressed', true) else jsonb_build_object('value', v, 'suppressed', false) end
$$;
create or replace function kafaa_pl_count(v bigint, orgs bigint) returns jsonb language sql immutable set search_path = public as $$
  select case when v > 0 and orgs < 2 then jsonb_build_object('value', null, 'suppressed', true) else jsonb_build_object('value', v, 'suppressed', false) end
$$;
-- pledgeLedger(): totals, by area, by organisation type, by target year, statuses (active pledges; latest snapshot on or before the day)
create or replace function kafaa_pl_ledger(p_today date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  with it as (
    select p.id, p.org_id, p.area, substr(p.target_date::text, 1, 4) as yr,
      case p.org_kind when 'group_entity' then 'enec' when 'supplier' then 'supplier' when 'university' then 'university' else 'partner' end as typ,
      p.people::bigint as pledged, coalesce(l.started, 0)::bigint as started, coalesce(l.completed, 0)::bigint as completed,
      kafaa_pl_status(p.people, p.target_date, p.status, l.started, l.completed, p_today) as st
    from kafaa_pledges p
    left join lateral (select x.started, x.completed from kafaa_pledge_progress x where x.pledge_id = p.id and x.as_of <= p_today order by x.as_of desc limit 1) l on true
    where p.status <> 'withdrawn'
  ), grp as (
    select g.dim, g.key, count(*) as n, count(distinct it.org_id) as orgs, sum(it.pledged)::bigint as pl, sum(it.started)::bigint as stt, sum(it.completed)::bigint as co
    from it cross join lateral (values ('all', 'all'), ('area', it.area), ('type', it.typ), ('year', it.yr)) g(dim, key)
    group by g.dim, g.key
  ), obj as (
    select dim, key, jsonb_build_object('key', key, 'pledged', kafaa_pl_cell(pl, orgs), 'started', kafaa_pl_cell(stt, orgs), 'completed', kafaa_pl_cell(co, orgs), 'pledges', n, 'orgs', orgs) as o
    from grp
  )
  select jsonb_build_object(
    'as_of', p_today::text, 'min_group', 10, 'min_orgs', 2,
    'totals', coalesce((select o from obj where dim = 'all'), jsonb_build_object('key', 'all', 'pledged', kafaa_pl_cell(0, 0), 'started', kafaa_pl_cell(0, 0), 'completed', kafaa_pl_cell(0, 0), 'pledges', 0, 'orgs', 0)),
    'by_area', coalesce((select jsonb_agg(o order by array_position(array['plant_systems', 'operations', 'maintenance', 'radiation_chemistry', 'engineering', 'safety', 'human_performance', 'emergency',
      'quality', 'leadership', 'digital', 'project', 'ai_data', 'digital_plant', 'green_energy', 'advanced_reactor', 'cyber_hygiene', 'transversal'], key)) from obj where dim = 'area'), '[]'::jsonb),
    'by_type', coalesce((select jsonb_agg(o order by array_position(array['enec', 'supplier', 'university', 'partner'], key)) from obj where dim = 'type'), '[]'::jsonb),
    'by_year', coalesce((select jsonb_agg(o order by key collate "C") from obj where dim = 'year'), '[]'::jsonb),
    'statuses', (select jsonb_agg(jsonb_build_object('key', s.key, 'pledges', kafaa_pl_count(coalesce(c.n, 0), coalesce(c.orgs, 0))) order by s.ord)
      from (values ('met', 1), ('in_progress', 2), ('not_started', 3), ('lapsed', 4)) s(key, ord)
      left join (select st, count(*) as n, count(distinct org_id) as orgs from it group by st) c on c.st = s.key)
  ) into v;
  return v;
end $$;

-- ═════════════ RPCs
-- FS64: the HR director releases a released FS51 forecast to providers as regional aggregates (audit + ledger)
create or replace function kafaa_release_regional_demand(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; v_fid text := case when jsonb_typeof(p->'forecast_id') = 'string' then p->>'forecast_id' else '' end; f kafaa_skill_forecasts;
  v_en text := kafaa_rg_txt(p->'note_en'); v_ar text := kafaa_rg_txt(p->'note_ar'); v_rows jsonb; r jsonb; v_n integer; v_rid text; v_prev text; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('regional.release', 'regional_demand', nullif(v_fid, ''), 'not_signed_in', 'Sign in to use the regional skills plan'); end if;
  if not kafaa_has_grant('workforce_strategy', array['A']) or not kafaa_has_grant('ecosystem', array['W', 'A']) then
    return kafaa_refuse('regional.release', 'regional_demand', nullif(v_fid, ''), 'forbidden', 'Only the HR director releases regional demand to providers'); end if;
  v_role := kafaa_acting_role('workforce_strategy', array['A']);
  select * into f from kafaa_skill_forecasts where id = v_fid;
  if f.id is null then return kafaa_refuse('regional.release', 'regional_demand', nullif(v_fid, ''), 'not_found', 'Skill forecast not found', v_role); end if;
  if f.status <> 'released' then return kafaa_refuse('regional.release', 'regional_demand', v_fid, 'not_released', 'Only a released skill forecast can be shared with providers', v_role); end if;
  if char_length(v_en) < 10 or char_length(v_en) > 400 or char_length(v_ar) < 10 or char_length(v_ar) > 400 then
    return kafaa_refuse('regional.release', 'regional_demand', v_fid, 'invalid', 'Write a note of 10 to 400 characters in English and in Arabic', v_role); end if;
  if not kafaa_so_text_clean(array[v_en, v_ar]) then
    return kafaa_refuse('regional.release', 'regional_demand', v_fid, 'not_clean', 'Release text may not state headcounts or site information (M11 rule)', v_role); end if;
  if exists (select 1 from kafaa_regional_demand where status = 'current' and forecast_id = v_fid) then
    return kafaa_refuse('regional.release', 'regional_demand', v_fid, 'already_current', 'This forecast is already the current regional release', v_role); end if;
  v_rows := kafaa_rg_rows(f.results, f.scenario);
  if jsonb_array_length(v_rows) = 0 then return kafaa_refuse('regional.release', 'regional_demand', v_fid, 'empty', 'This forecast has no skill area that can be released', v_role); end if;
  select count(distinct release_id)::integer + 1 into v_n from kafaa_regional_demand where cycle = f.cycle;
  v_rid := 'rdr-' || f.cycle || '-' || v_n;
  select string_agg(x, ',' order by x collate "C") into v_prev from (select distinct release_id as x from kafaa_regional_demand where status = 'current') q;
  update kafaa_regional_demand set status = 'superseded' where status = 'current';
  for r in select * from jsonb_array_elements(v_rows) loop
    insert into kafaa_regional_demand (id, release_id, forecast_id, forecast_name, cycle, region, scenario, area, year, demand_low, demand_high, gap_low, gap_high, gap_plan, skills_n, withheld_n,
      skill_ids, suppressed, note_en, note_ar, status, released, released_by, released_at, simulated)
    values (v_rid || '-' || (r->>'area') || '-' || (r->>'year'), v_rid, v_fid, f.name, f.cycle, 'al_dhafra', f.scenario, r->>'area', (r->>'year')::integer,
      (r->>'demand_low')::integer, (r->>'demand_high')::integer, (r->>'gap_low')::integer, (r->>'gap_high')::integer, (r->>'gap_plan')::integer, (r->>'skills_n')::integer, (r->>'withheld_n')::integer,
      (select coalesce(array_agg(x order by n), '{}'::text[]) from jsonb_array_elements_text(r->'skill_ids') with ordinality q(x, n)), (r->>'suppressed')::boolean, v_en, v_ar, 'current', true, me, now(), true);
  end loop;
  l := kafaa_ledger('kafaa.ecosystem.demand_release', 'Regional skill demand released to providers: ' || f.name);
  a := kafaa_audit('regional.release', 'regional_demand', v_rid, 'ok', v_fid || ' ' || jsonb_array_length(v_rows) || ' rows' || coalesce(' supersedes ' || v_prev, ''),
    case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Regional demand released to providers', a, l, jsonb_build_object('release_id', v_rid, 'rows', jsonb_array_length(v_rows), 'superseded', v_prev));
end $$;

-- FS64: a partner or university administrator creates, revises or withdraws a commitment for their own organisation (audit + ledger)
create or replace function kafaa_commit_provision(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_org text := kafaa_my_org(); v_role text; v_given text := case when jsonb_typeof(p->'id') = 'string' and p->>'id' <> '' then p->>'id' end;
  v_action text; v_areas text[]; v_problem text; o kafaa_organisations; v_id text; v_n integer; v_rel text; v_plan jsonb; v_ts text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  cur kafaa_provider_commitments; v_reason text; v_version integer; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('commitment.commit', 'provider_commitments', v_given, 'not_signed_in', 'Sign in to use the regional skills plan'); end if;
  if v_org is null or not kafaa_has_grant('ecosystem', array['OrgW']) then
    return kafaa_refuse('commitment.commit', 'provider_commitments', v_given, 'forbidden', 'Only a partner or university administrator commits provision for their own organisation'); end if;
  v_role := kafaa_acting_role('ecosystem', array['OrgW']);
  v_action := case when p->'action' is null or jsonb_typeof(p->'action') = 'null' then case when v_given is null then 'create' else 'revise' end
                   when jsonb_typeof(p->'action') = 'string' then p->>'action' else '?' end;
  if not (v_action = any(array['create', 'revise', 'withdraw'])) or (v_action = 'create') <> (v_given is null) then
    return kafaa_refuse('commitment.commit', 'provider_commitments', v_given, 'invalid', 'Choose create, revise or withdraw', v_role); end if;
  v_plan := (select coalesce(jsonb_agg(jsonb_build_object('term', e->>'term', 'seats', (e->>'seats')::integer) order by n), '[]'::jsonb)
             from jsonb_array_elements(case when jsonb_typeof(p->'plan') = 'array' then p->'plan' else '[]'::jsonb end) with ordinality q(e, n) where jsonb_typeof(e) = 'object' and kafaa_rg_is_int(e->'seats'));
  if v_action = 'create' then
    select coalesce(array_agg(distinct area), '{}'::text[]) into v_areas from kafaa_regional_demand where status = 'current';
    if coalesce(array_length(v_areas, 1), 0) = 0 then return kafaa_refuse('commitment.commit', 'provider_commitments', v_given, 'no_release', 'No regional demand has been released yet', v_role); end if;
    v_problem := kafaa_rg_commit_problem(p, v_areas, '[]'::jsonb, current_date);
    if v_problem is not null then return kafaa_refuse('commitment.commit', 'provider_commitments', v_given, 'invalid', 'Check the commitment: ' || case v_problem
      when 'area' then 'choose a skill area of the current regional release' when 'kind' then 'choose cohort, course change, new course or apprenticeship'
      when 'title' then 'a title of 5 to 160 characters in English and in Arabic' when 'summary' then 'a summary of 10 to 600 characters in English and in Arabic'
      when 'skills' then 'up to eight distinct catalogue skills that are current and not security skills' when 'level' then 'a target level from 1 to 4'
      when 'plan' then 'one to eight academic terms in order, from the current term to 2030S2, each with 1 to 500 seats' else 'terms that have started keep their planned seats' end, v_role); end if;
    select * into o from kafaa_organisations where id = v_org;
    select count(*)::integer + 1 into v_n from kafaa_provider_commitments where org_id = v_org;
    while exists (select 1 from kafaa_provider_commitments where id = 'pc-' || v_org || '-' || v_n) loop v_n := v_n + 1; end loop;
    v_id := 'pc-' || v_org || '-' || v_n;
    select release_id into v_rel from kafaa_regional_demand where status = 'current' limit 1;
    insert into kafaa_provider_commitments (id, org_id, org_name_en, org_name_ar, org_kind, release_id, area, kind, title_en, title_ar, summary_en, summary_ar, skill_ids, level, plan, delivery,
      status, withdrawn_reason, hr_status, version, history, created_by, created_at, updated_by, updated_at, open_read, sample)
    values (v_id, v_org, coalesce(o.name_en, v_org), coalesce(o.name_ar, v_org), coalesce(o.kind, 'partner'), v_rel, p->>'area', p->>'kind', kafaa_rg_txt(p->'title_en'), kafaa_rg_txt(p->'title_ar'),
      kafaa_rg_txt(p->'summary_en'), kafaa_rg_txt(p->'summary_ar'), (select coalesce(array_agg(x order by n), '{}'::text[]) from jsonb_array_elements_text(p->'skill_ids') with ordinality q(x, n)),
      (p->>'level')::integer, v_plan, '[]'::jsonb, 'active', null, 'pending', 1,
      jsonb_build_array(jsonb_build_object('action', 'create', 'version', 1, 'at', v_ts, 'by', me, 'plan', v_plan)), me, now(), me, now(), false, false);
    l := kafaa_ledger('kafaa.ecosystem.commitment', 'Provider commitment created: ' || kafaa_rg_txt(p->'title_en'));
    a := kafaa_audit('commitment.commit', 'provider_commitments', v_id, 'ok', 'create ' || (p->>'area') || ' ' || (p->>'kind'), case when l is null then 'skipped' else 'written' end, l, v_role);
    return kafaa_result(true, 'ok', 'Commitment recorded', a, l, jsonb_build_object('id', v_id, 'version', 1, 'status', 'active'));
  end if;
  select * into cur from kafaa_provider_commitments where id = v_given;
  if cur.id is null or cur.org_id <> v_org then return kafaa_refuse('commitment.commit', 'provider_commitments', v_given, 'not_found', 'Commitment not found', v_role); end if;
  if cur.status <> 'active' then return kafaa_refuse('commitment.commit', 'provider_commitments', v_given, 'withdrawn', 'A withdrawn commitment cannot change', v_role); end if;
  if v_action = 'withdraw' then
    v_reason := kafaa_rg_txt(p->'reason');
    if char_length(v_reason) < 5 or char_length(v_reason) > 300 then return kafaa_refuse('commitment.commit', 'provider_commitments', v_given, 'invalid', 'Give a reason of 5 to 300 characters', v_role); end if;
    update kafaa_provider_commitments set status = 'withdrawn', withdrawn_reason = v_reason,
      history = coalesce(cur.history, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('action', 'withdraw', 'version', cur.version, 'at', v_ts, 'by', me, 'reason', v_reason)),
      updated_by = me, updated_at = now() where id = cur.id;
    l := kafaa_ledger('kafaa.ecosystem.commitment', 'Provider commitment withdrawn: ' || cur.title_en);
    a := kafaa_audit('commitment.commit', 'provider_commitments', cur.id, 'ok', 'withdraw: ' || v_reason, case when l is null then 'skipped' else 'written' end, l, v_role);
    return kafaa_result(true, 'ok', 'Commitment withdrawn', a, l, jsonb_build_object('id', cur.id, 'version', cur.version, 'status', 'withdrawn'));
  end if;
  select coalesce(array_agg(distinct area), '{}'::text[]) into v_areas from kafaa_regional_demand where status = 'current';
  if not (cur.area = any(v_areas)) then v_areas := v_areas || cur.area; end if;
  v_problem := kafaa_rg_commit_problem(p, v_areas, kafaa_rg_locked(cur.plan, current_date), current_date);
  if v_problem is not null then return kafaa_refuse('commitment.commit', 'provider_commitments', v_given, 'invalid', 'Check the commitment: ' || case v_problem
    when 'area' then 'choose a skill area of the current regional release' when 'kind' then 'choose cohort, course change, new course or apprenticeship'
    when 'title' then 'a title of 5 to 160 characters in English and in Arabic' when 'summary' then 'a summary of 10 to 600 characters in English and in Arabic'
    when 'skills' then 'up to eight distinct catalogue skills that are current and not security skills' when 'level' then 'a target level from 1 to 4'
    when 'plan' then 'one to eight academic terms in order, from the current term to 2030S2, each with 1 to 500 seats' else 'terms that have started keep their planned seats' end, v_role); end if;
  v_version := cur.version + 1;
  update kafaa_provider_commitments set area = p->>'area', kind = p->>'kind', title_en = kafaa_rg_txt(p->'title_en'), title_ar = kafaa_rg_txt(p->'title_ar'),
    summary_en = kafaa_rg_txt(p->'summary_en'), summary_ar = kafaa_rg_txt(p->'summary_ar'),
    skill_ids = (select coalesce(array_agg(x order by n), '{}'::text[]) from jsonb_array_elements_text(p->'skill_ids') with ordinality q(x, n)), level = (p->>'level')::integer, plan = v_plan,
    delivery = (select coalesce(jsonb_agg(d order by n), '[]'::jsonb) from jsonb_array_elements(coalesce(cur.delivery, '[]'::jsonb)) with ordinality q(d, n)
                where exists (select 1 from jsonb_array_elements(v_plan) x where x->>'term' = d->>'term')),
    hr_status = 'pending', version = v_version,
    history = coalesce(cur.history, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('action', 'revise', 'version', v_version, 'at', v_ts, 'by', me, 'plan', v_plan)),
    updated_by = me, updated_at = now() where id = cur.id;
  l := kafaa_ledger('kafaa.ecosystem.commitment', 'Provider commitment revised: ' || kafaa_rg_txt(p->'title_en'));
  a := kafaa_audit('commitment.commit', 'provider_commitments', cur.id, 'ok', 'revise v' || v_version, case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Commitment revised', a, l, jsonb_build_object('id', cur.id, 'version', v_version, 'status', 'active'));
end $$;

-- FS64: the provider reports one started term's delivery (audited)
create or replace function kafaa_report_commitment_delivery(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_org text := kafaa_my_org(); v_role text; v_cid text := case when jsonb_typeof(p->'commitment_id') = 'string' then p->>'commitment_id' else '' end;
  cur kafaa_provider_commitments; v_problem text; v_note text; v_entry jsonb; v_del jsonb; v_status text; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('commitment.delivery', 'provider_commitments', nullif(v_cid, ''), 'not_signed_in', 'Sign in to use the regional skills plan'); end if;
  if v_org is null or not kafaa_has_grant('ecosystem', array['OrgW']) then
    return kafaa_refuse('commitment.delivery', 'provider_commitments', nullif(v_cid, ''), 'forbidden', 'Only the provider''s administrator reports delivery'); end if;
  v_role := kafaa_acting_role('ecosystem', array['OrgW']);
  select * into cur from kafaa_provider_commitments where id = v_cid;
  if cur.id is null or cur.org_id <> v_org then return kafaa_refuse('commitment.delivery', 'provider_commitments', nullif(v_cid, ''), 'not_found', 'Commitment not found', v_role); end if;
  if cur.status <> 'active' then return kafaa_refuse('commitment.delivery', 'provider_commitments', v_cid, 'withdrawn', 'A withdrawn commitment cannot change', v_role); end if;
  v_problem := kafaa_rg_delivery_problem(p, cur.plan, current_date);
  if v_problem is not null then return kafaa_refuse('commitment.delivery', 'provider_commitments', v_cid, 'invalid', 'Check the delivery report: ' || case v_problem
    when 'term' then 'choose a term of the plan' when 'future' then 'a term that has not started cannot be reported' else 'enrolled from 0 to 1000 and completed from 0 to the number enrolled' end, v_role); end if;
  v_note := left(kafaa_rg_txt(p->'note'), 300);
  v_entry := jsonb_build_object('term', p->>'term', 'enrolled', (p->>'enrolled')::integer, 'completed', (p->>'completed')::integer, 'note', nullif(v_note, ''), 'reported_by', me,
    'reported_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
  select coalesce(jsonb_agg(x order by n), '[]'::jsonb) into v_del from (
    select n, case when e->>'term' = p->>'term' then v_entry
                   else (select d from jsonb_array_elements(coalesce(cur.delivery, '[]'::jsonb)) d where d->>'term' = e->>'term' limit 1) end as x
    from jsonb_array_elements(cur.plan) with ordinality q(e, n)) z where x is not null;
  update kafaa_provider_commitments set delivery = v_del, updated_by = me, updated_at = now() where id = cur.id;
  v_status := kafaa_rg_status(cur.plan, v_del, 'active', current_date);
  a := kafaa_audit('commitment.delivery', 'provider_commitments', cur.id, 'ok', (p->>'term') || ' enrolled ' || (p->>'enrolled') || ' completed ' || (p->>'completed'), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Delivery reported', a, null, jsonb_build_object('id', cur.id, 'term', p->>'term', 'status', v_status));
end $$;

-- FS64: HR acknowledges or queries a commitment (audited)
create or replace function kafaa_review_commitment(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; v_cid text := case when jsonb_typeof(p->'commitment_id') = 'string' then p->>'commitment_id' else '' end;
  cur kafaa_provider_commitments; v_note text := kafaa_rg_txt(p->'note'); v_dec text := case when jsonb_typeof(p->'decision') = 'string' then p->>'decision' else '' end; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('commitment.review', 'provider_commitments', nullif(v_cid, ''), 'not_signed_in', 'Sign in to use the regional skills plan'); end if;
  if not kafaa_has_grant('ecosystem', array['W', 'A']) then return kafaa_refuse('commitment.review', 'provider_commitments', nullif(v_cid, ''), 'forbidden', 'Only HR reviews provider commitments'); end if;
  v_role := kafaa_acting_role('ecosystem', array['W', 'A']);
  select * into cur from kafaa_provider_commitments where id = v_cid;
  if cur.id is null then return kafaa_refuse('commitment.review', 'provider_commitments', nullif(v_cid, ''), 'not_found', 'Commitment not found', v_role); end if;
  if cur.status <> 'active' then return kafaa_refuse('commitment.review', 'provider_commitments', v_cid, 'withdrawn', 'A withdrawn commitment cannot change', v_role); end if;
  if v_dec not in ('acknowledged', 'queried') or char_length(v_note) > 400 or (v_dec = 'queried' and char_length(v_note) < 5) then
    return kafaa_refuse('commitment.review', 'provider_commitments', v_cid, 'invalid', 'Choose acknowledged or queried; a query needs a note of 5 to 400 characters', v_role); end if;
  update kafaa_provider_commitments set hr_status = v_dec, hr_note = nullif(v_note, ''), hr_by = me, hr_at = now() where id = cur.id;
  a := kafaa_audit('commitment.review', 'provider_commitments', cur.id, 'ok', v_dec || case when v_note <> '' then ': ' || v_note else '' end, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when v_dec = 'acknowledged' then 'Commitment acknowledged' else 'Query sent to the provider' end, a, null, jsonb_build_object('id', cur.id, 'hr_status', v_dec));
end $$;

-- FS65: register a pledge (OrgW for the own organisation; ecosystem W for an ENEC entity; audit + ledger)
create or replace function kafaa_register_pledge(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_mine text := kafaa_my_org(); v_given text := case when jsonb_typeof(p->'org_id') = 'string' and p->>'org_id' <> '' then p->>'org_id' end;
  v_org text; v_role text; v_problem text; o kafaa_organisations; v_id text; v_n integer; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('pledge.register', 'pledges', null, 'not_signed_in', 'Sign in to use the skills pledges ledger'); end if;
  if v_mine is not null and kafaa_has_grant('ecosystem', array['OrgW']) then
    v_role := kafaa_acting_role('ecosystem', array['OrgW']);
    if v_given is not null and v_given <> v_mine then
      return kafaa_refuse('pledge.register', 'pledges', null, 'org', 'HR registers pledges for ENEC entities only; partners and universities register for their own organisation', v_role); end if;
    v_org := v_mine;
  elsif kafaa_has_grant('ecosystem', array['W']) then
    v_role := kafaa_acting_role('ecosystem', array['W']);
    if v_given is null or not (v_given = any(array['enec', 'enec-ops', 'enec-com', 'enec-con'])) or (select kind from kafaa_organisations where id = v_given) is distinct from 'group_entity' then
      return kafaa_refuse('pledge.register', 'pledges', null, 'org', 'HR registers pledges for ENEC entities only; partners and universities register for their own organisation', v_role); end if;
    v_org := v_given;
  else
    return kafaa_refuse('pledge.register', 'pledges', null, 'forbidden', 'Only a partner or university administrator (own organisation) or HR (ENEC entities) registers pledges');
  end if;
  v_problem := kafaa_pl_problem(p, current_date);
  if v_problem is not null then return kafaa_refuse('pledge.register', 'pledges', null, 'invalid', 'Check the pledge: ' || case v_problem
    when 'area' then 'choose a skill area' when 'people' then 'a whole number of people from 1 to 5000' when 'date' then 'a target date at least 30 days ahead and no later than 31 Dec 2035'
    when 'title' then 'a title of 5 to 160 characters in English and in Arabic' else 'a department name in English and in Arabic (up to 120 characters), or neither' end, v_role); end if;
  select * into o from kafaa_organisations where id = v_org;
  select count(*)::integer + 1 into v_n from kafaa_pledges where org_id = v_org;
  while exists (select 1 from kafaa_pledges where id = 'pl-' || v_org || '-' || v_n) loop v_n := v_n + 1; end loop;
  v_id := 'pl-' || v_org || '-' || v_n;
  insert into kafaa_pledges (id, org_id, org_name_en, org_name_ar, org_kind, area, people, target_date, pledged_on, title_en, title_ar, department_en, department_ar, status, created_by, created_at, updated_at, open_read, sample)
  values (v_id, v_org, coalesce(o.name_en, v_org), coalesce(o.name_ar, v_org), coalesce(o.kind, 'partner'), p->>'area', (p->>'people')::integer, (p->>'target_date')::date, current_date,
    kafaa_rg_txt(p->'title_en'), kafaa_rg_txt(p->'title_ar'), nullif(kafaa_rg_txt(p->'department_en'), ''), nullif(kafaa_rg_txt(p->'department_ar'), ''), 'active', me, now(), now(), false, false);
  l := kafaa_ledger('kafaa.ecosystem.pledge', 'Skills pledge registered: ' || kafaa_rg_txt(p->'title_en'));
  a := kafaa_audit('pledge.register', 'pledges', v_id, 'ok', v_org || ' ' || (p->>'area') || ' ' || (p->>'people') || ' by ' || (p->>'target_date'), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Pledge registered', a, l, jsonb_build_object('id', v_id));
end $$;

-- FS65: record a dated progress snapshot (same organisation rule; audited)
create or replace function kafaa_record_pledge_progress(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_mine text := kafaa_my_org(); v_plid text := case when jsonb_typeof(p->'pledge_id') = 'string' then p->>'pledge_id' else '' end;
  v_orgw boolean; v_hr boolean; v_role text; pl kafaa_pledges; v_prev jsonb; v_problem text; v_id text; v_lat record; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('pledge.progress', 'pledge_progress', nullif(v_plid, ''), 'not_signed_in', 'Sign in to use the skills pledges ledger'); end if;
  v_orgw := v_mine is not null and kafaa_has_grant('ecosystem', array['OrgW']);
  v_hr := kafaa_has_grant('ecosystem', array['W']);
  if not v_orgw and not v_hr then
    return kafaa_refuse('pledge.progress', 'pledge_progress', nullif(v_plid, ''), 'forbidden', 'Only a partner or university administrator (own organisation) or HR (ENEC entities) registers pledges'); end if;
  v_role := case when v_orgw then kafaa_acting_role('ecosystem', array['OrgW']) else kafaa_acting_role('ecosystem', array['W']) end;
  select * into pl from kafaa_pledges where id = v_plid;
  if pl.id is null or not ((v_orgw and pl.org_id = v_mine) or (not v_orgw and v_hr and pl.org_id = any(array['enec', 'enec-ops', 'enec-com', 'enec-con']))) then
    return kafaa_refuse('pledge.progress', 'pledge_progress', nullif(v_plid, ''), 'not_found', 'Pledge not found', v_role); end if;
  if pl.status <> 'active' then return kafaa_refuse('pledge.progress', 'pledge_progress', v_plid, 'withdrawn', 'A withdrawn pledge takes no progress', v_role); end if;
  select jsonb_build_object('as_of', x.as_of::text, 'started', x.started, 'completed', x.completed) into v_prev from kafaa_pledge_progress x where x.pledge_id = v_plid order by x.as_of desc limit 1;
  v_problem := kafaa_pl_progress_problem(p, pl.pledged_on, v_prev, current_date);
  if v_problem is not null then return kafaa_refuse('pledge.progress', 'pledge_progress', v_plid, 'invalid', 'Check the progress: ' || case v_problem
    when 'date' then 'a date between the pledge date and today' when 'numbers' then 'whole numbers, completed never above started' when 'order' then 'a date later than the last snapshot'
    else 'started and completed never go down' end, v_role); end if;
  v_id := 'pp-' || v_plid || '-' || (p->>'as_of');
  insert into kafaa_pledge_progress (id, pledge_id, org_id, as_of, started, completed, note_en, note_ar, reported_by, reported_at, open_read)
  values (v_id, v_plid, pl.org_id, (p->>'as_of')::date, (p->>'started')::integer, (p->>'completed')::integer, nullif(left(kafaa_rg_txt(p->'note_en'), 300), ''), nullif(left(kafaa_rg_txt(p->'note_ar'), 300), ''), me, now(), false);
  select x.started, x.completed into v_lat from kafaa_pledge_progress x where x.pledge_id = v_plid and x.as_of <= current_date order by x.as_of desc limit 1;
  a := kafaa_audit('pledge.progress', 'pledge_progress', v_id, 'ok', (p->>'as_of') || ' started ' || (p->>'started') || ' completed ' || (p->>'completed'), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Progress recorded', a, null, jsonb_build_object('id', v_id, 'status', kafaa_pl_status(pl.people, pl.target_date, pl.status, v_lat.started, v_lat.completed, current_date)));
end $$;

-- FS65: the aggregate ledger (ecosystem R/Agg/W/A or OwnOrg). Read-only; a refusal is audited.
create or replace function kafaa_pledge_ledger() returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if kafaa_me() is null then return kafaa_refuse('pledge.ledger', 'pledges', null, 'not_signed_in', 'Sign in to use the skills pledges ledger'); end if;
  if not kafaa_has_grant('ecosystem', array['R', 'Agg', 'W', 'A', 'OwnOrg']) then
    return kafaa_refuse('pledge.ledger', 'pledges', null, 'forbidden', 'The pledges ledger is for ENEC staff, partners, universities, HR and auditors'); end if;
  return jsonb_build_object('ok', true, 'code', 'ok', 'message', 'Skills pledges ledger', 'audit_seq', null, 'ledger_seq', null, 'data', kafaa_pl_ledger(current_date));
end $$;
