-- FS wave C · E4 (branch fsCe4, module M02) · FS23 Behaviourally anchored descriptors and generic level attributes + FS24 Scale
-- mapping and an "Authority" recognition.
-- Tables: kafaa_level_attributes (public: SFIA 9 style generic attributes x the four Kafa'a levels), kafaa_skill_level_ranges (public:
-- the levels where each skill exists, its track and the published rationale), kafaa_skill_descriptors (published rows public; drafts
-- and archived rows for sat R/W/A and audit_log R; RPC writes only), kafaa_scale_maps (public: five external scales and the map from
-- each Kafa'a band, every row citing its source), kafaa_authority_recognitions (the person + recognition R/W/A; RPC writes only).
-- Rules (mirror of src/modules/m02/descriptors.ts and authority.ts; same codes in the same order, same messages):
--   kafaa_sd_check = checkDescriptor, kafaa_sd_range_check = checkRange, kafaa_sd_templated = isTemplated,
--   kafaa_ar_check_propose = checkPropose, kafaa_ar_check_decide = checkDecide.
-- RPCs: kafaa_save_descriptor, kafaa_set_level_range (frameworks W/A; audited, no ledger), kafaa_recognise_authority (propose by the
-- training manager or HR director; approve / not yet by the HR director, never the proposer; ledger on recognition and on withdrawing
-- a current one; never writes skill_evidence or person_skills: Authority is not a level), kafaa_authority_candidates (read).
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file, RLS in the per-statement form.
-- Seed rows: supabase/seed.sql (live: insert ... on conflict do nothing). LocalBackend mirror: src/modules/m02/backend/local.fs23.ts.
-- PGlite checks: scripts/validate/fs34-descriptors-scale.mjs.

-- ───────────── Tables (generated DDL)

-- M02 · Generic level attributes across all skills: essence, autonomy, influence, complexity, knowledge, behaviours (FS23, SFIA 9 style)
create table if not exists kafaa_level_attributes (
  id text primary key,
  level integer not null,
  attribute text not null check (attribute in ('essence', 'autonomy', 'influence', 'complexity', 'knowledge', 'behaviours')),
  name_en text not null,
  name_ar text not null,
  text_en text not null,
  text_ar text not null,
  sfia_levels text not null default '',
  sort integer not null default 0
);
comment on table kafaa_level_attributes is '[M02] Generic level attributes across all skills: essence, autonomy, influence, complexity, knowledge, behaviours (FS23, SFIA 9 style)';

-- M02 · The levels where each skill exists, its track (technical or behavioural) and the published rationale (FS23)
create table if not exists kafaa_skill_level_ranges (
  id text primary key,
  skill_id text not null unique,
  min_level integer not null default 1,
  max_level integer not null default 4,
  basis text not null default 'full' check (basis in ('full', 'licence_like', 'leading', 'not_operated', 'awareness_only', 'watch', 'declining')),
  track text not null default 'technical' check (track in ('technical', 'behavioural')),
  rationale_en text not null,
  rationale_ar text not null,
  version integer not null default 1,
  updated_by text,
  updated_at timestamptz not null default now()
);
comment on table kafaa_skill_level_ranges is '[M02] The levels where each skill exists, its track (technical or behavioural) and the published rationale (FS23)';

-- M02 · Per-skill level descriptors: essence and 2-4 observable indicators in EN and AR, with evidence modes (FS23)
create table if not exists kafaa_skill_descriptors (
  id text primary key,
  skill_id text not null,
  level integer not null,
  essence_en text not null,
  essence_ar text not null,
  indicators_en text[] not null default '{}'::text[],
  indicators_ar text[] not null default '{}'::text[],
  evidence_modes text[] not null default '{}'::text[],
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  listed boolean not null default false,
  version integer not null default 1,
  created_by text,
  created_at timestamptz not null default now(),
  updated_by text,
  updated_at timestamptz not null default now()
);
comment on table kafaa_skill_descriptors is '[M02] Per-skill level descriptors: essence and 2-4 observable indicators in EN and AR, with evidence modes (FS23)';

-- M02 · Published level map from the Kafa'a scale to SFIA, SkillsFuture, DigComp, UNESCO and NQF levels, with fit notes and sources (FS24)
create table if not exists kafaa_scale_maps (
  id text primary key,
  framework text not null,
  row_kind text not null check (row_kind in ('scale', 'map')),
  band text check (band in ('not_yet', 'l1', 'l2', 'l3', 'l4', 'authority')),
  levels jsonb not null default '[]'::jsonb,
  level_count integer,
  ext_from integer,
  ext_to integer,
  fit text check (fit in ('exact', 'close', 'loose', 'none')),
  label_en text not null default '',
  label_ar text not null default '',
  note_en text not null default '',
  note_ar text not null default '',
  source_url text not null,
  as_of date not null,
  benchmark_id text,
  sort integer not null default 0
);
comment on table kafaa_scale_maps is '[M02] Published level map from the Kafa''a scale to SFIA, SkillsFuture, DigComp, UNESCO and NQF levels, with fit notes and sources (FS24)';

-- M02 · Authority recognitions above Expert: panel, citation, maker-checker decision (recognised or not yet); never a fifth level (FS24)
create table if not exists kafaa_authority_recognitions (
  id text primary key,
  person_id text not null,
  person_name text not null default '',
  person_name_ar text not null default '',
  skill_id text not null,
  status text not null default 'proposed' check (status in ('proposed', 'recognised', 'not_yet', 'withdrawn')),
  panel text[] not null default '{}'::text[],
  citation_en text not null,
  citation_ar text not null,
  level_at_proposal integer not null default 4,
  basis_at_proposal text not null default '',
  proposed_by text not null,
  proposed_role text,
  proposed_on date not null,
  decided_by text,
  decided_role text,
  decided_on date,
  decision_note text,
  recognised_on date,
  review_due date,
  withdrawn_by text,
  withdrawn_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table kafaa_authority_recognitions is '[M02] Authority recognitions above Expert: panel, citation, maker-checker decision (recognised or not yet); never a fifth level (FS24)';

do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_level_ranges_skill_id_fk') then alter table kafaa_skill_level_ranges add constraint kafaa_skill_level_ranges_skill_id_fk foreign key (skill_id) references kafaa_skills(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_descriptors_skill_id_fk') then alter table kafaa_skill_descriptors add constraint kafaa_skill_descriptors_skill_id_fk foreign key (skill_id) references kafaa_skills(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_scale_maps_framework_fk') then alter table kafaa_scale_maps add constraint kafaa_scale_maps_framework_fk foreign key (framework) references kafaa_skill_frameworks(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_authority_recognitions_person_id_fk') then alter table kafaa_authority_recognitions add constraint kafaa_authority_recognitions_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_authority_recognitions_skill_id_fk') then alter table kafaa_authority_recognitions add constraint kafaa_authority_recognitions_skill_id_fk foreign key (skill_id) references kafaa_skills(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_level_attributes_level_idx on kafaa_level_attributes (level);
create index if not exists kafaa_skill_descriptors_skill_id_idx on kafaa_skill_descriptors (skill_id);
create index if not exists kafaa_skill_descriptors_status_idx on kafaa_skill_descriptors (status);
create index if not exists kafaa_scale_maps_framework_idx on kafaa_scale_maps (framework);
create index if not exists kafaa_authority_recognitions_person_id_idx on kafaa_authority_recognitions (person_id);
create index if not exists kafaa_authority_recognitions_skill_id_idx on kafaa_authority_recognitions (skill_id);
create index if not exists kafaa_authority_recognitions_status_idx on kafaa_authority_recognitions (status);

-- ───────────── RLS (per-statement form). Level attributes, level ranges and the scale map are public reference data; published
-- descriptors are public (listed), drafts and archived rows are read by sat R/W/A and audit_log R; Authority recognitions are read
-- by the person (own_profile Own) and by recognition R/W/A (assessors, the training manager, the HR director, auditors).
-- Writes only through the RPCs below.
alter table kafaa_level_attributes enable row level security;
alter table kafaa_skill_level_ranges enable row level security;
alter table kafaa_skill_descriptors enable row level security;
alter table kafaa_scale_maps enable row level security;
alter table kafaa_authority_recognitions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_level_attributes' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_level_attributes for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_skill_level_ranges' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_skill_level_ranges for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_skill_descriptors' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_skill_descriptors for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_scale_maps' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_scale_maps for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_authority_recognitions' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_authority_recognitions for select to anon, authenticated using (false)'; end if;
end $$;
alter policy kafaa_read on kafaa_level_attributes using ((SELECT kafaa_has_grant('public_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text])));
alter policy kafaa_read on kafaa_skill_level_ranges using ((SELECT kafaa_has_grant('public_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text])));
alter policy kafaa_read on kafaa_scale_maps using ((SELECT kafaa_has_grant('public_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text])));
alter policy kafaa_read on kafaa_skill_descriptors using (((COALESCE(listed, false) AND (SELECT kafaa_has_grant('public_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))) OR ((SELECT kafaa_has_grant('audit_log'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((SELECT kafaa_has_grant('sat'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))));
alter policy kafaa_read on kafaa_authority_recognitions using (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false)) OR ((SELECT kafaa_has_grant('recognition'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))));
revoke insert, update, delete on kafaa_level_attributes, kafaa_skill_level_ranges, kafaa_skill_descriptors, kafaa_scale_maps, kafaa_authority_recognitions from anon, authenticated;
grant select on kafaa_level_attributes, kafaa_skill_level_ranges, kafaa_skill_descriptors, kafaa_scale_maps, kafaa_authority_recognitions to anon, authenticated;

-- ───────────── Integrity: one descriptor per skill and level; listed follows the status; 2-4 indicators, as many in AR as in EN;
-- ranges inside 1-4; every scale-map row cites https; a recognition is decided by someone other than its proposer and is never a level.
create unique index if not exists kafaa_skill_descriptors_skill_level_uq on kafaa_skill_descriptors (skill_id, level);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_descriptors_shape_ck') then
    alter table kafaa_skill_descriptors add constraint kafaa_skill_descriptors_shape_ck check (level between 1 and 4 and listed = (status = 'published')
      and cardinality(indicators_en) between 2 and 4 and cardinality(indicators_ar) = cardinality(indicators_en)); end if;
  if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_level_ranges_bounds_ck') then
    alter table kafaa_skill_level_ranges add constraint kafaa_skill_level_ranges_bounds_ck check (min_level between 1 and 4 and max_level between 1 and 4 and min_level <= max_level); end if;
  if not exists (select 1 from pg_constraint where conname = 'kafaa_scale_maps_source_ck') then
    alter table kafaa_scale_maps add constraint kafaa_scale_maps_source_ck check (source_url ~ '^https://[^[:space:]/$.?#][^[:space:]]*$' and ((row_kind = 'map') = (band is not null))); end if;
  if not exists (select 1 from pg_constraint where conname = 'kafaa_authority_recognitions_mc_ck') then
    alter table kafaa_authority_recognitions add constraint kafaa_authority_recognitions_mc_ck check (level_at_proposal = 4
      and (decided_by is null or decided_by <> proposed_by) and (status <> 'recognised' or (decided_by is not null and recognised_on is not null and review_due is not null))); end if;
end $$;

-- ───────────── Internal helpers (not executable by API roles). Mirror of src/modules/m02/descriptors.ts and authority.ts.
create or replace function kafaa_sd_str(p jsonb, k text) returns text language sql immutable set search_path = public as $$
  select case when jsonb_typeof(p->k) = 'string' then btrim(p->>k, E' \t\r\n') else '' end
$$;
create or replace function kafaa_sd_is_int(v jsonb) returns boolean language sql immutable set search_path = public as $$
  select coalesce(jsonb_typeof(v), '') = 'number' and (v #>> '{}')::numeric = trunc((v #>> '{}')::numeric)
$$;
-- isTemplated(): the old template sentences (descriptors.ts TEMPLATE_PATTERNS), case-insensitive
create or replace function kafaa_sd_templated(t text) returns boolean language sql immutable set search_path = public as $$
  select exists (select 1 from unnest(array[
    '^explains the purpose and basic principles of', 'under supervision using approved procedures', 'independently and recognises when to stop and ask',
    '^coaches, trains and evaluates others in', '^(awareness|practitioner|independent|expert): ', ': part of ',
    '^يشرح الغرض والمبادئ الأساسية', 'تحت الإشراف باستخدام الإجراءات المعتمدة', 'باستقلالية ويعرف متى يتوقف ويسأل', '^يوجّه الآخرين ويدربهم ويقيّمهم',
    '^(إلمام|ممارس|مستقل|خبير): ']) pat where btrim(coalesce(t, ''), E' \t\r\n') ~* pat)
$$;
-- checkDescriptor(): 'ok' or the first failing code, in the TS order
create or replace function kafaa_sd_check(p jsonb) returns text language plpgsql stable security definer set search_path = public as $$
declare v_skill text := kafaa_sd_str(p, 'skill_id'); sk kafaa_skills; rg kafaa_skill_level_ranges; v_level int; een text := kafaa_sd_str(p, 'essence_en'); ear text := kafaa_sd_str(p, 'essence_ar');
  en jsonb := p->'indicators_en'; ar jsonb := p->'indicators_ar'; m jsonb := p->'evidence_modes'; x jsonb; v_in boolean;
begin
  select * into sk from kafaa_skills where id = v_skill;
  if sk.id is null then return 'skill_not_found'; end if;
  if sk.lifecycle = 'obsolete' then return 'obsolete'; end if;
  if not kafaa_sd_is_int(p->'level') or (p->>'level')::numeric < 1 or (p->>'level')::numeric > 4 then return 'level'; end if;
  v_level := (p->>'level')::numeric::int;
  if (sk.area = 'security' or coalesce(sk.fs_area, '') = 'cyber_hygiene') and v_level > 2 then return 'restricted'; end if;
  if een = '' or ear = '' or length(een) > 200 or length(ear) > 200 then return 'essence'; end if;
  if coalesce(jsonb_typeof(en), '') <> 'array' or coalesce(jsonb_typeof(ar), '') <> 'array' or jsonb_array_length(en) < 2 or jsonb_array_length(en) > 4
    or jsonb_array_length(ar) < 2 or jsonb_array_length(ar) > 4 then return 'count'; end if;
  if jsonb_array_length(en) <> jsonb_array_length(ar) then return 'mismatch'; end if;
  for x in select e.value from jsonb_array_elements(en || ar) with ordinality e(value, ord) order by e.ord loop
    if jsonb_typeof(x) <> 'string' or btrim(x #>> '{}', E' \t\r\n') = '' or length(btrim(x #>> '{}', E' \t\r\n')) > 220 then return 'indicator'; end if;
  end loop;
  if (select count(distinct lower(btrim(e #>> '{}', E' \t\r\n'))) from jsonb_array_elements(en) e) <> jsonb_array_length(en)
    or (select count(distinct lower(btrim(e #>> '{}', E' \t\r\n'))) from jsonb_array_elements(ar) e) <> jsonb_array_length(ar) then return 'duplicate'; end if;
  if kafaa_sd_templated(een) or kafaa_sd_templated(ear) or exists (select 1 from jsonb_array_elements(en || ar) e where kafaa_sd_templated(e #>> '{}')) then return 'template'; end if;
  if coalesce(jsonb_typeof(m), '') <> 'array' or jsonb_array_length(m) < 1 or jsonb_array_length(m) > 4
    or exists (select 1 from jsonb_array_elements(m) e where jsonb_typeof(e) <> 'string' or not ((e #>> '{}') = any(array['observation', 'simulator', 'jpm', 'records', 'work_product', 'interview', 'peer', 'sjt', 'attestation'])))
    or (select count(distinct e) from jsonb_array_elements(m) e) <> jsonb_array_length(m) then return 'mode'; end if;
  select * into rg from kafaa_skill_level_ranges where skill_id = v_skill;
  v_in := rg.id is not null and v_level between rg.min_level and rg.max_level;
  if v_in and not coalesce(p->'publish' = 'true'::jsonb, false) then return 'in_range'; end if;
  if not v_in and coalesce(p->'publish' = 'true'::jsonb, false) then return 'out_of_range'; end if;
  return 'ok';
end $$;
-- checkRange(): 'ok' or the first failing code, in the TS order. Levels = levels with any descriptor row (draft, published or archived).
create or replace function kafaa_sd_range_check(p jsonb) returns text language plpgsql stable security definer set search_path = public as $$
declare v_skill text := kafaa_sd_str(p, 'skill_id'); sk kafaa_skills; cur kafaa_skill_level_ranges; lo int; hi int; v_basis text := kafaa_sd_str(p, 'basis');
  ren text := kafaa_sd_str(p, 'rationale_en'); rar text := kafaa_sd_str(p, 'rationale_ar'); l int;
begin
  select * into sk from kafaa_skills where id = v_skill;
  if sk.id is null then return 'skill_not_found'; end if;
  if sk.lifecycle = 'obsolete' then return 'obsolete'; end if;
  if not kafaa_sd_is_int(p->'min_level') or not kafaa_sd_is_int(p->'max_level') then return 'range'; end if;
  lo := (p->>'min_level')::numeric::int; hi := (p->>'max_level')::numeric::int;
  if lo < 1 or hi > 4 or lo > hi then return 'range'; end if;
  if (sk.area = 'security' or coalesce(sk.fs_area, '') = 'cyber_hygiene') and hi > 2 then return 'restricted'; end if;
  if v_basis not in ('full', 'licence_like', 'leading', 'not_operated', 'awareness_only', 'watch', 'declining') then return 'basis'; end if;
  if length(ren) < 20 or length(rar) < 20 or length(ren) > 400 or length(rar) > 400 then return 'rationale'; end if;
  for l in lo..hi loop
    if not exists (select 1 from kafaa_skill_descriptors d where d.skill_id = v_skill and d.level = l) then return 'incomplete'; end if;
  end loop;
  select * into cur from kafaa_skill_level_ranges where skill_id = v_skill;
  if cur.id is not null and cur.min_level = lo and cur.max_level = hi and cur.basis = v_basis and btrim(cur.rationale_en, E' \t\r\n') = ren and btrim(cur.rationale_ar, E' \t\r\n') = rar then return 'no_change'; end if;
  return 'ok';
end $$;
create or replace function kafaa_sd_result_code(c text) returns text language sql immutable set search_path = public as $$
  select case c when 'skill_not_found' then 'not_found' when 'obsolete' then 'obsolete' when 'restricted' then 'restricted' when 'no_change' then 'no_change' when 'incomplete' then 'incomplete' else 'invalid' end
$$;
create or replace function kafaa_sd_message(c text) returns text language sql immutable set search_path = public as $$
  select case c
    when 'not_signed_in' then 'Sign in to edit level descriptors'
    when 'forbidden' then 'Only framework owners (instructors, the training manager and admins) edit level descriptors'
    when 'skill_not_found' then 'Skill not found'
    when 'obsolete' then 'This skill is obsolete: its descriptors stay readable but are no longer edited'
    when 'level' then 'Choose a level from 1 to 4'
    when 'restricted' then 'Security and cyber-hygiene skills stay at awareness levels (1-2) for all staff; deeper levels belong to security roles at career-path level only'
    when 'essence' then 'Give a level essence in English and Arabic (up to 200 characters each)'
    when 'count' then 'Give 2 to 4 observable indicators in each language'
    when 'mismatch' then 'Give the same number of indicators in English and Arabic'
    when 'indicator' then 'Each indicator is a non-empty sentence of up to 220 characters'
    when 'duplicate' then 'Each indicator must say something different'
    when 'template' then 'This reuses the old template sentence: describe what someone at this level is seen to do'
    when 'mode' then 'Choose 1 to 4 evidence modes from the list'
    when 'in_range' then 'This level is inside the skill''s range: its descriptor is always published'
    when 'out_of_range' then 'This level is outside the skill''s range: save it as a draft, then extend the range'
    when 'range' then 'Choose a range from level 1 to 4, lowest first'
    when 'basis' then 'Choose why the skill exists at these levels'
    when 'rationale' then 'Give the rationale in English and Arabic (20 to 400 characters each)'
    when 'incomplete' then 'Write a descriptor for every level in the new range first'
    when 'no_change' then 'Nothing changed'
    else c end
$$;

-- checkPropose(): 'ok' or the first failing code, in the TS order
create or replace function kafaa_ar_check_propose(p jsonb, p_me text) returns text language plpgsql stable security definer set search_path = public as $$
declare v_pid text := kafaa_sd_str(p, 'person_id'); v_sk text := kafaa_sd_str(p, 'skill_id'); pe kafaa_people; sk kafaa_skills; v_level int; v_panel jsonb := p->'panel';
  v_en text := kafaa_sd_str(p, 'citation_en'); v_ar text := kafaa_sd_str(p, 'citation_ar');
begin
  select * into pe from kafaa_people where id = v_pid;
  if pe.id is null or pe.kind <> 'staff' or pe.status <> 'active' then return 'person'; end if;
  if pe.id = p_me then return 'self'; end if;
  select * into sk from kafaa_skills where id = v_sk;
  if sk.id is null then return 'skill'; end if;
  if sk.area = 'security' or coalesce(sk.fs_area, '') = 'cyber_hygiene' then return 'restricted'; end if;
  if sk.lifecycle = 'obsolete' then return 'obsolete'; end if;
  select ps.level into v_level from kafaa_person_skills ps where ps.person_id = v_pid and ps.skill_id = v_sk and coalesce(ps.active, true) order by ps.id collate "C" limit 1;
  if coalesce(v_level, 0) <> 4 then return 'not_expert'; end if;
  if exists (select 1 from kafaa_authority_recognitions r where r.person_id = v_pid and r.skill_id = v_sk and r.status in ('proposed', 'recognised')) then return 'conflict'; end if;
  if coalesce(jsonb_typeof(v_panel), '') <> 'array' or jsonb_array_length(v_panel) < 3 or jsonb_array_length(v_panel) > 6
    or exists (select 1 from jsonb_array_elements(v_panel) e where jsonb_typeof(e) <> 'string' or not ((e #>> '{}') = any(array['hr_director', 'training_manager', 'line_manager', 'skill_owner', 'senior_instructor', 'external_peer'])))
    or (select count(distinct e) from jsonb_array_elements(v_panel) e) <> jsonb_array_length(v_panel) then return 'panel'; end if;
  if length(v_en) < 20 or length(v_ar) < 20 or length(v_en) > 400 or length(v_ar) > 400 then return 'citation'; end if;
  return 'ok';
end $$;
-- checkDecide(): approve / not_yet / withdraw on a row, in the TS order
create or replace function kafaa_ar_check_decide(p_action text, r kafaa_authority_recognitions, p_me text, p_decider boolean, p_note text) returns text language plpgsql immutable set search_path = public as $$
declare v_note text := btrim(coalesce(p_note, ''), E' \t\r\n');
begin
  if r.id is null then return 'not_found'; end if;
  if p_action = 'withdraw' then
    if r.status not in ('proposed', 'recognised') then return 'state'; end if;
    if not p_decider and not (r.status = 'proposed' and r.proposed_by = p_me) then return 'decider'; end if;
  else
    if r.status <> 'proposed' then return 'state'; end if;
    if not p_decider then return 'decider'; end if;
    if r.proposed_by = p_me then return 'maker_checker'; end if;
  end if;
  if (p_action <> 'approve' and length(v_note) < 10) or length(v_note) > 400 then return 'note'; end if;
  return 'ok';
end $$;
create or replace function kafaa_ar_result_code(c text) returns text language sql immutable set search_path = public as $$
  select case c when 'person' then 'invalid' when 'self' then 'maker_checker' when 'skill' then 'not_found' when 'restricted' then 'restricted' when 'obsolete' then 'obsolete'
    when 'not_expert' then 'not_eligible' when 'conflict' then 'conflict' when 'panel' then 'invalid' when 'citation' then 'invalid' when 'not_found' then 'not_found'
    when 'state' then 'invalid' when 'decider' then 'forbidden' when 'maker_checker' then 'maker_checker' when 'note' then 'invalid' else 'invalid' end
$$;
create or replace function kafaa_ar_message(c text) returns text language sql immutable set search_path = public as $$
  select case c
    when 'not_signed_in' then 'Sign in to work on Authority recognitions'
    when 'forbidden' then 'Authority recognitions are proposed by the training manager or the HR director and decided by the HR director'
    when 'action' then 'Choose propose, approve, not yet or withdraw'
    when 'person' then 'Choose an active member of staff'
    when 'self' then 'You cannot propose yourself'
    when 'skill' then 'Skill not found'
    when 'restricted' then 'Security and cyber-hygiene skills are not recognised individually: they follow the security career path'
    when 'obsolete' then 'This skill is obsolete'
    when 'not_expert' then 'Authority recognises people already at Expert (level 4) on the skill; it is never a fifth level'
    when 'conflict' then 'This person already has an open or current Authority recognition on this skill'
    when 'panel' then 'Name a panel of 3 to 6 different seats from the list'
    when 'citation' then 'Write the citation in English and Arabic (20 to 400 characters each)'
    when 'not_found' then 'Recognition not found'
    when 'state' then 'This recognition is not in a state that allows that action'
    when 'decider' then 'Only the HR director decides or withdraws an Authority recognition'
    when 'maker_checker' then 'The person who proposed it cannot decide it: a second approver is needed'
    when 'note' then 'Give a note of 10 to 400 characters (required for "not yet" and withdrawals)'
    else c end
$$;
-- Notification (kind skills), idempotent by id; row-audit quiet like the LocalBackend.
create or replace function kafaa_ar_notify(p_id text, p_person text, p_en text, p_ar text, p_link text, p_sev text) returns boolean language plpgsql security definer set search_path = public as $$
declare v_prev text := current_setting('kafaa.seeding', true); n integer;
begin
  if p_person is null or not exists (select 1 from kafaa_people where id = p_person) or exists (select 1 from kafaa_notifications where id = p_id) then return false; end if;
  perform set_config('kafaa.seeding', 'on', true);
  insert into kafaa_notifications (id, person_id, kind, title_en, title_ar, link, severity) values (p_id, p_person, 'skills', p_en, p_ar, p_link, p_sev) on conflict (id) do nothing;
  get diagnostics n = row_count;
  perform set_config('kafaa.seeding', coalesce(v_prev, ''), true);
  return n > 0;
end $$;

-- ───────────── RPC: FS23 save a descriptor (frameworks W/A). In-range levels are always published; out-of-range levels are drafts.
create or replace function kafaa_save_descriptor(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_sid text; v_c text; v_level int; v_id text; cur kafaa_skill_descriptors; v_status text; v_version int; a kafaa_audit_events;
  v_en text[]; v_ar text[]; v_modes text[];
begin
  p := coalesce(p, '{}'::jsonb);
  v_sid := kafaa_sd_str(p, 'skill_id');
  if me is null then return kafaa_refuse('skill_descriptor.save', 'skill_descriptors', nullif(v_sid, ''), 'not_signed_in', kafaa_sd_message('not_signed_in')); end if;
  if not kafaa_has_grant('frameworks', array['W', 'A']) then return kafaa_refuse('skill_descriptor.save', 'skill_descriptors', nullif(v_sid, ''), 'forbidden', kafaa_sd_message('forbidden')); end if;
  v_role := kafaa_acting_role('frameworks', array['W', 'A']);
  v_c := kafaa_sd_check(p);
  if v_c <> 'ok' then return kafaa_refuse('skill_descriptor.save', 'skill_descriptors', nullif(v_sid, ''), kafaa_sd_result_code(v_c), kafaa_sd_message(v_c), v_role); end if;
  v_level := (p->>'level')::numeric::int;
  v_id := 'sd:' || v_sid || ':' || v_level;
  select * into cur from kafaa_skill_descriptors where id = v_id;
  v_status := case when coalesce(p->'publish' = 'true'::jsonb, false) then 'published' else 'draft' end;
  v_version := coalesce(cur.version, 0) + 1;
  select coalesce(array_agg(btrim(e.value #>> '{}', E' \t\r\n') order by e.ord), '{}') into v_en from jsonb_array_elements(p->'indicators_en') with ordinality e(value, ord);
  select coalesce(array_agg(btrim(e.value #>> '{}', E' \t\r\n') order by e.ord), '{}') into v_ar from jsonb_array_elements(p->'indicators_ar') with ordinality e(value, ord);
  select coalesce(array_agg(e.value #>> '{}' order by e.ord), '{}') into v_modes from jsonb_array_elements(p->'evidence_modes') with ordinality e(value, ord);
  if cur.id is not null then
    update kafaa_skill_descriptors set essence_en = kafaa_sd_str(p, 'essence_en'), essence_ar = kafaa_sd_str(p, 'essence_ar'), indicators_en = v_en, indicators_ar = v_ar,
      evidence_modes = v_modes, status = v_status, listed = (v_status = 'published'), version = v_version, updated_by = me, updated_at = now()
    where id = v_id;
  else
    insert into kafaa_skill_descriptors (id, skill_id, level, essence_en, essence_ar, indicators_en, indicators_ar, evidence_modes, status, listed, version, created_by, created_at, updated_by, updated_at)
    values (v_id, v_sid, v_level, kafaa_sd_str(p, 'essence_en'), kafaa_sd_str(p, 'essence_ar'), v_en, v_ar, v_modes, v_status, v_status = 'published', v_version, me, now(), me, now());
  end if;
  a := kafaa_audit('skill_descriptor.save', 'skill_descriptors', v_id, 'ok', v_status || ' L' || v_level || ' v' || v_version, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Descriptor saved', a, null, jsonb_build_object('id', v_id, 'status', v_status, 'version', v_version));
end $$;

-- ───────────── RPC: FS23 set the levels where a skill exists (frameworks W/A). In-range rows are published, published rows outside are archived.
create or replace function kafaa_set_level_range(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_sid text; v_c text; lo int; hi int; cur kafaa_skill_level_ranges; d kafaa_skill_descriptors; n_pub int := 0; n_arc int := 0; v_version int; a kafaa_audit_events;
begin
  p := coalesce(p, '{}'::jsonb);
  v_sid := kafaa_sd_str(p, 'skill_id');
  if me is null then return kafaa_refuse('skill_level_range.set', 'skill_level_ranges', nullif(v_sid, ''), 'not_signed_in', kafaa_sd_message('not_signed_in')); end if;
  if not kafaa_has_grant('frameworks', array['W', 'A']) then return kafaa_refuse('skill_level_range.set', 'skill_level_ranges', nullif(v_sid, ''), 'forbidden', kafaa_sd_message('forbidden')); end if;
  v_role := kafaa_acting_role('frameworks', array['W', 'A']);
  v_c := kafaa_sd_range_check(p);
  if v_c <> 'ok' then return kafaa_refuse('skill_level_range.set', 'skill_level_ranges', nullif(v_sid, ''), kafaa_sd_result_code(v_c), kafaa_sd_message(v_c), v_role); end if;
  lo := (p->>'min_level')::numeric::int; hi := (p->>'max_level')::numeric::int;
  for d in select * from kafaa_skill_descriptors where skill_id = v_sid order by id collate "C" loop
    if d.level between lo and hi and d.status <> 'published' then
      update kafaa_skill_descriptors set status = 'published', listed = true, updated_by = me, updated_at = now() where id = d.id; n_pub := n_pub + 1;
    elsif not (d.level between lo and hi) and d.status = 'published' then
      update kafaa_skill_descriptors set status = 'archived', listed = false, updated_by = me, updated_at = now() where id = d.id; n_arc := n_arc + 1;
    end if;
  end loop;
  select * into cur from kafaa_skill_level_ranges where skill_id = v_sid;
  v_version := coalesce(cur.version, 0) + 1;
  if cur.id is not null then
    update kafaa_skill_level_ranges set min_level = lo, max_level = hi, basis = kafaa_sd_str(p, 'basis'), rationale_en = kafaa_sd_str(p, 'rationale_en'), rationale_ar = kafaa_sd_str(p, 'rationale_ar'),
      version = v_version, updated_by = me, updated_at = now() where id = cur.id;
  else
    insert into kafaa_skill_level_ranges (id, skill_id, min_level, max_level, basis, track, rationale_en, rationale_ar, version, updated_by, updated_at)
    values ('slr:' || v_sid, v_sid, lo, hi, kafaa_sd_str(p, 'basis'), 'technical', kafaa_sd_str(p, 'rationale_en'), kafaa_sd_str(p, 'rationale_ar'), v_version, me, now());
  end if;
  a := kafaa_audit('skill_level_range.set', 'skill_level_ranges', 'slr:' || v_sid, 'ok', 'L' || lo || '-L' || hi || ' ' || kafaa_sd_str(p, 'basis'), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Level range saved', a, null, jsonb_build_object('skill_id', v_sid, 'min_level', lo, 'max_level', hi, 'published', n_pub, 'archived', n_arc, 'version', v_version));
end $$;

-- ───────────── RPC: FS24 Authority recognition (propose / approve / not_yet / withdraw). Maker-checker; never writes a skill level.
create or replace function kafaa_recognise_authority(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_action text; v_a text; v_entity text; v_dec boolean; v_role text; v_c text; v_pid text; v_sk text; pe kafaa_people; sk kafaa_skills; ps kafaa_person_skills;
  r kafaa_authority_recognitions; v_id text; v_n int; v_note text; v_panel text[]; d text; l integer; a kafaa_audit_events; v_was boolean;
begin
  p := coalesce(p, '{}'::jsonb);
  v_action := kafaa_sd_str(p, 'action');
  v_a := 'authority.' || case when v_action in ('propose', 'approve', 'not_yet', 'withdraw') then v_action else 'invalid' end;
  v_entity := case when v_action = 'propose' then nullif(kafaa_sd_str(p, 'person_id'), '') else nullif(kafaa_sd_str(p, 'id'), '') end;
  if me is null then return kafaa_refuse(v_a, 'authority_recognitions', v_entity, 'not_signed_in', kafaa_ar_message('not_signed_in')); end if;
  if v_action not in ('propose', 'approve', 'not_yet', 'withdraw') then return kafaa_refuse(v_a, 'authority_recognitions', v_entity, 'invalid', kafaa_ar_message('action')); end if;
  if not kafaa_has_grant('recognition', array['A']) then return kafaa_refuse(v_a, 'authority_recognitions', v_entity, 'forbidden', kafaa_ar_message('forbidden')); end if;
  v_dec := kafaa_role_grant('hr_director', 'recognition', 'A');
  if v_action = 'propose' then
    v_role := case when v_dec then 'hr_director' when kafaa_role_grant('training_manager', 'recognition', 'A') then 'training_manager' else null end;
    if v_role is null then return kafaa_refuse(v_a, 'authority_recognitions', v_entity, 'forbidden', kafaa_ar_message('forbidden')); end if;
    v_c := kafaa_ar_check_propose(p, me);
    if v_c <> 'ok' then return kafaa_refuse(v_a, 'authority_recognitions', v_entity, kafaa_ar_result_code(v_c), kafaa_ar_message(v_c), v_role); end if;
    v_pid := kafaa_sd_str(p, 'person_id'); v_sk := kafaa_sd_str(p, 'skill_id');
    select * into pe from kafaa_people where id = v_pid;
    select * into sk from kafaa_skills where id = v_sk;
    select * into ps from kafaa_person_skills x where x.person_id = v_pid and x.skill_id = v_sk and coalesce(x.active, true) order by x.id collate "C" limit 1;
    select count(*) into v_n from kafaa_authority_recognitions where person_id = v_pid and skill_id = v_sk;
    v_id := 'ar:' || v_pid || ':' || v_sk || ':' || (v_n + 1);
    select coalesce(array_agg(e.value #>> '{}' order by e.ord), '{}') into v_panel from jsonb_array_elements(p->'panel') with ordinality e(value, ord);
    insert into kafaa_authority_recognitions (id, person_id, person_name, person_name_ar, skill_id, status, panel, citation_en, citation_ar, level_at_proposal, basis_at_proposal,
      proposed_by, proposed_role, proposed_on, created_at, updated_at)
    values (v_id, v_pid, coalesce(pe.display_name, ''), coalesce(nullif(pe.display_name_ar, ''), pe.display_name, ''), v_sk, 'proposed', v_panel, kafaa_sd_str(p, 'citation_en'), kafaa_sd_str(p, 'citation_ar'),
      4, coalesce(ps.basis, ''), me, v_role, current_date, now(), now());
    for d in select x.pid from (select distinct ra.person_id as pid from kafaa_role_assignments ra where ra.role = 'hr_director' and ra.status = 'active' and (ra.expires_at is null or ra.expires_at >= current_date)) x order by x.pid collate "C" loop
      if d <> me then perform kafaa_ar_notify('nt-ar-' || v_id || '-proposed-' || d, d, 'Authority recognition awaiting your decision: ' || sk.name_en, 'اعتراف بصفة مرجعية بانتظار قرارك: ' || sk.name_ar, '/admin/authority', 'info'); end if;
    end loop;
    a := kafaa_audit(v_a, 'authority_recognitions', v_id, 'ok', 'proposed ' || v_sk, 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Authority recognition proposed', a, null, jsonb_build_object('id', v_id, 'status', 'proposed'));
  end if;
  select * into r from kafaa_authority_recognitions where id = kafaa_sd_str(p, 'id');
  v_role := case when v_dec then 'hr_director' when r.id is not null and r.proposed_by = me then r.proposed_role else null end;
  v_c := kafaa_ar_check_decide(v_action, r, me, v_dec, kafaa_sd_str(p, 'note'));
  if v_c <> 'ok' then return kafaa_refuse(v_a, 'authority_recognitions', v_entity, kafaa_ar_result_code(v_c), kafaa_ar_message(v_c), v_role); end if;
  v_note := nullif(kafaa_sd_str(p, 'note'), '');
  select * into sk from kafaa_skills where id = r.skill_id;
  if v_action = 'approve' then
    update kafaa_authority_recognitions set status = 'recognised', decided_by = me, decided_role = v_role, decided_on = current_date, decision_note = v_note, recognised_on = current_date,
      review_due = (current_date + interval '3 years')::date, updated_at = now() where id = r.id;
    perform kafaa_ar_notify('nt-ar-' || r.id || '-recognised', r.person_id, 'Recognised as an Authority: ' || coalesce(sk.name_en, r.skill_id), 'اعتُرف بك مرجعاً في: ' || coalesce(sk.name_ar, r.skill_id), '/my/levels', 'ok');
    l := kafaa_ledger('kafaa.authority.recognise', format('Authority recognised above Expert (not a level): %s on %s; panel of %s; proposed by %s', r.person_id, r.skill_id, cardinality(r.panel), r.proposed_by));
    a := kafaa_audit(v_a, 'authority_recognitions', r.id, 'ok', 'recognised ' || r.skill_id, case when l is null then 'skipped' else 'written' end, l, v_role);
    return kafaa_result(true, 'ok', 'Authority recognised', a, l, jsonb_build_object('id', r.id, 'status', 'recognised'));
  end if;
  if v_action = 'not_yet' then
    update kafaa_authority_recognitions set status = 'not_yet', decided_by = me, decided_role = v_role, decided_on = current_date, decision_note = v_note, updated_at = now() where id = r.id;
    perform kafaa_ar_notify('nt-ar-' || r.id || '-not_yet', r.person_id, 'Authority panel outcome: not yet (' || coalesce(sk.name_en, r.skill_id) || ')', 'نتيجة لجنة الصفة المرجعية: ليس بعد (' || coalesce(sk.name_ar, r.skill_id) || ')', '/my/levels', 'info');
    a := kafaa_audit(v_a, 'authority_recognitions', r.id, 'ok', 'not yet ' || r.skill_id, 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Recorded as not yet', a, null, jsonb_build_object('id', r.id, 'status', 'not_yet'));
  end if;
  v_was := r.status = 'recognised';
  update kafaa_authority_recognitions set status = 'withdrawn', withdrawn_by = me, withdrawn_on = current_date, decision_note = v_note, updated_at = now() where id = r.id;
  if v_was then l := kafaa_ledger('kafaa.authority.withdraw', format('Authority recognition withdrawn: %s on %s', r.person_id, r.skill_id)); end if;
  a := kafaa_audit(v_a, 'authority_recognitions', r.id, 'ok', 'withdrawn ' || r.skill_id, case when not v_was then 'not_applicable' when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Recognition withdrawn', a, l, jsonb_build_object('id', r.id, 'status', 'withdrawn'));
end $$;

-- ───────────── Read RPC: FS24 Expert (level 4) holders the panel can consider (recognition R/W/A; else an empty list)
create or replace function kafaa_authority_candidates() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if kafaa_me() is null or not kafaa_has_grant('recognition', array['R', 'W', 'A']) then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('person_id', p.id, 'name_en', coalesce(p.display_name, p.id), 'name_ar', coalesce(nullif(p.display_name_ar, ''), p.display_name, p.id), 'job_role_id', p.job_role_id,
      'skill_id', s.id, 'basis', coalesce(ps.basis, ''), 'confidence', coalesce(ps.confidence, 0), 'recognition_id', rr.id, 'recognition_status', rr.status) order by s.id collate "C", p.id collate "C")
    from kafaa_person_skills ps
    join kafaa_skills s on s.id = ps.skill_id
    join kafaa_people p on p.id = ps.person_id
    left join lateral (
      select r.id, r.status from kafaa_authority_recognitions r where r.person_id = ps.person_id and r.skill_id = ps.skill_id
      order by (r.status in ('proposed', 'recognised')) desc, case when r.status in ('proposed', 'recognised') then r.id end collate "C" asc, r.id collate "C" desc limit 1
    ) rr on true
    where coalesce(ps.active, true) and ps.level = 4 and p.kind = 'staff' and p.status = 'active' and s.area <> 'security' and coalesce(s.fs_area, '') <> 'cyber_hygiene' and s.lifecycle <> 'obsolete'
  ), '[]'::jsonb);
end $$;

-- ───────────── Grants: internal helpers are not executable by API roles; RPCs only by signed-in users.
revoke all on function kafaa_sd_str(jsonb, text), kafaa_sd_is_int(jsonb), kafaa_sd_templated(text), kafaa_sd_check(jsonb), kafaa_sd_range_check(jsonb), kafaa_sd_result_code(text), kafaa_sd_message(text),
  kafaa_ar_check_propose(jsonb, text), kafaa_ar_check_decide(text, kafaa_authority_recognitions, text, boolean, text), kafaa_ar_result_code(text), kafaa_ar_message(text),
  kafaa_ar_notify(text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function kafaa_save_descriptor(jsonb), kafaa_set_level_range(jsonb), kafaa_recognise_authority(jsonb), kafaa_authority_candidates() from public, anon;
grant execute on function kafaa_save_descriptor(jsonb), kafaa_set_level_range(jsonb), kafaa_recognise_authority(jsonb), kafaa_authority_candidates() to authenticated;
