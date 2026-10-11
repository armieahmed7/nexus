-- [FS · wave A · E1 · FS01 + FS02] Future-skills foundation and catalogue extension.
--   FS01  policy-matrix rows for the seven new resources (skills_taxonomy, ai_literacy, transformation, recognition,
--         workforce_strategy, ecosystem, national_alignment) and the benchmark registry kafaa_benchmarks (40 rows, public
--         when published; framework owners edit; every source https with an as-of date).
--   FS02  taxonomy attributes on kafaa_skills (reusability, skill type, lifecycle, decay class, owner, version, review date,
--         level essence EN/AR, alternative labels EN/AR, Jahiz future group, future-skills area, benchmark ids, obsolete date
--         and replacement) and "obsolete, never delete" (ESCO): kafaa_fs_skill_guard refuses any delete, a return from
--         obsolete and a lower version; checks require an obsolete date and forbid self-replacement.
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file and
-- RLS in the per-statement form. No RPC: both tables use the existing direct-write rule for frameworks (W/A), with the
-- row-audit trigger. TS mirrors: src/domain/taxonomy.ts (skillGuard) and src/domain/benchmarks.ts (benchmarkProblems),
-- applied to direct writes by src/data/local/guards.ts. PGlite checks: scripts/validate/fs11-foundation.mjs.

-- ───────────── FS02: taxonomy attributes on kafaa_skills (generated column DDL)
alter table kafaa_skills add column if not exists reusability text not null default 'sector_specific' check (reusability in ('transversal', 'cross_sectoral', 'sector_specific', 'occupation_specific'));
alter table kafaa_skills add column if not exists skill_type text not null default 'specialised' check (skill_type in ('common', 'specialised', 'licence_like'));
alter table kafaa_skills add column if not exists lifecycle text not null default 'stable' check (lifecycle in ('emerging', 'growing', 'stable', 'declining', 'obsolete'));
alter table kafaa_skills add column if not exists decay_class text not null default 'standard' check (decay_class in ('fast', 'standard', 'slow'));
alter table kafaa_skills add column if not exists owner_role text not null default 'nuclear_training' check (owner_role in ('nuclear_training', 'operations', 'maintenance', 'engineering', 'radiation_chemistry', 'safety_licensing', 'human_performance', 'emergency_preparedness', 'quality', 'leadership_development', 'digital_ai_governance', 'sustainability', 'advanced_reactors', 'cyber_awareness'));
alter table kafaa_skills add column if not exists version integer not null default 1;
alter table kafaa_skills add column if not exists review_due date;
alter table kafaa_skills add column if not exists level_essence_en text not null default '';
alter table kafaa_skills add column if not exists level_essence_ar text not null default '';
alter table kafaa_skills add column if not exists alt_labels_en text[] not null default '{}'::text[];
alter table kafaa_skills add column if not exists alt_labels_ar text[] not null default '{}'::text[];
alter table kafaa_skills add column if not exists future_group text check (future_group in ('digital', 'ten_x', 'data_ai', 'new_economy', 'nuclear_excellence'));
alter table kafaa_skills add column if not exists fs_area text check (fs_area in ('transversal', 'ai_data', 'green_energy', 'advanced_reactor', 'cyber_hygiene', 'digital_plant'));
alter table kafaa_skills add column if not exists benchmark_ids text[] not null default '{}'::text[];
alter table kafaa_skills add column if not exists obsolete_on date;
alter table kafaa_skills add column if not exists replaced_by text;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_skills_replaced_by_fk') then alter table kafaa_skills add constraint kafaa_skills_replaced_by_fk foreign key (replaced_by) references kafaa_skills(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_skills_lifecycle_idx on kafaa_skills (lifecycle);
create index if not exists kafaa_skills_future_group_idx on kafaa_skills (future_group);
create index if not exists kafaa_skills_fs_area_idx on kafaa_skills (fs_area);
create index if not exists kafaa_skills_replaced_by_idx on kafaa_skills (replaced_by);
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_skills_fs_obsolete_ck') then
  alter table kafaa_skills add constraint kafaa_skills_fs_obsolete_ck check (lifecycle <> 'obsolete' or obsolete_on is not null); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_skills_fs_replaced_ck') then
  alter table kafaa_skills add constraint kafaa_skills_fs_replaced_ck check (replaced_by is null or replaced_by <> id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_skills_fs_version_ck') then
  alter table kafaa_skills add constraint kafaa_skills_fs_version_ck check (version >= 1); end if; end $$;

-- "Obsolete, never delete" (ESCO). Same messages as SKILL_GUARD_MSG in src/domain/taxonomy.ts. Fires for every caller,
-- definer functions and migrations included.
create or replace function kafaa_fs_skill_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Skills are never deleted: mark the skill obsolete instead' using errcode = 'check_violation';
  end if;
  if old.lifecycle = 'obsolete' and new.lifecycle is distinct from 'obsolete' then
    raise exception 'An obsolete skill stays obsolete: publish a new skill instead (ESCO: obsolete, never deleted)' using errcode = 'check_violation';
  end if;
  if new.version < old.version then
    raise exception 'A skill version can only go up' using errcode = 'check_violation';
  end if;
  return new;
end $$;
revoke execute on function kafaa_fs_skill_guard() from public, anon, authenticated;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'kafaa_fs_skill_guard') then
    create trigger kafaa_fs_skill_guard before update or delete on kafaa_skills for each row execute function kafaa_fs_skill_guard();
  end if;
