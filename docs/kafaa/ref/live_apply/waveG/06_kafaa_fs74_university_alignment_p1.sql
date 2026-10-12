-- kafaa_fs74_university_alignment_p1 (1/2) · from supabase/migrations/20261010274001_kafaa_fs74_university_alignment.sql
-- Apply with apply_migration name "kafaa_fs74_university_alignment_p1". Additive and idempotent; kafaa_* objects only.
-- [FS wave G · E4 · FS66 + FS67] University programme alignment; fellowships and sponsored placements (M10 Universities and research).
-- FS66: kafaa_programme_alignments holds a university programme mapped to ENEC skills and levels (each skill names the modules that teach it)
--   with its endorsement (an INMA-style review: three computed criteria and three reviewer criteria, maker-checker, three-year window).
--   Coverage reuses the FS57 rule unchanged (kafaa_cov_reqs / kafaa_cov_score / kafaa_cov_restricted from 20261010264001_kafaa_fs64; not
--   redefined) with the programme as the only teaching source, up to the learning ceiling (level 2). International anchors come from the FS08
--   crosswalk (published, listed kafaa_skill_alignments). kafaa_programme_graduates records graduates at hire; validated F01 evidence
--   (se:programme:<graduate>:<skill>, kind credential, basis validated, ref_table programme_alignments) is written only for an endorsed
--   programme whose window covers the graduation date (credential is a recorded kind, so F01 recomputes keep it; FS29 precedent).
-- FS67: kafaa_fellowships (NEST-style fellowships and sponsored study with placement, each with a host project and a supervisor role card)
--   and kafaa_fellowship_milestones (five required milestones from the kind's template). Completion is computed from milestones;
--   kafaa_fw_stats suppresses every cell under 10 and returns award counts only next to the completion rate.
-- kafaa_ua_* = src/modules/m10/alignment.ts, kafaa_fw_* = src/modules/m10/fellowship.ts; PGlite parity: scripts/validate/fs74-university-alignment.mjs.
-- Writes into other modules' tables through these SECURITY DEFINER functions only: F01 kafaa_skill_evidence (+ kafaa_skills_apply) and
-- M14 kafaa_notifications. Reads: organisations, people, job roles, FS05 role profiles, FS02 skills, FS08 alignments, research challenges,
-- ADVANCE technologies.
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.

-- ───────────── Tables (generated DDL, additive)
create table if not exists kafaa_programme_alignments (
  id text primary key,
  university_org_id text not null,
  code text not null,
  title_en text not null,
  title_ar text not null,
  degree text not null check (degree in ('bachelor', 'master', 'diploma', 'doctorate', 'certificate')),
  nqf_level integer,
  field_en text not null default '',
  field_ar text not null default '',
  summary_en text not null default '',
  summary_ar text not null default '',
  target_role_ids text[] not null default '{}'::text[],
  skills jsonb not null default '[]'::jsonb,
  placement boolean not null default false,
  accreditation_ref text not null default '',
  status text not null default 'draft' check (status in ('draft', 'submitted', 'endorsed', 'returned')),
  version integer not null default 1,
  submitted_by text,
  submitted_at timestamptz,
  decided_by text,
  decided_at timestamptz,
  decision_note text,
  criteria jsonb not null default '{}'::jsonb,
  covers_from date,
  valid_to date,
  coverage_snapshot jsonb,
  history jsonb not null default '[]'::jsonb,
  sample boolean not null default true,
  created_by text,
  updated_at timestamptz not null default now()
);
comment on table kafaa_programme_alignments is '[M10] University programme mapped to ENEC skills and levels, with coverage inputs and an INMA-style endorsement (FS66)';
create table if not exists kafaa_programme_graduates (
  id text primary key,
  person_id text not null,
  programme_id text not null,
  university_org_id text not null,
  graduated_on date not null,
  hired_on date not null,
  status text not null check (status in ('evidence_written', 'awaiting_endorsement', 'not_covered')),
  evidence_ids text[] not null default '{}'::text[],
  evidence_on date,
  recorded_by text not null,
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table kafaa_programme_graduates is '[M10] Graduate of a university programme recorded at hire, with the evidence decision (FS66)';
create table if not exists kafaa_fellowships (
  id text primary key,
  kind text not null check (kind in ('nest_fellowship', 'sponsored_study')),
  title_en text not null,
  title_ar text not null,
  fellow_person_id text not null,
  fellow_initials text not null default '',
  university_org_id text,
  host_kind text not null check (host_kind in ('research_challenge', 'advance_study')),
  host_ref text not null,
  supervisor_person_id text not null,
  supervisor_name_en text not null default '',
  supervisor_name_ar text not null default '',
  starts_on date not null,
  ends_on date not null,
  placement_en text not null default '',
  placement_ar text not null default '',
  status text not null default 'active' check (status in ('active', 'completed', 'withdrawn')),
  completed_on date,
  withdrawn_on date,
  withdraw_reason text,
  sample boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table kafaa_fellowships is '[M10] NEST-style fellowship or sponsored study with placement: host project, supervisor role card, planned span (FS67)';
create table if not exists kafaa_fellowship_milestones (
  id text primary key,
  fellowship_id text not null,
  fellow_person_id text not null,
  university_org_id text,
  supervisor_person_id text not null,
  n integer not null,
  kind text not null,
  owner text not null check (owner in ('enec', 'university')),
  required boolean not null default true,
  due_on date not null,
  status text not null default 'planned' check (status in ('planned', 'submitted', 'signed_off')),
  submitted_by text,
  submitted_at timestamptz,
  note text not null default '',
  signed_by text,
  signed_at timestamptz,
  return_note text,
  updated_at timestamptz not null default now()
);
comment on table kafaa_fellowship_milestones is '[M10] Required milestone of a fellowship: submitted by the fellow or university, signed off by the supervisor or HR (FS67)';
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_programme_alignments_university_org_id_fk') then alter table kafaa_programme_alignments add constraint kafaa_programme_alignments_university_org_id_fk foreign key (university_org_id) references kafaa_organisations(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_programme_graduates_person_id_fk') then alter table kafaa_programme_graduates add constraint kafaa_programme_graduates_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_programme_graduates_programme_id_fk') then alter table kafaa_programme_graduates add constraint kafaa_programme_graduates_programme_id_fk foreign key (programme_id) references kafaa_programme_alignments(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_programme_graduates_university_org_id_fk') then alter table kafaa_programme_graduates add constraint kafaa_programme_graduates_university_org_id_fk foreign key (university_org_id) references kafaa_organisations(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_fellowships_fellow_person_id_fk') then alter table kafaa_fellowships add constraint kafaa_fellowships_fellow_person_id_fk foreign key (fellow_person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_fellowships_university_org_id_fk') then alter table kafaa_fellowships add constraint kafaa_fellowships_university_org_id_fk foreign key (university_org_id) references kafaa_organisations(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_fellowships_supervisor_person_id_fk') then alter table kafaa_fellowships add constraint kafaa_fellowships_supervisor_person_id_fk foreign key (supervisor_person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_fellowship_milestones_fellowship_id_fk') then alter table kafaa_fellowship_milestones add constraint kafaa_fellowship_milestones_fellowship_id_fk foreign key (fellowship_id) references kafaa_fellowships(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_fellowship_milestones_fellow_person_id_fk') then alter table kafaa_fellowship_milestones add constraint kafaa_fellowship_milestones_fellow_person_id_fk foreign key (fellow_person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_fellowship_milestones_university_org_id_fk') then alter table kafaa_fellowship_milestones add constraint kafaa_fellowship_milestones_university_org_id_fk foreign key (university_org_id) references kafaa_organisations(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_fellowship_milestones_supervisor_person_id_fk') then alter table kafaa_fellowship_milestones add constraint kafaa_fellowship_milestones_supervisor_person_id_fk foreign key (supervisor_person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_programme_alignments_university_org_id_idx on kafaa_programme_alignments (university_org_id);
create index if not exists kafaa_programme_alignments_status_idx on kafaa_programme_alignments (status);
create index if not exists kafaa_programme_graduates_person_id_idx on kafaa_programme_graduates (person_id);
create index if not exists kafaa_programme_graduates_programme_id_idx on kafaa_programme_graduates (programme_id);
create index if not exists kafaa_programme_graduates_university_org_id_idx on kafaa_programme_graduates (university_org_id);
create index if not exists kafaa_programme_graduates_status_idx on kafaa_programme_graduates (status);
create index if not exists kafaa_fellowships_kind_idx on kafaa_fellowships (kind);
create index if not exists kafaa_fellowships_fellow_person_id_idx on kafaa_fellowships (fellow_person_id);
create index if not exists kafaa_fellowships_university_org_id_idx on kafaa_fellowships (university_org_id);
create index if not exists kafaa_fellowships_supervisor_person_id_idx on kafaa_fellowships (supervisor_person_id);
create index if not exists kafaa_fellowships_status_idx on kafaa_fellowships (status);
create index if not exists kafaa_fellowship_milestones_fellowship_id_idx on kafaa_fellowship_milestones (fellowship_id);
create index if not exists kafaa_fellowship_milestones_fellow_person_id_idx on kafaa_fellowship_milestones (fellow_person_id);
create index if not exists kafaa_fellowship_milestones_university_org_id_idx on kafaa_fellowship_milestones (university_org_id);
create index if not exists kafaa_fellowship_milestones_supervisor_person_id_idx on kafaa_fellowship_milestones (supervisor_person_id);
create index if not exists kafaa_fellowship_milestones_status_idx on kafaa_fellowship_milestones (status);

-- ───────────── RLS (generated rule; created once, then the per-statement form of the RLS performance pass)
do $$ begin
  execute 'alter table kafaa_programme_alignments enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_programme_alignments' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_programme_alignments for select to anon, authenticated using (kafaa_rule_read(''partner_org'', null::text, university_org_id, true) or kafaa_rule_read(''recognition'', null::text, null::text, true))'; end if;
  execute 'alter table kafaa_programme_graduates enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_programme_graduates' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_programme_graduates for select to anon, authenticated using (kafaa_rule_read(''own_profile'', person_id, null::text, true) or kafaa_rule_read(''applications'', null::text, null::text, true))'; end if;
  execute 'alter table kafaa_fellowships enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_fellowships' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_fellowships for select to anon, authenticated using (kafaa_rule_read(''own_profile'', fellow_person_id, null::text, true) or kafaa_rule_read(''own_profile'', supervisor_person_id, null::text, true) or kafaa_rule_read(''partner_org'', null::text, university_org_id, true) or kafaa_rule_read(''applications'', null::text, null::text, true))'; end if;
  execute 'alter table kafaa_fellowship_milestones enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_fellowship_milestones' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_fellowship_milestones for select to anon, authenticated using (kafaa_rule_read(''own_profile'', fellow_person_id, null::text, true) or kafaa_rule_read(''own_profile'', supervisor_person_id, null::text, true) or kafaa_rule_read(''partner_org'', null::text, university_org_id, true) or kafaa_rule_read(''applications'', null::text, null::text, true))'; end if;
end $$;
alter policy kafaa_read on kafaa_programme_alignments using ((((SELECT kafaa_has_grant('partner_org'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((university_org_id = (SELECT kafaa_my_org())) AND (SELECT kafaa_has_grant('partner_org'::text, ARRAY['OwnOrg'::text, 'OrgW'::text])))) OR (((SELECT kafaa_has_grant('recognition'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_programme_graduates using ((((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false))) OR (((SELECT kafaa_has_grant('applications'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_fellowships using ((((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((fellow_person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, fellow_person_id, NULL::text, false))) OR (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((supervisor_person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, supervisor_person_id, NULL::text, false))) OR (((SELECT kafaa_has_grant('partner_org'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((university_org_id = (SELECT kafaa_my_org())) AND (SELECT kafaa_has_grant('partner_org'::text, ARRAY['OwnOrg'::text, 'OrgW'::text])))) OR (((SELECT kafaa_has_grant('applications'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_fellowship_milestones using ((((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((fellow_person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, fellow_person_id, NULL::text, false))) OR (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((supervisor_person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, supervisor_person_id, NULL::text, false))) OR (((SELECT kafaa_has_grant('partner_org'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((university_org_id = (SELECT kafaa_my_org())) AND (SELECT kafaa_has_grant('partner_org'::text, ARRAY['OwnOrg'::text, 'OrgW'::text])))) OR (((SELECT kafaa_has_grant('applications'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
revoke all on kafaa_programme_alignments, kafaa_programme_graduates, kafaa_fellowships, kafaa_fellowship_milestones from anon, authenticated;
grant select on kafaa_programme_alignments, kafaa_programme_graduates, kafaa_fellowships, kafaa_fellowship_milestones to anon, authenticated;

-- ───────────── FS66 rules (mirror of alignment.ts)
create or replace function kafaa_ua_trim(p text) returns text language sql immutable set search_path = public as $$
  select regexp_replace(coalesce(p, ''), '^[ \t\r\n]+|[ \t\r\n]+$', '', 'g')
$$;
-- lenOk(v, min, max): absent, JSON null or a string whose trimmed length is within [min, max]
create or replace function kafaa_ua_len_ok(v jsonb, p_min integer, p_max integer) returns boolean language sql immutable set search_path = public as $$
  select case when v is null or jsonb_typeof(v) = 'null' then p_min = 0
              when jsonb_typeof(v) = 'string' then char_length(kafaa_ua_trim(v #>> '{}')) between p_min and p_max else false end
$$;
-- taughtOf(): {skill: min(level, 2)} over valid mapped skills, restricted skills left out
create or replace function kafaa_ua_taught(p_skills jsonb) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(x.sid, x.lv), '{}'::jsonb) from (
    select e ->> 'skill_id' sid, max(least((e ->> 'level')::numeric::integer, 2)) lv
      from jsonb_array_elements(case when jsonb_typeof(p_skills) = 'array' then p_skills else '[]'::jsonb end) e
     where jsonb_typeof(e) = 'object' and jsonb_typeof(e -> 'skill_id') = 'string' and jsonb_typeof(e -> 'level') = 'number'
       and (e ->> 'level')::numeric = floor((e ->> 'level')::numeric) and (e ->> 'level')::numeric >= 1 and not ((e ->> 'skill_id') = any(kafaa_cov_restricted()))
     group by e ->> 'skill_id') x
$$;
-- programmeCoverage(): target roles (job-role sort, id) x now/2030, smallest published version id, path-only skipped; FS57 scoring
create or replace function kafaa_ua_coverage(p_skills jsonb, p_roles jsonb) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_taught jsonb := kafaa_ua_taught(p_skills); v_out jsonb := '[]'::jsonb; h text; r record; v record; s jsonb; reqs jsonb; v_now integer; v_2030 integer; v_best integer;
begin
  foreach h in array array['now', '2030'] loop
    for r in select jr.id, coalesce(jr.sort, 0) srt from kafaa_job_roles jr
              where jr.id in (select x from jsonb_array_elements_text(case when jsonb_typeof(p_roles) = 'array' then (select coalesce(jsonb_agg(e), '[]'::jsonb) from jsonb_array_elements(p_roles) e where jsonb_typeof(e) = 'string') else '[]'::jsonb end) x)
              order by coalesce(jr.sort, 0), jr.id collate "C" loop
      select pv.id, pv.path_only, pv.requirements into v from kafaa_role_profile_versions pv where pv.role_id = r.id and pv.horizon = h and pv.status = 'published' order by pv.id collate "C" limit 1;
      if not found or v.path_only is true then continue; end if;
      s := kafaa_cov_score(kafaa_cov_reqs(v.requirements), v_taught);
      reqs := s -> 'reqs';
      v_out := v_out || jsonb_build_array(jsonb_build_object('role_id', r.id, 'horizon', h, 'version_id', v.id, 'score', s -> 'score', 'n', jsonb_array_length(reqs), 'covered', s -> 'covered',
        'uncovered', coalesce((select jsonb_agg(e -> 'skill_id' order by n) from jsonb_array_elements(reqs) with ordinality a(e, n) where (e ->> 'taught')::integer < (e ->> 'target')::integer), '[]'::jsonb)));
    end loop;
  end loop;
  select kafaa_ev_rdiv(sum((e ->> 'score')::integer), count(*)) into v_now from jsonb_array_elements(v_out) e where e ->> 'horizon' = 'now' and jsonb_typeof(e -> 'score') = 'number';
  select kafaa_ev_rdiv(sum((e ->> 'score')::integer), count(*)) into v_2030 from jsonb_array_elements(v_out) e where e ->> 'horizon' = '2030' and jsonb_typeof(e -> 'score') = 'number';
  select max((e ->> 'score')::integer) into v_best from jsonb_array_elements(v_out) e where jsonb_typeof(e -> 'score') = 'number';
  return jsonb_build_object('roles', v_out, 'now', v_now, 'h2030', v_2030, 'best', v_best);
end $$;
-- autoCriteria(): every mapped skill names modules; best target-role coverage >= 40; every mapped skill has a published, listed FS08 anchor
create or replace function kafaa_ua_auto(p_skills jsonb, p_roles jsonb) returns jsonb language sql stable security definer set search_path = public as $$
  with s as (select e from jsonb_array_elements(case when jsonb_typeof(p_skills) = 'array' then p_skills else '[]'::jsonb end) e)
  select jsonb_build_object(
    'outcomes', (select count(*) > 0 and bool_and(jsonb_typeof(e -> 'modules') = 'array' and jsonb_array_length(e -> 'modules') > 0) from s),
    'coverage', coalesce(((kafaa_ua_coverage(p_skills, p_roles) ->> 'best')::integer >= 40), false),
    'crosswalk', (select count(*) > 0 and bool_and(exists (select 1 from kafaa_skill_alignments a where a.skill_id = e ->> 'skill_id' and a.status = 'published' and a.listed is true)) from s))
$$;
-- programmeProblem(): first problem code of a programme draft, null when valid
create or replace function kafaa_ua_problem(p jsonb) returns text language plpgsql stable security definer set search_path = public as $$
declare v_code text; v_roles jsonb := p -> 'target_role_ids'; v_sk jsonb := p -> 'skills'; v_rs text[] := kafaa_cov_restricted();
begin
  if jsonb_typeof(p -> 'university_org_id') is distinct from 'string' or not exists (select 1 from kafaa_organisations o where o.id = p ->> 'university_org_id' and o.kind = 'university') then return 'org'; end if;
  if jsonb_typeof(p -> 'code') is distinct from 'string' then return 'code'; end if;
  v_code := kafaa_ua_trim(p ->> 'code');
  if v_code !~ '^[A-Za-z0-9 ./-]{2,30}$' or char_length(v_code) < 2 then return 'code'; end if;
  if jsonb_typeof(p -> 'title_en') is distinct from 'string' or jsonb_typeof(p -> 'title_ar') is distinct from 'string' or not kafaa_ua_len_ok(p -> 'title_en', 3, 160) or not kafaa_ua_len_ok(p -> 'title_ar', 3, 160) then return 'title'; end if;
  if jsonb_typeof(p -> 'degree') is distinct from 'string' or not (p ->> 'degree' = any(array['bachelor', 'master', 'diploma', 'doctorate', 'certificate'])) then return 'degree'; end if;
  if p -> 'nqf_level' is not null and jsonb_typeof(p -> 'nqf_level') <> 'null' and not kafaa_cov_int_between(p -> 'nqf_level', 1, 10) then return 'nqf'; end if;
  if not kafaa_ua_len_ok(p -> 'field_en', 0, 120) or not kafaa_ua_len_ok(p -> 'field_ar', 0, 120) then return 'field'; end if;
  if not kafaa_ua_len_ok(p -> 'summary_en', 0, 600) or not kafaa_ua_len_ok(p -> 'summary_ar', 0, 600) then return 'summary'; end if;
  if jsonb_typeof(v_roles) is distinct from 'array' or jsonb_array_length(v_roles) < 1 or jsonb_array_length(v_roles) > 4
     or (select count(distinct e::text) from jsonb_array_elements(v_roles) e) <> jsonb_array_length(v_roles)
     or exists (select 1 from jsonb_array_elements(v_roles) e where jsonb_typeof(e) <> 'string'
                  or not exists (select 1 from kafaa_job_roles jr where jr.id = e #>> '{}' and jr.lifecycle is distinct from 'concept' and jr.security_sensitive is not true)) then return 'roles'; end if;
  if jsonb_typeof(v_sk) is distinct from 'array' or jsonb_array_length(v_sk) < 3 or jsonb_array_length(v_sk) > 30 then return 'skills'; end if;
  if exists (select 1 from jsonb_array_elements(v_sk) e where jsonb_typeof(e) <> 'object' or jsonb_typeof(e -> 'skill_id') is distinct from 'string'
       or not exists (select 1 from kafaa_skills k where k.id = e ->> 'skill_id' and k.lifecycle is distinct from 'obsolete') or (e ->> 'skill_id') = any(v_rs)
       or not kafaa_cov_int_between(e -> 'level', 1, 2)
       or jsonb_typeof(e -> 'modules') is distinct from 'array' or jsonb_array_length(e -> 'modules') < 1 or jsonb_array_length(e -> 'modules') > 6
       or exists (select 1 from jsonb_array_elements(e -> 'modules') m where jsonb_typeof(m) <> 'string' or char_length(kafaa_ua_trim(m #>> '{}')) not between 2 and 80))
     or (select count(distinct e ->> 'skill_id') from jsonb_array_elements(v_sk) e) <> jsonb_array_length(v_sk) then return 'skills'; end if;
  if not kafaa_ua_len_ok(p -> 'accreditation_ref', 0, 120) then return 'accreditation'; end if;
  return null;
end $$;
-- cleanSkills(): stored form, modules trimmed, sorted by skill id
create or replace function kafaa_ua_clean_skills(p_skills jsonb) returns jsonb language sql immutable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('skill_id', e ->> 'skill_id', 'level', (e ->> 'level')::numeric::integer,
    'modules', (select coalesce(jsonb_agg(to_jsonb(kafaa_ua_trim(m #>> '{}')) order by k), '[]'::jsonb) from jsonb_array_elements(e -> 'modules') with ordinality b(m, k))) order by e ->> 'skill_id' collate "C"), '[]'::jsonb)
    from jsonb_array_elements(p_skills) e
$$;
-- decisionProblem()
create or replace function kafaa_ua_decision_problem(p jsonb, p_found boolean, p_status text, p_submitted_by text, p_me text, p_auto jsonb, p_today date) returns text language plpgsql immutable set search_path = public as $$
declare n integer := case when jsonb_typeof(p -> 'note') = 'string' then char_length(kafaa_ua_trim(p ->> 'note')) else 0 end; c jsonb;
begin
  if not p_found then return 'not_found'; end if;
  if p_status is distinct from 'submitted' then return 'status'; end if;
  if p_submitted_by = p_me then return 'maker_checker'; end if;
  if jsonb_typeof(p -> 'decision') is distinct from 'string' or not (p ->> 'decision' = any(array['endorse', 'return'])) then return 'decision'; end if;
  if n < 10 or n > 500 then return 'note'; end if;
  if p ->> 'decision' = 'endorse' then
    c := case when jsonb_typeof(p -> 'criteria') = 'object' then p -> 'criteria' else '{}'::jsonb end;
    if (c -> 'assessment') is distinct from 'true'::jsonb or (c -> 'placement') is distinct from 'true'::jsonb or (c -> 'accreditation') is distinct from 'true'::jsonb then return 'criteria'; end if;
    if p_auto is null or (p_auto -> 'outcomes') is distinct from 'true'::jsonb or (p_auto -> 'coverage') is distinct from 'true'::jsonb or (p_auto -> 'crosswalk') is distinct from 'true'::jsonb then return 'auto'; end if;
    if p -> 'covers_from' is not null and jsonb_typeof(p -> 'covers_from') <> 'null' and (jsonb_typeof(p -> 'covers_from') <> 'string' or not kafaa_cov_is_date(p ->> 'covers_from')
       or (p ->> 'covers_from')::date > p_today or (p ->> 'covers_from')::date < (p_today - interval '3 years')::date) then return 'covers'; end if;
  end if;
  return null;
end $$;
-- gradStatus()
create or replace function kafaa_ua_grad_status(p_status text, p_from date, p_to date, p_grad date) returns text language sql immutable set search_path = public as $$
  select case when p_status = 'endorsed' and p_from is not null and p_to is not null and p_grad between p_from and p_to then 'evidence_written'
              when p_status = 'endorsed' then 'not_covered' else 'awaiting_endorsement' end
$$;
-- hireProblem()
create or replace function kafaa_ua_hire_problem(p jsonb, p_person kafaa_people, p_prog_found boolean, p_exists boolean, p_today date) returns text language plpgsql stable set search_path = public as $$
begin
  if p_person.id is null or not (p_person.kind = any(array['applicant', 'staff'])) or p_person.status = 'leaver' then return 'person'; end if;
  if not p_prog_found then return 'programme'; end if;
  if p_exists then return 'duplicate'; end if;
  if jsonb_typeof(p -> 'graduated_on') is distinct from 'string' or not kafaa_cov_is_date(p ->> 'graduated_on') or p ->> 'graduated_on' < '2000-01-01' or (p ->> 'graduated_on')::date > p_today then return 'graduated'; end if;
  if jsonb_typeof(p -> 'hired_on') is distinct from 'string' or not kafaa_cov_is_date(p ->> 'hired_on') or (p ->> 'hired_on')::date < (p ->> 'graduated_on')::date
     or (p ->> 'hired_on')::date > (p_today + interval '1 year')::date then return 'hired'; end if;
  return null;
end $$;
-- notifications (M14) and evidence rows are written with the row-audit trigger quiet (transaction-local kafaa.seeding), restored afterwards
create or replace function kafaa_ua_notify(p_id text, p_person text, p_en text, p_ar text, p_link text, p_sev text) returns void language plpgsql security definer set search_path = public as $$
declare v_prev text := coalesce(current_setting('kafaa.seeding', true), '');
begin
  if p_person is null then return; end if;
  perform set_config('kafaa.seeding', 'on', true);
  insert into kafaa_notifications (id, person_id, kind, title_en, title_ar, body_en, body_ar, link, severity)
  values (p_id, p_person, 'university', p_en, p_ar, null, null, p_link, p_sev) on conflict (id) do nothing;
  perform set_config('kafaa.seeding', v_prev, true);
end $$;
-- graduateEvidence(): validated evidence for every live mapped skill (level <= 2), observed on the graduation date
create or replace function kafaa_ua_write_evidence(p_grad text, p_person text, p_grad_on date, p_prog text, p_who text) returns text[] language plpgsql security definer set search_path = public as $$
declare g kafaa_programme_alignments; k record; v_ev text; v_ids text[] := '{}'; v_prev text := coalesce(current_setting('kafaa.seeding', true), '');
begin
  select * into g from kafaa_programme_alignments where id = p_prog;
  perform set_config('kafaa.seeding', 'on', true);
  for k in select t.key sid, (t.value #>> '{}')::integer lv from jsonb_each(kafaa_ua_taught(g.skills)) t
            where t.key in (select s.id from kafaa_skills s where s.lifecycle is distinct from 'obsolete') order by t.key collate "C" loop
    v_ev := 'se:programme:' || p_grad || ':' || k.sid;
    insert into kafaa_skill_evidence (id, person_id, skill_id, kind, ref_table, ref_id, level, basis, status, observed_on, note, recorded_by, active)
    values (v_ev, p_person, k.sid, 'credential', 'programme_alignments', p_prog, k.lv, 'validated', 'current', p_grad_on, 'Endorsed programme ' || g.code, p_who, true)
    on conflict (id) do update set level = excluded.level, basis = 'validated', status = 'current', observed_on = excluded.observed_on, note = excluded.note, recorded_by = p_who, active = true;
    v_ids := v_ids || v_ev;
  end loop;
  perform set_config('kafaa.seeding', v_prev, true);
  return v_ids;
end $$;

-- ───────────── FS66 RPCs
create or replace function kafaa_save_programme(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_given text; cur kafaa_programme_alignments; v_found boolean := false; v_org text; v_role text; v_code text; v_id text; v_submit boolean;
  v_version integer; v_status text; v_at timestamptz := date_trunc('second', now()); v_skills jsonb; v_roles text[]; a kafaa_audit_events;
begin
  p := coalesce(p, '{}'::jsonb);
  v_given := case when jsonb_typeof(p -> 'id') = 'string' and p ->> 'id' <> '' then p ->> 'id' end;
  if me is null then return kafaa_refuse('programme.save', 'programme_alignments', v_given, 'not_signed_in', 'Sign in first'); end if;
  if v_given is not null then
    select * into cur from kafaa_programme_alignments where id = v_given; v_found := found;
    if not v_found then return kafaa_refuse('programme.save', 'programme_alignments', v_given, 'not_found', 'Programme not found'); end if;
  end if;
  v_org := case when v_found then cur.university_org_id when jsonb_typeof(p -> 'university_org_id') = 'string' then p ->> 'university_org_id' end;
  v_role := kafaa_acting_role('partner_org', array['A']);
  if v_role is null and v_org is not null and kafaa_my_org() = v_org and kafaa_has_grant('ecosystem', array['OrgW']) then v_role := kafaa_acting_role('ecosystem', array['OrgW']); end if;
  if v_role is null then return kafaa_refuse('programme.save', 'programme_alignments', v_given, 'forbidden', 'Only the university that owns the programme (or an ENEC partnerships admin) can edit it'); end if;
  if v_found and cur.status = 'submitted' then return kafaa_refuse('programme.save', 'programme_alignments', v_given, 'invalid', 'The programme is under review; wait for the decision before editing', v_role); end if;
  v_code := kafaa_ua_problem(p || jsonb_build_object('university_org_id', v_org));
  if v_code is not null then return kafaa_refuse('programme.save', 'programme_alignments', v_given, 'invalid', case v_code
    when 'org' then 'Choose a university organisation'
    when 'code' then 'Give a programme code of 2 to 30 letters, digits, spaces, dots, dashes or slashes'
    when 'title' then 'Give the title in English and Arabic (3 to 160 characters each)'
    when 'degree' then 'Choose the award: bachelor, master, diploma, doctorate or certificate'
    when 'nqf' then 'The indicative NQF level is a whole number from 1 to 10, or empty'
    when 'field' then 'The field of study is at most 120 characters in each language'
    when 'summary' then 'The summary is at most 600 characters in each language'
    when 'roles' then 'Choose 1 to 4 current ENEC roles graduates target (security roles are career-path only)'
    when 'skills' then 'Map 3 to 30 different skills, each at level 1 or 2 with 1 to 6 modules (2 to 80 characters); security and obsolete skills cannot be mapped'
    else 'The accreditation reference is at most 120 characters' end, v_role); end if;
  v_id := case when v_found then cur.id else 'ua-' || v_org || '-' || trim(both '-' from regexp_replace(lower(kafaa_ua_trim(p ->> 'code')), '[^a-z0-9]+', '-', 'g')) end;
  if not v_found and exists (select 1 from kafaa_programme_alignments where id = v_id) then
    return kafaa_refuse('programme.save', 'programme_alignments', v_id, 'duplicate', 'A programme with this code already exists for the university', v_role); end if;
  v_submit := coalesce((p -> 'submit') = 'true'::jsonb, false);
  v_version := case when v_found then cur.version + case when cur.status = 'endorsed' then 1 else 0 end else 1 end;
  v_status := case when v_submit then 'submitted' else 'draft' end;
  v_skills := kafaa_ua_clean_skills(p -> 'skills');
  v_roles := array(select x from jsonb_array_elements_text(p -> 'target_role_ids') with ordinality t(x, k) order by k);
  if v_found then
    update kafaa_programme_alignments set code = kafaa_ua_trim(p ->> 'code'), title_en = kafaa_ua_trim(p ->> 'title_en'), title_ar = kafaa_ua_trim(p ->> 'title_ar'), degree = p ->> 'degree',
      nqf_level = case when jsonb_typeof(p -> 'nqf_level') = 'number' then (p ->> 'nqf_level')::numeric::integer end,
      field_en = kafaa_ua_trim(p ->> 'field_en'), field_ar = kafaa_ua_trim(p ->> 'field_ar'), summary_en = kafaa_ua_trim(p ->> 'summary_en'), summary_ar = kafaa_ua_trim(p ->> 'summary_ar'),
      target_role_ids = v_roles, skills = v_skills, placement = coalesce((p -> 'placement') = 'true'::jsonb, false), accreditation_ref = kafaa_ua_trim(p ->> 'accreditation_ref'),
      status = v_status, version = v_version, updated_at = v_at,
      submitted_by = case when v_submit then me else submitted_by end, submitted_at = case when v_submit then v_at else submitted_at end,
      history = history || jsonb_build_array(jsonb_build_object('at', kafaa_cov_ts(v_at), 'by', me, 'action', case when v_submit then 'submitted' else 'saved' end, 'version', v_version)),
      decided_by = case when cur.status = 'endorsed' then null else decided_by end, decided_at = case when cur.status = 'endorsed' then null else decided_at end,
      decision_note = case when cur.status = 'endorsed' then null else decision_note end, criteria = case when cur.status = 'endorsed' then '{}'::jsonb else criteria end,
      covers_from = case when cur.status = 'endorsed' then null else covers_from end, valid_to = case when cur.status = 'endorsed' then null else valid_to end,
      coverage_snapshot = case when cur.status = 'endorsed' then null else coverage_snapshot end
    where id = v_id;
  else
    insert into kafaa_programme_alignments (id, university_org_id, code, title_en, title_ar, degree, nqf_level, field_en, field_ar, summary_en, summary_ar, target_role_ids, skills, placement,
      accreditation_ref, status, version, submitted_by, submitted_at, decided_by, decided_at, decision_note, criteria, covers_from, valid_to, coverage_snapshot, history, sample, created_by, updated_at)
    values (v_id, v_org, kafaa_ua_trim(p ->> 'code'), kafaa_ua_trim(p ->> 'title_en'), kafaa_ua_trim(p ->> 'title_ar'), p ->> 'degree',
      case when jsonb_typeof(p -> 'nqf_level') = 'number' then (p ->> 'nqf_level')::numeric::integer end, kafaa_ua_trim(p ->> 'field_en'), kafaa_ua_trim(p ->> 'field_ar'),
      kafaa_ua_trim(p ->> 'summary_en'), kafaa_ua_trim(p ->> 'summary_ar'), v_roles, v_skills, coalesce((p -> 'placement') = 'true'::jsonb, false), kafaa_ua_trim(p ->> 'accreditation_ref'),
      v_status, v_version, case when v_submit then me end, case when v_submit then v_at end, null, null, null, '{}'::jsonb, null, null, null,
      jsonb_build_array(jsonb_build_object('at', kafaa_cov_ts(v_at), 'by', me, 'action', case when v_submit then 'submitted' else 'saved' end, 'version', v_version)), false, me, v_at);
  end if;
  a := kafaa_audit('programme.save', 'programme_alignments', v_id, 'ok', v_status || ' v' || v_version, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when v_submit then 'Programme submitted for endorsement review' else 'Programme saved as a draft' end, a, null,
    jsonb_build_object('id', v_id, 'status', v_status, 'version', v_version, 'coverage', kafaa_ua_coverage(v_skills, to_jsonb(v_roles))));
end $$;

create or replace function kafaa_endorse_programme(p_id text, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; r kafaa_programme_alignments; v_found boolean; v_auto jsonb; v_code text; v_at timestamptz := date_trunc('second', now()); v_note text;
  v_from date; v_to date; v_snap jsonb; g kafaa_programme_graduates; v_st text; v_ids text[]; v_ev integer := 0; v_n integer := 0; v_people text[] := '{}'; x text; a kafaa_audit_events; l integer;
begin
  p := coalesce(p, '{}'::jsonb);
  if me is null then return kafaa_refuse('programme.decide', 'programme_alignments', p_id, 'not_signed_in', 'Sign in first'); end if;
  v_role := kafaa_acting_role('frameworks', array['A']);
  if v_role is null then return kafaa_refuse('programme.decide', 'programme_alignments', p_id, 'forbidden', 'Only a framework owner can endorse a programme'); end if;
  select * into r from kafaa_programme_alignments where id = p_id; v_found := found;
  v_auto := case when v_found then kafaa_ua_auto(r.skills, to_jsonb(r.target_role_ids)) end;
  v_code := kafaa_ua_decision_problem(p, v_found, r.status, r.submitted_by, me, v_auto, current_date);
  if v_code = 'not_found' then return kafaa_refuse('programme.decide', 'programme_alignments', p_id, 'not_found', 'Programme not found', v_role); end if;
  if v_code = 'maker_checker' then return kafaa_refuse('programme.decide', 'programme_alignments', p_id, 'maker_checker', 'The person who submitted the programme cannot decide it', v_role); end if;
  if v_code is not null then return kafaa_refuse('programme.decide', 'programme_alignments', p_id, 'invalid', case v_code
    when 'status' then 'Only a submitted programme can be decided'
    when 'decision' then 'Choose endorse or return'
    when 'note' then 'Explain the decision in 10 to 500 characters'
    when 'criteria' then 'Confirm assessment, placement and accreditation before endorsing'
    when 'auto' then 'The programme does not yet meet the computed criteria (modules for every skill, coverage threshold, international anchors)'
    else 'The first graduation date covered must be within the three years before today' end, v_role); end if;
  v_note := kafaa_ua_trim(p ->> 'note');
  if p ->> 'decision' = 'return' then
    update kafaa_programme_alignments set status = 'returned', decided_by = me, decided_at = v_at, decision_note = v_note, updated_at = v_at,
      history = history || jsonb_build_array(jsonb_build_object('at', kafaa_cov_ts(v_at), 'by', me, 'action', 'returned', 'version', r.version)) where id = p_id;
    perform kafaa_ua_notify('nt-ua-' || p_id || '-v' || r.version || '-returned', r.submitted_by, 'Programme returned for changes: ' || r.title_en, 'أُعيد البرنامج لإجراء تعديلات: ' || r.title_ar, '/universities/programmes/' || p_id, 'warn');
    l := kafaa_ledger('kafaa.programme.return', format('Programme %s (%s) returned to the university: %s', r.code, r.university_org_id, v_note));
    a := kafaa_audit('programme.decide', 'programme_alignments', p_id, 'ok', 'returned', case when l is null then 'skipped' else 'written' end, l, v_role);
    return kafaa_result(true, 'ok', 'Programme returned to the university', a, l, jsonb_build_object('id', p_id, 'status', 'returned', 'evidence', 0, 'graduates', 0));
  end if;
  v_from := case when jsonb_typeof(p -> 'covers_from') = 'string' then (p ->> 'covers_from')::date else make_date(extract(year from current_date)::integer - 1, 1, 1) end;
  v_to := (current_date + interval '3 years')::date;
  v_snap := kafaa_ua_coverage(r.skills, to_jsonb(r.target_role_ids));
  update kafaa_programme_alignments set status = 'endorsed', decided_by = me, decided_at = v_at, decision_note = v_note,
    criteria = jsonb_build_object('outcomes', true, 'coverage', true, 'crosswalk', true, 'assessment', true, 'placement', true, 'accreditation', true),
    covers_from = v_from, valid_to = v_to, coverage_snapshot = v_snap, updated_at = v_at,
    history = history || jsonb_build_array(jsonb_build_object('at', kafaa_cov_ts(v_at), 'by', me, 'action', 'endorsed', 'version', r.version)) where id = p_id;
  for g in select * from kafaa_programme_graduates where programme_id = p_id and status <> 'evidence_written' order by id collate "C" loop
    v_st := kafaa_ua_grad_status('endorsed', v_from, v_to, g.graduated_on);
    if v_st = 'evidence_written' then
      v_ids := kafaa_ua_write_evidence(g.id, g.person_id, g.graduated_on, p_id, me);
      update kafaa_programme_graduates set status = v_st, evidence_ids = v_ids, evidence_on = current_date, updated_at = v_at where id = g.id;
      v_ev := v_ev + cardinality(v_ids); v_n := v_n + 1; v_people := v_people || g.person_id;
      perform kafaa_ua_notify('nt-ua-grad-' || g.id, g.person_id, 'Your degree now counts as validated skill evidence (' || r.code || ')', 'أصبحت شهادتك دليلاً مُعتمداً على المهارات (' || r.code || ')', '/my/skills', 'ok');
    else
      update kafaa_programme_graduates set status = v_st, updated_at = v_at where id = g.id;
    end if;
  end loop;
  for x in select distinct y from unnest(v_people) y order by 1 loop perform kafaa_skills_apply(x, current_date); end loop;
  perform kafaa_ua_notify('nt-ua-' || p_id || '-v' || r.version || '-endorsed', r.submitted_by, 'Programme endorsed: ' || r.title_en, 'اعتُمد البرنامج: ' || r.title_ar, '/universities/programmes/' || p_id, 'ok');
  l := kafaa_ledger('kafaa.programme.endorse', format('Programme %s (%s) endorsed until %s; %s graduates received validated evidence (%s skills)', r.code, r.university_org_id, to_char(v_to, 'YYYY-MM-DD'), v_n, v_ev));
  a := kafaa_audit('programme.decide', 'programme_alignments', p_id, 'ok', 'endorsed until ' || to_char(v_to, 'YYYY-MM-DD'), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Programme endorsed', a, l, jsonb_build_object('id', p_id, 'status', 'endorsed', 'evidence', v_ev, 'graduates', v_n));
end $$;

create or replace function kafaa_record_graduate_hire(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_person kafaa_people; v_prog kafaa_programme_alignments; v_pf boolean := false; v_id text; v_code text; v_st text; v_ids text[] := '{}';
  v_at timestamptz := date_trunc('second', now()); a kafaa_audit_events; l integer;
begin
  p := coalesce(p, '{}'::jsonb);
  if me is null then return kafaa_refuse('programme.graduate', 'programme_graduates', null, 'not_signed_in', 'Sign in first'); end if;
  v_role := kafaa_acting_role('applications', array['A']);
  if v_role is null then return kafaa_refuse('programme.graduate', 'programme_graduates', null, 'forbidden', 'Only the HR director records graduate hires'); end if;
  if jsonb_typeof(p -> 'person_id') = 'string' then select * into v_person from kafaa_people where id = p ->> 'person_id'; end if;
  if jsonb_typeof(p -> 'programme_id') = 'string' then select * into v_prog from kafaa_programme_alignments where id = p ->> 'programme_id'; v_pf := found; end if;
  v_id := case when v_person.id is not null and v_pf then 'pg-' || v_prog.id || '-' || v_person.id end;
  v_code := kafaa_ua_hire_problem(p, v_person, v_pf, v_id is not null and exists (select 1 from kafaa_programme_graduates where id = v_id), current_date);
  if v_code = 'duplicate' then return kafaa_refuse('programme.graduate', 'programme_graduates', v_id, 'duplicate', 'This graduate is already recorded for this programme', v_role); end if;
  if v_code is not null then return kafaa_refuse('programme.graduate', 'programme_graduates', v_id, 'invalid', case v_code
    when 'person' then 'Choose a graduate (an applicant or a member of staff)'
    when 'programme' then 'Choose a university programme'
    when 'graduated' then 'Give a graduation date between 1 Jan 2000 and today'
    else 'The hire date is on or after the graduation date and at most a year ahead' end, v_role); end if;
  v_st := kafaa_ua_grad_status(v_prog.status, v_prog.covers_from, v_prog.valid_to, (p ->> 'graduated_on')::date);
  insert into kafaa_programme_graduates (id, person_id, programme_id, university_org_id, graduated_on, hired_on, status, evidence_ids, evidence_on, recorded_by, recorded_at, updated_at)
  values (v_id, v_person.id, v_prog.id, v_prog.university_org_id, (p ->> 'graduated_on')::date, (p ->> 'hired_on')::date, v_st, '{}', null, me, v_at, v_at);
  if v_st = 'evidence_written' then
    v_ids := kafaa_ua_write_evidence(v_id, v_person.id, (p ->> 'graduated_on')::date, v_prog.id, me);
    update kafaa_programme_graduates set evidence_ids = v_ids, evidence_on = current_date where id = v_id;
    perform kafaa_skills_apply(v_person.id, current_date);
    perform kafaa_ua_notify('nt-ua-grad-' || v_id, v_person.id, 'Your degree now counts as validated skill evidence (' || v_prog.code || ')', 'أصبحت شهادتك دليلاً مُعتمداً على المهارات (' || v_prog.code || ')', '/my/skills', 'ok');
  end if;
  l := kafaa_ledger('kafaa.programme.graduate_hire', 'Graduate hire recorded for programme ' || v_prog.code || ': ' || case v_st when 'evidence_written' then cardinality(v_ids) || ' skills recorded as validated evidence'
    when 'not_covered' then 'graduation date outside the endorsement window, no evidence' else 'programme not endorsed yet, no evidence' end);
  a := kafaa_audit('programme.graduate', 'programme_graduates', v_id, 'ok', v_st || ' (' || cardinality(v_ids) || ' skills)', case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case v_st when 'evidence_written' then 'Hire recorded; validated evidence written for the mapped skills'
    when 'not_covered' then 'Hire recorded; the graduation date is outside the endorsement window, so no evidence was written' else 'Hire recorded; evidence waits for the programme endorsement' end,
    a, l, jsonb_build_object('id', v_id, 'status', v_st, 'evidence', cardinality(v_ids)));
end $$;

-- ───────────── FS67 rules (mirror of fellowship.ts)
-- milestonePlan(): five milestones, due = start + floor(span x num / den) + extra days
create or replace function kafaa_fw_plan(p_id text, p_kind text, p_starts date, p_ends date) returns table(id text, n integer, kind text, owner text, due_on date) language sql immutable set search_path = public as $$
  select p_id || '-m' || t.n, t.n, t.k, t.o, p_starts + ((p_ends - p_starts) * t.num / t.den) + t.plus
    from (values
      ('nest_fellowship', 1, 'research_plan', 'enec', 1, 10, 0), ('nest_fellowship', 2, 'midpoint_review', 'enec', 1, 2, 0), ('nest_fellowship', 3, 'deliverable', 'enec', 9, 10, 0),
      ('nest_fellowship', 4, 'final_report', 'enec', 1, 1, 0), ('nest_fellowship', 5, 'knowledge_transfer', 'enec', 1, 1, 30),
      ('sponsored_study', 1, 'enrolment', 'university', 0, 1, 14), ('sponsored_study', 2, 'year_results', 'university', 2, 5, 0), ('sponsored_study', 3, 'placement_start', 'enec', 3, 5, 0),
      ('sponsored_study', 4, 'placement_review', 'enec', 4, 5, 0), ('sponsored_study', 5, 'graduation', 'university', 1, 1, 0)) t(kd, n, k, o, num, den, plus)
   where t.kd = p_kind order by t.n
$$;
-- fellowshipProblem()
create or replace function kafaa_fw_problem(p jsonb) returns text language plpgsql stable security definer set search_path = public as $$
declare v_kind text := case when jsonb_typeof(p -> 'kind') = 'string' then p ->> 'kind' end; f kafaa_people; s kafaa_people; v_given boolean; v_uni boolean; v_span integer;
begin
  if v_kind is null or not (v_kind = any(array['nest_fellowship', 'sponsored_study'])) then return 'kind'; end if;
  if jsonb_typeof(p -> 'title_en') is distinct from 'string' or jsonb_typeof(p -> 'title_ar') is distinct from 'string' or not kafaa_ua_len_ok(p -> 'title_en', 3, 160) or not kafaa_ua_len_ok(p -> 'title_ar', 3, 160) then return 'title'; end if;
  if jsonb_typeof(p -> 'fellow_person_id') = 'string' then select * into f from kafaa_people where id = p ->> 'fellow_person_id'; end if;
  if f.id is null or not (f.kind = any(array['applicant', 'staff'])) or f.status = 'leaver' then return 'fellow'; end if;
  v_given := p -> 'university_org_id' is not null and jsonb_typeof(p -> 'university_org_id') <> 'null' and not (jsonb_typeof(p -> 'university_org_id') = 'string' and p ->> 'university_org_id' = '');
  v_uni := v_given and jsonb_typeof(p -> 'university_org_id') = 'string' and exists (select 1 from kafaa_organisations o where o.id = p ->> 'university_org_id' and o.kind = 'university');
  if (v_given and not v_uni) or (v_kind = 'sponsored_study' and not v_uni) then return 'university'; end if;
  if jsonb_typeof(p -> 'host_kind') is distinct from 'string' or not (p ->> 'host_kind' = any(array['research_challenge', 'advance_study'])) then return 'host'; end if;
  if (p ->> 'host_kind' = 'research_challenge' and not exists (select 1 from kafaa_research_challenges c where c.id = p ->> 'host_ref' and jsonb_typeof(p -> 'host_ref') = 'string' and c.is_published is true))
     or (p ->> 'host_kind' = 'advance_study' and not exists (select 1 from kafaa_adv_technologies t where t.id = p ->> 'host_ref' and jsonb_typeof(p -> 'host_ref') = 'string')) then return 'host'; end if;
  if jsonb_typeof(p -> 'supervisor_person_id') = 'string' then select * into s from kafaa_people where id = p ->> 'supervisor_person_id'; end if;
  if s.id is null or s.kind <> 'staff' or coalesce(s.persona_id, '') = '' or s.status <> 'active' or s.id = f.id then return 'supervisor'; end if;
  if jsonb_typeof(p -> 'starts_on') is distinct from 'string' or jsonb_typeof(p -> 'ends_on') is distinct from 'string' or not kafaa_cov_is_date(p ->> 'starts_on') or not kafaa_cov_is_date(p ->> 'ends_on') then return 'dates'; end if;
  v_span := (p ->> 'ends_on')::date - (p ->> 'starts_on')::date;
  if v_span < 90 or v_span > 1461 then return 'dates'; end if;
  if not kafaa_ua_len_ok(p -> 'placement_en', 0, 300) or not kafaa_ua_len_ok(p -> 'placement_ar', 0, 300) or (v_kind = 'sponsored_study' and char_length(kafaa_ua_trim(case when jsonb_typeof(p -> 'placement_en') = 'string' then p ->> 'placement_en' end)) < 3) then return 'placement'; end if;
  if p ->> 'host_kind' = 'advance_study' and not kafaa_so_text_clean(array[kafaa_ua_trim(p ->> 'title_en'), kafaa_ua_trim(p ->> 'title_ar'),
       kafaa_ua_trim(case when jsonb_typeof(p -> 'placement_en') = 'string' then p ->> 'placement_en' end), kafaa_ua_trim(case when jsonb_typeof(p -> 'placement_ar') = 'string' then p ->> 'placement_ar' end)]) then return 'clean'; end if;
  if exists (select 1 from kafaa_fellowships w where w.id = 'fw-' || left(p ->> 'starts_on', 4) || '-' || f.id) then return 'duplicate'; end if;
  return null;
end $$;
-- milestoneProblem()
create or replace function kafaa_fw_ms_problem(p_action text, m kafaa_fellowship_milestones, w kafaa_fellowships, p_me text, p_hr boolean, p_uni text, p_note text) returns text language plpgsql immutable set search_path = public as $$
declare n integer := char_length(kafaa_ua_trim(p_note));
begin
  if m.id is null or w.id is null then return 'not_found'; end if;
  if w.status <> 'active' then return 'closed'; end if;
  if p_action is null or not (p_action = any(array['submit', 'sign_off', 'return'])) then return 'status'; end if;
  if n > 500 then return 'note'; end if;
  if p_action = 'submit' then
    if not (p_me = w.fellow_person_id or (m.owner = 'university' and p_uni is not null and p_uni = w.university_org_id)) then return 'forbidden'; end if;
    if m.status <> 'planned' then return 'status'; end if;
    return null;
  end if;
  if not (p_hr or p_me = w.supervisor_person_id) then return 'forbidden'; end if;
  if m.status <> 'submitted' then return 'status'; end if;
  if p_action = 'sign_off' and m.submitted_by = p_me then return 'maker_checker'; end if;
  if p_action = 'return' and n < 5 then return 'note'; end if;
  return null;
end $$;
-- fellowshipStats(): completion from milestones, every cell suppressed under 10
create or replace function kafaa_fw_cell(p_key text, p_awarded integer, p_due integer, p_completed integer) returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object('key', p_key, 'awarded', case when p_due >= 10 and p_awarded >= 10 then p_awarded end, 'due', case when p_due >= 10 then p_due end,
    'completed', case when p_due >= 10 and p_completed >= 10 then p_completed end, 'rate', case when p_due >= 10 then round(100.0 * p_completed / p_due)::integer end, 'suppressed', p_due < 10)
$$;
create or replace function kafaa_fw_stats(p_as_of date) returns jsonb language sql stable security definer set search_path = public as $$
  with r as (
    select f.id, f.kind, f.host_kind, coalesce(f.university_org_id, 'enec') uni,
           (f.status <> 'withdrawn' and exists (select 1 from kafaa_fellowship_milestones m where m.fellowship_id = f.id and m.required is not false)
             and not exists (select 1 from kafaa_fellowship_milestones m where m.fellowship_id = f.id and m.required is not false and m.status <> 'signed_off')) complete,
           f.status, f.ends_on
      from kafaa_fellowships f),
  d as (select r.*, (r.complete or r.status = 'withdrawn' or r.ends_on < p_as_of) due from r)
  select jsonb_build_object(
    'as_of', to_char(p_as_of, 'YYYY-MM-DD'), 'min', 10,
    'overall', (select kafaa_fw_cell('all', count(*)::integer, count(*) filter (where due)::integer, count(*) filter (where complete)::integer) from d),
    'by_kind', (select jsonb_agg(kafaa_fw_cell(k.k, (select count(*) from d where d.kind = k.k)::integer, (select count(*) from d where d.kind = k.k and due)::integer,
                  (select count(*) from d where d.kind = k.k and complete)::integer) order by k.o) from (values ('nest_fellowship', 1), ('sponsored_study', 2)) k(k, o)),
    'by_host', (select jsonb_agg(kafaa_fw_cell(k.k, (select count(*) from d where d.host_kind = k.k)::integer, (select count(*) from d where d.host_kind = k.k and due)::integer,
                  (select count(*) from d where d.host_kind = k.k and complete)::integer) order by k.o) from (values ('research_challenge', 1), ('advance_study', 2)) k(k, o)),
    'by_university', coalesce((select jsonb_agg(kafaa_fw_cell(u.uni, u.a, u.du, u.c) order by (u.uni = 'enec'), u.uni collate "C")
                  from (select uni, count(*)::integer a, count(*) filter (where due)::integer du, count(*) filter (where complete)::integer c from d group by uni) u), '[]'::jsonb),
    'overdue', (select case when count(*) >= 10 then count(*)::integer end from kafaa_fellowship_milestones m join kafaa_fellowships f on f.id = m.fellowship_id
                 where f.status = 'active' and m.status <> 'signed_off' and m.due_on < p_as_of))
$$;
