-- [FS QA · wave C integration] Cross-feature wiring of FS17-FS26 on master. Additive and idempotent: three create-or-replace of
-- existing kafaa_* functions with unchanged signatures and grants, plus guarded data statements on kafaa_pathway_gaps and three kafaa_skills rows (each only
-- changes a row that still holds the value FS17 loaded live, so a second run, or a run on the final seed, changes nothing). No DDL
-- on tables, nothing dropped or deleted; never touches a NEXUS object or row.
-- Proof: scripts/validate/fsqa3-integration.mjs (PGlite: SQL = TS, forward proof, idempotence). Tests: tests/unit/fsqa3-integration.test.tsx.
--   1. FS21/FS22 -> FS17: an assessment step also discovers active FS21 adaptive banks that assess the pathway's skill (levels up
--      to the bank's evidence cap) and active FS22 performance tasks that evidence it (levels up to the task's evidence level);
--      they are discovered only, never pinned (kafaa_pw_problems is unchanged). Progress: a bank counts when the person has a
--      completed attempt that counts (counts = false after an integrity void), a task when a scored attempt passed and counts.
--      kafaa_pw_item / kafaa_pw_discover / kafaa_pw_progress (TS mirror: src/modules/m19/pathways.ts discover, pathwayProgress, recordsOf).
--   2. FS19/FS21/FS22 -> FS17 gap backlog (FS57 feed): one replay of kafaa_refresh_pathway_gaps on 2026-10-11. Steps that FS19 pack
--      courses and the FS21/FS22 assessments now fill become "filled"; the rest stay "open" (seed: scripts/seed/ext/fsqa3-integration.mjs).
--   3. FS19 evidence keys: three kafaa_skills rows get their evidence_keys in the seed's order (same keys; live load order differed).

-- 1. FS21/FS22 items in pathway steps
create or replace function kafaa_pw_item(p_type text, r jsonb, p_pinned boolean) returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object('type', p_type, 'id', r->>'id',
    'title_en', case when p_type in ('fitness', 'adaptive') then r->>'name_en' else r->>'title_en' end,
    'title_ar', coalesce(nullif(case when p_type in ('fitness', 'adaptive') then r->>'name_ar' else r->>'title_ar' end, ''), case when p_type in ('fitness', 'adaptive') then r->>'name_en' else r->>'title_en' end),
    'hours', case p_type when 'course' then r->'duration_hours' when 'external' then r->'hours' when 'opportunity' then r->'hours_week' when 'credential' then r->'hours' else 'null'::jsonb end,
    'external', p_type = 'external', 'pinned', p_pinned,
    'link', case p_type when 'course' then '/learn/course/' || (r->>'id') when 'external' then '/learn/external?item=' || (r->>'id') when 'opportunity' then '/opportunities/' || (r->>'id')
      when 'credential' then '/my/skills/credentials' when 'adaptive' then '/my/assessments/adaptive/' || (r->>'id') when 'task' then '/my/assessments/tasks/' || (r->>'id') else '/my/ai-fluency/check' end)
