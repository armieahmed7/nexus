-- live apply part kafaa_fs53_lectures_localisation_p2 (from supabase/migrations/20261010253001_kafaa_fs53_lectures_localisation.sql, part 2 of 2)

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
