-- [FS wave A · E5 · FS06] Task layer with AI exposure and change horizon (M26, extends F27 SAT workbench).
-- Every non-restricted JTA task carries the OECD capability needs (1-4 of the nine task dimensions, levels 1-5), a change horizon
-- (now, 2030, 2035), a technology driver, the derived exposure (augment, automate_partly, human_core) and task-to-skill links.
-- kafaa_fx_exposure mirrors exposureOf() in src/modules/m26/future.ts exactly (PGlite parity: scripts/validate/fs15-task-future.mjs).
-- The AI capability per dimension and horizon is a SIMULATED planning assumption on the OECD five-level scale, never an OECD rating.
-- Security, safeguards and cyber tasks (restricted) are never rated, scored or returned: the task guard nulls their future
-- attributes, a check constraint enforces it, the task-skill guard refuses links to them and kafaa_task_future never returns them.
-- RPCs: kafaa_set_task_future (training manager, or an instructor the training manager designated as SAT analyst; one SAT
-- change-log row with area 'future' and one audit row per edit), kafaa_task_future (sat R), kafaa_designate_sat_analyst
-- (training manager; ledger row).
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file, RLS in the per-statement form.

-- ───────────── Columns (generated DDL, additive)
alter table kafaa_jta_tasks add column if not exists ai_capability_needed jsonb;
alter table kafaa_jta_tasks add column if not exists exposure text check (exposure in ('augment', 'automate_partly', 'human_core'));
alter table kafaa_jta_tasks add column if not exists change_horizon text check (change_horizon in ('now', '2030', '2035'));
alter table kafaa_jta_tasks add column if not exists tech_driver text check (tech_driver in ('ai_assist', 'digital_ic', 'robotics', 'digital_twin', 'smr_design', 'none'));
alter table kafaa_jta_tasks add column if not exists future_by text;
alter table kafaa_jta_tasks add column if not exists future_on date;
create index if not exists kafaa_jta_tasks_exposure_idx on kafaa_jta_tasks (exposure);
alter table kafaa_sat_changes add column if not exists area text not null default 'content' check (area in ('content', 'future'));

-- ───────────── Tables (generated DDL)
-- M26 · Skills (and level) a JTA task needs, today or at its change horizon; never for restricted tasks (FS06)
create table if not exists kafaa_jta_task_skills (
  id text primary key,
  task_id text not null,
  skill_id text not null,
  level integer not null,
  kind text not null default 'current' check (kind in ('current', 'future')),
  source text not null default 'analyst' check (source in ('qual_map', 'analyst')),
  active boolean not null default true,
  linked_by text,
  linked_at timestamptz not null default now(),
  sort integer not null default 0
);
comment on table kafaa_jta_task_skills is '[M26] Skills (and level) a JTA task needs, today or at its change horizon; never for restricted tasks (FS06)';

-- M26 · AI capability level per OECD dimension and horizon on the five-level scale: SIMULATED planning assumption, not an OECD rating (FS06)
create table if not exists kafaa_ai_capability_levels (
  id text primary key,
  dimension text not null check (dimension in ('language', 'social', 'problem_solving', 'creativity', 'metacognition', 'learning_memory', 'vision', 'manipulation', 'robotic')),
  horizon text not null check (horizon in ('now', '2030', '2035')),
  level integer not null,
  basis_en text not null,
  basis_ar text not null,
  simulated boolean not null default true,
  sources jsonb not null default '[]'::jsonb,
  sort integer not null default 0
);
comment on table kafaa_ai_capability_levels is '[M26] AI capability level per OECD dimension and horizon on the five-level scale: SIMULATED planning assumption, not an OECD rating (FS06)';

-- M26 · Sourced benchmark figures shown beside the task-exposure results (stored rows, never typed into copy) (FS06)
create table if not exists kafaa_ai_exposure_refs (
  id text primary key,
  benchmark_id text not null,
  label_en text not null,
  label_ar text not null,
  value numeric not null,
  unit text not null default '',
  note_en text not null default '',
  note_ar text not null default '',
  sources jsonb not null default '[]'::jsonb,
  as_of date not null,
  sort integer not null default 0
);
comment on table kafaa_ai_exposure_refs is '[M26] Sourced benchmark figures shown beside the task-exposure results (stored rows, never typed into copy) (FS06)';

