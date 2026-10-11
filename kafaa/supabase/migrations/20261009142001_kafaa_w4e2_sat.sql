-- [W4 · E2 · F27, F29] Kafa'a SAT and accreditation workbench (M26).
-- F27 SAT analysis workbench: job analyses per role (draft -> DIF survey -> approved), the task inventory (qualification-card task
-- items plus job-analysis tasks; security, safeguards and cyber tasks are title-less placeholders forced by a trigger), DIF ratings
-- by subject-matter experts (training staff, or an F21 SME who holds the role while the survey is open), the deterministic
-- train / no-train / overtrain rule (kafaa_sat_decision; the training manager decides, an override needs a reason; ledger row),
-- learning objectives and task-to-training links (coverage gaps, orphan objectives), and SAT changes that list the affected
-- courses, standards, JPMs and items (metadata only) and open one review item per course and standard (standards are revised
-- with the existing kafaa_revise_standard; ledger rows on open and close).
-- F29 Accreditation readiness: generic, paraphrased criteria sourced to public IAEA SAT guidance and FANR-REG-16 (no INPO/ACAD
-- text), programmes in scope, half-year self-evaluations with per-criterion ratings, evidence links suggested from Kafa'a data
-- (kafaa_accr_evidence: counts only; F25 L3 observations and F31 instructor tracks are used when those tables exist), gaps with
-- owners and due dates, and maker-checker finalisation by the training manager (never the sole author; ledger row).
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- LocalBackend mirror: src/modules/m26/backend/local.ts; rules: src/modules/m26/{sat,accr,evidence}.ts.
-- PGlite checks: scripts/validate/w4e2-sat.mjs. Policy resource: `sat` (instructor R/W, training_manager R/W/A, auditor R).

-- ───────────── Tables (generated DDL)
-- M26 · Job analysis of a role (SAT analysis phase): draft, DIF survey open, approved (F27)
create table if not exists kafaa_jta_analyses (
  id text primary key,
  role_id text not null unique,
  status text not null default 'draft' check (status in ('draft', 'survey', 'approved')),
  version integer not null default 1,
  owner_id text,
  survey_opened_on date,
  approved_by text,
  approved_on date,
  restricted boolean not null default false,
  notes_en text not null default '',
  notes_ar text not null default '',
  history jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
comment on table kafaa_jta_analyses is '[M26] Job analysis of a role (SAT analysis phase): draft, DIF survey open, approved (F27)';

-- M26 · Task inventory of a role: from qualification cards and the job analysis; restricted tasks are placeholders (F27)
create table if not exists kafaa_jta_tasks (
  id text primary key,
  role_id text not null,
  code text not null,
  title_en text not null,
  title_ar text not null,
  duty_en text not null default '',
  duty_ar text not null default '',
  source text not null default 'jta_survey' check (source in ('qual_card', 'jta_survey', 'oe', 'change')),
  task_item_id text,
  standard_id text,
  critical boolean not null default false,
  restricted boolean not null default false,
  status text not null default 'active' check (status in ('active', 'retired')),
  decision text not null default 'pending' check (decision in ('pending', 'train', 'no_train', 'overtrain')),
  decision_by text,
  decision_on date,
  decision_note text,
  override boolean not null default false,
  version integer not null default 1,
  created_by text,
  created_at timestamptz not null default now(),
  changed_at timestamptz not null default now(),
  sort integer not null default 0
);
comment on table kafaa_jta_tasks is '[M26] Task inventory of a role: from qualification cards and the job analysis; restricted tasks are placeholders (F27)';

-- M26 · DIF survey rating of a task by a subject-matter expert: difficulty, importance, frequency 1-5 (F27)
create table if not exists kafaa_dif_ratings (
  id text primary key,
  task_id text not null,
  rater_person_id text not null,
  d integer not null,
  i integer not null,
  f integer not null,
  note text not null default '',
  rater_kind text not null default 'sme' check (rater_kind in ('sme', 'instructor', 'developer')),
  rated_on date not null,
  active boolean not null default true
);
comment on table kafaa_dif_ratings is '[M26] DIF survey rating of a task by a subject-matter expert: difficulty, importance, frequency 1-5 (F27)';

-- M26 · Learning objective: terminal or enabling, from a course or written in the SAT design phase (F27)
create table if not exists kafaa_sat_objectives (
  id text primary key,
  code text not null,
  kind text not null default 'terminal' check (kind in ('terminal', 'enabling')),
  text_en text not null,
  text_ar text not null,
  course_id text,
  module_id text,
  competency_id text,
  role_id text,
  source text not null default 'course' check (source in ('course', 'sat')),
  status text not null default 'active' check (status in ('active', 'retired')),
  created_by text,
  updated_at timestamptz not null default now()
);
comment on table kafaa_sat_objectives is '[M26] Learning objective: terminal or enabling, from a course or written in the SAT design phase (F27)';

-- M26 · Task-to-training link: task -> learning objective -> course, module or JPM (F27)
create table if not exists kafaa_task_objectives (
  id text primary key,
  task_id text not null,
  objective_ref text not null,
  course_id text,
  module_id text,
  jpm_id text,
  active boolean not null default true,
  linked_by text,
  linked_at timestamptz not null default now()
);
comment on table kafaa_task_objectives is '[M26] Task-to-training link: task -> learning objective -> course, module or JPM (F27)';

-- M26 · SAT change: a task changed or was retired; lists the affected courses, standards, JPMs and items (metadata only) (F27)
create table if not exists kafaa_sat_changes (
  id text primary key,
  task_id text not null,
  role_id text not null,
  kind text not null check (kind in ('modified', 'retired')),
  trigger text not null default 'task_change' check (trigger in ('task_change', 'effectiveness', 'oe', 'regulatory')),
  summary text not null,
  before jsonb not null default '{}'::jsonb,
  after jsonb not null default '{}'::jsonb,
  impact jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'closed')),
  opened_by text not null,
  opened_by_name text not null default '',
  opened_by_name_ar text not null default '',
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);
comment on table kafaa_sat_changes is '[M26] SAT change: a task changed or was retired; lists the affected courses, standards, JPMs and items (metadata only) (F27)';

-- M26 · Review item of a SAT change: one per affected course and qualification standard (F27)
create table if not exists kafaa_sat_change_items (
  id text primary key,
  change_id text not null,
  kind text not null check (kind in ('course', 'standard')),
  ref_id text not null,
  title_en text not null default '',
  title_ar text not null default '',
  status text not null default 'open' check (status in ('open', 'updated', 'revised', 'no_change')),
  note text not null default '',
  revision_id text,
  closed_by text,
  closed_at timestamptz,
  sort integer not null default 0
);
comment on table kafaa_sat_change_items is '[M26] Review item of a SAT change: one per affected course and qualification standard (F27)';

-- M26 · Accreditation-readiness criterion: generic, paraphrased SAT-based objective sourced to public IAEA SAT guidance (F29)
create table if not exists kafaa_accr_criteria (
  id text primary key,
  code text not null unique,
  area text not null check (area in ('performance', 'environment', 'process', 'instructors', 'examinations')),
  phase text check (phase in ('analysis', 'design', 'development', 'implementation', 'evaluation')),
  title_en text not null,
  title_ar text not null,
  guidance_en text not null,
  guidance_ar text not null,
  evidence_kinds text[] not null default '{}'::text[],
  sources jsonb not null default '[]'::jsonb,
  sort integer not null default 0
);
comment on table kafaa_accr_criteria is '[M26] Accreditation-readiness criterion: generic, paraphrased SAT-based objective sourced to public IAEA SAT guidance (F29)';

-- M26 · Training programme in the accreditation-readiness scope: its roles, standards and courses (F29)
create table if not exists kafaa_accr_programmes (
  id text primary key,
  role_ids text[] not null default '{}'::text[],
  standard_ids text[] not null default '{}'::text[],
  course_ids text[] not null default '{}'::text[],
  owner_role text not null default 'training',
  active boolean not null default true,
  sort integer not null default 0
);
comment on table kafaa_accr_programmes is '[M26] Training programme in the accreditation-readiness scope: its roles, standards and courses (F29)';

-- M26 · Self-evaluation of a programme for a half-year cycle; finalised by the training manager, never by its sole author (F29)
create table if not exists kafaa_accr_selfevals (
  id text primary key,
  programme_id text not null,
  cycle text not null,
  status text not null default 'draft' check (status in ('draft', 'finalised')),
  opened_by text not null,
  opened_on date not null,
  finalised_by text,
  finalised_by_name text not null default '',
  finalised_by_name_ar text not null default '',
  finalised_at timestamptz,
  readiness integer,
  rated integer not null default 0,
  gaps integer not null default 0,
  authors text[] not null default '{}'::text[],
  summary_en text not null default '',
  summary_ar text not null default '',
  updated_at timestamptz not null default now()
);
comment on table kafaa_accr_selfevals is '[M26] Self-evaluation of a programme for a half-year cycle; finalised by the training manager, never by its sole author (F29)';

-- M26 · Self-rating of one criterion for a programme with evidence links, and a gap owner and due date when not met (F29)
create table if not exists kafaa_accr_assessments (
  id text primary key,
  selfeval_id text not null,
  programme_id text not null,
  criterion_id text not null,
  rating integer not null,
  evidence jsonb not null default '[]'::jsonb,
  gap_en text not null default '',
  owner_role text check (owner_role in ('training_manager', 'programme_lead', 'instructors', 'quality', 'line_management', 'hr')),
  due_on date,
  note text not null default '',
  rated_by text not null,
  rated_by_name text not null default '',
  rated_by_name_ar text not null default '',
  rated_at timestamptz not null default now(),
  history jsonb not null default '[]'::jsonb
);
comment on table kafaa_accr_assessments is '[M26] Self-rating of one criterion for a programme with evidence links, and a gap owner and due date when not met (F29)';

