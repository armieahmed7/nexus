-- [W2 · E5 · F16, F17] Kafa'a Leadership and communities (M22): Enterprise Nuclear Leadership Academy pathway (programmes with
-- CNS-sourced facts, nominations with maker-checker decisions, leadership behaviours 360 shown only as aggregates) and communities of
-- practice (membership, moderated Q&A with a security/safeguards/cyber posting blocker, expert finder for opted-in people only,
-- in-app expert requests, knowledge-sharing session catalogue).
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file, RLS in the per-statement form,
-- internal helpers (not executable by API roles) and the RPCs. LocalBackend mirror: src/modules/m22/backend/local.ts; rules:
-- src/modules/m22/domain.ts. PGlite checks: scripts/validate/w2e5-leadership.mjs. No new policy resource: the M22 tables use
-- skills_profile, talent_review, own_profile, knowledge, public_content and audit_log rows added earlier.

-- ───────────── Tables (generated DDL)
-- M22 · Enterprise Nuclear Leadership Academy programmes with published facts and sources (F16)
create table if not exists kafaa_leadership_programmes (
  id text primary key,
  code text not null unique,
  kind text not null check (kind in ('course', 'programme', 'coaching', 'mentoring', 'external')),
  title_en text not null,
  title_ar text not null,
  summary_en text not null,
  summary_ar text not null,
  audience_en text not null,
  audience_ar text not null,
  duration_en text not null,
  duration_ar text not null,
  duration_days numeric,
  completions integer,
  completions_year integer,
  fact_en text not null default '',
  fact_ar text not null default '',
  steps text[] not null default '{}'::text[],
  mandatory_steps text[] not null default '{}'::text[],
  required_tracks text[] not null default '{}'::text[],
  skill_ids text[] not null default '{}'::text[],
  behaviour_ids text[] not null default '{}'::text[],
  nominable boolean not null default true,
  course_id text,
  link_route text,
  sources jsonb not null default '[]'::jsonb,
  sort integer not null default 0
);
comment on table kafaa_leadership_programmes is '[M22] Enterprise Nuclear Leadership Academy programmes with published facts and sources (F16)';

