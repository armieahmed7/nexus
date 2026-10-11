-- [FS wave C · E3 · FS21 + FS22] Adaptive future-skills assessment, performance tasks and integrity reports (M05 Assessments).
-- FS21: six adaptive banks (AI literacy, plant data, digital twins, cyber hygiene, SMR fundamentals, CleanEnergyComp) with items
--   calibrated by difficulty (whole part = level 1-4). Routing runs server-side on the FS01 `assess` staircase (start 2, up after 2
--   right, down after 1 wrong; estimate = highest level answered right twice), content-balanced by facet, rotated by a fixed form;
--   stop at a stable estimate (min 8 items, unchanged over 4 answers) or 20 items. Safety-related skills are criterion-referenced
--   (meets the standard or not, never a percentile: check constraint); developmental banks show a percentile against 10+ people.
--   The result writes F01 `assessment` evidence (ref_table adaptive_attempts). Mirror of src/modules/m05/adaptive.ts (kafaa_ad_*).
-- FS22: scenario performance tasks on SIMULATED data with a published rubric the learner confirms before starting; auto lines
--   (anomaly, critical decision) from a training-staff-only key, assessor lines scored by signoff A (never one's own attempt);
--   integrity reports for every attempt that gates a credential (time on task, fast answers, retakes, resubmissions, repeat
--   items, item exposure), reviewable (accept / void). Mirror of src/modules/m05/perf.ts (kafaa_pt_*, kafaa_ir_*).
-- Shared redefinition (same signatures): kafaa_skill_states_v2 and kafaa_skills_apply keep assessment rows with ref_table
--   fitness_attempts (FS10), adaptive_attempts and task_attempts (FS21/FS22) as recorded evidence. TS mirror: RECORDED_REF_TABLES
--   in src/domain/skills.ts. Nothing else in either function changes.
-- PGlite parity and checks: scripts/validate/fs33-assessment.mjs.
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.

-- @@DDL-BEGIN@@
-- ───────────── Tables (generated DDL, additive; same text as 20261008120100_kafaa_schema.sql)
create table if not exists kafaa_adaptive_banks (
  id text primary key,
  code text not null unique,
  name_en text not null,
  name_ar text not null,
  summary_en text not null,
  summary_ar text not null,
  fs_area text not null,
  skill_ids text[] not null default '{}'::text[],
  safety_related boolean not null default false,
  mode text not null check (mode in ('criterion', 'normative')),
  cut_level integer not null default 2,
  max_items integer not null default 20,
  min_items integer not null default 8,
  stable_window integer not null default 4,
  evidence_cap integer not null default 3,
  retake_days integer not null default 14,
  gates text[] not null default '{}'::text[],
  benchmark_ids text[] not null default '{}'::text[],
  sources jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('active', 'retired')),
  version integer not null default 1,
  sort integer not null default 0,
  updated_by text,
  updated_at timestamptz not null default now()
);
comment on table kafaa_adaptive_banks is '[M05] Adaptive future-skills item bank: the skills it evidences, criterion or developmental mode, the standard, stop rule and the credentials it gates (FS21)';

create table if not exists kafaa_adaptive_items (
  id text primary key,
  bank_id text not null,
  skill_id text not null,
  facet text not null,
  level integer not null,
  difficulty numeric not null,
  stem_en text not null,
  stem_ar text not null,
  options_en text[] not null default '{}'::text[],
  options_ar text[] not null default '{}'::text[],
  correct integer not null,
  explain_en text not null default '',
  explain_ar text not null default '',
  p_value numeric,
  calib_n integer not null default 0,
  status text not null default 'active' check (status in ('active', 'retired')),
  version integer not null default 1,
  sort integer not null default 0,
  updated_by text,
  updated_at timestamptz not null default now()
);
comment on table kafaa_adaptive_items is '[M05] Adaptive item (EN/AR, calibrated difficulty 1.00-4.99 whose whole part is the level, facet, skill, answer key): training staff only (FS21)';

create table if not exists kafaa_adaptive_attempts (
  id text primary key,
  bank_id text not null,
  bank_version integer not null default 1,
  person_id text not null,
  attempt_no integer not null,
  form integer not null default 0,
  mode text not null check (mode in ('criterion', 'normative')),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  responses jsonb not null default '[]'::jsonb,
  current_item_id text,
  item_count integer not null default 0,
  stop text check (stop in ('stable', 'max', 'exhausted')),
  estimate integer,
  meets boolean,
  percentile integer,
  norm_n integer,
  reasons jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  gating boolean not null default false,
  integrity_id text,
  counts boolean not null default true
);
comment on table kafaa_adaptive_attempts is '[M05] One adaptive attempt: answers in order with the served level and time, estimate, standard met or percentile, evidence, integrity link (FS21)';

create table if not exists kafaa_performance_tasks (
  id text primary key,
  code text not null unique,
  title_en text not null,
  title_ar text not null,
  brief_en text not null,
  brief_ar text not null,
  role_en text not null default '',
  role_ar text not null default '',
  fs_area text not null,
  skill_ids text[] not null default '{}'::text[],
  evidence_level integer not null default 2,
  minutes integer not null default 20,
  min_minutes integer not null default 5,
  data jsonb not null default '{}'::jsonb,
  decisions jsonb not null default '[]'::jsonb,
  checks jsonb not null default '[]'::jsonb,
  rubric jsonb not null default '[]'::jsonb,
  rubric_version integer not null default 1,
  pass_pct integer not null default 65,
  gates text[] not null default '{}'::text[],
  simulated boolean not null default true,
  benchmark_ids text[] not null default '{}'::text[],
  sources jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('active', 'retired')),
  sort integer not null default 0
);
comment on table kafaa_performance_tasks is '[M05] Scenario performance task on SIMULATED plant data: brief, trend set, decision options and the published rubric (FS22)';

create table if not exists kafaa_perf_task_keys (
  id text primary key,
  task_id text not null unique,
  series text not null,
  from_idx integer not null,
  to_idx integer not null,
  decision_points jsonb not null default '[]'::jsonb,
  notes_en text not null default '',
  notes_ar text not null default ''
);
comment on table kafaa_perf_task_keys is '[M05] Answer key of a performance task (anomaly window, decision points, assessor notes): training staff only (FS22)';

create table if not exists kafaa_task_attempts (
  id text primary key,
  task_id text not null,
  person_id text not null,
  attempt_no integer not null,
  rubric_version integer not null,
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'scored')),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  answer jsonb not null default '{}'::jsonb,
  resubmissions integer not null default 0,
  auto_scores jsonb not null default '{}'::jsonb,
  scores jsonb not null default '{}'::jsonb,
  total integer,
  max integer,
  passed boolean,
  critical_failed boolean not null default false,
  scored_by text,
  scored_at timestamptz,
  comment text,
  gating boolean not null default false,
  integrity_id text,
  evidence jsonb not null default '[]'::jsonb,
  counts boolean not null default true
);
comment on table kafaa_task_attempts is '[M05] A person''s performance-task attempt: answer, resubmissions, auto and assessor rubric scores, result, evidence, integrity link (FS22)';

create table if not exists kafaa_integrity_reports (
  id text primary key,
  kind text not null check (kind in ('adaptive', 'task')),
  attempt_id text not null unique,
  person_id text not null,
  ref_id text not null,
  gates text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  time_on_task_s integer not null,
  items integer not null default 0,
  fast_items integer not null default 0,
  median_item_s integer,
  retakes integer not null default 0,
  resubmissions integer not null default 0,
  repeat_items integer not null default 0,
  exposure_max numeric,
  exposure_mean numeric,
  exposure_n integer not null default 0,
  flags text[] not null default '{}'::text[],
  status text not null check (status in ('clear', 'review')),
  decision text check (decision in ('accepted', 'voided')),
  reviewed_by text,
  reviewed_at timestamptz,
  review_note text
);
comment on table kafaa_integrity_reports is '[M05] Integrity report on an attempt that gates a credential: time on task, fast answers, retakes, resubmissions, item exposure, flags, review (FS22)';

