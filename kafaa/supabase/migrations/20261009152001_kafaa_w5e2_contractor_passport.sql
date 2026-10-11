-- [W5 · E2 · F33] Kafa'a contractor and supplier skills passport (M09): F03 extended to contractor personnel, scoped to their
-- organisation. Supplier academy certificates, ENEC equivalency decisions and (SIMULATED) ENEC engagement sign-offs become F01 evidence;
-- partner admins see their organisation's passports against the ENEC role profiles they are contracted for; a read-only equivalency
-- pre-check compares a passport with a standard's tasks before submitEquivalency; contractors wrap academy certificates as F04 badges.
-- Shared changes, all additive and only through kafaa_* objects:
--   * kafaa_person_skills / kafaa_skill_evidence gain org_id and contractor (stamped by the BEFORE INSERT trigger kafaa_cp_stamp for
--     people of kind contractor/partner at a supplier organisation; existing rows back-filled) and two read branches: the person's own
--     rows (own_profile Own: contractors have no skills_profile grant) and contractor rows for equivalency holders (OwnOrg on their own
--     organisation; ENEC evaluators A and auditors R on contractor rows only). No cross-organisation reads.
--   * AFTER triggers on kafaa_certificates and kafaa_equivalency_requests re-sync the contractor's passport evidence (kafaa_cp_sync) and
--     run kafaa_skills_apply; they never change the source row, stay quiet while kafaa.seeding is on and only warn on error.
--   * kafaa_issue_contractor_badge writes kafaa_badges rows with the F04 signer (kafaa_badge_credential / kafaa_badge_sign).
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file, RLS in the per-statement form,
-- internal helpers and the RPCs. LocalBackend mirror: src/modules/m09/backend/local.ts; rules: src/modules/m09/contractor.ts.
-- PGlite checks: scripts/validate/w5e2-contractor-passport.mjs.

-- ───────────── Tables (generated DDL)
-- M09 · ENEC role profiles a contractor organisation is contracted to staff, with a headcount band (F33)
create table if not exists kafaa_contract_role_targets (
  id text primary key,
  org_id text not null,
  role_id text not null,
  headcount_band text not null check (headcount_band in ('1-4', '5-9', '10-24', '25+')),
  contract_ref text not null default '',
  scope_en text not null default '',
  scope_ar text not null default '',
  valid_from date,
  valid_to date,
  active boolean not null default true,
  set_by text,
  updated_at timestamptz not null default now()
);
comment on table kafaa_contract_role_targets is '[M09] ENEC role profiles a contractor organisation is contracted to staff, with a headcount band (F33)';

-- M09 · Skills (and level) that evidence each task of a qualification standard; used by the equivalency pre-check (F33)
create table if not exists kafaa_task_skill_links (
  id text primary key,
  standard_id text not null,
  task_id text not null,
  skill_id text not null,
  need_level integer not null,
  sort integer not null default 0
);
comment on table kafaa_task_skill_links is '[M09] Skills (and level) that evidence each task of a qualification standard; used by the equivalency pre-check (F33)';

-- M09 · SIMULATED mirror of contractor work history at ENEC with supervisor skill sign-offs (F33)
create table if not exists kafaa_contractor_engagements (
  id text primary key,
  person_id text not null,
  org_id text not null,
  ref_code text not null,
  title_en text not null,
  title_ar text not null,
  role_id text,
  started_on date not null,
  ended_on date,
  status text not null check (status in ('in_progress', 'signed_off')),
  supervisor_role_en text not null default '',
  supervisor_role_ar text not null default '',
  skills jsonb not null default '[]'::jsonb,
  source text not null default 'mirror' check (source in ('mirror')),
  created_at timestamptz not null default now()
);
comment on table kafaa_contractor_engagements is '[M09] SIMULATED mirror of contractor work history at ENEC with supervisor skill sign-offs (F33)';

