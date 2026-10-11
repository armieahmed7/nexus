-- [FS wave B · E5] FS15 Future roles in the Navigator and Roadmap + FS16 Role outlook labels with published criteria (module M18).
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file for the four new tables, RLS in
-- the per-statement form (like 20261008140000_kafaa_rls_perf.sql), the SQL mirrors of src/modules/m18/futureRoles.ts and
-- src/modules/m18/outlookLabels.ts, four RPCs, and the F24 navigator engine card update (guarded, data only).
-- LocalBackend mirror: src/modules/m18/backend/local.ts. PGlite checks (SQL = TS on the seed): scripts/validate/fs25-future-roles.mjs.

-- ───────────── Tables (generated DDL)
-- M18 · SIMULATED anonymised mirror of past role changes (from role, to role, date, months in the previous role); aggregates only (FS15)
create table if not exists kafaa_role_moves (
  id text primary key,
  from_role_id text not null,
  to_role_id text not null,
  moved_on date not null,
  months_before integer not null,
  kind text not null default 'progression' check (kind in ('progression', 'lateral')),
  simulated boolean not null default true,
  source text not null default 'SIMULATED HR mirror'
);
comment on table kafaa_role_moves is '[M18] SIMULATED anonymised mirror of past role changes (from role, to role, date, months in the previous role); aggregates only (FS15)';

-- M18 · Published criteria for the Growing / Stable / Changing role outlook labels, one row per criteria version (FS16)
create table if not exists kafaa_role_outlook_criteria (
  id text primary key,
  version integer not null,
  year_from integer not null,
  thresholds jsonb not null default '{}'::jsonb,
  precedence text[] not null default '{}'::text[],
  components text[] not null default '{}'::text[],
  summary_en text not null,
  summary_ar text not null,
  sources jsonb not null default '[]'::jsonb,
  benchmark_ids text[] not null default '{}'::text[],
  as_of date not null,
  status text not null default 'published' check (status in ('published', 'retired'))
);
comment on table kafaa_role_outlook_criteria is '[M18] Published criteria for the Growing / Stable / Changing role outlook labels, one row per criteria version (FS16)';

-- M18 · Role outlook label per role and year (Growing, Stable, Changing); public, label only; past years kept (FS16)
create table if not exists kafaa_role_outlook_labels (
  id text primary key,
  role_id text not null,
  year integer not null,
  label text not null check (label in ('growing', 'stable', 'changing')),
  criteria_id text not null,
  archived boolean not null default false,
  as_of date not null,
  published_by_role text,
  published_at timestamptz not null default now()
);
comment on table kafaa_role_outlook_labels is '[M18] Role outlook label per role and year (Growing, Stable, Changing); public, label only; past years kept (FS16)';

-- M18 · The components behind each role outlook label (demand growth, shortfall, profile change); staff only (FS16)
create table if not exists kafaa_role_outlook_components (
  id text primary key,
  role_id text not null,
  year integer not null,
  criteria_id text not null,
  components jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now()
);
comment on table kafaa_role_outlook_components is '[M18] The components behind each role outlook label (demand growth, shortfall, profile change); staff only (FS16)';

