-- [W2 · E3 · F13 + F14] Mentoring 2.0 (M04) and knowledge refreshers (M19).
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: new M04 columns on kafaa_mentors / kafaa_mentoring_requests, the five new tables (same DDL as the
-- generated 20261008120100 schema file), RLS in the per-statement form (like 20261008140000_kafaa_rls_perf.sql), guard triggers and the RPCs.
-- LocalBackend mirrors: src/modules/m04/backend/local.ts (rules in src/modules/m04/mentoring.ts), src/modules/m19/backend/local.ts
-- (rules in src/modules/m19/refresh.ts), src/data/local/rpc_g2.ts (respondMentoring own_manager), src/data/local/guards.ts (mentors).
-- PGlite checks: scripts/validate/w2e3-mentoring-refreshers.mjs.

-- ───────────── M04 columns (F13)
alter table kafaa_mentors add column if not exists types text[] not null default '{}'::text[];
alter table kafaa_mentors add column if not exists skill_ids text[] not null default '{}'::text[];
alter table kafaa_mentors add column if not exists khnp_paired boolean not null default false;
alter table kafaa_mentors add column if not exists sme boolean not null default false;
alter table kafaa_mentors add column if not exists sme_skill_ids text[] not null default '{}'::text[];
alter table kafaa_mentors add column if not exists sme_nominated_by text;
alter table kafaa_mentors add column if not exists sme_nominated_on date;
alter table kafaa_mentoring_requests add column if not exists mentoring_type text;
alter table kafaa_mentoring_requests add column if not exists skill_ids text[] not null default '{}'::text[];
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'kafaa_mentoring_requests_mentoring_type_check') then
    alter table kafaa_mentoring_requests add constraint kafaa_mentoring_requests_mentoring_type_check
      check (mentoring_type is null or mentoring_type in ('career', 'knowledge_transfer', 'leadership', 'reverse', 'peer_onboarding'));
  end if;
end $$;

-- ───────────── Tables (generated DDL)
-- M04 · Mentoring agreement: skill goals, cadence and duration, close-out ratings (F13; the pair only)
create table if not exists kafaa_mentoring_agreements (
  id text primary key,
  request_id text not null unique,
  mentor_id text not null,
  person_id text not null,
  mentor_person_id text not null,
  mentoring_type text not null check (mentoring_type in ('career', 'knowledge_transfer', 'leadership', 'reverse', 'peer_onboarding')),
  goals jsonb not null default '[]'::jsonb,
  cadence text not null check (cadence in ('weekly', 'fortnightly', 'monthly')),
  starts_on date not null,
  ends_on date not null,
  status text not null default 'proposed' check (status in ('proposed', 'active', 'closing', 'closed', 'declined')),
  proposed_by text not null,
  proposed_at timestamptz not null default now(),
  responded_at timestamptz,
  decline_note text,
  mentee_ratings jsonb,
  mentor_ratings jsonb,
  mentee_note text,
  mentor_note text,
  mentee_closed_at timestamptz,
  mentor_closed_at timestamptz,
  closed_at timestamptz,
  attainment_pct numeric,
  validated_skill_ids text[] not null default '{}'::text[],
  validated_claim_ids text[] not null default '{}'::text[],
  updated_at timestamptz not null default now()
);
comment on table kafaa_mentoring_agreements is '[M04] Mentoring agreement: skill goals, cadence and duration, close-out ratings (F13; the pair only)';
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_mentoring_agreements_request_id_fk') then alter table kafaa_mentoring_agreements add constraint kafaa_mentoring_agreements_request_id_fk foreign key (request_id) references kafaa_mentoring_requests(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_mentoring_agreements_mentor_id_fk') then alter table kafaa_mentoring_agreements add constraint kafaa_mentoring_agreements_mentor_id_fk foreign key (mentor_id) references kafaa_mentors(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_mentoring_agreements_person_id_fk') then alter table kafaa_mentoring_agreements add constraint kafaa_mentoring_agreements_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_mentoring_agreements_mentor_person_id_fk') then alter table kafaa_mentoring_agreements add constraint kafaa_mentoring_agreements_mentor_person_id_fk foreign key (mentor_person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_mentoring_agreements_proposed_by_fk') then alter table kafaa_mentoring_agreements add constraint kafaa_mentoring_agreements_proposed_by_fk foreign key (proposed_by) references kafaa_people(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_mentoring_agreements_mentor_id_idx on kafaa_mentoring_agreements (mentor_id);
create index if not exists kafaa_mentoring_agreements_person_id_idx on kafaa_mentoring_agreements (person_id);
create index if not exists kafaa_mentoring_agreements_mentor_person_id_idx on kafaa_mentoring_agreements (mentor_person_id);
create index if not exists kafaa_mentoring_agreements_mentoring_type_idx on kafaa_mentoring_agreements (mentoring_type);
create index if not exists kafaa_mentoring_agreements_status_idx on kafaa_mentoring_agreements (status);
create index if not exists kafaa_mentoring_agreements_proposed_by_idx on kafaa_mentoring_agreements (proposed_by);
-- M04 · Mentoring session log: date, minutes, skills touched and a shared note (F13; the pair only)
create table if not exists kafaa_mentoring_sessions (
  id text primary key,
  agreement_id text not null,
  person_id text not null,
  mentor_person_id text not null,
  held_on date not null,
  minutes integer not null default 60,
  skill_ids text[] not null default '{}'::text[],
  topics text not null default '',
  note_shared text not null default '',
  logged_by text not null,
  logged_at timestamptz not null default now()
);
comment on table kafaa_mentoring_sessions is '[M04] Mentoring session log: date, minutes, skills touched and a shared note (F13; the pair only)';
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_mentoring_sessions_agreement_id_fk') then alter table kafaa_mentoring_sessions add constraint kafaa_mentoring_sessions_agreement_id_fk foreign key (agreement_id) references kafaa_mentoring_agreements(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_mentoring_sessions_person_id_fk') then alter table kafaa_mentoring_sessions add constraint kafaa_mentoring_sessions_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_mentoring_sessions_mentor_person_id_fk') then alter table kafaa_mentoring_sessions add constraint kafaa_mentoring_sessions_mentor_person_id_fk foreign key (mentor_person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_mentoring_sessions_logged_by_fk') then alter table kafaa_mentoring_sessions add constraint kafaa_mentoring_sessions_logged_by_fk foreign key (logged_by) references kafaa_people(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_mentoring_sessions_agreement_id_idx on kafaa_mentoring_sessions (agreement_id);
create index if not exists kafaa_mentoring_sessions_person_id_idx on kafaa_mentoring_sessions (person_id);
create index if not exists kafaa_mentoring_sessions_mentor_person_id_idx on kafaa_mentoring_sessions (mentor_person_id);
create index if not exists kafaa_mentoring_sessions_logged_by_idx on kafaa_mentoring_sessions (logged_by);
-- M04 · Private mentoring session note: readable by its author only (F13)
create table if not exists kafaa_mentoring_private_notes (
  id text primary key,
  session_id text not null,
  agreement_id text not null,
  author_person_id text not null,
  note text not null,
  updated_at timestamptz not null default now()
);
comment on table kafaa_mentoring_private_notes is '[M04] Private mentoring session note: readable by its author only (F13)';
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_mentoring_private_notes_session_id_fk') then alter table kafaa_mentoring_private_notes add constraint kafaa_mentoring_private_notes_session_id_fk foreign key (session_id) references kafaa_mentoring_sessions(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_mentoring_private_notes_agreement_id_fk') then alter table kafaa_mentoring_private_notes add constraint kafaa_mentoring_private_notes_agreement_id_fk foreign key (agreement_id) references kafaa_mentoring_agreements(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_mentoring_private_notes_author_person_id_fk') then alter table kafaa_mentoring_private_notes add constraint kafaa_mentoring_private_notes_author_person_id_fk foreign key (author_person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_mentoring_private_notes_session_id_idx on kafaa_mentoring_private_notes (session_id);
create index if not exists kafaa_mentoring_private_notes_agreement_id_idx on kafaa_mentoring_private_notes (agreement_id);
create index if not exists kafaa_mentoring_private_notes_author_person_id_idx on kafaa_mentoring_private_notes (author_person_id);
-- M19 · Knowledge refresher state per person and practice item: Leitner box 1-5, due date, counts (F14; private)
create table if not exists kafaa_refresh_state (
  id text primary key,
  person_id text not null,
  item_id text not null,
  competency_id text,
  box integer not null default 1,
  due_on date not null,
  last_result text check (last_result in ('correct', 'wrong')),
  last_at timestamptz,
  attempts integer not null default 0,
  correct integer not null default 0,
  created_at timestamptz not null default now()
);
comment on table kafaa_refresh_state is '[M19] Knowledge refresher state per person and practice item: Leitner box 1-5, due date, counts (F14; private)';
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_refresh_state_person_id_fk') then alter table kafaa_refresh_state add constraint kafaa_refresh_state_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_refresh_state_item_id_fk') then alter table kafaa_refresh_state add constraint kafaa_refresh_state_item_id_fk foreign key (item_id) references kafaa_items(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_refresh_state_competency_id_fk') then alter table kafaa_refresh_state add constraint kafaa_refresh_state_competency_id_fk foreign key (competency_id) references kafaa_competencies(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_refresh_state_person_id_idx on kafaa_refresh_state (person_id);
create index if not exists kafaa_refresh_state_item_id_idx on kafaa_refresh_state (item_id);
create index if not exists kafaa_refresh_state_competency_id_idx on kafaa_refresh_state (competency_id);
-- M19 · Knowledge refresher cadence: five questions a day or a week, or paused (F14; private, no streaks)
create table if not exists kafaa_refresh_prefs (
  id text primary key,
  person_id text not null unique,
  cadence text not null default 'weekly' check (cadence in ('daily', 'weekly', 'paused')),
  updated_at timestamptz not null default now()
);
comment on table kafaa_refresh_prefs is '[M19] Knowledge refresher cadence: five questions a day or a week, or paused (F14; private, no streaks)';
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_refresh_prefs_person_id_fk') then alter table kafaa_refresh_prefs add constraint kafaa_refresh_prefs_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;

-- ───────────── RLS (policies created when missing, then set to the per-statement form)
-- Agreements and session logs: the two people of the pair. Private notes: the author only. Refresher state: the person only.
-- Nobody holds R, W, A or Scope on own_profile, so managers, HR, the training manager, admins and auditors read none of these rows.
alter table kafaa_mentoring_agreements enable row level security;
alter table kafaa_mentoring_sessions enable row level security;
alter table kafaa_mentoring_private_notes enable row level security;
alter table kafaa_refresh_state enable row level security;
alter table kafaa_refresh_prefs enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_mentoring_agreements' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_mentoring_agreements for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_mentoring_sessions' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_mentoring_sessions for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_mentoring_private_notes' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_mentoring_private_notes for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_refresh_state' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_refresh_state for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_refresh_prefs' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_refresh_prefs for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_refresh_prefs' and policyname = 'kafaa_insert') then
    execute 'create policy kafaa_insert on kafaa_refresh_prefs for insert to anon, authenticated with check (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_refresh_prefs' and policyname = 'kafaa_update') then
    execute 'create policy kafaa_update on kafaa_refresh_prefs for update to authenticated using (false) with check (false)'; end if;
