-- kafaa_fs53_lectures_localisation_p2 (2/2) · from supabase/migrations/20261010253001_kafaa_fs53_lectures_localisation.sql
-- Apply with apply_migration name "kafaa_fs53_lectures_localisation_p2". Additive and idempotent; kafaa_* objects only.
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

-- ───────────── FS45 RPCs
create or replace function kafaa_localisation_board() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); v_items jsonb; v_board jsonb; v_people boolean; v_out jsonb := '[]'::jsonb; bi jsonb; i kafaa_localisation_items; pg kafaa_programmes; o kafaa_organisations;
begin
  if me is null or not kafaa_has_grant('knowledge', array['R']) then return null; end if;
  v_items := kafaa_lz_items();
  v_board := kafaa_lz_compute(v_items, kafaa_lz_tracks(current_date), current_date);
  v_people := kafaa_has_grant('sat', array['R', 'W', 'A']);
  for bi in select e from jsonb_array_elements(v_board -> 'items') with ordinality q(e, n) order by n loop
    select * into i from kafaa_localisation_items where id = bi ->> 'id';
    select * into pg from kafaa_programmes where id = i.programme_id;
    select * into o from kafaa_organisations where id = i.partner_org_id;
    v_out := v_out || jsonb_build_array(jsonb_build_object('id', i.id, 'programme_id', i.programme_id, 'programme_code', pg.code, 'programme_en', coalesce(pg.name_en, ''), 'programme_ar', coalesce(pg.name_ar, ''),
      'title_en', i.title_en, 'title_ar', i.title_ar, 'scope', i.scope, 'partner_org_id', i.partner_org_id, 'partner_en', coalesce(o.name_en, ''), 'partner_ar', coalesce(o.name_ar, ''),
      'partner_role_en', i.partner_role_en, 'partner_role_ar', i.partner_role_ar, 'standard_ids', to_jsonb(i.standard_ids), 'discipline', i.discipline, 'instructors_needed', i.instructors_needed,
      'baseline_on', i.baseline_on::text, 'target_on', i.target_on::text, 'status', i.status, 'status_note', i.status_note, 'status_at', kafaa_kc_ts(i.status_at), 'history', i.history,
      'readiness', (bi -> 'readiness') - 'lines', 'risk', bi -> 'risk',
      'instructors', case when v_people then coalesce((select jsonb_agg(jsonb_build_object('track_id', l ->> 'track_id', 'person_id', l ->> 'person_id', 'name', coalesce(t.person_name, ''),
          'name_ar', coalesce(t.person_name_ar, ''), 'state', l ->> 'state', 'tenths', (l ->> 'tenths')::integer) order by n2)
        from jsonb_array_elements(bi -> 'readiness' -> 'lines') with ordinality q2(l, n2) left join kafaa_instructor_tracks t on t.id = l ->> 'track_id'), '[]'::jsonb) end));
  end loop;
  return jsonb_build_object('can_edit', kafaa_role_grant('training_manager', 'knowledge', 'W'), 'can_see_people', v_people, 'today', current_date::text, 'deadline', '2030-12-31',
    'items', v_out, 'summary', v_board -> 'summary');
end $$;

create or replace function kafaa_localisation_overdue() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); v_board jsonb;
begin
  if me is null or not kafaa_has_grant('knowledge', array['R']) then return null; end if;
  v_board := kafaa_lz_compute(kafaa_lz_items(), kafaa_lz_tracks(current_date), current_date);
  return jsonb_build_object('today', current_date::text, 'items', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'title_en', i.title_en, 'title_ar', i.title_ar,
      'partner_en', coalesce(o.name_en, ''), 'partner_ar', coalesce(o.name_ar, ''), 'programme_id', i.programme_id, 'target_on', i.target_on::text,
      'days_overdue', -((b -> 'risk' ->> 'days_left')::integer), 'pct', (b -> 'readiness' ->> 'pct')::integer, 'status', i.status)
      order by -((b -> 'risk' ->> 'days_left')::integer) desc, i.id collate "C")
    from jsonb_array_elements(v_board -> 'items') b join kafaa_localisation_items i on i.id = b ->> 'id' left join kafaa_organisations o on o.id = i.partner_org_id
    where (b -> 'risk' ->> 'overdue')::boolean), '[]'::jsonb));
end $$;

