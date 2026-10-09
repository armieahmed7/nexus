-- [W5 · E5 · F36 + F37] Personal weekly digest and nudges (shell) and Dalil career mode (module M13 additions).
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file, RLS in the per-statement form
-- (like 20261008140000_kafaa_rls_perf.sql), the digest rules (mirror of src/shell/digest/rules.ts), the RPCs kafaa_build_digest,
-- kafaa_set_digest_prefs, kafaa_digest_stats and kafaa_dalil_career_turn, and two nullable submode columns on the Dalil logs
-- (the existing mode check cannot be widened without replacing it, so career turns keep mode 'staff' and set submode 'career').
-- LocalBackend mirrors: src/shell/digest/backend/local.ts, src/modules/m13/backend/local.ts.
-- PGlite checks: scripts/validate/w5e5-digest-dalil.mjs.

-- ───────────── Tables (generated DDL)
-- M14 · Personal digest per period: up to 7 items with deep links and reasons, and the notification written (F36)
create table if not exists kafaa_digest_runs (
  id text primary key,
  person_id text not null,
  period text not null,
  frequency text not null default 'weekly' check (frequency in ('weekly', 'fortnightly', 'monthly')),
  as_of date not null,
  items jsonb not null default '[]'::jsonb,
  item_count integer not null default 0,
  notification_id text,
  coach_hint boolean not null default false,
  built_at timestamptz not null default now()
);
comment on table kafaa_digest_runs is '[M14] Personal digest per period: up to 7 items with deep links and reasons, and the notification written (F36)';

-- M14 · Nudge settings per person: on or off, frequency, quiet hours (Abu Dhabi time), muted kinds (F36)
create table if not exists kafaa_digest_prefs (
  id text primary key,
  person_id text not null unique,
  enabled boolean not null default true,
  frequency text not null default 'weekly' check (frequency in ('weekly', 'fortnightly', 'monthly')),
  quiet_start integer,
  quiet_end integer,
  muted_kinds text[] not null default '{}'::text[],
  updated_at timestamptz not null default now()
);
comment on table kafaa_digest_prefs is '[M14] Nudge settings per person: on or off, frequency, quiet hours (Abu Dhabi time), muted kinds (F36)';

-- M13 · Dalil career mode (F37): nullable submode on sessions and turns
alter table kafaa_advisor_sessions add column if not exists submode text check (submode in ('career'));
alter table kafaa_advisor_turns add column if not exists submode text check (submode in ('career'));

-- Foreign keys and indexes
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_digest_runs_person_id_fk') then alter table kafaa_digest_runs add constraint kafaa_digest_runs_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_digest_prefs_person_id_fk') then alter table kafaa_digest_prefs add constraint kafaa_digest_prefs_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_digest_runs_person_id_idx on kafaa_digest_runs (person_id);
create index if not exists kafaa_digest_runs_period_idx on kafaa_digest_runs (period);

