-- [W3 · E4 · F23] Kafa'a Alumni and expert reserve (M20): opt-in reserve membership (departed staff, ended partner secondments and
-- pre-departure staff) with a skill snapshot frozen from F01, manager reserve requests that HR approves before any alumnus sees them,
-- engagements (interest or HR invitation -> HR approval, "handed to HR" -> completion), consented synthetic alumni stories, and the
-- HR reserve desk (stats suppressed below 10). Consent withdrawal hides the member everywhere at once and schedules erasure after six
-- months (as M06 does for applications). No contract, payment or contact data is stored.
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file, RLS in the per-statement form,
-- internal helpers and the RPCs. LocalBackend mirror: src/modules/m20/backend/reserve.local.ts; rules: src/modules/m20/reserve.ts.
-- PGlite checks: scripts/validate/w3e4-reserve.mjs. Uses F01 kafaa_person_skills / kafaa_skills (20261009101001).

-- ───────────── Tables (generated DDL)
-- M20 · Alumni and expert reserve: opt-in members (departed staff, ended partner secondments, pre-departure staff) with a frozen skill snapshot (F23)
create table if not exists kafaa_alumni (
  id text primary key,
  person_id text,
  kind text not null check (kind in ('alumni', 'partner_alumni', 'pre_departure')),
  name text not null,
  name_ar text not null,
  former_role_id text,
  former_family_id text,
  former_org text,
  departed_on date,
  departure_reason text not null check (departure_reason in ('retired', 'secondment_ended', 'moved_on', 'planned')),
  departed_band text not null check (departed_band in ('departing', 'lt_1y', 'y1_3', 'y3_5', 'gt_5y')),
  years_service integer,
  skill_snapshot jsonb not null default '[]'::jsonb,
  snapshot_on date not null,
  availability text not null default 'open' check (availability in ('open', 'limited', 'outage_only', 'paused')),
  hours_month integer not null default 8,
  engagement_prefs text[] not null default '{}'::text[],
  finder_optin boolean not null default false,
  finder_visible boolean not null default false,
  headline_en text,
  headline_ar text,
  consent_on date,
  consent_version text not null default '1',
  status text not null default 'active' check (status in ('active', 'withdrawn')),
  withdrawn_on date,
  erase_after date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table kafaa_alumni is '[M20] Alumni and expert reserve: opt-in members (departed staff, ended partner secondments, pre-departure staff) with a frozen skill snapshot (F23)';

-- M20 · Reserve requests: short mentoring, capture-interview, instructor or reviewer help from the reserve; HR approves before alumni see them (F23)
create table if not exists kafaa_reserve_requests (
  id text primary key,
  posted_by text not null,
  poster_name text not null default '',
  poster_name_ar text not null default '',
  family_id text,
  host_team_en text not null,
  host_team_ar text not null,
  engagement text not null check (engagement in ('mentor', 'capture_interview', 'instructor', 'reviewer')),
  title_en text not null,
  title_ar text not null,
  summary_en text not null,
  summary_ar text not null,
  skills_needed text[] not null default '{}'::text[],
  hours_total integer not null,
  seats integer not null default 1,
  seats_taken integer not null default 0,
  interest_count integer not null default 0,
  location_type text not null check (location_type in ('remote', 'office', 'site_non_protected')),
  start_on date not null,
  end_on date not null,
  status text not null default 'pending_hr' check (status in ('pending_hr', 'open', 'filled', 'closed', 'declined')),
  hr_by text,
  hr_at timestamptz,
  hr_note text,
  open_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table kafaa_reserve_requests is '[M20] Reserve requests: short mentoring, capture-interview, instructor or reviewer help from the reserve; HR approves before alumni see them (F23)';

-- M20 · Reserve engagements: interest or HR invitation, HR approval ("handed to HR"), completion. No contract, payment or contact data (F23)
create table if not exists kafaa_reserve_engagements (
  id text primary key,
  request_id text not null,
  alumni_id text not null,
  person_id text,
  poster_id text not null,
  poster_read_id text,
  status text not null default 'interested' check (status in ('invited', 'interested', 'handed_to_hr', 'declined', 'withdrawn', 'completed')),
  engagement text not null check (engagement in ('mentor', 'capture_interview', 'instructor', 'reviewer')),
  alumni_name text not null default '',
  alumni_name_ar text not null default '',
  note text,
  hr_by text,
  hr_at timestamptz,
  hr_note text,
  outcome_note text,
  completed_at timestamptz,
  history jsonb not null default '[]'::jsonb,
  open_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table kafaa_reserve_engagements is '[M20] Reserve engagements: interest or HR invitation, HR approval ("handed to HR"), completion. No contract, payment or contact data (F23)';

-- M20 · Alumni stories: consented, synthetic and labelled; hidden when the alumnus withdraws consent (F23)
create table if not exists kafaa_alumni_stories (
  id text primary key,
  alumni_id text not null,
  engagement text not null check (engagement in ('mentor', 'capture_interview', 'instructor', 'reviewer')),
  title_en text not null,
  title_ar text not null,
  body_en text not null,
  body_ar text not null,
  quote_en text,
  quote_ar text,
  author_en text not null,
  author_ar text not null,
  consent_on date not null,
  published_on date not null,
  synthetic boolean not null default true,
  listed boolean not null default true,
  sort integer not null default 0
);
comment on table kafaa_alumni_stories is '[M20] Alumni stories: consented, synthetic and labelled; hidden when the alumnus withdraws consent (F23)';

do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_alumni_person_id_fk') then alter table kafaa_alumni add constraint kafaa_alumni_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_alumni_former_role_id_fk') then alter table kafaa_alumni add constraint kafaa_alumni_former_role_id_fk foreign key (former_role_id) references kafaa_job_roles(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_alumni_former_family_id_fk') then alter table kafaa_alumni add constraint kafaa_alumni_former_family_id_fk foreign key (former_family_id) references kafaa_job_families(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_alumni_former_org_fk') then alter table kafaa_alumni add constraint kafaa_alumni_former_org_fk foreign key (former_org) references kafaa_organisations(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_reserve_requests_posted_by_fk') then alter table kafaa_reserve_requests add constraint kafaa_reserve_requests_posted_by_fk foreign key (posted_by) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_reserve_requests_family_id_fk') then alter table kafaa_reserve_requests add constraint kafaa_reserve_requests_family_id_fk foreign key (family_id) references kafaa_job_families(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_reserve_requests_hr_by_fk') then alter table kafaa_reserve_requests add constraint kafaa_reserve_requests_hr_by_fk foreign key (hr_by) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_reserve_engagements_request_id_fk') then alter table kafaa_reserve_engagements add constraint kafaa_reserve_engagements_request_id_fk foreign key (request_id) references kafaa_reserve_requests(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_reserve_engagements_alumni_id_fk') then alter table kafaa_reserve_engagements add constraint kafaa_reserve_engagements_alumni_id_fk foreign key (alumni_id) references kafaa_alumni(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_reserve_engagements_person_id_fk') then alter table kafaa_reserve_engagements add constraint kafaa_reserve_engagements_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_reserve_engagements_poster_id_fk') then alter table kafaa_reserve_engagements add constraint kafaa_reserve_engagements_poster_id_fk foreign key (poster_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_reserve_engagements_poster_read_id_fk') then alter table kafaa_reserve_engagements add constraint kafaa_reserve_engagements_poster_read_id_fk foreign key (poster_read_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_reserve_engagements_hr_by_fk') then alter table kafaa_reserve_engagements add constraint kafaa_reserve_engagements_hr_by_fk foreign key (hr_by) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_alumni_stories_alumni_id_fk') then alter table kafaa_alumni_stories add constraint kafaa_alumni_stories_alumni_id_fk foreign key (alumni_id) references kafaa_alumni(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_alumni_person_id_idx on kafaa_alumni (person_id);
create index if not exists kafaa_alumni_kind_idx on kafaa_alumni (kind);
create index if not exists kafaa_alumni_former_role_id_idx on kafaa_alumni (former_role_id);
create index if not exists kafaa_alumni_former_family_id_idx on kafaa_alumni (former_family_id);
create index if not exists kafaa_alumni_former_org_idx on kafaa_alumni (former_org);
create index if not exists kafaa_alumni_status_idx on kafaa_alumni (status);
create index if not exists kafaa_reserve_requests_posted_by_idx on kafaa_reserve_requests (posted_by);
create index if not exists kafaa_reserve_requests_family_id_idx on kafaa_reserve_requests (family_id);
create index if not exists kafaa_reserve_requests_engagement_idx on kafaa_reserve_requests (engagement);
create index if not exists kafaa_reserve_requests_status_idx on kafaa_reserve_requests (status);
create index if not exists kafaa_reserve_requests_hr_by_idx on kafaa_reserve_requests (hr_by);
create index if not exists kafaa_reserve_engagements_request_id_idx on kafaa_reserve_engagements (request_id);
create index if not exists kafaa_reserve_engagements_alumni_id_idx on kafaa_reserve_engagements (alumni_id);
create index if not exists kafaa_reserve_engagements_person_id_idx on kafaa_reserve_engagements (person_id);
create index if not exists kafaa_reserve_engagements_poster_id_idx on kafaa_reserve_engagements (poster_id);
create index if not exists kafaa_reserve_engagements_poster_read_id_idx on kafaa_reserve_engagements (poster_read_id);
create index if not exists kafaa_reserve_engagements_status_idx on kafaa_reserve_engagements (status);
create index if not exists kafaa_reserve_engagements_hr_by_idx on kafaa_reserve_engagements (hr_by);
create index if not exists kafaa_alumni_stories_alumni_id_idx on kafaa_alumni_stories (alumni_id);

-- ───────────── RLS (policies created when missing, then set to the per-statement form like 20261008140000_kafaa_rls_perf.sql)
-- Members read their own row; staff (R on opportunities) read a member only while `finder_visible` (expert-finder opt-in, cleared
-- on withdrawal). Requests: the poster, plus admins and auditors. Engagements: the alumnus, and the poster only after HR hands it
-- over (`poster_read_id`), plus admins and auditors. Stories: staff read `listed` rows. HR works through kafaa_reserve_desk.
alter table kafaa_alumni enable row level security;
alter table kafaa_reserve_requests enable row level security;
alter table kafaa_reserve_engagements enable row level security;
alter table kafaa_alumni_stories enable row level security;
do $$ declare t text; begin
  foreach t in array array['kafaa_alumni', 'kafaa_reserve_requests', 'kafaa_reserve_engagements', 'kafaa_alumni_stories'] loop
    if not exists (select 1 from pg_policies where tablename = t and policyname = 'kafaa_read') then
      execute format('create policy kafaa_read on %I for select to anon, authenticated using (false)', t);
    end if;
  end loop;
end $$;
alter policy kafaa_read on kafaa_alumni using (((COALESCE(finder_visible, false) AND (SELECT kafaa_has_grant('opportunities'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('opportunities'::text, ARRAY['Own'::text, 'Scope'::text]))));
alter policy kafaa_read on kafaa_reserve_requests using (((posted_by = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('opportunities'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((COALESCE(open_read, false) AND (SELECT kafaa_has_grant('opportunities'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))) OR ((SELECT kafaa_has_grant('audit_log'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))));
alter policy kafaa_read on kafaa_reserve_engagements using (((SELECT kafaa_me()) IN (person_id, poster_read_id) AND (SELECT kafaa_has_grant('opportunities'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((COALESCE(open_read, false) AND (SELECT kafaa_has_grant('opportunities'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))) OR ((SELECT kafaa_has_grant('audit_log'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))));
alter policy kafaa_read on kafaa_alumni_stories using ((COALESCE(listed, false) AND (SELECT kafaa_has_grant('opportunities'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))));
grant select on kafaa_alumni, kafaa_reserve_requests, kafaa_reserve_engagements, kafaa_alumni_stories to anon, authenticated;
-- These tables change only through the SECURITY DEFINER RPCs below.
revoke insert, update on kafaa_alumni, kafaa_reserve_requests, kafaa_reserve_engagements, kafaa_alumni_stories from anon, authenticated;

-- ───────────── Internal helpers (mirror of src/modules/m20/reserve.ts)
-- HR role of the caller for reserve approvals (first alphabetically): hr_analyst or hr_director.
create or replace function kafaa_res_hr_role() returns text language sql stable security definer set search_path = public as $$
  select r from unnest(array['hr_analyst', 'hr_director']) as u(r) where kafaa_has_role(r) order by r collate "C" limit 1
$$;
-- Email addresses and phone numbers (CONTACT_PATTERN in reserve.ts).
create or replace function kafaa_res_contact(t text) returns boolean language sql immutable set search_path = public as $$
  select coalesce(t ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|(\+|00)[0-9][0-9 -]{7,}[0-9]|(^|[^0-9])0[2-9][0-9]?[ -]?[0-9]{3}[ -]?[0-9]{4}([^0-9]|$)', false)
$$;
create or replace function kafaa_res_len(j jsonb) returns integer language sql immutable set search_path = public as $$
  select case when jsonb_typeof(j) = 'string' then length(btrim(j #>> '{}', E' \t\n\r')) else -1 end
$$;
create or replace function kafaa_res_int(j jsonb, lo integer, hi integer) returns boolean language sql immutable set search_path = public as $$
  select coalesce(jsonb_typeof(j) = 'number' and (j::text)::numeric = trunc((j::text)::numeric) and (j::text)::numeric between lo and hi, false)
$$;
create or replace function kafaa_res_is_date(t text) returns boolean language plpgsql immutable set search_path = public as $$
begin
  if t is null or t !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
  perform t::date;
  return to_char(t::date, 'YYYY-MM-DD') = t;
exception when others then return false;
end $$;
create or replace function kafaa_res_add_months(d date, n integer) returns date language sql immutable set search_path = public as $$
  select (d + make_interval(months => n))::date
$$;
-- Time since departure (bandOf): departing, lt_1y, y1_3, y3_5, gt_5y.
create or replace function kafaa_res_band(p_departed date, p_today date) returns text language sql immutable set search_path = public as $$
  select case when p_departed is null or p_today - p_departed < 0 then 'departing' when p_today - p_departed < 365 then 'lt_1y'
              when p_today - p_departed < 1095 then 'y1_3' when p_today - p_departed < 1825 then 'y3_5' else 'gt_5y' end
$$;
create or replace function kafaa_res_ts(t timestamptz) returns text language sql immutable set search_path = public as $$
  select to_char(t at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
$$;
create or replace function kafaa_res_hist(p_status text, p_note text) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('at', kafaa_res_ts(now()), 'status', p_status, 'by', kafaa_me(), 'note', nullif(btrim(coalesce(p_note, ''), E' \t\n\r'), ''))
$$;
create or replace function kafaa_res_notify(p_id text, p_person text, p_en text, p_ar text, p_link text, p_sev text) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_person is null or not exists (select 1 from kafaa_people where id = p_person) then return; end if;
  insert into kafaa_notifications (id, person_id, kind, title_en, title_ar, link, severity) values (p_id, p_person, 'reserve', p_en, p_ar, p_link, p_sev) on conflict (id) do nothing;
end $$;
-- Consent form checks (validateJoin). Returns {code, message} or null.
create or replace function kafaa_res_validate_join(p jsonb) returns jsonb language plpgsql stable set search_path = public as $$
declare v_prefs jsonb := case when jsonb_typeof(p->'engagement_prefs') = 'array' then p->'engagement_prefs' end;
begin
  if coalesce(p->>'availability', '') not in ('open', 'limited', 'outage_only', 'paused') or jsonb_typeof(p->'availability') <> 'string' or not kafaa_res_int(p->'hours_month', 0, 40)
     or v_prefs is null or jsonb_array_length(v_prefs) < 1 or jsonb_array_length(v_prefs) > 4
     or (select count(distinct x) from jsonb_array_elements(v_prefs) e(x)) <> jsonb_array_length(v_prefs)
     or exists (select 1 from jsonb_array_elements(v_prefs) e(x) where jsonb_typeof(x) <> 'string' or (x #>> '{}') not in ('mentor', 'capture_interview', 'instructor', 'reviewer'))
     or (p->'finder_optin' is not null and jsonb_typeof(p->'finder_optin') not in ('null', 'boolean'))
     or (p->'headline_en' is not null and jsonb_typeof(p->'headline_en') <> 'null' and (jsonb_typeof(p->'headline_en') <> 'string' or kafaa_res_len(p->'headline_en') > 160))
     or (p->'headline_ar' is not null and jsonb_typeof(p->'headline_ar') <> 'null' and (jsonb_typeof(p->'headline_ar') <> 'string' or kafaa_res_len(p->'headline_ar') > 160)) then
    return jsonb_build_object('code', 'invalid', 'message', 'Choose an availability, 0 to 40 hours a month and one to four engagement types; keep each headline under 160 characters');
  end if;
  if kafaa_res_contact(case when jsonb_typeof(p->'headline_en') = 'string' then p->>'headline_en' end) or kafaa_res_contact(case when jsonb_typeof(p->'headline_ar') = 'string' then p->>'headline_ar' end) then
    return jsonb_build_object('code', 'contact_data', 'message', 'Do not include contact details (email addresses or phone numbers): HR arranges contact outside Kafa''a');
  end if;
  return null;
end $$;
-- Reserve request checks (validateRequest). Returns {code, message} or null.
create or replace function kafaa_res_validate_request(p jsonb, p_today date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_sk jsonb := case when jsonb_typeof(p->'skills_needed') = 'array' then p->'skills_needed' else '[]'::jsonb end;
  v_seats jsonb := case when p->'seats' is null or jsonb_typeof(p->'seats') = 'null' then '1'::jsonb else p->'seats' end;
begin
  if coalesce(p->>'location_type', '') = 'protected_area'
     or exists (select 1 from jsonb_array_elements_text(v_sk) s(x) join kafaa_skills k on k.id = s.x where k.area in ('security')) then
    return jsonb_build_object('code', 'restricted_kind', 'message', 'Security, cyber, safeguards and protected-area work cannot be requested from the reserve');
  end if;
  if coalesce(p->>'engagement', '') not in ('mentor', 'capture_interview', 'instructor', 'reviewer') or coalesce(p->>'location_type', '') not in ('remote', 'office', 'site_non_protected')
     or jsonb_typeof(p->'engagement') <> 'string' or jsonb_typeof(p->'location_type') <> 'string'
     or kafaa_res_len(p->'title_en') not between 5 and 120 or kafaa_res_len(p->'title_ar') not between 5 and 120
     or kafaa_res_len(p->'summary_en') not between 20 and 1000 or kafaa_res_len(p->'summary_ar') not between 20 and 1000
     or jsonb_typeof(p->'skills_needed') is distinct from 'array' or jsonb_array_length(v_sk) < 1 or jsonb_array_length(v_sk) > 6
     or (select count(distinct x) from jsonb_array_elements(v_sk) e(x)) <> jsonb_array_length(v_sk)
     or exists (select 1 from jsonb_array_elements(v_sk) e(x) where jsonb_typeof(x) <> 'string' or not exists (select 1 from kafaa_skills k where k.id = x #>> '{}'))
     or not kafaa_res_int(p->'hours_total', 1, 120) or not kafaa_res_int(v_seats, 1, 3)
     or jsonb_typeof(p->'start_on') is distinct from 'string' or jsonb_typeof(p->'end_on') is distinct from 'string'
     or not kafaa_res_is_date(p->>'start_on') or not kafaa_res_is_date(p->>'end_on') then
    return jsonb_build_object('code', 'invalid', 'message', 'Give an English and an Arabic title (5 to 120 characters) and summary (20 to 1,000 characters), one to six catalogue skills, 1 to 120 hours, 1 to 3 places, a start date from today and an end date within 12 months');
  end if;
  if (p->>'start_on')::date < p_today or (p->>'end_on')::date < (p->>'start_on')::date or (p->>'end_on')::date > kafaa_res_add_months((p->>'start_on')::date, 12) then
    return jsonb_build_object('code', 'invalid', 'message', 'Give an English and an Arabic title (5 to 120 characters) and summary (20 to 1,000 characters), one to six catalogue skills, 1 to 120 hours, 1 to 3 places, a start date from today and an end date within 12 months');
  end if;
  if kafaa_res_contact(p->>'title_en') or kafaa_res_contact(p->>'title_ar') or kafaa_res_contact(p->>'summary_en') or kafaa_res_contact(p->>'summary_ar') then
    return jsonb_build_object('code', 'contact_data', 'message', 'Do not include contact details (email addresses or phone numbers): HR arranges contact outside Kafa''a');
  end if;
  return null;
end $$;
-- Freeze the F01 skill state (snapshotFrom): active, level 1+, never a security-area skill; strongest first, at most 12.
create or replace function kafaa_res_snapshot(p_person text) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('skill_id', x.skill_id, 'level', x.level, 'basis', x.basis) order by x.level desc, x.skill_id collate "C"), '[]'::jsonb)
  from (select ps.skill_id, ps.level, ps.basis from kafaa_person_skills ps join kafaa_skills k on k.id = ps.skill_id
        where ps.person_id = p_person and ps.active is distinct from false and ps.level >= 1 and k.area not in ('security')
        order by ps.level desc, ps.skill_id collate "C" limit 12) x
$$;
-- Request counters after an engagement change (recount).
create or replace function kafaa_res_recount(p_id text) returns void language plpgsql security definer set search_path = public as $$
declare r kafaa_reserve_requests; v_i integer; v_t integer; v_s text;
begin
  select * into r from kafaa_reserve_requests where id = p_id;
  if r.id is null then return; end if;
  select count(*) filter (where status in ('interested', 'handed_to_hr', 'completed')), count(*) filter (where status in ('handed_to_hr', 'completed'))
    into v_i, v_t from kafaa_reserve_engagements where request_id = p_id;
  v_s := case when r.status in ('open', 'filled') then case when v_t >= r.seats then 'filled' else 'open' end else r.status end;
  if v_i is distinct from r.interest_count or v_t is distinct from r.seats_taken or v_s is distinct from r.status then
    update kafaa_reserve_requests set interest_count = v_i, seats_taken = v_t, status = v_s, updated_at = now() where id = p_id;
  end if;
end $$;
create or replace function kafaa_res_req_visible(r kafaa_reserve_requests) returns boolean language sql stable security definer set search_path = public as $$
  select r.id is not null and (r.posted_by = kafaa_me() or kafaa_res_hr_role() is not null or kafaa_has_grant('audit_log', array['R']))
$$;
create or replace function kafaa_res_eng_visible(e kafaa_reserve_engagements) returns boolean language sql stable security definer set search_path = public as $$
  select e.id is not null and ((kafaa_me() is not null and kafaa_me() in (e.person_id, e.poster_read_id)) or kafaa_res_hr_role() is not null or kafaa_has_grant('audit_log', array['R']))
$$;

-- Read models (computeBoard / computeDesk / computeStats in reserve.ts)
create or replace function kafaa_res_board_compute(m kafaa_alumni) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'member', jsonb_build_object('id', m.id, 'kind', m.kind, 'status', m.status, 'availability', m.availability, 'hours_month', m.hours_month, 'engagement_prefs', to_jsonb(m.engagement_prefs),
      'skill_snapshot', m.skill_snapshot, 'snapshot_on', m.snapshot_on, 'finder_optin', m.finder_optin, 'erase_after', m.erase_after, 'withdrawn_on', m.withdrawn_on),
    'requests', case when m.status <> 'active' then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'engagement', r.engagement, 'title_en', r.title_en, 'title_ar', r.title_ar,
        'summary_en', r.summary_en, 'summary_ar', r.summary_ar, 'skills_needed', to_jsonb(r.skills_needed), 'hours_total', r.hours_total, 'seats_left', greatest(0, r.seats - r.seats_taken),
        'location_type', r.location_type, 'start_on', r.start_on, 'end_on', r.end_on, 'family_id', r.family_id, 'host_team_en', r.host_team_en, 'host_team_ar', r.host_team_ar,
        'my_status', e.status, 'my_engagement_id', e.id) order by r.start_on, r.id collate "C")
      from kafaa_reserve_requests r left join kafaa_reserve_engagements e on e.request_id = r.id and e.alumni_id = m.id
      where r.status = 'open' and r.posted_by is distinct from m.person_id), '[]'::jsonb) end,
    'engagements', case when m.status <> 'active' then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'request_id', e.request_id, 'status', e.status, 'engagement', e.engagement,
        'title_en', r.title_en, 'title_ar', r.title_ar, 'host_team_en', r.host_team_en, 'host_team_ar', r.host_team_ar, 'start_on', r.start_on, 'end_on', r.end_on, 'hours_total', r.hours_total,
        'note', e.note, 'outcome_note', e.outcome_note, 'updated_at', kafaa_res_ts(e.updated_at)) order by kafaa_res_ts(e.updated_at) collate "C" desc, e.id collate "C")
      from kafaa_reserve_engagements e join kafaa_reserve_requests r on r.id = e.request_id where e.alumni_id = m.id), '[]'::jsonb) end)
$$;
create or replace function kafaa_res_cell(p_key text, p_n integer) returns jsonb language sql immutable set search_path = public as $$
  select case when p_n < 10 then jsonb_build_object('key', p_key, 'n', null, 'suppressed', true) else jsonb_build_object('key', p_key, 'n', p_n, 'suppressed', false) end
$$;
create or replace function kafaa_res_stats_compute(p_today date) returns jsonb language sql stable security definer set search_path = public as $$
  with act as (select * from kafaa_alumni where status = 'active'),
       n as (select count(*)::integer as n, count(*) filter (where finder_optin)::integer as opt, coalesce(sum(hours_month) filter (where availability <> 'paused'), 0)::integer as hrs from act),
       done as (select * from kafaa_reserve_engagements where status in ('handed_to_hr', 'completed'))
  select jsonb_build_object(
    'members', case when n.n < 10 then null else n.n end, 'suppressed', n.n < 10,
    'finder_optin', case when n.n < 10 or n.opt < 10 then null else n.opt end,
    'hours_month', case when n.n < 10 then null else n.hrs end,
    'by_kind', (select jsonb_agg(kafaa_res_cell(k, (select count(*)::integer from act where kind = k)) order by o) from unnest(array['alumni', 'partner_alumni', 'pre_departure']) with ordinality as u(k, o)),
    'by_band', (select jsonb_agg(kafaa_res_cell(b, (select count(*)::integer from act where kafaa_res_band(departed_on, p_today) = b)) order by o) from unnest(array['departing', 'lt_1y', 'y1_3', 'y3_5', 'gt_5y']) with ordinality as u(b, o)),
    'by_family', coalesce((select jsonb_agg(kafaa_res_cell(f.fam, f.c) order by f.fam collate "C") from (select coalesce(former_family_id, 'none') as fam, count(*)::integer as c from act group by 1) f), '[]'::jsonb),
    'by_engagement', (select jsonb_agg(kafaa_res_cell(k, (select count(*)::integer from done where engagement = k)) order by o) from unnest(array['mentor', 'capture_interview', 'instructor', 'reviewer']) with ordinality as u(k, o)),
    'engagements_active', (select count(*) from kafaa_reserve_engagements where status in ('invited', 'interested', 'handed_to_hr')),
    'engagements_completed', (select count(*) from kafaa_reserve_engagements where status = 'completed'),
    'requests_pending', (select count(*) from kafaa_reserve_requests where status = 'pending_hr'),
    'requests_open', (select count(*) from kafaa_reserve_requests where status = 'open'),
    'min_group', 10) from n
$$;
create or replace function kafaa_res_desk_compute(p_today date) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'members', coalesce((select jsonb_agg(to_jsonb(m) order by m.id collate "C") from kafaa_alumni m where m.status = 'active'), '[]'::jsonb),
    'requests', coalesce((select jsonb_agg(to_jsonb(r) order by kafaa_res_ts(r.created_at) collate "C" desc, r.id collate "C") from kafaa_reserve_requests r), '[]'::jsonb),
    'engagements', coalesce((select jsonb_agg(to_jsonb(e) order by kafaa_res_ts(e.updated_at) collate "C" desc, e.id collate "C") from kafaa_reserve_engagements e), '[]'::jsonb),
    'erasures', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'kind', m.kind, 'withdrawn_on', m.withdrawn_on, 'erase_after', m.erase_after) order by coalesce(m.erase_after::text, '') collate "C", m.id collate "C")
      from kafaa_alumni m where m.status = 'withdrawn'), '[]'::jsonb),
    'stats', kafaa_res_stats_compute(p_today))
$$;

-- ───────────── RPC: join the reserve (consent) or withdraw consent
create or replace function kafaa_join_reserve(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; pp kafaa_people; m kafaa_alumni; ex kafaa_alumni; bad jsonb; v_id text; v_snap jsonb; v_opt boolean; v_was boolean; v_del date; e kafaa_reserve_engagements;
  v_reqs text[] := '{}'::text[]; v_r text; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('reserve.join', 'alumni', null, 'not_signed_in', 'Sign in to use the alumni and expert reserve'); end if;
  v_role := kafaa_acting_role('opportunities', array['Own']);
  select * into pp from kafaa_people where id = me;
  if v_role is null or pp.id is null or pp.kind <> 'staff' then return kafaa_refuse('reserve.join', 'alumni', null, 'forbidden', 'Only staff can join the expert reserve', v_role); end if;
  if coalesce(pp.job_family_id, '') in ('security', 'cyber', 'safeguards') then
    return kafaa_refuse('reserve.join', 'alumni', null, 'restricted_kind', 'Security, cyber and safeguards roles are career-path only and cannot join the expert reserve', v_role);
  end if;
  v_id := 'alm:' || me;
  if coalesce(p->'consent', 'true'::jsonb) = 'false'::jsonb then
    select * into m from kafaa_alumni where person_id = me and status = 'active' order by id collate "C" limit 1;
    if m.id is null then return kafaa_refuse('reserve.join', 'alumni', null, 'not_member', 'You are not an active member of the expert reserve', v_role); end if;
    v_del := kafaa_res_add_months(current_date, 6);
    update kafaa_alumni set status = 'withdrawn', withdrawn_on = current_date, erase_after = v_del, finder_optin = false, finder_visible = false, updated_at = now() where id = m.id;
    for e in select * from kafaa_reserve_engagements where alumni_id = m.id order by id collate "C" loop
      if e.status in ('invited', 'interested', 'handed_to_hr') then
        update kafaa_reserve_engagements set status = 'withdrawn', history = history || jsonb_build_array(kafaa_res_hist('withdrawn', 'Consent withdrawn')), alumni_name = '', alumni_name_ar = '', updated_at = now() where id = e.id;
        if not (e.request_id = any(v_reqs)) then v_reqs := v_reqs || e.request_id; end if;
      else
        update kafaa_reserve_engagements set alumni_name = '', alumni_name_ar = '', updated_at = now() where id = e.id;
      end if;
    end loop;
    for v_r in select x from unnest(v_reqs) as u(x) order by x collate "C" loop perform kafaa_res_recount(v_r); end loop;
    update kafaa_alumni_stories set listed = false where alumni_id = m.id and listed;
    l := kafaa_ledger('kafaa.reserve.withdraw', format('Reserve consent withdrawn for %s; erasure scheduled %s', m.id, v_del));
    a := kafaa_audit('reserve.withdraw', 'alumni', m.id, 'ok', format('consent withdrawn; erasure after %s', v_del), case when l is null then 'skipped' else 'written' end, l, v_role);
    return kafaa_result(true, 'ok', format('Consent withdrawn. You are hidden from the reserve and your record is erased after %s', v_del), a, l,
      jsonb_build_object('id', m.id, 'status', 'withdrawn', 'erase_after', v_del, 'skills', 0));
  end if;
  bad := kafaa_res_validate_join(p);
  if bad is not null then return kafaa_refuse('reserve.join', 'alumni', null, bad->>'code', bad->>'message', v_role); end if;
  v_snap := kafaa_res_snapshot(me);
  select * into ex from kafaa_alumni where id = v_id;
  v_was := coalesce(ex.status = 'active', false);
  v_opt := coalesce(p->'finder_optin' = 'true'::jsonb, false);
  insert into kafaa_alumni (id, person_id, kind, name, name_ar, former_role_id, former_family_id, former_org, departed_on, departure_reason, departed_band, years_service, skill_snapshot, snapshot_on,
    availability, hours_month, engagement_prefs, finder_optin, finder_visible, headline_en, headline_ar, consent_on, consent_version, status, withdrawn_on, erase_after, created_at, updated_at)
  values (v_id, me, 'pre_departure', pp.display_name, coalesce(nullif(pp.display_name_ar, ''), pp.display_name), pp.job_role_id, pp.job_family_id, pp.org_id, null, 'planned',
    kafaa_res_band(null, current_date), case when pp.hire_date is not null then (current_date - pp.hire_date) / 365 end, v_snap, current_date,
    p->>'availability', (p->>'hours_month')::numeric::integer, array(select jsonb_array_elements_text(p->'engagement_prefs')), v_opt, v_opt,
    nullif(btrim(coalesce(case when jsonb_typeof(p->'headline_en') = 'string' then p->>'headline_en' end, ''), E' \t\n\r'), ''),
    nullif(btrim(coalesce(case when jsonb_typeof(p->'headline_ar') = 'string' then p->>'headline_ar' end, ''), E' \t\n\r'), ''),
    current_date, '1', 'active', null, null, now(), now())
  on conflict (id) do update set person_id = excluded.person_id, kind = excluded.kind, name = excluded.name, name_ar = excluded.name_ar, former_role_id = excluded.former_role_id,
    former_family_id = excluded.former_family_id, former_org = excluded.former_org, departed_on = excluded.departed_on, departure_reason = excluded.departure_reason, departed_band = excluded.departed_band,
    years_service = excluded.years_service, skill_snapshot = excluded.skill_snapshot, snapshot_on = excluded.snapshot_on, availability = excluded.availability, hours_month = excluded.hours_month,
    engagement_prefs = excluded.engagement_prefs, finder_optin = excluded.finder_optin, finder_visible = excluded.finder_visible, headline_en = excluded.headline_en, headline_ar = excluded.headline_ar,
    consent_on = case when v_was then kafaa_alumni.consent_on else excluded.consent_on end, consent_version = '1', status = 'active', withdrawn_on = null, erase_after = null, updated_at = now();
  l := kafaa_ledger('kafaa.reserve.consent', format('Reserve consent recorded for %s', v_id));
  a := kafaa_audit('reserve.join', 'alumni', v_id, 'ok', format('%s; %s skills frozen; finder %s', case when v_was then 'updated' else 'joined' end, jsonb_array_length(v_snap), case when v_opt then 'on' else 'off' end),
    case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when v_was then 'Reserve membership updated' else 'You are in the expert reserve' end, a, l,
    jsonb_build_object('id', v_id, 'status', 'active', 'erase_after', null, 'skills', jsonb_array_length(v_snap)));
end $$;

-- ───────────── RPC: a manager asks the reserve for help (waits for HR approval)
create or replace function kafaa_request_reserve(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; bad jsonb; pp kafaa_people; jr kafaa_job_roles; fam kafaa_job_families; v_id text; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('reserve.request', 'reserve_requests', null, 'not_signed_in', 'Sign in to use the alumni and expert reserve'); end if;
  v_role := kafaa_acting_role('opportunities', array['W']);
  if v_role is null then return kafaa_refuse('reserve.request', 'reserve_requests', null, 'forbidden', 'Only managers and the training manager can request support from the reserve'); end if;
  bad := kafaa_res_validate_request(p, current_date);
  if bad is not null then return kafaa_refuse('reserve.request', 'reserve_requests', null, bad->>'code', bad->>'message', v_role); end if;
  select * into pp from kafaa_people where id = me;
  select * into jr from kafaa_job_roles where id = pp.job_role_id;
  select * into fam from kafaa_job_families where id = pp.job_family_id;
  v_id := 'rr-' || replace(gen_random_uuid()::text, '-', '');
  insert into kafaa_reserve_requests (id, posted_by, poster_name, poster_name_ar, family_id, host_team_en, host_team_ar, engagement, title_en, title_ar, summary_en, summary_ar, skills_needed,
    hours_total, seats, seats_taken, interest_count, location_type, start_on, end_on, status, open_read, created_at, updated_at)
  values (v_id, me, pp.display_name, coalesce(nullif(pp.display_name_ar, ''), pp.display_name), pp.job_family_id,
    case when jr.id is not null then jr.title_en || ' team' when fam.id is not null then fam.name_en || ' team' else 'Team' end,
    case when jr.id is not null then 'فريق ' || jr.title_ar when fam.id is not null then 'فريق ' || fam.name_ar else 'الفريق' end,
    p->>'engagement', btrim(p->>'title_en', E' \t\n\r'), btrim(p->>'title_ar', E' \t\n\r'), btrim(p->>'summary_en', E' \t\n\r'), btrim(p->>'summary_ar', E' \t\n\r'),
    array(select jsonb_array_elements_text(p->'skills_needed')), (p->>'hours_total')::numeric::integer,
    case when p->'seats' is null or jsonb_typeof(p->'seats') = 'null' then 1 else (p->>'seats')::numeric::integer end, 0, 0, p->>'location_type', (p->>'start_on')::date, (p->>'end_on')::date,
    'pending_hr', false, now(), now());
  a := kafaa_audit('reserve.request', 'reserve_requests', v_id, 'ok', format('%s pending_hr', p->>'engagement'), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Request sent to HR for approval', a, null, jsonb_build_object('id', v_id, 'status', 'pending_hr'));
end $$;

-- ───────────── RPC: HR approves or declines a request; the poster or HR closes it
create or replace function kafaa_decide_reserve_request(p_request_id text, p_decision text, p_note text default '') returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); r kafaa_reserve_requests; v_hr text; v_role text; v_note text := btrim(coalesce(p_note, ''), E' \t\n\r'); v_status text; e kafaa_reserve_engagements; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('reserve.request.decide', 'reserve_requests', p_request_id, 'not_signed_in', 'Sign in to use the alumni and expert reserve'); end if;
  select * into r from kafaa_reserve_requests where id = p_request_id;
  if not coalesce(kafaa_res_req_visible(r), false) then return kafaa_refuse('reserve.request.decide', 'reserve_requests', p_request_id, 'not_found', 'Reserve request not found'); end if;
  if coalesce(p_decision, '') not in ('approve', 'decline', 'close') then return kafaa_refuse('reserve.request.decide', 'reserve_requests', p_request_id, 'invalid', 'Unknown decision'); end if;
  v_hr := kafaa_res_hr_role();
  if p_decision = 'close' then
    v_role := coalesce(v_hr, kafaa_acting_role('opportunities', array['W', 'A']));
    if r.posted_by <> me and v_hr is null then return kafaa_refuse('reserve.request.decide', 'reserve_requests', r.id, 'forbidden', 'Only the requesting manager or HR can close this request', v_role); end if;
    if r.status not in ('pending_hr', 'open', 'filled') then return kafaa_refuse('reserve.request.decide', 'reserve_requests', r.id, 'invalid', 'That engagement change is not allowed', v_role); end if;
    update kafaa_reserve_requests set status = 'closed', updated_at = now() where id = r.id;
    for e in select * from kafaa_reserve_engagements where request_id = r.id and status in ('invited', 'interested') order by id collate "C" loop
      update kafaa_reserve_engagements set status = 'declined', history = history || jsonb_build_array(kafaa_res_hist('declined', 'Request closed')), updated_at = now() where id = e.id;
    end loop;
    perform kafaa_res_recount(r.id);
    a := kafaa_audit('reserve.request.decide', 'reserve_requests', r.id, 'ok', format('%s -> closed', r.status), 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Request closed', a, null, jsonb_build_object('status', 'closed'));
  end if;
  if v_hr is null then return kafaa_refuse('reserve.request.decide', 'reserve_requests', r.id, 'forbidden', 'Only HR (the HR analyst or the CHCO office) decides reserve requests and engagements', kafaa_acting_role('opportunities', array['W', 'A', 'Own'])); end if;
  if r.posted_by = me then return kafaa_refuse('reserve.request.decide', 'reserve_requests', r.id, 'maker_checker', 'You cannot approve a reserve request or engagement that you raised or that involves you', v_hr); end if;
  if r.status <> 'pending_hr' then return kafaa_refuse('reserve.request.decide', 'reserve_requests', r.id, 'invalid', 'This request is not waiting for HR approval', v_hr); end if;
  if p_decision = 'decline' and length(v_note) < 5 then return kafaa_refuse('reserve.request.decide', 'reserve_requests', r.id, 'invalid', 'Give a reason of at least 5 characters', v_hr); end if;
  v_status := case when p_decision = 'approve' then 'open' else 'declined' end;
  update kafaa_reserve_requests set status = v_status, hr_by = me, hr_at = now(), hr_note = nullif(v_note, ''), updated_at = now() where id = r.id;
  perform kafaa_res_notify('nt-' || r.id || '-' || v_status, r.posted_by,
    case when v_status = 'open' then 'HR approved your reserve request: ' || r.title_en else 'HR declined your reserve request: ' || r.title_en end,
    case when v_status = 'open' then 'وافقت الموارد البشرية على طلبك من الاحتياطي: ' || r.title_ar else 'رفضت الموارد البشرية طلبك من الاحتياطي: ' || r.title_ar end,
    '/opportunities/reserve/request', case when v_status = 'open' then 'ok' else 'warn' end);
  if v_status = 'open' then l := kafaa_ledger('kafaa.reserve.request.approve', format('Reserve request %s approved and opened to alumni', r.id)); end if;
  a := kafaa_audit('reserve.request.decide', 'reserve_requests', r.id, 'ok', format('pending_hr -> %s', v_status), case when v_status <> 'open' then 'not_applicable' when l is null then 'skipped' else 'written' end, l, v_hr);
  return kafaa_result(true, 'ok', case when v_status = 'open' then 'Request approved; alumni in the reserve can now see it' else 'Request declined' end, a, l, jsonb_build_object('status', v_status));
end $$;

-- ───────────── RPC: an active member expresses interest (or accepts an HR invitation)
create or replace function kafaa_reserve_interest(p_request_id text, p_note text default '') returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; m kafaa_alumni; r kafaa_reserve_requests; e kafaa_reserve_engagements; v_note text := btrim(coalesce(p_note, ''), E' \t\n\r'); v_id text; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('reserve.interest', 'reserve_requests', p_request_id, 'not_signed_in', 'Sign in to use the alumni and expert reserve'); end if;
  v_role := kafaa_acting_role('opportunities', array['Own']);
  select * into m from kafaa_alumni where person_id = me and status = 'active' order by id collate "C" limit 1;
  if m.id is null then return kafaa_refuse('reserve.interest', 'reserve_requests', p_request_id, 'not_member', 'You are not an active member of the expert reserve', v_role); end if;
  select * into r from kafaa_reserve_requests where id = p_request_id;
  if r.id is null or r.status in ('pending_hr', 'declined') then return kafaa_refuse('reserve.interest', 'reserve_requests', p_request_id, 'not_found', 'Reserve request not found', v_role); end if;
  if r.status <> 'open' then return kafaa_refuse('reserve.interest', 'reserve_requests', p_request_id, 'invalid', 'This request is not open to the reserve', v_role); end if;
  if r.posted_by = me then return kafaa_refuse('reserve.interest', 'reserve_requests', p_request_id, 'conflict', 'You cannot take part in your own reserve request', v_role); end if;
  if length(v_note) > 500 then return kafaa_refuse('reserve.interest', 'reserve_requests', p_request_id, 'invalid', 'Keep the note under 500 characters', v_role); end if;
  if kafaa_res_contact(v_note) then return kafaa_refuse('reserve.interest', 'reserve_requests', p_request_id, 'contact_data', 'Do not include contact details (email addresses or phone numbers): HR arranges contact outside Kafa''a', v_role); end if;
  v_id := 're:' || r.id || ':' || m.id;
  select * into e from kafaa_reserve_engagements where id = v_id;
  if e.id is not null and e.status <> 'invited' and e.status in ('invited', 'interested', 'handed_to_hr', 'completed', 'declined') then
    return kafaa_refuse('reserve.interest', 'reserve_requests', p_request_id, 'conflict', 'There is already an engagement for this alumnus on this request', v_role);
  end if;
  insert into kafaa_reserve_engagements (id, request_id, alumni_id, person_id, poster_id, poster_read_id, status, engagement, alumni_name, alumni_name_ar, note, history, open_read, created_at, updated_at)
  values (v_id, r.id, m.id, me, r.posted_by, null, 'interested', r.engagement, m.name, m.name_ar, nullif(v_note, ''), jsonb_build_array(kafaa_res_hist('interested', v_note)), false, now(), now())
  on conflict (id) do update set status = 'interested', note = excluded.note, alumni_name = excluded.alumni_name, alumni_name_ar = excluded.alumni_name_ar,
    history = kafaa_reserve_engagements.history || jsonb_build_array(kafaa_res_hist('interested', v_note)), updated_at = now();
  perform kafaa_res_recount(r.id);
  a := kafaa_audit('reserve.interest', 'reserve_engagements', v_id, 'ok', case when e.status = 'invited' then 'invitation accepted' else 'interest' end, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Interest sent to HR', a, null, jsonb_build_object('id', v_id, 'status', 'interested'));
end $$;

-- ───────────── RPC: HR invites a matched member to an open request
create or replace function kafaa_invite_reserve(p_request_id text, p_alumni_id text, p_note text default '') returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_hr text; r kafaa_reserve_requests; m kafaa_alumni; e kafaa_reserve_engagements; v_note text := btrim(coalesce(p_note, ''), E' \t\n\r'); v_id text; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('reserve.invite', 'reserve_requests', p_request_id, 'not_signed_in', 'Sign in to use the alumni and expert reserve'); end if;
  v_hr := kafaa_res_hr_role();
  if v_hr is null then return kafaa_refuse('reserve.invite', 'reserve_requests', p_request_id, 'forbidden', 'Only HR (the HR analyst or the CHCO office) decides reserve requests and engagements', kafaa_acting_role('opportunities', array['W', 'A', 'Own'])); end if;
  select * into r from kafaa_reserve_requests where id = p_request_id;
  if r.id is null then return kafaa_refuse('reserve.invite', 'reserve_requests', p_request_id, 'not_found', 'Reserve request not found', v_hr); end if;
  if r.status <> 'open' then return kafaa_refuse('reserve.invite', 'reserve_requests', p_request_id, 'invalid', 'This request is not open to the reserve', v_hr); end if;
  select * into m from kafaa_alumni where id = p_alumni_id;
  if m.id is null or m.status <> 'active' then return kafaa_refuse('reserve.invite', 'reserve_requests', p_request_id, 'not_found', 'Alumnus not found or no longer in the reserve', v_hr); end if;
  if m.person_id is not null and m.person_id = r.posted_by then return kafaa_refuse('reserve.invite', 'reserve_requests', p_request_id, 'conflict', 'You cannot take part in your own reserve request', v_hr); end if;
  if m.person_id is not null and m.person_id = me then return kafaa_refuse('reserve.invite', 'reserve_requests', p_request_id, 'maker_checker', 'You cannot approve a reserve request or engagement that you raised or that involves you', v_hr); end if;
  if length(v_note) > 500 then return kafaa_refuse('reserve.invite', 'reserve_requests', p_request_id, 'invalid', 'Keep the note under 500 characters', v_hr); end if;
  if kafaa_res_contact(v_note) then return kafaa_refuse('reserve.invite', 'reserve_requests', p_request_id, 'contact_data', 'Do not include contact details (email addresses or phone numbers): HR arranges contact outside Kafa''a', v_hr); end if;
  v_id := 're:' || r.id || ':' || m.id;
  select * into e from kafaa_reserve_engagements where id = v_id;
  if e.id is not null and e.status in ('invited', 'interested', 'handed_to_hr', 'completed', 'declined') then
    return kafaa_refuse('reserve.invite', 'reserve_requests', p_request_id, 'conflict', 'There is already an engagement for this alumnus on this request', v_hr);
  end if;
  insert into kafaa_reserve_engagements (id, request_id, alumni_id, person_id, poster_id, poster_read_id, status, engagement, alumni_name, alumni_name_ar, note, hr_note, history, open_read, created_at, updated_at)
  values (v_id, r.id, m.id, m.person_id, r.posted_by, null, 'invited', r.engagement, m.name, m.name_ar, null, nullif(v_note, ''), jsonb_build_array(kafaa_res_hist('invited', v_note)), false, now(), now())
  on conflict (id) do update set status = 'invited', note = null, hr_note = excluded.hr_note, alumni_name = excluded.alumni_name, alumni_name_ar = excluded.alumni_name_ar,
    history = kafaa_reserve_engagements.history || jsonb_build_array(kafaa_res_hist('invited', v_note)), updated_at = now();
  perform kafaa_res_notify('nt-' || v_id || '-invited', m.person_id, 'HR invites you to a reserve request: ' || r.title_en, 'تدعوك الموارد البشرية إلى طلب من الاحتياطي: ' || r.title_ar, '/opportunities/reserve/me', 'info');
  perform kafaa_res_recount(r.id);
  a := kafaa_audit('reserve.invite', 'reserve_engagements', v_id, 'ok', format('invited %s', m.id), 'not_applicable', null, v_hr);
  return kafaa_result(true, 'ok', 'Invitation sent', a, null, jsonb_build_object('id', v_id, 'status', 'invited'));
end $$;

-- ───────────── RPC: HR approves ("handed to HR") or declines; the poster or HR completes; the alumnus withdraws
create or replace function kafaa_decide_reserve_engagement(p_engagement_id text, p_decision text, p_note text default '') returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); e kafaa_reserve_engagements; r kafaa_reserve_requests; v_hr text; v_role text; v_note text := btrim(coalesce(p_note, ''), E' \t\n\r'); v_from text[]; v_to text;
  v_ledger text; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('reserve.engagement', 'reserve_engagements', p_engagement_id, 'not_signed_in', 'Sign in to use the alumni and expert reserve'); end if;
  select * into e from kafaa_reserve_engagements where id = p_engagement_id;
  if not coalesce(kafaa_res_eng_visible(e), false) then return kafaa_refuse('reserve.engagement', 'reserve_engagements', p_engagement_id, 'not_found', 'Engagement not found'); end if;
  case coalesce(p_decision, '')
    when 'approve' then v_from := array['interested']; v_to := 'handed_to_hr';
    when 'decline' then v_from := array['invited', 'interested']; v_to := 'declined';
    when 'complete' then v_from := array['handed_to_hr']; v_to := 'completed';
    when 'withdraw' then v_from := array['invited', 'interested', 'handed_to_hr']; v_to := 'withdrawn';
    else return kafaa_refuse('reserve.engagement', 'reserve_engagements', e.id, 'invalid', 'Unknown decision');
  end case;
  v_hr := kafaa_res_hr_role();
  v_role := coalesce(v_hr, kafaa_acting_role('opportunities', array['W', 'A', 'Own']));
  select * into r from kafaa_reserve_requests where id = e.request_id;
  if p_decision in ('approve', 'decline') then
    if v_hr is null then return kafaa_refuse('reserve.engagement', 'reserve_engagements', e.id, 'forbidden', 'Only HR (the HR analyst or the CHCO office) decides reserve requests and engagements', v_role); end if;
    if p_decision = 'approve' and (e.poster_id = me or e.person_id = me) then return kafaa_refuse('reserve.engagement', 'reserve_engagements', e.id, 'maker_checker', 'You cannot approve a reserve request or engagement that you raised or that involves you', v_role); end if;
  elsif p_decision = 'complete' then
    if e.poster_id <> me and v_hr is null then return kafaa_refuse('reserve.engagement', 'reserve_engagements', e.id, 'forbidden', 'Only the requesting manager or HR can confirm the outcome', v_role); end if;
  elsif e.person_id is distinct from me then return kafaa_refuse('reserve.engagement', 'reserve_engagements', e.id, 'forbidden', 'Only the alumnus can withdraw from an engagement', v_role);
  end if;
  if not (e.status = any(v_from)) then return kafaa_refuse('reserve.engagement', 'reserve_engagements', e.id, 'invalid', 'That engagement change is not allowed', v_role); end if;
  if p_decision = 'approve' and r.status <> 'open' then return kafaa_refuse('reserve.engagement', 'reserve_engagements', e.id, 'invalid', 'This request is not open to the reserve', v_role); end if;
  if p_decision = 'approve' and r.seats_taken >= r.seats then return kafaa_refuse('reserve.engagement', 'reserve_engagements', e.id, 'conflict', 'All places on this request are filled', v_role); end if;
  if p_decision = 'decline' and length(v_note) < 5 then return kafaa_refuse('reserve.engagement', 'reserve_engagements', e.id, 'invalid', 'Give a reason of at least 5 characters', v_role); end if;
  if p_decision = 'complete' and length(v_note) < 5 then return kafaa_refuse('reserve.engagement', 'reserve_engagements', e.id, 'invalid', 'Describe the outcome in at least one sentence', v_role); end if;
  if length(v_note) > 500 then return kafaa_refuse('reserve.engagement', 'reserve_engagements', e.id, 'invalid', 'Keep the note under 500 characters', v_role); end if;
  if kafaa_res_contact(v_note) then return kafaa_refuse('reserve.engagement', 'reserve_engagements', e.id, 'contact_data', 'Do not include contact details (email addresses or phone numbers): HR arranges contact outside Kafa''a', v_role); end if;
  update kafaa_reserve_engagements set status = v_to, history = history || jsonb_build_array(kafaa_res_hist(v_to, v_note)), updated_at = now(),
    poster_read_id = case when p_decision = 'approve' then e.poster_id else poster_read_id end,
    hr_by = case when p_decision in ('approve', 'decline') then me else hr_by end,
    hr_at = case when p_decision in ('approve', 'decline') then now() else hr_at end,
    hr_note = case when p_decision in ('approve', 'decline') then nullif(v_note, '') else hr_note end,
    completed_at = case when p_decision = 'complete' then now() else completed_at end,
    outcome_note = case when p_decision = 'complete' then v_note else outcome_note end
  where id = e.id;
  perform kafaa_res_recount(r.id);
  if p_decision = 'approve' then
    perform kafaa_res_notify('nt-' || e.id || '-handed', e.poster_id, 'HR approved an alumnus for: ' || r.title_en || '. HR arranges the engagement', 'اعتمدت الموارد البشرية خبيراً سابقاً لـ: ' || r.title_ar || '. تتولى الموارد البشرية الترتيبات', '/opportunities/reserve/request', 'ok');
    perform kafaa_res_notify('nt-' || e.id || '-handed-a', e.person_id, 'HR approved your engagement: ' || r.title_en || '. HR will contact you', 'اعتمدت الموارد البشرية مشاركتك: ' || r.title_ar || '. ستتواصل معك الموارد البشرية', '/opportunities/reserve/me', 'ok');
  end if;
  v_ledger := case p_decision when 'approve' then 'kafaa.reserve.engagement.approve' when 'complete' then 'kafaa.reserve.engagement.complete' end;
  if v_ledger is not null then l := kafaa_ledger(v_ledger, format('Reserve engagement %s on %s: %s', e.id, r.id, v_to)); end if;
  a := kafaa_audit('reserve.engagement', 'reserve_engagements', e.id, 'ok', format('%s -> %s', e.status, v_to), case when v_ledger is null then 'not_applicable' when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case p_decision when 'approve' then 'Engagement approved and handed to HR' when 'decline' then 'Engagement declined' when 'complete' then 'Engagement completed' else 'You withdrew from this engagement' end,
    a, l, jsonb_build_object('status', v_to));
end $$;

-- ───────────── Reads
create or replace function kafaa_reserve_board() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); m kafaa_alumni;
begin
  if me is null then return null; end if;
  select * into m from kafaa_alumni where person_id = me order by (status = 'active') desc, id collate "C" limit 1;
  if m.id is null then return null; end if;
  return kafaa_res_board_compute(m);
end $$;
create or replace function kafaa_reserve_desk() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if kafaa_me() is null or kafaa_res_hr_role() is null then return null; end if;
  return kafaa_res_desk_compute(current_date);
end $$;

revoke execute on function kafaa_res_hr_role(), kafaa_res_contact(text), kafaa_res_len(jsonb), kafaa_res_int(jsonb, integer, integer), kafaa_res_is_date(text), kafaa_res_add_months(date, integer),
  kafaa_res_band(date, date), kafaa_res_ts(timestamptz), kafaa_res_hist(text, text), kafaa_res_notify(text, text, text, text, text, text), kafaa_res_validate_join(jsonb),
  kafaa_res_validate_request(jsonb, date), kafaa_res_snapshot(text), kafaa_res_recount(text), kafaa_res_req_visible(kafaa_reserve_requests), kafaa_res_eng_visible(kafaa_reserve_engagements),
  kafaa_res_board_compute(kafaa_alumni), kafaa_res_cell(text, integer), kafaa_res_stats_compute(date), kafaa_res_desk_compute(date)
  from public, anon, authenticated;
revoke execute on function kafaa_join_reserve(jsonb), kafaa_request_reserve(jsonb), kafaa_decide_reserve_request(text, text, text), kafaa_reserve_interest(text, text),
  kafaa_invite_reserve(text, text, text), kafaa_decide_reserve_engagement(text, text, text), kafaa_reserve_board(), kafaa_reserve_desk() from public, anon;
grant execute on function kafaa_join_reserve(jsonb), kafaa_request_reserve(jsonb), kafaa_decide_reserve_request(text, text, text), kafaa_reserve_interest(text, text),
  kafaa_invite_reserve(text, text, text), kafaa_decide_reserve_engagement(text, text, text), kafaa_reserve_board(), kafaa_reserve_desk() to authenticated;