do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_role_moves_from_role_id_fk') then alter table kafaa_role_moves add constraint kafaa_role_moves_from_role_id_fk foreign key (from_role_id) references kafaa_job_roles(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_role_moves_to_role_id_fk') then alter table kafaa_role_moves add constraint kafaa_role_moves_to_role_id_fk foreign key (to_role_id) references kafaa_job_roles(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_role_outlook_labels_role_id_fk') then alter table kafaa_role_outlook_labels add constraint kafaa_role_outlook_labels_role_id_fk foreign key (role_id) references kafaa_job_roles(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_role_outlook_labels_criteria_id_fk') then alter table kafaa_role_outlook_labels add constraint kafaa_role_outlook_labels_criteria_id_fk foreign key (criteria_id) references kafaa_role_outlook_criteria(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_role_outlook_components_role_id_fk') then alter table kafaa_role_outlook_components add constraint kafaa_role_outlook_components_role_id_fk foreign key (role_id) references kafaa_job_roles(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_role_outlook_components_criteria_id_fk') then alter table kafaa_role_outlook_components add constraint kafaa_role_outlook_components_criteria_id_fk foreign key (criteria_id) references kafaa_role_outlook_criteria(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_role_moves_from_role_id_idx on kafaa_role_moves (from_role_id);
create index if not exists kafaa_role_moves_to_role_id_idx on kafaa_role_moves (to_role_id);
create index if not exists kafaa_role_outlook_labels_role_id_idx on kafaa_role_outlook_labels (role_id);
create index if not exists kafaa_role_outlook_labels_year_idx on kafaa_role_outlook_labels (year);
create index if not exists kafaa_role_outlook_labels_label_idx on kafaa_role_outlook_labels (label);
create index if not exists kafaa_role_outlook_labels_criteria_id_idx on kafaa_role_outlook_labels (criteria_id);
create index if not exists kafaa_role_outlook_components_role_id_idx on kafaa_role_outlook_components (role_id);
create index if not exists kafaa_role_outlook_components_year_idx on kafaa_role_outlook_components (year);
create index if not exists kafaa_role_outlook_components_criteria_id_idx on kafaa_role_outlook_components (criteria_id);

-- ───────────── RLS. role_moves: workforce_analytics R (auditors) only; everyone else gets suppressed aggregates through the RPC.
-- Criteria and labels: public. Components: staff (transformation R). Writes: RPCs only (labels, components) or none.
alter table kafaa_role_moves enable row level security;
alter table kafaa_role_outlook_criteria enable row level security;
alter table kafaa_role_outlook_labels enable row level security;
alter table kafaa_role_outlook_components enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_role_moves' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_role_moves for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_role_outlook_criteria' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_role_outlook_criteria for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_role_outlook_labels' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_role_outlook_labels for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_role_outlook_components' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_role_outlook_components for select to anon, authenticated using (false)'; end if;
end $$;
alter policy kafaa_read on kafaa_role_moves using (((SELECT kafaa_has_grant('workforce_analytics'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))));
alter policy kafaa_read on kafaa_role_outlook_criteria using (((SELECT kafaa_has_grant('public_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))));
alter policy kafaa_read on kafaa_role_outlook_labels using (((SELECT kafaa_has_grant('public_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))));
alter policy kafaa_read on kafaa_role_outlook_components using (((SELECT kafaa_has_grant('transformation'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))));
revoke all on kafaa_role_moves, kafaa_role_outlook_criteria, kafaa_role_outlook_labels, kafaa_role_outlook_components from anon, authenticated;
grant select on kafaa_role_moves, kafaa_role_outlook_criteria, kafaa_role_outlook_labels, kafaa_role_outlook_components to anon, authenticated;

-- ───────────── FS15 rules (mirror of src/modules/m18/futureRoles.ts). Internal: not executable by API roles.
create or replace function kafaa_fs15_concept_readiness_compute(p_person text, p_role_ids text[], p_now date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_role text; v_hire date; v_lic text; v_since date; v_qual boolean; v_mir integer; v_w jsonb;
  v_out jsonb := '[]'::jsonb; r record; jr kafaa_job_roles; pv kafaa_role_profile_versions; q record;
  v_have integer; v_wt float8; v_num float8; v_den float8; v_score float8; v_pct integer; v_gaps jsonb; v_gap_m integer;
  v_bridges jsonb; v_bridge jsonb; v_months integer; v_band text; v_reasons jsonb; v_from jsonb; g record;
begin
  -- F05 career facts (same rules as kafaa_career_readiness_compute / careerFacts)
  select p.job_role_id, p.hire_date into v_role, v_hire from kafaa_people p where p.id = p_person;
  v_lic := case v_role when 'reactor-operator' then 'RO' when 'senior-reactor-operator' then 'SRO' end;
  if v_lic is not null then
    select min(l.issued_on) into v_since from kafaa_licences l where l.person_id = p_person and l.type = v_lic and l.status = 'valid';
  elsif exists (select 1 from kafaa_qual_standards s where v_role = any(s.role_ids)) then
    select min(q2.qualified_on) into v_since from kafaa_qual_records q2
    where q2.person_id = p_person and q2.standard_id in (select s.id from kafaa_qual_standards s where v_role = any(s.role_ids))
      and q2.status in ('qualified', 'due', 'renewed') and q2.qualified_on is not null and (q2.expires_on is null or q2.expires_on >= p_now);
  elsif v_role is not null then
    v_since := v_hire;
  end if;
  v_qual := v_since is not null;
  v_mir := case when v_since is null then 0 else kafaa_career_months(v_since, p_now) end;
  select s.weights into v_w from kafaa_engine_settings s where s.id = 'recommend';
  v_w := coalesce(v_w, '{}'::jsonb);

  for r in
    select x.role_id from (
      select u.x as role_id, min(u.ord) as ord from unnest(p_role_ids) with ordinality u(x, ord) where p_role_ids is not null group by u.x
      union all
      select j.id, row_number() over (order by j.id collate "C") from kafaa_job_roles j where p_role_ids is null and j.lifecycle = 'concept'
    ) x order by x.ord limit 40
  loop
    select * into jr from kafaa_job_roles j where j.id = r.role_id;
    if not found or jr.lifecycle <> 'concept' or coalesce(jr.security_sensitive, false) then continue; end if;
    select * into pv from kafaa_role_profile_versions v where v.role_id = r.role_id and v.status = 'published' and v.horizon in ('2030', '2035')
      order by case v.horizon when '2030' then 0 else 1 end, v.version desc limit 1;
    if not found then continue; end if;
    v_num := 0; v_den := 0; v_gaps := '[]'::jsonb;
    for q in select x, ord from jsonb_array_elements(case when jsonb_typeof(pv.requirements) = 'array' then pv.requirements else '[]'::jsonb end) with ordinality t(x, ord) order by ord loop
      if q.x->>'kind' = 'skill' then
        select coalesce(max(ps.level), 0) into v_have from kafaa_person_skills ps where ps.person_id = p_person and ps.active and ps.skill_id = q.x->>'ref_id';
      else
        select coalesce(coalesce(max(ps.level) filter (where s.core), max(ps.level)), 0) into v_have
        from kafaa_person_skills ps join kafaa_skills s on s.id = ps.skill_id where ps.person_id = p_person and ps.active and s.competency_id = q.x->>'ref_id';
      end if;
      v_wt := case when jsonb_typeof(v_w -> (q.x->>'importance')) = 'number' then (v_w ->> (q.x->>'importance'))::float8
                   else case q.x->>'importance' when 'core' then 3::float8 when 'important' then 2::float8 when 'useful' then 1::float8 else 1::float8 end end;
      v_num := v_num + (least(v_have, (q.x->>'level')::int)::float8 / (q.x->>'level')::int::float8) * v_wt;
      v_den := v_den + v_wt;
      if v_have < (q.x->>'level')::int then
        v_gaps := v_gaps || jsonb_build_array(jsonb_build_object('kind', q.x->>'kind', 'ref_id', q.x->>'ref_id', 'have', v_have, 'need', (q.x->>'level')::int, 'importance', q.x->>'importance',
          'why', jsonb_build_object('en', coalesce(q.x->>'why_en', ''), 'ar', coalesce(nullif(q.x->>'why_ar', ''), nullif(q.x->>'why_en', ''), ''))));
      end if;
    end loop;
    select coalesce(jsonb_agg(x order by (x->>'need')::int - (x->>'have')::int desc, ((x->>'kind') || ':' || (x->>'ref_id')) collate "C"), '[]'::jsonb) into v_gaps from jsonb_array_elements(v_gaps) x;
    v_score := case when v_den > 0 then floor(v_num / v_den * 10000 + 0.5) / 10000 else 0 end;
    v_pct := floor(v_score * 100 + 0.5)::int;
    v_gap_m := least(120, 2 * coalesce((select sum((x->>'need')::int - (x->>'have')::int) from jsonb_array_elements(v_gaps) x), 0))::int;
    select coalesce(jsonb_agg(jsonb_build_object('edge_id', b.id, 'from_role_id', b.from_role_id, 'mine', b.mine, 'need_months', b.need, 'remaining_months', b.rem)
             order by b.mine desc, b.srt, b.id collate "C"), '[]'::jsonb) into v_bridges
    from (
      select e.id, e.from_role_id, coalesce(e.sort, 0) as srt, coalesce(v_role is not null and e.from_role_id = v_role, false) as mine, m.need,
        case when coalesce(v_role is not null and e.from_role_id = v_role, false) and v_qual then greatest(0, m.need - v_mir) else m.need end as rem
      from kafaa_career_paths e
      cross join lateral (select coalesce(max((c->>'value')::numeric::int) filter (where c->>'kind' = 'months' and jsonb_typeof(c->'value') = 'number'), 0) as need
                          from jsonb_array_elements(case when jsonb_typeof(e.conditions) = 'array' then e.conditions else '[]'::jsonb end) c) m
      where e.to_role_id = r.role_id and coalesce(e.kind, 'current') = 'future'
    ) b;
    v_bridge := v_bridges -> 0;
    v_months := greatest(v_gap_m, coalesce((v_bridge->>'remaining_months')::int, 0));
    v_band := case when v_score >= 0.85 and v_months = 0 then 'profile_met' when v_months <= 36 then 'within' else 'stretch' end;
    v_reasons := jsonb_build_array(jsonb_build_object('code', 'readiness', 'key', 'common.engines.reason.readiness', 'vars', jsonb_build_object('pct', v_pct)),
      jsonb_build_object('code', 'fs15_profile', 'key', 'm18.fs15.reason.profile', 'vars', jsonb_build_object('horizon', pv.horizon, 'version', pv.version), 'ref', jsonb_build_object('table', 'role_profile_versions', 'id', pv.id)));
    if v_bridge is null then
      v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'fs15_bridge_none', 'key', 'm18.fs15.reason.bridge_none'));
    else
      v_from := coalesce((select jsonb_build_object('en', j.title_en, 'ar', j.title_ar) from kafaa_job_roles j where j.id = v_bridge->>'from_role_id'),
                         jsonb_build_object('en', coalesce(v_bridge->>'from_role_id', ''), 'ar', coalesce(v_bridge->>'from_role_id', '')));
      if not (v_bridge->>'mine')::boolean then
        v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'fs15_bridge_other', 'key', 'm18.fs15.reason.bridge_other', 'vars', jsonb_build_object('role', v_from, 'months', (v_bridge->'need_months')), 'ref', jsonb_build_object('table', 'career_paths', 'id', v_bridge->>'edge_id')));
      elsif (v_bridge->>'remaining_months')::int > 0 then
        v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'fs15_bridge_wait', 'key', 'm18.fs15.reason.bridge_wait', 'vars', jsonb_build_object('months', (v_bridge->'remaining_months')), 'ref', jsonb_build_object('table', 'career_paths', 'id', v_bridge->>'edge_id')));
      else
        v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'fs15_bridge_met', 'key', 'm18.fs15.reason.bridge_met', 'vars', jsonb_build_object('role', v_from), 'ref', jsonb_build_object('table', 'career_paths', 'id', v_bridge->>'edge_id')));
      end if;
    end if;
    for g in select x, ord from jsonb_array_elements(v_gaps) with ordinality t(x, ord) where ord <= 3 order by ord loop
      v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'fs15_gap', 'key', 'm18.fs15.reason.gap',
        'vars', jsonb_build_object('skill', case when g.x->>'kind' = 'skill'
                                                 then coalesce((select jsonb_build_object('en', s.name_en, 'ar', coalesce(s.name_ar, s.name_en)) from kafaa_skills s where s.id = g.x->>'ref_id'), jsonb_build_object('en', g.x->>'ref_id', 'ar', g.x->>'ref_id'))
                                                 else coalesce((select jsonb_build_object('en', c.name_en, 'ar', c.name_ar) from kafaa_competencies c where c.id = g.x->>'ref_id'), jsonb_build_object('en', g.x->>'ref_id', 'ar', g.x->>'ref_id')) end,
                                   'from', g.x->'have', 'to', g.x->'need'),
        'ref', jsonb_build_object('table', case when g.x->>'kind' = 'skill' then 'skills' else 'competencies' end, 'id', g.x->>'ref_id')));
    end loop;
    if v_band = 'profile_met' then v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'fs15_band_met', 'key', 'm18.fs15.reason.band_met'));
    else v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'fs15_band_' || v_band, 'key', 'm18.fs15.reason.band_' || v_band, 'vars', jsonb_build_object('months', v_months)));
    end if;
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'fs15_concept', 'key', 'm18.fs15.reason.concept'));
    v_out := v_out || jsonb_build_array(jsonb_build_object('role_id', r.role_id, 'concept', true, 'profile_id', pv.id, 'horizon', pv.horizon, 'version', pv.version,
      'score', v_score, 'pct', v_pct, 'band', v_band, 'months', v_months, 'gap_months', v_gap_m, 'bridge', v_bridge, 'bridges', jsonb_array_length(v_bridges), 'gaps', v_gaps, 'reasons', v_reasons));
  end loop;
  return v_out;
