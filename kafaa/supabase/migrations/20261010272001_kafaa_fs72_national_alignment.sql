-- [FS wave G · E2 · FS62 + FS63] National Alignment (M37): the national-strategy alignment layer and the MoHRE occupation and
-- skill-level mapping.
-- FS62: kafaa_national_tags (the six strategies the card names, with pillars, goals and the four Jahiz groups; EN/AR; sources with tiers,
--   the most official first; derivation rule) and kafaa_tag_links (curated links to skills, CleanEnergyComp competences, programmes,
--   pathways, credentials, talent and leadership programmes and targets; deactivated, never removed). Links derived from data are computed
--   at read time, never stored: Jahiz groups from kafaa_skills.future_group (FS02), Net Zero 2050 from kafaa_cec_competences.net_zero
--   (FS41). Reports are filters over the data: kafaa_na_report_core = nationalReport() in src/modules/m37/national.ts (items, live status,
--   reasons and, for national_alignment Agg/W/A, measures computed from the tables, every count under 10 suppressed); tag text carries
--   years only, never a typed number (kafaa_na_typed_free = typedTotalFree).
-- FS63: kafaa_role_occupations (the 28 current roles: occupation label EN/AR, indicative national skill level from the education rule,
--   a MoHRE code only when verified from an official UAE government source, else "code pending review"; concept roles get no row).
--   kafaa_ro_trend_core = occupationTrend() in src/modules/m37/occupations.ts (SIMULATED uplift trend, suppressed under 10).
--   Kafa'a is not a MoHRE system.
-- RPCs (TS + local + SQL SECURITY DEFINER + supabase map; authenticated only; the kafaa_na_* / kafaa_ro_* helpers executable by nobody):
--   kafaa_national_report(p_filter) (national_alignment R/Agg/W/A; measures for Agg/W/A; read-only), kafaa_save_national_tag(p) (W; ledger
--   when a tag is added or retired), kafaa_set_tag_link(p) (W; audited), kafaa_save_role_occupation(p) (W), kafaa_verify_occupation_code(p)
--   (A; never the last editor of the row; ledger), kafaa_clear_occupation_code(p_role_id, p_reason) (A; ledger), kafaa_occupation_trend()
--   (Agg/W/A). Policy resource national_alignment (FS01): all staff R, hr_analyst R/Agg, hr_director R/W, admin R/W/A; never public,
--   partners or observers.
-- Read-only reuse (never redefined here): kafaa_so_text_clean (= publicTextIsClean), kafaa_ai_rung (FS09), kafaa_cec_level (FS41).
-- PGlite parity and checks: scripts/validate/fs72-national-alignment.mjs. Tests: tests/unit/fs72-*.
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects; never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file; RLS in the per-statement (perf) form.

-- ───────────── Tables (generated DDL, additive)

-- M37 · National-strategy tag (NES 2031, We the UAE 2031, National AI Strategy 2031, Net Zero 2050, Jahiz groups, UAE Centennial 2071) with its pillars, goals or groups: EN/AR name and summary, horizon, sources with tiers (the most official first), derivation rule; never a typed total (FS62)
create table if not exists kafaa_national_tags (
  id text primary key,
  strategy text not null check (strategy in ('nes_2031', 'we_uae_2031', 'ai_2031', 'net_zero_2050', 'jahiz', 'centennial_2071')),
  parent_id text,
  kind text not null check (kind in ('strategy', 'pillar', 'goal', 'group')),
  code text not null unique,
  name_en text not null,
  name_ar text not null,
  summary_en text not null,
  summary_ar text not null,
  horizon_year integer,
  owner_en text,
  owner_ar text,
  sources jsonb not null default '[]'::jsonb,
  source_scope text not null default 'direct' check (source_scope in ('direct', 'indirect')),
  source_note_en text,
  source_note_ar text,
  derive text check (derive in ('future_group', 'cec_net_zero')),
  future_group text,
  status text not null default 'active' check (status in ('active', 'retired')),
  sort integer not null default 0,
  version integer not null default 1,
  benchmark_ids text[] not null default '{}'::text[],
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_by text,
  updated_at timestamptz not null default now()
);
comment on table kafaa_national_tags is '[M37] National-strategy tag (NES 2031, We the UAE 2031, National AI Strategy 2031, Net Zero 2050, Jahiz groups, UAE Centennial 2071) with its pillars, goals or groups: EN/AR name and summary, horizon, sources with tiers (the most official first), derivation rule; never a typed total (FS62)';

-- M37 · Curated link from a national tag to a skill, competence, programme, pathway, credential or target row, with an EN/AR note; deactivated, never removed (FS62). Jahiz-group and Net Zero links derived from data are computed, not stored
create table if not exists kafaa_tag_links (
  id text primary key,
  tag_id text not null,
  target_table text not null,
  target_id text not null,
  note_en text not null,
  note_ar text not null,
  active boolean not null default true,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_by text,
  updated_at timestamptz not null default now()
);
comment on table kafaa_tag_links is '[M37] Curated link from a national tag to a skill, competence, programme, pathway, credential or target row, with an EN/AR note; deactivated, never removed (FS62). Jahiz-group and Net Zero links derived from data are computed, not stored';

-- M37 · Current job role mapped to a national occupation label and indicative skill level (1-5); the MoHRE code is stored only when verified from an official source (else "code pending review"); Kafa'a is not a MoHRE system (FS63)
create table if not exists kafaa_role_occupations (
  id text primary key,
  role_id text not null unique,
  label_en text not null,
  label_ar text not null,
  mohre_code text,
  code_status text not null default 'pending_review' check (code_status in ('pending_review', 'verified')),
  code_source jsonb,
  verified_by text,
  verified_on date,
  skill_level integer not null,
  level_basis text not null default 'education_rule' check (level_basis in ('education_rule', 'reviewed')),
  education_basis text,
  rationale_en text,
  rationale_ar text,
  history jsonb not null default '[]'::jsonb,
  version integer not null default 1,
  updated_by text not null,
  updated_at timestamptz not null default now()
);
comment on table kafaa_role_occupations is '[M37] Current job role mapped to a national occupation label and indicative skill level (1-5); the MoHRE code is stored only when verified from an official source (else "code pending review"); Kafa''a is not a MoHRE system (FS63)';

do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_national_tags_parent_id_fk') then alter table kafaa_national_tags add constraint kafaa_national_tags_parent_id_fk foreign key (parent_id) references kafaa_national_tags(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_tag_links_tag_id_fk') then alter table kafaa_tag_links add constraint kafaa_tag_links_tag_id_fk foreign key (tag_id) references kafaa_national_tags(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_role_occupations_role_id_fk') then alter table kafaa_role_occupations add constraint kafaa_role_occupations_role_id_fk foreign key (role_id) references kafaa_job_roles(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_national_tags_strategy_idx on kafaa_national_tags (strategy);
create index if not exists kafaa_national_tags_parent_id_idx on kafaa_national_tags (parent_id);
create index if not exists kafaa_national_tags_status_idx on kafaa_national_tags (status);
create index if not exists kafaa_tag_links_tag_id_idx on kafaa_tag_links (tag_id);
create index if not exists kafaa_tag_links_target_table_idx on kafaa_tag_links (target_table);
create index if not exists kafaa_tag_links_target_id_idx on kafaa_tag_links (target_id);
create index if not exists kafaa_role_occupations_code_status_idx on kafaa_role_occupations (code_status);

-- one strategy-level tag per strategy and kind; a pillar, goal or group always has a parent; a code only when verified (FS63)
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_national_tags_parent_ck') then
  alter table kafaa_national_tags add constraint kafaa_national_tags_parent_ck check ((kind = 'strategy') = (parent_id is null)); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_role_occupations_level_ck') then
  alter table kafaa_role_occupations add constraint kafaa_role_occupations_level_ck check (skill_level between 1 and 5); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_role_occupations_code_ck') then
  alter table kafaa_role_occupations add constraint kafaa_role_occupations_code_ck check (
    (code_status = 'verified' and mohre_code is not null and code_source is not null and coalesce(code_source ->> 'url', '') like 'https://%'
      and verified_by is not null and verified_on is not null)
    or (code_status = 'pending_review' and mohre_code is null and code_source is null)); end if; end $$;
create unique index if not exists kafaa_tag_links_target_uq on kafaa_tag_links (tag_id, target_table, target_id);

-- concept roles get no occupation mapping (FS63 adjustment: map current roles only)
create or replace function kafaa_ro_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from kafaa_job_roles r where r.id = new.role_id and coalesce(r.lifecycle, 'current') <> 'current') then
    raise exception 'kafaa_fs63: concept roles get no occupation mapping (%)', new.role_id;
  end if;
  return new;
