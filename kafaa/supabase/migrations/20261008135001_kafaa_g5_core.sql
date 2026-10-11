-- Kafa'a G5 (M08 safety culture, M12 public site, M13 Dalil, M14 access, M16 admin and NEXUS integration).
-- Hand-written; mirrored 1:1 by src/data/local/rpc.ts and src/domain/g5rules.ts. Additive and idempotent:
-- only kafaa_* objects, `add column if not exists`, `create ... if not exists`, `create or replace`, guarded DO blocks.
-- Contains no DROP statements (the live MCP refuses them); policies are created only when missing.

-- ───────────── Columns (the generated 20261008120100 schema already has them on a fresh database)
alter table kafaa_role_assignments add column if not exists reviewed_at timestamptz;
alter table kafaa_role_assignments add column if not exists reviewed_by text;
alter table kafaa_role_assignments add column if not exists review_note text;

alter table kafaa_contact_requests add column if not exists lang text not null default 'en' check (lang in ('en', 'ar'));
alter table kafaa_contact_requests add column if not exists consent_contact boolean not null default false;
alter table kafaa_contact_requests add column if not exists retention_until date;

alter table kafaa_concern_cases add column if not exists closed_on date;
alter table kafaa_concern_cases add column if not exists outcome text check (outcome in ('substantiated', 'not_substantiated', 'referred_cap', 'referred_hr', 'referred_external', 'no_action'));

alter table kafaa_content_pages add column if not exists kind text not null default 'page' check (kind in ('page', 'news'));
alter table kafaa_content_pages add column if not exists published_on date;
alter table kafaa_content_pages add column if not exists summary_en text not null default '';
alter table kafaa_content_pages add column if not exists summary_ar text not null default '';
alter table kafaa_content_pages add column if not exists topic text not null default 'general';
alter table kafaa_content_pages add column if not exists updated_by text;
alter table kafaa_content_pages add column if not exists updated_at timestamptz not null default now();
alter table kafaa_content_pages add column if not exists no_factual_claims boolean not null default false;
create index if not exists kafaa_content_pages_kind_idx on kafaa_content_pages (kind);

alter table kafaa_advisor_sessions add column if not exists client_key text;
alter table kafaa_advisor_sessions add column if not exists page_context text;
alter table kafaa_advisor_sessions add column if not exists handoff_status text not null default 'none' check (handoff_status in ('none', 'requested', 'picked_up', 'closed'));
alter table kafaa_advisor_sessions add column if not exists handoff_note text;
alter table kafaa_advisor_sessions add column if not exists last_turn_at timestamptz;
create index if not exists kafaa_advisor_sessions_client_key_idx on kafaa_advisor_sessions (client_key);

alter table kafaa_advisor_turns add column if not exists intent text;
alter table kafaa_advisor_turns add column if not exists confidence numeric;
alter table kafaa_advisor_turns add column if not exists redacted boolean not null default false;
alter table kafaa_advisor_turns add column if not exists mode text check (mode in ('public', 'applicant', 'staff', 'partner'));

alter table kafaa_eval_runs add column if not exists details jsonb not null default '[]'::jsonb;
alter table kafaa_eval_runs add column if not exists engine text not null default 'retrieval-v1';
alter table kafaa_eval_runs add column if not exists run_by text;
alter table kafaa_eval_runs add column if not exists security_total integer not null default 0;
alter table kafaa_eval_runs add column if not exists security_correct integer not null default 0;

alter table kafaa_dalil_settings add column if not exists signed_in_rate_limit_per_hour integer not null default 60;
alter table kafaa_dalil_settings add column if not exists engine text not null default 'retrieval-v1';

-- The global Dalil settings row (kill switch). The live seed is partial; without this row kafaa_dalil_turn reports "switched off".
insert into kafaa_dalil_settings (id, enabled, public_rate_limit_per_hour, staff_mode, model_gateway, retention_days, signed_in_rate_limit_per_hour, engine)
values ('global', true, 20, true, 'Grounded retrieval over the approved corpus (demo); UAE-hosted model option in production', 30, 60, 'retrieval-v1')
on conflict (id) do nothing;

