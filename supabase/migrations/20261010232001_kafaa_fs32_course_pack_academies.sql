-- [FS wave C · E2 · FS19 + FS20] Future-skills course pack and future-skills academies and cohorts (M04 learning and training).
-- FS19: course_pack_items (theme, core or cross-over, hour envelope, SIMULATED outline, the stored copy and link check) and
--   course_skill_links (objective -> skill at a stated level 1-3). A link is also the course's F01 evidence key on that skill
--   (kafaa_fsc_sync_keys writes kafaa_skills.evidence_keys: the platform's "course teaches skill" relation, read by the F01 derivation,
--   the FS07 explorer and the Coach). Copy and link check kafaa_fsc_copy_problems = copyProblems in src/modules/m04/fsPack.ts.
-- FS20: academies (module + project + mentor template), academy_cohorts, academy_members (nomination, decision, mentor, reviewer),
--   cohort_capstones. Acceptance enrols the member in the module courses (M04 enrolments). The named reviewer signs a capstone off:
--   merit or pass writes F01 `ojt` evidence (ref_table cohort_capstones; recorded evidence, kept on recompute) and runs
--   kafaa_skills_apply. Statistics kafaa_acad_stats_core = academyStats in src/modules/m04/academy.ts, suppressed under 10.
-- Shared writes (inside SECURITY DEFINER functions only, row-audit triggers quiet via kafaa.seeding): kafaa_skills.evidence_keys,
--   kafaa_skill_evidence (+ kafaa_skills_apply), kafaa_enrolments, kafaa_notifications. No NEXUS object is touched.
-- PGlite parity and checks: scripts/validate/fs32-course-pack-academies.mjs.
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.

-- ───────────── Tables (generated DDL, additive)
create table if not exists kafaa_course_pack_items (
  id text primary key,
  course_id text not null unique,
  pack text not null default 'fs19',
  theme text not null check (theme in ('data_ai', 'digital_plant', 'advanced_reactor', 'green', 'human', 'cyber')),
  kind text not null default 'core' check (kind in ('core', 'crossover')),
  crossover_of text,
  for_industries text[] not null default '{}'::text[],
  weeks integer not null,
  weekly_hours numeric not null,
  simulated boolean not null default true,
  no_decision boolean not null default false,
  copy_check text not null default 'pending' check (copy_check in ('passed', 'failed', 'pending')),
  copy_problems jsonb not null default '[]'::jsonb,
  copy_checked_at timestamptz,
  benchmark_ids text[] not null default '{}'::text[],
  sort integer not null default 0
);
comment on table kafaa_course_pack_items is '[M04] FS19 future-skills course pack: theme, core or cross-over, hour envelope and the copy and link check result per course';

create table if not exists kafaa_course_skill_links (
  id text primary key,
  course_id text not null,
  skill_id text not null,
  level integer not null,
  objective_n integer not null default 1,
  objective_en text not null,
  objective_ar text not null,
  active boolean not null default true,
  updated_by text,
  updated_at timestamptz not null default now()
);
comment on table kafaa_course_skill_links is '[M04] FS19 course objective linked to a skill at a stated level (1-3); also the course''s evidence key on that skill';

create table if not exists kafaa_academies (
  id text primary key,
  programme_id text not null,
  code text not null unique,
  name_en text not null,
  name_ar text not null,
  tagline_en text not null,
  tagline_ar text not null,
  theme text not null check (theme in ('data_ai', 'digital_plant', 'advanced_reactor', 'green')),
  module_course_ids text[] not null default '{}'::text[],
  project_en text not null,
  project_ar text not null,
  deliverable_en text not null,
  deliverable_ar text not null,
  artefact_kind text not null check (artefact_kind in ('automation', 'analysis', 'twin_validation', 'study', 'role_delta')),
  mentor_role_en text not null,
  mentor_role_ar text not null,
  reviewer_role_en text not null,
  reviewer_role_ar text not null,
  criteria_en text not null,
  criteria_ar text not null,
  weeks integer not null,
  weekly_hours numeric not null,
  capacity integer not null default 16,
  capstone_skills jsonb not null default '[]'::jsonb,
  no_decision boolean not null default false,
  simulated boolean not null default true,
  benchmark_ids text[] not null default '{}'::text[],
  sources jsonb not null default '[]'::jsonb,
  sort integer not null default 0
);
comment on table kafaa_academies is '[M04] FS20 future-skills academy on the module + project + mentor template (Nordic NNTP pattern)';

create table if not exists kafaa_academy_cohorts (
  id text primary key,
  academy_id text not null,
  code text not null unique,
  label_en text not null,
  label_ar text not null,
  starts_on date not null,
  ends_on date not null,
  nominations_close_on date,
  status text not null default 'planned' check (status in ('planned', 'nominating', 'running', 'completed')),
  capacity integer not null default 16,
  sort integer not null default 0
);
comment on table kafaa_academy_cohorts is '[M04] FS20 academy cohort (intake): dates, capacity and status';

create table if not exists kafaa_academy_members (
  id text primary key,
  cohort_id text not null,
  academy_id text not null,
  person_id text not null,
  status text not null default 'nominated' check (status in ('nominated', 'accepted', 'declined', 'active', 'completed', 'withdrawn')),
  source text not null check (source in ('self', 'manager', 'programme')),
  nominated_by text not null,
  nominated_at timestamptz not null default now(),
  note text,
  decided_by text,
  decided_at timestamptz,
  decision_note text,
  mentor_person_id text,
  reviewer_person_id text,
  completed_on date
);
comment on table kafaa_academy_members is '[M04] FS20 academy nomination and place: who nominated, the decision, mentor and reviewer, alumni date';

create table if not exists kafaa_cohort_capstones (
  id text primary key,
  member_id text not null unique,
  cohort_id text not null,
  academy_id text not null,
  person_id text not null,
  mentor_person_id text,
  reviewer_person_id text not null,
  artefact_kind text not null check (artefact_kind in ('automation', 'analysis', 'twin_validation', 'study', 'role_delta')),
  title text not null default '',
  summary text not null default '',
  lang text not null default 'en' check (lang in ('en', 'ar')),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'signed_off', 'returned')),
  result text check (result in ('merit', 'pass', 'not_yet')),
  feedback text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  evidence_ids text[] not null default '{}'::text[],
  updated_at timestamptz not null default now()
);
comment on table kafaa_cohort_capstones is '[M04] FS20 capstone project: the built artefact, the reviewer''s sign-off and the F01 evidence it wrote';

