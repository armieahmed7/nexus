-- [W5 · E4 · F35] Kafa'a skills supply-and-demand outlook, SIMULATED (M07, /workforce/skills-outlook).
-- One table (kafaa_skill_outlooks: saved outlooks with their parameters and the suppressed, aggregate-only results), internal
-- helpers that mirror src/modules/m07/outlook.ts exactly (kafaa_so_*), and five RPCs: kafaa_compute_outlook (HR and auditors;
-- aggregate only, skill families under 10 measured people suppressed), kafaa_save_outlook (HR analyst or HR director, the
-- saveScenario rules), kafaa_release_outlook and kafaa_withdraw_outlook (HR director; publicTextIsClean guard; ledger) and
-- kafaa_released_outlooks (line managers, HR and auditors; never observers).
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file, RLS in the per-statement form.
-- PGlite checks: scripts/validate/w5e4-outlook.mjs (SQL = TS for the base aggregates and many outlooks, RBAC, release guard).
-- Floating point: the base aggregates are integers; every float is made in kafaa_so_project in the same order as project() in
-- TypeScript, in double precision, so both sides produce the same numbers.

-- ───────────── Table (generated DDL)
-- M07 · Saved skills supply-and-demand outlooks (SIMULATED; aggregate, suppressed results) (F35)
create table if not exists kafaa_skill_outlooks (
  id text primary key,
  name text not null,
  params jsonb not null default '{}'::jsonb,
  results jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'released', 'withdrawn')),
  summary_en text not null default '',
  summary_ar text not null default '',
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  computed_at timestamptz not null default now(),
  released_by text,
  released_at timestamptz,
  withdrawn_reason text,
  simulated boolean not null default true
);
comment on table kafaa_skill_outlooks is '[M07] Saved skills supply-and-demand outlooks (SIMULATED; aggregate, suppressed results) (F35)';
create index if not exists kafaa_skill_outlooks_status_idx on kafaa_skill_outlooks (status);
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_outlooks_simulated_ck') then
  alter table kafaa_skill_outlooks add constraint kafaa_skill_outlooks_simulated_ck check (simulated and name ~* 'simulated'); end if; end $$;

-- ───────────── RLS: HR plan maintainers (observer_release R/W/A: HR analyst, HR director, admin, auditor) read; writes only via RPCs
alter table kafaa_skill_outlooks enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_skill_outlooks' and policyname = 'kafaa_read') then
    create policy kafaa_read on kafaa_skill_outlooks for select to anon, authenticated using (false);
  end if;
end $$;
alter policy kafaa_read on kafaa_skill_outlooks using ((SELECT kafaa_has_grant('observer_release'::text, ARRAY['R'::text, 'W'::text, 'A'::text])));
grant select on kafaa_skill_outlooks to anon, authenticated;
revoke insert, update on kafaa_skill_outlooks from anon, authenticated;

-- ───────────── Internal helpers (mirror of src/modules/m07/outlook.ts)
-- Math.round (half up): exact in double precision because x - floor(x) is exact
create or replace function kafaa_so_round(x double precision) returns integer language sql immutable set search_path = public as $$
  select (floor(x) + case when x - floor(x) >= 0.5 then 1 else 0 end)::integer
