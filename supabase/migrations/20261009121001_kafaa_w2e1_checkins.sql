-- [W2 · E1 · F10/F11] Kafa'a skill check-ins (self, manager and peer validation with calibration) and the team capability
-- heatmap (coverage against manager-set targets, single points of failure, crew view with counts and availability only).
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file, RLS in the per-statement form,
-- internal helpers and nine RPCs. LocalBackend mirror: src/modules/m17/backend/local.w2.ts; rules: src/modules/m17/checkins.ts.
-- Checked by scripts/validate/w2e1-checkins.mjs (PGlite): RBAC, refusal codes, audit and ledger rows, RLS, and SQL = TS for
-- coverage, crews, distributions and rater offsets on the seed.

-- ───────────── Tables (generated DDL)
-- M17 · Skill check-ins: self, manager and peer validation requests (F10)
create table if not exists kafaa_skill_checkins (
  id text primary key,
  person_id text not null,
  manager_id text,
  peer_ids text[] not null default '{}'::text[],
  skills jsonb not null default '[]'::jsonb,
  message text,
  status text not null default 'open' check (status in ('open', 'validated', 'adjusted', 'withdrawn')),
  requested_at timestamptz not null default now(),
  due_on date not null,
  decided_by text,
  decided_at timestamptz,
  decision_note text
);
comment on table kafaa_skill_checkins is '[M17] Skill check-ins: self, manager and peer validation requests (F10)';

-- M17 · Check-in ratings per rater and skill: self, manager, peer (F10)
create table if not exists kafaa_skill_ratings (
  id text primary key,
  checkin_id text not null,
  subject_id text not null,
  rater_person_id text not null,
  rater_kind text not null check (rater_kind in ('self', 'manager', 'peer')),
  skill_id text not null,
  level integer,
  example text,
  status text not null default 'pending' check (status in ('pending', 'submitted', 'not_observed', 'closed')),
  requested_at timestamptz not null default now(),
  at timestamptz
);
comment on table kafaa_skill_ratings is '[M17] Check-in ratings per rater and skill: self, manager, peer (F10)';

-- M17 · Team skill coverage targets set by managers (F11)
create table if not exists kafaa_team_skill_targets (
  id text primary key,
  team_id text not null,
  skill_id text not null,
  min_people integer not null default 2,
  min_level integer not null default 3,
  note text,
  active boolean not null default true,
  set_by text,
  updated_at timestamptz not null default now()
);
comment on table kafaa_team_skill_targets is '[M17] Team skill coverage targets set by managers (F11)';

