-- [G4] Kafa'a M09 partners and suppliers, M11 future workforce.
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object.
-- Self-contained for a live database where only the foundation migrations ran: creates the G4 tables (same DDL as the generated
-- 20261008120100 schema file) with RLS, adds the new columns, then the RPCs. LocalBackend mirror: src/data/local/rpc.g4.ts.
-- Rules: src/domain/partners.ts (M09-R1..R5) and src/domain/future.ts.

-- ───────────── G4 tables (generated DDL; policies created only when missing)
-- M09 · Supplier onboarding document checklist with review evidence
create table if not exists kafaa_supplier_documents (
  id text primary key,
  org_id text not null,
  doc_key text not null,
  required boolean not null default true,
  step_key text not null,
  status text not null default 'missing' check (status in ('missing', 'uploaded', 'accepted', 'rejected')),
  file_name text,
  size_kb integer,
  sha256 text,
  uploaded_at timestamptz,
  uploaded_by text,
  reviewed_at timestamptz,
  reviewed_by text,
  review_note text
);
comment on table kafaa_supplier_documents is '[M09] Supplier onboarding document checklist with review evidence';
-- M09 · Supplier academy knowledge-check questions (concept content)
create table if not exists kafaa_academy_checks (
  id text primary key,
  course_id text not null,
  n integer not null,
  q_en text not null,
  q_ar text not null,
  options jsonb not null default '[]'::jsonb
);
comment on table kafaa_academy_checks is '[M09] Supplier academy knowledge-check questions (concept content)';
-- M09 · Answer keys for supplier academy checks (read by RPC only)
create table if not exists kafaa_academy_check_keys (
  id text primary key,
  check_id text not null,
  answer integer not null
);
comment on table kafaa_academy_check_keys is '[M09] Answer keys for supplier academy checks (read by RPC only)';
-- M11 · Skill areas per technology family and how they relate to APR-1400 skills
create table if not exists kafaa_adv_skills (
  id text primary key,
  tech_id text not null,
  skill_en text not null,
  skill_ar text not null,
  area text not null check (area in ('physics', 'chemistry', 'materials', 'operations', 'maintenance', 'licensing', 'digital', 'project', 'safety')),
  relation text not null check (relation in ('transfers', 'adapts', 'new')),
  note_en text not null default '',
  note_ar text not null default '',
  sort integer not null default 0
);
comment on table kafaa_adv_skills is '[M11] Skill areas per technology family and how they relate to APR-1400 skills';
-- M11 · Future-role catalogue (concept roles; no headcount, sites or dates)
create table if not exists kafaa_future_roles (
  id text primary key,
  tech_ids text[] not null default '{}'::text[],
  title_en text not null,
  title_ar text not null,
  summary_en text not null,
  summary_ar text not null,
  from_role_ids text[] not null default '{}'::text[],
  skill_ids text[] not null default '{}'::text[],
  horizon text not null check (horizon in ('watch', 'explore', 'prepare')),
  family_id text,
  sort integer not null default 0
);
comment on table kafaa_future_roles is '[M11] Future-role catalogue (concept roles; no headcount, sites or dates)';
-- M11 · Learning tracks on advanced reactor fundamentals (concept content)
create table if not exists kafaa_adv_tracks (
  id text primary key,
  title_en text not null,
  title_ar text not null,
  summary_en text not null,
  summary_ar text not null,
  audience text not null check (audience in ('students', 'staff', 'all')),
  level text not null check (level in ('intro', 'intermediate')),
  tech_ids text[] not null default '{}'::text[],
  modules jsonb not null default '[]'::jsonb,
  course_id text,
  hours numeric not null default 0,
  sources jsonb not null default '[]'::jsonb,
  sort integer not null default 0
);
comment on table kafaa_adv_tracks is '[M11] Learning tracks on advanced reactor fundamentals (concept content)';
-- M11 · Skills-gap plan actions against SIMULATED scenarios
create table if not exists kafaa_skill_gap_plans (
  id text primary key,
  skill_key text not null,
  scenario text not null,
  action text not null check (action in ('train', 'reskill', 'hire', 'partner', 'research')),
  owner_role text not null,
  target_quarter text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'done')),
  note text not null default '',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
comment on table kafaa_skill_gap_plans is '[M11] Skills-gap plan actions against SIMULATED scenarios';
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_supplier_documents_org_id_fk') then alter table kafaa_supplier_documents add constraint kafaa_supplier_documents_org_id_fk foreign key (org_id) references kafaa_organisations(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_supplier_documents_org_id_idx on kafaa_supplier_documents (org_id);
create index if not exists kafaa_supplier_documents_status_idx on kafaa_supplier_documents (status);
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_academy_checks_course_id_fk') then alter table kafaa_academy_checks add constraint kafaa_academy_checks_course_id_fk foreign key (course_id) references kafaa_courses(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_academy_checks_course_id_idx on kafaa_academy_checks (course_id);
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_academy_check_keys_check_id_fk') then alter table kafaa_academy_check_keys add constraint kafaa_academy_check_keys_check_id_fk foreign key (check_id) references kafaa_academy_checks(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_academy_check_keys_check_id_idx on kafaa_academy_check_keys (check_id);
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_adv_skills_tech_id_fk') then alter table kafaa_adv_skills add constraint kafaa_adv_skills_tech_id_fk foreign key (tech_id) references kafaa_adv_technologies(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_adv_skills_tech_id_idx on kafaa_adv_skills (tech_id);
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_future_roles_family_id_fk') then alter table kafaa_future_roles add constraint kafaa_future_roles_family_id_fk foreign key (family_id) references kafaa_job_families(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_future_roles_family_id_idx on kafaa_future_roles (family_id);
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_adv_tracks_course_id_fk') then alter table kafaa_adv_tracks add constraint kafaa_adv_tracks_course_id_fk foreign key (course_id) references kafaa_courses(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_adv_tracks_course_id_idx on kafaa_adv_tracks (course_id);
create index if not exists kafaa_skill_gap_plans_skill_key_idx on kafaa_skill_gap_plans (skill_key);

-- supplier_documents
alter table kafaa_supplier_documents enable row level security;
do $$ begin if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'kafaa_supplier_documents' and policyname = 'kafaa_read') then
  execute 'create policy kafaa_read on kafaa_supplier_documents for select to anon, authenticated using (kafaa_rule_read(''partner_org'', null::text, org_id, true));';
end if; end $$;
grant select on kafaa_supplier_documents to anon, authenticated;
-- writes: only through SECURITY DEFINER kafaa_* RPCs (consequential action, ledger)

-- academy_checks
alter table kafaa_academy_checks enable row level security;
do $$ begin if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'kafaa_academy_checks' and policyname = 'kafaa_read') then
  execute 'create policy kafaa_read on kafaa_academy_checks for select to anon, authenticated using (kafaa_rule_read(''public_content'', null::text, null::text, true));';
end if; end $$;
grant select on kafaa_academy_checks to anon, authenticated;
-- writes: reference data, no client writes

-- academy_check_keys
alter table kafaa_academy_check_keys enable row level security;
do $$ begin if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'kafaa_academy_check_keys' and policyname = 'kafaa_read') then
  execute 'create policy kafaa_read on kafaa_academy_check_keys for select to anon, authenticated using (kafaa_rule_read(''training'', null::text, null::text, true));';
end if; end $$;
grant select on kafaa_academy_check_keys to anon, authenticated;
-- writes: reference data, no client writes

-- adv_skills
alter table kafaa_adv_skills enable row level security;
do $$ begin if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'kafaa_adv_skills' and policyname = 'kafaa_read') then
  execute 'create policy kafaa_read on kafaa_adv_skills for select to anon, authenticated using (kafaa_rule_read(''public_content'', null::text, null::text, true));';
