-- [W1 · E2] F05 Career Navigator and F06 Career Roadmap (module M18).
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file, RLS in the per-statement form,
-- the share trigger, the SQL mirror of src/modules/m18/career.ts (kafaa_career_readiness_compute, checked against the TS rules by
-- scripts/validate/w1e2-career.mjs) and two RPCs. LocalBackend mirror: src/modules/m18/backend/local.ts.

-- ───────────── Tables (generated DDL)
-- M18 · Career Navigator shortlist: up to three target roles per person, optionally shared with the line manager (F05)
create table if not exists kafaa_career_targets (
  id text primary key,
  person_id text not null,
  role_id text not null,
  rank integer not null default 1,
  shared boolean not null default false,
  shared_person_id text,
  active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table kafaa_career_targets is '[M18] Career Navigator shortlist: up to three target roles per person, optionally shared with the line manager (F05)';

-- M18 · Career roadmap scenario towards a target role, with its computed timeline (F06)
create table if not exists kafaa_roadmaps (
  id text primary key,
  person_id text not null,
  target_role_id text not null,
  name text not null default '',
  scenario jsonb not null default '{}'::jsonb,
  plan jsonb not null default '[]'::jsonb,
  earliest_on date,
  end_on date,
  shared boolean not null default false,
  shared_person_id text,
  active boolean not null default true,
  sent_plan_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table kafaa_roadmaps is '[M18] Career roadmap scenario towards a target role, with its computed timeline (F06)';

do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_career_targets_person_id_fk') then alter table kafaa_career_targets add constraint kafaa_career_targets_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_career_targets_role_id_fk') then alter table kafaa_career_targets add constraint kafaa_career_targets_role_id_fk foreign key (role_id) references kafaa_job_roles(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_roadmaps_person_id_fk') then alter table kafaa_roadmaps add constraint kafaa_roadmaps_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_roadmaps_target_role_id_fk') then alter table kafaa_roadmaps add constraint kafaa_roadmaps_target_role_id_fk foreign key (target_role_id) references kafaa_job_roles(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_career_targets_person_id_idx on kafaa_career_targets (person_id);
create index if not exists kafaa_career_targets_shared_person_id_idx on kafaa_career_targets (shared_person_id);
create index if not exists kafaa_roadmaps_person_id_idx on kafaa_roadmaps (person_id);
create index if not exists kafaa_roadmaps_shared_person_id_idx on kafaa_roadmaps (shared_person_id);

-- ───────────── Share sync: shared_person_id mirrors person_id while a row is shared (the Scope read rule matches nothing otherwise);
-- a shortlist holds at most three active target roles.
create or replace function kafaa_career_share_sync() returns trigger language plpgsql set search_path = public as $$
begin
  new.shared_person_id := case when new.shared then new.person_id end;
  if tg_table_name = 'kafaa_career_targets' and new.active and coalesce(current_setting('kafaa.seeding', true), '') <> 'on'
     and (select count(*) from kafaa_career_targets t where t.person_id = new.person_id and t.active and t.id <> new.id) >= 3 then
    raise exception 'A shortlist holds at most three target roles' using errcode = 'check_violation';
  end if;
  return new;
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'kafaa_career_targets_share') then
    execute 'create trigger kafaa_career_targets_share before insert or update on kafaa_career_targets for each row execute function kafaa_career_share_sync()'; end if;
  if not exists (select 1 from pg_trigger where tgname = 'kafaa_roadmaps_share') then
    execute 'create trigger kafaa_roadmaps_share before insert or update on kafaa_roadmaps for each row execute function kafaa_career_share_sync()'; end if;
  if not exists (select 1 from pg_trigger where tgname = 'kafaa_career_targets_audit') then
    execute 'create trigger kafaa_career_targets_audit after insert or update on kafaa_career_targets for each row execute function kafaa_audit_row()'; end if;
  if not exists (select 1 from pg_trigger where tgname = 'kafaa_roadmaps_audit') then
    execute 'create trigger kafaa_roadmaps_audit after insert or update on kafaa_roadmaps for each row execute function kafaa_audit_row()'; end if;
end $$;

-- ───────────── RLS (policies created when missing, then set to the per-statement form like 20261008140000_kafaa_rls_perf.sql)
-- Read: the person (own_profile Own); a line manager or instructor in scope (skills_profile Scope) only while the row is shared.
alter table kafaa_career_targets enable row level security;
alter table kafaa_roadmaps enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_career_targets' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_career_targets for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_career_targets' and policyname = 'kafaa_insert') then
    execute 'create policy kafaa_insert on kafaa_career_targets for insert to anon, authenticated with check (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_career_targets' and policyname = 'kafaa_update') then
    execute 'create policy kafaa_update on kafaa_career_targets for update to authenticated using (false) with check (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_roadmaps' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_roadmaps for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_roadmaps' and policyname = 'kafaa_insert') then
    execute 'create policy kafaa_insert on kafaa_roadmaps for insert to anon, authenticated with check (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_roadmaps' and policyname = 'kafaa_update') then
    execute 'create policy kafaa_update on kafaa_roadmaps for update to authenticated using (false) with check (false)'; end if;
