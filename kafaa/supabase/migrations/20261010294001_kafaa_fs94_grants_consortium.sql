-- [FS wave I · E4 · FS82 + FS83] Skills Ecosystem (M36): rolling mobility micro-grants and the UAE energy consortium trainee cohort.
-- FS82: kafaa_grant_rounds (bi-monthly, contiguous: a round opens the day after the previous deadline and closes on its own deadline, the
--   10th of an even month; decisions 14 days later; the phase comes from the dates only, kafaa_gr_phase = roundPhase) with SIMULATED
--   budgets; kafaa_grant_applications (early-career staff, or a student on an ENEC-sponsored placement filed by HR with a consent
--   reference), decided by the HR director after the deadline within the budget (kafaa_gr_decision_problem = decisionProblem), outputs
--   (report, presentation) logged by the grantee and accepted by HR: an accepted output of a staff member is F01 evidence kind `rating`,
--   basis `validated`, ref_table `grant_applications` (report L1, presentation L2). kafaa_gr_stats = grantStats (counts of 1-9 suppressed).
-- FS83: kafaa_consortium_cohorts (ENEC with synthetic partner organisations; shared modules hosted in turn, a project, cross-employer
--   mentors as role cards; SIMULATED shared budget; builds on an FS20 academy), kafaa_consortium_members (ENEC staff, or pseudonymous
--   partner trainees), kafaa_consortium_visits (cross-site visits; only the host confirms; a confirmed visit of an ENEC staff trainee
--   writes F01 evidence kind `ojt`, basis `validated`, ref_table `consortium_visits`, level 1-2). kafaa_cc_stats = consortiumStats.
-- RLS: rounds internal_content R; applications own rows + workforce_strategy R/W/A; cohorts public where listed + workforce_strategy;
--   members and visits: the trainee (own_profile Own), the trainee's employer (ecosystem OwnOrg; open_read is always false) and
--   workforce_strategy R/W/A. Hosts see hosted visits through kafaa_consortium_host_visits only.
-- Recorded evidence (handover 3.9, the FS29/FS66/FS72 precedent): both evidence kinds (`rating`, `ojt`) are recorded kinds, so
--   kafaa_skill_states_v2 / kafaa_skills_apply keep the rows without a redefinition; no shared function is redefined here.
-- Reused read-only: kafaa_w5_is_date, kafaa_w5_hex, kafaa_w5_notify (W5), kafaa_res_contact (F23), kafaa_rg_is_int, kafaa_rg_txt (FS64).
-- PGlite parity and checks: scripts/validate/fs94-grants-consortium.mjs. Tests: tests/unit/fs94-*.
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects; never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file; RLS in the per-statement (perf) form.

-- ───────────── Tables (generated DDL, additive)
-- M36 · A bi-monthly mobility micro-grant round: window from the day after the previous deadline to its own deadline (10th of an even month), decisions 14 days later; budget and maximum award SIMULATED (FS82)
create table if not exists kafaa_grant_rounds (
  id text primary key,
  opens_on date not null,
  closes_on date not null unique,
  decide_by date not null,
  budget integer not null,
  max_award integer not null,
  currency text not null default 'AED',
  note text,
  simulated boolean not null default true,
  created_by text not null,
  created_at timestamptz not null default now(),
  sample boolean not null default false
);
comment on table kafaa_grant_rounds is '[M36] A bi-monthly mobility micro-grant round: window from the day after the previous deadline to its own deadline (10th of an even month), decisions 14 days later; budget and maximum award SIMULATED (FS82)';

-- M36 · A mobility micro-grant application: activity, purpose, dates, cost lines (SIMULATED AED), the skill it builds and the promised output; the HR decision; the output (report or presentation) and its review; own rows + HR (FS82)
create table if not exists kafaa_grant_applications (
  id text primary key,
  round_id text not null,
  person_id text not null,
  initials text not null default '',
  job_role_id text,
  years integer,
  basis text not null check (basis in ('early_career', 'placement')),
  kind text not null check (kind in ('conference', 'short_course', 'site_visit', 'exchange')),
  title text not null,
  purpose text not null,
  destination text not null,
  starts_on date not null,
  ends_on date not null,
  costs jsonb not null default '[]'::jsonb,
  amount integer not null,
  skill_id text not null,
  output_kind text not null check (output_kind in ('report', 'presentation')),
  status text not null default 'submitted' check (status in ('submitted', 'approved', 'declined', 'withdrawn')),
  awarded integer,
  decided_by text,
  decided_at timestamptz,
  decision_note text,
  output_status text not null default 'none' check (output_status in ('none', 'submitted', 'accepted', 'returned')),
  output jsonb not null default '{}'::jsonb,
  output_reviewed_by text,
  output_reviewed_at timestamptz,
  output_note text,
  evidence jsonb not null default '[]'::jsonb,
  profile_evidence boolean not null default false,
  on_behalf boolean not null default false,
  consent_ref text,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sample boolean not null default false
);
comment on table kafaa_grant_applications is '[M36] A mobility micro-grant application: activity, purpose, dates, cost lines (SIMULATED AED), the skill it builds and the promised output; the HR decision; the output (report or presentation) and its review; own rows + HR (FS82)';

-- M36 · A multi-employer trainee cohort (ENEC with synthetic partner organisations): partner sites and seats, shared modules hosted in turn, a project, cross-employer mentors (role cards), SIMULATED shared budget; builds on an FS20 academy (FS83)
create table if not exists kafaa_consortium_cohorts (
  id text primary key,
  code text not null unique,
  title_en text not null,
  title_ar text not null,
  summary_en text not null,
  summary_ar text not null,
  intake_year integer not null,
  academy_id text not null,
  nominations_close_on date not null,
  starts_on date not null,
  ends_on date not null,
  partners jsonb not null default '[]'::jsonb,
  modules jsonb not null default '[]'::jsonb,
  project_en text not null,
  project_ar text not null,
  deliverable_en text not null,
  deliverable_ar text not null,
  mentors jsonb not null default '[]'::jsonb,
  skills text[] not null default '{}'::text[],
  budget jsonb not null default '[]'::jsonb,
  currency text not null default 'AED',
  sources jsonb not null default '[]'::jsonb,
  simulated boolean not null default true,
  synthetic boolean not null default true,
  listed boolean not null default true,
  sort integer not null default 0
);
comment on table kafaa_consortium_cohorts is '[M36] A multi-employer trainee cohort (ENEC with synthetic partner organisations): partner sites and seats, shared modules hosted in turn, a project, cross-employer mentors (role cards), SIMULATED shared budget; builds on an FS20 academy (FS83)';

-- M36 · A consortium trainee: ENEC staff (person) or a partner trainee (pseudonymous code only), employer, discipline, nomination and HR decision, cross-employer mentor and project team; trainee + own employer + HR (FS83)
create table if not exists kafaa_consortium_members (
  id text primary key,
  cohort_id text not null,
  org_id text not null,
  person_id text,
  initials text,
  trainee_code text not null,
  discipline text not null check (discipline in ('mechanical', 'electrical', 'chemical', 'operations', 'instrumentation', 'environmental', 'digital')),
  status text not null default 'nominated' check (status in ('nominated', 'accepted', 'declined', 'withdrawn', 'completed')),
  nominated_by text not null,
  nominated_at timestamptz not null default now(),
  decided_by text,
  decided_at timestamptz,
  decision_note text,
  mentor_id text,
  team text,
  open_read boolean not null default false,
  sample boolean not null default false
);
comment on table kafaa_consortium_members is '[M36] A consortium trainee: ENEC staff (person) or a partner trainee (pseudonymous code only), employer, discipline, nomination and HR decision, cross-employer mentor and project team; trainee + own employer + HR (FS83)';

-- M36 · A cross-site visit by a consortium trainee to another member organisation: logged, then confirmed or declined by the host only; confirmation writes evidence on the host site's focus skill (F01 for ENEC staff) (FS83)
create table if not exists kafaa_consortium_visits (
  id text primary key,
  cohort_id text not null,
  member_id text not null,
  org_id text not null,
  person_id text,
  trainee_code text not null,
  host_org_id text not null,
  module_id text,
  visit_on date not null,
  hours numeric not null,
  note text not null default '',
  skill_id text not null,
  status text not null default 'logged' check (status in ('logged', 'confirmed', 'declined', 'withdrawn')),
  logged_by text not null,
  logged_via text not null check (logged_via in ('self', 'employer', 'programme')),
  confirmed_via text check (confirmed_via in ('host', 'enec_host', 'on_behalf')),
  host_ref text,
  decided_by text,
  decided_at timestamptz,
  decline_reason text,
  level integer not null default 0,
  evidence jsonb not null default '[]'::jsonb,
  profile_evidence boolean not null default false,
  created_at timestamptz not null default now(),
  open_read boolean not null default false,
  sample boolean not null default false
);
comment on table kafaa_consortium_visits is '[M36] A cross-site visit by a consortium trainee to another member organisation: logged, then confirmed or declined by the host only; confirmation writes evidence on the host site''s focus skill (F01 for ENEC staff) (FS83)';

