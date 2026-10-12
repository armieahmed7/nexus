-- [FS wave H · E3 · fsHe3 · FS75] Future-skills nudges in the weekly digest (shell digest, src/shell/digest/).
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
--  1. kafaa_digest_nudge_rules: the published method of the nudges (one public reference row per topic), seeded with on conflict do nothing.
--  2. kafaa_dg_future (new, internal): the FS75 rules (mirror of src/shell/digest/future.ts): kind 'future' (fast-decay lapse, FS33 goal,
--     FS36 AI-literacy requirement, FS05 role 2030 profile change, FS70 rising skill (data-only coupling: kafaa_skill_signals is read only
--     when it exists, through to_jsonb, so this file applies before or after FS70), FS27 gig, FS17 pathway) and one approval source (FS67
--     fellowship milestones waiting for the named supervisor). Nothing before 2026-10-12 (FS75_FROM): seeded digests stay unchanged.
--  3. Shared redefinitions, each copied from its newest body and extended:
--     kafaa_dg_gather   newest body = 20261010269001_kafaa_fs6qa_integration.sql (fs5qa + FS59 role-play reviews; it carries every earlier
--                       rule incl. the wave-B concept-role exclusion) + one line appending kafaa_dg_future.
--     kafaa_dg_compose  20261009155001 body + kind 'future' (rank 8 after refresher, cap 2); still 7 items at most.
--     kafaa_set_digest_prefs, kafaa_digest_stats  20261009155001 bodies + 'future' in the kind lists (8 kinds; expiry still cannot be muted).
-- LocalBackend mirror: src/shell/digest/backend/local.ts (unchanged RPC code; rules in rules.ts + future.ts). PGlite: scripts/validate/fs83-digest-nudges.mjs.

