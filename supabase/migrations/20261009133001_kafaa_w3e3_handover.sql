-- [W3 · E3 · F22] Kafa'a Handover 2030 readiness board (M07): the SAMPLE external-cover plan (KHNP OSSA and contractor positions
-- per role and plan year), the trainee cohorts earmarked to replace that cover, and two RPCs: the suppressed aggregate
-- kafaa_handover_aggregate (counts only; every cell under 10, zero included, is null) and kafaa_prepare_handover_release (an
-- observer-safe draft in kafaa_observer_reports that goes through the existing release workflow, maker-checker included).
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file, RLS in the per-statement form,
-- internal helpers and the RPCs. Rules: src/modules/m07/handover.ts (LocalBackend mirror: src/modules/m07/backend/local.ts).
-- PGlite checks: scripts/validate/w3e3-handover.mjs (SQL = TS on the seed for both periods and several scenarios).
-- Named successors come from the F19 succession tables (kafaa_succession_slates / kafaa_successors, W3 · E1) when they exist,
-- read through to_jsonb so this file compiles without them; roles with no live slate fall back to F05 shortlists and
-- kafaa_career_readiness_compute (20261009112001).

-- ───────────── Tables (generated DDL)
-- M07 · Handover 2030: positions with external or partner cover by role and plan year (SAMPLE, counts only) (F22)
create table if not exists kafaa_external_cover (
  id text primary key,
  period text not null,
  role_id text not null,
  function text not null,
  year integer not null,
  partner text not null default 'khnp_ossa' check (partner in ('khnp_ossa', 'contractor', 'vendor')),
  cover_count integer not null,
  source text not null,
  sample boolean not null default true
);
comment on table kafaa_external_cover is '[M07] Handover 2030: positions with external or partner cover by role and plan year (SAMPLE, counts only) (F22)';

-- M07 · Handover 2030: trainee cohorts earmarked to replace external cover, with projected ready dates (SAMPLE/SIMULATED) (F22)
create table if not exists kafaa_handover_cohorts (
  id text primary key,
  period text not null,
  role_id text not null,
  route text not null check (route in ('coit', 'loit', 'gpo', 'dnt', 'discipline')),
  programme_id text,
  talent_programme_id text,
  label_en text not null,
  label_ar text not null,
  starts_on date not null,
  ready_on date not null,
  trainees integer not null,
  emirati integer not null default 0,
  source text not null,
  sample boolean not null default true
);
comment on table kafaa_handover_cohorts is '[M07] Handover 2030: trainee cohorts earmarked to replace external cover, with projected ready dates (SAMPLE/SIMULATED) (F22)';