end if; end $$;
do $$ begin if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'kafaa_adv_skills' and policyname = 'kafaa_insert') then
  execute 'create policy kafaa_insert on kafaa_adv_skills for insert to anon, authenticated with check (kafaa_has_grant(''public_content'', array[''W'',''A'']));';
end if; end $$;
do $$ begin if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'kafaa_adv_skills' and policyname = 'kafaa_update') then
  execute 'create policy kafaa_update on kafaa_adv_skills for update to authenticated using (kafaa_has_grant(''public_content'', array[''W'',''A''])) with check (kafaa_has_grant(''public_content'', array[''W'',''A'']));';
end if; end $$;
grant select, insert, update on kafaa_adv_skills to authenticated;
grant select on kafaa_adv_skills to anon;
do $$ begin if not exists (select 1 from pg_trigger where tgname = 'kafaa_adv_skills_audit') then
  execute 'create trigger kafaa_adv_skills_audit after insert or update on kafaa_adv_skills for each row execute function kafaa_audit_row();';
end if; end $$;

-- future_roles
alter table kafaa_future_roles enable row level security;
do $$ begin if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'kafaa_future_roles' and policyname = 'kafaa_read') then
  execute 'create policy kafaa_read on kafaa_future_roles for select to anon, authenticated using (kafaa_rule_read(''public_content'', null::text, null::text, true));';
end if; end $$;
do $$ begin if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'kafaa_future_roles' and policyname = 'kafaa_insert') then
  execute 'create policy kafaa_insert on kafaa_future_roles for insert to anon, authenticated with check (kafaa_has_grant(''public_content'', array[''W'',''A'']));';
end if; end $$;
do $$ begin if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'kafaa_future_roles' and policyname = 'kafaa_update') then
  execute 'create policy kafaa_update on kafaa_future_roles for update to authenticated using (kafaa_has_grant(''public_content'', array[''W'',''A''])) with check (kafaa_has_grant(''public_content'', array[''W'',''A'']));';
end if; end $$;
grant select, insert, update on kafaa_future_roles to authenticated;
grant select on kafaa_future_roles to anon;
do $$ begin if not exists (select 1 from pg_trigger where tgname = 'kafaa_future_roles_audit') then
  execute 'create trigger kafaa_future_roles_audit after insert or update on kafaa_future_roles for each row execute function kafaa_audit_row();';
end if; end $$;

-- adv_tracks
alter table kafaa_adv_tracks enable row level security;
do $$ begin if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'kafaa_adv_tracks' and policyname = 'kafaa_read') then
  execute 'create policy kafaa_read on kafaa_adv_tracks for select to anon, authenticated using (kafaa_rule_read(''public_content'', null::text, null::text, true));';
end if; end $$;
do $$ begin if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'kafaa_adv_tracks' and policyname = 'kafaa_insert') then
  execute 'create policy kafaa_insert on kafaa_adv_tracks for insert to anon, authenticated with check (kafaa_has_grant(''public_content'', array[''W'',''A'']));';
end if; end $$;
do $$ begin if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'kafaa_adv_tracks' and policyname = 'kafaa_update') then
  execute 'create policy kafaa_update on kafaa_adv_tracks for update to authenticated using (kafaa_has_grant(''public_content'', array[''W'',''A''])) with check (kafaa_has_grant(''public_content'', array[''W'',''A'']));';
end if; end $$;
grant select, insert, update on kafaa_adv_tracks to authenticated;
grant select on kafaa_adv_tracks to anon;
do $$ begin if not exists (select 1 from pg_trigger where tgname = 'kafaa_adv_tracks_audit') then
  execute 'create trigger kafaa_adv_tracks_audit after insert or update on kafaa_adv_tracks for each row execute function kafaa_audit_row();';
end if; end $$;

-- skill_gap_plans
alter table kafaa_skill_gap_plans enable row level security;
do $$ begin if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'kafaa_skill_gap_plans' and policyname = 'kafaa_read') then
  execute 'create policy kafaa_read on kafaa_skill_gap_plans for select to anon, authenticated using (kafaa_has_grant(''workforce_analytics'', array[''Agg'',''R'',''W'',''A'']));';
end if; end $$;
grant select on kafaa_skill_gap_plans to anon, authenticated;
-- writes: only through SECURITY DEFINER kafaa_* RPCs (consequential action, ledger)

-- ───────────── Columns added to G4-owned tables (the generated schema file has them for fresh databases)
alter table kafaa_partner_onboarding add column if not exists history jsonb not null default '[]'::jsonb;
alter table kafaa_equivalency_requests add column if not exists mapping jsonb not null default '[]'::jsonb;
alter table kafaa_equivalency_requests add column if not exists history jsonb not null default '[]'::jsonb;
alter table kafaa_equivalency_requests add column if not exists submitted_by text;
alter table kafaa_icv_plans add column if not exists review_note text;
alter table kafaa_icv_plans add column if not exists submitted_at timestamptz;
alter table kafaa_icv_plans add column if not exists reviewed_by text;
alter table kafaa_icv_plans add column if not exists certificate_sha256 text;
alter table kafaa_future_skills add column if not exists skill_key text not null default '';
alter table kafaa_future_skills add column if not exists readiness numeric;

-- partner_onboarding, equivalency_requests and icv_plans are now RPC-only (schema.ts write mode 'rpc'): a supplier must not be able
-- to set its own case to approved, its own equivalency to equivalent or its own ICV plan to reviewed. Revoking the table privilege
-- closes the direct-write path on databases where the earlier insert/update policies still exist.
revoke insert, update, delete on kafaa_partner_onboarding, kafaa_equivalency_requests, kafaa_icv_plans from anon, authenticated;

-- ───────────── Internal helpers (owner only)
create or replace function kafaa_g4_now() returns text language sql stable set search_path = public as $$
  select to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
$$;
create or replace function kafaa_g4_hist(p_prev jsonb, p_action text, p_status text, p_role text, p_note text) returns jsonb language sql stable set search_path = public as $$
  select coalesce(case when jsonb_typeof(p_prev) = 'array' then p_prev end, '[]'::jsonb)
    || jsonb_build_array(jsonb_build_object('at', kafaa_g4_now(), 'action', p_action, 'status', p_status, 'by_role', p_role, 'note', nullif(p_note, '')))
$$;
create or replace function kafaa_g4_num(p text) returns numeric language sql immutable set search_path = public as $$
  select case when p ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$' then p::numeric end
$$;
-- Document checklist (mirror of DOC_CHECKLIST in src/domain/partners.ts)
create or replace function kafaa_g4_doc_checklist() returns table (doc_key text, step_key text, required boolean, sort integer) language sql immutable set search_path = public as $$
  values ('trade_licence', 'orientation', true, 1), ('company_profile', 'orientation', true, 2), ('qa_manual', 'quality', true, 3),
         ('nqa1_programme', 'quality', true, 4), ('cgd_procedure', 'quality', true, 5), ('cfsi_procedure', 'quality', true, 6),
         ('iso9001', 'quality', false, 7), ('asme_certificate', 'quality', false, 8), ('defect_reporting_procedure', 'safety_culture', true, 9),
         ('safety_culture_statement', 'safety_culture', true, 10), ('icv_certificate', 'icv', true, 11), ('business_continuity_plan', 'self_assessment', false, 12)
