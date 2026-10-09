-- [W3 · E2 · F20, F21] Kafa'a Knowledge continuity (M24): Knowledge Loss Risk Assessment (position register with synthetic HR
-- bands only, quarterly assessments with total = attrition x position, configurable thresholds, mitigation actions, a department
-- heatmap suppressed below 10) and the knowledge capture studio (SME opt-in profiles, structured capture interviews with transcript
-- text upload, knowledge assets with deterministic enrichment suggestions, a two-person review (technical + security and content
-- check, never the author or the SME), publishing by the knowledge-management owner, withdrawal, read-before-requalification
-- links and "used by" counts).
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file, RLS in the per-statement form,
-- internal helpers (not executable by API roles) and the RPCs. LocalBackend mirror: src/modules/m24/backend/local.ts; rules:
-- src/modules/m24/klra.ts and capture.ts. PGlite checks: scripts/validate/w3e2-knowledge.mjs. No new policy resource: the M24
-- tables use `knowledge` (KLRA rows through Scope rules or the A-only RPCs, never staff-wide) and `own_profile`.
-- Content screening reuses the M22 posting blocker (kafaa_cop_guard, kafaa_cop_contact from 20261009125001).

-- ───────────── Tables (generated DDL)
-- M24 · KLRA thresholds set by the knowledge-management owner (F20)
create table if not exists kafaa_klra_settings (
  id text primary key,
  high_threshold integer not null default 16,
  medium_threshold integer not null default 8,
  updated_by text,
  updated_at timestamptz not null default now(),
  history jsonb not null default '[]'::jsonb,
  open_read boolean not null default false
);
comment on table kafaa_klra_settings is '[M24] KLRA thresholds set by the knowledge-management owner (F20)';

-- M24 · KLRA position register: synthetic HR feed bands (no dates of birth or ages) and the F11 coverage snapshot (F20)
create table if not exists kafaa_klra_positions (
  id text primary key,
  person_id text,
  role_id text,
  family_id text,
  entity_id text,
  team_id text,
  crew text,
  department text not null check (department in ('operations', 'maintenance_engineering', 'rp_chem_ep', 'training_quality', 'corporate')),
  kind text not null default 'staff' check (kind in ('staff', 'ossa', 'contractor')),
  title_en text not null,
  title_ar text not null,
  holder_en text not null default '',
  holder_ar text not null default '',
  retirement_band text not null default 'na' check (retirement_band in ('within_2', '2_5', '5_plus', 'na')),
  contract_kind text not null default 'permanent' check (contract_kind in ('permanent', 'fixed_term', 'secondment', 'ossa')),
  contract_end_band text not null default 'none' check (contract_end_band in ('within_1', '1_2', '2_5', '5_plus', 'none')),
  criticality text not null default 'general' check (criticality in ('critical', 'regulated', 'qualified', 'general')),
  spof_skill_ids text[] not null default '{}'::text[],
  codified_base integer not null default 0,
  replace_months integer not null default 6,
  feed_as_of date not null,
  synthetic boolean not null default true,
  active boolean not null default true,
  open_read boolean not null default false
);
comment on table kafaa_klra_positions is '[M24] KLRA position register: synthetic HR feed bands (no dates of birth or ages) and the F11 coverage snapshot (F20)';

-- M24 · Quarterly knowledge loss risk assessment of a position: total = attrition x position (F20)
create table if not exists kafaa_klra_assessments (
  id text primary key,
  period text not null,
  position_id text not null,
  person_id text,
  department text not null,
  attrition_factor integer not null,
  position_factor integer not null,
  total integer not null,
  proposed_attrition integer not null,
  proposed_position integer not null,
  adjusted boolean not null default false,
  note text,
  reasons jsonb not null default '[]'::jsonb,
  drivers jsonb not null default '{}'::jsonb,
  assessed_by text not null,
  assessed_by_name text not null default '',
  assessed_by_name_ar text not null default '',
  assessed_at timestamptz not null default now(),
  open_read boolean not null default false
);
comment on table kafaa_klra_assessments is '[M24] Quarterly knowledge loss risk assessment of a position: total = attrition x position (F20)';

-- M24 · KLRA mitigation action for a position: capture, mentoring, successor, documentation or cross-training (F20)
create table if not exists kafaa_klra_actions (
  id text primary key,
  assessment_id text not null,
  position_id text not null,
  person_id text,
  period text not null,
  kind text not null check (kind in ('capture', 'mentoring', 'successor', 'documentation', 'cross_training')),
  owner_role text not null check (owner_role in ('km_owner', 'line_manager', 'training', 'hr', 'sme')),
  due_on date not null,
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'done', 'cancelled')),
  note text not null default '',
  ref_table text,
  ref_id text,
  outcome text,
  created_by text not null,
  created_at timestamptz not null default now(),
  closed_by text,
  closed_at timestamptz,
  open_read boolean not null default false
);
comment on table kafaa_klra_actions is '[M24] KLRA mitigation action for a position: capture, mentoring, successor, documentation or cross-training (F20)';

-- M24 · Subject-matter expert opt-in profile: skills, availability and capture window band (F21)
create table if not exists kafaa_sme_profiles (
  id text primary key,
  person_id text not null unique,
  kind text not null default 'staff' check (kind in ('staff', 'retiring', 'rotating', 'visiting_khnp', 'partner')),
  skill_ids text[] not null default '{}'::text[],
  availability text not null default 'available' check (availability in ('available', 'limited', 'unavailable')),
  departing_band text not null default 'unspecified' check (departing_band in ('within_2', '2_5', '5_plus', 'visiting', 'unspecified')),
  listed boolean not null default false,
  headline text not null default '',
  person_name text not null default '',
  person_name_ar text not null default '',
  role_id text,
  family_id text,
  updated_at timestamptz not null default now()
);
comment on table kafaa_sme_profiles is '[M24] Subject-matter expert opt-in profile: skills, availability and capture window band (F21)';

-- M24 · Structured knowledge-capture interview: plan, hold, transcribe (text upload only) (F21)
create table if not exists kafaa_capture_sessions (
  id text primary key,
  sme_id text not null,
  interviewer_id text not null,
  created_by text not null,
  template text not null check (template in ('critical_decisions', 'rules_of_thumb', 'war_stories', 'who_to_ask', 'documents')),
  title text not null,
  lang text not null default 'en' check (lang in ('en', 'ar')),
  status text not null default 'planned' check (status in ('planned', 'held', 'transcribed', 'cancelled')),
  planned_on date not null,
  held_on date,
  duration_min integer not null default 60,
  skill_ids text[] not null default '{}'::text[],
  standard_ids text[] not null default '{}'::text[],
  position_id text,
  action_id text,
  transcript text not null default '',
  transcript_words integer not null default 0,
  notes text not null default '',
  asset_id text,
  sme_name text not null default '',
  sme_name_ar text not null default '',
  interviewer_name text not null default '',
  interviewer_name_ar text not null default '',
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table kafaa_capture_sessions is '[M24] Structured knowledge-capture interview: plan, hold, transcribe (text upload only) (F21)';

-- M24 · Knowledge asset: summary, key points and links, published after a technical review and a security and content check (F21)
create table if not exists kafaa_knowledge_assets (
  id text primary key,
  title_en text not null,
  title_ar text not null,
  summary_en text not null,
  summary_ar text not null,
  body text not null,
  body_lang text not null default 'en' check (body_lang in ('en', 'ar')),
  key_points jsonb not null default '[]'::jsonb,
  skill_ids text[] not null default '{}'::text[],
  standard_ids text[] not null default '{}'::text[],
  requal_standard_ids text[] not null default '{}'::text[],
  oe_ids text[] not null default '{}'::text[],
  course_ids text[] not null default '{}'::text[],
  system_family text not null check (system_family in ('reactor_core', 'primary', 'secondary', 'electrical', 'i_and_c', 'chemistry', 'radiation_protection', 'maintenance', 'outage', 'human_performance', 'emergency_preparedness', 'training')),
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'withdrawn')),
  published boolean not null default false,
  reviewers text[] not null default '{}'::text[],
  suggestions jsonb not null default '[]'::jsonb,
  author_id text not null,
  sme_id text not null,
  source_session_id text,
  position_id text,
  author_name text not null default '',
  author_name_ar text not null default '',
  sme_name text not null default '',
  sme_name_ar text not null default '',
  template text,
  used_by integer not null default 0,
  version integer not null default 1,
  submitted_at timestamptz,
  published_at timestamptz,
  published_by text,
  withdrawn_at timestamptz,
  withdrawn_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table kafaa_knowledge_assets is '[M24] Knowledge asset: summary, key points and links, published after a technical review and a security and content check (F21)';

-- M24 · Review of a knowledge asset: technical review or security and content check (two different people, never the author) (F21)
create table if not exists kafaa_asset_reviews (
  id text primary key,
  asset_id text not null,
  asset_author_id text not null,
  reviewer_id text not null,
  kind text not null check (kind in ('technical', 'security')),
  outcome text not null check (outcome in ('pass', 'changes')),
  note text not null default '',
  checks jsonb not null default '{}'::jsonb,
  decisions jsonb not null default '{}'::jsonb,
  reviewer_name text not null default '',
  reviewer_name_ar text not null default '',
  superseded boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now()
);
comment on table kafaa_asset_reviews is '[M24] Review of a knowledge asset: technical review or security and content check (two different people, never the author) (F21)';

-- M24 · A person marked a knowledge asset as used (feeds the "used by N" count, shown from 10) (F21)
create table if not exists kafaa_asset_uses (
  id text primary key,
  asset_id text not null,
  person_id text not null,
  used_on date not null
);
comment on table kafaa_asset_uses is '[M24] A person marked a knowledge asset as used (feeds the "used by N" count, shown from 10) (F21)';

create index if not exists kafaa_klra_positions_person_id_idx on kafaa_klra_positions (person_id);
create index if not exists kafaa_klra_positions_role_id_idx on kafaa_klra_positions (role_id);
create index if not exists kafaa_klra_positions_family_id_idx on kafaa_klra_positions (family_id);
create index if not exists kafaa_klra_positions_department_idx on kafaa_klra_positions (department);
create index if not exists kafaa_klra_assessments_period_idx on kafaa_klra_assessments (period);
create index if not exists kafaa_klra_assessments_position_id_idx on kafaa_klra_assessments (position_id);
create index if not exists kafaa_klra_assessments_person_id_idx on kafaa_klra_assessments (person_id);
create index if not exists kafaa_klra_assessments_assessed_by_idx on kafaa_klra_assessments (assessed_by);
create index if not exists kafaa_klra_actions_assessment_id_idx on kafaa_klra_actions (assessment_id);
create index if not exists kafaa_klra_actions_position_id_idx on kafaa_klra_actions (position_id);
create index if not exists kafaa_klra_actions_person_id_idx on kafaa_klra_actions (person_id);
create index if not exists kafaa_klra_actions_status_idx on kafaa_klra_actions (status);
create index if not exists kafaa_klra_actions_created_by_idx on kafaa_klra_actions (created_by);
create index if not exists kafaa_capture_sessions_sme_id_idx on kafaa_capture_sessions (sme_id);
create index if not exists kafaa_capture_sessions_interviewer_id_idx on kafaa_capture_sessions (interviewer_id);
create index if not exists kafaa_capture_sessions_created_by_idx on kafaa_capture_sessions (created_by);
create index if not exists kafaa_capture_sessions_status_idx on kafaa_capture_sessions (status);
create index if not exists kafaa_capture_sessions_position_id_idx on kafaa_capture_sessions (position_id);
create index if not exists kafaa_knowledge_assets_system_family_idx on kafaa_knowledge_assets (system_family);
create index if not exists kafaa_knowledge_assets_status_idx on kafaa_knowledge_assets (status);
create index if not exists kafaa_knowledge_assets_author_id_idx on kafaa_knowledge_assets (author_id);
create index if not exists kafaa_knowledge_assets_sme_id_idx on kafaa_knowledge_assets (sme_id);
create index if not exists kafaa_asset_reviews_asset_id_idx on kafaa_asset_reviews (asset_id);
create index if not exists kafaa_asset_reviews_asset_author_id_idx on kafaa_asset_reviews (asset_author_id);
create index if not exists kafaa_asset_reviews_reviewer_id_idx on kafaa_asset_reviews (reviewer_id);
create index if not exists kafaa_asset_uses_asset_id_idx on kafaa_asset_uses (asset_id);
create index if not exists kafaa_asset_uses_person_id_idx on kafaa_asset_uses (person_id);

