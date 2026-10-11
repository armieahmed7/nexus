-- [W5 · E1 · F32 + F38] Kafa'a stackable micro-credentials (M17) and the OJT practice logbook (M02).
-- F32: versioned micro-credential definitions with criteria over F01 evidence (course, assessment, opportunity, skill, manual),
--      a validity period and stacking (`stacks_into`); eligibility (kafaa_mc_eligibility), awards signed as Open Badges 3.0-shaped
--      credentials with the F04 issuer key (kafaa_badge_sign), training-manager approval for manual criteria (maker-checker),
--      renewal, revocation, public verification, a renewal sweep and suppressed statistics. Copy check: definitions never read as a
--      FANR certificate, licence or qualification (kafaa_mc_validate_def).
-- F38: OJT practice entries per qualification task (never security-restricted), preceptor acknowledgement, readiness (N supervised
--      performances + preceptor "ready"), evaluation requests handed to a qualified evaluator (who signs off through
--      kafaa_signoff_evaluation), idempotent client keys for offline sync, and one xAPI statement per entry (F30 source f38_ojt).
--      Practice never changes a qualification record or an evaluation.
-- Shared writes, only inside these SECURITY DEFINER functions: F01 skill_evidence (`credential` rows for micro-credential awards,
-- then kafaa_skills_apply), notifications (kinds microcred and ojt), F30 xapi_statements (through kafaa_xapi_emit; the F30 backfill
-- kafaa_xapi_source_rows() is redefined to include the f38_ojt source, otherwise identical to the W4 integration version).
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file, RLS in the per-statement form,
-- helpers and RPCs. LocalBackend mirrors: src/modules/m17/backend/local.w5.ts, src/modules/m02/backend/local.ojt.ts; rules:
-- src/modules/m17/microcred.ts, src/modules/m02/ojt.ts. PGlite checks: scripts/validate/w5e1-microcred-ojt.mjs.

-- ───────────── Tables (generated DDL)
-- M02 · OJT practice log entries acknowledged by a preceptor; practice, not a qualification sign-off (F38)
create table if not exists kafaa_ojt_logs (
  id text primary key,
  client_key text not null unique,
  person_id text not null,
  person_name text not null default '',
  person_name_ar text not null default '',
  task_id text not null,
  standard_id text not null,
  on_date date not null,
  mode text not null check (mode in ('walkthrough', 'simulate', 'perform')),
  preceptor_person_id text not null,
  preceptor_name text not null default '',
  preceptor_name_ar text not null default '',
  confidence integer not null default 3,
  conditions text,
  note text,
  status text not null default 'pending_ack' check (status in ('pending_ack', 'acknowledged', 'returned')),
  feedback text,
  preceptor_ready boolean not null default false,
  ack_at timestamptz,
  synced text not null default 'online' check (synced in ('online', 'offline')),
  created_at timestamptz not null default now()
);
comment on table kafaa_ojt_logs is '[M02] OJT practice log entries acknowledged by a preceptor; practice, not a qualification sign-off (F38)';
-- M02 · OJT evaluation requests: a ready task handed to a qualified evaluator (F38)
create table if not exists kafaa_ojt_eval_requests (
  id text primary key,
  person_id text not null,
  person_name text not null default '',
  person_name_ar text not null default '',
  task_id text not null,
  standard_id text not null,
  record_id text not null,
  evaluator_person_id text not null,
  evaluator_name text not null default '',
  evaluator_name_ar text not null default '',
  status text not null default 'requested' check (status in ('requested', 'completed', 'declined', 'cancelled')),
  readiness jsonb not null default '{}'::jsonb,
  note text,
  requested_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by text,
  close_note text,
  evaluation_id text,
  result text check (result in ('pass', 'fail'))
);
comment on table kafaa_ojt_eval_requests is '[M02] OJT evaluation requests: a ready task handed to a qualified evaluator (F38)';
-- M17 · Micro-credential definitions: criteria over skills evidence, validity, stacking; versioned (F32)
create table if not exists kafaa_microcred_defs (
  id text primary key,
  code text not null,
  version integer not null default 1,
  kind text not null default 'micro' check (kind in ('micro', 'stack')),
  area text not null,
  level text not null default 'foundation' check (level in ('foundation', 'practitioner', 'advanced')),
  title_en text not null,
  title_ar text not null,
  summary_en text not null default '',
  summary_ar text not null default '',
  criteria jsonb not null default '[]'::jsonb,
  stacks_into text,
  alignment jsonb not null default '[]'::jsonb,
  role_ids text[] not null default '{}'::text[],
  validity_months integer not null default 24,
  hours integer,
  status text not null default 'draft' check (status in ('draft', 'current', 'superseded', 'retired')),
  effective_date date,
  supersedes_id text,
  change_reason text,
  sort integer not null default 0,
  updated_by text,
  updated_at timestamptz not null default now(),
  published_by text,
  published_at timestamptz
);
comment on table kafaa_microcred_defs is '[M17] Micro-credential definitions: criteria over skills evidence, validity, stacking; versioned (F32)';
-- M17 · Micro-credential awards with the evidence snapshot and the signed credential (F32)
create table if not exists kafaa_microcred_awards (
  id text primary key,
  def_id text not null,
  def_code text not null,
  def_version integer not null default 1,
  person_id text not null,
  holder_initials text not null default '',
  status text not null default 'pending_approval' check (status in ('pending_approval', 'awarded', 'declined', 'revoked', 'superseded')),
  requested_at timestamptz not null default now(),
  issued_on date,
  valid_to date,
  evidence jsonb not null default '[]'::jsonb,
  component_award_ids text[] not null default '{}'::text[],
  credential jsonb not null default '{}'::jsonb,
  key_id text check (key_id in ('key-1', 'key-offline')),
  public_slug text unique,
  renewed_from text,
  decided_by text,
  decided_at timestamptz,
  decision_note text,
  revoked_at timestamptz,
  revoke_reason text,
  created_at timestamptz not null default now()
);
comment on table kafaa_microcred_awards is '[M17] Micro-credential awards with the evidence snapshot and the signed credential (F32)';
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_ojt_logs_person_id_fk') then alter table kafaa_ojt_logs add constraint kafaa_ojt_logs_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_ojt_logs_task_id_fk') then alter table kafaa_ojt_logs add constraint kafaa_ojt_logs_task_id_fk foreign key (task_id) references kafaa_task_items(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_ojt_logs_standard_id_fk') then alter table kafaa_ojt_logs add constraint kafaa_ojt_logs_standard_id_fk foreign key (standard_id) references kafaa_qual_standards(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_ojt_logs_preceptor_person_id_fk') then alter table kafaa_ojt_logs add constraint kafaa_ojt_logs_preceptor_person_id_fk foreign key (preceptor_person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_ojt_eval_requests_person_id_fk') then alter table kafaa_ojt_eval_requests add constraint kafaa_ojt_eval_requests_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_ojt_eval_requests_task_id_fk') then alter table kafaa_ojt_eval_requests add constraint kafaa_ojt_eval_requests_task_id_fk foreign key (task_id) references kafaa_task_items(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_ojt_eval_requests_standard_id_fk') then alter table kafaa_ojt_eval_requests add constraint kafaa_ojt_eval_requests_standard_id_fk foreign key (standard_id) references kafaa_qual_standards(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_ojt_eval_requests_record_id_fk') then alter table kafaa_ojt_eval_requests add constraint kafaa_ojt_eval_requests_record_id_fk foreign key (record_id) references kafaa_qual_records(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_ojt_eval_requests_evaluator_person_id_fk') then alter table kafaa_ojt_eval_requests add constraint kafaa_ojt_eval_requests_evaluator_person_id_fk foreign key (evaluator_person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_ojt_eval_requests_evaluation_id_fk') then alter table kafaa_ojt_eval_requests add constraint kafaa_ojt_eval_requests_evaluation_id_fk foreign key (evaluation_id) references kafaa_evaluations(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_microcred_awards_def_id_fk') then alter table kafaa_microcred_awards add constraint kafaa_microcred_awards_def_id_fk foreign key (def_id) references kafaa_microcred_defs(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_microcred_awards_person_id_fk') then alter table kafaa_microcred_awards add constraint kafaa_microcred_awards_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_ojt_logs_person_id_idx on kafaa_ojt_logs (person_id);
create index if not exists kafaa_ojt_logs_task_id_idx on kafaa_ojt_logs (task_id);
create index if not exists kafaa_ojt_logs_standard_id_idx on kafaa_ojt_logs (standard_id);
create index if not exists kafaa_ojt_logs_on_date_idx on kafaa_ojt_logs (on_date);
create index if not exists kafaa_ojt_logs_preceptor_person_id_idx on kafaa_ojt_logs (preceptor_person_id);
create index if not exists kafaa_ojt_logs_status_idx on kafaa_ojt_logs (status);
create index if not exists kafaa_ojt_eval_requests_person_id_idx on kafaa_ojt_eval_requests (person_id);
create index if not exists kafaa_ojt_eval_requests_task_id_idx on kafaa_ojt_eval_requests (task_id);
create index if not exists kafaa_ojt_eval_requests_standard_id_idx on kafaa_ojt_eval_requests (standard_id);
create index if not exists kafaa_ojt_eval_requests_record_id_idx on kafaa_ojt_eval_requests (record_id);
create index if not exists kafaa_ojt_eval_requests_evaluator_person_id_idx on kafaa_ojt_eval_requests (evaluator_person_id);
create index if not exists kafaa_ojt_eval_requests_status_idx on kafaa_ojt_eval_requests (status);
create index if not exists kafaa_ojt_eval_requests_evaluation_id_idx on kafaa_ojt_eval_requests (evaluation_id);
create index if not exists kafaa_microcred_defs_code_idx on kafaa_microcred_defs (code);
create index if not exists kafaa_microcred_defs_stacks_into_idx on kafaa_microcred_defs (stacks_into);
create index if not exists kafaa_microcred_defs_status_idx on kafaa_microcred_defs (status);
create index if not exists kafaa_microcred_awards_def_id_idx on kafaa_microcred_awards (def_id);
create index if not exists kafaa_microcred_awards_def_code_idx on kafaa_microcred_awards (def_code);
create index if not exists kafaa_microcred_awards_person_id_idx on kafaa_microcred_awards (person_id);
create index if not exists kafaa_microcred_awards_status_idx on kafaa_microcred_awards (status);

-- ───────────── RLS (policies created when missing, then set to the per-statement form like 20261008140000_kafaa_rls_perf.sql)
-- microcred_defs: the frameworks catalogue (frameworks R/W/A). microcred_awards: the holder, managers in scope, the training manager.
-- ojt_logs: the trainee and the preceptor named on the entry (own_profile Own), managers, instructors and evaluators in scope and
-- auditors (qual_records Scope/R). ojt_eval_requests: the trainee, the evaluator named on it, qual_records Scope/R.
alter table kafaa_microcred_defs enable row level security;
alter table kafaa_microcred_awards enable row level security;
alter table kafaa_ojt_logs enable row level security;
alter table kafaa_ojt_eval_requests enable row level security;
do $$ declare t text; begin
  foreach t in array array['kafaa_microcred_defs', 'kafaa_microcred_awards', 'kafaa_ojt_logs', 'kafaa_ojt_eval_requests'] loop
    if not exists (select 1 from pg_policies where tablename = t and policyname = 'kafaa_read') then
      execute format('create policy kafaa_read on %I for select to anon, authenticated using (false)', t);
    end if;
  end loop;