-- M26 · Training staff designated as SAT analysts by the training manager: they may set task future attributes (FS06)
create table if not exists kafaa_sat_analysts (
  id text primary key,
  person_id text not null unique,
  active boolean not null default true,
  name text not null default '',
  name_ar text not null default '',
  designated_by text,
  designated_on date not null,
  history jsonb not null default '[]'::jsonb
);
comment on table kafaa_sat_analysts is '[M26] Training staff designated as SAT analysts by the training manager: they may set task future attributes (FS06)';

do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_jta_task_skills_task_id_fk') then alter table kafaa_jta_task_skills add constraint kafaa_jta_task_skills_task_id_fk foreign key (task_id) references kafaa_jta_tasks(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_jta_task_skills_skill_id_fk') then alter table kafaa_jta_task_skills add constraint kafaa_jta_task_skills_skill_id_fk foreign key (skill_id) references kafaa_skills(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_sat_analysts_person_id_fk') then alter table kafaa_sat_analysts add constraint kafaa_sat_analysts_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_jta_task_skills_task_id_idx on kafaa_jta_task_skills (task_id);
create index if not exists kafaa_jta_task_skills_skill_id_idx on kafaa_jta_task_skills (skill_id);
create index if not exists kafaa_ai_capability_levels_dimension_idx on kafaa_ai_capability_levels (dimension);
create index if not exists kafaa_ai_exposure_refs_benchmark_id_idx on kafaa_ai_exposure_refs (benchmark_id);

-- ───────────── RLS (per-statement form): training staff and auditors (sat R/W/A) read; writes only via RPCs
alter table kafaa_jta_task_skills enable row level security;
alter table kafaa_ai_capability_levels enable row level security;
alter table kafaa_ai_exposure_refs enable row level security;
alter table kafaa_sat_analysts enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_jta_task_skills' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_jta_task_skills for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_ai_capability_levels' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_ai_capability_levels for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_ai_exposure_refs' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_ai_exposure_refs for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_sat_analysts' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_sat_analysts for select to anon, authenticated using (false)'; end if;
end $$;
alter policy kafaa_read on kafaa_jta_task_skills using ((((SELECT kafaa_has_grant('sat'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_ai_capability_levels using ((((SELECT kafaa_has_grant('sat'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_ai_exposure_refs using ((((SELECT kafaa_has_grant('sat'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_sat_analysts using ((((SELECT kafaa_has_grant('sat'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
revoke insert, update, delete on kafaa_jta_task_skills, kafaa_ai_capability_levels, kafaa_ai_exposure_refs, kafaa_sat_analysts from anon, authenticated;
grant select on kafaa_jta_task_skills, kafaa_ai_capability_levels, kafaa_ai_exposure_refs, kafaa_sat_analysts to anon, authenticated;

-- ───────────── Restricted tasks: never a title, never a future rating, never a skill link
create or replace function kafaa_sat_task_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if new.restricted then
    new.title_en := 'Restricted task — managed outside Kafa''a'; new.title_ar := 'مهمة مقيدة — تُدار خارج كفاءة'; new.duty_en := ''; new.duty_ar := '';
    new.ai_capability_needed := null; new.exposure := null; new.change_horizon := null; new.tech_driver := null; new.future_by := null; new.future_on := null;
  end if;
  return new;
end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_jta_tasks_future_restricted_ck') then
  alter table kafaa_jta_tasks add constraint kafaa_jta_tasks_future_restricted_ck
    check (not restricted or (ai_capability_needed is null and exposure is null and change_horizon is null and tech_driver is null)); end if; end $$;
create or replace function kafaa_fx_task_skill_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if exists (select 1 from kafaa_jta_tasks t where t.id = new.task_id and t.restricted) then
    raise exception 'Restricted task: security, safeguards and cyber tasks are managed outside Kafa''a';
  end if;
  return new;
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'kafaa_fx_task_skill_guard') then
    create trigger kafaa_fx_task_skill_guard before insert or update on kafaa_jta_task_skills for each row execute function kafaa_fx_task_skill_guard();
  end if;
end $$;

-- ───────────── Internal helpers (not executable by API roles). Mirror of src/modules/m26/future.ts.
create or replace function kafaa_fx_dims() returns text[] language sql immutable set search_path = public as $$
  select array['language', 'social', 'problem_solving', 'creativity', 'metacognition', 'learning_memory', 'vision', 'manipulation', 'robotic']
$$;
create or replace function kafaa_fx_dim_label(p_dim text) returns jsonb language sql immutable set search_path = public as $$
  select case p_dim
    when 'language' then jsonb_build_object('en', 'Language', 'ar', 'اللغة')
    when 'social' then jsonb_build_object('en', 'Social interaction', 'ar', 'التفاعل الاجتماعي')
    when 'problem_solving' then jsonb_build_object('en', 'Problem solving', 'ar', 'حل المشكلات')
    when 'creativity' then jsonb_build_object('en', 'Creativity', 'ar', 'الإبداع')
    when 'metacognition' then jsonb_build_object('en', 'Metacognition and critical thinking', 'ar', 'ما وراء المعرفة والتفكير النقدي')
    when 'learning_memory' then jsonb_build_object('en', 'Knowledge, learning and memory', 'ar', 'المعرفة والتعلّم والذاكرة')
    when 'vision' then jsonb_build_object('en', 'Vision', 'ar', 'الرؤية')
    when 'manipulation' then jsonb_build_object('en', 'Manipulation', 'ar', 'المعالجة اليدوية')
    when 'robotic' then jsonb_build_object('en', 'Robotic intelligence', 'ar', 'الذكاء الروبوتي')
  end
$$;
create or replace function kafaa_fx_horizon_label(p_h text) returns jsonb language sql immutable set search_path = public as $$
  select case p_h when 'now' then jsonb_build_object('en', 'now', 'ar', 'الآن') else jsonb_build_object('en', p_h, 'ar', p_h) end
$$;
-- validNeeds(): 1-4 known task dimensions, whole-number levels 1..5, no other keys
create or replace function kafaa_fx_valid_needs(p jsonb) returns boolean language plpgsql immutable set search_path = public as $$
declare e record; n int := 0; v numeric;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return false; end if;
  for e in select key, value from jsonb_each(p) loop
    n := n + 1;
    if e.key <> all(kafaa_fx_dims()) or jsonb_typeof(e.value) <> 'number' then return false; end if;
    v := (e.value #>> '{}')::numeric;
    if v <> trunc(v) or v < 1 or v > 5 then return false; end if;
  end loop;
  return n between 1 and 4;
end $$;
create or replace function kafaa_fx_canon_needs(p jsonb) returns jsonb language sql immutable set search_path = public as $$
  select coalesce(jsonb_object_agg(e.key, ((e.value #>> '{}')::numeric)::int), '{}'::jsonb) from jsonb_each(p) e
$$;
-- exposureOf(): null for restricted or unrated tasks
create or replace function kafaa_fx_exposure(p_needs jsonb, p_h text, p_critical boolean, p_restricted boolean) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare d text; v_need int; v_ai int; cov text[] := '{}'; gap text[] := '{}'; per jsonb := '[]'::jsonb; k int; n int; ex text; br text; head jsonb;
begin
  if p_restricted then return null; end if;
  if not kafaa_fx_valid_needs(p_needs) or p_h is null or p_h not in ('now', '2030', '2035') then return null; end if;
  foreach d in array kafaa_fx_dims() loop
    if p_needs ? d then
      v_need := ((p_needs->d) #>> '{}')::numeric::int;
      v_ai := coalesce((select l.level from kafaa_ai_capability_levels l where l.dimension = d and l.horizon = p_h order by l.sort, l.id collate "C" limit 1), 0);
      if v_ai >= v_need then
        cov := cov || d; per := per || jsonb_build_array(kafaa_sat_reason('fx_dim_covered', jsonb_build_object('dim', kafaa_fx_dim_label(d), 'need', v_need, 'ai', v_ai)));
      else
        gap := gap || d; per := per || jsonb_build_array(kafaa_sat_reason('fx_dim_gap', jsonb_build_object('dim', kafaa_fx_dim_label(d), 'need', v_need, 'ai', v_ai)));
      end if;
    end if;
  end loop;
  k := cardinality(cov); n := k + cardinality(gap);
  if 2 * k < n then ex := 'human_core'; br := 'below_half'; head := kafaa_sat_reason('fx_human_core', jsonb_build_object('k', k, 'n', n));
  elsif k = n and p_critical then ex := 'augment'; br := 'critical_all'; head := kafaa_sat_reason('fx_critical_keep', jsonb_build_object('n', n));
  elsif k = n then ex := 'automate_partly'; br := 'all_covered'; head := kafaa_sat_reason('fx_all_covered', jsonb_build_object('n', n));
  else ex := 'augment'; br := 'some_covered'; head := kafaa_sat_reason('fx_some_covered', jsonb_build_object('k', k, 'n', n));
  end if;
  return jsonb_build_object('exposure', ex, 'augmentable', ex <> 'human_core', 'branch', br, 'covered', to_jsonb(cov), 'gaps', to_jsonb(gap),
    'reasons', jsonb_build_array(head) || per || jsonb_build_array(kafaa_sat_reason('fx_horizon', jsonb_build_object('horizon', kafaa_fx_horizon_label(p_h)))));
end $$;
-- the future attributes of a task as logged in the SAT change log (before / after)
create or replace function kafaa_fx_snapshot(p_task text) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('needs', t.ai_capability_needed, 'exposure', t.exposure, 'change_horizon', t.change_horizon, 'tech_driver', t.tech_driver,
    'skills', coalesce((select jsonb_agg(s.skill_id || ':' || s.level || ':' || s.kind order by s.sort, s.skill_id collate "C") from kafaa_jta_task_skills s where s.task_id = t.id and s.active), '[]'::jsonb),
    'title_en', t.title_en, 'title_ar', t.title_ar)
  from kafaa_jta_tasks t where t.id = p_task
$$;
create or replace function kafaa_fx_can_write() returns boolean language sql stable security definer set search_path = public as $$
  select kafaa_has_grant('sat', array['A']) or (kafaa_has_grant('sat', array['W']) and exists (select 1 from kafaa_sat_analysts a where a.person_id = kafaa_me() and a.active))
$$;

-- ───────────── RPC: set a task's future attributes (training manager or designated SAT analyst)
create or replace function kafaa_set_task_future(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; v_tid text := kafaa_sat_str(p, 'task_id'); t kafaa_jta_tasks; v_needs jsonb := p->'needs'; v_h text; v_dr text; v_sk jsonb := p->'skills';
  x jsonb; v_seen text[] := '{}'; v_sid text; v_kind text; v_lv numeric; v_note text := kafaa_sat_str(p, 'note'); sk kafaa_skills; ex jsonb; v_before jsonb; v_after jsonb; v_cid text; i int := 0;
  a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('sat.task.future', 'jta_tasks', nullif(v_tid, ''), 'not_signed_in', 'Sign in to use the SAT workbench'); end if;
  if not kafaa_fx_can_write() then return kafaa_refuse('sat.task.future', 'jta_tasks', nullif(v_tid, ''), 'forbidden', 'Only the training manager or a designated SAT analyst can set a task''s future attributes'); end if;
  v_role := kafaa_acting_role('sat', case when kafaa_has_grant('sat', array['A']) then array['A'] else array['W'] end);
  select * into t from kafaa_jta_tasks where id = v_tid;
  if t.id is null then return kafaa_refuse('sat.task.future', 'jta_tasks', nullif(v_tid, ''), 'not_found', 'Task not found', v_role); end if;
  if t.restricted then return kafaa_refuse('sat.task.future', 'jta_tasks', v_tid, 'restricted', 'Restricted task: security, safeguards and cyber tasks are managed outside Kafa''a', v_role); end if;
  if t.status <> 'active' then return kafaa_refuse('sat.task.future', 'jta_tasks', v_tid, 'invalid', 'This task is retired', v_role); end if;
  if not kafaa_fx_valid_needs(v_needs) then return kafaa_refuse('sat.task.future', 'jta_tasks', v_tid, 'invalid', 'Rate 1 to 4 OECD capability dimensions, each once, with a whole-number level from 1 to 5', v_role); end if;
  v_h := case when jsonb_typeof(p->'change_horizon') = 'string' then p->>'change_horizon' end;
  if v_h is null or v_h not in ('now', '2030', '2035') then return kafaa_refuse('sat.task.future', 'jta_tasks', v_tid, 'invalid', 'Choose a change horizon: now, 2030 or 2035', v_role); end if;
  v_dr := case when jsonb_typeof(p->'tech_driver') = 'string' then p->>'tech_driver' end;
  if v_dr is null or v_dr not in ('ai_assist', 'digital_ic', 'robotics', 'digital_twin', 'smr_design', 'none') then return kafaa_refuse('sat.task.future', 'jta_tasks', v_tid, 'invalid', 'Choose a technology driver', v_role); end if;
  if v_sk is null or jsonb_typeof(v_sk) <> 'array' or jsonb_array_length(v_sk) < 1 or jsonb_array_length(v_sk) > 6 then
    return kafaa_refuse('sat.task.future', 'jta_tasks', v_tid, 'invalid', 'Link 1 to 6 skills, each once, with a whole-number level from 1 to 4', v_role); end if;
  for x in select e.value from jsonb_array_elements(v_sk) with ordinality e(value, n) order by e.n loop
    v_sid := case when jsonb_typeof(x->'skill_id') = 'string' then x->>'skill_id' else '' end;
    v_kind := case when x->'kind' is null or jsonb_typeof(x->'kind') = 'null' then 'current' when jsonb_typeof(x->'kind') = 'string' then x->>'kind' else '#' end;
    v_lv := case when jsonb_typeof(x->'level') = 'number' then (x->>'level')::numeric end;
    if v_sid = '' or v_sid = any(v_seen) or v_lv is null or v_lv <> trunc(v_lv) or v_lv < 1 or v_lv > 4 or v_kind not in ('current', 'future') then
      return kafaa_refuse('sat.task.future', 'jta_tasks', v_tid, 'invalid', 'Link 1 to 6 skills, each once, with a whole-number level from 1 to 4', v_role); end if;
    v_seen := v_seen || v_sid;
  end loop;
  foreach v_sid in array v_seen loop
    select * into sk from kafaa_skills where id = v_sid;
    if sk.id is null then return kafaa_refuse('sat.task.future', 'jta_tasks', v_tid, 'not_found', 'Skill not found', v_role); end if;
    if sk.area = 'security' then return kafaa_refuse('sat.task.future', 'jta_tasks', v_tid, 'restricted', 'Security skills are never linked to SAT tasks', v_role); end if;
  end loop;
  if length(v_note) > 500 then return kafaa_refuse('sat.task.future', 'jta_tasks', v_tid, 'invalid', 'Keep the note under 500 characters', v_role); end if;
  v_needs := kafaa_fx_canon_needs(v_needs);
  ex := kafaa_fx_exposure(v_needs, v_h, t.critical, false);
  v_before := kafaa_fx_snapshot(v_tid);
  update kafaa_jta_tasks set ai_capability_needed = v_needs, exposure = ex->>'exposure', change_horizon = v_h, tech_driver = v_dr, future_by = me, future_on = current_date, changed_at = now() where id = v_tid;
  update kafaa_jta_task_skills set active = false, linked_by = me, linked_at = now() where task_id = v_tid and active and skill_id <> all(v_seen);
  for x in select e.value from jsonb_array_elements(v_sk) with ordinality e(value, n) order by e.n loop
    i := i + 1;
    insert into kafaa_jta_task_skills (id, task_id, skill_id, level, kind, source, active, linked_by, linked_at, sort)
    values ('jts:' || v_tid || ':' || (x->>'skill_id'), v_tid, x->>'skill_id', (x->>'level')::numeric::int, coalesce(case when jsonb_typeof(x->'kind') = 'string' then x->>'kind' end, 'current'), 'analyst', true, me, now(), i)
    on conflict (id) do update set level = excluded.level, kind = excluded.kind, source = 'analyst', active = true, linked_by = me, linked_at = now(), sort = excluded.sort;
  end loop;
  v_after := kafaa_fx_snapshot(v_tid);
  v_cid := kafaa_sat_rid('sc');
  insert into kafaa_sat_changes (id, task_id, role_id, kind, trigger, area, summary, before, after, impact, status, opened_by, opened_by_name, opened_by_name_ar, opened_at, closed_at)
  values (v_cid, v_tid, t.role_id, 'modified', 'task_change', 'future',
    case when v_note <> '' then v_note else format('Future attributes: %s by %s, driver %s', ex->>'exposure', v_h, v_dr) end,
    v_before, v_after, '{}'::jsonb, 'closed', me, kafaa_sat_name(me, false), kafaa_sat_name(me, true), now(), now());
  a := kafaa_audit('sat.task.future', 'jta_tasks', v_tid, 'ok', format('%s %s %s', ex->>'exposure', v_h, v_dr), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Future attributes saved', a, null,
    jsonb_build_object('exposure', ex->>'exposure', 'augmentable', (ex->>'augmentable')::boolean, 'reasons', ex->'reasons', 'change_id', v_cid));
end $$;

-- ───────────── RPC: the task layer (sat R); restricted tasks are never returned
create or replace function kafaa_task_future(p_role text default null) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); v_a boolean;
begin
  if me is null or not kafaa_has_grant('sat', array['R', 'W', 'A']) then return null; end if;
  v_a := kafaa_has_grant('sat', array['A']);
  return jsonb_build_object(
    'can_write', kafaa_fx_can_write(), 'can_designate', v_a,
    'tasks', coalesce((select jsonb_agg(jsonb_build_object(
        'id', t.id, 'role_id', t.role_id, 'code', t.code, 'title_en', t.title_en, 'title_ar', t.title_ar, 'critical', t.critical, 'decision', t.decision, 'source', t.source,
        'needs', t.ai_capability_needed, 'exposure', t.exposure, 'augmentable', ex.j->'augmentable', 'change_horizon', t.change_horizon, 'tech_driver', t.tech_driver,
        'future_on', to_char(t.future_on, 'YYYY-MM-DD'), 'reasons', coalesce(ex.j->'reasons', '[]'::jsonb),
        'skills', coalesce((select jsonb_agg(jsonb_build_object('skill_id', s.skill_id, 'level', s.level, 'kind', s.kind, 'source', s.source) order by s.sort, s.skill_id collate "C")
          from kafaa_jta_task_skills s where s.task_id = t.id and s.active), '[]'::jsonb))
        order by t.role_id collate "C", t.sort, t.id collate "C")
      from kafaa_jta_tasks t cross join lateral (select kafaa_fx_exposure(t.ai_capability_needed, t.change_horizon, t.critical, false) as j) ex
      where not t.restricted and t.status = 'active' and (nullif(p_role, '') is null or t.role_id = p_role)), '[]'::jsonb),
    'analysts', coalesce((select jsonb_agg(jsonb_build_object('person_id', a.person_id, 'name', a.name, 'name_ar', a.name_ar, 'active', a.active, 'designated_on', to_char(a.designated_on, 'YYYY-MM-DD'))
      order by a.person_id collate "C") from kafaa_sat_analysts a), '[]'::jsonb),
    'candidates', case when v_a then coalesce((select jsonb_agg(jsonb_build_object('person_id', x.pid, 'name', kafaa_sat_name(x.pid, false), 'name_ar', kafaa_sat_name(x.pid, true)) order by x.pid collate "C")
      from (select distinct r.person_id as pid from kafaa_role_assignments r where r.role = 'instructor' and r.status = 'active' and r.person_id <> me) x), '[]'::jsonb) else '[]'::jsonb end);
end $$;

-- ───────────── RPC: the training manager designates (or withdraws) an instructor as SAT analyst (ledger)
create or replace function kafaa_designate_sat_analyst(p_person text, p_active boolean default true) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_pid text := btrim(coalesce(p_person, '')); v_want boolean := coalesce(p_active, true); cur kafaa_sat_analysts; v_hist jsonb; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('sat.analyst.designate', 'sat_analysts', nullif(v_pid, ''), 'not_signed_in', 'Sign in to use the SAT workbench'); end if;
  if not kafaa_has_grant('sat', array['A']) then return kafaa_refuse('sat.analyst.designate', 'sat_analysts', nullif(v_pid, ''), 'forbidden', 'Only the training manager designates SAT analysts'); end if;
  v_role := kafaa_acting_role('sat', array['A']);
  if not exists (select 1 from kafaa_people where id = v_pid) then return kafaa_refuse('sat.analyst.designate', 'sat_analysts', nullif(v_pid, ''), 'not_found', 'Person not found', v_role); end if;
  if v_pid = me then return kafaa_refuse('sat.analyst.designate', 'sat_analysts', v_pid, 'invalid', 'Designate another member of training staff', v_role); end if;
  if v_want and not exists (select 1 from kafaa_role_assignments r where r.person_id = v_pid and r.role = 'instructor' and r.status = 'active') then
    return kafaa_refuse('sat.analyst.designate', 'sat_analysts', v_pid, 'invalid', 'Only training staff (instructors) can be designated SAT analysts', v_role); end if;
  select * into cur from kafaa_sat_analysts where person_id = v_pid;
  if coalesce(cur.active, false) = v_want then return kafaa_refuse('sat.analyst.designate', 'sat_analysts', v_pid, 'no_change', 'Nothing to change: the designation is already in that state', v_role); end if;
  v_hist := coalesce(cur.history, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('at', now(), 'by', me, 'active', v_want));
  if cur.id is not null then
    update kafaa_sat_analysts set active = v_want, designated_by = me, designated_on = current_date, history = v_hist, name = kafaa_sat_name(v_pid, false), name_ar = kafaa_sat_name(v_pid, true) where id = cur.id;
  else
    insert into kafaa_sat_analysts (id, person_id, active, name, name_ar, designated_by, designated_on, history)
    values ('sa-' || v_pid, v_pid, v_want, kafaa_sat_name(v_pid, false), kafaa_sat_name(v_pid, true), me, current_date, v_hist);
  end if;
  l := kafaa_ledger('kafaa.sat.analyst_designate', v_pid || case when v_want then ' designated' else ' withdrawn' end || ' as SAT analyst');
  a := kafaa_audit('sat.analyst.designate', 'sat_analysts', v_pid, 'ok', case when v_want then 'designated' else 'withdrawn' end, case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when v_want then 'SAT analyst designated' else 'SAT analyst designation withdrawn' end, a, l, jsonb_build_object('person_id', v_pid, 'active', v_want));
end $$;

-- ───────────── Grants: internal helpers are not executable by API roles; RPCs only by signed-in users.
revoke all on function kafaa_sat_task_guard(), kafaa_fx_task_skill_guard(), kafaa_fx_dims(), kafaa_fx_dim_label(text), kafaa_fx_horizon_label(text), kafaa_fx_valid_needs(jsonb),
  kafaa_fx_canon_needs(jsonb), kafaa_fx_exposure(jsonb, text, boolean, boolean), kafaa_fx_snapshot(text), kafaa_fx_can_write() from public, anon, authenticated;
revoke all on function kafaa_set_task_future(jsonb), kafaa_task_future(text), kafaa_designate_sat_analyst(text, boolean) from public, anon;
grant execute on function kafaa_set_task_future(jsonb), kafaa_task_future(text), kafaa_designate_sat_analyst(text, boolean) to authenticated;
