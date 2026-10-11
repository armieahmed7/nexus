-- [FS wave D · E3 · FS31 + FS32 + FS33] Future-skills micro-credentials with a strategic tier, a CLR-shaped learner record with
-- selective disclosure, and skill goals with a date (M17 Skills Passport).
-- FS31: F32 definitions gain the adaptive (FS21 bank result at a level) and task (passed FS22 performance task) criteria, counting only
--   attempts with counts = true whose integrity report is not voided, and the five FS02 future-skill areas; a strategic tier
--   (kafaa_microcred_defs.strategic) whose holders are eligible for the gigs and rotations that name the credential
--   (kafaa_microcred_unlocks, kafaa_fc_target_check = the F08/F15 hand-off); "where this credential takes you"; and a strategic-tier
--   report against internal moves (correlation, never causation; under 10 suppressed). Mirror of src/modules/m17/futureCreds.ts and
--   microcred.ts (kafaa_fc_*, kafaa_mc_crit / kafaa_mc_eligibility / kafaa_mc_validate_def redefined with the same signatures).
-- FS32: shareable items (micro-credentials active or renewal due, active F04 badges, qualification mirror lines as qualified / not
--   qualified only, skills with their provenance; never a security standard or skill, never a medical flag), a 1EdTech CLR 2.0-shaped
--   ClrCredential bundle (signed credentials embedded as issued, record statements for mirror lines and skills, stack associations,
--   holder initials only), share links with three consent gates, an expiry of 1-90 days and revocation, and a rate-limited public verify
--   that shows only the shared items while the link is active. Mirror of src/modules/m17/learnerRecord.ts (kafaa_lr_*).
-- FS33: the plan behind an FS07 skill goal (kafaa_skill_goal_plans: target date, note, sharing). The goal row stays FS07's
--   kafaa_skill_goals (the Coach reads it); FS33's RPCs write both. Managers read a plan only while it is shared (share_person) and
--   their Scope covers the person. Mirror of src/modules/m17/skillGoals.ts (kafaa_sg_*).
-- Shared write (logged in CONTRACT.md): kafaa_skill_goals (M28/FS07) rows are inserted and updated only inside kafaa_save_skill_goal and
--   kafaa_withdraw_skill_goal (SECURITY DEFINER), with the same rules as FS07's kafaa_set_skill_goal.
-- PGlite parity and checks: scripts/validate/fs43-credentials-record-goals.mjs.
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.

-- @@PART1@@ ───────────── Tables, columns, checks, RLS (generated DDL, additive)
-- FS32: every share reference is one of the four kinds (used by the table check below).
create or replace function kafaa_lr_refs_ok(p text[]) returns boolean language sql immutable set search_path = public as $$
  select coalesce(bool_and(r ~ '^(mc|badge|qual|skill):[A-Za-z0-9._:-]{1,120}$'), true) from unnest(p) r
$$;
alter table kafaa_microcred_defs add column if not exists strategic boolean not null default false;
alter table kafaa_microcred_defs add column if not exists strategic_note text;
alter table kafaa_microcred_defs add column if not exists strategic_since date;
create index if not exists kafaa_microcred_defs_strategic_idx on kafaa_microcred_defs (strategic);

create table if not exists kafaa_microcred_unlocks (
  id text primary key,
  def_code text not null,
  target_kind text not null check (target_kind in ('opportunity', 'rotation')),
  target_id text not null,
  note_en text not null,
  note_ar text not null,
  active boolean not null default true,
  set_by text,
  set_at timestamptz not null default now()
);
comment on table kafaa_microcred_unlocks is '[M17] Gigs and rotations that name a strategic micro-credential (FS31)';
create table if not exists kafaa_record_shares (
  id text primary key,
  person_id text not null,
  token text not null unique,
  label text not null,
  items text[] not null default '{}'::text[],
  holder_initials text not null default '',
  consents jsonb not null default '{}'::jsonb,
  expires_on date not null,
  revoked_at timestamptz,
  revoke_reason text,
  views integer not null default 0,
  last_viewed_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table kafaa_record_shares is '[M17] Curated learner-record share links with consent, expiry and revocation (FS32)';
create table if not exists kafaa_skill_goal_plans (
  id text primary key,
  person_id text not null,
  skill_id text not null,
  target_level integer not null default 2,
  target_date date not null,
  note text,
  shared boolean not null default false,
  share_person text,
  status text not null default 'active' check (status in ('active', 'removed')),
  open_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  removed_at timestamptz
);
comment on table kafaa_skill_goal_plans is '[M17] Skill goals with a target date, shared with the manager only by choice (FS33)';
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_record_shares_person_id_fk') then alter table kafaa_record_shares add constraint kafaa_record_shares_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_goal_plans_person_id_fk') then alter table kafaa_skill_goal_plans add constraint kafaa_skill_goal_plans_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_goal_plans_skill_id_fk') then alter table kafaa_skill_goal_plans add constraint kafaa_skill_goal_plans_skill_id_fk foreign key (skill_id) references kafaa_skills(id) deferrable initially deferred; end if; end $$;
-- FS33: a plan is readable by managers only while it is active and shared (share_person = person_id); open_read never opens it to R/W/A
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_goal_plans_share_ck') then
  alter table kafaa_skill_goal_plans add constraint kafaa_skill_goal_plans_share_ck check ((share_person is null and not (shared and status = 'active')) or (share_person = person_id and shared and status = 'active') or (share_person is null and status = 'removed')); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_goal_plans_open_ck') then
  alter table kafaa_skill_goal_plans add constraint kafaa_skill_goal_plans_open_ck check (open_read = false); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_goal_plans_level_ck') then
  alter table kafaa_skill_goal_plans add constraint kafaa_skill_goal_plans_level_ck check (target_level between 1 and 4); end if; end $$;
-- FS32: a share holds 1-30 references of the four kinds and never outlives 90 days from creation
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_record_shares_items_ck') then
  alter table kafaa_record_shares add constraint kafaa_record_shares_items_ck check (cardinality(items) between 1 and 30 and kafaa_lr_refs_ok(items)); end if; end $$;
create index if not exists kafaa_microcred_unlocks_def_code_idx on kafaa_microcred_unlocks (def_code);
create index if not exists kafaa_microcred_unlocks_target_id_idx on kafaa_microcred_unlocks (target_id);
create index if not exists kafaa_microcred_unlocks_active_idx on kafaa_microcred_unlocks (active);
create index if not exists kafaa_record_shares_person_id_idx on kafaa_record_shares (person_id);
create index if not exists kafaa_skill_goal_plans_person_id_idx on kafaa_skill_goal_plans (person_id);
create index if not exists kafaa_skill_goal_plans_skill_id_idx on kafaa_skill_goal_plans (skill_id);
create index if not exists kafaa_skill_goal_plans_share_person_idx on kafaa_skill_goal_plans (share_person);
create index if not exists kafaa_skill_goal_plans_status_idx on kafaa_skill_goal_plans (status);
do $$ begin
  execute 'alter table kafaa_microcred_unlocks enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_microcred_unlocks' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_microcred_unlocks for select to anon, authenticated using (kafaa_rule_read(''frameworks'', null::text, null::text, true))'; end if;
  execute 'alter table kafaa_record_shares enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_record_shares' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_record_shares for select to anon, authenticated using (kafaa_rule_read(''own_profile'', person_id, null::text, true))'; end if;
  execute 'alter table kafaa_skill_goal_plans enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_skill_goal_plans' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_skill_goal_plans for select to anon, authenticated using (kafaa_rule_read(''own_profile'', person_id, null::text, true) or kafaa_rule_read(''skills_profile'', share_person, null::text, open_read))'; end if;
end $$;
revoke insert, update, delete on kafaa_microcred_unlocks, kafaa_record_shares, kafaa_skill_goal_plans from anon, authenticated;
grant select on kafaa_microcred_unlocks, kafaa_record_shares, kafaa_skill_goal_plans to anon, authenticated;