create or replace function kafaa_set_localisation_status(p_id text, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text := 'training_manager'; i kafaa_localisation_items; v_item jsonb; r jsonb; v_code text; v_target text; v_note text; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('knowledge.localisation.status', 'localisation_items', p_id, 'not_signed_in', 'Sign in to see the localisation countdown'); end if;
  if not kafaa_role_grant('training_manager', 'knowledge', 'W') then return kafaa_refuse('knowledge.localisation.status', 'localisation_items', p_id, 'forbidden', 'Only the training manager sets localisation status'); end if;
  select * into i from kafaa_localisation_items where id = p_id;
  if i.id is null then return kafaa_refuse('knowledge.localisation.status', 'localisation_items', p_id, 'not_found', 'Localisation item not found', v_role); end if;
  select e into v_item from jsonb_array_elements(kafaa_lz_items()) e where e ->> 'id' = p_id;
  r := kafaa_lz_readiness(v_item, kafaa_lz_tracks(current_date));
  v_code := kafaa_lz_status_problem(v_item, coalesce(p, '{}'::jsonb), r);
  if v_code = 'status' then return kafaa_refuse('knowledge.localisation.status', 'localisation_items', p_id, 'invalid', 'Choose partner-led, co-delivery, UAE-led with partner sign-off, transferred or on hold', v_role); end if;
  if v_code = 'target' then return kafaa_refuse('knowledge.localisation.status', 'localisation_items', p_id, 'invalid', 'The target transfer date is a real date between the plan baseline and 31 Dec 2030', v_role); end if;
  if v_code = 'unchanged' then return kafaa_refuse('knowledge.localisation.status', 'localisation_items', p_id, 'invalid', 'Nothing to change: choose a different status or target date', v_role); end if;
  if v_code = 'note_long' then return kafaa_refuse('knowledge.localisation.status', 'localisation_items', p_id, 'invalid', 'Keep the note under 600 characters', v_role); end if;
  if v_code = 'note_required' then return kafaa_refuse('knowledge.localisation.status', 'localisation_items', p_id, 'note_required', 'Give a reason of at least 10 characters when you move the target date, put an item on hold or reopen a transferred item', v_role); end if;
  if v_code = 'not_ready' then return kafaa_refuse('knowledge.localisation.status', 'localisation_items', p_id, 'not_ready',
    format('Not yet: readiness is computed from the instructor pipeline, and fewer current in-house instructors cover this item than it needs (%s of %s)', r ->> 'ready_now', r ->> 'needed'), v_role); end if;
  v_target := coalesce(nullif(kafaa_lc_str(p -> 'target_on'), ''), i.target_on::text);
  v_note := kafaa_lc_str(p -> 'note');
  update kafaa_localisation_items set status = p ->> 'status', target_on = v_target::date, status_note = v_note, status_by = me, status_at = now(), updated_at = now(),
    history = history || jsonb_build_array(jsonb_build_object('at', kafaa_kc_ts(now()), 'by', me, 'status', p ->> 'status', 'target_on', v_target, 'note', nullif(v_note, '')))
  where id = p_id;
  l := kafaa_ledger('kafaa.localisation.status', format('Localisation item %s: %s -> %s, target %s (computed readiness %s%%, %s of %s in-house instructors current)', p_id, i.status, p ->> 'status', v_target, r ->> 'pct', r ->> 'ready_now', r ->> 'needed'));
  a := kafaa_audit('knowledge.localisation.status', 'localisation_items', p_id, 'ok', format('%s -> %s; target %s', i.status, p ->> 'status', v_target), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Localisation status updated', a, l, jsonb_build_object('status', p ->> 'status', 'target_on', v_target));
end $$;

-- ───────────── Grants: internal helpers are not executable by API roles; RPCs only by signed-in users.
revoke all on function kafaa_lc_len(jsonb), kafaa_lc_str(jsonb), kafaa_lc_list(jsonb), kafaa_lc_level(text), kafaa_lc_evidence_skills(text[]), kafaa_lc_resolve(jsonb, text), kafaa_lc_text(jsonb),
  kafaa_lc_problem(jsonb, text, text, date), kafaa_lc_decide_problem(kafaa_contributions, text, text, text, boolean, integer), kafaa_lc_reason(text, jsonb), kafaa_lc_reasons(text, integer, text, integer, boolean),
  kafaa_lc_source_published(kafaa_contributions), kafaa_lc_view(kafaa_contributions), kafaa_lc_open(text, text), kafaa_lc_validated(text),
  kafaa_lz_tracks(date), kafaa_lz_items(), kafaa_lz_reason(text, jsonb), kafaa_lz_readiness(jsonb, jsonb), kafaa_lz_risk(jsonb, jsonb, date), kafaa_lz_compute(jsonb, jsonb, date),
  kafaa_lz_status_problem(jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function kafaa_save_lecture(jsonb), kafaa_publish_lecture(text), kafaa_withdraw_lecture(text, text), kafaa_sync_contributions(), kafaa_contribution_queue(),
  kafaa_validate_contribution(text, text, text), kafaa_localisation_board(), kafaa_localisation_overdue(), kafaa_set_localisation_status(text, jsonb) from public, anon;
grant execute on function kafaa_save_lecture(jsonb), kafaa_publish_lecture(text), kafaa_withdraw_lecture(text, text), kafaa_sync_contributions(), kafaa_contribution_queue(),
  kafaa_validate_contribution(text, text, text), kafaa_localisation_board(), kafaa_localisation_overdue(), kafaa_set_localisation_status(text, jsonb) to authenticated;
