-- kafaa_fs74_university_alignment_p2 (2/2) · from supabase/migrations/20261010274001_kafaa_fs74_university_alignment.sql
-- Apply with apply_migration name "kafaa_fs74_university_alignment_p2". Additive and idempotent; kafaa_* objects only.
-- ───────────── FS67 RPCs
create or replace function kafaa_save_fellowship(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_code text; v_id text; f kafaa_people; s kafaa_people; v_uni text; v_at timestamptz := date_trunc('second', now()); n integer; a kafaa_audit_events; l integer;
begin
  p := coalesce(p, '{}'::jsonb);
  if me is null then return kafaa_refuse('fellowship.award', 'fellowships', null, 'not_signed_in', 'Sign in first'); end if;
  v_role := kafaa_acting_role('ecosystem', array['A']);
  if v_role is null then return kafaa_refuse('fellowship.award', 'fellowships', null, 'forbidden', 'Only HR (the HR director) or a platform admin can do this'); end if;
  v_code := kafaa_fw_problem(p);
  if v_code = 'duplicate' then return kafaa_refuse('fellowship.award', 'fellowships', 'fw-' || left(p ->> 'starts_on', 4) || '-' || (p ->> 'fellow_person_id'), 'duplicate', 'This fellow already has a fellowship starting that year', v_role); end if;
  if v_code is not null then return kafaa_refuse('fellowship.award', 'fellowships', null, 'invalid', case v_code
    when 'kind' then 'Choose a NEST-style fellowship or sponsored study with placement'
    when 'title' then 'Give the title in English and Arabic (3 to 160 characters each)'
    when 'fellow' then 'Choose the fellow (an applicant or a member of staff)'
    when 'university' then 'Sponsored study needs the host university; a fellowship names a university only if one is involved'
    when 'host' then 'Name a published research challenge or an ADVANCE technology study as the host project'
    when 'supervisor' then 'The supervisor must be an active ENEC role card, not the fellow'
    when 'dates' then 'The planned span is 90 days to four years (end after start)'
    when 'placement' then 'Describe the placement (up to 300 characters in each language; sponsored study needs it)'
    else 'ADVANCE text must not carry headcounts or site wording (no deployment decision implied)' end, v_role); end if;
  select * into f from kafaa_people where id = p ->> 'fellow_person_id';
  select * into s from kafaa_people where id = p ->> 'supervisor_person_id';
  v_id := 'fw-' || left(p ->> 'starts_on', 4) || '-' || f.id;
  v_uni := case when jsonb_typeof(p -> 'university_org_id') = 'string' and p ->> 'university_org_id' <> '' then p ->> 'university_org_id' end;
  insert into kafaa_fellowships (id, kind, title_en, title_ar, fellow_person_id, fellow_initials, university_org_id, host_kind, host_ref, supervisor_person_id, supervisor_name_en, supervisor_name_ar,
    starts_on, ends_on, placement_en, placement_ar, status, completed_on, withdrawn_on, withdraw_reason, sample, created_by, created_at, updated_at)
  values (v_id, p ->> 'kind', kafaa_ua_trim(p ->> 'title_en'), kafaa_ua_trim(p ->> 'title_ar'), f.id, coalesce(f.initials, ''), v_uni, p ->> 'host_kind', p ->> 'host_ref', s.id,
    coalesce(s.display_name, ''), coalesce(nullif(s.display_name_ar, ''), s.display_name, ''), (p ->> 'starts_on')::date, (p ->> 'ends_on')::date,
    kafaa_ua_trim(case when jsonb_typeof(p -> 'placement_en') = 'string' then p ->> 'placement_en' end), kafaa_ua_trim(case when jsonb_typeof(p -> 'placement_ar') = 'string' then p ->> 'placement_ar' end),
    'active', null, null, null, false, me, v_at, v_at);
  insert into kafaa_fellowship_milestones (id, fellowship_id, fellow_person_id, university_org_id, supervisor_person_id, n, kind, owner, required, due_on, status, submitted_by, submitted_at, note, signed_by, signed_at, return_note, updated_at)
  select x.id, v_id, f.id, v_uni, s.id, x.n, x.kind, x.owner, true, x.due_on, 'planned', null, null, '', null, null, null, v_at from kafaa_fw_plan(v_id, p ->> 'kind', (p ->> 'starts_on')::date, (p ->> 'ends_on')::date) x;
  get diagnostics n = row_count;
  l := kafaa_ledger('kafaa.fellowship.award', format('Fellowship %s (%s) hosted by %s %s, supervised by %s, %s to %s', v_id, p ->> 'kind', p ->> 'host_kind', p ->> 'host_ref', s.id, p ->> 'starts_on', p ->> 'ends_on'));
  a := kafaa_audit('fellowship.award', 'fellowships', v_id, 'ok', (p ->> 'kind') || ' ' || (p ->> 'host_kind') || ':' || (p ->> 'host_ref'), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Fellowship awarded with five milestones', a, l, jsonb_build_object('id', v_id, 'milestones', n));
end $$;

create or replace function kafaa_update_milestone(p_id text, p_action text, p_note text default '') returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); m kafaa_fellowship_milestones; w kafaa_fellowships; v_hr boolean; v_uni text; v_role text; v_code text; v_at timestamptz := date_trunc('second', now()); v_note text := kafaa_ua_trim(p_note);
  v_done boolean; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('fellowship.milestone', 'fellowship_milestones', p_id, 'not_signed_in', 'Sign in first'); end if;
  select * into m from kafaa_fellowship_milestones where id = p_id;
  if m.id is not null then select * into w from kafaa_fellowships where id = m.fellowship_id; end if;
  v_hr := kafaa_has_grant('ecosystem', array['A']);
  v_uni := case when kafaa_has_grant('ecosystem', array['OrgW']) then kafaa_my_org() end;
  v_role := case when p_action = 'submit' then case when w.id is not null and me = w.fellow_person_id then null else kafaa_acting_role('ecosystem', array['OrgW']) end
                 else case when w.id is not null and me = w.supervisor_person_id then null else kafaa_acting_role('ecosystem', array['A']) end end;
  v_code := kafaa_fw_ms_problem(p_action, m, w, me, v_hr, v_uni, p_note);
  if v_code = 'not_found' then return kafaa_refuse('fellowship.milestone', 'fellowship_milestones', p_id, 'not_found', 'Fellowship or milestone not found', v_role); end if;
  if v_code = 'forbidden' then return kafaa_refuse('fellowship.milestone', 'fellowship_milestones', p_id, 'forbidden', 'You cannot act on this milestone', v_role); end if;
  if v_code = 'maker_checker' then return kafaa_refuse('fellowship.milestone', 'fellowship_milestones', p_id, 'maker_checker', 'The person who submitted a milestone cannot sign it off', v_role); end if;
  if v_code is not null then return kafaa_refuse('fellowship.milestone', 'fellowship_milestones', p_id, 'invalid', case v_code
    when 'closed' then 'The fellowship is no longer active' when 'note' then 'Give a note of 5 to 500 characters' else 'The milestone is not in a state that allows this action' end, v_role); end if;
  if p_action = 'submit' then
    update kafaa_fellowship_milestones set status = 'submitted', submitted_by = me, submitted_at = v_at, note = v_note, return_note = null, updated_at = v_at where id = p_id;
    perform kafaa_ua_notify('nt-fw-' || p_id || '-submitted', w.supervisor_person_id, 'Milestone to sign off: ' || w.title_en, 'مرحلة بانتظار الاعتماد: ' || w.title_ar, '/universities/fellowships/' || w.id, 'info');
    a := kafaa_audit('fellowship.milestone', 'fellowship_milestones', p_id, 'ok', 'submitted ' || m.kind, 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Milestone submitted to the supervisor', a, null, jsonb_build_object('id', p_id, 'status', 'submitted', 'fellowship_status', w.status));
  end if;
  if p_action = 'return' then
    update kafaa_fellowship_milestones set status = 'planned', submitted_by = null, submitted_at = null, return_note = v_note, updated_at = v_at where id = p_id;
    a := kafaa_audit('fellowship.milestone', 'fellowship_milestones', p_id, 'ok', 'returned ' || m.kind, 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Milestone returned with a note', a, null, jsonb_build_object('id', p_id, 'status', 'planned', 'fellowship_status', w.status));
  end if;
  update kafaa_fellowship_milestones set status = 'signed_off', signed_by = me, signed_at = v_at, updated_at = v_at where id = p_id;
  v_done := exists (select 1 from kafaa_fellowship_milestones x where x.fellowship_id = w.id and x.required is not false)
    and not exists (select 1 from kafaa_fellowship_milestones x where x.fellowship_id = w.id and x.required is not false and x.status <> 'signed_off');
  if v_done then update kafaa_fellowships set status = 'completed', completed_on = current_date, updated_at = v_at where id = w.id; end if;
  l := kafaa_ledger('kafaa.fellowship.milestone', format('Fellowship %s: milestone %s (%s) signed off%s', w.id, m.n, m.kind, case when v_done then '; every required milestone is signed off, the fellowship is complete' else '' end));
  a := kafaa_audit('fellowship.milestone', 'fellowship_milestones', p_id, 'ok', 'signed off ' || m.kind || case when v_done then ' (fellowship complete)' else '' end, case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when v_done then 'Milestone signed off; the fellowship is complete' else 'Milestone signed off' end, a, l,
    jsonb_build_object('id', p_id, 'status', 'signed_off', 'fellowship_status', case when v_done then 'completed' else w.status end));
end $$;

create or replace function kafaa_withdraw_fellowship(p_id text, p_reason text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; w kafaa_fellowships; v_r text := kafaa_ua_trim(p_reason); a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('fellowship.withdraw', 'fellowships', p_id, 'not_signed_in', 'Sign in first'); end if;
  v_role := kafaa_acting_role('ecosystem', array['A']);
  if v_role is null then return kafaa_refuse('fellowship.withdraw', 'fellowships', p_id, 'forbidden', 'Only HR (the HR director) or a platform admin can do this'); end if;
  select * into w from kafaa_fellowships where id = p_id;
  if w.id is null then return kafaa_refuse('fellowship.withdraw', 'fellowships', p_id, 'not_found', 'Fellowship or milestone not found', v_role); end if;
  if w.status <> 'active' then return kafaa_refuse('fellowship.withdraw', 'fellowships', p_id, 'invalid', 'The fellowship is no longer active', v_role); end if;
  if char_length(v_r) < 10 or char_length(v_r) > 300 then return kafaa_refuse('fellowship.withdraw', 'fellowships', p_id, 'invalid', 'Give the reason in 10 to 300 characters', v_role); end if;
  update kafaa_fellowships set status = 'withdrawn', withdrawn_on = current_date, withdraw_reason = v_r, updated_at = date_trunc('second', now()) where id = p_id;
  l := kafaa_ledger('kafaa.fellowship.withdraw', format('Fellowship %s withdrawn: %s', p_id, v_r));
  a := kafaa_audit('fellowship.withdraw', 'fellowships', p_id, 'ok', 'withdrawn', case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Fellowship withdrawn; it stays in the completion rate', a, l, jsonb_build_object('id', p_id));
end $$;

create or replace function kafaa_fellowship_stats() returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me();
begin
  if me is null then return kafaa_refuse('fellowship.stats', 'fellowships', null, 'not_signed_in', 'Sign in first'); end if;
  if not kafaa_has_grant('ecosystem', array['R', 'Agg', 'W', 'A']) then
    return kafaa_refuse('fellowship.stats', 'fellowships', null, 'forbidden', 'Fellowship results are shown to staff, partners and HR as aggregates'); end if;
  return jsonb_build_object('ok', true, 'code', 'ok', 'message', 'Fellowship completion', 'audit_seq', null, 'ledger_seq', null, 'data', kafaa_fw_stats(current_date));
end $$;

-- ───────────── Grants: internal helpers are not executable by API roles; RPCs only by signed-in users.
revoke all on function kafaa_ua_trim(text), kafaa_ua_len_ok(jsonb, integer, integer), kafaa_ua_taught(jsonb), kafaa_ua_coverage(jsonb, jsonb), kafaa_ua_auto(jsonb, jsonb), kafaa_ua_problem(jsonb),
  kafaa_ua_clean_skills(jsonb), kafaa_ua_decision_problem(jsonb, boolean, text, text, text, jsonb, date), kafaa_ua_grad_status(text, date, date, date),
  kafaa_ua_hire_problem(jsonb, kafaa_people, boolean, boolean, date), kafaa_ua_notify(text, text, text, text, text, text), kafaa_ua_write_evidence(text, text, date, text, text),
  kafaa_fw_plan(text, text, date, date), kafaa_fw_problem(jsonb), kafaa_fw_ms_problem(text, kafaa_fellowship_milestones, kafaa_fellowships, text, boolean, text, text),
  kafaa_fw_cell(text, integer, integer, integer), kafaa_fw_stats(date) from public, anon, authenticated;
revoke all on function kafaa_save_programme(jsonb), kafaa_endorse_programme(text, jsonb), kafaa_record_graduate_hire(jsonb), kafaa_save_fellowship(jsonb), kafaa_update_milestone(text, text, text),
  kafaa_withdraw_fellowship(text, text), kafaa_fellowship_stats() from public, anon;
grant execute on function kafaa_save_programme(jsonb), kafaa_endorse_programme(text, jsonb), kafaa_record_graduate_hire(jsonb), kafaa_save_fellowship(jsonb), kafaa_update_milestone(text, text, text),
  kafaa_withdraw_fellowship(text, text), kafaa_fellowship_stats() to authenticated;
