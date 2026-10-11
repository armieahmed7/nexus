-- live apply part kafaa_fs53_lectures_localisation_p1 (from supabase/migrations/20261010253001_kafaa_fs53_lectures_localisation.sql, part 1 of 2)
-- [FS wave E · E3 · FS44 + FS45] Expert lecture library and knowledge that counts as evidence; localisation countdown to 2030 (M24 Knowledge continuity).
-- FS44: kafaa_lectures holds recorded expert talks (synthetic metadata: no real recording, no real person), each linked to 1-6 catalogue skills and,
--   where the speaker holds one, to the F20 KLRA position it protects (resolved on the server from the speaker's own active positions; the risk band never
--   leaves the KLRA). Security-restricted topics are refused (security_restricted): security-area skills or competencies, positions in the security, cyber
--   and safeguards families, and texts flagged by the shared community guard (kafaa_cop_guard). kafaa_contributions holds delivered lectures (speaker) and
--   published F21 knowledge assets (SME, and the author when different) waiting for validation by the knowledge-management owner (knowledge A, never the
--   contributor). A validated contribution writes F01 evidence (kind rating, basis validated, ref_table lectures | knowledge_assets, level 3 for speakers
--   and SMEs, 2 for authors, never above 3) and recomputes the person's skills (kafaa_skills_apply); pending and rejected ones write nothing.
--   kafaa_lc_validated() is the clean query FS72 reads. Mirror of src/modules/m24/lectures.ts.
-- FS45: kafaa_localisation_items is a SAMPLE plan of programmes and qualification steps a partner still delivers or signs off, with a target transfer date
--   no later than 2030-12-31 (check constraint). Readiness is computed from the F31 instructor pipeline (M02 kafaa_instructor_tracks via kafaa_ins_stage and
--   kafaa_ins_currency), never stored; items past their target are flagged and exposed to the F22 handover board through kafaa_localisation_overdue().
--   Only the training manager (kafaa_role_grant training_manager / knowledge / W) sets status; "transferred" needs ready-now >= needed. Mirror of
--   src/modules/m24/localisation.ts.
-- Shared redefinition (same signatures): kafaa_skill_states_v2 and kafaa_skills_apply gain 'lectures' and 'knowledge_assets' in their ref_table lists.
-- PGlite parity and checks: scripts/validate/fs53-lectures-localisation.mjs.
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file; RLS created once (never replaced).

-- ───────────── Tables (generated DDL, additive)
create table if not exists kafaa_lectures (
  id text primary key,
  title_en text not null,
  title_ar text not null,
  abstract_en text not null,
  abstract_ar text not null,
  speaker_id text not null,
  speaker_name text not null default '',
  speaker_name_ar text not null default '',
  speaker_role_id text,
  format text not null default 'talk' check (format in ('talk', 'masterclass', 'walkthrough', 'panel')),
  lang text not null default 'en' check (lang in ('en', 'ar')),
  delivered_on date not null,
  duration_min integer not null,
  recording_code text,
  chapters jsonb not null default '[]'::jsonb,
  skill_ids text[] not null default '{}'::text[],
  position_id text,
  position_title_en text not null default '',
  position_title_ar text not null default '',
  system_family text not null check (system_family in ('reactor_core', 'primary', 'secondary', 'electrical', 'i_and_c', 'chemistry', 'radiation_protection', 'maintenance', 'outage', 'human_performance', 'emergency_preparedness', 'training')),
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'withdrawn')),
  published boolean not null default false,
  published_by text,
  published_at timestamptz,
  withdrawn_reason text,
  synthetic boolean not null default true,
  history jsonb not null default '[]'::jsonb,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table kafaa_lectures is '[M24] Expert lecture library: recorded talk metadata (synthetic), linked skills and the KLRA position it protects (FS44)';
create table if not exists kafaa_contributions (
  id text primary key,
  person_id text not null,
  person_name text not null default '',
  person_name_ar text not null default '',
  kind text not null check (kind in ('lecture', 'asset')),
  contributor_role text not null check (contributor_role in ('speaker', 'author', 'sme')),
  ref_table text not null check (ref_table in ('lectures', 'knowledge_assets')),
  ref_id text not null,
  title_en text not null default '',
  title_ar text not null default '',
  skill_ids text[] not null default '{}'::text[],
  level integer not null default 2,
  status text not null default 'pending' check (status in ('pending', 'validated', 'rejected')),
  submitted_on date not null,
  decided_by text,
  decided_role text,
  decided_on date,
  note text,
  evidence_ids text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);
