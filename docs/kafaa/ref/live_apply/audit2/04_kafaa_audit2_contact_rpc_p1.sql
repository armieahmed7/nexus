-- kafaa_audit2_contact_rpc_p1 (1/1) · from kafaa/supabase/migrations/20261013100004_kafaa_audit2_contact_rpc.sql (final audit fixes 2026-10-13, branch audit2-fixes)
-- Apply with apply_migration name "kafaa_audit2_contact_rpc_p1", in ORDER.txt order. Idempotent; a second run changes nothing. See EXPECTED.md.
-- [Audit2 2026-10-13 · finding 7] The public contact form and the supplier interest form inserted straight into kafaa_contact_requests
-- (anon INSERT, bounded by the audit-fix part-04 check) with no throttle. They now send through kafaa_submit_contact(p jsonb):
--  * SECURITY DEFINER, executable by anon and authenticated (signed-out submission keeps working);
--  * the same bounds as the part-04 insert check (status new or routed; route_to is always the role mailbox of the topic, derived
--    here, never taken from the caller; message 1-4000 characters; name at most 200; email at most 320; retention at most 400 days);
--    mirror for the local demo: contactRequestProblems() in src/domain/contact.ts;
--  * a throttle: 5 requests per 10 minutes per client (kafaa_client_ip(), else the signed-in person, else one shared anonymous key)
--    and 30 a minute for everyone (kafaa_rl_hit, 20261013100001_kafaa_audit2_rate_limits.sql); refusals are audited once per client per
--    10 minutes;
--  * one audit row per request sent ('contact.submit'), as well as the row the table's audit trigger writes.
-- Direct inserts: the kafaa_insert policy now admits only users_roles W/A (admins), like every other direct-write table, and anon loses
-- INSERT on the table (signed-in users keep the grant; the policy decides). Staff still change only the status (part 04 unchanged).
-- kafaa_* objects only; idempotent.

create or replace function kafaa_submit_contact(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_topic text := coalesce(p ->> 'topic', ''); v_route text; v_status text := coalesce(nullif(p ->> 'status', ''), 'new');
  v_name text := nullif(btrim(coalesce(p ->> 'name', '')), ''); v_email text := nullif(btrim(coalesce(p ->> 'email', '')), '');
  v_msg text := btrim(coalesce(p ->> 'message', '')); v_lang text := case when p ->> 'lang' = 'ar' then 'ar' else 'en' end;
  v_consent boolean := coalesce(p -> 'consent_contact' = 'true'::jsonb, false); v_ret date; v_id text; v_ip text := kafaa_client_ip();
  v_key text; v_n integer; v_all integer; a kafaa_audit_events;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return kafaa_refuse('contact.submit', 'contact_requests', null, 'invalid', 'Fill in the form'); end if;
  v_route := case v_topic
    when 'careers' then 'Careers team (role mailbox)'
    when 'programmes' then 'Talent programmes team (role mailbox)'
    when 'suppliers' then 'Supplier development (role mailbox)'
    when 'universities' then 'University partnerships (role mailbox)'
    when 'media' then 'Media relations (role mailbox)'
    when 'accessibility' then 'Digital accessibility (role mailbox)'
    when 'other' then 'General enquiries (role mailbox)'
  end;
  if v_route is null then return kafaa_refuse('contact.submit', 'contact_requests', null, 'invalid', 'Choose a topic'); end if;
  if v_status not in ('new', 'routed') then return kafaa_refuse('contact.submit', 'contact_requests', null, 'invalid', 'A new request is new or routed'); end if;
  if length(v_msg) < 1 or length(v_msg) > 4000 then return kafaa_refuse('contact.submit', 'contact_requests', null, 'invalid', 'The message must be 1 to 4,000 characters'); end if;
  if coalesce(length(v_name), 0) > 200 or coalesce(length(v_email), 0) > 320 then return kafaa_refuse('contact.submit', 'contact_requests', null, 'invalid', 'The name or email is too long'); end if;
  if nullif(p ->> 'retention_until', '') is not null then
    begin
      v_ret := (p ->> 'retention_until')::date;
    exception when others then
      return kafaa_refuse('contact.submit', 'contact_requests', null, 'invalid', 'The retention date is not a date');
    end;
    if v_ret > current_date + 400 then return kafaa_refuse('contact.submit', 'contact_requests', null, 'invalid', 'Requests are kept at most 400 days'); end if;
  end if;
  v_key := case when v_ip is not null then 'ip-' || md5(v_ip) else coalesce(kafaa_me(), 'anon') end;
  v_n := kafaa_rl_hit('contact.client', v_key, interval '10 minutes');
  v_all := kafaa_rl_hit('contact.all', '*', interval '1 minute');
  if v_n > 5 or v_all > 30 then
    if kafaa_rl_hit('contact.refused', v_key, interval '10 minutes') = 1 then
      a := kafaa_audit('contact.submit', 'contact_requests', null, 'refused', 'rate_limited: ' || case when v_n > 5 then '5 requests per 10 minutes per sender' else '30 requests a minute in total' end);
    end if;
    return kafaa_result(false, 'rate_limited', 'Too many messages: try again in a few minutes', a);
  end if;
  v_id := 'con-' || replace(gen_random_uuid()::text, '-', '');
  insert into kafaa_contact_requests (id, topic, route_to, name, email, message, status, lang, consent_contact, retention_until)
  values (v_id, v_topic, v_route, v_name, v_email, v_msg, v_status, v_lang, v_consent, v_ret);
  a := kafaa_audit('contact.submit', 'contact_requests', v_id, 'ok', v_topic || ' ' || v_status, 'not_applicable', null, null);
  return kafaa_result(true, 'ok', 'Request sent', a, null, jsonb_build_object('id', v_id, 'route_to', v_route));
end $$;
revoke execute on function kafaa_submit_contact(jsonb) from public;
grant execute on function kafaa_submit_contact(jsonb) to anon, authenticated;

alter policy kafaa_insert on kafaa_contact_requests with check ((select kafaa_has_grant('users_roles'::text, array['W'::text, 'A'::text])));
revoke insert on kafaa_contact_requests from anon;
