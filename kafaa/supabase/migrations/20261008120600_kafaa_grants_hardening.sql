-- Kafa'a: tighten EXECUTE grants after the Supabase security advisor run (2026-10-08). Additive: revokes only, on kafaa_* functions.
--
-- Kept callable by anon on purpose (each is a read-only predicate or a gated public read):
--   kafaa_me, kafaa_my_org, kafaa_has_grant, kafaa_rule_read, kafaa_role_grant  -> used directly inside RLS policies,
--       so the caller's role must be able to execute them while a policy is evaluated (anon reads public content).
--   kafaa_verify_certificate                                                     -> public certificate verification (M05).
--   kafaa_nexus_*                                                                -> public directory reads; each gates its
--       restricted columns/rows internally (see 20261008120500_kafaa_nexus_reads.sql).
-- Write RPCs stay callable by authenticated only (already revoked from public/anon in 20261008120400); every one checks
-- the caller's Kafa'a grant itself and refuses with {ok:false} otherwise.

-- Not needed by anonymous visitors.
revoke execute on function kafaa_audit_verify() from public, anon;
revoke execute on function kafaa_log_denied(text, text) from public, anon;
revoke execute on function kafaa_whoami() from public, anon;
revoke execute on function kafaa_my_roles() from public, anon;
grant execute on function kafaa_audit_verify(), kafaa_log_denied(text, text), kafaa_whoami(), kafaa_my_roles() to authenticated;

-- Internal helpers: only ever called from other SECURITY DEFINER functions (which run as the owner).
revoke execute on function kafaa_acting_role(text, text[]) from public, anon, authenticated;
revoke execute on function kafaa_in_scope(text, text) from public, anon, authenticated;
revoke execute on function kafaa_has_role(text) from public, anon, authenticated;