-- M22 · Nomination of a person to a leadership programme: manager nominates, HR decides (maker-checker) (F16)
create table if not exists kafaa_leadership_nominations (
  id text primary key,
  person_id text not null,
  programme_id text not null,
  nominated_by text not null,
  reason text not null,
  cycle text not null,
  status text not null default 'nominated' check (status in ('nominated', 'approved', 'declined', 'completed')),
  person_name text not null default '',
  person_name_ar text not null default '',
  person_role_id text,
  person_family_id text,
  nominator_name text not null default '',
  nominator_name_ar text not null default '',
  decided_by text,
  decided_at timestamptz,
  decision_note text,
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table kafaa_leadership_nominations is '[M22] Nomination of a person to a leadership programme: manager nominates, HR decides (maker-checker) (F16)';

-- M22 · Leadership behaviours 360: an invitation to rate a colleague (rater-only rows) (F16)
create table if not exists kafaa_leadership_360_requests (
  id text primary key,
  cycle text not null,
  subject_id text not null,
  rater_id text not null,
  rater_kind text not null check (rater_kind in ('self', 'manager', 'peer', 'report')),
  status text not null default 'invited' check (status in ('invited', 'submitted')),
  subject_name text not null default '',
  subject_name_ar text not null default '',
  invited_at timestamptz not null default now(),
  submitted_at timestamptz
);
comment on table kafaa_leadership_360_requests is '[M22] Leadership behaviours 360: an invitation to rate a colleague (rater-only rows) (F16)';

-- M22 · Leadership behaviours 360 responses: anonymous scores, read only as aggregates through RPCs (F16)
create table if not exists kafaa_leadership_360 (
  id text primary key,
  cycle text not null,
  subject_id text not null,
  rater_kind text not null check (rater_kind in ('self', 'manager', 'peer', 'report')),
  scores jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  open_read boolean not null default false
);
comment on table kafaa_leadership_360 is '[M22] Leadership behaviours 360 responses: anonymous scores, read only as aggregates through RPCs (F16)';

-- M22 · Communities of practice by discipline: charter, steward role card (F17)
create table if not exists kafaa_communities (
  id text primary key,
  code text not null unique,
  discipline text not null check (discipline in ('operations', 'maintenance', 'chemistry', 'radiation_protection', 'engineering', 'digital_ai', 'human_performance')),
  name_en text not null,
  name_ar text not null,
  charter_en text not null,
  charter_ar text not null,
  steward_role_en text not null,
  steward_role_ar text not null,
  skill_ids text[] not null default '{}'::text[],
  open boolean not null default true,
  sort integer not null default 0
);
comment on table kafaa_communities is '[M22] Communities of practice by discipline: charter, steward role card (F17)';

-- M22 · Community membership (member or steward) (F17)
create table if not exists kafaa_community_members (
  id text primary key,
  community_id text not null,
  person_id text not null,
  role text not null default 'member' check (role in ('member', 'steward')),
  active boolean not null default true,
  person_name text not null default '',
  person_name_ar text not null default '',
  person_role_id text,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table kafaa_community_members is '[M22] Community membership (member or steward) (F17)';

-- M22 · Community Q&A thread (moderated) (F17)
create table if not exists kafaa_threads (
  id text primary key,
  community_id text not null,
  title text not null,
  lang text not null default 'en' check (lang in ('en', 'ar')),
  author_id text not null,
  author_name text not null default '',
  author_name_ar text not null default '',
  first_post_id text,
  status text not null default 'open' check (status in ('open', 'closed')),
  visible boolean not null default true,
  reply_count integer not null default 0,
  last_post_at timestamptz not null default now(),
  skill_ids text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);
comment on table kafaa_threads is '[M22] Community Q&A thread (moderated) (F17)';

-- M22 · Community post with moderation status (F17)
create table if not exists kafaa_posts (
  id text primary key,
  thread_id text not null,
  community_id text not null,
  author_id text not null,
  author_name text not null default '',
  author_name_ar text not null default '',
  body text not null,
  lang text not null default 'en' check (lang in ('en', 'ar')),
  status text not null default 'published' check (status in ('published', 'held', 'hidden')),
  visible boolean not null default true,
  moderated_by text,
  moderated_at timestamptz,
  moderation_note text,
  created_at timestamptz not null default now()
);
comment on table kafaa_posts is '[M22] Community post with moderation status (F17)';

-- M22 · Expert finder opt-in: skills I am happy to be found for (level 3 or above), visible or hidden (F17)
create table if not exists kafaa_expert_optin (
  id text primary key,
  person_id text not null unique,
  skill_ids text[] not null default '{}'::text[],
  visible boolean not null default true,
  headline text not null default '',
  person_name text not null default '',
  person_name_ar text not null default '',
  role_id text,
  family_id text,
  team_id text,
  updated_at timestamptz not null default now()
);
comment on table kafaa_expert_optin is '[M22] Expert finder opt-in: skills I am happy to be found for (level 3 or above), visible or hidden (F17)';

-- M22 · In-app request to an opted-in expert (no contact details are exchanged) (F17)
create table if not exists kafaa_expert_requests (
  id text primary key,
  expert_id text not null,
  requester_id text not null,
  skill_id text not null,
  message text not null,
  status text not null default 'sent' check (status in ('sent', 'accepted', 'declined')),
  reply text,
  requester_name text not null default '',
  requester_name_ar text not null default '',
  expert_name text not null default '',
  expert_name_ar text not null default '',
  created_at timestamptz not null default now(),
  answered_at timestamptz
);
comment on table kafaa_expert_requests is '[M22] In-app request to an opted-in expert (no contact details are exchanged) (F17)';

-- M22 · Knowledge-sharing session catalogue: held sessions with recordings (synthetic links) and upcoming events (F17)
create table if not exists kafaa_ks_sessions (
  id text primary key,
  community_id text,
  topic text not null check (topic in ('proficiency', 'outage_lessons', 'project_management', 'ai', 'mcr_overview', 'radiation_safety', 'data_analytics', 'human_performance', 'chemistry', 'maintenance')),
  title_en text not null,
  title_ar text not null,
  summary_en text not null,
  summary_ar text not null,
  presenter_role_en text not null,
  presenter_role_ar text not null,
  held_on date not null,
  status text not null check (status in ('held', 'upcoming')),
  duration_min integer not null default 60,
  recording_ref text,
  keywords text[] not null default '{}'::text[],
  skill_ids text[] not null default '{}'::text[],
  synthetic boolean not null default true,
  sources jsonb not null default '[]'::jsonb
);
comment on table kafaa_ks_sessions is '[M22] Knowledge-sharing session catalogue: held sessions with recordings (synthetic links) and upcoming events (F17)';

-- Foreign keys and indexes
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_leadership_programmes_course_id_fk') then alter table kafaa_leadership_programmes add constraint kafaa_leadership_programmes_course_id_fk foreign key (course_id) references kafaa_courses(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_leadership_nominations_person_id_fk') then alter table kafaa_leadership_nominations add constraint kafaa_leadership_nominations_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_leadership_nominations_programme_id_fk') then alter table kafaa_leadership_nominations add constraint kafaa_leadership_nominations_programme_id_fk foreign key (programme_id) references kafaa_leadership_programmes(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_leadership_nominations_nominated_by_fk') then alter table kafaa_leadership_nominations add constraint kafaa_leadership_nominations_nominated_by_fk foreign key (nominated_by) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_leadership_360_requests_subject_id_fk') then alter table kafaa_leadership_360_requests add constraint kafaa_leadership_360_requests_subject_id_fk foreign key (subject_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_leadership_360_requests_rater_id_fk') then alter table kafaa_leadership_360_requests add constraint kafaa_leadership_360_requests_rater_id_fk foreign key (rater_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_leadership_360_subject_id_fk') then alter table kafaa_leadership_360 add constraint kafaa_leadership_360_subject_id_fk foreign key (subject_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_community_members_community_id_fk') then alter table kafaa_community_members add constraint kafaa_community_members_community_id_fk foreign key (community_id) references kafaa_communities(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_community_members_person_id_fk') then alter table kafaa_community_members add constraint kafaa_community_members_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_threads_community_id_fk') then alter table kafaa_threads add constraint kafaa_threads_community_id_fk foreign key (community_id) references kafaa_communities(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_threads_author_id_fk') then alter table kafaa_threads add constraint kafaa_threads_author_id_fk foreign key (author_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_posts_thread_id_fk') then alter table kafaa_posts add constraint kafaa_posts_thread_id_fk foreign key (thread_id) references kafaa_threads(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_posts_community_id_fk') then alter table kafaa_posts add constraint kafaa_posts_community_id_fk foreign key (community_id) references kafaa_communities(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_posts_author_id_fk') then alter table kafaa_posts add constraint kafaa_posts_author_id_fk foreign key (author_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_expert_optin_person_id_fk') then alter table kafaa_expert_optin add constraint kafaa_expert_optin_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_expert_requests_expert_id_fk') then alter table kafaa_expert_requests add constraint kafaa_expert_requests_expert_id_fk foreign key (expert_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_expert_requests_requester_id_fk') then alter table kafaa_expert_requests add constraint kafaa_expert_requests_requester_id_fk foreign key (requester_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_expert_requests_skill_id_fk') then alter table kafaa_expert_requests add constraint kafaa_expert_requests_skill_id_fk foreign key (skill_id) references kafaa_skills(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_ks_sessions_community_id_fk') then alter table kafaa_ks_sessions add constraint kafaa_ks_sessions_community_id_fk foreign key (community_id) references kafaa_communities(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_leadership_programmes_course_id_idx on kafaa_leadership_programmes (course_id);
create index if not exists kafaa_leadership_nominations_person_id_idx on kafaa_leadership_nominations (person_id);
create index if not exists kafaa_leadership_nominations_programme_id_idx on kafaa_leadership_nominations (programme_id);
create index if not exists kafaa_leadership_nominations_nominated_by_idx on kafaa_leadership_nominations (nominated_by);
create index if not exists kafaa_leadership_nominations_status_idx on kafaa_leadership_nominations (status);
create index if not exists kafaa_leadership_360_requests_cycle_idx on kafaa_leadership_360_requests (cycle);
create index if not exists kafaa_leadership_360_requests_subject_id_idx on kafaa_leadership_360_requests (subject_id);
create index if not exists kafaa_leadership_360_requests_rater_id_idx on kafaa_leadership_360_requests (rater_id);
create index if not exists kafaa_leadership_360_cycle_idx on kafaa_leadership_360 (cycle);
create index if not exists kafaa_leadership_360_subject_id_idx on kafaa_leadership_360 (subject_id);
create index if not exists kafaa_community_members_community_id_idx on kafaa_community_members (community_id);
create index if not exists kafaa_community_members_person_id_idx on kafaa_community_members (person_id);
create index if not exists kafaa_threads_community_id_idx on kafaa_threads (community_id);
create index if not exists kafaa_threads_author_id_idx on kafaa_threads (author_id);
create index if not exists kafaa_posts_thread_id_idx on kafaa_posts (thread_id);
create index if not exists kafaa_posts_community_id_idx on kafaa_posts (community_id);
create index if not exists kafaa_posts_author_id_idx on kafaa_posts (author_id);
create index if not exists kafaa_posts_status_idx on kafaa_posts (status);
create index if not exists kafaa_expert_requests_expert_id_idx on kafaa_expert_requests (expert_id);
create index if not exists kafaa_expert_requests_requester_id_idx on kafaa_expert_requests (requester_id);
create index if not exists kafaa_expert_requests_skill_id_idx on kafaa_expert_requests (skill_id);
create index if not exists kafaa_ks_sessions_community_id_idx on kafaa_ks_sessions (community_id);

-- ───────────── RLS (policies created when missing, then set to the per-statement form like 20261008140000_kafaa_rls_perf.sql)
alter table kafaa_leadership_programmes enable row level security;
alter table kafaa_leadership_nominations enable row level security;
alter table kafaa_leadership_360_requests enable row level security;
alter table kafaa_leadership_360 enable row level security;
alter table kafaa_communities enable row level security;
alter table kafaa_community_members enable row level security;
alter table kafaa_threads enable row level security;
alter table kafaa_posts enable row level security;
alter table kafaa_expert_optin enable row level security;
alter table kafaa_expert_requests enable row level security;
alter table kafaa_ks_sessions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_leadership_programmes' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_leadership_programmes for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_leadership_nominations' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_leadership_nominations for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_leadership_360_requests' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_leadership_360_requests for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_leadership_360' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_leadership_360 for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_communities' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_communities for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_community_members' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_community_members for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_threads' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_threads for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_posts' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_posts for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_expert_optin' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_expert_optin for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_expert_requests' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_expert_requests for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_ks_sessions' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_ks_sessions for select to anon, authenticated using (false)'; end if;
end $$;
alter policy kafaa_read on kafaa_leadership_programmes using ((((SELECT kafaa_has_grant('public_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_leadership_nominations using ((((SELECT kafaa_has_grant('skills_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('skills_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('skills_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('skills_profile'::text, person_id, NULL::text, false))) OR (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((nominated_by = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, nominated_by, NULL::text, false))) OR (((SELECT kafaa_has_grant('talent_review'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('talent_review'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('talent_review'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('talent_review'::text, person_id, NULL::text, false))) OR (((SELECT kafaa_has_grant('audit_log'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_leadership_360_requests using ((((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((rater_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, rater_id, NULL::text, false))));
alter policy kafaa_read on kafaa_leadership_360 using (((COALESCE(open_read, false) AND (SELECT kafaa_has_grant('audit_log'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_communities using ((((SELECT kafaa_has_grant('knowledge'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_community_members using ((((SELECT kafaa_has_grant('knowledge'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_threads using (((COALESCE(visible, false) AND (SELECT kafaa_has_grant('knowledge'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))) OR (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((author_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, author_id, NULL::text, false))) OR (((SELECT kafaa_has_grant('audit_log'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_posts using (((COALESCE(visible, false) AND (SELECT kafaa_has_grant('knowledge'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))) OR (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((author_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, author_id, NULL::text, false))) OR (((SELECT kafaa_has_grant('audit_log'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_expert_optin using (((COALESCE(visible, false) AND (SELECT kafaa_has_grant('knowledge'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))) OR (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false))) OR (((SELECT kafaa_has_grant('audit_log'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_expert_requests using ((((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((requester_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, requester_id, NULL::text, false))) OR (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((expert_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, expert_id, NULL::text, false))) OR (((SELECT kafaa_has_grant('audit_log'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_ks_sessions using ((((SELECT kafaa_has_grant('knowledge'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
-- Every M22 table is read-only for API roles: reference data, or rows written only by the SECURITY DEFINER RPCs below.
revoke insert, update on kafaa_leadership_programmes, kafaa_leadership_nominations, kafaa_leadership_360_requests, kafaa_leadership_360, kafaa_communities, kafaa_community_members, kafaa_threads, kafaa_posts, kafaa_expert_optin, kafaa_expert_requests, kafaa_ks_sessions from anon, authenticated;
grant select on kafaa_leadership_programmes, kafaa_leadership_nominations, kafaa_leadership_360_requests, kafaa_leadership_360, kafaa_communities, kafaa_community_members, kafaa_threads, kafaa_posts, kafaa_expert_optin, kafaa_expert_requests, kafaa_ks_sessions to anon, authenticated;

-- ───────────── Internal helpers (mirror of src/modules/m22/domain.ts)
create or replace function kafaa_lead_cycle(p_day date) returns text language sql immutable set search_path = public as $$
  select to_char(p_day, 'YYYY') || '-H' || case when extract(month from p_day) <= 6 then '1' else '2' end
$$;
create or replace function kafaa_lead_hist(p_status text, p_note text) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'status', p_status, 'by', kafaa_me(), 'note', nullif(btrim(coalesce(p_note, '')), ''))
$$;
create or replace function kafaa_lead_notify(p_id text, p_person text, p_kind text, p_en text, p_ar text, p_link text, p_sev text) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_person is null or not exists (select 1 from kafaa_people where id = p_person) then return; end if;
  insert into kafaa_notifications (id, person_id, kind, title_en, title_ar, link, severity) values (p_id, p_person, p_kind, p_en, p_ar, p_link, p_sev) on conflict (id) do nothing;
end $$;
create or replace function kafaa_lead_rid(p_prefix text) returns text language sql volatile set search_path = public as $$
  select p_prefix || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 24)
$$;

-- Same normalisation as normPost(): lower case, Arabic diacritics and tatweel removed, letter forms unified, spaces collapsed.
create or replace function kafaa_cop_norm(p text) returns text language sql immutable set search_path = public as $$
  select btrim(regexp_replace(translate(regexp_replace(lower(coalesce(p, '')), '[' || chr(1611) || '-' || chr(1631) || chr(1648) || chr(1600) || ']', '', 'g'), 'إأآٱىةؤئ', 'اااايهوي'), '\s+', ' ', 'g'))
$$;
-- Posting blocker: the G5 Dalil refusal floor (strong patterns) for security, safeguards and cyber, plus enabled
-- kafaa_refusal_policies patterns for the same categories. Returns the first blocked category or null (postGuard()).
create or replace function kafaa_cop_guard(p_text text) returns text language plpgsql stable security definer set search_path = public as $$
declare
  n text := kafaa_cop_norm(p_text); c text; pat text; q text;
  f_security text[] := array['security arrangement', 'security arrangements', 'security plan', 'security measures', 'security setup', 'security system', 'security systems', 'perimeter', 'guard post', 'guard posts', 'guards', 'patrol', 'cctv', 'camera', 'cameras', 'weapon', 'armed', 'response force', 'physical protection system', 'how is the plant protected', 'how is barakah protected', 'protected area', 'vital area', 'drone', 'drones', 'intrusion', 'access control system', 'badge reader', 'sabotage', 'attack the', 'attack on', 'break into', 'get into the plant', 'sneak', 'bypass security', 'security weakness', 'security gaps', 'الترتيبات الأمنية', 'الإجراءات الأمنية', 'الحراس', 'الحراسة', 'كاميرات', 'السياج', 'الحماية المادية', 'نظام الحماية', 'هجوم', 'تخريب', 'طائرة مسيرة', 'طائرات مسيرة', 'اقتحام', 'التسلل']::text[];
  f_safeguards text[] := array['nuclear material inventory', 'material accounting', 'material balance', 'enrichment level', 'how much uranium', 'how much plutonium', 'fuel inventory', 'where is the fuel stored', 'spent fuel location', 'where is the spent fuel', 'diversion', 'مخزون المواد النووية', 'كمية اليورانيوم', 'مكان تخزين الوقود']::text[];
  f_cyber text[] := array['firewall', 'network diagram', 'network architecture', 'scada', 'plc', 'vulnerab', 'password', 'passwords', 'ip address', 'hack', 'hacking', 'exploit', 'malware', 'ransomware', 'data diode bypass', 'جدار الحماية', 'كلمة المرور', 'ثغرة', 'اختراق']::text[];
begin
  foreach c in array array['security', 'safeguards', 'cyber'] loop
    for pat in
      select x from unnest(case c when 'security' then f_security when 'safeguards' then f_safeguards else f_cyber end) x
      union all
      select x from kafaa_refusal_policies rp cross join lateral unnest(rp.patterns) x where rp.category = c and rp.enabled
    loop
      q := kafaa_cop_norm(pat);
      if q <> '' and position(q in n) > 0 then return c; end if;
    end loop;
  end loop;
  return null;
end $$;
-- Email addresses and phone numbers (hasContactDetails()).
create or replace function kafaa_cop_contact(p_text text) returns boolean language sql immutable set search_path = public as $$
  select coalesce(p_text, '') ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
      or regexp_replace(coalesce(p_text, ''), '[[:space:]()-]', '', 'g') ~ '(\+|00)[0-9]{8,}'
      or regexp_replace(coalesce(p_text, ''), '[[:space:]()-]', '', 'g') ~ '(^|[^0-9])0[0-9]{8,9}([^0-9]|$)'
$$;
create or replace function kafaa_cop_screen(p_text text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c text := kafaa_cop_guard(p_text);
begin
  if c is not null then
    return jsonb_build_object('code', 'restricted_content', 'message', 'Not posted: ' || c || ' content is not allowed in communities. Share careers, learning and lessons learned, never plant security, safeguards or cyber details');
  end if;
  if kafaa_cop_contact(p_text) then
    return jsonb_build_object('code', 'contact_details', 'message', 'Not posted: remove email addresses and phone numbers. Use an in-app expert request to connect with someone');
  end if;
  return null;
end $$;
create or replace function kafaa_cop_steward(p_community text, p_person text) returns boolean language sql stable security definer set search_path = public as $$
  select p_person is not null and exists (select 1 from kafaa_community_members m where m.community_id = p_community and m.person_id = p_person and m.role = 'steward' and m.active)
$$;
create or replace function kafaa_cop_recount(p_thread text) returns void language plpgsql security definer set search_path = public as $$
declare t kafaa_threads; f kafaa_posts;
begin
  select * into t from kafaa_threads where id = p_thread;
  if t.id is null then return; end if;
  select * into f from kafaa_posts where id = t.first_post_id;
  update kafaa_threads set
    visible = case when f.id is null then t.visible else f.status = 'published' end,
    reply_count = (select count(*) from kafaa_posts x where x.thread_id = p_thread and x.status = 'published' and x.id is distinct from t.first_post_id),
    last_post_at = coalesce((select max(x.created_at) from kafaa_posts x where x.thread_id = p_thread and x.status = 'published'), t.created_at)
  where id = p_thread;
end $$;
-- Nomination visibility (same rule as the RLS policy).
create or replace function kafaa_lead_nom_visible(n kafaa_leadership_nominations) returns boolean language sql stable security definer set search_path = public as $$
  select kafaa_rule_read('skills_profile', n.person_id, null, true) or kafaa_rule_read('own_profile', n.nominated_by, null, true)
      or kafaa_rule_read('talent_review', n.person_id, null, true) or kafaa_has_grant('audit_log', array['R','W','A'])
$$;
-- 360 score sheet: every behaviour once, whole numbers 1 to 5 (validScores()).
create or replace function kafaa_lead_scores(p jsonb) returns jsonb language plpgsql immutable set search_path = public as $$
declare b text; v jsonb; out jsonb := '{}'::jsonb;
  ids constant text[] := array['b-safety-values', 'b-accountability', 'b-questioning', 'b-communication', 'b-decisions', 'b-respect', 'b-learning', 'b-concerns'];
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

-- The subject's 360 view (summarise360()): aggregates only, nothing below 5 responses (self excluded).
create or replace function kafaa_lead_360_summary(p_subject text, p_cycle text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  ids constant text[] := array['b-safety-values', 'b-accountability', 'b-questioning', 'b-communication', 'b-decisions', 'b-respect', 'b-learning', 'b-concerns'];
  v_cycles text[]; c text; v_inv integer; v_resp integer; v_self jsonb; v_selfreq text; v_enough boolean; v_beh jsonb; v_invitees jsonb;
begin
  select coalesce(array_agg(x order by x collate "C" desc), '{}'::text[]) into v_cycles
    from (select distinct cycle as x from kafaa_leadership_360_requests where subject_id = p_subject) d;
  c := case when p_cycle is not null and p_cycle = any(v_cycles) then p_cycle else v_cycles[1] end;
  select count(*) into v_inv from kafaa_leadership_360_requests where subject_id = p_subject and cycle = c and rater_kind <> 'self';
  select id into v_selfreq from kafaa_leadership_360_requests where subject_id = p_subject and cycle = c and rater_kind = 'self' limit 1;
  select count(*) into v_resp from kafaa_leadership_360 where subject_id = p_subject and cycle = c and rater_kind <> 'self';
  select scores into v_self from kafaa_leadership_360 where subject_id = p_subject and cycle = c and rater_kind = 'self' limit 1;
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
       where r.subject_id = p_subject and r.cycle = c and r.rater_kind <> 'self'
       group by b.id, b.ord) x;
  end if;
  return jsonb_build_object('cycle', c, 'cycles', to_jsonb(v_cycles), 'invited', v_inv, 'responded', v_resp, 'self_submitted', v_self is not null,
    'self_request_id', v_selfreq, 'enough', v_enough, 'min_raters', 5, 'invitees', v_invitees, 'behaviours', case when v_enough then v_beh else null end);
end $$;

-- HR aggregates (computeLeadershipStats()): 360 by grade for subjects with >= 5 responses, nominations by status; < 10 suppressed.
create or replace function kafaa_lead_stats_compute() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  ids constant text[] := array['b-safety-values', 'b-accountability', 'b-questioning', 'b-communication', 'b-decisions', 'b-respect', 'b-learning', 'b-concerns'];
  c text; v_levels jsonb; v_noms jsonb;
begin
  -- the latest cycle in which at least one subject reached the response threshold (else the latest cycle at all)
  select max(x.cycle collate "C") into c from (select cycle, subject_id from kafaa_leadership_360 where rater_kind <> 'self' group by cycle, subject_id having count(*) >= 5) x;
  if c is null then select max(cycle collate "C") into c from kafaa_leadership_360; end if;
  with resp as (select r.subject_id, r.scores from kafaa_leadership_360 r where r.cycle = c and r.rater_kind <> 'self'),
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

-- ═════════════ F16 RPCs
-- Nominate (line managers, people they manage). A nominee never nominates themselves (self_nominate). Audited, no ledger.
create or replace function kafaa_nominate_leader(p_person_id text, p_programme_id text, p_reason text) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_ent text := coalesce(p_programme_id, '') || ':' || coalesce(p_person_id, ''); v_role text; p kafaa_people; nm kafaa_people; g kafaa_leadership_programmes;
  v_reason text := btrim(coalesce(p_reason, '')); v_id text; v_ts text := to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'); a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('leadership.nominate', 'leadership_nominations', v_ent, 'not_signed_in', 'Sign in to use the leadership academy'); end if;
  if p_person_id = me then return kafaa_refuse('leadership.nominate', 'leadership_nominations', v_ent, 'self_nominate', 'You cannot nominate yourself; ask your line manager', kafaa_acting_role('skills_profile', array['Own'])); end if;
  if not kafaa_role_grant('manager', 'skills_profile', 'Scope') then return kafaa_refuse('leadership.nominate', 'leadership_nominations', v_ent, 'forbidden', 'Only line managers can nominate someone for a leadership programme'); end if;
  v_role := 'manager';
  select * into p from kafaa_people where id = p_person_id;
  if p.id is null or p.kind <> 'staff' or p.status = 'leaver' then return kafaa_refuse('leadership.nominate', 'leadership_nominations', v_ent, 'not_found', 'Person not found', v_role); end if;
  if not (kafaa_in_scope('skills_profile', p_person_id) or p.manager_id is not distinct from me) then return kafaa_refuse('leadership.nominate', 'leadership_nominations', v_ent, 'not_in_scope', 'You can nominate only people you manage', v_role); end if;
  select * into g from kafaa_leadership_programmes where id = p_programme_id;
  if g.id is null then return kafaa_refuse('leadership.nominate', 'leadership_nominations', v_ent, 'not_found', 'Programme not found', v_role); end if;
  if not g.nominable then return kafaa_refuse('leadership.nominate', 'leadership_nominations', v_ent, 'invalid', 'This programme does not take nominations (see how to join on the programme page)', v_role); end if;
  if length(v_reason) < 10 or length(v_reason) > 500 then return kafaa_refuse('leadership.nominate', 'leadership_nominations', v_ent, 'invalid', 'Give a reason of 10 to 500 characters (what the person is ready for)', v_role); end if;
  if exists (select 1 from kafaa_leadership_nominations n where n.person_id = p_person_id and n.programme_id = p_programme_id and n.status in ('nominated', 'approved')) then
    return kafaa_refuse('leadership.nominate', 'leadership_nominations', v_ent, 'conflict', 'This person already has an open nomination for this programme', v_role);
  end if;
  select * into nm from kafaa_people where id = me;
  v_id := kafaa_lead_rid('ln');
  insert into kafaa_leadership_nominations (id, person_id, programme_id, nominated_by, reason, cycle, status, person_name, person_name_ar, person_role_id, person_family_id,
    nominator_name, nominator_name_ar, history, created_at, updated_at)
  values (v_id, p_person_id, p_programme_id, me, v_reason, kafaa_lead_cycle(current_date), 'nominated', p.display_name, coalesce(nullif(p.display_name_ar, ''), p.display_name), p.job_role_id, p.job_family_id,
    nm.display_name, coalesce(nullif(nm.display_name_ar, ''), nm.display_name), jsonb_build_array(jsonb_build_object('at', v_ts, 'status', 'nominated', 'by', me, 'note', null)), now(), now());
  perform kafaa_lead_notify('nt-' || v_id || '-nominated', p_person_id, 'leadership', 'You were nominated for ' || g.title_en, 'تم ترشيحك لبرنامج ' || g.title_ar, '/leadership', 'ok');
  a := kafaa_audit('leadership.nominate', 'leadership_nominations', v_id, 'ok', p_programme_id || ' for ' || p_person_id, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Nomination sent to HR for a decision', a, null, jsonb_build_object('id', v_id, 'status', 'nominated'));
end $$;

-- Decide (HR authority or training manager). Maker-checker: never the nominator, never the nominee. Ledger row.
create or replace function kafaa_decide_nomination(p_id text, p_decision text, p_note text default '') returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); n kafaa_leadership_nominations; g kafaa_leadership_programmes; v_role text; v_note text := btrim(coalesce(p_note, '')); a kafaa_audit_events; l integer; v_ok boolean;
begin
  if me is null then return kafaa_refuse('leadership.decide', 'leadership_nominations', p_id, 'not_signed_in', 'Sign in to use the leadership academy'); end if;
  select * into n from kafaa_leadership_nominations where id = p_id;
  if n.id is null or not kafaa_lead_nom_visible(n) then return kafaa_refuse('leadership.decide', 'leadership_nominations', p_id, 'not_found', 'Nomination not found'); end if;
  if kafaa_has_grant('talent_review', array['A']) then v_role := kafaa_acting_role('talent_review', array['A']);
  elsif kafaa_role_grant('training_manager', 'skills_profile', 'A') then v_role := 'training_manager';
  end if;
  if v_role is null then return kafaa_refuse('leadership.decide', 'leadership_nominations', p_id, 'forbidden', 'Only the HR authority or the training manager decides nominations'); end if;
  if n.person_id = me then return kafaa_refuse('leadership.decide', 'leadership_nominations', p_id, 'maker_checker', 'You cannot decide your own nomination', v_role); end if;
  if n.nominated_by = me then return kafaa_refuse('leadership.decide', 'leadership_nominations', p_id, 'maker_checker', 'The person who made the nomination cannot decide it', v_role); end if;
  if n.status <> 'nominated' then return kafaa_refuse('leadership.decide', 'leadership_nominations', p_id, 'invalid', 'This nomination has already been decided', v_role); end if;
  if p_decision is null or p_decision not in ('approved', 'declined') then return kafaa_refuse('leadership.decide', 'leadership_nominations', p_id, 'invalid', 'Unknown decision', v_role); end if;
  if p_decision = 'declined' and length(v_note) < 5 then return kafaa_refuse('leadership.decide', 'leadership_nominations', p_id, 'invalid', 'Give a reason when you decline a nomination', v_role); end if;
  update kafaa_leadership_nominations set status = p_decision, decided_by = me, decided_at = now(), decision_note = nullif(v_note, ''),
    history = history || jsonb_build_array(kafaa_lead_hist(p_decision, v_note)), updated_at = now() where id = p_id;
  select * into g from kafaa_leadership_programmes where id = n.programme_id;
  v_ok := p_decision = 'approved';
  perform kafaa_lead_notify('nt-' || p_id || '-' || p_decision, n.person_id, 'leadership',
    case when v_ok then 'Nomination approved: ' || g.title_en else 'Nomination not approved this time: ' || g.title_en end,
    case when v_ok then 'تمت الموافقة على الترشيح: ' || g.title_ar else 'لم تتم الموافقة على الترشيح هذه المرة: ' || g.title_ar end, '/leadership', case when v_ok then 'ok' else 'info' end);
  perform kafaa_lead_notify('nt-' || p_id || '-' || p_decision || '-by', n.nominated_by, 'leadership', 'Your nomination of ' || n.person_name || ' was ' || p_decision,
    case when v_ok then 'تمت الموافقة على ترشيحك لـ ' || n.person_name_ar else 'لم تتم الموافقة على ترشيحك لـ ' || n.person_name_ar end, '/leadership/nominations', case when v_ok then 'ok' else 'info' end);
  l := kafaa_ledger('kafaa.leadership.nomination', format('Nomination %s (%s) %s', p_id, n.programme_id, p_decision));
  a := kafaa_audit('leadership.decide', 'leadership_nominations', p_id, 'ok', p_decision, case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when v_ok then 'Nomination approved' else 'Nomination declined' end, a, l, jsonb_build_object('status', p_decision));
end $$;

-- Ask 5 to 12 colleagues for leadership behaviours feedback this half-year; a self request is added. Audited, no ledger.
create or replace function kafaa_request_360(p_raters jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); c text := kafaa_lead_cycle(current_date); v_ent text; v_role text; e jsonb; v_n integer; v_have integer; v_fresh integer; v_total integer; s kafaa_people; v_id text; r record;
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
  select * into s from kafaa_people where id = me;
  insert into kafaa_leadership_360_requests (id, cycle, subject_id, rater_id, rater_kind, status, subject_name, subject_name_ar, invited_at)
  values ('l3q-' || c || '-' || me || '-' || me, c, me, me, 'self', 'invited', s.display_name, coalesce(nullif(s.display_name_ar, ''), s.display_name), now()) on conflict (id) do nothing;
  for r in select x->>'person_id' as pid, x->>'kind' as kind from jsonb_array_elements(p_raters) x
            where not exists (select 1 from kafaa_leadership_360_requests q where q.subject_id = me and q.cycle = c and q.rater_kind <> 'self' and q.rater_id = x->>'person_id')
            order by x->>'person_id' collate "C" loop
    v_id := 'l3q-' || c || '-' || me || '-' || r.pid;
    insert into kafaa_leadership_360_requests (id, cycle, subject_id, rater_id, rater_kind, status, subject_name, subject_name_ar, invited_at)
    values (v_id, c, me, r.pid, r.kind, 'invited', s.display_name, coalesce(nullif(s.display_name_ar, ''), s.display_name), now()) on conflict (id) do nothing;
    perform kafaa_lead_notify('nt-' || v_id, r.pid, 'leadership', 'Leadership 360: ' || s.display_name || ' asked for your feedback',
      'تقييم 360 القيادي: طلب ' || coalesce(nullif(s.display_name_ar, ''), s.display_name) || ' ملاحظاتك', '/leadership/360', 'info');
  end loop;
  return kafaa_result(true, 'ok', 'Feedback requested from ' || v_total || ' colleagues',
    kafaa_audit('leadership.360.request', 'leadership_360_requests', v_ent, 'ok', v_fresh || ' invited (' || v_total || ' total)', 'not_applicable', null, v_role), null,
    jsonb_build_object('cycle', c, 'invited', v_total, 'added', v_fresh));
end $$;

-- Submit a rating: only the invited rater, once; the response row carries no rater identity. Audited, no ledger.
create or replace function kafaa_submit_360(p_request_id text, p_scores jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; q kafaa_leadership_360_requests; s jsonb; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('leadership.360.submit', 'leadership_360_requests', p_request_id, 'not_signed_in', 'Sign in to use the leadership academy'); end if;
  v_role := kafaa_acting_role('own_profile', array['Own']);
  select * into q from kafaa_leadership_360_requests where id = p_request_id;
  if q.id is null or q.rater_id <> me then return kafaa_refuse('leadership.360.submit', 'leadership_360_requests', p_request_id, 'not_found', 'Feedback request not found', v_role); end if;
  if q.status = 'submitted' then return kafaa_refuse('leadership.360.submit', 'leadership_360_requests', p_request_id, 'conflict', 'You have already given this feedback', v_role); end if;
  s := kafaa_lead_scores(p_scores);
  if s is null then return kafaa_refuse('leadership.360.submit', 'leadership_360_requests', p_request_id, 'invalid', 'Rate every behaviour from 1 to 5', v_role); end if;
  insert into kafaa_leadership_360 (id, cycle, subject_id, rater_kind, scores, submitted_at, open_read) values (kafaa_lead_rid('l3'), q.cycle, q.subject_id, q.rater_kind, s, now(), false);
  update kafaa_leadership_360_requests set status = 'submitted', submitted_at = now() where id = q.id;
  a := kafaa_audit('leadership.360.submit', 'leadership_360_requests', q.id, 'ok', q.rater_kind, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Thank you: your feedback is recorded without your name', a, null, jsonb_build_object('status', 'submitted'));
end $$;

-- My own 360 (aggregates only; nothing below 5 responses).
create or replace function kafaa_my_360(p_cycle text default null) returns jsonb language sql stable security definer set search_path = public as $$
  select kafaa_lead_360_summary(coalesce(kafaa_me(), ''), p_cycle)
$$;

-- HR aggregates: skills_profile or talent_review Agg/A, or auditors (audit_log R). Null for everyone else.
create or replace function kafaa_leadership_stats() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if kafaa_me() is null or not (kafaa_has_grant('skills_profile', array['Agg','A']) or kafaa_has_grant('talent_review', array['Agg','A']) or kafaa_has_grant('audit_log', array['R'])) then return null; end if;
  return kafaa_lead_stats_compute();
end $$;

-- ═════════════ F17 RPCs
create or replace function kafaa_join_community(p_community_id text, p_join boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; com kafaa_communities; cur kafaa_community_members; v_id text; p kafaa_people;
begin
  if me is null then return kafaa_refuse('community.join', 'community_members', p_community_id, 'not_signed_in', 'Sign in to take part in communities'); end if;
  v_role := kafaa_acting_role('knowledge', array['R']);
  if v_role is null then return kafaa_refuse('community.join', 'community_members', p_community_id, 'forbidden', 'Communities are open to staff'); end if;
  select * into com from kafaa_communities where id = p_community_id;
  if com.id is null or not com.open then return kafaa_refuse('community.join', 'community_members', p_community_id, 'not_found', 'Community not found', v_role); end if;
  v_id := 'cm:' || p_community_id || ':' || me;
  select * into cur from kafaa_community_members where id = v_id;
  if p_join is distinct from false then
    if cur.id is null then
      select * into p from kafaa_people where id = me;
      insert into kafaa_community_members (id, community_id, person_id, role, active, person_name, person_name_ar, person_role_id, joined_at, updated_at)
      values (v_id, p_community_id, me, 'member', true, p.display_name, coalesce(nullif(p.display_name_ar, ''), p.display_name), p.job_role_id, now(), now());
    elsif not cur.active then update kafaa_community_members set active = true, updated_at = now() where id = v_id;
    end if;
    return kafaa_result(true, 'ok', 'You joined the community', kafaa_audit('community.join', 'community_members', v_id, 'ok', 'joined', 'not_applicable', null, v_role), null, jsonb_build_object('member', true));
  end if;
  if cur.id is not null and cur.active and cur.role = 'steward' then
    return kafaa_refuse('community.join', 'community_members', p_community_id, 'conflict', 'Stewards stay members of their community; ask the training manager to hand over first', v_role);
  end if;
  if cur.id is not null and cur.active then update kafaa_community_members set active = false, updated_at = now() where id = v_id; end if;
  return kafaa_result(true, 'ok', 'You left the community', kafaa_audit('community.join', 'community_members', v_id, 'ok', 'left', 'not_applicable', null, v_role), null, jsonb_build_object('member', false));
end $$;

-- Start a thread or reply (members only). Restricted content and contact details are refused; the audit row stores the
-- category, never the text. A member's first post in a community is held for a steward.
create or replace function kafaa_post_thread(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_cid text := coalesce(p->>'community_id', ''); v_role text; com kafaa_communities; mem kafaa_community_members; t kafaa_threads;
  v_tid text := nullif(p->>'thread_id', ''); v_title text := btrim(coalesce(p->>'title', '')); v_body text := btrim(coalesce(p->>'body', '')); v_bad jsonb;
  v_before integer; v_held boolean; v_status text; v_lang text; pp kafaa_people; v_post text; v_thread text; m record;
begin
  if me is null then return kafaa_refuse('community.post', 'posts', nullif(v_cid, ''), 'not_signed_in', 'Sign in to take part in communities'); end if;
  v_role := kafaa_acting_role('knowledge', array['R']);
  if v_role is null then return kafaa_refuse('community.post', 'posts', nullif(v_cid, ''), 'forbidden', 'Communities are open to staff'); end if;
  select * into com from kafaa_communities where id = v_cid;
  if com.id is null then return kafaa_refuse('community.post', 'posts', nullif(v_cid, ''), 'not_found', 'Community not found', v_role); end if;
  select * into mem from kafaa_community_members where id = 'cm:' || v_cid || ':' || me;
  if mem.id is null or not mem.active then return kafaa_refuse('community.post', 'posts', v_cid, 'not_member', 'Join this community to post in it', v_role); end if;
  if v_tid is not null then
    select * into t from kafaa_threads where id = v_tid;
    if t.id is null or t.community_id <> v_cid or not (t.visible or t.author_id = me) then return kafaa_refuse('community.post', 'posts', v_cid, 'not_found', 'Thread not found', v_role); end if;
    if t.status <> 'open' then return kafaa_refuse('community.post', 'posts', v_cid, 'invalid', 'This thread is closed to new replies', v_role); end if;
  elsif length(v_title) < 5 or length(v_title) > 140 then return kafaa_refuse('community.post', 'posts', v_cid, 'invalid', 'Give a title of 5 to 140 characters', v_role);
  end if;
  if length(v_body) < 10 or length(v_body) > 2000 then return kafaa_refuse('community.post', 'posts', v_cid, 'invalid', 'Write 10 to 2,000 characters', v_role); end if;
  v_bad := kafaa_cop_screen(case when v_tid is null then v_title else '' end || ' ' || v_body);
  if v_bad is not null then return kafaa_refuse('community.post', 'posts', v_cid, v_bad->>'code', v_bad->>'message', v_role); end if;
  if (select count(*) from kafaa_posts x where x.author_id = me and (x.created_at at time zone 'UTC')::date = (now() at time zone 'UTC')::date) >= 20 then
    return kafaa_refuse('community.post', 'posts', v_cid, 'limit', 'You have reached today''s posting limit (20 posts); try again tomorrow', v_role);
  end if;
  select count(*) into v_before from kafaa_posts x where x.community_id = v_cid and x.author_id = me and x.status = 'published';
  v_held := not kafaa_cop_steward(v_cid, me) and v_before = 0;
  v_status := case when v_held then 'held' else 'published' end;
  v_lang := case when p->>'lang' in ('en', 'ar') then p->>'lang' when v_body ~ '[؀-ۿ]' then 'ar' else 'en' end;
  select * into pp from kafaa_people where id = me;
  v_post := kafaa_lead_rid('po');
  v_thread := coalesce(v_tid, kafaa_lead_rid('th'));
  if v_tid is null then
    insert into kafaa_threads (id, community_id, title, lang, author_id, author_name, author_name_ar, first_post_id, status, visible, reply_count, last_post_at, skill_ids, created_at)
    values (v_thread, v_cid, v_title, v_lang, me, pp.display_name, coalesce(nullif(pp.display_name_ar, ''), pp.display_name), v_post, 'open', not v_held, 0, now(), '{}'::text[], now());
  end if;
  insert into kafaa_posts (id, thread_id, community_id, author_id, author_name, author_name_ar, body, lang, status, visible, created_at)
  values (v_post, v_thread, v_cid, me, pp.display_name, coalesce(nullif(pp.display_name_ar, ''), pp.display_name), v_body, v_lang, v_status, not v_held, now());
  if v_tid is not null and not v_held then perform kafaa_cop_recount(v_thread); end if;
  if v_held then
    for m in select person_id from kafaa_community_members where community_id = v_cid and role = 'steward' and active and person_id <> me order by person_id collate "C" loop
      perform kafaa_lead_notify('nt-' || v_post || '-held-' || m.person_id, m.person_id, 'community', 'Post waiting for review in ' || com.name_en, 'مشاركة بانتظار المراجعة في ' || com.name_ar, '/communities/' || v_cid, 'info');
    end loop;
  elsif t.id is not null and t.author_id <> me then
    perform kafaa_lead_notify('nt-' || v_post || '-reply', t.author_id, 'community', 'New reply: ' || t.title, 'رد جديد: ' || t.title, '/communities/thread/' || v_thread, 'info');
  end if;
  return kafaa_result(true, 'ok', case when v_held then 'Sent for review: a steward checks your first post in each community' else 'Posted' end,
    kafaa_audit('community.post', 'posts', v_post, 'ok', v_status || ' ' || case when v_tid is null then 'thread' else 'reply' end || ' in ' || v_cid, 'not_applicable', null, v_role), null,
    jsonb_build_object('thread_id', v_thread, 'post_id', v_post, 'status', v_status));
end $$;

-- Publish a held post or hide a post (stewards of that community, or knowledge A). Never one's own post.
create or replace function kafaa_moderate_post(p_post_id text, p_decision text, p_note text default '') returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); po kafaa_posts; t kafaa_threads; v_steward boolean; v_a boolean; v_role text; v_note text := btrim(coalesce(p_note, '')); v_status text;
begin
  if me is null then return kafaa_refuse('community.moderate', 'posts', p_post_id, 'not_signed_in', 'Sign in to take part in communities'); end if;
  select * into po from kafaa_posts where id = p_post_id;
  if po.id is null then return kafaa_refuse('community.moderate', 'posts', p_post_id, 'not_found', 'Post not found'); end if;
  v_steward := kafaa_cop_steward(po.community_id, me);
  v_a := kafaa_has_grant('knowledge', array['A']);
  v_role := case when v_a then kafaa_acting_role('knowledge', array['A']) when v_steward then kafaa_acting_role('knowledge', array['R']) end;
  if v_role is null or (not v_steward and not v_a) then return kafaa_refuse('community.moderate', 'posts', p_post_id, 'forbidden', 'Only the community stewards (or the training manager) moderate posts', v_role); end if;
  if po.author_id = me then return kafaa_refuse('community.moderate', 'posts', p_post_id, 'maker_checker', 'You cannot moderate your own post; another steward reviews it', v_role); end if;
  if p_decision is null or p_decision not in ('publish', 'hide') then return kafaa_refuse('community.moderate', 'posts', p_post_id, 'invalid', 'Unknown decision', v_role); end if;
  if p_decision = 'hide' and (length(v_note) < 5 or length(v_note) > 300) then return kafaa_refuse('community.moderate', 'posts', p_post_id, 'invalid', 'Give a reason when you hide a post (5 to 300 characters)', v_role); end if;
  v_status := case when p_decision = 'publish' then 'published' else 'hidden' end;
  if po.status = v_status then return kafaa_refuse('community.moderate', 'posts', p_post_id, 'invalid', 'This post already has that status', v_role); end if;
  update kafaa_posts set status = v_status, visible = v_status = 'published', moderated_by = me, moderated_at = now(), moderation_note = nullif(v_note, '') where id = p_post_id;
  perform kafaa_cop_recount(po.thread_id);
  select * into t from kafaa_threads where id = po.thread_id;
  perform kafaa_lead_notify('nt-' || p_post_id || '-' || v_status, po.author_id, 'community',
    case when v_status = 'published' then 'Your post is published: ' || t.title else 'Your post was hidden by a steward: ' || t.title end,
    case when v_status = 'published' then 'تم نشر مشاركتك: ' || t.title else 'أخفى المشرف مشاركتك: ' || t.title end, '/communities/thread/' || t.id, case when v_status = 'published' then 'ok' else 'warn' end);
  return kafaa_result(true, 'ok', case when v_status = 'published' then 'Post published' else 'Post hidden' end,
    kafaa_audit('community.moderate', 'posts', p_post_id, 'ok', p_decision, 'not_applicable', null, v_role), null, jsonb_build_object('status', v_status));
end $$;

-- Held posts in the communities I steward (every community for knowledge A).
create or replace function kafaa_moderation_queue() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); v_all boolean;
begin
  if me is null then return '[]'::jsonb; end if;
  v_all := kafaa_has_grant('knowledge', array['A']);
  return coalesce((select jsonb_agg(jsonb_build_object('post_id', x.id, 'thread_id', x.thread_id, 'thread_title', t.title, 'community_id', x.community_id, 'author_name', x.author_name,
      'author_name_ar', x.author_name_ar, 'body', x.body, 'first_post', t.first_post_id = x.id, 'created_at', to_char(x.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
      order by x.created_at, x.id collate "C")
    from kafaa_posts x join kafaa_threads t on t.id = x.thread_id
   where x.status = 'held' and (v_all or kafaa_cop_steward(x.community_id, me))), '[]'::jsonb);
end $$;

-- Expert finder opt-in (skills at level 3 or above; never security skills).
create or replace function kafaa_set_expert_optin(p_skill_ids text[], p_visible boolean, p_headline text default '') returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_ent text; v_role text; v_ids text[] := coalesce(p_skill_ids, '{}'::text[]); v_vis boolean := p_visible is distinct from false;
  v_head text := btrim(coalesce(p_headline, '')); v_bad jsonb; pp kafaa_people; v_sorted text[];
begin
  v_ent := case when me is null then null else 'eo:' || me end;
  if me is null then return kafaa_refuse('expert.optin', 'expert_optin', v_ent, 'not_signed_in', 'Sign in to take part in communities'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  if v_role is null then return kafaa_refuse('expert.optin', 'expert_optin', v_ent, 'forbidden', 'The expert finder is for staff with a skills passport'); end if;
  if exists (select 1 from unnest(v_ids) x where x is null) or (select count(distinct x) from unnest(v_ids) x) <> cardinality(v_ids) or cardinality(v_ids) > 8 or (v_vis and cardinality(v_ids) < 1)
     or exists (select 1 from unnest(v_ids) x where not exists (select 1 from kafaa_skills s where s.id = x)) then
    return kafaa_refuse('expert.optin', 'expert_optin', v_ent, 'invalid', 'Choose one to eight skills from the catalogue', v_role);
  end if;
  if exists (select 1 from kafaa_skills s where s.id = any(v_ids) and s.area = 'security') then
    return kafaa_refuse('expert.optin', 'expert_optin', v_ent, 'security_restricted', 'Security, safeguards and cyber skills are never listed in the expert finder', v_role);
  end if;
  if exists (select 1 from unnest(v_ids) x where coalesce((select ps.level from kafaa_person_skills ps where ps.person_id = me and ps.skill_id = x and ps.active), 0) < 3) then
    return kafaa_refuse('expert.optin', 'expert_optin', v_ent, 'level_too_low', 'You can list only skills at level 3 or above in your skills passport', v_role);
  end if;
  if length(v_head) > 140 then return kafaa_refuse('expert.optin', 'expert_optin', v_ent, 'invalid', 'Keep your headline under 140 characters', v_role); end if;
  if v_head <> '' then
    v_bad := kafaa_cop_screen(v_head);
    if v_bad is not null then return kafaa_refuse('expert.optin', 'expert_optin', v_ent, v_bad->>'code', v_bad->>'message', v_role); end if;
  end if;
  select * into pp from kafaa_people where id = me;
  v_sorted := array(select x from unnest(v_ids) x order by x collate "C");
  insert into kafaa_expert_optin (id, person_id, skill_ids, visible, headline, person_name, person_name_ar, role_id, family_id, team_id, updated_at)
  values (v_ent, me, v_sorted, v_vis, v_head, pp.display_name, coalesce(nullif(pp.display_name_ar, ''), pp.display_name), pp.job_role_id, pp.job_family_id, pp.team_id, now())
  on conflict (id) do update set skill_ids = excluded.skill_ids, visible = excluded.visible, headline = excluded.headline, person_name = excluded.person_name, person_name_ar = excluded.person_name_ar,
    role_id = excluded.role_id, family_id = excluded.family_id, team_id = excluded.team_id, updated_at = excluded.updated_at;
  return kafaa_result(true, 'ok', case when v_vis then 'You are listed in the expert finder' else 'You are hidden from the expert finder' end,
    kafaa_audit('expert.optin', 'expert_optin', v_ent, 'ok', case when v_vis then 'visible ' || cardinality(v_ids) || ' skills' else 'hidden' end, 'not_applicable', null, v_role), null,
    jsonb_build_object('visible', v_vis, 'skill_ids', to_jsonb(v_sorted)));
end $$;

-- Expert finder: visible opt-ins only, with their current level >= 3 on the skills they listed. No contact details.
create or replace function kafaa_find_experts(p_skill_id text default null) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me();
begin
  if me is null or not kafaa_has_grant('knowledge', array['R']) then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(z.e order by z.pid collate "C") from (
      select o.person_id as pid, jsonb_build_object('person_id', o.person_id, 'name', o.person_name, 'name_ar', o.person_name_ar, 'role_id', o.role_id, 'family_id', o.family_id,
               'team_id', o.team_id, 'headline', o.headline,
               'skills', (select jsonb_agg(jsonb_build_object('skill_id', s.skill_id, 'level', s.level, 'basis', s.basis) order by s.skill_id collate "C")
                            from kafaa_person_skills s where s.person_id = o.person_id and s.active and s.level >= 3 and s.skill_id = any(o.skill_ids))) as e
        from kafaa_expert_optin o join kafaa_people p on p.id = o.person_id
       where o.visible and o.person_id <> me and p.status <> 'leaver') z
     where z.e->'skills' <> 'null'::jsonb
       and (p_skill_id is null or exists (select 1 from jsonb_array_elements(z.e->'skills') k where k->>'skill_id' = p_skill_id))), '[]'::jsonb);
end $$;

-- In-app request to an opted-in expert (5 a day; message screened like a post).
create or replace function kafaa_request_expert(p_expert_id text, p_skill_id text, p_message text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; o kafaa_expert_optin; ex kafaa_people; pp kafaa_people; sk kafaa_skills; v_msg text := btrim(coalesce(p_message, '')); v_bad jsonb; v_id text;
begin
  if me is null then return kafaa_refuse('expert.request', 'expert_requests', p_expert_id, 'not_signed_in', 'Sign in to take part in communities'); end if;
  v_role := kafaa_acting_role('knowledge', array['R']);
  if v_role is null then return kafaa_refuse('expert.request', 'expert_requests', p_expert_id, 'forbidden', 'Communities are open to staff'); end if;
  if p_expert_id = me then return kafaa_refuse('expert.request', 'expert_requests', p_expert_id, 'conflict', 'You cannot send an expert request to yourself', v_role); end if;
  select * into o from kafaa_expert_optin where id = 'eo:' || p_expert_id;
  select * into ex from kafaa_people where id = p_expert_id;
  if o.id is null or not o.visible or ex.id is null or ex.status = 'leaver' or not (p_skill_id = any(o.skill_ids))
     or coalesce((select ps.level from kafaa_person_skills ps where ps.person_id = p_expert_id and ps.skill_id = p_skill_id and ps.active), 0) < 3 then
    return kafaa_refuse('expert.request', 'expert_requests', p_expert_id, 'not_found', 'Expert not found (they may have hidden their profile)', v_role);
  end if;
  if length(v_msg) < 10 or length(v_msg) > 500 then return kafaa_refuse('expert.request', 'expert_requests', p_expert_id, 'invalid', 'Write a message of 10 to 500 characters', v_role); end if;
  v_bad := kafaa_cop_screen(v_msg);
  if v_bad is not null then return kafaa_refuse('expert.request', 'expert_requests', p_expert_id, v_bad->>'code', v_bad->>'message', v_role); end if;
  if (select count(*) from kafaa_expert_requests x where x.requester_id = me and (x.created_at at time zone 'UTC')::date = (now() at time zone 'UTC')::date) >= 5 then
    return kafaa_refuse('expert.request', 'expert_requests', p_expert_id, 'limit', 'You can send up to five expert requests a day', v_role);
  end if;
  select * into pp from kafaa_people where id = me;
  select * into sk from kafaa_skills where id = p_skill_id;
  v_id := kafaa_lead_rid('er');
  insert into kafaa_expert_requests (id, expert_id, requester_id, skill_id, message, status, requester_name, requester_name_ar, expert_name, expert_name_ar, created_at)
  values (v_id, p_expert_id, me, p_skill_id, v_msg, 'sent', pp.display_name, coalesce(nullif(pp.display_name_ar, ''), pp.display_name), ex.display_name, coalesce(nullif(ex.display_name_ar, ''), ex.display_name), now());
  perform kafaa_lead_notify('nt-' || v_id, p_expert_id, 'community', 'Expert request about ' || sk.name_en || ' from ' || pp.display_name,
    'طلب خبرة حول ' || sk.name_ar || ' من ' || coalesce(nullif(pp.display_name_ar, ''), pp.display_name), '/communities/experts', 'info');
  return kafaa_result(true, 'ok', 'Request sent in the app', kafaa_audit('expert.request', 'expert_requests', v_id, 'ok', p_skill_id, 'not_applicable', null, v_role), null, jsonb_build_object('id', v_id));
end $$;

-- The expert accepts or declines, with an optional short reply.
create or replace function kafaa_answer_expert_request(p_id text, p_decision text, p_reply text default '') returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; q kafaa_expert_requests; v_reply text := btrim(coalesce(p_reply, '')); v_bad jsonb; v_ok boolean;
begin
  if me is null then return kafaa_refuse('expert.answer', 'expert_requests', p_id, 'not_signed_in', 'Sign in to take part in communities'); end if;
  v_role := kafaa_acting_role('knowledge', array['R']);
  select * into q from kafaa_expert_requests where id = p_id;
  if q.id is null or (q.expert_id <> me and q.requester_id <> me) then return kafaa_refuse('expert.answer', 'expert_requests', p_id, 'not_found', 'Request not found', v_role); end if;
  if q.expert_id <> me then return kafaa_refuse('expert.answer', 'expert_requests', p_id, 'forbidden', 'Only the expert who received the request can answer it', v_role); end if;
  if q.status <> 'sent' then return kafaa_refuse('expert.answer', 'expert_requests', p_id, 'invalid', 'This request has already been answered', v_role); end if;
  if p_decision is null or p_decision not in ('accepted', 'declined') then return kafaa_refuse('expert.answer', 'expert_requests', p_id, 'invalid', 'Unknown decision', v_role); end if;
  if length(v_reply) > 300 then return kafaa_refuse('expert.answer', 'expert_requests', p_id, 'invalid', 'Keep your reply under 300 characters', v_role); end if;
  if v_reply <> '' then
    v_bad := kafaa_cop_screen(v_reply);
    if v_bad is not null then return kafaa_refuse('expert.answer', 'expert_requests', p_id, v_bad->>'code', v_bad->>'message', v_role); end if;
  end if;
  update kafaa_expert_requests set status = p_decision, reply = nullif(v_reply, ''), answered_at = now() where id = p_id;
  v_ok := p_decision = 'accepted';
  perform kafaa_lead_notify('nt-' || p_id || '-' || p_decision, q.requester_id, 'community',
    case when v_ok then q.expert_name || ' accepted your expert request' else q.expert_name || ' cannot help this time' end,
    case when v_ok then 'قبل ' || q.expert_name_ar || ' طلب الخبرة' else 'لا يستطيع ' || q.expert_name_ar || ' المساعدة هذه المرة' end, '/communities/experts', case when v_ok then 'ok' else 'info' end);
  return kafaa_result(true, 'ok', case when v_ok then 'Request accepted' else 'Request declined' end,
    kafaa_audit('expert.answer', 'expert_requests', p_id, 'ok', p_decision, 'not_applicable', null, v_role), null, jsonb_build_object('status', p_decision));
end $$;

-- ───────────── Grants: internal helpers are not executable by API roles; RPCs only by signed-in users.
revoke all on function kafaa_lead_cycle(date), kafaa_lead_hist(text, text), kafaa_lead_notify(text, text, text, text, text, text, text), kafaa_lead_rid(text),
  kafaa_cop_norm(text), kafaa_cop_guard(text), kafaa_cop_contact(text), kafaa_cop_screen(text), kafaa_cop_steward(text, text), kafaa_cop_recount(text),
  kafaa_lead_nom_visible(kafaa_leadership_nominations), kafaa_lead_scores(jsonb), kafaa_lead_360_summary(text, text), kafaa_lead_stats_compute() from public, anon, authenticated;
revoke all on function kafaa_nominate_leader(text, text, text), kafaa_decide_nomination(text, text, text), kafaa_request_360(jsonb), kafaa_submit_360(text, jsonb), kafaa_my_360(text),
  kafaa_leadership_stats(), kafaa_join_community(text, boolean), kafaa_post_thread(jsonb), kafaa_moderate_post(text, text, text), kafaa_moderation_queue(),
  kafaa_set_expert_optin(text[], boolean, text), kafaa_find_experts(text), kafaa_request_expert(text, text, text), kafaa_answer_expert_request(text, text, text) from public, anon;
grant execute on function kafaa_nominate_leader(text, text, text), kafaa_decide_nomination(text, text, text), kafaa_request_360(jsonb), kafaa_submit_360(text, jsonb), kafaa_my_360(text),
  kafaa_leadership_stats(), kafaa_join_community(text, boolean), kafaa_post_thread(jsonb), kafaa_moderate_post(text, text, text), kafaa_moderation_queue(),
  kafaa_set_expert_optin(text[], boolean, text), kafaa_find_experts(text), kafaa_request_expert(text, text, text), kafaa_answer_expert_request(text, text, text) to authenticated;