do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_adaptive_items_bank_id_fk') then alter table kafaa_adaptive_items add constraint kafaa_adaptive_items_bank_id_fk foreign key (bank_id) references kafaa_adaptive_banks(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_adaptive_items_skill_id_fk') then alter table kafaa_adaptive_items add constraint kafaa_adaptive_items_skill_id_fk foreign key (skill_id) references kafaa_skills(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_adaptive_attempts_bank_id_fk') then alter table kafaa_adaptive_attempts add constraint kafaa_adaptive_attempts_bank_id_fk foreign key (bank_id) references kafaa_adaptive_banks(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_adaptive_attempts_person_id_fk') then alter table kafaa_adaptive_attempts add constraint kafaa_adaptive_attempts_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_perf_task_keys_task_id_fk') then alter table kafaa_perf_task_keys add constraint kafaa_perf_task_keys_task_id_fk foreign key (task_id) references kafaa_performance_tasks(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_task_attempts_task_id_fk') then alter table kafaa_task_attempts add constraint kafaa_task_attempts_task_id_fk foreign key (task_id) references kafaa_performance_tasks(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_task_attempts_person_id_fk') then alter table kafaa_task_attempts add constraint kafaa_task_attempts_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_task_attempts_scored_by_fk') then alter table kafaa_task_attempts add constraint kafaa_task_attempts_scored_by_fk foreign key (scored_by) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_integrity_reports_person_id_fk') then alter table kafaa_integrity_reports add constraint kafaa_integrity_reports_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_integrity_reports_reviewed_by_fk') then alter table kafaa_integrity_reports add constraint kafaa_integrity_reports_reviewed_by_fk foreign key (reviewed_by) references kafaa_people(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_adaptive_banks_fs_area_idx on kafaa_adaptive_banks (fs_area);
create index if not exists kafaa_adaptive_banks_status_idx on kafaa_adaptive_banks (status);
create index if not exists kafaa_adaptive_items_bank_id_idx on kafaa_adaptive_items (bank_id);
create index if not exists kafaa_adaptive_items_skill_id_idx on kafaa_adaptive_items (skill_id);
create index if not exists kafaa_adaptive_items_status_idx on kafaa_adaptive_items (status);
create index if not exists kafaa_adaptive_attempts_bank_id_idx on kafaa_adaptive_attempts (bank_id);
create index if not exists kafaa_adaptive_attempts_person_id_idx on kafaa_adaptive_attempts (person_id);
create index if not exists kafaa_adaptive_attempts_status_idx on kafaa_adaptive_attempts (status);
create index if not exists kafaa_performance_tasks_fs_area_idx on kafaa_performance_tasks (fs_area);
create index if not exists kafaa_performance_tasks_status_idx on kafaa_performance_tasks (status);
create index if not exists kafaa_task_attempts_task_id_idx on kafaa_task_attempts (task_id);
create index if not exists kafaa_task_attempts_person_id_idx on kafaa_task_attempts (person_id);
create index if not exists kafaa_task_attempts_status_idx on kafaa_task_attempts (status);
create index if not exists kafaa_task_attempts_scored_by_idx on kafaa_task_attempts (scored_by);
create index if not exists kafaa_integrity_reports_kind_idx on kafaa_integrity_reports (kind);
create index if not exists kafaa_integrity_reports_person_id_idx on kafaa_integrity_reports (person_id);
create index if not exists kafaa_integrity_reports_status_idx on kafaa_integrity_reports (status);
create index if not exists kafaa_integrity_reports_reviewed_by_idx on kafaa_integrity_reports (reviewed_by);

-- ───────────── RLS (generated rules; policies created once, never dropped)
do $$ begin
  execute 'alter table kafaa_adaptive_banks enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_adaptive_banks' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_adaptive_banks for select to anon, authenticated using (kafaa_rule_read(''internal_content'', null::text, null::text, true))'; end if;
  execute 'alter table kafaa_adaptive_items enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_adaptive_items' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_adaptive_items for select to anon, authenticated using (kafaa_rule_read(''secure_items'', null::text, null::text, true))'; end if;
  execute 'alter table kafaa_adaptive_attempts enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_adaptive_attempts' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_adaptive_attempts for select to anon, authenticated using (kafaa_rule_read(''skills_profile'', person_id, null::text, true))'; end if;
  execute 'alter table kafaa_performance_tasks enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_performance_tasks' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_performance_tasks for select to anon, authenticated using (kafaa_rule_read(''internal_content'', null::text, null::text, true))'; end if;
  execute 'alter table kafaa_perf_task_keys enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_perf_task_keys' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_perf_task_keys for select to anon, authenticated using (kafaa_rule_read(''secure_items'', null::text, null::text, true))'; end if;
  execute 'alter table kafaa_task_attempts enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_task_attempts' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_task_attempts for select to anon, authenticated using (kafaa_rule_read(''own_profile'', person_id, null::text, true) or kafaa_rule_read(''signoff'', null::text, null::text, true))'; end if;
  execute 'alter table kafaa_integrity_reports enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_integrity_reports' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_integrity_reports for select to anon, authenticated using (kafaa_rule_read(''own_profile'', person_id, null::text, true) or kafaa_rule_read(''signoff'', null::text, null::text, true) or kafaa_rule_read(''audit_log'', null::text, null::text, true))'; end if;
end $$;
revoke insert, update, delete on kafaa_adaptive_banks, kafaa_adaptive_items, kafaa_adaptive_attempts, kafaa_performance_tasks, kafaa_perf_task_keys, kafaa_task_attempts, kafaa_integrity_reports from anon, authenticated;
grant select on kafaa_adaptive_banks, kafaa_adaptive_items, kafaa_adaptive_attempts, kafaa_performance_tasks, kafaa_perf_task_keys, kafaa_task_attempts, kafaa_integrity_reports to anon, authenticated;
-- @@DDL-END@@

-- ───────────── Checks (acceptance rules held by the database)
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'kafaa_adaptive_banks_safety_ck') then
    alter table kafaa_adaptive_banks add constraint kafaa_adaptive_banks_safety_ck check (not safety_related or mode = 'criterion'); end if;
  if not exists (select 1 from pg_constraint where conname = 'kafaa_adaptive_items_level_ck') then
    alter table kafaa_adaptive_items add constraint kafaa_adaptive_items_level_ck check (difficulty >= 1 and difficulty < 5 and level = floor(difficulty)::integer); end if;
  if not exists (select 1 from pg_constraint where conname = 'kafaa_adaptive_attempts_pct_ck') then
    alter table kafaa_adaptive_attempts add constraint kafaa_adaptive_attempts_pct_ck check (mode = 'normative' or percentile is null); end if;
  if not exists (select 1 from pg_constraint where conname = 'kafaa_adaptive_attempts_integrity_ck') then
    alter table kafaa_adaptive_attempts add constraint kafaa_adaptive_attempts_integrity_ck check (not gating or status <> 'completed' or integrity_id is not null); end if;
  if not exists (select 1 from pg_constraint where conname = 'kafaa_task_attempts_integrity_ck') then
    alter table kafaa_task_attempts add constraint kafaa_task_attempts_integrity_ck check (not gating or status = 'in_progress' or integrity_id is not null); end if;
  if not exists (select 1 from pg_constraint where conname = 'kafaa_performance_tasks_simulated_ck') then
    alter table kafaa_performance_tasks add constraint kafaa_performance_tasks_simulated_ck check (simulated); end if;
end $$;

-- @@SHARED-BEGIN@@
-- ───────────── FS03 skill states: FS10, FS21 and FS22 assessment rows are recorded evidence (shared redefinition, same signatures)
create or replace function kafaa_skill_states_v2(p_person text, p_now date, p_hl jsonb default null)
returns table (id text, person_id text, skill_id text, level integer, confidence numeric, basis text, reasons jsonb, evidence_count integer,
               confidence_band text, conf_low numeric, conf_high numeric)
language sql stable security definer set search_path = public as $$
  with hm as (select kafaa_skill_hl_months(p_hl) m),
  hl as (
    select (m ->> 'fast')::float8 as fm, (m ->> 'standard')::float8 as sm, (m ->> 'slow')::float8 as lm,
           floor((m ->> 'fast')::float8 * 30.4375 + 0.5)::integer as fd, floor((m ->> 'standard')::float8 * 30.4375 + 0.5)::integer as sd,
           floor((m ->> 'slow')::float8 * 30.4375 + 0.5)::integer as ld
    from hm
  ),
  ev as (
    select d.id, d.person_id, d.skill_id, d.kind, d.level, d.basis, d.status, d.observed_on from kafaa_skill_evidence_derive(p_person, p_now) d
    union all
    select e.id, e.person_id, e.skill_id, e.kind, e.level, e.basis, e.status, e.observed_on from kafaa_skill_evidence e
    where e.active and (e.kind in ('rating', 'ojt', 'credential') or e.ref_table in ('fitness_attempts', 'adaptive_attempts', 'task_attempts')) and (p_person is null or e.person_id = p_person)
  ),
  s1 as (
    select ev.*, (ev.kind = 'qual' and ev.status = 'current') as holds, greatest(0, p_now - ev.observed_on) as age,
           kafaa_skill_decay_class(k.area, to_jsonb(k) ->> 'decay_class') as cls
    from ev left join kafaa_skills k on k.id = ev.skill_id
  ),
  s2 as (
    select s1.*,
      case s1.cls when 'fast' then h.fd when 'slow' then h.ld else h.sd end as hld,
      case s1.cls when 'fast' then h.fm when 'slow' then h.lm else h.sm end as hlm
    from s1 cross join hl h
  ),
  s3 as (
    select s2.*,
      case when s2.holds then 1.0::float8 else floor(power(0.5::float8, s2.age::float8 / s2.hld::float8) * 10000 + 0.5) / 10000 end as decay,
      (not s2.holds and s2.age > s2.hld) as ageing,
      case s2.basis when 'verified' then 1.0::float8 when 'evidenced' then 0.8::float8 when 'validated' then 0.6::float8 else 0.3::float8 end as wt,
      case when s2.kind = 'qual' then 'qualification' when s2.kind = 'course' then 'training' when s2.kind in ('assessment', 'jpm') then 'assessment'
           when s2.kind = 'rating' then (case when s2.basis = 'claimed' then 'self' else 'validation' end) when s2.kind = 'ojt' then 'work' else 'credential' end as src
    from s2
  ),
  s4 as (
    select s3.*, case when s3.ageing then greatest(1, s3.level - 1) else s3.level end as eff, floor(s3.wt * s3.decay * 10000 + 0.5) / 10000 as conf,
      case s3.basis when 'verified' then 4 when 'evidenced' then 3 when 'validated' then 2 else 1 end as brank,
      case when s3.kind = 'qual' then (case when s3.status = 'lapsed' then 'qual_lapsed' else 'qual' end) when s3.kind = 'rating' then 'rating_' || s3.basis else s3.kind end as code
    from s3
  ),
  rk as (
    select s4.*, row_number() over (partition by s4.person_id, s4.skill_id
             order by (case when s4.basis = 'claimed' then 0 else 1 end) desc, s4.eff desc, s4.brank desc, s4.conf desc, s4.observed_on desc, s4.id collate "C" asc) as rn,
           count(*) over (partition by s4.person_id, s4.skill_id) as n
    from s4
  ),
  best as (select r.person_id, r.skill_id, r.src, max(r.conf) as c from rk r group by r.person_id, r.skill_id, r.src),
  bl as (select b.person_id, b.skill_id, kafaa_skill_blend(array_agg(b.c order by b.c desc)) as v from best b group by b.person_id, b.skill_id),
  ci as (select bl.person_id, bl.skill_id, floor(least(0.99::float8, bl.v[1]) * 100 + 0.5) / 100 as conf, bl.v[2] as n from bl),
  iv as (select ci.person_id, ci.skill_id, ci.conf, kafaa_skill_interval(ci.conf, ci.n) as v from ci)
  select 'ps:' || w.person_id || ':' || w.skill_id, w.person_id, w.skill_id, w.eff,
         i.conf::numeric,
         w.basis,
         (select jsonb_agg(jsonb_build_object('code', r.code, 'evidence_id', r.id, 'level', r.eff, 'basis', r.basis, 'observed_on', r.observed_on::text, 'ageing', r.ageing,
                                              'source', r.src, 'w', r.conf, 'hl', r.hlm) order by r.rn)
            from rk r where r.person_id = w.person_id and r.skill_id = w.skill_id),
         w.n::integer,
         kafaa_skill_band(i.v[1]), i.v[1]::numeric, i.v[2]::numeric
  from rk w join iv i on i.person_id = w.person_id and i.skill_id = w.skill_id
  where w.rn = 1
$$;