$$;
create or replace function kafaa_pw_discover(p_kind text, p_skill text, p_level integer) returns jsonb language sql stable security definer set search_path = public as $$
  with c as (
    select c.* from kafaa_courses c where c.audience in ('staff', 'public')
      and exists (select 1 from jsonb_array_elements(case when jsonb_typeof(c.objectives) = 'array' then c.objectives else '[]'::jsonb end) o
                  where jsonb_typeof(o) = 'object' and o->>'skill_id' = p_skill and coalesce((o->>'level')::numeric, 1) = p_level)
  ), x as (
    select x.* from kafaa_external_resources x where x.status = 'published'
      and exists (select 1 from jsonb_array_elements(case when jsonb_typeof(x.skills) = 'array' then x.skills else '[]'::jsonb end) o
                  where jsonb_typeof(o) = 'object' and o->>'skill_id' = p_skill and (o->>'level')::numeric = p_level)
  ), items as (
    select 1 as t, c.id, kafaa_pw_item('course', to_jsonb(c), false) as j from c
      where (p_kind = 'learn' and c.modality in ('classroom', 'elearning', 'blended', 'external')) or (p_kind = 'practice' and c.modality in ('ojt', 'drill', 'simulator', 'clinic'))
    union all
    select 2, x.id, kafaa_pw_item('external', to_jsonb(x), false) from x
      where (p_kind = 'learn' and x.format in ('elearning', 'mooc', 'course')) or (p_kind = 'practice' and x.format in ('fellowship', 'programme')) or (p_kind = 'assess' and x.has_assessment)
    union all
    select 3, o.id, kafaa_pw_item('opportunity', to_jsonb(o), false) from kafaa_opportunities o
      where p_kind = 'practice' and p_level <= 2 and o.status = 'open' and coalesce(o.listed, true) and o.kind not in ('security', 'protected_area', 'cyber', 'safeguards') and p_skill = any(o.skills_gained)
    union all
    select 4, d.id, kafaa_pw_item('credential', to_jsonb(d), false) from kafaa_microcred_defs d
      where p_kind = 'assess' and d.status = 'current'
        and exists (select 1 from jsonb_array_elements(case when jsonb_typeof(d.alignment) = 'array' then d.alignment else '[]'::jsonb end) o where o->>'skill_id' = p_skill and (o->>'level')::numeric = p_level)
    union all
    select 5, f.id, kafaa_pw_item('fitness', to_jsonb(f), false) from kafaa_fitness_areas f
      where p_kind = 'assess' and p_level <= 2 and p_skill = any(f.skill_ids)
    union all
    select 6, b.id, kafaa_pw_item('adaptive', to_jsonb(b), false) from kafaa_adaptive_banks b
      where p_kind = 'assess' and b.status = 'active' and p_skill = any(b.skill_ids) and p_level <= b.evidence_cap
    union all
    select 7, k.id, kafaa_pw_item('task', to_jsonb(k), false) from kafaa_performance_tasks k
      where p_kind = 'assess' and k.status = 'active' and p_skill = any(k.skill_ids) and p_level <= k.evidence_level
  )
  select coalesce(jsonb_agg(j order by t, id collate "C"), '[]'::jsonb) from items
