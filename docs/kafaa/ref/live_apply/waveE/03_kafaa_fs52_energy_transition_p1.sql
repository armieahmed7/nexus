-- kafaa_fs52_energy_transition_p1 (1/1) · from supabase/migrations/20261010252001_kafaa_fs52_energy_transition.sql
-- Apply with apply_migration name "kafaa_fs52_energy_transition_p1". Additive and idempotent; kafaa_* objects only.
-- [FS wave E · E2 · FS41 + FS42 + FS43] Energy Transition Skills (M32): CleanEnergyComp, the energy-system integration pathway and
-- ESG/GHG literacy for managers.
-- FS41: kafaa_cec_competences (12 competences in four areas authored with the GreenComp method, learning outcomes EN/AR, FS02 skills,
--   learning items, Jahiz New Economy group, Net Zero 2050 tag, sources) and kafaa_cec_role_targets (one per job family). Public reference
--   rows (skills_taxonomy R: every role incl. anonymous). My level per competence comes from my F01 person skill states on the linked
--   skills (self-claimed states never count): kafaa_cec_comp / kafaa_cec_profile = cecProfile in src/modules/m32/cec.ts; the overall
--   level is the lowest area level (kafaa_cec_level = cecLevel, exported for FS74 in wave H); HR aggregate kafaa_cec_stats_core = cecStats
--   (suppressed under 10; security, safeguards, cyber never broken out).
-- FS42/FS43: kafaa_value_chains (hydrogen, process heat, grid explainers with sourced facts and as-of dates; concept only, no ENEC project
--   claims) and kafaa_transition_tracks (the FS17 pathway each track runs on, audience, matching micro-credential, FS43 cap of 10 hours).
--   Staff reference rows (internal_content R). The pathways, steps, external readings and two manager electives are seed rows in the M19
--   and M04 tables (data-only coupling; loaded with insert ... on conflict (id) do nothing like every seed row).
-- RPCs (read-only, never audited, never ledgered): kafaa_cec_mine() (skills_profile Own), kafaa_cec_stats() (skills_profile Agg).
-- PGlite parity and checks: scripts/validate/fs52-energy-transition.mjs.
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file; RLS policies created once.

-- ───────────── Tables (generated DDL, additive)
-- M32 · CleanEnergyComp competence (12 in four GreenComp-method areas): EN/AR description, nuclear angle, learning outcomes, the FS02 skills that evidence it, learning items, the Jahiz New Economy group and Net Zero 2050 tag, sources (FS41)
create table if not exists kafaa_cec_competences (
  id text primary key,
  code text not null unique,
  area text not null check (area in ('values', 'complexity', 'futures', 'acting')),
  name_en text not null,
  name_ar text not null,
  summary_en text not null,
  summary_ar text not null,
  plant_en text not null,
  plant_ar text not null,
  outcomes jsonb not null default '[]'::jsonb,
  greencomp_area text not null,
  skill_ids text[] not null default '{}'::text[],
  learning jsonb not null default '[]'::jsonb,
  jahiz_group text not null default 'new_economy',
  net_zero boolean not null default true,
  benchmark_ids text[] not null default '{}'::text[],
  sources jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('active', 'retired')),
  version integer not null default 1,
  as_of date not null,
  sort integer not null default 0
);
comment on table kafaa_cec_competences is '[M32] CleanEnergyComp competence (12 in four GreenComp-method areas): EN/AR description, nuclear angle, learning outcomes, the FS02 skills that evidence it, learning items, the Jahiz New Economy group and Net Zero 2050 tag, sources (FS41)';

-- M32 · CleanEnergyComp target level (1 Aware, 2 Practitioner, 3 Advocate) for each job family, with its focus competences and the reason (FS41)
create table if not exists kafaa_cec_role_targets (
  id text primary key,
  family_id text not null,
  level integer not null,
  focus_ids text[] not null default '{}'::text[],
  rationale_en text not null,
  rationale_ar text not null
);
comment on table kafaa_cec_role_targets is '[M32] CleanEnergyComp target level (1 Aware, 2 Practitioner, 3 Advocate) for each job family, with its focus competences and the reason (FS41)';

