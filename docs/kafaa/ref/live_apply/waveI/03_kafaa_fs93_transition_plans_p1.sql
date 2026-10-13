-- kafaa_fs93_transition_plans_p1 (1/1) · from supabase/migrations/20261010293001_kafaa_fs93_transition_plans.sql
-- Apply with apply_migration name "kafaa_fs93_transition_plans_p1". Additive and idempotent; kafaa_* objects only.
-- [FS wave I · E3 · FS81] Transition plans and ladder-rung protection (M30).
-- A transition plan is a SIMULATED HR record for one person whose role is changing: the protected role (kept while they retrain)
-- and until when, the target role, the horizon, why, the retraining steps, the synthetic practice added for ladder-rung alerts and
-- dated reviews at most 183 days apart. Plans are visible to the person (own_profile Own) and to HR (transformation A) only: HR reads
-- them through the SECURITY DEFINER RPCs below, no read rule names `transformation`, so managers in scope read nothing.
-- kafaa_tp_alert mirrors rungAlert() in src/modules/m30/transition.ts exactly: for a Mastery Builder role (published FS11 map,
-- archetype mastery_builder) the junior tasks are the rated tasks of the rungs below it (vertical career moves into it) and its own
-- routine (non-critical) tasks that FS06 moves to tools (kafaa_rt_tasks move "shrink") by the horizon; each alert names the task and
-- the eligible practice: approved F28 simulator scenarios for the role's position that train a competency the task needs, OJT (F38)
-- repetitions of the task's own qualification-card task, else of a qualification-card task of the same role that shares a skill and
-- stays with people. kafaa_tp_problem mirrors planProblem() (same checks, same order); the RPCs mirror backend/local.fs81.ts (same
-- refusal codes and messages, one audit row per call, NEXUS ledger on activation and closing, a notice to the person).
-- PGlite parity: scripts/validate/fs93-transition-plans.mjs.
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file, RLS in the per-statement form.

-- ───────────── Table (generated DDL) + checks
-- M30 · Transition plan (SIMULATED HR): protected role, retraining, target role, ladder-rung practice and review dates; person and HR only (FS81)
create table if not exists kafaa_transition_plans (
  id text primary key,
  person_id text not null,
  current_role_id text,
  protected_role_id text not null,
  protected_until date not null,
  target_role_id text not null,
  horizon text not null default '2030' check (horizon in ('2030', '2035')),
  trigger text not null check (trigger in ('task_automation', 'role_redesign', 'new_technology', 'career_move')),
  start_on date not null,
  end_on date not null,
  reviews jsonb not null default '[]'::jsonb,
  next_review_on date,
  retraining jsonb not null default '[]'::jsonb,
  practice jsonb not null default '[]'::jsonb,
  note_en text not null default '',
  note_ar text not null default '',
  status text not null default 'draft' check (status in ('draft', 'active', 'completed', 'withdrawn')),
  simulated boolean not null default true,
  acknowledged_at timestamptz,
  revision integer not null default 1,
  history jsonb not null default '[]'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  updated_by text,
  updated_at timestamptz not null default now(),
  activated_by text,
  activated_at timestamptz,
  closed_by text,
  closed_at timestamptz,
  close_note text
);
comment on table kafaa_transition_plans is '[M30] Transition plan (SIMULATED HR): protected role, retraining, target role, ladder-rung practice and review dates; person and HR only (FS81)';
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_transition_plans_person_id_fk') then alter table kafaa_transition_plans add constraint kafaa_transition_plans_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_transition_plans_current_role_id_fk') then alter table kafaa_transition_plans add constraint kafaa_transition_plans_current_role_id_fk foreign key (current_role_id) references kafaa_job_roles(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_transition_plans_protected_role_id_fk') then alter table kafaa_transition_plans add constraint kafaa_transition_plans_protected_role_id_fk foreign key (protected_role_id) references kafaa_job_roles(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_transition_plans_target_role_id_fk') then alter table kafaa_transition_plans add constraint kafaa_transition_plans_target_role_id_fk foreign key (target_role_id) references kafaa_job_roles(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_transition_plans_person_id_idx on kafaa_transition_plans (person_id);
create index if not exists kafaa_transition_plans_current_role_id_idx on kafaa_transition_plans (current_role_id);
create index if not exists kafaa_transition_plans_protected_role_id_idx on kafaa_transition_plans (protected_role_id);
create index if not exists kafaa_transition_plans_target_role_id_idx on kafaa_transition_plans (target_role_id);
create index if not exists kafaa_transition_plans_next_review_on_idx on kafaa_transition_plans (next_review_on);
create index if not exists kafaa_transition_plans_status_idx on kafaa_transition_plans (status);
-- acceptance "plans are labelled SIMULATED and carry review dates", held by the database too
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'kafaa_transition_plans_simulated_ck') then
    alter table kafaa_transition_plans add constraint kafaa_transition_plans_simulated_ck check (simulated); end if;
  if not exists (select 1 from pg_constraint where conname = 'kafaa_transition_plans_reviews_ck') then
    alter table kafaa_transition_plans add constraint kafaa_transition_plans_reviews_ck check (jsonb_typeof(reviews) = 'array' and jsonb_array_length(reviews) >= 1); end if;
  if not exists (select 1 from pg_constraint where conname = 'kafaa_transition_plans_active_review_ck') then
    alter table kafaa_transition_plans add constraint kafaa_transition_plans_active_review_ck check (status <> 'active' or next_review_on is not null); end if;
  if not exists (select 1 from pg_constraint where conname = 'kafaa_transition_plans_dates_ck') then
    alter table kafaa_transition_plans add constraint kafaa_transition_plans_dates_ck check (end_on > start_on and protected_until >= start_on and protected_until <= end_on); end if;
end $$;

-- ───────────── RLS (per-statement form): the person reads their own plans; nobody else reads a row directly (HR uses the RPCs).
alter table kafaa_transition_plans enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_transition_plans' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_transition_plans for select to anon, authenticated using (false)'; end if;
end $$;
alter policy kafaa_read on kafaa_transition_plans using (((((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false)))));
revoke all on kafaa_transition_plans from anon, authenticated;
grant select on kafaa_transition_plans to anon, authenticated;