end $$;
do $$ begin if not exists (select 1 from pg_trigger where tgname = 'kafaa_ro_guard_trg') then
  create trigger kafaa_ro_guard_trg before insert or update on kafaa_role_occupations for each row execute function kafaa_ro_guard(); end if; end $$;

-- ───────────── RLS (per-statement form): national_alignment R/W/A reads (no person-level data); writes only via RPCs
alter table kafaa_national_tags enable row level security;
alter table kafaa_tag_links enable row level security;
alter table kafaa_role_occupations enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_national_tags' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_national_tags for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_tag_links' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_tag_links for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_role_occupations' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_role_occupations for select to anon, authenticated using (false)'; end if;
end $$;
alter policy kafaa_read on kafaa_national_tags using ((SELECT kafaa_has_grant('national_alignment'::text, ARRAY['R'::text, 'W'::text, 'A'::text])));
alter policy kafaa_read on kafaa_tag_links using ((SELECT kafaa_has_grant('national_alignment'::text, ARRAY['R'::text, 'W'::text, 'A'::text])));
alter policy kafaa_read on kafaa_role_occupations using ((SELECT kafaa_has_grant('national_alignment'::text, ARRAY['R'::text, 'W'::text, 'A'::text])));
revoke all on kafaa_national_tags, kafaa_tag_links, kafaa_role_occupations from anon, authenticated;
grant select on kafaa_national_tags, kafaa_tag_links, kafaa_role_occupations to anon, authenticated;

-- ═════════════ FS62 rules (mirror of src/modules/m37/national.ts). Internal: not executable by API roles.
create or replace function kafaa_na_host(p_url text) returns text language sql immutable set search_path = public as $$
  select coalesce(lower(substring(coalesce(p_url, '') from '^[Hh][Tt][Tt][Pp][Ss]://([^/:?#]+)')), '')
$$;
-- sourceTier(): official = a UAE government domain (u.ae, wam.ae, *.gov.ae); intergovernmental = UN / OECD bodies; else secondary
create or replace function kafaa_na_tier(p_url text) returns text language sql immutable set search_path = public as $$
  select case when h ~ '(^|\.)u\.ae$' or h ~ '(^|\.)wam\.ae$' or h ~ '(^|\.)gov\.ae$' then 'official'
    when h ~ '(^|\.)(un\.org|unescwa\.org|oecd\.org|unesco\.org|ilo\.org)$' then 'intergovernmental' else 'secondary' end
  from (select kafaa_na_host(p_url) as h) x
$$;
-- typedTotalFree(): years and the proper name 10X may appear, no other digit (ASCII word boundaries as lookarounds, like the TS rule)
create or replace function kafaa_na_typed_free(p text[]) returns boolean language sql immutable set search_path = public as $$
  select not exists (select 1 from unnest(coalesce(p, '{}'::text[])) x
    where regexp_replace(regexp_replace(coalesce(x, ''), '(?<![A-Za-z0-9_])10X(?![A-Za-z0-9_])', '', 'g'), '(?<![A-Za-z0-9_])(19|20)[0-9]{2}(?![A-Za-z0-9_])', '', 'g') ~ '[0-9٠-٩]')
$$;
-- a string field of p, trimmed, with a length in characters from lo to hi (non-strings count as empty)
create or replace function kafaa_na_len(p jsonb, k text, lo integer, hi integer) returns boolean language sql immutable set search_path = public as $$
  select char_length(btrim(case when jsonb_typeof(p -> k) = 'string' then p ->> k else '' end, E' \t\n\r')) between lo and hi
$$;
create or replace function kafaa_na_str(p jsonb, k text) returns text language sql immutable set search_path = public as $$
  select case when jsonb_typeof(p -> k) = 'string' then p ->> k else '' end
$$;
-- tagProblem(): first problem of a tag save (null = ok)
create or replace function kafaa_na_tag_problem(p jsonb, p_today date) returns text language plpgsql stable security definer set search_path = public as $$
declare v_parent text; par kafaa_national_tags; v_src jsonb; v_texts text[]; v_scope text; v_status text;
begin
  if jsonb_typeof(p -> 'strategy') is distinct from 'string' or not (p ->> 'strategy' = any (array['nes_2031', 'we_uae_2031', 'ai_2031', 'net_zero_2050', 'jahiz', 'centennial_2071'])) then return 'strategy'; end if;
  if jsonb_typeof(p -> 'kind') is distinct from 'string' or not (p ->> 'kind' = any (array['strategy', 'pillar', 'goal', 'group'])) then return 'kind'; end if;
  v_parent := nullif(btrim(kafaa_na_str(p, 'parent_id'), E' \t\n\r'), '');
  if p ->> 'kind' = 'strategy' then
    if v_parent is not null then return 'parent'; end if;
  else
    select * into par from kafaa_national_tags where id = v_parent;
    if par.id is null or par.kind <> 'strategy' or par.strategy <> p ->> 'strategy' or par.status <> 'active' or par.id = coalesce(p ->> 'id', '') then return 'parent'; end if;
  end if;
  if coalesce(p ->> 'code', '') !~ '^[A-Z0-9][A-Z0-9-]{1,23}$' then return 'code'; end if;
  if not kafaa_na_len(p, 'name_en', 2, 120) or not kafaa_na_len(p, 'name_ar', 2, 120) then return 'name'; end if;
  if not kafaa_na_len(p, 'summary_en', 20, 600) or not kafaa_na_len(p, 'summary_ar', 20, 600) then return 'summary'; end if;
  v_texts := array[p ->> 'name_en', p ->> 'name_ar', p ->> 'summary_en', p ->> 'summary_ar', coalesce(p ->> 'owner_en', ''), coalesce(p ->> 'owner_ar', ''),
    coalesce(p ->> 'source_note_en', ''), coalesce(p ->> 'source_note_ar', '')];
  if not kafaa_so_text_clean(v_texts) then return 'clean'; end if;
  if not kafaa_na_typed_free(v_texts) then return 'typed_total'; end if;
  v_src := case when jsonb_typeof(p -> 'sources') = 'array' then p -> 'sources' else '[]'::jsonb end;
  if jsonb_array_length(v_src) not between 1 and 5 or exists (select 1 from jsonb_array_elements(v_src) e where not (
      jsonb_typeof(e) = 'object' and kafaa_na_len(e, 'label', 3, 200) and coalesce(e ->> 'url', '') ~ '^https://\S+$'
      and coalesce(e ->> 'as_of', '') ~ '^\d{4}-\d{2}-\d{2}$' and e ->> 'as_of' <= to_char(p_today, 'YYYY-MM-DD'))) then return 'sources'; end if;
  if p -> 'horizon_year' is not null and jsonb_typeof(p -> 'horizon_year') <> 'null' then
    if jsonb_typeof(p -> 'horizon_year') <> 'number' or (p ->> 'horizon_year')::numeric % 1 <> 0 or (p ->> 'horizon_year')::numeric not between 2022 and 2100 then return 'horizon'; end if;
  end if;
  v_scope := case when p -> 'source_scope' is null or jsonb_typeof(p -> 'source_scope') = 'null' then 'direct' when jsonb_typeof(p -> 'source_scope') = 'string' then p ->> 'source_scope' else '?' end;
  if v_scope not in ('direct', 'indirect') then return 'scope'; end if;
  v_status := case when p -> 'status' is null or jsonb_typeof(p -> 'status') = 'null' then 'active' when jsonb_typeof(p -> 'status') = 'string' then p ->> 'status' else '?' end;
  if v_status not in ('active', 'retired') then return 'status'; end if;
  return null;
end $$;