-- @@PART2@@ ───────────── F32 rules extended for FS31 (same signatures; mirror of microcred.ts)
-- One criterion: status, met, level and the evidence it rests on. + adaptive and task (FS31).
create or replace function kafaa_mc_crit(c jsonb, p_person text, p_today date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare k text := c ->> 'kind'; v_ref text := coalesce(c ->> 'ref', ''); tr kafaa_training_records; v_months integer; at kafaa_attempts; ap kafaa_opportunity_applications;
  ps kafaa_person_skills; v_min integer; v_lvl integer; v_ev jsonb; aa kafaa_adaptive_attempts; ta kafaa_task_attempts;
begin
  v_min := case when jsonb_typeof(c -> 'min_level') = 'number' and (c ->> 'min_level')::numeric <> 0 then (c ->> 'min_level')::numeric::integer else 2 end;
  if k = 'course' then
    select * into tr from kafaa_training_records t where t.person_id = p_person and t.course_id = v_ref and t.result in ('passed', 'completed')
      order by t.completed_on desc, t.id collate "C" desc limit 1;
    if tr.id is null then return jsonb_build_object('status', 'missing', 'met', false, 'level', null, 'evidence', '[]'::jsonb); end if;
    v_ev := jsonb_build_array(jsonb_build_object('table', 'training_records', 'id', tr.id, 'date', to_char(tr.completed_on, 'YYYY-MM-DD'), 'level', null));
    select coalesce(validity_months, 0) into v_months from kafaa_courses where id = v_ref;
    if coalesce(v_months, 0) > 0 and (tr.completed_on + make_interval(months => v_months))::date < p_today then
      return jsonb_build_object('status', 'lapsed', 'met', false, 'level', null, 'evidence', v_ev);
    end if;
    return jsonb_build_object('status', 'met', 'met', true, 'level', null, 'evidence', v_ev);
  elsif k = 'assessment' then
    select * into at from kafaa_attempts t where t.person_id = p_person and t.form_id = v_ref and t.passed is true and t.released is true
      order by t.submitted_at desc nulls last, t.id collate "C" desc limit 1;
    if at.id is null then return jsonb_build_object('status', 'missing', 'met', false, 'level', null, 'evidence', '[]'::jsonb); end if;
    return jsonb_build_object('status', 'met', 'met', true, 'level', null, 'evidence', jsonb_build_array(jsonb_build_object('table', 'attempts', 'id', at.id,
      'date', case when at.submitted_at is null then null else to_char(at.submitted_at at time zone 'UTC', 'YYYY-MM-DD') end, 'level', null)));
  elsif k = 'opportunity' then
    select a.* into ap from kafaa_opportunity_applications a join kafaa_opportunities o on o.id = a.opportunity_id
      where a.person_id = p_person and a.status = 'completed' and (case when v_ref like 'kind:%' then o.kind = substr(v_ref, 6) else o.id = v_ref end)
      order by a.completed_at desc nulls last, a.id collate "C" desc limit 1;
    if ap.id is null then return jsonb_build_object('status', 'missing', 'met', false, 'level', null, 'evidence', '[]'::jsonb); end if;
    return jsonb_build_object('status', 'met', 'met', true, 'level', null, 'evidence', jsonb_build_array(jsonb_build_object('table', 'opportunity_applications', 'id', ap.id,
      'date', case when ap.completed_at is null then null else to_char(ap.completed_at at time zone 'UTC', 'YYYY-MM-DD') end, 'level', null)));
  elsif k = 'skill' then
    select * into ps from kafaa_person_skills s where s.id = 'ps:' || p_person || ':' || v_ref and s.active is true;
    if ps.id is null then return jsonb_build_object('status', 'missing', 'met', false, 'level', 0, 'evidence', '[]'::jsonb); end if;
    v_lvl := coalesce(ps.level, 0);
    v_ev := jsonb_build_array(jsonb_build_object('table', 'person_skills', 'id', ps.id, 'date', null, 'level', v_lvl));
    if v_lvl < v_min then return jsonb_build_object('status', 'missing', 'met', false, 'level', v_lvl, 'evidence', v_ev); end if;
    if ps.basis not in ('verified', 'evidenced', 'validated') then return jsonb_build_object('status', 'claimed', 'met', false, 'level', v_lvl, 'evidence', v_ev); end if;
    return jsonb_build_object('status', 'met', 'met', true, 'level', v_lvl, 'evidence', v_ev);
  elsif k = 'adaptive' then
    -- FS31: the latest counted result (integrity not voided) at or above the level; criterion banks need the standard met
    if not exists (select 1 from kafaa_adaptive_attempts a where a.person_id = p_person and a.bank_id = v_ref and a.status = 'completed' and a.counts is not false
        and not exists (select 1 from kafaa_integrity_reports r where r.attempt_id = a.id and r.decision = 'voided')) then
      return jsonb_build_object('status', 'missing', 'met', false, 'level', null, 'evidence', '[]'::jsonb);
    end if;
    select * into aa from kafaa_adaptive_attempts a where a.person_id = p_person and a.bank_id = v_ref and a.status = 'completed' and a.counts is not false
        and not exists (select 1 from kafaa_integrity_reports r where r.attempt_id = a.id and r.decision = 'voided')
        and coalesce(a.estimate, 0) >= v_min and (a.mode <> 'criterion' or a.meets is true)
      order by coalesce(to_char(a.completed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'), '') collate "C" desc, a.id collate "C" desc limit 1;
    if aa.id is null then
      select coalesce(a.estimate, 0) into v_lvl from kafaa_adaptive_attempts a where a.person_id = p_person and a.bank_id = v_ref and a.status = 'completed' and a.counts is not false
          and not exists (select 1 from kafaa_integrity_reports r where r.attempt_id = a.id and r.decision = 'voided')
        order by coalesce(to_char(a.completed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'), '') collate "C" desc, a.id collate "C" desc limit 1;
      return jsonb_build_object('status', 'missing', 'met', false, 'level', v_lvl, 'evidence', '[]'::jsonb);
    end if;
    v_lvl := coalesce(aa.estimate, 0);
    return jsonb_build_object('status', 'met', 'met', true, 'level', v_lvl, 'evidence', jsonb_build_array(jsonb_build_object('table', 'adaptive_attempts', 'id', aa.id,
      'date', case when aa.completed_at is null then null else to_char(aa.completed_at at time zone 'UTC', 'YYYY-MM-DD') end, 'level', v_lvl)));
  elsif k = 'task' then
    select * into ta from kafaa_task_attempts a where a.person_id = p_person and a.task_id = v_ref and a.status = 'scored' and a.passed is true and a.counts is not false
        and not exists (select 1 from kafaa_integrity_reports r where r.attempt_id = a.id and r.decision = 'voided')
      order by coalesce(to_char(a.scored_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'), '') collate "C" desc, a.id collate "C" desc limit 1;
    if ta.id is null then return jsonb_build_object('status', 'missing', 'met', false, 'level', null, 'evidence', '[]'::jsonb); end if;
    return jsonb_build_object('status', 'met', 'met', true, 'level', null, 'evidence', jsonb_build_array(jsonb_build_object('table', 'task_attempts', 'id', ta.id,
      'date', case when ta.scored_at is null then null else to_char(ta.scored_at at time zone 'UTC', 'YYYY-MM-DD') end, 'level', null)));
  end if;
  return jsonb_build_object('status', 'manual', 'met', false, 'level', null, 'evidence', '[]'::jsonb);
end $$;

-- Eligibility of a person for a definition (TS eligibility). FS31: adaptive criteria carry a minimum level like skill criteria.
create or replace function kafaa_mc_eligibility(d kafaa_microcred_defs, p_person text, p_today date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_crit jsonb; v_comps jsonb := '[]'::jsonb; cd kafaa_microcred_defs; a kafaa_microcred_awards; s text; v_auto boolean; v_manual integer; v_n integer := 0;
begin
  select coalesce(jsonb_agg(jsonb_build_object('key', c ->> 'key', 'kind', c ->> 'kind', 'ref', c ->> 'ref',
      'min_level', case when c ->> 'kind' in ('skill', 'adaptive') then (case when jsonb_typeof(c -> 'min_level') = 'number' and (c ->> 'min_level')::numeric <> 0 then (c ->> 'min_level')::numeric::integer else 2 end) end,
      'label_en', coalesce(c ->> 'label_en', ''), 'label_ar', coalesce(c ->> 'label_ar', '')) || kafaa_mc_crit(c, p_person, p_today) order by o), '[]'::jsonb)
    into v_crit from jsonb_array_elements(coalesce(d.criteria, '[]'::jsonb)) with ordinality x(c, o);
  if d.kind = 'stack' then
    for cd in select * from kafaa_microcred_defs where status = 'current' and kind = 'micro' and stacks_into = d.code order by code collate "C" loop
      a := kafaa_mc_latest(p_person, cd.code);
      s := case when a.id is null then 'none' else kafaa_mc_view(a, p_today) ->> 'status' end;
      v_comps := v_comps || jsonb_build_array(jsonb_build_object('code', cd.code, 'def_id', cd.id, 'title_en', cd.title_en, 'title_ar', cd.title_ar, 'award_id', a.id,
        'status', s, 'met', s in ('active', 'renewal_due')));
      v_n := v_n + 1;
    end loop;
  end if;
  v_auto := not exists (select 1 from jsonb_array_elements(v_crit) e where e ->> 'kind' <> 'manual' and (e ->> 'met')::boolean is not true)
    and not exists (select 1 from jsonb_array_elements(v_comps) e where (e ->> 'met')::boolean is not true)
    and (d.kind <> 'stack' or v_n > 0);
  select count(*)::integer into v_manual from jsonb_array_elements(v_crit) e where e ->> 'kind' = 'manual';
  return jsonb_build_object('def_id', d.id, 'code', d.code, 'version', d.version, 'kind', d.kind, 'person_id', p_person, 'criteria', v_crit, 'components', v_comps,
    'auto_met', v_auto, 'manual', v_manual, 'eligible', v_auto and v_manual = 0);
end $$;

-- Copy check and shape validation of a definition draft (TS validateDef). FS31: + the future-skill areas, adaptive and task criteria.
create or replace function kafaa_mc_validate_def(p jsonb) returns text language plpgsql stable security definer set search_path = public as $$
declare c jsonb; a jsonb; v_kind text; v_ref text; v_keys text[] := '{}'; v_n integer; v_txt text; f kafaa_assessment_forms; bk kafaa_adaptive_banks; tk kafaa_performance_tasks;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return 'invalid'; end if;
  if jsonb_typeof(p -> 'code') is distinct from 'string' or (p ->> 'code') !~ '^MC-[A-Z0-9][A-Z0-9-]{1,30}$' then return 'invalid'; end if;
  if coalesce(p ->> 'kind', '') not in ('micro', 'stack') or coalesce(p ->> 'area', '') not in ('human_performance', 'digital', 'project', 'operations', 'leadership', 'quality', 'maintenance', 'safety',
       'ai_data', 'green_energy', 'advanced_reactor', 'cyber_hygiene', 'transversal')
     or coalesce(p ->> 'level', '') not in ('foundation', 'practitioner', 'advanced') then return 'invalid'; end if;
  if kafaa_w5_tlen(p -> 'title_en') not between 3 and 120 or kafaa_w5_tlen(p -> 'title_ar') not between 3 and 120
     or kafaa_w5_tlen(p -> 'summary_en') not between 10 and 600 or kafaa_w5_tlen(p -> 'summary_ar') not between 10 and 600 then return 'invalid'; end if;
  if not kafaa_w5_int(p -> 'validity_months', 6, 60) then return 'invalid'; end if;
  if p -> 'hours' is not null and jsonb_typeof(p -> 'hours') <> 'null' and not kafaa_w5_int(p -> 'hours', 1, 400) then return 'invalid'; end if;
  if jsonb_typeof(p -> 'criteria') is distinct from 'array' then return 'invalid'; end if;
  v_n := jsonb_array_length(p -> 'criteria');
  if v_n > 8 or (p ->> 'kind' = 'micro' and v_n < 1) then return 'invalid'; end if;
  for c in select x from jsonb_array_elements(p -> 'criteria') x loop
    if jsonb_typeof(c) <> 'object' or jsonb_typeof(c -> 'key') is distinct from 'string' or (c ->> 'key') !~ '^[a-z][a-z0-9_]{0,15}$' or (c ->> 'key') = any(v_keys) then return 'invalid'; end if;
    v_keys := v_keys || (c ->> 'key');
    if coalesce(c ->> 'kind', '') not in ('course', 'assessment', 'opportunity', 'skill', 'manual', 'adaptive', 'task') or jsonb_typeof(c -> 'ref') is distinct from 'string'
       or kafaa_w5_tlen(c -> 'label_en') not between 3 and 160 or kafaa_w5_tlen(c -> 'label_ar') not between 3 and 160 then return 'invalid'; end if;
    if c ->> 'kind' in ('skill', 'adaptive') and not kafaa_w5_int(c -> 'min_level', 1, 4) then return 'invalid'; end if;
  end loop;
  if jsonb_typeof(p -> 'alignment') is distinct from 'array' or jsonb_array_length(p -> 'alignment') > 6
     or (select count(distinct x ->> 'skill_id') from jsonb_array_elements(p -> 'alignment') x) <> jsonb_array_length(p -> 'alignment') then return 'invalid'; end if;
  for a in select x from jsonb_array_elements(p -> 'alignment') x loop
    if jsonb_typeof(a) <> 'object' or jsonb_typeof(a -> 'skill_id') is distinct from 'string' or not kafaa_w5_int(a -> 'level', 1, 2) then return 'invalid'; end if;
  end loop;
  if jsonb_typeof(p -> 'role_ids') is distinct from 'array' or jsonb_array_length(p -> 'role_ids') > 8
     or (select count(distinct x) from jsonb_array_elements(p -> 'role_ids') x) <> jsonb_array_length(p -> 'role_ids')
     or exists (select 1 from jsonb_array_elements(p -> 'role_ids') x where jsonb_typeof(x) <> 'string' or not exists (select 1 from kafaa_job_roles j where j.id = x #>> '{}')) then return 'invalid'; end if;
  if coalesce(p ->> 'stacks_into', '') <> '' then
    if p ->> 'kind' <> 'micro' or p ->> 'stacks_into' = p ->> 'code'
       or not exists (select 1 from kafaa_microcred_defs d where d.code = p ->> 'stacks_into' and d.kind = 'stack' and d.status <> 'retired') then return 'invalid'; end if;
  end if;
  -- copy check: never imply a FANR certificate, licence or qualification
  for v_txt in select unnest(array[p ->> 'title_en', p ->> 'title_ar', p ->> 'summary_en', p ->> 'summary_ar'])
               union all select x ->> 'label_en' from jsonb_array_elements(p -> 'criteria') x union all select x ->> 'label_ar' from jsonb_array_elements(p -> 'criteria') x loop
    if v_txt ~* '\y(fanr|licen[cs]e[ds]?|licensing|certified|certification|certificate of competence|qualified operator|authori[sz]ation|regulator[- ]approved)\y|الهيئة الاتحادية للرقابة النووية|رخصة|ترخيص|مرخص|شهادة الهيئة|معتمد من الهيئة' then
      return 'regulatory_wording'; end if;
  end loop;
  -- mirrors never become criteria
  for c in select x from jsonb_array_elements(p -> 'criteria') x loop
    v_ref := c ->> 'ref';
    if v_ref like 'qs-%' or v_ref like 'lic-%' or exists (select 1 from kafaa_qual_standards s where s.id = v_ref) then return 'mirror_only'; end if;
  end loop;
  for c in select x from jsonb_array_elements(p -> 'criteria') x loop
    v_kind := c ->> 'kind'; v_ref := c ->> 'ref';
    if v_kind = 'course' then
      if not exists (select 1 from kafaa_courses co where co.id = v_ref) then return 'invalid'; end if;
      if exists (select 1 from kafaa_courses co join kafaa_competencies k on k.id = any(co.competency_ids) where co.id = v_ref and k.domain = 'security') then return 'security_restricted'; end if;
    elsif v_kind = 'assessment' then
      select * into f from kafaa_assessment_forms where id = v_ref;
      if f.id is null then return 'invalid'; end if;
      if f.course_id is not null and exists (select 1 from kafaa_courses co join kafaa_competencies k on k.id = any(co.competency_ids) where co.id = f.course_id and k.domain = 'security') then return 'security_restricted'; end if;
    elsif v_kind = 'opportunity' then
      if (v_ref like 'kind:%' and substr(v_ref, 6) not in ('project', 'outage_support', 'shadowing', 'oe_review', 'knowledge_capture', 'outreach', 'research'))
         or (v_ref not like 'kind:%' and not exists (select 1 from kafaa_opportunities o where o.id = v_ref)) then return 'invalid'; end if;
    elsif v_kind = 'skill' then
      if not exists (select 1 from kafaa_skills s where s.id = v_ref) then return 'invalid'; end if;
      if exists (select 1 from kafaa_skills s left join kafaa_competencies k on k.id = s.competency_id where s.id = v_ref and (s.area = 'security' or k.domain = 'security')) then return 'security_restricted'; end if;
    elsif v_kind = 'adaptive' then
      bk := null;
      select * into bk from kafaa_adaptive_banks where id = v_ref and status = 'active';
      if bk.id is null then return 'invalid'; end if;
      if exists (select 1 from kafaa_skills s left join kafaa_competencies k on k.id = s.competency_id where s.id = any(bk.skill_ids) and (s.area = 'security' or k.domain = 'security')) then return 'security_restricted'; end if;
    elsif v_kind = 'task' then
      tk := null;
      select * into tk from kafaa_performance_tasks where id = v_ref and status = 'active';
      if tk.id is null then return 'invalid'; end if;
      if exists (select 1 from kafaa_skills s left join kafaa_competencies k on k.id = s.competency_id where s.id = any(tk.skill_ids) and (s.area = 'security' or k.domain = 'security')) then return 'security_restricted'; end if;
    elsif v_ref <> '' then return 'invalid';
    end if;
  end loop;
  for a in select x from jsonb_array_elements(p -> 'alignment') x loop
    if not exists (select 1 from kafaa_skills s where s.id = a ->> 'skill_id') then return 'invalid'; end if;
    if exists (select 1 from kafaa_skills s left join kafaa_competencies k on k.id = s.competency_id where s.id = a ->> 'skill_id' and (s.area = 'security' or k.domain = 'security')) then return 'security_restricted'; end if;
  end loop;
  return 'ok';
end $$;

-- @@PART3@@ ───────────── FS31 strategic tier, unlocks, report (mirror of futureCreds.ts)
-- My view of a code: the latest awarded row's effective status ('none' when never awarded) and its id.
create or replace function kafaa_fc_held(p_person text, p_code text, p_today date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare a kafaa_microcred_awards;
begin
  a := kafaa_mc_latest(p_person, p_code);
  if a.id is null then return jsonb_build_object('view', 'none', 'award_id', null, 'issued_on', null); end if;
  return jsonb_build_object('view', kafaa_mc_view(a, p_today) ->> 'status', 'award_id', a.id, 'issued_on', to_char(a.issued_on, 'YYYY-MM-DD'));
end $$;
-- Every active unlock with my state (TS unlocksFor).
create or replace function kafaa_fc_unlocks(p_person text, p_today date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare u kafaa_microcred_unlocks; d kafaa_microcred_defs; t_en text; t_ar text; t_st text; v_found boolean; h jsonb; v_view text; v_aid text; v_strat boolean; v_unl boolean;
  v_name jsonb; v_rs jsonb; v_out jsonb := '[]'::jsonb; v_ref jsonb;
begin
  for u in select * from kafaa_microcred_unlocks where active order by def_code collate "C", target_kind collate "C", target_id collate "C" loop
    d := null;
    select * into d from kafaa_microcred_defs where code = u.def_code and status = 'current' order by id collate "C" limit 1;
    v_found := false;
    if u.target_kind = 'opportunity' then
      select o.title_en, o.title_ar, o.status, true into t_en, t_ar, t_st, v_found from kafaa_opportunities o where o.id = u.target_id;
    else
      select r.title_en, r.title_ar, r.status, true into t_en, t_ar, t_st, v_found from kafaa_rotation_templates r where r.id = u.target_id;
    end if;
    if d.id is null or v_found is not true then continue; end if;
    v_strat := coalesce(d.strategic, false);
    h := kafaa_fc_held(p_person, u.def_code, p_today);
    v_view := h ->> 'view'; v_aid := h ->> 'award_id';
    v_unl := v_strat and v_view in ('active', 'renewal_due');
    v_name := jsonb_build_object('en', d.code || ' ' || d.title_en, 'ar', d.code || ' ' || d.title_ar);
    v_ref := case when v_aid is null then null else jsonb_build_object('table', 'microcred_awards', 'id', v_aid) end;
    v_rs := jsonb_build_array(case
      when not v_strat then jsonb_build_object('code', 'fc_tier_off', 'key', 'm17.reasons.fc_tier_off', 'vars', jsonb_build_object('code', v_name))
      when v_unl then jsonb_build_object('code', 'fc_unlocked', 'key', 'm17.reasons.fc_unlocked', 'vars', jsonb_build_object('code', v_name)) || coalesce(jsonb_build_object('ref', v_ref), '{}'::jsonb)
      when v_view in ('expired', 'revoked') then jsonb_build_object('code', 'fc_lapsed', 'key', 'm17.reasons.fc_lapsed', 'vars', jsonb_build_object('code', v_name)) || coalesce(jsonb_build_object('ref', v_ref), '{}'::jsonb)
      else jsonb_build_object('code', 'fc_locked', 'key', 'm17.reasons.fc_locked', 'vars', jsonb_build_object('code', v_name)) end)
      || jsonb_build_array(jsonb_build_object('code', 'fc_target_' || u.target_kind, 'key', 'm17.reasons.fc_target_' || u.target_kind,
        'vars', jsonb_build_object('title', jsonb_build_object('en', coalesce(t_en, ''), 'ar', coalesce(t_ar, ''))),
        'ref', jsonb_build_object('table', case when u.target_kind = 'opportunity' then 'opportunities' else 'rotation_templates' end, 'id', u.target_id)));
    v_out := v_out || jsonb_build_array(jsonb_build_object('id', u.id, 'def_code', u.def_code, 'def_title_en', d.title_en, 'def_title_ar', d.title_ar, 'target_kind', u.target_kind,
      'target_id', u.target_id, 'title_en', coalesce(t_en, ''), 'title_ar', coalesce(t_ar, ''), 'target_status', coalesce(t_st, ''), 'strategic', v_strat, 'held', v_view,
      'unlocked', v_unl, 'award_id', v_aid, 'reasons', v_rs));
  end loop;
  return v_out;
end $$;
-- Eligibility rule extension (the F08/F15 hand-off): does a target name a current strategic credential, and does the person hold one?
create or replace function kafaa_fc_target_check(p_person text, p_kind text, p_target text, p_today date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_codes text[]; v_held text[] := '{}'; c text;
begin
  select coalesce(array_agg(x.c order by x.c collate "C"), '{}'::text[]) into v_codes from (select distinct u.def_code c from kafaa_microcred_unlocks u
    where u.active and u.target_kind = p_kind and u.target_id = p_target
      and exists (select 1 from kafaa_microcred_defs d where d.code = u.def_code and d.status = 'current' and d.strategic)) x;
  foreach c in array v_codes loop
    if p_person is not null and kafaa_fc_held(p_person, c, p_today) ->> 'view' in ('active', 'renewal_due') then v_held := v_held || c; end if;
  end loop;
  return jsonb_build_object('named', cardinality(v_codes) > 0, 'unlocked', cardinality(v_held) > 0, 'codes', to_jsonb(v_codes), 'held', to_jsonb(v_held));
end $$;
-- Internal move dates of a person: completed or selected opportunities, started rotation placements (TS moveDates).
create or replace function kafaa_fc_moves(p_person text) returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(d order by d collate "C"), '{}'::text[]) from (
    select case when a.status = 'completed' then to_char(a.completed_at at time zone 'UTC', 'YYYY-MM-DD') when a.status = 'selected' then to_char(a.decided_at at time zone 'UTC', 'YYYY-MM-DD') end d
      from kafaa_opportunity_applications a where a.person_id = p_person
    union all
    select to_char(p.starts_on, 'YYYY-MM-DD') from kafaa_rotation_placements p where p.person_id = p_person and p.status in ('active', 'signed_off')
  ) x where d is not null
$$;
-- Strategic credentials against internal moves (TS strategicReport). Groups under 10 are null and flagged suppressed.
create or replace function kafaa_fc_report(p_today date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare d kafaa_microcred_defs; pid text; h jsonb; v_holders integer; v_moved integer; v_any text[] := '{}'; v_rows jsonb := '[]'::jsonb; v_from text := to_char(p_today - 365, 'YYYY-MM-DD');
  v_day text := to_char(p_today, 'YYYY-MM-DD'); v_base integer := 0; v_bmoved integer := 0; v_sup boolean;
begin
  for d in select * from kafaa_microcred_defs where status = 'current' and strategic order by code collate "C" loop
    v_holders := 0; v_moved := 0;
    for pid in select id from kafaa_people where kind = 'staff' and status = 'active' order by id collate "C" loop
      h := kafaa_fc_held(pid, d.code, p_today);
      if h ->> 'view' not in ('active', 'renewal_due') then continue; end if;
      v_holders := v_holders + 1;
      if not pid = any(v_any) then v_any := v_any || pid; end if;
      if exists (select 1 from unnest(kafaa_fc_moves(pid)) m where m collate "C" >= coalesce(h ->> 'issued_on', '') collate "C") then v_moved := v_moved + 1; end if;
    end loop;
    v_sup := v_holders < 10;
    v_rows := v_rows || jsonb_build_array(jsonb_build_object('code', d.code, 'title_en', d.title_en, 'title_ar', d.title_ar, 'holders', case when v_sup then null else v_holders end,
      'moved', case when v_sup then null else v_moved end, 'rate', case when v_sup then null else round(1000.0 * v_moved / v_holders) / 10 end, 'suppressed', v_sup));
  end loop;
  for pid in select id from kafaa_people where kind = 'staff' and status = 'active' and not (id = any(v_any)) loop
    v_base := v_base + 1;
    if exists (select 1 from unnest(kafaa_fc_moves(pid)) m where m collate "C" >= v_from collate "C" and m collate "C" <= v_day collate "C") then v_bmoved := v_bmoved + 1; end if;
  end loop;
  v_sup := v_base < 10;
  return jsonb_build_object('rows', v_rows, 'baseline', jsonb_build_object('people', case when v_sup then null else v_base end, 'moved', case when v_sup then null else v_bmoved end,
    'rate', case when v_sup or v_base = 0 then (case when v_sup then null else 0 end) else round(1000.0 * v_bmoved / v_base) / 10 end, 'suppressed', v_sup), 'window_days', 365);
end $$;
-- Unlock input check (TS unlockProblem): kind, a current definition, an existing target, notes, never a security placement, at most 8.
create or replace function kafaa_fc_unlock_problem(p jsonb) returns text language plpgsql stable security definer set search_path = public as $$
declare v_kind text := p ->> 'target_kind'; v_code text := p ->> 'def_code'; v_tgt text := p ->> 'target_id'; v_fams text[]; v_skills text[]; v_found boolean := false; v_id text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return 'invalid'; end if;
  if coalesce(v_kind, '') not in ('opportunity', 'rotation') or jsonb_typeof(p -> 'def_code') is distinct from 'string' or jsonb_typeof(p -> 'target_id') is distinct from 'string' then return 'invalid'; end if;
  if not exists (select 1 from kafaa_microcred_defs d where d.code = v_code and d.status = 'current') then return 'invalid'; end if;
  if v_kind = 'opportunity' then select o.skills_gained, true into v_skills, v_found from kafaa_opportunities o where o.id = v_tgt;
  else select r.eligible_families, true into v_fams, v_found from kafaa_rotation_templates r where r.id = v_tgt; end if;
  if v_found is not true then return 'invalid'; end if;
  if kafaa_w5_tlen(p -> 'note_en') not between 3 and 300 or kafaa_w5_tlen(p -> 'note_ar') not between 3 and 300 then return 'invalid'; end if;
  if coalesce(v_fams, '{}'::text[]) && array['security', 'cyber', 'safeguards'] or exists (select 1 from unnest(coalesce(v_skills, '{}'::text[])) s where s like 'sk-sa-%') then return 'security_restricted'; end if;
  v_id := coalesce(nullif(p ->> 'id', ''), 'mcu:' || v_code || ':' || v_kind || ':' || v_tgt);
  if (p -> 'active') is distinct from 'false'::jsonb and (select count(*) from kafaa_microcred_unlocks u where u.active and u.def_code = v_code and u.id <> v_id) >= 8 then return 'too_many'; end if;
  return 'ok';
end $$;

-- RPC: framework owners put a published credential in (or out of) the strategic tier. Audited; ledger.
create or replace function kafaa_set_microcred_strategic(p_code text, p_strategic boolean, p_note text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_code text := btrim(coalesce(p_code, ''), E' \t\n\r'); d kafaa_microcred_defs; v_note text := btrim(coalesce(p_note, ''), E' \t\n\r');
  v_want boolean := coalesce(p_strategic, false) is true; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('microcred.strategic', 'microcred_defs', nullif(v_code, ''), 'not_signed_in', 'Sign in to manage micro-credentials'); end if;
  v_role := kafaa_acting_role('frameworks', array['W', 'A']);
  if v_role is null then return kafaa_refuse('microcred.strategic', 'microcred_defs', nullif(v_code, ''), 'forbidden', 'Only framework owners (training managers and admins) can manage the strategic tier'); end if;
  select * into d from kafaa_microcred_defs where code = v_code and status = 'current' order by id collate "C" limit 1;
  if d.id is null then return kafaa_refuse('microcred.strategic', 'microcred_defs', nullif(v_code, ''), 'not_found', 'Micro-credential not found or not published', v_role); end if;
  if length(v_note) < 3 or length(v_note) > 300 then return kafaa_refuse('microcred.strategic', 'microcred_defs', v_code, 'invalid', 'Add a short reason (3 to 300 characters)', v_role); end if;
  if coalesce(d.strategic, false) = v_want then return kafaa_refuse('microcred.strategic', 'microcred_defs', v_code, 'no_change', 'Nothing changes: the micro-credential is already in that tier', v_role); end if;
  update kafaa_microcred_defs set strategic = v_want, strategic_note = v_note, strategic_since = case when v_want then current_date end, updated_by = me, updated_at = now() where id = d.id;
  l := kafaa_ledger('kafaa.microcred.strategic', format('Micro-credential %s %s the strategic tier', v_code, case when v_want then 'joins' else 'leaves' end));
  a := kafaa_audit('microcred.strategic', 'microcred_defs', d.id, 'ok', v_code || ' ' || case when v_want then 'strategic' else 'standard' end || ': ' || v_note,
    case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Strategic tier updated', a, l, jsonb_build_object('code', v_code, 'strategic', v_want));
end $$;
-- RPC: framework owners name a credential on a gig or rotation (or switch it off). Audited.
create or replace function kafaa_set_credential_unlock(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_code text := btrim(coalesce(p ->> 'def_code', ''), E' \t\n\r'); v_chk text; v_id text; v_active boolean; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('microcred.unlock', 'microcred_unlocks', nullif(v_code, ''), 'not_signed_in', 'Sign in to manage micro-credentials'); end if;
  v_role := kafaa_acting_role('frameworks', array['W', 'A']);
  if v_role is null then return kafaa_refuse('microcred.unlock', 'microcred_unlocks', nullif(v_code, ''), 'forbidden', 'Only framework owners (training managers and admins) can manage the strategic tier'); end if;
  v_chk := kafaa_fc_unlock_problem(p);
  if v_chk <> 'ok' then
    return kafaa_refuse('microcred.unlock', 'microcred_unlocks', nullif(v_code, ''), v_chk, case v_chk when 'security_restricted' then 'Security placements are career-path only and cannot be unlocked by a credential'
      when 'too_many' then 'A micro-credential can name at most 8 gigs and rotations' else 'Choose a published micro-credential and an existing gig or rotation' end, v_role);
  end if;
  v_id := 'mcu:' || v_code || ':' || (p ->> 'target_kind') || ':' || (p ->> 'target_id');
  v_active := (p -> 'active') is distinct from 'false'::jsonb;
  insert into kafaa_microcred_unlocks (id, def_code, target_kind, target_id, note_en, note_ar, active, set_by, set_at)
  values (v_id, v_code, p ->> 'target_kind', p ->> 'target_id', btrim(p ->> 'note_en', E' \t\n\r'), btrim(p ->> 'note_ar', E' \t\n\r'), v_active, me, now())
  on conflict (id) do update set note_en = excluded.note_en, note_ar = excluded.note_ar, active = excluded.active, set_by = excluded.set_by, set_at = excluded.set_at;
  a := kafaa_audit('microcred.unlock', 'microcred_unlocks', v_id, 'ok', v_code || ' -> ' || (p ->> 'target_kind') || ' ' || (p ->> 'target_id') || ' ' || case when v_active then 'on' else 'off' end, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Unlock saved', a, null, jsonb_build_object('id', v_id, 'active', v_active));
end $$;
-- Read: the unlocks with a person's state (yourself, a person in your scope, or anyone with skills_profile A).
create or replace function kafaa_credential_unlocks(p_person text default null) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); v_pid text; v_ok boolean;
begin
  if me is null then return jsonb_build_object('allowed', false, 'person_id', null, 'items', '[]'::jsonb); end if;
  v_pid := coalesce(nullif(p_person, ''), me);
  v_ok := case when v_pid = me then kafaa_has_grant('skills_profile', array['Own', 'Scope', 'A'])
    else kafaa_has_grant('skills_profile', array['A']) or (kafaa_has_grant('skills_profile', array['Scope']) and kafaa_in_scope('skills_profile', v_pid)) end;
  if not v_ok or not exists (select 1 from kafaa_people where id = v_pid) then return jsonb_build_object('allowed', false, 'person_id', null, 'items', '[]'::jsonb); end if;
  return jsonb_build_object('allowed', true, 'person_id', v_pid, 'items', kafaa_fc_unlocks(v_pid, current_date));
end $$;
-- Read: does a gig or rotation name a strategic credential, and do I hold one of them? (the F08/F15 hand-off)
create or replace function kafaa_credential_target_check(p_kind text, p_target text) returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  return kafaa_fc_target_check(kafaa_me(), p_kind, coalesce(p_target, ''), current_date);
end $$;
-- Read: the strategic-tier report (training manager A, HR aggregates, auditors).
create or replace function kafaa_strategic_report() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not (kafaa_has_grant('skills_profile', array['A', 'Agg']) or kafaa_has_grant('audit_log', array['R'])) then
    return jsonb_build_object('allowed', false, 'rows', '[]'::jsonb, 'baseline', jsonb_build_object('people', null, 'moved', null, 'rate', null, 'suppressed', true), 'window_days', 365);
  end if;
  return jsonb_build_object('allowed', true) || kafaa_fc_report(current_date);
end $$;

-- @@PART4@@ ───────────── FS32 learner record (mirror of learnerRecord.ts)
-- Shareable items of a person today, in record order (TS recordItems).
create or replace function kafaa_lr_items(p_person text, p_today date) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('ref', x.ref, 'kind', x.kind, 'id', x.id, 'code', x.code, 'title_en', x.t_en, 'title_ar', x.t_ar, 'status', x.st, 'level', x.lvl, 'band', x.band, 'date', x.dt)
    order by x.o, x.ref collate "C"), '[]'::jsonb)
  from (
    select 1 o, 'mc:' || a.id ref, 'mc' kind, a.id, a.def_code code, coalesce(d.title_en, a.def_code) t_en, coalesce(d.title_ar, a.def_code) t_ar,
      kafaa_mc_view(a, p_today) ->> 'status' st, null::integer lvl, null::text band, to_char(a.issued_on, 'YYYY-MM-DD') dt
    from kafaa_microcred_awards a left join kafaa_microcred_defs d on d.id = a.def_id
    where a.person_id = p_person and a.status = 'awarded' and kafaa_mc_view(a, p_today) ->> 'status' in ('active', 'renewal_due')
    union all
    select 2, 'badge:' || b.id, 'badge', b.id, coalesce(b.achievement ->> 'code', ''), coalesce(b.achievement ->> 'name_en', ''), coalesce(b.achievement ->> 'name_ar', ''), 'active', null, null, to_char(b.issued_on, 'YYYY-MM-DD')
    from kafaa_badges b
    where b.person_id = p_person and b.status <> 'revoked' and (b.valid_to is null or b.valid_to >= p_today)
      and not exists (select 1 from kafaa_certificates c where b.source_table = 'certificates' and c.id = b.source_id
        and (c.status in ('revoked', 'expired') or (c.valid_to is not null and c.valid_to < p_today)))
    union all
    select 3, 'qual:' || r.id, 'qual', r.id, coalesce(s.code, ''), s.title_en, s.title_ar,
      case when r.status in ('qualified', 'due') and (r.expires_on is null or r.expires_on >= p_today) then 'qualified' else 'not_qualified' end, null, null, null
    from kafaa_qual_records r join kafaa_qual_standards s on s.id = r.standard_id
    where r.person_id = p_person and not coalesce(s.security_restricted, false) and not coalesce(r.security_mirror_only, false)
    union all
    select 4, 'skill:' || k.id, 'skill', k.id, coalesce(k.code, ''), k.name_en, k.name_ar, ps.basis, ps.level, ps.confidence_band, null
    from kafaa_person_skills ps join kafaa_skills k on k.id = ps.skill_id left join kafaa_competencies c on c.id = k.competency_id
    where ps.person_id = p_person and ps.active is true and ps.level >= 1 and k.area <> 'security' and coalesce(c.domain, '') <> 'security'
  ) x
$$;
-- The CLR 2.0-shaped ClrCredential for the chosen references (TS buildBundle).
create or replace function kafaa_lr_bundle(p_person text, p_refs text[], p_today date, p_id text, p_valid date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_items jsonb; v_init text; it jsonb; v_vcs jsonb := '[]'::jsonb; v_assoc jsonb := '[]'::jsonb; a kafaa_microcred_awards; c kafaa_microcred_awards; cid text; v_shared text[];
  v_issuer jsonb := jsonb_build_object('id', 'urn:kafaa:issuer:demo-tenant', 'type', jsonb_build_array('Profile'), 'name', 'Kafa''a demo tenant', 'url', '/kafaa/.well-known/kafaa-issuer.json');
  v_day text := to_char(p_today, 'YYYY-MM-DD'); v_qual boolean; v jsonb; v_subj jsonb;
begin
  select coalesce(nullif(initials, ''), '—') into v_init from kafaa_people where id = p_person;
  v_init := coalesce(v_init, '—');
  select coalesce(jsonb_agg(e order by o), '[]'::jsonb) into v_items from jsonb_array_elements(kafaa_lr_items(p_person, p_today)) with ordinality x(e, o) where e ->> 'ref' = any(coalesce(p_refs, '{}'::text[]));
  for it in select e from jsonb_array_elements(v_items) e loop
    if it ->> 'kind' = 'mc' then
      v_vcs := v_vcs || jsonb_build_array(coalesce((select x.credential from kafaa_microcred_awards x where x.id = it ->> 'id'), '{}'::jsonb));
    elsif it ->> 'kind' = 'badge' then
      v_vcs := v_vcs || jsonb_build_array(coalesce((select x.credential from kafaa_badges x where x.id = it ->> 'id'), '{}'::jsonb));
    else
      v_qual := it ->> 'kind' = 'qual';
      v_subj := jsonb_build_object('type', jsonb_build_array('AchievementSubject'), 'holderInitials', v_init,
        'achievement', jsonb_build_object(
          'id', case when v_qual then 'urn:kafaa:qualification-mirror:' || (it ->> 'code') else 'urn:kafaa:skill:' || (it ->> 'id') end,
          'type', jsonb_build_array('Achievement'),
          'achievementType', case when v_qual then 'ext:QualificationMirror' else 'Competency' end,
          'humanCode', it ->> 'code', 'name', it ->> 'title_en', 'nameAr', it ->> 'title_ar',
          'criteria', jsonb_build_object('narrative', case when v_qual then 'Mirrored from the licensee''s system of record as qualified or not qualified only; Kafa''a is not an authority.'
            else 'Skill state in the Kafa''a skills catalogue: level ' || (it ->> 'level') || ' of 4, ' || (it ->> 'status') || ' (provenance).' end)));
      v_subj := v_subj || case when v_qual then jsonb_build_object('kafaaStatus', it ->> 'status')
        else jsonb_build_object('kafaaLevel', it -> 'level', 'kafaaProvenance', it ->> 'status', 'kafaaConfidenceBand', it -> 'band') end;
      v_vcs := v_vcs || jsonb_build_array(jsonb_build_object(
        '@context', jsonb_build_array('https://www.w3.org/ns/credentials/v2', 'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json'),
        'id', 'urn:kafaa:clr:' || p_id || ':' || (it ->> 'kind') || ':' || (it ->> 'id'),
        'type', jsonb_build_array('VerifiableCredential', 'AchievementCredential'),
        'name', it ->> 'title_en',
        'issuer', v_issuer,
        'validFrom', v_day || 'T00:00:00Z',
        'credentialSubject', v_subj));
    end if;
  end loop;
  select coalesce(array_agg(e ->> 'id'), '{}'::text[]) into v_shared from jsonb_array_elements(v_items) e where e ->> 'kind' = 'mc';
  for it in select e from jsonb_array_elements(v_items) e where e ->> 'kind' = 'mc' loop
    select * into a from kafaa_microcred_awards where id = it ->> 'id';
    for cid in select x from unnest(coalesce(a.component_award_ids, '{}'::text[])) x order by x collate "C" loop
      if not cid = any(v_shared) then continue; end if;
      select * into c from kafaa_microcred_awards where id = cid;
      v_assoc := v_assoc || jsonb_build_array(jsonb_build_object('type', 'Association', 'associationType', 'isParentOf', 'sourceId', 'urn:kafaa:badge:' || a.public_slug, 'targetId', 'urn:kafaa:badge:' || c.public_slug));
    end loop;
  end loop;
  v := jsonb_build_object(
    '@context', jsonb_build_array('https://www.w3.org/ns/credentials/v2', 'https://purl.imsglobal.org/spec/clr/v2p0/context-2.0.1.json', 'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json'),
    'id', 'urn:kafaa:clr:' || p_id,
    'type', jsonb_build_array('VerifiableCredential', 'ClrCredential'),
    'name', 'Kafa''a learner record',
    'nameAr', 'سجل المتعلم من كفاءة',
    'issuer', v_issuer,
    'validFrom', v_day || 'T00:00:00Z',
    'credentialSubject', jsonb_build_object('type', jsonb_build_array('ClrSubject'), 'holderInitials', v_init, 'verifiableCredential', v_vcs)
      || case when jsonb_array_length(v_assoc) > 0 then jsonb_build_object('association', v_assoc) else '{}'::jsonb end,
    'kafaaItems', coalesce((select jsonb_agg(e - 'id' order by o) from jsonb_array_elements(v_items) with ordinality x(e, o)), '[]'::jsonb),
    'kafaaNotice', 'Kafa''a learner record (internal recognition). Qualification lines mirror the licensee''s systems as qualified or not qualified only; Kafa''a is not an authority and nothing here is a FANR certificate or licence.');
  if p_valid is not null then v := v || jsonb_build_object('validUntil', to_char(p_valid, 'YYYY-MM-DD') || 'T00:00:00Z'); end if;
  return v;
end $$;
-- Share input check (TS shareProblem): items, label, expiry, the three consents, then every item shareable for the person today.
create or replace function kafaa_lr_share_problem(p jsonb, p_person text, p_today date) returns text language plpgsql stable security definer set search_path = public as $$
declare v_n integer; v_days integer; v_ok text[];
begin
  if p is null or jsonb_typeof(p) <> 'object' or jsonb_typeof(p -> 'items') is distinct from 'array' then return 'invalid'; end if;
  v_n := jsonb_array_length(p -> 'items');
  if v_n < 1 or v_n > 30 or exists (select 1 from jsonb_array_elements(p -> 'items') x where jsonb_typeof(x) <> 'string')
     or (select count(distinct x) from jsonb_array_elements(p -> 'items') x) <> v_n then return 'invalid'; end if;
  if kafaa_w5_tlen(p -> 'label') not between 3 and 80 then return 'invalid'; end if;
  if jsonb_typeof(p -> 'expires_on') is distinct from 'string' or not kafaa_w5_is_date(p ->> 'expires_on') then return 'invalid'; end if;
  v_days := (p ->> 'expires_on')::date - p_today;
  if v_days < 1 or v_days > 90 then return 'invalid'; end if;
  if (p #> '{consents,items}') is distinct from 'true'::jsonb or (p #> '{consents,preview}') is distinct from 'true'::jsonb or (p #> '{consents,share}') is distinct from 'true'::jsonb then return 'consent_required'; end if;
  select coalesce(array_agg(e ->> 'ref'), '{}'::text[]) into v_ok from jsonb_array_elements(kafaa_lr_items(p_person, p_today)) e;
  if exists (select 1 from jsonb_array_elements_text(p -> 'items') r where not r = any(v_ok)) then return 'not_shareable'; end if;
  return 'ok';
end $$;
-- Read: my shareable items and the bundle for a selection (all items when p_refs is null).
create or replace function kafaa_learner_record(p_refs text[] default null) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); v_items jsonb; v_refs text[];
begin
  if me is null or not kafaa_has_grant('skills_profile', array['Own']) then return jsonb_build_object('allowed', false, 'items', '[]'::jsonb, 'bundle', null); end if;
  v_items := kafaa_lr_items(me, current_date);
  v_refs := coalesce(p_refs, (select coalesce(array_agg(e ->> 'ref'), '{}'::text[]) from jsonb_array_elements(v_items) e));
  return jsonb_build_object('allowed', true, 'items', v_items, 'bundle', kafaa_lr_bundle(me, v_refs, current_date, 'preview:' || me, null));
end $$;
-- RPC: create a share link after the three consent gates. Audited; ledger.
create or replace function kafaa_create_record_share(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_chk text; v_id text; v_token text; v_init text; v_n integer; v_exp text; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('record.share', 'record_shares', null, 'not_signed_in', 'Sign in to share your learner record'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  if v_role is null then return kafaa_refuse('record.share', 'record_shares', null, 'forbidden', 'Only staff with a skills passport can share a learner record'); end if;
  v_chk := kafaa_lr_share_problem(p, me, current_date);
  if v_chk <> 'ok' then
    return kafaa_refuse('record.share', 'record_shares', null, v_chk, case v_chk when 'consent_required' then 'Confirm all three consent steps before the link is created'
      when 'not_shareable' then 'Some items are not yours or cannot be shared (security and medical details never are)'
      else 'Choose 1 to 30 items, a label of 3 to 80 characters and an expiry between 1 and 90 days from today' end, v_role);
  end if;
  if (select count(*) from kafaa_record_shares s where s.person_id = me and s.revoked_at is null and s.expires_on >= current_date) >= 10 then
    return kafaa_refuse('record.share', 'record_shares', null, 'too_many', 'You can keep up to 10 active share links: revoke one first', v_role);
  end if;
  v_id := 'rs-' || kafaa_w5_hex(16);
  v_token := kafaa_w5_hex(32);
  select coalesce(nullif(initials, ''), '—') into v_init from kafaa_people where id = me;
  v_n := jsonb_array_length(p -> 'items');
  v_exp := p ->> 'expires_on';
  insert into kafaa_record_shares (id, person_id, token, label, items, holder_initials, consents, expires_on, created_at)
  values (v_id, me, v_token, btrim(p ->> 'label', E' \t\n\r'), array(select jsonb_array_elements_text(p -> 'items')), coalesce(v_init, '—'),
    jsonb_build_object('items', true, 'preview', true, 'share', true, 'at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')), v_exp::date, now());
  l := kafaa_ledger('kafaa.record.share', format('Learner record share %s (%s items, until %s)', v_id, v_n, v_exp));
  a := kafaa_audit('record.share', 'record_shares', v_id, 'ok', v_n || ' items until ' || v_exp, case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Share link created', a, l, jsonb_build_object('id', v_id, 'token', v_token, 'expires_on', v_exp));
end $$;
-- RPC: revoke one of my share links. Audited; ledger.
create or replace function kafaa_revoke_record_share(p_id text, p_reason text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; s kafaa_record_shares; v_why text := left(btrim(coalesce(p_reason, ''), E' \t\n\r'), 300); a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('record.revoke', 'record_shares', nullif(p_id, ''), 'not_signed_in', 'Sign in to share your learner record'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  select * into s from kafaa_record_shares where id = p_id;
  if v_role is null or s.id is null or s.person_id <> me then return kafaa_refuse('record.revoke', 'record_shares', nullif(p_id, ''), 'not_found', 'Share link not found', v_role); end if;
  if s.revoked_at is not null or s.expires_on < current_date then return kafaa_refuse('record.revoke', 'record_shares', p_id, 'already_closed', 'This link is already revoked or expired', v_role); end if;
  update kafaa_record_shares set revoked_at = now(), revoke_reason = nullif(v_why, '') where id = p_id;
  l := kafaa_ledger('kafaa.record.revoke', format('Learner record share %s revoked', p_id));
  a := kafaa_audit('record.revoke', 'record_shares', p_id, 'ok', coalesce(nullif(v_why, ''), 'revoked by the holder'), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Share link revoked', a, l, jsonb_build_object('id', p_id));
end $$;
-- Public verification by token (anyone; rate-limited; audited). Active: the shared items only, initials only; otherwise nothing personal.
create or replace function kafaa_verify_record_share(p_token text) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_tok text := left(btrim(coalesce(p_token, '')), 64); s kafaa_record_shares; v_status text; v_clr jsonb; a kafaa_audit_events; v_day text := to_char(current_date, 'YYYY-MM-DD');
begin
  if v_tok <> '' then select * into s from kafaa_record_shares where token = v_tok; end if;
  if (s.id is not null and (select count(*) from kafaa_audit_events e where e.action = 'record.verify' and e.ts > now() - interval '1 minute' and e.entity_id = s.id) >= 20)
     or (select count(*) from kafaa_audit_events e where e.action = 'record.verify' and e.ts > now() - interval '1 minute') >= 600 then
    return kafaa_refuse('record.verify', 'record_shares', s.id, 'rate_limited', 'Too many verification requests: try again in a minute');
  end if;
  if s.id is null then return kafaa_refuse('record.verify', 'record_shares', null, 'not_found', 'No Kafa''a learner record has this link'); end if;
  v_status := case when s.revoked_at is not null then 'revoked' when s.expires_on < current_date then 'expired' else 'active' end;
  if v_status <> 'active' then
    a := kafaa_audit('record.verify', 'record_shares', s.id, 'ok', v_status, 'not_applicable', null, null);
    return kafaa_result(true, 'ok', 'This link is no longer active', a, null, jsonb_build_object('found', true, 'status', v_status, 'checked_on', v_day, 'notice', 'This link is no longer active'));
  end if;
  update kafaa_record_shares set views = views + 1, last_viewed_at = now() where id = s.id;
  v_clr := kafaa_lr_bundle(s.person_id, s.items, current_date, s.id, s.expires_on);
  a := kafaa_audit('record.verify', 'record_shares', s.id, 'ok', v_status, 'not_applicable', null, null);
  return kafaa_result(true, 'ok', 'Learner record found', a, null, jsonb_build_object('found', true, 'status', v_status, 'checked_on', v_day, 'expires_on', to_char(s.expires_on, 'YYYY-MM-DD'),
    'holder_initials', v_clr #>> '{credentialSubject,holderInitials}', 'item_count', jsonb_array_length(v_clr -> 'kafaaItems'), 'clr', v_clr, 'notice', 'Learner record found'));
end $$;

-- @@PART5@@ ───────────── FS33 skill goals (mirror of skillGoals.ts)
-- Input check after the skill lookup (TS goalProblem).
create or replace function kafaa_sg_problem(p jsonb, sk kafaa_skills, p_today date) returns text language plpgsql stable security definer set search_path = public as $$
declare v_days integer;
begin
  if sk.id is null then return 'not_found'; end if;
  if sk.area = 'security' or exists (select 1 from kafaa_competencies k where k.id = sk.competency_id and k.domain = 'security') then return 'restricted'; end if;
  if sk.lifecycle = 'obsolete' then return 'obsolete'; end if;
  if not kafaa_w5_int(p -> 'target_level', 1, 4) then return 'invalid'; end if;
  if jsonb_typeof(p -> 'target_date') is distinct from 'string' or not kafaa_w5_is_date(p ->> 'target_date') then return 'invalid'; end if;
  v_days := (p ->> 'target_date')::date - p_today;
  if v_days < 14 or v_days > 1096 then return 'invalid'; end if;
  if p -> 'note' is not null and jsonb_typeof(p -> 'note') <> 'null' and (jsonb_typeof(p -> 'note') <> 'string' or kafaa_w5_tlen(p -> 'note') > 300) then return 'invalid'; end if;
  return 'ok';
end $$;
-- RPC: set or change a goal (FS07's goal row + FS33's plan). Own; audited.
create or replace function kafaa_save_skill_goal(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_sid text := btrim(coalesce(p ->> 'skill_id', ''), E' \t\r\n'); sk kafaa_skills; v_chk text; v_gid text; v_lvl integer; v_date date;
  v_note text; v_shared boolean; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('skill_goal.save', 'skill_goal_plans', nullif(v_sid, ''), 'not_signed_in', 'Sign in to keep skill goals'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  if v_role is null then return kafaa_refuse('skill_goal.save', 'skill_goal_plans', nullif(v_sid, ''), 'forbidden', 'Skill goals are for staff with a skills passport'); end if;
  select * into sk from kafaa_skills where id = v_sid;
  v_chk := kafaa_sg_problem(p, sk, current_date);
  if v_chk <> 'ok' then
    return kafaa_refuse('skill_goal.save', 'skill_goal_plans', nullif(v_sid, ''), v_chk, case v_chk when 'not_found' then 'Skill not found'
      when 'restricted' then 'Security skills are not personal goals: they follow the security career path' when 'obsolete' then 'This skill is obsolete: choose its replacement instead'
      else 'Choose a level from 1 to 4 and a target date between two weeks and three years from today (note up to 300 characters)' end, v_role);
  end if;
  v_gid := 'sg:' || me || ':' || v_sid;
  if (select count(*) from kafaa_skill_goals g where g.person_id = me and g.status = 'active' and g.id <> v_gid) >= 12 then
    return kafaa_refuse('skill_goal.save', 'skill_goal_plans', v_sid, 'limit', 'You can keep up to 12 active skill goals: withdraw one first', v_role);
  end if;
  v_lvl := (p ->> 'target_level')::numeric::integer;
  v_date := (p ->> 'target_date')::date;
  v_note := nullif(btrim(coalesce(p ->> 'note', ''), E' \t\r\n'), '');
  v_shared := (p -> 'shared') = 'true'::jsonb;
  insert into kafaa_skill_goals (id, person_id, skill_id, target_level, status, source, created_at, updated_at) values (v_gid, me, v_sid, v_lvl, 'active', 'fs33', now(), now())
  on conflict (id) do update set target_level = excluded.target_level, status = 'active', updated_at = now();
  insert into kafaa_skill_goal_plans (id, person_id, skill_id, target_level, target_date, note, shared, share_person, status, open_read, created_at, updated_at, removed_at)
  values (v_gid, me, v_sid, v_lvl, v_date, v_note, v_shared, case when v_shared then me end, 'active', false, now(), now(), null)
  on conflict (id) do update set target_level = excluded.target_level, target_date = excluded.target_date, note = excluded.note, shared = excluded.shared,
    share_person = excluded.share_person, status = 'active', updated_at = now(), removed_at = null;
  a := kafaa_audit('skill_goal.save', 'skill_goal_plans', v_gid, 'ok', 'active ' || v_sid || ' L' || v_lvl || ' by ' || to_char(v_date, 'YYYY-MM-DD') || case when v_shared then ' shared' else '' end,
    'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Goal saved', a, null, jsonb_build_object('id', v_gid, 'status', 'active', 'shared', v_shared));
end $$;
-- RPC: withdraw a goal at any time (unshared; the Coach stops weighing it). Own; audited.
create or replace function kafaa_withdraw_skill_goal(p_skill text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_sid text := btrim(coalesce(p_skill, ''), E' \t\r\n'); v_gid text; g kafaa_skill_goals; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('skill_goal.withdraw', 'skill_goal_plans', nullif(v_sid, ''), 'not_signed_in', 'Sign in to keep skill goals'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  if v_role is null then return kafaa_refuse('skill_goal.withdraw', 'skill_goal_plans', nullif(v_sid, ''), 'forbidden', 'Skill goals are for staff with a skills passport'); end if;
  v_gid := 'sg:' || me || ':' || v_sid;
  select * into g from kafaa_skill_goals where id = v_gid;
  if g.id is null or g.status <> 'active' then return kafaa_refuse('skill_goal.withdraw', 'skill_goal_plans', nullif(v_sid, ''), 'no_goal', 'This skill is not on your goals', v_role); end if;
  update kafaa_skill_goals set status = 'removed', updated_at = now() where id = v_gid;
  update kafaa_skill_goal_plans set status = 'removed', shared = false, share_person = null, updated_at = now(), removed_at = now() where id = v_gid;
  a := kafaa_audit('skill_goal.withdraw', 'skill_goal_plans', v_gid, 'ok', 'removed ' || v_sid, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Goal withdrawn: it is no longer shared and the Coach stops weighing it', a, null, jsonb_build_object('id', v_gid));
end $$;
-- RPC: share an active goal with my manager, or make it private again. Own; audited.
create or replace function kafaa_share_skill_goal(p_skill text, p_shared boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_sid text := btrim(coalesce(p_skill, ''), E' \t\r\n'); v_gid text; g kafaa_skill_goals; pl kafaa_skill_goal_plans; v_want boolean := p_shared is true;
  a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('skill_goal.share', 'skill_goal_plans', nullif(v_sid, ''), 'not_signed_in', 'Sign in to keep skill goals'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  if v_role is null then return kafaa_refuse('skill_goal.share', 'skill_goal_plans', nullif(v_sid, ''), 'forbidden', 'Skill goals are for staff with a skills passport'); end if;
  v_gid := 'sg:' || me || ':' || v_sid;
  select * into g from kafaa_skill_goals where id = v_gid;
  if g.id is null or g.status <> 'active' then return kafaa_refuse('skill_goal.share', 'skill_goal_plans', nullif(v_sid, ''), 'no_goal', 'This skill is not on your goals', v_role); end if;
  select * into pl from kafaa_skill_goal_plans where id = v_gid;
  if pl.id is null or pl.status <> 'active' then return kafaa_refuse('skill_goal.share', 'skill_goal_plans', v_sid, 'no_plan', 'Add a target date to this goal before sharing it', v_role); end if;
  if coalesce(pl.shared, false) = v_want then return kafaa_refuse('skill_goal.share', 'skill_goal_plans', v_sid, 'no_change', 'Nothing changes', v_role); end if;
  update kafaa_skill_goal_plans set shared = v_want, share_person = case when v_want then me end, updated_at = now() where id = v_gid;
  a := kafaa_audit('skill_goal.share', 'skill_goal_plans', v_gid, 'ok', case when v_want then 'shared ' else 'private ' end || v_sid, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when v_want then 'Goal shared with your manager' else 'Goal is private again' end, a, null, jsonb_build_object('id', v_gid, 'shared', v_want));
end $$;
-- FS07's kafaa_set_skill_goal can remove a goal from a skill page: keep the plan in step (unshare it) so no stale share remains.
create or replace function kafaa_sg_sync_plan() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'removed' and old.status is distinct from 'removed' then
    update kafaa_skill_goal_plans set status = 'removed', shared = false, share_person = null, updated_at = now(), removed_at = coalesce(removed_at, now()) where id = new.id and status = 'active';
  elsif new.status = 'active' and new.target_level is distinct from old.target_level then
    update kafaa_skill_goal_plans set target_level = new.target_level, updated_at = now() where id = new.id;
  end if;
  return new;
end $$;
do $$ begin if not exists (select 1 from pg_trigger where tgname = 'kafaa_sg_sync_plan_trg') then
  create trigger kafaa_sg_sync_plan_trg after update on kafaa_skill_goals for each row execute function kafaa_sg_sync_plan(); end if; end $$;

-- @@PART6@@ ───────────── Grants: helpers by nobody; RPCs by signed-in users; verification also by anon
revoke execute on function kafaa_fc_held(text, text, date), kafaa_fc_unlocks(text, date), kafaa_fc_target_check(text, text, text, date), kafaa_fc_moves(text), kafaa_fc_report(date),
  kafaa_fc_unlock_problem(jsonb), kafaa_lr_items(text, date), kafaa_lr_bundle(text, text[], date, text, date), kafaa_lr_share_problem(jsonb, text, date),
  kafaa_sg_problem(jsonb, kafaa_skills, date), kafaa_sg_sync_plan() from public, anon, authenticated;
revoke execute on function kafaa_set_microcred_strategic(text, boolean, text), kafaa_set_credential_unlock(jsonb), kafaa_credential_unlocks(text), kafaa_credential_target_check(text, text),
  kafaa_strategic_report(), kafaa_learner_record(text[]), kafaa_create_record_share(jsonb), kafaa_revoke_record_share(text, text), kafaa_verify_record_share(text),
  kafaa_save_skill_goal(jsonb), kafaa_withdraw_skill_goal(text), kafaa_share_skill_goal(text, boolean) from public, anon;
grant execute on function kafaa_set_microcred_strategic(text, boolean, text), kafaa_set_credential_unlock(jsonb), kafaa_credential_unlocks(text), kafaa_credential_target_check(text, text),
  kafaa_strategic_report(), kafaa_learner_record(text[]), kafaa_create_record_share(jsonb), kafaa_revoke_record_share(text, text), kafaa_verify_record_share(text),
  kafaa_save_skill_goal(jsonb), kafaa_withdraw_skill_goal(text), kafaa_share_skill_goal(text, boolean) to authenticated;
grant execute on function kafaa_verify_record_share(text) to anon;
