-- kafaa_audit_verify_certificate_p1 (1/1) · from supabase/migrations/20261012155001_kafaa_audit_verify_certificate.sql (audit 2026-10-12 fixes, branch audit-fixes)
-- Apply with apply_migration name "kafaa_audit_verify_certificate_p1", in ORDER.txt order. Idempotent; a second run changes nothing. See EXPECTED.md.
-- [Audit 2026-10-12 · fix f] Public certificate verification gets the rate limit its siblings have.
-- kafaa_verify_certificate (M05 /verify, executable by anon) had no limit while certificate numbers are sequential; kafaa_verify_badge,
-- kafaa_verify_microcred and kafaa_verify_record_share refuse after 20 checks of one id or 600 checks in total per minute, counted from
-- their own audit rows. Same block here: every check now writes a 'certificate.verify' audit row (found or not), and a refused check returns
-- {found: false, code: 'rate_limited', message} so the page can say why (src/modules/m02/VerifyPage.tsx). The found / not-found payload is
-- unchanged (no personal data: holder initials only). Was LANGUAGE sql STABLE; now plpgsql VOLATILE because it writes the audit row.
-- Mirror for the local demo: LocalRpc.verifyCertificate (src/data/local/rpc.ts). Grants unchanged: anon and authenticated execute it.
create or replace function kafaa_verify_certificate(p_no text) returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_no text := left(upper(btrim(coalesce(p_no, ''))), 64); v_out jsonb; a kafaa_audit_events;
begin
  if (select count(*) from kafaa_audit_events e where e.action = 'certificate.verify' and e.ts > now() - interval '1 minute' and e.entity_id = v_no) >= 20
     or (select count(*) from kafaa_audit_events e where e.action = 'certificate.verify' and e.ts > now() - interval '1 minute') >= 600 then
    perform kafaa_refuse('certificate.verify', 'certificates', nullif(v_no, ''), 'rate_limited', 'Too many verification requests: try again in a minute');
    return jsonb_build_object('found', false, 'code', 'rate_limited', 'message', 'Too many verification requests: try again in a minute');
  end if;
  select jsonb_build_object('found', true, 'certificate_no', c.id, 'status', case when c.status = 'valid' and c.valid_to is not null and c.valid_to < current_date then 'expired' else c.status end,
      'course_code', co.code, 'course_en', co.title_en, 'course_ar', co.title_ar, 'issued_on', c.issued_on, 'valid_to', c.valid_to, 'holder_initials', c.holder_initials,
      'note', 'Internal Kafa''a course certificate. Not an operator licence.')
    into v_out
    from kafaa_certificates c join kafaa_courses co on co.id = c.course_id where upper(c.id) = v_no;
  if v_out is null or v_no = '' then
    perform kafaa_refuse('certificate.verify', 'certificates', nullif(v_no, ''), 'not_found', 'No Kafa''a certificate has this number');
    return jsonb_build_object('found', false);
  end if;
  a := kafaa_audit('certificate.verify', 'certificates', v_no, 'ok', v_out ->> 'status', 'not_applicable', null, null);
  return v_out;
end $$;
revoke execute on function kafaa_verify_certificate(text) from public;
grant execute on function kafaa_verify_certificate(text) to anon, authenticated;
