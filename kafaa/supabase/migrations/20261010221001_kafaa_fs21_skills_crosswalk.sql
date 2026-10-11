-- FS wave B · E1 (branch fsBe1, module M28) · FS07 Skills Catalogue Explorer + FS08 International crosswalk and framework export.
-- Tables: kafaa_skill_frameworks (public reference: the 11 external frameworks), kafaa_skill_alignments (the crosswalk: published rows
-- public, drafts and retired rows for framework owners, admins and auditors; RPC writes only), kafaa_skill_goals (own rows; FS07
-- "Add to my goals", hand-off to FS33).
-- Rules (mirror of src/modules/m28/crosswalk.ts checkAlignment / alResultCode and src/modules/m28/explorer.ts GOAL_MSG):
--   kafaa_al_check: the same checks in the same order with the same codes; external codes only in the framework's published format.
-- RPCs: kafaa_save_alignment (frameworks W/A; an edit bumps the version and clears the review), kafaa_review_alignment (maker-checker:
-- the reviewer is not the last editor), kafaa_retire_alignment (never deleted), kafaa_set_skill_goal (skills_profile Own). Each writes
-- one audit row (also on refusals); no NEXUS ledger rows.
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file, RLS in the per-statement form.

-- ───────────── Tables (generated DDL)
-- M28 · External skills frameworks the crosswalk aligns to: owner, version, code kind, level scale, source (FS08)
create table if not exists kafaa_skill_frameworks (
  id text primary key,
  short text not null,
  name_en text not null,
  name_ar text not null,
  owner_en text not null,
  owner_ar text not null,
  version_label text not null default '',
  kind text not null check (kind in ('skills', 'occupations', 'competences', 'qualifications', 'reference')),
  code_label_en text not null default '',
  code_label_ar text not null default '',
  codes_copied boolean not null default false,
  level_scale_en text not null default '',
  level_scale_ar text not null default '',
  scope_en text not null default '',
  scope_ar text not null default '',
  url text not null,
  benchmark_id text,
  as_of date not null,
  sort integer not null default 0
);
comment on table kafaa_skill_frameworks is '[M28] External skills frameworks the crosswalk aligns to: owner, version, code kind, level scale, source (FS08)';

-- M28 · Skill crosswalk: one external framework entry per row, match type, level map, source and review state (FS08)
create table if not exists kafaa_skill_alignments (
  id text primary key,
  skill_id text not null,
  framework text not null,
  external_code text,
  label_en text not null,
  label_ar text not null,
  label_ar_official boolean not null default false,
  external_meta jsonb not null default '{}'::jsonb,
  match_type text not null check (match_type in ('exact', 'close', 'broad', 'partial')),
  level_map jsonb not null default '{}'::jsonb,
  note_en text not null default '',
  note_ar text not null default '',
  source_url text not null,
  as_of date not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  listed boolean not null default false,
  reviewed_by text,
  reviewed_role text,
  reviewed_on date,
  retired_reason text,
  retired_on date,
  version integer not null default 1,
  created_by text,
  created_at timestamptz not null default now(),
  updated_by text,
  updated_at timestamptz not null default now(),
  sort integer not null default 0
);
comment on table kafaa_skill_alignments is '[M28] Skill crosswalk: one external framework entry per row, match type, level map, source and review state (FS08)';

