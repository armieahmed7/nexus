-- [W0 · F01/F02] Kafa'a skills core (M17-M27 scaffolding) and engine settings.
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file, RLS in the per-statement
-- form, the new policy-matrix rows, and the SQL mirror of src/domain/skills.ts (checked against the seed by
-- scripts/validate/w0-skills.mjs). LocalBackend mirror: src/data/local/rpc.w0.ts.

-- ───────────── Tables (generated DDL)
-- M17 · Skill catalogue: finer layer under the competencies (F01)
create table if not exists kafaa_skills (
  id text primary key,
  code text not null unique,
  competency_id text not null,
  name_en text not null,
  name_ar text not null,
  area text not null check (area in ('plant_systems', 'operations', 'maintenance', 'radiation_chemistry', 'engineering', 'safety', 'human_performance', 'emergency', 'security', 'quality', 'leadership', 'digital', 'project')),
  core boolean not null default false,
  key_level integer not null default 2,
  evidence_keys text[] not null default '{}'::text[],
  adjacent_ids text[] not null default '{}'::text[],
  adv_skill_ids text[] not null default '{}'::text[],
  description_en text not null default '',
  description_ar text not null default '',
  sources jsonb not null default '[]'::jsonb,
  sort integer not null default 0
);
comment on table kafaa_skills is '[M17] Skill catalogue: finer layer under the competencies (F01)';

-- M17 · Skill evidence per person (derived from records, or recorded by later features) (F01)
create table if not exists kafaa_skill_evidence (
  id text primary key,
  person_id text not null,
  skill_id text not null,
  kind text not null check (kind in ('qual', 'course', 'assessment', 'jpm', 'rating', 'ojt', 'credential')),
  ref_table text not null,
  ref_id text not null,
  level integer not null,
  basis text not null check (basis in ('verified', 'evidenced', 'validated', 'claimed')),
  status text not null default 'current' check (status in ('current', 'lapsed')),
  observed_on date not null,
  note text,
  recorded_by text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
comment on table kafaa_skill_evidence is '[M17] Skill evidence per person (derived from records, or recorded by later features) (F01)';

-- M17 · Derived skill state per person: level 0-4, confidence, basis and reasons (F01)
create table if not exists kafaa_person_skills (
  id text primary key,
  person_id text not null,
  skill_id text not null,
  level integer not null,
  confidence numeric not null,
  basis text not null check (basis in ('verified', 'evidenced', 'validated', 'claimed', 'none')),
  reasons jsonb not null default '[]'::jsonb,
  evidence_count integer not null default 0,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
comment on table kafaa_person_skills is '[M17] Derived skill state per person: level 0-4, confidence, basis and reasons (F01)';

-- M16 · Engine per surface (deterministic or model slot) and ranking weights (F02)
create table if not exists kafaa_engine_settings (
  id text primary key,
  surface text not null unique check (surface in ('skills', 'recommend', 'match', 'search')),
  engine text not null default 'deterministic' check (engine in ('deterministic', 'model')),
  weights jsonb not null default '{}'::jsonb,
  updated_by text,
  updated_at timestamptz not null default now()
);
comment on table kafaa_engine_settings is '[M16] Engine per surface (deterministic or model slot) and ranking weights (F02)';

-- Foreign keys and indexes
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_skills_competency_id_fk') then alter table kafaa_skills add constraint kafaa_skills_competency_id_fk foreign key (competency_id) references kafaa_competencies(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_evidence_person_id_fk') then alter table kafaa_skill_evidence add constraint kafaa_skill_evidence_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_evidence_skill_id_fk') then alter table kafaa_skill_evidence add constraint kafaa_skill_evidence_skill_id_fk foreign key (skill_id) references kafaa_skills(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_person_skills_person_id_fk') then alter table kafaa_person_skills add constraint kafaa_person_skills_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_person_skills_skill_id_fk') then alter table kafaa_person_skills add constraint kafaa_person_skills_skill_id_fk foreign key (skill_id) references kafaa_skills(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_skills_competency_id_idx on kafaa_skills (competency_id);
create index if not exists kafaa_skills_area_idx on kafaa_skills (area);
create index if not exists kafaa_skill_evidence_person_id_idx on kafaa_skill_evidence (person_id);
create index if not exists kafaa_skill_evidence_skill_id_idx on kafaa_skill_evidence (skill_id);
create index if not exists kafaa_skill_evidence_kind_idx on kafaa_skill_evidence (kind);
create index if not exists kafaa_skill_evidence_ref_id_idx on kafaa_skill_evidence (ref_id);
create index if not exists kafaa_person_skills_person_id_idx on kafaa_person_skills (person_id);
create index if not exists kafaa_person_skills_skill_id_idx on kafaa_person_skills (skill_id);

