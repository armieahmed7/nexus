-- kafaa_fs85_student_starter_p1 (1/1) · from supabase/migrations/20261010285001_kafaa_fs85_student_starter.sql
-- Apply with apply_migration name "kafaa_fs85_student_starter_p1". Additive and idempotent; kafaa_* objects only.
-- [FS wave H · E5 · FS77] Student future-skills starter and intake baselines (M06 Talent pipeline and student journey).
-- Public: kafaa_starter_lessons (AI-literacy starter and SMR orientation lessons, each fact with an https source and an as-of date, a
--   non-scoring self-check; SMR text carries no site, headcount or deployment claim) and kafaa_induction_modules (the induction catalogue;
--   mandatory nuclear and company modules are never skipped). Anonymous visitors store nothing: the starter is static content.
-- HR (workforce_strategy W): kafaa_intake_baselines (versioned intake-year baselines: held, partly held or not held per module, with
--   the basis; published rows are public, drafts readable by HR, admin, auditors and training staff) through kafaa_save_intake_baseline,
--   and kafaa_induction_plans (one plan per joiner, read from the baseline for the joiner's intake year: the programme's baseline first,
--   then the all-programmes one; none = full induction) through kafaa_build_induction_plan. kafaa_induction_joiners lists who HR can plan for.
-- kafaa_ib_* / kafaa_ip_* = src/modules/m06/starter.ts; PGlite parity: scripts/validate/fs85-student-starter.mjs.
-- Writes into another module's table only through these SECURITY DEFINER functions: M14 kafaa_notifications (kind induction).
-- No skill evidence, no shared function redefinition. Reads: people, applications.
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.

-- ───────────── Tables (generated DDL, additive)
create table if not exists kafaa_induction_modules (
  id text primary key,
  sort integer not null default 0,
  area text not null check (area in ('ai', 'digital', 'cyber', 'energy', 'smr', 'safety', 'radiation', 'site', 'company')),
  title_en text not null,
  title_ar text not null,
  summary_en text not null,
  summary_ar text not null,
  hours numeric not null,
  refresh_hours numeric not null default 0,
  mandatory boolean not null default false,
  skill_ids text[] not null default '{}'::text[],
  listed boolean not null default true
);
comment on table kafaa_induction_modules is '[M06] Induction catalogue for new joiners: hours, refresher hours and whether the module is mandatory (public) (FS77)';
create table if not exists kafaa_starter_lessons (
  id text primary key,
  track text not null check (track in ('ai', 'smr')),
  sort integer not null default 0,
  title_en text not null,
  title_ar text not null,
  summary_en text not null,
  summary_ar text not null,
  points jsonb not null default '[]'::jsonb,
  self_check jsonb not null default '{}'::jsonb,
  links jsonb not null default '[]'::jsonb,
  induction_module_id text,
  sources jsonb not null default '[]'::jsonb,
  as_of date not null,
  listed boolean not null default true
);
comment on table kafaa_starter_lessons is '[M06] Student future-skills starter: AI-literacy and SMR orientation lessons with sourced points and a non-scoring self-check (public) (FS77)';
create table if not exists kafaa_intake_baselines (
  id text primary key,
  intake_year integer not null,
  programme text not null check (programme in ('all', 'dnt', 'energy-pioneers', 'gdp', 'gpo', 'direct')),
  version integer not null default 1,
  status text not null check (status in ('draft', 'published', 'superseded')),
  entries jsonb not null default '[]'::jsonb,
  note_en text not null default '',
  note_ar text not null default '',
  set_by text,
  set_at timestamptz not null default now(),
  published_by text,
  published_at timestamptz,
  listed boolean not null default false,
  sample boolean not null default true
);
comment on table kafaa_intake_baselines is '[M06] Intake-year baseline set by HR: induction modules the joiners of one intake already hold, partly hold or do not hold, with the basis (versioned; public when published) (FS77)';
create table if not exists kafaa_induction_plans (
  id text primary key,
  person_id text not null unique,
  person_name text not null default '',
  programme text not null check (programme in ('dnt', 'energy-pioneers', 'gdp', 'gpo', 'direct')),
  intake_year integer not null,
  baseline_id text,
  baseline_version integer,
  items jsonb not null default '[]'::jsonb,
  hours_total numeric not null default 0,
  hours_planned numeric not null default 0,
  hours_saved numeric not null default 0,
  revision integer not null default 1,
  built_by text,
  built_at timestamptz not null default now(),
  sample boolean not null default true
);
comment on table kafaa_induction_plans is '[M06] Induction plan of one joiner, read from the baseline for their intake year: full, refresher or skip per module, with the hours saved (FS77)';
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_starter_lessons_induction_module_id_fk') then alter table kafaa_starter_lessons add constraint kafaa_starter_lessons_induction_module_id_fk foreign key (induction_module_id) references kafaa_induction_modules(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_induction_plans_person_id_fk') then alter table kafaa_induction_plans add constraint kafaa_induction_plans_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_induction_plans_baseline_id_fk') then alter table kafaa_induction_plans add constraint kafaa_induction_plans_baseline_id_fk foreign key (baseline_id) references kafaa_intake_baselines(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_starter_lessons_track_idx on kafaa_starter_lessons (track);
create index if not exists kafaa_starter_lessons_induction_module_id_idx on kafaa_starter_lessons (induction_module_id);
create index if not exists kafaa_intake_baselines_intake_year_idx on kafaa_intake_baselines (intake_year);
create index if not exists kafaa_intake_baselines_status_idx on kafaa_intake_baselines (status);
create index if not exists kafaa_induction_plans_intake_year_idx on kafaa_induction_plans (intake_year);
create index if not exists kafaa_induction_plans_baseline_id_idx on kafaa_induction_plans (baseline_id);