$$;
-- Rule M09-R1 (mirror of readinessState)
create or replace function kafaa_g4_readiness(p_org text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_steps integer; v_docs integer; v_rejected integer; v_icv boolean;
begin
  select count(*) into v_steps from unnest(array['orientation', 'quality', 'safety_culture', 'icv', 'self_assessment']) k
    where not exists (select 1 from kafaa_supplier_readiness s where s.org_id = p_org and s.step_key = k and s.status = 'done');
  select count(*) into v_docs from kafaa_g4_doc_checklist() c
    where c.required and not exists (select 1 from kafaa_supplier_documents d where d.org_id = p_org and d.doc_key = c.doc_key and d.status in ('uploaded', 'accepted'));
  select count(*) into v_rejected from kafaa_supplier_documents d where d.org_id = p_org and d.status = 'rejected';
  select exists (select 1 from kafaa_icv_plans p where p.org_id = p_org and p.status <> 'draft') into v_icv;
  return jsonb_build_object('missing_steps', v_steps, 'missing_docs', v_docs, 'rejected_docs', v_rejected, 'icv_ready', v_icv,
    'ready', v_steps = 0 and v_docs = 0 and v_rejected = 0 and v_icv);
end $$;
-- Rule M09-R2 (mirror of buildSummary): the readiness summary the supplier takes to ENEC's registration process
create or replace function kafaa_g4_summary(p_org text) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'ref', 'KFA-RS-' || upper(left(regexp_replace(o.id, '^org-', ''), 10)) || '-' || to_char(now() at time zone 'utc', 'YYYYMMDD'),
    'generated_at', kafaa_g4_now(), 'org_id', o.id, 'org_name_en', o.name_en, 'org_name_ar', o.name_ar,
    'steps', coalesce((select jsonb_agg(jsonb_build_object('key', s.step_key, 'status', s.status, 'updated_at', s.updated_at)
               order by array_position(array['orientation', 'quality', 'safety_culture', 'icv', 'self_assessment', 'handoff'], s.step_key))
               from kafaa_supplier_readiness s where s.org_id = o.id), '[]'::jsonb),
    'self_assessment', coalesce((select s.self_assessment from kafaa_supplier_readiness s where s.org_id = o.id and s.step_key = 'self_assessment' limit 1), '{}'::jsonb),
    'documents', coalesce((select jsonb_agg(jsonb_build_object('key', d.doc_key, 'status', d.status, 'file_name', d.file_name, 'sha256', d.sha256) order by c.sort)
               from kafaa_supplier_documents d join kafaa_g4_doc_checklist() c on c.doc_key = d.doc_key where d.org_id = o.id), '[]'::jsonb),
    'icv', (select jsonb_build_object('baseline', p.baseline, 'target', p.target, 'target_year', p.target_year, 'status', p.status, 'certificate_valid_to', p.certificate_valid_to)
            from kafaa_icv_plans p where p.org_id = o.id limit 1),
    'academy', coalesce((select jsonb_agg(jsonb_build_object('course_id', c.course_id, 'certificate_no', c.id, 'issued_on', c.issued_on) order by c.course_id)
               from kafaa_certificates c where c.org_id = o.id and c.status = 'valid'), '[]'::jsonb),
    'disclaimer', 'Prepared by Kafa''a for ENEC supplier registration. Kafa''a prepares suppliers; ENEC''s procurement and quality functions qualify them. This summary is not a registration, a qualification or an award.')
  from kafaa_organisations o where o.id = p_org
$$;

-- ───────────── M09 · supplier moves its own onboarding case (start, submit with summary, withdraw)
create or replace function kafaa_partner_onboarding_action(p_id text, p_action text) returns jsonb language plpgsql security definer set search_path = public as $$
declare c kafaa_partner_onboarding; a kafaa_audit_events; l integer; v_role text := kafaa_acting_role('partner_org', array['OrgW']);
  v_act text := 'partner.onboarding.' || coalesce(p_action, ''); v_from text[]; v_to text; r jsonb; v_summary jsonb;
begin
  if v_role is null then return kafaa_refuse(v_act, 'partner_onboarding', p_id, 'forbidden', 'Only your organisation''s partner admin may update the onboarding case'); end if;
  select * into c from kafaa_partner_onboarding where id = p_id;
  if c.id is null or c.org_id is distinct from kafaa_my_org() then return kafaa_refuse(v_act, 'partner_onboarding', p_id, 'not_found', 'Onboarding case not found', v_role); end if;
  if p_action = 'start' then v_from := array['invited', 'returned']; v_to := 'in_progress';
  elsif p_action = 'submit' then v_from := array['in_progress', 'returned']; v_to := 'submitted';
  elsif p_action = 'withdraw' then v_from := array['submitted']; v_to := 'in_progress';
  else return kafaa_refuse(v_act, 'partner_onboarding', p_id, 'invalid', 'Unknown action', v_role); end if;
  if not (c.status = any(v_from)) then
    return kafaa_refuse(v_act, 'partner_onboarding', p_id, 'invalid', format('The case is %s; it cannot be changed this way', replace(c.status, '_', ' ')), v_role);
  end if;
  if p_action = 'submit' then
    r := kafaa_g4_readiness(c.org_id);
    if not (r->>'ready')::boolean then
      return kafaa_refuse(v_act, 'partner_onboarding', p_id, 'invalid', 'Not ready to submit: ' || array_to_string(array_remove(array[
        case when (r->>'missing_steps')::int > 0 then (r->>'missing_steps') || ' readiness step(s) open' end,
        case when (r->>'missing_docs')::int > 0 then (r->>'missing_docs') || ' required document(s) missing' end,
        case when (r->>'rejected_docs')::int > 0 then (r->>'rejected_docs') || ' document(s) rejected' end,
        case when not (r->>'icv_ready')::boolean then 'ICV plan not submitted' end], null), '; '), v_role);
    end if;
    v_summary := kafaa_g4_summary(c.org_id);
    update kafaa_partner_onboarding set status = 'submitted', submitted_at = now(), summary = v_summary,
      history = kafaa_g4_hist(history, 'submit', 'submitted', v_role, 'Readiness summary ' || (v_summary->>'ref')) where id = p_id;
    l := kafaa_ledger('kafaa.partner.submit', format('Supplier readiness %s (%s) submitted: %s', p_id, c.org_id, v_summary->>'ref'));
    a := kafaa_audit(v_act, 'partner_onboarding', p_id, 'ok', 'submitted ' || (v_summary->>'ref'), case when l is null then 'skipped' else 'written' end, l, v_role);
    return kafaa_result(true, 'ok', 'Submitted for ENEC review', a, l, jsonb_build_object('status', 'submitted', 'summary', v_summary));
  end if;
  update kafaa_partner_onboarding set status = v_to, history = kafaa_g4_hist(history, p_action, v_to, v_role, null) where id = p_id;
  a := kafaa_audit(v_act, 'partner_onboarding', p_id, 'ok', c.status || ' -> ' || v_to, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when p_action = 'start' then 'Onboarding started' else 'Submission withdrawn' end, a, null, jsonb_build_object('status', v_to));
end $$;

-- ───────────── M09 · record an uploaded checklist document (metadata and SHA-256 only)
create or replace function kafaa_upload_supplier_document(p_org_id text, p_doc_key text, p_file_name text, p_size_kb numeric, p_sha256 text) returns jsonb language plpgsql security definer set search_path = public as $$
declare a kafaa_audit_events; v_role text := kafaa_acting_role('partner_org', array['OrgW']); v_id text := 'sd-' || coalesce(p_org_id, '') || '-' || coalesce(p_doc_key, '');
  v_def record; v_case kafaa_partner_onboarding; v_name text := trim(coalesce(p_file_name, ''));