-- ───────────── RLS (policies created when missing, then set to the per-statement form): own rows only
alter table kafaa_digest_runs enable row level security;
alter table kafaa_digest_prefs enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_digest_runs' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_digest_runs for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_digest_prefs' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_digest_prefs for select to anon, authenticated using (false)'; end if;
end $$;
alter policy kafaa_read on kafaa_digest_runs using ((((SELECT kafaa_has_grant('notifications'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('notifications'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('notifications'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('notifications'::text, person_id, NULL::text, false))));
alter policy kafaa_read on kafaa_digest_prefs using ((((SELECT kafaa_has_grant('notifications'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('notifications'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('notifications'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('notifications'::text, person_id, NULL::text, false))));
-- Both tables change only through the SECURITY DEFINER RPCs below.
revoke all on kafaa_digest_runs, kafaa_digest_prefs from anon, authenticated;
grant select on kafaa_digest_runs, kafaa_digest_prefs to anon, authenticated;

-- ───────────── Digest rules (internal; mirror of src/shell/digest/rules.ts)
-- Period key: weekly 2026-W41, fortnightly 2026-F21 (ISO weeks 41-42), monthly 2026-M10.
create or replace function kafaa_dg_period(p_date date, p_freq text) returns text language sql immutable set search_path = public as $$
  select case when p_freq = 'monthly' then to_char(p_date, 'YYYY') || '-M' || to_char(p_date, 'MM')
              when p_freq = 'fortnightly' then to_char(p_date, 'IYYY') || '-F' || lpad(ceil(to_char(p_date, 'IW')::int / 2.0)::int::text, 2, '0')
              else to_char(p_date, 'IYYY') || '-W' || to_char(p_date, 'IW') end
$$;
-- Quiet hours [start, end) in local hours; a window may wrap midnight; equal or missing ends mean none.
create or replace function kafaa_dg_in_quiet(p_hour integer, p_start integer, p_end integer) returns boolean language sql immutable set search_path = public as $$
  select case when p_start is null or p_end is null or p_start = p_end then false
              when p_start < p_end then p_hour >= p_start and p_hour < p_end
              else p_hour >= p_start or p_hour < p_end end
$$;
-- The coach hint (top F07 card from the page): short bilingual text, an internal link, up to 6 keyed reasons.
create or replace function kafaa_dg_hint_ok(p jsonb) returns boolean language plpgsql immutable set search_path = public as $$
declare r jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return false; end if;
  if jsonb_typeof(p->'id') is distinct from 'string' or length(btrim(p->>'id')) = 0 or length(p->>'id') > 120 then return false; end if;
  if jsonb_typeof(p->'item_id') is distinct from 'string' or length(btrim(p->>'item_id')) = 0 or length(p->>'item_id') > 120 then return false; end if;
  if jsonb_typeof(p->'title_en') is distinct from 'string' or length(btrim(p->>'title_en')) = 0 or length(p->>'title_en') > 200 then return false; end if;
  if jsonb_typeof(p->'title_ar') is distinct from 'string' or length(btrim(p->>'title_ar')) = 0 or length(p->>'title_ar') > 200 then return false; end if;
  if jsonb_typeof(p->'link') is distinct from 'string' or length(btrim(p->>'link')) = 0 or length(p->>'link') > 200 then return false; end if;
  if (p->>'link') !~ '^/[A-Za-z0-9/_?=&#.:-]*$' or left(p->>'link', 2) = '//' then return false; end if;
  if jsonb_typeof(p->'reasons') is distinct from 'array' or jsonb_array_length(p->'reasons') > 6 then return false; end if;
  for r in select x from jsonb_array_elements(p->'reasons') x loop
    if jsonb_typeof(r) <> 'object' or jsonb_typeof(r->'code') is distinct from 'string' or jsonb_typeof(r->'key') is distinct from 'string' then return false; end if;
    if (r->>'key') !~* '^[a-z0-9]+\.[A-Za-z0-9_.-]+$' then return false; end if;
    if r ? 'vars' and jsonb_typeof(r->'vars') not in ('object', 'null') then return false; end if;
  end loop;
  return true;
end $$;
-- Level a role needs on a skill (F08 roleNeed): the requirement on core skills, min(key level, requirement) on specialised ones.
create or replace function kafaa_dg_role_need(p_role text, p_skill text) returns integer language sql stable security definer set search_path = public as $$
  select coalesce((select case when s.core then rc.required_level else least(s.key_level, rc.required_level) end
                     from kafaa_skills s join kafaa_role_competencies rc on rc.competency_id = s.competency_id and rc.role_id = p_role
                    where p_role is not null and s.id = p_skill order by rc.id collate "C" limit 1), 0)
$$;
-- F08 match score for one opportunity (same float arithmetic as src/shell/digest/rules.ts matchScore).
create or replace function kafaa_dg_match(p_needed text[], p_gained text[], p_lv jsonb, p_cur text, p_tgt text, p_w jsonb) returns double precision
language plpgsql stable security definer set search_path = public as $$
declare
  w1 double precision := coalesce(case when jsonb_typeof(p_w->'skills') = 'number' then (p_w->>'skills')::float8 end, 0.7);
  w2 double precision := coalesce(case when jsonb_typeof(p_w->'development') = 'number' then (p_w->>'development')::float8 end, 0.2);
  w3 double precision := coalesce(case when jsonb_typeof(p_w->'target') = 'number' then (p_w->>'target')::float8 end, 0.1);
  wsum double precision; fit double precision := 1; dev double precision := 0; tg double precision; v_sum integer := 0; t integer := 0;
  x text; my integer; need integer;
begin
  wsum := (w1 + w2) + w3;
  if wsum = 0 then wsum := 1; end if;
  if coalesce(cardinality(p_needed), 0) > 0 then
    foreach x in array p_needed loop v_sum := v_sum + least(coalesce((p_lv->>x)::int, 0), 2); end loop;
    fit := v_sum::float8 / (2 * cardinality(p_needed))::float8;
  end if;
  if coalesce(cardinality(p_gained), 0) > 0 then
    foreach x in array p_gained loop
      my := coalesce((p_lv->>x)::int, 0);
      need := greatest(kafaa_dg_role_need(p_cur, x), kafaa_dg_role_need(p_tgt, x));
      if need > my then dev := dev + least(need - my, 2)::float8 / 2; end if;
    end loop;
    dev := dev / cardinality(p_gained)::float8;
  end if;
  if p_tgt is not null then
    for x in select distinct u from unnest(coalesce(p_needed, '{}'::text[]) || coalesce(p_gained, '{}'::text[])) u loop
      if kafaa_dg_role_need(p_tgt, x) > coalesce((p_lv->>x)::int, 0) then t := t + 1; end if;
    end loop;
  end if;
  tg := least(1::float8, t::float8 / 2);
  return floor(((w1 * fit + w2 * dev) + w3 * tg) / wsum * 10000 + 0.5) / 10000;
end $$;

create or replace function kafaa_dg_item(p_id text, p_kind text, p_ref_table text, p_ref_id text, p_title_en text, p_title_ar text, p_link text, p_why jsonb,
  p_meta_en text default null, p_meta_ar text default null, p_due date default null, p_days integer default null, p_score double precision default null)
returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object('id', p_id, 'kind', p_kind, 'urgency', case p_kind when 'expiry' then 1 when 'approval' then 2 else 3 end, 'ref_table', p_ref_table, 'ref_id', p_ref_id,
    'title_en', p_title_en, 'title_ar', p_title_ar, 'meta_en', p_meta_en, 'meta_ar', p_meta_ar, 'link', p_link, 'due_on', to_char(p_due, 'YYYY-MM-DD'), 'days', p_days,
    'score', to_jsonb(p_score), 'why', p_why)
$$;

-- Every candidate item for one person on one day (before mutes, caps and the 7-item limit).
create or replace function kafaa_dg_gather(p_me text, p_today date, p_hints jsonb) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  pe kafaa_people; out jsonb := '[]'::jsonb; r record; v_until date := p_today + 90; v_days integer; v_lv jsonb; v_tgt text; v_w jsonb; v_score double precision;
  v_short text[]; v_last date; v_due date; v_state text; v_n integer; v_hint jsonb := p_hints->'coach';
begin
  select * into pe from kafaa_people where id = p_me;
  if pe.id is null then return out; end if;
  -- expiry: qualifications (current status, non-restricted standard, not a security mirror) within 90 days
  for r in select q.id, q.expires_on, s.code, s.title_en, s.title_ar from kafaa_qual_records q join kafaa_qual_standards s on s.id = q.standard_id
           where q.person_id = p_me and not coalesce(s.security_restricted, false) and not coalesce(q.security_mirror_only, false)
             and q.status in ('qualified', 'due', 'renewed') and q.expires_on is not null and q.expires_on >= p_today and q.expires_on <= v_until loop
    v_days := r.expires_on - p_today;
    out := out || kafaa_dg_item('expiry:qual_records:' || r.id, 'expiry', 'qual_records', r.id, r.code || ' · ' || r.title_en, r.code || ' · ' || r.title_ar, '/my/quals',
      jsonb_build_array(jsonb_build_object('code', 'expiry_qual', 'vars', jsonb_build_object('days', v_days, 'date', to_char(r.expires_on, 'YYYY-MM-DD'))), jsonb_build_object('code', 'expiry_notice')),
      null, null, r.expires_on, v_days);
  end loop;
  -- expiry: mirrored licences
  for r in select l.id, l.type, l.expires_on from kafaa_licences l where l.person_id = p_me and l.status = 'valid' and l.expires_on is not null and l.expires_on >= p_today and l.expires_on <= v_until loop
    v_days := r.expires_on - p_today;
    out := out || kafaa_dg_item('expiry:licences:' || r.id, 'expiry', 'licences', r.id, r.type || ' operator certificate (licensee mirror)', 'شهادة ' || r.type || ' (نسخة مطابقة لسجلات المرخَّص له)', '/my/licence',
      jsonb_build_array(jsonb_build_object('code', 'expiry_licence', 'vars', jsonb_build_object('days', v_days, 'date', to_char(r.expires_on, 'YYYY-MM-DD'))), jsonb_build_object('code', 'mirror')),
      null, null, r.expires_on, v_days);
  end loop;
  -- approvals: skill ratings asked of me (one per open check-in; the manager request first)
  for r in select distinct on (c.id collate "C") c.id, c.person_id, c.due_on, rt.rater_kind, p.id as pid, p.display_name, p.display_name_ar
           from kafaa_skill_ratings rt join kafaa_skill_checkins c on c.id = rt.checkin_id and c.status = 'open'
           left join kafaa_people p on p.id = c.person_id
           where rt.rater_person_id = p_me and rt.status = 'pending' and rt.rater_kind in ('manager', 'peer') and c.person_id <> p_me
           order by c.id collate "C", rt.rater_kind collate "C" loop
    out := out || kafaa_dg_item('approval:skill_checkins:' || r.id, 'approval', 'skill_checkins', r.id,
      'Skill check-in: ' || case when r.pid is null then 'A colleague' else r.display_name end, 'تقييم مهارات: ' || case when r.pid is null then 'زميل' else coalesce(nullif(r.display_name_ar, ''), r.display_name) end,
      case when r.rater_kind = 'manager' then '/team/skills/validate' else '/my/skills/checkins' end,
      jsonb_build_array(jsonb_build_object('code', case when r.rater_kind = 'manager' then 'approval_rating_manager' else 'approval_rating_peer' end,
        'vars', case when r.due_on is null then '{}'::jsonb else jsonb_build_object('date', to_char(r.due_on, 'YYYY-MM-DD')) end)),
      case when r.pid is null then 'A colleague' else r.display_name end, case when r.pid is null then 'زميل' else coalesce(nullif(r.display_name_ar, ''), r.display_name) end,
      r.due_on, case when r.due_on is null then null else r.due_on - p_today end);
  end loop;
  -- approvals: mentoring requests addressed to me
  for r in select m.id, m.created_at, p.id as pid, p.display_name, p.display_name_ar from kafaa_mentoring_requests m left join kafaa_people p on p.id = m.person_id
           where m.mentor_person_id = p_me and m.status = 'requested' and m.person_id <> p_me loop
    out := out || kafaa_dg_item('approval:mentoring_requests:' || r.id, 'approval', 'mentoring_requests', r.id,
      'Mentoring request from ' || case when r.pid is null then 'A colleague' else r.display_name end, 'طلب إرشاد من ' || case when r.pid is null then 'زميل' else coalesce(nullif(r.display_name_ar, ''), r.display_name) end,
      '/my/mentoring', jsonb_build_array(jsonb_build_object('code', 'approval_mentoring', 'vars', jsonb_build_object('date', to_char(r.created_at at time zone 'UTC', 'YYYY-MM-DD')))),
      case when r.pid is null then 'A colleague' else r.display_name end, case when r.pid is null then 'زميل' else coalesce(nullif(r.display_name_ar, ''), r.display_name) end);
  end loop;
  -- approvals: mentoring agreements proposed to me
  for r in select a.id, p.id as pid, p.display_name, p.display_name_ar from kafaa_mentoring_agreements a
           left join kafaa_people p on p.id = case when a.person_id = p_me then a.mentor_person_id else a.person_id end
           where a.status = 'proposed' and (a.person_id = p_me or a.mentor_person_id = p_me) and a.proposed_by is distinct from p_me loop
    out := out || kafaa_dg_item('approval:mentoring_agreements:' || r.id, 'approval', 'mentoring_agreements', r.id,
      'Mentoring agreement with ' || case when r.pid is null then 'A colleague' else r.display_name end, 'اتفاقية إرشاد مع ' || case when r.pid is null then 'زميل' else coalesce(nullif(r.display_name_ar, ''), r.display_name) end,
      '/my/mentoring/' || r.id, jsonb_build_array(jsonb_build_object('code', 'approval_agreement')),
      case when r.pid is null then 'A colleague' else r.display_name end, case when r.pid is null then 'زميل' else coalesce(nullif(r.display_name_ar, ''), r.display_name) end);
  end loop;
  -- approvals: opportunity releases waiting for me
  for r in select a.id, a.opportunity_id, a.created_at, a.applicant_name, a.applicant_name_ar, o.id as oid, o.title_en, o.title_ar, p.id as pid, p.display_name, p.display_name_ar
           from kafaa_opportunity_applications a left join kafaa_opportunities o on o.id = a.opportunity_id left join kafaa_people p on p.id = a.person_id
           where a.releaser_id = p_me and a.status = 'applied' and a.person_id <> p_me loop
    out := out || kafaa_dg_item('approval:opportunity_applications:' || r.id, 'approval', 'opportunity_applications', r.id,
      'Release decision: ' || coalesce(r.title_en, r.opportunity_id), 'قرار الإفراج: ' || coalesce(nullif(r.title_ar, ''), nullif(r.title_en, ''), r.opportunity_id), '/opportunities/manage',
      jsonb_build_array(jsonb_build_object('code', 'approval_release', 'vars', jsonb_build_object('date', to_char(r.created_at at time zone 'UTC', 'YYYY-MM-DD')))),
      coalesce(nullif(r.applicant_name, ''), case when r.pid is null then 'A colleague' else r.display_name end),
      coalesce(nullif(r.applicant_name_ar, ''), nullif(r.applicant_name, ''), case when r.pid is null then 'زميل' else coalesce(nullif(r.display_name_ar, ''), r.display_name) end));
  end loop;
  -- approvals: my career-conversation record to acknowledge
  for r in select c.id, c.held_on from kafaa_career_conversations c where c.person_id = p_me and c.status = 'held' loop
    out := out || kafaa_dg_item('approval:career_conversations:' || r.id, 'approval', 'career_conversations', r.id, 'Acknowledge your career conversation record', 'أكّد سجل حوارك المهني',
      '/my/career/conversations', jsonb_build_array(jsonb_build_object('code', 'approval_ack', 'vars', case when r.held_on is null then '{}'::jsonb else jsonb_build_object('date', to_char(r.held_on, 'YYYY-MM-DD')) end)));
  end loop;
  -- coach: the F07 top card (hint) unless I opted out of coach ranking, else my soonest mandatory training due within 60 days
  if v_hint is not null and jsonb_typeof(v_hint) = 'object' and kafaa_dg_hint_ok(v_hint)
     and not exists (select 1 from kafaa_reco_optouts o where o.person_id = p_me and o.surface = 'coach' and o.opted_out) then
    out := out || kafaa_dg_item('coach:coach:' || (v_hint->>'id'), 'coach', 'coach', v_hint->>'id', v_hint->>'title_en', v_hint->>'title_ar', v_hint->>'link',
      jsonb_build_array(jsonb_build_object('code', 'coach_top')) || coalesce((select jsonb_agg(jsonb_build_object('code', x->>'code', 'key', x->>'key', 'vars', coalesce(nullif(x->'vars', 'null'::jsonb), '{}'::jsonb)) order by i)
        from jsonb_array_elements(v_hint->'reasons') with ordinality e(x, i) where i <= 5), '[]'::jsonb));
  else
    select e.id, e.due_on, c.id as cid, c.code, c.title_en, c.title_ar into r from kafaa_enrolments e join kafaa_courses c on c.id = e.course_id
     where e.person_id = p_me and e.status in ('assigned', 'requested', 'approved', 'waitlisted', 'enrolled', 'in_progress') and e.due_on is not null and e.due_on >= p_today and e.due_on <= p_today + 60
     order by e.due_on, e.id collate "C" limit 1;
    if found then
      out := out || kafaa_dg_item('coach:enrolments:' || r.id, 'coach', 'enrolments', r.id, r.code || ' · ' || r.title_en, r.code || ' · ' || r.title_ar, '/learn/course/' || r.cid,
        jsonb_build_array(jsonb_build_object('code', 'coach_due', 'vars', jsonb_build_object('days', r.due_on - p_today, 'date', to_char(r.due_on, 'YYYY-MM-DD')))), null, null, r.due_on, r.due_on - p_today);
    end if;
  end if;
  -- opportunity: new (21 days), open, listed, seats left, eligible, not mine, not applied, match >= 0.7; none when I opted out of marketplace ranking
  if not exists (select 1 from kafaa_reco_optouts o where o.person_id = p_me and o.surface = 'marketplace' and o.opted_out) then
    select coalesce(jsonb_object_agg(x.skill_id, x.lv), '{}'::jsonb) into v_lv from (select ps.skill_id, max(ps.level) lv from kafaa_person_skills ps where ps.person_id = p_me and ps.active is not false and ps.level > 0 group by ps.skill_id) x;
    v_short := array(select t.role_id from kafaa_career_targets t where t.person_id = p_me and t.active is not false order by t.rank, t.id collate "C");
    v_tgt := (select x from unnest(v_short) with ordinality u(x, i) where x is not null and x <> '' and x is distinct from pe.job_role_id order by i limit 1);
    if v_tgt is null and pe.job_role_id is not null then
      v_tgt := coalesce((select cp.to_role_id from kafaa_career_paths cp where cp.from_role_id = pe.job_role_id and cp.type = 'vertical' order by coalesce(cp.sort, 0), cp.id collate "C" limit 1),
                        (select cp.to_role_id from kafaa_career_paths cp where cp.from_role_id = pe.job_role_id order by coalesce(cp.sort, 0), cp.id collate "C" limit 1));
    end if;
    v_w := coalesce((select es.weights from kafaa_engine_settings es where es.id = 'match'), '{}'::jsonb);
    for r in select o.* from kafaa_opportunities o
             where o.status = 'open' and o.listed is not false and o.posted_by is distinct from p_me
               and (o.created_at at time zone 'UTC')::date >= p_today - 21 and (o.created_at at time zone 'UTC')::date <= p_today
               and (o.seats is null or coalesce(o.seats_taken, 0) < o.seats)
               and (coalesce(cardinality(o.eligible_families), 0) = 0 or (pe.job_family_id is not null and pe.job_family_id = any(o.eligible_families)))
               and not exists (select 1 from kafaa_opportunity_applications a where a.person_id = p_me and a.opportunity_id = o.id
                                and a.status in ('applied', 'released', 'selected', 'completed', 'declined_release', 'not_selected')) loop
      v_score := kafaa_dg_match(r.skills_needed, r.skills_gained, v_lv, pe.job_role_id, v_tgt, v_w);
      if v_score >= 0.7 then
        out := out || kafaa_dg_item('opportunity:opportunities:' || r.id, 'opportunity', 'opportunities', r.id, r.title_en, coalesce(nullif(r.title_ar, ''), r.title_en), '/opportunities/' || r.id,
          jsonb_build_array(jsonb_build_object('code', 'opp_match', 'vars', jsonb_build_object('pct', floor(v_score * 100 + 0.5)::int)),
                            jsonb_build_object('code', 'opp_new', 'vars', jsonb_build_object('date', to_char(r.created_at at time zone 'UTC', 'YYYY-MM-DD')))),
          null, null, null, null, v_score);
      end if;
    end loop;
  end if;
  -- mentoring: the soonest next session (cadence after the last one, else after the start) within 7 days
  select x.id, x.nxt, x.cadence, p.id as pid, p.display_name, p.display_name_ar into r from (
    select a.id, a.cadence, case when a.person_id = p_me then a.mentor_person_id else a.person_id end as other,
           coalesce((select max(s.held_on) from kafaa_mentoring_sessions s where s.agreement_id = a.id), a.starts_on)
             + case a.cadence when 'weekly' then 7 when 'fortnightly' then 14 when 'monthly' then 30 else 30 end as nxt
      from kafaa_mentoring_agreements a where a.status = 'active' and (a.person_id = p_me or a.mentor_person_id = p_me)) x
    left join kafaa_people p on p.id = x.other
   where x.nxt <= p_today + 7 order by x.nxt, x.id collate "C" limit 1;
  if found then
    out := out || kafaa_dg_item('mentoring:mentoring_agreements:' || r.id, 'mentoring', 'mentoring_agreements', r.id,
      'Mentoring session with ' || case when r.pid is null then 'A colleague' else r.display_name end, 'جلسة إرشاد مع ' || case when r.pid is null then 'زميل' else coalesce(nullif(r.display_name_ar, ''), r.display_name) end,
      '/my/mentoring/' || r.id,
      jsonb_build_array(jsonb_build_object('code', case when r.nxt < p_today then 'mentoring_overdue' else 'mentoring_due' end, 'vars', jsonb_build_object('date', to_char(r.nxt, 'YYYY-MM-DD'))),
                        jsonb_build_object('code', 'cadence_' || r.cadence)),
      case when r.pid is null then 'A colleague' else r.display_name end, case when r.pid is null then 'زميل' else coalesce(nullif(r.display_name_ar, ''), r.display_name) end,
      r.nxt, r.nxt - p_today);
  end if;
  -- conversation: my six-monthly career conversation, due within 30 days or overdue (staff only)
  if pe.kind = 'staff' and pe.status = 'active' then
    v_last := (select max(c.held_on) from kafaa_career_conversations c where c.person_id = p_me and c.status in ('held', 'acknowledged') and c.held_on is not null);
    v_due := (coalesce(v_last, pe.hire_date) + interval '6 months')::date;
    if v_due is not null then
      v_state := case when v_due < p_today then 'overdue' when v_due - p_today <= 30 then 'due_soon' else 'ok' end;
      if v_state <> 'ok' then
        out := out || kafaa_dg_item('conversation:career_conversations:' || p_me, 'conversation', 'career_conversations', p_me, 'Your six-monthly career conversation', 'حوارك المهني نصف السنوي',
          '/my/career/conversations', jsonb_build_array(jsonb_build_object('code', case when v_state = 'overdue' then 'conversation_overdue' else 'conversation_due' end, 'vars', jsonb_build_object('date', to_char(v_due, 'YYYY-MM-DD')))),
          null, null, v_due, v_due - p_today);
      end if;
    end if;
  end if;
  -- refresher: questions due today or earlier, unless paused
  if not exists (select 1 from kafaa_refresh_prefs rp where rp.person_id = p_me and rp.cadence = 'paused') then
    v_n := (select count(*)::int from kafaa_refresh_state rs where rs.person_id = p_me and rs.due_on <= p_today);
    if v_n > 0 then
      out := out || kafaa_dg_item('refresher:refresh_state:' || p_me, 'refresher', 'refresh_state', p_me, v_n || ' refresher ' || case when v_n = 1 then 'question' else 'questions' end || ' due',
        'أسئلة تنشيط مستحقة: ' || v_n, '/my/coach/refresh', jsonb_build_array(jsonb_build_object('code', 'refresher_due', 'vars', jsonb_build_object('n', v_n))), null, null, p_today, 0);
    end if;
  end if;
  return out;
end $$;

-- Mutes (never expiry), per-kind caps, then urgency, days (no date last), kind, score (higher first), id; at most 7 items.
create or replace function kafaa_dg_compose(p_items jsonb, p_muted text[]) returns jsonb language sql immutable set search_path = public as $$
  with x as (
    select e, e->>'kind' as k, (e->>'urgency')::int as u, coalesce((e->>'days')::int, 100000) as dd,
           case e->>'kind' when 'expiry' then 1 when 'approval' then 2 when 'coach' then 3 when 'opportunity' then 4 when 'mentoring' then 5 when 'conversation' then 6 else 7 end as kr,
           coalesce((e->>'score')::float8, 0) as sc, e->>'id' as id
      from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) e
     where e->>'kind' = 'expiry' or not (e->>'kind' = any(coalesce(p_muted, '{}'::text[])))
  ), r as (
    select x.*, row_number() over (partition by k order by u, dd, kr, sc desc, id collate "C") as rn from x
  ), kept as (
    select * from r where rn <= case k when 'expiry' then 3 when 'approval' then 3 when 'opportunity' then 2 else 1 end
     order by u, dd, kr, sc desc, id collate "C" limit 7
  )
  select coalesce(jsonb_agg(e order by u, dd, kr, sc desc, id collate "C"), '[]'::jsonb) from kept
$$;

-- The notification written with a digest (same text as rules.ts digestNotice).
create or replace function kafaa_dg_notice(p_items jsonb, p_freq text) returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object(
    'title_en', format('Your %s digest: %s %s for you', case p_freq when 'monthly' then 'monthly' when 'fortnightly' then 'fortnightly' else 'weekly' end, jsonb_array_length(p_items), case when jsonb_array_length(p_items) = 1 then 'thing' else 'things' end),
    'title_ar', format('ملخصك %s: %s %s تخصك', case p_freq when 'monthly' then 'الشهري' when 'fortnightly' then 'نصف الشهري' else 'الأسبوعي' end, jsonb_array_length(p_items), case when jsonb_array_length(p_items) = 1 then 'أمر' else 'أمور' end),
    'body_en', coalesce((select string_agg(e->>'title_en', ' · ' order by i) from jsonb_array_elements(p_items) with ordinality x(e, i) where i <= 3), ''),
    'body_ar', coalesce((select string_agg(e->>'title_ar', ' · ' order by i) from jsonb_array_elements(p_items) with ordinality x(e, i) where i <= 3), ''),
    'severity', case when exists (select 1 from jsonb_array_elements(p_items) e where e->>'kind' = 'expiry') then 'warn' else 'info' end)
$$;

-- Digest items for a person on a day with their saved mutes (internal; the PGlite parity check and the RPC use it).
create or replace function kafaa_dg_compute(p_me text, p_today date, p_hints jsonb default '{}'::jsonb) returns jsonb language sql stable security definer set search_path = public as $$
  select kafaa_dg_compose(kafaa_dg_gather(p_me, p_today, coalesce(p_hints, '{}'::jsonb)), coalesce((select dp.muted_kinds from kafaa_digest_prefs dp where dp.person_id = p_me), '{}'::text[]))
$$;

-- ───────────── RPC: build my digest for the current period (idempotent per period; audited, no ledger)
create or replace function kafaa_build_digest(p_hints jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; dp kafaa_digest_prefs; v_on boolean; v_freq text; v_qs integer; v_qe integer; v_today date := (now() at time zone 'UTC')::date;
  v_period text; v_id text; cur kafaa_digest_runs; v_items jsonb; v_nid text; v_n jsonb; v_cnt integer; v_now timestamptz := date_trunc('second', now()); a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('digest.build', 'digest_runs', null, 'not_signed_in', 'Sign in to see your digest'); end if;
  v_role := kafaa_acting_role('notifications', array['Own']);
  if v_role is null then return kafaa_refuse('digest.build', 'digest_runs', null, 'forbidden', 'Digests are for signed-in staff'); end if;
  if p_hints is not null and jsonb_typeof(p_hints) not in ('object', 'null') then return kafaa_refuse('digest.build', 'digest_runs', null, 'invalid', 'Unreadable digest hints', v_role); end if;
  if p_hints is not null and jsonb_typeof(p_hints) = 'object' and p_hints ? 'coach' and jsonb_typeof(p_hints->'coach') <> 'null' and not kafaa_dg_hint_ok(p_hints->'coach') then
    return kafaa_refuse('digest.build', 'digest_runs', null, 'invalid', 'The coach suggestion could not be read', v_role);
  end if;
  select * into dp from kafaa_digest_prefs where person_id = me;
  v_on := coalesce(dp.enabled, true); v_freq := coalesce(dp.frequency, 'weekly'); v_qs := dp.quiet_start; v_qe := dp.quiet_end;
  if not v_on then return kafaa_refuse('digest.build', 'digest_runs', null, 'nudges_off', 'Nudges are off: turn them on in your settings to get a digest', v_role); end if;
  v_period := kafaa_dg_period(v_today, v_freq);
  v_id := 'dg:' || me || ':' || v_period;
  select * into cur from kafaa_digest_runs where id = v_id;
  if cur.id is not null then
    a := kafaa_audit('digest.build', 'digest_runs', v_id, 'ok', v_period || ': exists', 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Your digest for this period is ready', a, null,
      jsonb_build_object('run_id', v_id, 'period', v_period, 'created', false, 'items', cur.items, 'notification_id', cur.notification_id));
  end if;
  if kafaa_dg_in_quiet((extract(hour from now() at time zone 'UTC')::int + 4) % 24, v_qs, v_qe) then
    return kafaa_refuse('digest.build', 'digest_runs', null, 'quiet_hours', format('Quiet hours until %s:00: your digest will be ready after that', lpad(v_qe::text, 2, '0')), v_role);
  end if;
  v_items := kafaa_dg_compose(kafaa_dg_gather(me, v_today, case when jsonb_typeof(p_hints) = 'object' then p_hints else '{}'::jsonb end), coalesce(dp.muted_kinds, '{}'::text[]));
  v_cnt := jsonb_array_length(v_items);
  if v_cnt > 0 then
    v_nid := 'nt-dg-' || me || '-' || v_period;
    v_n := kafaa_dg_notice(v_items, v_freq);
    insert into kafaa_notifications (id, person_id, kind, title_en, title_ar, body_en, body_ar, link, severity, created_at, read_at)
    values (v_nid, me, 'digest', v_n->>'title_en', v_n->>'title_ar', v_n->>'body_en', v_n->>'body_ar', '/my#digest', v_n->>'severity', v_now, null)
    on conflict (id) do nothing;
  end if;
  insert into kafaa_digest_runs (id, person_id, period, frequency, as_of, items, item_count, notification_id, coach_hint, built_at)
  values (v_id, me, v_period, v_freq, v_today, v_items, v_cnt, v_nid, exists (select 1 from jsonb_array_elements(v_items) e where e->>'ref_table' = 'coach'), v_now)
  on conflict (id) do nothing;
  a := kafaa_audit('digest.build', 'digest_runs', v_id, 'ok', format('%s: %s items', v_period, v_cnt), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when v_cnt > 0 then format('Your digest is ready: %s items', v_cnt) else 'Nothing needs your attention this period' end, a, null,
    jsonb_build_object('run_id', v_id, 'period', v_period, 'created', true, 'items', v_items, 'notification_id', v_nid));
end $$;

-- ───────────── RPC: my nudge settings (audited, no ledger). Expiry reminders cannot be muted.
create or replace function kafaa_set_digest_prefs(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_id text; v_bad text; v_muted text[]; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('digest.prefs', 'digest_prefs', null, 'not_signed_in', 'Sign in to change your nudge settings'); end if;
  v_id := 'dp:' || me;
  v_role := kafaa_acting_role('notifications', array['Own']);
  if v_role is null then return kafaa_refuse('digest.prefs', 'digest_prefs', v_id, 'forbidden', 'Digests are for signed-in staff'); end if;
  if p is null or jsonb_typeof(p) <> 'object' then return kafaa_refuse('digest.prefs', 'digest_prefs', v_id, 'invalid', 'Say whether nudges are on or off', v_role); end if;
  v_bad := case
    when jsonb_typeof(p->'enabled') is distinct from 'boolean' then 'Say whether nudges are on or off'
    when jsonb_typeof(p->'frequency') is distinct from 'string' or (p->>'frequency') not in ('weekly', 'fortnightly', 'monthly') then 'Choose weekly, fortnightly or monthly'
    when jsonb_typeof(coalesce(p->'quiet_start', 'null'::jsonb)) not in ('number', 'null') or jsonb_typeof(coalesce(p->'quiet_end', 'null'::jsonb)) not in ('number', 'null')
      or (jsonb_typeof(coalesce(p->'quiet_start', 'null'::jsonb)) = 'null') <> (jsonb_typeof(coalesce(p->'quiet_end', 'null'::jsonb)) = 'null')
      or (jsonb_typeof(p->'quiet_start') = 'number' and ((p->>'quiet_start')::numeric <> trunc((p->>'quiet_start')::numeric) or (p->>'quiet_start')::numeric not between 0 and 23))
      or (jsonb_typeof(p->'quiet_end') = 'number' and ((p->>'quiet_end')::numeric <> trunc((p->>'quiet_end')::numeric) or (p->>'quiet_end')::numeric not between 0 and 23))
      then 'Quiet hours run from one whole hour (0 to 23) to another'
    when jsonb_typeof(p->'muted_kinds') is distinct from 'array' or jsonb_array_length(p->'muted_kinds') > 7
      or exists (select 1 from jsonb_array_elements(p->'muted_kinds') e where jsonb_typeof(e) <> 'string' or (e #>> '{}') not in ('expiry', 'approval', 'coach', 'opportunity', 'mentoring', 'conversation', 'refresher'))
      then 'Unknown nudge type'
    when exists (select 1 from jsonb_array_elements(p->'muted_kinds') e where (e #>> '{}') = 'expiry') then 'Expiry reminders cannot be muted: renewing before expiry is a safety requirement'
  end;
  if v_bad is not null then return kafaa_refuse('digest.prefs', 'digest_prefs', v_id, 'invalid', v_bad, v_role); end if;
  v_muted := array(select z.k from (select distinct e.k from jsonb_array_elements_text(p->'muted_kinds') e(k)) z order by z.k collate "C");
  insert into kafaa_digest_prefs (id, person_id, enabled, frequency, quiet_start, quiet_end, muted_kinds, updated_at)
  values (v_id, me, (p->>'enabled')::boolean, p->>'frequency', (p->>'quiet_start')::int, (p->>'quiet_end')::int, v_muted, date_trunc('second', now()))
  on conflict (person_id) do update set enabled = excluded.enabled, frequency = excluded.frequency, quiet_start = excluded.quiet_start, quiet_end = excluded.quiet_end,
    muted_kinds = excluded.muted_kinds, updated_at = excluded.updated_at;
  a := kafaa_audit('digest.prefs', 'digest_prefs', v_id, 'ok',
    format('%s, %s, %s, muted: %s', case when (p->>'enabled')::boolean then 'on' else 'off' end, p->>'frequency',
      case when jsonb_typeof(p->'quiet_start') = 'number' then format('quiet %s-%s', (p->>'quiet_start')::int, (p->>'quiet_end')::int) else 'no quiet hours' end,
      coalesce(nullif(array_to_string(v_muted, ','), ''), 'none')), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when (p->>'enabled')::boolean then 'Nudge settings saved' else 'Nudges are off: no new digests until you turn them back on' end, a, null, jsonb_build_object('id', v_id));
end $$;

-- ───────────── Read RPC: digest aggregates for admins and auditors (open rate per period; every count under 10 suppressed)
create or replace function kafaa_digest_stats() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_latest text; v_periods jsonb; v_kinds jsonb; n_off integer; n_quiet integer; n_muted integer;
begin
  if not (kafaa_has_role('admin') or kafaa_has_role('auditor')) then
    raise exception 'Kafa''a · digest statistics are aggregate-only and for admins and auditors' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('period', s.period, 'delivered', case when s.d < 10 then null else s.d end, 'opened', case when s.d < 10 then null else s.o end,
           'rate', case when s.d < 10 then null else floor(s.o::float8 / s.d::float8 * 10000 + 0.5) / 10000 end, 'suppressed', s.d < 10) order by s.period collate "C" desc), '[]'::jsonb)
    into v_periods
    from (select p.period, (select count(*)::int from kafaa_digest_runs r where r.period = p.period and r.notification_id is not null) d,
                 (select count(*)::int from kafaa_digest_runs r join kafaa_notifications n on n.id = r.notification_id where r.period = p.period and n.read_at is not null) o
            from (select z.period from (select distinct r.period from kafaa_digest_runs r) z order by z.period collate "C" desc limit 8) p) s;
  v_latest := (select max(r.period collate "C") from kafaa_digest_runs r);
  select jsonb_agg(jsonb_build_object('kind', k.kind, 'n', case when k.n < 10 then null else k.n end, 'suppressed', k.n < 10) order by k.ord) into v_kinds
    from (select u.kind, u.ord, (select count(*)::int from kafaa_digest_runs r, jsonb_array_elements(r.items) e where r.period = v_latest and e->>'kind' = u.kind) n
            from unnest(array['expiry', 'approval', 'coach', 'opportunity', 'mentoring', 'conversation', 'refresher']) with ordinality u(kind, ord)) k;
  n_off := (select count(*)::int from kafaa_digest_prefs where not enabled);
  n_quiet := (select count(*)::int from kafaa_digest_prefs where quiet_start is not null and quiet_end is not null and quiet_start <> quiet_end);
  n_muted := (select count(*)::int from kafaa_digest_prefs where cardinality(muted_kinds) > 0);
  return jsonb_build_object('periods', v_periods, 'kinds', v_kinds, 'off', case when n_off < 10 then null else n_off end,
    'quiet', case when n_quiet < 10 then null else n_quiet end, 'muted', case when n_muted < 10 then null else n_muted end);
end $$;

-- ───────────── RPC: Dalil career-mode turn log (F37). Same guards as kafaa_dalil_turn: kill switch, the shared hourly rate limit,
-- concern redaction; signed-in staff with a skills profile only; sessions and turns keep mode 'staff' and set submode 'career'.
create or replace function kafaa_dalil_career_turn(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); s kafaa_dalil_settings; ses kafaa_advisor_sessions; a kafaa_audit_events; v_role text; v_limit integer; v_used integer; v_n integer; r jsonb;
  v_redact boolean := coalesce((p->>'redact_question')::boolean, false) or coalesce(p->>'refusal_category', '') = 'concern';
  v_q text := coalesce(p->>'question', ''); v_now timestamptz := date_trunc('second', now());
begin
  select * into s from kafaa_dalil_settings where id = 'global';
  if s.id is null or not s.enabled then return kafaa_refuse('dalil.career_turn', 'advisor_turns', null, 'disabled', 'Dalil is switched off by the AI owner'); end if;
  if me is null then return kafaa_refuse('dalil.career_turn', 'advisor_turns', null, 'not_signed_in', 'Sign in to use career mode'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  if v_role is null or not kafaa_dalil_mode_allowed('staff') then return kafaa_refuse('dalil.career_turn', 'advisor_turns', null, 'forbidden', 'Career mode is for staff with a skills profile'); end if;
  if length(trim(v_q)) = 0 or length(v_q) > 2000 then return kafaa_refuse('dalil.career_turn', 'advisor_turns', null, 'invalid', 'Questions must be 1 to 2,000 characters', v_role); end if;
  v_limit := s.signed_in_rate_limit_per_hour;
  select count(*) into v_used from kafaa_advisor_turns t join kafaa_advisor_sessions x on x.id = t.session_id
   where t.speaker = 'user' and t.ts >= now() - interval '1 hour' and x.person_id = me;
  if v_used >= v_limit then
    r := kafaa_refuse('dalil.career_turn', 'advisor_turns', null, 'rate_limited', format('You have reached %s questions this hour. Try again later.', v_limit), v_role);
    return r || jsonb_build_object('data', jsonb_build_object('session_id', coalesce(p->>'session_id', ''), 'used', v_used, 'limit', v_limit, 'remaining', 0));
  end if;
  select * into ses from kafaa_advisor_sessions where id = p->>'session_id' and person_id = me and submode = 'career';
  if ses.id is null then
    insert into kafaa_advisor_sessions (id, person_id, mode, submode, started_at, retention_until, client_key, page_context, turns, last_turn_at)
    values ('as-' || replace(gen_random_uuid()::text, '-', ''), me, 'staff', 'career', v_now, current_date + s.retention_days, null, left(p->>'page_context', 200), 0, v_now)
    returning * into ses;
  end if;
  v_n := ses.turns;
  insert into kafaa_advisor_turns (id, session_id, person_id, speaker, text, citations, refused, refusal_category, ts, intent, confidence, redacted, mode, submode)
  values (ses.id || '-' || (v_n + 1), ses.id, me, 'user', case when v_redact then '[withheld: concern; Dalil showed the ECP channels]' else left(v_q, 2000) end,
          '[]'::jsonb, false, null, v_now, p->>'intent', null, v_redact, 'staff', 'career'),
         (ses.id || '-' || (v_n + 2), ses.id, me, 'dalil', left(coalesce(p->>'answer', ''), 4000),
          coalesce((select jsonb_agg(c order by i) from jsonb_array_elements(case when jsonb_typeof(p->'citations') = 'array' then p->'citations' else '[]'::jsonb end) with ordinality x(c, i) where i <= 10), '[]'::jsonb),
          coalesce((p->>'refused')::boolean, false), p->>'refusal_category', v_now, p->>'intent', nullif(p->>'confidence', '')::numeric, false, 'staff', 'career');
  update kafaa_advisor_sessions set turns = v_n + 2, last_turn_at = v_now where id = ses.id;
  a := kafaa_audit('dalil.career_turn', 'advisor_turns', ses.id, 'ok', format('career %s%s', coalesce(p->>'intent', '-'),
        case when coalesce((p->>'refused')::boolean, false) then ' refused:' || coalesce(p->>'refusal_category', '') else '' end), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'ok', a, null, jsonb_build_object('session_id', ses.id, 'used', v_used + 1, 'limit', v_limit, 'remaining', greatest(0, v_limit - v_used - 1)));
end $$;

-- ───────────── Grants: internal helpers are not callable by API roles; RPCs for signed-in users only.
revoke execute on function kafaa_dg_period(date, text), kafaa_dg_in_quiet(integer, integer, integer), kafaa_dg_hint_ok(jsonb), kafaa_dg_role_need(text, text),
  kafaa_dg_match(text[], text[], jsonb, text, text, jsonb), kafaa_dg_item(text, text, text, text, text, text, text, jsonb, text, text, date, integer, double precision),
  kafaa_dg_gather(text, date, jsonb), kafaa_dg_compose(jsonb, text[]), kafaa_dg_notice(jsonb, text), kafaa_dg_compute(text, date, jsonb) from public, anon, authenticated;
revoke execute on function kafaa_build_digest(jsonb), kafaa_set_digest_prefs(jsonb), kafaa_digest_stats(), kafaa_dalil_career_turn(jsonb) from public, anon;
grant execute on function kafaa_build_digest(jsonb), kafaa_set_digest_prefs(jsonb), kafaa_digest_stats(), kafaa_dalil_career_turn(jsonb) to authenticated;