end $$;

-- One suppressed cell: n and median when at least p_min moves, else nothing.
create or replace function kafaa_fs15_cell(p_months integer[], p_min integer) returns jsonb language sql immutable set search_path = public as $$
  select case when coalesce(cardinality(p_months), 0) < p_min then jsonb_build_object('n', null, 'median_months', null, 'suppressed', true)
              else jsonb_build_object('n', cardinality(p_months), 'median_months', (select percentile_cont(0.5) within group (order by m) from unnest(p_months) m), 'suppressed', false) end
$$;

create or replace function kafaa_fs15_transition_compute(p_from text, p_to text[], p_min integer default 10) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_out jsonb := '[]'::jsonb; r record; fr kafaa_job_roles; tr kafaa_job_roles; v_cell jsonb; v_an jsonb; v_reasons jsonb; v_concept boolean;
begin
  select * into fr from kafaa_job_roles where id = p_from;
  for r in select u.x as role_id, min(u.ord) as ord from unnest(coalesce(p_to, '{}'::text[])) with ordinality u(x, ord) group by u.x order by min(u.ord) limit 40 loop
    select * into tr from kafaa_job_roles where id = r.role_id;
    if not found or fr.id is null or r.role_id = p_from then continue; end if;
    v_concept := tr.lifecycle = 'concept';
    if coalesce(tr.security_sensitive, false) or coalesce(fr.security_sensitive, false) then
      v_out := v_out || jsonb_build_array(jsonb_build_object('from_role_id', p_from, 'to_role_id', r.role_id, 'concept', v_concept, 'path_only', true, 'n', null, 'median_months', null, 'suppressed', true,
        'analogue', null, 'reasons', jsonb_build_array(jsonb_build_object('code', 'path_only', 'key', 'common.engines.reason.path_only'))));
      continue;
    end if;
    v_cell := kafaa_fs15_cell(array(select m.months_before from kafaa_role_moves m where m.from_role_id = p_from and m.to_role_id = r.role_id), p_min);
    v_an := null; v_reasons := '[]'::jsonb;
    if v_concept then
      v_reasons := jsonb_build_array(jsonb_build_object('code', 'fs15_tr_concept', 'key', 'm18.fs15.reason.tr_concept'));
      if coalesce(tr.family_id, '') <> '' then
        v_an := jsonb_build_object('family_id', tr.family_id) || kafaa_fs15_cell(array(
          select m.months_before from kafaa_role_moves m join kafaa_job_roles j on j.id = m.to_role_id
          where m.from_role_id = p_from and j.family_id = tr.family_id and j.lifecycle <> 'concept' and not coalesce(j.security_sensitive, false) and j.id <> p_from), p_min);
        v_reasons := v_reasons || jsonb_build_array(case when (v_an->>'suppressed')::boolean
          then jsonb_build_object('code', 'fs15_tr_analogue_suppressed', 'key', 'm18.fs15.reason.tr_analogue_suppressed', 'vars', jsonb_build_object('min', p_min))
          else jsonb_build_object('code', 'fs15_tr_analogue', 'key', 'm18.fs15.reason.tr_analogue', 'vars', jsonb_build_object('n', v_an->'n', 'months', v_an->'median_months')) end);
      end if;
    else
      v_reasons := jsonb_build_array(case when (v_cell->>'suppressed')::boolean
        then jsonb_build_object('code', 'fs15_tr_suppressed', 'key', 'm18.fs15.reason.tr_suppressed', 'vars', jsonb_build_object('min', p_min))
        else jsonb_build_object('code', 'fs15_tr_count', 'key', 'm18.fs15.reason.tr_count', 'vars', jsonb_build_object('n', v_cell->'n', 'months', v_cell->'median_months')) end);
    end if;
    v_out := v_out || jsonb_build_array(jsonb_build_object('from_role_id', p_from, 'to_role_id', r.role_id, 'concept', v_concept, 'path_only', false, 'analogue', v_an, 'reasons', v_reasons) || v_cell);
  end loop;
  return v_out;