-- foreign keys and indexes (generated)
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_jta_analyses_role_id_fk') then alter table kafaa_jta_analyses add constraint kafaa_jta_analyses_role_id_fk foreign key (role_id) references kafaa_job_roles(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_jta_analyses_owner_id_fk') then alter table kafaa_jta_analyses add constraint kafaa_jta_analyses_owner_id_fk foreign key (owner_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_jta_tasks_role_id_fk') then alter table kafaa_jta_tasks add constraint kafaa_jta_tasks_role_id_fk foreign key (role_id) references kafaa_job_roles(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_jta_tasks_task_item_id_fk') then alter table kafaa_jta_tasks add constraint kafaa_jta_tasks_task_item_id_fk foreign key (task_item_id) references kafaa_task_items(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_jta_tasks_standard_id_fk') then alter table kafaa_jta_tasks add constraint kafaa_jta_tasks_standard_id_fk foreign key (standard_id) references kafaa_qual_standards(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_dif_ratings_task_id_fk') then alter table kafaa_dif_ratings add constraint kafaa_dif_ratings_task_id_fk foreign key (task_id) references kafaa_jta_tasks(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_dif_ratings_rater_person_id_fk') then alter table kafaa_dif_ratings add constraint kafaa_dif_ratings_rater_person_id_fk foreign key (rater_person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_sat_objectives_course_id_fk') then alter table kafaa_sat_objectives add constraint kafaa_sat_objectives_course_id_fk foreign key (course_id) references kafaa_courses(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_sat_objectives_module_id_fk') then alter table kafaa_sat_objectives add constraint kafaa_sat_objectives_module_id_fk foreign key (module_id) references kafaa_course_modules(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_sat_objectives_competency_id_fk') then alter table kafaa_sat_objectives add constraint kafaa_sat_objectives_competency_id_fk foreign key (competency_id) references kafaa_competencies(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_sat_objectives_role_id_fk') then alter table kafaa_sat_objectives add constraint kafaa_sat_objectives_role_id_fk foreign key (role_id) references kafaa_job_roles(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_task_objectives_task_id_fk') then alter table kafaa_task_objectives add constraint kafaa_task_objectives_task_id_fk foreign key (task_id) references kafaa_jta_tasks(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_task_objectives_objective_ref_fk') then alter table kafaa_task_objectives add constraint kafaa_task_objectives_objective_ref_fk foreign key (objective_ref) references kafaa_sat_objectives(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_task_objectives_course_id_fk') then alter table kafaa_task_objectives add constraint kafaa_task_objectives_course_id_fk foreign key (course_id) references kafaa_courses(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_task_objectives_module_id_fk') then alter table kafaa_task_objectives add constraint kafaa_task_objectives_module_id_fk foreign key (module_id) references kafaa_course_modules(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_task_objectives_jpm_id_fk') then alter table kafaa_task_objectives add constraint kafaa_task_objectives_jpm_id_fk foreign key (jpm_id) references kafaa_jpms(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_sat_changes_task_id_fk') then alter table kafaa_sat_changes add constraint kafaa_sat_changes_task_id_fk foreign key (task_id) references kafaa_jta_tasks(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_sat_changes_role_id_fk') then alter table kafaa_sat_changes add constraint kafaa_sat_changes_role_id_fk foreign key (role_id) references kafaa_job_roles(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_sat_changes_opened_by_fk') then alter table kafaa_sat_changes add constraint kafaa_sat_changes_opened_by_fk foreign key (opened_by) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_sat_change_items_change_id_fk') then alter table kafaa_sat_change_items add constraint kafaa_sat_change_items_change_id_fk foreign key (change_id) references kafaa_sat_changes(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_accr_programmes_id_fk') then alter table kafaa_accr_programmes add constraint kafaa_accr_programmes_id_fk foreign key (id) references kafaa_programmes(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_accr_selfevals_programme_id_fk') then alter table kafaa_accr_selfevals add constraint kafaa_accr_selfevals_programme_id_fk foreign key (programme_id) references kafaa_accr_programmes(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_accr_selfevals_opened_by_fk') then alter table kafaa_accr_selfevals add constraint kafaa_accr_selfevals_opened_by_fk foreign key (opened_by) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_accr_assessments_selfeval_id_fk') then alter table kafaa_accr_assessments add constraint kafaa_accr_assessments_selfeval_id_fk foreign key (selfeval_id) references kafaa_accr_selfevals(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_accr_assessments_programme_id_fk') then alter table kafaa_accr_assessments add constraint kafaa_accr_assessments_programme_id_fk foreign key (programme_id) references kafaa_accr_programmes(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_accr_assessments_criterion_id_fk') then alter table kafaa_accr_assessments add constraint kafaa_accr_assessments_criterion_id_fk foreign key (criterion_id) references kafaa_accr_criteria(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_accr_assessments_rated_by_fk') then alter table kafaa_accr_assessments add constraint kafaa_accr_assessments_rated_by_fk foreign key (rated_by) references kafaa_people(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_jta_analyses_status_idx on kafaa_jta_analyses (status);
create index if not exists kafaa_jta_analyses_owner_id_idx on kafaa_jta_analyses (owner_id);
create index if not exists kafaa_jta_tasks_role_id_idx on kafaa_jta_tasks (role_id);
create index if not exists kafaa_jta_tasks_task_item_id_idx on kafaa_jta_tasks (task_item_id);
create index if not exists kafaa_jta_tasks_standard_id_idx on kafaa_jta_tasks (standard_id);
create index if not exists kafaa_jta_tasks_status_idx on kafaa_jta_tasks (status);
create index if not exists kafaa_jta_tasks_decision_idx on kafaa_jta_tasks (decision);
create index if not exists kafaa_dif_ratings_task_id_idx on kafaa_dif_ratings (task_id);
create index if not exists kafaa_dif_ratings_rater_person_id_idx on kafaa_dif_ratings (rater_person_id);
create index if not exists kafaa_sat_objectives_course_id_idx on kafaa_sat_objectives (course_id);
create index if not exists kafaa_sat_objectives_module_id_idx on kafaa_sat_objectives (module_id);
create index if not exists kafaa_sat_objectives_competency_id_idx on kafaa_sat_objectives (competency_id);
create index if not exists kafaa_sat_objectives_role_id_idx on kafaa_sat_objectives (role_id);
create index if not exists kafaa_task_objectives_task_id_idx on kafaa_task_objectives (task_id);
create index if not exists kafaa_task_objectives_objective_ref_idx on kafaa_task_objectives (objective_ref);
create index if not exists kafaa_task_objectives_course_id_idx on kafaa_task_objectives (course_id);
create index if not exists kafaa_task_objectives_module_id_idx on kafaa_task_objectives (module_id);
create index if not exists kafaa_task_objectives_jpm_id_idx on kafaa_task_objectives (jpm_id);
create index if not exists kafaa_sat_changes_task_id_idx on kafaa_sat_changes (task_id);
create index if not exists kafaa_sat_changes_role_id_idx on kafaa_sat_changes (role_id);
create index if not exists kafaa_sat_changes_status_idx on kafaa_sat_changes (status);
create index if not exists kafaa_sat_changes_opened_by_idx on kafaa_sat_changes (opened_by);
create index if not exists kafaa_sat_change_items_change_id_idx on kafaa_sat_change_items (change_id);
create index if not exists kafaa_sat_change_items_status_idx on kafaa_sat_change_items (status);
create index if not exists kafaa_accr_criteria_area_idx on kafaa_accr_criteria (area);
create index if not exists kafaa_accr_selfevals_programme_id_idx on kafaa_accr_selfevals (programme_id);
create index if not exists kafaa_accr_selfevals_cycle_idx on kafaa_accr_selfevals (cycle);
create index if not exists kafaa_accr_selfevals_status_idx on kafaa_accr_selfevals (status);
create index if not exists kafaa_accr_selfevals_opened_by_idx on kafaa_accr_selfevals (opened_by);
create index if not exists kafaa_accr_assessments_selfeval_id_idx on kafaa_accr_assessments (selfeval_id);
create index if not exists kafaa_accr_assessments_programme_id_idx on kafaa_accr_assessments (programme_id);
create index if not exists kafaa_accr_assessments_criterion_id_idx on kafaa_accr_assessments (criterion_id);
create index if not exists kafaa_accr_assessments_rated_by_idx on kafaa_accr_assessments (rated_by);

-- ───────────── RLS (per-statement form)
alter table kafaa_jta_analyses enable row level security;
alter table kafaa_jta_tasks enable row level security;
alter table kafaa_dif_ratings enable row level security;
alter table kafaa_sat_objectives enable row level security;
alter table kafaa_task_objectives enable row level security;
alter table kafaa_sat_changes enable row level security;
alter table kafaa_sat_change_items enable row level security;
alter table kafaa_accr_criteria enable row level security;
alter table kafaa_accr_programmes enable row level security;
alter table kafaa_accr_selfevals enable row level security;
alter table kafaa_accr_assessments enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_jta_analyses' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_jta_analyses for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_jta_tasks' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_jta_tasks for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_dif_ratings' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_dif_ratings for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_sat_objectives' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_sat_objectives for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_task_objectives' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_task_objectives for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_sat_changes' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_sat_changes for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_sat_change_items' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_sat_change_items for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_accr_criteria' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_accr_criteria for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_accr_programmes' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_accr_programmes for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_accr_selfevals' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_accr_selfevals for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_accr_assessments' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_accr_assessments for select to anon, authenticated using (false)'; end if;
end $$;
alter policy kafaa_read on kafaa_accr_assessments using ((((SELECT kafaa_has_grant('sat'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_accr_criteria using ((((SELECT kafaa_has_grant('sat'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_accr_programmes using ((((SELECT kafaa_has_grant('sat'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_accr_selfevals using ((((SELECT kafaa_has_grant('sat'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_dif_ratings using (((((SELECT kafaa_has_grant('sat'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))) OR (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((rater_person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, rater_person_id, NULL::text, false)))));
alter policy kafaa_read on kafaa_jta_analyses using ((((SELECT kafaa_has_grant('sat'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_jta_tasks using ((((SELECT kafaa_has_grant('sat'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_sat_change_items using ((((SELECT kafaa_has_grant('sat'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_sat_changes using ((((SELECT kafaa_has_grant('sat'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_sat_objectives using ((((SELECT kafaa_has_grant('sat'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_task_objectives using ((((SELECT kafaa_has_grant('sat'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
revoke insert, update on kafaa_jta_analyses, kafaa_jta_tasks, kafaa_dif_ratings, kafaa_sat_objectives, kafaa_task_objectives, kafaa_sat_changes, kafaa_sat_change_items, kafaa_accr_criteria, kafaa_accr_programmes, kafaa_accr_selfevals, kafaa_accr_assessments from anon, authenticated;
grant select on kafaa_jta_analyses, kafaa_jta_tasks, kafaa_dif_ratings, kafaa_sat_objectives, kafaa_task_objectives, kafaa_sat_changes, kafaa_sat_change_items, kafaa_accr_criteria, kafaa_accr_programmes, kafaa_accr_selfevals, kafaa_accr_assessments to anon, authenticated;

-- ───────────── Restricted tasks never carry a title (security, safeguards and cyber tasks are managed outside Kafa'a)
create or replace function kafaa_sat_task_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if new.restricted then
    new.title_en := 'Restricted task — managed outside Kafa''a'; new.title_ar := 'مهمة مقيدة — تُدار خارج كفاءة'; new.duty_en := ''; new.duty_ar := '';
  end if;
  return new;
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'kafaa_sat_task_guard') then
    create trigger kafaa_sat_task_guard before insert or update on kafaa_jta_tasks for each row execute function kafaa_sat_task_guard();
  end if;
end $$;

-- ───────────── Internal helpers (not executable by API roles). Rules mirror src/modules/m26/{sat,accr,evidence}.ts.
create or replace function kafaa_sat_rid(p_prefix text) returns text language sql volatile set search_path = public as $$
  select p_prefix || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)
$$;
create or replace function kafaa_sat_isoday(p text) returns boolean language plpgsql immutable set search_path = public as $$
begin
  if p is null or p !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return false; end if;
  return to_char(p::date, 'YYYY-MM-DD') = p;
exception when others then return false;
end $$;
create or replace function kafaa_sat_str(p jsonb, k text) returns text language sql immutable set search_path = public as $$
  select case when jsonb_typeof(p->k) = 'string' then btrim(p->>k) else '' end
$$;
create or replace function kafaa_sat_reason(p_code text, p_vars jsonb) returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object('code', p_code, 'key', 'm26.reasons.' || p_code) || case when p_vars is null then '{}'::jsonb else jsonb_build_object('vars', p_vars) end
$$;
create or replace function kafaa_sat_restricted_role(p_role text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from kafaa_job_roles r where r.id = p_role and (r.security_sensitive or r.family_id in ('security', 'safeguards', 'cyber')))
$$;
create or replace function kafaa_sat_name(p_person text, p_ar boolean) returns text language sql stable security definer set search_path = public as $$
  select coalesce((select case when p_ar then coalesce(nullif(p.display_name_ar, ''), p.display_name) else p.display_name end from kafaa_people p where p.id = p_person), '')
$$;
-- difDecision(): first matching branch wins; total over 1..5 x 1..5 x 1..5.
create or replace function kafaa_sat_decision(d integer, i integer, f integer) returns jsonb language sql immutable set search_path = public as $$
  select case
    when i >= 4 and d >= 3 and f <= 2 then jsonb_build_object('decision', 'overtrain', 'rule', 'overtrain', 'reasons', jsonb_build_array(kafaa_sat_reason('dif_overtrain', jsonb_build_object('d', d, 'i', i, 'f', f)), kafaa_sat_reason('dif_refresh', null)))
    when i >= 3 then jsonb_build_object('decision', 'train', 'rule', 'important', 'reasons', jsonb_build_array(kafaa_sat_reason('dif_important', jsonb_build_object('d', d, 'i', i, 'f', f))))
    when d >= 4 then jsonb_build_object('decision', 'train', 'rule', 'difficult', 'reasons', jsonb_build_array(kafaa_sat_reason('dif_difficult', jsonb_build_object('d', d, 'i', i, 'f', f))))
    when d = 3 and f <= 2 then jsonb_build_object('decision', 'train', 'rule', 'rare_moderate', 'reasons', jsonb_build_array(kafaa_sat_reason('dif_rare_moderate', jsonb_build_object('d', d, 'i', i, 'f', f))))
    else jsonb_build_object('decision', 'no_train', 'rule', 'low', 'reasons', jsonb_build_array(kafaa_sat_reason('dif_low', jsonb_build_object('d', d, 'i', i, 'f', f))))
  end
$$;
-- proposal(): consensus = mean rounded half up (floor((2 sum + n) / 2n)); needs 3 active ratings.
create or replace function kafaa_sat_proposal(p_task text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare n int; sd int; si int; sf int; c jsonb; dd jsonb; sp_d int; sp_i int; sp_f int; v_d int; v_i int; v_f int; r jsonb;
begin
  select count(*)::int, coalesce(sum(d), 0)::int, coalesce(sum(i), 0)::int, coalesce(sum(f), 0)::int, coalesce(max(d) - min(d), 0)::int, coalesce(max(i) - min(i), 0)::int, coalesce(max(f) - min(f), 0)::int
    into n, sd, si, sf, sp_d, sp_i, sp_f from kafaa_dif_ratings where task_id = p_task and active is not false;
  if n = 0 then
    return jsonb_build_object('status', 'insufficient', 'n', 0, 'consensus', null, 'decision', null, 'rule', null, 'reasons', jsonb_build_array(kafaa_sat_reason('dif_insufficient', jsonb_build_object('n', 0, 'min', 3))));
  end if;
  v_d := (2 * sd + n) / (2 * n); v_i := (2 * si + n) / (2 * n); v_f := (2 * sf + n) / (2 * n);
  c := jsonb_build_object('n', n, 'd', v_d, 'i', v_i, 'f', v_f,
    'mean', jsonb_build_object('d', round(round(sd * 10.0 / n) / 10.0, 1), 'i', round(round(si * 10.0 / n) / 10.0, 1), 'f', round(round(sf * 10.0 / n) / 10.0, 1)),
    'spread', jsonb_build_object('d', sp_d, 'i', sp_i, 'f', sp_f), 'disagreement', sp_d >= 3 or sp_i >= 3 or sp_f >= 3);
  if n < 3 then
    return jsonb_build_object('status', 'insufficient', 'n', n, 'consensus', c, 'decision', null, 'rule', null, 'reasons', jsonb_build_array(kafaa_sat_reason('dif_insufficient', jsonb_build_object('n', n, 'min', 3))));
  end if;
  dd := kafaa_sat_decision(v_d, v_i, v_f);
  r := (dd->'reasons') || jsonb_build_array(kafaa_sat_reason('dif_raters', jsonb_build_object('n', n)));
  if sp_d >= 3 or sp_i >= 3 or sp_f >= 3 then r := r || jsonb_build_array(kafaa_sat_reason('dif_disagreement', jsonb_build_object('d', sp_d, 'i', sp_i, 'f', sp_f))); end if;
  return jsonb_build_object('status', 'proposed', 'n', n, 'consensus', c, 'decision', dd->>'decision', 'rule', dd->>'rule', 'reasons', r);
end $$;
-- changeImpact(): courses and standards of the active links (one review item each), JPMs, assessment items (metadata only).
create or replace function kafaa_sat_impact_compute(p_task text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t kafaa_jta_tasks; v_courses text[]; v_jpms text[]; v_stds text[]; v_comps text[]; v_objs text[];
begin
  select * into t from kafaa_jta_tasks where id = p_task;
  if t.id is null or t.restricted then return jsonb_build_object('courses', '[]'::jsonb, 'standards', '[]'::jsonb, 'jpms', '[]'::jsonb, 'items', '[]'::jsonb, 'objectives', '[]'::jsonb); end if;
  select coalesce(array_agg(distinct coalesce(l.course_id, o.course_id)) filter (where coalesce(l.course_id, o.course_id) is not null), '{}'),
         coalesce(array_agg(distinct o.competency_id) filter (where o.competency_id is not null), '{}'),
         coalesce(array_agg(distinct l.objective_ref), '{}')
    into v_courses, v_comps, v_objs
    from kafaa_task_objectives l left join kafaa_sat_objectives o on o.id = l.objective_ref where l.task_id = t.id and l.active;
  select coalesce(array_agg(distinct x), '{}') into v_jpms from (
    select l.jpm_id x from kafaa_task_objectives l where l.task_id = t.id and l.active and l.jpm_id is not null
    union select j.id from kafaa_jpms j where t.task_item_id is not null and j.task_id = t.task_item_id) s;
  select coalesce(array_agg(distinct x), '{}') into v_stds from (
    select t.standard_id x where t.standard_id is not null
    union select j.standard_id from kafaa_jpms j where j.id = any(v_jpms)) s;
  return jsonb_build_object(
    'courses', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'code', c.code, 'title_en', c.title_en, 'title_ar', c.title_ar) order by c.id collate "C") from kafaa_courses c where c.id = any(v_courses)), '[]'::jsonb),
    'standards', coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'code', q.code, 'title_en', q.title_en, 'title_ar', q.title_ar) order by q.id collate "C") from kafaa_qual_standards q where q.id = any(v_stds) and not q.security_restricted), '[]'::jsonb),
    'jpms', coalesce((select jsonb_agg(jsonb_build_object('id', j.id, 'code', j.code, 'title_en', j.title_en, 'title_ar', j.title_ar) order by j.id collate "C") from kafaa_jpms j
      where j.id = any(v_jpms) and not coalesce((select q.security_restricted from kafaa_qual_standards q where q.id = j.standard_id), false)), '[]'::jsonb),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', it.id, 'topic', it.topic, 'difficulty', it.difficulty, 'status', it.status, 'bank', it.bank) order by it.id collate "C") from kafaa_items it
      where it.competency_id = any(v_comps) and it.status <> 'retired'), '[]'::jsonb),
    'objectives', coalesce((select jsonb_agg(x order by x collate "C") from unnest(v_objs) x), '[]'::jsonb));
end $$;
-- roleCoverage(): the task-to-training matrix counts of a role (coverage gaps, orphan objectives).
create or replace function kafaa_sat_role_cov(p_role text) returns jsonb language sql stable security definer set search_path = public as $$
  with tasks as (select * from kafaa_jta_tasks where role_id = p_role and status = 'active' and not restricted),
  live as (select l.* from kafaa_task_objectives l join kafaa_jta_tasks t on t.id = l.task_id where l.active and t.status = 'active'),
  sel as (select t.id, exists (select 1 from live l where l.task_id = t.id) linked from tasks t where t.decision in ('train', 'overtrain')),
  curr as (
    select c.id from kafaa_courses c where coalesce(c.audience, 'staff') = 'staff'
      and exists (select 1 from kafaa_role_competencies rc where rc.role_id = p_role and rc.competency_id = any(c.competency_ids))
    union select l.course_id from kafaa_task_objectives l join kafaa_jta_tasks t on t.id = l.task_id where t.role_id = p_role and l.active and l.course_id is not null),
  scope as (select o.id from kafaa_sat_objectives o where o.status = 'active' and ((o.course_id is not null and o.course_id in (select id from curr)) or (o.source = 'sat' and o.role_id = p_role)))
  select jsonb_build_object('tasks', (select count(*) from tasks)::int, 'selected', (select count(*) from sel)::int, 'covered', (select count(*) from sel where linked)::int,
    'gaps', (select count(*) from sel where not linked)::int, 'orphans', (select count(*) from scope where id not in (select objective_ref from live))::int)
$$;
-- evidenceFacts(): counts only, never people. F25 L3 observations and F31 instructor tracks are used when their tables exist.
create or replace function kafaa_accr_evidence_compute(p_programme text, p_today date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare p kafaa_accr_programmes; v_courses text[]; v_comps text[]; out jsonb := '[]'::jsonb; r text; cov jsonb; n1 int; n2 int; n3 int; v_l3 int; v_l3c int; v_tracks int;
  v_year date := p_today - 365;
begin
  select * into p from kafaa_accr_programmes where id = p_programme;
  if p.id is null then return '[]'::jsonb; end if;
  select coalesce(array_agg(distinct x), '{}') into v_courses from (select c.id x from kafaa_courses c where c.programme_id = p.id union select unnest(p.course_ids)) s;
  -- traceability
  for r in select x from unnest(p.role_ids) x where exists (select 1 from kafaa_jta_analyses a where a.role_id = x and not a.restricted) order by x collate "C" loop
    cov := kafaa_sat_role_cov(r);
    out := out || jsonb_build_array(jsonb_build_object('kind', 'traceability', 'ref', r, 'route', '/training/sat/roles/' || r, 'm', cov));
  end loop;
  -- effectiveness
  if to_regclass('public.kafaa_l3_observations') is not null and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'kafaa_l3_observations' and column_name = 'course_id') then
    execute 'select count(*)::int, count(distinct course_id)::int from kafaa_l3_observations where course_id = any($1)' into v_l3, v_l3c using v_courses;
    if v_l3 > 0 then out := out || jsonb_build_array(jsonb_build_object('kind', 'effectiveness', 'ref', p.id, 'route', '/training/effectiveness', 'm', jsonb_build_object('l3', v_l3, 'courses', v_l3c))); end if;
  end if;
  select count(*)::int, count(*) filter (where evaluation_form_id is not null)::int into n1, n2 from kafaa_courses where id = any(v_courses);
  if n2 > 0 then out := out || jsonb_build_array(jsonb_build_object('kind', 'effectiveness', 'ref', p.id || ':forms', 'route', '/training/courses', 'm', jsonb_build_object('courses', n1, 'with_form', n2))); end if;
  -- item analysis
  select coalesce(array_agg(distinct x), '{}') into v_comps from (select unnest(c.competency_ids) x from kafaa_courses c where c.id = any(v_courses)) s;
  select count(*)::int into n1 from kafaa_items where status = 'approved' and competency_id = any(v_comps);
  select count(*)::int into n2 from kafaa_attempts a join kafaa_assessment_forms f on f.id = a.form_id where a.released and f.course_id = any(v_courses);
  if n1 > 0 or n2 > 0 then out := out || jsonb_build_array(jsonb_build_object('kind', 'item_analysis', 'ref', p.id, 'route', '/training/items', 'm', jsonb_build_object('items', n1, 'released', n2))); end if;
  -- instructor qualifications
  select count(distinct person_id)::int, count(distinct standard_id)::int into n1, n2 from kafaa_evaluator_quals where standard_id = any(p.standard_ids) and valid_to >= p_today;
  select count(distinct person_id)::int into n3 from kafaa_qual_records where standard_id = 'qs-instr' and status in ('qualified', 'due', 'renewed');
  if to_regclass('public.kafaa_instructor_tracks') is not null then
    execute 'select count(*)::int from kafaa_instructor_tracks' into v_tracks;
    if v_tracks > 0 then out := out || jsonb_build_array(jsonb_build_object('kind', 'instructor_quals', 'ref', p.id || ':tracks', 'route', '/training/instructors', 'm', jsonb_build_object('tracks', v_tracks, 'evaluators', n1, 'standards', n2))); end if;
  end if;
  if n1 > 0 then out := out || jsonb_build_array(jsonb_build_object('kind', 'instructor_quals', 'ref', p.id, 'route', '/training/quals/qs-instr', 'm', jsonb_build_object('evaluators', n1, 'standards', n2, 'instructors', n3))); end if;
  -- sign-off timeliness
  select count(*)::int, count(*) filter (where e.supervisor_ack_at is not null)::int into n1, n2
    from kafaa_evaluations e join kafaa_qual_records q on q.id = e.record_id where q.standard_id = any(p.standard_ids) and e.date >= v_year and e.date <= p_today;
  if n1 > 0 then out := out || jsonb_build_array(jsonb_build_object('kind', 'signoff_timeliness', 'ref', p.id, 'route', '/training/quals', 'm', jsonb_build_object('evaluations', n1, 'acknowledged', n2))); end if;
  -- programme records
  select count(*)::int, count(*) filter (where result in ('passed', 'completed'))::int into n1, n2 from kafaa_training_records where course_id = any(v_courses) and completed_on >= v_year and completed_on <= p_today;
  select count(*)::int into n3 from kafaa_sessions where course_id = any(v_courses) and coalesce(status, 'scheduled') <> 'cancelled';
  if n1 > 0 or n3 > 0 then out := out || jsonb_build_array(jsonb_build_object('kind', 'programme_records', 'ref', p.id, 'route', '/training/schedule', 'm', jsonb_build_object('records', n1, 'passed', n2, 'sessions', n3))); end if;
  return out;
end $$;
-- selfEvalState(): readiness = floor((200 x sum(rating - 1) + 3 x total) / (6 x total)); unrated criteria count 0.
create or replace function kafaa_accr_state(p_selfeval text) returns jsonb language sql stable security definer set search_path = public as $$
  with a as (select * from kafaa_accr_assessments where selfeval_id = p_selfeval), tot as (select count(*)::int n from kafaa_accr_criteria)
  select jsonb_build_object('rated', (select count(*) from a)::int, 'total', tot.n, 'gaps', (select count(*) from a where rating <= 2)::int,
    'unowned', (select count(*) from a where rating <= 2 and (owner_role is null or due_on is null))::int,
    'readiness', case when tot.n <= 0 then 0 else ((200 * coalesce((select sum(rating - 1) from a), 0) + 3 * tot.n) / (6 * tot.n))::int end,
    'complete', (select count(*) from a) >= tot.n,
    'authors', coalesce((select jsonb_agg(x order by x collate "C") from (select distinct rated_by x from a) s), '[]'::jsonb))
  from tot
$$;
create or replace function kafaa_accr_valid_evidence(e jsonb) returns boolean language sql immutable set search_path = public as $$
  select jsonb_typeof(e) = 'array' and jsonb_array_length(e) <= 8 and not exists (
    select 1 from jsonb_array_elements(e) x where jsonb_typeof(x) <> 'object'
      or coalesce(x->>'kind', '') not in ('traceability', 'effectiveness', 'item_analysis', 'instructor_quals', 'signoff_timeliness', 'programme_records')
      or jsonb_typeof(x->'ref') <> 'string' or length(x->>'ref') < 1 or length(x->>'ref') > 120
      or jsonb_typeof(x->'route') <> 'string' or left(x->>'route', 1) <> '/' or length(x->>'route') > 200
      or jsonb_typeof(x->'label_en') <> 'string' or length(x->>'label_en') > 200 or jsonb_typeof(x->'label_ar') <> 'string' or length(x->>'label_ar') > 200)
$$;
create or replace function kafaa_sat_ensure_analysis(p_role text) returns void language sql security definer set search_path = public as $$
  insert into kafaa_jta_analyses (id, role_id, status, version, owner_id, restricted, notes_en, notes_ar, history, updated_at)
  values ('jta-' || p_role, p_role, 'draft', 1, kafaa_me(), false, '', '', '[]'::jsonb, now()) on conflict (id) do nothing
$$;

create or replace function kafaa_sat_notify_survey(p_role text) returns integer language plpgsql security definer set search_path = public as $$
declare prev text := current_setting('kafaa.seeding', true); n int;
begin
  perform set_config('kafaa.seeding', 'on', true);
  insert into kafaa_notifications (id, person_id, kind, title_en, title_ar, link, severity)
  select 'nt-dif-' || p_role || '-' || to_char(current_date, 'YYYY-MM-DD') || '-' || s.person_id, s.person_id, 'sat', 'DIF survey open: ' || r.title_en,
    'استبيان الصعوبة والأهمية والتكرار مفتوح: ' || r.title_ar, '/training/sat/survey', 'info'
  from kafaa_sme_profiles s join kafaa_people pp on pp.id = s.person_id join kafaa_job_roles r on r.id = p_role where pp.job_role_id = p_role
  on conflict (id) do nothing;
  get diagnostics n = row_count;
  perform set_config('kafaa.seeding', coalesce(prev, ''), true);
  return n;
end $$;

-- ───────────── F27 RPCs
create or replace function kafaa_save_jta_task(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_tid text := kafaa_sat_str(p, 'id'); v_rid text := kafaa_sat_str(p, 'role_id'); v_en text := kafaa_sat_str(p, 'title_en'); v_ar text := kafaa_sat_str(p, 'title_ar');
  v_den text := kafaa_sat_str(p, 'duty_en'); v_dar text := kafaa_sat_str(p, 'duty_ar'); v_crit boolean := case when jsonb_typeof(p->'critical') = 'boolean' then (p->>'critical')::boolean else false end;
  t kafaa_jta_tasks; v_id text; v_n int; v_sort int; v_ent text; a kafaa_audit_events;
begin
  v_ent := coalesce(nullif(v_tid, ''), nullif(v_rid, ''));
  if me is null then return kafaa_refuse('sat.task.save', 'jta_tasks', v_ent, 'not_signed_in', 'Sign in to use the SAT workbench'); end if;
  if not kafaa_has_grant('sat', array['W', 'A']) then return kafaa_refuse('sat.task.save', 'jta_tasks', v_ent, 'forbidden', 'Only training staff with SAT rights can do this'); end if;
  v_role := kafaa_acting_role('sat', array['W', 'A']);
  if not exists (select 1 from kafaa_job_roles where id = v_rid) then return kafaa_refuse('sat.task.save', 'jta_tasks', v_ent, 'not_found', 'Role not found', v_role); end if;
  if kafaa_sat_restricted_role(v_rid) then return kafaa_refuse('sat.task.save', 'jta_tasks', v_ent, 'restricted', 'Tasks for security, safeguards and cyber roles are managed outside Kafa''a', v_role); end if;
  if length(v_en) < 5 or length(v_en) > 200 or length(v_ar) < 5 or length(v_ar) > 200 or length(v_den) > 200 or length(v_dar) > 200 then
    return kafaa_refuse('sat.task.save', 'jta_tasks', v_ent, 'invalid', 'Give the task a title in English and Arabic (5 to 200 characters each)', v_role); end if;
  if v_tid <> '' then
    select * into t from kafaa_jta_tasks where id = v_tid;
    if t.id is null or t.role_id <> v_rid then return kafaa_refuse('sat.task.save', 'jta_tasks', v_ent, 'not_found', 'Task not found', v_role); end if;
    if t.restricted then return kafaa_refuse('sat.task.save', 'jta_tasks', v_ent, 'restricted', 'Restricted task: security, safeguards and cyber tasks are managed outside Kafa''a', v_role); end if;
    if t.status <> 'active' then return kafaa_refuse('sat.task.save', 'jta_tasks', v_ent, 'invalid', 'This task is retired', v_role); end if;
    if exists (select 1 from kafaa_task_objectives where task_id = v_tid and active) then return kafaa_refuse('sat.task.save', 'jta_tasks', v_ent, 'change_required', 'This task is linked to training: open a SAT change so the impact is reviewed', v_role); end if;
    update kafaa_jta_tasks set title_en = v_en, title_ar = v_ar, duty_en = v_den, duty_ar = v_dar, critical = v_crit, changed_at = now() where id = v_tid;
    a := kafaa_audit('sat.task.save', 'jta_tasks', v_tid, 'ok', 'edited', 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Task saved', a, null, jsonb_build_object('id', v_tid));
  end if;
  select count(*)::int, coalesce(max(sort), 0)::int into v_n, v_sort from kafaa_jta_tasks where role_id = v_rid;
  v_id := kafaa_sat_rid('jt');
  perform kafaa_sat_ensure_analysis(v_rid);
  insert into kafaa_jta_tasks (id, role_id, code, title_en, title_ar, duty_en, duty_ar, source, critical, restricted, status, decision, override, version, created_by, created_at, changed_at, sort)
  values (v_id, v_rid, upper(array_to_string(array(select left(x, 1) from unnest(string_to_array(v_rid, '-')) with ordinality u(x, k) order by k), '')) || '-J' || lpad((v_n + 1)::text, 2, '0'),
    v_en, v_ar, v_den, v_dar, 'jta_survey', v_crit, false, 'active', 'pending', false, 1, me, now(), now(), v_sort + 1);
  a := kafaa_audit('sat.task.save', 'jta_tasks', v_id, 'ok', 'added to ' || v_rid, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Task added to the inventory', a, null, jsonb_build_object('id', v_id));
end $$;

create or replace function kafaa_rate_dif(p_task text, p_d integer, p_i integer, p_f integer, p_note text default '') returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; t kafaa_jta_tasks; v_staff boolean; v_sme boolean; v_status text; v_note text := btrim(coalesce(p_note, '')); v_id text; v_kind text; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('sat.dif.rate', 'dif_ratings', nullif(p_task, ''), 'not_signed_in', 'Sign in to use the SAT workbench'); end if;
  select * into t from kafaa_jta_tasks where id = p_task;
  v_staff := kafaa_has_grant('sat', array['W', 'A']);
  select a2.status into v_status from kafaa_jta_analyses a2 where t.id is not null and a2.id = 'jta-' || t.role_id;
  v_sme := exists (select 1 from kafaa_sme_profiles s where s.person_id = me) and t.id is not null and exists (select 1 from kafaa_people pp where pp.id = me and pp.job_role_id = t.role_id);
  if not v_staff and not v_sme then return kafaa_refuse('sat.dif.rate', 'dif_ratings', nullif(p_task, ''), 'forbidden', 'Only training staff or a subject-matter expert in this role can rate this task'); end if;
  v_role := case when v_staff then kafaa_acting_role('sat', array['W', 'A']) else kafaa_acting_role('own_profile', array['Own']) end;
  if t.id is null then return kafaa_refuse('sat.dif.rate', 'dif_ratings', nullif(p_task, ''), 'not_found', 'Task not found', v_role); end if;
  if t.restricted then return kafaa_refuse('sat.dif.rate', 'dif_ratings', p_task, 'restricted', 'Restricted task: security, safeguards and cyber tasks are managed outside Kafa''a', v_role); end if;
  if t.status <> 'active' then return kafaa_refuse('sat.dif.rate', 'dif_ratings', p_task, 'invalid', 'This task is retired', v_role); end if;
  if not v_staff and coalesce(v_status, '') <> 'survey' then return kafaa_refuse('sat.dif.rate', 'dif_ratings', p_task, 'survey_closed', 'The DIF survey for this role is not open', v_role); end if;
  if p_d is null or p_i is null or p_f is null or p_d not between 1 and 5 or p_i not between 1 and 5 or p_f not between 1 and 5 then
    return kafaa_refuse('sat.dif.rate', 'dif_ratings', p_task, 'invalid', 'Rate difficulty, importance and frequency as whole numbers from 1 to 5', v_role); end if;
  if length(v_note) > 500 then return kafaa_refuse('sat.dif.rate', 'dif_ratings', p_task, 'invalid', 'Keep the note under 500 characters', v_role); end if;
  v_id := 'dif:' || p_task || ':' || me;
  v_kind := case when not v_staff then 'sme' when kafaa_has_grant('sat', array['A']) then 'developer' else 'instructor' end;
  insert into kafaa_dif_ratings (id, task_id, rater_person_id, d, i, f, note, rater_kind, rated_on, active) values (v_id, p_task, me, p_d, p_i, p_f, v_note, v_kind, current_date, true)
  on conflict (id) do update set d = excluded.d, i = excluded.i, f = excluded.f, note = excluded.note, rater_kind = excluded.rater_kind, rated_on = excluded.rated_on, active = true;
  a := kafaa_audit('sat.dif.rate', 'dif_ratings', v_id, 'ok', format('D%s I%s F%s', p_d, p_i, p_f), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Rating saved', a, null, jsonb_build_object('id', v_id, 'proposal', kafaa_sat_proposal(p_task)));
end $$;

create or replace function kafaa_decide_training(p_task text, p_decision text, p_note text default '') returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; t kafaa_jta_tasks; v_note text := btrim(coalesce(p_note, '')); pr jsonb; v_over boolean; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('sat.decide', 'jta_tasks', nullif(p_task, ''), 'not_signed_in', 'Sign in to use the SAT workbench'); end if;
  if not kafaa_has_grant('sat', array['A']) then return kafaa_refuse('sat.decide', 'jta_tasks', nullif(p_task, ''), 'forbidden', 'Only the training manager decides train, no-train or overtrain'); end if;
  v_role := kafaa_acting_role('sat', array['A']);
  select * into t from kafaa_jta_tasks where id = p_task;
  if t.id is null then return kafaa_refuse('sat.decide', 'jta_tasks', nullif(p_task, ''), 'not_found', 'Task not found', v_role); end if;
  if t.restricted then return kafaa_refuse('sat.decide', 'jta_tasks', p_task, 'restricted', 'Restricted task: security, safeguards and cyber tasks are managed outside Kafa''a', v_role); end if;
  if t.status <> 'active' then return kafaa_refuse('sat.decide', 'jta_tasks', p_task, 'invalid', 'This task is retired', v_role); end if;
  if p_decision is null or p_decision not in ('train', 'overtrain', 'no_train') then return kafaa_refuse('sat.decide', 'jta_tasks', p_task, 'invalid', 'Choose train, no-train or overtrain', v_role); end if;
  if length(v_note) > 500 then return kafaa_refuse('sat.decide', 'jta_tasks', p_task, 'invalid', 'Keep the note under 500 characters', v_role); end if;
  pr := kafaa_sat_proposal(p_task);
  if pr->>'status' <> 'proposed' then return kafaa_refuse('sat.decide', 'jta_tasks', p_task, 'insufficient_ratings', 'At least 3 subject-matter expert ratings are needed before a training decision', v_role); end if;
  v_over := p_decision <> pr->>'decision';
  if v_over and length(v_note) < 10 then return kafaa_refuse('sat.decide', 'jta_tasks', p_task, 'note_required', 'Explain in at least 10 characters why the decision differs from the DIF rule', v_role); end if;
  update kafaa_jta_tasks set decision = p_decision, decision_by = me, decision_on = current_date, decision_note = nullif(v_note, ''), override = v_over, changed_at = now() where id = p_task;
  l := kafaa_ledger('kafaa.sat.training_decision', t.code || ': ' || p_decision || case when v_over then ' (override)' else '' end);
  a := kafaa_audit('sat.decide', 'jta_tasks', p_task, 'ok', p_decision || case when v_over then ' (rule: ' || (pr->>'decision') || ')' else '' end, case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Training decision recorded', a, l, jsonb_build_object('decision', p_decision, 'override', v_over));
end $$;

create or replace function kafaa_save_objective(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_oid text := kafaa_sat_str(p, 'id'); v_kind text := kafaa_sat_str(p, 'kind'); v_en text := kafaa_sat_str(p, 'text_en'); v_ar text := kafaa_sat_str(p, 'text_ar');
  v_course text := nullif(kafaa_sat_str(p, 'course_id'), ''); v_mod text := nullif(kafaa_sat_str(p, 'module_id'), ''); v_comp text := nullif(kafaa_sat_str(p, 'competency_id'), ''); v_rid text := nullif(kafaa_sat_str(p, 'role_id'), '');
  v_id text; v_n int; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('sat.objective.save', 'sat_objectives', nullif(v_oid, ''), 'not_signed_in', 'Sign in to use the SAT workbench'); end if;
  if not kafaa_has_grant('sat', array['W', 'A']) then return kafaa_refuse('sat.objective.save', 'sat_objectives', nullif(v_oid, ''), 'forbidden', 'Only training staff with SAT rights can do this'); end if;
  v_role := kafaa_acting_role('sat', array['W', 'A']);
  if v_kind not in ('terminal', 'enabling') or length(v_en) < 10 or length(v_en) > 400 or length(v_ar) < 10 or length(v_ar) > 400 then
    return kafaa_refuse('sat.objective.save', 'sat_objectives', nullif(v_oid, ''), 'invalid', 'Write the objective in English and Arabic (10 to 400 characters each)', v_role); end if;
  if v_course is not null and not exists (select 1 from kafaa_courses where id = v_course) then return kafaa_refuse('sat.objective.save', 'sat_objectives', nullif(v_oid, ''), 'not_found', 'Course not found', v_role); end if;
  if v_mod is not null and not exists (select 1 from kafaa_course_modules where id = v_mod and course_id is not distinct from v_course) then return kafaa_refuse('sat.objective.save', 'sat_objectives', nullif(v_oid, ''), 'not_found', 'Course module not found for this course', v_role); end if;
  if v_comp is not null and not exists (select 1 from kafaa_competencies where id = v_comp and domain <> 'security') then return kafaa_refuse('sat.objective.save', 'sat_objectives', nullif(v_oid, ''), 'invalid', 'Write the objective in English and Arabic (10 to 400 characters each)', v_role); end if;
  if v_rid is not null and not exists (select 1 from kafaa_job_roles where id = v_rid) then return kafaa_refuse('sat.objective.save', 'sat_objectives', nullif(v_oid, ''), 'not_found', 'Role not found', v_role); end if;
  if v_rid is not null and kafaa_sat_restricted_role(v_rid) then return kafaa_refuse('sat.objective.save', 'sat_objectives', nullif(v_oid, ''), 'restricted', 'Tasks for security, safeguards and cyber roles are managed outside Kafa''a', v_role); end if;
  if v_oid <> '' then
    if not exists (select 1 from kafaa_sat_objectives where id = v_oid) then return kafaa_refuse('sat.objective.save', 'sat_objectives', v_oid, 'not_found', 'Learning objective not found', v_role); end if;
    update kafaa_sat_objectives set kind = v_kind, text_en = v_en, text_ar = v_ar, module_id = v_mod, competency_id = v_comp, updated_at = now() where id = v_oid;
    a := kafaa_audit('sat.objective.save', 'sat_objectives', v_oid, 'ok', 'edited', 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Objective saved', a, null, jsonb_build_object('id', v_oid));
  end if;
  v_id := kafaa_sat_rid('obj-sat');
  select count(*)::int + 1 into v_n from kafaa_sat_objectives where source = 'sat';
  insert into kafaa_sat_objectives (id, code, kind, text_en, text_ar, course_id, module_id, competency_id, role_id, source, status, created_by, updated_at)
  values (v_id, 'SAT-' || lpad(v_n::text, 3, '0'), v_kind, v_en, v_ar, v_course, v_mod, v_comp, v_rid, 'sat', 'active', me, now());
  a := kafaa_audit('sat.objective.save', 'sat_objectives', v_id, 'ok', 'written', 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Objective written', a, null, jsonb_build_object('id', v_id));
end $$;

create or replace function kafaa_link_objective(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_tid text := kafaa_sat_str(p, 'task_id'); v_oid text := kafaa_sat_str(p, 'objective_ref'); v_id text; t kafaa_jta_tasks; o kafaa_sat_objectives; cur kafaa_task_objectives;
  v_course text; v_mod text := nullif(kafaa_sat_str(p, 'module_id'), ''); v_jpm text := nullif(kafaa_sat_str(p, 'jpm_id'), ''); v_std text; v_ent text; a kafaa_audit_events;
begin
  v_id := 'to:' || v_tid || ':' || v_oid;
  v_ent := case when v_tid <> '' then v_id end;
  if me is null then return kafaa_refuse('sat.link', 'task_objectives', v_ent, 'not_signed_in', 'Sign in to use the SAT workbench'); end if;
  if not kafaa_has_grant('sat', array['W', 'A']) then return kafaa_refuse('sat.link', 'task_objectives', v_ent, 'forbidden', 'Only training staff with SAT rights can do this'); end if;
  v_role := kafaa_acting_role('sat', array['W', 'A']);
  select * into t from kafaa_jta_tasks where id = v_tid;
  if t.id is null then return kafaa_refuse('sat.link', 'task_objectives', v_ent, 'not_found', 'Task not found', v_role); end if;
  if t.restricted then return kafaa_refuse('sat.link', 'task_objectives', v_ent, 'restricted', 'Restricted task: security, safeguards and cyber tasks are managed outside Kafa''a', v_role); end if;
  if t.status <> 'active' then return kafaa_refuse('sat.link', 'task_objectives', v_ent, 'invalid', 'This task is retired', v_role); end if;
  select * into cur from kafaa_task_objectives where id = v_id;
  if jsonb_typeof(p->'active') = 'boolean' and not (p->>'active')::boolean then
    if cur.id is null or not cur.active then return kafaa_refuse('sat.link', 'task_objectives', v_ent, 'not_found', 'This objective is not linked to the task', v_role); end if;
    update kafaa_task_objectives set active = false, linked_by = me, linked_at = now() where id = v_id;
    a := kafaa_audit('sat.link', 'task_objectives', v_id, 'ok', 'unlinked', 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Link removed', a, null, jsonb_build_object('id', v_id, 'active', false));
  end if;
  select * into o from kafaa_sat_objectives where id = v_oid;
  if o.id is null then return kafaa_refuse('sat.link', 'task_objectives', v_ent, 'not_found', 'Learning objective not found', v_role); end if;
  if o.status <> 'active' then return kafaa_refuse('sat.link', 'task_objectives', v_ent, 'invalid', 'This learning objective is retired', v_role); end if;
  if cur.id is not null and cur.active then return kafaa_refuse('sat.link', 'task_objectives', v_ent, 'conflict', 'This objective is already linked to the task', v_role); end if;
  v_course := coalesce(nullif(kafaa_sat_str(p, 'course_id'), ''), o.course_id);
  if v_course is not null and not exists (select 1 from kafaa_courses where id = v_course) then return kafaa_refuse('sat.link', 'task_objectives', v_ent, 'not_found', 'Course not found', v_role); end if;
  if v_mod is not null and not exists (select 1 from kafaa_course_modules where id = v_mod and course_id is not distinct from v_course) then return kafaa_refuse('sat.link', 'task_objectives', v_ent, 'not_found', 'Course module not found for this course', v_role); end if;
  if v_jpm is not null then
    select standard_id into v_std from kafaa_jpms where id = v_jpm;
    if v_std is null then return kafaa_refuse('sat.link', 'task_objectives', v_ent, 'not_found', 'JPM not found', v_role); end if;
    if exists (select 1 from kafaa_qual_standards where id = v_std and security_restricted) then return kafaa_refuse('sat.link', 'task_objectives', v_ent, 'restricted', 'This JPM belongs to a restricted standard', v_role); end if;
  end if;
  insert into kafaa_task_objectives (id, task_id, objective_ref, course_id, module_id, jpm_id, active, linked_by, linked_at) values (v_id, v_tid, v_oid, v_course, v_mod, v_jpm, true, me, now())
  on conflict (id) do update set course_id = excluded.course_id, module_id = excluded.module_id, jpm_id = excluded.jpm_id, active = true, linked_by = excluded.linked_by, linked_at = excluded.linked_at;
  a := kafaa_audit('sat.link', 'task_objectives', v_id, 'ok', 'linked' || coalesce(' ' || v_course, '') || coalesce(' ' || v_jpm, ''), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Objective linked', a, null, jsonb_build_object('id', v_id, 'active', true));
end $$;

create or replace function kafaa_sat_impact(p_task text) returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if kafaa_me() is null or not kafaa_has_grant('sat', array['R', 'W', 'A']) then return null; end if;
  if not exists (select 1 from kafaa_jta_tasks where id = p_task) then return null; end if;
  return kafaa_sat_impact_compute(p_task);
end $$;

create or replace function kafaa_open_sat_change(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_tid text := kafaa_sat_str(p, 'task_id'); t kafaa_jta_tasks; v_kind text := kafaa_sat_str(p, 'kind'); v_sum text := kafaa_sat_str(p, 'summary');
  v_trig text := coalesce(case when jsonb_typeof(p->'trigger') = 'string' then p->>'trigger' end, 'task_change'); v_en text := kafaa_sat_str(p, 'title_en'); v_ar text := kafaa_sat_str(p, 'title_ar');
  v_retitle boolean; imp jsonb; v_id text; v_before jsonb; v_after jsonb; v_items jsonb; v_n int; x jsonb; k int := 0; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('sat.change.open', 'sat_changes', nullif(v_tid, ''), 'not_signed_in', 'Sign in to use the SAT workbench'); end if;
  if not kafaa_has_grant('sat', array['W', 'A']) then return kafaa_refuse('sat.change.open', 'sat_changes', nullif(v_tid, ''), 'forbidden', 'Only training staff with SAT rights can do this'); end if;
  v_role := kafaa_acting_role('sat', array['W', 'A']);
  select * into t from kafaa_jta_tasks where id = v_tid;
  if t.id is null then return kafaa_refuse('sat.change.open', 'sat_changes', nullif(v_tid, ''), 'not_found', 'Task not found', v_role); end if;
  if t.restricted then return kafaa_refuse('sat.change.open', 'sat_changes', v_tid, 'restricted', 'Restricted task: security, safeguards and cyber tasks are managed outside Kafa''a', v_role); end if;
  if t.status <> 'active' then return kafaa_refuse('sat.change.open', 'sat_changes', v_tid, 'invalid', 'This task is retired', v_role); end if;
  if exists (select 1 from kafaa_sat_changes where task_id = v_tid and status = 'open') then return kafaa_refuse('sat.change.open', 'sat_changes', v_tid, 'conflict', 'An open SAT change already exists for this task; close its review items first', v_role); end if;
  if v_kind not in ('modified', 'retired') then return kafaa_refuse('sat.change.open', 'sat_changes', v_tid, 'invalid', 'Choose modified or retired', v_role); end if;
  if length(v_sum) < 10 or length(v_sum) > 500 then return kafaa_refuse('sat.change.open', 'sat_changes', v_tid, 'invalid', 'Describe the change in 10 to 500 characters', v_role); end if;
  if v_trig not in ('task_change', 'effectiveness', 'oe', 'regulatory') then return kafaa_refuse('sat.change.open', 'sat_changes', v_tid, 'invalid', 'Choose modified or retired', v_role); end if;
  v_retitle := v_kind = 'modified' and (v_en <> '' or v_ar <> '');
  if v_retitle and (length(v_en) < 5 or length(v_en) > 200 or length(v_ar) < 5 or length(v_ar) > 200) then return kafaa_refuse('sat.change.open', 'sat_changes', v_tid, 'invalid', 'Give the task a title in English and Arabic (5 to 200 characters each)', v_role); end if;
  imp := kafaa_sat_impact_compute(v_tid);
  v_id := kafaa_sat_rid('sc');
  v_before := jsonb_build_object('title_en', t.title_en, 'title_ar', t.title_ar, 'version', t.version, 'status', t.status);
  v_after := case when v_kind = 'retired' then v_before || jsonb_build_object('status', 'retired')
    else jsonb_build_object('title_en', case when v_retitle then v_en else t.title_en end, 'title_ar', case when v_retitle then v_ar else t.title_ar end, 'version', t.version + 1, 'status', 'active') end;
  v_items := coalesce((select jsonb_agg(c || jsonb_build_object('kind', 'course') order by e.ord) from jsonb_array_elements(imp->'courses') with ordinality e(c, ord)), '[]'::jsonb)
          || coalesce((select jsonb_agg(s || jsonb_build_object('kind', 'standard') order by e.ord) from jsonb_array_elements(imp->'standards') with ordinality e(s, ord)), '[]'::jsonb);
  v_n := jsonb_array_length(v_items);
  insert into kafaa_sat_changes (id, task_id, role_id, kind, trigger, summary, before, after, impact, status, opened_by, opened_by_name, opened_by_name_ar, opened_at, closed_at)
  values (v_id, v_tid, t.role_id, v_kind, v_trig, v_sum, v_before, v_after, imp, case when v_n > 0 then 'open' else 'closed' end, me, kafaa_sat_name(me, false), kafaa_sat_name(me, true), now(), case when v_n > 0 then null else now() end);
  for x in select e.value from jsonb_array_elements(v_items) with ordinality e(value, n) order by e.n loop
    k := k + 1;
    insert into kafaa_sat_change_items (id, change_id, kind, ref_id, title_en, title_ar, status, note, sort)
    values (v_id || '-' || k, v_id, x->>'kind', x->>'id', (x->>'code') || ' · ' || (x->>'title_en'), (x->>'code') || ' · ' || (x->>'title_ar'), 'open', '', k);
  end loop;
  update kafaa_jta_tasks set title_en = v_after->>'title_en', title_ar = v_after->>'title_ar', version = (v_after->>'version')::int, status = v_after->>'status', changed_at = now() where id = v_tid;
  l := kafaa_ledger('kafaa.sat.change_open', t.code || ' ' || v_kind || ': ' || v_n || ' review items');
  a := kafaa_audit('sat.change.open', 'sat_changes', v_id, 'ok', format('%s: %s courses, %s standards, %s JPMs, %s items', v_kind, jsonb_array_length(imp->'courses'), jsonb_array_length(imp->'standards'),
    jsonb_array_length(imp->'jpms'), jsonb_array_length(imp->'items')), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', format('Change recorded: %s review items opened', v_n), a, l, jsonb_build_object('id', v_id, 'items', v_n, 'impact', imp));
end $$;

create or replace function kafaa_resolve_sat_change_item(p_id text, p_outcome text, p_note text default '') returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; it kafaa_sat_change_items; v_note text := btrim(coalesce(p_note, '')); v_rev text; v_open int; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('sat.change.item', 'sat_change_items', nullif(p_id, ''), 'not_signed_in', 'Sign in to use the SAT workbench'); end if;
  if not kafaa_has_grant('sat', array['W', 'A']) then return kafaa_refuse('sat.change.item', 'sat_change_items', nullif(p_id, ''), 'forbidden', 'Only training staff with SAT rights can do this'); end if;
  v_role := kafaa_acting_role('sat', array['W', 'A']);
  select * into it from kafaa_sat_change_items where id = p_id;
  if it.id is null then return kafaa_refuse('sat.change.item', 'sat_change_items', nullif(p_id, ''), 'not_found', 'Review item not found', v_role); end if;
  if it.status <> 'open' then return kafaa_refuse('sat.change.item', 'sat_change_items', p_id, 'invalid', 'This review item is already closed', v_role); end if;
  if p_outcome is null or (it.kind = 'course' and p_outcome not in ('updated', 'no_change')) or (it.kind = 'standard' and p_outcome not in ('revised', 'no_change')) then
    return kafaa_refuse('sat.change.item', 'sat_change_items', p_id, 'invalid', 'Close a course item as updated or no change, a standard item as revised or no change', v_role); end if;
  if length(v_note) > 500 then return kafaa_refuse('sat.change.item', 'sat_change_items', p_id, 'invalid', 'Keep the note under 500 characters', v_role); end if;
  if p_outcome = 'no_change' and length(v_note) < 5 then return kafaa_refuse('sat.change.item', 'sat_change_items', p_id, 'invalid', 'Give a reason of at least 5 characters for no change', v_role); end if;
  if p_outcome = 'revised' then
    select q.id into v_rev from kafaa_qual_standards q where q.supersedes_id = it.ref_id order by q.id collate "C" limit 1;
    if v_rev is null then return kafaa_refuse('sat.change.item', 'sat_change_items', p_id, 'not_revised', 'Revise the standard first (a newer version must supersede it), then close the item', v_role); end if;
  end if;
  update kafaa_sat_change_items set status = p_outcome, note = v_note, revision_id = v_rev, closed_by = me, closed_at = now() where id = p_id;
  select count(*)::int into v_open from kafaa_sat_change_items where change_id = it.change_id and status = 'open';
  if v_open = 0 then
    update kafaa_sat_changes set status = 'closed', closed_at = now() where id = it.change_id;
    l := kafaa_ledger('kafaa.sat.change_close', it.change_id || ' closed');
    a := kafaa_audit('sat.change.item', 'sat_change_items', p_id, 'ok', p_outcome || '; change closed', case when l is null then 'skipped' else 'written' end, l, v_role);
    return kafaa_result(true, 'ok', 'Review item closed; the change is complete', a, l, jsonb_build_object('status', p_outcome, 'change_status', 'closed', 'revision_id', v_rev));
  end if;
  a := kafaa_audit('sat.change.item', 'sat_change_items', p_id, 'ok', p_outcome, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Review item closed', a, null, jsonb_build_object('status', p_outcome, 'change_status', 'open', 'revision_id', v_rev));
end $$;

create or replace function kafaa_set_analysis_status(p_role text, p_status text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_act text; v_id text := 'jta-' || coalesce(p_role, ''); an kafaa_jta_analyses; v_from text; v_ok boolean; v_ent text; a kafaa_audit_events; l integer;
begin
  v_ent := case when coalesce(p_role, '') <> '' then v_id end;
  if me is null then return kafaa_refuse('sat.analysis.status', 'jta_analyses', v_ent, 'not_signed_in', 'Sign in to use the SAT workbench'); end if;
  if not kafaa_has_grant('sat', array['W', 'A']) then return kafaa_refuse('sat.analysis.status', 'jta_analyses', v_ent, 'forbidden', 'Only training staff with SAT rights can do this'); end if;
  v_role := kafaa_acting_role('sat', array['W', 'A']);
  if not exists (select 1 from kafaa_job_roles where id = p_role) then return kafaa_refuse('sat.analysis.status', 'jta_analyses', v_ent, 'not_found', 'Role not found', v_role); end if;
  if kafaa_sat_restricted_role(p_role) then return kafaa_refuse('sat.analysis.status', 'jta_analyses', v_ent, 'restricted', 'Tasks for security, safeguards and cyber roles are managed outside Kafa''a', v_role); end if;
  select * into an from kafaa_jta_analyses where id = v_id;
  v_from := coalesce(an.status, 'draft');
  v_ok := (v_from = 'draft' and p_status = 'survey') or (v_from = 'survey' and p_status = 'draft') or (v_from <> 'approved' and p_status = 'approved') or (v_from = 'approved' and p_status = 'draft');
  if not coalesce(v_ok, false) then return kafaa_refuse('sat.analysis.status', 'jta_analyses', v_ent, 'invalid', 'Move a job analysis from draft to survey to approved', v_role); end if;
  if (p_status = 'approved' or v_from = 'approved') and not kafaa_has_grant('sat', array['A']) then return kafaa_refuse('sat.analysis.status', 'jta_analyses', v_ent, 'forbidden', 'Only the training manager approves a job analysis', v_role); end if;
  v_act := case when p_status = 'approved' or v_from = 'approved' then kafaa_acting_role('sat', array['A']) else v_role end;
  if p_status = 'approved' and exists (select 1 from kafaa_jta_tasks where role_id = p_role and status = 'active' and not restricted and decision = 'pending') then
    return kafaa_refuse('sat.analysis.status', 'jta_analyses', v_ent, 'undecided', 'Every active task needs a training decision before the analysis is approved', v_act); end if;
  perform kafaa_sat_ensure_analysis(p_role);
  select * into an from kafaa_jta_analyses where id = v_id;
  update kafaa_jta_analyses set status = p_status, updated_at = now(),
    history = coalesce(history, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'by', me, 'from', v_from, 'to', p_status)),
    survey_opened_on = case when p_status = 'survey' then current_date else survey_opened_on end,
    approved_by = case when p_status = 'approved' then me else approved_by end, approved_on = case when p_status = 'approved' then current_date else approved_on end,
    version = case when v_from = 'approved' and p_status = 'draft' then version + 1 else version end
  where id = v_id;
  if p_status = 'survey' then perform kafaa_sat_notify_survey(p_role); end if;
  if p_status = 'approved' then
    l := kafaa_ledger('kafaa.sat.analysis_approve', p_role || ' job analysis v' || an.version || ' approved');
    a := kafaa_audit('sat.analysis.status', 'jta_analyses', v_id, 'ok', v_from || ' -> ' || p_status, case when l is null then 'skipped' else 'written' end, l, v_act);
    return kafaa_result(true, 'ok', 'Job analysis approved', a, l, jsonb_build_object('status', p_status));
  end if;
  a := kafaa_audit('sat.analysis.status', 'jta_analyses', v_id, 'ok', v_from || ' -> ' || p_status, 'not_applicable', null, v_act);
  return kafaa_result(true, 'ok', case when p_status = 'survey' then 'DIF survey opened' else 'Job analysis back in draft' end, a, null, jsonb_build_object('status', p_status));
end $$;

create or replace function kafaa_dif_survey() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); v_rid text; an kafaa_jta_analyses;
begin
  if me is null then return jsonb_build_object('open', false, 'role_id', null, 'tasks', '[]'::jsonb); end if;
  select job_role_id into v_rid from kafaa_people where id = me;
  if v_rid is null then return jsonb_build_object('open', false, 'role_id', null, 'tasks', '[]'::jsonb); end if;
  if not exists (select 1 from kafaa_sme_profiles where person_id = me) and not kafaa_has_grant('sat', array['W', 'A']) then return jsonb_build_object('open', false, 'role_id', null, 'tasks', '[]'::jsonb); end if;
  select * into an from kafaa_jta_analyses where id = 'jta-' || v_rid;
  if an.id is null or an.status <> 'survey' or an.restricted or kafaa_sat_restricted_role(v_rid) then return jsonb_build_object('open', false, 'role_id', v_rid, 'tasks', '[]'::jsonb); end if;
  return jsonb_build_object('open', true, 'role_id', v_rid, 'tasks', coalesce((
    select jsonb_agg(jsonb_build_object('id', t.id, 'role_id', t.role_id, 'code', t.code, 'title_en', t.title_en, 'title_ar', t.title_ar, 'duty_en', coalesce(t.duty_en, ''), 'duty_ar', coalesce(t.duty_ar, ''),
      'critical', t.critical, 'mine', (select jsonb_build_object('d', r.d, 'i', r.i, 'f', r.f, 'note', coalesce(r.note, '')) from kafaa_dif_ratings r where r.id = 'dif:' || t.id || ':' || me and r.active is not false),
      'raters', (select count(*)::int from kafaa_dif_ratings r where r.task_id = t.id and r.active is not false)) order by t.sort, t.id collate "C")
    from kafaa_jta_tasks t where t.role_id = v_rid and t.status = 'active' and not t.restricted), '[]'::jsonb));
end $$;

-- ───────────── F29 RPCs
create or replace function kafaa_open_self_eval(p_programme text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_cycle text := to_char(current_date, 'YYYY') || '-H' || case when extract(month from current_date) <= 6 then 1 else 2 end; v_id text; v_ent text; a kafaa_audit_events;
begin
  v_id := 'ase-' || coalesce(p_programme, '') || '-' || v_cycle;
  v_ent := case when coalesce(p_programme, '') <> '' then v_id end;
  if me is null then return kafaa_refuse('accr.selfeval.open', 'accr_selfevals', v_ent, 'not_signed_in', 'Sign in to use the accreditation-readiness workbench'); end if;
  if not kafaa_has_grant('sat', array['W', 'A']) then return kafaa_refuse('accr.selfeval.open', 'accr_selfevals', v_ent, 'forbidden', 'Only training staff with SAT rights can do this'); end if;
  v_role := kafaa_acting_role('sat', array['W', 'A']);
  if not exists (select 1 from kafaa_accr_programmes where id = p_programme and active) then return kafaa_refuse('accr.selfeval.open', 'accr_selfevals', v_ent, 'not_found', 'Programme not in the accreditation-readiness scope', v_role); end if;
  if exists (select 1 from kafaa_accr_selfevals where programme_id = p_programme and status = 'draft') then return kafaa_refuse('accr.selfeval.open', 'accr_selfevals', v_ent, 'conflict', 'A draft self-evaluation for this programme is already open', v_role); end if;
  if exists (select 1 from kafaa_accr_selfevals where id = v_id) then return kafaa_refuse('accr.selfeval.open', 'accr_selfevals', v_ent, 'conflict', 'This programme already has a finalised self-evaluation for the current cycle', v_role); end if;
  insert into kafaa_accr_selfevals (id, programme_id, cycle, status, opened_by, opened_on, finalised_by_name, finalised_by_name_ar, readiness, rated, gaps, authors, summary_en, summary_ar, updated_at)
  values (v_id, p_programme, v_cycle, 'draft', me, current_date, '', '', 0, 0, 0, '{}', '', '', now());
  a := kafaa_audit('accr.selfeval.open', 'accr_selfevals', v_id, 'ok', v_cycle, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Self-evaluation ' || v_cycle || ' opened', a, null, jsonb_build_object('id', v_id, 'cycle', v_cycle));
end $$;

create or replace function kafaa_rate_criterion(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_se text := kafaa_sat_str(p, 'selfeval_id'); v_c text := kafaa_sat_str(p, 'criterion_id'); v_id text; se kafaa_accr_selfevals; v_rating int; v_ev jsonb := p->'evidence';
  v_gap text := kafaa_sat_str(p, 'gap_en'); v_note text := kafaa_sat_str(p, 'note'); v_owner text := nullif(kafaa_sat_str(p, 'owner_role'), ''); v_due text := nullif(kafaa_sat_str(p, 'due_on'), ''); v_isgap boolean;
  v_ent text; st jsonb; a kafaa_audit_events;
begin
  v_id := 'aa:' || v_se || ':' || v_c;
  v_ent := case when v_se <> '' then v_id end;
  if me is null then return kafaa_refuse('accr.rate', 'accr_assessments', v_ent, 'not_signed_in', 'Sign in to use the accreditation-readiness workbench'); end if;
  if not kafaa_has_grant('sat', array['W', 'A']) then return kafaa_refuse('accr.rate', 'accr_assessments', v_ent, 'forbidden', 'Only training staff with SAT rights can do this'); end if;
  v_role := kafaa_acting_role('sat', array['W', 'A']);
  select * into se from kafaa_accr_selfevals where id = v_se;
  if se.id is null then return kafaa_refuse('accr.rate', 'accr_assessments', v_ent, 'not_found', 'Self-evaluation not found', v_role); end if;
  if se.status <> 'draft' then return kafaa_refuse('accr.rate', 'accr_assessments', v_ent, 'invalid', 'This self-evaluation is finalised; open the next cycle to change ratings', v_role); end if;
  if not exists (select 1 from kafaa_accr_criteria where id = v_c) then return kafaa_refuse('accr.rate', 'accr_assessments', v_ent, 'not_found', 'Criterion not found', v_role); end if;
  if jsonb_typeof(p->'rating') <> 'number' or (p->>'rating')::numeric not in (1, 2, 3, 4) then return kafaa_refuse('accr.rate', 'accr_assessments', v_ent, 'invalid', 'Rate the criterion from 1 (not met) to 4 (met)', v_role); end if;
  v_rating := (p->>'rating')::numeric::int;
  if v_ev is null or not kafaa_accr_valid_evidence(v_ev) then return kafaa_refuse('accr.rate', 'accr_assessments', v_ent, 'invalid', 'Attach up to 8 evidence links of the known kinds', v_role); end if;
  if length(v_gap) > 500 or length(v_note) > 500 then return kafaa_refuse('accr.rate', 'accr_assessments', v_ent, 'invalid', 'Keep the gap description and note under 500 characters', v_role); end if;
  v_isgap := v_rating <= 2;
  if v_isgap and (v_owner is null or v_owner not in ('training_manager', 'programme_lead', 'instructors', 'quality', 'line_management', 'hr') or not kafaa_sat_isoday(v_due) or v_due::date < current_date or v_due::date > current_date + 365) then
    return kafaa_refuse('accr.rate', 'accr_assessments', v_ent, 'invalid', 'A gap (rating 1 or 2) needs an owner and a due date between today and one year from today', v_role); end if;
  insert into kafaa_accr_assessments (id, selfeval_id, programme_id, criterion_id, rating, evidence, gap_en, owner_role, due_on, note, rated_by, rated_by_name, rated_by_name_ar, rated_at, history)
  values (v_id, v_se, se.programme_id, v_c, v_rating,
    coalesce((select jsonb_agg(jsonb_build_object('kind', x->>'kind', 'ref', x->>'ref', 'route', x->>'route', 'label_en', x->>'label_en', 'label_ar', x->>'label_ar') order by k) from jsonb_array_elements(v_ev) with ordinality e(x, k)), '[]'::jsonb),
    case when v_isgap then v_gap else '' end, case when v_isgap then v_owner end, case when v_isgap then v_due::date end, v_note, me, kafaa_sat_name(me, false), kafaa_sat_name(me, true), now(),
    jsonb_build_array(jsonb_build_object('at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'by', me, 'rating', v_rating)))
  on conflict (id) do update set rating = excluded.rating, evidence = excluded.evidence, gap_en = excluded.gap_en, owner_role = excluded.owner_role, due_on = excluded.due_on, note = excluded.note,
    rated_by = excluded.rated_by, rated_by_name = excluded.rated_by_name, rated_by_name_ar = excluded.rated_by_name_ar, rated_at = excluded.rated_at,
    history = coalesce(kafaa_accr_assessments.history, '[]'::jsonb) || excluded.history;
  st := kafaa_accr_state(v_se);
  update kafaa_accr_selfevals set rated = (st->>'rated')::int, gaps = (st->>'gaps')::int, readiness = (st->>'readiness')::int,
    authors = array(select jsonb_array_elements_text(st->'authors')), updated_at = now() where id = v_se;
  a := kafaa_audit('accr.rate', 'accr_assessments', v_id, 'ok', 'rating ' || v_rating || case when v_isgap then ' gap -> ' || v_owner || ' by ' || v_due else '' end, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Criterion rated', a, null, jsonb_build_object('id', v_id, 'readiness', (st->>'readiness')::int, 'gaps', (st->>'gaps')::int));
end $$;

create or replace function kafaa_finalise_self_eval(p_id text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; se kafaa_accr_selfevals; st jsonb; v_authors text[]; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('accr.finalise', 'accr_selfevals', nullif(p_id, ''), 'not_signed_in', 'Sign in to use the accreditation-readiness workbench'); end if;
  if not kafaa_has_grant('sat', array['A']) then return kafaa_refuse('accr.finalise', 'accr_selfevals', nullif(p_id, ''), 'forbidden', 'Only the training manager finalises a self-evaluation'); end if;
  v_role := kafaa_acting_role('sat', array['A']);
  select * into se from kafaa_accr_selfevals where id = p_id;
  if se.id is null then return kafaa_refuse('accr.finalise', 'accr_selfevals', nullif(p_id, ''), 'not_found', 'Self-evaluation not found', v_role); end if;
  if se.status <> 'draft' then return kafaa_refuse('accr.finalise', 'accr_selfevals', p_id, 'invalid', 'This self-evaluation is finalised; open the next cycle to change ratings', v_role); end if;
  st := kafaa_accr_state(p_id);
  if not (st->>'complete')::boolean then return kafaa_refuse('accr.finalise', 'accr_selfevals', p_id, 'incomplete', 'Rate every criterion before finalising', v_role); end if;
  if (st->>'unowned')::int > 0 then return kafaa_refuse('accr.finalise', 'accr_selfevals', p_id, 'gaps_unowned', 'Every gap needs an owner and a due date before finalising', v_role); end if;
  v_authors := array(select jsonb_array_elements_text(st->'authors'));
  if cardinality(v_authors) > 0 and not exists (select 1 from unnest(v_authors) x where x <> me) then
    return kafaa_refuse('accr.finalise', 'accr_selfevals', p_id, 'maker_checker', 'A self-evaluation cannot be finalised by its sole author; another member of training staff must rate at least one criterion', v_role); end if;
  update kafaa_accr_selfevals set status = 'finalised', finalised_by = me, finalised_by_name = kafaa_sat_name(me, false), finalised_by_name_ar = kafaa_sat_name(me, true), finalised_at = now(),
    readiness = (st->>'readiness')::int, rated = (st->>'rated')::int, gaps = (st->>'gaps')::int, authors = v_authors, updated_at = now() where id = p_id;
  l := kafaa_ledger('kafaa.accr.finalise', se.programme_id || ' ' || se.cycle || ' self-evaluation finalised (' || (st->>'readiness') || '%)');
  a := kafaa_audit('accr.finalise', 'accr_selfevals', p_id, 'ok', 'readiness ' || (st->>'readiness') || '%, ' || (st->>'gaps') || ' gaps', case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Self-evaluation finalised', a, l, jsonb_build_object('status', 'finalised', 'readiness', (st->>'readiness')::int, 'gaps', (st->>'gaps')::int));
end $$;

create or replace function kafaa_accr_evidence(p_programme text) returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if kafaa_me() is null or not kafaa_has_grant('sat', array['R', 'W', 'A']) then return null; end if;
  if not exists (select 1 from kafaa_accr_programmes where id = p_programme) then return null; end if;
  return jsonb_build_object('programme_id', p_programme, 'today', to_char(current_date, 'YYYY-MM-DD'), 'facts', kafaa_accr_evidence_compute(p_programme, current_date));
end $$;

-- ───────────── Grants: internal helpers are not executable by API roles; RPCs only by signed-in users.
revoke all on function kafaa_sat_task_guard(), kafaa_sat_rid(text), kafaa_sat_isoday(text), kafaa_sat_str(jsonb, text), kafaa_sat_reason(text, jsonb), kafaa_sat_restricted_role(text), kafaa_sat_name(text, boolean),
  kafaa_sat_decision(integer, integer, integer), kafaa_sat_proposal(text), kafaa_sat_impact_compute(text), kafaa_sat_role_cov(text), kafaa_accr_evidence_compute(text, date), kafaa_accr_state(text),
  kafaa_accr_valid_evidence(jsonb), kafaa_sat_ensure_analysis(text), kafaa_sat_notify_survey(text) from public, anon, authenticated;
revoke all on function kafaa_save_jta_task(jsonb), kafaa_rate_dif(text, integer, integer, integer, text), kafaa_decide_training(text, text, text), kafaa_save_objective(jsonb), kafaa_link_objective(jsonb),
  kafaa_sat_impact(text), kafaa_open_sat_change(jsonb), kafaa_resolve_sat_change_item(text, text, text), kafaa_set_analysis_status(text, text), kafaa_dif_survey(),
  kafaa_open_self_eval(text), kafaa_rate_criterion(jsonb), kafaa_finalise_self_eval(text), kafaa_accr_evidence(text) from public, anon;
grant execute on function kafaa_save_jta_task(jsonb), kafaa_rate_dif(text, integer, integer, integer, text), kafaa_decide_training(text, text, text), kafaa_save_objective(jsonb), kafaa_link_objective(jsonb),
  kafaa_sat_impact(text), kafaa_open_sat_change(jsonb), kafaa_resolve_sat_change_item(text, text, text), kafaa_set_analysis_status(text, text), kafaa_dif_survey(),
  kafaa_open_self_eval(text), kafaa_rate_criterion(jsonb), kafaa_finalise_self_eval(text), kafaa_accr_evidence(text) to authenticated;
