-- live apply part kafaa_fs54_future_leadership_p1 (from supabase/migrations/20261010254001_kafaa_fs54_future_leadership.sql, part 1 of 2)
-- FS wave E · E4 (branch fsEe4, module M22) · FS46 Future leadership behaviours in the 360 · FS47 Future Leaders track (nuclear management
-- competence) · FS48 Women in future nuclear skills.
-- FS46: kafaa_leadership_behaviours (12 behaviours, anchors at every rating point EN/AR, coach cards); a form version on the 360 tables
--   (form_version, default 1, added if missing: every F16 row stays form 1 and reads exactly as before); redefined, same signatures and
--   grants: kafaa_lead_360_summary (the cycle keeps its version), kafaa_lead_stats_compute (form 1 only), kafaa_request_360 (a new cycle
--   uses form 2), kafaa_submit_360 (the sheet must match the request's version). New read kafaa_leadership_programme_stats (form 2 by
--   academy programme, cells under 10 subjects suppressed).
-- FS47: kafaa_fl_competencies (INMA pattern), kafaa_fl_external (sources and dates from the research packs), kafaa_fl_cohorts and
--   kafaa_fl_participants. Nominations reuse kafaa_leadership_nominations (programme prog-future-leaders) and the F16 selection
--   kafaa_decide_nomination (maker-checker, ledger). RPCs kafaa_nominate_future_leader (HR), kafaa_fl_readiness, kafaa_record_fl_module
--   (training manager), kafaa_save_policy_project (participant), kafaa_review_policy_project (training manager or HR authority, never
--   their own; completing the track writes a ledger row), kafaa_future_leaders_stats (suppressed under 10).
-- FS48: kafaa_wfn_programmes, kafaa_wfn_circles, kafaa_wfn_offers (staff or public reference rows), kafaa_wfn_participants,
--   kafaa_wfn_circle_members and kafaa_wfn_requests (the person only). RPCs kafaa_set_wfn_optin (withdrawal blanks the choices, ends
--   memberships and withdraws open requests: no trace in any ranking), kafaa_join_wfn_circle, kafaa_request_wfn_offer,
--   kafaa_decide_wfn_request (programme owner = training manager; a placement writes a ledger row), kafaa_wfn_desk (programme owner
--   only), kafaa_wfn_stats (HR, training manager, auditors: aggregates only; gender appears only as a share per programme, suppressed
--   whole when either group is under 10).
-- Data: the F13 mentoring engine card (F24) moves to version 2 with the FS48 ranking functions (guarded update, only while version 1).
-- Rules: mirror of src/modules/m22/domain.ts (FS46 parts) and src/modules/m22/future.ts; same codes in the same order, same messages
-- (LocalBackend: src/modules/m22/backend/local.ts and local.fs54.ts). PGlite checks: scripts/validate/fs54-future-leadership.mjs.
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file, RLS in the per-statement form.
-- Seed rows: supabase/seed.sql (live: insert ... on conflict (id) do nothing).

-- ───────────── FS46 columns on the F16 360 tables
alter table kafaa_leadership_360_requests add column if not exists form_version integer not null default 1;
alter table kafaa_leadership_360 add column if not exists form_version integer not null default 1;

-- ───────────── Tables (generated DDL)
-- M22 · Leadership behaviours rated in the 360, with anchors at every rating point and coach cards; form 2 adds four future behaviours (FS46)
create table if not exists kafaa_leadership_behaviours (
  id text primary key,
  form_from integer not null default 1,
  sort integer not null default 0,
  trait_id text,
  title_en text not null,
  title_ar text not null,
  short_en text not null,
  short_ar text not null,
  statement_en text not null,
  statement_ar text not null,
  framework_en text not null,
  framework_ar text not null,
  anchors jsonb not null default '{}'::jsonb,
  coach jsonb not null default '{}'::jsonb,
  links jsonb not null default '[]'::jsonb,
  programme_ids text[] not null default '{}'::text[],
  benchmark_ids text[] not null default '{}'::text[],
  sources jsonb not null default '[]'::jsonb
);
comment on table kafaa_leadership_behaviours is '[M22] Leadership behaviours rated in the 360, with anchors at every rating point and coach cards; form 2 adds four future behaviours (FS46)';

-- M22 · Future Leaders nuclear-management competencies (INMA pattern): descriptors per level, skill targets, learning route (FS47)
create table if not exists kafaa_fl_competencies (
  id text primary key,
  code text not null unique,
  sort integer not null default 0,
  title_en text not null,
  title_ar text not null,
  summary_en text not null,
  summary_ar text not null,
  area_en text not null,
  area_ar text not null,
  descriptors jsonb not null default '{}'::jsonb,
  skill_targets jsonb not null default '{}'::jsonb,
  route jsonb not null default '[]'::jsonb,
  external_ids text[] not null default '{}'::text[],
  sources jsonb not null default '[]'::jsonb
);
comment on table kafaa_fl_competencies is '[M22] Future Leaders nuclear-management competencies (INMA pattern): descriptors per level, skill targets, learning route (FS47)';

-- M22 · External management programmes linked to the Future Leaders track, with sources and dates (FS47)
create table if not exists kafaa_fl_external (
  id text primary key,
  kind text not null check (kind in ('summer_school', 'school', 'masters', 'mobility', 'trainee', 'internship')),
  sort integer not null default 0,
  owner_en text not null,
  owner_ar text not null,
  title_en text not null,
  title_ar text not null,
  summary_en text not null,
  summary_ar text not null,
  dates_en text not null,
  dates_ar text not null,
  year_from integer,
  year_to integer,
  competency_ids text[] not null default '{}'::text[],
  sources jsonb not null default '[]'::jsonb
);
comment on table kafaa_fl_external is '[M22] External management programmes linked to the Future Leaders track, with sources and dates (FS47)';

-- M22 · Future Leaders cohorts: modules, policy-project brief, mentor, seats and dates (FS47)
create table if not exists kafaa_fl_cohorts (
  id text primary key,
  code text not null unique,
  year integer not null,
  status text not null check (status in ('planned', 'open', 'running', 'completed')),
  seats integer not null default 12,
  starts_on date not null,
  ends_on date not null,
  title_en text not null,
  title_ar text not null,
  modules jsonb not null default '[]'::jsonb,
  brief_en text not null,
  brief_ar text not null,
  mentor_en text not null,
  mentor_ar text not null,
  sort integer not null default 0
);
comment on table kafaa_fl_cohorts is '[M22] Future Leaders cohorts: modules, policy-project brief, mentor, seats and dates (FS47)';