-- ───────────── RLS (policies created when missing, then set to the per-statement form like 20261008140000_kafaa_rls_perf.sql)
alter table kafaa_skills enable row level security;
alter table kafaa_skill_evidence enable row level security;
alter table kafaa_person_skills enable row level security;
alter table kafaa_engine_settings enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_skills' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_skills for select to anon, authenticated using (true)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_skills' and policyname = 'kafaa_insert') then
    execute 'create policy kafaa_insert on kafaa_skills for insert to anon, authenticated with check (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_skills' and policyname = 'kafaa_update') then
    execute 'create policy kafaa_update on kafaa_skills for update to authenticated using (false) with check (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_skill_evidence' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_skill_evidence for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_person_skills' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_person_skills for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_engine_settings' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_engine_settings for select to anon, authenticated using (false)'; end if;
end $$;
alter policy kafaa_read on kafaa_skills using (((SELECT kafaa_has_grant('frameworks'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((SELECT kafaa_has_grant('public_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))));
alter policy kafaa_insert on kafaa_skills with check ((SELECT kafaa_has_grant('frameworks'::text, ARRAY['W'::text, 'A'::text])));
alter policy kafaa_update on kafaa_skills using ((SELECT kafaa_has_grant('frameworks'::text, ARRAY['W'::text, 'A'::text]))) with check ((SELECT kafaa_has_grant('frameworks'::text, ARRAY['W'::text, 'A'::text])));
alter policy kafaa_read on kafaa_skill_evidence using (((SELECT kafaa_has_grant('skills_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('skills_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('skills_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('skills_profile'::text, person_id, NULL::text, false)));
alter policy kafaa_read on kafaa_person_skills using (((SELECT kafaa_has_grant('skills_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('skills_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('skills_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('skills_profile'::text, person_id, NULL::text, false)));
alter policy kafaa_read on kafaa_engine_settings using ((SELECT kafaa_has_grant('public_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text])));
grant select on kafaa_skills, kafaa_skill_evidence, kafaa_person_skills, kafaa_engine_settings to anon, authenticated;
grant insert, update on kafaa_skills to authenticated;
-- kafaa_skill_evidence, kafaa_person_skills and kafaa_engine_settings change only through the SECURITY DEFINER RPCs below.
revoke insert, update on kafaa_skill_evidence, kafaa_person_skills, kafaa_engine_settings from anon, authenticated;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'kafaa_skills_audit') then
    execute 'create trigger kafaa_skills_audit after insert or update on kafaa_skills for each row execute function kafaa_audit_row()'; end if;
end $$;

-- ───────────── Policy matrix rows for the F01 resources (additive; the generated 20261008120200 file holds the full matrix)
insert into kafaa_policy_matrix (role, resource, level) values
  ('employee', 'skills_profile', 'Own'),
  ('licensed_operator', 'skills_profile', 'Own'),
  ('manager', 'skills_profile', 'Own'),
  ('manager', 'skills_profile', 'Scope'),
  ('instructor', 'skills_profile', 'Own'),
  ('instructor', 'skills_profile', 'Scope'),
  ('training_manager', 'skills_profile', 'Own'),
  ('training_manager', 'skills_profile', 'Scope'),
  ('training_manager', 'skills_profile', 'A'),
  ('licensing_coord', 'skills_profile', 'Own'),
  ('hr_analyst', 'skills_profile', 'Own'),
  ('hr_analyst', 'skills_profile', 'Agg'),
  ('hr_director', 'skills_profile', 'Own'),
  ('hr_director', 'skills_profile', 'Agg'),
  ('editor', 'skills_profile', 'Own'),
  ('ecp_officer', 'skills_profile', 'Own'),
  ('admin', 'skills_profile', 'Own'),
  ('employee', 'opportunities', 'R'),
  ('employee', 'opportunities', 'Own'),
  ('licensed_operator', 'opportunities', 'R'),
  ('licensed_operator', 'opportunities', 'Own'),
  ('manager', 'opportunities', 'R'),
  ('manager', 'opportunities', 'Own'),
  ('manager', 'opportunities', 'W'),
  ('manager', 'opportunities', 'A'),
  ('instructor', 'opportunities', 'R'),
  ('instructor', 'opportunities', 'Own'),
  ('training_manager', 'opportunities', 'R'),
  ('training_manager', 'opportunities', 'Own'),
  ('training_manager', 'opportunities', 'W'),
  ('training_manager', 'opportunities', 'A'),
  ('licensing_coord', 'opportunities', 'R'),
  ('licensing_coord', 'opportunities', 'Own'),
  ('hr_analyst', 'opportunities', 'R'),
  ('hr_analyst', 'opportunities', 'Own'),
  ('hr_analyst', 'opportunities', 'Agg'),
  ('hr_director', 'opportunities', 'R'),
  ('hr_director', 'opportunities', 'Own'),
  ('hr_director', 'opportunities', 'Agg'),
  ('hr_director', 'opportunities', 'A'),
  ('editor', 'opportunities', 'R'),
  ('editor', 'opportunities', 'Own'),
  ('ecp_officer', 'opportunities', 'R'),
  ('ecp_officer', 'opportunities', 'Own'),
  ('admin', 'opportunities', 'R'),
  ('admin', 'opportunities', 'Own'),
  ('auditor', 'opportunities', 'R'),
  ('manager', 'talent_review', 'Scope'),
  ('hr_analyst', 'talent_review', 'Scope'),
  ('hr_analyst', 'talent_review', 'Agg'),
  ('hr_director', 'talent_review', 'R'),
  ('hr_director', 'talent_review', 'A'),
  ('employee', 'knowledge', 'R'),
  ('licensed_operator', 'knowledge', 'R'),
  ('manager', 'knowledge', 'R'),
  ('manager', 'knowledge', 'Scope'),
  ('instructor', 'knowledge', 'R'),
  ('instructor', 'knowledge', 'W'),
  ('training_manager', 'knowledge', 'R'),
  ('training_manager', 'knowledge', 'W'),
  ('training_manager', 'knowledge', 'A'),
  ('licensing_coord', 'knowledge', 'R'),
  ('hr_analyst', 'knowledge', 'R'),
  ('hr_analyst', 'knowledge', 'Agg'),
  ('hr_director', 'knowledge', 'R'),
  ('hr_director', 'knowledge', 'Agg'),
  ('editor', 'knowledge', 'R'),
  ('ecp_officer', 'knowledge', 'R'),
  ('admin', 'knowledge', 'R'),
  ('auditor', 'knowledge', 'R'),
  ('employee', 'learning_analytics', 'Own'),
  ('licensed_operator', 'learning_analytics', 'Own'),
  ('manager', 'learning_analytics', 'Own'),
  ('manager', 'learning_analytics', 'Agg'),
  ('manager', 'learning_analytics', 'W'),
  ('instructor', 'learning_analytics', 'Own'),
  ('instructor', 'learning_analytics', 'Agg'),
  ('training_manager', 'learning_analytics', 'Own'),
  ('training_manager', 'learning_analytics', 'Agg'),
  ('training_manager', 'learning_analytics', 'W'),
  ('training_manager', 'learning_analytics', 'A'),
  ('hr_analyst', 'learning_analytics', 'Agg'),
  ('hr_director', 'learning_analytics', 'Agg'),
  ('auditor', 'learning_analytics', 'R'),
  ('instructor', 'sat', 'R'),
  ('instructor', 'sat', 'W'),
  ('training_manager', 'sat', 'R'),
  ('training_manager', 'sat', 'W'),
  ('training_manager', 'sat', 'A'),
  ('auditor', 'sat', 'R'),
  ('employee', 'lrs', 'Own'),
  ('licensed_operator', 'lrs', 'Own'),
  ('manager', 'lrs', 'Own'),
  ('manager', 'lrs', 'Scope'),
  ('instructor', 'lrs', 'Own'),
  ('instructor', 'lrs', 'Scope'),
  ('training_manager', 'lrs', 'Own'),
  ('training_manager', 'lrs', 'Scope'),
  ('training_manager', 'lrs', 'Agg'),
  ('hr_analyst', 'lrs', 'Agg'),
  ('auditor', 'lrs', 'R')
on conflict do nothing;

-- ───────────── Engine settings (F02): deterministic everywhere until a model gateway exists
insert into kafaa_engine_settings (id, surface, engine, weights) values
  ('skills', 'skills', 'deterministic', '{"half_life_months": 36}'::jsonb),
  ('recommend', 'recommend', 'deterministic', '{"current_role": 1, "target_role": 0.6, "core": 3, "important": 2, "useful": 1}'::jsonb),
  ('match', 'match', 'deterministic', '{"skills": 0.7, "development": 0.2, "target": 0.1}'::jsonb),
  ('search', 'search', 'deterministic', '{"title": 3, "k1": 1.4, "b": 0.7}'::jsonb)
on conflict (id) do nothing;

-- ───────────── Derived evidence (mirror of gatherEvidence in src/domain/skills.ts)
create or replace function kafaa_skill_evidence_derive(p_person text, p_now date)
returns table (id text, person_id text, skill_id text, kind text, ref_table text, ref_id text, level integer, basis text, status text, observed_on date)
language sql stable security definer set search_path = public as $$
  with sk as (
    select s.id, s.competency_id, s.core, s.key_level, s.evidence_keys, c.domain from kafaa_skills s join kafaa_competencies c on c.id = s.competency_id
  ),
  stdc as (
    select q.id as standard_id, rc.competency_id, max(rc.required_level) as lvl
    from kafaa_qual_standards q join kafaa_role_competencies rc on rc.role_id = any(q.role_ids)
    group by q.id, rc.competency_id
  ),
  q as (
    select r.id as ref_id, r.person_id, s.id as standard_id, s.security_restricted,
      (r.status in ('qualified', 'due', 'renewed') and (r.expires_on is null or r.expires_on >= p_now)) as cur,
      coalesce(r.qualified_on, (r.last_synced at time zone 'UTC')::date) as obs
    from kafaa_qual_records r join kafaa_qual_standards s on s.id = r.standard_id
    where r.status in ('qualified', 'due', 'renewed', 'expired', 'suspended') and (p_person is null or r.person_id = p_person)
  ),
  qm as (
    select q.*, sk.id as skill_id,
      greatest(case when sk.core then coalesce(c.lvl, 0) else 0 end, case when q.standard_id = any(sk.evidence_keys) then sk.key_level else 0 end) as lvl
    from q cross join sk left join stdc c on c.standard_id = q.standard_id and c.competency_id = sk.competency_id
    where not q.security_restricted or sk.domain = 'security'
  ),
  cm as (
    select t.id as ref_id, t.person_id, sk.id as skill_id, t.completed_on as obs,
      greatest(case when sk.core and sk.competency_id = any(c.competency_ids) then (case when c.qualifying then 2 else 1 end) else 0 end,
               case when c.id = any(sk.evidence_keys) then least(sk.key_level, case when c.qualifying then 2 else 1 end) else 0 end) as lvl
    from kafaa_training_records t join kafaa_courses c on c.id = t.course_id cross join sk
    where t.result in ('passed', 'completed') and (p_person is null or t.person_id = p_person)
  ),
  am as (
    select a.id as ref_id, a.person_id, sk.id as skill_id, (coalesce(a.submitted_at, a.started_at, a.scheduled_for) at time zone 'UTC')::date as obs,
      greatest(case when sk.core and sk.competency_id = any(c.competency_ids) then 2 else 0 end, case when c.id = any(sk.evidence_keys) then least(sk.key_level, 2) else 0 end) as lvl
    from kafaa_attempts a join kafaa_assessment_forms f on f.id = a.form_id join kafaa_courses c on c.id = f.course_id cross join sk
    where a.passed is true and a.counts is not false and a.status in ('graded', 'released') and not coalesce(f.is_practice, false)
      and coalesce(a.submitted_at, a.started_at, a.scheduled_for) is not null and (p_person is null or a.person_id = p_person)
  ),
  jm as (
    select r.id as ref_id, r.person_id, sk.id as skill_id, r.date as obs,
      greatest(case when sk.core and c.lvl is not null then least(c.lvl, 3) else 0 end, case when s.id = any(sk.evidence_keys) then least(sk.key_level, 3) else 0 end) as lvl
    from kafaa_jpm_results r join kafaa_jpms j on j.id = r.jpm_id join kafaa_qual_standards s on s.id = j.standard_id cross join sk
    left join stdc c on c.standard_id = s.id and c.competency_id = sk.competency_id
    where r.result = 'pass' and not s.security_restricted and (p_person is null or r.person_id = p_person)
  )
  select 'se:qual:' || qm.ref_id || ':' || qm.skill_id, qm.person_id, qm.skill_id, 'qual', 'qual_records', qm.ref_id,
         case when qm.cur then qm.lvl else greatest(1, qm.lvl - 1) end, case when qm.cur then 'verified' else 'evidenced' end,
         case when qm.cur then 'current' else 'lapsed' end, qm.obs
  from qm where qm.lvl > 0
  union all
  select 'se:course:' || cm.ref_id || ':' || cm.skill_id, cm.person_id, cm.skill_id, 'course', 'training_records', cm.ref_id, cm.lvl, 'evidenced', 'current', cm.obs from cm where cm.lvl > 0
  union all
  select 'se:assessment:' || am.ref_id || ':' || am.skill_id, am.person_id, am.skill_id, 'assessment', 'attempts', am.ref_id, am.lvl, 'evidenced', 'current', am.obs from am where am.lvl > 0
  union all
  select 'se:jpm:' || jm.ref_id || ':' || jm.skill_id, jm.person_id, jm.skill_id, 'jpm', 'jpm_results', jm.ref_id, jm.lvl, 'evidenced', 'current', jm.obs from jm where jm.lvl > 0
$$;

-- ───────────── Skill states (mirror of deriveStates in src/domain/skills.ts; same float operations and ordering)
create or replace function kafaa_skill_states_compute(p_person text, p_now date)
returns table (id text, person_id text, skill_id text, level integer, confidence numeric, basis text, reasons jsonb, evidence_count integer)
language sql stable security definer set search_path = public as $$
  with ev as (
    select d.id, d.person_id, d.skill_id, d.kind, d.level, d.basis, d.status, d.observed_on from kafaa_skill_evidence_derive(p_person, p_now) d
    union all
    select e.id, e.person_id, e.skill_id, e.kind, e.level, e.basis, e.status, e.observed_on from kafaa_skill_evidence e
    where e.active and e.kind in ('rating', 'ojt', 'credential') and (p_person is null or e.person_id = p_person)
  ),
  s1 as (select ev.*, (ev.kind = 'qual' and ev.status = 'current') as holds, greatest(0, p_now - ev.observed_on) as age from ev),
  s2 as (
    select s1.*,
      case when s1.holds then 1.0::float8 else floor(power(0.5::float8, s1.age::float8 / 1096.0::float8) * 10000 + 0.5) / 10000 end as decay,
      (not s1.holds and s1.age > 1096) as ageing,
      case s1.basis when 'verified' then 0.95::float8 when 'evidenced' then (case when s1.kind = 'jpm' then 0.85::float8 else 0.8::float8 end)
                    when 'validated' then 0.7::float8 else 0.4::float8 end as base
    from s1
  ),
  s3 as (
    select s2.*, case when s2.ageing then greatest(1, s2.level - 1) else s2.level end as eff, floor(s2.base * s2.decay * 10000 + 0.5) / 10000 as conf,
      case s2.basis when 'verified' then 4 when 'evidenced' then 3 when 'validated' then 2 else 1 end as brank,
      case when s2.kind = 'qual' then (case when s2.status = 'lapsed' then 'qual_lapsed' else 'qual' end) when s2.kind = 'rating' then 'rating_' || s2.basis else s2.kind end as code
    from s2
  ),
  rk as (
    select s3.*, row_number() over (partition by s3.person_id, s3.skill_id
             order by (case when s3.basis = 'claimed' then 0 else 1 end) desc, s3.eff desc, s3.brank desc, s3.conf desc, s3.observed_on desc, s3.id collate "C" asc) as rn,
           count(*) over (partition by s3.person_id, s3.skill_id) as n
    from s3
  )
  select 'ps:' || w.person_id || ':' || w.skill_id, w.person_id, w.skill_id, w.eff,
         (floor(least(0.99::float8, w.conf + 0.05::float8 * least(w.n - 1, 4)::float8) * 100 + 0.5) / 100)::numeric,
         w.basis,
         (select jsonb_agg(jsonb_build_object('code', r.code, 'evidence_id', r.id, 'level', r.eff, 'basis', r.basis, 'observed_on', r.observed_on::text, 'ageing', r.ageing) order by r.rn)
            from rk r where r.person_id = w.person_id and r.skill_id = w.skill_id),
         w.n::integer
  from rk w where w.rn = 1
$$;

-- ───────────── Apply: upsert derived evidence and states (rows no longer supported are marked inactive, never removed)
create or replace function kafaa_skills_apply(p_person text, p_now date) returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  insert into kafaa_skill_evidence (id, person_id, skill_id, kind, ref_table, ref_id, level, basis, status, observed_on, active)
  select d.id, d.person_id, d.skill_id, d.kind, d.ref_table, d.ref_id, d.level, d.basis, d.status, d.observed_on, true from kafaa_skill_evidence_derive(p_person, p_now) d
  on conflict (id) do update set level = excluded.level, basis = excluded.basis, status = excluded.status, observed_on = excluded.observed_on, active = true
  where (kafaa_skill_evidence.level, kafaa_skill_evidence.basis, kafaa_skill_evidence.status, kafaa_skill_evidence.observed_on, kafaa_skill_evidence.active)
        is distinct from (excluded.level, excluded.basis, excluded.status, excluded.observed_on, true);
  update kafaa_skill_evidence e set active = false
  where e.active and e.kind in ('qual', 'course', 'assessment', 'jpm') and (p_person is null or e.person_id = p_person)
    and e.id not in (select d.id from kafaa_skill_evidence_derive(p_person, p_now) d);
  insert into kafaa_person_skills (id, person_id, skill_id, level, confidence, basis, reasons, evidence_count, active, updated_at)
  select s.id, s.person_id, s.skill_id, s.level, s.confidence, s.basis, s.reasons, s.evidence_count, true, now() from kafaa_skill_states_compute(p_person, p_now) s
  on conflict (id) do update set level = excluded.level, confidence = excluded.confidence, basis = excluded.basis, reasons = excluded.reasons,
    evidence_count = excluded.evidence_count, active = true, updated_at = now()
  where (kafaa_person_skills.level, kafaa_person_skills.confidence, kafaa_person_skills.basis, kafaa_person_skills.reasons, kafaa_person_skills.evidence_count, kafaa_person_skills.active)
        is distinct from (excluded.level, excluded.confidence, excluded.basis, excluded.reasons, excluded.evidence_count, true);
  update kafaa_person_skills p set active = false, level = 0, confidence = 0, basis = 'none', reasons = '[]'::jsonb, evidence_count = 0, updated_at = now()
  where p.active and (p_person is null or p.person_id = p_person) and p.id not in (select s.id from kafaa_skill_states_compute(p_person, p_now) s);
  select jsonb_build_object(
    'people', (select count(distinct p.person_id) from kafaa_person_skills p where p.active and (p_person is null or p.person_id = p_person)),
    'states', (select count(*) from kafaa_person_skills p where p.active and (p_person is null or p.person_id = p_person)),
    'evidence', (select count(*) from kafaa_skill_evidence e where e.active and (p_person is null or e.person_id = p_person)),
    'digest', (select encode(sha256(convert_to(coalesce(string_agg(p.id || '|' || p.level || '|' || round(p.confidence * 100)::integer || '|' || p.basis, E'\n' order by p.id collate "C"), ''), 'UTF8')), 'hex')
               from kafaa_person_skills p where p.active and (p_person is null or p.person_id = p_person)))
  into v;
  return v;
end $$;

-- ───────────── RPC: recompute skills (self; manager or instructor in scope; training_manager for anyone or everyone). Audited, no ledger.
create or replace function kafaa_recompute_skills(p_person text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; r jsonb; a kafaa_audit_events; v_entity text := coalesce(p_person, 'all');
begin
  if me is null then return kafaa_refuse('skills.recompute', 'person_skills', v_entity, 'not_signed_in', 'Sign in to recompute skills'); end if;
  if p_person is null then
    v_role := kafaa_acting_role('skills_profile', array['A']);
    if v_role is null then return kafaa_refuse('skills.recompute', 'person_skills', v_entity, 'forbidden', 'Only a training manager may recompute everyone''s skills'); end if;
  else
    if not exists (select 1 from kafaa_people where id = p_person) then return kafaa_refuse('skills.recompute', 'person_skills', v_entity, 'not_found', 'Person not found'); end if;
    if p_person = me and kafaa_has_grant('skills_profile', array['Own', 'Scope']) then v_role := kafaa_acting_role('skills_profile', array['Own', 'Scope']);
    elsif kafaa_has_grant('skills_profile', array['A']) then v_role := kafaa_acting_role('skills_profile', array['A']);
    elsif kafaa_has_grant('skills_profile', array['Scope']) and kafaa_in_scope('skills_profile', p_person) then v_role := kafaa_acting_role('skills_profile', array['Scope']);
    else return kafaa_refuse('skills.recompute', 'person_skills', v_entity, 'forbidden', 'This person is not in your scope');
    end if;
  end if;
  r := kafaa_skills_apply(p_person, current_date);
  a := kafaa_audit('skills.recompute', 'person_skills', v_entity, 'ok', format('%s people, %s states, %s evidence rows', r->>'people', r->>'states', r->>'evidence'), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Skills recomputed', a, null, r);
end $$;

-- ───────────── RPC: engine per surface and weights (F02). Platform admins only; audited.
create or replace function kafaa_set_engine_weights(p_surface text, p_engine text, p_weights jsonb default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_role text := kafaa_acting_role('integrations', array['A']); a kafaa_audit_events;
begin
  if v_role is null then return kafaa_refuse('engine.settings', 'engine_settings', p_surface, 'forbidden', 'Only a platform admin may change engine settings'); end if;
  if p_surface is null or p_surface not in ('skills', 'recommend', 'match', 'search') then return kafaa_refuse('engine.settings', 'engine_settings', p_surface, 'invalid', 'Unknown surface', v_role); end if;
  if p_engine is null or p_engine not in ('deterministic', 'model') then return kafaa_refuse('engine.settings', 'engine_settings', p_surface, 'invalid', 'Engine must be deterministic or model', v_role); end if;
  if p_weights is not null and (jsonb_typeof(p_weights) <> 'object' or exists (
      select 1 from jsonb_each(p_weights) w where jsonb_typeof(w.value) <> 'number' or (w.value::text)::numeric < 0 or (w.value::text)::numeric > 10)) then
    return kafaa_refuse('engine.settings', 'engine_settings', p_surface, 'invalid', 'Weights must be numbers between 0 and 10', v_role);
  end if;
  insert into kafaa_engine_settings (id, surface, engine, weights, updated_by, updated_at) values (p_surface, p_surface, p_engine, coalesce(p_weights, '{}'::jsonb), kafaa_me(), now())
  on conflict (id) do update set engine = excluded.engine, weights = coalesce(p_weights, kafaa_engine_settings.weights), updated_by = excluded.updated_by, updated_at = now();
  a := kafaa_audit('engine.settings', 'engine_settings', p_surface, 'ok', p_surface || ': ' || p_engine, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Engine settings saved', a);
end $$;

revoke execute on function kafaa_skill_evidence_derive(text, date), kafaa_skill_states_compute(text, date), kafaa_skills_apply(text, date) from public, anon, authenticated;
revoke execute on function kafaa_recompute_skills(text), kafaa_set_engine_weights(text, text, jsonb) from public, anon;
grant execute on function kafaa_recompute_skills(text), kafaa_set_engine_weights(text, text, jsonb) to authenticated;