end $$;

-- ───────────── FS01: benchmark registry (generated DDL)
-- M28 · International future-skills benchmarks: owner, year, sources, as-of date, figures, what Kafa'a borrows (FS01)
create table if not exists kafaa_benchmarks (
  id text primary key,
  name_en text not null,
  name_ar text not null,
  owner_en text not null,
  owner_ar text not null,
  country_en text not null,
  country_ar text not null,
  category text not null check (category in ('global', 'national', 'uae', 'nuclear_energy', 'ai', 'corporate')),
  year_from integer not null,
  year_to integer,
  year_kind text not null default 'single' check (year_kind in ('single', 'range', 'editions', 'current', 'reference')),
  urls text[] not null,
  fact_en text not null,
  fact_ar text not null,
  borrow_en text not null,
  borrow_ar text not null,
  figures jsonb not null default '[]'::jsonb,
  feature_ids text[] not null default '{}'::text[],
  as_of date not null,
  status text not null default 'published' check (status in ('draft', 'published', 'retired')),
  listed boolean not null default true,
  sort integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by text
);
comment on table kafaa_benchmarks is '[M28] International future-skills benchmarks: owner, year, sources, as-of date, figures, what Kafa''a borrows (FS01)';
create index if not exists kafaa_benchmarks_category_idx on kafaa_benchmarks (category);
create index if not exists kafaa_benchmarks_status_idx on kafaa_benchmarks (status);
-- Same rules as benchmarkProblems() (src/domain/benchmarks.ts): at least one source and every source https; an as-of date;
-- listed exactly when published (the public read rule uses listed); readable ids; sane years; figures as a JSON array.
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_benchmarks_https_ck') then
  alter table kafaa_benchmarks add constraint kafaa_benchmarks_https_ck check (cardinality(urls) >= 1 and ('|' || array_to_string(urls, '|')) !~ '\|(?!https://[^\s/$.?#])'); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_benchmarks_listed_ck') then
  alter table kafaa_benchmarks add constraint kafaa_benchmarks_listed_ck check (listed = (status = 'published')); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_benchmarks_id_ck') then
  alter table kafaa_benchmarks add constraint kafaa_benchmarks_id_ck check (id ~ '^[A-Z0-9][A-Z0-9-]{1,30}$'); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_benchmarks_year_ck') then
  alter table kafaa_benchmarks add constraint kafaa_benchmarks_year_ck check (year_from between 1990 and 2100 and (year_to is null or year_to >= year_from) and as_of between date '2000-01-01' and date '2100-01-01' and jsonb_typeof(figures) = 'array'); end if; end $$;

