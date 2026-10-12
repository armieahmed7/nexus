-- [FS wave F · E4 · FS56 + FS57] Skill-change effectiveness; curriculum coverage scorer and gap-filling backlog (M25 Training effectiveness and needs).
-- FS56: kafaa_skill_change_measures holds, per catalogue course and FS17 pathway with completions, the participants' F01 level on each skill the item
--   teaches the day before the learning started and 90 days after completion (levels rebuilt from the kafaa_skill_evidence history; the participant's
--   own completion record never counts), with a matched comparison (colleagues of the same kind, same skill, same starting level, same window, who had
--   not done the learning) where at least 10 colleagues form the pool. Rows are stored already suppressed (no cell from fewer than 10 people).
--   kafaa_sc_compute(as_of) = skillChange() in src/modules/m25/skillChange.ts.
-- FS57: coverage per role profile (FS05, horizons now and 2030) from what the catalogue teaches (courses incl. FS19 links, published FS17 pathways whose
--   learn step has content, published FS18 externals; one "taught by" definition, kafaa_cov_course_skills / kafaa_cov_taught), up to the learning
--   ceiling (level 2). kafaa_gap_backlog is the decision layer over the FS17 gap backlog (kafaa_pathway_gaps, read only) and the uncovered requirements:
--   one row per (skill, level), default owner = the skill's FS02 owner function, decisions by the training manager (ledgered). The what-if is computed
--   in memory and stored only with a decision. kafaa_cov_* = src/modules/m25/coverage.ts.
-- PGlite parity and checks: scripts/validate/fs64-skill-change-coverage.mjs.
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file; RLS created once, then set to the per-statement form.

