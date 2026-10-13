-- kafaa_fs91_balance_external_certs_p1 (1/1) · from supabase/migrations/20261010291001_kafaa_fs91_balance_external_certs.sql
-- Apply with apply_migration name "kafaa_fs91_balance_external_certs_p1". Additive and idempotent; kafaa_* objects only.
-- [FS wave I · E1 · FS78 + FS79] Learning balance and protected study time; verified import of external certificates (M34 Recognition).
-- FS78 (SIMULATED): kafaa_learning_balances (one annual balance per member of staff: a base grant plus a mid-career top-up from years
--   of service, never age; in hours shown as credits, 1 credit = 10 hours, FS30) and kafaa_study_time_requests (protected study hours
--   for one item of the FS18 outcome-gated catalogue: published, listed and meeting every published required criterion = kafaa_xr_check).
--   The balance is grants minus approved use (kafaa_lb_compute = balanceOf). kafaa_request_study_time (the person; ungated items and
--   overdrafts refused), kafaa_decide_study_time (maker-checker: the line manager in scope or the HR authority, never the requester;
--   approval writes a ledger row), kafaa_learning_balance (self, line manager in scope, HR).
-- FS79: kafaa_external_certs (metadata, https verification link, FS08 crosswalk entries, trust tier). kafaa_submit_external_cert (the
--   holder), kafaa_verify_external_cert (a verifier with recognition A, never the holder: verify, reject, revoke). Only a verified
--   certificate writes F01 evidence (kind credential, ref_table external_certs, basis and level by tier) and only through reviewed
--   crosswalk rows (kafaa_xc_map = certMapping); everything unverified stays "claimed" (kafaa_xc_trust_tier = trustTier).
-- kafaa_lb_* / kafaa_sb_* = src/modules/m34/balance.ts; kafaa_xc_* = src/modules/m34/extcerts.ts; PGlite parity:
--   scripts/validate/fs91-balance-external-certs.mjs.
-- Writes into other modules' tables only through these SECURITY DEFINER functions: F01 kafaa_skill_evidence (+ kafaa_skills_apply, not
--   redefined; kind credential is a recorded kind, so recomputes keep the rows), M14 kafaa_notifications (kind recognition).
-- Reads: kafaa_people, kafaa_role_assignments (kafaa_opp_line_manager), kafaa_external_resources + kafaa_catalogue_criteria
--   (kafaa_xr_check), kafaa_skill_alignments, kafaa_skills.
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.