begin
  if v_role is null then return kafaa_refuse('partner.document.upload', 'supplier_documents', v_id, 'forbidden', 'Only your organisation''s partner admin may upload documents'); end if;
  if p_org_id is distinct from kafaa_my_org() then return kafaa_refuse('partner.document.upload', 'supplier_documents', v_id, 'not_found', 'Organisation not found', v_role); end if;
  select * into v_def from kafaa_g4_doc_checklist() c where c.doc_key = p_doc_key;
  if v_def.doc_key is null then return kafaa_refuse('partner.document.upload', 'supplier_documents', v_id, 'invalid', 'Unknown checklist document', v_role); end if;
  if v_name = '' or length(v_name) > 200 then return kafaa_refuse('partner.document.upload', 'supplier_documents', v_id, 'invalid', 'A file name of 1 to 200 characters is required', v_role); end if;
  if p_size_kb is null or p_size_kb <= 0 or p_size_kb > 25600 then return kafaa_refuse('partner.document.upload', 'supplier_documents', v_id, 'invalid', 'Files must be larger than 0 and at most 25 MB', v_role); end if;
  if coalesce(p_sha256, '') !~ '^[0-9a-f]{64}$' then return kafaa_refuse('partner.document.upload', 'supplier_documents', v_id, 'invalid', 'A SHA-256 fingerprint of the file is required', v_role); end if;
  select * into v_case from kafaa_partner_onboarding where org_id = p_org_id limit 1;
  if v_case.id is null then return kafaa_refuse('partner.document.upload', 'supplier_documents', v_id, 'not_found', 'No onboarding case for your organisation', v_role); end if;
  if v_case.status not in ('invited', 'in_progress', 'returned') then
    return kafaa_refuse('partner.document.upload', 'supplier_documents', v_id, 'conflict', 'The case is with ENEC or closed; withdraw the submission to change documents', v_role);
  end if;
  insert into kafaa_supplier_documents (id, org_id, doc_key, required, step_key, status, file_name, size_kb, sha256, uploaded_at, uploaded_by)
  values (v_id, p_org_id, p_doc_key, v_def.required, v_def.step_key, 'uploaded', v_name, round(p_size_kb), p_sha256, now(), kafaa_me())
  on conflict (id) do update set status = 'uploaded', file_name = excluded.file_name, size_kb = excluded.size_kb, sha256 = excluded.sha256,
    uploaded_at = excluded.uploaded_at, uploaded_by = excluded.uploaded_by, reviewed_at = null, reviewed_by = null, review_note = null;
  a := kafaa_audit('partner.document.upload', 'supplier_documents', v_id, 'ok', format('%s: %s (%s)', p_doc_key, v_name, left(p_sha256, 12)), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Document recorded', a, null, jsonb_build_object('id', v_id));
end $$;

-- ───────────── M09 · ENEC review of one supplier document
create or replace function kafaa_review_supplier_document(p_id text, p_decision text, p_note text) returns jsonb language plpgsql security definer set search_path = public as $$
declare d kafaa_supplier_documents; a kafaa_audit_events; l integer; v_role text := kafaa_acting_role('partner_org', array['A']);
begin
  if v_role is null then return kafaa_refuse('partner.document.review', 'supplier_documents', p_id, 'forbidden', 'Only a platform admin may review supplier documents'); end if;
  if p_decision not in ('accepted', 'rejected') then return kafaa_refuse('partner.document.review', 'supplier_documents', p_id, 'invalid', 'Decision must be accepted or rejected', v_role); end if;
  select * into d from kafaa_supplier_documents where id = p_id;
  if d.id is null then return kafaa_refuse('partner.document.review', 'supplier_documents', p_id, 'not_found', 'Document not found', v_role); end if;
  if d.org_id = kafaa_my_org() then return kafaa_refuse('partner.document.review', 'supplier_documents', p_id, 'conflict', 'You cannot review your own organisation''s documents', v_role); end if;
  if d.status = 'missing' then return kafaa_refuse('partner.document.review', 'supplier_documents', p_id, 'invalid', 'Nothing has been uploaded yet', v_role); end if;
  if p_decision = 'rejected' and length(trim(coalesce(p_note, ''))) < 5 then
    return kafaa_refuse('partner.document.review', 'supplier_documents', p_id, 'invalid', 'A rejection needs a note the supplier can act on', v_role);
  end if;
  update kafaa_supplier_documents set status = p_decision, reviewed_at = now(), reviewed_by = kafaa_me(), review_note = nullif(p_note, '') where id = p_id;
  l := kafaa_ledger('kafaa.partner.document.' || p_decision, format('Supplier document %s (%s) %s', d.doc_key, d.org_id, p_decision));
  a := kafaa_audit('partner.document.review', 'supplier_documents', p_id, 'ok', d.doc_key || ' ' || p_decision || coalesce(': ' || nullif(p_note, ''), ''), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Review recorded', a, l);
end $$;

-- ───────────── M09 · ICV plan (rule M09-R3, mirror of icvCheck / icvSubmittable)
create or replace function kafaa_save_icv_plan(p_org_id text, p_plan jsonb, p_submit boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare a kafaa_audit_events; l integer; v_role text := kafaa_acting_role('partner_org', array['OrgW']); v_id text := 'icv-' || coalesce(p_org_id, '');
  v_act text := case when p_submit then 'icv.submit' else 'icv.save' end; cur kafaa_icv_plans;
  v_b numeric := kafaa_g4_num(p_plan->>'baseline'); v_t numeric := kafaa_g4_num(p_plan->>'target'); v_y numeric := kafaa_g4_num(p_plan->>'target_year');
  v_levers jsonb := case when jsonb_typeof(p_plan->'levers') = 'array' then p_plan->'levers' else '[]'::jsonb end;
  v_year integer := extract(year from now() at time zone 'utc')::integer; v_sum numeric; v_valid_to date; v_file text; v_problems text[] := '{}'; v_status text;
begin
  if v_role is null then return kafaa_refuse(v_act, 'icv_plans', v_id, 'forbidden', 'Only your organisation''s partner admin may edit the ICV plan'); end if;
  if p_org_id is distinct from kafaa_my_org() then return kafaa_refuse(v_act, 'icv_plans', v_id, 'not_found', 'Organisation not found', v_role); end if;
  if v_b is null or v_b < 0 or v_b > 100 then v_problems := v_problems || 'Baseline must be between 0 and 100'::text; end if;
  if v_t is null or v_b is null or v_t <= v_b or v_t > 100 then v_problems := v_problems || 'Target must be above the baseline and at most 100'::text; end if;
  if v_y is null or v_y < v_year or v_y > v_year + 10 then v_problems := v_problems || 'Target year must be between this year and ten years from now'::text; end if;
  if jsonb_array_length(v_levers) = 0 then v_problems := v_problems || 'Add at least one improvement lever'::text; end if;
  if exists (select 1 from jsonb_array_elements(v_levers) e where coalesce(kafaa_g4_num(e->>'delta'), 0) <= 0 or trim(coalesce(e->>'lever', '')) = '') then
    v_problems := v_problems || 'Each lever needs a name and a positive number of points'::text;
  end if;
  select round(coalesce(sum(coalesce(kafaa_g4_num(e->>'delta'), 0)), 0), 1) into v_sum from jsonb_array_elements(v_levers) e;
  v_file := nullif(trim(coalesce(p_plan->>'certificate_file', '')), '');
  v_valid_to := case when coalesce(p_plan->>'certificate_valid_to', '') ~ '^\d{4}-\d{2}-\d{2}$' then (p_plan->>'certificate_valid_to')::date end;
  if p_submit then
    if v_t is not null and v_b is not null and v_sum < round(v_t - v_b, 1) then v_problems := v_problems || 'The levers do not cover the gap between baseline and target'::text; end if;
    if v_file is null or v_valid_to is null then v_problems := v_problems || 'Upload the current ICV certificate and its validity date'::text;
    elsif v_valid_to < (now() at time zone 'utc')::date then v_problems := v_problems || 'The ICV certificate on file has expired'::text; end if;
  end if;
  if cardinality(v_problems) > 0 then return kafaa_refuse(v_act, 'icv_plans', v_id, 'invalid', array_to_string(v_problems, '; '), v_role); end if;
  select * into cur from kafaa_icv_plans where id = v_id;
  if cur.id is not null and cur.status = 'submitted' and not p_submit then return kafaa_refuse(v_act, 'icv_plans', v_id, 'conflict', 'The plan is with ENEC for review', v_role); end if;
  v_status := case when p_submit then 'submitted' else 'draft' end;
  insert into kafaa_icv_plans (id, org_id, baseline, target, target_year, levers, status, certificate_valid_to, certificate_file, certificate_sha256, submitted_at, reviewed_at, reviewed_by, review_note)
  values (v_id, p_org_id, v_b, v_t, v_y::integer, v_levers, v_status, v_valid_to, v_file, nullif(p_plan->>'certificate_sha256', ''), case when p_submit then now() end, null, null, null)
  on conflict (id) do update set baseline = excluded.baseline, target = excluded.target, target_year = excluded.target_year, levers = excluded.levers, status = excluded.status,
    certificate_valid_to = excluded.certificate_valid_to, certificate_file = excluded.certificate_file, certificate_sha256 = excluded.certificate_sha256,
    submitted_at = coalesce(excluded.submitted_at, kafaa_icv_plans.submitted_at), reviewed_at = null, reviewed_by = null;
  l := case when p_submit then kafaa_ledger('kafaa.icv.submit', format('ICV plan %s: %s -> %s by %s', v_id, v_b, v_t, v_y)) end;
  a := kafaa_audit(v_act, 'icv_plans', v_id, 'ok', format('%s -> %s by %s (%s)', v_b, v_t, v_y, v_status), case when p_submit then (case when l is null then 'skipped' else 'written' end) else 'not_applicable' end, l, v_role);
  return kafaa_result(true, 'ok', case when p_submit then 'Plan submitted for review' else 'Draft saved' end, a, l, jsonb_build_object('id', v_id, 'status', v_status));
end $$;

create or replace function kafaa_review_icv_plan(p_id text, p_decision text, p_note text) returns jsonb language plpgsql security definer set search_path = public as $$
declare p kafaa_icv_plans; a kafaa_audit_events; l integer; v_role text := kafaa_acting_role('partner_org', array['A']);
begin
  if v_role is null then return kafaa_refuse('icv.review', 'icv_plans', p_id, 'forbidden', 'Only a platform admin may review ICV plans'); end if;
  if p_decision not in ('reviewed', 'returned') then return kafaa_refuse('icv.review', 'icv_plans', p_id, 'invalid', 'Decision must be reviewed or returned', v_role); end if;
  select * into p from kafaa_icv_plans where id = p_id;
  if p.id is null then return kafaa_refuse('icv.review', 'icv_plans', p_id, 'not_found', 'ICV plan not found', v_role); end if;
  if p.status <> 'submitted' then return kafaa_refuse('icv.review', 'icv_plans', p_id, 'invalid', 'Only a submitted plan can be reviewed', v_role); end if;
  if p_decision = 'returned' and length(trim(coalesce(p_note, ''))) < 5 then
    return kafaa_refuse('icv.review', 'icv_plans', p_id, 'invalid', 'Returning a plan needs a note the supplier can act on', v_role);
  end if;
  update kafaa_icv_plans set status = case when p_decision = 'reviewed' then 'reviewed' else 'draft' end, reviewed_at = now(), reviewed_by = kafaa_me(), review_note = nullif(p_note, '') where id = p_id;
  l := kafaa_ledger('kafaa.icv.' || p_decision, format('ICV plan %s (%s) %s', p_id, p.org_id, p_decision));
  a := kafaa_audit('icv.review', 'icv_plans', p_id, 'ok', p_decision || coalesce(': ' || nullif(p_note, ''), ''), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when p_decision = 'reviewed' then 'Plan marked reviewed' else 'Plan returned to the supplier' end, a, l);
end $$;

-- ───────────── M09 · contractor equivalency: partner admin submits, ENEC evaluator maps evidence
create or replace function kafaa_submit_equivalency(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare a kafaa_audit_events; v_role text := kafaa_acting_role('equivalency', array['OrgW']); v_org text := kafaa_my_org(); v_id text;
  v_label text := trim(coalesce(p->>'person_label', '')); v_person text := nullif(p->>'person_id', ''); v_std kafaa_qual_standards; v_ev jsonb; v_key text; pe kafaa_people;
begin
  if v_role is null then return kafaa_refuse('equivalency.submit', 'equivalency_requests', null, 'forbidden', 'Only your organisation''s partner admin may submit equivalency requests'); end if;
  if v_label = '' or length(v_label) > 80 then return kafaa_refuse('equivalency.submit', 'equivalency_requests', null, 'invalid', 'A person reference of 1 to 80 characters is required', v_role); end if;
  if v_person is not null then
    select * into pe from kafaa_people where id = v_person;
    if pe.id is null or pe.org_id is distinct from v_org then return kafaa_refuse('equivalency.submit', 'equivalency_requests', v_person, 'not_found', 'Person not found in your organisation', v_role); end if;
  end if;
  select * into v_std from kafaa_qual_standards where id = p->>'standard_id';
  if v_std.id is null or v_std.status <> 'current' then return kafaa_refuse('equivalency.submit', 'equivalency_requests', p->>'standard_id', 'not_found', 'Qualification standard not found', v_role); end if;
  if v_std.security_restricted then return kafaa_refuse('equivalency.submit', 'equivalency_requests', v_std.id, 'invalid', 'Security qualifications are not handled through equivalency in Kafa''a', v_role); end if;
  v_ev := case when jsonb_typeof(p->'evidence') = 'array' then p->'evidence' else '[]'::jsonb end;
  if jsonb_array_length(v_ev) < 1 or jsonb_array_length(v_ev) > 10 then return kafaa_refuse('equivalency.submit', 'equivalency_requests', null, 'invalid', 'Attach between 1 and 10 evidence items', v_role); end if;
  if exists (select 1 from jsonb_array_elements(v_ev) e where trim(coalesce(e->>'name', '')) = '' or coalesce(e->>'kind', '') not in ('certificate', 'training_record', 'reference', 'jpm_record', 'cv', 'other')) then
    return kafaa_refuse('equivalency.submit', 'equivalency_requests', null, 'invalid', 'Each evidence item needs a name and a known kind', v_role);
  end if;
  v_key := coalesce(v_person, lower(v_label));
  if exists (select 1 from kafaa_equivalency_requests r where r.org_id = v_org and r.standard_id = v_std.id and r.status in ('submitted', 'under_review')
             and coalesce(r.person_id, lower(r.person_label)) = v_key) then
    return kafaa_refuse('equivalency.submit', 'equivalency_requests', null, 'conflict', 'An open request already exists for this person and standard', v_role);
  end if;
  v_id := 'eq-' || left(replace(gen_random_uuid()::text, '-', ''), 16);
  insert into kafaa_equivalency_requests (id, org_id, person_id, person_label, standard_id, evidence, status, submitted_at, submitted_by, mapping, history)
  values (v_id, v_org, v_person, v_label, v_std.id,
    (select jsonb_agg(jsonb_build_object('name', trim(e->>'name'), 'kind', e->>'kind', 'sha256', e->>'sha256', 'size_kb', kafaa_g4_num(e->>'size_kb'))) from jsonb_array_elements(v_ev) e),
    'submitted', now(), kafaa_me(), '[]'::jsonb, kafaa_g4_hist('[]'::jsonb, 'submit', 'submitted', v_role, jsonb_array_length(v_ev) || ' evidence items'));
  a := kafaa_audit('equivalency.submit', 'equivalency_requests', v_id, 'ok', format('%s for %s (%s evidence)', v_std.code, v_label, jsonb_array_length(v_ev)), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Request submitted', a, null, jsonb_build_object('id', v_id));
end $$;

create or replace function kafaa_map_equivalency(p_id text, p_mapping jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare r kafaa_equivalency_requests; a kafaa_audit_events; v_role text := kafaa_acting_role('equivalency', array['A']); v_map jsonb; v_n integer; v_total integer; v_cov integer;
begin
  if v_role is null then return kafaa_refuse('equivalency.map', 'equivalency_requests', p_id, 'forbidden', 'Only an ENEC evaluator may map equivalency evidence'); end if;
  select * into r from kafaa_equivalency_requests where id = p_id;
  if r.id is null then return kafaa_refuse('equivalency.map', 'equivalency_requests', p_id, 'not_found', 'Request not found', v_role); end if;
  if not kafaa_has_role('training_manager') and not exists (select 1 from kafaa_evaluator_quals q where q.person_id = kafaa_me() and q.standard_id = r.standard_id and q.valid_to >= current_date) then
    return kafaa_refuse('equivalency.map', 'equivalency_requests', p_id, 'not_evaluator', 'You do not hold the evaluator qualification for this standard', v_role);
  end if;
  if r.status not in ('submitted', 'under_review') then return kafaa_refuse('equivalency.map', 'equivalency_requests', p_id, 'invalid', 'The request has already been decided', v_role); end if;
  v_map := case when jsonb_typeof(p_mapping) = 'array' then p_mapping else '[]'::jsonb end;
  v_n := jsonb_array_length(coalesce(r.evidence, '[]'::jsonb));
  if exists (
    select 1 from jsonb_array_elements(v_map) m
    where not exists (select 1 from kafaa_task_items t where t.id = m->>'task_id' and t.standard_id = r.standard_id)
       or (coalesce((m->>'covered')::boolean, false) and jsonb_array_length(coalesce(case when jsonb_typeof(m->'evidence') = 'array' then m->'evidence' end, '[]'::jsonb)) = 0)
       or exists (select 1 from jsonb_array_elements_text(coalesce(case when jsonb_typeof(m->'evidence') = 'array' then m->'evidence' end, '[]'::jsonb)) i
                  where i !~ '^[0-9]+$' or i::integer >= v_n)) then
    return kafaa_refuse('equivalency.map', 'equivalency_requests', p_id, 'invalid', 'Each mapping row must name a task on this standard, and a covered task must cite at least one evidence item', v_role);
  end if;
  v_map := coalesce((select jsonb_agg(jsonb_build_object('task_id', m->>'task_id', 'covered', coalesce((m->>'covered')::boolean, false),
             'evidence', coalesce(case when jsonb_typeof(m->'evidence') = 'array' then m->'evidence' end, '[]'::jsonb), 'note', left(coalesce(m->>'note', ''), 300)))
           from jsonb_array_elements(v_map) m), '[]'::jsonb);
  select count(*) into v_total from kafaa_task_items t where t.standard_id = r.standard_id;
  select count(*) into v_cov from kafaa_task_items t where t.standard_id = r.standard_id
    and exists (select 1 from jsonb_array_elements(v_map) m where m->>'task_id' = t.id and (m->>'covered')::boolean);
  update kafaa_equivalency_requests set mapping = v_map, status = 'under_review',
    history = kafaa_g4_hist(history, 'map', 'under_review', v_role, format('%s/%s tasks covered', v_cov, v_total)) where id = p_id;
  a := kafaa_audit('equivalency.map', 'equivalency_requests', p_id, 'ok', format('%s/%s tasks covered', v_cov, v_total), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Mapping saved', a, null, jsonb_build_object('covered', v_cov, 'total', v_total));
end $$;

-- Redefines the foundation RPC with the G4 rules: decisions are final, and "equivalent" needs every task item covered (rule M09-R4).
create or replace function kafaa_decide_equivalency(p_id text, p_status text, p_note text) returns jsonb language plpgsql security definer set search_path = public as $$
declare r kafaa_equivalency_requests; a kafaa_audit_events; l integer; v_role text := kafaa_acting_role('equivalency', array['A']); v_open integer;
begin
  if v_role is null then return kafaa_refuse('equivalency.decide', 'equivalency_requests', p_id, 'forbidden', 'Only an ENEC evaluator may decide equivalency'); end if;
  if p_status not in ('under_review', 'equivalent', 'training_required', 'rejected') then return kafaa_refuse('equivalency.decide', 'equivalency_requests', p_id, 'invalid', 'Unknown decision', v_role); end if;
  select * into r from kafaa_equivalency_requests where id = p_id;
  if r.id is null then return kafaa_refuse('equivalency.decide', 'equivalency_requests', p_id, 'not_found', 'Request not found', v_role); end if;
  if p_status <> 'under_review' and not kafaa_has_role('training_manager')
     and not exists (select 1 from kafaa_evaluator_quals q where q.person_id = kafaa_me() and q.standard_id = r.standard_id and q.valid_to >= current_date) then
    return kafaa_refuse('equivalency.decide', 'equivalency_requests', p_id, 'not_evaluator', 'You do not hold the evaluator qualification for this standard', v_role);
  end if;
  if p_status <> 'under_review' and coalesce(p_note, '') = '' then return kafaa_refuse('equivalency.decide', 'equivalency_requests', p_id, 'invalid', 'A decision note is required', v_role); end if;
  if r.status in ('equivalent', 'training_required', 'rejected') then return kafaa_refuse('equivalency.decide', 'equivalency_requests', p_id, 'invalid', 'The request has already been decided', v_role); end if;
  if p_status = 'equivalent' then
    select count(*) into v_open from kafaa_task_items t where t.standard_id = r.standard_id
      and not exists (select 1 from jsonb_array_elements(coalesce(r.mapping, '[]'::jsonb)) m where m->>'task_id' = t.id and (m->>'covered')::boolean);
    if v_open > 0 or not exists (select 1 from kafaa_task_items t where t.standard_id = r.standard_id) then
      return kafaa_refuse('equivalency.decide', 'equivalency_requests', p_id, 'invalid', 'Map evidence to every task item before recording an equivalent decision', v_role);
    end if;
  end if;
  update kafaa_equivalency_requests set status = p_status, decision_note = p_note, decider_role = 'Instructor / evaluator', decided_by = kafaa_me(),
    decided_at = case when p_status = 'under_review' then null else now() end, history = kafaa_g4_hist(history, 'decide', p_status, v_role, p_note) where id = p_id;
  l := case when p_status = 'under_review' then null else kafaa_ledger('kafaa.equivalency.decide', format('Equivalency %s (%s, %s): %s', p_id, r.org_id, r.standard_id, p_status)) end;
  a := kafaa_audit('equivalency.decide', 'equivalency_requests', p_id, 'ok', p_status, case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Decision recorded', a, l);
end $$;

-- Redefines the foundation RPC with the G4 rules: a return needs a note; a supplier approval needs every required document accepted
-- and a complete readiness path; a hand-off completes the hand-off step; every decision is added to the supplier-visible history.
create or replace function kafaa_decide_partner_onboarding(p_id text, p_decision text, p_note text) returns jsonb language plpgsql security definer set search_path = public as $$
declare o kafaa_partner_onboarding; a kafaa_audit_events; l integer; v_role text := kafaa_acting_role('partner_org', array['A']); v_open integer;
begin
  if v_role is null then return kafaa_refuse('partner.decide', 'partner_onboarding', p_id, 'forbidden', 'Only a platform admin may decide partner onboarding'); end if;
  if p_decision not in ('approved', 'returned', 'handed_off') then return kafaa_refuse('partner.decide', 'partner_onboarding', p_id, 'invalid', 'Decision must be approved, returned or handed_off', v_role); end if;
  select * into o from kafaa_partner_onboarding where id = p_id;
  if o.id is null then return kafaa_refuse('partner.decide', 'partner_onboarding', p_id, 'not_found', 'Onboarding case not found', v_role); end if;
  if o.org_id = kafaa_my_org() then return kafaa_refuse('partner.decide', 'partner_onboarding', p_id, 'conflict', 'You cannot decide your own organisation''s case', v_role); end if;
  if p_decision = 'handed_off' and o.status <> 'approved' then return kafaa_refuse('partner.decide', 'partner_onboarding', p_id, 'invalid', 'Only an approved case can be handed off', v_role); end if;
  if p_decision in ('approved', 'returned') and o.status not in ('submitted', 'in_progress') then return kafaa_refuse('partner.decide', 'partner_onboarding', p_id, 'invalid', 'Case is not awaiting a decision', v_role); end if;
  if p_decision = 'returned' and length(trim(coalesce(p_note, ''))) < 5 then return kafaa_refuse('partner.decide', 'partner_onboarding', p_id, 'invalid', 'Returning a case needs a note the supplier can act on', v_role); end if;
  if p_decision = 'approved' and o.kind = 'supplier' then
    select count(*) into v_open from kafaa_g4_doc_checklist() c
      where c.required and not exists (select 1 from kafaa_supplier_documents d where d.org_id = o.org_id and d.doc_key = c.doc_key and d.status = 'accepted');
    if v_open > 0 or not (kafaa_g4_readiness(o.org_id)->>'ready')::boolean then
      return kafaa_refuse('partner.decide', 'partner_onboarding', p_id, 'invalid', format('Review the evidence first: %s required document(s) not accepted, or the readiness path is incomplete', v_open), v_role);
    end if;
  end if;
  update kafaa_partner_onboarding set status = p_decision, decided_at = now(), decided_by = kafaa_me(), decision_note = p_note,
    nexus_handoff_ref = case when p_decision = 'handed_off' then '/partner/readiness' else nexus_handoff_ref end,
    history = kafaa_g4_hist(history, p_decision, p_decision, v_role, p_note) where id = p_id;
  if p_decision = 'handed_off' then
    update kafaa_supplier_readiness set status = 'done', evidence = 'NEXUS /partner/readiness', updated_at = now() where org_id = o.org_id and step_key = 'handoff';
  end if;
  l := kafaa_ledger('kafaa.partner.' || p_decision, format('Partner onboarding %s (%s): %s', p_id, o.org_id, coalesce(p_note, '')));
  a := kafaa_audit('partner.decide', 'partner_onboarding', p_id, 'ok', p_decision || coalesce(': ' || p_note, ''), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Decision recorded', a, l);
end $$;

-- ───────────── M09 · supplier academy: enrol, then pass the knowledge check (scored here, rule M09-R5) for an internal course certificate
create or replace function kafaa_enrol_supplier_course(p_course_id text, p_person_id text) returns jsonb language plpgsql security definer set search_path = public as $$
declare a kafaa_audit_events; me text := kafaa_me(); v_role text := kafaa_acting_role('partner_org', array['OwnOrg', 'OrgW']); v_admin text; co kafaa_courses; pe kafaa_people;
  v_target text := coalesce(nullif(p_person_id, ''), kafaa_me()); v_source text := 'self'; v_id text;
begin
  if me is null then return kafaa_refuse('academy.enrol', 'enrolments', p_course_id, 'not_signed_in', 'Sign in to enrol'); end if;
  if v_role is null or not (kafaa_has_role('partner_user') or kafaa_has_role('partner_admin')) then
    return kafaa_refuse('academy.enrol', 'enrolments', p_course_id, 'forbidden', 'The supplier academy is for supplier and contractor accounts');
  end if;
  select * into co from kafaa_courses where id = p_course_id;
  if co.id is null or co.audience <> 'supplier' then return kafaa_refuse('academy.enrol', 'enrolments', p_course_id, 'not_found', 'Supplier course not found', v_role); end if;
  if v_target <> me then
    v_admin := kafaa_acting_role('partner_org', array['OrgW']);
    select * into pe from kafaa_people where id = v_target;
    if v_admin is null then return kafaa_refuse('academy.enrol', 'enrolments', v_target, 'forbidden', 'Only a partner admin may enrol someone else', v_role); end if;
    if pe.id is null or pe.org_id is distinct from kafaa_my_org() then return kafaa_refuse('academy.enrol', 'enrolments', v_target, 'not_found', 'Person not found in your organisation', v_admin); end if;
    v_source := 'partner_admin';
  end if;
  if exists (select 1 from kafaa_enrolments e where e.person_id = v_target and e.course_id = p_course_id and e.status not in ('cancelled', 'failed')) then
    return kafaa_refuse('academy.enrol', 'enrolments', p_course_id, 'conflict', 'Already enrolled in this course', v_role);
  end if;
  v_id := 'en-' || left(replace(gen_random_uuid()::text, '-', ''), 16);
  insert into kafaa_enrolments (id, person_id, course_id, org_id, status, source, assigned_by, due_on, progress_pct)
  values (v_id, v_target, p_course_id, kafaa_my_org(), 'enrolled', v_source, case when v_source = 'partner_admin' then me end, kafaa_add_working_days(current_date, 40), 0);
  a := kafaa_audit('academy.enrol', 'enrolments', v_id, 'ok', format('%s for %s', co.code, case when v_target = me then 'self' else v_target end), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Enrolled', a, null, jsonb_build_object('id', v_id));
end $$;

create or replace function kafaa_complete_supplier_course(p_enrolment_id text, p_answers jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare a kafaa_audit_events; l integer; me text := kafaa_me(); e kafaa_enrolments; co kafaa_courses; pe kafaa_people;
  v_total integer; v_correct integer; v_score integer; v_pass numeric; v_cert text; v_issued date := (now() at time zone 'utc')::date; v_ans jsonb;
begin
  select * into e from kafaa_enrolments where id = p_enrolment_id;
  if me is null or e.id is null or e.person_id is distinct from me then return kafaa_refuse('academy.complete', 'enrolments', p_enrolment_id, 'not_found', 'Enrolment not found'); end if;
  select * into co from kafaa_courses where id = e.course_id;
  if co.id is null or co.audience <> 'supplier' then return kafaa_refuse('academy.complete', 'enrolments', p_enrolment_id, 'not_found', 'Supplier course not found'); end if;
  if e.status = 'completed' then return kafaa_refuse('academy.complete', 'enrolments', p_enrolment_id, 'conflict', 'This course is already completed'); end if;
  if e.status in ('cancelled', 'failed') then return kafaa_refuse('academy.complete', 'enrolments', p_enrolment_id, 'invalid', 'This enrolment is closed'); end if;
  select count(*) into v_total from kafaa_academy_check_keys k join kafaa_academy_checks c on c.id = k.check_id where c.course_id = co.id;
  if v_total = 0 then return kafaa_refuse('academy.complete', 'enrolments', p_enrolment_id, 'invalid', 'This course has no knowledge check yet'); end if;
  v_ans := case when jsonb_typeof(p_answers) = 'array' then p_answers else '[]'::jsonb end;
  select count(*) into v_correct from kafaa_academy_check_keys k join kafaa_academy_checks c on c.id = k.check_id
    where c.course_id = co.id and exists (select 1 from jsonb_array_elements(v_ans) x where x->>'check_id' = k.check_id and kafaa_g4_num(x->>'answer') = k.answer);
  v_score := round(v_correct * 100.0 / v_total);
  v_pass := coalesce(co.pass_mark, 80);
  if v_score < v_pass then
    update kafaa_enrolments set status = 'in_progress', progress_pct = greatest(coalesce(progress_pct, 0), 90), score = v_score where id = e.id;
    a := kafaa_audit('academy.complete', 'enrolments', e.id, 'ok', format('%s not passed: %s%%', co.code, v_score), 'not_applicable', null, null);
    return kafaa_result(true, 'ok', format('Not passed: %s%% (pass mark %s%%). Review the modules and try again.', v_score, v_pass), a, null,
      jsonb_build_object('score', v_score, 'passed', false, 'certificate_no', null));
  end if;
  select * into pe from kafaa_people where id = me;
  v_cert := 'SA-' || to_char(v_issued, 'YYYY') || '-' || upper(left(replace(gen_random_uuid()::text, '-', ''), 8));
  insert into kafaa_certificates (id, person_id, org_id, holder_initials, course_id, issued_on, valid_to, status)
  values (v_cert, me, coalesce(e.org_id, pe.org_id), coalesce(nullif(pe.initials, ''), '—'), co.id, v_issued, (v_issued + make_interval(months => coalesce(co.validity_months, 24)))::date, 'valid');
  update kafaa_enrolments set status = 'completed', progress_pct = 100, completed_at = now(), score = v_score, certificate_no = v_cert where id = e.id;
  l := kafaa_ledger('kafaa.academy.certificate', format('Supplier academy %s certificate %s', co.code, v_cert));
  a := kafaa_audit('academy.complete', 'enrolments', e.id, 'ok', format('%s passed %s%%; %s', co.code, v_score, v_cert), case when l is null then 'skipped' else 'written' end, l, null);
  return kafaa_result(true, 'ok', format('Passed with %s%%. Certificate %s issued.', v_score, v_cert), a, l, jsonb_build_object('score', v_score, 'passed', true, 'certificate_no', v_cert));
end $$;

-- ───────────── M11 · skills-gap plan actions (HR; SIMULATED scenarios, never forecasts)
create or replace function kafaa_save_skill_gap_plan(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare a kafaa_audit_events; v_role text; v_id text := nullif(p->>'id', ''); v_status text := coalesce(nullif(p->>'status', ''), 'draft');
  v_q text := coalesce(p->>'target_quarter', ''); v_year integer := extract(year from now() at time zone 'utc')::integer; v_problems text[] := '{}';
begin
  v_role := case when kafaa_has_role('hr_director') then 'hr_director' when kafaa_has_role('hr_analyst') then 'hr_analyst' end;
  if v_role is null then return kafaa_refuse('future.gap_plan', 'skill_gap_plans', v_id, 'forbidden', 'Only HR (analyst or CHCO office) may plan skills gaps'); end if;
  if coalesce(p->>'skill_key', '') = '' then v_problems := v_problems || 'skill'::text; end if;
  if coalesce(p->>'action', '') not in ('train', 'reskill', 'hire', 'partner', 'research') then v_problems := v_problems || 'action'::text; end if;
  if length(trim(coalesce(p->>'owner_role', ''))) < 3 then v_problems := v_problems || 'owner'::text; end if;
  if v_q !~ '^\d{4}-Q[1-4]$' or left(v_q, 4)::integer < v_year or left(v_q, 4)::integer > v_year + 5 then v_problems := v_problems || 'quarter'::text; end if;
  if cardinality(v_problems) > 0 then return kafaa_refuse('future.gap_plan', 'skill_gap_plans', v_id, 'invalid', 'Check: ' || array_to_string(v_problems, ', '), v_role); end if;
  if not exists (select 1 from kafaa_future_skills f where f.skill_key = p->>'skill_key') then return kafaa_refuse('future.gap_plan', 'skill_gap_plans', null, 'not_found', 'Unknown skill', v_role); end if;
  if v_status not in ('draft', 'active', 'done') then return kafaa_refuse('future.gap_plan', 'skill_gap_plans', null, 'invalid', 'Unknown status', v_role); end if;
  if v_id is not null and exists (select 1 from kafaa_skill_gap_plans where id = v_id) then
    update kafaa_skill_gap_plans set skill_key = p->>'skill_key', scenario = coalesce(p->>'scenario', ''), action = p->>'action', owner_role = trim(p->>'owner_role'),
      target_quarter = v_q, status = v_status, note = left(coalesce(p->>'note', ''), 500), updated_at = now() where id = v_id;
  else
    v_id := 'gp-' || left(replace(gen_random_uuid()::text, '-', ''), 16);
    insert into kafaa_skill_gap_plans (id, skill_key, scenario, action, owner_role, target_quarter, status, note, created_by)
    values (v_id, p->>'skill_key', coalesce(p->>'scenario', ''), p->>'action', trim(p->>'owner_role'), v_q, v_status, left(coalesce(p->>'note', ''), 500), kafaa_me());
  end if;
  a := kafaa_audit('future.gap_plan', 'skill_gap_plans', v_id, 'ok', format('%s %s %s (%s; SIMULATED scenario)', p->>'skill_key', p->>'action', v_q, v_status), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Plan saved', a, null, jsonb_build_object('id', v_id));
end $$;

-- ───────────── Grants: write RPCs for signed-in users only; internal helpers for the owner only
revoke execute on function
  kafaa_partner_onboarding_action(text, text), kafaa_upload_supplier_document(text, text, text, numeric, text), kafaa_review_supplier_document(text, text, text),
  kafaa_save_icv_plan(text, jsonb, boolean), kafaa_review_icv_plan(text, text, text), kafaa_submit_equivalency(jsonb), kafaa_map_equivalency(text, jsonb),
  kafaa_decide_equivalency(text, text, text), kafaa_decide_partner_onboarding(text, text, text), kafaa_enrol_supplier_course(text, text),
  kafaa_complete_supplier_course(text, jsonb), kafaa_save_skill_gap_plan(jsonb)
from public, anon;
grant execute on function
  kafaa_partner_onboarding_action(text, text), kafaa_upload_supplier_document(text, text, text, numeric, text), kafaa_review_supplier_document(text, text, text),
  kafaa_save_icv_plan(text, jsonb, boolean), kafaa_review_icv_plan(text, text, text), kafaa_submit_equivalency(jsonb), kafaa_map_equivalency(text, jsonb),
  kafaa_decide_equivalency(text, text, text), kafaa_decide_partner_onboarding(text, text, text), kafaa_enrol_supplier_course(text, text),
  kafaa_complete_supplier_course(text, jsonb), kafaa_save_skill_gap_plan(jsonb)
to authenticated;
revoke execute on function kafaa_g4_now(), kafaa_g4_hist(jsonb, text, text, text, text), kafaa_g4_num(text), kafaa_g4_doc_checklist(), kafaa_g4_readiness(text), kafaa_g4_summary(text)
from public, anon, authenticated;