-- ───────────── Tables (generated DDL, additive)
create table if not exists kafaa_skill_change_measures (
  id text primary key,
  kind text not null check (kind in ('course', 'pathway')),
  item_id text not null,
  as_of date not null,
  window_days integer not null default 90,
  completers integer,
  measured integer,
  suppressed boolean not null default false,
  before_x100 integer,
  after_x100 integer,
  change_x100 integer,
  moved_pct integer,
  comparison_people integer,
  comparison_change_x100 integer,
  net_x100 integer,
  method text check (method in ('matched', 'before_after')),
  verdict text not null check (verdict in ('moves', 'some', 'flat', 'window_open', 'suppressed')),
  next_on date,
  skills jsonb not null default '[]'::jsonb,
  reasons jsonb not null default '[]'::jsonb,
  computed_at timestamptz not null default now(),
  computed_by text
);
comment on table kafaa_skill_change_measures is '[M25] Skill change per course or pathway: F01 level before and 90 days after, with a matched comparison where available (FS56)';
create table if not exists kafaa_gap_backlog (
  id text primary key,
  skill_id text not null,
  level integer not null,
  owner_role text not null,
  owner_person_id text,
  due_on date,
  route text check (route in ('build', 'partner', 'buy')),
  rationale text not null default '',
  rationale_ar text,
  plan jsonb,
  predicted jsonb not null default '[]'::jsonb,
  status text not null default 'open' check (status in ('open', 'decided')),
  first_seen date not null,
  created_by text not null,
  decided_by text,
  decided_at timestamptz,
  history jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
comment on table kafaa_gap_backlog is '[M25] Gap-filling backlog: one row per skill and level the catalogue should reach, with owner, date and build / partner / buy (FS57)';
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_gap_backlog_skill_id_fk') then
  alter table kafaa_gap_backlog add constraint kafaa_gap_backlog_skill_id_fk foreign key (skill_id) references kafaa_skills(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_gap_backlog_owner_person_id_fk') then
  alter table kafaa_gap_backlog add constraint kafaa_gap_backlog_owner_person_id_fk foreign key (owner_person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_gap_backlog_level_ck') then
  alter table kafaa_gap_backlog add constraint kafaa_gap_backlog_level_ck check (level between 1 and 4); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_gap_backlog_decided_ck') then
  alter table kafaa_gap_backlog add constraint kafaa_gap_backlog_decided_ck check (status = 'open' or (route is not null and due_on is not null and decided_by is not null and char_length(rationale) >= 10)); end if; end $$;
create index if not exists kafaa_skill_change_measures_kind_idx on kafaa_skill_change_measures (kind);
create index if not exists kafaa_skill_change_measures_item_id_idx on kafaa_skill_change_measures (item_id);
create index if not exists kafaa_skill_change_measures_verdict_idx on kafaa_skill_change_measures (verdict);
create index if not exists kafaa_gap_backlog_skill_id_idx on kafaa_gap_backlog (skill_id);
create index if not exists kafaa_gap_backlog_owner_person_id_idx on kafaa_gap_backlog (owner_person_id);
create index if not exists kafaa_gap_backlog_status_idx on kafaa_gap_backlog (status);
create index if not exists kafaa_skill_evidence_person_skill_fs64_idx on kafaa_skill_evidence (person_id, skill_id);

-- ───────────── RLS (generated rule; created once, then the per-statement form of the RLS performance pass)
do $$ begin
  execute 'alter table kafaa_skill_change_measures enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_skill_change_measures' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_skill_change_measures for select to anon, authenticated using ((select kafaa_has_grant(''learning_analytics'', array[''Agg'',''R'',''W'',''A''])))'; end if;
  execute 'alter policy kafaa_read on kafaa_skill_change_measures using ((select kafaa_has_grant(''learning_analytics'', array[''Agg'',''R'',''W'',''A''])))';
  execute 'alter table kafaa_gap_backlog enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_gap_backlog' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_gap_backlog for select to anon, authenticated using ((select kafaa_has_grant(''learning_analytics'', array[''Agg'',''R'',''W'',''A''])))'; end if;
  execute 'alter policy kafaa_read on kafaa_gap_backlog using ((select kafaa_has_grant(''learning_analytics'', array[''Agg'',''R'',''W'',''A''])))';
end $$;
revoke all on kafaa_skill_change_measures, kafaa_gap_backlog from anon, authenticated;
grant select on kafaa_skill_change_measures, kafaa_gap_backlog to anon, authenticated;

-- ───────────── Shared "taught by" (mirror of coverage.ts restrictedSkills / courseSkills / taughtBy)
create or replace function kafaa_cov_restricted() returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(s.id order by s.id collate "C"), '{}'::text[]) from kafaa_skills s
   where s.area = 'security' or s.competency_id in (select c.id from kafaa_competencies c where c.domain = 'security')
$$;
create or replace function kafaa_cov_course_skills(p_course text) returns table(skill_id text, level integer) language sql stable security definer set search_path = public as $$
  with c as (select id, competency_ids, case when qualifying then 2 else 1 end cap, kafaa_cov_restricted() rs from kafaa_courses where id = p_course),
  x as (
    select s.id sid, c.cap lv from kafaa_skills s, c where s.core and s.competency_id = any(c.competency_ids)
    union all select s.id, least(s.key_level, c.cap) from kafaa_skills s, c where c.id = any(s.evidence_keys)
    union all select l.skill_id, l.level from kafaa_course_skill_links l, c where l.course_id = c.id and l.active is not false
  )
  select x.sid, max(x.lv)::integer from x, c where x.lv > 0 and not (x.sid = any(c.rs)) group by x.sid
$$;
-- skill -> teaching items, as [{skill_id, items: [{kind, id, level, title_en, title_ar}]}] sorted by skill, items by kind (course, pathway, external) then id
create or replace function kafaa_cov_taught() returns jsonb language sql stable security definer set search_path = public as $$
  with r as (select kafaa_cov_restricted() ids),
  it as (
    select x.skill_id, 0 o, 'course' kind, c.id, x.level, coalesce(c.title_en, '') title_en, coalesce(c.title_ar, '') title_ar
      from kafaa_courses c cross join lateral kafaa_cov_course_skills(c.id) x where c.audience is distinct from 'supplier'
    union all
    select p.skill_id, 1, 'pathway', p.id, p.level, coalesce(p.title_en, ''), coalesce(p.title_ar, '') from kafaa_pathways p, r
     where p.status = 'published' and p.listed is true and not (p.skill_id = any(r.ids))
       and not exists (select 1 from kafaa_pathway_gaps g where g.pathway_id = p.id and g.status = 'open' and g.kind = 'learn')
    union all
    select e.sid, 2, 'external', e.id, e.lv, e.title_en, e.title_ar from (
      select x.id, coalesce(x.title_en, '') title_en, coalesce(x.title_ar, '') title_ar, s ->> 'skill_id' sid,
             max(case when jsonb_typeof(s -> 'level') = 'number' then floor((s ->> 'level')::numeric)::integer else 0 end) lv
        from kafaa_external_resources x cross join lateral jsonb_array_elements(case when jsonb_typeof(x.skills) = 'array' then x.skills else '[]'::jsonb end) s
       where x.status = 'published' and x.listed is true and jsonb_typeof(s -> 'skill_id') = 'string'
       group by x.id, x.title_en, x.title_ar, s ->> 'skill_id') e, r
     where e.lv > 0 and not (e.sid = any(r.ids))
  )
  select coalesce(jsonb_agg(jsonb_build_object('skill_id', g.skill_id, 'items', g.items) order by g.skill_id collate "C"), '[]'::jsonb) from (
    select it.skill_id, jsonb_agg(jsonb_build_object('kind', it.kind, 'id', it.id, 'level', it.level, 'title_en', it.title_en, 'title_ar', it.title_ar) order by it.o, it.id collate "C") items
      from it group by it.skill_id) g
$$;
create or replace function kafaa_cov_owner(p_role text) returns text language sql immutable set search_path = public as $$
  select case when p_role = any(array['nuclear_training', 'operations', 'maintenance', 'engineering', 'radiation_chemistry', 'safety_licensing', 'human_performance',
    'emergency_preparedness', 'quality', 'leadership_development', 'digital_ai_governance', 'sustainability', 'advanced_reactors', 'cyber_awareness']) then p_role else 'nuclear_training' end
$$;
-- requirementsOf: competency -> its core skill (first by id), restricted and unknown skills out, highest need and weight per skill, sorted by skill
create or replace function kafaa_cov_reqs(p_reqs jsonb) returns jsonb language sql stable security definer set search_path = public as $$
  with rs as (select kafaa_cov_restricted() ids),
  r as (
    select case when q ->> 'kind' = 'competency' then (select s.id from kafaa_skills s where s.core and s.competency_id = q ->> 'ref_id' order by s.id collate "C" limit 1)
                when q ->> 'kind' = 'skill' then q ->> 'ref_id' end sid,
           case when jsonb_typeof(q -> 'level') = 'number' and (q ->> 'level')::numeric = floor((q ->> 'level')::numeric) then (q ->> 'level')::numeric::integer end need,
           case when q ->> 'importance' = 'core' then 2 else 1 end w
      from jsonb_array_elements(case when jsonb_typeof(p_reqs) = 'array' then p_reqs else '[]'::jsonb end) q
  )
  select coalesce(jsonb_agg(jsonb_build_object('skill_id', x.sid, 'need', x.need, 'weight', x.w) order by x.sid collate "C"), '[]'::jsonb) from (
    select r.sid, max(r.need) need, max(r.w) w from r, rs
     where r.sid is not null and r.need >= 1 and exists (select 1 from kafaa_skills s where s.id = r.sid) and not (r.sid = any(rs.ids))
     group by r.sid) x
$$;
-- scoreReqs over [{skill_id, need, weight}] with taught levels {skill: level}; credit in halves
create or replace function kafaa_cov_score(p_reqs jsonb, p_taught jsonb) returns jsonb language sql immutable set search_path = public as $$
  with q as (
    select n, e ->> 'skill_id' sid, (e ->> 'need')::integer need, (e ->> 'weight')::integer w, least((e ->> 'need')::integer, 2) target,
           coalesce((p_taught ->> (e ->> 'skill_id'))::integer, 0) taught
      from jsonb_array_elements(p_reqs) with ordinality a(e, n)
  ), c as (select q.*, least(q.taught, q.target) * (2 / q.target) credit from q)
  select jsonb_build_object(
    'reqs', coalesce((select jsonb_agg(jsonb_build_object('skill_id', sid, 'need', need, 'target', target, 'weight', w, 'taught', taught, 'credit', credit) order by n) from c), '[]'::jsonb),
    'score', (select case when sum(w) > 0 then kafaa_ev_rdiv(100 * sum(w * credit), sum(w * 2)) end from c),
    'covered', (select count(*) from c where taught >= target))
$$;
-- coverage(): every published profile for now and 2030 (job-role sort, role, version); p_skill/p_level add a planned teaching item
create or replace function kafaa_cov_roles(p_skill text default null, p_level integer default null) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_taught jsonb := '{}'::jsonb; v_out jsonb := '[]'::jsonb; h text; v record; s jsonb; reqs jsonb;
begin
  select coalesce(jsonb_object_agg(t ->> 'skill_id', (select max((i ->> 'level')::integer) from jsonb_array_elements(t -> 'items') i)), '{}'::jsonb) into v_taught from jsonb_array_elements(kafaa_cov_taught()) t;
  if p_skill is not null and p_level is not null and not (p_skill = any(kafaa_cov_restricted())) then
    v_taught := v_taught || jsonb_build_object(p_skill, greatest(coalesce((v_taught ->> p_skill)::integer, 0), p_level));
  end if;
  foreach h in array array['now', '2030'] loop
    for v in select x.* from (select distinct on (pv.role_id) pv.id, pv.role_id, pv.path_only, pv.requirements, coalesce(jr.sort, 0) srt
               from kafaa_role_profile_versions pv join kafaa_job_roles jr on jr.id = pv.role_id
              where pv.horizon = h and pv.status = 'published'
              order by pv.role_id, pv.id collate "C") x order by x.srt, x.role_id collate "C" loop
      if v.path_only is true then
        v_out := v_out || jsonb_build_array(jsonb_build_object('role_id', v.role_id, 'horizon', h, 'version_id', v.id, 'path_only', true, 'score', null, 'n', 0, 'covered', 0, 'reqs', '[]'::jsonb, 'uncovered', '[]'::jsonb));
        continue;
      end if;
      s := kafaa_cov_score(kafaa_cov_reqs(v.requirements), v_taught);
      reqs := s -> 'reqs';
      v_out := v_out || jsonb_build_array(jsonb_build_object('role_id', v.role_id, 'horizon', h, 'version_id', v.id, 'path_only', false, 'score', s -> 'score',
        'n', jsonb_array_length(reqs), 'covered', s -> 'covered', 'reqs', reqs,
        'uncovered', coalesce((select jsonb_agg(e -> 'skill_id' order by n) from jsonb_array_elements(reqs) with ordinality a(e, n) where (e ->> 'taught')::integer < (e ->> 'target')::integer), '[]'::jsonb)));
    end loop;
  end loop;
  return v_out;
end $$;
-- whatIf(): score moves when a planned item teaches p_skill at p_level (roles whose score changes, in coverage order)
create or replace function kafaa_cov_whatif(p_roles jsonb, p_skill text, p_level integer) returns jsonb language plpgsql immutable set search_path = public as $$
declare r jsonb; v_taught jsonb; s jsonb; v_out jsonb := '[]'::jsonb;
begin
  for r in select e from jsonb_array_elements(p_roles) with ordinality a(e, n) order by n loop
    if (r ->> 'path_only')::boolean or jsonb_typeof(r -> 'score') <> 'number' or not exists (select 1 from jsonb_array_elements(r -> 'reqs') q where q ->> 'skill_id' = p_skill) then continue; end if;
    select jsonb_object_agg(q ->> 'skill_id', case when q ->> 'skill_id' = p_skill then greatest((q ->> 'taught')::integer, p_level) else (q ->> 'taught')::integer end) into v_taught from jsonb_array_elements(r -> 'reqs') q;
    s := kafaa_cov_score(r -> 'reqs', v_taught);
    if (s ->> 'score')::integer <> (r ->> 'score')::integer then
      v_out := v_out || jsonb_build_array(jsonb_build_object('role_id', r ->> 'role_id', 'horizon', r ->> 'horizon', 'before', (r ->> 'score')::integer, 'after', (s ->> 'score')::integer,
        'delta', (s ->> 'score')::integer - (r ->> 'score')::integer));
    end if;
  end loop;
  return v_out;
end $$;
-- backlogNeeds(): uncovered requirements at their target and open FS17 gaps, one entry per (skill, level), sorted by id
create or replace function kafaa_cov_needs(p_roles jsonb) returns jsonb language sql stable security definer set search_path = public as $$
  with u as (
    select q ->> 'skill_id' sid, (q ->> 'target')::integer lv, (r ->> 'role_id') || '@' || (r ->> 'horizon') who, null::text gid
      from jsonb_array_elements(p_roles) r cross join lateral jsonb_array_elements(r -> 'reqs') q where (q ->> 'taught')::integer < (q ->> 'target')::integer
    union all
    select g.skill_id, g.level, null, g.id from kafaa_pathway_gaps g, (select kafaa_cov_restricted() ids) rs where g.status = 'open' and not (g.skill_id = any(rs.ids))
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'skill_id', x.sid, 'level', x.lv, 'roles', x.roles, 'gap_ids', x.gaps) order by x.id collate "C"), '[]'::jsonb) from (
    select 'gb:' || u.sid || ':' || u.lv id, u.sid, u.lv,
           coalesce(jsonb_agg(u.who order by u.who collate "C") filter (where u.who is not null), '[]'::jsonb) roles,
           coalesce(jsonb_agg(u.gid order by u.gid collate "C") filter (where u.gid is not null), '[]'::jsonb) gaps
      from u group by u.sid, u.lv) x
