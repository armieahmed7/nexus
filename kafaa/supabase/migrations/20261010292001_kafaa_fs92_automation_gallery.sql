-- [FS wave I · E2 · FS80] Automation and agent gallery with builder credit (M29 AI and Digital Fluency).
-- Staff submit a governed automation or agent as METADATA ONLY (purpose, data used, accountable owner, the human check on its output, how
--   to use it, and the FS36 AI-system register row it runs on); AI governance (ai_literacy A) approves, returns or rejects it and retires
--   it later (maker-checker: never the builder or the owner); staff record that they reuse an approved entry (one adoption per person,
--   never the builder, FS09 rung at least the entry's minimum). There is no code, file or link column, `metadata_only` is checked true,
--   and text that looks like code, a script, a link or a credential is refused (kafaa_atm_problem, mirror of automationProblem in
--   src/modules/m29/automations.ts). Kafa'a never runs an automation.
-- Builder credit: only once an entry is approved AND has its first adopter, the builder receives one recorded F01 evidence row
--   `se:ojt:<automation>:sk-fs-ai-automation` (kind ojt = recorded work evidence, basis validated, ref_table automations), level 2 from
--   the first adopter and 3 from 5 adopters (kafaa_atm_level = builderLevel), then kafaa_skills_apply for the builder. `ojt` is a recorded
--   kind, so kafaa_skill_states_v2 / kafaa_skills_apply keep it without a redefinition (FS39/FS66/FS72 precedent); neither is redefined here.
--   The skill is on the AI-engineering track, so FS09 rungs (kafaa_ai_rung) never move because of it.
-- Reads: staff see approved (listed) entries; builders see their own entries in every status; admins and auditors read every entry
--   (audit_log R); an adoption row is read by the adopter and audit_log R only (the builder sees the counter, never the adopters).
-- PGlite parity and checks: scripts/validate/fs92-automation-gallery.mjs.
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file; RLS created once (never removed).

-- ───────────── Tables (generated DDL, additive)
create table if not exists kafaa_automations (
  id text primary key,
  title_en text not null,
  title_ar text not null,
  kind text not null check (kind in ('workflow', 'agent', 'template', 'report')),
  purpose_en text not null,
  purpose_ar text not null,
  data_used_en text not null,
  data_used_ar text not null,
  data_classes text[] not null default '{}'::text[],
  system_id text not null,
  builder_person_id text not null,
  owner_person_id text not null,
  builder_en text not null,
  builder_ar text not null,
  owner_en text not null,
  owner_ar text not null,
  family_id text,
  oversight_en text not null,
  oversight_ar text not null,
  benefit_en text not null,
  benefit_ar text not null,
  how_en text not null,
  how_ar text not null,
  min_rung integer not null default 1,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'returned', 'approved', 'rejected', 'retired')),
  listed boolean not null default false,
  version integer not null default 1,
  metadata_only boolean not null default true,
  adoption_count integer not null default 0,
  first_adopted_on date,
  builder_level integer not null default 0,
  submitted_at timestamptz,
  decided_by text,
  decided_at timestamptz,
  decision_note text not null default '',
  history jsonb not null default '[]'::jsonb,
  open_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table kafaa_automations is '[M29] Automation or agent gallery entry (metadata only, never run by Kafa''a): purpose, data used, accountable owner, human check, how to use, the AI-system register row it runs on, governance decision and adoption counter (FS80)';

