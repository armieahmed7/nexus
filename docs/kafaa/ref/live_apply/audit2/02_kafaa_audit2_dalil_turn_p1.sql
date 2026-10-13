-- kafaa_audit2_dalil_turn_p1 (1/1) · from kafaa/supabase/migrations/20261013100002_kafaa_audit2_dalil_turn.sql (final audit fixes 2026-10-13, branch audit2-fixes)
-- Apply with apply_migration name "kafaa_audit2_dalil_turn_p1", in ORDER.txt order. Idempotent; a second run changes nothing. See EXPECTED.md.
-- [Audit2 2026-10-13 · finding 2] kafaa_dalil_turn (anonymous Dalil, SECURITY DEFINER, executable by anon):
-- 1. The anonymous rate-limit key came from the FIRST X-Forwarded-For hop, which the client chooses, so every request could use a fresh
--    key. It now uses kafaa_client_ip() (cf-connecting-ip, else the last hop, which the platform's proxy appends;
--    20261013100001_kafaa_audit2_rate_limits.sql). Without headers (local PGlite, server-side calls) the per-browser client_key is used, as before.
-- 2. A global cap on anonymous questions: 120 a minute across all visitors (kafaa_rl_hit 'dalil.anon'), refused as 'rate_limited';
--    the refusal is audited once per minute. The per-key hourly limit (kafaa_dalil_settings.public_rate_limit_per_hour) is unchanged.
-- 3. The answer and citations are composed in the visitor's browser by design (no LLM key, deterministic engine); they are now marked
--    kafaa_advisor_turns.answer_source = 'browser' (new nullable column, null on user turns and on rows written before this migration),
--    so review screens never treat them as server-made. Citations must be a JSON array (anything else is stored as []).
-- Same signature, result shape and grants (create or replace keeps them; restated below). kafaa_* objects only; idempotent.

alter table kafaa_advisor_turns add column if not exists answer_source text check (answer_source in ('browser', 'server'));

create or replace function kafaa_dalil_turn(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); s kafaa_dalil_settings; ses kafaa_advisor_sessions; a kafaa_audit_events;
  v_mode text := coalesce(p->>'mode', 'public'); v_key text; v_ip text; v_limit integer; v_used integer; v_n integer; v_all integer;
  v_redact boolean := coalesce((p->>'redact_question')::boolean, false) or coalesce(p->>'refusal_category', '') = 'concern';
  v_q text := coalesce(p->>'question', ''); v_now timestamptz := date_trunc('second', now());