do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_contract_role_targets_org_id_fk') then alter table kafaa_contract_role_targets add constraint kafaa_contract_role_targets_org_id_fk foreign key (org_id) references kafaa_organisations(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_contract_role_targets_role_id_fk') then alter table kafaa_contract_role_targets add constraint kafaa_contract_role_targets_role_id_fk foreign key (role_id) references kafaa_job_roles(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_task_skill_links_standard_id_fk') then alter table kafaa_task_skill_links add constraint kafaa_task_skill_links_standard_id_fk foreign key (standard_id) references kafaa_qual_standards(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_task_skill_links_task_id_fk') then alter table kafaa_task_skill_links add constraint kafaa_task_skill_links_task_id_fk foreign key (task_id) references kafaa_task_items(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_task_skill_links_skill_id_fk') then alter table kafaa_task_skill_links add constraint kafaa_task_skill_links_skill_id_fk foreign key (skill_id) references kafaa_skills(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_contractor_engagements_person_id_fk') then alter table kafaa_contractor_engagements add constraint kafaa_contractor_engagements_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_contractor_engagements_org_id_fk') then alter table kafaa_contractor_engagements add constraint kafaa_contractor_engagements_org_id_fk foreign key (org_id) references kafaa_organisations(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_contractor_engagements_role_id_fk') then alter table kafaa_contractor_engagements add constraint kafaa_contractor_engagements_role_id_fk foreign key (role_id) references kafaa_job_roles(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_contract_role_targets_org_id_idx on kafaa_contract_role_targets (org_id);
create index if not exists kafaa_contract_role_targets_role_id_idx on kafaa_contract_role_targets (role_id);
create index if not exists kafaa_contract_role_targets_active_idx on kafaa_contract_role_targets (active);
create index if not exists kafaa_task_skill_links_standard_id_idx on kafaa_task_skill_links (standard_id);
create index if not exists kafaa_task_skill_links_task_id_idx on kafaa_task_skill_links (task_id);
create index if not exists kafaa_task_skill_links_skill_id_idx on kafaa_task_skill_links (skill_id);
create index if not exists kafaa_contractor_engagements_person_id_idx on kafaa_contractor_engagements (person_id);
create index if not exists kafaa_contractor_engagements_org_id_idx on kafaa_contractor_engagements (org_id);
create index if not exists kafaa_contractor_engagements_role_id_idx on kafaa_contractor_engagements (role_id);
create index if not exists kafaa_contractor_engagements_status_idx on kafaa_contractor_engagements (status);

-- ───────────── F01 skill tables: organisation scope for contractor rows (generated DDL of the two new columns)
alter table kafaa_skill_evidence add column if not exists org_id text;
alter table kafaa_skill_evidence add column if not exists contractor boolean not null default false;
alter table kafaa_person_skills add column if not exists org_id text;
alter table kafaa_person_skills add column if not exists contractor boolean not null default false;
create index if not exists kafaa_skill_evidence_org_id_idx on kafaa_skill_evidence (org_id);
create index if not exists kafaa_person_skills_org_id_idx on kafaa_person_skills (org_id);

-- The supplier organisation of a contractor person (kind contractor or partner at an organisation of kind supplier), else null.
-- Mirror of contractorOrgOf() in src/modules/m09/contractor.ts.
create or replace function kafaa_cp_org(p_person text) returns text language sql stable security definer set search_path = public as $$
  select p.org_id from kafaa_people p join kafaa_organisations o on o.id = p.org_id
  where p.id = p_person and p.kind in ('contractor', 'partner') and o.kind = 'supplier'
$$;
create or replace function kafaa_cp_stamp() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.org_id := kafaa_cp_org(new.person_id);
  new.contractor := new.org_id is not null;
  return new;
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'kafaa_cp_stamp_person_skills') then
    create trigger kafaa_cp_stamp_person_skills before insert on kafaa_person_skills for each row execute function kafaa_cp_stamp(); end if;
  if not exists (select 1 from pg_trigger where tgname = 'kafaa_cp_stamp_skill_evidence') then
    create trigger kafaa_cp_stamp_skill_evidence before insert on kafaa_skill_evidence for each row execute function kafaa_cp_stamp(); end if;
end $$;
-- Back-fill rows written before this migration (only rows whose stamp differs).
update kafaa_person_skills s set org_id = kafaa_cp_org(s.person_id), contractor = kafaa_cp_org(s.person_id) is not null
where s.org_id is distinct from kafaa_cp_org(s.person_id) or s.contractor is distinct from (kafaa_cp_org(s.person_id) is not null);
update kafaa_skill_evidence s set org_id = kafaa_cp_org(s.person_id), contractor = kafaa_cp_org(s.person_id) is not null
where s.org_id is distinct from kafaa_cp_org(s.person_id) or s.contractor is distinct from (kafaa_cp_org(s.person_id) is not null);