end $$;

-- ───────────── FS15 RPCs (read-only)
create or replace function kafaa_future_role_readiness(p_person text, p_role_ids text[]) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me();
begin
  if me is null then return kafaa_refuse('career.future_readiness', 'career_targets', p_person, 'not_signed_in', 'Sign in to see your career readiness'); end if;
  if p_person is null or not exists (select 1 from kafaa_people where id = p_person) then return kafaa_refuse('career.future_readiness', 'career_targets', p_person, 'not_found', 'Person not found'); end if;
  if p_person = me then
    if not kafaa_has_grant('skills_profile', array['Own', 'Scope']) then return kafaa_refuse('career.future_readiness', 'career_targets', p_person, 'forbidden', 'Career readiness is for staff with a skills profile'); end if;
  elsif not (kafaa_has_grant('skills_profile', array['Scope']) and kafaa_in_scope('skills_profile', p_person)
             and (exists (select 1 from kafaa_career_targets t where t.person_id = p_person and t.shared and t.active)
                  or exists (select 1 from kafaa_roadmaps m where m.person_id = p_person and m.shared and m.active))) then
    return kafaa_refuse('career.future_readiness', 'career_targets', p_person, 'forbidden', 'This person has not shared their career plans with you');
  end if;
  return kafaa_result(true, 'ok', '', null::kafaa_audit_events, null, kafaa_fs15_concept_readiness_compute(p_person, case when p_role_ids is null then null else p_role_ids[1:40] end, current_date));