-- ───────────── Tables (generated DDL, additive)
create table if not exists kafaa_learning_balances (
  id text primary key,
  person_id text not null,
  person_name text not null default '',
  person_name_ar text not null default '',
  entity_id text,
  job_family_id text,
  year integer not null,
  base_hours integer not null default 0,
  topup_hours integer not null default 0,
  topup_basis text not null default 'none' check (topup_basis in ('mid_career', 'none')),
  service_years integer not null default 0,
  granted_hours integer not null default 0,
  used_hours integer not null default 0,
  pending_hours integer not null default 0,
  remaining_hours integer not null default 0,
  simulated boolean not null default true,
  open_read boolean not null default false,
  refreshed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
comment on table kafaa_learning_balances is '[M34] Annual learning balance (SIMULATED): base grant plus a mid-career top-up from years of service, in hours and credits (1 credit = 10 hours); grants minus approved use (FS78)';
create table if not exists kafaa_study_time_requests (
  id text primary key,
  person_id text not null,
  person_name text not null default '',
  person_name_ar text not null default '',
  line_manager_id text,
  line_manager_name text not null default '',
  year integer not null,
  resource_id text not null,
  resource_title_en text not null default '',
  resource_title_ar text not null default '',
  hours integer not null,
  credits numeric not null default 0,
  starts_on date not null,
  ends_on date not null,
  pattern text not null check (pattern in ('release_days', 'shift_blocks', 'non_shift_week')),
  reason text not null default '',
  status text not null default 'requested' check (status in ('requested', 'approved', 'declined', 'withdrawn')),
  decided_by text,
  decided_role text,
  decided_on date,
  decision_note text,
  history jsonb not null default '[]'::jsonb,
  open_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table kafaa_study_time_requests is '[M34] Protected study hours for one outcome-gated catalogue item (FS18): requested by the person, decided by the line manager in scope or the HR authority (maker-checker, audited) (FS78)';
create table if not exists kafaa_external_certs (
  id text primary key,
  person_id text not null,
  person_name text not null default '',
  title text not null,
  issuer text not null,
  issuer_kind text not null check (issuer_kind in ('enec', 'university', 'professional_body', 'vendor', 'online_platform')),
  accreditation_ref text,
  credential_ref text not null,
  issued_on date not null,
  expires_on date,
  verification_url text not null,
  resource_id text,
  alignment_ids text[] not null default '{}'::text[],
  levels jsonb not null default '{}'::jsonb,
  note text,
  status text not null default 'submitted' check (status in ('submitted', 'verified', 'rejected', 'withdrawn', 'revoked')),
  tier text check (tier in ('enec_assessed', 'accredited', 'vendor_self_serve')),
  method text check (method in ('issuer_url', 'issuer_registry', 'enec_assessment', 'document_check')),
  verified_by text,
  verified_role text,
  verified_on date,
  decision_note text,
  mapped jsonb not null default '[]'::jsonb,
  evidence_ids text[] not null default '{}'::text[],
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table kafaa_external_certs is '[M34] External certificates (university, professional body, vendor, online platform, ENEC): metadata, https verification link, crosswalk entries, trust tier and verification (FS79)';
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_learning_balances_person_id_fk') then alter table kafaa_learning_balances add constraint kafaa_learning_balances_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_study_time_requests_person_id_fk') then alter table kafaa_study_time_requests add constraint kafaa_study_time_requests_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_study_time_requests_line_manager_id_fk') then alter table kafaa_study_time_requests add constraint kafaa_study_time_requests_line_manager_id_fk foreign key (line_manager_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_study_time_requests_resource_id_fk') then alter table kafaa_study_time_requests add constraint kafaa_study_time_requests_resource_id_fk foreign key (resource_id) references kafaa_external_resources(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_external_certs_person_id_fk') then alter table kafaa_external_certs add constraint kafaa_external_certs_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_learning_balances_person_id_idx on kafaa_learning_balances (person_id);
create index if not exists kafaa_learning_balances_year_idx on kafaa_learning_balances (year);
create index if not exists kafaa_study_time_requests_person_id_idx on kafaa_study_time_requests (person_id);
create index if not exists kafaa_study_time_requests_line_manager_id_idx on kafaa_study_time_requests (line_manager_id);
create index if not exists kafaa_study_time_requests_year_idx on kafaa_study_time_requests (year);
create index if not exists kafaa_study_time_requests_resource_id_idx on kafaa_study_time_requests (resource_id);
create index if not exists kafaa_study_time_requests_status_idx on kafaa_study_time_requests (status);
create index if not exists kafaa_external_certs_person_id_idx on kafaa_external_certs (person_id);
create index if not exists kafaa_external_certs_status_idx on kafaa_external_certs (status);

-- ───────────── RLS (generated rule; created once, then the per-statement form of the RLS performance pass)
do $$ begin
  execute 'alter table kafaa_learning_balances enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_learning_balances' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_learning_balances for select to anon, authenticated using (kafaa_rule_read(''recognition'', person_id, null::text, open_read) or kafaa_rule_read(''workforce_strategy'', null::text, null::text, true))'; end if;
  execute 'alter table kafaa_study_time_requests enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_study_time_requests' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_study_time_requests for select to anon, authenticated using (kafaa_rule_read(''recognition'', person_id, null::text, open_read) or kafaa_rule_read(''recognition'', line_manager_id, null::text, open_read) or kafaa_rule_read(''workforce_strategy'', null::text, null::text, true))'; end if;
  execute 'alter table kafaa_external_certs enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_external_certs' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_external_certs for select to anon, authenticated using (kafaa_rule_read(''recognition'', person_id, null::text, true))'; end if;
end $$;
alter policy kafaa_read on kafaa_learning_balances using (((COALESCE(open_read, false) AND (SELECT kafaa_has_grant('recognition'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('recognition'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('recognition'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('recognition'::text, person_id, NULL::text, false))) OR (((SELECT kafaa_has_grant('workforce_strategy'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_study_time_requests using (((COALESCE(open_read, false) AND (SELECT kafaa_has_grant('recognition'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('recognition'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('recognition'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('recognition'::text, person_id, NULL::text, false))) OR ((COALESCE(open_read, false) AND (SELECT kafaa_has_grant('recognition'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((line_manager_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('recognition'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('recognition'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('recognition'::text, line_manager_id, NULL::text, false))) OR (((SELECT kafaa_has_grant('workforce_strategy'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_external_certs using ((((SELECT kafaa_has_grant('recognition'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('recognition'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('recognition'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('recognition'::text, person_id, NULL::text, false))));
revoke all on kafaa_learning_balances, kafaa_study_time_requests, kafaa_external_certs from anon, authenticated;
grant select on kafaa_learning_balances, kafaa_study_time_requests, kafaa_external_certs to anon, authenticated;

-- ───────────── Checks (kafaa_* only): a balance never goes below zero and is base + top-up; a request is decided by someone else and stays
-- inside its balance year; only a verified (or later revoked) certificate has a tier or evidence.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'kafaa_learning_balances_sum_ck') then
    alter table kafaa_learning_balances add constraint kafaa_learning_balances_sum_ck check (granted_hours = base_hours + topup_hours and used_hours >= 0 and pending_hours >= 0
      and remaining_hours = granted_hours - used_hours and remaining_hours >= 0 and remaining_hours - pending_hours >= 0); end if;
  if not exists (select 1 from pg_constraint where conname = 'kafaa_study_time_requests_shape_ck') then
    alter table kafaa_study_time_requests add constraint kafaa_study_time_requests_shape_ck check (hours between 2 and 40 and ends_on >= starts_on
      and extract(year from starts_on)::integer = year and extract(year from ends_on)::integer = year); end if;
  if not exists (select 1 from pg_constraint where conname = 'kafaa_study_time_requests_checker_ck') then
    alter table kafaa_study_time_requests add constraint kafaa_study_time_requests_checker_ck check (decided_by is null or decided_by <> person_id); end if;
  if not exists (select 1 from pg_constraint where conname = 'kafaa_external_certs_tier_ck') then
    alter table kafaa_external_certs add constraint kafaa_external_certs_tier_ck check ((tier is not null) = (status in ('verified', 'revoked'))
      and (cardinality(evidence_ids) = 0 or status in ('verified', 'revoked')) and verification_url ~ '^https://'); end if;
  if not exists (select 1 from pg_constraint where conname = 'kafaa_external_certs_checker_ck') then
    alter table kafaa_external_certs add constraint kafaa_external_certs_checker_ck check (verified_by is null or verified_by <> person_id); end if;
end $$;

-- ───────────── shared helpers
create or replace function kafaa_fs91_trim(p text) returns text language sql immutable set search_path = public as $$
  select regexp_replace(coalesce(p, ''), '^[ \t\r\n]+|[ \t\r\n]+$', '', 'g')
$$;
-- s(v): the trimmed string, '' for anything that is not a JSON string
create or replace function kafaa_fs91_s(v jsonb) returns text language sql immutable set search_path = public as $$
  select case when jsonb_typeof(v) = 'string' then kafaa_fs91_trim(v #>> '{}') else '' end
$$;
create or replace function kafaa_fs91_is_date(v jsonb) returns boolean language sql immutable set search_path = public as $$
  select coalesce(jsonb_typeof(v) = 'string' and kafaa_pw_is_date(v #>> '{}'), false)
$$;
create or replace function kafaa_fs91_hist(p_status text, p_note text) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'status', p_status, 'by', kafaa_me(), 'note', nullif(kafaa_fs91_trim(p_note), ''))
$$;
create or replace function kafaa_fs91_notify(p_id text, p_person text, p_en text, p_ar text, p_link text, p_sev text) returns void language plpgsql security definer set search_path = public as $$
declare v_prev text := coalesce(current_setting('kafaa.seeding', true), '');
begin
  if p_person is null or not exists (select 1 from kafaa_people where id = p_person) then return; end if;
  perform set_config('kafaa.seeding', 'on', true);
  insert into kafaa_notifications (id, person_id, kind, title_en, title_ar, body_en, body_ar, link, severity)
  values (p_id, p_person, 'recognition', p_en, p_ar, null, null, p_link, p_sev) on conflict (id) do nothing;
  perform set_config('kafaa.seeding', v_prev, true);
end $$;

-- ───────────── FS78 rules (mirror of src/modules/m34/balance.ts)
-- serviceYears() + grantFor(): staff only; 60 h base; 40 h mid-career top-up from 8 years of service on 1 January (never age)
create or replace function kafaa_lb_grant(p_person text, p_year integer) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare p kafaa_people; v_el boolean; v_sy integer := 0; v_top boolean; v_base integer; v_tu integer;
begin
  select * into p from kafaa_people where id = p_person;
  v_el := p.id is not null and p.kind = 'staff' and p.status is distinct from 'leaver';
  if p.hire_date is not null then
    v_sy := p_year - extract(year from p.hire_date)::integer;
    if extract(month from p.hire_date) > 1 or extract(day from p.hire_date) > 1 then v_sy := v_sy - 1; end if;
    v_sy := greatest(0, v_sy);
  end if;
  v_top := v_el and v_sy >= 8;
  v_base := case when v_el then 60 else 0 end;
  v_tu := case when v_top then 40 else 0 end;
  return jsonb_build_object('eligible', v_el, 'base_hours', v_base, 'topup_hours', v_tu, 'topup_basis', case when v_top then 'mid_career' else 'none' end,
    'service_years', v_sy, 'granted_hours', v_base + v_tu);
end $$;
-- balanceOf(): grants (stored row, else the rule) minus approved use; pending requests are reserved
create or replace function kafaa_lb_compute(p_person text, p_year integer) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare b kafaa_learning_balances; g jsonb; v_gr integer; v_used integer; v_pend integer; v_ap integer; v_rq integer;
begin
  select * into b from kafaa_learning_balances where person_id = p_person and year = p_year order by id limit 1;
  if b.id is not null then v_gr := coalesce(b.base_hours, 0) + coalesce(b.topup_hours, 0);
  else g := kafaa_lb_grant(p_person, p_year); v_gr := (g->>'base_hours')::integer + (g->>'topup_hours')::integer; end if;
  select coalesce(sum(hours) filter (where status = 'approved'), 0)::integer, coalesce(sum(hours) filter (where status = 'requested'), 0)::integer,
         count(*) filter (where status = 'approved')::integer, count(*) filter (where status = 'requested')::integer
    into v_used, v_pend, v_ap, v_rq from kafaa_study_time_requests where person_id = p_person and year = p_year;
  return jsonb_build_object('person_id', p_person, 'year', p_year, 'granted_hours', v_gr, 'used_hours', v_used, 'pending_hours', v_pend,
    'remaining_hours', v_gr - v_used, 'available_hours', v_gr - v_used - v_pend,
    'granted_credits', v_gr / 10.0, 'used_credits', v_used / 10.0, 'pending_credits', v_pend / 10.0, 'remaining_credits', (v_gr - v_used) / 10.0,
    'available_credits', (v_gr - v_used - v_pend) / 10.0, 'approved', v_ap, 'requested', v_rq);
end $$;
-- insert the balance row from the rule when missing, then store balanceOf()
create or replace function kafaa_lb_refresh(p_person text, p_year integer) returns jsonb language plpgsql security definer set search_path = public as $$
declare g jsonb; v jsonb; v_id text := 'lb:' || p_person || ':' || p_year;
begin
  if not exists (select 1 from kafaa_learning_balances where id = v_id) then
    g := kafaa_lb_grant(p_person, p_year);
    insert into kafaa_learning_balances (id, person_id, person_name, person_name_ar, entity_id, job_family_id, year, base_hours, topup_hours, topup_basis, service_years, granted_hours, used_hours, pending_hours, remaining_hours, simulated, open_read)
    values (v_id, p_person, coalesce((select display_name from kafaa_people where id = p_person), ''),
      coalesce((select coalesce(nullif(display_name_ar, ''), display_name) from kafaa_people where id = p_person), ''),
      (select entity_id from kafaa_people where id = p_person), (select job_family_id from kafaa_people where id = p_person), p_year, (g->>'base_hours')::integer, (g->>'topup_hours')::integer, g->>'topup_basis', (g->>'service_years')::integer, (g->>'granted_hours')::integer, 0, 0,
      (g->>'granted_hours')::integer, true, false) on conflict (id) do nothing;
  end if;
  v := kafaa_lb_compute(p_person, p_year);
  update kafaa_learning_balances set granted_hours = (v->>'granted_hours')::integer, used_hours = (v->>'used_hours')::integer, pending_hours = (v->>'pending_hours')::integer,
    remaining_hours = (v->>'remaining_hours')::integer, refreshed_at = now() where id = v_id;
  return v;
end $$;
-- the outcome-gated catalogue: a published, listed external resource that still meets every published required criterion
create or replace function kafaa_sb_gated(p_id text, p_today date) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select x.status = 'published' and x.listed is true and (kafaa_xr_check(to_jsonb(x), p_today)->>'ok')::boolean from kafaa_external_resources x where x.id = p_id), false)
$$;
-- hoursCap()
create or replace function kafaa_sb_cap(p_hours numeric) returns integer language sql immutable set search_path = public as $$
  select case when p_hours is null then 40 else least(40, floor(p_hours)::integer) end
$$;
-- checkRequest(): 'ok' or the first failing code (same order as TS)
create or replace function kafaa_sb_check_request(p jsonb, p_person kafaa_people, p_item kafaa_external_resources, p_gated boolean, p_available integer, p_open_same boolean,
  p_lm text, p_today date) returns text language plpgsql stable security definer set search_path = public as $$
declare a text; b text; r text;
begin
  if p_person.id is null or p_person.kind is distinct from 'staff' or p_person.status = 'leaver' then return 'not_eligible'; end if;
  if p_item.id is null then return 'item'; end if;
  if not coalesce(p_gated, false) then return 'ungated'; end if;
  if not kafaa_pw_is_int(p->'hours') or kafaa_pw_numv(p->'hours') < 2 or kafaa_pw_numv(p->'hours') > kafaa_sb_cap(p_item.hours) then return 'hours'; end if;
  if not (kafaa_fs91_s(p->'pattern') in ('release_days', 'shift_blocks', 'non_shift_week')) then return 'pattern'; end if;
  if not (kafaa_fs91_is_date(p->'starts_on') and kafaa_fs91_is_date(p->'ends_on')) then return 'dates'; end if;
  a := p->>'starts_on'; b := p->>'ends_on';
  if a < to_char(p_today, 'YYYY-MM-DD') or b < a or left(a, 4) <> left(b, 4) or (b::date - a::date) > 92 then return 'dates'; end if;
  r := kafaa_fs91_s(p->'reason');
  if char_length(r) < 10 or char_length(r) > 300 then return 'reason'; end if;
  if p_open_same then return 'conflict'; end if;
  if kafaa_pw_numv(p->'hours') > p_available then return 'balance'; end if;
  if p_lm is null then return 'no_line_manager'; end if;
  return 'ok';
end $$;
-- checkDecide(): maker-checker
create or replace function kafaa_sb_check_decide(p jsonb, r kafaa_study_time_requests, p_me text, p_hr boolean, p_remaining integer, p_today date)
returns text language plpgsql stable security definer set search_path = public as $$
declare d text := kafaa_fs91_s(p->'decision');
begin
  if d not in ('approve', 'decline') then return 'invalid'; end if;
  if r.person_id = p_me then return 'self'; end if;
  if not (r.line_manager_id is not distinct from p_me or p_hr) then return 'forbidden'; end if;
  if r.status <> 'requested' then return 'state'; end if;
  if d = 'decline' and char_length(kafaa_fs91_s(p->'note')) < 5 then return 'note'; end if;
  if d = 'approve' and r.ends_on is not null and r.ends_on < p_today then return 'late'; end if;
  if d = 'approve' and r.hours > p_remaining then return 'overdraw'; end if;
  return 'ok';
end $$;
-- SB_MSG and sbResultCode
create or replace function kafaa_sb_message(p_code text) returns text language sql immutable set search_path = public as $$
  select case p_code
    when 'not_signed_in' then 'Sign in to use your learning balance'
    when 'forbidden_request' then 'Only staff with a learning balance ask for protected study time'
    when 'not_eligible' then 'Protected study time and the learning balance are for ENEC staff (contractors and leavers have none)'
    when 'item' then 'Choose an item from the outcome-gated catalogue'
    when 'ungated' then 'Only items of the outcome-gated catalogue (published, meeting every published criterion) can be charged to the balance'
    when 'hours' then 'Ask for 2 to 40 whole hours, and no more than the item''s notional hours'
    when 'pattern' then 'Choose how the study time is protected (release days, blocks inside the roster or a week away from shift)'
    when 'dates' then 'Give a start date from today and an end date in the same year, at most 92 days later'
    when 'reason' then 'Say in 10 to 300 characters what the study time is for'
    when 'conflict' then 'You already have an open request for this item this year'
    when 'balance' then 'Not enough learning balance left this year for these hours (pending requests are reserved)'
    when 'no_line_manager' then 'No line manager is recorded for you; ask HR to update your record'
    when 'invalid' then 'Unknown decision'
    when 'self' then 'You cannot decide your own protected study time'
    when 'forbidden' then 'Only the line manager (or the HR authority) decides protected study time'
    when 'state' then 'This request is not waiting for a decision'
    when 'note' then 'Give a reason of at least 5 characters when you decline'
    when 'late' then 'This request has already ended; ask the person to send a new one'
    when 'overdraw' then 'Approving these hours would take the balance below zero'
    when 'not_found' then 'Study-time request not found'
    when 'w_forbidden' then 'Only the person who asked can withdraw a request'
    when 'w_state' then 'This request can no longer be withdrawn'
    when 'w_started' then 'The study time has already started; ask your line manager to close it'
    when 'read_forbidden' then 'You can read your own balance; line managers read their team''s and HR reads everyone''s'
    else p_code end
$$;
create or replace function kafaa_sb_result_code(p_code text) returns text language sql immutable set search_path = public as $$
  select case p_code when 'self' then 'maker_checker' when 'forbidden' then 'forbidden' when 'not_eligible' then 'not_eligible' when 'conflict' then 'conflict'
    when 'ungated' then 'ungated' when 'balance' then 'insufficient_balance' when 'overdraw' then 'insufficient_balance' when 'no_line_manager' then 'no_line_manager'
    when 'item' then 'not_found' when 'not_found' then 'not_found' when 'w_forbidden' then 'forbidden' else 'invalid' end
$$;
-- read rule of a request (same as its RLS policy): the person, the line manager (recognition Own/Scope), HR (workforce_strategy R/W/A)
create or replace function kafaa_sb_visible(r kafaa_study_time_requests) returns boolean language sql stable security definer set search_path = public as $$
  select kafaa_rule_read('recognition', r.person_id, null, r.open_read) or kafaa_rule_read('recognition', r.line_manager_id, null, r.open_read)
      or kafaa_has_grant('workforce_strategy', array['R', 'W', 'A'])
$$;

-- ───────────── FS78 RPCs
create or replace function kafaa_request_study_time(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_action text; v_act text; v_ent text; v_role text; r kafaa_study_time_requests; v_code text; pp kafaa_people; x kafaa_external_resources;
  v_gated boolean; v_year integer; v_bal jsonb; v_lm text; v_open boolean; v_id text; v_hours integer; a kafaa_audit_events;
begin
  p := coalesce(p, '{}'::jsonb);
  if jsonb_typeof(p) <> 'object' then p := '{}'::jsonb; end if;
  v_action := kafaa_fs91_s(p->'action');
  v_act := 'study.' || case when v_action in ('request', 'withdraw') then v_action else 'invalid' end;
  v_ent := case when v_action = 'withdraw' then nullif(kafaa_fs91_s(p->'id'), '') end;
  if me is null then return kafaa_refuse(v_act, 'study_time_requests', v_ent, 'not_signed_in', kafaa_sb_message('not_signed_in')); end if;
  v_role := kafaa_acting_role('recognition', array['Own']);
  if v_action not in ('request', 'withdraw') then return kafaa_refuse(v_act, 'study_time_requests', v_ent, 'invalid', kafaa_sb_message('invalid'), v_role); end if;
  if v_action = 'withdraw' then
    select * into r from kafaa_study_time_requests where id = v_ent;
    if r.id is null or not kafaa_sb_visible(r) then return kafaa_refuse(v_act, 'study_time_requests', v_ent, 'not_found', kafaa_sb_message('not_found'), v_role); end if;
    v_code := case when r.person_id <> me then 'forbidden' when r.status not in ('requested', 'approved') then 'state'
                   when r.status = 'approved' and r.starts_on <= current_date then 'started' else 'ok' end;
    if v_code <> 'ok' then return kafaa_refuse(v_act, 'study_time_requests', v_ent, kafaa_sb_result_code('w_' || v_code), kafaa_sb_message('w_' || v_code), v_role); end if;
    update kafaa_study_time_requests set status = 'withdrawn', history = history || jsonb_build_array(kafaa_fs91_hist('withdrawn', null)), updated_at = now() where id = r.id;
    v_bal := kafaa_lb_refresh(r.person_id, r.year);
    a := kafaa_audit(v_act, 'study_time_requests', r.id, 'ok', r.status || ' -> withdrawn', 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Study-time request withdrawn', a, null, jsonb_build_object('id', r.id, 'status', 'withdrawn', 'balance', v_bal));
  end if;
  if v_role is null then return kafaa_refuse(v_act, 'study_time_requests', null, 'forbidden', kafaa_sb_message('forbidden_request')); end if;
  select * into pp from kafaa_people where id = me;
  if jsonb_typeof(p->'resource_id') = 'string' then select * into x from kafaa_external_resources where id = kafaa_fs91_s(p->'resource_id'); end if;
  v_gated := x.id is not null and kafaa_sb_gated(x.id, current_date);
  v_year := case when kafaa_fs91_is_date(p->'starts_on') then left(p->>'starts_on', 4)::integer else extract(year from current_date)::integer end;
  v_bal := kafaa_lb_compute(me, v_year);
  v_lm := kafaa_opp_line_manager(me);
  v_open := exists (select 1 from kafaa_study_time_requests q where q.person_id = me and q.year = v_year and q.resource_id = x.id and q.status in ('requested', 'approved'));
  v_code := kafaa_sb_check_request(p, pp, x, v_gated, (v_bal->>'available_hours')::integer, v_open, v_lm, current_date);
  if v_code <> 'ok' then return kafaa_refuse(v_act, 'study_time_requests', null, kafaa_sb_result_code(v_code), kafaa_sb_message(v_code), v_role); end if;
  v_id := 'str-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 24);
  v_hours := kafaa_pw_numv(p->'hours')::integer;
  insert into kafaa_study_time_requests (id, person_id, person_name, person_name_ar, line_manager_id, line_manager_name, year, resource_id, resource_title_en, resource_title_ar, hours, credits,
    starts_on, ends_on, pattern, reason, status, history, open_read, created_at, updated_at)
  values (v_id, me, coalesce(pp.display_name, ''), coalesce(nullif(pp.display_name_ar, ''), pp.display_name, ''), v_lm, coalesce((select display_name from kafaa_people where id = v_lm), ''), v_year, x.id, x.title_en, x.title_ar, v_hours, v_hours / 10.0,
    (p->>'starts_on')::date, (p->>'ends_on')::date, kafaa_fs91_s(p->'pattern'), kafaa_fs91_s(p->'reason'), 'requested',
    jsonb_build_array(kafaa_fs91_hist('requested', kafaa_fs91_s(p->'reason'))), false, now(), now());
  v_bal := kafaa_lb_refresh(me, v_year);
  perform kafaa_fs91_notify('nt-' || v_id || '-requested', v_lm, 'Study-time request: ' || pp.display_name || ' (' || v_hours || ' h, ' || x.title_en || ')',
    'طلب وقت دراسة: ' || coalesce(nullif(pp.display_name_ar, ''), pp.display_name) || ' (' || v_hours || ' ساعة، ' || x.title_ar || ')', '/team/study-time', 'info');
  a := kafaa_audit(v_act, 'study_time_requests', v_id, 'ok', v_hours || 'h ' || x.id || ' ' || v_year || ' -> ' || v_lm, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Study time sent to your line manager', a, null, jsonb_build_object('id', v_id, 'status', 'requested', 'line_manager_id', v_lm, 'balance', v_bal));
end $$;

create or replace function kafaa_decide_study_time(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_id text; r kafaa_study_time_requests; v_hr boolean; v_role text; v_bal jsonb; v_code text; v_status text; v_note text; a kafaa_audit_events; l integer;
begin
  p := coalesce(p, '{}'::jsonb);
  if jsonb_typeof(p) <> 'object' then p := '{}'::jsonb; end if;
  v_id := nullif(kafaa_fs91_s(p->'id'), '');
  if me is null then return kafaa_refuse('study.decide', 'study_time_requests', v_id, 'not_signed_in', kafaa_sb_message('not_signed_in')); end if;
  select * into r from kafaa_study_time_requests where id = v_id;
  if r.id is null or not kafaa_sb_visible(r) then return kafaa_refuse('study.decide', 'study_time_requests', v_id, 'not_found', kafaa_sb_message('not_found')); end if;
  v_hr := kafaa_has_role('hr_director');
  v_role := case when r.line_manager_id = me then coalesce(kafaa_acting_role('recognition', array['Scope']), kafaa_acting_role('recognition', array['Own']))
                 when v_hr then 'hr_director' else kafaa_acting_role('recognition', array['Own']) end;
  v_bal := kafaa_lb_compute(r.person_id, r.year);
  v_code := kafaa_sb_check_decide(p, r, me, v_hr, (v_bal->>'remaining_hours')::integer, current_date);
  if v_code <> 'ok' then return kafaa_refuse('study.decide', 'study_time_requests', v_id, kafaa_sb_result_code(v_code), kafaa_sb_message(v_code), v_role); end if;
  v_status := case when kafaa_fs91_s(p->'decision') = 'approve' then 'approved' else 'declined' end;
  v_note := nullif(kafaa_fs91_s(p->'note'), '');
  update kafaa_study_time_requests set status = v_status, decided_by = me, decided_role = v_role, decided_on = current_date, decision_note = v_note,
    history = history || jsonb_build_array(kafaa_fs91_hist(v_status, v_note)), updated_at = now() where id = v_id;
  v_bal := kafaa_lb_refresh(r.person_id, r.year);
  perform kafaa_fs91_notify('nt-' || v_id || '-' || v_status, r.person_id,
    case when v_status = 'approved' then 'Study time approved: ' || r.hours || ' h for ' || r.resource_title_en else 'Study time declined: ' || r.resource_title_en end,
    case when v_status = 'approved' then 'تمت الموافقة على وقت الدراسة: ' || r.hours || ' ساعة لـ ' || r.resource_title_ar else 'رُفض وقت الدراسة: ' || r.resource_title_ar end,
    '/my/learning-balance', case when v_status = 'approved' then 'ok' else 'warn' end);
  if v_status = 'approved' then l := kafaa_ledger('kafaa.study_time.approve', 'Protected study time ' || v_id || ' (' || r.hours || ' h) approved for ' || r.person_id); end if;
  a := kafaa_audit('study.decide', 'study_time_requests', v_id, 'ok', 'requested -> ' || v_status || ' (' || r.hours || 'h)',
    case when v_status <> 'approved' then 'not_applicable' when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when v_status = 'approved' then 'Study time approved' else 'Study time declined' end, a, l,
    jsonb_build_object('id', v_id, 'status', v_status, 'balance', v_bal));
end $$;

create or replace function kafaa_learning_balance(p_person text default null, p_year integer default null) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); v_pid text; v_y integer; b kafaa_learning_balances;
begin
  if me is null then return null; end if;
  v_pid := coalesce(nullif(kafaa_fs91_trim(p_person), ''), me);
  if not ((v_pid = me and kafaa_has_grant('recognition', array['Own', 'Scope'])) or (kafaa_has_grant('recognition', array['Scope']) and kafaa_in_scope('recognition', v_pid))
          or kafaa_has_grant('workforce_strategy', array['R', 'W', 'A'])) then return null; end if;
  if not exists (select 1 from kafaa_people where id = v_pid) then return null; end if;
  v_y := coalesce(p_year, extract(year from current_date)::integer);
  select * into b from kafaa_learning_balances where id = 'lb:' || v_pid || ':' || v_y;
  return jsonb_build_object('person_id', v_pid, 'year', v_y, 'grant', kafaa_lb_grant(v_pid, v_y), 'balance', kafaa_lb_compute(v_pid, v_y),
    'stored', case when b.id is null then null else to_jsonb(b) end);
end $$;

-- ───────────── FS79 rules (mirror of src/modules/m34/extcerts.ts)
create or replace function kafaa_xc_issuer_tier(p_kind text, p_acc text) returns text language sql immutable set search_path = public as $$
  select case when p_kind = 'enec' then 'enec_assessed'
              when p_kind in ('university', 'professional_body') and char_length(kafaa_fs91_trim(p_acc)) > 0 then 'accredited' else 'vendor_self_serve' end
$$;
create or replace function kafaa_xc_trust_tier(c kafaa_external_certs) returns text language sql immutable set search_path = public as $$
  select case when c.status is distinct from 'verified' then 'claimed'
              when c.tier in ('enec_assessed', 'accredited', 'vendor_self_serve') then c.tier else kafaa_xc_issuer_tier(c.issuer_kind, c.accreditation_ref) end
$$;
create or replace function kafaa_xc_cap(p_tier text) returns integer language sql immutable set search_path = public as $$
  select case p_tier when 'enec_assessed' then 3 when 'accredited' then 2 else 1 end
$$;
create or replace function kafaa_xc_basis(p_tier text) returns text language sql immutable set search_path = public as $$
  select case p_tier when 'enec_assessed' then 'evidenced' else 'validated' end
$$;
-- certMapping(): one row per named crosswalk entry (sorted); only published rows with a second-person review map, level capped by tier
create or replace function kafaa_xc_map(p_ids text[], p_levels jsonb, p_tier text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_rows jsonb := '[]'::jsonb; v_id text; al kafaa_skill_alignments; sk kafaa_skills; v_state text; v_lv integer; v_cl integer; v_skills jsonb;
begin
  for v_id in select z.u from (select distinct u from unnest(coalesce(p_ids, '{}'::text[])) u where u is not null) z order by z.u collate "C" loop
    select * into al from kafaa_skill_alignments where id = v_id;
    if al.id is null then
      v_rows := v_rows || jsonb_build_array(jsonb_build_object('alignment_id', v_id, 'skill_id', null, 'framework', null, 'label_en', '', 'label_ar', '', 'state', 'missing', 'level', 0));
      continue;
    end if;
    select * into sk from kafaa_skills where id = al.skill_id;
    v_state := case when sk.id is null or sk.area = 'security' then 'restricted' when al.status = 'retired' then 'retired'
                    when al.status = 'published' and coalesce(al.reviewed_by, '') <> '' and al.reviewed_on is not null then 'maps' else 'unreviewed' end;
    v_cl := case when p_levels is not null and jsonb_typeof(p_levels) = 'object' and kafaa_pw_is_int(p_levels->v_id) and kafaa_pw_numv(p_levels->v_id) between 1 and 3
                 then kafaa_pw_numv(p_levels->v_id)::integer else 1 end;
    v_lv := case when v_state = 'maps' then least(v_cl, kafaa_xc_cap(p_tier)) else 0 end;
    v_rows := v_rows || jsonb_build_array(jsonb_build_object('alignment_id', v_id, 'skill_id', al.skill_id, 'framework', al.framework, 'label_en', al.label_en, 'label_ar', al.label_ar,
      'state', v_state, 'level', v_lv));
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('skill_id', s.skill_id, 'level', s.level, 'alignment_ids', s.ids) order by s.skill_id collate "C"), '[]'::jsonb) into v_skills
    from (select r->>'skill_id' skill_id, max((r->>'level')::integer) level, jsonb_agg(r->'alignment_id' order by n) ids
            from jsonb_array_elements(v_rows) with ordinality t(r, n) where r->>'state' = 'maps' group by r->>'skill_id') s;
  return jsonb_build_object('rows', v_rows, 'skills', v_skills);
end $$;
-- lenIn(), optLen()
create or replace function kafaa_xc_len(v jsonb, lo integer, hi integer) returns boolean language sql immutable set search_path = public as $$
  select coalesce(jsonb_typeof(v) = 'string' and char_length(kafaa_fs91_trim(v #>> '{}')) between lo and hi, false)
$$;
create or replace function kafaa_xc_optlen(v jsonb, hi integer) returns boolean language sql immutable set search_path = public as $$
  select v is null or jsonb_typeof(v) = 'null' or (jsonb_typeof(v) = 'string' and char_length(kafaa_fs91_trim(v #>> '{}')) <= hi)
$$;
-- checkSubmit(): 'ok' or the first failing code (same order as TS)
create or replace function kafaa_xc_check_submit(p jsonb, p_today date, p_dup boolean) returns text language plpgsql stable security definer set search_path = public as $$
declare v_al jsonb := p->'alignment_ids'; v_lv jsonb := p->'levels'; v_ids text[]; v_url text;
begin
  if not kafaa_xc_len(p->'title', 3, 160) then return 'title'; end if;
  if not kafaa_xc_len(p->'issuer', 2, 120) then return 'issuer'; end if;
  if kafaa_fs91_s(p->'issuer_kind') not in ('enec', 'university', 'professional_body', 'vendor', 'online_platform') then return 'issuer_kind'; end if;
  if not kafaa_xc_optlen(p->'accreditation_ref', 80) then return 'accreditation'; end if;
  if not kafaa_xc_len(p->'credential_ref', 1, 80) then return 'credential_ref'; end if;
  if not kafaa_fs91_is_date(p->'issued_on') or (p->>'issued_on') > to_char(p_today, 'YYYY-MM-DD')
     or not (p->'expires_on' is null or jsonb_typeof(p->'expires_on') = 'null' or (p->'expires_on') = '""'::jsonb
             or (kafaa_fs91_is_date(p->'expires_on') and (p->>'expires_on') > (p->>'issued_on'))) then return 'dates'; end if;
  v_url := kafaa_fs91_s(p->'verification_url');
  if jsonb_typeof(p->'verification_url') is distinct from 'string' or v_url !~ '^https://[^[:space:]"''<>]+$' or char_length(v_url) > 300 then return 'url'; end if;
  if jsonb_typeof(v_al) is distinct from 'array' or jsonb_array_length(v_al) < 1 or jsonb_array_length(v_al) > 6
     or exists (select 1 from jsonb_array_elements(v_al) e where jsonb_typeof(e) <> 'string') then return 'alignments'; end if;
  select array_agg(e #>> '{}') into v_ids from jsonb_array_elements(v_al) e;
  if (select count(distinct u) from unnest(v_ids) u) <> cardinality(v_ids) then return 'alignments'; end if;
  if exists (select 1 from unnest(v_ids) u left join kafaa_skill_alignments a on a.id = u where a.id is null or a.status = 'retired') then return 'alignments'; end if;
  if v_lv is not null and jsonb_typeof(v_lv) <> 'null' then
    if jsonb_typeof(v_lv) <> 'object' then return 'levels'; end if;
    if exists (select 1 from jsonb_each(v_lv) e where not (e.key = any(v_ids)) or not kafaa_pw_is_int(e.value) or kafaa_pw_numv(e.value) < 1 or kafaa_pw_numv(e.value) > 3) then return 'levels'; end if;
  end if;
  if not kafaa_xc_optlen(p->'note', 300) then return 'note'; end if;
  if exists (select 1 from unnest(v_ids) u join kafaa_skill_alignments a on a.id = u join kafaa_skills s on s.id = a.skill_id where s.area = 'security') then return 'security_restricted'; end if;
  if p_dup then return 'conflict'; end if;
  return 'ok';
end $$;
-- checkVerify(): a verifier who is not the holder
create or replace function kafaa_xc_check_verify(p jsonb, c kafaa_external_certs, p_me text, p_today date) returns text language plpgsql stable security definer set search_path = public as $$
declare d text := kafaa_fs91_s(p->'decision'); m text := kafaa_fs91_s(p->'method');
begin
  if d not in ('verify', 'reject', 'revoke') then return 'invalid'; end if;
  if c.person_id = p_me then return 'self'; end if;
  if (d = 'revoke' and c.status <> 'verified') or (d <> 'revoke' and c.status <> 'submitted') then return 'state'; end if;
  if d = 'verify' then
    if m not in ('issuer_url', 'issuer_registry', 'enec_assessment', 'document_check') then return 'method'; end if;
    if (kafaa_xc_issuer_tier(c.issuer_kind, c.accreditation_ref) = 'enec_assessed') <> (m = 'enec_assessment') then return 'method_tier'; end if;
    if c.expires_on is not null and c.expires_on < p_today then return 'expired'; end if;
    return 'ok';
  end if;
  if char_length(kafaa_fs91_s(p->'note')) < 5 then return 'note'; end if;
  return 'ok';
end $$;
-- XC_MSG and xcResultCode (+ xcMsgKey: 'note' reads as 'reason')
create or replace function kafaa_xc_message(p_code text) returns text language sql immutable set search_path = public as $$
  select case p_code
    when 'not_signed_in' then 'Sign in to add an external certificate'
    when 'forbidden_submit' then 'You add and withdraw only your own certificates'
    when 'forbidden_verify' then 'Only verifiers (assessors and the HR authority) verify external certificates'
    when 'title' then 'Give the certificate title (3 to 160 characters)'
    when 'issuer' then 'Give the issuer (2 to 120 characters)'
    when 'issuer_kind' then 'Choose the kind of issuer: ENEC, a university, a professional body, a vendor or an online platform'
    when 'accreditation' then 'The accreditation reference is at most 80 characters'
    when 'credential_ref' then 'Give the certificate or credential number (1 to 80 characters)'
    when 'dates' then 'Give an issue date up to today and, if it expires, an expiry date after it'
    when 'url' then 'Give an https verification link from the issuer (at most 300 characters)'
    when 'alignments' then 'Name 1 to 6 different crosswalk entries the certificate covers (published or under review, not retired)'
    when 'levels' then 'Claimed levels are whole numbers from 1 to 3 for the entries you named'
    when 'note' then 'Give a reason of at least 5 characters'
    when 'security_restricted' then 'Security-area skills are recorded as qualified or not qualified only, never from external certificates'
    when 'conflict' then 'This certificate (same verification link) is already in your record'
    when 'invalid' then 'Unknown decision'
    when 'self' then 'You cannot verify your own certificate'
    when 'state' then 'This certificate is not in a state for that decision'
    when 'method' then 'Choose how it was verified: issuer link, issuer registry, ENEC assessment or document check'
    when 'method_tier' then 'An ENEC-issued certificate is verified through an ENEC assessment, and only ENEC certificates are'
    when 'expired' then 'An expired certificate cannot be verified'
    when 'not_found' then 'Certificate not found'
    when 'w_forbidden' then 'Only the holder withdraws a certificate'
    when 'w_state' then 'Only a certificate waiting for verification can be withdrawn'
    else p_code end
$$;
create or replace function kafaa_xc_note_message(p_code text) returns text language sql immutable set search_path = public as $$
  select case when p_code = 'note' then 'The note is at most 300 characters' else kafaa_xc_message(p_code) end
$$;
create or replace function kafaa_xc_result_code(p_code text) returns text language sql immutable set search_path = public as $$
  select case p_code when 'self' then 'maker_checker' when 'security_restricted' then 'security_restricted' when 'conflict' then 'conflict' when 'not_found' then 'not_found'
    when 'w_forbidden' then 'forbidden' else 'invalid' end
$$;

-- ───────────── FS79 RPCs
create or replace function kafaa_submit_external_cert(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_action text; v_act text; v_ent text; v_role text; c kafaa_external_certs; v_code text; v_url text; v_dup boolean; pp kafaa_people; v_id text;
  v_ids text[]; v_lv jsonb; v_exp date; v_res text; a kafaa_audit_events;
begin
  p := coalesce(p, '{}'::jsonb);
  if jsonb_typeof(p) <> 'object' then p := '{}'::jsonb; end if;
  v_action := kafaa_fs91_s(p->'action');
  v_act := 'xcert.' || case when v_action in ('submit', 'withdraw') then v_action else 'invalid' end;
  v_ent := case when v_action = 'withdraw' then nullif(kafaa_fs91_s(p->'id'), '') end;
  if me is null then return kafaa_refuse(v_act, 'external_certs', v_ent, 'not_signed_in', kafaa_xc_message('not_signed_in')); end if;
  v_role := kafaa_acting_role('recognition', array['Own']);
  if v_role is null then return kafaa_refuse(v_act, 'external_certs', v_ent, 'forbidden', kafaa_xc_message('forbidden_submit')); end if;
  if v_action not in ('submit', 'withdraw') then return kafaa_refuse(v_act, 'external_certs', v_ent, 'invalid', kafaa_xc_message('invalid'), v_role); end if;
  if v_action = 'withdraw' then
    select * into c from kafaa_external_certs where id = v_ent;
    if c.id is null or not kafaa_rule_read('recognition', c.person_id, null, true) then return kafaa_refuse(v_act, 'external_certs', v_ent, 'not_found', kafaa_xc_message('not_found'), v_role); end if;
    v_code := case when c.person_id <> me then 'forbidden' when c.status <> 'submitted' then 'state' else 'ok' end;
    if v_code <> 'ok' then return kafaa_refuse(v_act, 'external_certs', v_ent, kafaa_xc_result_code('w_' || v_code), kafaa_xc_message('w_' || v_code), v_role); end if;
    update kafaa_external_certs set status = 'withdrawn', history = history || jsonb_build_array(kafaa_fs91_hist('withdrawn', null)), updated_at = now() where id = c.id;
    a := kafaa_audit(v_act, 'external_certs', c.id, 'ok', 'submitted -> withdrawn', 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Certificate withdrawn', a, null, jsonb_build_object('id', c.id, 'status', 'withdrawn', 'tier', 'claimed'));
  end if;
  v_url := kafaa_fs91_s(p->'verification_url');
  v_dup := exists (select 1 from kafaa_external_certs x where x.person_id = me and x.verification_url = v_url and x.status in ('submitted', 'verified'));
  v_code := kafaa_xc_check_submit(p, current_date, v_dup);
  if v_code <> 'ok' then return kafaa_refuse(v_act, 'external_certs', null, kafaa_xc_result_code(v_code), kafaa_xc_note_message(v_code), v_role); end if;
  select * into pp from kafaa_people where id = me;
  v_id := 'xc-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 24);
  select array_agg(e #>> '{}' order by e #>> '{}' collate "C") into v_ids from jsonb_array_elements(p->'alignment_ids') e;
  v_lv := case when jsonb_typeof(p->'levels') = 'object' then p->'levels' else '{}'::jsonb end;
  v_exp := case when kafaa_fs91_is_date(p->'expires_on') then (p->>'expires_on')::date end;
  v_res := (select id from kafaa_external_resources where id = kafaa_fs91_s(p->'resource_id'));
  insert into kafaa_external_certs (id, person_id, person_name, title, issuer, issuer_kind, accreditation_ref, credential_ref, issued_on, expires_on, verification_url, resource_id,
    alignment_ids, levels, note, status, history, created_at, updated_at)
  values (v_id, me, coalesce(pp.display_name, ''), kafaa_fs91_s(p->'title'), kafaa_fs91_s(p->'issuer'), kafaa_fs91_s(p->'issuer_kind'), nullif(kafaa_fs91_s(p->'accreditation_ref'), ''),
    kafaa_fs91_s(p->'credential_ref'), (p->>'issued_on')::date, v_exp, v_url, v_res, v_ids, v_lv, nullif(kafaa_fs91_s(p->'note'), ''), 'submitted',
    jsonb_build_array(kafaa_fs91_hist('submitted', null)), now(), now());
  a := kafaa_audit(v_act, 'external_certs', v_id, 'ok', 'submitted ' || kafaa_fs91_s(p->'issuer_kind') || ', ' || cardinality(v_ids) || ' crosswalk entries', 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Certificate added: a verifier will check it', a, null, jsonb_build_object('id', v_id, 'status', 'submitted', 'tier', 'claimed',
    'mapping', kafaa_xc_map(v_ids, v_lv, kafaa_xc_issuer_tier(kafaa_fs91_s(p->'issuer_kind'), kafaa_fs91_s(p->'accreditation_ref')))));
end $$;

create or replace function kafaa_verify_external_cert(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_id text; v_role text; c kafaa_external_certs; v_code text; v_d text; v_note text; v_tier text; m jsonb; k jsonb; v_ev text; v_ids text[] := '{}'; v_n integer;
  a kafaa_audit_events; l integer;
begin
  p := coalesce(p, '{}'::jsonb);
  if jsonb_typeof(p) <> 'object' then p := '{}'::jsonb; end if;
  v_id := nullif(kafaa_fs91_s(p->'id'), '');
  if me is null then return kafaa_refuse('xcert.verify', 'external_certs', v_id, 'not_signed_in', kafaa_xc_message('not_signed_in')); end if;
  v_role := kafaa_acting_role('recognition', array['A']);
  if v_role is null then return kafaa_refuse('xcert.verify', 'external_certs', v_id, 'forbidden', kafaa_xc_message('forbidden_verify')); end if;
  select * into c from kafaa_external_certs where id = v_id;
  if c.id is null then return kafaa_refuse('xcert.verify', 'external_certs', v_id, 'not_found', kafaa_xc_message('not_found'), v_role); end if;
  v_code := kafaa_xc_check_verify(p, c, me, current_date);
  if v_code <> 'ok' then return kafaa_refuse('xcert.verify', 'external_certs', v_id, kafaa_xc_result_code(v_code), kafaa_xc_message(case when v_code = 'note' then 'note' else v_code end), v_role); end if;
  v_d := kafaa_fs91_s(p->'decision');
  v_note := nullif(kafaa_fs91_s(p->'note'), '');
  if v_d = 'reject' then
    update kafaa_external_certs set status = 'rejected', verified_by = me, verified_role = v_role, decision_note = v_note,
      history = history || jsonb_build_array(kafaa_fs91_hist('rejected', v_note)), updated_at = now() where id = v_id;
    perform kafaa_fs91_notify('nt-xc-' || v_id || '-rejected', c.person_id, 'External certificate not verified: ' || c.title, 'لم يُتحقق من الشهادة الخارجية: ' || c.title, '/my/recognition/certificates', 'warn');
    a := kafaa_audit('xcert.verify', 'external_certs', v_id, 'ok', 'submitted -> rejected', 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Certificate not verified', a, null, jsonb_build_object('id', v_id, 'status', 'rejected', 'tier', 'claimed'));
  end if;
  if v_d = 'revoke' then
    update kafaa_skill_evidence set active = false where id = any(coalesce(c.evidence_ids, '{}'::text[]));
    update kafaa_external_certs set status = 'revoked', decision_note = v_note, history = history || jsonb_build_array(kafaa_fs91_hist('revoked', v_note)), updated_at = now() where id = v_id;
    if cardinality(coalesce(c.evidence_ids, '{}'::text[])) > 0 then perform kafaa_skills_apply(c.person_id, current_date); end if;
    perform kafaa_fs91_notify('nt-xc-' || v_id || '-revoked', c.person_id, 'External certificate revoked: ' || c.title, 'أُلغي التحقق من الشهادة الخارجية: ' || c.title, '/my/recognition/certificates', 'warn');
    l := kafaa_ledger('kafaa.xcert.revoke', 'External certificate ' || v_id || ' revoked for ' || c.person_id);
    a := kafaa_audit('xcert.verify', 'external_certs', v_id, 'ok', 'verified -> revoked (' || cardinality(coalesce(c.evidence_ids, '{}'::text[])) || ' evidence rows inactive)',
      case when l is null then 'skipped' else 'written' end, l, v_role);
    return kafaa_result(true, 'ok', 'Verification revoked: its evidence no longer counts', a, l, jsonb_build_object('id', v_id, 'status', 'revoked', 'tier', 'claimed', 'evidence_ids', to_jsonb(coalesce(c.evidence_ids, '{}'::text[]))));
  end if;
  v_tier := kafaa_xc_issuer_tier(c.issuer_kind, c.accreditation_ref);
  m := kafaa_xc_map(c.alignment_ids, c.levels, v_tier);
  for k in select x from jsonb_array_elements(m->'skills') x loop
    v_ev := 'se:xc:' || v_id || ':' || (k->>'skill_id');
    insert into kafaa_skill_evidence (id, person_id, skill_id, kind, ref_table, ref_id, level, basis, status, observed_on, note, recorded_by, active)
    values (v_ev, c.person_id, k->>'skill_id', 'credential', 'external_certs', v_id, (k->>'level')::integer, kafaa_xc_basis(v_tier), 'current', current_date,
      'External certificate (' || v_tier || ')', me, true)
    on conflict (id) do update set level = excluded.level, basis = excluded.basis, status = 'current', observed_on = excluded.observed_on, note = excluded.note, recorded_by = me, active = true;
    v_ids := v_ids || v_ev;
  end loop;
  update kafaa_external_certs set status = 'verified', tier = v_tier, method = kafaa_fs91_s(p->'method'), verified_by = me, verified_role = v_role, verified_on = current_date,
    decision_note = v_note, mapped = m->'rows', evidence_ids = v_ids, history = history || jsonb_build_array(kafaa_fs91_hist('verified', v_note)), updated_at = now() where id = v_id;
  v_n := cardinality(v_ids);
  if v_n > 0 then perform kafaa_skills_apply(c.person_id, current_date); end if;
  perform kafaa_fs91_notify('nt-xc-' || v_id || '-verified', c.person_id, 'External certificate verified: ' || c.title || ' (' || v_n || ' skills)',
    'تم التحقق من الشهادة الخارجية: ' || c.title || ' (' || v_n || ' مهارات)', '/my/recognition/certificates', 'ok');
  l := kafaa_ledger('kafaa.xcert.verify', 'External certificate ' || v_id || ' verified (' || v_tier || ') for ' || c.person_id);
  a := kafaa_audit('xcert.verify', 'external_certs', v_id, 'ok', 'submitted -> verified ' || v_tier || ' (' || v_n || ' skills)', case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Certificate verified', a, l, jsonb_build_object('id', v_id, 'status', 'verified', 'tier', v_tier, 'evidence_ids', to_jsonb(v_ids), 'mapping', m));
end $$;

-- ───────────── Grants: internal helpers are not executable by API roles; RPCs only by signed-in users.
revoke all on function kafaa_fs91_trim(text), kafaa_fs91_s(jsonb), kafaa_fs91_is_date(jsonb), kafaa_fs91_hist(text, text), kafaa_fs91_notify(text, text, text, text, text, text),
  kafaa_lb_grant(text, integer), kafaa_lb_compute(text, integer), kafaa_lb_refresh(text, integer), kafaa_sb_gated(text, date), kafaa_sb_cap(numeric),
  kafaa_sb_check_request(jsonb, kafaa_people, kafaa_external_resources, boolean, integer, boolean, text, date),
  kafaa_sb_check_decide(jsonb, kafaa_study_time_requests, text, boolean, integer, date), kafaa_sb_message(text), kafaa_sb_result_code(text), kafaa_sb_visible(kafaa_study_time_requests),
  kafaa_xc_issuer_tier(text, text), kafaa_xc_trust_tier(kafaa_external_certs), kafaa_xc_cap(text), kafaa_xc_basis(text), kafaa_xc_map(text[], jsonb, text), kafaa_xc_len(jsonb, integer, integer),
  kafaa_xc_optlen(jsonb, integer), kafaa_xc_check_submit(jsonb, date, boolean), kafaa_xc_check_verify(jsonb, kafaa_external_certs, text, date), kafaa_xc_message(text),
  kafaa_xc_note_message(text), kafaa_xc_result_code(text) from public, anon, authenticated;
revoke all on function kafaa_request_study_time(jsonb), kafaa_decide_study_time(jsonb), kafaa_learning_balance(text, integer), kafaa_submit_external_cert(jsonb),
  kafaa_verify_external_cert(jsonb) from public, anon;
grant execute on function kafaa_request_study_time(jsonb), kafaa_decide_study_time(jsonb), kafaa_learning_balance(text, integer), kafaa_submit_external_cert(jsonb),
  kafaa_verify_external_cert(jsonb) to authenticated;
