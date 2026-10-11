-- [FS wave D · E4] FS34 Transferable-skills translator for career-changers + FS35 Career Health check (module M18).
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file for the two new tables, RLS in
-- the per-statement form (like 20261008140000_kafaa_rls_perf.sql), the SQL mirrors of src/modules/m18/translate.ts and
-- src/modules/m18/careerHealth.ts, and three RPCs. LocalBackend mirror: src/modules/m18/backend/local.fs44.ts.
-- PGlite checks (SQL = TS on the seed): scripts/validate/fs44-translator-health.mjs.

-- ───────────── Tables (generated DDL)
-- M18 · ESCO-aligned source occupation for the career-changer translator: Kafa'a skills and typical levels, cited ESCO concepts (FS34)
create table if not exists kafaa_occupation_templates (
  id text primary key,
  esco_uri text not null,
  esco_code text not null,
  isco_code text,
  title_en text not null,
  title_ar text not null,
  esco_label_en text not null,
  esco_label_ar text not null,
  industry text not null check (industry in ('oil_gas', 'power', 'process', 'aviation', 'defence', 'utilities')),
  summary_en text not null,
  summary_ar text not null,
  skills jsonb not null default '[]'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  benchmark_ids text[] not null default '{}'::text[],
  as_of date not null,
  status text not null default 'published' check (status in ('draft', 'published', 'retired')),
  listed boolean not null default true,
  sort integer not null default 0
);
comment on table kafaa_occupation_templates is '[M18] ESCO-aligned source occupation for the career-changer translator: Kafa''a skills and typical levels, cited ESCO concepts (FS34)';

-- M18 · My Career Health check snapshots: five visible components, my plan and the booked conversation; own only (FS35)
create table if not exists kafaa_health_snapshots (
  id text primary key,
  person_id text not null,
  taken_at timestamptz not null default now(),
  as_of date not null,
  role_id text,
  components jsonb not null default '[]'::jsonb,
  good integer not null default 0,
  watch integer not null default 0,
  act integer not null default 0,
  plan jsonb not null default '{}'::jsonb,
  step text not null default 'assessed' check (step in ('assessed', 'charted', 'executed')),
  conversation_id text,
  updated_at timestamptz not null default now()
);
comment on table kafaa_health_snapshots is '[M18] My Career Health check snapshots: five visible components, my plan and the booked conversation; own only (FS35)';

do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_health_snapshots_person_id_fk') then alter table kafaa_health_snapshots add constraint kafaa_health_snapshots_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_health_snapshots_role_id_fk') then alter table kafaa_health_snapshots add constraint kafaa_health_snapshots_role_id_fk foreign key (role_id) references kafaa_job_roles(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_occupation_templates_industry_idx on kafaa_occupation_templates (industry);
create index if not exists kafaa_health_snapshots_person_id_idx on kafaa_health_snapshots (person_id);

-- ───────────── RLS. Templates: public reference rows (listed). Snapshots: own only (own_profile carries Own for every signed-in
-- role and nothing wider, so no manager, HR or talent-review reader matches). Writes: none (templates) or RPC only (snapshots).
alter table kafaa_occupation_templates enable row level security;
alter table kafaa_health_snapshots enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_occupation_templates' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_occupation_templates for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_health_snapshots' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_health_snapshots for select to anon, authenticated using (false)'; end if;
end $$;
alter policy kafaa_read on kafaa_occupation_templates using ((COALESCE(listed, false) AND (SELECT kafaa_has_grant('public_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))));
alter policy kafaa_read on kafaa_health_snapshots using ((((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false))));
revoke all on kafaa_occupation_templates, kafaa_health_snapshots from anon, authenticated;
grant select on kafaa_occupation_templates, kafaa_health_snapshots to anon, authenticated;

-- ───────────── FS34 rules (mirror of src/modules/m18/translate.ts). Internal: not executable by API roles.
create or replace function kafaa_fs34_r(p_code text, p_vars jsonb default null, p_ref jsonb default null) returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object('code', 'fs34_' || p_code, 'key', 'm18.fs34.reason.' || p_code)
    || case when p_vars is null then '{}'::jsonb else jsonb_build_object('vars', p_vars) end
    || case when p_ref is null then '{}'::jsonb else jsonb_build_object('ref', p_ref) end
$$;

/** Competency name as {en, ar}; the id itself when unknown. */
create or replace function kafaa_fs34_name(p_comp text) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_build_object('en', c.name_en, 'ar', c.name_ar) from kafaa_competencies c where c.id = p_comp), jsonb_build_object('en', p_comp, 'ar', p_comp))
$$;

/** Competency levels from held skills [{skill_id, level}] (F05 rule: the core skill's level, else the best other skill). */
create or replace function kafaa_fs34_profile(p_held jsonb) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(q.competency_id, q.lv), '{}'::jsonb) from (
    select s.competency_id, coalesce(max(h.level) filter (where s.core), max(h.level) filter (where not s.core)) as lv
    from jsonb_to_recordset(coalesce(p_held, '[]'::jsonb)) h(skill_id text, level numeric) join kafaa_skills s on s.id = h.skill_id
    group by s.competency_id) q
$$;

/** Weighted coverage of a role's competencies by a profile: {pct, gaps[], transfers[]} (coverageOf). */
create or replace function kafaa_fs34_coverage(p_have jsonb, p_role text, p_w jsonb) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_num numeric := 0; v_den numeric := 0; r record; v_h numeric; v_w numeric; v_gaps jsonb; v_tr jsonb;
begin
  for r in select rc.competency_id, rc.required_level::numeric as need, rc.importance from kafaa_role_competencies rc where rc.role_id = p_role loop
    v_h := coalesce((p_have->>r.competency_id)::numeric, 0);
    v_w := case when jsonb_typeof(p_w->r.importance) = 'number' then (p_w->>r.importance)::numeric else coalesce(case r.importance when 'core' then 3 when 'important' then 2 when 'useful' then 1 end, 1) end;
    v_num := v_num + (12 * least(v_h, r.need) / r.need) * v_w;
    v_den := v_den + v_w;
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('competency_id', g.competency_id, 'have', g.have, 'need', g.need, 'importance', g.importance)
           order by g.need - g.have desc, case g.importance when 'core' then 0 when 'important' then 1 when 'useful' then 2 else 3 end, g.competency_id collate "C"), '[]'::jsonb)
    into v_gaps
  from (select rc.competency_id, coalesce((p_have->>rc.competency_id)::numeric, 0)::int as have, rc.required_level::int as need, rc.importance
        from kafaa_role_competencies rc where rc.role_id = p_role) g where g.have < g.need;
  select coalesce(jsonb_agg(jsonb_build_object('competency_id', t.competency_id, 'have', t.have, 'need', t.need)
           order by least(t.have, t.need)::numeric / t.need desc, t.competency_id collate "C"), '[]'::jsonb)
    into v_tr
  from (select rc.competency_id, coalesce((p_have->>rc.competency_id)::numeric, 0)::int as have, rc.required_level::int as need
        from kafaa_role_competencies rc where rc.role_id = p_role) t where t.have > 0;
  return jsonb_build_object('pct', case when v_den > 0 then floor((100 * v_num + 6 * v_den) / (12 * v_den))::int else 0 end, 'gaps', v_gaps, 'transfers', v_tr);