-- ───────────── Dalil logs are written only through kafaa_dalil_turn (server-side kill switch, mode gate and rate limit)
revoke insert, update on kafaa_advisor_sessions, kafaa_advisor_turns from anon, authenticated;
do $$ begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'kafaa_advisor_sessions' and policyname = 'kafaa_insert') then
    alter policy kafaa_insert on kafaa_advisor_sessions with check (false);
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'kafaa_advisor_sessions' and policyname = 'kafaa_update') then
    alter policy kafaa_update on kafaa_advisor_sessions using (false) with check (false);
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'kafaa_advisor_turns' and policyname = 'kafaa_insert') then
    alter policy kafaa_insert on kafaa_advisor_turns with check (false);
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'kafaa_advisor_turns' and policyname = 'kafaa_update') then
    alter policy kafaa_update on kafaa_advisor_turns using (false) with check (false);
  end if;
end $$;

-- ───────────── Feature flags (M16)
create table if not exists kafaa_feature_flags (
  id text primary key,
  key text not null unique,
  label_en text not null,
  label_ar text not null,
  description_en text not null default '',
  description_ar text not null default '',
  enabled boolean not null default true,
  locked boolean not null default false,
  area text not null default 'general',
  updated_at timestamptz not null default now(),
  updated_by text
);
comment on table kafaa_feature_flags is '[M16] Feature flags for the demo tenant (admin console)';
alter table kafaa_feature_flags enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'kafaa_feature_flags' and policyname = 'kafaa_read') then
    create policy kafaa_read on kafaa_feature_flags for select to anon, authenticated using (kafaa_rule_read('public_content', null::text, null::text, true));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'kafaa_feature_flags' and policyname = 'kafaa_insert') then
    create policy kafaa_insert on kafaa_feature_flags for insert to anon, authenticated with check (kafaa_has_grant('integrations', array['W','A']));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'kafaa_feature_flags' and policyname = 'kafaa_update') then
    create policy kafaa_update on kafaa_feature_flags for update to authenticated using (kafaa_has_grant('integrations', array['W','A']) and not locked) with check (kafaa_has_grant('integrations', array['W','A']) and not locked);
  else
    -- the generated RLS file creates a plain admin policy; locked flags (speak-up telemetry, gamification) never change
    alter policy kafaa_update on kafaa_feature_flags using (kafaa_has_grant('integrations', array['W','A']) and not locked) with check (kafaa_has_grant('integrations', array['W','A']) and not locked);
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'kafaa_feature_flags_audit') then
    create trigger kafaa_feature_flags_audit after insert or update on kafaa_feature_flags for each row execute function kafaa_audit_row();
  end if;
end $$;
grant select, insert, update on kafaa_feature_flags to authenticated;
grant select on kafaa_feature_flags to anon;
insert into kafaa_feature_flags (id, key, label_en, label_ar, description_en, description_ar, enabled, locked, area) values
  ('ff-dalil_public', 'dalil_public', 'Dalil for anonymous visitors', 'دليل للزوار غير المسجلين', 'When off, Dalil asks visitors to sign in before answering. The global kill switch is separate (Dalil settings).', 'عند الإيقاف يطلب دليل من الزوار تسجيل الدخول قبل الإجابة. مفتاح الإيقاف العام منفصل (إعدادات دليل).', true, false, 'dalil'),
  ('ff-dalil_handoff', 'dalil_handoff', 'Dalil human hand-off', 'إحالة دليل إلى شخص', 'Lets users ask for the careers team, a training coordinator or the partner desk, with consent to pass on the conversation.', 'يتيح للمستخدمين طلب فريق المهن أو منسق التدريب أو مكتب الشركاء مع الموافقة على تمرير المحادثة.', true, false, 'dalil'),
  ('ff-contact_form', 'contact_form', 'Public contact form', 'نموذج الاتصال العام', 'When off, the contact page shows official channels only.', 'عند الإيقاف تعرض صفحة الاتصال القنوات الرسمية فقط.', true, false, 'public'),
  ('ff-news', 'news', 'News section on public pages', 'قسم الأخبار في الصفحات العامة', 'Sourced news items on the home page and /news.', 'أخبار موثقة في الصفحة الرئيسية وصفحة الأخبار.', true, false, 'public'),
  ('ff-nexus_links', 'nexus_links', 'Links into ENEC NEXUS', 'روابط إلى ENEC NEXUS', 'Shows deep links into NEXUS Academy, partner readiness and the directory.', 'يعرض روابط مباشرة إلى أكاديمية NEXUS وجاهزية الشركاء والدليل.', true, false, 'nexus'),
  ('ff-self_export', 'self_export', 'Self-service data export', 'تصدير البيانات ذاتياً', 'Lets signed-in users download their own data from My settings.', 'يتيح للمستخدمين تنزيل بياناتهم من "إعداداتي".', true, false, 'privacy'),
  ('ff-speak_up_no_telemetry', 'speak_up_no_telemetry', 'Speak-up: no telemetry (locked)', 'رفع المخاوف: بلا قياس (مقفل)', 'The speak-up route never sends analytics or audit events. Locked on by design.', 'لا يرسل مسار رفع المخاوف أي قياسات أو أحداث تدقيق. مفعّل دائماً بحكم التصميم.', true, true, 'safety'),
  ('ff-gamification_qualification', 'gamification_qualification', 'Points and badges on qualification work (locked off)', 'النقاط والشارات على أعمال التأهيل (مقفل)', 'Qualification is not a game. Locked off by design.', 'التأهيل ليس لعبة. مقفل بحكم التصميم.', false, true, 'safety')
