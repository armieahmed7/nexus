-- [W2 · E4 · F15] Kafa'a Rotations and job shadowing (M20): rotation programme templates, cohorts, placement plans (mid-point
-- check-in, host sign-off writing ojt skill evidence, maker-checker), the shadowing host directory and 1 to 5 day shadowing
-- requests with host and line-manager consent, and the HR programme board (suppressed below 10 people).
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file, RLS in the per-statement form,
-- internal helpers and the RPCs. LocalBackend mirror: src/modules/m20/backend/rotation.local.ts; rules: src/modules/m20/rotation.ts
-- (messages are generated from RMSG there). PGlite checks: scripts/validate/w2e4-rotations.mjs. Uses the F08 helper
-- kafaa_opp_line_manager (20261009114001) and the F01 recompute kafaa_skills_apply (20261009101001).

-- ───────────── Tables (generated DDL)
-- M20 · Rotation programme templates: placement sequence, durations, host role cards and skill objectives (F15)
create table if not exists kafaa_rotation_templates (
  id text primary key,
  programme text not null check (programme in ('gdp', 'gpo', 'dnt', 'cross_functional', 'hipo')),
  owner_id text not null,
  title_en text not null,
  title_ar text not null,
  summary_en text not null,
  summary_ar text not null,
  duration_min_months integer not null,
  duration_max_months integer not null,
  steps jsonb not null default '[]'::jsonb,
  eligible_families text[] not null default '{}'::text[],
  sources jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('draft', 'active', 'retired')),
  listed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table kafaa_rotation_templates is '[M20] Rotation programme templates: placement sequence, durations, host role cards and skill objectives (F15)';

