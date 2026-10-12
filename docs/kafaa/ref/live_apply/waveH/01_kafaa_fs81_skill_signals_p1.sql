-- kafaa_fs81_skill_signals_p1 (1/2) · from supabase/migrations/20261010281001_kafaa_fs81_skill_signals.sql
-- Apply with apply_migration name "kafaa_fs81_skill_signals_p1". Additive and idempotent; kafaa_* objects only.
-- [FS wave H · E1 · FS70 + FS71 + FS72] Skills Intelligence (M28): ENEC Skills on the Rise with the annual manager pulse, hot
-- technologies with in-demand badges, and "Skills you may have" suggestions (SIMULATED demo data; synthetic people only).
-- FS70: kafaa_skill_signal_runs + kafaa_skill_signals (the published quarterly list: one run per ended quarter, kept and never
--   recomputed; rows = the listed skills with the three signals, suppressed under 10, the signals that moved them, job families and
--   reasons) and kafaa_manager_pulse (annual manager answers, own rows only; HR reads aggregates through kafaa_manager_pulse_summary).
--   kafaa_rs_compute = risingSkills, kafaa_rs_counts = signalCounts, kafaa_mp_summary = pulseSummary (src/modules/m28/signals.ts).
--   FS75 (digest, same wave) reads kafaa_skill_signals as a data-only coupling: the latest run, rows whose families contain mine.
-- FS71: kafaa_technologies (generic tags; a vendor or product brand is refused by kafaa_ht_problem = techProblem, deny-list
--   kafaa_ht_brand_hits = brandHits), kafaa_technology_links (tags on opportunities and role-profile versions) and kafaa_technology_badges
--   (published per ended quarter and kept). kafaa_ht_compute = technologyBadges (src/modules/m28/technologies.ts).
-- FS72: kafaa_skill_suggestions (own rows only: never a manager, never Scope) and kafaa_skill_suggestion_fairness (the surface's FS55
--   fairness snapshot, aggregates only, F24 group rules through kafaa_fairness_base / kafaa_fairness_rows). kafaa_ssg_candidates =
--   inferSuggestions (src/modules/m28/suggestions.ts). Confirming writes the person's own claimed evidence (kind rating, basis claimed,
--   ref_table skill_suggestions: rating is a recorded kind, so kafaa_skill_states_v2 / kafaa_skills_apply keep it without a
--   redefinition) and runs kafaa_skills_apply; a rejection or "not me" hides the skill for 180 days (check constraint).
--   The engine card "skill_suggestions" is inserted below (on conflict do nothing).
-- RPCs (TS + local + SQL SECURITY DEFINER + supabase map; authenticated only; kafaa_rs_* / kafaa_mp_* / kafaa_ht_* / kafaa_ssg_* /
--   kafaa_fs81_* helpers executable by no API role): kafaa_compute_skill_signals, kafaa_publish_skill_signals (ledger),
--   kafaa_submit_manager_pulse, kafaa_manager_pulse_summary, kafaa_save_technology, kafaa_tag_technology, kafaa_compute_technology_badges,
--   kafaa_publish_technology_badges (ledger), kafaa_refresh_skill_suggestions, kafaa_respond_suggestion, kafaa_run_suggestion_fairness
--   (ledger), kafaa_suggestion_stats.
-- RBAC (CONTRACT changelog): runs, signals, technologies, links and badges are read by staff (internal_content R); publishing the list is
--   workforce_strategy W/A; the pulse is answered with transformation Scope (line managers) and summarised for workforce_strategy
--   Agg/R/W/A or transformation Agg; tags and badges are frameworks W/A; suggestions are own_profile Own only (skills_profile Own to
--   refresh and answer); the fairness table is integrations R/A and skills_profile Agg (like kafaa_surface_fairness).
-- PGlite parity and checks: scripts/validate/fs81-skill-signals.mjs. Tests: tests/unit/fs81-*. Seed: scripts/seed/ext/fs70-skill-signals.mjs.
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects; never removes any object or row. No shared function is
-- redefined (kafaa_skills_apply, kafaa_fairness_base, kafaa_fairness_rows are only called). Self-contained for the live project: the same
-- DDL as the generated 20261008120100 schema file; RLS in the per-statement (perf) form.

-- ───────────── Tables (generated DDL, additive)
-- M28 · Published quarterly ENEC Skills on the Rise list: quarter, method version, counts; kept once published, never recomputed (FS70)
create table if not exists kafaa_skill_signal_runs (
  id text primary key,
  quarter text not null unique,
  method text not null,
  status text not null default 'published' check (status in ('published')),
  counts jsonb not null default '{}'::jsonb,
  published_by text not null,
  published_role text,
  published_at timestamptz not null default now(),
  summary_en text not null default '',
  summary_ar text not null default ''
);
comment on table kafaa_skill_signal_runs is '[M28] Published quarterly ENEC Skills on the Rise list: quarter, method version, counts; kept once published, never recomputed (FS70)';

-- M28 · A skill on a published Skills on the Rise list: category (in demand now or growing), rank, the three signals (suppressed under 10), the signals that moved it, job families and reasons (FS70; FS75 reads it)
create table if not exists kafaa_skill_signals (
  id text primary key,
  run_id text not null,
  quarter text not null,
  skill_id text not null,
  category text not null check (category in ('now', 'growing')),
  rank integer not null,
  score integer not null,
  moved_by text[] not null default '{}'::text[],
  signals jsonb not null default '[]'::jsonb,
  families text[] not null default '{}'::text[],
  reasons jsonb not null default '[]'::jsonb,
  published_at timestamptz not null default now()
);
comment on table kafaa_skill_signals is '[M28] A skill on a published Skills on the Rise list: category (in demand now or growing), rank, the three signals (suppressed under 10), the signals that moved it, job families and reasons (FS70; FS75 reads it)';