-- RLS: published rows public (public_content R where listed); drafts and retired rows for admins and auditors (integrations
-- R/A) and SAT staff (sat R/W/A); direct writes by framework owners (frameworks W/A), audited by kafaa_audit_row.
alter table kafaa_benchmarks enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_benchmarks' and policyname = 'kafaa_read') then
    create policy kafaa_read on kafaa_benchmarks for select to anon, authenticated using (false);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_benchmarks' and policyname = 'kafaa_insert') then
    create policy kafaa_insert on kafaa_benchmarks for insert to anon, authenticated with check (false);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_benchmarks' and policyname = 'kafaa_update') then
    create policy kafaa_update on kafaa_benchmarks for update to authenticated using (false) with check (false);
  end if;
end $$;
alter policy kafaa_read on kafaa_benchmarks using (((COALESCE(listed, false) AND (SELECT kafaa_has_grant('public_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))) OR ((SELECT kafaa_has_grant('integrations'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((SELECT kafaa_has_grant('sat'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))));
alter policy kafaa_insert on kafaa_benchmarks with check ((SELECT kafaa_has_grant('frameworks'::text, ARRAY['W'::text, 'A'::text])));
alter policy kafaa_update on kafaa_benchmarks using ((SELECT kafaa_has_grant('frameworks'::text, ARRAY['W'::text, 'A'::text]))) with check ((SELECT kafaa_has_grant('frameworks'::text, ARRAY['W'::text, 'A'::text])));
grant select, insert, update on kafaa_benchmarks to authenticated;
grant select on kafaa_benchmarks to anon;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'kafaa_benchmarks_audit') then
    create trigger kafaa_benchmarks_audit after insert or update on kafaa_benchmarks for each row execute function kafaa_audit_row();
  end if;
end $$;

-- ───────────── FS01: policy-matrix rows for the seven future-skills resources (additive; the generated 20261008120200 file
-- holds the full matrix). Grants: src/auth/policy.ts (FS01 block).
insert into kafaa_policy_matrix (role, resource, level) values
  ('public', 'skills_taxonomy', 'R'),
  ('applicant', 'skills_taxonomy', 'R'),
  ('employee', 'skills_taxonomy', 'R'),
  ('employee', 'skills_taxonomy', 'W'),
  ('licensed_operator', 'skills_taxonomy', 'R'),
  ('licensed_operator', 'skills_taxonomy', 'W'),
  ('manager', 'skills_taxonomy', 'R'),
  ('manager', 'skills_taxonomy', 'W'),
  ('instructor', 'skills_taxonomy', 'R'),
  ('instructor', 'skills_taxonomy', 'W'),
  ('training_manager', 'skills_taxonomy', 'R'),
  ('training_manager', 'skills_taxonomy', 'W'),
  ('training_manager', 'skills_taxonomy', 'A'),
  ('licensing_coord', 'skills_taxonomy', 'R'),
  ('licensing_coord', 'skills_taxonomy', 'W'),
  ('hr_analyst', 'skills_taxonomy', 'R'),
  ('hr_analyst', 'skills_taxonomy', 'W'),
  ('hr_director', 'skills_taxonomy', 'R'),
  ('hr_director', 'skills_taxonomy', 'W'),
  ('hr_director', 'skills_taxonomy', 'A'),
  ('partner_user', 'skills_taxonomy', 'R'),
  ('partner_admin', 'skills_taxonomy', 'R'),
  ('university', 'skills_taxonomy', 'R'),
  ('observer', 'skills_taxonomy', 'R'),
  ('editor', 'skills_taxonomy', 'R'),
  ('editor', 'skills_taxonomy', 'W'),
  ('ecp_officer', 'skills_taxonomy', 'R'),
  ('ecp_officer', 'skills_taxonomy', 'W'),
  ('admin', 'skills_taxonomy', 'R'),
  ('admin', 'skills_taxonomy', 'W'),
  ('admin', 'skills_taxonomy', 'A'),
  ('auditor', 'skills_taxonomy', 'R'),
  ('employee', 'ai_literacy', 'R'),
  ('employee', 'ai_literacy', 'Own'),
  ('licensed_operator', 'ai_literacy', 'R'),
  ('licensed_operator', 'ai_literacy', 'Own'),
  ('manager', 'ai_literacy', 'R'),
  ('manager', 'ai_literacy', 'Own'),
  ('instructor', 'ai_literacy', 'R'),
  ('instructor', 'ai_literacy', 'Own'),
  ('training_manager', 'ai_literacy', 'R'),
  ('training_manager', 'ai_literacy', 'Own'),
  ('training_manager', 'ai_literacy', 'W'),
  ('licensing_coord', 'ai_literacy', 'R'),
  ('licensing_coord', 'ai_literacy', 'Own'),
  ('hr_analyst', 'ai_literacy', 'R'),
  ('hr_analyst', 'ai_literacy', 'Own'),
  ('hr_analyst', 'ai_literacy', 'Agg'),
  ('hr_director', 'ai_literacy', 'R'),
  ('hr_director', 'ai_literacy', 'Own'),
  ('hr_director', 'ai_literacy', 'Agg'),
  ('editor', 'ai_literacy', 'R'),
  ('editor', 'ai_literacy', 'Own'),
  ('ecp_officer', 'ai_literacy', 'R'),
  ('ecp_officer', 'ai_literacy', 'Own'),
  ('admin', 'ai_literacy', 'R'),
  ('admin', 'ai_literacy', 'Own'),
  ('admin', 'ai_literacy', 'W'),
  ('admin', 'ai_literacy', 'A'),
  ('auditor', 'ai_literacy', 'R'),
  ('employee', 'transformation', 'R'),
  ('employee', 'transformation', 'Own'),
  ('licensed_operator', 'transformation', 'R'),
  ('licensed_operator', 'transformation', 'Own'),
  ('manager', 'transformation', 'R'),
  ('manager', 'transformation', 'Own'),
  ('manager', 'transformation', 'Scope'),
  ('instructor', 'transformation', 'R'),
  ('instructor', 'transformation', 'Own'),
  ('training_manager', 'transformation', 'R'),
  ('training_manager', 'transformation', 'Own'),
  ('training_manager', 'transformation', 'W'),
  ('licensing_coord', 'transformation', 'R'),
  ('licensing_coord', 'transformation', 'Own'),
  ('hr_analyst', 'transformation', 'R'),
  ('hr_analyst', 'transformation', 'Own'),
  ('hr_analyst', 'transformation', 'Agg'),
  ('hr_director', 'transformation', 'R'),
  ('hr_director', 'transformation', 'Own'),
  ('hr_director', 'transformation', 'Agg'),
  ('hr_director', 'transformation', 'W'),
  ('hr_director', 'transformation', 'A'),
  ('editor', 'transformation', 'R'),
  ('editor', 'transformation', 'Own'),
  ('ecp_officer', 'transformation', 'R'),
  ('ecp_officer', 'transformation', 'Own'),
  ('admin', 'transformation', 'R'),
  ('admin', 'transformation', 'Own'),
  ('auditor', 'transformation', 'R'),
  ('employee', 'recognition', 'Own'),
  ('licensed_operator', 'recognition', 'Own'),
  ('manager', 'recognition', 'Own'),
  ('manager', 'recognition', 'Scope'),
  ('instructor', 'recognition', 'Own'),
  ('instructor', 'recognition', 'A'),
  ('training_manager', 'recognition', 'Own'),
  ('training_manager', 'recognition', 'A'),
  ('licensing_coord', 'recognition', 'Own'),
  ('hr_analyst', 'recognition', 'Own'),
  ('hr_analyst', 'recognition', 'Agg'),
  ('hr_director', 'recognition', 'Own'),
  ('hr_director', 'recognition', 'Agg'),
  ('hr_director', 'recognition', 'A'),
  ('editor', 'recognition', 'Own'),
  ('ecp_officer', 'recognition', 'Own'),
  ('admin', 'recognition', 'Own'),
  ('auditor', 'recognition', 'R'),
  ('training_manager', 'workforce_strategy', 'Agg'),
  ('hr_analyst', 'workforce_strategy', 'Agg'),
  ('hr_analyst', 'workforce_strategy', 'W'),
  ('hr_director', 'workforce_strategy', 'Agg'),
  ('hr_director', 'workforce_strategy', 'W'),
  ('hr_director', 'workforce_strategy', 'A'),
  ('admin', 'workforce_strategy', 'R'),
  ('auditor', 'workforce_strategy', 'R'),
  ('employee', 'ecosystem', 'R'),
  ('employee', 'ecosystem', 'Own'),
  ('licensed_operator', 'ecosystem', 'R'),
  ('licensed_operator', 'ecosystem', 'Own'),
  ('manager', 'ecosystem', 'R'),
  ('manager', 'ecosystem', 'Own'),
  ('instructor', 'ecosystem', 'R'),
  ('instructor', 'ecosystem', 'Own'),
  ('training_manager', 'ecosystem', 'R'),
  ('training_manager', 'ecosystem', 'Own'),
  ('licensing_coord', 'ecosystem', 'R'),
  ('licensing_coord', 'ecosystem', 'Own'),
  ('hr_analyst', 'ecosystem', 'R'),
  ('hr_analyst', 'ecosystem', 'Own'),
  ('hr_analyst', 'ecosystem', 'Agg'),
  ('hr_analyst', 'ecosystem', 'W'),
  ('hr_director', 'ecosystem', 'R'),
  ('hr_director', 'ecosystem', 'Own'),
  ('hr_director', 'ecosystem', 'Agg'),
  ('hr_director', 'ecosystem', 'W'),
  ('hr_director', 'ecosystem', 'A'),
  ('partner_user', 'ecosystem', 'R'),
  ('partner_user', 'ecosystem', 'OwnOrg'),
  ('partner_admin', 'ecosystem', 'R'),
  ('partner_admin', 'ecosystem', 'OwnOrg'),
  ('partner_admin', 'ecosystem', 'OrgW'),
  ('university', 'ecosystem', 'R'),
  ('university', 'ecosystem', 'OwnOrg'),
  ('university', 'ecosystem', 'OrgW'),
  ('editor', 'ecosystem', 'R'),
  ('editor', 'ecosystem', 'Own'),
  ('ecp_officer', 'ecosystem', 'R'),
  ('ecp_officer', 'ecosystem', 'Own'),
  ('admin', 'ecosystem', 'R'),
  ('admin', 'ecosystem', 'Own'),
  ('admin', 'ecosystem', 'A'),
  ('auditor', 'ecosystem', 'R'),
  ('employee', 'national_alignment', 'R'),
  ('licensed_operator', 'national_alignment', 'R'),
  ('manager', 'national_alignment', 'R'),
  ('instructor', 'national_alignment', 'R'),
  ('training_manager', 'national_alignment', 'R'),
  ('licensing_coord', 'national_alignment', 'R'),
  ('hr_analyst', 'national_alignment', 'R'),
  ('hr_analyst', 'national_alignment', 'Agg'),
  ('hr_director', 'national_alignment', 'R'),
  ('hr_director', 'national_alignment', 'W'),
  ('editor', 'national_alignment', 'R'),
  ('ecp_officer', 'national_alignment', 'R'),
  ('admin', 'national_alignment', 'R'),
  ('admin', 'national_alignment', 'W'),
  ('admin', 'national_alignment', 'A'),
  ('auditor', 'national_alignment', 'R')
on conflict do nothing;

-- ───────────── FS02 hand-off to F35 (W5E4, M07 skills outlook): the ADVANCE share of a family counts the established
-- catalogue only. The FS02 future skills (fs_area set) are horizontal and enter the outlook through FS04/FS52, so adding
-- them does not dilute adv_m / adv_t. kafaa_so_base is redefined unchanged apart from "and sk.fs_area is null" (TS mirror:
-- src/modules/m07/outlook.ts, marked FS02); seeded and live outlooks keep their stored results.
create or replace function kafaa_so_base(p_scenario text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_base integer := 2026; sc kafaa_scenarios; v_p jsonb; v_head boolean; v_tech text := null; v_sc jsonb := null;
  v_kperiod text; v_cperiod text; v_vperiod text; v_high numeric; v_med numeric; v_fams jsonb := '[]'::jsonb; a text;
  v_ns integer; v_nd integer; v_pool integer; v_klra jsonb; v_cohort jsonb; v_cover jsonb; v_lo boolean; v_m integer; v_t integer;
  v_kv integer[]; pos record; dep jsonb; w integer; i integer; y integer; n integer; v_org integer; v_staff integer;
begin
  if p_scenario is not null then
    select * into sc from kafaa_scenarios where id = p_scenario;
    if sc.id is null then return null; end if;
    v_p := case when jsonb_typeof(sc.params) = 'object' then sc.params else '{}'::jsonb end;
    v_head := sc.kind = 'headcount';
    if sc.kind = 'technology' and jsonb_typeof(v_p->'technology') = 'string' and (v_p->>'technology') <> '' then v_tech := v_p->>'technology'; end if;
    v_sc := jsonb_build_object('id', sc.id, 'name', sc.name, 'kind', sc.kind,
      'units', case when v_head then kafaa_so_num(v_p->'units', 0) else 0 end,
      'start', case when v_head then kafaa_so_num(coalesce(v_p->'startYear', v_p->'start'), 2032) else 2032 end,
      'per_unit', case when v_head then kafaa_so_num(v_p->'perUnit', 48) else 48 end,
      'baseline', case when v_head then kafaa_so_num(v_p->'baseline', 190) else 190 end,
      'tech', v_tech);
  end if;
  select max(period collate "C") into v_kperiod from kafaa_klra_assessments;
  select max(period collate "C") into v_cperiod from kafaa_handover_cohorts;
  select max(period collate "C") into v_vperiod from kafaa_external_cover;
  select coalesce(max(high_threshold) filter (where id = 'default'), 16), coalesce(max(medium_threshold) filter (where id = 'default'), 8) into v_high, v_med from kafaa_klra_settings;
  select count(*)::integer into v_staff from kafaa_people p where p.kind = 'staff' and p.status = 'active';
  select greatest(0, floor(w.value))::integer into v_org from kafaa_workforce_snapshots w
    where w.measure = 'headcount' and w.family_id is null and w.level is null and w.entity_id is null order by w.period collate "C" desc limit 1;

  foreach a in array kafaa_so_families() loop
    select count(distinct ps.person_id)::integer into v_ns from kafaa_person_skills ps join kafaa_skills sk on sk.id = ps.skill_id join kafaa_people st on st.id = ps.person_id and st.kind = 'staff' and st.status = 'active'
      where ps.active is distinct from false and ps.level >= 2 and sk.area = a;
    select count(distinct ps.person_id)::integer into v_pool from kafaa_person_skills ps join kafaa_skills sk on sk.id = ps.skill_id join kafaa_people st on st.id = ps.person_id and st.kind = 'staff' and st.status = 'active'
      where ps.active is distinct from false and ps.level >= 1 and ps.level < 2 and sk.area = a
        and not exists (select 1 from kafaa_person_skills h join kafaa_skills hs on hs.id = h.skill_id where h.person_id = ps.person_id and h.active is distinct from false and h.level >= 2 and hs.area = a);
    select count(*)::integer into v_nd from kafaa_people st where st.kind = 'staff' and st.status = 'active' and st.job_role_id is not null and kafaa_so_role_needs(st.job_role_id, a);
    -- KLRA (F20): band-weighted departures of holders, latest assessment period, positions in id order
    v_kv := array_fill(0, array[20]);
    for pos in select kp.id, kp.contract_kind, kp.retirement_band, kp.contract_end_band, (select ka.total from kafaa_klra_assessments ka where ka.position_id = kp.id and ka.period = v_kperiod order by ka.id collate "C" desc limit 1) as total
        from kafaa_klra_positions kp
        where kp.active is distinct from false and kp.kind = 'staff' and kp.person_id is not null
          and exists (select 1 from kafaa_klra_assessments ka where ka.position_id = kp.id and ka.period = v_kperiod)
          and exists (select 1 from kafaa_person_skills h join kafaa_skills hs on hs.id = h.skill_id join kafaa_people st on st.id = h.person_id and st.kind = 'staff' and st.status = 'active'
                      where h.person_id = kp.person_id and h.active is distinct from false and h.level >= 2 and hs.area = a)
        order by kp.id collate "C" loop
      w := case when pos.total >= v_high then 10 when pos.total >= v_med then 7 else 4 end;
      dep := kafaa_so_departures(pos.contract_kind, pos.retirement_band, pos.contract_end_band, v_base);
      for i in 0 .. jsonb_array_length(dep) - 1 loop
        y := (dep->i->>0)::integer;
        v_kv[y - v_base] := v_kv[y - v_base] + w * (dep->i->>1)::integer;
      end loop;
    end loop;
    v_klra := '{}'::jsonb;
    for i in 1 .. 19 loop if v_kv[i] > 0 then v_klra := v_klra || jsonb_build_object((v_base + i)::text, v_kv[i]); end if; end loop;
    -- F22 cohorts for roles that need the family (latest plan period), at their ready year (never before base + 1)
    select coalesce(jsonb_object_agg(z.y::text, z.n), '{}'::jsonb) into v_cohort from (
      select greatest(v_base + 1, extract(year from c.ready_on)::integer) as y, sum(c.trainees)::integer as n
      from kafaa_handover_cohorts c where c.period = v_cperiod and kafaa_so_role_needs(c.role_id, a)
      group by 1) z;
    -- F22 external cover in roles that need the family, per year (last plan year repeats; the OSSA cut-off applies in the projection)
    v_cover := '{}'::jsonb;
    for y in v_base .. 2036 loop
      select coalesce(sum(c.cover_count), 0)::integer into n from kafaa_external_cover c
        join (select x.role_id, least(y, max(x.year)) as yy from kafaa_external_cover x where x.period = v_vperiod group by x.role_id) m on m.role_id = c.role_id and c.year = m.yy
        where c.period = v_vperiod and kafaa_so_role_needs(c.role_id, a);
      v_cover := v_cover || jsonb_build_object(y::text, n);
    end loop;
    v_lo := kafaa_so_role_needs('local-operator', a);
    select count(*)::integer, count(*) filter (where exists (select 1 from unnest(coalesce(sk.adv_skill_ids, '{}'::text[])) x join kafaa_adv_skills ad on ad.id = x
                                                           where v_tech is null or ad.tech_id = v_tech))::integer
      into v_t, v_m from kafaa_skills sk where sk.area = a and sk.fs_area is null; -- FS02: established catalogue only
    v_fams := v_fams || jsonb_build_array(jsonb_build_object('key', a, 'n_s', v_ns, 'n_d', v_nd, 'pool', v_pool, 'klra60', v_klra, 'cohort', v_cohort,
      'cover', v_cover, 'lo', v_lo, 'adv_m', v_m, 'adv_t', v_t));
  end loop;
  return jsonb_build_object('families', v_fams, 'adv_sum', (select coalesce(sum(value), 0) from kafaa_future_skills), 'adv_n', (select count(*)::integer from kafaa_future_skills),
    'org', coalesce(v_org, 0), 'staff', v_staff, 'scenario', v_sc);
end $$;
revoke execute on function kafaa_so_base(text) from public, anon, authenticated;