on conflict (id) do nothing;

-- ───────────── M13 · Dalil turn log (kill switch, feature flag, mode gate, per-user / per-IP rate limit, concern redaction)
create or replace function kafaa_dalil_mode_allowed(p_mode text) returns boolean language sql stable security definer set search_path = public as $$
  select case
    when p_mode = 'public' then true
    when kafaa_me() is null then false
    when p_mode = 'applicant' then true
    when p_mode = 'staff' then kafaa_my_roles() && array['employee','licensed_operator','manager','instructor','training_manager','licensing_coord','hr_analyst','hr_director','editor','ecp_officer','admin','auditor']
    when p_mode = 'partner' then kafaa_my_roles() && array['partner_user','partner_admin','university']
    else false end
$$;

create or replace function kafaa_dalil_turn(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); s kafaa_dalil_settings; ses kafaa_advisor_sessions; a kafaa_audit_events;
  v_mode text := coalesce(p->>'mode', 'public'); v_key text; v_ip text; v_limit integer; v_used integer; v_n integer;
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
    -- per-IP when PostgREST passes the client address, otherwise the random per-browser key
    v_ip := split_part(coalesce(nullif(current_setting('request.headers', true), '')::json->>'x-forwarded-for', ''), ',', 1);
    v_key := case when v_ip <> '' then 'ip-' || md5(v_ip) else left(nullif(p->>'client_key', ''), 64) end;
    if v_key is null then return kafaa_refuse('dalil.turn', 'advisor_turns', null, 'invalid', 'A client key is required for anonymous use'); end if;
  end if;
  if length(trim(v_q)) = 0 or length(v_q) > 2000 then return kafaa_refuse('dalil.turn', 'advisor_turns', null, 'invalid', 'Questions must be 1 to 2,000 characters'); end if;
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
  insert into kafaa_advisor_turns (id, session_id, person_id, speaker, text, citations, refused, refusal_category, ts, intent, confidence, redacted, mode)
  values (ses.id || '-' || (v_n + 1), ses.id, me, 'user', case when v_redact then '[withheld: concern; Dalil showed the ECP channels]' else left(v_q, 2000) end,
          '[]'::jsonb, false, null, v_now, p->>'intent', null, v_redact, v_mode),
         (ses.id || '-' || (v_n + 2), ses.id, me, 'dalil', left(coalesce(p->>'answer', ''), 4000), coalesce(p->'citations', '[]'::jsonb),
          coalesce((p->>'refused')::boolean, false), p->>'refusal_category', v_now, p->>'intent', nullif(p->>'confidence', '')::numeric, false, v_mode);
  update kafaa_advisor_sessions set turns = v_n + 2, last_turn_at = v_now, mode = v_mode where id = ses.id;
  a := kafaa_audit('dalil.turn', 'advisor_turns', ses.id, 'ok', format('%s %s%s', v_mode, coalesce(p->>'intent', '-'),
        case when coalesce((p->>'refused')::boolean, false) then ' refused:' || coalesce(p->>'refusal_category', '') else '' end));
  return kafaa_result(true, 'ok', 'ok', a, null, jsonb_build_object('session_id', ses.id, 'used', v_used + 1, 'limit', v_limit, 'remaining', greatest(0, v_limit - v_used - 1)));
end $$;

