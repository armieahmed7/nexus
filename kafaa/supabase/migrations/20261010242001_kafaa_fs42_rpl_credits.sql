-- FS wave D · E2 (branch fsDe2, module M34) · FS29 Recognition of prior learning (RPL) + FS30 NQF levels and learning credits.
-- Tables: kafaa_rpl_requests (the person + recognition R/W/A), kafaa_rpl_evidence (the person, the supervisor named in an attestation,
-- recognition R/W/A), kafaa_credit_tags (published tags public; audit_log R), kafaa_credit_stacks (public), kafaa_credit_ledger (the
-- person + audit_log R). Writes only through the RPCs below.
-- Rules (mirror of src/modules/m34/rpl.ts and credits.ts; same codes in the same order, same messages):
--   kafaa_rpl_options = rplOptions, kafaa_rpl_check_open = checkOpen, kafaa_rpl_check_attach = checkAttach, kafaa_rpl_check_decide = checkDecide,
--   kafaa_rpl_statement = rplStatement, kafaa_rpl_pack = buildRplPack (with kafaa_rpl_mask = maskFanr), kafaa_cr_compute = creditsFor,
--   kafaa_cr_sync = ledgerDiff + apply, kafaa_cr_check_tag = checkTag.
-- RPCs: kafaa_submit_rpl (open / attach / detach / submit / withdraw; security-restricted records refused), kafaa_attest_rpl (the named
-- supervisor), kafaa_decide_rpl (maker-checker: recommend by one assessor, confirm or return by another, never the person; confirmation
-- writes validated F01 evidence + kafaa_skills_apply, the RPL statement, the credit ledger and a NEXUS ledger row), kafaa_export_rpl
-- (NQC-ready pack: initials, roles, indicative level and credits, no FANR wording), kafaa_rpl_evidence_options (read), kafaa_tag_credit
-- (frameworks W/A), kafaa_sync_credits. Kafa'a is not a licensing, regulatory or awarding authority; NQF levels and credits are indicative.
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file, RLS in the per-statement form.
-- Seed rows: supabase/seed.sql (live: insert ... on conflict do nothing). LocalBackend mirror: src/modules/m34/backend/local.ts.
-- PGlite checks: scripts/validate/fs42-rpl-credits.mjs.

-- ───────────── Tables (generated DDL)

-- M34 · RPL requests: target skill or micro-credential, narrative, maker-checker decision (full, partial, not yet), RPL statement (FS29)
create table if not exists kafaa_rpl_requests (
  id text primary key,
  person_id text not null,
  person_name text not null default '',
  person_name_ar text not null default '',
  person_kind text not null default 'staff' check (person_kind in ('staff', 'contractor')),
  org_id text,
  target_kind text not null check (target_kind in ('skill', 'credential')),
  skill_id text,
  microcred_def_id text,
  level integer,
  target_title_en text not null default '',
  target_title_ar text not null default '',
  target_skill_ids text[] not null default '{}'::text[],
  narrative_en text not null default '',
  narrative_ar text not null default '',
  status text not null default 'draft' check (status in ('draft', 'submitted', 'recommended', 'decided', 'withdrawn')),
  opened_by text not null,
  opened_role text,
  submitted_on date,
  outcome text check (outcome in ('full', 'partial', 'not_yet')),
  credited_level integer,
  hours integer not null default 0,
  nqf_level integer,
  rationale_en text,
  rationale_ar text,
  recommended_by text,
  recommended_role text,
  recommended_on date,
  return_note text,
  return_count integer not null default 0,
  decided_by text,
  decided_role text,
  decided_on date,
  rpl_statement_en text,
  rpl_statement_ar text,
  evidence_ids text[] not null default '{}'::text[],
  export_count integer not null default 0,
  exported_at timestamptz,
  withdrawn_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table kafaa_rpl_requests is '[M34] RPL requests: target skill or micro-credential, narrative, maker-checker decision (full, partial, not yet), RPL statement (FS29)';

-- M34 · RPL evidence packs: OJT practice, simulator debriefs, qualification mirror (qualified or not), engagements, supervisor attestations (FS29)
create table if not exists kafaa_rpl_evidence (
  id text primary key,
  request_id text not null,
  person_id text not null,
  kind text not null check (kind in ('ojt', 'simulator', 'qualification', 'engagement', 'attestation')),
  ref_table text,
  ref_id text,
  title_en text not null,
  title_ar text not null,
  detail_en text not null default '',
  detail_ar text not null default '',
  observed_on date,
  mirror boolean not null default false,
  mirror_status text check (mirror_status in ('qualified', 'not_qualified')),
  skill_ids text[] not null default '{}'::text[],
  attester_id text,
  attester_role_en text,
  attester_role_ar text,
  request_note text,
  attestation_status text check (attestation_status in ('requested', 'confirmed', 'declined')),
  attestation_en text,
  attestation_ar text,
  attested_on date,
  target_title_en text not null default '',
  target_title_ar text not null default '',
  requester_name text not null default '',
  requester_name_ar text not null default '',
  active boolean not null default true,
  added_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table kafaa_rpl_evidence is '[M34] RPL evidence packs: OJT practice, simulator debriefs, qualification mirror (qualified or not), engagements, supervisor attestations (FS29)';

-- M34 · Indicative NQF level and credits (1 credit = 10 notional hours) on courses, pathways and micro-credentials (FS30)
create table if not exists kafaa_credit_tags (
  id text primary key,
  item_kind text not null check (item_kind in ('course', 'pathway', 'microcred')),
  item_id text not null,
  title_en text not null,
  title_ar text not null,
  nqf_level integer not null,
  notional_hours integer not null,
  credits numeric not null,
  indicative boolean not null default true,
  basis_en text not null,
  basis_ar text not null,
  stack_ids text[] not null default '{}'::text[],
  status text not null default 'published' check (status in ('published', 'retired')),
  listed boolean not null default true,
  source_url text not null,
  as_of date not null,
  version integer not null default 1,
  updated_by text,
  updated_at timestamptz not null default now()
);
comment on table kafaa_credit_tags is '[M34] Indicative NQF level and credits (1 credit = 10 notional hours) on courses, pathways and micro-credentials (FS30)';

-- M34 · 30-credit stacks toward an indicative external award with a partner university still to be agreed (FS30)
create table if not exists kafaa_credit_stacks (
  id text primary key,
  title_en text not null,
  title_ar text not null,
  award_en text not null,
  award_ar text not null,
  partner_en text not null,
  partner_ar text not null,
  summary_en text not null,
  summary_ar text not null,
  credits_required integer not null default 30,
  nqf_level integer not null,
  min_item_nqf integer not null default 1,
  rpl_max integer not null default 10,
  skill_ids text[] not null default '{}'::text[],
  status text not null default 'indicative' check (status in ('indicative')),
  source_url text not null,
  as_of date not null,
  benchmark_ids text[] not null default '{}'::text[],
  sort integer not null default 0
);
comment on table kafaa_credit_stacks is '[M34] 30-credit stacks toward an indicative external award with a partner university still to be agreed (FS30)';

-- M34 · Personal credit ledger: one row per completed tagged item and RPL credit; reversed, never deleted (FS30)
create table if not exists kafaa_credit_ledger (
  id text primary key,
  person_id text not null,
  item_kind text not null check (item_kind in ('course', 'pathway', 'microcred', 'rpl')),
  item_id text not null,
  tag_id text,
  title_en text not null,
  title_ar text not null,
  completed_on date not null,
  source_table text not null,
  source_id text not null,
  notional_hours integer not null,
  credits numeric not null,
  nqf_level integer,
  stack_ids text[] not null default '{}'::text[],
  status text not null default 'counted' check (status in ('counted', 'reversed')),
  updated_at timestamptz not null default now()
);
comment on table kafaa_credit_ledger is '[M34] Personal credit ledger: one row per completed tagged item and RPL credit; reversed, never deleted (FS30)';

do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_rpl_requests_person_id_fk') then alter table kafaa_rpl_requests add constraint kafaa_rpl_requests_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_rpl_requests_skill_id_fk') then alter table kafaa_rpl_requests add constraint kafaa_rpl_requests_skill_id_fk foreign key (skill_id) references kafaa_skills(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_rpl_evidence_request_id_fk') then alter table kafaa_rpl_evidence add constraint kafaa_rpl_evidence_request_id_fk foreign key (request_id) references kafaa_rpl_requests(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_rpl_evidence_person_id_fk') then alter table kafaa_rpl_evidence add constraint kafaa_rpl_evidence_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_rpl_evidence_attester_id_fk') then alter table kafaa_rpl_evidence add constraint kafaa_rpl_evidence_attester_id_fk foreign key (attester_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_credit_ledger_person_id_fk') then alter table kafaa_credit_ledger add constraint kafaa_credit_ledger_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_rpl_requests_person_id_idx on kafaa_rpl_requests (person_id);
create index if not exists kafaa_rpl_requests_skill_id_idx on kafaa_rpl_requests (skill_id);
create index if not exists kafaa_rpl_requests_status_idx on kafaa_rpl_requests (status);
create index if not exists kafaa_rpl_evidence_request_id_idx on kafaa_rpl_evidence (request_id);
create index if not exists kafaa_rpl_evidence_person_id_idx on kafaa_rpl_evidence (person_id);
create index if not exists kafaa_rpl_evidence_attester_id_idx on kafaa_rpl_evidence (attester_id);
create index if not exists kafaa_credit_tags_item_id_idx on kafaa_credit_tags (item_id);
create index if not exists kafaa_credit_tags_status_idx on kafaa_credit_tags (status);
create index if not exists kafaa_credit_ledger_person_id_idx on kafaa_credit_ledger (person_id);
create index if not exists kafaa_credit_ledger_status_idx on kafaa_credit_ledger (status);