create or replace function kafaa_skills_apply(p_person text, p_now date) returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  insert into kafaa_skill_evidence (id, person_id, skill_id, kind, ref_table, ref_id, level, basis, status, observed_on, active)
  select d.id, d.person_id, d.skill_id, d.kind, d.ref_table, d.ref_id, d.level, d.basis, d.status, d.observed_on, true from kafaa_skill_evidence_derive(p_person, p_now) d
  on conflict (id) do update set level = excluded.level, basis = excluded.basis, status = excluded.status, observed_on = excluded.observed_on, active = true
  where (kafaa_skill_evidence.level, kafaa_skill_evidence.basis, kafaa_skill_evidence.status, kafaa_skill_evidence.observed_on, kafaa_skill_evidence.active)
        is distinct from (excluded.level, excluded.basis, excluded.status, excluded.observed_on, true);
  update kafaa_skill_evidence e set active = false
  where e.active and e.kind in ('qual', 'course', 'assessment', 'jpm') and e.ref_table not in ('fitness_attempts', 'adaptive_attempts', 'task_attempts') and (p_person is null or e.person_id = p_person)
    and e.id not in (select d.id from kafaa_skill_evidence_derive(p_person, p_now) d);
  insert into kafaa_person_skills (id, person_id, skill_id, level, confidence, basis, reasons, evidence_count, active, updated_at, confidence_band, conf_low, conf_high)
  select s.id, s.person_id, s.skill_id, s.level, s.confidence, s.basis, s.reasons, s.evidence_count, true, now(), s.confidence_band, s.conf_low, s.conf_high
  from kafaa_skill_states_v2(p_person, p_now, null) s
  on conflict (id) do update set level = excluded.level, confidence = excluded.confidence, basis = excluded.basis, reasons = excluded.reasons,
    evidence_count = excluded.evidence_count, active = true, updated_at = now(), confidence_band = excluded.confidence_band, conf_low = excluded.conf_low, conf_high = excluded.conf_high
  where (kafaa_person_skills.level, kafaa_person_skills.confidence, kafaa_person_skills.basis, kafaa_person_skills.reasons, kafaa_person_skills.evidence_count, kafaa_person_skills.active,
         kafaa_person_skills.confidence_band, kafaa_person_skills.conf_low, kafaa_person_skills.conf_high)
        is distinct from (excluded.level, excluded.confidence, excluded.basis, excluded.reasons, excluded.evidence_count, true, excluded.confidence_band, excluded.conf_low, excluded.conf_high);
  update kafaa_person_skills p set active = false, level = 0, confidence = 0, basis = 'none', reasons = '[]'::jsonb, evidence_count = 0, updated_at = now(),
    confidence_band = 'low', conf_low = 0, conf_high = 0
  where p.active and (p_person is null or p.person_id = p_person) and p.id not in (select s.id from kafaa_skill_states_v2(p_person, p_now, null) s);
  select jsonb_build_object(
    'people', (select count(distinct p.person_id) from kafaa_person_skills p where p.active and (p_person is null or p.person_id = p_person)),
    'states', (select count(*) from kafaa_person_skills p where p.active and (p_person is null or p.person_id = p_person)),
    'evidence', (select count(*) from kafaa_skill_evidence e where e.active and (p_person is null or e.person_id = p_person)),
    'digest', (select encode(sha256(convert_to(coalesce(string_agg(p.id || '|' || p.level || '|' || round(p.confidence * 100)::integer || '|' || p.basis, E'\n' order by p.id collate "C"), ''), 'UTF8')), 'hex')
               from kafaa_person_skills p where p.active and (p_person is null or p.person_id = p_person)))
  into v;
  return v;
end $$;
-- @@SHARED-END@@

-- ───────────── FS21 rules (mirror of src/modules/m05/adaptive.ts)
create or replace function kafaa_ad_form(p_person text, p_no integer) returns integer language sql immutable set search_path = public as $$
  select coalesce((select sum(ascii(c)) from regexp_split_to_table(p_person, '') c), 0)::integer + p_no - 1
$$;

-- FS01 staircase (nextItem with DEFAULT_ASSESS: start 2, up after 2 right, down after 1 wrong) over the first p_upto answers:
-- the level of the next item and the estimate (highest level answered right at least twice).
create or replace function kafaa_ad_engine(p_resp jsonb, p_upto integer default null) returns jsonb language plpgsql immutable set search_path = public as $$
declare lvl integer := 2; rt integer := 0; wr integer := 0; r jsonb; est integer;
begin
  for r in select e from jsonb_array_elements(coalesce(p_resp, '[]'::jsonb)) with ordinality q(e, i) where p_upto is null or i <= p_upto order by i loop
    if (r ->> 'correct')::boolean then
      rt := rt + 1; wr := 0;
      if rt >= 2 and lvl < 4 then lvl := lvl + 1; rt := 0; end if;
    else
      wr := wr + 1; rt := 0;
      if wr >= 1 and lvl > 1 then lvl := lvl - 1; wr := 0; end if;
    end if;
  end loop;
  select coalesce(max(l), 0) into est from (
    select (e ->> 'level')::integer l, count(*) c from jsonb_array_elements(coalesce(p_resp, '[]'::jsonb)) with ordinality q(e, i)
    where (p_upto is null or i <= p_upto) and (e ->> 'correct')::boolean group by 1) x where c >= 2;
  return jsonb_build_object('level', lvl, 'estimate', est);
end $$;

create or replace function kafaa_ad_stop(p_bank text, p_resp jsonb) returns text language plpgsql stable security definer set search_path = public as $$
declare b kafaa_adaptive_banks; n integer := jsonb_array_length(coalesce(p_resp, '[]'::jsonb));
begin
  select * into b from kafaa_adaptive_banks where id = p_bank;
  if n >= b.max_items then return 'max'; end if;
  if n >= b.min_items and n >= b.stable_window
     and (kafaa_ad_engine(p_resp) ->> 'estimate')::integer = (kafaa_ad_engine(p_resp, n - b.stable_window) ->> 'estimate')::integer then return 'stable'; end if;
  return null;
end $$;

-- pickAdaptive: nearest level (lower first), least-used facets, distance of the difficulty from the level middle, id; index form mod n
create or replace function kafaa_ad_pick(p_bank text, p_target integer, p_resp jsonb, p_form integer) returns text language plpgsql stable security definer set search_path = public as $$
declare v_used text[]; v_best integer; v_m integer; ids text[]; n integer;
begin
  select coalesce(array_agg(r ->> 'item_id'), '{}'::text[]) into v_used from jsonb_array_elements(coalesce(p_resp, '[]'::jsonb)) r;
  select i.level into v_best from kafaa_adaptive_items i where i.bank_id = p_bank and i.status = 'active' and not (i.id = any(v_used))
    order by abs(i.level - p_target), i.level limit 1;
  if v_best is null then return null; end if;
  with u as (select r ->> 'facet' f, count(*)::integer c from jsonb_array_elements(coalesce(p_resp, '[]'::jsonb)) r group by 1),
  c as (select i.id, i.difficulty, coalesce(u.c, 0) uc from kafaa_adaptive_items i left join u on u.f = i.facet
        where i.bank_id = p_bank and i.status = 'active' and i.level = v_best and not (i.id = any(v_used)))
  select min(uc) into v_m from c;
  with u as (select r ->> 'facet' f, count(*)::integer c from jsonb_array_elements(coalesce(p_resp, '[]'::jsonb)) r group by 1),
  c as (select i.id, i.difficulty, coalesce(u.c, 0) uc from kafaa_adaptive_items i left join u on u.f = i.facet
        where i.bank_id = p_bank and i.status = 'active' and i.level = v_best and not (i.id = any(v_used)))
  select array_agg(c.id order by abs(round(c.difficulty * 100)::integer - (v_best * 100 + 50)), c.id collate "C") into ids from c where c.uc = v_m;
  n := array_length(ids, 1);
  return ids[((p_form % n) + n) % n + 1];
end $$;

create or replace function kafaa_ad_next(p_bank text, p_resp jsonb, p_form integer) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare e jsonb := kafaa_ad_engine(p_resp); v_stop text := kafaa_ad_stop(p_bank, p_resp); v_item text;
begin
  if v_stop is not null then return jsonb_build_object('done', true, 'level', (e ->> 'level')::integer, 'item_id', null, 'stop', v_stop); end if;
  v_item := kafaa_ad_pick(p_bank, (e ->> 'level')::integer, p_resp, p_form);
  if v_item is null then return jsonb_build_object('done', true, 'level', (e ->> 'level')::integer, 'item_id', null, 'stop', 'exhausted'); end if;
  return jsonb_build_object('done', false, 'level', (e ->> 'level')::integer, 'item_id', v_item, 'stop', null);
end $$;

create or replace function kafaa_ad_is_safety(p_bank text) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(b.safety_related, false) or exists (select 1 from kafaa_skills s where s.id = any(b.skill_ids)
    and (s.area in ('safety', 'plant_systems', 'operations', 'emergency', 'radiation_chemistry', 'security') or coalesce(to_jsonb(s) ->> 'fs_area', '') in ('cyber_hygiene')))
  from kafaa_adaptive_banks b where b.id = p_bank
$$;

create or replace function kafaa_ad_percentile(p_est integer, p_others integer[]) returns integer language plpgsql immutable set search_path = public as $$
declare n integer := coalesce(array_length(p_others, 1), 0); below integer; eq integer;
begin
  if n < 10 then return null; end if;
  select count(*) filter (where x < p_est), count(*) filter (where x = p_est) into below, eq from unnest(p_others) x;
  return (200 * below + 100 * eq + n) / (2 * n);
end $$;

-- latest counting completed attempt of every other person in the bank (completed before p_before when given)
create or replace function kafaa_ad_norm(p_bank text, p_person text, p_before timestamptz default null) returns integer[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(estimate), '{}'::integer[]) from (
    select distinct on (person_id) person_id, estimate from kafaa_adaptive_attempts
    where bank_id = p_bank and status = 'completed' and counts and estimate is not null and (p_before is null or completed_at < p_before)
    order by person_id, completed_at desc, id collate "C" desc) x where person_id <> p_person
$$;

create or replace function kafaa_ad_score(p_bank text, p_mode text, p_safety boolean, p_resp jsonb, p_stop text, p_norm integer[]) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare b kafaa_adaptive_banks; est integer; n integer := jsonb_array_length(coalesce(p_resp, '[]'::jsonb)); crit boolean; v_meets boolean; v_pct integer; v_nn integer;
  v_ev jsonb; v_reasons jsonb;
begin
  select * into b from kafaa_adaptive_banks where id = p_bank;
  est := (kafaa_ad_engine(p_resp) ->> 'estimate')::integer;
  crit := p_safety or p_mode = 'criterion';
  v_meets := case when crit then est >= b.cut_level else null end;
  v_pct := case when crit then null else kafaa_ad_percentile(est, p_norm) end;
  v_nn := case when crit or v_pct is null then null else coalesce(array_length(p_norm, 1), 0) end;
  select coalesce(jsonb_agg(jsonb_build_object('skill_id', s, 'level', least(b.evidence_cap, est)) order by s collate "C"), '[]'::jsonb) into v_ev
    from unnest(b.skill_ids) s where est >= 1;
  v_reasons := jsonb_build_array(
    jsonb_build_object('code', 'fs21_estimate', 'key', 'm05.ad.reason.estimate', 'vars', jsonb_build_object('level', est, 'n', n)),
    jsonb_build_object('code', 'fs21_stop', 'key', 'm05.ad.reason.stop.' || p_stop, 'vars', jsonb_build_object('n', n, 'max', b.max_items, 'window', b.stable_window)));
  if crit then
    v_reasons := v_reasons || jsonb_build_array(
      jsonb_build_object('code', case when v_meets then 'fs21_meets' else 'fs21_below' end, 'key', 'm05.ad.reason.' || case when v_meets then 'meets' else 'below' end, 'vars', jsonb_build_object('cut', b.cut_level)),
      jsonb_build_object('code', 'fs21_no_percentile', 'key', case when p_safety then 'm05.ad.reason.noPercentileSafety' else 'm05.ad.reason.noPercentile' end));
  elsif v_pct is not null then
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'fs21_percentile', 'key', 'm05.ad.reason.percentile', 'vars', jsonb_build_object('pct', v_pct, 'n', coalesce(array_length(p_norm, 1), 0))));
  else
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'fs21_percentile_suppressed', 'key', 'm05.ad.reason.pctSuppressed', 'vars', jsonb_build_object('min', 10)));
  end if;
  if est > b.evidence_cap then v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'fs21_cap', 'key', 'm05.ad.reason.cap', 'vars', jsonb_build_object('level', b.evidence_cap))); end if;
  return jsonb_build_object('estimate', est, 'stop', p_stop, 'meets', v_meets, 'percentile', v_pct, 'norm_n', v_nn, 'safety', p_safety, 'evidence', v_ev, 'reasons', v_reasons);