do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_checkins_person_id_fk') then alter table kafaa_skill_checkins add constraint kafaa_skill_checkins_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_checkins_manager_id_fk') then alter table kafaa_skill_checkins add constraint kafaa_skill_checkins_manager_id_fk foreign key (manager_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_ratings_checkin_id_fk') then alter table kafaa_skill_ratings add constraint kafaa_skill_ratings_checkin_id_fk foreign key (checkin_id) references kafaa_skill_checkins(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_ratings_subject_id_fk') then alter table kafaa_skill_ratings add constraint kafaa_skill_ratings_subject_id_fk foreign key (subject_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_ratings_rater_person_id_fk') then alter table kafaa_skill_ratings add constraint kafaa_skill_ratings_rater_person_id_fk foreign key (rater_person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_ratings_skill_id_fk') then alter table kafaa_skill_ratings add constraint kafaa_skill_ratings_skill_id_fk foreign key (skill_id) references kafaa_skills(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_team_skill_targets_skill_id_fk') then alter table kafaa_team_skill_targets add constraint kafaa_team_skill_targets_skill_id_fk foreign key (skill_id) references kafaa_skills(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_skill_checkins_person_id_idx on kafaa_skill_checkins (person_id);
create index if not exists kafaa_skill_checkins_manager_id_idx on kafaa_skill_checkins (manager_id);
create index if not exists kafaa_skill_checkins_status_idx on kafaa_skill_checkins (status);
create index if not exists kafaa_skill_ratings_checkin_id_idx on kafaa_skill_ratings (checkin_id);
create index if not exists kafaa_skill_ratings_subject_id_idx on kafaa_skill_ratings (subject_id);
create index if not exists kafaa_skill_ratings_rater_person_id_idx on kafaa_skill_ratings (rater_person_id);
create index if not exists kafaa_skill_ratings_rater_kind_idx on kafaa_skill_ratings (rater_kind);
create index if not exists kafaa_skill_ratings_skill_id_idx on kafaa_skill_ratings (skill_id);
create index if not exists kafaa_skill_ratings_status_idx on kafaa_skill_ratings (status);
create index if not exists kafaa_team_skill_targets_team_id_idx on kafaa_team_skill_targets (team_id);
create index if not exists kafaa_team_skill_targets_skill_id_idx on kafaa_team_skill_targets (skill_id);

-- ───────────── RLS (created when missing, then set to the per-statement form like 20261008140000_kafaa_rls_perf.sql)
-- check-ins: the person (Own), managers and instructors in scope (Scope), the addressed manager, and R/W/A holders.
-- ratings: the subject, the rater (a peer reads only rows addressed to them), Scope over either, and R/W/A holders.
-- targets: R/W/A holders only (managers read them through kafaa_team_coverage). HR (Agg) reads none of the three tables.
alter table kafaa_skill_checkins enable row level security;
alter table kafaa_skill_ratings enable row level security;
alter table kafaa_team_skill_targets enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_skill_checkins' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_skill_checkins for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_skill_ratings' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_skill_ratings for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_team_skill_targets' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_team_skill_targets for select to anon, authenticated using (false)'; end if;
end $$;
alter policy kafaa_read on kafaa_skill_checkins using (((SELECT kafaa_has_grant('skills_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))
  OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('skills_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('skills_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('skills_profile'::text, person_id, NULL::text, false))
  OR ((manager_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('skills_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('skills_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('skills_profile'::text, manager_id, NULL::text, false)));
alter policy kafaa_read on kafaa_skill_ratings using (((SELECT kafaa_has_grant('skills_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))
  OR ((subject_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('skills_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('skills_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('skills_profile'::text, subject_id, NULL::text, false))
  OR ((rater_person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('skills_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('skills_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('skills_profile'::text, rater_person_id, NULL::text, false)));
alter policy kafaa_read on kafaa_team_skill_targets using ((SELECT kafaa_has_grant('skills_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text])));
grant select on kafaa_skill_checkins, kafaa_skill_ratings, kafaa_team_skill_targets to anon, authenticated;
-- All three tables change only through the SECURITY DEFINER RPCs below.
revoke insert, update on kafaa_skill_checkins, kafaa_skill_ratings, kafaa_team_skill_targets from anon, authenticated;

-- ───────────── Internal helpers (mirrors of src/modules/m17/checkins.ts)
create or replace function kafaa_sc_covers(p_type text, p_value text, t kafaa_people) returns boolean language sql immutable set search_path = public as $$
  select case p_type
    when 'all' then true
    when 'crew' then t.crew is not null and t.crew = p_value
    when 'team' then t.team_id is not null and t.team_id = p_value
    when 'family' then t.job_family_id is not null and t.job_family_id = p_value
    when 'org' then t.org_id is not null and t.org_id = p_value
    when 'entity' then t.entity_id is not null and t.entity_id = p_value
    else false end
$$;

-- lineManagerOf: people.manager_id (not a leaver), else the narrowest active manager assignment covering the person.
create or replace function kafaa_sc_line_manager(p_person text) returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select m.id from kafaa_people t join kafaa_people m on m.id = t.manager_id where t.id = p_person and m.status <> 'leaver'),
    (select ra.person_id
       from kafaa_people t
       join kafaa_role_assignments ra on ra.role = 'manager' and ra.status = 'active' and (ra.expires_at is null or ra.expires_at >= current_date) and ra.person_id <> t.id
       join kafaa_people h on h.id = ra.person_id and h.status <> 'leaver'
      where t.id = p_person and kafaa_sc_covers(ra.scope_type, ra.scope_value, t)
      order by case ra.scope_type when 'crew' then 1 when 'team' then 1 when 'family' then 2 when 'org' then 3 when 'entity' then 3 when 'all' then 4 else 9 end, ra.person_id collate "C"
      limit 1))
$$;

-- peerPool: same team (same job family without a team), active staff, never the line manager or a Scope holder over the person.
create or replace function kafaa_sc_peer_pool(p_me text) returns table (id text) language sql stable security definer set search_path = public as $$
  select x.id
    from kafaa_people x, kafaa_people t
   where t.id = p_me and x.id <> t.id and x.kind = 'staff' and x.status = 'active'
     and x.id is distinct from kafaa_sc_line_manager(p_me)
     and not exists (select 1 from kafaa_role_assignments ra
                      where ra.person_id = x.id and ra.role in ('manager', 'instructor', 'training_manager') and ra.status = 'active'
                        and (ra.expires_at is null or ra.expires_at >= current_date) and kafaa_sc_covers(ra.scope_type, ra.scope_value, t))
     and ((t.team_id is not null and x.team_id = t.team_id) or (t.team_id is null and t.job_family_id is not null and x.job_family_id = t.job_family_id))
   order by x.id collate "C"
$$;

-- checkinBlock: security (status only) or qualification-only (keyed to a standard, or held by a current qualification record).
create or replace function kafaa_sc_block(p_person text, p_skill text) returns text language sql stable security definer set search_path = public as $$
  select case
    when s.area = 'security' or coalesce(c.domain, '') = 'security' then 'security_restricted'
    when exists (select 1 from kafaa_qual_standards q where q.id = any(s.evidence_keys))
      or exists (select 1 from kafaa_skill_evidence e where e.person_id = p_person and e.skill_id = s.id and e.kind = 'qual' and e.status = 'current' and e.active) then 'qualification_only'
  end
  from kafaa_skills s left join kafaa_competencies c on c.id = s.competency_id where s.id = p_skill
$$;

create or replace function kafaa_sc_card(p_id text) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', p.id, 'name_en', p.display_name, 'name_ar', coalesce(nullif(p.display_name_ar, ''), p.display_name), 'job_role_id', p.job_role_id)
  from kafaa_people p where p.id = p_id
$$;

-- Notifications: one row per event (on conflict do nothing). The RPC writes its own audit row, so the row-audit trigger on
-- kafaa_notifications is quiet here (transaction-local kafaa.seeding), like the LocalBackend.
create or replace function kafaa_sc_notify(p_id text, p_person text, p_en text, p_ar text, p_link text, p_sev text default 'info') returns void language plpgsql security definer set search_path = public as $$
declare v_prev text := current_setting('kafaa.seeding', true);
begin
  if p_person is null or not exists (select 1 from kafaa_people where id = p_person) then return; end if;
  perform set_config('kafaa.seeding', 'on', true);
  insert into kafaa_notifications (id, person_id, kind, title_en, title_ar, link, severity) values (p_id, p_person, 'skills', p_en, p_ar, p_link, p_sev) on conflict (id) do nothing;
  perform set_config('kafaa.seeding', coalesce(v_prev, ''), true);
end $$;

-- availabilityOf (crew view): no licence mirror row = available; stale sync (> 72 h) = unknown; else valid, unexpired, medically in date.
create or replace function kafaa_sc_available(p_person text) returns boolean language sql stable security definer set search_path = public as $$
  select case when l.id is null then true
              when now() - l.last_synced > interval '72 hours' then null
              else (l.status = 'valid' and l.expires_on >= current_date
                    and coalesce((select m.due_on >= current_date from kafaa_medical_due m where m.person_id = p_person order by m.id collate "C" limit 1), false)) end
  from (select 1) d left join lateral (select * from kafaa_licences x where x.person_id = p_person order by x.id collate "C" limit 1) l on true
$$;

-- Active staff the caller may see by name (Scope/R/W/A: kafaa_rule_read) or, for Agg-only callers, every active staff member.
create or replace function kafaa_sc_pool(p_people boolean) returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(p.id order by p.id collate "C"), '{}'::text[]) from kafaa_people p
   where p.kind = 'staff' and p.status = 'active' and (not p_people or kafaa_rule_read('skills_profile', p.id, null::text, true))
$$;

create or replace function kafaa_sc_groups(p_ids text[]) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('key', g.kind || ':' || g.id, 'kind', g.kind, 'id', g.id, 'size', g.n) order by case g.kind when 'team' then 0 else 1 end, g.id collate "C"), '[]'::jsonb)
  from (select 'team'::text kind, team_id id, count(*)::int n from kafaa_people where id = any(p_ids) and team_id is not null group by team_id
        union all
        select 'family'::text, job_family_id, count(*)::int from kafaa_people where id = any(p_ids) and job_family_id is not null group by job_family_id) g
$$;

create or replace function kafaa_sc_default_group(p_groups jsonb, p_me text, p_people boolean) returns text language plpgsql stable security definer set search_path = public as $$
declare t kafaa_people; k text;
begin
  if jsonb_array_length(p_groups) = 0 then return null; end if;
  if p_people then
    select * into t from kafaa_people where id = p_me;
    foreach k in array array[case when t.team_id is not null then 'team:' || t.team_id end, case when t.job_family_id is not null then 'family:' || t.job_family_id end] loop
      if k is not null and exists (select 1 from jsonb_array_elements(p_groups) g where g->>'key' = k) then return k; end if;
    end loop;
  end if;
  return (select g->>'key' from jsonb_array_elements(p_groups) g order by (g->>'size')::int desc, (g->>'key') collate "C" limit 1);
end $$;

create or replace function kafaa_sc_members(p_pool text[], p_key text) returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(p.id order by p.id collate "C"), '{}'::text[]) from kafaa_people p
   where p.id = any(p_pool) and (('team:' || p.team_id) = p_key or ('family:' || p.job_family_id) = p_key)
$$;

create or replace function kafaa_sc_is_int(p jsonb) returns boolean language sql immutable set search_path = public as $$
  select jsonb_typeof(p) = 'number' and (p::text)::numeric = floor((p::text)::numeric)
$$;

-- ───────────── RPC: request a check-in (F10). Own only; same checks, order and codes as backend/local.w2.ts.
create or replace function kafaa_request_checkin(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_list jsonb := coalesce(p->'skills', 'null'::jsonb); v_item jsonb; v_ids text[]; s kafaa_skills; v_block text;
  v_note text; v_items jsonb := '[]'::jsonb; v_sid text; v_open integer; v_pj jsonb := coalesce(p->'peer_ids', 'null'::jsonb); v_peers text[] := '{}'::text[];
  v_mgr text; v_msg text := trim(coalesce(p->>'message', '')); v_id text; v_due date; v_now timestamptz := now(); v_p text; a kafaa_audit_events;
  c_act constant text := 'skills.checkin.request'; c_tbl constant text := 'skill_checkins';
begin
  if me is null then return kafaa_refuse(c_act, c_tbl, null, 'not_signed_in', 'Sign in to use skill check-ins'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  if v_role is null then return kafaa_refuse(c_act, c_tbl, null, 'forbidden', 'Only staff can ask for a skill check-in on their own skills'); end if;
  if jsonb_typeof(v_list) <> 'array' or jsonb_array_length(v_list) < 1 or jsonb_array_length(v_list) > 5 then
    return kafaa_refuse(c_act, c_tbl, null, 'invalid', 'Choose one to five skills', v_role); end if;
  v_ids := array(select trim(coalesce(e->>'skill_id', '')) from jsonb_array_elements(v_list) e);
  if (select count(distinct x) from unnest(v_ids) x) <> cardinality(v_ids) then
    return kafaa_refuse(c_act, c_tbl, null, 'invalid', 'Each skill can appear once in a check-in', v_role); end if;
  for v_item in select e from jsonb_array_elements(v_list) e loop
    v_sid := trim(coalesce(v_item->>'skill_id', ''));
    select * into s from kafaa_skills where id = v_sid;
    if s.id is null then return kafaa_refuse(c_act, c_tbl, nullif(v_sid, ''), 'not_found', 'Skill not found', v_role); end if;
    v_block := kafaa_sc_block(me, s.id);
    if v_block = 'security_restricted' then return kafaa_refuse(c_act, c_tbl, s.id, v_block, 'Security competencies show as qualified or not qualified only: they cannot be checked in', v_role); end if;
    if v_block = 'qualification_only' then return kafaa_refuse(c_act, c_tbl, s.id, v_block, 'Verified by qualification only: this skill cannot be validated by a check-in', v_role); end if;
    if not kafaa_sc_is_int(v_item->'self_level') or (v_item->>'self_level')::numeric < 1 or (v_item->>'self_level')::numeric > 4 then
      return kafaa_refuse(c_act, c_tbl, s.id, 'invalid', 'Self level must be between 1 and 4', v_role); end if;
    v_note := trim(coalesce(v_item->>'note', ''));
    if length(v_note) < 3 or length(v_note) > 300 then return kafaa_refuse(c_act, c_tbl, s.id, 'invalid', 'Add a short evidence note for each skill (3 to 300 characters)', v_role); end if;
    v_items := v_items || jsonb_build_array(jsonb_build_object('skill_id', s.id, 'self_level', (v_item->>'self_level')::numeric::int, 'note', v_note));
  end loop;
  for v_item in select e from jsonb_array_elements(v_items) e loop
    if exists (select 1 from kafaa_skill_checkins c, jsonb_array_elements(c.skills) x where c.person_id = me and c.status = 'open' and x->>'skill_id' = v_item->>'skill_id') then
      return kafaa_refuse(c_act, c_tbl, v_item->>'skill_id', 'conflict', 'This skill is already in an open check-in', v_role); end if;
  end loop;
  select count(*) into v_open from kafaa_skill_checkins where person_id = me and status = 'open';
  if v_open >= 3 then return kafaa_refuse(c_act, c_tbl, null, 'limit', 'You can have up to 3 open check-ins', v_role); end if;
  if jsonb_typeof(v_pj) = 'array' then v_peers := array(select trim(x) from jsonb_array_elements_text(v_pj) with ordinality t(x, o) order by o); end if;
  if cardinality(v_peers) > 2 then return kafaa_refuse(c_act, c_tbl, null, 'invalid', 'Choose up to two peers', v_role); end if;
  if (select count(distinct x) from unnest(v_peers) x) <> cardinality(v_peers)
     or exists (select 1 from unnest(v_peers) x where x not in (select id from kafaa_sc_peer_pool(me))) then
    return kafaa_refuse(c_act, c_tbl, null, 'not_peer', 'Peers must be different colleagues from your own team', v_role); end if;
  v_mgr := kafaa_sc_line_manager(me);
  if v_mgr is null then return kafaa_refuse(c_act, c_tbl, null, 'no_manager', 'No line manager found for you: ask HR to record your line manager', v_role); end if;
  if length(v_msg) > 300 then return kafaa_refuse(c_act, c_tbl, null, 'invalid', 'The note to raters can be up to 300 characters', v_role); end if;
  v_id := 'chk-' || left(replace(gen_random_uuid()::text, '-', ''), 16);
  v_due := (now() at time zone 'UTC')::date + 14;
  insert into kafaa_skill_checkins (id, person_id, manager_id, peer_ids, skills, message, status, requested_at, due_on)
  values (v_id, me, v_mgr, v_peers, v_items, nullif(v_msg, ''), 'open', v_now, v_due);
  for v_item in select e from jsonb_array_elements(v_items) e loop
    v_sid := v_item->>'skill_id';
    insert into kafaa_skill_ratings (id, checkin_id, subject_id, rater_person_id, rater_kind, skill_id, level, example, status, requested_at, at)
    values ('skr:' || v_id || ':' || me || ':' || v_sid, v_id, me, me, 'self', v_sid, (v_item->>'self_level')::int, v_item->>'note', 'submitted', v_now, v_now),
           ('skr:' || v_id || ':' || v_mgr || ':' || v_sid, v_id, me, v_mgr, 'manager', v_sid, null, null, 'pending', v_now, null);
    foreach v_p in array v_peers loop
      insert into kafaa_skill_ratings (id, checkin_id, subject_id, rater_person_id, rater_kind, skill_id, status, requested_at)
      values ('skr:' || v_id || ':' || v_p || ':' || v_sid, v_id, me, v_p, 'peer', v_sid, 'pending', v_now);
    end loop;
  end loop;
  perform kafaa_sc_notify('nt-' || v_id || '-mgr', v_mgr, 'Skill check-in to validate', 'تقييم مهارات بانتظار اعتمادك', '/team/skills/validate');
  foreach v_p in array v_peers loop
    perform kafaa_sc_notify('nt-' || v_id || '-' || v_p, v_p, 'A colleague asked you to rate a skill', 'طلب منك زميل تقييم مهارة', '/my/skills/checkins');
  end loop;
  a := kafaa_audit(c_act, c_tbl, v_id, 'ok', (select string_agg(e->>'skill_id', ',' order by o) from jsonb_array_elements(v_items) with ordinality t(e, o)) || '; manager ' || v_mgr || '; ' || cardinality(v_peers) || ' peer(s)', 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Check-in sent to your line manager', a, null, jsonb_build_object('id', v_id, 'manager_id', v_mgr, 'due_on', v_due));
end $$;

-- ───────────── RPC: a peer answers the rows addressed to them (F10).
create or replace function kafaa_submit_rating(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_cid text := trim(coalesce(p->>'checkin_id', '')); c kafaa_skill_checkins; v_list jsonb := coalesce(p->'ratings', 'null'::jsonb);
  r jsonb; v_sid text; v_ex text; v_lvl integer; a kafaa_audit_events; v_now timestamptz := now();
  c_act constant text := 'skills.checkin.rate'; c_tbl constant text := 'skill_ratings';
begin
  if me is null then return kafaa_refuse(c_act, c_tbl, nullif(v_cid, ''), 'not_signed_in', 'Sign in to use skill check-ins'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  if v_role is null then return kafaa_refuse(c_act, c_tbl, nullif(v_cid, ''), 'forbidden', 'Only staff can ask for a skill check-in on their own skills'); end if;
  select * into c from kafaa_skill_checkins where id = v_cid;
  if c.id is null or not exists (select 1 from kafaa_skill_ratings x where x.checkin_id = v_cid and x.rater_person_id = me and x.rater_kind = 'peer') then
    return kafaa_refuse(c_act, c_tbl, nullif(v_cid, ''), 'not_found', 'Check-in not found', v_role); end if;
  if c.status <> 'open' then return kafaa_refuse(c_act, c_tbl, v_cid, 'conflict', 'This check-in is already closed', v_role); end if;
  if jsonb_typeof(v_list) <> 'array' or jsonb_array_length(v_list) = 0 then return kafaa_refuse(c_act, c_tbl, v_cid, 'invalid', 'Rate only the skills named for you', v_role); end if;
  for r in select e from jsonb_array_elements(v_list) e loop
    v_sid := trim(coalesce(r->>'skill_id', ''));
    if not exists (select 1 from kafaa_skill_ratings x where x.checkin_id = v_cid and x.rater_person_id = me and x.rater_kind = 'peer' and x.skill_id = v_sid) then
      return kafaa_refuse(c_act, c_tbl, v_cid, 'invalid', 'Rate only the skills named for you', v_role); end if;
    if not kafaa_sc_is_int(r->'level') or (r->>'level')::numeric < 0 or (r->>'level')::numeric > 4 then
      return kafaa_refuse(c_act, c_tbl, v_cid, 'invalid', 'Level must be between 1 and 4, or 0 for not observed', v_role); end if;
    v_ex := trim(coalesce(r->>'example', ''));
    if ((r->>'level')::numeric > 0 and (length(v_ex) < 3 or length(v_ex) > 200)) or length(v_ex) > 200 then
      return kafaa_refuse(c_act, c_tbl, v_cid, 'invalid', 'Give a one-line example (3 to 200 characters)', v_role); end if;
  end loop;
  for r in select e from jsonb_array_elements(v_list) e loop
    v_lvl := (r->>'level')::numeric::int;
    update kafaa_skill_ratings set level = case when v_lvl > 0 then v_lvl end, example = nullif(trim(coalesce(r->>'example', '')), ''),
           status = case when v_lvl > 0 then 'submitted' else 'not_observed' end, at = v_now
     where checkin_id = v_cid and rater_person_id = me and rater_kind = 'peer' and skill_id = trim(coalesce(r->>'skill_id', ''));
  end loop;
  perform kafaa_sc_notify('nt-' || v_cid || '-peer-' || me, c.person_id, 'A colleague answered your skill check-in', 'أجاب زميل على طلب تقييم مهاراتك', '/my/skills/checkins');
  a := kafaa_audit(c_act, c_tbl, v_cid, 'ok', jsonb_array_length(v_list) || ' rating(s) as peer', 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Thank you: your ratings were sent', a, null, jsonb_build_object('submitted', jsonb_array_length(v_list)));
end $$;

-- ───────────── RPC: the manager validates, adjusts or defers each skill (F10). Never the person (self_validate).
-- Validated and adjusted levels become `rating` evidence with basis `validated` (a pending self-claim on the same skill is
-- decided and its evidence row flipped to validated, per the F03 hand-off); qualification-only skills are never raised.
create or replace function kafaa_validate_checkin(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_cid text := trim(coalesce(p->>'checkin_id', '')); c kafaa_skill_checkins; v_dec jsonb := coalesce(p->'decisions', 'null'::jsonb);
  s jsonb; d jsonb; v_out jsonb := '[]'::jsonb; v_sid text; v_outcome text; v_final integer; v_why text; v_today date := (now() at time zone 'UTC')::date; v_now timestamptz := now();
  cl kafaa_skill_claims; v_ev text; v_note text; v_written integer := 0; v_status text; n_v integer; n_a integer; n_n integer; a kafaa_audit_events; l integer;
  c_act constant text := 'skills.checkin.validate'; c_tbl constant text := 'skill_checkins';
begin
  if me is null then return kafaa_refuse(c_act, c_tbl, nullif(v_cid, ''), 'not_signed_in', 'Sign in to use skill check-ins'); end if;
  select * into c from kafaa_skill_checkins where id = v_cid;
  if c.id is null then return kafaa_refuse(c_act, c_tbl, nullif(v_cid, ''), 'not_found', 'Check-in not found'); end if;
  if c.person_id = me then return kafaa_refuse(c_act, c_tbl, v_cid, 'self_validate', 'You cannot validate your own check-in', kafaa_acting_role('skills_profile', array['Own'])); end if;
  if not ((c.manager_id = me and kafaa_has_grant('skills_profile', array['Own', 'Scope', 'A'])) or kafaa_in_scope('skills_profile', c.person_id) or kafaa_has_grant('skills_profile', array['A'])) then
    return kafaa_refuse(c_act, c_tbl, v_cid, 'forbidden', 'Only your line manager, a manager in scope or the training manager can validate this check-in'); end if;
  v_role := coalesce(kafaa_acting_role('skills_profile', array['Scope', 'A']), kafaa_acting_role('skills_profile', array['Own']));
  if c.status <> 'open' then return kafaa_refuse(c_act, c_tbl, v_cid, 'conflict', 'This check-in is already closed', v_role); end if;
  if jsonb_typeof(v_dec) <> 'array' then v_dec := '[]'::jsonb; end if;
  for s in select e from jsonb_array_elements(c.skills) e loop
    if (select count(*) from jsonb_array_elements(v_dec) x where trim(coalesce(x->>'skill_id', '')) = s->>'skill_id') <> 1 then
      return kafaa_refuse(c_act, c_tbl, v_cid, 'invalid', 'Decide every skill in the check-in', v_role); end if;
  end loop;
  if jsonb_array_length(v_dec) <> jsonb_array_length(c.skills) then return kafaa_refuse(c_act, c_tbl, v_cid, 'invalid', 'Decide every skill in the check-in', v_role); end if;
  for d in select e from jsonb_array_elements(v_dec) e loop
    select e into s from jsonb_array_elements(c.skills) e where e->>'skill_id' = trim(coalesce(d->>'skill_id', ''));
    v_why := trim(coalesce(d->>'reason', ''));
    if d->>'outcome' = 'adjust' then
      if not kafaa_sc_is_int(d->'level') or (d->>'level')::numeric < 1 or (d->>'level')::numeric > 4 or (d->>'level')::numeric = (s->>'self_level')::numeric or length(v_why) < 3 or length(v_why) > 300 then
        return kafaa_refuse(c_act, c_tbl, v_cid, 'invalid', 'An adjustment needs a different level (1 to 4) and a reason (3 to 300 characters)', v_role); end if;
    elsif d->>'outcome' = 'not_yet' then
      if length(v_why) < 3 or length(v_why) > 300 then return kafaa_refuse(c_act, c_tbl, v_cid, 'invalid', 'Say why the skill is not validated yet (3 to 300 characters)', v_role); end if;
    elsif coalesce(d->>'outcome', '') <> 'validate' then
      return kafaa_refuse(c_act, c_tbl, v_cid, 'invalid', 'Decide every skill in the check-in', v_role);
    end if;
  end loop;
  for s in select e from jsonb_array_elements(c.skills) with ordinality t(e, o) order by o loop
    v_sid := s->>'skill_id';
    select e into d from jsonb_array_elements(v_dec) e where trim(coalesce(e->>'skill_id', '')) = v_sid;
    v_why := nullif(trim(coalesce(d->>'reason', '')), '');
    v_outcome := case when kafaa_sc_block(c.person_id, v_sid) is not null or not exists (select 1 from kafaa_skills where id = v_sid) then 'qualification_only' else d->>'outcome' end;
    v_final := case v_outcome when 'validate' then (s->>'self_level')::int when 'adjust' then (d->>'level')::numeric::int end;
    v_out := v_out || jsonb_build_array(s || jsonb_build_object('outcome', v_outcome, 'final_level', v_final, 'reason', v_why));
    insert into kafaa_skill_ratings (id, checkin_id, subject_id, rater_person_id, rater_kind, skill_id, level, example, status, requested_at, at)
    values ('skr:' || v_cid || ':' || me || ':' || v_sid, v_cid, c.person_id, me, 'manager', v_sid, v_final, coalesce(v_why, case when v_outcome = 'validate' then 'Validated' end), 'submitted', v_now, v_now)
    on conflict (id) do update set level = excluded.level, example = excluded.example, status = 'submitted', at = excluded.at;
    if v_final is null then continue; end if;
    v_note := coalesce(v_why, 'Validated in check-in ' || v_cid);
    select * into cl from kafaa_skill_claims x where x.person_id = c.person_id and x.skill_id = v_sid and x.status = 'claimed'
     order by x.created_at desc, x.id collate "C" limit 1;
    if cl.id is not null then
      update kafaa_skill_claims set status = case when v_final >= cl.level then 'validated' else 'rejected' end, decided_by = me, decided_at = v_now,
             decision_note = 'Check-in ' || v_cid || ': level ' || v_final || coalesce(' (' || v_why || ')', '')
       where id = cl.id;
      v_ev := 'se:rating:' || cl.id || ':' || v_sid;
      insert into kafaa_skill_evidence (id, person_id, skill_id, kind, ref_table, ref_id, level, basis, status, observed_on, note, recorded_by, active, created_at)
      values (v_ev, c.person_id, v_sid, 'rating', 'skill_claims', cl.id, v_final, 'validated', 'current', v_today, v_note, me, true, v_now)
      on conflict (id) do update set level = excluded.level, basis = 'validated', status = 'current', observed_on = excluded.observed_on, note = excluded.note, recorded_by = excluded.recorded_by, active = true;
    else
      insert into kafaa_skill_evidence (id, person_id, skill_id, kind, ref_table, ref_id, level, basis, status, observed_on, note, recorded_by, active, created_at)
      values ('se:rating:' || v_cid || ':' || v_sid, c.person_id, v_sid, 'rating', 'skill_checkins', v_cid, v_final, 'validated', 'current', v_today, v_note, me, true, v_now)
      on conflict (id) do nothing;
    end if;
    v_written := v_written + 1;
  end loop;
  update kafaa_skill_ratings set status = 'closed' where checkin_id = v_cid and status = 'pending';
  v_status := case when (select bool_and(e->>'outcome' = 'validate') from jsonb_array_elements(v_out) e) then 'validated' else 'adjusted' end;
  update kafaa_skill_checkins set skills = v_out, status = v_status, decided_by = me, decided_at = v_now, decision_note = nullif(trim(coalesce(p->>'note', '')), '') where id = v_cid;
  perform kafaa_skills_apply(c.person_id, v_today);
  select count(*) filter (where e->>'outcome' = 'validate'), count(*) filter (where e->>'outcome' = 'adjust'), count(*) filter (where e->>'outcome' not in ('validate', 'adjust'))
    into n_v, n_a, n_n from jsonb_array_elements(v_out) e;
  perform kafaa_sc_notify('nt-' || v_cid || '-done', c.person_id, 'Your skill check-in was reviewed', 'تمت مراجعة طلب تقييم مهاراتك', '/my/skills/checkins', case when v_status = 'validated' then 'ok' else 'info' end);
  l := kafaa_ledger('kafaa.skills.checkin.validate', format('Check-in %s: %s validated, %s adjusted, %s not yet', v_cid, n_v, n_a, n_n));
  a := kafaa_audit(c_act, c_tbl, v_cid, 'ok', format('%s: %s validated, %s adjusted, %s not yet', v_status, n_v, n_a, n_n), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when v_status = 'validated' then 'Check-in validated' else 'Check-in decided with adjustments' end, a, l, jsonb_build_object('status', v_status, 'written', v_written));
end $$;

-- ───────────── RPC: the person withdraws an open check-in (F10).
create or replace function kafaa_withdraw_checkin(p_id text, p_reason text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_cid text := trim(coalesce(p_id, '')); c kafaa_skill_checkins; v_why text := nullif(left(trim(coalesce(p_reason, '')), 300), ''); a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('skills.checkin.withdraw', 'skill_checkins', nullif(v_cid, ''), 'not_signed_in', 'Sign in to use skill check-ins'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  select * into c from kafaa_skill_checkins where id = v_cid;
  if c.id is null or c.person_id <> me or v_role is null then return kafaa_refuse('skills.checkin.withdraw', 'skill_checkins', nullif(v_cid, ''), 'not_found', 'Check-in not found', v_role); end if;
  if c.status <> 'open' then return kafaa_refuse('skills.checkin.withdraw', 'skill_checkins', v_cid, 'conflict', 'This check-in is already closed', v_role); end if;
  update kafaa_skill_checkins set status = 'withdrawn', decided_by = me, decided_at = now(), decision_note = v_why where id = v_cid;
  update kafaa_skill_ratings set status = 'closed' where checkin_id = v_cid and status = 'pending';
  a := kafaa_audit('skills.checkin.withdraw', 'skill_checkins', v_cid, 'ok', coalesce(v_why, 'withdrawn'), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Check-in withdrawn', a, null);
end $$;

-- ───────────── Reads (F10): my line manager and peer pool; rating requests addressed to me as a peer.
create or replace function kafaa_checkin_peers() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); t kafaa_people;
begin
  if me is null or not kafaa_has_grant('skills_profile', array['Own']) then raise exception 'Kafa''a · skill check-ins are for staff' using errcode = '42501'; end if;
  select * into t from kafaa_people where id = me;
  return jsonb_build_object('me', me, 'manager', kafaa_sc_card(kafaa_sc_line_manager(me)),
    'basis', case when t.team_id is not null then 'team' when t.job_family_id is not null then 'family' end,
    'peers', coalesce((select jsonb_agg(kafaa_sc_card(x.id) order by x.id collate "C") from kafaa_sc_peer_pool(me) x), '[]'::jsonb));
end $$;

create or replace function kafaa_checkin_inbox() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me();
begin
  if me is null then raise exception 'Kafa''a · sign in to see rating requests' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('checkin_id', c.id, 'requester', kafaa_sc_card(c.person_id), 'requested_at', c.requested_at, 'due_on', c.due_on, 'message', c.message, 'status', c.status,
             'items', (select jsonb_agg(jsonb_build_object('skill_id', r.skill_id, 'level', r.level, 'example', r.example, 'status', r.status) order by r.skill_id collate "C")
                         from kafaa_skill_ratings r where r.checkin_id = c.id and r.rater_person_id = me and r.rater_kind = 'peer'))
           order by c.requested_at desc, c.id collate "C")
      from kafaa_skill_checkins c
     where exists (select 1 from kafaa_skill_ratings r where r.checkin_id = c.id and r.rater_person_id = me and r.rater_kind = 'peer')), '[]'::jsonb);
end $$;

-- ───────────── Read (F10): calibration for a group in my scope (managers, instructors, training manager).
create or replace function kafaa_checkin_calibration(p_group text default null) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); v_pool text[]; v_groups jsonb; v_key text; v_found boolean; v_members text[]; v_ck text[]; v_supp boolean; v_skills text[]; v_dist jsonb; v_raters jsonb;
begin
  if me is null or not kafaa_has_grant('skills_profile', array['Scope', 'R', 'W', 'A']) then raise exception 'Kafa''a · calibration is for managers in scope' using errcode = '42501'; end if;
  v_pool := kafaa_sc_pool(true);
  v_groups := kafaa_sc_groups(v_pool);
  v_key := coalesce(p_group, kafaa_sc_default_group(v_groups, me, true));
  v_found := exists (select 1 from jsonb_array_elements(v_groups) g where g->>'key' = v_key);
  v_members := case when v_found then kafaa_sc_members(v_pool, v_key) else '{}'::text[] end;
  v_ck := array(select c.id from kafaa_skill_checkins c where c.person_id = any(v_members) and c.status <> 'withdrawn');
  v_supp := cardinality(v_members) < 10;
  v_skills := array(select s.id from kafaa_skills s left join kafaa_competencies cp on cp.id = s.competency_id
                     where not (s.area = 'security' or coalesce(cp.domain, '') = 'security')
                       and exists (select 1 from kafaa_skill_ratings r where r.checkin_id = any(v_ck) and r.skill_id = s.id)
                     order by coalesce(s.sort, 0), s.id collate "C");
  select coalesce(jsonb_agg(x.j order by x.o), '[]'::jsonb) into v_dist from (
    select k.o, jsonb_build_object('skill_id', k.sid,
      'ratings', (select count(*)::int from kafaa_skill_ratings r where r.checkin_id = any(v_ck) and r.skill_id = k.sid and r.status = 'submitted' and r.level is not null),
      'dist', case when v_supp then null else (select jsonb_build_array(count(*) filter (where lv = 0), count(*) filter (where lv = 1), count(*) filter (where lv = 2), count(*) filter (where lv = 3), count(*) filter (where lv = 4))
                 from (select least(4, coalesce((select ps.level from kafaa_person_skills ps where ps.person_id = m and ps.skill_id = k.sid and ps.active and ps.level > 0 and ps.basis <> 'none'), 0)) lv from unnest(v_members) m) z) end,
      'means', case when v_supp then null else (select jsonb_build_object(
                 'self', (select floor(avg(r.level) * 100 + 0.5) / 100 from kafaa_skill_ratings r where r.checkin_id = any(v_ck) and r.skill_id = k.sid and r.status = 'submitted' and r.level is not null and r.rater_kind = 'self'),
                 'peer', (select floor(avg(r.level) * 100 + 0.5) / 100 from kafaa_skill_ratings r where r.checkin_id = any(v_ck) and r.skill_id = k.sid and r.status = 'submitted' and r.level is not null and r.rater_kind = 'peer'),
                 'manager', (select floor(avg(r.level) * 100 + 0.5) / 100 from kafaa_skill_ratings r where r.checkin_id = any(v_ck) and r.skill_id = k.sid and r.status = 'submitted' and r.level is not null and r.rater_kind = 'manager'))) end) j
    from unnest(v_skills) with ordinality k(sid, o)) x;
  select coalesce(jsonb_agg(jsonb_build_object('rater_id', q.rater_person_id, 'kind', q.rater_kind, 'n', q.n, 'offset', q.off,
           'flag', case when q.n < 3 then 'few' when q.off >= 0.75 then 'high' when q.off <= -0.75 then 'low' else 'aligned' end,
           'name_en', coalesce(pp.display_name, q.rater_person_id), 'name_ar', coalesce(nullif(pp.display_name_ar, ''), pp.display_name, q.rater_person_id))
         order by abs(q.off) desc, q.rater_person_id collate "C", q.rater_kind collate "C"), '[]'::jsonb) into v_raters
    from (select r.rater_person_id, r.rater_kind, count(*)::int n, floor(avg(r.level - ev.lv) * 100 + 0.5) / 100 off
            from kafaa_skill_ratings r
            join lateral (select max(e.level) lv from kafaa_skill_evidence e where e.person_id = r.subject_id and e.skill_id = r.skill_id and e.active and e.kind <> 'rating') ev on ev.lv is not null
           where r.checkin_id = any(v_ck) and r.status = 'submitted' and r.level is not null
           group by r.rater_person_id, r.rater_kind) q
    left join kafaa_people pp on pp.id = q.rater_person_id;
  return jsonb_build_object('groups', v_groups, 'group', v_key, 'size', cardinality(v_members), 'suppressed', v_supp, 'checkins', cardinality(v_ck), 'distributions', v_dist, 'raters', v_raters);
end $$;

-- ───────────── Read (F11): people x skills heatmap, coverage, single points of failure and the crew view.
-- Scope/R/W/A callers see named people in their scope; Agg-only callers (HR) see coverage counts, suppressed below 10.
create or replace function kafaa_team_coverage(p_group text default null) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); v_people boolean; v_agg boolean; v_pool text[]; v_groups jsonb; v_key text; v_found boolean; v_members text[]; v_size integer; v_supp boolean;
  v_cols text[]; v_targets jsonb; v_profile jsonb; v_cov jsonb; v_cells jsonb := '[]'::jsonb; v_mem jsonb := '[]'::jsonb; v_crews jsonb := '[]'::jsonb;
  c_counted constant text[] := array['verified', 'evidenced', 'validated'];
begin
  v_people := kafaa_has_grant('skills_profile', array['Scope', 'R', 'W', 'A']);
  v_agg := kafaa_has_grant('skills_profile', array['Agg']);
  if me is null or (not v_people and not v_agg) then raise exception 'Kafa''a · team capability is for managers in scope and HR aggregates' using errcode = '42501'; end if;
  v_pool := kafaa_sc_pool(v_people);
  v_groups := kafaa_sc_groups(v_pool);
  v_key := coalesce(p_group, kafaa_sc_default_group(v_groups, me, v_people));
  v_found := exists (select 1 from jsonb_array_elements(v_groups) g where g->>'key' = v_key);
  v_members := case when v_found then kafaa_sc_members(v_pool, v_key) else '{}'::text[] end;
  v_size := cardinality(v_members);
  v_supp := not v_people and v_size < 10;
  v_targets := coalesce((select jsonb_agg(jsonb_build_object('team_id', t.team_id, 'skill_id', t.skill_id, 'min_people', t.min_people, 'min_level', t.min_level, 'active', true, 'note', t.note) order by t.skill_id collate "C")
                 from kafaa_team_skill_targets t where v_found and t.active and t.team_id = v_key), '[]'::jsonb);
  v_profile := coalesce((select jsonb_agg(jsonb_build_object('team_id', t.team_id, 'skill_id', t.skill_id, 'min_people', t.min_people, 'min_level', t.min_level, 'active', true, 'note', t.note) order by t.skill_id collate "C")
                 from kafaa_team_skill_targets t where t.active and t.team_id = 'crew:profile'), '[]'::jsonb);
  v_cols := array(select s.id from kafaa_skills s left join kafaa_competencies cp on cp.id = s.competency_id
                   where not (s.area = 'security' or coalesce(cp.domain, '') = 'security')
                     and (exists (select 1 from kafaa_team_skill_targets t where v_found and t.active and t.team_id = v_key and t.skill_id = s.id)
                          or (not v_supp and exists (select 1 from kafaa_person_skills ps where ps.person_id = any(v_members) and ps.skill_id = s.id and ps.active and ps.level > 0 and ps.basis <> 'none')))
                   order by coalesce(s.sort, 0), s.id collate "C");
  select coalesce(jsonb_agg(x.j order by x.o), '[]'::jsonb) into v_cov from (
    select k.o, case when v_supp
        then jsonb_build_object('skill_id', s.id, 'min_people', m.mp, 'min_level', m.ml, 'target_set', t.id is not null, 'n', null, 'claimed_n', null, 'status', 'suppressed', 'spof', false)
        else jsonb_build_object('skill_id', s.id, 'min_people', m.mp, 'min_level', m.ml, 'target_set', t.id is not null, 'n', h.n, 'claimed_n', h.c,
               'status', case when h.n >= m.mp then 'covered' when h.n = 0 then 'uncovered' else 'thin' end, 'spof', h.n = 1)
             || case when v_people then jsonb_build_object('holders', h.holders) else '{}'::jsonb end end j
      from unnest(v_cols) with ordinality k(sid, o)
      join kafaa_skills s on s.id = k.sid
      left join kafaa_team_skill_targets t on v_found and t.active and t.team_id = v_key and t.skill_id = s.id
      cross join lateral (select coalesce(t.min_people, 2) mp, coalesce(t.min_level, s.key_level) ml) m
      cross join lateral (select count(*) filter (where ps.basis = any(c_counted))::int n, count(*) filter (where not ps.basis = any(c_counted))::int c,
                                 coalesce(jsonb_agg(ps.person_id order by ps.person_id collate "C") filter (where ps.basis = any(c_counted)), '[]'::jsonb) holders
                            from kafaa_person_skills ps
                           where ps.person_id = any(v_members) and ps.skill_id = s.id and ps.active and ps.level > 0 and ps.basis <> 'none' and ps.level >= m.ml) h) x;
  if v_people then
    v_cells := coalesce((select jsonb_agg(jsonb_build_object('p', ps.person_id, 's', ps.skill_id, 'l', ps.level, 'b', ps.basis) order by ps.person_id collate "C", ps.skill_id collate "C")
                 from kafaa_person_skills ps where ps.person_id = any(v_members) and ps.skill_id = any(v_cols) and ps.active and ps.level > 0 and ps.basis <> 'none'), '[]'::jsonb);
    v_mem := coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name_en', coalesce(p.display_name, p.id), 'name_ar', coalesce(nullif(p.display_name_ar, ''), nullif(p.display_name, ''), p.id),
                 'initials', coalesce(p.initials, ''), 'job_role_id', p.job_role_id, 'crew', p.crew, 'team_id', p.team_id) order by p.id collate "C")
                 from kafaa_people p where p.id = any(v_members)), '[]'::jsonb);
    v_crews := coalesce((select jsonb_agg(jsonb_build_object('crew', cr.crew, 'headcount', cr.hc, 'available', cr.av, 'unknown', cr.unk, 'skills', cr.sk) order by cr.crew collate "C") from (
        select p.crew, count(*)::int hc, count(*) filter (where kafaa_sc_available(p.id) is true)::int av, count(*) filter (where kafaa_sc_available(p.id) is null)::int unk,
               coalesce((select jsonb_agg(jsonb_build_object('skill_id', t.skill_id, 'min_people', t.min_people, 'min_level', t.min_level, 'n', q.n, 'available_n', q.an,
                          'status', case when q.n >= t.min_people then 'covered' when q.n = 0 then 'uncovered' else 'thin' end) order by coalesce(s.sort, 0), t.skill_id collate "C")
                  from kafaa_team_skill_targets t join kafaa_skills s on s.id = t.skill_id
                  cross join lateral (select count(*)::int n, count(*) filter (where kafaa_sc_available(x.id) is true)::int an
                                        from kafaa_people x join kafaa_person_skills ps on ps.person_id = x.id and ps.skill_id = t.skill_id
                                       where x.id = any(v_pool) and x.crew = p.crew and ps.active and ps.level > 0 and ps.level >= t.min_level and ps.basis = any(c_counted)) q
                 where t.team_id = 'crew:profile' and t.active), '[]'::jsonb) sk
          from kafaa_people p where p.id = any(v_pool) and p.crew is not null group by p.crew) cr), '[]'::jsonb);
  end if;
  return jsonb_build_object('mode', case when v_people then 'people' else 'aggregate' end, 'groups', v_groups, 'group', v_key, 'size', v_size, 'suppressed', v_supp,
    'members', v_mem, 'skills', to_jsonb(v_cols), 'cells', v_cells, 'coverage', v_cov, 'targets', v_targets, 'crew_profile', v_profile, 'crews', v_crews);
end $$;

-- ───────────── RPC: set or clear a group's coverage target (F11). A, or Scope over at least one member of the group.
create or replace function kafaa_set_team_target(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_key text := trim(coalesce(p->>'team_id', '')); v_sid text := trim(coalesce(p->>'skill_id', '')); s kafaa_skills; v_dom text;
  v_active boolean := coalesce(p->'active', 'true'::jsonb) <> 'false'::jsonb; v_mp integer; v_ml integer; v_id text; prev kafaa_team_skill_targets; v_note text := nullif(left(trim(coalesce(p->>'note', '')), 300), ''); a kafaa_audit_events;
  v_ent text := case when v_key <> '' and v_sid <> '' then 'tst:' || v_key || ':' || v_sid end;
  c_act constant text := 'skills.target.set'; c_tbl constant text := 'team_skill_targets';
begin
  if me is null then return kafaa_refuse(c_act, c_tbl, v_ent, 'not_signed_in', 'Sign in to use skill check-ins'); end if;
  v_role := coalesce(kafaa_acting_role('skills_profile', array['A']), kafaa_acting_role('skills_profile', array['Scope']));
  if v_role is null then return kafaa_refuse(c_act, c_tbl, v_ent, 'forbidden', 'Only a manager in scope or the training manager can set team targets'); end if;
  if not (v_key ~ '^(team|family):[a-z0-9][a-z0-9-]{0,59}$' or v_key = 'crew:profile') then return kafaa_refuse(c_act, c_tbl, v_ent, 'invalid', 'Unknown team or group', v_role); end if;
  if not exists (select 1 from kafaa_people x where x.kind = 'staff' and x.status = 'active' and (case when v_key = 'crew:profile' then x.crew is not null else (('team:' || x.team_id) = v_key or ('family:' || x.job_family_id) = v_key) end)) then
    return kafaa_refuse(c_act, c_tbl, v_ent, 'not_found', 'Unknown team or group', v_role); end if;
  if not kafaa_has_grant('skills_profile', array['A']) and not exists (select 1 from kafaa_people x where x.kind = 'staff' and x.status = 'active'
       and (case when v_key = 'crew:profile' then x.crew is not null else (('team:' || x.team_id) = v_key or ('family:' || x.job_family_id) = v_key) end) and kafaa_in_scope('skills_profile', x.id)) then
    return kafaa_refuse(c_act, c_tbl, v_ent, 'forbidden', 'Only a manager in scope or the training manager can set team targets', v_role); end if;
  select * into s from kafaa_skills where id = v_sid;
  if s.id is null then return kafaa_refuse(c_act, c_tbl, v_ent, 'not_found', 'Skill not found', v_role); end if;
  select domain into v_dom from kafaa_competencies where id = s.competency_id;
  if s.area = 'security' or coalesce(v_dom, '') = 'security' then return kafaa_refuse(c_act, c_tbl, v_ent, 'security_restricted', 'Security competencies show as qualified or not qualified only: they cannot be checked in', v_role); end if;
  if v_active then
    if not kafaa_sc_is_int(p->'min_people') or not kafaa_sc_is_int(p->'min_level') or (p->>'min_people')::numeric < 1 or (p->>'min_people')::numeric > 10
       or (p->>'min_level')::numeric < 1 or (p->>'min_level')::numeric > 4 then
      return kafaa_refuse(c_act, c_tbl, v_ent, 'invalid', 'Target needs 1 to 10 people at level 1 to 4', v_role); end if;
    v_mp := (p->>'min_people')::numeric::int; v_ml := (p->>'min_level')::numeric::int;
  end if;
  v_id := 'tst:' || v_key || ':' || v_sid;
  select * into prev from kafaa_team_skill_targets where id = v_id;
  if not v_active then v_mp := coalesce(prev.min_people, 2); v_ml := coalesce(prev.min_level, s.key_level); end if;
  insert into kafaa_team_skill_targets (id, team_id, skill_id, min_people, min_level, note, active, set_by, updated_at)
  values (v_id, v_key, v_sid, v_mp, v_ml, v_note, v_active, me, now())
  on conflict (id) do update set min_people = excluded.min_people, min_level = excluded.min_level, note = excluded.note, active = excluded.active, set_by = excluded.set_by, updated_at = excluded.updated_at;
  a := kafaa_audit(c_act, c_tbl, v_id, 'ok', case when v_active then v_mp || ' at level ' || v_ml else 'cleared' end, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when v_active then 'Target saved' else 'Target cleared' end, a, null, jsonb_build_object('id', v_id));
end $$;

-- ───────────── Grants
revoke execute on function kafaa_sc_covers(text, text, kafaa_people), kafaa_sc_line_manager(text), kafaa_sc_peer_pool(text), kafaa_sc_block(text, text), kafaa_sc_card(text),
  kafaa_sc_notify(text, text, text, text, text, text), kafaa_sc_available(text), kafaa_sc_pool(boolean), kafaa_sc_groups(text[]), kafaa_sc_default_group(jsonb, text, boolean),
  kafaa_sc_members(text[], text), kafaa_sc_is_int(jsonb) from public, anon, authenticated;
revoke execute on function kafaa_request_checkin(jsonb), kafaa_submit_rating(jsonb), kafaa_validate_checkin(jsonb), kafaa_withdraw_checkin(text, text), kafaa_checkin_peers(),
  kafaa_checkin_inbox(), kafaa_checkin_calibration(text), kafaa_team_coverage(text), kafaa_set_team_target(jsonb) from public, anon;
grant execute on function kafaa_request_checkin(jsonb), kafaa_submit_rating(jsonb), kafaa_validate_checkin(jsonb), kafaa_withdraw_checkin(text, text), kafaa_checkin_peers(),
  kafaa_checkin_inbox(), kafaa_checkin_calibration(text), kafaa_team_coverage(text), kafaa_set_team_target(jsonb) to authenticated;
