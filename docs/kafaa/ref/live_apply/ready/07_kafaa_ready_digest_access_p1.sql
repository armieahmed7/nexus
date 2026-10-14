-- kafaa_ready_digest_access_p1 (1/1) · from kafaa/supabase/migrations/20261013200006_kafaa_ready_digest_access.sql (readiness fixes 2026-10-13, branch readiness-fixes)
-- Apply with apply_migration name "kafaa_ready_digest_access_p1", in ORDER.txt order. Idempotent; a second run changes nothing; kafaa_* objects only. See EXPECTED.md.
-- [Readiness fixes 2026-10-13 · finding 2] The weekly digest offers only items the person can open.
--
-- Before: applicants, partners, observers and the auditor got digest items whose link opened "You don't have access to this page"
-- (staff opportunities, skills check-ins, AI-fluency and skills pages), and every click wrote a denied-access audit row.
-- kafaa_dg_compute(person, day, hints) now keeps a gathered item only when kafaa_route_ok_for(person, link, day) passes (the router's guard
-- for the person's roles that day, 20261013200005_kafaa_ready_route_guards.sql), then composes as before. kafaa_build_digest (from
-- 20261009155001_kafaa_w5e5_digest_dalil.sql, one line changed) now builds through kafaa_dg_compute instead of compose(gather) (the same
-- prefs row gives the same mutes), so new digests follow; digests already built this period keep their items (the /my panel hides the ones the person
-- cannot open). TS mirror: buildDigestItems -> openableItems in src/shell/digest/rules.ts. Same signature and grants (internal).
-- Idempotent (create or replace).

create or replace function kafaa_dg_compute(p_me text, p_today date, p_hints jsonb default '{}'::jsonb) returns jsonb language sql stable security definer set search_path = public as $$
  select kafaa_dg_compose(
    (select coalesce(jsonb_agg(i order by o), '[]'::jsonb)
       from jsonb_array_elements(kafaa_dg_gather(p_me, p_today, coalesce(p_hints, '{}'::jsonb))) with ordinality g(i, o)
      where kafaa_route_ok_for(p_me, i ->> 'link', p_today)),
    coalesce((select dp.muted_kinds from kafaa_digest_prefs dp where dp.person_id = p_me), '{}'::text[]))
$$;

revoke all on function kafaa_dg_compute(text, date, jsonb) from public, anon, authenticated;

create or replace function kafaa_build_digest(p_hints jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; dp kafaa_digest_prefs; v_on boolean; v_freq text; v_qs integer; v_qe integer; v_today date := (now() at time zone 'UTC')::date;
  v_period text; v_id text; cur kafaa_digest_runs; v_items jsonb; v_nid text; v_n jsonb; v_cnt integer; v_now timestamptz := date_trunc('second', now()); a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('digest.build', 'digest_runs', null, 'not_signed_in', 'Sign in to see your digest'); end if;
  v_role := kafaa_acting_role('notifications', array['Own']);
  if v_role is null then return kafaa_refuse('digest.build', 'digest_runs', null, 'forbidden', 'Digests are for signed-in staff'); end if;
  if p_hints is not null and jsonb_typeof(p_hints) not in ('object', 'null') then return kafaa_refuse('digest.build', 'digest_runs', null, 'invalid', 'Unreadable digest hints', v_role); end if;
  if p_hints is not null and jsonb_typeof(p_hints) = 'object' and p_hints ? 'coach' and jsonb_typeof(p_hints->'coach') <> 'null' and not kafaa_dg_hint_ok(p_hints->'coach') then
    return kafaa_refuse('digest.build', 'digest_runs', null, 'invalid', 'The coach suggestion could not be read', v_role);
  end if;
  select * into dp from kafaa_digest_prefs where person_id = me;
  v_on := coalesce(dp.enabled, true); v_freq := coalesce(dp.frequency, 'weekly'); v_qs := dp.quiet_start; v_qe := dp.quiet_end;
  if not v_on then return kafaa_refuse('digest.build', 'digest_runs', null, 'nudges_off', 'Nudges are off: turn them on in your settings to get a digest', v_role); end if;
  v_period := kafaa_dg_period(v_today, v_freq);
  v_id := 'dg:' || me || ':' || v_period;
  select * into cur from kafaa_digest_runs where id = v_id;
  if cur.id is not null then
    a := kafaa_audit('digest.build', 'digest_runs', v_id, 'ok', v_period || ': exists', 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Your digest for this period is ready', a, null,
      jsonb_build_object('run_id', v_id, 'period', v_period, 'created', false, 'items', cur.items, 'notification_id', cur.notification_id));
  end if;
  if kafaa_dg_in_quiet((extract(hour from now() at time zone 'UTC')::int + 4) % 24, v_qs, v_qe) then
    return kafaa_refuse('digest.build', 'digest_runs', null, 'quiet_hours', format('Quiet hours until %s:00: your digest will be ready after that', lpad(v_qe::text, 2, '0')), v_role);
  end if;
  -- readiness fixes 2026-10-13: through kafaa_dg_compute, which keeps only items whose link this person can open (same mutes: dp.muted_kinds)
  v_items := kafaa_dg_compute(me, v_today, case when jsonb_typeof(p_hints) = 'object' then p_hints else '{}'::jsonb end);
  v_cnt := jsonb_array_length(v_items);
  if v_cnt > 0 then
    v_nid := 'nt-dg-' || me || '-' || v_period;
    v_n := kafaa_dg_notice(v_items, v_freq);
    insert into kafaa_notifications (id, person_id, kind, title_en, title_ar, body_en, body_ar, link, severity, created_at, read_at)
    values (v_nid, me, 'digest', v_n->>'title_en', v_n->>'title_ar', v_n->>'body_en', v_n->>'body_ar', '/my#digest', v_n->>'severity', v_now, null)
    on conflict (id) do nothing;
  end if;
  insert into kafaa_digest_runs (id, person_id, period, frequency, as_of, items, item_count, notification_id, coach_hint, built_at)
  values (v_id, me, v_period, v_freq, v_today, v_items, v_cnt, v_nid, exists (select 1 from jsonb_array_elements(v_items) e where e->>'ref_table' = 'coach'), v_now)
  on conflict (id) do nothing;
  a := kafaa_audit('digest.build', 'digest_runs', v_id, 'ok', format('%s: %s items', v_period, v_cnt), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when v_cnt > 0 then format('Your digest is ready: %s items', v_cnt) else 'Nothing needs your attention this period' end, a, null,
    jsonb_build_object('run_id', v_id, 'period', v_period, 'created', true, 'items', v_items, 'notification_id', v_nid));
end $$;

revoke execute on function kafaa_build_digest(jsonb) from public, anon;
grant execute on function kafaa_build_digest(jsonb) to authenticated;