create or replace function kafaa_dalil_handoff(p_session_id text, p_target text, p_consent boolean, p_note text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); ses kafaa_advisor_sessions; a kafaa_audit_events; v_roles text[];
begin
  if me is null then return kafaa_refuse('dalil.handoff', 'advisor_sessions', p_session_id, 'not_signed_in', 'Sign in to ask for a person, or use the contact form'); end if;
  if p_target not in ('careers', 'training', 'partner_desk') then return kafaa_refuse('dalil.handoff', 'advisor_sessions', p_session_id, 'invalid', 'Unknown team'); end if;
  if exists (select 1 from kafaa_feature_flags f where f.key = 'dalil_handoff' and not f.enabled) then
    return kafaa_refuse('dalil.handoff', 'advisor_sessions', p_session_id, 'disabled', 'Hand-off is switched off');
  end if;
  select * into ses from kafaa_advisor_sessions where id = p_session_id;
  if ses.id is null or ses.person_id is distinct from me then return kafaa_refuse('dalil.handoff', 'advisor_sessions', p_session_id, 'not_found', 'Conversation not found'); end if;
  update kafaa_advisor_sessions set handoff = p_target, handoff_consent = coalesce(p_consent, false), handoff_status = 'requested', handoff_note = nullif(left(coalesce(p_note, ''), 500), '') where id = p_session_id;
  v_roles := case p_target when 'careers' then array['hr_analyst','hr_director'] when 'training' then array['training_manager'] else array['admin'] end;
  insert into kafaa_notifications (id, person_id, kind, title_en, title_ar, body_en, body_ar, link, severity)
  select 'nt-' || replace(gen_random_uuid()::text, '-', ''), x.person_id, 'dalil_handoff', format('Dalil hand-off request (%s)', replace(p_target, '_', ' ')), 'طلب إحالة من دليل',
         case when p_consent then 'The user agreed to share the conversation.' else 'The user did not share the conversation; contact details only through the request.' end,
         case when p_consent then 'وافق المستخدم على مشاركة المحادثة.' else 'لم يشارك المستخدم المحادثة.' end, '/admin/dalil', 'info'
  from (select distinct ra.person_id from kafaa_role_assignments ra where ra.status = 'active' and ra.role = any(v_roles) limit 5) x;
  a := kafaa_audit('dalil.handoff', 'advisor_sessions', p_session_id, 'ok', format('%s consent=%s', p_target, coalesce(p_consent, false)));
  return kafaa_result(true, 'ok', 'Request sent', a);
end $$;

create or replace function kafaa_resolve_dalil_handoff(p_session_id text, p_status text) returns jsonb language plpgsql security definer set search_path = public as $$
declare ses kafaa_advisor_sessions; a kafaa_audit_events;
  v_role text := coalesce(kafaa_acting_role('dalil_config', array['W','A']),
    (select r from unnest(array['hr_analyst','hr_director','training_manager']) r where r = any(kafaa_my_roles()) order by r limit 1));
