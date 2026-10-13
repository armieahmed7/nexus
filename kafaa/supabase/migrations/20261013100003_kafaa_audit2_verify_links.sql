-- [Audit2 2026-10-13 · finding 6] Public verification links (kafaa_verify_badge, kafaa_verify_microcred, kafaa_verify_record_share; anon
-- may execute them) wrote one row to the hash-chained audit log per page view, refusals included, and counted their rate limits from
-- those rows: any visitor or crawler could append up to 600 rows a minute per kind, and one client could use up the shared cap.
-- Now:
--  * rate limits count in kafaa_rate_limits (20261013100001_kafaa_audit2_rate_limits.sql): 20 checks a minute per link (as before), 60 a minute per client IP across
--    all verification kinds (new; kafaa_client_ip(), skipped when no IP is known), 600 a minute per kind for everyone (as before);
--  * the audit log gets one aggregated row per link and outcome per hour (the first check in the hour; later checks in that hour are
--    counted in kafaa_rate_limits, bucket 'verify.audit.<action>'), for successful checks, unknown links and rate-limit refusals alike.
--    The result's audit_seq is null for the checks that wrote no row; nothing in the app reads it;
--  * kafaa_verify_record_share still counts views on the share (views, last_viewed_at): that is the holder's feature, now rate-limited.
-- Same signatures, results (apart from audit_seq) and grants. kafaa_verify_certificate (audit fix part 05) is not changed here.
-- Helpers kafaa_verify_limited / kafaa_verify_refuse / kafaa_verify_audit are executable by no API role. kafaa_* objects only; idempotent.

-- true when this check is over a limit (counts the check in every counter it belongs to)
create or replace function kafaa_verify_limited(p_kind text, p_key text) returns boolean language plpgsql security definer set search_path = public as $$
declare v_ip text := kafaa_client_ip(); v_link integer; v_ipn integer := 0; v_all integer;
begin
  v_link := kafaa_rl_hit('verify.' || p_kind, coalesce(nullif(p_key, ''), '?'), interval '1 minute');
  if v_ip is not null then v_ipn := kafaa_rl_hit('verify.ip', 'ip-' || md5(v_ip), interval '1 minute'); end if;
  v_all := kafaa_rl_hit('verify.' || p_kind || '.all', '*', interval '1 minute');
  return v_link > 20 or v_ipn > 60 or v_all > 600;
end $$;
revoke all on function kafaa_verify_limited(text, text) from public, anon, authenticated;

-- one audit row per action, link and outcome per hour; null for the other checks of that hour
create or replace function kafaa_verify_audit(p_action text, p_table text, p_entity text, p_reason text, p_outcome text default 'ok') returns kafaa_audit_events
language plpgsql security definer set search_path = public as $$
declare a kafaa_audit_events;
begin
  if kafaa_rl_hit('verify.audit.' || p_action, p_outcome || ':' || coalesce(p_entity, '?') || ':' || left(coalesce(p_reason, ''), 40), interval '1 hour') = 1 then
    a := kafaa_audit(p_action, p_table, p_entity, p_outcome, p_reason, 'not_applicable', null, null);
  end if;
  return a;
end $$;
revoke all on function kafaa_verify_audit(text, text, text, text, text) from public, anon, authenticated;