do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_grant_applications_round_id_fk') then alter table kafaa_grant_applications add constraint kafaa_grant_applications_round_id_fk foreign key (round_id) references kafaa_grant_rounds(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_grant_applications_person_id_fk') then alter table kafaa_grant_applications add constraint kafaa_grant_applications_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_grant_applications_skill_id_fk') then alter table kafaa_grant_applications add constraint kafaa_grant_applications_skill_id_fk foreign key (skill_id) references kafaa_skills(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_consortium_cohorts_academy_id_fk') then alter table kafaa_consortium_cohorts add constraint kafaa_consortium_cohorts_academy_id_fk foreign key (academy_id) references kafaa_academies(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_consortium_members_cohort_id_fk') then alter table kafaa_consortium_members add constraint kafaa_consortium_members_cohort_id_fk foreign key (cohort_id) references kafaa_consortium_cohorts(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_consortium_members_org_id_fk') then alter table kafaa_consortium_members add constraint kafaa_consortium_members_org_id_fk foreign key (org_id) references kafaa_organisations(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_consortium_members_person_id_fk') then alter table kafaa_consortium_members add constraint kafaa_consortium_members_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_consortium_visits_cohort_id_fk') then alter table kafaa_consortium_visits add constraint kafaa_consortium_visits_cohort_id_fk foreign key (cohort_id) references kafaa_consortium_cohorts(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_consortium_visits_member_id_fk') then alter table kafaa_consortium_visits add constraint kafaa_consortium_visits_member_id_fk foreign key (member_id) references kafaa_consortium_members(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_consortium_visits_org_id_fk') then alter table kafaa_consortium_visits add constraint kafaa_consortium_visits_org_id_fk foreign key (org_id) references kafaa_organisations(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_consortium_visits_person_id_fk') then alter table kafaa_consortium_visits add constraint kafaa_consortium_visits_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_consortium_visits_host_org_id_fk') then alter table kafaa_consortium_visits add constraint kafaa_consortium_visits_host_org_id_fk foreign key (host_org_id) references kafaa_organisations(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_consortium_visits_skill_id_fk') then alter table kafaa_consortium_visits add constraint kafaa_consortium_visits_skill_id_fk foreign key (skill_id) references kafaa_skills(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_grant_applications_round_id_idx on kafaa_grant_applications (round_id);
create index if not exists kafaa_grant_applications_person_id_idx on kafaa_grant_applications (person_id);
create index if not exists kafaa_grant_applications_skill_id_idx on kafaa_grant_applications (skill_id);
create index if not exists kafaa_grant_applications_status_idx on kafaa_grant_applications (status);
create index if not exists kafaa_consortium_cohorts_academy_id_idx on kafaa_consortium_cohorts (academy_id);
create index if not exists kafaa_consortium_members_cohort_id_idx on kafaa_consortium_members (cohort_id);
create index if not exists kafaa_consortium_members_org_id_idx on kafaa_consortium_members (org_id);
create index if not exists kafaa_consortium_members_person_id_idx on kafaa_consortium_members (person_id);
create index if not exists kafaa_consortium_members_status_idx on kafaa_consortium_members (status);
create index if not exists kafaa_consortium_visits_cohort_id_idx on kafaa_consortium_visits (cohort_id);
create index if not exists kafaa_consortium_visits_member_id_idx on kafaa_consortium_visits (member_id);
create index if not exists kafaa_consortium_visits_org_id_idx on kafaa_consortium_visits (org_id);
create index if not exists kafaa_consortium_visits_person_id_idx on kafaa_consortium_visits (person_id);
create index if not exists kafaa_consortium_visits_host_org_id_idx on kafaa_consortium_visits (host_org_id);
create index if not exists kafaa_consortium_visits_skill_id_idx on kafaa_consortium_visits (skill_id);
create index if not exists kafaa_consortium_visits_status_idx on kafaa_consortium_visits (status);

-- the same rules in the database: one live application per person and round; numbers, dates and evidence levels in range
create unique index if not exists kafaa_grant_applications_live_uq on kafaa_grant_applications (round_id, person_id) where status <> 'withdrawn';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'kafaa_grant_rounds_dates_ck') then
    alter table kafaa_grant_rounds add constraint kafaa_grant_rounds_dates_ck check (simulated and opens_on <= closes_on and decide_by = closes_on + 14
      and extract(day from closes_on) = 10 and extract(month from closes_on)::integer % 2 = 0 and budget between 10000 and 500000 and max_award between 1000 and 25000 and max_award <= budget); end if;
  if not exists (select 1 from pg_constraint where conname = 'kafaa_grant_applications_numbers_ck') then
    alter table kafaa_grant_applications add constraint kafaa_grant_applications_numbers_ck check (amount between 500 and 25000 and ends_on >= starts_on
      and (awarded is null or (status = 'approved' and awarded between 500 and amount)) and (status <> 'approved' or awarded is not null)
      and (output_status = 'none' or status = 'approved') and (not on_behalf or consent_ref is not null)); end if;
  if not exists (select 1 from pg_constraint where conname = 'kafaa_consortium_visits_numbers_ck') then
    alter table kafaa_consortium_visits add constraint kafaa_consortium_visits_numbers_ck check (hours between 1 and 40 and host_org_id <> org_id and level between 0 and 2
      and (status <> 'confirmed' or (level between 1 and 2 and decided_by is not null and decided_by <> logged_by)) and (confirmed_via is distinct from 'on_behalf' or host_ref is not null or status <> 'confirmed')); end if;
  if not exists (select 1 from pg_constraint where conname = 'kafaa_consortium_cohorts_flags_ck') then
    alter table kafaa_consortium_cohorts add constraint kafaa_consortium_cohorts_flags_ck check (simulated and synthetic and nominations_close_on < starts_on and starts_on < ends_on); end if;
end $$;