end $$;

/** The shortest course in the public catalogue (public or staff audience, with a duration) that teaches a competency. */
create or replace function kafaa_fs34_course_for(p_comp text) returns kafaa_courses language sql stable security definer set search_path = public as $$
  select c.* from kafaa_courses c
  where c.public_summary is true and c.audience in ('public', 'staff') and c.duration_hours is not null
    and (p_comp = any(coalesce(c.competency_ids, '{}'::text[]))
         or exists (select 1 from kafaa_course_skill_links l join kafaa_skills s on s.id = l.skill_id where l.course_id = c.id and coalesce(l.active, true) and s.competency_id = p_comp))
  order by c.duration_hours, c.id collate "C" limit 1
$$;

create or replace function kafaa_fs34_translate(p_held jsonb, p_industry text, p_exclude text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_have jsonb := kafaa_fs34_profile(p_held); v_w jsonb; v_cross jsonb; v_results jsonb := '[]'::jsonb; x record; v_cov jsonb; v_bridge jsonb; g jsonb; c kafaa_courses;
  v_lv int; v_left int; v_idx int; v_hours numeric; v_weeks int; v_months int; v_entries jsonb; v_reqs int; v_reasons jsonb; k jsonb; t jsonb; v_comp text; v_name jsonb; v_hr numeric;
begin
  select coalesce((select jsonb_object_agg(e.key, e.value) from jsonb_each(s.weights) e where jsonb_typeof(e.value) = 'number'), '{}'::jsonb) into v_w from kafaa_engine_settings s where s.id = 'recommend';
  v_w := coalesce(v_w, '{}'::jsonb);
  select coalesce(jsonb_agg(jsonb_build_object('id', c2.id, 'hours', c2.duration_hours) order by coalesce(p.sort, 0), p.course_id collate "C"), '[]'::jsonb) into v_cross
  from kafaa_course_pack_items p join kafaa_courses c2 on c2.id = p.course_id
  where p_industry is not null and p.kind = 'crossover' and p_industry = any(coalesce(p.for_industries, '{}'::text[])) and c2.duration_hours is not null;
  for x in
    select q.id, q.education, q.cov, q.gl from (
      select r.id, r.education, kafaa_fs34_coverage(v_have, r.id, v_w) as cov,
             (select coalesce(sum((e->>'need')::int - (e->>'have')::int), 0) from jsonb_array_elements(kafaa_fs34_coverage(v_have, r.id, v_w)->'gaps') e)::int as gl
      from kafaa_job_roles r
      where coalesce(r.lifecycle, 'current') = 'current' and not coalesce(r.security_sensitive, false) and r.level in ('entry', 'professional')
        and coalesce(r.family_id, '') not in ('corporate') and r.id is distinct from p_exclude
        and exists (select 1 from kafaa_role_competencies rc where rc.role_id = r.id)) q
    order by (q.cov->>'pct')::int desc, q.gl, q.id collate "C" limit 5
  loop
    v_cov := x.cov;
    v_bridge := '[]'::jsonb;
    for k in select e from jsonb_array_elements(v_cross) e loop
      v_bridge := v_bridge || jsonb_build_array(jsonb_build_object('step', jsonb_array_length(v_bridge) + 1, 'kind', 'crossover', 'course_id', k->>'id', 'competency_ids', '[]'::jsonb, 'levels', 0,
        'hours', k->'hours', 'weeks', ceil((k->>'hours')::numeric / 4)::int,
        'reasons', jsonb_build_array(kafaa_fs34_r('b_crossover', jsonb_build_object('hours', k->'hours'), jsonb_build_object('table', 'courses', 'id', k->>'id')))));
    end loop;
    for g in select e from jsonb_array_elements(v_cov->'gaps') e loop
      v_comp := g->>'competency_id';
      v_name := kafaa_fs34_name(v_comp);
      v_lv := (g->>'need')::int - (g->>'have')::int;
      v_left := v_lv;
      c := kafaa_fs34_course_for(v_comp);
      if c.id is not null then
        select (o.n - 1)::int into v_idx from jsonb_array_elements(v_bridge) with ordinality o(e, n) where o.e->>'course_id' = c.id limit 1;
        if v_idx is not null then
          if not (v_bridge->v_idx->'competency_ids') ? v_comp then
            v_bridge := jsonb_set(v_bridge, array[v_idx::text, 'competency_ids'], (v_bridge->v_idx->'competency_ids') || to_jsonb(v_comp));
          end if;
          v_bridge := jsonb_set(v_bridge, array[v_idx::text, 'reasons'], (v_bridge->v_idx->'reasons') || jsonb_build_array(kafaa_fs34_r('b_also', jsonb_build_object('skill', v_name))));
        else
          v_bridge := v_bridge || jsonb_build_array(jsonb_build_object('step', jsonb_array_length(v_bridge) + 1, 'kind', 'course', 'course_id', c.id, 'competency_ids', jsonb_build_array(v_comp), 'levels', 1,
            'hours', c.duration_hours, 'weeks', ceil(c.duration_hours / 4)::int,
            'reasons', jsonb_build_array(kafaa_fs34_r('b_course', jsonb_build_object('skill', v_name, 'hours', c.duration_hours), jsonb_build_object('table', 'courses', 'id', c.id)))));
        end if;
        v_idx := null;
        v_left := v_lv - 1;
      end if;
      if v_left > 0 then
        v_hr := 20 * v_left;
        v_bridge := v_bridge || jsonb_build_array(jsonb_build_object('step', jsonb_array_length(v_bridge) + 1, 'kind', 'practice', 'course_id', null, 'competency_ids', jsonb_build_array(v_comp), 'levels', v_left,
          'hours', v_hr, 'weeks', ceil(v_hr / 4)::int,
          'reasons', jsonb_build_array(kafaa_fs34_r('b_practice', jsonb_build_object('skill', v_name, 'levels', v_left, 'per', 20, 'hours', v_hr)))));
      end if;
    end loop;
    select coalesce(sum((e->>'hours')::numeric), 0), coalesce(sum((e->>'weeks')::int), 0)::int into v_hours, v_weeks from jsonb_array_elements(v_bridge) e;
    v_months := ceil(v_weeks * 12 / 52.0)::int;
    select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'en', e.label_en, 'ar', e.label_ar) order by e.id collate "C"), '[]'::jsonb) into v_entries
    from kafaa_career_paths e where e.to_role_id = x.id and e.from_role_id is null and coalesce(e.kind, 'current') = 'current';
    select count(*)::int into v_reqs from kafaa_role_competencies rc where rc.role_id = x.id;
    v_reasons := jsonb_build_array(kafaa_fs34_r('cover', jsonb_build_object('pct', (v_cov->>'pct')::int)), kafaa_fs34_r('transfer', jsonb_build_object('n', jsonb_array_length(v_cov->'transfers'), 'of', v_reqs)));
    for t in select e from jsonb_array_elements(v_cov->'transfers') with ordinality o(e, n) where o.n <= 2 order by o.n loop
      v_reasons := v_reasons || jsonb_build_array(kafaa_fs34_r('transfer_item', jsonb_build_object('skill', kafaa_fs34_name(t->>'competency_id'), 'have', (t->>'have')::int, 'need', (t->>'need')::int), jsonb_build_object('table', 'competencies', 'id', t->>'competency_id')));
    end loop;
    for t in select e from jsonb_array_elements(v_cov->'gaps') with ordinality o(e, n) where o.n <= 3 order by o.n loop
      v_reasons := v_reasons || jsonb_build_array(kafaa_fs34_r('gap', jsonb_build_object('skill', kafaa_fs34_name(t->>'competency_id'), 'from', (t->>'have')::int, 'to', (t->>'need')::int), jsonb_build_object('table', 'competencies', 'id', t->>'competency_id')));
    end loop;
    v_reasons := v_reasons || jsonb_build_array(case when jsonb_array_length(v_cov->'gaps') > 0 then kafaa_fs34_r('route', jsonb_build_object('hours', v_hours, 'weeks', v_weeks, 'months', v_months)) else kafaa_fs34_r('route_none') end);
    if jsonb_array_length(v_cross) > 0 then v_reasons := v_reasons || jsonb_build_array(kafaa_fs34_r('crossover', jsonb_build_object('n', jsonb_array_length(v_cross)))); end if;
    if jsonb_array_length(v_entries) > 0 then
      v_reasons := v_reasons || jsonb_build_array(kafaa_fs34_r('entry', jsonb_build_object('route', jsonb_build_object('en', v_entries->0->>'en', 'ar', v_entries->0->>'ar')), jsonb_build_object('table', 'career_paths', 'id', v_entries->0->>'id')));
    else
      v_reasons := v_reasons || jsonb_build_array(kafaa_fs34_r('education_' || coalesce(x.education, 'none')));
    end if;
    v_results := v_results || jsonb_build_array(jsonb_build_object('role_id', x.id, 'pct', (v_cov->>'pct')::int, 'gap_levels', x.gl, 'transfers', v_cov->'transfers', 'gaps', v_cov->'gaps',
      'bridge', v_bridge, 'hours', v_hours, 'weeks', v_weeks, 'months', v_months,
      'entry_routes', (select coalesce(jsonb_agg(e->'id'), '[]'::jsonb) from jsonb_array_elements(v_entries) e), 'reasons', v_reasons));
  end loop;
  return jsonb_build_object('industry', p_industry,
    'profile', (select coalesce(jsonb_agg(jsonb_build_object('competency_id', e.key, 'level', (e.value)::numeric::int) order by e.key collate "C"), '[]'::jsonb) from jsonb_each(v_have) e),
    'results', v_results);
