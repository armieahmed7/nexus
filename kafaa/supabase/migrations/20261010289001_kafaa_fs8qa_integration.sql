-- [FS QA · wave H integration] Cross-feature wiring of FS70-FS77 on the integration branch (fsH-integration-qa, stacked on fsG-integration-qa).
-- Additive and idempotent: one create-or-replace of an internal kafaa_* function (same signature, still executable by no API role). No table,
-- column, policy, trigger, grant or row is created or changed; nothing is removed; no NEXUS object is touched; no data statement.
-- Proof: scripts/validate/fsqa8-integration.mjs (PGlite: SQL = TS on the final seed, idempotence, grants). Tests:
-- tests/unit/fsqa8-integration.test.tsx. Seed invariants: scripts/seed/ext/fsqa8-integration.mjs (FINALIZE_LAST).
--   Wiring that needs no SQL here (proved by the validator on the final seed):
--   - FS70 -> FS75: kafaa_dg_future reads the published kafaa_skill_signals rows (newest quarter, category 'growing', families, rank) once
--     FS70's table exists: the rising-skill nudges on 2026-10-12 come from the seeded FS70 lists (data-only coupling, no shape change).
--   - FS72 -> FS55: the skill_suggestions engine card (deterministic, protected inputs excluded) and its fairness snapshots exist; a confirmed
--     suggestion is the person's own rating evidence (basis claimed, a recorded kind), kept by kafaa_skills_apply without a redefinition.
--   - FS73: the RPC answers HR analysts, the HR director and auditors only; observers, partners and managers get nothing.
--   - FS74 <- FS09/FS31/FS25/FS41: the wallet is computed from evidence only (claimed never counts, so a confirmed FS72 suggestion never
--     completes an item); FS62 tags the wallet target (fs82 redefined the five kafaa_na_* functions once, from the fs72 bodies).
--   - FS75: kafaa_dg_gather keeps the fs83 body (fs6qa + the FS75 line; every earlier rule incl. the wave-B concept-role exclusion);
--     at most 7 items, idempotent per period.
--   - FS76: the future-skills evaluation set is part of the Dalil release gate; QA_B (concept roles read FS15) is closed.
--   1. FS69 -> F36 (wave-G carry-over): pre-arrival checks owed join the digest approvals. The evaluator who opened a share on a
--      contractor's behalf is named on it (created_via 'on_behalf', created_by), so the check is theirs while it is unchecked, the FS32 link
--      is active and the mobilisation date has not passed. Self-made shares name no evaluator and stay out. From 2026-10-12 (FS75_FROM) only,
--      so the seeded digests and every earlier parity check stay unchanged.

-- 1. kafaa_dg_future: copied from the fs83 body (20261010283001, the newest); the only change is the pre-arrival block after the FS67 one.
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
  -- approvals (FS69 -> F36, wave-H integration): pre-arrival checks I owe as the evaluator who opened the share on a contractor's behalf
  -- (assessor-on-behalf with the signed-consent reference): unchecked, FS32 link active, mobilisation today or later, never for a
  -- security-restricted standard; dated by the mobilisation date; the organisation is named, the contractor is not (TS gatherPrearrivalOwed)
  for r in select pa.id, pa.org_id, pa.mobilise_on, (pa.created_at at time zone 'UTC')::date as opened, qs.title_en, qs.title_ar, o.name_en, o.name_ar
             from kafaa_prearrival_shares pa
             join kafaa_record_shares s on s.id = pa.share_id
             join kafaa_qual_standards qs on qs.id = pa.standard_id
             left join kafaa_organisations o on o.id = pa.org_id
            where pa.created_via = 'on_behalf' and pa.created_by = p_me and pa.person_id is distinct from p_me and pa.checked_at is null
              and pa.created_at is not null and (pa.created_at at time zone 'UTC')::date <= p_today and pa.mobilise_on >= p_today
              and s.revoked_at is null and s.expires_on is not null and s.expires_on >= p_today and qs.security_restricted is not true loop
    out := out || kafaa_dg_item('approval:prearrival_shares:' || r.id, 'approval', 'prearrival_shares', r.id,
      'Pre-arrival check to run: ' || r.title_en, 'فحص ما قبل الوصول بانتظارك: ' || coalesce(nullif(r.title_ar, ''), r.title_en),
      '/training/equivalency/prearrival/' || r.id,
      jsonb_build_array(
        jsonb_build_object('code', 'approval_prearrival', 'vars', jsonb_build_object('date', to_char(r.opened, 'YYYY-MM-DD'),
          'org', jsonb_build_object('en', coalesce(r.name_en, r.org_id), 'ar', coalesce(nullif(r.name_ar, ''), r.name_en, r.org_id)))),
        jsonb_build_object('code', 'approval_prearrival_mobilise', 'vars', jsonb_build_object('date', to_char(r.mobilise_on, 'YYYY-MM-DD')))),
      coalesce(r.name_en, r.org_id), coalesce(nullif(r.name_ar, ''), r.name_en, r.org_id), r.mobilise_on, r.mobilise_on - p_today);
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

revoke execute on function kafaa_dg_future(text, date, jsonb) from public, anon, authenticated;