comment on table kafaa_contributions is '[M24] Expert contribution (delivered lecture or published knowledge asset) waiting for or given validation; validated ones write F01 evidence (FS44)';
create table if not exists kafaa_localisation_items (
  id text primary key,
  programme_id text,
  title_en text not null,
  title_ar text not null,
  scope text not null default 'delivery' check (scope in ('delivery', 'signoff', 'both')),
  partner_org_id text not null,
  partner_role_en text not null default '',
  partner_role_ar text not null default '',
  standard_ids text[] not null default '{}'::text[],
  discipline text not null default '',
  instructors_needed integer not null default 1,
  baseline_on date not null,
  target_on date not null,
  status text not null default 'partner_led' check (status in ('partner_led', 'co_delivery', 'uae_led_supervised', 'transferred', 'on_hold')),
  status_note text not null default '',
  status_by text,
  status_at timestamptz,
  history jsonb not null default '[]'::jsonb,
  sample boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table kafaa_localisation_items is '[M24] Localisation countdown: a programme or qualification step a partner still delivers or signs off, with its 2030 target (SAMPLE plan; readiness computed, never stored) (FS45)';
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_lectures_speaker_id_fk') then alter table kafaa_lectures add constraint kafaa_lectures_speaker_id_fk foreign key (speaker_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_lectures_created_by_fk') then alter table kafaa_lectures add constraint kafaa_lectures_created_by_fk foreign key (created_by) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_contributions_person_id_fk') then alter table kafaa_contributions add constraint kafaa_contributions_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_localisation_items_programme_id_fk') then alter table kafaa_localisation_items add constraint kafaa_localisation_items_programme_id_fk foreign key (programme_id) references kafaa_programmes(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_localisation_items_partner_org_id_fk') then alter table kafaa_localisation_items add constraint kafaa_localisation_items_partner_org_id_fk foreign key (partner_org_id) references kafaa_organisations(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_lectures_speaker_id_idx on kafaa_lectures (speaker_id);
create index if not exists kafaa_lectures_delivered_on_idx on kafaa_lectures (delivered_on);
create index if not exists kafaa_lectures_system_family_idx on kafaa_lectures (system_family);
create index if not exists kafaa_lectures_status_idx on kafaa_lectures (status);
create index if not exists kafaa_lectures_created_by_idx on kafaa_lectures (created_by);
create index if not exists kafaa_contributions_person_id_idx on kafaa_contributions (person_id);
create index if not exists kafaa_contributions_ref_id_idx on kafaa_contributions (ref_id);
create index if not exists kafaa_contributions_status_idx on kafaa_contributions (status);
create index if not exists kafaa_localisation_items_programme_id_idx on kafaa_localisation_items (programme_id);
create index if not exists kafaa_localisation_items_partner_org_id_idx on kafaa_localisation_items (partner_org_id);
create index if not exists kafaa_localisation_items_target_on_idx on kafaa_localisation_items (target_on);
create index if not exists kafaa_localisation_items_status_idx on kafaa_localisation_items (status);
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_localisation_items_target_ck') then
  alter table kafaa_localisation_items add constraint kafaa_localisation_items_target_ck check (target_on <= date '2030-12-31' and target_on >= baseline_on); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_contributions_level_ck') then
  alter table kafaa_contributions add constraint kafaa_contributions_level_ck check (level between 1 and 3); end if; end $$;

-- ───────────── RLS (generated rules; policies created once)
do $$ begin
  execute 'alter table kafaa_lectures enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_lectures' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_lectures for select to anon, authenticated using (kafaa_rule_read(''knowledge'', null::text, null::text, published) or kafaa_rule_read(''own_profile'', speaker_id, null::text, true) or kafaa_rule_read(''own_profile'', created_by, null::text, true))'; end if;
  execute 'alter table kafaa_contributions enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_contributions' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_contributions for select to anon, authenticated using (kafaa_rule_read(''own_profile'', person_id, null::text, true))'; end if;
  execute 'alter table kafaa_localisation_items enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_localisation_items' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_localisation_items for select to anon, authenticated using (kafaa_rule_read(''knowledge'', null::text, null::text, true))'; end if;
end $$;
revoke all on kafaa_lectures, kafaa_contributions, kafaa_localisation_items from anon, authenticated;
grant select on kafaa_lectures, kafaa_contributions, kafaa_localisation_items to anon, authenticated;

-- (shared kafaa_skill_states_v2 / kafaa_skills_apply redefinition stripped for the live apply: the unioned body is in kafaa_fs5qa_integration_p1)

-- ───────────── FS44 rules (mirror of src/modules/m24/lectures.ts)
-- Trimmed length of a JSON string, -1 when it is not a string (len()).
create or replace function kafaa_lc_len(j jsonb) returns integer language sql immutable set search_path = public as $$
  select case when jsonb_typeof(j) = 'string' then char_length(regexp_replace(j #>> '{}', '^\s+|\s+$', '', 'g')) else -1 end
$$;
create or replace function kafaa_lc_str(j jsonb) returns text language sql immutable set search_path = public as $$
  select case when jsonb_typeof(j) = 'string' then regexp_replace(j #>> '{}', '^\s+|\s+$', '', 'g') else '' end
$$;
-- strList(): distinct strings in first-seen order, null unless an array of strings only.
create or replace function kafaa_lc_list(j jsonb) returns text[] language sql immutable set search_path = public as $$
  select case when jsonb_typeof(j) = 'array' and not exists (select 1 from jsonb_array_elements(j) e where jsonb_typeof(e) <> 'string')
    then coalesce((select array_agg(s order by o) from (select e.v #>> '{}' s, min(e.o) o from jsonb_array_elements(j) with ordinality e(v, o) group by 1) x), '{}'::text[]) end
$$;
-- levelFor(): speaker and SME 3, author 2, never above 3.
create or replace function kafaa_lc_level(p_role text) returns integer language sql immutable set search_path = public as $$
  select least(3, case p_role when 'speaker' then 3 when 'sme' then 3 else 2 end)
$$;
-- evidenceSkills(): linked, existing, not security, not cyber hygiene, not obsolete; first-seen order.
create or replace function kafaa_lc_evidence_skills(p_ids text[]) returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(x.s order by x.o), '{}'::text[]) from (
    select u.s, min(u.o) o from unnest(coalesce(p_ids, '{}'::text[])) with ordinality u(s, o) group by u.s) x
  join kafaa_skills k on k.id = x.s left join kafaa_competencies c on c.id = k.competency_id
  where k.area is distinct from 'security' and c.domain is distinct from 'security' and (to_jsonb(k) ->> 'fs_area') is distinct from 'cyber_hygiene'
    and (to_jsonb(k) ->> 'lifecycle') is distinct from 'obsolete'
$$;
-- resolvePosition(): {"ok":true,"id":<speaker's position or null>} or {"ok":false} when a position was asked for that the speaker does not hold.
create or replace function kafaa_lc_resolve(p_requested jsonb, p_speaker text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_req text := nullif(kafaa_lc_str(p_requested), ''); v_first text;
begin
  select p.id into v_first from kafaa_klra_positions p where p.person_id = p_speaker and p.active order by p.id collate "C" limit 1;
  if v_first is null then
    if v_req is not null then return jsonb_build_object('ok', false); end if;
    return jsonb_build_object('ok', true, 'id', null);
  end if;
  if v_req is not null then
    if exists (select 1 from kafaa_klra_positions p where p.person_id = p_speaker and p.active and p.id = v_req) then return jsonb_build_object('ok', true, 'id', v_req); end if;
    return jsonb_build_object('ok', false);
  end if;
  return jsonb_build_object('ok', true, 'id', v_first);
end $$;
-- lectureText(): titles, abstracts and chapter texts, as screened by the guard.
create or replace function kafaa_lc_text(p jsonb) returns text language sql immutable set search_path = public as $$
  select concat_ws(' ', case when jsonb_typeof(p -> 'title_en') = 'string' then p ->> 'title_en' else '' end, case when jsonb_typeof(p -> 'title_ar') = 'string' then p ->> 'title_ar' else '' end,
    case when jsonb_typeof(p -> 'abstract_en') = 'string' then p ->> 'abstract_en' else '' end, case when jsonb_typeof(p -> 'abstract_ar') = 'string' then p ->> 'abstract_ar' else '' end)
    || ' ' || coalesce(case when jsonb_typeof(p -> 'chapters') = 'array' then (select string_agg(
      (case when jsonb_typeof(c -> 'en') = 'string' then c ->> 'en' else '' end) || ' ' || (case when jsonb_typeof(c -> 'ar') = 'string' then c ->> 'ar' else '' end), ' ' order by o)
      from jsonb_array_elements(p -> 'chapters') with ordinality q(c, o)) end, '')
$$;
-- lectureProblem(): the first problem in a fixed order as {code, message}, or null. p_position is the resolved position id.
create or replace function kafaa_lc_problem(p jsonb, p_speaker text, p_position text, p_today date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_sk text[]; v_dur integer; c jsonb; v_cat text; v_text text; v_fam text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return jsonb_build_object('code', 'invalid', 'message', 'Give a title (5 to 160 characters) and an abstract (20 to 1,200 characters) in English and Arabic'); end if;
  if kafaa_lc_len(p -> 'title_en') not between 5 and 160 or kafaa_lc_len(p -> 'title_ar') not between 5 and 160
     or kafaa_lc_len(p -> 'abstract_en') not between 20 and 1200 or kafaa_lc_len(p -> 'abstract_ar') not between 20 and 1200 then
    return jsonb_build_object('code', 'invalid', 'message', 'Give a title (5 to 160 characters) and an abstract (20 to 1,200 characters) in English and Arabic');
  end if;
  if coalesce(jsonb_typeof(p -> 'format'), '') <> 'string' or p ->> 'format' not in ('talk', 'masterclass', 'walkthrough', 'panel')
     or coalesce(jsonb_typeof(p -> 'lang'), '') <> 'string' or p ->> 'lang' not in ('en', 'ar')
     or coalesce(jsonb_typeof(p -> 'system_family'), '') <> 'string' or p ->> 'system_family' not in ('reactor_core', 'primary', 'secondary', 'electrical', 'i_and_c', 'chemistry', 'radiation_protection', 'maintenance', 'outage', 'human_performance', 'emergency_preparedness', 'training') then
    return jsonb_build_object('code', 'invalid', 'message', 'Choose a format, a language and a system family');
  end if;
  if coalesce(jsonb_typeof(p -> 'duration_min'), '') <> 'number' or (p ->> 'duration_min')::numeric <> trunc((p ->> 'duration_min')::numeric) or (p ->> 'duration_min')::numeric not between 10 and 240 then
    return jsonb_build_object('code', 'invalid', 'message', 'The recording lasts 10 to 240 minutes');
  end if;
  v_dur := (p ->> 'duration_min')::numeric::integer;
  if coalesce(jsonb_typeof(p -> 'delivered_on'), '') <> 'string' or not kafaa_kc_isoday(p ->> 'delivered_on') or p ->> 'delivered_on' < '2015-01-01' or p ->> 'delivered_on' > to_char(p_today, 'YYYY-MM-DD') then
    return jsonb_build_object('code', 'invalid', 'message', 'The delivery date must be a real date from 2015 up to today');
  end if;
  v_sk := kafaa_lc_list(p -> 'skill_ids');
  if v_sk is null or cardinality(v_sk) < 1 or cardinality(v_sk) > 6 or exists (select 1 from unnest(v_sk) i where not exists (select 1 from kafaa_skills k where k.id = i)) then
    return jsonb_build_object('code', 'invalid', 'message', 'Link 1 to 6 catalogue skills');
  end if;
  if exists (select 1 from unnest(v_sk) i join kafaa_skills k on k.id = i left join kafaa_competencies cm on cm.id = k.competency_id where k.area = 'security' or cm.domain = 'security') then
    return jsonb_build_object('code', 'security_restricted', 'message', 'Security-restricted topics are not published in the lecture library: security, safeguards and cyber skills follow the security career path');
  end if;
  if exists (select 1 from unnest(v_sk) i join kafaa_skills k on k.id = i where (to_jsonb(k) ->> 'lifecycle') = 'obsolete') then
    return jsonb_build_object('code', 'invalid', 'message', 'Obsolete skills cannot be linked; use the skill that replaced it');
  end if;
  if p ? 'chapters' and jsonb_typeof(p -> 'chapters') <> 'null' then
    if jsonb_typeof(p -> 'chapters') <> 'array' or jsonb_array_length(p -> 'chapters') > 12 then
      return jsonb_build_object('code', 'invalid', 'message', 'Up to 12 chapters, each with a start minute inside the recording and a title in English and Arabic (up to 120 characters)');
    end if;
    for c in select e from jsonb_array_elements(p -> 'chapters') e loop
      if jsonb_typeof(c) <> 'object' or coalesce(jsonb_typeof(c -> 'at'), '') <> 'number' or (c ->> 'at')::numeric <> trunc((c ->> 'at')::numeric) or (c ->> 'at')::numeric < 0 or (c ->> 'at')::numeric > v_dur
         or kafaa_lc_len(c -> 'en') not between 1 and 120 or kafaa_lc_len(c -> 'ar') not between 1 and 120 then
        return jsonb_build_object('code', 'invalid', 'message', 'Up to 12 chapters, each with a start minute inside the recording and a title in English and Arabic (up to 120 characters)');
      end if;
    end loop;
  end if;
  if p ? 'recording_code' and jsonb_typeof(p -> 'recording_code') <> 'null' and not (jsonb_typeof(p -> 'recording_code') = 'string' and p ->> 'recording_code' = '')
     and not (jsonb_typeof(p -> 'recording_code') = 'string' and p ->> 'recording_code' ~ '^REC-[0-9]{4}-[0-9]{3}$') then
    return jsonb_build_object('code', 'invalid', 'message', 'The recording reference is a synthetic code such as REC-2026-014');
  end if;
  if p_position is not null and not exists (select 1 from kafaa_klra_positions x where x.person_id = p_speaker and x.active and x.id = p_position) then
    return jsonb_build_object('code', 'invalid', 'message', 'A lecture protects the knowledge-loss-risk position its speaker holds, never someone else''s');
  end if;
  if p_position is null and exists (select 1 from kafaa_klra_positions x where x.person_id = p_speaker and x.active) then
    return jsonb_build_object('code', 'invalid', 'message', 'A lecture protects the knowledge-loss-risk position its speaker holds, never someone else''s');
  end if;
  if p_position is not null then
    select x.family_id into v_fam from kafaa_klra_positions x where x.id = p_position;
    if coalesce(v_fam, '') in ('security', 'cyber', 'safeguards') then
      return jsonb_build_object('code', 'security_restricted', 'message', 'Security-restricted topics are not published in the lecture library: security, safeguards and cyber skills follow the security career path');
    end if;
  end if;
  v_text := kafaa_lc_text(p);
  v_cat := kafaa_cop_guard(v_text);
  if v_cat is not null then
    return jsonb_build_object('code', 'security_restricted', 'message', 'Not saved: ' || v_cat || ' content is not allowed in the lecture library. Share reasoning, lessons and practice; leave out plant security arrangements, safeguards figures and cyber or network details');
  end if;
  if kafaa_cop_contact(v_text) then return jsonb_build_object('code', 'contact_details', 'message', 'Not saved: remove email addresses and phone numbers. Name roles, never people'); end if;
  return null;
end $$;
-- decideProblem(): ok | not_found | decided | self | decision | source | skills.
create or replace function kafaa_lc_decide_problem(c kafaa_contributions, p_me text, p_decision text, p_note text, p_source_published boolean, p_skills integer) returns text language plpgsql immutable set search_path = public as $$
declare n integer := char_length(regexp_replace(coalesce(p_note, ''), '^\s+|\s+$', '', 'g'));
begin
  if c.id is null then return 'not_found'; end if;
  if c.status <> 'pending' then return 'decided'; end if;
  if c.person_id = p_me then return 'self'; end if;
  if p_decision is null or p_decision not in ('validate', 'reject') then return 'decision'; end if;
  if n > 600 or (p_decision = 'reject' and n < 5) then return 'decision'; end if;
  if p_decision = 'validate' and not p_source_published then return 'source'; end if;
  if p_decision = 'validate' and p_skills = 0 then return 'skills'; end if;
  return 'ok';
end $$;
create or replace function kafaa_lc_reason(p_code text, p_vars jsonb) returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object('code', p_code, 'key', 'm24.lc.reason.' || p_code, 'vars', coalesce(p_vars, '{}'::jsonb))
$$;
-- contributionReasons()
create or replace function kafaa_lc_reasons(p_role text, p_level integer, p_status text, p_skills integer, p_position boolean) returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_array(kafaa_lc_reason('role_' || p_role, jsonb_build_object('level', p_level)), kafaa_lc_reason('skills', jsonb_build_object('n', p_skills)))
    || case when p_position then jsonb_build_array(kafaa_lc_reason('position', '{}'::jsonb)) else '[]'::jsonb end
    || jsonb_build_array(kafaa_lc_reason(case p_status when 'validated' then 'validated' when 'rejected' then 'rejected' else 'pending' end, '{}'::jsonb))
$$;
create or replace function kafaa_lc_source_published(c kafaa_contributions) returns boolean language sql stable security definer set search_path = public as $$
  select case c.ref_table when 'lectures' then exists (select 1 from kafaa_lectures l where l.id = c.ref_id and l.status = 'published' and l.published)
    else exists (select 1 from kafaa_knowledge_assets a where a.id = c.ref_id and a.status = 'published' and a.published) end
$$;
-- The queue view of a contribution (contribView()).
create or replace function kafaa_lc_view(c kafaa_contributions) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare l kafaa_lectures; a kafaa_knowledge_assets; v_ev text[] := kafaa_lc_evidence_skills(c.skill_ids); v_status text; v_date text; v_pos boolean := false;
begin
  if c.ref_table = 'lectures' then
    select * into l from kafaa_lectures where id = c.ref_id;
    v_status := coalesce(l.status, 'missing'); v_date := l.delivered_on::text; v_pos := l.position_id is not null;
  else
    select * into a from kafaa_knowledge_assets where id = c.ref_id;
    v_status := coalesce(a.status, 'missing'); v_date := left(kafaa_kc_ts(a.published_at), 10); v_pos := a.position_id is not null;
  end if;
  return jsonb_build_object('id', c.id, 'person_id', c.person_id, 'person_name', c.person_name, 'person_name_ar', c.person_name_ar, 'kind', c.kind, 'contributor_role', c.contributor_role,
    'ref_table', c.ref_table, 'ref_id', c.ref_id, 'title_en', c.title_en, 'title_ar', c.title_ar, 'skill_ids', to_jsonb(c.skill_ids), 'evidence_skill_ids', to_jsonb(v_ev), 'level', c.level,
    'status', c.status, 'submitted_on', c.submitted_on::text, 'decided_on', c.decided_on::text,
    'decided_by_name', case when c.decided_by is null then '' else kafaa_kc_name(c.decided_by, false) end, 'decided_by_name_ar', case when c.decided_by is null then '' else kafaa_kc_name(c.decided_by, true) end,
    'note', c.note, 'evidence_ids', to_jsonb(c.evidence_ids), 'source_status', v_status, 'source_date', v_date, 'position_linked', v_pos,
    'reasons', kafaa_lc_reasons(c.contributor_role, c.level, c.status, cardinality(v_ev), v_pos));
end $$;
-- Open the missing contributions of a published lecture (speaker) or asset (SME, then the author when different): contributorsOf().
create or replace function kafaa_lc_open(p_kind text, p_id text) returns text[] language plpgsql security definer set search_path = public as $$
declare l kafaa_lectures; a kafaa_knowledge_assets; v_made text[] := '{}'::text[]; r record;
begin
  if p_kind = 'lecture' then
    select * into l from kafaa_lectures where id = p_id;
    if l.id is null then return v_made; end if;
    for r in select 'ctb-' || l.id as cid, l.speaker_id as pid, 'speaker' as role loop
      if r.pid is null or exists (select 1 from kafaa_contributions where id = r.cid) or not exists (select 1 from kafaa_people where id = r.pid) then continue; end if;
      insert into kafaa_contributions (id, person_id, person_name, person_name_ar, kind, contributor_role, ref_table, ref_id, title_en, title_ar, skill_ids, level, status, submitted_on, evidence_ids)
      values (r.cid, r.pid, kafaa_kc_name(r.pid, false), kafaa_kc_name(r.pid, true), 'lecture', r.role, 'lectures', l.id, l.title_en, l.title_ar, l.skill_ids, kafaa_lc_level(r.role), 'pending', current_date, '{}'::text[]);
      v_made := v_made || r.cid;
    end loop;
    return v_made;
  end if;
  select * into a from kafaa_knowledge_assets where id = p_id;
  if a.id is null then return v_made; end if;
  for r in select x.cid, x.pid, x.role from (
      select 1 as o, 'ctb-' || a.id || '-sme' as cid, a.sme_id as pid, 'sme' as role where a.sme_id is not null
      union all
      select 2, 'ctb-' || a.id || '-author', a.author_id, 'author' where a.author_id is not null and a.author_id is distinct from a.sme_id) x order by x.o loop
    if exists (select 1 from kafaa_contributions where id = r.cid) or not exists (select 1 from kafaa_people where id = r.pid) then continue; end if;
    insert into kafaa_contributions (id, person_id, person_name, person_name_ar, kind, contributor_role, ref_table, ref_id, title_en, title_ar, skill_ids, level, status, submitted_on, evidence_ids)
    values (r.cid, r.pid, kafaa_kc_name(r.pid, false), kafaa_kc_name(r.pid, true), 'asset', r.role, 'knowledge_assets', a.id, a.title_en, a.title_ar, a.skill_ids, kafaa_lc_level(r.role), 'pending', current_date, '{}'::text[]);
    v_made := v_made || r.cid;
  end loop;
  return v_made;
end $$;
-- validatedContributions(): the clean FS72 suggestion source (newest decision first). Internal helper (not executable by API roles).
create or replace function kafaa_lc_validated(p_person text default null) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'person_id', c.person_id, 'kind', c.kind, 'ref_table', c.ref_table, 'ref_id', c.ref_id, 'skill_ids', to_jsonb(c.skill_ids),
    'level', c.level, 'decided_on', c.decided_on::text) order by c.decided_on desc nulls last, c.id collate "C"), '[]'::jsonb)
  from kafaa_contributions c where c.status = 'validated' and (p_person is null or c.person_id = p_person)
$$;

-- ───────────── FS44 RPCs
create or replace function kafaa_save_lecture(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_id text := nullif(kafaa_lc_str(p -> 'id'), ''); x kafaa_lectures; v_speaker text; sp kafaa_people; v_pos jsonb; v_pid text;
  v_bad jsonb; v_status text; v_ch jsonb; ps kafaa_klra_positions; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('knowledge.lecture.save', 'lectures', v_id, 'not_signed_in', 'Sign in to use the lecture library'); end if;
  if not kafaa_has_grant('knowledge', array['R']) then return kafaa_refuse('knowledge.lecture.save', 'lectures', v_id, 'forbidden', 'The lecture library is open to ENEC staff'); end if;
  v_role := kafaa_acting_role('knowledge', array['R']);
  if v_id is not null then
    select * into x from kafaa_lectures where id = v_id;
    if x.id is null or not (x.created_by = me or x.speaker_id = me or kafaa_has_grant('knowledge', array['A'])) then
      return kafaa_refuse('knowledge.lecture.save', 'lectures', v_id, 'not_found', 'Lecture not found', v_role);
    end if;
    if x.status not in ('draft', 'review') then
      return kafaa_refuse('knowledge.lecture.save', 'lectures', v_id, 'invalid', 'Only draft and submitted lectures can be edited; a published lecture is withdrawn first', v_role);
    end if;
  end if;
  v_speaker := coalesce(x.speaker_id, nullif(kafaa_lc_str(p -> 'speaker_id'), ''), me);
  if v_speaker <> me and not kafaa_has_grant('knowledge', array['A']) then
    return kafaa_refuse('knowledge.lecture.save', 'lectures', v_id, 'forbidden', 'Only the knowledge-management owner records a lecture on behalf of another speaker', v_role);
  end if;
  if v_speaker <> me then v_role := kafaa_acting_role('knowledge', array['A']); end if;
  select * into sp from kafaa_people where id = v_speaker;
  if sp.id is null or sp.kind <> 'staff' or sp.status <> 'active' then
    return kafaa_refuse('knowledge.lecture.save', 'lectures', v_id, 'invalid', 'The speaker must be an active ENEC staff member', v_role);
  end if;
  v_pos := kafaa_lc_resolve(p -> 'position_id', v_speaker);
  if not (v_pos ->> 'ok')::boolean then
    return kafaa_refuse('knowledge.lecture.save', 'lectures', v_id, 'invalid', 'A lecture protects the knowledge-loss-risk position its speaker holds, never someone else''s', v_role);
  end if;
  v_pid := v_pos ->> 'id';
  v_bad := kafaa_lc_problem(p, v_speaker, v_pid, current_date);
  if v_bad is not null then return kafaa_refuse('knowledge.lecture.save', 'lectures', v_id, v_bad ->> 'code', v_bad ->> 'message', v_role); end if;
  v_status := case when jsonb_typeof(p -> 'submit') = 'boolean' and (p ->> 'submit')::boolean then 'review' else 'draft' end;
  v_ch := coalesce((select jsonb_agg(jsonb_build_object('at', (c ->> 'at')::numeric::integer, 'en', kafaa_lc_str(c -> 'en'), 'ar', kafaa_lc_str(c -> 'ar')) order by o)
                    from jsonb_array_elements(case when jsonb_typeof(p -> 'chapters') = 'array' then p -> 'chapters' else '[]'::jsonb end) with ordinality q(c, o)), '[]'::jsonb);
  if v_pid is not null then select * into ps from kafaa_klra_positions where id = v_pid; end if;
  if x.id is null then
    v_id := kafaa_kc_rid('lec');
    insert into kafaa_lectures (id, title_en, title_ar, abstract_en, abstract_ar, speaker_id, speaker_name, speaker_name_ar, speaker_role_id, format, lang, delivered_on, duration_min,
      recording_code, chapters, skill_ids, position_id, position_title_en, position_title_ar, system_family, status, published, synthetic, history, created_by, created_at, updated_at)
    values (v_id, kafaa_lc_str(p -> 'title_en'), kafaa_lc_str(p -> 'title_ar'), kafaa_lc_str(p -> 'abstract_en'), kafaa_lc_str(p -> 'abstract_ar'), v_speaker, kafaa_kc_name(v_speaker, false),
      kafaa_kc_name(v_speaker, true), sp.job_role_id, p ->> 'format', p ->> 'lang', (p ->> 'delivered_on')::date, (p ->> 'duration_min')::numeric::integer, nullif(kafaa_lc_str(p -> 'recording_code'), ''),
      v_ch, kafaa_lc_list(p -> 'skill_ids'), v_pid, coalesce(ps.title_en, ''), coalesce(ps.title_ar, ''), p ->> 'system_family', v_status, false, true, jsonb_build_array(kafaa_kc_hist(v_status)),
      me, now(), now());
  else
    update kafaa_lectures set title_en = kafaa_lc_str(p -> 'title_en'), title_ar = kafaa_lc_str(p -> 'title_ar'), abstract_en = kafaa_lc_str(p -> 'abstract_en'), abstract_ar = kafaa_lc_str(p -> 'abstract_ar'),
      speaker_name = kafaa_kc_name(v_speaker, false), speaker_name_ar = kafaa_kc_name(v_speaker, true), speaker_role_id = sp.job_role_id, format = p ->> 'format', lang = p ->> 'lang',
      delivered_on = (p ->> 'delivered_on')::date, duration_min = (p ->> 'duration_min')::numeric::integer, recording_code = nullif(kafaa_lc_str(p -> 'recording_code'), ''), chapters = v_ch,
      skill_ids = kafaa_lc_list(p -> 'skill_ids'), position_id = v_pid, position_title_en = coalesce(ps.title_en, ''), position_title_ar = coalesce(ps.title_ar, ''), system_family = p ->> 'system_family',
      status = v_status, published = false, history = history || jsonb_build_array(kafaa_kc_hist(v_status)), updated_at = now()
    where id = v_id;
  end if;
  a := kafaa_audit('knowledge.lecture.save', 'lectures', v_id, 'ok', v_status, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when v_status = 'review' then 'Submitted for publication' else 'Draft saved' end, a, null, jsonb_build_object('id', v_id, 'status', v_status, 'position_id', v_pid));
end $$;

create or replace function kafaa_publish_lecture(p_id text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; x kafaa_lectures; v_bad jsonb; v_made text[]; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('knowledge.lecture.publish', 'lectures', p_id, 'not_signed_in', 'Sign in to use the lecture library'); end if;
  if not kafaa_has_grant('knowledge', array['A']) then return kafaa_refuse('knowledge.lecture.publish', 'lectures', p_id, 'forbidden', 'Only the knowledge-management owner publishes lectures and validates contributions'); end if;
  v_role := kafaa_acting_role('knowledge', array['A']);
  select * into x from kafaa_lectures where id = p_id;
  if x.id is null then return kafaa_refuse('knowledge.lecture.publish', 'lectures', p_id, 'not_found', 'Lecture not found', v_role); end if;
  if x.status <> 'review' then return kafaa_refuse('knowledge.lecture.publish', 'lectures', p_id, 'invalid', 'This lecture is not waiting for publication', v_role); end if;
  if x.speaker_id = me or x.created_by = me then return kafaa_refuse('knowledge.lecture.publish', 'lectures', p_id, 'maker_checker', 'You cannot publish a lecture you give or recorded yourself', v_role); end if;
  v_bad := kafaa_lc_problem(to_jsonb(x), x.speaker_id, x.position_id, current_date);
  if v_bad is not null then return kafaa_refuse('knowledge.lecture.publish', 'lectures', p_id, v_bad ->> 'code', v_bad ->> 'message', v_role); end if;
  update kafaa_lectures set status = 'published', published = true, published_by = me, published_at = now(), history = history || jsonb_build_array(kafaa_kc_hist('published')), updated_at = now() where id = p_id;
  v_made := kafaa_lc_open('lecture', p_id);
  perform kafaa_kc_notify('nt-lc-' || p_id || '-published', x.speaker_id, 'Your lecture is in the library: ' || x.title_en, 'محاضرتك متاحة في المكتبة: ' || x.title_ar, '/knowledge/lectures/' || p_id, 'ok');
  l := kafaa_ledger('kafaa.knowledge.lecture.publish', format('Lecture %s published to the lecture library', p_id));
  a := kafaa_audit('knowledge.lecture.publish', 'lectures', p_id, 'ok', 'published; contribution ' || coalesce(v_made[1], 'existing'), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Published to the lecture library', a, l, jsonb_build_object('status', 'published', 'contribution_id', v_made[1]));
end $$;

create or replace function kafaa_withdraw_lecture(p_id text, p_reason text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; x kafaa_lectures; v_owner boolean; v_why text := regexp_replace(coalesce(p_reason, ''), '^\s+|\s+$', '', 'g'); v_was boolean; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('knowledge.lecture.withdraw', 'lectures', p_id, 'not_signed_in', 'Sign in to use the lecture library'); end if;
  if not kafaa_has_grant('knowledge', array['R']) then return kafaa_refuse('knowledge.lecture.withdraw', 'lectures', p_id, 'forbidden', 'The lecture library is open to ENEC staff'); end if;
  select * into x from kafaa_lectures where id = p_id;
  v_owner := kafaa_has_grant('knowledge', array['A']);
  v_role := case when v_owner then kafaa_acting_role('knowledge', array['A']) else kafaa_acting_role('knowledge', array['R']) end;
  if x.id is null or (not v_owner and x.speaker_id <> me and not x.published) then return kafaa_refuse('knowledge.lecture.withdraw', 'lectures', p_id, 'not_found', 'Lecture not found', v_role); end if;
  if not v_owner and x.speaker_id <> me then return kafaa_refuse('knowledge.lecture.withdraw', 'lectures', p_id, 'forbidden', 'Only the speaker or the knowledge-management owner withdraws a lecture', v_role); end if;
  if x.status not in ('review', 'published') then return kafaa_refuse('knowledge.lecture.withdraw', 'lectures', p_id, 'invalid', 'Only submitted or published lectures can be withdrawn', v_role); end if;
  if char_length(v_why) < 5 or char_length(v_why) > 600 then return kafaa_refuse('knowledge.lecture.withdraw', 'lectures', p_id, 'invalid', 'Give a reason of 5 to 600 characters', v_role); end if;
  v_was := x.status = 'published';
  update kafaa_lectures set status = 'withdrawn', published = false, withdrawn_reason = v_why, history = history || jsonb_build_array(kafaa_kc_hist('withdrawn') || jsonb_build_object('note', v_why)), updated_at = now() where id = p_id;
  if v_was then l := kafaa_ledger('kafaa.knowledge.lecture.withdraw', format('Lecture %s withdrawn from the lecture library', p_id)); end if;
  a := kafaa_audit('knowledge.lecture.withdraw', 'lectures', p_id, 'ok', v_why, case when not v_was then 'not_applicable' when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Lecture withdrawn', a, l, jsonb_build_object('status', 'withdrawn'));
end $$;

create or replace function kafaa_sync_contributions() returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_ids text[] := '{}'::text[]; r record; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('knowledge.contribution.sync', 'contributions', null, 'not_signed_in', 'Sign in to use the lecture library'); end if;
  if not kafaa_has_grant('knowledge', array['A']) then return kafaa_refuse('knowledge.contribution.sync', 'contributions', null, 'forbidden', 'Only the knowledge-management owner publishes lectures and validates contributions'); end if;
  v_role := kafaa_acting_role('knowledge', array['A']);
  for r in select id from kafaa_lectures where status = 'published' and published order by id collate "C" loop v_ids := v_ids || kafaa_lc_open('lecture', r.id); end loop;
  for r in select id from kafaa_knowledge_assets where status = 'published' and published order by id collate "C" loop v_ids := v_ids || kafaa_lc_open('asset', r.id); end loop;
  a := kafaa_audit('knowledge.contribution.sync', 'contributions', null, 'ok', cardinality(v_ids) || ' opened', 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when cardinality(v_ids) > 0 then 'New contributions are waiting for validation' else 'Every published lecture and asset already has its contributions' end, a, null,
    jsonb_build_object('created', cardinality(v_ids), 'ids', to_jsonb(v_ids)));
end $$;

create or replace function kafaa_contribution_queue() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); v_can boolean;
begin
  if me is null then return null; end if;
  v_can := kafaa_has_grant('knowledge', array['A']);
  if not v_can and not kafaa_has_grant('audit_log', array['R']) then return null; end if;
  return jsonb_build_object('can_decide', v_can,
    'review', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'title_en', l.title_en, 'title_ar', l.title_ar, 'abstract_en', l.abstract_en, 'abstract_ar', l.abstract_ar,
        'speaker_id', l.speaker_id, 'speaker_name', l.speaker_name, 'speaker_name_ar', l.speaker_name_ar, 'created_by', l.created_by, 'format', l.format, 'lang', l.lang,
        'delivered_on', l.delivered_on::text, 'duration_min', l.duration_min, 'skill_ids', to_jsonb(l.skill_ids), 'position_id', l.position_id, 'position_title_en', l.position_title_en,
        'position_title_ar', l.position_title_ar, 'system_family', l.system_family, 'chapters', l.chapters, 'recording_code', l.recording_code) order by l.id collate "C")
      from kafaa_lectures l where l.status = 'review'), '[]'::jsonb),
    'pending', coalesce((select jsonb_agg(kafaa_lc_view(c) order by c.submitted_on, c.id collate "C") from kafaa_contributions c where c.status = 'pending'), '[]'::jsonb),
    'decided', coalesce((select jsonb_agg(kafaa_lc_view(d) order by d.decided_on desc nulls last, d.id collate "C") from (
        select * from kafaa_contributions c where c.status <> 'pending' order by c.decided_on desc nulls last, c.id collate "C" limit 50) d), '[]'::jsonb),
    'stats', jsonb_build_object(
      'pending', (select count(*) from kafaa_contributions where status = 'pending'),
      'validated', (select count(*) from kafaa_contributions where status = 'validated'),
      'rejected', (select count(*) from kafaa_contributions where status = 'rejected'),
      'people', (select count(distinct person_id) from kafaa_contributions where status = 'validated'),
      'evidence', (select coalesce(sum(cardinality(evidence_ids)), 0) from kafaa_contributions where status = 'validated')));
end $$;

create or replace function kafaa_validate_contribution(p_id text, p_decision text, p_note text default '') returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; c kafaa_contributions; v_ev text[] := '{}'::text[]; v_code text; v_note text := regexp_replace(coalesce(p_note, ''), '^\s+|\s+$', '', 'g');
  v_ids text[] := '{}'::text[]; v_eid text; s text; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('knowledge.contribution.decide', 'contributions', p_id, 'not_signed_in', 'Sign in to use the lecture library'); end if;
  if not kafaa_has_grant('knowledge', array['A']) then return kafaa_refuse('knowledge.contribution.decide', 'contributions', p_id, 'forbidden', 'Only the knowledge-management owner publishes lectures and validates contributions'); end if;
  v_role := kafaa_acting_role('knowledge', array['A']);
  select * into c from kafaa_contributions where id = p_id;
  if c.id is not null then v_ev := kafaa_lc_evidence_skills(c.skill_ids); end if;
  v_code := kafaa_lc_decide_problem(c, me, p_decision, p_note, case when c.id is null then false else kafaa_lc_source_published(c) end, cardinality(v_ev));
  if v_code = 'not_found' then return kafaa_refuse('knowledge.contribution.decide', 'contributions', p_id, 'not_found', 'Contribution not found', v_role); end if;
  if v_code = 'decided' then return kafaa_refuse('knowledge.contribution.decide', 'contributions', p_id, 'invalid', 'This contribution has already been decided', v_role); end if;
  if v_code = 'self' then return kafaa_refuse('knowledge.contribution.decide', 'contributions', p_id, 'maker_checker', 'You cannot validate your own contribution', v_role); end if;
  if v_code = 'decision' then return kafaa_refuse('knowledge.contribution.decide', 'contributions', p_id, 'invalid', 'Choose validate or reject; a rejection needs a reason of 5 to 600 characters', v_role); end if;
  if v_code = 'source' then return kafaa_refuse('knowledge.contribution.decide', 'contributions', p_id, 'source_unavailable', 'The lecture or knowledge asset behind this contribution is no longer published', v_role); end if;
  if v_code = 'skills' then return kafaa_refuse('knowledge.contribution.decide', 'contributions', p_id, 'invalid', 'This contribution names no skill that can carry evidence', v_role); end if;
  if p_decision = 'reject' then
    update kafaa_contributions set status = 'rejected', decided_by = me, decided_role = v_role, decided_on = current_date, note = v_note where id = p_id;
    perform kafaa_kc_notify('nt-lc-' || p_id || '-rejected', c.person_id, 'Contribution not validated yet: ' || c.title_en, 'لم يُعتمد الإسهام بعد: ' || c.title_ar, '/knowledge/lectures?tab=mine', 'warn');
    a := kafaa_audit('knowledge.contribution.decide', 'contributions', p_id, 'ok', 'rejected: ' || v_note, 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Contribution returned with your reason; no evidence was written', a, null, jsonb_build_object('status', 'rejected', 'evidence_ids', '[]'::jsonb));
  end if;
  perform set_config('kafaa.seeding', 'on', true);
  foreach s in array v_ev loop
    v_eid := 'se:contrib:' || c.id || ':' || s;
    insert into kafaa_skill_evidence (id, person_id, skill_id, kind, ref_table, ref_id, level, basis, status, observed_on, note, recorded_by, active)
    values (v_eid, c.person_id, s, 'rating', c.ref_table, c.ref_id, c.level, 'validated', 'current', current_date, 'Validated contribution (' || c.kind || ', ' || c.contributor_role || ')', me, true)
    on conflict (id) do update set level = excluded.level, basis = 'validated', status = 'current', observed_on = excluded.observed_on, note = excluded.note, recorded_by = me, active = true;
    v_ids := v_ids || v_eid;
  end loop;
  update kafaa_contributions set status = 'validated', decided_by = me, decided_role = v_role, decided_on = current_date, note = nullif(v_note, ''), evidence_ids = v_ids where id = p_id;
  perform kafaa_skills_apply(c.person_id, current_date);
  perform kafaa_kc_notify('nt-lc-' || p_id || '-validated', c.person_id, 'Contribution validated: ' || c.title_en, 'اعتُمد إسهامك: ' || c.title_ar, '/my/skills', 'ok');
  l := kafaa_ledger('kafaa.knowledge.contribution', format('Contribution %s by %s validated by %s: %s skill evidence rows (validated rating, level %s); internal recognition, not a qualification', p_id, c.person_id, me, cardinality(v_ids), c.level));
  a := kafaa_audit('knowledge.contribution.decide', 'contributions', p_id, 'ok', format('validated %s skills at level %s', cardinality(v_ids), c.level), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Contribution validated: the evidence is on their skills profile', a, l, jsonb_build_object('status', 'validated', 'evidence_ids', to_jsonb(v_ids)));
end $$;

-- ───────────── FS45 rules (mirror of src/modules/m24/localisation.ts)
-- Every F31 track as the readiness rule needs it: derived stage (kafaa_ins_stage) and currency status (kafaa_ins_currency), ordered by id.
create or replace function kafaa_lz_tracks(p_today date) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'person_id', t.person_id, 'status', t.status, 'stage', kafaa_ins_stage(t.id, kafaa_ins_initial_done(t.person_id, t.route)),
    'discipline', coalesce(t.discipline, ''), 'standard_ids', to_jsonb(t.standard_ids), 'currency', kafaa_ins_currency(t.id, p_today) ->> 'status') order by t.id collate "C"), '[]'::jsonb)
  from kafaa_instructor_tracks t
$$;
create or replace function kafaa_lz_items() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'programme_id', i.programme_id, 'title_en', i.title_en, 'title_ar', i.title_ar, 'scope', i.scope, 'partner_org_id', i.partner_org_id,
    'standard_ids', to_jsonb(i.standard_ids), 'discipline', i.discipline, 'instructors_needed', i.instructors_needed, 'baseline_on', i.baseline_on::text, 'target_on', i.target_on::text,
    'status', i.status, 'sort', i.sort) order by i.id collate "C"), '[]'::jsonb)
  from kafaa_localisation_items i
$$;
create or replace function kafaa_lz_reason(p_code text, p_vars jsonb) returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object('code', p_code, 'key', 'm24.lz.reason.' || p_code, 'vars', coalesce(p_vars, '{}'::jsonb))
$$;
-- readiness(): computed from the tracks, never stored.
create or replace function kafaa_lz_readiness(p_item jsonb, p_tracks jsonb) returns jsonb language plpgsql immutable set search_path = public as $$
declare t jsonb; v_lines jsonb := '[]'::jsonb; v_stds jsonb := coalesce(p_item -> 'standard_ids', '[]'::jsonb); v_disc text := coalesce(p_item ->> 'discipline', ''); v_cov boolean; v_ok boolean;
  v_need integer; v_ready integer; v_lapsed integer; v_pipe integer; v_tenths integer;
begin
  for t in select e from jsonb_array_elements(coalesce(p_tracks, '[]'::jsonb)) e order by e ->> 'id' collate "C" loop
    if jsonb_array_length(v_stds) > 0 then
      v_cov := exists (select 1 from jsonb_array_elements_text(coalesce(t -> 'standard_ids', '[]'::jsonb)) s where v_stds ? s);
    else
      v_cov := v_disc <> '' and coalesce(t ->> 'discipline', '') = v_disc;
    end if;
    if not v_cov then continue; end if;
    if t ->> 'status' in ('withdrawn', 'declined') then continue; end if;
    if t ->> 'status' in ('qualified', 'lapsed') then
      v_ok := t ->> 'status' = 'qualified' and t ->> 'currency' is not null and t ->> 'currency' <> 'lapsed';
      v_lines := v_lines || jsonb_build_array(jsonb_build_object('track_id', t ->> 'id', 'person_id', t ->> 'person_id', 'state', case when v_ok then 'qualified' else 'lapsed' end, 'tenths', case when v_ok then 10 else 0 end));
      continue;
    end if;
    if t ->> 'status' <> 'active' then continue; end if;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object('track_id', t ->> 'id', 'person_id', t ->> 'person_id', 'state', t ->> 'stage',
      'tenths', case t ->> 'stage' when 'ready' then 8 when 'solo' then 6 when 'co_teach' then 4 when 'initial_training' then 2 when 'nominated' then 1 else 0 end));
  end loop;
  v_need := greatest(1, coalesce(trunc((p_item ->> 'instructors_needed')::numeric)::integer, 0));
  select count(*) filter (where l ->> 'state' = 'qualified'), count(*) filter (where l ->> 'state' = 'lapsed'), count(*) filter (where l ->> 'state' not in ('qualified', 'lapsed')),
         coalesce(sum((l ->> 'tenths')::integer), 0)
    into v_ready, v_lapsed, v_pipe, v_tenths from jsonb_array_elements(v_lines) l;
  return jsonb_build_object('needed', v_need, 'ready_now', v_ready, 'pipeline', v_pipe, 'lapsed', v_lapsed, 'tenths', v_tenths, 'pct', least(100, (v_tenths * 10) / v_need),
    'gap', greatest(0, v_need - v_ready), 'lines', v_lines);
end $$;
-- riskOf()
create or replace function kafaa_lz_risk(p_item jsonb, r jsonb, p_today date) returns jsonb language plpgsql immutable set search_path = public as $$
declare v_days integer := (p_item ->> 'target_on')::date - p_today; v_reasons jsonb; v_level text := 'low'; v_pct integer := (r ->> 'pct')::integer; v_reg boolean;
begin
  v_reasons := jsonb_build_array(kafaa_lz_reason('ready', jsonb_build_object('n', (r ->> 'ready_now')::integer, 'need', (r ->> 'needed')::integer)));
  if (r ->> 'pipeline')::integer > 0 then v_reasons := v_reasons || jsonb_build_array(kafaa_lz_reason('pipeline', jsonb_build_object('n', (r ->> 'pipeline')::integer))); end if;
  if (r ->> 'lapsed')::integer > 0 then v_reasons := v_reasons || jsonb_build_array(kafaa_lz_reason('lapsed', jsonb_build_object('n', (r ->> 'lapsed')::integer))); end if;
  v_reasons := v_reasons || jsonb_build_array(kafaa_lz_reason('pct', jsonb_build_object('pct', v_pct)));
  if p_item ->> 'status' = 'transferred' then
    v_reg := (r ->> 'ready_now')::integer < (r ->> 'needed')::integer;
    v_reasons := v_reasons || jsonb_build_array(kafaa_lz_reason(case when v_reg then 'regressed' else 'transferred' end, '{}'::jsonb));
    return jsonb_build_object('level', 'done', 'overdue', false, 'days_left', v_days, 'regressed', v_reg, 'reasons', v_reasons);
  end if;
  if v_days < 0 then
    v_reasons := v_reasons || jsonb_build_array(kafaa_lz_reason('overdue', jsonb_build_object('days', -v_days)));
    return jsonb_build_object('level', 'overdue', 'overdue', true, 'days_left', v_days, 'regressed', false, 'reasons', v_reasons);
  end if;
  v_reasons := v_reasons || jsonb_build_array(kafaa_lz_reason('days', jsonb_build_object('days', v_days)));
  if (v_pct < 50 and v_days <= 548) or (v_pct < 80 and v_days <= 183) then v_level := 'high';
  elsif (v_pct < 80 and v_days <= 730) or v_pct < 50 or p_item ->> 'status' = 'on_hold' then v_level := 'medium'; end if;
  if p_item ->> 'status' = 'on_hold' then v_reasons := v_reasons || jsonb_build_array(kafaa_lz_reason('on_hold', '{}'::jsonb)); end if;
  return jsonb_build_object('level', v_level, 'overdue', false, 'days_left', v_days, 'regressed', false, 'reasons', v_reasons);
end $$;
-- computeBoard(): {items: [{id, readiness, risk}] ordered by target, sort, id; summary}.
create or replace function kafaa_lz_compute(p_items jsonb, p_tracks jsonb, p_today date) returns jsonb language plpgsql immutable set search_path = public as $$
declare it jsonb; r jsonb; k jsonb; v_out jsonb := '[]'::jsonb;
begin
  for it in select e from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) e order by e ->> 'target_on' collate "C", coalesce((e ->> 'sort')::integer, 0), e ->> 'id' collate "C" loop
    r := kafaa_lz_readiness(it, p_tracks);
    k := kafaa_lz_risk(it, r, p_today);
    v_out := v_out || jsonb_build_array(jsonb_build_object('id', it ->> 'id', 'readiness', r, 'risk', k));
  end loop;
  return jsonb_build_object('items', v_out, 'summary', jsonb_build_object(
    'items', jsonb_array_length(v_out),
    'transferred', (select count(*) from jsonb_array_elements(v_out) x where x -> 'risk' ->> 'level' = 'done'),
    'overdue', (select count(*) from jsonb_array_elements(v_out) x where x -> 'risk' ->> 'level' = 'overdue'),
    'high', (select count(*) from jsonb_array_elements(v_out) x where x -> 'risk' ->> 'level' = 'high'),
    'medium', (select count(*) from jsonb_array_elements(v_out) x where x -> 'risk' ->> 'level' = 'medium'),
    'low', (select count(*) from jsonb_array_elements(v_out) x where x -> 'risk' ->> 'level' = 'low'),
    'avg_pct', case when jsonb_array_length(v_out) = 0 then 0 else floor((select sum((x -> 'readiness' ->> 'pct')::integer) from jsonb_array_elements(v_out) x)::numeric / jsonb_array_length(v_out))::integer end,
    'days_to_2030', date '2030-12-31' - p_today,
    'by_year', coalesce((select jsonb_agg(jsonb_build_object('year', y.yr, 'items', y.n, 'transferred', y.t) order by y.yr) from (
        select left(e ->> 'target_on', 4)::integer yr, count(*) n, count(*) filter (where e ->> 'status' = 'transferred') t from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) e group by 1) y), '[]'::jsonb)));