begin
  if v_role is null then return kafaa_refuse('dalil.handoff.resolve', 'advisor_sessions', p_session_id, 'forbidden', 'Only the receiving team or the AI owner may update a hand-off'); end if;
  if p_status not in ('picked_up', 'closed') then return kafaa_refuse('dalil.handoff.resolve', 'advisor_sessions', p_session_id, 'invalid', 'Unknown status', v_role); end if;
  select * into ses from kafaa_advisor_sessions where id = p_session_id;
  if ses.id is null or ses.handoff_status = 'none' then return kafaa_refuse('dalil.handoff.resolve', 'advisor_sessions', p_session_id, 'not_found', 'No hand-off on this conversation', v_role); end if;
  update kafaa_advisor_sessions set handoff_status = p_status where id = p_session_id;
  a := kafaa_audit('dalil.handoff.resolve', 'advisor_sessions', p_session_id, 'ok', p_status, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Updated', a);
end $$;

-- ───────────── M08 · ECP referral log (metadata only) and triage with transitions and closure outcome
create or replace function kafaa_log_concern_referral(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare a kafaa_audit_events; v_role text := kafaa_acting_role('concern_cases', array['A']); v_id text; v_ref text; v_year text; v_n integer; v_date date;
begin
  if v_role is null then return kafaa_refuse('ecp.log', 'concern_cases', null, 'forbidden', 'Only the ECP officer may log referrals'); end if;
  if coalesce(p->>'channel', '') not in ('ecp_office', 'intranet', 'phone', 'email', 'unit_rep', 'r2p_referral') or coalesce(p->>'category', '') not in ('nuclear_safety', 'quality', 'hird', 'other') then
    return kafaa_refuse('ecp.log', 'concern_cases', null, 'invalid', 'Unknown channel or category', v_role);
  end if;
  begin v_date := (p->>'received_on')::date; exception when others then v_date := null; end;
  if v_date is null or v_date > current_date then return kafaa_refuse('ecp.log', 'concern_cases', null, 'invalid', 'Received date must be today or earlier', v_role); end if;
  if length(trim(coalesce(p->>'ecp_system_ref', ''))) = 0 then return kafaa_refuse('ecp.log', 'concern_cases', null, 'invalid', 'The ECP system reference is required (the case itself stays in the ECP system)', v_role); end if;
  perform pg_advisory_xact_lock(hashtext('kafaa_ecp_ref'));
  v_year := to_char(v_date, 'YYYY');
  select coalesce(max(nullif(regexp_replace(ref_no, '^ECP-\d{4}-', ''), '')::int), 0) + 1 into v_n from kafaa_concern_cases where ref_no like 'ECP-' || v_year || '-%';
  v_ref := 'ECP-' || v_year || '-' || lpad(v_n::text, 3, '0');
  v_id := 'cc-' || replace(gen_random_uuid()::text, '-', '');
  insert into kafaa_concern_cases (id, ref_no, received_on, channel, anonymous, category, status, priority, ecp_system_ref, sample)
  values (v_id, v_ref, v_date, p->>'channel', coalesce((p->>'anonymous')::boolean, true), p->>'category', 'received',
          case when p->>'priority' in ('routine', 'priority', 'urgent') then p->>'priority' else 'routine' end, left(trim(p->>'ecp_system_ref'), 80), false);
  a := kafaa_audit('ecp.log', 'concern_cases', v_id, 'ok', format('%s %s anonymous=%s', p->>'channel', p->>'category', coalesce((p->>'anonymous')::boolean, true)), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Referral logged', a, null, jsonb_build_object('id', v_id, 'ref_no', v_ref));
end $$;

create or replace function kafaa_triage_concern_v2(p_id text, p_status text, p_priority text, p_outcome text) returns jsonb language plpgsql security definer set search_path = public as $$
declare c kafaa_concern_cases; a kafaa_audit_events; l integer; v_role text := kafaa_acting_role('concern_cases', array['A']); v_ok boolean;
begin
  if v_role is null then return kafaa_refuse('ecp.triage', 'concern_cases', p_id, 'forbidden', 'Only the ECP officer may triage referrals'); end if;
  select * into c from kafaa_concern_cases where id = p_id;
  if c.id is null then return kafaa_refuse('ecp.triage', 'concern_cases', p_id, 'not_found', 'Referral not found', v_role); end if;
  if p_status not in ('received', 'triaged', 'investigating', 'referred', 'closed') then return kafaa_refuse('ecp.triage', 'concern_cases', p_id, 'invalid', 'Unknown status', v_role); end if;
  if p_priority not in ('routine', 'priority', 'urgent') then return kafaa_refuse('ecp.triage', 'concern_cases', p_id, 'invalid', 'Unknown priority', v_role); end if;
  if c.status = 'closed' then return kafaa_refuse('ecp.triage', 'concern_cases', p_id, 'invalid', 'A closed referral cannot be reopened in Kafa''a; reopen it in the ECP system', v_role); end if;
  v_ok := case c.status
    when 'received' then p_status in ('received', 'triaged')
    when 'triaged' then p_status in ('triaged', 'investigating', 'referred', 'closed')
    when 'investigating' then p_status in ('investigating', 'referred', 'closed')
    when 'referred' then p_status in ('referred', 'closed') else false end;
  if not v_ok then return kafaa_refuse('ecp.triage', 'concern_cases', p_id, 'invalid', format('A referral cannot move from %s to %s', c.status, p_status), v_role); end if;
  if p_status = 'closed' and coalesce(p_outcome, '') not in ('substantiated', 'not_substantiated', 'referred_cap', 'referred_hr', 'referred_external', 'no_action') then
    return kafaa_refuse('ecp.triage', 'concern_cases', p_id, 'invalid', 'Closing needs an outcome category', v_role);
  end if;
  if p_status <> 'closed' and p_outcome is not null then return kafaa_refuse('ecp.triage', 'concern_cases', p_id, 'invalid', 'An outcome is recorded only when closing', v_role); end if;
  update kafaa_concern_cases set status = p_status, priority = p_priority, triage_owner_role = 'ECP officer', triaged_at = coalesce(triaged_at, now()),
    closed_on = case when p_status = 'closed' then current_date end, outcome = case when p_status = 'closed' then p_outcome end where id = p_id;
  l := kafaa_ledger('kafaa.ecp.triage', 'ECP referral triaged; no case content recorded');
  a := kafaa_audit('ecp.triage', 'concern_cases', p_id, 'ok', format('%s -> %s / %s%s', c.status, p_status, p_priority, coalesce(' / ' || p_outcome, '')), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Triage recorded', a, l);
end $$;

-- ───────────── M14 · quarterly access review of an elevated grant (keep or revoke; nobody reviews their own access)
create or replace function kafaa_review_role_access(p_id text, p_decision text, p_note text) returns jsonb language plpgsql security definer set search_path = public as $$
declare r kafaa_role_assignments; me text := kafaa_me(); a kafaa_audit_events; l integer;
begin
  if not kafaa_has_grant('users_roles', array['W']) then return kafaa_refuse('role.review', 'role_assignments', p_id, 'forbidden', 'Only an admin may record an access review'); end if;
  select * into r from kafaa_role_assignments where id = p_id;
  if r.id is null or r.status <> 'active' then return kafaa_refuse('role.review', 'role_assignments', p_id, 'not_found', 'No active grant', 'admin'); end if;
  if r.person_id = me then return kafaa_refuse('role.review', 'role_assignments', p_id, 'maker_checker', 'You cannot review your own access', 'admin'); end if;
  if p_decision not in ('keep', 'revoke') then return kafaa_refuse('role.review', 'role_assignments', p_id, 'invalid', 'Decision must be keep or revoke', 'admin'); end if;
  if p_decision = 'revoke' and length(trim(coalesce(p_note, ''))) < 5 then return kafaa_refuse('role.review', 'role_assignments', p_id, 'invalid', 'A revocation needs a reason', 'admin'); end if;
  update kafaa_role_assignments set reviewed_at = now(), reviewed_by = me,
    review_note = coalesce(nullif(left(coalesce(p_note, ''), 300), ''), case when p_decision = 'keep' then 'Quarterly access review: keep' end),
    status = case when p_decision = 'revoke' then 'revoked' else status end where id = p_id;
  l := kafaa_ledger('kafaa.role.review', format('%s %s access review: %s', r.person_id, r.role, p_decision));
  a := kafaa_audit('role.review', 'role_assignments', p_id, 'ok', format('%s: %s', r.role, p_decision), case when l is null then 'skipped' else 'written' end, l, 'admin');
  return kafaa_result(true, 'ok', case when p_decision = 'keep' then 'Review recorded' else 'Access revoked' end, a, l);
end $$;

-- ───────────── M16 · NEXUS evidence ledger entries written by Kafa'a (read-only; admin and auditor)
create or replace function kafaa_nexus_ledger() returns table (seq bigint, ts timestamptz, actor text, role text, plane text, domain text, action text, evidence_class text, reason text, prev_hash text, hash text, actor_persona_id text)
language sql stable security definer set search_path = public as $$
  select l.seq, l.ts, l.actor, l.role, l.plane, l.domain, l.action, l.evidence_class, l.reason, l.prev_hash, l.hash, l.actor_persona_id
  from ledger_entries l where l.domain = 'KAFAA' and kafaa_has_grant('audit_log', array['R']) order by l.seq desc limit 500
$$;

-- ───────────── Grants
revoke execute on function kafaa_dalil_mode_allowed(text), kafaa_dalil_handoff(text, text, boolean, text), kafaa_resolve_dalil_handoff(text, text),
  kafaa_log_concern_referral(jsonb), kafaa_triage_concern_v2(text, text, text, text), kafaa_review_role_access(text, text, text), kafaa_nexus_ledger() from public, anon;
grant execute on function kafaa_dalil_handoff(text, text, boolean, text), kafaa_resolve_dalil_handoff(text, text), kafaa_log_concern_referral(jsonb),
  kafaa_triage_concern_v2(text, text, text, text), kafaa_review_role_access(text, text, text), kafaa_nexus_ledger() to authenticated;
-- Dalil is public (rate-limited): anonymous visitors may log a turn; the function enforces kill switch, mode and quota itself.
revoke execute on function kafaa_dalil_turn(jsonb) from public;
grant execute on function kafaa_dalil_turn(jsonb) to anon, authenticated;
revoke execute on function kafaa_dalil_mode_allowed(text) from authenticated;