-- M20 · Rotation cohorts (GDP, GPO, DNT and cross-functional intakes; synthetic) (F15)
create table if not exists kafaa_rotation_cohorts (
  id text primary key,
  template_id text not null,
  programme text not null check (programme in ('gdp', 'gpo', 'dnt', 'cross_functional', 'hipo')),
  owner_id text not null,
  name_en text not null,
  name_ar text not null,
  intake_on date not null,
  status text not null default 'running' check (status in ('planned', 'running', 'completed')),
  listed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table kafaa_rotation_cohorts is '[M20] Rotation cohorts (GDP, GPO, DNT and cross-functional intakes; synthetic) (F15)';

-- M20 · Placement plan per person: host, dates, objectives, mid-point check-in and host sign-off writing ojt evidence (F15)
create table if not exists kafaa_rotation_placements (
  id text primary key,
  enrolment_id text not null,
  person_id text not null,
  template_id text not null,
  cohort_id text,
  seq integer not null,
  family_id text not null,
  host_team_en text not null,
  host_team_ar text not null,
  host_role_id text,
  host_manager_id text not null,
  host_name text not null default '',
  host_name_ar text not null default '',
  line_manager_id text,
  signer_id text,
  skip_level boolean not null default false,
  starts_on date not null,
  ends_on date not null,
  site_induction boolean not null default false,
  objectives jsonb not null default '[]'::jsonb,
  status text not null default 'planned' check (status in ('planned', 'active', 'signed_off', 'cancelled')),
  checkin jsonb,
  checkin_at timestamptz,
  checkin_by text,
  signed_off_by text,
  signed_off_at timestamptz,
  outcome_note text,
  outcome_levels jsonb not null default '{}'::jsonb,
  evidence_ids text[] not null default '{}'::text[],
  enrolled_by text,
  person_name text not null default '',
  person_name_ar text not null default '',
  person_role_id text,
  person_family_id text,
  open_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table kafaa_rotation_placements is '[M20] Placement plan per person: host, dates, objectives, mid-point check-in and host sign-off writing ojt evidence (F15)';

-- M20 · Shadowing host directory: staff who offer 1 to 5 day shadowing on named skills (opt-in) (F15)
create table if not exists kafaa_shadow_hosts (
  id text primary key,
  person_id text not null,
  name text not null,
  name_ar text not null,
  role_id text,
  family_id text,
  skill_ids text[] not null default '{}'::text[],
  max_days_month integer not null default 2,
  note_en text,
  note_ar text,
  site_induction boolean not null default false,
  active boolean not null default true,
  listed boolean not null default true,
  updated_at timestamptz not null default now()
);
comment on table kafaa_shadow_hosts is '[M20] Shadowing host directory: staff who offer 1 to 5 day shadowing on named skills (opt-in) (F15)';

-- M20 · Job-shadowing requests (1 to 5 days) with host and line-manager consent; completion writes ojt evidence (F15)
create table if not exists kafaa_shadow_requests (
  id text primary key,
  person_id text not null,
  host_id text not null,
  line_manager_id text,
  host_family_id text,
  host_role_id text,
  start_on date not null,
  days integer not null,
  skill_ids text[] not null default '{}'::text[],
  purpose text not null,
  status text not null default 'requested' check (status in ('requested', 'approved', 'declined', 'withdrawn', 'completed')),
  host_consent boolean,
  manager_consent boolean,
  host_note text,
  manager_note text,
  site_induction boolean not null default false,
  person_name text not null default '',
  person_name_ar text not null default '',
  person_role_id text,
  person_family_id text,
  host_name text not null default '',
  host_name_ar text not null default '',
  reflection text,
  completed_at timestamptz,
  evidence_ids text[] not null default '{}'::text[],
  history jsonb not null default '[]'::jsonb,
  open_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table kafaa_shadow_requests is '[M20] Job-shadowing requests (1 to 5 days) with host and line-manager consent; completion writes ojt evidence (F15)';

do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_rotation_templates_owner_id_fk') then alter table kafaa_rotation_templates add constraint kafaa_rotation_templates_owner_id_fk foreign key (owner_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_rotation_cohorts_template_id_fk') then alter table kafaa_rotation_cohorts add constraint kafaa_rotation_cohorts_template_id_fk foreign key (template_id) references kafaa_rotation_templates(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_rotation_cohorts_owner_id_fk') then alter table kafaa_rotation_cohorts add constraint kafaa_rotation_cohorts_owner_id_fk foreign key (owner_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_rotation_placements_person_id_fk') then alter table kafaa_rotation_placements add constraint kafaa_rotation_placements_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_rotation_placements_template_id_fk') then alter table kafaa_rotation_placements add constraint kafaa_rotation_placements_template_id_fk foreign key (template_id) references kafaa_rotation_templates(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_rotation_placements_cohort_id_fk') then alter table kafaa_rotation_placements add constraint kafaa_rotation_placements_cohort_id_fk foreign key (cohort_id) references kafaa_rotation_cohorts(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_rotation_placements_family_id_fk') then alter table kafaa_rotation_placements add constraint kafaa_rotation_placements_family_id_fk foreign key (family_id) references kafaa_job_families(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_rotation_placements_host_role_id_fk') then alter table kafaa_rotation_placements add constraint kafaa_rotation_placements_host_role_id_fk foreign key (host_role_id) references kafaa_job_roles(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_rotation_placements_host_manager_id_fk') then alter table kafaa_rotation_placements add constraint kafaa_rotation_placements_host_manager_id_fk foreign key (host_manager_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_rotation_placements_line_manager_id_fk') then alter table kafaa_rotation_placements add constraint kafaa_rotation_placements_line_manager_id_fk foreign key (line_manager_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_rotation_placements_signer_id_fk') then alter table kafaa_rotation_placements add constraint kafaa_rotation_placements_signer_id_fk foreign key (signer_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_rotation_placements_enrolled_by_fk') then alter table kafaa_rotation_placements add constraint kafaa_rotation_placements_enrolled_by_fk foreign key (enrolled_by) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_shadow_hosts_person_id_fk') then alter table kafaa_shadow_hosts add constraint kafaa_shadow_hosts_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_shadow_hosts_role_id_fk') then alter table kafaa_shadow_hosts add constraint kafaa_shadow_hosts_role_id_fk foreign key (role_id) references kafaa_job_roles(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_shadow_hosts_family_id_fk') then alter table kafaa_shadow_hosts add constraint kafaa_shadow_hosts_family_id_fk foreign key (family_id) references kafaa_job_families(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_shadow_requests_person_id_fk') then alter table kafaa_shadow_requests add constraint kafaa_shadow_requests_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_shadow_requests_host_id_fk') then alter table kafaa_shadow_requests add constraint kafaa_shadow_requests_host_id_fk foreign key (host_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_shadow_requests_line_manager_id_fk') then alter table kafaa_shadow_requests add constraint kafaa_shadow_requests_line_manager_id_fk foreign key (line_manager_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_rotation_templates_programme_idx on kafaa_rotation_templates (programme);
create index if not exists kafaa_rotation_templates_owner_id_idx on kafaa_rotation_templates (owner_id);
create index if not exists kafaa_rotation_templates_status_idx on kafaa_rotation_templates (status);
create index if not exists kafaa_rotation_cohorts_template_id_idx on kafaa_rotation_cohorts (template_id);
create index if not exists kafaa_rotation_cohorts_owner_id_idx on kafaa_rotation_cohorts (owner_id);
create index if not exists kafaa_rotation_placements_enrolment_id_idx on kafaa_rotation_placements (enrolment_id);
create index if not exists kafaa_rotation_placements_person_id_idx on kafaa_rotation_placements (person_id);
create index if not exists kafaa_rotation_placements_template_id_idx on kafaa_rotation_placements (template_id);
create index if not exists kafaa_rotation_placements_cohort_id_idx on kafaa_rotation_placements (cohort_id);
create index if not exists kafaa_rotation_placements_family_id_idx on kafaa_rotation_placements (family_id);
create index if not exists kafaa_rotation_placements_host_role_id_idx on kafaa_rotation_placements (host_role_id);
create index if not exists kafaa_rotation_placements_host_manager_id_idx on kafaa_rotation_placements (host_manager_id);
create index if not exists kafaa_rotation_placements_line_manager_id_idx on kafaa_rotation_placements (line_manager_id);
create index if not exists kafaa_rotation_placements_signer_id_idx on kafaa_rotation_placements (signer_id);
create index if not exists kafaa_rotation_placements_status_idx on kafaa_rotation_placements (status);
create index if not exists kafaa_rotation_placements_enrolled_by_idx on kafaa_rotation_placements (enrolled_by);
create index if not exists kafaa_shadow_hosts_person_id_idx on kafaa_shadow_hosts (person_id);
create index if not exists kafaa_shadow_hosts_role_id_idx on kafaa_shadow_hosts (role_id);
create index if not exists kafaa_shadow_hosts_family_id_idx on kafaa_shadow_hosts (family_id);
create index if not exists kafaa_shadow_requests_person_id_idx on kafaa_shadow_requests (person_id);
create index if not exists kafaa_shadow_requests_host_id_idx on kafaa_shadow_requests (host_id);
create index if not exists kafaa_shadow_requests_line_manager_id_idx on kafaa_shadow_requests (line_manager_id);
create index if not exists kafaa_shadow_requests_status_idx on kafaa_shadow_requests (status);

-- ───────────── RLS (policies created when missing, then set to the per-statement form like 20261008140000_kafaa_rls_perf.sql)
-- Staff hold R on opportunities: `listed` opens programme templates, cohorts and the host directory; `open_read` (always false)
-- keeps placements and shadow requests to the people named on the row. Admins and auditors (R on audit_log) read all rows.
alter table kafaa_rotation_templates enable row level security;
alter table kafaa_rotation_cohorts enable row level security;
alter table kafaa_rotation_placements enable row level security;
alter table kafaa_shadow_hosts enable row level security;
alter table kafaa_shadow_requests enable row level security;
do $$ declare t text; begin
  foreach t in array array['kafaa_rotation_templates', 'kafaa_rotation_cohorts', 'kafaa_rotation_placements', 'kafaa_shadow_hosts', 'kafaa_shadow_requests'] loop
    if not exists (select 1 from pg_policies where tablename = t and policyname = 'kafaa_read') then
      execute format('create policy kafaa_read on %I for select to anon, authenticated using (false)', t);
    end if;
  end loop;
end $$;
alter policy kafaa_read on kafaa_rotation_templates using (((COALESCE(listed, false) AND (SELECT kafaa_has_grant('opportunities'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))) OR ((owner_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('opportunities'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('audit_log'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))));
alter policy kafaa_read on kafaa_rotation_cohorts using (((COALESCE(listed, false) AND (SELECT kafaa_has_grant('opportunities'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))) OR ((owner_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('opportunities'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('audit_log'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))));
alter policy kafaa_read on kafaa_rotation_placements using (((SELECT kafaa_me()) IN (person_id, host_manager_id, signer_id, line_manager_id, enrolled_by) AND (SELECT kafaa_has_grant('opportunities'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((COALESCE(open_read, false) AND (SELECT kafaa_has_grant('opportunities'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))) OR ((SELECT kafaa_has_grant('audit_log'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))));
alter policy kafaa_read on kafaa_shadow_hosts using (((COALESCE(listed, false) AND (SELECT kafaa_has_grant('opportunities'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('opportunities'::text, ARRAY['Own'::text, 'Scope'::text]))));
alter policy kafaa_read on kafaa_shadow_requests using (((SELECT kafaa_me()) IN (person_id, host_id, line_manager_id) AND (SELECT kafaa_has_grant('opportunities'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((COALESCE(open_read, false) AND (SELECT kafaa_has_grant('opportunities'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))) OR ((SELECT kafaa_has_grant('audit_log'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))));
grant select on kafaa_rotation_templates, kafaa_rotation_cohorts, kafaa_rotation_placements, kafaa_shadow_hosts, kafaa_shadow_requests to anon, authenticated;
-- These tables change only through the SECURITY DEFINER RPCs below.
revoke insert, update on kafaa_rotation_templates, kafaa_rotation_cohorts, kafaa_rotation_placements, kafaa_shadow_hosts, kafaa_shadow_requests from anon, authenticated;

-- ───────────── Internal helpers (mirror of src/modules/m20/rotation.ts)
-- Programme-owner role of the caller: hr_analyst (Agg), hr_director (Agg) or training_manager (W) on opportunities, first alphabetically.
create or replace function kafaa_rot_owner_role() returns text language sql stable security definer set search_path = public as $$
  select r from unnest(array['hr_analyst', 'hr_director', 'training_manager']) with ordinality as u(r, o)
   where kafaa_role_grant(r, 'opportunities', case r when 'training_manager' then 'W' else 'Agg' end) order by o limit 1
$$;
-- Can this person host a placement: active staff holding an active manager or training-manager assignment.
create or replace function kafaa_rot_is_host(p_id text, p_today date) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from kafaa_people p where p.id = p_id and p.kind = 'staff' and coalesce(p.status, '') <> 'leaver')
     and exists (select 1 from kafaa_role_assignments ra where ra.person_id = p_id and ra.role in ('manager', 'training_manager') and ra.status = 'active' and (ra.expires_at is null or ra.expires_at::date >= p_today))
$$;
-- Default host for a family: the holder of an active family-scoped manager assignment (lowest person id).
create or replace function kafaa_rot_family_host(p_family text, p_today date) returns text language sql stable security definer set search_path = public as $$
  select ra.person_id from kafaa_role_assignments ra
   where ra.role = 'manager' and ra.status = 'active' and ra.scope_type = 'family' and ra.scope_value = p_family and (ra.expires_at is null or ra.expires_at::date >= p_today)
     and kafaa_rot_is_host(ra.person_id, p_today)
   order by ra.person_id collate "C" limit 1
$$;
-- Sign-off route: the host, unless the host is the person or the person's own line manager (maker-checker); then the host's line manager.
create or replace function kafaa_rot_signer(p_person text, p_host text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_lm text := kafaa_opp_line_manager(p_person); v_skip text;
begin
  if p_host <> p_person and p_host is distinct from v_lm then return jsonb_build_object('line_manager', v_lm, 'signer', p_host, 'skip_level', false); end if;
  v_skip := kafaa_opp_line_manager(p_host);
  return jsonb_build_object('line_manager', v_lm, 'signer', case when v_skip is not null and v_skip <> p_person then v_skip end, 'skip_level', true);
end $$;
create or replace function kafaa_rot_len(j jsonb) returns integer language sql immutable set search_path = public as $$
  select case when jsonb_typeof(j) = 'string' then length(btrim(j #>> '{}')) else -1 end
$$;
create or replace function kafaa_rot_int(j jsonb, lo integer, hi integer) returns boolean language sql immutable set search_path = public as $$
  select coalesce(jsonb_typeof(j) = 'number' and (j::text)::numeric = trunc((j::text)::numeric) and (j::text)::numeric between lo and hi, false)
$$;
create or replace function kafaa_rot_is_date(t text) returns boolean language plpgsql immutable set search_path = public as $$
begin
  if t is null or t !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
  perform t::date;
  return to_char(t::date, 'YYYY-MM-DD') = t;
exception when others then return false;
end $$;
create or replace function kafaa_rot_notify(p_id text, p_person text, p_en text, p_ar text, p_link text, p_sev text) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_person is null or not exists (select 1 from kafaa_people where id = p_person) then return; end if;
  insert into kafaa_notifications (id, person_id, kind, title_en, title_ar, link, severity) values (p_id, p_person, 'rotation', p_en, p_ar, p_link, p_sev) on conflict (id) do nothing;
end $$;
create or replace function kafaa_rot_hist(p_status text, p_note text) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'status', p_status, 'by', kafaa_me(), 'note', nullif(btrim(coalesce(p_note, '')), ''))
$$;
-- ojt evidence (basis evidenced, level 1..3) per skill, in skill-id order, then the F01 recompute for the person.
create or replace function kafaa_rot_evidence(p_ref_table text, p_ref_id text, p_person text, p_levels jsonb, p_title text) returns text[] language plpgsql security definer set search_path = public as $$
declare k text; v jsonb; v_ids text[] := '{}'::text[]; v_eid text;
begin
  for k, v in select key, value from jsonb_each(p_levels) order by key collate "C" loop
    v_eid := 'se:ojt:' || p_ref_id || ':' || k;
    insert into kafaa_skill_evidence (id, person_id, skill_id, kind, ref_table, ref_id, level, basis, status, observed_on, note, recorded_by, active)
    values (v_eid, p_person, k, 'ojt', p_ref_table, p_ref_id, least(3, greatest(1, round((v::text)::numeric)::integer)), 'evidenced', 'current', current_date,
      case when p_ref_table = 'rotation_placements' then 'Rotation: ' else 'Shadowing: ' end || p_title, kafaa_me(), true)
    on conflict (id) do update set level = excluded.level, observed_on = excluded.observed_on, active = true;
    v_ids := v_ids || v_eid;
  end loop;
  perform kafaa_skills_apply(p_person, current_date);
  return v_ids;
end $$;
-- Row visibility (same rules as the RLS policies above).
create or replace function kafaa_rot_tpl_visible(t kafaa_rotation_templates) returns boolean language sql stable security definer set search_path = public as $$
  select (coalesce(t.listed, false) and kafaa_has_grant('opportunities', array['R','W','A'])) or (t.owner_id = kafaa_me() and kafaa_has_grant('opportunities', array['Own','Scope'])) or kafaa_has_grant('audit_log', array['R','W','A'])
$$;
create or replace function kafaa_rot_cohort_visible(c kafaa_rotation_cohorts) returns boolean language sql stable security definer set search_path = public as $$
  select (coalesce(c.listed, false) and kafaa_has_grant('opportunities', array['R','W','A'])) or (c.owner_id = kafaa_me() and kafaa_has_grant('opportunities', array['Own','Scope'])) or kafaa_has_grant('audit_log', array['R','W','A'])
$$;
create or replace function kafaa_rot_placement_visible(x kafaa_rotation_placements) returns boolean language sql stable security definer set search_path = public as $$
  select (kafaa_me() in (x.person_id, x.host_manager_id, x.signer_id, x.line_manager_id, x.enrolled_by) and kafaa_has_grant('opportunities', array['Own','Scope'])) or kafaa_has_grant('audit_log', array['R','W','A'])
$$;
create or replace function kafaa_rot_shadow_visible(x kafaa_shadow_requests) returns boolean language sql stable security definer set search_path = public as $$
  select (kafaa_me() in (x.person_id, x.host_id, x.line_manager_id) and kafaa_has_grant('opportunities', array['Own','Scope'])) or kafaa_has_grant('audit_log', array['R','W','A'])
$$;

-- Content checks for a template (validateTemplate). Returns {code, message} or {steps: normalised steps}.
create or replace function kafaa_rot_validate_template(p jsonb, p_today date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_steps jsonb := case when jsonb_typeof(p->'steps') = 'array' then p->'steps' end; s jsonb; o jsonb; v_objs jsonb; v_hosts text[] := '{}'::text[]; v_h text; v_total integer := 0; v_out jsonb;
  bad constant jsonb := '{"code":"invalid"}'::jsonb;
begin
  if v_steps is not null and exists (select 1 from jsonb_array_elements(v_steps) st(s)
       where (st.s->>'family_id') in ('security', 'cyber', 'safeguards')
          or exists (select 1 from jsonb_array_elements(case when jsonb_typeof(st.s->'objectives') = 'array' then st.s->'objectives' else '[]'::jsonb end) ob(o)
                      join kafaa_skills k on k.id = ob.o->>'skill_id' where k.area in ('security'))) then
    return jsonb_build_object('code', 'restricted_kind', 'message', 'Security, cyber and safeguards placements are career-path only and cannot be part of a rotation');
  end if;
  if coalesce(p->>'programme', '') not in ('gdp', 'gpo', 'dnt', 'cross_functional', 'hipo') then return bad || jsonb_build_object('message', 'Unknown programme'); end if;
  if kafaa_rot_len(p->'title_en') not between 5 and 120 or kafaa_rot_len(p->'title_ar') not between 5 and 120 or kafaa_rot_len(p->'summary_en') not between 20 and 1000 or kafaa_rot_len(p->'summary_ar') not between 20 and 1000 then
    return bad || jsonb_build_object('message', 'Give an English and an Arabic title (5 to 120 characters) and summary (20 to 1,000 characters)');
  end if;
  if not kafaa_rot_int(p->'duration_min_months', 1, 48) or not kafaa_rot_int(p->'duration_max_months', 1, 48) or (p->>'duration_min_months')::numeric > (p->>'duration_max_months')::numeric then
    return bad || jsonb_build_object('message', 'Set a minimum and maximum duration between 1 and 48 months (minimum not above maximum)');
  end if;
  if v_steps is null or jsonb_array_length(v_steps) < 1 or jsonb_array_length(v_steps) > 8 then return bad || jsonb_build_object('message', 'Each placement needs a known job family, a host team in English and Arabic, 1 to 12 months and 1 to 5 objectives tied to catalogue skills at levels 1 to 3'); end if;
  for s in select value from jsonb_array_elements(v_steps) loop
    v_objs := case when jsonb_typeof(s->'objectives') = 'array' then s->'objectives' end;
    if jsonb_typeof(s) <> 'object' or not exists (select 1 from kafaa_job_families f where f.id = s->>'family_id')
       or kafaa_rot_len(s->'host_team_en') not between 2 and 80 or kafaa_rot_len(s->'host_team_ar') not between 2 and 80 or not kafaa_rot_int(s->'months', 1, 12)
       or (s->'host_role_id' is not null and jsonb_typeof(s->'host_role_id') <> 'null' and not exists (select 1 from kafaa_job_roles r where r.id = s->>'host_role_id'))
       or (s->'site_induction' is not null and jsonb_typeof(s->'site_induction') not in ('null', 'boolean'))
       or v_objs is null or jsonb_array_length(v_objs) < 1 or jsonb_array_length(v_objs) > 5
       or exists (select 1 from jsonb_array_elements(v_objs) ob(o) where jsonb_typeof(ob.o) <> 'object' or not exists (select 1 from kafaa_skills k where k.id = ob.o->>'skill_id')
                   or not kafaa_rot_int(ob.o->'level', 1, 3) or kafaa_rot_len(ob.o->'text_en') not between 5 and 200 or kafaa_rot_len(ob.o->'text_ar') not between 5 and 200)
       or (select count(distinct ob.o->>'skill_id') from jsonb_array_elements(v_objs) ob(o)) <> jsonb_array_length(v_objs) then
      return bad || jsonb_build_object('message', 'Each placement needs a known job family, a host team in English and Arabic, 1 to 12 months and 1 to 5 objectives tied to catalogue skills at levels 1 to 3');
    end if;
  end loop;
  for s in select value from jsonb_array_elements(v_steps) loop
    v_h := nullif(s->>'host_manager_id', '');
    v_h := case when v_h is not null then (case when kafaa_rot_is_host(v_h, p_today) then v_h end) else kafaa_rot_family_host(s->>'family_id', p_today) end;
    if v_h is null then return bad || jsonb_build_object('message', 'Each placement needs a host manager (a line manager or the training manager)'); end if;
    v_hosts := v_hosts || v_h;
    v_total := v_total + (s->>'months')::numeric::integer;
  end loop;
  if v_total < (p->>'duration_min_months')::numeric or v_total > (p->>'duration_max_months')::numeric then return bad || jsonb_build_object('message', 'The placements must add up to the programme duration (between the minimum and maximum months)'); end if;
  if (p->'eligible_families' is not null and jsonb_typeof(p->'eligible_families') not in ('null', 'array'))
     or exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(p->'eligible_families') = 'array' then p->'eligible_families' else '[]'::jsonb end) f(x) where not exists (select 1 from kafaa_job_families j where j.id = f.x))
     or (p->'source_ids' is not null and jsonb_typeof(p->'source_ids') not in ('null', 'array'))
     or exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(p->'source_ids') = 'array' then p->'source_ids' else '[]'::jsonb end) f(x) where not exists (select 1 from kafaa_sources so where so.id = f.x)) then
    return bad || jsonb_build_object('message', 'Unknown job family or source');
  end if;
  if p->>'status' is not null and p->>'status' not in ('draft', 'active', 'retired') then return bad || jsonb_build_object('message', 'A programme is a draft, active or retired'); end if;
  select jsonb_agg(jsonb_build_object(
      'seq', st.i, 'family_id', st.s->>'family_id', 'host_team_en', btrim(st.s->>'host_team_en'), 'host_team_ar', btrim(st.s->>'host_team_ar'),
      'host_role_id', case when jsonb_typeof(st.s->'host_role_id') = 'string' then st.s->'host_role_id' else 'null'::jsonb end,
      'host_manager_id', v_hosts[st.i], 'months', (st.s->>'months')::numeric::integer,
      'host_name_en', coalesce((select hp.display_name from kafaa_people hp where hp.id = v_hosts[st.i]), v_hosts[st.i]),
      'host_name_ar', coalesce((select coalesce(nullif(hp.display_name_ar, ''), hp.display_name) from kafaa_people hp where hp.id = v_hosts[st.i]), v_hosts[st.i]),
      'site_induction', case when jsonb_typeof(st.s->'site_induction') = 'boolean' then (st.s->>'site_induction')::boolean
                             else (st.s->>'family_id') = any(array['operations', 'maintenance', 'radiation-protection', 'chemistry', 'outage', 'fire-protection', 'emergency-preparedness', 'nuclear-fuel']) end,
      'objectives', (select jsonb_agg(jsonb_build_object('id', 'o' || st.i || '-' || ob.j, 'skill_id', ob.o->>'skill_id', 'level', (ob.o->>'level')::numeric::integer,
                       'text_en', btrim(ob.o->>'text_en'), 'text_ar', btrim(ob.o->>'text_ar')) order by ob.j) from jsonb_array_elements(st.s->'objectives') with ordinality ob(o, j))
    ) order by st.i) into v_out
  from jsonb_array_elements(v_steps) with ordinality st(s, i);
  return jsonb_build_object('steps', v_out);
end $$;

-- ───────────── RPC: create or update a programme template (HR programme owners). Restricted placements refused and audited.
create or replace function kafaa_save_rotation_template(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; t kafaa_rotation_templates; v jsonb; v_status text := coalesce(p->>'status', 'active'); v_id text; v_src jsonb; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('rotation.template', 'rotation_templates', p->>'id', 'not_signed_in', 'Sign in to use rotations and shadowing'); end if;
  v_role := kafaa_rot_owner_role();
  if v_role is null then return kafaa_refuse('rotation.template', 'rotation_templates', p->>'id', 'forbidden', 'Only HR programme owners and the training manager manage rotation programmes'); end if;
  if nullif(p->>'id', '') is not null then
    select * into t from kafaa_rotation_templates where id = p->>'id';
    if t.id is null or not kafaa_rot_tpl_visible(t) then return kafaa_refuse('rotation.template', 'rotation_templates', p->>'id', 'not_found', 'Rotation programme not found', v_role); end if;
    if t.owner_id <> me and v_role <> 'training_manager' then return kafaa_refuse('rotation.template', 'rotation_templates', p->>'id', 'forbidden', 'Only the programme owner or the training manager can change this programme', v_role); end if;
  end if;
  v := kafaa_rot_validate_template(p, current_date);
  if v ? 'code' then return kafaa_refuse('rotation.template', 'rotation_templates', p->>'id', v->>'code', v->>'message', v_role); end if;
  v_src := coalesce((select jsonb_agg(jsonb_build_object('id', so.id, 'label', so.label, 'url', so.url) order by x.o)
                       from jsonb_array_elements_text(case when jsonb_typeof(p->'source_ids') = 'array' then p->'source_ids' else '[]'::jsonb end) with ordinality x(sid, o)
                       join kafaa_sources so on so.id = x.sid), '[]'::jsonb);
  if t.id is not null then
    v_id := t.id;
    update kafaa_rotation_templates set programme = p->>'programme', title_en = btrim(p->>'title_en'), title_ar = btrim(p->>'title_ar'), summary_en = btrim(p->>'summary_en'), summary_ar = btrim(p->>'summary_ar'),
      duration_min_months = (p->>'duration_min_months')::numeric::integer, duration_max_months = (p->>'duration_max_months')::numeric::integer, steps = v->'steps',
      eligible_families = array(select jsonb_array_elements_text(case when jsonb_typeof(p->'eligible_families') = 'array' then p->'eligible_families' else '[]'::jsonb end)),
      sources = v_src, status = v_status, listed = v_status <> 'draft', updated_at = now() where id = v_id;
  else
    v_id := 'rt-' || replace(gen_random_uuid()::text, '-', '');
    insert into kafaa_rotation_templates (id, programme, owner_id, title_en, title_ar, summary_en, summary_ar, duration_min_months, duration_max_months, steps, eligible_families, sources, status, listed, created_at, updated_at)
    values (v_id, p->>'programme', me, btrim(p->>'title_en'), btrim(p->>'title_ar'), btrim(p->>'summary_en'), btrim(p->>'summary_ar'), (p->>'duration_min_months')::numeric::integer, (p->>'duration_max_months')::numeric::integer,
      v->'steps', array(select jsonb_array_elements_text(case when jsonb_typeof(p->'eligible_families') = 'array' then p->'eligible_families' else '[]'::jsonb end)), v_src, v_status, v_status <> 'draft', now(), now());
  end if;
  a := kafaa_audit('rotation.template', 'rotation_templates', v_id, 'ok', (p->>'programme') || ' ' || v_status, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when t.id is not null then 'Programme updated' when v_status = 'draft' then 'Draft saved' else 'Programme saved' end, a, null, jsonb_build_object('id', v_id, 'status', v_status));
end $$;

-- ───────────── RPC: create or update a cohort (programme owners)
create or replace function kafaa_save_rotation_cohort(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; c kafaa_rotation_cohorts; t kafaa_rotation_templates; v_status text := coalesce(p->>'status', 'running'); v_id text; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('rotation.cohort', 'rotation_cohorts', p->>'id', 'not_signed_in', 'Sign in to use rotations and shadowing'); end if;
  v_role := kafaa_rot_owner_role();
  if v_role is null then return kafaa_refuse('rotation.cohort', 'rotation_cohorts', p->>'id', 'forbidden', 'Only HR programme owners and the training manager manage rotation programmes'); end if;
  if nullif(p->>'id', '') is not null then
    select * into c from kafaa_rotation_cohorts where id = p->>'id';
    if c.id is null or not kafaa_rot_cohort_visible(c) then return kafaa_refuse('rotation.cohort', 'rotation_cohorts', p->>'id', 'not_found', 'Cohort not found', v_role); end if;
    if c.owner_id <> me and v_role <> 'training_manager' then return kafaa_refuse('rotation.cohort', 'rotation_cohorts', p->>'id', 'forbidden', 'Only the programme owner or the training manager can change this programme', v_role); end if;
  end if;
  select * into t from kafaa_rotation_templates where id = coalesce(p->>'template_id', '');
  if t.id is null or not kafaa_rot_tpl_visible(t) or t.status = 'retired' then return kafaa_refuse('rotation.cohort', 'rotation_cohorts', p->>'id', 'not_found', 'Rotation programme not found', v_role); end if;
  if kafaa_rot_len(p->'name_en') not between 3 and 120 or kafaa_rot_len(p->'name_ar') not between 3 and 120 or not kafaa_rot_is_date(p->>'intake_on') or v_status not in ('planned', 'running', 'completed') then
    return kafaa_refuse('rotation.cohort', 'rotation_cohorts', p->>'id', 'invalid', 'Give the cohort an English and an Arabic name (3 to 120 characters) and an intake date', v_role);
  end if;
  if c.id is not null then
    v_id := c.id;
    update kafaa_rotation_cohorts set template_id = t.id, programme = t.programme, name_en = btrim(p->>'name_en'), name_ar = btrim(p->>'name_ar'), intake_on = (p->>'intake_on')::date, status = v_status, listed = true, updated_at = now() where id = v_id;
  else
    v_id := 'rc-' || replace(gen_random_uuid()::text, '-', '');
    insert into kafaa_rotation_cohorts (id, template_id, programme, owner_id, name_en, name_ar, intake_on, status, listed, created_at, updated_at)
    values (v_id, t.id, t.programme, me, btrim(p->>'name_en'), btrim(p->>'name_ar'), (p->>'intake_on')::date, v_status, true, now(), now());
  end if;
  a := kafaa_audit('rotation.cohort', 'rotation_cohorts', v_id, 'ok', t.id || ' ' || v_status, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when c.id is not null then 'Cohort updated' else 'Cohort created' end, a, null, jsonb_build_object('id', v_id));
end $$;

-- ───────────── RPC: enrol a staff member (programme owners): one placement per template step, with the sign-off route. Ledger row.
create or replace function kafaa_enrol_rotation(p_template_id text, p_person_id text, p_cohort_id text default null, p_start_on text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; t kafaa_rotation_templates; pp kafaa_people; c kafaa_rotation_cohorts; v_start date; s jsonb; i integer; v_cum integer := 0; v_routes jsonb := '[]'::jsonb; r jsonb;
  v_enr text; v_pid text; v_ids text[] := '{}'::text[]; v_signers text[] := '{}'::text[]; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('rotation.enrol', 'rotation_placements', p_person_id, 'not_signed_in', 'Sign in to use rotations and shadowing'); end if;
  v_role := kafaa_rot_owner_role();
  if v_role is null then return kafaa_refuse('rotation.enrol', 'rotation_placements', p_person_id, 'forbidden', 'Only HR programme owners and the training manager manage rotation programmes'); end if;
  select * into t from kafaa_rotation_templates where id = coalesce(p_template_id, '');
  if t.id is null or not kafaa_rot_tpl_visible(t) then return kafaa_refuse('rotation.enrol', 'rotation_placements', p_person_id, 'not_found', 'Rotation programme not found', v_role); end if;
  if t.status <> 'active' then return kafaa_refuse('rotation.enrol', 'rotation_placements', p_person_id, 'invalid', 'Only an active programme can take enrolments', v_role); end if;
  select * into pp from kafaa_people where id = coalesce(p_person_id, '');
  if pp.id is null or pp.kind <> 'staff' or coalesce(pp.status, '') = 'leaver' then return kafaa_refuse('rotation.enrol', 'rotation_placements', p_person_id, 'not_found', 'Person not found', v_role); end if;
  if nullif(p_cohort_id, '') is not null then
    select * into c from kafaa_rotation_cohorts where id = p_cohort_id;
    if c.id is null then return kafaa_refuse('rotation.enrol', 'rotation_placements', p_person_id, 'not_found', 'Cohort not found', v_role); end if;
    if c.template_id <> t.id or c.status = 'completed' then return kafaa_refuse('rotation.enrol', 'rotation_placements', p_person_id, 'invalid', 'That cohort belongs to another programme', v_role); end if;
  end if;
  if cardinality(t.eligible_families) > 0 and not (coalesce(pp.job_family_id, '') = any(t.eligible_families)) then
    return kafaa_refuse('rotation.enrol', 'rotation_placements', p_person_id, 'not_eligible', 'This programme is open to other job families', v_role);
  end if;
  if not kafaa_rot_is_date(p_start_on) or p_start_on::date < current_date or p_start_on::date - current_date > 365 then
    return kafaa_refuse('rotation.enrol', 'rotation_placements', p_person_id, 'invalid', 'Start between today and twelve months from now', v_role);
  end if;
  v_start := p_start_on::date;
  if exists (select 1 from kafaa_rotation_placements x where x.person_id = pp.id and x.template_id = t.id and x.status <> 'cancelled') then
    return kafaa_refuse('rotation.enrol', 'rotation_placements', p_person_id, 'conflict', 'This person is already enrolled in this programme', v_role);
  end if;
  for s in select value from jsonb_array_elements(t.steps) loop
    r := kafaa_rot_signer(pp.id, s->>'host_manager_id');
    if r->>'signer' is null then return kafaa_refuse('rotation.enrol', 'rotation_placements', p_person_id, 'no_host', 'A placement has no one who can sign it off; update the programme hosts', v_role); end if;
    v_routes := v_routes || jsonb_build_array(r);
  end loop;
  v_enr := 're-' || replace(gen_random_uuid()::text, '-', '');
  i := 0;
  for s in select value from jsonb_array_elements(t.steps) loop
    r := v_routes->i;
    i := i + 1;
    v_pid := 'rp-' || substr(v_enr, 4) || '-' || (s->>'seq');
    insert into kafaa_rotation_placements (id, enrolment_id, person_id, template_id, cohort_id, seq, family_id, host_team_en, host_team_ar, host_role_id, host_manager_id, host_name, host_name_ar,
      line_manager_id, signer_id, skip_level, starts_on, ends_on, site_induction, objectives, status, outcome_levels, evidence_ids, enrolled_by, person_name, person_name_ar,
      person_role_id, person_family_id, open_read, created_at, updated_at)
    values (v_pid, v_enr, pp.id, t.id, nullif(p_cohort_id, ''), (s->>'seq')::integer, s->>'family_id', s->>'host_team_en', s->>'host_team_ar', s->>'host_role_id', s->>'host_manager_id',
      coalesce(s->>'host_name_en', ''), coalesce(s->>'host_name_ar', ''),
      r->>'line_manager', r->>'signer', (r->>'skip_level')::boolean, (v_start + make_interval(months => v_cum))::date, ((v_start + make_interval(months => v_cum + (s->>'months')::integer))::date - 1),
      coalesce((s->>'site_induction')::boolean, false), s->'objectives', 'planned', '{}'::jsonb, '{}'::text[], me, pp.display_name, coalesce(nullif(pp.display_name_ar, ''), pp.display_name),
      pp.job_role_id, pp.job_family_id, false, now(), now());
    v_cum := v_cum + (s->>'months')::integer;
    v_ids := v_ids || v_pid;
    v_signers := v_signers || (r->>'signer');
  end loop;
  perform kafaa_rot_notify('nt-' || v_enr || '-enrolled', pp.id, 'You are enrolled: ' || t.title_en, 'تم تسجيلك: ' || t.title_ar, '/opportunities/rotations/my', 'ok');
  perform kafaa_rot_notify('nt-' || v_enr || '-host', t.steps->0->>'host_manager_id', 'New rotation placement to host: ' || t.title_en, 'تناوب جديد للاستضافة: ' || t.title_ar, '/opportunities/rotations/host', 'info');
  l := kafaa_ledger('kafaa.rotation.enrol', format('Rotation %s enrolment %s for %s', t.id, v_enr, pp.id));
  a := kafaa_audit('rotation.enrol', 'rotation_placements', v_enr, 'ok', format('%s -> %s (%s placements from %s)', pp.id, t.id, cardinality(v_ids), p_start_on), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Enrolled; placement plan created', a, l, jsonb_build_object('enrolment_id', v_enr, 'placement_ids', to_jsonb(v_ids), 'signers', to_jsonb(v_signers)));
end $$;

-- ───────────── RPC: mid-point check-in (the person or the host)
create or replace function kafaa_placement_checkin(p_placement_id text, p_progress jsonb, p_note text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); x kafaa_rotation_placements; v_role text; v_note text := btrim(coalesce(p_note, '')); v_pr jsonb := '{}'::jsonb; o jsonb; v_ok boolean := true; v_other text; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('rotation.checkin', 'rotation_placements', p_placement_id, 'not_signed_in', 'Sign in to use rotations and shadowing'); end if;
  select * into x from kafaa_rotation_placements where id = coalesce(p_placement_id, '');
  if x.id is null or not kafaa_rot_placement_visible(x) then return kafaa_refuse('rotation.checkin', 'rotation_placements', p_placement_id, 'not_found', 'Placement not found'); end if;
  v_role := kafaa_acting_role('opportunities', array['Own','A']);
  if not (me = x.person_id or me = x.host_manager_id or me is not distinct from x.signer_id) then return kafaa_refuse('rotation.checkin', 'rotation_placements', p_placement_id, 'forbidden', 'Only the person on rotation or the host records the mid-point check-in', v_role); end if;
  if x.status in ('signed_off', 'cancelled') then return kafaa_refuse('rotation.checkin', 'rotation_placements', p_placement_id, 'invalid', 'This placement is closed', v_role); end if;
  if x.starts_on > current_date then return kafaa_refuse('rotation.checkin', 'rotation_placements', p_placement_id, 'invalid', 'The placement has not started yet', v_role); end if;
  if x.checkin_at is not null then return kafaa_refuse('rotation.checkin', 'rotation_placements', p_placement_id, 'conflict', 'The mid-point check-in is already recorded', v_role); end if;
  if p_progress is null or jsonb_typeof(p_progress) <> 'object' or exists (select 1 from jsonb_object_keys(p_progress) k where not exists (select 1 from jsonb_array_elements(x.objectives) ob(o) where ob.o->>'id' = k)) then v_ok := false;
  else
    for o in select value from jsonb_array_elements(x.objectives) loop
      if jsonb_typeof(p_progress->(o->>'id')) is distinct from 'string' or (p_progress->>(o->>'id')) not in ('on_track', 'at_risk', 'met') then v_ok := false; exit; end if;
      v_pr := v_pr || jsonb_build_object(o->>'id', p_progress->>(o->>'id'));
    end loop;
  end if;
  if not v_ok then return kafaa_refuse('rotation.checkin', 'rotation_placements', p_placement_id, 'invalid', 'Give a status for every objective', v_role); end if;
  if length(v_note) < 5 or length(v_note) > 1000 then return kafaa_refuse('rotation.checkin', 'rotation_placements', p_placement_id, 'invalid', 'Add a short note (at least one sentence, at most 1,000 characters)', v_role); end if;
  update kafaa_rotation_placements set checkin = jsonb_build_object('at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'by', me, 'progress', v_pr, 'note', v_note),
    checkin_at = now(), checkin_by = me, status = 'active', updated_at = now() where id = x.id;
  v_other := case when me = x.person_id then x.signer_id else x.person_id end;
  perform kafaa_rot_notify('nt-' || x.id || '-checkin', v_other, 'Mid-point check-in recorded: ' || x.host_team_en, 'تم تسجيل مراجعة منتصف المدة: ' || x.host_team_ar,
    case when me = x.person_id then '/opportunities/rotations/host' else '/opportunities/rotations/my' end, 'info');
  a := kafaa_audit('rotation.checkin', 'rotation_placements', x.id, 'ok', case when exists (select 1 from jsonb_each_text(v_pr) e where e.value = 'at_risk') then 'at risk' else 'on track' end, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Mid-point check-in recorded', a, null, jsonb_build_object('checkin_at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')));
end $$;

-- ───────────── RPC: host sign-off -> ojt evidence + skills recompute (maker-checker). Ledger row.
create or replace function kafaa_signoff_placement(p_placement_id text, p_levels jsonb, p_note text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); x kafaa_rotation_placements; v_role text; v_note text := btrim(coalesce(p_note, '')); v_ok boolean := true; v_clean jsonb := '{}'::jsonb; k text; v jsonb;
  v_skills jsonb := '{}'::jsonb; o jsonb; v_ids text[]; v_met integer; v_total integer; v_title text; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('rotation.signoff', 'rotation_placements', p_placement_id, 'not_signed_in', 'Sign in to use rotations and shadowing'); end if;
  select * into x from kafaa_rotation_placements where id = coalesce(p_placement_id, '');
  if x.id is null or not kafaa_rot_placement_visible(x) then return kafaa_refuse('rotation.signoff', 'rotation_placements', p_placement_id, 'not_found', 'Placement not found'); end if;
  v_role := kafaa_acting_role('opportunities', array['A']);
  if x.person_id = me then return kafaa_refuse('rotation.signoff', 'rotation_placements', p_placement_id, 'maker_checker', 'You cannot sign off your own placement', v_role); end if;
  if x.line_manager_id is not distinct from me and x.host_manager_id = me then return kafaa_refuse('rotation.signoff', 'rotation_placements', p_placement_id, 'maker_checker', 'As both host and line manager you cannot sign off alone; the sign-off goes to your own line manager', v_role); end if;
  if x.signer_id is distinct from me or v_role is null then return kafaa_refuse('rotation.signoff', 'rotation_placements', p_placement_id, 'forbidden', 'Only the host manager signs off this placement', v_role); end if;
  if x.status in ('signed_off', 'cancelled') then return kafaa_refuse('rotation.signoff', 'rotation_placements', p_placement_id, 'invalid', 'This placement is closed', v_role); end if;
  if x.starts_on > current_date then return kafaa_refuse('rotation.signoff', 'rotation_placements', p_placement_id, 'invalid', 'The placement has not started yet', v_role); end if;
  if x.checkin_at is null then return kafaa_refuse('rotation.signoff', 'rotation_placements', p_placement_id, 'checkin_required', 'Record the mid-point check-in before signing off', v_role); end if;
  if p_levels is null or jsonb_typeof(p_levels) <> 'object' then v_ok := false;
  else
    for k, v in select key, value from jsonb_each(p_levels) loop
      if not exists (select 1 from jsonb_array_elements(x.objectives) ob(o) where ob.o->>'id' = k) or not kafaa_rot_int(v, 0, 3) then v_ok := false; exit; end if;
      if (v::text)::numeric > 0 then v_clean := v_clean || jsonb_build_object(k, (v::text)::numeric::integer); end if;
    end loop;
  end if;
  if not v_ok or v_clean = '{}'::jsonb then return kafaa_refuse('rotation.signoff', 'rotation_placements', p_placement_id, 'invalid', 'Rate at least one objective, at levels 1 to 3', v_role); end if;
  if length(v_note) < 5 or length(v_note) > 1000 then return kafaa_refuse('rotation.signoff', 'rotation_placements', p_placement_id, 'invalid', 'Add a short note (at least one sentence, at most 1,000 characters)', v_role); end if;
  for o in select value from jsonb_array_elements(x.objectives) loop
    if coalesce((v_clean->>(o->>'id'))::integer, 0) > 0 then
      v_skills := v_skills || jsonb_build_object(o->>'skill_id', greatest(coalesce((v_skills->>(o->>'skill_id'))::integer, 0), (v_clean->>(o->>'id'))::integer));
    end if;
  end loop;
  select coalesce(t.title_en, x.template_id) into v_title from (select 1) d left join kafaa_rotation_templates t on t.id = x.template_id;
  v_ids := kafaa_rot_evidence('rotation_placements', x.id, x.person_id, v_skills, v_title || ' · ' || x.host_team_en);
  v_total := jsonb_array_length(x.objectives);
  select count(*) into v_met from jsonb_array_elements(x.objectives) ob(o) where coalesce((v_clean->>(ob.o->>'id'))::integer, 0) >= (ob.o->>'level')::integer;
  update kafaa_rotation_placements set status = 'signed_off', signed_off_by = me, signed_off_at = now(), outcome_note = v_note, outcome_levels = v_clean, evidence_ids = v_ids, updated_at = now() where id = x.id;
  perform kafaa_rot_notify('nt-' || x.id || '-signed_off', x.person_id, 'Placement signed off: ' || x.host_team_en || '. Your skills passport is updated', 'تم اعتماد التناوب: ' || x.host_team_ar || '. تم تحديث جواز مهاراتك', '/opportunities/rotations/my', 'ok');
  l := kafaa_ledger('kafaa.rotation.signoff', format('Placement %s signed off for %s (%s/%s objectives)', x.id, x.person_id, v_met, v_total));
  a := kafaa_audit('rotation.signoff', 'rotation_placements', x.id, 'ok', format('%s/%s objectives met; %s ojt evidence rows', v_met, v_total, cardinality(v_ids)), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Placement signed off; skills evidence recorded', a, l, jsonb_build_object('evidence_ids', to_jsonb(v_ids), 'met', v_met, 'total', v_total));
end $$;

-- ───────────── RPC: list or unlist myself as a shadowing host
create or replace function kafaa_set_shadow_host(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; pp kafaa_people; v_id text; v_active boolean := coalesce(p->'active', 'true'::jsonb) <> 'false'::jsonb; v_sk jsonb := case when jsonb_typeof(p->'skill_ids') = 'array' then p->'skill_ids' end; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('shadow.host', 'shadow_hosts', null, 'not_signed_in', 'Sign in to use rotations and shadowing'); end if;
  v_role := kafaa_acting_role('opportunities', array['Own']);
  select * into pp from kafaa_people where id = me;
  if v_role is null or pp.id is null or pp.kind <> 'staff' then return kafaa_refuse('shadow.host', 'shadow_hosts', null, 'forbidden', 'Only staff can offer to host shadowing', v_role); end if;
  if coalesce(pp.job_family_id, '') in ('security', 'cyber', 'safeguards') then return kafaa_refuse('shadow.host', 'shadow_hosts', null, 'restricted_kind', 'Security, cyber and safeguards staff cannot host shadowing', v_role); end if;
  if v_active then
    if v_sk is not null and exists (select 1 from jsonb_array_elements_text(v_sk) s(x) join kafaa_skills k on k.id = s.x where k.area in ('security')) then
      return kafaa_refuse('shadow.host', 'shadow_hosts', null, 'restricted_kind', 'Security, cyber and safeguards work is career-path only and cannot be shadowed', v_role);
    end if;
    if v_sk is null or jsonb_array_length(v_sk) < 1 or jsonb_array_length(v_sk) > 6 or (select count(distinct s.x) from jsonb_array_elements(v_sk) s(x)) <> jsonb_array_length(v_sk)
       or exists (select 1 from jsonb_array_elements(v_sk) s(x) where jsonb_typeof(s.x) <> 'string' or not exists (select 1 from kafaa_skills k where k.id = s.x #>> '{}'))
       or not kafaa_rot_int(p->'max_days_month', 1, 10) or length(btrim(coalesce(p->>'note_en', ''))) > 300 or length(btrim(coalesce(p->>'note_ar', ''))) > 300 then
      return kafaa_refuse('shadow.host', 'shadow_hosts', null, 'invalid', 'Offer one to six catalogue skills, 1 to 10 days a month, and keep notes under 300 characters', v_role);
    end if;
  end if;
  v_id := 'sh:' || me;
  insert into kafaa_shadow_hosts (id, person_id, name, name_ar, role_id, family_id, skill_ids, max_days_month, note_en, note_ar, site_induction, active, listed, updated_at)
  values (v_id, me, pp.display_name, coalesce(nullif(pp.display_name_ar, ''), pp.display_name), pp.job_role_id, pp.job_family_id,
    case when v_active then array(select jsonb_array_elements_text(v_sk)) else '{}'::text[] end, case when v_active then (p->>'max_days_month')::numeric::integer else 2 end,
    case when v_active then nullif(btrim(coalesce(p->>'note_en', '')), '') end, case when v_active then nullif(btrim(coalesce(p->>'note_ar', '')), '') end,
    coalesce(pp.job_family_id, '') = any(array['operations', 'maintenance', 'radiation-protection', 'chemistry', 'outage', 'fire-protection', 'emergency-preparedness', 'nuclear-fuel']), v_active, v_active, now())
  on conflict (id) do update set name = excluded.name, name_ar = excluded.name_ar, role_id = excluded.role_id, family_id = excluded.family_id, site_induction = excluded.site_induction,
    skill_ids = case when v_active then excluded.skill_ids else kafaa_shadow_hosts.skill_ids end, max_days_month = case when v_active then excluded.max_days_month else kafaa_shadow_hosts.max_days_month end,
    note_en = case when v_active then excluded.note_en else kafaa_shadow_hosts.note_en end, note_ar = case when v_active then excluded.note_ar else kafaa_shadow_hosts.note_ar end,
    active = excluded.active, listed = excluded.listed, updated_at = now();
  a := kafaa_audit('shadow.host', 'shadow_hosts', v_id, 'ok', case when v_active then 'listed' else 'unlisted' end, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when v_active then 'You are listed as a shadowing host' else 'You are no longer listed as a host' end, a, null, jsonb_build_object('id', v_id, 'active', v_active));
end $$;

-- ───────────── RPC: request 1 to 5 days of shadowing (host and line-manager consent)
create or replace function kafaa_request_shadow(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; pp kafaa_people; hst kafaa_shadow_hosts; hp kafaa_people; v_sk jsonb := case when jsonb_typeof(p->'skill_ids') = 'array' then p->'skill_ids' end;
  v_lm text; v_id text; v_purpose text := btrim(coalesce(p->>'purpose', '')); a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('shadow.request', 'shadow_requests', null, 'not_signed_in', 'Sign in to use rotations and shadowing'); end if;
  v_role := kafaa_acting_role('opportunities', array['Own']);
  select * into pp from kafaa_people where id = me;
  if v_role is null or pp.id is null or pp.kind <> 'staff' then return kafaa_refuse('shadow.request', 'shadow_requests', null, 'forbidden', 'Only staff may request shadowing', v_role); end if;
  select * into hst from kafaa_shadow_hosts where person_id = coalesce(p->>'host_id', '') and active and listed order by id limit 1;
  select * into hp from kafaa_people where id = hst.person_id;
  if hst.id is null or hp.id is null or coalesce(hp.status, '') = 'leaver' then return kafaa_refuse('shadow.request', 'shadow_requests', null, 'not_found', 'Host not found or not taking requests', v_role); end if;
  if coalesce(hp.job_family_id, '') in ('security', 'cyber', 'safeguards')
     or (v_sk is not null and exists (select 1 from jsonb_array_elements_text(v_sk) s(x) join kafaa_skills k on k.id = s.x where k.area in ('security'))) then
    return kafaa_refuse('shadow.request', 'shadow_requests', null, 'restricted_kind', 'Security, cyber and safeguards work is career-path only and cannot be shadowed', v_role);
  end if;
  if hst.person_id = me then return kafaa_refuse('shadow.request', 'shadow_requests', null, 'conflict', 'You cannot shadow yourself', v_role); end if;
  if not kafaa_rot_int(p->'days', 1, 5) then return kafaa_refuse('shadow.request', 'shadow_requests', null, 'invalid', 'Shadowing lasts 1 to 5 days', v_role); end if;
  if not kafaa_rot_is_date(p->>'start_on') or (p->>'start_on')::date < current_date or (p->>'start_on')::date - current_date > 180 then
    return kafaa_refuse('shadow.request', 'shadow_requests', null, 'invalid', 'Start between today and six months from now', v_role);
  end if;
  if v_sk is null or jsonb_array_length(v_sk) < 1 or jsonb_array_length(v_sk) > 3 or (select count(distinct s.x) from jsonb_array_elements(v_sk) s(x)) <> jsonb_array_length(v_sk)
     or exists (select 1 from jsonb_array_elements(v_sk) s(x) where jsonb_typeof(s.x) <> 'string' or not ((s.x #>> '{}') = any(hst.skill_ids))) then
    return kafaa_refuse('shadow.request', 'shadow_requests', null, 'invalid', 'Choose one to three skills this host offers', v_role);
  end if;
  if length(v_purpose) < 10 or length(v_purpose) > 500 or jsonb_typeof(p->'purpose') <> 'string' then return kafaa_refuse('shadow.request', 'shadow_requests', null, 'invalid', 'Say in a sentence or two what you want to learn (10 to 500 characters)', v_role); end if;
  if (select count(*) from kafaa_shadow_requests x where x.person_id = me and x.status in ('requested', 'approved')) >= 3 then
    return kafaa_refuse('shadow.request', 'shadow_requests', null, 'conflict', 'You already have three open shadowing requests', v_role);
  end if;
  if exists (select 1 from kafaa_shadow_requests x where x.person_id = me and x.status in ('requested', 'approved') and x.host_id = hst.person_id) then
    return kafaa_refuse('shadow.request', 'shadow_requests', null, 'conflict', 'You already have an open request with this host', v_role);
  end if;
  v_lm := kafaa_opp_line_manager(me);
  if v_lm is null then return kafaa_refuse('shadow.request', 'shadow_requests', null, 'no_line_manager', 'No line manager is recorded for you; ask HR to update your record', v_role); end if;
  v_id := 'sr-' || replace(gen_random_uuid()::text, '-', '');
  insert into kafaa_shadow_requests (id, person_id, host_id, line_manager_id, host_family_id, host_role_id, start_on, days, skill_ids, purpose, status, site_induction,
    person_name, person_name_ar, person_role_id, person_family_id, host_name, host_name_ar, evidence_ids, history, open_read, created_at, updated_at)
  values (v_id, me, hst.person_id, v_lm, hp.job_family_id, hp.job_role_id, (p->>'start_on')::date, (p->>'days')::numeric::integer, array(select jsonb_array_elements_text(v_sk)), v_purpose, 'requested',
    hst.site_induction, pp.display_name, coalesce(nullif(pp.display_name_ar, ''), pp.display_name), pp.job_role_id, pp.job_family_id, hst.name, hst.name_ar, '{}'::text[],
    jsonb_build_array(kafaa_rot_hist('requested', v_purpose)), false, now(), now());
  perform kafaa_rot_notify('nt-' || v_id || '-host', hst.person_id, 'Shadowing request from ' || pp.display_name, 'طلب مرافقة من ' || coalesce(nullif(pp.display_name_ar, ''), pp.display_name), '/opportunities/rotations/host', 'info');
  if v_lm <> hst.person_id then
    perform kafaa_rot_notify('nt-' || v_id || '-manager', v_lm, 'Shadowing consent needed: ' || pp.display_name, 'مطلوب موافقتك على المرافقة: ' || coalesce(nullif(pp.display_name_ar, ''), pp.display_name), '/opportunities/rotations/host', 'info');
  end if;
  a := kafaa_audit('shadow.request', 'shadow_requests', v_id, 'ok', format('%s %sd from %s', hst.person_id, (p->>'days')::numeric::integer, p->>'start_on'), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Request sent to the host and your line manager', a, null, jsonb_build_object('id', v_id, 'line_manager_id', v_lm, 'same_person', v_lm = hst.person_id));
end $$;

-- ───────────── RPC: consent (host / line manager), withdraw (requester), complete (host: ojt evidence at level 1; ledger row)
create or replace function kafaa_decide_shadow(p_request_id text, p_decision text, p_note text default '') returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); r kafaa_shadow_requests; v_role text; v_note text := btrim(coalesce(p_note, '')); v_host boolean; v_mgr boolean; v_status text; v_ids text[]; v_lv jsonb; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('shadow.decide', 'shadow_requests', p_request_id, 'not_signed_in', 'Sign in to use rotations and shadowing'); end if;
  select * into r from kafaa_shadow_requests where id = coalesce(p_request_id, '');
  if r.id is null or not kafaa_rot_shadow_visible(r) then return kafaa_refuse('shadow.decide', 'shadow_requests', p_request_id, 'not_found', 'Shadowing request not found'); end if;
  v_role := kafaa_acting_role('opportunities', array['Own','A']);
  if p_decision is null or p_decision not in ('approve', 'decline', 'withdraw', 'complete') then return kafaa_refuse('shadow.decide', 'shadow_requests', p_request_id, 'invalid', 'Unknown decision', v_role); end if;
  if p_decision = 'withdraw' then
    if r.person_id <> me then return kafaa_refuse('shadow.decide', 'shadow_requests', p_request_id, 'forbidden', 'Only the person who asked can withdraw a request', v_role); end if;
    if r.status not in ('requested', 'approved') then return kafaa_refuse('shadow.decide', 'shadow_requests', p_request_id, 'invalid', 'This request is closed', v_role); end if;
    update kafaa_shadow_requests set status = 'withdrawn', history = history || jsonb_build_array(kafaa_rot_hist('withdrawn', v_note)), updated_at = now() where id = r.id;
    a := kafaa_audit('shadow.decide', 'shadow_requests', r.id, 'ok', r.status || ' -> withdrawn', 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Request withdrawn', a, null, jsonb_build_object('status', 'withdrawn'));
  end if;
  if p_decision = 'complete' then
    if r.host_id <> me then return kafaa_refuse('shadow.decide', 'shadow_requests', p_request_id, 'forbidden', 'Only the host confirms the shadowing took place', v_role); end if;
    if r.status <> 'approved' then return kafaa_refuse('shadow.decide', 'shadow_requests', p_request_id, 'invalid', 'Only an approved request can be completed', v_role); end if;
    if r.start_on > current_date then return kafaa_refuse('shadow.decide', 'shadow_requests', p_request_id, 'invalid', 'The shadowing has not started yet', v_role); end if;
    if length(v_note) < 5 or length(v_note) > 1000 then return kafaa_refuse('shadow.decide', 'shadow_requests', p_request_id, 'invalid', 'Add a short note (at least one sentence, at most 1,000 characters)', v_role); end if;
    select coalesce(jsonb_object_agg(s, 1), '{}'::jsonb) into v_lv from unnest(r.skill_ids) s;
    v_ids := kafaa_rot_evidence('shadow_requests', r.id, r.person_id, v_lv, format('%s (%s d)', r.host_name, r.days));
    update kafaa_shadow_requests set status = 'completed', reflection = v_note, completed_at = now(), evidence_ids = v_ids, history = history || jsonb_build_array(kafaa_rot_hist('completed', v_note)), updated_at = now() where id = r.id;
    perform kafaa_rot_notify('nt-' || r.id || '-completed', r.person_id, 'Shadowing confirmed by ' || r.host_name || '. Your skills passport is updated', 'أكّد ' || r.host_name_ar || ' المرافقة. تم تحديث جواز مهاراتك', '/opportunities/rotations/my', 'ok');
    l := kafaa_ledger('kafaa.shadow.complete', format('Shadowing %s completed for %s (%s skills)', r.id, r.person_id, cardinality(v_ids)));
    a := kafaa_audit('shadow.decide', 'shadow_requests', r.id, 'ok', format('completed; %s ojt evidence rows', cardinality(v_ids)), case when l is null then 'skipped' else 'written' end, l, v_role);
    return kafaa_result(true, 'ok', 'Shadowing confirmed; skills evidence recorded', a, l, jsonb_build_object('status', 'completed', 'evidence_ids', to_jsonb(v_ids)));
  end if;
  if me <> r.host_id and me is distinct from r.line_manager_id then return kafaa_refuse('shadow.decide', 'shadow_requests', p_request_id, 'forbidden', 'Only the host and the line manager give consent', v_role); end if;
  if r.status <> 'requested' then return kafaa_refuse('shadow.decide', 'shadow_requests', p_request_id, 'invalid', 'This request is closed', v_role); end if;
  if p_decision = 'decline' and length(v_note) < 5 then return kafaa_refuse('shadow.decide', 'shadow_requests', p_request_id, 'invalid', 'Give a reason when you decline', v_role); end if;
  if (me <> r.host_id or r.host_consent is not null) and (me is distinct from r.line_manager_id or r.manager_consent is not null) then
    return kafaa_refuse('shadow.decide', 'shadow_requests', p_request_id, 'conflict', 'You have already given your consent', v_role);
  end if;
  v_host := case when me = r.host_id then p_decision = 'approve' else r.host_consent end;
  v_mgr := case when me = r.line_manager_id then p_decision = 'approve' else r.manager_consent end;
  v_status := case when v_host is false or v_mgr is false then 'declined' when v_host is true and v_mgr is true then 'approved' else 'requested' end;
  update kafaa_shadow_requests set host_consent = v_host, manager_consent = v_mgr, status = v_status,
    host_note = case when me = r.host_id then nullif(v_note, '') else host_note end, manager_note = case when me = r.line_manager_id then nullif(v_note, '') else manager_note end,
    history = history || jsonb_build_array(kafaa_rot_hist(case when p_decision = 'approve' then (case when v_status = 'approved' then 'approved' else 'consented' end) else 'declined' end, v_note)), updated_at = now()
  where id = r.id;
  if v_status <> 'requested' then
    perform kafaa_rot_notify('nt-' || r.id || '-' || v_status, r.person_id, case when v_status = 'approved' then 'Shadowing approved with ' || r.host_name else 'Shadowing declined: ' || r.host_name end,
      case when v_status = 'approved' then 'تمت الموافقة على مرافقة ' || r.host_name_ar else 'رُفض طلب مرافقة ' || r.host_name_ar end, '/opportunities/rotations/my', case when v_status = 'approved' then 'ok' else 'warn' end);
  end if;
  a := kafaa_audit('shadow.decide', 'shadow_requests', r.id, 'ok', format('%s by %s -> %s', p_decision, case when me = r.host_id then (case when me = r.line_manager_id then 'host and line manager' else 'host' end) else 'line manager' end, v_status), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when v_status = 'approved' then 'Shadowing approved' when v_status = 'declined' then 'Request declined' else 'Consent recorded; waiting for the other consent' end, a, null, jsonb_build_object('status', v_status));
end $$;

-- ───────────── Read: HR programme board (Agg/A on opportunities, or auditors). Mirror of computeBoard in rotation.ts.
create or replace function kafaa_rot_board_compute(p_today date) returns jsonb language sql stable security definer set search_path = public as $$
  with live as (
    select p.*, case when p.status = 'signed_off' then 'signed_off' when p.starts_on > p_today then 'upcoming' when p.ends_on < p_today then 'overdue' else 'in_progress' end as phase,
      (p.starts_on + ((p.ends_on - p.starts_on) / 2)) <= p_today as due,
      case when p.status = 'signed_off' then jsonb_array_length(p.objectives) else 0 end as obj_total,
      case when p.status = 'signed_off' then (select count(*) from jsonb_array_elements(p.objectives) ob(o) where coalesce((p.outcome_levels->>(ob.o->>'id'))::integer, 0) >= (ob.o->>'level')::integer) else 0 end as obj_met
    from kafaa_rotation_placements p where p.status <> 'cancelled'),
  agg as (
    select cohort_id, count(distinct person_id) as n, count(*) as placements, count(*) filter (where status = 'signed_off') as signed_off,
      count(*) filter (where phase = 'in_progress') as in_progress, count(*) filter (where phase = 'overdue') as overdue, count(*) filter (where phase = 'upcoming') as upcoming,
      count(*) filter (where due) as checkins_due, count(*) filter (where due and checkin_at is not null) as checkins_done, coalesce(sum(obj_total), 0) as obj_total, coalesce(sum(obj_met), 0) as obj_met
    from live group by cohort_id),
  tot as (
    select count(distinct person_id) as n, count(*) as placements, count(*) filter (where status = 'signed_off') as signed_off, coalesce(sum(obj_total), 0) as obj_total, coalesce(sum(obj_met), 0) as obj_met from live),
  sh as (select * from kafaa_shadow_requests where status <> 'withdrawn'),
  shn as (select count(distinct person_id) as n, count(*) as total from sh)
  select jsonb_build_object(
    'cohorts', coalesce((select jsonb_agg(case when coalesce(g.n, 0) < 10 then
          jsonb_build_object('cohort_id', c.id, 'template_id', c.template_id, 'programme', c.programme, 'name_en', c.name_en, 'name_ar', c.name_ar, 'intake_on', c.intake_on, 'suppressed', true,
            'participants', null, 'placements', null, 'signed_off', null, 'in_progress', null, 'overdue', null, 'upcoming', null, 'checkins_due', null, 'checkins_done', null,
            'objectives_total', null, 'objectives_met', null, 'met_pct', null, 'progress_pct', null)
        else jsonb_build_object('cohort_id', c.id, 'template_id', c.template_id, 'programme', c.programme, 'name_en', c.name_en, 'name_ar', c.name_ar, 'intake_on', c.intake_on, 'suppressed', false,
            'participants', g.n, 'placements', g.placements, 'signed_off', g.signed_off, 'in_progress', g.in_progress, 'overdue', g.overdue, 'upcoming', g.upcoming,
            'checkins_due', g.checkins_due, 'checkins_done', g.checkins_done, 'objectives_total', g.obj_total, 'objectives_met', g.obj_met,
            'met_pct', case when g.obj_total > 0 then round(100.0 * g.obj_met / g.obj_total)::integer end, 'progress_pct', case when g.placements > 0 then round(100.0 * g.signed_off / g.placements)::integer end) end
        order by c.id collate "C") from kafaa_rotation_cohorts c left join agg g on g.cohort_id = c.id), '[]'::jsonb),
    'totals', (select jsonb_build_object('templates', (select count(*) from kafaa_rotation_templates where status = 'active'), 'cohorts', (select count(*) from kafaa_rotation_cohorts),
        'participants', case when t.n < 10 then null else t.n end, 'placements', case when t.n < 10 then null else t.placements end, 'signed_off', case when t.n < 10 then null else t.signed_off end,
        'objectives_total', case when t.n < 10 then null else t.obj_total end, 'objectives_met', case when t.n < 10 then null else t.obj_met end,
        'met_pct', case when t.n < 10 or t.obj_total = 0 then null else round(100.0 * t.obj_met / t.obj_total)::integer end,
        'evidence_rows', (select count(*) from kafaa_skill_evidence where kind = 'ojt' and ref_table = 'rotation_placements' and active), 'suppressed', t.n < 10) from tot t),
    'by_family', coalesce((select jsonb_agg(case when f.n < 10 then jsonb_build_object('family_id', f.family_id, 'people', null, 'placements', null, 'signed_off', null, 'suppressed', true)
        else jsonb_build_object('family_id', f.family_id, 'people', f.n, 'placements', f.placements, 'signed_off', f.signed_off, 'suppressed', false) end order by f.family_id collate "C")
      from (select family_id, count(distinct person_id) as n, count(*) as placements, count(*) filter (where status = 'signed_off') as signed_off from live group by family_id) f), '[]'::jsonb),
    'shadow', (select case when s.n < 10 then jsonb_build_object('requests', null, 'people', null, 'requested', null, 'approved', null, 'completed', null, 'declined', null, 'suppressed', true)
        else jsonb_build_object('requests', s.total, 'people', s.n, 'requested', (select count(*) from sh where status = 'requested'), 'approved', (select count(*) from sh where status = 'approved'),
          'completed', (select count(*) from sh where status = 'completed'), 'declined', (select count(*) from sh where status = 'declined'), 'suppressed', false) end from shn s),
    'min_group', 10)
$$;
create or replace function kafaa_rotation_board() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if kafaa_me() is null or not (kafaa_has_grant('opportunities', array['Agg','A']) or kafaa_has_grant('audit_log', array['R'])) then return null; end if;
  return kafaa_rot_board_compute(current_date);
end $$;

-- ───────────── Read: staff a programme owner may enrol (names for HR programme owners only). Mirror of computeCandidates.
create or replace function kafaa_rotation_candidates(p_template_id text default null) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t kafaa_rotation_templates;
begin
  if kafaa_me() is null or kafaa_rot_owner_role() is null then return null; end if;
  if nullif(p_template_id, '') is not null then
    select * into t from kafaa_rotation_templates where id = p_template_id;
    if t.id is null or not kafaa_rot_tpl_visible(t) then return null; end if;
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'display_name', p.display_name, 'display_name_ar', coalesce(nullif(p.display_name_ar, ''), p.display_name),
      'job_role_id', p.job_role_id, 'job_family_id', p.job_family_id, 'eligible', coalesce(cardinality(t.eligible_families), 0) = 0 or coalesce(p.job_family_id, '') = any(t.eligible_families),
      'enrolled', t.id is not null and exists (select 1 from kafaa_rotation_placements x where x.person_id = p.id and x.template_id = t.id and x.status <> 'cancelled'),
      'can_host', kafaa_rot_is_host(p.id, current_date)) order by p.id collate "C")
    from kafaa_people p where p.kind = 'staff' and coalesce(p.status, '') <> 'leaver'), '[]'::jsonb);
end $$;

revoke execute on function kafaa_rot_owner_role(), kafaa_rot_is_host(text, date), kafaa_rot_family_host(text, date), kafaa_rot_signer(text, text), kafaa_rot_len(jsonb),
  kafaa_rot_int(jsonb, integer, integer), kafaa_rot_is_date(text), kafaa_rot_notify(text, text, text, text, text, text), kafaa_rot_hist(text, text),
  kafaa_rot_evidence(text, text, text, jsonb, text), kafaa_rot_tpl_visible(kafaa_rotation_templates), kafaa_rot_cohort_visible(kafaa_rotation_cohorts),
  kafaa_rot_placement_visible(kafaa_rotation_placements), kafaa_rot_shadow_visible(kafaa_shadow_requests), kafaa_rot_validate_template(jsonb, date), kafaa_rot_board_compute(date)
  from public, anon, authenticated;
revoke execute on function kafaa_save_rotation_template(jsonb), kafaa_save_rotation_cohort(jsonb), kafaa_enrol_rotation(text, text, text, text), kafaa_placement_checkin(text, jsonb, text),
  kafaa_signoff_placement(text, jsonb, text), kafaa_set_shadow_host(jsonb), kafaa_request_shadow(jsonb), kafaa_decide_shadow(text, text, text), kafaa_rotation_board(), kafaa_rotation_candidates(text) from public, anon;
grant execute on function kafaa_save_rotation_template(jsonb), kafaa_save_rotation_cohort(jsonb), kafaa_enrol_rotation(text, text, text, text), kafaa_placement_checkin(text, jsonb, text),
  kafaa_signoff_placement(text, jsonb, text), kafaa_set_shadow_host(jsonb), kafaa_request_shadow(jsonb), kafaa_decide_shadow(text, text, text), kafaa_rotation_board(), kafaa_rotation_candidates(text) to authenticated;