do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_course_pack_items_course_id_fk') then alter table kafaa_course_pack_items add constraint kafaa_course_pack_items_course_id_fk foreign key (course_id) references kafaa_courses(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_course_pack_items_crossover_of_fk') then alter table kafaa_course_pack_items add constraint kafaa_course_pack_items_crossover_of_fk foreign key (crossover_of) references kafaa_courses(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_course_skill_links_course_id_fk') then alter table kafaa_course_skill_links add constraint kafaa_course_skill_links_course_id_fk foreign key (course_id) references kafaa_courses(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_course_skill_links_skill_id_fk') then alter table kafaa_course_skill_links add constraint kafaa_course_skill_links_skill_id_fk foreign key (skill_id) references kafaa_skills(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_course_skill_links_updated_by_fk') then alter table kafaa_course_skill_links add constraint kafaa_course_skill_links_updated_by_fk foreign key (updated_by) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_academies_programme_id_fk') then alter table kafaa_academies add constraint kafaa_academies_programme_id_fk foreign key (programme_id) references kafaa_programmes(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_academy_cohorts_academy_id_fk') then alter table kafaa_academy_cohorts add constraint kafaa_academy_cohorts_academy_id_fk foreign key (academy_id) references kafaa_academies(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_academy_members_cohort_id_fk') then alter table kafaa_academy_members add constraint kafaa_academy_members_cohort_id_fk foreign key (cohort_id) references kafaa_academy_cohorts(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_academy_members_academy_id_fk') then alter table kafaa_academy_members add constraint kafaa_academy_members_academy_id_fk foreign key (academy_id) references kafaa_academies(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_academy_members_person_id_fk') then alter table kafaa_academy_members add constraint kafaa_academy_members_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_academy_members_nominated_by_fk') then alter table kafaa_academy_members add constraint kafaa_academy_members_nominated_by_fk foreign key (nominated_by) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_academy_members_decided_by_fk') then alter table kafaa_academy_members add constraint kafaa_academy_members_decided_by_fk foreign key (decided_by) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_academy_members_mentor_person_id_fk') then alter table kafaa_academy_members add constraint kafaa_academy_members_mentor_person_id_fk foreign key (mentor_person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_academy_members_reviewer_person_id_fk') then alter table kafaa_academy_members add constraint kafaa_academy_members_reviewer_person_id_fk foreign key (reviewer_person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_cohort_capstones_member_id_fk') then alter table kafaa_cohort_capstones add constraint kafaa_cohort_capstones_member_id_fk foreign key (member_id) references kafaa_academy_members(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_cohort_capstones_cohort_id_fk') then alter table kafaa_cohort_capstones add constraint kafaa_cohort_capstones_cohort_id_fk foreign key (cohort_id) references kafaa_academy_cohorts(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_cohort_capstones_academy_id_fk') then alter table kafaa_cohort_capstones add constraint kafaa_cohort_capstones_academy_id_fk foreign key (academy_id) references kafaa_academies(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_cohort_capstones_person_id_fk') then alter table kafaa_cohort_capstones add constraint kafaa_cohort_capstones_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_cohort_capstones_mentor_person_id_fk') then alter table kafaa_cohort_capstones add constraint kafaa_cohort_capstones_mentor_person_id_fk foreign key (mentor_person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_cohort_capstones_reviewer_person_id_fk') then alter table kafaa_cohort_capstones add constraint kafaa_cohort_capstones_reviewer_person_id_fk foreign key (reviewer_person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_course_pack_items_theme_idx on kafaa_course_pack_items (theme);
create index if not exists kafaa_course_pack_items_crossover_of_idx on kafaa_course_pack_items (crossover_of);
create index if not exists kafaa_course_skill_links_course_id_idx on kafaa_course_skill_links (course_id);
create index if not exists kafaa_course_skill_links_skill_id_idx on kafaa_course_skill_links (skill_id);
create index if not exists kafaa_course_skill_links_updated_by_idx on kafaa_course_skill_links (updated_by);
create index if not exists kafaa_academies_programme_id_idx on kafaa_academies (programme_id);
create index if not exists kafaa_academy_cohorts_academy_id_idx on kafaa_academy_cohorts (academy_id);
create index if not exists kafaa_academy_cohorts_status_idx on kafaa_academy_cohorts (status);
create index if not exists kafaa_academy_members_cohort_id_idx on kafaa_academy_members (cohort_id);
create index if not exists kafaa_academy_members_academy_id_idx on kafaa_academy_members (academy_id);
create index if not exists kafaa_academy_members_person_id_idx on kafaa_academy_members (person_id);
create index if not exists kafaa_academy_members_status_idx on kafaa_academy_members (status);
create index if not exists kafaa_academy_members_nominated_by_idx on kafaa_academy_members (nominated_by);
create index if not exists kafaa_academy_members_decided_by_idx on kafaa_academy_members (decided_by);
create index if not exists kafaa_academy_members_mentor_person_id_idx on kafaa_academy_members (mentor_person_id);
create index if not exists kafaa_academy_members_reviewer_person_id_idx on kafaa_academy_members (reviewer_person_id);
create index if not exists kafaa_cohort_capstones_cohort_id_idx on kafaa_cohort_capstones (cohort_id);
create index if not exists kafaa_cohort_capstones_academy_id_idx on kafaa_cohort_capstones (academy_id);
create index if not exists kafaa_cohort_capstones_person_id_idx on kafaa_cohort_capstones (person_id);
create index if not exists kafaa_cohort_capstones_mentor_person_id_idx on kafaa_cohort_capstones (mentor_person_id);
create index if not exists kafaa_cohort_capstones_reviewer_person_id_idx on kafaa_cohort_capstones (reviewer_person_id);
create index if not exists kafaa_cohort_capstones_status_idx on kafaa_cohort_capstones (status);

-- ───────────── RLS (generated rules; policies created once, never dropped)
do $$ begin
  execute 'alter table kafaa_course_pack_items enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_course_pack_items' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_course_pack_items for select to anon, authenticated using (kafaa_rule_read(''public_content'', null::text, null::text, true))'; end if;
  execute 'alter table kafaa_course_skill_links enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_course_skill_links' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_course_skill_links for select to anon, authenticated using (kafaa_rule_read(''public_content'', null::text, null::text, true))'; end if;
  execute 'alter table kafaa_academies enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_academies' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_academies for select to anon, authenticated using (kafaa_rule_read(''public_content'', null::text, null::text, true))'; end if;
  execute 'alter table kafaa_academy_cohorts enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_academy_cohorts' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_academy_cohorts for select to anon, authenticated using (kafaa_rule_read(''public_content'', null::text, null::text, true))'; end if;
  execute 'alter table kafaa_academy_members enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_academy_members' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_academy_members for select to anon, authenticated using (kafaa_rule_read(''training'', person_id, null::text, true) or kafaa_rule_read(''own_profile'', mentor_person_id, null::text, true) or kafaa_rule_read(''own_profile'', reviewer_person_id, null::text, true))'; end if;
  execute 'alter table kafaa_cohort_capstones enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_cohort_capstones' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_cohort_capstones for select to anon, authenticated using (kafaa_rule_read(''training'', person_id, null::text, true) or kafaa_rule_read(''own_profile'', mentor_person_id, null::text, true) or kafaa_rule_read(''own_profile'', reviewer_person_id, null::text, true))'; end if;
end $$;
revoke insert, update, delete on kafaa_course_pack_items, kafaa_course_skill_links, kafaa_academies, kafaa_academy_cohorts, kafaa_academy_members, kafaa_cohort_capstones from anon, authenticated;
grant select on kafaa_course_pack_items, kafaa_course_skill_links, kafaa_academies, kafaa_academy_cohorts, kafaa_academy_members, kafaa_cohort_capstones to anon, authenticated;

-- ───────────── FS19 rules (mirror of src/modules/m04/fsPack.ts)
create or replace function kafaa_fsc_restricted_terms() returns text[] language sql immutable set search_path = public as $$
  select array['vital area', 'protected area', 'security plan', 'guard force', 'design basis threat', 'safeguards', 'physical protection', 'alarm station', 'access code', 'firewall rule', 'network diagram', 'ip address', 'scada password', 'plc password', 'default password', 'port number', 'vlan', 'remote access configuration', 'penetration test', 'exploit', 'malware sample', 'vulnerability scan', 'security zone map', 'clearance level', 'patrol route']::text[]
$$;

-- copyProblems(theme, texts, urls): restricted wording anywhere; https links only; no links into security advisories; the cyber hygiene
-- course links only awareness-level public pages on an allow-list of hosts.
create or replace function kafaa_fsc_copy_problems(p_theme text, p_texts text[], p_urls text[]) returns jsonb language plpgsql immutable set search_path = public as $$
declare
  v_blob text := lower(coalesce(array_to_string(array(select coalesce(x, '') from unnest(coalesce(p_texts, '{}'::text[])) x), E' \n '), ''));
  t text; u text; v_low text; v_host text; v_out jsonb := '[]'::jsonb;
begin
  foreach t in array kafaa_fsc_restricted_terms() loop
    if strpos(v_blob, t) > 0 then v_out := v_out || jsonb_build_array(jsonb_build_object('code', 'restricted_term', 'detail', t)); end if;
  end loop;
  for u in select btrim(coalesce(x, ''), E' \t\n\r') from unnest(coalesce(p_urls, '{}'::text[])) with ordinality z(x, o) order by o loop
    if u !~* '^https://' then v_out := v_out || jsonb_build_array(jsonb_build_object('code', 'link_https', 'detail', u)); continue; end if;
    v_low := lower(u);
    v_host := lower(coalesce(substring(u from '^[a-zA-Z]+://([^/:?#]+)'), ''));
    if exists (select 1 from unnest(array['exploit', 'vulnerab', 'advisor', 'cve-', 'ics-cert', 'pentest']::text[]) p where strpos(v_low, p) > 0) then
      v_out := v_out || jsonb_build_array(jsonb_build_object('code', 'link_path', 'detail', u));
    elsif p_theme = 'cyber' and not (v_host = any(array['www.iaea.org', 'iaea.org', 'niccs.cisa.gov', 'joint-research-centre.ec.europa.eu']::text[])) then
      v_out := v_out || jsonb_build_array(jsonb_build_object('code', 'link_host', 'detail', u));
    end if;
  end loop;
  return v_out;
end $$;

-- The texts and links of one pack course (courseTexts / courseUrls), checked with its theme.
create or replace function kafaa_fsc_course_problems(p_course text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c kafaa_courses; it kafaa_course_pack_items; v_texts text[]; v_urls text[];
begin
  select * into c from kafaa_courses where id = p_course;
  select * into it from kafaa_course_pack_items where course_id = p_course;
  if c.id is null or it.id is null then return null; end if;
  v_texts := array[c.title_en, c.title_ar, coalesce(c.summary_en, ''), coalesce(c.summary_ar, '')]
    || coalesce((select array_agg(v order by o, k) from jsonb_array_elements(case when jsonb_typeof(c.objectives) = 'array' then c.objectives else '[]'::jsonb end) with ordinality j(x, o),
                 lateral (values (1, coalesce(x->>'en', '')), (2, coalesce(x->>'ar', ''))) t(k, v)), '{}'::text[])
    || coalesce((select array_agg(v order by m.n, k) from kafaa_course_modules m, lateral (values (1, coalesce(m.title_en, '')), (2, coalesce(m.title_ar, ''))) t(k, v) where m.course_id = p_course), '{}'::text[])
    || coalesce((select array_agg(v order by l.id collate "C", k) from kafaa_course_skill_links l, lateral (values (1, coalesce(l.objective_en, '')), (2, coalesce(l.objective_ar, ''))) t(k, v) where l.course_id = p_course and l.active), '{}'::text[]);
  v_urls := coalesce((select array_agg(coalesce(x->>'url', '') order by o) from jsonb_array_elements(case when jsonb_typeof(c.sources) = 'array' then c.sources else '[]'::jsonb end) with ordinality j(x, o)), '{}'::text[]);
  return kafaa_fsc_copy_problems(it.theme, v_texts, v_urls);
end $$;

-- A pack course's id is the F01 evidence key of every skill it teaches (active link); a deactivated link removes it.
create or replace function kafaa_fsc_sync_keys(p_course text) returns integer language plpgsql security definer set search_path = public as $$
declare n integer := 0; r record;
begin
  for r in select l.skill_id, l.active from kafaa_course_skill_links l where l.course_id = p_course order by l.id collate "C" loop
    if r.active then
      update kafaa_skills set evidence_keys = evidence_keys || p_course where id = r.skill_id and not (p_course = any(evidence_keys));
    else
      update kafaa_skills set evidence_keys = array_remove(evidence_keys, p_course) where id = r.skill_id and p_course = any(evidence_keys);
    end if;
    if found then n := n + 1; end if;
  end loop;
  return n;
end $$;

-- ───────────── FS20 rules (mirror of src/modules/m04/academy.ts)
create or replace function kafaa_acad_evidence_level(p_result text, p_level integer) returns integer language sql immutable set search_path = public as $$
  select case p_result when 'merit' then least(3, greatest(1, least(3, coalesce(p_level, 0))) + 1) when 'pass' then greatest(1, least(3, coalesce(p_level, 0))) else 0 end
$$;
create or replace function kafaa_acad_member_id(p_cohort text, p_person text) returns text language sql immutable set search_path = public as $$
  select 'am-' || regexp_replace(p_cohort, '^ac-', '') || '-' || regexp_replace(p_person, '^[pw]-', '')
$$;
create or replace function kafaa_acad_capstone_id(p_member text) returns text language sql immutable set search_path = public as $$
  select 'cc-' || regexp_replace(p_member, '^am-', '')
$$;
create or replace function kafaa_acad_enrolment_id(p_member text, p_course text) returns text language sql immutable set search_path = public as $$
  select 'en-' || p_member || '-' || regexp_replace(p_course, '^c-fs-', '')
$$;
create or replace function kafaa_acad_pct(a integer, b integer) returns integer language sql immutable set search_path = public as $$
  select case when b > 0 then (a * 200 + b) / (2 * b) else null end
$$;
create or replace function kafaa_acad_is_staff(p_person text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from kafaa_people p where p.id = p_person and p.kind = 'staff' and p.status = 'active')
$$;
create or replace function kafaa_acad_owner() returns boolean language sql stable security definer set search_path = public as $$
  select kafaa_has_grant('training', array['W']) and kafaa_has_grant('training', array['A'])
$$;

-- academyStats(): every cohort and academy figure suppressed under p_min people.
create or replace function kafaa_acad_stats_core(p_min integer default 10) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare a record; c record; v_cs jsonb; v_out jsonb := '[]'::jsonb; n integer; nom integer; alumni integer; mods text[]; dm integer; rv integer; passed integer; merit integer; persons integer; alum integer; ncs integer;
begin
  for a in select * from kafaa_academies order by sort, id collate "C" loop
    v_cs := '[]'::jsonb; ncs := 0;
    mods := coalesce(a.module_course_ids, '{}'::text[]);
    for c in select * from kafaa_academy_cohorts where academy_id = a.id order by starts_on, id collate "C" loop
      ncs := ncs + 1;
      select count(*) filter (where status in ('accepted', 'active', 'completed')), count(*) filter (where status = 'nominated'), count(*) filter (where status = 'completed')
        into n, nom, alumni from kafaa_academy_members where cohort_id = c.id;
      if n < p_min then
        v_cs := v_cs || jsonb_build_array(jsonb_build_object('cohort_id', c.id, 'academy_id', a.id, 'status', c.status, 'suppressed', true, 'participants', null,
          'nominations', case when nom >= p_min then nom end, 'alumni', null, 'completion_pct', null, 'module_pct', null, 'reviewed', null, 'pass_pct', null, 'merit_pct', null));
        continue;
      end if;
      select count(*) into dm from kafaa_academy_members m cross join unnest(mods) cid
       where m.cohort_id = c.id and m.status in ('accepted', 'active', 'completed')
         and exists (select 1 from kafaa_enrolments e where e.person_id = m.person_id and e.course_id = cid and e.status = 'completed');
      select count(*) filter (where k.status in ('signed_off', 'returned')), count(*) filter (where k.status = 'signed_off'), count(*) filter (where k.status = 'signed_off' and k.result = 'merit')
        into rv, passed, merit
        from kafaa_cohort_capstones k join kafaa_academy_members m on m.id = k.member_id
       where m.cohort_id = c.id and m.status in ('accepted', 'active', 'completed');
      v_cs := v_cs || jsonb_build_array(jsonb_build_object('cohort_id', c.id, 'academy_id', a.id, 'status', c.status, 'suppressed', false, 'participants', n,
        'nominations', case when nom >= p_min then nom end, 'alumni', case when alumni >= p_min then alumni end, 'completion_pct', kafaa_acad_pct(alumni, n),
        'module_pct', case when cardinality(mods) > 0 then kafaa_acad_pct(dm, n * cardinality(mods)) end,
        'reviewed', case when rv >= p_min then rv end, 'pass_pct', case when rv >= p_min then kafaa_acad_pct(passed, rv) end, 'merit_pct', case when rv >= p_min then kafaa_acad_pct(merit, rv) end));
    end loop;
    select count(distinct person_id) filter (where status in ('accepted', 'active', 'completed')), count(distinct person_id) filter (where status = 'completed')
      into persons, alum from kafaa_academy_members where academy_id = a.id;
    v_out := v_out || jsonb_build_array(jsonb_build_object('academy_id', a.id, 'suppressed', persons < p_min, 'participants', case when persons >= p_min then persons end,
      'alumni', case when alum >= p_min then alum end, 'cohorts', ncs, 'cohort_stats', v_cs));
  end loop;
  return jsonb_build_object('min_group', p_min, 'academies', v_out);
end $$;

-- in-RPC notification (the LocalBackend inserts the same row)
create or replace function kafaa_acad_notify(p_person text, p_en text, p_ar text, p_link text, p_sev text default 'info') returns void language plpgsql security definer set search_path = public as $$
begin
  if p_person is null or not exists (select 1 from kafaa_people where id = p_person) then return; end if;
  insert into kafaa_notifications (id, person_id, kind, title_en, title_ar, link, severity)
  values ('nt-' || substr(md5(random()::text || clock_timestamp()::text || p_person), 1, 16), p_person, 'academy', p_en, p_ar, p_link, p_sev) on conflict (id) do nothing;
end $$;

-- ───────────── RPC: set a pack course's skill links (training W)
create or replace function kafaa_save_course_skills(p_course_id text, p_links jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; it kafaa_course_pack_items; c kafaa_courses; l jsonb; s kafaa_skills; v_seen text[] := '{}'::text[]; v_texts text[] := '{}'::text[];
  v_cp jsonb; v_now timestamptz := now(); v_id text; v_n integer := 0; v_prev text := current_setting('kafaa.seeding', true); a kafaa_audit_events; v_ok boolean;
begin
  if me is null then return kafaa_refuse('course.pack.links', 'course_skill_links', nullif(p_course_id, ''), 'not_signed_in', 'Sign in to edit the course pack'); end if;
  if not kafaa_has_grant('training', array['W']) then return kafaa_refuse('course.pack.links', 'course_skill_links', nullif(p_course_id, ''), 'forbidden', 'Only training staff edit the course pack'); end if;
  v_role := kafaa_acting_role('training', array['W']);
  select * into it from kafaa_course_pack_items where course_id = p_course_id;
  select * into c from kafaa_courses where id = p_course_id;
  if it.id is null or c.id is null then return kafaa_refuse('course.pack.links', 'course_skill_links', nullif(p_course_id, ''), 'not_found', 'Course not in the future-skills pack', v_role); end if;
  if jsonb_typeof(p_links) is distinct from 'array' or jsonb_array_length(p_links) < 1 or jsonb_array_length(p_links) > 8 then
    return kafaa_refuse('course.pack.links', 'course_skill_links', p_course_id, 'invalid', 'A pack course links 1 to 8 skills', v_role); end if;
  for l in select x from jsonb_array_elements(p_links) x loop
    s := null;
    if jsonb_typeof(l) = 'object' then select * into s from kafaa_skills where id = l->>'skill_id'; end if;
    if s.id is null or s.lifecycle = 'obsolete' then
      return kafaa_refuse('course.pack.links', 'course_skill_links', p_course_id, 'invalid', 'Unknown or obsolete skill: ' || coalesce(l->>'skill_id', ''), v_role); end if;
    if s.area = 'security' then return kafaa_refuse('course.pack.links', 'course_skill_links', p_course_id, 'security_skill', 'Security skills are never linked to pack courses', v_role); end if;
    if jsonb_typeof(l->'level') is distinct from 'number' or (l->>'level')::numeric not in (1, 2, 3) then
      return kafaa_refuse('course.pack.links', 'course_skill_links', p_course_id, 'invalid', 'Levels are 1, 2 or 3', v_role); end if;
    if length(btrim(coalesce(l->>'objective_en', ''), E' \t\n\r')) not between 5 and 200 or length(btrim(coalesce(l->>'objective_ar', ''), E' \t\n\r')) not between 5 and 200 then
      return kafaa_refuse('course.pack.links', 'course_skill_links', p_course_id, 'invalid', 'Each objective needs English and Arabic text (5-200 characters)', v_role); end if;
    if s.id = any(v_seen) then return kafaa_refuse('course.pack.links', 'course_skill_links', p_course_id, 'invalid', 'Link each skill once', v_role); end if;
    v_seen := v_seen || s.id;
    v_texts := v_texts || coalesce(l->>'objective_en', '') || coalesce(l->>'objective_ar', '');
  end loop;
  v_cp := kafaa_fsc_copy_problems(it.theme, v_texts, '{}'::text[]);
  if jsonb_array_length(v_cp) > 0 then
    return kafaa_refuse('course.pack.links', 'course_skill_links', p_course_id, 'restricted', 'Course text never carries security-restricted wording: ' || (v_cp->0->>'detail'), v_role); end if;
  perform set_config('kafaa.seeding', 'on', true);
  for l in select x from jsonb_array_elements(p_links) x loop
    v_n := v_n + 1;
    v_id := 'csl-' || regexp_replace(p_course_id, '^c-fs-', '') || '-' || regexp_replace(l->>'skill_id', '^sk-', '');
    insert into kafaa_course_skill_links (id, course_id, skill_id, level, objective_n, objective_en, objective_ar, active, updated_by, updated_at)
    values (v_id, p_course_id, l->>'skill_id', (l->>'level')::numeric::integer, v_n, btrim(l->>'objective_en', E' \t\n\r'), btrim(l->>'objective_ar', E' \t\n\r'), true, me, v_now)
    on conflict (id) do update set course_id = excluded.course_id, skill_id = excluded.skill_id, level = excluded.level, objective_n = excluded.objective_n,
      objective_en = excluded.objective_en, objective_ar = excluded.objective_ar, active = true, updated_by = me, updated_at = v_now;
  end loop;
  update kafaa_course_skill_links set active = false, updated_by = me, updated_at = v_now where course_id = p_course_id and active and not (skill_id = any(v_seen));
  update kafaa_courses set objectives = coalesce((select jsonb_agg(jsonb_build_object('skill_id', l.skill_id, 'level', l.level, 'en', l.objective_en, 'ar', l.objective_ar) order by l.objective_n, l.id collate "C")
    from kafaa_course_skill_links l where l.course_id = p_course_id and l.active), '[]'::jsonb) where id = p_course_id;
  perform kafaa_fsc_sync_keys(p_course_id);
  v_cp := kafaa_fsc_course_problems(p_course_id);
  v_ok := jsonb_array_length(v_cp) = 0;
  update kafaa_course_pack_items set copy_check = case when v_ok then 'passed' else 'failed' end, copy_problems = v_cp, copy_checked_at = v_now where id = it.id;
  perform set_config('kafaa.seeding', coalesce(v_prev, ''), true);
  a := kafaa_audit('course.pack.links', 'course_skill_links', p_course_id, 'ok', format('%s links; copy check %s', jsonb_array_length(p_links), case when v_ok then 'passed' else 'failed' end), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when v_ok then 'Links saved; copy and link check passed' else 'Links saved; the copy and link check found problems' end, a, null,
    jsonb_build_object('course_id', p_course_id, 'links', jsonb_array_length(p_links), 'copy_check', case when v_ok then 'passed' else 'failed' end, 'problems', v_cp));
end $$;

-- ───────────── RPC: run the copy and link check on every pack course (training W)
create or replace function kafaa_check_course_pack() returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; it record; v_cp jsonb; v_failed jsonb := '[]'::jsonb; v_checked integer := 0; v_prev text := current_setting('kafaa.seeding', true); a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('course.pack.check', 'course_pack_items', null, 'not_signed_in', 'Sign in to edit the course pack'); end if;
  if not kafaa_has_grant('training', array['W']) then return kafaa_refuse('course.pack.check', 'course_pack_items', null, 'forbidden', 'Only training staff edit the course pack'); end if;
  v_role := kafaa_acting_role('training', array['W']);
  perform set_config('kafaa.seeding', 'on', true);
  for it in select i.* from kafaa_course_pack_items i join kafaa_courses c on c.id = i.course_id order by i.sort, i.course_id collate "C" loop
    v_checked := v_checked + 1;
    v_cp := kafaa_fsc_course_problems(it.course_id);
    update kafaa_course_pack_items set copy_check = case when jsonb_array_length(v_cp) = 0 then 'passed' else 'failed' end, copy_problems = v_cp, copy_checked_at = now() where id = it.id;
    if jsonb_array_length(v_cp) > 0 then v_failed := v_failed || jsonb_build_array(jsonb_build_object('course_id', it.course_id, 'problems', v_cp)); end if;
  end loop;
  perform set_config('kafaa.seeding', coalesce(v_prev, ''), true);
  a := kafaa_audit('course.pack.check', 'course_pack_items', null, 'ok', format('%s/%s passed', v_checked - jsonb_array_length(v_failed), v_checked), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Copy and link check complete', a, null, jsonb_build_object('checked', v_checked, 'passed', v_checked - jsonb_array_length(v_failed), 'failed', v_failed));
end $$;

-- ───────────── RPC: nominate for an academy cohort (myself, my team, or anyone as programme owner)
create or replace function kafaa_nominate_academy(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; v_cid text := coalesce(p->>'cohort_id', ''); c kafaa_academy_cohorts; ac kafaa_academies; v_target text; v_line text; v_note text; v_source text; v_id text;
  v_prev text := current_setting('kafaa.seeding', true); a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('academy.nominate', 'academy_members', nullif(v_cid, ''), 'not_signed_in', 'Sign in to use the academies'); end if;
  if not kafaa_has_grant('training', array['Own']) or not kafaa_acad_is_staff(me) then return kafaa_refuse('academy.nominate', 'academy_members', nullif(v_cid, ''), 'forbidden', 'Academies are for ENEC staff'); end if;
  v_role := kafaa_acting_role('training', array['Own', 'W', 'A']);
  select * into c from kafaa_academy_cohorts where id = v_cid;
  if c.id is null then return kafaa_refuse('academy.nominate', 'academy_members', nullif(v_cid, ''), 'not_found', 'Cohort not found', v_role); end if;
  if c.status <> 'nominating' then return kafaa_refuse('academy.nominate', 'academy_members', v_cid, 'closed', 'Nominations for this cohort are closed', v_role); end if;
  v_target := coalesce(nullif(p->>'person_id', ''), me);
  if not kafaa_acad_is_staff(v_target) then return kafaa_refuse('academy.nominate', 'academy_members', v_cid, 'not_found', 'That person is not an active staff member', v_role); end if;
  if v_target <> me then v_line := kafaa_sc_line_manager(v_target); end if;
  if v_target <> me and v_line is distinct from me and not kafaa_acad_owner() then
    return kafaa_refuse('academy.nominate', 'academy_members', v_cid, 'forbidden', 'You can nominate yourself or people in your own team', v_role); end if;
  v_note := btrim(coalesce(p->>'note', ''), E' \t\n\r');
  if length(v_note) > 500 then return kafaa_refuse('academy.nominate', 'academy_members', v_cid, 'invalid', 'The note is limited to 500 characters', v_role); end if;
  if exists (select 1 from kafaa_academy_members where academy_id = c.academy_id and person_id = v_target and status in ('nominated', 'accepted', 'active')) then
    return kafaa_refuse('academy.nominate', 'academy_members', v_cid, 'conflict', 'There is already an open nomination or place in this academy', v_role); end if;
  if exists (select 1 from kafaa_academy_members where academy_id = c.academy_id and person_id = v_target and status = 'completed') then
    return kafaa_refuse('academy.nominate', 'academy_members', v_cid, 'conflict', 'Already an alumnus of this academy', v_role); end if;
  v_source := case when v_target = me then 'self' when v_line = me then 'manager' else 'programme' end;
  v_id := kafaa_acad_member_id(v_cid, v_target);
  perform set_config('kafaa.seeding', 'on', true);
  insert into kafaa_academy_members (id, cohort_id, academy_id, person_id, status, source, nominated_by, nominated_at, note, decided_by, decided_at, decision_note, mentor_person_id, reviewer_person_id, completed_on)
  values (v_id, v_cid, c.academy_id, v_target, 'nominated', v_source, me, now(), nullif(v_note, ''), null, null, null, null, null, null)
  on conflict (id) do update set cohort_id = excluded.cohort_id, academy_id = excluded.academy_id, person_id = excluded.person_id, status = 'nominated', source = excluded.source,
    nominated_by = me, nominated_at = now(), note = excluded.note, decided_by = null, decided_at = null, decision_note = null, mentor_person_id = null, reviewer_person_id = null, completed_on = null;
  select * into ac from kafaa_academies where id = c.academy_id;
  if v_target <> me then perform kafaa_acad_notify(v_target, 'You were nominated for ' || coalesce(ac.name_en, 'an academy'), 'رُشّحت للانضمام إلى ' || coalesce(ac.name_ar, 'أكاديمية'), '/my/academies'); end if;
  perform set_config('kafaa.seeding', coalesce(v_prev, ''), true);
  a := kafaa_audit('academy.nominate', 'academy_members', v_id, 'ok', v_cid || ' ' || v_source, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Nomination sent to the programme owner', a, null, jsonb_build_object('id', v_id, 'status', 'nominated'));
end $$;

-- ───────────── RPC: the programme owner accepts (mentor + reviewer, module enrolments, draft capstone) or declines a nomination
create or replace function kafaa_decide_academy_nomination(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; v_mid text := coalesce(p->>'member_id', ''); m kafaa_academy_members; c kafaa_academy_cohorts; ac kafaa_academies; v_note text; v_mentor text; v_reviewer text;
  v_status text; v_enrolled integer := 0; v_course text; v_cap text; v_now timestamptz := now(); v_prev text := current_setting('kafaa.seeding', true); a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('academy.decide', 'academy_members', nullif(v_mid, ''), 'not_signed_in', 'Sign in to use the academies'); end if;
  if not kafaa_acad_owner() then return kafaa_refuse('academy.decide', 'academy_members', nullif(v_mid, ''), 'forbidden', 'Only the programme owner (training manager) decides nominations'); end if;
  v_role := kafaa_acting_role('training', array['A']);
  select * into m from kafaa_academy_members where id = v_mid;
  if m.id is null then return kafaa_refuse('academy.decide', 'academy_members', nullif(v_mid, ''), 'not_found', 'Nomination not found', v_role); end if;
  if m.status <> 'nominated' then return kafaa_refuse('academy.decide', 'academy_members', v_mid, 'conflict', 'This nomination has already been decided', v_role); end if;
  if coalesce(p->>'decision', '') not in ('accept', 'decline') then return kafaa_refuse('academy.decide', 'academy_members', v_mid, 'invalid', 'Choose accept or decline', v_role); end if;
  v_note := btrim(coalesce(p->>'note', ''), E' \t\n\r');
  if length(v_note) > 500 then return kafaa_refuse('academy.decide', 'academy_members', v_mid, 'invalid', 'The note is limited to 500 characters', v_role); end if;
  select * into c from kafaa_academy_cohorts where id = m.cohort_id;
  select * into ac from kafaa_academies where id = m.academy_id;
  if p->>'decision' = 'decline' then
    perform set_config('kafaa.seeding', 'on', true);
    update kafaa_academy_members set status = 'declined', decided_by = me, decided_at = v_now, decision_note = nullif(v_note, '') where id = v_mid;
    perform kafaa_acad_notify(m.person_id, 'Academy nomination not taken forward: ' || ac.name_en, 'لم يُعتمد الترشيح للأكاديمية: ' || ac.name_ar, '/my/academies');
    perform set_config('kafaa.seeding', coalesce(v_prev, ''), true);
    a := kafaa_audit('academy.decide', 'academy_members', v_mid, 'ok', 'declined', 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Nomination declined', a, null, jsonb_build_object('id', v_mid, 'status', 'declined', 'enrolled', 0));
  end if;
  v_mentor := coalesce(p->>'mentor_person_id', '');
  v_reviewer := coalesce(p->>'reviewer_person_id', '');
  if not kafaa_acad_is_staff(v_mentor) or v_mentor = m.person_id then
    return kafaa_refuse('academy.decide', 'academy_members', v_mid, 'invalid', 'Choose a mentor: an active staff member other than the nominee', v_role); end if;
  if not kafaa_acad_is_staff(v_reviewer) or v_reviewer = m.person_id or v_reviewer = v_mentor then
    return kafaa_refuse('academy.decide', 'academy_members', v_mid, 'invalid', 'Choose a reviewer: an active staff member other than the nominee and the mentor', v_role); end if;
  if (select count(*) from kafaa_academy_members where cohort_id = m.cohort_id and status in ('accepted', 'active', 'completed')) >= c.capacity then
    return kafaa_refuse('academy.decide', 'academy_members', v_mid, 'conflict', 'The cohort is full', v_role); end if;
  v_status := case when c.status = 'running' then 'active' else 'accepted' end;
  perform set_config('kafaa.seeding', 'on', true);
  foreach v_course in array coalesce(ac.module_course_ids, '{}'::text[]) loop
    if exists (select 1 from kafaa_enrolments e where e.person_id = m.person_id and e.course_id = v_course and e.status not in ('cancelled', 'failed')) then continue; end if;
    insert into kafaa_enrolments (id, person_id, course_id, session_id, org_id, status, source, assigned_by, due_on, enrolled_at, progress_pct, completed_at, score, certificate_no, evaluation_id,
      attendance, waitlisted_at, decided_by, decision_note)
    values (kafaa_acad_enrolment_id(v_mid, v_course), m.person_id, v_course, null, null, 'enrolled', 'coordinator', me, c.ends_on, v_now, 0, null, null, null, null, null, null, me, 'Academy place: ' || ac.name_en);
    v_enrolled := v_enrolled + 1;
  end loop;
  v_cap := kafaa_acad_capstone_id(v_mid);
  insert into kafaa_cohort_capstones (id, member_id, cohort_id, academy_id, person_id, mentor_person_id, reviewer_person_id, artefact_kind, title, summary, lang, status, result, feedback,
    submitted_at, reviewed_at, evidence_ids, updated_at)
  values (v_cap, v_mid, m.cohort_id, m.academy_id, m.person_id, v_mentor, v_reviewer, ac.artefact_kind, '', '', 'en', 'draft', null, null, null, null, '{}'::text[], v_now)
  on conflict (id) do update set mentor_person_id = v_mentor, reviewer_person_id = v_reviewer, updated_at = v_now;
  update kafaa_academy_members set status = v_status, decided_by = me, decided_at = v_now, decision_note = nullif(v_note, ''), mentor_person_id = v_mentor, reviewer_person_id = v_reviewer where id = v_mid;
  perform kafaa_acad_notify(m.person_id, 'Place offered: ' || ac.name_en, 'عُرض عليك مقعد: ' || ac.name_ar, '/my/academies', 'ok');
  perform kafaa_acad_notify(v_mentor, 'You are mentoring in ' || ac.name_en, 'أنت مرشد في ' || ac.name_ar, '/my/academies');
  perform kafaa_acad_notify(v_reviewer, 'You review capstones in ' || ac.name_en, 'أنت مراجع المشاريع الختامية في ' || ac.name_ar, '/my/academies');
  perform set_config('kafaa.seeding', coalesce(v_prev, ''), true);
  l := kafaa_ledger('kafaa.academy.accept', ac.code || ': place offered');
  a := kafaa_audit('academy.decide', 'academy_members', v_mid, 'ok', format('accepted; %s module enrolments', v_enrolled), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Place offered; mentor and reviewer named', a, l, jsonb_build_object('id', v_mid, 'status', v_status, 'enrolled', v_enrolled));
end $$;

-- ───────────── RPC: the member saves or submits the capstone
create or replace function kafaa_save_capstone(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; v_mid text := coalesce(p->>'member_id', ''); v_cid text := kafaa_acad_capstone_id(coalesce(p->>'member_id', '')); m kafaa_academy_members; c kafaa_academy_cohorts;
  k kafaa_cohort_capstones; v_title text; v_summary text; v_submit boolean := coalesce(p->'submit' = 'true'::jsonb, false); v_kind text; v_status text; v_now timestamptz := now();
  v_prev text := current_setting('kafaa.seeding', true); a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('academy.capstone.save', 'cohort_capstones', case when v_mid = '' then null else v_cid end, 'not_signed_in', 'Sign in to use the academies'); end if;
  v_role := kafaa_acting_role('training', array['Own']);
  select * into m from kafaa_academy_members where id = v_mid;
  if m.id is null or m.person_id <> me then return kafaa_refuse('academy.capstone.save', 'cohort_capstones', case when v_mid = '' then null else v_cid end, 'not_found', 'Capstone not found', v_role); end if;
  select * into c from kafaa_academy_cohorts where id = m.cohort_id;
  if not (m.status = 'active' or (m.status = 'accepted' and c.status in ('running', 'completed'))) then
    return kafaa_refuse('academy.capstone.save', 'cohort_capstones', v_cid, 'conflict', 'Your place in the cohort is not active', v_role); end if;
  select * into k from kafaa_cohort_capstones where id = v_cid;
  if k.id is null then return kafaa_refuse('academy.capstone.save', 'cohort_capstones', v_cid, 'not_found', 'Capstone not found', v_role); end if;
  if k.status not in ('draft', 'returned') then return kafaa_refuse('academy.capstone.save', 'cohort_capstones', v_cid, 'conflict', 'This capstone is with the reviewer or already signed off', v_role); end if;
  v_title := btrim(coalesce(p->>'title', ''), E' \t\n\r');
  v_summary := btrim(coalesce(p->>'summary', ''), E' \t\n\r');
  if length(v_title) > 140 or length(v_summary) > 2000 or (v_submit and (length(v_title) < 3 or length(v_summary) < 20)) then
    return kafaa_refuse('academy.capstone.save', 'cohort_capstones', v_cid, 'invalid', 'Give the capstone a title (3-140 characters) and a summary (20-2000 characters)', v_role); end if;
  v_kind := coalesce(nullif(p->>'artefact_kind', ''), k.artefact_kind);
  if v_kind not in ('automation', 'analysis', 'twin_validation', 'study', 'role_delta') then
    return kafaa_refuse('academy.capstone.save', 'cohort_capstones', v_cid, 'invalid', 'Choose the kind of artefact', v_role); end if;
  if jsonb_array_length(kafaa_fsc_copy_problems('', array[v_title, v_summary], '{}'::text[])) > 0 then
    return kafaa_refuse('academy.capstone.save', 'cohort_capstones', v_cid, 'restricted', 'Capstones never describe plant security details', v_role); end if;
  v_status := case when v_submit then 'submitted' else k.status end;
  perform set_config('kafaa.seeding', 'on', true);
  update kafaa_cohort_capstones set title = v_title, summary = v_summary, lang = case when p->>'lang' = 'ar' then 'ar' else 'en' end, artefact_kind = v_kind, status = v_status,
    submitted_at = case when v_submit then v_now else submitted_at end, updated_at = v_now where id = v_cid;
  if v_submit then perform kafaa_acad_notify(k.reviewer_person_id, 'Capstone submitted for your review', 'مشروع ختامي مقدّم لمراجعتك', '/my/academies'); end if;
  perform set_config('kafaa.seeding', coalesce(v_prev, ''), true);
  a := kafaa_audit('academy.capstone.save', 'cohort_capstones', v_cid, 'ok', case when v_submit then 'submitted' else 'draft saved' end, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when v_submit then 'Capstone submitted to your reviewer' else 'Draft saved' end, a, null, jsonb_build_object('id', v_cid, 'status', v_status));
end $$;

-- ───────────── RPC: the named reviewer signs a capstone off (F01 ojt evidence + recompute + alumni) or returns it
create or replace function kafaa_signoff_capstone(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; v_cid text := coalesce(p->>'capstone_id', ''); k kafaa_cohort_capstones; ac kafaa_academies; v_result text := coalesce(p->>'result', '');
  v_feedback text := btrim(coalesce(p->>'feedback', ''), E' \t\n\r'); v_now timestamptz := now(); v_today date := current_date; s jsonb; v_lvl integer; v_ev text; v_ids text[] := '{}'::text[];
  v_evd jsonb := '[]'::jsonb; v_mstatus text; v_prev text := current_setting('kafaa.seeding', true); a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('academy.capstone.signoff', 'cohort_capstones', nullif(v_cid, ''), 'not_signed_in', 'Sign in to use the academies'); end if;
  v_role := kafaa_acting_role('training', array['Own', 'W', 'A']);
  select * into k from kafaa_cohort_capstones where id = v_cid;
  if k.id is null then return kafaa_refuse('academy.capstone.signoff', 'cohort_capstones', nullif(v_cid, ''), 'not_found', 'Capstone not found', v_role); end if;
  if k.person_id = me then return kafaa_refuse('academy.capstone.signoff', 'cohort_capstones', v_cid, 'self', 'You cannot sign off your own capstone', v_role); end if;
  if k.reviewer_person_id is distinct from me then return kafaa_refuse('academy.capstone.signoff', 'cohort_capstones', v_cid, 'forbidden', 'Only the named reviewer signs off this capstone', v_role); end if;
  if k.status <> 'submitted' then return kafaa_refuse('academy.capstone.signoff', 'cohort_capstones', v_cid, 'conflict', 'The capstone has not been submitted', v_role); end if;
  if v_result not in ('merit', 'pass', 'not_yet') then return kafaa_refuse('academy.capstone.signoff', 'cohort_capstones', v_cid, 'invalid', 'Choose merit, pass or not yet', v_role); end if;
  if length(v_feedback) > 2000 or (v_result = 'not_yet' and length(v_feedback) < 5) then
    return kafaa_refuse('academy.capstone.signoff', 'cohort_capstones', v_cid, 'invalid', 'Explain what to rework (feedback up to 2000 characters)', v_role); end if;
  select * into ac from kafaa_academies where id = k.academy_id;
  perform set_config('kafaa.seeding', 'on', true);
  if v_result = 'not_yet' then
    update kafaa_cohort_capstones set status = 'returned', result = 'not_yet', feedback = v_feedback, reviewed_at = v_now, updated_at = v_now where id = v_cid;
    perform kafaa_acad_notify(k.person_id, 'Capstone returned for rework: ' || ac.name_en, 'أُعيد المشروع الختامي للتعديل: ' || ac.name_ar, '/my/academies', 'warn');
    select status into v_mstatus from kafaa_academy_members where id = k.member_id;
    perform set_config('kafaa.seeding', coalesce(v_prev, ''), true);
    a := kafaa_audit('academy.capstone.signoff', 'cohort_capstones', v_cid, 'ok', 'not_yet', 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Returned with feedback', a, null, jsonb_build_object('capstone_id', v_cid, 'status', 'returned', 'result', 'not_yet', 'member_status', coalesce(v_mstatus, 'active'), 'evidence', '[]'::jsonb));
  end if;
  for s in select x from jsonb_array_elements(case when jsonb_typeof(ac.capstone_skills) = 'array' then ac.capstone_skills else '[]'::jsonb end) x order by x->>'skill_id' collate "C" loop
    v_lvl := kafaa_acad_evidence_level(v_result, coalesce((s->>'level')::numeric, 0)::integer);
    if v_lvl <= 0 then continue; end if;
    v_ev := 'se:ojt:' || v_cid || ':' || (s->>'skill_id');
    insert into kafaa_skill_evidence (id, person_id, skill_id, kind, ref_table, ref_id, level, basis, status, observed_on, note, recorded_by, active)
    values (v_ev, k.person_id, s->>'skill_id', 'ojt', 'cohort_capstones', v_cid, v_lvl, 'evidenced', 'current', v_today, 'Academy capstone signed off: ' || ac.name_en, me, true)
    on conflict (id) do update set level = excluded.level, observed_on = excluded.observed_on, active = true, note = excluded.note, recorded_by = me;
    v_ids := v_ids || v_ev;
    v_evd := v_evd || jsonb_build_array(jsonb_build_object('skill_id', s->>'skill_id', 'level', v_lvl));
  end loop;
  update kafaa_cohort_capstones set status = 'signed_off', result = v_result, feedback = nullif(v_feedback, ''), reviewed_at = v_now, evidence_ids = v_ids, updated_at = v_now where id = v_cid;
  update kafaa_academy_members set status = 'completed', completed_on = v_today where id = k.member_id;
  perform kafaa_skills_apply(k.person_id, v_today);
  perform kafaa_acad_notify(k.person_id, 'Capstone signed off: ' || ac.name_en, 'اعتُمد المشروع الختامي: ' || ac.name_ar, '/my/academies', 'ok');
  perform set_config('kafaa.seeding', coalesce(v_prev, ''), true);
  l := kafaa_ledger('kafaa.academy.capstone_signoff', ac.code || ' capstone ' || v_result);
  a := kafaa_audit('academy.capstone.signoff', 'cohort_capstones', v_cid, 'ok', format('%s; %s evidence rows', v_result, cardinality(v_ids)), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Capstone signed off; skills updated', a, l, jsonb_build_object('capstone_id', v_cid, 'status', 'signed_off', 'result', v_result, 'member_status', 'completed', 'evidence', v_evd));
end $$;

-- ───────────── Reads
create or replace function kafaa_academy_stats() returns jsonb language sql stable security definer set search_path = public as $$
  select kafaa_acad_stats_core(10)
$$;
create or replace function kafaa_academy_nominees() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); v_all boolean;
begin
  if me is null or not kafaa_has_grant('training', array['Own']) or not kafaa_acad_is_staff(me) then return '[]'::jsonb; end if;
  v_all := kafaa_acad_owner();
  return jsonb_build_array(jsonb_build_object('person_id', me, 'self', true))
    || coalesce((select jsonb_agg(jsonb_build_object('person_id', p.id, 'self', false) order by p.id collate "C") from kafaa_people p
                  where p.kind = 'staff' and p.status = 'active' and p.id <> me and (v_all or kafaa_sc_line_manager(p.id) = me)), '[]'::jsonb);
end $$;

-- ───────────── Grants: RPCs to authenticated (stats also to anon: aggregates only); helpers to nobody
revoke execute on function kafaa_fsc_restricted_terms(), kafaa_fsc_copy_problems(text, text[], text[]), kafaa_fsc_course_problems(text), kafaa_fsc_sync_keys(text),
  kafaa_acad_evidence_level(text, integer), kafaa_acad_member_id(text, text), kafaa_acad_capstone_id(text), kafaa_acad_enrolment_id(text, text), kafaa_acad_pct(integer, integer),
  kafaa_acad_is_staff(text), kafaa_acad_owner(), kafaa_acad_stats_core(integer), kafaa_acad_notify(text, text, text, text, text) from public, anon, authenticated;
revoke execute on function kafaa_save_course_skills(text, jsonb), kafaa_check_course_pack(), kafaa_nominate_academy(jsonb), kafaa_decide_academy_nomination(jsonb), kafaa_save_capstone(jsonb),
  kafaa_signoff_capstone(jsonb), kafaa_academy_stats(), kafaa_academy_nominees() from public, anon;
grant execute on function kafaa_save_course_skills(text, jsonb), kafaa_check_course_pack(), kafaa_nominate_academy(jsonb), kafaa_decide_academy_nomination(jsonb), kafaa_save_capstone(jsonb),
  kafaa_signoff_capstone(jsonb), kafaa_academy_stats(), kafaa_academy_nominees() to authenticated;
grant execute on function kafaa_academy_stats() to anon;

-- ───────────── Data: pack courses already loaded are the evidence keys of the skills they teach (idempotent; no-op before the seed)
do $$ declare r record; v_prev text := current_setting('kafaa.seeding', true); begin
  perform set_config('kafaa.seeding', 'on', true);
  for r in select distinct course_id from kafaa_course_skill_links order by course_id loop perform kafaa_fsc_sync_keys(r.course_id); end loop;
  perform set_config('kafaa.seeding', coalesce(v_prev, ''), true);
end $$;
