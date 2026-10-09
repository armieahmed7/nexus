-- [W2 · E2] F12 Career conversations and aspirations (module M18).
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file, RLS in the per-statement form,
-- the SQL mirror of src/modules/m18/conversations.ts (preparation and action checks, agenda builder, cadence, HR aggregates;
-- scripts/validate/w2e2-conversations.mjs proves SQL = TS on the seed) and nine RPCs. LocalBackend mirror: src/modules/m18/backend/local.ts.
-- Shared writes, all inside these SECURITY DEFINER functions: M04 dev_plans / plan_activities (agreed actions become draft plan
-- activities), M19 learning_goals (coach focus role and weekly hours, on the employee's acknowledgement), M14 notifications.
-- Line manager of record = F08's rule (kafaa_opp_line_manager, 20261009114001).

-- ───────────── Table (generated DDL)
-- M18 · Career conversation: employee preparation, pre-filled agenda, manager notes and agreed actions, acknowledgement (F12)
create table if not exists kafaa_career_conversations (
  id text primary key,
  person_id text not null,
  manager_person_id text,
  manager_read_id text,
  cycle text not null default '',
  status text not null default 'draft' check (status in ('draft', 'held', 'acknowledged')),
  person_name text not null default '',
  person_name_ar text not null default '',
  manager_name text not null default '',
  manager_name_ar text not null default '',
  prep jsonb not null default '{}'::jsonb,
  prep_submitted_at timestamptz,
  agenda jsonb not null default '{}'::jsonb,
  held_on date,
  notes text,
  actions jsonb not null default '[]'::jsonb,
  focus_role_id text,
  coach_hours numeric,
  plan_id text,
  recorded_at timestamptz,
  employee_agrees boolean,
  employee_comment text,
  acknowledged_at timestamptz,
  share_with_talent_review boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table kafaa_career_conversations is '[M18] Career conversation: employee preparation, pre-filled agenda, manager notes and agreed actions, acknowledgement (F12)';
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_career_conversations_person_id_fk') then alter table kafaa_career_conversations add constraint kafaa_career_conversations_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_career_conversations_manager_person_id_fk') then alter table kafaa_career_conversations add constraint kafaa_career_conversations_manager_person_id_fk foreign key (manager_person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_career_conversations_focus_role_id_fk') then alter table kafaa_career_conversations add constraint kafaa_career_conversations_focus_role_id_fk foreign key (focus_role_id) references kafaa_job_roles(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_career_conversations_person_id_idx on kafaa_career_conversations (person_id);
create index if not exists kafaa_career_conversations_manager_person_id_idx on kafaa_career_conversations (manager_person_id);
create index if not exists kafaa_career_conversations_manager_read_id_idx on kafaa_career_conversations (manager_read_id);
create index if not exists kafaa_career_conversations_status_idx on kafaa_career_conversations (status);
create index if not exists kafaa_career_conversations_focus_role_id_idx on kafaa_career_conversations (focus_role_id);

-- ───────────── RLS: the person (own_profile Own) and the line manager of record once the preparation is shared or the conversation
-- recorded (manager_read_id, set only by the RPCs below). Nobody holds R, Scope or Agg on own_profile, so HR, auditors and skip-level
-- managers read no row. Writes only through the RPCs.
alter table kafaa_career_conversations enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_career_conversations' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_career_conversations for select to anon, authenticated using (false)'; end if;
end $$;
alter policy kafaa_read on kafaa_career_conversations using (
  (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false)))
  OR (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((manager_read_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, manager_read_id, NULL::text, false))));
grant select on kafaa_career_conversations to anon, authenticated;
revoke insert, update on kafaa_career_conversations from anon, authenticated;

-- ───────────── Small helpers (internal)
create or replace function kafaa_cc_trim(p text) returns text language sql immutable set search_path = public as $$
  select regexp_replace(coalesce(p, ''), '^\s+|\s+$', '', 'g')
$$;
create or replace function kafaa_cc_is_date(p text) returns boolean language plpgsql immutable set search_path = public as $$
begin
  if p is null or p !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
  return to_char(p::date, 'YYYY-MM-DD') = p;
exception when others then return false;
end $$;
create or replace function kafaa_cc_cycle(p date) returns text language sql immutable set search_path = public as $$
  select to_char(p, 'YYYY') || '-H' || case when extract(month from p) <= 6 then '1' else '2' end
$$;
-- Cadence: due six months after the last conversation held (else after the hire date); overdue after that, due soon within 30 days.
create or replace function kafaa_cc_due_on(p_last date, p_hire date) returns date language sql immutable set search_path = public as $$
  select (coalesce(p_last, p_hire) + interval '6 months')::date
$$;
create or replace function kafaa_cc_state(p_last date, p_hire date, p_today date) returns text language sql immutable set search_path = public as $$
  select case when coalesce(p_last, p_hire) is null then 'overdue'
              when kafaa_cc_due_on(p_last, p_hire) < p_today then 'overdue'
              when kafaa_cc_due_on(p_last, p_hire) - p_today <= 30 then 'due_soon' else 'ok' end
