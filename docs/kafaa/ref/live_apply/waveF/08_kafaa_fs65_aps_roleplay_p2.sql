-- kafaa_fs65_aps_roleplay_p2 (2/2) · from supabase/migrations/20261010265001_kafaa_fs65_aps_roleplay.sql
-- Apply with apply_migration name "kafaa_fs65_aps_roleplay_p2". Additive and idempotent; kafaa_* objects only.
-- summarise: criteria passed of all checked, %, pass flag against the mark, and the reasons.
create or replace function kafaa_rp_summary(p_turns jsonb, p_rubric jsonb, p_pass integer) returns jsonb language plpgsql immutable set search_path = public as $$
declare v_passed integer; v_total integer; v_pct integer; v_ready boolean; v_reasons jsonb; v_per jsonb; s jsonb; w jsonb;
begin
  select count(*) filter (where (c ->> 'pass')::boolean)::integer, count(*)::integer into v_passed, v_total
    from jsonb_array_elements(coalesce(p_turns, '[]'::jsonb)) t cross join lateral jsonb_array_elements(coalesce(t -> 'criteria', '[]'::jsonb)) c;
  v_pct := kafaa_rp_pct(v_passed, v_total);
  v_reasons := jsonb_build_array(jsonb_build_object('code', 'rp_score', 'key', 'm33.rp.reason.score', 'vars', jsonb_build_object('passed', v_passed, 'total', v_total, 'pct', v_pct)));
  select coalesce(jsonb_agg(jsonb_build_object('i', r.i, 'en', r.e ->> 'label_en', 'ar', r.e ->> 'label_ar', 'pct', kafaa_rp_pct(x.p, x.n)) order by r.i), '[]'::jsonb) into v_per
  from jsonb_array_elements(coalesce(p_rubric, '[]'::jsonb)) with ordinality r(e, i)
  cross join lateral (select count(*)::integer as n, count(*) filter (where (c ->> 'pass')::boolean)::integer as p
    from jsonb_array_elements(coalesce(p_turns, '[]'::jsonb)) t cross join lateral jsonb_array_elements(coalesce(t -> 'criteria', '[]'::jsonb)) c where c ->> 'id' = r.e ->> 'id') x
  where x.n > 0;
  if jsonb_array_length(v_per) > 1 then
    select e into s from jsonb_array_elements(v_per) e order by (e ->> 'pct')::integer desc, (e ->> 'i')::integer limit 1;
    select e into w from jsonb_array_elements(v_per) e order by (e ->> 'pct')::integer asc, (e ->> 'i')::integer limit 1;
    if (s ->> 'pct')::integer > (w ->> 'pct')::integer then
      v_reasons := v_reasons || jsonb_build_array(
        jsonb_build_object('code', 'rp_strong', 'key', 'm33.rp.reason.strong', 'vars', jsonb_build_object('criterion', jsonb_build_object('en', s ->> 'en', 'ar', s ->> 'ar'), 'pct', (s ->> 'pct')::integer)),
        jsonb_build_object('code', 'rp_develop', 'key', 'm33.rp.reason.develop', 'vars', jsonb_build_object('criterion', jsonb_build_object('en', w ->> 'en', 'ar', w ->> 'ar'), 'pct', (w ->> 'pct')::integer)));
    end if;
  end if;
  v_ready := v_total > 0 and v_pct >= p_pass;
  v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', case when v_ready then 'rp_ready' else 'rp_not_ready' end,
    'key', case when v_ready then 'm33.rp.reason.ready' else 'm33.rp.reason.notReady' end, 'vars', jsonb_build_object('mark', p_pass)),
    jsonb_build_object('code', 'rp_private', 'key', 'm33.rp.reason.private'));
  return jsonb_build_object('passed', v_passed, 'total', v_total, 'pct', v_pct, 'ready', v_ready, 'reasons', v_reasons);
end $$;
-- evidenceSkills: scenario skills that can carry the validated rating (existing, not obsolete, not security, not cyber hygiene), sorted.
create or replace function kafaa_rp_evidence_skills(p_ids text[]) returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(s.id order by s.id collate "C"), '{}'::text[]) from kafaa_skills s
  where s.id = any(coalesce(p_ids, '{}'::text[])) and coalesce(s.lifecycle, '') <> 'obsolete' and coalesce(s.area, '') <> 'security' and coalesce(s.fs_area, '') <> 'cyber_hygiene'
$$;
-- eligibleReviewers: active staff with an active instructor, training manager or HR authority assignment (recognition A), never the person.
create or replace function kafaa_rp_reviewers(p_person text) returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(p.id order by p.id collate "C"), '{}'::text[]) from kafaa_people p
  where p.kind = 'staff' and p.status = 'active' and p.id is distinct from p_person
    and exists (select 1 from kafaa_role_assignments r where r.person_id = p.id and r.status = 'active' and r.role in ('instructor', 'training_manager', 'hr_director'))
$$;
create or replace function kafaa_rp_role_of(p_person text) returns text language sql stable security definer set search_path = public as $$
  select coalesce((select x.r from (values ('hr_director', 1), ('training_manager', 2), ('instructor', 3)) x(r, o)
    where exists (select 1 from kafaa_role_assignments a where a.person_id = p_person and a.status = 'active' and a.role = x.r) order by x.o limit 1), '')
$$;
-- Notification (kind roleplay), idempotent by id; row-audit quiet like the LocalBackend.
create or replace function kafaa_rp_notify(p_id text, p_person text, p_en text, p_ar text, p_link text, p_sev text) returns boolean language plpgsql security definer set search_path = public as $$
declare v_prev text := current_setting('kafaa.seeding', true); n integer;
begin
  if p_person is null or not exists (select 1 from kafaa_people where id = p_person) or exists (select 1 from kafaa_notifications where id = p_id) then return false; end if;
  perform set_config('kafaa.seeding', 'on', true);
  insert into kafaa_notifications (id, person_id, kind, title_en, title_ar, link, severity) values (p_id, p_person, 'roleplay', p_en, p_ar, p_link, p_sev) on conflict (id) do nothing;
  get diagnostics n = row_count;
  perform set_config('kafaa.seeding', coalesce(v_prev, ''), true);
  return n > 0;