end $$;

-- nextStartOn: the date a new attempt may start, or null when it may start now
create or replace function kafaa_ad_next_start(p_bank text, p_person text, p_today date) returns text language sql stable security definer set search_path = public as $$
  select case when x.d is not null and x.d + b.retake_days > p_today then to_char(x.d + b.retake_days, 'YYYY-MM-DD') else null end
  from kafaa_adaptive_banks b, (select max((completed_at at time zone 'UTC')::date) d from kafaa_adaptive_attempts where bank_id = p_bank and person_id = p_person and status = 'completed') x
  where b.id = p_bank
$$;

create or replace function kafaa_ad_item_view(p_id text) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', i.id, 'bank_id', i.bank_id, 'facet', i.facet, 'level', i.level, 'stem_en', i.stem_en, 'stem_ar', i.stem_ar,
    'options_en', to_jsonb(i.options_en), 'options_ar', to_jsonb(i.options_ar)) from kafaa_adaptive_items i where i.id = p_id
$$;

create or replace function kafaa_ad_norm_text(p text) returns text language sql immutable set search_path = public as $$
  select lower(regexp_replace(regexp_replace(coalesce(p, ''), '^\s+|\s+$', '', 'g'), '\s+', ' ', 'g'))
$$;

-- adItemProblem: first problem code or null
create or replace function kafaa_ad_item_problem(p jsonb) returns text language plpgsql stable security definer set search_path = public as $$
declare b kafaa_adaptive_banks; oe jsonb := case when jsonb_typeof(p -> 'options_en') = 'array' then p -> 'options_en' else '[]'::jsonb end;
  oa jsonb := case when jsonb_typeof(p -> 'options_ar') = 'array' then p -> 'options_ar' else '[]'::jsonb end; d numeric; se text; sa text; v_all text;