end $$;

create or replace function kafaa_transition_evidence(p_from text, p_to text[]) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me();
begin
  if me is null then return kafaa_refuse('career.transitions', 'role_moves', p_from, 'not_signed_in', 'Sign in to see career moves'); end if;
  if not (kafaa_has_grant('skills_profile', array['Own', 'Scope', 'Agg', 'A']) or kafaa_has_grant('transformation', array['R'])) then
    return kafaa_refuse('career.transitions', 'role_moves', p_from, 'forbidden', 'Career move evidence is for staff');
  end if;
  if p_from is null or not exists (select 1 from kafaa_job_roles where id = p_from) then return kafaa_refuse('career.transitions', 'role_moves', p_from, 'not_found', 'Role not found'); end if;
  return kafaa_result(true, 'ok', '', null::kafaa_audit_events, null, kafaa_fs15_transition_compute(p_from, coalesce(p_to, '{}'::text[]), 10));
end $$;

-- ───────────── FS16 rules (mirror of src/modules/m18/outlookLabels.ts). Internal: not executable by API roles.
create or replace function kafaa_fs16_r1(p float8) returns float8 language sql immutable set search_path = public as $$ select floor(p * 10 + 0.5) / 10 $$;

create or replace function kafaa_fs16_label(p_c jsonb, p_th jsonb) returns text language sql immutable set search_path = public as $$
  select case
    when jsonb_typeof(p_th->'change_min_pct') = 'number' and jsonb_typeof(p_c->'change_pct') = 'number' and (p_c->>'change_pct')::float8 >= (p_th->>'change_min_pct')::float8 then 'changing'
    when jsonb_typeof(p_c->'growth_pct') = 'number' and jsonb_typeof(p_c->'shortfall_pct') = 'number'
         and (p_c->>'growth_pct')::float8 >= (p_th->>'growth_min_pct')::float8 and (p_c->>'shortfall_pct')::float8 > (p_th->>'shortfall_min_pct')::float8 then 'growing'
    else 'stable' end
$$;

/** The latest released F35 outlook: {id, results} or null. */
create or replace function kafaa_fs16_outlook() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', o.id, 'results', o.results) from kafaa_skill_outlooks o where o.status = 'released' order by o.released_at desc nulls last, o.id collate "C" limit 1
$$;

create or replace function kafaa_fs16_components(p_role text, p_th jsonb, p_outlook jsonb) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  jr kafaa_job_roles; a record; f jsonb; y0 jsonb; yh jsonb; d0 float8; dh float8; v_g float8; v_s float8;
  v_gn float8 := 0; v_sn float8 := 0; v_ws float8 := 0; v_fams jsonb := '[]'::jsonb;
  v_now kafaa_role_profile_versions; v_fut kafaa_role_profile_versions; v_base integer := 0; v_delta integer := 0; v_added integer := 0; v_raised integer := 0; q record; v_was integer;
  v_change jsonb := null; v_cpct float8 := null; v_has_change boolean := jsonb_typeof(p_th->'change_min_pct') = 'number';
  v_by integer := (p_th->>'base_year')::int; v_hy integer := (p_th->>'horizon_year')::int;