$$;
-- Boolean field with a default: 'true' / 'false', or 'bad' when present but not a boolean.
create or replace function kafaa_cc_flag(p jsonb, p_default boolean) returns text language sql immutable set search_path = public as $$
  select case when p is null or p = 'null'::jsonb then p_default::text when jsonb_typeof(p) = 'boolean' then (p #>> '{}') else 'bad' end
$$;
-- Optional text field: trimmed text ('' when absent), or null when present but not a string.
create or replace function kafaa_cc_text(p jsonb) returns text language sql immutable set search_path = public as $$
  select case when p is null or p = 'null'::jsonb then '' when jsonb_typeof(p) = 'string' then kafaa_cc_trim(p #>> '{}') end
$$;
create or replace function kafaa_cc_notify(p_id text, p_person text, p_en text, p_ar text, p_link text, p_sev text, p_body_en text default null, p_body_ar text default null)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_person is null or not exists (select 1 from kafaa_people where id = p_person) then return false; end if;
  insert into kafaa_notifications (id, person_id, kind, title_en, title_ar, body_en, body_ar, link, severity)
  values (p_id, p_person, 'career_conversation', p_en, p_ar, p_body_en, p_body_ar, p_link, p_sev) on conflict (id) do nothing;
  return found;
end $$;

-- ───────────── Preparation (mirror of normPrep): normalised object, or null when invalid. p_submit needs an aspiration and a 12-month goal.
create or replace function kafaa_cc_prep_norm(p jsonb, p_submit boolean) returns jsonb language plpgsql immutable set search_path = public as $$
declare
  v_asp jsonb; v_sup jsonb; v jsonb; v_mob text; v_lead text; v_inc jsonb; v_g12 text; v_g3 text; v_note text; v_top text; f text[];
  asps constant text[] := array['stay_deepen', 'grow_vertical', 'move_lateral', 'lead', 'specialise'];
  sups constant text[] := array['course', 'mentoring', 'rotation', 'stretch', 'coaching', 'time', 'other'];
begin
  if p is null or jsonb_typeof(p) <> 'object' then return null; end if;
  v_asp := coalesce(nullif(p -> 'aspirations', 'null'::jsonb), '[]'::jsonb);
  if jsonb_typeof(v_asp) <> 'array' or exists (select 1 from jsonb_array_elements(v_asp) e where jsonb_typeof(e) <> 'string' or not ((e #>> '{}') = any(asps))) then return null; end if;
  select coalesce(jsonb_agg(to_jsonb(z.x) order by z.o), '[]'::jsonb) into v_asp
  from (select e #>> '{}' as x, min(o) as o from jsonb_array_elements(v_asp) with ordinality q(e, o) group by 1) z;
  if jsonb_array_length(v_asp) > 3 then return null; end if;
  v_sup := coalesce(nullif(p -> 'support', 'null'::jsonb), '[]'::jsonb);
  if jsonb_typeof(v_sup) <> 'array' or exists (select 1 from jsonb_array_elements(v_sup) e where jsonb_typeof(e) <> 'string' or not ((e #>> '{}') = any(sups))) then return null; end if;
  select coalesce(jsonb_agg(to_jsonb(u.s) order by u.o), '[]'::jsonb) into v_sup from unnest(sups) with ordinality u(s, o) where v_sup ? u.s;
  v := coalesce(nullif(p -> 'mobility', 'null'::jsonb), to_jsonb('current_site'::text));
  if jsonb_typeof(v) <> 'string' or not ((v #>> '{}') = any(array['current_site', 'other_sites', 'any'])) then return null; end if;
  v_mob := v #>> '{}';
  v := coalesce(nullif(p -> 'leadership', 'null'::jsonb), to_jsonb('not_now'::text));
  if jsonb_typeof(v) <> 'string' or not ((v #>> '{}') = any(array['not_now', 'curious', 'ready'])) then return null; end if;
  v_lead := v #>> '{}';
  v_g12 := kafaa_cc_text(p -> 'goal_12m'); v_g3 := kafaa_cc_text(p -> 'goal_3y'); v_note := kafaa_cc_text(p -> 'support_note'); v_top := kafaa_cc_text(p -> 'topics');
  if v_g12 is null or v_g3 is null or v_note is null or v_top is null or length(v_g12) > 500 or length(v_g3) > 500 or length(v_note) > 500 or length(v_top) > 500 then return null; end if;
  v_inc := coalesce(nullif(p -> 'include', 'null'::jsonb), '{}'::jsonb);
  if jsonb_typeof(v_inc) <> 'object' then return null; end if;
  f := array[kafaa_cc_flag(p -> 'shift_ok', false), kafaa_cc_flag(p -> 'rotation_ok', false), kafaa_cc_flag(v_inc -> 'targets', true), kafaa_cc_flag(v_inc -> 'roadmap', true),
             kafaa_cc_flag(v_inc -> 'coach', true), kafaa_cc_flag(p -> 'share_with_talent_review', false)];
  if 'bad' = any(f) then return null; end if;
  if p_submit and (jsonb_array_length(v_asp) = 0 or length(v_g12) < 3) then return null; end if;
  return jsonb_build_object('aspirations', v_asp, 'mobility', v_mob, 'shift_ok', f[1]::boolean, 'rotation_ok', f[2]::boolean, 'leadership', v_lead,
    'goal_12m', v_g12, 'goal_3y', v_g3, 'support', v_sup, 'support_note', v_note, 'topics', v_top,
    'include', jsonb_build_object('targets', f[3]::boolean, 'roadmap', f[4]::boolean, 'coach', f[5]::boolean), 'share_with_talent_review', f[6]::boolean);
end $$;

-- ───────────── Agreed actions (mirror of normActions): ids a1..aN when missing; null when invalid.
create or replace function kafaa_cc_actions_norm(p jsonb) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb; x jsonb; i bigint; v_id jsonb; v_seen text[] := '{}'; v_kind text; v_en text; v_ar text; d jsonb; v_due text; c jsonb; v_course text; o jsonb; v_out jsonb := '[]'::jsonb;
begin
  v := coalesce(nullif(p, 'null'::jsonb), '[]'::jsonb);
  if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) > 8 then return null; end if;
  for x, i in select e, n from jsonb_array_elements(v) with ordinality q(e, n) loop
    if jsonb_typeof(x) <> 'object' then return null; end if;
    v_id := coalesce(nullif(x -> 'id', 'null'::jsonb), to_jsonb('a' || i));
    if jsonb_typeof(v_id) <> 'string' or (v_id #>> '{}') !~ '^[a-z0-9-]{1,40}$' or (v_id #>> '{}') = any(v_seen) then return null; end if;
    v_seen := v_seen || (v_id #>> '{}');
    v_kind := coalesce(x ->> 'kind', '');
    if not (v_kind = any(array['course', 'ojt', 'mentoring', 'project', 'assessment', 'reading'])) then return null; end if;
    v_en := kafaa_cc_text(x -> 'title' -> 'en'); v_ar := kafaa_cc_text(x -> 'title' -> 'ar');
    if jsonb_typeof(x -> 'title') <> 'object' then v_en := ''; v_ar := ''; end if;
    if v_en is null or v_ar is null or (v_en = '' and v_ar = '') or length(v_en) > 200 or length(v_ar) > 200 then return null; end if;
    d := x -> 'due_on';
    if d is null or d = 'null'::jsonb or d = '""'::jsonb then v_due := null;
    elsif jsonb_typeof(d) = 'string' and kafaa_cc_is_date(d #>> '{}') then v_due := d #>> '{}';
    else return null; end if;
    c := x -> 'course_id';
    if c is null or c = 'null'::jsonb or c = '""'::jsonb then v_course := null;
    elsif jsonb_typeof(c) = 'string' and exists (select 1 from kafaa_courses co where co.id = c #>> '{}') then v_course := c #>> '{}';
    else return null; end if;
    o := coalesce(nullif(x -> 'owner', 'null'::jsonb), to_jsonb('employee'::text));
    if not ((o #>> '{}') = any(array['employee', 'manager'])) then return null; end if;
    v_out := v_out || jsonb_build_array(jsonb_build_object('id', v_id #>> '{}', 'kind', v_kind, 'title', jsonb_build_object('en', coalesce(nullif(v_en, ''), v_ar), 'ar', coalesce(nullif(v_ar, ''), v_en)),
      'due_on', v_due, 'course_id', v_course, 'owner', o #>> '{}'));
  end loop;
  return v_out;
end $$;

-- ───────────── Pre-filled agenda (mirror of buildAgenda). p_shared_only: the line manager's view (shared shortlist and roadmap only).
create or replace function kafaa_cc_agenda(p_person text, p_targets boolean, p_roadmap boolean, p_coach boolean, p_shared_only boolean, p_today date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_role text; v_pass jsonb; v_ids text[]; v_rd jsonb; v_tg jsonb := '[]'::jsonb; v_rm jsonb; v_q jsonb; v_c jsonb; v_last jsonb;
begin
  select p.job_role_id into v_role from kafaa_people p where p.id = p_person;
  select coalesce(jsonb_agg(jsonb_build_object('skill_id', z.skill_id, 'level', z.level, 'basis', z.basis) order by z.level desc, z.confidence desc, z.skill_id collate "C"), '[]'::jsonb) into v_pass
  from (select ps.skill_id, ps.level, ps.confidence, ps.basis from kafaa_person_skills ps join kafaa_skills s on s.id = ps.skill_id left join kafaa_competencies cm on cm.id = s.competency_id
        where ps.person_id = p_person and ps.active and ps.level >= 1 and s.area <> 'security' and coalesce(cm.domain, '') <> 'security'
        order by ps.level desc, ps.confidence desc, ps.skill_id collate "C" limit 5) z;
  if p_targets then
    select array_agg(t.role_id order by t.rank, t.id collate "C") into v_ids from kafaa_career_targets t where t.person_id = p_person and t.active and (not p_shared_only or t.shared);
    if v_ids is not null then
      v_rd := kafaa_career_readiness_compute(p_person, v_ids, p_today);
      select coalesce(jsonb_agg(jsonb_build_object('role_id', t.role_id, 'rank', t.rank, 'pct', y.x -> 'pct', 'band', y.x -> 'band', 'gate_status', y.x -> 'gate_status', 'months', y.x -> 'months',
          'gaps', coalesce((select jsonb_agg(g order by o) from jsonb_array_elements(y.x -> 'gaps') with ordinality q(g, o) where o <= 3), '[]'::jsonb),
          'reasons', coalesce((select jsonb_agg(r order by o) from jsonb_array_elements(y.x -> 'reasons') with ordinality q(r, o) where o <= 4), '[]'::jsonb))
        order by t.rank, t.id collate "C"), '[]'::jsonb) into v_tg
      from kafaa_career_targets t cross join lateral (select e as x from jsonb_array_elements(v_rd) e where e ->> 'role_id' = t.role_id limit 1) y
      where t.person_id = p_person and t.active and (not p_shared_only or t.shared);
    end if;
  end if;
  if p_roadmap then
    select jsonb_build_object('id', m.id, 'name', m.name, 'target_role_id', m.target_role_id, 'earliest_on', m.earliest_on, 'end_on', m.end_on,
      'dev_blocks', (select count(*) from jsonb_array_elements(case when jsonb_typeof(m.plan) = 'array' then m.plan else '[]'::jsonb end) b where b ->> 'lane' = 'development'))
      into v_rm from kafaa_roadmaps m where m.person_id = p_person and m.active and (not p_shared_only or m.shared) order by m.updated_at desc, m.id collate "C" limit 1;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('record_id', z.id, 'standard_id', z.standard_id, 'expires_on', z.expires_on, 'days', z.expires_on - p_today) order by z.expires_on, z.id collate "C"), '[]'::jsonb) into v_q
  from (select q.id, q.standard_id, q.expires_on from kafaa_qual_records q join kafaa_qual_standards s on s.id = q.standard_id
        where q.person_id = p_person and q.status in ('qualified', 'due', 'renewed') and q.expires_on is not null
          and not coalesce(s.security_restricted, false) and not coalesce(q.security_mirror_only, false)
          and q.expires_on - p_today between -90 and 365
        order by q.expires_on, q.id collate "C" limit 5) z;
  if p_coach then
    select jsonb_build_object('hours_per_week', coalesce(g.hours_per_week, 0), 'focus_role_ids', to_jsonb(coalesce(g.focus_role_ids, '{}'::text[])),
      'enrolled', (select count(*) from kafaa_coach_feedback f where f.person_id = p_person and f.signal = 'enrolled' and f.at::date >= p_today - 180),
      'passed', (select count(*) from kafaa_training_records r where r.person_id = p_person and r.result in ('passed', 'completed') and r.completed_on between p_today - 180 and p_today))
      into v_c from (select 1) one left join kafaa_learning_goals g on g.person_id = p_person;
  end if;
  select jsonb_build_object('id', c.id, 'held_on', c.held_on, 'status', c.status) into v_last from kafaa_career_conversations c
  where c.person_id = p_person and c.status in ('held', 'acknowledged') and c.held_on is not null order by c.held_on desc, c.id collate "C" limit 1;
  return jsonb_build_object('built_on', p_today, 'role_id', v_role, 'shared_only', p_shared_only,
    'included', jsonb_build_object('targets', p_targets, 'roadmap', p_roadmap, 'coach', p_coach),
    'passport', v_pass, 'targets', v_tg, 'roadmap', v_rm, 'quals', v_q, 'coach', v_c, 'last', v_last);
end $$;

-- ───────────── HR aggregates (mirror of conversationInsightsOf). Group below 10: everything suppressed; aspiration and mobility
-- counts below 10 suppressed cell by cell.
create or replace function kafaa_cc_cell(p_key text, p_n integer, p_held integer, p_over integer, p_ack integer, p_dis integer, p_asp integer[], p_mob integer[]) returns jsonb
language sql immutable set search_path = public as $$
  select case when p_n < 10 then jsonb_build_object('key', p_key, 'people', null, 'held_6m', null, 'coverage_pct', null, 'overdue', null, 'acknowledged', null, 'disagreed', null,
      'aspirations', jsonb_build_object('stay_deepen', null, 'grow_vertical', null, 'move_lateral', null, 'lead', null, 'specialise', null),
      'mobility', jsonb_build_object('current_site', null, 'other_sites', null, 'any', null), 'suppressed', true)
  else jsonb_build_object('key', p_key, 'people', p_n, 'held_6m', p_held, 'coverage_pct', (round(1000.0 * p_held / p_n) / 10)::float8, 'overdue', p_over, 'acknowledged', p_ack, 'disagreed', p_dis,
      'aspirations', jsonb_build_object('stay_deepen', case when p_asp[1] >= 10 then p_asp[1] end, 'grow_vertical', case when p_asp[2] >= 10 then p_asp[2] end,
        'move_lateral', case when p_asp[3] >= 10 then p_asp[3] end, 'lead', case when p_asp[4] >= 10 then p_asp[4] end, 'specialise', case when p_asp[5] >= 10 then p_asp[5] end),
      'mobility', jsonb_build_object('current_site', case when p_mob[1] >= 10 then p_mob[1] end, 'other_sites', case when p_mob[2] >= 10 then p_mob[2] end, 'any', case when p_mob[3] >= 10 then p_mob[3] end),
      'suppressed', false) end
$$;
create or replace function kafaa_cc_insights_compute(p_today date) returns jsonb language sql stable security definer set search_path = public as $$
  with pairs as (
    select p.id, coalesce(p.job_family_id, 'unassigned') as fam, p.hire_date from kafaa_people p
    where p.kind = 'staff' and p.status = 'active' and kafaa_opp_line_manager(p.id) is not null
  ), lastc as (
    select distinct on (c.person_id) c.person_id, c.held_on, c.status, c.employee_agrees, c.prep
    from kafaa_career_conversations c where c.status in ('held', 'acknowledged') and c.held_on is not null
    order by c.person_id, c.held_on desc, c.id collate "C"
  ), m as (
    select pr.fam, l.status, l.employee_agrees as agrees,
      case when jsonb_typeof(l.prep -> 'aspirations') = 'array' and jsonb_typeof(l.prep -> 'aspirations' -> 0) = 'string' then l.prep -> 'aspirations' ->> 0 end as asp,
      case when jsonb_typeof(l.prep -> 'mobility') = 'string' then l.prep ->> 'mobility' end as mob,
      kafaa_cc_state(l.held_on, pr.hire_date, p_today) as state,
      (l.held_on is not null and kafaa_cc_due_on(l.held_on, null) >= p_today) as recent
    from pairs pr left join lastc l on l.person_id = pr.id
  ), g as (
    select 'all'::text as k, 0 as ord, m.* from m union all select m.fam, 1, m.* from m
  ), cells as (
    select k, ord, kafaa_cc_cell(k, count(*)::int, (count(*) filter (where recent))::int, (count(*) filter (where state = 'overdue'))::int,
      (count(*) filter (where status = 'acknowledged'))::int, (count(*) filter (where status = 'acknowledged' and agrees = false))::int,
      array[(count(*) filter (where asp = 'stay_deepen'))::int, (count(*) filter (where asp = 'grow_vertical'))::int, (count(*) filter (where asp = 'move_lateral'))::int,
            (count(*) filter (where asp = 'lead'))::int, (count(*) filter (where asp = 'specialise'))::int],
      array[(count(*) filter (where mob = 'current_site'))::int, (count(*) filter (where mob = 'other_sites'))::int, (count(*) filter (where mob = 'any'))::int]) as c
    from g group by k, ord
  )
  select jsonb_build_object('min_group', 10, 'as_of', p_today,
    'total', coalesce((select c from cells where ord = 0), kafaa_cc_cell('all', 0, 0, 0, 0, 0, array[0, 0, 0, 0, 0], array[0, 0, 0])),
    'by_family', coalesce((select jsonb_agg(c order by k collate "C") from cells where ord = 1), '[]'::jsonb))
$$;

-- ───────────── RPC: the pre-filled agenda. Self: everything. The line manager of record: passport, expiring qualifications, last
-- conversation, and only the shortlist and roadmap the person shares (never coach data). Read-only.
create or replace function kafaa_conversation_agenda(p_person text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me();
begin
  if me is null then return kafaa_refuse('conversation.agenda', 'career_conversations', p_person, 'not_signed_in', 'Sign in to prepare your career conversation'); end if;
  if p_person is null or not exists (select 1 from kafaa_people where id = p_person) then return kafaa_refuse('conversation.agenda', 'career_conversations', p_person, 'not_found', 'Person not found'); end if;
  if p_person = me then
    if not kafaa_has_grant('skills_profile', array['Own']) then return kafaa_refuse('conversation.agenda', 'career_conversations', p_person, 'forbidden', 'Career conversations are for staff'); end if;
    return kafaa_result(true, 'ok', '', null::kafaa_audit_events, null, kafaa_cc_agenda(p_person, true, true, true, false, current_date));
  end if;
  if not kafaa_has_grant('skills_profile', array['Scope']) or kafaa_opp_line_manager(p_person) is distinct from me then
    return kafaa_refuse('conversation.agenda', 'career_conversations', p_person, 'forbidden', 'Only the line manager of record sees this agenda');
  end if;
  return kafaa_result(true, 'ok', '', null::kafaa_audit_events, null, kafaa_cc_agenda(p_person, true, true, false, true, current_date));
end $$;

-- ───────────── RPC: save (p_submit false) or share (true) my preparation. One open draft per person; the agenda snapshot follows my
-- include choices. Shared drafts become visible to the line manager of record (manager_read_id), who gets a notification. Audited.
create or replace function kafaa_submit_prep(p_prep jsonb, p_submit boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; pp kafaa_people; v_prep jsonb; v_lm text; m kafaa_people; c kafaa_career_conversations; v_id text; v_agenda jsonb;
  v_was boolean; v_shared boolean; a kafaa_audit_events; v_prev text := current_setting('kafaa.seeding', true);
begin
  if me is null then return kafaa_refuse('conversation.prep', 'career_conversations', null, 'not_signed_in', 'Sign in to prepare your career conversation'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  select * into pp from kafaa_people where id = me;
  if v_role is null or pp.id is null or pp.kind <> 'staff' then return kafaa_refuse('conversation.prep', 'career_conversations', me, 'forbidden', 'Career conversations are for staff', v_role); end if;
  v_prep := case when p_submit is null then null else kafaa_cc_prep_norm(p_prep, p_submit) end;
  if v_prep is null then return kafaa_refuse('conversation.prep', 'career_conversations', me, 'invalid', 'Check the preparation form: an aspiration and a 12-month goal are needed to share it', v_role); end if;
  v_lm := kafaa_opp_line_manager(me);
  if p_submit and v_lm is null then return kafaa_refuse('conversation.prep', 'career_conversations', me, 'no_line_manager', 'No line manager is recorded for you; ask HR to update your record', v_role); end if;
  select * into c from kafaa_career_conversations where person_id = me and status = 'draft' order by created_at desc, id collate "C" limit 1;
  v_agenda := kafaa_cc_agenda(me, (v_prep -> 'include' ->> 'targets')::boolean, (v_prep -> 'include' ->> 'roadmap')::boolean, (v_prep -> 'include' ->> 'coach')::boolean, false, current_date);
  v_was := c.id is not null and c.prep_submitted_at is not null;
  v_shared := p_submit or v_was;
  select * into m from kafaa_people where id = v_lm;
  perform set_config('kafaa.seeding', 'on', true);
  if c.id is not null then
    v_id := c.id;
    update kafaa_career_conversations set prep = v_prep - 'share_with_talent_review', agenda = v_agenda, share_with_talent_review = (v_prep ->> 'share_with_talent_review')::boolean,
      manager_person_id = v_lm, manager_read_id = case when v_shared then v_lm end, manager_name = coalesce(m.display_name, ''), manager_name_ar = coalesce(nullif(m.display_name_ar, ''), m.display_name, ''),
      prep_submitted_at = case when v_shared then coalesce(c.prep_submitted_at, now()) end, cycle = kafaa_cc_cycle(current_date), updated_at = now()
    where id = v_id;
  else
    v_id := 'cc-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
    insert into kafaa_career_conversations (id, person_id, status, person_name, person_name_ar, prep, agenda, share_with_talent_review, manager_person_id, manager_read_id,
      manager_name, manager_name_ar, prep_submitted_at, cycle, actions, created_at, updated_at)
    values (v_id, me, 'draft', pp.display_name, coalesce(nullif(pp.display_name_ar, ''), pp.display_name), v_prep - 'share_with_talent_review', v_agenda, (v_prep ->> 'share_with_talent_review')::boolean,
      v_lm, case when v_shared then v_lm end, coalesce(m.display_name, ''), coalesce(nullif(m.display_name_ar, ''), m.display_name, ''), case when v_shared then now() end,
      kafaa_cc_cycle(current_date), '[]'::jsonb, now(), now());
  end if;
  if p_submit and not v_was and v_lm is not null then
    perform kafaa_cc_notify('nt-cc-' || v_id || '-prep', v_lm, pp.display_name || ' shared their career conversation preparation',
      'شارك ' || coalesce(nullif(pp.display_name_ar, ''), pp.display_name) || ' تحضيره للحوار المهني', '/team/conversations?person=' || me, 'info');
  end if;
  perform set_config('kafaa.seeding', coalesce(v_prev, ''), true);
  a := kafaa_audit('conversation.prep', 'career_conversations', v_id, 'ok', case when v_shared then 'shared with ' || coalesce(v_lm, 'none') else 'draft saved' end, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when p_submit then 'Shared with your line manager' else 'Draft saved' end, a, null,
    jsonb_build_object('id', v_id, 'status', 'draft', 'submitted', v_shared, 'manager_person_id', v_lm));
end $$;

-- ───────────── RPC: the line manager of record records the conversation (notes, agreed actions, focus role, weekly learning hours).
-- Agreed actions become draft activities in a draft development plan for the focus role (else the current role). Ledgered.
create or replace function kafaa_record_conversation(p_input jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; i jsonb := case when jsonb_typeof(p_input) = 'object' then p_input else '{}'::jsonb end; v_entity text;
  c kafaa_career_conversations; pp kafaa_people; mg kafaa_people; fr kafaa_job_roles; ex kafaa_plan_activities; v_person text; v_held date; v_notes text; v_actions jsonb;
  v_focus text; v_hours numeric; v_target text; v_id text; v_plan text; v_created integer := 0; v_updated integer := 0; x jsonb; v_aid text; f jsonb; n integer;
  a kafaa_audit_events; l integer; v_prev text := current_setting('kafaa.seeding', true);
begin
  v_entity := coalesce(nullif(case when jsonb_typeof(i -> 'conversation_id') = 'string' then i ->> 'conversation_id' end, ''), nullif(case when jsonb_typeof(i -> 'person_id') = 'string' then i ->> 'person_id' end, ''));
  if me is null then return kafaa_refuse('conversation.record', 'career_conversations', v_entity, 'not_signed_in', 'Sign in to record a career conversation'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Scope']);
  if v_role is null then return kafaa_refuse('conversation.record', 'career_conversations', v_entity, 'forbidden', 'Only line managers record career conversations'); end if;
  if jsonb_typeof(i -> 'conversation_id') = 'string' and i ->> 'conversation_id' <> '' then
    select * into c from kafaa_career_conversations where id = i ->> 'conversation_id';
    if c.id is null or c.manager_read_id is distinct from me then return kafaa_refuse('conversation.record', 'career_conversations', v_entity, 'not_found', 'Conversation not found', v_role); end if;
    if c.person_id = me then return kafaa_refuse('conversation.record', 'career_conversations', v_entity, 'self_record', 'You cannot record your own career conversation', v_role); end if;
    if c.status = 'acknowledged' then return kafaa_refuse('conversation.record', 'career_conversations', v_entity, 'locked', 'This conversation is already acknowledged; start a new one next cycle', v_role); end if;
    v_person := c.person_id;
  else
    if jsonb_typeof(i -> 'person_id') is distinct from 'string' or i ->> 'person_id' = '' then return kafaa_refuse('conversation.record', 'career_conversations', v_entity, 'invalid', 'Choose the person', v_role); end if;
    v_person := i ->> 'person_id';
    if v_person = me then return kafaa_refuse('conversation.record', 'career_conversations', v_entity, 'self_record', 'You cannot record your own career conversation', v_role); end if;
    select * into pp from kafaa_people where id = v_person;
    if pp.id is null or pp.kind <> 'staff' or pp.status <> 'active' then return kafaa_refuse('conversation.record', 'career_conversations', v_entity, 'not_found', 'Person not found', v_role); end if;
    if kafaa_opp_line_manager(v_person) is distinct from me then return kafaa_refuse('conversation.record', 'career_conversations', v_entity, 'not_manager', 'Only the line manager of record can record this conversation', v_role); end if;
    select * into c from kafaa_career_conversations where person_id = v_person and manager_read_id = me and status in ('draft', 'held') order by created_at desc, id collate "C" limit 1;
  end if;
  if jsonb_typeof(i -> 'held_on') = 'string' and kafaa_cc_is_date(i ->> 'held_on') then v_held := (i ->> 'held_on')::date; end if;
  if v_held is null or v_held > current_date or v_held < current_date - 365 then return kafaa_refuse('conversation.record', 'career_conversations', v_entity, 'invalid', 'Enter the date the conversation was held (within the last year)', v_role); end if;
  v_notes := kafaa_cc_text(i -> 'notes');
  if v_notes is null or length(v_notes) > 4000 then return kafaa_refuse('conversation.record', 'career_conversations', v_entity, 'invalid', 'The notes are too long', v_role); end if;
  v_actions := kafaa_cc_actions_norm(i -> 'actions');
  if v_actions is null then return kafaa_refuse('conversation.record', 'career_conversations', v_entity, 'invalid', 'Check the agreed actions', v_role); end if;
  f := i -> 'focus_role_id';
  if f is null or f = 'null'::jsonb or f = '""'::jsonb then v_focus := null;
  else
    if jsonb_typeof(f) = 'string' then select * into fr from kafaa_job_roles where id = f #>> '{}'; end if;
    if fr.id is null or coalesce(fr.security_sensitive, false) then return kafaa_refuse('conversation.record', 'career_conversations', v_entity, 'invalid', 'Choose a focus role from the career map (security roles show the career path only)', v_role); end if;
    v_focus := fr.id;
  end if;
  f := i -> 'coach_hours';
  if f is null or f = 'null'::jsonb then v_hours := null;
  elsif jsonb_typeof(f) <> 'number' or (f #>> '{}')::numeric < 0 or (f #>> '{}')::numeric > 40 then return kafaa_refuse('conversation.record', 'career_conversations', v_entity, 'invalid', 'Weekly learning hours must be between 0 and 40', v_role);
  else v_hours := (f #>> '{}')::numeric; end if;
  select * into pp from kafaa_people where id = v_person;
  v_target := coalesce(v_focus, pp.job_role_id);
  n := jsonb_array_length(v_actions);
  if n > 0 and v_target is null then return kafaa_refuse('conversation.record', 'career_conversations', v_entity, 'invalid', 'Choose a focus role so the actions can go into a development plan', v_role); end if;

  v_id := coalesce(c.id, 'cc-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));
  v_plan := c.plan_id;
  perform set_config('kafaa.seeding', 'on', true);
  if n > 0 then
    select coalesce(
      (select d.id from kafaa_dev_plans d where d.id = c.plan_id and d.person_id = v_person and d.target_role_id = v_target and d.status = 'draft'),
      (select d.id from kafaa_dev_plans d where d.id = 'dp-cc-' || v_id and d.person_id = v_person and d.target_role_id = v_target and d.status = 'draft'),
      (select d.id from kafaa_dev_plans d where d.person_id = v_person and d.target_role_id = v_target and d.status = 'draft' order by d.id collate "C" limit 1)) into v_plan;
    if v_plan is null then
      v_plan := 'dp-cc-' || v_id;
      insert into kafaa_dev_plans (id, person_id, target_role_id, status, created_at, note) values (v_plan, v_person, v_target, 'draft', now(), 'Created from a career conversation');
    end if;
    for x in select e from jsonb_array_elements(v_actions) e loop
      v_aid := 'pa-cc-' || v_id || '-' || (x ->> 'id');
      select * into ex from kafaa_plan_activities where id = v_aid;
      if ex.id is not null then
        if ex.status = 'planned' and ex.plan_id = v_plan then
          update kafaa_plan_activities set kind = x ->> 'kind', title_en = x -> 'title' ->> 'en', title_ar = x -> 'title' ->> 'ar', due_on = (x ->> 'due_on')::date, course_id = x ->> 'course_id' where id = v_aid;
          v_updated := v_updated + 1;
        end if;
        continue;
      end if;
      insert into kafaa_plan_activities (id, plan_id, person_id, kind, title_en, title_ar, due_on, status, course_id)
      values (v_aid, v_plan, v_person, x ->> 'kind', x -> 'title' ->> 'en', x -> 'title' ->> 'ar', (x ->> 'due_on')::date, 'planned', x ->> 'course_id');
      v_created := v_created + 1;
    end loop;
  end if;
  select * into mg from kafaa_people where id = me;
  if c.id is not null then
    update kafaa_career_conversations set status = 'held', held_on = v_held, notes = v_notes, actions = v_actions, focus_role_id = v_focus, coach_hours = v_hours, plan_id = v_plan,
      manager_person_id = me, manager_read_id = me, manager_name = coalesce(mg.display_name, ''), manager_name_ar = coalesce(nullif(mg.display_name_ar, ''), mg.display_name, ''),
      cycle = kafaa_cc_cycle(v_held), recorded_at = now(), updated_at = now(),
      agenda = case when c.agenda = '{}'::jsonb then kafaa_cc_agenda(v_person, true, true, false, true, current_date) else c.agenda end
    where id = v_id;
  else
    insert into kafaa_career_conversations (id, person_id, person_name, person_name_ar, prep, prep_submitted_at, agenda, employee_agrees, employee_comment, acknowledged_at,
      share_with_talent_review, created_at, status, held_on, notes, actions, focus_role_id, coach_hours, plan_id, manager_person_id, manager_read_id, manager_name, manager_name_ar,
      cycle, recorded_at, updated_at)
    values (v_id, v_person, pp.display_name, coalesce(nullif(pp.display_name_ar, ''), pp.display_name), '{}'::jsonb, null, kafaa_cc_agenda(v_person, true, true, false, true, current_date),
      null, null, null, false, now(), 'held', v_held, v_notes, v_actions, v_focus, v_hours, v_plan, me, me, coalesce(mg.display_name, ''), coalesce(nullif(mg.display_name_ar, ''), mg.display_name, ''),
      kafaa_cc_cycle(v_held), now(), now());
  end if;
  perform kafaa_cc_notify('nt-cc-' || v_id || '-held', v_person, 'Your career conversation with ' || coalesce(mg.display_name, '') || ' is recorded: please acknowledge it',
    'سُجِّل حوارك المهني مع ' || coalesce(nullif(mg.display_name_ar, ''), mg.display_name, '') || ': يُرجى الإقرار به', '/my/career/conversations', 'info');
  perform set_config('kafaa.seeding', coalesce(v_prev, ''), true);
  l := kafaa_ledger('kafaa.career.conversation_held', format('Career conversation %s with %s recorded (%s agreed actions)', v_id, v_person, n));
  a := kafaa_audit('conversation.record', 'career_conversations', v_id, 'ok', case when n > 0 then format('%s added, %s updated in plan %s', v_created, v_updated, v_plan) else 'no agreed actions' end,
    case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when n > 0 then 'Conversation recorded; the agreed actions are in the development plan as draft activities' else 'Conversation recorded' end, a, l,
    jsonb_build_object('id', v_id, 'person_id', v_person, 'plan_id', v_plan, 'created', v_created, 'updated', v_updated));
end $$;

-- ───────────── RPC: only the employee acknowledges; disagreeing needs a comment. Optionally adds the focus role and weekly hours
-- to the Learning Coach (M19 learning_goals). The manager is notified. Ledgered.
create or replace function kafaa_acknowledge_conversation(p_id text, p_agree boolean, p_comment text, p_add_to_coach boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; c kafaa_career_conversations; v_text text; g kafaa_learning_goals; fr kafaa_job_roles; v_focus text[]; v_hours numeric; v_coach boolean := false;
  pp kafaa_people; a kafaa_audit_events; l integer; v_prev text := current_setting('kafaa.seeding', true);
begin
  if me is null then return kafaa_refuse('conversation.acknowledge', 'career_conversations', p_id, 'not_signed_in', 'Sign in to acknowledge your career conversation'); end if;
  select * into c from kafaa_career_conversations where id = p_id;
  if c.id is null or (c.person_id <> me and c.manager_read_id is distinct from me) then return kafaa_refuse('conversation.acknowledge', 'career_conversations', p_id, 'not_found', 'Conversation not found'); end if;
  if c.person_id <> me then return kafaa_refuse('conversation.acknowledge', 'career_conversations', p_id, 'not_person', 'Only the employee can acknowledge their career conversation', kafaa_acting_role('skills_profile', array['Scope', 'Own'])); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  if v_role is null then return kafaa_refuse('conversation.acknowledge', 'career_conversations', p_id, 'forbidden', 'Career conversations are for staff'); end if;
  if c.status <> 'held' then return kafaa_refuse('conversation.acknowledge', 'career_conversations', p_id, 'invalid', 'This conversation is not waiting for your acknowledgement', v_role); end if;
  if p_agree is null then return kafaa_refuse('conversation.acknowledge', 'career_conversations', p_id, 'invalid', 'Choose whether you agree with the record', v_role); end if;
  v_text := kafaa_cc_trim(p_comment);
  if length(v_text) > 1000 then return kafaa_refuse('conversation.acknowledge', 'career_conversations', p_id, 'invalid', 'The comment is too long', v_role); end if;
  if not p_agree and length(v_text) < 3 then return kafaa_refuse('conversation.acknowledge', 'career_conversations', p_id, 'invalid', 'Say briefly what you disagree with', v_role); end if;
  perform set_config('kafaa.seeding', 'on', true);
  update kafaa_career_conversations set status = 'acknowledged', employee_agrees = p_agree, employee_comment = nullif(v_text, ''), acknowledged_at = now(), updated_at = now() where id = c.id;
  if coalesce(p_add_to_coach, false) and (c.focus_role_id is not null or c.coach_hours is not null) then
    select * into g from kafaa_learning_goals where person_id = me;
    v_focus := coalesce(g.focus_role_ids, '{}'::text[]);
    if c.focus_role_id is not null then select * into fr from kafaa_job_roles where id = c.focus_role_id; end if;
    if fr.id is not null and not coalesce(fr.security_sensitive, false) and not (fr.id = any(v_focus)) and coalesce(array_length(v_focus, 1), 0) < 3 then v_focus := v_focus || fr.id; end if;
    v_hours := coalesce(c.coach_hours, g.hours_per_week, 0);
    if g.id is null then
      insert into kafaa_learning_goals (id, person_id, hours_per_week, focus_role_ids, updated_at) values ('lg:' || me, me, v_hours, v_focus, now());
      v_coach := true;
    elsif g.hours_per_week is distinct from v_hours or coalesce(array_length(v_focus, 1), 0) <> coalesce(array_length(g.focus_role_ids, 1), 0) then
      update kafaa_learning_goals set hours_per_week = v_hours, focus_role_ids = v_focus, updated_at = now() where id = g.id;
      v_coach := true;
    end if;
  end if;
  select * into pp from kafaa_people where id = me;
  if c.manager_read_id is not null then
    perform kafaa_cc_notify('nt-cc-' || c.id || '-ack', c.manager_read_id,
      coalesce(pp.display_name, me) || case when p_agree then ' acknowledged your career conversation' else ' acknowledged your career conversation with a comment' end,
      'أقرّ ' || coalesce(nullif(pp.display_name_ar, ''), pp.display_name, me) || case when p_agree then ' بحواركما المهني' else ' بحواركما المهني مع تعليق' end,
      '/team/conversations?person=' || me, case when p_agree then 'ok' else 'warn' end);
  end if;
  perform set_config('kafaa.seeding', coalesce(v_prev, ''), true);
  l := kafaa_ledger('kafaa.career.conversation_acknowledged', format('Career conversation %s acknowledged by %s%s', c.id, me, case when p_agree then '' else ' with a disagreement comment' end));
  a := kafaa_audit('conversation.acknowledge', 'career_conversations', c.id, 'ok', case when p_agree then 'agreed' else 'acknowledged with a comment' end, case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when p_agree then 'Conversation acknowledged' else 'Conversation acknowledged with your comment' end, a, l,
    jsonb_build_object('id', c.id, 'agree', p_agree, 'coach_updated', v_coach));
end $$;

-- ───────────── RPC: the employee's consent to show the aspiration in talent review (F18). Ledgered.
create or replace function kafaa_set_aspiration_sharing(p_id text, p_on boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; c kafaa_career_conversations; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('conversation.share', 'career_conversations', p_id, 'not_signed_in', 'Sign in to change your sharing choice'); end if;
  select * into c from kafaa_career_conversations where id = p_id;
  if c.id is null or c.person_id <> me then return kafaa_refuse('conversation.share', 'career_conversations', p_id, 'not_found', 'Conversation not found'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  if v_role is null then return kafaa_refuse('conversation.share', 'career_conversations', p_id, 'forbidden', 'Career conversations are for staff'); end if;
  if p_on is null then return kafaa_refuse('conversation.share', 'career_conversations', p_id, 'invalid', 'Choose on or off', v_role); end if;
  update kafaa_career_conversations set share_with_talent_review = p_on, updated_at = now() where id = c.id;
  l := kafaa_ledger('kafaa.career.aspiration_sharing', format('Aspiration sharing with talent review %s for %s', case when p_on then 'on' else 'off' end, c.id));
  a := kafaa_audit('conversation.share', 'career_conversations', c.id, 'ok', case when p_on then 'on' else 'off' end, case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when p_on then 'Your aspiration is now visible in talent review' else 'Your aspiration is no longer visible in talent review' end, a, l,
    jsonb_build_object('id', c.id, 'share_with_talent_review', p_on));
end $$;

-- ───────────── RPC (F12 → F18): aspiration signals for people in the caller's talent-review scope; content only with consent. Audited.
create or replace function kafaa_talent_aspirations(p_person_ids text[]) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_all boolean; v_pid text; c kafaa_career_conversations; v_out jsonb := '[]'::jsonb; v_n integer := 0; v_s integer := 0; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('conversation.aspirations_read', 'career_conversations', null, 'not_signed_in', 'Sign in to see talent review data'); end if;
  v_role := kafaa_acting_role('talent_review', array['R', 'A', 'Scope']);
  if v_role is null then return kafaa_refuse('conversation.aspirations_read', 'career_conversations', null, 'forbidden', 'Aspirations are shared only in talent review'); end if;
  v_all := kafaa_has_grant('talent_review', array['R', 'W', 'A']);
  for v_pid in select z.x from (select u.x, min(u.o) as o from unnest(coalesce(p_person_ids, '{}'::text[])) with ordinality u(x, o) where u.x is not null and u.x <> '' group by u.x order by min(u.o) limit 200) z order by z.o loop
    if not exists (select 1 from kafaa_people where id = v_pid) then continue; end if;
    if not (v_all or (kafaa_has_grant('talent_review', array['Scope']) and kafaa_in_scope('talent_review', v_pid))) then continue; end if;
    select * into c from kafaa_career_conversations cc where cc.person_id = v_pid and cc.status in ('held', 'acknowledged') and cc.held_on is not null order by cc.held_on desc, cc.id collate "C" limit 1;
    v_n := v_n + 1;
    if c.id is null then v_out := v_out || jsonb_build_array(jsonb_build_object('person_id', v_pid, 'shared', false, 'reason', 'none'));
    elsif not c.share_with_talent_review then v_out := v_out || jsonb_build_array(jsonb_build_object('person_id', v_pid, 'shared', false, 'reason', 'not_shared'));
    else
      v_s := v_s + 1;
      v_out := v_out || jsonb_build_array(jsonb_build_object('person_id', v_pid, 'shared', true, 'reason', 'shared', 'conversation_id', c.id, 'held_on', c.held_on,
        'aspirations', case when jsonb_typeof(c.prep -> 'aspirations') = 'array' then c.prep -> 'aspirations' else '[]'::jsonb end,
        'mobility', case when jsonb_typeof(c.prep -> 'mobility') = 'string' then c.prep -> 'mobility' else 'null'::jsonb end,
        'leadership', case when jsonb_typeof(c.prep -> 'leadership') = 'string' then c.prep -> 'leadership' else 'null'::jsonb end,
        'goal_12m', case when jsonb_typeof(c.prep -> 'goal_12m') = 'string' then c.prep -> 'goal_12m' else '""'::jsonb end,
        'goal_3y', case when jsonb_typeof(c.prep -> 'goal_3y') = 'string' then c.prep -> 'goal_3y' else '""'::jsonb end));
    end if;
  end loop;
  a := kafaa_audit('conversation.aspirations_read', 'career_conversations', null, 'ok', format('%s people, %s shared', v_n, v_s), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', '', a, null, v_out);
end $$;

-- ───────────── RPC: HR aggregates by job family (skills_profile Agg or A). Read-only.
create or replace function kafaa_conversation_insights() returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me();
begin
  if me is null then return kafaa_refuse('conversation.insights', 'career_conversations', null, 'not_signed_in', 'Sign in to see career conversation insights'); end if;
  if kafaa_acting_role('skills_profile', array['Agg', 'A']) is null then return kafaa_refuse('conversation.insights', 'career_conversations', null, 'forbidden', 'Career conversation insights are for HR (aggregates only)'); end if;
  return jsonb_build_object('ok', true, 'code', 'ok', 'message', 'Career conversation insights', 'audit_seq', null, 'ledger_seq', null, 'data', kafaa_cc_insights_compute(current_date));
end $$;

-- ───────────── RPC: my reports of record with cadence and the conversation I can see (line managers). Read-only.
create or replace function kafaa_team_conversations() returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me();
begin
  if me is null then return kafaa_refuse('conversation.team', 'career_conversations', null, 'not_signed_in', 'Sign in to see your team'); end if;
  if kafaa_acting_role('skills_profile', array['Scope']) is null then return kafaa_refuse('conversation.team', 'career_conversations', null, 'forbidden', 'The team view is for line managers'); end if;
  return kafaa_result(true, 'ok', '', null::kafaa_audit_events, null, coalesce((
    select jsonb_agg(z.r order by z.pid collate "C") from (
      select p.id as pid, jsonb_build_object('person_id', p.id, 'name', p.display_name, 'name_ar', coalesce(nullif(p.display_name_ar, ''), p.display_name), 'role_id', p.job_role_id, 'family_id', p.job_family_id,
        'cadence', jsonb_build_object('last_held_on', l.held_on, 'due_on', kafaa_cc_due_on(l.held_on, p.hire_date), 'state', kafaa_cc_state(l.held_on, p.hire_date, current_date),
                                      'days', kafaa_cc_due_on(l.held_on, p.hire_date) - current_date),
        'open', (select jsonb_build_object('id', o.id, 'status', o.status, 'prep_submitted', o.prep_submitted_at is not null) from kafaa_career_conversations o
                 where o.person_id = p.id and o.manager_read_id = me and o.status in ('draft', 'held') order by o.created_at desc, o.id collate "C" limit 1),
        'last', case when l.id is null then null else jsonb_build_object('id', l.id, 'held_on', l.held_on, 'status', l.status, 'agrees', l.employee_agrees) end) as r
      from kafaa_people p
      left join lateral (select c.id, c.held_on, c.status, c.employee_agrees from kafaa_career_conversations c where c.person_id = p.id and c.status in ('held', 'acknowledged') and c.held_on is not null
                         order by c.held_on desc, c.id collate "C" limit 1) l on true
      where p.kind = 'staff' and p.status = 'active' and kafaa_opp_line_manager(p.id) = me) z), '[]'::jsonb));
end $$;

-- ───────────── RPC: six-monthly reminder sweep. Line managers: their reports; skills_profile A (training manager): every pair.
-- One reminder per person and month to each side of an overdue pair (idempotent ids). Audited, no ledger.
create or replace function kafaa_conversation_reminders() returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_all boolean; v_role text; r record; v_pairs integer := 0; v_over integer := 0; v_new integer := 0; v_month text := to_char(current_date, 'YYYY-MM');
  a kafaa_audit_events; v_prev text := current_setting('kafaa.seeding', true);
begin
  if me is null then return kafaa_refuse('conversation.reminders', 'career_conversations', null, 'not_signed_in', 'Sign in to send reminders'); end if;
  v_all := kafaa_has_grant('skills_profile', array['A']);
  v_role := kafaa_acting_role('skills_profile', case when v_all then array['A'] else array['Scope'] end);
  if v_role is null then return kafaa_refuse('conversation.reminders', 'career_conversations', null, 'forbidden', 'Reminders are sent by line managers and the training manager'); end if;
  perform set_config('kafaa.seeding', 'on', true);
  for r in select p.id, p.display_name, p.display_name_ar, p.hire_date, x.lm from kafaa_people p cross join lateral (select kafaa_opp_line_manager(p.id) as lm) x
           where p.kind = 'staff' and p.status = 'active' and x.lm is not null and (v_all or x.lm = me) order by p.id collate "C" loop
    v_pairs := v_pairs + 1;
    if kafaa_cc_state((select max(c.held_on) from kafaa_career_conversations c where c.person_id = r.id and c.status in ('held', 'acknowledged')), r.hire_date, current_date) <> 'overdue' then continue; end if;
    v_over := v_over + 1;
    if kafaa_cc_notify('nt-cc-due-' || r.id || '-' || v_month, r.id, 'Your six-monthly career conversation is due', 'حان موعد حوارك المهني نصف السنوي', '/my/career/conversations', 'warn',
         'Prepare your aspirations and goals, then share them with your line manager.', 'حضّر تطلعاتك وأهدافك ثم شاركها مع مديرك المباشر.') then v_new := v_new + 1; end if;
    if kafaa_cc_notify('nt-cc-due-' || r.id || '-' || v_month || '-m', r.lm, 'Career conversation overdue: ' || r.display_name, 'حوار مهني متأخر: ' || coalesce(nullif(r.display_name_ar, ''), r.display_name),
         '/team/conversations?person=' || r.id, 'warn') then v_new := v_new + 1; end if;
  end loop;
  perform set_config('kafaa.seeding', coalesce(v_prev, ''), true);
  a := kafaa_audit('conversation.reminders', 'career_conversations', null, 'ok', format('%s pairs, %s overdue, %s reminders', v_pairs, v_over, v_new), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when v_new > 0 then v_new || ' reminders sent' else 'No new reminders: everyone is up to date or already reminded this month' end, a, null,
    jsonb_build_object('pairs', v_pairs, 'overdue', v_over, 'created', v_new));
end $$;

-- ───────────── Grants: internal helpers are not callable by API roles; RPCs for signed-in users only.
revoke execute on function kafaa_cc_trim(text), kafaa_cc_is_date(text), kafaa_cc_cycle(date), kafaa_cc_due_on(date, date), kafaa_cc_state(date, date, date), kafaa_cc_flag(jsonb, boolean),
  kafaa_cc_text(jsonb), kafaa_cc_notify(text, text, text, text, text, text, text, text), kafaa_cc_prep_norm(jsonb, boolean), kafaa_cc_actions_norm(jsonb),
  kafaa_cc_agenda(text, boolean, boolean, boolean, boolean, date), kafaa_cc_cell(text, integer, integer, integer, integer, integer, integer[], integer[]), kafaa_cc_insights_compute(date)
  from public, anon, authenticated;
revoke execute on function kafaa_conversation_agenda(text), kafaa_submit_prep(jsonb, boolean), kafaa_record_conversation(jsonb), kafaa_acknowledge_conversation(text, boolean, text, boolean),
  kafaa_set_aspiration_sharing(text, boolean), kafaa_talent_aspirations(text[]), kafaa_conversation_insights(), kafaa_team_conversations(), kafaa_conversation_reminders() from public, anon;
grant execute on function kafaa_conversation_agenda(text), kafaa_submit_prep(jsonb, boolean), kafaa_record_conversation(jsonb), kafaa_acknowledge_conversation(text, boolean, text, boolean),
  kafaa_set_aspiration_sharing(text, boolean), kafaa_talent_aspirations(text[]), kafaa_conversation_insights(), kafaa_team_conversations(), kafaa_conversation_reminders() to authenticated;