end $$;

-- ───────────── FS35 rules (mirror of src/modules/m18/careerHealth.ts). Internal: not executable by API roles.
create or replace function kafaa_fs35_r(p_code text, p_vars jsonb default null, p_ref jsonb default null) returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object('code', 'fs35_' || p_code, 'key', 'm18.fs35.reason.' || p_code)
    || case when p_vars is null then '{}'::jsonb else jsonb_build_object('vars', p_vars) end
    || case when p_ref is null then '{}'::jsonb else jsonb_build_object('ref', p_ref) end
$$;
create or replace function kafaa_fs35_pct(p_n numeric, p_den numeric) returns integer language sql immutable set search_path = public as $$
  select case when p_den > 0 then floor((200 * p_n + p_den) / (2 * p_den))::int else null end
$$;
create or replace function kafaa_fs35_band(p_v numeric, p_good numeric, p_watch numeric, p_higher boolean default true) returns text language sql immutable set search_path = public as $$
  select case when p_higher then case when p_v >= p_good then 'good' when p_v >= p_watch then 'watch' else 'act' end
              else case when p_v <= p_good then 'good' when p_v <= p_watch then 'watch' else 'act' end end
$$;

/** Currency of one skill state from its stored FS03 reasons: current, due (within 6 months of the half-life) or ageing. */
create or replace function kafaa_fs35_currency(p_reasons jsonb, p_today date) returns text language sql immutable set search_path = public as $$
  select case
    when n.r is null then 'ageing'
    when n.r->>'source' = 'qualification' then 'current'
    when kafaa_career_months((n.r->>'observed_on')::date, p_today) >= coalesce((n.r->>'hl')::numeric, 36) - 6 then 'due'
    else 'current' end
  from (select (select e from jsonb_array_elements(case when jsonb_typeof(p_reasons) = 'array' then p_reasons else '[]'::jsonb end) e
                where jsonb_typeof(e) = 'object' and not coalesce((e->>'ageing')::boolean, false) and coalesce(e->>'observed_on', '') <> ''
                order by e->>'observed_on' collate "C" desc, coalesce((e->>'hl')::numeric, 36) desc limit 1) as r) n