end $$;
alter policy kafaa_read on kafaa_mentoring_agreements using (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false)) OR ((mentor_person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, mentor_person_id, NULL::text, false)));
alter policy kafaa_read on kafaa_mentoring_sessions using (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false)) OR ((mentor_person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, mentor_person_id, NULL::text, false)));
alter policy kafaa_read on kafaa_mentoring_private_notes using (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((author_person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, author_person_id, NULL::text, false)));
alter policy kafaa_read on kafaa_refresh_state using (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false)));
alter policy kafaa_read on kafaa_refresh_prefs using (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false)));
alter policy kafaa_insert on kafaa_refresh_prefs with check (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['W'::text, 'A'::text])) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text])))));
alter policy kafaa_update on kafaa_refresh_prefs using (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['W'::text, 'A'::text])) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))))) with check (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['W'::text, 'A'::text])) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text])))));
-- RPC-only tables are read-only for API roles; refresh_prefs is a direct own write (row-trigger audited).
revoke all on kafaa_mentoring_agreements, kafaa_mentoring_sessions, kafaa_mentoring_private_notes, kafaa_refresh_state, kafaa_refresh_prefs from anon, authenticated;
grant select on kafaa_mentoring_agreements, kafaa_mentoring_sessions, kafaa_mentoring_private_notes, kafaa_refresh_state, kafaa_refresh_prefs to anon, authenticated;
grant insert, update on kafaa_refresh_prefs to authenticated;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'kafaa_refresh_prefs_audit') then
    execute 'create trigger kafaa_refresh_prefs_audit after insert or update on kafaa_refresh_prefs for each row execute function kafaa_audit_row()'; end if;
end $$;

-- ───────────── Guards
-- SME nomination columns change only inside rpc kafaa_nominate_sme (definer rights); a direct client write that touches them is refused.
-- Mirror: src/data/local/guards.ts case 'mentors'.
create or replace function kafaa_w2e3_mentor_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if tg_op = 'INSERT' then
    if new.sme or cardinality(new.sme_skill_ids) > 0 or new.sme_nominated_by is not null or new.sme_nominated_on is not null then
      raise exception 'Subject-matter expert nominations are recorded by the line manager' using errcode = '42501';
    end if;
  elsif new.sme is distinct from old.sme or new.sme_skill_ids is distinct from old.sme_skill_ids or new.sme_nominated_by is distinct from old.sme_nominated_by or new.sme_nominated_on is distinct from old.sme_nominated_on then
    raise exception 'Subject-matter expert nominations are recorded by the line manager' using errcode = '42501';
  end if;
  return new;
end $$;
create or replace trigger kafaa_w2e3_mentor_guard before insert or update on kafaa_mentors for each row execute function kafaa_w2e3_mentor_guard();

-- F14: refresher state can only ever reference an approved item of the open practice bank (never the secure bank).
create or replace function kafaa_w2e3_refresh_practice_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from kafaa_items i where i.id = new.item_id and i.bank = 'practice' and i.is_practice and i.status = 'approved' and i.competency_id is not null) then
    raise exception 'Refreshers use open practice-bank items only' using errcode = '23514';
  end if;
  return new;
end $$;
create or replace trigger kafaa_w2e3_refresh_practice_guard before insert or update on kafaa_refresh_state for each row execute function kafaa_w2e3_refresh_practice_guard();
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'kafaa_refresh_state_box_check') then
    alter table kafaa_refresh_state add constraint kafaa_refresh_state_box_check check (box between 1 and 5); end if;
  if not exists (select 1 from pg_constraint where conname = 'kafaa_mentoring_sessions_minutes_check') then
    alter table kafaa_mentoring_sessions add constraint kafaa_mentoring_sessions_minutes_check check (minutes between 15 and 480); end if;
end $$;

-- ───────────── F13 helpers (internal; not executable by API roles)
-- Refusal messages: identical to MSG in src/modules/m04/mentoring.ts (PGlite checks the two are equal).
create or replace function kafaa_mentoring_msgs() returns jsonb language sql immutable set search_path = public as $$
  select '{"not_signed_in":"Sign in to use mentoring","forbidden":"Mentoring is for staff","invalid_type":"Choose a mentoring type: career, knowledge transfer, leadership, reverse or peer onboarding","mentor_not_found":"Mentor not found","not_opted_in":"This mentor is not taking new mentees","self":"You cannot ask yourself for mentoring","own_manager":"Your line manager cannot be your mentor: mentoring works across reporting lines","own_manager_pair":"A line manager cannot mentor their own team member: mentoring works across reporting lines","no_capacity":"This mentor has no free places","already_open":"You already have an open request or agreement with this mentor","invalid_skills":"Choose up to five skills from the skills catalogue (security skills are excluded)","invalid_message":"Keep your message under 500 characters","request_not_found":"Request not found","not_matched":"The mentor must accept the request before an agreement is proposed","agreement_exists":"This mentoring already has an agreement in force","invalid_goals":"Give one to five goals, each tied to a different catalogue skill (no security skills), with a target level from 1 to 4 and up to 200 characters of text","invalid_cadence":"Choose a weekly, fortnightly or monthly cadence","invalid_dates":"Start no more than 30 days ago or 60 days ahead, and run for 4 weeks to 12 months","agreement_not_found":"Agreement not found","not_proposed":"This agreement is not waiting for a response","own_proposal":"The other person responds to your proposal","invalid_decision":"Unknown decision","not_active":"Sessions are logged on an active agreement","invalid_session":"Give a session date between the start of the agreement and today, 15 to 480 minutes, and skills from the agreement goals","invalid_note":"Keep notes under 2,000 characters and topics under 300","not_closable":"Only an active agreement can be closed","already_closed":"You have already submitted your close-out","invalid_ratings":"Rate every goal from 1 (not met) to 4 (exceeded)","validate_kt_only":"Skills are validated only by the mentor, at the close-out of a knowledge-transfer agreement","not_sme":"Only a manager-nominated subject-matter expert can validate skills at a knowledge-transfer close-out","forbidden_nominate":"Only the mentor''s line manager or the training manager can nominate a subject-matter expert","self_nominate":"You cannot nominate yourself","programme_forbidden":"The mentoring programme dashboard is for the training manager (aggregates only)"}'::jsonb
$$;
create or replace function kafaa_mnt_no(p_action text, p_table text, p_entity text, p_code text, p_role text default null) returns jsonb language sql security definer set search_path = public as $$
  select kafaa_refuse(p_action, p_table, p_entity, p_code, kafaa_mentoring_msgs()->>p_code, p_role)