-- M28 · Annual manager pulse answer: the share of my team's core skills I expect to change by 2030; own rows only, read by HR as an aggregate (FS70)
create table if not exists kafaa_manager_pulse (
  id text primary key,
  year integer not null,
  person_id text not null,
  family_id text,
  team_size integer,
  share_pct integer not null,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table kafaa_manager_pulse is '[M28] Annual manager pulse answer: the share of my team''s core skills I expect to change by 2030; own rows only, read by HR as an aggregate (FS70)';

-- M28 · Generic technology tag (never a vendor or product brand): name and description EN/AR, category, related skills (FS71)
create table if not exists kafaa_technologies (
  id text primary key,
  name_en text not null,
  name_ar text not null,
  description_en text not null,
  description_ar text not null,
  category text not null check (category in ('plant_data', 'analytics', 'automation', 'digital_twin', 'inspection', 'work_management', 'ai_tools', 'simulation')),
  skill_ids text[] not null default '{}'::text[],
  status text not null default 'active' check (status in ('active', 'retired')),
  version integer not null default 1,
  created_by text,
  created_at timestamptz not null default now(),
  updated_by text,
  updated_at timestamptz not null default now(),
  sort integer not null default 0
);
comment on table kafaa_technologies is '[M28] Generic technology tag (never a vendor or product brand): name and description EN/AR, category, related skills (FS71)';

-- M28 · A technology tag on an opportunity or a role-profile version, with the source's job family, role and date (FS71)
create table if not exists kafaa_technology_links (
  id text primary key,
  technology_id text not null,
  ref_table text not null check (ref_table in ('opportunities', 'role_profile_versions')),
  ref_id text not null,
  family_id text,
  role_id text,
  source_on date not null,
  active boolean not null default true,
  linked_by text,
  linked_at timestamptz not null default now()
);
comment on table kafaa_technology_links is '[M28] A technology tag on an opportunity or a role-profile version, with the source''s job family, role and date (FS71)';

-- M28 · Published quarterly technology badge: hot across ENEC or in demand for a role, with the counts behind it; past quarters kept (FS71)
create table if not exists kafaa_technology_badges (
  id text primary key,
  quarter text not null,
  technology_id text not null,
  scope text not null check (scope in ('enec', 'role')),
  role_id text,
  rank integer,
  sources integer not null default 0,
  families integer not null default 0,
  recent integer not null default 0,
  via_profile boolean not null default false,
  family_opportunities integer not null default 0,
  criteria text not null,
  published_by text not null,
  published_at timestamptz not null default now()
);
comment on table kafaa_technology_badges is '[M28] Published quarterly technology badge: hot across ENEC or in demand for a role, with the counts behind it; past quarters kept (FS71)';

-- M28 · An inferred skill suggested to me with its sources and reasons; private until I confirm (claimed evidence), reject or mark not me (180 days suppressed) (FS72)
create table if not exists kafaa_skill_suggestions (
  id text primary key,
  person_id text not null,
  skill_id text not null,
  status text not null default 'open' check (status in ('open', 'confirmed', 'rejected', 'not_me', 'expired')),
  level integer not null default 1,
  score integer not null default 0,
  sources text[] not null default '{}'::text[],
  reasons jsonb not null default '[]'::jsonb,
  first_on date not null,
  generated_on date not null,
  responded_on date,
  suppressed_until date,
  evidence_id text,
  history jsonb not null default '[]'::jsonb,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);
comment on table kafaa_skill_suggestions is '[M28] An inferred skill suggested to me with its sources and reasons; private until I confirm (claimed evidence), reject or mark not me (180 days suppressed) (FS72)';

-- M28 · Weekly fairness snapshot of the skill-suggestions surface: people reached by gender and nationality, suppressed below 10, four-fifths flag (FS72; aggregates only)
create table if not exists kafaa_skill_suggestion_fairness (
  id text primary key,
  period text not null,
  as_of date not null,
  card text not null,
  metric text not null,
  dimension text not null check (dimension in ('gender', 'nationality')),
  group_key text not null check (group_key in ('f', 'm', 'uae', 'other')),
  n integer,
  positives integer,
  rate numeric,
  ratio numeric,
  suppressed boolean not null default false,
  flagged boolean not null default false,
  source text not null,
  run_by text,
  created_at timestamptz not null default now()
);
comment on table kafaa_skill_suggestion_fairness is '[M28] Weekly fairness snapshot of the skill-suggestions surface: people reached by gender and nationality, suppressed below 10, four-fifths flag (FS72; aggregates only)';

do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_signals_run_id_fk') then alter table kafaa_skill_signals add constraint kafaa_skill_signals_run_id_fk foreign key (run_id) references kafaa_skill_signal_runs(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_signals_skill_id_fk') then alter table kafaa_skill_signals add constraint kafaa_skill_signals_skill_id_fk foreign key (skill_id) references kafaa_skills(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_manager_pulse_person_id_fk') then alter table kafaa_manager_pulse add constraint kafaa_manager_pulse_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_technology_links_technology_id_fk') then alter table kafaa_technology_links add constraint kafaa_technology_links_technology_id_fk foreign key (technology_id) references kafaa_technologies(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_technology_badges_technology_id_fk') then alter table kafaa_technology_badges add constraint kafaa_technology_badges_technology_id_fk foreign key (technology_id) references kafaa_technologies(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_suggestions_person_id_fk') then alter table kafaa_skill_suggestions add constraint kafaa_skill_suggestions_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_suggestions_skill_id_fk') then alter table kafaa_skill_suggestions add constraint kafaa_skill_suggestions_skill_id_fk foreign key (skill_id) references kafaa_skills(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_skill_signals_run_id_idx on kafaa_skill_signals (run_id);
create index if not exists kafaa_skill_signals_quarter_idx on kafaa_skill_signals (quarter);
create index if not exists kafaa_skill_signals_skill_id_idx on kafaa_skill_signals (skill_id);
create index if not exists kafaa_skill_signals_category_idx on kafaa_skill_signals (category);
create index if not exists kafaa_manager_pulse_year_idx on kafaa_manager_pulse (year);
create index if not exists kafaa_manager_pulse_person_id_idx on kafaa_manager_pulse (person_id);
create index if not exists kafaa_technologies_category_idx on kafaa_technologies (category);
create index if not exists kafaa_technologies_status_idx on kafaa_technologies (status);
create index if not exists kafaa_technology_links_technology_id_idx on kafaa_technology_links (technology_id);
create index if not exists kafaa_technology_links_ref_id_idx on kafaa_technology_links (ref_id);
create index if not exists kafaa_technology_badges_quarter_idx on kafaa_technology_badges (quarter);
create index if not exists kafaa_technology_badges_technology_id_idx on kafaa_technology_badges (technology_id);
create index if not exists kafaa_technology_badges_scope_idx on kafaa_technology_badges (scope);
create index if not exists kafaa_skill_suggestions_person_id_idx on kafaa_skill_suggestions (person_id);
create index if not exists kafaa_skill_suggestions_skill_id_idx on kafaa_skill_suggestions (skill_id);
create index if not exists kafaa_skill_suggestions_status_idx on kafaa_skill_suggestions (status);
create index if not exists kafaa_skill_suggestion_fairness_period_idx on kafaa_skill_suggestion_fairness (period);

-- A published run is kept as published; a confirmed suggestion names its evidence; a rejection or "not me" is hidden for exactly 180
-- days; suggestion levels never above 2 (a claim); pulse answers are whole percentages; a role badge names its role.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_signal_runs_quarter_ck') then
    alter table kafaa_skill_signal_runs add constraint kafaa_skill_signal_runs_quarter_ck check (quarter ~ '^20[0-9]{2}-Q[1-4]$' and id = 'ssr:' || quarter); end if;
  if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_suggestions_level_ck') then
    alter table kafaa_skill_suggestions add constraint kafaa_skill_suggestions_level_ck check (level between 1 and 2 and score between 0 and 100); end if;
  if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_suggestions_confirmed_ck') then
    alter table kafaa_skill_suggestions add constraint kafaa_skill_suggestions_confirmed_ck check (status <> 'confirmed' or (evidence_id is not null and responded_on is not null)); end if;
  if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_suggestions_suppress_ck') then
    alter table kafaa_skill_suggestions add constraint kafaa_skill_suggestions_suppress_ck check (status not in ('rejected', 'not_me') or (responded_on is not null and suppressed_until = responded_on + 180)); end if;
  if not exists (select 1 from pg_constraint where conname = 'kafaa_manager_pulse_share_ck') then
    alter table kafaa_manager_pulse add constraint kafaa_manager_pulse_share_ck check (share_pct between 0 and 100 and (team_size is null or team_size between 1 and 500) and id = 'mp:' || year || ':' || person_id); end if;
  if not exists (select 1 from pg_constraint where conname = 'kafaa_technology_badges_role_ck') then
    alter table kafaa_technology_badges add constraint kafaa_technology_badges_role_ck check ((scope = 'role') = (role_id is not null)); end if;
end $$;