begin
  select * into jr from kafaa_job_roles where id = p_role;
  if not found or coalesce(jr.lifecycle, 'current') <> 'current' or coalesce(jr.security_sensitive, false) then return null; end if;
  for a in
    select x.area, sum(x.w)::int as w from (
      select (select s.area from kafaa_skills s where s.core and s.competency_id = rc.competency_id order by coalesce(s.sort, 0), s.id collate "C" limit 1) as area,
             case rc.importance when 'core' then 3 when 'important' then 2 when 'useful' then 1 else 1 end as w
      from kafaa_role_competencies rc where rc.role_id = p_role
    ) x where x.area is not null and x.area <> 'security' group by x.area order by x.area collate "C"
  loop
    select fam into f from jsonb_array_elements(coalesce(p_outlook->'results'->'families', '[]'::jsonb)) fam where fam->>'key' = a.area limit 1;
    y0 := null; yh := null;
    if f is not null then
      select y into y0 from jsonb_array_elements(coalesce(f->'years', '[]'::jsonb)) y where (y->>'year')::int = v_by limit 1;
      select y into yh from jsonb_array_elements(coalesce(f->'years', '[]'::jsonb)) y where (y->>'year')::int = v_hy limit 1;
    end if;
    if f is null or coalesce((f->>'suppressed')::boolean, false) or y0 is null or yh is null or not ((y0->>'demand')::float8 > 0) or not ((yh->>'demand')::float8 > 0) then
      v_fams := v_fams || jsonb_build_array(jsonb_build_object('key', a.area, 'weight', a.w, 'suppressed', true, 'growth_pct', null, 'shortfall_pct', null));
      continue;
    end if;
    d0 := (y0->>'demand')::float8; dh := (yh->>'demand')::float8;
    v_g := ((dh - d0) / d0) * 100;
    v_s := ((yh->>'gap')::float8 / dh) * 100;
    v_gn := v_gn + a.w::float8 * v_g;
    v_sn := v_sn + a.w::float8 * v_s;
    v_ws := v_ws + a.w::float8;
    v_fams := v_fams || jsonb_build_array(jsonb_build_object('key', a.area, 'weight', a.w, 'suppressed', false, 'growth_pct', kafaa_fs16_r1(v_g), 'shortfall_pct', kafaa_fs16_r1(v_s)));
  end loop;
  select * into v_now from kafaa_role_profile_versions v where v.role_id = p_role and v.horizon = 'now' and v.status = 'published' order by v.version desc limit 1;
  select * into v_fut from kafaa_role_profile_versions v where v.role_id = p_role and v.horizon = '2030' and v.status = 'published' order by v.version desc limit 1;
  if v_now.id is not null and v_fut.id is not null then
    select coalesce(sum(case x->>'importance' when 'core' then 3 when 'important' then 2 when 'useful' then 1 else 1 end * (x->>'level')::int), 0)::int into v_base
    from jsonb_array_elements(case when jsonb_typeof(v_now.requirements) = 'array' then v_now.requirements else '[]'::jsonb end) x;
    for q in select x from jsonb_array_elements(case when jsonb_typeof(v_fut.requirements) = 'array' then v_fut.requirements else '[]'::jsonb end) x loop
      select (y->>'level')::int into v_was from jsonb_array_elements(case when jsonb_typeof(v_now.requirements) = 'array' then v_now.requirements else '[]'::jsonb end) y
        where y->>'kind' = q.x->>'kind' and y->>'ref_id' = q.x->>'ref_id' limit 1;
      if not found then
        v_added := v_added + 1; v_delta := v_delta + case q.x->>'importance' when 'core' then 3 when 'important' then 2 when 'useful' then 1 else 1 end * (q.x->>'level')::int;
      elsif (q.x->>'level')::int > v_was then
        v_raised := v_raised + 1; v_delta := v_delta + case q.x->>'importance' when 'core' then 3 when 'important' then 2 when 'useful' then 1 else 1 end * ((q.x->>'level')::int - v_was);
      end if;
    end loop;
    v_change := jsonb_build_object('now_id', v_now.id, 'to_id', v_fut.id, 'added', v_added, 'raised', v_raised, 'base', v_base, 'delta', v_delta);
    v_cpct := case when v_base > 0 then kafaa_fs16_r1((v_delta::float8 / v_base::float8) * 100) end;
  end if;
  return jsonb_build_object(
    'growth_pct', case when v_ws > 0 then to_jsonb(kafaa_fs16_r1(v_gn / v_ws)) else 'null'::jsonb end,
    'shortfall_pct', case when v_ws > 0 then to_jsonb(kafaa_fs16_r1(v_sn / v_ws)) else 'null'::jsonb end,
    'change_pct', case when v_has_change and v_cpct is not null then to_jsonb(v_cpct) else 'null'::jsonb end,
    'families', v_fams,
    'change', case when v_has_change and v_change is not null then v_change else 'null'::jsonb end,
    'outlook_id', coalesce(p_outlook->'id', 'null'::jsonb),
    'base_year', v_by, 'horizon_year', v_hy);