$$;
create or replace function kafaa_mnt_trim(p text) returns text language sql immutable as $$ select regexp_replace(coalesce(p, ''), '^\s+|\s+$', '', 'g') $$;
create or replace function kafaa_mnt_notify(p_person text, p_en text, p_ar text, p_link text, p_sev text) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_person is null or not exists (select 1 from kafaa_people where id = p_person) then return; end if;
  insert into kafaa_notifications (id, person_id, kind, title_en, title_ar, link, severity)
  values ('nt-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16), p_person, 'mentoring', p_en, p_ar, p_link, p_sev) on conflict (id) do nothing;
end $$;
-- cleanSkillIds: unique catalogue skills, never security, at most p_max. Null when anything is wrong.
create or replace function kafaa_mnt_clean_skills(p jsonb, p_max integer) returns text[] language plpgsql stable security definer set search_path = public as $$
declare v text[] := '{}'::text[]; x jsonb;
begin
  if p is null or jsonb_typeof(p) = 'null' then return v; end if;
  if jsonb_typeof(p) <> 'array' then return null; end if;
  for x in select e from jsonb_array_elements(p) e loop
    if jsonb_typeof(x) <> 'string' or (x #>> '{}') = any(v) or not exists (select 1 from kafaa_skills s where s.id = x #>> '{}' and s.area is distinct from 'security') then return null; end if;
    v := v || (x #>> '{}');
  end loop;
  if cardinality(v) > p_max then return null; end if;
  return v;
end $$;
-- cleanGoals: 1..5 goals, distinct non-security catalogue skills, integer target 1..4, text up to 200 characters.
create or replace function kafaa_mnt_clean_goals(p jsonb) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb := '[]'::jsonb; g jsonb; sid text; lvl numeric; txt text; seen text[] := '{}'::text[];
begin
  if p is null or jsonb_typeof(p) <> 'array' or jsonb_array_length(p) < 1 or jsonb_array_length(p) > 5 then return null; end if;
  for g in select e from jsonb_array_elements(p) e loop
    if jsonb_typeof(g) <> 'object' or jsonb_typeof(g->'skill_id') is distinct from 'string' then return null; end if;
    sid := g->>'skill_id';
    if sid = any(seen) or not exists (select 1 from kafaa_skills s where s.id = sid and s.area is distinct from 'security') then return null; end if;
    if jsonb_typeof(g->'target_level') is distinct from 'number' then return null; end if;
    lvl := (g->>'target_level')::numeric;
    if lvl <> trunc(lvl) or lvl < 1 or lvl > 4 then return null; end if;
    if coalesce(jsonb_typeof(g->'text'), 'null') not in ('string', 'null') then return null; end if;
    txt := kafaa_mnt_trim(g->>'text');
    if length(txt) > 200 then return null; end if;
    seen := seen || sid;
    v := v || jsonb_build_array(jsonb_build_object('skill_id', sid, 'target_level', lvl::integer, 'text', txt));
  end loop;
  return v;
end $$;
-- termsError: cadence, start from 30 days ago to 60 days ahead, duration 28..366 days.
create or replace function kafaa_mnt_terms_error(p_cadence text, p_starts text, p_ends text) returns text language plpgsql stable set search_path = public as $$
declare s date; e date;
begin
  if p_cadence is null or p_cadence not in ('weekly', 'fortnightly', 'monthly') then return 'invalid_cadence'; end if;
  if p_starts is null or p_ends is null or p_starts !~ '^\d{4}-\d{2}-\d{2}$' or p_ends !~ '^\d{4}-\d{2}-\d{2}$' then return 'invalid_dates'; end if;
  begin s := p_starts::date; e := p_ends::date; exception when others then return 'invalid_dates'; end;
  if s - current_date < -30 or s - current_date > 60 or e - s < 28 or e - s > 366 then return 'invalid_dates'; end if;
  return null;
end $$;
-- cleanRatings: every goal exactly once, integer 1..4, returned in goal order.
create or replace function kafaa_mnt_clean_ratings(p jsonb, p_goals jsonb) returns jsonb language plpgsql immutable set search_path = public as $$
declare r jsonb; m jsonb := '{}'::jsonb; g jsonb; v jsonb := '[]'::jsonb; x numeric;
begin
  if p is null or jsonb_typeof(p) <> 'array' or jsonb_typeof(p_goals) <> 'array' or jsonb_array_length(p) <> jsonb_array_length(p_goals) then return null; end if;
  for r in select e from jsonb_array_elements(p) e loop
    if jsonb_typeof(r) <> 'object' or jsonb_typeof(r->'skill_id') is distinct from 'string' or m ? (r->>'skill_id') then return null; end if;
    if jsonb_typeof(r->'rating') is distinct from 'number' then return null; end if;
    x := (r->>'rating')::numeric;
    if x <> trunc(x) or x < 1 or x > 4 then return null; end if;
    m := m || jsonb_build_object(r->>'skill_id', x::integer);
  end loop;
  for g in select e from jsonb_array_elements(p_goals) e loop
    if not m ? (g->>'skill_id') then return null; end if;
    v := v || jsonb_build_array(jsonb_build_object('skill_id', g->>'skill_id', 'rating', (m->>(g->>'skill_id'))::integer));
  end loop;
  return v;
end $$;
create or replace function kafaa_mnt_ratings(p jsonb) returns jsonb language sql immutable as $$ select case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end $$;
-- attainmentPct: share of pooled ratings at 3 (met) or 4 (exceeded), whole percent; null without ratings.
create or replace function kafaa_mnt_attainment(a jsonb, b jsonb) returns integer language sql immutable set search_path = public as $$
  select case when count(*) = 0 then null else round(100.0 * count(*) filter (where (x->>'rating')::integer >= 3) / count(*))::integer end
  from jsonb_array_elements(kafaa_mnt_ratings(a) || kafaa_mnt_ratings(b)) x
$$;
-- My line manager and the managers above them (reportingChain in mentoring.ts), using the F08 line-manager rule.
create or replace function kafaa_mnt_chain(p_person text) returns text[] language plpgsql stable security definer set search_path = public as $$
declare v_cur text := p_person; v_next text; v text[] := '{}'::text[]; i integer;
begin
  for i in 1..3 loop
    exit when v_cur is null;
    v_next := kafaa_opp_line_manager(v_cur);
    exit when v_next is null or v_next = p_person or v_next = any(v);
    v := v || v_next; v_cur := v_next;
  end loop;
  return v;
end $$;

-- ───────────── G2 respondMentoring, redefined (W2E3): a mentor never accepts their own team member (own_manager). Otherwise unchanged.
create or replace function kafaa_respond_mentoring(p_id text, p_decision text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); r kafaa_mentoring_requests; mt kafaa_mentors; v_mentor_person text; a kafaa_audit_events; v_role text := kafaa_acting_role('dev_plans', array['Own','Scope','A']);
begin
  if me is null or v_role is null then return kafaa_refuse('mentoring.respond', 'mentoring_requests', p_id, 'forbidden', 'Mentoring is for staff'); end if;
  select * into r from kafaa_mentoring_requests where id = p_id;
  if r.id is null then return kafaa_refuse('mentoring.respond', 'mentoring_requests', p_id, 'not_found', 'Request not found', v_role); end if;
  select * into mt from kafaa_mentors where id = r.mentor_id;
  v_mentor_person := coalesce(r.mentor_person_id, mt.person_id);
  if p_decision = 'closed' then
    if me is distinct from r.person_id and me is distinct from v_mentor_person then return kafaa_refuse('mentoring.respond', 'mentoring_requests', p_id, 'not_found', 'Request not found', v_role); end if;
    if r.status in ('closed', 'declined') then return kafaa_refuse('mentoring.respond', 'mentoring_requests', p_id, 'invalid', 'Already closed', v_role); end if;
  elsif p_decision in ('matched', 'declined') then
    if me is distinct from v_mentor_person then return kafaa_refuse('mentoring.respond', 'mentoring_requests', p_id, 'forbidden', 'Only the mentor can accept or decline', v_role); end if;
    if r.status <> 'requested' then return kafaa_refuse('mentoring.respond', 'mentoring_requests', p_id, 'invalid', 'This request is not waiting for a response', v_role); end if;
    if p_decision = 'matched' and v_mentor_person is not null and kafaa_opp_line_manager(r.person_id) = v_mentor_person then
      return kafaa_refuse('mentoring.respond', 'mentoring_requests', p_id, 'own_manager', 'A line manager cannot mentor their own team member: mentoring works across reporting lines', v_role);
    end if;
    if p_decision = 'matched' and mt.id is not null and (select count(*) from kafaa_mentoring_requests where mentor_id = mt.id and status = 'matched') >= mt.capacity then
      return kafaa_refuse('mentoring.respond', 'mentoring_requests', p_id, 'conflict', 'You have no free mentoring capacity; raise it or close a match first', v_role);
    end if;
  else
    return kafaa_refuse('mentoring.respond', 'mentoring_requests', p_id, 'invalid', 'Unknown decision', v_role);
  end if;
  update kafaa_mentoring_requests set status = p_decision, responded_at = now() where id = p_id;
  a := kafaa_audit('mentoring.respond', 'mentoring_requests', p_id, 'ok', p_decision, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case p_decision when 'matched' then 'Match confirmed' when 'declined' then 'Request declined' else 'Closed' end, a);
end $$;

-- ───────────── F13 RPCs
create or replace function kafaa_my_reporting_line() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me();
begin
  if me is null then return jsonb_build_object('line_manager', null, 'chain', '[]'::jsonb); end if;
  return jsonb_build_object('line_manager', kafaa_opp_line_manager(me), 'chain', to_jsonb(kafaa_mnt_chain(me)));
end $$;

create or replace function kafaa_request_mentoring(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; v_mentor text := coalesce(p->>'mentor_id', ''); m kafaa_mentors; v_type text := p->>'mentoring_type'; v_ids text[];
  v_msg text := kafaa_mnt_trim(p->>'message'); v_id text; a kafaa_audit_events; v_prev text := current_setting('kafaa.seeding', true);
begin
  if me is null then return kafaa_mnt_no('mentoring.request', 'mentoring_requests', nullif(v_mentor, ''), 'not_signed_in'); end if;
  v_role := kafaa_acting_role('dev_plans', array['Own','Scope','A']);
  if v_role is null then return kafaa_mnt_no('mentoring.request', 'mentoring_requests', nullif(v_mentor, ''), 'forbidden'); end if;
  select * into m from kafaa_mentors where id = v_mentor;
  if m.id is null then return kafaa_mnt_no('mentoring.request', 'mentoring_requests', nullif(v_mentor, ''), 'mentor_not_found', v_role); end if;
  if jsonb_typeof(p->'mentoring_type') is distinct from 'string' or v_type not in ('career', 'knowledge_transfer', 'leadership', 'reverse', 'peer_onboarding') then
    return kafaa_mnt_no('mentoring.request', 'mentoring_requests', v_mentor, 'invalid_type', v_role);
  end if;
  if m.person_id = me then return kafaa_mnt_no('mentoring.request', 'mentoring_requests', v_mentor, 'self', v_role); end if;
  if not m.opt_in then return kafaa_mnt_no('mentoring.request', 'mentoring_requests', v_mentor, 'not_opted_in', v_role); end if;
  if kafaa_opp_line_manager(me) = m.person_id then return kafaa_mnt_no('mentoring.request', 'mentoring_requests', v_mentor, 'own_manager', v_role); end if;
  v_ids := kafaa_mnt_clean_skills(coalesce(p->'skill_ids', '[]'::jsonb), 5);
  if v_ids is null then return kafaa_mnt_no('mentoring.request', 'mentoring_requests', v_mentor, 'invalid_skills', v_role); end if;
  if length(v_msg) > 500 then return kafaa_mnt_no('mentoring.request', 'mentoring_requests', v_mentor, 'invalid_message', v_role); end if;
  if exists (select 1 from kafaa_mentoring_requests r where r.person_id = me and r.mentor_id = m.id and r.status in ('requested', 'matched'))
     or exists (select 1 from kafaa_mentoring_agreements x where x.person_id = me and x.mentor_id = m.id and x.status in ('proposed', 'active', 'closing')) then
    return kafaa_mnt_no('mentoring.request', 'mentoring_requests', v_mentor, 'already_open', v_role);
  end if;
  if greatest(0, m.capacity - (select count(*) from kafaa_mentoring_requests r where r.mentor_id = m.id and r.status = 'matched')) = 0 then
    return kafaa_mnt_no('mentoring.request', 'mentoring_requests', v_mentor, 'no_capacity', v_role);
  end if;
  v_id := 'mr-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
  perform set_config('kafaa.seeding', 'on', true);
  insert into kafaa_mentoring_requests (id, person_id, mentor_id, mentor_person_id, interest, message, status, created_at, mentoring_type, skill_ids)
  values (v_id, me, m.id, m.person_id, v_type, v_msg, 'requested', now(), v_type, v_ids);
  perform kafaa_mnt_notify(m.person_id, 'New mentoring request', 'طلب إرشاد جديد', '/my/mentoring', 'info');
  perform set_config('kafaa.seeding', coalesce(v_prev, ''), true);
  a := kafaa_audit('mentoring.request', 'mentoring_requests', v_id, 'ok', format('%s %s %s skills', m.id, v_type, cardinality(v_ids)), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Request sent. The mentor decides whether to accept.', a, null, jsonb_build_object('id', v_id));
end $$;

create or replace function kafaa_propose_agreement(p_request_id text, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; r kafaa_mentoring_requests; v_mentor_person text; v_aid text; cur kafaa_mentoring_agreements; v_goals jsonb; v_bad text;
  v_type text; a kafaa_audit_events; v_prev text := current_setting('kafaa.seeding', true);
begin
  if me is null then return kafaa_mnt_no('mentoring.propose', 'mentoring_agreements', nullif(p_request_id, ''), 'not_signed_in'); end if;
  v_role := kafaa_acting_role('dev_plans', array['Own','Scope','A']);
  if v_role is null then return kafaa_mnt_no('mentoring.propose', 'mentoring_agreements', nullif(p_request_id, ''), 'forbidden'); end if;
  select * into r from kafaa_mentoring_requests where id = p_request_id;
  if r.id is not null then v_mentor_person := coalesce(r.mentor_person_id, (select mt.person_id from kafaa_mentors mt where mt.id = r.mentor_id)); end if;
  if r.id is null or (me is distinct from r.person_id and me is distinct from v_mentor_person) then return kafaa_mnt_no('mentoring.propose', 'mentoring_agreements', nullif(p_request_id, ''), 'request_not_found', v_role); end if;
  if r.status <> 'matched' or r.mentor_id is null or v_mentor_person is null then return kafaa_mnt_no('mentoring.propose', 'mentoring_agreements', p_request_id, 'not_matched', v_role); end if;
  if kafaa_opp_line_manager(r.person_id) = v_mentor_person then return kafaa_refuse('mentoring.propose', 'mentoring_agreements', p_request_id, 'own_manager', kafaa_mentoring_msgs()->>'own_manager_pair', v_role); end if;
  v_aid := 'ma-' || r.id;
  select * into cur from kafaa_mentoring_agreements where id = v_aid;
  if cur.id is not null and cur.status in ('active', 'closing', 'closed') then return kafaa_mnt_no('mentoring.propose', 'mentoring_agreements', p_request_id, 'agreement_exists', v_role); end if;
  v_goals := kafaa_mnt_clean_goals(p->'goals');
  if v_goals is null then return kafaa_mnt_no('mentoring.propose', 'mentoring_agreements', p_request_id, 'invalid_goals', v_role); end if;
  v_bad := kafaa_mnt_terms_error(case when jsonb_typeof(p->'cadence') = 'string' then p->>'cadence' end, case when jsonb_typeof(p->'starts_on') = 'string' then p->>'starts_on' end, case when jsonb_typeof(p->'ends_on') = 'string' then p->>'ends_on' end);
  if v_bad is not null then return kafaa_mnt_no('mentoring.propose', 'mentoring_agreements', p_request_id, v_bad, v_role); end if;
  v_type := coalesce(r.mentoring_type, 'career');
  insert into kafaa_mentoring_agreements (id, request_id, mentor_id, person_id, mentor_person_id, mentoring_type, goals, cadence, starts_on, ends_on, status, proposed_by, proposed_at, updated_at)
  values (v_aid, r.id, r.mentor_id, r.person_id, v_mentor_person, v_type, v_goals, p->>'cadence', (p->>'starts_on')::date, (p->>'ends_on')::date, 'proposed', me, now(), now())
  on conflict (id) do update set mentor_id = excluded.mentor_id, person_id = excluded.person_id, mentor_person_id = excluded.mentor_person_id, mentoring_type = excluded.mentoring_type,
    goals = excluded.goals, cadence = excluded.cadence, starts_on = excluded.starts_on, ends_on = excluded.ends_on, status = 'proposed', proposed_by = me, proposed_at = now(),
    responded_at = null, decline_note = null, updated_at = now();
  perform set_config('kafaa.seeding', 'on', true);
  perform kafaa_mnt_notify(case when me = r.person_id then v_mentor_person else r.person_id end, 'Mentoring agreement proposed: please review', 'اقتراح اتفاقية إرشاد: يُرجى المراجعة', '/my/mentoring/' || v_aid, 'info');
  perform set_config('kafaa.seeding', coalesce(v_prev, ''), true);
  a := kafaa_audit('mentoring.propose', 'mentoring_agreements', v_aid, 'ok', format('%s %s goals %s %s..%s', v_type, jsonb_array_length(v_goals), p->>'cadence', p->>'starts_on', p->>'ends_on'), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Agreement proposed. The other person accepts or declines it.', a, null, jsonb_build_object('id', v_aid, 'status', 'proposed'));
end $$;

create or replace function kafaa_respond_agreement(p_agreement_id text, p_decision text, p_note text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; x kafaa_mentoring_agreements; v_note text := kafaa_mnt_trim(p_note); a kafaa_audit_events; l integer; v_prev text := current_setting('kafaa.seeding', true);
begin
  if me is null then return kafaa_mnt_no('mentoring.respond_agreement', 'mentoring_agreements', nullif(p_agreement_id, ''), 'not_signed_in'); end if;
  v_role := kafaa_acting_role('dev_plans', array['Own','Scope','A']);
  if v_role is null then return kafaa_mnt_no('mentoring.respond_agreement', 'mentoring_agreements', nullif(p_agreement_id, ''), 'forbidden'); end if;
  select * into x from kafaa_mentoring_agreements where id = p_agreement_id;
  if x.id is null or me not in (x.person_id, x.mentor_person_id) then return kafaa_mnt_no('mentoring.respond_agreement', 'mentoring_agreements', nullif(p_agreement_id, ''), 'agreement_not_found', v_role); end if;
  if p_decision is null or p_decision not in ('accept', 'decline') then return kafaa_mnt_no('mentoring.respond_agreement', 'mentoring_agreements', x.id, 'invalid_decision', v_role); end if;
  if x.status <> 'proposed' then return kafaa_mnt_no('mentoring.respond_agreement', 'mentoring_agreements', x.id, 'not_proposed', v_role); end if;
  if x.proposed_by = me then return kafaa_mnt_no('mentoring.respond_agreement', 'mentoring_agreements', x.id, 'own_proposal', v_role); end if;
  if length(v_note) > 500 then return kafaa_mnt_no('mentoring.respond_agreement', 'mentoring_agreements', x.id, 'invalid_message', v_role); end if;
  if p_decision = 'decline' then
    update kafaa_mentoring_agreements set status = 'declined', responded_at = now(), decline_note = nullif(v_note, ''), updated_at = now() where id = x.id;
    perform set_config('kafaa.seeding', 'on', true);
    perform kafaa_mnt_notify(x.proposed_by, 'Mentoring agreement returned: revise and propose again', 'أُعيدت اتفاقية الإرشاد: عدّلها واقترحها مجدداً', '/my/mentoring/' || x.id, 'warn');
    perform set_config('kafaa.seeding', coalesce(v_prev, ''), true);
    a := kafaa_audit('mentoring.respond_agreement', 'mentoring_agreements', x.id, 'ok', 'declined', 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Agreement returned to the proposer', a, null, jsonb_build_object('id', x.id, 'status', 'declined'));
  end if;
  update kafaa_mentoring_agreements set status = 'active', responded_at = now(), decline_note = null, updated_at = now() where id = x.id;
  perform set_config('kafaa.seeding', 'on', true);
  perform kafaa_mnt_notify(x.proposed_by, 'Mentoring agreement accepted', 'قُبلت اتفاقية الإرشاد', '/my/mentoring/' || x.id, 'ok');
  perform set_config('kafaa.seeding', coalesce(v_prev, ''), true);
  l := kafaa_ledger('kafaa.mentoring.agreement', format('Mentoring agreement %s (%s) active until %s', x.id, x.mentoring_type, x.ends_on));
  a := kafaa_audit('mentoring.respond_agreement', 'mentoring_agreements', x.id, 'ok', 'accepted', case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Agreement accepted: mentoring is under way', a, l, jsonb_build_object('id', x.id, 'status', 'active'));
end $$;

create or replace function kafaa_log_session(p_agreement_id text, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; x kafaa_mentoring_agreements; v_ok boolean := true; v_ids text[] := '{}'::text[]; v_goal text[]; e jsonb; v_held date; v_min numeric;
  v_topics text := kafaa_mnt_trim(p->>'topics'); v_shared text := kafaa_mnt_trim(p->>'note_shared'); v_priv text := kafaa_mnt_trim(p->>'note_private'); v_id text; v_n integer; a kafaa_audit_events;
begin
  if me is null then return kafaa_mnt_no('mentoring.session', 'mentoring_sessions', nullif(p_agreement_id, ''), 'not_signed_in'); end if;
  v_role := kafaa_acting_role('dev_plans', array['Own','Scope','A']);
  if v_role is null then return kafaa_mnt_no('mentoring.session', 'mentoring_sessions', nullif(p_agreement_id, ''), 'forbidden'); end if;
  select * into x from kafaa_mentoring_agreements where id = p_agreement_id;
  if x.id is null or me not in (x.person_id, x.mentor_person_id) then return kafaa_mnt_no('mentoring.session', 'mentoring_sessions', nullif(p_agreement_id, ''), 'agreement_not_found', v_role); end if;
  if x.status <> 'active' then return kafaa_mnt_no('mentoring.session', 'mentoring_sessions', x.id, 'not_active', v_role); end if;
  v_goal := array(select g->>'skill_id' from jsonb_array_elements(x.goals) g);
  if jsonb_typeof(p->'held_on') is distinct from 'string' or (p->>'held_on') !~ '^\d{4}-\d{2}-\d{2}$' then v_ok := false; end if;
  if v_ok then begin v_held := (p->>'held_on')::date; exception when others then v_ok := false; end; end if;
  if v_ok and (v_held < x.starts_on or v_held > current_date) then v_ok := false; end if;
  if v_ok and jsonb_typeof(p->'minutes') is distinct from 'number' then v_ok := false; end if;
  if v_ok then v_min := (p->>'minutes')::numeric; if v_min <> trunc(v_min) or v_min < 15 or v_min > 480 then v_ok := false; end if; end if;
  if v_ok and (jsonb_typeof(p->'skill_ids') is distinct from 'array' or jsonb_array_length(p->'skill_ids') < 1) then v_ok := false; end if;
  if v_ok then
    for e in select y from jsonb_array_elements(p->'skill_ids') y loop
      if jsonb_typeof(e) <> 'string' or (e #>> '{}') = any(v_ids) or not ((e #>> '{}') = any(v_goal)) then v_ok := false; exit; end if;
      v_ids := v_ids || (e #>> '{}');
    end loop;
  end if;
  if not v_ok then return kafaa_mnt_no('mentoring.session', 'mentoring_sessions', x.id, 'invalid_session', v_role); end if;
  if length(v_topics) > 300 or length(v_shared) > 2000 or length(v_priv) > 2000 then return kafaa_mnt_no('mentoring.session', 'mentoring_sessions', x.id, 'invalid_note', v_role); end if;
  v_id := 'ms-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
  insert into kafaa_mentoring_sessions (id, agreement_id, person_id, mentor_person_id, held_on, minutes, skill_ids, topics, note_shared, logged_by, logged_at)
  values (v_id, x.id, x.person_id, x.mentor_person_id, v_held, v_min::integer, array(select s from unnest(v_ids) s order by s collate "C"), v_topics, v_shared, me, now());
  if v_priv <> '' then
    insert into kafaa_mentoring_private_notes (id, session_id, agreement_id, author_person_id, note, updated_at) values ('mpn:' || v_id || ':' || me, v_id, x.id, me, v_priv, now());
  end if;
  select count(*) into v_n from kafaa_mentoring_sessions where agreement_id = x.id;
  a := kafaa_audit('mentoring.session', 'mentoring_sessions', v_id, 'ok', format('%s %s %s min %s skills%s', x.id, v_held, v_min::integer, cardinality(v_ids), case when v_priv <> '' then ' +private note' else '' end), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Session logged', a, null, jsonb_build_object('id', v_id, 'logged', v_n));
end $$;

create or replace function kafaa_close_agreement(p_agreement_id text, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; x kafaa_mentoring_agreements; mt kafaa_mentors; v_side text; v_ratings jsonb; v_note text := kafaa_mnt_trim(p->>'note');
  v_validate boolean := coalesce(jsonb_typeof(p->'validate') = 'boolean' and (p->>'validate')::boolean, false); v_finished boolean; v_pct integer;
  g jsonb; sk kafaa_skills; v_rating integer; v_scope text[]; v_claim text; v_val jsonb := '[]'::jsonb; v_skip jsonb := '[]'::jsonb; v_nval integer := 0;
  l integer; a kafaa_audit_events; v_ledger text; v_ledger_reason text; v_reason text; v_prev text := current_setting('kafaa.seeding', true);
begin
  if me is null then return kafaa_mnt_no('mentoring.close', 'mentoring_agreements', nullif(p_agreement_id, ''), 'not_signed_in'); end if;
  v_role := kafaa_acting_role('dev_plans', array['Own','Scope','A']);
  if v_role is null then return kafaa_mnt_no('mentoring.close', 'mentoring_agreements', nullif(p_agreement_id, ''), 'forbidden'); end if;
  select * into x from kafaa_mentoring_agreements where id = p_agreement_id;
  if x.id is null or me not in (x.person_id, x.mentor_person_id) then return kafaa_mnt_no('mentoring.close', 'mentoring_agreements', nullif(p_agreement_id, ''), 'agreement_not_found', v_role); end if;
  if x.status not in ('active', 'closing') then return kafaa_mnt_no('mentoring.close', 'mentoring_agreements', x.id, 'not_closable', v_role); end if;
  v_side := case when me = x.person_id then 'mentee' else 'mentor' end;
  if (v_side = 'mentee' and x.mentee_closed_at is not null) or (v_side = 'mentor' and x.mentor_closed_at is not null) then return kafaa_mnt_no('mentoring.close', 'mentoring_agreements', x.id, 'already_closed', v_role); end if;
  v_ratings := kafaa_mnt_clean_ratings(p->'ratings', x.goals);
  if v_ratings is null then return kafaa_mnt_no('mentoring.close', 'mentoring_agreements', x.id, 'invalid_ratings', v_role); end if;
  if length(v_note) > 2000 then return kafaa_mnt_no('mentoring.close', 'mentoring_agreements', x.id, 'invalid_note', v_role); end if;
  if v_validate then
    if v_side <> 'mentor' or x.mentoring_type <> 'knowledge_transfer' then return kafaa_mnt_no('mentoring.close', 'mentoring_agreements', x.id, 'validate_kt_only', v_role); end if;
    select * into mt from kafaa_mentors where id = x.mentor_id;
    if not coalesce(mt.sme, false) then return kafaa_mnt_no('mentoring.close', 'mentoring_agreements', x.id, 'not_sme', v_role); end if;
    v_scope := case when cardinality(mt.sme_skill_ids) > 0 then mt.sme_skill_ids else mt.skill_ids end;
    -- ktValidation (mentoring.ts): goals in skill-id order
    for g in select e from jsonb_array_elements(x.goals) e order by e->>'skill_id' collate "C" loop
      select * into sk from kafaa_skills where id = g->>'skill_id';
      if sk.id is null or sk.area = 'security' then v_skip := v_skip || jsonb_build_array(jsonb_build_object('skill_id', g->>'skill_id', 'code', 'security')); continue; end if;
      if exists (select 1 from kafaa_qual_standards q where q.id = any(sk.evidence_keys)) then v_skip := v_skip || jsonb_build_array(jsonb_build_object('skill_id', sk.id, 'code', 'qual_only')); continue; end if;
      v_rating := null; v_claim := null;
      select (r->>'rating')::integer into v_rating from jsonb_array_elements(v_ratings) r where r->>'skill_id' = sk.id;
      if coalesce(v_rating, 0) < 3 then v_skip := v_skip || jsonb_build_array(jsonb_build_object('skill_id', sk.id, 'code', 'not_met')); continue; end if;
      if not (sk.id = any(v_scope)) then v_skip := v_skip || jsonb_build_array(jsonb_build_object('skill_id', sk.id, 'code', 'not_sme_skill')); continue; end if;
      select c.id into v_claim from kafaa_skill_claims c where c.person_id = x.person_id and c.skill_id = sk.id and c.status = 'claimed' order by c.id collate "C" limit 1;
      if v_claim is null then v_skip := v_skip || jsonb_build_array(jsonb_build_object('skill_id', sk.id, 'code', 'no_claim')); continue; end if;
      v_val := v_val || jsonb_build_array(jsonb_build_object('skill_id', sk.id, 'claim_id', v_claim));
      v_claim := null;
    end loop;
  end if;
  v_finished := (v_side = 'mentee' and x.mentor_closed_at is not null) or (v_side = 'mentor' and x.mentee_closed_at is not null);
  if v_side = 'mentee' then
    update kafaa_mentoring_agreements set mentee_ratings = v_ratings, mentee_note = nullif(v_note, ''), mentee_closed_at = now(), updated_at = now() where id = x.id;
  else
    update kafaa_mentoring_agreements set mentor_ratings = v_ratings, mentor_note = nullif(v_note, ''), mentor_closed_at = now(), updated_at = now() where id = x.id;
  end if;
  if v_finished then
    v_pct := kafaa_mnt_attainment(case when v_side = 'mentee' then v_ratings else x.mentee_ratings end, case when v_side = 'mentor' then v_ratings else x.mentor_ratings end);
    update kafaa_mentoring_agreements set status = 'closed', closed_at = now(), attainment_pct = v_pct where id = x.id;
  else
    update kafaa_mentoring_agreements set status = 'closing' where id = x.id;
  end if;
  v_nval := jsonb_array_length(v_val);
  if v_nval > 0 then
    update kafaa_skill_claims c set status = 'validated', decided_by = me, decided_at = now(),
      decision_note = 'Validated by the subject-matter expert mentor at the close-out of knowledge-transfer agreement ' || x.id
      where c.id in (select v->>'claim_id' from jsonb_array_elements(v_val) v);
    update kafaa_skill_evidence e set basis = 'validated', active = true
      where e.id in (select 'se:rating:' || (v->>'claim_id') || ':' || (v->>'skill_id') from jsonb_array_elements(v_val) v);
    update kafaa_mentoring_agreements set
      validated_skill_ids = array(select d.s from (select distinct u.s from unnest(validated_skill_ids || array(select v->>'skill_id' from jsonb_array_elements(v_val) v)) u(s)) d order by d.s collate "C"),
      validated_claim_ids = array(select d.s from (select distinct u.s from unnest(validated_claim_ids || array(select v->>'claim_id' from jsonb_array_elements(v_val) v)) u(s)) d order by d.s collate "C")
      where id = x.id;
    perform kafaa_skills_apply(x.person_id, current_date);
  end if;
  perform set_config('kafaa.seeding', 'on', true);
  if v_finished then update kafaa_mentoring_requests set status = 'closed' where id = x.request_id; end if;
  perform kafaa_mnt_notify(case when v_side = 'mentee' then x.mentor_person_id else x.person_id end,
    case when v_finished then 'Mentoring closed: see the attainment summary' else 'Your mentoring partner submitted their close-out' end,
    case when v_finished then 'أُغلق الإرشاد: اطّلع على ملخص الإنجاز' else 'قدّم شريكك في الإرشاد تقييم الإغلاق' end, '/my/mentoring/' || x.id, case when v_finished then 'ok' else 'info' end);
  perform set_config('kafaa.seeding', coalesce(v_prev, ''), true);
  v_ledger := case when v_nval > 0 then 'kafaa.mentoring.validate' when v_finished then 'kafaa.mentoring.close' end;
  v_ledger_reason := case when v_nval > 0 then format('Knowledge-transfer close-out of %s: %s claims validated by SME mentor', x.id, v_nval) else format('Mentoring agreement %s closed: attainment %s%%', x.id, coalesce(v_pct, 0)) end;
  if v_ledger is not null then l := kafaa_ledger(v_ledger, v_ledger_reason); end if;
  v_reason := v_side || ' close-out' || case when v_finished then format('; closed, attainment %s%%', coalesce(v_pct, 0)) else '' end
    || case when v_validate then format('; validated %s, skipped %s', v_nval, jsonb_array_length(v_skip)) else '' end;
  a := kafaa_audit('mentoring.close', 'mentoring_agreements', x.id, 'ok', v_reason, case when v_ledger is null then 'not_applicable' when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when v_finished then 'Mentoring closed' else 'Close-out recorded; waiting for the other person' end, a, l,
    jsonb_build_object('status', case when v_finished then 'closed' else 'closing' end, 'attainment_pct', v_pct, 'validated', v_val, 'skipped', v_skip));
end $$;

create or replace function kafaa_nominate_sme(p_mentor_id text, p_on boolean, p_skill_ids text[] default '{}'::text[]) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); m kafaa_mentors; v_tm boolean; v_role text; v_flag boolean := coalesce(p_on, true); v_ids text[] := '{}'::text[]; l integer; a kafaa_audit_events; v_prev text := current_setting('kafaa.seeding', true);
begin
  if me is null then return kafaa_mnt_no('mentoring.sme', 'mentors', nullif(p_mentor_id, ''), 'not_signed_in'); end if;
  select * into m from kafaa_mentors where id = p_mentor_id;
  if m.id is null then return kafaa_mnt_no('mentoring.sme', 'mentors', nullif(p_mentor_id, ''), 'mentor_not_found'); end if;
  if m.person_id = me then return kafaa_mnt_no('mentoring.sme', 'mentors', m.id, 'self_nominate'); end if;
  v_tm := kafaa_has_role('training_manager');
  v_role := case when v_tm then 'training_manager' else kafaa_acting_role('dev_plans', array['A','Scope','Own']) end;
  if not v_tm and kafaa_opp_line_manager(m.person_id) is distinct from me then return kafaa_mnt_no('mentoring.sme', 'mentors', m.id, 'forbidden_nominate', v_role); end if;
  if v_flag then
    v_ids := kafaa_mnt_clean_skills(to_jsonb(coalesce(p_skill_ids, '{}'::text[])), 10);
    if v_ids is null or exists (select 1 from unnest(v_ids) s where not (s = any(m.skill_ids))) then return kafaa_mnt_no('mentoring.sme', 'mentors', m.id, 'invalid_skills', v_role); end if;
    v_ids := array(select s from unnest(v_ids) s order by s collate "C");
  end if;
  perform set_config('kafaa.seeding', 'on', true);
  update kafaa_mentors set sme = v_flag, sme_skill_ids = v_ids, sme_nominated_by = case when v_flag then me end, sme_nominated_on = case when v_flag then current_date end where id = m.id;
  perform kafaa_mnt_notify(m.person_id, case when v_flag then 'You are nominated as a subject-matter expert mentor' else 'Your subject-matter expert nomination was withdrawn' end,
    case when v_flag then 'رُشّحت مرشداً خبيراً في الموضوع' else 'سُحب ترشيحك مرشداً خبيراً' end, '/my/mentoring', case when v_flag then 'ok' else 'info' end);
  perform set_config('kafaa.seeding', coalesce(v_prev, ''), true);
  l := kafaa_ledger('kafaa.mentoring.sme', format('SME %s for mentor %s', case when v_flag then 'nomination' else 'withdrawal' end, m.id));
  a := kafaa_audit('mentoring.sme', 'mentors', m.id, 'ok', case when v_flag then format('nominated (%s skills)', case when cardinality(v_ids) = 0 then 'all offered' else cardinality(v_ids)::text end) else 'withdrawn' end,
    case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when v_flag then 'Subject-matter expert nominated' else 'Nomination withdrawn' end, a, l, jsonb_build_object('mentor_id', m.id, 'sme', v_flag));
end $$;

create or replace function kafaa_sme_nominees() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); v_tm boolean := kafaa_has_role('training_manager');
begin
  if me is null then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('mentor_id', m.id, 'person_id', m.person_id, 'role_id', m.role_id, 'skill_ids', to_jsonb(m.skill_ids), 'sme', m.sme,
      'sme_skill_ids', to_jsonb(m.sme_skill_ids), 'sme_nominated_on', m.sme_nominated_on) order by m.id collate "C")
    from kafaa_mentors m where m.person_id <> me and (v_tm or kafaa_opp_line_manager(m.person_id) = me)), '[]'::jsonb);
end $$;

-- Programme dashboard cell (programmeStats in mentoring.ts): pairs = started agreements; suppressed under the minimum group size.
create or replace function kafaa_mnt_cell(p_key text, p_type text, p_min integer) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare n integer; v_active integer; v_closed integer; v_overdue integer; v_rated integer; v_met integer; v_sessions integer;
begin
  select count(*), count(*) filter (where status in ('active', 'closing')), count(*) filter (where status = 'closed'), count(*) filter (where status in ('active', 'closing') and ends_on < current_date)
    into n, v_active, v_closed, v_overdue
    from kafaa_mentoring_agreements where status in ('active', 'closing', 'closed') and (p_type is null or mentoring_type = p_type);
  if n < p_min then
    return jsonb_build_object('key', p_key, 'pairs', null, 'active', null, 'closed', null, 'completion_pct', null, 'attainment_pct', null, 'sessions', null, 'suppressed', true);
  end if;
  select count(*), count(*) filter (where (r->>'rating')::integer >= 3) into v_rated, v_met
    from kafaa_mentoring_agreements x, jsonb_array_elements(kafaa_mnt_ratings(x.mentee_ratings) || kafaa_mnt_ratings(x.mentor_ratings)) r
    where x.status = 'closed' and (p_type is null or x.mentoring_type = p_type);
  select count(*) into v_sessions from kafaa_mentoring_sessions s join kafaa_mentoring_agreements x on x.id = s.agreement_id
    where x.status in ('active', 'closing', 'closed') and (p_type is null or x.mentoring_type = p_type);
  return jsonb_build_object('key', p_key, 'pairs', n, 'active', v_active, 'closed', v_closed,
    'completion_pct', case when v_closed + v_overdue > 0 then round(100.0 * v_closed / (v_closed + v_overdue))::integer end,
    'attainment_pct', case when v_rated > 0 then round(100.0 * v_met / v_rated)::integer end, 'sessions', v_sessions, 'suppressed', false);
end $$;

create or replace function kafaa_mentoring_programme() returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_min integer := (kafaa_rules()->>'minGroupSize')::integer; v_kt jsonb; v_types jsonb;
begin
  if me is null then return kafaa_mnt_no('mentoring.programme', 'mentoring_agreements', null, 'not_signed_in'); end if;
  if not kafaa_has_role('training_manager') then
    return kafaa_refuse('mentoring.programme', 'mentoring_agreements', null, 'forbidden', kafaa_mentoring_msgs()->>'programme_forbidden', kafaa_acting_role('dev_plans', array['Own','Scope','A']));
  end if;
  select jsonb_agg(kafaa_mnt_cell(t, t, v_min) order by o) into v_types
    from unnest(array['career', 'knowledge_transfer', 'leadership', 'reverse', 'peer_onboarding']) with ordinality as u(t, o);
  v_kt := kafaa_mnt_cell('knowledge_transfer', 'knowledge_transfer', v_min);
  return jsonb_build_object('ok', true, 'code', 'ok', 'message', 'Mentoring programme', 'audit_seq', null, 'ledger_seq', null, 'data', jsonb_build_object(
    'min_group', v_min, 'as_of', current_date, 'total', kafaa_mnt_cell('total', null, v_min), 'by_type', v_types,
    'mentors', jsonb_build_object(
      'opted_in', (select count(*) from kafaa_mentors where opt_in), 'capacity', (select coalesce(sum(capacity), 0) from kafaa_mentors where opt_in),
      'matched', (select count(*) from kafaa_mentoring_requests where status = 'matched'), 'sme', (select count(*) from kafaa_mentors where sme),
      'khnp_paired', (select count(*) from kafaa_mentors where khnp_paired)),
    'kt_validated', case when (v_kt->>'suppressed')::boolean then null else
      (select coalesce(sum(cardinality(validated_skill_ids)), 0) from kafaa_mentoring_agreements where mentoring_type = 'knowledge_transfer' and status = 'closed') end));
end $$;

-- ───────────── F14 knowledge refreshers (mirror: src/modules/m19/refresh.ts and backend/local.ts)
create or replace function kafaa_refresh_msgs() returns jsonb language sql immutable set search_path = public as $$
  select '{"not_signed_in":"Sign in to practise","forbidden":"Knowledge refreshers are for staff","invalid":"Answer one to five different questions, choosing one of the given options","not_practice":"Only open practice-bank questions can be answered here","stats_forbidden":"Refresher item statistics are for instructors and the training manager (aggregates only)"}'::jsonb
$$;
-- competencyWeights: 0.25 base, +1 for my current role's competencies, +1 when a qualification of mine that evidences it expires within a year.
create or replace function kafaa_refresh_weights(p_person text) returns table (competency_id text, weight numeric, role boolean, requal_standard_id text, requal_days integer)
language sql stable security definer set search_path = public as $$
  with comps as (select distinct i.competency_id from kafaa_items i where i.bank = 'practice' and i.is_practice and i.status = 'approved' and i.competency_id is not null),
  rc as (select distinct r.competency_id from kafaa_role_competencies r join kafaa_people p on p.job_role_id = r.role_id where p.id = p_person),
  rq as (select s.competency_id, q.standard_id, (q.expires_on - current_date) as days
         from kafaa_qual_records q join kafaa_skills s on q.standard_id = any(s.evidence_keys)
         where q.person_id = p_person and q.expires_on is not null and not coalesce(q.security_mirror_only, false) and q.expires_on - current_date between 0 and 365),
  rq1 as (select distinct on (rq.competency_id) rq.competency_id, rq.standard_id, rq.days from rq order by rq.competency_id, rq.days, rq.standard_id collate "C")
  select c.competency_id, 0.25 + (case when rc.competency_id is not null then 1 else 0 end) + (case when rq1.competency_id is not null then 1 else 0 end),
         rc.competency_id is not null, rq1.standard_id, rq1.days
  from comps c left join rc on rc.competency_id = c.competency_id left join rq1 on rq1.competency_id = c.competency_id
$$;
-- pickRefresher: due items first (due date, box, heavier topic, id), then new items interleaved by (rank - 0.5) / weight; quota of five per day or week.
create or replace function kafaa_refresh_pick(p_person text, p_extra boolean) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_cad text; v_window text; v_from date; v_used integer; v_limit integer; v_due integer; v_new integer; v_next date; v_items jsonb;
begin
  v_cad := coalesce((select f.cadence from kafaa_refresh_prefs f where f.person_id = p_person), 'weekly');
  v_window := case when v_cad = 'daily' then 'day' else 'week' end;
  v_from := case when v_window = 'day' then current_date else date_trunc('week', current_date)::date end;
  select count(*) into v_used from kafaa_refresh_state s
    where s.person_id = p_person and s.last_at is not null and (s.last_at at time zone 'UTC')::date between v_from and current_date;
  v_limit := case when coalesce(p_extra, false) then 5 else greatest(0, 5 - v_used) end;
  with pool as (select i.id, i.competency_id, i.difficulty, i.topic, i.current_version from kafaa_items i where i.bank = 'practice' and i.is_practice and i.status = 'approved' and i.competency_id is not null),
  w as (select * from kafaa_refresh_weights(p_person)),
  st as (select s.item_id, s.box, s.due_on from kafaa_refresh_state s where s.person_id = p_person),
  due as (select p.id, p.competency_id, st.box, st.due_on, w.weight, w.role, w.requal_standard_id, w.requal_days
          from pool p join st on st.item_id = p.id join w on w.competency_id = p.competency_id where st.due_on <= current_date),
  fresh as (select p.id, p.competency_id, w.weight, w.role, w.requal_standard_id, w.requal_days,
                   row_number() over (partition by p.competency_id order by case p.difficulty when 'easy' then 1 when 'hard' then 3 else 2 end, p.id collate "C") as rn
            from pool p join w on w.competency_id = p.competency_id where not exists (select 1 from st where st.item_id = p.id)),
  ordered as (
    select 1 as grp, row_number() over (order by d.due_on, d.box, d.weight desc, d.id collate "C") as o, d.id, d.competency_id, 'due'::text as state, d.box, d.due_on,
           d.weight, d.role, d.requal_standard_id, d.requal_days from due d
    union all
    select 2, row_number() over (order by round((f.rn - 0.5) / f.weight, 4), f.competency_id collate "C", f.id collate "C"), f.id, f.competency_id, 'new', 1, null::date,
           f.weight, f.role, f.requal_standard_id, f.requal_days from fresh f),
  picked as (select * from ordered order by grp, o limit v_limit)
  select coalesce(jsonb_agg(jsonb_build_object(
      'item_id', k.id, 'competency_id', k.competency_id, 'state', k.state, 'box', k.box, 'due_on', k.due_on, 'weight', k.weight::float8, 'role', k.role,
      'requal_standard_id', k.requal_standard_id, 'requal_days', k.requal_days, 'version', v.version, 'topic', p.topic, 'difficulty', p.difficulty,
      'stem_en', v.stem_en, 'stem_ar', v.stem_ar,
      'options', (select coalesce(jsonb_agg(jsonb_build_object('id', o->>'id', 'en', o->>'en', 'ar', o->>'ar') order by n), '[]'::jsonb) from jsonb_array_elements(v.options) with ordinality as t(o, n))
    ) order by k.grp, k.o), '[]'::jsonb)
    into v_items
    from picked k join pool p on p.id = k.id join kafaa_item_versions v on v.item_id = k.id and v.version = p.current_version;
  select count(*) filter (where s.due_on <= current_date), min(s.due_on) filter (where s.due_on > current_date) into v_due, v_next
    from kafaa_refresh_state s join kafaa_items i on i.id = s.item_id
    where s.person_id = p_person and i.bank = 'practice' and i.is_practice and i.status = 'approved' and i.competency_id is not null;
  select count(*) into v_new from kafaa_items i
    where i.bank = 'practice' and i.is_practice and i.status = 'approved' and i.competency_id is not null
      and not exists (select 1 from kafaa_refresh_state s where s.person_id = p_person and s.item_id = i.id);
  return jsonb_build_object('served_on', current_date, 'cadence', v_cad, 'window', v_window, 'used', v_used, 'limit', v_limit, 'due_count', v_due, 'new_count', v_new,
    'next_due_on', v_next, 'items', v_items);
end $$;

create or replace function kafaa_next_refresher(p_extra boolean default false) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me();
begin
  if me is null then return kafaa_refuse('refresher.next', 'refresh_state', null, 'not_signed_in', kafaa_refresh_msgs()->>'not_signed_in'); end if;
  if kafaa_acting_role('skills_profile', array['Own']) is null then return kafaa_refuse('refresher.next', 'refresh_state', null, 'forbidden', kafaa_refresh_msgs()->>'forbidden'); end if;
  return jsonb_build_object('ok', true, 'code', 'ok', 'message', 'Refresher', 'audit_seq', null, 'ledger_seq', null, 'data', kafaa_refresh_pick(me, p_extra));
end $$;

-- submitRefresher: answers checked server-side; correct = up one box, wrong = back to box 1; due = today + 1/3/7/14/30 days by box.
create or replace function kafaa_submit_refresher(p_answers jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; e jsonb; ids text[] := '{}'::text[]; it kafaa_items; v kafaa_item_versions; st kafaa_refresh_state; v_ok boolean; v_before integer; v_box integer;
  v_due date; v_res jsonb := '[]'::jsonb; v_correct integer := 0; v_n integer; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('refresher.submit', 'refresh_state', null, 'not_signed_in', kafaa_refresh_msgs()->>'not_signed_in'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  if v_role is null then return kafaa_refuse('refresher.submit', 'refresh_state', null, 'forbidden', kafaa_refresh_msgs()->>'forbidden'); end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) < 1 or jsonb_array_length(p_answers) > 5 then
    return kafaa_refuse('refresher.submit', 'refresh_state', null, 'invalid', kafaa_refresh_msgs()->>'invalid', v_role);
  end if;
  for e in select x from jsonb_array_elements(p_answers) x loop
    if jsonb_typeof(e) <> 'object' or jsonb_typeof(e->'item_id') is distinct from 'string' or jsonb_typeof(e->'answer') is distinct from 'string' or (e->>'item_id') = any(ids) then
      return kafaa_refuse('refresher.submit', 'refresh_state', null, 'invalid', kafaa_refresh_msgs()->>'invalid', v_role);
    end if;
    ids := ids || (e->>'item_id');
  end loop;
  if exists (select 1 from unnest(ids) x where not exists (select 1 from kafaa_items i where i.id = x and i.bank = 'practice' and i.is_practice and i.status = 'approved' and i.competency_id is not null)) then
    return kafaa_refuse('refresher.submit', 'refresh_state', null, 'not_practice', kafaa_refresh_msgs()->>'not_practice', v_role);
  end if;
  for e in select x from jsonb_array_elements(p_answers) x loop
    if not exists (select 1 from kafaa_items i join kafaa_item_versions iv on iv.item_id = i.id and iv.version = i.current_version, jsonb_array_elements(iv.options) o
                   where i.id = e->>'item_id' and o->>'id' = e->>'answer') then
      return kafaa_refuse('refresher.submit', 'refresh_state', null, 'invalid', kafaa_refresh_msgs()->>'invalid', v_role);
    end if;
  end loop;
  for e in select x from jsonb_array_elements(p_answers) x order by x->>'item_id' collate "C" loop
    select * into it from kafaa_items where id = e->>'item_id';
    select * into v from kafaa_item_versions where item_id = it.id and version = it.current_version;
    v_ok := (e->>'answer') = v.answer;
    select * into st from kafaa_refresh_state where id = 'rs:' || me || ':' || it.id;
    v_before := coalesce(st.box, 1);
    v_box := case when v_ok then least(5, greatest(1, v_before) + 1) else 1 end;
    v_due := current_date + (array[1, 3, 7, 14, 30])[v_box];
    insert into kafaa_refresh_state (id, person_id, item_id, competency_id, box, due_on, last_result, last_at, attempts, correct, created_at)
    values ('rs:' || me || ':' || it.id, me, it.id, it.competency_id, v_box, v_due, case when v_ok then 'correct' else 'wrong' end, now(), 1, case when v_ok then 1 else 0 end, now())
    on conflict (id) do update set box = excluded.box, due_on = excluded.due_on, last_result = excluded.last_result, last_at = excluded.last_at,
      attempts = kafaa_refresh_state.attempts + 1, correct = kafaa_refresh_state.correct + excluded.correct;
    if v_ok then v_correct := v_correct + 1; end if;
    v_res := v_res || jsonb_build_array(jsonb_build_object('item_id', it.id, 'answer', e->>'answer', 'correct', v_ok, 'key', v.answer, 'rationale_en', coalesce(v.rationale_en, ''),
      'rationale_ar', coalesce(v.rationale_ar, ''), 'reference', it.reference, 'competency_id', it.competency_id, 'box_before', v_before, 'box_after', v_box, 'due_on', v_due));
  end loop;
  v_n := jsonb_array_length(v_res);
  a := kafaa_audit('refresher.submit', 'refresh_state', null, 'ok', format('%s answered, %s correct', v_n, v_correct), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Answers checked', a, null, jsonb_build_object('results', v_res, 'correct', v_correct, 'total', v_n));
end $$;

-- itemStatsOf: per practice item and per competency, distinct people with at least one attempt; suppressed under the minimum group size.
create or replace function kafaa_refresher_item_stats() returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_min integer := (kafaa_rules()->>'minGroupSize')::integer; v_items jsonb; v_comps jsonb;
begin
  if me is null then return kafaa_refuse('refresher.stats', 'refresh_state', null, 'not_signed_in', kafaa_refresh_msgs()->>'not_signed_in'); end if;
  if not (kafaa_has_role('instructor') or kafaa_has_role('training_manager')) then
    return kafaa_refuse('refresher.stats', 'refresh_state', null, 'forbidden', kafaa_refresh_msgs()->>'stats_forbidden', kafaa_acting_role('skills_profile', array['Own']));
  end if;
  with pool as (select i.* from kafaa_items i where i.bank = 'practice' and i.is_practice and i.status = 'approved' and i.competency_id is not null),
  agg as (select p.id, p.competency_id, p.topic, p.difficulty, p.p_value,
                 count(distinct s.person_id) filter (where s.attempts > 0) as people, coalesce(sum(s.attempts) filter (where s.attempts > 0), 0) as att,
                 coalesce(sum(s.correct) filter (where s.attempts > 0), 0) as cor
          from pool p left join kafaa_refresh_state s on s.item_id = p.id group by p.id, p.competency_id, p.topic, p.difficulty, p.p_value),
  x as (select agg.*, people < v_min as sup, case when people >= v_min and att > 0 then (round(1000.0 * cor / att) / 1000)::float8 end as pv from agg)
  select coalesce(jsonb_agg(jsonb_build_object('item_id', x.id, 'competency_id', x.competency_id, 'topic', coalesce(x.topic, ''), 'difficulty', coalesce(x.difficulty, 'medium'),
      'people', case when x.sup then null else x.people end, 'attempts', case when x.sup then null else x.att end, 'p_value', x.pv,
      'bank_p_value', x.p_value::float8, 'flag', case when x.pv is null then null when x.pv > 0.9 then 'too_easy' when x.pv < 0.3 then 'too_hard' end, 'suppressed', x.sup)
    order by x.id collate "C"), '[]'::jsonb) into v_items from x;
  with pool as (select i.* from kafaa_items i where i.bank = 'practice' and i.is_practice and i.status = 'approved' and i.competency_id is not null),
  agg as (select p.competency_id, count(distinct s.person_id) filter (where s.attempts > 0) as people, coalesce(sum(s.attempts) filter (where s.attempts > 0), 0) as att,
                 coalesce(sum(s.correct) filter (where s.attempts > 0), 0) as cor
          from pool p left join kafaa_refresh_state s on s.item_id = p.id group by p.competency_id)
  select coalesce(jsonb_agg(jsonb_build_object('competency_id', agg.competency_id, 'people', case when agg.people < v_min then null else agg.people end,
      'attempts', case when agg.people < v_min then null else agg.att end,
      'p_value', case when agg.people >= v_min and agg.att > 0 then (round(1000.0 * agg.cor / agg.att) / 1000)::float8 end, 'suppressed', agg.people < v_min)
    order by agg.competency_id collate "C"), '[]'::jsonb) into v_comps from agg;
  return jsonb_build_object('ok', true, 'code', 'ok', 'message', 'Refresher item statistics', 'audit_seq', null, 'ledger_seq', null,
    'data', jsonb_build_object('min_group', v_min, 'items', v_items, 'by_competency', v_comps));
end $$;

-- ───────────── Grants: internal helpers are not executable by API roles; RPCs are for signed-in users only.
revoke execute on function kafaa_mentoring_msgs(), kafaa_mnt_no(text, text, text, text, text), kafaa_mnt_trim(text), kafaa_mnt_notify(text, text, text, text, text),
  kafaa_mnt_clean_skills(jsonb, integer), kafaa_mnt_clean_goals(jsonb), kafaa_mnt_terms_error(text, text, text), kafaa_mnt_clean_ratings(jsonb, jsonb), kafaa_mnt_ratings(jsonb),
  kafaa_mnt_attainment(jsonb, jsonb), kafaa_mnt_chain(text), kafaa_mnt_cell(text, text, integer), kafaa_refresh_msgs(), kafaa_refresh_weights(text), kafaa_refresh_pick(text, boolean),
  kafaa_w2e3_mentor_guard(), kafaa_w2e3_refresh_practice_guard() from public, anon, authenticated;
revoke execute on function kafaa_my_reporting_line(), kafaa_request_mentoring(jsonb), kafaa_propose_agreement(text, jsonb), kafaa_respond_agreement(text, text, text),
  kafaa_log_session(text, jsonb), kafaa_close_agreement(text, jsonb), kafaa_nominate_sme(text, boolean, text[]), kafaa_sme_nominees(), kafaa_mentoring_programme(),
  kafaa_next_refresher(boolean), kafaa_submit_refresher(jsonb), kafaa_refresher_item_stats(), kafaa_respond_mentoring(text, text) from public, anon;
grant execute on function kafaa_my_reporting_line(), kafaa_request_mentoring(jsonb), kafaa_propose_agreement(text, jsonb), kafaa_respond_agreement(text, text, text),
  kafaa_log_session(text, jsonb), kafaa_close_agreement(text, jsonb), kafaa_nominate_sme(text, boolean, text[]), kafaa_sme_nominees(), kafaa_mentoring_programme(),
  kafaa_next_refresher(boolean), kafaa_submit_refresher(jsonb), kafaa_refresher_item_stats(), kafaa_respond_mentoring(text, text) to authenticated;
