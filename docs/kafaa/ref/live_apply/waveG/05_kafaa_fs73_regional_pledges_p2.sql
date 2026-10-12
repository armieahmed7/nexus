-- kafaa_fs73_regional_pledges_p2 (2/2) · from supabase/migrations/20261010273001_kafaa_fs73_regional_pledges.sql
-- Apply with apply_migration name "kafaa_fs73_regional_pledges_p2". Additive and idempotent; kafaa_* objects only.
-- ───────────── Grants: internal helpers are not executable by API roles; the seven RPCs only by signed-in users.
revoke all on function kafaa_rg_rows(jsonb, text), kafaa_rg_term_ord(text), kafaa_rg_term_of_ord(integer), kafaa_rg_term_start(text), kafaa_rg_term_end(text), kafaa_rg_term_state(text, date),
  kafaa_rg_first_open(date), kafaa_rg_locked(jsonb, date), kafaa_rg_is_int(jsonb), kafaa_rg_txt(jsonb), kafaa_rg_commit_problem(jsonb, text[], jsonb, date), kafaa_rg_delivery_problem(jsonb, jsonb, date),
  kafaa_rg_status(jsonb, jsonb, text, date), kafaa_pl_date(jsonb), kafaa_pl_problem(jsonb, date), kafaa_pl_progress_problem(jsonb, date, jsonb, date),
  kafaa_pl_status(integer, date, text, integer, integer, date), kafaa_pl_cell(bigint, bigint), kafaa_pl_count(bigint, bigint), kafaa_pl_ledger(date) from public, anon, authenticated;
revoke all on function kafaa_release_regional_demand(jsonb), kafaa_commit_provision(jsonb), kafaa_report_commitment_delivery(jsonb), kafaa_review_commitment(jsonb),
  kafaa_register_pledge(jsonb), kafaa_record_pledge_progress(jsonb), kafaa_pledge_ledger() from public, anon;
grant execute on function kafaa_release_regional_demand(jsonb), kafaa_commit_provision(jsonb), kafaa_report_commitment_delivery(jsonb), kafaa_review_commitment(jsonb),
  kafaa_register_pledge(jsonb), kafaa_record_pledge_progress(jsonb), kafaa_pledge_ledger() to authenticated;
