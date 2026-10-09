-- [W4 QA · integration] Cross-feature wiring of wave 4 on master. Additive and idempotent: kafaa_* functions and one kafaa_* trigger;
-- never alters NEXUS objects and never removes any object or row.
--   1. F28 -> F30: simulator crew debriefs emit xAPI statements (source f28_simulator), one per crew member marked present.
--      TS mirror: src/modules/m27/xapi.ts draftFor('f28_simulator') + installLrsEmitters (crew_debriefs insert). The debrief row is
--      written after its member rows (kafaa_record_debrief), so the trigger sits on kafaa_crew_debriefs and reads the members.
--   2. F31 -> F26: the training needs report counts the qualified F31 instructor pool (kafaa_instructor_tracks, status qualified)
--      instead of instructor role holders. TS mirror: src/modules/m25/backend/local.ts demandReport.

-- ───────────── 1. F28 simulator debrief emitter
create or replace function kafaa_xapi_d_simulator(r kafaa_crew_debrief_members, p_stored timestamptz) returns kafaa_xapi_statements language plpgsql stable security definer set search_path = public as $$
declare d kafaa_crew_debriefs; sc kafaa_sim_scenarios; v_sum numeric;
begin
  if r.present is distinct from true then return null; end if;
  select * into d from kafaa_crew_debriefs where id = r.debrief_id;
  if not found then return null; end if;
  select coalesce(sum(case when jsonb_typeof(d.ratings -> k) = 'number' then (d.ratings ->> k)::numeric else 0 end), 0) into v_sum
    from unnest(array['communication', 'procedure_use', 'diagnosis', 'leadership']) k;
  if v_sum < 4 then return null; end if;
  select * into sc from kafaa_sim_scenarios where id = r.scenario_id;
  return kafaa_xapi_make('f28_simulator', r.id, r.person_id, 'completed', 'scenario', r.scenario_id, kafaa_xapi_titled(sc.title_en, sc.title_ar, r.scenario_id),
    jsonb_build_object('completion', true, 'success', v_sum >= 12,
      'score', jsonb_build_object('scaled', trim_scale(v_sum / 20), 'raw', trim_scale(v_sum / 4), 'min', 1, 'max', 5)),
    jsonb_build_object('extensions', jsonb_build_object('https://kafaa.example/xapi/ext/record', 'crew_debrief_members/' || r.id,
      'https://kafaa.example/xapi/ext/crew', r.crew, 'https://kafaa.example/xapi/ext/crew-position', r.position)),
    kafaa_xapi_noon(r.held_on), p_stored);
end $$;

create or replace function kafaa_xapi_source_rows() returns setof kafaa_xapi_statements language plpgsql stable security definer set search_path = public as $$
begin
  return query select s.* from kafaa_training_records t cross join lateral kafaa_xapi_d_course(t, null) s where s.id is not null;
  return query select s.* from kafaa_refresh_state t cross join lateral kafaa_xapi_d_refresher(t, null) s where t.attempts > 0 and s.id is not null;
  return query select s.* from kafaa_opportunity_applications t cross join lateral kafaa_xapi_d_opportunity(t, null) s where t.status = 'completed' and s.id is not null;
  return query select s.* from kafaa_rotation_placements t cross join lateral kafaa_xapi_d_rotation(t, null) s where t.status = 'signed_off' and s.id is not null;
  return query select s.* from kafaa_shadow_requests t cross join lateral kafaa_xapi_d_shadowing(t, null) s where t.status = 'completed' and s.id is not null;
  return query select s.* from kafaa_jpm_results t cross join lateral kafaa_xapi_d_jpm(t, null) s where s.id is not null;
  return query select s.* from kafaa_mentoring_sessions t cross join lateral kafaa_xapi_d_mentoring(t, null) s where s.id is not null;
  return query select s.* from kafaa_asset_uses t cross join lateral kafaa_xapi_d_asset(t, null) s where s.id is not null;
  return query select s.* from kafaa_crew_debrief_members t cross join lateral kafaa_xapi_d_simulator(t, null) s where t.present and s.id is not null;
end $$;

create or replace function kafaa_xapi_on_source() returns trigger language plpgsql security definer set search_path = public as $$
declare s kafaa_xapi_statements; m kafaa_crew_debrief_members;
begin
  if coalesce(current_setting('kafaa.seeding', true), '') = 'on' then return new; end if;
  begin
    case tg_table_name
      when 'kafaa_training_records' then s := kafaa_xapi_d_course(new, now());
      when 'kafaa_refresh_state' then s := kafaa_xapi_d_refresher(new, now());
      when 'kafaa_opportunity_applications' then s := kafaa_xapi_d_opportunity(new, now());
      when 'kafaa_rotation_placements' then s := kafaa_xapi_d_rotation(new, now());
      when 'kafaa_shadow_requests' then s := kafaa_xapi_d_shadowing(new, now());
      when 'kafaa_jpm_results' then s := kafaa_xapi_d_jpm(new, now());
      when 'kafaa_mentoring_sessions' then s := kafaa_xapi_d_mentoring(new, now());
      when 'kafaa_asset_uses' then s := kafaa_xapi_d_asset(new, now());
      when 'kafaa_crew_debriefs' then
        for m in select * from kafaa_crew_debrief_members x where x.debrief_id = new.id and x.present order by x.id collate "C" loop
          perform kafaa_xapi_emit(kafaa_xapi_d_simulator(m, now()));
        end loop;
        s := null;
      else s := null;
    end case;
    perform kafaa_xapi_emit(s);
  exception when others then
    raise warning 'Kafa''a LRS emitter skipped on %: %', tg_table_name, sqlerrm;
  end;
  return new;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'kafaa_xapi_emit_crew_debriefs') then
    execute 'create trigger kafaa_xapi_emit_crew_debriefs after insert on kafaa_crew_debriefs for each row execute function kafaa_xapi_on_source()'; end if;
end $$;

revoke execute on function kafaa_xapi_d_simulator(kafaa_crew_debrief_members, timestamptz), kafaa_xapi_source_rows(), kafaa_xapi_on_source() from public, anon, authenticated;

-- ───────────── 2. F26 report: instructor capacity from the F31 qualified pool
create or replace function kafaa_demand_report(p_period text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_p text;
begin
  if me is null then return kafaa_refuse('needs.report', 'demand_snapshots', p_period, 'not_signed_in', 'Sign in first'); end if;
  if not kafaa_has_grant('learning_analytics', array['Agg', 'R', 'A']) then
    return kafaa_refuse('needs.report', 'demand_snapshots', p_period, 'forbidden', 'The training needs forecast is for training staff, managers and HR'); end if;
  v_p := coalesce(nullif(p_period, ''), kafaa_dm_quarter(current_date));
  if not (v_p = any(kafaa_dm_periods(current_date))) then return kafaa_refuse('needs.report', 'demand_snapshots', v_p, 'invalid', 'Choose the current quarter or one of the next three'); end if;
  return jsonb_build_object('ok', true, 'code', 'ok', 'message', 'Training needs', 'audit_seq', null, 'ledger_seq', null,
    'data', kafaa_dm_report(v_p, kafaa_has_grant('learning_analytics', array['R', 'A']))
            || jsonb_build_object('periods', to_jsonb(kafaa_dm_periods(current_date)), 'can_compute', kafaa_has_grant('learning_analytics', array['A']),
                                  'instructors', (select count(distinct t.person_id) from kafaa_instructor_tracks t where t.status = 'qualified')));
end $$;
revoke execute on function kafaa_demand_report(text) from public, anon;
grant execute on function kafaa_demand_report(text) to authenticated;
