-- [W4 · E1 · F25 + F26] Kafa'a training effectiveness (Kirkpatrick levels 1 to 4) and training needs forecast (M25).
-- Tables: kafaa_eval_surveys (evaluation design per course), kafaa_eval_responses (L1, anonymous to instructors and managers),
-- kafaa_l3_observations (L3 supervisor checklist 90 days after a qualifying course), kafaa_course_kpi_links (L4 SAMPLE KPIs),
-- kafaa_redesign_flags (feeds the F27 SAT workbench), kafaa_needs_links, kafaa_demand_snapshots and kafaa_session_proposals (F26).
-- RPCs: kafaa_submit_l1, kafaa_schedule_l3, kafaa_l3_board, kafaa_record_l3, kafaa_effectiveness_report, kafaa_flag_redesign,
-- kafaa_compute_demand, kafaa_demand_report, kafaa_propose_sessions, kafaa_withdraw_proposal, kafaa_link_proposal.
-- Reads (never writes) other modules' tables: courses, enrolments, training_records, attempts (M04/M05), qual_records (M02),
-- roadmaps (F06), coach_feedback (F07), future_interest/resources (F09), klra_actions/positions (F20), sessions, simulator_slots.
-- Session proposals are drafts in this module's own table: no kafaa_sessions row is ever written here; the scheduler creates
-- sessions through the existing M04 schedule and links the draft (kafaa_link_proposal).
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file, RLS in the per-statement form.
-- Rules: src/modules/m25/{eff,needs}.ts (LocalBackend mirror: src/modules/m25/backend/local.ts).
-- PGlite checks: scripts/validate/w4e1-effectiveness.mjs (SQL = TS on the seed: every scorecard card, demand for 4 quarters, report).