end $$;

/** Labels for every labelled role for one year under the criteria in force: {criteria_id, rows: [{id, role_id, year, label, criteria_id, components}]}. */
create or replace function kafaa_fs16_compute(p_year integer) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare cr kafaa_role_outlook_criteria; v_ol jsonb := kafaa_fs16_outlook(); r record; c jsonb; v_rows jsonb := '[]'::jsonb;
begin
  select * into cr from kafaa_role_outlook_criteria where year_from <= p_year order by year_from desc, version desc limit 1;
  if not found then return null; end if;
  for r in select j.id from kafaa_job_roles j where coalesce(j.lifecycle, 'current') = 'current' and not coalesce(j.security_sensitive, false) order by j.id collate "C" loop
    c := kafaa_fs16_components(r.id, cr.thresholds, v_ol);
    if c is null then continue; end if;
    v_rows := v_rows || jsonb_build_array(jsonb_build_object('id', 'rol-' || r.id || '-' || p_year, 'role_id', r.id, 'year', p_year, 'label', kafaa_fs16_label(c, cr.thresholds), 'criteria_id', cr.id, 'components', c));
  end loop;
  return jsonb_build_object('criteria_id', cr.id, 'rows', v_rows);
end $$;

-- ───────────── FS16 RPCs
create or replace function kafaa_outlook_labels_preview(p_year integer) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v jsonb; v_rows jsonb;
begin
  if me is null then return kafaa_refuse('outlook.preview', 'role_outlook_labels', p_year::text, 'not_signed_in', 'Sign in to preview outlook labels'); end if;
  if not kafaa_has_grant('transformation', array['W', 'A']) then return kafaa_refuse('outlook.preview', 'role_outlook_labels', p_year::text, 'forbidden', 'Only the training manager or the HR director can preview outlook labels'); end if;
  if p_year is null or p_year <> extract(year from current_date)::int then return kafaa_refuse('outlook.preview', 'role_outlook_labels', p_year::text, 'invalid', 'Labels are computed for the current year only'); end if;
  v := kafaa_fs16_compute(p_year);
  if v is null then return kafaa_refuse('outlook.preview', 'role_outlook_labels', p_year::text, 'not_found', 'No published criteria for this year'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('role_id', x->>'role_id', 'label', x->>'label', 'components', x->'components', 'stored_label', l.label,
           'changed', l.label is distinct from (x->>'label')) order by ord), '[]'::jsonb) into v_rows
  from jsonb_array_elements(v->'rows') with ordinality t(x, ord) left join kafaa_role_outlook_labels l on l.role_id = x->>'role_id' and l.year = p_year;
  return kafaa_result(true, 'ok', '', null::kafaa_audit_events, null, jsonb_build_object('year', p_year, 'criteria_id', v->>'criteria_id', 'rows', v_rows,
    'counts', jsonb_build_object('growing', (select count(*) from jsonb_array_elements(v_rows) x where x->>'label' = 'growing'), 'stable', (select count(*) from jsonb_array_elements(v_rows) x where x->>'label' = 'stable'),
                                 'changing', (select count(*) from jsonb_array_elements(v_rows) x where x->>'label' = 'changing')),
    'changed', (select count(*) from jsonb_array_elements(v_rows) x where (x->>'changed')::boolean)));
end $$;