-- ───────────── RLS (per-statement form). Writes only via the RPCs.
alter table kafaa_skill_signal_runs enable row level security;
alter table kafaa_skill_signals enable row level security;
alter table kafaa_manager_pulse enable row level security;
alter table kafaa_technologies enable row level security;
alter table kafaa_technology_links enable row level security;
alter table kafaa_technology_badges enable row level security;
alter table kafaa_skill_suggestions enable row level security;
alter table kafaa_skill_suggestion_fairness enable row level security;
do $$ declare t text; begin
  foreach t in array array['kafaa_skill_signal_runs', 'kafaa_skill_signals', 'kafaa_manager_pulse', 'kafaa_technologies', 'kafaa_technology_links', 'kafaa_technology_badges',
    'kafaa_skill_suggestions', 'kafaa_skill_suggestion_fairness'] loop
    if not exists (select 1 from pg_policies where tablename = t and policyname = 'kafaa_read') then
      execute format('create policy kafaa_read on %I for select to anon, authenticated using (false)', t); end if;
  end loop;
end $$;
alter policy kafaa_read on kafaa_skill_signal_runs using ((SELECT kafaa_has_grant('internal_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text])));
alter policy kafaa_read on kafaa_skill_signals using ((SELECT kafaa_has_grant('internal_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text])));
alter policy kafaa_read on kafaa_technologies using ((SELECT kafaa_has_grant('internal_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text])));
alter policy kafaa_read on kafaa_technology_links using ((SELECT kafaa_has_grant('internal_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text])));
alter policy kafaa_read on kafaa_technology_badges using ((SELECT kafaa_has_grant('internal_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text])));
alter policy kafaa_read on kafaa_manager_pulse using ((((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false))));
alter policy kafaa_read on kafaa_skill_suggestions using ((((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false))));
alter policy kafaa_read on kafaa_skill_suggestion_fairness using (((SELECT kafaa_has_grant('integrations'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR (SELECT kafaa_has_grant('skills_profile'::text, ARRAY['Agg'::text, 'R'::text, 'W'::text, 'A'::text])));
revoke all on kafaa_skill_signal_runs, kafaa_skill_signals, kafaa_manager_pulse, kafaa_technologies, kafaa_technology_links, kafaa_technology_badges, kafaa_skill_suggestions,
  kafaa_skill_suggestion_fairness from anon, authenticated;
grant select on kafaa_skill_signal_runs, kafaa_skill_signals, kafaa_manager_pulse, kafaa_technologies, kafaa_technology_links, kafaa_technology_badges, kafaa_skill_suggestions,
  kafaa_skill_suggestion_fairness to anon, authenticated;

-- ═════════════ Messages (same text as RS_MSG, HT_MSG, SSG_MSG in src/modules/m28/{signals,technologies,suggestions}.ts)
create or replace function kafaa_fs81_msg(p_code text) returns text language sql immutable set search_path = public as $$
  select case p_code
    when 'rs.not_signed_in' then 'Sign in to see ENEC Skills on the Rise'
    when 'rs.forbidden_compute' then 'The signal workbench is for HR, the training manager, admins and auditors'
    when 'rs.forbidden_publish' then 'Only HR analysts and the HR director publish the quarterly list'
    when 'rs.invalid_quarter' then 'Choose a quarter from 2025-Q1 to the current quarter'
    when 'rs.open_quarter' then 'A quarter is published only after it has ended'
    when 'rs.published' then 'This quarter is already published; past lists are kept as they were'
    when 'rs.pulse_forbidden' then 'The manager pulse is answered by line managers'
    when 'rs.pulse_closed' then 'The manager pulse is open from 15 September to 15 December'
    when 'rs.pulse_invalid' then 'Give a whole percentage from 0 to 100 (and a team size from 1 to 500 if you add one)'
    when 'rs.pulse_read_forbidden' then 'Pulse results are aggregates for HR, the training manager, admins and auditors'
    when 'rs.pulse_year' then 'Choose a pulse year from 2025 to the current year'
    when 'ht.not_signed_in' then 'Sign in to see technologies in demand'
    when 'ht.forbidden' then 'Only framework owners (instructors, the training manager and admins) maintain technology tags and badges'
    when 'ht.not_found' then 'Technology not found'
    when 'ht.invalid' then 'Check the technology: '
    when 'ht.source_not_found' then 'Link a technology to an existing opportunity or role-profile version'
    when 'ht.invalid_quarter' then 'Choose a quarter from 2025-Q1 to the current quarter'
    when 'ht.open_quarter' then 'Badges are published only after the quarter has ended'
    when 'ht.published' then 'Badges for this quarter are already published; past lists are kept as they were'
    when 'ht.no_change' then 'Nothing to change'
    when 'ht.p.id' then 'an id like tech-short-name (lowercase letters, digits and hyphens)'
    when 'ht.p.name' then 'a generic name of 3 to 80 characters in English and in Arabic'
    when 'ht.p.description' then 'a description of 20 to 400 characters in English and in Arabic'
    when 'ht.p.brand' then 'generic words only: no vendor or product brand name'
    when 'ht.p.category' then 'choose a category'
    when 'ht.p.skills' then 'up to six catalogue skills, each once'
    when 'ht.p.status' then 'choose active or retired'
    when 'ssg.not_signed_in' then 'Sign in to see skills you may have'
    when 'ssg.forbidden' then 'Skill suggestions are for staff with a skills profile'
    when 'ssg.not_found' then 'Suggestion not found'
    when 'ssg.invalid' then 'Choose confirm, reject or not me'
    when 'ssg.closed' then 'This suggestion is already answered'
    when 'ssg.forbidden_fairness' then 'Only a platform admin or AI governance lead may run the fairness snapshot'
    when 'ssg.invalid_date' then 'Choose a date within the last year'
    when 'ssg.forbidden_stats' then 'Suggestion statistics are aggregates for HR, admins and auditors'
  end
$$;

-- ═════════════ FS70 rules (mirror of src/modules/m28/signals.ts). Internal: not executable by API roles.
-- quarterBounds(): first and last day of a quarter; null when malformed
create or replace function kafaa_rs_bounds(p text) returns jsonb language plpgsql immutable set search_path = public as $$
declare y integer; n integer; s date;
begin
  if coalesce(p, '') !~ '^20[0-9]{2}-Q[1-4]$' then return null; end if;
  y := substr(p, 1, 4)::integer; n := substr(p, 7, 1)::integer;
  s := make_date(y, 3 * n - 2, 1);
  return jsonb_build_object('start', to_char(s, 'YYYY-MM-DD'), 'end', to_char((s + interval '3 months')::date - 1, 'YYYY-MM-DD'));
end $$;
create or replace function kafaa_rs_prev(p text) returns text language sql immutable set search_path = public as $$
  select case when coalesce(p, '') !~ '^20[0-9]{2}-Q[1-4]$' then '' when substr(p, 7, 1) = '1' then (substr(p, 1, 4)::integer - 1) || '-Q4'
    else substr(p, 1, 4) || '-Q' || (substr(p, 7, 1)::integer - 1) end
$$;
create or replace function kafaa_rs_computable(p text, p_today date) returns boolean language sql immutable set search_path = public as $$
  select kafaa_rs_bounds(p) is not null and p collate "C" >= '2025-Q1' and (kafaa_rs_bounds(p) ->> 'start')::date <= p_today
$$;
create or replace function kafaa_rs_closed(p text, p_today date) returns boolean language sql immutable set search_path = public as $$
  select kafaa_rs_bounds(p) is not null and p collate "C" >= '2025-Q1' and (kafaa_rs_bounds(p) ->> 'end')::date < p_today
$$;

-- signalCounts(): raw counts per skill for one quarter (before suppression)
create or replace function kafaa_rs_counts(p text) returns table (skill_id text, goals_profiles integer, recent_hires integer, demand integer, families text[])
language sql stable security definer set search_path = public as $$
  with b as (select (kafaa_rs_bounds(p) ->> 'start')::date qs, (kafaa_rs_bounds(p) ->> 'end')::date qe),
  staff as (select pe.id, pe.hire_date from kafaa_people pe where pe.kind = 'staff' and pe.status = 'active'),
  first as (select e.person_id, e.skill_id, min(e.observed_on) d from kafaa_skill_evidence e join staff s on s.id = e.person_id where e.active group by 1, 2),
  gp as (select x.skill_id, count(distinct x.person_id)::int n from (
           select f.skill_id, f.person_id from first f, b where f.d between b.qs and b.qe
           union all
           select g.skill_id, g.person_id from kafaa_skill_goals g join staff s on s.id = g.person_id, b where (g.created_at at time zone 'UTC')::date between b.qs and b.qe) x group by 1),
  rh as (select f.skill_id, count(distinct f.person_id)::int n from first f join staff s on s.id = f.person_id, b
         where f.d <= b.qe and s.hire_date > b.qe - 365 and s.hire_date <= b.qe group by 1),
  items as (
    select o.id item, u.s skill_id, o.family_id fam from kafaa_opportunities o cross join lateral (select distinct unnest(o.skills_needed || o.skills_gained) s) u, b
      where o.status <> 'draft' and (o.created_at at time zone 'UTC')::date between b.qs and b.qe
    union all
    select 'v:' || v.id, r.ref_id, jr.family_id from kafaa_role_profile_versions v
      cross join lateral (select distinct x ->> 'ref_id' ref_id from jsonb_array_elements(case when jsonb_typeof(v.requirements) = 'array' then v.requirements else '[]'::jsonb end) x
                          where jsonb_typeof(x) = 'object' and x ->> 'kind' = 'skill' and jsonb_typeof(x -> 'ref_id') = 'string') r
      left join kafaa_job_roles jr on jr.id = v.role_id, b
      where v.status in ('published', 'superseded') and v.published_at is not null and (v.published_at at time zone 'UTC')::date between b.qs and b.qe),
  dm as (select i.skill_id, count(*)::int n, coalesce(array_agg(distinct (i.fam collate "C") order by (i.fam collate "C")) filter (where i.fam is not null and i.fam <> ''), '{}'::text[]) fams from items i group by 1),
  ids as (select gp.skill_id from gp union select rh.skill_id from rh union select dm.skill_id from dm)
  select ids.skill_id, coalesce(gp.n, 0), coalesce(rh.n, 0), coalesce(dm.n, 0), coalesce(dm.fams, '{}'::text[])
  from ids left join gp on gp.skill_id = ids.skill_id left join rh on rh.skill_id = ids.skill_id left join dm on dm.skill_id = ids.skill_id
  where kafaa_rs_bounds(p) is not null
$$;

-- risingSkills(): the quarterly list (null for a malformed quarter)
create or replace function kafaa_rs_compute(p text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare b jsonb := kafaa_rs_bounds(p); v_prev text := kafaa_rs_prev(p); v_rows jsonb; v_cnt jsonb;
begin
  if b is null then return null; end if;
  with cur as (select * from kafaa_rs_counts(p)), prv as (select * from kafaa_rs_counts(v_prev)),
  sk as (select s.id from kafaa_skills s where s.area is distinct from 'security' and s.lifecycle is distinct from 'obsolete'),
  base as (select sk.id skill_id, c.goals_profiles c1, c.recent_hires c2, c.demand c3, c.families,
             coalesce(pv.goals_profiles, 0) p1, coalesce(pv.recent_hires, 0) p2, coalesce(pv.demand, 0) p3
           from sk join cur c on c.skill_id = sk.id left join prv pv on pv.skill_id = sk.id),
  cells as (select b.skill_id, b.families, k.ord, k.key, k.raw,
              case when k.raw >= 10 then k.raw end v, case when k.praw >= 10 then k.praw end pv
            from base b cross join lateral (values (1, 'goals_profiles', b.c1, b.p1), (2, 'recent_hires', b.c2, b.p2), (3, 'demand', b.c3, b.p3)) k(ord, key, raw, praw)),
  cells2 as (select c.*, case when c.v is null or c.pv is null or c.pv <= 0 then null else floor(((c.v - c.pv) * 200 + c.pv)::numeric / (2 * c.pv))::int end ch from cells c),
  cells3 as (select c.*, (c.v is not null and (c.key = 'demand' or c.pv is null or (c.ch is not null and c.ch >= 25))) moved from cells2 c),
  per as (select c.skill_id, c.families,
            bool_or(c.moved) filter (where c.key = 'demand') dem, bool_or(c.moved) filter (where c.key <> 'demand') grow,
            sum(coalesce(c.v, 0))::int score,
            jsonb_agg(jsonb_build_object('key', c.key, 'value', c.v, 'prev', c.pv, 'change_pct', c.ch, 'moved', c.moved) order by c.ord) signals,
            coalesce(jsonb_agg(to_jsonb(c.key) order by c.ord) filter (where c.moved), '[]'::jsonb) moved_by,
            coalesce(jsonb_agg(case when c.key = 'demand' then jsonb_build_object('code', 'demand', 'key', 'm28.rs.reason.demand', 'vars', jsonb_build_object('n', c.v, 'families', coalesce(array_length(c.families, 1), 0)))
                                    when c.pv is null then jsonb_build_object('code', c.key || '_new', 'key', 'm28.rs.reason.' || c.key || '_new', 'vars', jsonb_build_object('n', c.v))
                                    else jsonb_build_object('code', c.key || '_up', 'key', 'm28.rs.reason.' || c.key || '_up', 'vars', jsonb_build_object('n', c.v, 'prev', c.pv, 'pct', c.ch)) end
                          order by c.ord) filter (where c.moved), '[]'::jsonb) reasons
          from cells3 c group by c.skill_id, c.families),
  listed as (select per.*, case when per.dem then 'now' when per.grow then 'growing' end category from per where per.dem or per.grow),
  ranked as (select l.*, row_number() over (partition by l.category order by l.score desc, l.skill_id collate "C") rk from listed l)
  select coalesce(jsonb_agg(jsonb_build_object('skill_id', r.skill_id, 'category', r.category, 'rank', r.rk, 'score', r.score, 'moved_by', r.moved_by, 'signals', r.signals,
           'families', to_jsonb(r.families), 'reasons', case when r.category = 'now' and r.grow then r.reasons || jsonb_build_array(jsonb_build_object('code', 'also_growing', 'key', 'm28.rs.reason.also_growing', 'vars', '{}'::jsonb)) else r.reasons end)
         order by case r.category when 'now' then 1 else 2 end, r.rk), '[]'::jsonb)
    into v_rows from ranked r where r.rk <= 12;
  with cur as (select * from kafaa_rs_counts(p)),
  sk as (select s.id from kafaa_skills s where s.area is distinct from 'security' and s.lifecycle is distinct from 'obsolete'),
  base as (select c.* from sk join cur c on c.skill_id = sk.id),
  cells as (select k.raw from base b cross join lateral (values (b.goals_profiles), (b.recent_hires), (b.demand)) k(raw))
  select jsonb_build_object('considered', (select count(*) from base), 'suppressed', count(*) filter (where raw > 0 and raw < 10), 'shown', count(*) filter (where raw >= 10)) into v_cnt from cells;
  return jsonb_build_object('quarter', p, 'prev', v_prev, 'method', 'fs70-v1', 'start', b ->> 'start', 'end', b ->> 'end', 'rows', v_rows,
    'counts', v_cnt || jsonb_build_object('now', (select count(*) from jsonb_array_elements(v_rows) x where x ->> 'category' = 'now'),
      'growing', (select count(*) from jsonb_array_elements(v_rows) x where x ->> 'category' = 'growing')));
end $$;

-- pulseSummary(): nothing under 10 responses; bands and families under 10 suppressed
create or replace function kafaa_mp_median(v integer[]) returns numeric language sql immutable set search_path = public as $$
  select case when coalesce(array_length(v, 1), 0) = 0 then null when array_length(v, 1) % 2 = 1 then v[(array_length(v, 1) + 1) / 2]::numeric
    else (v[array_length(v, 1) / 2] + v[array_length(v, 1) / 2 + 1])::numeric / 2 end
$$;
create or replace function kafaa_mp_summary(p_year integer) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v integer[]; n integer; sup boolean;
begin
  select coalesce(array_agg(m.share_pct order by m.share_pct), '{}') into v from kafaa_manager_pulse m where m.year = p_year and m.share_pct between 0 and 100;
  n := coalesce(array_length(v, 1), 0);
  sup := n < 10;
  return jsonb_build_object('year', p_year, 'responses', case when sup then null else n end, 'suppressed', sup,
    'median', case when sup then null else kafaa_mp_median(v) end,
    'p25', case when sup then null else v[greatest(1, (25 * n + 99) / 100)] end,
    'p75', case when sup then null else v[greatest(1, (75 * n + 99) / 100)] end,
    'bands', (select jsonb_agg(jsonb_build_object('lo', b.lo, 'hi', b.hi, 'n', case when sup or c.k < 10 then null else c.k end) order by b.lo)
              from (values (0, 19), (20, 39), (40, 59), (60, 79), (80, 100)) b(lo, hi)
              cross join lateral (select count(*)::int k from unnest(v) x where x between b.lo and b.hi) c),
    'families', case when sup then '[]'::jsonb else (select coalesce(jsonb_agg(jsonb_build_object('family_id', f.fam, 'n', case when f.k < 10 then null else f.k end,
        'median', case when f.k < 10 then null else kafaa_mp_median(f.vals) end) order by f.fam collate "C"), '[]'::jsonb)
      from (select coalesce(m.family_id, 'none') fam, count(*)::int k, array_agg(m.share_pct order by m.share_pct) vals from kafaa_manager_pulse m
            where m.year = p_year and m.share_pct between 0 and 100 group by 1) f) end);
end $$;

-- ───────────── FS70 RPCs
create or replace function kafaa_compute_skill_signals(p_quarter text) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_q text := coalesce(p_quarter, ''); v_ent text := nullif(coalesce(p_quarter, ''), ''); v_role text;
begin
  if kafaa_me() is null then return kafaa_refuse('skill_signals.compute', 'skill_signals', v_ent, 'not_signed_in', kafaa_fs81_msg('rs.not_signed_in')); end if;
  if not kafaa_has_grant('workforce_strategy', array['Agg', 'R', 'W', 'A']) then return kafaa_refuse('skill_signals.compute', 'skill_signals', v_ent, 'forbidden', kafaa_fs81_msg('rs.forbidden_compute')); end if;
  v_role := kafaa_acting_role('workforce_strategy', array['Agg', 'R', 'W', 'A']);
  if not kafaa_rs_computable(v_q, current_date) then return kafaa_refuse('skill_signals.compute', 'skill_signals', v_ent, 'invalid', kafaa_fs81_msg('rs.invalid_quarter'), v_role); end if;
  return jsonb_build_object('ok', true, 'code', 'ok', 'message', 'Skills on the Rise computed', 'audit_seq', null, 'ledger_seq', null, 'data', kafaa_rs_compute(v_q));
end $$;

create or replace function kafaa_publish_skill_signals(p_quarter text, p_summary_en text default '', p_summary_ar text default '') returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_q text := coalesce(p_quarter, ''); v_ent text := nullif(coalesce(p_quarter, ''), ''); v_role text; v_res jsonb; v_id text; a kafaa_audit_events; l integer;
  v_now integer; v_grow integer;
begin
  if me is null then return kafaa_refuse('skill_signals.publish', 'skill_signal_runs', v_ent, 'not_signed_in', kafaa_fs81_msg('rs.not_signed_in')); end if;
  if not kafaa_has_grant('workforce_strategy', array['W', 'A']) then return kafaa_refuse('skill_signals.publish', 'skill_signal_runs', v_ent, 'forbidden', kafaa_fs81_msg('rs.forbidden_publish')); end if;
  v_role := kafaa_acting_role('workforce_strategy', array['W', 'A']);
  if not kafaa_rs_computable(v_q, current_date) then return kafaa_refuse('skill_signals.publish', 'skill_signal_runs', v_ent, 'invalid', kafaa_fs81_msg('rs.invalid_quarter'), v_role); end if;
  if not kafaa_rs_closed(v_q, current_date) then return kafaa_refuse('skill_signals.publish', 'skill_signal_runs', v_ent, 'open_quarter', kafaa_fs81_msg('rs.open_quarter'), v_role); end if;
  v_id := 'ssr:' || v_q;
  if exists (select 1 from kafaa_skill_signal_runs r where r.id = v_id or r.quarter = v_q) then
    return kafaa_refuse('skill_signals.publish', 'skill_signal_runs', v_ent, 'published', kafaa_fs81_msg('rs.published'), v_role); end if;
  v_res := kafaa_rs_compute(v_q);
  v_now := (v_res -> 'counts' ->> 'now')::integer; v_grow := (v_res -> 'counts' ->> 'growing')::integer;
  insert into kafaa_skill_signal_runs (id, quarter, method, status, counts, published_by, published_role, published_at, summary_en, summary_ar)
  values (v_id, v_q, v_res ->> 'method', 'published', v_res -> 'counts', me, v_role, now(), left(btrim(coalesce(p_summary_en, ''), E' \t\n\r'), 600), left(btrim(coalesce(p_summary_ar, ''), E' \t\n\r'), 600));
  insert into kafaa_skill_signals (id, run_id, quarter, skill_id, category, rank, score, moved_by, signals, families, reasons, published_at)
  select 'ss:' || v_q || ':' || (r ->> 'skill_id'), v_id, v_q, r ->> 'skill_id', r ->> 'category', (r ->> 'rank')::integer, (r ->> 'score')::integer,
    array(select jsonb_array_elements_text(r -> 'moved_by')), r -> 'signals', array(select jsonb_array_elements_text(r -> 'families')), r -> 'reasons', now()
  from jsonb_array_elements(v_res -> 'rows') r;
  l := kafaa_ledger('kafaa.skills.signals_publish', 'ENEC Skills on the Rise ' || v_q || ' published: ' || v_now || ' in demand now, ' || v_grow || ' growing');
  a := kafaa_audit('skill_signals.publish', 'skill_signal_runs', v_id, 'ok', v_q || ' ' || v_now || ' now ' || v_grow || ' growing', case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Skills on the Rise published', a, l, jsonb_build_object('id', v_id, 'quarter', v_q, 'now', v_now, 'growing', v_grow));
end $$;

create or replace function kafaa_submit_manager_pulse(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_year integer := extract(year from current_date)::integer; v_id text; v_share integer; v_team integer; v_fam text; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('manager_pulse.submit', 'manager_pulse', null, 'not_signed_in', kafaa_fs81_msg('rs.not_signed_in')); end if;
  if not kafaa_has_grant('transformation', array['Scope']) then return kafaa_refuse('manager_pulse.submit', 'manager_pulse', null, 'forbidden', kafaa_fs81_msg('rs.pulse_forbidden')); end if;
  v_role := kafaa_acting_role('transformation', array['Scope']);
  if not (to_char(current_date, 'MM-DD') between '09-15' and '12-15') then return kafaa_refuse('manager_pulse.submit', 'manager_pulse', null, 'closed', kafaa_fs81_msg('rs.pulse_closed'), v_role); end if;
  if jsonb_typeof(p) is distinct from 'object' or jsonb_typeof(p -> 'share_pct') is distinct from 'number' or (p ->> 'share_pct') !~ '^[0-9]+$' or (p ->> 'share_pct')::numeric > 100
     or not (p -> 'team_size' is null or jsonb_typeof(p -> 'team_size') = 'null' or (jsonb_typeof(p -> 'team_size') = 'number' and (p ->> 'team_size') ~ '^[0-9]+$' and (p ->> 'team_size')::numeric between 1 and 500)) then
    return kafaa_refuse('manager_pulse.submit', 'manager_pulse', null, 'invalid', kafaa_fs81_msg('rs.pulse_invalid'), v_role); end if;
  v_share := (p ->> 'share_pct')::integer;
  v_team := case when jsonb_typeof(p -> 'team_size') = 'number' then (p ->> 'team_size')::integer end;
  v_id := 'mp:' || v_year || ':' || me;
  select job_family_id into v_fam from kafaa_people where id = me;
  insert into kafaa_manager_pulse (id, year, person_id, family_id, team_size, share_pct, submitted_at, updated_at) values (v_id, v_year, me, v_fam, v_team, v_share, now(), now())
  on conflict (id) do update set share_pct = excluded.share_pct, team_size = excluded.team_size, family_id = excluded.family_id, updated_at = now();
  a := kafaa_audit('manager_pulse.submit', 'manager_pulse', v_id, 'ok', v_year || ' ' || v_share || '%', 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Thank you: your answer is saved', a, null, jsonb_build_object('id', v_id, 'year', v_year, 'share_pct', v_share));
end $$;

create or replace function kafaa_manager_pulse_summary(p_year integer) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_role text;
begin
  if kafaa_me() is null then return kafaa_refuse('manager_pulse.summary', 'manager_pulse', null, 'not_signed_in', kafaa_fs81_msg('rs.not_signed_in')); end if;
  if not kafaa_has_grant('workforce_strategy', array['Agg', 'R', 'W', 'A']) and not kafaa_has_grant('transformation', array['Agg']) then
    return kafaa_refuse('manager_pulse.summary', 'manager_pulse', null, 'forbidden', kafaa_fs81_msg('rs.pulse_read_forbidden')); end if;
  v_role := coalesce(kafaa_acting_role('workforce_strategy', array['Agg', 'R', 'W', 'A']), kafaa_acting_role('transformation', array['Agg']));
  if p_year is null or p_year < 2025 or p_year > extract(year from current_date)::integer then
    return kafaa_refuse('manager_pulse.summary', 'manager_pulse', null, 'invalid', kafaa_fs81_msg('rs.pulse_year'), v_role); end if;
  return jsonb_build_object('ok', true, 'code', 'ok', 'message', 'Manager pulse', 'audit_seq', null, 'ledger_seq', null, 'data', kafaa_mp_summary(p_year));
end $$;

-- ═════════════ FS71 rules (mirror of src/modules/m28/technologies.ts). Internal: not executable by API roles.
-- brandHits(): the deny-listed vendor and product names a text contains (whole words, case-insensitive), in list order
create or replace function kafaa_ht_brand_hits(p text) returns text[] language sql immutable set search_path = public as $$
  select coalesce(array_agg(w.w order by w.i), '{}'::text[])
  from unnest(array['osisoft', 'aveva', 'pi system', 'siemens', 'honeywell', 'emerson', 'abb', 'schneider', 'rockwell', 'yokogawa', 'westinghouse', 'framatome', 'kepco', 'khnp', 'doosan',
    'microsoft', 'excel', 'power bi', 'azure', 'copilot', 'sharepoint', 'google', 'gemini', 'aws', 'amazon', 'oracle', 'sap', 'ibm', 'maximo', 'servicenow',
    'tableau', 'qlik', 'splunk', 'python', 'matlab', 'labview', 'jupyter', 'tensorflow', 'pytorch', 'openai', 'chatgpt', 'anthropic',
    'hololens', 'magic leap', 'unreal engine', 'autodesk', 'autocad', 'revit', 'bentley', 'ansys', 'dassault', 'catia', 'solidworks', 'primavera', 'boston dynamics',
    'dji', 'faro', 'leica', 'jira', 'salesforce', 'workday', 'cornerstone', 'degreed', 'linkedin',
    'مايكروسوفت', 'سيمنز', 'أوراكل', 'جوجل', 'غوغل', 'بايثون', 'إكسل', 'هانيويل', 'وستنجهاوس', 'أمازون', 'آي بي إم', 'تشات جي بي تي']) with ordinality w(w, i)
  where coalesce(p, '') <> '' and lower(p) ~ ('(^|[^A-Za-z0-9؀-ۿ])' || w.w || '($|[^A-Za-z0-9؀-ۿ])')
$$;
create or replace function kafaa_ht_len(x jsonb) returns integer language sql immutable set search_path = public as $$
  select case when jsonb_typeof(x) = 'string' then char_length(btrim(x #>> '{}', E' \t\n\r')) else -1 end
$$;
create or replace function kafaa_ht_text(x jsonb) returns text language sql immutable set search_path = public as $$
  select case when jsonb_typeof(x) = 'string' then x #>> '{}' end
$$;
-- techProblem(): the first problem of a new or edited technology, or null
create or replace function kafaa_ht_problem(p jsonb, p_new boolean) returns text language plpgsql stable security definer set search_path = public as $$
declare sk jsonb;
begin
  if jsonb_typeof(p) is distinct from 'object' then return 'name'; end if;
  if p_new and not (jsonb_typeof(p -> 'id') = 'string' and (p ->> 'id') ~ '^tech-[a-z0-9-]{3,40}$') then return 'id'; end if;
  if not (kafaa_ht_len(p -> 'name_en') between 3 and 80 and kafaa_ht_len(p -> 'name_ar') between 3 and 80 and kafaa_ht_text(p -> 'name_ar') ~ '[؀-ۿ]') then return 'name'; end if;
  if not (kafaa_ht_len(p -> 'description_en') between 20 and 400 and kafaa_ht_len(p -> 'description_ar') between 20 and 400 and kafaa_ht_text(p -> 'description_ar') ~ '[؀-ۿ]') then return 'description'; end if;
  if exists (select 1 from unnest(array[kafaa_ht_text(p -> 'id'), kafaa_ht_text(p -> 'name_en'), kafaa_ht_text(p -> 'name_ar'), kafaa_ht_text(p -> 'description_en'), kafaa_ht_text(p -> 'description_ar')]) t(x)
             where cardinality(kafaa_ht_brand_hits(t.x)) > 0) then return 'brand'; end if;
  if coalesce(kafaa_ht_text(p -> 'category'), '') not in ('plant_data', 'analytics', 'automation', 'digital_twin', 'inspection', 'work_management', 'ai_tools', 'simulation') then return 'category'; end if;
  sk := case when p -> 'skill_ids' is null or jsonb_typeof(p -> 'skill_ids') = 'null' then '[]'::jsonb else p -> 'skill_ids' end;
  if jsonb_typeof(sk) <> 'array' or jsonb_array_length(sk) > 6
     or exists (select 1 from jsonb_array_elements(sk) e where jsonb_typeof(e) <> 'string' or not exists (select 1 from kafaa_skills s where s.id = e #>> '{}'))
     or (select count(distinct e) from jsonb_array_elements(sk) e) <> jsonb_array_length(sk) then return 'skills'; end if;
  if p -> 'status' is not null and jsonb_typeof(p -> 'status') <> 'null' and coalesce(kafaa_ht_text(p -> 'status'), '') not in ('active', 'retired') then return 'status'; end if;
  return null;
end $$;
-- badgeWindow(): the four quarters ending with the badge quarter
create or replace function kafaa_ht_window(q text) returns jsonb language sql immutable set search_path = public as $$
  select case when kafaa_rs_bounds(q) is null then null else jsonb_build_object('start', kafaa_rs_bounds(kafaa_rs_prev(kafaa_rs_prev(kafaa_rs_prev(q)))) ->> 'start',
    'end', kafaa_rs_bounds(q) ->> 'end', 'qstart', kafaa_rs_bounds(q) ->> 'start') end
$$;
-- technologyBadges(): hot across ENEC and in demand per role, from the published criteria (null for a malformed quarter)
create or replace function kafaa_ht_compute(q text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare w jsonb := kafaa_ht_window(q); ws date; we date; wq date; v_hot jsonb; v_near jsonb; v_roles jsonb;
begin
  if w is null then return null; end if;
  ws := (w ->> 'start')::date; we := (w ->> 'end')::date; wq := (w ->> 'qstart')::date;
  with live as (select t.id from kafaa_technologies t where t.status is distinct from 'retired'),
  lk as (select l.* from kafaa_technology_links l join live on live.id = l.technology_id where l.active and l.source_on between ws and we),
  per as (select live.id technology_id,
            count(distinct (lk.ref_table, lk.ref_id)) filter (where lk.id is not null)::int sources,
            count(distinct lk.family_id) filter (where lk.family_id is not null and lk.family_id <> '')::int families,
            count(distinct (lk.ref_table, lk.ref_id)) filter (where lk.source_on >= wq)::int recent,
            count(distinct lk.ref_id) filter (where lk.ref_table = 'opportunities')::int opps,
            count(distinct lk.ref_id) filter (where lk.ref_table = 'role_profile_versions')::int vers
          from live left join lk on lk.technology_id = live.id group by live.id),
  hot as (select per.*, row_number() over (order by per.sources desc, per.families desc, per.technology_id collate "C") rk from per where per.sources >= 6 and per.families >= 3 and per.recent >= 1)
  select coalesce(jsonb_agg(jsonb_build_object('technology_id', h.technology_id, 'rank', h.rk, 'sources', h.sources, 'families', h.families, 'recent', h.recent, 'opportunities', h.opps, 'versions', h.vers) order by h.rk), '[]'::jsonb),
    (select coalesce(jsonb_agg(jsonb_build_object('technology_id', n.technology_id, 'sources', n.sources, 'families', n.families, 'recent', n.recent) order by n.sources desc, n.technology_id collate "C"), '[]'::jsonb)
       from per n where n.sources > 0 and not (n.sources >= 6 and n.families >= 3 and n.recent >= 1))
    into v_hot, v_near from hot h;
  with live as (select t.id from kafaa_technologies t where t.status is distinct from 'retired'),
  allk as (select l.* from kafaa_technology_links l join live on live.id = l.technology_id where l.active),
  roles as (select r.id, r.family_id from kafaa_job_roles r where r.lifecycle is distinct from 'concept'),
  rt as (select r.id role_id, live.id technology_id,
           exists (select 1 from allk a where a.technology_id = live.id and a.ref_table = 'role_profile_versions' and a.role_id = r.id and a.source_on <= we) via,
           case when r.family_id is null or r.family_id = '' then 0 else (select count(distinct a.ref_id)::int from allk a where a.technology_id = live.id and a.ref_table = 'opportunities'
             and a.family_id = r.family_id and a.source_on between ws and we) end fo
         from roles r cross join live)
  select coalesce(jsonb_agg(jsonb_build_object('role_id', rt.role_id, 'technology_id', rt.technology_id, 'via_profile', rt.via, 'family_opportunities', rt.fo)
           order by rt.role_id collate "C", rt.technology_id collate "C"), '[]'::jsonb) into v_roles from rt where rt.via or rt.fo >= 2;
  return jsonb_build_object('quarter', q, 'criteria', 'fs71-v1', 'window', jsonb_build_object('start', w ->> 'start', 'end', w ->> 'end'), 'hot', v_hot, 'roles', v_roles, 'near', v_near);
end $$;

-- ───────────── FS71 RPCs
create or replace function kafaa_save_technology(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_id text := case when jsonb_typeof(p -> 'id') = 'string' and p ->> 'id' <> '' then p ->> 'id' end; cur kafaa_technologies; v_pr text; v_ver integer;
  v_status text; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('technology.save', 'technologies', v_id, 'not_signed_in', kafaa_fs81_msg('ht.not_signed_in')); end if;
  if not kafaa_has_grant('frameworks', array['W', 'A']) then return kafaa_refuse('technology.save', 'technologies', v_id, 'forbidden', kafaa_fs81_msg('ht.forbidden')); end if;
  v_role := kafaa_acting_role('frameworks', array['W', 'A']);
  select * into cur from kafaa_technologies where id = v_id;
  v_pr := kafaa_ht_problem(p, cur.id is null);
  if v_pr is not null then return kafaa_refuse('technology.save', 'technologies', v_id, 'invalid', kafaa_fs81_msg('ht.invalid') || kafaa_fs81_msg('ht.p.' || v_pr), v_role); end if;
  v_ver := coalesce(cur.version, 0) + 1;
  v_status := coalesce(nullif(kafaa_ht_text(p -> 'status'), ''), cur.status, 'active');
  if cur.id is not null then
    update kafaa_technologies set name_en = btrim(p ->> 'name_en', E' \t\n\r'), name_ar = btrim(p ->> 'name_ar', E' \t\n\r'), description_en = btrim(p ->> 'description_en', E' \t\n\r'),
      description_ar = btrim(p ->> 'description_ar', E' \t\n\r'), category = p ->> 'category',
      skill_ids = array(select jsonb_array_elements_text(case when jsonb_typeof(p -> 'skill_ids') = 'array' then p -> 'skill_ids' else '[]'::jsonb end)),
      status = v_status, version = v_ver, updated_by = me, updated_at = now() where id = v_id;
  else
    insert into kafaa_technologies (id, name_en, name_ar, description_en, description_ar, category, skill_ids, status, version, created_by, created_at, updated_by, updated_at, sort)
    values (v_id, btrim(p ->> 'name_en', E' \t\n\r'), btrim(p ->> 'name_ar', E' \t\n\r'), btrim(p ->> 'description_en', E' \t\n\r'), btrim(p ->> 'description_ar', E' \t\n\r'), p ->> 'category',
      array(select jsonb_array_elements_text(case when jsonb_typeof(p -> 'skill_ids') = 'array' then p -> 'skill_ids' else '[]'::jsonb end)), v_status, 1, me, now(), me, now(),
      (select coalesce(max(sort), 0) + 1 from kafaa_technologies));
  end if;
  a := kafaa_audit('technology.save', 'technologies', v_id, 'ok', 'v' || v_ver || ' ' || v_status, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when cur.id is not null then 'Technology saved' else 'Technology added' end, a, null, jsonb_build_object('id', v_id, 'version', v_ver));
end $$;

create or replace function kafaa_tag_technology(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_tech text := case when jsonb_typeof(p -> 'technology_id') = 'string' then p ->> 'technology_id' else '' end; t kafaa_technologies;
  v_table text := coalesce(p ->> 'ref_table', ''); v_ref text := case when jsonb_typeof(p -> 'ref_id') = 'string' then p ->> 'ref_id' else '' end; v_found boolean := false;
  v_fam text; v_rid text; v_on date; v_id text; cur kafaa_technology_links; v_active boolean := coalesce(p -> 'active', 'true'::jsonb) <> 'false'::jsonb; a kafaa_audit_events;
  o kafaa_opportunities; rv kafaa_role_profile_versions;
begin
  if me is null then return kafaa_refuse('technology.tag', 'technology_links', nullif(v_tech, ''), 'not_signed_in', kafaa_fs81_msg('ht.not_signed_in')); end if;
  if not kafaa_has_grant('frameworks', array['W', 'A']) then return kafaa_refuse('technology.tag', 'technology_links', nullif(v_tech, ''), 'forbidden', kafaa_fs81_msg('ht.forbidden')); end if;
  v_role := kafaa_acting_role('frameworks', array['W', 'A']);
  select * into t from kafaa_technologies where id = v_tech;
  if t.id is null or t.status <> 'active' then return kafaa_refuse('technology.tag', 'technology_links', nullif(v_tech, ''), 'not_found', kafaa_fs81_msg('ht.not_found'), v_role); end if;
  if v_table = 'opportunities' then
    select * into o from kafaa_opportunities where id = v_ref;
    if o.id is not null and o.status <> 'draft' then v_found := true; v_fam := o.family_id; v_rid := o.host_role_id; v_on := (o.created_at at time zone 'UTC')::date; end if;
  elsif v_table = 'role_profile_versions' then
    select * into rv from kafaa_role_profile_versions where id = v_ref;
    if rv.id is not null and rv.status in ('published', 'superseded') and rv.published_at is not null then
      v_found := true; v_rid := rv.role_id; v_on := (rv.published_at at time zone 'UTC')::date; select family_id into v_fam from kafaa_job_roles where id = rv.role_id; end if;
  end if;
  if not v_found then return kafaa_refuse('technology.tag', 'technology_links', nullif(v_tech, ''), 'source_not_found', kafaa_fs81_msg('ht.source_not_found'), v_role); end if;
  v_id := 'tl:' || v_tech || ':' || v_table || ':' || v_ref;
  select * into cur from kafaa_technology_links where id = v_id;
  if (cur.id is not null and cur.active = v_active) or (cur.id is null and not v_active) then
    return kafaa_refuse('technology.tag', 'technology_links', nullif(v_tech, ''), 'no_change', kafaa_fs81_msg('ht.no_change'), v_role); end if;
  insert into kafaa_technology_links (id, technology_id, ref_table, ref_id, family_id, role_id, source_on, active, linked_by, linked_at)
  values (v_id, v_tech, v_table, v_ref, v_fam, v_rid, v_on, v_active, me, now())
  on conflict (id) do update set active = excluded.active, family_id = excluded.family_id, role_id = excluded.role_id, source_on = excluded.source_on, linked_by = me, linked_at = now();
  a := kafaa_audit('technology.tag', 'technology_links', v_id, 'ok', case when v_active then 'tagged' else 'untagged' end, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when v_active then 'Technology tag added' else 'Technology tag removed' end, a, null, jsonb_build_object('id', v_id, 'active', v_active));
end $$;

create or replace function kafaa_compute_technology_badges(p_quarter text) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_q text := coalesce(p_quarter, ''); v_ent text := nullif(coalesce(p_quarter, ''), ''); v_role text;
begin
  if kafaa_me() is null then return kafaa_refuse('technology.badges_compute', 'technology_badges', v_ent, 'not_signed_in', kafaa_fs81_msg('ht.not_signed_in')); end if;
  if not kafaa_has_grant('frameworks', array['W', 'A']) then return kafaa_refuse('technology.badges_compute', 'technology_badges', v_ent, 'forbidden', kafaa_fs81_msg('ht.forbidden')); end if;
  v_role := kafaa_acting_role('frameworks', array['W', 'A']);
  if not kafaa_rs_computable(v_q, current_date) then return kafaa_refuse('technology.badges_compute', 'technology_badges', v_ent, 'invalid', kafaa_fs81_msg('ht.invalid_quarter'), v_role); end if;
  return jsonb_build_object('ok', true, 'code', 'ok', 'message', 'Technology badges computed', 'audit_seq', null, 'ledger_seq', null, 'data', kafaa_ht_compute(v_q));
end $$;

create or replace function kafaa_publish_technology_badges(p_quarter text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_q text := coalesce(p_quarter, ''); v_ent text := nullif(coalesce(p_quarter, ''), ''); v_role text; v_res jsonb; v_hot integer; v_roles integer; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('technology.badges_publish', 'technology_badges', v_ent, 'not_signed_in', kafaa_fs81_msg('ht.not_signed_in')); end if;
  if not kafaa_has_grant('frameworks', array['W', 'A']) then return kafaa_refuse('technology.badges_publish', 'technology_badges', v_ent, 'forbidden', kafaa_fs81_msg('ht.forbidden')); end if;
  v_role := kafaa_acting_role('frameworks', array['W', 'A']);
  if not kafaa_rs_computable(v_q, current_date) then return kafaa_refuse('technology.badges_publish', 'technology_badges', v_ent, 'invalid', kafaa_fs81_msg('ht.invalid_quarter'), v_role); end if;
  if not kafaa_rs_closed(v_q, current_date) then return kafaa_refuse('technology.badges_publish', 'technology_badges', v_ent, 'open_quarter', kafaa_fs81_msg('ht.open_quarter'), v_role); end if;
  if exists (select 1 from kafaa_technology_badges b where b.quarter = v_q) then return kafaa_refuse('technology.badges_publish', 'technology_badges', v_ent, 'published', kafaa_fs81_msg('ht.published'), v_role); end if;
  v_res := kafaa_ht_compute(v_q);
  v_hot := jsonb_array_length(v_res -> 'hot'); v_roles := jsonb_array_length(v_res -> 'roles');
  if v_hot = 0 and v_roles = 0 then return kafaa_refuse('technology.badges_publish', 'technology_badges', v_ent, 'no_change', kafaa_fs81_msg('ht.no_change'), v_role); end if;
  insert into kafaa_technology_badges (id, quarter, technology_id, scope, role_id, rank, sources, families, recent, via_profile, family_opportunities, criteria, published_by, published_at)
  select 'tb:' || v_q || ':enec:' || (x ->> 'technology_id'), v_q, x ->> 'technology_id', 'enec', null, (x ->> 'rank')::integer, (x ->> 'sources')::integer, (x ->> 'families')::integer,
    (x ->> 'recent')::integer, false, 0, v_res ->> 'criteria', me, now() from jsonb_array_elements(v_res -> 'hot') x;
  insert into kafaa_technology_badges (id, quarter, technology_id, scope, role_id, rank, sources, families, recent, via_profile, family_opportunities, criteria, published_by, published_at)
  select 'tb:' || v_q || ':' || (x ->> 'role_id') || ':' || (x ->> 'technology_id'), v_q, x ->> 'technology_id', 'role', x ->> 'role_id', null, 0, 0, 0, (x ->> 'via_profile')::boolean,
    (x ->> 'family_opportunities')::integer, v_res ->> 'criteria', me, now() from jsonb_array_elements(v_res -> 'roles') x;
  l := kafaa_ledger('kafaa.skills.technology_badges_publish', 'Technology badges ' || v_q || ' published: ' || v_hot || ' hot across ENEC, ' || v_roles || ' in demand for a role');
  a := kafaa_audit('technology.badges_publish', 'technology_badges', v_q, 'ok', v_q || ' ' || v_hot || ' hot ' || v_roles || ' role badges', case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Technology badges published', a, l, jsonb_build_object('quarter', v_q, 'hot', v_hot, 'roles', v_roles));
end $$;