-- M32 · Energy-system value chain explainer (hydrogen, process heat, grid): stages with the role nuclear could play, sourced facts with as-of dates, skills, horizon lanes, pathways; concept only, no ENEC project claims (FS42)
create table if not exists kafaa_value_chains (
  id text primary key,
  code text not null unique,
  name_en text not null,
  name_ar text not null,
  summary_en text not null,
  summary_ar text not null,
  stages jsonb not null default '[]'::jsonb,
  facts jsonb not null default '[]'::jsonb,
  skill_ids text[] not null default '{}'::text[],
  lane_ids text[] not null default '{}'::text[],
  pathway_ids text[] not null default '{}'::text[],
  cec_ids text[] not null default '{}'::text[],
  benchmark_ids text[] not null default '{}'::text[],
  sources jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('active', 'retired')),
  as_of date not null,
  sort integer not null default 0
);
comment on table kafaa_value_chains is '[M32] Energy-system value chain explainer (hydrogen, process heat, grid): stages with the role nuclear could play, sourced facts with as-of dates, skills, horizon lanes, pathways; concept only, no ENEC project claims (FS42)';

-- M32 · Energy-transition learning track: the FS17 pathway it runs on (M19 rows), audience, the matching micro-credential, the hour cap (FS43: under 10 hours), value chains and sources (FS42, FS43)
create table if not exists kafaa_transition_tracks (
  id text primary key,
  feature text not null check (feature in ('FS42', 'FS43')),
  pathway_id text not null,
  credential_code text,
  max_hours numeric,
  audience_en text not null,
  audience_ar text not null,
  summary_en text not null,
  summary_ar text not null,
  chain_ids text[] not null default '{}'::text[],
  benchmark_ids text[] not null default '{}'::text[],
  sources jsonb not null default '[]'::jsonb,
  sort integer not null default 0
);
comment on table kafaa_transition_tracks is '[M32] Energy-transition learning track: the FS17 pathway it runs on (M19 rows), audience, the matching micro-credential, the hour cap (FS43: under 10 hours), value chains and sources (FS42, FS43)';

