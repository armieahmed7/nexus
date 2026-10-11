-- [FS wave D · E1 · FS27 + FS28] Future-skills gig channel with a time envelope; future-role rotations and external secondments (M20).
-- FS27: opportunities gain a future-skills `channel` (ADVANCE study support, digital innovation, governed AI pilots, data clean-up, knowledge
--   capture); a person asks once for a time envelope (5-20 % of a 40-hour week for a quarter, kafaa_time_envelopes) and the line manager of
--   record approves once (maker-checker, ledger). Applying to a future gig inside an approved envelope is released at once (no per-gig release)
--   while the envelope's live gigs plus this one stay within its weekly hours (kafaa_fs27_envelope_fit = envelopeFit); completion writes
--   evidence through the unchanged F08 kafaa_complete_opportunity. kafaa_post_opportunity / kafaa_apply_opportunity are redefined with the
--   same signatures (F08 behaviour unchanged for gigs without a channel).
-- FS28: rotation templates gain a future track and target concept roles (ADVANCE study is career-level only); kafaa_secondments holds
--   outbound secondments (host, objectives, duration, host supervisor role) and closing on return creates a knowledge-capture session in
--   M24 (kafaa_capture_sessions, SECURITY DEFINER) due within 60 days. Security, cyber and safeguards placements are refused everywhere.
-- Rules: src/modules/m20/futureGigs.ts, src/modules/m20/secondment.ts. LocalBackend: src/modules/m20/backend/{local,fs27.local}.ts.
-- PGlite parity and checks: scripts/validate/fs41-future-gigs.mjs.
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.

-- ───────────── Columns on M20 tables (additive)
alter table kafaa_opportunities add column if not exists channel text check (channel in ('advance_study', 'digital_innovation', 'ai_pilot', 'data_cleanup', 'knowledge_capture'));
alter table kafaa_opportunity_applications add column if not exists envelope_id text;
alter table kafaa_rotation_templates add column if not exists future_track text check (future_track in ('digital_twin', 'data_office', 'advance_study', 'energy_transition'));
alter table kafaa_rotation_templates add column if not exists future_role_ids text[] not null default '{}'::text[];
alter table kafaa_rotation_templates add column if not exists career_level_only boolean not null default false;
create index if not exists kafaa_opportunities_channel_idx on kafaa_opportunities (channel);
create index if not exists kafaa_opportunity_applications_envelope_id_idx on kafaa_opportunity_applications (envelope_id);
create index if not exists kafaa_rotation_templates_future_track_idx on kafaa_rotation_templates (future_track);

