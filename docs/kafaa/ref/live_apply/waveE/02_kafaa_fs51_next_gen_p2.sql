-- kafaa_fs51_next_gen_p2 (2/2) · from supabase/migrations/20261010251001_kafaa_fs51_next_gen.sql
-- Apply with apply_migration name "kafaa_fs51_next_gen_p2". Additive and idempotent; kafaa_* objects only.
-- Problems in a submission against the drill shown (mirror of twinSubProblem). p_sc carries components, modes, checks, actions, rationales, max_checks.
create or replace function kafaa_tw_sub_problem(p_sc jsonb, p_sub jsonb) returns text language plpgsql immutable set search_path = public as $$
declare x jsonb;
begin
  if p_sub is null or jsonb_typeof(p_sub) <> 'object' or jsonb_typeof(p_sub -> 'checks') is distinct from 'array' or jsonb_typeof(p_sub -> 'rationale_ids') is distinct from 'array' then return 'shape'; end if;
  for x in select e from jsonb_array_elements(kafaa_smr_arr(p_sub -> 'checks')) e loop
    if jsonb_typeof(x) <> 'string' or not exists (select 1 from jsonb_array_elements(kafaa_smr_arr(p_sc -> 'checks')) o where o ->> 'id' = x #>> '{}') then return 'checks'; end if;
  end loop;
  if (select count(distinct e #>> '{}') from jsonb_array_elements(kafaa_smr_arr(p_sub -> 'checks')) e) <> kafaa_smr_alen(p_sub -> 'checks') then return 'checks'; end if;
  if kafaa_smr_alen(p_sub -> 'checks') > (p_sc ->> 'max_checks')::integer then return 'too_many'; end if;
  if jsonb_typeof(p_sub -> 'component_id') is distinct from 'string' or not exists (select 1 from jsonb_array_elements(kafaa_smr_arr(p_sc -> 'components')) o where o ->> 'id' = p_sub ->> 'component_id') then return 'component'; end if;
  if jsonb_typeof(p_sub -> 'mode_id') is distinct from 'string' or not exists (select 1 from jsonb_array_elements(kafaa_smr_arr(p_sc -> 'modes')) o where o ->> 'id' = p_sub ->> 'mode_id') then return 'mode'; end if;
  if jsonb_typeof(p_sub -> 'action_id') is distinct from 'string' or not exists (select 1 from jsonb_array_elements(kafaa_smr_arr(p_sc -> 'actions')) o where o ->> 'id' = p_sub ->> 'action_id') then return 'action'; end if;
  if kafaa_smr_alen(p_sub -> 'rationale_ids') < 1 or kafaa_smr_alen(p_sub -> 'rationale_ids') > 3 then return 'rationales'; end if;
  for x in select e from jsonb_array_elements(kafaa_smr_arr(p_sub -> 'rationale_ids')) e loop
    if jsonb_typeof(x) <> 'string' or not exists (select 1 from jsonb_array_elements(kafaa_smr_arr(p_sc -> 'rationales')) o where o ->> 'id' = x #>> '{}') then return 'rationales'; end if;
  end loop;
  if (select count(distinct e #>> '{}') from jsonb_array_elements(kafaa_smr_arr(p_sub -> 'rationale_ids')) e) <> kafaa_smr_alen(p_sub -> 'rationale_ids') then return 'rationales'; end if;
  return null;
end $$;
-- An option list: lo..hi objects with id (<= 30), en and ar (<= 240), unique ids (mirror of optsOk).
create or replace function kafaa_tw_opts(x jsonb, p_lo integer, p_hi integer) returns boolean language sql immutable set search_path = public as $$
  select coalesce(jsonb_typeof(x) = 'array' and kafaa_smr_alen(x) between p_lo and p_hi
    and not exists (select 1 from jsonb_array_elements(kafaa_smr_arr(x)) o where jsonb_typeof(o) <> 'object' or not kafaa_air_str(o -> 'id', 30) or not kafaa_air_str(o -> 'en', 240) or not kafaa_air_str(o -> 'ar', 240))
    and (select count(distinct o ->> 'id') from jsonb_array_elements(kafaa_smr_arr(x)) o) = kafaa_smr_alen(x), false)
$$;
-- Ids of a key list are strings naming options of the drill, each once (mirror of sub()).
create or replace function kafaa_tw_sub(p_ids jsonb, p_opts jsonb) returns boolean language sql immutable set search_path = public as $$
  select coalesce(jsonb_typeof(p_ids) = 'array'
    and not exists (select 1 from jsonb_array_elements(kafaa_smr_arr(p_ids)) i where jsonb_typeof(i) <> 'string' or not exists (select 1 from jsonb_array_elements(kafaa_smr_arr(p_opts)) o where o ->> 'id' = i #>> '{}'))
    and (select count(distinct i #>> '{}') from jsonb_array_elements(kafaa_smr_arr(p_ids)) i) = kafaa_smr_alen(p_ids), false)
$$;
-- First problem code of an authored drill, or null (mirror of twinProblem). p_skills = the twin and plant-data skills allowed.
create or replace function kafaa_tw_problem(p jsonb, p_skills text[]) returns text language plpgsql immutable set search_path = public as $$
declare se jsonb; g jsonb; k jsonb; v_n integer; v_all text; c jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' or not kafaa_air_str(p -> 'title_en', 140) or not kafaa_air_str(p -> 'title_ar', 140) or not kafaa_air_str(p -> 'summary_en', 400)
     or not kafaa_air_str(p -> 'summary_ar', 400) or not kafaa_air_str(p -> 'scenario_en', 900) or not kafaa_air_str(p -> 'scenario_ar', 900)
     or not kafaa_air_str(p -> 'system_en', 140) or not kafaa_air_str(p -> 'system_ar', 140) then return 'texts'; end if;
  if jsonb_typeof(p -> 'code') is distinct from 'string' or p ->> 'code' !~ '^SYN-TW-\d{3}$' then return 'synthetic'; end if;
  if not kafaa_air_int(p -> 'difficulty', 1, 3) then return 'difficulty'; end if;
  if not kafaa_air_int(p -> 'level', 1, 2) then return 'level'; end if;
  if jsonb_typeof(p -> 'skill_ids') is distinct from 'array' or kafaa_smr_alen(p -> 'skill_ids') < 1 or kafaa_smr_alen(p -> 'skill_ids') > 3
     or exists (select 1 from jsonb_array_elements(kafaa_smr_arr(p -> 'skill_ids')) s where jsonb_typeof(s) <> 'string' or not (s #>> '{}') = any (p_skills))
     or (select count(distinct s #>> '{}') from jsonb_array_elements(kafaa_smr_arr(p -> 'skill_ids')) s) <> kafaa_smr_alen(p -> 'skill_ids') then return 'skill'; end if;
  if jsonb_typeof(p -> 'status') is distinct from 'string' or p ->> 'status' not in ('draft', 'published', 'retired') then return 'status'; end if;
  if not kafaa_air_int(p -> 'est_minutes', 5, 40) then return 'minutes'; end if;
  se := p -> 'series';
  if se is null or jsonb_typeof(se) <> 'object' or not kafaa_air_str(se -> 't_en', 40) or not kafaa_air_str(se -> 't_ar', 40) or jsonb_typeof(se -> 't') is distinct from 'array'
     or kafaa_smr_alen(se -> 't') < 6 or kafaa_smr_alen(se -> 't') > 48 or exists (select 1 from jsonb_array_elements(kafaa_smr_arr(se -> 't')) t where jsonb_typeof(t) <> 'number')
     or jsonb_typeof(se -> 'signals') is distinct from 'array' or kafaa_smr_alen(se -> 'signals') < 2 or kafaa_smr_alen(se -> 'signals') > 6 then return 'series'; end if;
  v_n := kafaa_smr_alen(se -> 't');
  for g in select e from jsonb_array_elements(kafaa_smr_arr(se -> 'signals')) e loop
    if jsonb_typeof(g) <> 'object' or not kafaa_air_str(g -> 'id', 20) or not kafaa_air_str(g -> 'name_en', 80) or not kafaa_air_str(g -> 'name_ar', 80) or not kafaa_air_str(g -> 'unit', 16)
       or jsonb_typeof(g -> 'values') is distinct from 'array' or kafaa_smr_alen(g -> 'values') <> v_n or exists (select 1 from jsonb_array_elements(kafaa_smr_arr(g -> 'values')) v where jsonb_typeof(v) <> 'number')
       or jsonb_typeof(g -> 'band') is distinct from 'array' or kafaa_smr_alen(g -> 'band') <> 2 or jsonb_typeof(g -> 'band' -> 0) <> 'number' or jsonb_typeof(g -> 'band' -> 1) <> 'number'
       then return 'series'; end if;
    if (g -> 'band' ->> 0)::numeric >= (g -> 'band' ->> 1)::numeric then return 'series'; end if;
  end loop;
  if (select count(distinct e ->> 'id') from jsonb_array_elements(kafaa_smr_arr(se -> 'signals')) e) <> kafaa_smr_alen(se -> 'signals') then return 'series'; end if;
  if not kafaa_tw_opts(p -> 'components', 3, 6) then return 'components'; end if;
  if not kafaa_tw_opts(p -> 'modes', 2, 5) then return 'modes'; end if;
  if not kafaa_tw_opts(p -> 'checks', 3, 8) then return 'checks'; end if;
  for c in select e from jsonb_array_elements(kafaa_smr_arr(p -> 'checks')) e loop
    if not kafaa_air_int(c -> 'minutes', 1, 480) or not kafaa_air_str(c -> 'result_en', 300) or not kafaa_air_str(c -> 'result_ar', 300) then return 'checks'; end if;
  end loop;
  if not kafaa_air_int(p -> 'max_checks', 1, kafaa_smr_alen(p -> 'checks')) then return 'max_checks'; end if;
  if not kafaa_tw_opts(p -> 'actions', 3, 5) then return 'actions'; end if;
  if not kafaa_tw_opts(p -> 'rationales', 3, 6) then return 'rationales'; end if;
  k := p -> 'key';
  if k is null or jsonb_typeof(k) <> 'object'
     or jsonb_typeof(k -> 'component_id') is distinct from 'string' or not exists (select 1 from jsonb_array_elements(kafaa_smr_arr(p -> 'components')) o where o ->> 'id' = k ->> 'component_id')
     or jsonb_typeof(k -> 'mode_id') is distinct from 'string' or not exists (select 1 from jsonb_array_elements(kafaa_smr_arr(p -> 'modes')) o where o ->> 'id' = k ->> 'mode_id')
     or not kafaa_tw_sub(k -> 'useful_checks', p -> 'checks') or not kafaa_tw_sub(k -> 'unsafe_checks', p -> 'checks') or kafaa_smr_alen(k -> 'useful_checks') < 1
     or kafaa_smr_alen(k -> 'useful_checks') > (p ->> 'max_checks')::integer
     or exists (select 1 from jsonb_array_elements(kafaa_smr_arr(k -> 'useful_checks')) u where u in (select x from jsonb_array_elements(kafaa_smr_arr(k -> 'unsafe_checks')) x))
     or not kafaa_tw_sub(k -> 'conservative_actions', p -> 'actions') or not kafaa_tw_sub(k -> 'unsafe_actions', p -> 'actions') or kafaa_smr_alen(k -> 'conservative_actions') < 1
     or exists (select 1 from jsonb_array_elements(kafaa_smr_arr(k -> 'conservative_actions')) u where u in (select x from jsonb_array_elements(kafaa_smr_arr(k -> 'unsafe_actions')) x))
     or jsonb_typeof(k -> 'best_action') is distinct from 'string' or not exists (select 1 from jsonb_array_elements(kafaa_smr_arr(k -> 'conservative_actions')) x where x #>> '{}' = k ->> 'best_action')
     or not kafaa_tw_sub(k -> 'sound_rationales', p -> 'rationales') or kafaa_smr_alen(k -> 'sound_rationales') < 1 or kafaa_smr_alen(k -> 'sound_rationales') > 3 then return 'key'; end if;
  if not kafaa_air_int(k -> 'pass_pct', 50, 95) then return 'pass'; end if;
  v_all := lower(jsonb_build_array(p -> 'title_en', p -> 'summary_en', p -> 'scenario_en', p -> 'system_en',
    coalesce((select jsonb_agg(e -> 'name_en') from jsonb_array_elements(kafaa_smr_arr(se -> 'signals')) e), '[]'::jsonb), p -> 'components', p -> 'modes', p -> 'checks', p -> 'actions', p -> 'rationales')::text);
  if exists (select 1 from unnest(array['vital area', 'protected area', 'security plan', 'guard force', 'design basis threat', 'safeguards', 'physical protection', 'alarm station', 'access code',
     'firewall rule', 'network diagram', 'ip address']) w where strpos(v_all, w) > 0) then return 'restricted'; end if;
  return null;
end $$;
-- Training view of drill results (mirror of twinStats with MIN_GROUP_SIZE 10): latest attempt per person and drill.
create or replace function kafaa_tw_stats_core() returns jsonb language sql stable security definer set search_path = public as $$
  with lt as (select distinct on (person_id, scenario_id) * from kafaa_twin_attempts order by person_id, scenario_id, submitted_at desc, id collate "C" desc),
  ids as (select id from kafaa_twin_scenarios where status <> 'retired')
  select jsonb_build_object(
    'attempts', (select count(*)::integer from kafaa_twin_attempts),
    'people', (select case when count(distinct person_id) >= 10 then count(distinct person_id)::integer else null end from lt),
    'scenarios', coalesce((select jsonb_agg(jsonb_build_object('scenario_id', s.id,
        'attempts', case when g.n >= 10 then (select count(*)::integer from kafaa_twin_attempts a where a.scenario_id = s.id) else null end,
        'people', case when g.n >= 10 then g.n else null end,
        'pass_pct', case when g.n >= 10 then floor((100.0::float8 * g.passed / g.n) * 10 + 0.5) / 10 else null end,
        'avg_pct', case when g.n >= 10 then floor((g.sum_pct::float8 / g.n) * 10 + 0.5) / 10 else null end,
        'misdiagnosed_pct', case when g.n >= 10 then floor((100.0::float8 * g.wrong / g.n) * 10 + 0.5) / 10 else null end) order by s.id collate "C")
      from ids s cross join lateral (
        select count(*)::integer n, count(*) filter (where lt.passed)::integer passed, coalesce(sum(lt.pct), 0)::integer sum_pct,
               count(*) filter (where lt.component_id is distinct from (select k.component_id from kafaa_twin_keys k where k.scenario_id = s.id))::integer wrong
        from lt where lt.scenario_id = s.id) g), '[]'::jsonb))
$$;

-- ───────────── RPC: submit a digital-twin drill (skills_profile Own): scored server-side; a pass writes F01 assessment evidence <= L2
create or replace function kafaa_submit_twin_drill(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_sid text := coalesce(p ->> 'scenario_id', ''); sc kafaa_twin_scenarios; k kafaa_twin_keys; v_problem text; s jsonb; v_key jsonb; v_no integer;
  v_aid text; v_ev jsonb; v_passed boolean; v_level integer; a kafaa_audit_events; l integer; sk text;
begin
  if me is null then return kafaa_refuse('twin.drill.submit', 'twin_attempts', nullif(v_sid, ''), 'not_signed_in', 'Sign in to take a digital-twin drill'); end if;
  if not kafaa_has_grant('skills_profile', array['Own']) then return kafaa_refuse('twin.drill.submit', 'twin_attempts', nullif(v_sid, ''), 'forbidden', 'Digital-twin drills are for ENEC staff'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  select * into sc from kafaa_twin_scenarios where id = v_sid;
  select * into k from kafaa_twin_keys where scenario_id = v_sid limit 1;
  if sc.id is null or k.id is null then return kafaa_refuse('twin.drill.submit', 'twin_attempts', nullif(v_sid, ''), 'not_found', 'Drill not found', v_role); end if;
  if sc.status <> 'published' then return kafaa_refuse('twin.drill.submit', 'twin_attempts', v_sid, 'invalid', 'This drill is not open', v_role); end if;
  v_problem := kafaa_tw_sub_problem(jsonb_build_object('components', sc.components, 'modes', sc.modes, 'checks', sc.checks, 'actions', sc.actions, 'rationales', sc.rationales, 'max_checks', sc.max_checks), p);
  if v_problem is not null then
    return kafaa_refuse('twin.drill.submit', 'twin_attempts', v_sid, 'invalid', 'Check your answers: ' || case v_problem when 'shape' then 'checks and rationales are required'
      when 'checks' then 'choose checks from the list, each once' when 'too_many' then 'you can run only the number of checks shown' when 'component' then 'name the degrading component'
      when 'mode' then 'name the failure mode' when 'action' then 'choose an action' else 'pick one to three rationales' end, v_role);
  end if;
  v_key := jsonb_build_object('component_id', k.component_id, 'mode_id', k.mode_id, 'useful_checks', to_jsonb(k.useful_checks), 'unsafe_checks', to_jsonb(k.unsafe_checks),
    'conservative_actions', to_jsonb(k.conservative_actions), 'best_action', k.best_action, 'unsafe_actions', to_jsonb(k.unsafe_actions), 'sound_rationales', to_jsonb(k.sound_rationales), 'pass_pct', k.pass_pct);
  s := kafaa_tw_score(v_key, p, sc.level);
  v_passed := (s ->> 'passed')::boolean; v_level := (s ->> 'level')::integer;
  select count(*)::integer + 1 into v_no from kafaa_twin_attempts where person_id = me and scenario_id = v_sid;
  v_aid := 'ta-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
  v_ev := case when v_passed then (select coalesce(jsonb_agg(jsonb_build_object('skill_id', x, 'level', v_level) order by n), '[]'::jsonb) from unnest(sc.skill_ids) with ordinality q(x, n)) else '[]'::jsonb end;
  -- the latest attempt on a drill replaces earlier evidence from the same drill (kept, inactive)
  update kafaa_skill_evidence set active = false where person_id = me and ref_table = 'twin_attempts' and active
    and ref_id in (select x.id from kafaa_twin_attempts x where x.person_id = me and x.scenario_id = v_sid);
  insert into kafaa_twin_attempts (id, person_id, scenario_id, scenario_version, attempt_no, checks, component_id, mode_id, action_id, rationale_ids, points, max_points, pct, critical_ok,
    passed, level, feedback, reasons, evidence, submitted_at)
  values (v_aid, me, v_sid, sc.version, v_no, kafaa_tw_uniq(p -> 'checks'), p ->> 'component_id', p ->> 'mode_id', p ->> 'action_id', kafaa_tw_uniq(p -> 'rationale_ids'),
    (s ->> 'points')::integer, (s ->> 'max')::integer, (s ->> 'pct')::integer, (s ->> 'critical_ok')::boolean, v_passed, v_level, s -> 'feedback', s -> 'reasons', v_ev, now());
  if v_passed then
    foreach sk in array sc.skill_ids loop
      insert into kafaa_skill_evidence (id, person_id, skill_id, kind, ref_table, ref_id, level, basis, status, observed_on, note, recorded_by, active)
      values ('se:assessment:' || v_aid || ':' || sk, me, sk, 'assessment', 'twin_attempts', v_aid, v_level, 'evidenced', 'current', current_date, 'Digital-twin drill ' || v_sid, me, true)
      on conflict (id) do nothing;
    end loop;
  end if;
  perform kafaa_skills_apply(me, current_date);
  if v_passed then l := kafaa_ledger('kafaa.twin.drill', 'Digital-twin drill ' || v_sid || ': passed at level ' || v_level); end if;
  a := kafaa_audit('twin.drill.submit', 'twin_attempts', v_aid, 'ok', v_sid || ' ' || (s ->> 'pct') || '% ' || case when v_passed then 'pass L' || v_level else 'not yet' end,
    case when not v_passed then 'not_applicable' when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when v_passed then 'Drill passed' else 'Drill submitted' end, a, l,
    s || jsonb_build_object('attempt_id', v_aid, 'scenario_id', v_sid, 'attempt_no', v_no, 'pass_pct', k.pass_pct, 'explain', k.explain, 'evidence', v_ev));
end $$;

-- ───────────── RPC: drill results for training (secure_items W/A or skills_profile Agg; suppressed under 10)
create or replace function kafaa_twin_stats() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if kafaa_me() is null then return null; end if;
  if not (kafaa_has_grant('secure_items', array['W', 'A']) or kafaa_has_grant('skills_profile', array['Agg'])) then return null; end if;
  return kafaa_tw_stats_core();
end $$;

-- ───────────── RPC: add, edit or retire a drill with its key (training manager: secure_items A)
create or replace function kafaa_save_twin_scenario(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_given text := nullif(coalesce(p ->> 'id', ''), ''); cur kafaa_twin_scenarios; v_problem text; v_id text; v_version integer; a kafaa_audit_events;
  k jsonb := p -> 'key';
begin
  if me is null then return kafaa_refuse('twin.drill.save', 'twin_scenarios', v_given, 'not_signed_in', 'Sign in to take a digital-twin drill'); end if;
  if not kafaa_has_grant('secure_items', array['A']) then return kafaa_refuse('twin.drill.save', 'twin_scenarios', v_given, 'forbidden', 'Only the training manager edits digital-twin drills'); end if;
  v_role := kafaa_acting_role('secure_items', array['A']);
  if v_given is not null then
    select * into cur from kafaa_twin_scenarios where id = v_given;
    if cur.id is null then return kafaa_refuse('twin.drill.save', 'twin_scenarios', v_given, 'not_found', 'Drill not found', v_role); end if;
  end if;
  v_problem := kafaa_tw_problem(p, array['sk-fs-ai-twin', 'sk-fs-ai-plantdata', 'sk-fs-ai-anomaly', 'sk-fs-dp-dic', 'sk-fs-ai-dataeng']);
  if v_problem is not null then
    return kafaa_refuse('twin.drill.save', 'twin_scenarios', v_given, 'invalid', 'Check the drill: ' || case v_problem
      when 'texts' then 'title, summary, scenario and system name in English and Arabic' when 'synthetic' then 'drills must be synthetic (code SYN-TW-000)'
      when 'difficulty' then 'difficulty must be 1, 2 or 3' when 'level' then 'the evidence level must be 1 or 2' when 'skill' then 'one to three twin or plant-data skills'
      when 'status' then 'choose draft, published or retired' when 'minutes' then 'an estimate from 5 to 40 minutes'
      when 'series' then '2 to 6 signals with 6 to 48 points each and an expected band' when 'components' then '3 to 6 components in both languages'
      when 'modes' then '2 to 5 failure modes in both languages' when 'checks' then '3 to 8 checks with time and a result in both languages'
      when 'max_checks' then 'a check budget from 1 to the number of checks' when 'actions' then '3 to 5 actions in both languages' when 'rationales' then '3 to 6 rationales in both languages'
      when 'key' then 'a key naming the component, mode, useful checks, conservative actions (best among them) and sound rationales'
      when 'pass' then 'a pass mark from 50 to 95' else 'drills never touch plant security' end, v_role);
  end if;
  if exists (select 1 from kafaa_twin_scenarios s where s.code = p ->> 'code' and s.id is distinct from cur.id) then
    return kafaa_refuse('twin.drill.save', 'twin_scenarios', v_given, 'conflict', 'Another drill already uses this code', v_role); end if;
  v_id := coalesce(cur.id, 'tw-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  v_version := coalesce(cur.version + 1, 1);
  if cur.id is not null then
    update kafaa_twin_scenarios set code = p ->> 'code', title_en = btrim(p ->> 'title_en', E' \t\n\r'), title_ar = btrim(p ->> 'title_ar', E' \t\n\r'), summary_en = btrim(p ->> 'summary_en', E' \t\n\r'),
      summary_ar = btrim(p ->> 'summary_ar', E' \t\n\r'), scenario_en = btrim(p ->> 'scenario_en', E' \t\n\r'), scenario_ar = btrim(p ->> 'scenario_ar', E' \t\n\r'),
      system_en = btrim(p ->> 'system_en', E' \t\n\r'), system_ar = btrim(p ->> 'system_ar', E' \t\n\r'), difficulty = (p ->> 'difficulty')::integer, level = (p ->> 'level')::integer,
      skill_ids = array(select jsonb_array_elements_text(p -> 'skill_ids')), series = p -> 'series', components = p -> 'components', modes = p -> 'modes', checks = p -> 'checks',
      actions = p -> 'actions', rationales = p -> 'rationales', max_checks = (p ->> 'max_checks')::integer, est_minutes = (p ->> 'est_minutes')::integer, synthetic = true,
      status = p ->> 'status', listed = p ->> 'status' = 'published', version = v_version, updated_by = me, updated_at = now() where id = v_id;
  else
    insert into kafaa_twin_scenarios (id, code, title_en, title_ar, summary_en, summary_ar, scenario_en, scenario_ar, system_en, system_ar, difficulty, level, skill_ids, series, components, modes,
      checks, actions, rationales, max_checks, est_minutes, synthetic, sources, status, listed, version, sort, updated_by, updated_at)
    values (v_id, p ->> 'code', btrim(p ->> 'title_en', E' \t\n\r'), btrim(p ->> 'title_ar', E' \t\n\r'), btrim(p ->> 'summary_en', E' \t\n\r'), btrim(p ->> 'summary_ar', E' \t\n\r'),
      btrim(p ->> 'scenario_en', E' \t\n\r'), btrim(p ->> 'scenario_ar', E' \t\n\r'), btrim(p ->> 'system_en', E' \t\n\r'), btrim(p ->> 'system_ar', E' \t\n\r'),
      (p ->> 'difficulty')::integer, (p ->> 'level')::integer, array(select jsonb_array_elements_text(p -> 'skill_ids')), p -> 'series', p -> 'components', p -> 'modes', p -> 'checks',
      p -> 'actions', p -> 'rationales', (p ->> 'max_checks')::integer, (p ->> 'est_minutes')::integer, true, '[]'::jsonb, p ->> 'status', p ->> 'status' = 'published', 1,
      (select coalesce(max(sort), 0) + 1 from kafaa_twin_scenarios), me, now());
  end if;
  insert into kafaa_twin_keys (id, scenario_id, component_id, mode_id, useful_checks, unsafe_checks, conservative_actions, best_action, unsafe_actions, sound_rationales, explain, pass_pct)
  values ('twk-' || v_id, v_id, k ->> 'component_id', k ->> 'mode_id', array(select jsonb_array_elements_text(k -> 'useful_checks')), array(select jsonb_array_elements_text(k -> 'unsafe_checks')),
    array(select jsonb_array_elements_text(k -> 'conservative_actions')), k ->> 'best_action', array(select jsonb_array_elements_text(k -> 'unsafe_actions')),
    array(select jsonb_array_elements_text(k -> 'sound_rationales')), case when jsonb_typeof(k -> 'explain') = 'object' then k -> 'explain' else '{}'::jsonb end, (k ->> 'pass_pct')::integer)
  on conflict (id) do update set component_id = excluded.component_id, mode_id = excluded.mode_id, useful_checks = excluded.useful_checks, unsafe_checks = excluded.unsafe_checks,
    conservative_actions = excluded.conservative_actions, best_action = excluded.best_action, unsafe_actions = excluded.unsafe_actions, sound_rationales = excluded.sound_rationales,
    explain = excluded.explain, pass_pct = excluded.pass_pct;
  a := kafaa_audit('twin.drill.save', 'twin_scenarios', v_id, 'ok', 'v' || v_version || ' ' || (p ->> 'status'), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when cur.id is not null then 'Drill saved' else 'Drill added' end, a, null, jsonb_build_object('id', v_id, 'version', v_version, 'status', p ->> 'status'));
end $$;

-- ───────────── Grants: internal helpers are not executable by API roles; RPCs only by signed-in users.
revoke all on function kafaa_smr_arr(jsonb), kafaa_smr_alen(jsonb), kafaa_smr_truthy(jsonb), kafaa_smr_profile(text), kafaa_smr_needs(jsonb, jsonb), kafaa_smr_readiness(jsonb, text), kafaa_smr_matrix_core(), kafaa_smr_problem(jsonb, text),
  kafaa_pv_problem(jsonb, date), kafaa_pv_level(text, text, text, numeric), kafaa_pv_hosts(text), kafaa_pv_notify(text, text, text, text, text, text),
  kafaa_tw_uniq(jsonb), kafaa_tw_score(jsonb, jsonb, integer), kafaa_tw_sub_problem(jsonb, jsonb), kafaa_tw_opts(jsonb, integer, integer), kafaa_tw_sub(jsonb, jsonb),
  kafaa_tw_problem(jsonb, text[]), kafaa_tw_stats_core() from public, anon, authenticated;
revoke all on function kafaa_save_smr_delta(jsonb), kafaa_next_gen_matrix(), kafaa_plant_hosts(), kafaa_log_visit(jsonb), kafaa_confirm_visit(jsonb), kafaa_withdraw_visit(text),
  kafaa_submit_twin_drill(jsonb), kafaa_twin_stats(), kafaa_save_twin_scenario(jsonb) from public, anon;
grant execute on function kafaa_save_smr_delta(jsonb), kafaa_next_gen_matrix(), kafaa_plant_hosts(), kafaa_log_visit(jsonb), kafaa_confirm_visit(jsonb), kafaa_withdraw_visit(text),
  kafaa_submit_twin_drill(jsonb), kafaa_twin_stats(), kafaa_save_twin_scenario(jsonb) to authenticated;