end $$;
alter policy kafaa_read on kafaa_career_targets using (
  (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false)))
  OR ((shared AND (SELECT kafaa_has_grant('skills_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((shared_person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('skills_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('skills_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('skills_profile'::text, shared_person_id, NULL::text, false))));
alter policy kafaa_read on kafaa_roadmaps using (
  (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false)))
  OR ((shared AND (SELECT kafaa_has_grant('skills_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((shared_person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('skills_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('skills_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('skills_profile'::text, shared_person_id, NULL::text, false))));
alter policy kafaa_insert on kafaa_career_targets with check (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['W'::text, 'A'::text])) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text])))));
alter policy kafaa_update on kafaa_career_targets using (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['W'::text, 'A'::text])) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))))) with check (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['W'::text, 'A'::text])) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text])))));
alter policy kafaa_insert on kafaa_roadmaps with check (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['W'::text, 'A'::text])) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text])))));
alter policy kafaa_update on kafaa_roadmaps using (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['W'::text, 'A'::text])) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))))) with check (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['W'::text, 'A'::text])) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text])))));
grant select, insert, update on kafaa_career_targets, kafaa_roadmaps to authenticated;
grant select on kafaa_career_targets, kafaa_roadmaps to anon;

-- ───────────── Rules (mirror of src/modules/m18/career.ts)
create or replace function kafaa_career_months(p_from date, p_to date) returns integer language sql immutable set search_path = public as $$
  select greatest(0, (extract(year from p_to)::int - extract(year from p_from)::int) * 12 + (extract(month from p_to)::int - extract(month from p_from)::int)
    - case when extract(day from p_to) < extract(day from p_from) then 1 else 0 end)
$$;