-- M28 · Skills a person wants to grow, added from the skills explorer (FS07; hand-off to FS33)
create table if not exists kafaa_skill_goals (
  id text primary key,
  person_id text not null,
  skill_id text not null,
  target_level integer not null default 2,
  status text not null default 'active' check (status in ('active', 'removed')),
  source text not null default 'skills_explorer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table kafaa_skill_goals is '[M28] Skills a person wants to grow, added from the skills explorer (FS07; hand-off to FS33)';

do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_alignments_skill_id_fk') then alter table kafaa_skill_alignments add constraint kafaa_skill_alignments_skill_id_fk foreign key (skill_id) references kafaa_skills(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_alignments_framework_fk') then alter table kafaa_skill_alignments add constraint kafaa_skill_alignments_framework_fk foreign key (framework) references kafaa_skill_frameworks(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_goals_person_id_fk') then alter table kafaa_skill_goals add constraint kafaa_skill_goals_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_goals_skill_id_fk') then alter table kafaa_skill_goals add constraint kafaa_skill_goals_skill_id_fk foreign key (skill_id) references kafaa_skills(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_skill_frameworks_benchmark_id_idx on kafaa_skill_frameworks (benchmark_id);
create index if not exists kafaa_skill_alignments_skill_id_idx on kafaa_skill_alignments (skill_id);
create index if not exists kafaa_skill_alignments_framework_idx on kafaa_skill_alignments (framework);
create index if not exists kafaa_skill_alignments_match_type_idx on kafaa_skill_alignments (match_type);
create index if not exists kafaa_skill_alignments_status_idx on kafaa_skill_alignments (status);
create index if not exists kafaa_skill_goals_person_id_idx on kafaa_skill_goals (person_id);
create index if not exists kafaa_skill_goals_skill_id_idx on kafaa_skill_goals (skill_id);
create index if not exists kafaa_skill_goals_status_idx on kafaa_skill_goals (status);

-- ───────────── RLS (per-statement form): frameworks public; published alignments public, drafts/retired for sat R/W/A and audit_log R;
-- goals: own rows only. Writes only via the RPCs below.
alter table kafaa_skill_frameworks enable row level security;
alter table kafaa_skill_alignments enable row level security;
alter table kafaa_skill_goals enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_skill_frameworks' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_skill_frameworks for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_skill_alignments' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_skill_alignments for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_skill_goals' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_skill_goals for select to anon, authenticated using (false)'; end if;
end $$;
alter policy kafaa_read on kafaa_skill_frameworks using ((SELECT kafaa_has_grant('public_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text])));
alter policy kafaa_read on kafaa_skill_alignments using (((COALESCE(listed, false) AND (SELECT kafaa_has_grant('public_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))) OR ((SELECT kafaa_has_grant('audit_log'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((SELECT kafaa_has_grant('sat'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))));
alter policy kafaa_read on kafaa_skill_goals using (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false)));
revoke insert, update, delete on kafaa_skill_frameworks, kafaa_skill_alignments, kafaa_skill_goals from anon, authenticated;
grant select on kafaa_skill_frameworks, kafaa_skill_alignments, kafaa_skill_goals to anon, authenticated;

-- ───────────── Integrity: listed follows the status; a retired row has a reason; a published row cites https and an as-of date
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_alignments_listed_ck') then
  alter table kafaa_skill_alignments add constraint kafaa_skill_alignments_listed_ck check (listed = (status = 'published')); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_alignments_retired_ck') then
  alter table kafaa_skill_alignments add constraint kafaa_skill_alignments_retired_ck check (status <> 'retired' or (retired_reason is not null and retired_on is not null)); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_alignments_https_ck') then
  alter table kafaa_skill_alignments add constraint kafaa_skill_alignments_https_ck check (source_url ~ '^https://[^[:space:]/$.?#][^[:space:]]*$'); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_goals_level_ck') then
  alter table kafaa_skill_goals add constraint kafaa_skill_goals_level_ck check (target_level between 1 and 4); end if; end $$;

-- ───────────── Internal helpers (not executable by API roles). Mirror of src/modules/m28/crosswalk.ts.
create or replace function kafaa_al_str(p jsonb, k text) returns text language sql immutable set search_path = public as $$
  select case when jsonb_typeof(p->k) = 'string' then btrim(p->>k, E' \t\r\n') else '' end
$$;
create or replace function kafaa_al_is_date(v text) returns boolean language plpgsql immutable set search_path = public as $$
begin
  if v is null or v !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
  return to_char(v::date, 'YYYY-MM-DD') = v;
exception when others then return false;
end $$;
-- validLevelMap(): null / absent / {} ok; else keys among "1".."4", values non-empty strings of at most 40 characters (trimmed)
create or replace function kafaa_al_valid_level_map(m jsonb) returns boolean language plpgsql immutable set search_path = public as $$
declare e record;
begin
  if m is null or jsonb_typeof(m) = 'null' then return true; end if;
  if jsonb_typeof(m) <> 'object' then return false; end if;
  for e in select key, value from jsonb_each(m) loop
    if e.key not in ('1', '2', '3', '4') then return false; end if;
    if jsonb_typeof(e.value) <> 'string' then return false; end if;
    if btrim(e.value #>> '{}', E' \t\r\n') = '' or length(btrim(e.value #>> '{}', E' \t\r\n')) > 40 then return false; end if;
  end loop;
  return true;
end $$;
create or replace function kafaa_al_canon_level_map(m jsonb) returns jsonb language sql immutable set search_path = public as $$
  select coalesce(jsonb_object_agg(k, btrim(m->>k, E' \t\r\n') order by k), '{}'::jsonb)
  from unnest(array['1', '2', '3', '4']) k
  where m is not null and jsonb_typeof(m) = 'object' and jsonb_typeof(m->k) = 'string' and btrim(m->>k, E' \t\r\n') <> ''
$$;
create or replace function kafaa_al_code_ok(p_fw text, p_code text) returns boolean language sql immutable set search_path = public as $$
  select coalesce(btrim(p_code, E' \t\r\n'), '') = '' or btrim(p_code, E' \t\r\n') ~ (case p_fw
    when 'esco' then '^http://data\.europa\.eu/esco/skill/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    when 'onet' then '^[1-7]\.[A-Z](\.[0-9a-z]+){0,3}$'
    when 'sfia9' then '^[A-Z]{4}$'
    when 'digcomp' then '^[1-5]\.[1-6]$'
    else '^[A-Za-z0-9.:/_-]{1,64}$' end)
$$;
create or replace function kafaa_al_dup_key(p_skill text, p_fw text, p_code text, p_label text) returns text language sql immutable set search_path = public as $$
  select p_skill || '|' || p_fw || '|' || case when coalesce(btrim(p_code, E' \t\r\n'), '') <> '' then btrim(p_code, E' \t\r\n') else 'label:' || lower(btrim(coalesce(p_label, ''), E' \t\r\n')) end
$$;
-- checkAlignment(): 'ok' or the first failing code, in the TS order. p_existing is the stored row when the input edits one.
create or replace function kafaa_al_check(p jsonb, p_existing kafaa_skill_alignments) returns text language plpgsql stable security definer set search_path = public as $$
declare v_skill text := kafaa_al_str(p, 'skill_id'); v_fw text := kafaa_al_str(p, 'framework'); sk kafaa_skills; v_en text := kafaa_al_str(p, 'label_en'); v_ar text := kafaa_al_str(p, 'label_ar');
  v_asof text := kafaa_al_str(p, 'as_of'); v_code text := kafaa_al_str(p, 'external_code'); v_id text := kafaa_al_str(p, 'id');
begin
  if p_existing.id is not null then
    if p_existing.status = 'retired' then return 'retired'; end if;
    if v_skill <> p_existing.skill_id or v_fw <> p_existing.framework then return 'immutable'; end if;
  end if;
  select * into sk from kafaa_skills where id = v_skill;
  if sk.id is null then return 'skill_not_found'; end if;
  if p_existing.id is null and sk.lifecycle = 'obsolete' then return 'obsolete'; end if;
  if not exists (select 1 from kafaa_skill_frameworks f where f.id = v_fw) then return 'framework'; end if;
  if v_en = '' or v_ar = '' or length(v_en) > 200 or length(v_ar) > 200 then return 'label'; end if;
  if kafaa_al_str(p, 'match_type') not in ('exact', 'close', 'broad', 'partial') then return 'match'; end if;
  if not kafaa_al_code_ok(v_fw, v_code) then return 'code'; end if;
  if kafaa_al_str(p, 'source_url') !~ '^https://[^[:space:]/$.?#][^[:space:]]*$' then return 'url'; end if;
  if not kafaa_al_is_date(v_asof) or v_asof > to_char(current_date, 'YYYY-MM-DD') or v_asof < '2000-01-01' then return 'as_of'; end if;
  if not kafaa_al_valid_level_map(p->'level_map') then return 'level_map'; end if;
  if length(kafaa_al_str(p, 'note_en')) > 500 or length(kafaa_al_str(p, 'note_ar')) > 500 then return 'note'; end if;
  if exists (select 1 from kafaa_skill_alignments r where r.status <> 'retired' and r.id <> v_id
      and kafaa_al_dup_key(r.skill_id, r.framework, r.external_code, r.label_en) = kafaa_al_dup_key(v_skill, v_fw, v_code, v_en)) then return 'duplicate'; end if;
  return 'ok';
end $$;
create or replace function kafaa_al_result_code(c text) returns text language sql immutable set search_path = public as $$
  select case c when 'skill_not_found' then 'not_found' when 'duplicate' then 'conflict' when 'retired' then 'retired' when 'obsolete' then 'obsolete' else 'invalid' end
$$;
create or replace function kafaa_al_message(c text) returns text language sql immutable set search_path = public as $$
  select case c
    when 'not_signed_in' then 'Sign in to edit the skills crosswalk'
    when 'forbidden' then 'Only framework owners (instructors, the training manager and admins) edit the skills crosswalk'
    when 'not_found' then 'Alignment not found'
    when 'skill_not_found' then 'Skill not found'
    when 'obsolete' then 'This skill is obsolete: keep its existing alignments, but do not add new ones'
    when 'framework' then 'Choose one of the listed frameworks'
    when 'label' then 'Give the external label in English and Arabic (up to 200 characters each)'
    when 'match' then 'Choose a match type: exact, close, broad or partial'
    when 'code' then 'This code does not have the format the framework publishes. Leave it empty if you have not copied it from the source'
    when 'url' then 'Cite the source with an https link'
    when 'as_of' then 'Give the date you read the source (not in the future)'
    when 'level_map' then 'The level map takes Kafa''a levels 1 to 4, each with a short external level (up to 40 characters)'
    when 'note' then 'Keep notes under 500 characters'
    when 'duplicate' then 'This skill already has an active alignment to that framework entry'
    when 'immutable' then 'The skill and framework of an alignment cannot change: retire it and add a new one'
    when 'retired' then 'This alignment is retired: add a new one instead'
    when 'not_published' then 'Publish the alignment before it is reviewed'
    when 'already_reviewed' then 'This alignment is already reviewed'
    when 'maker_checker' then 'A reviewer cannot review their own edit: ask another framework owner'
    when 'reason' then 'Give a reason of 5 to 300 characters'
    else c end
$$;

-- ───────────── RPC: create or edit an alignment (frameworks W/A). An edit bumps the version and clears the review (indicative again).
create or replace function kafaa_save_alignment(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_id text := kafaa_al_str(coalesce(p, '{}'::jsonb), 'id'); cur kafaa_skill_alignments; v_c text; v_pub boolean;
  v_status text; v_version int := 1; v_new text; v_skill text; v_fw text; v_sort int; a kafaa_audit_events;
begin
  p := coalesce(p, '{}'::jsonb);
  if me is null then return kafaa_refuse('skill_alignment.save', 'skill_alignments', nullif(v_id, ''), 'not_signed_in', kafaa_al_message('not_signed_in')); end if;
  if not kafaa_has_grant('frameworks', array['W', 'A']) then return kafaa_refuse('skill_alignment.save', 'skill_alignments', nullif(v_id, ''), 'forbidden', kafaa_al_message('forbidden')); end if;
  v_role := kafaa_acting_role('frameworks', array['W', 'A']);
  if v_id <> '' then
    select * into cur from kafaa_skill_alignments where id = v_id;
    if cur.id is null then return kafaa_refuse('skill_alignment.save', 'skill_alignments', v_id, 'not_found', kafaa_al_message('not_found'), v_role); end if;
  end if;
  v_c := kafaa_al_check(p, cur);
  if v_c <> 'ok' then return kafaa_refuse('skill_alignment.save', 'skill_alignments', nullif(v_id, ''), kafaa_al_result_code(v_c), kafaa_al_message(v_c), v_role); end if;
  v_pub := coalesce(p->'publish' = 'true'::jsonb, false);
  v_status := case when v_pub then 'published' else 'draft' end;
  if cur.id is not null then
    v_version := coalesce(cur.version, 1) + 1;
    v_new := v_id;
    update kafaa_skill_alignments set external_code = nullif(kafaa_al_str(p, 'external_code'), ''), label_en = kafaa_al_str(p, 'label_en'), label_ar = kafaa_al_str(p, 'label_ar'),
      label_ar_official = coalesce(p->'label_ar_official' = 'true'::jsonb, false), match_type = kafaa_al_str(p, 'match_type'), level_map = kafaa_al_canon_level_map(p->'level_map'),
      note_en = kafaa_al_str(p, 'note_en'), note_ar = kafaa_al_str(p, 'note_ar'), source_url = kafaa_al_str(p, 'source_url'), as_of = kafaa_al_str(p, 'as_of')::date,
      status = v_status, listed = v_pub, reviewed_by = null, reviewed_role = null, reviewed_on = null, version = v_version, updated_by = me, updated_at = now()
    where id = v_id;
  else
    v_skill := kafaa_al_str(p, 'skill_id'); v_fw := kafaa_al_str(p, 'framework');
    v_new := 'al:' || v_skill || ':' || v_fw || ':' || substr(md5(random()::text || clock_timestamp()::text), 1, 8);
    v_sort := coalesce((select max(sort) from kafaa_skill_alignments where skill_id = v_skill), 0) + 1;
    insert into kafaa_skill_alignments (id, skill_id, framework, external_code, label_en, label_ar, label_ar_official, external_meta, match_type, level_map, note_en, note_ar,
      source_url, as_of, status, listed, reviewed_by, reviewed_role, reviewed_on, retired_reason, retired_on, version, created_by, created_at, updated_by, updated_at, sort)
    values (v_new, v_skill, v_fw, nullif(kafaa_al_str(p, 'external_code'), ''), kafaa_al_str(p, 'label_en'), kafaa_al_str(p, 'label_ar'), coalesce(p->'label_ar_official' = 'true'::jsonb, false),
      '{}'::jsonb, kafaa_al_str(p, 'match_type'), kafaa_al_canon_level_map(p->'level_map'), kafaa_al_str(p, 'note_en'), kafaa_al_str(p, 'note_ar'), kafaa_al_str(p, 'source_url'),
      kafaa_al_str(p, 'as_of')::date, v_status, v_pub, null, null, null, null, null, 1, me, now(), me, now(), v_sort);
  end if;
  a := kafaa_audit('skill_alignment.save', 'skill_alignments', v_new, 'ok', v_status || ' v' || v_version, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when cur.id is not null then 'Alignment saved' else 'Alignment added' end, a, null,
    jsonb_build_object('id', v_new, 'status', v_status, 'version', v_version));
end $$;

-- ───────────── RPC: review a published alignment (maker-checker: not the last editor)
create or replace function kafaa_review_alignment(p_id text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_id text := btrim(coalesce(p_id, ''), E' \t\r\n'); cur kafaa_skill_alignments; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('skill_alignment.review', 'skill_alignments', nullif(v_id, ''), 'not_signed_in', kafaa_al_message('not_signed_in')); end if;
  if not kafaa_has_grant('frameworks', array['W', 'A']) then return kafaa_refuse('skill_alignment.review', 'skill_alignments', nullif(v_id, ''), 'forbidden', kafaa_al_message('forbidden')); end if;
  v_role := kafaa_acting_role('frameworks', array['W', 'A']);
  select * into cur from kafaa_skill_alignments where id = v_id;
  if cur.id is null then return kafaa_refuse('skill_alignment.review', 'skill_alignments', nullif(v_id, ''), 'not_found', kafaa_al_message('not_found'), v_role); end if;
  if cur.status = 'retired' then return kafaa_refuse('skill_alignment.review', 'skill_alignments', v_id, 'retired', kafaa_al_message('retired'), v_role); end if;
  if cur.status <> 'published' then return kafaa_refuse('skill_alignment.review', 'skill_alignments', v_id, 'invalid', kafaa_al_message('not_published'), v_role); end if;
  if cur.reviewed_by is not null then return kafaa_refuse('skill_alignment.review', 'skill_alignments', v_id, 'no_change', kafaa_al_message('already_reviewed'), v_role); end if;
  if cur.updated_by is not null and cur.updated_by = me then return kafaa_refuse('skill_alignment.review', 'skill_alignments', v_id, 'maker_checker', kafaa_al_message('maker_checker'), v_role); end if;
  update kafaa_skill_alignments set reviewed_by = me, reviewed_role = v_role, reviewed_on = current_date where id = v_id;
  a := kafaa_audit('skill_alignment.review', 'skill_alignments', v_id, 'ok', 'reviewed ' || cur.framework || ' ' || cur.match_type, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Alignment reviewed', a, null, jsonb_build_object('id', v_id, 'reviewed_on', to_char(current_date, 'YYYY-MM-DD')));
end $$;

-- ───────────── RPC: retire an alignment with a reason (never deleted)
create or replace function kafaa_retire_alignment(p_id text, p_reason text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_id text := btrim(coalesce(p_id, ''), E' \t\r\n'); v_why text := btrim(coalesce(p_reason, ''), E' \t\r\n'); cur kafaa_skill_alignments; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('skill_alignment.retire', 'skill_alignments', nullif(v_id, ''), 'not_signed_in', kafaa_al_message('not_signed_in')); end if;
  if not kafaa_has_grant('frameworks', array['W', 'A']) then return kafaa_refuse('skill_alignment.retire', 'skill_alignments', nullif(v_id, ''), 'forbidden', kafaa_al_message('forbidden')); end if;
  v_role := kafaa_acting_role('frameworks', array['W', 'A']);
  select * into cur from kafaa_skill_alignments where id = v_id;
  if cur.id is null then return kafaa_refuse('skill_alignment.retire', 'skill_alignments', nullif(v_id, ''), 'not_found', kafaa_al_message('not_found'), v_role); end if;
  if cur.status = 'retired' then return kafaa_refuse('skill_alignment.retire', 'skill_alignments', v_id, 'retired', kafaa_al_message('retired'), v_role); end if;
  if length(v_why) < 5 or length(v_why) > 300 then return kafaa_refuse('skill_alignment.retire', 'skill_alignments', v_id, 'invalid', kafaa_al_message('reason'), v_role); end if;
  update kafaa_skill_alignments set status = 'retired', listed = false, retired_reason = v_why, retired_on = current_date, updated_by = me, updated_at = now() where id = v_id;
  a := kafaa_audit('skill_alignment.retire', 'skill_alignments', v_id, 'ok', v_why, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Alignment retired', a, null, jsonb_build_object('id', v_id));
end $$;

-- ───────────── RPC: FS07 "Add to my goals" (skills_profile Own; up to 12 active; never security or obsolete skills)
create or replace function kafaa_set_skill_goal(p_skill text, p_level numeric, p_active boolean default true) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_sid text := btrim(coalesce(p_skill, ''), E' \t\r\n'); sk kafaa_skills; v_gid text; cur kafaa_skill_goals; v_n int; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('skill_goal.set', 'skill_goals', nullif(v_sid, ''), 'not_signed_in', 'Sign in to keep skill goals'); end if;
  if not kafaa_has_grant('skills_profile', array['Own']) then return kafaa_refuse('skill_goal.set', 'skill_goals', nullif(v_sid, ''), 'forbidden', 'Skill goals are for staff with a skills passport'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  select * into sk from kafaa_skills where id = v_sid;
  if sk.id is null then return kafaa_refuse('skill_goal.set', 'skill_goals', nullif(v_sid, ''), 'not_found', 'Skill not found', v_role); end if;
  v_gid := 'sg:' || me || ':' || v_sid;
  select * into cur from kafaa_skill_goals where id = v_gid;
  if p_active is false then
    if cur.id is null or cur.status <> 'active' then return kafaa_refuse('skill_goal.set', 'skill_goals', v_sid, 'no_change', 'This skill is not on your goals', v_role); end if;
    update kafaa_skill_goals set status = 'removed', updated_at = now() where id = v_gid;
    a := kafaa_audit('skill_goal.set', 'skill_goals', v_gid, 'ok', 'removed ' || v_sid, 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Removed from your goals', a, null, jsonb_build_object('id', v_gid, 'skill_id', v_sid, 'status', 'removed', 'target_level', cur.target_level));
  end if;
  if sk.area = 'security' then return kafaa_refuse('skill_goal.set', 'skill_goals', v_sid, 'restricted', 'Security skills are not personal goals: they follow the security career path', v_role); end if;
  if sk.lifecycle = 'obsolete' then return kafaa_refuse('skill_goal.set', 'skill_goals', v_sid, 'obsolete', 'This skill is obsolete: choose its replacement instead', v_role); end if;
  if p_level is null or p_level <> trunc(p_level) or p_level < 1 or p_level > 4 then return kafaa_refuse('skill_goal.set', 'skill_goals', v_sid, 'invalid', 'Choose a target level from 1 to 4', v_role); end if;
  select count(*) into v_n from kafaa_skill_goals where person_id = me and status = 'active' and id <> v_gid;
  if v_n >= 12 then return kafaa_refuse('skill_goal.set', 'skill_goals', v_sid, 'limit', 'You can keep up to 12 active skill goals: remove one first', v_role); end if;
  insert into kafaa_skill_goals (id, person_id, skill_id, target_level, status, source, created_at, updated_at)
  values (v_gid, me, v_sid, p_level::int, 'active', 'skills_explorer', now(), now())
  on conflict (id) do update set target_level = excluded.target_level, status = 'active', updated_at = now();
  a := kafaa_audit('skill_goal.set', 'skill_goals', v_gid, 'ok', 'active ' || v_sid || ' L' || p_level::int, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Added to your goals', a, null, jsonb_build_object('id', v_gid, 'skill_id', v_sid, 'status', 'active', 'target_level', p_level::int));
end $$;

-- ───────────── Grants: internal helpers are not executable by API roles; RPCs only by signed-in users.
revoke all on function kafaa_al_str(jsonb, text), kafaa_al_is_date(text), kafaa_al_valid_level_map(jsonb), kafaa_al_canon_level_map(jsonb), kafaa_al_code_ok(text, text),
  kafaa_al_dup_key(text, text, text, text), kafaa_al_check(jsonb, kafaa_skill_alignments), kafaa_al_result_code(text), kafaa_al_message(text) from public, anon, authenticated;
revoke all on function kafaa_save_alignment(jsonb), kafaa_review_alignment(text), kafaa_retire_alignment(text, text), kafaa_set_skill_goal(text, numeric, boolean) from public, anon;
grant execute on function kafaa_save_alignment(jsonb), kafaa_review_alignment(text), kafaa_retire_alignment(text, text), kafaa_set_skill_goal(text, numeric, boolean) to authenticated;