-- ───────────── RLS (per-statement form). RPL requests: the person (own_profile Own) and recognition R/W/A; evidence also the supervisor
-- named in an attestation; tags: published rows public, all rows audit_log R; stacks public; ledger: the person and audit_log R.
alter table kafaa_rpl_requests enable row level security;
alter table kafaa_rpl_evidence enable row level security;
alter table kafaa_credit_tags enable row level security;
alter table kafaa_credit_stacks enable row level security;
alter table kafaa_credit_ledger enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_rpl_requests' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_rpl_requests for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_rpl_evidence' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_rpl_evidence for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_credit_tags' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_credit_tags for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_credit_stacks' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_credit_stacks for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_credit_ledger' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_credit_ledger for select to anon, authenticated using (false)'; end if;
end $$;
alter policy kafaa_read on kafaa_rpl_requests using ((((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false))) OR ((SELECT kafaa_has_grant('recognition'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))));
alter policy kafaa_read on kafaa_rpl_evidence using ((((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false))) OR (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((attester_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, attester_id, NULL::text, false))) OR ((SELECT kafaa_has_grant('recognition'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))));
alter policy kafaa_read on kafaa_credit_tags using (((COALESCE(listed, false) AND (SELECT kafaa_has_grant('public_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))) OR ((SELECT kafaa_has_grant('audit_log'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))));
alter policy kafaa_read on kafaa_credit_stacks using ((SELECT kafaa_has_grant('public_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text])));
alter policy kafaa_read on kafaa_credit_ledger using ((((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false))) OR ((SELECT kafaa_has_grant('audit_log'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))));
revoke insert, update, delete on kafaa_rpl_requests, kafaa_rpl_evidence, kafaa_credit_tags, kafaa_credit_stacks, kafaa_credit_ledger from anon, authenticated;
grant select on kafaa_rpl_requests, kafaa_rpl_evidence, kafaa_credit_tags, kafaa_credit_stacks, kafaa_credit_ledger to anon, authenticated;

-- ───────────── Integrity: tags are always indicative and their credits follow the hours; a decision is made by two different people
-- (recommender <> confirmer, neither the person); a decided request carries its outcome; ledger credits follow the hours.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'kafaa_credit_tags_indicative_ck') then
    alter table kafaa_credit_tags add constraint kafaa_credit_tags_indicative_ck check (indicative and nqf_level between 1 and 10 and notional_hours between 1 and 1200
      and credits = round(notional_hours / 10.0, 1) and listed = (status = 'published') and source_url ~ '^https://[^[:space:]/$.?#][^[:space:]]*$'); end if;
  if not exists (select 1 from pg_constraint where conname = 'kafaa_rpl_requests_mc_ck') then
    alter table kafaa_rpl_requests add constraint kafaa_rpl_requests_mc_ck check ((decided_by is null or (decided_by <> recommended_by and decided_by <> person_id))
      and (recommended_by is null or recommended_by <> person_id) and (status <> 'decided' or (outcome is not null and decided_by is not null and recommended_by is not null))
      and hours between 0 and 600 and (level is null or level between 1 and 4)); end if;
  if not exists (select 1 from pg_constraint where conname = 'kafaa_credit_ledger_credits_ck') then
    alter table kafaa_credit_ledger add constraint kafaa_credit_ledger_credits_ck check (credits = round(notional_hours / 10.0, 1) and notional_hours >= 0); end if;
  if not exists (select 1 from pg_constraint where conname = 'kafaa_credit_stacks_ck') then
    alter table kafaa_credit_stacks add constraint kafaa_credit_stacks_ck check (credits_required > 0 and rpl_max between 0 and credits_required and nqf_level between 1 and 10
      and source_url ~ '^https://[^[:space:]/$.?#][^[:space:]]*$'); end if;
end $$;
create unique index if not exists kafaa_credit_tags_item_uq on kafaa_credit_tags (item_kind, item_id);

-- ───────────── Internal helpers (not executable by API roles). Mirror of src/modules/m34/rpl.ts and credits.ts.
create or replace function kafaa_rpl_str(p jsonb, k text) returns text language sql immutable set search_path = public as $$
  select case when jsonb_typeof(p->k) = 'string' then btrim(p->>k, E' \t\r\n') else '' end
$$;
create or replace function kafaa_rpl_is_int(v jsonb) returns boolean language sql immutable set search_path = public as $$
  select coalesce(jsonb_typeof(v), '') = 'number' and (v #>> '{}')::numeric = trunc((v #>> '{}')::numeric)
$$;
create or replace function kafaa_rpl_isnull(v jsonb) returns boolean language sql immutable set search_path = public as $$
  select coalesce(jsonb_typeof(v), 'null') = 'null'
$$;
-- rplOptions(): the person's attachable records in display order; restricted rows carry no detail and no skills
create or replace function kafaa_rpl_options(p_person text) returns jsonb language sql stable security definer set search_path = public as $$
  with o as (
    select 1 as rank, 'ojt'::text as kind, 'ojt_logs'::text as ref_table, l.id as ref_id,
      coalesce(t.statement_en, l.task_id) as title_en, coalesce(nullif(t.statement_ar, ''), t.statement_en, l.task_id) as title_ar,
      (case l.mode when 'walkthrough' then 'Walkthrough' when 'simulate' then 'Simulated' when 'perform' then 'Performed' else l.mode end) || ' · acknowledged by the preceptor' as detail_en,
      (case l.mode when 'walkthrough' then 'جولة شرح' when 'simulate' then 'محاكاة' when 'perform' then 'أداء فعلي' else l.mode end) || ' · أقرّها الموجّه' as detail_ar,
      l.on_date as observed_on, false as mirror, null::text as mirror_status, coalesce(st.security_restricted, false) as restricted,
      array(select k.id from kafaa_skills k where l.task_id = any(k.evidence_keys) or l.standard_id = any(k.evidence_keys)) as skill_ids
    from kafaa_ojt_logs l left join kafaa_task_items t on t.id = l.task_id left join kafaa_qual_standards st on st.id = l.standard_id
    where l.person_id = p_person and l.status = 'acknowledged'
    union all
    select 2, 'simulator', 'crew_debrief_members', m.id, coalesce(sc.title_en, m.scenario_id), coalesce(sc.title_ar, m.scenario_id),
      (case m.position when 'ss' then 'Shift supervisor' when 'sro' then 'Senior reactor operator' when 'ro' then 'Reactor operator' when 'sta' then 'Shift technical advisor' when 'lo' then 'Local operator' else m.position end)
        || ' · ' || (case sc.category when 'normal' then 'normal' when 'abnormal' then 'abnormal' when 'emergency' then 'emergency' when 'severe_accident' then 'severe accident' else coalesce(sc.category, '') end) || ' scenario · instructor debrief',
      (case m.position when 'ss' then 'مشرف الوردية' when 'sro' then 'مشغّل مفاعل أول' when 'ro' then 'مشغّل مفاعل' when 'sta' then 'مستشار الوردية الفني' when 'lo' then 'مشغّل محلي' else m.position end)
        || ' · سيناريو ' || (case sc.category when 'normal' then 'عادي' when 'abnormal' then 'غير اعتيادي' when 'emergency' then 'طوارئ' when 'severe_accident' then 'حادث جسيم' else coalesce(sc.category, '') end) || ' · استخلاص مع المدرّب',
      m.held_on, false, null, exists (select 1 from unnest(coalesce(sc.competency_ids, '{}'::text[])) c join kafaa_competencies cp on cp.id = c where cp.domain = 'security'),
      array(select k.id from kafaa_skills k where k.core and k.competency_id = any(coalesce(sc.competency_ids, '{}'::text[])))
    from kafaa_crew_debrief_members m left join kafaa_sim_scenarios sc on sc.id = m.scenario_id
    where m.person_id = p_person and m.present
    union all
    select 3, 'qualification', 'qual_records', q.id, coalesce(st.title_en, q.standard_id), coalesce(st.title_ar, q.standard_id),
      case when q.status in ('qualified', 'renewed', 'due') then 'Mirror of the licensee record: qualified' else 'Mirror of the licensee record: not qualified' end,
      case when q.status in ('qualified', 'renewed', 'due') then 'مرآة سجل جهة التشغيل: مؤهَّل' else 'مرآة سجل جهة التشغيل: غير مؤهَّل' end,
      coalesce(q.qualified_on, (q.last_synced at time zone 'UTC')::date), true, case when q.status in ('qualified', 'renewed', 'due') then 'qualified' else 'not_qualified' end,
      coalesce(st.security_restricted, false) or coalesce(q.security_mirror_only, false),
      array(select e.skill_id from kafaa_skill_evidence e where e.ref_table = 'qual_records' and e.ref_id = q.id and coalesce(e.active, true))
    from kafaa_qual_records q left join kafaa_qual_standards st on st.id = q.standard_id
    where q.person_id = p_person and q.status in ('qualified', 'renewed', 'due', 'expired', 'suspended')
    union all
    select 4, 'engagement', 'opportunity_applications', a.id, coalesce(op.title_en, a.opportunity_id), coalesce(op.title_ar, a.opportunity_id),
      (case op.kind when 'project' then 'Project' when 'outage_support' then 'Outage support' when 'shadowing' then 'Shadowing' when 'oe_review' then 'Operating experience review'
        when 'knowledge_capture' then 'Knowledge capture' when 'outreach' then 'Outreach' when 'research' then 'Research' else 'Gig' end) || ' gig · completed and signed off',
      'مهمة ' || (case op.kind when 'project' then 'مشروع' when 'outage_support' then 'دعم الانقطاع' when 'shadowing' then 'مرافقة' when 'oe_review' then 'مراجعة الخبرة التشغيلية'
        when 'knowledge_capture' then 'توثيق المعرفة' when 'outreach' then 'تواصل' when 'research' then 'بحث' else 'مهمة' end) || ' · مكتملة ومعتمدة',
      (a.completed_at at time zone 'UTC')::date, false, null,
      exists (select 1 from unnest(coalesce(op.skills_gained, '{}'::text[])) x join kafaa_skills k on k.id = x where k.area = 'security'),
      coalesce(op.skills_gained, '{}'::text[])
    from kafaa_opportunity_applications a left join kafaa_opportunities op on op.id = a.opportunity_id
    where a.person_id = p_person and a.status = 'completed'
    union all
    select 4, 'engagement', 'rotation_placements', r.id, r.host_team_en, r.host_team_ar, 'Rotation placement · signed off by the host', 'تدوير وظيفي · اعتمده المضيف',
      r.ends_on, false, null, coalesce(jr.security_sensitive, false),
      array(select coalesce(x->>'skill_id', '') from jsonb_array_elements(case when jsonb_typeof(r.objectives::jsonb) = 'array' then r.objectives::jsonb else '[]'::jsonb end) x)
    from kafaa_rotation_placements r left join kafaa_job_roles jr on jr.id = r.host_role_id
    where r.person_id = p_person and r.status = 'signed_off'
    union all
    select 4, 'engagement', 'contractor_engagements', e.id, e.title_en, e.title_ar, 'Contract engagement ' || e.ref_code || ' · signed off (mirror)', 'مهمة تعاقدية ' || e.ref_code || ' · معتمدة (مرآة)',
      e.ended_on, true, null, coalesce(jr.security_sensitive, false),
      array(select coalesce(x->>'skill_id', '') from jsonb_array_elements(case when jsonb_typeof(e.skills::jsonb) = 'array' then e.skills::jsonb else '[]'::jsonb end) x)
    from kafaa_contractor_engagements e left join kafaa_job_roles jr on jr.id = e.role_id
    where e.person_id = p_person and e.status = 'signed_off'
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'kind', o.kind, 'ref_table', o.ref_table, 'ref_id', o.ref_id,
      'title_en', case when o.restricted then 'Security-restricted record' else o.title_en end,
      'title_ar', case when o.restricted then 'سجل مقيّد أمنياً' else o.title_ar end,
      'detail_en', case when o.restricted then 'Follows the security career path; never part of an RPL pack' else o.detail_en end,
      'detail_ar', case when o.restricted then 'يتبع المسار المهني الأمني؛ لا يدخل أبداً في حزمة الاعتراف' else o.detail_ar end,
      'observed_on', o.observed_on::text, 'mirror', o.mirror, 'mirror_status', case when o.restricted then null else o.mirror_status end,
      'skill_ids', case when o.restricted then '[]'::jsonb else to_jsonb(array(select y.x from (select distinct x from unnest(o.skill_ids) x join kafaa_skills k on k.id = x where k.area <> 'security') y order by y.x collate "C")) end,
      'restricted', o.restricted)
    order by o.rank, o.observed_on desc nulls last, o.ref_table collate "C", o.ref_id collate "C"), '[]'::jsonb)
  from o
$$;

-- checkOpen(): 'ok' or the first failing code, in the TS order
create or replace function kafaa_rpl_check_open(p jsonb, p_me text) returns text language plpgsql stable security definer set search_path = public as $$
declare v_pid text := coalesce(nullif(kafaa_rpl_str(p, 'person_id'), ''), p_me); v_behalf boolean; pe kafaa_people; v_tk text := kafaa_rpl_str(p, 'target_kind');
  sk kafaa_skills; rg kafaa_skill_level_ranges; d kafaa_microcred_defs; v_level int; v_held boolean; v_en text := kafaa_rpl_str(p, 'narrative_en'); v_ar text := kafaa_rpl_str(p, 'narrative_ar');
begin
  v_behalf := v_pid <> p_me;
  if v_behalf and not kafaa_has_grant('recognition', array['A']) then return 'forbidden'; end if;
  if not v_behalf and not kafaa_has_grant('recognition', array['Own']) then return 'forbidden'; end if;
  select * into pe from kafaa_people where id = v_pid;
  if pe.id is null or pe.status <> 'active' or pe.kind not in ('staff', 'contractor') then return 'person'; end if;
  if v_behalf and pe.kind <> 'contractor' then return 'behalf'; end if;
  if v_tk not in ('skill', 'credential') then return 'target'; end if;
  if v_tk = 'skill' then
    select * into sk from kafaa_skills where id = kafaa_rpl_str(p, 'skill_id');
    if sk.id is null then return 'skill'; end if;
    if sk.area = 'security' or coalesce(sk.fs_area, '') = 'cyber_hygiene' then return 'restricted'; end if;
    if sk.lifecycle = 'obsolete' then return 'obsolete'; end if;
    if not kafaa_rpl_is_int(p->'level') or (p->>'level')::numeric < 1 or (p->>'level')::numeric > 4 then return 'level'; end if;
    v_level := (p->>'level')::numeric::int;
    select * into rg from kafaa_skill_level_ranges where skill_id = sk.id;
    if rg.id is not null and (v_level < rg.min_level or v_level > rg.max_level) then return 'level'; end if;
    v_held := exists (select 1 from kafaa_person_skills x where x.person_id = v_pid and x.skill_id = sk.id and coalesce(x.active, true) and x.level >= v_level and x.basis in ('verified', 'evidenced'));
  else
    select * into d from kafaa_microcred_defs where id = kafaa_rpl_str(p, 'microcred_def_id');
    if d.id is null or d.status <> 'current' then return 'credential'; end if;
    if d.area = 'security' or exists (select 1 from jsonb_array_elements(case when jsonb_typeof(d.alignment::jsonb) = 'array' then d.alignment::jsonb else '[]'::jsonb end) a
      join kafaa_skills k on k.id = a->>'skill_id' where k.area = 'security' or coalesce(k.fs_area, '') = 'cyber_hygiene') then return 'restricted'; end if;
    v_held := exists (select 1 from kafaa_microcred_awards x where x.person_id = v_pid and x.def_id = d.id and x.status = 'awarded');
  end if;
  if v_held then return 'held'; end if;
  if exists (select 1 from kafaa_rpl_requests r where r.person_id = v_pid and r.status in ('draft', 'submitted', 'recommended') and r.target_kind = v_tk
    and ((v_tk = 'skill' and r.skill_id = sk.id) or (v_tk = 'credential' and r.microcred_def_id = d.id))) then return 'conflict'; end if;
  if length(v_en) < 20 or length(v_en) > 800 or length(v_ar) > 800 or (length(v_ar) > 0 and length(v_ar) < 20) then return 'narrative'; end if;
  return 'ok';
end $$;
-- checkAttach(): after the RPC's request, owner and state checks; same order as TS
create or replace function kafaa_rpl_check_attach(p jsonb, r kafaa_rpl_requests, p_count int, p_option jsonb) returns text language plpgsql stable security definer set search_path = public as $$
declare v_kind text := kafaa_rpl_str(p, 'kind'); at kafaa_people; v_note text := kafaa_rpl_str(p, 'note');
begin
  if p_count >= 12 then return 'limit'; end if;
  if v_kind not in ('ojt', 'simulator', 'qualification', 'engagement', 'attestation') then return 'kind'; end if;
  if v_kind = 'attestation' then
    select * into at from kafaa_people where id = kafaa_rpl_str(p, 'attester_id');
    if at.id is null or at.kind <> 'staff' or at.status <> 'active' or at.id = r.person_id or at.id = r.opened_by then return 'attester'; end if;
    if exists (select 1 from kafaa_rpl_evidence e where e.request_id = r.id and e.active and e.kind = 'attestation' and e.attester_id = at.id and e.attestation_status is distinct from 'declined') then return 'duplicate'; end if;
    if length(v_note) < 10 or length(v_note) > 400 then return 'note'; end if;
    return 'ok';
  end if;
  if p_option is null or p_option->>'kind' is distinct from v_kind then return 'item'; end if;
  if (p_option->>'restricted')::boolean then return 'security_restricted'; end if;
  if exists (select 1 from kafaa_rpl_evidence e where e.request_id = r.id and e.active and e.ref_table = kafaa_rpl_str(p, 'ref_table') and e.ref_id = kafaa_rpl_str(p, 'ref_id')) then return 'duplicate'; end if;
  return 'ok';
end $$;
-- checkDecide(): for an assessor caller, in the TS order
create or replace function kafaa_rpl_check_decide(p jsonb, r kafaa_rpl_requests, p_me text, p_max_align int) returns text language plpgsql stable security definer set search_path = public as $$
declare v_a text := kafaa_rpl_str(p, 'action'); v_o text := kafaa_rpl_str(p, 'outcome'); v_cl jsonb := p->'credited_level'; v_h jsonb := p->'hours';
  v_en text := kafaa_rpl_str(p, 'rationale_en'); v_ar text := kafaa_rpl_str(p, 'rationale_ar'); v_note text := kafaa_rpl_str(p, 'note'); v_want int := coalesce(r.level, 0);
begin
  if v_a not in ('recommend', 'confirm', 'return') then return 'action'; end if;
  if (v_a = 'recommend' and r.status <> 'submitted') or (v_a <> 'recommend' and r.status <> 'recommended') then return 'state'; end if;
  if r.person_id = p_me then return 'self'; end if;
  if v_a <> 'recommend' and r.recommended_by = p_me then return 'maker_checker'; end if;
  if v_a = 'return' then return case when length(v_note) < 10 or length(v_note) > 400 then 'note' else 'ok' end; end if;
  if v_a = 'confirm' then return 'ok'; end if;
  if v_o not in ('full', 'partial', 'not_yet') then return 'outcome'; end if;
  if r.target_kind = 'skill' then
    if v_o = 'full' and not (kafaa_rpl_is_int(v_cl) and (v_cl #>> '{}')::numeric = v_want) then return 'level'; end if;
    if v_o = 'partial' and not (kafaa_rpl_is_int(v_cl) and (v_cl #>> '{}')::numeric >= 1 and (v_cl #>> '{}')::numeric < v_want) then return 'level'; end if;
    if v_o = 'not_yet' and not kafaa_rpl_isnull(v_cl) then return 'level'; end if;
  else
    if not kafaa_rpl_isnull(v_cl) then return 'level'; end if;
    if v_o = 'partial' and p_max_align < 2 then return 'level'; end if;
  end if;
  if not kafaa_rpl_is_int(v_h) or (v_h #>> '{}')::numeric < 0 or (v_h #>> '{}')::numeric > 600
    or (v_o = 'not_yet' and (v_h #>> '{}')::numeric <> 0) or (v_o <> 'not_yet' and (v_h #>> '{}')::numeric < 1) then return 'hours'; end if;
  if length(v_en) < 20 or length(v_ar) < 20 or length(v_en) > 800 or length(v_ar) > 800 then return 'rationale'; end if;
  return 'ok';
end $$;
create or replace function kafaa_rpl_result_code(c text) returns text language sql immutable set search_path = public as $$
  select case c when 'forbidden' then 'forbidden' when 'behalf' then 'forbidden' when 'skill' then 'not_found' when 'credential' then 'not_found' when 'not_found' then 'not_found'
    when 'item' then 'not_found' when 'owner' then 'forbidden' when 'not_attester' then 'forbidden' when 'restricted' then 'security_restricted' when 'security_restricted' then 'security_restricted'
    when 'obsolete' then 'obsolete' when 'held' then 'not_eligible' when 'conflict' then 'conflict' when 'duplicate' then 'conflict' when 'self' then 'maker_checker'
    when 'maker_checker' then 'maker_checker' when 'limit' then 'limit' when 'state' then 'invalid' else 'invalid' end
$$;
create or replace function kafaa_rpl_message(c text) returns text language sql immutable set search_path = public as $$
  select case c
    when 'not_signed_in' then 'Sign in to work on recognition of prior learning'
    when 'forbidden' then 'Staff open their own RPL requests; assessors open requests on behalf of contractors'
    when 'forbidden_assessor' then 'Only RPL assessors (instructors, the training manager and the HR director) recommend or confirm credit'
    when 'forbidden_export' then 'Only the person and RPL assessors or auditors can export an RPL pack'
    when 'action' then 'Choose a valid action'
    when 'person' then 'Choose an active member of staff or contractor'
    when 'behalf' then 'Assessors open requests on behalf of contractors only; staff open their own'
    when 'target' then 'Choose a skill or a micro-credential'
    when 'skill' then 'Skill not found'
    when 'restricted' then 'Security and cyber-hygiene skills are not recognised individually: they follow the security career path'
    when 'obsolete' then 'This skill is obsolete'
    when 'level' then 'Choose a level from 1 to 4 where the skill exists'
    when 'credential' then 'Choose a current micro-credential'
    when 'held' then 'You already hold this at that level: nothing to recognise'
    when 'conflict' then 'There is already an open RPL request for this'
    when 'narrative' then 'Describe your experience in English (20 to 800 characters); Arabic is optional (20 to 800)'
    when 'not_found' then 'Request or evidence item not found'
    when 'owner' then 'Only the person who opened the request can change it'
    when 'state' then 'This request is not in a state that allows that action'
    when 'limit' then 'An evidence pack holds at most 12 items'
    when 'kind' then 'Choose an evidence type from the list'
    when 'item' then 'That record is not one of your attachable records'
    when 'security_restricted' then 'Security-restricted records cannot be attached to an RPL pack'
    when 'duplicate' then 'That item is already in the pack'
    when 'attester' then 'Choose an active member of staff other than yourself (and other than the assessor who opened the request)'
    when 'note' then 'Give a note of 10 to 400 characters'
    when 'too_few' then 'Attach at least 2 evidence items before submitting'
    when 'records' then 'Attach at least one record (practice, simulator, qualification or engagement), not only attestations'
    when 'not_attester' then 'Only the named supervisor can answer this attestation'
    when 'text' then 'Write the attestation in English (20 to 600 characters; Arabic optional) or a decline note of 10 to 400 characters'
    when 'self' then 'Nobody decides their own RPL request'
    when 'maker_checker' then 'The assessor who recommended this cannot confirm or return it: a second assessor is needed'
    when 'outcome' then 'Choose full, partial or not-yet credit'
    when 'level_decide' then 'Full credit is at the requested level; partial credit is a lower level; not-yet credits no level'
    when 'hours' then 'Give the recognised notional hours as a whole number (1 to 600; 0 for not yet)'
    when 'rationale' then 'Write the rationale in English and Arabic (20 to 800 characters each)'
    else c end
$$;
-- rplStatement(): the stored RPL statement (EN, AR)
create or replace function kafaa_rpl_statement(r kafaa_rpl_requests, p_on date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_n int; v_ken text; v_kar text; v_d text := p_on::text; v_h int := greatest(0, coalesce(r.hours, 0)); v_cr text; v_lv text := ''; v_lva text := ''; v_q text := ''; v_qa text := '';
  v_tail text := 'Kafa''a is not a regulatory or awarding authority.'; v_taila text := 'كفاءة ليست جهة تنظيمية أو مانحة للمؤهلات.';
begin
  select count(*) into v_n from kafaa_rpl_evidence e where e.request_id = r.id and e.active and (e.kind <> 'attestation' or e.attestation_status = 'confirmed');
  select coalesce(string_agg(x.en, ', ' order by x.rk), ''), coalesce(string_agg(x.ar, '، ' order by x.rk), '') into v_ken, v_kar
  from (values (1, 'ojt', 'on-the-job practice', 'الممارسة أثناء العمل'), (2, 'simulator', 'simulator debriefs', 'جلسات استخلاص المحاكي'), (3, 'qualification', 'qualification mirror', 'مرآة سجل التأهيل'),
    (4, 'engagement', 'work engagements', 'مهام العمل'), (5, 'attestation', 'supervisor attestations', 'إفادات المشرفين')) x(rk, k, en, ar)
  where exists (select 1 from kafaa_rpl_evidence e where e.request_id = r.id and e.active and e.kind = x.k and (e.kind <> 'attestation' or e.attestation_status = 'confirmed'));
  v_cr := (v_h / 10)::text || '.' || (v_h % 10)::text;
  if r.outcome = 'not_yet' then
    return jsonb_build_object(
      'en', format('Recognition of prior learning (internal record %s): not yet credited for %s; %s evidence items (%s) were reviewed by two assessors on %s. The rationale names what to add. %s', r.id, r.target_title_en, v_n, v_ken, v_d, v_tail),
      'ar', format('الاعتراف بالتعلم السابق (سجل داخلي %s): لم يُعتمد بعد في %s؛ راجع مقيّمان اثنان %s من عناصر الأدلة (%s) بتاريخ %s. يوضح المبرر ما ينبغي إضافته. %s', r.id, r.target_title_ar, v_n, v_kar, v_d, v_taila));
  end if;
  if r.credited_level is not null then
    v_lv := format(' at level %s (%s)', r.credited_level, case r.credited_level when 1 then 'Awareness' when 2 then 'Practitioner' when 3 then 'Independent' else 'Expert' end);
    v_lva := format(' بالمستوى %s (%s)', r.credited_level, case r.credited_level when 1 then 'إلمام' when 2 then 'ممارس' when 3 then 'مستقل' else 'خبير' end);
  end if;
  if r.nqf_level is not null then v_q := format('NQF level %s, ', r.nqf_level); v_qa := format('المستوى %s في الإطار الوطني للمؤهلات، ', r.nqf_level); end if;
  return jsonb_build_object(
    'en', format('Recognition of prior learning (internal record %s): %s for %s%s, assessed on %s evidence items (%s) and decided by two assessors on %s. Indicative: %s%s credits; indicative until agreed with the NQC and the partner. %s',
      r.id, case when r.outcome = 'full' then 'full credit' else 'partial credit' end, r.target_title_en, v_lv, v_n, v_ken, v_d, v_q, v_cr, v_tail),
    'ar', format('الاعتراف بالتعلم السابق (سجل داخلي %s): %s في %s%s، بناءً على %s من عناصر الأدلة (%s) وبقرار من مقيّمَين اثنين بتاريخ %s. إرشادي: %s%s رصيد؛ إرشادي إلى حين الاتفاق مع المركز الوطني للمؤهلات والشريك. %s',
      r.id, case when r.outcome = 'full' then 'اعتراف كامل' else 'اعتراف جزئي' end, r.target_title_ar, v_lva, v_n, v_kar, v_d, v_qa, v_cr, v_taila));
end $$;
-- maskFanr(): no FANR wording in an export
create or replace function kafaa_rpl_mask(t text) returns text language sql immutable set search_path = public as $$
  select replace(regexp_replace(regexp_replace(t, '\s*\([^)"]*(FANR|Federal Authority for Nuclear Regulation)[^)"]*\)', '', 'gi'),
    '(\mthe )?(FANR|Federal Authority for Nuclear Regulation)', 'the regulator', 'gi'), 'الهيئة الاتحادية للرقابة النووية', 'الجهة الرقابية')
$$;
-- buildRplPack(): NQC-ready export (initials, roles, indicative level and credits, no FANR wording)
create or replace function kafaa_rpl_pack(r kafaa_rpl_requests) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pe kafaa_people; v jsonb;
begin
  select * into pe from kafaa_people where id = r.person_id;
  v := jsonb_build_object(
    'format', 'kafaa-rpl-pack/1', 'reference', r.id,
    'subject', jsonb_build_object('initials', coalesce(pe.initials, ''), 'kind', r.person_kind, 'job_role_id', pe.job_role_id),
    'target', jsonb_build_object('kind', r.target_kind, 'id', case when r.target_kind = 'skill' then r.skill_id else r.microcred_def_id end, 'title_en', r.target_title_en, 'title_ar', r.target_title_ar, 'level_requested', r.level),
    'narrative', jsonb_build_object('en', coalesce(r.narrative_en, ''), 'ar', coalesce(r.narrative_ar, '')),
    'evidence', coalesce((select jsonb_agg(jsonb_build_object('kind', e.kind, 'title_en', e.title_en, 'title_ar', e.title_ar, 'detail_en', e.detail_en, 'detail_ar', e.detail_ar,
        'observed_on', e.observed_on::text, 'mirror_status', e.mirror_status,
        'attestation', case when e.kind = 'attestation' then jsonb_build_object('role_en', coalesce(e.attester_role_en, ''), 'role_ar', coalesce(e.attester_role_ar, ''), 'status', e.attestation_status,
          'text_en', coalesce(e.attestation_en, ''), 'text_ar', coalesce(e.attestation_ar, '')) else null end) order by e.id collate "C")
      from kafaa_rpl_evidence e where e.request_id = r.id and e.active), '[]'::jsonb),
    'decision', jsonb_build_object('outcome', r.outcome, 'credited_level', r.credited_level, 'notional_hours', coalesce(r.hours, 0), 'credits_text', (coalesce(r.hours, 0) / 10)::text || '.' || (coalesce(r.hours, 0) % 10)::text,
      'nqf_level_indicative', r.nqf_level, 'recommended_role', r.recommended_role, 'confirmed_role', r.decided_role, 'decided_on', r.decided_on::text, 'rationale_en', r.rationale_en, 'rationale_ar', r.rationale_ar),
    'statement', jsonb_build_object('en', r.rpl_statement_en, 'ar', r.rpl_statement_ar),
    'frameworks', jsonb_build_array(jsonb_build_object('id', 'UAE-NQF', 'url', 'https://www.wam.ae/en/article/c12hbfm-national-qualifications-centre-discusses'),
      jsonb_build_object('id', 'ILO-RPL', 'url', 'https://www.ilo.org/publications/experience-opportunity-unlocking-skills-through-recognition-prior-learning')),
    'notice', jsonb_build_object(
      'en', 'Prepared by Kafa''a, a concept skills platform, for review by assessors recognised by the National Qualifications Centre (NQC). Kafa''a is not a regulatory or awarding authority; NQF levels and credits are indicative until agreed with the NQC and the partner. Qualification entries mirror the licensee''s records as qualified or not qualified only. Synthetic demo data.',
      'ar', 'أعدّتها كفاءة، وهي منصة مهارات تجريبية، لمراجعة مقيّمين معترف بهم من المركز الوطني للمؤهلات. كفاءة ليست جهة تنظيمية أو مانحة للمؤهلات؛ ومستويات الإطار الوطني والأرصدة إرشادية إلى حين الاتفاق مع المركز والشريك. تعكس بنود التأهيل سجلات جهة التشغيل بصفة مؤهَّل أو غير مؤهَّل فقط. بيانات تجريبية اصطناعية.'));
  return kafaa_rpl_mask(v::text)::jsonb;
end $$;
-- Notification (kind recognition), idempotent by id; row-audit quiet like the LocalBackend.
create or replace function kafaa_rpl_notify(p_id text, p_person text, p_en text, p_ar text, p_link text, p_sev text) returns boolean language plpgsql security definer set search_path = public as $$
declare v_prev text := current_setting('kafaa.seeding', true); n integer;
begin
  if p_person is null or not exists (select 1 from kafaa_people where id = p_person) or exists (select 1 from kafaa_notifications where id = p_id) then return false; end if;
  perform set_config('kafaa.seeding', 'on', true);
  insert into kafaa_notifications (id, person_id, kind, title_en, title_ar, link, severity) values (p_id, p_person, 'recognition', p_en, p_ar, p_link, p_sev) on conflict (id) do nothing;
  get diagnostics n = row_count;
  perform set_config('kafaa.seeding', coalesce(v_prev, ''), true);
  return n > 0;
end $$;
-- Indicative NQF level for a Kafa'a level (lower bound of the FS24 published map)
create or replace function kafaa_cr_nqf(p_level int) returns int language sql immutable set search_path = public as $$
  select case p_level when 1 then 3 when 2 then 4 when 3 then 5 when 4 then 7 else null end
$$;
create or replace function kafaa_rpl_max_align(p_def text) returns int language sql stable security definer set search_path = public as $$
  select coalesce(max(coalesce(nullif(a->>'level', '')::numeric, 1)), 0)::int from kafaa_microcred_defs d,
    jsonb_array_elements(case when jsonb_typeof(d.alignment::jsonb) = 'array' then d.alignment::jsonb else '[]'::jsonb end) a where d.id = p_def and jsonb_typeof(a->'skill_id') = 'string'
$$;

-- ───────────── FS30 rules: creditsFor() = kafaa_cr_compute, ledger sync, tag check
create or replace function kafaa_cr_compute(p_person text) returns jsonb language sql stable security definer set search_path = public as $$
  with t as (select * from kafaa_credit_tags where status = 'published'),
  tr as (select distinct on (x.course_id) x.id, x.course_id, x.completed_on from kafaa_training_records x
    where x.person_id = p_person and x.result in ('passed', 'completed') and x.completed_on is not null order by x.course_id, x.completed_on, x.id collate "C"),
  pe as (select distinct on (x.pathway_id) x.id, x.pathway_id, x.completed_on from kafaa_pathway_enrolments x
    where x.person_id = p_person and x.status = 'completed' and x.completed_on is not null order by x.pathway_id, x.completed_on, x.id collate "C"),
  ma as (select distinct on (x.def_id) x.id, x.def_id, x.issued_on from kafaa_microcred_awards x
    where x.person_id = p_person and x.status = 'awarded' and x.issued_on is not null order by x.def_id, x.issued_on, x.id collate "C"),
  allr as (
    select 'cl:' || p_person || ':course:' || tr.course_id as id, 'course' as item_kind, tr.course_id as item_id, t.id as tag_id, t.title_en, t.title_ar, tr.completed_on::date as completed_on,
      'training_records' as source_table, tr.id as source_id, t.notional_hours, t.nqf_level, t.stack_ids
    from tr join t on t.item_kind = 'course' and t.item_id = tr.course_id
    union all
    select 'cl:' || p_person || ':pathway:' || pe.pathway_id, 'pathway', pe.pathway_id, t.id, t.title_en, t.title_ar, pe.completed_on::date, 'pathway_enrolments', pe.id, t.notional_hours, t.nqf_level, t.stack_ids
    from pe join t on t.item_kind = 'pathway' and t.item_id = pe.pathway_id
    union all
    select 'cl:' || p_person || ':microcred:' || ma.def_id, 'microcred', ma.def_id, t.id, t.title_en, t.title_ar, ma.issued_on::date, 'microcred_awards', ma.id, t.notional_hours, t.nqf_level, t.stack_ids
    from ma join t on t.item_kind = 'microcred' and t.item_id = ma.def_id
    union all
    select 'cl:' || p_person || ':rpl:' || r.id, 'rpl', r.id, null::text, 'RPL: ' || r.target_title_en, 'اعتراف بالتعلم السابق: ' || r.target_title_ar, r.decided_on, 'rpl_requests', r.id, r.hours, r.nqf_level,
      array(select s.id from kafaa_credit_stacks s where s.skill_ids && coalesce(r.target_skill_ids, '{}'::text[]))
    from kafaa_rpl_requests r where r.person_id = p_person and r.status = 'decided' and r.outcome in ('full', 'partial') and r.hours > 0 and r.decided_on is not null
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'person_id', p_person, 'item_kind', x.item_kind, 'item_id', x.item_id, 'tag_id', x.tag_id, 'title_en', x.title_en, 'title_ar', x.title_ar,
    'completed_on', x.completed_on::text, 'source_table', x.source_table, 'source_id', x.source_id, 'notional_hours', x.notional_hours, 'credits', round(x.notional_hours / 10.0, 1),
    'nqf_level', x.nqf_level, 'stack_ids', to_jsonb(array(select y from unnest(coalesce(x.stack_ids, '{}'::text[])) y order by y collate "C"))) order by x.id collate "C"), '[]'::jsonb)
  from allr x
$$;
-- ledgerDiff() + apply: upsert changed rows, mark counted rows that no longer count as reversed. Returns [upserted, reversed].
create or replace function kafaa_cr_sync(p_person text) returns int[] language plpgsql security definer set search_path = public as $$
declare x jsonb; c kafaa_credit_ledger; v_up int := 0; v_rev int := 0; v_ids text[] := '{}'; v_stacks text[];
begin
  for x in select e from jsonb_array_elements(kafaa_cr_compute(p_person)) e loop
    v_ids := v_ids || (x->>'id');
    v_stacks := array(select jsonb_array_elements_text(x->'stack_ids'));
    select * into c from kafaa_credit_ledger where id = x->>'id';
    if c.id is null then
      insert into kafaa_credit_ledger (id, person_id, item_kind, item_id, tag_id, title_en, title_ar, completed_on, source_table, source_id, notional_hours, credits, nqf_level, stack_ids, status, updated_at)
      values (x->>'id', p_person, x->>'item_kind', x->>'item_id', x->>'tag_id', x->>'title_en', x->>'title_ar', (x->>'completed_on')::date, x->>'source_table', x->>'source_id',
        (x->>'notional_hours')::int, (x->>'credits')::numeric, (x->>'nqf_level')::int, v_stacks, 'counted', now());
      v_up := v_up + 1;
    elsif c.status <> 'counted' or c.notional_hours <> (x->>'notional_hours')::int or c.nqf_level is distinct from (x->>'nqf_level')::int or c.tag_id is distinct from (x->>'tag_id')
      or c.completed_on <> (x->>'completed_on')::date or c.source_id <> (x->>'source_id') or c.title_en <> (x->>'title_en')
      or array(select y from unnest(c.stack_ids) y order by y collate "C") <> v_stacks then
      update kafaa_credit_ledger set item_kind = x->>'item_kind', item_id = x->>'item_id', tag_id = x->>'tag_id', title_en = x->>'title_en', title_ar = x->>'title_ar', completed_on = (x->>'completed_on')::date,
        source_table = x->>'source_table', source_id = x->>'source_id', notional_hours = (x->>'notional_hours')::int, credits = (x->>'credits')::numeric, nqf_level = (x->>'nqf_level')::int,
        stack_ids = v_stacks, status = 'counted', updated_at = now() where id = c.id;
      v_up := v_up + 1;
    end if;
  end loop;
  update kafaa_credit_ledger set status = 'reversed', updated_at = now() where person_id = p_person and status = 'counted' and not (id = any(v_ids));
  get diagnostics v_rev = row_count;
  return array[v_up, v_rev];
end $$;
-- checkTag(): 'ok' or the first failing code, in the TS order
create or replace function kafaa_cr_check_tag(p jsonb) returns text language plpgsql stable security definer set search_path = public as $$
declare v_kind text := kafaa_rpl_str(p, 'item_kind'); v_item text := kafaa_rpl_str(p, 'item_id'); v_exists boolean; v_live boolean; cur kafaa_credit_tags; v_en text := kafaa_rpl_str(p, 'basis_en');
  v_ar text := kafaa_rpl_str(p, 'basis_ar'); v_st jsonb := p->'stack_ids';
begin
  if v_kind not in ('course', 'pathway', 'microcred') then return 'kind'; end if;
  if v_kind = 'course' then v_exists := exists (select 1 from kafaa_courses where id = v_item); v_live := v_exists;
  elsif v_kind = 'pathway' then v_exists := exists (select 1 from kafaa_pathways where id = v_item); v_live := exists (select 1 from kafaa_pathways where id = v_item and status = 'published');
  else v_exists := exists (select 1 from kafaa_microcred_defs where id = v_item); v_live := exists (select 1 from kafaa_microcred_defs where id = v_item and status = 'current'); end if;
  if not v_exists then return 'item'; end if;
  if p->'retire' = 'true'::jsonb then
    select * into cur from kafaa_credit_tags where id = 'ct:' || v_kind || ':' || v_item;
    return case when cur.id is not null and cur.status = 'published' then 'ok' else 'not_found' end;
  end if;
  if not v_live then return 'not_live'; end if;
  if not kafaa_rpl_is_int(p->'nqf_level') or (p->>'nqf_level')::numeric < 1 or (p->>'nqf_level')::numeric > 10 then return 'nqf'; end if;
  if not kafaa_rpl_is_int(p->'notional_hours') or (p->>'notional_hours')::numeric < 1 or (p->>'notional_hours')::numeric > 1200 then return 'hours'; end if;
  if length(v_en) < 20 or length(v_ar) < 20 or length(v_en) > 300 or length(v_ar) > 300 then return 'basis'; end if;
  if not kafaa_rpl_isnull(v_st) and (jsonb_typeof(v_st) <> 'array' or jsonb_array_length(v_st) > 4
    or exists (select 1 from jsonb_array_elements(v_st) e where jsonb_typeof(e) <> 'string' or not exists (select 1 from kafaa_credit_stacks s where s.id = e #>> '{}'))
    or (select count(distinct e) from jsonb_array_elements(v_st) e) <> jsonb_array_length(v_st)) then return 'stack'; end if;
  return 'ok';
end $$;
create or replace function kafaa_cr_message(c text) returns text language sql immutable set search_path = public as $$
  select case c
    when 'not_signed_in' then 'Sign in to work with learning credits'
    when 'forbidden' then 'Only framework owners (instructors, the training manager and admins) tag learning with NQF levels and credits'
    when 'forbidden_sync' then 'You can refresh your own credit ledger; framework owners and assessors refresh anyone''s'
    when 'kind' then 'Choose a course, a pathway or a micro-credential'
    when 'item' then 'Learning item not found'
    when 'not_live' then 'Only courses, published pathways and current micro-credentials are tagged'
    when 'not_found' then 'There is no published tag to retire'
    when 'nqf' then 'Choose an indicative NQF level from 1 to 10'
    when 'hours' then 'Give the notional learning hours as a whole number from 1 to 1200 (1 credit = 10 hours)'
    when 'basis' then 'Explain how the level and hours were estimated in English and Arabic (20 to 300 characters each)'
    when 'stack' then 'Choose up to 4 different stacks from the list'
    else c end
$$;
create or replace function kafaa_cr_people() returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(x order by x collate "C"), '{}') from (
    select person_id x from kafaa_training_records union select person_id from kafaa_pathway_enrolments where status = 'completed'
    union select person_id from kafaa_microcred_awards where status = 'awarded' union select person_id from kafaa_rpl_requests where status = 'decided'
    union select person_id from kafaa_credit_ledger) s
$$;

-- ───────────── RPC: FS29 submit (open / attach / detach / submit / withdraw). Audited, no ledger.
create or replace function kafaa_submit_rpl(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_action text; v_a text; v_entity text; v_role text; v_c text; v_pid text; v_behalf boolean; pe kafaa_people; v_tk text; sk kafaa_skills; d kafaa_microcred_defs;
  v_id text; v_n int; r kafaa_rpl_requests; e kafaa_rpl_evidence; v_opt jsonb; v_kind text; at kafaa_people; jr kafaa_job_roles; v_eid text; v_cnt int; x text; a kafaa_audit_events; v_sk text[];
begin
  p := coalesce(p, '{}'::jsonb);
  v_action := kafaa_rpl_str(p, 'action');
  v_a := 'rpl.' || case when v_action in ('open', 'attach', 'detach', 'submit', 'withdraw') then v_action else 'invalid' end;
  v_entity := case when v_action = 'open' then coalesce(nullif(kafaa_rpl_str(p, 'person_id'), ''), me) else nullif(kafaa_rpl_str(p, 'id'), '') end;
  if me is null then return kafaa_refuse(v_a, 'rpl_requests', v_entity, 'not_signed_in', kafaa_rpl_message('not_signed_in')); end if;
  if v_action not in ('open', 'attach', 'detach', 'submit', 'withdraw') then return kafaa_refuse(v_a, 'rpl_requests', v_entity, 'invalid', kafaa_rpl_message('action')); end if;
  if v_action = 'open' then
    v_pid := coalesce(nullif(kafaa_rpl_str(p, 'person_id'), ''), me);
    v_behalf := v_pid <> me;
    v_role := case when v_behalf then kafaa_acting_role('recognition', array['A']) else kafaa_acting_role('recognition', array['Own']) end;
    v_c := kafaa_rpl_check_open(p, me);
    if v_c <> 'ok' then return kafaa_refuse(v_a, 'rpl_requests', v_entity, kafaa_rpl_result_code(v_c), kafaa_rpl_message(v_c), v_role); end if;
    select * into pe from kafaa_people where id = v_pid;
    v_tk := kafaa_rpl_str(p, 'target_kind');
    if v_tk = 'skill' then select * into sk from kafaa_skills where id = kafaa_rpl_str(p, 'skill_id'); v_sk := array[sk.id];
    else
      select * into d from kafaa_microcred_defs where id = kafaa_rpl_str(p, 'microcred_def_id');
      v_sk := array(select z.y from (select distinct a2->>'skill_id' as y from jsonb_array_elements(case when jsonb_typeof(d.alignment::jsonb) = 'array' then d.alignment::jsonb else '[]'::jsonb end) a2
        where jsonb_typeof(a2->'skill_id') = 'string') z order by z.y collate "C");
    end if;
    select count(*) into v_n from kafaa_rpl_requests where person_id = v_pid;
    v_id := 'rpl-' || v_pid || '-' || case when v_n + 1 < 10 then '0' else '' end || (v_n + 1)::text;
    insert into kafaa_rpl_requests (id, person_id, person_name, person_name_ar, person_kind, org_id, target_kind, skill_id, microcred_def_id, level, target_title_en, target_title_ar, target_skill_ids,
      narrative_en, narrative_ar, status, opened_by, opened_role, created_at, updated_at)
    values (v_id, v_pid, coalesce(pe.display_name, ''), coalesce(nullif(pe.display_name_ar, ''), pe.display_name, ''), pe.kind, pe.org_id, v_tk, case when v_tk = 'skill' then sk.id end,
      case when v_tk = 'credential' then d.id end, case when v_tk = 'skill' then (p->>'level')::numeric::int end,
      case when v_tk = 'skill' then sk.name_en else d.title_en end, case when v_tk = 'skill' then sk.name_ar else d.title_ar end, v_sk,
      kafaa_rpl_str(p, 'narrative_en'), kafaa_rpl_str(p, 'narrative_ar'), 'draft', me, v_role, now(), now());
    a := kafaa_audit(v_a, 'rpl_requests', v_id, 'ok', 'opened ' || case when v_tk = 'skill' then sk.id || ' L' || (p->>'level')::numeric::int else d.id end || case when v_behalf then ' for ' || v_pid else '' end, 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'RPL request opened', a, null, jsonb_build_object('id', v_id, 'status', 'draft'));
  end if;
  select * into r from kafaa_rpl_requests where id = kafaa_rpl_str(p, 'id');
  if r.id is null then return kafaa_refuse(v_a, 'rpl_requests', v_entity, 'not_found', kafaa_rpl_message('not_found')); end if;
  if r.opened_by <> me then return kafaa_refuse(v_a, 'rpl_requests', v_entity, 'forbidden', kafaa_rpl_message('owner')); end if;
  v_role := r.opened_role;
  if v_action = 'withdraw' then
    if r.status not in ('draft', 'submitted', 'recommended') then return kafaa_refuse(v_a, 'rpl_requests', v_entity, 'invalid', kafaa_rpl_message('state'), v_role); end if;
    update kafaa_rpl_requests set status = 'withdrawn', withdrawn_on = current_date, updated_at = now() where id = r.id;
    a := kafaa_audit(v_a, 'rpl_requests', r.id, 'ok', 'withdrawn', 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'RPL request withdrawn', a, null, jsonb_build_object('id', r.id, 'status', 'withdrawn'));
  end if;
  if r.status <> 'draft' then return kafaa_refuse(v_a, 'rpl_requests', v_entity, 'invalid', kafaa_rpl_message('state'), v_role); end if;
  if v_action = 'detach' then
    select * into e from kafaa_rpl_evidence where id = kafaa_rpl_str(p, 'evidence_id');
    if e.id is null or e.request_id <> r.id or not e.active then return kafaa_refuse(v_a, 'rpl_requests', v_entity, 'not_found', kafaa_rpl_message('not_found'), v_role); end if;
    update kafaa_rpl_evidence set active = false, updated_at = now() where id = e.id;
    a := kafaa_audit(v_a, 'rpl_evidence', e.id, 'ok', 'detached ' || e.kind, 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Evidence removed from the pack', a, null, jsonb_build_object('id', r.id, 'status', 'draft', 'evidence_id', e.id));
  end if;
  if v_action = 'submit' then
    if (select count(*) from kafaa_rpl_evidence x where x.request_id = r.id and x.active and not (x.kind = 'attestation' and x.attestation_status = 'declined')) < 2 then
      return kafaa_refuse(v_a, 'rpl_requests', v_entity, 'invalid', kafaa_rpl_message('too_few'), v_role); end if;
    if not exists (select 1 from kafaa_rpl_evidence x where x.request_id = r.id and x.active and x.kind <> 'attestation') then
      return kafaa_refuse(v_a, 'rpl_requests', v_entity, 'invalid', kafaa_rpl_message('records'), v_role); end if;
    update kafaa_rpl_requests set status = 'submitted', submitted_on = current_date, updated_at = now() where id = r.id;
    for x in select z.pid from (select distinct ra.person_id as pid from kafaa_role_assignments ra where ra.role = 'training_manager' and ra.status = 'active' and (ra.expires_at is null or ra.expires_at >= current_date)) z order by z.pid collate "C" loop
      if x <> me and x <> r.person_id then perform kafaa_rpl_notify('nt-rpl-' || r.id || '-submitted-' || x, x, 'RPL request to assess: ' || r.target_title_en, 'طلب اعتراف بالتعلم السابق للتقييم: ' || r.target_title_ar, '/recognition/review/' || r.id, 'info'); end if;
    end loop;
    select count(*) into v_cnt from kafaa_rpl_evidence x where x.request_id = r.id and x.active;
    a := kafaa_audit(v_a, 'rpl_requests', r.id, 'ok', 'submitted with ' || v_cnt || ' items', 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'RPL request submitted for assessment', a, null, jsonb_build_object('id', r.id, 'status', 'submitted'));
  end if;
  -- attach
  v_kind := kafaa_rpl_str(p, 'kind');
  select count(*) into v_cnt from kafaa_rpl_evidence x where x.request_id = r.id and x.active;
  if v_kind <> '' and v_kind <> 'attestation' then
    select o into v_opt from jsonb_array_elements(kafaa_rpl_options(r.person_id)) o where o->>'ref_table' = kafaa_rpl_str(p, 'ref_table') and o->>'ref_id' = kafaa_rpl_str(p, 'ref_id') limit 1;
  end if;
  v_c := kafaa_rpl_check_attach(p, r, v_cnt, v_opt);
  if v_c <> 'ok' then return kafaa_refuse(v_a, 'rpl_requests', v_entity, kafaa_rpl_result_code(v_c), kafaa_rpl_message(v_c), v_role); end if;
  select count(*) into v_n from kafaa_rpl_evidence x where x.request_id = r.id;
  v_eid := 'rpe-' || r.id || '-' || case when v_n + 1 < 10 then '0' else '' end || (v_n + 1)::text;
  if v_kind = 'attestation' then
    select * into at from kafaa_people where id = kafaa_rpl_str(p, 'attester_id');
    select * into jr from kafaa_job_roles where id = at.job_role_id;
    insert into kafaa_rpl_evidence (id, request_id, person_id, kind, title_en, title_ar, detail_en, detail_ar, mirror, skill_ids, attester_id, attester_role_en, attester_role_ar, request_note,
      attestation_status, target_title_en, target_title_ar, requester_name, requester_name_ar, active, added_by, created_at, updated_at)
    values (v_eid, r.id, r.person_id, 'attestation', 'Supervisor attestation', 'إفادة المشرف', coalesce(jr.title_en, ''), coalesce(jr.title_ar, ''), false, coalesce(r.target_skill_ids, '{}'), at.id,
      coalesce(jr.title_en, 'Supervisor'), coalesce(jr.title_ar, 'المشرف'), kafaa_rpl_str(p, 'note'), 'requested', r.target_title_en, r.target_title_ar, r.person_name, r.person_name_ar, true, me, now(), now());
    perform kafaa_rpl_notify('nt-rpl-' || v_eid || '-attest', at.id, 'Attestation requested for an RPL pack: ' || r.target_title_en, 'طُلبت إفادتك لحزمة اعتراف بالتعلم السابق: ' || r.target_title_ar, '/my/recognition?tab=attest', 'info');
    a := kafaa_audit(v_a, 'rpl_evidence', v_eid, 'ok', 'attestation requested from ' || at.id, 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Attestation requested', a, null, jsonb_build_object('id', r.id, 'status', 'draft', 'evidence_id', v_eid));
  end if;
  insert into kafaa_rpl_evidence (id, request_id, person_id, kind, ref_table, ref_id, title_en, title_ar, detail_en, detail_ar, observed_on, mirror, mirror_status, skill_ids,
    target_title_en, target_title_ar, requester_name, requester_name_ar, active, added_by, created_at, updated_at)
  values (v_eid, r.id, r.person_id, v_kind, v_opt->>'ref_table', v_opt->>'ref_id', v_opt->>'title_en', v_opt->>'title_ar', v_opt->>'detail_en', v_opt->>'detail_ar', (v_opt->>'observed_on')::date,
    (v_opt->>'mirror')::boolean, v_opt->>'mirror_status', array(select jsonb_array_elements_text(v_opt->'skill_ids')), r.target_title_en, r.target_title_ar, r.person_name, r.person_name_ar, true, me, now(), now());
  a := kafaa_audit(v_a, 'rpl_evidence', v_eid, 'ok', 'attached ' || (v_opt->>'ref_table') || ':' || (v_opt->>'ref_id'), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Evidence attached', a, null, jsonb_build_object('id', r.id, 'status', 'draft', 'evidence_id', v_eid));
end $$;

-- ───────────── RPC: FS29 the named supervisor confirms or declines an attestation. Audited, no ledger.
create or replace function kafaa_attest_rpl(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_eid text; e kafaa_rpl_evidence; r kafaa_rpl_requests; v_role text; v_confirm boolean; v_status text; v_en text; v_ar text; a kafaa_audit_events;
begin
  p := coalesce(p, '{}'::jsonb);
  v_eid := kafaa_rpl_str(p, 'evidence_id');
  if me is null then return kafaa_refuse('rpl.attest', 'rpl_evidence', nullif(v_eid, ''), 'not_signed_in', kafaa_rpl_message('not_signed_in')); end if;
  select * into e from kafaa_rpl_evidence where id = v_eid;
  select * into r from kafaa_rpl_requests where id = e.request_id;
  v_role := kafaa_acting_role('own_profile', array['Own']);
  v_confirm := p->'confirm' = 'true'::jsonb;
  v_en := kafaa_rpl_str(p, 'text_en'); v_ar := kafaa_rpl_str(p, 'text_ar');
  if e.id is null or e.kind <> 'attestation' or not e.active then return kafaa_refuse('rpl.attest', 'rpl_evidence', nullif(v_eid, ''), 'not_found', kafaa_rpl_message('not_found'), v_role); end if;
  if e.attester_id is distinct from me then return kafaa_refuse('rpl.attest', 'rpl_evidence', v_eid, 'forbidden', kafaa_rpl_message('not_attester'), v_role); end if;
  if e.attestation_status is distinct from 'requested' or r.id is null or r.status not in ('draft', 'submitted', 'recommended') then return kafaa_refuse('rpl.attest', 'rpl_evidence', v_eid, 'invalid', kafaa_rpl_message('state'), v_role); end if;
  if (v_confirm and (length(v_en) < 20 or length(v_en) > 600 or length(v_ar) > 600 or (length(v_ar) > 0 and length(v_ar) < 20))) or (not v_confirm and (length(v_en) < 10 or length(v_en) > 400)) then
    return kafaa_refuse('rpl.attest', 'rpl_evidence', v_eid, 'invalid', kafaa_rpl_message('text'), v_role); end if;
  v_status := case when v_confirm then 'confirmed' else 'declined' end;
  update kafaa_rpl_evidence set attestation_status = v_status, attestation_en = v_en, attestation_ar = case when v_confirm then nullif(v_ar, '') else null end, attested_on = current_date, updated_at = now() where id = e.id;
  perform kafaa_rpl_notify('nt-rpl-' || e.id || '-' || v_status, r.opened_by, case when v_confirm then 'Attestation confirmed: ' else 'Attestation declined: ' end || r.target_title_en,
    case when v_confirm then 'تأكدت الإفادة: ' else 'اعتذر المشرف عن الإفادة: ' end || r.target_title_ar, '/my/recognition/rpl/' || r.id, case when v_confirm then 'ok' else 'warn' end);
  a := kafaa_audit('rpl.attest', 'rpl_evidence', e.id, 'ok', v_status, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when v_confirm then 'Attestation confirmed' else 'Attestation declined' end, a, null, jsonb_build_object('id', e.id, 'status', v_status));
end $$;

-- ───────────── RPC: FS29 maker-checker decision (recommend / confirm / return). Confirmation writes validated F01 evidence, recomputes skills,
-- stores the RPL statement, refreshes the credit ledger and writes a NEXUS ledger row.
create or replace function kafaa_decide_rpl(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_action text; v_a text; v_id text; v_role text; r kafaa_rpl_requests; v_c text; v_outcome text; v_cl int; v_nqf int; v_max int; x text; st jsonb;
  v_ids text[] := '{}'; v_ev text; k record; v_prev text := current_setting('kafaa.seeding', true); a kafaa_audit_events; l integer; tg kafaa_credit_tags;
begin
  p := coalesce(p, '{}'::jsonb);
  v_action := kafaa_rpl_str(p, 'action');
  v_a := 'rpl.' || case when v_action in ('recommend', 'confirm', 'return') then v_action else 'invalid' end;
  v_id := kafaa_rpl_str(p, 'id');
  if me is null then return kafaa_refuse(v_a, 'rpl_requests', nullif(v_id, ''), 'not_signed_in', kafaa_rpl_message('not_signed_in')); end if;
  if not kafaa_has_grant('recognition', array['A']) then return kafaa_refuse(v_a, 'rpl_requests', nullif(v_id, ''), 'forbidden', kafaa_rpl_message('forbidden_assessor')); end if;
  v_role := kafaa_acting_role('recognition', array['A']);
  select * into r from kafaa_rpl_requests where id = v_id;
  if r.id is null then return kafaa_refuse(v_a, 'rpl_requests', nullif(v_id, ''), 'not_found', kafaa_rpl_message('not_found'), v_role); end if;
  v_max := case when r.target_kind = 'credential' then kafaa_rpl_max_align(r.microcred_def_id) else 0 end;
  v_c := kafaa_rpl_check_decide(p, r, me, v_max);
  if v_c <> 'ok' then return kafaa_refuse(v_a, 'rpl_requests', r.id, kafaa_rpl_result_code(v_c), kafaa_rpl_message(case when v_c = 'level' then 'level_decide' else v_c end), v_role); end if;
  if v_action = 'recommend' then
    v_outcome := kafaa_rpl_str(p, 'outcome');
    v_cl := case when r.target_kind = 'skill' and v_outcome <> 'not_yet' then (p->>'credited_level')::numeric::int else null end;
    if v_outcome = 'not_yet' then v_nqf := null;
    elsif r.target_kind = 'skill' then v_nqf := kafaa_cr_nqf(v_cl);
    else
      select * into tg from kafaa_credit_tags where id = 'ct:microcred:' || r.microcred_def_id;
      v_nqf := case when tg.id is not null and tg.status = 'published' then tg.nqf_level else kafaa_cr_nqf(nullif(v_max, 0)) end;
    end if;
    update kafaa_rpl_requests set status = 'recommended', outcome = v_outcome, credited_level = v_cl, hours = (p->>'hours')::numeric::int, nqf_level = v_nqf,
      rationale_en = kafaa_rpl_str(p, 'rationale_en'), rationale_ar = kafaa_rpl_str(p, 'rationale_ar'), recommended_by = me, recommended_role = v_role, recommended_on = current_date, updated_at = now() where id = r.id;
    for x in select z.pid from (select distinct ra.person_id as pid from kafaa_role_assignments ra where ra.role = 'training_manager' and ra.status = 'active' and (ra.expires_at is null or ra.expires_at >= current_date)) z order by z.pid collate "C" loop
      if x <> me and x <> r.person_id then perform kafaa_rpl_notify('nt-rpl-' || r.id || '-recommended-' || coalesce(r.return_count, 0) || '-' || x, x, 'RPL recommendation awaiting a second assessor: ' || r.target_title_en,
        'توصية اعتراف بالتعلم السابق بانتظار مقيّم ثانٍ: ' || r.target_title_ar, '/recognition/review/' || r.id, 'info'); end if;
    end loop;
    a := kafaa_audit(v_a, 'rpl_requests', r.id, 'ok', 'recommended ' || v_outcome || coalesce(' L' || v_cl, '') || ' ' || (p->>'hours')::numeric::int || 'h', 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Recommendation recorded: a second assessor confirms it', a, null, jsonb_build_object('id', r.id, 'status', 'recommended', 'outcome', v_outcome));
  end if;
  if v_action = 'return' then
    update kafaa_rpl_requests set status = 'submitted', return_note = kafaa_rpl_str(p, 'note'), return_count = coalesce(return_count, 0) + 1, outcome = null, credited_level = null, hours = 0, nqf_level = null,
      rationale_en = null, rationale_ar = null, recommended_by = null, recommended_role = null, recommended_on = null, updated_at = now() where id = r.id;
    perform kafaa_rpl_notify('nt-rpl-' || r.id || '-returned-' || (coalesce(r.return_count, 0) + 1), r.recommended_by, 'RPL recommendation returned: ' || r.target_title_en, 'أُعيدت توصية الاعتراف بالتعلم السابق: ' || r.target_title_ar, '/recognition/review/' || r.id, 'warn');
    a := kafaa_audit(v_a, 'rpl_requests', r.id, 'ok', 'returned to the recommender', 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Recommendation returned for another look', a, null, jsonb_build_object('id', r.id, 'status', 'submitted'));
  end if;
  -- confirm (checker)
  st := kafaa_rpl_statement(r, current_date);
  perform set_config('kafaa.seeding', 'on', true);
  for k in select z.skill_id, z.level from (
    select r.skill_id as skill_id, r.credited_level as level where r.target_kind = 'skill' and r.outcome in ('full', 'partial') and r.skill_id is not null and r.credited_level is not null
    union all
    select y.skill_id, y.level from (
      select a2->>'skill_id' as skill_id, case when r.outcome = 'full' then coalesce(nullif(a2->>'level', '')::numeric, 1)::int else coalesce(nullif(a2->>'level', '')::numeric, 1)::int - 1 end as level
      from kafaa_microcred_defs d, jsonb_array_elements(case when jsonb_typeof(d.alignment::jsonb) = 'array' then d.alignment::jsonb else '[]'::jsonb end) a2
      where r.target_kind = 'credential' and r.outcome in ('full', 'partial') and d.id = r.microcred_def_id and jsonb_typeof(a2->'skill_id') = 'string') y
    where y.level >= 1) z
    order by z.skill_id collate "C"
  loop
    v_ev := 'se:rpl:' || r.id || ':' || k.skill_id;
    insert into kafaa_skill_evidence (id, person_id, skill_id, kind, ref_table, ref_id, level, basis, status, observed_on, note, recorded_by, active)
    values (v_ev, r.person_id, k.skill_id, 'credential', 'rpl_requests', r.id, k.level, 'validated', 'current', current_date, 'RPL ' || r.outcome, me, true)
    on conflict (id) do update set level = excluded.level, basis = 'validated', status = 'current', observed_on = excluded.observed_on, note = excluded.note, recorded_by = me, active = true;
    v_ids := v_ids || v_ev;
  end loop;
  update kafaa_rpl_requests set status = 'decided', decided_by = me, decided_role = v_role, decided_on = current_date, rpl_statement_en = st->>'en', rpl_statement_ar = st->>'ar', evidence_ids = v_ids, updated_at = now() where id = r.id;
  if cardinality(v_ids) > 0 then perform kafaa_skills_apply(r.person_id, current_date); end if;
  perform kafaa_cr_sync(r.person_id);
  for x in select distinct y from unnest(array[r.person_id, r.opened_by]) y loop
    perform kafaa_rpl_notify('nt-rpl-' || r.id || '-decided-' || x, x,
      'RPL decision: ' || case r.outcome when 'full' then 'full credit' when 'partial' then 'partial credit' else 'not yet' end || ' (' || r.target_title_en || ')',
      'قرار الاعتراف بالتعلم السابق: ' || case r.outcome when 'full' then 'اعتراف كامل' when 'partial' then 'اعتراف جزئي' else 'ليس بعد' end || ' (' || r.target_title_ar || ')',
      '/my/recognition/rpl/' || r.id, case when r.outcome = 'not_yet' then 'info' else 'ok' end);
  end loop;
  perform set_config('kafaa.seeding', coalesce(v_prev, ''), true);
  l := kafaa_ledger('kafaa.rpl.decide', format('RPL %s for %s on %s; recommended by %s, confirmed by %s (two assessors); internal recognition, not a regulatory decision',
    r.outcome, r.person_id, case when r.target_kind = 'skill' then r.skill_id else r.microcred_def_id end, r.recommended_by, me));
  a := kafaa_audit(v_a, 'rpl_requests', r.id, 'ok', 'decided ' || r.outcome, case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'RPL decision confirmed', a, l, jsonb_build_object('id', r.id, 'status', 'decided', 'outcome', r.outcome, 'evidence_ids', to_jsonb(v_ids), 'credits', round(coalesce(r.hours, 0) / 10.0, 1)));
end $$;

-- ───────────── RPC: FS29 NQC-ready export of a decided request (the person; recognition R/W/A). Audited, no ledger.
create or replace function kafaa_export_rpl(p_id text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); r kafaa_rpl_requests; v_own boolean; v_role text; v_pack jsonb; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('rpl.export', 'rpl_requests', nullif(btrim(coalesce(p_id, '')), ''), 'not_signed_in', kafaa_rpl_message('not_signed_in')); end if;
  select * into r from kafaa_rpl_requests where id = btrim(coalesce(p_id, ''), E' \t\r\n');
  if r.id is null then return kafaa_refuse('rpl.export', 'rpl_requests', nullif(btrim(coalesce(p_id, '')), ''), 'not_found', kafaa_rpl_message('not_found')); end if;
  v_own := r.person_id = me;
  if not v_own and not kafaa_has_grant('recognition', array['R', 'W', 'A']) then return kafaa_refuse('rpl.export', 'rpl_requests', r.id, 'forbidden', kafaa_rpl_message('forbidden_export')); end if;
  v_role := case when v_own then kafaa_acting_role('own_profile', array['Own']) else kafaa_acting_role('recognition', array['R', 'W', 'A']) end;
  if r.status <> 'decided' then return kafaa_refuse('rpl.export', 'rpl_requests', r.id, 'invalid', kafaa_rpl_message('state'), v_role); end if;
  v_pack := kafaa_rpl_pack(r);
  update kafaa_rpl_requests set export_count = coalesce(export_count, 0) + 1, exported_at = now() where id = r.id;
  a := kafaa_audit('rpl.export', 'rpl_requests', r.id, 'ok', 'NQC-ready pack exported', 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'RPL pack ready', a, null, v_pack);
end $$;

-- ───────────── Read RPC: FS29 the person's attachable records (self; recognition R/W/A for anyone; else an empty list)
create or replace function kafaa_rpl_evidence_options(p_person text default null) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); v_pid text;
begin
  if me is null then return '[]'::jsonb; end if;
  v_pid := coalesce(nullif(btrim(coalesce(p_person, ''), E' \t\r\n'), ''), me);
  if v_pid <> me and not kafaa_has_grant('recognition', array['R', 'W', 'A']) then return '[]'::jsonb; end if;
  return kafaa_rpl_options(v_pid);
end $$;

-- ───────────── RPC: FS30 tag (or retire the tag of) a course, pathway or micro-credential (frameworks W/A). Audited, no ledger.
create or replace function kafaa_tag_credit(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_kind text; v_item text; v_id text; v_role text; v_c text; cur kafaa_credit_tags; v_version int; v_title_en text; v_title_ar text; v_hours int; v_retire boolean;
  x text; v_n int := 0; a kafaa_audit_events; t kafaa_credit_tags;
begin
  p := coalesce(p, '{}'::jsonb);
  v_kind := kafaa_rpl_str(p, 'item_kind'); v_item := kafaa_rpl_str(p, 'item_id'); v_id := 'ct:' || v_kind || ':' || v_item;
  if me is null then return kafaa_refuse('credit.tag', 'credit_tags', case when v_item <> '' then v_id end, 'not_signed_in', kafaa_cr_message('not_signed_in')); end if;
  if not kafaa_has_grant('frameworks', array['W', 'A']) then return kafaa_refuse('credit.tag', 'credit_tags', case when v_item <> '' then v_id end, 'forbidden', kafaa_cr_message('forbidden')); end if;
  v_role := kafaa_acting_role('frameworks', array['W', 'A']);
  v_c := kafaa_cr_check_tag(p);
  if v_c <> 'ok' then return kafaa_refuse('credit.tag', 'credit_tags', case when v_item <> '' then v_id end, case when v_c in ('item', 'not_found') then 'not_found' else 'invalid' end, kafaa_cr_message(v_c), v_role); end if;
  v_retire := p->'retire' = 'true'::jsonb;
  select * into cur from kafaa_credit_tags where id = v_id;
  v_version := coalesce(cur.version, 0) + 1;
  if v_retire then
    update kafaa_credit_tags set status = 'retired', listed = false, version = v_version, updated_by = me, updated_at = now() where id = v_id;
  else
    if v_kind = 'course' then select title_en, title_ar into v_title_en, v_title_ar from kafaa_courses where id = v_item;
    elsif v_kind = 'pathway' then select title_en, title_ar into v_title_en, v_title_ar from kafaa_pathways where id = v_item;
    else select title_en, title_ar into v_title_en, v_title_ar from kafaa_microcred_defs where id = v_item; end if;
    v_hours := (p->>'notional_hours')::numeric::int;
    insert into kafaa_credit_tags (id, item_kind, item_id, title_en, title_ar, nqf_level, notional_hours, credits, indicative, basis_en, basis_ar, stack_ids, status, listed, source_url, as_of, version, updated_by, updated_at)
    values (v_id, v_kind, v_item, v_title_en, v_title_ar, (p->>'nqf_level')::numeric::int, v_hours, round(v_hours / 10.0, 1), true, kafaa_rpl_str(p, 'basis_en'), kafaa_rpl_str(p, 'basis_ar'),
      array(select y from jsonb_array_elements_text(case when jsonb_typeof(p->'stack_ids') = 'array' then p->'stack_ids' else '[]'::jsonb end) y order by y collate "C"), 'published', true,
      coalesce(cur.source_url, 'https://uaelegislation.gov.ae/en/legislations/2615/download'), current_date, v_version, me, now())
    on conflict (id) do update set title_en = excluded.title_en, title_ar = excluded.title_ar, nqf_level = excluded.nqf_level, notional_hours = excluded.notional_hours, credits = excluded.credits,
      indicative = true, basis_en = excluded.basis_en, basis_ar = excluded.basis_ar, stack_ids = excluded.stack_ids, status = 'published', listed = true, as_of = excluded.as_of, version = excluded.version,
      updated_by = me, updated_at = now();
  end if;
  for x in select y from (
      select person_id y from kafaa_training_records where v_kind = 'course' and course_id = v_item
      union select person_id from kafaa_pathway_enrolments where v_kind = 'pathway' and pathway_id = v_item and status = 'completed'
      union select person_id from kafaa_microcred_awards where v_kind = 'microcred' and def_id = v_item and status = 'awarded'
      union select person_id from kafaa_credit_ledger where tag_id = v_id) s order by y collate "C" loop
    perform kafaa_cr_sync(x); v_n := v_n + 1;
  end loop;
  select * into t from kafaa_credit_tags where id = v_id;
  a := kafaa_audit('credit.tag', 'credit_tags', v_id, 'ok', case when v_retire then 'retired' else 'NQF ' || t.nqf_level || ' ' || t.notional_hours || 'h' end || ' v' || v_version, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when v_retire then 'Tag retired' else 'Tag saved (indicative)' end, a, null, jsonb_build_object('id', v_id, 'status', t.status, 'credits', t.credits, 'synced', v_n));
end $$;

-- ───────────── RPC: FS30 rebuild credit ledgers (self; recognition A or frameworks W/A for anyone; null = everyone for them). Audited, no ledger.
create or replace function kafaa_sync_credits(p_person text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_pid text := nullif(btrim(coalesce(p_person, ''), E' \t\r\n'), ''); v_wide boolean; v_role text; v_people text[]; x text; v_r int[]; v_up int := 0; v_rev int := 0; v_total numeric; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('credit.sync', 'credit_ledger', v_pid, 'not_signed_in', kafaa_cr_message('not_signed_in')); end if;
  v_wide := kafaa_has_grant('recognition', array['A']) or kafaa_has_grant('frameworks', array['W', 'A']);
  if v_pid is not null and v_pid <> me and not v_wide then return kafaa_refuse('credit.sync', 'credit_ledger', v_pid, 'forbidden', kafaa_cr_message('forbidden_sync')); end if;
  v_role := case when (v_pid is not null and v_pid <> me) or (v_pid is null and v_wide) then coalesce(kafaa_acting_role('recognition', array['A']), kafaa_acting_role('frameworks', array['W', 'A']))
    else kafaa_acting_role('own_profile', array['Own']) end;
  v_people := case when v_pid is not null then array[v_pid] when v_wide then kafaa_cr_people() else array[me] end;
  foreach x in array v_people loop
    v_r := kafaa_cr_sync(x); v_up := v_up + v_r[1]; v_rev := v_rev + v_r[2];
  end loop;
  select coalesce(sum(notional_hours), 0) / 10.0 into v_total from kafaa_credit_ledger where person_id = any(v_people) and status = 'counted';
  a := kafaa_audit('credit.sync', 'credit_ledger', coalesce(v_pid, case when v_wide then 'all' else me end), 'ok', cardinality(v_people) || ' people, ' || v_up || ' upserted, ' || v_rev || ' reversed', 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Credit ledger refreshed', a, null, jsonb_build_object('people', cardinality(v_people), 'upserted', v_up, 'reversed', v_rev, 'total', round(v_total, 1)));
end $$;

-- ───────────── Grants: internal helpers are not executable by API roles; RPCs only by signed-in users.
revoke all on function kafaa_rpl_str(jsonb, text), kafaa_rpl_is_int(jsonb), kafaa_rpl_isnull(jsonb), kafaa_rpl_options(text), kafaa_rpl_check_open(jsonb, text),
  kafaa_rpl_check_attach(jsonb, kafaa_rpl_requests, int, jsonb), kafaa_rpl_check_decide(jsonb, kafaa_rpl_requests, text, int), kafaa_rpl_result_code(text), kafaa_rpl_message(text),
  kafaa_rpl_statement(kafaa_rpl_requests, date), kafaa_rpl_mask(text), kafaa_rpl_pack(kafaa_rpl_requests), kafaa_rpl_notify(text, text, text, text, text, text), kafaa_cr_nqf(int),
  kafaa_rpl_max_align(text), kafaa_cr_compute(text), kafaa_cr_sync(text), kafaa_cr_check_tag(jsonb), kafaa_cr_message(text), kafaa_cr_people() from public, anon, authenticated;
revoke all on function kafaa_submit_rpl(jsonb), kafaa_attest_rpl(jsonb), kafaa_decide_rpl(jsonb), kafaa_export_rpl(text), kafaa_rpl_evidence_options(text), kafaa_tag_credit(jsonb), kafaa_sync_credits(text) from public, anon;
grant execute on function kafaa_submit_rpl(jsonb), kafaa_attest_rpl(jsonb), kafaa_decide_rpl(jsonb), kafaa_export_rpl(text), kafaa_rpl_evidence_options(text), kafaa_tag_credit(jsonb), kafaa_sync_credits(text) to authenticated;
