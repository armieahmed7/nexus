-- [W4 · E5 · F31] Kafa'a instructor and SME qualification pipeline (M02): SME nomination (self, line manager or training manager) ->
-- acceptance by the training manager (assigns the initial course INSTR-101, or ASIP-101 on the ASIP route) -> two co-teach observations ->
-- one solo observed delivery (three different observers) -> qualification by the training manager (maker-checker) -> annual currency
-- (40 delivery hours and 8 hours of continuing development in each 12-month window; lapse at the window end; 90/60/30-day notices).
-- Observation forms reuse the F25 L3 mechanics (checklist items rated met / partly / not met, critical items, observer, date).
-- Shared writes, only inside these SECURITY DEFINER functions: M02 evaluator_quals (`eq-ins-<person>-<standard>`, the F31 contract
-- request), M04 enrolments (`en-ins-<track>`), F01 skill_evidence (`credential` on sk-ld-01-instruct, then kafaa_skills_apply) and
-- notifications (kind instructor).
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file, RLS in the per-statement form,
-- internal helpers and the RPCs. LocalBackend mirror: src/modules/m02/backend/local.ts; rules: src/modules/m02/instructors.ts.
-- PGlite checks: scripts/validate/w4e5-instructors.mjs.

-- ───────────── Tables (generated DDL)
-- M02 · Instructor and SME qualification track (F31)
create table if not exists kafaa_instructor_tracks (
  id text primary key,
  person_id text not null,
  person_name text not null default '',
  person_name_ar text not null default '',
  route text not null default 'sme' check (route in ('sme', 'asip')),
  discipline text not null default '',
  standard_ids text[] not null default '{}'::text[],
  skill_ids text[] not null default '{}'::text[],
  stage text not null default 'nominated' check (stage in ('nominated', 'initial_training', 'co_teach', 'solo', 'ready', 'qualified')),
  status text not null default 'active' check (status in ('active', 'qualified', 'lapsed', 'withdrawn', 'declined')),
  started_on date not null,
  nominated_by text,
  nomination_kind text not null default 'self' check (nomination_kind in ('self', 'manager', 'training_manager')),
  motivation text,
  accepted_on date,
  accepted_by text,
  initial_done_on date,
  qualified_on date,
  first_qualified_on date,
  qualified_by text,
  currency_due date,
  currency_status text check (currency_status in ('current', 'due', 'at_risk', 'lapsed')),
  lapsed_on date,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table kafaa_instructor_tracks is '[M02] Instructor and SME qualification track: nomination, initial training, observed deliveries, qualification and annual currency (F31)';

-- M02 · Observed instructor delivery (co-teach, solo or currency) with a checklist score; append-only (F31)
create table if not exists kafaa_instructor_observations (
  id text primary key,
  track_id text not null,
  person_id text not null,
  observer_person_id text not null,
  observer_name text not null default '',
  observer_name_ar text not null default '',
  kind text not null check (kind in ('co_teach', 'solo', 'currency')),
  observed_on date not null,
  items jsonb not null default '[]'::jsonb,
  score integer not null,
  result text not null check (result in ('pass', 'fail')),
  session_id text,
  course_id text,
  note text,
  created_at timestamptz not null default now()
);
comment on table kafaa_instructor_observations is '[M02] Observed instructor delivery (co-teach, solo or currency) with a checklist score; append-only (F31)';

-- M02 · Instructor teaching hours (from attended M04 sessions or the scheduling-system mirror) and continuing development (F31)
create table if not exists kafaa_teaching_hours (
  id text primary key,
  person_id text not null,
  track_id text,
  kind text not null check (kind in ('delivery', 'cpd')),
  source text not null default 'mirror' check (source in ('session', 'mirror', 'self')),
  session_id text,
  course_id text,
  delivered_on date not null,
  hours numeric not null,
  note text,
  recorded_by text,
  created_at timestamptz not null default now()
);
comment on table kafaa_teaching_hours is '[M02] Instructor teaching hours (from attended M04 sessions or the scheduling-system mirror) and continuing development (F31)';

do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_instructor_tracks_person_id_fk') then alter table kafaa_instructor_tracks add constraint kafaa_instructor_tracks_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_instructor_tracks_nominated_by_fk') then alter table kafaa_instructor_tracks add constraint kafaa_instructor_tracks_nominated_by_fk foreign key (nominated_by) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_instructor_tracks_accepted_by_fk') then alter table kafaa_instructor_tracks add constraint kafaa_instructor_tracks_accepted_by_fk foreign key (accepted_by) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_instructor_tracks_qualified_by_fk') then alter table kafaa_instructor_tracks add constraint kafaa_instructor_tracks_qualified_by_fk foreign key (qualified_by) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_instructor_observations_track_id_fk') then alter table kafaa_instructor_observations add constraint kafaa_instructor_observations_track_id_fk foreign key (track_id) references kafaa_instructor_tracks(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_instructor_observations_person_id_fk') then alter table kafaa_instructor_observations add constraint kafaa_instructor_observations_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_instructor_observations_observer_person_id_fk') then alter table kafaa_instructor_observations add constraint kafaa_instructor_observations_observer_person_id_fk foreign key (observer_person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_instructor_observations_session_id_fk') then alter table kafaa_instructor_observations add constraint kafaa_instructor_observations_session_id_fk foreign key (session_id) references kafaa_sessions(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_instructor_observations_course_id_fk') then alter table kafaa_instructor_observations add constraint kafaa_instructor_observations_course_id_fk foreign key (course_id) references kafaa_courses(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_teaching_hours_person_id_fk') then alter table kafaa_teaching_hours add constraint kafaa_teaching_hours_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_teaching_hours_track_id_fk') then alter table kafaa_teaching_hours add constraint kafaa_teaching_hours_track_id_fk foreign key (track_id) references kafaa_instructor_tracks(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_teaching_hours_session_id_fk') then alter table kafaa_teaching_hours add constraint kafaa_teaching_hours_session_id_fk foreign key (session_id) references kafaa_sessions(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_teaching_hours_course_id_fk') then alter table kafaa_teaching_hours add constraint kafaa_teaching_hours_course_id_fk foreign key (course_id) references kafaa_courses(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_instructor_tracks_person_id_idx on kafaa_instructor_tracks (person_id);
create index if not exists kafaa_instructor_tracks_stage_idx on kafaa_instructor_tracks (stage);
create index if not exists kafaa_instructor_tracks_status_idx on kafaa_instructor_tracks (status);
create index if not exists kafaa_instructor_tracks_nominated_by_idx on kafaa_instructor_tracks (nominated_by);
create index if not exists kafaa_instructor_tracks_accepted_by_idx on kafaa_instructor_tracks (accepted_by);
create index if not exists kafaa_instructor_tracks_qualified_by_idx on kafaa_instructor_tracks (qualified_by);
create index if not exists kafaa_instructor_observations_track_id_idx on kafaa_instructor_observations (track_id);
create index if not exists kafaa_instructor_observations_person_id_idx on kafaa_instructor_observations (person_id);
create index if not exists kafaa_instructor_observations_observer_person_id_idx on kafaa_instructor_observations (observer_person_id);
create index if not exists kafaa_instructor_observations_session_id_idx on kafaa_instructor_observations (session_id);
create index if not exists kafaa_instructor_observations_course_id_idx on kafaa_instructor_observations (course_id);
create index if not exists kafaa_teaching_hours_person_id_idx on kafaa_teaching_hours (person_id);
create index if not exists kafaa_teaching_hours_track_id_idx on kafaa_teaching_hours (track_id);
create index if not exists kafaa_teaching_hours_session_id_idx on kafaa_teaching_hours (session_id);
create index if not exists kafaa_teaching_hours_course_id_idx on kafaa_teaching_hours (course_id);
create index if not exists kafaa_teaching_hours_delivered_on_idx on kafaa_teaching_hours (delivered_on);


-- ───────────── RLS (policies created when missing, then set to the per-statement form like 20261008140000_kafaa_rls_perf.sql)
-- The person (own_profile Own), line managers and instructors in scope (qual_records Scope), and instructors, the training manager and
-- auditors (sat R/W/A). Writes only through the SECURITY DEFINER RPCs below.
alter table kafaa_instructor_tracks enable row level security;
alter table kafaa_instructor_observations enable row level security;
alter table kafaa_teaching_hours enable row level security;
do $$ declare t text; begin
  foreach t in array array['kafaa_instructor_tracks', 'kafaa_instructor_observations', 'kafaa_teaching_hours'] loop
    if not exists (select 1 from pg_policies where tablename = t and policyname = 'kafaa_read') then
      execute format('create policy kafaa_read on %I for select to anon, authenticated using (false)', t);
    end if;
    execute format('alter policy kafaa_read on %I using ('
      || '((SELECT kafaa_has_grant(''own_profile''::text, ARRAY[''R''::text, ''W''::text, ''A''::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant(''own_profile''::text, ARRAY[''Own''::text, ''Scope''::text]))) OR ((SELECT kafaa_has_grant(''own_profile''::text, ARRAY[''Scope''::text])) AND kafaa_rule_read(''own_profile''::text, person_id, NULL::text, false))'
      || ' OR ((SELECT kafaa_has_grant(''qual_records''::text, ARRAY[''R''::text, ''W''::text, ''A''::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant(''qual_records''::text, ARRAY[''Own''::text, ''Scope''::text]))) OR ((SELECT kafaa_has_grant(''qual_records''::text, ARRAY[''Scope''::text])) AND kafaa_rule_read(''qual_records''::text, person_id, NULL::text, false))'
      || ' OR ((SELECT kafaa_has_grant(''sat''::text, ARRAY[''R''::text, ''W''::text, ''A''::text]))))', t);
  end loop;
end $$;
grant select on kafaa_instructor_tracks, kafaa_instructor_observations, kafaa_teaching_hours to anon, authenticated;
revoke insert, update on kafaa_instructor_tracks, kafaa_instructor_observations, kafaa_teaching_hours from anon, authenticated;

-- Observations are append-only: a correction is a new observation. Seed loads (kafaa.seeding on) may re-apply identical rows.
create or replace function kafaa_ins_obs_append_only() returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('kafaa.seeding', true), '') = 'on' then return new; end if;
  raise exception 'Instructor observations are append-only; record a new observation instead' using errcode = '42501';