-- ───────────── Tables (generated DDL)
create table if not exists kafaa_eval_surveys (
  id text primary key,
  course_id text not null unique,
  committee text not null check (committee in ('all_staff', 'operations', 'maintenance', 'rp_chem', 'engineering', 'emergency', 'leadership', 'training')),
  l1_items text[] not null default '{}'::text[],
  pre_form_id text,
  post_form_id text,
  l3_days integer not null default 90,
  l3_items jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
comment on table kafaa_eval_surveys is '[M25] Evaluation design per course: L1 form items, L2 pre/post knowledge checks, L3 checklist and timing, committee (F25)';
create table if not exists kafaa_eval_responses (
  id text primary key,
  course_id text not null,
  person_id text not null,
  completion_ref text not null unique,
  completed_on date not null,
  ratings jsonb not null default '{}'::jsonb,
  recommend boolean not null default false,
  submitted_at timestamptz not null default now(),
  open_read boolean not null default false
);
comment on table kafaa_eval_responses is '[M25] L1 reaction response (anonymous to instructors and managers; person id kept only for duplicates and L3 scheduling) (F25)';
create table if not exists kafaa_l3_observations (
  id text primary key,
  person_id text not null,
  course_id text not null,
  completion_ref text not null unique,
  completed_on date not null,
  observer_person_id text,
  due_on date not null,
  items jsonb not null default '[]'::jsonb,
  status text not null default 'scheduled' check (status in ('scheduled', 'done', 'cancelled')),
  note text,
  recorded_by text,
  recorded_at timestamptz,
  scheduled_at timestamptz not null default now(),
  open_read boolean not null default false
);
comment on table kafaa_l3_observations is '[M25] L3 behaviour observation: supervisor checklist tied to the course objectives, due 90 days after completion (F25)';
create table if not exists kafaa_course_kpi_links (
  id text primary key,
  course_id text not null,
  kpi text not null check (kpi in ('rework_rate', 'hu_event_rate', 'first_time_pass')),
  label_en text not null,
  label_ar text not null,
  unit text not null,
  direction text not null check (direction in ('lower_better', 'higher_better')),
  series jsonb not null default '[]'::jsonb,
  note_en text not null default '',
  note_ar text not null default '',
  sample boolean not null default true
);
comment on table kafaa_course_kpi_links is '[M25] L4 results: a SAMPLE plant KPI linked to a course (association, not causation) (F25)';
create table if not exists kafaa_redesign_flags (
  id text primary key,
  course_id text not null,
  reasons jsonb not null default '[]'::jsonb,
  note text not null default '',
  status text not null default 'open' check (status in ('open', 'in_sat', 'closed')),
  raised_by text not null,
  raised_by_name text not null default '',
  raised_at timestamptz not null default now(),
  sat_ref text
);
comment on table kafaa_redesign_flags is '[M25] Course flagged for redesign by the training manager, with the evidence; feeds the F27 SAT workbench (F25)';
create table if not exists kafaa_needs_links (
  id text primary key,
  kind text not null check (kind in ('requal', 'family')),
  from_id text not null,
  course_id text not null,
  note text not null default ''
);
comment on table kafaa_needs_links is '[M25] Training needs mapping: requalification course per standard, cross-training course per job family (F26)';
create table if not exists kafaa_demand_snapshots (
  id text primary key,
  period text not null,
  course_id text not null,
  source text not null check (source in ('expiry', 'mandatory', 'klra', 'roadmap', 'coach', 'future')),
  count integer not null default 0,
  suppressed boolean not null default false,
  detail jsonb not null default '[]'::jsonb,
  computed_at timestamptz not null default now(),
  computed_by text,
  open_read boolean not null default false
);
comment on table kafaa_demand_snapshots is '[M25] Demand per course, quarter and source with its role drill-down (exact; served suppressed to aggregate viewers) (F26)';
create table if not exists kafaa_session_proposals (
  id text primary key,
  period text not null,
  course_id text not null,
  kind text not null check (kind in ('class', 'simulator', 'drill', 'elearning', 'clinic')),
  sessions integer not null,
  seats_each integer not null,
  dates text[] not null default '{}'::text[],
  demand integer not null default 0,
  shortfall integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'withdrawn')),
  session_id text,
  note text not null default '',
  created_by text not null,
  created_at timestamptz not null default now(),
  decided_by text,
  decided_at timestamptz
);
comment on table kafaa_session_proposals is '[M25] Draft session proposal for the scheduler (never published; sessions are created through the M04 schedule) (F26)';
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_eval_surveys_course_id_fk') then alter table kafaa_eval_surveys add constraint kafaa_eval_surveys_course_id_fk foreign key (course_id) references kafaa_courses(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_eval_surveys_pre_form_id_fk') then alter table kafaa_eval_surveys add constraint kafaa_eval_surveys_pre_form_id_fk foreign key (pre_form_id) references kafaa_assessment_forms(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_eval_surveys_post_form_id_fk') then alter table kafaa_eval_surveys add constraint kafaa_eval_surveys_post_form_id_fk foreign key (post_form_id) references kafaa_assessment_forms(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_eval_responses_course_id_fk') then alter table kafaa_eval_responses add constraint kafaa_eval_responses_course_id_fk foreign key (course_id) references kafaa_courses(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_eval_responses_person_id_fk') then alter table kafaa_eval_responses add constraint kafaa_eval_responses_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_l3_observations_person_id_fk') then alter table kafaa_l3_observations add constraint kafaa_l3_observations_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_l3_observations_course_id_fk') then alter table kafaa_l3_observations add constraint kafaa_l3_observations_course_id_fk foreign key (course_id) references kafaa_courses(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_l3_observations_observer_person_id_fk') then alter table kafaa_l3_observations add constraint kafaa_l3_observations_observer_person_id_fk foreign key (observer_person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_course_kpi_links_course_id_fk') then alter table kafaa_course_kpi_links add constraint kafaa_course_kpi_links_course_id_fk foreign key (course_id) references kafaa_courses(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_redesign_flags_course_id_fk') then alter table kafaa_redesign_flags add constraint kafaa_redesign_flags_course_id_fk foreign key (course_id) references kafaa_courses(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_needs_links_course_id_fk') then alter table kafaa_needs_links add constraint kafaa_needs_links_course_id_fk foreign key (course_id) references kafaa_courses(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_demand_snapshots_course_id_fk') then alter table kafaa_demand_snapshots add constraint kafaa_demand_snapshots_course_id_fk foreign key (course_id) references kafaa_courses(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_session_proposals_course_id_fk') then alter table kafaa_session_proposals add constraint kafaa_session_proposals_course_id_fk foreign key (course_id) references kafaa_courses(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_session_proposals_session_id_fk') then alter table kafaa_session_proposals add constraint kafaa_session_proposals_session_id_fk foreign key (session_id) references kafaa_sessions(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_eval_surveys_committee_idx on kafaa_eval_surveys (committee);
create index if not exists kafaa_eval_surveys_pre_form_id_idx on kafaa_eval_surveys (pre_form_id);
create index if not exists kafaa_eval_surveys_post_form_id_idx on kafaa_eval_surveys (post_form_id);
create index if not exists kafaa_eval_responses_course_id_idx on kafaa_eval_responses (course_id);
create index if not exists kafaa_eval_responses_person_id_idx on kafaa_eval_responses (person_id);
create index if not exists kafaa_l3_observations_person_id_idx on kafaa_l3_observations (person_id);
create index if not exists kafaa_l3_observations_course_id_idx on kafaa_l3_observations (course_id);
create index if not exists kafaa_l3_observations_observer_person_id_idx on kafaa_l3_observations (observer_person_id);
create index if not exists kafaa_l3_observations_due_on_idx on kafaa_l3_observations (due_on);
create index if not exists kafaa_l3_observations_status_idx on kafaa_l3_observations (status);
create index if not exists kafaa_course_kpi_links_course_id_idx on kafaa_course_kpi_links (course_id);
create index if not exists kafaa_redesign_flags_course_id_idx on kafaa_redesign_flags (course_id);
create index if not exists kafaa_redesign_flags_status_idx on kafaa_redesign_flags (status);
create index if not exists kafaa_needs_links_from_id_idx on kafaa_needs_links (from_id);
create index if not exists kafaa_needs_links_course_id_idx on kafaa_needs_links (course_id);
create index if not exists kafaa_demand_snapshots_period_idx on kafaa_demand_snapshots (period);
create index if not exists kafaa_demand_snapshots_course_id_idx on kafaa_demand_snapshots (course_id);
create index if not exists kafaa_session_proposals_period_idx on kafaa_session_proposals (period);
create index if not exists kafaa_session_proposals_course_id_idx on kafaa_session_proposals (course_id);
create index if not exists kafaa_session_proposals_status_idx on kafaa_session_proposals (status);
create index if not exists kafaa_session_proposals_session_id_idx on kafaa_session_proposals (session_id);

-- ───────────── RLS (per-statement form: caller-only helpers wrapped in SELECT). Person-level rows carry open_read = false, so
-- R/W/A holders never read them directly; only the respondent / person observed / observer of record (Own). Aggregates and
-- boards come from the SECURITY DEFINER RPCs below.
alter table kafaa_eval_surveys enable row level security;
alter table kafaa_eval_responses enable row level security;
alter table kafaa_l3_observations enable row level security;
alter table kafaa_course_kpi_links enable row level security;
alter table kafaa_redesign_flags enable row level security;
alter table kafaa_needs_links enable row level security;
alter table kafaa_demand_snapshots enable row level security;
alter table kafaa_session_proposals enable row level security;
do $$ declare t text; begin
  foreach t in array array['kafaa_eval_surveys', 'kafaa_eval_responses', 'kafaa_l3_observations', 'kafaa_course_kpi_links', 'kafaa_redesign_flags',
                           'kafaa_needs_links', 'kafaa_demand_snapshots', 'kafaa_session_proposals'] loop
    if not exists (select 1 from pg_policies where tablename = t and policyname = 'kafaa_read') then
      execute format('create policy kafaa_read on %I for select to anon, authenticated using (false)', t);
    end if;
  end loop;
end $$;
alter policy kafaa_read on kafaa_eval_surveys using (((SELECT kafaa_has_grant('learning_analytics'::text, ARRAY['Agg'::text, 'R'::text, 'W'::text, 'A'::text]))) OR ((SELECT kafaa_has_grant('internal_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))));
alter policy kafaa_read on kafaa_eval_responses using (((COALESCE(open_read, false) AND (SELECT kafaa_has_grant('learning_analytics'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('learning_analytics'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('learning_analytics'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('learning_analytics'::text, person_id, NULL::text, false))));
alter policy kafaa_read on kafaa_l3_observations using (((COALESCE(open_read, false) AND (SELECT kafaa_has_grant('learning_analytics'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('learning_analytics'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('learning_analytics'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('learning_analytics'::text, person_id, NULL::text, false)) OR ((observer_person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('learning_analytics'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('learning_analytics'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('learning_analytics'::text, observer_person_id, NULL::text, false))));
alter policy kafaa_read on kafaa_course_kpi_links using ((SELECT kafaa_has_grant('learning_analytics'::text, ARRAY['Agg'::text, 'R'::text, 'W'::text, 'A'::text])));
alter policy kafaa_read on kafaa_redesign_flags using (((SELECT kafaa_has_grant('learning_analytics'::text, ARRAY['Agg'::text, 'R'::text, 'W'::text, 'A'::text]))) OR ((SELECT kafaa_has_grant('sat'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))));
alter policy kafaa_read on kafaa_needs_links using (((SELECT kafaa_has_grant('learning_analytics'::text, ARRAY['Agg'::text, 'R'::text, 'W'::text, 'A'::text]))) OR ((SELECT kafaa_has_grant('internal_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))));
alter policy kafaa_read on kafaa_demand_snapshots using ((COALESCE(open_read, false) AND (SELECT kafaa_has_grant('learning_analytics'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))));
alter policy kafaa_read on kafaa_session_proposals using ((SELECT kafaa_has_grant('training'::text, ARRAY['R'::text, 'W'::text, 'A'::text])));
grant select on kafaa_eval_surveys, kafaa_eval_responses, kafaa_l3_observations, kafaa_course_kpi_links, kafaa_redesign_flags, kafaa_needs_links, kafaa_demand_snapshots,
  kafaa_session_proposals to anon, authenticated;
revoke insert, update on kafaa_eval_surveys, kafaa_eval_responses, kafaa_l3_observations, kafaa_course_kpi_links, kafaa_redesign_flags, kafaa_needs_links,
  kafaa_demand_snapshots, kafaa_session_proposals from anon, authenticated;

-- ───────────── F25 internal helpers (mirror of src/modules/m25/eff.ts)
-- a / b rounded half away from zero (TS rdiv)
create or replace function kafaa_ev_rdiv(a numeric, b numeric) returns integer language sql immutable set search_path = public as $$
  select (sign(a) * round(abs(a) / b))::integer
$$;
create or replace function kafaa_ev_cell(n integer) returns integer language sql immutable set search_path = public as $$
  select case when n >= 10 then n else null end
$$;
create or replace function kafaa_ev_reason(p_code text, p_vars jsonb default null) returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object('code', p_code, 'key', 'm25.reasons.' || p_code) || case when p_vars is null then '{}'::jsonb else jsonb_build_object('vars', p_vars) end
$$;
-- completionsOf: transcript rows (passed/completed) and completed enrolments
create or replace function kafaa_ev_comps() returns table(ref text, person_id text, course_id text, completed_on date) language sql stable security definer set search_path = public as $$
  select 'tr:' || t.id, t.person_id, t.course_id, t.completed_on from kafaa_training_records t where t.result in ('passed', 'completed')
  union all
  select 'en:' || e.id, e.person_id, e.course_id, (e.completed_at at time zone 'UTC')::date from kafaa_enrolments e where e.status = 'completed' and e.completed_at is not null
$$;
-- kpiTrend
create or replace function kafaa_ev_trend(p_series jsonb, p_dir text) returns text language plpgsql immutable set search_path = public as $$
declare n integer := case when jsonb_typeof(p_series) = 'array' then jsonb_array_length(p_series) else 0 end; f numeric; l numeric;
begin
  if n < 2 then return 'flat'; end if;
  f := (p_series->0->>'value')::numeric; l := (p_series->(n - 1)->>'value')::numeric;
  if l = f then return 'flat'; end if;
  return case when (p_dir = 'lower_better') = (l < f) then 'improving' else 'worsening' end;
end $$;
-- l3Template: one item per course objective plus the HU item (used when the evaluation design has no checklist)
create or replace function kafaa_ev_template(p_course text) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_agg(jsonb_build_object('key', 'o' || o.n, 'competency_id', coalesce(o.v->'competency_id', 'null'::jsonb), 'en', 'On the job: ' || coalesce(o.v->>'en', ''),
                                                       'ar', 'في العمل: ' || coalesce(o.v->>'ar', '')) order by o.n)
                   from kafaa_courses c, jsonb_array_elements(case when jsonb_typeof(c.objectives) = 'array' then c.objectives else '[]'::jsonb end) with ordinality as o(v, n)
                   where c.id = p_course), '[]'::jsonb)
      || jsonb_build_array(jsonb_build_object('key', 'hu', 'competency_id', null, 'en', 'Uses human-performance tools and asks when unsure', 'ar', 'يستخدم أدوات الأداء البشري ويسأل عند الشك'))
$$;
-- Schedule one L3 observation (observer = line manager of record); returns the id or null when it exists / is not due one
create or replace function kafaa_ev_schedule_one(p_ref text, p_person text, p_course text, p_completed date) returns text language plpgsql security definer set search_path = public as $$
declare s kafaa_eval_surveys; v_tpl jsonb; v_id text := 'l3:' || p_ref;
begin
  if exists (select 1 from kafaa_l3_observations where id = v_id) then return null; end if;
  if not exists (select 1 from kafaa_courses where id = p_course and qualifying = true) then return null; end if;
  if exists (select 1 from kafaa_people where id = p_person and status = 'leaver') then return null; end if;
  select * into s from kafaa_eval_surveys where course_id = p_course;
  if not found then return null; end if;
  v_tpl := case when jsonb_typeof(s.l3_items) = 'array' and jsonb_array_length(s.l3_items) > 0 then s.l3_items else kafaa_ev_template(p_course) end;
  insert into kafaa_l3_observations (id, person_id, course_id, completion_ref, completed_on, observer_person_id, due_on, items, status, note, recorded_by, recorded_at, scheduled_at, open_read)
  values (v_id, p_person, p_course, p_ref, p_completed, kafaa_opp_line_manager(p_person), p_completed + coalesce(s.l3_days, 90),
          (select jsonb_agg(jsonb_build_object('key', i.v->>'key', 'competency_id', coalesce(i.v->'competency_id', 'null'::jsonb), 'en', i.v->>'en', 'ar', i.v->>'ar', 'rating', null) order by i.n)
             from jsonb_array_elements(v_tpl) with ordinality as i(v, n)),
          'scheduled', null, null, null, date_trunc('second', now()), false);
  return v_id;
end $$;
-- l3ToSchedule for every completion of a qualifying course (optionally one course)
create or replace function kafaa_ev_schedule(p_course text) returns integer language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0;
begin
  for r in select x.* from kafaa_ev_comps() x join kafaa_courses c on c.id = x.course_id and c.qualifying = true
           join kafaa_eval_surveys s on s.course_id = x.course_id
           where (p_course is null or x.course_id = p_course) order by x.ref collate "C" loop
    if kafaa_ev_schedule_one(r.ref, r.person_id, r.course_id, r.completed_on) is not null then n := n + 1; end if;
  end loop;
  return n;
end $$;
-- canObserve: training manager (A), or a W holder who is the observer of record or the person's line manager
create or replace function kafaa_ev_can_observe(p_obs text, p_person text) returns boolean language sql stable security definer set search_path = public as $$
  select kafaa_me() is not null and (kafaa_has_grant('learning_analytics', array['A'])
     or (kafaa_has_grant('learning_analytics', array['W']) and (p_obs = kafaa_me() or kafaa_opp_line_manager(p_person) = kafaa_me())))
$$;

-- courseCard: one course's Kirkpatrick card (every count under 10 is null)
create or replace function kafaa_ev_card(p_course text, p_now date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  c kafaa_courses; s kafaa_eval_surveys; v_comp integer; n1 integer; v_items jsonb := '{}'::jsonb; k text; v_rel integer; v_rec integer; l1 jsonb; v_sup1 boolean;
  v_pre text; v_post text; v_forms boolean; np integer; pre_sum numeric; post_sum numeric; show2 boolean; v_norm integer; v_unrel boolean; l2 jsonb; v_sup2 boolean;
  v_q boolean; v_obs integer; v_done integer; v_over integer; pts integer; rated integer; v_applied integer; v_sup3 boolean; l3 jsonb;
  kpis jsonb; reasons jsonb := '[]'::jsonb; v_redesign boolean; v_levels integer; v_flag text; kp jsonb;
begin
  select * into c from kafaa_courses where id = p_course;
  select * into s from kafaa_eval_surveys where course_id = p_course;
  select count(*) into v_comp from kafaa_ev_comps() x where x.course_id = p_course;
  -- L1
  select count(*) into n1 from kafaa_eval_responses r where r.course_id = p_course;
  foreach k in array array['relevance', 'objectives', 'delivery', 'confidence', 'time'] loop
    v_items := v_items || jsonb_build_object(k, case when n1 >= 10 then
      kafaa_ev_rdiv((select coalesce(sum(coalesce((r.ratings->>k)::numeric, 0)), 0) from kafaa_eval_responses r where r.course_id = p_course) * 10, n1) end);
  end loop;
  v_rel := (v_items->>'relevance')::integer;
  v_rec := case when n1 >= 10 then kafaa_ev_rdiv(100 * (select count(*) from kafaa_eval_responses r where r.course_id = p_course and r.recommend), n1) end;
  v_sup1 := n1 < 10;
  l1 := jsonb_build_object('n', kafaa_ev_cell(n1), 'rate', case when n1 >= 10 and v_comp > 0 then kafaa_ev_rdiv(100 * n1, v_comp) end, 'items', v_items,
                           'recommend', v_rec, 'suppressed', v_sup1);
  -- L2: latest released pre and post attempt per person, paired
  v_pre := s.pre_form_id; v_post := s.post_form_id; v_forms := v_pre is not null and v_post is not null;
  with pre as (select distinct on (a.person_id) a.person_id, a.score from kafaa_attempts a
               where a.form_id = v_pre and a.status = 'released' and a.released and a.score is not null
               order by a.person_id, a.submitted_at desc nulls last, a.id collate "C" desc),
       post as (select distinct on (a.person_id) a.person_id, a.score from kafaa_attempts a
               where a.form_id = v_post and a.status = 'released' and a.released and a.score is not null
               order by a.person_id, a.submitted_at desc nulls last, a.id collate "C" desc)
  select count(*), coalesce(sum(pre.score), 0), coalesce(sum(post.score), 0) into np, pre_sum, post_sum from pre join post on post.person_id = pre.person_id;
  show2 := np >= 10;
  v_norm := case when show2 and 100 * np - pre_sum > 0 then kafaa_ev_rdiv(100 * (post_sum - pre_sum), 100 * np - pre_sum) end;
  select exists (select 1 from kafaa_attempts a where (a.form_id = v_pre or a.form_id = v_post) and a.status in ('graded', 'submitted', 'released')
                 and not (a.status = 'released' and a.released and a.score is not null)) into v_unrel;
  v_sup2 := v_forms and not show2;
  l2 := jsonb_build_object('forms', v_forms, 'pairs', case when show2 then np end, 'pre', case when show2 then kafaa_ev_rdiv(pre_sum * 10, np) end,
                           'post', case when show2 then kafaa_ev_rdiv(post_sum * 10, np) end, 'gain', case when show2 then kafaa_ev_rdiv((post_sum - pre_sum) * 10, np) end,
                           'norm_gain', v_norm, 'unreleased_excluded', v_unrel, 'suppressed', v_sup2);
  -- L3
  v_q := coalesce(c.qualifying, false);
  select count(*), count(*) filter (where o.status = 'done'), count(*) filter (where o.status = 'scheduled' and o.due_on < p_now)
    into v_obs, v_done, v_over from kafaa_l3_observations o where o.course_id = p_course and o.status <> 'cancelled';
  select coalesce(sum(case it->>'rating' when 'yes' then 2 when 'partly' then 1 else 0 end), 0)::integer, count(*) filter (where it->>'rating' in ('yes', 'partly', 'no'))::integer
    into pts, rated from kafaa_l3_observations o, jsonb_array_elements(case when jsonb_typeof(o.items) = 'array' then o.items else '[]'::jsonb end) it
   where o.course_id = p_course and o.status = 'done';
  v_applied := case when v_done >= 10 and rated > 0 then kafaa_ev_rdiv(pts * 100, 2 * rated) end;
  v_sup3 := v_q and v_done < 10;
  l3 := jsonb_build_object('qualifying', v_q, 'scheduled', kafaa_ev_cell(v_obs), 'done', kafaa_ev_cell(v_done), 'overdue', kafaa_ev_cell(v_over), 'applied', v_applied, 'suppressed', v_sup3);
  -- L4
  select coalesce(jsonb_agg(jsonb_build_object('id', k2.id, 'kpi', k2.kpi, 'label_en', k2.label_en, 'label_ar', k2.label_ar, 'unit', k2.unit, 'direction', k2.direction,
                                               'series', coalesce(k2.series, '[]'::jsonb), 'trend', kafaa_ev_trend(coalesce(k2.series, '[]'::jsonb), k2.direction)) order by k2.id collate "C"), '[]'::jsonb)
    into kpis from kafaa_course_kpi_links k2 where k2.course_id = p_course;
  -- reasons (same order as courseCard)
  if v_sup1 then reasons := reasons || kafaa_ev_reason('l1_small', jsonb_build_object('min', 10));
  else
    if v_rel < 35 then reasons := reasons || kafaa_ev_reason('low_relevance', jsonb_build_object('v', round(v_rel / 10.0, 1), 't', 3.5)); end if;
    if v_rec < 70 then reasons := reasons || kafaa_ev_reason('low_recommend', jsonb_build_object('v', v_rec, 't', 70)); end if;
  end if;
  if not v_forms then reasons := reasons || kafaa_ev_reason('l2_none');
  elsif v_sup2 then reasons := reasons || kafaa_ev_reason('l2_small', jsonb_build_object('min', 10));
  elsif v_norm is not null and v_norm < 30 then reasons := reasons || kafaa_ev_reason('low_gain', jsonb_build_object('v', v_norm, 't', 30));
  end if;
  if v_unrel then reasons := reasons || kafaa_ev_reason('l2_unreleased'); end if;
  if v_q then
    if v_sup3 then reasons := reasons || kafaa_ev_reason('l3_small', jsonb_build_object('min', 10));
    elsif v_applied is not null and v_applied < 70 then reasons := reasons || kafaa_ev_reason('low_transfer', jsonb_build_object('v', v_applied, 't', 70));
    end if;
    if kafaa_ev_cell(v_over) is not null then reasons := reasons || kafaa_ev_reason('l3_overdue', jsonb_build_object('n', v_over)); end if;
  end if;
  for kp in select e from jsonb_array_elements(kpis) e loop
    if kp->>'trend' = 'worsening' then reasons := reasons || kafaa_ev_reason('kpi_worse', jsonb_build_object('kpi', jsonb_build_object('en', kp->>'label_en', 'ar', kp->>'label_ar'))); end if;
  end loop;
  select exists (select 1 from jsonb_array_elements(reasons) r where r->>'code' in ('low_relevance', 'low_recommend', 'low_gain', 'low_transfer')) into v_redesign;
  v_levels := (case when v_sup1 then 0 else 1 end) + (case when show2 then 1 else 0 end) + (case when v_done >= 10 then 1 else 0 end) + (case when jsonb_array_length(kpis) > 0 then 1 else 0 end);
  if not v_redesign and v_levels > 0 and not v_sup1 then reasons := reasons || kafaa_ev_reason('on_track'); end if;
  select f.id into v_flag from kafaa_redesign_flags f where f.course_id = p_course and f.status = 'open' order by f.id collate "C" limit 1;
  return jsonb_build_object('course_id', p_course, 'committee', coalesce(s.committee, 'all_staff'), 'completions', kafaa_ev_cell(v_comp), 'l1', l1, 'l2', l2, 'l3', l3,
    'l4', jsonb_build_object('sample', true, 'caveat', true, 'kpis', kpis), 'levels', v_levels, 'redesign', v_redesign, 'open_flag', v_flag, 'reasons', reasons);
end $$;
-- scorecard: every active evaluation design (optionally one course), sorted by course id
create or replace function kafaa_ev_scorecard(p_now date, p_course text) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(kafaa_ev_card(s.course_id, p_now) order by s.course_id collate "C"), '[]'::jsonb)
  from kafaa_eval_surveys s where s.active is not false and (p_course is null or s.course_id = p_course)
$$;

-- ───────────── F25 RPCs
-- L1: the learner's own reaction form (once per completion, within 90 days); schedules the L3 observation of a qualifying course
create or replace function kafaa_submit_l1(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; v_ref text := coalesce(p->>'completion_ref', ''); cmp record; k text; v_ok boolean := true; v_l3 text; au kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('eval.l1_submit', 'eval_responses', null, 'not_signed_in', 'Sign in first'); end if;
  v_role := kafaa_acting_role('learning_analytics', array['Own']);
  if v_role is null then return kafaa_refuse('eval.l1_submit', 'eval_responses', null, 'forbidden', 'Only the learner can give feedback on their own course'); end if;
  select * into cmp from kafaa_ev_comps() x where x.ref = v_ref;
  if not found or cmp.person_id <> me then return kafaa_refuse('eval.l1_submit', 'eval_responses', null, 'not_found', 'No completed course found for this feedback', v_role); end if;
  if not exists (select 1 from kafaa_eval_surveys s where s.course_id = cmp.course_id and s.active is not false) then
    return kafaa_refuse('eval.l1_submit', 'eval_responses', cmp.course_id, 'no_survey', 'This course has no evaluation form', v_role); end if;
  if not (cmp.completed_on <= current_date and cmp.completed_on >= current_date - 90) then
    return kafaa_refuse('eval.l1_submit', 'eval_responses', cmp.course_id, 'window_closed', 'Feedback closes 90 days after completion', v_role); end if;
  if exists (select 1 from kafaa_eval_responses where id = 'l1:' || v_ref) then
    return kafaa_refuse('eval.l1_submit', 'eval_responses', cmp.course_id, 'duplicate', 'You have already given feedback on this course completion', v_role); end if;
  foreach k in array array['relevance', 'objectives', 'delivery', 'confidence', 'time'] loop
    if coalesce(jsonb_typeof(p->'ratings'->k), '') <> 'number' or (p->'ratings'->>k)::numeric <> trunc((p->'ratings'->>k)::numeric)
       or (p->'ratings'->>k)::numeric < 1 or (p->'ratings'->>k)::numeric > 5 then v_ok := false; end if;
  end loop;
  if not v_ok or coalesce(jsonb_typeof(p->'recommend'), '') <> 'boolean' then
    return kafaa_refuse('eval.l1_submit', 'eval_responses', cmp.course_id, 'invalid', 'Rate every question from 1 to 5', v_role); end if;
  insert into kafaa_eval_responses (id, course_id, person_id, completion_ref, completed_on, ratings, recommend, submitted_at, open_read)
  values ('l1:' || v_ref, cmp.course_id, me, v_ref, cmp.completed_on,
          jsonb_build_object('relevance', (p->'ratings'->>'relevance')::integer, 'objectives', (p->'ratings'->>'objectives')::integer, 'delivery', (p->'ratings'->>'delivery')::integer,
                             'confidence', (p->'ratings'->>'confidence')::integer, 'time', (p->'ratings'->>'time')::integer),
          (p->>'recommend')::boolean, date_trunc('second', now()), false);
  v_l3 := kafaa_ev_schedule_one(v_ref, me, cmp.course_id, cmp.completed_on);
  au := kafaa_audit('eval.l1_submit', 'eval_responses', cmp.course_id, 'ok', 'L1 reaction recorded', 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Thank you. Your feedback is anonymous to instructors and managers.', au, null, jsonb_build_object('id', 'l1:' || v_ref, 'l3_id', v_l3));
end $$;

-- L3: schedule observations for qualifying completions (training manager)
create or replace function kafaa_schedule_l3(p_course text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; n integer; au kafaa_audit_events;
begin
  p_course := nullif(p_course, '');
  if me is null then return kafaa_refuse('eval.l3_schedule', 'l3_observations', p_course, 'not_signed_in', 'Sign in first'); end if;
  v_role := kafaa_acting_role('learning_analytics', array['A']);
  if v_role is null then return kafaa_refuse('eval.l3_schedule', 'l3_observations', p_course, 'forbidden', 'Only the training manager can do this'); end if;
  if p_course is not null and not exists (select 1 from kafaa_courses where id = p_course) then
    return kafaa_refuse('eval.l3_schedule', 'l3_observations', p_course, 'not_found', 'Course not found', v_role); end if;
  n := kafaa_ev_schedule(p_course);
  au := kafaa_audit('eval.l3_schedule', 'l3_observations', coalesce(p_course, 'all'), 'ok', n || ' scheduled', 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when n > 0 then n || ' observations scheduled' else 'Every qualifying completion already has an observation' end, au, null, jsonb_build_object('scheduled', n));
end $$;

-- L3 board: everything (training manager A, auditors R) or the caller's team (observer of record / line manager, learning_analytics W)
create or replace function kafaa_l3_board() returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_all boolean; v_rows jsonb;
begin
  if me is null then return kafaa_refuse('eval.l3_board', 'l3_observations', null, 'not_signed_in', 'Sign in first'); end if;
  v_all := kafaa_has_grant('learning_analytics', array['A', 'R']);
  if not v_all and not kafaa_has_grant('learning_analytics', array['W']) then
    return kafaa_refuse('eval.l3_board', 'l3_observations', null, 'forbidden', 'Only the observer of record, the line manager or the training manager can record this observation'); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', o.id, 'person_id', o.person_id, 'person_name', coalesce(p.display_name, ''), 'person_name_ar', coalesce(nullif(p.display_name_ar, ''), p.display_name, ''),
      'course_id', o.course_id, 'completed_on', o.completed_on, 'due_on', o.due_on, 'opens_on', o.due_on - 30, 'observer_person_id', o.observer_person_id,
      'observer_name', coalesce(ob.display_name, ''), 'observer_name_ar', coalesce(nullif(ob.display_name_ar, ''), ob.display_name, ''), 'status', o.status,
      'view', case when o.status <> 'scheduled' then o.status when o.due_on < current_date then 'overdue' when o.due_on - 30 <= current_date then 'due' else 'scheduled' end,
      'items', o.items, 'note', o.note, 'recorded_at', o.recorded_at,
      'can_record', o.status = 'scheduled' and o.due_on - 30 <= current_date and kafaa_ev_can_observe(o.observer_person_id, o.person_id))
      order by o.due_on, o.id collate "C"), '[]'::jsonb)
    into v_rows
    from kafaa_l3_observations o left join kafaa_people p on p.id = o.person_id left join kafaa_people ob on ob.id = o.observer_person_id
   where v_all or o.observer_person_id = me or kafaa_opp_line_manager(o.person_id) = me;
  return jsonb_build_object('ok', true, 'code', 'ok', 'message', 'L3 observations', 'audit_seq', null, 'ledger_seq', null,
                            'data', jsonb_build_object('mode', case when v_all then 'all' else 'mine' end, 'rows', v_rows));
end $$;

-- L3: record the checklist (observer of record, line manager or training manager; from day 60 after completion)
create or replace function kafaa_record_l3(p_id text, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); o kafaa_l3_observations; v_role text; v_note text := btrim(coalesce(p->>'note', '')); v_ok boolean; l integer; au kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('eval.l3_record', 'l3_observations', p_id, 'not_signed_in', 'Sign in first'); end if;
  select * into o from kafaa_l3_observations where id = p_id;
  if not found then return kafaa_refuse('eval.l3_record', 'l3_observations', p_id, 'not_found', 'Observation not found'); end if;
  v_role := case when kafaa_has_grant('learning_analytics', array['A']) then kafaa_acting_role('learning_analytics', array['A']) else kafaa_acting_role('learning_analytics', array['W']) end;
  if not kafaa_ev_can_observe(o.observer_person_id, o.person_id) then
    return kafaa_refuse('eval.l3_record', 'l3_observations', p_id, 'forbidden', 'Only the observer of record, the line manager or the training manager can record this observation', v_role); end if;
  if o.status <> 'scheduled' then return kafaa_refuse('eval.l3_record', 'l3_observations', p_id, 'closed', 'This observation is already recorded or cancelled', v_role); end if;
  if o.due_on - 30 > current_date then return kafaa_refuse('eval.l3_record', 'l3_observations', p_id, 'too_early', 'The observation window opens 60 days after completion', v_role); end if;
  v_ok := jsonb_typeof(p->'items') = 'array' and jsonb_typeof(o.items) = 'array' and jsonb_array_length(o.items) > 0 and length(v_note) <= 500
    and not exists (select 1 from jsonb_array_elements(o.items) t
                    where coalesce((select x->>'rating' from jsonb_array_elements(p->'items') with ordinality as q(x, n) where x->>'key' = t->>'key' order by q.n desc limit 1), '')
                          not in ('yes', 'partly', 'no', 'na'))
    and exists (select 1 from jsonb_array_elements(o.items) t
                where (select x->>'rating' from jsonb_array_elements(p->'items') with ordinality as q(x, n) where x->>'key' = t->>'key' order by q.n desc limit 1) <> 'na');
  if not coalesce(v_ok, false) then
    return kafaa_refuse('eval.l3_record', 'l3_observations', p_id, 'invalid', 'Rate every checklist item (yes, partly, no or not applicable); notes up to 500 characters', v_role); end if;
  update kafaa_l3_observations set
    items = (select jsonb_agg(t.v || jsonb_build_object('rating', (select x->>'rating' from jsonb_array_elements(p->'items') with ordinality as q(x, n) where x->>'key' = t.v->>'key' order by q.n desc limit 1)) order by t.n)
               from jsonb_array_elements(o.items) with ordinality as t(v, n)),
    status = 'done', note = nullif(v_note, ''), recorded_by = me, recorded_at = date_trunc('second', now())
  where id = p_id;
  l := kafaa_ledger('kafaa.eval.l3_record', 'L3 observation ' || o.course_id);
  au := kafaa_audit('eval.l3_record', 'l3_observations', p_id, 'ok', 'L3 observation recorded (' || o.course_id || ')', case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Observation recorded', au, l, jsonb_build_object('id', p_id));
end $$;

-- Kirkpatrick scorecard (learning_analytics Agg/R/A); every value from a group under 10 is null
create or replace function kafaa_effectiveness_report(p_course text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me();
begin
  p_course := nullif(p_course, '');
  if me is null then return kafaa_refuse('eval.report', 'eval_responses', p_course, 'not_signed_in', 'Sign in first'); end if;
  if not kafaa_has_grant('learning_analytics', array['Agg', 'R', 'A']) then
    return kafaa_refuse('eval.report', 'eval_responses', p_course, 'forbidden', 'Training effectiveness results are for training staff, managers and HR, as aggregates only'); end if;
  if p_course is not null and not exists (select 1 from kafaa_eval_surveys where course_id = p_course and active is not false) then
    return kafaa_refuse('eval.report', 'eval_responses', p_course, 'not_found', 'Course not found'); end if;
  return jsonb_build_object('ok', true, 'code', 'ok', 'message', 'Training effectiveness', 'audit_seq', null, 'ledger_seq', null,
    'data', jsonb_build_object('as_of', current_date, 'min_group', 10, 'cards', kafaa_ev_scorecard(current_date, p_course)));
end $$;

-- Flag a course for redesign (training manager); the evidence of the day is stored with the flag; feeds the F27 SAT workbench
create or replace function kafaa_flag_redesign(p_course text, p_note text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_note text := btrim(coalesce(p_note, '')); v_id text; l integer; au kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('eval.redesign_flag', 'redesign_flags', p_course, 'not_signed_in', 'Sign in first'); end if;
  v_role := kafaa_acting_role('learning_analytics', array['A']);
  if v_role is null then return kafaa_refuse('eval.redesign_flag', 'redesign_flags', p_course, 'forbidden', 'Only the training manager can do this'); end if;
  if p_course is null or not exists (select 1 from kafaa_eval_surveys where course_id = p_course) then
    return kafaa_refuse('eval.redesign_flag', 'redesign_flags', p_course, 'not_found', 'Course not found', v_role); end if;
  if length(v_note) < 10 or length(v_note) > 500 then return kafaa_refuse('eval.redesign_flag', 'redesign_flags', p_course, 'invalid', 'Explain the redesign need in 10 to 500 characters', v_role); end if;
  if exists (select 1 from kafaa_redesign_flags where course_id = p_course and status = 'open') then
    return kafaa_refuse('eval.redesign_flag', 'redesign_flags', p_course, 'duplicate', 'This course already has an open redesign flag', v_role); end if;
  v_id := 'rf-' || p_course || '-' || ((select count(*) from kafaa_redesign_flags where course_id = p_course) + 1);
  insert into kafaa_redesign_flags (id, course_id, reasons, note, status, raised_by, raised_by_name, raised_at, sat_ref)
  values (v_id, p_course, kafaa_ev_card(p_course, current_date)->'reasons', v_note, 'open', me, coalesce((select display_name from kafaa_people where id = me), ''), date_trunc('second', now()), null);
  l := kafaa_ledger('kafaa.eval.redesign_flag', 'Course ' || p_course || ' flagged for redesign');
  au := kafaa_audit('eval.redesign_flag', 'redesign_flags', v_id, 'ok', 'redesign ' || p_course, case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Flagged for redesign; the SAT workbench picks it up', au, l, jsonb_build_object('id', v_id));
end $$;

-- ───────────── F26 internal helpers (mirror of src/modules/m25/needs.ts)
create or replace function kafaa_dm_quarter(d date) returns text language sql immutable set search_path = public as $$
  select extract(year from d)::integer || '-Q' || ((extract(month from d)::integer - 1) / 3 + 1)
$$;
create or replace function kafaa_dm_qstart(p text) returns date language sql immutable set search_path = public as $$
  select make_date(split_part(p, '-Q', 1)::integer, (split_part(p, '-Q', 2)::integer - 1) * 3 + 1, 1)
$$;
create or replace function kafaa_dm_qend(p text) returns date language sql immutable set search_path = public as $$
  select (kafaa_dm_qstart(p) + interval '3 months')::date - 1
$$;
-- periodsFrom: the current quarter and the next three
create or replace function kafaa_dm_periods(p_now date) returns text[] language sql immutable set search_path = public as $$
  select array_agg(kafaa_dm_quarter((date_trunc('quarter', p_now) + make_interval(months => 3 * i))::date) order by i) from generate_series(0, 3) i
$$;
-- needsOf: every dated need (who, course, source, due, drill-down group)
create or replace function kafaa_dm_needs(p_now date) returns table(who text, course text, source text, due date, grp text) language sql stable security definer set search_path = public as $$
  with staff as (select * from kafaa_people where kind = 'staff' and status = 'active'),
  needs as (
    -- expiry
    select r.person_id as who, l.course_id as course, 'expiry'::text as source, case when r.status = 'expired' then r.expires_on else r.expires_on - 90 end as due, coalesce(p.job_role_id, 'none') as grp
      from kafaa_qual_records r join staff p on p.id = r.person_id
      join kafaa_qual_standards s on s.id = r.standard_id and not coalesce(s.security_restricted, false)
      join kafaa_needs_links l on l.kind = 'requal' and l.from_id = r.standard_id
     where r.expires_on is not null and r.status in ('qualified', 'due', 'renewed', 'expired')
    union all
    -- mandatory
    select p.id, c.id, 'mandatory',
           case when ld.last is not null then case when nullif(c.validity_months, 0) is not null then (ld.last + make_interval(months => c.validity_months))::date end
                else coalesce(op.due, case when p.hire_date is not null then p.hire_date + coalesce(r.due_within_days, 90) else p_now end) end,
           p.job_role_id
      from staff p join kafaa_curriculum_rules r on r.role_id = p.job_role_id and r.mandatory is not false join kafaa_courses c on c.id = r.course_id
      left join lateral (select max(z.d) as last from (
               select t.completed_on as d from kafaa_training_records t where t.person_id = p.id and t.course_id = c.id and t.result in ('passed', 'completed')
               union all
               select (e.completed_at at time zone 'UTC')::date from kafaa_enrolments e where e.person_id = p.id and e.course_id = c.id and e.status = 'completed' and e.completed_at is not null) z) ld on true
      left join lateral (select min(e.due_on) as due from kafaa_enrolments e where e.person_id = p.id and e.course_id = c.id
                            and e.status in ('assigned', 'requested', 'approved', 'waitlisted', 'enrolled', 'in_progress') and e.due_on is not null) op on true
     where p.job_role_id is not null
    union all
    -- klra (one need per open cross-training action; drill-down by department)
    select 'klra:' || a.id, l.course_id, 'klra', a.due_on, coalesce(q.department, 'none')
      from kafaa_klra_actions a join kafaa_klra_positions q on q.id = a.position_id and q.family_id is not null
      join kafaa_needs_links l on l.kind = 'family' and l.from_id = q.family_id
     where a.kind = 'cross_training' and a.status in ('planned', 'in_progress')
    union all
    -- roadmap course blocks that have not ended
    select r.person_id, b.v->>'course_id', 'roadmap', left(b.v->>'start', 10)::date, coalesce(p.job_role_id, 'none')
      from kafaa_roadmaps r join staff p on p.id = r.person_id,
           jsonb_array_elements(case when jsonb_typeof(r.plan) = 'array' then r.plan else '[]'::jsonb end) as b(v)
     where r.active is not false and b.v->>'kind' = 'course' and coalesce(b.v->>'course_id', '') <> '' and coalesce(b.v->>'start', '') <> ''
       and left(coalesce(b.v->>'end', b.v->>'start'), 10)::date >= p_now
    union all
    -- coach: latest signal per person and course, saved or enrolled in the last 180 days
    select f.person_id, f.item_id, 'coach', (f.at at time zone 'UTC')::date + 45, coalesce(p.job_role_id, 'none')
      from (select distinct on (x.person_id, x.item_id) x.* from kafaa_coach_feedback x join staff s on s.id = x.person_id
             where x.item_kind = 'course' order by x.person_id, x.item_id, x.at desc, x.id collate "C" desc) f
      join staff p on p.id = f.person_id
     where f.signal in ('saved', 'enrolled') and (f.at at time zone 'UTC')::date >= p_now - 180
    union all
    -- future interest: the linked course 120 days out
    select i.person_id, fr.course_id, 'future', greatest(p_now, (i.updated_at at time zone 'UTC')::date) + 120, coalesce(p.job_role_id, 'none')
      from kafaa_future_interest i join staff p on p.id = i.person_id
      join kafaa_future_resources fr on fr.kind = 'course' and fr.course_id is not null
           and ((i.target_kind = 'tech' and i.tech_id = any(fr.tech_ids)) or (i.target_kind <> 'tech' and i.lane_id = any(fr.lane_ids)))
     where i.active is not false)
  select n.who, n.course, n.source, n.due, n.grp from needs n join kafaa_courses c on c.id = n.course and c.audience not in ('supplier', 'contractor')
   where n.due is not null
$$;
-- computeDemand: one quarter, de-duplicated per person and course (higher-priority source wins), drill-down by group
create or replace function kafaa_dm_compute(p_period text, p_now date) returns jsonb language sql stable security definer set search_path = public as $$
  with n as (select * from kafaa_dm_needs(p_now) x where kafaa_dm_quarter(greatest(x.due, p_now)) = p_period),
  best as (select distinct on (n.who, n.course) n.who, n.course, n.source, n.grp from n
           order by n.who, n.course, array_position(array['expiry', 'mandatory', 'klra', 'roadmap', 'coach', 'future'], n.source)),
  g as (select course, source, grp, count(*)::integer as cnt from best group by 1, 2, 3),
  r as (select course, source, sum(cnt)::integer as total, jsonb_agg(jsonb_build_object('key', grp, 'count', cnt) order by grp collate "C") as detail from g group by 1, 2)
  select coalesce(jsonb_agg(jsonb_build_object('id', 'dm:' || p_period || ':' || r.course || ':' || r.source, 'period', p_period, 'course_id', r.course, 'source', r.source,
                                               'count', r.total, 'suppressed', r.total < 10, 'detail', r.detail)
                            order by r.course collate "C", array_position(array['expiry', 'mandatory', 'klra', 'roadmap', 'coach', 'future'], r.source)), '[]'::jsonb)
  from r
$$;
-- needsReport: demand vs capacity for one quarter (exact, or cells under 10 suppressed for aggregate viewers; totals always exact)
create or replace function kafaa_dm_report(p_period text, p_exact boolean) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  qs date := kafaa_dm_qstart(p_period); qe date := kafaa_dm_qend(p_period); v_sim integer; v_rows jsonb := '[]'::jsonb; cr record; c kafaa_courses; src text;
  v_src jsonb; v_det jsonb; v_cnt integer; v_total integer; v_sess integer; v_seats integer; v_draft integer; v_short integer; v_simc integer; v_reasons jsonb; sn kafaa_demand_snapshots;
  srcs text[] := array['expiry', 'mandatory', 'klra', 'roadmap', 'coach', 'future'];
begin
  select count(*) into v_sim from kafaa_simulator_slots s where s.status in ('free', 'tentative') and (s.starts_at at time zone 'UTC')::date between qs and qe;
  for cr in select z.cid from (select distinct d.course_id as cid from kafaa_demand_snapshots d where d.period = p_period and d.count > 0) z order by z.cid collate "C" loop
    select * into c from kafaa_courses where id = cr.cid;
    v_src := '{}'::jsonb; v_det := '{}'::jsonb; v_total := 0; v_reasons := '[]'::jsonb;
    foreach src in array srcs loop
      select * into sn from kafaa_demand_snapshots d where d.period = p_period and d.course_id = cr.cid and d.source = src and d.count > 0;
      v_cnt := case when found then sn.count else 0 end;
      v_total := v_total + v_cnt;
      v_src := v_src || jsonb_build_object(src, case when p_exact or v_cnt >= 10 then v_cnt end);
      v_det := v_det || jsonb_build_object(src, case when v_cnt > 0 then coalesce((select jsonb_agg(jsonb_build_object('key', e.v->>'key', 'count',
                  case when p_exact or (e.v->>'count')::integer >= 10 then (e.v->>'count')::integer end) order by e.n)
                  from jsonb_array_elements(case when jsonb_typeof(sn.detail) = 'array' then sn.detail else '[]'::jsonb end) with ordinality as e(v, n)), '[]'::jsonb) else '[]'::jsonb end);
      if v_cnt > 0 then
        v_reasons := v_reasons || case when p_exact or v_cnt >= 10 then kafaa_ev_reason('src_' || src, jsonb_build_object('n', v_cnt)) else kafaa_ev_reason('src_' || src || '_small', jsonb_build_object('min', 10)) end;
      end if;
    end loop;
    select count(*), coalesce(sum(s.capacity), 0) into v_sess, v_seats from kafaa_sessions s
     where s.course_id = cr.cid and s.status = 'scheduled' and (s.starts_at at time zone 'UTC')::date between qs and qe;
    select coalesce(sum(x.sessions * x.seats_each), 0) into v_draft from kafaa_session_proposals x where x.course_id = cr.cid and x.period = p_period and x.status = 'draft';
    v_short := greatest(0, v_total - v_seats);
    v_simc := case when c.modality = 'simulator' then v_sim end;
    v_reasons := v_reasons || case when v_short > 0 then kafaa_ev_reason('shortfall', jsonb_build_object('n', v_short, 'seats', v_seats)) else kafaa_ev_reason('covered', jsonb_build_object('seats', v_seats)) end;
    if v_draft > 0 then v_reasons := v_reasons || kafaa_ev_reason('draft_cover', jsonb_build_object('n', v_draft)); end if;
    if v_simc is not null and v_short > 0 and v_simc * 6 < v_short then v_reasons := v_reasons || kafaa_ev_reason('sim_short', jsonb_build_object('slots', v_simc)); end if;
    v_rows := v_rows || jsonb_build_array(jsonb_build_object('course_id', cr.cid, 'modality', coalesce(c.modality, 'classroom'), 'total', v_total, 'sources', v_src, 'detail', v_det,
      'sessions', v_sess, 'seats', v_seats, 'draft_seats', v_draft, 'shortfall', v_short, 'sim_free', v_simc, 'reasons', v_reasons));
  end loop;
  return jsonb_build_object('period', p_period, 'exact', p_exact,
    'computed_at', (select max(d.computed_at) from kafaa_demand_snapshots d where d.period = p_period),
    'total', coalesce((select sum((r->>'total')::integer) from jsonb_array_elements(v_rows) r), 0),
    'seats', coalesce((select sum((r->>'seats')::integer) from jsonb_array_elements(v_rows) r), 0),
    'shortfall', coalesce((select sum((r->>'shortfall')::integer) from jsonb_array_elements(v_rows) r), 0),
    'short_courses', (select count(*) from jsonb_array_elements(v_rows) r where (r->>'shortfall')::integer > 0), 'rows', v_rows);
end $$;
-- proposalDates: n start dates spread evenly across the quarter
create or replace function kafaa_dm_dates(p_period text, p_n integer) returns text[] language sql immutable set search_path = public as $$
  select coalesce(array_agg((kafaa_dm_qstart(p_period) + ((i + 1) * (kafaa_dm_qend(p_period) - kafaa_dm_qstart(p_period) + 1)) / (p_n + 1))::text order by i), '{}'::text[])
  from generate_series(0, p_n - 1) i
$$;
create or replace function kafaa_dm_seats(p_modality text) returns integer language sql immutable set search_path = public as $$
  select case p_modality when 'simulator' then 6 when 'elearning' then 40 when 'ojt' then 4 else 16 end
$$;

-- ───────────── F26 RPCs
-- Recompute one quarter's demand snapshot (training manager). Cells no longer present are set to 0, never removed.
create or replace function kafaa_compute_demand(p_period text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_rows jsonb; v_at timestamptz := date_trunc('second', now()); n integer; v_total integer; au kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('needs.compute', 'demand_snapshots', p_period, 'not_signed_in', 'Sign in first'); end if;
  v_role := kafaa_acting_role('learning_analytics', array['A']);
  if v_role is null then return kafaa_refuse('needs.compute', 'demand_snapshots', p_period, 'forbidden', 'Only the training manager can do this'); end if;
  if p_period is null or not (p_period = any(kafaa_dm_periods(current_date))) then
    return kafaa_refuse('needs.compute', 'demand_snapshots', p_period, 'invalid', 'Choose the current quarter or one of the next three', v_role); end if;
  v_rows := kafaa_dm_compute(p_period, current_date);
  update kafaa_demand_snapshots d set count = 0, suppressed = true, detail = '[]'::jsonb, computed_at = v_at, computed_by = me
   where d.period = p_period and not exists (select 1 from jsonb_array_elements(v_rows) r where r->>'id' = d.id);
  insert into kafaa_demand_snapshots (id, period, course_id, source, count, suppressed, detail, computed_at, computed_by, open_read)
  select r->>'id', p_period, r->>'course_id', r->>'source', (r->>'count')::integer, (r->>'suppressed')::boolean, r->'detail', v_at, me, false from jsonb_array_elements(v_rows) r
  on conflict (id) do update set count = excluded.count, suppressed = excluded.suppressed, detail = excluded.detail, computed_at = excluded.computed_at, computed_by = excluded.computed_by;
  n := jsonb_array_length(v_rows);
  select coalesce(sum((r->>'count')::integer), 0) into v_total from jsonb_array_elements(v_rows) r;
  au := kafaa_audit('needs.compute', 'demand_snapshots', p_period, 'ok', n || ' cells, ' || v_total || ' needs', 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Demand for ' || p_period || ' recomputed', au, null, jsonb_build_object('period', p_period, 'rows', n, 'total', v_total));
end $$;

-- Demand vs capacity (learning_analytics Agg/R/A; exact for R/A, suppressed cells for aggregate-only viewers)
create or replace function kafaa_demand_report(p_period text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_p text;
begin
  if me is null then return kafaa_refuse('needs.report', 'demand_snapshots', p_period, 'not_signed_in', 'Sign in first'); end if;
  if not kafaa_has_grant('learning_analytics', array['Agg', 'R', 'A']) then
    return kafaa_refuse('needs.report', 'demand_snapshots', p_period, 'forbidden', 'The training needs forecast is for training staff, managers and HR'); end if;
  v_p := coalesce(nullif(p_period, ''), kafaa_dm_quarter(current_date));
  if not (v_p = any(kafaa_dm_periods(current_date))) then return kafaa_refuse('needs.report', 'demand_snapshots', v_p, 'invalid', 'Choose the current quarter or one of the next three'); end if;
  return jsonb_build_object('ok', true, 'code', 'ok', 'message', 'Training needs', 'audit_seq', null, 'ledger_seq', null,
    'data', kafaa_dm_report(v_p, kafaa_has_grant('learning_analytics', array['R', 'A']))
            || jsonb_build_object('periods', to_jsonb(kafaa_dm_periods(current_date)), 'can_compute', kafaa_has_grant('learning_analytics', array['A']),
                                  'instructors', (select count(distinct a.person_id) from kafaa_role_assignments a where a.role = 'instructor' and a.status = 'active')));
end $$;

-- Draft sessions to close a course's shortfall (training manager). Drafts only: never a kafaa_sessions row.
create or replace function kafaa_propose_sessions(p_period text, p_course text, p_note text default '') returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; c kafaa_courses; v_row jsonb; v_each integer; v_n integer; v_id text; au kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('needs.propose', 'session_proposals', p_course, 'not_signed_in', 'Sign in first'); end if;
  v_role := kafaa_acting_role('learning_analytics', array['A']);
  if v_role is null then return kafaa_refuse('needs.propose', 'session_proposals', p_course, 'forbidden', 'Only the training manager can do this'); end if;
  if p_period is null or not (p_period = any(kafaa_dm_periods(current_date))) then
    return kafaa_refuse('needs.propose', 'session_proposals', p_course, 'invalid', 'Choose the current quarter or one of the next three', v_role); end if;
  select * into c from kafaa_courses where id = p_course;
  if not found then return kafaa_refuse('needs.propose', 'session_proposals', p_course, 'not_found', 'Course not found', v_role); end if;
  if not exists (select 1 from kafaa_demand_snapshots where period = p_period) then
    return kafaa_refuse('needs.propose', 'session_proposals', p_course, 'no_snapshot', 'Compute the demand for this quarter first', v_role); end if;
  select r into v_row from jsonb_array_elements(kafaa_dm_report(p_period, true)->'rows') r where r->>'course_id' = p_course;
  v_each := kafaa_dm_seats(c.modality);
  v_n := least(12, ceil(greatest(0, coalesce((v_row->>'shortfall')::integer, 0) - coalesce((v_row->>'draft_seats')::integer, 0))::numeric / v_each)::integer);
  if v_row is null or v_n <= 0 then return kafaa_refuse('needs.propose', 'session_proposals', p_course, 'no_shortfall', 'Demand for this course is already covered by scheduled and draft sessions', v_role); end if;
  v_id := 'sp-' || lower(p_period) || '-' || p_course || '-' || ((select count(*) from kafaa_session_proposals where course_id = p_course and period = p_period) + 1);
  insert into kafaa_session_proposals (id, period, course_id, kind, sessions, seats_each, dates, demand, shortfall, status, session_id, note, created_by, created_at, decided_by, decided_at)
  values (v_id, p_period, p_course, case c.modality when 'simulator' then 'simulator' when 'drill' then 'drill' when 'elearning' then 'elearning' when 'clinic' then 'clinic' else 'class' end,
          v_n, v_each, kafaa_dm_dates(p_period, v_n), (v_row->>'total')::integer, (v_row->>'shortfall')::integer, 'draft', null, left(btrim(coalesce(p_note, '')), 500), me,
          date_trunc('second', now()), null, null);
  au := kafaa_audit('needs.propose', 'session_proposals', v_id, 'ok', v_n || ' x ' || v_each || ' seats', 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', v_n || ' draft sessions proposed; they are not published', au, null, jsonb_build_object('id', v_id, 'sessions', v_n));
end $$;

create or replace function kafaa_withdraw_proposal(p_id text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; x kafaa_session_proposals; au kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('needs.withdraw', 'session_proposals', p_id, 'not_signed_in', 'Sign in first'); end if;
  v_role := kafaa_acting_role('learning_analytics', array['A']);
  if v_role is null then return kafaa_refuse('needs.withdraw', 'session_proposals', p_id, 'forbidden', 'Only the training manager can do this'); end if;
  select * into x from kafaa_session_proposals where id = p_id;
  if not found then return kafaa_refuse('needs.withdraw', 'session_proposals', p_id, 'not_found', 'Proposal not found', v_role); end if;
  if x.status <> 'draft' then return kafaa_refuse('needs.withdraw', 'session_proposals', p_id, 'closed', 'Only draft proposals can change', v_role); end if;
  update kafaa_session_proposals set status = 'withdrawn', decided_by = me, decided_at = date_trunc('second', now()) where id = p_id;
  au := kafaa_audit('needs.withdraw', 'session_proposals', p_id, 'ok', 'withdrawn', 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Draft withdrawn', au, null, jsonb_build_object('id', p_id));
end $$;

create or replace function kafaa_link_proposal(p_id text, p_session text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; x kafaa_session_proposals; s kafaa_sessions; au kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('needs.link', 'session_proposals', p_id, 'not_signed_in', 'Sign in first'); end if;
  v_role := kafaa_acting_role('learning_analytics', array['A']);
  if v_role is null then return kafaa_refuse('needs.link', 'session_proposals', p_id, 'forbidden', 'Only the training manager can do this'); end if;
  select * into x from kafaa_session_proposals where id = p_id;
  if not found then return kafaa_refuse('needs.link', 'session_proposals', p_id, 'not_found', 'Proposal not found', v_role); end if;
  if x.status <> 'draft' then return kafaa_refuse('needs.link', 'session_proposals', p_id, 'closed', 'Only draft proposals can change', v_role); end if;
  select * into s from kafaa_sessions where id = p_session;
  if not found or s.course_id <> x.course_id or s.status <> 'scheduled'
     or (s.starts_at at time zone 'UTC')::date < kafaa_dm_qstart(x.period) or (s.starts_at at time zone 'UTC')::date > kafaa_dm_qend(x.period) then
    return kafaa_refuse('needs.link', 'session_proposals', p_id, 'invalid', 'Pick a scheduled session of the same course in the proposal quarter', v_role); end if;
  update kafaa_session_proposals set status = 'scheduled', session_id = p_session, decided_by = me, decided_at = date_trunc('second', now()) where id = p_id;
  au := kafaa_audit('needs.link', 'session_proposals', p_id, 'ok', 'scheduled as ' || p_session, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Linked to the scheduled session', au, null, jsonb_build_object('id', p_id));
end $$;

-- ───────────── Grants: internal helpers are not callable by API roles; RPCs only by signed-in users
revoke execute on function kafaa_ev_rdiv(numeric, numeric), kafaa_ev_cell(integer), kafaa_ev_reason(text, jsonb), kafaa_ev_comps(), kafaa_ev_trend(jsonb, text), kafaa_ev_template(text),
  kafaa_ev_schedule_one(text, text, text, date), kafaa_ev_schedule(text), kafaa_ev_can_observe(text, text), kafaa_ev_card(text, date), kafaa_ev_scorecard(date, text),
  kafaa_dm_quarter(date), kafaa_dm_qstart(text), kafaa_dm_qend(text), kafaa_dm_periods(date), kafaa_dm_needs(date), kafaa_dm_compute(text, date), kafaa_dm_report(text, boolean),
  kafaa_dm_dates(text, integer), kafaa_dm_seats(text) from public, anon, authenticated;
revoke execute on function kafaa_submit_l1(jsonb), kafaa_schedule_l3(text), kafaa_l3_board(), kafaa_record_l3(text, jsonb), kafaa_effectiveness_report(text), kafaa_flag_redesign(text, text),
  kafaa_compute_demand(text), kafaa_demand_report(text), kafaa_propose_sessions(text, text, text), kafaa_withdraw_proposal(text), kafaa_link_proposal(text, text) from public, anon;
grant execute on function kafaa_submit_l1(jsonb), kafaa_schedule_l3(text), kafaa_l3_board(), kafaa_record_l3(text, jsonb), kafaa_effectiveness_report(text), kafaa_flag_redesign(text, text),
  kafaa_compute_demand(text), kafaa_demand_report(text), kafaa_propose_sessions(text, text, text), kafaa_withdraw_proposal(text), kafaa_link_proposal(text, text) to authenticated;
