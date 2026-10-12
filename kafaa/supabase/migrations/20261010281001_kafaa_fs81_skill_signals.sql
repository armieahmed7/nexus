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

-- ═════════════ FS72 rules (mirror of src/modules/m28/suggestions.ts). Internal: not executable by API roles.
-- inferSuggestions(): one person's suggestions on a day, strongest first (at most 6)
create or replace function kafaa_ssg_candidates(p_person text, p_today date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_n integer; v_from date := p_today - 365; v_out jsonb;
begin
  select count(*)::int into v_n from kafaa_people where kind = 'staff' and status = 'active' and id <> p_person;
  with
  held as (select ps.skill_id, ps.level, coalesce(ps.basis, '') basis from kafaa_person_skills ps where ps.person_id = p_person and ps.active and ps.level >= 1),
  hold as (select ps.skill_id, ps.person_id from kafaa_person_skills ps join kafaa_people pe on pe.id = ps.person_id
           where ps.active and ps.level >= 1 and pe.kind = 'staff' and pe.status = 'active' and ps.person_id <> p_person),
  hcount as (select h.skill_id, count(*)::int n from hold h group by 1),
  elig as (select s.id from kafaa_skills s where not exists (select 1 from held where held.skill_id = s.id) and s.area is distinct from 'security' and s.lifecycle is distinct from 'obsolete'
           and not exists (select 1 from kafaa_skill_suggestions g where g.person_id = p_person and g.skill_id = s.id
                           and (g.status = 'confirmed' or (g.status in ('rejected', 'not_me') and g.suppressed_until is not null and p_today < g.suppressed_until)))),
  gig as (select distinct on (x.s) x.s skill, 30 pts, jsonb_build_object('code', 'gig', 'key', 'm28.ssg.reason.gig', 'vars',
            jsonb_build_object('gig', jsonb_build_object('en', coalesce(o.title_en, o.id), 'ar', coalesce(o.title_ar, o.id)))) r
          from kafaa_opportunity_applications a join kafaa_opportunities o on o.id = a.opportunity_id
          cross join lateral unnest(o.skills_needed || o.skills_gained) with ordinality x(s, i)
          where a.person_id = p_person and a.status = 'completed'
            and not (jsonb_typeof(a.outcome_levels) = 'object' and a.outcome_levels ? x.s) and exists (select 1 from elig where elig.id = x.s)
          order by x.s, a.opportunity_id collate "C", x.i),
  ctb as (select distinct on (n.nid) n.nid skill, 25 pts, jsonb_build_object('code', 'contribution', 'key', 'm28.ssg.reason.contribution', 'vars',
            jsonb_build_object('title', jsonb_build_object('en', coalesce(c.title_en, c.id), 'ar', coalesce(c.title_ar, c.id)), 'skill', jsonb_build_object('en', s.name_en, 'ar', s.name_ar))) r
          from kafaa_contributions c cross join lateral unnest(c.skill_ids) with ordinality cs(sid, ci) join kafaa_skills s on s.id = cs.sid
          cross join lateral unnest(s.adjacent_ids) with ordinality n(nid, ni)
          where c.person_id = p_person and c.status = 'validated' and exists (select 1 from elig where elig.id = n.nid)
          order by n.nid, c.id collate "C", cs.ci, n.ni),
  xst as (select x.object_type, x.object_id, x.verb, x.result from kafaa_xapi_statements x
          where x.actor_person_id = p_person and (x.occurred_at at time zone 'UTC')::date > v_from and (x.occurred_at at time zone 'UTC')::date <= p_today),
  xs as (select cs.id skill, 1 rf, 0 ot from xst x join kafaa_skills cs on cs.core and cs.competency_id = x.object_id
           where x.object_type = 'refresher' and x.verb = 'answered' and (x.result -> 'success') = 'true'::jsonb
         union all
         select cs.id, 0, 1 from xst x join kafaa_sim_scenarios sc on sc.id = x.object_id cross join lateral unnest(sc.competency_ids) cc(cid) join kafaa_skills cs on cs.core and cs.competency_id = cc.cid
           where x.object_type = 'scenario' and x.verb = 'completed'
         union all
         select ka.sid, 0, 1 from xst x join kafaa_knowledge_assets k on k.id = x.object_id cross join lateral unnest(k.skill_ids) ka(sid)
           where x.object_type = 'knowledge_asset' and x.verb = 'experienced'),
  xa as (select xs.skill, 20 pts, jsonb_build_object('code', 'xapi', 'key', 'm28.ssg.reason.xapi', 'vars', jsonb_build_object('n', sum(xs.rf) + sum(xs.ot))) r
         from xs where exists (select 1 from elig where elig.id = xs.skill) group by xs.skill having sum(xs.rf) >= 3 or sum(xs.ot) >= 1),
  pairs as (select a.skill_id a, b.skill_id b, count(*)::int both_n from hold a join hold b on b.person_id = a.person_id and b.skill_id <> a.skill_id
            where exists (select 1 from held where held.skill_id = a.skill_id) group by 1, 2),
  co as (select distinct on (p.b) p.b skill, least(30, floor(lf.l / 10))::int pts, jsonb_build_object('code', 'co_occurrence', 'key', 'm28.ssg.reason.co_occurrence', 'vars',
            jsonb_build_object('skill', jsonb_build_object('en', coalesce(sa.name_en, p.a), 'ar', coalesce(sa.name_ar, p.a)), 'pct', floor((p.both_n * 200 + ha.n)::numeric / (2 * ha.n))::int,
              'lift', round(lf.l::numeric / 100, 2))) r
         from pairs p join hcount ha on ha.skill_id = p.a join hcount hb on hb.skill_id = p.b left join kafaa_skills sa on sa.id = p.a
         cross join lateral (select floor((p.both_n::numeric * v_n * 200 + ha.n * hb.n) / (2 * ha.n * hb.n))::int l) lf
         where ha.n >= 10 and hb.n >= 10 and p.both_n >= 5 and lf.l >= 150 and exists (select 1 from elig where elig.id = p.b)
         order by p.b, lf.l desc, p.a collate "C"),
  adj as (select distinct on (n.nid) n.nid skill, (15 + case when h.level >= 3 then 5 else 0 end) pts, jsonb_build_object('code', 'adjacency', 'key', 'm28.ssg.reason.adjacency', 'vars',
            jsonb_build_object('skill', jsonb_build_object('en', s.name_en, 'ar', s.name_ar), 'level', h.level)) r
          from held h join kafaa_skills s on s.id = h.skill_id cross join lateral unnest(s.adjacent_ids) with ordinality n(nid, ni)
          where h.level >= 2 and h.basis in ('verified', 'evidenced', 'validated') and exists (select 1 from elig where elig.id = n.nid)
          order by n.nid, h.level desc, h.skill_id collate "C", n.ni),
  src as (select skill, 'gig' src, 1 o, pts, r from gig union all select skill, 'contribution', 2, pts, r from ctb union all select skill, 'xapi', 3, pts, r from xa
          union all select skill, 'co_occurrence', 4, pts, r from co union all select skill, 'adjacency', 5, pts, r from adj),
  agg as (select src.skill, least(100, sum(src.pts))::int score, jsonb_agg(to_jsonb(src.src) order by src.o) srcs, jsonb_agg(src.r order by src.o) reasons,
            bool_or(src.src in ('gig', 'contribution')) strong from src group by src.skill),
  top as (select * from agg where agg.score >= 30 order by agg.score desc, agg.skill collate "C" limit 6)
  select coalesce(jsonb_agg(jsonb_build_object('skill_id', top.skill, 'score', top.score, 'level', case when top.strong or top.score >= 60 then 2 else 1 end, 'sources', top.srcs, 'reasons', top.reasons)
           order by top.score desc, top.skill collate "C"), '[]'::jsonb) into v_out from top;
  return v_out;
end $$;

-- the FS55 fairness snapshot of the surface (F24 population and group rules): staff reached by at least one suggestion by the day
create or replace function kafaa_ssg_fairness_compute(p_as_of date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_period text := to_char(p_as_of, 'IYYY-"W"IW'); v_people text[]; v_pos boolean[]; v_hit text[];
begin
  select coalesce(array_agg(b.id order by b.id), '{}') into v_people from kafaa_fairness_base(p_as_of) b(id);
  v_hit := array(select distinct g.person_id from kafaa_skill_suggestions g where g.first_on <= p_as_of);
  select coalesce(array_agg(p = any(v_hit) order by p), '{}') into v_pos from unnest(v_people) p;
  return (select coalesce(jsonb_agg((x - 'surface') || jsonb_build_object('id', 'ssf' || substr(x ->> 'id', 3), 'card', 'skill_suggestions') order by i), '[]'::jsonb)
    from jsonb_array_elements(kafaa_fairness_rows(v_period, p_as_of, 'suggestion_offered', 'skill_suggestions', 'skill_suggestions', v_people, v_pos)) with ordinality z(x, i));
end $$;

-- ───────────── FS72 RPCs
create or replace function kafaa_refresh_skill_suggestions() returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_today date := current_date; v_c jsonb; c jsonb; cur kafaa_skill_suggestions; v_added integer := 0; v_exp integer := 0; v_open integer; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('skill_suggestions.refresh', 'skill_suggestions', null, 'not_signed_in', kafaa_fs81_msg('ssg.not_signed_in')); end if;
  if not kafaa_has_grant('skills_profile', array['Own']) then return kafaa_refuse('skill_suggestions.refresh', 'skill_suggestions', null, 'forbidden', kafaa_fs81_msg('ssg.forbidden')); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  v_c := kafaa_ssg_candidates(me, v_today);
  for c in select x from jsonb_array_elements(v_c) x loop
    select * into cur from kafaa_skill_suggestions where person_id = me and skill_id = c ->> 'skill_id';
    if cur.id is null then
      insert into kafaa_skill_suggestions (id, person_id, skill_id, status, level, score, sources, reasons, first_on, generated_on, responded_on, suppressed_until, evidence_id, history, version, updated_at)
      values ('ssg:' || me || ':' || (c ->> 'skill_id'), me, c ->> 'skill_id', 'open', (c ->> 'level')::integer, (c ->> 'score')::integer, array(select jsonb_array_elements_text(c -> 'sources')),
        c -> 'reasons', v_today, v_today, null, null, null, '[]'::jsonb, 1, now());
      v_added := v_added + 1;
    elsif cur.status in ('open', 'expired') then
      update kafaa_skill_suggestions set status = 'open', level = (c ->> 'level')::integer, score = (c ->> 'score')::integer, sources = array(select jsonb_array_elements_text(c -> 'sources')),
        reasons = c -> 'reasons', generated_on = v_today, version = cur.version + 1, updated_at = now() where id = cur.id;
      if cur.status = 'expired' then v_added := v_added + 1; end if;
    elsif cur.status in ('rejected', 'not_me') then
      update kafaa_skill_suggestions set status = 'open', level = (c ->> 'level')::integer, score = (c ->> 'score')::integer, sources = array(select jsonb_array_elements_text(c -> 'sources')),
        reasons = c -> 'reasons', generated_on = v_today, responded_on = null, suppressed_until = null,
        history = case when jsonb_typeof(cur.history) = 'array' then cur.history else '[]'::jsonb end || jsonb_build_array(jsonb_build_object('status', cur.status, 'responded_on', to_char(cur.responded_on, 'YYYY-MM-DD'))),
        version = cur.version + 1, updated_at = now() where id = cur.id;
      v_added := v_added + 1;
    end if;
  end loop;
  with gone as (update kafaa_skill_suggestions g set status = 'expired', generated_on = v_today, version = g.version + 1, updated_at = now()
    where g.person_id = me and g.status = 'open' and not exists (select 1 from jsonb_array_elements(v_c) x where x ->> 'skill_id' = g.skill_id) returning 1)
  select count(*)::int into v_exp from gone;
  v_open := jsonb_array_length(v_c);
  a := kafaa_audit('skill_suggestions.refresh', 'skill_suggestions', me, 'ok', v_open || ' open ' || v_added || ' added ' || v_exp || ' expired', 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Suggestions refreshed', a, null, jsonb_build_object('open', v_open, 'added', v_added, 'expired', v_exp));
end $$;

create or replace function kafaa_respond_suggestion(p_id text, p_response text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_ent text := nullif(coalesce(p_id, ''), ''); cur kafaa_skill_suggestions; v_status text; v_eid text; v_level integer; v_name text; v_until date; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('skill_suggestions.respond', 'skill_suggestions', v_ent, 'not_signed_in', kafaa_fs81_msg('ssg.not_signed_in')); end if;
  if not kafaa_has_grant('skills_profile', array['Own']) then return kafaa_refuse('skill_suggestions.respond', 'skill_suggestions', v_ent, 'forbidden', kafaa_fs81_msg('ssg.forbidden')); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  if coalesce(p_response, '') not in ('confirm', 'reject', 'not_me') then return kafaa_refuse('skill_suggestions.respond', 'skill_suggestions', v_ent, 'invalid', kafaa_fs81_msg('ssg.invalid'), v_role); end if;
  select * into cur from kafaa_skill_suggestions where id = p_id;
  if cur.id is null or cur.person_id <> me then return kafaa_refuse('skill_suggestions.respond', 'skill_suggestions', v_ent, 'not_found', kafaa_fs81_msg('ssg.not_found'), v_role); end if;
  if cur.status <> 'open' then return kafaa_refuse('skill_suggestions.respond', 'skill_suggestions', v_ent, 'closed', kafaa_fs81_msg('ssg.closed'), v_role); end if;
  v_status := case p_response when 'confirm' then 'confirmed' when 'reject' then 'rejected' else 'not_me' end;
  if p_response = 'confirm' then
    v_eid := 'se:rating:ssg:' || me || ':' || cur.skill_id;
    v_level := least(2, cur.level);
    select coalesce(name_en, cur.skill_id) into v_name from kafaa_skills where id = cur.skill_id;
    insert into kafaa_skill_evidence (id, person_id, skill_id, kind, ref_table, ref_id, level, basis, status, observed_on, note, recorded_by, active)
    values (v_eid, me, cur.skill_id, 'rating', 'skill_suggestions', cur.id, v_level, 'claimed', 'current', current_date, 'Confirmed suggestion: ' || coalesce(v_name, cur.skill_id), me, true)
    on conflict (id) do update set kind = 'rating', ref_table = 'skill_suggestions', ref_id = excluded.ref_id, level = excluded.level, basis = 'claimed', status = 'current',
      observed_on = excluded.observed_on, note = excluded.note, recorded_by = me, active = true;
    update kafaa_skill_suggestions set status = v_status, responded_on = current_date, evidence_id = v_eid, version = cur.version + 1, updated_at = now() where id = cur.id;
    perform kafaa_skills_apply(me, current_date);
    a := kafaa_audit('skill_suggestions.respond', 'skill_suggestions', cur.id, 'ok', 'confirmed ' || cur.skill_id || ' L' || v_level, 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Added to your skills profile as your own claim', a, null, jsonb_build_object('id', cur.id, 'status', v_status, 'evidence_id', v_eid, 'suppressed_until', null));
  end if;
  v_until := current_date + 180;
  update kafaa_skill_suggestions set status = v_status, responded_on = current_date, suppressed_until = v_until, version = cur.version + 1, updated_at = now() where id = cur.id;
  a := kafaa_audit('skill_suggestions.respond', 'skill_suggestions', cur.id, 'ok', v_status || ' ' || cur.skill_id, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when v_status = 'rejected' then 'Suggestion hidden for 180 days' else 'Noted: not you. Hidden for 180 days' end, a, null,
    jsonb_build_object('id', cur.id, 'status', v_status, 'evidence_id', null, 'suppressed_until', to_char(v_until, 'YYYY-MM-DD')));
end $$;

create or replace function kafaa_run_suggestion_fairness(p_as_of date default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_day date := coalesce(p_as_of, current_date); v_rows jsonb; v_period text; v_flag integer; v_sup integer; l integer; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('fairness.suggestion_snapshot', 'skill_suggestion_fairness', v_day::text, 'not_signed_in', kafaa_fs81_msg('ssg.not_signed_in')); end if;
  v_role := kafaa_acting_role('integrations', array['A']);
  if v_role is null then return kafaa_refuse('fairness.suggestion_snapshot', 'skill_suggestion_fairness', v_day::text, 'forbidden', kafaa_fs81_msg('ssg.forbidden_fairness')); end if;
  if v_day > current_date or v_day < current_date - 366 then return kafaa_refuse('fairness.suggestion_snapshot', 'skill_suggestion_fairness', v_day::text, 'invalid', kafaa_fs81_msg('ssg.invalid_date'), v_role); end if;
  v_rows := kafaa_ssg_fairness_compute(v_day);
  v_period := coalesce(v_rows -> 0 ->> 'period', '');
  insert into kafaa_skill_suggestion_fairness (id, period, as_of, card, metric, dimension, group_key, n, positives, rate, ratio, suppressed, flagged, source, run_by, created_at)
  select x ->> 'id', x ->> 'period', (x ->> 'as_of')::date, x ->> 'card', x ->> 'metric', x ->> 'dimension', x ->> 'group_key', (x ->> 'n')::integer, (x ->> 'positives')::integer,
    (x ->> 'rate')::numeric, (x ->> 'ratio')::numeric, (x ->> 'suppressed')::boolean, (x ->> 'flagged')::boolean, x ->> 'source', me, now()
  from jsonb_array_elements(v_rows) x
  on conflict (id) do update set n = excluded.n, positives = excluded.positives, rate = excluded.rate, ratio = excluded.ratio, suppressed = excluded.suppressed, flagged = excluded.flagged,
    as_of = excluded.as_of, run_by = excluded.run_by, created_at = excluded.created_at;
  select count(*) filter (where (x ->> 'flagged')::boolean)::int, count(*) filter (where (x ->> 'suppressed')::boolean)::int into v_flag, v_sup from jsonb_array_elements(v_rows) x;
  l := kafaa_ledger('kafaa.ai.suggestion_fairness', 'Skill-suggestion fairness snapshot ' || v_period || ': ' || v_flag || ' flagged, ' || v_sup || ' suppressed');
  a := kafaa_audit('fairness.suggestion_snapshot', 'skill_suggestion_fairness', v_period, 'ok', jsonb_array_length(v_rows) || ' rows ' || v_flag || ' flagged ' || v_sup || ' suppressed',
    case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Fairness snapshot stored', a, l, jsonb_build_object('period', v_period, 'as_of', to_char(v_day, 'YYYY-MM-DD'), 'rows', jsonb_array_length(v_rows), 'flagged', v_flag, 'suppressed', v_sup));
end $$;

create or replace function kafaa_suggestion_stats() returns jsonb language plpgsql security definer set search_path = public as $$
declare v_people integer; v_open integer; v_conf integer; v_rej integer; v_nm integer; v_exp integer; v_den integer; d jsonb;
begin
  if kafaa_me() is null then return kafaa_refuse('skill_suggestions.stats', 'skill_suggestions', null, 'not_signed_in', kafaa_fs81_msg('ssg.not_signed_in')); end if;
  if not kafaa_has_grant('skills_profile', array['Agg', 'A']) and not kafaa_has_grant('workforce_strategy', array['Agg', 'R', 'W', 'A']) and not kafaa_has_grant('integrations', array['R', 'A']) then
    return kafaa_refuse('skill_suggestions.stats', 'skill_suggestions', null, 'forbidden', kafaa_fs81_msg('ssg.forbidden_stats')); end if;
  select count(distinct person_id)::int, count(*) filter (where status = 'open')::int, count(*) filter (where status = 'confirmed')::int, count(*) filter (where status = 'rejected')::int,
    count(*) filter (where status = 'not_me')::int, count(*) filter (where status = 'expired')::int into v_people, v_open, v_conf, v_rej, v_nm, v_exp from kafaa_skill_suggestions;
  v_den := v_conf + v_rej + v_nm;
  d := jsonb_build_object('people', case when v_people < 10 then null else v_people end, 'open', case when v_open < 10 then null else v_open end,
    'confirmed', case when v_conf < 10 then null else v_conf end, 'rejected', case when v_rej < 10 then null else v_rej end, 'not_me', case when v_nm < 10 then null else v_nm end,
    'expired', case when v_exp < 10 then null else v_exp end, 'confirm_rate', case when v_den >= 10 then floor((v_conf * 2000 + v_den)::numeric / (2 * v_den)) / 10 end);
  d := d || jsonb_build_object('suppressed', (v_people < 10 or v_open < 10 or v_conf < 10 or v_rej < 10 or v_nm < 10 or v_exp < 10));
  return jsonb_build_object('ok', true, 'code', 'ok', 'message', 'Suggestion statistics', 'audit_seq', null, 'ledger_seq', null, 'data', d);
end $$;

-- ───────────── FS55: the engine card of the new ranked surface (seeded identically by scripts/seed/ext/fs70-skill-signals.mjs)
insert into kafaa_engine_cards (id, engine_surface, module, route, feature, title_en, title_ar, purpose_en, purpose_ar, owner_en, owner_ar, inputs_used, inputs_excluded, scoring_functions, weight_keys, output_en, output_ar, oversight_en, oversight_ar, limitations_en, limitations_ar, opt_out, version, last_changed_at, last_change_id, sources, sort, kernel_surface, ranks, fairness_metric, fairness_none)
values ('skill_suggestions',
  'skills',
  'M28',
  '/my/skills/suggestions',
  'FS72',
  'Skills you may have',
  'مهارات قد تمتلكها',
  'Suggests up to six skills I may already have, from my work and learning records, so I can confirm, reject or say "not me". Nothing is shown to anyone else until I confirm.',
  'يقترح حتى ست مهارات قد أمتلكها بالفعل، من سجلات عملي وتعلّمي، لأؤكدها أو أرفضها أو أقول "لا تخصني". لا يظهر شيء لأي شخص آخر حتى أؤكد.',
  'Training Manager (role card)',
  'مدير التدريب (بطاقة دور)',
  '[{"key":"person_skills","en":"The skills I already hold and how each is evidenced (held skills are never suggested)","ar":"المهارات التي أمتلكها وكيف ثبتت كل منها (لا تُقترح المهارات المثبتة)"},{"key":"opportunity_applications","en":"Gigs and opportunities I completed, and which skills the signed-off outcome levelled","ar":"الفرص والمهام التي أكملتها، والمهارات التي حدّد مستواها الاعتماد النهائي"},{"key":"contributions","en":"My validated expert contributions (lectures and knowledge assets)","ar":"مساهماتي الخبيرة المعتمدة (المحاضرات وأصول المعرفة)"},{"key":"xapi_statements","en":"My learning-record statements in the last year (refresher answers, simulator scenarios, knowledge assets used)","ar":"بيانات سجل تعلّمي خلال العام الماضي (إجابات المراجعات وسيناريوهات المحاكي وأصول المعرفة المستخدمة)"},{"key":"skill_co_occurrence","en":"Which skills staff hold together (counts only, groups under 10 never used, me excluded)","ar":"المهارات التي يمتلكها الموظفون معاً (أعداد فقط، لا تُستخدم المجموعات الأقل من 10، وأنا مستبعد)"},{"key":"skills_adjacency","en":"The catalogue''s list of skills next to each other","ar":"قائمة الكتالوج للمهارات المتجاورة"}]'::jsonb,
  array['gender', 'nationality_flag', 'age']::text[],
  array['src/modules/m28/suggestions.ts#inferSuggestions', 'sql:kafaa_ssg_candidates']::text[],
  array[]::text[],
  'Up to six suggestions, strongest first, each with its reasons; confirming adds my own claim (never more than claimed), rejecting or "not me" hides it for 180 days.',
  'حتى ستة اقتراحات، الأقوى أولاً، لكل منها أسبابه؛ التأكيد يضيف ادعائي الخاص (ولا يتجاوز درجة الادعاء)، والرفض أو "لا تخصني" يخفيه 180 يوماً.',
  'The rules and points are published on the card and the page; suggestions are private to me and never reach a manager. It never decides anything on its own: I choose, and a claim stays a claim until someone validates it.',
  'القواعد والنقاط منشورة على البطاقة والصفحة؛ والاقتراحات خاصة بي ولا تصل إلى أي مدير. لا يقرّر شيئاً بمفرده: أنا من يختار، ويبقى الادعاء ادعاءً حتى يعتمده شخص.',
  'It only sees what Kafa''a records; a skill learned elsewhere will not be suggested. Co-occurrence reflects who holds what today, not what a role needs.',
  'لا يرى إلا ما تسجّله كفاءة؛ ولن تُقترح مهارة اكتُسبت في مكان آخر. ويعكس الاقتران من يمتلك ماذا اليوم، لا ما يحتاجه الدور.',
  false,
  1,
  '2026-10-11T00:00:00Z'::timestamptz,
  null,
  '[{"label":"TechWolf · Workday customer story (skills inference with governance)","url":"https://www.techwolf.ai/customer-stories/workday","as_of":"2026-10-11"},{"label":"LinkedIn Economic Graph research","url":"https://economicgraph.linkedin.com/research","as_of":"2026-10-11"}]'::jsonb,
  35,
  'rules',
  'content',
  'suggestion_offered',
  null)
on conflict (id) do nothing;

-- ───────────── Grants: internal helpers are not executable by API roles; the twelve RPCs only by signed-in users.
revoke all on function kafaa_fs81_msg(text), kafaa_rs_bounds(text), kafaa_rs_prev(text), kafaa_rs_computable(text, date), kafaa_rs_closed(text, date), kafaa_rs_counts(text), kafaa_rs_compute(text),
  kafaa_mp_median(integer[]), kafaa_mp_summary(integer), kafaa_ht_brand_hits(text), kafaa_ht_len(jsonb), kafaa_ht_text(jsonb), kafaa_ht_problem(jsonb, boolean), kafaa_ht_window(text),
  kafaa_ht_compute(text), kafaa_ssg_candidates(text, date), kafaa_ssg_fairness_compute(date) from public, anon, authenticated;
revoke all on function kafaa_compute_skill_signals(text), kafaa_publish_skill_signals(text, text, text), kafaa_submit_manager_pulse(jsonb), kafaa_manager_pulse_summary(integer),
  kafaa_save_technology(jsonb), kafaa_tag_technology(jsonb), kafaa_compute_technology_badges(text), kafaa_publish_technology_badges(text), kafaa_refresh_skill_suggestions(),
  kafaa_respond_suggestion(text, text), kafaa_run_suggestion_fairness(date), kafaa_suggestion_stats() from public, anon;
grant execute on function kafaa_compute_skill_signals(text), kafaa_publish_skill_signals(text, text, text), kafaa_submit_manager_pulse(jsonb), kafaa_manager_pulse_summary(integer),
  kafaa_save_technology(jsonb), kafaa_tag_technology(jsonb), kafaa_compute_technology_badges(text), kafaa_publish_technology_badges(text), kafaa_refresh_skill_suggestions(),
  kafaa_respond_suggestion(text, text), kafaa_run_suggestion_fairness(date), kafaa_suggestion_stats() to authenticated;