-- M29 · One person's recorded reuse of an approved gallery entry (one row per person and entry; the builder never adopts their own) (FS80)
create table if not exists kafaa_automation_adoptions (
  id text primary key,
  automation_id text not null,
  person_id text not null,
  family_id text,
  adopted_on date not null,
  note text not null default '',
  open_read boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table kafaa_automation_adoptions is '[M29] One person''s recorded reuse of an approved gallery entry (one row per person and entry; the builder never adopts their own) (FS80)';
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_automations_system_id_fk') then alter table kafaa_automations add constraint kafaa_automations_system_id_fk foreign key (system_id) references kafaa_ai_systems(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_automations_builder_person_id_fk') then alter table kafaa_automations add constraint kafaa_automations_builder_person_id_fk foreign key (builder_person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_automations_owner_person_id_fk') then alter table kafaa_automations add constraint kafaa_automations_owner_person_id_fk foreign key (owner_person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_automation_adoptions_automation_id_fk') then alter table kafaa_automation_adoptions add constraint kafaa_automation_adoptions_automation_id_fk foreign key (automation_id) references kafaa_automations(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_automation_adoptions_person_id_fk') then alter table kafaa_automation_adoptions add constraint kafaa_automation_adoptions_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_automations_kind_idx on kafaa_automations (kind);
create index if not exists kafaa_automations_system_id_idx on kafaa_automations (system_id);
create index if not exists kafaa_automations_builder_person_id_idx on kafaa_automations (builder_person_id);
create index if not exists kafaa_automations_owner_person_id_idx on kafaa_automations (owner_person_id);
create index if not exists kafaa_automations_status_idx on kafaa_automations (status);
create index if not exists kafaa_automation_adoptions_automation_id_idx on kafaa_automation_adoptions (automation_id);
create index if not exists kafaa_automation_adoptions_person_id_idx on kafaa_automation_adoptions (person_id);
-- one adoption per person and entry
create unique index if not exists kafaa_automation_adoptions_once_uq on kafaa_automation_adoptions (automation_id, person_id);

-- ───────────── Checks (FS80 acceptance in the data itself)
do $$ begin
  -- metadata only: the flag is always true and no text field carries a link or a script tag
  if not exists (select 1 from pg_constraint where conname = 'kafaa_automations_metadata_ck') then
    alter table kafaa_automations add constraint kafaa_automations_metadata_ck check (metadata_only
      and strpos(lower(concat_ws(' ', title_en, title_ar, purpose_en, purpose_ar, data_used_en, data_used_ar, oversight_en, oversight_ar, benefit_en, benefit_ar, how_en, how_ar)), 'http://') = 0
      and strpos(lower(concat_ws(' ', title_en, title_ar, purpose_en, purpose_ar, data_used_en, data_used_ar, oversight_en, oversight_ar, benefit_en, benefit_ar, how_en, how_ar)), 'https://') = 0
      and strpos(lower(concat_ws(' ', title_en, title_ar, purpose_en, purpose_ar, data_used_en, data_used_ar, oversight_en, oversight_ar, benefit_en, benefit_ar, how_en, how_ar)), 'javascript:') = 0
      and strpos(lower(concat_ws(' ', title_en, title_ar, purpose_en, purpose_ar, data_used_en, data_used_ar, oversight_en, oversight_ar, benefit_en, benefit_ar, how_en, how_ar)), '<script') = 0); end if;
  if not exists (select 1 from pg_constraint where conname = 'kafaa_automations_values_ck') then
    alter table kafaa_automations add constraint kafaa_automations_values_ck check (min_rung between 1 and 3 and adoption_count >= 0 and builder_level in (0, 2, 3)
      and listed = (status = 'approved') and data_classes <@ array['public', 'internal', 'controlled_docs', 'personal']::text[] and cardinality(data_classes) between 1 and 4); end if;
  -- builder credit only after approval and the first adoption
  if not exists (select 1 from pg_constraint where conname = 'kafaa_automations_credit_ck') then
    alter table kafaa_automations add constraint kafaa_automations_credit_ck check (builder_level = 0 or (status in ('approved', 'retired') and adoption_count >= 1 and first_adopted_on is not null)); end if;
  if not exists (select 1 from pg_constraint where conname = 'kafaa_automations_decided_ck') then
    alter table kafaa_automations add constraint kafaa_automations_decided_ck check (status not in ('approved', 'returned', 'rejected', 'retired')
      or (decided_by is not null and decided_at is not null and decided_by <> builder_person_id and decided_by <> owner_person_id)); end if;
end $$;

-- ───────────── RLS (per-statement form, the gen-rls-perf rewrite of the generated rules). Writes only via the RPCs.
alter table kafaa_automations enable row level security;
alter table kafaa_automation_adoptions enable row level security;
do $$ declare t text; begin
  foreach t in array array['kafaa_automations', 'kafaa_automation_adoptions'] loop
    if not exists (select 1 from pg_policies where tablename = t and policyname = 'kafaa_read') then
      execute format('create policy kafaa_read on %I for select to anon, authenticated using (false)', t); end if;
  end loop;
end $$;
alter policy kafaa_read on kafaa_automations using (((COALESCE(listed, false) AND (SELECT kafaa_has_grant('ai_literacy'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))))
  OR (((COALESCE(open_read, false) AND (SELECT kafaa_has_grant('ai_literacy'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((builder_person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('ai_literacy'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('ai_literacy'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('ai_literacy'::text, builder_person_id, NULL::text, false))))
  OR ((SELECT kafaa_has_grant('audit_log'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))));
alter policy kafaa_read on kafaa_automation_adoptions using ((((COALESCE(open_read, false) AND (SELECT kafaa_has_grant('ai_literacy'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('ai_literacy'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('ai_literacy'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('ai_literacy'::text, person_id, NULL::text, false))))
  OR ((SELECT kafaa_has_grant('audit_log'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))));
revoke all on kafaa_automations, kafaa_automation_adoptions from anon, authenticated;
grant select on kafaa_automations, kafaa_automation_adoptions to anon, authenticated;

-- ═════════════ Rules (mirror of src/modules/m29/automations.ts)
-- Term lists: code / scripts / links (CODE_TERMS), credentials (SECRET_TERMS), plant security (RESTRICTED_TERMS), certification (CLAIM_TERMS).
create or replace function kafaa_atm_terms(p_kind text) returns text[] language sql immutable set search_path = public as $$
  select case p_kind
    when 'code' then array['http://', 'https://', 'www.', 'ftp://', 'file://', 'javascript:', 'vbscript:', 'data:text', 'data:application', '<script', '<iframe', '<?php', '```', '#!/',
      'eval(', 'exec(', 'require(', 'import(', 'function(', '=>', '${', '{{', '<%', 'powershell', 'cmd.exe', '.exe', '.ps1', '.bat', '.vbs', '.py', '.js',
      'curl ', 'wget ', 'sudo ', 'insert into', 'macro(']
    when 'secret' then array['password', 'passwd', 'api key', 'apikey', 'api_key', 'secret=', 'token=', 'bearer ', 'كلمة المرور', 'كلمة السر']
    when 'restricted' then array['vital area', 'protected area', 'security plan', 'guard force', 'design basis threat', 'safeguards', 'physical protection', 'alarm station', 'access code',
      'firewall rule', 'network diagram', 'ip address', 'control system access', 'plant control network']
    when 'claim' then array['certified', 'certifies', 'compliant', 'complies with', 'approved by fanr', 'fanr approved', 'licensed by', 'معتمد من', 'ممتثل', 'مرخص من']
    else '{}'::text[] end
$$;
create or replace function kafaa_atm_hit(p_text text, p_kind text) returns boolean language sql immutable set search_path = public as $$
  select exists (select 1 from unnest(kafaa_atm_terms(p_kind)) w where strpos(lower(coalesce(p_text, '')), w) > 0)
$$;
-- The twelve text fields joined the way the TS rule joins them (' \n ').
create or replace function kafaa_atm_texts(p jsonb) returns text language sql immutable set search_path = public as $$
  select concat_ws(E' \n ', coalesce(p ->> 'title_en', ''), coalesce(p ->> 'title_ar', ''), coalesce(p ->> 'purpose_en', ''), coalesce(p ->> 'purpose_ar', ''),
    coalesce(p ->> 'data_used_en', ''), coalesce(p ->> 'data_used_ar', ''), coalesce(p ->> 'oversight_en', ''), coalesce(p ->> 'oversight_ar', ''),
    coalesce(p ->> 'benefit_en', ''), coalesce(p ->> 'benefit_ar', ''), coalesce(p ->> 'how_en', ''), coalesce(p ->> 'how_ar', ''))
$$;
-- First problem code of a submitted entry, or null (mirror of automationProblem).
create or replace function kafaa_atm_problem(p jsonb) returns text language plpgsql stable security definer set search_path = public as $$
declare v_sys text; v_texts text;
begin
  if p is null or jsonb_typeof(p) <> 'object' or not kafaa_air_str(p -> 'title_en', 120) or not kafaa_air_str(p -> 'title_ar', 120) then return 'title'; end if;
  if jsonb_typeof(p -> 'kind') is distinct from 'string' or p ->> 'kind' not in ('workflow', 'agent', 'template', 'report') then return 'kind'; end if;
  if not kafaa_air_str(p -> 'purpose_en', 600) or not kafaa_air_str(p -> 'purpose_ar', 600) then return 'purpose'; end if;
  if not kafaa_air_str(p -> 'data_used_en', 400) or not kafaa_air_str(p -> 'data_used_ar', 400) then return 'data'; end if;
  if jsonb_typeof(p -> 'data_classes') is distinct from 'array' or jsonb_array_length(p -> 'data_classes') < 1 or jsonb_array_length(p -> 'data_classes') > 4
     or exists (select 1 from jsonb_array_elements(p -> 'data_classes') c where jsonb_typeof(c) <> 'string' or c #>> '{}' not in ('public', 'internal', 'controlled_docs', 'personal'))
     or (select count(distinct c #>> '{}') from jsonb_array_elements(p -> 'data_classes') c) <> jsonb_array_length(p -> 'data_classes') then return 'classes'; end if;
  if jsonb_typeof(p -> 'system_id') is distinct from 'string' then return 'system'; end if;
  select s.status into v_sys from kafaa_ai_systems s where s.id = p ->> 'system_id';
  if v_sys is null then return 'system'; end if;
  if v_sys <> 'published' then return 'system_closed'; end if;
  if jsonb_typeof(p -> 'owner_person_id') is distinct from 'string' or not exists (select 1 from kafaa_people x where x.id = p ->> 'owner_person_id' and x.kind = 'staff' and x.status = 'active') then return 'owner'; end if;
  if not kafaa_air_str(p -> 'oversight_en', 400) or not kafaa_air_str(p -> 'oversight_ar', 400) then return 'oversight'; end if;
  if not kafaa_air_str(p -> 'benefit_en', 300) or not kafaa_air_str(p -> 'benefit_ar', 300) then return 'benefit'; end if;
  if not kafaa_air_str(p -> 'how_en', 600) or not kafaa_air_str(p -> 'how_ar', 600) then return 'how'; end if;
  if not kafaa_air_int(p -> 'min_rung', 1, 3) then return 'rung'; end if;
  if jsonb_typeof(p -> 'action') is distinct from 'string' or p ->> 'action' not in ('draft', 'submit') then return 'action'; end if;
  v_texts := kafaa_atm_texts(p);
  if kafaa_atm_hit(v_texts, 'code') then return 'code'; end if;
  if kafaa_atm_hit(v_texts, 'secret') then return 'secret'; end if;
  if kafaa_atm_hit(v_texts, 'restricted') then return 'restricted'; end if;
  if kafaa_atm_hit(v_texts, 'claim') then return 'claim'; end if;
  return null;
end $$;
create or replace function kafaa_atm_problem_text(p_code text) returns text language sql immutable set search_path = public as $$
  select case p_code
    when 'title' then 'a title in English and Arabic (up to 120 characters)'
    when 'kind' then 'choose workflow, agent, template or report'
    when 'purpose' then 'a purpose in English and Arabic (up to 600 characters)'
    when 'data' then 'the data it uses in English and Arabic (up to 400 characters)'
    when 'classes' then 'choose one or more data classes'
    when 'system' then 'choose the AI-system register entry it runs on'
    when 'system_closed' then 'the AI system must be published in the register (not a draft or retired)'
    when 'owner' then 'the accountable owner must be ENEC staff'
    when 'oversight' then 'the human check on its output in English and Arabic (up to 400 characters)'
    when 'benefit' then 'the expected benefit in English and Arabic (up to 300 characters)'
    when 'how' then 'how to use it in English and Arabic (up to 600 characters)'
    when 'rung' then 'the minimum rung must be 1, 2 or 3'
    when 'action' then 'save as a draft or submit'
    when 'code' then 'metadata only: no code, scripts, links or file names; Kafa''a never runs automations'
    when 'secret' then 'never include credentials or passwords'
    when 'restricted' then 'entries never touch plant security'
    when 'claim' then 'Kafa''a does not certify; remove certification or compliance wording'
    else p_code end
$$;
-- First refusal of a governance decision, or null (mirror of decisionProblem).
create or replace function kafaa_atm_decision_problem(p_status text, p_builder text, p_owner text, p_decision text, p_note jsonb, p_decider text)
returns text language plpgsql immutable set search_path = public as $$
declare n text := case when jsonb_typeof(p_note) = 'string' then btrim(p_note #>> '{}', E' \t\n\r') else '' end;
begin
  if coalesce(p_decision, '') not in ('approve', 'return', 'reject', 'retire') then return 'decision'; end if;
  if p_decider = p_builder or p_decider = p_owner then return 'maker_checker'; end if;
  if (case when p_decision = 'retire' then p_status <> 'approved' else p_status <> 'submitted' end) then return 'state'; end if;
  if length(n) > 400 then return 'note'; end if;
  if p_decision <> 'approve' and length(n) < 5 then return 'note'; end if;
  if kafaa_atm_hit(n, 'code') then return 'code'; end if;
  return null;
end $$;
-- First refusal of an adoption, or null (mirror of adoptProblem).
create or replace function kafaa_atm_adopt_problem(p_status text, p_builder text, p_min_rung integer, p_me text, p_rung integer, p_already boolean, p_note jsonb)
returns text language plpgsql immutable set search_path = public as $$
declare n text := case when jsonb_typeof(p_note) = 'string' then btrim(p_note #>> '{}', E' \t\n\r') else '' end;
begin
  if p_status <> 'approved' then return 'not_approved'; end if;
  if p_builder = p_me then return 'own_build'; end if;
  if p_already then return 'already'; end if;
  if p_rung < p_min_rung then return 'rung_low'; end if;
  if length(n) > 200 or kafaa_atm_hit(n, 'code') then return 'note'; end if;
  return null;
end $$;
-- Builder evidence level: 0 until approved and adopted once; 2 from the first adopter; 3 from 5 (mirror of builderLevel).
create or replace function kafaa_atm_level(p_status text, p_adopters integer) returns integer language sql immutable set search_path = public as $$
  select case when p_status not in ('approved', 'retired') or coalesce(p_adopters, 0) < 1 then 0 when p_adopters >= 5 then 3 else 2 end
$$;
-- Gallery statistics (mirror of galleryStats): entries are tools (not suppressed); people counts under 10 are suppressed;
-- security, safeguards and cyber families are folded into "other".
create or replace function kafaa_atm_stats_core() returns jsonb language sql stable security definer set search_path = public as $$
  with a as (select * from kafaa_automations),
  ad as (select x.*, case when x.family_id is null or x.family_id in ('security', 'safeguards', 'cyber') then 'other' else x.family_id end as fam from kafaa_automation_adoptions x),
  sup as (select 10 as m)
  select jsonb_build_object(
    'entries', (select jsonb_object_agg(s, (select count(*) from a where a.status = s)) from unnest(array['draft', 'submitted', 'returned', 'approved', 'rejected', 'retired']) s),
    'approved', (select count(*) from a where a.status = 'approved'),
    'adoptions', (select count(*) from ad),
    'builders', (select case when count(distinct a.builder_person_id) >= (select m from sup) then count(distinct a.builder_person_id) end from a where a.status = 'approved'),
    'adopters', (select case when count(distinct ad.person_id) >= (select m from sup) then count(distinct ad.person_id) end from ad),
    'credited', (select case when count(distinct a.builder_person_id) >= (select m from sup) then count(distinct a.builder_person_id) end from a
                 where a.status in ('approved', 'retired') and kafaa_atm_level(a.status, a.adoption_count) > 0),
    'families', coalesce((select jsonb_agg(jsonb_build_object('family_id', f.fam, 'adopters', case when f.n >= (select m from sup) then f.n end)
                   order by (f.fam = 'other'), f.fam collate "C")
                 from (select ad.fam, count(distinct ad.person_id)::integer as n from ad group by ad.fam) f), '[]'::jsonb),
    'systems', coalesce((select jsonb_agg(jsonb_build_object('system_id', g.system_id, 'entries', g.e, 'adoptions', g.n) order by g.system_id collate "C")
                 from (select a.system_id, count(*)::integer as e, sum(a.adoption_count)::integer as n from a where a.status = 'approved' group by a.system_id) g), '[]'::jsonb),
    'kinds', (select jsonb_agg(jsonb_build_object('kind', k, 'entries', (select count(*) from a where a.status = 'approved' and a.kind = k)) order by i)
              from unnest(array['workflow', 'agent', 'template', 'report']) with ordinality u(k, i))
  )
$$;

-- ═════════════ RPCs (mirror of src/modules/m29/backend/local.fs80.ts)
-- Save a draft or submit an entry (ai_literacy Own or W: any staff member who builds). Only the builder's own draft or returned entry changes.
create or replace function kafaa_submit_automation(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_given text := nullif(coalesce(p ->> 'id', ''), ''); cur kafaa_automations; v_problem text; v_id text; v_version integer;
  v_status text; v_ts text := to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'); a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('ai.automation.submit', 'automations', v_given, 'not_signed_in', 'Sign in to use the automation gallery'); end if;
  if not kafaa_has_grant('ai_literacy', array['Own', 'W']) then return kafaa_refuse('ai.automation.submit', 'automations', v_given, 'forbidden', 'The automation gallery is for ENEC staff'); end if;
  v_role := kafaa_acting_role('ai_literacy', array['Own', 'W']);
  if v_given is not null then
    select * into cur from kafaa_automations where id = v_given;
    -- someone else's entry reads as not found (the builder is the only editor)
    if cur.id is null or cur.builder_person_id <> me then return kafaa_refuse('ai.automation.submit', 'automations', v_given, 'not_found', 'Gallery entry not found', v_role); end if;
    if cur.status not in ('draft', 'returned') then
      return kafaa_refuse('ai.automation.submit', 'automations', v_given, 'locked', 'Only a draft or returned entry can change; AI governance retires approved entries', v_role); end if;
  end if;
  v_problem := kafaa_atm_problem(p);
  if v_problem is not null then return kafaa_refuse('ai.automation.submit', 'automations', v_given, 'invalid', 'Check the entry: ' || kafaa_atm_problem_text(v_problem), v_role); end if;
  v_id := coalesce(cur.id, 'atm-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  v_version := coalesce(cur.version + 1, 1);
  v_status := case when p ->> 'action' = 'submit' then 'submitted' when cur.status = 'returned' then 'returned' else 'draft' end;
  if cur.id is not null then
    update kafaa_automations set title_en = btrim(p ->> 'title_en', E' \t\n\r'), title_ar = btrim(p ->> 'title_ar', E' \t\n\r'), kind = p ->> 'kind', purpose_en = btrim(p ->> 'purpose_en', E' \t\n\r'), purpose_ar = btrim(p ->> 'purpose_ar', E' \t\n\r'),
      data_used_en = btrim(p ->> 'data_used_en', E' \t\n\r'), data_used_ar = btrim(p ->> 'data_used_ar', E' \t\n\r'), data_classes = array(select jsonb_array_elements_text(p -> 'data_classes')),
      system_id = p ->> 'system_id', owner_person_id = p ->> 'owner_person_id', family_id = (select x.job_family_id from kafaa_people x where x.id = me),
      builder_en = (select x.display_name from kafaa_people x where x.id = me), builder_ar = (select x.display_name_ar from kafaa_people x where x.id = me),
      owner_en = (select x.display_name from kafaa_people x where x.id = p ->> 'owner_person_id'), owner_ar = (select x.display_name_ar from kafaa_people x where x.id = p ->> 'owner_person_id'),
      oversight_en = btrim(p ->> 'oversight_en', E' \t\n\r'), oversight_ar = btrim(p ->> 'oversight_ar', E' \t\n\r'), benefit_en = btrim(p ->> 'benefit_en', E' \t\n\r'), benefit_ar = btrim(p ->> 'benefit_ar', E' \t\n\r'),
      how_en = btrim(p ->> 'how_en', E' \t\n\r'), how_ar = btrim(p ->> 'how_ar', E' \t\n\r'), min_rung = (p ->> 'min_rung')::integer, status = v_status, listed = false, version = v_version, metadata_only = true,
      submitted_at = case when p ->> 'action' = 'submit' then now() else submitted_at end,
      history = history || jsonb_build_array(jsonb_build_object('at', v_ts, 'by', me, 'action', p ->> 'action', 'version', v_version, 'note', '')), updated_at = now()
    where id = v_id;
  else
    insert into kafaa_automations (id, title_en, title_ar, kind, purpose_en, purpose_ar, data_used_en, data_used_ar, data_classes, system_id, builder_person_id, owner_person_id, builder_en, builder_ar, owner_en, owner_ar,
      family_id, oversight_en, oversight_ar, benefit_en, benefit_ar, how_en, how_ar, min_rung, status, listed, version, metadata_only, adoption_count, builder_level, submitted_at, decision_note, history,
      open_read, created_at, updated_at)
    values (v_id, btrim(p ->> 'title_en', E' \t\n\r'), btrim(p ->> 'title_ar', E' \t\n\r'), p ->> 'kind', btrim(p ->> 'purpose_en', E' \t\n\r'), btrim(p ->> 'purpose_ar', E' \t\n\r'), btrim(p ->> 'data_used_en', E' \t\n\r'), btrim(p ->> 'data_used_ar', E' \t\n\r'),
      array(select jsonb_array_elements_text(p -> 'data_classes')), p ->> 'system_id', me, p ->> 'owner_person_id',
      (select x.display_name from kafaa_people x where x.id = me), (select x.display_name_ar from kafaa_people x where x.id = me),
      (select x.display_name from kafaa_people x where x.id = p ->> 'owner_person_id'), (select x.display_name_ar from kafaa_people x where x.id = p ->> 'owner_person_id'),
      (select x.job_family_id from kafaa_people x where x.id = me),
      btrim(p ->> 'oversight_en', E' \t\n\r'), btrim(p ->> 'oversight_ar', E' \t\n\r'), btrim(p ->> 'benefit_en', E' \t\n\r'), btrim(p ->> 'benefit_ar', E' \t\n\r'), btrim(p ->> 'how_en', E' \t\n\r'), btrim(p ->> 'how_ar', E' \t\n\r'), (p ->> 'min_rung')::integer,
      v_status, false, 1, true, 0, 0, case when p ->> 'action' = 'submit' then now() end, '',
      jsonb_build_array(jsonb_build_object('at', v_ts, 'by', me, 'action', p ->> 'action', 'version', 1, 'note', '')), false, now(), now());
  end if;
  a := kafaa_audit('ai.automation.submit', 'automations', v_id, 'ok', 'v' || v_version || ' ' || v_status, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when p ->> 'action' = 'submit' then 'Sent to AI governance' else 'Draft saved' end, a, null,
    jsonb_build_object('id', v_id, 'version', v_version, 'status', v_status));
end $$;

-- AI governance decides (ai_literacy A): approve, return or reject a submitted entry, or retire an approved one. Maker-checker.
create or replace function kafaa_decide_automation(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_given text := nullif(coalesce(p ->> 'id', ''), ''); cur kafaa_automations; v_dec text; v_problem text; v_status text; v_note text;
  v_ts text := to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'); a kafaa_audit_events; l integer; v_led boolean;
begin
  if me is null then return kafaa_refuse('ai.automation.decide', 'automations', v_given, 'not_signed_in', 'Sign in to use the automation gallery'); end if;
  if not kafaa_has_grant('ai_literacy', array['A']) then return kafaa_refuse('ai.automation.decide', 'automations', v_given, 'forbidden', 'Only AI governance (admin) decides gallery entries'); end if;
  v_role := kafaa_acting_role('ai_literacy', array['A']);
  select * into cur from kafaa_automations where id = v_given;
  if cur.id is null then return kafaa_refuse('ai.automation.decide', 'automations', v_given, 'not_found', 'Gallery entry not found', v_role); end if;
  v_dec := case when jsonb_typeof(p -> 'decision') = 'string' then p ->> 'decision' else '' end;
  v_problem := kafaa_atm_decision_problem(cur.status, cur.builder_person_id, cur.owner_person_id, v_dec, p -> 'note', me);
  if v_problem = 'maker_checker' then return kafaa_refuse('ai.automation.decide', 'automations', v_given, 'maker_checker', 'The builder and the accountable owner never decide their own entry', v_role); end if;
  if v_problem = 'state' then return kafaa_refuse('ai.automation.decide', 'automations', v_given, 'invalid', 'This entry is not waiting for that decision', v_role); end if;
  if v_problem = 'note' then return kafaa_refuse('ai.automation.decide', 'automations', v_given, 'invalid', 'Give a reason (5 to 400 characters, plain text) when you return, reject or retire an entry', v_role); end if;
  if v_problem = 'decision' then return kafaa_refuse('ai.automation.decide', 'automations', v_given, 'invalid', 'Choose approve, return, reject or retire', v_role); end if;
  if v_problem is not null then return kafaa_refuse('ai.automation.decide', 'automations', v_given, 'invalid', 'Check the entry: ' || kafaa_atm_problem_text(v_problem), v_role); end if;
  v_status := case v_dec when 'approve' then 'approved' when 'return' then 'returned' when 'reject' then 'rejected' else 'retired' end;
  v_note := case when jsonb_typeof(p -> 'note') = 'string' then btrim(p ->> 'note', E' \t\n\r') else '' end;
  update kafaa_automations set status = v_status, listed = (v_status = 'approved'), decided_by = me, decided_at = now(), decision_note = v_note, updated_at = now(),
    history = history || jsonb_build_array(jsonb_build_object('at', v_ts, 'by', me, 'action', v_dec, 'version', cur.version, 'note', v_note))
  where id = cur.id;
  v_led := v_dec in ('approve', 'retire');
  if v_led then l := kafaa_ledger('kafaa.ai.automation', 'Automation gallery: ' || cur.title_en || ' ' || v_status); end if;
  a := kafaa_audit('ai.automation.decide', 'automations', cur.id, 'ok', v_dec || ' v' || cur.version, case when not v_led then 'not_applicable' when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case v_dec when 'approve' then 'Entry approved and listed' when 'return' then 'Entry returned to the builder' when 'reject' then 'Entry rejected' else 'Entry retired' end, a, l,
    jsonb_build_object('id', cur.id, 'status', v_status, 'decision', v_dec, 'listed', v_status = 'approved'));
end $$;

-- Record that I reuse an approved entry (ai_literacy Own). The first adopter (and the fifth) writes or raises the builder's recorded evidence.
create or replace function kafaa_adopt_automation(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_given text := nullif(coalesce(p ->> 'id', ''), ''); cur kafaa_automations; v_problem text; v_rung integer; v_aid text; v_n integer;
  v_first boolean; v_level integer; v_wrote boolean; v_keep integer; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('ai.automation.adopt', 'automations', v_given, 'not_signed_in', 'Sign in to use the automation gallery'); end if;
  if not kafaa_has_grant('ai_literacy', array['Own']) then return kafaa_refuse('ai.automation.adopt', 'automations', v_given, 'forbidden', 'The automation gallery is for ENEC staff'); end if;
  v_role := kafaa_acting_role('ai_literacy', array['Own']);
  select * into cur from kafaa_automations where id = v_given;
  -- an entry the caller may not read (not listed, not theirs) reads as not found
  if cur.id is null or not (cur.listed or cur.builder_person_id = me) then return kafaa_refuse('ai.automation.adopt', 'automations', v_given, 'not_found', 'Gallery entry not found', v_role); end if;
  v_rung := coalesce((kafaa_ai_rung(me) ->> 'rung')::integer, 0);
  v_problem := kafaa_atm_adopt_problem(cur.status, cur.builder_person_id, cur.min_rung, me, v_rung,
    exists (select 1 from kafaa_automation_adoptions x where x.automation_id = cur.id and x.person_id = me), p -> 'note');
  if v_problem = 'not_approved' then return kafaa_refuse('ai.automation.adopt', 'automations', v_given, 'invalid', 'Only approved entries can be adopted', v_role); end if;
  if v_problem = 'own_build' then return kafaa_refuse('ai.automation.adopt', 'automations', v_given, 'own_build', 'Builders do not adopt their own entry: adoption counts reuse by others', v_role); end if;
  if v_problem = 'already' then return kafaa_refuse('ai.automation.adopt', 'automations', v_given, 'already', 'You have already adopted this entry', v_role); end if;
  if v_problem = 'rung_low' then return kafaa_refuse('ai.automation.adopt', 'automations', v_given, 'rung_low',
    'This entry needs a higher rung on the AI fluency ladder; the sandbox drills and the fitness check help you get there', v_role); end if;
  if v_problem is not null then return kafaa_refuse('ai.automation.adopt', 'automations', v_given, 'invalid', 'Keep the note to 200 characters of plain text', v_role); end if;
  v_aid := 'aad-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
  insert into kafaa_automation_adoptions (id, automation_id, person_id, family_id, adopted_on, note, open_read, created_at)
  values (v_aid, cur.id, me, (select x.job_family_id from kafaa_people x where x.id = me), current_date,
    case when jsonb_typeof(p -> 'note') = 'string' then btrim(p ->> 'note', E' \t\n\r') else '' end, false, now());
  v_n := cur.adoption_count + 1;
  v_first := cur.first_adopted_on is null;
  v_level := kafaa_atm_level(cur.status, v_n);
  v_wrote := v_level > coalesce(cur.builder_level, 0);
  v_keep := greatest(v_level, coalesce(cur.builder_level, 0));
  update kafaa_automations set adoption_count = v_n, first_adopted_on = coalesce(first_adopted_on, current_date), builder_level = v_keep, updated_at = now() where id = cur.id;
  if v_wrote then
    insert into kafaa_skill_evidence (id, person_id, skill_id, kind, ref_table, ref_id, level, basis, status, observed_on, note, recorded_by, active)
    values ('se:ojt:' || cur.id || ':sk-fs-ai-automation', cur.builder_person_id, 'sk-fs-ai-automation', 'ojt', 'automations', cur.id, v_level, 'validated', 'current', current_date,
      'Automation gallery ' || cur.id || ': approved, ' || v_n || ' adopter' || case when v_n = 1 then '' else 's' end, coalesce(cur.decided_by, me), true)
    on conflict (id) do update set level = excluded.level, basis = excluded.basis, status = excluded.status, observed_on = excluded.observed_on, note = excluded.note, active = true;
    perform kafaa_skills_apply(cur.builder_person_id, current_date);
    l := kafaa_ledger('kafaa.ai.builder_credit', 'Automation gallery ' || cur.id || ': builder credit level ' || v_level || ' (' || v_n || ' adopters)');
  end if;
  a := kafaa_audit('ai.automation.adopt', 'automations', cur.id, 'ok', 'adopter ' || v_n || case when v_wrote then ' builder L' || v_level else '' end,
    case when not v_wrote then 'not_applicable' when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when v_wrote then 'Adopted; the builder''s credit was recorded' else 'Adopted' end, a, l,
    jsonb_build_object('id', cur.id, 'adoption_id', v_aid, 'adoption_count', v_n, 'first_adoption', v_first, 'builder_level', v_keep, 'evidence_written', v_wrote));
end $$;

-- Gallery statistics (ai_literacy Agg or A, audit_log R).
create or replace function kafaa_automation_stats() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if kafaa_me() is null then return null; end if;
  if not (kafaa_has_grant('ai_literacy', array['Agg', 'A']) or kafaa_has_grant('audit_log', array['R'])) then return null; end if;
  return kafaa_atm_stats_core() || jsonb_build_object('as_of', to_char(current_date, 'YYYY-MM-DD'));
end $$;

-- ───────────── Grants: internal helpers are not executable by API roles; RPCs only by signed-in users.
revoke all on function kafaa_atm_terms(text), kafaa_atm_hit(text, text), kafaa_atm_texts(jsonb), kafaa_atm_problem(jsonb), kafaa_atm_problem_text(text),
  kafaa_atm_decision_problem(text, text, text, text, jsonb, text), kafaa_atm_adopt_problem(text, text, integer, text, integer, boolean, jsonb), kafaa_atm_level(text, integer),
  kafaa_atm_stats_core() from public, anon, authenticated;
revoke all on function kafaa_submit_automation(jsonb), kafaa_decide_automation(jsonb), kafaa_adopt_automation(jsonb), kafaa_automation_stats() from public, anon;
grant execute on function kafaa_submit_automation(jsonb), kafaa_decide_automation(jsonb), kafaa_adopt_automation(jsonb), kafaa_automation_stats() to authenticated;