$$;
create or replace function kafaa_pw_progress(p_person text, p_id text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_res jsonb := kafaa_pw_resolve(p_id); s jsonb; it jsonb; v_via text; v_self boolean; v_hit boolean; v_sd boolean; v_out jsonb := '[]'::jsonb; v_done integer := 0; v_sdn integer := 0; v_n integer := 0;
  c_courses text[]; c_ext text[]; c_ver text[]; c_opp text[]; c_cred text[]; c_fit boolean; c_ad text[]; c_task text[];
begin
  if v_res is null then return null; end if;
  select coalesce(array_agg(distinct course_id), '{}') into c_courses from kafaa_training_records where person_id = p_person and result in ('passed', 'completed', 'attended');
  select coalesce(array_agg(distinct resource_id), '{}') into c_ext from kafaa_external_completions where person_id = p_person;
  select coalesce(array_agg(distinct resource_id), '{}') into c_ver from kafaa_external_completions where person_id = p_person and evidence = 'verified';
  select coalesce(array_agg(distinct opportunity_id), '{}') into c_opp from kafaa_opportunity_applications where person_id = p_person and status = 'completed';
  select coalesce(array_agg(distinct def_id), '{}') into c_cred from kafaa_microcred_awards where person_id = p_person and status = 'awarded';
  select exists (select 1 from kafaa_fitness_attempts where person_id = p_person and status = 'completed') into c_fit;
  select coalesce(array_agg(distinct bank_id), '{}') into c_ad from kafaa_adaptive_attempts where person_id = p_person and status = 'completed' and counts;
  select coalesce(array_agg(distinct task_id), '{}') into c_task from kafaa_task_attempts where person_id = p_person and status = 'scored' and passed is true and counts;
  for s in select x from jsonb_array_elements(v_res->'steps') x loop
    v_n := v_n + 1; v_via := null; v_self := false;
    for it in select x from jsonb_array_elements(s->'items') x loop
      v_hit := case it->>'type' when 'course' then (it->>'id') = any(c_courses) when 'external' then (it->>'id') = any(c_ext) or (it->>'id') = any(c_ver)
        when 'opportunity' then (it->>'id') = any(c_opp) when 'credential' then (it->>'id') = any(c_cred)
        when 'adaptive' then (it->>'id') = any(c_ad) when 'task' then (it->>'id') = any(c_task) else c_fit end;
      if not v_hit then continue; end if;
      v_sd := (it->>'type') = 'external' and not ((it->>'id') = any(c_ver));
      if v_via is null or (v_self and not v_sd) then v_via := (it->>'type') || ':' || (it->>'id'); v_self := v_sd; end if;
    end loop;
    if v_via is not null then v_done := v_done + 1; if v_self then v_sdn := v_sdn + 1; end if; end if;
    v_out := v_out || jsonb_build_array(jsonb_build_object('step_id', s->>'step_id', 'done', v_via is not null, 'via', v_via, 'self_declared', v_via is not null and v_self));
  end loop;
  return jsonb_build_object('steps', v_out, 'done', v_done, 'total', v_n, 'pct', case when v_n > 0 then round(100.0 * v_done / v_n)::integer else 0 end,
    'self_declared', v_sdn, 'complete', v_n > 0 and v_done = v_n);
end $$;
revoke all on function kafaa_pw_item(text, jsonb, boolean), kafaa_pw_discover(text, text, integer), kafaa_pw_progress(text, text) from public, anon, authenticated;

-- 2. FS17 gap backlog after FS19/FS21/FS22: one refresh replayed on 2026-10-11 (guarded: only rows still as FS17 loaded them)
select set_config('kafaa.seeding', 'on', true);
update kafaa_pathway_gaps set status = 'filled', filled_on = date '2026-10-11', last_checked = date '2026-10-11'
 where status = 'open' and last_checked = date '2026-10-10' and id = any(array[
  'pg:pw-adv-factoryqa-l2:v1:s1', 'pg:pw-adv-passive-l1:v1:s3', 'pg:pw-adv-passive-l2:v1:s1', 'pg:pw-adv-passive-l2:v1:s3',
  'pg:pw-adv-smr-l1:v1:s3', 'pg:pw-adv-smr-l2:v1:s3', 'pg:pw-ai-anomaly-l1:v1:s1', 'pg:pw-ai-anomaly-l1:v1:s3',
  'pg:pw-ai-anomaly-l2:v1:s3', 'pg:pw-ai-automation-l1:v1:s1', 'pg:pw-ai-plantdata-l1:v1:s1', 'pg:pw-ai-plantdata-l2:v1:s1',
  'pg:pw-ai-prompt-l2:v1:s1', 'pg:pw-ai-twin-l1:v1:s1', 'pg:pw-ai-twin-l1:v1:s3', 'pg:pw-ai-twin-l2:v1:s3',
  'pg:pw-ai-twin-l3:v1:s3', 'pg:pw-ai-use-l2:v1:s1', 'pg:pw-ai-verify-l2:v1:s1', 'pg:pw-ai-verify-l3:v1:s3',
  'pg:pw-ai-xr-l2:v1:s1', 'pg:pw-cy-access-l1:v1:s3', 'pg:pw-cy-media-l1:v1:s3', 'pg:pw-cy-report-l1:v1:s3',
  'pg:pw-dp-ework-l1:v1:s1', 'pg:pw-dp-procurement-l2:v1:s1', 'pg:pw-dp-robotics-l1:v1:s1', 'pg:pw-gr-esg-l1:v1:s1',
  'pg:pw-gr-esg-l1:v1:s3', 'pg:pw-gr-esg-l2:v1:s3', 'pg:pw-gr-ghg-l2:v1:s1', 'pg:pw-gr-ghg-l2:v1:s3',
  'pg:pw-gr-grid-l1:v1:s1', 'pg:pw-gr-h2heat-l2:v1:s1', 'pg:pw-gr-lifecycle-l1:v1:s1', 'pg:pw-gr-lifecycle-l1:v1:s3',
  'pg:pw-gr-lifecycle-l2:v1:s3', 'pg:pw-tr-analytical-l1:v1:s1', 'pg:pw-tr-analytical-l2:v1:s3', 'pg:pw-tr-analytical-l3:v1:s3',
  'pg:pw-tr-creative-l2:v1:s1', 'pg:pw-tr-curiosity-l1:v1:s1', 'pg:pw-tr-resilience-l2:v1:s1'
]::text[]);
update kafaa_pathway_gaps set last_checked = date '2026-10-11'
 where status = 'open' and last_checked = date '2026-10-10' and id = any(array[
  'pg:pw-adv-factoryqa-l1:v1:s2', 'pg:pw-adv-factoryqa-l1:v1:s3', 'pg:pw-adv-factoryqa-l2:v1:s2', 'pg:pw-adv-factoryqa-l2:v1:s3',
  'pg:pw-adv-fuelcycle-l1:v1:s2', 'pg:pw-adv-fuelcycle-l1:v1:s3', 'pg:pw-adv-fuelcycle-l2:v1:s1', 'pg:pw-adv-fuelcycle-l2:v1:s2',
  'pg:pw-adv-fuelcycle-l2:v1:s3', 'pg:pw-adv-fusion-l1:v1:s2', 'pg:pw-adv-fusion-l1:v1:s3', 'pg:pw-adv-micro-l1:v1:s2',
  'pg:pw-adv-micro-l1:v1:s3', 'pg:pw-adv-micro-l2:v1:s2', 'pg:pw-adv-micro-l2:v1:s3', 'pg:pw-adv-multimodule-l1:v1:s2',
  'pg:pw-adv-multimodule-l1:v1:s3', 'pg:pw-adv-multimodule-l2:v1:s2', 'pg:pw-adv-multimodule-l2:v1:s3', 'pg:pw-adv-passive-l1:v1:s2',
  'pg:pw-adv-passive-l2:v1:s2', 'pg:pw-adv-regulation-l1:v1:s2', 'pg:pw-adv-regulation-l1:v1:s3', 'pg:pw-adv-regulation-l2:v1:s1',
  'pg:pw-adv-regulation-l2:v1:s2', 'pg:pw-adv-regulation-l2:v1:s3', 'pg:pw-adv-smr-l1:v1:s2', 'pg:pw-ai-anomaly-l2:v1:s1',
  'pg:pw-ai-anomaly-l2:v1:s2', 'pg:pw-ai-automation-l1:v1:s2', 'pg:pw-ai-automation-l1:v1:s3', 'pg:pw-ai-automation-l2:v1:s1',
  'pg:pw-ai-automation-l2:v1:s2', 'pg:pw-ai-automation-l2:v1:s3', 'pg:pw-ai-data-care-l1:v1:s2', 'pg:pw-ai-data-care-l2:v1:s1',
  'pg:pw-ai-data-care-l2:v1:s2', 'pg:pw-ai-dataeng-l1:v1:s1', 'pg:pw-ai-dataeng-l1:v1:s3', 'pg:pw-ai-dataeng-l2:v1:s1',
  'pg:pw-ai-dataeng-l2:v1:s2', 'pg:pw-ai-dataeng-l2:v1:s3', 'pg:pw-ai-prompt-l1:v1:s2', 'pg:pw-ai-prompt-l2:v1:s2',
  'pg:pw-ai-twin-l2:v1:s1', 'pg:pw-ai-twin-l3:v1:s1', 'pg:pw-ai-twin-l3:v1:s2', 'pg:pw-ai-use-l1:v1:s2',
  'pg:pw-ai-use-l2:v1:s2', 'pg:pw-ai-verify-l3:v1:s1', 'pg:pw-ai-verify-l3:v1:s2', 'pg:pw-ai-xr-l1:v1:s1',
  'pg:pw-ai-xr-l1:v1:s2', 'pg:pw-ai-xr-l1:v1:s3', 'pg:pw-ai-xr-l2:v1:s2', 'pg:pw-ai-xr-l2:v1:s3',
  'pg:pw-cy-access-l1:v1:s2', 'pg:pw-cy-media-l1:v1:s2', 'pg:pw-cy-phishing-l1:v1:s2', 'pg:pw-cy-report-l1:v1:s2',
  'pg:pw-cy-zones-l1:v1:s2', 'pg:pw-cy-zones-l1:v1:s3', 'pg:pw-dp-dic-l1:v1:s1', 'pg:pw-dp-dic-l1:v1:s2',
  'pg:pw-dp-dic-l1:v1:s3', 'pg:pw-dp-dic-l2:v1:s1', 'pg:pw-dp-dic-l2:v1:s2', 'pg:pw-dp-dic-l2:v1:s3',
  'pg:pw-dp-ework-l1:v1:s2', 'pg:pw-dp-ework-l1:v1:s3', 'pg:pw-dp-ework-l2:v1:s1', 'pg:pw-dp-ework-l2:v1:s2',
  'pg:pw-dp-ework-l2:v1:s3', 'pg:pw-dp-paperlog-l1:v1:s1', 'pg:pw-dp-paperlog-l1:v1:s2', 'pg:pw-dp-paperlog-l1:v1:s3',
  'pg:pw-dp-procurement-l1:v1:s1', 'pg:pw-dp-procurement-l1:v1:s2', 'pg:pw-dp-procurement-l1:v1:s3', 'pg:pw-dp-procurement-l2:v1:s2',
  'pg:pw-dp-procurement-l2:v1:s3', 'pg:pw-dp-robotics-l1:v1:s2', 'pg:pw-dp-robotics-l1:v1:s3', 'pg:pw-dp-robotics-l2:v1:s1',
  'pg:pw-dp-robotics-l2:v1:s2', 'pg:pw-dp-robotics-l2:v1:s3', 'pg:pw-dp-rounds-l1:v1:s1', 'pg:pw-dp-rounds-l1:v1:s2',
  'pg:pw-dp-rounds-l1:v1:s3', 'pg:pw-dp-rounds-l2:v1:s1', 'pg:pw-dp-rounds-l2:v1:s2', 'pg:pw-dp-rounds-l2:v1:s3',
  'pg:pw-gr-circular-l1:v1:s1', 'pg:pw-gr-circular-l1:v1:s2', 'pg:pw-gr-circular-l1:v1:s3', 'pg:pw-gr-circular-l2:v1:s1',
  'pg:pw-gr-circular-l2:v1:s2', 'pg:pw-gr-circular-l2:v1:s3', 'pg:pw-gr-climaterisk-l1:v1:s2', 'pg:pw-gr-climaterisk-l2:v1:s1',
  'pg:pw-gr-climaterisk-l2:v1:s2', 'pg:pw-gr-climaterisk-l2:v1:s3', 'pg:pw-gr-esg-l1:v1:s2', 'pg:pw-gr-esg-l2:v1:s1',
  'pg:pw-gr-esg-l2:v1:s2', 'pg:pw-gr-ghg-l1:v1:s2', 'pg:pw-gr-ghg-l2:v1:s2', 'pg:pw-gr-grid-l1:v1:s2',
  'pg:pw-gr-grid-l1:v1:s3', 'pg:pw-gr-grid-l2:v1:s1', 'pg:pw-gr-grid-l2:v1:s2', 'pg:pw-gr-grid-l2:v1:s3',
  'pg:pw-gr-h2heat-l1:v1:s1', 'pg:pw-gr-h2heat-l1:v1:s2', 'pg:pw-gr-h2heat-l1:v1:s3', 'pg:pw-gr-h2heat-l2:v1:s2',
  'pg:pw-gr-h2heat-l2:v1:s3', 'pg:pw-gr-lifecycle-l1:v1:s2', 'pg:pw-gr-lifecycle-l2:v1:s1', 'pg:pw-gr-lifecycle-l2:v1:s2',
  'pg:pw-tr-analytical-l2:v1:s1', 'pg:pw-tr-analytical-l3:v1:s1', 'pg:pw-tr-analytical-l3:v1:s2', 'pg:pw-tr-creative-l1:v1:s1',
  'pg:pw-tr-creative-l1:v1:s2', 'pg:pw-tr-creative-l1:v1:s3', 'pg:pw-tr-creative-l2:v1:s2', 'pg:pw-tr-creative-l2:v1:s3',
  'pg:pw-tr-crosscultural-l1:v1:s3', 'pg:pw-tr-crosscultural-l2:v1:s1', 'pg:pw-tr-crosscultural-l2:v1:s3', 'pg:pw-tr-curiosity-l1:v1:s3',
  'pg:pw-tr-curiosity-l2:v1:s1', 'pg:pw-tr-curiosity-l2:v1:s2', 'pg:pw-tr-curiosity-l2:v1:s3', 'pg:pw-tr-dependable-l1:v1:s2',
  'pg:pw-tr-dependable-l2:v1:s1', 'pg:pw-tr-dependable-l2:v1:s2', 'pg:pw-tr-dependable-l2:v1:s3', 'pg:pw-tr-empathy-l1:v1:s3',
  'pg:pw-tr-empathy-l2:v1:s1', 'pg:pw-tr-empathy-l2:v1:s2', 'pg:pw-tr-empathy-l2:v1:s3', 'pg:pw-tr-environment-l1:v1:s2',
  'pg:pw-tr-environment-l2:v1:s1', 'pg:pw-tr-environment-l2:v1:s2', 'pg:pw-tr-environment-l2:v1:s3', 'pg:pw-tr-leadership-l1:v1:s1',
  'pg:pw-tr-leadership-l1:v1:s2', 'pg:pw-tr-leadership-l1:v1:s3', 'pg:pw-tr-leadership-l2:v1:s3', 'pg:pw-tr-leadership-l3:v1:s2',
  'pg:pw-tr-leadership-l3:v1:s3', 'pg:pw-tr-resilience-l1:v1:s1', 'pg:pw-tr-resilience-l1:v1:s2', 'pg:pw-tr-resilience-l1:v1:s3',
  'pg:pw-tr-resilience-l2:v1:s2', 'pg:pw-tr-resilience-l2:v1:s3', 'pg:pw-tr-selfaware-l1:v1:s2', 'pg:pw-tr-selfaware-l1:v1:s3',
  'pg:pw-tr-selfaware-l2:v1:s1', 'pg:pw-tr-selfaware-l2:v1:s2', 'pg:pw-tr-selfaware-l2:v1:s3', 'pg:pw-tr-systems-l1:v1:s2',
  'pg:pw-tr-systems-l1:v1:s3', 'pg:pw-tr-systems-l2:v1:s2', 'pg:pw-tr-systems-l3:v1:s1', 'pg:pw-tr-systems-l3:v1:s2',
  'pg:pw-tr-systems-l3:v1:s3', 'pg:pw-tr-techlit-l1:v1:s2', 'pg:pw-tr-techlit-l2:v1:s1', 'pg:pw-tr-techlit-l2:v1:s2'
]::text[]);
select set_config('kafaa.seeding', '', true);

-- 3. FS19 evidence keys: the live load synced kafaa_skills.evidence_keys course by course (by course id), the seed link by link, so three
--    skills hold the same keys in a different order. Put them in the seed's order (guarded on the live order; same set of keys).
select set_config('kafaa.seeding', 'on', true);
update kafaa_skills set evidence_keys = array['c-fs-systems', 'c-fs-plantlit-x'] where id = 'sk-fs-tr-systems' and evidence_keys = array['c-fs-plantlit-x', 'c-fs-systems'];
update kafaa_skills set evidence_keys = array['c-fs-remote', 'c-fs-factoryqa'] where id = 'sk-mp-01-remote' and evidence_keys = array['c-fs-factoryqa', 'c-fs-remote'];
update kafaa_skills set evidence_keys = array['c-fs-plantdata', 'c-fs-dataquality'] where id = 'sk-fs-ai-plantdata' and evidence_keys = array['c-fs-dataquality', 'c-fs-plantdata'];
select set_config('kafaa.seeding', '', true);