$$;
create or replace function kafaa_cov_reasons(p_need jsonb, p_taught integer) returns jsonb language sql immutable set search_path = public as $$
  select case when p_need is null then jsonb_build_array(kafaa_ev_reason('gb_covered'))
    else (case when jsonb_array_length(p_need -> 'roles') > 0 then jsonb_build_array(kafaa_ev_reason('gb_roles', jsonb_build_object('n', jsonb_array_length(p_need -> 'roles'), 'level', (p_need ->> 'level')::integer, 'taught', p_taught))) else '[]'::jsonb end)
      || (case when jsonb_array_length(p_need -> 'gap_ids') > 0 then jsonb_build_array(kafaa_ev_reason('gb_gaps', jsonb_build_object('n', jsonb_array_length(p_need -> 'gap_ids')))) else '[]'::jsonb end) end
$$;
create or replace function kafaa_cov_ts(p timestamptz) returns text language sql immutable set search_path = public as $$
  select case when p is null then null else to_char(p at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') end
$$;
create or replace function kafaa_cov_is_date(p text) returns boolean language plpgsql immutable set search_path = public as $$
begin
  if p is null or p !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
  return to_char(p::date, 'YYYY-MM-DD') = p;
exception when others then return false;
end $$;
create or replace function kafaa_cov_int_between(p jsonb, p_min integer, p_max integer) returns boolean language sql immutable set search_path = public as $$
  select jsonb_typeof(p) = 'number' and (p #>> '{}')::numeric = floor((p #>> '{}')::numeric) and (p #>> '{}')::numeric between p_min and p_max
$$;
-- decisionProblem(): first problem code of a backlog decision, null when valid
create or replace function kafaa_cov_decision_problem(p jsonb, p_found boolean, p_today date) returns text language plpgsql stable security definer set search_path = public as $$
declare v_r text; v_t text; pl jsonb;
begin
  if not p_found then return 'not_found'; end if;
  if jsonb_typeof(p -> 'route') is distinct from 'string' or not (p ->> 'route' = any(array['build', 'partner', 'buy'])) then return 'route'; end if;
  if jsonb_typeof(p -> 'owner_role') is distinct from 'string' or kafaa_cov_owner(p ->> 'owner_role') <> p ->> 'owner_role' then return 'owner'; end if;
  if p ? 'owner_person_id' and jsonb_typeof(p -> 'owner_person_id') <> 'null' and coalesce(p ->> 'owner_person_id', '') <> '' then
    if jsonb_typeof(p -> 'owner_person_id') <> 'string' or not exists (select 1 from kafaa_people x where x.id = p ->> 'owner_person_id' and x.kind = 'staff' and x.status = 'active') then return 'person'; end if;
  end if;
  if jsonb_typeof(p -> 'due_on') is distinct from 'string' or not kafaa_cov_is_date(p ->> 'due_on') or (p ->> 'due_on')::date < p_today or (p ->> 'due_on')::date > date '2030-12-31' then return 'due'; end if;
  v_r := case when jsonb_typeof(p -> 'rationale') = 'string' then regexp_replace(p ->> 'rationale', '^\s+|\s+$', '', 'g') else '' end;
  if char_length(v_r) < 10 or char_length(v_r) > 500 then return 'rationale'; end if;
  if p ? 'plan' and jsonb_typeof(p -> 'plan') <> 'null' then
    pl := p -> 'plan';
    if jsonb_typeof(pl) <> 'object' then return 'plan'; end if;
    v_t := case when jsonb_typeof(pl -> 'title') = 'string' then regexp_replace(pl ->> 'title', '^\s+|\s+$', '', 'g') else '' end;
    if char_length(v_t) < 3 or char_length(v_t) > 120 then return 'plan'; end if;
    if not coalesce(kafaa_cov_int_between(pl -> 'level', 1, 3), false) then return 'plan'; end if;
    if not coalesce(kafaa_cov_int_between(pl -> 'hours', 1, 200), false) then return 'plan'; end if;
  end if;
  return null;
end $$;
-- coverageReport()
create or replace function kafaa_cov_report(p_today date, p_can boolean) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_roles jsonb := kafaa_cov_roles(null, null); v_needs jsonb; v_teach jsonb := kafaa_cov_taught(); v_lv jsonb; v_backlog jsonb; v_skills jsonb; v_staff jsonb := '[]'::jsonb;
begin
  v_needs := (select coalesce(jsonb_object_agg(n ->> 'id', n), '{}'::jsonb) from jsonb_array_elements(kafaa_cov_needs(v_roles)) n);
  v_lv := (select coalesce(jsonb_object_agg(t ->> 'skill_id', (select max((i ->> 'level')::integer) from jsonb_array_elements(t -> 'items') i)), '{}'::jsonb) from jsonb_array_elements(v_teach) t);
  v_backlog := (select coalesce(jsonb_agg(jsonb_build_object(
      'id', b.id, 'skill_id', b.skill_id, 'level', b.level, 'owner_role', b.owner_role, 'owner_person_id', b.owner_person_id,
      'owner_name', coalesce(op.display_name, ''), 'owner_name_ar', coalesce(nullif(op.display_name_ar, ''), op.display_name, ''),
      'due_on', b.due_on::text, 'route', b.route, 'rationale', b.rationale, 'rationale_ar', b.rationale_ar, 'plan', b.plan, 'predicted', b.predicted, 'status', b.status,
      'first_seen', b.first_seen::text, 'decided_by', b.decided_by, 'decided_by_name', coalesce(dp.display_name, ''), 'decided_at', kafaa_cov_ts(b.decided_at), 'history', b.history,
      'state', case when v_needs ? b.id then case when b.status = 'decided' then 'planned' else 'open' end else 'covered' end,
      'roles', coalesce(v_needs -> b.id -> 'roles', '[]'::jsonb), 'gap_ids', coalesce(v_needs -> b.id -> 'gap_ids', '[]'::jsonb),
      'taught', coalesce((v_lv ->> b.skill_id)::integer, 0), 'reasons', kafaa_cov_reasons(v_needs -> b.id, coalesce((v_lv ->> b.skill_id)::integer, 0))
    ) order by b.id collate "C"), '[]'::jsonb)
    from kafaa_gap_backlog b left join kafaa_people op on op.id = b.owner_person_id left join kafaa_people dp on dp.id = b.decided_by);
  v_skills := (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name_en', coalesce(s.name_en, s.id), 'name_ar', coalesce(nullif(s.name_ar, ''), nullif(s.name_en, ''), s.id),
      'owner_role', kafaa_cov_owner(s.owner_role), 'area', coalesce(s.area, ''), 'fs_area', s.fs_area) order by s.id collate "C"), '[]'::jsonb)
    from kafaa_skills s where s.id in (
      select q ->> 'skill_id' from jsonb_array_elements(v_roles) r cross join lateral jsonb_array_elements(r -> 'reqs') q
      union select b.skill_id from kafaa_gap_backlog b));
  if p_can then
    v_staff := (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', coalesce(x.display_name, ''), 'name_ar', coalesce(nullif(x.display_name_ar, ''), x.display_name, '')) order by x.id collate "C"), '[]'::jsonb)
      from kafaa_people x where x.kind = 'staff' and x.status = 'active');
  end if;
  return jsonb_build_object('as_of', p_today::text, 'ceiling', 2, 'horizons', jsonb_build_array('now', '2030'), 'roles', v_roles, 'teach', v_teach, 'skills', v_skills,
    'backlog', v_backlog, 'can_edit', p_can,
    'owners', to_jsonb(array['nuclear_training', 'operations', 'maintenance', 'engineering', 'radiation_chemistry', 'safety_licensing', 'human_performance',
      'emergency_preparedness', 'quality', 'leadership_development', 'digital_ai_governance', 'sustainability', 'advanced_reactors', 'cyber_awareness']), 'staff', v_staff);