end $$;
-- statusProblem(): ok | status | target | unchanged | note_long | note_required | not_ready.
create or replace function kafaa_lz_status_problem(p_item jsonb, p jsonb, r jsonb) returns text language plpgsql immutable set search_path = public as $$
declare v_status text; v_target text; v_note text;
begin
  if coalesce(jsonb_typeof(p -> 'status'), '') <> 'string' or p ->> 'status' not in ('partner_led', 'co_delivery', 'uae_led_supervised', 'transferred', 'on_hold') then return 'status'; end if;
  v_status := p ->> 'status';
  v_target := case when p -> 'target_on' is null or jsonb_typeof(p -> 'target_on') = 'null' or (jsonb_typeof(p -> 'target_on') = 'string' and p ->> 'target_on' = '') then p_item ->> 'target_on'
                   when jsonb_typeof(p -> 'target_on') = 'string' then p ->> 'target_on' else '!' end;
  if not kafaa_kc_isoday(v_target) or v_target > '2030-12-31' or v_target < p_item ->> 'baseline_on' then return 'target'; end if;
  if v_status = p_item ->> 'status' and v_target = p_item ->> 'target_on' then return 'unchanged'; end if;
  v_note := kafaa_lc_str(p -> 'note');
  if char_length(v_note) > 600 then return 'note_long'; end if;
  if (v_target <> p_item ->> 'target_on' or v_status = 'on_hold' or (p_item ->> 'status' = 'transferred' and v_status <> 'transferred')) and char_length(v_note) < 10 then return 'note_required'; end if;
  if v_status = 'transferred' and p_item ->> 'status' <> 'transferred' and (r ->> 'ready_now')::integer < (r ->> 'needed')::integer then return 'not_ready'; end if;
  return 'ok';
end $$;
