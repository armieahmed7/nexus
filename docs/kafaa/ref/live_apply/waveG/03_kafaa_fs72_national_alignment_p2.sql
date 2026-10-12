-- kafaa_fs72_national_alignment_p2 (2/2) · from supabase/migrations/20261010272001_kafaa_fs72_national_alignment.sql
-- Apply with apply_migration name "kafaa_fs72_national_alignment_p2". Additive and idempotent; kafaa_* objects only.
-- FS63: return a code to "pending review" with a reason (A); ledger
create or replace function kafaa_clear_occupation_code(p_role_id text, p_reason text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_id text := 'ro-' || coalesce(p_role_id, ''); cur kafaa_role_occupations; v_why text := btrim(coalesce(p_reason, ''), E' \t\n\r');
  v_version integer; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('national.occupation.clear', 'role_occupations', v_id, 'not_signed_in', 'Sign in to maintain occupation mappings'); end if;
  if not kafaa_has_grant('national_alignment', array['A']) then
    return kafaa_refuse('national.occupation.clear', 'role_occupations', v_id, 'forbidden', 'Only a platform admin records or clears a verified MoHRE code'); end if;
  v_role := kafaa_acting_role('national_alignment', array['A']);
  select * into cur from kafaa_role_occupations where id = v_id;
  if cur.id is null then return kafaa_refuse('national.occupation.clear', 'role_occupations', v_id, 'not_found', 'Role mapping not found', v_role); end if;
  if cur.code_status <> 'verified' then return kafaa_refuse('national.occupation.clear', 'role_occupations', v_id, 'not_verified', 'This mapping has no verified code', v_role); end if;
  if char_length(v_why) not between 10 and 300 then return kafaa_refuse('national.occupation.clear', 'role_occupations', v_id, 'invalid', 'Give a reason of 10 to 300 characters', v_role); end if;
  v_version := cur.version + 1;
  update kafaa_role_occupations set mohre_code = null, code_status = 'pending_review', code_source = null, verified_by = null, verified_on = null, version = v_version,
    history = coalesce(history, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('version', v_version, 'on', to_char(current_date, 'YYYY-MM-DD'), 'by', me, 'change', 'clear', 'reason', v_why))
  where id = v_id;
  l := kafaa_ledger('kafaa.national.occupation_code_clear', 'MoHRE code cleared for ' || coalesce(p_role_id, ''));
  a := kafaa_audit('national.occupation.clear', 'role_occupations', v_id, 'ok', 'cleared: ' || v_why, case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Code returned to pending review', a, l, jsonb_build_object('id', v_id));
end $$;

-- FS63: the SIMULATED uplift trend (national_alignment Agg/W/A); null otherwise
create or replace function kafaa_occupation_trend() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if kafaa_me() is null or not kafaa_has_grant('national_alignment', array['Agg', 'W', 'A']) then return null; end if;
  return kafaa_ro_trend_core(current_date);
end $$;

-- ───────────── Grants: internal helpers are not executable by API roles; the seven RPCs only by signed-in users.
revoke all on function kafaa_ro_guard(), kafaa_na_host(text), kafaa_na_tier(text), kafaa_na_typed_free(text[]), kafaa_na_len(jsonb, text, integer, integer), kafaa_na_str(jsonb, text),
  kafaa_na_tag_problem(jsonb, date), kafaa_na_target(text, text), kafaa_na_link_problem(jsonb, kafaa_national_tags, jsonb, boolean), kafaa_na_links(), kafaa_na_pct1(integer, integer),
  kafaa_na_sup(integer), kafaa_na_holders(text[], integer), kafaa_na_measure(text, text), kafaa_na_group_name(text), kafaa_na_report_core(jsonb, boolean),
  kafaa_ro_indicative(text), kafaa_ro_problem(jsonb), kafaa_ro_code_problem(jsonb, date), kafaa_ro_trend_core(date) from public, anon, authenticated;
revoke all on function kafaa_national_report(jsonb), kafaa_save_national_tag(jsonb), kafaa_set_tag_link(jsonb), kafaa_save_role_occupation(jsonb), kafaa_verify_occupation_code(jsonb),
  kafaa_clear_occupation_code(text, text), kafaa_occupation_trend() from public, anon;
grant execute on function kafaa_national_report(jsonb), kafaa_save_national_tag(jsonb), kafaa_set_tag_link(jsonb), kafaa_save_role_occupation(jsonb), kafaa_verify_occupation_code(jsonb),
  kafaa_clear_occupation_code(text, text), kafaa_occupation_trend() to authenticated;