end $$;

-- ───────────── FS56 rules (mirror of skillChange.ts)
-- skillChange(): one row per course or pathway with completions and taught skills, sorted by kind then item id
create or replace function kafaa_sc_compute(p_as_of date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_out jsonb;
begin
  with
  rs as (select unnest(kafaa_cov_restricted()) id),
  comp as (
    select 'course'::text kind, t.course_id item, t.person_id, t.completed_on s, t.completed_on d, t.id tr from kafaa_training_records t
     where t.result in ('passed', 'completed') and t.completed_on is not null
    union all
    select 'course', e.course_id, e.person_id, (e.completed_at at time zone 'UTC')::date, (e.completed_at at time zone 'UTC')::date, null from kafaa_enrolments e
     where e.status = 'completed' and e.completed_at is not null
    union all
    select 'pathway', pe.pathway_id, pe.person_id, coalesce(pe.started_on, pe.completed_on), pe.completed_on, null from kafaa_pathway_enrolments pe
     where pe.status = 'completed' and pe.completed_on is not null
  ),
  firsts as (select distinct on (c.kind, c.item, c.person_id) c.kind, c.item, c.person_id, c.s, c.d from comp c order by c.kind, c.item, c.person_id, c.d, c.s),
  part as (
    select f.kind, f.item, f.person_id, f.s, f.d,
           coalesce((select array_agg(c.tr order by c.tr collate "C") from comp c where c.kind = f.kind and c.item = f.item and c.person_id = f.person_id and c.tr is not null), '{}'::text[]) trs
      from firsts f
  ),
  taught as (
    select 'course'::text kind, c.id item, x.skill_id, x.level from kafaa_courses c cross join lateral kafaa_cov_course_skills(c.id) x
    union all
    select 'pathway', p.id, p.skill_id, p.level from kafaa_pathways p where coalesce(p.skill_id, '') <> '' and p.skill_id not in (select id from rs)
  ),
  items as (
    select p.kind, p.item, count(*)::integer n, (count(*) filter (where p.d + 90 <= p_as_of))::integer m, (array_agg(p.d + 90 order by p.d + 90))[10] tenth
      from part p where exists (select 1 from taught t where t.kind = p.kind and t.item = p.item) group by p.kind, p.item
  ),
  pairs as (
    select p.kind, p.item, p.person_id, p.s, p.d + 90 e, p.trs, t.skill_id, pk.kind pkind
      from part p join items i on i.kind = p.kind and i.item = p.item and i.n >= 10 and i.m >= 10
      join taught t on t.kind = p.kind and t.item = p.item left join kafaa_people pk on pk.id = p.person_id
     where p.d + 90 <= p_as_of
  ),
  lv as (
    select pr.*, x.b, x.a from pairs pr cross join lateral (
      select coalesce(max(ev.level) filter (where ev.observed_on < pr.s), 0) b, coalesce(max(ev.level) filter (where ev.observed_on <= pr.e), 0) a
        from kafaa_skill_evidence ev where ev.person_id = pr.person_id and ev.skill_id = pr.skill_id and ev.basis is distinct from 'claimed'
         and not (coalesce(ev.ref_table, '') = 'training_records' and coalesce(ev.ref_id, '') = any(pr.trs))) x
  ),
  grp as (select distinct l.kind, l.item, l.pkind, l.skill_id, l.s, l.e from lv l where l.pkind is not null),
  pool as (
    select g.kind, g.item, g.pkind, g.skill_id, g.s, g.e, q.id qid, x.b, x.a from grp g
      join kafaa_people q on q.status = 'active' and q.kind = g.pkind
      cross join lateral (
        select coalesce(max(ev.level) filter (where ev.observed_on < g.s), 0) b, coalesce(max(ev.level) filter (where ev.observed_on <= g.e), 0) a
          from kafaa_skill_evidence ev where ev.person_id = q.id and ev.skill_id = g.skill_id and ev.basis is distinct from 'claimed') x
     where not exists (select 1 from part p2 where p2.kind = g.kind and p2.item = g.item and p2.person_id = q.id and p2.d <= g.e)
  ),
  cmpx as (
    select l.kind, l.item, po.qid, po.a - po.b ch from lv l join pool po on po.kind = l.kind and po.item = l.item and po.pkind = l.pkind and po.skill_id = l.skill_id
       and po.s = l.s and po.e = l.e and po.b = l.b and po.qid <> l.person_id
  ),
  agg as (select l.kind, l.item, count(*) np, sum(l.b) sb, sum(l.a) sa, count(*) filter (where l.a > l.b) mv from lv l group by l.kind, l.item),
  aggc as (select c.kind, c.item, sum(c.ch) cs, count(*) cn, count(distinct c.qid) ppl from cmpx c group by c.kind, c.item),
  sk as (select l.kind, l.item, l.skill_id, count(*) n, sum(l.b) b, sum(l.a) a, count(*) filter (where l.a > l.b) mv from lv l group by l.kind, l.item, l.skill_id),
  calc as (
    select i.*, a.np, a.sb, a.sa, a.mv, coalesce(c.cs, 0) cs, coalesce(c.cn, 0) cn, coalesce(c.ppl, 0) ppl,
           kafaa_ev_rdiv(100 * a.sb, a.np) bx, kafaa_ev_rdiv(100 * a.sa, a.np) ax, kafaa_ev_rdiv(100 * a.mv, a.np) mvp
      from items i left join agg a on a.kind = i.kind and a.item = i.item left join aggc c on c.kind = i.kind and c.item = i.item
  ),
  fin as (
    select k.*, (k.ax - k.bx) chg, (k.ppl >= 10 and k.cn > 0) matched,
           case when k.ppl >= 10 and k.cn > 0 then kafaa_ev_rdiv(100 * k.cs, k.cn) end comp
      from calc k
  )
  select coalesce(jsonb_agg(row_j order by kind collate "C", item collate "C"), '[]'::jsonb) into v_out from (
    select f.kind, f.item, case
      when f.n < 10 then jsonb_build_object('id', 'scm:' || f.kind || ':' || f.item, 'kind', f.kind, 'item_id', f.item, 'as_of', p_as_of::text, 'window_days', 90,
        'completers', null, 'measured', null, 'suppressed', true, 'before_x100', null, 'after_x100', null, 'change_x100', null, 'moved_pct', null,
        'comparison_people', null, 'comparison_change_x100', null, 'net_x100', null, 'method', null, 'verdict', 'suppressed', 'next_on', null,
        'skills', (select jsonb_agg(jsonb_build_object('skill_id', t.skill_id, 'level', t.level, 'pairs', null, 'before_x100', null, 'after_x100', null, 'moved_pct', null) order by t.skill_id collate "C") from taught t where t.kind = f.kind and t.item = f.item),
        'reasons', jsonb_build_array(kafaa_ev_reason('sc_suppressed', jsonb_build_object('min', 10))))
      when f.m < 10 then jsonb_build_object('id', 'scm:' || f.kind || ':' || f.item, 'kind', f.kind, 'item_id', f.item, 'as_of', p_as_of::text, 'window_days', 90,
        'completers', f.n, 'measured', null, 'suppressed', false, 'before_x100', null, 'after_x100', null, 'change_x100', null, 'moved_pct', null,
        'comparison_people', null, 'comparison_change_x100', null, 'net_x100', null, 'method', null, 'verdict', 'window_open',
        'next_on', case when f.tenth > p_as_of then f.tenth::text end,
        'skills', (select jsonb_agg(jsonb_build_object('skill_id', t.skill_id, 'level', t.level, 'pairs', null, 'before_x100', null, 'after_x100', null, 'moved_pct', null) order by t.skill_id collate "C") from taught t where t.kind = f.kind and t.item = f.item),
        'reasons', jsonb_build_array(kafaa_ev_reason('sc_window', jsonb_build_object('min', 10, 'days', 90) || case when f.tenth > p_as_of then jsonb_build_object('date', f.tenth::text) else '{}'::jsonb end)))
      else jsonb_build_object('id', 'scm:' || f.kind || ':' || f.item, 'kind', f.kind, 'item_id', f.item, 'as_of', p_as_of::text, 'window_days', 90,
        'completers', f.n, 'measured', f.m, 'suppressed', false, 'before_x100', f.bx, 'after_x100', f.ax, 'change_x100', f.chg, 'moved_pct', f.mvp,
        'comparison_people', case when f.ppl >= 10 then f.ppl end, 'comparison_change_x100', f.comp, 'net_x100', case when f.matched then f.chg - f.comp end,
        'method', case when f.matched then 'matched' else 'before_after' end,
        'verdict', case when coalesce(f.chg - f.comp, f.chg) >= 25 then 'moves' when coalesce(f.chg - f.comp, f.chg) >= 10 then 'some' else 'flat' end, 'next_on', null,
        'skills', (select jsonb_agg(jsonb_build_object('skill_id', t.skill_id, 'level', t.level, 'pairs', case when x.n >= 10 then x.n end, 'before_x100', kafaa_ev_rdiv(100 * x.b, x.n),
            'after_x100', kafaa_ev_rdiv(100 * x.a, x.n), 'moved_pct', kafaa_ev_rdiv(100 * x.mv, x.n)) order by t.skill_id collate "C")
          from taught t join sk x on x.kind = t.kind and x.item = t.item and x.skill_id = t.skill_id where t.kind = f.kind and t.item = f.item),
        'reasons', jsonb_build_array(kafaa_ev_reason('sc_change', jsonb_build_object('before', f.bx::float8 / 100, 'after', f.ax::float8 / 100, 'days', 90)),
            kafaa_ev_reason('sc_moved', jsonb_build_object('pct', f.mvp)))
          || case when f.matched then jsonb_build_array(kafaa_ev_reason('sc_matched', jsonb_build_object('comp', f.comp::float8 / 100, 'net', (f.chg - f.comp)::float8 / 100, 'people', f.ppl)))
                  else jsonb_build_array(kafaa_ev_reason('sc_no_comparison', jsonb_build_object('min', 10))) end
          || jsonb_build_array(kafaa_ev_reason('sc_verdict_' || case when coalesce(f.chg - f.comp, f.chg) >= 25 then 'moves' when coalesce(f.chg - f.comp, f.chg) >= 10 then 'some' else 'flat' end)))
    end row_j from fin f) z;
  return v_out;
end $$;
-- skillChangeReportOf(): stored rows with titles, sorted by kind then item id
create or replace function kafaa_sc_report(p_can boolean) returns jsonb language sql stable security definer set search_path = public as $$
  with r as (
    select m.*, case when m.kind = 'course' then c.title_en else p.title_en end t_en, case when m.kind = 'course' then c.title_ar else p.title_ar end t_ar,
           case when m.kind = 'course' then c.code end code, kafaa_cov_ts(m.computed_at) at_txt
      from kafaa_skill_change_measures m left join kafaa_courses c on m.kind = 'course' and c.id = m.item_id left join kafaa_pathways p on m.kind = 'pathway' and p.id = m.item_id
  )
  select jsonb_build_object('as_of', (select max(as_of)::text from r), 'computed_at', (select max(at_txt collate "C") from r), 'window_days', 90, 'min_group', 10, 'can_compute', p_can,
    'rows', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'kind', r.kind, 'item_id', r.item_id, 'as_of', r.as_of::text, 'window_days', r.window_days,
        'completers', r.completers, 'measured', r.measured, 'suppressed', r.suppressed, 'before_x100', r.before_x100, 'after_x100', r.after_x100, 'change_x100', r.change_x100,
        'moved_pct', r.moved_pct, 'comparison_people', r.comparison_people, 'comparison_change_x100', r.comparison_change_x100, 'net_x100', r.net_x100, 'method', r.method,
        'verdict', r.verdict, 'next_on', r.next_on::text, 'skills', r.skills, 'reasons', r.reasons,
        'title_en', coalesce(r.t_en, r.item_id), 'title_ar', coalesce(r.t_ar, r.t_en, r.item_id), 'code', r.code, 'computed_at', r.at_txt) order by r.kind collate "C", r.item_id collate "C") from r), '[]'::jsonb))