-- M22 · A selected Future Leaders participant: modules completed and the policy project with its review (FS47)
create table if not exists kafaa_fl_participants (
  id text primary key,
  nomination_id text not null unique,
  person_id text not null,
  cohort_id text not null,
  person_name text not null default '',
  person_name_ar text not null default '',
  modules_done text[] not null default '{}'::text[],
  project_title text,
  project_question text,
  project_summary text,
  project_sponsor_role text,
  project_status text not null default 'none' check (project_status in ('none', 'draft', 'submitted', 'returned', 'accepted')),
  project_submitted_on date,
  project_reviewed_by text,
  project_review_note text,
  project_decided_on date,
  status text not null default 'active' check (status in ('active', 'completed', 'withdrawn')),
  completed_on date,
  history jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
comment on table kafaa_fl_participants is '[M22] A selected Future Leaders participant: modules completed and the policy project with its review (FS47)';

-- M22 · Women in future nuclear skills: the three strands with their international patterns and sources (FS48)
create table if not exists kafaa_wfn_programmes (
  id text primary key,
  strand text not null unique check (strand in ('circles', 'visiting', 'sponsored')),
  sort integer not null default 0,
  title_en text not null,
  title_ar text not null,
  summary_en text not null,
  summary_ar text not null,
  pattern_en text not null,
  pattern_ar text not null,
  fact_en text not null,
  fact_ar text not null,
  sources jsonb not null default '[]'::jsonb
);
comment on table kafaa_wfn_programmes is '[M22] Women in future nuclear skills: the three strands with their international patterns and sources (FS48)';

-- M22 · Opt-in to the women in future nuclear skills network: areas, ways to take part, mentor; withdrawable (FS48; private)
create table if not exists kafaa_wfn_participants (
  id text primary key,
  person_id text not null unique,
  active boolean not null default true,
  interests text[] not null default '{}'::text[],
  strands text[] not null default '{}'::text[],
  mentor boolean not null default false,
  joined_on date,
  withdrawn_on date,
  updated_at timestamptz not null default now()
);
comment on table kafaa_wfn_participants is '[M22] Opt-in to the women in future nuclear skills network: areas, ways to take part, mentor; withdrawable (FS48; private)';

-- M22 · Mentor circles on a future-skills theme with a mentor role card and seats (FS48)
create table if not exists kafaa_wfn_circles (
  id text primary key,
  sort integer not null default 0,
  status text not null check (status in ('active', 'closed')),
  seats integer not null default 6,
  focus text[] not null default '{}'::text[],
  skill_ids text[] not null default '{}'::text[],
  starts_on date not null,
  title_en text not null,
  title_ar text not null,
  mentor_role_en text not null,
  mentor_role_ar text not null,
  cadence_en text not null,
  cadence_ar text not null,
  is_full boolean not null default false,
  mentor_open boolean not null default true
);
alter table kafaa_wfn_circles add column if not exists is_full boolean not null default false;
alter table kafaa_wfn_circles add column if not exists mentor_open boolean not null default true;
comment on table kafaa_wfn_circles is '[M22] Mentor circles on a future-skills theme with a mentor role card and seats (FS48)';

-- M22 · Mentor circle membership (member or mentor), ended rather than removed (FS48; private)
create table if not exists kafaa_wfn_circle_members (
  id text primary key,
  circle_id text not null,
  person_id text not null,
  role text not null default 'member' check (role in ('member', 'mentor')),
  active boolean not null default true,
  joined_on date,
  left_on date
);
comment on table kafaa_wfn_circle_members is '[M22] Mentor circle membership (member or mentor), ended rather than removed (FS48; private)';

-- M22 · Visiting-professional placements and sponsored study with a placement (concept offers) (FS48)
create table if not exists kafaa_wfn_offers (
  id text primary key,
  strand text not null check (strand in ('visiting', 'sponsored')),
  sort integer not null default 0,
  status text not null check (status in ('open', 'closed')),
  seats integer not null default 1,
  weeks integer,
  months integer,
  closes_on date not null,
  focus text[] not null default '{}'::text[],
  title_en text not null,
  title_ar text not null,
  host_en text not null,
  host_ar text not null,
  placement_en text not null,
  placement_ar text not null
);
comment on table kafaa_wfn_offers is '[M22] Visiting-professional placements and sponsored study with a placement (concept offers) (FS48)';

-- M22 · A participant's request for a placement or sponsored study, decided by the programme owner (FS48; private)
create table if not exists kafaa_wfn_requests (
  id text primary key,
  offer_id text not null,
  person_id text not null,
  person_name text not null default '',
  person_name_ar text not null default '',
  statement text not null,
  status text not null default 'interested' check (status in ('interested', 'shortlisted', 'placed', 'completed', 'declined', 'withdrawn')),
  outcome text check (outcome in ('progressed', 'same_role')),
  decided_by text,
  decided_on date,
  note text,
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table kafaa_wfn_requests is '[M22] A participant''s request for a placement or sponsored study, decided by the programme owner (FS48; private)';

-- foreign keys (generated)
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_fl_participants_nomination_id_fk') then alter table kafaa_fl_participants add constraint kafaa_fl_participants_nomination_id_fk foreign key (nomination_id) references kafaa_leadership_nominations(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_fl_participants_person_id_fk') then alter table kafaa_fl_participants add constraint kafaa_fl_participants_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_fl_participants_cohort_id_fk') then alter table kafaa_fl_participants add constraint kafaa_fl_participants_cohort_id_fk foreign key (cohort_id) references kafaa_fl_cohorts(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_wfn_participants_person_id_fk') then alter table kafaa_wfn_participants add constraint kafaa_wfn_participants_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_wfn_circle_members_circle_id_fk') then alter table kafaa_wfn_circle_members add constraint kafaa_wfn_circle_members_circle_id_fk foreign key (circle_id) references kafaa_wfn_circles(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_wfn_circle_members_person_id_fk') then alter table kafaa_wfn_circle_members add constraint kafaa_wfn_circle_members_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_wfn_requests_offer_id_fk') then alter table kafaa_wfn_requests add constraint kafaa_wfn_requests_offer_id_fk foreign key (offer_id) references kafaa_wfn_offers(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_wfn_requests_person_id_fk') then alter table kafaa_wfn_requests add constraint kafaa_wfn_requests_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
-- indexes (generated)
create index if not exists kafaa_fl_participants_person_id_idx on kafaa_fl_participants (person_id);
create index if not exists kafaa_fl_participants_cohort_id_idx on kafaa_fl_participants (cohort_id);
create index if not exists kafaa_wfn_circle_members_circle_id_idx on kafaa_wfn_circle_members (circle_id);
create index if not exists kafaa_wfn_circle_members_person_id_idx on kafaa_wfn_circle_members (person_id);
create index if not exists kafaa_wfn_requests_offer_id_idx on kafaa_wfn_requests (offer_id);
create index if not exists kafaa_wfn_requests_person_id_idx on kafaa_wfn_requests (person_id);
create index if not exists kafaa_wfn_requests_status_idx on kafaa_wfn_requests (status);