create or replace function kafaa_publish_outlook_labels(p_year integer) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text := kafaa_acting_role('transformation', array['A']); v_cur integer := extract(year from current_date)::int;
  v jsonb; x jsonb; v_old text; v_changed integer := 0; v_n integer := 0; v_g integer := 0; v_s integer := 0; v_c integer := 0; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('outlook.publish', 'role_outlook_labels', p_year::text, 'not_signed_in', 'Sign in to publish outlook labels', v_role); end if;
  if v_role is null then return kafaa_refuse('outlook.publish', 'role_outlook_labels', p_year::text, 'forbidden', 'Only the HR director can publish outlook labels', v_role); end if;
  if p_year is null or p_year > v_cur or p_year < 2000 then return kafaa_refuse('outlook.publish', 'role_outlook_labels', p_year::text, 'invalid', 'Labels are published for the current year only', v_role); end if;
  if p_year < v_cur then return kafaa_refuse('outlook.publish', 'role_outlook_labels', p_year::text, 'past_year_locked', 'Past years are kept as published and cannot be changed', v_role); end if;
  v := kafaa_fs16_compute(p_year);
  if v is null then return kafaa_refuse('outlook.publish', 'role_outlook_labels', p_year::text, 'not_found', 'No published criteria for this year', v_role); end if;
  if jsonb_array_length(v->'rows') = 0 then return kafaa_refuse('outlook.publish', 'role_outlook_labels', p_year::text, 'invalid', 'No role could be labelled from the current inputs', v_role); end if;
  for x in select r from jsonb_array_elements(v->'rows') r loop
    v_n := v_n + 1;
    if x->>'label' = 'growing' then v_g := v_g + 1; elsif x->>'label' = 'stable' then v_s := v_s + 1; else v_c := v_c + 1; end if;
    select label into v_old from kafaa_role_outlook_labels where id = x->>'id';
    if not found or v_old <> x->>'label' then v_changed := v_changed + 1; end if;
    insert into kafaa_role_outlook_labels (id, role_id, year, label, criteria_id, archived, as_of, published_by_role, published_at)
    values (x->>'id', x->>'role_id', p_year, x->>'label', x->>'criteria_id', false, current_date, v_role, now())
    on conflict (id) do update set label = excluded.label, criteria_id = excluded.criteria_id, archived = false, as_of = excluded.as_of, published_by_role = excluded.published_by_role, published_at = excluded.published_at;
    insert into kafaa_role_outlook_components (id, role_id, year, criteria_id, components, computed_at)
    values (x->>'id', x->>'role_id', p_year, x->>'criteria_id', x->'components', now())
    on conflict (id) do update set criteria_id = excluded.criteria_id, components = excluded.components, computed_at = excluded.computed_at;
  end loop;
  l := kafaa_ledger('kafaa.careers.outlook_labels_publish', format('Role outlook labels %s published under %s: %s growing, %s changing, %s stable', p_year, v->>'criteria_id', v_g, v_c, v_s));
  a := kafaa_audit('outlook.publish', 'role_outlook_labels', p_year::text, 'ok', format('%s labels for %s under %s (%s changed)', v_n, p_year, v->>'criteria_id', v_changed), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', format('Outlook labels for %s published', p_year), a, l,
    jsonb_build_object('year', p_year, 'criteria_id', v->>'criteria_id', 'published', v_n, 'changed', v_changed, 'counts', jsonb_build_object('growing', v_g, 'stable', v_s, 'changing', v_c)));
end $$;

revoke execute on function kafaa_fs15_concept_readiness_compute(text, text[], date), kafaa_fs15_cell(integer[], integer), kafaa_fs15_transition_compute(text, text[], integer),
  kafaa_fs16_r1(float8), kafaa_fs16_label(jsonb, jsonb), kafaa_fs16_outlook(), kafaa_fs16_components(text, jsonb, jsonb), kafaa_fs16_compute(integer) from public, anon, authenticated;
revoke execute on function kafaa_future_role_readiness(text, text[]), kafaa_transition_evidence(text, text[]), kafaa_outlook_labels_preview(integer), kafaa_publish_outlook_labels(integer) from public, anon;
grant execute on function kafaa_future_role_readiness(text, text[]), kafaa_transition_evidence(text, text[]), kafaa_outlook_labels_preview(integer), kafaa_publish_outlook_labels(integer) to authenticated;

-- ───────────── F24 navigator engine card, version + 1 (FS15 inputs and scoring functions). Data only, guarded: runs once.
update kafaa_engine_cards set
  inputs_used = inputs_used || '[{"key":"role_profile_versions","en":"FS05 role profiles for concept future roles (the 2030 profile, else 2035): planning assumptions, no deployment decision implied","ar":"ملفات أدوار FS05 للأدوار المستقبلية المفاهيمية (ملف 2030، وإلا 2035): افتراضات تخطيطية، ولا قرار نشر ضمني"},{"key":"role_moves","en":"How many colleagues made a move and the median months in the previous role (SIMULATED anonymised mirror; counts under 10 suppressed)","ar":"عدد الزملاء الذين أجروا الانتقال ووسيط الأشهر في الدور السابق (نسخة محاكاة مجهولة الهوية؛ تُحجب الأعداد الأقل من 10)"}]'::jsonb,
  scoring_functions = scoring_functions || array['src/modules/m18/futureRoles.ts#conceptReadiness', 'src/modules/m18/futureRoles.ts#transitionEvidence', 'sql:kafaa_fs15_concept_readiness_compute', 'sql:kafaa_fs15_transition_compute']::text[],
  limitations_en = 'Covers only skills Kafa''a holds evidence for; it does not measure performance, potential or motivation. Security roles show the path only. Concept future roles are measured against their FS05 profile: no vacancy and no deployment decision implied, never "ready now". The F24 fairness metric counts current roles only.',
  limitations_ar = 'يغطي فقط المهارات التي لدى كفاءة أدلة عليها؛ ولا يقيس الأداء أو الإمكانات أو الدافعية. تعرض أدوار الأمن المسار فقط. تُقاس الأدوار المستقبلية المفاهيمية مقابل ملف FS05 الخاص بها: لا وظيفة شاغرة ولا قرار نشر ضمني، ولا تصنَّف أبداً "جاهز الآن". يحتسب مقياس العدالة في F24 الأدوار الحالية فقط.',
  feature = 'F05 · F06 · FS15',
  version = version + 1,
  last_changed_at = '2026-10-10T00:00:00Z'
where id = 'navigator' and not ('src/modules/m18/futureRoles.ts#conceptReadiness' = any(scoring_functions));