-- targetView(): title, live status and area of a linked row
create or replace function kafaa_na_target(p_table text, p_id text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r record; v jsonb := jsonb_build_object('exists', false, 'title_en', p_id, 'title_ar', p_id, 'active', false, 'area', null);
begin
  if p_table = 'skills' then
    select * into r from kafaa_skills where id = p_id;
    if found then v := jsonb_build_object('exists', true, 'title_en', r.name_en, 'title_ar', r.name_ar, 'active', r.lifecycle is distinct from 'obsolete', 'area', r.area); end if;
  elsif p_table = 'cec_competences' then
    select * into r from kafaa_cec_competences where id = p_id;
    if found then v := jsonb_build_object('exists', true, 'title_en', r.code || ' ' || r.name_en, 'title_ar', r.code || ' ' || r.name_ar, 'active', coalesce(r.status, 'active') = 'active', 'area', null); end if;
  elsif p_table = 'programmes' then
    select * into r from kafaa_programmes where id = p_id;
    if found then v := jsonb_build_object('exists', true, 'title_en', r.name_en, 'title_ar', r.name_ar, 'active', true, 'area', null); end if;
  elsif p_table = 'pathways' then
    select * into r from kafaa_pathways where id = p_id;
    if found then v := jsonb_build_object('exists', true, 'title_en', r.title_en, 'title_ar', r.title_ar, 'active', r.status = 'published', 'area', null); end if;
  elsif p_table = 'microcred_defs' then
    select * into r from kafaa_microcred_defs where id = p_id;
    if found then v := jsonb_build_object('exists', true, 'title_en', r.code || ' ' || r.title_en, 'title_ar', r.code || ' ' || r.title_ar, 'active', r.status = 'current', 'area', null); end if;
  elsif p_table = 'talent_programmes' then
    select * into r from kafaa_talent_programmes where id = p_id;
    if found then v := jsonb_build_object('exists', true, 'title_en', r.name_en, 'title_ar', r.name_ar, 'active', true, 'area', null); end if;
  elsif p_table = 'leadership_programmes' then
    select * into r from kafaa_leadership_programmes where id = p_id;
    if found then v := jsonb_build_object('exists', true, 'title_en', r.title_en, 'title_ar', r.title_ar, 'active', true, 'area', null); end if;
  elsif p_table = 'critical_skills' then
    select c.status, c.skill_id, s.name_en, s.name_ar into r from kafaa_critical_skills c left join kafaa_skills s on s.id = c.skill_id where c.id = p_id;
    if found then v := jsonb_build_object('exists', true, 'title_en', 'Critical skill: ' || coalesce(r.name_en, r.skill_id), 'title_ar', 'مهارة حرجة: ' || coalesce(r.name_ar, r.skill_id),
      'active', r.status = 'active', 'area', null); end if;
  elsif p_table = 'ai_org_targets' then
    select * into r from kafaa_ai_org_targets where id = p_id;
    if found then v := case when r.metric = 'practitioner_or_above'
      then jsonb_build_object('exists', true, 'title_en', 'AI fluency target: Practitioner or above', 'title_ar', 'هدف الطلاقة في الذكاء الاصطناعي: ممارِس أو أعلى', 'active', true, 'area', null)
      else jsonb_build_object('exists', true, 'title_en', 'AI fluency target: above basic', 'title_ar', 'هدف الطلاقة في الذكاء الاصطناعي: فوق المستوى الأساسي', 'active', true, 'area', null) end; end if;
  elsif p_table = 'cec_role_targets' then
    select t.family_id, f.name_en, f.name_ar into r from kafaa_cec_role_targets t left join kafaa_job_families f on f.id = t.family_id where t.id = p_id;
    if found then v := jsonb_build_object('exists', true, 'title_en', 'CleanEnergyComp target: ' || coalesce(r.name_en, r.family_id), 'title_ar', 'هدف كفاءات الطاقة النظيفة: ' || coalesce(r.name_ar, r.family_id), 'active', true, 'area', null); end if;
  end if;
  return v;
end $$;

-- linkProblem(): first problem of a link save (null = ok)
create or replace function kafaa_na_link_problem(p jsonb, p_tag kafaa_national_tags, p_target jsonb, p_active boolean) returns text language plpgsql stable security definer set search_path = public as $$
declare v_table text := kafaa_na_str(p, 'target_table');
begin
  if p_tag.id is null or p_tag.status <> 'active' then return 'tag'; end if;
  if not (v_table = any (array['skills', 'cec_competences', 'programmes', 'pathways', 'microcred_defs', 'talent_programmes', 'leadership_programmes', 'critical_skills', 'ai_org_targets', 'cec_role_targets'])) then return 'table'; end if;
  if not (p_target ->> 'exists')::boolean then return 'target'; end if;
  if (p_tag.derive = 'future_group' and v_table = 'skills') or (p_tag.derive = 'cec_net_zero' and v_table = 'cec_competences') then return 'derived'; end if;
  if v_table = 'skills' and p_target ->> 'area' = 'security' then return 'security'; end if;
  if p_active and (not kafaa_na_len(p, 'note_en', 10, 300) or not kafaa_na_len(p, 'note_ar', 10, 300)) then return 'note'; end if;
  if not kafaa_so_text_clean(array[coalesce(p ->> 'note_en', ''), coalesce(p ->> 'note_ar', '')]) then return 'clean'; end if;
  if not kafaa_na_typed_free(array[coalesce(p ->> 'note_en', ''), coalesce(p ->> 'note_ar', '')]) then return 'typed_total'; end if;
  return null;
end $$;

-- effectiveLinks(): curated links on active tags plus links derived from data, one per tag, table and target (curated first)
create or replace function kafaa_na_links() returns jsonb language sql stable security definer set search_path = public as $$
  with t as (select * from kafaa_national_tags where status = 'active'),
  x as (
    select l.tag_id, l.target_table, l.target_id, 'curated'::text as basis, l.id as link_id, l.note_en, l.note_ar, 0 as b
      from kafaa_tag_links l join t on t.id = l.tag_id
      where l.active and l.target_table = any (array['skills', 'cec_competences', 'programmes', 'pathways', 'microcred_defs', 'talent_programmes', 'leadership_programmes', 'critical_skills', 'ai_org_targets', 'cec_role_targets'])
    union all
    select t.id, 'skills', s.id, 'future_group', null, null, null, 1 from t join kafaa_skills s on s.future_group = t.future_group
      where t.derive = 'future_group' and coalesce(t.future_group, '') <> '' and s.lifecycle is distinct from 'obsolete'
    union all
    select t.id, 'cec_competences', c.id, 'net_zero', null, null, null, 2 from t join kafaa_cec_competences c on c.net_zero and coalesce(c.status, 'active') = 'active'
      where t.derive = 'cec_net_zero'
  ),
  d as (select x.*, row_number() over (partition by tag_id, target_table, target_id order by b) as rn from x)
  select coalesce(jsonb_agg(jsonb_build_object('tag_id', tag_id, 'target_table', target_table, 'target_id', target_id, 'basis', basis, 'link_id', link_id, 'note_en', note_en, 'note_ar', note_ar)
    order by tag_id collate "C", array_position(array['skills', 'cec_competences', 'programmes', 'pathways', 'microcred_defs', 'talent_programmes', 'leadership_programmes', 'critical_skills', 'ai_org_targets', 'cec_role_targets'], target_table),
      target_id collate "C", b), '[]'::jsonb)
  from d where rn = 1
$$;

create or replace function kafaa_na_pct1(a integer, b integer) returns double precision language sql immutable set search_path = public as $$
  select (floor((2000 * a + b)::numeric / (2 * b)) / 10)::double precision
$$;
create or replace function kafaa_na_sup(n integer) returns integer language sql immutable set search_path = public as $$
  select case when n >= 10 then n end
$$;
-- distinct active staff with a counted state (verified, evidenced, validated) at p_min or above (at least 1) on any of the skills
create or replace function kafaa_na_holders(p_skills text[], p_min integer) returns integer language sql stable security definer set search_path = public as $$
  select count(distinct s.person_id)::integer from kafaa_person_skills s join kafaa_people p on p.id = s.person_id
  where s.active and p.kind = 'staff' and p.status = 'active' and s.basis in ('verified', 'evidenced', 'validated') and s.level >= greatest(1, p_min) and s.skill_id = any (coalesce(p_skills, '{}'::text[]))
$$;
-- measureOf(): the live measure of one linked row; every count under 10 suppressed
create or replace function kafaa_na_measure(p_table text, p_id text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_kind text; n integer := 0; v_base integer; v_target double precision; v_due text; r record;
begin
  v_kind := case p_table when 'skills' then 'holders' when 'cec_competences' then 'holders' when 'programmes' then 'completers' when 'pathways' then 'enrolled'
    when 'microcred_defs' then 'awarded' when 'talent_programmes' then 'applicants' when 'leadership_programmes' then 'participants' when 'critical_skills' then 'at_target'
    when 'ai_org_targets' then 'org_share' when 'cec_role_targets' then 'family_share' end;
  if v_kind is null then return null; end if;
  if p_table = 'skills' then n := kafaa_na_holders(array[p_id], 1);
  elsif p_table = 'cec_competences' then n := coalesce((select kafaa_na_holders(c.skill_ids, 1) from kafaa_cec_competences c where c.id = p_id), 0);
  elsif p_table = 'programmes' then
    select count(distinct x.pid)::integer into n from (
      select e.person_id as pid from kafaa_enrolments e join kafaa_courses c on c.id = e.course_id where c.programme_id = p_id and e.status = 'completed'
      union select tr.person_id from kafaa_training_records tr join kafaa_courses c on c.id = tr.course_id where c.programme_id = p_id and tr.result = 'passed') x
      join kafaa_people pp on pp.id = x.pid where pp.kind = 'staff' and pp.status = 'active';
  elsif p_table = 'pathways' then
    select count(distinct e.person_id)::integer into n from kafaa_pathway_enrolments e join kafaa_people pp on pp.id = e.person_id
      where e.pathway_id = p_id and e.status in ('active', 'completed') and pp.kind = 'staff' and pp.status = 'active';
  elsif p_table = 'microcred_defs' then
    select count(distinct a.person_id)::integer into n from kafaa_microcred_defs d join kafaa_microcred_awards a on a.def_code = d.code and a.status = 'awarded'
      join kafaa_people pp on pp.id = a.person_id where d.id = p_id and pp.kind = 'staff' and pp.status = 'active';
  elsif p_table = 'talent_programmes' then
    select count(distinct a.person_id)::integer into n from kafaa_applications a where a.programme_id = p_id;
  elsif p_table = 'leadership_programmes' then
    select count(distinct ln.person_id)::integer into n from kafaa_leadership_nominations ln join kafaa_people pp on pp.id = ln.person_id
      where ln.programme_id = p_id and ln.status in ('approved', 'completed') and pp.kind = 'staff' and pp.status = 'active';
  elsif p_table = 'critical_skills' then
    select * into r from kafaa_critical_skills where id = p_id;
    if found then
      return jsonb_build_object('kind', v_kind, 'n', kafaa_na_sup(kafaa_na_holders(array[r.skill_id], r.target_level)), 'base', null, 'pct', null, 'target', r.target_level, 'due_on', null);
    end if;
  elsif p_table = 'ai_org_targets' then
    select * into r from kafaa_ai_org_targets where id = p_id;
    if found then
      select count(*)::integer, count(*) filter (where (kafaa_ai_rung(pp.id) ->> 'rung')::integer >= 2)::integer into v_base, n
        from kafaa_people pp where pp.kind = 'staff' and pp.status = 'active';
      return jsonb_build_object('kind', v_kind, 'n', case when v_base >= 10 then kafaa_na_sup(n) end, 'base', kafaa_na_sup(v_base),
        'pct', case when v_base >= 10 and n >= 10 then kafaa_na_pct1(n, v_base) end, 'target', r.pct, 'due_on', to_char(r.due_on, 'YYYY-MM-DD'));
    end if;
  elsif p_table = 'cec_role_targets' then
    select * into r from kafaa_cec_role_targets where id = p_id;
    if found then
      if r.family_id = any (array['security', 'safeguards', 'cyber']) then
        return jsonb_build_object('kind', v_kind, 'n', null, 'base', null, 'pct', null, 'target', r.level, 'due_on', null);
      end if;
      select count(*)::integer, count(*) filter (where kafaa_cec_level(pp.id) >= r.level)::integer into v_base, n
        from kafaa_people pp where pp.kind = 'staff' and pp.status = 'active' and pp.job_family_id = r.family_id;
      return jsonb_build_object('kind', v_kind, 'n', case when v_base >= 10 then kafaa_na_sup(n) end, 'base', kafaa_na_sup(v_base),
        'pct', case when v_base >= 10 and n >= 10 then kafaa_na_pct1(n, v_base) end, 'target', r.level, 'due_on', null);
    end if;
  end if;
  return jsonb_build_object('kind', v_kind, 'n', kafaa_na_sup(n), 'base', null, 'pct', null, 'target', null, 'due_on', null);
end $$;

-- the Jahiz group name inside reasons (identical to JAHIZ_GROUP_NAME)
create or replace function kafaa_na_group_name(p_group text) returns jsonb language sql immutable set search_path = public as $$
  select case p_group
    when 'digital' then jsonb_build_object('en', 'Digital Skills', 'ar', 'المهارات الرقمية')
    when 'ten_x' then jsonb_build_object('en', '10X Skills', 'ar', 'مهارات 10X')
    when 'data_ai' then jsonb_build_object('en', 'Data & AI Skills', 'ar', 'مهارات البيانات والذكاء الاصطناعي')
    when 'new_economy' then jsonb_build_object('en', 'New Economy Skills', 'ar', 'مهارات الاقتصاد الجديد')
    else jsonb_build_object('en', coalesce(p_group, ''), 'ar', coalesce(p_group, '')) end
$$;

-- nationalReport(): the filtered report (scope: all tags, one strategy, or one tag and its children; optional item kind). Tags in scope with
-- item counts and, with measures, the people reached; items with title, live status, measure and reasons. Retired tags are left out.
create or replace function kafaa_na_report_core(p_filter jsonb, p_measures boolean) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_strategy text; v_tag kafaa_national_tags; v_kind text; v_filter jsonb; v_eff jsonb := kafaa_na_links(); v_tags jsonb; v_items jsonb;
  c_tables constant text[] := array['skills', 'cec_competences', 'programmes', 'pathways', 'microcred_defs', 'talent_programmes', 'leadership_programmes', 'critical_skills', 'ai_org_targets', 'cec_role_targets'];
  c_strat constant text[] := array['nes_2031', 'we_uae_2031', 'ai_2031', 'net_zero_2050', 'jahiz', 'centennial_2071'];
begin
  p_filter := coalesce(p_filter, '{}'::jsonb);
  v_strategy := case when jsonb_typeof(p_filter -> 'strategy') = 'string' and p_filter ->> 'strategy' = any (c_strat) then p_filter ->> 'strategy' end;
  if jsonb_typeof(p_filter -> 'tag_id') = 'string' then select * into v_tag from kafaa_national_tags where id = p_filter ->> 'tag_id'; end if;
  v_kind := case when jsonb_typeof(p_filter -> 'kind') = 'string' and p_filter ->> 'kind' in ('skill', 'programme', 'target') then p_filter ->> 'kind' end;
  if v_tag.id is not null then v_strategy := v_tag.strategy; end if;
  v_filter := jsonb_build_object('strategy', v_strategy, 'tag_id', v_tag.id, 'kind', v_kind);

  with t as (
    select t.id, t.strategy, t.parent_id, t.kind, t.name_en, t.name_ar, t.future_group,
      row_number() over (order by array_position(c_strat, t.strategy), coalesce(r.sort, t.sort), case when t.parent_id is not null then t.sort else -1 end, t.id collate "C") as ord
    from kafaa_national_tags t left join kafaa_national_tags r on r.id = t.parent_id where t.status = 'active'
  ),
  s as (select t.*, case when v_tag.id is not null then (t.id = v_tag.id or coalesce(t.parent_id = v_tag.id, false)) when v_strategy is not null then t.strategy = v_strategy else true end as in_scope from t),
  e as (
    select x ->> 'tag_id' as tag_id, x ->> 'target_table' as target_table, x ->> 'target_id' as target_id, x ->> 'basis' as basis, x ->> 'link_id' as link_id,
      x ->> 'note_en' as note_en, x ->> 'note_ar' as note_ar,
      case when x ->> 'target_table' in ('skills', 'cec_competences') then 'skill' when x ->> 'target_table' in ('critical_skills', 'ai_org_targets', 'cec_role_targets') then 'target' else 'programme' end as ikind
    from jsonb_array_elements(v_eff) x
  ),
  sm as (
    select s.ord, s.id, s.strategy, s.parent_id, s.kind,
      (select count(distinct (e.target_table, e.target_id)) from e where (e.tag_id = s.id or (s.kind = 'strategy' and e.tag_id in (select c.id from t c where c.parent_id = s.id))) and e.ikind = 'skill')::integer as n_skill,
      (select count(distinct (e.target_table, e.target_id)) from e where (e.tag_id = s.id or (s.kind = 'strategy' and e.tag_id in (select c.id from t c where c.parent_id = s.id))) and e.ikind = 'programme')::integer as n_prog,
      (select count(distinct (e.target_table, e.target_id)) from e where (e.tag_id = s.id or (s.kind = 'strategy' and e.tag_id in (select c.id from t c where c.parent_id = s.id))) and e.ikind = 'target')::integer as n_target,
      case when p_measures then kafaa_na_sup(kafaa_na_holders((
        select coalesce(array_agg(distinct k), '{}'::text[]) from (
          select e.target_id as k from e where (e.tag_id = s.id or (s.kind = 'strategy' and e.tag_id in (select c.id from t c where c.parent_id = s.id))) and e.target_table = 'skills'
          union select unnest(cc.skill_ids) from e join kafaa_cec_competences cc on cc.id = e.target_id
            where (e.tag_id = s.id or (s.kind = 'strategy' and e.tag_id in (select c.id from t c where c.parent_id = s.id))) and e.target_table = 'cec_competences') q), 1)) end as reach
    from s where s.in_scope
  )
  select coalesce(jsonb_agg(jsonb_build_object('tag_id', id, 'strategy', strategy, 'parent_id', parent_id, 'kind', kind, 'skills', n_skill, 'programmes', n_prog, 'targets', n_target, 'reach', reach) order by ord), '[]'::jsonb)
  into v_tags from sm;

  with t as (
    select t.id, t.strategy, t.parent_id, t.name_en, t.name_ar, t.future_group,
      row_number() over (order by array_position(c_strat, t.strategy), coalesce(r.sort, t.sort), case when t.parent_id is not null then t.sort else -1 end, t.id collate "C") as ord
    from kafaa_national_tags t left join kafaa_national_tags r on r.id = t.parent_id where t.status = 'active'
  ),
  s as (select t.* from t where case when v_tag.id is not null then (t.id = v_tag.id or coalesce(t.parent_id = v_tag.id, false)) when v_strategy is not null then t.strategy = v_strategy else true end),
  e as (
    select x ->> 'tag_id' as tag_id, x ->> 'target_table' as target_table, x ->> 'target_id' as target_id, x ->> 'basis' as basis, x ->> 'link_id' as link_id,
      x ->> 'note_en' as note_en, x ->> 'note_ar' as note_ar,
      case when x ->> 'target_table' in ('skills', 'cec_competences') then 'skill' when x ->> 'target_table' in ('critical_skills', 'ai_org_targets', 'cec_role_targets') then 'target' else 'programme' end as ikind
    from jsonb_array_elements(v_eff) x
  ),
  i as (
    select e.*, s.ord, s.strategy, s.name_en as tag_en, s.name_ar as tag_ar, s.future_group, tv.v,
      case when not (tv.v ->> 'exists')::boolean then 'missing' when (tv.v ->> 'active')::boolean then 'active' else 'inactive' end as status
    from e join s on s.id = e.tag_id cross join lateral (select kafaa_na_target(e.target_table, e.target_id) as v) tv
    where v_kind is null or e.ikind = v_kind
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'tag_id', tag_id, 'strategy', strategy, 'target_table', target_table, 'kind', ikind, 'target_id', target_id, 'basis', basis, 'link_id', link_id,
      'title_en', v ->> 'title_en', 'title_ar', v ->> 'title_ar', 'status', status, 'note_en', note_en, 'note_ar', note_ar,
      'measure', case when p_measures and (v ->> 'exists')::boolean then kafaa_na_measure(target_table, target_id) end,
      'reasons', case basis
          when 'curated' then jsonb_build_array(jsonb_build_object('code', 'na_curated', 'key', 'm37.reason.curated', 'vars', jsonb_build_object('tag', jsonb_build_object('en', tag_en, 'ar', tag_ar)),
            'ref', jsonb_build_object('table', 'tag_links', 'id', coalesce(link_id, ''))))
          when 'future_group' then jsonb_build_array(jsonb_build_object('code', 'na_future_group', 'key', 'm37.reason.futureGroup', 'vars', jsonb_build_object('group', kafaa_na_group_name(future_group)),
            'ref', jsonb_build_object('table', 'skills', 'id', target_id)))
          else jsonb_build_array(jsonb_build_object('code', 'na_net_zero', 'key', 'm37.reason.netZero', 'ref', jsonb_build_object('table', 'cec_competences', 'id', target_id))) end
        || case status when 'inactive' then jsonb_build_array(jsonb_build_object('code', 'na_inactive', 'key', 'm37.reason.inactive'))
          when 'missing' then jsonb_build_array(jsonb_build_object('code', 'na_missing', 'key', 'm37.reason.missing')) else '[]'::jsonb end)
    order by ord, array_position(array['skill', 'programme', 'target'], ikind), array_position(c_tables, target_table), target_id collate "C"), '[]'::jsonb)
  into v_items from i;

  return jsonb_build_object('filter', v_filter, 'measures', p_measures, 'tags', v_tags, 'items', v_items);