create or replace function kafaa_career_readiness_compute(p_person text, p_role_ids text[], p_now date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_role text; v_hire date; v_edu text; v_lic text; v_since date; v_qual boolean; v_mir integer; v_prog jsonb; v_w jsonb;
  v_out jsonb := '[]'::jsonb; r record; jr kafaa_job_roles; e record; c jsonb;
  v_num float8; v_den float8; v_score float8; v_pct integer; v_gaps jsonb; v_routes jsonb; v_route jsonb; v_conds jsonb; v_cond jsonb;
  v_mine boolean; v_need integer; v_have integer; v_st text; v_note text; v_rem integer; v_codes text[]; v_ok boolean;
  v_primary jsonb; v_gate text; v_gate_m integer; v_gap_m integer; v_months integer; v_band text; v_reasons jsonb; g record; v_n integer;
  edu constant jsonb := '{"high_school":1,"diploma":2,"bachelor":3,"master":4}';
begin
  select p.job_role_id, p.hire_date into v_role, v_hire from kafaa_people p where p.id = p_person;
  select j.education into v_edu from kafaa_job_roles j where j.id = v_role;
  v_lic := case v_role when 'reactor-operator' then 'RO' when 'senior-reactor-operator' then 'SRO' end;
  if v_lic is not null then
    select min(l.issued_on) into v_since from kafaa_licences l where l.person_id = p_person and l.type = v_lic and l.status = 'valid';
  elsif exists (select 1 from kafaa_qual_standards s where v_role = any(s.role_ids)) then
    select min(q.qualified_on) into v_since from kafaa_qual_records q
    where q.person_id = p_person and q.standard_id in (select s.id from kafaa_qual_standards s where v_role = any(s.role_ids))
      and q.status in ('qualified', 'due', 'renewed') and q.qualified_on is not null and (q.expires_on is null or q.expires_on >= p_now);
  elsif v_role is not null then
    v_since := v_hire;
  end if;
  v_qual := v_since is not null;
  v_mir := case when v_since is null then 0 else kafaa_career_months(v_since, p_now) end;
  select coalesce(jsonb_object_agg(x.code, case when x.passed = x.total then 'done' else 'in_progress' end), '{}'::jsonb) into v_prog
  from (
    select upper(pr.code) as code, count(*) as total,
      count(*) filter (where exists (select 1 from kafaa_training_records t where t.person_id = p_person and t.course_id = co.id and t.result in ('passed', 'completed'))) as passed,
      bool_or(exists (select 1 from kafaa_enrolments en where en.person_id = p_person and en.course_id = co.id and en.status in ('enrolled', 'in_progress', 'assigned', 'completed'))) as enrolled
    from kafaa_programmes pr join kafaa_courses co on co.programme_id = pr.id group by pr.id, pr.code
  ) x where x.passed = x.total or x.passed > 0 or x.enrolled;
  select s.weights into v_w from kafaa_engine_settings s where s.id = 'recommend';
  v_w := coalesce(v_w, '{}'::jsonb);

  for r in select u.x as role_id, min(u.ord) as ord from unnest(coalesce(p_role_ids, '{}'::text[])) with ordinality u(x, ord) group by u.x order by min(u.ord) limit 40 loop
    select * into jr from kafaa_job_roles j where j.id = r.role_id;
    if not found then continue; end if;
    if jr.security_sensitive then
      v_out := v_out || jsonb_build_array(jsonb_build_object('role_id', r.role_id, 'path_only', true, 'score', null, 'pct', null, 'band', 'path_only', 'months', null,
        'gate_status', 'none', 'primary_route', null, 'routes', '[]'::jsonb, 'gaps', '[]'::jsonb,
        'reasons', jsonb_build_array(jsonb_build_object('code', 'path_only', 'key', 'common.engines.reason.path_only'))));
      continue;
    end if;
    with lv as (
      select s.competency_id, coalesce(max(ps.level) filter (where s.core), max(ps.level)) as lvl
      from kafaa_person_skills ps join kafaa_skills s on s.id = ps.skill_id where ps.person_id = p_person and ps.active group by s.competency_id
    ), rq as (
      select rc.competency_id, rc.required_level, rc.importance, coalesce(lv.lvl, 0) as have,
        case when jsonb_typeof(v_w -> rc.importance) = 'number' then (v_w ->> rc.importance)::float8
             else case rc.importance when 'core' then 3::float8 when 'important' then 2::float8 when 'useful' then 1::float8 else 1::float8 end end as wt
      from kafaa_role_competencies rc left join lv on lv.competency_id = rc.competency_id where rc.role_id = r.role_id
    )
    select coalesce(sum((least(rq.have, rq.required_level)::float8 / rq.required_level::float8) * rq.wt), 0), coalesce(sum(rq.wt), 0),
      coalesce((select jsonb_agg(jsonb_build_object('competency_id', z.competency_id, 'have', z.have, 'need', z.required_level, 'importance', z.importance)
                order by (z.required_level - z.have) desc, z.competency_id collate "C") from rq z where z.have < z.required_level), '[]'::jsonb)
      into v_num, v_den, v_gaps from rq;
    v_score := case when v_den > 0 then floor(v_num / v_den * 10000 + 0.5) / 10000 else 0 end;
    v_pct := floor(v_score * 100 + 0.5)::int;
    v_routes := '[]'::jsonb;
    for e in select cp.* from kafaa_career_paths cp where cp.to_role_id = r.role_id order by cp.sort, cp.id collate "C" loop
      v_mine := coalesce(v_role is not null and e.from_role_id = v_role, false);
      v_conds := '[]'::jsonb;
      for c in select x from jsonb_array_elements(case when jsonb_typeof(e.conditions) = 'array' then e.conditions else '[]'::jsonb end) as t(x) loop
        v_rem := 0;
        if c->>'kind' = 'months' then
          v_need := case when jsonb_typeof(c->'value') = 'number' then (c->>'value')::numeric::int else 0 end;
          if v_mine and v_qual and v_mir >= v_need then v_st := 'met'; v_note := 'months_met';
          else
            v_have := case when v_mine and v_qual then v_mir else 0 end;
            v_st := 'not_met'; v_note := case when not v_mine then 'other_role' when v_qual then 'months_short' else 'not_qualified_yet' end; v_rem := v_need - v_have;
          end if;
        elsif c->>'kind' = 'degree' then
          v_ok := coalesce((edu ->> coalesce(v_edu, ''))::int, 0) >= coalesce((edu ->> (c->>'value'))::int, 99);
          v_st := case when v_ok then 'met' else 'pending' end; v_note := case when v_ok then 'degree_role' else 'degree_unknown' end;
        elsif c->>'kind' = 'programme' then
          v_codes := string_to_array(upper(c->>'value'), '/');
          if exists (select 1 from unnest(v_codes) k where v_prog ->> k = 'done') then v_st := 'met'; v_note := 'programme_done';
          else v_st := 'pending'; v_note := case when exists (select 1 from unnest(v_codes) k where v_prog ->> k = 'in_progress') then 'programme_in_progress' else 'programme_to_do' end;
          end if;
        elsif c->>'kind' = 'exam' then v_st := 'pending'; v_note := 'exam_to_do';
        elsif c->>'kind' in ('clearance', 'medical', 'appointment') then v_st := 'pending'; v_note := 'licensee';
        else v_st := 'pending'; v_note := 'other';
        end if;
        v_conds := v_conds || jsonb_build_array(jsonb_build_object('kind', c->'kind', 'value', c->'value', 'en', c->'en', 'ar', c->'ar', 'status', v_st, 'note', v_note, 'remaining_months', v_rem));
      end loop;
      v_st := case when exists (select 1 from jsonb_array_elements(v_conds) q where q->>'status' = 'not_met') then 'not_met'
                   when not exists (select 1 from jsonb_array_elements(v_conds) q where q->>'status' <> 'met') then 'met' else 'pending' end;
      v_routes := v_routes || jsonb_build_array(jsonb_build_object('edge_id', e.id, 'from_role_id', e.from_role_id, 'type', e.type, 'route_code', e.route_code, 'rule_ref', e.rule_ref,
        'label', jsonb_build_object('en', e.label_en, 'ar', e.label_ar), 'mine', v_mine, 'status', v_st,
        'remaining_months', greatest(0, coalesce((select max((q->>'remaining_months')::int) from jsonb_array_elements(v_conds) q), 0)), 'conditions', v_conds, '_ord', e.sort, '_id', e.id));
    end loop;
    select coalesce(jsonb_agg(x - '_ord' - '_id' order by (x->>'mine')::boolean desc,
                              case x->>'status' when 'met' then 0 when 'pending' then 1 else 2 end, (x->>'remaining_months')::int, (x->>'_ord')::int, (x->>'_id') collate "C"), '[]'::jsonb)
      into v_routes from jsonb_array_elements(v_routes) x;
    v_primary := v_routes -> 0;
    v_gate := coalesce(v_primary->>'status', 'none');
    v_gate_m := case when v_gate = 'not_met' then (v_primary->>'remaining_months')::int else 0 end;
    v_gap_m := least(120, 2 * coalesce((select sum((g2->>'need')::int - (g2->>'have')::int) from jsonb_array_elements(v_gaps) g2), 0))::int;
    v_months := greatest(v_gate_m, v_gap_m);
    v_band := case when r.role_id = v_role then 'current' when v_score >= 0.85 and v_gate <> 'not_met' then 'ready_now' when v_months <= 36 then 'ready_in' else 'stretch' end;
    v_reasons := jsonb_build_array(jsonb_build_object('code', 'readiness', 'key', 'common.engines.reason.readiness', 'vars', jsonb_build_object('pct', v_pct)));
    if v_primary is not null then
      if v_gate = 'met' then
        v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'gates_met', 'key', 'm18.reasons.gates_met', 'vars', jsonb_build_object('route', v_primary->'label'), 'ref', jsonb_build_object('table', 'career_paths', 'id', v_primary->>'edge_id')));
      elsif v_gate = 'pending' then
        select count(*) into v_n from jsonb_array_elements(v_primary->'conditions') q where q->>'status' = 'pending';
        v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'gates_pending', 'key', 'm18.reasons.gates_pending', 'vars', jsonb_build_object('route', v_primary->'label', 'n', v_n), 'ref', jsonb_build_object('table', 'career_paths', 'id', v_primary->>'edge_id')));
      else
        v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'gates_not_met', 'key', 'm18.reasons.gates_not_met', 'vars', jsonb_build_object('route', v_primary->'label', 'months', v_gate_m), 'ref', jsonb_build_object('table', 'career_paths', 'id', v_primary->>'edge_id')));
      end if;
    else
      v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'gates_none', 'key', 'm18.reasons.gates_none'));
    end if;
    for g in select x, ord from jsonb_array_elements(v_gaps) with ordinality t(x, ord) where ord <= 3 order by ord loop
      v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'gap', 'key', 'm18.reasons.gap',
        'vars', jsonb_build_object('skill', coalesce((select jsonb_build_object('en', cm.name_en, 'ar', cm.name_ar) from kafaa_competencies cm where cm.id = g.x->>'competency_id'),
                                                    jsonb_build_object('en', g.x->>'competency_id', 'ar', g.x->>'competency_id')), 'from', (g.x->'have'), 'to', (g.x->'need')),
        'ref', jsonb_build_object('table', 'competencies', 'id', g.x->>'competency_id')));
    end loop;
    if v_band = 'ready_now' then v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'band_ready_now', 'key', 'm18.reasons.band_ready_now'));
    elsif v_band = 'ready_in' then v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'band_ready_in', 'key', 'm18.reasons.band_ready_in', 'vars', jsonb_build_object('months', v_months)));
    elsif v_band = 'stretch' then v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'band_stretch', 'key', 'm18.reasons.band_stretch', 'vars', jsonb_build_object('months', v_months)));
    end if;
    v_out := v_out || jsonb_build_array(jsonb_build_object('role_id', r.role_id, 'path_only', false, 'score', v_score, 'pct', v_pct, 'band', v_band,
      'months', case when v_band = 'current' then 0 else v_months end, 'gate_status', v_gate, 'primary_route', v_primary->>'edge_id', 'routes', v_routes, 'gaps', v_gaps, 'reasons', v_reasons));
  end loop;
  return v_out;