$$;

-- ───────────── RPCs
create or replace function kafaa_skill_change_report() returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me();
begin
  if me is null then return kafaa_refuse('skillchange.report', 'skill_change_measures', null, 'not_signed_in', 'Sign in first'); end if;
  if not kafaa_has_grant('learning_analytics', array['Agg', 'R', 'A']) then
    return kafaa_refuse('skillchange.report', 'skill_change_measures', null, 'forbidden', 'Skill-change and coverage results are for training staff, managers and HR, as aggregates only'); end if;
  return jsonb_build_object('ok', true, 'code', 'ok', 'message', 'Skill change', 'audit_seq', null, 'ledger_seq', null, 'data', kafaa_sc_report(kafaa_has_grant('learning_analytics', array['A'])));
end $$;

create or replace function kafaa_compute_skill_change() returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_rows jsonb; v_at timestamptz := date_trunc('second', now()); n integer; v_m integer; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('skillchange.compute', 'skill_change_measures', null, 'not_signed_in', 'Sign in first'); end if;
  v_role := kafaa_acting_role('learning_analytics', array['A']);
  if v_role is null then return kafaa_refuse('skillchange.compute', 'skill_change_measures', null, 'forbidden', 'Only the training manager can do this'); end if;
  v_rows := kafaa_sc_compute(current_date);
  insert into kafaa_skill_change_measures (id, kind, item_id, as_of, window_days, completers, measured, suppressed, before_x100, after_x100, change_x100, moved_pct,
    comparison_people, comparison_change_x100, net_x100, method, verdict, next_on, skills, reasons, computed_at, computed_by)
  select r ->> 'id', r ->> 'kind', r ->> 'item_id', (r ->> 'as_of')::date, (r ->> 'window_days')::integer, (r ->> 'completers')::integer, (r ->> 'measured')::integer,
         (r ->> 'suppressed')::boolean, (r ->> 'before_x100')::integer, (r ->> 'after_x100')::integer, (r ->> 'change_x100')::integer, (r ->> 'moved_pct')::integer,
         (r ->> 'comparison_people')::integer, (r ->> 'comparison_change_x100')::integer, (r ->> 'net_x100')::integer, r ->> 'method', r ->> 'verdict', (r ->> 'next_on')::date,
         r -> 'skills', r -> 'reasons', v_at, me
    from jsonb_array_elements(v_rows) r
  on conflict (id) do update set as_of = excluded.as_of, window_days = excluded.window_days, completers = excluded.completers, measured = excluded.measured,
    suppressed = excluded.suppressed, before_x100 = excluded.before_x100, after_x100 = excluded.after_x100, change_x100 = excluded.change_x100, moved_pct = excluded.moved_pct,
    comparison_people = excluded.comparison_people, comparison_change_x100 = excluded.comparison_change_x100, net_x100 = excluded.net_x100, method = excluded.method,
    verdict = excluded.verdict, next_on = excluded.next_on, skills = excluded.skills, reasons = excluded.reasons, computed_at = excluded.computed_at, computed_by = excluded.computed_by;
  n := jsonb_array_length(v_rows);
  select count(*) into v_m from jsonb_array_elements(v_rows) r where jsonb_typeof(r -> 'measured') = 'number';
  a := kafaa_audit('skillchange.compute', 'skill_change_measures', null, 'ok', n || ' items, ' || v_m || ' measured', 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Skill change recomputed as of ' || current_date::text, a, null, jsonb_build_object('rows', n, 'measured', v_m, 'as_of', current_date::text));
end $$;

create or replace function kafaa_curriculum_coverage() returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me();
begin
  if me is null then return kafaa_refuse('coverage.report', 'gap_backlog', null, 'not_signed_in', 'Sign in first'); end if;
  if not kafaa_has_grant('learning_analytics', array['Agg', 'R', 'A']) then
    return kafaa_refuse('coverage.report', 'gap_backlog', null, 'forbidden', 'Skill-change and coverage results are for training staff, managers and HR, as aggregates only'); end if;
  return jsonb_build_object('ok', true, 'code', 'ok', 'message', 'Curriculum coverage', 'audit_seq', null, 'ledger_seq', null, 'data', kafaa_cov_report(current_date, kafaa_has_grant('learning_analytics', array['A'])));
end $$;

create or replace function kafaa_sync_gap_backlog() returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_at timestamptz := date_trunc('second', now()); n integer; v_total integer; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('coverage.sync', 'gap_backlog', null, 'not_signed_in', 'Sign in first'); end if;
  v_role := kafaa_acting_role('learning_analytics', array['A']);
  if v_role is null then return kafaa_refuse('coverage.sync', 'gap_backlog', null, 'forbidden', 'Only the training manager can do this'); end if;
  with ins as (
    insert into kafaa_gap_backlog (id, skill_id, level, owner_role, owner_person_id, due_on, route, rationale, rationale_ar, plan, predicted, status, first_seen, created_by, history, updated_at)
    select x ->> 'id', x ->> 'skill_id', (x ->> 'level')::integer, kafaa_cov_owner(s.owner_role), null, null, null, '', null, null, '[]'::jsonb, 'open', current_date, me, '[]'::jsonb, v_at
      from jsonb_array_elements(kafaa_cov_needs(kafaa_cov_roles(null, null))) x left join kafaa_skills s on s.id = x ->> 'skill_id'
     where not exists (select 1 from kafaa_gap_backlog b where b.id = x ->> 'id')
    on conflict (id) do nothing
    returning 1)
  select count(*) into n from ins;
  select count(*) into v_total from kafaa_gap_backlog;
  a := kafaa_audit('coverage.sync', 'gap_backlog', null, 'ok', n || ' added', 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when n > 0 then n || ' skills added to the backlog with their default owner' else 'Every uncovered skill and open pathway gap is already in the backlog' end, a, null,
    jsonb_build_object('created', n, 'total', v_total));
end $$;

create or replace function kafaa_decide_gap(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; b kafaa_gap_backlog; v_id text := case when jsonb_typeof(p -> 'id') = 'string' then p ->> 'id' end; v_code text; v_plan jsonb;
  v_pred jsonb; v_person text; v_at timestamptz := date_trunc('second', now()); v_gain integer; a kafaa_audit_events; l integer;
begin
  p := coalesce(p, '{}'::jsonb);
  if me is null then return kafaa_refuse('coverage.decide', 'gap_backlog', v_id, 'not_signed_in', 'Sign in first'); end if;
  v_role := kafaa_acting_role('learning_analytics', array['A']);
  if v_role is null then return kafaa_refuse('coverage.decide', 'gap_backlog', v_id, 'forbidden', 'Only the training manager can do this'); end if;
  select * into b from kafaa_gap_backlog where id = v_id;
  v_code := kafaa_cov_decision_problem(p, b.id is not null, current_date);
  if v_code = 'not_found' then return kafaa_refuse('coverage.decide', 'gap_backlog', v_id, 'not_found', 'Backlog item not found', v_role); end if;
  if v_code is not null then return kafaa_refuse('coverage.decide', 'gap_backlog', v_id, 'invalid', case v_code
    when 'route' then 'Choose build, partner or buy'
    when 'owner' then 'Choose the owning function from the skills catalogue owners'
    when 'person' then 'The named lead must be an active member of staff'
    when 'due' then 'Give a due date between today and 31 Dec 2030'
    when 'rationale' then 'Explain the decision in 10 to 500 characters'
    else 'A plan needs a title of 3 to 120 characters, a level from 1 to 3 and 1 to 200 hours' end, v_role); end if;
  v_plan := case when p ? 'plan' and jsonb_typeof(p -> 'plan') = 'object' then jsonb_build_object('title', regexp_replace(p -> 'plan' ->> 'title', '^\s+|\s+$', '', 'g'),
    'level', (p -> 'plan' ->> 'level')::integer, 'hours', (p -> 'plan' ->> 'hours')::integer) end;
  v_pred := kafaa_cov_whatif(kafaa_cov_roles(null, null), b.skill_id, coalesce((v_plan ->> 'level')::integer, b.level));
  v_person := nullif(p ->> 'owner_person_id', '');
  update kafaa_gap_backlog set owner_role = p ->> 'owner_role', owner_person_id = v_person, due_on = (p ->> 'due_on')::date, route = p ->> 'route',
    rationale = regexp_replace(p ->> 'rationale', '^\s+|\s+$', '', 'g'), rationale_ar = null, plan = v_plan, predicted = v_pred, status = 'decided', decided_by = me, decided_at = v_at, updated_at = v_at,
    history = history || jsonb_build_array(jsonb_build_object('at', kafaa_cov_ts(v_at), 'by', me, 'route', p ->> 'route', 'due_on', p ->> 'due_on', 'owner_role', p ->> 'owner_role'))
  where id = v_id;
  select coalesce(sum((m ->> 'delta')::integer), 0) into v_gain from jsonb_array_elements(v_pred) m;
  l := kafaa_ledger('kafaa.coverage.gap_decision', format('Gap %s: %s by %s, owner %s; predicted coverage moves on %s role profiles (+%s points in total)',
    v_id, p ->> 'route', p ->> 'due_on', p ->> 'owner_role', jsonb_array_length(v_pred), v_gain));
  a := kafaa_audit('coverage.decide', 'gap_backlog', v_id, 'ok', format('%s by %s (%s)', p ->> 'route', p ->> 'due_on', p ->> 'owner_role'), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Decision recorded in the backlog', a, l, jsonb_build_object('id', v_id, 'predicted', v_pred));
end $$;

-- ───────────── Grants: internal helpers are not executable by API roles; RPCs only by signed-in users.
revoke all on function kafaa_cov_restricted(), kafaa_cov_course_skills(text), kafaa_cov_taught(), kafaa_cov_owner(text), kafaa_cov_reqs(jsonb), kafaa_cov_score(jsonb, jsonb),
  kafaa_cov_roles(text, integer), kafaa_cov_whatif(jsonb, text, integer), kafaa_cov_needs(jsonb), kafaa_cov_reasons(jsonb, integer), kafaa_cov_ts(timestamptz), kafaa_cov_is_date(text),
  kafaa_cov_int_between(jsonb, integer, integer), kafaa_cov_decision_problem(jsonb, boolean, date), kafaa_cov_report(date, boolean), kafaa_sc_compute(date), kafaa_sc_report(boolean)
  from public, anon, authenticated;
revoke all on function kafaa_skill_change_report(), kafaa_compute_skill_change(), kafaa_curriculum_coverage(), kafaa_sync_gap_backlog(), kafaa_decide_gap(jsonb) from public, anon;
grant execute on function kafaa_skill_change_report(), kafaa_compute_skill_change(), kafaa_curriculum_coverage(), kafaa_sync_gap_backlog(), kafaa_decide_gap(jsonb) to authenticated;