end $$;
create or replace trigger kafaa_ins_obs_append_only before update on kafaa_instructor_observations for each row execute function kafaa_ins_obs_append_only();

-- ───────────── Internal helpers (mirror of src/modules/m02/instructors.ts)
create or replace function kafaa_ins_is_date(t text) returns boolean language plpgsql immutable set search_path = public as $$
begin
  if t is null or t !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
  perform t::date;
  return to_char(t::date, 'YYYY-MM-DD') = t;
exception when others then return false;
end $$;
create or replace function kafaa_ins_add_months(d date, n integer) returns date language sql immutable set search_path = public as $$
  select (d + make_interval(months => n))::date
$$;
create or replace function kafaa_ins_tlen(j jsonb) returns integer language sql immutable set search_path = public as $$
  select case when jsonb_typeof(j) = 'string' then length(btrim(j #>> '{}', E' \t\n\r')) else -1 end
$$;
create or replace function kafaa_ins_num(x numeric) returns numeric language sql immutable set search_path = public as $$
  select trim_scale(round(coalesce(x, 0), 1))
$$;
create or replace function kafaa_ins_refusal(p_code text, p_message text) returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object('code', p_code, 'message', p_message)
$$;
-- scoreObservation: met 2, partly 1, not met 0 over the eight items (%, rounded); pass >= 75 with no critical item not met.
create or replace function kafaa_ins_score(p_items jsonb) returns jsonb language sql immutable set search_path = public as $$
  with k(key, critical, ord) as (values ('objectives', false, 1), ('accuracy', true, 2), ('safety', true, 3), ('engagement', false, 4), ('oe', false, 5), ('assessment', true, 6), ('feedback', false, 7), ('time', false, 8)),
       r as (select k.key, k.critical, k.ord, (select e->>'rating' from jsonb_array_elements(p_items) e where e->>'key' = k.key limit 1) as rating from k),
       s as (select round((sum(case rating when 'met' then 2 when 'partly' then 1 else 0 end) * 100)::numeric / 16)::integer as score from r)
  select jsonb_build_object('score', s.score,
    'result', case when s.score >= 75 and not exists (select 1 from r where critical and rating = 'not_met') then 'pass' else 'fail' end,
    'critical_failed', coalesce((select jsonb_agg(key order by ord) from r where critical and rating = 'not_met'), '[]'::jsonb)) from s
$$;
-- validateObservation
create or replace function kafaa_ins_validate_obs(p jsonb, p_today date) returns jsonb language plpgsql immutable set search_path = public as $$
declare bad jsonb := kafaa_ins_refusal('invalid', 'Rate all eight checklist items (met, partly or not met), give an observation date that is not in the future and keep the note under 600 characters'); v_items jsonb := p->'items';
begin
  if jsonb_typeof(p->'kind') is distinct from 'string' or (p->>'kind') not in ('co_teach', 'solo', 'currency') then return bad; end if;
  if jsonb_typeof(v_items) is distinct from 'array' or jsonb_array_length(v_items) <> 8 then return bad; end if;
  if exists (select 1 from jsonb_array_elements(v_items) e where jsonb_typeof(e) <> 'object' or jsonb_typeof(e->'key') is distinct from 'string'
       or (e->>'key') not in ('objectives', 'accuracy', 'safety', 'engagement', 'oe', 'assessment', 'feedback', 'time')
       or jsonb_typeof(e->'rating') is distinct from 'string' or (e->>'rating') not in ('met', 'partly', 'not_met'))
     or (select count(distinct e->>'key') from jsonb_array_elements(v_items) e) <> 8 then return bad; end if;
  if jsonb_typeof(p->'observed_on') is distinct from 'string' or not kafaa_ins_is_date(p->>'observed_on') then return bad; end if;
  if (p->>'observed_on')::date > p_today or (p->>'observed_on')::date < kafaa_ins_add_months(p_today, -24) then return bad; end if;
  if p->'note' is not null and jsonb_typeof(p->'note') <> 'null' and (jsonb_typeof(p->'note') <> 'string' or kafaa_ins_tlen(p->'note') > 600) then return bad; end if;
  return null;
end $$;
-- validateNomination
create or replace function kafaa_ins_validate_nom(p jsonb) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare bad jsonb := kafaa_ins_refusal('invalid', 'Choose a route, one to three current qualification standards (never security), up to six catalogue skills and a motivation under 600 characters'); v_s jsonb := p->'standard_ids';
  v_k jsonb := case when p->'skill_ids' is null or jsonb_typeof(p->'skill_ids') = 'null' then '[]'::jsonb else p->'skill_ids' end;
begin
  if jsonb_typeof(p->'route') is distinct from 'string' or (p->>'route') not in ('sme', 'asip') then return bad; end if;
  if jsonb_typeof(v_s) is distinct from 'array' or jsonb_array_length(v_s) < 1 or jsonb_array_length(v_s) > 3
     or exists (select 1 from jsonb_array_elements(v_s) e where jsonb_typeof(e) <> 'string') or (select count(distinct e) from jsonb_array_elements(v_s) e) <> jsonb_array_length(v_s) then return bad; end if;
  if jsonb_typeof(v_k) is distinct from 'array' or jsonb_array_length(v_k) > 6
     or exists (select 1 from jsonb_array_elements(v_k) e where jsonb_typeof(e) <> 'string') or (select count(distinct e) from jsonb_array_elements(v_k) e) <> jsonb_array_length(v_k) then return bad; end if;
  if exists (select 1 from jsonb_array_elements_text(v_s) s(x) join kafaa_qual_standards q on q.id = s.x where coalesce(q.security_restricted, false))
     or exists (select 1 from jsonb_array_elements_text(v_k) s(x) join kafaa_skills k on k.id = s.x where k.area = 'security') then
    return kafaa_ins_refusal('security_restricted', 'Security, cyber and safeguards roles are career-path only and cannot join the instructor track');
  end if;
  if exists (select 1 from jsonb_array_elements_text(v_s) s(x) left join kafaa_qual_standards q on q.id = s.x where q.status is distinct from 'current')
     or exists (select 1 from jsonb_array_elements_text(v_k) s(x) where not exists (select 1 from kafaa_skills k where k.id = s.x)) then return bad; end if;
  if p->'motivation' is not null and jsonb_typeof(p->'motivation') <> 'null' and (jsonb_typeof(p->'motivation') <> 'string' or kafaa_ins_tlen(p->'motivation') > 600) then return bad; end if;
  return null;
end $$;
-- validateHours
create or replace function kafaa_ins_validate_hours(p jsonb, p_today date) returns jsonb language plpgsql immutable set search_path = public as $$
declare bad jsonb := kafaa_ins_refusal('invalid', 'Give 0.5 to 12 hours in half-hour steps, a date in the last 12 months that is not in the future and a note under 600 characters'); h numeric;
begin
  if jsonb_typeof(p->'kind') is distinct from 'string' or (p->>'kind') not in ('delivery', 'cpd') then return bad; end if;
  if jsonb_typeof(p->'hours') is distinct from 'number' then return bad; end if;
  h := (p->>'hours')::numeric;
  if h < 0.5 or h > 12 or h * 2 <> trunc(h * 2) then return bad; end if;
  if jsonb_typeof(p->'delivered_on') is distinct from 'string' or not kafaa_ins_is_date(p->>'delivered_on') then return bad; end if;
  if (p->>'delivered_on')::date > p_today or (p->>'delivered_on')::date < kafaa_ins_add_months(p_today, -12) then return bad; end if;
  if p->'note' is not null and jsonb_typeof(p->'note') <> 'null' and (jsonb_typeof(p->'note') <> 'string' or kafaa_ins_tlen(p->'note') > 600) then return bad; end if;
  return null;
end $$;
-- standardSkills: the skills a standard evidences (never security), sorted.
create or replace function kafaa_ins_std_skills(p_stds text[]) returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(k.id order by k.id collate "C"), '{}'::text[]) from kafaa_skills k where k.area is distinct from 'security' and k.evidence_keys && p_stds
$$;
-- initialDoneOn: first completion of the route's initial course (INSTR-101 / ASIP-101).
create or replace function kafaa_ins_initial_done(p_person text, p_route text) returns date language sql stable security definer set search_path = public as $$
  select min(completed_on) from kafaa_training_records
  where person_id = p_person and course_id = case p_route when 'asip' then 'c-asip' when 'sme' then 'c-instr' end and result in ('completed', 'passed')
$$;
create or replace function kafaa_ins_okey(o kafaa_instructor_observations) returns text language sql immutable set search_path = public as $$
  select o.observed_on::text || '|' || o.id
$$;
-- coTeachPair: first pair of passed co-teach observations by two different observers (by date, id); none of them by p_exclude.
create or replace function kafaa_ins_co_pair(p_track text, p_exclude text) returns text[] language sql stable security definer set search_path = public as $$
  select array[a.id, b.id] from kafaa_instructor_observations a join kafaa_instructor_observations b on b.track_id = a.track_id
  where a.track_id = p_track and a.kind = 'co_teach' and b.kind = 'co_teach' and a.result = 'pass' and b.result = 'pass'
    and kafaa_ins_okey(a) collate "C" < kafaa_ins_okey(b) collate "C" and a.observer_person_id <> b.observer_person_id
    and (nullif(p_exclude, '') is null or (a.observer_person_id <> p_exclude and b.observer_person_id <> p_exclude))
  order by kafaa_ins_okey(a) collate "C", kafaa_ins_okey(b) collate "C" limit 1
$$;
-- qualifyingSet: two passed co-teach and one passed solo observation by three different observers.
create or replace function kafaa_ins_qual_set(p_track text, p_exclude text) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('co', jsonb_build_array(a.id, b.id), 'solo', c.id)
  from kafaa_instructor_observations a join kafaa_instructor_observations b on b.track_id = a.track_id join kafaa_instructor_observations c on c.track_id = a.track_id
  where a.track_id = p_track and a.kind = 'co_teach' and b.kind = 'co_teach' and c.kind = 'solo' and a.result = 'pass' and b.result = 'pass' and c.result = 'pass'
    and kafaa_ins_okey(a) collate "C" < kafaa_ins_okey(b) collate "C" and a.observer_person_id <> b.observer_person_id
    and c.observer_person_id <> a.observer_person_id and c.observer_person_id <> b.observer_person_id
    and (nullif(p_exclude, '') is null or (a.observer_person_id <> p_exclude and b.observer_person_id <> p_exclude and c.observer_person_id <> p_exclude))
  order by kafaa_ins_okey(a) collate "C", kafaa_ins_okey(b) collate "C", kafaa_ins_okey(c) collate "C" limit 1
$$;
-- reinstateObservation: passed currency observation on or after the lapse date, not by p_exclude.
create or replace function kafaa_ins_reinstate_obs(p_track text, p_lapsed date, p_exclude text) returns text language sql stable security definer set search_path = public as $$
  select o.id from kafaa_instructor_observations o
  where p_lapsed is not null and o.track_id = p_track and o.kind = 'currency' and o.result = 'pass' and o.observed_on >= p_lapsed
    and (nullif(p_exclude, '') is null or o.observer_person_id <> p_exclude)
  order by kafaa_ins_okey(o) collate "C" limit 1
$$;
-- deriveStage
create or replace function kafaa_ins_stage(p_track text, p_initial date) returns text language sql stable security definer set search_path = public as $$
  select case when t.status in ('withdrawn', 'declined') then t.stage
              when t.status in ('qualified', 'lapsed') then 'qualified'
              when t.accepted_on is null then 'nominated'
              when p_initial is null then 'initial_training'
              when kafaa_ins_co_pair(t.id, null) is null then 'co_teach'
              when kafaa_ins_qual_set(t.id, null) is null then 'solo'
              else 'ready' end
  from kafaa_instructor_tracks t where t.id = p_track
$$;
-- observationGate
create or replace function kafaa_ins_obs_gate(p_track text, p_kind text, p_initial date, p_on date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t kafaa_instructor_tracks;
begin
  select * into t from kafaa_instructor_tracks where id = p_track;
  if t.status in ('withdrawn', 'declined') then return kafaa_ins_refusal('not_active', 'This instructor track is closed'); end if;
  if t.status in ('qualified', 'lapsed') then return case when p_kind = 'currency' then null else kafaa_ins_refusal('wrong_stage', 'This instructor is qualified: record a currency observation instead') end; end if;
  if p_kind = 'currency' then return kafaa_ins_refusal('wrong_stage', 'Co-teach and solo observations are complete; currency observations start after qualification'); end if;
  if t.accepted_on is null then return kafaa_ins_refusal('wrong_stage', 'The training manager has not accepted this nomination yet'); end if;
  if p_on < t.accepted_on then return kafaa_ins_refusal('invalid', 'The observation date is before the nomination was accepted'); end if;
  if p_initial is null then return kafaa_ins_refusal('wrong_stage', 'Complete the instructor initial training course before co-teach observations'); end if;
  if p_kind = 'solo' and kafaa_ins_co_pair(t.id, null) is null then return kafaa_ins_refusal('wrong_stage', 'A solo observation needs two passed co-teach observations by different observers first'); end if;
  if kafaa_ins_qual_set(t.id, null) is not null then return kafaa_ins_refusal('wrong_stage', 'Co-teach and solo observations are complete; currency observations start after qualification'); end if;
  return null;
end $$;
create or replace function kafaa_ins_sum(p_person text, p_kind text, p_from date, p_to_excl date) returns numeric language sql stable security definer set search_path = public as $$
  select round(coalesce(sum(hours), 0), 1) from kafaa_teaching_hours where person_id = p_person and kind = p_kind and delivered_on >= p_from and delivered_on < p_to_excl
$$;
create or replace function kafaa_ins_cv(p_status text, p_due date, p_start date, p_h numeric, p_c numeric, p_days integer, p_met boolean, p_notice integer, p_renewals integer, p_lapsed date)
returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object('status', p_status, 'due', p_due, 'window_start', p_start, 'hours', kafaa_ins_num(p_h), 'cpd', kafaa_ins_num(p_c), 'days', p_days, 'met', p_met,
    'notice', p_notice, 'renewals', p_renewals, 'lapsed_on', p_lapsed,
    'short_hours', kafaa_ins_num(greatest(0, 40 - p_h)), 'short_cpd', kafaa_ins_num(greatest(0, 8 - p_c)))
$$;
-- currencyView: annual windows [q + 12(k-1) months, q + 12k months) from the (re)qualification date q.
create or replace function kafaa_ins_currency(p_track text, p_today date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t kafaa_instructor_tracks; q date; k integer; v_end date; v_start date; h numeric; c numeric; v_at date; d integer; v_met boolean;
begin
  select * into t from kafaa_instructor_tracks where id = p_track;
  if t.id is null or t.status not in ('qualified', 'lapsed') or t.qualified_on is null then return null; end if;
  q := t.qualified_on;
  if t.status = 'lapsed' then
    v_at := coalesce(t.lapsed_on, t.currency_due, p_today);
    k := 1;
    while k < 60 and kafaa_ins_add_months(q, 12 * k) < v_at loop k := k + 1; end loop;
    v_start := kafaa_ins_add_months(q, 12 * (k - 1));
    h := kafaa_ins_sum(t.person_id, 'delivery', v_start, v_at);
    c := kafaa_ins_sum(t.person_id, 'cpd', v_start, v_at);
    return kafaa_ins_cv('lapsed', v_at, v_start, h, c, v_at - p_today, false, null, k - 1, v_at);
  end if;
  for k in 1..59 loop
    v_end := kafaa_ins_add_months(q, 12 * k);
    v_start := kafaa_ins_add_months(q, 12 * (k - 1));
    if v_end > p_today then
      h := kafaa_ins_sum(t.person_id, 'delivery', v_start, p_today + 1);
      c := kafaa_ins_sum(t.person_id, 'cpd', v_start, p_today + 1);
      d := v_end - p_today;
      v_met := h >= 40 and c >= 8;
      return kafaa_ins_cv(case when v_met then 'current' when d <= 30 then 'at_risk' when d <= 90 then 'due' else 'current' end, v_end, v_start, h, c, d, v_met,
        case when v_met then null when d <= 30 then 30 when d <= 60 then 60 when d <= 90 then 90 end, k - 1, null);
    end if;
    h := kafaa_ins_sum(t.person_id, 'delivery', v_start, v_end);
    c := kafaa_ins_sum(t.person_id, 'cpd', v_start, v_end);
    if h < 40 or c < 8 then
      return kafaa_ins_cv('lapsed', v_end, v_start, h, c, v_end - p_today, false, null, k - 1, v_end);
    end if;
  end loop;
  return null;
end $$;
-- sessionHours: duration rounded to the nearest half hour, capped at 12.
create or replace function kafaa_ins_session_hours(p_start timestamptz, p_end timestamptz) returns numeric language sql immutable set search_path = public as $$
  select case when p_start is null or p_end is null or p_end <= p_start then 0
              else trim_scale(least(12, round(extract(epoch from (p_end - p_start)) / 3600 * 2) / 2)) end
$$;
-- Notification (kind instructor), idempotent by id; row-audit quiet like the LocalBackend. Returns true when inserted.
create or replace function kafaa_ins_notify(p_id text, p_person text, p_en text, p_ar text, p_link text, p_sev text) returns boolean language plpgsql security definer set search_path = public as $$
declare v_prev text := current_setting('kafaa.seeding', true); n integer;
begin
  if p_person is null or not exists (select 1 from kafaa_people where id = p_person) or exists (select 1 from kafaa_notifications where id = p_id) then return false; end if;
  perform set_config('kafaa.seeding', 'on', true);
  insert into kafaa_notifications (id, person_id, kind, title_en, title_ar, link, severity) values (p_id, p_person, 'instructor', p_en, p_ar, p_link, p_sev) on conflict (id) do nothing;
  get diagnostics n = row_count;
  perform set_config('kafaa.seeding', coalesce(v_prev, ''), true);
  return n > 0;
end $$;
-- evaluator_quals rows of a track (`eq-ins-<person>-<standard>`): set valid_to, or only cut it back when p_only_if_later.
create or replace function kafaa_ins_set_eq(p_track text, p_valid date, p_only_if_later boolean) returns void language plpgsql security definer set search_path = public as $$
declare t kafaa_instructor_tracks; s text; v_id text; cur kafaa_evaluator_quals; v_prev text := current_setting('kafaa.seeding', true);
begin
  select * into t from kafaa_instructor_tracks where id = p_track;
  if t.id is null then return; end if;
  perform set_config('kafaa.seeding', 'on', true);
  for s in select x from unnest(t.standard_ids) as u(x) order by x collate "C" loop
    v_id := 'eq-ins-' || t.person_id || '-' || s;
    select * into cur from kafaa_evaluator_quals where id = v_id;
    if cur.id is null then
      if not p_only_if_later then insert into kafaa_evaluator_quals (id, person_id, standard_id, valid_to) values (v_id, t.person_id, s, p_valid); end if;
    elsif not p_only_if_later or cur.valid_to > p_valid then
      update kafaa_evaluator_quals set valid_to = p_valid where id = v_id;
    end if;
  end loop;
  perform set_config('kafaa.seeding', coalesce(v_prev, ''), true);
end $$;
-- F01 credential evidence on sk-ld-01-instruct (level 3, evidenced); lapsed with the currency; then kafaa_skills_apply.
create or replace function kafaa_ins_set_credential(p_track text, p_status text) returns void language plpgsql security definer set search_path = public as $$
declare t kafaa_instructor_tracks; v_id text; cur kafaa_skill_evidence;
begin
  select * into t from kafaa_instructor_tracks where id = p_track;
  if t.id is null or not exists (select 1 from kafaa_skills where id = 'sk-ld-01-instruct') then return; end if;
  v_id := 'se:credential:' || t.id || ':sk-ld-01-instruct';
  select * into cur from kafaa_skill_evidence where id = v_id;
  if cur.id is null then
    if p_status = 'lapsed' then return; end if;
    insert into kafaa_skill_evidence (id, person_id, skill_id, kind, ref_table, ref_id, level, basis, status, observed_on, note, recorded_by, active)
    values (v_id, t.person_id, 'sk-ld-01-instruct', 'credential', 'instructor_tracks', t.id, 3, 'evidenced', p_status, current_date, 'Qualified instructor (F31)', kafaa_me(), true);
  elsif p_status = 'current' then
    update kafaa_skill_evidence set status = 'current', observed_on = current_date, active = true where id = v_id;
  else
    update kafaa_skill_evidence set status = p_status where id = v_id;
  end if;
  perform kafaa_skills_apply(t.person_id, current_date);
end $$;
create or replace function kafaa_ins_open(p_person text) returns kafaa_instructor_tracks language sql stable security definer set search_path = public as $$
  select * from kafaa_instructor_tracks where person_id = p_person and status in ('active', 'qualified', 'lapsed') order by id collate "C" limit 1
$$;
create or replace function kafaa_ins_hex() returns text language sql volatile set search_path = public as $$
  select substr(replace(gen_random_uuid()::text, '-', ''), 1, 24)
$$;

-- ───────────── RPC: nominate (self, line manager / scope, training manager)
create or replace function kafaa_nominate_instructor(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_pid text := case when jsonb_typeof(p->'person_id') = 'string' then p->>'person_id' end; v_role text; v_kind text := 'self';
  pp kafaa_people; bad jsonb; v_id text; v_stds text[]; v_skills text[]; std0 kafaa_qual_standards; v_mot text; v_tm text; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('instructor.nominate', 'instructor_tracks', v_pid, 'not_signed_in', 'Sign in to use the instructor pipeline'); end if;
  if v_pid = me then v_role := kafaa_acting_role('own_profile', array['Own']);
  elsif kafaa_acting_role('sat', array['A']) is not null then v_role := kafaa_acting_role('sat', array['A']); v_kind := 'training_manager';
  elsif v_pid is not null and kafaa_has_role('manager') and (kafaa_opp_line_manager(v_pid) = me or kafaa_in_scope('qual_records', v_pid)) then v_role := 'manager'; v_kind := 'manager';
  end if;
  if v_role is null then return kafaa_refuse('instructor.nominate', 'instructor_tracks', v_pid, 'forbidden', 'You can volunteer yourself; line managers nominate people in their team and the training manager nominates anyone'); end if;
  select * into pp from kafaa_people where id = v_pid;
  if pp.id is null then return kafaa_refuse('instructor.nominate', 'instructor_tracks', v_pid, 'not_found', 'Person not found', v_role); end if;
  if pp.kind <> 'staff' or pp.status = 'leaver' then return kafaa_refuse('instructor.nominate', 'instructor_tracks', v_pid, 'forbidden', 'Only ENEC staff can join the instructor track', v_role); end if;
  if coalesce(pp.job_family_id, '') in ('security', 'cyber', 'safeguards') then return kafaa_refuse('instructor.nominate', 'instructor_tracks', v_pid, 'security_restricted', 'Security, cyber and safeguards roles are career-path only and cannot join the instructor track', v_role); end if;
  bad := kafaa_ins_validate_nom(p);
  if bad is not null then return kafaa_refuse('instructor.nominate', 'instructor_tracks', v_pid, bad->>'code', bad->>'message', v_role); end if;
  if exists (select 1 from kafaa_instructor_tracks where person_id = v_pid and status in ('active', 'qualified', 'lapsed')) then
    return kafaa_refuse('instructor.nominate', 'instructor_tracks', v_pid, 'already_active', 'This person already has an open or qualified instructor track', v_role);
  end if;
  if p->>'route' = 'asip' and not exists (select 1 from kafaa_licences l where l.person_id = v_pid and l.type in ('SRO', 'SRO_QI') and l.status = 'valid' and l.expires_on >= current_date) then
    return kafaa_refuse('instructor.nominate', 'instructor_tracks', v_pid, 'not_eligible', 'The ASIP route is for holders of a valid SRO licence (mirror)', v_role);
  end if;
  v_stds := array(select x from jsonb_array_elements_text(p->'standard_ids') with ordinality as u(x, o) order by o);
  v_skills := case when jsonb_typeof(p->'skill_ids') = 'array' and jsonb_array_length(p->'skill_ids') > 0
                   then array(select x from jsonb_array_elements_text(p->'skill_ids') with ordinality as u(x, o) order by o)
                   else (kafaa_ins_std_skills(v_stds))[1:6] end;
  select * into std0 from kafaa_qual_standards where id = v_stds[1];
  v_id := 'it-' || kafaa_ins_hex();
  v_mot := nullif(btrim(coalesce(case when jsonb_typeof(p->'motivation') = 'string' then p->>'motivation' end, ''), E' \t\n\r'), '');
  insert into kafaa_instructor_tracks (id, person_id, person_name, person_name_ar, route, discipline, standard_ids, skill_ids, stage, status, started_on, nominated_by, nomination_kind, motivation, created_at, updated_at)
  values (v_id, v_pid, pp.display_name, coalesce(nullif(pp.display_name_ar, ''), pp.display_name), p->>'route', coalesce(std0.discipline, ''), v_stds, v_skills, 'nominated', 'active', current_date, me, v_kind, v_mot, now(), now());
  if v_pid <> me then
    perform kafaa_ins_notify('nt-ins-' || v_id || '-nominated', v_pid, 'You were nominated for the instructor track', 'تم ترشيحك لمسار المدربين', '/my/instructor', 'info');
  end if;
  for v_tm in select person_id from kafaa_role_assignments where role = 'training_manager' and status = 'active' group by person_id order by person_id collate "C" loop
    if v_tm <> me and v_tm <> v_pid then
      perform kafaa_ins_notify('nt-ins-' || v_id || '-tm-' || v_tm, v_tm, 'Instructor nomination to decide: ' || pp.display_name, 'ترشيح مدرب بانتظار القرار: ' || coalesce(nullif(pp.display_name_ar, ''), pp.display_name), '/training/instructors/' || v_id, 'info');
    end if;
  end loop;
  a := kafaa_audit('instructor.nominate', 'instructor_tracks', v_id, 'ok', format('%s nomination; %s; %s', v_kind, p->>'route', array_to_string(v_stds, ',')), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Nomination sent to the training manager', a, null, jsonb_build_object('id', v_id, 'status', 'active'));
end $$;

-- ───────────── RPC: the training manager accepts (assigns the initial course) or declines a nomination
create or replace function kafaa_decide_instructor_nomination(p_track text, p_decision text, p_note text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; t kafaa_instructor_tracks; v_n text := btrim(coalesce(p_note, ''), E' \t\n\r'); v_done date; v_course text; v_enr text; v_stage text;
  v_prev text := current_setting('kafaa.seeding', true); pp kafaa_people; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('instructor.decide', 'instructor_tracks', p_track, 'not_signed_in', 'Sign in to use the instructor pipeline'); end if;
  v_role := kafaa_acting_role('sat', array['A']);
  if v_role is null then return kafaa_refuse('instructor.decide', 'instructor_tracks', p_track, 'forbidden', 'Only the training manager decides nominations'); end if;
  select * into t from kafaa_instructor_tracks where id = p_track;
  if t.id is null then return kafaa_refuse('instructor.decide', 'instructor_tracks', p_track, 'not_found', 'Instructor track not found', v_role); end if;
  if t.person_id = me then return kafaa_refuse('instructor.decide', 'instructor_tracks', t.id, 'maker_checker', 'You cannot decide or qualify your own instructor track', v_role); end if;
  if t.status <> 'active' or t.accepted_on is not null then return kafaa_refuse('instructor.decide', 'instructor_tracks', t.id, 'invalid_state', 'This nomination has already been decided', v_role); end if;
  if coalesce(p_decision, '') not in ('accept', 'decline') or (p_decision = 'decline' and length(v_n) < 5) or length(v_n) > 600 then
    return kafaa_refuse('instructor.decide', 'instructor_tracks', t.id, 'invalid', 'Choose accept or decline; a decline needs a reason of at least 5 characters', v_role);
  end if;
  if p_decision = 'decline' then
    update kafaa_instructor_tracks set status = 'declined', decision_note = v_n, updated_at = now() where id = t.id;
    perform kafaa_ins_notify('nt-ins-' || t.id || '-declined', t.person_id, 'Your instructor nomination was declined', 'تم رفض ترشيحك لمسار المدربين', '/my/instructor', 'warn');
    l := kafaa_ledger('kafaa.instructor.nomination', format('Instructor nomination %s declined', t.id));
    a := kafaa_audit('instructor.decide', 'instructor_tracks', t.id, 'ok', format('declined: %s', v_n), case when l is null then 'skipped' else 'written' end, l, v_role);
    return kafaa_result(true, 'ok', 'Nomination declined', a, l, jsonb_build_object('id', t.id, 'status', 'declined', 'stage', t.stage, 'enrolment_id', null));
  end if;
  v_done := kafaa_ins_initial_done(t.person_id, t.route);
  v_course := case t.route when 'asip' then 'c-asip' else 'c-instr' end;
  if v_done is null and not exists (select 1 from kafaa_enrolments e where e.person_id = t.person_id and e.course_id = v_course and e.status not in ('cancelled', 'failed')) then
    v_enr := 'en-ins-' || t.id;
    if not exists (select 1 from kafaa_enrolments where id = v_enr) then
      select * into pp from kafaa_people where id = t.person_id;
      perform set_config('kafaa.seeding', 'on', true);
      insert into kafaa_enrolments (id, person_id, course_id, session_id, org_id, status, source, assigned_by, due_on, enrolled_at, progress_pct)
      values (v_enr, t.person_id, v_course, null, pp.org_id, 'assigned', 'coordinator', 'Instructor pipeline (F31)', current_date + 90, now(), 0);
      perform set_config('kafaa.seeding', coalesce(v_prev, ''), true);
    end if;
  end if;
  update kafaa_instructor_tracks set accepted_on = current_date, accepted_by = me, initial_done_on = v_done, decision_note = nullif(v_n, ''), updated_at = now() where id = t.id;
  v_stage := kafaa_ins_stage(t.id, v_done);
  update kafaa_instructor_tracks set stage = v_stage where id = t.id;
  perform kafaa_ins_notify('nt-ins-' || t.id || '-accepted', t.person_id, 'Your instructor nomination was accepted: start the initial training', 'تم قبول ترشيحك لمسار المدربين: ابدأ التدريب الأولي', '/my/instructor', 'ok');
  l := kafaa_ledger('kafaa.instructor.nomination', format('Instructor nomination %s accepted', t.id));
  a := kafaa_audit('instructor.decide', 'instructor_tracks', t.id, 'ok', format('accepted; %s', case when v_enr is not null then 'assigned ' || v_course else 'initial course already on record' end),
    case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Nomination accepted', a, l, jsonb_build_object('id', t.id, 'status', 'active', 'stage', v_stage, 'enrolment_id', v_enr));
end $$;

-- ───────────── RPC: record an observation (instructors, sat W; never on one's own track)
create or replace function kafaa_record_instructor_observation(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_tid text := case when jsonb_typeof(p->'track_id') = 'string' then p->>'track_id' end; v_role text; t kafaa_instructor_tracks; bad jsonb; g jsonb;
  v_init date; v_items jsonb; sc jsonb; ob kafaa_people; v_id text; v_stage text; v_kind text; v_res text; v_score integer; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('instructor.observe', 'instructor_observations', v_tid, 'not_signed_in', 'Sign in to use the instructor pipeline'); end if;
  v_role := kafaa_acting_role('sat', array['W']);
  if v_role is null then return kafaa_refuse('instructor.observe', 'instructor_observations', v_tid, 'forbidden', 'Only instructors and the training manager record observations'); end if;
  select * into t from kafaa_instructor_tracks where id = v_tid;
  if t.id is null then return kafaa_refuse('instructor.observe', 'instructor_observations', v_tid, 'not_found', 'Instructor track not found', v_role); end if;
  if t.person_id = me then return kafaa_refuse('instructor.observe', 'instructor_observations', t.id, 'self_observation', 'An observer cannot observe themselves', v_role); end if;
  bad := kafaa_ins_validate_obs(p, current_date);
  if bad is not null then return kafaa_refuse('instructor.observe', 'instructor_observations', t.id, bad->>'code', bad->>'message', v_role); end if;
  if (p->'session_id' is not null and jsonb_typeof(p->'session_id') <> 'null' and (jsonb_typeof(p->'session_id') <> 'string' or not exists (select 1 from kafaa_sessions where id = p->>'session_id')))
     or (p->'course_id' is not null and jsonb_typeof(p->'course_id') <> 'null' and (jsonb_typeof(p->'course_id') <> 'string' or not exists (select 1 from kafaa_courses where id = p->>'course_id'))) then
    return kafaa_refuse('instructor.observe', 'instructor_observations', t.id, 'invalid', 'Rate all eight checklist items (met, partly or not met), give an observation date that is not in the future and keep the note under 600 characters', v_role);
  end if;
  v_init := coalesce(t.initial_done_on, kafaa_ins_initial_done(t.person_id, t.route));
  g := kafaa_ins_obs_gate(t.id, p->>'kind', v_init, (p->>'observed_on')::date);
  if g is not null then return kafaa_refuse('instructor.observe', 'instructor_observations', t.id, g->>'code', g->>'message', v_role); end if;
  v_items := (select jsonb_agg(jsonb_build_object('key', e->>'key', 'rating', e->>'rating') order by o) from jsonb_array_elements(p->'items') with ordinality as u(e, o));
  sc := kafaa_ins_score(v_items);
  v_score := (sc->>'score')::integer; v_res := sc->>'result'; v_kind := p->>'kind';
  select * into ob from kafaa_people where id = me;
  v_id := 'io-' || kafaa_ins_hex();
  insert into kafaa_instructor_observations (id, track_id, person_id, observer_person_id, observer_name, observer_name_ar, kind, observed_on, items, score, result, session_id, course_id, note, created_at)
  values (v_id, t.id, t.person_id, me, coalesce(ob.display_name, ''), coalesce(nullif(ob.display_name_ar, ''), ob.display_name, ''), v_kind, (p->>'observed_on')::date, v_items, v_score, v_res,
    case when jsonb_typeof(p->'session_id') = 'string' then p->>'session_id' end, case when jsonb_typeof(p->'course_id') = 'string' then p->>'course_id' end,
    nullif(btrim(coalesce(case when jsonb_typeof(p->'note') = 'string' then p->>'note' end, ''), E' \t\n\r'), ''), now());
  v_stage := kafaa_ins_stage(t.id, v_init);
  if v_stage is distinct from t.stage or v_init is distinct from t.initial_done_on then
    update kafaa_instructor_tracks set stage = v_stage, initial_done_on = v_init, updated_at = now() where id = t.id;
  end if;
  perform kafaa_ins_notify('nt-ins-' || v_id, t.person_id,
    format('Observation recorded (%s): %s, %s%%', case v_kind when 'co_teach' then 'co-teach' else v_kind end, v_res, v_score),
    format('تم تسجيل ملاحظة (%s): %s، %s%%', case v_kind when 'co_teach' then 'التدريس المشترك' when 'solo' then 'التدريس المنفرد' else 'الحفاظ على الأهلية' end, case when v_res = 'pass' then 'ناجح' else 'غير ناجح' end, v_score),
    '/my/instructor', case when v_res = 'pass' then 'ok' else 'warn' end);
  l := kafaa_ledger('kafaa.instructor.observation', format('Instructor observation %s (%s, %s)', v_id, v_kind, v_res));
  a := kafaa_audit('instructor.observe', 'instructor_observations', v_id, 'ok', format('%s %s %s%% on %s', v_kind, v_res, v_score, t.id), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Observation recorded', a, l, jsonb_build_object('id', v_id, 'score', v_score, 'result', v_res, 'stage', v_stage));
end $$;

-- ───────────── RPC: qualify (or reinstate) an instructor: training manager, maker-checker
create or replace function kafaa_qualify_instructor(p_track text, p_note text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; t kafaa_instructor_tracks; v_n text := btrim(coalesce(p_note, ''), E' \t\n\r'); v_re boolean; v_init date; v_due date; v_word text; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('instructor.qualify', 'instructor_tracks', p_track, 'not_signed_in', 'Sign in to use the instructor pipeline'); end if;
  v_role := kafaa_acting_role('sat', array['A']);
  if v_role is null then return kafaa_refuse('instructor.qualify', 'instructor_tracks', p_track, 'forbidden', 'Only the training manager qualifies instructors'); end if;
  select * into t from kafaa_instructor_tracks where id = p_track;
  if t.id is null then return kafaa_refuse('instructor.qualify', 'instructor_tracks', p_track, 'not_found', 'Instructor track not found', v_role); end if;
  if t.person_id = me then return kafaa_refuse('instructor.qualify', 'instructor_tracks', t.id, 'maker_checker', 'You cannot decide or qualify your own instructor track', v_role); end if;
  if t.status = 'qualified' then return kafaa_refuse('instructor.qualify', 'instructor_tracks', t.id, 'invalid_state', 'This instructor is already qualified', v_role); end if;
  if t.status not in ('active', 'lapsed') then return kafaa_refuse('instructor.qualify', 'instructor_tracks', t.id, 'invalid_state', 'This instructor track is closed', v_role); end if;
  if length(v_n) > 600 then return kafaa_refuse('instructor.qualify', 'instructor_tracks', t.id, 'invalid', 'Give a reason of 5 to 600 characters', v_role); end if;
  v_re := t.status = 'lapsed';
  if v_re then
    if kafaa_ins_reinstate_obs(t.id, t.lapsed_on, null) is null then return kafaa_refuse('instructor.qualify', 'instructor_tracks', t.id, 'not_ready', 'Reinstatement needs a passed currency observation after the lapse, by another observer', v_role); end if;
    if kafaa_ins_reinstate_obs(t.id, t.lapsed_on, me) is null then return kafaa_refuse('instructor.qualify', 'instructor_tracks', t.id, 'maker_checker', 'You observed this candidate: another training manager must qualify them (maker-checker)', v_role); end if;
  else
    v_init := coalesce(t.initial_done_on, kafaa_ins_initial_done(t.person_id, t.route));
    if t.accepted_on is null or v_init is null or kafaa_ins_qual_set(t.id, null) is null then return kafaa_refuse('instructor.qualify', 'instructor_tracks', t.id, 'not_ready', 'Qualification needs two co-teach observations and one solo observation, all passed and by three different observers', v_role); end if;
    if kafaa_ins_qual_set(t.id, me) is null then return kafaa_refuse('instructor.qualify', 'instructor_tracks', t.id, 'maker_checker', 'You observed this candidate: another training manager must qualify them (maker-checker)', v_role); end if;
  end if;
  v_due := kafaa_ins_add_months(current_date, 12);
  v_word := case when v_re then 'reinstated' else 'qualified' end;
  update kafaa_instructor_tracks set status = 'qualified', stage = 'qualified', qualified_on = current_date, first_qualified_on = coalesce(t.first_qualified_on, current_date), qualified_by = me,
    currency_due = v_due, currency_status = 'current', lapsed_on = null, initial_done_on = coalesce(t.initial_done_on, kafaa_ins_initial_done(t.person_id, t.route)),
    decision_note = coalesce(nullif(v_n, ''), t.decision_note), updated_at = now() where id = t.id;
  perform kafaa_ins_set_eq(t.id, v_due, false);
  perform kafaa_ins_set_credential(t.id, 'current');
  perform kafaa_ins_notify('nt-ins-' || t.id || '-' || v_word || '-' || current_date, t.person_id, case when v_re then 'Your instructor currency is reinstated' else 'You are a qualified instructor' end,
    case when v_re then 'تمت إعادة أهليتك كمدرب' else 'أصبحت مدرباً مؤهلاً' end, '/my/instructor', 'ok');
  l := kafaa_ledger(case when v_re then 'kafaa.instructor.reinstate' else 'kafaa.instructor.qualify' end, format('Instructor %s %s (maker-checker)', t.id, v_word));
  a := kafaa_audit('instructor.qualify', 'instructor_tracks', t.id, 'ok', format('%s; currency due %s; %s standards', v_word, v_due, cardinality(t.standard_ids)), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when v_re then 'Instructor reinstated' else 'Instructor qualified' end, a, l,
    jsonb_build_object('id', t.id, 'qualified_on', current_date, 'currency_due', v_due, 'standards', cardinality(t.standard_ids), 'reinstated', v_re));
end $$;

-- ───────────── RPC: annual currency sweep (training manager)
create or replace function kafaa_instructor_currency_sweep() returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; t kafaa_instructor_tracks; cv jsonb; n_c integer := 0; n_r integer := 0; n_l integer := 0; n_n integer := 0; v_due date; v_lap date; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('instructor.currency_sweep', 'instructor_tracks', null, 'not_signed_in', 'Sign in to use the instructor pipeline'); end if;
  v_role := kafaa_acting_role('sat', array['A']);
  if v_role is null then return kafaa_refuse('instructor.currency_sweep', 'instructor_tracks', null, 'forbidden', 'Only the training manager runs the currency sweep'); end if;
  for t in select * from kafaa_instructor_tracks where status = 'qualified' order by id collate "C" loop
    n_c := n_c + 1;
    cv := kafaa_ins_currency(t.id, current_date);
    if cv is null then continue; end if;
    v_due := (cv->>'due')::date;
    if cv->>'status' = 'lapsed' then
      v_lap := (cv->>'lapsed_on')::date;
      update kafaa_instructor_tracks set status = 'lapsed', lapsed_on = v_lap, currency_due = v_due, currency_status = 'lapsed', updated_at = now() where id = t.id;
      perform kafaa_ins_set_eq(t.id, v_lap, true);
      perform kafaa_ins_set_credential(t.id, 'lapsed');
      perform kafaa_ins_notify('nt-ins-' || t.id || '-lapsed-' || v_lap, t.person_id, format('Your instructor currency lapsed on %s', v_lap), format('انتهت أهليتك كمدرب في %s', v_lap), '/my/instructor', 'bad');
      n_l := n_l + 1;
      continue;
    end if;
    if v_due is distinct from t.currency_due then
      update kafaa_instructor_tracks set currency_due = v_due, updated_at = now() where id = t.id;
      perform kafaa_ins_set_eq(t.id, v_due, false);
      n_r := n_r + 1;
    end if;
    if cv->>'status' is distinct from t.currency_status then update kafaa_instructor_tracks set currency_status = cv->>'status', updated_at = now() where id = t.id; end if;
    if jsonb_typeof(cv->'notice') = 'number' and kafaa_ins_notify('nt-ins-' || t.id || '-' || v_due || '-' || (cv->>'notice'), t.person_id,
         format('Instructor currency due in %s days: %s of 40 delivery hours, %s of 8 development hours', cv->>'days', cv->>'hours', cv->>'cpd'),
         format('تستحق أهليتك كمدرب خلال %s يوماً: %s من 40 ساعة تدريس و%s من 8 ساعات تطوير', cv->>'days', cv->>'hours', cv->>'cpd'), '/my/instructor', case when cv->>'notice' = '30' then 'warn' else 'info' end) then
      n_n := n_n + 1;
    end if;
  end loop;
  if n_l + n_r > 0 then l := kafaa_ledger('kafaa.instructor.currency_sweep', format('Instructor currency sweep: %s lapsed, %s renewed', n_l, n_r)); end if;
  a := kafaa_audit('instructor.currency_sweep', 'instructor_tracks', null, 'ok', format('checked %s; renewed %s; lapsed %s; notices %s', n_c, n_r, n_l, n_n),
    case when n_l + n_r = 0 then 'not_applicable' when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Currency sweep complete', a, l, jsonb_build_object('checked', n_c, 'renewed', n_r, 'lapsed', n_l, 'notices', n_n));
end $$;

-- ───────────── RPC: log hours (own continuing development; anyone's hours for the training manager)
create or replace function kafaa_log_teaching_hours(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_pid text := case when jsonb_typeof(p->'person_id') = 'string' then p->>'person_id' end; v_role text; v_src text := 'mirror'; bad jsonb; t kafaa_instructor_tracks; v_id text; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('instructor.hours', 'teaching_hours', v_pid, 'not_signed_in', 'Sign in to use the instructor pipeline'); end if;
  if v_pid = me and jsonb_typeof(p->'kind') = 'string' and p->>'kind' = 'cpd' then v_role := kafaa_acting_role('own_profile', array['Own']); v_src := 'self';
  else v_role := kafaa_acting_role('sat', array['A']); end if;
  if v_role is null then return kafaa_refuse('instructor.hours', 'teaching_hours', v_pid, 'forbidden', 'You can log your own continuing development; the training manager logs delivery hours for anyone on the track'); end if;
  bad := kafaa_ins_validate_hours(p, current_date);
  if bad is not null then return kafaa_refuse('instructor.hours', 'teaching_hours', v_pid, bad->>'code', bad->>'message', v_role); end if;
  if p->'course_id' is not null and jsonb_typeof(p->'course_id') <> 'null' and (jsonb_typeof(p->'course_id') <> 'string' or not exists (select 1 from kafaa_courses where id = p->>'course_id')) then
    return kafaa_refuse('instructor.hours', 'teaching_hours', v_pid, 'invalid', 'Give 0.5 to 12 hours in half-hour steps, a date in the last 12 months that is not in the future and a note under 600 characters', v_role);
  end if;
  t := kafaa_ins_open(v_pid);
  if t.id is null then return kafaa_refuse('instructor.hours', 'teaching_hours', v_pid, 'not_found', 'This person has no qualified or open instructor track', v_role); end if;
  v_id := 'th-' || kafaa_ins_hex();
  insert into kafaa_teaching_hours (id, person_id, track_id, kind, source, session_id, course_id, delivered_on, hours, note, recorded_by, created_at)
  values (v_id, v_pid, t.id, p->>'kind', v_src, null, case when jsonb_typeof(p->'course_id') = 'string' then p->>'course_id' end, (p->>'delivered_on')::date, (p->>'hours')::numeric,
    nullif(btrim(coalesce(case when jsonb_typeof(p->'note') = 'string' then p->>'note' end, ''), E' \t\n\r'), ''), me, now());
  a := kafaa_audit('instructor.hours', 'teaching_hours', v_id, 'ok', format('%s %s h on %s', p->>'kind', p->>'hours', p->>'delivered_on'), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Hours logged', a, null, jsonb_build_object('id', v_id));
end $$;

-- ───────────── RPC: delivery hours from attended M04 sessions taught by the person
create or replace function kafaa_sync_teaching_hours(p_person text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; s kafaa_sessions; v_id text; hh numeric; n integer := 0; tot numeric := 0; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('instructor.hours_sync', 'teaching_hours', p_person, 'not_signed_in', 'Sign in to use the instructor pipeline'); end if;
  v_role := case when p_person = me then kafaa_acting_role('own_profile', array['Own']) else kafaa_acting_role('sat', array['A']) end;
  if v_role is null then return kafaa_refuse('instructor.hours_sync', 'teaching_hours', p_person, 'forbidden', 'You can sync your own teaching hours; the training manager syncs everyone'); end if;
  if p_person is not null and (kafaa_ins_open(p_person)).id is null then return kafaa_refuse('instructor.hours_sync', 'teaching_hours', p_person, 'not_found', 'This person has no qualified or open instructor track', v_role); end if;
  for s in select x.* from kafaa_sessions x
           where x.instructor_person_id is not null and (p_person is null or x.instructor_person_id = p_person) and (kafaa_ins_open(x.instructor_person_id)).id is not null
             and x.status is distinct from 'cancelled' and x.ends_at < now() and exists (select 1 from kafaa_enrolments e where e.session_id = x.id and e.attendance = 'present')
           order by x.id collate "C" loop
    v_id := 'th-ses-' || s.id;
    hh := kafaa_ins_session_hours(s.starts_at, s.ends_at);
    if exists (select 1 from kafaa_teaching_hours where id = v_id) or hh <= 0 then continue; end if;
    insert into kafaa_teaching_hours (id, person_id, track_id, kind, source, session_id, course_id, delivered_on, hours, note, recorded_by, created_at)
    values (v_id, s.instructor_person_id, (kafaa_ins_open(s.instructor_person_id)).id, 'delivery', 'session', s.id, s.course_id, (s.starts_at at time zone 'UTC')::date, hh, null, me, now());
    n := n + 1; tot := tot + hh;
  end loop;
  a := kafaa_audit('instructor.hours_sync', 'teaching_hours', p_person, 'ok', format('%s sessions, %s h', n, trim_scale(tot)), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when n > 0 then 'Teaching hours added from attended sessions' else 'No new attended sessions' end, a, null, jsonb_build_object('added', n, 'hours', trim_scale(tot)));
end $$;

-- ───────────── RPC: close a track (the person or the training manager)
create or replace function kafaa_withdraw_instructor_track(p_track text, p_note text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; t kafaa_instructor_tracks; v_n text := btrim(coalesce(p_note, ''), E' \t\n\r'); a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('instructor.withdraw', 'instructor_tracks', p_track, 'not_signed_in', 'Sign in to use the instructor pipeline'); end if;
  select * into t from kafaa_instructor_tracks where id = p_track;
  if t.id is null then return kafaa_refuse('instructor.withdraw', 'instructor_tracks', p_track, 'not_found', 'Instructor track not found'); end if;
  v_role := case when t.person_id = me then kafaa_acting_role('own_profile', array['Own']) else kafaa_acting_role('sat', array['A']) end;
  if v_role is null then return kafaa_refuse('instructor.withdraw', 'instructor_tracks', t.id, 'forbidden', 'Only the person or the training manager can close this track'); end if;
  if t.status not in ('active', 'qualified', 'lapsed') then return kafaa_refuse('instructor.withdraw', 'instructor_tracks', t.id, 'invalid_state', 'This instructor track is already closed', v_role); end if;
  if length(v_n) < 5 or length(v_n) > 600 then return kafaa_refuse('instructor.withdraw', 'instructor_tracks', t.id, 'invalid', 'Give a reason of 5 to 600 characters', v_role); end if;
  update kafaa_instructor_tracks set status = 'withdrawn', decision_note = v_n, updated_at = now() where id = t.id;
  if t.status in ('qualified', 'lapsed') then
    perform kafaa_ins_set_eq(t.id, current_date, true);
    perform kafaa_ins_set_credential(t.id, 'lapsed');
  end if;
  if t.person_id <> me then
    perform kafaa_ins_notify('nt-ins-' || t.id || '-withdrawn', t.person_id, 'Your instructor track was closed', 'تم إغلاق مسارك كمدرب', '/my/instructor', 'warn');
  end if;
  a := kafaa_audit('instructor.withdraw', 'instructor_tracks', t.id, 'ok', format('withdrawn: %s', v_n), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Instructor track closed', a, null, jsonb_build_object('id', t.id, 'status', 'withdrawn'));
end $$;

-- ───────────── Grants: internal helpers are not executable by API roles; RPCs by signed-in users only.
revoke execute on function kafaa_ins_obs_append_only(), kafaa_ins_is_date(text), kafaa_ins_add_months(date, integer), kafaa_ins_tlen(jsonb), kafaa_ins_num(numeric), kafaa_ins_refusal(text, text),
  kafaa_ins_score(jsonb), kafaa_ins_validate_obs(jsonb, date), kafaa_ins_validate_nom(jsonb), kafaa_ins_validate_hours(jsonb, date), kafaa_ins_std_skills(text[]), kafaa_ins_initial_done(text, text),
  kafaa_ins_okey(kafaa_instructor_observations), kafaa_ins_co_pair(text, text), kafaa_ins_qual_set(text, text), kafaa_ins_reinstate_obs(text, date, text), kafaa_ins_stage(text, date),
  kafaa_ins_obs_gate(text, text, date, date), kafaa_ins_sum(text, text, date, date), kafaa_ins_cv(text, date, date, numeric, numeric, integer, boolean, integer, integer, date),
  kafaa_ins_currency(text, date), kafaa_ins_session_hours(timestamptz, timestamptz), kafaa_ins_notify(text, text, text, text, text, text), kafaa_ins_set_eq(text, date, boolean),
  kafaa_ins_set_credential(text, text), kafaa_ins_open(text), kafaa_ins_hex() from public, anon, authenticated;
revoke execute on function kafaa_nominate_instructor(jsonb), kafaa_decide_instructor_nomination(text, text, text), kafaa_record_instructor_observation(jsonb), kafaa_qualify_instructor(text, text),
  kafaa_instructor_currency_sweep(), kafaa_log_teaching_hours(jsonb), kafaa_sync_teaching_hours(text), kafaa_withdraw_instructor_track(text, text) from public, anon;
grant execute on function kafaa_nominate_instructor(jsonb), kafaa_decide_instructor_nomination(text, text, text), kafaa_record_instructor_observation(jsonb), kafaa_qualify_instructor(text, text),
  kafaa_instructor_currency_sweep(), kafaa_log_teaching_hours(jsonb), kafaa_sync_teaching_hours(text), kafaa_withdraw_instructor_track(text, text) to authenticated;
