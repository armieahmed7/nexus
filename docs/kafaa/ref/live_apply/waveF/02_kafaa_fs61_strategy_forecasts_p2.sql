-- kafaa_fs61_strategy_forecasts_p2 (2/2) · from supabase/migrations/20261010261001_kafaa_fs61_strategy_forecasts.sql
-- Apply with apply_migration name "kafaa_fs61_strategy_forecasts_p2". Additive and idempotent; kafaa_* objects only.
-- FS50: the quarterly review (HR director; one per row and quarter; computed progress snapshot; audit + ledger always)
create or replace function kafaa_review_critical_skill(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; v_cid text := case when jsonb_typeof(p->'critical_skill_id') = 'string' then p->>'critical_skill_id' else '' end;
  cur kafaa_critical_skills; v_problem text; q text := kafaa_crs_quarter(current_date); v_rid text; v_prog jsonb; v_after text; v_staff integer; v_org integer; v_scale double precision;
  a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('critical.review', 'critical_skill_reviews', nullif(v_cid, ''), 'not_signed_in', 'Sign in to use the critical skills register'); end if;
  if not kafaa_has_grant('workforce_strategy', array['A']) then
    return kafaa_refuse('critical.review', 'critical_skill_reviews', nullif(v_cid, ''), 'forbidden', 'Only the HR director records the quarterly review'); end if;
  v_role := kafaa_acting_role('workforce_strategy', array['A']);
  select * into cur from kafaa_critical_skills where id = v_cid;
  if cur.id is null then return kafaa_refuse('critical.review', 'critical_skill_reviews', nullif(v_cid, ''), 'not_found', 'Register row not found', v_role); end if;
  if cur.status <> 'active' then return kafaa_refuse('critical.review', 'critical_skill_reviews', v_cid, 'not_active', 'Only an adopted critical skill is reviewed', v_role); end if;
  v_problem := kafaa_crs_review_problem(p, cur.decision);
  if v_problem is not null then
    return kafaa_refuse('critical.review', 'critical_skill_reviews', v_cid, 'invalid', 'Check the review: ' || case v_problem
      when 'rating' then 'choose met, on track, at risk or off track'
      when 'notes' then 'a note of 10 to 600 characters in English and in Arabic'
      when 'decision' then 'choose build, buy, borrow or bot'
      else 'a new decision needs a rationale of 20 to 600 characters in English and in Arabic' end, v_role);
  end if;
  v_rid := 'csr-' || v_cid || '-' || q;
  if exists (select 1 from kafaa_critical_skill_reviews where id = v_rid) then
    return kafaa_refuse('critical.review', 'critical_skill_reviews', v_cid, 'already_reviewed', 'This quarter''s review is already recorded', v_role); end if;
  select count(*)::integer into v_staff from kafaa_people pe where pe.kind = 'staff' and pe.status = 'active';
  select greatest(0, floor(w.value))::integer into v_org from kafaa_workforce_snapshots w
    where w.measure = 'headcount' and w.family_id is null and w.level is null and w.entity_id is null order by w.period collate "C" desc limit 1;
  v_scale := case when coalesce(v_org, 0) > 0 and v_staff > 0 then v_org::double precision / v_staff else 1 end;
  v_prog := kafaa_crs_progress(cur.target_level, cur.targets, kafaa_crs_held(cur.skill_id), v_scale, extract(year from current_date)::integer);
  v_after := case when jsonb_typeof(p->'decision') = 'string' and p->>'decision' <> '' then p->>'decision' else cur.decision end;
  insert into kafaa_critical_skill_reviews (id, critical_skill_id, quarter, rating, progress, note_en, note_ar, decision_before, decision_after, reviewed_by, reviewed_at)
  values (v_rid, v_cid, q, p->>'rating', v_prog, btrim(p->>'note_en', E' \t\n\r'), btrim(p->>'note_ar', E' \t\n\r'), cur.decision, v_after, me, now());
  if v_after <> cur.decision then
    update kafaa_critical_skills set decision = v_after, rationale_en = btrim(coalesce(p->>'rationale_en', ''), E' \t\n\r'), rationale_ar = btrim(coalesce(p->>'rationale_ar', ''), E' \t\n\r'),
      decision_history = coalesce(cur.decision_history, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('decision', cur.decision, 'rationale_en', cur.rationale_en, 'rationale_ar', cur.rationale_ar, 'until', current_date::text, 'by', me)),
      version = cur.version + 1, updated_by = me, updated_at = now() where id = v_cid;
  end if;
  l := kafaa_ledger('kafaa.workforce.critical_skill_review', 'Critical skill review ' || q || ': ' || cur.skill_id || ' ' || (p->>'rating'));
  a := kafaa_audit('critical.review', 'critical_skill_reviews', v_rid, 'ok', q || ' ' || (p->>'rating') || case when v_after <> cur.decision then ' decision ' || cur.decision || '->' || v_after else '' end,
    case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Quarterly review recorded', a, l, jsonb_build_object('id', v_rid, 'quarter', q, 'progress', v_prog));
end $$;

-- FS51: the live three-scenario forecast (workforce_strategy Agg/R/W/A). Read-only; refusals audited.
create or replace function kafaa_compute_skill_forecast(p_params jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_role text; r jsonb;
begin
  if kafaa_me() is null then return kafaa_refuse('forecast.compute', 'skill_forecasts', null, 'not_signed_in', 'Sign in to see skill forecasts'); end if;
  if not kafaa_has_grant('workforce_strategy', array['Agg', 'R', 'W', 'A']) then
    return kafaa_refuse('forecast.compute', 'skill_forecasts', null, 'forbidden', 'Skill forecasts are for HR, the training manager, admins and auditors'); end if;
  v_role := kafaa_acting_role('workforce_strategy', array['Agg', 'R', 'W', 'A']);
  r := kafaa_sf_for(p_params);
  if r->>'code' = 'invalid' then return kafaa_refuse('forecast.compute', 'skill_forecasts', null, 'invalid', 'An assumption is outside its range', v_role); end if;
  if r->>'code' = 'not_found' then return kafaa_refuse('forecast.compute', 'skill_forecasts', p_params->>'scenario_id', 'not_found', 'Staffing scenario not found', v_role); end if;
  return jsonb_build_object('ok', true, 'code', 'ok', 'message', 'Skill forecast (SIMULATED)', 'audit_seq', null, 'ledger_seq', null, 'data', r->'result');
end $$;

-- FS51: save a forecast version in the current annual cycle (HR analyst or HR director); an own draft may be updated in place
create or replace function kafaa_save_skill_forecast(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; v_given text := case when jsonb_typeof(p->'id') = 'string' and p->>'id' <> '' then p->>'id' end;
  v_nm text := case when jsonb_typeof(p->'name') = 'string' then btrim(p->>'name', E' \t\n\r') else '' end; v_name text; r jsonb; cur kafaa_skill_forecasts;
  v_cycle integer := extract(year from current_date)::integer; v_version integer; v_id text; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('forecast.save', 'skill_forecasts', v_given, 'not_signed_in', 'Sign in to see skill forecasts'); end if;
  if not kafaa_has_grant('workforce_strategy', array['W', 'A']) then return kafaa_refuse('forecast.save', 'skill_forecasts', v_given, 'forbidden', 'Only HR analysts and the HR director save forecast versions'); end if;
  v_role := kafaa_acting_role('workforce_strategy', array['W', 'A']);
  if char_length(v_nm) < 3 or char_length(v_nm) > 120 then return kafaa_refuse('forecast.save', 'skill_forecasts', v_given, 'invalid', 'A forecast version needs a name of 3 to 120 characters', v_role); end if;
  if jsonb_typeof(p->'scenario') is distinct from 'string' or not (p->>'scenario' = any(array['baseline', 'advance', 'accelerated'])) then
    return kafaa_refuse('forecast.save', 'skill_forecasts', v_given, 'invalid', 'Choose the scenario to plan against: baseline, ADVANCE or accelerated', v_role); end if;
  r := kafaa_sf_for(coalesce(p->'params', '{}'::jsonb));
  if r->>'code' = 'invalid' then return kafaa_refuse('forecast.save', 'skill_forecasts', v_given, 'invalid', 'An assumption is outside its range', v_role); end if;
  if r->>'code' = 'not_found' then return kafaa_refuse('forecast.save', 'skill_forecasts', v_given, 'not_found', 'Staffing scenario not found', v_role); end if;
  v_name := case when v_nm ~* 'simulated' then v_nm else v_nm || ' (SIMULATED)' end;
  if v_given is not null then
    select * into cur from kafaa_skill_forecasts where id = v_given;
    if cur.id is null or cur.created_by is distinct from me then return kafaa_refuse('forecast.save', 'skill_forecasts', v_given, 'not_found', 'Forecast version not found', v_role); end if;
    if cur.status <> 'draft' then return kafaa_refuse('forecast.save', 'skill_forecasts', v_given, 'released', 'A released version cannot be changed; save a new version', v_role); end if;
    update kafaa_skill_forecasts set name = v_name, scenario = p->>'scenario', params = r->'result'->'params', results = r->'result', basis = r->'result'->'basis', method = r->'result'->>'method', updated_at = now()
    where id = v_given;
    a := kafaa_audit('forecast.save', 'skill_forecasts', v_given, 'ok', v_name, 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Forecast version saved', a, null, jsonb_build_object('id', v_given, 'cycle', cur.cycle, 'version', cur.version, 'name', v_name));
  end if;
  select coalesce(max(version), 0) + 1 into v_version from kafaa_skill_forecasts where cycle = v_cycle;
  v_id := 'sf-' || v_cycle || '-v' || v_version;
  insert into kafaa_skill_forecasts (id, cycle, version, name, scenario, params, results, basis, method, status, summary_en, summary_ar, created_by, created_at, updated_at, simulated)
  values (v_id, v_cycle, v_version, v_name, p->>'scenario', r->'result'->'params', r->'result', r->'result'->'basis', r->'result'->>'method', 'draft', '', '', me, now(), now(), true);
  a := kafaa_audit('forecast.save', 'skill_forecasts', v_id, 'ok', v_name, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Forecast version saved', a, null, jsonb_build_object('id', v_id, 'cycle', v_cycle, 'version', v_version, 'name', v_name));
end $$;

-- FS51: the HR director releases a version (recomputed; clean summaries EN/AR; the version released earlier in the cycle is superseded; ledger)
create or replace function kafaa_release_skill_forecast(p_id text, p_summary_en text, p_summary_ar text) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; cur kafaa_skill_forecasts; v_en text := btrim(coalesce(p_summary_en, ''), E' \t\n\r'); v_ar text := btrim(coalesce(p_summary_ar, ''), E' \t\n\r');
  r jsonb; v_prev text; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('forecast.release', 'skill_forecasts', p_id, 'not_signed_in', 'Sign in to see skill forecasts'); end if;
  if not kafaa_has_grant('workforce_strategy', array['A']) then return kafaa_refuse('forecast.release', 'skill_forecasts', p_id, 'forbidden', 'Only the HR director releases a skill forecast'); end if;
  v_role := kafaa_acting_role('workforce_strategy', array['A']);
  select * into cur from kafaa_skill_forecasts where id = p_id;
  if cur.id is null then return kafaa_refuse('forecast.release', 'skill_forecasts', p_id, 'not_found', 'Forecast version not found', v_role); end if;
  if cur.status = 'released' then return kafaa_refuse('forecast.release', 'skill_forecasts', p_id, 'already_released', 'This version is already released', v_role); end if;
  if cur.status = 'superseded' then return kafaa_refuse('forecast.release', 'skill_forecasts', p_id, 'superseded', 'A superseded version cannot be released again', v_role); end if;
  if char_length(v_en) < 10 or char_length(v_en) > 600 or char_length(v_ar) < 10 or char_length(v_ar) > 600 then
    return kafaa_refuse('forecast.release', 'skill_forecasts', p_id, 'invalid', 'Write a summary of 10 to 600 characters in English and in Arabic', v_role); end if;
  if not kafaa_so_text_clean(array[cur.name, v_en, v_ar]) then
    return kafaa_refuse('forecast.release', 'skill_forecasts', p_id, 'not_clean', 'Release text may not state headcounts or site information (M11 rule)', v_role); end if;
  r := kafaa_sf_for(cur.params);
  if r->>'code' = 'invalid' then return kafaa_refuse('forecast.release', 'skill_forecasts', p_id, 'invalid', 'An assumption is outside its range', v_role); end if;
  if r->>'code' = 'not_found' then return kafaa_refuse('forecast.release', 'skill_forecasts', p_id, 'not_found', 'Staffing scenario not found', v_role); end if;
  select string_agg(id, ',' order by id collate "C") into v_prev from kafaa_skill_forecasts where status = 'released' and cycle = cur.cycle and id <> p_id;
  update kafaa_skill_forecasts set status = 'superseded', superseded_by = p_id, updated_at = now() where status = 'released' and cycle = cur.cycle and id <> p_id;
  update kafaa_skill_forecasts set status = 'released', summary_en = v_en, summary_ar = v_ar, results = r->'result', basis = r->'result'->'basis', method = r->'result'->>'method',
    released_by = me, released_at = now(), updated_at = now() where id = p_id;
  l := kafaa_ledger('kafaa.workforce.forecast_release', 'Skill forecast released: ' || cur.name);
  a := kafaa_audit('forecast.release', 'skill_forecasts', p_id, 'ok', cur.name || coalesce(' supersedes ' || v_prev, ''), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Forecast released', a, l, jsonb_build_object('id', p_id, 'superseded', v_prev));
end $$;

-- ───────────── Grants: internal helpers are not executable by API roles; the six RPCs only by signed-in users.
revoke all on function kafaa_sf_normalize(jsonb), kafaa_sf_needs(), kafaa_sf_base(text, text), kafaa_sf_survive(double precision, integer), kafaa_sf_project(jsonb, jsonb, jsonb, jsonb),
  kafaa_sf_compute(jsonb, jsonb), kafaa_sf_for(jsonb), kafaa_crs_problem(jsonb), kafaa_crs_quarter(date), kafaa_crs_quarter_end(text), kafaa_crs_prev_quarter(text), kafaa_crs_held(text),
  kafaa_crs_target_for(jsonb, integer), kafaa_crs_progress(integer, jsonb, integer[], double precision, integer), kafaa_crs_review_state(text, text, date, date), kafaa_crs_board_core(date),
  kafaa_crs_review_problem(jsonb, text) from public, anon, authenticated;
revoke all on function kafaa_critical_skill_board(), kafaa_save_critical_skill(jsonb), kafaa_review_critical_skill(jsonb), kafaa_compute_skill_forecast(jsonb),
  kafaa_save_skill_forecast(jsonb), kafaa_release_skill_forecast(text, text, text) from public, anon;
grant execute on function kafaa_critical_skill_board(), kafaa_save_critical_skill(jsonb), kafaa_review_critical_skill(jsonb), kafaa_compute_skill_forecast(jsonb),
  kafaa_save_skill_forecast(jsonb), kafaa_release_skill_forecast(text, text, text) to authenticated;
