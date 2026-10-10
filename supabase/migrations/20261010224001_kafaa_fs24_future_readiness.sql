-- [FS wave B · E4 · FS13 + FS14] Future Me readiness that learning can move (rule v2) and Horizon lanes 2.0 (module M21).
--   FS13 * kafaa_fm_readiness_of(person): readiness v2 through the FS04 keyspace. Per ADVANCE skill: carry from today's skills (transfers 2 x
--          level, adapts 1 x level, capped at 3: c6), direct new-capability skills (relation new or an FS02 skill: d3), recorded learning
--          (completed catalogue course = its level 1-2, completed ADVANCE track = 1: l3); credit bp = round(10000 x (54 - (6-c6)(3-d3)(3-l3)) / 54);
--          family index = round(sum bp / 10n) / 10; overall = mean of the families. TS mirror: src/modules/m21/readiness.ts (readinessV2).
--        * kafaa_future_readiness(): the signed-in person's readiness (skills_profile Own). kafaa_record_track_step(): steps through an
--          ADVANCE track (own rows, audited, no ledger); a completed track is learning evidence.
--        * six keyspace rows (new-capability skills for ADVANCE skills that only had today's skills), adv_skills.sk_ids re-synced, and the
--          Future Me engine card (F24) at version 2.
--   FS14 * kafaa_horizon_lanes + kind (build | watch), milestone_ids, as_of; reviewed lanes cite three or more https sources with as-of
--          dates (check kafaa_horizon_lanes_fs14_sources_ck); kafaa_horizon_lane_links and kafaa_horizon_milestones (public reference data);
--          the five F09 lanes get their FS14 sources and milestones; resources are tagged with the new lanes (F26 keeps reading them).
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row. Data statements are
-- guarded (they change a row only while it still has its pre-FS13 value). New lanes, links, milestones, track progress, interest and
-- goals are seed rows (supabase/seed.sql; live: insert ... on conflict do nothing). LocalBackend mirror: src/modules/m21/backend/local.ts.
-- PGlite checks: scripts/validate/fs24-future-readiness.mjs.

-- ───────────── Tables and columns (same DDL as the generated 20261008120100 schema file)
alter table kafaa_horizon_lanes add column if not exists kind text not null default 'build';
alter table kafaa_horizon_lanes add column if not exists milestone_ids text[] not null default '{}'::text[];
alter table kafaa_horizon_lanes add column if not exists as_of date;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_horizon_lanes_kind_check') then alter table kafaa_horizon_lanes add constraint kafaa_horizon_lanes_kind_check check (kind in ('build', 'watch')); end if; end $$;

-- M21 · Horizon lane links: FS02 skills, courses, tracks, pathways, resources and gigs per lane (FS14)
create table if not exists kafaa_horizon_lane_links (
  id text primary key,
  lane_id text not null,
  kind text not null check (kind in ('skill', 'course', 'track', 'pathway', 'resource', 'gig')),
  ref_id text not null,
  level integer,
  sort integer not null default 0
);
comment on table kafaa_horizon_lane_links is '[M21] Horizon lane links: FS02 skills, courses, tracks, pathways, resources and gigs per lane (FS14)';

-- M21 · Dated, sourced milestones the horizon lanes are placed against (FS14; no headcount, no sites)
create table if not exists kafaa_horizon_milestones (
  id text primary key,
  year integer not null,
  month integer,
  kind text not null check (kind in ('enec', 'uae', 'international')),
  title_en text not null,
  title_ar text not null,
  summary_en text not null,
  summary_ar text not null,
  sources jsonb not null default '[]'::jsonb,
  sort integer not null default 0
);
comment on table kafaa_horizon_milestones is '[M21] Dated, sourced milestones the horizon lanes are placed against (FS14; no headcount, no sites)';

-- M21 · My steps through an ADVANCE learning track (own rows; a completed track is level-1 learning evidence) (FS13)
create table if not exists kafaa_future_track_progress (
  id text primary key,
  person_id text not null,
  track_id text not null,
  steps_done jsonb not null default '[]'::jsonb,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);
comment on table kafaa_future_track_progress is '[M21] My steps through an ADVANCE learning track (own rows; a completed track is level-1 learning evidence) (FS13)';

do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_horizon_lane_links_lane_id_fk') then alter table kafaa_horizon_lane_links add constraint kafaa_horizon_lane_links_lane_id_fk foreign key (lane_id) references kafaa_horizon_lanes(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_future_track_progress_person_id_fk') then alter table kafaa_future_track_progress add constraint kafaa_future_track_progress_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_future_track_progress_track_id_fk') then alter table kafaa_future_track_progress add constraint kafaa_future_track_progress_track_id_fk foreign key (track_id) references kafaa_adv_tracks(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_horizon_lane_links_lane_id_idx on kafaa_horizon_lane_links (lane_id);
create index if not exists kafaa_horizon_lane_links_kind_idx on kafaa_horizon_lane_links (kind);
create index if not exists kafaa_horizon_lane_links_ref_id_idx on kafaa_horizon_lane_links (ref_id);
create index if not exists kafaa_future_track_progress_person_id_idx on kafaa_future_track_progress (person_id);
create index if not exists kafaa_future_track_progress_track_id_idx on kafaa_future_track_progress (track_id);