-- ───────────── RLS (per-statement form)
alter table kafaa_grant_rounds enable row level security;
alter table kafaa_grant_applications enable row level security;
alter table kafaa_consortium_cohorts enable row level security;
alter table kafaa_consortium_members enable row level security;
alter table kafaa_consortium_visits enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_grant_rounds' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_grant_rounds for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_grant_applications' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_grant_applications for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_consortium_cohorts' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_consortium_cohorts for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_consortium_members' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_consortium_members for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_consortium_visits' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_consortium_visits for select to anon, authenticated using (false)'; end if;
end $$;
alter policy kafaa_read on kafaa_grant_rounds using (((SELECT kafaa_has_grant('internal_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))));
alter policy kafaa_read on kafaa_grant_applications using (((((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false))) OR (((SELECT kafaa_has_grant('workforce_strategy'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))))));
alter policy kafaa_read on kafaa_consortium_cohorts using ((((COALESCE(listed, false) AND (SELECT kafaa_has_grant('talent_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))) OR (((SELECT kafaa_has_grant('workforce_strategy'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))))));
alter policy kafaa_read on kafaa_consortium_members using (((((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false))) OR ((COALESCE(open_read, false) AND (SELECT kafaa_has_grant('ecosystem'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((org_id = (SELECT kafaa_my_org())) AND (SELECT kafaa_has_grant('ecosystem'::text, ARRAY['OwnOrg'::text, 'OrgW'::text])))) OR (((SELECT kafaa_has_grant('workforce_strategy'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))))));
alter policy kafaa_read on kafaa_consortium_visits using (((((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false))) OR ((COALESCE(open_read, false) AND (SELECT kafaa_has_grant('ecosystem'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((org_id = (SELECT kafaa_my_org())) AND (SELECT kafaa_has_grant('ecosystem'::text, ARRAY['OwnOrg'::text, 'OrgW'::text])))) OR (((SELECT kafaa_has_grant('workforce_strategy'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))))));
revoke all on kafaa_grant_rounds, kafaa_grant_applications, kafaa_consortium_cohorts, kafaa_consortium_members, kafaa_consortium_visits from anon, authenticated;
grant select on kafaa_grant_rounds, kafaa_grant_applications, kafaa_consortium_cohorts, kafaa_consortium_members, kafaa_consortium_visits to anon, authenticated;

-- ═════════════ FS82 rules (mirror of src/modules/m36/grants.ts). Internal: not executable by API roles.
-- nextDeadline(): the first 10th of an even month strictly after p
create or replace function kafaa_gr_next_deadline(p date) returns date language plpgsql immutable set search_path = public as $$
declare y integer := extract(year from p)::integer; m integer := extract(month from p)::integer; d date; i integer;
begin
  for i in 0 .. 13 loop
    if m % 2 = 0 then d := make_date(y, m, 10); if d > p then return d; end if; end if;
    m := m + 1;
    if m > 12 then m := 1; y := y + 1; end if;
  end loop;
  return make_date(y, 12, 10);
end $$;
-- nextRoundSlot(): contiguous after the latest deadline, or from today when that day has passed; at least 27 days to the deadline
create or replace function kafaa_gr_slot(p_latest date, p_today date) returns jsonb language plpgsql immutable set search_path = public as $$
declare v_start date := coalesce(p_latest + 1, p_today); v_close date;
begin
  if v_start < p_today then v_start := p_today; end if;
  v_close := kafaa_gr_next_deadline(v_start + 27);
  return jsonb_build_object('id', 'gr-' || to_char(v_close, 'YYYY-MM'), 'opens_on', v_start::text, 'closes_on', v_close::text, 'decide_by', (v_close + 14)::text);
end $$;
-- roundPhase(): scheduled before the window, open inside it (deadline day included), closed after
create or replace function kafaa_gr_phase(p_opens date, p_closes date, p_today date) returns text language sql immutable set search_path = public as $$
  select case when p_today < p_opens then 'scheduled' when p_today <= p_closes then 'open' else 'closed' end
$$;
-- scheduleProblem()
create or replace function kafaa_gr_schedule_problem(p jsonb, p_today date) returns text language plpgsql stable security definer set search_path = public as $$
declare v_note text;
begin
  if exists (select 1 from kafaa_grant_rounds r where kafaa_gr_phase(r.opens_on, r.closes_on, p_today) = 'scheduled') then return 'exists'; end if;
  if p is null or not kafaa_rg_is_int(p -> 'budget') or (p ->> 'budget')::numeric < 10000 or (p ->> 'budget')::numeric > 500000 then return 'budget'; end if;
  if not kafaa_rg_is_int(p -> 'max_award') or (p ->> 'max_award')::numeric < 1000 or (p ->> 'max_award')::numeric > 25000 or (p ->> 'max_award')::numeric > (p ->> 'budget')::numeric then return 'award'; end if;
  if coalesce(jsonb_typeof(p -> 'note'), 'null') = 'null' then v_note := '';
  elsif jsonb_typeof(p -> 'note') = 'string' then v_note := p ->> 'note';
  else return 'note'; end if;
  if length(btrim(v_note, E' \t\n\r')) > 300 or kafaa_res_contact(v_note) then return 'note'; end if;
  return null;
end $$;
-- fullYears(): anniversary rule
create or replace function kafaa_gr_full_years(p_from date, p_to date) returns integer language sql immutable set search_path = public as $$
  select extract(year from p_to)::integer - extract(year from p_from)::integer - case when to_char(p_to, 'MM-DD') < to_char(p_from, 'MM-DD') then 1 else 0 end
$$;
-- eligibility(): early-career staff (fewer than 10 full years since hire) or a student on an ENEC-sponsored placement
create or replace function kafaa_gr_eligibility(p_person text, p_today date, p_placement boolean) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pp kafaa_people; y integer;
begin
  select * into pp from kafaa_people where id = p_person;
  if pp.id is null then return jsonb_build_object('eligible', false, 'basis', null, 'years', null); end if;
  if pp.kind = 'staff' then
    if pp.status <> 'active' or pp.hire_date is null then return jsonb_build_object('eligible', false, 'basis', null, 'years', null); end if;
    y := kafaa_gr_full_years(pp.hire_date, p_today);
    if y < 10 then return jsonb_build_object('eligible', true, 'basis', 'early_career', 'years', y); end if;
    return jsonb_build_object('eligible', false, 'basis', null, 'years', y);
  end if;
  if pp.kind = 'applicant' and p_placement then return jsonb_build_object('eligible', true, 'basis', 'placement', 'years', null); end if;
  return jsonb_build_object('eligible', false, 'basis', null, 'years', null);
end $$;
-- costTotal(): the sum of whole-number amounts in the cost lines
create or replace function kafaa_gr_cost_total(p jsonb) returns integer language sql immutable set search_path = public as $$
  select coalesce(sum((x ->> 'amount')::numeric), 0)::integer from jsonb_array_elements(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end) x
   where jsonb_typeof(x) = 'object' and kafaa_rg_is_int(x -> 'amount')
$$;
-- applicationProblem(): kind, title, purpose, destination, dates, costs, skill, output (first problem in field order)
create or replace function kafaa_gr_app_problem(p jsonb, p_closes date, p_max integer) returns text language plpgsql stable security definer set search_path = public as $$
declare v_t text; v_s date; v_e date; x jsonb; v_seen text[] := '{}'; v_total integer; sk kafaa_skills;
begin
  if p is null or jsonb_typeof(p) <> 'object' or jsonb_typeof(p -> 'kind') is distinct from 'string' or p ->> 'kind' not in ('conference', 'short_course', 'site_visit', 'exchange') then return 'kind'; end if;
  v_t := kafaa_rg_txt(p -> 'title');
  if length(v_t) < 5 or length(v_t) > 160 or kafaa_res_contact(v_t) then return 'title'; end if;
  v_t := kafaa_rg_txt(p -> 'purpose');
  if length(v_t) < 20 or length(v_t) > 600 or kafaa_res_contact(v_t) then return 'purpose'; end if;
  v_t := kafaa_rg_txt(p -> 'destination');
  if length(v_t) < 2 or length(v_t) > 120 or kafaa_res_contact(v_t) then return 'destination'; end if;
  if jsonb_typeof(p -> 'starts_on') is distinct from 'string' or jsonb_typeof(p -> 'ends_on') is distinct from 'string' or not kafaa_w5_is_date(p ->> 'starts_on') or not kafaa_w5_is_date(p ->> 'ends_on') then return 'dates'; end if;
  v_s := (p ->> 'starts_on')::date; v_e := (p ->> 'ends_on')::date;
  if v_s <= p_closes or v_s > p_closes + 180 or v_e < v_s or v_e > v_s + 30 then return 'dates'; end if;
  if jsonb_typeof(p -> 'costs') is distinct from 'array' or jsonb_array_length(p -> 'costs') < 1 or jsonb_array_length(p -> 'costs') > 3 then return 'costs'; end if;
  for x in select e from jsonb_array_elements(p -> 'costs') e loop
    if jsonb_typeof(x) <> 'object' or jsonb_typeof(x -> 'item') is distinct from 'string' or x ->> 'item' not in ('transport', 'subsistence', 'registration') or (x ->> 'item') = any (v_seen)
      or not kafaa_rg_is_int(x -> 'amount') or (x ->> 'amount')::numeric < 0 or (x ->> 'amount')::numeric > p_max then return 'costs'; end if;
    v_seen := v_seen || (x ->> 'item');
  end loop;
  v_total := kafaa_gr_cost_total(p -> 'costs');
  if v_total < 500 or v_total > p_max then return 'costs'; end if;
  if jsonb_typeof(p -> 'skill_id') is distinct from 'string' then return 'skill'; end if;
  select * into sk from kafaa_skills where id = p ->> 'skill_id';
  if sk.id is null or sk.area is not distinct from 'security' or sk.lifecycle is not distinct from 'obsolete' then return 'skill'; end if;
  if jsonb_typeof(p -> 'output_kind') is distinct from 'string' or p ->> 'output_kind' not in ('report', 'presentation') then return 'output'; end if;
  return null;
end $$;
-- decisionProblem(): after the deadline; approve or decline; a note (5+ to decline); the award within the request, the maximum and the budget
create or replace function kafaa_gr_decision_problem(p jsonb, p_amount integer, p_opens date, p_closes date, p_max integer, p_budget integer, p_committed integer, p_today date) returns text language plpgsql immutable set search_path = public as $$
declare v_note text; v_award numeric;
begin
  if kafaa_gr_phase(p_opens, p_closes, p_today) <> 'closed' then return 'round_open'; end if;
  if p is null or jsonb_typeof(p -> 'decision') is distinct from 'string' or p ->> 'decision' not in ('approve', 'decline') then return 'decision'; end if;
  v_note := kafaa_rg_txt(p -> 'note');
  if length(v_note) > 300 or (p ->> 'decision' = 'decline' and length(v_note) < 5) then return 'note'; end if;
  if p ->> 'decision' = 'decline' then return null; end if;
  if coalesce(jsonb_typeof(p -> 'award'), 'null') = 'null' then v_award := p_amount;
  elsif kafaa_rg_is_int(p -> 'award') then v_award := (p ->> 'award')::numeric;
  else return 'award'; end if;
  if v_award < 500 or v_award > p_amount or v_award > p_max then return 'award'; end if;
  if p_committed + v_award > p_budget then return 'budget'; end if;
  return null;
end $$;
-- outputProblem(): after the activity; report or presentation; title; summary
create or replace function kafaa_gr_output_problem(p jsonb, p_ends date, p_today date) returns text language plpgsql immutable set search_path = public as $$
declare v_t text;
begin
  if p_today < p_ends then return 'too_early'; end if;
  if p is null or jsonb_typeof(p -> 'kind') is distinct from 'string' or p ->> 'kind' not in ('report', 'presentation') then return 'kind'; end if;
  v_t := kafaa_rg_txt(p -> 'title');
  if length(v_t) < 5 or length(v_t) > 160 or kafaa_res_contact(v_t) then return 'title'; end if;
  v_t := kafaa_rg_txt(p -> 'summary');
  if length(v_t) < 20 or length(v_t) > 1200 or kafaa_res_contact(v_t) then return 'summary'; end if;
  return null;
end $$;
-- a count cell (1-9 suppressed) and a rate (base 10+, unsuppressed count)
create or replace function kafaa_gr_cell(v bigint) returns jsonb language sql immutable set search_path = public as $$
  select case when v > 0 and v < 10 then jsonb_build_object('value', null, 'suppressed', true) else jsonb_build_object('value', v, 'suppressed', false) end
$$;
create or replace function kafaa_gr_rate(n bigint, base bigint) returns jsonb language sql immutable set search_path = public as $$
  select case when base >= 10 and not (n > 0 and n < 10) then to_jsonb(round((100 * n)::numeric / base)) else 'null'::jsonb end
$$;
-- grantStats(): rounds, totals, by kind and by promised output; withdrawn applications not counted
create or replace function kafaa_gr_stats(p_today date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_rounds jsonb; v_kinds jsonb; v_outs jsonb; v_tot jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
      'round_id', r.id, 'phase', kafaa_gr_phase(r.opens_on, r.closes_on, p_today), 'opens_on', r.opens_on::text, 'closes_on', r.closes_on::text, 'budget', r.budget, 'max_award', r.max_award,
      'applications', kafaa_gr_cell(s.n), 'approved', kafaa_gr_cell(s.ap), 'declined', kafaa_gr_cell(s.de), 'approval_rate', kafaa_gr_rate(s.ap, s.ap + s.de),
      'committed', case when s.ap >= 10 then to_jsonb(s.money) else 'null'::jsonb end, 'outputs_submitted', kafaa_gr_cell(s.os), 'outputs_accepted', kafaa_gr_cell(s.oa)) order by r.closes_on), '[]'::jsonb)
    into v_rounds
    from kafaa_grant_rounds r
    cross join lateral (select count(*) n, count(*) filter (where a.status = 'approved') ap, count(*) filter (where a.status = 'declined') de,
        coalesce(sum(a.awarded) filter (where a.status = 'approved'), 0) money,
        count(*) filter (where a.status = 'approved' and a.output_status in ('submitted', 'accepted', 'returned')) os,
        count(*) filter (where a.status = 'approved' and a.output_status = 'accepted') oa
      from kafaa_grant_applications a where a.round_id = r.id and a.status <> 'withdrawn') s;
  select jsonb_agg(jsonb_build_object('key', k.k, 'applications', kafaa_gr_cell(coalesce(s.n, 0)), 'approved', kafaa_gr_cell(coalesce(s.ap, 0))) order by k.i) into v_kinds
    from unnest(array['conference', 'short_course', 'site_visit', 'exchange']) with ordinality k(k, i)
    left join lateral (select count(*) n, count(*) filter (where a.status = 'approved') ap from kafaa_grant_applications a where a.kind = k.k and a.status <> 'withdrawn') s on true;
  select jsonb_agg(jsonb_build_object('key', k.k, 'promised', kafaa_gr_cell(coalesce(s.n, 0))) order by k.i) into v_outs
    from unnest(array['report', 'presentation']) with ordinality k(k, i)
    left join lateral (select count(*) n from kafaa_grant_applications a where a.output_kind = k.k and a.status = 'approved') s on true;
  select jsonb_build_object('applications', kafaa_gr_cell(count(*)), 'approved', kafaa_gr_cell(count(*) filter (where a.status = 'approved')),
      'outputs_accepted', kafaa_gr_cell(count(*) filter (where a.status = 'approved' and a.output_status = 'accepted')),
      'approval_rate', kafaa_gr_rate(count(*) filter (where a.status = 'approved'), count(*) filter (where a.status in ('approved', 'declined'))))
    into v_tot from kafaa_grant_applications a where a.status <> 'withdrawn';
  return jsonb_build_object('as_of', p_today::text, 'min_group', 10, 'totals', v_tot, 'rounds', v_rounds, 'by_kind', v_kinds, 'by_output', v_outs);
end $$;

-- ═════════════ FS82 RPCs
-- HR (ecosystem W/A + workforce_strategy W/A) schedules the next bi-monthly round; audit + ledger
create or replace function kafaa_schedule_grant_round(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_problem text; v_latest date; v_slot jsonb; v_note text; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('grant.round.schedule', 'grant_rounds', null, 'not_signed_in', 'Sign in to use mobility micro-grants'); end if;
  if not (kafaa_has_grant('ecosystem', array['W', 'A']) and kafaa_has_grant('workforce_strategy', array['W', 'A'])) then
    return kafaa_refuse('grant.round.schedule', 'grant_rounds', null, 'forbidden', 'Only HR schedules rounds and files on behalf of placement students'); end if;
  v_role := kafaa_acting_role('workforce_strategy', array['W', 'A']);
  v_problem := kafaa_gr_schedule_problem(p, current_date);
  if v_problem = 'exists' then return kafaa_refuse('grant.round.schedule', 'grant_rounds', null, 'exists', 'The next round is already scheduled', v_role); end if;
  if v_problem is not null then return kafaa_refuse('grant.round.schedule', 'grant_rounds', null, 'invalid', 'Check the round: ' || case v_problem
    when 'budget' then 'a SIMULATED budget from 10,000 to 500,000 AED' when 'award' then 'a maximum award from 1,000 to 25,000 AED, not above the budget'
    else 'a note of up to 300 characters without contact details' end, v_role); end if;
  select max(closes_on) into v_latest from kafaa_grant_rounds;
  v_slot := kafaa_gr_slot(v_latest, current_date);
  if exists (select 1 from kafaa_grant_rounds where id = v_slot ->> 'id') then return kafaa_refuse('grant.round.schedule', 'grant_rounds', null, 'exists', 'The next round is already scheduled', v_role); end if;
  v_note := kafaa_rg_txt(p -> 'note');
  insert into kafaa_grant_rounds (id, opens_on, closes_on, decide_by, budget, max_award, currency, note, simulated, created_by, created_at, sample)
  values (v_slot ->> 'id', (v_slot ->> 'opens_on')::date, (v_slot ->> 'closes_on')::date, (v_slot ->> 'decide_by')::date, (p ->> 'budget')::integer, (p ->> 'max_award')::integer, 'AED', nullif(v_note, ''), true, me, now(), false);
  l := kafaa_ledger('kafaa.grant.round', 'Micro-grant round ' || (v_slot ->> 'id') || ' scheduled (' || (p ->> 'budget') || ' AED SIMULATED)');
  a := kafaa_audit('grant.round.schedule', 'grant_rounds', v_slot ->> 'id', 'ok', (v_slot ->> 'opens_on') || '..' || (v_slot ->> 'closes_on') || ' budget ' || (p ->> 'budget') || ' max ' || (p ->> 'max_award'),
    case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Round scheduled', a, l, v_slot);
end $$;

-- An early-career staff member applies in the open round; HR files for a placement student with a consent reference; audited
create or replace function kafaa_apply_grant(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_given text; v_behalf boolean; v_target text; r kafaa_grant_rounds; pp kafaa_people; v_place boolean := false; v_consent text;
  v_problem text; v_id text; v_amount integer; v_costs jsonb; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('grant.apply', 'grant_applications', null, 'not_signed_in', 'Sign in to use mobility micro-grants'); end if;
  v_given := case when jsonb_typeof(p -> 'person_id') = 'string' and p ->> 'person_id' <> '' then p ->> 'person_id' end;
  v_behalf := v_given is not null and v_given <> me;
  if v_behalf then
    if not (kafaa_has_grant('ecosystem', array['W', 'A']) and kafaa_has_grant('workforce_strategy', array['W', 'A'])) then
      return kafaa_refuse('grant.apply', 'grant_applications', null, 'forbidden', 'Only HR schedules rounds and files on behalf of placement students'); end if;
    v_role := kafaa_acting_role('workforce_strategy', array['W', 'A']);
  else
    if not kafaa_has_grant('ecosystem', array['Own']) then
      return kafaa_refuse('grant.apply', 'grant_applications', null, 'forbidden', 'Mobility micro-grants are for ENEC staff (HR files for students on a sponsored placement)'); end if;
    v_role := kafaa_acting_role('ecosystem', array['Own']);
  end if;
  v_target := case when v_behalf then v_given else me end;
  select * into r from kafaa_grant_rounds x where kafaa_gr_phase(x.opens_on, x.closes_on, current_date) = 'open' order by x.closes_on limit 1;
  if r.id is null then return kafaa_refuse('grant.apply', 'grant_applications', null, 'no_round', 'No round is open for applications today', v_role); end if;
  select * into pp from kafaa_people where id = v_target;
  v_place := v_behalf and exists (select 1 from kafaa_scholars s where s.person_id = v_target and s.status = 'in_study');
  if v_behalf and not (pp.id is not null and pp.kind = 'applicant' and v_place) then
    return kafaa_refuse('grant.apply', 'grant_applications', null, 'invalid', 'Choose a student on an ENEC-sponsored placement', v_role); end if;
  v_consent := kafaa_rg_txt(p -> 'consent_ref');
  if v_behalf and (length(v_consent) < 3 or length(v_consent) > 80) then
    return kafaa_refuse('grant.apply', 'grant_applications', null, 'invalid', 'Record the student''s consent reference (3 to 80 characters)', v_role); end if;
  if not (kafaa_gr_eligibility(v_target, current_date, v_place) ->> 'eligible')::boolean then
    return kafaa_refuse('grant.apply', 'grant_applications', null, 'not_eligible', 'Micro-grants are for early-career staff (fewer than 10 years since hire) and students on an ENEC-sponsored placement', v_role); end if;
  if exists (select 1 from kafaa_grant_applications x where x.round_id = r.id and x.person_id = v_target and x.status <> 'withdrawn') then
    return kafaa_refuse('grant.apply', 'grant_applications', null, 'duplicate', 'There is already an application for this person in this round', v_role); end if;
  v_problem := kafaa_gr_app_problem(p, r.closes_on, r.max_award);
  if v_problem is not null then return kafaa_refuse('grant.apply', 'grant_applications', null, 'invalid', 'Check the application: ' || case v_problem
    when 'kind' then 'choose a conference, a short course, a site visit or an exchange' when 'title' then 'an activity name of 5 to 160 characters without contact details'
    when 'purpose' then 'a purpose of 20 to 600 characters without contact details' when 'destination' then 'the organiser or place, 2 to 120 characters without contact details'
    when 'dates' then 'an activity starting after the round deadline and within 180 days of it, lasting up to 30 days'
    when 'costs' then 'one to three cost lines (transport, subsistence, registration) in whole AED, totalling 500 up to the round maximum'
    when 'skill' then 'a catalogue skill that is current and not a security skill' else 'promise a report or a presentation' end, v_role); end if;
  v_id := 'ga-' || kafaa_w5_hex(12);
  v_amount := kafaa_gr_cost_total(p -> 'costs');
  select jsonb_agg(jsonb_build_object('item', e ->> 'item', 'amount', (e ->> 'amount')::integer) order by n) into v_costs from jsonb_array_elements(p -> 'costs') with ordinality q(e, n);
  insert into kafaa_grant_applications (id, round_id, person_id, initials, job_role_id, years, basis, kind, title, purpose, destination, starts_on, ends_on, costs, amount, skill_id, output_kind, status,
    output_status, output, evidence, profile_evidence, on_behalf, consent_ref, created_by, created_at, updated_at, sample)
  values (v_id, r.id, v_target, coalesce(pp.initials, ''), pp.job_role_id, (kafaa_gr_eligibility(v_target, current_date, v_place) ->> 'years')::integer, case when v_place then 'placement' else 'early_career' end, p ->> 'kind', kafaa_rg_txt(p -> 'title'), kafaa_rg_txt(p -> 'purpose'), kafaa_rg_txt(p -> 'destination'),
    (p ->> 'starts_on')::date, (p ->> 'ends_on')::date, v_costs, v_amount, p ->> 'skill_id', p ->> 'output_kind', 'submitted', 'none', '{}'::jsonb, '[]'::jsonb, false, v_behalf,
    case when v_behalf then v_consent end, me, now(), now(), false);
  a := kafaa_audit('grant.apply', 'grant_applications', v_id, 'ok', (p ->> 'kind') || ' ' || v_amount || ' AED ' || r.id || case when v_behalf then ' on behalf' else '' end, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Application submitted', a, null, jsonb_build_object('id', v_id, 'round_id', r.id, 'amount', v_amount));
end $$;

-- The applicant (or HR for a placement student's application) withdraws a submitted application; audited
create or replace function kafaa_withdraw_grant(p_id text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_aid text := coalesce(p_id, ''); g kafaa_grant_applications; v_hr boolean; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('grant.withdraw', 'grant_applications', nullif(v_aid, ''), 'not_signed_in', 'Sign in to use mobility micro-grants'); end if;
  select * into g from kafaa_grant_applications where id = v_aid;
  v_hr := kafaa_has_grant('ecosystem', array['W', 'A']) and kafaa_has_grant('workforce_strategy', array['W', 'A']);
  if g.id is null or (g.person_id <> me and not (g.on_behalf and v_hr)) then return kafaa_refuse('grant.withdraw', 'grant_applications', nullif(v_aid, ''), 'not_found', 'Application not found'); end if;
  v_role := case when g.person_id = me then kafaa_acting_role('ecosystem', array['Own']) else kafaa_acting_role('workforce_strategy', array['W', 'A']) end;
  if g.status <> 'submitted' then return kafaa_refuse('grant.withdraw', 'grant_applications', v_aid, 'invalid', 'Only a submitted application can be withdrawn', v_role); end if;
  update kafaa_grant_applications set status = 'withdrawn', updated_at = now() where id = v_aid;
  a := kafaa_audit('grant.withdraw', 'grant_applications', v_aid, 'ok', 'withdrawn', 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Application withdrawn', a, null, jsonb_build_object('id', v_aid, 'status', 'withdrawn'));
end $$;

-- The HR director (ecosystem A + workforce_strategy W/A) decides after the deadline, never their own application, within the budget; audit + ledger
create or replace function kafaa_decide_grant(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_aid text := coalesce(p ->> 'application_id', ''); g kafaa_grant_applications; r kafaa_grant_rounds; v_committed integer; v_problem text;
  v_approve boolean; v_award integer; v_note text; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('grant.decide', 'grant_applications', nullif(v_aid, ''), 'not_signed_in', 'Sign in to use mobility micro-grants'); end if;
  if not (kafaa_has_grant('ecosystem', array['A']) and kafaa_has_grant('workforce_strategy', array['W', 'A'])) then
    return kafaa_refuse('grant.decide', 'grant_applications', nullif(v_aid, ''), 'forbidden', 'Only the HR director decides micro-grants'); end if;
  v_role := kafaa_acting_role('ecosystem', array['A']);
  select * into g from kafaa_grant_applications where id = v_aid;
  if g.id is null then return kafaa_refuse('grant.decide', 'grant_applications', nullif(v_aid, ''), 'not_found', 'Application not found', v_role); end if;
  if g.status <> 'submitted' then return kafaa_refuse('grant.decide', 'grant_applications', v_aid, 'decided', 'This application is already decided', v_role); end if;
  if g.person_id = me then return kafaa_refuse('grant.decide', 'grant_applications', v_aid, 'maker_checker', 'You cannot decide your own application', v_role); end if;
  select * into r from kafaa_grant_rounds where id = g.round_id;
  select coalesce(sum(x.awarded), 0)::integer into v_committed from kafaa_grant_applications x where x.round_id = r.id and x.status = 'approved';
  v_problem := kafaa_gr_decision_problem(p, g.amount, r.opens_on, r.closes_on, r.max_award, r.budget, v_committed, current_date);
  if v_problem is not null then return kafaa_refuse('grant.decide', 'grant_applications', v_aid, case when v_problem in ('round_open', 'budget') then v_problem else 'invalid' end,
    'Check the decision: ' || case v_problem when 'round_open' then 'decisions are made after the round deadline' when 'decision' then 'choose approve or decline'
      when 'note' then 'a note of up to 300 characters (at least 5 when declining)' when 'award' then 'an award from 500 up to the amount requested and the round maximum'
      else 'the award would take the round over its SIMULATED budget' end, v_role); end if;
  v_approve := p ->> 'decision' = 'approve';
  v_award := case when not v_approve then null when coalesce(jsonb_typeof(p -> 'award'), 'null') = 'null' then g.amount else (p ->> 'award')::integer end;
  v_note := kafaa_rg_txt(p -> 'note');
  update kafaa_grant_applications set status = case when v_approve then 'approved' else 'declined' end, awarded = v_award, decided_by = me, decided_at = now(), decision_note = nullif(v_note, ''), updated_at = now() where id = v_aid;
  perform kafaa_w5_notify('nt-gr-' || v_aid || '-decided', g.person_id, 'grant', case when v_approve then 'Your mobility micro-grant was approved' else 'Your mobility micro-grant was not approved' end,
    case when v_approve then 'تمت الموافقة على منحة التنقل الصغيرة' else 'لم تتم الموافقة على منحة التنقل الصغيرة' end, '/my/grants', case when v_approve then 'ok' else 'warn' end);
  l := kafaa_ledger('kafaa.grant.decide', 'Micro-grant ' || v_aid || ' ' || case when v_approve then 'approved (' || v_award || ' AED SIMULATED)' else 'declined' end);
  a := kafaa_audit('grant.decide', 'grant_applications', v_aid, 'ok', case when v_approve then 'approved ' || v_award else 'declined: ' || v_note end, case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when v_approve then 'Grant approved' else 'Grant declined' end, a, l,
    jsonb_build_object('id', v_aid, 'status', case when v_approve then 'approved' else 'declined' end, 'awarded', v_award, 'committed', v_committed + coalesce(v_award, 0)));
end $$;

-- The grantee (or HR for a placement student) logs the promised output after the activity; audited
create or replace function kafaa_submit_grant_output(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_aid text := coalesce(p ->> 'application_id', ''); g kafaa_grant_applications; v_mine boolean; v_hr boolean; v_problem text; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('grant.output.submit', 'grant_applications', nullif(v_aid, ''), 'not_signed_in', 'Sign in to use mobility micro-grants'); end if;
  select * into g from kafaa_grant_applications where id = v_aid;
  v_mine := g.id is not null and g.person_id = me and kafaa_has_grant('ecosystem', array['Own']);
  v_hr := g.id is not null and g.on_behalf and kafaa_has_grant('ecosystem', array['W', 'A']) and kafaa_has_grant('workforce_strategy', array['W', 'A']);
  if g.id is null or (not v_mine and not v_hr) then return kafaa_refuse('grant.output.submit', 'grant_applications', nullif(v_aid, ''), 'not_found', 'Application not found'); end if;
  v_role := case when v_mine then kafaa_acting_role('ecosystem', array['Own']) else kafaa_acting_role('workforce_strategy', array['W', 'A']) end;
  if g.status <> 'approved' then return kafaa_refuse('grant.output.submit', 'grant_applications', v_aid, 'invalid', 'Outputs are logged for approved grants only', v_role); end if;
  if g.output_status in ('submitted', 'accepted') then return kafaa_refuse('grant.output.submit', 'grant_applications', v_aid, 'invalid', 'This output is already submitted or accepted', v_role); end if;
  v_problem := kafaa_gr_output_problem(p, g.ends_on, current_date);
  if v_problem is not null then return kafaa_refuse('grant.output.submit', 'grant_applications', v_aid, case when v_problem = 'too_early' then 'too_early' else 'invalid' end,
    'Check the output: ' || case v_problem when 'too_early' then 'log the output after the activity has ended' when 'kind' then 'choose a report or a presentation'
      when 'title' then 'a title of 5 to 160 characters without contact details' else 'a summary of 20 to 1200 characters without contact details' end, v_role); end if;
  update kafaa_grant_applications set output_status = 'submitted', output = jsonb_build_object('kind', p ->> 'kind', 'title', kafaa_rg_txt(p -> 'title'), 'summary', kafaa_rg_txt(p -> 'summary'),
    'submitted_by', me, 'submitted_at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')), output_note = null, updated_at = now() where id = v_aid;
  a := kafaa_audit('grant.output.submit', 'grant_applications', v_aid, 'ok', (p ->> 'kind') || ' submitted', 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Output submitted for review', a, null, jsonb_build_object('id', v_aid, 'output_status', 'submitted'));
end $$;

-- HR (never the grantee or whoever submitted it) accepts the output (F01 evidence for staff) or returns it with a note; audit + ledger on accept
create or replace function kafaa_review_grant_output(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_aid text := coalesce(p ->> 'application_id', ''); g kafaa_grant_applications; v_note text; v_dec text; v_kind text; v_level integer;
  v_profile boolean; v_kindp text; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('grant.output.review', 'grant_applications', nullif(v_aid, ''), 'not_signed_in', 'Sign in to use mobility micro-grants'); end if;
  if not (kafaa_has_grant('ecosystem', array['W', 'A']) and kafaa_has_grant('workforce_strategy', array['W', 'A'])) then
    return kafaa_refuse('grant.output.review', 'grant_applications', nullif(v_aid, ''), 'forbidden', 'Only HR reviews grant outputs'); end if;
  v_role := kafaa_acting_role('workforce_strategy', array['W', 'A']);
  select * into g from kafaa_grant_applications where id = v_aid;
  if g.id is null then return kafaa_refuse('grant.output.review', 'grant_applications', nullif(v_aid, ''), 'not_found', 'Application not found', v_role); end if;
  if g.person_id = me or g.output ->> 'submitted_by' = me then return kafaa_refuse('grant.output.review', 'grant_applications', v_aid, 'maker_checker', 'You cannot review your own output', v_role); end if;
  if g.status <> 'approved' or g.output_status <> 'submitted' then return kafaa_refuse('grant.output.review', 'grant_applications', v_aid, 'invalid', 'There is no submitted output to review', v_role); end if;
  v_note := kafaa_rg_txt(p -> 'note');
  v_dec := case when jsonb_typeof(p -> 'decision') = 'string' then p ->> 'decision' else '' end;
  if v_dec not in ('accept', 'return') or length(v_note) > 300 or (v_dec = 'return' and length(v_note) < 5) then
    return kafaa_refuse('grant.output.review', 'grant_applications', v_aid, 'invalid', 'Choose accept or return; returning needs a note of 5 to 300 characters', v_role); end if;
  if v_dec = 'return' then
    update kafaa_grant_applications set output_status = 'returned', output_reviewed_by = me, output_reviewed_at = now(), output_note = v_note, updated_at = now() where id = v_aid;
    perform kafaa_w5_notify('nt-gr-' || v_aid || '-returned', g.person_id, 'grant', 'Your grant output needs changes', 'تحتاج مخرجات منحتك إلى تعديلات', '/my/grants', 'warn');
    a := kafaa_audit('grant.output.review', 'grant_applications', v_aid, 'ok', 'returned: ' || v_note, 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Output returned with a note', a, null, jsonb_build_object('id', v_aid, 'output_status', 'returned', 'level', null, 'profile_evidence', false));
  end if;
  v_kind := coalesce(g.output ->> 'kind', g.output_kind);
  v_level := case when v_kind = 'presentation' then 2 else 1 end;
  select pp.kind into v_kindp from kafaa_people pp where pp.id = g.person_id;
  v_profile := v_kindp is not distinct from 'staff';
  if v_profile then
    insert into kafaa_skill_evidence (id, person_id, skill_id, kind, ref_table, ref_id, level, basis, status, observed_on, note, recorded_by, active)
    values ('se:rating:' || v_aid || ':' || g.skill_id, g.person_id, g.skill_id, 'rating', 'grant_applications', v_aid, v_level, 'validated', 'current', g.ends_on,
      'Mobility grant output (' || v_kind || ') accepted by HR', me, true) on conflict (id) do nothing;
  end if;
  update kafaa_grant_applications set output_status = 'accepted', output_reviewed_by = me, output_reviewed_at = now(), output_note = nullif(v_note, ''),
    evidence = jsonb_build_array(jsonb_build_object('skill_id', g.skill_id, 'level', v_level)), profile_evidence = v_profile, updated_at = now() where id = v_aid;
  if v_profile then perform kafaa_skills_apply(g.person_id, current_date); end if;
  perform kafaa_w5_notify('nt-gr-' || v_aid || '-accepted', g.person_id, 'grant', 'Your grant output was accepted', 'تم قبول مخرجات منحتك', '/my/grants', 'ok');
  l := kafaa_ledger('kafaa.grant.output_accept', 'Micro-grant output ' || v_aid || ' accepted (level ' || v_level || ')');
  a := kafaa_audit('grant.output.review', 'grant_applications', v_aid, 'ok', 'accepted L' || v_level, case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Output accepted', a, l, jsonb_build_object('id', v_aid, 'output_status', 'accepted', 'level', v_level, 'profile_evidence', v_profile));
end $$;

-- Programme statistics (staff, HR, auditors); every count of 1-9 suppressed. Read-only; a refusal is audited.
create or replace function kafaa_grant_stats() returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if kafaa_me() is null then return kafaa_refuse('grant.stats', 'grant_applications', null, 'not_signed_in', 'Sign in to use mobility micro-grants'); end if;
  if not (kafaa_has_grant('ecosystem', array['Own', 'W', 'A']) or (kafaa_has_grant('ecosystem', array['R']) and kafaa_has_grant('internal_content', array['R']))) then
    return kafaa_refuse('grant.stats', 'grant_applications', null, 'forbidden', 'Grant statistics are for ENEC staff, HR and auditors'); end if;
  return jsonb_build_object('ok', true, 'code', 'ok', 'message', 'Micro-grant statistics', 'audit_seq', null, 'ledger_seq', null, 'data', kafaa_gr_stats(current_date));
end $$;

-- ═════════════ FS83 rules (mirror of src/modules/m36/consortium.ts). Internal: not executable by API roles.
create or replace function kafaa_cc_is_enec(p_org text) returns boolean language sql immutable set search_path = public as $$
  select coalesce(p_org = any (array['enec', 'enec-ops', 'enec-com', 'enec-con']), false)
$$;
-- partnerOf(): the partner entry of an organisation in a cohort's partners
create or replace function kafaa_cc_partner(p_partners jsonb, p_org text) returns jsonb language sql immutable set search_path = public as $$
  select x from jsonb_array_elements(case when jsonb_typeof(p_partners) = 'array' then p_partners else '[]'::jsonb end) with ordinality q(x, n) where x ->> 'org_id' = p_org order by n limit 1
$$;
-- consortiumOrg(): the consortium organisation (an ENEC entity maps to the ENEC partner)
create or replace function kafaa_cc_org(p_partners jsonb, p_org text) returns text language sql immutable set search_path = public as $$
  select case when kafaa_cc_partner(p_partners, p_org) is not null then p_org
    when kafaa_cc_is_enec(p_org) then (select x ->> 'org_id' from jsonb_array_elements(case when jsonb_typeof(p_partners) = 'array' then p_partners else '[]'::jsonb end) with ordinality q(x, n)
      where kafaa_cc_is_enec(x ->> 'org_id') order by n limit 1) end
$$;
-- cohortPhase()
create or replace function kafaa_cc_phase(p_nom date, p_start date, p_end date, p_today date) returns text language sql immutable set search_path = public as $$
  select case when p_today <= p_nom then 'nominating' when p_today < p_start then 'confirmed' when p_today <= p_end then 'running' else 'completed' end
$$;
-- traineeCode(): <partner code>-<yy>-<nn>
create or replace function kafaa_cc_code(p_partners jsonb, p_org text, p_year integer, p_n integer) returns text language sql immutable set search_path = public as $$
  select coalesce(kafaa_cc_partner(p_partners, p_org) ->> 'code', 'XX') || '-' || lpad((p_year % 100)::text, 2, '0') || '-' || lpad(p_n::text, 2, '0')
$$;
-- enecTraineeEligible(): active staff at entry level or hired in the last 5 years
create or replace function kafaa_cc_enec_eligible(p_person text, p_today date) returns boolean language plpgsql stable security definer set search_path = public as $$
declare pp kafaa_people;
begin
  if p_person is null then return false; end if;
  select * into pp from kafaa_people where id = p_person;
  if pp.id is null or pp.kind <> 'staff' or pp.status <> 'active' then return false; end if;
  if pp.level is not distinct from 'entry' then return true; end if;
  return pp.hire_date is not null and to_char(pp.hire_date, 'YYYY-MM-DD') > ((extract(year from p_today)::integer - 5)::text || to_char(p_today, '-MM-DD'));
end $$;
-- nominationProblem(): open for nominations; the organisation rule; a discipline; the person rule; no duplicate; seats
create or replace function kafaa_cc_nom_problem(p jsonb, p_cohort kafaa_consortium_cohorts, p_org text, p_by_hr boolean, p_active integer, p_dup boolean, p_today date) returns text language plpgsql stable security definer set search_path = public as $$
declare pt jsonb; v_pid text;
begin
  if kafaa_cc_phase(p_cohort.nominations_close_on, p_cohort.starts_on, p_cohort.ends_on, p_today) <> 'nominating' then return 'phase'; end if;
  pt := kafaa_cc_partner(p_cohort.partners, p_org);
  if pt is null or (p_by_hr and not kafaa_cc_is_enec(pt ->> 'org_id') and coalesce((pt ->> 'kafaa_access')::boolean, false)) or (not p_by_hr and kafaa_cc_is_enec(pt ->> 'org_id')) then return 'org'; end if;
  if p is null or jsonb_typeof(p -> 'discipline') is distinct from 'string' or p ->> 'discipline' not in ('mechanical', 'electrical', 'chemical', 'operations', 'instrumentation', 'environmental', 'digital') then return 'discipline'; end if;
  v_pid := case when jsonb_typeof(p -> 'person_id') = 'string' and p ->> 'person_id' <> '' then p ->> 'person_id' end;
  if kafaa_cc_is_enec(pt ->> 'org_id') then
    if not kafaa_cc_enec_eligible(v_pid, p_today) or v_pid is null then return 'person'; end if;
  elsif v_pid is not null then return 'person'; end if;
  if p_dup then return 'duplicate'; end if;
  if p_active >= (pt ->> 'seats')::numeric then return 'seats'; end if;
  return null;
end $$;
-- memberDecisionProblem(): accept with a mentor of another consortium organisation and a team; decline with a note
create or replace function kafaa_cc_decision_problem(p jsonb, p_member_org text, p_cohort kafaa_consortium_cohorts) returns text language plpgsql immutable set search_path = public as $$
declare v_note text; mt jsonb;
begin
  if p is null or jsonb_typeof(p -> 'decision') is distinct from 'string' or p ->> 'decision' not in ('accept', 'decline') then return 'decision'; end if;
  v_note := kafaa_rg_txt(p -> 'note');
  if p ->> 'decision' = 'decline' then return case when length(v_note) < 5 or length(v_note) > 300 then 'note' end; end if;
  select x into mt from jsonb_array_elements(case when jsonb_typeof(p_cohort.mentors) = 'array' then p_cohort.mentors else '[]'::jsonb end) x
   where jsonb_typeof(p -> 'mentor_id') = 'string' and x ->> 'id' = p ->> 'mentor_id' limit 1;
  if mt is null or kafaa_cc_org(p_cohort.partners, mt ->> 'org_id') is not distinct from kafaa_cc_org(p_cohort.partners, p_member_org) then return 'mentor'; end if;
  if jsonb_typeof(p -> 'team') is distinct from 'string' or p ->> 'team' not in ('A', 'B', 'C', 'D') then return 'team'; end if;
  if length(v_note) > 300 then return 'note'; end if;
  return null;
end $$;
-- visitProblem(): an accepted member; a cohort host; another organisation; the date window; hours; the module; the note
create or replace function kafaa_cc_visit_problem(p jsonb, p_cohort kafaa_consortium_cohorts, p_member kafaa_consortium_members, p_today date) returns text language plpgsql immutable set search_path = public as $$
declare v_on date; v_h numeric; v_note text; md jsonb;
begin
  if p_member.id is null or p_member.status <> 'accepted' or p_member.cohort_id <> p_cohort.id then return 'member'; end if;
  if p is null or jsonb_typeof(p -> 'host_org_id') is distinct from 'string' or kafaa_cc_partner(p_cohort.partners, p ->> 'host_org_id') is null then return 'host'; end if;
  if kafaa_cc_org(p_cohort.partners, p ->> 'host_org_id') is not distinct from kafaa_cc_org(p_cohort.partners, p_member.org_id) then return 'same_org'; end if;
  if jsonb_typeof(p -> 'visit_on') is distinct from 'string' or not kafaa_w5_is_date(p ->> 'visit_on') then return 'date'; end if;
  v_on := (p ->> 'visit_on')::date;
  if v_on < p_cohort.starts_on or v_on > p_cohort.ends_on or v_on > p_today or p_today - v_on > 120 then return 'date'; end if;
  if jsonb_typeof(p -> 'hours') is distinct from 'number' then return 'hours'; end if;
  v_h := (p ->> 'hours')::numeric;
  if v_h < 1 or v_h > 40 or v_h * 2 <> floor(v_h * 2) then return 'hours'; end if;
  if coalesce(jsonb_typeof(p -> 'module_id'), 'null') <> 'null' and coalesce(p ->> 'module_id', '') <> '' then
    select x into md from jsonb_array_elements(case when jsonb_typeof(p_cohort.modules) = 'array' then p_cohort.modules else '[]'::jsonb end) x where x ->> 'id' = p ->> 'module_id' limit 1;
    if md is null or md ->> 'host_org_id' is distinct from p ->> 'host_org_id' then return 'module'; end if;
  end if;
  if coalesce(jsonb_typeof(p -> 'note'), 'null') = 'null' then v_note := '';
  elsif jsonb_typeof(p -> 'note') = 'string' then v_note := p ->> 'note';
  else return 'note'; end if;
  if length(btrim(v_note, E' \t\n\r')) > 300 or kafaa_res_contact(v_note) then return 'note'; end if;
  return null;
end $$;
-- visitLevel(): 2 from the second confirmed visit to the same host with 12+ hours there, else 1
create or replace function kafaa_cc_level(p_member text, p_visit text, p_host text, p_hours numeric) returns integer language plpgsql stable security definer set search_path = public as $$
declare n integer; h numeric;
begin
  select count(*) + 1, coalesce(sum(v.hours), 0) + p_hours into n, h from kafaa_consortium_visits v
   where v.member_id = p_member and v.status = 'confirmed' and v.id <> p_visit and v.host_org_id = p_host;
  return case when n >= 2 and h >= 12 then 2 else 1 end;
end $$;
-- confirmRoute(): host administrator (OrgW, own organisation) when the host has Kafa'a access; ENEC programme office for ENEC sites;
-- the programme office on behalf of a host without access
create or replace function kafaa_cc_route(p_partners jsonb, p_host text, p_org text, p_orgw boolean, p_hr boolean) returns text language sql immutable set search_path = public as $$
  select case when kafaa_cc_partner(p_partners, p_host) is null then null
    when kafaa_cc_is_enec(p_host) then case when p_hr then 'enec_host' end
    when coalesce((kafaa_cc_partner(p_partners, p_host) ->> 'kafaa_access')::boolean, false) then case when p_orgw and p_org = p_host then 'host' end
    else case when p_hr then 'on_behalf' end end
$$;
-- consortiumStats(): cohorts by start date; counts of 1-9 suppressed; confirmed hours only with 10+ confirmed visits
create or replace function kafaa_cc_stats(p_today date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
      'cohort_id', c.id, 'phase', kafaa_cc_phase(c.nominations_close_on, c.starts_on, c.ends_on, p_today),
      'trainees', kafaa_gr_cell(m.tr), 'nominated', kafaa_gr_cell(m.nom), 'organisations', jsonb_array_length(c.partners),
      'by_org', (select coalesce(jsonb_agg(jsonb_build_object('org_id', x ->> 'org_id', 'trainees', kafaa_gr_cell((select count(*) from kafaa_consortium_members mm
          where mm.cohort_id = c.id and mm.status in ('accepted', 'completed') and kafaa_cc_org(c.partners, mm.org_id) = x ->> 'org_id'))) order by n), '[]'::jsonb)
        from jsonb_array_elements(c.partners) with ordinality q(x, n)),
      'visits_confirmed', kafaa_gr_cell(s.conf), 'visits_waiting', kafaa_gr_cell(s.logged), 'hours_confirmed', case when s.conf >= 10 then to_jsonb(s.hrs) else 'null'::jsonb end,
      'by_host', (select coalesce(jsonb_agg(jsonb_build_object('org_id', x ->> 'org_id', 'confirmed', kafaa_gr_cell((select count(*) from kafaa_consortium_visits vv
          where vv.cohort_id = c.id and vv.status = 'confirmed' and vv.host_org_id = x ->> 'org_id'))) order by n), '[]'::jsonb)
        from jsonb_array_elements(c.partners) with ordinality q(x, n)),
      'evidence_rows', kafaa_gr_cell(s.ev)) order by c.starts_on), '[]'::jsonb)
    into v
    from kafaa_consortium_cohorts c
    cross join lateral (select count(*) filter (where mm.status in ('accepted', 'completed')) tr, count(*) filter (where mm.status = 'nominated') nom from kafaa_consortium_members mm where mm.cohort_id = c.id) m
    cross join lateral (select count(*) filter (where vv.status = 'confirmed') conf, count(*) filter (where vv.status = 'logged') logged,
        coalesce(sum(vv.hours) filter (where vv.status = 'confirmed'), 0) hrs, count(*) filter (where vv.status = 'confirmed' and vv.profile_evidence) ev
      from kafaa_consortium_visits vv where vv.cohort_id = c.id) s;
  return jsonb_build_object('as_of', p_today::text, 'min_group', 10, 'cohorts', v);
end $$;

-- ═════════════ FS83 RPCs
-- A partner administrator (OrgW) nominates a pseudonymous trainee of their own organisation; HR nominates ENEC staff trainees and, on the
-- partner's behalf, trainees of partners without Kafa'a access; audited
create or replace function kafaa_nominate_consortium_trainee(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_cid text := coalesce(p ->> 'cohort_id', ''); v_mine text := kafaa_my_org(); v_orgw boolean; v_hr boolean; c kafaa_consortium_cohorts;
  v_given text; v_org text; v_pid text; v_problem text; v_active integer; v_dup boolean; n integer; v_code text; v_id text; v_morg text; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('consortium.nominate', 'consortium_members', nullif(v_cid, ''), 'not_signed_in', 'Sign in to use the consortium cohort'); end if;
  v_orgw := v_mine is not null and kafaa_has_grant('ecosystem', array['OrgW']);
  v_hr := kafaa_has_grant('ecosystem', array['W', 'A']) and kafaa_has_grant('workforce_strategy', array['W', 'A']);
  if not v_orgw and not v_hr then return kafaa_refuse('consortium.nominate', 'consortium_members', nullif(v_cid, ''), 'forbidden', 'Only a consortium partner''s administrator (own trainees) or HR (ENEC trainees) nominates'); end if;
  v_role := case when v_orgw then kafaa_acting_role('ecosystem', array['OrgW']) else kafaa_acting_role('workforce_strategy', array['W', 'A']) end;
  select * into c from kafaa_consortium_cohorts where id = v_cid;
  if c.id is null then return kafaa_refuse('consortium.nominate', 'consortium_members', nullif(v_cid, ''), 'not_found', 'Cohort not found', v_role); end if;
  v_given := case when jsonb_typeof(p -> 'org_id') = 'string' and p ->> 'org_id' <> '' then p ->> 'org_id' end;
  v_org := case when v_orgw then case when v_given is not null and v_given <> v_mine then null else v_mine end
    when v_given is not null then kafaa_cc_org(c.partners, v_given) else kafaa_cc_org(c.partners, 'enec') end;
  v_pid := case when jsonb_typeof(p -> 'person_id') = 'string' and p ->> 'person_id' <> '' then p ->> 'person_id' end;
  select count(*) into v_active from kafaa_consortium_members m where m.cohort_id = v_cid and kafaa_cc_org(c.partners, m.org_id) is not distinct from v_org and m.status in ('nominated', 'accepted');
  v_dup := v_pid is not null and exists (select 1 from kafaa_consortium_members m where m.cohort_id = v_cid and m.person_id = v_pid and m.status in ('nominated', 'accepted'));
  v_problem := kafaa_cc_nom_problem(p, c, v_org, not v_orgw, v_active, v_dup, current_date);
  if v_problem is not null then return kafaa_refuse('consortium.nominate', 'consortium_members', v_cid, 'invalid', 'Check the nomination: ' || case v_problem
    when 'phase' then 'nominations for this cohort are closed'
    when 'org' then 'nominate for your own organisation (a partner in this cohort); HR nominates ENEC trainees and trainees of partners without Kafa''a access'
    when 'discipline' then 'choose a discipline'
    when 'person' then 'ENEC trainees are active early-career staff (entry level or hired in the last 5 years); partner trainees carry no person record'
    when 'duplicate' then 'this person already holds a place or a nomination in the cohort' else 'your organisation''s seats in this cohort are taken' end, v_role); end if;
  select count(*) + 1 into n from kafaa_consortium_members m where m.cohort_id = v_cid and kafaa_cc_org(c.partners, m.org_id) = v_org;
  while exists (select 1 from kafaa_consortium_members m where m.cohort_id = v_cid and m.trainee_code = kafaa_cc_code(c.partners, v_org, c.intake_year, n)) loop n := n + 1; end loop;
  v_code := kafaa_cc_code(c.partners, v_org, c.intake_year, n);
  v_id := 'cm-' || v_cid || '-' || lower(v_code);
  v_morg := case when v_pid is not null then coalesce((select pp.org_id from kafaa_people pp where pp.id = v_pid), v_org) else v_org end;
  insert into kafaa_consortium_members (id, cohort_id, org_id, person_id, initials, trainee_code, discipline, status, nominated_by, nominated_at, open_read, sample)
  values (v_id, v_cid, v_morg, v_pid, (select pp.initials from kafaa_people pp where pp.id = v_pid), v_code, p ->> 'discipline', 'nominated', me, now(), false, false);
  a := kafaa_audit('consortium.nominate', 'consortium_members', v_id, 'ok', v_org || ' ' || (p ->> 'discipline') || coalesce(' ' || v_pid, ''), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Nomination recorded', a, null, jsonb_build_object('id', v_id, 'trainee_code', v_code));
end $$;

-- The HR director accepts (mentor from another consortium organisation + project team) or declines with a note; audit + ledger
create or replace function kafaa_decide_consortium_member(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_mid text := coalesce(p ->> 'member_id', ''); m kafaa_consortium_members; c kafaa_consortium_cohorts; v_problem text; v_accept boolean; v_note text;
  a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('consortium.member.decide', 'consortium_members', nullif(v_mid, ''), 'not_signed_in', 'Sign in to use the consortium cohort'); end if;
  if not (kafaa_has_grant('ecosystem', array['A']) and kafaa_has_grant('workforce_strategy', array['W', 'A'])) then
    return kafaa_refuse('consortium.member.decide', 'consortium_members', nullif(v_mid, ''), 'forbidden', 'Only the HR director decides consortium places'); end if;
  v_role := kafaa_acting_role('ecosystem', array['A']);
  select * into m from kafaa_consortium_members where id = v_mid;
  if m.id is null then return kafaa_refuse('consortium.member.decide', 'consortium_members', nullif(v_mid, ''), 'not_found', 'Trainee not found', v_role); end if;
  if m.status <> 'nominated' then return kafaa_refuse('consortium.member.decide', 'consortium_members', v_mid, 'decided', 'This nomination is already decided', v_role); end if;
  if m.person_id is not null and m.person_id = me then return kafaa_refuse('consortium.member.decide', 'consortium_members', v_mid, 'maker_checker', 'You cannot decide your own place', v_role); end if;
  select * into c from kafaa_consortium_cohorts where id = m.cohort_id;
  v_problem := kafaa_cc_decision_problem(p, m.org_id, c);
  if v_problem is not null then return kafaa_refuse('consortium.member.decide', 'consortium_members', v_mid, 'invalid', 'Check the decision: ' || case v_problem
    when 'decision' then 'choose accept or decline' when 'mentor' then 'choose a mentor from another consortium organisation' when 'team' then 'choose a project team from A to D'
    else 'a note of 5 to 300 characters when declining (up to 300 otherwise)' end, v_role); end if;
  v_accept := p ->> 'decision' = 'accept';
  v_note := kafaa_rg_txt(p -> 'note');
  update kafaa_consortium_members set status = case when v_accept then 'accepted' else 'declined' end, decided_by = me, decided_at = now(), decision_note = nullif(v_note, ''),
    mentor_id = case when v_accept then p ->> 'mentor_id' end, team = case when v_accept then p ->> 'team' end where id = v_mid;
  perform kafaa_w5_notify('nt-cc-' || v_mid || '-decided', m.person_id, 'consortium', case when v_accept then 'Your consortium trainee place is confirmed' else 'Your consortium nomination was not accepted' end,
    case when v_accept then 'تم تأكيد مقعدك في دفعة المتدربين المشتركة' else 'لم يتم قبول ترشيحك لدفعة المتدربين المشتركة' end, '/my/consortium', case when v_accept then 'ok' else 'warn' end);
  l := kafaa_ledger('kafaa.consortium.member', 'Consortium place ' || m.trainee_code || ' ' || case when v_accept then 'accepted' else 'declined' end);
  a := kafaa_audit('consortium.member.decide', 'consortium_members', v_mid, 'ok', case when v_accept then 'accepted mentor ' || (p ->> 'mentor_id') || ' team ' || (p ->> 'team') else 'declined: ' || v_note end,
    case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when v_accept then 'Place confirmed' else 'Nomination declined' end, a, l, jsonb_build_object('id', v_mid, 'status', case when v_accept then 'accepted' else 'declined' end));
end $$;

-- The trainee, their employer's administrator or the programme office logs a cross-site visit; audited
create or replace function kafaa_log_consortium_visit(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_mid text := coalesce(p ->> 'member_id', ''); v_mine text := kafaa_my_org(); v_own boolean; v_orgw boolean; v_hr boolean; v_self boolean; v_emp boolean;
  v_via text; m kafaa_consortium_members; c kafaa_consortium_cohorts; v_problem text; v_id text; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('consortium.visit.log', 'consortium_visits', null, 'not_signed_in', 'Sign in to use the consortium cohort'); end if;
  v_own := kafaa_has_grant('ecosystem', array['Own']);
  v_orgw := v_mine is not null and kafaa_has_grant('ecosystem', array['OrgW']);
  v_hr := kafaa_has_grant('ecosystem', array['W', 'A']) and kafaa_has_grant('workforce_strategy', array['W', 'A']);
  if not v_own and not v_orgw and not v_hr then return kafaa_refuse('consortium.visit.log', 'consortium_visits', null, 'forbidden', 'Only the trainee, their employer''s administrator or the programme office logs a visit'); end if;
  select * into m from kafaa_consortium_members where id = v_mid;
  v_self := m.id is not null and m.person_id is not null and m.person_id = me and v_own;
  v_emp := m.id is not null and v_orgw and m.org_id = v_mine;
  if m.id is null or (not v_self and not v_emp and not v_hr) then return kafaa_refuse('consortium.visit.log', 'consortium_visits', null, 'not_found', 'Trainee not found'); end if;
  v_via := case when v_self then 'self' when v_emp then 'employer' else 'programme' end;
  v_role := case when v_self then kafaa_acting_role('ecosystem', array['Own']) when v_emp then kafaa_acting_role('ecosystem', array['OrgW']) else kafaa_acting_role('workforce_strategy', array['W', 'A']) end;
  select * into c from kafaa_consortium_cohorts where id = m.cohort_id;
  v_problem := kafaa_cc_visit_problem(p, c, m, current_date);
  if v_problem is not null then return kafaa_refuse('consortium.visit.log', 'consortium_visits', null, 'invalid', 'Check the visit: ' || case v_problem
    when 'member' then 'the trainee must hold an accepted place in this cohort' when 'host' then 'choose a host organisation of the cohort'
    when 'same_org' then 'a cross-site visit is to another consortium organisation, not the trainee''s own' when 'date' then 'a date within the cohort, not in the future and in the last 120 days'
    when 'hours' then '1 to 40 hours in half-hour steps' when 'module' then 'choose a module hosted by that organisation, or none' else 'a note of up to 300 characters without contact details' end, v_role); end if;
  v_id := 'cv-' || kafaa_w5_hex(12);
  insert into kafaa_consortium_visits (id, cohort_id, member_id, org_id, person_id, trainee_code, host_org_id, module_id, visit_on, hours, note, skill_id, status, logged_by, logged_via,
    level, evidence, profile_evidence, created_at, open_read, sample)
  values (v_id, c.id, v_mid, m.org_id, m.person_id, m.trainee_code, p ->> 'host_org_id', nullif(case when jsonb_typeof(p -> 'module_id') = 'string' then p ->> 'module_id' end, ''), (p ->> 'visit_on')::date,
    (p ->> 'hours')::numeric, kafaa_rg_txt(p -> 'note'), kafaa_cc_partner(c.partners, p ->> 'host_org_id') ->> 'visit_skill', 'logged', me, v_via, 0, '[]'::jsonb, false, now(), false, false);
  a := kafaa_audit('consortium.visit.log', 'consortium_visits', v_id, 'ok', m.trainee_code || ' at ' || (p ->> 'host_org_id') || ' ' || ((p ->> 'hours')::numeric)::text || 'h (' || v_via || ')', 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Visit logged; the host will confirm it', a, null, jsonb_build_object('id', v_id, 'status', 'logged'));
end $$;

-- Only the host confirms or declines; never the visitor or whoever logged it; a confirmation writes evidence; audit + ledger on confirm
create or replace function kafaa_confirm_consortium_visit(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_vid text := coalesce(p ->> 'visit_id', ''); v_mine text := kafaa_my_org(); v_orgw boolean; v_hr boolean; v kafaa_consortium_visits; c kafaa_consortium_cohorts;
  v_route text; v_dec text; v_reason text; v_ref text; v_level integer; v_kindp text; v_profile boolean; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('consortium.visit.decide', 'consortium_visits', nullif(v_vid, ''), 'not_signed_in', 'Sign in to use the consortium cohort'); end if;
  v_orgw := v_mine is not null and kafaa_has_grant('ecosystem', array['OrgW']);
  v_hr := kafaa_has_grant('ecosystem', array['W', 'A']) and kafaa_has_grant('workforce_strategy', array['W', 'A']);
  if not v_orgw and not v_hr then return kafaa_refuse('consortium.visit.decide', 'consortium_visits', nullif(v_vid, ''), 'forbidden', 'Only the host organisation confirms this visit'); end if;
  select * into v from kafaa_consortium_visits where id = v_vid;
  if v.id is null then return kafaa_refuse('consortium.visit.decide', 'consortium_visits', nullif(v_vid, ''), 'not_found', 'Visit not found'); end if;
  select * into c from kafaa_consortium_cohorts where id = v.cohort_id;
  v_route := kafaa_cc_route(c.partners, v.host_org_id, v_mine, v_orgw, v_hr);
  if v_route is null then return kafaa_refuse('consortium.visit.decide', 'consortium_visits', v_vid, 'forbidden', 'Only the host organisation confirms this visit'); end if;
  v_role := case when v_route = 'host' then kafaa_acting_role('ecosystem', array['OrgW']) else kafaa_acting_role('workforce_strategy', array['W', 'A']) end;
  if v.person_id = me or v.logged_by = me then return kafaa_refuse('consortium.visit.decide', 'consortium_visits', v_vid, 'maker_checker', 'The visitor or whoever logged the visit cannot confirm it', v_role); end if;
  if v.status <> 'logged' then return kafaa_refuse('consortium.visit.decide', 'consortium_visits', v_vid, 'invalid', 'This visit is already decided', v_role); end if;
  v_dec := case when jsonb_typeof(p -> 'decision') = 'string' then p ->> 'decision' else '' end;
  if v_dec not in ('confirm', 'decline') then return kafaa_refuse('consortium.visit.decide', 'consortium_visits', v_vid, 'invalid', 'Choose confirm or decline', v_role); end if;
  if v_dec = 'decline' then
    v_reason := kafaa_rg_txt(p -> 'reason');
    if length(v_reason) < 5 or length(v_reason) > 300 then return kafaa_refuse('consortium.visit.decide', 'consortium_visits', v_vid, 'invalid', 'Give a reason (5 to 300 characters) when you decline', v_role); end if;
    update kafaa_consortium_visits set status = 'declined', decided_by = me, decided_at = now(), decline_reason = v_reason, confirmed_via = v_route where id = v_vid;
    perform kafaa_w5_notify('nt-cv-' || v_vid || '-declined', v.person_id, 'consortium', 'Your consortium visit was not confirmed by the host', 'لم تؤكد الجهة المضيفة زيارتك ضمن الدفعة المشتركة', '/my/consortium', 'warn');
    a := kafaa_audit('consortium.visit.decide', 'consortium_visits', v_vid, 'ok', 'declined (' || v_route || ')', 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Visit declined', a, null, jsonb_build_object('id', v_vid, 'status', 'declined', 'level', 0, 'profile_evidence', false));
  end if;
  v_ref := kafaa_rg_txt(p -> 'host_ref');
  if v_route = 'on_behalf' and (length(v_ref) < 3 or length(v_ref) > 80) then
    return kafaa_refuse('consortium.visit.decide', 'consortium_visits', v_vid, 'invalid', 'Record the host''s written confirmation reference (3 to 80 characters)', v_role); end if;
  v_level := kafaa_cc_level(v.member_id, v_vid, v.host_org_id, v.hours);
  select pp.kind into v_kindp from kafaa_people pp where pp.id = v.person_id;
  v_profile := v.person_id is not null and v_kindp is not distinct from 'staff';
  if v_profile then
    insert into kafaa_skill_evidence (id, person_id, skill_id, kind, ref_table, ref_id, level, basis, status, observed_on, note, recorded_by, active)
    values ('se:ojt:' || v_vid || ':' || v.skill_id, v.person_id, v.skill_id, 'ojt', 'consortium_visits', v_vid, v_level, 'validated', 'current', v.visit_on, 'Consortium cross-site visit confirmed by the host', me, true)
    on conflict (id) do nothing;
  end if;
  update kafaa_consortium_visits set status = 'confirmed', decided_by = me, decided_at = now(), confirmed_via = v_route, host_ref = case when v_route = 'on_behalf' then v_ref else nullif(v_ref, '') end,
    level = v_level, evidence = jsonb_build_array(jsonb_build_object('skill_id', v.skill_id, 'level', v_level)), profile_evidence = v_profile where id = v_vid;
  if v_profile then perform kafaa_skills_apply(v.person_id, current_date); end if;
  perform kafaa_w5_notify('nt-cv-' || v_vid || '-confirmed', v.person_id, 'consortium', 'Your consortium visit was confirmed by the host', 'أكدت الجهة المضيفة زيارتك ضمن الدفعة المشتركة', '/my/consortium', 'ok');
  l := kafaa_ledger('kafaa.consortium.visit_confirm', 'Consortium visit ' || v_vid || ' confirmed by the host (level ' || v_level || ')');
  a := kafaa_audit('consortium.visit.decide', 'consortium_visits', v_vid, 'ok', 'confirmed L' || v_level || ' (' || v_route || ')', case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Visit confirmed', a, l, jsonb_build_object('id', v_vid, 'status', 'confirmed', 'level', v_level, 'profile_evidence', v_profile));
end $$;

-- The trainee or whoever logged it withdraws a visit still waiting for the host; audited
create or replace function kafaa_withdraw_consortium_visit(p_id text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_vid text := coalesce(p_id, ''); v kafaa_consortium_visits; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('consortium.visit.withdraw', 'consortium_visits', nullif(v_vid, ''), 'not_signed_in', 'Sign in to use the consortium cohort'); end if;
  select * into v from kafaa_consortium_visits where id = v_vid;
  if v.id is null then return kafaa_refuse('consortium.visit.withdraw', 'consortium_visits', nullif(v_vid, ''), 'not_found', 'Visit not found'); end if;
  if v.person_id is distinct from me and v.logged_by <> me then return kafaa_refuse('consortium.visit.withdraw', 'consortium_visits', v_vid, 'forbidden', 'Only the trainee or whoever logged the visit withdraws it'); end if;
  if v.status <> 'logged' then return kafaa_refuse('consortium.visit.withdraw', 'consortium_visits', v_vid, 'invalid', 'This visit is already decided'); end if;
  update kafaa_consortium_visits set status = 'withdrawn' where id = v_vid;
  a := kafaa_audit('consortium.visit.withdraw', 'consortium_visits', v_vid, 'ok', 'withdrawn', 'not_applicable', null, null);
  return kafaa_result(true, 'ok', 'Visit withdrawn', a, null, jsonb_build_object('id', v_vid, 'status', 'withdrawn'));
end $$;

-- The visits my organisation hosts (programme office: ENEC sites and hosts without Kafa'a access), as the host sees them: trainee code,
-- visiting organisation, date, hours; never a member row or a person. Read-only; a refusal is audited.
create or replace function kafaa_consortium_host_visits() returns jsonb language plpgsql security definer set search_path = public as $$
declare v_mine text := kafaa_my_org(); v_orgw boolean; v_hr boolean; v jsonb;
begin
  if kafaa_me() is null then return kafaa_refuse('consortium.host_visits', 'consortium_visits', null, 'not_signed_in', 'Sign in to use the consortium cohort'); end if;
  v_orgw := v_mine is not null and kafaa_has_grant('ecosystem', array['OrgW']);
  v_hr := kafaa_has_grant('ecosystem', array['W', 'A']) and kafaa_has_grant('workforce_strategy', array['W', 'A']);
  if not v_orgw and not v_hr then return kafaa_refuse('consortium.host_visits', 'consortium_visits', null, 'forbidden', 'Only the host organisation confirms this visit'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'cohort_id', x.cohort_id, 'trainee_code', x.trainee_code, 'org_id', x.org_id, 'org_name_en', coalesce(o.name_en, x.org_id),
      'org_name_ar', coalesce(o.name_ar, o.name_en, x.org_id), 'host_org_id', x.host_org_id, 'module_id', x.module_id, 'visit_on', x.visit_on::text, 'hours', x.hours, 'note', x.note,
      'skill_id', x.skill_id, 'status', x.status, 'level', x.level, 'confirmed_via', x.confirmed_via, 'route', x.route) order by x.visit_on desc, x.id collate "C"), '[]'::jsonb)
    into v
    from (select vv.*, kafaa_cc_route(c.partners, vv.host_org_id, v_mine, v_orgw, v_hr) route from kafaa_consortium_visits vv join kafaa_consortium_cohorts c on c.id = vv.cohort_id) x
    left join kafaa_organisations o on o.id = x.org_id
   where x.route is not null;
  return jsonb_build_object('ok', true, 'code', 'ok', 'message', 'Visits to confirm as host', 'audit_seq', null, 'ledger_seq', null, 'data', v);
end $$;

-- Cohort aggregates for every ecosystem reader; counts of 1-9 suppressed. Read-only; a refusal is audited.
create or replace function kafaa_consortium_stats() returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if kafaa_me() is null then return kafaa_refuse('consortium.stats', 'consortium_members', null, 'not_signed_in', 'Sign in to use the consortium cohort'); end if;
  if not kafaa_has_grant('ecosystem', array['R', 'Own', 'OwnOrg', 'OrgW', 'Agg', 'W', 'A']) then
    return kafaa_refuse('consortium.stats', 'consortium_members', null, 'forbidden', 'Consortium figures are for ENEC staff, partners, universities, HR and auditors'); end if;
  return jsonb_build_object('ok', true, 'code', 'ok', 'message', 'Consortium figures', 'audit_seq', null, 'ledger_seq', null, 'data', kafaa_cc_stats(current_date));
end $$;

-- ───────────── Grants: internal helpers are not executable by API roles; the fourteen RPCs only by signed-in users.
revoke all on function kafaa_gr_next_deadline(date), kafaa_gr_slot(date, date), kafaa_gr_phase(date, date, date), kafaa_gr_schedule_problem(jsonb, date), kafaa_gr_full_years(date, date),
  kafaa_gr_eligibility(text, date, boolean), kafaa_gr_cost_total(jsonb), kafaa_gr_app_problem(jsonb, date, integer), kafaa_gr_decision_problem(jsonb, integer, date, date, integer, integer, integer, date),
  kafaa_gr_output_problem(jsonb, date, date), kafaa_gr_cell(bigint), kafaa_gr_rate(bigint, bigint), kafaa_gr_stats(date),
  kafaa_cc_is_enec(text), kafaa_cc_partner(jsonb, text), kafaa_cc_org(jsonb, text), kafaa_cc_phase(date, date, date, date), kafaa_cc_code(jsonb, text, integer, integer), kafaa_cc_enec_eligible(text, date),
  kafaa_cc_nom_problem(jsonb, kafaa_consortium_cohorts, text, boolean, integer, boolean, date), kafaa_cc_decision_problem(jsonb, text, kafaa_consortium_cohorts),
  kafaa_cc_visit_problem(jsonb, kafaa_consortium_cohorts, kafaa_consortium_members, date), kafaa_cc_level(text, text, text, numeric), kafaa_cc_route(jsonb, text, text, boolean, boolean),
  kafaa_cc_stats(date) from public, anon, authenticated;
revoke all on function kafaa_schedule_grant_round(jsonb), kafaa_apply_grant(jsonb), kafaa_withdraw_grant(text), kafaa_decide_grant(jsonb), kafaa_submit_grant_output(jsonb),
  kafaa_review_grant_output(jsonb), kafaa_grant_stats(), kafaa_nominate_consortium_trainee(jsonb), kafaa_decide_consortium_member(jsonb), kafaa_log_consortium_visit(jsonb),
  kafaa_confirm_consortium_visit(jsonb), kafaa_withdraw_consortium_visit(text), kafaa_consortium_host_visits(), kafaa_consortium_stats() from public, anon;
grant execute on function kafaa_schedule_grant_round(jsonb), kafaa_apply_grant(jsonb), kafaa_withdraw_grant(text), kafaa_decide_grant(jsonb), kafaa_submit_grant_output(jsonb),
  kafaa_review_grant_output(jsonb), kafaa_grant_stats(), kafaa_nominate_consortium_trainee(jsonb), kafaa_decide_consortium_member(jsonb), kafaa_log_consortium_visit(jsonb),
  kafaa_confirm_consortium_visit(jsonb), kafaa_withdraw_consortium_visit(text), kafaa_consortium_host_visits(), kafaa_consortium_stats() to authenticated;