-- ───────────── 1. Table (generated DDL) + RLS (per-statement form): public reference rows, no client writes
-- M14 · Published method of the future-skills digest nudges: trigger, window, link, source feature and benchmarks per topic (FS75)
create table if not exists kafaa_digest_nudge_rules (
  id text primary key,
  topic text not null unique check (topic in ('decay', 'goal', 'ai_literacy', 'role_profile', 'rising_skill', 'future_gig', 'pathway', 'fellowship')),
  kind text not null check (kind in ('future', 'approval')),
  name_en text not null,
  name_ar text not null,
  rule_en text not null,
  rule_ar text not null,
  window_days integer,
  link text not null,
  source_feature text not null,
  benchmark_ids text[] not null default '{}'::text[],
  since date not null,
  sort integer not null default 0
);
comment on table kafaa_digest_nudge_rules is '[M14] Published method of the future-skills digest nudges: trigger, window, link, source feature and benchmarks per topic (FS75)';
alter table kafaa_digest_nudge_rules enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_digest_nudge_rules' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_digest_nudge_rules for select to anon, authenticated using (false)'; end if;
end $$;
alter policy kafaa_read on kafaa_digest_nudge_rules using ((SELECT kafaa_has_grant('public_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text])));
revoke all on kafaa_digest_nudge_rules from anon, authenticated;
grant select on kafaa_digest_nudge_rules to anon, authenticated;

-- Rows: the 8 seeded method rows load with the wave seed (insert ... on conflict (id) do nothing), like every wave table.

-- ───────────── 2. FS75 rules (internal; mirror of src/shell/digest/future.ts gatherFs75Approvals + gatherFuture)
-- Everything FS75 adds applies from 2026-10-12 (FS75_FROM, ISO week 2026-W42): earlier days return no item, so the seeded digests
-- (2026-W38..W41) and every earlier parity check stay unchanged. p_out = the items already gathered (a gig already listed as an
-- opportunity match is not repeated). At most one item per topic; kafaa_dg_compose keeps at most 2 'future' items.
create or replace function kafaa_dg_future(p_me text, p_today date, p_out jsonb) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  pe kafaa_people; out jsonb := '[]'::jsonb; r record; v_lv jsonb; v_prof kafaa_role_profile_versions; v_fs jsonb := '{}'::jsonb; v_res jsonb; v_met text[];
  v_gaps integer; v_v integer; v_at date; v_sig jsonb := '[]'::jsonb; v_reqd text[]; v_first text;
begin
  if p_today < date '2026-10-12' then return out; end if;
  select * into pe from kafaa_people where id = p_me;
  if pe.id is null then return out; end if;
  -- approvals (FS67): fellowship milestones submitted to me as the named supervisor, waiting for my sign-off
  for r in select m.id, m.fellowship_id, m.submitted_at, p.id as pid, p.display_name, p.display_name_ar from kafaa_fellowship_milestones m left join kafaa_people p on p.id = m.fellow_person_id
           where m.supervisor_person_id = p_me and m.status = 'submitted' and m.fellow_person_id is distinct from p_me and m.submitted_at is not null
             and (m.submitted_at at time zone 'UTC')::date <= p_today loop
    out := out || kafaa_dg_item('approval:fellowship_milestones:' || r.id, 'approval', 'fellowship_milestones', r.id,
      'Fellowship milestone to sign off: ' || case when r.pid is null then 'A fellow' else r.display_name end,
      'مرحلة زمالة بانتظار اعتمادك: ' || case when r.pid is null then 'زميل باحث' else coalesce(nullif(r.display_name_ar, ''), r.display_name) end,
      '/universities/fellowships/' || r.fellowship_id, jsonb_build_array(jsonb_build_object('code', 'approval_fellowship', 'vars', jsonb_build_object('date', to_char(r.submitted_at at time zone 'UTC', 'YYYY-MM-DD')))),
      case when r.pid is null then 'A fellow' else r.display_name end, case when r.pid is null then 'زميل باحث' else coalesce(nullif(r.display_name_ar, ''), r.display_name) end);
  end loop;
  if pe.kind is distinct from 'staff' or pe.status is distinct from 'active' then return out; end if;
  select coalesce(jsonb_object_agg(x.skill_id, x.lv), '{}'::jsonb) into v_lv
    from (select ps.skill_id, max(ps.level) lv from kafaa_person_skills ps where ps.person_id = p_me and ps.active is not false and ps.level > 0 group by ps.skill_id) x;
  -- my role's current published 2030 profile (highest version)
  select * into v_prof from kafaa_role_profile_versions v where pe.job_role_id is not null and v.role_id = pe.job_role_id and v.horizon = '2030' and v.status = 'published'
   order by v.version desc, v.id collate "C" limit 1;
  -- my future skills: active goals (FS07 + FS33, highest target) win over the 2030 profile's skill requirements above my level
  select coalesce(jsonb_object_agg(g.skill_id, jsonb_build_object('target', g.t, 'source', 'goal')), '{}'::jsonb) into v_fs
    from (select x.skill_id, max(coalesce(x.target_level, 2)) t from (
            select skill_id, target_level from kafaa_skill_goals where person_id = p_me and status = 'active'
            union all select skill_id, target_level from kafaa_skill_goal_plans where person_id = p_me and status = 'active') x group by x.skill_id) g;
  if v_prof.id is not null then
    for r in select distinct on (q.e->>'ref_id') q.e->>'ref_id' as sid, coalesce((q.e->>'level')::numeric, 0) as need
               from jsonb_array_elements(coalesce(v_prof.requirements, '[]'::jsonb)) with ordinality q(e, i)
              where q.e->>'kind' = 'skill' and q.e->>'ref_id' is not null and coalesce((q.e->>'level')::numeric, 0) > coalesce((v_lv->>(q.e->>'ref_id'))::numeric, 0)
              order by q.e->>'ref_id', q.i loop
      if not v_fs ? r.sid then v_fs := v_fs || jsonb_build_object(r.sid, jsonb_build_object('target', r.need, 'source', 'profile')); end if;
    end loop;
  end if;

  -- decay: the soonest fast-decay lapse (newest evidence at the held level passes its half-life) within 60 days; level 2 and above
  select x.id, x.skill_id, x.level, x.dt, x.hl, coalesce(s.name_en, x.skill_id) as en, coalesce(nullif(s.name_ar, ''), s.name_en, x.skill_id) as ar into r from (
    select ps.id, ps.skill_id, ps.level,
           (select (rr.e->>'observed_on')::date + floor((rr.e->>'hl')::numeric * 30.4375 + 0.5)::int from jsonb_array_elements(ps.reasons) with ordinality rr(e, i)
             where (rr.e->>'level')::numeric = ps.level order by (rr.e->>'observed_on')::date + floor((rr.e->>'hl')::numeric * 30.4375 + 0.5)::int desc, rr.i limit 1) as dt,
           (select rr.e->'hl' from jsonb_array_elements(ps.reasons) with ordinality rr(e, i)
             where (rr.e->>'level')::numeric = ps.level order by (rr.e->>'observed_on')::date + floor((rr.e->>'hl')::numeric * 30.4375 + 0.5)::int desc, rr.i limit 1) as hl
      from kafaa_person_skills ps join kafaa_skills sk on sk.id = ps.skill_id
     where ps.person_id = p_me and ps.active is not false and ps.level >= 2 and kafaa_skill_decay_class(sk.area, sk.decay_class) = 'fast'
       and jsonb_typeof(ps.reasons) = 'array'
       and exists (select 1 from jsonb_array_elements(ps.reasons) e where (e->>'level')::numeric = ps.level)
       and not exists (select 1 from jsonb_array_elements(ps.reasons) e where (e->>'level')::numeric = ps.level
                        and (coalesce(e->'ageing', 'false'::jsonb) not in ('false'::jsonb, 'null'::jsonb) or e->>'code' = 'qual' or coalesce(e->>'observed_on', '') = ''
                             or jsonb_typeof(e->'hl') is distinct from 'number'))) x
    join kafaa_skills s on s.id = x.skill_id
   where x.dt >= p_today and x.dt <= p_today + 60
   order by x.dt, x.id collate "C" limit 1;
  if found then
    out := out || kafaa_dg_item('future:person_skills:' || r.id, 'future', 'person_skills', r.id, r.en || ': level ' || r.level || ' may slip', r.ar || ': قد ينخفض المستوى ' || r.level,
      '/my/skills/confidence', jsonb_build_array(jsonb_build_object('code', 'future_decay', 'vars', jsonb_build_object('date', to_char(r.dt, 'YYYY-MM-DD'), 'level', r.level, 'months', r.hl)),
                                                 jsonb_build_object('code', 'future_decay_renew')),
      null, null, r.dt, r.dt - p_today, null);
  end if;

  -- goal: a dated plan due within 30 days (or up to 30 days overdue) below its target; else an FS07 goal without a dated plan
  select g.id, g.target_date, g.target_level, g.skill_id, coalesce(s.name_en, g.skill_id) as en, coalesce(nullif(s.name_ar, ''), s.name_en, g.skill_id) as ar,
         coalesce((v_lv->>g.skill_id)::int, 0) as have into r
    from kafaa_skill_goal_plans g left join kafaa_skills s on s.id = g.skill_id
   where g.person_id = p_me and g.status = 'active' and g.target_date is not null and g.target_date >= p_today - 30 and g.target_date <= p_today + 30
     and coalesce((v_lv->>g.skill_id)::int, 0) < coalesce(g.target_level, 2)
   order by g.target_date, g.id collate "C" limit 1;
  if found then
    out := out || kafaa_dg_item('future:skill_goal_plans:' || r.id, 'future', 'skill_goal_plans', r.id, 'Your goal: ' || r.en || ' at level ' || r.target_level, 'هدفك: ' || r.ar || ' بالمستوى ' || r.target_level,
      '/my/skills/goals', jsonb_build_array(jsonb_build_object('code', case when r.target_date < p_today then 'future_goal_overdue' else 'future_goal_due' end, 'vars', jsonb_build_object('date', to_char(r.target_date, 'YYYY-MM-DD'))),
                                            jsonb_build_object('code', 'future_goal_level', 'vars', jsonb_build_object('have', r.have, 'level', coalesce(r.target_level, 2)))),
      null, null, r.target_date, r.target_date - p_today, null);
  else
    select g.id, g.created_at, g.target_level, coalesce(s.name_en, g.skill_id) as en, coalesce(nullif(s.name_ar, ''), s.name_en, g.skill_id) as ar, coalesce((v_lv->>g.skill_id)::int, 0) as have into r
      from kafaa_skill_goals g left join kafaa_skills s on s.id = g.skill_id
     where g.person_id = p_me and g.status = 'active' and coalesce((v_lv->>g.skill_id)::int, 0) < coalesce(g.target_level, 2)
       and not exists (select 1 from kafaa_skill_goal_plans pl where pl.person_id = p_me and pl.status = 'active' and pl.skill_id = g.skill_id)
     order by (g.created_at at time zone 'UTC')::date, g.id collate "C" limit 1;
    if found then
      out := out || kafaa_dg_item('future:skill_goals:' || r.id, 'future', 'skill_goals', r.id, 'Give your goal a date: ' || r.en, 'حدّد موعداً لهدفك: ' || r.ar, '/my/skills/goals',
        jsonb_build_array(jsonb_build_object('code', 'future_goal_undated', 'vars', jsonb_build_object('date', to_char(r.created_at at time zone 'UTC', 'YYYY-MM-DD'))),
                          jsonb_build_object('code', 'future_goal_level', 'vars', jsonb_build_object('have', r.have, 'level', coalesce(r.target_level, 2)))),
        null, null, null, null, 0.7);
    end if;
  end if;

  -- ai_literacy: an AI system I use (published, listed, an active listed group for all staff or my family) needs a rung or cells I do not meet
  if exists (select 1 from kafaa_ai_rungs) then
    v_res := kafaa_ai_rung(p_me);
    v_met := array(select e->>'id' from jsonb_array_elements(v_res->'cells') e where (e->>'met')::boolean);
    select g.id, g.required_rung, g.label_en, g.label_ar, s.name_en, s.name_ar into r
      from kafaa_ai_system_users g join kafaa_ai_systems s on s.id = g.system_id and s.status = 'published' and s.listed
     where g.active and g.listed and (g.all_staff or (pe.job_family_id is not null and pe.job_family_id = any(g.family_ids)))
       and not ((v_res->>'rung')::int >= g.required_rung and coalesce(g.required_cells, '{}'::text[]) <@ v_met)
     order by g.required_rung desc, g.id collate "C" limit 1;
    if found then
      out := out || kafaa_dg_item('future:ai_system_users:' || r.id, 'future', 'ai_system_users', r.id, r.name_en || ': AI fluency rung ' || r.required_rung || ' needed',
        coalesce(nullif(r.name_ar, ''), r.name_en) || ': يلزم المستوى ' || r.required_rung || ' من سلّم الطلاقة في الذكاء الاصطناعي', '/my/ai-fluency',
        jsonb_build_array(jsonb_build_object('code', 'future_ai_required', 'vars', jsonb_build_object('system', jsonb_build_object('en', coalesce(r.name_en, ''), 'ar', coalesce(nullif(r.name_ar, ''), nullif(r.name_en, ''), '')),
                            'rung', r.required_rung, 'have', (v_res->>'rung')::int)),
                          jsonb_build_object('code', 'future_ai_group', 'vars', jsonb_build_object('group', jsonb_build_object('en', coalesce(r.label_en, ''), 'ar', coalesce(nullif(r.label_ar, ''), nullif(r.label_en, ''), ''))))),
        null, null, null, null, 0.8);
    end if;
  end if;

  -- role_profile: my role's 2030 profile published or changed (version 2+) in the last 28 days
  if v_prof.id is not null and v_prof.published_at is not null then
    v_at := (v_prof.published_at at time zone 'UTC')::date;
    if v_at >= p_today - 28 and v_at <= p_today then
      v_v := coalesce(v_prof.version, 1);
      v_gaps := (select count(*)::int from jsonb_array_elements(coalesce(v_prof.requirements, '[]'::jsonb)) q
                  where q->>'kind' = 'skill' and coalesce((q->>'level')::numeric, 0) > coalesce((v_lv->>(q->>'ref_id'))::numeric, 0));
      out := out || kafaa_dg_item('future:role_profile_versions:' || v_prof.id, 'future', 'role_profile_versions', v_prof.id,
        case when v_v > 1 then 'Your role in 2030: the profile was updated' else 'Your role in 2030: the profile was published' end,
        case when v_v > 1 then 'دورك في 2030: حُدّث الملف' else 'دورك في 2030: نُشر الملف' end, '/my/role-2030',
        jsonb_build_array(jsonb_build_object('code', case when v_v > 1 then 'future_profile_changed' else 'future_profile_published' end, 'vars', jsonb_build_object('date', to_char(v_at, 'YYYY-MM-DD'), 'version', v_v)),
                          jsonb_build_object('code', case when v_gaps > 0 then 'future_profile_gaps' else 'future_profile_ready' end, 'vars', jsonb_build_object('n', v_gaps))),
        null, null, null, null, 0.9);
    end if;
  end if;

  -- rising_skill: the latest published FS70 list (newest quarter), category 'growing', for my family (families) or, without families,
  -- required by my 2030 profile or a goal; held below level 2. Data-only coupling: read only when kafaa_skill_signals exists (to_jsonb rows).
  if to_regclass('public.kafaa_skill_signals') is not null then
    execute 'select coalesce(jsonb_agg(to_jsonb(s)), ''[]''::jsonb) from public.kafaa_skill_signals s' into v_sig;
  end if;
  v_reqd := array(select q->>'ref_id' from jsonb_array_elements(coalesce(v_prof.requirements, '[]'::jsonb)) q where q->>'kind' = 'skill' and q->>'ref_id' is not null);
  select x.sid, x.qtr, jsonb_array_length(x.fam) > 0 as fam, coalesce(s.name_en, x.sid) as en, coalesce(nullif(s.name_ar, ''), s.name_en, x.sid) as ar into r
    from (select j->>'skill_id' as sid, coalesce(j->>'quarter', '') as qtr, j->>'category' as cat,
                 case when jsonb_typeof(j->'families') = 'array' then j->'families' else '[]'::jsonb end as fam,
                 case when jsonb_typeof(j->'rank') = 'number' then (j->>'rank')::numeric else 1000000000 end as rk
            from jsonb_array_elements(v_sig) j) x
    join kafaa_skills s on s.id = x.sid
   where x.qtr = (select coalesce(max(coalesce(j->>'quarter', '') collate "C"), '') from jsonb_array_elements(v_sig) j) and x.cat = 'growing'
     and coalesce((v_lv->>x.sid)::int, 0) < 2
     and (case when jsonb_array_length(x.fam) > 0 then coalesce(x.fam ? pe.job_family_id, false) else (x.sid = any(v_reqd) or v_fs ? x.sid) end)
   order by jsonb_array_length(x.fam) > 0 desc, x.rk, x.sid collate "C" limit 1;
  if found then
    out := out || kafaa_dg_item('future:skill_signals:' || r.sid, 'future', 'skill_signals', r.sid, 'Rising at ENEC: ' || r.en, 'مهارة صاعدة في المؤسسة: ' || r.ar, '/skills/' || r.sid,
      jsonb_build_array(jsonb_build_object('code', 'future_rising', 'vars', jsonb_build_object('quarter', r.qtr)), jsonb_build_object('code', case when r.fam then 'future_rising_family' else 'future_rising_role' end)),
      null, null, null, null, 0.6);
  end if;

  -- future_gig: an open FS27 gig (opportunity with a channel) of the last 21 days that builds one of my future skills; skipped when I
  -- opted out of marketplace ranking or when the gig is already listed as an opportunity match
  if v_fs <> '{}'::jsonb and not exists (select 1 from kafaa_reco_optouts o where o.person_id = p_me and o.surface = 'marketplace' and o.opted_out) then
    select o.id, o.title_en, o.title_ar, o.created_at, x.hits into r from kafaa_opportunities o
      cross join lateral (select count(*)::int as hits from unnest(coalesce(o.skills_gained, '{}'::text[])) g(sid) where v_fs ? g.sid) x
     where coalesce(o.channel, '') <> '' and o.status = 'open' and o.listed is not false and o.posted_by is distinct from p_me
       and (o.created_at at time zone 'UTC')::date >= p_today - 21 and (o.created_at at time zone 'UTC')::date <= p_today
       and (o.seats is null or coalesce(o.seats_taken, 0) < o.seats)
       and (coalesce(cardinality(o.eligible_families), 0) = 0 or (pe.job_family_id is not null and pe.job_family_id = any(o.eligible_families)))
       and not exists (select 1 from kafaa_opportunity_applications a where a.person_id = p_me and a.opportunity_id = o.id
                        and a.status in ('applied', 'released', 'selected', 'completed', 'declined_release', 'not_selected'))
       and not exists (select 1 from jsonb_array_elements(coalesce(p_out, '[]'::jsonb)) e where e->>'id' = 'opportunity:opportunities:' || o.id)
       and x.hits > 0
     order by x.hits desc, (o.created_at at time zone 'UTC')::date desc, o.id collate "C" limit 1;
    if found then
      v_first := (select g.sid from kafaa_opportunities o, unnest(o.skills_gained) g(sid) where o.id = r.id and v_fs ? g.sid
                   order by (v_fs->g.sid->>'source') <> 'goal', g.sid collate "C" limit 1);
      out := out || kafaa_dg_item('future:opportunities:' || r.id, 'future', 'opportunities', r.id, r.title_en, coalesce(nullif(r.title_ar, ''), r.title_en), '/opportunities/' || r.id,
        jsonb_build_array(jsonb_build_object('code', case when v_fs->v_first->>'source' = 'goal' then 'future_gig_goal' else 'future_gig_profile' end,
                            'vars', jsonb_build_object('skill', (select jsonb_build_object('en', coalesce(s.name_en, v_first), 'ar', coalesce(nullif(s.name_ar, ''), s.name_en, v_first))
                                                                   from (select 1) z left join kafaa_skills s on s.id = v_first))),
                          jsonb_build_object('code', 'future_gig_new', 'vars', jsonb_build_object('date', to_char(r.created_at at time zone 'UTC', 'YYYY-MM-DD')))),
        null, null, null, null, 0.5);
    end if;
  end if;

  -- pathway: a published FS17 pathway updated in the last 28 days, exactly one level above mine on a future skill (never past the target), not started
  if v_fs <> '{}'::jsonb then
    select p.id, p.title_en, p.title_ar, p.skill_id, p.level, p.envelope_months, p.weekly_hours, v_fs->p.skill_id->>'source' as src,
           coalesce(s.name_en, p.skill_id) as en, coalesce(nullif(s.name_ar, ''), s.name_en, p.skill_id) as ar into r
      from kafaa_pathways p left join kafaa_skills s on s.id = p.skill_id
     where p.status = 'published' and p.listed and v_fs ? p.skill_id
       and (p.updated_at at time zone 'UTC')::date >= p_today - 28 and (p.updated_at at time zone 'UTC')::date <= p_today
       and p.level = coalesce((v_lv->>p.skill_id)::int, 0) + 1 and p.level <= (v_fs->p.skill_id->>'target')::numeric
       and not exists (select 1 from kafaa_pathway_enrolments e where e.person_id = p_me and e.pathway_id = p.id and e.status in ('active', 'completed'))
     order by (v_fs->p.skill_id->>'source') <> 'goal', p.id collate "C" limit 1;
    if found then
      out := out || kafaa_dg_item('future:pathways:' || r.id, 'future', 'pathways', r.id, r.title_en, coalesce(nullif(r.title_ar, ''), r.title_en), '/learn/pathways/' || r.id,
        jsonb_build_array(jsonb_build_object('code', case when r.src = 'goal' then 'future_pathway_goal' else 'future_pathway_profile' end,
                            'vars', jsonb_build_object('skill', jsonb_build_object('en', r.en, 'ar', r.ar), 'level', r.level)),
                          jsonb_build_object('code', 'future_pathway_effort', 'vars', jsonb_build_object('months', r.envelope_months, 'hours', r.weekly_hours))),
        null, null, null, null, 0.4);
    end if;
  end if;
  return out;
end $$;

-- ───────────── 3. Shared redefinitions
-- kafaa_dg_gather: copied from the fs6qa body (the newest) plus the FS75 line before the return.
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
  -- approvals (W5 integration, F38): practice entries naming me as preceptor, logged by today and waiting for my acknowledgement
  for r in select l.id, l.on_date, p.id as pid, p.display_name, p.display_name_ar from kafaa_ojt_logs l left join kafaa_people p on p.id = l.person_id
           where l.preceptor_person_id = p_me and l.status = 'pending_ack' and l.person_id <> p_me and l.on_date <= p_today loop
    out := out || kafaa_dg_item('approval:ojt_logs:' || r.id, 'approval', 'ojt_logs', r.id,
      'OJT practice to acknowledge: ' || case when r.pid is null then 'A colleague' else r.display_name end, 'تدريب عملي بانتظار إقرارك: ' || case when r.pid is null then 'زميل' else coalesce(nullif(r.display_name_ar, ''), r.display_name) end,
      '/my/ojt?tab=acknowledge', jsonb_build_array(jsonb_build_object('code', 'approval_ojt_ack', 'vars', jsonb_build_object('date', to_char(r.on_date, 'YYYY-MM-DD')))),
      case when r.pid is null then 'A colleague' else r.display_name end, case when r.pid is null then 'زميل' else coalesce(nullif(r.display_name_ar, ''), r.display_name) end);
  end loop;
  -- approvals (W5 integration, F38): OJT evaluation requests addressed to me as evaluator, made by today
  for r in select q.id, q.requested_at, p.id as pid, p.display_name, p.display_name_ar from kafaa_ojt_eval_requests q left join kafaa_people p on p.id = q.person_id
           where q.evaluator_person_id = p_me and q.status = 'requested' and q.person_id <> p_me and (q.requested_at at time zone 'UTC')::date <= p_today loop
    out := out || kafaa_dg_item('approval:ojt_eval_requests:' || r.id, 'approval', 'ojt_eval_requests', r.id,
      'OJT evaluation requested: ' || case when r.pid is null then 'A colleague' else r.display_name end, 'طلب تقييم تدريب عملي: ' || case when r.pid is null then 'زميل' else coalesce(nullif(r.display_name_ar, ''), r.display_name) end,
      '/my/ojt?tab=evaluate', jsonb_build_array(jsonb_build_object('code', 'approval_ojt_eval', 'vars', jsonb_build_object('date', to_char(r.requested_at at time zone 'UTC', 'YYYY-MM-DD')))),
      case when r.pid is null then 'A colleague' else r.display_name end, case when r.pid is null then 'زميل' else coalesce(nullif(r.display_name_ar, ''), r.display_name) end);
  end loop;
  -- approvals (FS wave E integration, FS39): reference-plant visits naming me as host, logged by today and waiting for my confirmation
  for r in select v.id, v.created_at, p.id as pid, p.display_name, p.display_name_ar from kafaa_plant_visits v left join kafaa_people p on p.id = v.person_id
           where v.host_person_id = p_me and v.status = 'logged' and v.person_id <> p_me and (v.created_at at time zone 'UTC')::date <= p_today loop
    out := out || kafaa_dg_item('approval:plant_visits:' || r.id, 'approval', 'plant_visits', r.id,
      'Plant visit to confirm: ' || case when r.pid is null then 'A colleague' else r.display_name end, 'زيارة محطة بانتظار تأكيدك: ' || case when r.pid is null then 'زميل' else coalesce(nullif(r.display_name_ar, ''), r.display_name) end,
      '/my/plant-log?tab=host', jsonb_build_array(jsonb_build_object('code', 'approval_plant_visit', 'vars', jsonb_build_object('date', to_char(r.created_at at time zone 'UTC', 'YYYY-MM-DD')))),
      case when r.pid is null then 'A colleague' else r.display_name end, case when r.pid is null then 'زميل' else coalesce(nullif(r.display_name_ar, ''), r.display_name) end);
  end loop;
  -- approvals (FS wave F integration, FS59): role-play feedback a colleague sent to me by name for review, requested by today and still open
  for r in select s.id, s.requested_at, p.id as pid, p.display_name, p.display_name_ar from kafaa_roleplay_sessions s left join kafaa_people p on p.id = s.person_id
           where s.reviewer_id = p_me and s.review_status = 'requested' and s.person_id <> p_me and s.requested_at is not null and (s.requested_at at time zone 'UTC')::date <= p_today loop
    out := out || kafaa_dg_item('approval:roleplay_sessions:' || r.id, 'approval', 'roleplay_sessions', r.id,
      'Role-play feedback to review: ' || case when r.pid is null then 'A colleague' else r.display_name end, 'ملاحظات لعب الأدوار بانتظار مراجعتك: ' || case when r.pid is null then 'زميل' else coalesce(nullif(r.display_name_ar, ''), r.display_name) end,
      '/training/role-play?tab=reviews', jsonb_build_array(jsonb_build_object('code', 'approval_roleplay', 'vars', jsonb_build_object('date', to_char(r.requested_at at time zone 'UTC', 'YYYY-MM-DD')))),
      case when r.pid is null then 'A colleague' else r.display_name end, case when r.pid is null then 'زميل' else coalesce(nullif(r.display_name_ar, ''), r.display_name) end);
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
    v_tgt := (select x from unnest(v_short) with ordinality u(x, i) where x is not null and x <> '' and x is distinct from pe.job_role_id
      and not exists (select 1 from kafaa_career_paths fp where fp.to_role_id = x and fp.kind = 'future') order by i limit 1); -- FS wave B: concept roles are never the target
    if v_tgt is null and pe.job_role_id is not null then
      v_tgt := coalesce((select cp.to_role_id from kafaa_career_paths cp where cp.from_role_id = pe.job_role_id and cp.type = 'vertical' and coalesce(cp.kind, 'current') <> 'future' order by coalesce(cp.sort, 0), cp.id collate "C" limit 1),
                        (select cp.to_role_id from kafaa_career_paths cp where cp.from_role_id = pe.job_role_id and coalesce(cp.kind, 'current') <> 'future' order by coalesce(cp.sort, 0), cp.id collate "C" limit 1));
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
  -- FS75 (wave H, fsHe3): fellowship sign-offs owed and the future-skills nudges, from 2026-10-12 on (kafaa_dg_future; TS future.ts)
  out := out || kafaa_dg_future(p_me, p_today, out);
  return out;
end $$;

-- kafaa_dg_compose: kind 'future' ranks after refresher and keeps at most 2 items; at most 7 items in all.
create or replace function kafaa_dg_compose(p_items jsonb, p_muted text[]) returns jsonb language sql immutable set search_path = public as $$
  with x as (
    select e, e->>'kind' as k, (e->>'urgency')::int as u, coalesce((e->>'days')::int, 100000) as dd,
           case e->>'kind' when 'expiry' then 1 when 'approval' then 2 when 'coach' then 3 when 'opportunity' then 4 when 'mentoring' then 5 when 'conversation' then 6 when 'refresher' then 7 else 8 end as kr,
           coalesce((e->>'score')::float8, 0) as sc, e->>'id' as id
      from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) e
     where e->>'kind' = 'expiry' or not (e->>'kind' = any(coalesce(p_muted, '{}'::text[])))
  ), r as (
    select x.*, row_number() over (partition by k order by u, dd, kr, sc desc, id collate "C") as rn from x
  ), kept as (
    select * from r where rn <= case k when 'expiry' then 3 when 'approval' then 3 when 'opportunity' then 2 when 'future' then 2 else 1 end
     order by u, dd, kr, sc desc, id collate "C" limit 7
  )
  select coalesce(jsonb_agg(e order by u, dd, kr, sc desc, id collate "C"), '[]'::jsonb) from kept
$$;

-- kafaa_set_digest_prefs: 'future' can be muted (8 kinds); expiry reminders still cannot be muted.
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
    when jsonb_typeof(p->'muted_kinds') is distinct from 'array' or jsonb_array_length(p->'muted_kinds') > 8
      or exists (select 1 from jsonb_array_elements(p->'muted_kinds') e where jsonb_typeof(e) <> 'string' or (e #>> '{}') not in ('expiry', 'approval', 'coach', 'opportunity', 'mentoring', 'conversation', 'refresher', 'future'))
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

-- kafaa_digest_stats: items per kind include 'future'.
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
            from unnest(array['expiry', 'approval', 'coach', 'opportunity', 'mentoring', 'conversation', 'refresher', 'future']) with ordinality u(kind, ord)) k;
  n_off := (select count(*)::int from kafaa_digest_prefs where not enabled);
  n_quiet := (select count(*)::int from kafaa_digest_prefs where quiet_start is not null and quiet_end is not null and quiet_start <> quiet_end);
  n_muted := (select count(*)::int from kafaa_digest_prefs where cardinality(muted_kinds) > 0);
  return jsonb_build_object('periods', v_periods, 'kinds', v_kinds, 'off', case when n_off < 10 then null else n_off end,
    'quiet', case when n_quiet < 10 then null else n_quiet end, 'muted', case when n_muted < 10 then null else n_muted end);
end $$;

-- ───────────── Grants: the new helper is closed to API roles; the RPC grants are restated (same as 20261009155001).
revoke execute on function kafaa_dg_future(text, date, jsonb), kafaa_dg_gather(text, date, jsonb), kafaa_dg_compose(jsonb, text[]) from public, anon, authenticated;
revoke execute on function kafaa_set_digest_prefs(jsonb), kafaa_digest_stats() from public, anon;
grant execute on function kafaa_set_digest_prefs(jsonb), kafaa_digest_stats() to authenticated;