end $$;
create or replace function kafaa_rp_txt(p jsonb, p_max integer) returns boolean language sql immutable set search_path = public as $$
  select jsonb_typeof(p) = 'string' and char_length(btrim(p #>> '{}')) between 1 and p_max
$$;
-- checkProblem: true when a criterion's check is invalid.
create or replace function kafaa_rp_check_problem(c jsonb) returns boolean language sql immutable set search_path = public as $$
  select case
    when c is null or jsonb_typeof(c) <> 'object' then true
    when coalesce(c ->> 'type', '') not in ('cues', 'length', 'question', 'digit') or jsonb_typeof(c -> 'type') <> 'string' then true
    when c ->> 'type' = 'cues' and (jsonb_typeof(c -> 'cues') is distinct from 'array' or jsonb_array_length(c -> 'cues') not between 1 and 40
      or exists (select 1 from jsonb_array_elements(c -> 'cues') q where jsonb_typeof(q) <> 'string' or kafaa_rp_cue_key(q #>> '{}') = '' or char_length(q #>> '{}') > 60)) then true
    when c ->> 'type' = 'cues' and c ? 'min' and jsonb_typeof(c -> 'min') <> 'null' and not (kafaa_aps_int(c -> 'min', 1, 1000000) and (c ->> 'min')::numeric <= jsonb_array_length(c -> 'cues')) then true
    when c ->> 'type' = 'length' and not (kafaa_aps_int(c -> 'min', 1, 1000000) and kafaa_aps_int(c -> 'max', -1000000, 400) and (c ->> 'max')::numeric >= (c ->> 'min')::numeric) then true
    else false end
$$;
-- rpScenarioProblem: the first problem with a scenario, or null.
create or replace function kafaa_rp_problem(p jsonb) returns text language plpgsql stable security definer set search_path = public as $$
declare v_c jsonb; v_t jsonb; v_all text; v_ids text[];
begin
  if p is null or jsonb_typeof(p -> 'code') is distinct from 'string' or (p ->> 'code') !~ '^RP-[A-Z]{2}-[0-9]{2}$' then return 'code'; end if;
  if jsonb_typeof(p -> 'kind') is distinct from 'string' or (p ->> 'kind') not in ('pre_job_brief', 'shift_turnover', 'raise_concern', 'regulator_interview', 'knowledge_transfer', 'ai_peer_coaching') then return 'kind'; end if;
  if not (kafaa_rp_txt(p -> 'title_en', 140) and kafaa_rp_txt(p -> 'title_ar', 140) and kafaa_rp_txt(p -> 'summary_en', 400) and kafaa_rp_txt(p -> 'summary_ar', 400)
      and kafaa_rp_txt(p -> 'setting_en', 1200) and kafaa_rp_txt(p -> 'setting_ar', 1200) and kafaa_rp_txt(p -> 'counterpart_en', 120) and kafaa_rp_txt(p -> 'counterpart_ar', 120)
      and kafaa_rp_txt(p -> 'role_en', 120) and kafaa_rp_txt(p -> 'role_ar', 120)) then return 'text'; end if;
  if jsonb_typeof(p -> 'core_skill_ids') is distinct from 'array' or jsonb_array_length(p -> 'core_skill_ids') not between 1 and 3
     or exists (select 1 from jsonb_array_elements(p -> 'core_skill_ids') e where jsonb_typeof(e) <> 'string' or not exists (select 1 from kafaa_core_skills cs where cs.id = e #>> '{}' and cs.status = 'active')) then return 'core_skill'; end if;
  if jsonb_typeof(p -> 'skill_ids') is distinct from 'array' or jsonb_array_length(p -> 'skill_ids') not between 1 and 4
     or exists (select 1 from jsonb_array_elements(p -> 'skill_ids') e where jsonb_typeof(e) <> 'string' or not ((e #>> '{}') = any(kafaa_rp_evidence_skills(array[e #>> '{}'])))) then return 'skills'; end if;
  if not kafaa_aps_int(p -> 'level', 1, 2) then return 'level'; end if;
  if not kafaa_aps_int(p -> 'pass_pct', 50, 90) then return 'pass_pct'; end if;
  if not kafaa_aps_int(p -> 'est_minutes', 5, 40) then return 'minutes'; end if;
  if jsonb_typeof(p -> 'rubric') is distinct from 'array' or jsonb_array_length(p -> 'rubric') not between 3 and 8
     or (select count(distinct coalesce((e -> 'id')::text, '~undefined')) from jsonb_array_elements(p -> 'rubric') e) <> jsonb_array_length(p -> 'rubric') then return 'rubric'; end if;
  for v_c in select e from jsonb_array_elements(p -> 'rubric') with ordinality q(e, i) order by i loop
    if jsonb_typeof(v_c) <> 'object' or jsonb_typeof(v_c -> 'id') is distinct from 'string' or (v_c ->> 'id') !~ '^[a-z0-9_]{1,24}$'
       or not (kafaa_rp_txt(v_c -> 'label_en', 80) and kafaa_rp_txt(v_c -> 'label_ar', 80) and kafaa_rp_txt(v_c -> 'desc_en', 300) and kafaa_rp_txt(v_c -> 'desc_ar', 300)
         and kafaa_rp_txt(v_c -> 'tip_en', 300) and kafaa_rp_txt(v_c -> 'tip_ar', 300)) then return 'criterion'; end if;
    if kafaa_rp_check_problem(v_c -> 'check') then return 'check'; end if;
  end loop;
  if jsonb_typeof(p -> 'turns') is distinct from 'array' or jsonb_array_length(p -> 'turns') not between 3 and 5
     or (select count(distinct coalesce((e -> 'id')::text, '~undefined')) from jsonb_array_elements(p -> 'turns') e) <> jsonb_array_length(p -> 'turns') then return 'turns'; end if;
  select array_agg(e ->> 'id') into v_ids from jsonb_array_elements(p -> 'rubric') e;
  for v_t in select e from jsonb_array_elements(p -> 'turns') with ordinality q(e, i) order by i loop
    if jsonb_typeof(v_t) <> 'object' or jsonb_typeof(v_t -> 'id') is distinct from 'string' or (v_t ->> 'id') !~ '^[a-z0-9_]{1,24}$'
       or not (kafaa_rp_txt(v_t -> 'prompt_en', 600) and kafaa_rp_txt(v_t -> 'prompt_ar', 600) and kafaa_rp_txt(v_t -> 'hint_en', 300) and kafaa_rp_txt(v_t -> 'hint_ar', 300)
         and kafaa_rp_txt(v_t -> 'example_en', 1200) and kafaa_rp_txt(v_t -> 'example_ar', 1200)) then return 'turn'; end if;
    if jsonb_typeof(v_t -> 'criteria') is distinct from 'array' or jsonb_array_length(v_t -> 'criteria') not between 1 and 5
       or (select count(distinct e::text) from jsonb_array_elements(v_t -> 'criteria') e) <> jsonb_array_length(v_t -> 'criteria')
       or exists (select 1 from jsonb_array_elements(v_t -> 'criteria') e where jsonb_typeof(e) <> 'string' or not ((e #>> '{}') = any(v_ids))) then return 'turn_criteria'; end if;
  end loop;
  if exists (select 1 from unnest(v_ids) cid where not exists (select 1 from jsonb_array_elements(p -> 'turns') t cross join lateral jsonb_array_elements_text(t -> 'criteria') x where x = cid)) then return 'unused'; end if;
  select lower(array_to_string(array[coalesce(p ->> 'title_en', ''), coalesce(p ->> 'title_ar', ''), coalesce(p ->> 'summary_en', ''), coalesce(p ->> 'summary_ar', ''),
      coalesce(p ->> 'setting_en', ''), coalesce(p ->> 'setting_ar', ''), coalesce(p ->> 'counterpart_en', ''), coalesce(p ->> 'counterpart_ar', ''), coalesce(p ->> 'role_en', ''), coalesce(p ->> 'role_ar', '')]
    || coalesce((select array_agg(u.t order by q.i, u.j) from jsonb_array_elements(p -> 'turns') with ordinality q(e, i)
         cross join lateral unnest(array[coalesce(e ->> 'prompt_en', ''), coalesce(e ->> 'prompt_ar', ''), coalesce(e ->> 'hint_en', ''), coalesce(e ->> 'hint_ar', ''),
           coalesce(e ->> 'example_en', ''), coalesce(e ->> 'example_ar', '')]) with ordinality u(t, j)), '{}'::text[])
    || coalesce((select array_agg(u.t order by q.i, u.j) from jsonb_array_elements(p -> 'rubric') with ordinality q(e, i)
         cross join lateral unnest(array[coalesce(e ->> 'label_en', ''), coalesce(e ->> 'label_ar', ''), coalesce(e ->> 'desc_en', ''), coalesce(e ->> 'desc_ar', ''),
           coalesce(e ->> 'tip_en', ''), coalesce(e ->> 'tip_ar', '')]) with ordinality u(t, j)), '{}'::text[]), ' ')) into v_all;
  if exists (select 1 from unnest(array['vital area', 'protected area', 'security plan', 'guard force', 'design basis threat', 'safeguards', 'physical protection', 'alarm station', 'access code', 'firewall rule', 'network diagram', 'ip address', 'patrol route', 'badge reader']::text[]) w where position(w in v_all) > 0) then return 'restricted'; end if;
  if p ? 'status' and jsonb_typeof(p -> 'status') <> 'null' and coalesce(p ->> 'status', '') not in ('draft', 'published', 'retired') then return 'status'; end if;
  return null;
end $$;
-- rpStats: sessions of active staff in the last four quarters; pooled criteria rate; every cell under 10 people suppressed.
create or replace function kafaa_rp_stats_core(p_today date) returns jsonb language sql stable security definer set search_path = public as $$
  with win as (select kafaa_cs_quarter_shift(kafaa_cs_quarter(p_today), -k) as q from generate_series(0, 3) k),
  alls as (select s.*, sc.kind from kafaa_roleplay_sessions s join kafaa_people pe on pe.id = s.person_id and pe.kind = 'staff' and pe.status = 'active'
    left join kafaa_roleplay_scenarios sc on sc.id = s.scenario_id where s.period in (select q from win)),
  done as (select * from alls where status = 'completed' and total is not null and total > 0),
  t as (select (select count(distinct person_id)::integer from alls) as ppl, (select count(*)::integer from alls) as n, (select count(*)::integer from done) as d,
    (select coalesce(sum(passed), 0)::integer from done) as a, (select coalesce(sum(total), 0)::integer from done) as b,
    (select count(distinct person_id)::integer from alls where review_status = 'validated') as val)
  select jsonb_build_object('participants', case when t.ppl >= 10 then t.ppl end, 'sessions', case when t.ppl >= 10 then t.n end, 'completed', case when t.ppl >= 10 then t.d end,
    'pct', case when t.ppl >= 10 and t.b > 0 then kafaa_rp_pct(t.a, t.b) end, 'validated', case when t.ppl >= 10 and t.val >= 10 then t.val end,
    'by_kind', (select jsonb_agg(jsonb_build_object('kind', k.kind, 'people', case when g.p >= 10 then g.p end, 'pct', case when g.p >= 10 and g.b > 0 then kafaa_rp_pct(g.a, g.b) end) order by k.ord)
      from (values ('pre_job_brief', 1), ('shift_turnover', 2), ('raise_concern', 3), ('regulator_interview', 4), ('knowledge_transfer', 5), ('ai_peer_coaching', 6)) k(kind, ord)
      cross join lateral (select count(distinct person_id)::integer as p, coalesce(sum(passed), 0)::integer as a, coalesce(sum(total), 0)::integer as b from done where done.kind = k.kind) g))
  from t
$$;

-- ───────────── FS59 RPCs (skills_profile Own; reviewer recognition A; library secure_items A)
create or replace function kafaa_rp_result(s kafaa_roleplay_sessions) returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object('session_id', s.id, 'scenario_id', s.scenario_id, 'passed', s.passed, 'total', s.total, 'pct', s.pct, 'ready', s.ready, 'reasons', s.reasons, 'turns', s.turns)
$$;
create or replace function kafaa_start_roleplay(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_sid text := case when jsonb_typeof(p -> 'scenario_id') = 'string' then p ->> 'scenario_id' else '' end; sc kafaa_roleplay_scenarios;
  v_open kafaa_roleplay_sessions; v_n integer; v_id text; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('roleplay.start', 'roleplay_sessions', null, 'not_signed_in', 'Sign in to practise role-play'); end if;
  if not kafaa_has_grant('skills_profile', array['Own']) then return kafaa_refuse('roleplay.start', 'roleplay_sessions', null, 'forbidden', 'Role-play practice is for ENEC staff'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  select * into sc from kafaa_roleplay_scenarios where id = v_sid;
  if sc.id is null or sc.status <> 'published' then return kafaa_refuse('roleplay.start', 'roleplay_sessions', null, 'not_found', 'Scenario not found or not published', v_role); end if;
  select * into v_open from kafaa_roleplay_sessions where person_id = me and scenario_id = v_sid and status = 'in_progress' order by started_at desc, id collate "C" desc limit 1;
  if v_open.id is not null then
    v_n := jsonb_array_length(v_open.turns);
    a := kafaa_audit('roleplay.start', 'roleplay_sessions', v_open.id, 'ok', 'resumed', 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Practice resumed', a, null, jsonb_build_object('session_id', v_open.id, 'scenario_id', v_sid, 'done', false, 'answered', v_n,
      'total', jsonb_array_length(sc.turns), 'turn', sc.turns -> v_n, 'feedback', null, 'result', null, 'resumed', true));
  end if;
  v_id := 'rp-s-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
  insert into kafaa_roleplay_sessions (id, person_id, scenario_id, scenario_version, period, status, turns, passed, total, pct, ready, reasons, started_at, completed_at, review_status,
    reviewer_id, review_context, requested_at, reviewed_by, reviewed_at, review_note, level, evidence_ids)
  values (v_id, me, v_sid, sc.version, kafaa_cs_quarter(current_date), 'in_progress', '[]'::jsonb, null, null, null, false, '[]'::jsonb, now(), null, 'none', null, null, null, null, null, null, 0, '{}'::text[]);
  a := kafaa_audit('roleplay.start', 'roleplay_sessions', v_id, 'ok', v_sid, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Practice started', a, null, jsonb_build_object('session_id', v_id, 'scenario_id', v_sid, 'done', false, 'answered', 0,
    'total', jsonb_array_length(sc.turns), 'turn', sc.turns -> 0, 'feedback', null, 'result', null, 'resumed', false));
end $$;

-- A speak-up topic returns code speak_up before anything is written: no session change, no audit row (M08 rule), nothing of the text kept.
create or replace function kafaa_roleplay_turn(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_text text := case when jsonb_typeof(p -> 'text') = 'string' then p ->> 'text' else '' end; me text; v_role text;
  v_sid text := case when jsonb_typeof(p -> 'session_id') = 'string' then p ->> 'session_id' else '' end; s kafaa_roleplay_sessions; sc kafaa_roleplay_scenarios; v_turn jsonb;
  v_res jsonb; v_turns jsonb; v_fb jsonb; v_sum jsonb; v_passed integer; v_total integer; a kafaa_audit_events;
begin
  if kafaa_rp_speak_up(v_text) then
    return kafaa_result(false, 'speak_up', 'This sounds like a real concern, not practice. Use the speak-up channels; nothing you typed was stored.', null::kafaa_audit_events, null, jsonb_build_object('route', '/speak-up'));
  end if;
  me := kafaa_me();
  if me is null then return kafaa_refuse('roleplay.turn', 'roleplay_sessions', nullif(v_sid, ''), 'not_signed_in', 'Sign in to practise role-play'); end if;
  if not kafaa_has_grant('skills_profile', array['Own']) then return kafaa_refuse('roleplay.turn', 'roleplay_sessions', nullif(v_sid, ''), 'forbidden', 'Role-play practice is for ENEC staff'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  select * into s from kafaa_roleplay_sessions where id = v_sid for update;
  if s.id is null or s.person_id <> me then return kafaa_refuse('roleplay.turn', 'roleplay_sessions', nullif(v_sid, ''), 'not_found', 'Session not found', v_role); end if;
  if s.status <> 'in_progress' then return kafaa_refuse('roleplay.turn', 'roleplay_sessions', v_sid, 'invalid', 'This session is already complete', v_role); end if;
  select * into sc from kafaa_roleplay_scenarios where id = s.scenario_id;
  if sc.id is null then return kafaa_refuse('roleplay.turn', 'roleplay_sessions', v_sid, 'not_found', 'Scenario not found or not published', v_role); end if;
  v_turn := sc.turns -> jsonb_array_length(s.turns);
  if v_turn is null or jsonb_typeof(p -> 'turn_id') is distinct from 'string' or p ->> 'turn_id' is distinct from v_turn ->> 'id' then
    return kafaa_refuse('roleplay.turn', 'roleplay_sessions', v_sid, 'invalid', 'Answer the turn on screen first', v_role); end if;
  if char_length(regexp_replace(v_text, '^\s+|\s+$', '', 'g')) not between 3 and 2000 then return kafaa_refuse('roleplay.turn', 'roleplay_sessions', v_sid, 'invalid', 'Write between 3 and 2,000 characters', v_role); end if;
  if kafaa_cop_guard(v_text) is not null then
    return kafaa_refuse('roleplay.turn', 'roleplay_sessions', v_sid, 'security_restricted', 'Practice answers never touch plant security, safeguards or cyber details; nothing was stored', v_role); end if;
  v_res := kafaa_rp_eval(v_turn, sc.rubric, v_text) || jsonb_build_object('at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
  v_turns := s.turns || jsonb_build_array(v_res);
  select count(*) filter (where (c ->> 'pass')::boolean)::integer, count(*)::integer into v_passed, v_total from jsonb_array_elements(v_res -> 'criteria') c;
  v_fb := v_res || jsonb_build_object('passed', v_passed, 'total', v_total);
  if jsonb_array_length(v_turns) < jsonb_array_length(sc.turns) then
    update kafaa_roleplay_sessions set turns = v_turns where id = v_sid;
    a := kafaa_audit('roleplay.turn', 'roleplay_sessions', v_sid, 'ok', v_passed || '/' || v_total, 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Answer checked', a, null, jsonb_build_object('session_id', v_sid, 'scenario_id', sc.id, 'done', false, 'answered', jsonb_array_length(v_turns),
      'total', jsonb_array_length(sc.turns), 'turn', sc.turns -> jsonb_array_length(v_turns), 'feedback', v_fb, 'result', null));
  end if;
  v_sum := kafaa_rp_summary(v_turns, sc.rubric, sc.pass_pct);
  update kafaa_roleplay_sessions set turns = v_turns, status = 'completed', completed_at = now(), passed = (v_sum ->> 'passed')::integer, total = (v_sum ->> 'total')::integer,
    pct = (v_sum ->> 'pct')::integer, ready = (v_sum ->> 'ready')::boolean, reasons = v_sum -> 'reasons' where id = v_sid returning * into s;
  a := kafaa_audit('roleplay.complete', 'roleplay_sessions', v_sid, 'ok', v_sum ->> 'pct', 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Session complete', a, null, jsonb_build_object('session_id', v_sid, 'scenario_id', sc.id, 'done', true, 'answered', jsonb_array_length(v_turns),
    'total', jsonb_array_length(sc.turns), 'turn', null, 'feedback', v_fb, 'result', kafaa_rp_result(s)));
end $$;

create or replace function kafaa_roleplay_context() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); st jsonb;
begin
  if me is null or not kafaa_has_grant('skills_profile', array['Own']) then return null; end if;
  st := kafaa_rp_stats_core(current_date);
  return jsonb_build_object('period', kafaa_cs_quarter(current_date),
    'open', (select coalesce(jsonb_agg(jsonb_build_object('session_id', s.id, 'scenario_id', s.scenario_id) order by s.started_at desc, s.id collate "C" desc), '[]'::jsonb)
      from kafaa_roleplay_sessions s where s.person_id = me and s.status = 'in_progress'),
    'sessions', (select count(*) from kafaa_roleplay_sessions where person_id = me), 'completed', (select count(*) from kafaa_roleplay_sessions where person_id = me and status = 'completed'),
    'validated', (select count(*) from kafaa_roleplay_sessions where person_id = me and review_status = 'validated'),
    'enec_pct', st -> 'pct', 'enec_n', case when st ->> 'pct' is null then null else st -> 'participants' end);
end $$;

create or replace function kafaa_roleplay_reviewers() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me();
begin
  if me is null or not kafaa_has_grant('skills_profile', array['Own']) then return null; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name_en', coalesce(p.display_name, ''), 'name_ar', coalesce(nullif(p.display_name_ar, ''), p.display_name, ''),
    'role', kafaa_rp_role_of(p.id)) order by p.id collate "C"), '[]'::jsonb) from kafaa_people p where p.id = any(kafaa_rp_reviewers(me)));
end $$;

create or replace function kafaa_request_roleplay_review(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_ctx text := case when jsonb_typeof(p -> 'context') = 'string' then p ->> 'context' else '' end; me text; v_role text;
  v_sid text := case when jsonb_typeof(p -> 'session_id') = 'string' then p ->> 'session_id' else '' end; v_rid text := case when jsonb_typeof(p -> 'reviewer_id') = 'string' then p ->> 'reviewer_id' else '' end;
  s kafaa_roleplay_sessions; sc kafaa_roleplay_scenarios; v_c text; a kafaa_audit_events;
begin
  if kafaa_rp_speak_up(v_ctx) then
    return kafaa_result(false, 'speak_up', 'This sounds like a real concern, not practice. Use the speak-up channels; nothing you typed was stored.', null::kafaa_audit_events, null, jsonb_build_object('route', '/speak-up'));
  end if;
  me := kafaa_me();
  if me is null then return kafaa_refuse('roleplay.review.request', 'roleplay_sessions', nullif(v_sid, ''), 'not_signed_in', 'Sign in to practise role-play'); end if;
  if not kafaa_has_grant('skills_profile', array['Own']) then return kafaa_refuse('roleplay.review.request', 'roleplay_sessions', nullif(v_sid, ''), 'forbidden', 'Role-play practice is for ENEC staff'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  select * into s from kafaa_roleplay_sessions where id = v_sid for update;
  if s.id is null or s.person_id <> me then return kafaa_refuse('roleplay.review.request', 'roleplay_sessions', nullif(v_sid, ''), 'not_found', 'Session not found', v_role); end if;
  if s.status <> 'completed' then return kafaa_refuse('roleplay.review.request', 'roleplay_sessions', v_sid, 'invalid', 'Finish the session before asking for a review', v_role); end if;
  if s.review_status in ('requested', 'validated') then return kafaa_refuse('roleplay.review.request', 'roleplay_sessions', v_sid, 'conflict', 'A review is already requested or decided for this session', v_role); end if;
  if not s.ready then return kafaa_refuse('roleplay.review.request', 'roleplay_sessions', v_sid, 'invalid', 'This session is below the scenario''s mark; practise again before asking for a review', v_role); end if;
  if not (v_rid = any(kafaa_rp_reviewers(me))) then
    return kafaa_refuse('roleplay.review.request', 'roleplay_sessions', v_sid, 'invalid', 'Choose a reviewer from the list: an instructor, the training manager or the HR authority, never yourself', v_role); end if;
  v_c := regexp_replace(v_ctx, '^\s+|\s+$', '', 'g');
  if char_length(v_c) not between 5 and 400 then return kafaa_refuse('roleplay.review.request', 'roleplay_sessions', v_sid, 'invalid', 'Tell the reviewer the practice context in 5 to 400 characters', v_role); end if;
  if kafaa_cop_guard(v_ctx) is not null then
    return kafaa_refuse('roleplay.review.request', 'roleplay_sessions', v_sid, 'security_restricted', 'Practice answers never touch plant security, safeguards or cyber details; nothing was stored', v_role); end if;
  if kafaa_cop_contact(v_ctx) then return kafaa_refuse('roleplay.review.request', 'roleplay_sessions', v_sid, 'contact_details', 'Remove email addresses and phone numbers', v_role); end if;
  update kafaa_roleplay_sessions set review_status = 'requested', reviewer_id = v_rid, review_context = v_c, requested_at = now(), reviewed_by = null, reviewed_at = null, review_note = null where id = v_sid;
  select * into sc from kafaa_roleplay_scenarios where id = s.scenario_id;
  perform kafaa_rp_notify('nt-rp-' || v_sid || '-req-' || v_rid, v_rid, 'Role-play feedback to review: ' || coalesce(sc.title_en, ''), 'ملاحظات تمرين لعب أدوار بانتظار مراجعتك: ' || coalesce(sc.title_ar, ''),
    '/training/role-play?tab=reviews', 'info');
  a := kafaa_audit('roleplay.review.request', 'roleplay_sessions', v_sid, 'ok', v_rid, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Review requested: the reviewer sees this session''s feedback, never your answers', a, null, jsonb_build_object('review_status', 'requested'));
end $$;

create or replace function kafaa_withdraw_roleplay_review(p_session_id text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_sid text := coalesce(p_session_id, ''); s kafaa_roleplay_sessions; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('roleplay.review.withdraw', 'roleplay_sessions', nullif(v_sid, ''), 'not_signed_in', 'Sign in to practise role-play'); end if;
  if not kafaa_has_grant('skills_profile', array['Own']) then return kafaa_refuse('roleplay.review.withdraw', 'roleplay_sessions', nullif(v_sid, ''), 'forbidden', 'Role-play practice is for ENEC staff'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  select * into s from kafaa_roleplay_sessions where id = v_sid for update;
  if s.id is null or s.person_id <> me then return kafaa_refuse('roleplay.review.withdraw', 'roleplay_sessions', nullif(v_sid, ''), 'not_found', 'Session not found', v_role); end if;
  if s.review_status <> 'requested' then return kafaa_refuse('roleplay.review.withdraw', 'roleplay_sessions', v_sid, 'invalid', 'No review is waiting for this session', v_role); end if;
  update kafaa_roleplay_sessions set review_status = 'withdrawn' where id = v_sid;
  a := kafaa_audit('roleplay.review.withdraw', 'roleplay_sessions', v_sid, 'ok', null, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Review request withdrawn', a, null, jsonb_build_object('review_status', 'withdrawn'));
end $$;

create or replace function kafaa_rp_queue_item(s kafaa_roleplay_sessions) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('session_id', s.id, 'person_id', s.person_id, 'person_name', coalesce(pe.display_name, ''), 'person_name_ar', coalesce(nullif(pe.display_name_ar, ''), pe.display_name, ''),
    'scenario_id', s.scenario_id, 'code', coalesce(sc.code, ''), 'kind', coalesce(sc.kind, ''), 'title_en', coalesce(sc.title_en, ''), 'title_ar', coalesce(sc.title_ar, ''),
    'level', coalesce(sc.level, 1), 'pass_pct', coalesce(sc.pass_pct, 70), 'passed', coalesce(s.passed, 0), 'total', coalesce(s.total, 0), 'pct', coalesce(s.pct, 0), 'turns', s.turns,
    'rubric', coalesce(sc.rubric, '[]'::jsonb), 'completed_at', s.completed_at, 'requested_at', s.requested_at, 'review_context', s.review_context, 'review_status', s.review_status,
    'reviewed_at', s.reviewed_at, 'review_note', s.review_note, 'skills', to_jsonb(case when sc.id is null then '{}'::text[] else kafaa_rp_evidence_skills(sc.skill_ids) end),
    'evidence_ids', to_jsonb(s.evidence_ids))
  from (select 1) one left join kafaa_people pe on pe.id = s.person_id left join kafaa_roleplay_scenarios sc on sc.id = s.scenario_id
$$;
-- The reviewer's queue: only sessions sent to me (recognition A). Never anyone else's sessions.
create or replace function kafaa_roleplay_review_queue() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me();
begin
  if me is null or not kafaa_has_grant('recognition', array['A']) then return null; end if;
  return jsonb_build_object(
    'items', (select coalesce(jsonb_agg(kafaa_rp_queue_item(s) order by s.requested_at, s.id collate "C"), '[]'::jsonb) from kafaa_roleplay_sessions s where s.reviewer_id = me and s.review_status = 'requested'),
    'decided', (select coalesce(jsonb_agg(kafaa_rp_queue_item(x) order by x.reviewed_at desc, x.id collate "C"), '[]'::jsonb) from (
      select * from kafaa_roleplay_sessions s where s.reviewer_id = me and s.review_status in ('validated', 'declined') order by s.reviewed_at desc, s.id collate "C" limit 20) x));
end $$;

-- The named reviewer validates (F01 evidence kind rating, basis validated, ref_table roleplay_sessions, level 1-2; recompute; ledger) or declines.
create or replace function kafaa_attach_roleplay_evidence(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_sid text := case when jsonb_typeof(p -> 'session_id') = 'string' then p ->> 'session_id' else '' end; s kafaa_roleplay_sessions;
  sc kafaa_roleplay_scenarios; v_dec text := case when jsonb_typeof(p -> 'decision') = 'string' then p ->> 'decision' end;
  v_note text := case when jsonb_typeof(p -> 'note') = 'string' then btrim(p ->> 'note') else '' end; v_skills text[]; v_level integer; v_ids text[] := '{}'::text[]; v_eid text; k text;
  a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('roleplay.review.decide', 'roleplay_sessions', nullif(v_sid, ''), 'not_signed_in', 'Sign in to practise role-play'); end if;
  if not kafaa_has_grant('recognition', array['A']) then
    return kafaa_refuse('roleplay.review.decide', 'roleplay_sessions', nullif(v_sid, ''), 'forbidden', 'Only instructors, the training manager and the HR authority validate role-play feedback'); end if;
  v_role := kafaa_acting_role('recognition', array['A']);
  select * into s from kafaa_roleplay_sessions where id = v_sid for update;
  if s.id is null then return kafaa_refuse('roleplay.review.decide', 'roleplay_sessions', nullif(v_sid, ''), 'not_found', 'Session not found', v_role); end if;
  if s.person_id = me then return kafaa_refuse('roleplay.review.decide', 'roleplay_sessions', v_sid, 'maker_checker', 'You cannot validate your own session', v_role); end if;
  if s.review_status <> 'requested' then return kafaa_refuse('roleplay.review.decide', 'roleplay_sessions', v_sid, 'invalid', 'No review is waiting for this session', v_role); end if;
  if s.reviewer_id is distinct from me then return kafaa_refuse('roleplay.review.decide', 'roleplay_sessions', v_sid, 'forbidden', 'Only the reviewer this session was sent to can decide it', v_role); end if;
  if v_dec is null or v_dec not in ('validate', 'decline') or (v_dec = 'decline' and char_length(v_note) not between 5 and 300) or char_length(v_note) > 300 then
    return kafaa_refuse('roleplay.review.decide', 'roleplay_sessions', v_sid, 'invalid', 'Choose validate or decline; a decline needs a reason of 5 to 300 characters', v_role); end if;
  select * into sc from kafaa_roleplay_scenarios where id = s.scenario_id;
  v_skills := case when sc.id is null then '{}'::text[] else kafaa_rp_evidence_skills(sc.skill_ids) end;
  if v_dec = 'validate' and coalesce(cardinality(v_skills), 0) = 0 then return kafaa_refuse('roleplay.review.decide', 'roleplay_sessions', v_sid, 'invalid', 'This scenario names no skill that can carry evidence', v_role); end if;
  if v_dec = 'decline' then
    update kafaa_roleplay_sessions set review_status = 'declined', reviewed_by = me, reviewed_at = now(), review_note = v_note where id = v_sid;
    perform kafaa_rp_notify('nt-rp-' || v_sid || '-declined', s.person_id, 'Role-play feedback not validated yet: ' || coalesce(sc.title_en, ''), 'لم تُعتمد ملاحظات تمرين لعب الأدوار بعد: ' || coalesce(sc.title_ar, ''),
      '/my/role-play?tab=history', 'warn');
    a := kafaa_audit('roleplay.review.decide', 'roleplay_sessions', v_sid, 'ok', 'declined: ' || v_note, 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Returned with your reason; no evidence was written', a, null, jsonb_build_object('review_status', 'declined', 'evidence_ids', '[]'::jsonb));
  end if;
  v_level := greatest(1, least(2, sc.level));
  perform set_config('kafaa.seeding', 'on', true);
  foreach k in array v_skills loop
    v_eid := 'se:roleplay:' || v_sid || ':' || k;
    insert into kafaa_skill_evidence (id, person_id, skill_id, kind, ref_table, ref_id, level, basis, status, observed_on, note, recorded_by, active)
    values (v_eid, s.person_id, k, 'rating', 'roleplay_sessions', v_sid, v_level, 'validated', 'current', current_date,
      format('Validated role-play feedback (%s, %s of %s criteria)', sc.code, s.passed, s.total), me, true)
    on conflict (id) do update set level = excluded.level, basis = 'validated', status = 'current', observed_on = excluded.observed_on, note = excluded.note, recorded_by = me, active = true;
    v_ids := v_ids || v_eid;
  end loop;
  update kafaa_roleplay_sessions set review_status = 'validated', reviewed_by = me, reviewed_at = now(), review_note = nullif(v_note, ''), level = v_level, evidence_ids = v_ids where id = v_sid;
  perform kafaa_skills_apply(s.person_id, current_date);
  perform kafaa_rp_notify('nt-rp-' || v_sid || '-validated', s.person_id, 'Role-play feedback validated: ' || sc.title_en, 'اعتُمدت ملاحظات تمرين لعب الأدوار: ' || sc.title_ar, '/my/skills', 'ok');
  l := kafaa_ledger('kafaa.roleplay.evidence', format('Role-play session %s by %s validated by %s: %s skill evidence rows (validated rating, level %s); practice feedback, not a qualification',
    v_sid, s.person_id, me, cardinality(v_ids), v_level));
  a := kafaa_audit('roleplay.review.decide', 'roleplay_sessions', v_sid, 'ok', format('validated %s skills at level %s', cardinality(v_ids), v_level), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Validated: the evidence is on their skills profile', a, l, jsonb_build_object('review_status', 'validated', 'evidence_ids', to_jsonb(v_ids)));
end $$;

create or replace function kafaa_roleplay_stats() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if kafaa_me() is null or not kafaa_has_grant('skills_profile', array['Agg']) then return null; end if;
  return kafaa_rp_stats_core(current_date);
end $$;

create or replace function kafaa_save_roleplay_scenario(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_given text := case when jsonb_typeof(p -> 'id') = 'string' then nullif(p ->> 'id', '') end; cur kafaa_roleplay_scenarios; v_problem text;
  v_status text; v_id text; v_version integer; v_sort integer; v_turns jsonb; v_rubric jsonb; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('roleplay.scenario', 'roleplay_scenarios', v_given, 'not_signed_in', 'Sign in to practise role-play'); end if;
  if not kafaa_has_grant('secure_items', array['A']) then return kafaa_refuse('roleplay.scenario', 'roleplay_scenarios', v_given, 'forbidden', 'Only the training manager edits the role-play library'); end if;
  v_role := kafaa_acting_role('secure_items', array['A']);
  if v_given is not null then
    select * into cur from kafaa_roleplay_scenarios where id = v_given;
    if cur.id is null then return kafaa_refuse('roleplay.scenario', 'roleplay_scenarios', v_given, 'not_found', 'Scenario not found', v_role); end if;
  end if;
  v_problem := kafaa_rp_problem(p);
  if v_problem is not null then
    return kafaa_refuse('roleplay.scenario', 'roleplay_scenarios', v_given, 'invalid', 'Check the scenario: ' || case v_problem
      when 'code' then 'a code like RP-PB-01' when 'kind' then 'a known kind' when 'text' then 'title, summary, setting, counterpart and your role in English and Arabic'
      when 'core_skill' then 'one to three core skills' when 'skills' then 'one to four catalogue skills that can carry evidence' when 'level' then 'evidence level 1 or 2'
      when 'pass_pct' then 'a mark between 50 and 90%' when 'minutes' then '5 to 40 minutes' when 'rubric' then 'three to eight criteria with distinct ids'
      when 'criterion' then 'every criterion needs a label, what it looks for and a tip in English and Arabic'
      when 'check' then 'every criterion needs a valid check (cue words, length, a question or a number)' when 'turns' then 'three to five turns with distinct ids'
      when 'turn' then 'every turn needs the counterpart''s line, a hint and an example answer in English and Arabic' when 'turn_criteria' then 'every turn checks one to five known criteria'
      when 'unused' then 'every criterion is checked by at least one turn' when 'restricted' then 'scenarios never touch plant security'
      else 'status draft, published or retired' end, v_role);
  end if;
  if exists (select 1 from kafaa_roleplay_scenarios where code = p ->> 'code' and id is distinct from cur.id) then
    return kafaa_refuse('roleplay.scenario', 'roleplay_scenarios', v_given, 'conflict', 'Another scenario already uses this code', v_role); end if;
  v_status := case when p ->> 'status' in ('published', 'retired') then p ->> 'status' else 'draft' end;
  if cur.id is not null and cur.status = 'published' and v_status <> 'published' and (select count(*) from kafaa_roleplay_scenarios where status = 'published' and id <> cur.id) < 3 then
    return kafaa_refuse('roleplay.scenario', 'roleplay_scenarios', v_given, 'conflict', 'Keep at least three published scenarios', v_role); end if;
  select jsonb_agg(jsonb_build_object('id', e ->> 'id', 'prompt_en', btrim(e ->> 'prompt_en'), 'prompt_ar', btrim(e ->> 'prompt_ar'), 'hint_en', btrim(e ->> 'hint_en'), 'hint_ar', btrim(e ->> 'hint_ar'),
    'example_en', btrim(e ->> 'example_en'), 'example_ar', btrim(e ->> 'example_ar'), 'criteria', e -> 'criteria') order by i) into v_turns from jsonb_array_elements(p -> 'turns') with ordinality q(e, i);
  select jsonb_agg(jsonb_build_object('id', e ->> 'id', 'label_en', btrim(e ->> 'label_en'), 'label_ar', btrim(e ->> 'label_ar'), 'desc_en', btrim(e ->> 'desc_en'), 'desc_ar', btrim(e ->> 'desc_ar'),
    'tip_en', btrim(e ->> 'tip_en'), 'tip_ar', btrim(e ->> 'tip_ar'), 'check', e -> 'check') order by i) into v_rubric from jsonb_array_elements(p -> 'rubric') with ordinality q(e, i);
  if cur.id is not null then
    v_id := cur.id; v_version := cur.version + 1;
    update kafaa_roleplay_scenarios set code = p ->> 'code', kind = p ->> 'kind', title_en = btrim(p ->> 'title_en'), title_ar = btrim(p ->> 'title_ar'), summary_en = btrim(p ->> 'summary_en'),
      summary_ar = btrim(p ->> 'summary_ar'), setting_en = btrim(p ->> 'setting_en'), setting_ar = btrim(p ->> 'setting_ar'), counterpart_en = btrim(p ->> 'counterpart_en'),
      counterpart_ar = btrim(p ->> 'counterpart_ar'), role_en = btrim(p ->> 'role_en'), role_ar = btrim(p ->> 'role_ar'),
      core_skill_ids = array(select jsonb_array_elements_text(p -> 'core_skill_ids')), skill_ids = array(select jsonb_array_elements_text(p -> 'skill_ids')),
      level = (p ->> 'level')::integer, pass_pct = (p ->> 'pass_pct')::integer, est_minutes = (p ->> 'est_minutes')::integer, turns = v_turns, rubric = v_rubric, status = v_status,
      listed = v_status = 'published', version = v_version, updated_by = me, updated_at = now() where id = v_id;
  else
    v_id := 'rp-' || lower(p ->> 'code') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6); v_version := 1;
    select coalesce(max(sort), 0) + 1 into v_sort from kafaa_roleplay_scenarios;
    insert into kafaa_roleplay_scenarios (id, code, kind, title_en, title_ar, summary_en, summary_ar, setting_en, setting_ar, counterpart_en, counterpart_ar, role_en, role_ar, core_skill_ids, skill_ids,
      level, pass_pct, est_minutes, turns, rubric, sources, status, listed, version, sort, updated_by, updated_at)
    values (v_id, p ->> 'code', p ->> 'kind', btrim(p ->> 'title_en'), btrim(p ->> 'title_ar'), btrim(p ->> 'summary_en'), btrim(p ->> 'summary_ar'), btrim(p ->> 'setting_en'), btrim(p ->> 'setting_ar'),
      btrim(p ->> 'counterpart_en'), btrim(p ->> 'counterpart_ar'), btrim(p ->> 'role_en'), btrim(p ->> 'role_ar'), array(select jsonb_array_elements_text(p -> 'core_skill_ids')),
      array(select jsonb_array_elements_text(p -> 'skill_ids')), (p ->> 'level')::integer, (p ->> 'pass_pct')::integer, (p ->> 'est_minutes')::integer, v_turns, v_rubric, '[]'::jsonb,
      v_status, v_status = 'published', 1, v_sort, me, now());
  end if;
  a := kafaa_audit('roleplay.scenario', 'roleplay_scenarios', v_id, 'ok', 'v' || v_version || ' ' || v_status, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when cur.id is not null then 'Scenario saved' else 'Scenario added' end, a, null, jsonb_build_object('id', v_id, 'version', v_version, 'status', v_status));
end $$;

-- ───────────── Shared (handover 3.9): the recorded-evidence lists gain 'roleplay_sessions' (copied from the fs5qa body; only the two lists change)
-- @@SHARED-BEGIN@@
create or replace function kafaa_skill_states_v2(p_person text, p_now date, p_hl jsonb default null)
returns table (id text, person_id text, skill_id text, level integer, confidence numeric, basis text, reasons jsonb, evidence_count integer,
               confidence_band text, conf_low numeric, conf_high numeric)
language sql stable security definer set search_path = public as $$
  with hm as (select kafaa_skill_hl_months(p_hl) m),
  hl as (
    select (m ->> 'fast')::float8 as fm, (m ->> 'standard')::float8 as sm, (m ->> 'slow')::float8 as lm,
           floor((m ->> 'fast')::float8 * 30.4375 + 0.5)::integer as fd, floor((m ->> 'standard')::float8 * 30.4375 + 0.5)::integer as sd,
           floor((m ->> 'slow')::float8 * 30.4375 + 0.5)::integer as ld
    from hm
  ),
  ev as (
    select d.id, d.person_id, d.skill_id, d.kind, d.level, d.basis, d.status, d.observed_on from kafaa_skill_evidence_derive(p_person, p_now) d
    union all
    select e.id, e.person_id, e.skill_id, e.kind, e.level, e.basis, e.status, e.observed_on from kafaa_skill_evidence e
    where e.active and (e.kind in ('rating', 'ojt', 'credential') or e.ref_table in ('fitness_attempts', 'adaptive_attempts', 'task_attempts', 'ai_drill_attempts', 'plant_visits', 'twin_attempts', 'lectures', 'knowledge_assets', 'roleplay_sessions')) and (p_person is null or e.person_id = p_person)
  ),
  s1 as (
    select ev.*, (ev.kind = 'qual' and ev.status = 'current') as holds, greatest(0, p_now - ev.observed_on) as age,
           kafaa_skill_decay_class(k.area, to_jsonb(k) ->> 'decay_class') as cls
    from ev left join kafaa_skills k on k.id = ev.skill_id
  ),
  s2 as (
    select s1.*,
      case s1.cls when 'fast' then h.fd when 'slow' then h.ld else h.sd end as hld,
      case s1.cls when 'fast' then h.fm when 'slow' then h.lm else h.sm end as hlm
    from s1 cross join hl h
  ),
  s3 as (
    select s2.*,
      case when s2.holds then 1.0::float8 else floor(power(0.5::float8, s2.age::float8 / s2.hld::float8) * 10000 + 0.5) / 10000 end as decay,
      (not s2.holds and s2.age > s2.hld) as ageing,
      case s2.basis when 'verified' then 1.0::float8 when 'evidenced' then 0.8::float8 when 'validated' then 0.6::float8 else 0.3::float8 end as wt,
      case when s2.kind = 'qual' then 'qualification' when s2.kind = 'course' then 'training' when s2.kind in ('assessment', 'jpm') then 'assessment'
           when s2.kind = 'rating' then (case when s2.basis = 'claimed' then 'self' else 'validation' end) when s2.kind = 'ojt' then 'work' else 'credential' end as src
    from s2
  ),
  s4 as (
    select s3.*, case when s3.ageing then greatest(1, s3.level - 1) else s3.level end as eff, floor(s3.wt * s3.decay * 10000 + 0.5) / 10000 as conf,
      case s3.basis when 'verified' then 4 when 'evidenced' then 3 when 'validated' then 2 else 1 end as brank,
      case when s3.kind = 'qual' then (case when s3.status = 'lapsed' then 'qual_lapsed' else 'qual' end) when s3.kind = 'rating' then 'rating_' || s3.basis else s3.kind end as code
    from s3
  ),
  rk as (
    select s4.*, row_number() over (partition by s4.person_id, s4.skill_id
             order by (case when s4.basis = 'claimed' then 0 else 1 end) desc, s4.eff desc, s4.brank desc, s4.conf desc, s4.observed_on desc, s4.id collate "C" asc) as rn,
           count(*) over (partition by s4.person_id, s4.skill_id) as n
    from s4
  ),
  best as (select r.person_id, r.skill_id, r.src, max(r.conf) as c from rk r group by r.person_id, r.skill_id, r.src),
  bl as (select b.person_id, b.skill_id, kafaa_skill_blend(array_agg(b.c order by b.c desc)) as v from best b group by b.person_id, b.skill_id),
  ci as (select bl.person_id, bl.skill_id, floor(least(0.99::float8, bl.v[1]) * 100 + 0.5) / 100 as conf, bl.v[2] as n from bl),
  iv as (select ci.person_id, ci.skill_id, ci.conf, kafaa_skill_interval(ci.conf, ci.n) as v from ci)
  select 'ps:' || w.person_id || ':' || w.skill_id, w.person_id, w.skill_id, w.eff,
         i.conf::numeric,
         w.basis,
         (select jsonb_agg(jsonb_build_object('code', r.code, 'evidence_id', r.id, 'level', r.eff, 'basis', r.basis, 'observed_on', r.observed_on::text, 'ageing', r.ageing,
                                              'source', r.src, 'w', r.conf, 'hl', r.hlm) order by r.rn)
            from rk r where r.person_id = w.person_id and r.skill_id = w.skill_id),
         w.n::integer,
         kafaa_skill_band(i.v[1]), i.v[1]::numeric, i.v[2]::numeric
  from rk w join iv i on i.person_id = w.person_id and i.skill_id = w.skill_id
  where w.rn = 1
$$;

create or replace function kafaa_skills_apply(p_person text, p_now date) returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  insert into kafaa_skill_evidence (id, person_id, skill_id, kind, ref_table, ref_id, level, basis, status, observed_on, active)
  select d.id, d.person_id, d.skill_id, d.kind, d.ref_table, d.ref_id, d.level, d.basis, d.status, d.observed_on, true from kafaa_skill_evidence_derive(p_person, p_now) d
  on conflict (id) do update set level = excluded.level, basis = excluded.basis, status = excluded.status, observed_on = excluded.observed_on, active = true
  where (kafaa_skill_evidence.level, kafaa_skill_evidence.basis, kafaa_skill_evidence.status, kafaa_skill_evidence.observed_on, kafaa_skill_evidence.active)
        is distinct from (excluded.level, excluded.basis, excluded.status, excluded.observed_on, true);
  update kafaa_skill_evidence e set active = false
  where e.active and e.kind in ('qual', 'course', 'assessment', 'jpm') and e.ref_table not in ('fitness_attempts', 'adaptive_attempts', 'task_attempts', 'ai_drill_attempts', 'plant_visits', 'twin_attempts', 'lectures', 'knowledge_assets', 'roleplay_sessions') and (p_person is null or e.person_id = p_person)
    and e.id not in (select d.id from kafaa_skill_evidence_derive(p_person, p_now) d);
  insert into kafaa_person_skills (id, person_id, skill_id, level, confidence, basis, reasons, evidence_count, active, updated_at, confidence_band, conf_low, conf_high)
  select s.id, s.person_id, s.skill_id, s.level, s.confidence, s.basis, s.reasons, s.evidence_count, true, now(), s.confidence_band, s.conf_low, s.conf_high
  from kafaa_skill_states_v2(p_person, p_now, null) s
  on conflict (id) do update set level = excluded.level, confidence = excluded.confidence, basis = excluded.basis, reasons = excluded.reasons,
    evidence_count = excluded.evidence_count, active = true, updated_at = now(), confidence_band = excluded.confidence_band, conf_low = excluded.conf_low, conf_high = excluded.conf_high
  where (kafaa_person_skills.level, kafaa_person_skills.confidence, kafaa_person_skills.basis, kafaa_person_skills.reasons, kafaa_person_skills.evidence_count, kafaa_person_skills.active,
         kafaa_person_skills.confidence_band, kafaa_person_skills.conf_low, kafaa_person_skills.conf_high)
        is distinct from (excluded.level, excluded.confidence, excluded.basis, excluded.reasons, excluded.evidence_count, true, excluded.confidence_band, excluded.conf_low, excluded.conf_high);
  update kafaa_person_skills p set active = false, level = 0, confidence = 0, basis = 'none', reasons = '[]'::jsonb, evidence_count = 0, updated_at = now(),
    confidence_band = 'low', conf_low = 0, conf_high = 0
  where p.active and (p_person is null or p.person_id = p_person) and p.id not in (select s.id from kafaa_skill_states_v2(p_person, p_now, null) s);
  select jsonb_build_object(
    'people', (select count(distinct p.person_id) from kafaa_person_skills p where p.active and (p_person is null or p.person_id = p_person)),
    'states', (select count(*) from kafaa_person_skills p where p.active and (p_person is null or p.person_id = p_person)),
    'evidence', (select count(*) from kafaa_skill_evidence e where e.active and (p_person is null or e.person_id = p_person)),
    'digest', (select encode(sha256(convert_to(coalesce(string_agg(p.id || '|' || p.level || '|' || round(p.confidence * 100)::integer || '|' || p.basis, E'\n' order by p.id collate "C"), ''), 'UTF8')), 'hex')
               from kafaa_person_skills p where p.active and (p_person is null or p.person_id = p_person)))
  into v;
  return v;
end $$;
-- @@SHARED-END@@

-- ───────────── Grants: internal helpers are not executable by API roles; RPCs only by signed-in users.
revoke all on function kafaa_aps_pct(integer, integer), kafaa_aps_band(integer), kafaa_aps_band_name(text), kafaa_aps_dim_name(text), kafaa_aps_theme_name(text), kafaa_aps_changes(jsonb),
  kafaa_aps_stage(jsonb, text), kafaa_aps_stage_view(jsonb), kafaa_aps_header(kafaa_aps_scenarios), kafaa_aps_judge(jsonb, integer, integer[]), kafaa_aps_response(jsonb), kafaa_aps_score(jsonb),
  kafaa_aps_pick(text, integer), kafaa_aps_next_reasons(text, jsonb, integer), kafaa_aps_txt(jsonb, integer), kafaa_aps_int(jsonb, integer, integer), kafaa_aps_problem(jsonb),
  kafaa_aps_stats_core(date), kafaa_aps_result(kafaa_aps_attempts),
  kafaa_rp_norm(text), kafaa_rp_cue_key(text), kafaa_rp_cue_hit(text, text), kafaa_rp_words(text), kafaa_rp_check(jsonb, text, text), kafaa_rp_eval(jsonb, jsonb, text),
  kafaa_rp_speak_up(text), kafaa_rp_pct(integer, integer), kafaa_rp_summary(jsonb, jsonb, integer), kafaa_rp_evidence_skills(text[]), kafaa_rp_reviewers(text), kafaa_rp_role_of(text),
  kafaa_rp_notify(text, text, text, text, text, text), kafaa_rp_txt(jsonb, integer), kafaa_rp_check_problem(jsonb), kafaa_rp_problem(jsonb), kafaa_rp_stats_core(date),
  kafaa_rp_result(kafaa_roleplay_sessions), kafaa_rp_queue_item(kafaa_roleplay_sessions) from public, anon, authenticated;
revoke all on function kafaa_start_aps(jsonb), kafaa_submit_aps(jsonb), kafaa_aps_context(), kafaa_aps_stats(), kafaa_save_aps_scenario(jsonb), kafaa_start_roleplay(jsonb), kafaa_roleplay_turn(jsonb),
  kafaa_roleplay_context(), kafaa_roleplay_reviewers(), kafaa_request_roleplay_review(jsonb), kafaa_withdraw_roleplay_review(text), kafaa_roleplay_review_queue(),
  kafaa_attach_roleplay_evidence(jsonb), kafaa_roleplay_stats(), kafaa_save_roleplay_scenario(jsonb) from public, anon;
grant execute on function kafaa_start_aps(jsonb), kafaa_submit_aps(jsonb), kafaa_aps_context(), kafaa_aps_stats(), kafaa_save_aps_scenario(jsonb), kafaa_start_roleplay(jsonb), kafaa_roleplay_turn(jsonb),
  kafaa_roleplay_context(), kafaa_roleplay_reviewers(), kafaa_request_roleplay_review(jsonb), kafaa_withdraw_roleplay_review(text), kafaa_roleplay_review_queue(),
  kafaa_attach_roleplay_evidence(jsonb), kafaa_roleplay_stats(), kafaa_save_roleplay_scenario(jsonb) to authenticated;