begin
  select * into s from kafaa_dalil_settings where id = 'global';
  if s.id is null or not s.enabled then return kafaa_refuse('dalil.turn', 'advisor_turns', null, 'disabled', 'Dalil is switched off by the AI owner'); end if;
  if me is null and exists (select 1 from kafaa_feature_flags f where f.key = 'dalil_public' and not f.enabled) then
    return kafaa_refuse('dalil.turn', 'advisor_turns', null, 'not_signed_in', 'Sign in to use Dalil');
  end if;
  if not kafaa_dalil_mode_allowed(v_mode) then return kafaa_refuse('dalil.turn', 'advisor_turns', null, 'forbidden', format('Mode %s is not available to you', v_mode)); end if;
  if me is null then
    -- per-IP (the address the platform saw: kafaa_client_ip(), never the client-chosen first X-Forwarded-For hop), otherwise the
    -- random per-browser key
    v_ip := coalesce(kafaa_client_ip(), '');
    v_key := case when v_ip <> '' then 'ip-' || md5(v_ip) else left(nullif(p->>'client_key', ''), 64) end;
    if v_key is null then return kafaa_refuse('dalil.turn', 'advisor_turns', null, 'invalid', 'A client key is required for anonymous use'); end if;
  end if;
  if length(trim(v_q)) = 0 or length(v_q) > 2000 then return kafaa_refuse('dalil.turn', 'advisor_turns', null, 'invalid', 'Questions must be 1 to 2,000 characters'); end if;
  if me is null then
    -- global cap on anonymous questions (all keys together), like the 600-a-minute cap of the verification links; the refusal is
    -- audited once per minute, not once per refused call
    v_all := kafaa_rl_hit('dalil.anon', '*', interval '1 minute');
    if v_all > 120 then
      if kafaa_rl_hit('dalil.anon.busy', '*', interval '1 minute') = 1 then
        a := kafaa_audit('dalil.turn', 'advisor_turns', null, 'refused', format('rate_limited: over %s anonymous questions a minute (all visitors)', 120));
      end if;
      return kafaa_result(false, 'rate_limited', 'Dalil is answering too many questions right now. Try again in a minute.', a, null,
        jsonb_build_object('session_id', coalesce(p->>'session_id', ''), 'used', null, 'limit', null, 'remaining', 0));
    end if;
  end if;
  v_limit := case when me is null then s.public_rate_limit_per_hour else s.signed_in_rate_limit_per_hour end;
  select count(*) into v_used from kafaa_advisor_turns t join kafaa_advisor_sessions x on x.id = t.session_id
   where t.speaker = 'user' and t.ts >= now() - interval '1 hour' and (case when me is null then x.client_key = v_key else x.person_id = me end);
  if v_used >= v_limit then
    a := kafaa_audit('dalil.turn', 'advisor_turns', null, 'refused', format('rate_limited: %s/%s per hour (%s)', v_used, v_limit, case when me is null then 'anonymous' else 'user' end));
    return kafaa_result(false, 'rate_limited', format('You have reached %s questions this hour. Try again later.', v_limit), a, null,
      jsonb_build_object('session_id', coalesce(p->>'session_id', ''), 'used', v_used, 'limit', v_limit, 'remaining', 0));
  end if;
  select * into ses from kafaa_advisor_sessions where id = p->>'session_id'
    and (case when me is null then client_key = v_key else person_id = me end);
  if ses.id is null then
    insert into kafaa_advisor_sessions (id, person_id, mode, started_at, retention_until, client_key, page_context, turns, last_turn_at)
    values ('as-' || replace(gen_random_uuid()::text, '-', ''), me, v_mode, v_now, current_date + s.retention_days, v_key, left(p->>'page_context', 200), 0, v_now)
    returning * into ses;
  end if;
  v_n := ses.turns;
  -- the answer and its citations were composed by the visitor's browser (deterministic engine, no LLM): answer_source 'browser' says so
  insert into kafaa_advisor_turns (id, session_id, person_id, speaker, text, citations, refused, refusal_category, ts, intent, confidence, redacted, mode, answer_source)
  values (ses.id || '-' || (v_n + 1), ses.id, me, 'user', case when v_redact then '[withheld: concern; Dalil showed the ECP channels]' else left(v_q, 2000) end,
          '[]'::jsonb, false, null, v_now, p->>'intent', null, v_redact, v_mode, null),
         (ses.id || '-' || (v_n + 2), ses.id, me, 'dalil', left(coalesce(p->>'answer', ''), 4000),
          case when jsonb_typeof(p->'citations') = 'array' then p->'citations' else '[]'::jsonb end,
          coalesce((p->>'refused')::boolean, false), p->>'refusal_category', v_now, p->>'intent', nullif(p->>'confidence', '')::numeric, false, v_mode, 'browser');
  update kafaa_advisor_sessions set turns = v_n + 2, last_turn_at = v_now, mode = v_mode where id = ses.id;
  a := kafaa_audit('dalil.turn', 'advisor_turns', ses.id, 'ok', format('%s %s%s', v_mode, coalesce(p->>'intent', '-'),
        case when coalesce((p->>'refused')::boolean, false) then ' refused:' || coalesce(p->>'refusal_category', '') else '' end));
  return kafaa_result(true, 'ok', 'ok', a, null, jsonb_build_object('session_id', ses.id, 'used', v_used + 1, 'limit', v_limit, 'remaining', greatest(0, v_limit - v_used - 1)));
end $$;
revoke execute on function kafaa_dalil_turn(jsonb) from public;
grant execute on function kafaa_dalil_turn(jsonb) to anon, authenticated;