begin
  select * into b from kafaa_adaptive_banks where id = p ->> 'bank_id';
  if b.id is null then return 'bank'; end if;
  if not (coalesce(p ->> 'skill_id', '') = any(b.skill_ids)) then return 'skill'; end if;
  if jsonb_typeof(p -> 'facet') is distinct from 'string' or (p ->> 'facet') !~ '^[a-z][a-z0-9_]{0,39}$' then return 'facet'; end if;
  if jsonb_typeof(p -> 'difficulty') is distinct from 'number' then return 'difficulty'; end if;
  d := (p ->> 'difficulty')::numeric;
  if d < 1 or d >= 5 or d * 100 <> floor(d * 100) then return 'difficulty'; end if;
  se := case when jsonb_typeof(p -> 'stem_en') = 'string' then btrim(p ->> 'stem_en') else '' end;
  sa := case when jsonb_typeof(p -> 'stem_ar') = 'string' then btrim(p ->> 'stem_ar') else '' end;
  if se = '' or sa = '' or length(se) > 400 or length(sa) > 400 then return 'stem'; end if;
  if jsonb_array_length(oe) < 3 or jsonb_array_length(oe) > 4 or jsonb_array_length(oe) <> jsonb_array_length(oa) then return 'options'; end if;
  if exists (select 1 from (select e from jsonb_array_elements(oe) e union all select e from jsonb_array_elements(oa) e) x
             where jsonb_typeof(x.e) <> 'string' or btrim(x.e #>> '{}') = '' or length(btrim(x.e #>> '{}')) > 200) then return 'options'; end if;
  if jsonb_typeof(p -> 'correct') is distinct from 'number' or (p ->> 'correct')::numeric <> floor((p ->> 'correct')::numeric)
     or (p ->> 'correct')::numeric < 0 or (p ->> 'correct')::numeric >= jsonb_array_length(oe) then return 'correct'; end if;
  v_all := lower(concat_ws(' ', p ->> 'stem_en', p ->> 'stem_ar',
    (select string_agg(e #>> '{}', ' ' order by i) from jsonb_array_elements(oe) with ordinality q(e, i)),
    (select string_agg(e #>> '{}', ' ' order by i) from jsonb_array_elements(oa) with ordinality q(e, i)),
    coalesce(p ->> 'explain_en', ''), coalesce(p ->> 'explain_ar', '')));
  if exists (select 1 from unnest(array['vital area', 'protected area', 'security plan', 'guard force', 'design basis threat', 'safeguards', 'physical protection', 'alarm station',
      'access code', 'firewall rule', 'network diagram', 'ip address', 'clearance level', 'patrol route', 'camera coverage', 'exam answer']) w where position(w in v_all) > 0) then return 'restricted'; end if;
  if exists (select 1 from kafaa_item_versions v join kafaa_items i on i.id = v.item_id where i.bank = 'secure'
             and (kafaa_ad_norm_text(v.stem_en) in (kafaa_ad_norm_text(p ->> 'stem_en'), kafaa_ad_norm_text(p ->> 'stem_ar'))
                  or kafaa_ad_norm_text(v.stem_ar) in (kafaa_ad_norm_text(p ->> 'stem_en'), kafaa_ad_norm_text(p ->> 'stem_ar')))) then return 'secure_copy'; end if;
  return null;
end $$;

-- latest counting attempt per person in a bank (helper for overview and statistics)
create or replace function kafaa_ad_latest(p_bank text) returns table (person_id text, estimate integer) language sql stable security definer set search_path = public as $$
  select distinct on (a.person_id) a.person_id, a.estimate from kafaa_adaptive_attempts a
  where a.bank_id = p_bank and a.status = 'completed' and a.counts and a.estimate is not null
  order by a.person_id, a.completed_at desc, a.id collate "C" desc
$$;

-- bankStats + itemUsage (MIN_GROUP_SIZE 10)
create or replace function kafaa_ad_stats_core() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_banks jsonb; v_items jsonb;
begin
  select coalesce(jsonb_agg(x.j order by x.sort, x.id collate "C"), '[]'::jsonb) into v_banks from (
    select b.id, b.sort, (with l as (select * from kafaa_ad_latest(b.id)), t as (select count(*)::integer n, coalesce(sum(estimate), 0)::float8 s from l),
        crit as (select kafaa_ad_is_safety(b.id) or b.mode = 'criterion' c)
      select jsonb_build_object('bank_id', b.id, 'tested', t.n, 'n', case when t.n >= 10 then t.n else null end,
        'avg_estimate', case when t.n >= 10 then floor(t.s / t.n * 10 + 0.5) / 10 else null end,
        'dist', (select jsonb_agg(jsonb_build_object('level', lv, 'n', case when t.n >= 10 and (select count(*) from l where l.estimate = lv) >= 10 then (select count(*) from l where l.estimate = lv)::integer else null end) order by lv)
                 from generate_series(0, 4) lv),
        'pct_low', case when t.n >= 10 then floor((100 * (select count(*) from l where l.estimate <= 1))::float8 / t.n * 10 + 0.5) / 10 else null end,
        'pct_meets', case when t.n >= 10 and crit.c then floor((100 * (select count(*) from l where l.estimate >= b.cut_level))::float8 / t.n * 10 + 0.5) / 10 else null end,
        'criterion', crit.c)
      from t, crit) j
    from kafaa_adaptive_banks b) x;
  select coalesce(jsonb_agg(jsonb_build_object('item_id', i.id, 'seen', u.seen,
      'exposure', case when u.att > 0 then floor((100 * u.seen)::float8 / u.att * 10 + 0.5) / 10 else 0 end,
      'p_obs', case when u.seen >= 10 then floor((100 * u.ok)::float8 / u.seen + 0.5) / 100 else null end) order by i.id collate "C"), '[]'::jsonb) into v_items
  from kafaa_adaptive_items i cross join lateral (
    select (select count(*) from kafaa_adaptive_attempts a where a.bank_id = i.bank_id and a.status = 'completed')::integer att,
           count(r.*)::integer seen, count(r.*) filter (where (r.e ->> 'correct')::boolean)::integer ok
    from kafaa_adaptive_attempts a cross join lateral jsonb_array_elements(a.responses) r(e)
    where a.bank_id = i.bank_id and a.status = 'completed' and r.e ->> 'item_id' = i.id) u;
  return jsonb_build_object('banks', v_banks, 'items', v_items);
end $$;

-- overviewFor (adaptiveOverview for one person)
create or replace function kafaa_ad_overview_for(p_person text, p_today date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  select coalesce(jsonb_agg(x.j order by x.sort, x.id collate "C"), '[]'::jsonb) into v from (
    select b.id, b.sort, (
      with crit as (select kafaa_ad_is_safety(b.id) s, kafaa_ad_is_safety(b.id) or b.mode = 'criterion' c),
      op as (select a.id from kafaa_adaptive_attempts a where a.bank_id = b.id and a.person_id = p_person and a.status = 'in_progress' order by a.started_at desc limit 1),
      nx as (select case when exists (select 1 from op) then null else kafaa_ad_next_start(b.id, p_person, p_today) end d),
      lt as (select a.* from kafaa_adaptive_attempts a where a.bank_id = b.id and a.person_id = p_person and a.status = 'completed' and a.counts and a.estimate is not null
             order by a.completed_at desc, a.id collate "C" desc limit 1),
      g as (select count(*)::integer n, coalesce(sum(estimate), 0)::float8 s, count(*) filter (where estimate >= b.cut_level)::integer m from kafaa_ad_latest(b.id))
      select jsonb_build_object('bank_id', b.id, 'criterion', crit.c, 'safety', crit.s, 'in_progress', (select id from op), 'can_start', exists (select 1 from op) or nx.d is null,
        'next_on', nx.d,
        'latest', (select jsonb_build_object('attempt_id', lt.id, 'estimate', lt.estimate, 'meets', lt.meets, 'percentile', lt.percentile,
                     'completed_at', to_char(lt.completed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')) from lt),
        'enec_avg', case when g.n >= 10 and not crit.c then floor(g.s / g.n * 10 + 0.5) / 10 else null end,
        'enec_meets_pct', case when g.n >= 10 and crit.c then floor((100 * g.m)::float8 / g.n * 10 + 0.5) / 10 else null end,
        'enec_n', case when g.n >= 10 then g.n else null end,
        'attempts', (select count(*)::integer from kafaa_adaptive_attempts a where a.bank_id = b.id and a.person_id = p_person and a.status = 'completed'))
      from crit, nx, g) j
    from kafaa_adaptive_banks b where b.status = 'active') x;
  return jsonb_build_object('banks', v);
end $$;

-- ───────────── FS22 rules (mirror of src/modules/m05/perf.ts)
create or replace function kafaa_pt_trim(p text) returns text language sql immutable set search_path = public as $$
  select regexp_replace(coalesce(p, ''), '^\s+|\s+$', '', 'g')
$$;

create or replace function kafaa_pt_answer_problem(p_task text, a jsonb) returns text language plpgsql stable security definer set search_path = public as $$
declare t kafaa_performance_tasks; s jsonb; n integer; keys text[]; j text;
begin
  select * into t from kafaa_performance_tasks where id = p_task;
  if a is null or jsonb_typeof(a) <> 'object' then return 'answer'; end if;
  select x into s from jsonb_array_elements(coalesce(t.data -> 'series', '[]'::jsonb)) x where x ->> 'key' = a ->> 'series' and jsonb_typeof(a -> 'series') = 'string' limit 1;
  if s is null then return 'series'; end if;
  n := jsonb_array_length(coalesce(s -> 'values', '[]'::jsonb));
  if jsonb_typeof(a -> 'index') is distinct from 'number' or (a ->> 'index')::numeric <> floor((a ->> 'index')::numeric) or (a ->> 'index')::numeric < 0 or (a ->> 'index')::numeric >= n then return 'index'; end if;
  if jsonb_typeof(a -> 'decision') is distinct from 'number' or (a ->> 'decision')::numeric <> floor((a ->> 'decision')::numeric) or (a ->> 'decision')::numeric < 0
     or (a ->> 'decision')::numeric >= jsonb_array_length(coalesce(t.decisions, '[]'::jsonb)) then return 'decision'; end if;
  select coalesce(array_agg(c ->> 'key'), '{}'::text[]) into keys from jsonb_array_elements(coalesce(t.checks, '[]'::jsonb)) c;
  if jsonb_typeof(a -> 'checks') is distinct from 'array' then return 'checks'; end if;
  if exists (select 1 from jsonb_array_elements(a -> 'checks') c where jsonb_typeof(c) <> 'string' or not ((c #>> '{}') = any(keys)))
     or (select count(*) from jsonb_array_elements(a -> 'checks')) <> (select count(distinct c #>> '{}') from jsonb_array_elements(a -> 'checks') c) then return 'checks'; end if;
  j := case when jsonb_typeof(a -> 'justification') = 'string' then kafaa_pt_trim(a ->> 'justification') else '' end;
  if length(j) < 20 or length(j) > 1500 then return 'justification'; end if;
  return null;
end $$;

create or replace function kafaa_pt_auto(p_task text, a jsonb) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare k kafaa_perf_task_keys; i integer := (a ->> 'index')::integer; v_an integer := 0;
begin
  select * into k from kafaa_perf_task_keys where task_id = p_task;
  if a ->> 'series' = k.series then
    v_an := case when i between k.from_idx and k.to_idx then 3 when i between k.from_idx - 3 and k.to_idx + 3 then 2 else 1 end;
  end if;
  return jsonb_build_object('anomaly', v_an, 'decision', coalesce((k.decision_points ->> ((a ->> 'decision')::integer))::integer, 0));
end $$;

create or replace function kafaa_pt_scores_problem(p_rubric jsonb, p_scores jsonb) returns text language plpgsql immutable set search_path = public as $$
declare l jsonb; v jsonb;
begin
  if p_scores is null or jsonb_typeof(p_scores) <> 'object' then return 'scores'; end if;
  for l in select x from jsonb_array_elements(coalesce(p_rubric, '[]'::jsonb)) x where x ->> 'mode' = 'assessor' loop
    v := p_scores -> (l ->> 'key');
    if v is null or jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric <> floor((v #>> '{}')::numeric) or (v #>> '{}')::numeric < 0
       or (v #>> '{}')::numeric > (l ->> 'max')::numeric then return 'scores'; end if;
  end loop;
  return null;
end $$;

create or replace function kafaa_pt_score(p_rubric jsonb, p_pass integer, p_auto jsonb, p_manual jsonb) returns jsonb language plpgsql immutable set search_path = public as $$
declare l jsonb; s integer; v_lines jsonb := '[]'::jsonb; v_tot integer := 0; v_max integer := 0; v_crit boolean := false; v_pass boolean; v_reasons jsonb;
begin
  for l in select x from jsonb_array_elements(coalesce(p_rubric, '[]'::jsonb)) with ordinality q(x, i) order by i loop
    s := case l ->> 'mode' when 'auto_anomaly' then (p_auto ->> 'anomaly')::integer when 'auto_decision' then (p_auto ->> 'decision')::integer
         else coalesce((p_manual ->> (l ->> 'key'))::integer, 0) end;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object('key', l ->> 'key', 'max', (l ->> 'max')::integer, 'critical', coalesce((l ->> 'critical')::boolean, false), 'score', s));
    v_tot := v_tot + s; v_max := v_max + (l ->> 'max')::integer;
    if coalesce((l ->> 'critical')::boolean, false) and s = 0 then v_crit := true; end if;
  end loop;
  v_pass := not v_crit and 100 * v_tot >= p_pass * v_max;
  v_reasons := jsonb_build_array(jsonb_build_object('code', 'fs22_total', 'key', 'm05.pt.reason.total', 'vars', jsonb_build_object('total', v_tot, 'max', v_max, 'pass', p_pass)))
    || coalesce((select jsonb_agg(jsonb_build_object('code', 'fs22_line', 'key', 'm05.pt.reason.line.' || (x ->> 'key'), 'vars', jsonb_build_object('score', (x ->> 'score')::integer, 'max', (x ->> 'max')::integer)) order by i)
                 from jsonb_array_elements(v_lines) with ordinality q(x, i)), '[]'::jsonb);
  if v_crit then v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'fs22_critical', 'key', 'm05.pt.reason.critical')); end if;
  v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', case when v_pass then 'fs22_pass' else 'fs22_fail' end, 'key', 'm05.pt.reason.' || case when v_pass then 'pass' else 'fail' end));
  return jsonb_build_object('lines', v_lines, 'total', v_tot, 'max', v_max, 'pct', case when v_max > 0 then floor((100 * v_tot)::float8 / v_max + 0.5)::integer else 0 end,
    'passed', v_pass, 'critical_failed', v_crit, 'reasons', v_reasons);
end $$;

-- adaptiveIntegrity for an attempt as it completes (other attempts read from the table)
create or replace function kafaa_ir_adaptive(p_id text, p_person text, p_bank text, p_started timestamptz, p_completed timestamptz, p_resp jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare times integer[] := '{}'; prev timestamptz := p_started; r jsonb; at timestamptz; k integer := coalesce(jsonb_array_length(p_resp), 0); v_fast integer;
  v_time integer := floor(extract(epoch from (p_completed - p_started)))::integer; v_ret integer; v_rep integer; n integer; v_max integer; v_sum integer; v_med integer;
  srt integer[]; flags text[] := '{}';
begin
  for r in select e from jsonb_array_elements(coalesce(p_resp, '[]'::jsonb)) with ordinality q(e, i) order by i loop
    at := coalesce((r ->> 'at')::timestamptz, prev);
    times := times || floor(extract(epoch from (at - prev)))::integer;
    prev := at;
  end loop;
  select count(*) into v_fast from unnest(times) t where t < 5;
  select array_agg(t order by t) into srt from unnest(times) t;
  v_med := case when k = 0 then null when k % 2 = 1 then srt[k / 2 + 1] else floor((srt[k / 2] + srt[k / 2 + 1]) / 2.0)::integer end;
  select count(*) into v_ret from kafaa_adaptive_attempts x where x.id <> p_id and x.person_id = p_person and x.bank_id = p_bank and x.status = 'completed'
    and x.completed_at < p_started and x.completed_at >= p_started - interval '30 days';
  select count(*) into v_rep from jsonb_array_elements(coalesce(p_resp, '[]'::jsonb)) e
    where exists (select 1 from kafaa_adaptive_attempts x cross join lateral jsonb_array_elements(x.responses) q where x.person_id = p_person and x.bank_id = p_bank and x.id <> p_id
                  and x.status = 'completed' and x.completed_at < p_started and q ->> 'item_id' = e ->> 'item_id');
  select count(*) into n from kafaa_adaptive_attempts x where x.bank_id = p_bank and x.person_id <> p_person and x.status = 'completed' and x.completed_at < p_started;
  select coalesce(max(c), 0), coalesce(sum(c), 0) into v_max, v_sum from (
    select (select count(*) from kafaa_adaptive_attempts x where x.bank_id = p_bank and x.person_id <> p_person and x.status = 'completed' and x.completed_at < p_started
            and exists (select 1 from jsonb_array_elements(x.responses) q where q ->> 'item_id' = e ->> 'item_id'))::integer c
    from jsonb_array_elements(coalesce(p_resp, '[]'::jsonb)) e) y;
  if v_fast >= 3 then flags := flags || 'fast_answers'::text; end if;
  if v_time < 15 * k then flags := flags || 'short_time'::text; end if;
  if v_ret >= 2 then flags := flags || 'retakes'::text; end if;
  if k > 0 and 2 * v_rep > k then flags := flags || 'exposure'::text; end if;
  return jsonb_build_object('time_on_task_s', v_time, 'items', k, 'fast_items', v_fast, 'median_item_s', v_med, 'retakes', v_ret, 'resubmissions', 0, 'repeat_items', v_rep,
    'exposure_max', case when n > 0 then trim_scale(round(((200 * v_max + n) / (2 * n))::numeric / 100, 2)) else 0 end,
    'exposure_mean', case when n * k > 0 then trim_scale(round(((200 * v_sum + n * k) / (2 * n * k))::numeric / 100, 2)) else 0 end,
    'exposure_n', n, 'flags', to_jsonb(flags), 'status', case when cardinality(flags) > 0 then 'review' else 'clear' end);
end $$;

create or replace function kafaa_ir_task(p_id text, p_person text, p_task text, p_started timestamptz, p_submitted timestamptz, p_resub integer) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t kafaa_performance_tasks; v_time integer := floor(extract(epoch from (p_submitted - p_started)))::integer; v_ret integer; v_seen integer; flags text[] := '{}';
begin
  select * into t from kafaa_performance_tasks where id = p_task;
  select count(*) into v_ret from kafaa_task_attempts x where x.id <> p_id and x.person_id = p_person and x.task_id = p_task and x.status <> 'in_progress'
    and x.submitted_at < p_started and x.submitted_at >= p_started - interval '30 days';
  select count(distinct x.person_id) into v_seen from kafaa_task_attempts x where x.task_id = p_task and x.person_id <> p_person and x.status <> 'in_progress' and x.submitted_at < p_started;
  if v_time < t.min_minutes * 60 then flags := flags || 'short_time'::text; end if;
  if v_ret >= 2 then flags := flags || 'retakes'::text; end if;
  if p_resub >= 2 then flags := flags || 'resubmissions'::text; end if;
  if v_seen >= 20 then flags := flags || 'exposure'::text; end if;
  return jsonb_build_object('time_on_task_s', v_time, 'items', 0, 'fast_items', 0, 'median_item_s', null, 'retakes', v_ret, 'resubmissions', p_resub, 'repeat_items', 0,
    'exposure_max', null, 'exposure_mean', null, 'exposure_n', v_seen, 'flags', to_jsonb(flags), 'status', case when cardinality(flags) > 0 then 'review' else 'clear' end);
end $$;

create or replace function kafaa_ir_upsert(p_kind text, p_attempt text, p_person text, p_ref text, p_gates text[], p_ir jsonb) returns text language plpgsql security definer set search_path = public as $$
declare v_id text := 'ir-' || p_attempt;
begin
  insert into kafaa_integrity_reports (id, kind, attempt_id, person_id, ref_id, gates, created_at, time_on_task_s, items, fast_items, median_item_s, retakes, resubmissions, repeat_items,
    exposure_max, exposure_mean, exposure_n, flags, status, decision, reviewed_by, reviewed_at, review_note)
  values (v_id, p_kind, p_attempt, p_person, p_ref, p_gates, date_trunc('second', now()), (p_ir ->> 'time_on_task_s')::integer, (p_ir ->> 'items')::integer, (p_ir ->> 'fast_items')::integer,
    (p_ir ->> 'median_item_s')::integer, (p_ir ->> 'retakes')::integer, (p_ir ->> 'resubmissions')::integer, (p_ir ->> 'repeat_items')::integer,
    (p_ir ->> 'exposure_max')::numeric, (p_ir ->> 'exposure_mean')::numeric, (p_ir ->> 'exposure_n')::integer,
    array(select jsonb_array_elements_text(p_ir -> 'flags')), p_ir ->> 'status', null, null, null, null)
  on conflict (id) do update set created_at = excluded.created_at, time_on_task_s = excluded.time_on_task_s, items = excluded.items, fast_items = excluded.fast_items,
    median_item_s = excluded.median_item_s, retakes = excluded.retakes, resubmissions = excluded.resubmissions, repeat_items = excluded.repeat_items, exposure_max = excluded.exposure_max,
    exposure_mean = excluded.exposure_mean, exposure_n = excluded.exposure_n, flags = excluded.flags, status = excluded.status, decision = null, reviewed_by = null, reviewed_at = null, review_note = null;
  return v_id;
end $$;

create or replace function kafaa_ad_write_evidence(p_person text, p_table text, p_ref text, p_ev jsonb, p_note text, p_by text) returns void language plpgsql security definer set search_path = public as $$
declare e jsonb;
begin
  for e in select x from jsonb_array_elements(coalesce(p_ev, '[]'::jsonb)) x loop
    insert into kafaa_skill_evidence (id, person_id, skill_id, kind, ref_table, ref_id, level, basis, status, observed_on, note, recorded_by, active)
    values ('se:assessment:' || p_ref || ':' || (e ->> 'skill_id'), p_person, e ->> 'skill_id', 'assessment', p_table, p_ref, (e ->> 'level')::integer, 'evidenced', 'current', current_date, p_note, p_by, true)
    on conflict (id) do nothing;
  end loop;
end $$;

create or replace function kafaa_ad_step(p_attempt kafaa_adaptive_attempts, p_item text, p_level integer, p_result jsonb, p_resumed boolean default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('attempt_id', p_attempt.id, 'done', p_result is not null, 'answered', jsonb_array_length(coalesce(p_attempt.responses, '[]'::jsonb)),
    'max', (select max_items from kafaa_adaptive_banks where id = p_attempt.bank_id), 'level', p_level,
    'item', case when p_item is null then null else kafaa_ad_item_view(p_item) end, 'result', p_result)
    || case when p_resumed is null then '{}'::jsonb else jsonb_build_object('resumed', p_resumed) end
$$;

create or replace function kafaa_ad_result(p_attempt kafaa_adaptive_attempts) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('attempt_id', p_attempt.id, 'bank_id', p_attempt.bank_id, 'estimate', p_attempt.estimate, 'stop', p_attempt.stop, 'criterion', p_attempt.mode = 'criterion',
    'meets', p_attempt.meets, 'percentile', p_attempt.percentile, 'norm_n', p_attempt.norm_n, 'evidence', p_attempt.evidence, 'reasons', p_attempt.reasons, 'item_count', p_attempt.item_count,
    'path', coalesce((select jsonb_agg(jsonb_build_object('level', (r ->> 'level')::integer, 'correct', (r ->> 'correct')::boolean) order by i)
                      from jsonb_array_elements(p_attempt.responses) with ordinality q(r, i)), '[]'::jsonb),
    'integrity_id', p_attempt.integrity_id)
$$;

-- ───────────── RPC: my banks (skills_profile Own)
create or replace function kafaa_adaptive_overview() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if kafaa_me() is null or not kafaa_has_grant('skills_profile', array['Own']) then return null; end if;
  return kafaa_ad_overview_for(kafaa_me(), current_date);
end $$;

-- ───────────── RPC: start (or resume) an attempt
create or replace function kafaa_start_adaptive(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_bid text := coalesce(p ->> 'bank_id', ''); b kafaa_adaptive_banks; v_open kafaa_adaptive_attempts; v_next text; v_no integer; v_form integer;
  st jsonb; v_id text; row kafaa_adaptive_attempts; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('assess.adaptive.start', 'adaptive_attempts', null, 'not_signed_in', 'Sign in to use future-skills assessments'); end if;
  if not kafaa_has_grant('skills_profile', array['Own']) then return kafaa_refuse('assess.adaptive.start', 'adaptive_attempts', null, 'forbidden', 'Future-skills assessments are for ENEC staff'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  select * into b from kafaa_adaptive_banks where id = v_bid;
  if b.id is null or b.status <> 'active' then return kafaa_refuse('assess.adaptive.start', 'adaptive_attempts', null, 'not_found', 'Assessment bank not found', v_role); end if;
  select * into v_open from kafaa_adaptive_attempts where person_id = me and bank_id = v_bid and status = 'in_progress' order by started_at desc limit 1;
  if v_open.id is not null then
    a := kafaa_audit('assess.adaptive.start', 'adaptive_attempts', v_open.id, 'ok', 'resumed', 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Assessment resumed', a, null, kafaa_ad_step(v_open, v_open.current_item_id, (kafaa_ad_engine(v_open.responses) ->> 'level')::integer, null, true));
  end if;
  v_next := kafaa_ad_next_start(v_bid, me, current_date);
  if v_next is not null then return kafaa_refuse('assess.adaptive.start', 'adaptive_attempts', null, 'too_soon', 'You can retake this assessment from ' || v_next, v_role); end if;
  select count(*) + 1 into v_no from kafaa_adaptive_attempts where person_id = me and bank_id = v_bid;
  v_form := kafaa_ad_form(me, v_no);
  st := kafaa_ad_next(v_bid, '[]'::jsonb, v_form);
  if st ->> 'item_id' is null then return kafaa_refuse('assess.adaptive.start', 'adaptive_attempts', null, 'unavailable', 'The bank has no active item for this step; ask the training manager', v_role); end if;
  v_id := 'aa-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
  insert into kafaa_adaptive_attempts (id, bank_id, bank_version, person_id, attempt_no, form, mode, status, started_at, responses, current_item_id, item_count, gating, counts)
  values (v_id, v_bid, b.version, me, v_no, v_form, case when kafaa_ad_is_safety(v_bid) then 'criterion' else b.mode end, 'in_progress', date_trunc('second', now()), '[]'::jsonb,
          st ->> 'item_id', 0, cardinality(b.gates) > 0, true)
  returning * into row;
  a := kafaa_audit('assess.adaptive.start', 'adaptive_attempts', v_id, 'ok', b.code, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Assessment started', a, null, kafaa_ad_step(row, st ->> 'item_id', (st ->> 'level')::integer, null, false));
end $$;

-- ───────────── RPC: answer the current item; route or score server-side
create or replace function kafaa_answer_adaptive(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_aid text := coalesce(p ->> 'attempt_id', ''); at kafaa_adaptive_attempts; it kafaa_adaptive_items; b kafaa_adaptive_banks; v_choice integer;
  v_resp jsonb; nx jsonb; sc jsonb; v_safety boolean; v_now timestamptz := date_trunc('second', now()); v_ir text; l integer; a kafaa_audit_events; fin kafaa_adaptive_attempts;
begin
  if me is null then return kafaa_refuse('assess.adaptive.answer', 'adaptive_attempts', nullif(v_aid, ''), 'not_signed_in', 'Sign in to use future-skills assessments'); end if;
  if not kafaa_has_grant('skills_profile', array['Own']) then return kafaa_refuse('assess.adaptive.answer', 'adaptive_attempts', nullif(v_aid, ''), 'forbidden', 'Future-skills assessments are for ENEC staff'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  select * into at from kafaa_adaptive_attempts where id = v_aid for update;
  if at.id is null or at.person_id <> me then return kafaa_refuse('assess.adaptive.answer', 'adaptive_attempts', nullif(v_aid, ''), 'not_found', 'Attempt not found', v_role); end if;
  if at.status <> 'in_progress' then return kafaa_refuse('assess.adaptive.answer', 'adaptive_attempts', v_aid, 'invalid', 'This attempt is already complete', v_role); end if;
  if coalesce(p ->> 'item_id', '') = '' or p ->> 'item_id' is distinct from at.current_item_id then
    return kafaa_refuse('assess.adaptive.answer', 'adaptive_attempts', v_aid, 'invalid', 'Answer the item on screen first', v_role); end if;
  select * into it from kafaa_adaptive_items where id = at.current_item_id;
  if it.id is null then return kafaa_refuse('assess.adaptive.answer', 'adaptive_attempts', v_aid, 'not_found', 'Item not found', v_role); end if;
  if jsonb_typeof(p -> 'choice') is distinct from 'number' or (p ->> 'choice')::numeric <> floor((p ->> 'choice')::numeric)
     or (p ->> 'choice')::numeric < 0 or (p ->> 'choice')::numeric >= coalesce(array_length(it.options_en, 1), 0) then
    return kafaa_refuse('assess.adaptive.answer', 'adaptive_attempts', v_aid, 'invalid', 'Choose one of the options', v_role); end if;
  v_choice := (p ->> 'choice')::integer;
  select * into b from kafaa_adaptive_banks where id = at.bank_id;
  v_resp := at.responses || jsonb_build_array(jsonb_build_object('item_id', it.id, 'level', it.level, 'facet', it.facet, 'choice', v_choice, 'correct', v_choice = it.correct,
    'at', to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')));
  nx := kafaa_ad_next(b.id, v_resp, at.form);
  if not (nx ->> 'done')::boolean then
    update kafaa_adaptive_attempts set responses = v_resp, current_item_id = nx ->> 'item_id', item_count = jsonb_array_length(v_resp) where id = v_aid returning * into fin;
    a := kafaa_audit('assess.adaptive.answer', 'adaptive_attempts', v_aid, 'ok', jsonb_array_length(v_resp)::text, 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Answer recorded', a, null, kafaa_ad_step(fin, nx ->> 'item_id', (nx ->> 'level')::integer, null));
  end if;
  v_safety := kafaa_ad_is_safety(b.id);
  sc := kafaa_ad_score(b.id, at.mode, v_safety, v_resp, nx ->> 'stop', kafaa_ad_norm(b.id, me));
  -- the latest attempt on a bank replaces that bank's earlier evidence (kept, inactive)
  update kafaa_skill_evidence set active = false where person_id = me and ref_table = 'adaptive_attempts' and active
    and ref_id in (select id from kafaa_adaptive_attempts where person_id = me and bank_id = b.id and id <> v_aid);
  perform kafaa_ad_write_evidence(me, 'adaptive_attempts', v_aid, sc -> 'evidence', 'Adaptive assessment ' || b.code, me);
  if at.gating then
    v_ir := kafaa_ir_upsert('adaptive', v_aid, me, b.id, b.gates, kafaa_ir_adaptive(v_aid, me, b.id, at.started_at, v_now, v_resp));
  end if;
  update kafaa_adaptive_attempts set responses = v_resp, current_item_id = null, item_count = jsonb_array_length(v_resp), status = 'completed', completed_at = v_now,
    stop = sc ->> 'stop', estimate = (sc ->> 'estimate')::integer, meets = (sc ->> 'meets')::boolean, percentile = (sc ->> 'percentile')::integer, norm_n = (sc ->> 'norm_n')::integer,
    reasons = sc -> 'reasons', evidence = sc -> 'evidence', integrity_id = v_ir where id = v_aid returning * into fin;
  perform kafaa_skills_apply(me, current_date);
  l := kafaa_ledger('kafaa.assessment.adaptive', 'Adaptive assessment ' || b.code || ': level ' || (sc ->> 'estimate'));
  a := kafaa_audit('assess.adaptive.complete', 'adaptive_attempts', v_aid, 'ok', b.code || ' level ' || (sc ->> 'estimate'), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Assessment complete', a, l, kafaa_ad_step(fin, null, (nx ->> 'level')::integer, kafaa_ad_result(fin)));
end $$;

-- ───────────── RPC: results, calibration and exposure (training staff: secure_items W/A)
create or replace function kafaa_adaptive_stats() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if kafaa_me() is null or not kafaa_has_grant('secure_items', array['W', 'A']) then return null; end if;
  return kafaa_ad_stats_core();
end $$;

-- ───────────── RPC: add, edit or retire an adaptive item (training manager: secure_items A)
create or replace function kafaa_save_adaptive_item(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_given text := nullif(coalesce(p ->> 'id', ''), ''); cur kafaa_adaptive_items; v_problem text; v_status text; v_left integer;
  v_id text; v_version integer; v_sort integer; v_level integer; a kafaa_audit_events; v_oe text[]; v_oa text[];
begin
  if me is null then return kafaa_refuse('assess.adaptive.item', 'adaptive_items', v_given, 'not_signed_in', 'Sign in to use future-skills assessments'); end if;
  if not kafaa_has_grant('secure_items', array['A']) then return kafaa_refuse('assess.adaptive.item', 'adaptive_items', v_given, 'forbidden', 'Only the training manager edits adaptive banks'); end if;
  v_role := kafaa_acting_role('secure_items', array['A']);
  if v_given is not null then
    select * into cur from kafaa_adaptive_items where id = v_given;
    if cur.id is null then return kafaa_refuse('assess.adaptive.item', 'adaptive_items', v_given, 'not_found', 'Item not found', v_role); end if;
  end if;
  v_problem := kafaa_ad_item_problem(p);
  if v_problem is not null then
    return kafaa_refuse('assess.adaptive.item', 'adaptive_items', v_given, 'invalid', 'Check the item: ' || case v_problem
      when 'bank' then 'unknown bank' when 'skill' then 'the skill must be one of the bank''s skills' when 'facet' then 'a facet key (lower case letters, digits, _)'
      when 'difficulty' then 'difficulty from 1.00 to 4.99 (two decimals)' when 'stem' then 'a question in English and Arabic (up to 400 characters) is required'
      when 'options' then '3 or 4 options in both languages (up to 200 characters each)' when 'correct' then 'the answer must be one of the options'
      when 'restricted' then 'items never touch plant security or exam content' else 'the question copies a secure-bank item' end, v_role);
  end if;
  v_status := case when p ->> 'status' = 'retired' then 'retired' else 'active' end;
  v_level := floor((p ->> 'difficulty')::numeric)::integer;
  if cur.id is not null and cur.status = 'active' and (v_status = 'retired' or cur.bank_id <> p ->> 'bank_id' or cur.level <> v_level) then
    select count(*) into v_left from kafaa_adaptive_items where status = 'active' and id <> cur.id and bank_id = cur.bank_id and level = cur.level;
    if v_left < 2 then return kafaa_refuse('assess.adaptive.item', 'adaptive_items', v_given, 'conflict', 'Each bank level needs at least two active items', v_role); end if;
  end if;
  select array_agg(btrim(e #>> '{}') order by i) into v_oe from jsonb_array_elements(p -> 'options_en') with ordinality q(e, i);
  select array_agg(btrim(e #>> '{}') order by i) into v_oa from jsonb_array_elements(p -> 'options_ar') with ordinality q(e, i);
  if cur.id is not null then
    v_id := cur.id; v_version := cur.version + 1;
    update kafaa_adaptive_items set bank_id = p ->> 'bank_id', skill_id = p ->> 'skill_id', facet = p ->> 'facet', level = v_level, difficulty = (p ->> 'difficulty')::numeric,
      stem_en = btrim(p ->> 'stem_en'), stem_ar = btrim(p ->> 'stem_ar'), options_en = v_oe, options_ar = v_oa, correct = (p ->> 'correct')::integer,
      explain_en = btrim(coalesce(p ->> 'explain_en', '')), explain_ar = btrim(coalesce(p ->> 'explain_ar', '')), status = v_status, updated_by = me, updated_at = now(), version = v_version where id = v_id;
  else
    v_id := 'ai-' || regexp_replace(p ->> 'bank_id', '^ab-', '') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8); v_version := 1;
    select coalesce(max(sort), 0) + 1 into v_sort from kafaa_adaptive_items where bank_id = p ->> 'bank_id';
    insert into kafaa_adaptive_items (id, bank_id, skill_id, facet, level, difficulty, stem_en, stem_ar, options_en, options_ar, correct, explain_en, explain_ar, p_value, calib_n, status, version, sort, updated_by, updated_at)
    values (v_id, p ->> 'bank_id', p ->> 'skill_id', p ->> 'facet', v_level, (p ->> 'difficulty')::numeric, btrim(p ->> 'stem_en'), btrim(p ->> 'stem_ar'), v_oe, v_oa, (p ->> 'correct')::integer,
      btrim(coalesce(p ->> 'explain_en', '')), btrim(coalesce(p ->> 'explain_ar', '')), null, 0, v_status, 1, v_sort, me, now());
  end if;
  a := kafaa_audit('assess.adaptive.item', 'adaptive_items', v_id, 'ok', 'v' || v_version || ' ' || v_status, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when cur.id is not null then 'Item saved' else 'Item added' end, a, null, jsonb_build_object('id', v_id, 'version', v_version, 'status', v_status, 'level', v_level));
end $$;

-- ───────────── RPC: start (or resume) a performance task; the rubric must have been read
create or replace function kafaa_start_performance_task(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_tid text := coalesce(p ->> 'task_id', ''); t kafaa_performance_tasks; v_open kafaa_task_attempts; v_no integer; v_id text; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('assess.task.start', 'task_attempts', null, 'not_signed_in', 'Sign in to use future-skills assessments'); end if;
  if not kafaa_has_grant('skills_profile', array['Own']) then return kafaa_refuse('assess.task.start', 'task_attempts', null, 'forbidden', 'Future-skills assessments are for ENEC staff'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  select * into t from kafaa_performance_tasks where id = v_tid;
  if t.id is null or t.status <> 'active' then return kafaa_refuse('assess.task.start', 'task_attempts', null, 'not_found', 'Performance task not found', v_role); end if;
  if (p -> 'rubric_seen') is distinct from 'true'::jsonb then return kafaa_refuse('assess.task.start', 'task_attempts', null, 'rubric_not_seen', 'Read the rubric first: every line is shown before the attempt', v_role); end if;
  select * into v_open from kafaa_task_attempts where person_id = me and task_id = v_tid and status = 'in_progress' limit 1;
  if v_open.id is not null then
    a := kafaa_audit('assess.task.start', 'task_attempts', v_open.id, 'ok', 'resumed', 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Task resumed', a, null, jsonb_build_object('attempt_id', v_open.id, 'task_id', v_tid, 'rubric_version', v_open.rubric_version, 'resumed', true));
  end if;
  if exists (select 1 from kafaa_task_attempts where person_id = me and task_id = v_tid and status = 'submitted') then
    return kafaa_refuse('assess.task.start', 'task_attempts', null, 'pending', 'Your last attempt on this task is waiting for an assessor', v_role); end if;
  select count(*) + 1 into v_no from kafaa_task_attempts where person_id = me and task_id = v_tid;
  v_id := 'ta-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
  insert into kafaa_task_attempts (id, task_id, person_id, attempt_no, rubric_version, status, started_at, gating, counts)
  values (v_id, v_tid, me, v_no, t.rubric_version, 'in_progress', date_trunc('second', now()), cardinality(t.gates) > 0, true);
  a := kafaa_audit('assess.task.start', 'task_attempts', v_id, 'ok', t.code, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Task started', a, null, jsonb_build_object('attempt_id', v_id, 'task_id', v_tid, 'rubric_version', t.rubric_version, 'resumed', false));
end $$;

-- ───────────── RPC: submit (or resubmit before scoring) an answer
create or replace function kafaa_submit_performance_task(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_aid text := coalesce(p ->> 'attempt_id', ''); at kafaa_task_attempts; t kafaa_performance_tasks; v_problem text; v_ans jsonb; v_auto jsonb;
  v_resub integer; v_now timestamptz := date_trunc('second', now()); v_ir jsonb; v_irid text; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('assess.task.submit', 'task_attempts', nullif(v_aid, ''), 'not_signed_in', 'Sign in to use future-skills assessments'); end if;
  if not kafaa_has_grant('skills_profile', array['Own']) then return kafaa_refuse('assess.task.submit', 'task_attempts', nullif(v_aid, ''), 'forbidden', 'Future-skills assessments are for ENEC staff'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  select * into at from kafaa_task_attempts where id = v_aid for update;
  if at.id is null or at.person_id <> me then return kafaa_refuse('assess.task.submit', 'task_attempts', nullif(v_aid, ''), 'not_found', 'Attempt not found', v_role); end if;
  if at.status = 'scored' then return kafaa_refuse('assess.task.submit', 'task_attempts', v_aid, 'invalid', 'This attempt is already scored', v_role); end if;
  select * into t from kafaa_performance_tasks where id = at.task_id;
  v_problem := kafaa_pt_answer_problem(t.id, p -> 'answer');
  if v_problem is not null then
    return kafaa_refuse('assess.task.submit', 'task_attempts', v_aid, 'invalid', 'Check your answer: ' || case v_problem when 'answer' then 'an answer is required'
      when 'series' then 'mark the signal with the anomaly' when 'index' then 'mark the reading where it shows' when 'decision' then 'choose a decision'
      when 'checks' then 'tick only the listed checks, once each' else 'justify your decision in 20 to 1,500 characters' end, v_role);
  end if;
  v_ans := jsonb_build_object('series', p -> 'answer' ->> 'series', 'index', (p -> 'answer' ->> 'index')::integer, 'decision', (p -> 'answer' ->> 'decision')::integer,
    'checks', p -> 'answer' -> 'checks', 'justification', kafaa_pt_trim(p -> 'answer' ->> 'justification'));
  v_auto := kafaa_pt_auto(t.id, v_ans);
  v_resub := case when at.status = 'submitted' then at.resubmissions + 1 else at.resubmissions end;
  v_irid := at.integrity_id;
  if at.gating then
    v_ir := kafaa_ir_task(v_aid, me, t.id, at.started_at, v_now, v_resub);
    v_irid := kafaa_ir_upsert('task', v_aid, me, t.id, t.gates, v_ir);
  end if;
  update kafaa_task_attempts set status = 'submitted', submitted_at = v_now, answer = v_ans, auto_scores = v_auto, resubmissions = v_resub, integrity_id = v_irid where id = v_aid;
  a := kafaa_audit('assess.task.submit', 'task_attempts', v_aid, 'ok', case when at.status = 'submitted' then 'resubmitted ' || v_resub else 'submitted' end, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when at.status = 'submitted' then 'Answer replaced' else 'Answer submitted for scoring' end, a, null,
    jsonb_build_object('attempt_id', v_aid, 'resubmissions', v_resub, 'integrity_id', v_irid, 'integrity', v_ir));
end $$;

-- ───────────── RPC: score a submitted attempt (assessor: signoff A; never one's own)
create or replace function kafaa_score_performance_task(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_aid text := coalesce(p ->> 'attempt_id', ''); at kafaa_task_attempts; t kafaa_performance_tasks; v_comment text; v_manual jsonb; sc jsonb;
  v_ev jsonb; l integer; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('assess.task.score', 'task_attempts', nullif(v_aid, ''), 'not_signed_in', 'Sign in to use future-skills assessments'); end if;
  if not kafaa_has_grant('signoff', array['A']) then return kafaa_refuse('assess.task.score', 'task_attempts', nullif(v_aid, ''), 'forbidden', 'Only an assessor scores performance tasks'); end if;
  v_role := kafaa_acting_role('signoff', array['A']);
  select * into at from kafaa_task_attempts where id = v_aid for update;
  if at.id is null then return kafaa_refuse('assess.task.score', 'task_attempts', nullif(v_aid, ''), 'not_found', 'Attempt not found', v_role); end if;
  if at.status <> 'submitted' then return kafaa_refuse('assess.task.score', 'task_attempts', v_aid, 'invalid', 'Only a submitted attempt can be scored', v_role); end if;
  if at.person_id = me then return kafaa_refuse('assess.task.score', 'task_attempts', v_aid, 'self_score', 'An assessor cannot score their own attempt', v_role); end if;
  select * into t from kafaa_performance_tasks where id = at.task_id;
  if kafaa_pt_scores_problem(t.rubric, p -> 'scores') is not null then
    return kafaa_refuse('assess.task.score', 'task_attempts', v_aid, 'invalid', 'Score every assessor line with a whole number from 0 to its maximum', v_role); end if;
  v_comment := case when jsonb_typeof(p -> 'comment') = 'string' then kafaa_pt_trim(p ->> 'comment') else '' end;
  if length(v_comment) > 1000 then return kafaa_refuse('assess.task.score', 'task_attempts', v_aid, 'invalid', 'Keep the comment under 1,000 characters', v_role); end if;
  if at.gating and (at.integrity_id is null or not exists (select 1 from kafaa_integrity_reports ir where ir.id = at.integrity_id)) then return kafaa_refuse('assess.task.score', 'task_attempts', v_aid, 'integrity_missing', 'This attempt gates a credential and has no integrity report', v_role); end if;
  select coalesce(jsonb_object_agg(x ->> 'key', ((p -> 'scores') ->> (x ->> 'key'))::integer), '{}'::jsonb) into v_manual
    from jsonb_array_elements(t.rubric) x where x ->> 'mode' = 'assessor';
  sc := kafaa_pt_score(t.rubric, t.pass_pct, at.auto_scores, v_manual);
  select coalesce(jsonb_agg(jsonb_build_object('skill_id', s, 'level', t.evidence_level) order by s collate "C"), '[]'::jsonb) into v_ev
    from unnest(t.skill_ids) s where (sc ->> 'passed')::boolean;
  perform kafaa_ad_write_evidence(at.person_id, 'task_attempts', v_aid, v_ev, 'Performance task ' || t.code, me);
  update kafaa_task_attempts set status = 'scored', scores = v_manual, total = (sc ->> 'total')::integer, max = (sc ->> 'max')::integer, passed = (sc ->> 'passed')::boolean,
    critical_failed = (sc ->> 'critical_failed')::boolean, scored_by = me, scored_at = date_trunc('second', now()), comment = nullif(v_comment, ''), evidence = v_ev where id = v_aid;
  if jsonb_array_length(v_ev) > 0 then perform kafaa_skills_apply(at.person_id, current_date); end if;
  l := kafaa_ledger('kafaa.assessment.task_scored', 'Performance task ' || t.code || ': ' || case when (sc ->> 'passed')::boolean then 'pass' else 'not yet' end);
  a := kafaa_audit('assess.task.score', 'task_attempts', v_aid, 'ok', (sc ->> 'total') || '/' || (sc ->> 'max') || ' ' || case when (sc ->> 'passed')::boolean then 'pass' else 'fail' end,
    case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Attempt scored', a, l, jsonb_build_object('attempt_id', v_aid, 'total', (sc ->> 'total')::integer, 'max', (sc ->> 'max')::integer, 'pct', (sc ->> 'pct')::integer,
    'passed', (sc ->> 'passed')::boolean, 'critical_failed', (sc ->> 'critical_failed')::boolean, 'evidence', v_ev, 'reasons', sc -> 'reasons'));
end $$;

-- ───────────── RPC: accept or void a flagged integrity report (assessor: signoff A; not one's own)
create or replace function kafaa_review_integrity(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_rid text := coalesce(p ->> 'report_id', ''); r kafaa_integrity_reports; v_dec text := p ->> 'decision'; v_note text; l integer; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('assess.integrity.review', 'integrity_reports', nullif(v_rid, ''), 'not_signed_in', 'Sign in to use future-skills assessments'); end if;
  if not kafaa_has_grant('signoff', array['A']) then return kafaa_refuse('assess.integrity.review', 'integrity_reports', nullif(v_rid, ''), 'forbidden', 'Only an assessor scores performance tasks'); end if;
  v_role := kafaa_acting_role('signoff', array['A']);
  select * into r from kafaa_integrity_reports where id = v_rid for update;
  if r.id is null then return kafaa_refuse('assess.integrity.review', 'integrity_reports', nullif(v_rid, ''), 'not_found', 'Integrity report not found', v_role); end if;
  if r.status <> 'review' or r.decision is not null then return kafaa_refuse('assess.integrity.review', 'integrity_reports', v_rid, 'invalid', 'Only a flagged report waiting for review can be decided', v_role); end if;
  if r.person_id = me then return kafaa_refuse('assess.integrity.review', 'integrity_reports', v_rid, 'self_review', 'You cannot review your own integrity report', v_role); end if;
  if v_dec is null or v_dec not in ('accepted', 'voided') or jsonb_typeof(p -> 'decision') <> 'string' then return kafaa_refuse('assess.integrity.review', 'integrity_reports', v_rid, 'invalid', 'Choose accept or void', v_role); end if;
  v_note := case when jsonb_typeof(p -> 'note') = 'string' then kafaa_pt_trim(p ->> 'note') else '' end;
  if length(v_note) < 10 then return kafaa_refuse('assess.integrity.review', 'integrity_reports', v_rid, 'invalid', 'Give a reason of at least 10 characters', v_role); end if;
  update kafaa_integrity_reports set decision = v_dec, reviewed_by = me, reviewed_at = date_trunc('second', now()), review_note = v_note where id = v_rid;
  if v_dec = 'voided' then
    if r.kind = 'adaptive' then update kafaa_adaptive_attempts set counts = false where id = r.attempt_id;
    else update kafaa_task_attempts set counts = false where id = r.attempt_id; end if;
    update kafaa_skill_evidence set active = false where ref_id = r.attempt_id and active and ref_table in ('adaptive_attempts', 'task_attempts');
    perform kafaa_skills_apply(r.person_id, current_date);
  end if;
  l := kafaa_ledger('kafaa.assessment.integrity_review', 'Integrity report ' || v_rid || ': ' || v_dec);
  a := kafaa_audit('assess.integrity.review', 'integrity_reports', v_rid, 'ok', v_dec, case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when v_dec = 'voided' then 'Attempt voided; its evidence is withdrawn' else 'Report accepted' end, a, l, jsonb_build_object('report_id', v_rid, 'decision', v_dec));
end $$;

-- ───────────── Grants: internal helpers are not executable by API roles; RPCs only by signed-in users.
revoke all on function kafaa_ad_form(text, integer), kafaa_ad_engine(jsonb, integer), kafaa_ad_stop(text, jsonb), kafaa_ad_pick(text, integer, jsonb, integer), kafaa_ad_next(text, jsonb, integer),
  kafaa_ad_is_safety(text), kafaa_ad_percentile(integer, integer[]), kafaa_ad_norm(text, text, timestamptz), kafaa_ad_score(text, text, boolean, jsonb, text, integer[]),
  kafaa_ad_next_start(text, text, date), kafaa_ad_item_view(text), kafaa_ad_norm_text(text), kafaa_ad_item_problem(jsonb), kafaa_ad_latest(text), kafaa_ad_stats_core(),
  kafaa_ad_overview_for(text, date), kafaa_pt_trim(text), kafaa_pt_answer_problem(text, jsonb), kafaa_pt_auto(text, jsonb), kafaa_pt_scores_problem(jsonb, jsonb),
  kafaa_pt_score(jsonb, integer, jsonb, jsonb), kafaa_ir_adaptive(text, text, text, timestamptz, timestamptz, jsonb), kafaa_ir_task(text, text, text, timestamptz, timestamptz, integer),
  kafaa_ir_upsert(text, text, text, text, text[], jsonb), kafaa_ad_write_evidence(text, text, text, jsonb, text, text), kafaa_ad_step(kafaa_adaptive_attempts, text, integer, jsonb, boolean),
  kafaa_ad_result(kafaa_adaptive_attempts) from public, anon, authenticated;
revoke all on function kafaa_adaptive_overview(), kafaa_start_adaptive(jsonb), kafaa_answer_adaptive(jsonb), kafaa_adaptive_stats(), kafaa_save_adaptive_item(jsonb),
  kafaa_start_performance_task(jsonb), kafaa_submit_performance_task(jsonb), kafaa_score_performance_task(jsonb), kafaa_review_integrity(jsonb) from public, anon;
grant execute on function kafaa_adaptive_overview(), kafaa_start_adaptive(jsonb), kafaa_answer_adaptive(jsonb), kafaa_adaptive_stats(), kafaa_save_adaptive_item(jsonb),
  kafaa_start_performance_task(jsonb), kafaa_submit_performance_task(jsonb), kafaa_score_performance_task(jsonb), kafaa_review_integrity(jsonb) to authenticated;