end $$;

-- ───────────── RPC: career readiness (read-only). Self; or a line manager / instructor in scope when the person shares a shortlist or roadmap.
create or replace function kafaa_career_readiness(p_person text, p_role_ids text[]) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me();
begin
  if me is null then return kafaa_refuse('career.readiness', 'career_targets', p_person, 'not_signed_in', 'Sign in to see your career readiness'); end if;
  if p_person is null or not exists (select 1 from kafaa_people where id = p_person) then return kafaa_refuse('career.readiness', 'career_targets', p_person, 'not_found', 'Person not found'); end if;
  if p_person = me then
    if not kafaa_has_grant('skills_profile', array['Own', 'Scope']) then return kafaa_refuse('career.readiness', 'career_targets', p_person, 'forbidden', 'Career readiness is for staff with a skills profile'); end if;
  elsif not (kafaa_has_grant('skills_profile', array['Scope']) and kafaa_in_scope('skills_profile', p_person)
             and (exists (select 1 from kafaa_career_targets t where t.person_id = p_person and t.shared and t.active)
                  or exists (select 1 from kafaa_roadmaps m where m.person_id = p_person and m.shared and m.active))) then
    return kafaa_refuse('career.readiness', 'career_targets', p_person, 'forbidden', 'This person has not shared their career plans with you');
  end if;
  return kafaa_result(true, 'ok', '', null::kafaa_audit_events, null, kafaa_career_readiness_compute(p_person, coalesce(p_role_ids, '{}'::text[]), current_date));