-- ───────────── Rules (internal helpers; not executable by API roles)
-- a real calendar date in YYYY-MM-DD form, else null (isDate)
create or replace function kafaa_tp_date(p jsonb) returns date language plpgsql immutable set search_path = public as $$
begin
  if p is null or jsonb_typeof(p) <> 'string' or (p #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$' then return null; end if;
  return case when to_char((p #>> '{}')::date, 'YYYY-MM-DD') = (p #>> '{}') then (p #>> '{}')::date end;
exception when others then return null;
end $$;
create or replace function kafaa_tp_position(p_role text) returns text language sql immutable set search_path = public as $$
  select case p_role when 'local-operator' then 'lo' when 'reactor-operator' then 'ro' when 'senior-reactor-operator' then 'sro'
    when 'shift-supervisor' then 'ss' when 'shift-technical-advisor' then 'sta' end
$$;
create or replace function kafaa_tp_hrank(p text) returns integer language sql immutable set search_path = public as $$
  select case p when 'now' then 0 when '2030' then 1 when '2035' then 2 else 9 end
$$;
-- isMasteryBuilder: a current, non-restricted role whose published FS11 map has the Mastery Builder archetype
create or replace function kafaa_tp_mastery(p_role text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from kafaa_job_roles r join kafaa_role_transformations m on m.role_id = r.id
    where r.id = p_role and coalesce(r.lifecycle, 'current') = 'current' and not kafaa_rt_path_only(r.family_id, r.security_sensitive)
      and m.status = 'published' and m.archetype = 'mastery_builder')
$$;
-- rungsBelow: current roles with a vertical (non-future) career move into the role, by role sort
create or replace function kafaa_tp_rungs(p_role text) returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(x.id order by x.sort, x.id collate "C"), '{}'::text[]) from (
    select distinct r.id, coalesce(r.sort, 0) as sort from kafaa_career_paths c join kafaa_job_roles r on r.id = c.from_role_id
     where c.to_role_id = p_role and c.type = 'vertical' and coalesce(c.kind, 'current') <> 'future' and c.from_role_id is not null and c.from_role_id <> p_role
       and coalesce(r.lifecycle, 'current') = 'current' and not kafaa_rt_path_only(r.family_id, r.security_sensitive)) x
$$;
-- practiceOptions: simulator scenarios (position, shared competencies), then OJT on the own qualification-card task, else on siblings
create or replace function kafaa_tp_options(p_task text, p_task_role text, p_alert_role text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_pos text := kafaa_tp_position(p_alert_role); v_comps text[]; v_out jsonb := '[]'::jsonb; v_sib jsonb; t kafaa_jta_tasks;
begin
  select coalesce(array_agg(distinct s.competency_id) filter (where s.competency_id is not null), '{}'::text[]) into v_comps
    from kafaa_jta_task_skills x join kafaa_skills s on s.id = x.skill_id where x.active and x.task_id = p_task;
  if v_pos is not null then
    select coalesce(jsonb_agg(jsonb_build_object('kind', 'simulator', 'ref_id', q.id, 'code', q.code, 'title_en', q.title_en, 'title_ar', q.title_ar, 'basis', 'shared_competency',
        'overlap', q.ov, 'minutes', q.duration_min, 'fidelity', q.fidelity, 'reps', 2,
        'reasons', jsonb_build_array(kafaa_rt_reason('opt_sim', jsonb_build_object('overlap', q.ov, 'position', upper(v_pos), 'minutes', q.duration_min)), kafaa_rt_reason('opt_fidelity_' || q.fidelity)))
      order by q.ov desc, case q.fidelity when 'full_scope' then 0 when 'limited_scope' then 1 when 'desktop' then 2 else 9 end, q.duration_min, q.id collate "C"), '[]'::jsonb) into v_out
    from (select s.id, s.code, s.title_en, s.title_ar, s.fidelity, s.duration_min, (select count(*)::int from unnest(coalesce(s.competency_ids, '{}'::text[])) c where c = any(v_comps)) as ov
            from kafaa_sim_scenarios s where s.status = 'approved' and v_pos = any(coalesce(s.positions, '{}'::text[]))) q
    where q.ov > 0;
  end if;
  select * into t from kafaa_jta_tasks where id = p_task;
  if t.task_item_id is not null then
    return v_out || jsonb_build_array(jsonb_build_object('kind', 'ojt', 'ref_id', t.task_item_id, 'code', t.code, 'title_en', t.title_en, 'title_ar', t.title_ar, 'basis', 'own_task',
      'overlap', 0, 'minutes', null, 'fidelity', null, 'reps', 3, 'reasons', jsonb_build_array(kafaa_rt_reason('opt_ojt_own', jsonb_build_object('reps', 3)))));
  end if;
  with mine as (select distinct skill_id from kafaa_jta_task_skills where active and task_id = p_task),
       human as (select e->>'id' as id from jsonb_array_elements(kafaa_rt_tasks(p_task_role)) e where e->>'move' <> 'shrink'),
       sib as (select x.id, x.code, x.title_en, x.title_ar, x.task_item_id, x.sort,
                 (select count(distinct y.skill_id)::int from kafaa_jta_task_skills y where y.active and y.task_id = x.id and y.skill_id in (select skill_id from mine)) as sh
                 from kafaa_jta_tasks x where x.role_id = p_task_role and x.id <> p_task and x.task_item_id is not null and x.id in (select id from human))
  select coalesce(jsonb_agg(jsonb_build_object('kind', 'ojt', 'ref_id', sib.task_item_id, 'code', sib.code, 'title_en', sib.title_en, 'title_ar', sib.title_ar, 'basis', 'shared_skill',
      'overlap', sib.sh, 'minutes', null, 'fidelity', null, 'reps', 3, 'reasons', jsonb_build_array(kafaa_rt_reason('opt_ojt_sibling', jsonb_build_object('shared', sib.sh, 'reps', 3))))
    order by sib.sh desc, sib.sort, sib.id collate "C"), '[]'::jsonb) into v_sib
  from sib where sib.sh > 0;
  return v_out || v_sib;
end $$;
-- juniorTasks: rated tasks moving to tools by the horizon (rungs below first, then the role's own routine tasks)
create or replace function kafaa_tp_junior(p_role text, p_h text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_lim int := case when p_h = '2035' then 2 else 1 end; v_out jsonb := '[]'::jsonb; r text; e jsonb;
begin
  foreach r in array kafaa_tp_rungs(p_role) loop
    for e in select x.v from jsonb_array_elements(kafaa_rt_tasks(r)) with ordinality x(v, n) order by x.n loop
      if e->>'move' = 'shrink' and kafaa_tp_hrank(e->>'horizon') <= v_lim then v_out := v_out || jsonb_build_array(e || jsonb_build_object('role_id', r, 'rung', 'below')); end if;
    end loop;
  end loop;
  for e in select x.v from jsonb_array_elements(kafaa_rt_tasks(p_role)) with ordinality x(v, n) order by x.n loop
    if e->>'move' = 'shrink' and kafaa_tp_hrank(e->>'horizon') <= v_lim and not coalesce((e->>'critical')::boolean, false) then
      v_out := v_out || jsonb_build_array(e || jsonb_build_object('role_id', p_role, 'rung', 'own')); end if;
  end loop;
  return v_out;
end $$;
-- rungAlert: one role at a horizon with the practice a plan adds ('[]' for the role-level view)
create or replace function kafaa_tp_alert(p_role text, p_horizon text, p_practice jsonb, p_basis text default 'target') returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_h text := case when p_horizon = '2035' then '2035' else '2030' end; v_arch text; v_rungs text[]; v_tasks jsonb := '[]'::jsonb; v_unc jsonb := '[]'::jsonb;
  e jsonb; v_opts jsonb; v_mine jsonb; v_cov boolean; v_pr jsonb := case when jsonb_typeof(p_practice) = 'array' then p_practice else '[]'::jsonb end; base jsonb; n int;
begin
  select m.archetype into v_arch from kafaa_role_transformations m where m.role_id = p_role and m.status = 'published';
  base := jsonb_build_object('role_id', p_role, 'basis', case when p_role is null then 'none' else p_basis end, 'archetype', v_arch, 'applies', false, 'fires', false, 'horizon', v_h,
    'rungs', '[]'::jsonb, 'tasks', '[]'::jsonb, 'covered', 0, 'uncovered', '[]'::jsonb, 'reasons', '[]'::jsonb);
  if p_role is null or not kafaa_tp_mastery(p_role) then
    return base || jsonb_build_object('reasons', jsonb_build_array(kafaa_rt_reason(case when p_role is null then 'rung_no_role' else 'rung_not_mastery' end)));
  end if;
  v_rungs := kafaa_tp_rungs(p_role);
  for e in select x.v from jsonb_array_elements(kafaa_tp_junior(p_role, v_h)) with ordinality x(v, i) order by x.i loop
    v_opts := kafaa_tp_options(e->>'id', e->>'role_id', p_role);
    select coalesce(jsonb_agg(jsonb_build_object('task_id', q.x->>'task_id', 'kind', q.x->>'kind', 'ref_id', q.x->>'ref_id',
        'reps', case when jsonb_typeof(q.x->'reps') = 'number' then q.x->'reps' else '0'::jsonb end) order by q.i), '[]'::jsonb) into v_mine
      from jsonb_array_elements(v_pr) with ordinality q(x, i)
     where jsonb_typeof(q.x) = 'object' and jsonb_typeof(q.x->'task_id') = 'string' and q.x->>'task_id' = e->>'id'
       and jsonb_typeof(q.x->'kind') = 'string' and jsonb_typeof(q.x->'ref_id') = 'string'
       and exists (select 1 from jsonb_array_elements(v_opts) o where o->>'kind' = q.x->>'kind' and o->>'ref_id' = q.x->>'ref_id');
    v_cov := jsonb_array_length(v_mine) > 0;
    v_tasks := v_tasks || jsonb_build_array(jsonb_build_object('task_id', e->>'id', 'role_id', e->>'role_id', 'rung', e->>'rung', 'code', e->>'code', 'title_en', e->>'title_en',
      'title_ar', e->>'title_ar', 'horizon', e->>'horizon', 'driver', e->'driver',
      'reasons', jsonb_build_array(kafaa_rt_reason(case when e->>'rung' = 'below' then 'rung_task_below' else 'rung_task_own' end, jsonb_build_object('horizon', e->>'horizon')))
        || (e->'reasons') || jsonb_build_array(kafaa_rt_reason(case when v_cov then 'rung_covered' else 'rung_uncovered' end, jsonb_build_object('n', jsonb_array_length(v_mine)))),
      'options', v_opts, 'practice', v_mine, 'covered', v_cov));
    if not v_cov then v_unc := v_unc || jsonb_build_array(e->>'id'); end if;
  end loop;
  n := jsonb_array_length(v_tasks);
  return base || jsonb_build_object('applies', true, 'fires', n > 0, 'rungs', to_jsonb(v_rungs), 'tasks', v_tasks, 'covered', n - jsonb_array_length(v_unc), 'uncovered', v_unc,
    'reasons', jsonb_build_array(kafaa_rt_reason('rung_mastery'), case when n > 0 then kafaa_rt_reason('rung_tasks', jsonb_build_object('n', n, 'rungs', cardinality(v_rungs), 'horizon', v_h))
                                                             else kafaa_rt_reason('rung_none', jsonb_build_object('horizon', v_h)) end));
end $$;
-- alertRoleOf + planAlert: the target role when it is a Mastery Builder role, else the protected role when it is one
create or replace function kafaa_tp_plan_alert(p_target text, p_protected text, p_horizon text, p_practice jsonb) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_role text; v_basis text := 'none'; v jsonb;
begin
  if kafaa_tp_mastery(p_target) then v_role := p_target; v_basis := 'target';
  elsif kafaa_tp_mastery(p_protected) then v_role := p_protected; v_basis := 'protected'; end if;
  v := kafaa_tp_alert(v_role, p_horizon, p_practice, v_basis);
  if v_role is not null then v := v || jsonb_build_object('reasons', jsonb_build_array(kafaa_rt_reason('rung_role_' || v_basis)) || (v->'reasons')); end if;
  return v;
end $$;
-- reviewsOk: 1 to 12 due dates, in order, strictly after the start, on or before the end, at most 183 days apart
create or replace function kafaa_tp_reviews_ok(p_start date, p_end date, p_dues jsonb) returns boolean language plpgsql immutable set search_path = public as $$
declare v_prev date := p_start; d date; e jsonb; n int;
begin
  if p_dues is null or jsonb_typeof(p_dues) <> 'array' then return false; end if;
  n := jsonb_array_length(p_dues);
  if n < 1 or n > 12 then return false; end if;
  for e in select x.v from jsonb_array_elements(p_dues) with ordinality x(v, i) order by x.i loop
    d := kafaa_tp_date(e);
    if d is null or d - v_prev <= 0 or d - v_prev > 183 or p_end - d < 0 then return false; end if;
    v_prev := d;
  end loop;
  return true;
end $$;
create or replace function kafaa_tp_int(p jsonb, p_lo int, p_hi int) returns boolean language sql immutable set search_path = public as $$
  select coalesce(jsonb_typeof(p) = 'number' and (p #>> '{}')::numeric = trunc((p #>> '{}')::numeric) and (p #>> '{}')::numeric between p_lo and p_hi, false)
$$;
create or replace function kafaa_tp_text_ok(p jsonb, p_lo int, p_hi int) returns boolean language sql immutable set search_path = public as $$
  select coalesce(jsonb_typeof(p) = 'string' and length(btrim(p #>> '{}')) between p_lo and p_hi, false)
$$;
-- done reviews of a stored plan (kept on every save)
create or replace function kafaa_tp_done(p_reviews jsonb) returns jsonb language sql immutable set search_path = public as $$
  select coalesce(jsonb_agg(r order by i), '[]'::jsonb) from jsonb_array_elements(case when jsonb_typeof(p_reviews) = 'array' then p_reviews else '[]'::jsonb end) with ordinality x(r, i)
   where jsonb_typeof(r) = 'object' and jsonb_typeof(r->'done_on') = 'string' and r->>'done_on' <> ''
$$;
create or replace function kafaa_tp_next(p_reviews jsonb) returns date language sql immutable set search_path = public as $$
  select (r->>'due_on')::date from jsonb_array_elements(case when jsonb_typeof(p_reviews) = 'array' then p_reviews else '[]'::jsonb end) with ordinality x(r, i)
   where not (jsonb_typeof(r->'done_on') = 'string' and r->>'done_on' <> '') order by i limit 1
$$;
-- planProblem: the first problem of a plan input, or null (same order as the TS rule)
create or replace function kafaa_tp_problem(p jsonb, cur kafaa_transition_plans, p_me text) returns text language plpgsql stable security definer set search_path = public as $$
declare v_pid text := kafaa_rt_str(p, 'person_id'); v_person kafaa_people; v_prot kafaa_job_roles; v_tgt kafaa_job_roles; v_start date; v_end date; v_until date;
  v_pend jsonb := p->'review_dates'; v_rt jsonb := p->'retraining'; v_pr jsonb := p->'practice'; v_alert jsonb; x jsonb; v_task jsonb; v_seen text[] := '{}'; v_key text; d date;
begin
  select * into v_person from kafaa_people where id = v_pid;
  if v_person.id is null or v_person.kind <> 'staff' or v_person.status <> 'active' or (cur.id is not null and cur.person_id is distinct from v_pid) then return 'invalid_person'; end if;
  if v_pid = p_me then return 'self_plan'; end if;
  if cur.id is null and exists (select 1 from kafaa_transition_plans t where t.person_id = v_pid and t.status in ('draft', 'active')) then return 'open_plan_exists'; end if;
  select * into v_prot from kafaa_job_roles where id = kafaa_rt_str(p, 'protected_role_id');
  select * into v_tgt from kafaa_job_roles where id = kafaa_rt_str(p, 'target_role_id');
  if v_prot.id is null or v_tgt.id is null or coalesce(v_prot.lifecycle, 'current') <> 'current' or v_prot.id is distinct from v_person.job_role_id or v_tgt.id = v_prot.id
     or coalesce(v_tgt.lifecycle, 'current') not in ('current', 'concept') then return 'invalid_role'; end if;
  if jsonb_typeof(p->'horizon') is distinct from 'string' or p->>'horizon' not in ('2030', '2035') then return 'invalid_horizon'; end if;
  if jsonb_typeof(p->'trigger') is distinct from 'string' or p->>'trigger' not in ('task_automation', 'role_redesign', 'new_technology', 'career_move') then return 'invalid_trigger'; end if;
  v_start := kafaa_tp_date(p->'start_on'); v_end := kafaa_tp_date(p->'end_on'); v_until := kafaa_tp_date(p->'protected_until');
  if v_start is null or v_end is null or v_until is null or v_end - v_start <= 0 or v_until - v_start < 0 or v_end - v_until < 0 then return 'invalid_dates'; end if;
  if v_pend is null or jsonb_typeof(v_pend) <> 'array'
     or not kafaa_tp_reviews_ok(v_start, v_end, coalesce((select jsonb_agg(r->'due_on' order by i) from jsonb_array_elements(kafaa_tp_done(cur.reviews)) with ordinality z(r, i)), '[]'::jsonb) || v_pend)
    then return 'reviews_required'; end if;
  if v_rt is null or jsonb_typeof(v_rt) <> 'array' or jsonb_array_length(v_rt) > 20 then return 'invalid_retraining'; end if;
  for x in select z.v from jsonb_array_elements(v_rt) with ordinality z(v, i) order by z.i loop
    if jsonb_typeof(x) <> 'object' then return 'invalid_retraining'; end if;
    d := kafaa_tp_date(x->'due_on');
    if jsonb_typeof(x->'kind') is distinct from 'string' or x->>'kind' not in ('course', 'practice', 'microcred', 'rotation', 'mentoring')
       or not kafaa_tp_text_ok(x->'title_en', 1, 160) or not kafaa_tp_text_ok(x->'title_ar', 1, 160) or not kafaa_tp_int(x->'hours', 1, 400)
       or d is null or d - v_start < 0 or v_end - d < 0
       or not (x->'ref_id' is null or jsonb_typeof(x->'ref_id') in ('null', 'string'))
       or (x->>'kind' = 'course' and not exists (select 1 from kafaa_courses c where c.id = coalesce(x->>'ref_id', ''))) then return 'invalid_retraining'; end if;
  end loop;
  if v_pr is null or jsonb_typeof(v_pr) <> 'array' or jsonb_array_length(v_pr) > 20 then return 'invalid_practice'; end if;
  v_alert := kafaa_tp_plan_alert(v_tgt.id, v_prot.id, p->>'horizon', '[]'::jsonb);
  for x in select z.v from jsonb_array_elements(v_pr) with ordinality z(v, i) order by z.i loop
    if jsonb_typeof(x) <> 'object' then return 'invalid_practice'; end if;
    select t into v_task from jsonb_array_elements(v_alert->'tasks') t where jsonb_typeof(x->'task_id') = 'string' and t->>'task_id' = x->>'task_id' limit 1;
    v_key := coalesce(x->>'task_id', '') || '|' || coalesce(x->>'kind', '') || '|' || coalesce(x->>'ref_id', '');
    if v_task is null or jsonb_typeof(x->'kind') is distinct from 'string' or jsonb_typeof(x->'ref_id') is distinct from 'string'
       or not exists (select 1 from jsonb_array_elements(v_task->'options') o where o->>'kind' = x->>'kind' and o->>'ref_id' = x->>'ref_id')
       or v_key = any(v_seen) or not kafaa_tp_int(x->'reps', 1, case when x->>'kind' = 'simulator' then 6 else 10 end) then return 'invalid_practice'; end if;
    v_seen := v_seen || v_key;
  end loop;
  if not (p->'note_en' is null or jsonb_typeof(p->'note_en') = 'null' or (jsonb_typeof(p->'note_en') = 'string' and length(btrim(p->>'note_en')) <= 600))
     or not (p->'note_ar' is null or jsonb_typeof(p->'note_ar') = 'null' or (jsonb_typeof(p->'note_ar') = 'string' and length(btrim(p->>'note_ar')) <= 600)) then return 'invalid_retraining'; end if;
  if kafaa_rt_banned(p->>'note_en') or kafaa_rt_banned(p->>'note_ar')
     or exists (select 1 from jsonb_array_elements(v_rt) r where kafaa_rt_banned(r->>'title_en') or kafaa_rt_banned(r->>'title_ar')) then return 'banned_wording'; end if;
  if (p->'activate') = 'true'::jsonb then
    if jsonb_array_length(v_rt) = 0 then return 'retraining_required'; end if;
    if jsonb_array_length(kafaa_tp_plan_alert(v_tgt.id, v_prot.id, p->>'horizon', v_pr)->'uncovered') > 0 then return 'rung_practice_required'; end if;
  end if;
  return null;
end $$;
create or replace function kafaa_tp_msg(p_code text) returns text language sql immutable set search_path = public as $$
  select case p_code
    when 'not_signed_in' then 'Sign in first'
    when 'forbidden' then 'Transition plans are decided by HR (transformation A) only'
    when 'not_found' then 'Transition plan not found'
    when 'not_editable' then 'Completed or withdrawn plans cannot be changed'
    when 'invalid_person' then 'Choose an active staff member (the person of a plan cannot change)'
    when 'self_plan' then 'You cannot decide your own transition plan: another HR decision-maker must'
    when 'open_plan_exists' then 'This person already has an open transition plan'
    when 'invalid_role' then 'Choose the protected role (the person''s current role) and a different target role (a current or concept role)'
    when 'invalid_horizon' then 'Choose the 2030 or 2035 horizon'
    when 'invalid_trigger' then 'Choose why the role is changing'
    when 'invalid_dates' then 'Dates must be real dates: the plan ends after it starts, and the role stays protected until a date within the plan'
    when 'reviews_required' then 'Plans carry review dates: 1 to 12, in order, within the plan, at most 183 days apart (from the start)'
    when 'invalid_retraining' then 'Each retraining step needs a kind, English and Arabic titles (up to 160 characters), 1 to 400 hours and a due date within the plan; a course step names a catalogue course'
    when 'invalid_practice' then 'Practice must be an eligible simulator scenario or OJT task for an alerted task, each once, with 1 to 6 simulator runs or 1 to 10 OJT repetitions'
    when 'banned_wording' then 'Describe how tasks change, not people: wording such as "replace" or "redundant" is not used (English and Arabic)'
    when 'retraining_required' then 'An active plan needs at least one retraining step'
    when 'rung_practice_required' then 'Ladder-rung alert: add simulator or OJT practice for every junior task moving to tools before activating the plan'
    when 'no_review_due' then 'No review is due yet (a review can be recorded from 14 days before its date)'
    when 'invalid_outcome' then 'Choose a review outcome (on track or at risk) and, when no review date is left, the next one (within 183 days and the plan)'
    when 'invalid_close' then 'Choose completed or withdrawn and give a reason (5 to 600 characters)'
    when 'not_active' then 'Only an active plan can be reviewed, acknowledged or closed'
    when 'not_person' then 'Only the person can acknowledge their plan'
    when 'already' then 'Already acknowledged'
    else p_code end
$$;
create or replace function kafaa_tp_clean_retraining(p jsonb) returns jsonb language sql immutable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('kind', x->>'kind', 'ref_id', nullif(x->>'ref_id', ''), 'title_en', btrim(x->>'title_en'), 'title_ar', btrim(x->>'title_ar'),
    'hours', x->'hours', 'due_on', x->>'due_on') order by i), '[]'::jsonb) from jsonb_array_elements(p) with ordinality z(x, i)
$$;
create or replace function kafaa_tp_clean_practice(p jsonb) returns jsonb language sql immutable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('task_id', x->>'task_id', 'kind', x->>'kind', 'ref_id', x->>'ref_id', 'reps', x->'reps') order by i), '[]'::jsonb)
    from jsonb_array_elements(p) with ordinality z(x, i)
$$;
-- practiceProgress: OJT repetitions acknowledged since the plan started; simulator runs are booked through F28 (null)
create or replace function kafaa_tp_progress(t kafaa_transition_plans) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('task_id', x->>'task_id', 'kind', x->>'kind', 'ref_id', x->>'ref_id', 'reps', x->'reps',
    'done', case when x->>'kind' = 'ojt' then (select count(*)::int from kafaa_ojt_logs l where l.person_id = t.person_id and l.task_id = x->>'ref_id' and l.status = 'acknowledged' and l.on_date >= t.start_on) end)
    order by i), '[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(t.practice) = 'array' then t.practice else '[]'::jsonb end) with ordinality z(x, i)
$$;
create or replace function kafaa_tp_review_state(p_next date) returns text language sql stable set search_path = public as $$
  select case when p_next is null then 'none' when p_next - current_date < 0 then 'overdue' when p_next - current_date <= 14 then 'due_soon' else 'on_time' end
$$;
create or replace function kafaa_tp_view(t kafaa_transition_plans, p_me text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pp kafaa_people;
begin
  select * into pp from kafaa_people where id = t.person_id;
  return jsonb_build_object(
    'plan', to_jsonb(t) || jsonb_build_object('person_name', coalesce(pp.display_name, t.person_id), 'person_name_ar', coalesce(pp.display_name_ar, pp.display_name, t.person_id)),
    'alert', kafaa_tp_plan_alert(t.target_role_id, t.protected_role_id, t.horizon, t.practice),
    'progress', kafaa_tp_progress(t),
    'review_state', case when t.status = 'active' then kafaa_tp_review_state(t.next_review_on) else 'none' end,
    'mine', t.person_id = p_me,
    'can_decide', kafaa_has_grant('transformation', array['A']) and t.person_id is distinct from p_me);
end $$;
create or replace function kafaa_tp_notify(p_id text, p_person text, p_en text, p_ar text) returns void language plpgsql security definer set search_path = public as $$
declare v_prev text := coalesce(current_setting('kafaa.seeding', true), '');
begin
  if p_person is null then return; end if;
  perform set_config('kafaa.seeding', 'on', true);
  insert into kafaa_notifications (id, person_id, kind, title_en, title_ar, body_en, body_ar, link, severity)
  values (p_id, p_person, 'transition', p_en, p_ar, null, null, '/my/transition-plan', 'info') on conflict (id) do nothing;
  perform set_config('kafaa.seeding', v_prev, true);
end $$;
create or replace function kafaa_tp_hist(p_hist jsonb, p_by text, p_action text, p_status text, p_rev int, p_extra jsonb default '{}'::jsonb) returns jsonb language sql stable set search_path = public as $$
  select case when jsonb_typeof(p_hist) = 'array' then p_hist else '[]'::jsonb end
    || jsonb_build_array(jsonb_build_object('at', date_trunc('second', now()), 'by', p_by, 'action', p_action, 'status', p_status, 'revision', p_rev) || coalesce(p_extra, '{}'::jsonb))
$$;

-- ───────────── FS81 RPCs: reads
create or replace function kafaa_transition_plan_view(p_plan text default null) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); t kafaa_transition_plans;
begin
  if me is null then return null; end if;
  if nullif(btrim(coalesce(p_plan, '')), '') is not null then
    select * into t from kafaa_transition_plans where id = btrim(p_plan);
    if t.id is null or (t.person_id <> me and not kafaa_has_grant('transformation', array['A'])) then return null; end if;
  else
    select * into t from kafaa_transition_plans where person_id = me
     order by case status when 'active' then 0 when 'draft' then 1 when 'completed' then 2 else 3 end, created_at desc, id collate "C" desc limit 1;
    if t.id is null then return null; end if;
  end if;
  return kafaa_tp_view(t, me);
end $$;
create or replace function kafaa_transition_plans() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me();
begin
  if me is null or not kafaa_has_grant('transformation', array['A']) then return null; end if;
  return (select coalesce(jsonb_agg(kafaa_tp_view(t, me) order by case t.status when 'active' then 0 when 'draft' then 1 when 'completed' then 2 else 3 end,
    coalesce(t.next_review_on, '9999-12-31'::date), t.id collate "C"), '[]'::jsonb) from kafaa_transition_plans t);
end $$;
create or replace function kafaa_rung_alerts(p_horizon text default '2030') returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me();
begin
  if me is null or not kafaa_has_grant('transformation', array['W', 'A', 'Agg']) then return null; end if;
  return (select coalesce(jsonb_agg(kafaa_tp_alert(r.id, p_horizon, '[]'::jsonb, 'target') order by coalesce(r.sort, 0), r.id collate "C"), '[]'::jsonb)
    from kafaa_job_roles r where kafaa_tp_mastery(r.id));
end $$;

create or replace function kafaa_transition_candidates() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me();
begin
  if me is null or not kafaa_has_grant('transformation', array['A']) then return null; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('person_id', p.id, 'name', coalesce(p.display_name, p.id), 'name_ar', coalesce(p.display_name_ar, p.display_name, p.id), 'role_id', p.job_role_id,
      'open_plan_id', (select min(t.id collate "C") from kafaa_transition_plans t where t.person_id = p.id and t.status in ('draft', 'active'))) order by p.id collate "C"), '[]'::jsonb)
    from kafaa_people p join kafaa_job_roles r on r.id = p.job_role_id
   where p.kind = 'staff' and p.status = 'active' and coalesce(r.lifecycle, 'current') = 'current');
end $$;
-- the editor preview (nothing saved): the first problem saving would refuse and the alert of the input's roles with its practice
create or replace function kafaa_preview_transition_plan(p jsonb) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); cur kafaa_transition_plans; v_pid text;
begin
  if me is null or not kafaa_has_grant('transformation', array['A']) then return null; end if;
  p := coalesce(p, '{}'::jsonb);
  if jsonb_typeof(p) <> 'object' then p := '{}'::jsonb; end if;
  v_pid := nullif(coalesce(kafaa_rt_str(p, 'plan_id'), ''), '');
  if v_pid is not null then select * into cur from kafaa_transition_plans where id = v_pid; end if;
  return jsonb_build_object(
    'problem', kafaa_tp_problem(p || jsonb_build_object('activate', (p->'activate') = 'true'::jsonb or cur.status = 'active'), cur, me),
    'alert', kafaa_tp_plan_alert(kafaa_rt_str(p, 'target_role_id'), kafaa_rt_str(p, 'protected_role_id'), case when jsonb_typeof(p->'horizon') = 'string' then p->>'horizon' end, p->'practice'));
end $$;

-- ───────────── FS81 RPCs: writes
create or replace function kafaa_save_transition_plan(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_pid text; cur kafaa_transition_plans; v_act boolean; v_code text; v_id text; v_person kafaa_people; v_reviews jsonb; v_status text;
  v_becomes boolean; v_rev int; v_at timestamptz := date_trunc('second', now()); v_rt jsonb; v_pr jsonb; v_next date; v_alert jsonb; a kafaa_audit_events; l integer;
begin
  p := coalesce(p, '{}'::jsonb);
  if jsonb_typeof(p) <> 'object' then p := '{}'::jsonb; end if;
  v_pid := nullif(coalesce(kafaa_rt_str(p, 'plan_id'), ''), '');
  if me is null then return kafaa_refuse('transition.save', 'transition_plans', v_pid, 'not_signed_in', kafaa_tp_msg('not_signed_in')); end if;
  v_role := kafaa_acting_role('transformation', array['A']);
  if v_role is null then return kafaa_refuse('transition.save', 'transition_plans', v_pid, 'forbidden', kafaa_tp_msg('forbidden')); end if;
  if v_pid is not null then
    select * into cur from kafaa_transition_plans where id = v_pid;
    if cur.id is null then return kafaa_refuse('transition.save', 'transition_plans', v_pid, 'not_found', kafaa_tp_msg('not_found'), v_role); end if;
    if cur.status not in ('draft', 'active') then return kafaa_refuse('transition.save', 'transition_plans', v_pid, 'not_editable', kafaa_tp_msg('not_editable'), v_role); end if;
  end if;
  v_act := (p->'activate') = 'true'::jsonb or cur.status = 'active';
  v_code := kafaa_tp_problem(p || jsonb_build_object('activate', v_act), cur, me);
  if v_code is not null then return kafaa_refuse('transition.save', 'transition_plans', v_pid, v_code, kafaa_tp_msg(v_code), v_role); end if;
  select * into v_person from kafaa_people where id = kafaa_rt_str(p, 'person_id');
  v_id := coalesce(cur.id, 'tp-' || v_person.id || '-' || ((select count(*) from kafaa_transition_plans x where x.person_id = v_person.id) + 1));
  v_reviews := kafaa_tp_done(cur.reviews) || coalesce((select jsonb_agg(jsonb_build_object('due_on', d #>> '{}', 'done_on', null, 'outcome', null, 'note', null, 'by', null) order by i)
    from jsonb_array_elements(p->'review_dates') with ordinality z(d, i)), '[]'::jsonb);
  v_next := kafaa_tp_next(v_reviews);
  v_status := case when v_act then 'active' else 'draft' end;
  v_becomes := v_act and cur.status is distinct from 'active';
  v_rev := coalesce(cur.revision, 0) + 1;
  v_rt := kafaa_tp_clean_retraining(p->'retraining');
  v_pr := kafaa_tp_clean_practice(p->'practice');
  if cur.id is not null then
    update kafaa_transition_plans set protected_role_id = kafaa_rt_str(p, 'protected_role_id'), protected_until = (p->>'protected_until')::date, target_role_id = kafaa_rt_str(p, 'target_role_id'),
      horizon = p->>'horizon', trigger = p->>'trigger', start_on = (p->>'start_on')::date, end_on = (p->>'end_on')::date, reviews = v_reviews, next_review_on = v_next,
      retraining = v_rt, practice = v_pr, note_en = coalesce(kafaa_rt_str(p, 'note_en'), ''), note_ar = coalesce(kafaa_rt_str(p, 'note_ar'), ''), status = v_status, revision = v_rev,
      updated_by = me, updated_at = v_at, history = kafaa_tp_hist(cur.history, me, case when v_becomes then 'activate' else 'update' end, v_status, v_rev),
      activated_by = case when v_becomes then me else activated_by end, activated_at = case when v_becomes then v_at else activated_at end
    where id = v_id;
  else
    insert into kafaa_transition_plans (id, person_id, current_role_id, protected_role_id, protected_until, target_role_id, horizon, trigger, start_on, end_on, reviews, next_review_on,
      retraining, practice, note_en, note_ar, status, simulated, acknowledged_at, revision, history, created_by, created_at, updated_by, updated_at, activated_by, activated_at, closed_by, closed_at, close_note)
    values (v_id, v_person.id, v_person.job_role_id, kafaa_rt_str(p, 'protected_role_id'), (p->>'protected_until')::date, kafaa_rt_str(p, 'target_role_id'), p->>'horizon', p->>'trigger',
      (p->>'start_on')::date, (p->>'end_on')::date, v_reviews, v_next, v_rt, v_pr, coalesce(kafaa_rt_str(p, 'note_en'), ''), coalesce(kafaa_rt_str(p, 'note_ar'), ''), v_status, true, null, v_rev,
      kafaa_tp_hist('[]'::jsonb, me, case when v_becomes then 'create_activate' else 'create' end, v_status, v_rev), me, v_at, me, v_at,
      case when v_becomes then me end, case when v_becomes then v_at end, null, null, null);
  end if;
  if v_becomes then
    perform kafaa_tp_notify('nt-tp-' || v_id || '-r' || v_rev, v_person.id, 'Your transition plan is active: next review on ' || v_next::text, 'أصبحت خطة الانتقال الخاصة بك نافذة: المراجعة التالية في ' || v_next::text);
    l := kafaa_ledger('kafaa.transition.activate', v_id || ' transition plan activated (SIMULATED HR record)');
  end if;
  v_alert := kafaa_tp_plan_alert(kafaa_rt_str(p, 'target_role_id'), kafaa_rt_str(p, 'protected_role_id'), p->>'horizon', v_pr);
  a := kafaa_audit(case when v_becomes then 'transition.activate' else 'transition.save' end, 'transition_plans', v_id, 'ok',
    v_status || ' r' || v_rev || ', ' || jsonb_array_length(v_reviews) || ' reviews, ' || jsonb_array_length(v_rt) || ' retraining steps, ' || jsonb_array_length(v_pr) || ' practice items, '
      || jsonb_array_length(v_alert->'tasks') || ' rung tasks',
    case when not v_becomes then 'not_applicable' when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when v_becomes then 'Transition plan activated; the person is notified' else 'Transition plan saved' end, a, l,
    jsonb_build_object('id', v_id, 'status', v_status, 'revision', v_rev, 'next_review_on', v_next));
end $$;

create or replace function kafaa_review_transition_plan(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_pid text; cur kafaa_transition_plans; v_idx int; v_due date; v_n int; v_nx_raw jsonb; v_nx date; v_last date; v_left int; v_note text;
  v_reviews jsonb; v_next date; v_rev int; a kafaa_audit_events;
begin
  p := coalesce(p, '{}'::jsonb);
  if jsonb_typeof(p) <> 'object' then p := '{}'::jsonb; end if;
  v_pid := nullif(coalesce(kafaa_rt_str(p, 'plan_id'), ''), '');
  if me is null then return kafaa_refuse('transition.review', 'transition_plans', v_pid, 'not_signed_in', kafaa_tp_msg('not_signed_in')); end if;
  v_role := kafaa_acting_role('transformation', array['A']);
  if v_role is null then return kafaa_refuse('transition.review', 'transition_plans', v_pid, 'forbidden', kafaa_tp_msg('forbidden')); end if;
  select * into cur from kafaa_transition_plans where id = v_pid;
  if cur.id is null then return kafaa_refuse('transition.review', 'transition_plans', v_pid, 'not_found', kafaa_tp_msg('not_found'), v_role); end if;
  if cur.person_id = me then return kafaa_refuse('transition.review', 'transition_plans', v_pid, 'self_plan', kafaa_tp_msg('self_plan'), v_role); end if;
  if cur.status <> 'active' then return kafaa_refuse('transition.review', 'transition_plans', v_pid, 'not_active', kafaa_tp_msg('not_active'), v_role); end if;
  v_n := jsonb_array_length(cur.reviews);
  select i - 1, (r->>'due_on')::date into v_idx, v_due from jsonb_array_elements(cur.reviews) with ordinality z(r, i)
   where not (jsonb_typeof(r->'done_on') = 'string' and r->>'done_on' <> '') order by i limit 1;
  if v_idx is null or v_due - current_date > 14 then return kafaa_refuse('transition.review', 'transition_plans', v_pid, 'no_review_due', kafaa_tp_msg('no_review_due'), v_role); end if;
  v_nx_raw := p->'next_review_on';
  if v_nx_raw is not null and jsonb_typeof(v_nx_raw) = 'null' then v_nx_raw := null; end if;
  v_nx := kafaa_tp_date(v_nx_raw);
  v_last := (cur.reviews->(v_n - 1)->>'due_on')::date;
  v_left := v_n - v_idx - 1;
  v_note := case when p->'note' is null or jsonb_typeof(p->'note') = 'null' then '' when jsonb_typeof(p->'note') = 'string' then p->>'note' end;
  if jsonb_typeof(p->'outcome') is distinct from 'string' or p->>'outcome' not in ('on_track', 'at_risk') or v_note is null or length(btrim(v_note)) > 600
     or (v_nx_raw is not null and (v_nx is null or v_nx - current_date <= 0 or v_nx - current_date > 183 or v_nx - v_last <= 0 or cur.end_on - v_nx < 0))
     or (v_left = 0 and v_nx_raw is null) then return kafaa_refuse('transition.review', 'transition_plans', v_pid, 'invalid_outcome', kafaa_tp_msg('invalid_outcome'), v_role); end if;
  if kafaa_rt_banned(v_note) then return kafaa_refuse('transition.review', 'transition_plans', v_pid, 'banned_wording', kafaa_tp_msg('banned_wording'), v_role); end if;
  select coalesce(jsonb_agg(case when i - 1 = v_idx then jsonb_build_object('due_on', r->>'due_on', 'done_on', current_date::text, 'outcome', p->>'outcome', 'note', nullif(btrim(v_note), ''), 'by', me) else r end order by i), '[]'::jsonb)
    into v_reviews from jsonb_array_elements(cur.reviews) with ordinality z(r, i);
  if v_nx is not null then v_reviews := v_reviews || jsonb_build_array(jsonb_build_object('due_on', v_nx::text, 'done_on', null, 'outcome', null, 'note', null, 'by', null)); end if;
  v_rev := cur.revision + 1;
  v_next := kafaa_tp_next(v_reviews);
  update kafaa_transition_plans set reviews = v_reviews, next_review_on = v_next, revision = v_rev, updated_by = me, updated_at = date_trunc('second', now()),
    history = kafaa_tp_hist(cur.history, me, 'review', 'active', v_rev, jsonb_build_object('outcome', p->>'outcome')) where id = v_pid;
  a := kafaa_audit('transition.review', 'transition_plans', v_pid, 'ok', 'review ' || v_due::text || ' ' || (p->>'outcome') || ', next ' || coalesce(v_next::text, 'none'), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Review recorded', a, null, jsonb_build_object('id', v_pid, 'next_review_on', v_next));
end $$;

create or replace function kafaa_close_transition_plan(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_pid text; cur kafaa_transition_plans; v_note text; v_status text; v_rev int; a kafaa_audit_events; l integer;
begin
  p := coalesce(p, '{}'::jsonb);
  if jsonb_typeof(p) <> 'object' then p := '{}'::jsonb; end if;
  v_pid := nullif(coalesce(kafaa_rt_str(p, 'plan_id'), ''), '');
  if me is null then return kafaa_refuse('transition.close', 'transition_plans', v_pid, 'not_signed_in', kafaa_tp_msg('not_signed_in')); end if;
  v_role := kafaa_acting_role('transformation', array['A']);
  if v_role is null then return kafaa_refuse('transition.close', 'transition_plans', v_pid, 'forbidden', kafaa_tp_msg('forbidden')); end if;
  select * into cur from kafaa_transition_plans where id = v_pid;
  if cur.id is null then return kafaa_refuse('transition.close', 'transition_plans', v_pid, 'not_found', kafaa_tp_msg('not_found'), v_role); end if;
  if cur.person_id = me then return kafaa_refuse('transition.close', 'transition_plans', v_pid, 'self_plan', kafaa_tp_msg('self_plan'), v_role); end if;
  v_note := coalesce(kafaa_rt_str(p, 'note'), '');
  if jsonb_typeof(p->'outcome') is distinct from 'string' or p->>'outcome' not in ('completed', 'withdrawn') or length(v_note) < 5 or length(v_note) > 600 then
    return kafaa_refuse('transition.close', 'transition_plans', v_pid, 'invalid_close', kafaa_tp_msg('invalid_close'), v_role); end if;
  if not (cur.status = 'active' or (cur.status = 'draft' and p->>'outcome' = 'withdrawn')) then
    return kafaa_refuse('transition.close', 'transition_plans', v_pid, 'not_active', kafaa_tp_msg('not_active'), v_role); end if;
  if kafaa_rt_banned(v_note) then return kafaa_refuse('transition.close', 'transition_plans', v_pid, 'banned_wording', kafaa_tp_msg('banned_wording'), v_role); end if;
  v_status := p->>'outcome';
  v_rev := cur.revision + 1;
  update kafaa_transition_plans set status = v_status, next_review_on = null, closed_by = me, closed_at = date_trunc('second', now()), close_note = v_note, revision = v_rev,
    updated_by = me, updated_at = date_trunc('second', now()), history = kafaa_tp_hist(cur.history, me, case when v_status = 'completed' then 'complete' else 'withdraw' end, v_status, v_rev)
  where id = v_pid;
  perform kafaa_tp_notify('nt-tp-' || v_pid || '-r' || v_rev, cur.person_id,
    case when v_status = 'completed' then 'Your transition plan is complete' else 'Your transition plan was withdrawn' end,
    case when v_status = 'completed' then 'اكتملت خطة الانتقال الخاصة بك' else 'سُحبت خطة الانتقال الخاصة بك' end);
  l := kafaa_ledger('kafaa.transition.close', v_pid || ' transition plan ' || v_status || ' (SIMULATED HR record)');
  a := kafaa_audit(case when v_status = 'completed' then 'transition.complete' else 'transition.withdraw' end, 'transition_plans', v_pid, 'ok', v_status || ' r' || v_rev,
    case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when v_status = 'completed' then 'Transition plan completed' else 'Transition plan withdrawn' end, a, l, jsonb_build_object('id', v_pid, 'status', v_status));
end $$;

create or replace function kafaa_acknowledge_transition_plan(p_plan text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_pid text := nullif(btrim(coalesce(p_plan, '')), ''); cur kafaa_transition_plans; v_at timestamptz := date_trunc('second', now()); a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('transition.acknowledge', 'transition_plans', v_pid, 'not_signed_in', kafaa_tp_msg('not_signed_in')); end if;
  select * into cur from kafaa_transition_plans where id = v_pid;
  if cur.id is null or cur.person_id <> me then return kafaa_refuse('transition.acknowledge', 'transition_plans', v_pid, 'not_found', kafaa_tp_msg('not_found')); end if;
  if cur.status <> 'active' then return kafaa_refuse('transition.acknowledge', 'transition_plans', v_pid, 'not_active', kafaa_tp_msg('not_active')); end if;
  if cur.acknowledged_at is not null then return kafaa_refuse('transition.acknowledge', 'transition_plans', v_pid, 'already', kafaa_tp_msg('already')); end if;
  update kafaa_transition_plans set acknowledged_at = v_at, history = kafaa_tp_hist(cur.history, me, 'acknowledge', 'active', cur.revision) where id = v_pid;
  a := kafaa_audit('transition.acknowledge', 'transition_plans', v_pid, 'ok', 'acknowledged by the person', 'not_applicable', null, null);
  return kafaa_result(true, 'ok', 'Plan acknowledged', a, null, jsonb_build_object('id', v_pid, 'acknowledged_at', v_at));
end $$;

-- ───────────── Grants: internal helpers are not executable by API roles; RPCs only by signed-in users.
revoke all on function kafaa_tp_date(jsonb), kafaa_tp_position(text), kafaa_tp_hrank(text), kafaa_tp_mastery(text), kafaa_tp_rungs(text), kafaa_tp_options(text, text, text),
  kafaa_tp_junior(text, text), kafaa_tp_alert(text, text, jsonb, text), kafaa_tp_plan_alert(text, text, text, jsonb), kafaa_tp_reviews_ok(date, date, jsonb), kafaa_tp_int(jsonb, integer, integer),
  kafaa_tp_text_ok(jsonb, integer, integer), kafaa_tp_done(jsonb), kafaa_tp_next(jsonb), kafaa_tp_problem(jsonb, kafaa_transition_plans, text), kafaa_tp_msg(text),
  kafaa_tp_clean_retraining(jsonb), kafaa_tp_clean_practice(jsonb), kafaa_tp_progress(kafaa_transition_plans), kafaa_tp_review_state(date), kafaa_tp_view(kafaa_transition_plans, text),
  kafaa_tp_notify(text, text, text, text), kafaa_tp_hist(jsonb, text, text, text, integer, jsonb) from public, anon, authenticated;
revoke all on function kafaa_transition_plan_view(text), kafaa_transition_plans(), kafaa_rung_alerts(text), kafaa_transition_candidates(), kafaa_preview_transition_plan(jsonb), kafaa_save_transition_plan(jsonb), kafaa_review_transition_plan(jsonb),
  kafaa_close_transition_plan(jsonb), kafaa_acknowledge_transition_plan(text) from public, anon;
grant execute on function kafaa_transition_plan_view(text), kafaa_transition_plans(), kafaa_rung_alerts(text), kafaa_transition_candidates(), kafaa_preview_transition_plan(jsonb), kafaa_save_transition_plan(jsonb), kafaa_review_transition_plan(jsonb),
  kafaa_close_transition_plan(jsonb), kafaa_acknowledge_transition_plan(text) to authenticated;
