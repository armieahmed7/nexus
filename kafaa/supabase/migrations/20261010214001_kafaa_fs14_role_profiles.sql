-- [FS wave A · E4 · FS05] Future role profiles and 2030/2035 role horizons (module M01).
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file for the new table and the two
-- new M01 columns, RLS in the per-statement form (like 20261008140000_kafaa_rls_perf.sql), and the RPC.
-- LocalBackend mirror: src/modules/m01/backend/local.ts; rules: src/modules/m01/roleProfiles.ts (checkVersion = kafaa_rpv_check).
-- PGlite checks: scripts/validate/fs14-role-profiles.mjs.

-- ───────────── M01 columns: current vs concept roles, current vs future progression edges
alter table kafaa_job_roles add column if not exists lifecycle text not null default 'current';
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_job_roles_lifecycle_check') then
  alter table kafaa_job_roles add constraint kafaa_job_roles_lifecycle_check check (lifecycle in ('current', 'concept')); end if; end $$;
create index if not exists kafaa_job_roles_lifecycle_idx on kafaa_job_roles (lifecycle);
alter table kafaa_career_paths add column if not exists kind text not null default 'current';
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_career_paths_kind_check') then
  alter table kafaa_career_paths add constraint kafaa_career_paths_kind_check check (kind in ('current', 'future')); end if; end $$;
create index if not exists kafaa_career_paths_kind_idx on kafaa_career_paths (kind);

-- ───────────── Table (generated DDL)
-- M01 · Role profile versions for now, 2030 and 2035 (planning assumptions; FS05)
create table if not exists kafaa_role_profile_versions (
  id text primary key,
  role_id text not null,
  horizon text not null check (horizon in ('now', '2030', '2035')),
  version integer not null default 1,
  status text not null default 'draft' check (status in ('draft', 'published', 'superseded')),
  is_public boolean not null default false,
  path_only boolean not null default false,
  requirements jsonb not null default '[]'::jsonb,
  drivers text[] not null default '{}'::text[],
  rationale_en text not null,
  rationale_ar text not null,
  sources jsonb not null default '[]'::jsonb,
  as_of date not null,
  supersedes_id text,
  superseded_by_id text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_by text,
  published_at timestamptz
);
comment on table kafaa_role_profile_versions is '[M01] Role profile versions for now, 2030 and 2035 (planning assumptions; FS05)';
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_role_profile_versions_role_id_fk') then alter table kafaa_role_profile_versions add constraint kafaa_role_profile_versions_role_id_fk foreign key (role_id) references kafaa_job_roles(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_role_profile_versions_role_id_idx on kafaa_role_profile_versions (role_id);
create index if not exists kafaa_role_profile_versions_horizon_idx on kafaa_role_profile_versions (horizon);
create index if not exists kafaa_role_profile_versions_status_idx on kafaa_role_profile_versions (status);