-- FS14 rule (TS laneProblems in src/modules/m21/lanes.ts): a reviewed lane (as_of set) cites three or more distinct sources, each an
-- https link with an as-of date.
create or replace function kafaa_fs14_sources_ok(p jsonb) returns boolean language sql immutable set search_path = public as $$
  select jsonb_typeof(coalesce(p, '[]'::jsonb)) = 'array' and jsonb_array_length(coalesce(p, '[]'::jsonb)) >= 3
    and not exists (select 1 from jsonb_array_elements(coalesce(p, '[]'::jsonb)) e(x) where coalesce(x->>'url', '') !~ '^https://' or coalesce(x->>'as_of', '') !~ '^\d{4}-\d{2}-\d{2}$')
    and (select count(distinct x->>'url') from jsonb_array_elements(coalesce(p, '[]'::jsonb)) e(x)) = jsonb_array_length(coalesce(p, '[]'::jsonb));
$$;

-- ───────────── RLS (per-statement form): links and milestones are public reference data; track progress is the person's own
alter table kafaa_horizon_lane_links enable row level security;
alter table kafaa_horizon_milestones enable row level security;
alter table kafaa_future_track_progress enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_horizon_lane_links' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_horizon_lane_links for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_horizon_milestones' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_horizon_milestones for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_future_track_progress' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_future_track_progress for select to anon, authenticated using (false)'; end if;
end $$;
alter policy kafaa_read on kafaa_horizon_lane_links using ((SELECT kafaa_has_grant('public_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text])));
alter policy kafaa_read on kafaa_horizon_milestones using ((SELECT kafaa_has_grant('public_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text])));
alter policy kafaa_read on kafaa_future_track_progress using (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false)));
-- Reference tables and track progress: read only for API roles (progress changes only through kafaa_record_track_step).
revoke all on kafaa_horizon_lane_links, kafaa_horizon_milestones, kafaa_future_track_progress from anon, authenticated;
grant select on kafaa_horizon_lane_links, kafaa_horizon_milestones, kafaa_future_track_progress to anon, authenticated;

-- ───────────── FS13 readiness v2 for one person (internal; mirror of readinessV2 + inputFor in src/modules/m21/readiness.ts)
create or replace function kafaa_fm_readiness_of(p_person text) returns jsonb language sql stable security definer set search_path = public as $$
  with
  sk as (select s.id, s.area, s.fs_area from kafaa_skills s),
  lv as (
    select ps.skill_id, max(least(greatest(floor(ps.level), 0), 4))::int as level
    from kafaa_person_skills ps join sk on sk.id = ps.skill_id
    where ps.person_id = p_person and coalesce(ps.active, true) and ps.level > 0 and sk.area <> 'security' group by ps.skill_id
  ),
  cc as (
    select e.course_id from kafaa_enrolments e where e.person_id = p_person and e.status = 'completed' and e.course_id is not null
    union select r.course_id from kafaa_training_records r where r.person_id = p_person and r.result in ('passed', 'completed') and r.course_id is not null
  ),
  ct as (select t.track_id from kafaa_future_track_progress t where t.person_id = p_person and t.status = 'completed'),
  mp as (
    select m.key, m.sk_id, m.relation, sk.fs_area from kafaa_future_skill_map m join sk on sk.id = m.sk_id
    where coalesce(m.active, true) and sk.area <> 'security'
  ),
  carry as (select mp.key, mp.sk_id, max(case mp.relation when 'transfers' then 2 else 1 end)::int as f from mp where mp.fs_area is null and mp.relation in ('transfers', 'adapts') group by mp.key, mp.sk_id),
  direct as (select distinct mp.key, mp.sk_id from mp where mp.relation = 'new' or mp.fs_area is not null),
  lopt as (
    select a.id as key, r.id as resource_id,
      case when r.kind = 'course' and r.course_id is not null then r.course_id end as course_id,
      case when r.kind = 'course' and r.course_id is not null then greatest(1, least(2, coalesce(r.level, 1))) end::int as course_level,
      r.track_id
    from kafaa_adv_skills a join kafaa_future_resources r on a.id = any(r.adv_skill_ids)
    where (r.kind = 'course' and r.course_id is not null) or r.track_id is not null
  ),
  it0 as (
    select a.id, a.tech_id, a.relation, coalesce(a.sort, 0) as sort,
      coalesce((select max(3 * c.f) from carry c where c.key = a.id), 0)::int as c6max,
      coalesce((select max(greatest(coalesce(o.course_level, 0), case when o.track_id is not null then 1 else 0 end)) from lopt o where o.key = a.id), 0)::int as l3max,
      (select jsonb_build_object('c', c.f * least(l.level, 3), 'l', l.level, 'via', c.sk_id) from carry c join lv l on l.skill_id = c.sk_id
        where c.key = a.id order by c.f * least(l.level, 3) desc, c.sk_id collate "C" limit 1) as cb,
      (select jsonb_build_object('l', l.level, 'via', d.sk_id) from direct d join lv l on l.skill_id = d.sk_id
        where d.key = a.id order by l.level desc, d.sk_id collate "C" limit 1) as db,
      (select jsonb_build_object('l', x.lvl, 'via', x.resource_id) from (
          select o.resource_id, greatest(
            case when o.course_id is not null and o.course_id in (select cc.course_id from cc) then o.course_level else 0 end,
            case when o.track_id is not null and o.track_id in (select ct.track_id from ct) then 1 else 0 end) as lvl
          from lopt o where o.key = a.id) x
        where x.lvl > 0 order by x.lvl desc, x.resource_id collate "C" limit 1) as lb,
      coalesce((select jsonb_agg(jsonb_build_object('sk_id', c.sk_id, 'f', c.f) order by c.sk_id collate "C") from carry c where c.key = a.id), '[]'::jsonb) as carry_opts,
      coalesce((select jsonb_agg(d.sk_id order by d.sk_id collate "C") from direct d where d.key = a.id), '[]'::jsonb) as direct_opts,
      coalesce((select jsonb_agg(jsonb_build_object('resource_id', o.resource_id, 'course_id', o.course_id, 'course_level', o.course_level, 'track_id', o.track_id) order by o.resource_id collate "C") from lopt o where o.key = a.id), '[]'::jsonb) as learn_opts
    from kafaa_adv_skills a
  ),
  it1 as (
    select it0.*, coalesce((cb->>'c')::int, 0) as c6, coalesce((cb->>'l')::int, 0) as carry_level, cb->>'via' as carry_via,
      least(coalesce((db->>'l')::int, 0), 3) as d3, coalesce((db->>'l')::int, 0) as direct_level, db->>'via' as direct_via,
      least(coalesce((lb->>'l')::int, 0), 3) as l3, coalesce((lb->>'l')::int, 0) as learn_level, lb->>'via' as learn_via
    from it0
  ),
  it as (
    select it1.*,
      round(10000.0 * (54 - (6 - c6) * (3 - d3) * (3 - l3)) / 54)::int as bp,
      round(10000.0 * (54 - (6 - c6max) * 3 * 3) / 54)::int as bp_carry,
      round(10000.0 * (54 - (6 - c6max) * 3 * (3 - least(l3max, 3))) / 54)::int as bp_learn
    from it1
  ),
  fam as (
    select t.id as tech_id, coalesce(t.sort, 0) as sort, count(i.id)::int as n,
      case when count(i.id) = 0 then 0 else round(sum(i.bp)::numeric / (10 * count(i.id))) end::int as i10,
      case when count(i.id) = 0 then 0 else round(sum(i.bp_carry)::numeric / (10 * count(i.id))) end::int as c10,
      case when count(i.id) = 0 then 0 else round(sum(i.bp_learn)::numeric / (10 * count(i.id))) end::int as l10,
      coalesce(jsonb_agg(jsonb_build_object(
        'adv_skill_id', i.id, 'relation', i.relation,
        'c6', i.c6, 'carry_level', i.carry_level, 'carry_via', i.carry_via,
        'd3', i.d3, 'direct_level', i.direct_level, 'direct_via', i.direct_via,
        'l3', i.l3, 'learn_level', i.learn_level, 'learn_via', i.learn_via,
        'bp', i.bp, 'c6max', i.c6max, 'l3max', i.l3max,
        'carry_opts', i.carry_opts, 'direct_opts', i.direct_opts, 'learn_opts', i.learn_opts) order by i.sort, i.id collate "C") filter (where i.id is not null), '[]'::jsonb) as items
    from kafaa_adv_technologies t left join it i on i.tech_id = t.id
    group by t.id, t.sort
  )
  select jsonb_build_object(
    'version', 2,
    'overall', coalesce((select round(round(sum(f.i10)::numeric / count(*)) / 10, 1) from fam f), 0),
    'carry_ceiling', coalesce((select round(round(sum(f.c10)::numeric / count(*)) / 10, 1) from fam f), 0),
    'learn_ceiling', coalesce((select round(round(sum(f.l10)::numeric / count(*)) / 10, 1) from fam f), 0),
    'completed_courses', coalesce((select jsonb_agg(x.course_id order by x.course_id collate "C") from (select distinct cc.course_id from cc) x), '[]'::jsonb),
    'completed_tracks', coalesce((select jsonb_agg(x.track_id order by x.track_id collate "C") from (select distinct ct.track_id from ct) x), '[]'::jsonb),
    'families', coalesce((select jsonb_agg(jsonb_build_object('tech_id', f.tech_id, 'n', f.n, 'index', round(f.i10 / 10.0, 1), 'carry_ceiling', round(f.c10 / 10.0, 1),
      'learn_ceiling', round(f.l10 / 10.0, 1), 'items', f.items) order by f.sort, f.tech_id collate "C") from fam f), '[]'::jsonb));
$$;

-- ───────────── RPC (read): my readiness v2. Staff with a skills profile only.
create or replace function kafaa_future_readiness() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me();
begin
  if me is null or not kafaa_has_grant('skills_profile', array['Own']) then
    raise exception 'Kafa''a · Future Me readiness is for staff with a skills profile' using errcode = '42501';
  end if;
  return jsonb_build_object('person_id', me) || kafaa_fm_readiness_of(me);
end $$;

-- ───────────── RPC: one step of an ADVANCE learning track done (or undone). Own rows; audited, no ledger.
create or replace function kafaa_record_track_step(p_track text, p_step integer, p_done boolean default true) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; a kafaa_audit_events; v_entity text := coalesce(p_track, '') || ':' || coalesce(p_step::text, '');
  v_total integer; v_id text; v_cur kafaa_future_track_progress; v_before integer[]; v_steps integer[]; v_complete boolean; v_at timestamptz; v_ts timestamptz := now(); v_status text;
begin
  if me is null then return kafaa_refuse('future.track', 'future_track_progress', v_entity, 'not_signed_in', 'Sign in to record your learning'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  if v_role is null then return kafaa_refuse('future.track', 'future_track_progress', v_entity, 'forbidden', 'ADVANCE tracks count for staff with a skills profile'); end if;
  select case when jsonb_typeof(t.modules) = 'array' then jsonb_array_length(t.modules) else 0 end into v_total from kafaa_adv_tracks t where t.id = p_track;
  if v_total is null then return kafaa_refuse('future.track', 'future_track_progress', v_entity, 'not_found', 'Unknown learning track', v_role); end if;
  if p_step is null or p_step < 0 or p_step >= v_total then return kafaa_refuse('future.track', 'future_track_progress', v_entity, 'invalid', 'That step is not part of this track', v_role); end if;
  v_id := 'ftp:' || me || ':' || p_track;
  select * into v_cur from kafaa_future_track_progress where id = v_id;
  v_before := coalesce((select array_agg(distinct (x #>> '{}')::numeric::integer) from jsonb_array_elements(coalesce(v_cur.steps_done, '[]'::jsonb)) e(x)
    where jsonb_typeof(x) = 'number' and (x #>> '{}')::numeric = trunc((x #>> '{}')::numeric) and (x #>> '{}')::numeric >= 0 and (x #>> '{}')::numeric < v_total), '{}'::integer[]);
  if p_done is false then v_steps := array_remove(v_before, p_step);
  else v_steps := (select array_agg(distinct s order by s) from unnest(v_before || p_step) s); end if;
  v_steps := coalesce((select array_agg(s order by s) from unnest(v_steps) s), '{}'::integer[]);
  v_complete := cardinality(v_steps) = v_total;
  v_status := case when v_complete then 'completed' else 'in_progress' end;
  v_at := case when v_complete then (case when v_cur.status = 'completed' and v_cur.completed_at is not null then v_cur.completed_at else v_ts end) end;
  insert into kafaa_future_track_progress (id, person_id, track_id, steps_done, status, started_at, completed_at, updated_at)
  values (v_id, me, p_track, to_jsonb(v_steps), v_status, v_ts, v_at, v_ts)
  on conflict (id) do update set steps_done = excluded.steps_done, status = excluded.status, completed_at = excluded.completed_at, updated_at = excluded.updated_at;
  a := kafaa_audit('future.track', 'future_track_progress', v_id, 'ok', format('%s step %s %s (%s/%s)', p_track, p_step + 1, case when p_done is false then 'undone' else 'done' end, cardinality(v_steps), v_total), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when v_complete then 'Track completed: it now counts as learning evidence' else 'Progress saved' end, a, null,
    jsonb_build_object('id', v_id, 'track_id', p_track, 'status', v_status, 'steps_done', to_jsonb(v_steps), 'steps', v_total, 'completed_at', v_at));
end $$;

revoke execute on function kafaa_fm_readiness_of(text) from public, anon, authenticated;
revoke execute on function kafaa_future_readiness(), kafaa_record_track_step(text, integer, boolean) from public, anon;
grant execute on function kafaa_future_readiness(), kafaa_record_track_step(text, integer, boolean) to authenticated;

-- ───────────── FS13 data: keyspace rows for the new-capability skills (FS13_KEYSPACE_ROWS in src/modules/m21/fs13data.ts)
insert into kafaa_future_skill_map (id, key, key_kind, sk_id, relation, need_level, primary_sk, active, note_en, note_ar, sort, updated_by, updated_at)
select v.id, v.key, 'adv_skill', v.sk, 'new', v.need, false, true, v.en, v.ar, v.sort, null, '2026-10-10T00:00:00Z'::timestamptz
from (values
  ('fsm:as-bwr-systems:sk-fs-adv-smr', 'as-bwr-systems', 'sk-fs-adv-smr', 2, 2, 'SMR fundamentals: the boiling-water SMR systems themselves (FS02).', 'أساسيات المفاعلات الصغيرة: أنظمة مفاعل الماء المغلي الصغير نفسها (من الكتالوج).'),
  ('fsm:as-bwr-chemistry:sk-fs-adv-smr', 'as-bwr-chemistry', 'sk-fs-adv-smr', 2, 2, 'SMR fundamentals include the boiling-water chemistry regime (FS02).', 'تشمل أساسيات المفاعلات الصغيرة نظام كيمياء الماء المغلي (من الكتالوج).'),
  ('fsm:as-owners-engineer:sk-fs-adv-factoryqa', 'as-owners-engineer', 'sk-fs-adv-factoryqa', 2, 2, 'Factory fabrication QA: overseeing modules built in a vendor factory (FS02).', 'ضمان جودة التصنيع في المصنع: الإشراف على الوحدات المصنّعة لدى المورّد (من الكتالوج).'),
  ('fsm:as-project-abroad:sk-fs-tr-crosscultural', 'as-project-abroad', 'sk-fs-tr-crosscultural', 2, 2, 'Collaboration across cultures: delivering projects with partners abroad (FS02).', 'التعاون بين الثقافات: تنفيذ المشاريع مع الشركاء في الخارج (من الكتالوج).'),
  ('fsm:as-process-heat:sk-fs-gr-h2heat', 'as-process-heat', 'sk-fs-gr-h2heat', 2, 2, 'Hydrogen and process-heat interfaces (FS02).', 'واجهات الهيدروجين وحرارة العمليات (من الكتالوج).'),
  ('fsm:as-remote-ops:sk-fs-adv-multimodule', 'as-remote-ops', 'sk-fs-adv-multimodule', 1, 2, 'Multi-module operations concepts (FS02).', 'مفاهيم تشغيل الوحدات المتعددة (من الكتالوج).')
) v(id, key, sk, need, sort, en, ar)
where exists (select 1 from kafaa_skills s where s.id = v.sk) and exists (select 1 from kafaa_adv_skills x where x.id = v.key)
on conflict (id) do nothing;
select kafaa_fk_sync(k) from unnest(array['as-bwr-systems', 'as-bwr-chemistry', 'as-owners-engineer', 'as-project-abroad', 'as-process-heat', 'as-remote-ops']::text[]) k
  where exists (select 1 from kafaa_adv_skills a where a.id = k and a.sk_ids is distinct from coalesce((select array_agg(r.sk_id order by r.primary_sk desc, r.sort, r.sk_id collate "C") from kafaa_fk_rows(k) r), '{}'));

-- ───────────── FS13 data: the Future Me engine card (F24) at version 2 (FS13_CARD)
update kafaa_engine_cards set version = 2, last_changed_at = '2026-10-10T00:00:00Z'::timestamptz,
  purpose_en = 'Estimates my readiness for ADVANCE-era technologies from what carries over, the new skills I hold and the learning I have recorded, and ranks the bridges, learning and roles that would help most.', purpose_ar = 'يقدّر جاهزيتي لتقنيات عصر ADVANCE مما ينتقل من مهاراتي الحالية والمهارات الجديدة التي أمتلكها والتعلّم الذي سجّلته، ويرتّب الجسور والتعلّم والأدوار الأكثر فائدة.',
  inputs_used = '[{"key":"person_skills","en":"My skill levels and how each is evidenced (qualifications, courses, assessments, validated check-ins)","ar":"مستويات مهاراتي وكيف ثبتت كل مهارة (المؤهلات والدورات والتقييمات وتقييمات المهارات المعتمدة)"},{"key":"future_skill_map","en":"The future-skill keyspace (FS04): which of today''s skills carry over to each ADVANCE skill and which new skills count directly","ar":"خريطة المهارات المستقبلية (FS04): أي مهارات اليوم تنتقل إلى كل مهارة من مهارات ADVANCE وأي المهارات الجديدة تُحتسب مباشرة"},{"key":"learning","en":"Learning I have completed: catalogue courses (level 1-2) and ADVANCE learning tracks (level 1)","ar":"التعلّم الذي أكملته: دورات الكتالوج (المستوى 1-2) ومسارات تعلّم ADVANCE (المستوى 1)"},{"key":"adv_skills","en":"ADVANCE-era skills and bridges from today''s skills (public sources)","ar":"مهارات عصر ADVANCE والجسور من مهارات اليوم (مصادر عامة)"},{"key":"career_paths","en":"Published career paths and entry routes, with their conditions (FANR-REG-17 for licensed roles)","ar":"المسارات المهنية المنشورة وطرق الالتحاق وشروطها (FANR-REG-17 للأدوار المرخّصة)"}]'::jsonb,
  scoring_functions = array['src/modules/m21/readiness.ts#readinessV2', 'src/modules/m21/readiness.ts#previewEvidence', 'src/modules/m21/future.ts#rankBridges', 'src/modules/m21/future.ts#rankFutureRoles', 'src/modules/m21/future.ts#rankResources', 'sql:kafaa_fm_readiness_of']::text[],
  limitations_en = 'Readiness rule v2 (FS13): learning raises the index, and 100 is reachable through recorded evidence alone. The index is SIMULATED and is not a qualification. Future roles are concepts from public sources, with no headcount or sites.', limitations_ar = 'قاعدة الجاهزية الإصدار 2 (FS13): يرفع التعلّم المؤشر، ويمكن بلوغ 100 من خلال الأدلة المسجّلة وحدها. المؤشر محاكاة وليس مؤهلاً. الأدوار المستقبلية مفاهيم من مصادر عامة، دون أعداد موظفين أو مواقع.'
  where id = 'future' and version < 2;

-- ───────────── FS14 data: the five F09 lanes reviewed (sources, milestones, as-of), only while they are still unreviewed
update kafaa_horizon_lanes set title_en = 'Digital I&C and plant data', title_ar = 'أجهزة القياس والتحكم الرقمية وبيانات المحطة', summary_en = 'Maintaining the APR-1400 digital platform, trending plant data and working with digital models of systems.', summary_ar = 'صيانة منصة APR-1400 الرقمية، وتحليل اتجاهات بيانات المحطة، والعمل مع النماذج الرقمية للأنظمة.',
  why_en = 'Barakah runs on digital instrumentation and control. ENEC is building data and AI platforms with partners, and the WEF expects technology skills to grow fastest to 2030 (per source).', why_ar = 'تعمل براكة بأجهزة قياس وتحكم رقمية. وتبني المؤسسة منصات بيانات وذكاء اصطناعي مع شركائها، ويتوقع المنتدى الاقتصادي العالمي أن تكون المهارات التقنية الأسرع نمواً حتى 2030 (وفق المصدر).',
  sources = '[{"id":"enec-presight","label":"ENEC · ENECIQ with Presight (Oct 2025)","url":"https://www.enec.ae/en/news/latest-news/enec-and-presight-co-develop-eneciq-ai-platform-to-boost-efficiency-and-knowledge-sharing/","as_of":"2026-10-08"},{"id":"wnn-kepco-2025","label":"WNN · KEPCO and ENEC enhance cooperation (Nov 2025)","url":"https://www.world-nuclear-news.org/articles/kepco-and-enec-enhance-cooperation-in-nuclear-energy","as_of":"2026-10-08"},{"id":"wef-foj-2025","label":"WEF · Future of Jobs Report 2025 (press release, Jan 2025)","url":"https://www.weforum.org/press/2025/01/future-of-jobs-report-2025-78-million-new-job-opportunities-by-2030-but-urgent-upskilling-needed-to-prepare-workforces/","as_of":"2026-10-08"}]'::jsonb,
  kind = 'build', milestone_ids = array['ms-full-fleet', 'ms-eneciq']::text[], as_of = '2026-10-10'::date
  where id = 'lane-digital' and as_of is null;
update kafaa_horizon_lanes set title_en = 'Cyber hygiene for everyone', title_ar = 'النظافة السيبرانية للجميع', summary_en = 'Everyday habits that protect plant and business systems: careful handling of media, accounts and messages, and stopping when something looks wrong.', summary_ar = 'عادات يومية تحمي أنظمة المحطة والأعمال: التعامل الحذر مع الوسائط والحسابات والرسائل، والتوقف عند الشك.',
  why_en = 'Networks and cybersecurity are among the fastest-growing skills in the WEF Future of Jobs Report 2025. Cyber and security roles are shown here as a career path only.', why_ar = 'الشبكات والأمن السيبراني من أسرع المهارات نمواً في تقرير مستقبل الوظائف 2025 للمنتدى الاقتصادي العالمي. وتظهر أدوار الأمن السيبراني والأمن هنا مساراً مهنياً فقط.',
  sources = '[{"id":"wef-foj-2025","label":"WEF · Future of Jobs Report 2025 (press release, Jan 2025)","url":"https://www.weforum.org/press/2025/01/future-of-jobs-report-2025-78-million-new-job-opportunities-by-2030-but-urgent-upskilling-needed-to-prepare-workforces/","as_of":"2026-10-08"},{"id":"iaea-nss42g","label":"IAEA · Computer security techniques for nuclear facilities, NSS 42-G (2021)","url":"https://www.iaea.org/node/97473","as_of":"2026-10-10"},{"id":"nice-ot","label":"NIST / CISA · NICE Framework v2.0: OT cybersecurity engineering work role","url":"https://niccs.cisa.gov/tools/nice-framework/work-role/operational-technology-ot-cybersecurity-engineering","as_of":"2026-10-10"}]'::jsonb,
  kind = 'build', milestone_ids = array['ms-full-fleet']::text[], as_of = '2026-10-10'::date
  where id = 'lane-cyber' and as_of is null;
update kafaa_horizon_lanes set title_en = 'AI-assisted operations, governed', title_ar = 'العمليات المدعومة بالذكاء الاصطناعي ضمن الحوكمة', summary_en = 'Using AI tools for search, summaries and trend spotting while people keep every safety decision, check the outputs and record what they relied on.', summary_ar = 'استخدام أدوات الذكاء الاصطناعي في البحث والتلخيص ورصد الاتجاهات، مع بقاء كل قرار سلامة بيد الإنسان، والتحقق من المخرجات وتوثيق ما اعتُمد عليه.',
  why_en = 'ENEC and Presight are co-developing the ENECIQ AI platform for efficiency and knowledge sharing. Governed use needs staff who can question AI outputs and apply conservative decision-making.', why_ar = 'تطوّر المؤسسة وبرسايت منصة ENECIQ للذكاء الاصطناعي لتعزيز الكفاءة وتبادل المعرفة. ويتطلب الاستخدام المحكوم موظفين قادرين على مساءلة مخرجات الذكاء الاصطناعي واتخاذ قرارات متحفظة.',
  sources = '[{"id":"enec-presight","label":"ENEC · ENECIQ with Presight (Oct 2025)","url":"https://www.enec.ae/en/news/latest-news/enec-and-presight-co-develop-eneciq-ai-platform-to-boost-efficiency-and-knowledge-sharing/","as_of":"2026-10-08"},{"id":"wef-foj-2025","label":"WEF · Future of Jobs Report 2025 (press release, Jan 2025)","url":"https://www.weforum.org/press/2025/01/future-of-jobs-report-2025-78-million-new-job-opportunities-by-2030-but-urgent-upskilling-needed-to-prepare-workforces/","as_of":"2026-10-08"},{"id":"iaea-ai-bulletin","label":"IAEA Bulletin · Enhancing nuclear power production with artificial intelligence","url":"https://iaea.org/bulletin/enhancing-nuclear-power-production-with-artificial-intelligence","as_of":"2026-10-10"},{"id":"nei-iaea-ai","label":"NEI Magazine · IAEA hosts first AI and nuclear energy symposium (Dec 2025)","url":"https://www.neimagazine.com/news/iaea-hosts-first-ai-nuclear-symposium/","as_of":"2026-10-10"}]'::jsonb,
  kind = 'build', milestone_ids = array['ms-eneciq', 'ms-iaea-ai', 'ms-uae-ai']::text[], as_of = '2026-10-10'::date
  where id = 'lane-ai' and as_of is null;
update kafaa_horizon_lanes set title_en = 'Advanced reactor fundamentals', title_ar = 'أساسيات المفاعلات المتقدمة', summary_en = 'Passive safety, new coolants and fuel forms, remote operation concepts and licensing a new design.', summary_ar = 'السلامة الخاملة، والمبردات وأشكال الوقود الجديدة، ومفاهيم التشغيل عن بعد، وترخيص تصميم جديد.',
  why_en = 'Through ADVANCE, ENEC is evaluating SMRs and microreactors under several MoUs, and the NEA notes that new designs need new skills across the value chain. ENEC is evaluating these technologies; no deployment decision is implied.', why_ar = 'تقيّم المؤسسة عبر برنامج ADVANCE المفاعلات الصغيرة والمتناهية الصغر بموجب عدة مذكرات تفاهم، وتشير وكالة الطاقة النووية إلى أن التصاميم الجديدة تتطلب مهارات جديدة عبر سلسلة القيمة. تقيّم المؤسسة هذه التقنيات ولا يعني ذلك أي قرار بالنشر.',
  sources = '[{"id":"wnn-advance","label":"WNN · ENEC to evaluate deployment of SMRs and microreactors (ADVANCE)","url":"https://world-nuclear-news.org/articles/enec-to-evaluate-deployment-of-smrs-and-microreact","as_of":"2026-10-08"},{"id":"wnn-smr-mous","label":"WNN · ENEC signs multiple SMR MoUs (COP28)","url":"https://world-nuclear-news.org/articles/enec-signs-multiple-smr-mous","as_of":"2026-10-08"},{"id":"nea-nest","label":"OECD NEA · Building the vital skills for the future of nuclear energy (NEST)","url":"https://www.oecd-nea.org/jcms/pl_56329/building-the-vital-skills-for-the-future-of-nuclear-energy","as_of":"2026-10-08"},{"id":"ans-canada-smr","label":"ANS · Education and training to support Canadian nuclear workforce development (Nov 2025)","url":"https://www.ans.org/news/2025-11-26/article-7471/education-and-training-to-support-canadian-nuclear-workforce-development/","as_of":"2026-10-10"}]'::jsonb,
  kind = 'build', milestone_ids = array['ms-cop28-smr', 'ms-gevh', 'ms-src', 'ms-strategy']::text[], as_of = '2026-10-10'::date
  where id = 'lane-advanced' and as_of is null;
update kafaa_horizon_lanes set title_en = 'Net zero and low-carbon industry', title_ar = 'الحياد المناخي والصناعة منخفضة الكربون', summary_en = 'How clean electricity supports decarbonisation: lifecycle carbon, greenhouse-gas accounting and project controls with industrial partners.', summary_ar = 'كيف تدعم الكهرباء النظيفة إزالة الكربون: الكربون عبر دورة الحياة، ومحاسبة غازات الدفيئة، وضبط المشاريع مع الشركاء الصناعيين.',
  why_en = 'Clean electricity from Barakah already supports industrial decarbonisation such as low-carbon aluminium, and ENEC reports its climate and sustainability goals publicly (per source). Hydrogen and industrial heat now have their own lane.', why_ar = 'تدعم الكهرباء النظيفة من براكة بالفعل إزالة الكربون في الصناعة مثل الألمنيوم منخفض الكربون، وتنشر المؤسسة أهدافها المناخية وأهداف الاستدامة علناً (وفق المصدر). وأصبح للهيدروجين والحرارة الصناعية مسار مستقل.',
  sources = '[{"id":"enec-climate","label":"ENEC · Climate change","url":"https://www.enec.ae/about-us/overview/climate-change/","as_of":"2026-10-08"},{"id":"enec-adnoc","label":"ENEC · ADNOC strategic collaboration (Nov 2024)","url":"https://www.enec.ae/en/news/latest-news/enec-and-adnoc-to-explore-the-use-of-advanced-nuclear-technologies-and-excess-heat-utilization-for-oil-and-gas-operations/","as_of":"2026-10-08"},{"id":"wnn-ega","label":"WNN · UAE collaboration delivers first low-carbon aluminium","url":"https://world-nuclear-news.org/articles/uae-collaboration-delivers-first-low-carbon-aluminium","as_of":"2026-10-08"},{"id":"enec-samsung","label":"ENEC · Samsung C&T MoU (Jul 2025)","url":"https://www.enec.ae/en/news/latest-news/enec-and-samsung-candt-sign-mou-to-advance-global-nuclear-energy-collaboration/","as_of":"2026-10-08"}]'::jsonb,
  kind = 'build', milestone_ids = array['ms-adnoc-heat', 'ms-strategy']::text[], as_of = '2026-10-10'::date
  where id = 'lane-netzero' and as_of is null;

-- FS14 data: learning resources tagged with the new lanes
update kafaa_future_resources set lane_ids = array['lane-advanced', 'lane-fusion']::text[] where id = 'fr-c-adv-intro' and not (lane_ids @> array['lane-advanced', 'lane-fusion']::text[]);
update kafaa_future_resources set lane_ids = array['lane-advanced', 'lane-ai', 'lane-manufacturing']::text[] where id = 'fr-c-adv-smr' and not (lane_ids @> array['lane-advanced', 'lane-ai', 'lane-manufacturing']::text[]);
update kafaa_future_resources set lane_ids = array['lane-ai', 'lane-ai-maint']::text[] where id = 'fr-c-ai-gov' and not (lane_ids @> array['lane-ai', 'lane-ai-maint']::text[]);
update kafaa_future_resources set lane_ids = array['lane-digital', 'lane-ai-maint', 'lane-robotics']::text[] where id = 'fr-c-mnt-ic' and not (lane_ids @> array['lane-digital', 'lane-ai-maint', 'lane-robotics']::text[]);
update kafaa_future_resources set lane_ids = array['lane-hydrogen', 'lane-grid', 'lane-manufacturing']::text[] where id = 'fr-c-eng-cont' and not (lane_ids @> array['lane-hydrogen', 'lane-grid', 'lane-manufacturing']::text[]);
update kafaa_future_resources set lane_ids = array['lane-advanced', 'lane-manufacturing']::text[] where id = 'fr-trk-materials' and not (lane_ids @> array['lane-advanced', 'lane-manufacturing']::text[]);
update kafaa_future_resources set lane_ids = array['lane-digital', 'lane-ai', 'lane-robotics', 'lane-ai-maint']::text[] where id = 'fr-trk-digital' and not (lane_ids @> array['lane-digital', 'lane-ai', 'lane-robotics', 'lane-ai-maint']::text[]);
update kafaa_future_resources set lane_ids = array['lane-digital', 'lane-netzero', 'lane-robotics']::text[] where id = 'fr-nitss' and not (lane_ids @> array['lane-digital', 'lane-netzero', 'lane-robotics']::text[]);
update kafaa_future_resources set lane_ids = array['lane-advanced', 'lane-ai', 'lane-robotics']::text[] where id = 'fr-src-giems' and not (lane_ids @> array['lane-advanced', 'lane-ai', 'lane-robotics']::text[]);
update kafaa_future_resources set lane_ids = array['lane-manufacturing']::text[] where id = 'fr-read-gevh' and not (lane_ids @> array['lane-manufacturing']::text[]);
update kafaa_future_resources set lane_ids = array['lane-netzero', 'lane-hydrogen']::text[] where id = 'fr-read-adnoc' and not (lane_ids @> array['lane-netzero', 'lane-hydrogen']::text[]);
update kafaa_future_resources set lane_ids = array['lane-advanced', 'lane-fusion']::text[] where id = 'fr-read-nea' and not (lane_ids @> array['lane-advanced', 'lane-fusion']::text[]);

-- The FS14 source rule, once every existing lane is reviewed (unreviewed rows, as_of null, are left alone)
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_horizon_lanes_fs14_sources_ck') then
  alter table kafaa_horizon_lanes add constraint kafaa_horizon_lanes_fs14_sources_ck check (as_of is null or kafaa_fs14_sources_ok(sources)); end if; end $$;
