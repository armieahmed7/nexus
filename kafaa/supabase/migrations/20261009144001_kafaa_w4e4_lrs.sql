-- [W4 · E4 · F30] Learning record store: xAPI 2.0-shaped statements (module M27).
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file, RLS in the per-statement form,
-- the Kafa'a emitters (AFTER triggers on the source tables of M04, M05, F08, F13, F14, F15 and F21 that only append statements),
-- the profile validator and four RPCs. TypeScript mirror: src/modules/m27/xapi.ts (profile, emitters) and
-- src/modules/m27/backend/local.ts (RPCs, LocalBackend emitters). PGlite checks: scripts/validate/w4e4-lrs.mjs.

-- ───────────── Table (generated DDL)
-- M27 · xAPI statement (learning record store; append-only; actor by Kafa'a account, no email) (F30)
create table if not exists kafaa_xapi_statements (
  id text primary key,
  actor_person_id text not null,
  verb text not null check (verb in ('completed', 'passed', 'failed', 'answered', 'attended', 'experienced', 'attempted', 'progressed')),
  object_type text not null check (object_type in ('course', 'module', 'scenario', 'task', 'refresher', 'opportunity', 'rotation', 'shadowing', 'jpm', 'mentoring', 'knowledge_asset', 'activity')),
  object_id text not null,
  object_name jsonb not null default '{}'::jsonb,
  result jsonb,
  context jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  stored_at timestamptz not null default now(),
  source text not null check (source in ('m04_course', 'f14_refresher', 'f08_opportunity', 'f15_rotation', 'f15_shadowing', 'm05_jpm', 'f13_mentoring', 'f21_knowledge', 'f28_simulator', 'f38_ojt', 'console')),
  source_ref text not null,
  stored_by text,
  version text not null default '2.0.0'
);
comment on table kafaa_xapi_statements is '[M27] xAPI statement (learning record store; append-only; actor by Kafa''a account, no email) (F30)';
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_xapi_statements_actor_person_id_fk') then alter table kafaa_xapi_statements add constraint kafaa_xapi_statements_actor_person_id_fk foreign key (actor_person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_xapi_statements_actor_person_id_idx on kafaa_xapi_statements (actor_person_id);
create index if not exists kafaa_xapi_statements_verb_idx on kafaa_xapi_statements (verb);
create index if not exists kafaa_xapi_statements_object_type_idx on kafaa_xapi_statements (object_type);
create index if not exists kafaa_xapi_statements_object_id_idx on kafaa_xapi_statements (object_id);
create index if not exists kafaa_xapi_statements_occurred_at_idx on kafaa_xapi_statements (occurred_at);
create index if not exists kafaa_xapi_statements_source_idx on kafaa_xapi_statements (source);

-- ───────────── RLS: the person (lrs Own), instructors and managers in scope (lrs Scope), auditors (lrs R). Per-statement form.
alter table kafaa_xapi_statements enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_xapi_statements' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_xapi_statements for select to anon, authenticated using (false)'; end if;
end $$;
alter policy kafaa_read on kafaa_xapi_statements using (((SELECT kafaa_has_grant('lrs'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((actor_person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('lrs'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('lrs'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('lrs'::text, actor_person_id, NULL::text, false)));
-- Append-only: API roles may only read; statements are written by the emitters and kafaa_store_statement and are never changed.
revoke all on kafaa_xapi_statements from anon, authenticated;
grant select on kafaa_xapi_statements to anon, authenticated;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'kafaa_xapi_statements_append_only') then
    execute 'create trigger kafaa_xapi_statements_append_only before update on kafaa_xapi_statements for each row execute function kafaa_append_only()'; end if;
end $$;

-- ───────────── Internal helpers (same rules as src/modules/m27/xapi.ts)
create or replace function kafaa_xapi_id(p_source text, p_ref text) returns text language sql immutable set search_path = public as $$
  select substr(h, 1, 8) || '-' || substr(h, 9, 4) || '-8' || substr(h, 14, 3) || '-a' || substr(h, 18, 3) || '-' || substr(h, 21, 12) from (select md5(p_source || ':' || p_ref) as h) x
$$;
create or replace function kafaa_xapi_noon(p_date date) returns timestamptz language sql immutable set search_path = public as $$
  select (p_date::text || ' 12:00:00+00')::timestamptz
$$;
create or replace function kafaa_xapi_titled(p_en text, p_ar text, p_id text) returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object('en', coalesce(nullif(p_en, ''), p_id), 'ar', coalesce(nullif(p_ar, ''), nullif(p_en, ''), p_id))
$$;
create or replace function kafaa_xapi_record(p_table text, p_id text) returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object('extensions', jsonb_build_object('https://kafaa.example/xapi/ext/record', p_table || '/' || p_id))
$$;
create or replace function kafaa_xapi_make(p_source text, p_ref text, p_actor text, p_verb text, p_type text, p_object text, p_name jsonb, p_result jsonb, p_context jsonb,
  p_occurred timestamptz, p_stored timestamptz) returns kafaa_xapi_statements language plpgsql immutable set search_path = public as $$
declare s kafaa_xapi_statements; v_st timestamptz := date_trunc('second', coalesce(p_stored, p_occurred));
begin
  s.id := kafaa_xapi_id(p_source, p_ref); s.actor_person_id := p_actor; s.verb := p_verb; s.object_type := p_type; s.object_id := p_object;
  s.object_name := p_name; s.result := p_result; s.context := p_context;
  s.occurred_at := case when p_stored is null then date_trunc('second', p_occurred) else least(date_trunc('second', p_occurred), v_st) end;
  s.stored_at := v_st; s.source := p_source; s.source_ref := p_ref; s.stored_by := null; s.version := '2.0.0';
  return s;
end $$;

-- Emitter drafts: one function per source table (TS draftFor). p_stored = now() for live emitters, null for backfill (stored = experience time).
create or replace function kafaa_xapi_d_course(r kafaa_training_records, p_stored timestamptz) returns kafaa_xapi_statements language plpgsql stable security definer set search_path = public as $$
declare c kafaa_courses; v_res jsonb := jsonb_build_object('completion', true);
begin
  select * into c from kafaa_courses where id = r.course_id;
  if r.result = 'passed' then v_res := v_res || jsonb_build_object('success', true); end if;
  if r.result = 'failed' then v_res := v_res || jsonb_build_object('success', false); end if;
  if coalesce(r.hours, 0) > 0 then v_res := v_res || jsonb_build_object('duration', 'PT' || trim_scale(r.hours)::text || 'H'); end if;
  return kafaa_xapi_make('m04_course', r.id, r.person_id, case when r.result = 'failed' then 'failed' else 'completed' end, 'course', r.course_id,
    kafaa_xapi_titled(c.title_en, c.title_ar, r.course_id), v_res, kafaa_xapi_record('training_records', r.id), kafaa_xapi_noon(r.completed_on), p_stored);
end $$;
create or replace function kafaa_xapi_d_refresher(r kafaa_refresh_state, p_stored timestamptz) returns kafaa_xapi_statements language plpgsql stable security definer set search_path = public as $$
declare c kafaa_competencies;
begin
  select * into c from kafaa_competencies where id = r.competency_id;
  return kafaa_xapi_make('f14_refresher', left(md5(r.id), 16) || ':' || r.attempts::text, r.person_id, 'answered', 'refresher', r.competency_id,
    jsonb_build_object('en', coalesce(nullif(c.name_en, ''), r.competency_id), 'ar', coalesce(nullif(c.name_ar, ''), nullif(c.name_en, ''), r.competency_id)),
    jsonb_build_object('success', r.last_result = 'correct'), jsonb_build_object('extensions', jsonb_build_object('https://kafaa.example/xapi/ext/leitner-box', r.box)),
    coalesce(r.last_at, r.created_at), p_stored);
end $$;
create or replace function kafaa_xapi_d_opportunity(r kafaa_opportunity_applications, p_stored timestamptz) returns kafaa_xapi_statements language plpgsql stable security definer set search_path = public as $$
declare o kafaa_opportunities;
begin
  select * into o from kafaa_opportunities where id = r.opportunity_id;
  return kafaa_xapi_make('f08_opportunity', r.id, r.person_id, 'completed', 'opportunity', r.opportunity_id, kafaa_xapi_titled(o.title_en, o.title_ar, r.opportunity_id),
    jsonb_build_object('completion', true, 'success', true), kafaa_xapi_record('opportunity_applications', r.id), coalesce(r.completed_at, r.updated_at), p_stored);
end $$;
create or replace function kafaa_xapi_d_rotation(r kafaa_rotation_placements, p_stored timestamptz) returns kafaa_xapi_statements language plpgsql stable security definer set search_path = public as $$
declare t kafaa_rotation_templates;
begin
  select * into t from kafaa_rotation_templates where id = r.template_id;
  return kafaa_xapi_make('f15_rotation', r.id, r.person_id, 'completed', 'rotation', r.template_id, kafaa_xapi_titled(t.title_en, t.title_ar, r.template_id),
    jsonb_build_object('completion', true, 'success', true), kafaa_xapi_record('rotation_placements', r.id), coalesce(r.signed_off_at, r.updated_at), p_stored);
end $$;
create or replace function kafaa_xapi_d_shadowing(r kafaa_shadow_requests, p_stored timestamptz) returns kafaa_xapi_statements language plpgsql stable security definer set search_path = public as $$
declare j kafaa_job_roles;
begin
  select * into j from kafaa_job_roles where id = r.host_role_id;
  return kafaa_xapi_make('f15_shadowing', r.id, r.person_id, 'experienced', 'shadowing', coalesce(r.host_role_id, r.id),
    case when r.host_role_id is null then jsonb_build_object('en', 'Job shadowing', 'ar', 'التظليل الوظيفي') else kafaa_xapi_titled(j.title_en, j.title_ar, r.host_role_id) end,
    jsonb_build_object('completion', true, 'duration', 'P' || r.days::text || 'D'), kafaa_xapi_record('shadow_requests', r.id), coalesce(r.completed_at, r.updated_at), p_stored);
end $$;
create or replace function kafaa_xapi_d_jpm(r kafaa_jpm_results, p_stored timestamptz) returns kafaa_xapi_statements language plpgsql stable security definer set search_path = public as $$
declare j kafaa_jpms; v_restricted boolean;
begin
  select * into j from kafaa_jpms where id = r.jpm_id;
  select coalesce(q.security_restricted, false) into v_restricted from kafaa_qual_standards q where q.id = j.standard_id;
  if coalesce(v_restricted, false) then return null; end if;
  return kafaa_xapi_make('m05_jpm', r.id, r.person_id, case when r.result = 'pass' then 'passed' else 'failed' end, 'jpm', r.jpm_id, kafaa_xapi_titled(j.title_en, j.title_ar, r.jpm_id),
    jsonb_build_object('completion', true, 'success', r.result = 'pass',
      'score', jsonb_build_object('scaled', trim_scale(round(r.score_pct * 100) / 10000), 'raw', trim_scale(r.score_pct), 'min', 0, 'max', 100)),
    kafaa_xapi_record('jpm_results', r.id), kafaa_xapi_noon(r.date), p_stored);
end $$;
create or replace function kafaa_xapi_d_mentoring(r kafaa_mentoring_sessions, p_stored timestamptz) returns kafaa_xapi_statements language plpgsql stable security definer set search_path = public as $$
declare v_type text;
begin
  select a.mentoring_type into v_type from kafaa_mentoring_agreements a where a.id = r.agreement_id;
  return kafaa_xapi_make('f13_mentoring', r.id, r.person_id, 'attended', 'mentoring', r.agreement_id,
    case v_type
      when 'career' then jsonb_build_object('en', 'Career mentoring', 'ar', 'إرشاد مهني')
      when 'knowledge_transfer' then jsonb_build_object('en', 'Knowledge-transfer mentoring', 'ar', 'إرشاد لنقل المعرفة')
      when 'leadership' then jsonb_build_object('en', 'Leadership mentoring', 'ar', 'إرشاد قيادي')
      when 'reverse' then jsonb_build_object('en', 'Reverse mentoring', 'ar', 'إرشاد عكسي')
      when 'peer_onboarding' then jsonb_build_object('en', 'Peer onboarding', 'ar', 'إرشاد الأقران عند الانضمام')
      else jsonb_build_object('en', 'Mentoring', 'ar', 'إرشاد') end,
    jsonb_build_object('duration', 'PT' || r.minutes::text || 'M'), kafaa_xapi_record('mentoring_sessions', r.id), kafaa_xapi_noon(r.held_on), p_stored);
end $$;
create or replace function kafaa_xapi_d_asset(r kafaa_asset_uses, p_stored timestamptz) returns kafaa_xapi_statements language plpgsql stable security definer set search_path = public as $$
declare k kafaa_knowledge_assets;
begin
  select * into k from kafaa_knowledge_assets where id = r.asset_id;
  return kafaa_xapi_make('f21_knowledge', r.id, r.person_id, 'experienced', 'knowledge_asset', r.asset_id, kafaa_xapi_titled(k.title_en, k.title_ar, r.asset_id), null,
    kafaa_xapi_record('asset_uses', r.id), kafaa_xapi_noon(r.used_on), p_stored);
end $$;

-- Append one statement (idempotent by its deterministic id). Hand-off for F28 (crew debriefs) and F38 (OJT logs): build the row with
-- kafaa_xapi_make('f28_simulator' | 'f38_ojt', <source row id>, ...) and pass it here from your own trigger or RPC.
create or replace function kafaa_xapi_emit(s kafaa_xapi_statements) returns boolean language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if s.id is null then return false; end if;
  insert into kafaa_xapi_statements select (s).* on conflict (id) do nothing;
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- Every statement the emitters would have stored for the current source rows (stored = experience time). TS: backfill().
create or replace function kafaa_xapi_source_rows() returns setof kafaa_xapi_statements language plpgsql stable security definer set search_path = public as $$
begin
  return query select s.* from kafaa_training_records t cross join lateral kafaa_xapi_d_course(t, null) s where s.id is not null;
  return query select s.* from kafaa_refresh_state t cross join lateral kafaa_xapi_d_refresher(t, null) s where t.attempts > 0 and s.id is not null;
  return query select s.* from kafaa_opportunity_applications t cross join lateral kafaa_xapi_d_opportunity(t, null) s where t.status = 'completed' and s.id is not null;
  return query select s.* from kafaa_rotation_placements t cross join lateral kafaa_xapi_d_rotation(t, null) s where t.status = 'signed_off' and s.id is not null;
  return query select s.* from kafaa_shadow_requests t cross join lateral kafaa_xapi_d_shadowing(t, null) s where t.status = 'completed' and s.id is not null;
  return query select s.* from kafaa_jpm_results t cross join lateral kafaa_xapi_d_jpm(t, null) s where s.id is not null;
  return query select s.* from kafaa_mentoring_sessions t cross join lateral kafaa_xapi_d_mentoring(t, null) s where s.id is not null;
  return query select s.* from kafaa_asset_uses t cross join lateral kafaa_xapi_d_asset(t, null) s where s.id is not null;
end $$;
-- One-off backfill for records that existed before the store (live apply); idempotent.
create or replace function kafaa_xapi_backfill() returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  insert into kafaa_xapi_statements select * from kafaa_xapi_source_rows() on conflict (id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- ───────────── Emitter triggers on the source tables (append statements only; never change the source row; skipped while seeding;
-- an emitter failure never blocks the learning action: it is reported as a warning).
create or replace function kafaa_xapi_on_source() returns trigger language plpgsql security definer set search_path = public as $$
declare s kafaa_xapi_statements;
begin
  if coalesce(current_setting('kafaa.seeding', true), '') = 'on' then return new; end if;
  begin
    case tg_table_name
      when 'kafaa_training_records' then s := kafaa_xapi_d_course(new, now());
      when 'kafaa_refresh_state' then s := kafaa_xapi_d_refresher(new, now());
      when 'kafaa_opportunity_applications' then s := kafaa_xapi_d_opportunity(new, now());
      when 'kafaa_rotation_placements' then s := kafaa_xapi_d_rotation(new, now());
      when 'kafaa_shadow_requests' then s := kafaa_xapi_d_shadowing(new, now());
      when 'kafaa_jpm_results' then s := kafaa_xapi_d_jpm(new, now());
      when 'kafaa_mentoring_sessions' then s := kafaa_xapi_d_mentoring(new, now());
      when 'kafaa_asset_uses' then s := kafaa_xapi_d_asset(new, now());
      else s := null;
    end case;
    perform kafaa_xapi_emit(s);
  exception when others then
    raise warning 'Kafa''a LRS emitter skipped on %: %', tg_table_name, sqlerrm;
  end;
  return new;
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'kafaa_xapi_emit_training_records') then
    execute 'create trigger kafaa_xapi_emit_training_records after insert on kafaa_training_records for each row execute function kafaa_xapi_on_source()'; end if;
  if not exists (select 1 from pg_trigger where tgname = 'kafaa_xapi_emit_refresh_state_ins') then
    execute 'create trigger kafaa_xapi_emit_refresh_state_ins after insert on kafaa_refresh_state for each row when (new.attempts > 0) execute function kafaa_xapi_on_source()'; end if;
  if not exists (select 1 from pg_trigger where tgname = 'kafaa_xapi_emit_refresh_state_upd') then
    execute 'create trigger kafaa_xapi_emit_refresh_state_upd after update on kafaa_refresh_state for each row when (new.attempts > old.attempts) execute function kafaa_xapi_on_source()'; end if;
  if not exists (select 1 from pg_trigger where tgname = 'kafaa_xapi_emit_opportunity_applications') then
    execute 'create trigger kafaa_xapi_emit_opportunity_applications after update on kafaa_opportunity_applications for each row when (new.status = ''completed'' and old.status is distinct from ''completed'') execute function kafaa_xapi_on_source()'; end if;
  if not exists (select 1 from pg_trigger where tgname = 'kafaa_xapi_emit_rotation_placements') then
    execute 'create trigger kafaa_xapi_emit_rotation_placements after update on kafaa_rotation_placements for each row when (new.status = ''signed_off'' and old.status is distinct from ''signed_off'') execute function kafaa_xapi_on_source()'; end if;
  if not exists (select 1 from pg_trigger where tgname = 'kafaa_xapi_emit_shadow_requests') then
    execute 'create trigger kafaa_xapi_emit_shadow_requests after update on kafaa_shadow_requests for each row when (new.status = ''completed'' and old.status is distinct from ''completed'') execute function kafaa_xapi_on_source()'; end if;
  if not exists (select 1 from pg_trigger where tgname = 'kafaa_xapi_emit_jpm_results') then
    execute 'create trigger kafaa_xapi_emit_jpm_results after insert on kafaa_jpm_results for each row execute function kafaa_xapi_on_source()'; end if;
  if not exists (select 1 from pg_trigger where tgname = 'kafaa_xapi_emit_mentoring_sessions') then
    execute 'create trigger kafaa_xapi_emit_mentoring_sessions after insert on kafaa_mentoring_sessions for each row execute function kafaa_xapi_on_source()'; end if;
  if not exists (select 1 from pg_trigger where tgname = 'kafaa_xapi_emit_asset_uses') then
    execute 'create trigger kafaa_xapi_emit_asset_uses after insert on kafaa_asset_uses for each row execute function kafaa_xapi_on_source()'; end if;
end $$;

-- ───────────── Profile validator (TS validateStatement): returns the list of {path, code} errors, empty when the statement is valid.
create or replace function kafaa_xapi_is_lang_map(p jsonb) returns boolean language sql immutable set search_path = public as $$
  select jsonb_typeof(p) = 'object' and not exists (select 1 from jsonb_each(p) x where jsonb_typeof(x.value) <> 'string' or length(x.value #>> '{}') > 200)
$$;
create or replace function kafaa_xapi_iri_keys(p jsonb) returns boolean language sql immutable set search_path = public as $$
  select jsonb_typeof(p) = 'object' and not exists (select 1 from jsonb_object_keys(p) k where k !~ '^https?://\S+$')
$$;
create or replace function kafaa_xapi_validate(p jsonb) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  e jsonb := '[]'::jsonb; k text; a jsonb; acc jsonb; v jsonb; o jsonb; d jsonb; r jsonb; sc jsonb; c jsonb; v_rest text; v_slash integer; v_type text; v_oid text := null;
  v_txt text; v_ts timestamptz; v_uuid text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'; v_base text := 'https://kafaa.example/xapi/activities/';
  v_scaled numeric; v_raw numeric; v_min numeric; v_max numeric; v_numok boolean;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return jsonb_build_array(jsonb_build_object('path', '$', 'code', 'not_object')); end if;
  v_txt := p::text;
  if length(v_txt) > 8000 then return jsonb_build_array(jsonb_build_object('path', '$', 'code', 'too_large')); end if;
  for k in select jsonb_object_keys(p) loop
    if k in ('stored', 'authority') then e := e || jsonb_build_object('path', k, 'code', 'lrs_field');
    elsif k not in ('id', 'actor', 'verb', 'object', 'result', 'context', 'timestamp', 'version') then e := e || jsonb_build_object('path', k, 'code', 'unknown_field'); end if;
  end loop;
  if p ? 'id' and (jsonb_typeof(p->'id') <> 'string' or (p->>'id') !~ v_uuid) then e := e || jsonb_build_object('path', 'id', 'code', 'id_format'); end if;
  -- actor
  a := p->'actor';
  if a is null or jsonb_typeof(a) <> 'object' then e := e || jsonb_build_object('path', 'actor', 'code', 'actor_required');
  else
    if a ? 'objectType' and a->'objectType' is distinct from '"Agent"'::jsonb then e := e || jsonb_build_object('path', 'actor.objectType', 'code', 'actor_type'); end if;
    foreach k in array array['mbox', 'mbox_sha1sum', 'openid'] loop
      if a ? k then e := e || jsonb_build_object('path', 'actor.' || k, 'code', 'mbox_not_allowed'); end if;
    end loop;
    if a ? 'name' then e := e || jsonb_build_object('path', 'actor.name', 'code', 'name_not_allowed'); end if;
    for k in select jsonb_object_keys(a) loop
      if k not in ('objectType', 'account', 'mbox', 'mbox_sha1sum', 'openid', 'name') then e := e || jsonb_build_object('path', 'actor.' || k, 'code', 'unknown_field'); end if;
    end loop;
    acc := a->'account';
    if acc is null or jsonb_typeof(acc) <> 'object' or jsonb_typeof(acc->'name') is distinct from 'string' or jsonb_typeof(acc->'homePage') is distinct from 'string' then
      e := e || jsonb_build_object('path', 'actor.account', 'code', 'account_required');
    elsif acc->>'homePage' <> 'https://kafaa.example' then e := e || jsonb_build_object('path', 'actor.account.homePage', 'code', 'account_home');
    elsif not exists (select 1 from kafaa_people x where x.id = acc->>'name') then e := e || jsonb_build_object('path', 'actor.account.name', 'code', 'unknown_person');
    end if;
  end if;
  -- verb
  v := p->'verb';
  if v is null or jsonb_typeof(v) <> 'object' or jsonb_typeof(v->'id') is distinct from 'string' then e := e || jsonb_build_object('path', 'verb', 'code', 'verb_required');
  else
    if (v->>'id') not in (select 'http://adlnet.gov/expapi/verbs/' || x from unnest(array['completed', 'passed', 'failed', 'answered', 'attended', 'experienced', 'attempted', 'progressed']) x) then
      e := e || jsonb_build_object('path', 'verb.id', 'code', 'verb_unknown'); end if;
    if v ? 'display' and not kafaa_xapi_is_lang_map(v->'display') then e := e || jsonb_build_object('path', 'verb.display', 'code', 'display_format'); end if;
    for k in select jsonb_object_keys(v) loop
      if k not in ('id', 'display') then e := e || jsonb_build_object('path', 'verb.' || k, 'code', 'unknown_field'); end if;
    end loop;
  end if;
  -- object
  o := p->'object';
  if o is null or jsonb_typeof(o) <> 'object' or jsonb_typeof(o->'id') is distinct from 'string' then e := e || jsonb_build_object('path', 'object', 'code', 'object_required');
  else
    if o ? 'objectType' and o->'objectType' is distinct from '"Activity"'::jsonb then e := e || jsonb_build_object('path', 'object.objectType', 'code', 'object_type'); end if;
    v_rest := case when left(o->>'id', length(v_base)) = v_base then substr(o->>'id', length(v_base) + 1) end;
    v_slash := coalesce(strpos(v_rest, '/'), 0);
    if v_rest is null or v_slash < 2 or substr(v_rest, v_slash + 1) !~ '^[A-Za-z0-9:._-]{1,80}$' then e := e || jsonb_build_object('path', 'object.id', 'code', 'object_iri');
    else
      v_type := left(v_rest, v_slash - 1);
      if v_type not in ('course', 'module', 'scenario', 'task', 'refresher', 'opportunity', 'rotation', 'shadowing', 'jpm', 'mentoring', 'knowledge_asset', 'activity') then
        e := e || jsonb_build_object('path', 'object.id', 'code', 'object_kind');
      else v_oid := substr(v_rest, v_slash + 1); end if;
    end if;
    d := o->'definition';
    if o ? 'definition' then
      if jsonb_typeof(d) <> 'object' then e := e || jsonb_build_object('path', 'object.definition', 'code', 'name_format');
      else
        if d ? 'name' and not kafaa_xapi_is_lang_map(d->'name') then e := e || jsonb_build_object('path', 'object.definition.name', 'code', 'name_format'); end if;
        if d ? 'type' and (jsonb_typeof(d->'type') <> 'string' or (d->>'type') !~ '^https?://\S+$') then e := e || jsonb_build_object('path', 'object.definition.type', 'code', 'object_iri'); end if;
        for k in select jsonb_object_keys(d) loop
          if k not in ('name', 'type', 'description') then e := e || jsonb_build_object('path', 'object.definition.' || k, 'code', 'unknown_field'); end if;
        end loop;
        if d ? 'description' and not kafaa_xapi_is_lang_map(d->'description') then e := e || jsonb_build_object('path', 'object.definition.description', 'code', 'name_format'); end if;
      end if;
    end if;
    for k in select jsonb_object_keys(o) loop
      if k not in ('objectType', 'id', 'definition') then e := e || jsonb_build_object('path', 'object.' || k, 'code', 'unknown_field'); end if;
    end loop;
  end if;
  -- result
  if p ? 'result' then
    r := p->'result';
    if jsonb_typeof(r) <> 'object' then e := e || jsonb_build_object('path', 'result', 'code', 'result_format');
    else
      if r ? 'response' then e := e || jsonb_build_object('path', 'result.response', 'code', 'response_not_allowed'); end if;
      foreach k in array array['success', 'completion'] loop
        if r ? k and jsonb_typeof(r->k) <> 'boolean' then e := e || jsonb_build_object('path', 'result.' || k, 'code', 'bool_format'); end if;
      end loop;
      if r ? 'duration' and (jsonb_typeof(r->'duration') <> 'string'
          or (r->>'duration') !~ '^P(?=\d|T\d)(\d+(\.\d+)?Y)?(\d+(\.\d+)?M)?(\d+(\.\d+)?W)?(\d+(\.\d+)?D)?(T(?=\d)(\d+(\.\d+)?H)?(\d+(\.\d+)?M)?(\d+(\.\d+)?S)?)?$') then
        e := e || jsonb_build_object('path', 'result.duration', 'code', 'duration_format'); end if;
      if r ? 'score' then
        sc := r->'score';
        v_numok := jsonb_typeof(sc) = 'object' and not exists (select 1 from unnest(array['scaled', 'raw', 'min', 'max']) x where sc ? x and jsonb_typeof(sc->x) <> 'number');
        if not v_numok then e := e || jsonb_build_object('path', 'result.score', 'code', 'score_range');
        else
          v_scaled := (sc->>'scaled')::numeric; v_raw := (sc->>'raw')::numeric; v_min := (sc->>'min')::numeric; v_max := (sc->>'max')::numeric;
          if (v_scaled is not null and (v_scaled < -1 or v_scaled > 1)) or (v_min is not null and v_max is not null and v_min > v_max)
             or (v_raw is not null and ((v_min is not null and v_raw < v_min) or (v_max is not null and v_raw > v_max))) then
            e := e || jsonb_build_object('path', 'result.score', 'code', 'score_range'); end if;
          for k in select jsonb_object_keys(sc) loop
            if k not in ('scaled', 'raw', 'min', 'max') then e := e || jsonb_build_object('path', 'result.score.' || k, 'code', 'unknown_field'); end if;
          end loop;
        end if;
      end if;
      if r ? 'extensions' and not kafaa_xapi_iri_keys(r->'extensions') then e := e || jsonb_build_object('path', 'result.extensions', 'code', 'extension_key'); end if;
      for k in select jsonb_object_keys(r) loop
        if k not in ('success', 'completion', 'duration', 'score', 'extensions', 'response') then e := e || jsonb_build_object('path', 'result.' || k, 'code', 'unknown_field'); end if;
      end loop;
    end if;
  end if;
  -- context
  if p ? 'context' then
    c := p->'context';
    if jsonb_typeof(c) <> 'object' then e := e || jsonb_build_object('path', 'context', 'code', 'context_format');
    else
      if c ? 'registration' and (jsonb_typeof(c->'registration') <> 'string' or (c->>'registration') !~ v_uuid) then e := e || jsonb_build_object('path', 'context.registration', 'code', 'registration_format'); end if;
      foreach k in array array['platform', 'language'] loop
        if c ? k and (jsonb_typeof(c->k) <> 'string' or length(c->>k) > 40) then e := e || jsonb_build_object('path', 'context.' || k, 'code', 'context_format'); end if;
      end loop;
      if c ? 'extensions' and not kafaa_xapi_iri_keys(c->'extensions') then e := e || jsonb_build_object('path', 'context.extensions', 'code', 'extension_key'); end if;
      for k in select jsonb_object_keys(c) loop
        if k not in ('registration', 'platform', 'language', 'extensions') then e := e || jsonb_build_object('path', 'context.' || k, 'code', 'unknown_field'); end if;
      end loop;
    end if;
  end if;
  -- timestamp and version
  if p ? 'timestamp' then
    v_ts := null;
    if jsonb_typeof(p->'timestamp') = 'string' and (p->>'timestamp') ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$' then
      begin v_ts := (p->>'timestamp')::timestamptz; exception when others then v_ts := null; end;
    end if;
    if v_ts is null then e := e || jsonb_build_object('path', 'timestamp', 'code', 'timestamp_format');
    elsif v_ts > now() + interval '1 day' then e := e || jsonb_build_object('path', 'timestamp', 'code', 'timestamp_future'); end if;
  end if;
  if p ? 'version' and (jsonb_typeof(p->'version') <> 'string' or (p->>'version') !~ '^(2\.0(\.\d+)?|1\.0(\.\d+)?)$') then e := e || jsonb_build_object('path', 'version', 'code', 'version_unsupported'); end if;
  -- secure assessment content: no secure item id anywhere in the statement
  if v_oid is not null and exists (select 1 from kafaa_items i where i.bank = 'secure' and i.id = v_oid) then e := e || jsonb_build_object('path', 'object.id', 'code', 'secure_content');
  elsif exists (select 1 from kafaa_items i where i.bank = 'secure' and v_txt ~ ('(^|[^A-Za-z0-9_-])' || regexp_replace(i.id, '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g') || '($|[^A-Za-z0-9_-])')) then
    e := e || jsonb_build_object('path', '$', 'code', 'secure_content');
  end if;
  return e;
end $$;

-- ───────────── RPC: storeStatement (admin test console; the emitters write directly). Statements are about the caller only.
create or replace function kafaa_store_statement(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; v_err jsonb; v_msg text; v_id text; v_n jsonb; v_en text; v_ar text; v_rest text; v_ts timestamptz := date_trunc('second', now()); a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('lrs.store', 'xapi_statements', null, 'not_signed_in', 'Sign in first'); end if;
  v_role := kafaa_acting_role('integrations', array['A']);
  if v_role is null then return kafaa_refuse('lrs.store', 'xapi_statements', null, 'forbidden', 'Statements are written by the Kafa''a emitters; the test console is for platform admins'); end if;
  v_err := kafaa_xapi_validate(p);
  if jsonb_array_length(v_err) > 0 then
    select string_agg(x->>'path' || ': ' || (x->>'code'), '; ' order by x->>'path' collate "C", x->>'code' collate "C") into v_msg
      from (select x from jsonb_array_elements(v_err) x order by x->>'path' collate "C", x->>'code' collate "C" limit 3) y;
    return kafaa_refuse('lrs.store', 'xapi_statements', null, 'schema_error',
      format('Statement does not match the Kafa''a xAPI 2.0 profile (%s error(s)): %s', jsonb_array_length(v_err), v_msg), v_role);
  end if;
  if p->'actor'->'account'->>'name' <> me then return kafaa_refuse('lrs.store', 'xapi_statements', null, 'not_self', 'The test console stores statements about yourself only', v_role); end if;
  v_id := coalesce(p->>'id', gen_random_uuid()::text);
  if exists (select 1 from kafaa_xapi_statements s where s.id = v_id) then
    return kafaa_refuse('lrs.store', 'xapi_statements', v_id, 'conflict', 'A statement with this id already exists; statements are immutable', v_role);
  end if;
  v_n := p->'object'->'definition'->'name';
  v_en := coalesce(v_n->>'en-US', v_n->>'en', v_n->>'en-GB'); v_ar := coalesce(v_n->>'ar-AE', v_n->>'ar');
  v_rest := substr(p->'object'->>'id', length('https://kafaa.example/xapi/activities/') + 1);
  insert into kafaa_xapi_statements (id, actor_person_id, verb, object_type, object_id, object_name, result, context, occurred_at, stored_at, source, source_ref, stored_by, version)
  values (v_id, me, substr(p->'verb'->>'id', length('http://adlnet.gov/expapi/verbs/') + 1), split_part(v_rest, '/', 1), substr(v_rest, strpos(v_rest, '/') + 1),
    jsonb_strip_nulls(jsonb_build_object('en', nullif(v_en, ''), 'ar', nullif(v_ar, ''))),
    case when jsonb_typeof(p->'result') = 'object' then p->'result' end,
    (case when p->'context' ? 'registration' then jsonb_build_object('registration', p->'context'->'registration') else '{}'::jsonb end)
      || (case when p->'context' ? 'language' then jsonb_build_object('language', p->'context'->'language') else '{}'::jsonb end)
      || (case when p->'context' ? 'extensions' then jsonb_build_object('extensions', p->'context'->'extensions') else '{}'::jsonb end),
    case when p ? 'timestamp' then date_trunc('second', (p->>'timestamp')::timestamptz) else v_ts end, v_ts, 'console', v_id, me, '2.0.0');
  a := kafaa_audit('lrs.store', 'xapi_statements', v_id, 'ok', 'console ' || substr(p->'verb'->>'id', length('http://adlnet.gov/expapi/verbs/') + 1) || ' ' || v_rest, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Statement stored', a, null, jsonb_build_object('id', v_id));
end $$;

-- ───────────── RPC: queryStatements (explorer, person timeline, statement view). Own rows; Scope rows; auditors all.
create or replace function kafaa_query_statements(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_all boolean; v_scope boolean; v_own boolean; v_role text; v_actor text; v_lim integer; v_off integer; v_rows jsonb; v_total integer; v_people jsonb;
  a kafaa_audit_events; v_audit boolean;
begin
  if me is null then return kafaa_refuse('lrs.query', 'xapi_statements', null, 'not_signed_in', 'Sign in first'); end if;
  p := coalesce(p, '{}'::jsonb);
  v_all := kafaa_has_grant('lrs', array['R']); v_scope := kafaa_has_grant('lrs', array['Scope']); v_own := kafaa_has_grant('lrs', array['Own', 'Scope']);
  v_role := kafaa_acting_role('lrs', array['R', 'Scope', 'Own']);
  if not (v_all or v_own) then
    if kafaa_has_grant('lrs', array['Agg']) then return kafaa_refuse('lrs.query', 'xapi_statements', null, 'aggregate_only', 'Your role sees learning records as aggregates only', kafaa_acting_role('lrs', array['Agg'])); end if;
    return kafaa_refuse('lrs.query', 'xapi_statements', null, 'forbidden', 'Learning records are not available to your role');
  end if;
  if (p ? 'verb' and (p->>'verb') not in ('completed', 'passed', 'failed', 'answered', 'attended', 'experienced', 'attempted', 'progressed'))
     or (p ? 'object_type' and (p->>'object_type') not in ('course', 'module', 'scenario', 'task', 'refresher', 'opportunity', 'rotation', 'shadowing', 'jpm', 'mentoring', 'knowledge_asset', 'activity'))
     or (p ? 'source' and (p->>'source') not in ('m04_course', 'f14_refresher', 'f08_opportunity', 'f15_rotation', 'f15_shadowing', 'm05_jpm', 'f13_mentoring', 'f21_knowledge', 'f28_simulator', 'f38_ojt', 'console'))
     or (p ? 'since' and coalesce(p->>'since', '') !~ '^\d{4}-\d{2}-\d{2}$') or (p ? 'until' and coalesce(p->>'until', '') !~ '^\d{4}-\d{2}-\d{2}$')
     or (p ? 'limit' and jsonb_typeof(p->'limit') <> 'number') or (p ? 'offset' and jsonb_typeof(p->'offset') <> 'number') then
    return kafaa_refuse('lrs.query', 'xapi_statements', null, 'invalid', 'Unknown filter value', v_role);
  end if;
  v_actor := nullif(p->>'actor', '');
  if v_actor is not null and v_actor <> me and not v_all and not (v_scope and kafaa_in_scope('lrs', v_actor)) then
    return kafaa_refuse('lrs.query', 'xapi_statements', v_actor, 'not_in_scope', 'This person is outside your scope', v_role);
  end if;
  v_lim := least(greatest(coalesce((p->>'limit')::integer, 200), 1), 1000); v_off := greatest(coalesce((p->>'offset')::integer, 0), 0);
  with vis as (
    select s.* from kafaa_xapi_statements s
    where (v_all or (s.actor_person_id = me and v_own) or (v_scope and kafaa_in_scope('lrs', s.actor_person_id)))
      and (v_actor is null or s.actor_person_id = v_actor)
      and (not p ? 'id' or s.id = p->>'id') and (not p ? 'verb' or s.verb = p->>'verb') and (not p ? 'object_type' or s.object_type = p->>'object_type')
      and (not p ? 'object_id' or s.object_id = p->>'object_id') and (not p ? 'source' or s.source = p->>'source')
      and (not p ? 'since' or s.occurred_at >= ((p->>'since') || ' 00:00:00+00')::timestamptz) and (not p ? 'until' or s.occurred_at < ((p->>'until') || ' 00:00:00+00')::timestamptz + interval '1 day')
  ), pg as (select * from vis order by occurred_at desc, id collate "C" limit v_lim offset v_off)
  select (select count(*)::integer from vis),
         coalesce((select jsonb_agg(to_jsonb(pg.*) order by pg.occurred_at desc, pg.id collate "C") from pg), '[]'::jsonb),
         coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'name', x.display_name, 'name_ar', x.display_name_ar, 'role_id', x.job_role_id) order by x.id collate "C")
                   from kafaa_people x where x.id in (select actor_person_id from pg)), '[]'::jsonb)
    into v_total, v_rows, v_people;
  v_audit := (v_all or v_scope) and v_actor is distinct from me;
  if v_audit then
    a := kafaa_audit('lrs.query', 'xapi_statements', v_actor, 'ok', format('%s of %s statements%s', jsonb_array_length(v_rows), v_total, case when v_actor is null then ' in scope' else '' end), 'not_applicable', null, v_role);
  end if;
  return jsonb_build_object('ok', true, 'code', 'ok', 'message', 'Statements', 'audit_seq', case when v_audit then a.seq end, 'ledger_seq', null,
    'data', jsonb_build_object('rows', v_rows, 'total', v_total, 'people', v_people, 'scope', case when v_all then 'all' when v_scope then 'scope' else 'own' end));
end $$;

-- ───────────── RPC: exportStatements (own data right: every statement about me, for a JSON lines download). Audited, no ledger.
create or replace function kafaa_export_statements() returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_rows jsonb; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('lrs.export', 'xapi_statements', null, 'not_signed_in', 'Sign in first'); end if;
  v_role := kafaa_acting_role('lrs', array['Own', 'Scope', 'R']);
  if v_role is null then return kafaa_refuse('lrs.export', 'xapi_statements', me, 'forbidden', 'Learning records are not available to your role'); end if;
  select coalesce(jsonb_agg(to_jsonb(s.*) order by s.occurred_at, s.id collate "C"), '[]'::jsonb) into v_rows from kafaa_xapi_statements s where s.actor_person_id = me;
  a := kafaa_audit('lrs.export', 'xapi_statements', me, 'ok', format('%s statements exported as JSON lines', jsonb_array_length(v_rows)), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Your learning record is ready to download', a, null, jsonb_build_object('rows', v_rows, 'count', jsonb_array_length(v_rows)));
end $$;

-- ───────────── Read: lrsAggregate (analytics for F25/F26; lrs Agg or R). A cell shows only when it covers 10 or more people.
create or replace function kafaa_lrs_aggregate() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_min integer := (kafaa_rules()->>'minGroupSize')::integer; v_out jsonb;
begin
  if not kafaa_has_grant('lrs', array['Agg', 'R']) then raise exception 'Kafa''a · learning record analytics are aggregate-only and restricted' using errcode = '42501'; end if;
  with s as (select x.*, to_char(x.occurred_at at time zone 'UTC', 'YYYY-MM') as month from kafaa_xapi_statements x),
  cell as (
    select 'month' as dim, month as k1, null::text as k2, count(*)::integer as n, count(distinct actor_person_id)::integer as p from s group by month
    union all select 'verb', verb, null, count(*)::integer, count(distinct actor_person_id)::integer from s group by verb
    union all select 'source', source, null, count(*)::integer, count(distinct actor_person_id)::integer from s group by source
    union all select 'type', object_type, null, count(*)::integer, count(distinct actor_person_id)::integer from s group by object_type
    union all select 'month_verb', month, verb, count(*)::integer, count(distinct actor_person_id)::integer from s group by month, verb
  ),
  top as (
    select object_type, object_id, max(object_name->>'en' collate "C") as name_en, max(object_name->>'ar' collate "C") as name_ar, count(*)::integer as n, count(distinct actor_person_id)::integer as p
    from s group by object_type, object_id having count(distinct actor_person_id) >= v_min
    order by count(distinct actor_person_id) desc, count(*) desc, object_type collate "C", object_id collate "C" limit 12
  )
  select jsonb_build_object(
    'min_group', v_min,
    'statements', (select count(*)::integer from s),
    'actors', (select case when count(distinct actor_person_id) < v_min then null else count(distinct actor_person_id)::integer end from s),
    'cells', coalesce((select jsonb_agg(jsonb_build_object('dim', dim, 'key', k1, 'key2', k2, 'statements', case when p < v_min then null else n end,
        'actors', case when p < v_min then null else p end, 'suppressed', p < v_min) order by dim collate "C", k1 collate "C", k2 collate "C") from cell), '[]'::jsonb),
    'top', coalesce((select jsonb_agg(jsonb_build_object('object_type', object_type, 'object_id', object_id, 'name_en', name_en, 'name_ar', name_ar, 'statements', n, 'actors', p)
        order by p desc, n desc, object_type collate "C", object_id collate "C") from top), '[]'::jsonb))
  into v_out;
  return v_out;
end $$;

-- ───────────── Grants: internal helpers are not executable by API roles; RPCs are for signed-in users only.
revoke execute on function kafaa_xapi_id(text, text), kafaa_xapi_noon(date), kafaa_xapi_titled(text, text, text), kafaa_xapi_record(text, text),
  kafaa_xapi_make(text, text, text, text, text, text, jsonb, jsonb, jsonb, timestamptz, timestamptz),
  kafaa_xapi_d_course(kafaa_training_records, timestamptz), kafaa_xapi_d_refresher(kafaa_refresh_state, timestamptz), kafaa_xapi_d_opportunity(kafaa_opportunity_applications, timestamptz),
  kafaa_xapi_d_rotation(kafaa_rotation_placements, timestamptz), kafaa_xapi_d_shadowing(kafaa_shadow_requests, timestamptz), kafaa_xapi_d_jpm(kafaa_jpm_results, timestamptz),
  kafaa_xapi_d_mentoring(kafaa_mentoring_sessions, timestamptz), kafaa_xapi_d_asset(kafaa_asset_uses, timestamptz), kafaa_xapi_emit(kafaa_xapi_statements),
  kafaa_xapi_source_rows(), kafaa_xapi_backfill(), kafaa_xapi_on_source(), kafaa_xapi_is_lang_map(jsonb), kafaa_xapi_iri_keys(jsonb), kafaa_xapi_validate(jsonb)
  from public, anon, authenticated;
revoke execute on function kafaa_store_statement(jsonb), kafaa_query_statements(jsonb), kafaa_export_statements(), kafaa_lrs_aggregate() from public, anon;
grant execute on function kafaa_store_statement(jsonb), kafaa_query_statements(jsonb), kafaa_export_statements(), kafaa_lrs_aggregate() to authenticated;