$$;
-- num(): a scenario parameter as a number (number, or a numeric string), else the default
create or replace function kafaa_so_num(j jsonb, d double precision) returns double precision language sql immutable set search_path = public as $$
  select case jsonb_typeof(j)
    when 'number' then (j #>> '{}')::double precision
    when 'string' then case when (j #>> '{}') ~ '^\s*[-+]?([0-9]+\.?[0-9]*|\.[0-9]+)([eE][-+]?[0-9]+)?\s*$' then trim(j #>> '{}')::double precision else d end
    else d end
$$;
-- M11 adjustDemand: index x adoption factor (0.5-1.5), clamped 0-100, one decimal
create or replace function kafaa_so_adjust(v double precision, f double precision) returns double precision language sql immutable set search_path = public as $$
  select kafaa_so_round(least(100::double precision, greatest(0::double precision, v * least(1.5::double precision, greatest(0.5::double precision, f)))) * 10)::double precision / 10
$$;
-- M11 publicTextIsClean (HEADCOUNT_OR_SITE; \y is the word boundary in PostgreSQL regular expressions)
create or replace function kafaa_so_text_clean(p text[]) returns boolean language sql immutable set search_path = public as $$
  select not exists (select 1 from unnest(coalesce(p, '{}'::text[])) x
    where x ~* '\y(headcount|fte|full[- ]time equivalents?|\d+\s*(staff|people|jobs|positions|operators|engineers|workers)|site (selection|identified|chosen)|candidate site|located at|to be built (at|in))\y')
$$;
-- departures(): [year, share in sixths] pairs for a KLRA position (retirement window or fixed-term / secondment end, earliest)
create or replace function kafaa_so_spread(p_band text, p_base integer) returns jsonb language sql immutable set search_path = public as $$
  select case p_band
    when 'within_1' then jsonb_build_array(jsonb_build_array(p_base + 1, 6))
    when 'within_2' then jsonb_build_array(jsonb_build_array(p_base + 1, 3), jsonb_build_array(p_base + 2, 3))
    when '1_2' then jsonb_build_array(jsonb_build_array(p_base + 2, 6))
    when '2_5' then jsonb_build_array(jsonb_build_array(p_base + 3, 2), jsonb_build_array(p_base + 4, 2), jsonb_build_array(p_base + 5, 2))
    else '[]'::jsonb end
$$;
create or replace function kafaa_so_departures(p_contract_kind text, p_retirement text, p_contract_end text, p_base integer) returns jsonb language plpgsql immutable set search_path = public as $$
declare v_ret jsonb := kafaa_so_spread(p_retirement, p_base); v_con jsonb := '[]'::jsonb;
begin
  if p_contract_kind in ('fixed_term', 'secondment') then v_con := kafaa_so_spread(p_contract_end, p_base); end if;
  if jsonb_array_length(v_ret) = 0 then return v_con; end if;
  if jsonb_array_length(v_con) = 0 then return v_ret; end if;
  return case when (v_con->0->>0)::integer < (v_ret->0->>0)::integer then v_con else v_ret end;
end $$;
-- the outlook's family keys: F01 skill areas, security out of scope
create or replace function kafaa_so_families() returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(a order by a collate "C"), '{}'::text[]) from (select distinct area as a from kafaa_skills where area <> all(array['security'])) z
$$;

-- normalizeParams(): missing keys take the baseline; null when anything is out of range (see LIMITS in outlook.ts)
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
  return out || jsonb_build_object('reskill_overrides', ovo);
end $$;

-- roleAreas: does a role profile (M01 role_competencies, through the core skill of each competency) need the family?
create or replace function kafaa_so_role_needs(p_role text, p_area text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from kafaa_role_competencies rc join kafaa_skills sk on sk.core and sk.competency_id = rc.competency_id where rc.role_id = p_role and sk.area = p_area)
$$;

-- gatherBase(): integer aggregates per family for one staffing scenario (null = current fleet); null when the scenario is unknown
create or replace function kafaa_so_base(p_scenario text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_base integer := 2026; sc kafaa_scenarios; v_p jsonb; v_head boolean; v_tech text := null; v_sc jsonb := null;
  v_kperiod text; v_cperiod text; v_vperiod text; v_high numeric; v_med numeric; v_fams jsonb := '[]'::jsonb; a text;
  v_ns integer; v_nd integer; v_pool integer; v_klra jsonb; v_cohort jsonb; v_cover jsonb; v_lo boolean; v_m integer; v_t integer;
  v_kv integer[]; pos record; dep jsonb; w integer; i integer; y integer; n integer; v_org integer; v_staff integer;
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
  select max(period collate "C") into v_vperiod from kafaa_external_cover;
  select coalesce(max(high_threshold) filter (where id = 'default'), 16), coalesce(max(medium_threshold) filter (where id = 'default'), 8) into v_high, v_med from kafaa_klra_settings;
  select count(*)::integer into v_staff from kafaa_people p where p.kind = 'staff' and p.status = 'active';
  select greatest(0, floor(w.value))::integer into v_org from kafaa_workforce_snapshots w
    where w.measure = 'headcount' and w.family_id is null and w.level is null and w.entity_id is null order by w.period collate "C" desc limit 1;

  foreach a in array kafaa_so_families() loop
    select count(distinct ps.person_id)::integer into v_ns from kafaa_person_skills ps join kafaa_skills sk on sk.id = ps.skill_id join kafaa_people st on st.id = ps.person_id and st.kind = 'staff' and st.status = 'active'
      where ps.active is distinct from false and ps.level >= 2 and sk.area = a;
    select count(distinct ps.person_id)::integer into v_pool from kafaa_person_skills ps join kafaa_skills sk on sk.id = ps.skill_id join kafaa_people st on st.id = ps.person_id and st.kind = 'staff' and st.status = 'active'
      where ps.active is distinct from false and ps.level >= 1 and ps.level < 2 and sk.area = a
        and not exists (select 1 from kafaa_person_skills h join kafaa_skills hs on hs.id = h.skill_id where h.person_id = ps.person_id and h.active is distinct from false and h.level >= 2 and hs.area = a);
    select count(*)::integer into v_nd from kafaa_people st where st.kind = 'staff' and st.status = 'active' and st.job_role_id is not null and kafaa_so_role_needs(st.job_role_id, a);
    -- KLRA (F20): band-weighted departures of holders, latest assessment period, positions in id order
    v_kv := array_fill(0, array[20]);
    for pos in select kp.id, kp.contract_kind, kp.retirement_band, kp.contract_end_band, (select ka.total from kafaa_klra_assessments ka where ka.position_id = kp.id and ka.period = v_kperiod order by ka.id collate "C" desc limit 1) as total
        from kafaa_klra_positions kp
        where kp.active is distinct from false and kp.kind = 'staff' and kp.person_id is not null
          and exists (select 1 from kafaa_klra_assessments ka where ka.position_id = kp.id and ka.period = v_kperiod)
          and exists (select 1 from kafaa_person_skills h join kafaa_skills hs on hs.id = h.skill_id join kafaa_people st on st.id = h.person_id and st.kind = 'staff' and st.status = 'active'
                      where h.person_id = kp.person_id and h.active is distinct from false and h.level >= 2 and hs.area = a)
        order by kp.id collate "C" loop
      w := case when pos.total >= v_high then 10 when pos.total >= v_med then 7 else 4 end;
      dep := kafaa_so_departures(pos.contract_kind, pos.retirement_band, pos.contract_end_band, v_base);
      for i in 0 .. jsonb_array_length(dep) - 1 loop
        y := (dep->i->>0)::integer;
        v_kv[y - v_base] := v_kv[y - v_base] + w * (dep->i->>1)::integer;
      end loop;
    end loop;
    v_klra := '{}'::jsonb;
    for i in 1 .. 19 loop if v_kv[i] > 0 then v_klra := v_klra || jsonb_build_object((v_base + i)::text, v_kv[i]); end if; end loop;
    -- F22 cohorts for roles that need the family (latest plan period), at their ready year (never before base + 1)
    select coalesce(jsonb_object_agg(z.y::text, z.n), '{}'::jsonb) into v_cohort from (
      select greatest(v_base + 1, extract(year from c.ready_on)::integer) as y, sum(c.trainees)::integer as n
      from kafaa_handover_cohorts c where c.period = v_cperiod and kafaa_so_role_needs(c.role_id, a)
      group by 1) z;
    -- F22 external cover in roles that need the family, per year (last plan year repeats; the OSSA cut-off applies in the projection)
    v_cover := '{}'::jsonb;
    for y in v_base .. 2036 loop
      select coalesce(sum(c.cover_count), 0)::integer into n from kafaa_external_cover c
        join (select x.role_id, least(y, max(x.year)) as yy from kafaa_external_cover x where x.period = v_vperiod group by x.role_id) m on m.role_id = c.role_id and c.year = m.yy
        where c.period = v_vperiod and kafaa_so_role_needs(c.role_id, a);
      v_cover := v_cover || jsonb_build_object(y::text, n);
    end loop;
    v_lo := kafaa_so_role_needs('local-operator', a);
    select count(*)::integer, count(*) filter (where exists (select 1 from unnest(coalesce(sk.adv_skill_ids, '{}'::text[])) x join kafaa_adv_skills ad on ad.id = x
                                                           where v_tech is null or ad.tech_id = v_tech))::integer
      into v_t, v_m from kafaa_skills sk where sk.area = a;
    v_fams := v_fams || jsonb_build_array(jsonb_build_object('key', a, 'n_s', v_ns, 'n_d', v_nd, 'pool', v_pool, 'klra60', v_klra, 'cohort', v_cohort,
      'cover', v_cover, 'lo', v_lo, 'adv_m', v_m, 'adv_t', v_t));
  end loop;
  return jsonb_build_object('families', v_fams, 'adv_sum', (select coalesce(sum(value), 0) from kafaa_future_skills), 'adv_n', (select count(*)::integer from kafaa_future_skills),
    'org', coalesce(v_org, 0), 'staff', v_staff, 'scenario', v_sc);
end $$;

-- growthOf(): staffing growth factor of a headcount scenario for a year
create or replace function kafaa_so_growth(sc jsonb, y integer) returns double precision language plpgsql immutable set search_path = public as $$
declare v_b double precision; v_s double precision;
begin
  if sc is null or jsonb_typeof(sc) <> 'object' then return 1; end if;
  v_b := (sc->>'baseline')::double precision; v_s := (sc->>'start')::double precision;
  if v_b <= 0 or y < v_s then return 1; end if;
  return (v_b + (sc->>'units')::double precision * (sc->>'per_unit')::double precision) / v_b;
end $$;

-- project(): every family (visible or suppressed) and the shortfall totals, no tornado
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
    c_attr := 0; c_klra := 0; c_inc := 0; c_rs := 0; cells := '[]'::jsonb; last_d := 0; v_first := null; v_peak := null;
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
      d := (d0 + ho) * kafaa_so_growth(sc, y) * (1 + adv * v_int * ramp);
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
             'effect', case when z.code in ('intake', 'reskill') then 'narrows' else 'widens' end) order by z.m desc, z.o), '[]'::jsonb)
      into drivers
      from (select x.code, x.m, x.o from (values
              ('attrition', c_attr, 1), ('klra', c_klra, 2), ('handover', ho_h::double precision, 3), ('growth', (d0 + ho_h) * (g_h - 1), 4),
              ('advance', last_d - (d0 + ho_h) * g_h, 5), ('intake', c_inc, 6), ('reskill', c_rs, 7)) as x(code, m, o) where x.m > 0) z;
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