-- ───────────── RLS (policies created when missing, then set to the per-statement form like 20261008140000_kafaa_rls_perf.sql)
-- person_skills / skill_evidence: skills_profile (unchanged) OR own rows (own_profile) OR equivalency on contractor rows:
--   OwnOrg/OrgW when org_id is the caller's organisation, R/W/A on any contractor row (ENEC evaluators, auditors).
alter policy kafaa_read on kafaa_skill_evidence using (((SELECT kafaa_has_grant('skills_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('skills_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('skills_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('skills_profile'::text, person_id, NULL::text, false))
  OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false))
  OR (contractor AND (SELECT kafaa_has_grant('equivalency'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((org_id = (SELECT kafaa_my_org())) AND (SELECT kafaa_has_grant('equivalency'::text, ARRAY['OwnOrg'::text, 'OrgW'::text]))));
alter policy kafaa_read on kafaa_person_skills using (((SELECT kafaa_has_grant('skills_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('skills_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('skills_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('skills_profile'::text, person_id, NULL::text, false))
  OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false))
  OR (contractor AND (SELECT kafaa_has_grant('equivalency'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((org_id = (SELECT kafaa_my_org())) AND (SELECT kafaa_has_grant('equivalency'::text, ARRAY['OwnOrg'::text, 'OrgW'::text]))));

alter table kafaa_contract_role_targets enable row level security;
alter table kafaa_task_skill_links enable row level security;
alter table kafaa_contractor_engagements enable row level security;
do $$ declare t text; begin
  foreach t in array array['kafaa_contract_role_targets', 'kafaa_task_skill_links', 'kafaa_contractor_engagements'] loop
    if not exists (select 1 from pg_policies where tablename = t and policyname = 'kafaa_read') then
      execute format('create policy kafaa_read on %I for select to anon, authenticated using (false)', t);
    end if;
  end loop;
end $$;
-- Contracted roles: the organisation (partner_org OwnOrg/OrgW), ENEC partner admins and auditors (partner_org R/A), evaluators (equivalency R/W/A).
alter policy kafaa_read on kafaa_contract_role_targets using (((SELECT kafaa_has_grant('partner_org'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((org_id = (SELECT kafaa_my_org())) AND (SELECT kafaa_has_grant('partner_org'::text, ARRAY['OwnOrg'::text, 'OrgW'::text])))
  OR ((SELECT kafaa_has_grant('equivalency'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))));
-- The task → skill map is reference data, readable like the task list (frameworks R, which every role holds through public).
alter policy kafaa_read on kafaa_task_skill_links using ((SELECT kafaa_has_grant('frameworks'::text, ARRAY['R'::text, 'W'::text, 'A'::text])));
-- Engagements: the person (own_profile Own), their partner admin (equivalency OwnOrg), ENEC evaluators and auditors (equivalency R/W/A).
alter policy kafaa_read on kafaa_contractor_engagements using (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false))
  OR ((SELECT kafaa_has_grant('equivalency'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((org_id = (SELECT kafaa_my_org())) AND (SELECT kafaa_has_grant('equivalency'::text, ARRAY['OwnOrg'::text, 'OrgW'::text]))));
grant select on kafaa_contract_role_targets, kafaa_task_skill_links, kafaa_contractor_engagements to anon, authenticated;
revoke insert, update on kafaa_contract_role_targets, kafaa_task_skill_links, kafaa_contractor_engagements from anon, authenticated;

-- ───────────── Passport evidence (mirror of standardSkills / contractorEvidence / syncContractor)
-- Skills a qualification standard evidences: core skill of each competency its roles require (highest required level), skills keyed to
-- the standard (key level, cap 4). Security standards and security skills give nothing.
create or replace function kafaa_cp_std_skills(p_std text) returns table (skill_id text, lvl integer, sort integer)
language sql stable security definer set search_path = public as $$
  select x.id, x.lvl, x.sort from (
    select s.id, s.sort, greatest(
      case when s.core and r.need is not null then r.need else 0 end,
      case when q.id = any(s.evidence_keys) then least(s.key_level, 4) else 0 end) as lvl
    from kafaa_qual_standards q cross join kafaa_skills s join kafaa_competencies k on k.id = s.competency_id
    left join lateral (select max(rc.required_level) as need from kafaa_role_competencies rc where rc.role_id = any(q.role_ids) and rc.competency_id = s.competency_id) r on true
    where q.id = p_std and not coalesce(q.security_restricted, false) and k.domain <> 'security' and s.area <> 'security'
  ) x where x.lvl > 0
$$;

create or replace function kafaa_cp_evidence(p_person text, p_today date)
returns table (id text, skill_id text, kind text, ref_table text, ref_id text, level integer, basis text, status text, observed_on date, note text, active boolean)
language sql stable security definer set search_path = public as $$
  select distinct on (e.id) e.id, e.skill_id, e.kind, e.ref_table, e.ref_id, e.level, e.basis, e.status, e.observed_on, e.note, e.active from (
    select 1 as src, 0 as ord, 'se:credential:' || c.id || ':' || al.id as id, al.id as skill_id, 'credential' as kind, 'certificates' as ref_table, c.id as ref_id, al.lvl as level,
      'evidenced' as basis, case when c.status = 'valid' and (c.valid_to is null or c.valid_to >= p_today) then 'current' else 'lapsed' end as status,
      c.issued_on as observed_on, 'Supplier academy certificate' as note, (c.status = 'valid' and (c.valid_to is null or c.valid_to >= p_today)) as active
    from kafaa_certificates c join kafaa_courses co on co.id = c.course_id cross join lateral kafaa_course_alignment(co.id) al
    where c.person_id = p_person
    union all
    select 2, 0, 'se:credential:' || r.id || ':' || x.skill_id, x.skill_id, 'credential', 'equivalency_requests', r.id, x.lvl, 'validated', 'current',
      (coalesce(r.decided_at, r.submitted_at) at time zone 'UTC')::date, 'ENEC equivalency decision', true
    from kafaa_equivalency_requests r cross join lateral kafaa_cp_std_skills(r.standard_id) x
    where r.person_id = p_person and r.status = 'equivalent'
    union all
    select 3, e.n, 'se:ojt:' || g.id || ':' || s.id, s.id, 'ojt', 'contractor_engagements', g.id, least(trunc((e.v->>'level')::numeric)::integer, 4), 'evidenced', 'current',
      g.ended_on, 'ENEC engagement sign-off', true
    from kafaa_contractor_engagements g
    cross join lateral jsonb_array_elements(case when jsonb_typeof(g.skills) = 'array' then g.skills else '[]'::jsonb end) with ordinality as e(v, n)
    join kafaa_skills s on s.id = e.v->>'skill_id' join kafaa_competencies k on k.id = s.competency_id
    where g.person_id = p_person and g.status = 'signed_off' and g.ended_on is not null and k.domain <> 'security' and s.area <> 'security'
      and jsonb_typeof(e.v->'level') = 'number' and trunc((e.v->>'level')::numeric) >= 1
  ) e order by e.id, e.src, e.ord
$$;

-- Upsert the passport evidence, deactivate rows whose source is gone, recompute the F01 skill state (contractor people only).
create or replace function kafaa_cp_sync(p_person text) returns void language plpgsql security definer set search_path = public as $$
begin
  if kafaa_cp_org(p_person) is null then return; end if;
  insert into kafaa_skill_evidence (id, person_id, skill_id, kind, ref_table, ref_id, level, basis, status, observed_on, note, recorded_by, active, created_at)
  select e.id, p_person, e.skill_id, e.kind, e.ref_table, e.ref_id, e.level, e.basis, e.status, e.observed_on, e.note, null, e.active, now()
  from kafaa_cp_evidence(p_person, current_date) e
  on conflict (id) do update set level = excluded.level, basis = excluded.basis, status = excluded.status, observed_on = excluded.observed_on, active = excluded.active, note = excluded.note
  where (kafaa_skill_evidence.level, kafaa_skill_evidence.basis, kafaa_skill_evidence.status, kafaa_skill_evidence.observed_on, kafaa_skill_evidence.active, kafaa_skill_evidence.note)
    is distinct from (excluded.level, excluded.basis, excluded.status, excluded.observed_on, excluded.active, excluded.note);
  update kafaa_skill_evidence se set active = false
  where se.person_id = p_person and se.active and se.ref_table in ('certificates', 'equivalency_requests', 'contractor_engagements') and se.kind in ('credential', 'ojt')
    and not exists (select 1 from kafaa_cp_evidence(p_person, current_date) x where x.id = se.id);
  perform kafaa_skills_apply(p_person, current_date);
end $$;

-- Triggers: a certificate (insert, status or validity change) or an equivalency decision re-syncs the contractor's passport.
create or replace function kafaa_cp_on_certificate() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('kafaa.seeding', true), '') = 'on' then return null; end if;
  if tg_op = 'UPDATE' and new.status is not distinct from old.status and new.valid_to is not distinct from old.valid_to then return null; end if;
  if new.person_id is not null and kafaa_cp_org(new.person_id) is not null then
    begin perform kafaa_cp_sync(new.person_id); exception when others then raise warning 'kafaa_cp_on_certificate: %', sqlerrm; end;
  end if;
  return null;
end $$;
create or replace function kafaa_cp_on_equivalency() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('kafaa.seeding', true), '') = 'on' then return null; end if;
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return null; end if;
  if new.person_id is not null and kafaa_cp_org(new.person_id) is not null then
    begin perform kafaa_cp_sync(new.person_id); exception when others then raise warning 'kafaa_cp_on_equivalency: %', sqlerrm; end;
  end if;
  return null;
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'kafaa_cp_on_certificates') then
    create trigger kafaa_cp_on_certificates after insert or update on kafaa_certificates for each row execute function kafaa_cp_on_certificate(); end if;
  if not exists (select 1 from pg_trigger where tgname = 'kafaa_cp_on_equivalency_requests') then
    create trigger kafaa_cp_on_equivalency_requests after insert or update on kafaa_equivalency_requests for each row execute function kafaa_cp_on_equivalency(); end if;
end $$;

-- ───────────── Access: the acting role that may read this contractor's passport (self; own organisation's partner admin; ENEC evaluators
-- and auditors through equivalency R/W/A), else null. Staff are never contractors, so a staff id is "not found" for everyone.
create or replace function kafaa_cp_access(p_person text) returns text language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); v_org text := kafaa_cp_org(p_person);
begin
  if me is null or v_org is null then return null; end if;
  if p_person = me then return kafaa_acting_role('own_profile', array['Own']); end if;
  if kafaa_has_grant('equivalency', array['OwnOrg', 'OrgW']) and v_org = kafaa_my_org() then return kafaa_acting_role('equivalency', array['OwnOrg', 'OrgW']); end if;
  if kafaa_has_grant('equivalency', array['R', 'W', 'A']) then return kafaa_acting_role('equivalency', array['R', 'W', 'A']); end if;
  return null;
end $$;

-- ───────────── Equivalency pre-check (mirror of precheck() in src/modules/m09/contractor.ts). Read-only.
create or replace function kafaa_cp_reason(p_code text, p_vars jsonb default null, p_table text default null, p_id text default null) returns jsonb
language sql immutable set search_path = public as $$
  select jsonb_build_object('code', p_code, 'key', 'm09.reasons.' || p_code)
    || case when p_vars is null then '{}'::jsonb else jsonb_build_object('vars', p_vars) end
    || case when p_table is null then '{}'::jsonb else jsonb_build_object('ref', jsonb_build_object('table', p_table, 'id', p_id)) end
$$;
create or replace function kafaa_cp_precheck_compute(p_person text, p_std text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  t record; l record; c record; v_prior_req kafaa_equivalency_requests; v_eq text; v_open text;
  v_tasks jsonb := '[]'::jsonb; v_links jsonb; v_reasons jsonb; v_gap jsonb := '{}'::jsonb; v_sugg jsonb := '[]'::jsonb; v_covers jsonb;
  v_total integer := 0; v_likely integer := 0; v_partial integer := 0; v_crit integer := 0; v_n integer; v_none integer; v_first text;
  v_have integer; v_basis text; v_state text; v_status text; v_prior boolean; v_score numeric; v_date text;
  v_programmes text[] := array['supplier-academy', 'get', 'hu-core', 'maint-init', 'maint-cont', 'rp-init', 'rp-cont', 'chem-init', 'chem-cont', 'eng-init', 'eng-cont', 'ero'];
begin
  select r.id into v_eq from kafaa_equivalency_requests r where r.person_id = p_person and r.standard_id = p_std and r.status = 'equivalent'
    order by r.submitted_at desc nulls last, r.id collate "C" desc limit 1;
  select r.id into v_open from kafaa_equivalency_requests r where r.person_id = p_person and r.standard_id = p_std and r.status in ('submitted', 'under_review')
    order by r.submitted_at desc nulls last, r.id collate "C" desc limit 1;
  select r.* into v_prior_req from kafaa_equivalency_requests r where r.person_id = p_person and r.standard_id = p_std and r.status in ('training_required', 'under_review')
    and exists (select 1 from jsonb_array_elements(case when jsonb_typeof(r.mapping) = 'array' then r.mapping else '[]'::jsonb end) m where m->'covered' = 'true'::jsonb)
    order by r.submitted_at desc nulls last, r.id collate "C" desc limit 1;
  v_date := to_char(coalesce(v_prior_req.decided_at, v_prior_req.submitted_at) at time zone 'UTC', 'YYYY-MM-DD');
  for t in select * from kafaa_task_items ti where ti.standard_id = p_std order by ti.sort, ti.id collate "C" loop
    v_links := '[]'::jsonb; v_reasons := '[]'::jsonb; v_n := 0; v_none := 0; v_first := null;
    v_prior := v_prior_req.id is not null and exists (select 1 from jsonb_array_elements(case when jsonb_typeof(v_prior_req.mapping) = 'array' then v_prior_req.mapping else '[]'::jsonb end) m
      where m->>'task_id' = t.id and m->'covered' = 'true'::jsonb);
    if v_prior then v_reasons := v_reasons || jsonb_build_array(kafaa_cp_reason('prior_mapping', jsonb_build_object('date', v_date), 'equivalency_requests', v_prior_req.id)); end if;
    for l in
      select tl.skill_id, tl.need_level, s.name_en, s.name_ar, ps.level as have_level, ps.basis as have_basis
      from kafaa_task_skill_links tl join kafaa_skills s on s.id = tl.skill_id join kafaa_competencies k on k.id = s.competency_id
      left join kafaa_person_skills ps on ps.person_id = p_person and ps.skill_id = tl.skill_id and ps.active
      where tl.task_id = t.id and s.area <> 'security' and k.domain <> 'security'
      order by tl.sort, tl.skill_id collate "C"
    loop
      v_have := coalesce(l.have_level, 0);
      v_basis := case when l.have_level is not null and l.have_level > 0 then l.have_basis else 'none' end;
      v_state := case when v_have >= l.need_level then (case when v_basis = 'claimed' then 'claimed' else 'strong' end)
                      when v_have > 0 and v_have = l.need_level - 1 then 'near' else 'none' end;
      v_n := v_n + 1;
      if v_n = 1 then v_first := v_state; end if;
      if v_state = 'none' then v_none := v_none + 1; end if;
      v_links := v_links || jsonb_build_array(jsonb_build_object('skill_id', l.skill_id, 'need', l.need_level, 'have', v_have, 'basis', v_basis, 'state', v_state));
      v_reasons := v_reasons || jsonb_build_array(kafaa_cp_reason('link_' || v_state,
        jsonb_build_object('skill', jsonb_build_object('en', l.name_en, 'ar', l.name_ar), 'have', v_have, 'need', l.need_level), 'skills', l.skill_id));
    end loop;
    if v_n = 0 and not v_prior then v_reasons := v_reasons || jsonb_build_array(kafaa_cp_reason('no_link')); end if;
    v_status := case when v_prior or (v_n > 0 and v_first = 'strong' and v_none = 0) then 'likely' when v_n > v_none then 'partial' else 'gap' end;
    if v_status <> 'likely' then
      select v_gap || coalesce(jsonb_object_agg(x.skill_id, greatest(coalesce((v_gap->>x.skill_id)::integer, 0), x.w)), '{}'::jsonb) into v_gap
      from (select e.v->>'skill_id' as skill_id, max(case when e.n = 1 then 2 else 1 end) as w
            from jsonb_array_elements(v_links) with ordinality as e(v, n) where e.v->>'state' <> 'strong' group by e.v->>'skill_id') x;
    end if;
    v_total := v_total + 1;
    if v_status = 'likely' then v_likely := v_likely + 1; elsif v_status = 'partial' then v_partial := v_partial + 1; end if;
    if t.critical is true and v_status = 'gap' then v_crit := v_crit + 1; end if;
    v_tasks := v_tasks || jsonb_build_array(jsonb_build_object('task_id', t.id, 'critical', t.critical is true, 'status', v_status, 'prior', v_prior, 'links', v_links, 'reasons', v_reasons));
  end loop;
  -- suggestions: supplier academy and ENEC technical courses that evidence the skills behind tasks not yet likely
  for c in
    select co.* from kafaa_courses co where co.programme_id = any(v_programmes)
      and not exists (select 1 from kafaa_competencies k where k.id = any(co.competency_ids) and k.domain = 'security')
  loop
    select coalesce(jsonb_agg(jsonb_build_object('id', al.id, 'en', al.name_en, 'ar', al.name_ar) order by al.sort, al.id collate "C"), '[]'::jsonb),
           coalesce(sum((v_gap->>al.id)::integer), 0)
      into v_covers, v_score
      from kafaa_course_alignment(c.id) al where v_gap ? al.id;
    if jsonb_array_length(v_covers) = 0 then continue; end if;
    v_score := v_score + case when c.audience = 'supplier' then 0.5 else 0 end;
    v_sugg := v_sugg || jsonb_build_array(jsonb_build_object('id', c.id, 'score', v_score, 'reasons',
      jsonb_build_array(kafaa_cp_reason(case when c.audience = 'supplier' then 'academy_course' else 'enec_course' end,
        jsonb_build_object('code', jsonb_build_object('en', coalesce(c.code, ''), 'ar', coalesce(c.code, ''))), 'courses', c.id))
      || coalesce((select jsonb_agg(kafaa_cp_reason('closes_gap', jsonb_build_object('skill', jsonb_build_object('en', x->>'en', 'ar', x->>'ar')), 'skills', x->>'id') order by n)
                   from jsonb_array_elements(v_covers) with ordinality as e(x, n)), '[]'::jsonb)));
  end loop;
  select coalesce(jsonb_agg(s order by (s->>'score')::numeric desc, s->>'id' collate "C"), '[]'::jsonb) into v_sugg
    from (select s from jsonb_array_elements(v_sugg) s order by (s->>'score')::numeric desc, s->>'id' collate "C" limit 4) x;
  return jsonb_build_object(
    'person_id', p_person, 'standard_id', p_std, 'total', v_total, 'likely', v_likely, 'partial', v_partial, 'gaps', v_total - v_likely - v_partial,
    'critical_gaps', v_crit, 'coverage', case when v_total > 0 then ((2 * v_likely + v_partial) * 100 + v_total) / (2 * v_total) else 0 end,
    'outlook', case when v_eq is not null then 'already_equivalent' when v_total > 0 and v_likely = v_total then 'likely_equivalent' when v_crit > 0 then 'training_likely' else 'review' end,
    'open_request_id', v_open, 'equivalent_request_id', v_eq, 'prior_request_id', v_prior_req.id, 'tasks', v_tasks, 'suggestions', v_sugg);
end $$;

-- RPC: equivalency pre-check. Audited, no ledger; never writes kafaa_equivalency_requests.
create or replace function kafaa_equivalency_precheck(p_person text, p_standard text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_pid text := coalesce(p_person, ''); v_role text; q kafaa_qual_standards; r jsonb; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('equivalency.precheck', 'equivalency_requests', nullif(v_pid, ''), 'not_signed_in', 'Sign in first'); end if;
  v_role := kafaa_cp_access(v_pid);
  if v_role is null then return kafaa_refuse('equivalency.precheck', 'equivalency_requests', nullif(v_pid, ''), 'not_found', 'Passport not found'); end if;
  select * into q from kafaa_qual_standards where id = p_standard;
  if q.id is null or q.status <> 'current' then return kafaa_refuse('equivalency.precheck', 'equivalency_requests', v_pid, 'not_found', 'Qualification standard not found', v_role); end if;
  if q.security_restricted then return kafaa_refuse('equivalency.precheck', 'equivalency_requests', v_pid, 'invalid', 'Security qualifications are not handled through equivalency in Kafa''a', v_role); end if;
  r := kafaa_cp_precheck_compute(v_pid, q.id);
  a := kafaa_audit('equivalency.precheck', 'equivalency_requests', v_pid, 'ok',
    format('%s: %s/%s likely, %s critical gaps, outlook %s', q.code, r->>'likely', r->>'total', r->>'critical_gaps', r->>'outlook'), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Pre-check ready. It is guidance only: an ENEC evaluator decides equivalency.', a, null, r);
end $$;

-- RPC: ENEC (partner_org A) sets a contracted ENEC role profile for a supplier organisation. Ledger.
create or replace function kafaa_set_contract_role_target(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; o kafaa_organisations; jr kafaa_job_roles; v_id text; v_entity text; v_ref text; v_en text; v_ar text; v_active boolean;
  v_why text; a kafaa_audit_events; l integer;
begin
  v_entity := case when coalesce(p->>'org_id', '') <> '' and coalesce(p->>'role_id', '') <> '' then 'crt-' || (p->>'org_id') || '-' || (p->>'role_id') end;
  if me is null then return kafaa_refuse('contractor.role_target', 'contract_role_targets', v_entity, 'not_signed_in', 'Sign in first'); end if;
  v_role := kafaa_acting_role('partner_org', array['A']);
  if v_role is null then return kafaa_refuse('contractor.role_target', 'contract_role_targets', v_entity, 'forbidden', 'Only an ENEC partner administrator may set contracted role profiles'); end if;
  select * into o from kafaa_organisations where id = p->>'org_id';
  if o.id is null or o.kind <> 'supplier' then return kafaa_refuse('contractor.role_target', 'contract_role_targets', v_entity, 'not_found', 'Organisation not found among supplier organisations', v_role); end if;
  select * into jr from kafaa_job_roles where id = p->>'role_id';
  if jr.id is null or jr.status <> 'published' then return kafaa_refuse('contractor.role_target', 'contract_role_targets', v_entity, 'not_found', 'Role not found among published roles', v_role); end if;
  if coalesce(jr.security_sensitive, false) or jr.family_id in ('security', 'cyber', 'safeguards') then
    return kafaa_refuse('contractor.role_target', 'contract_role_targets', v_entity, 'security_restricted', 'Security, cyber and safeguards roles are not contracted through the passport', v_role);
  end if;
  if coalesce(p->>'headcount_band', '') not in ('1-4', '5-9', '10-24', '25+') then
    return kafaa_refuse('contractor.role_target', 'contract_role_targets', v_entity, 'invalid', 'Choose a headcount band: 1-4, 5-9, 10-24 or 25+', v_role);
  end if;
  v_ref := btrim(coalesce(p->>'contract_ref', '')); v_en := btrim(coalesce(p->>'scope_en', '')); v_ar := btrim(coalesce(p->>'scope_ar', ''));
  if length(v_ref) > 200 or length(v_en) > 200 or length(v_ar) > 200 then
    return kafaa_refuse('contractor.role_target', 'contract_role_targets', v_entity, 'invalid', 'Contract reference and scope must be 200 characters or fewer', v_role);
  end if;
  v_id := 'crt-' || o.id || '-' || jr.id;
  v_active := coalesce(p->'active', 'true'::jsonb) <> 'false'::jsonb;
  insert into kafaa_contract_role_targets (id, org_id, role_id, headcount_band, contract_ref, scope_en, scope_ar, valid_from, valid_to, active, set_by, updated_at)
  values (v_id, o.id, jr.id, p->>'headcount_band', v_ref, v_en, v_ar, current_date, null, v_active, me, now())
  on conflict (id) do update set headcount_band = excluded.headcount_band, contract_ref = excluded.contract_ref, scope_en = excluded.scope_en, scope_ar = excluded.scope_ar,
    active = excluded.active, set_by = excluded.set_by, updated_at = excluded.updated_at;
  v_why := o.id || ' ' || jr.id || ' ' || (p->>'headcount_band') || case when v_active then '' else ' (inactive)' end;
  l := kafaa_ledger('kafaa.contractor.role_target', 'Contracted role profile ' || v_why);
  a := kafaa_audit('contractor.role_target', 'contract_role_targets', v_id, 'ok', v_why, case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Contracted role profile saved', a, l, jsonb_build_object('id', v_id));
end $$;

-- RPC: a contractor wraps their own valid supplier academy certificate as a signed Open Badges 3.0 credential (F04 signer, key-1).
-- The certificate is already passport evidence, so the badge adds none. Ledger kafaa.badge.issue.
create or replace function kafaa_issue_contractor_badge(p_cert text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_src text := btrim(coalesce(p_cert, '')); v_role text; cert kafaa_certificates; co kafaa_courses; v_init text; v_slug text; v_id text;
  v_cred jsonb; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('badge.issue', 'badges', nullif(v_src, ''), 'not_signed_in', 'Sign in first'); end if;
  if kafaa_cp_org(me) is null then return kafaa_refuse('badge.issue', 'badges', nullif(v_src, ''), 'forbidden', 'Only a contractor can wrap their own supplier academy certificate'); end if;
  v_role := kafaa_acting_role('own_profile', array['Own']);
  select * into cert from kafaa_certificates where id = v_src and person_id = me;
  if cert.id is not null then select * into co from kafaa_courses where id = cert.course_id; end if;
  if cert.id is null or co.id is null or co.audience <> 'supplier' then
    return kafaa_refuse('badge.issue', 'badges', nullif(v_src, ''), 'not_found', 'No supplier academy certificate of yours has this number', v_role);
  end if;
  if cert.status = 'revoked' then return kafaa_refuse('badge.issue', 'badges', v_src, 'not_eligible', 'This certificate is revoked: a badge cannot be issued', v_role); end if;
  if cert.status <> 'valid' or (cert.valid_to is not null and cert.valid_to < current_date) then
    return kafaa_refuse('badge.issue', 'badges', v_src, 'not_eligible', 'This certificate has expired: a badge cannot be issued', v_role);
  end if;
  if exists (select 1 from kafaa_competencies k where k.id = any(co.competency_ids) and k.domain = 'security') then
    return kafaa_refuse('badge.issue', 'badges', v_src, 'security_restricted', 'Security-related training shows as qualified or not qualified only and is never issued as a badge', v_role);
  end if;
  if exists (select 1 from kafaa_badges b where b.person_id = me and b.course_id = co.id and b.status = 'active') then
    return kafaa_refuse('badge.issue', 'badges', v_src, 'already_issued', 'You already hold an active badge for this course', v_role);
  end if;
  select coalesce(nullif(cert.holder_initials, ''), nullif(p.initials, ''), '—') into v_init from kafaa_people p where p.id = me;
  v_slug := 'kb' || left(replace(gen_random_uuid()::text, '-', ''), 12);
  v_id := 'bdg-' || v_slug;
  v_cred := kafaa_badge_sign(kafaa_badge_credential(v_slug, 'certificate', cert.id, co.id, v_init, current_date, cert.valid_to, cert.issued_on, 'Kafa''a certificate register', 'key-1'));
  insert into kafaa_badges (id, person_id, source_table, source_id, course_id, holder_initials, achievement, credential, issued_on, valid_to, status, key_id, public_slug, created_at)
  values (v_id, me, 'certificates', cert.id, co.id, v_init,
    jsonb_build_object('kind', 'certificate', 'code', co.code, 'name_en', co.title_en, 'name_ar', co.title_ar,
      'skills', coalesce((select jsonb_agg(al.id order by al.sort, al.id collate "C") from kafaa_course_alignment(co.id) al), '[]'::jsonb)),
    v_cred, current_date, cert.valid_to, 'active', 'key-1', v_slug, now());
  l := kafaa_ledger('kafaa.badge.issue', format('Badge %s issued for %s (certificate)', v_slug, co.code));
  a := kafaa_audit('badge.issue', 'badges', v_id, 'ok', format('%s certificate %s (contractor)', co.code, cert.id), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Badge issued and signed', a, l, jsonb_build_object('id', v_id, 'slug', v_slug));
end $$;

-- Read: a contractor's credentials. Self and their partner admin get the signed credential; ENEC evaluators and auditors do not.
create or replace function kafaa_contractor_badges(p_person text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_full boolean;
begin
  if kafaa_cp_access(coalesce(p_person, '')) is null then return '[]'::jsonb; end if;
  v_full := p_person = kafaa_me() or (kafaa_has_grant('equivalency', array['OwnOrg', 'OrgW']) and kafaa_cp_org(p_person) = kafaa_my_org());
  return coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'public_slug', b.public_slug, 'course_id', b.course_id, 'achievement', b.achievement,
      'issued_on', b.issued_on::text, 'valid_to', b.valid_to::text, 'status', b.status, 'credential', case when v_full then b.credential else null end)
      order by b.issued_on desc, b.id collate "C") from kafaa_badges b where b.person_id = p_person), '[]'::jsonb);
end $$;

-- ───────────── Grants: internal helpers are not executable by API roles; RPCs by signed-in users only.
revoke execute on function kafaa_cp_org(text), kafaa_cp_stamp(), kafaa_cp_std_skills(text), kafaa_cp_evidence(text, date), kafaa_cp_sync(text), kafaa_cp_on_certificate(),
  kafaa_cp_on_equivalency(), kafaa_cp_access(text), kafaa_cp_reason(text, jsonb, text, text), kafaa_cp_precheck_compute(text, text) from public, anon, authenticated;
revoke execute on function kafaa_equivalency_precheck(text, text), kafaa_set_contract_role_target(jsonb), kafaa_issue_contractor_badge(text), kafaa_contractor_badges(text) from public, anon;
grant execute on function kafaa_equivalency_precheck(text, text), kafaa_set_contract_role_target(jsonb), kafaa_issue_contractor_badge(text), kafaa_contractor_badges(text) to authenticated;