-- ───────────── RLS (per-statement form of the generated rules)
alter table kafaa_leadership_behaviours enable row level security;
alter table kafaa_fl_competencies enable row level security;
alter table kafaa_fl_external enable row level security;
alter table kafaa_fl_cohorts enable row level security;
alter table kafaa_fl_participants enable row level security;
alter table kafaa_wfn_programmes enable row level security;
alter table kafaa_wfn_participants enable row level security;
alter table kafaa_wfn_circles enable row level security;
alter table kafaa_wfn_circle_members enable row level security;
alter table kafaa_wfn_offers enable row level security;
alter table kafaa_wfn_requests enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_leadership_behaviours' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_leadership_behaviours for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_fl_competencies' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_fl_competencies for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_fl_external' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_fl_external for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_fl_cohorts' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_fl_cohorts for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_fl_participants' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_fl_participants for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_wfn_programmes' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_wfn_programmes for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_wfn_participants' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_wfn_participants for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_wfn_circles' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_wfn_circles for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_wfn_circle_members' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_wfn_circle_members for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_wfn_offers' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_wfn_offers for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_wfn_requests' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_wfn_requests for select to anon, authenticated using (false)'; end if;
end $$;
alter policy kafaa_read on kafaa_leadership_behaviours using ((((SELECT kafaa_has_grant('public_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_fl_competencies using ((((SELECT kafaa_has_grant('public_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_fl_external using ((((SELECT kafaa_has_grant('public_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_fl_cohorts using ((((SELECT kafaa_has_grant('knowledge'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_fl_participants using (((((SELECT kafaa_has_grant('skills_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('skills_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('skills_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('skills_profile'::text, person_id, NULL::text, false))) OR (((SELECT kafaa_has_grant('talent_review'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('talent_review'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('talent_review'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('talent_review'::text, person_id, NULL::text, false))) OR (((SELECT kafaa_has_grant('audit_log'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))))));
alter policy kafaa_read on kafaa_wfn_programmes using ((((SELECT kafaa_has_grant('public_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_wfn_participants using ((((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false))));
alter policy kafaa_read on kafaa_wfn_circles using ((((SELECT kafaa_has_grant('knowledge'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_wfn_circle_members using ((((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false))));
alter policy kafaa_read on kafaa_wfn_offers using ((((SELECT kafaa_has_grant('knowledge'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_wfn_requests using ((((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false))));
-- Every FS46-FS48 table is read-only for API roles: reference data, or rows written only by the SECURITY DEFINER RPCs below.
revoke insert, update on kafaa_leadership_behaviours, kafaa_fl_competencies, kafaa_fl_external, kafaa_fl_cohorts, kafaa_fl_participants, kafaa_wfn_programmes, kafaa_wfn_participants, kafaa_wfn_circles, kafaa_wfn_circle_members, kafaa_wfn_offers, kafaa_wfn_requests from anon, authenticated;
grant select on kafaa_leadership_behaviours, kafaa_fl_competencies, kafaa_fl_external, kafaa_fl_cohorts, kafaa_fl_participants, kafaa_wfn_programmes, kafaa_wfn_participants, kafaa_wfn_circles, kafaa_wfn_circle_members, kafaa_wfn_offers, kafaa_wfn_requests to anon, authenticated;

-- ═════════════ FS46 · 360 form version 2 (redefinitions keep their signatures and grants)
-- The behaviours of a form version (formBehaviours()).
create or replace function kafaa_lead_form_ids(p_version integer) returns text[] language sql immutable set search_path = public as $$
  select case when p_version = 2
    then array['b-safety-values', 'b-accountability', 'b-questioning', 'b-communication', 'b-decisions', 'b-respect', 'b-learning', 'b-concerns', 'b-digital-change', 'b-ai-teams', 'b-intrapreneurship', 'b-inclusion']
    else array['b-safety-values', 'b-accountability', 'b-questioning', 'b-communication', 'b-decisions', 'b-respect', 'b-learning', 'b-concerns'] end
$$;
-- 360 score sheet for a form version: every behaviour once, whole numbers 1 to 5 (validScores(s, version)).
create or replace function kafaa_lead_scores_v(p jsonb, p_version integer) returns jsonb language plpgsql immutable set search_path = public as $$
declare b text; v jsonb; out jsonb := '{}'::jsonb; ids text[] := kafaa_lead_form_ids(p_version);
begin
  if p is null or jsonb_typeof(p) <> 'object' then return null; end if;
  if (select count(*) from jsonb_object_keys(p)) <> cardinality(ids) then return null; end if;
  foreach b in array ids loop
    v := p->b;
    if v is null or jsonb_typeof(v) <> 'number' or (v::text)::numeric <> trunc((v::text)::numeric) or (v::text)::numeric not between 1 and 5 then return null; end if;
    out := out || jsonb_build_object(b, (v::text)::numeric::integer);
  end loop;
  return out;
end $$;

-- The subject's 360 view (summarise360()): the cycle keeps its form version; aggregates only, nothing below 5 responses.
create or replace function kafaa_lead_360_summary(p_subject text, p_cycle text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_cycles text[]; c text; v_ver integer; ids text[]; v_inv integer; v_resp integer; v_self jsonb; v_selfreq text; v_enough boolean; v_beh jsonb; v_invitees jsonb;
begin
  select coalesce(array_agg(x order by x collate "C" desc), '{}'::text[]) into v_cycles
    from (select distinct cycle as x from kafaa_leadership_360_requests where subject_id = p_subject) d;
  c := case when p_cycle is not null and p_cycle = any(v_cycles) then p_cycle else v_cycles[1] end;
  select coalesce(max(coalesce(form_version, 1)), 1) into v_ver from kafaa_leadership_360_requests where subject_id = p_subject and cycle = c;
  ids := kafaa_lead_form_ids(v_ver);
  select count(*) into v_inv from kafaa_leadership_360_requests where subject_id = p_subject and cycle = c and rater_kind <> 'self';
  select id into v_selfreq from kafaa_leadership_360_requests where subject_id = p_subject and cycle = c and rater_kind = 'self' limit 1;
  select count(*) into v_resp from kafaa_leadership_360 where subject_id = p_subject and cycle = c and rater_kind <> 'self' and coalesce(form_version, 1) = v_ver;
  select scores into v_self from kafaa_leadership_360 where subject_id = p_subject and cycle = c and rater_kind = 'self' and coalesce(form_version, 1) = v_ver limit 1;
  v_enough := v_resp >= 5;
  select coalesce(jsonb_agg(jsonb_build_object('name', coalesce(p.display_name, ''), 'name_ar', coalesce(nullif(p.display_name_ar, ''), p.display_name, ''), 'kind', q.rater_kind) order by q.rater_id collate "C"), '[]'::jsonb)
    into v_invitees
    from kafaa_leadership_360_requests q left join kafaa_people p on p.id = q.rater_id
   where q.subject_id = p_subject and q.cycle = c and q.rater_kind <> 'self';
  if v_enough then
    select jsonb_agg(x.j order by x.ord) into v_beh from (
      select b.ord, jsonb_build_object('id', b.id, 'self', case when v_self is null then null else (v_self->>b.id)::integer end,
             'others', (round(sum((r.scores->>b.id)::integer) * 100.0 / count(*)) / 100)::float8,
             'low', min((r.scores->>b.id)::integer), 'high', max((r.scores->>b.id)::integer)) as j
        from unnest(ids) with ordinality as b(id, ord)
        cross join kafaa_leadership_360 r
       where r.subject_id = p_subject and r.cycle = c and r.rater_kind <> 'self' and coalesce(r.form_version, 1) = v_ver
       group by b.id, b.ord) x;
  end if;
  return jsonb_build_object('cycle', c, 'cycles', to_jsonb(v_cycles), 'invited', v_inv, 'responded', v_resp, 'self_submitted', v_self is not null,
    'self_request_id', v_selfreq, 'enough', v_enough, 'min_raters', 5, 'invitees', v_invitees, 'form_version', v_ver, 'behaviours', case when v_enough then v_beh else null end);
end $$;

-- HR aggregates by grade (computeLeadershipStats()): the form-1 view only (form 2 is aggregated by programme below).
create or replace function kafaa_lead_stats_compute() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  ids constant text[] := array['b-safety-values', 'b-accountability', 'b-questioning', 'b-communication', 'b-decisions', 'b-respect', 'b-learning', 'b-concerns'];
  c text; v_levels jsonb; v_noms jsonb;
begin
  select max(x.cycle collate "C") into c from (select cycle, subject_id from kafaa_leadership_360 where rater_kind <> 'self' and coalesce(form_version, 1) = 1 group by cycle, subject_id having count(*) >= 5) x;
  if c is null then select max(cycle collate "C") into c from kafaa_leadership_360 where coalesce(form_version, 1) = 1; end if;
  with resp as (select r.subject_id, r.scores from kafaa_leadership_360 r where r.cycle = c and r.rater_kind <> 'self' and coalesce(r.form_version, 1) = 1),
       subj as (select subject_id from resp group by subject_id having count(*) >= 5),
       lvl as (select s.subject_id, coalesce(p.level, 'unknown') as level from subj s left join kafaa_people p on p.id = s.subject_id),
       grades as (select g.l, g.ord, (select count(*) from lvl where lvl.level = g.l) as k
                    from unnest(array['entry', 'professional', 'senior', 'leadership', 'unknown']) with ordinality as g(l, ord))
  select jsonb_agg(jsonb_build_object('level', g.l, 'subjects', case when g.k < 10 then null else g.k end, 'suppressed', g.k < 10,
           'scores', case when g.k < 10 then null else (
              select jsonb_object_agg(z.bid, z.v) from (
                select b.id as bid, (round(sum((x.scores->>b.id)::integer) * 100.0 / count(*)) / 100)::float8 as v
                  from unnest(ids) as b(id) cross join resp x join lvl y on y.subject_id = x.subject_id
                 where y.level = g.l group by b.id) z) end) order by g.ord)
    into v_levels from grades g;
  select jsonb_agg(jsonb_build_object('status', s.st, 'n', case when s.k < 10 then null else s.k end, 'suppressed', s.k < 10) order by s.ord)
    into v_noms
    from (select t.st, t.ord, (select count(*) from kafaa_leadership_nominations n where n.status = t.st) as k
            from unnest(array['nominated', 'approved', 'declined', 'completed']) with ordinality as t(st, ord)) s;
  return jsonb_build_object('cycle', c, 'by_level', v_levels, 'nominations', v_noms);
end $$;

-- Ask 5 to 12 colleagues (F16 rules unchanged); FS46: a new cycle uses form 2, a cycle already started keeps its version.
create or replace function kafaa_request_360(p_raters jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); c text := kafaa_lead_cycle(current_date); v_ent text; v_role text; v_have integer; v_fresh integer; v_total integer; s kafaa_people; v_id text; r record; v_ver integer;
begin
  v_ent := case when me is null then null else c || ':' || me end;
  if me is null then return kafaa_refuse('leadership.360.request', 'leadership_360_requests', v_ent, 'not_signed_in', 'Sign in to use the leadership academy'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  if v_role is null then return kafaa_refuse('leadership.360.request', 'leadership_360_requests', v_ent, 'forbidden', 'Leadership 360 is for staff with a skills profile'); end if;
  if p_raters is null or jsonb_typeof(p_raters) <> 'array' or jsonb_array_length(p_raters) = 0
     or exists (select 1 from jsonb_array_elements(p_raters) x where jsonb_typeof(x) <> 'object' or jsonb_typeof(x->'person_id') is distinct from 'string' or coalesce(x->>'kind', '') not in ('manager', 'peer', 'report'))
     or (select count(distinct x->>'person_id') from jsonb_array_elements(p_raters) x) <> jsonb_array_length(p_raters) then
    return kafaa_refuse('leadership.360.request', 'leadership_360_requests', v_ent, 'invalid', 'Choose each colleague once, as manager, peer or report', v_role);
  end if;
  if exists (select 1 from jsonb_array_elements(p_raters) x where x->>'person_id' = me) then
    return kafaa_refuse('leadership.360.request', 'leadership_360_requests', v_ent, 'invalid', 'Choose colleagues other than yourself (your self-rating is added for you)', v_role);
  end if;
  if exists (select 1 from jsonb_array_elements(p_raters) x left join kafaa_people p on p.id = x->>'person_id' where p.id is null or p.kind <> 'staff' or p.status <> 'active') then
    return kafaa_refuse('leadership.360.request', 'leadership_360_requests', v_ent, 'not_found', 'Colleague not found', v_role);
  end if;
  select count(*) into v_have from kafaa_leadership_360_requests where subject_id = me and cycle = c and rater_kind <> 'self';
  select count(*) into v_fresh from jsonb_array_elements(p_raters) x
   where not exists (select 1 from kafaa_leadership_360_requests q where q.subject_id = me and q.cycle = c and q.rater_kind <> 'self' and q.rater_id = x->>'person_id');
  v_total := v_have + v_fresh;
  if v_total < 5 then return kafaa_refuse('leadership.360.request', 'leadership_360_requests', v_ent, 'too_few', 'Invite at least 5 colleagues: results appear only with five or more responses', v_role); end if;
  if v_total > 12 then return kafaa_refuse('leadership.360.request', 'leadership_360_requests', v_ent, 'limit', 'Invite at most 12 colleagues in a cycle', v_role); end if;
  select coalesce(max(coalesce(form_version, 1)), 2) into v_ver from kafaa_leadership_360_requests where subject_id = me and cycle = c;
  select * into s from kafaa_people where id = me;
  insert into kafaa_leadership_360_requests (id, cycle, subject_id, rater_id, rater_kind, status, subject_name, subject_name_ar, invited_at, form_version)
  values ('l3q-' || c || '-' || me || '-' || me, c, me, me, 'self', 'invited', s.display_name, coalesce(nullif(s.display_name_ar, ''), s.display_name), now(), v_ver) on conflict (id) do nothing;
  for r in select x->>'person_id' as pid, x->>'kind' as kind from jsonb_array_elements(p_raters) x
            where not exists (select 1 from kafaa_leadership_360_requests q where q.subject_id = me and q.cycle = c and q.rater_kind <> 'self' and q.rater_id = x->>'person_id')
            order by x->>'person_id' collate "C" loop
    v_id := 'l3q-' || c || '-' || me || '-' || r.pid;
    insert into kafaa_leadership_360_requests (id, cycle, subject_id, rater_id, rater_kind, status, subject_name, subject_name_ar, invited_at, form_version)
    values (v_id, c, me, r.pid, r.kind, 'invited', s.display_name, coalesce(nullif(s.display_name_ar, ''), s.display_name), now(), v_ver) on conflict (id) do nothing;
    perform kafaa_lead_notify('nt-' || v_id, r.pid, 'leadership', 'Leadership 360: ' || s.display_name || ' asked for your feedback',
      'تقييم 360 القيادي: طلب ' || coalesce(nullif(s.display_name_ar, ''), s.display_name) || ' ملاحظاتك', '/leadership/360', 'info');
  end loop;
  return kafaa_result(true, 'ok', 'Feedback requested from ' || v_total || ' colleagues',
    kafaa_audit('leadership.360.request', 'leadership_360_requests', v_ent, 'ok', v_fresh || ' invited (' || v_total || ' total)', 'not_applicable', null, v_role), null,
    jsonb_build_object('cycle', c, 'invited', v_total, 'added', v_fresh));
end $$;

-- Submit a rating (F16 rules unchanged): the sheet must match the request's form version; the response keeps the version.
create or replace function kafaa_submit_360(p_request_id text, p_scores jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; q kafaa_leadership_360_requests; s jsonb; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('leadership.360.submit', 'leadership_360_requests', p_request_id, 'not_signed_in', 'Sign in to use the leadership academy'); end if;
  v_role := kafaa_acting_role('own_profile', array['Own']);
  select * into q from kafaa_leadership_360_requests where id = p_request_id;
  if q.id is null or q.rater_id <> me then return kafaa_refuse('leadership.360.submit', 'leadership_360_requests', p_request_id, 'not_found', 'Feedback request not found', v_role); end if;
  if q.status = 'submitted' then return kafaa_refuse('leadership.360.submit', 'leadership_360_requests', p_request_id, 'conflict', 'You have already given this feedback', v_role); end if;
  s := kafaa_lead_scores_v(p_scores, coalesce(q.form_version, 1));
  if s is null then return kafaa_refuse('leadership.360.submit', 'leadership_360_requests', p_request_id, 'invalid', 'Rate every behaviour from 1 to 5', v_role); end if;
  insert into kafaa_leadership_360 (id, cycle, subject_id, rater_kind, scores, submitted_at, open_read, form_version) values (kafaa_lead_rid('l3'), q.cycle, q.subject_id, q.rater_kind, s, now(), false, coalesce(q.form_version, 1));
  update kafaa_leadership_360_requests set status = 'submitted', submitted_at = now() where id = q.id;
  a := kafaa_audit('leadership.360.submit', 'leadership_360_requests', q.id, 'ok', q.rater_kind, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Thank you: your feedback is recorded without your name', a, null, jsonb_build_object('status', 'submitted'));
end $$;

-- Shared gate for the FS46-FS48 aggregates: skills_profile or talent_review Agg/A, or auditors (as leadershipStats).
create or replace function kafaa_fs54_stats_gate() returns boolean language sql stable security definer set search_path = public as $$
  select kafaa_me() is not null and (kafaa_has_grant('skills_profile', array['Agg', 'A']) or kafaa_has_grant('talent_review', array['Agg', 'A']) or kafaa_has_grant('audit_log', array['R']))
$$;
-- One cell of the form-2 programme view (computeProgrammeStats(): cell()).
create or replace function kafaa_fs54_cell(p_cycle text, p_subjects text[], p_ids text[]) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare k integer := coalesce(cardinality(p_subjects), 0); v jsonb;
begin
  if k < 10 then return jsonb_build_object('subjects', null, 'suppressed', true, 'scores', null); end if;
  select jsonb_object_agg(z.bid, z.v) into v from (
    select b.id as bid, (round(sum(coalesce((x.scores->>b.id)::integer, 0)) * 100.0 / count(*)) / 100)::float8 as v
      from unnest(p_ids) as b(id) cross join kafaa_leadership_360 x
     where x.cycle = p_cycle and x.rater_kind <> 'self' and coalesce(x.form_version, 1) = 2 and x.subject_id = any(p_subjects)
     group by b.id) z;
  return jsonb_build_object('subjects', k, 'suppressed', false, 'scores', v);
end $$;
-- HR view of 360 form 2 by academy programme (computeProgrammeStats()).
create or replace function kafaa_fs54_programme_stats_compute() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare ids text[] := kafaa_lead_form_ids(2); c text; v_subj text[]; v_rows jsonb;
begin
  select max(x.cycle collate "C") into c from (select cycle, subject_id from kafaa_leadership_360 where coalesce(form_version, 1) = 2 and rater_kind <> 'self' group by cycle, subject_id having count(*) >= 5) x;
  if c is null then select max(cycle collate "C") into c from kafaa_leadership_360 where coalesce(form_version, 1) = 2 and rater_kind <> 'self'; end if;
  select coalesce(array_agg(s.subject_id order by s.subject_id collate "C"), '{}'::text[]) into v_subj
    from (select subject_id from kafaa_leadership_360 where cycle = c and coalesce(form_version, 1) = 2 and rater_kind <> 'self' group by subject_id having count(*) >= 5) s;
  select coalesce(jsonb_agg(jsonb_build_object('programme_id', g.id) || kafaa_fs54_cell(c, (
            select coalesce(array_agg(distinct n.person_id), '{}'::text[]) from kafaa_leadership_nominations n
             where n.programme_id = g.id and n.status in ('approved', 'completed') and n.person_id = any(v_subj)), ids) order by g.sort, g.id collate "C"), '[]'::jsonb)
    into v_rows from kafaa_leadership_programmes g;
  return jsonb_build_object('cycle', c, 'form_version', 2, 'behaviours', to_jsonb(ids), 'all', kafaa_fs54_cell(c, v_subj, ids), 'rows', v_rows);
end $$;
create or replace function kafaa_leadership_programme_stats() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not kafaa_fs54_stats_gate() then return null; end if;
  return kafaa_fs54_programme_stats_compute();
end $$;

-- ═════════════ FS47 · Future Leaders track
create or replace function kafaa_fl_cohort_for(p_cycle text) returns text language sql immutable set search_path = public as $$
  select 'flc-' || (left(p_cycle, 4)::integer + case when right(p_cycle, 2) = 'H2' then 1 else 0 end)::text
$$;
create or replace function kafaa_fs54_ts() returns text language sql stable set search_path = public as $$
  select to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
$$;
create or replace function kafaa_fs54_hist(p_status text, p_note text default null) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('at', kafaa_fs54_ts(), 'status', p_status, 'by', kafaa_me(), 'note', nullif(btrim(coalesce(p_note, '')), ''))
$$;
-- Notifications from FS46-FS48 RPCs, with the row-audit trigger quiet (one audit row per call).
create or replace function kafaa_fs54_notify(p_id text, p_person text, p_kind text, p_en text, p_ar text, p_link text, p_sev text) returns void language plpgsql security definer set search_path = public as $$
declare prev text := current_setting('kafaa.seeding', true);
begin
  if p_person is null or not exists (select 1 from kafaa_people where id = p_person) then return; end if;
  perform set_config('kafaa.seeding', 'on', true);
  insert into kafaa_notifications (id, person_id, kind, title_en, title_ar, link, severity) values (p_id, p_person, p_kind, p_en, p_ar, p_link, p_sev) on conflict (id) do nothing;
  perform set_config('kafaa.seeding', coalesce(prev, ''), true);
end $$;
-- Readiness on the five nuclear-management competencies (flReadiness()).
create or replace function kafaa_fl_readiness_of(p_person text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_comps jsonb; v_score numeric;
begin
  with rws as (
    select c.id cid, c.sort, t.key skill_id, t.value::integer need,
           coalesce((select s.level from kafaa_person_skills s where s.person_id = p_person and s.skill_id = t.key and s.active limit 1), 0) have
      from kafaa_fl_competencies c cross join jsonb_each_text(c.skill_targets) t(key, value)),
  comp as (
    select cid, sort, case when sum(need) > 0 then round(100.0 * sum(least(have, need)) / sum(need)) else 0 end pct,
           jsonb_agg(jsonb_build_object('skill_id', skill_id, 'have', have, 'need', need, 'met', have >= need) order by skill_id collate "C") rows
      from rws group by cid, sort)
  select coalesce(jsonb_agg(jsonb_build_object('id', cid, 'score', (pct / 100.0)::float8, 'rows', rows) order by sort, cid collate "C"), '[]'::jsonb),
         case when count(*) > 0 then round(sum(pct) / count(*)) / 100.0 else 0 end
    into v_comps, v_score from comp;
  return jsonb_build_object('person_id', p_person, 'score', v_score::float8, 'comps', v_comps);
end $$;
-- Readiness for me, or for Future Leaders nominees the caller may see (HR authority, training manager, HR analysts in scope).
create or replace function kafaa_fl_readiness(p_person_ids text[]) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_wide boolean; v_out jsonb := '[]'::jsonb; v_others integer := 0; p text;
begin
  if me is null then return '[]'::jsonb; end if;
  v_wide := kafaa_has_grant('talent_review', array['R', 'A']) or kafaa_role_grant('training_manager', 'skills_profile', 'A');
  for p in select d.x from (select distinct u.x from unnest(coalesce(p_person_ids, '{}'::text[])) u(x) where u.x is not null) d order by d.x collate "C" loop
    if p = me or (exists (select 1 from kafaa_leadership_nominations n where n.person_id = p and n.programme_id = 'prog-future-leaders' and n.status <> 'declined')
                  and (v_wide or (kafaa_has_grant('talent_review', array['Scope']) and kafaa_in_scope('talent_review', p)))) then
      v_out := v_out || jsonb_build_array(kafaa_fl_readiness_of(p));
      if p <> me then v_others := v_others + 1; end if;
    end if;
  end loop;
  if v_others > 0 then
    perform kafaa_audit('future_leaders.readiness_read', 'fl_participants', null, 'ok', v_others || ' people', 'not_applicable', null, coalesce(kafaa_acting_role('talent_review', array['R', 'A', 'Scope']), 'training_manager'));
  end if;
  return v_out;
end $$;
-- Track statistics (computeFlStats()).
create or replace function kafaa_fl_stats_compute() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_noms jsonb; v_coh jsonb := '[]'::jsonb; c record; k integer; d integer; v_mods jsonb; v_proj jsonb; m record; st text; n integer;
begin
  select jsonb_agg(jsonb_build_object('status', s.st, 'n', case when s.k < 10 then null else s.k end, 'suppressed', s.k < 10) order by s.ord) into v_noms
    from (select t.st, t.ord, (select count(*)::integer from kafaa_leadership_nominations x where x.programme_id = 'prog-future-leaders' and x.status = t.st) k
            from unnest(array['nominated', 'approved', 'declined', 'completed']) with ordinality t(st, ord)) s;
  for c in select * from kafaa_fl_cohorts order by sort, id collate "C" loop
    -- the rows of the selected participants of this cohort (a participant without a row counts as nothing done yet)
    select count(*)::integer into k from kafaa_leadership_nominations x where x.programme_id = 'prog-future-leaders' and x.status in ('approved', 'completed') and kafaa_fl_cohort_for(x.cycle) = c.id;
    select count(*)::integer into d from kafaa_leadership_nominations x left join kafaa_fl_participants p on p.nomination_id = x.id
     where x.programme_id = 'prog-future-leaders' and x.status in ('approved', 'completed') and kafaa_fl_cohort_for(x.cycle) = c.id
       and coalesce(p.status, case when x.status = 'completed' then 'completed' else 'active' end) = 'completed';
    v_mods := '[]'::jsonb;
    for m in select e->>'id' as id, o from jsonb_array_elements(c.modules) with ordinality as t(e, o) order by o loop
      select count(*)::integer into n from kafaa_leadership_nominations x join kafaa_fl_participants p on p.nomination_id = x.id
       where x.programme_id = 'prog-future-leaders' and x.status in ('approved', 'completed') and kafaa_fl_cohort_for(x.cycle) = c.id and m.id = any(p.modules_done);
      v_mods := v_mods || jsonb_build_array(jsonb_build_object('id', m.id, 'done', case when n < 10 then null else n end, 'suppressed', n < 10));
    end loop;
    v_proj := '[]'::jsonb;
    foreach st in array array['none', 'draft', 'submitted', 'returned', 'accepted'] loop
      select count(*)::integer into n from kafaa_leadership_nominations x left join kafaa_fl_participants p on p.nomination_id = x.id
       where x.programme_id = 'prog-future-leaders' and x.status in ('approved', 'completed') and kafaa_fl_cohort_for(x.cycle) = c.id and coalesce(p.project_status, 'none') = st;
      v_proj := v_proj || jsonb_build_array(jsonb_build_object('status', st, 'n', case when n < 10 then null else n end, 'suppressed', n < 10));
    end loop;
    v_coh := v_coh || jsonb_build_array(jsonb_build_object('id', c.id, 'participants', case when k < 10 then null else k end, 'suppressed', k < 10, 'modules', v_mods, 'projects', v_proj,
      'completed', case when d < 10 then null else d end, 'completed_suppressed', d < 10));
  end loop;
  return jsonb_build_object('nominations', v_noms, 'cohorts', v_coh);
end $$;
create or replace function kafaa_future_leaders_stats() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not kafaa_fs54_stats_gate() then return null; end if;
  return kafaa_fl_stats_compute();
end $$;

-- HR nominates a staff member (HR director or HR analyst). Audited, no ledger (like the F16 nomination).
create or replace function kafaa_nominate_future_leader(p_person_id text, p_reason text) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_ent text := 'prog-future-leaders:' || coalesce(p_person_id, ''); v_role text; p kafaa_people; nm kafaa_people; v_reason text := btrim(coalesce(p_reason, ''));
  v_id text; v_cycle text := kafaa_lead_cycle(current_date); a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('future_leaders.nominate', 'leadership_nominations', v_ent, 'not_signed_in', 'Sign in to use the Future Leaders track'); end if;
  v_role := case when kafaa_role_grant('hr_director', 'talent_review', 'A') then 'hr_director' when kafaa_role_grant('hr_analyst', 'talent_review', 'Agg') then 'hr_analyst' end;
  if v_role is null then return kafaa_refuse('future_leaders.nominate', 'leadership_nominations', v_ent, 'forbidden', 'Only HR (HR analyst or HR director) nominates people for the Future Leaders track'); end if;
  if p_person_id = me then return kafaa_refuse('future_leaders.nominate', 'leadership_nominations', v_ent, 'self_nominate', 'You cannot nominate yourself', v_role); end if;
  select * into p from kafaa_people where id = p_person_id;
  if p.id is null or p.kind <> 'staff' or p.status <> 'active' then return kafaa_refuse('future_leaders.nominate', 'leadership_nominations', v_ent, 'not_found', 'Person not found', v_role); end if;
  if length(v_reason) < 10 or length(v_reason) > 500 then return kafaa_refuse('future_leaders.nominate', 'leadership_nominations', v_ent, 'invalid', 'Give a reason of 10 to 500 characters (what the person is ready for)', v_role); end if;
  if exists (select 1 from kafaa_leadership_nominations n where n.person_id = p_person_id and n.programme_id = 'prog-future-leaders' and n.status in ('nominated', 'approved')) then
    return kafaa_refuse('future_leaders.nominate', 'leadership_nominations', v_ent, 'conflict', 'This person already has an open Future Leaders nomination', v_role);
  end if;
  select * into nm from kafaa_people where id = me;
  v_id := kafaa_lead_rid('ln');
  insert into kafaa_leadership_nominations (id, person_id, programme_id, nominated_by, reason, cycle, status, person_name, person_name_ar, person_role_id, person_family_id,
    nominator_name, nominator_name_ar, history, created_at, updated_at)
  values (v_id, p_person_id, 'prog-future-leaders', me, v_reason, v_cycle, 'nominated', p.display_name, coalesce(nullif(p.display_name_ar, ''), p.display_name), p.job_role_id, p.job_family_id,
    nm.display_name, coalesce(nullif(nm.display_name_ar, ''), nm.display_name), jsonb_build_array(jsonb_build_object('at', kafaa_fs54_ts(), 'status', 'nominated', 'by', me, 'note', null)), now(), now());
  perform kafaa_fs54_notify('nt-' || v_id || '-fl-nominated', p_person_id, 'leadership', 'You were nominated for the Future Leaders track', 'تم ترشيحك لمسار قادة المستقبل', '/leadership/future-leaders', 'ok');
  a := kafaa_audit('future_leaders.nominate', 'leadership_nominations', v_id, 'ok', 'prog-future-leaders for ' || p_person_id, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Nomination sent for selection', a, null, jsonb_build_object('id', v_id, 'status', 'nominated', 'cohort_id', kafaa_fl_cohort_for(v_cycle)));
end $$;

-- The participant row of a selected nomination, created on first use (same defaults as the LocalBackend).
create or replace function kafaa_fs54_participant(n kafaa_leadership_nominations) returns kafaa_fl_participants language plpgsql security definer set search_path = public as $$
declare p kafaa_fl_participants;
begin
  select * into p from kafaa_fl_participants where id = 'flp:' || n.id;
  if p.id is null then
    insert into kafaa_fl_participants (id, nomination_id, person_id, cohort_id, person_name, person_name_ar, modules_done, project_status, status, history, updated_at)
    values ('flp:' || n.id, n.id, n.person_id, kafaa_fl_cohort_for(n.cycle), n.person_name, n.person_name_ar, '{}'::text[], 'none', 'active', '[]'::jsonb, now())
    returning * into p;
  end if;
  return p;
end $$;

-- The training manager records (or clears) a completed module of a running cohort. Audited.
create or replace function kafaa_record_fl_module(p_nomination_id text, p_module_id text, p_done boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); n kafaa_leadership_nominations; p kafaa_fl_participants; c kafaa_fl_cohorts; v_mods text[]; v_done boolean := coalesce(p_done, true); a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('future_leaders.module', 'fl_participants', p_nomination_id, 'not_signed_in', 'Sign in to use the Future Leaders track'); end if;
  if not kafaa_role_grant('training_manager', 'skills_profile', 'A') then return kafaa_refuse('future_leaders.module', 'fl_participants', p_nomination_id, 'forbidden', 'Only the training manager records Future Leaders modules'); end if;
  select * into n from kafaa_leadership_nominations where id = p_nomination_id and programme_id = 'prog-future-leaders';
  if n.id is null or n.status <> 'approved' then return kafaa_refuse('future_leaders.module', 'fl_participants', p_nomination_id, 'not_found', 'Participant not found', 'training_manager'); end if;
  select * into c from kafaa_fl_cohorts where id = kafaa_fl_cohort_for(n.cycle);
  if c.id is null or c.status <> 'running' then return kafaa_refuse('future_leaders.module', 'fl_participants', p_nomination_id, 'invalid', 'This cohort is not running, so modules cannot be recorded', 'training_manager'); end if;
  if not exists (select 1 from jsonb_array_elements(c.modules) e where e->>'id' = p_module_id) then return kafaa_refuse('future_leaders.module', 'fl_participants', p_nomination_id, 'invalid', 'Unknown module for this cohort', 'training_manager'); end if;
  p := kafaa_fs54_participant(n);
  select coalesce(array_agg(e->>'id' order by o), '{}'::text[]) into v_mods from jsonb_array_elements(c.modules) with ordinality t(e, o)
   where case when e->>'id' = p_module_id then v_done else (e->>'id') = any(p.modules_done) end;
  update kafaa_fl_participants set modules_done = v_mods, history = history || jsonb_build_array(kafaa_fs54_hist(case when v_done then 'module:' else 'module_cleared:' end || p_module_id)), updated_at = now() where id = p.id;
  a := kafaa_audit('future_leaders.module', 'fl_participants', p.id, 'ok', p_module_id || case when v_done then ' done' else ' cleared' end, 'not_applicable', null, 'training_manager');
  return kafaa_result(true, 'ok', case when v_done then 'Module recorded' else 'Module cleared' end, a, null, jsonb_build_object('modules_done', to_jsonb(v_mods)));
end $$;

-- The selected participant saves or submits their policy project (screened like community posts). Audited.
create or replace function kafaa_save_policy_project(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_nom text := nullif(p->>'nomination_id', ''); v_role text; n kafaa_leadership_nominations; x kafaa_fl_participants; v_bad jsonb; v_status text; a kafaa_audit_events;
  v_title text := btrim(coalesce(p->>'title', '')); v_q text := btrim(coalesce(p->>'question', '')); v_sum text := btrim(coalesce(p->>'summary', '')); v_sp text := btrim(coalesce(p->>'sponsor_role', ''));
  v_submit boolean := coalesce((p->>'submit')::boolean, false);
begin
  if me is null then return kafaa_refuse('future_leaders.project', 'fl_participants', v_nom, 'not_signed_in', 'Sign in to use the Future Leaders track'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  select * into n from kafaa_leadership_nominations where id = v_nom and programme_id = 'prog-future-leaders';
  if n.id is null or n.person_id <> me or n.status <> 'approved' then return kafaa_refuse('future_leaders.project', 'fl_participants', v_nom, 'forbidden', 'Only the selected participant edits their policy project', v_role); end if;
  select * into x from kafaa_fl_participants where id = 'flp:' || n.id;
  if x.project_status = 'accepted' then return kafaa_refuse('future_leaders.project', 'fl_participants', v_nom, 'conflict', 'This policy project has been accepted and can no longer be edited', v_role); end if;
  if length(v_title) < 5 or length(v_title) > 140 then return kafaa_refuse('future_leaders.project', 'fl_participants', v_nom, 'invalid', 'Give the project a title of 5 to 140 characters', v_role); end if;
  if length(v_q) < 10 or length(v_q) > 300 then return kafaa_refuse('future_leaders.project', 'fl_participants', v_nom, 'invalid', 'State the policy question in 10 to 300 characters', v_role); end if;
  if length(v_sum) < 20 or length(v_sum) > 1500 then return kafaa_refuse('future_leaders.project', 'fl_participants', v_nom, 'invalid', 'Write a summary of 20 to 1,500 characters', v_role); end if;
  if length(v_sp) < 3 or length(v_sp) > 80 then return kafaa_refuse('future_leaders.project', 'fl_participants', v_nom, 'invalid', 'Name the sponsor role (3 to 80 characters, a role, not a person)', v_role); end if;
  v_bad := kafaa_cop_screen((p->>'title') || ' ' || (p->>'question') || ' ' || (p->>'summary') || ' ' || (p->>'sponsor_role'));
  if v_bad is not null then return kafaa_refuse('future_leaders.project', 'fl_participants', v_nom, v_bad->>'code', v_bad->>'message', v_role); end if;
  v_status := case when v_submit then 'submitted' else 'draft' end;
  x := kafaa_fs54_participant(n);
  update kafaa_fl_participants set project_title = v_title, project_question = v_q, project_summary = v_sum, project_sponsor_role = v_sp, project_status = v_status,
    project_submitted_on = case when v_submit then current_date else project_submitted_on end, history = history || jsonb_build_array(kafaa_fs54_hist('project:' || v_status)), updated_at = now()
   where id = x.id;
  a := kafaa_audit('future_leaders.project', 'fl_participants', x.id, 'ok', v_status, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when v_submit then 'Policy project submitted for review' else 'Draft saved' end, a, null, jsonb_build_object('project_status', v_status));
end $$;