-- computeOutlook(): projection, the tornado (cumulative shortfall with each assumption at the ends of a fixed range) and labels
create or replace function kafaa_so_compute(b jsonb, p jsonb) returns jsonb language plpgsql immutable set search_path = public as $$
declare
  pr jsonb := kafaa_so_project(b, p);
  spec jsonb := '[["attrition_pct",2,8],["klra_weight",0.5,1.5],["pipeline_factor",0.5,1.5],["annual_intake",10,40],["reskill_rate",5,30],["adv_factor",0.5,1.5],["ossa_end",2028,2032]]';
  t jsonb; i integer; lo integer; hi integer; bars jsonb := '[]'::jsonb;
begin
  for i in 0 .. jsonb_array_length(spec) - 1 loop
    t := spec->i;
    lo := (kafaa_so_project(b, p || jsonb_build_object(t->>0, t->1))->'totals'->>'cumulative')::integer;
    hi := (kafaa_so_project(b, p || jsonb_build_object(t->>0, t->2))->'totals'->>'cumulative')::integer;
    bars := bars || jsonb_build_array(jsonb_build_object('param', t->>0, 'lo', t->1, 'hi', t->2, 'low', lo, 'high', hi, 'swing', abs(hi - lo), 'o', i));
  end loop;
  select jsonb_agg(x - 'o' order by (x->>'swing')::integer desc, (x->>'o')::integer) into bars from jsonb_array_elements(bars) x;
  return jsonb_build_object('simulated', true, 'method', 'f35-v1', 'base_year', 2026, 'horizon', (p->>'horizon')::integer, 'years', pr->'years', 'params', p,
    'scenario', case when b->'scenario' is null or jsonb_typeof(b->'scenario') = 'null' then null
                     else jsonb_build_object('id', b->'scenario'->'id', 'name', b->'scenario'->'name', 'kind', b->'scenario'->'kind') end,
    'adv_index', kafaa_so_round(case when (b->>'adv_n')::integer > 0 then (b->>'adv_sum')::double precision / (b->>'adv_n')::double precision else 0 end * 10)::double precision / 10,
    'org_headcount', (b->>'org')::integer, 'staff_sample', (b->>'staff')::integer, 'min_group', 10,
    'families', pr->'families', 'totals', pr->'totals', 'tornado', bars);
