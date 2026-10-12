-- kafaa_fs82_emirati_wallet_p2 (2/2) · from supabase/migrations/20261010282001_kafaa_fs82_emirati_wallet.sql
-- Apply with apply_migration name "kafaa_fs82_emirati_wallet_p2". Additive and idempotent; kafaa_* objects only.
-- ═════════════ FS63 rules (mirror of src/modules/m37/occupations.ts). Internal: not executable by API roles.
-- indicativeLevel(): Kafa'a's indicative rule (not MoHRE's): degree 1, diploma 2, secondary school 3
create or replace function kafaa_ro_indicative(p_education text) returns integer language sql immutable set search_path = public as $$
  select case p_education when 'doctorate' then 1 when 'master' then 1 when 'bachelor' then 1 when 'diploma' then 2 when 'high_school' then 3 end
$$;

-- ───────────── Grants: internal helpers are not executable by API roles; the five RPCs only by signed-in users.
revoke all on function kafaa_ep_add_months(date, integer), kafaa_ep_allowed(), kafaa_ep_roles(), kafaa_ep_area(jsonb, text, date), kafaa_ep_core(text, date),
  kafaa_fw_items(), kafaa_fw_status(text, date), kafaa_fw_target_view(), kafaa_fw_counter_core(date), kafaa_fw_target_problem(jsonb, date),
  kafaa_na_target(text, text), kafaa_na_link_problem(jsonb, kafaa_national_tags, jsonb, boolean), kafaa_na_links(), kafaa_na_measure(text, text),
  kafaa_na_report_core(jsonb, boolean) from public, anon, authenticated;
revoke all on function kafaa_emirati_pipeline(text), kafaa_my_future_wallet(), kafaa_future_wallet_counter(), kafaa_set_wallet_target(jsonb), kafaa_add_wallet_to_plan() from public, anon;
grant execute on function kafaa_emirati_pipeline(text), kafaa_my_future_wallet(), kafaa_future_wallet_counter(), kafaa_set_wallet_target(jsonb), kafaa_add_wallet_to_plan() to authenticated;