end $$;

-- ═════════════ FS63 rules (mirror of src/modules/m37/occupations.ts). Internal: not executable by API roles.
-- indicativeLevel(): Kafa'a's indicative rule (not MoHRE's): degree 1, diploma 2, secondary school 3
create or replace function kafaa_ro_indicative(p_education text) returns integer language sql immutable set search_path = public as $$
  select case p_education when 'doctorate' then 1 when 'master' then 1 when 'bachelor' then 1 when 'diploma' then 2 when 'high_school' then 3 end
$$;
-- occupationProblem(): first problem of a mapping save (null = ok)
create or replace function kafaa_ro_problem(p jsonb) returns text language plpgsql stable security definer set search_path = public as $$
declare r kafaa_job_roles; v_texts text[]; v_level integer; v_basis text;
begin
  select * into r from kafaa_job_roles where id = kafaa_na_str(p, 'role_id');
  if r.id is null then return 'role'; end if;
  if coalesce(r.lifecycle, 'current') <> 'current' then return 'concept'; end if;
  if not kafaa_na_len(p, 'label_en', 3, 120) or not kafaa_na_len(p, 'label_ar', 3, 120) then return 'label'; end if;
  v_texts := array[p ->> 'label_en', p ->> 'label_ar', coalesce(p ->> 'rationale_en', ''), coalesce(p ->> 'rationale_ar', '')];
  if not kafaa_so_text_clean(v_texts) or not kafaa_na_typed_free(v_texts) then return 'clean'; end if;
  if jsonb_typeof(p -> 'skill_level') is distinct from 'number' or (p ->> 'skill_level')::numeric % 1 <> 0 or (p ->> 'skill_level')::numeric not between 1 and 5 then return 'level'; end if;
  v_level := (p ->> 'skill_level')::integer;
  v_basis := kafaa_na_str(p, 'level_basis');
  if v_basis not in ('education_rule', 'reviewed') then return 'basis'; end if;
  if v_basis = 'education_rule' and v_level is distinct from kafaa_ro_indicative(r.education) then return 'basis'; end if;
  if v_basis = 'reviewed' and (not kafaa_na_len(p, 'rationale_en', 10, 400) or not kafaa_na_len(p, 'rationale_ar', 10, 400)) then return 'rationale'; end if;
  return null;
end $$;
-- codeProblem(): first problem of a code verification (null = ok); the source must be an official UAE government page
create or replace function kafaa_ro_code_problem(p jsonb, p_today date) returns text language sql immutable set search_path = public as $$
  select case
    when coalesce(p ->> 'code', '') !~ '^[0-9A-Z][0-9A-Z.-]{1,15}$' then 'code'
    when not kafaa_na_len(p, 'source_label', 3, 200) or coalesce(p ->> 'source_url', '') !~ '^https://\S+$' then 'source'
    when not (kafaa_na_host(p ->> 'source_url') ~ '(^|\.)u\.ae$' or kafaa_na_host(p ->> 'source_url') ~ '(^|\.)gov\.ae$') then 'host'
    when coalesce(p ->> 'source_as_of', '') !~ '^\d{4}-\d{2}-\d{2}$' or p ->> 'source_as_of' > to_char(p_today, 'YYYY-MM-DD') then 'date'
  end
$$;
-- occupationTrend(): SIMULATED uplift trend of the synthetic workforce; every count under 10 suppressed
create or replace function kafaa_ro_trend_core(p_today date) returns jsonb language sql stable security definer set search_path = public as $$
  with pop as (
    select p.hire_date as hired, o.skill_level as lvl from kafaa_people p join kafaa_role_occupations o on o.role_id = p.job_role_id
    where p.kind = 'staff' and p.status = 'active' and p.hire_date is not null
  ),
  y as (select g as yr, case when g = extract(year from p_today)::integer then p_today else make_date(g, 12, 31) end as yend
        from generate_series(2016, extract(year from p_today)::integer) g),
  a as (
    select y.yr, count(pop.lvl)::integer as total, count(pop.lvl) filter (where pop.lvl in (1, 2))::integer as upper, coalesce(sum(pop.lvl), 0)::integer as sm,
      count(pop.lvl) filter (where pop.lvl = 1)::integer as l1, count(pop.lvl) filter (where pop.lvl = 2)::integer as l2, count(pop.lvl) filter (where pop.lvl = 3)::integer as l3,
      count(pop.lvl) filter (where pop.lvl = 4)::integer as l4, count(pop.lvl) filter (where pop.lvl = 5)::integer as l5
    from y left join pop on pop.hired <= y.yend group by y.yr
  )
  select jsonb_build_object('simulated', true, 'min_group', 10, 'from', 2016, 'to', extract(year from p_today)::integer,
    'mapped_roles', (select count(distinct role_id)::integer from kafaa_role_occupations),
    'years', coalesce((select jsonb_agg(jsonb_build_object('year', yr,
      'total', case when total >= 10 then total end,
      'levels', jsonb_build_array(
        jsonb_build_object('level', 1, 'n', case when total >= 10 and l1 >= 10 then l1 end), jsonb_build_object('level', 2, 'n', case when total >= 10 and l2 >= 10 then l2 end),
        jsonb_build_object('level', 3, 'n', case when total >= 10 and l3 >= 10 then l3 end), jsonb_build_object('level', 4, 'n', case when total >= 10 and l4 >= 10 then l4 end),
        jsonb_build_object('level', 5, 'n', case when total >= 10 and l5 >= 10 then l5 end)),
      'upper_pct', case when total >= 10 and upper >= 10 then kafaa_na_pct1(upper, total) end,
      'mean', case when total >= 10 then (floor((200 * sm + total)::numeric / (2 * total)) / 100)::double precision end) order by yr) from a), '[]'::jsonb))
$$;

-- ═════════════ RPCs
-- FS62: the filtered report (national_alignment R/Agg/W/A; measures for Agg/W/A). Read-only, never audited; null without a grant.
create or replace function kafaa_national_report(p_filter jsonb default '{}'::jsonb) returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if kafaa_me() is null or not kafaa_has_grant('national_alignment', array['R', 'Agg', 'W', 'A']) then return null; end if;
  return kafaa_na_report_core(coalesce(p_filter, '{}'::jsonb), kafaa_has_grant('national_alignment', array['Agg', 'W', 'A']));
end $$;

-- FS62: add or edit a national tag (W: HR director, admin); ledger when a tag is added or retired
create or replace function kafaa_save_national_tag(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; v_given text; v_code text; v_id text; v_entity text; cur kafaa_national_tags; v_problem text; v_status text; v_version integer;
  v_parent text; v_src jsonb; v_ledger text; v_added boolean; v_retired boolean; a kafaa_audit_events; l integer;
begin
  v_given := case when jsonb_typeof(p -> 'id') = 'string' and p ->> 'id' <> '' then p ->> 'id' end;
  v_code := kafaa_na_str(p, 'code');
  v_id := coalesce(v_given, case when v_code <> '' then 'nt-' || lower(v_code) else '' end);
  v_entity := nullif(v_id, '');
  if me is null then return kafaa_refuse('national.tag.save', 'national_tags', v_entity, 'not_signed_in', 'Sign in to maintain national alignment'); end if;
  if not kafaa_has_grant('national_alignment', array['W', 'A']) then
    return kafaa_refuse('national.tag.save', 'national_tags', v_entity, 'forbidden', 'Only the HR director and platform admins maintain national tags'); end if;
  v_role := kafaa_acting_role('national_alignment', array['W', 'A']);
  select * into cur from kafaa_national_tags where id = v_id;
  if v_given is not null and cur.id is null then return kafaa_refuse('national.tag.save', 'national_tags', v_entity, 'not_found', 'National tag not found', v_role); end if;
  if v_given is null and cur.id is not null then return kafaa_refuse('national.tag.save', 'national_tags', v_entity, 'code_taken', 'This tag code is already used', v_role); end if;
  v_problem := kafaa_na_tag_problem(p, current_date);
  if v_problem is null and cur.id is not null and (cur.strategy <> p ->> 'strategy' or cur.kind <> p ->> 'kind') then v_problem := 'strategy'; end if;
  if v_problem is not null then
    return kafaa_refuse('national.tag.save', 'national_tags', v_entity, 'invalid', 'Check the tag: ' || case v_problem
      when 'strategy' then 'choose one of the six national strategies (the strategy and kind of a saved tag do not change)'
      when 'kind' then 'choose strategy, pillar, goal or group'
      when 'parent' then 'a pillar, goal or group sits under the active strategy-level tag of the same strategy'
      when 'code' then 'a code of 2 to 24 capital letters, digits or hyphens'
      when 'name' then 'a name of 2 to 120 characters in English and in Arabic'
      when 'summary' then 'a summary of 20 to 600 characters in English and in Arabic'
      when 'clean' then 'tag text may not state headcounts or site information'
      when 'typed_total' then 'tag text may name years but no typed number: reports compute every total from the data'
      when 'sources' then 'one to five sources, each with a label, an https link and an as-of date that is not in the future'
      when 'horizon' then 'a horizon year from 2022 to 2100'
      when 'scope' then 'the source scope is direct or indirect'
      else 'choose active or retired' end, v_role);
  end if;
  v_status := coalesce(case when jsonb_typeof(p -> 'status') = 'string' then p ->> 'status' end, 'active');
  if p ->> 'kind' = 'strategy' and v_status = 'active' and exists (select 1 from kafaa_national_tags t where t.id <> v_id and t.kind = 'strategy' and t.strategy = p ->> 'strategy' and t.status = 'active') then
    return kafaa_refuse('national.tag.save', 'national_tags', v_entity, 'conflict', 'This strategy already has its strategy-level tag', v_role); end if;
  if exists (select 1 from kafaa_national_tags t where t.id <> v_id and t.code = v_code) then
    return kafaa_refuse('national.tag.save', 'national_tags', v_entity, 'code_taken', 'This tag code is already used', v_role); end if;
  if cur.id is not null and v_status = 'retired' and cur.kind = 'strategy' and exists (select 1 from kafaa_national_tags t where t.parent_id = v_id and t.status = 'active') then
    return kafaa_refuse('national.tag.save', 'national_tags', v_entity, 'invalid', 'Check the tag: retire its pillars, goals or groups first', v_role); end if;
  v_version := coalesce(cur.version + 1, 1);
  v_parent := nullif(btrim(kafaa_na_str(p, 'parent_id'), E' \t\n\r'), '');
  v_src := (select jsonb_agg(jsonb_build_object('label', btrim(e ->> 'label', E' \t\n\r'), 'url', e -> 'url', 'as_of', e -> 'as_of', 'tier', kafaa_na_tier(e ->> 'url')) order by n)
            from jsonb_array_elements(p -> 'sources') with ordinality q(e, n));
  if cur.id is not null then
    update kafaa_national_tags set parent_id = v_parent, code = v_code, name_en = btrim(p ->> 'name_en', E' \t\n\r'), name_ar = btrim(p ->> 'name_ar', E' \t\n\r'),
      summary_en = btrim(p ->> 'summary_en', E' \t\n\r'), summary_ar = btrim(p ->> 'summary_ar', E' \t\n\r'),
      horizon_year = case when jsonb_typeof(p -> 'horizon_year') = 'number' then (p ->> 'horizon_year')::integer end,
      owner_en = nullif(btrim(kafaa_na_str(p, 'owner_en'), E' \t\n\r'), ''), owner_ar = nullif(btrim(kafaa_na_str(p, 'owner_ar'), E' \t\n\r'), ''), sources = v_src,
      source_scope = coalesce(case when jsonb_typeof(p -> 'source_scope') = 'string' then p ->> 'source_scope' end, 'direct'),
      source_note_en = nullif(btrim(kafaa_na_str(p, 'source_note_en'), E' \t\n\r'), ''), source_note_ar = nullif(btrim(kafaa_na_str(p, 'source_note_ar'), E' \t\n\r'), ''),
      status = v_status, version = v_version, updated_by = me, updated_at = now()
    where id = v_id;
  else
    insert into kafaa_national_tags (id, strategy, kind, parent_id, code, name_en, name_ar, summary_en, summary_ar, horizon_year, owner_en, owner_ar, sources, source_scope,
      source_note_en, source_note_ar, status, version, derive, future_group, sort, benchmark_ids, created_by, created_at, updated_by, updated_at)
    values (v_id, p ->> 'strategy', p ->> 'kind', v_parent, v_code, btrim(p ->> 'name_en', E' \t\n\r'), btrim(p ->> 'name_ar', E' \t\n\r'),
      btrim(p ->> 'summary_en', E' \t\n\r'), btrim(p ->> 'summary_ar', E' \t\n\r'), case when jsonb_typeof(p -> 'horizon_year') = 'number' then (p ->> 'horizon_year')::integer end,
      nullif(btrim(kafaa_na_str(p, 'owner_en'), E' \t\n\r'), ''), nullif(btrim(kafaa_na_str(p, 'owner_ar'), E' \t\n\r'), ''), v_src,
      coalesce(case when jsonb_typeof(p -> 'source_scope') = 'string' then p ->> 'source_scope' end, 'direct'),
      nullif(btrim(kafaa_na_str(p, 'source_note_en'), E' \t\n\r'), ''), nullif(btrim(kafaa_na_str(p, 'source_note_ar'), E' \t\n\r'), ''), v_status, 1, null, null,
      (select coalesce(max(t.sort), 0) + 1 from kafaa_national_tags t where t.parent_id is not distinct from v_parent), '{}'::text[], me, now(), me, now());
  end if;
  v_added := cur.id is null;
  v_retired := v_status = 'retired' and (cur.id is null or cur.status <> 'retired');
  v_ledger := case when v_added then 'kafaa.national.tag_add' when v_retired then 'kafaa.national.tag_retire' end;
  if v_ledger is not null then l := kafaa_ledger(v_ledger, 'National tag ' || case when v_added then 'added' else 'retired' end || ': ' || v_code); end if;
  a := kafaa_audit('national.tag.save', 'national_tags', v_id, 'ok', 'v' || v_version || ' ' || v_status || ' ' || v_code,
    case when v_ledger is null then 'not_applicable' when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when v_added then 'National tag added' else 'National tag saved' end, a, l, jsonb_build_object('id', v_id, 'version', v_version, 'status', v_status));
end $$;

-- FS62: link or unlink a row (W); derived links refused; unlinking deactivates; audited, no ledger
create or replace function kafaa_set_tag_link(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; v_tag_id text := kafaa_na_str(p, 'tag_id'); v_table text := kafaa_na_str(p, 'target_table'); v_target text := kafaa_na_str(p, 'target_id');
  v_id text; v_active boolean; tg kafaa_national_tags; v_problem text; cur kafaa_tag_links; a kafaa_audit_events;
begin
  v_id := 'tl:' || v_tag_id || ':' || v_table || ':' || v_target;
  if me is null then return kafaa_refuse('national.link.set', 'tag_links', v_id, 'not_signed_in', 'Sign in to maintain national alignment'); end if;
  if not kafaa_has_grant('national_alignment', array['W', 'A']) then
    return kafaa_refuse('national.link.set', 'tag_links', v_id, 'forbidden', 'Only the HR director and platform admins maintain national tags'); end if;
  v_role := kafaa_acting_role('national_alignment', array['W', 'A']);
  v_active := coalesce(p -> 'active' <> 'false'::jsonb, true);
  select * into tg from kafaa_national_tags where id = v_tag_id;
  v_problem := kafaa_na_link_problem(p, tg, kafaa_na_target(v_table, v_target), v_active);
  if v_problem is not null then
    return kafaa_refuse('national.link.set', 'tag_links', v_id, 'invalid', 'Check the link: ' || case v_problem
      when 'tag' then 'choose an active tag'
      when 'table' then 'choose a skill, competence, programme, pathway, credential or target'
      when 'target' then 'the linked row was not found'
      when 'derived' then 'this link is derived from the data (Jahiz group or Net Zero competence); change the data, not the tag'
      when 'security' then 'security skills stay at career-path level and are not tagged'
      when 'note' then 'a note of 10 to 300 characters in English and in Arabic'
      when 'clean' then 'link notes may not state headcounts or site information'
      else 'link notes may name years but no typed number' end, v_role);
  end if;
  select * into cur from kafaa_tag_links where id = v_id;
  if cur.id is null and not v_active then return kafaa_refuse('national.link.set', 'tag_links', v_id, 'not_found', 'Link not found', v_role); end if;
  if cur.id is not null then
    update kafaa_tag_links set note_en = case when v_active then btrim(p ->> 'note_en', E' \t\n\r') else note_en end,
      note_ar = case when v_active then btrim(p ->> 'note_ar', E' \t\n\r') else note_ar end, active = v_active, updated_by = me, updated_at = now() where id = v_id;
  else
    insert into kafaa_tag_links (id, tag_id, target_table, target_id, note_en, note_ar, active, created_by, created_at, updated_by, updated_at)
    values (v_id, v_tag_id, v_table, v_target, btrim(p ->> 'note_en', E' \t\n\r'), btrim(p ->> 'note_ar', E' \t\n\r'), true, me, now(), me, now());
  end if;
  a := kafaa_audit('national.link.set', 'tag_links', v_id, 'ok', case when v_active then 'link ' else 'unlink ' end || v_table || ':' || v_target, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when v_active then 'Link saved' else 'Link deactivated' end, a, null, jsonb_build_object('id', v_id, 'active', v_active));
end $$;

-- FS63: edit a current role's occupation label and indicative level (W)
create or replace function kafaa_save_role_occupation(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; v_role_id text := kafaa_na_str(p, 'role_id'); v_id text; v_problem text; cur kafaa_role_occupations; r kafaa_job_roles;
  v_version integer; v_reviewed boolean; v_entry jsonb; a kafaa_audit_events;
begin
  v_id := 'ro-' || v_role_id;
  if me is null then return kafaa_refuse('national.occupation.save', 'role_occupations', v_id, 'not_signed_in', 'Sign in to maintain occupation mappings'); end if;
  if not kafaa_has_grant('national_alignment', array['W', 'A']) then
    return kafaa_refuse('national.occupation.save', 'role_occupations', v_id, 'forbidden', 'Only the HR director and platform admins edit occupation mappings'); end if;
  v_role := kafaa_acting_role('national_alignment', array['W', 'A']);
  v_problem := kafaa_ro_problem(p);
  if v_problem is not null then
    return kafaa_refuse('national.occupation.save', 'role_occupations', v_id, 'invalid', 'Check the mapping: ' || case v_problem
      when 'role' then 'choose a current job role'
      when 'concept' then 'concept roles get no occupation code or level'
      when 'label' then 'an occupation label of 3 to 120 characters in English and in Arabic'
      when 'clean' then 'labels and rationales may not state numbers, headcounts or site information'
      when 'level' then 'a skill level from 1 to 5'
      when 'basis' then 'use the education-rule level, or choose "reviewed" with a rationale'
      else 'a reviewed level needs a rationale of 10 to 400 characters in English and in Arabic' end, v_role);
  end if;
  select * into r from kafaa_job_roles where id = v_role_id;
  select * into cur from kafaa_role_occupations where id = v_id;
  v_version := coalesce(cur.version + 1, 1);
  v_reviewed := p ->> 'level_basis' = 'reviewed';
  v_entry := jsonb_build_object('version', v_version, 'on', to_char(current_date, 'YYYY-MM-DD'), 'by', me, 'change', 'save', 'label_en', btrim(p ->> 'label_en', E' \t\n\r'),
    'skill_level', (p ->> 'skill_level')::integer, 'level_basis', p ->> 'level_basis');
  if cur.id is not null then
    update kafaa_role_occupations set label_en = btrim(p ->> 'label_en', E' \t\n\r'), label_ar = btrim(p ->> 'label_ar', E' \t\n\r'), skill_level = (p ->> 'skill_level')::integer,
      level_basis = p ->> 'level_basis', education_basis = r.education,
      rationale_en = case when v_reviewed then btrim(p ->> 'rationale_en', E' \t\n\r') end, rationale_ar = case when v_reviewed then btrim(p ->> 'rationale_ar', E' \t\n\r') end,
      history = coalesce(history, '[]'::jsonb) || jsonb_build_array(v_entry), version = v_version, updated_by = me, updated_at = now()
    where id = v_id;
  else
    insert into kafaa_role_occupations (id, role_id, label_en, label_ar, mohre_code, code_status, code_source, verified_by, verified_on, skill_level, level_basis, education_basis,
      rationale_en, rationale_ar, history, version, updated_by, updated_at)
    values (v_id, v_role_id, btrim(p ->> 'label_en', E' \t\n\r'), btrim(p ->> 'label_ar', E' \t\n\r'), null, 'pending_review', null, null, null, (p ->> 'skill_level')::integer,
      p ->> 'level_basis', r.education, case when v_reviewed then btrim(p ->> 'rationale_en', E' \t\n\r') end, case when v_reviewed then btrim(p ->> 'rationale_ar', E' \t\n\r') end,
      jsonb_build_array(v_entry), 1, me, now());
  end if;
  a := kafaa_audit('national.occupation.save', 'role_occupations', v_id, 'ok', 'v' || v_version || ' level ' || (p ->> 'skill_level') || ' ' || (p ->> 'level_basis'), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Occupation mapping saved', a, null, jsonb_build_object('id', v_id, 'version', v_version));
end $$;

-- FS63: record a verified MoHRE code with its official source (A: admin; never the last editor of the row); ledger
create or replace function kafaa_verify_occupation_code(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; v_role_id text := kafaa_na_str(p, 'role_id'); v_id text; cur kafaa_role_occupations; v_problem text; v_version integer; a kafaa_audit_events; l integer;
begin
  v_id := 'ro-' || v_role_id;
  if me is null then return kafaa_refuse('national.occupation.verify', 'role_occupations', v_id, 'not_signed_in', 'Sign in to maintain occupation mappings'); end if;
  if not kafaa_has_grant('national_alignment', array['A']) then
    return kafaa_refuse('national.occupation.verify', 'role_occupations', v_id, 'forbidden', 'Only a platform admin records or clears a verified MoHRE code'); end if;
  v_role := kafaa_acting_role('national_alignment', array['A']);
  select * into cur from kafaa_role_occupations where id = v_id;
  if cur.id is null then return kafaa_refuse('national.occupation.verify', 'role_occupations', v_id, 'not_found', 'Role mapping not found', v_role); end if;
  if cur.updated_by = me then return kafaa_refuse('national.occupation.verify', 'role_occupations', v_id, 'maker_checker', 'The person who last edited this mapping cannot verify its code', v_role); end if;
  v_problem := kafaa_ro_code_problem(p, current_date);
  if v_problem is not null then
    return kafaa_refuse('national.occupation.verify', 'role_occupations', v_id, 'invalid', 'Check the code: ' || case v_problem
      when 'code' then 'a code of 2 to 16 capital letters, digits, dots or hyphens, copied from the source'
      when 'source' then 'a source label and an https link'
      when 'host' then 'the source must be an official UAE government page (u.ae or a gov.ae domain)'
      else 'the date the source was read, not in the future' end, v_role);
  end if;
  v_version := cur.version + 1;
  update kafaa_role_occupations set mohre_code = p ->> 'code', code_status = 'verified',
    code_source = jsonb_build_object('label', btrim(p ->> 'source_label', E' \t\n\r'), 'url', p ->> 'source_url', 'as_of', p ->> 'source_as_of'),
    verified_by = me, verified_on = current_date, version = v_version,
    history = coalesce(history, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('version', v_version, 'on', to_char(current_date, 'YYYY-MM-DD'), 'by', me, 'change', 'verify', 'code', p ->> 'code'))
  where id = v_id;
  l := kafaa_ledger('kafaa.national.occupation_code_verify', 'MoHRE code verified for ' || v_role_id || ': ' || (p ->> 'code'));
  a := kafaa_audit('national.occupation.verify', 'role_occupations', v_id, 'ok', 'code ' || (p ->> 'code'), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'MoHRE code recorded as verified', a, l, jsonb_build_object('id', v_id, 'code', p ->> 'code'));
end $$;

-- FS63: return a code to "pending review" with a reason (A); ledger
create or replace function kafaa_clear_occupation_code(p_role_id text, p_reason text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_id text := 'ro-' || coalesce(p_role_id, ''); cur kafaa_role_occupations; v_why text := btrim(coalesce(p_reason, ''), E' \t\n\r');
  v_version integer; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('national.occupation.clear', 'role_occupations', v_id, 'not_signed_in', 'Sign in to maintain occupation mappings'); end if;
  if not kafaa_has_grant('national_alignment', array['A']) then
    return kafaa_refuse('national.occupation.clear', 'role_occupations', v_id, 'forbidden', 'Only a platform admin records or clears a verified MoHRE code'); end if;
  v_role := kafaa_acting_role('national_alignment', array['A']);
  select * into cur from kafaa_role_occupations where id = v_id;
  if cur.id is null then return kafaa_refuse('national.occupation.clear', 'role_occupations', v_id, 'not_found', 'Role mapping not found', v_role); end if;
  if cur.code_status <> 'verified' then return kafaa_refuse('national.occupation.clear', 'role_occupations', v_id, 'not_verified', 'This mapping has no verified code', v_role); end if;
  if char_length(v_why) not between 10 and 300 then return kafaa_refuse('national.occupation.clear', 'role_occupations', v_id, 'invalid', 'Give a reason of 10 to 300 characters', v_role); end if;
  v_version := cur.version + 1;
  update kafaa_role_occupations set mohre_code = null, code_status = 'pending_review', code_source = null, verified_by = null, verified_on = null, version = v_version,
    history = coalesce(history, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('version', v_version, 'on', to_char(current_date, 'YYYY-MM-DD'), 'by', me, 'change', 'clear', 'reason', v_why))
  where id = v_id;
  l := kafaa_ledger('kafaa.national.occupation_code_clear', 'MoHRE code cleared for ' || coalesce(p_role_id, ''));
  a := kafaa_audit('national.occupation.clear', 'role_occupations', v_id, 'ok', 'cleared: ' || v_why, case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Code returned to pending review', a, l, jsonb_build_object('id', v_id));
end $$;

-- FS63: the SIMULATED uplift trend (national_alignment Agg/W/A); null otherwise
create or replace function kafaa_occupation_trend() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if kafaa_me() is null or not kafaa_has_grant('national_alignment', array['Agg', 'W', 'A']) then return null; end if;
  return kafaa_ro_trend_core(current_date);
end $$;

-- ───────────── Grants: internal helpers are not executable by API roles; the seven RPCs only by signed-in users.
revoke all on function kafaa_ro_guard(), kafaa_na_host(text), kafaa_na_tier(text), kafaa_na_typed_free(text[]), kafaa_na_len(jsonb, text, integer, integer), kafaa_na_str(jsonb, text),
  kafaa_na_tag_problem(jsonb, date), kafaa_na_target(text, text), kafaa_na_link_problem(jsonb, kafaa_national_tags, jsonb, boolean), kafaa_na_links(), kafaa_na_pct1(integer, integer),
  kafaa_na_sup(integer), kafaa_na_holders(text[], integer), kafaa_na_measure(text, text), kafaa_na_group_name(text), kafaa_na_report_core(jsonb, boolean),
  kafaa_ro_indicative(text), kafaa_ro_problem(jsonb), kafaa_ro_code_problem(jsonb, date), kafaa_ro_trend_core(date) from public, anon, authenticated;
revoke all on function kafaa_national_report(jsonb), kafaa_save_national_tag(jsonb), kafaa_set_tag_link(jsonb), kafaa_save_role_occupation(jsonb), kafaa_verify_occupation_code(jsonb),
  kafaa_clear_occupation_code(text, text), kafaa_occupation_trend() from public, anon;
grant execute on function kafaa_national_report(jsonb), kafaa_save_national_tag(jsonb), kafaa_set_tag_link(jsonb), kafaa_save_role_occupation(jsonb), kafaa_verify_occupation_code(jsonb),
  kafaa_clear_occupation_code(text, text), kafaa_occupation_trend() to authenticated;