-- ───────────── RLS: published rows public; drafts and history for audit_log (admin, auditor) and sat (training, SAT review)
alter table kafaa_role_profile_versions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_role_profile_versions' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_role_profile_versions for select to anon, authenticated using (false)'; end if;
end $$;
alter policy kafaa_read on kafaa_role_profile_versions using (((COALESCE(is_public, false) AND (SELECT kafaa_has_grant('public_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))) OR ((SELECT kafaa_has_grant('audit_log'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((SELECT kafaa_has_grant('sat'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))));
revoke all on kafaa_role_profile_versions from anon, authenticated;
grant select on kafaa_role_profile_versions to anon, authenticated;

-- ───────────── Rules (mirror of src/modules/m01/roleProfiles.ts). Internal: not executable by API roles.
create or replace function kafaa_rpv_text_clean(p_texts text[]) returns boolean language sql immutable set search_path = public as $$
  select not exists (
    select 1 from unnest(p_texts) t
    where coalesce(t, '') ~* '\y(headcount|fte|full[- ]time equivalents?|[0-9]+\s*(staff|people|jobs|positions|operators|engineers|workers)|site (selection|identified|chosen)|candidate site|located at|to be built (at|in))\y'
       or coalesce(t, '') ~* '\y(will be deployed|to be deployed|decided to deploy|deployment (has been|is|was) (approved|decided|confirmed|planned)|construction (will|is planned to) (start|begin)|units? will be built)\y'
       or coalesce(t, '') ~ '(عدد الموظفين|عدد العاملين|اختيار الموقع|الموقع المختار|سيتم نشر|تقرر نشر|تمت الموافقة على النشر|سيتم بناء|سيُبنى|سيبنى|[0-9]+\s*(موظف|موظفين|مشغل|مشغلين|مهندس|مهندسين|وظيفة|وظائف))'
  )
$$;

create or replace function kafaa_rpv_message(p_code text) returns text language sql immutable set search_path = public as $$
  select case p_code
    when 'invalid' then 'Choose a horizon (now, 2030 or 2035), known drivers and a rationale of at least 20 characters in English and Arabic'
    when 'not_found' then 'Role not found'
    when 'invalid_requirements' then 'Each requirement needs a kind, a reference, a level from 1 to 4 and an importance; no duplicates; at most 30'
    when 'unknown_ref' then 'A requirement points at an unknown competency or skill'
    when 'security_restricted' then 'Security, safeguards and cyber content stays at career-path level: no skill or competency requirements'
    when 'unclean_text' then 'Profile text must not mention headcount, sites or a deployment decision'
    when 'source_required' then 'Publishing needs at least one https source with a label'
    when 'too_few' then 'A published profile needs requirements (a concept future role at least 4)'
    else 'ok' end
$$;

-- First failing rule, same order as checkVersion(): invalid -> not_found -> invalid_requirements -> unknown_ref ->
-- security_restricted -> unclean_text -> (publish only) source_required -> too_few.
create or replace function kafaa_rpv_check(p jsonb) returns text language plpgsql stable security definer set search_path = public as $$
declare r kafaa_job_roles; x jsonb; v_keys text[] := '{}'::text[]; v_key text; n integer; v_min integer;
  c_drivers constant text[] := array['digital_ic', 'ai_assistance', 'robotics', 'smr_design', 'digital_twin'];
begin
  if p is null or jsonb_typeof(p) <> 'object' or coalesce(p->>'horizon', '') not in ('now', '2030', '2035') then return 'invalid'; end if;
  if jsonb_typeof(p->'drivers') is distinct from 'array' then return 'invalid'; end if;
  if exists (select 1 from jsonb_array_elements(p->'drivers') d where jsonb_typeof(d) <> 'string' or not ((d #>> '{}') = any(c_drivers))) then return 'invalid'; end if;
  if char_length(btrim(coalesce(p->>'rationale_en', ''), E' \t\r\n')) < 20 or char_length(btrim(coalesce(p->>'rationale_ar', ''), E' \t\r\n')) < 20 then return 'invalid'; end if;
  select * into r from kafaa_job_roles where id = p->>'role_id';
  if r.id is null then return 'not_found'; end if;
  if jsonb_typeof(p->'requirements') is distinct from 'array' or jsonb_array_length(p->'requirements') > 30 then return 'invalid_requirements'; end if;
  for x in select e from jsonb_array_elements(p->'requirements') e loop
    if jsonb_typeof(x) <> 'object' or coalesce(x->>'kind', '') not in ('competency', 'skill') or jsonb_typeof(x->'kind') <> 'string'
       or jsonb_typeof(x->'ref_id') is distinct from 'string' or x->>'ref_id' = '' then return 'invalid_requirements'; end if;
    if jsonb_typeof(x->'level') is distinct from 'number' or (x->>'level')::numeric <> floor((x->>'level')::numeric)
       or (x->>'level')::numeric < 1 or (x->>'level')::numeric > 4 then return 'invalid_requirements'; end if;
    if jsonb_typeof(x->'importance') is distinct from 'string' or x->>'importance' not in ('core', 'important', 'useful') then return 'invalid_requirements'; end if;
    if coalesce(jsonb_typeof(x->'driver'), 'null') <> 'null' and (jsonb_typeof(x->'driver') <> 'string' or not ((x->>'driver') = any(c_drivers))) then return 'invalid_requirements'; end if;
    v_key := (x->>'kind') || ':' || (x->>'ref_id');
    if v_key = any(v_keys) then return 'invalid_requirements'; end if;
    v_keys := v_keys || v_key;
  end loop;
  if exists (select 1 from jsonb_array_elements(p->'requirements') e
             where case when e->>'kind' = 'competency' then not exists (select 1 from kafaa_competencies c where c.id = e->>'ref_id')
                        else not exists (select 1 from kafaa_skills s where s.id = e->>'ref_id') end) then return 'unknown_ref'; end if;
  n := jsonb_array_length(p->'requirements');
  if r.security_sensitive and n > 0 then return 'security_restricted'; end if;
  if exists (select 1 from jsonb_array_elements(p->'requirements') e
             where (e->>'kind' = 'competency' and exists (select 1 from kafaa_competencies c where c.id = e->>'ref_id' and c.domain = 'security'))
                or (e->>'kind' = 'skill' and exists (select 1 from kafaa_skills s where s.id = e->>'ref_id' and s.area = 'security'))) then return 'security_restricted'; end if;
  if not kafaa_rpv_text_clean(array[p->>'rationale_en', p->>'rationale_ar']
        || coalesce((select array_agg(t) from jsonb_array_elements(p->'requirements') e, lateral (values (coalesce(e->>'why_en', '')), (coalesce(e->>'why_ar', ''))) v(t)), '{}'::text[])) then
    return 'unclean_text';
  end if;
  if coalesce(p->>'publish', 'false') = 'true' then
    if not exists (select 1 from jsonb_array_elements(case when jsonb_typeof(p->'sources') = 'array' then p->'sources' else '[]'::jsonb end) s
                   where jsonb_typeof(s) = 'object' and jsonb_typeof(s->'url') = 'string' and s->>'url' like 'https://%'
                     and jsonb_typeof(s->'label') = 'string' and btrim(s->>'label', E' \t\r\n') <> '') then return 'source_required'; end if;
    v_min := case when r.lifecycle = 'concept' then 4 when r.security_sensitive then 0 else 1 end;
    if n < v_min then return 'too_few'; end if;
  end if;
  return 'ok';
end $$;

-- ───────────── RPC: save or publish a role profile version (training manager or admin; audited; ledger on publish)
create or replace function kafaa_save_role_profile_version(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; v_code text; v_entity text := coalesce(p->>'role_id', '') || ':' || coalesce(p->>'horizon', '');
  jr kafaa_job_roles; v_reqs jsonb; v_drivers text[]; v_draft kafaa_role_profile_versions; v_prev kafaa_role_profile_versions;
  v_version integer; v_id text; v_h text := p->>'horizon'; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('role_profile.save', 'role_profile_versions', v_entity, 'not_signed_in', 'Sign in to edit role profiles'); end if;
  v_role := coalesce(kafaa_acting_role('frameworks', array['A']), kafaa_acting_role('sat', array['A']));
  if v_role is null then return kafaa_refuse('role_profile.save', 'role_profile_versions', v_entity, 'forbidden', 'Role profiles are maintained by the training manager or an admin'); end if;
  v_code := kafaa_rpv_check(p);
  if v_code <> 'ok' then return kafaa_refuse('role_profile.save', 'role_profile_versions', v_entity, v_code, kafaa_rpv_message(v_code), v_role); end if;
  select * into jr from kafaa_job_roles where id = p->>'role_id';
  v_reqs := coalesce((select jsonb_agg(jsonb_build_object('kind', e->>'kind', 'ref_id', e->>'ref_id', 'level', (e->>'level')::numeric::int, 'importance', e->>'importance',
                       'why_en', coalesce(e->>'why_en', ''), 'why_ar', coalesce(e->>'why_ar', ''),
                       'driver', case when coalesce(jsonb_typeof(e->'driver'), 'null') = 'null' then null else e->>'driver' end)
                     order by e->>'kind' collate "C", e->>'ref_id' collate "C") from jsonb_array_elements(p->'requirements') e), '[]'::jsonb);
  v_drivers := array(select d from (select jsonb_array_elements_text(p->'drivers') d union select e->>'driver' from jsonb_array_elements(v_reqs) e where e->>'driver' is not null) s order by d collate "C");
  select * into v_draft from kafaa_role_profile_versions where role_id = jr.id and horizon = v_h and status = 'draft' order by version desc limit 1;
  if v_draft.id is not null then
    v_id := v_draft.id; v_version := v_draft.version;
    update kafaa_role_profile_versions set requirements = v_reqs, drivers = v_drivers, rationale_en = btrim(p->>'rationale_en', E' \t\r\n'), rationale_ar = btrim(p->>'rationale_ar', E' \t\r\n'),
      sources = case when jsonb_typeof(p->'sources') = 'array' then p->'sources' else '[]'::jsonb end, path_only = jr.security_sensitive, as_of = current_date, updated_at = now()
    where id = v_id;
  else
    v_version := coalesce((select max(version) from kafaa_role_profile_versions where role_id = jr.id and horizon = v_h), 0) + 1;
    v_id := 'rpv-' || jr.id || '-' || v_h || '-v' || v_version;
    insert into kafaa_role_profile_versions (id, role_id, horizon, version, status, is_public, path_only, requirements, drivers, rationale_en, rationale_ar, sources, as_of,
      supersedes_id, superseded_by_id, created_by, created_at, updated_at, published_by, published_at)
    values (v_id, jr.id, v_h, v_version, 'draft', false, jr.security_sensitive, v_reqs, v_drivers, btrim(p->>'rationale_en', E' \t\r\n'), btrim(p->>'rationale_ar', E' \t\r\n'),
      case when jsonb_typeof(p->'sources') = 'array' then p->'sources' else '[]'::jsonb end, current_date, null, null, me, now(), now(), null, null);
  end if;
  if coalesce(p->>'publish', 'false') <> 'true' then
    a := kafaa_audit('role_profile.save', 'role_profile_versions', v_id, 'ok', format('draft v%s for %s %s (%s requirements)', v_version, jr.id, v_h, jsonb_array_length(v_reqs)), 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Draft saved', a, null, jsonb_build_object('id', v_id, 'version', v_version, 'status', 'draft', 'supersedes_id', null));
  end if;
  select * into v_prev from kafaa_role_profile_versions where role_id = jr.id and horizon = v_h and status = 'published' and id <> v_id order by version desc limit 1;
  if v_prev.id is not null then
    update kafaa_role_profile_versions set status = 'superseded', is_public = false, superseded_by_id = v_id, updated_at = now() where id = v_prev.id;
  end if;
  update kafaa_role_profile_versions set status = 'published', is_public = true, published_by = me, published_at = now(), supersedes_id = v_prev.id where id = v_id;
  l := kafaa_ledger('kafaa.role_profile.publish', format('Role profile %s %s v%s published', jr.id, v_h, v_version));
  a := kafaa_audit('role_profile.publish', 'role_profile_versions', v_id, 'ok',
         format('published v%s for %s %s%s', v_version, jr.id, v_h, case when v_prev.id is null then '' else ' (supersedes ' || v_prev.id || ')' end),
         case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Profile published', a, l, jsonb_build_object('id', v_id, 'version', v_version, 'status', 'published', 'supersedes_id', v_prev.id));
end $$;

revoke all on function kafaa_rpv_text_clean(text[]) from public, anon, authenticated;
revoke all on function kafaa_rpv_message(text) from public, anon, authenticated;
revoke all on function kafaa_rpv_check(jsonb) from public, anon, authenticated;
revoke all on function kafaa_save_role_profile_version(jsonb) from public, anon;
grant execute on function kafaa_save_role_profile_version(jsonb) to authenticated;