-- a refusal Result (same shape as kafaa_refuse), audited through kafaa_verify_audit
create or replace function kafaa_verify_refuse(p_action text, p_table text, p_entity text, p_code text, p_message text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  return kafaa_result(false, p_code, p_message, kafaa_verify_audit(p_action, p_table, p_entity, p_code || ': ' || p_message, 'refused'));
end $$;
revoke all on function kafaa_verify_refuse(text, text, text, text, text) from public, anon, authenticated;

create or replace function kafaa_verify_badge(p_slug text) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_slug text := left(trim(coalesce(p_slug, '')), 64); bd kafaa_badges; v_status text; a kafaa_audit_events;
begin
  if kafaa_verify_limited('badge', v_slug) then
    return kafaa_verify_refuse('badge.verify', 'badges', nullif(v_slug, ''), 'rate_limited', 'Too many verification requests: try again in a minute');
  end if;
  select * into bd from kafaa_badges where public_slug = v_slug;
  if bd.id is null or v_slug = '' then return kafaa_verify_refuse('badge.verify', 'badges', nullif(v_slug, ''), 'not_found', 'No Kafa''a badge has this link'); end if;
  v_status := kafaa_badge_status(bd);
  a := kafaa_verify_audit('badge.verify', 'badges', v_slug, v_status);
  return kafaa_result(true, 'ok', 'Badge found', a, null, jsonb_build_object('found', true, 'slug', v_slug, 'status', v_status, 'credential', bd.credential,
    'key_id', bd.key_id, 'checked_on', to_char(current_date, 'YYYY-MM-DD'), 'notice', 'Internal Kafa''a credential; not a FANR certificate or licence.'));
end $$;

create or replace function kafaa_verify_microcred(p_slug text) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_slug text := left(btrim(coalesce(p_slug, '')), 64); aw kafaa_microcred_awards; v_status text; v_comps jsonb := '[]'::jsonb; cid text; c kafaa_microcred_awards; cd kafaa_microcred_defs; a kafaa_audit_events;
begin
  if kafaa_verify_limited('microcred', v_slug) then
    return kafaa_verify_refuse('microcred.verify', 'microcred_awards', nullif(v_slug, ''), 'rate_limited', 'Too many verification requests: try again in a minute');
  end if;
  select * into aw from kafaa_microcred_awards where public_slug = v_slug and v_slug <> '';
  if aw.id is null then return kafaa_verify_refuse('microcred.verify', 'microcred_awards', nullif(v_slug, ''), 'not_found', 'No Kafa''a micro-credential has this link'); end if;
  v_status := kafaa_mc_view(aw, current_date) ->> 'status';
  foreach cid in array coalesce(aw.component_award_ids, '{}'::text[]) loop
    c := kafaa_mc_resolve(cid);
    cd := null;
    select * into cd from kafaa_microcred_defs where code = c.def_code order by (status = 'current') desc, version desc limit 1;
    v_comps := v_comps || jsonb_build_array(jsonb_build_object('code', coalesce(c.def_code, ''), 'title_en', coalesce(cd.title_en, ''), 'title_ar', coalesce(cd.title_ar, ''), 'slug', c.public_slug,
      'status', case when c.id is null then 'none' else kafaa_mc_view(c, current_date, false) ->> 'status' end));
  end loop;
  a := kafaa_verify_audit('microcred.verify', 'microcred_awards', v_slug, v_status);
  return kafaa_result(true, 'ok', 'Micro-credential found', a, null, jsonb_build_object('found', true, 'slug', v_slug, 'status', v_status, 'credential', aw.credential, 'key_id', aw.key_id,
    'checked_on', to_char(current_date, 'YYYY-MM-DD'), 'notice', 'Internal Kafa''a credential; not a FANR certificate or licence.', 'components', v_comps));
end $$;

create or replace function kafaa_verify_record_share(p_token text) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_tok text := left(btrim(coalesce(p_token, '')), 64); s kafaa_record_shares; v_status text; v_clr jsonb; a kafaa_audit_events; v_day text := to_char(current_date, 'YYYY-MM-DD');
begin
  if v_tok <> '' then select * into s from kafaa_record_shares where token = v_tok; end if;
  -- unknown tokens share one per-link counter ('?'), so guessing tokens is capped like reading one link
  if kafaa_verify_limited('record', coalesce(s.id, '?')) then
    return kafaa_verify_refuse('record.verify', 'record_shares', s.id, 'rate_limited', 'Too many verification requests: try again in a minute');
  end if;
  if s.id is null then return kafaa_verify_refuse('record.verify', 'record_shares', null, 'not_found', 'No Kafa''a learner record has this link'); end if;
  v_status := case when s.revoked_at is not null then 'revoked' when s.expires_on < current_date then 'expired' else 'active' end;
  if v_status <> 'active' then
    a := kafaa_verify_audit('record.verify', 'record_shares', s.id, v_status);
    return kafaa_result(true, 'ok', 'This link is no longer active', a, null, jsonb_build_object('found', true, 'status', v_status, 'checked_on', v_day, 'notice', 'This link is no longer active'));
  end if;
  update kafaa_record_shares set views = views + 1, last_viewed_at = now() where id = s.id;
  v_clr := kafaa_lr_bundle(s.person_id, s.items, current_date, s.id, s.expires_on);
  a := kafaa_verify_audit('record.verify', 'record_shares', s.id, v_status);
  return kafaa_result(true, 'ok', 'Learner record found', a, null, jsonb_build_object('found', true, 'status', v_status, 'checked_on', v_day, 'expires_on', to_char(s.expires_on, 'YYYY-MM-DD'),
    'holder_initials', v_clr #>> '{credentialSubject,holderInitials}', 'item_count', jsonb_array_length(v_clr -> 'kafaaItems'), 'clr', v_clr, 'notice', 'Learner record found',
    'purpose', coalesce(nullif(s.consents ->> 'purpose', ''), 'record')));
end $$;

revoke execute on function kafaa_verify_badge(text) from public;
revoke execute on function kafaa_verify_microcred(text) from public;
revoke execute on function kafaa_verify_record_share(text) from public;
grant execute on function kafaa_verify_badge(text) to anon, authenticated;
grant execute on function kafaa_verify_microcred(text) to anon, authenticated;
grant execute on function kafaa_verify_record_share(text) to anon, authenticated;