-- ───────────── Tables (generated DDL, additive)
-- M20 · Time envelope: a share of working time for future-skills gigs in a quarter, approved once by the line manager (FS27)
create table if not exists kafaa_time_envelopes (
  id text primary key,
  person_id text not null,
  line_manager_id text,
  approver_id text,
  pct integer not null,
  cap_hours integer not null,
  period text not null,
  starts_on date not null,
  ends_on date not null,
  channels text[] not null default '{}'::text[],
  reason text not null default '',
  status text not null default 'requested' check (status in ('requested', 'approved', 'declined', 'withdrawn')),
  decision_note text,
  decided_at timestamptz,
  person_name text not null default '',
  person_name_ar text not null default '',
  person_role_id text,
  person_family_id text,
  history jsonb not null default '[]'::jsonb,
  open_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table kafaa_time_envelopes is '[M20] Time envelope: a share of working time for future-skills gigs in a quarter, approved once by the line manager (FS27)';

-- M20 · External secondment: host, objectives, duration, host supervisor role and a return-and-transfer obligation (FS28)
create table if not exists kafaa_secondments (
  id text primary key,
  person_id text not null,
  host_kind text not null check (host_kind in ('iaea', 'partner_utility', 'vendor', 'university', 'research_centre')),
  host_org_id text,
  host_name_en text not null,
  host_name_ar text not null,
  host_country text not null,
  supervisor_en text not null,
  supervisor_ar text not null,
  objectives jsonb not null default '[]'::jsonb,
  future_role_id text,
  track text check (track in ('digital_twin', 'data_office', 'advance_study', 'energy_transition')),
  start_on date not null,
  end_on date not null,
  months integer not null,
  line_manager_id text,
  planned_by text not null,
  status text not null default 'planned' check (status in ('planned', 'returned', 'cancelled')),
  returned_on date,
  closed_by text,
  closed_at timestamptz,
  outcome_note text,
  objectives_met jsonb not null default '{}'::jsonb,
  transfer_due_on date,
  capture_session_id text,
  person_name text not null default '',
  person_name_ar text not null default '',
  person_role_id text,
  person_family_id text,
  history jsonb not null default '[]'::jsonb,
  open_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table kafaa_secondments is '[M20] External secondment: host, objectives, duration, host supervisor role and a return-and-transfer obligation (FS28)';

-- Foreign keys and indexes
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_time_envelopes_person_id_fk') then alter table kafaa_time_envelopes add constraint kafaa_time_envelopes_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_time_envelopes_line_manager_id_fk') then alter table kafaa_time_envelopes add constraint kafaa_time_envelopes_line_manager_id_fk foreign key (line_manager_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_time_envelopes_approver_id_fk') then alter table kafaa_time_envelopes add constraint kafaa_time_envelopes_approver_id_fk foreign key (approver_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_secondments_person_id_fk') then alter table kafaa_secondments add constraint kafaa_secondments_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_secondments_host_org_id_fk') then alter table kafaa_secondments add constraint kafaa_secondments_host_org_id_fk foreign key (host_org_id) references kafaa_organisations(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_secondments_future_role_id_fk') then alter table kafaa_secondments add constraint kafaa_secondments_future_role_id_fk foreign key (future_role_id) references kafaa_job_roles(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_secondments_line_manager_id_fk') then alter table kafaa_secondments add constraint kafaa_secondments_line_manager_id_fk foreign key (line_manager_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_secondments_planned_by_fk') then alter table kafaa_secondments add constraint kafaa_secondments_planned_by_fk foreign key (planned_by) references kafaa_people(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_time_envelopes_person_id_idx on kafaa_time_envelopes (person_id);
create index if not exists kafaa_time_envelopes_line_manager_id_idx on kafaa_time_envelopes (line_manager_id);
create index if not exists kafaa_time_envelopes_approver_id_idx on kafaa_time_envelopes (approver_id);
create index if not exists kafaa_time_envelopes_period_idx on kafaa_time_envelopes (period);
create index if not exists kafaa_time_envelopes_status_idx on kafaa_time_envelopes (status);
create index if not exists kafaa_secondments_person_id_idx on kafaa_secondments (person_id);
create index if not exists kafaa_secondments_host_kind_idx on kafaa_secondments (host_kind);
create index if not exists kafaa_secondments_host_org_id_idx on kafaa_secondments (host_org_id);
create index if not exists kafaa_secondments_future_role_id_idx on kafaa_secondments (future_role_id);
create index if not exists kafaa_secondments_line_manager_id_idx on kafaa_secondments (line_manager_id);
create index if not exists kafaa_secondments_planned_by_idx on kafaa_secondments (planned_by);
create index if not exists kafaa_secondments_status_idx on kafaa_secondments (status);

-- ───────────── RLS (generated rules; policies created once, never dropped)
do $$ begin
  execute 'alter table kafaa_time_envelopes enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_time_envelopes' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_time_envelopes for select to anon, authenticated using (kafaa_rule_read(''opportunities'', person_id, null::text, open_read)
    or kafaa_rule_read(''opportunities'', line_manager_id, null::text, open_read)
    or kafaa_rule_read(''audit_log'', null::text, null::text, true))'; end if;
  execute 'alter table kafaa_secondments enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_secondments' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_secondments for select to anon, authenticated using (kafaa_rule_read(''opportunities'', person_id, null::text, open_read)
    or kafaa_rule_read(''opportunities'', line_manager_id, null::text, open_read)
    or kafaa_rule_read(''audit_log'', null::text, null::text, true))'; end if;
end $$;
revoke insert, update, delete on kafaa_time_envelopes, kafaa_secondments from anon, authenticated;
grant select on kafaa_time_envelopes, kafaa_secondments to anon, authenticated;

-- ───────────── Shared helpers (mirror of src/modules/m20/futureGigs.ts)
create or replace function kafaa_fs27_len(p jsonb) returns integer language sql immutable set search_path = public as $$
  select case when jsonb_typeof(p) = 'string' then length(btrim(p #>> '{}', E' \t\n\r')) else -1 end
$$;
create or replace function kafaa_fs27_is_date(p text) returns boolean language plpgsql immutable set search_path = public as $$
begin
  if p is null or p !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
  return to_char(p::date, 'YYYY-MM-DD') = p;
exception when others then return false;
end $$;
create or replace function kafaa_fs27_quarter(p_d date) returns text language sql immutable set search_path = public as $$
  select to_char(p_d, 'YYYY') || '-Q' || ((extract(month from p_d)::integer - 1) / 3 + 1)::text
$$;
-- First and last day of a quarter like '2026-Q4'; null when the text is not a quarter.
create or replace function kafaa_fs27_bounds(p_period text) returns date[] language plpgsql immutable set search_path = public as $$
declare y integer; q integer; s date;
begin
  if p_period is null or p_period !~ '^\d{4}-Q[1-4]$' then return null; end if;
  y := substr(p_period, 1, 4)::integer; q := substr(p_period, 7, 1)::integer;
  s := make_date(y, (q - 1) * 3 + 1, 1);
  return array[s, (s + interval '3 months')::date - 1];
end $$;
create or replace function kafaa_fs27_open_periods(p_today date) returns text[] language sql immutable set search_path = public as $$
  select array[kafaa_fs27_quarter(p_today), kafaa_fs27_quarter((kafaa_fs27_bounds(kafaa_fs27_quarter(p_today)))[2] + 1)]
$$;

-- Envelope request content checks (validateEnvelope). Returns {code, message} or null.
create or replace function kafaa_fs27_validate_envelope(p jsonb, p_today date) returns jsonb language plpgsql stable set search_path = public as $$
declare bad constant jsonb := '{"code":"invalid"}'::jsonb; ch jsonb := p->'channels'; n integer;
begin
  if not (case when jsonb_typeof(p->'pct') = 'number' then (p->>'pct')::numeric in (5, 10, 15, 20) else false end) then return bad || '{"message":"Choose 5, 10, 15 or 20 % of your working time"}'; end if;
  if not (coalesce(p->>'period', '') = any(kafaa_fs27_open_periods(p_today))) then return bad || '{"message":"Choose this quarter or the next one"}'; end if;
  n := case when jsonb_typeof(ch) = 'array' then jsonb_array_length(ch) else -1 end;
  if n < 1 or n > 5 or (select count(distinct x) from jsonb_array_elements_text(ch) x) <> n
     or exists (select 1 from jsonb_array_elements(ch) x where coalesce(x #>> '{}', '') not in ('advance_study', 'digital_innovation', 'ai_pilot', 'data_cleanup', 'knowledge_capture')) then
    return bad || '{"message":"Choose one or more of the five future-skills channels"}';
  end if;
  if (case when jsonb_typeof(p->'reason') = 'string' then kafaa_fs27_len(p->'reason') else 0 end) not between 10 and 400 then return bad || '{"message":"Say in a sentence why you want the time (10 to 400 characters)"}'; end if;
  return null;
end $$;

-- Posting rule (channelProblem): a known channel and at least one current future skill gained.
create or replace function kafaa_fs27_channel_problem(p_channel text, p_gained text[]) returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if p_channel is null or p_channel = '' then return null; end if;
  if p_channel not in ('advance_study', 'digital_innovation', 'ai_pilot', 'data_cleanup', 'knowledge_capture') then return '{"code":"invalid","message":"Unknown future-skills channel"}'::jsonb; end if;
  if not exists (select 1 from kafaa_skills s where s.id = any(coalesce(p_gained, '{}'::text[])) and s.fs_area is not null and s.lifecycle <> 'obsolete') then
    return '{"code":"invalid","message":"A future-skills gig must grow at least one future skill from the catalogue"}'::jsonb;
  end if;
  return null;
end $$;

-- Does applying to this gig skip the per-gig release (envelopeFit)? {code, fits, envelope_id, used, cap, after}
create or replace function kafaa_fs27_envelope_fit(p_person text, p_opp text, p_today date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare o kafaa_opportunities; e kafaa_time_envelopes; v_used integer; v_first jsonb;
begin
  select * into o from kafaa_opportunities where id = p_opp;
  if o.id is null or o.channel is null then
    return jsonb_build_object('code', 'not_future', 'fits', false, 'envelope_id', null, 'used', 0, 'cap', 0, 'after', coalesce(o.hours_week, 0));
  end if;
  for e in select * from kafaa_time_envelopes t
            where t.person_id = p_person and t.status = 'approved' and t.ends_on >= p_today and o.channel = any(t.channels) and o.start_on <= t.ends_on and o.end_on >= t.starts_on
            order by t.starts_on, t.id collate "C" loop
    select coalesce(sum(g.hours_week), 0)::integer into v_used from kafaa_opportunity_applications a join kafaa_opportunities g on g.id = a.opportunity_id
     where a.envelope_id = e.id and a.status in ('applied', 'released', 'selected');
    if e.approver_id = o.posted_by then
      v_first := coalesce(v_first, jsonb_build_object('code', 'poster_is_approver', 'fits', false, 'envelope_id', e.id, 'used', v_used, 'cap', e.cap_hours, 'after', v_used + o.hours_week));
      continue;
    end if;
    if v_used + o.hours_week <= e.cap_hours then
      return jsonb_build_object('code', 'fits', 'fits', true, 'envelope_id', e.id, 'used', v_used, 'cap', e.cap_hours, 'after', v_used + o.hours_week);
    end if;
    v_first := coalesce(v_first, jsonb_build_object('code', 'over_limit', 'fits', false, 'envelope_id', e.id, 'used', v_used, 'cap', e.cap_hours, 'after', v_used + o.hours_week));
  end loop;
  return coalesce(v_first, jsonb_build_object('code', 'no_envelope', 'fits', false, 'envelope_id', null, 'used', 0, 'cap', 0, 'after', o.hours_week));
end $$;

create or replace function kafaa_fs27_env_visible(e kafaa_time_envelopes) returns boolean language sql stable security definer set search_path = public as $$
  select (kafaa_me() in (e.person_id, e.line_manager_id) and kafaa_has_grant('opportunities', array['Own','Scope']))
      or kafaa_has_grant('audit_log', array['R','W','A'])
$$;
create or replace function kafaa_fs27_hist(p_status text, p_note text) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'status', p_status, 'by', kafaa_me(), 'note', nullif(btrim(coalesce(p_note, ''), E' \t\n\r'), ''))
$$;

-- HR aggregates (computeFutureStats): open gigs per channel, envelopes, applications through envelopes (people suppressed below 10).
create or replace function kafaa_fs27_stats_compute() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_open integer; v_open_f integer; v_env_people integer; v_env_sup boolean; v_via_people integer; v_via_sup boolean; v_ev integer; v_avg numeric;
begin
  select count(*) into v_open from kafaa_opportunities where status = 'open';
  select count(*) into v_open_f from kafaa_opportunities where status = 'open' and channel is not null;
  select count(distinct person_id), avg(pct) into v_env_people, v_avg from kafaa_time_envelopes where status = 'approved';
  v_env_sup := v_env_people < 10;
  select count(distinct person_id) into v_via_people from kafaa_opportunity_applications where envelope_id is not null and status <> 'withdrawn';
  v_via_sup := v_via_people < 10;
  select count(*) into v_ev from kafaa_skill_evidence e
   where e.kind = 'ojt' and e.ref_table = 'opportunity_applications' and e.active
     and exists (select 1 from kafaa_opportunity_applications a join kafaa_opportunities o on o.id = a.opportunity_id where a.id = e.ref_id and o.channel is not null);
  return jsonb_build_object(
    'channels', (select jsonb_agg(jsonb_build_object('channel', c.ch, 'open', (select count(*) from kafaa_opportunities o where o.status = 'open' and o.channel = c.ch),
                   'total', (select count(*) from kafaa_opportunities o where o.channel = c.ch and o.status <> 'draft')) order by c.ord)
                   from unnest(array['advance_study', 'digital_innovation', 'ai_pilot', 'data_cleanup', 'knowledge_capture']) with ordinality as c(ch, ord)),
    'open_future', v_open_f, 'open_all', v_open,
    'share_open_future', case when v_open > 0 then round(v_open_f::numeric / v_open, 3) else 0 end,
    'envelopes', jsonb_build_object(
      'requested', (select count(*) from kafaa_time_envelopes where status = 'requested'), 'approved', (select count(*) from kafaa_time_envelopes where status = 'approved'),
      'declined', (select count(*) from kafaa_time_envelopes where status = 'declined'), 'withdrawn', (select count(*) from kafaa_time_envelopes where status = 'withdrawn'),
      'people', case when v_env_sup then null else v_env_people end, 'avg_pct', case when v_env_sup then null else round(v_avg, 1) end, 'suppressed', v_env_sup),
    'via_envelope', jsonb_build_object(
      'applications', case when v_via_sup then null else (select count(*) from kafaa_opportunity_applications where envelope_id is not null and status <> 'withdrawn') end,
      'selected', case when v_via_sup then null else (select count(*) from kafaa_opportunity_applications where envelope_id is not null and status in ('selected', 'completed')) end,
      'completed', case when v_via_sup then null else (select count(*) from kafaa_opportunity_applications where envelope_id is not null and status = 'completed') end,
      'people', case when v_via_sup then null else v_via_people end, 'suppressed', v_via_sup),
    'evidence_rows', v_ev, 'min_group', 10);
end $$;

-- ───────────── RPC: ask for a time envelope (staff, Own). The line manager of record decides.
create or replace function kafaa_request_envelope(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_bad jsonb; v_lm text; pp kafaa_people; v_b date[]; v_id text; v_pct integer; v_reason text; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('envelope.request', 'time_envelopes', null, 'not_signed_in', 'Sign in to use future-skills gigs'); end if;
  v_role := kafaa_acting_role('opportunities', array['Own']);
  if v_role is null then return kafaa_refuse('envelope.request', 'time_envelopes', null, 'forbidden', 'Only staff can ask for a time envelope'); end if;
  v_bad := kafaa_fs27_validate_envelope(p, current_date);
  if v_bad is not null then return kafaa_refuse('envelope.request', 'time_envelopes', null, v_bad->>'code', v_bad->>'message', v_role); end if;
  if exists (select 1 from kafaa_time_envelopes e where e.person_id = me and e.period = p->>'period' and e.status in ('requested', 'approved')) then
    return kafaa_refuse('envelope.request', 'time_envelopes', null, 'conflict', 'You already have a time envelope requested or approved for this quarter', v_role);
  end if;
  v_lm := kafaa_opp_line_manager(me);
  if v_lm is null then return kafaa_refuse('envelope.request', 'time_envelopes', null, 'no_line_manager', 'No line manager is recorded for you; ask HR to update your record', v_role); end if;
  select * into pp from kafaa_people where id = me;
  v_b := kafaa_fs27_bounds(p->>'period');
  v_pct := (p->>'pct')::numeric::integer;
  v_reason := btrim(p->>'reason', E' \t\n\r');
  v_id := 'env-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 24);
  insert into kafaa_time_envelopes (id, person_id, line_manager_id, approver_id, pct, cap_hours, period, starts_on, ends_on, channels, reason, status, decision_note, decided_at,
    person_name, person_name_ar, person_role_id, person_family_id, history, open_read, created_at, updated_at)
  values (v_id, me, v_lm, null, v_pct, round(v_pct * 40 / 100.0)::integer, p->>'period', v_b[1], v_b[2],
    array(select c from unnest(array['advance_study', 'digital_innovation', 'ai_pilot', 'data_cleanup', 'knowledge_capture']) with ordinality as u(c, o) where c in (select jsonb_array_elements_text(p->'channels')) order by o),
    v_reason, 'requested', null, null, pp.display_name, coalesce(nullif(pp.display_name_ar, ''), pp.display_name), pp.job_role_id, pp.job_family_id,
    jsonb_build_array(kafaa_fs27_hist('requested', v_reason)), false, now(), now());
  perform kafaa_opp_notify('nt-' || v_id || '-requested', v_lm, format('Time envelope request: %s (%s%% in %s)', pp.display_name, v_pct, p->>'period'),
    format('طلب وقت مخصص: %s (%s%% في %s)', coalesce(nullif(pp.display_name_ar, ''), pp.display_name), v_pct, p->>'period'), '/opportunities/envelopes', 'info');
  a := kafaa_audit('envelope.request', 'time_envelopes', v_id, 'ok', format('%s%% %s -> %s', v_pct, p->>'period', v_lm), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Time envelope sent to your line manager', a, null, jsonb_build_object('id', v_id, 'status', 'requested', 'line_manager_id', v_lm, 'cap_hours', round(v_pct * 40 / 100.0)::integer));
end $$;

-- ───────────── RPC: the line manager approves (ledger) or declines; the person withdraws. Maker-checker: never the person.
create or replace function kafaa_approve_envelope(p_id text, p_decision text, p_note text default '') returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); e kafaa_time_envelopes; v_role text; v_note text := btrim(coalesce(p_note, ''), E' \t\n\r'); v_status text; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('envelope.decide', 'time_envelopes', p_id, 'not_signed_in', 'Sign in to use future-skills gigs'); end if;
  select * into e from kafaa_time_envelopes where id = p_id;
  if e.id is null or not kafaa_fs27_env_visible(e) then return kafaa_refuse('envelope.decide', 'time_envelopes', p_id, 'not_found', 'Time envelope not found'); end if;
  v_role := kafaa_acting_role('opportunities', array['A','Own']);
  if p_decision is null or p_decision not in ('approve', 'decline', 'withdraw') then return kafaa_refuse('envelope.decide', 'time_envelopes', p_id, 'invalid', 'Unknown decision', v_role); end if;
  if p_decision = 'withdraw' then
    if e.person_id <> me then return kafaa_refuse('envelope.decide', 'time_envelopes', p_id, 'forbidden', 'Only the person who asked can withdraw a time envelope', v_role); end if;
    if e.status not in ('requested', 'approved') then return kafaa_refuse('envelope.decide', 'time_envelopes', p_id, 'invalid', 'This time envelope can no longer be withdrawn', v_role); end if;
    update kafaa_time_envelopes set status = 'withdrawn', history = history || jsonb_build_array(kafaa_fs27_hist('withdrawn', v_note)), updated_at = now() where id = p_id;
    a := kafaa_audit('envelope.decide', 'time_envelopes', p_id, 'ok', e.status || ' -> withdrawn', 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Time envelope withdrawn', a, null, jsonb_build_object('status', 'withdrawn'));
  end if;
  if e.person_id = me then return kafaa_refuse('envelope.decide', 'time_envelopes', p_id, 'maker_checker', 'You cannot approve your own time envelope', v_role); end if;
  if e.line_manager_id is distinct from me then return kafaa_refuse('envelope.decide', 'time_envelopes', p_id, 'forbidden', 'Only your line manager approves your time envelope', v_role); end if;
  if e.status <> 'requested' then return kafaa_refuse('envelope.decide', 'time_envelopes', p_id, 'invalid', 'This time envelope is not waiting for a decision', v_role); end if;
  if p_decision = 'decline' and length(v_note) < 5 then return kafaa_refuse('envelope.decide', 'time_envelopes', p_id, 'invalid', 'Give a reason when you decline', v_role); end if;
  v_status := case when p_decision = 'approve' then 'approved' else 'declined' end;
  update kafaa_time_envelopes set status = v_status, approver_id = case when p_decision = 'approve' then me end, decision_note = nullif(v_note, ''), decided_at = now(),
    history = history || jsonb_build_array(kafaa_fs27_hist(v_status, v_note)), updated_at = now() where id = p_id;
  perform kafaa_opp_notify('nt-' || p_id || '-' || v_status, e.person_id,
    case when v_status = 'approved' then format('Time envelope approved: %s%% in %s', e.pct, e.period) else 'Time envelope declined: ' || e.period end,
    case when v_status = 'approved' then format('تمت الموافقة على الوقت المخصص: %s%% في %s', e.pct, e.period) else 'رُفض الوقت المخصص: ' || e.period end,
    '/opportunities/envelope', case when v_status = 'approved' then 'ok' else 'warn' end);
  if v_status = 'approved' then l := kafaa_ledger('kafaa.envelope.approve', format('Time envelope %s (%s%% %s) approved for %s', p_id, e.pct, e.period, e.person_id)); end if;
  a := kafaa_audit('envelope.decide', 'time_envelopes', p_id, 'ok', 'requested -> ' || v_status, case when v_status <> 'approved' then 'not_applicable' when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when v_status = 'approved' then 'Time envelope approved' else 'Time envelope declined' end, a, l, jsonb_build_object('status', v_status));
end $$;

create or replace function kafaa_future_gig_stats() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if kafaa_me() is null or not (kafaa_has_grant('opportunities', array['Agg','A']) or kafaa_has_grant('audit_log', array['R'])) then return null; end if;
  return kafaa_fs27_stats_compute();
end $$;

-- ───────────── F08 RPCs redefined for FS27 (same signatures; F08 behaviour unchanged for gigs without a channel)
-- post: the channel check after the F08 content checks; the channel is stored.
create or replace function kafaa_post_opportunity(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_bad jsonb; v_id text; v_status text := coalesce(p->>'status', 'open'); pp kafaa_people; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('opportunity.post', 'opportunities', null, 'not_signed_in', 'Sign in to post an opportunity'); end if;
  v_role := kafaa_acting_role('opportunities', array['W','A']);
  if v_role is null then return kafaa_refuse('opportunity.post', 'opportunities', null, 'forbidden', 'Only managers and the training manager may post opportunities'); end if;
  v_bad := kafaa_opp_validate(p, current_date);
  if v_bad is not null then return kafaa_refuse('opportunity.post', 'opportunities', null, v_bad->>'code', v_bad->>'message', v_role); end if;
  v_bad := kafaa_fs27_channel_problem(p->>'channel', array(select jsonb_array_elements_text(p->'skills_gained')));
  if v_bad is not null then return kafaa_refuse('opportunity.post', 'opportunities', null, v_bad->>'code', v_bad->>'message', v_role); end if;
  select * into pp from kafaa_people where id = me;
  v_id := 'opp-' || replace(gen_random_uuid()::text, '-', '');
  insert into kafaa_opportunities (id, posted_by, org_id, family_id, host_role_id, host_team, kind, title_en, title_ar, summary_en, summary_ar, skills_needed, skills_gained,
    hours_week, start_on, end_on, seats, seats_taken, location_type, eligible_families, priority_flags, status, listed, created_at, updated_at, channel)
  values (v_id, me, pp.org_id, pp.job_family_id, pp.job_role_id, pp.team_id, p->>'kind', btrim(p->>'title_en'), btrim(p->>'title_ar'), btrim(p->>'summary_en'), btrim(p->>'summary_ar'),
    array(select jsonb_array_elements_text(coalesce(nullif(p->'skills_needed', 'null'::jsonb), '[]'::jsonb))), array(select jsonb_array_elements_text(p->'skills_gained')),
    (p->>'hours_week')::numeric::integer, (p->>'start_on')::date, (p->>'end_on')::date, (p->>'seats')::numeric::integer, 0, p->>'location_type',
    array(select jsonb_array_elements_text(case when jsonb_typeof(p->'eligible_families') = 'array' then p->'eligible_families' else '[]'::jsonb end)),
    array(select jsonb_array_elements_text(case when jsonb_typeof(p->'priority_flags') = 'array' then p->'priority_flags' else '[]'::jsonb end)),
    v_status, v_status <> 'draft', now(), now(), nullif(p->>'channel', ''));
  a := kafaa_audit('opportunity.post', 'opportunities', v_id, 'ok', (p->>'kind') || ' ' || v_status, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when v_status = 'draft' then 'Draft saved' else 'Opportunity posted' end, a, null, jsonb_build_object('id', v_id, 'status', v_status));
end $$;

-- apply: inside an approved time envelope the per-gig release is skipped (released at once by the envelope's approver).
create or replace function kafaa_apply_opportunity(p_opportunity_id text, p_note text default '') returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; o kafaa_opportunities; pp kafaa_people; v_note text := btrim(coalesce(p_note, '')); v_lm text; v_skip_mgr text; v_rel text; v_skip boolean; v_id text; a kafaa_audit_events;
  v_fit jsonb; e kafaa_time_envelopes;
begin
  if me is null then return kafaa_refuse('opportunity.apply', 'opportunities', p_opportunity_id, 'not_signed_in', 'Sign in to use the opportunity marketplace'); end if;
  v_role := kafaa_acting_role('opportunities', array['Own']);
  if v_role is null then return kafaa_refuse('opportunity.apply', 'opportunities', p_opportunity_id, 'forbidden', 'Only staff may apply for opportunities'); end if;
  select * into o from kafaa_opportunities where id = p_opportunity_id;
  if o.id is null or not kafaa_opp_visible(o) then return kafaa_refuse('opportunity.apply', 'opportunities', p_opportunity_id, 'not_found', 'Opportunity not found', v_role); end if;
  if o.status <> 'open' then return kafaa_refuse('opportunity.apply', 'opportunities', p_opportunity_id, 'invalid', 'This opportunity is not open for applications', v_role); end if;
  if o.posted_by = me then return kafaa_refuse('opportunity.apply', 'opportunities', p_opportunity_id, 'conflict', 'You cannot apply to your own opportunity', v_role); end if;
  select * into pp from kafaa_people where id = me;
  if cardinality(o.eligible_families) > 0 and not (coalesce(pp.job_family_id, '') = any(o.eligible_families)) then
    return kafaa_refuse('opportunity.apply', 'opportunities', p_opportunity_id, 'not_eligible', 'This opportunity is open to other job families', v_role);
  end if;
  if exists (select 1 from kafaa_opportunity_applications x where x.opportunity_id = p_opportunity_id and x.person_id = me and x.status in ('applied', 'released', 'selected', 'completed')) then
    return kafaa_refuse('opportunity.apply', 'opportunities', p_opportunity_id, 'conflict', 'You already have an application for this opportunity', v_role);
  end if;
  if length(v_note) > 500 then return kafaa_refuse('opportunity.apply', 'opportunities', p_opportunity_id, 'invalid', 'Keep your note under 500 characters', v_role); end if;
  v_lm := kafaa_opp_line_manager(me);
  if v_lm is not null and v_lm <> o.posted_by then v_rel := v_lm; v_skip := false;
  else
    v_skip := v_lm is not null;
    v_skip_mgr := case when v_lm is not null then kafaa_opp_line_manager(o.posted_by) end;
    v_rel := case when v_skip_mgr is not null and v_skip_mgr <> me then v_skip_mgr end;
  end if;
  if v_rel is null then return kafaa_refuse('opportunity.apply', 'opportunities', p_opportunity_id, 'no_line_manager', 'No line manager is recorded for you; ask HR to update your record', v_role); end if;
  v_id := 'oa-' || replace(gen_random_uuid()::text, '-', '');
  v_fit := kafaa_fs27_envelope_fit(me, p_opportunity_id, current_date);
  if (v_fit->>'fits')::boolean then select * into e from kafaa_time_envelopes where id = v_fit->>'envelope_id'; end if;
  if e.id is not null then
    insert into kafaa_opportunity_applications (id, opportunity_id, person_id, note, status, history, applicant_name, applicant_name_ar, applicant_role_id, applicant_family_id,
      poster_id, line_manager_id, releaser_id, skip_level, outcome_levels, evidence_ids, open_read, created_at, updated_at, released_by, released_at, envelope_id)
    values (v_id, p_opportunity_id, me, v_note, 'released',
      jsonb_build_array(kafaa_opp_hist('applied', v_note), jsonb_build_object('at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'status', 'released', 'by', e.approver_id,
        'note', format('Within the approved time envelope %s (%s%%)', e.period, e.pct))),
      pp.display_name, coalesce(nullif(pp.display_name_ar, ''), pp.display_name), pp.job_role_id, pp.job_family_id, o.posted_by, v_lm, v_rel, v_skip, '{}'::jsonb, '{}'::text[], false, now(), now(),
      e.approver_id, now(), e.id);
    perform kafaa_opp_notify('nt-' || v_id || '-released', o.posted_by, 'Applicant released (time envelope): ' || o.title_en, 'تم الإفراج عن متقدّم (وقت مخصص): ' || o.title_ar, '/opportunities/manage', 'info');
    perform kafaa_opp_notify('nt-' || v_id || '-envelope', e.approver_id, format('Time envelope used: %s joined %s', pp.display_name, o.title_en),
      format('استُخدم الوقت المخصص: %s انضم إلى %s', coalesce(nullif(pp.display_name_ar, ''), pp.display_name), o.title_ar), '/opportunities/envelopes', 'info');
    a := kafaa_audit('opportunity.apply', 'opportunity_applications', v_id, 'ok', p_opportunity_id || ' -> released within envelope ' || e.id, 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Application released within your approved time envelope', a, null, jsonb_build_object('id', v_id, 'releaser_id', v_rel, 'skip_level', v_skip, 'envelope_id', e.id));
  end if;
  insert into kafaa_opportunity_applications (id, opportunity_id, person_id, note, status, history, applicant_name, applicant_name_ar, applicant_role_id, applicant_family_id,
    poster_id, line_manager_id, releaser_id, skip_level, outcome_levels, evidence_ids, open_read, created_at, updated_at)
  values (v_id, p_opportunity_id, me, v_note, 'applied', jsonb_build_array(kafaa_opp_hist('applied', v_note)), pp.display_name, coalesce(nullif(pp.display_name_ar, ''), pp.display_name),
    pp.job_role_id, pp.job_family_id, o.posted_by, v_lm, v_rel, v_skip, '{}'::jsonb, '{}'::text[], false, now(), now());
  perform kafaa_opp_notify('nt-' || v_id || '-applied', v_rel, 'Release request: ' || o.title_en, 'طلب إفراج: ' || o.title_ar, '/opportunities/manage', 'info');
  a := kafaa_audit('opportunity.apply', 'opportunity_applications', v_id, 'ok', p_opportunity_id || ' -> release by ' || v_rel || case when v_skip then ' (skip level)' else '' end, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Application sent to your line manager for release', a, null, jsonb_build_object('id', v_id, 'releaser_id', v_rel, 'skip_level', v_skip, 'envelope_id', null));
end $$;

-- ───────────── FS28 helpers (mirror of src/modules/m20/secondment.ts)
create or replace function kafaa_fs28_validate_tag(p jsonb) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare ids jsonb := p->'future_role_ids'; n integer;
begin
  if jsonb_typeof(ids) = 'array' and exists (select 1 from jsonb_array_elements(ids) x join kafaa_job_roles r on r.id = (x #>> '{}') where coalesce(r.family_id, '') in ('security', 'cyber', 'safeguards')) then
    return '{"code":"restricted_kind","message":"Security, cyber and safeguards work is career-path only and is never offered as a secondment or rotation"}'::jsonb;
  end if;
  if p->>'track' is not null and p->>'track' not in ('digital_twin', 'data_office', 'advance_study', 'energy_transition') then return '{"code":"invalid","message":"Unknown future track"}'::jsonb; end if;
  n := case when jsonb_typeof(ids) = 'array' then jsonb_array_length(ids) else -1 end;
  if n < 0 or n > 4 or (select count(distinct x) from jsonb_array_elements(ids) x) <> n
     or exists (select 1 from jsonb_array_elements(ids) x where jsonb_typeof(x) <> 'string' or not exists (select 1 from kafaa_job_roles r where r.id = (x #>> '{}') and coalesce(r.lifecycle, 'current') in ('current', 'concept'))) then
    return '{"code":"invalid","message":"Choose up to four current or concept roles (never security, cyber or safeguards roles)"}'::jsonb;
  end if;
  return null;
end $$;

create or replace function kafaa_fs28_validate_secondment(p jsonb, p_today date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pp kafaa_people; r kafaa_job_roles; objs jsonb := p->'objectives'; n integer; bad constant jsonb := '{"code":"invalid"}'::jsonb;
begin
  select * into pp from kafaa_people where id = p->>'person_id';
  if coalesce(p->>'future_role_id', '') <> '' then select * into r from kafaa_job_roles where id = p->>'future_role_id'; end if;
  if coalesce(pp.job_family_id, '') in ('security', 'cyber', 'safeguards') or coalesce(r.family_id, '') in ('security', 'cyber', 'safeguards')
     or (jsonb_typeof(objs) = 'array' and exists (select 1 from jsonb_array_elements(objs) o join kafaa_skills s on s.id = (case when jsonb_typeof(o) = 'object' then o->>'skill_id' end) where s.area = 'security')) then
    return '{"code":"restricted_kind","message":"Security, cyber and safeguards work is career-path only and is never offered as a secondment or rotation"}'::jsonb;
  end if;
  if pp.id is null or pp.kind <> 'staff' or pp.status <> 'active' then return '{"code":"not_found","message":"Person not found"}'::jsonb; end if;
  if coalesce(p->>'host_kind', '') not in ('iaea', 'partner_utility', 'vendor', 'university', 'research_centre') then return bad || '{"message":"Choose the IAEA, a partner utility, a vendor, a university or a research centre"}'; end if;
  if kafaa_fs27_len(p->'host_name_en') not between 3 and 120 or kafaa_fs27_len(p->'host_name_ar') not between 3 and 120
     or jsonb_typeof(p->'host_country') is distinct from 'string' or (p->>'host_country') !~ '^[A-Z]{2}$' then
    return bad || '{"message":"Give the host in English and Arabic (3 to 120 characters) and a two-letter country code"}';
  end if;
  if kafaa_fs27_len(p->'supervisor_en') not between 3 and 120 or kafaa_fs27_len(p->'supervisor_ar') not between 3 and 120 then
    return bad || '{"message":"Name the host supervisor by role in English and Arabic (3 to 120 characters), never by name"}';
  end if;
  n := case when jsonb_typeof(objs) = 'array' then jsonb_array_length(objs) else -1 end;
  if n < 1 or n > 5 or (select count(distinct (case when jsonb_typeof(o) = 'object' then o->>'skill_id' end)) from jsonb_array_elements(objs) o) <> n
     or exists (select 1 from jsonb_array_elements(objs) o where jsonb_typeof(o) <> 'object' or not exists (select 1 from kafaa_skills s where s.id = o->>'skill_id')
        or jsonb_typeof(o->'level') is distinct from 'number' or (o->>'level')::numeric <> trunc((o->>'level')::numeric) or (o->>'level')::numeric not between 1 and 3
        or kafaa_fs27_len(o->'text_en') not between 5 and 200 or kafaa_fs27_len(o->'text_ar') not between 5 and 200) then
    return bad || '{"message":"Give one to five objectives, each tied to a catalogue skill at level 1 to 3, in English and Arabic (5 to 200 characters)"}';
  end if;
  if jsonb_typeof(p->'start_on') is distinct from 'string' or not kafaa_fs27_is_date(p->>'start_on') or (p->>'start_on')::date < p_today or (p->>'start_on')::date > p_today + 365
     or jsonb_typeof(p->'months') is distinct from 'number' or (p->>'months')::numeric <> trunc((p->>'months')::numeric) or (p->>'months')::numeric not between 1 and 24 then
    return bad || '{"message":"Start between today and twelve months from now, for 1 to 24 months"}';
  end if;
  if coalesce(p->>'host_org_id', '') <> '' and not exists (select 1 from kafaa_organisations g where g.id = p->>'host_org_id') then return bad || '{"message":"Unknown host organisation"}'; end if;
  if coalesce(p->>'future_role_id', '') <> '' and (r.id is null or coalesce(r.lifecycle, 'current') not in ('current', 'concept')) then return bad || '{"message":"Choose a current or concept role from the career map"}'; end if;
  if coalesce(p->>'track', '') <> '' and p->>'track' not in ('digital_twin', 'data_office', 'advance_study', 'energy_transition') then return bad || '{"message":"Unknown future track"}'; end if;
  return null;
end $$;

create or replace function kafaa_fs28_validate_close(s kafaa_secondments, p_decision text, p jsonb, p_today date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare bad constant jsonb := '{"code":"invalid"}'::jsonb; v_r date; met jsonb := p->'met';
begin
  if p_decision is null or p_decision not in ('return', 'cancel') then return bad || '{"message":"Unknown decision"}'; end if;
  if s.status <> 'planned' then return bad || '{"message":"This secondment is already closed"}'; end if;
  if p_decision = 'cancel' then
    if kafaa_fs27_len(p->'outcome_note') >= 5 then return null; end if;
    return bad || '{"message":"Give a reason when you cancel"}';
  end if;
  if jsonb_typeof(p->'returned_on') is distinct from 'string' or not kafaa_fs27_is_date(p->>'returned_on') then return bad || '{"message":"Record a return date between the start of the secondment and today, at most 30 days ago"}'; end if;
  v_r := (p->>'returned_on')::date;
  if v_r < s.start_on or v_r > p_today or v_r < p_today - 30 then return bad || '{"message":"Record a return date between the start of the secondment and today, at most 30 days ago"}'; end if;
  if kafaa_fs27_len(p->'outcome_note') not between 10 and 1000 then return bad || '{"message":"Describe the outcome in at least one sentence (10 to 1,000 characters)"}'; end if;
  if jsonb_typeof(met) is distinct from 'object'
     or exists (select 1 from jsonb_array_elements(s.objectives) o where jsonb_typeof(met->(o->>'id')) is distinct from 'boolean')
     or exists (select 1 from jsonb_object_keys(met) k where not exists (select 1 from jsonb_array_elements(s.objectives) o where o->>'id' = k)) then
    return bad || '{"message":"Say for every objective whether it was met"}';
  end if;
  return null;
end $$;

create or replace function kafaa_fs28_phase(s kafaa_secondments, p_today date) returns text language sql immutable set search_path = public as $$
  select case when s.status = 'cancelled' then 'cancelled' when s.status = 'returned' then 'returned' when s.start_on > p_today then 'upcoming'
              when s.end_on < p_today then 'return_due' else 'on_secondment' end
$$;
create or replace function kafaa_fs28_transfer(s kafaa_secondments, p_today date) returns text language sql stable security definer set search_path = public as $$
  select case when s.status <> 'returned' or s.transfer_due_on is null then 'none'
              when exists (select 1 from kafaa_capture_sessions c where c.id = s.capture_session_id and c.status in ('held', 'transcribed')) then 'done'
              when p_today > s.transfer_due_on then 'overdue' else 'due' end
$$;
-- secondmentStats: phases, transfer obligation states, host-kind cells and people (suppressed below 10).
create or replace function kafaa_fs28_stats(p_today date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_people integer;
begin
  select count(distinct person_id) into v_people from kafaa_secondments where status <> 'cancelled';
  return jsonb_build_object(
    'total', (select count(*) from kafaa_secondments),
    'by_phase', (select jsonb_build_object('upcoming', count(*) filter (where ph = 'upcoming'), 'on_secondment', count(*) filter (where ph = 'on_secondment'), 'return_due', count(*) filter (where ph = 'return_due'),
                  'returned', count(*) filter (where ph = 'returned'), 'cancelled', count(*) filter (where ph = 'cancelled')) from (select kafaa_fs28_phase(s, p_today) ph from kafaa_secondments s) x),
    'by_host', (select jsonb_agg(jsonb_build_object('host_kind', k.kind, 'n', case when k.n < 10 then null else k.n end, 'suppressed', k.n < 10) order by k.ord)
                  from (select u.kind, u.ord, (select count(*) from kafaa_secondments s where s.status <> 'cancelled' and s.host_kind = u.kind)::integer n
                          from unnest(array['iaea', 'partner_utility', 'vendor', 'university', 'research_centre']) with ordinality as u(kind, ord)) k),
    'transfer', (select jsonb_build_object('none', count(*) filter (where tr = 'none'), 'due', count(*) filter (where tr = 'due'), 'overdue', count(*) filter (where tr = 'overdue'), 'done', count(*) filter (where tr = 'done'))
                  from (select kafaa_fs28_transfer(s, p_today) tr from kafaa_secondments s) y),
    'people', case when v_people < 10 then null else v_people end, 'suppressed', v_people < 10, 'min_group', 10);
end $$;

-- ───────────── RPC: tag a rotation template as a future-role rotation (programme owners)
create or replace function kafaa_tag_future_rotation(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; t kafaa_rotation_templates; v_bad jsonb; v_track text := p->>'track'; v_ids text[]; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('rotation.future.tag', 'rotation_templates', p->>'template_id', 'not_signed_in', 'Sign in to use secondments'); end if;
  v_role := kafaa_rot_owner_role();
  if v_role is null then return kafaa_refuse('rotation.future.tag', 'rotation_templates', p->>'template_id', 'forbidden', 'Only HR programme owners and the training manager manage rotation programmes'); end if;
  select * into t from kafaa_rotation_templates where id = coalesce(p->>'template_id', '');
  if t.id is null then return kafaa_refuse('rotation.future.tag', 'rotation_templates', p->>'template_id', 'not_found', 'Rotation programme not found', v_role); end if;
  if t.owner_id <> me and v_role <> 'training_manager' then return kafaa_refuse('rotation.future.tag', 'rotation_templates', t.id, 'forbidden', 'Only the programme owner or the training manager can change this programme', v_role); end if;
  v_bad := kafaa_fs28_validate_tag(p);
  if v_bad is not null then return kafaa_refuse('rotation.future.tag', 'rotation_templates', t.id, v_bad->>'code', v_bad->>'message', v_role); end if;
  v_ids := array(select jsonb_array_elements_text(p->'future_role_ids'));
  update kafaa_rotation_templates set future_track = v_track, future_role_ids = case when v_track is null then '{}'::text[] else v_ids end,
    career_level_only = coalesce(v_track = 'advance_study', false), updated_at = now() where id = t.id;
  a := kafaa_audit('rotation.future.tag', 'rotation_templates', t.id, 'ok', case when v_track is null then 'future untagged' else 'future ' || v_track || ': ' || array_to_string(v_ids, ',') end, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when v_track is null then 'Future-role tag removed' else 'Marked as a future-role rotation' end, a, null, jsonb_build_object('id', t.id, 'future_track', v_track));
end $$;

-- ───────────── RPC: HR plans an external secondment (ledger)
create or replace function kafaa_plan_secondment(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_bad jsonb; v_start date; v_months integer; v_end date; v_lm text; pp kafaa_people; v_id text; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('secondment.plan', 'secondments', null, 'not_signed_in', 'Sign in to use secondments'); end if;
  v_role := kafaa_res_hr_role();
  if v_role is null then return kafaa_refuse('secondment.plan', 'secondments', null, 'forbidden', 'Only HR (the CHCO office and HR analysts) plans and closes secondments', kafaa_acting_role('opportunities', array['W','A','Own'])); end if;
  v_bad := kafaa_fs28_validate_secondment(p, current_date);
  if v_bad is not null then return kafaa_refuse('secondment.plan', 'secondments', null, v_bad->>'code', v_bad->>'message', v_role); end if;
  v_start := (p->>'start_on')::date; v_months := (p->>'months')::numeric::integer;
  v_end := (v_start + make_interval(months => v_months))::date - 1;
  if exists (select 1 from kafaa_secondments s where s.person_id = p->>'person_id' and s.status = 'planned' and s.start_on <= v_end and s.end_on >= v_start) then
    return kafaa_refuse('secondment.plan', 'secondments', null, 'conflict', 'This person already has a secondment planned for these dates', v_role);
  end if;
  v_lm := kafaa_opp_line_manager(p->>'person_id');
  if v_lm is null then return kafaa_refuse('secondment.plan', 'secondments', null, 'no_line_manager', 'No line manager is recorded for this person; update their record first', v_role); end if;
  select * into pp from kafaa_people where id = p->>'person_id';
  v_id := 'sec-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 24);
  insert into kafaa_secondments (id, person_id, host_kind, host_org_id, host_name_en, host_name_ar, host_country, supervisor_en, supervisor_ar, objectives, future_role_id, track,
    start_on, end_on, months, line_manager_id, planned_by, status, returned_on, closed_by, closed_at, outcome_note, objectives_met, transfer_due_on, capture_session_id,
    person_name, person_name_ar, person_role_id, person_family_id, history, open_read, created_at, updated_at)
  values (v_id, pp.id, p->>'host_kind', nullif(p->>'host_org_id', ''), btrim(p->>'host_name_en', E' \t\n\r'), btrim(p->>'host_name_ar', E' \t\n\r'), p->>'host_country',
    btrim(p->>'supervisor_en', E' \t\n\r'), btrim(p->>'supervisor_ar', E' \t\n\r'),
    (select jsonb_agg(jsonb_build_object('id', 'o' || o.i, 'skill_id', o.v->>'skill_id', 'level', (o.v->>'level')::numeric::integer,
       'text_en', btrim(o.v->>'text_en', E' \t\n\r'), 'text_ar', btrim(o.v->>'text_ar', E' \t\n\r')) order by o.i) from jsonb_array_elements(p->'objectives') with ordinality as o(v, i)),
    nullif(p->>'future_role_id', ''), nullif(p->>'track', ''), v_start, v_end, v_months, v_lm, me, 'planned', null, null, null, null, '{}'::jsonb, null, null,
    pp.display_name, coalesce(nullif(pp.display_name_ar, ''), pp.display_name), pp.job_role_id, pp.job_family_id,
    jsonb_build_array(kafaa_fs27_hist('planned', null)), false, now(), now());
  perform kafaa_opp_notify('nt-' || v_id || '-planned', pp.id, 'Secondment planned: ' || btrim(p->>'host_name_en'), 'تم التخطيط لإعارة: ' || btrim(p->>'host_name_ar'), '/opportunities/secondments', 'ok');
  perform kafaa_opp_notify('nt-' || v_id || '-manager', v_lm, format('Secondment planned for %s: %s', pp.display_name, btrim(p->>'host_name_en')),
    format('تم التخطيط لإعارة %s: %s', coalesce(nullif(pp.display_name_ar, ''), pp.display_name), btrim(p->>'host_name_ar')), '/opportunities/secondments', 'info');
  l := kafaa_ledger('kafaa.secondment.plan', format('Secondment %s planned for %s (%s, %s months)', v_id, pp.id, p->>'host_kind', v_months));
  a := kafaa_audit('secondment.plan', 'secondments', v_id, 'ok', format('%s -> %s %s..%s', pp.id, p->>'host_kind', v_start, v_end), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Secondment planned', a, l, jsonb_build_object('id', v_id, 'end_on', v_end, 'line_manager_id', v_lm));
end $$;

-- ───────────── RPC: HR closes a secondment. Return creates the knowledge-capture session (M24) due within 60 days (ledger); cancel needs a reason.
create or replace function kafaa_close_secondment(p_id text, p_decision text, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; s kafaa_secondments; v_bad jsonb; v_note text; v_ret date; v_due date; v_cs text; ivp kafaa_people; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('secondment.close', 'secondments', p_id, 'not_signed_in', 'Sign in to use secondments'); end if;
  v_role := kafaa_res_hr_role();
  if v_role is null then return kafaa_refuse('secondment.close', 'secondments', p_id, 'forbidden', 'Only HR (the CHCO office and HR analysts) plans and closes secondments', kafaa_acting_role('opportunities', array['W','A','Own'])); end if;
  select * into s from kafaa_secondments where id = p_id;
  if s.id is null then return kafaa_refuse('secondment.close', 'secondments', p_id, 'not_found', 'Secondment not found', v_role); end if;
  v_bad := kafaa_fs28_validate_close(s, p_decision, coalesce(p, '{}'::jsonb), current_date);
  if v_bad is not null then return kafaa_refuse('secondment.close', 'secondments', p_id, v_bad->>'code', v_bad->>'message', v_role); end if;
  v_note := btrim(coalesce(p->>'outcome_note', ''), E' \t\n\r');
  if p_decision = 'cancel' then
    update kafaa_secondments set status = 'cancelled', outcome_note = v_note, closed_by = me, closed_at = now(), history = history || jsonb_build_array(kafaa_fs27_hist('cancelled', v_note)), updated_at = now() where id = p_id;
    perform kafaa_opp_notify('nt-' || p_id || '-cancelled', s.person_id, 'Secondment cancelled: ' || s.host_name_en, 'أُلغيت الإعارة: ' || s.host_name_ar, '/opportunities/secondments', 'warn');
    a := kafaa_audit('secondment.close', 'secondments', p_id, 'ok', 'planned -> cancelled', 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Secondment cancelled', a, null, jsonb_build_object('status', 'cancelled', 'capture_session_id', null, 'transfer_due_on', null));
  end if;
  select * into ivp from kafaa_people where id = s.line_manager_id;
  if s.line_manager_id is null or s.line_manager_id = s.person_id or ivp.id is null or ivp.status <> 'active' then
    return kafaa_refuse('secondment.close', 'secondments', p_id, 'no_interviewer', 'Nobody can run the knowledge-capture session; record a line manager for this person first', v_role);
  end if;
  v_ret := (p->>'returned_on')::date;
  v_due := v_ret + 60;
  v_cs := 'cs-sec-' || p_id;
  insert into kafaa_capture_sessions (id, sme_id, interviewer_id, created_by, template, title, lang, status, planned_on, held_on, duration_min, skill_ids, standard_ids, position_id, action_id,
    transcript, transcript_words, notes, asset_id, sme_name, sme_name_ar, interviewer_name, interviewer_name_ar, history, created_at, updated_at)
  values (v_cs, s.person_id, s.line_manager_id, me, 'critical_decisions', left('Secondment return: what I learned at ' || s.host_name_en, 140), 'en', 'planned',
    least(v_due, greatest(current_date, v_ret + 21)), null, 60, array(select o->>'skill_id' from jsonb_array_elements(s.objectives) o), '{}'::text[], null, null,
    '', 0, format('Return-and-transfer obligation for secondment %s; due by %s', p_id, v_due), null,
    kafaa_kc_name(s.person_id, false), kafaa_kc_name(s.person_id, true), kafaa_kc_name(s.line_manager_id, false), kafaa_kc_name(s.line_manager_id, true),
    jsonb_build_array(kafaa_fs27_hist('planned', null)), now(), now())
  on conflict (id) do nothing;
  update kafaa_secondments set status = 'returned', returned_on = v_ret, outcome_note = v_note, objectives_met = p->'met', transfer_due_on = v_due, capture_session_id = v_cs,
    closed_by = me, closed_at = now(), history = history || jsonb_build_array(kafaa_fs27_hist('returned', v_note)), updated_at = now() where id = p_id;
  perform kafaa_opp_notify('nt-' || p_id || '-returned', s.person_id, format('Welcome back. Share what you learned at %s by %s', s.host_name_en, v_due),
    format('مرحباً بعودتك. شارك ما تعلمته في %s قبل %s', s.host_name_ar, v_due), '/knowledge/capture', 'info');
  perform kafaa_opp_notify('nt-' || p_id || '-capture', s.line_manager_id, format('Knowledge-capture session to run with %s by %s', s.person_name, v_due),
    format('جلسة التقاط معرفة مع %s قبل %s', coalesce(nullif(s.person_name_ar, ''), s.person_name), v_due), '/knowledge/capture', 'info');
  l := kafaa_ledger('kafaa.secondment.return', format('Secondment %s closed on return; knowledge-capture session %s due %s', p_id, v_cs, v_due));
  a := kafaa_audit('secondment.close', 'secondments', p_id, 'ok', format('planned -> returned; capture %s due %s', v_cs, v_due), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Secondment closed; knowledge-capture session created', a, l, jsonb_build_object('status', 'returned', 'capture_session_id', v_cs, 'transfer_due_on', v_due));
end $$;

create or replace function kafaa_secondment_desk() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_role text := kafaa_res_hr_role();
begin
  if kafaa_me() is null or (v_role is null and not kafaa_has_grant('audit_log', array['R'])) then return null; end if;
  return jsonb_build_object(
    'rows', coalesce((select jsonb_agg(to_jsonb(s) order by s.start_on desc, s.id collate "C") from kafaa_secondments s), '[]'::jsonb),
    'sessions', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'status', c.status, 'planned_on', c.planned_on) order by c.id collate "C")
                            from kafaa_capture_sessions c where c.id in (select capture_session_id from kafaa_secondments where capture_session_id is not null)), '[]'::jsonb),
    'stats', kafaa_fs28_stats(current_date),
    'people', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'name', x.display_name, 'name_ar', coalesce(nullif(x.display_name_ar, ''), x.display_name), 'family_id', x.job_family_id, 'role_id', x.job_role_id) order by x.id collate "C")
                          from kafaa_people x where x.kind = 'staff' and x.status = 'active' and coalesce(x.job_family_id, '') not in ('security', 'cyber', 'safeguards')), '[]'::jsonb),
    'can_edit', v_role is not null);
end $$;

create or replace function kafaa_secondment_overview() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if kafaa_me() is null or not kafaa_has_grant('opportunities', array['R']) then return null; end if;
  return kafaa_fs28_stats(current_date);
end $$;

-- ───────────── Grants: RPCs to authenticated only; helpers to nobody
revoke execute on function kafaa_fs27_len(jsonb), kafaa_fs27_is_date(text), kafaa_fs27_quarter(date), kafaa_fs27_bounds(text), kafaa_fs27_open_periods(date),
  kafaa_fs27_validate_envelope(jsonb, date), kafaa_fs27_channel_problem(text, text[]), kafaa_fs27_envelope_fit(text, text, date), kafaa_fs27_env_visible(kafaa_time_envelopes),
  kafaa_fs27_hist(text, text), kafaa_fs27_stats_compute(), kafaa_fs28_validate_tag(jsonb), kafaa_fs28_validate_secondment(jsonb, date),
  kafaa_fs28_validate_close(kafaa_secondments, text, jsonb, date), kafaa_fs28_phase(kafaa_secondments, date), kafaa_fs28_transfer(kafaa_secondments, date), kafaa_fs28_stats(date)
  from public, anon, authenticated;
revoke execute on function kafaa_request_envelope(jsonb), kafaa_approve_envelope(text, text, text), kafaa_future_gig_stats(), kafaa_post_opportunity(jsonb), kafaa_apply_opportunity(text, text),
  kafaa_tag_future_rotation(jsonb), kafaa_plan_secondment(jsonb), kafaa_close_secondment(text, text, jsonb), kafaa_secondment_desk(), kafaa_secondment_overview() from public, anon;
grant execute on function kafaa_request_envelope(jsonb), kafaa_approve_envelope(text, text, text), kafaa_future_gig_stats(), kafaa_post_opportunity(jsonb), kafaa_apply_opportunity(text, text),
  kafaa_tag_future_rotation(jsonb), kafaa_plan_secondment(jsonb), kafaa_close_secondment(text, text, jsonb), kafaa_secondment_desk(), kafaa_secondment_overview() to authenticated;