end $$;

-- ───────────── RPC: send a saved roadmap's development blocks to the person's development plan. Inside, the row-audit triggers stay quiet
-- (kafaa.seeding, transaction-local) because the RPC writes one audit row itself, like the LocalBackend. M04 tables (contract request in
-- CONTRACT.md: an M18-owned RPC writes dev_plans / plan_activities). Own roadmap only; idempotent; audited and ledgered.
create or replace function kafaa_roadmap_to_plan(p_roadmap text) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; rm kafaa_roadmaps; x jsonb; v_plan text; v_created integer := 0; v_existing integer := 0; v_new boolean := false;
  v_id text; a kafaa_audit_events; l integer; v_prev text := current_setting('kafaa.seeding', true);
begin
  if me is null then return kafaa_refuse('roadmap.to_plan', 'roadmaps', p_roadmap, 'not_signed_in', 'Sign in to update your development plan'); end if;
  v_role := kafaa_acting_role('dev_plans', array['Own', 'Scope']);
  if v_role is null then return kafaa_refuse('roadmap.to_plan', 'roadmaps', p_roadmap, 'forbidden', 'Only staff with a development plan can do this'); end if;
  select * into rm from kafaa_roadmaps where id = p_roadmap;
  if not found or rm.person_id <> me or not rm.active then return kafaa_refuse('roadmap.to_plan', 'roadmaps', p_roadmap, 'not_found', 'Roadmap not found', v_role); end if;
  if not exists (select 1 from jsonb_array_elements(case when jsonb_typeof(rm.plan) = 'array' then rm.plan else '[]'::jsonb end) b where b->>'lane' = 'development') then
    return kafaa_refuse('roadmap.to_plan', 'roadmaps', p_roadmap, 'invalid', 'This roadmap has no development blocks to send', v_role);
  end if;
  for x in select b from jsonb_array_elements(rm.plan) b where b->>'lane' = 'development' loop
    if not (jsonb_typeof(x->'id') = 'string' and x->>'id' ~ '^[a-z0-9-]{1,80}$' and coalesce(x->>'plan_kind', '') in ('course', 'mentoring', 'project')
            and jsonb_typeof(x->'title'->'en') = 'string' and jsonb_typeof(x->'title'->'ar') = 'string' and btrim(x->'title'->>'en') <> ''
            and length(x->'title'->>'en') <= 200 and length(x->'title'->>'ar') <= 200
            and (coalesce(jsonb_typeof(x->'course_id'), 'null') = 'null' or exists (select 1 from kafaa_courses co where co.id = x->>'course_id'))
            and (coalesce(jsonb_typeof(x->'end'), 'null') = 'null' or x->>'end' ~ '^\d{4}-\d{2}-\d{2}$')) then
      return kafaa_refuse('roadmap.to_plan', 'roadmaps', p_roadmap, 'invalid', 'The roadmap contains an activity that cannot be added', v_role);
    end if;
  end loop;
  select coalesce((select d.id from kafaa_dev_plans d where d.id = 'dp-rm-' || rm.id and d.person_id = me and d.target_role_id = rm.target_role_id and d.status in ('draft', 'submitted', 'approved', 'active')),
                  (select d.id from kafaa_dev_plans d where d.person_id = me and d.target_role_id = rm.target_role_id and d.status in ('draft', 'submitted', 'approved', 'active') order by d.id collate "C" limit 1))
    into v_plan;
  perform set_config('kafaa.seeding', 'on', true);
  if v_plan is null then
    v_plan := 'dp-rm-' || rm.id;
    insert into kafaa_dev_plans (id, person_id, target_role_id, status, created_at, note) values (v_plan, me, rm.target_role_id, 'draft', now(), 'Created from a Career Roadmap scenario');
    v_new := true;
  end if;
  for x in select b from jsonb_array_elements(rm.plan) b where b->>'lane' = 'development' loop
    v_id := 'pa-rm-' || rm.id || '-' || (x->>'id');
    if exists (select 1 from kafaa_plan_activities where id = v_id) then v_existing := v_existing + 1; continue; end if;
    insert into kafaa_plan_activities (id, plan_id, person_id, kind, title_en, title_ar, due_on, status, course_id)
    values (v_id, v_plan, me, x->>'plan_kind', x->'title'->>'en', x->'title'->>'ar', (x->>'end')::date, 'planned', x->>'course_id');
    v_created := v_created + 1;
  end loop;
  update kafaa_roadmaps set sent_plan_id = v_plan, sent_at = now() where id = rm.id;
  perform set_config('kafaa.seeding', coalesce(v_prev, ''), true);
  l := kafaa_ledger('kafaa.career.roadmap_to_plan', format('Career roadmap %s sent to development plan %s (%s activities added)', rm.id, v_plan, v_created));
  a := kafaa_audit('roadmap.to_plan', 'plan_activities', rm.id, 'ok', format('%s added, %s already in plan %s', v_created, v_existing, v_plan), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when v_created > 0 then 'Added to your development plan' else 'Already in your development plan' end, a, l,
    jsonb_build_object('plan_id', v_plan, 'plan_created', v_new, 'created', v_created, 'existing', v_existing));
end $$;

revoke execute on function kafaa_career_readiness_compute(text, text[], date), kafaa_career_share_sync() from public, anon, authenticated;
revoke execute on function kafaa_career_readiness(text, text[]), kafaa_roadmap_to_plan(text) from public, anon;
grant execute on function kafaa_career_readiness(text, text[]), kafaa_roadmap_to_plan(text) to authenticated;
grant execute on function kafaa_career_months(date, date) to authenticated;
