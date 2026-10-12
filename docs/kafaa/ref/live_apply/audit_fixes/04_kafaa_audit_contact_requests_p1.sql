-- kafaa_audit_contact_requests_p1 (1/1) · from supabase/migrations/20261012154001_kafaa_audit_contact_requests.sql (audit 2026-10-12 fixes, branch audit-fixes)
-- Apply with apply_migration name "kafaa_audit_contact_requests_p1", in ORDER.txt order. Idempotent; a second run changes nothing. See EXPECTED.md.
-- [Audit 2026-10-12 · fix e] kafaa_contact_requests: the public contact form accepted any anonymous row (`with check (true)`): any status
-- (including 'closed', which hides it from the admin inbox), any route_to, unbounded text and any retention date.
-- The check below admits exactly what the two public forms send (src/modules/m12/ContactPage.tsx: status 'routed', the role mailbox of the
-- topic, retention today + 180 days; src/modules/m09/SuppliersPage.tsx: default status 'new', the supplier mailbox) and nothing else:
--   status 'new' or 'routed' (never 'closed'); route_to is the role mailbox of the chosen topic (= CONTACT_ROUTES in src/domain/g5rules.ts;
--   the column is NOT NULL, so it cannot be left empty); id at most 64 characters; message 1-4000 characters; name at most 200; email at
--   most 320; retention_until empty or at most 400 days ahead. Mirror for the local demo: contactRequestProblems() in src/domain/g5rules.ts.
-- Staff change only the status after a request is sent (src/modules/m16/AdminPage.tsx: mark routed / close). The repo granted no UPDATE
-- here (live had it only through Supabase's default privileges), so a fresh build could not mark requests: grant UPDATE of the status
-- column only. The kafaa_update policy (users_roles W/A) still decides who may.
-- Idempotent (alter policy, revoke, grant); kafaa_* objects only.
alter policy kafaa_insert on kafaa_contact_requests with check (
  status in ('new', 'routed')
  and route_to = case topic
    when 'careers' then 'Careers team (role mailbox)'
    when 'programmes' then 'Talent programmes team (role mailbox)'
    when 'suppliers' then 'Supplier development (role mailbox)'
    when 'universities' then 'University partnerships (role mailbox)'
    when 'media' then 'Media relations (role mailbox)'
    when 'accessibility' then 'Digital accessibility (role mailbox)'
    when 'other' then 'General enquiries (role mailbox)'
  end
  and length(id) <= 64
  and length(message) between 1 and 4000
  and coalesce(length(name), 0) <= 200
  and coalesce(length(email), 0) <= 320
  and (retention_until is null or retention_until <= current_date + 400)
);
revoke update on kafaa_contact_requests from anon, authenticated;
grant update (status) on kafaa_contact_requests to authenticated;
