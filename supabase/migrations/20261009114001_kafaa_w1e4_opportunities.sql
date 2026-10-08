-- [W1 · E4 · F08] Kafa'a Opportunity Marketplace (M20): opportunities, applications (line-manager release -> poster selection ->
-- outcome sign-off writing ojt skill evidence), saved items, HR aggregates.
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file, RLS in the per-statement form,
-- internal helpers and the RPCs. LocalBackend mirror: src/modules/m20/backend/local.ts; rules: src/modules/m20/domain.ts.
-- PGlite checks: scripts/validate/w1e4-opportunities.mjs. The opportunities policy-matrix rows were added by W0 (20261009101001).

-- ───────────── Tables (generated DDL)
-- M20 · Opportunity marketplace: short stretch assignments posted by managers (F08)
create table if not exists kafaa_opportunities (
  id text primary key,
  posted_by text not null,
  org_id text,
  family_id text,
  host_role_id text,
  host_team text,
  kind text not null check (kind in ('project', 'outage_support', 'shadowing', 'oe_review', 'knowledge_capture', 'outreach', 'research')),
  title_en text not null,
  title_ar text not null,
  summary_en text not null,
  summary_ar text not null,
  skills_needed text[] not null default '{}'::text[],
  skills_gained text[] not null default '{}'::text[],
  hours_week integer not null,
  start_on date not null,
  end_on date not null,
  seats integer not null default 1,
  seats_taken integer not null default 0,
  location_type text not null check (location_type in ('office', 'site_non_protected', 'remote')),
  eligible_families text[] not null default '{}'::text[],
  priority_flags text[] not null default '{}'::text[],
  status text not null default 'open' check (status in ('draft', 'open', 'closed', 'filled')),
  listed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table kafaa_opportunities is '[M20] Opportunity marketplace: short stretch assignments posted by managers (F08)';

-- M20 · Application to an opportunity: release by the line manager, selection, completion sign-off (F08)
create table if not exists kafaa_opportunity_applications (
  id text primary key,
  opportunity_id text not null,
  person_id text not null,
  note text not null default '',
  status text not null default 'applied' check (status in ('applied', 'released', 'declined_release', 'selected', 'not_selected', 'completed', 'withdrawn')),
  history jsonb not null default '[]'::jsonb,
  applicant_name text not null default '',
  applicant_name_ar text not null default '',
  applicant_role_id text,
  applicant_family_id text,
  poster_id text not null,
  line_manager_id text,
  releaser_id text,
  skip_level boolean not null default false,
  released_by text,
  released_at timestamptz,
  decided_by text,
  decided_at timestamptz,
  completed_at timestamptz,
  outcome_note text,
  outcome_levels jsonb not null default '{}'::jsonb,
  evidence_ids text[] not null default '{}'::text[],
  open_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table kafaa_opportunity_applications is '[M20] Application to an opportunity: release by the line manager, selection, completion sign-off (F08)';

-- M20 · Saved (bookmarked) opportunities per person (F08)
create table if not exists kafaa_opportunity_saves (
  id text primary key,
  person_id text not null,
  opportunity_id text not null,
  saved boolean not null default true,
  open_read boolean not null default false,
  updated_at timestamptz not null default now()
);
comment on table kafaa_opportunity_saves is '[M20] Saved (bookmarked) opportunities per person (F08)';

-- Foreign keys and indexes
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_opportunities_posted_by_fk') then alter table kafaa_opportunities add constraint kafaa_opportunities_posted_by_fk foreign key (posted_by) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_opportunities_org_id_fk') then alter table kafaa_opportunities add constraint kafaa_opportunities_org_id_fk foreign key (org_id) references kafaa_organisations(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_opportunities_family_id_fk') then alter table kafaa_opportunities add constraint kafaa_opportunities_family_id_fk foreign key (family_id) references kafaa_job_families(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_opportunities_host_role_id_fk') then alter table kafaa_opportunities add constraint kafaa_opportunities_host_role_id_fk foreign key (host_role_id) references kafaa_job_roles(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_opportunity_applications_opportunity_id_fk') then alter table kafaa_opportunity_applications add constraint kafaa_opportunity_applications_opportunity_id_fk foreign key (opportunity_id) references kafaa_opportunities(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_opportunity_applications_person_id_fk') then alter table kafaa_opportunity_applications add constraint kafaa_opportunity_applications_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_opportunity_applications_poster_id_fk') then alter table kafaa_opportunity_applications add constraint kafaa_opportunity_applications_poster_id_fk foreign key (poster_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_opportunity_applications_line_manager_id_fk') then alter table kafaa_opportunity_applications add constraint kafaa_opportunity_applications_line_manager_id_fk foreign key (line_manager_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_opportunity_applications_releaser_id_fk') then alter table kafaa_opportunity_applications add constraint kafaa_opportunity_applications_releaser_id_fk foreign key (releaser_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_opportunity_saves_person_id_fk') then alter table kafaa_opportunity_saves add constraint kafaa_opportunity_saves_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_opportunity_saves_opportunity_id_fk') then alter table kafaa_opportunity_saves add constraint kafaa_opportunity_saves_opportunity_id_fk foreign key (opportunity_id) references kafaa_opportunities(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_opportunities_posted_by_idx on kafaa_opportunities (posted_by);
create index if not exists kafaa_opportunities_org_id_idx on kafaa_opportunities (org_id);
create index if not exists kafaa_opportunities_family_id_idx on kafaa_opportunities (family_id);
create index if not exists kafaa_opportunities_host_role_id_idx on kafaa_opportunities (host_role_id);
create index if not exists kafaa_opportunities_kind_idx on kafaa_opportunities (kind);
create index if not exists kafaa_opportunities_status_idx on kafaa_opportunities (status);
create index if not exists kafaa_opportunity_applications_opportunity_id_idx on kafaa_opportunity_applications (opportunity_id);
create index if not exists kafaa_opportunity_applications_person_id_idx on kafaa_opportunity_applications (person_id);
create index if not exists kafaa_opportunity_applications_status_idx on kafaa_opportunity_applications (status);
create index if not exists kafaa_opportunity_applications_poster_id_idx on kafaa_opportunity_applications (poster_id);
create index if not exists kafaa_opportunity_applications_line_manager_id_idx on kafaa_opportunity_applications (line_manager_id);
create index if not exists kafaa_opportunity_applications_releaser_id_idx on kafaa_opportunity_applications (releaser_id);
create index if not exists kafaa_opportunity_saves_person_id_idx on kafaa_opportunity_saves (person_id);
create index if not exists kafaa_opportunity_saves_opportunity_id_idx on kafaa_opportunity_saves (opportunity_id);