end $$;

-- outlookFor(): normalised params + scenario check + compute; {code, result}
create or replace function kafaa_so_for(p_raw jsonb) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare p jsonb := kafaa_so_normalize(coalesce(p_raw, '{}'::jsonb), kafaa_so_families()); b jsonb;
begin
  if p is null then return jsonb_build_object('code', 'invalid'); end if;
  if p->>'scenario_id' is not null and not exists (select 1 from kafaa_scenarios where id = p->>'scenario_id') then return jsonb_build_object('code', 'not_found'); end if;
  b := kafaa_so_base(p->>'scenario_id');
  return jsonb_build_object('code', 'ok', 'result', kafaa_so_compute(b, p));
end $$;

-- ───────────── RPC: the live outlook (HR and auditors). Read-only; refusals audited.
create or replace function kafaa_compute_outlook(p_params jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; r jsonb;
begin
  if me is null then return kafaa_refuse('outlook.compute', 'skill_outlooks', null, 'not_signed_in', 'Sign in to see the skills outlook'); end if;
  if kafaa_has_grant('workforce_analytics', array['Agg', 'R']) then
    select x into v_role from unnest(array['hr_director', 'hr_analyst', 'auditor']) with ordinality as u(x, o) where kafaa_has_role(x) order by o limit 1;
  end if;
  if v_role is null then return kafaa_refuse('outlook.compute', 'skill_outlooks', null, 'forbidden', 'The skills outlook is for HR and auditors; line managers see released outlooks'); end if;
  r := kafaa_so_for(p_params);
  if r->>'code' = 'invalid' then return kafaa_refuse('outlook.compute', 'skill_outlooks', null, 'invalid', 'An assumption is outside its range', v_role); end if;
  if r->>'code' = 'not_found' then return kafaa_refuse('outlook.compute', 'skill_outlooks', p_params->>'scenario_id', 'not_found', 'Staffing scenario not found', v_role); end if;
  return jsonb_build_object('ok', true, 'code', 'ok', 'message', 'Skills outlook (SIMULATED)', 'audit_seq', null, 'ledger_seq', null, 'data', r->'result');
end $$;

-- ───────────── RPC: save an outlook (HR analyst or HR director; the saveScenario rules: owner updates, "(SIMULATED)" name)
create or replace function kafaa_save_outlook(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_id text := nullif(p->>'id', ''); v_role text; v_nm text := btrim(coalesce(p->>'name', ''), E' \t\n\r'); v_name text;
  r jsonb; cur kafaa_skill_outlooks; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('outlook.save', 'skill_outlooks', v_id, 'not_signed_in', 'Sign in to save an outlook'); end if;
  v_role := kafaa_g3_hr_role();
  if v_role is null then return kafaa_refuse('outlook.save', 'skill_outlooks', v_id, 'forbidden', 'Only HR analysts and the HR director may save outlooks'); end if;
  if char_length(v_nm) < 3 or char_length(v_nm) > 120 then return kafaa_refuse('outlook.save', 'skill_outlooks', v_id, 'invalid', 'An outlook needs a name of 3 to 120 characters', v_role); end if;
  r := kafaa_so_for(coalesce(p->'params', '{}'::jsonb));
  if r->>'code' = 'invalid' then return kafaa_refuse('outlook.save', 'skill_outlooks', v_id, 'invalid', 'An assumption is outside its range', v_role); end if;
  if r->>'code' = 'not_found' then return kafaa_refuse('outlook.save', 'skill_outlooks', v_id, 'not_found', 'Staffing scenario not found', v_role); end if;
  v_name := case when v_nm ~* 'simulated' then v_nm else v_nm || ' (SIMULATED)' end;
  if v_id is not null then
    select * into cur from kafaa_skill_outlooks where id = v_id;
    if cur.id is null or cur.created_by is distinct from me then return kafaa_refuse('outlook.save', 'skill_outlooks', v_id, 'not_found', 'Outlook not found', v_role); end if;
    if cur.status = 'released' then return kafaa_refuse('outlook.save', 'skill_outlooks', v_id, 'released', 'Withdraw the release before changing this outlook', v_role); end if;
    update kafaa_skill_outlooks set name = v_name, params = r->'result'->'params', results = r->'result', status = 'draft', updated_at = now(), computed_at = now() where id = v_id;
  else
    v_id := 'so-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
    insert into kafaa_skill_outlooks (id, name, params, results, status, summary_en, summary_ar, created_by, created_at, updated_at, computed_at, simulated)
    values (v_id, v_name, r->'result'->'params', r->'result', 'draft', '', '', me, now(), now(), now(), true);
  end if;
  a := kafaa_audit('outlook.save', 'skill_outlooks', v_id, 'ok', v_name, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Outlook saved', a, null, jsonb_build_object('id', v_id, 'name', v_name));
end $$;

-- ───────────── RPC: the HR director releases an outlook to line managers (publicTextIsClean on name and summaries; ledger)
create or replace function kafaa_release_outlook(p_id text, p_summary_en text, p_summary_ar text) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); cur kafaa_skill_outlooks; v_en text := btrim(coalesce(p_summary_en, ''), E' \t\n\r'); v_ar text := btrim(coalesce(p_summary_ar, ''), E' \t\n\r');
  r jsonb; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('outlook.release', 'skill_outlooks', p_id, 'not_signed_in', 'Sign in to release an outlook'); end if;
  if not kafaa_has_role('hr_director') then return kafaa_refuse('outlook.release', 'skill_outlooks', p_id, 'forbidden', 'Only the HR director releases a skills outlook'); end if;
  select * into cur from kafaa_skill_outlooks where id = p_id;
  if cur.id is null then return kafaa_refuse('outlook.release', 'skill_outlooks', p_id, 'not_found', 'Outlook not found', 'hr_director'); end if;
  if cur.status = 'released' then return kafaa_refuse('outlook.release', 'skill_outlooks', p_id, 'already_released', 'This outlook is already released', 'hr_director'); end if;
  if char_length(v_en) < 10 or char_length(v_en) > 600 or char_length(v_ar) < 10 or char_length(v_ar) > 600 then
    return kafaa_refuse('outlook.release', 'skill_outlooks', p_id, 'invalid', 'Write a summary of 10 to 600 characters in English and in Arabic', 'hr_director'); end if;
  if not kafaa_so_text_clean(array[cur.name, v_en, v_ar]) then
    return kafaa_refuse('outlook.release', 'skill_outlooks', p_id, 'not_clean', 'Release text may not state headcounts or site information (M11 rule)', 'hr_director'); end if;
  r := kafaa_so_for(cur.params);
  if r->>'code' <> 'ok' then return kafaa_refuse('outlook.release', 'skill_outlooks', p_id, r->>'code', case when r->>'code' = 'not_found' then 'Staffing scenario not found' else 'An assumption is outside its range' end, 'hr_director'); end if;
  update kafaa_skill_outlooks set status = 'released', summary_en = v_en, summary_ar = v_ar, results = r->'result', released_by = me, released_at = now(),
    withdrawn_reason = null, updated_at = now(), computed_at = now() where id = p_id;
  l := kafaa_ledger('kafaa.workforce.outlook_release', 'Skills outlook released: ' || cur.name);
  a := kafaa_audit('outlook.release', 'skill_outlooks', p_id, 'ok', cur.name, case when l is null then 'skipped' else 'written' end, l, 'hr_director');
  return kafaa_result(true, 'ok', 'Outlook released to line managers', a, l, jsonb_build_object('id', p_id));
end $$;

-- ───────────── RPC: the HR director withdraws a released outlook (reason; ledger)
create or replace function kafaa_withdraw_outlook(p_id text, p_reason text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); cur kafaa_skill_outlooks; v_why text := btrim(coalesce(p_reason, ''), E' \t\n\r'); a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('outlook.withdraw', 'skill_outlooks', p_id, 'not_signed_in', 'Sign in to withdraw an outlook'); end if;
  if not kafaa_has_role('hr_director') then return kafaa_refuse('outlook.withdraw', 'skill_outlooks', p_id, 'forbidden', 'Only the HR director withdraws a skills outlook'); end if;
  select * into cur from kafaa_skill_outlooks where id = p_id;
  if cur.id is null then return kafaa_refuse('outlook.withdraw', 'skill_outlooks', p_id, 'not_found', 'Outlook not found', 'hr_director'); end if;
  if cur.status <> 'released' then return kafaa_refuse('outlook.withdraw', 'skill_outlooks', p_id, 'not_released', 'Only a released outlook can be withdrawn', 'hr_director'); end if;
  if char_length(v_why) < 5 or char_length(v_why) > 500 then return kafaa_refuse('outlook.withdraw', 'skill_outlooks', p_id, 'invalid', 'Give a reason of 5 to 500 characters', 'hr_director'); end if;
  update kafaa_skill_outlooks set status = 'withdrawn', withdrawn_reason = v_why, updated_at = now() where id = p_id;
  l := kafaa_ledger('kafaa.workforce.outlook_withdraw', 'Skills outlook withdrawn: ' || cur.name);
  a := kafaa_audit('outlook.withdraw', 'skill_outlooks', p_id, 'ok', v_why, case when l is null then 'skipped' else 'written' end, l, 'hr_director');
  return kafaa_result(true, 'ok', 'Outlook withdrawn', a, l, jsonb_build_object('id', p_id));
end $$;

-- ───────────── RPC: released outlooks (line managers, HR, auditors; observers and staff refused). Aggregate results only.
create or replace function kafaa_released_outlooks() returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text;
begin
  if me is null then return kafaa_refuse('outlook.released', 'skill_outlooks', null, 'not_signed_in', 'Sign in to see released outlooks'); end if;
  if kafaa_has_grant('workforce_analytics', array['Agg', 'R']) then
    select x into v_role from unnest(array['hr_director', 'hr_analyst', 'manager', 'auditor']) with ordinality as u(x, o) where kafaa_has_role(x) order by o limit 1;
  end if;
  if v_role is null then return kafaa_refuse('outlook.released', 'skill_outlooks', null, 'forbidden', 'Released outlooks are for line managers, HR and auditors'); end if;
  return jsonb_build_object('ok', true, 'code', 'ok', 'message', 'Released outlooks', 'audit_seq', null, 'ledger_seq', null,
    'data', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'summary_en', o.summary_en, 'summary_ar', o.summary_ar, 'results', o.results,
      'released_at', o.released_at) order by o.released_at desc, o.id collate "C") from kafaa_skill_outlooks o where o.status = 'released'), '[]'::jsonb));
end $$;

revoke execute on function kafaa_so_round(double precision), kafaa_so_num(jsonb, double precision), kafaa_so_adjust(double precision, double precision),
  kafaa_so_text_clean(text[]), kafaa_so_spread(text, integer), kafaa_so_departures(text, text, text, integer), kafaa_so_families(), kafaa_so_role_needs(text, text),
  kafaa_so_normalize(jsonb, text[]), kafaa_so_base(text), kafaa_so_growth(jsonb, integer), kafaa_so_project(jsonb, jsonb), kafaa_so_compute(jsonb, jsonb),
  kafaa_so_for(jsonb) from public, anon, authenticated;
revoke execute on function kafaa_compute_outlook(jsonb), kafaa_save_outlook(jsonb), kafaa_release_outlook(text, text, text), kafaa_withdraw_outlook(text, text),
  kafaa_released_outlooks() from public, anon;
grant execute on function kafaa_compute_outlook(jsonb), kafaa_save_outlook(jsonb), kafaa_release_outlook(text, text, text), kafaa_withdraw_outlook(text, text),
  kafaa_released_outlooks() to authenticated;