end $$;
alter policy kafaa_read on kafaa_microcred_defs using ((SELECT kafaa_has_grant('frameworks'::text, ARRAY['R'::text, 'W'::text, 'A'::text])));
alter policy kafaa_read on kafaa_microcred_awards using (((SELECT kafaa_has_grant('skills_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('skills_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('skills_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('skills_profile'::text, person_id, NULL::text, false)));
alter policy kafaa_read on kafaa_ojt_logs using (
  ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false))
  OR ((preceptor_person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, preceptor_person_id, NULL::text, false))
  OR ((SELECT kafaa_has_grant('qual_records'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('qual_records'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('qual_records'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('qual_records'::text, person_id, NULL::text, false)));
alter policy kafaa_read on kafaa_ojt_eval_requests using (
  ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false))
  OR ((evaluator_person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, evaluator_person_id, NULL::text, false))
  OR ((SELECT kafaa_has_grant('qual_records'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('qual_records'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('qual_records'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('qual_records'::text, person_id, NULL::text, false)));
grant select on kafaa_microcred_defs, kafaa_microcred_awards, kafaa_ojt_logs, kafaa_ojt_eval_requests to anon, authenticated;
-- All four tables change only through the SECURITY DEFINER RPCs below.
revoke insert, update on kafaa_microcred_defs, kafaa_microcred_awards, kafaa_ojt_logs, kafaa_ojt_eval_requests from anon, authenticated;

-- ───────────── shared helpers
create or replace function kafaa_w5_is_date(t text) returns boolean language plpgsql immutable set search_path = public as $$
begin
  if t is null or t !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
  return to_char(t::date, 'YYYY-MM-DD') = t;
exception when others then return false;
end $$;
-- Trimmed length of a JSON string (-1 when not a string), like TS `typeof v === 'string' && v.trim().length`.
create or replace function kafaa_w5_tlen(j jsonb) returns integer language sql immutable set search_path = public as $$
  select case when jsonb_typeof(j) = 'string' then length(btrim(j #>> '{}', E' \t\n\r')) else -1 end
$$;
-- A JSON integer in [lo, hi] (strings never count), like TS `typeof v === 'number' && Number.isInteger(v)`.
create or replace function kafaa_w5_int(j jsonb, lo numeric, hi numeric) returns boolean language sql immutable set search_path = public as $$
  select coalesce(jsonb_typeof(j) = 'number' and (j #>> '{}')::numeric = trunc((j #>> '{}')::numeric) and (j #>> '{}')::numeric between lo and hi, false)
$$;
create or replace function kafaa_w5_hex(n integer) returns text language sql volatile set search_path = public as $$
  select left(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), n)
$$;
-- Notification insert with the row-audit trigger quiet (transaction-local kafaa.seeding), like the other wave RPCs.
create or replace function kafaa_w5_notify(p_id text, p_person text, p_kind text, p_en text, p_ar text, p_link text, p_sev text) returns boolean language plpgsql security definer set search_path = public as $$
declare v_prev text := current_setting('kafaa.seeding', true); n integer;
begin
  if p_person is null or not exists (select 1 from kafaa_people where id = p_person) or exists (select 1 from kafaa_notifications where id = p_id) then return false; end if;
  perform set_config('kafaa.seeding', 'on', true);
  insert into kafaa_notifications (id, person_id, kind, title_en, title_ar, link, severity) values (p_id, p_person, p_kind, p_en, p_ar, p_link, p_sev) on conflict (id) do nothing;
  get diagnostics n = row_count;
  perform set_config('kafaa.seeding', coalesce(v_prev, ''), true);
  return n > 0;
end $$;

-- ═════════════ F32 micro-credentials (mirror of src/modules/m17/microcred.ts)
-- Follow renewals: a superseded award stands for the award that renewed it (at most 20 steps). TS resolveRenewal.
create or replace function kafaa_mc_resolve(p_id text) returns kafaa_microcred_awards language plpgsql stable security definer set search_path = public as $$
declare c kafaa_microcred_awards; i integer := 0; v_prev text;
begin
  select * into c from kafaa_microcred_awards where id = p_id;
  while c.id is not null and c.status = 'superseded' and i < 20 loop
    v_prev := c.id;
    c := null;
    select * into c from kafaa_microcred_awards where renewed_from = v_prev order by id collate "C" limit 1;
    i := i + 1;
  end loop;
  return c;
end $$;
-- Effective status of an award: stored states, else expired / renewal due (window or a lapsed component) / active. TS awardView.
create or replace function kafaa_mc_view(a kafaa_microcred_awards, p_today date, p_deep boolean default true) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_left integer; cid text; c kafaa_microcred_awards; s text;
begin
  if a.status <> 'awarded' then return jsonb_build_object('status', a.status, 'reason', null, 'days_left', null); end if;
  v_left := case when a.valid_to is null then null else a.valid_to - p_today end;
  if v_left is not null and v_left < 0 then return jsonb_build_object('status', 'expired', 'reason', null, 'days_left', v_left); end if;
  if p_deep then
    foreach cid in array coalesce(a.component_award_ids, '{}'::text[]) loop
      c := kafaa_mc_resolve(cid);
      s := case when c.id is null then 'revoked' else kafaa_mc_view(c, p_today, false) ->> 'status' end;
      if s not in ('active', 'renewal_due') then return jsonb_build_object('status', 'renewal_due', 'reason', 'component', 'days_left', v_left); end if;
    end loop;
  end if;
  if v_left is not null and v_left <= 60 then return jsonb_build_object('status', 'renewal_due', 'reason', 'window', 'days_left', v_left); end if;
  return jsonb_build_object('status', 'active', 'reason', null, 'days_left', v_left);
end $$;
-- The latest `awarded` row of a person for a code (issue date, then id). TS latestAward.
create or replace function kafaa_mc_latest(p_person text, p_code text) returns kafaa_microcred_awards language sql stable security definer set search_path = public as $$
  select * from kafaa_microcred_awards a where a.person_id = p_person and a.def_code = p_code and a.status = 'awarded'
  order by coalesce(a.issued_on::text, a.requested_at::text, '') collate "C" desc, a.id collate "C" desc limit 1
$$;

-- One criterion: status, met, level and the evidence it rests on. TS courseCrit / assessmentCrit / opportunityCrit / skillCrit.
create or replace function kafaa_mc_crit(c jsonb, p_person text, p_today date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare k text := c ->> 'kind'; v_ref text := coalesce(c ->> 'ref', ''); tr kafaa_training_records; v_months integer; at kafaa_attempts; ap kafaa_opportunity_applications;
  ps kafaa_person_skills; v_min integer; v_lvl integer; v_ev jsonb;
begin
  if k = 'course' then
    select * into tr from kafaa_training_records t where t.person_id = p_person and t.course_id = v_ref and t.result in ('passed', 'completed')
      order by t.completed_on desc, t.id collate "C" desc limit 1;
    if tr.id is null then return jsonb_build_object('status', 'missing', 'met', false, 'level', null, 'evidence', '[]'::jsonb); end if;
    v_ev := jsonb_build_array(jsonb_build_object('table', 'training_records', 'id', tr.id, 'date', to_char(tr.completed_on, 'YYYY-MM-DD'), 'level', null));
    select coalesce(validity_months, 0) into v_months from kafaa_courses where id = v_ref;
    if coalesce(v_months, 0) > 0 and (tr.completed_on + make_interval(months => v_months))::date < p_today then
      return jsonb_build_object('status', 'lapsed', 'met', false, 'level', null, 'evidence', v_ev);
    end if;
    return jsonb_build_object('status', 'met', 'met', true, 'level', null, 'evidence', v_ev);
  elsif k = 'assessment' then
    select * into at from kafaa_attempts t where t.person_id = p_person and t.form_id = v_ref and t.passed is true and t.released is true
      order by t.submitted_at desc nulls last, t.id collate "C" desc limit 1;
    if at.id is null then return jsonb_build_object('status', 'missing', 'met', false, 'level', null, 'evidence', '[]'::jsonb); end if;
    return jsonb_build_object('status', 'met', 'met', true, 'level', null, 'evidence', jsonb_build_array(jsonb_build_object('table', 'attempts', 'id', at.id,
      'date', case when at.submitted_at is null then null else to_char(at.submitted_at at time zone 'UTC', 'YYYY-MM-DD') end, 'level', null)));
  elsif k = 'opportunity' then
    select a.* into ap from kafaa_opportunity_applications a join kafaa_opportunities o on o.id = a.opportunity_id
      where a.person_id = p_person and a.status = 'completed' and (case when v_ref like 'kind:%' then o.kind = substr(v_ref, 6) else o.id = v_ref end)
      order by a.completed_at desc nulls last, a.id collate "C" desc limit 1;
    if ap.id is null then return jsonb_build_object('status', 'missing', 'met', false, 'level', null, 'evidence', '[]'::jsonb); end if;
    return jsonb_build_object('status', 'met', 'met', true, 'level', null, 'evidence', jsonb_build_array(jsonb_build_object('table', 'opportunity_applications', 'id', ap.id,
      'date', case when ap.completed_at is null then null else to_char(ap.completed_at at time zone 'UTC', 'YYYY-MM-DD') end, 'level', null)));
  elsif k = 'skill' then
    v_min := case when jsonb_typeof(c -> 'min_level') = 'number' and (c ->> 'min_level')::numeric <> 0 then (c ->> 'min_level')::numeric::integer else 2 end;
    select * into ps from kafaa_person_skills s where s.id = 'ps:' || p_person || ':' || v_ref and s.active is true;
    if ps.id is null then return jsonb_build_object('status', 'missing', 'met', false, 'level', 0, 'evidence', '[]'::jsonb); end if;
    v_lvl := coalesce(ps.level, 0);
    v_ev := jsonb_build_array(jsonb_build_object('table', 'person_skills', 'id', ps.id, 'date', null, 'level', v_lvl));
    if v_lvl < v_min then return jsonb_build_object('status', 'missing', 'met', false, 'level', v_lvl, 'evidence', v_ev); end if;
    if ps.basis not in ('verified', 'evidenced', 'validated') then return jsonb_build_object('status', 'claimed', 'met', false, 'level', v_lvl, 'evidence', v_ev); end if;
    return jsonb_build_object('status', 'met', 'met', true, 'level', v_lvl, 'evidence', v_ev);
  end if;
  return jsonb_build_object('status', 'manual', 'met', false, 'level', null, 'evidence', '[]'::jsonb);
end $$;

-- Eligibility of a person for a definition (TS eligibility): criteria, stack components, auto_met, manual, eligible.
create or replace function kafaa_mc_eligibility(d kafaa_microcred_defs, p_person text, p_today date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_crit jsonb; v_comps jsonb := '[]'::jsonb; cd kafaa_microcred_defs; a kafaa_microcred_awards; s text; v_auto boolean; v_manual integer; v_n integer := 0;
begin
  select coalesce(jsonb_agg(jsonb_build_object('key', c ->> 'key', 'kind', c ->> 'kind', 'ref', c ->> 'ref',
      'min_level', case when c ->> 'kind' = 'skill' then (case when jsonb_typeof(c -> 'min_level') = 'number' and (c ->> 'min_level')::numeric <> 0 then (c ->> 'min_level')::numeric::integer else 2 end) end,
      'label_en', coalesce(c ->> 'label_en', ''), 'label_ar', coalesce(c ->> 'label_ar', '')) || kafaa_mc_crit(c, p_person, p_today) order by o), '[]'::jsonb)
    into v_crit from jsonb_array_elements(coalesce(d.criteria, '[]'::jsonb)) with ordinality x(c, o);
  if d.kind = 'stack' then
    for cd in select * from kafaa_microcred_defs where status = 'current' and kind = 'micro' and stacks_into = d.code order by code collate "C" loop
      a := kafaa_mc_latest(p_person, cd.code);
      s := case when a.id is null then 'none' else kafaa_mc_view(a, p_today) ->> 'status' end;
      v_comps := v_comps || jsonb_build_array(jsonb_build_object('code', cd.code, 'def_id', cd.id, 'title_en', cd.title_en, 'title_ar', cd.title_ar, 'award_id', a.id,
        'status', s, 'met', s in ('active', 'renewal_due')));
      v_n := v_n + 1;
    end loop;
  end if;
  v_auto := not exists (select 1 from jsonb_array_elements(v_crit) e where e ->> 'kind' <> 'manual' and (e ->> 'met')::boolean is not true)
    and not exists (select 1 from jsonb_array_elements(v_comps) e where (e ->> 'met')::boolean is not true)
    and (d.kind <> 'stack' or v_n > 0);
  select count(*)::integer into v_manual from jsonb_array_elements(v_crit) e where e ->> 'kind' = 'manual';
  return jsonb_build_object('def_id', d.id, 'code', d.code, 'version', d.version, 'kind', d.kind, 'person_id', p_person, 'criteria', v_crit, 'components', v_comps,
    'auto_met', v_auto, 'manual', v_manual, 'eligible', v_auto and v_manual = 0);
end $$;

-- Skills a definition aligns to (catalogue order, never security skills, level capped at 2). TS alignedSkills.
create or replace function kafaa_mc_aligned(p_alignment jsonb)
returns table (id text, code text, name_en text, name_ar text, lvl integer, sort integer) language sql stable security definer set search_path = public as $$
  select s.id, s.code, s.name_en, s.name_ar,
    least(case when jsonb_typeof(a -> 'level') = 'number' and (a ->> 'level')::numeric <> 0 then (a ->> 'level')::numeric::integer else 1 end, 2), coalesce(s.sort, 0)
  from jsonb_array_elements(coalesce(p_alignment, '[]'::jsonb)) a
  join kafaa_skills s on s.id = a ->> 'skill_id'
  left join kafaa_competencies k on k.id = s.competency_id
  where s.area <> 'security' and coalesce(k.domain, '') <> 'security'
$$;

-- Unsigned OpenBadgeCredential for an award. Mirror of buildMicrocredCredential() in src/modules/m17/microcred.ts.
create or replace function kafaa_mc_credential(p_slug text, d kafaa_microcred_defs, p_initials text, p_issued date, p_valid date, p_comps jsonb, p_key text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_name text := d.code || ' ' || d.title_en; v_stack boolean := d.kind = 'stack'; v_parts_en text[]; v_parts_ar text[]; v_day text := to_char(p_issued, 'YYYY-MM-DD'); v jsonb;
begin
  v_parts_en := case when v_stack then array['holds every component micro-credential (' || coalesce((select string_agg(c ->> 'code', ', ' order by o) from jsonb_array_elements(p_comps) with ordinality x(c, o)), '') || ')'] else '{}'::text[] end
    || coalesce((select array_agg(c ->> 'label_en' order by o) from jsonb_array_elements(coalesce(d.criteria, '[]'::jsonb)) with ordinality x(c, o)), '{}'::text[]);
  v_parts_ar := case when v_stack then array['يحمل جميع الاعتمادات المصغّرة المكوِّنة (' || coalesce((select string_agg(c ->> 'code', '، ' order by o) from jsonb_array_elements(p_comps) with ordinality x(c, o)), '') || ')'] else '{}'::text[] end
    || coalesce((select array_agg(c ->> 'label_ar' order by o) from jsonb_array_elements(coalesce(d.criteria, '[]'::jsonb)) with ordinality x(c, o)), '{}'::text[]);
  v := jsonb_build_object(
    '@context', jsonb_build_array('https://www.w3.org/ns/credentials/v2', 'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json'),
    'id', 'urn:kafaa:badge:' || p_slug,
    'type', jsonb_build_array('VerifiableCredential', 'OpenBadgeCredential'),
    'name', v_name,
    'nameAr', d.code || ' ' || d.title_ar,
    'issuer', jsonb_build_object('id', 'urn:kafaa:issuer:demo-tenant', 'type', jsonb_build_array('Profile'), 'name', 'Kafa''a demo tenant', 'url', '/kafaa/.well-known/kafaa-issuer.json'),
    'validFrom', v_day || 'T00:00:00Z',
    'credentialSubject', jsonb_build_object(
      'type', jsonb_build_array('AchievementSubject'),
      'holderInitials', p_initials,
      'achievement', jsonb_build_object(
        'id', 'urn:kafaa:microcredential:' || d.code || ':v' || d.version,
        'type', jsonb_build_array('Achievement'),
        'achievementType', 'MicroCredential',
        'humanCode', d.code,
        'name', d.title_en,
        'nameAr', d.title_ar,
        'description', d.summary_en,
        'criteria', jsonb_build_object('narrative', (case when v_stack then 'Kafa''a stacked micro-credential' else 'Kafa''a micro-credential' end) || ' ' || v_name || ': ' || array_to_string(v_parts_en, '; ') || '.'),
        'criteriaAr', (case when v_stack then 'اعتماد مصغّر مركّب من كفاءة' else 'اعتماد مصغّر من كفاءة' end) || ' ' || d.code || ' ' || d.title_ar || ': ' || array_to_string(v_parts_ar, '؛ ') || '.',
        'alignment', coalesce((select jsonb_agg(jsonb_build_object('type', jsonb_build_array('Alignment'), 'targetType', 'ceterms:Skill', 'targetFramework', 'Kafa''a skills catalogue',
            'targetCode', al.code, 'targetName', al.name_en, 'targetUrl', 'urn:kafaa:skill:' || al.id) order by al.sort, al.id collate "C") from kafaa_mc_aligned(d.alignment) al), '[]'::jsonb))),
    'evidence', coalesce((select jsonb_agg(jsonb_build_object('id', 'urn:kafaa:badge:' || (c ->> 'slug'), 'type', jsonb_build_array('Evidence'), 'name', (c ->> 'code') || ' ' || (c ->> 'title_en'),
          'narrative', 'Component micro-credential, verifiable on its own.') order by o) from jsonb_array_elements(p_comps) with ordinality x(c, o)), '[]'::jsonb)
      || coalesce((select jsonb_agg(jsonb_build_object('id', 'urn:kafaa:evidence:' || p_slug || ':' || (c ->> 'key'), 'type', jsonb_build_array('Evidence'), 'name', c ->> 'label_en',
          'narrative', case when c ->> 'kind' = 'manual' then 'Confirmed by a Kafa''a training manager on ' || v_day || '.' else 'Met on ' || v_day || ', checked by the Kafa''a eligibility rules.' end) order by o)
        from jsonb_array_elements(coalesce(d.criteria, '[]'::jsonb)) with ordinality x(c, o)), '[]'::jsonb),
    'kafaaNotice', 'Internal Kafa''a credential; not a FANR certificate or licence.',
    'proof', jsonb_build_object('type', 'DataIntegrityProof', 'cryptosuite', 'kafaa-jcs-eddsa-2026', 'created', v_day || 'T00:00:00Z',
      'verificationMethod', 'urn:kafaa:issuer:demo-tenant#' || p_key, 'proofPurpose', 'assertionMethod'));
  if p_valid is not null then v := v || jsonb_build_object('validUntil', to_char(p_valid, 'YYYY-MM-DD') || 'T00:00:00Z'); end if;
  return v;
end $$;

-- Evidence snapshot stored on an award (manual criteria marked met by the approver). TS evidenceSnapshot.
create or replace function kafaa_mc_snapshot(e jsonb, p_approved text, p_on date) returns jsonb language sql immutable set search_path = public as $$
  select coalesce((select jsonb_agg(case when c ->> 'kind' = 'manual' and p_approved is not null
      then jsonb_build_object('key', c -> 'key', 'kind', c -> 'kind', 'ref', c -> 'ref', 'status', 'met',
        'evidence', jsonb_build_array(jsonb_build_object('table', 'microcred_awards', 'id', 'approval', 'date', to_char(p_on, 'YYYY-MM-DD'), 'level', null)))
      else jsonb_build_object('key', c -> 'key', 'kind', c -> 'kind', 'ref', c -> 'ref', 'status', c -> 'status', 'evidence', c -> 'evidence') end order by o)
    from jsonb_array_elements(coalesce(e -> 'criteria', '[]'::jsonb)) with ordinality x(c, o)), '[]'::jsonb)
  || coalesce((select jsonb_agg(jsonb_build_object('key', 'part:' || (c ->> 'code'), 'kind', 'microcred', 'ref', c ->> 'code', 'status', case when (c ->> 'met')::boolean then 'met' else 'missing' end,
      'evidence', case when c ->> 'award_id' is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('table', 'microcred_awards', 'id', c ->> 'award_id', 'date', null, 'level', null)) end) order by o)
    from jsonb_array_elements(coalesce(e -> 'components', '[]'::jsonb)) with ordinality x(c, o)), '[]'::jsonb)
$$;

-- Sign and store an award (new, or the approved request p_existing), supersede the renewed one, write F01 credential evidence,
-- recompute the person's skills and notify them. TS issue() in backend/local.w5.ts.
create or replace function kafaa_mc_issue(d kafaa_microcred_defs, p_person text, e jsonb, p_approved text, p_existing text, p_today date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare prev kafaa_microcred_awards; v_slug text := 'mc' || kafaa_w5_hex(12); v_id text := coalesce(p_existing, 'mca-' || kafaa_w5_hex(16)); v_init text; v_valid date; v_comps jsonb; v_cred jsonb;
  v_ids text[]; v_snap jsonb;
begin
  prev := kafaa_mc_latest(p_person, d.code);
  select coalesce(nullif(initials, ''), '—') into v_init from kafaa_people where id = p_person;
  v_init := coalesce(v_init, '—');
  v_valid := (p_today + make_interval(months => d.validity_months))::date;
  select coalesce(jsonb_agg(jsonb_build_object('slug', coalesce(a.public_slug, ''), 'code', c ->> 'code', 'title_en', c ->> 'title_en') order by o), '[]'::jsonb)
    into v_comps from jsonb_array_elements(coalesce(e -> 'components', '[]'::jsonb)) with ordinality x(c, o) left join kafaa_microcred_awards a on a.id = c ->> 'award_id';
  select coalesce(array_agg(c ->> 'award_id' order by o), '{}'::text[]) into v_ids from jsonb_array_elements(coalesce(e -> 'components', '[]'::jsonb)) with ordinality x(c, o) where c ->> 'award_id' is not null;
  v_cred := kafaa_badge_sign(kafaa_mc_credential(v_slug, d, v_init, p_today, v_valid, v_comps, 'key-1'));
  v_snap := kafaa_mc_snapshot(e, p_approved, p_today);
  if p_existing is not null then
    update kafaa_microcred_awards set def_id = d.id, def_code = d.code, def_version = d.version, person_id = p_person, holder_initials = v_init, status = 'awarded', issued_on = p_today,
      valid_to = v_valid, evidence = v_snap, component_award_ids = v_ids, credential = v_cred, key_id = 'key-1', public_slug = v_slug,
      renewed_from = case when prev.id is not null and prev.id <> v_id then prev.id end, decided_by = p_approved, decided_at = case when p_approved is not null then now() end
    where id = p_existing;
  else
    insert into kafaa_microcred_awards (id, def_id, def_code, def_version, person_id, holder_initials, status, requested_at, issued_on, valid_to, evidence, component_award_ids,
      credential, key_id, public_slug, renewed_from, decided_by, decided_at, created_at)
    values (v_id, d.id, d.code, d.version, p_person, v_init, 'awarded', now(), p_today, v_valid, v_snap, v_ids, v_cred, 'key-1', v_slug,
      case when prev.id is not null and prev.id <> v_id then prev.id end, p_approved, case when p_approved is not null then now() end, now());
  end if;
  if prev.id is not null and prev.id <> v_id then
    update kafaa_microcred_awards set status = 'superseded' where id = prev.id;
    update kafaa_skill_evidence set active = false where ref_table = 'microcred_awards' and ref_id = prev.id and active;
  end if;
  insert into kafaa_skill_evidence (id, person_id, skill_id, kind, ref_table, ref_id, level, basis, status, observed_on, note, recorded_by, active, created_at)
  select 'se:credential:' || v_id || ':' || al.id, p_person, al.id, 'credential', 'microcred_awards', v_id, al.lvl, 'evidenced', 'current', p_today, null, coalesce(p_approved, p_person), true, now()
  from kafaa_mc_aligned(d.alignment) al
  on conflict (id) do update set active = true;
  perform kafaa_skills_apply(p_person, p_today);
  perform kafaa_w5_notify('nt-mc-' || v_id || '-awarded', p_person, 'microcred', 'Micro-credential awarded: ' || d.code || ' ' || d.title_en, 'مُنح الاعتماد المصغّر: ' || d.code || ' ' || d.title_ar, '/my/skills/credentials', 'ok');
  return jsonb_build_object('id', v_id, 'slug', v_slug, 'renewed', coalesce(prev.id is not null and prev.id <> v_id, false));
end $$;

-- Copy check and shape validation of a definition draft. Same order and codes as validateDef (TS).
create or replace function kafaa_mc_validate_def(p jsonb) returns text language plpgsql stable security definer set search_path = public as $$
declare c jsonb; a jsonb; v_kind text; v_ref text; v_keys text[] := '{}'; v_n integer; v_txt text; f kafaa_assessment_forms;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return 'invalid'; end if;
  if jsonb_typeof(p -> 'code') is distinct from 'string' or (p ->> 'code') !~ '^MC-[A-Z0-9][A-Z0-9-]{1,30}$' then return 'invalid'; end if;
  if coalesce(p ->> 'kind', '') not in ('micro', 'stack') or coalesce(p ->> 'area', '') not in ('human_performance', 'digital', 'project', 'operations', 'leadership', 'quality', 'maintenance', 'safety')
     or coalesce(p ->> 'level', '') not in ('foundation', 'practitioner', 'advanced') then return 'invalid'; end if;
  if kafaa_w5_tlen(p -> 'title_en') not between 3 and 120 or kafaa_w5_tlen(p -> 'title_ar') not between 3 and 120
     or kafaa_w5_tlen(p -> 'summary_en') not between 10 and 600 or kafaa_w5_tlen(p -> 'summary_ar') not between 10 and 600 then return 'invalid'; end if;
  if not kafaa_w5_int(p -> 'validity_months', 6, 60) then return 'invalid'; end if;
  if p -> 'hours' is not null and jsonb_typeof(p -> 'hours') <> 'null' and not kafaa_w5_int(p -> 'hours', 1, 400) then return 'invalid'; end if;
  if jsonb_typeof(p -> 'criteria') is distinct from 'array' then return 'invalid'; end if;
  v_n := jsonb_array_length(p -> 'criteria');
  if v_n > 8 or (p ->> 'kind' = 'micro' and v_n < 1) then return 'invalid'; end if;
  for c in select x from jsonb_array_elements(p -> 'criteria') x loop
    if jsonb_typeof(c) <> 'object' or jsonb_typeof(c -> 'key') is distinct from 'string' or (c ->> 'key') !~ '^[a-z][a-z0-9_]{0,15}$' or (c ->> 'key') = any(v_keys) then return 'invalid'; end if;
    v_keys := v_keys || (c ->> 'key');
    if coalesce(c ->> 'kind', '') not in ('course', 'assessment', 'opportunity', 'skill', 'manual') or jsonb_typeof(c -> 'ref') is distinct from 'string'
       or kafaa_w5_tlen(c -> 'label_en') not between 3 and 160 or kafaa_w5_tlen(c -> 'label_ar') not between 3 and 160 then return 'invalid'; end if;
    if c ->> 'kind' = 'skill' and not kafaa_w5_int(c -> 'min_level', 1, 4) then return 'invalid'; end if;
  end loop;
  if jsonb_typeof(p -> 'alignment') is distinct from 'array' or jsonb_array_length(p -> 'alignment') > 6
     or (select count(distinct x ->> 'skill_id') from jsonb_array_elements(p -> 'alignment') x) <> jsonb_array_length(p -> 'alignment') then return 'invalid'; end if;
  for a in select x from jsonb_array_elements(p -> 'alignment') x loop
    if jsonb_typeof(a) <> 'object' or jsonb_typeof(a -> 'skill_id') is distinct from 'string' or not kafaa_w5_int(a -> 'level', 1, 2) then return 'invalid'; end if;
  end loop;
  if jsonb_typeof(p -> 'role_ids') is distinct from 'array' or jsonb_array_length(p -> 'role_ids') > 8
     or (select count(distinct x) from jsonb_array_elements(p -> 'role_ids') x) <> jsonb_array_length(p -> 'role_ids')
     or exists (select 1 from jsonb_array_elements(p -> 'role_ids') x where jsonb_typeof(x) <> 'string' or not exists (select 1 from kafaa_job_roles j where j.id = x #>> '{}')) then return 'invalid'; end if;
  if coalesce(p ->> 'stacks_into', '') <> '' then
    if p ->> 'kind' <> 'micro' or p ->> 'stacks_into' = p ->> 'code'
       or not exists (select 1 from kafaa_microcred_defs d where d.code = p ->> 'stacks_into' and d.kind = 'stack' and d.status <> 'retired') then return 'invalid'; end if;
  end if;
  -- copy check: never imply a FANR certificate, licence or qualification
  for v_txt in select unnest(array[p ->> 'title_en', p ->> 'title_ar', p ->> 'summary_en', p ->> 'summary_ar'])
               union all select x ->> 'label_en' from jsonb_array_elements(p -> 'criteria') x union all select x ->> 'label_ar' from jsonb_array_elements(p -> 'criteria') x loop
    if v_txt ~* '\y(fanr|licen[cs]e[ds]?|licensing|certified|certification|certificate of competence|qualified operator|authori[sz]ation|regulator[- ]approved)\y|الهيئة الاتحادية للرقابة النووية|رخصة|ترخيص|مرخص|شهادة الهيئة|معتمد من الهيئة' then
      return 'regulatory_wording'; end if;
  end loop;
  -- mirrors never become criteria
  for c in select x from jsonb_array_elements(p -> 'criteria') x loop
    v_ref := c ->> 'ref';
    if v_ref like 'qs-%' or v_ref like 'lic-%' or exists (select 1 from kafaa_qual_standards s where s.id = v_ref) then return 'mirror_only'; end if;
  end loop;
  for c in select x from jsonb_array_elements(p -> 'criteria') x loop
    v_kind := c ->> 'kind'; v_ref := c ->> 'ref';
    if v_kind = 'course' then
      if not exists (select 1 from kafaa_courses co where co.id = v_ref) then return 'invalid'; end if;
      if exists (select 1 from kafaa_courses co join kafaa_competencies k on k.id = any(co.competency_ids) where co.id = v_ref and k.domain = 'security') then return 'security_restricted'; end if;
    elsif v_kind = 'assessment' then
      select * into f from kafaa_assessment_forms where id = v_ref;
      if f.id is null then return 'invalid'; end if;
      if f.course_id is not null and exists (select 1 from kafaa_courses co join kafaa_competencies k on k.id = any(co.competency_ids) where co.id = f.course_id and k.domain = 'security') then return 'security_restricted'; end if;
    elsif v_kind = 'opportunity' then
      if (v_ref like 'kind:%' and substr(v_ref, 6) not in ('project', 'outage_support', 'shadowing', 'oe_review', 'knowledge_capture', 'outreach', 'research'))
         or (v_ref not like 'kind:%' and not exists (select 1 from kafaa_opportunities o where o.id = v_ref)) then return 'invalid'; end if;
    elsif v_kind = 'skill' then
      if not exists (select 1 from kafaa_skills s where s.id = v_ref) then return 'invalid'; end if;
      if exists (select 1 from kafaa_skills s left join kafaa_competencies k on k.id = s.competency_id where s.id = v_ref and (s.area = 'security' or k.domain = 'security')) then return 'security_restricted'; end if;
    elsif v_ref <> '' then return 'invalid';
    end if;
  end loop;
  for a in select x from jsonb_array_elements(p -> 'alignment') x loop
    if not exists (select 1 from kafaa_skills s where s.id = a ->> 'skill_id') then return 'invalid'; end if;
    if exists (select 1 from kafaa_skills s left join kafaa_competencies k on k.id = s.competency_id where s.id = a ->> 'skill_id' and (s.area = 'security' or k.domain = 'security')) then return 'security_restricted'; end if;
  end loop;
  return 'ok';
end $$;

-- ───────────── F32 RPCs (mirror of src/modules/m17/backend/local.w5.ts)
-- Read: eligibility for every published definition (or one code): yourself, a person in your scope, or anyone (skills_profile A).
create or replace function kafaa_microcred_eligibility(p_person text default null, p_code text default null) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); v_pid text; v_ok boolean; v_code text := nullif(p_code, ''); v_items jsonb;
begin
  if me is null then return jsonb_build_object('allowed', false, 'code', 'not_signed_in', 'items', '[]'::jsonb); end if;
  v_pid := coalesce(nullif(p_person, ''), me);
  v_ok := case when v_pid = me then kafaa_has_grant('skills_profile', array['Own', 'Scope', 'A'])
    else kafaa_has_grant('skills_profile', array['A']) or (kafaa_has_grant('skills_profile', array['Scope']) and kafaa_in_scope('skills_profile', v_pid)) end;
  if not v_ok then return jsonb_build_object('allowed', false, 'code', 'forbidden', 'items', '[]'::jsonb); end if;
  if not exists (select 1 from kafaa_people where id = v_pid) then return jsonb_build_object('allowed', false, 'code', 'not_found', 'items', '[]'::jsonb); end if;
  select coalesce(jsonb_agg(kafaa_mc_eligibility(d, v_pid, current_date) order by coalesce(d.sort, 0), d.code collate "C"), '[]'::jsonb) into v_items
    from kafaa_microcred_defs d where d.status = 'current' and (v_code is null or d.code = v_code);
  if v_code is not null and jsonb_array_length(v_items) = 0 then return jsonb_build_object('allowed', false, 'code', 'not_found', 'items', '[]'::jsonb); end if;
  return jsonb_build_object('allowed', true, 'person_id', v_pid, 'items', v_items);
end $$;

-- Earn a micro-credential (own). Manual criteria -> a request for the training manager; otherwise issued, signed and recorded.
create or replace function kafaa_award_microcred(p_code text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_code text := btrim(coalesce(p_code, '')); d kafaa_microcred_defs; prev kafaa_microcred_awards; e jsonb; r jsonb; v_id text;
  v_init text; tm text; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('microcred.award', 'microcred_awards', nullif(v_code, ''), 'not_signed_in', 'Sign in to use micro-credentials'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  if v_role is null then return kafaa_refuse('microcred.award', 'microcred_awards', nullif(v_code, ''), 'forbidden', 'Only staff can earn micro-credentials on their own passport'); end if;
  select * into d from kafaa_microcred_defs where code = v_code and status = 'current' order by id collate "C" limit 1;
  if d.id is null then return kafaa_refuse('microcred.award', 'microcred_awards', nullif(v_code, ''), 'not_found', 'Micro-credential not found or not published', v_role); end if;
  if exists (select 1 from kafaa_microcred_awards x where x.person_id = me and x.def_code = v_code and x.status = 'pending_approval') then
    return kafaa_refuse('microcred.award', 'microcred_awards', v_code, 'already_requested', 'Your request for this micro-credential is waiting for a training manager', v_role);
  end if;
  prev := kafaa_mc_latest(me, v_code);
  if prev.id is not null and kafaa_mc_view(prev, current_date) ->> 'status' = 'active' then
    return kafaa_refuse('microcred.award', 'microcred_awards', v_code, 'already_awarded', 'You already hold this micro-credential and it is not yet due for renewal', v_role);
  end if;
  e := kafaa_mc_eligibility(d, me, current_date);
  if (e ->> 'auto_met')::boolean is not true then return kafaa_refuse('microcred.award', 'microcred_awards', v_code, 'not_eligible', 'Not eligible yet: some criteria are not met', v_role); end if;
  if (e ->> 'manual')::integer > 0 then
    v_id := 'mca-' || kafaa_w5_hex(16);
    select coalesce(nullif(initials, ''), '—') into v_init from kafaa_people where id = me;
    insert into kafaa_microcred_awards (id, def_id, def_code, def_version, person_id, holder_initials, status, requested_at, evidence, component_award_ids, credential, created_at)
    values (v_id, d.id, d.code, d.version, me, coalesce(v_init, '—'), 'pending_approval', now(), kafaa_mc_snapshot(e, null, current_date),
      coalesce((select array_agg(c ->> 'award_id' order by o) from jsonb_array_elements(e -> 'components') with ordinality x(c, o) where c ->> 'award_id' is not null), '{}'::text[]), '{}'::jsonb, now());
    for tm in select distinct ra.person_id from kafaa_role_assignments ra where ra.role = 'training_manager' and ra.status = 'active' order by 1 loop
      if tm <> me then perform kafaa_w5_notify('nt-mc-' || v_id || '-' || tm, tm, 'microcred', 'Micro-credential to confirm: ' || d.code, 'اعتماد مصغّر بانتظار التأكيد: ' || d.code, '/admin/frameworks?tab=microcredentials', 'info'); end if;
    end loop;
    a := kafaa_audit('microcred.award', 'microcred_awards', v_id, 'ok', d.code || ' v' || d.version || ' pending approval', 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Request sent: a training manager confirms the manual criteria', a, null, jsonb_build_object('id', v_id, 'status', 'pending_approval', 'slug', null));
  end if;
  r := kafaa_mc_issue(d, me, e, null, null, current_date);
  l := kafaa_ledger('kafaa.microcred.award', format('Micro-credential %s awarded for %s', r ->> 'slug', d.code));
  a := kafaa_audit('microcred.award', 'microcred_awards', r ->> 'id', 'ok', d.code || ' v' || d.version || ' awarded' || case when (r ->> 'renewed')::boolean then ' (renewal)' else '' end,
    case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Micro-credential awarded and signed', a, l, jsonb_build_object('id', r ->> 'id', 'status', 'awarded', 'slug', r ->> 'slug'));
end $$;

-- A training manager approves (re-checks, signs) or declines a request; never their own.
create or replace function kafaa_decide_microcred_award(p_award text, p_decision text, p_note text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; aw kafaa_microcred_awards; v_n text := btrim(coalesce(p_note, ''), E' \t\n\r'); d kafaa_microcred_defs; e jsonb; r jsonb; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('microcred.decide', 'microcred_awards', nullif(p_award, ''), 'not_signed_in', 'Sign in to use micro-credentials'); end if;
  v_role := kafaa_acting_role('skills_profile', array['A']);
  if v_role is null then return kafaa_refuse('microcred.decide', 'microcred_awards', nullif(p_award, ''), 'forbidden', 'Only a training manager can approve micro-credentials'); end if;
  select * into aw from kafaa_microcred_awards where id = p_award;
  if aw.id is null then return kafaa_refuse('microcred.decide', 'microcred_awards', nullif(p_award, ''), 'not_found', 'Award not found', v_role); end if;
  if aw.person_id = me then return kafaa_refuse('microcred.decide', 'microcred_awards', aw.id, 'maker_checker', 'You cannot approve your own micro-credential', v_role); end if;
  if aw.status <> 'pending_approval' then return kafaa_refuse('microcred.decide', 'microcred_awards', aw.id, 'conflict', 'This request is no longer waiting for approval', v_role); end if;
  if length(v_n) < 3 or length(v_n) > 500 or coalesce(p_decision, '') not in ('approve', 'decline') then
    return kafaa_refuse('microcred.decide', 'microcred_awards', aw.id, 'invalid', 'Add a short note (3 to 500 characters)', v_role);
  end if;
  if p_decision = 'decline' then
    update kafaa_microcred_awards set status = 'declined', decided_by = me, decided_at = now(), decision_note = v_n where id = aw.id;
    perform kafaa_w5_notify('nt-mc-' || aw.id || '-declined', aw.person_id, 'microcred', 'Micro-credential request declined: ' || aw.def_code, 'رُفض طلب الاعتماد المصغّر: ' || aw.def_code, '/my/skills/credentials', 'warn');
    a := kafaa_audit('microcred.decide', 'microcred_awards', aw.id, 'ok', 'declined: ' || v_n, 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Request declined', a, null, jsonb_build_object('id', aw.id, 'status', 'declined', 'slug', null));
  end if;
  select * into d from kafaa_microcred_defs where code = aw.def_code and status = 'current' order by id collate "C" limit 1;
  if d.id is null then return kafaa_refuse('microcred.decide', 'microcred_awards', aw.id, 'not_found', 'Micro-credential not found or not published', v_role); end if;
  e := kafaa_mc_eligibility(d, aw.person_id, current_date);
  if (e ->> 'auto_met')::boolean is not true then return kafaa_refuse('microcred.decide', 'microcred_awards', aw.id, 'not_eligible', 'Not eligible yet: some criteria are not met', v_role); end if;
  r := kafaa_mc_issue(d, aw.person_id, e, me, aw.id, current_date);
  update kafaa_microcred_awards set decision_note = v_n where id = aw.id;
  l := kafaa_ledger('kafaa.microcred.approve', format('Micro-credential %s approved for %s', r ->> 'slug', d.code));
  a := kafaa_audit('microcred.decide', 'microcred_awards', aw.id, 'ok', 'approved ' || d.code || ' v' || d.version || ': ' || v_n, case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Micro-credential awarded and signed', a, l, jsonb_build_object('id', aw.id, 'status', 'awarded', 'slug', r ->> 'slug'));
end $$;

-- Withdraw (holder) or revoke (training manager) an award or a pending request.
create or replace function kafaa_revoke_microcred(p_award text, p_reason text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); aw kafaa_microcred_awards; v_own boolean; v_role text; v_why text := btrim(coalesce(p_reason, ''), E' \t\n\r'); a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('microcred.revoke', 'microcred_awards', nullif(p_award, ''), 'not_signed_in', 'Sign in to use micro-credentials'); end if;
  select * into aw from kafaa_microcred_awards where id = p_award;
  v_own := aw.id is not null and aw.person_id = me and kafaa_has_grant('skills_profile', array['Own']);
  if aw.id is null or (not v_own and not kafaa_has_grant('skills_profile', array['A'])) then return kafaa_refuse('microcred.revoke', 'microcred_awards', nullif(p_award, ''), 'not_found', 'Award not found'); end if;
  v_role := case when v_own then kafaa_acting_role('skills_profile', array['Own']) else kafaa_acting_role('skills_profile', array['A']) end;
  if aw.status not in ('awarded', 'pending_approval') then return kafaa_refuse('microcred.revoke', 'microcred_awards', aw.id, 'conflict', 'This award is already revoked or replaced', v_role); end if;
  if length(v_why) < 3 or length(v_why) > 500 then return kafaa_refuse('microcred.revoke', 'microcred_awards', aw.id, 'invalid', 'Add a short note (3 to 500 characters)', v_role); end if;
  update kafaa_microcred_awards set status = 'revoked', revoked_at = now(), revoke_reason = v_why where id = aw.id;
  update kafaa_skill_evidence set active = false where ref_table = 'microcred_awards' and ref_id = aw.id and active;
  perform kafaa_skills_apply(aw.person_id, current_date);
  l := kafaa_ledger('kafaa.microcred.revoke', format('Micro-credential %s revoked', coalesce(aw.public_slug, aw.id)));
  a := kafaa_audit('microcred.revoke', 'microcred_awards', aw.id, 'ok', case when v_own then 'withdrawn by holder: ' else 'revoked: ' end || v_why, case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when v_own then 'Micro-credential withdrawn' else 'Micro-credential revoked' end, a, l);
end $$;

-- Public verification by share slug: rate-limited (20 a minute per credential, 600 overall), audited, initials only.
create or replace function kafaa_verify_microcred(p_slug text) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_slug text := left(btrim(coalesce(p_slug, '')), 64); aw kafaa_microcred_awards; v_status text; v_comps jsonb := '[]'::jsonb; cid text; c kafaa_microcred_awards; cd kafaa_microcred_defs; a kafaa_audit_events;
begin
  if (select count(*) from kafaa_audit_events e where e.action = 'microcred.verify' and e.ts > now() - interval '1 minute' and e.entity_id = v_slug) >= 20
     or (select count(*) from kafaa_audit_events e where e.action = 'microcred.verify' and e.ts > now() - interval '1 minute') >= 600 then
    return kafaa_refuse('microcred.verify', 'microcred_awards', nullif(v_slug, ''), 'rate_limited', 'Too many verification requests: try again in a minute');
  end if;
  select * into aw from kafaa_microcred_awards where public_slug = v_slug and v_slug <> '';
  if aw.id is null then return kafaa_refuse('microcred.verify', 'microcred_awards', nullif(v_slug, ''), 'not_found', 'No Kafa''a micro-credential has this link'); end if;
  v_status := kafaa_mc_view(aw, current_date) ->> 'status';
  foreach cid in array coalesce(aw.component_award_ids, '{}'::text[]) loop
    c := kafaa_mc_resolve(cid);
    cd := null;
    select * into cd from kafaa_microcred_defs where code = c.def_code order by (status = 'current') desc, version desc limit 1;
    v_comps := v_comps || jsonb_build_array(jsonb_build_object('code', coalesce(c.def_code, ''), 'title_en', coalesce(cd.title_en, ''), 'title_ar', coalesce(cd.title_ar, ''), 'slug', c.public_slug,
      'status', case when c.id is null then 'none' else kafaa_mc_view(c, current_date, false) ->> 'status' end));
  end loop;
  a := kafaa_audit('microcred.verify', 'microcred_awards', v_slug, 'ok', v_status, 'not_applicable', null, null);
  return kafaa_result(true, 'ok', 'Micro-credential found', a, null, jsonb_build_object('found', true, 'slug', v_slug, 'status', v_status, 'credential', aw.credential, 'key_id', aw.key_id,
    'checked_on', to_char(current_date, 'YYYY-MM-DD'), 'notice', 'Internal Kafa''a credential; not a FANR certificate or licence.', 'components', v_comps));
end $$;

-- Framework owners save a draft definition: a new code, or a new version of an existing one (the open draft is updated in place).
create or replace function kafaa_save_microcred_def(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_code text := btrim(coalesce(p ->> 'code', ''), E' \t\n\r'); v_chk text; base kafaa_microcred_defs; dr kafaa_microcred_defs; cur kafaa_microcred_defs;
  v_crit jsonb; v_al jsonb; v_roles text[]; v_version integer; v_id text; v_sort integer; v_reason text; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('microcred.def_save', 'microcred_defs', nullif(v_code, ''), 'not_signed_in', 'Sign in to use micro-credentials'); end if;
  v_role := kafaa_acting_role('frameworks', array['W', 'A']);
  if v_role is null then return kafaa_refuse('microcred.def_save', 'microcred_defs', nullif(v_code, ''), 'forbidden', 'Only framework owners (training managers and admins) can manage micro-credential definitions'); end if;
  v_chk := kafaa_mc_validate_def(p);
  if v_chk <> 'ok' then
    return kafaa_refuse('microcred.def_save', 'microcred_defs', nullif(v_code, ''), v_chk, case v_chk
      when 'regulatory_wording' then 'Micro-credentials are internal recognition: the wording must not suggest a FANR certificate, licence or qualification'
      when 'security_restricted' then 'Security-related training and skills show as qualified or not qualified only and cannot be part of a micro-credential'
      when 'mirror_only' then 'Qualification standards and licences mirror the licensee''s systems and cannot be micro-credential criteria'
      else 'Check the definition: code, titles, criteria, validity and alignment' end, v_role);
  end if;
  if coalesce(p ->> 'id', '') <> '' then
    select * into base from kafaa_microcred_defs where id = p ->> 'id';
    if base.id is null or base.code <> v_code then return kafaa_refuse('microcred.def_save', 'microcred_defs', v_code, 'invalid', 'Check the definition: code, titles, criteria, validity and alignment', v_role); end if;
  elsif exists (select 1 from kafaa_microcred_defs where code = v_code) then
    return kafaa_refuse('microcred.def_save', 'microcred_defs', v_code, 'conflict', 'A micro-credential with this code already exists: revise it instead', v_role);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('key', c -> 'key', 'kind', c -> 'kind', 'ref', c -> 'ref', 'min_level', case when c ->> 'kind' = 'skill' then c -> 'min_level' else 'null'::jsonb end,
      'label_en', btrim(c ->> 'label_en', E' \t\n\r'), 'label_ar', btrim(c ->> 'label_ar', E' \t\n\r')) order by o), '[]'::jsonb)
    into v_crit from jsonb_array_elements(p -> 'criteria') with ordinality x(c, o);
  select coalesce(jsonb_agg(jsonb_build_object('skill_id', x -> 'skill_id', 'level', x -> 'level') order by o), '[]'::jsonb) into v_al from jsonb_array_elements(p -> 'alignment') with ordinality y(x, o);
  select coalesce(array_agg(x #>> '{}' order by o), '{}'::text[]) into v_roles from jsonb_array_elements(p -> 'role_ids') with ordinality y(x, o);
  v_reason := nullif(btrim(coalesce(p ->> 'change_reason', ''), E' \t\n\r'), '');
  select * into dr from kafaa_microcred_defs where code = v_code and status = 'draft' order by id collate "C" limit 1;
  if dr.id is not null then
    update kafaa_microcred_defs set kind = p ->> 'kind', area = p ->> 'area', level = p ->> 'level', title_en = btrim(p ->> 'title_en', E' \t\n\r'), title_ar = btrim(p ->> 'title_ar', E' \t\n\r'),
      summary_en = btrim(p ->> 'summary_en', E' \t\n\r'), summary_ar = btrim(p ->> 'summary_ar', E' \t\n\r'), criteria = v_crit, stacks_into = nullif(p ->> 'stacks_into', ''), alignment = v_al,
      role_ids = v_roles, validity_months = (p ->> 'validity_months')::integer, hours = case when jsonb_typeof(p -> 'hours') = 'number' then (p ->> 'hours')::integer end,
      change_reason = v_reason, updated_by = me, updated_at = now()
    where id = dr.id;
    a := kafaa_audit('microcred.def_save', 'microcred_defs', dr.id, 'ok', v_code || ' v' || dr.version || ' draft updated', 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Draft saved', a, null, jsonb_build_object('id', dr.id, 'version', dr.version));
  end if;
  v_version := case when base.id is not null then (select max(version) from kafaa_microcred_defs where code = v_code) + 1 else 1 end;
  v_id := 'mcd-' || lower(v_code) || '-v' || v_version;
  select * into cur from kafaa_microcred_defs where code = v_code and status = 'current' order by id collate "C" limit 1;
  v_sort := case when base.id is not null then coalesce(base.sort, 0) else greatest(0, coalesce((select max(sort) from kafaa_microcred_defs), 0)) + 10 end;
  insert into kafaa_microcred_defs (id, code, version, kind, area, level, title_en, title_ar, summary_en, summary_ar, criteria, stacks_into, alignment, role_ids, validity_months, hours,
    status, effective_date, supersedes_id, change_reason, sort, updated_by, updated_at, published_by, published_at)
  values (v_id, v_code, v_version, p ->> 'kind', p ->> 'area', p ->> 'level', btrim(p ->> 'title_en', E' \t\n\r'), btrim(p ->> 'title_ar', E' \t\n\r'), btrim(p ->> 'summary_en', E' \t\n\r'),
    btrim(p ->> 'summary_ar', E' \t\n\r'), v_crit, nullif(p ->> 'stacks_into', ''), v_al, v_roles, (p ->> 'validity_months')::integer, case when jsonb_typeof(p -> 'hours') = 'number' then (p ->> 'hours')::integer end,
    'draft', null, coalesce(cur.id, base.id), v_reason, v_sort, me, now(), null, null);
  a := kafaa_audit('microcred.def_save', 'microcred_defs', v_id, 'ok', v_code || ' v' || v_version || ' draft created', 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Draft saved', a, null, jsonb_build_object('id', v_id, 'version', v_version));
end $$;

-- Publish a draft (the current version is superseded) or retire a published definition. Ledger.
create or replace function kafaa_set_microcred_def_status(p_def text, p_status text, p_note text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; d kafaa_microcred_defs; v_n text := btrim(coalesce(p_note, ''), E' \t\n\r'); a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('microcred.def_status', 'microcred_defs', nullif(p_def, ''), 'not_signed_in', 'Sign in to use micro-credentials'); end if;
  v_role := kafaa_acting_role('frameworks', array['W', 'A']);
  if v_role is null then return kafaa_refuse('microcred.def_status', 'microcred_defs', nullif(p_def, ''), 'forbidden', 'Only framework owners (training managers and admins) can manage micro-credential definitions'); end if;
  select * into d from kafaa_microcred_defs where id = p_def;
  if d.id is null then return kafaa_refuse('microcred.def_status', 'microcred_defs', nullif(p_def, ''), 'not_found', 'Micro-credential not found or not published', v_role); end if;
  if p_status = 'current' then
    if d.status <> 'draft' then return kafaa_refuse('microcred.def_status', 'microcred_defs', d.id, 'conflict', 'Only a draft can be published', v_role); end if;
    if d.kind = 'stack' and (select count(*) from kafaa_microcred_defs x where x.status = 'current' and x.kind = 'micro' and x.stacks_into = d.code) < 2 then
      return kafaa_refuse('microcred.def_status', 'microcred_defs', d.id, 'invalid', 'A stacked credential needs at least two published micro-credentials that stack into it', v_role);
    end if;
    update kafaa_microcred_defs set status = 'superseded' where code = d.code and status = 'current';
    update kafaa_microcred_defs set status = 'current', effective_date = current_date, published_by = me, published_at = now(), change_reason = coalesce(nullif(v_n, ''), change_reason) where id = d.id;
    l := kafaa_ledger('kafaa.microcred.publish', format('Micro-credential %s v%s published', d.code, d.version));
    a := kafaa_audit('microcred.def_status', 'microcred_defs', d.id, 'ok', d.code || ' v' || d.version || ' published' || case when v_n <> '' then ': ' || v_n else '' end, case when l is null then 'skipped' else 'written' end, l, v_role);
    return kafaa_result(true, 'ok', 'Micro-credential published', a, l, jsonb_build_object('id', d.id, 'status', 'current'));
  elsif p_status = 'retired' then
    if d.status <> 'current' then return kafaa_refuse('microcred.def_status', 'microcred_defs', d.id, 'conflict', 'Only a published micro-credential can be retired', v_role); end if;
    if length(v_n) < 3 or length(v_n) > 500 then return kafaa_refuse('microcred.def_status', 'microcred_defs', d.id, 'invalid', 'Add a short note (3 to 500 characters)', v_role); end if;
    update kafaa_microcred_defs set status = 'retired', change_reason = v_n, updated_by = me, updated_at = now() where id = d.id;
    l := kafaa_ledger('kafaa.microcred.retire', format('Micro-credential %s retired', d.code));
    a := kafaa_audit('microcred.def_status', 'microcred_defs', d.id, 'ok', d.code || ' v' || d.version || ' retired: ' || v_n, case when l is null then 'skipped' else 'written' end, l, v_role);
    return kafaa_result(true, 'ok', 'Micro-credential retired; holders keep their awards', a, l, jsonb_build_object('id', d.id, 'status', 'retired'));
  end if;
  return kafaa_refuse('microcred.def_status', 'microcred_defs', d.id, 'invalid', 'Check the definition: code, titles, criteria, validity and alignment', v_role);
end $$;

-- Renewal sweep (training manager): notices for awards inside the renewal window, stacks with a lapsed component, expiries.
create or replace function kafaa_microcred_sweep() returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; aw kafaa_microcred_awards; v jsonb; v_checked integer := 0; v_notices integer := 0; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('microcred.sweep', 'microcred_awards', null, 'not_signed_in', 'Sign in to use micro-credentials'); end if;
  v_role := kafaa_acting_role('skills_profile', array['A']);
  if v_role is null then return kafaa_refuse('microcred.sweep', 'microcred_awards', null, 'forbidden', 'Only a training manager can run the renewal sweep'); end if;
  for aw in select * from kafaa_microcred_awards where status = 'awarded' order by id collate "C" loop
    v_checked := v_checked + 1;
    v := kafaa_mc_view(aw, current_date);
    if v ->> 'status' = 'expired' and kafaa_w5_notify('nt-mc-' || aw.id || '-exp', aw.person_id, 'microcred', 'Micro-credential expired: ' || aw.def_code, 'انتهت صلاحية الاعتماد المصغّر: ' || aw.def_code, '/my/skills/credentials', 'warn') then v_notices := v_notices + 1; end if;
    if v ->> 'status' = 'renewal_due' and v ->> 'reason' = 'window' and kafaa_w5_notify('nt-mc-' || aw.id || '-due', aw.person_id, 'microcred', 'Micro-credential due for renewal: ' || aw.def_code, 'الاعتماد المصغّر مستحق التجديد: ' || aw.def_code, '/my/skills/credentials', 'info') then v_notices := v_notices + 1; end if;
    if v ->> 'status' = 'renewal_due' and v ->> 'reason' = 'component' and kafaa_w5_notify('nt-mc-' || aw.id || '-part', aw.person_id, 'microcred', 'Renewal due: a component of ' || aw.def_code || ' has lapsed', 'التجديد مستحق: انتهى أحد مكوّنات ' || aw.def_code, '/my/skills/credentials', 'warn') then v_notices := v_notices + 1; end if;
  end loop;
  a := kafaa_audit('microcred.sweep', 'microcred_awards', null, 'ok', v_checked || ' awards checked, ' || v_notices || ' notices', 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Renewal sweep complete', a, null, jsonb_build_object('checked', v_checked, 'notices', v_notices));
end $$;

-- Holders, requests and renewals per published definition: exact for skills_profile R/W/A, suppressed below 10 for Agg viewers.
create or replace function kafaa_microcred_stats() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_exact boolean := kafaa_has_grant('skills_profile', array['A', 'R', 'W']); d kafaa_microcred_defs; v_rows jsonb := '[]'::jsonb; v_h integer; v_due integer; v_pend integer; v_sup boolean; p text; s text;
begin
  if kafaa_me() is null or (not v_exact and not kafaa_has_grant('skills_profile', array['Agg'])) then return jsonb_build_object('allowed', false, 'exact', false, 'rows', '[]'::jsonb); end if;
  for d in select * from kafaa_microcred_defs where status = 'current' order by coalesce(sort, 0), code collate "C" loop
    v_h := 0; v_due := 0;
    for p in select distinct person_id from kafaa_microcred_awards where def_code = d.code loop
      s := (select kafaa_mc_view(x, current_date) ->> 'status' from kafaa_mc_latest(p, d.code) x where x.id is not null);
      if s in ('active', 'renewal_due') then v_h := v_h + 1; end if;
      if s = 'renewal_due' then v_due := v_due + 1; end if;
    end loop;
    select count(*)::integer into v_pend from kafaa_microcred_awards where def_code = d.code and status = 'pending_approval';
    v_sup := not v_exact and v_h < 10;
    v_rows := v_rows || jsonb_build_array(jsonb_build_object('code', d.code, 'title_en', d.title_en, 'title_ar', d.title_ar, 'kind', d.kind,
      'holders', case when v_sup then null else v_h end, 'pending', case when not v_exact and v_pend < 10 then null else v_pend end,
      'renewal_due', case when v_sup or (not v_exact and v_due < 10) then null else v_due end, 'suppressed', v_sup));
  end loop;
  return jsonb_build_object('allowed', true, 'exact', v_exact, 'rows', v_rows);
end $$;

-- ═════════════ F38 OJT practice logbook (mirror of src/modules/m02/ojt.ts and backend/local.ojt.ts)
-- Shape of a practice entry: client key, date (today or up to 180 days back), conditions, confidence 1-5, note, conditions text.
create or replace function kafaa_ojt_validate(p jsonb, p_today date) returns text language plpgsql immutable set search_path = public as $$
begin
  if p is null or jsonb_typeof(p) <> 'object' then return 'invalid'; end if;
  if jsonb_typeof(p -> 'client_key') is distinct from 'string' or (p ->> 'client_key') !~ '^[A-Za-z0-9:_-]{8,80}$' then return 'bad_key'; end if;
  if jsonb_typeof(p -> 'on_date') is distinct from 'string' or not kafaa_w5_is_date(p ->> 'on_date') or (p ->> 'on_date')::date > p_today or (p ->> 'on_date')::date < p_today - 180 then return 'invalid'; end if;
  if jsonb_typeof(p -> 'mode') is distinct from 'string' or (p ->> 'mode') not in ('walkthrough', 'simulate', 'perform') then return 'invalid'; end if;
  if not kafaa_w5_int(p -> 'confidence', 1, 5) then return 'invalid'; end if;
  if p -> 'note' is not null and jsonb_typeof(p -> 'note') <> 'null' and (jsonb_typeof(p -> 'note') <> 'string' or length(p ->> 'note') > 500) then return 'invalid'; end if;
  if p -> 'conditions' is not null and jsonb_typeof(p -> 'conditions') <> 'null' and (jsonb_typeof(p -> 'conditions') <> 'string' or length(p ->> 'conditions') > 200) then return 'invalid'; end if;
  return 'ok';
end $$;
-- A standard the person may practise: a qualification record on it, a standard of their job role, or the all-staff standard. TS myStandards.
create or replace function kafaa_ojt_my_standard(p_person text, p_std text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from kafaa_qual_records q where q.person_id = p_person and q.standard_id = p_std)
    or exists (select 1 from kafaa_qual_standards s join kafaa_people pe on pe.id = p_person where s.id = p_std and s.status = 'current'
      and ((pe.job_role_id is not null and pe.job_role_id = any(s.role_ids)) or cardinality(s.role_ids) = 0))
$$;
-- May p_cand precept p_trainee on p_std? TS preceptorOk.
create or replace function kafaa_ojt_preceptor_ok(p_cand text, p_trainee text, p_std text, p_today date) returns text language sql stable security definer set search_path = public as $$
  select case
    when p_cand = p_trainee then 'self_preceptor'
    when not exists (select 1 from kafaa_people pe where pe.id = p_cand and pe.kind = 'staff' and pe.status = 'active') then 'not_preceptor'
    when exists (select 1 from kafaa_qual_records q where q.person_id = p_cand and q.standard_id = p_std and q.status in ('qualified', 'renewed', 'due') and (q.expires_on is null or q.expires_on >= p_today))
      or exists (select 1 from kafaa_evaluator_quals e where e.person_id = p_cand and e.standard_id = p_std and e.valid_to >= p_today) then 'ok'
    else 'not_preceptor' end
$$;
-- Readiness of a task for a person: acknowledged `perform` entries against N (3, or 4 when critical) and the latest preceptor "ready". TS readiness.
create or replace function kafaa_ojt_readiness(p_person text, p_task text, p_critical boolean) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_sup integer; v_prac integer; v_pend integer; v_need integer := case when coalesce(p_critical, false) then 4 else 3 end; last kafaa_ojt_logs; v_ready boolean;
begin
  select count(*) filter (where status = 'acknowledged' and mode = 'perform'), count(*), count(*) filter (where status = 'pending_ack') into v_sup, v_prac, v_pend
    from kafaa_ojt_logs where person_id = p_person and task_id = p_task;
  select * into last from kafaa_ojt_logs where person_id = p_person and task_id = p_task and status = 'acknowledged'
    order by ack_at desc nulls last, on_date desc, id collate "C" desc limit 1;
  v_ready := last.id is not null and last.preceptor_ready is true;
  return jsonb_build_object('task_id', p_task, 'supervised', v_sup, 'needed', v_need, 'practised', v_prac, 'pending', v_pend, 'preceptor_ready', v_ready,
    'last_ack_id', last.id, 'last_ack_on', case when last.id is null then null else to_char(last.ack_at at time zone 'UTC', 'YYYY-MM-DD') end, 'ready', v_sup >= v_need and v_ready);
end $$;

-- F38 -> F30: one `attempted` statement per practice entry (object = the task; no free text). TS draftFor('f38_ojt').
create or replace function kafaa_xapi_d_ojt(r kafaa_ojt_logs, p_stored timestamptz) returns kafaa_xapi_statements language plpgsql stable security definer set search_path = public as $$
declare t kafaa_task_items;
begin
  select * into t from kafaa_task_items where id = r.task_id;
  return kafaa_xapi_make('f38_ojt', r.id, r.person_id, 'attempted', 'task', r.task_id,
    case when t.id is null then jsonb_build_object('en', r.task_id, 'ar', r.task_id)
      else jsonb_build_object('en', coalesce(t.code, '') || ' ' || coalesce(t.statement_en, ''), 'ar', coalesce(t.code, '') || ' ' || coalesce(nullif(t.statement_ar, ''), t.statement_en, '')) end,
    jsonb_build_object('completion', true),
    jsonb_build_object('extensions', jsonb_build_object('https://kafaa.example/xapi/ext/record', 'ojt_logs/' || r.id, 'https://kafaa.example/xapi/ext/ojt-mode', r.mode)),
    kafaa_xapi_noon(r.on_date), p_stored);
end $$;
-- The F30 backfill source list (W4 integration version plus the f38_ojt line).
create or replace function kafaa_xapi_source_rows() returns setof kafaa_xapi_statements language plpgsql stable security definer set search_path = public as $$
begin
  return query select s.* from kafaa_training_records t cross join lateral kafaa_xapi_d_course(t, null) s where s.id is not null;
  return query select s.* from kafaa_refresh_state t cross join lateral kafaa_xapi_d_refresher(t, null) s where t.attempts > 0 and s.id is not null;
  return query select s.* from kafaa_opportunity_applications t cross join lateral kafaa_xapi_d_opportunity(t, null) s where t.status = 'completed' and s.id is not null;
  return query select s.* from kafaa_rotation_placements t cross join lateral kafaa_xapi_d_rotation(t, null) s where t.status = 'signed_off' and s.id is not null;
  return query select s.* from kafaa_shadow_requests t cross join lateral kafaa_xapi_d_shadowing(t, null) s where t.status = 'completed' and s.id is not null;
  return query select s.* from kafaa_jpm_results t cross join lateral kafaa_xapi_d_jpm(t, null) s where s.id is not null;
  return query select s.* from kafaa_mentoring_sessions t cross join lateral kafaa_xapi_d_mentoring(t, null) s where s.id is not null;
  return query select s.* from kafaa_asset_uses t cross join lateral kafaa_xapi_d_asset(t, null) s where s.id is not null;
  return query select s.* from kafaa_crew_debrief_members t cross join lateral kafaa_xapi_d_simulator(t, null) s where t.present and s.id is not null;
  return query select s.* from kafaa_ojt_logs t cross join lateral kafaa_xapi_d_ojt(t, null) s where s.id is not null;
end $$;
-- Emitter trigger on kafaa_ojt_logs (append only; skipped while seeding; a failure is only a warning).
create or replace function kafaa_ojt_emit() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('kafaa.seeding', true), '') = 'on' then return new; end if;
  begin
    perform kafaa_xapi_emit(kafaa_xapi_d_ojt(new, now()));
  exception when others then
    raise warning 'Kafa''a LRS emitter skipped on kafaa_ojt_logs: %', sqlerrm;
  end;
  return new;
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'kafaa_xapi_emit_ojt_logs') then
    execute 'create trigger kafaa_xapi_emit_ojt_logs after insert on kafaa_ojt_logs for each row execute function kafaa_ojt_emit()'; end if;
end $$;

-- ───────────── F38 RPCs
create or replace function kafaa_log_practice(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; pe kafaa_people; v_task text := case when jsonb_typeof(p -> 'task_id') = 'string' then p ->> 'task_id' end;
  v_key text := case when jsonb_typeof(p -> 'client_key') = 'string' then p ->> 'client_key' else '' end; dup kafaa_ojt_logs; v_shape text; t kafaa_task_items; std kafaa_qual_standards;
  v_pre text := coalesce(p ->> 'preceptor_person_id', ''); v_pc text; pr kafaa_people; v_id text; v_off boolean := coalesce(jsonb_typeof(p -> 'offline') = 'boolean' and (p ->> 'offline')::boolean, false);
  a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('ojt.log', 'ojt_logs', v_task, 'not_signed_in', 'Sign in to use the OJT logbook'); end if;
  v_role := kafaa_acting_role('qual_records', array['Own']);
  select * into pe from kafaa_people where id = me;
  if v_role is null or pe.id is null or pe.kind <> 'staff' then return kafaa_refuse('ojt.log', 'ojt_logs', v_task, 'forbidden', 'Only staff with qualification records can keep an OJT logbook', v_role); end if;
  -- idempotent re-sync: the same device key never records twice
  select * into dup from kafaa_ojt_logs where client_key = v_key and v_key <> '';
  if dup.id is not null then
    if dup.person_id <> me then return kafaa_refuse('ojt.log', 'ojt_logs', v_task, 'bad_key', 'The entry key is not valid', v_role); end if;
    a := kafaa_audit('ojt.log', 'ojt_logs', dup.id, 'ok', 'duplicate client key: nothing recorded', 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Already synced: this entry was recorded once', a, null, jsonb_build_object('id', dup.id, 'duplicate', true, 'status', dup.status));
  end if;
  v_shape := kafaa_ojt_validate(p, current_date);
  if v_shape = 'bad_key' then return kafaa_refuse('ojt.log', 'ojt_logs', v_task, 'bad_key', 'The entry key is not valid', v_role); end if;
  select * into t from kafaa_task_items where id = v_task;
  select * into std from kafaa_qual_standards where id = t.standard_id;
  if t.id is null or std.id is null then return kafaa_refuse('ojt.log', 'ojt_logs', v_task, 'not_found', 'Task not found', v_role); end if;
  if std.security_restricted then return kafaa_refuse('ojt.log', 'ojt_logs', t.id, 'security_restricted', 'Security-restricted tasks are managed outside Kafa''a and cannot be logged', v_role); end if;
  if t.method not in ('ojt', 'jpm', 'simulator') then return kafaa_refuse('ojt.log', 'ojt_logs', t.id, 'not_practice_task', 'Classroom and written items are not practised on the job', v_role); end if;
  if not kafaa_ojt_my_standard(me, std.id) then return kafaa_refuse('ojt.log', 'ojt_logs', t.id, 'not_applicable', 'This task is not on a qualification standard of yours or of your role', v_role); end if;
  if v_shape <> 'ok' then return kafaa_refuse('ojt.log', 'ojt_logs', t.id, 'invalid', 'Check the entry: date (today or up to 180 days back), conditions, confidence 1 to 5 and a note of up to 500 characters', v_role); end if;
  v_pc := kafaa_ojt_preceptor_ok(v_pre, me, std.id, current_date);
  if v_pc <> 'ok' then return kafaa_refuse('ojt.log', 'ojt_logs', t.id, v_pc, case v_pc when 'self_preceptor' then 'Choose a preceptor other than yourself' else 'The preceptor must be qualified on this standard (or an evaluator for it)' end, v_role); end if;
  select * into pr from kafaa_people where id = v_pre;
  v_id := 'ojt-' || kafaa_w5_hex(16);
  insert into kafaa_ojt_logs (id, client_key, person_id, person_name, person_name_ar, task_id, standard_id, on_date, mode, preceptor_person_id, preceptor_name, preceptor_name_ar,
    confidence, conditions, note, status, feedback, preceptor_ready, ack_at, synced, created_at)
  values (v_id, v_key, me, coalesce(pe.display_name, me), coalesce(nullif(pe.display_name_ar, ''), pe.display_name, me), t.id, std.id, (p ->> 'on_date')::date, p ->> 'mode', v_pre,
    coalesce(pr.display_name, v_pre), coalesce(nullif(pr.display_name_ar, ''), pr.display_name, v_pre), (p ->> 'confidence')::integer,
    nullif(btrim(coalesce(p ->> 'conditions', ''), E' \t\n\r'), ''), nullif(btrim(coalesce(p ->> 'note', ''), E' \t\n\r'), ''), 'pending_ack', null, false, null,
    case when v_off then 'offline' else 'online' end, now());
  perform kafaa_w5_notify('nt-ojt-' || v_id, v_pre, 'ojt', 'Practice to acknowledge: ' || t.code || ' (' || coalesce(pe.display_name, me) || ')',
    'تدريب عملي بانتظار تأكيدك: ' || t.code || ' (' || coalesce(nullif(pe.display_name_ar, ''), pe.display_name, me) || ')', '/my/ojt?tab=acknowledge', 'info');
  a := kafaa_audit('ojt.log', 'ojt_logs', v_id, 'ok', t.code || ' ' || (p ->> 'mode') || ' on ' || (p ->> 'on_date') || case when v_off then ' (synced from offline)' else '' end, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Practice logged. It is practice, not a qualification sign-off.', a, null, jsonb_build_object('id', v_id, 'duplicate', false, 'status', 'pending_ack'));
end $$;

create or replace function kafaa_ack_practice(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_log text := case when jsonb_typeof(p -> 'log_id') = 'string' then p ->> 'log_id' end; l kafaa_ojt_logs; t kafaa_task_items;
  v_fb text := btrim(coalesce(case when jsonb_typeof(p -> 'feedback') = 'string' then p ->> 'feedback' end, ''), E' \t\n\r'); v_dec text := p ->> 'decision';
  v_ready boolean := coalesce(jsonb_typeof(p -> 'ready') = 'boolean' and (p ->> 'ready')::boolean, false); v_status text; r jsonb; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('ojt.ack', 'ojt_logs', v_log, 'not_signed_in', 'Sign in to use the OJT logbook'); end if;
  v_role := kafaa_acting_role('own_profile', array['Own']);
  select * into l from kafaa_ojt_logs where id = v_log;
  if l.id is null or v_role is null then return kafaa_refuse('ojt.ack', 'ojt_logs', v_log, 'not_found', 'Entry not found', v_role); end if;
  if l.preceptor_person_id <> me then return kafaa_refuse('ojt.ack', 'ojt_logs', l.id, 'not_preceptor', 'Only the preceptor named on the entry can acknowledge it', v_role); end if;
  if l.status <> 'pending_ack' then return kafaa_refuse('ojt.ack', 'ojt_logs', l.id, 'conflict', 'This entry has already been answered', v_role); end if;
  if length(v_fb) < 3 or length(v_fb) > 500 or coalesce(v_dec, '') not in ('acknowledge', 'return') then
    return kafaa_refuse('ojt.ack', 'ojt_logs', l.id, 'invalid', 'Add feedback for the trainee (3 to 500 characters)', v_role);
  end if;
  v_status := case when v_dec = 'acknowledge' then 'acknowledged' else 'returned' end;
  update kafaa_ojt_logs set status = v_status, feedback = v_fb, preceptor_ready = (v_status = 'acknowledged' and v_ready), ack_at = now() where id = l.id;
  select * into t from kafaa_task_items where id = l.task_id;
  r := kafaa_ojt_readiness(l.person_id, l.task_id, t.critical);
  perform kafaa_w5_notify('nt-ojt-' || l.id || '-' || v_status, l.person_id, 'ojt',
    case when v_status = 'acknowledged' then 'Practice acknowledged: ' || t.code || case when (r ->> 'ready')::boolean then ' (ready for evaluation)' else '' end else 'Practice returned with feedback: ' || t.code end,
    case when v_status = 'acknowledged' then 'تم تأكيد التدريب العملي: ' || t.code || case when (r ->> 'ready')::boolean then ' (جاهز للتقييم)' else '' end else 'أُعيد التدريب العملي مع ملاحظات: ' || t.code end,
    '/my/ojt', case when v_status = 'acknowledged' then 'ok' else 'warn' end);
  a := kafaa_audit('ojt.ack', 'ojt_logs', l.id, 'ok', v_status || case when v_status = 'acknowledged' and v_ready then ', ready for evaluation' else '' end, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when v_status = 'acknowledged' then 'Practice acknowledged' else 'Entry returned to the trainee with your feedback' end, a, null,
    jsonb_build_object('id', l.id, 'status', v_status, 'readiness', r));
end $$;

create or replace function kafaa_request_evaluation(p_task text, p_evaluator text, p_note text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; pe kafaa_people; t kafaa_task_items; std kafaa_qual_standards; rec kafaa_qual_records; r jsonb; ev kafaa_people; v_n text := btrim(coalesce(p_note, ''), E' \t\n\r');
  v_id text; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('ojt.request_evaluation', 'ojt_eval_requests', nullif(p_task, ''), 'not_signed_in', 'Sign in to use the OJT logbook'); end if;
  v_role := kafaa_acting_role('qual_records', array['Own']);
  select * into pe from kafaa_people where id = me;
  if v_role is null or pe.id is null or pe.kind <> 'staff' then return kafaa_refuse('ojt.request_evaluation', 'ojt_eval_requests', nullif(p_task, ''), 'forbidden', 'Only staff with qualification records can keep an OJT logbook', v_role); end if;
  select * into t from kafaa_task_items where id = p_task;
  select * into std from kafaa_qual_standards where id = t.standard_id;
  if t.id is null or std.id is null then return kafaa_refuse('ojt.request_evaluation', 'ojt_eval_requests', nullif(p_task, ''), 'not_found', 'Task not found', v_role); end if;
  if std.security_restricted then return kafaa_refuse('ojt.request_evaluation', 'ojt_eval_requests', t.id, 'security_restricted', 'Security-restricted tasks are managed outside Kafa''a and cannot be logged', v_role); end if;
  select * into rec from kafaa_qual_records q where q.person_id = me and q.standard_id = std.id and q.status <> 'suspended' order by q.id collate "C" limit 1;
  if rec.id is null then return kafaa_refuse('ojt.request_evaluation', 'ojt_eval_requests', t.id, 'no_record', 'You need a qualification record on this standard before an evaluation can be requested', v_role); end if;
  r := kafaa_ojt_readiness(me, t.id, t.critical);
  if (r ->> 'ready')::boolean is not true then return kafaa_refuse('ojt.request_evaluation', 'ojt_eval_requests', t.id, 'not_ready', 'Not ready yet: more supervised performances or a preceptor "ready" are needed', v_role); end if;
  if coalesce(p_evaluator, '') = me then return kafaa_refuse('ojt.request_evaluation', 'ojt_eval_requests', t.id, 'self_evaluator', 'You cannot evaluate your own task', v_role); end if;
  select * into ev from kafaa_people where id = p_evaluator;
  if ev.id is null or ev.status <> 'active' or not exists (select 1 from kafaa_evaluator_quals q where q.person_id = ev.id and q.standard_id = std.id and q.valid_to >= current_date) then
    return kafaa_refuse('ojt.request_evaluation', 'ojt_eval_requests', t.id, 'not_evaluator', 'The evaluator must hold a current evaluator qualification for this standard', v_role);
  end if;
  if exists (select 1 from kafaa_ojt_eval_requests x where x.person_id = me and x.task_id = t.id and x.status = 'requested') then
    return kafaa_refuse('ojt.request_evaluation', 'ojt_eval_requests', t.id, 'already_requested', 'An evaluation request for this task is already open', v_role);
  end if;
  if length(v_n) > 500 then return kafaa_refuse('ojt.request_evaluation', 'ojt_eval_requests', t.id, 'invalid', 'Add a short note (3 to 500 characters)', v_role); end if;
  v_id := 'oer-' || kafaa_w5_hex(16);
  insert into kafaa_ojt_eval_requests (id, person_id, person_name, person_name_ar, task_id, standard_id, record_id, evaluator_person_id, evaluator_name, evaluator_name_ar, status, readiness, note, requested_at)
  values (v_id, me, coalesce(pe.display_name, me), coalesce(nullif(pe.display_name_ar, ''), pe.display_name, me), t.id, std.id, rec.id, ev.id, coalesce(ev.display_name, ev.id),
    coalesce(nullif(ev.display_name_ar, ''), ev.display_name, ev.id), 'requested',
    jsonb_build_object('supervised', (r ->> 'supervised')::integer, 'needed', (r ->> 'needed')::integer, 'last_ack_id', r ->> 'last_ack_id'), nullif(v_n, ''), now());
  perform kafaa_w5_notify('nt-ojt-' || v_id, ev.id, 'ojt', 'Evaluation requested: ' || t.code || ' (' || coalesce(pe.display_name, me) || ')',
    'طلب تقييم: ' || t.code || ' (' || coalesce(nullif(pe.display_name_ar, ''), pe.display_name, me) || ')', '/my/ojt?tab=evaluate', 'info');
  a := kafaa_audit('ojt.request_evaluation', 'ojt_eval_requests', v_id, 'ok', t.code || ' to ' || ev.id || '; ' || (r ->> 'supervised') || '/' || (r ->> 'needed') || ' supervised, preceptor ready', 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Evaluation requested. The evaluator signs the task off in M02.', a, null, jsonb_build_object('id', v_id));
end $$;

create or replace function kafaa_close_evaluation_request(p_request text, p_action text, p_note text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; q kafaa_ojt_eval_requests; v_mine boolean; v_n text := btrim(coalesce(p_note, ''), E' \t\n\r'); ev kafaa_evaluations; t kafaa_task_items; v_status text; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('ojt.close_request', 'ojt_eval_requests', nullif(p_request, ''), 'not_signed_in', 'Sign in to use the OJT logbook'); end if;
  v_role := kafaa_acting_role('own_profile', array['Own']);
  select * into q from kafaa_ojt_eval_requests where id = p_request;
  v_mine := q.id is not null and ((p_action = 'cancel' and q.person_id = me) or (coalesce(p_action, '') <> 'cancel' and q.evaluator_person_id = me));
  if q.id is null or v_role is null or not v_mine then return kafaa_refuse('ojt.close_request', 'ojt_eval_requests', nullif(p_request, ''), 'not_found', 'Request not found', v_role); end if;
  if q.status <> 'requested' then return kafaa_refuse('ojt.close_request', 'ojt_eval_requests', q.id, 'conflict', 'This request is no longer open', v_role); end if;
  if length(v_n) > 500 or (p_action = 'decline' and length(v_n) < 3) or coalesce(p_action, '') not in ('complete', 'decline', 'cancel') then return kafaa_refuse('ojt.close_request', 'ojt_eval_requests', q.id, 'invalid', 'Add a short note (3 to 500 characters)', v_role); end if;
  if p_action = 'complete' then
    select * into ev from kafaa_evaluations e where e.record_id = q.record_id and e.task_id = q.task_id and e.evaluator_person_id = me and e.result <> 'pending' and e.created_at >= q.requested_at
      order by e.created_at desc, e.id collate "C" desc limit 1;
    if ev.id is null then return kafaa_refuse('ojt.close_request', 'ojt_eval_requests', q.id, 'no_evaluation', 'Sign the task off first (record the evaluation), then close the request', v_role); end if;
  end if;
  v_status := case p_action when 'complete' then 'completed' when 'decline' then 'declined' else 'cancelled' end;
  update kafaa_ojt_eval_requests set status = v_status, closed_at = now(), closed_by = me, close_note = nullif(v_n, ''), evaluation_id = ev.id, result = ev.result where id = q.id;
  select * into t from kafaa_task_items where id = q.task_id;
  if p_action <> 'cancel' then
    perform kafaa_w5_notify('nt-ojt-' || q.id || '-' || v_status, q.person_id, 'ojt',
      case when p_action = 'complete' then 'Evaluation recorded: ' || t.code || ' (' || ev.result || ')' else 'Evaluation request declined: ' || t.code end,
      case when p_action = 'complete' then 'سُجّل التقييم: ' || t.code || ' (' || case when ev.result = 'pass' then 'ناجح' else 'غير ناجح' end || ')' else 'رُفض طلب التقييم: ' || t.code end,
      '/my/ojt', case when p_action = 'complete' and ev.result = 'pass' then 'ok' else 'warn' end);
  end if;
  a := kafaa_audit('ojt.close_request', 'ojt_eval_requests', q.id, 'ok', v_status || case when ev.id is not null then ' with ' || ev.id || ' (' || ev.result || ')' else '' end || case when v_n <> '' then ': ' || v_n else '' end,
    'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case p_action when 'complete' then 'Evaluation request closed with the recorded result' when 'decline' then 'Evaluation request declined' else 'Evaluation request cancelled' end,
    a, null, jsonb_build_object('id', q.id, 'status', v_status, 'evaluation_id', ev.id, 'result', ev.result));
end $$;

-- Who can precept (or evaluate) a task for me: same team first, then by name. TS preceptorsFor.
create or replace function kafaa_ojt_preceptors(p_task text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); t kafaa_task_items; std kafaa_qual_standards; pe kafaa_people; v jsonb;
begin
  select * into t from kafaa_task_items where id = p_task;
  select * into std from kafaa_qual_standards where id = t.standard_id;
  if me is null or t.id is null or std.id is null or std.security_restricted or not kafaa_has_grant('qual_records', array['Own']) then return '[]'::jsonb; end if;
  select * into pe from kafaa_people where id = me;
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name_en', x.name_en, 'name_ar', x.name_ar, 'job_role_id', x.job_role_id, 'same_team', x.same_team, 'evaluator', x.evaluator)
      order by x.same_team desc, x.name_en collate "C", x.id collate "C"), '[]'::jsonb) into v
  from (
    select c.id, coalesce(c.display_name, c.id) as name_en, coalesce(nullif(c.display_name_ar, ''), c.display_name, c.id) as name_ar, c.job_role_id,
      (pe.team_id is not null and c.team_id = pe.team_id) as same_team,
      exists (select 1 from kafaa_evaluator_quals e where e.person_id = c.id and e.standard_id = std.id and e.valid_to >= current_date) as evaluator
    from kafaa_people c
    where c.id in (select q.person_id from kafaa_qual_records q where q.standard_id = std.id union select e.person_id from kafaa_evaluator_quals e where e.standard_id = std.id)
      and kafaa_ojt_preceptor_ok(c.id, me, std.id, current_date) = 'ok'
  ) x;
  return v;
end $$;

-- ───────────── Grants: internal helpers are not executable by API roles; RPCs by signed-in users; verification also by anon.
revoke execute on function kafaa_w5_is_date(text), kafaa_w5_tlen(jsonb), kafaa_w5_int(jsonb, numeric, numeric), kafaa_w5_hex(integer), kafaa_w5_notify(text, text, text, text, text, text, text),
  kafaa_mc_resolve(text), kafaa_mc_view(kafaa_microcred_awards, date, boolean), kafaa_mc_latest(text, text), kafaa_mc_crit(jsonb, text, date), kafaa_mc_eligibility(kafaa_microcred_defs, text, date),
  kafaa_mc_aligned(jsonb), kafaa_mc_credential(text, kafaa_microcred_defs, text, date, date, jsonb, text), kafaa_mc_snapshot(jsonb, text, date),
  kafaa_mc_issue(kafaa_microcred_defs, text, jsonb, text, text, date), kafaa_mc_validate_def(jsonb),
  kafaa_ojt_validate(jsonb, date), kafaa_ojt_my_standard(text, text), kafaa_ojt_preceptor_ok(text, text, text, date), kafaa_ojt_readiness(text, text, boolean),
  kafaa_xapi_d_ojt(kafaa_ojt_logs, timestamptz), kafaa_xapi_source_rows(), kafaa_ojt_emit() from public, anon, authenticated;
revoke execute on function kafaa_microcred_eligibility(text, text), kafaa_award_microcred(text), kafaa_decide_microcred_award(text, text, text), kafaa_revoke_microcred(text, text),
  kafaa_verify_microcred(text), kafaa_save_microcred_def(jsonb), kafaa_set_microcred_def_status(text, text, text), kafaa_microcred_sweep(), kafaa_microcred_stats(),
  kafaa_log_practice(jsonb), kafaa_ack_practice(jsonb), kafaa_request_evaluation(text, text, text), kafaa_close_evaluation_request(text, text, text), kafaa_ojt_preceptors(text) from public, anon;
grant execute on function kafaa_microcred_eligibility(text, text), kafaa_award_microcred(text), kafaa_decide_microcred_award(text, text, text), kafaa_revoke_microcred(text, text),
  kafaa_verify_microcred(text), kafaa_save_microcred_def(jsonb), kafaa_set_microcred_def_status(text, text, text), kafaa_microcred_sweep(), kafaa_microcred_stats(),
  kafaa_log_practice(jsonb), kafaa_ack_practice(jsonb), kafaa_request_evaluation(text, text, text), kafaa_close_evaluation_request(text, text, text), kafaa_ojt_preceptors(text) to authenticated;
grant execute on function kafaa_verify_microcred(text) to anon;