-- ───────────── RLS (policies created when missing, then set to the per-statement form like 20261008140000_kafaa_rls_perf.sql)
-- Staff hold R on opportunities: `listed` keeps drafts private to the poster; `open_read` (always false) keeps every staff
-- member from reading other people's applications and saves. Admins and auditors (R on audit_log) read all rows.
alter table kafaa_opportunities enable row level security;
alter table kafaa_opportunity_applications enable row level security;
alter table kafaa_opportunity_saves enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_opportunities' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_opportunities for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_opportunity_applications' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_opportunity_applications for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_opportunity_saves' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_opportunity_saves for select to anon, authenticated using (false)'; end if;
end $$;
alter policy kafaa_read on kafaa_opportunities using (((COALESCE(listed, false) AND (SELECT kafaa_has_grant('opportunities'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))) OR ((posted_by = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('opportunities'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('audit_log'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))));
alter policy kafaa_read on kafaa_opportunity_applications using (((SELECT kafaa_me()) IN (person_id, poster_id, releaser_id, line_manager_id) AND (SELECT kafaa_has_grant('opportunities'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((COALESCE(open_read, false) AND (SELECT kafaa_has_grant('opportunities'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))) OR ((SELECT kafaa_has_grant('audit_log'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))));
alter policy kafaa_read on kafaa_opportunity_saves using (((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('opportunities'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((COALESCE(open_read, false) AND (SELECT kafaa_has_grant('opportunities'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
grant select on kafaa_opportunities, kafaa_opportunity_applications, kafaa_opportunity_saves to anon, authenticated;
-- These tables change only through the SECURITY DEFINER RPCs below.
revoke insert, update on kafaa_opportunities, kafaa_opportunity_applications, kafaa_opportunity_saves from anon, authenticated;

-- ───────────── Internal helpers (mirror of src/modules/m20/domain.ts)
-- Line manager: people.manager_id (not a leaver), else the holder of an active manager assignment covering the person,
-- narrowest scope first (crew/team, family, org/entity, all), ties by person id.
create or replace function kafaa_opp_line_manager(p_person text) returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select m.id from kafaa_people t join kafaa_people m on m.id = t.manager_id where t.id = p_person and m.status <> 'leaver'),
    (select ra.person_id
       from kafaa_people t
       join kafaa_role_assignments ra on ra.role = 'manager' and ra.status = 'active' and (ra.expires_at is null or ra.expires_at >= current_date) and ra.person_id <> t.id
       join kafaa_people h on h.id = ra.person_id and h.status <> 'leaver'
      where t.id = p_person and (
            ra.scope_type = 'all'
         or (ra.scope_type = 'crew' and t.crew is not null and t.crew = ra.scope_value)
         or (ra.scope_type = 'team' and t.team_id is not null and t.team_id = ra.scope_value)
         or (ra.scope_type = 'family' and t.job_family_id is not null and t.job_family_id = ra.scope_value)
         or (ra.scope_type = 'org' and t.org_id is not null and t.org_id = ra.scope_value)
         or (ra.scope_type = 'entity' and t.entity_id is not null and t.entity_id = ra.scope_value))
      order by case ra.scope_type when 'crew' then 1 when 'team' then 1 when 'family' then 2 when 'org' then 3 when 'entity' then 3 else 4 end, ra.person_id collate "C"
      limit 1))
$$;

-- Can the caller read this opportunity / application (same rule as the RLS policies above)?
create or replace function kafaa_opp_visible(o kafaa_opportunities) returns boolean language sql stable security definer set search_path = public as $$
  select (coalesce(o.listed, false) and kafaa_has_grant('opportunities', array['R','W','A']))
      or (o.posted_by = kafaa_me() and kafaa_has_grant('opportunities', array['Own','Scope']))
      or kafaa_has_grant('audit_log', array['R','W','A'])
$$;
create or replace function kafaa_opp_app_visible(a kafaa_opportunity_applications) returns boolean language sql stable security definer set search_path = public as $$
  select (kafaa_me() in (a.person_id, a.poster_id, a.releaser_id, a.line_manager_id) and kafaa_has_grant('opportunities', array['Own','Scope']))
      or kafaa_has_grant('audit_log', array['R','W','A'])
$$;
create or replace function kafaa_opp_hist(p_status text, p_note text) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'status', p_status, 'by', kafaa_me(), 'note', nullif(btrim(coalesce(p_note, '')), ''))
$$;
create or replace function kafaa_opp_notify(p_id text, p_person text, p_en text, p_ar text, p_link text, p_sev text) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_person is null or not exists (select 1 from kafaa_people where id = p_person) then return; end if;
  insert into kafaa_notifications (id, person_id, kind, title_en, title_ar, link, severity) values (p_id, p_person, 'opportunity', p_en, p_ar, p_link, p_sev) on conflict (id) do nothing;
end $$;

-- Content checks for posting (validateOpportunity). Returns {code, message} or null.
create or replace function kafaa_opp_validate(p jsonb, p_today date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_need jsonb := p->'skills_needed'; v_gain jsonb := p->'skills_gained'; v_all text[]; v_start date; v_end date; n_need integer; n_gain integer;
  bad constant jsonb := '{"code":"invalid"}'::jsonb;
begin
  v_all := array(select jsonb_array_elements_text(case when jsonb_typeof(v_need) = 'array' then v_need else '[]'::jsonb end))
        || array(select jsonb_array_elements_text(case when jsonb_typeof(v_gain) = 'array' then v_gain else '[]'::jsonb end));
  if coalesce(p->>'kind', '') in ('security', 'protected_area', 'cyber', 'safeguards') or coalesce(p->>'location_type', '') in ('protected_area')
     or exists (select 1 from kafaa_skills s where s.id = any(v_all) and s.area in ('security')) then
    return jsonb_build_object('code', 'restricted_kind', 'message', 'Security, cyber, safeguards and protected-area work is never listed in the marketplace');
  end if;
  if coalesce(p->>'kind', '') not in ('project', 'outage_support', 'shadowing', 'oe_review', 'knowledge_capture', 'outreach', 'research') then return bad || '{"message":"Unknown opportunity kind"}'; end if;
  if coalesce(p->>'location_type', '') not in ('office', 'site_non_protected', 'remote') then return bad || '{"message":"Unknown location type"}'; end if;
  if length(btrim(coalesce(p->>'title_en', ''))) not between 5 and 120 or length(btrim(coalesce(p->>'title_ar', ''))) not between 5 and 120
     or length(btrim(coalesce(p->>'summary_en', ''))) not between 20 and 1000 or length(btrim(coalesce(p->>'summary_ar', ''))) not between 20 and 1000 then
    return bad || '{"message":"Give an English and an Arabic title (5 to 120 characters) and summary (20 to 1,000 characters)"}';
  end if;
  n_need := case when jsonb_typeof(v_need) = 'array' then jsonb_array_length(v_need) when v_need is null or v_need = 'null'::jsonb then 0 else -1 end;
  n_gain := case when jsonb_typeof(v_gain) = 'array' then jsonb_array_length(v_gain) else -1 end;
  if n_need < 0 or n_gain < 1 or n_need > 6 or n_gain > 6
     or (select count(distinct x) from jsonb_array_elements_text(coalesce(nullif(v_need, 'null'::jsonb), '[]'::jsonb)) x) <> n_need
     or (select count(distinct x) from jsonb_array_elements_text(v_gain) x) <> n_gain
     or exists (select 1 from unnest(v_all) x where not exists (select 1 from kafaa_skills s where s.id = x)) then
    return bad || '{"message":"Choose up to six needed skills and one to six skills gained from the skills catalogue"}';
  end if;
  if jsonb_typeof(p->'hours_week') <> 'number' or (p->>'hours_week')::numeric <> trunc((p->>'hours_week')::numeric) or (p->>'hours_week')::numeric not between 1 and 20 then
    return bad || '{"message":"Hours per week must be between 1 and 20"}';
  end if;
  begin
    if coalesce(p->>'start_on', '') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(p->>'end_on', '') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'bad date'; end if;
    v_start := (p->>'start_on')::date; v_end := (p->>'end_on')::date;
  exception when others then
    return bad || '{"message":"Start today or later, end on or after the start, and run at most 12 months"}';
  end;
  if v_start < p_today or v_end < v_start or v_end - v_start > 365 then return bad || '{"message":"Start today or later, end on or after the start, and run at most 12 months"}'; end if;
  if jsonb_typeof(p->'seats') <> 'number' or (p->>'seats')::numeric <> trunc((p->>'seats')::numeric) or (p->>'seats')::numeric not between 1 and 10 then
    return bad || '{"message":"Seats must be between 1 and 10"}';
  end if;
  if exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(p->'eligible_families') = 'array' then p->'eligible_families' else '[]'::jsonb end) f where not exists (select 1 from kafaa_job_families j where j.id = f))
     or exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(p->'priority_flags') = 'array' then p->'priority_flags' else '[]'::jsonb end) f where f not in ('emirati_development', 'knowledge_transfer', 'new_joiner_friendly')) then
    return bad || '{"message":"Unknown job family or priority flag"}';
  end if;
  if p->>'status' is not null and p->>'status' not in ('draft', 'open') then return bad || '{"message":"A new opportunity is either a draft or open"}'; end if;
  return null;
end $$;

-- ───────────── RPC: post an opportunity (managers and the training manager). Restricted kinds refused and audited.
create or replace function kafaa_post_opportunity(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_bad jsonb; v_id text; v_status text := coalesce(p->>'status', 'open'); pp kafaa_people; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('opportunity.post', 'opportunities', null, 'not_signed_in', 'Sign in to post an opportunity'); end if;
  v_role := kafaa_acting_role('opportunities', array['W','A']);
  if v_role is null then return kafaa_refuse('opportunity.post', 'opportunities', null, 'forbidden', 'Only managers and the training manager may post opportunities'); end if;
  v_bad := kafaa_opp_validate(p, current_date);
  if v_bad is not null then return kafaa_refuse('opportunity.post', 'opportunities', null, v_bad->>'code', v_bad->>'message', v_role); end if;
  select * into pp from kafaa_people where id = me;
  v_id := 'opp-' || replace(gen_random_uuid()::text, '-', '');
  insert into kafaa_opportunities (id, posted_by, org_id, family_id, host_role_id, host_team, kind, title_en, title_ar, summary_en, summary_ar, skills_needed, skills_gained,
    hours_week, start_on, end_on, seats, seats_taken, location_type, eligible_families, priority_flags, status, listed, created_at, updated_at)
  values (v_id, me, pp.org_id, pp.job_family_id, pp.job_role_id, pp.team_id, p->>'kind', btrim(p->>'title_en'), btrim(p->>'title_ar'), btrim(p->>'summary_en'), btrim(p->>'summary_ar'),
    array(select jsonb_array_elements_text(coalesce(nullif(p->'skills_needed', 'null'::jsonb), '[]'::jsonb))), array(select jsonb_array_elements_text(p->'skills_gained')),
    (p->>'hours_week')::numeric::integer, (p->>'start_on')::date, (p->>'end_on')::date, (p->>'seats')::numeric::integer, 0, p->>'location_type',
    array(select jsonb_array_elements_text(case when jsonb_typeof(p->'eligible_families') = 'array' then p->'eligible_families' else '[]'::jsonb end)),
    array(select jsonb_array_elements_text(case when jsonb_typeof(p->'priority_flags') = 'array' then p->'priority_flags' else '[]'::jsonb end)),
    v_status, v_status <> 'draft', now(), now());
  a := kafaa_audit('opportunity.post', 'opportunities', v_id, 'ok', (p->>'kind') || ' ' || v_status, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when v_status = 'draft' then 'Draft saved' else 'Opportunity posted' end, a, null, jsonb_build_object('id', v_id, 'status', v_status));
end $$;

-- ───────────── RPC: open / close / reopen (poster, or the training manager). Closing ends pending applications.
create or replace function kafaa_set_opportunity_status(p_id text, p_status text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); o kafaa_opportunities; v_role text; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('opportunity.status', 'opportunities', p_id, 'not_signed_in', 'Sign in to use the opportunity marketplace'); end if;
  select * into o from kafaa_opportunities where id = p_id;
  if o.id is null or not kafaa_opp_visible(o) then return kafaa_refuse('opportunity.status', 'opportunities', p_id, 'not_found', 'Opportunity not found'); end if;
  if o.posted_by = me then v_role := kafaa_acting_role('opportunities', array['W','A']);
  elsif kafaa_role_grant('training_manager', 'opportunities', 'A') then v_role := 'training_manager';
  end if;
  if v_role is null then return kafaa_refuse('opportunity.status', 'opportunities', p_id, 'forbidden', 'Only the poster or the training manager can change this opportunity'); end if;
  if not ((p_status = 'open' and o.status in ('draft', 'closed')) or (p_status = 'closed' and o.status in ('draft', 'open', 'filled'))) then
    return kafaa_refuse('opportunity.status', 'opportunities', p_id, 'invalid', 'That status change is not allowed', v_role);
  end if;
  update kafaa_opportunities set status = p_status, listed = true, updated_at = now() where id = p_id;
  if p_status = 'closed' then
    update kafaa_opportunity_applications set status = 'not_selected', decided_by = me, decided_at = now(), history = history || jsonb_build_array(kafaa_opp_hist('not_selected', 'Opportunity closed')), updated_at = now()
     where opportunity_id = p_id and status in ('applied', 'released');
  end if;
  a := kafaa_audit('opportunity.status', 'opportunities', p_id, 'ok', o.status || ' -> ' || p_status, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when p_status = 'open' then 'Opportunity open' else 'Opportunity closed' end, a, null, jsonb_build_object('status', p_status));
end $$;

-- ───────────── RPC: apply (staff). The release goes to the line manager, or to the poster's line manager when they are the same person.
create or replace function kafaa_apply_opportunity(p_opportunity_id text, p_note text default '') returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; o kafaa_opportunities; pp kafaa_people; v_note text := btrim(coalesce(p_note, '')); v_lm text; v_skip_mgr text; v_rel text; v_skip boolean; v_id text; a kafaa_audit_events;
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
  insert into kafaa_opportunity_applications (id, opportunity_id, person_id, note, status, history, applicant_name, applicant_name_ar, applicant_role_id, applicant_family_id,
    poster_id, line_manager_id, releaser_id, skip_level, outcome_levels, evidence_ids, open_read, created_at, updated_at)
  values (v_id, p_opportunity_id, me, v_note, 'applied', jsonb_build_array(kafaa_opp_hist('applied', v_note)), pp.display_name, coalesce(nullif(pp.display_name_ar, ''), pp.display_name),
    pp.job_role_id, pp.job_family_id, o.posted_by, v_lm, v_rel, v_skip, '{}'::jsonb, '{}'::text[], false, now(), now());
  perform kafaa_opp_notify('nt-' || v_id || '-applied', v_rel, 'Release request: ' || o.title_en, 'طلب إفراج: ' || o.title_ar, '/opportunities/manage', 'info');
  a := kafaa_audit('opportunity.apply', 'opportunity_applications', v_id, 'ok', p_opportunity_id || ' -> release by ' || v_rel || case when v_skip then ' (skip level)' else '' end, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Application sent to your line manager for release', a, null, jsonb_build_object('id', v_id, 'releaser_id', v_rel, 'skip_level', v_skip));
end $$;

-- ───────────── RPC: line-manager release (maker-checker: the poster never releases)
create or replace function kafaa_release_decision(p_application_id text, p_decision text, p_note text default '') returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); x kafaa_opportunity_applications; o kafaa_opportunities; v_role text; v_note text := btrim(coalesce(p_note, '')); v_status text; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('opportunity.release', 'opportunity_applications', p_application_id, 'not_signed_in', 'Sign in to use the opportunity marketplace'); end if;
  select * into x from kafaa_opportunity_applications where id = p_application_id;
  if x.id is null or not kafaa_opp_app_visible(x) then return kafaa_refuse('opportunity.release', 'opportunity_applications', p_application_id, 'not_found', 'Application not found'); end if;
  v_role := kafaa_acting_role('opportunities', array['A','Own']);
  if x.poster_id = me then return kafaa_refuse('opportunity.release', 'opportunity_applications', p_application_id, 'maker_checker', 'The person who posted this opportunity cannot release an applicant; the release goes to the line manager', v_role); end if;
  if x.releaser_id is distinct from me then return kafaa_refuse('opportunity.release', 'opportunity_applications', p_application_id, 'forbidden', 'Only the applicant''s line manager can release them', v_role); end if;
  if x.status <> 'applied' then return kafaa_refuse('opportunity.release', 'opportunity_applications', p_application_id, 'invalid', 'This application is not waiting for a release decision', v_role); end if;
  if p_decision is null or p_decision not in ('release', 'decline') then return kafaa_refuse('opportunity.release', 'opportunity_applications', p_application_id, 'invalid', 'Unknown decision', v_role); end if;
  if p_decision = 'decline' and length(v_note) < 5 then return kafaa_refuse('opportunity.release', 'opportunity_applications', p_application_id, 'invalid', 'Give a reason when you decline a release', v_role); end if;
  v_status := case when p_decision = 'release' then 'released' else 'declined_release' end;
  update kafaa_opportunity_applications set status = v_status, released_by = me, released_at = now(), history = history || jsonb_build_array(kafaa_opp_hist(v_status, v_note)), updated_at = now() where id = x.id;
  select * into o from kafaa_opportunities where id = x.opportunity_id;
  if v_status = 'released' then perform kafaa_opp_notify('nt-' || x.id || '-released', x.poster_id, 'Applicant released: ' || o.title_en, 'تم الإفراج عن متقدّم: ' || o.title_ar, '/opportunities/manage', 'info'); end if;
  perform kafaa_opp_notify('nt-' || x.id || '-' || v_status, x.person_id,
    case when v_status = 'released' then 'Your manager released you for: ' || o.title_en else 'Release declined: ' || o.title_en end,
    case when v_status = 'released' then 'أفرج عنك مديرك لـ: ' || o.title_ar else 'رُفض الإفراج: ' || o.title_ar end, '/opportunities/my', case when v_status = 'released' then 'ok' else 'warn' end);
  a := kafaa_audit('opportunity.release', 'opportunity_applications', x.id, 'ok', v_status, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when v_status = 'released' then 'Applicant released' else 'Release declined' end, a, null, jsonb_build_object('status', v_status));
end $$;

-- ───────────── RPC: poster selects (only after release) or does not select. Ledger row.
create or replace function kafaa_select_applicant(p_application_id text, p_decision text, p_note text default '') returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); x kafaa_opportunity_applications; o kafaa_opportunities; v_role text; v_taken integer; v_filled boolean; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('opportunity.select', 'opportunity_applications', p_application_id, 'not_signed_in', 'Sign in to use the opportunity marketplace'); end if;
  select * into x from kafaa_opportunity_applications where id = p_application_id;
  if x.id is null or not kafaa_opp_app_visible(x) then return kafaa_refuse('opportunity.select', 'opportunity_applications', p_application_id, 'not_found', 'Application not found'); end if;
  v_role := kafaa_acting_role('opportunities', array['W','A']);
  if x.poster_id <> me or v_role is null then return kafaa_refuse('opportunity.select', 'opportunity_applications', p_application_id, 'forbidden', 'Only the person who posted this opportunity selects applicants', v_role); end if;
  if p_decision is null or p_decision not in ('selected', 'not_selected') then return kafaa_refuse('opportunity.select', 'opportunity_applications', p_application_id, 'invalid', 'Unknown decision', v_role); end if;
  if p_decision = 'selected' and x.status in ('applied', 'declined_release') then
    return kafaa_refuse('opportunity.select', 'opportunity_applications', p_application_id, 'release_required', 'The applicant''s line manager must release them before they can be selected', v_role);
  end if;
  if x.status not in ('released', 'applied') then return kafaa_refuse('opportunity.select', 'opportunity_applications', p_application_id, 'invalid', 'This application has already been decided', v_role); end if;
  select * into o from kafaa_opportunities where id = x.opportunity_id for update;
  select count(*) into v_taken from kafaa_opportunity_applications where opportunity_id = o.id and status in ('selected', 'completed');
  if p_decision = 'selected' and v_taken >= o.seats then return kafaa_refuse('opportunity.select', 'opportunity_applications', p_application_id, 'conflict', 'All seats on this opportunity are filled', v_role); end if;
  update kafaa_opportunity_applications set status = p_decision, decided_by = me, decided_at = now(), history = history || jsonb_build_array(kafaa_opp_hist(p_decision, p_note)), updated_at = now() where id = x.id;
  v_filled := p_decision = 'selected' and v_taken + 1 >= o.seats;
  if p_decision = 'selected' then update kafaa_opportunities set seats_taken = v_taken + 1, status = case when v_filled then 'filled' else status end, updated_at = now() where id = o.id; end if;
  perform kafaa_opp_notify('nt-' || x.id || '-' || p_decision, x.person_id,
    case when p_decision = 'selected' then 'You were selected: ' || o.title_en else 'Not selected this time: ' || o.title_en end,
    case when p_decision = 'selected' then 'تم اختيارك: ' || o.title_ar else 'لم يتم اختيارك هذه المرة: ' || o.title_ar end, '/opportunities/my', case when p_decision = 'selected' then 'ok' else 'info' end);
  l := kafaa_ledger('kafaa.opportunity.select', format('Application %s to %s: %s', x.id, o.id, p_decision));
  a := kafaa_audit('opportunity.select', 'opportunity_applications', x.id, 'ok', p_decision, case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when p_decision = 'selected' then 'Applicant selected' else 'Applicant not selected' end, a, l, jsonb_build_object('status', p_decision, 'filled', v_filled));
end $$;

-- ───────────── RPC: outcome sign-off by the poster -> ojt skill evidence (basis evidenced) + skills recompute. Ledger row.
create or replace function kafaa_complete_opportunity(p_application_id text, p_levels jsonb, p_note text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); x kafaa_opportunity_applications; o kafaa_opportunities; v_role text; v_note text := btrim(coalesce(p_note, '')); v_ok boolean := true; v_clean jsonb := '{}'::jsonb;
  k text; v jsonb; v_ids text[] := '{}'::text[]; v_eid text; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('opportunity.complete', 'opportunity_applications', p_application_id, 'not_signed_in', 'Sign in to use the opportunity marketplace'); end if;
  select * into x from kafaa_opportunity_applications where id = p_application_id;
  if x.id is null or not kafaa_opp_app_visible(x) then return kafaa_refuse('opportunity.complete', 'opportunity_applications', p_application_id, 'not_found', 'Application not found'); end if;
  v_role := kafaa_acting_role('opportunities', array['W','A']);
  if x.person_id = me then return kafaa_refuse('opportunity.complete', 'opportunity_applications', p_application_id, 'maker_checker', 'You cannot sign off your own work', v_role); end if;
  if x.poster_id <> me or v_role is null then return kafaa_refuse('opportunity.complete', 'opportunity_applications', p_application_id, 'forbidden', 'Only the person who posted this opportunity signs off the outcome', v_role); end if;
  if x.status <> 'selected' then return kafaa_refuse('opportunity.complete', 'opportunity_applications', p_application_id, 'invalid', 'Only a selected applicant''s work can be signed off', v_role); end if;
  select * into o from kafaa_opportunities where id = x.opportunity_id;
  if p_levels is null or jsonb_typeof(p_levels) <> 'object' then v_ok := false;
  else
    for k, v in select key, value from jsonb_each(p_levels) loop
      if not (k = any(o.skills_gained)) or jsonb_typeof(v) <> 'number' or (v::text)::numeric <> trunc((v::text)::numeric) or (v::text)::numeric not between 0 and 3 then v_ok := false; exit; end if;
      if (v::text)::numeric > 0 then v_clean := v_clean || jsonb_build_object(k, (v::text)::numeric::integer); end if;
    end loop;
  end if;
  if not v_ok or v_clean = '{}'::jsonb then return kafaa_refuse('opportunity.complete', 'opportunity_applications', p_application_id, 'invalid', 'Rate at least one skill gained, at levels 1 to 3', v_role); end if;
  if length(v_note) < 5 then return kafaa_refuse('opportunity.complete', 'opportunity_applications', p_application_id, 'invalid', 'Describe the outcome in at least one sentence', v_role); end if;
  for k, v in select key, value from jsonb_each(v_clean) order by key collate "C" loop
    v_eid := 'se:ojt:' || x.id || ':' || k;
    insert into kafaa_skill_evidence (id, person_id, skill_id, kind, ref_table, ref_id, level, basis, status, observed_on, note, recorded_by, active)
    values (v_eid, x.person_id, k, 'ojt', 'opportunity_applications', x.id, least(3, greatest(1, (v::text)::integer)), 'evidenced', 'current', current_date, 'Opportunity: ' || o.title_en, me, true)
    on conflict (id) do update set level = excluded.level, observed_on = excluded.observed_on, active = true;
    v_ids := v_ids || v_eid;
  end loop;
  perform kafaa_skills_apply(x.person_id, current_date);
  update kafaa_opportunity_applications set status = 'completed', completed_at = now(), outcome_note = v_note, outcome_levels = v_clean, evidence_ids = v_ids,
    history = history || jsonb_build_array(kafaa_opp_hist('completed', v_note)), updated_at = now() where id = x.id;
  perform kafaa_opp_notify('nt-' || x.id || '-completed', x.person_id, 'Signed off: ' || o.title_en || '. Your skills passport is updated', 'تم الاعتماد: ' || o.title_ar || '. تم تحديث جواز مهاراتك', '/opportunities/my', 'ok');
  l := kafaa_ledger('kafaa.opportunity.complete', format('Opportunity %s outcome signed off for %s (%s skills)', o.id, x.id, cardinality(v_ids)));
  a := kafaa_audit('opportunity.complete', 'opportunity_applications', x.id, 'ok', cardinality(v_ids) || ' ojt evidence rows', case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Outcome signed off; skills evidence recorded', a, l, jsonb_build_object('evidence_ids', to_jsonb(v_ids)));
end $$;

-- ───────────── RPC: the applicant withdraws (before completion)
create or replace function kafaa_withdraw_opportunity_application(p_application_id text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); x kafaa_opportunity_applications; v_role text; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('opportunity.withdraw', 'opportunity_applications', p_application_id, 'not_signed_in', 'Sign in to use the opportunity marketplace'); end if;
  select * into x from kafaa_opportunity_applications where id = p_application_id;
  if x.id is null or not kafaa_opp_app_visible(x) then return kafaa_refuse('opportunity.withdraw', 'opportunity_applications', p_application_id, 'not_found', 'Application not found'); end if;
  v_role := kafaa_acting_role('opportunities', array['Own']);
  if x.person_id <> me then return kafaa_refuse('opportunity.withdraw', 'opportunity_applications', p_application_id, 'forbidden', 'Only the applicant can withdraw an application', v_role); end if;
  if x.status not in ('applied', 'released', 'selected') then return kafaa_refuse('opportunity.withdraw', 'opportunity_applications', p_application_id, 'invalid', 'This application can no longer be withdrawn', v_role); end if;
  update kafaa_opportunity_applications set status = 'withdrawn', history = history || jsonb_build_array(kafaa_opp_hist('withdrawn', null)), updated_at = now() where id = x.id;
  if x.status = 'selected' then update kafaa_opportunities set seats_taken = greatest(0, seats_taken - 1), status = case when status = 'filled' then 'open' else status end, updated_at = now() where id = x.opportunity_id; end if;
  a := kafaa_audit('opportunity.withdraw', 'opportunity_applications', x.id, 'ok', x.status || ' -> withdrawn', 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Application withdrawn', a, null, jsonb_build_object('status', 'withdrawn'));
end $$;

-- ───────────── RPC: save / unsave (own bookmarks)
create or replace function kafaa_save_opportunity(p_opportunity_id text, p_saved boolean default true) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; o kafaa_opportunities; v_id text; v_flag boolean := coalesce(p_saved, true); a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('opportunity.save', 'opportunity_saves', p_opportunity_id, 'not_signed_in', 'Sign in to use the opportunity marketplace'); end if;
  v_role := kafaa_acting_role('opportunities', array['Own']);
  if v_role is null then return kafaa_refuse('opportunity.save', 'opportunity_saves', p_opportunity_id, 'forbidden', 'Only staff can save opportunities'); end if;
  select * into o from kafaa_opportunities where id = p_opportunity_id;
  if o.id is null or not kafaa_opp_visible(o) then return kafaa_refuse('opportunity.save', 'opportunity_saves', p_opportunity_id, 'not_found', 'Opportunity not found', v_role); end if;
  v_id := 'os:' || me || ':' || p_opportunity_id;
  insert into kafaa_opportunity_saves (id, person_id, opportunity_id, saved, open_read, updated_at) values (v_id, me, p_opportunity_id, v_flag, false, now())
  on conflict (id) do update set saved = excluded.saved, updated_at = now();
  a := kafaa_audit('opportunity.save', 'opportunity_saves', v_id, 'ok', case when v_flag then 'saved' else 'unsaved' end, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when v_flag then 'Saved' else 'Removed from saved' end, a, null, jsonb_build_object('saved', v_flag));
end $$;

-- ───────────── Read: HR oversight aggregates (Agg/A on opportunities, or auditors). Mirror of computeStats in domain.ts.
create or replace function kafaa_opportunity_stats() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_people integer; v_sup boolean;
begin
  if kafaa_me() is null or not (kafaa_has_grant('opportunities', array['Agg','A']) or kafaa_has_grant('audit_log', array['R'])) then return null; end if;
  select count(distinct person_id) into v_people from kafaa_opportunity_applications where status <> 'withdrawn';
  v_sup := v_people < 10;
  return jsonb_build_object(
    'opportunities', (select jsonb_build_object('open', count(*) filter (where status = 'open'), 'filled', count(*) filter (where status = 'filled'), 'closed', count(*) filter (where status = 'closed'),
        'draft', count(*) filter (where status = 'draft'), 'emirati_open', count(*) filter (where status = 'open' and 'emirati_development' = any(priority_flags)),
        'knowledge_transfer_open', count(*) filter (where status = 'open' and 'knowledge_transfer' = any(priority_flags))) from kafaa_opportunities),
    'by_kind', (select jsonb_agg(jsonb_build_object('kind', k.kind, 'open', (select count(*) from kafaa_opportunities o where o.kind = k.kind and o.status = 'open'),
        'total', (select count(*) from kafaa_opportunities o where o.kind = k.kind and o.status <> 'draft')) order by k.ord)
      from unnest(array['project', 'outage_support', 'shadowing', 'oe_review', 'knowledge_capture', 'outreach', 'research']) with ordinality as k(kind, ord)),
    'funnel', case when v_sup then jsonb_build_object('applied', null, 'released', null, 'selected', null, 'completed', null, 'applicants', null, 'suppressed', true)
      else (select jsonb_build_object('applied', count(*), 'released', count(*) filter (where released_by is not null), 'selected', count(*) filter (where status in ('selected', 'completed')),
        'completed', count(*) filter (where status = 'completed'), 'applicants', v_people, 'suppressed', false) from kafaa_opportunity_applications where status <> 'withdrawn') end,
    'by_family', coalesce((select jsonb_agg(case when f.n < 10 then jsonb_build_object('family_id', f.fam, 'applicants', null, 'applications', null, 'completed', null, 'suppressed', true)
        else jsonb_build_object('family_id', f.fam, 'applicants', f.n, 'applications', f.apps, 'completed', f.done, 'suppressed', false) end order by f.fam collate "C")
      from (select coalesce(applicant_family_id, 'unknown') as fam, count(distinct person_id) as n, count(*) as apps, count(*) filter (where status = 'completed') as done
              from kafaa_opportunity_applications where status <> 'withdrawn' group by 1) f), '[]'::jsonb),
    'evidence_rows', (select count(*) from kafaa_skill_evidence where kind = 'ojt' and ref_table = 'opportunity_applications' and active),
    'min_group', 10);
end $$;

revoke execute on function kafaa_opp_line_manager(text), kafaa_opp_visible(kafaa_opportunities), kafaa_opp_app_visible(kafaa_opportunity_applications), kafaa_opp_hist(text, text),
  kafaa_opp_notify(text, text, text, text, text, text), kafaa_opp_validate(jsonb, date) from public, anon, authenticated;
revoke execute on function kafaa_post_opportunity(jsonb), kafaa_set_opportunity_status(text, text), kafaa_apply_opportunity(text, text), kafaa_release_decision(text, text, text),
  kafaa_select_applicant(text, text, text), kafaa_complete_opportunity(text, jsonb, text), kafaa_withdraw_opportunity_application(text), kafaa_save_opportunity(text, boolean),
  kafaa_opportunity_stats() from public, anon;
grant execute on function kafaa_post_opportunity(jsonb), kafaa_set_opportunity_status(text, text), kafaa_apply_opportunity(text, text), kafaa_release_decision(text, text, text),
  kafaa_select_applicant(text, text, text), kafaa_complete_opportunity(text, jsonb, text), kafaa_withdraw_opportunity_application(text), kafaa_save_opportunity(text, boolean),
  kafaa_opportunity_stats() to authenticated;