do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_external_cover_role_id_fk') then alter table kafaa_external_cover add constraint kafaa_external_cover_role_id_fk foreign key (role_id) references kafaa_job_roles(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_external_cover_function_fk') then alter table kafaa_external_cover add constraint kafaa_external_cover_function_fk foreign key (function) references kafaa_job_families(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_handover_cohorts_role_id_fk') then alter table kafaa_handover_cohorts add constraint kafaa_handover_cohorts_role_id_fk foreign key (role_id) references kafaa_job_roles(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_handover_cohorts_programme_id_fk') then alter table kafaa_handover_cohorts add constraint kafaa_handover_cohorts_programme_id_fk foreign key (programme_id) references kafaa_programmes(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_handover_cohorts_talent_programme_id_fk') then alter table kafaa_handover_cohorts add constraint kafaa_handover_cohorts_talent_programme_id_fk foreign key (talent_programme_id) references kafaa_talent_programmes(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_external_cover_period_idx on kafaa_external_cover (period);
create index if not exists kafaa_external_cover_role_id_idx on kafaa_external_cover (role_id);
create index if not exists kafaa_external_cover_function_idx on kafaa_external_cover (function);
create index if not exists kafaa_handover_cohorts_period_idx on kafaa_handover_cohorts (period);
create index if not exists kafaa_handover_cohorts_role_id_idx on kafaa_handover_cohorts (role_id);
create index if not exists kafaa_handover_cohorts_programme_id_idx on kafaa_handover_cohorts (programme_id);
create index if not exists kafaa_handover_cohorts_talent_programme_id_idx on kafaa_handover_cohorts (talent_programme_id);
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_external_cover_count_ck') then
  alter table kafaa_external_cover add constraint kafaa_external_cover_count_ck check (cover_count >= 0 and year between 2020 and 2040); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_handover_cohorts_count_ck') then
  alter table kafaa_handover_cohorts add constraint kafaa_handover_cohorts_count_ck check (trainees >= 0 and emirati between 0 and trainees and ready_on >= starts_on); end if; end $$;

-- ───────────── RLS: HR plan maintainers (observer_release R/W/A) and auditors read the plan; no client writes
alter table kafaa_external_cover enable row level security;
alter table kafaa_handover_cohorts enable row level security;
do $$ declare t text; begin
  foreach t in array array['kafaa_external_cover', 'kafaa_handover_cohorts'] loop
    if not exists (select 1 from pg_policies where tablename = t and policyname = 'kafaa_read') then
      execute format('create policy kafaa_read on %I for select to anon, authenticated using (false)', t);
    end if;
  end loop;
end $$;
alter policy kafaa_read on kafaa_external_cover using ((SELECT kafaa_has_grant('observer_release'::text, ARRAY['R'::text, 'W'::text, 'A'::text])));
alter policy kafaa_read on kafaa_handover_cohorts using ((SELECT kafaa_has_grant('observer_release'::text, ARRAY['R'::text, 'W'::text, 'A'::text])));
grant select on kafaa_external_cover, kafaa_handover_cohorts to anon, authenticated;
revoke insert, update on kafaa_external_cover, kafaa_handover_cohorts from anon, authenticated;

-- ───────────── Internal helpers (mirror of src/modules/m07/handover.ts)
-- normReadiness: an F19 readiness value to a band ('now' | 'y1_2' | 'y3_5'), or null
create or replace function kafaa_ho_norm_band(p text) returns text language sql immutable set search_path = public as $$
  select case when coalesce(p, '') = '' then null
              when position('now' in lower(p)) > 0 then 'now'
              when position('1' in p) > 0 and position('2' in p) > 0 then 'y1_2'
              when position('3' in p) > 0 or position('5' in p) > 0 then 'y3_5'
              else null end
$$;
-- liveRow: no inactive status and not active = false
create or replace function kafaa_ho_live(p jsonb) returns boolean language sql immutable set search_path = public as $$
  select not (lower(coalesce(p->>'status', '')) = any(array['withdrawn','removed','rejected','declined','archived','inactive','cancelled','superseded','retired']))
     and coalesce(p->>'active', 'true') <> 'false'
$$;
-- namedMonths: HR band with the F05/F06 estimate kept inside it
create or replace function kafaa_ho_named_months(p_band text, p_months numeric) returns integer language sql immutable set search_path = public as $$
  select case p_band when 'now' then 0
    when 'y1_2' then least(24, greatest(1, coalesce(round(p_months)::integer, 12)))
    when 'y3_5' then least(60, greatest(25, coalesce(round(p_months)::integer, 42))) end
$$;
-- f05Months: months to ready for shortlisted staff, or null (not a successor)
create or replace function kafaa_ho_f05_months(p_band text, p_months numeric) returns integer language sql immutable set search_path = public as $$
  select case when p_band = 'ready_now' then 0
              when p_band in ('ready_in', 'stretch') and p_months is not null then greatest(1, round(p_months)::integer)
              else null end
$$;
create or replace function kafaa_ho_cell(p integer) returns integer language sql immutable set search_path = public as $$
  select case when p >= 10 then p else null end
$$;
-- coverFor: 0 after the OSSA end; past the last planned year the last year repeats
create or replace function kafaa_ho_cover(p_period text, p_role text, p_year integer, p_ossa integer) returns integer language sql stable security definer set search_path = public as $$
  select case when p_year > p_ossa then 0 else coalesce((
    select sum(c.cover_count)::integer from kafaa_external_cover c
    where c.period = p_period and c.role_id = p_role
      and c.year = least(p_year, (select max(x.year) from kafaa_external_cover x where x.period = p_period and x.role_id = p_role))), 0) end
$$;

-- gatherNamed: F19 slates first (live slates on covered roles), F05 shortlists for covered roles with no live slate.
create or replace function kafaa_ho_named(p_period text, p_now date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_cover text[]; v_f19 text[] := '{}'::text[]; v_rows jsonb := '[]'::jsonb; r record; v_band text; v_rd jsonb; v_m integer;
begin
  select coalesce(array_agg(distinct c.role_id), '{}'::text[]) into v_cover from kafaa_external_cover c where c.period = p_period;
  if to_regclass('public.kafaa_successors') is not null and to_regclass('public.kafaa_succession_slates') is not null then
    execute 'select coalesce(array_agg(distinct x.j->>''role_id''), ''{}''::text[]) from (select to_jsonb(s) as j from kafaa_succession_slates s) x
             where x.j->>''role_id'' = any($1) and kafaa_ho_live(x.j)' into v_f19 using v_cover;
    for r in execute 'select a.ss->>''person_id'' as pid, b.sl->>''role_id'' as rid, a.ss->>''readiness'' as rd, p.nationality_flag as nat
        from (select to_jsonb(s) as ss from kafaa_successors s) a
        join (select to_jsonb(t) as sl from kafaa_succession_slates t) b on b.sl->>''id'' = a.ss->>''slate_id''
        join kafaa_people p on p.id = a.ss->>''person_id''
        where kafaa_ho_live(a.ss) and kafaa_ho_live(b.sl) and b.sl->>''role_id'' = any($1) and coalesce(p.status, '''') <> ''leaver''' using v_cover loop
      v_band := kafaa_ho_norm_band(r.rd);
      continue when v_band is null;
      v_rd := kafaa_career_readiness_compute(r.pid, array[r.rid], p_now)->0;
      v_m := kafaa_ho_named_months(v_band, (v_rd->>'months')::numeric);
      v_rows := v_rows || jsonb_build_object('role_id', r.rid, 'person_id', r.pid, 'months', v_m, 'emirati', r.nat = 'uae', 'source', 'f19');
    end loop;
  end if;
  for r in select t.person_id as pid, t.role_id as rid, p.nationality_flag as nat from kafaa_career_targets t join kafaa_people p on p.id = t.person_id
           where coalesce(t.active, true) and t.role_id = any(v_cover) and not (t.role_id = any(v_f19))
             and p.kind = 'staff' and p.status = 'active' and p.job_role_id is distinct from t.role_id loop
    v_rd := kafaa_career_readiness_compute(r.pid, array[r.rid], p_now)->0;
    v_m := kafaa_ho_f05_months(v_rd->>'band', (v_rd->>'months')::numeric);
    continue when v_m is null;
    v_rows := v_rows || jsonb_build_object('role_id', r.rid, 'person_id', r.pid, 'months', v_m, 'emirati', r.nat = 'uae', 'source', 'f05');
  end loop;
  return jsonb_build_object('f19_roles', to_jsonb(coalesce((select array_agg(x order by x collate "C") from unnest(v_f19) x), '{}'::text[])),
    'named', coalesce((select jsonb_agg(jsonb_build_object('role_id', q.rid, 'person_id', q.pid, 'months', q.m, 'emirati', q.em, 'source', q.src) order by q.rid collate "C", q.pid collate "C")
      from (select e->>'role_id' as rid, e->>'person_id' as pid, min((e->>'months')::integer) as m, bool_or((e->>'emirati')::boolean) as em, min(e->>'source') as src
            from jsonb_array_elements(v_rows) e group by 1, 2) q), '[]'::jsonb));
end $$;

-- One board group (total, a function or a role). Mirror of group() in handover.ts.
create or replace function kafaa_ho_group(p_key text, p_roles text[], p_period text, p_y0 integer, p_m0 integer, p_years integer[], p_ossa integer, p_slip integer,
                                          p_named jsonb, p_f19 text[]) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_roles text[]; n integer := coalesce(array_length(p_years, 1), 0); i integer; y integer; v_cover integer[] := '{}'; v_ready integer[] := '{}'; v_short integer[] := '{}';
  v_now integer := 0; v_y12 integer := 0; v_y35 integer := 0; v_em integer := 0; v_named integer := 0; v_last integer; v_need integer; v_first integer := null; v_max integer := 0;
  v_rt integer; v_pipe jsonb; r record; v_ry integer; v_d integer; v_nf19 integer; v_ptot integer;
begin
  select coalesce(array_agg(x order by x collate "C"), '{}'::text[]) into v_roles from unnest(p_roles) x;
  v_last := least(p_ossa, p_years[n]);
  for i in 1..n loop
    v_cover := v_cover || coalesce((select sum(kafaa_ho_cover(p_period, x, p_years[i], p_ossa))::integer from unnest(v_roles) x), 0);
    v_ready := v_ready || 0;
  end loop;
  v_need := v_cover[1];
  for r in select q.pid, min(q.d) as d, bool_or(q.em) as em from (
             select e->>'person_id' as pid, case when (e->>'months')::integer <= 0 then 0 else (e->>'months')::integer + p_slip end as d, (e->>'emirati')::boolean as em
             from jsonb_array_elements(p_named) e where e->>'role_id' = any(v_roles)) q group by q.pid loop
    v_named := v_named + 1;
    if r.d <= 0 then v_now := v_now + 1; elsif r.d <= 24 then v_y12 := v_y12 + 1; elsif r.d <= 60 then v_y35 := v_y35 + 1; end if;
    v_ry := p_y0 + (p_m0 + greatest(0, r.d)) / 12;
    for i in 1..n loop if v_ry <= p_years[i] then v_ready[i] := v_ready[i] + 1; end if; end loop;
    if r.em and v_ry <= v_last then v_em := v_em + 1; end if;
  end loop;
  for r in select c.route, c.trainees, c.emirati, ((extract(year from c.ready_on)::integer - p_y0) * 12 + (extract(month from c.ready_on)::integer - 1) - p_m0) as raw
           from kafaa_handover_cohorts c where c.period = p_period and c.role_id = any(v_roles) loop
    v_d := case when r.raw <= 0 then 0 else r.raw + p_slip end;
    if v_d <= 0 then v_now := v_now + r.trainees; elsif v_d <= 24 then v_y12 := v_y12 + r.trainees; elsif v_d <= 60 then v_y35 := v_y35 + r.trainees; end if;
    v_ry := p_y0 + (p_m0 + greatest(0, v_d)) / 12;
    for i in 1..n loop if v_ry <= p_years[i] then v_ready[i] := v_ready[i] + r.trainees; end if; end loop;
    if v_ry <= v_last then v_em := v_em + r.emirati; end if;
  end loop;
  for i in 1..n loop
    v_short := v_short || greatest(0, v_need - v_cover[i] - v_ready[i]);
    if v_short[i] > 0 and v_first is null then v_first := p_years[i]; end if;
    v_max := greatest(v_max, v_short[i]);
  end loop;
  v_rt := v_ready[array_position(p_years, v_last)];
  select jsonb_build_object('coit', kafaa_ho_cell(coalesce(sum(c.trainees) filter (where c.route = 'coit'), 0)::integer),
                            'loit', kafaa_ho_cell(coalesce(sum(c.trainees) filter (where c.route = 'loit'), 0)::integer),
                            'gpo', kafaa_ho_cell(coalesce(sum(c.trainees) filter (where c.route = 'gpo'), 0)::integer),
                            'dnt', kafaa_ho_cell(coalesce(sum(c.trainees) filter (where c.route = 'dnt'), 0)::integer),
                            'discipline', kafaa_ho_cell(coalesce(sum(c.trainees) filter (where c.route = 'discipline'), 0)::integer)),
         coalesce(sum(c.trainees), 0)::integer
    into v_pipe, v_ptot from kafaa_handover_cohorts c where c.period = p_period and c.role_id = any(v_roles);
  select count(*) into v_nf19 from unnest(v_roles) x where x = any(p_f19);
  return jsonb_build_object(
    'key', p_key, 'roles', to_jsonb(v_roles),
    'source', case when cardinality(v_roles) > 0 and v_nf19 = cardinality(v_roles) then 'f19' when cardinality(v_roles) > 0 and v_nf19 = 0 then 'f05' else 'mixed' end,
    'cover', (select jsonb_agg(kafaa_ho_cell(v_cover[k]) order by k) from generate_series(1, n) k),
    'bands', jsonb_build_object('now', kafaa_ho_cell(v_now), 'y1_2', kafaa_ho_cell(v_y12), 'y3_5', kafaa_ho_cell(v_y35)),
    'named', kafaa_ho_cell(v_named),
    'pipeline', v_pipe, 'pipeline_total', kafaa_ho_cell(v_ptot),
    'ready', (select jsonb_agg(kafaa_ho_cell(v_ready[k]) order by k) from generate_series(1, n) k),
    'shortfall', (select jsonb_agg(kafaa_ho_cell(v_short[k]) order by k) from generate_series(1, n) k),
    'max_shortfall', kafaa_ho_cell(v_max), 'first_shortfall', v_first, 'risk', v_first is not null,
    'at_risk_years', (select coalesce(jsonb_agg(p_years[k] order by k), '[]'::jsonb) from generate_series(1, n) k where v_short[k] > 0),
    'ready_total', kafaa_ho_cell(v_rt), 'emirati', kafaa_ho_cell(v_em),
    'emirati_share_pm', case when v_rt >= 10 and v_em >= 10 then (2000 * v_em + v_rt) / (2 * v_rt) else null end);
end $$;

-- computeHandover: the suppressed board for one period and scenario (deterministic; no person-level field in the output)
create or replace function kafaa_ho_compute(p_period text, p_now date, p_ossa integer, p_slip integer) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  m text[] := regexp_match(coalesce(p_period, ''), '^(\d{4})(?:-(Q[1-4]|H[12]))?$'); v_y0 integer; v_m0 integer; v_years integer[]; v_named jsonb; v_g jsonb; v_f19 text[];
  v_cover_roles text[];
begin
  if m is null then v_y0 := coalesce(nullif(substring(coalesce(p_period, '') from '^\d{4}'), '')::integer, 2026); v_m0 := 11;
  else v_y0 := m[1]::integer; v_m0 := case when m[2] is null then 11 when left(m[2], 1) = 'Q' then substr(m[2], 2)::integer * 3 - 1 else substr(m[2], 2)::integer * 6 - 1 end; end if;
  select array_agg(y order by y) into v_years from generate_series(v_y0, greatest(2031, p_ossa + 1)) y;
  v_g := kafaa_ho_named(p_period, p_now);
  v_named := v_g->'named';
  select coalesce(array_agg(x), '{}'::text[]) into v_f19 from jsonb_array_elements_text(v_g->'f19_roles') x;
  select coalesce(array_agg(distinct c.role_id), '{}'::text[]) into v_cover_roles from kafaa_external_cover c where c.period = p_period;
  return jsonb_build_object(
    'period', p_period, 'as_of_year', v_y0, 'years', to_jsonb(v_years), 'ossa_end', p_ossa, 'slip_months', p_slip, 'simulated', true, 'min_group', 10,
    'total', kafaa_ho_group('total', v_cover_roles, p_period, v_y0, v_m0, v_years, p_ossa, p_slip, v_named, v_f19),
    'functions', coalesce((select jsonb_agg(kafaa_ho_group(f.fam, f.roles, p_period, v_y0, v_m0, v_years, p_ossa, p_slip, v_named, v_f19) order by f.fam collate "C")
      from (select coalesce(j.family_id, 'other') as fam, array_agg(x) as roles from unnest(v_cover_roles) x left join kafaa_job_roles j on j.id = x group by 1) f), '[]'::jsonb),
    'roles', coalesce((select jsonb_agg(kafaa_ho_group(x, array[x], p_period, v_y0, v_m0, v_years, p_ossa, p_slip, v_named, v_f19) order by x collate "C")
      from unnest(v_cover_roles) x), '[]'::jsonb));
end $$;

-- releaseTiles: observer-safe tiles from the baseline board
create or replace function kafaa_ho_release_tiles(a jsonb) returns jsonb language plpgsql immutable set search_path = public as $$
declare
  v_years integer[] := array(select jsonb_array_elements_text(a->'years')::integer); v_i28 integer; v_end integer; src text := 'Kafa''a handover board · SAMPLE plan · SIMULATED projection';
  pm integer := (a->'total'->>'emirati_share_pm')::integer;
begin
  v_i28 := coalesce(array_position(v_years, 2028), least(3, cardinality(v_years)));
  v_end := array_position(v_years, least((a->>'ossa_end')::integer, v_years[cardinality(v_years)]));
  return jsonb_build_array(
    jsonb_build_object('k', 'handover_cover', 'v', coalesce(a->'total'->'cover'->>0, 'suppressed'), 'src', src),
    jsonb_build_object('k', 'handover_cover_2028', 'v', coalesce(a->'total'->'cover'->>(v_i28 - 1), 'suppressed'), 'src', src),
    jsonb_build_object('k', 'handover_ready_2028', 'v', coalesce(a->'total'->'ready'->>(v_i28 - 1), 'suppressed'), 'src', src),
    jsonb_build_object('k', 'handover_ready_end', 'v', coalesce(a->'total'->'ready'->>(v_end - 1), 'suppressed'), 'src', src),
    jsonb_build_object('k', 'handover_pipeline', 'v', coalesce(a->'total'->>'pipeline_total', 'suppressed'), 'src', src),
    jsonb_build_object('k', 'handover_functions_at_risk', 'v', (select count(*) from jsonb_array_elements(a->'functions') g where (g->>'risk')::boolean)::text, 'src', src),
    jsonb_build_object('k', 'handover_first_shortfall', 'v', coalesce(a->'total'->>'first_shortfall', 'none'), 'src', src),
    jsonb_build_object('k', 'handover_emirati_share', 'v', case when pm is null then 'suppressed' else (pm / 10)::text || '.' || (pm % 10)::text || '%' end, 'src', src));
end $$;

-- ───────────── RPC: the suppressed board (HR, managers, auditors; observers refused). Read-only; refusals audited.
create or replace function kafaa_handover_aggregate(p_period text, p_ossa_end integer default null, p_slip integer default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; v_ossa integer := coalesce(p_ossa_end, 2030); v_slip integer := coalesce(p_slip, 0); v_periods jsonb;
begin
  if me is null then return kafaa_refuse('handover.read', 'external_cover', p_period, 'not_signed_in', 'Sign in to see the handover board'); end if;
  if kafaa_has_grant('workforce_analytics', array['Agg', 'R']) then
    select r into v_role from unnest(array['hr_director', 'hr_analyst', 'manager', 'auditor']) with ordinality as u(r, o) where kafaa_has_role(r) order by o limit 1;
  end if;
  if v_role is null then return kafaa_refuse('handover.read', 'external_cover', p_period, 'forbidden', 'The handover board is for HR, line managers and auditors; observers see approved releases only'); end if;
  if coalesce(p_period, '') = '' then select max(period collate "C") into p_period from kafaa_external_cover; end if;
  if p_period is null or not exists (select 1 from kafaa_external_cover where period = p_period) then
    return kafaa_refuse('handover.read', 'external_cover', p_period, 'not_found', 'No handover plan for this period', v_role); end if;
  if v_ossa < 2028 or v_ossa > 2032 or v_slip < 0 or v_slip > 24 then
    return kafaa_refuse('handover.read', 'external_cover', p_period, 'invalid', 'OSSA end must be 2028 to 2032 and the pipeline slip 0 to 24 months', v_role); end if;
  select to_jsonb(array_agg(p order by p collate "C")) into v_periods from (select distinct period as p from kafaa_external_cover) z;
  return jsonb_build_object('ok', true, 'code', 'ok', 'message', 'Handover board', 'audit_seq', null, 'ledger_seq', null,
    'data', kafaa_ho_compute(p_period, current_date, v_ossa, v_slip) || jsonb_build_object('periods', v_periods));
end $$;

-- ───────────── RPC: draft an observer-safe release from the baseline board (HR: observer_release W/A). Audited; release itself
-- (submit, CHCO approval with maker-checker and ledger) stays with kafaa_observer_report_action.
create or replace function kafaa_prepare_handover_release(p_period text) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; a jsonb; v_id text; v_n integer; au kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('observer_report.draft_handover', 'observer_reports', p_period, 'not_signed_in', 'Sign in to prepare a release'); end if;
  v_role := kafaa_acting_role('observer_release', array['W', 'A']);
  if v_role is null then return kafaa_refuse('observer_report.draft_handover', 'observer_reports', p_period, 'forbidden', 'Only HR may prepare an observer report'); end if;
  if p_period is null or not exists (select 1 from kafaa_external_cover where period = p_period) then
    return kafaa_refuse('observer_report.draft_handover', 'observer_reports', p_period, 'not_found', 'No handover plan for this period', v_role); end if;
  a := kafaa_ho_compute(p_period, current_date, 2030, 0);
  select count(*) + 1 into v_n from kafaa_observer_reports where id like 'or-ho-' || lower(p_period) || '-%';
  v_id := 'or-ho-' || lower(p_period) || '-' || v_n;
  insert into kafaa_observer_reports (id, title_en, title_ar, period, body, status, prepared_by, approved_by, approved_at, released_to_org_ids)
  values (v_id, 'Handover 2030 readiness, ' || p_period || ' (aggregate)', 'جاهزية التسليم 2030، ' || p_period || ' (إجمالي)', p_period,
          jsonb_build_object('kind', 'handover', 'tiles', kafaa_ho_release_tiles(a),
            'burndown', jsonb_build_object('years', a->'years', 'cover', a->'total'->'cover', 'ready', a->'total'->'ready'),
            'note', 'Aggregate only; groups under 10 suppressed. Cover plan SAMPLE; projections SIMULATED. Not a regulatory submission.'),
          'draft', me, null, null, '{}'::text[]);
  au := kafaa_audit('observer_report.draft_handover', 'observer_reports', v_id, 'ok', 'handover ' || p_period, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Draft release saved; submit it from Workforce analytics', au, null, jsonb_build_object('id', v_id));
end $$;

revoke execute on function kafaa_ho_norm_band(text), kafaa_ho_live(jsonb), kafaa_ho_named_months(text, numeric), kafaa_ho_f05_months(text, numeric), kafaa_ho_cell(integer),
  kafaa_ho_cover(text, text, integer, integer), kafaa_ho_named(text, date), kafaa_ho_group(text, text[], text, integer, integer, integer[], integer, integer, jsonb, text[]),
  kafaa_ho_compute(text, date, integer, integer), kafaa_ho_release_tiles(jsonb) from public, anon, authenticated;
revoke execute on function kafaa_handover_aggregate(text, integer, integer), kafaa_prepare_handover_release(text) from public, anon;
grant execute on function kafaa_handover_aggregate(text, integer, integer), kafaa_prepare_handover_release(text) to authenticated;