do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_cec_role_targets_family_id_fk') then alter table kafaa_cec_role_targets add constraint kafaa_cec_role_targets_family_id_fk foreign key (family_id) references kafaa_job_families(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_transition_tracks_pathway_id_fk') then alter table kafaa_transition_tracks add constraint kafaa_transition_tracks_pathway_id_fk foreign key (pathway_id) references kafaa_pathways(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_cec_competences_area_idx on kafaa_cec_competences (area);
create index if not exists kafaa_cec_role_targets_family_id_idx on kafaa_cec_role_targets (family_id);
create index if not exists kafaa_transition_tracks_pathway_id_idx on kafaa_transition_tracks (pathway_id);

-- ───────────── RLS (rules in the RLS-perf form: caller-only helpers evaluated once per statement). Writes: none from the API.
alter table kafaa_cec_competences enable row level security;
alter table kafaa_cec_role_targets enable row level security;
alter table kafaa_value_chains enable row level security;
alter table kafaa_transition_tracks enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_cec_competences' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_cec_competences for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_cec_role_targets' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_cec_role_targets for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_value_chains' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_value_chains for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_transition_tracks' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_transition_tracks for select to anon, authenticated using (false)'; end if;
end $$;
alter policy kafaa_read on kafaa_cec_competences using ((SELECT kafaa_has_grant('skills_taxonomy'::text, ARRAY['R'::text, 'W'::text, 'A'::text])));
alter policy kafaa_read on kafaa_cec_role_targets using ((SELECT kafaa_has_grant('skills_taxonomy'::text, ARRAY['R'::text, 'W'::text, 'A'::text])));
alter policy kafaa_read on kafaa_value_chains using ((SELECT kafaa_has_grant('internal_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text])));
alter policy kafaa_read on kafaa_transition_tracks using ((SELECT kafaa_has_grant('internal_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text])));
revoke all on kafaa_cec_competences, kafaa_cec_role_targets, kafaa_value_chains, kafaa_transition_tracks from anon, authenticated;
grant select on kafaa_cec_competences, kafaa_cec_role_targets, kafaa_value_chains, kafaa_transition_tracks to anon, authenticated;

-- ───────────── FS41 rules (mirror of src/modules/m32/cec.ts). Internal: not executable by API roles.
create or replace function kafaa_cec_area_name(p_area text) returns jsonb language sql immutable set search_path = public as $$
  select case p_area
    when 'values' then jsonb_build_object('en', 'Embodying values', 'ar', 'تجسيد القيم')
    when 'complexity' then jsonb_build_object('en', 'Embracing complexity', 'ar', 'تقبّل التعقيد')
    when 'futures' then jsonb_build_object('en', 'Envisioning futures', 'ar', 'استشراف المستقبل')
    when 'acting' then jsonb_build_object('en', 'Acting for sustainability', 'ar', 'العمل من أجل الاستدامة')
    else jsonb_build_object('en', p_area, 'ar', p_area) end
$$;
create or replace function kafaa_cec_basis_rank(p_basis text) returns integer language sql immutable set search_path = public as $$
  select case p_basis when 'verified' then 4 when 'evidenced' then 3 when 'validated' then 2 when 'claimed' then 1 else 0 end
$$;
/** One-decimal percentage a / b, half up, in integers (pct1). */
create or replace function kafaa_cec_pct1(p_a integer, p_b integer) returns numeric language sql immutable set search_path = public as $$
  select round(((2000 * p_a + p_b) / (2 * p_b))::numeric / 10, 1)
$$;

/** competenceView(): one competence for one person (counted evidence, level, self-claimed-only skills, status, reasons). */
create or replace function kafaa_cec_comp(p_person text, p_cid text, p_target integer, p_focus_tid text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c kafaa_cec_competences; v_level integer := 0; v_top text; v_ev jsonb; v_claimed jsonb; v_status text; v_reasons jsonb := '[]'::jsonb; r record; i integer := 0;
begin
  select * into c from kafaa_cec_competences where id = p_cid;
  select coalesce(jsonb_agg(jsonb_build_object('skill_id', x.skill_id, 'level', x.level, 'basis', x.basis)
      order by x.level desc, kafaa_cec_basis_rank(x.basis) desc, x.skill_id collate "C"), '[]'::jsonb) into v_ev
    from kafaa_person_skills x where x.person_id = p_person and x.active and x.skill_id = any(c.skill_ids) and x.level >= 1 and x.basis in ('verified', 'evidenced', 'validated');
  select coalesce(jsonb_agg(d.skill_id order by d.skill_id collate "C"), '[]'::jsonb) into v_claimed from (
    select distinct x.skill_id from kafaa_person_skills x where x.person_id = p_person and x.active and x.skill_id = any(c.skill_ids) and x.level >= 1 and x.basis = 'claimed'
      and not exists (select 1 from kafaa_person_skills y where y.person_id = p_person and y.active and y.skill_id = x.skill_id and y.level >= 1 and y.basis in ('verified', 'evidenced', 'validated'))) d;
  for r in select x.id, x.skill_id, x.level, x.basis, s.name_en, s.name_ar from kafaa_person_skills x left join kafaa_skills s on s.id = x.skill_id
      where x.person_id = p_person and x.active and x.skill_id = any(c.skill_ids) and x.level >= 1 and x.basis in ('verified', 'evidenced', 'validated')
      order by x.level desc, kafaa_cec_basis_rank(x.basis) desc, x.skill_id collate "C" loop
    i := i + 1;
    if i = 1 then v_level := least(3, greatest(0, r.level)); v_top := r.basis; end if;
    exit when i > 2;
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'cec_evidence', 'key', 'm32.reason.evidence',
      'vars', jsonb_build_object('skill', jsonb_build_object('en', coalesce(r.name_en, r.skill_id), 'ar', coalesce(r.name_ar, r.skill_id)), 'level', r.level,
        'basis', jsonb_build_object('en', r.basis, 'ar', case r.basis when 'verified' then 'موثّق' when 'evidenced' then 'مُثبت بالأدلة' when 'validated' then 'مُصادق عليه' else r.basis end)),
      'ref', jsonb_build_object('table', 'person_skills', 'id', r.id)));
  end loop;
  if jsonb_array_length(v_claimed) > 0 then
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'cec_claimed', 'key', 'm32.reason.claimed', 'vars', jsonb_build_object('n', jsonb_array_length(v_claimed))));
  end if;
  v_status := case when v_level = 0 then 'none' when p_target is null then 'no_target' when v_level >= p_target then 'met' else 'below' end;
  v_reasons := v_reasons || case v_status
    when 'none' then jsonb_build_array(jsonb_build_object('code', 'cec_none', 'key', 'm32.reason.none', 'vars', jsonb_build_object('n', coalesce(cardinality(c.skill_ids), 0))))
    when 'met' then jsonb_build_array(jsonb_build_object('code', 'cec_met', 'key', 'm32.reason.met', 'vars', jsonb_build_object('level', v_level, 'target', p_target)))
    when 'below' then jsonb_build_array(jsonb_build_object('code', 'cec_below', 'key', 'm32.reason.below', 'vars', jsonb_build_object('level', v_level, 'target', p_target)))
    else jsonb_build_array(jsonb_build_object('code', 'cec_no_target', 'key', 'm32.reason.noTarget', 'vars', jsonb_build_object('level', v_level))) end;
  if p_focus_tid is not null then
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'cec_focus', 'key', 'm32.reason.focus', 'ref', jsonb_build_object('table', 'cec_role_targets', 'id', p_focus_tid)));
  end if;
  return jsonb_build_object('competence_id', c.id, 'area', c.area, 'level', v_level, 'target', p_target, 'focus', p_focus_tid is not null, 'status', v_status,
    'top_basis', v_top, 'evidence', v_ev, 'claimed', v_claimed, 'reasons', v_reasons);
end $$;

/** cecProfile(): every active competence, the four areas, the overall level (lowest area), status against the family target, reasons, grow. */
create or replace function kafaa_cec_profile(p_person text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_fam text; t kafaa_cec_role_targets; v_target integer; v_comps jsonb := '[]'::jsonb; v_areas jsonb := '[]'::jsonb; v_level integer := 3; v_status text;
  v_reasons jsonb := '[]'::jsonb; v_grow jsonb; c record; a record; b record;
begin
  select job_family_id into v_fam from kafaa_people where id = p_person;
  if v_fam is not null then select * into t from kafaa_cec_role_targets where family_id = v_fam order by id collate "C" limit 1; end if;
  v_target := t.level;
  for c in select id from kafaa_cec_competences where status = 'active' order by sort, id collate "C" loop
    v_comps := v_comps || jsonb_build_array(kafaa_cec_comp(p_person, c.id, v_target, case when t.id is not null and c.id = any(t.focus_ids) then t.id else null end));
  end loop;
  for a in select x.area, x.ord from (values ('values', 1), ('complexity', 2), ('futures', 3), ('acting', 4)) x(area, ord) order by x.ord loop
    select (v ->> 'level')::integer as lvl, v ->> 'competence_id' as cid into b
      from jsonb_array_elements(v_comps) v join kafaa_cec_competences k on k.id = v ->> 'competence_id'
      where v ->> 'area' = a.area and (v ->> 'level')::integer > 0 order by (v ->> 'level')::integer desc, k.sort, k.id collate "C" limit 1;
    v_areas := v_areas || jsonb_build_array(jsonb_build_object('area', a.area, 'level', coalesce(b.lvl, 0), 'competence_id', b.cid));
    v_level := least(v_level, coalesce(b.lvl, 0));
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'cec_area', 'key', 'm32.reason.area', 'vars', jsonb_build_object('area', kafaa_cec_area_name(a.area), 'level', coalesce(b.lvl, 0))));
  end loop;
  v_status := case when v_level = 0 then 'none' when v_target is null then 'no_target' when v_level >= v_target then 'met' else 'below' end;
  v_reasons := v_reasons || case v_status
    when 'none' then jsonb_build_array(jsonb_build_object('code', 'cec_level_none', 'key', 'm32.reason.levelNone'))
    when 'met' then jsonb_build_array(jsonb_build_object('code', 'cec_level_met', 'key', 'm32.reason.levelMet', 'vars', jsonb_build_object('level', v_level, 'target', v_target)))
    when 'below' then jsonb_build_array(jsonb_build_object('code', 'cec_level_below', 'key', 'm32.reason.levelBelow', 'vars', jsonb_build_object('level', v_level, 'target', v_target)))
    else jsonb_build_array(jsonb_build_object('code', 'cec_level_no_target', 'key', 'm32.reason.levelNoTarget', 'vars', jsonb_build_object('level', v_level))) end;
  select coalesce(jsonb_agg(v ->> 'competence_id' order by (v ->> 'focus')::boolean desc, coalesce((v ->> 'target')::integer, 1) - (v ->> 'level')::integer desc, k.sort, k.id collate "C"), '[]'::jsonb) into v_grow
    from jsonb_array_elements(v_comps) v join kafaa_cec_competences k on k.id = v ->> 'competence_id' where v ->> 'status' in ('below', 'none');
  return jsonb_build_object('person_id', p_person, 'family_id', v_fam, 'level', v_level, 'target', v_target, 'status', v_status,
    'areas', v_areas, 'competences', v_comps, 'grow', v_grow, 'reasons', v_reasons);
end $$;

/** FS74 hand-off (wave H): the overall CleanEnergyComp level of a person (cecLevel). Internal; call it from SECURITY DEFINER code. */
create or replace function kafaa_cec_level(p_person text) returns integer language sql stable security definer set search_path = public as $$
  select (kafaa_cec_profile(p_person) ->> 'level')::integer
$$;

/** cecStats() with MIN_GROUP_SIZE 10: every count or share under 10 is null; security, safeguards and cyber never broken out. */
create or replace function kafaa_cec_stats_core() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  with staff as (select id, job_family_id as fam from kafaa_people where kind = 'staff' and status = 'active'),
  pr as (select s.id, s.fam, kafaa_cec_profile(s.id) as j from staff s),
  x as (select id, fam, (j ->> 'level')::integer as lvl, (j ->> 'target')::integer as tgt, j ->> 'status' as st, j -> 'areas' as areas from pr),
  tot as (select count(*)::integer as n, count(*) filter (where lvl >= 1)::integer as l1, count(*) filter (where tgt is not null)::integer as wt,
            count(*) filter (where tgt is not null and st = 'met')::integer as met from x)
  select jsonb_build_object(
    'staff', tot.n,
    'pct_l1', case when tot.n >= 10 and tot.l1 >= 10 then kafaa_cec_pct1(tot.l1, tot.n) else null end,
    'pct_met', case when tot.wt >= 10 and tot.met >= 10 then kafaa_cec_pct1(tot.met, tot.wt) else null end,
    'by_level', (select jsonb_agg(jsonb_build_object('level', l.l, 'n', case when tot.n >= 10 and l.c >= 10 then l.c else null end) order by l.l)
      from (select g.l, (select count(*) from x where x.lvl = g.l)::integer as c from generate_series(0, 3) g(l)) l),
    'by_area', (select jsonb_agg(jsonb_build_object('area', ar.area, 'pct_l1', case when tot.n >= 10 and ar.c >= 10 then kafaa_cec_pct1(ar.c, tot.n) else null end) order by ar.ord)
      from (select y.area, y.ord, (select count(*) from x cross join lateral jsonb_array_elements(x.areas) e where e ->> 'area' = y.area and (e ->> 'level')::integer >= 1)::integer as c
            from (values ('values', 1), ('complexity', 2), ('futures', 3), ('acting', 4)) y(area, ord)) ar),
    'by_family', (select coalesce(jsonb_agg(jsonb_build_object('family_id', f.fam, 'n', case when f.c >= 10 then f.c else null end,
        'target', (select t.level from kafaa_cec_role_targets t where t.family_id = f.fam order by t.id collate "C" limit 1),
        'pct_met', case when f.c >= 10 and f.m >= 10 then kafaa_cec_pct1(f.m, f.c) else null end) order by f.fam collate "C"), '[]'::jsonb)
      from (select x.fam, count(*)::integer as c, count(*) filter (where x.st = 'met')::integer as m from x
            where x.fam is not null and x.fam not in ('security', 'safeguards', 'cyber') group by x.fam) f))
  into v from tot;
  return v;
end $$;

-- ───────────── RPCs (read-only)
create or replace function kafaa_cec_mine() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me();
begin
  if me is null or not kafaa_has_grant('skills_profile', array['Own']) then return null; end if;
  return kafaa_cec_profile(me);
end $$;
create or replace function kafaa_cec_stats() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if kafaa_me() is null or not kafaa_has_grant('skills_profile', array['Agg']) then return null; end if;
  return kafaa_cec_stats_core();
end $$;

-- ───────────── Grants: internal helpers are not executable by API roles; the two RPCs only by signed-in users.
revoke all on function kafaa_cec_area_name(text), kafaa_cec_basis_rank(text), kafaa_cec_pct1(integer, integer), kafaa_cec_comp(text, text, integer, text),
  kafaa_cec_profile(text), kafaa_cec_level(text), kafaa_cec_stats_core() from public, anon, authenticated;
revoke all on function kafaa_cec_mine(), kafaa_cec_stats() from public, anon;
grant execute on function kafaa_cec_mine(), kafaa_cec_stats() to authenticated;