$$;

create or replace function kafaa_fs35_health(p_person text, p_today date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_role text; v_rl kafaa_job_roles; v_map jsonb; v_comps jsonb := '[]'::jsonb; v_total int; v_cur int; v_due int; v_age int; v_pct int; v_refs jsonb;
  v_areas jsonb; v_all int; v_tr int; v_beyond int; v_live int; v_held int; v_last text; v_since int; v_win int; v_dates int;
  v_have jsonb; v_w jsonb; v_reach int; v_stretch int; v_roles int; v_best jsonb; v_rated int; v_exp int; v_added int; v_change int; v_ready int; v_mo int; v_reasons jsonb; c jsonb;
begin
  select p.job_role_id into v_role from kafaa_people p where p.id = p_person;
  -- currency
  select count(*)::int, count(*) filter (where q.c = 'current')::int, count(*) filter (where q.c = 'due')::int, count(*) filter (where q.c = 'ageing')::int,
         coalesce((select jsonb_agg(z.skill_id order by z.ag desc, z.level desc, z.skill_id collate "C") from (
            select q2.skill_id, q2.level, (q2.c = 'ageing') as ag from (select ps.skill_id, ps.level, kafaa_fs35_currency(ps.reasons, p_today) as c from kafaa_person_skills ps where ps.person_id = p_person and coalesce(ps.active, true)) q2
            where q2.c <> 'current' order by (q2.c = 'ageing') desc, q2.level desc, q2.skill_id collate "C" limit 5) z), '[]'::jsonb)
    into v_total, v_cur, v_due, v_age, v_refs
  from (select kafaa_fs35_currency(ps.reasons, p_today) as c from kafaa_person_skills ps where ps.person_id = p_person and coalesce(ps.active, true)) q;
  v_pct := kafaa_fs35_pct(v_cur, v_total);
  v_comps := v_comps || jsonb_build_array(jsonb_build_object('key', 'currency', 'status', case when v_pct is null then 'na' else kafaa_fs35_band(v_pct, 80, 60) end, 'value', v_pct, 'unit', 'pct',
    'inputs', jsonb_build_object('total', v_total, 'current', v_cur, 'due', v_due, 'ageing', v_age), 'refs', v_refs,
    'reasons', case when v_total > 0 then jsonb_build_array(kafaa_fs35_r('currency_rule', jsonb_build_object('current', v_cur, 'total', v_total, 'pct', v_pct)), kafaa_fs35_r('currency_split', jsonb_build_object('due', v_due, 'ageing', v_age, 'months', 6)))
                    else jsonb_build_array(kafaa_fs35_r('currency_none')) end));
  -- breadth
  select count(*)::int into v_live from kafaa_person_skills ps where ps.person_id = p_person and coalesce(ps.active, true);
  select count(*)::int, coalesce((select jsonb_agg(a order by a collate "C") from (select distinct s2.area as a from kafaa_person_skills p2 join kafaa_skills s2 on s2.id = p2.skill_id
            where p2.person_id = p_person and coalesce(p2.active, true) and p2.level >= 2 and s2.area <> 'security') z), '[]'::jsonb),
         count(*) filter (where s.reusability in ('transversal', 'cross_sectoral'))::int,
         case when v_role is null then 0 else count(*) filter (where s.competency_id not in (select rc.competency_id from kafaa_role_competencies rc where rc.role_id = v_role))::int end
    into v_held, v_areas, v_tr, v_beyond
  from kafaa_person_skills ps join kafaa_skills s on s.id = ps.skill_id
  where ps.person_id = p_person and coalesce(ps.active, true) and ps.level >= 2 and s.area <> 'security';
  select count(distinct s.area)::int into v_all from kafaa_skills s where s.area <> 'security';
  v_comps := v_comps || jsonb_build_array(jsonb_build_object('key', 'breadth', 'status', case when v_live = 0 then 'na' else kafaa_fs35_band(jsonb_array_length(v_areas), 4, 2) end,
    'value', jsonb_array_length(v_areas), 'unit', 'count', 'inputs', jsonb_build_object('areas', jsonb_array_length(v_areas), 'of', v_all, 'transferable', v_tr, 'beyond_role', v_beyond), 'refs', v_areas,
    'reasons', case when v_held > 0 then jsonb_build_array(kafaa_fs35_r('breadth_rule', jsonb_build_object('n', jsonb_array_length(v_areas), 'of', v_all, 'level', 2)), kafaa_fs35_r('breadth_transfer', jsonb_build_object('n', v_tr)), kafaa_fs35_r('breadth_beyond', jsonb_build_object('n', v_beyond)))
                    else jsonb_build_array(kafaa_fs35_r('breadth_none')) end));
  -- recency
  select max(d.d), count(*) filter (where kafaa_career_months(d.d::date, p_today) < 12)::int, count(*)::int into v_last, v_win, v_dates from (
    select to_char(t.completed_on, 'YYYY-MM-DD') as d from kafaa_training_records t where t.person_id = p_person and t.completed_on is not null and t.result in ('passed', 'completed')
    union all select to_char(e.completed_on, 'YYYY-MM-DD') from kafaa_external_completions e where e.person_id = p_person and e.completed_on is not null
    union all select to_char(w.completed_on, 'YYYY-MM-DD') from kafaa_pathway_enrolments w where w.person_id = p_person and w.status = 'completed' and w.completed_on is not null) d
  where d.d <= to_char(p_today, 'YYYY-MM-DD');
  v_since := case when v_last is null then null else kafaa_career_months(v_last::date, p_today) end;
  v_comps := v_comps || jsonb_build_array(jsonb_build_object('key', 'recency', 'status', case when v_since is null then 'act' else kafaa_fs35_band(v_since, 6, 12, false) end, 'value', v_since, 'unit', 'months',
    'inputs', jsonb_build_object('months_since', v_since, 'last_12m', v_win, 'total', v_dates), 'refs', case when v_last is null then '[]'::jsonb else jsonb_build_array(v_last) end,
    'reasons', case when v_last is not null then jsonb_build_array(kafaa_fs35_r('recency_last', jsonb_build_object('date', v_last, 'months', v_since)), kafaa_fs35_r('recency_window', jsonb_build_object('n', v_win, 'months', 12)))
                    else jsonb_build_array(kafaa_fs35_r('recency_none')) end));
  -- mobility
  v_have := kafaa_fs34_profile((select coalesce(jsonb_agg(jsonb_build_object('skill_id', ps.skill_id, 'level', ps.level)), '[]'::jsonb) from kafaa_person_skills ps where ps.person_id = p_person and coalesce(ps.active, true)));
  select coalesce((select jsonb_object_agg(e.key, e.value) from jsonb_each(s.weights) e where jsonb_typeof(e.value) = 'number'), '{}'::jsonb) into v_w from kafaa_engine_settings s where s.id = 'recommend';
  v_w := coalesce(v_w, '{}'::jsonb);
  with sc as (
    select r.id, (kafaa_fs34_coverage(v_have, r.id, v_w)->>'pct')::int as pct from kafaa_job_roles r
    where coalesce(r.lifecycle, 'current') = 'current' and not coalesce(r.security_sensitive, false) and r.id is distinct from v_role and exists (select 1 from kafaa_role_competencies rc where rc.role_id = r.id))
  select count(*) filter (where pct >= 70)::int, count(*) filter (where pct >= 50 and pct < 70)::int, count(*)::int,
         (select coalesce(jsonb_agg(x.id order by x.pct desc, x.id collate "C"), '[]'::jsonb) from (select * from sc order by pct desc, id collate "C" limit 3) x),
         (select jsonb_build_object('id', y.id, 'pct', y.pct) from sc y order by y.pct desc, y.id collate "C" limit 1)
    into v_reach, v_stretch, v_roles, v_refs, v_best from sc;
  v_reasons := jsonb_build_array(kafaa_fs35_r('mobility_rule', jsonb_build_object('n', v_reach, 'pct', 70, 'of', v_roles)), kafaa_fs35_r('mobility_stretch', jsonb_build_object('n', v_stretch, 'from', 50, 'to', 69)));
  if v_best is not null then v_reasons := v_reasons || jsonb_build_array(kafaa_fs35_r('mobility_best', jsonb_build_object('pct', (v_best->>'pct')::int), jsonb_build_object('table', 'job_roles', 'id', v_best->>'id'))); end if;
  v_comps := v_comps || jsonb_build_array(jsonb_build_object('key', 'mobility', 'status', kafaa_fs35_band(v_reach, 3, 1), 'value', v_reach, 'unit', 'count',
    'inputs', jsonb_build_object('reach', v_reach, 'stretch', v_stretch, 'roles', v_roles, 'best_pct', case when v_best is null then null else (v_best->>'pct')::int end), 'refs', v_refs, 'reasons', v_reasons));
  -- change (FS11 map of my role at 2030)
  select * into v_rl from kafaa_job_roles where id = v_role;
  v_map := case when v_rl.id is not null and coalesce(v_rl.lifecycle, 'current') = 'current' then kafaa_rt_map(v_rl.id, p_person, '2030') else null end;
  if v_role is null or v_map is null then
    v_comps := v_comps || jsonb_build_array(jsonb_build_object('key', 'change', 'status', 'na', 'value', null, 'unit', 'pct', 'inputs', jsonb_build_object('rated', null, 'exposure_pct', null, 'change_pct', null, 'ready_pct', null, 'months', null), 'refs', '[]'::jsonb, 'reasons', jsonb_build_array(kafaa_fs35_r('change_no_role'))));
  elsif (v_map->>'path_only')::boolean or jsonb_typeof(v_map->'me') is distinct from 'object' then
    v_comps := v_comps || jsonb_build_array(jsonb_build_object('key', 'change', 'status', 'na', 'value', null, 'unit', 'pct', 'inputs', jsonb_build_object('rated', null, 'exposure_pct', null, 'change_pct', null, 'ready_pct', null, 'months', null), 'refs', '[]'::jsonb, 'reasons', jsonb_build_array(kafaa_fs35_r('change_path_only'))));
  else
    v_rated := (v_map->'counts'->>'rated')::int;
    v_exp := kafaa_fs35_pct((v_map->'counts'->>'augmented')::int + (v_map->'counts'->>'shrink')::int, v_rated);
    select count(*)::int into v_added from jsonb_array_elements(v_map->'added') e where e->>'horizon' = '2030';
    v_change := kafaa_fs35_pct(v_added, (v_map->'me'->>'requirements')::numeric);
    v_ready := (v_map->'me'->>'ready_pct')::numeric::int;
    v_mo := (v_map->'me'->>'months')::numeric::int;
    select coalesce(jsonb_agg(to_jsonb(z.cid) order by z.n), '[]'::jsonb) into v_refs from (
      select f.cid, min(f.n) as n from (select e->>'course_id' as cid, o.n from jsonb_array_elements(v_map->'bridge') with ordinality o(e, n) where e->>'horizon' = '2030' and coalesce(e->>'course_id', '') <> '') f
      group by f.cid order by min(f.n) limit 3) z;
    v_comps := v_comps || jsonb_build_array(jsonb_build_object('key', 'change', 'status', kafaa_fs35_band(v_ready, 80, 50), 'value', v_ready, 'unit', 'pct',
      'inputs', jsonb_build_object('rated', v_rated, 'exposure_pct', v_exp, 'change_pct', v_change, 'ready_pct', v_ready, 'months', v_mo), 'refs', v_refs,
      'reasons', jsonb_build_array(
        case when v_exp is null then kafaa_fs35_r('change_no_tasks') else kafaa_fs35_r('change_tasks', jsonb_build_object('pct', v_exp, 'n', (v_map->'counts'->>'augmented')::int + (v_map->'counts'->>'shrink')::int, 'of', v_rated)) end,
        kafaa_fs35_r('change_profile', jsonb_build_object('n', v_added, 'of', (v_map->'me'->>'requirements')::int, 'pct', coalesce(v_change, 0))),
        kafaa_fs35_r('change_ready', jsonb_build_object('pct', v_ready, 'months', v_mo)))));
  end if;
  return jsonb_build_object('as_of', to_char(p_today, 'YYYY-MM-DD'), 'person_id', p_person, 'role_id', v_role, 'components', v_comps,
    'good', (select count(*) from jsonb_array_elements(v_comps) e where e->>'status' = 'good'),
    'watch', (select count(*) from jsonb_array_elements(v_comps) e where e->>'status' = 'watch'),
    'act', (select count(*) from jsonb_array_elements(v_comps) e where e->>'status' = 'act'),
    'actions', (select coalesce(jsonb_agg(jsonb_build_object('key', case e->>'key' when 'currency' then 'refresh' when 'breadth' then 'broaden' when 'recency' then 'learn' when 'mobility' then 'explore' else 'bridge' end,
                  'component', e->>'key', 'refs', case when e->>'key' in ('breadth', 'recency') then '[]'::jsonb else e->'refs' end) order by o.n), '[]'::jsonb)
                from jsonb_array_elements(v_comps) with ordinality o(e, n) where e->>'status' in ('watch', 'act')));
end $$;

/** A plan from the Chart step, normalised (normPlan); null when invalid. */
create or replace function kafaa_fs35_plan(p jsonb) returns jsonb language plpgsql immutable set search_path = public as $$
declare v_acts jsonb; v_note text; v_rev text; v_focus text; v_all text[] := array['refresh', 'broaden', 'learn', 'explore', 'bridge', 'conversation'];
begin
  if p is null or jsonb_typeof(p) <> 'object' then return null; end if;
  v_acts := coalesce(nullif(p->'actions', 'null'::jsonb), '[]'::jsonb);
  if jsonb_typeof(v_acts) <> 'array' or exists (select 1 from jsonb_array_elements(v_acts) e where jsonb_typeof(e) <> 'string' or not ((e #>> '{}') = any(v_all))) then return null; end if;
  if p ? 'note' and jsonb_typeof(p->'note') not in ('string', 'null') then return null; end if;
  v_note := coalesce(p->>'note', '');
  if char_length(v_note) > 600 then return null; end if;
  if p ? 'review_on' and jsonb_typeof(p->'review_on') not in ('string', 'null') then return null; end if;
  v_rev := nullif(p->>'review_on', '');
  if v_rev is not null and v_rev !~ '^\d{4}-\d{2}-\d{2}$' then return null; end if;
  if p ? 'focus_role_id' and jsonb_typeof(p->'focus_role_id') not in ('string', 'null') then return null; end if;
  v_focus := nullif(p->>'focus_role_id', '');
  if v_focus is not null and char_length(v_focus) > 80 then return null; end if;
  return jsonb_build_object('actions', (select coalesce(jsonb_agg(a order by n), '[]'::jsonb) from unnest(v_all) with ordinality u(a, n) where v_acts ? a),
    'note', regexp_replace(v_note, '^\s+|\s+$', '', 'g'), 'review_on', v_rev, 'focus_role_id', v_focus);
end $$;

-- ───────────── RPCs
create or replace function kafaa_translate_mine() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text := kafaa_acting_role('skills_profile', array['Own']); p kafaa_people; v_held jsonb; v jsonb;
begin
  if me is null then return kafaa_refuse('career.translate', 'person_skills', null, 'not_signed_in', 'Sign in to translate your skills'); end if;
  select * into p from kafaa_people where id = me;
  if v_role is null or p.id is null or p.kind <> 'staff' then return kafaa_refuse('career.translate', 'person_skills', null, 'forbidden', 'Translating your own passport is for staff with a skills profile', v_role); end if;
  select coalesce(jsonb_agg(jsonb_build_object('skill_id', ps.skill_id, 'level', ps.level)), '[]'::jsonb) into v_held from kafaa_person_skills ps where ps.person_id = me and coalesce(ps.active, true);
  v := kafaa_fs34_translate(v_held, null, p.job_role_id);
  return kafaa_result(true, 'ok', '', null::kafaa_audit_events, null, v || jsonb_build_object('held', jsonb_array_length(v_held), 'role_id', p.job_role_id));
end $$;

create or replace function kafaa_career_health() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text := kafaa_acting_role('skills_profile', array['Own']); p kafaa_people;
begin
  if me is null then return kafaa_refuse('career.health', 'health_snapshots', null, 'not_signed_in', 'Sign in to see your career health'); end if;
  select * into p from kafaa_people where id = me;
  if v_role is null or p.id is null or p.kind <> 'staff' then return kafaa_refuse('career.health', 'health_snapshots', null, 'forbidden', 'The Career Health check is for staff with a skills profile', v_role); end if;
  return kafaa_result(true, 'ok', '', null::kafaa_audit_events, null, kafaa_fs35_health(me, current_date));
end $$;

create or replace function kafaa_save_health_snapshot(p_input jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text := kafaa_acting_role('skills_profile', array['Own']); p kafaa_people; v_in jsonb := case when jsonb_typeof(p_input) = 'object' then p_input else '{}'::jsonb end;
  v_sid text := nullif(v_in->>'snapshot_id', ''); r kafaa_health_snapshots; v_plan jsonb; v_conv text := nullif(v_in->>'conversation_id', ''); v_link text; v_step text; v_id text; v_res jsonb; a kafaa_audit_events;
begin
  if jsonb_typeof(v_in->'snapshot_id') is distinct from 'string' then v_sid := null; end if;
  if jsonb_typeof(v_in->'conversation_id') is distinct from 'string' then v_conv := null; end if;
  if me is null then return kafaa_refuse('career_health.save', 'health_snapshots', v_sid, 'not_signed_in', 'Sign in to see your career health'); end if;
  select * into p from kafaa_people where id = me;
  if v_role is null or p.id is null or p.kind <> 'staff' then return kafaa_refuse('career_health.save', 'health_snapshots', v_sid, 'forbidden', 'The Career Health check is for staff with a skills profile', v_role); end if;
  if v_sid is not null then
    select * into r from kafaa_health_snapshots where id = v_sid;
    if r.id is null or r.person_id <> me then return kafaa_refuse('career_health.save', 'health_snapshots', v_sid, 'not_found', 'Health check not found', v_role); end if;
  end if;
  v_plan := kafaa_fs35_plan(coalesce(nullif(v_in->'plan', 'null'::jsonb), r.plan, '{}'::jsonb));
  if v_plan is null then return kafaa_refuse('career_health.save', 'health_snapshots', v_sid, 'invalid', 'Check your plan: choose from the suggested actions and keep the note under 600 characters', v_role); end if;
  if v_conv is not null and not exists (select 1 from kafaa_career_conversations c where c.id = v_conv and c.person_id = me and c.prep_submitted_at is not null) then
    return kafaa_refuse('career_health.save', 'health_snapshots', v_sid, 'invalid', 'Share your conversation preparation with your line manager first', v_role);
  end if;
  v_link := coalesce(v_conv, r.conversation_id);
  v_step := case when v_link is not null then 'executed' when jsonb_array_length(v_plan->'actions') > 0 then 'charted' else 'assessed' end;
  if r.id is not null then
    v_id := r.id;
    update kafaa_health_snapshots set plan = v_plan, conversation_id = v_link, step = v_step, updated_at = now() where id = v_id;
  else
    v_res := kafaa_fs35_health(me, current_date);
    v_id := 'hs-' || substr(md5(random()::text || clock_timestamp()::text || me), 1, 16);
    insert into kafaa_health_snapshots (id, person_id, taken_at, as_of, role_id, components, good, watch, act, plan, step, conversation_id, updated_at)
    values (v_id, me, now(), current_date, v_res->>'role_id', v_res->'components', (v_res->>'good')::int, (v_res->>'watch')::int, (v_res->>'act')::int, v_plan, v_step, v_link, now());
  end if;
  a := kafaa_audit('career_health.save', 'health_snapshots', v_id, 'ok', 'step ' || v_step, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when v_step = 'executed' then 'Conversation booked and plan saved' else 'Career health check saved' end, a, null,
    jsonb_build_object('id', v_id, 'step', v_step, 'created', r.id is null, 'components', case when r.id is null then v_res->'components' else null end));
end $$;

revoke execute on function kafaa_fs34_r(text, jsonb, jsonb), kafaa_fs34_name(text), kafaa_fs34_profile(jsonb), kafaa_fs34_coverage(jsonb, text, jsonb), kafaa_fs34_course_for(text),
  kafaa_fs34_translate(jsonb, text, text), kafaa_fs35_r(text, jsonb, jsonb), kafaa_fs35_pct(numeric, numeric), kafaa_fs35_band(numeric, numeric, numeric, boolean),
  kafaa_fs35_currency(jsonb, date), kafaa_fs35_health(text, date), kafaa_fs35_plan(jsonb) from public, anon, authenticated;
revoke execute on function kafaa_translate_mine(), kafaa_career_health(), kafaa_save_health_snapshot(jsonb) from public, anon;
grant execute on function kafaa_translate_mine(), kafaa_career_health(), kafaa_save_health_snapshot(jsonb) to authenticated;