-- ───────────── RLS (policies created when missing, then set to the per-statement form like 20261008140000_kafaa_rls_perf.sql)
alter table kafaa_klra_settings enable row level security;
alter table kafaa_klra_positions enable row level security;
alter table kafaa_klra_assessments enable row level security;
alter table kafaa_klra_actions enable row level security;
alter table kafaa_sme_profiles enable row level security;
alter table kafaa_capture_sessions enable row level security;
alter table kafaa_knowledge_assets enable row level security;
alter table kafaa_asset_reviews enable row level security;
alter table kafaa_asset_uses enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_klra_settings' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_klra_settings for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_klra_positions' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_klra_positions for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_klra_assessments' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_klra_assessments for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_klra_actions' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_klra_actions for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_sme_profiles' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_sme_profiles for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_capture_sessions' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_capture_sessions for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_knowledge_assets' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_knowledge_assets for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_asset_reviews' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_asset_reviews for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_asset_uses' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_asset_uses for select to anon, authenticated using (false)'; end if;
end $$;
alter policy kafaa_read on kafaa_klra_settings using (((COALESCE(open_read, false) AND (SELECT kafaa_has_grant('knowledge'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((updated_by = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('knowledge'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('knowledge'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('knowledge'::text, updated_by, NULL::text, false))));
alter policy kafaa_read on kafaa_klra_positions using (((COALESCE(open_read, false) AND (SELECT kafaa_has_grant('knowledge'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('knowledge'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('knowledge'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('knowledge'::text, person_id, NULL::text, false))));
alter policy kafaa_read on kafaa_klra_assessments using (((COALESCE(open_read, false) AND (SELECT kafaa_has_grant('knowledge'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('knowledge'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('knowledge'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('knowledge'::text, person_id, NULL::text, false))));
alter policy kafaa_read on kafaa_klra_actions using (((COALESCE(open_read, false) AND (SELECT kafaa_has_grant('knowledge'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('knowledge'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('knowledge'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('knowledge'::text, person_id, NULL::text, false))));
alter policy kafaa_read on kafaa_sme_profiles using ((((COALESCE(listed, false) AND (SELECT kafaa_has_grant('knowledge'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))) OR (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false)))));
alter policy kafaa_read on kafaa_capture_sessions using (((((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((sme_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, sme_id, NULL::text, false))) OR (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((interviewer_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, interviewer_id, NULL::text, false))) OR (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((created_by = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, created_by, NULL::text, false)))));
alter policy kafaa_read on kafaa_knowledge_assets using ((((COALESCE(published, false) AND (SELECT kafaa_has_grant('knowledge'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))) OR (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((author_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, author_id, NULL::text, false))) OR (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((sme_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, sme_id, NULL::text, false)))));
alter policy kafaa_read on kafaa_asset_reviews using (((((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((reviewer_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, reviewer_id, NULL::text, false))) OR (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((asset_author_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, asset_author_id, NULL::text, false)))));
alter policy kafaa_read on kafaa_asset_uses using ((((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false))));

-- Every M24 table is read-only for API roles: rows change only through the SECURITY DEFINER RPCs below.
revoke insert, update on kafaa_klra_settings, kafaa_klra_positions, kafaa_klra_assessments, kafaa_klra_actions, kafaa_sme_profiles, kafaa_capture_sessions, kafaa_knowledge_assets, kafaa_asset_reviews, kafaa_asset_uses from anon, authenticated;
grant select on kafaa_klra_settings, kafaa_klra_positions, kafaa_klra_assessments, kafaa_klra_actions, kafaa_sme_profiles, kafaa_capture_sessions, kafaa_knowledge_assets, kafaa_asset_reviews, kafaa_asset_uses to anon, authenticated;

-- ───────────── Internal helpers (mirror of src/modules/m24/klra.ts and capture.ts)
create or replace function kafaa_kc_ts(p timestamptz) returns text language sql immutable set search_path = public as $$
  select to_char(p at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
$$;
create or replace function kafaa_kc_rid(p_prefix text) returns text language sql volatile set search_path = public as $$
  select p_prefix || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 24)
$$;
create or replace function kafaa_kc_isoday(p text) returns boolean language plpgsql immutable set search_path = public as $$
begin
  if p is null or p !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return false; end if;
  return to_char(p::date, 'YYYY-MM-DD') = p;
exception when others then return false;
end $$;
create or replace function kafaa_kc_quarter(p date) returns text language sql immutable set search_path = public as $$
  select to_char(p, 'YYYY') || '-Q' || extract(quarter from p)::int
$$;
create or replace function kafaa_kc_quarter_end(q text) returns date language sql immutable set search_path = public as $$
  select (make_date(split_part(q, '-Q', 1)::int, split_part(q, '-Q', 2)::int * 3, 1) + interval '1 month' - interval '1 day')::date
$$;
create or replace function kafaa_kc_thresholds() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_build_object('high', s.high_threshold, 'medium', s.medium_threshold) from kafaa_klra_settings s where s.id = 'default'), jsonb_build_object('high', 16, 'medium', 8))
$$;
create or replace function kafaa_kc_band(p_total integer, t jsonb) returns text language sql immutable set search_path = public as $$
  select case when p_total >= (t->>'high')::int then 'high' when p_total >= (t->>'medium')::int then 'medium' else 'low' end
$$;
create or replace function kafaa_kc_cell(n integer) returns jsonb language sql immutable set search_path = public as $$
  select case when n >= 10 then jsonb_build_object('n', n, 'suppressed', false) else jsonb_build_object('n', null, 'suppressed', true) end
$$;
create or replace function kafaa_kc_reason(p_code text, p_vars jsonb, p_weight integer) returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object('code', p_code, 'key', 'm24.reasons.' || p_code, 'vars', coalesce(p_vars, '{}'::jsonb)) || case when p_weight is null then '{}'::jsonb else jsonb_build_object('weight', p_weight) end
$$;
-- proposeFactors(): attrition = max(retirement, contract end, OSSA cover); position = (3 crit + 3 uniq + 2 tacit + 2 replace + 5) / 10.
create or replace function kafaa_kc_propose(p kafaa_klra_positions, p_assets integer) returns jsonb language plpgsql stable set search_path = public as $$
declare
  v_retire int; v_contract int; v_ossa int; v_spof int := coalesce(cardinality(p.spof_skill_ids), 0); v_crit int; v_uniq int; v_pct int; v_tacit int; v_repl int; v_att int; v_pos int;
  v_assets int := greatest(0, coalesce(p_assets, 0)); r jsonb := '[]'::jsonb;
begin
  v_retire := case p.retirement_band when 'within_2' then 5 when '2_5' then 3 else 1 end;
  v_contract := case when p.contract_kind not in ('fixed_term', 'secondment') then 1 when p.contract_end_band = 'within_1' then 5 when p.contract_end_band = '1_2' then 4 when p.contract_end_band = '2_5' then 2 else 1 end;
  v_ossa := case when p.contract_kind = 'ossa' then 4 else 1 end;
  v_crit := case p.criticality when 'critical' then 5 when 'regulated' then 4 when 'qualified' then 3 else 2 end;
  v_uniq := case when v_spof >= 2 then 5 when v_spof = 1 then 4 else 1 end;
  v_pct := least(100, greatest(0, p.codified_base) + 15 * v_assets);
  v_tacit := case when v_pct < 20 then 5 when v_pct < 40 then 4 when v_pct < 60 then 3 when v_pct < 80 then 2 else 1 end;
  v_repl := case when p.replace_months >= 48 then 5 when p.replace_months >= 24 then 4 when p.replace_months >= 12 then 3 when p.replace_months >= 6 then 2 else 1 end;
  v_att := greatest(v_retire, v_contract, v_ossa);
  v_pos := least(5, greatest(1, (v_crit * 3 + v_uniq * 3 + v_tacit * 2 + v_repl * 2 + 5) / 10));
  if p.retirement_band <> 'na' then r := r || jsonb_build_array(kafaa_kc_reason('retire_' || p.retirement_band, '{}'::jsonb, v_retire)); end if;
  if p.contract_kind in ('fixed_term', 'secondment') and p.contract_end_band <> 'none' then r := r || jsonb_build_array(kafaa_kc_reason('contract_' || p.contract_end_band, '{}'::jsonb, v_contract)); end if;
  if p.contract_kind = 'ossa' then r := r || jsonb_build_array(kafaa_kc_reason('ossa_cover', jsonb_build_object('year', 2030), v_ossa)); end if;
  r := r || jsonb_build_array(kafaa_kc_reason('crit_' || p.criticality, '{}'::jsonb, v_crit));
  r := r || jsonb_build_array(case when v_spof > 0 then kafaa_kc_reason('spof', jsonb_build_object('n', v_spof), v_uniq) else kafaa_kc_reason('no_spof', '{}'::jsonb, v_uniq) end);
  r := r || jsonb_build_array(kafaa_kc_reason('codified', jsonb_build_object('pct', v_pct), v_tacit));
  r := r || jsonb_build_array(kafaa_kc_reason('replace', jsonb_build_object('months', p.replace_months), v_repl));
  if v_assets > 0 then r := r || jsonb_build_array(kafaa_kc_reason('assets', jsonb_build_object('n', v_assets), null)); end if;
  return jsonb_build_object('attrition', v_att, 'position', v_pos, 'total', v_att * v_pos, 'reasons', r,
    'drivers', jsonb_build_object('retire', v_retire, 'contract', v_contract, 'ossa', v_ossa, 'crit', v_crit, 'uniq', v_uniq, 'tacit', v_tacit, 'repl', v_repl, 'codified_pct', v_pct, 'spof', v_spof, 'assets', v_assets));
end $$;
create or replace function kafaa_kc_assets_for(p_position text) returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from kafaa_knowledge_assets a where a.position_id = p_position and a.status = 'published'
$$;
-- KM owner (knowledge A) sees every position; a department head (knowledge Scope) the positions in scope (OSSA positions by entity/family).
create or replace function kafaa_kc_pos_visible(p kafaa_klra_positions) returns boolean language sql stable security definer set search_path = public as $$
  select kafaa_has_grant('knowledge', array['A'])
    or (p.person_id is not null and kafaa_in_scope('knowledge', p.person_id))
    or (p.person_id is null and exists (
      select 1 from kafaa_role_assignments ra join kafaa_policy_matrix m on m.role = ra.role and m.resource = 'knowledge' and m.level = 'Scope'
      where ra.person_id = kafaa_me() and ra.status = 'active' and (ra.expires_at is null or ra.expires_at >= current_date)
        and (ra.scope_type = 'all' or (ra.scope_type = 'entity' and p.entity_id = ra.scope_value) or (ra.scope_type = 'family' and p.family_id = ra.scope_value)
          or (ra.scope_type = 'team' and p.team_id = ra.scope_value) or (ra.scope_type = 'crew' and p.crew = ra.scope_value))))
$$;
create or replace function kafaa_kc_acting() returns text language sql stable security definer set search_path = public as $$
  select case when kafaa_has_grant('knowledge', array['A']) then kafaa_acting_role('knowledge', array['A']) when kafaa_has_grant('knowledge', array['Scope']) then kafaa_acting_role('knowledge', array['Scope']) end
$$;
create or replace function kafaa_kc_pos_view(p kafaa_klra_positions) returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object('id', p.id, 'person_id', p.person_id, 'role_id', p.role_id, 'family_id', p.family_id, 'department', p.department, 'kind', p.kind,
    'title_en', p.title_en, 'title_ar', p.title_ar, 'holder_en', p.holder_en, 'holder_ar', p.holder_ar, 'retirement_band', p.retirement_band, 'contract_kind', p.contract_kind,
    'contract_end_band', p.contract_end_band, 'criticality', p.criticality, 'spof_skill_ids', to_jsonb(p.spof_skill_ids), 'codified_base', p.codified_base, 'replace_months', p.replace_months,
    'feed_as_of', to_char(p.feed_as_of, 'YYYY-MM-DD'))
$$;
create or replace function kafaa_kc_action_view(a kafaa_klra_actions) returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object('id', a.id, 'assessment_id', a.assessment_id, 'position_id', a.position_id, 'period', a.period, 'kind', a.kind, 'owner_role', a.owner_role,
    'due_on', to_char(a.due_on, 'YYYY-MM-DD'), 'status', a.status, 'note', coalesce(a.note, ''), 'ref_table', a.ref_table, 'ref_id', a.ref_id, 'outcome', a.outcome,
    'created_at', kafaa_kc_ts(a.created_at), 'closed_at', kafaa_kc_ts(a.closed_at), 'overdue', a.status in ('planned', 'in_progress') and a.due_on < current_date)
$$;
-- mitigationState(): an open action -> planned; only closed (done) ones -> done; none: high -> needed until the quarter closes, then overdue.
create or replace function kafaa_kc_mitigation(p_band text, p_period text, p_assessment text) returns text language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from kafaa_klra_actions k where k.assessment_id = p_assessment and k.status in ('planned', 'in_progress')) then 'planned'
    when exists (select 1 from kafaa_klra_actions k where k.assessment_id = p_assessment and k.status <> 'cancelled') then 'done'
    when p_band <> 'high' then 'not_required'
    when current_date > kafaa_kc_quarter_end(p_period) then 'overdue' else 'needed' end
$$;
create or replace function kafaa_kc_row(a kafaa_klra_assessments, p kafaa_klra_positions, t jsonb) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', a.id, 'period', a.period, 'position_id', a.position_id, 'department', a.department, 'attrition_factor', a.attrition_factor, 'position_factor', a.position_factor,
    'total', a.total, 'proposed_attrition', a.proposed_attrition, 'proposed_position', a.proposed_position, 'adjusted', a.adjusted, 'note', a.note, 'reasons', a.reasons, 'drivers', a.drivers,
    'assessed_by_name', a.assessed_by_name, 'assessed_by_name_ar', a.assessed_by_name_ar, 'assessed_at', kafaa_kc_ts(a.assessed_at),
    'band', kafaa_kc_band(a.total, t), 'mitigation', kafaa_kc_mitigation(kafaa_kc_band(a.total, t), a.period, a.id), 'position', kafaa_kc_pos_view(p),
    'actions', coalesce((select jsonb_agg(kafaa_kc_action_view(k) order by k.created_at, k.id collate "C") from kafaa_klra_actions k where k.assessment_id = a.id), '[]'::jsonb))
$$;
-- computeHeatmap(): department x band for a quarter plus the per-quarter trend; every cell under 10 is suppressed.
create or replace function kafaa_kc_heatmap_compute(t jsonb, p_period text) returns jsonb language sql stable security definer set search_path = public as $$
  with a as (
    select x.id, x.period, x.department, kafaa_kc_band(x.total, t) band,
      exists (select 1 from kafaa_klra_actions k where k.assessment_id = x.id and k.status <> 'cancelled') mit
    from kafaa_klra_assessments x
  ), cur as (select * from a where period = p_period),
  depts as (select d, o from unnest(array['operations', 'maintenance_engineering', 'rp_chem_ep', 'training_quality', 'corporate']) with ordinality u(d, o))
  select jsonb_build_object(
    'period', p_period, 'min_group', 10, 'thresholds', jsonb_build_object('high', (t->>'high')::int, 'medium', (t->>'medium')::int),
    'departments', (select jsonb_agg(jsonb_build_object('id', d,
        'n', kafaa_kc_cell((select count(*)::int from cur where department = d)),
        'high', kafaa_kc_cell((select count(*)::int from cur where department = d and band = 'high')),
        'medium', kafaa_kc_cell((select count(*)::int from cur where department = d and band = 'medium')),
        'low', kafaa_kc_cell((select count(*)::int from cur where department = d and band = 'low')),
        'mitigated', kafaa_kc_cell((select count(*)::int from cur where department = d and band = 'high' and mit))) order by o) from depts),
    'total', jsonb_build_object('n', kafaa_kc_cell((select count(*)::int from cur)), 'high', kafaa_kc_cell((select count(*)::int from cur where band = 'high')),
        'medium', kafaa_kc_cell((select count(*)::int from cur where band = 'medium')), 'low', kafaa_kc_cell((select count(*)::int from cur where band = 'low')),
        'mitigated', kafaa_kc_cell((select count(*)::int from cur where band = 'high' and mit))),
    'trend', coalesce((select jsonb_agg(jsonb_build_object('period', q, 'n', kafaa_kc_cell(n), 'high', kafaa_kc_cell(h)) order by q collate "C")
        from (select period q, count(*)::int n, (count(*) filter (where band = 'high'))::int h from a group by period) s), '[]'::jsonb),
    'excluded', jsonb_build_array('security', 'cyber', 'safeguards'))
$$;
-- Content screen shared with M22 communities: security, safeguards and cyber floor + refusal policies (kafaa_cop_guard), then contact details.
create or replace function kafaa_kc_screen(p_text text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c text := kafaa_cop_guard(p_text);
begin
  if c is not null then
    return jsonb_build_object('code', 'restricted_content', 'msg', 'Not submitted: ' || c || ' content is not allowed in knowledge assets. Capture the reasoning, lessons and rules of thumb; leave out plant security arrangements, safeguards figures and cyber or network details');
  end if;
  if kafaa_cop_contact(p_text) then return jsonb_build_object('code', 'contact_details', 'msg', 'Not submitted: remove email addresses and phone numbers. Name roles, never people'); end if;
  return null;
end $$;
-- Strings of a JSON array, de-duplicated in first-seen order (uniq()); null when not an array.
create or replace function kafaa_kc_arr(j jsonb) returns text[] language sql immutable set search_path = public as $$
  select case when jsonb_typeof(j) = 'array' then coalesce((select array_agg(s order by o) from (select e.v #>> '{}' s, min(e.o) o from jsonb_array_elements(j) with ordinality e(v, o) where jsonb_typeof(e.v) = 'string' group by 1) x), '{}'::text[]) end
$$;
create or replace function kafaa_kc_ok_skills(p_ids text[], p_max integer) returns boolean language sql stable security definer set search_path = public as $$
  select p_ids is not null and cardinality(p_ids) <= p_max and not exists (
    select 1 from unnest(p_ids) i left join kafaa_skills s on s.id = i left join kafaa_competencies c on c.id = s.competency_id
    where s.id is null or s.area = 'security' or c.domain = 'security')
$$;
create or replace function kafaa_kc_ok_standards(p_ids text[], p_max integer) returns boolean language sql stable security definer set search_path = public as $$
  select p_ids is not null and cardinality(p_ids) <= p_max and not exists (select 1 from unnest(p_ids) i left join kafaa_qual_standards q on q.id = i where q.id is null or coalesce(q.security_restricted, false))
$$;
create or replace function kafaa_kc_person_has(p_person text, p_res text, p_levels text[]) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from kafaa_role_assignments ra join kafaa_policy_matrix m on m.role = ra.role and m.resource = p_res and m.level = any(p_levels)
    where ra.person_id = p_person and ra.status = 'active' and (ra.expires_at is null or ra.expires_at >= current_date))
$$;
create or replace function kafaa_kc_name(p_person text, p_ar boolean) returns text language sql stable security definer set search_path = public as $$
  select coalesce((select case when p_ar then coalesce(nullif(p.display_name_ar, ''), p.display_name) else p.display_name end from kafaa_people p where p.id = p_person), '')
$$;
create or replace function kafaa_kc_notify(p_id text, p_person text, p_en text, p_ar text, p_link text, p_sev text) returns void language plpgsql security definer set search_path = public as $$
declare prev text := current_setting('kafaa.seeding', true);
begin
  if p_person is null or not exists (select 1 from kafaa_people where id = p_person) then return; end if;
  perform set_config('kafaa.seeding', 'on', true);
  insert into kafaa_notifications (id, person_id, kind, title_en, title_ar, link, severity) values (p_id, p_person, 'knowledge', p_en, p_ar, p_link, p_sev) on conflict (id) do nothing;
  perform set_config('kafaa.seeding', coalesce(prev, ''), true);
end $$;
create or replace function kafaa_kc_hist(p_status text) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('at', kafaa_kc_ts(now()), 'status', p_status, 'by', kafaa_me(), 'note', null)
$$;
create or replace function kafaa_kc_session_view(s kafaa_capture_sessions) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', s.id, 'sme_id', s.sme_id, 'interviewer_id', s.interviewer_id, 'created_by', s.created_by, 'template', s.template, 'title', s.title, 'lang', s.lang,
    'status', s.status, 'planned_on', to_char(s.planned_on, 'YYYY-MM-DD'), 'held_on', to_char(s.held_on, 'YYYY-MM-DD'), 'duration_min', s.duration_min, 'skill_ids', to_jsonb(s.skill_ids),
    'standard_ids', to_jsonb(s.standard_ids), 'position_id', s.position_id, 'action_id', s.action_id, 'transcript', coalesce(s.transcript, ''), 'transcript_words', s.transcript_words,
    'notes', coalesce(s.notes, ''), 'asset_id', s.asset_id, 'asset_status', (select a.status from kafaa_knowledge_assets a where a.id = s.asset_id),
    'sme_name', s.sme_name, 'sme_name_ar', s.sme_name_ar, 'interviewer_name', s.interviewer_name, 'interviewer_name_ar', s.interviewer_name_ar,
    'created_at', kafaa_kc_ts(s.created_at), 'updated_at', kafaa_kc_ts(s.updated_at))
$$;
create or replace function kafaa_kc_asset_text(t1 text, t2 text, s1 text, s2 text, b text, kp jsonb) returns text language sql immutable set search_path = public as $$
  select concat_ws(E'\n', nullif(t1, ''), nullif(t2, ''), nullif(s1, ''), nullif(s2, ''), nullif(b, ''),
    (select string_agg(concat_ws(E'\n', nullif(e.v->>'en', ''), nullif(e.v->>'ar', '')), E'\n' order by e.o) from jsonb_array_elements(case when jsonb_typeof(kp) = 'array' then kp else '[]'::jsonb end) with ordinality e(v, o)))
$$;
-- reviewState(): a current technical pass and a current security pass by two different people, neither the author nor the SME.
create or replace function kafaa_kc_review_pair(p_asset text, p_author text, p_sme text) returns text[] language sql stable security definer set search_path = public as $$
  with cur as (select * from kafaa_asset_reviews r where r.asset_id = p_asset and not r.superseded and r.outcome = 'pass' and r.reviewer_id <> p_author and r.reviewer_id <> p_sme)
  select array[t.reviewer_id, s.reviewer_id] from cur t join cur s on t.kind = 'technical' and s.kind = 'security' and t.reviewer_id <> s.reviewer_id
  order by t.created_at, t.reviewer_id collate "C", s.created_at, s.reviewer_id collate "C" limit 1
$$;
create or replace function kafaa_kc_merge(a text[], b text[]) returns text[] language sql immutable set search_path = public as $$
  select coalesce(a, '{}'::text[]) || coalesce((select array_agg(x order by o) from (select x, min(o) o from unnest(coalesce(b, '{}'::text[])) with ordinality u(x, o) where x <> all(coalesce(a, '{}'::text[])) group by x) y), '{}'::text[])
$$;

-- ───────────── F20 KLRA reads
create or replace function kafaa_klra_register(p_period text default null) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); t jsonb := kafaa_kc_thresholds(); cur text := kafaa_kc_quarter(current_date); v_p text; v_mode text; v_rows jsonb; v_pend jsonb; v_periods jsonb;
begin
  v_p := case when p_period ~ '^20[0-9]{2}-Q[1-4]$' then p_period else cur end;
  v_mode := case when me is null then 'none' when kafaa_has_grant('knowledge', array['A']) then 'all' when kafaa_has_grant('knowledge', array['Scope']) then 'scope' when kafaa_has_grant('knowledge', array['Agg']) then 'agg' else 'none' end;
  if v_mode in ('none', 'agg') then
    return jsonb_build_object('mode', v_mode, 'period', v_p, 'current', cur, 'quarter_end', to_char(kafaa_kc_quarter_end(v_p), 'YYYY-MM-DD'), 'thresholds', t, 'rows', '[]'::jsonb, 'pending', '[]'::jsonb, 'periods', jsonb_build_array(cur));
  end if;
  with vis as (select * from kafaa_klra_positions x where kafaa_kc_pos_visible(x))
  select coalesce((select jsonb_agg(kafaa_kc_row(a, p, t) order by a.total desc, a.position_id collate "C") from kafaa_klra_assessments a join vis p on p.id = a.position_id where a.period = v_p), '[]'::jsonb),
    case when v_p = cur then coalesce((select jsonb_agg(kafaa_kc_pos_view(p) order by p.id collate "C") from vis p where p.active and not exists (select 1 from kafaa_klra_assessments a where a.position_id = p.id and a.period = v_p)), '[]'::jsonb) else '[]'::jsonb end,
    (select jsonb_agg(q order by q collate "C") from (select cur q union select a.period from kafaa_klra_assessments a join vis p on p.id = a.position_id) s)
  into v_rows, v_pend, v_periods;
  return jsonb_build_object('mode', v_mode, 'period', v_p, 'current', cur, 'quarter_end', to_char(kafaa_kc_quarter_end(v_p), 'YYYY-MM-DD'), 'thresholds', t, 'rows', v_rows, 'pending', v_pend, 'periods', v_periods);
end $$;

create or replace function kafaa_klra_heatmap(p_period text default null) returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if kafaa_me() is null or not kafaa_has_grant('knowledge', array['A', 'Scope', 'Agg']) then return null; end if;
  return kafaa_kc_heatmap_compute(kafaa_kc_thresholds(), case when p_period ~ '^20[0-9]{2}-Q[1-4]$' then p_period else kafaa_kc_quarter(current_date) end);
end $$;

create or replace function kafaa_klra_position(p_id text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare p kafaa_klra_positions; t jsonb := kafaa_kc_thresholds(); prop jsonb;
begin
  select * into p from kafaa_klra_positions where id = p_id;
  if kafaa_me() is null or p.id is null or not kafaa_kc_pos_visible(p) then return null; end if;
  prop := kafaa_kc_propose(p, kafaa_kc_assets_for(p.id));
  return jsonb_build_object('position', kafaa_kc_pos_view(p), 'thresholds', t, 'current', kafaa_kc_quarter(current_date), 'proposal', prop,
    'history', coalesce((select jsonb_agg(kafaa_kc_row(a, p, t) order by a.period collate "C" desc) from kafaa_klra_assessments a where a.position_id = p.id), '[]'::jsonb),
    'assets', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'title_en', a.title_en, 'title_ar', a.title_ar, 'status', a.status) order by a.id collate "C") from kafaa_knowledge_assets a where a.position_id = p.id), '[]'::jsonb),
    'sessions', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title, 'status', s.status, 'planned_on', to_char(s.planned_on, 'YYYY-MM-DD')) order by s.id collate "C") from kafaa_capture_sessions s where s.position_id = p.id), '[]'::jsonb));
end $$;

-- ───────────── F20 KLRA writes
create or replace function kafaa_assess_position(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_pid text := btrim(coalesce(p->>'position_id', '')); v_role text; pos kafaa_klra_positions; v_a int; v_p int; v_note text; prop jsonb; v_adj boolean;
  v_period text := kafaa_kc_quarter(current_date); v_id text; v_total int; v_reasons jsonb; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('klra.assess', 'klra_assessments', nullif(v_pid, ''), 'not_signed_in', 'Sign in to use the knowledge loss risk assessment'); end if;
  v_role := kafaa_kc_acting();
  if v_role is null then return kafaa_refuse('klra.assess', 'klra_assessments', nullif(v_pid, ''), 'forbidden', 'Only the knowledge-management owner or a department head for this position can do this'); end if;
  select * into pos from kafaa_klra_positions where id = v_pid;
  if pos.id is null or not kafaa_kc_pos_visible(pos) then return kafaa_refuse('klra.assess', 'klra_assessments', nullif(v_pid, ''), 'not_found', 'Position not found', v_role); end if;
  if not pos.active then return kafaa_refuse('klra.assess', 'klra_assessments', v_pid, 'invalid', 'This position is no longer in the register', v_role); end if;
  if jsonb_typeof(p->'attrition_factor') is distinct from 'number' or jsonb_typeof(p->'position_factor') is distinct from 'number'
     or (p->>'attrition_factor')::numeric not in (1, 2, 3, 4, 5) or (p->>'position_factor')::numeric not in (1, 2, 3, 4, 5) then
    return kafaa_refuse('klra.assess', 'klra_assessments', v_pid, 'invalid', 'Each factor is a whole number from 1 to 5', v_role);
  end if;
  v_a := (p->>'attrition_factor')::numeric::int; v_p := (p->>'position_factor')::numeric::int;
  v_note := btrim(coalesce(case when jsonb_typeof(p->'note') = 'string' then p->>'note' end, ''));
  if length(v_note) > 500 then return kafaa_refuse('klra.assess', 'klra_assessments', v_pid, 'invalid', 'Keep the note under 500 characters', v_role); end if;
  prop := kafaa_kc_propose(pos, kafaa_kc_assets_for(pos.id));
  v_adj := v_a <> (prop->>'attrition')::int or v_p <> (prop->>'position')::int;
  if v_adj and length(v_note) < 10 then return kafaa_refuse('klra.assess', 'klra_assessments', v_pid, 'note_required', 'Explain in at least 10 characters why you changed the proposed factors', v_role); end if;
  v_id := 'klra:' || v_period || ':' || pos.id;
  v_total := v_a * v_p;
  v_reasons := case when v_adj then (prop->'reasons') || jsonb_build_array(kafaa_kc_reason('adjusted', jsonb_build_object('pa', (prop->>'attrition')::int, 'pp', (prop->>'position')::int, 'a', v_a, 'p', v_p), null)) else prop->'reasons' end;
  insert into kafaa_klra_assessments (id, period, position_id, person_id, department, attrition_factor, position_factor, total, proposed_attrition, proposed_position, adjusted, note, reasons, drivers,
    assessed_by, assessed_by_name, assessed_by_name_ar, assessed_at, open_read)
  values (v_id, v_period, pos.id, pos.person_id, pos.department, v_a, v_p, v_total, (prop->>'attrition')::int, (prop->>'position')::int, v_adj, nullif(v_note, ''), v_reasons, prop->'drivers',
    me, kafaa_kc_name(me, false), kafaa_kc_name(me, true), now(), false)
  on conflict (id) do update set attrition_factor = excluded.attrition_factor, position_factor = excluded.position_factor, total = excluded.total, proposed_attrition = excluded.proposed_attrition,
    proposed_position = excluded.proposed_position, adjusted = excluded.adjusted, note = excluded.note, reasons = excluded.reasons, drivers = excluded.drivers, assessed_by = excluded.assessed_by,
    assessed_by_name = excluded.assessed_by_name, assessed_by_name_ar = excluded.assessed_by_name_ar, assessed_at = excluded.assessed_at, department = excluded.department, person_id = excluded.person_id;
  a := kafaa_audit('klra.assess', 'klra_assessments', v_id, 'ok', v_a || 'x' || v_p || '=' || v_total || case when v_adj then ' adjusted' else '' end, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Assessment saved', a, null, jsonb_build_object('id', v_id, 'total', v_total, 'band', kafaa_kc_band(v_total, kafaa_kc_thresholds())));
end $$;

create or replace function kafaa_reassess_quarter(p_period text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); cur text := kafaa_kc_quarter(current_date); v_p text; v_role text; pos kafaa_klra_positions; prop jsonb; v_created int := 0; v_skipped int := 0; a kafaa_audit_events; l integer;
begin
  v_p := case when p_period is null or p_period = '' then cur else p_period end;
  if me is null then return kafaa_refuse('klra.reassess', 'klra_assessments', v_p, 'not_signed_in', 'Sign in to use the knowledge loss risk assessment'); end if;
  if not kafaa_has_grant('knowledge', array['A']) then return kafaa_refuse('klra.reassess', 'klra_assessments', v_p, 'forbidden', 'Only the knowledge-management owner can do this'); end if;
  v_role := kafaa_acting_role('knowledge', array['A']);
  if v_p <> cur then return kafaa_refuse('klra.reassess', 'klra_assessments', v_p, 'closed_period', 'Assess the current quarter only; earlier quarters are closed', v_role); end if;
  for pos in select * from kafaa_klra_positions where active order by id collate "C" loop
    if exists (select 1 from kafaa_klra_assessments where id = 'klra:' || v_p || ':' || pos.id) then v_skipped := v_skipped + 1; continue; end if;
    prop := kafaa_kc_propose(pos, kafaa_kc_assets_for(pos.id));
    insert into kafaa_klra_assessments (id, period, position_id, person_id, department, attrition_factor, position_factor, total, proposed_attrition, proposed_position, adjusted, note, reasons, drivers,
      assessed_by, assessed_by_name, assessed_by_name_ar, assessed_at, open_read)
    values ('klra:' || v_p || ':' || pos.id, v_p, pos.id, pos.person_id, pos.department, (prop->>'attrition')::int, (prop->>'position')::int, (prop->>'total')::int, (prop->>'attrition')::int, (prop->>'position')::int,
      false, null, prop->'reasons', prop->'drivers', me, kafaa_kc_name(me, false), kafaa_kc_name(me, true), now(), false);
    v_created := v_created + 1;
  end loop;
  l := kafaa_ledger('kafaa.klra.reassess', format('KLRA %s: %s positions assessed', v_p, v_created));
  a := kafaa_audit('klra.reassess', 'klra_assessments', v_p, 'ok', format('%s assessed, %s already assessed', v_created, v_skipped), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', format('%s positions assessed for %s', v_created, v_p), a, l, jsonb_build_object('period', v_p, 'created', v_created, 'skipped', v_skipped));
end $$;

create or replace function kafaa_plan_mitigation(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_aid text := btrim(coalesce(p->>'assessment_id', '')); v_role text; asm kafaa_klra_assessments; pos kafaa_klra_positions; v_kind text := p->>'kind'; v_owner text := p->>'owner_role';
  v_due text := case when jsonb_typeof(p->'due_on') = 'string' then p->>'due_on' end; v_note text := btrim(coalesce(case when jsonb_typeof(p->'note') = 'string' then p->>'note' end, '')); v_id text; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('klra.mitigate', 'klra_actions', nullif(v_aid, ''), 'not_signed_in', 'Sign in to use the knowledge loss risk assessment'); end if;
  v_role := kafaa_kc_acting();
  if v_role is null then return kafaa_refuse('klra.mitigate', 'klra_actions', nullif(v_aid, ''), 'forbidden', 'Only the knowledge-management owner or a department head for this position can do this'); end if;
  select * into asm from kafaa_klra_assessments where id = v_aid;
  select * into pos from kafaa_klra_positions where id = asm.position_id;
  if asm.id is null or pos.id is null or not kafaa_kc_pos_visible(pos) then return kafaa_refuse('klra.mitigate', 'klra_actions', nullif(v_aid, ''), 'not_found', 'Assessment not found', v_role); end if;
  if v_kind is null or v_kind not in ('capture', 'mentoring', 'successor', 'documentation', 'cross_training') then return kafaa_refuse('klra.mitigate', 'klra_actions', v_aid, 'invalid', 'Choose capture, mentoring, successor, documentation or cross-training', v_role); end if;
  if v_owner is null or v_owner not in ('km_owner', 'line_manager', 'training', 'hr', 'sme') then return kafaa_refuse('klra.mitigate', 'klra_actions', v_aid, 'invalid', 'Choose who owns the action', v_role); end if;
  if not kafaa_kc_isoday(v_due) or v_due::date < current_date or v_due::date > current_date + 365 then return kafaa_refuse('klra.mitigate', 'klra_actions', v_aid, 'invalid', 'Set a due date between today and one year from today', v_role); end if;
  if length(v_note) > 500 then return kafaa_refuse('klra.mitigate', 'klra_actions', v_aid, 'invalid', 'Keep the note under 500 characters', v_role); end if;
  if exists (select 1 from kafaa_klra_actions k where k.assessment_id = v_aid and k.kind = v_kind and k.status in ('planned', 'in_progress')) then
    return kafaa_refuse('klra.mitigate', 'klra_actions', v_aid, 'conflict', 'An open action of this kind already exists for this position', v_role);
  end if;
  v_id := kafaa_kc_rid('ka');
  insert into kafaa_klra_actions (id, assessment_id, position_id, person_id, period, kind, owner_role, due_on, status, note, created_by, created_at, open_read)
  values (v_id, v_aid, pos.id, pos.person_id, asm.period, v_kind, v_owner, v_due::date, 'planned', v_note, me, now(), false);
  a := kafaa_audit('klra.mitigate', 'klra_actions', v_id, 'ok', v_kind || ' for ' || pos.id, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Mitigation action planned', a, null, jsonb_build_object('id', v_id));
end $$;

create or replace function kafaa_close_action(p_id text, p_outcome text, p_note text default '') returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; x kafaa_klra_actions; pos kafaa_klra_positions; v_note text := btrim(coalesce(p_note, '')); a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('klra.action.close', 'klra_actions', p_id, 'not_signed_in', 'Sign in to use the knowledge loss risk assessment'); end if;
  v_role := kafaa_kc_acting();
  if v_role is null then return kafaa_refuse('klra.action.close', 'klra_actions', p_id, 'forbidden', 'Only the knowledge-management owner or a department head for this position can do this'); end if;
  select * into x from kafaa_klra_actions where id = p_id;
  select * into pos from kafaa_klra_positions where id = x.position_id;
  if x.id is null or pos.id is null or not kafaa_kc_pos_visible(pos) then return kafaa_refuse('klra.action.close', 'klra_actions', p_id, 'not_found', 'Mitigation action not found', v_role); end if;
  if x.status not in ('planned', 'in_progress') then return kafaa_refuse('klra.action.close', 'klra_actions', p_id, 'invalid', 'This action is already closed', v_role); end if;
  if p_outcome is null or p_outcome not in ('done', 'cancelled') then return kafaa_refuse('klra.action.close', 'klra_actions', p_id, 'invalid', 'Close the action as done or cancelled', v_role); end if;
  if length(v_note) > 500 then return kafaa_refuse('klra.action.close', 'klra_actions', p_id, 'invalid', 'Keep the note under 500 characters', v_role); end if;
  if p_outcome = 'cancelled' and length(v_note) < 5 then return kafaa_refuse('klra.action.close', 'klra_actions', p_id, 'invalid', 'Give a reason of at least 5 characters when you cancel an action', v_role); end if;
  update kafaa_klra_actions set status = p_outcome, outcome = nullif(v_note, ''), closed_by = me, closed_at = now() where id = p_id;
  a := kafaa_audit('klra.action.close', 'klra_actions', p_id, 'ok', p_outcome, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when p_outcome = 'done' then 'Action closed as done' else 'Action cancelled' end, a, null, jsonb_build_object('status', p_outcome));
end $$;

create or replace function kafaa_set_klra_thresholds(p_high integer, p_medium integer) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_entry jsonb; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('klra.thresholds', 'klra_settings', 'default', 'not_signed_in', 'Sign in to use the knowledge loss risk assessment'); end if;
  if not kafaa_has_grant('knowledge', array['A']) then return kafaa_refuse('klra.thresholds', 'klra_settings', 'default', 'forbidden', 'Only the knowledge-management owner can do this'); end if;
  v_role := kafaa_acting_role('knowledge', array['A']);
  if p_high is null or p_medium is null or p_medium < 2 or p_high > 25 or p_medium >= p_high then
    return kafaa_refuse('klra.thresholds', 'klra_settings', 'default', 'invalid', 'Thresholds are whole numbers: medium from 2, high up to 25, and medium below high', v_role);
  end if;
  v_entry := jsonb_build_object('at', kafaa_kc_ts(now()), 'by', me, 'high', p_high, 'medium', p_medium);
  insert into kafaa_klra_settings (id, high_threshold, medium_threshold, updated_by, updated_at, history, open_read) values ('default', p_high, p_medium, me, now(), jsonb_build_array(v_entry), false)
  on conflict (id) do update set high_threshold = p_high, medium_threshold = p_medium, updated_by = me, updated_at = now(), history = kafaa_klra_settings.history || jsonb_build_array(v_entry);
  l := kafaa_ledger('kafaa.klra.thresholds', format('KLRA thresholds set: high >= %s, medium >= %s', p_high, p_medium));
  a := kafaa_audit('klra.thresholds', 'klra_settings', 'default', 'ok', format('high %s, medium %s', p_high, p_medium), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Thresholds saved', a, l, jsonb_build_object('high', p_high, 'medium', p_medium));
end $$;

-- ───────────── F21 capture studio
create or replace function kafaa_set_sme_profile(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_ent text; v_role text; v_skills text[] := kafaa_kc_arr(p->'skill_ids'); v_head text := btrim(coalesce(case when jsonb_typeof(p->'headline') = 'string' then p->>'headline' end, ''));
  v_bad jsonb; v_listed boolean := coalesce(p->'listed' = 'true'::jsonb, false); pp kafaa_people; a kafaa_audit_events;
begin
  v_ent := case when me is null then null else 'sme:' || me end;
  if me is null then return kafaa_refuse('knowledge.sme', 'sme_profiles', v_ent, 'not_signed_in', 'Sign in to use the knowledge capture studio'); end if;
  v_role := kafaa_acting_role('knowledge', array['R']);
  if v_role is null then return kafaa_refuse('knowledge.sme', 'sme_profiles', v_ent, 'forbidden', 'Knowledge capture is open to staff'); end if;
  if coalesce(p->>'kind', '') not in ('staff', 'retiring', 'rotating', 'visiting_khnp', 'partner') then return kafaa_refuse('knowledge.sme', 'sme_profiles', v_ent, 'invalid', 'Choose how you are leaving or visiting', v_role); end if;
  if coalesce(p->>'availability', '') not in ('available', 'limited', 'unavailable') then return kafaa_refuse('knowledge.sme', 'sme_profiles', v_ent, 'invalid', 'Choose your availability', v_role); end if;
  if coalesce(p->>'departing_band', '') not in ('within_2', '2_5', '5_plus', 'visiting', 'unspecified') then return kafaa_refuse('knowledge.sme', 'sme_profiles', v_ent, 'invalid', 'Choose a capture window band', v_role); end if;
  if v_skills is null or cardinality(v_skills) = 0 or not kafaa_kc_ok_skills(v_skills, 8) then return kafaa_refuse('knowledge.sme', 'sme_profiles', v_ent, 'invalid', 'Choose up to eight skills from the catalogue (never security, safeguards or cyber skills)', v_role); end if;
  if length(v_head) > 140 then return kafaa_refuse('knowledge.sme', 'sme_profiles', v_ent, 'invalid', 'Keep your headline under 140 characters', v_role); end if;
  if v_head <> '' then v_bad := kafaa_kc_screen(v_head); end if;
  if v_bad is not null then return kafaa_refuse('knowledge.sme', 'sme_profiles', v_ent, v_bad->>'code', v_bad->>'msg', v_role); end if;
  select * into pp from kafaa_people where id = me;
  insert into kafaa_sme_profiles (id, person_id, kind, skill_ids, availability, departing_band, listed, headline, person_name, person_name_ar, role_id, family_id, updated_at)
  values (v_ent, me, p->>'kind', v_skills, p->>'availability', p->>'departing_band', v_listed, v_head, kafaa_kc_name(me, false), kafaa_kc_name(me, true), pp.job_role_id, pp.job_family_id, now())
  on conflict (id) do update set kind = excluded.kind, skill_ids = excluded.skill_ids, availability = excluded.availability, departing_band = excluded.departing_band, listed = excluded.listed,
    headline = excluded.headline, person_name = excluded.person_name, person_name_ar = excluded.person_name_ar, role_id = excluded.role_id, family_id = excluded.family_id, updated_at = excluded.updated_at;
  a := kafaa_audit('knowledge.sme', 'sme_profiles', v_ent, 'ok', case when v_listed then 'listed' else 'not listed' end, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'SME profile saved', a, null, jsonb_build_object('id', v_ent, 'listed', v_listed));
end $$;

create or replace function kafaa_plan_capture(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_sme text := btrim(coalesce(p->>'sme_id', '')); sp kafaa_people; ip kafaa_people; v_role text; v_iv text; v_title text := btrim(coalesce(case when jsonb_typeof(p->'title') = 'string' then p->>'title' end, ''));
  v_planned text := case when jsonb_typeof(p->'planned_on') = 'string' then p->>'planned_on' end; v_skills text[] := kafaa_kc_arr(coalesce(p->'skill_ids', '[]'::jsonb)); v_stds text[] := kafaa_kc_arr(coalesce(p->'standard_ids', '[]'::jsonb));
  v_pos text := nullif(btrim(coalesce(p->>'position_id', '')), ''); v_act text := nullif(btrim(coalesce(p->>'action_id', '')), ''); pos kafaa_klra_positions; act kafaa_klra_actions; v_bad jsonb; v_id text; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('knowledge.capture.plan', 'capture_sessions', nullif(v_sme, ''), 'not_signed_in', 'Sign in to use the knowledge capture studio'); end if;
  if not kafaa_has_grant('knowledge', array['R']) then return kafaa_refuse('knowledge.capture.plan', 'capture_sessions', nullif(v_sme, ''), 'forbidden', 'Knowledge capture is open to staff'); end if;
  select * into sp from kafaa_people where id = v_sme;
  if sp.id is null or sp.status <> 'active' or sp.kind not in ('staff', 'contractor') then return kafaa_refuse('knowledge.capture.plan', 'capture_sessions', nullif(v_sme, ''), 'not_found', 'Subject-matter expert not found'); end if;
  v_role := case when kafaa_has_grant('knowledge', array['W', 'A']) then kafaa_acting_role('knowledge', array['W', 'A'])
    when kafaa_has_grant('knowledge', array['Scope']) and kafaa_in_scope('knowledge', v_sme) then kafaa_acting_role('knowledge', array['Scope']) end;
  if v_role is null then return kafaa_refuse('knowledge.capture.plan', 'capture_sessions', v_sme, 'forbidden', 'Only interviewers (instructors and the knowledge-management owner) or the SME''s department head plan capture sessions'); end if;
  v_iv := coalesce(nullif(btrim(coalesce(p->>'interviewer_id', '')), ''), me);
  select * into ip from kafaa_people where id = v_iv;
  if v_iv = v_sme or ip.id is null or ip.status <> 'active' or ip.kind <> 'staff' or not kafaa_kc_person_has(v_iv, 'knowledge', array['W', 'A', 'Scope']) then
    return kafaa_refuse('knowledge.capture.plan', 'capture_sessions', v_sme, 'invalid', 'Choose an interviewer who is an instructor, a department head or the knowledge-management owner, other than the SME', v_role);
  end if;
  if coalesce(p->>'template', '') not in ('critical_decisions', 'rules_of_thumb', 'war_stories', 'who_to_ask', 'documents') then return kafaa_refuse('knowledge.capture.plan', 'capture_sessions', v_sme, 'invalid', 'Choose one of the five interview templates', v_role); end if;
  if not kafaa_kc_isoday(v_planned) or v_planned::date < current_date or v_planned::date > current_date + 180 then return kafaa_refuse('knowledge.capture.plan', 'capture_sessions', v_sme, 'invalid', 'Plan the session between today and six months from today', v_role); end if;
  if length(v_title) < 5 or length(v_title) > 140 then return kafaa_refuse('knowledge.capture.plan', 'capture_sessions', v_sme, 'invalid', 'Give a title of 5 to 140 characters', v_role); end if;
  v_bad := kafaa_kc_screen(v_title);
  if v_bad is not null then return kafaa_refuse('knowledge.capture.plan', 'capture_sessions', v_sme, v_bad->>'code', v_bad->>'msg', v_role); end if;
  if not kafaa_kc_ok_skills(v_skills, 8) then return kafaa_refuse('knowledge.capture.plan', 'capture_sessions', v_sme, 'invalid', 'Choose up to eight skills from the catalogue (never security, safeguards or cyber skills)', v_role); end if;
  if not kafaa_kc_ok_standards(v_stds, 6) then return kafaa_refuse('knowledge.capture.plan', 'capture_sessions', v_sme, 'invalid', 'Choose up to six qualification standards (never security-restricted ones)', v_role); end if;
  if v_pos is not null then
    select * into pos from kafaa_klra_positions where id = v_pos;
    if pos.id is null or not kafaa_kc_pos_visible(pos) then return kafaa_refuse('knowledge.capture.plan', 'capture_sessions', v_sme, 'not_found', 'Position not found', v_role); end if;
  end if;
  if v_act is not null then
    select * into act from kafaa_klra_actions where id = v_act;
    select * into pos from kafaa_klra_positions where id = act.position_id;
    if act.id is null or act.status not in ('planned', 'in_progress') or act.kind not in ('capture', 'documentation') or (v_pos is not null and act.position_id <> v_pos) or pos.id is null or not kafaa_kc_pos_visible(pos) then
      return kafaa_refuse('knowledge.capture.plan', 'capture_sessions', v_sme, 'not_found', 'Mitigation action not found or already closed', v_role);
    end if;
  end if;
  v_id := kafaa_kc_rid('cs');
  insert into kafaa_capture_sessions (id, sme_id, interviewer_id, created_by, template, title, lang, status, planned_on, held_on, duration_min, skill_ids, standard_ids, position_id, action_id,
    transcript, transcript_words, notes, asset_id, sme_name, sme_name_ar, interviewer_name, interviewer_name_ar, history, created_at, updated_at)
  values (v_id, v_sme, v_iv, me, p->>'template', v_title, case when p->>'lang' = 'ar' then 'ar' else 'en' end, 'planned', v_planned::date, null, 60, v_skills, v_stds, coalesce(v_pos, act.position_id), v_act,
    '', 0, '', null, kafaa_kc_name(v_sme, false), kafaa_kc_name(v_sme, true), kafaa_kc_name(v_iv, false), kafaa_kc_name(v_iv, true), jsonb_build_array(kafaa_kc_hist('planned')), now(), now());
  if act.id is not null then update kafaa_klra_actions set status = 'in_progress', ref_table = 'capture_sessions', ref_id = v_id where id = act.id; end if;
  insert into kafaa_sme_profiles (id, person_id, kind, skill_ids, availability, departing_band, listed, headline, person_name, person_name_ar, role_id, family_id, updated_at)
  values ('sme:' || v_sme, v_sme, 'staff', v_skills, 'available', 'unspecified', false, '', kafaa_kc_name(v_sme, false), kafaa_kc_name(v_sme, true), sp.job_role_id, sp.job_family_id, now())
  on conflict (id) do nothing;
  perform kafaa_kc_notify('nt-' || v_id || '-sme', v_sme, 'Knowledge capture interview planned: ' || v_title, 'تم التخطيط لمقابلة لحفظ المعرفة: ' || v_title, '/knowledge/capture/' || v_id, 'info');
  if v_iv <> me then perform kafaa_kc_notify('nt-' || v_id || '-iv', v_iv, 'You will interview ' || kafaa_kc_name(v_sme, false) || ': ' || v_title, 'ستجري مقابلة مع ' || kafaa_kc_name(v_sme, true) || ': ' || v_title, '/knowledge/capture/' || v_id, 'info'); end if;
  a := kafaa_audit('knowledge.capture.plan', 'capture_sessions', v_id, 'ok', (p->>'template') || ' with ' || v_sme, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Capture session planned', a, null, jsonb_build_object('id', v_id));
end $$;

create or replace function kafaa_record_capture(p_id text, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); s kafaa_capture_sessions; v_owner boolean; v_role text; v_to text := p->>'status'; v_notes text; v_held text; v_tr text; v_words int; v_bad jsonb; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('knowledge.capture.record', 'capture_sessions', p_id, 'not_signed_in', 'Sign in to use the knowledge capture studio'); end if;
  select * into s from kafaa_capture_sessions where id = p_id;
  if s.id is null then return kafaa_refuse('knowledge.capture.record', 'capture_sessions', p_id, 'not_found', 'Capture session not found'); end if;
  v_owner := kafaa_has_grant('knowledge', array['A']);
  if not (v_owner or s.sme_id = me or s.interviewer_id = me) then return kafaa_refuse('knowledge.capture.record', 'capture_sessions', p_id, 'forbidden', 'Only the SME, the interviewer or the knowledge-management owner can update this session'); end if;
  v_role := case when v_owner then kafaa_acting_role('knowledge', array['A']) else kafaa_acting_role('knowledge', array['R']) end;
  if not ((v_to = 'cancelled' and s.status in ('planned', 'held')) or (v_to = 'held' and s.status = 'planned') or (v_to = 'transcribed' and s.status in ('planned', 'held'))) then
    return kafaa_refuse('knowledge.capture.record', 'capture_sessions', p_id, 'invalid', 'This step is not possible from the session''s current status', v_role);
  end if;
  v_notes := case when p->'notes' is null or jsonb_typeof(p->'notes') = 'null' then coalesce(s.notes, '') else btrim(coalesce(case when jsonb_typeof(p->'notes') = 'string' then p->>'notes' end, '')) end;
  if length(v_notes) > 500 then return kafaa_refuse('knowledge.capture.record', 'capture_sessions', p_id, 'invalid', 'Keep notes under 500 characters', v_role); end if;
  if v_to in ('held', 'transcribed') then
    v_held := coalesce(nullif(case when jsonb_typeof(p->'held_on') = 'string' then p->>'held_on' end, ''), to_char(s.held_on, 'YYYY-MM-DD'),
      case when s.planned_on <= current_date then to_char(s.planned_on, 'YYYY-MM-DD') end, to_char(current_date, 'YYYY-MM-DD'));
    if not kafaa_kc_isoday(v_held) or v_held::date > current_date then return kafaa_refuse('knowledge.capture.record', 'capture_sessions', p_id, 'invalid', 'Give the date the session was held (not in the future)', v_role); end if;
  end if;
  v_words := s.transcript_words;
  if v_to = 'transcribed' then
    v_tr := btrim(coalesce(case when jsonb_typeof(p->'transcript') = 'string' then p->>'transcript' end, ''));
    if length(v_tr) < 200 or length(v_tr) > 60000 then return kafaa_refuse('knowledge.capture.record', 'capture_sessions', p_id, 'invalid', 'Upload a transcript of 200 to 60,000 characters (text only; no audio is processed)', v_role); end if;
    v_bad := kafaa_kc_screen(v_tr);
    if v_bad is not null then return kafaa_refuse('knowledge.capture.record', 'capture_sessions', p_id, v_bad->>'code', v_bad->>'msg', v_role); end if;
    v_words := cardinality(regexp_split_to_array(v_tr, '\s+'));
  end if;
  update kafaa_capture_sessions set status = v_to, notes = v_notes, updated_at = now(), history = history || jsonb_build_array(kafaa_kc_hist(v_to)),
    held_on = case when v_to in ('held', 'transcribed') then v_held::date else held_on end,
    transcript = case when v_to = 'transcribed' then v_tr else transcript end, transcript_words = v_words
  where id = p_id;
  a := kafaa_audit('knowledge.capture.record', 'capture_sessions', p_id, 'ok', v_to, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case v_to when 'transcribed' then 'Transcript uploaded' when 'held' then 'Session marked as held' else 'Session cancelled' end, a, null, jsonb_build_object('status', v_to, 'words', v_words));
end $$;

create or replace function kafaa_capture_board() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); v_all boolean;
begin
  if me is null then return jsonb_build_object('mode', 'mine', 'can_plan', false, 'sessions', '[]'::jsonb); end if;
  v_all := kafaa_has_grant('knowledge', array['A']);
  return jsonb_build_object('mode', case when v_all then 'all' else 'mine' end, 'can_plan', kafaa_has_grant('knowledge', array['W', 'A', 'Scope']),
    'sessions', coalesce((select jsonb_agg(kafaa_kc_session_view(s) order by s.planned_on desc, s.id collate "C") from kafaa_capture_sessions s
      where v_all or s.sme_id = me or s.interviewer_id = me or s.created_by = me), '[]'::jsonb));
end $$;

create or replace function kafaa_submit_asset(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_ent text := coalesce(nullif(btrim(coalesce(p->>'id', '')), ''), nullif(btrim(coalesce(p->>'session_id', '')), '')); v_role text; ex kafaa_knowledge_assets; sess kafaa_capture_sessions;
  v_sid text; v_t1 text; v_t2 text; v_s1 text; v_s2 text; v_body text; v_kp jsonb; v_skills text[] := kafaa_kc_arr(coalesce(p->'skill_ids', '[]'::jsonb)); v_stds text[] := kafaa_kc_arr(coalesce(p->'standard_ids', '[]'::jsonb));
  v_bad jsonb; v_sugg jsonb; v_submit boolean := coalesce(p->'submit' = 'true'::jsonb, false); v_status text; v_id text; v_sme text; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('knowledge.asset.submit', 'knowledge_assets', v_ent, 'not_signed_in', 'Sign in to use the knowledge capture studio'); end if;
  if not kafaa_has_grant('knowledge', array['R']) then return kafaa_refuse('knowledge.asset.submit', 'knowledge_assets', v_ent, 'forbidden', 'Knowledge capture is open to staff'); end if;
  v_role := case when kafaa_has_grant('knowledge', array['W', 'A']) then kafaa_acting_role('knowledge', array['W', 'A'])
    when exists (select 1 from kafaa_sme_profiles where id = 'sme:' || me)
      or exists (select 1 from kafaa_capture_sessions cs where cs.id = nullif(btrim(coalesce(p->>'session_id', '')), '') and (cs.interviewer_id = me or cs.sme_id = me))
      or exists (select 1 from kafaa_knowledge_assets ka where ka.id = nullif(btrim(coalesce(p->>'id', '')), '') and ka.author_id = me) then kafaa_acting_role('knowledge', array['R']) end;
  if v_role is null then return kafaa_refuse('knowledge.asset.submit', 'knowledge_assets', v_ent, 'forbidden', 'Only subject-matter experts and interviewers draft knowledge assets'); end if;
  if nullif(btrim(coalesce(p->>'id', '')), '') is not null then
    select * into ex from kafaa_knowledge_assets where id = btrim(p->>'id');
    if ex.id is null then return kafaa_refuse('knowledge.asset.submit', 'knowledge_assets', v_ent, 'not_found', 'Knowledge asset not found', v_role); end if;
    if ex.author_id <> me then return kafaa_refuse('knowledge.asset.submit', 'knowledge_assets', v_ent, 'forbidden', 'Only the author can change this draft', v_role); end if;
    if ex.status <> 'draft' then return kafaa_refuse('knowledge.asset.submit', 'knowledge_assets', v_ent, 'invalid', 'Only drafts (or assets sent back with changes) can be edited', v_role); end if;
  end if;
  v_sid := coalesce(nullif(btrim(coalesce(p->>'session_id', '')), ''), ex.source_session_id);
  if v_sid is not null then
    select * into sess from kafaa_capture_sessions where id = v_sid;
    if sess.id is null or not (sess.sme_id = me or sess.interviewer_id = me) or sess.status <> 'transcribed' or (sess.asset_id is not null and sess.asset_id is distinct from ex.id) then
      return kafaa_refuse('knowledge.asset.submit', 'knowledge_assets', v_ent, 'invalid', 'Draft from a session once its transcript is uploaded', v_role);
    end if;
  end if;
  v_t1 := btrim(coalesce(case when jsonb_typeof(p->'title_en') = 'string' then p->>'title_en' end, '')); v_t2 := btrim(coalesce(case when jsonb_typeof(p->'title_ar') = 'string' then p->>'title_ar' end, ''));
  v_s1 := btrim(coalesce(case when jsonb_typeof(p->'summary_en') = 'string' then p->>'summary_en' end, '')); v_s2 := btrim(coalesce(case when jsonb_typeof(p->'summary_ar') = 'string' then p->>'summary_ar' end, ''));
  v_body := btrim(coalesce(case when jsonb_typeof(p->'body') = 'string' then p->>'body' end, ''));
  if length(v_t1) not between 5 and 140 or length(v_t2) not between 5 and 140 then return kafaa_refuse('knowledge.asset.submit', 'knowledge_assets', v_ent, 'invalid', 'Give a title of 5 to 140 characters', v_role); end if;
  if length(v_s1) not between 20 and 600 or length(v_s2) not between 20 and 600 then return kafaa_refuse('knowledge.asset.submit', 'knowledge_assets', v_ent, 'invalid', 'Write a summary of 20 to 600 characters in English and in Arabic', v_role); end if;
  if length(v_body) not between 50 and 20000 then return kafaa_refuse('knowledge.asset.submit', 'knowledge_assets', v_ent, 'invalid', 'Write a body of 50 to 20,000 characters', v_role); end if;
  if jsonb_typeof(p->'key_points') is distinct from 'array' or jsonb_array_length(p->'key_points') not between 1 and 8 or exists (
      select 1 from jsonb_array_elements(p->'key_points') e(v)
      where jsonb_typeof(e.v) <> 'object' or jsonb_typeof(e.v->'en') is distinct from 'string' or jsonb_typeof(e.v->'ar') is distinct from 'string'
        or length(btrim(e.v->>'en')) not between 1 and 300 or length(btrim(e.v->>'ar')) not between 1 and 300) then
    return kafaa_refuse('knowledge.asset.submit', 'knowledge_assets', v_ent, 'invalid', 'Give one to eight key points, each under 300 characters, in English and in Arabic', v_role);
  end if;
  v_kp := (select jsonb_agg(jsonb_build_object('en', btrim(e.v->>'en'), 'ar', btrim(e.v->>'ar')) order by e.o) from jsonb_array_elements(p->'key_points') with ordinality e(v, o));
  if not kafaa_kc_ok_skills(v_skills, 8) then return kafaa_refuse('knowledge.asset.submit', 'knowledge_assets', v_ent, 'invalid', 'Choose up to eight skills from the catalogue (never security, safeguards or cyber skills)', v_role); end if;
  if not kafaa_kc_ok_standards(v_stds, 6) then return kafaa_refuse('knowledge.asset.submit', 'knowledge_assets', v_ent, 'invalid', 'Choose up to six qualification standards (never security-restricted ones)', v_role); end if;
  if coalesce(p->>'system_family', '') not in ('reactor_core', 'primary', 'secondary', 'electrical', 'i_and_c', 'chemistry', 'radiation_protection', 'maintenance', 'outage', 'human_performance', 'emergency_preparedness', 'training') then
    return kafaa_refuse('knowledge.asset.submit', 'knowledge_assets', v_ent, 'invalid', 'Choose a system family', v_role);
  end if;
  v_bad := kafaa_kc_screen(kafaa_kc_asset_text(v_t1, v_t2, v_s1, v_s2, v_body, v_kp));
  if v_bad is not null then return kafaa_refuse('knowledge.asset.submit', 'knowledge_assets', v_ent, v_bad->>'code', v_bad->>'msg', v_role); end if;
  v_sugg := coalesce((select jsonb_agg(jsonb_build_object('kind', x.v->>'kind', 'ref', x.v->>'ref',
      'score', case when jsonb_typeof(x.v->'score') = 'number' then round((x.v->>'score')::numeric, 2) else 0 end,
      'terms', coalesce((select jsonb_agg(left(q.z, 40) order by q.o) from (select t.v #>> '{}' z, t.o, row_number() over (order by t.o) rn from jsonb_array_elements(case when jsonb_typeof(x.v->'terms') = 'array' then x.v->'terms' else '[]'::jsonb end) with ordinality t(v, o) where jsonb_typeof(t.v) = 'string') q where q.rn <= 6), '[]'::jsonb),
      'decision', 'pending') order by x.o)
    from (select e.v, e.o from jsonb_array_elements(case when jsonb_typeof(p->'suggestions') = 'array' then p->'suggestions' else '[]'::jsonb end) with ordinality e(v, o)
      where jsonb_typeof(e.v) = 'object' and jsonb_typeof(e.v->'ref') = 'string' and (
        (e.v->>'kind' = 'skill' and kafaa_kc_ok_skills(array[e.v->>'ref'], 1)) or (e.v->>'kind' = 'oe' and exists (select 1 from kafaa_oe_lessons o where o.id = e.v->>'ref'))
        or (e.v->>'kind' = 'course' and exists (select 1 from kafaa_courses c where c.id = e.v->>'ref')))
      order by e.o limit 24) x), '[]'::jsonb);
  v_status := case when v_submit then 'review' else 'draft' end;
  v_sme := coalesce(sess.sme_id, ex.sme_id, me);
  v_id := coalesce(ex.id, kafaa_kc_rid('kas'));
  if ex.id is not null then
    update kafaa_asset_reviews set superseded = true where asset_id = v_id and not superseded;
    update kafaa_knowledge_assets set title_en = v_t1, title_ar = v_t2, summary_en = v_s1, summary_ar = v_s2, body = v_body, body_lang = case when p->>'body_lang' = 'ar' then 'ar' else 'en' end,
      key_points = v_kp, skill_ids = v_skills, standard_ids = v_stds, system_family = p->>'system_family', status = v_status, published = false, suggestions = v_sugg,
      source_session_id = v_sid, position_id = coalesce(sess.position_id, ex.position_id), template = coalesce(sess.template, ex.template), sme_id = v_sme,
      sme_name = kafaa_kc_name(v_sme, false), sme_name_ar = kafaa_kc_name(v_sme, true), updated_at = now(),
      version = ex.version + case when v_submit and ex.submitted_at is not null then 1 else 0 end, submitted_at = case when v_submit then now() else ex.submitted_at end
    where id = v_id;
  else
    insert into kafaa_knowledge_assets (id, title_en, title_ar, summary_en, summary_ar, body, body_lang, key_points, skill_ids, standard_ids, requal_standard_ids, oe_ids, course_ids, system_family,
      status, published, reviewers, suggestions, author_id, sme_id, source_session_id, position_id, author_name, author_name_ar, sme_name, sme_name_ar, template, used_by, version,
      submitted_at, published_at, published_by, withdrawn_at, withdrawn_reason, created_at, updated_at)
    values (v_id, v_t1, v_t2, v_s1, v_s2, v_body, case when p->>'body_lang' = 'ar' then 'ar' else 'en' end, v_kp, v_skills, v_stds, '{}', '{}', '{}', p->>'system_family',
      v_status, false, '{}', v_sugg, me, v_sme, v_sid, sess.position_id, kafaa_kc_name(me, false), kafaa_kc_name(me, true), kafaa_kc_name(v_sme, false), kafaa_kc_name(v_sme, true), sess.template, 0, 1,
      case when v_submit then now() end, null, null, null, null, now(), now());
  end if;
  if sess.id is not null then update kafaa_capture_sessions set asset_id = v_id, updated_at = now() where id = sess.id; end if;
  a := kafaa_audit('knowledge.asset.submit', 'knowledge_assets', v_id, 'ok', v_status, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when v_submit then 'Sent for review: a technical review and a security and content check' else 'Draft saved' end, a, null, jsonb_build_object('id', v_id, 'status', v_status));
end $$;

create or replace function kafaa_review_queue() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if kafaa_me() is null or not kafaa_has_grant('knowledge', array['W', 'A']) then return jsonb_build_object('can_review', false, 'can_publish', false, 'items', '[]'::jsonb); end if;
  return jsonb_build_object('can_review', true, 'can_publish', kafaa_has_grant('knowledge', array['A']), 'items', coalesce((
    select jsonb_agg(jsonb_build_object('id', a.id, 'title_en', a.title_en, 'title_ar', a.title_ar, 'summary_en', a.summary_en, 'summary_ar', a.summary_ar, 'body', a.body, 'body_lang', a.body_lang,
      'key_points', a.key_points, 'skill_ids', to_jsonb(a.skill_ids), 'standard_ids', to_jsonb(a.standard_ids), 'oe_ids', to_jsonb(a.oe_ids), 'course_ids', to_jsonb(a.course_ids),
      'system_family', a.system_family, 'status', a.status, 'suggestions', a.suggestions, 'author_id', a.author_id, 'sme_id', a.sme_id, 'author_name', a.author_name, 'author_name_ar', a.author_name_ar,
      'sme_name', a.sme_name, 'sme_name_ar', a.sme_name_ar, 'template', a.template, 'source_session_id', a.source_session_id, 'version', a.version, 'submitted_at', kafaa_kc_ts(a.submitted_at),
      'reviews', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'reviewer_id', r.reviewer_id, 'reviewer_name', r.reviewer_name, 'reviewer_name_ar', r.reviewer_name_ar, 'kind', r.kind,
          'outcome', r.outcome, 'note', coalesce(r.note, ''), 'checks', r.checks, 'created_at', kafaa_kc_ts(r.created_at), 'superseded', r.superseded) order by r.created_at, r.id collate "C")
        from kafaa_asset_reviews r where r.asset_id = a.id), '[]'::jsonb)) order by a.submitted_at, a.id collate "C")
    from kafaa_knowledge_assets a where a.status = 'review'), '[]'::jsonb));
end $$;

create or replace function kafaa_review_asset(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_aid text := btrim(coalesce(p->>'asset_id', '')); v_role text; x kafaa_knowledge_assets; v_kind text := p->>'kind'; v_out text := p->>'outcome';
  v_note text := btrim(coalesce(case when jsonb_typeof(p->'note') = 'string' then p->>'note' end, '')); v_checks jsonb; v_dec jsonb := case when jsonb_typeof(p->'decisions') = 'object' then p->'decisions' else '{}'::jsonb end;
  v_decided jsonb := '{}'::jsonb; v_next jsonb; v_bad jsonb; v_id text; v_status text; s jsonb; k text; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('knowledge.asset.review', 'knowledge_assets', nullif(v_aid, ''), 'not_signed_in', 'Sign in to use the knowledge capture studio'); end if;
  if not kafaa_has_grant('knowledge', array['W', 'A']) then return kafaa_refuse('knowledge.asset.review', 'knowledge_assets', nullif(v_aid, ''), 'forbidden', 'Only interviewers and the knowledge-management owner review knowledge assets'); end if;
  v_role := kafaa_acting_role('knowledge', array['W', 'A']);
  select * into x from kafaa_knowledge_assets where id = v_aid;
  if x.id is null then return kafaa_refuse('knowledge.asset.review', 'knowledge_assets', nullif(v_aid, ''), 'not_found', 'Knowledge asset not found', v_role); end if;
  if x.status <> 'review' then return kafaa_refuse('knowledge.asset.review', 'knowledge_assets', v_aid, 'invalid', 'This asset is not waiting for review', v_role); end if;
  if x.author_id = me or x.sme_id = me then return kafaa_refuse('knowledge.asset.review', 'knowledge_assets', v_aid, 'maker_checker', 'You cannot review or publish an asset you wrote or that captures your own knowledge', v_role); end if;
  if v_kind is null or v_kind not in ('technical', 'security') then return kafaa_refuse('knowledge.asset.review', 'knowledge_assets', v_aid, 'invalid', 'Choose a technical review or a security and content check', v_role); end if;
  if v_out is null or v_out not in ('pass', 'changes') then return kafaa_refuse('knowledge.asset.review', 'knowledge_assets', v_aid, 'invalid', 'Choose pass or changes', v_role); end if;
  if length(v_note) > 500 then return kafaa_refuse('knowledge.asset.review', 'knowledge_assets', v_aid, 'invalid', 'Keep notes under 500 characters', v_role); end if;
  if v_out = 'changes' and length(v_note) < 10 then return kafaa_refuse('knowledge.asset.review', 'knowledge_assets', v_aid, 'invalid', 'Explain the changes you need in at least 10 characters', v_role); end if;
  if exists (select 1 from kafaa_asset_reviews r where r.asset_id = v_aid and r.reviewer_id = me and not r.superseded) then return kafaa_refuse('knowledge.asset.review', 'knowledge_assets', v_aid, 'conflict', 'You have already reviewed this version', v_role); end if;
  v_checks := jsonb_build_object('accurate', coalesce(p->'checks'->'accurate' = 'true'::jsonb, false), 'deidentified', coalesce(p->'checks'->'deidentified' = 'true'::jsonb, false), 'no_security', coalesce(p->'checks'->'no_security' = 'true'::jsonb, false));
  if v_out = 'pass' and v_kind = 'security' then
    if not ((v_checks->>'deidentified')::boolean and (v_checks->>'no_security')::boolean) then return kafaa_refuse('knowledge.asset.review', 'knowledge_assets', v_aid, 'invalid', 'A security and content pass needs both checks: de-identified and free of security, safeguards and cyber details', v_role); end if;
    v_bad := kafaa_kc_screen(kafaa_kc_asset_text(x.title_en, x.title_ar, x.summary_en, x.summary_ar, x.body, x.key_points));
    if v_bad is not null then return kafaa_refuse('knowledge.asset.review', 'knowledge_assets', v_aid, v_bad->>'code', v_bad->>'msg', v_role); end if;
  end if;
  if v_out = 'pass' and v_kind = 'technical' and (not (v_checks->>'accurate')::boolean or exists (
      select 1 from jsonb_array_elements(x.suggestions) e(v) where coalesce(v_dec->>((e.v->>'kind') || ':' || (e.v->>'ref')), '') not in ('accepted', 'rejected'))) then
    return kafaa_refuse('knowledge.asset.review', 'knowledge_assets', v_aid, 'invalid', 'A technical pass needs the accuracy check and a decision on every suggestion', v_role);
  end if;
  if v_kind = 'technical' then
    for s in select e.v from jsonb_array_elements(x.suggestions) e(v) loop
      k := (s->>'kind') || ':' || (s->>'ref');
      if v_dec->>k in ('accepted', 'rejected') then v_decided := v_decided || jsonb_build_object(k, v_dec->>k); end if;
    end loop;
  end if;
  v_id := kafaa_kc_rid('arv');
  insert into kafaa_asset_reviews (id, asset_id, asset_author_id, reviewer_id, kind, outcome, note, checks, decisions, reviewer_name, reviewer_name_ar, superseded, version, created_at)
  values (v_id, v_aid, x.author_id, me, v_kind, v_out, v_note, v_checks, v_decided, kafaa_kc_name(me, false), kafaa_kc_name(me, true), false, x.version, now());
  if v_kind = 'technical' and v_decided <> '{}'::jsonb then
    v_next := coalesce((select jsonb_agg(case when v_decided ? ((e.v->>'kind') || ':' || (e.v->>'ref')) then e.v || jsonb_build_object('decision', v_decided->>((e.v->>'kind') || ':' || (e.v->>'ref'))) else e.v end order by e.o)
      from jsonb_array_elements(x.suggestions) with ordinality e(v, o)), '[]'::jsonb);
    update kafaa_knowledge_assets set suggestions = v_next,
      skill_ids = kafaa_kc_merge(skill_ids, array(select e.v->>'ref' from jsonb_array_elements(v_next) with ordinality e(v, o) where e.v->>'kind' = 'skill' and e.v->>'decision' = 'accepted' order by e.o)),
      oe_ids = kafaa_kc_merge(oe_ids, array(select e.v->>'ref' from jsonb_array_elements(v_next) with ordinality e(v, o) where e.v->>'kind' = 'oe' and e.v->>'decision' = 'accepted' order by e.o)),
      course_ids = kafaa_kc_merge(course_ids, array(select e.v->>'ref' from jsonb_array_elements(v_next) with ordinality e(v, o) where e.v->>'kind' = 'course' and e.v->>'decision' = 'accepted' order by e.o))
    where id = v_aid;
  end if;
  update kafaa_knowledge_assets set updated_at = now(), status = case when v_out = 'changes' then 'draft' else status end where id = v_aid;
  v_status := case when v_out = 'changes' then 'draft' else 'review' end;
  if v_out = 'changes' then perform kafaa_kc_notify('nt-' || v_id, x.author_id, 'Changes requested on "' || x.title_en || '"', 'مطلوب تعديلات على "' || x.title_ar || '"', '/knowledge/capture', 'warn'); end if;
  a := kafaa_audit('knowledge.asset.review', 'knowledge_assets', v_aid, 'ok', v_kind || ':' || v_out, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when v_out = 'pass' then 'Review recorded' else 'Sent back to the author with your changes' end, a, null, jsonb_build_object('id', v_id, 'status', v_status));
end $$;

create or replace function kafaa_publish_asset(p_id text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; x kafaa_knowledge_assets; v_pair text[]; v_bad jsonb; s kafaa_capture_sessions; k kafaa_klra_actions; v_closed text; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('knowledge.asset.publish', 'knowledge_assets', p_id, 'not_signed_in', 'Sign in to use the knowledge capture studio'); end if;
  if not kafaa_has_grant('knowledge', array['A']) then return kafaa_refuse('knowledge.asset.publish', 'knowledge_assets', p_id, 'forbidden', 'Only the knowledge-management owner publishes knowledge assets'); end if;
  v_role := kafaa_acting_role('knowledge', array['A']);
  select * into x from kafaa_knowledge_assets where id = p_id;
  if x.id is null then return kafaa_refuse('knowledge.asset.publish', 'knowledge_assets', p_id, 'not_found', 'Knowledge asset not found', v_role); end if;
  if x.status <> 'review' then return kafaa_refuse('knowledge.asset.publish', 'knowledge_assets', p_id, 'invalid', 'This asset is not waiting for review', v_role); end if;
  if x.author_id = me or x.sme_id = me then return kafaa_refuse('knowledge.asset.publish', 'knowledge_assets', p_id, 'maker_checker', 'You cannot review or publish an asset you wrote or that captures your own knowledge', v_role); end if;
  v_pair := kafaa_kc_review_pair(p_id, x.author_id, x.sme_id);
  if v_pair is null then return kafaa_refuse('knowledge.asset.publish', 'knowledge_assets', p_id, 'reviews_missing', 'Publishing needs a technical review pass and a security and content pass by two different people other than the author', v_role); end if;
  v_bad := kafaa_kc_screen(kafaa_kc_asset_text(x.title_en, x.title_ar, x.summary_en, x.summary_ar, x.body, x.key_points));
  if v_bad is not null then return kafaa_refuse('knowledge.asset.publish', 'knowledge_assets', p_id, v_bad->>'code', v_bad->>'msg', v_role); end if;
  update kafaa_knowledge_assets set status = 'published', published = true, reviewers = v_pair, published_at = now(), published_by = me, updated_at = now() where id = p_id;
  select * into s from kafaa_capture_sessions where id = x.source_session_id;
  select * into k from kafaa_klra_actions where id = s.action_id;
  if k.id is not null and k.status in ('planned', 'in_progress') then
    update kafaa_klra_actions set status = 'done', outcome = 'Knowledge asset published: ' || p_id, closed_by = me, closed_at = now() where id = k.id;
    v_closed := k.id;
  end if;
  perform kafaa_kc_notify('nt-' || p_id || '-published', x.author_id, 'Published: ' || x.title_en, 'تم النشر: ' || x.title_ar, '/knowledge/assets/' || p_id, 'ok');
  if x.sme_id <> x.author_id then perform kafaa_kc_notify('nt-' || p_id || '-published-sme', x.sme_id, 'Your knowledge was published: ' || x.title_en, 'تم نشر معرفتك: ' || x.title_ar, '/knowledge/assets/' || p_id, 'ok'); end if;
  l := kafaa_ledger('kafaa.knowledge.publish', format('Knowledge asset %s published', p_id));
  a := kafaa_audit('knowledge.asset.publish', 'knowledge_assets', p_id, 'ok', format('reviewers %s, %s', v_pair[1], v_pair[2]), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Published to the knowledge base', a, l, jsonb_build_object('status', 'published', 'action_closed', v_closed));
end $$;

create or replace function kafaa_withdraw_asset(p_id text, p_reason text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); x kafaa_knowledge_assets; v_a boolean; v_role text; v_text text := btrim(coalesce(p_reason, '')); a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('knowledge.asset.withdraw', 'knowledge_assets', p_id, 'not_signed_in', 'Sign in to use the knowledge capture studio'); end if;
  select * into x from kafaa_knowledge_assets where id = p_id;
  v_a := kafaa_has_grant('knowledge', array['A']);
  if x.id is null or not (x.published or x.author_id = me or x.sme_id = me or v_a) then return kafaa_refuse('knowledge.asset.withdraw', 'knowledge_assets', p_id, 'not_found', 'Knowledge asset not found'); end if;
  if not (v_a or x.author_id = me) then return kafaa_refuse('knowledge.asset.withdraw', 'knowledge_assets', p_id, 'forbidden', 'Only the knowledge-management owner or the author withdraws an asset'); end if;
  v_role := case when v_a then kafaa_acting_role('knowledge', array['A']) else kafaa_acting_role('knowledge', array['R']) end;
  if x.status <> 'published' then return kafaa_refuse('knowledge.asset.withdraw', 'knowledge_assets', p_id, 'invalid', 'Only published assets can be used, withdrawn or attached to standards', v_role); end if;
  if length(v_text) < 5 or length(v_text) > 300 then return kafaa_refuse('knowledge.asset.withdraw', 'knowledge_assets', p_id, 'invalid', 'Give a reason of 5 to 300 characters', v_role); end if;
  update kafaa_knowledge_assets set status = 'withdrawn', published = false, withdrawn_at = now(), withdrawn_reason = v_text, updated_at = now() where id = p_id;
  l := kafaa_ledger('kafaa.knowledge.withdraw', format('Knowledge asset %s withdrawn', p_id));
  a := kafaa_audit('knowledge.asset.withdraw', 'knowledge_assets', p_id, 'ok', v_text, case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Withdrawn: it no longer appears in search', a, l, jsonb_build_object('status', 'withdrawn'));
end $$;

create or replace function kafaa_attach_asset_requal(p_id text, p_standard_ids text[]) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; x kafaa_knowledge_assets; v_stds text[]; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('knowledge.asset.requal', 'knowledge_assets', p_id, 'not_signed_in', 'Sign in to use the knowledge capture studio'); end if;
  if not kafaa_has_grant('knowledge', array['A']) then return kafaa_refuse('knowledge.asset.requal', 'knowledge_assets', p_id, 'forbidden', 'Only the knowledge-management owner publishes knowledge assets'); end if;
  v_role := kafaa_acting_role('knowledge', array['A']);
  select * into x from kafaa_knowledge_assets where id = p_id;
  if x.id is null then return kafaa_refuse('knowledge.asset.requal', 'knowledge_assets', p_id, 'not_found', 'Knowledge asset not found', v_role); end if;
  if x.status <> 'published' then return kafaa_refuse('knowledge.asset.requal', 'knowledge_assets', p_id, 'invalid', 'Only published assets can be used, withdrawn or attached to standards', v_role); end if;
  v_stds := kafaa_kc_arr(to_jsonb(p_standard_ids));
  if not kafaa_kc_ok_standards(v_stds, 6) then return kafaa_refuse('knowledge.asset.requal', 'knowledge_assets', p_id, 'invalid', 'Choose up to six qualification standards (never security-restricted ones)', v_role); end if;
  update kafaa_knowledge_assets set requal_standard_ids = v_stds, updated_at = now() where id = p_id;
  a := kafaa_audit('knowledge.asset.requal', 'knowledge_assets', p_id, 'ok', coalesce(nullif(array_to_string(v_stds, ','), ''), 'none'), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Read-before-requalification standards saved', a, null, jsonb_build_object('requal_standard_ids', to_jsonb(v_stds)));
end $$;

create or replace function kafaa_mark_asset_used(p_id text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; x kafaa_knowledge_assets; v_uid text; v_n int; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('knowledge.asset.use', 'knowledge_assets', p_id, 'not_signed_in', 'Sign in to use the knowledge capture studio'); end if;
  if not kafaa_has_grant('knowledge', array['R']) then return kafaa_refuse('knowledge.asset.use', 'knowledge_assets', p_id, 'forbidden', 'Knowledge capture is open to staff'); end if;
  v_role := kafaa_acting_role('knowledge', array['R']);
  select * into x from kafaa_knowledge_assets where id = p_id;
  if x.id is null or not x.published then return kafaa_refuse('knowledge.asset.use', 'knowledge_assets', p_id, 'not_found', 'Knowledge asset not found', v_role); end if;
  v_uid := 'au:' || p_id || ':' || me;
  insert into kafaa_asset_uses (id, asset_id, person_id, used_on) values (v_uid, p_id, me, current_date) on conflict (id) do nothing;
  select count(*)::int into v_n from kafaa_asset_uses where asset_id = p_id;
  update kafaa_knowledge_assets set used_by = v_n where id = p_id;
  a := kafaa_audit('knowledge.asset.use', 'asset_uses', v_uid, 'ok', null, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Marked as used', a, null, jsonb_build_object('used_by', v_n));
end $$;

-- ───────────── Grants: internal helpers are not executable by API roles; RPCs only by signed-in users.
revoke all on function kafaa_kc_ts(timestamptz), kafaa_kc_rid(text), kafaa_kc_isoday(text), kafaa_kc_quarter(date), kafaa_kc_quarter_end(text), kafaa_kc_thresholds(), kafaa_kc_band(integer, jsonb),
  kafaa_kc_cell(integer), kafaa_kc_reason(text, jsonb, integer), kafaa_kc_propose(kafaa_klra_positions, integer), kafaa_kc_assets_for(text), kafaa_kc_pos_visible(kafaa_klra_positions), kafaa_kc_acting(),
  kafaa_kc_pos_view(kafaa_klra_positions), kafaa_kc_action_view(kafaa_klra_actions), kafaa_kc_mitigation(text, text, text), kafaa_kc_row(kafaa_klra_assessments, kafaa_klra_positions, jsonb),
  kafaa_kc_heatmap_compute(jsonb, text), kafaa_kc_screen(text), kafaa_kc_arr(jsonb), kafaa_kc_ok_skills(text[], integer), kafaa_kc_ok_standards(text[], integer), kafaa_kc_person_has(text, text, text[]),
  kafaa_kc_name(text, boolean), kafaa_kc_notify(text, text, text, text, text, text), kafaa_kc_hist(text), kafaa_kc_session_view(kafaa_capture_sessions),
  kafaa_kc_asset_text(text, text, text, text, text, jsonb), kafaa_kc_review_pair(text, text, text), kafaa_kc_merge(text[], text[]) from public, anon, authenticated;
revoke all on function kafaa_klra_register(text), kafaa_klra_heatmap(text), kafaa_klra_position(text), kafaa_assess_position(jsonb), kafaa_reassess_quarter(text), kafaa_plan_mitigation(jsonb),
  kafaa_close_action(text, text, text), kafaa_set_klra_thresholds(integer, integer), kafaa_set_sme_profile(jsonb), kafaa_plan_capture(jsonb), kafaa_record_capture(text, jsonb), kafaa_capture_board(),
  kafaa_submit_asset(jsonb), kafaa_review_queue(), kafaa_review_asset(jsonb), kafaa_publish_asset(text), kafaa_withdraw_asset(text, text), kafaa_attach_asset_requal(text, text[]), kafaa_mark_asset_used(text) from public, anon;
grant execute on function kafaa_klra_register(text), kafaa_klra_heatmap(text), kafaa_klra_position(text), kafaa_assess_position(jsonb), kafaa_reassess_quarter(text), kafaa_plan_mitigation(jsonb),
  kafaa_close_action(text, text, text), kafaa_set_klra_thresholds(integer, integer), kafaa_set_sme_profile(jsonb), kafaa_plan_capture(jsonb), kafaa_record_capture(text, jsonb), kafaa_capture_board(),
  kafaa_submit_asset(jsonb), kafaa_review_queue(), kafaa_review_asset(jsonb), kafaa_publish_asset(text), kafaa_withdraw_asset(text, text), kafaa_attach_asset_requal(text, text[]), kafaa_mark_asset_used(text) to authenticated;