-- ───────────── RLS (generated rule; created once, then the per-statement form of the RLS performance pass)
do $$ begin
  execute 'alter table kafaa_starter_lessons enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_starter_lessons' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_starter_lessons for select to anon, authenticated using (kafaa_rule_read(''talent_content'', null::text, null::text, listed))'; end if;
  execute 'alter table kafaa_induction_modules enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_induction_modules' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_induction_modules for select to anon, authenticated using (kafaa_rule_read(''talent_content'', null::text, null::text, listed))'; end if;
  execute 'alter table kafaa_intake_baselines enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_intake_baselines' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_intake_baselines for select to anon, authenticated using (kafaa_rule_read(''talent_content'', null::text, null::text, listed) or kafaa_rule_read(''workforce_strategy'', null::text, null::text, true) or kafaa_rule_read(''sat'', null::text, null::text, true))'; end if;
  execute 'alter table kafaa_induction_plans enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_induction_plans' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_induction_plans for select to anon, authenticated using (kafaa_rule_read(''own_profile'', person_id, null::text, true) or kafaa_rule_read(''workforce_strategy'', null::text, null::text, true) or kafaa_rule_read(''sat'', null::text, null::text, true))'; end if;
end $$;
alter policy kafaa_read on kafaa_starter_lessons using (((COALESCE(listed, false) AND (SELECT kafaa_has_grant('talent_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_induction_modules using (((COALESCE(listed, false) AND (SELECT kafaa_has_grant('talent_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_intake_baselines using ((((COALESCE(listed, false) AND (SELECT kafaa_has_grant('talent_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))) OR (((SELECT kafaa_has_grant('workforce_strategy'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))) OR (((SELECT kafaa_has_grant('sat'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))))));
alter policy kafaa_read on kafaa_induction_plans using (((((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false))) OR (((SELECT kafaa_has_grant('workforce_strategy'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))) OR (((SELECT kafaa_has_grant('sat'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))))));
revoke all on kafaa_starter_lessons, kafaa_induction_modules, kafaa_intake_baselines, kafaa_induction_plans from anon, authenticated;
grant select on kafaa_starter_lessons, kafaa_induction_modules, kafaa_intake_baselines, kafaa_induction_plans to anon, authenticated;

-- ───────────── FS77 rules (mirror of src/modules/m06/starter.ts)
create or replace function kafaa_ib_trim(p text) returns text language sql immutable set search_path = public as $$
  select regexp_replace(coalesce(p, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g')
$$;
-- strLen(v, max): absent or JSON null, or a string whose trimmed length is at most max
create or replace function kafaa_ib_len_ok(v jsonb, p_max integer) returns boolean language sql immutable set search_path = public as $$
  select case when v is null or jsonb_typeof(v) = 'null' then true
              when jsonb_typeof(v) = 'string' then char_length(kafaa_ib_trim(v #>> '{}')) <= p_max else false end
$$;
-- an integer JSON number within [lo, hi]
create or replace function kafaa_ib_int_between(v jsonb, lo integer, hi integer) returns boolean language sql immutable set search_path = public as $$
  select jsonb_typeof(v) = 'number' and (v #>> '{}')::numeric = floor((v #>> '{}')::numeric) and (v #>> '{}')::numeric between lo and hi
$$;
-- refusal messages (= IB_MSG)
create or replace function kafaa_ib_msg(p_code text) returns text language sql immutable set search_path = public as $$
  select case p_code
    when 'year' then 'Give an intake year between 2020 and 2035'
    when 'programme' then 'Choose all programmes or one entry programme'
    when 'entries' then 'List at least one induction module, each once'
    when 'module' then 'Every entry names a listed induction module'
    when 'duplicate' then 'Each induction module appears once'
    when 'status' then 'Each entry is held, partly held or not held'
    when 'basis' then 'A held or partly held module needs its basis (national curriculum, programme curriculum or intake diagnostic)'
    when 'mandatory' then 'Mandatory nuclear modules are never skipped or shortened by a baseline'
    when 'source' then 'A national-curriculum basis cites an https source'
    when 'note' then 'Notes are at most 300 characters per entry and 600 for the baseline'
    when 'person' then 'Choose a joiner (an applicant or a member of staff)'
    else p_code end
$$;
-- baselineProblem(): first problem code of a baseline draft, null when valid (entries checked in order)
create or replace function kafaa_ib_problem(p jsonb) returns text language plpgsql stable security definer set search_path = public as $$
declare v_n integer; e jsonb; v_seen text[] := '{}'; v_mand boolean;
begin
  p := coalesce(p, '{}'::jsonb);
  if jsonb_typeof(p) <> 'object' then p := '{}'::jsonb; end if;
  if not coalesce(kafaa_ib_int_between(p -> 'intake_year', 2020, 2035), false) then return 'year'; end if;
  if jsonb_typeof(p -> 'programme') is distinct from 'string' or not (p ->> 'programme' = any(array['all', 'dnt', 'energy-pioneers', 'gdp', 'gpo', 'direct'])) then return 'programme'; end if;
  select count(*) into v_n from kafaa_induction_modules where listed is not false;
  if jsonb_typeof(p -> 'entries') is distinct from 'array' or jsonb_array_length(p -> 'entries') < 1 or jsonb_array_length(p -> 'entries') > v_n then return 'entries'; end if;
  for e in select x from jsonb_array_elements(p -> 'entries') with ordinality a(x, n) order by n loop
    if jsonb_typeof(e) <> 'object' or jsonb_typeof(e -> 'module_id') is distinct from 'string' then return 'module'; end if;
    select m.mandatory into v_mand from kafaa_induction_modules m where m.id = e ->> 'module_id' and m.listed is not false;
    if not found then return 'module'; end if;
    if (e ->> 'module_id') = any(v_seen) then return 'duplicate'; end if;
    v_seen := v_seen || (e ->> 'module_id');
    if jsonb_typeof(e -> 'status') is distinct from 'string' or not (e ->> 'status' = any(array['held', 'partial', 'not_held'])) then return 'status'; end if;
    if jsonb_typeof(e -> 'basis') is distinct from 'string' or not (e ->> 'basis' = any(array['national_curriculum', 'programme_curriculum', 'intake_diagnostic', 'none'])) then return 'basis'; end if;
    if v_mand and e ->> 'status' <> 'not_held' then return 'mandatory'; end if;
    if e ->> 'status' <> 'not_held' and e ->> 'basis' = 'none' then return 'basis'; end if;
    if e -> 'source_url' is not null and jsonb_typeof(e -> 'source_url') <> 'null'
       and (jsonb_typeof(e -> 'source_url') <> 'string' or (e ->> 'source_url') !~ '^https://[^[:space:]]+$') then return 'source'; end if;
    if e ->> 'basis' = 'national_curriculum' and (e -> 'source_url' is null or jsonb_typeof(e -> 'source_url') = 'null') then return 'source'; end if;
    if not kafaa_ib_len_ok(e -> 'note_en', 300) or not kafaa_ib_len_ok(e -> 'note_ar', 300) then return 'note'; end if;
  end loop;
  if not kafaa_ib_len_ok(p -> 'note_en', 600) or not kafaa_ib_len_ok(p -> 'note_ar', 600) then return 'note'; end if;
  return null;
end $$;
-- cleanEntries(): stored form, in induction-module order
create or replace function kafaa_ib_clean(p_entries jsonb) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('module_id', e ->> 'module_id', 'status', e ->> 'status', 'basis', e ->> 'basis',
           'source_url', case when jsonb_typeof(e -> 'source_url') = 'string' then e -> 'source_url' else 'null'::jsonb end,
           'note_en', case when jsonb_typeof(e -> 'note_en') = 'string' then kafaa_ib_trim(e ->> 'note_en') else '' end,
           'note_ar', case when jsonb_typeof(e -> 'note_ar') = 'string' then kafaa_ib_trim(e ->> 'note_ar') else '' end)
         order by coalesce(m.rk, 999), a.n), '[]'::jsonb)
    from jsonb_array_elements(case when jsonb_typeof(p_entries) = 'array' then p_entries else '[]'::jsonb end) with ordinality a(e, n)
    left join (select id, row_number() over (order by sort, id collate "C") - 1 rk from kafaa_induction_modules where listed is not false) m on m.id = e ->> 'module_id'
$$;
-- baselineFor(): the published baseline for an intake year: the programme's highest version, else the "all programmes" one
create or replace function kafaa_ib_for(p_year integer, p_programme text) returns kafaa_intake_baselines language plpgsql stable security definer set search_path = public as $$
declare b kafaa_intake_baselines;
begin
  if p_programme is distinct from 'all' then
    select * into b from kafaa_intake_baselines where status = 'published' and intake_year = p_year and programme = p_programme order by version desc limit 1;
    if found then return b; end if;
  end if;
  select * into b from kafaa_intake_baselines where status = 'published' and intake_year = p_year and programme = 'all' order by version desc limit 1;
  return b;
end $$;
-- inductionPlan(): full, refresher or skip per listed module from the baseline (null id = no published baseline = full induction)
create or replace function kafaa_ip_compute(p_base kafaa_intake_baselines) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare m record; e jsonb; v_items jsonb := '[]'::jsonb; v_total numeric := 0; v_planned numeric := 0; v_pl numeric; v_act text; v_reason text; v_basis jsonb;
begin
  for m in select * from kafaa_induction_modules where listed is not false order by sort, id collate "C" loop
    e := null;
    if p_base.id is not null then
      select x into e from jsonb_array_elements(case when jsonb_typeof(p_base.entries) = 'array' then p_base.entries else '[]'::jsonb end) x where x ->> 'module_id' = m.id limit 1;
    end if;
    v_basis := 'null'::jsonb; v_act := 'full'; v_pl := m.hours;
    if m.mandatory then v_reason := 'mandatory';
    elsif p_base.id is null then v_reason := 'no_baseline';
    elsif e is null then v_reason := 'no_entry';
    elsif e ->> 'status' = 'held' then v_act := 'skip'; v_pl := 0; v_reason := 'held'; v_basis := coalesce(e -> 'basis', 'null'::jsonb);
    elsif e ->> 'status' = 'partial' then v_act := 'refresher'; v_pl := least(m.refresh_hours, m.hours); v_reason := 'partial'; v_basis := coalesce(e -> 'basis', 'null'::jsonb);
    else v_reason := 'not_held'; v_basis := coalesce(e -> 'basis', 'null'::jsonb); end if;
    v_items := v_items || jsonb_build_array(jsonb_build_object('module_id', m.id, 'action', v_act, 'hours', trim_scale(m.hours), 'planned_hours', trim_scale(v_pl), 'reason', v_reason, 'basis', v_basis));
    v_total := v_total + m.hours; v_planned := v_planned + v_pl;
  end loop;
  return jsonb_build_object('baseline_id', p_base.id, 'baseline_version', p_base.version, 'items', v_items,
    'hours_total', trim_scale(v_total), 'hours_planned', trim_scale(v_planned), 'hours_saved', trim_scale(v_total - v_planned));
end $$;
-- planProblem(): person, programme, year
create or replace function kafaa_ip_problem(p jsonb, p_kind text) returns text language sql immutable set search_path = public as $$
  select case
    when p_kind is null or not (p_kind = any(array['staff', 'applicant'])) then 'person'
    when jsonb_typeof(p -> 'programme') is distinct from 'string' or not (p ->> 'programme' = any(array['dnt', 'energy-pioneers', 'gdp', 'gpo', 'direct'])) then 'programme'
    when not coalesce(kafaa_ib_int_between(p -> 'intake_year', 2020, 2035), false) then 'year'
    else null end
$$;
-- joinerCandidates(): plans, then offered or accepted applicants of the entry programmes (intake = decision year + 1), then entry-level
-- staff hired in the last 365 days ("direct"); one row per person, by person id
create or replace function kafaa_ip_joiners(p_today date) returns jsonb language sql stable security definer set search_path = public as $$
  with pl as (
    select x.person_id, x.programme, x.intake_year, 'plan'::text source, x.id plan_id from kafaa_induction_plans x
  ), ap as (
    select distinct on (a.person_id) a.person_id, a.programme_id programme, extract(year from a.updated_at)::integer + 1 intake_year, 'offer'::text source, null::text plan_id
      from kafaa_applications a join kafaa_people pp on pp.id = a.person_id
     where a.stage in ('offer', 'accepted') and a.programme_id in ('dnt', 'energy-pioneers', 'gdp', 'gpo') and a.person_id not in (select person_id from pl)
     order by a.person_id, a.id collate "C"
  ), hi as (
    select pp.id person_id, 'direct'::text programme, extract(year from pp.hire_date)::integer intake_year, 'hire'::text source, null::text plan_id
      from kafaa_people pp
     where pp.kind = 'staff' and pp.level = 'entry' and pp.status is distinct from 'leaver' and pp.hire_date is not null
       and pp.hire_date > p_today - 365 and pp.hire_date <= p_today
       and pp.id not in (select person_id from pl) and pp.id not in (select person_id from ap)
  ), j as (select * from pl union all select * from ap union all select * from hi)
  select coalesce(jsonb_agg(jsonb_build_object('person_id', j.person_id, 'name', coalesce(pp.display_name, j.person_id), 'kind', coalesce(pp.kind, ''),
           'programme', j.programme, 'intake_year', j.intake_year, 'source', j.source, 'plan_id', j.plan_id) order by j.person_id collate "C"), '[]'::jsonb)
    from j left join kafaa_people pp on pp.id = j.person_id
$$;
create or replace function kafaa_ip_notify(p_id text, p_person text, p_en text, p_ar text) returns void language plpgsql security definer set search_path = public as $$
declare v_prev text := coalesce(current_setting('kafaa.seeding', true), '');
begin
  if p_person is null then return; end if;
  perform set_config('kafaa.seeding', 'on', true);
  insert into kafaa_notifications (id, person_id, kind, title_en, title_ar, body_en, body_ar, link, severity)
  values (p_id, p_person, 'induction', p_en, p_ar, null, null, '/my/induction', 'info') on conflict (id) do nothing;
  perform set_config('kafaa.seeding', v_prev, true);
end $$;

-- ───────────── FS77 RPCs
create or replace function kafaa_save_intake_baseline(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_code text; v_year integer; v_scope text; v_draft kafaa_intake_baselines; v_ver integer; v_id text;
  v_at timestamptz := date_trunc('second', now()); v_entries jsonb; v_pub boolean; v_stale integer; a kafaa_audit_events; l integer;
begin
  p := coalesce(p, '{}'::jsonb);
  if jsonb_typeof(p) <> 'object' then p := '{}'::jsonb; end if;
  if me is null then return kafaa_refuse('intake.baseline.save', 'intake_baselines', null, 'not_signed_in', 'Sign in first'); end if;
  v_role := kafaa_acting_role('workforce_strategy', array['W']);
  if v_role is null then return kafaa_refuse('intake.baseline.save', 'intake_baselines', null, 'forbidden', 'Only HR (workforce strategy W) sets intake baselines'); end if;
  v_code := kafaa_ib_problem(p);
  if v_code is not null then return kafaa_refuse('intake.baseline.save', 'intake_baselines', null, 'invalid', kafaa_ib_msg(v_code), v_role); end if;
  v_year := (p ->> 'intake_year')::numeric::integer;
  v_scope := p ->> 'programme';
  v_pub := (p -> 'publish') = 'true'::jsonb;
  v_entries := kafaa_ib_clean(p -> 'entries');
  select * into v_draft from kafaa_intake_baselines where intake_year = v_year and programme = v_scope and status = 'draft' order by version desc limit 1;
  if v_draft.id is not null then
    v_ver := v_draft.version; v_id := v_draft.id;
    update kafaa_intake_baselines set entries = v_entries, note_en = kafaa_ib_trim(case when jsonb_typeof(p -> 'note_en') = 'string' then p ->> 'note_en' end),
      note_ar = kafaa_ib_trim(case when jsonb_typeof(p -> 'note_ar') = 'string' then p ->> 'note_ar' end), set_by = me, set_at = v_at where id = v_id;
  else
    select coalesce(max(version), 0) + 1 into v_ver from kafaa_intake_baselines where intake_year = v_year and programme = v_scope;
    v_id := 'ib-' || v_year || '-' || v_scope || '-v' || v_ver;
    insert into kafaa_intake_baselines (id, intake_year, programme, version, status, entries, note_en, note_ar, set_by, set_at, published_by, published_at, listed, sample)
    values (v_id, v_year, v_scope, v_ver, 'draft', v_entries, kafaa_ib_trim(case when jsonb_typeof(p -> 'note_en') = 'string' then p ->> 'note_en' end),
      kafaa_ib_trim(case when jsonb_typeof(p -> 'note_ar') = 'string' then p ->> 'note_ar' end), me, v_at, null, null, false, false);
  end if;
  if v_pub then
    update kafaa_intake_baselines set status = 'superseded', listed = false where intake_year = v_year and programme = v_scope and status = 'published';
    update kafaa_intake_baselines set status = 'published', listed = true, published_by = me, published_at = v_at where id = v_id;
  end if;
  select count(*)::integer into v_stale from kafaa_induction_plans x
   where x.intake_year = v_year and (v_scope = 'all' or x.programme = v_scope) and (kafaa_ib_for(x.intake_year, x.programme)).id is distinct from x.baseline_id;
  if v_pub then l := kafaa_ledger('kafaa.intake.baseline_publish', 'Intake baseline ' || v_year || ' (' || v_scope || ') v' || v_ver || ' published'); end if;
  a := kafaa_audit(case when v_pub then 'intake.baseline.publish' else 'intake.baseline.save' end, 'intake_baselines', v_id, 'ok',
    case when v_pub then 'published' else 'draft' end || ' v' || v_ver || ', ' || jsonb_array_length(v_entries) || ' modules, ' || v_stale || ' stale plans',
    case when not v_pub then 'not_applicable' when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when v_pub then 'Baseline published; ' || v_stale || ' induction plans now read a different baseline' else 'Draft baseline saved' end, a, l,
    jsonb_build_object('id', v_id, 'version', v_ver, 'status', case when v_pub then 'published' else 'draft' end, 'stale_plans', v_stale));
end $$;

create or replace function kafaa_build_induction_plan(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_person kafaa_people; v_id text; v_code text; v_year integer; v_prog text; v_base kafaa_intake_baselines; v_plan jsonb;
  v_cur kafaa_induction_plans; v_rev integer; v_at timestamptz := date_trunc('second', now()); a kafaa_audit_events;
begin
  p := coalesce(p, '{}'::jsonb);
  if jsonb_typeof(p) <> 'object' then p := '{}'::jsonb; end if;
  if me is null then return kafaa_refuse('induction.plan.build', 'induction_plans', null, 'not_signed_in', 'Sign in first'); end if;
  v_role := kafaa_acting_role('workforce_strategy', array['W']);
  if v_role is null then return kafaa_refuse('induction.plan.build', 'induction_plans', null, 'forbidden', 'Only HR (workforce strategy W) builds induction plans'); end if;
  if jsonb_typeof(p -> 'person_id') = 'string' and p ->> 'person_id' <> '' then select * into v_person from kafaa_people where id = p ->> 'person_id'; end if;
  v_id := case when v_person.id is not null then 'ip-' || v_person.id end;
  v_code := kafaa_ip_problem(p, v_person.kind);
  if v_code is not null then return kafaa_refuse('induction.plan.build', 'induction_plans', v_id, 'invalid', kafaa_ib_msg(v_code), v_role); end if;
  v_year := (p ->> 'intake_year')::numeric::integer;
  v_prog := p ->> 'programme';
  v_base := kafaa_ib_for(v_year, v_prog);
  v_plan := kafaa_ip_compute(v_base);
  select * into v_cur from kafaa_induction_plans where id = v_id;
  v_rev := coalesce(v_cur.revision, 0) + 1;
  if v_cur.id is not null then
    update kafaa_induction_plans set person_name = coalesce(v_person.display_name, ''), programme = v_prog, intake_year = v_year, baseline_id = v_plan ->> 'baseline_id',
      baseline_version = (v_plan ->> 'baseline_version')::integer, items = v_plan -> 'items', hours_total = (v_plan ->> 'hours_total')::numeric,
      hours_planned = (v_plan ->> 'hours_planned')::numeric, hours_saved = (v_plan ->> 'hours_saved')::numeric, revision = v_rev, built_by = me, built_at = v_at where id = v_id;
  else
    insert into kafaa_induction_plans (id, person_id, person_name, programme, intake_year, baseline_id, baseline_version, items, hours_total, hours_planned, hours_saved, revision, built_by, built_at, sample)
    values (v_id, v_person.id, coalesce(v_person.display_name, ''), v_prog, v_year, v_plan ->> 'baseline_id', (v_plan ->> 'baseline_version')::integer, v_plan -> 'items',
      (v_plan ->> 'hours_total')::numeric, (v_plan ->> 'hours_planned')::numeric, (v_plan ->> 'hours_saved')::numeric, v_rev, me, v_at, false);
  end if;
  perform kafaa_ip_notify('nt-ip-' || v_person.id || '-r' || v_rev, v_person.id,
    'Your induction plan is ready: ' || (v_plan ->> 'hours_planned') || ' hours (' || (v_plan ->> 'hours_saved') || ' hours you already hold)',
    'خطة التهيئة الخاصة بك جاهزة: ' || (v_plan ->> 'hours_planned') || ' ساعة (' || (v_plan ->> 'hours_saved') || ' ساعة تمتلكها مسبقاً)');
  a := kafaa_audit('induction.plan.build', 'induction_plans', v_id, 'ok', v_prog || ' intake ' || v_year || ', baseline ' || coalesce(v_plan ->> 'baseline_id', 'none') || ', '
    || (v_plan ->> 'hours_planned') || ' h planned, ' || (v_plan ->> 'hours_saved') || ' h saved, r' || v_rev, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when v_plan ->> 'baseline_id' is not null then 'Induction plan built from the intake baseline'
    else 'Induction plan built: no published baseline for this intake, so the full induction applies' end, a, null,
    jsonb_build_object('id', v_id, 'baseline_id', v_plan -> 'baseline_id', 'hours_planned', v_plan -> 'hours_planned', 'hours_saved', v_plan -> 'hours_saved', 'revision', v_rev));
end $$;

create or replace function kafaa_induction_joiners() returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me();
begin
  if me is null then return kafaa_refuse('induction.joiners', 'induction_plans', null, 'not_signed_in', 'Sign in first'); end if;
  if not (kafaa_has_grant('workforce_strategy', array['R', 'W']) or kafaa_has_grant('sat', array['R', 'W', 'A'])) then
    return kafaa_refuse('induction.joiners', 'induction_plans', null, 'forbidden', 'Joiners are listed for HR and training staff only'); end if;
  return jsonb_build_object('ok', true, 'code', 'ok', 'message', 'Joiners', 'audit_seq', null, 'ledger_seq', null, 'data', kafaa_ip_joiners(current_date));
end $$;

-- ───────────── Grants: internal helpers are not executable by API roles; RPCs only by signed-in users.
revoke all on function kafaa_ib_trim(text), kafaa_ib_len_ok(jsonb, integer), kafaa_ib_int_between(jsonb, integer, integer), kafaa_ib_msg(text), kafaa_ib_problem(jsonb),
  kafaa_ib_clean(jsonb), kafaa_ib_for(integer, text), kafaa_ip_compute(kafaa_intake_baselines), kafaa_ip_problem(jsonb, text), kafaa_ip_joiners(date),
  kafaa_ip_notify(text, text, text, text) from public, anon, authenticated;
revoke all on function kafaa_save_intake_baseline(jsonb), kafaa_build_induction_plan(jsonb), kafaa_induction_joiners() from public, anon;
grant execute on function kafaa_save_intake_baseline(jsonb), kafaa_build_induction_plan(jsonb), kafaa_induction_joiners() to authenticated;
