-- live apply part kafaa_fs54_future_leadership_p2 (from supabase/migrations/20261010254001_kafaa_fs54_future_leadership.sql, part 2 of 2)

-- The training manager or the HR authority accepts or returns a submitted project; never their own. Completing the track: ledger.
create or replace function kafaa_review_policy_project(p_nomination_id text, p_decision text, p_note text default '') returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; n kafaa_leadership_nominations; x kafaa_fl_participants; c kafaa_fl_cohorts; v_note text := btrim(coalesce(p_note, '')); v_all boolean; v_status text; l integer; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('future_leaders.review', 'fl_participants', p_nomination_id, 'not_signed_in', 'Sign in to use the Future Leaders track'); end if;
  if kafaa_has_grant('talent_review', array['A']) then v_role := kafaa_acting_role('talent_review', array['A']);
  elsif kafaa_role_grant('training_manager', 'skills_profile', 'A') then v_role := 'training_manager';
  end if;
  if v_role is null then return kafaa_refuse('future_leaders.review', 'fl_participants', p_nomination_id, 'forbidden', 'Only the training manager or the HR authority reviews policy projects'); end if;
  select * into n from kafaa_leadership_nominations where id = p_nomination_id and programme_id = 'prog-future-leaders';
  if n.id is null or n.status <> 'approved' then return kafaa_refuse('future_leaders.review', 'fl_participants', p_nomination_id, 'not_found', 'Participant not found', v_role); end if;
  if n.person_id = me then return kafaa_refuse('future_leaders.review', 'fl_participants', p_nomination_id, 'maker_checker', 'You cannot review your own policy project', v_role); end if;
  select * into x from kafaa_fl_participants where id = 'flp:' || n.id;
  if x.id is null or x.project_status <> 'submitted' then return kafaa_refuse('future_leaders.review', 'fl_participants', p_nomination_id, 'invalid', 'Only a submitted project can be reviewed', v_role); end if;
  if p_decision is null or p_decision not in ('accept', 'return') then return kafaa_refuse('future_leaders.review', 'fl_participants', p_nomination_id, 'invalid', 'Unknown decision', v_role); end if;
  if p_decision = 'return' and (length(v_note) < 5 or length(v_note) > 500) then return kafaa_refuse('future_leaders.review', 'fl_participants', p_nomination_id, 'invalid', 'Give a note of 5 to 500 characters when you return a project', v_role); end if;
  select * into c from kafaa_fl_cohorts where id = x.cohort_id;
  v_all := p_decision = 'accept' and c.id is not null and not exists (select 1 from jsonb_array_elements(c.modules) e where not ((e->>'id') = any(x.modules_done)));
  v_status := case when p_decision = 'accept' then 'accepted' else 'returned' end;
  update kafaa_fl_participants set project_status = v_status, project_reviewed_by = me, project_review_note = nullif(v_note, ''), project_decided_on = current_date,
    status = case when v_all then 'completed' else status end, completed_on = case when v_all then current_date else completed_on end,
    history = history || jsonb_build_array(kafaa_fs54_hist('project:' || v_status, v_note)), updated_at = now() where id = x.id;
  if v_all then
    update kafaa_leadership_nominations set status = 'completed', history = history || jsonb_build_array(kafaa_fs54_hist('completed', 'Future Leaders track completed')), updated_at = now() where id = n.id;
  end if;
  perform kafaa_fs54_notify('nt-' || x.id || '-project-' || v_status, n.person_id, 'leadership',
    case when p_decision = 'accept' then 'Your Future Leaders policy project was accepted' else 'Your Future Leaders policy project was returned with a note' end,
    case when p_decision = 'accept' then 'تم قبول مشروع السياسات الخاص بك في مسار قادة المستقبل' else 'أُعيد مشروع السياسات الخاص بك في مسار قادة المستقبل مع ملاحظة' end,
    '/leadership/future-leaders', case when p_decision = 'accept' then 'ok' else 'info' end);
  if v_all then l := kafaa_ledger('kafaa.leadership.future_leaders_complete', format('Future Leaders track completed (%s)', n.id)); end if;
  a := kafaa_audit('future_leaders.review', 'fl_participants', x.id, 'ok', case when v_all then 'accepted; track completed' else v_status end,
    case when v_all then (case when l is null then 'skipped' else 'written' end) else 'not_applicable' end, l, v_role);
  return kafaa_result(true, 'ok', case when v_all then 'Project accepted: the participant completed the track' when p_decision = 'accept' then 'Project accepted' else 'Project returned to the participant' end,
    a, l, jsonb_build_object('project_status', v_status, 'completed', v_all));
end $$;

-- ═════════════ FS48 · Women in future nuclear skills (opt-in; HR aggregates only)
-- The two public flags of a circle (circleFlags()): is_full (active members, mentors excluded, at the seat count) and mentor seat free.
create or replace function kafaa_fs54_circle_flags(p_circle text) returns void language plpgsql security definer set search_path = public as $$
begin
  update kafaa_wfn_circles c set
    is_full = (select count(*) from kafaa_wfn_circle_members m where m.circle_id = c.id and m.active and m.role = 'member') >= c.seats,
    mentor_open = not exists (select 1 from kafaa_wfn_circle_members m where m.circle_id = c.id and m.active and m.role = 'mentor')
   where c.id = p_circle;
end $$;
-- Opt in (areas, ways to take part, mentor) or withdraw: choices blanked, memberships ended, open requests withdrawn (no trace in any ranking).
create or replace function kafaa_set_wfn_optin(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_active boolean := coalesce((p->>'active')::boolean, false); v_action text; v_role text; pp kafaa_people; v_id text; cur kafaa_wfn_participants; v_cid text;
  v_int text[]; v_str text[]; a kafaa_audit_events;
begin
  v_action := case when v_active then 'wfn.optin' else 'wfn.withdraw' end;
  if me is null then return kafaa_refuse(v_action, 'wfn_participants', null, 'not_signed_in', 'Sign in to take part in the network'); end if;
  v_id := 'wp:' || me;
  v_role := kafaa_acting_role('knowledge', array['R']);
  select * into pp from kafaa_people where id = me;
  if v_role is null or pp.id is null or pp.kind <> 'staff' or pp.status <> 'active' then return kafaa_refuse(v_action, 'wfn_participants', v_id, 'forbidden', 'The network is open to staff', v_role); end if;
  select * into cur from kafaa_wfn_participants where id = v_id;
  if v_active then
    select coalesce(array_agg(distinct x), '{}'::text[]) into v_int from jsonb_array_elements_text(case when jsonb_typeof(p->'interests') = 'array' then p->'interests' else '[]'::jsonb end) x;
    select coalesce(array_agg(distinct x), '{}'::text[]) into v_str from jsonb_array_elements_text(case when jsonb_typeof(p->'strands') = 'array' then p->'strands' else '[]'::jsonb end) x;
    if cardinality(v_int) < 1 or cardinality(v_int) > 4 or not (v_int <@ array['ai_data', 'digital_plant', 'advanced_reactor', 'green_energy', 'leadership', 'project_delivery']) then
      return kafaa_refuse(v_action, 'wfn_participants', v_id, 'invalid', 'Choose one to four future-skill areas', v_role);
    end if;
    if cardinality(v_str) < 1 or not (v_str <@ array['circles', 'visiting', 'sponsored']) then
      return kafaa_refuse(v_action, 'wfn_participants', v_id, 'invalid', 'Choose at least one way to take part (circles, visiting placements or sponsored study)', v_role);
    end if;
    select array_agg(x order by x collate "C") into v_int from unnest(v_int) x;
    select array_agg(s order by o) into v_str from unnest(array['circles', 'visiting', 'sponsored']) with ordinality t(s, o) where s = any(v_str);
    if cur.id is not null then
      update kafaa_wfn_participants set active = true, interests = v_int, strands = v_str, mentor = coalesce((p->>'mentor')::boolean, false), withdrawn_on = null,
        joined_on = case when cur.active then cur.joined_on else current_date end, updated_at = now() where id = v_id;
    else
      insert into kafaa_wfn_participants (id, person_id, active, interests, strands, mentor, joined_on, withdrawn_on, updated_at)
      values (v_id, me, true, v_int, v_str, coalesce((p->>'mentor')::boolean, false), current_date, null, now());
    end if;
    a := kafaa_audit('wfn.optin', 'wfn_participants', v_id, 'ok', 'opted in', 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'You joined the network. Only you can see your choices', a, null, jsonb_build_object('active', true));
  end if;
  if cur.id is not null then update kafaa_wfn_participants set active = false, interests = '{}'::text[], strands = '{}'::text[], mentor = false, withdrawn_on = current_date, updated_at = now() where id = v_id; end if;
  for v_cid in select distinct circle_id from kafaa_wfn_circle_members where person_id = me and active loop
    update kafaa_wfn_circle_members set active = false, left_on = current_date where person_id = me and circle_id = v_cid and active;
    perform kafaa_fs54_circle_flags(v_cid);
  end loop;
  update kafaa_wfn_requests set status = 'withdrawn', history = history || jsonb_build_array(kafaa_fs54_hist('withdrawn')), updated_at = now() where person_id = me and status in ('interested', 'shortlisted');
  a := kafaa_audit('wfn.withdraw', 'wfn_participants', v_id, 'ok', 'withdrawn', 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'You left the network. Your choices were cleared and you no longer appear anywhere in it', a, null, jsonb_build_object('active', false));
end $$;

-- Join or leave a mentor circle (opted-in participants; a mentor takes the free mentor seat).
create or replace function kafaa_join_wfn_circle(p_circle_id text, p_join boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; pt kafaa_wfn_participants; c kafaa_wfn_circles; v_id text; cur kafaa_wfn_circle_members; v_mentor boolean; v_r text;
begin
  if me is null then return kafaa_refuse('wfn.circle', 'wfn_circle_members', p_circle_id, 'not_signed_in', 'Sign in to take part in the network'); end if;
  v_role := kafaa_acting_role('knowledge', array['R']);
  if v_role is null then return kafaa_refuse('wfn.circle', 'wfn_circle_members', p_circle_id, 'forbidden', 'The network is open to staff'); end if;
  select * into pt from kafaa_wfn_participants where person_id = me;
  if pt.id is null or not pt.active then return kafaa_refuse('wfn.circle', 'wfn_circle_members', p_circle_id, 'forbidden', 'Opt in to the network first (you can withdraw at any time)', v_role); end if;
  select * into c from kafaa_wfn_circles where id = p_circle_id;
  if c.id is null then return kafaa_refuse('wfn.circle', 'wfn_circle_members', p_circle_id, 'not_found', 'Circle not found', v_role); end if;
  v_id := 'wcm:' || p_circle_id || ':' || me;
  select * into cur from kafaa_wfn_circle_members where id = v_id;
  if p_join is false then
    if cur.id is not null and cur.active then update kafaa_wfn_circle_members set active = false, left_on = current_date where id = v_id; perform kafaa_fs54_circle_flags(p_circle_id); end if;
    return kafaa_result(true, 'ok', 'You left the circle', kafaa_audit('wfn.circle', 'wfn_circle_members', v_id, 'ok', 'left', 'not_applicable', null, v_role), null, jsonb_build_object('member', false, 'role', null));
  end if;
  if c.status <> 'active' then return kafaa_refuse('wfn.circle', 'wfn_circle_members', p_circle_id, 'invalid', 'This circle is closed', v_role); end if;
  if cur.id is not null and cur.active then
    return kafaa_result(true, 'ok', 'You are already in this circle', kafaa_audit('wfn.circle', 'wfn_circle_members', v_id, 'ok', 'already ' || cur.role, 'not_applicable', null, v_role), null, jsonb_build_object('member', true, 'role', cur.role));
  end if;
  v_mentor := pt.mentor and not exists (select 1 from kafaa_wfn_circle_members m where m.circle_id = p_circle_id and m.active and m.role = 'mentor');
  if not v_mentor and (select count(*) from kafaa_wfn_circle_members m where m.circle_id = p_circle_id and m.active and m.role = 'member') >= c.seats then
    return kafaa_refuse('wfn.circle', 'wfn_circle_members', p_circle_id, 'conflict', 'This circle is full; try another circle or ask to open a new one', v_role);
  end if;
  v_r := case when v_mentor then 'mentor' else 'member' end;
  if cur.id is not null then update kafaa_wfn_circle_members set active = true, role = v_r, joined_on = current_date, left_on = null where id = v_id;
  else insert into kafaa_wfn_circle_members (id, circle_id, person_id, role, active, joined_on, left_on) values (v_id, p_circle_id, me, v_r, true, current_date, null);
  end if;
  perform kafaa_fs54_circle_flags(p_circle_id);
  return kafaa_result(true, 'ok', case when v_mentor then 'You joined the circle as its mentor' else 'You joined the circle' end,
    kafaa_audit('wfn.circle', 'wfn_circle_members', v_id, 'ok', 'joined as ' || v_r, 'not_applicable', null, v_role), null, jsonb_build_object('member', true, 'role', v_r));
end $$;

-- Ask for a visiting placement or sponsored study (opted-in participants; three open requests at most; screened text).
create or replace function kafaa_request_wfn_offer(p_offer_id text, p_statement text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; pt kafaa_wfn_participants; o kafaa_wfn_offers; v_text text := btrim(coalesce(p_statement, '')); v_bad jsonb; pp kafaa_people; v_id text; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('wfn.request', 'wfn_requests', p_offer_id, 'not_signed_in', 'Sign in to take part in the network'); end if;
  v_role := kafaa_acting_role('knowledge', array['R']);
  if v_role is null then return kafaa_refuse('wfn.request', 'wfn_requests', p_offer_id, 'forbidden', 'The network is open to staff'); end if;
  select * into pt from kafaa_wfn_participants where person_id = me;
  if pt.id is null or not pt.active then return kafaa_refuse('wfn.request', 'wfn_requests', p_offer_id, 'forbidden', 'Opt in to the network first (you can withdraw at any time)', v_role); end if;
  select * into o from kafaa_wfn_offers where id = p_offer_id;
  if o.id is null then return kafaa_refuse('wfn.request', 'wfn_requests', p_offer_id, 'not_found', 'Offer not found', v_role); end if;
  if o.status <> 'open' or o.closes_on < current_date then return kafaa_refuse('wfn.request', 'wfn_requests', p_offer_id, 'invalid', 'This offer is closed', v_role); end if;
  if exists (select 1 from kafaa_wfn_requests q where q.person_id = me and q.offer_id = p_offer_id and q.status in ('interested', 'shortlisted', 'placed')) then
    return kafaa_refuse('wfn.request', 'wfn_requests', p_offer_id, 'conflict', 'You already have an open request for this offer', v_role);
  end if;
  if (select count(*) from kafaa_wfn_requests q where q.person_id = me and q.status in ('interested', 'shortlisted')) >= 3 then
    return kafaa_refuse('wfn.request', 'wfn_requests', p_offer_id, 'limit', 'You can have up to three open requests at a time', v_role);
  end if;
  if length(v_text) < 20 or length(v_text) > 600 then return kafaa_refuse('wfn.request', 'wfn_requests', p_offer_id, 'invalid', 'Write 20 to 600 characters on why this placement or study fits you', v_role); end if;
  v_bad := kafaa_cop_screen(v_text);
  if v_bad is not null then return kafaa_refuse('wfn.request', 'wfn_requests', p_offer_id, v_bad->>'code', v_bad->>'message', v_role); end if;
  select * into pp from kafaa_people where id = me;
  v_id := kafaa_lead_rid('wr');
  insert into kafaa_wfn_requests (id, offer_id, person_id, person_name, person_name_ar, statement, status, outcome, decided_by, decided_on, note, history, created_at, updated_at)
  values (v_id, p_offer_id, me, pp.display_name, coalesce(nullif(pp.display_name_ar, ''), pp.display_name), v_text, 'interested', null, null, null, null, jsonb_build_array(kafaa_fs54_hist('interested')), now(), now());
  a := kafaa_audit('wfn.request', 'wfn_requests', v_id, 'ok', p_offer_id, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Request sent to the programme owner', a, null, jsonb_build_object('id', v_id));
end $$;

-- The programme owner (training manager) moves a request on; never their own. A placement writes a ledger row.
create or replace function kafaa_decide_wfn_request(p_id text, p_decision text, p_note text default '', p_outcome text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); q kafaa_wfn_requests; o kafaa_wfn_offers; v_to text; v_note text := btrim(coalesce(p_note, '')); l integer; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('wfn.decide', 'wfn_requests', p_id, 'not_signed_in', 'Sign in to take part in the network'); end if;
  if not kafaa_role_grant('training_manager', 'skills_profile', 'A') then return kafaa_refuse('wfn.decide', 'wfn_requests', p_id, 'forbidden', 'Only the training manager (programme owner) decides placements and sponsored study'); end if;
  select * into q from kafaa_wfn_requests where id = p_id;
  if q.id is null or q.status = 'withdrawn' then return kafaa_refuse('wfn.decide', 'wfn_requests', p_id, 'not_found', 'Request not found', 'training_manager'); end if;
  if q.person_id = me then return kafaa_refuse('wfn.decide', 'wfn_requests', p_id, 'maker_checker', 'You cannot decide your own request', 'training_manager'); end if;
  v_to := case
    when q.status = 'interested' and p_decision = 'shortlist' then 'shortlisted'
    when q.status = 'interested' and p_decision = 'decline' then 'declined'
    when q.status = 'shortlisted' and p_decision = 'place' then 'placed'
    when q.status = 'shortlisted' and p_decision = 'decline' then 'declined'
    when q.status = 'placed' and p_decision = 'complete' then 'completed' end;
  if v_to is null then return kafaa_refuse('wfn.decide', 'wfn_requests', p_id, 'invalid', 'This decision does not fit the request''s current status', 'training_manager'); end if;
  if v_to = 'declined' and (length(v_note) < 5 or length(v_note) > 300) then return kafaa_refuse('wfn.decide', 'wfn_requests', p_id, 'invalid', 'Give a note of 5 to 300 characters when you decline', 'training_manager'); end if;
  if v_to = 'completed' and coalesce(p_outcome, '') not in ('progressed', 'same_role') then return kafaa_refuse('wfn.decide', 'wfn_requests', p_id, 'invalid', 'Record the outcome (progressed or same role) when you mark a request completed', 'training_manager'); end if;
  update kafaa_wfn_requests set status = v_to, outcome = case when v_to = 'completed' then p_outcome else outcome end, decided_by = me, decided_on = current_date, note = nullif(v_note, ''),
    history = history || jsonb_build_array(kafaa_fs54_hist(v_to, v_note)), updated_at = now() where id = p_id;
  select * into o from kafaa_wfn_offers where id = q.offer_id;
  perform kafaa_fs54_notify('nt-' || p_id || '-' || v_to, q.person_id, 'community', 'Your request for ' || coalesce(o.title_en, q.offer_id) || ': ' || v_to,
    'طلبك لـ ' || coalesce(o.title_ar, q.offer_id) || ': ' || case v_to when 'shortlisted' then 'في القائمة المختصرة' when 'placed' then 'تم التنسيب' when 'completed' then 'مكتمل' else 'لم يُقبل' end,
    '/communities/women-in-nuclear', case when v_to = 'declined' then 'info' else 'ok' end);
  if v_to = 'placed' then l := kafaa_ledger('kafaa.wfn.placement', format('Placement or sponsored study %s placed', p_id)); end if;
  a := kafaa_audit('wfn.decide', 'wfn_requests', p_id, 'ok', v_to, case when v_to = 'placed' then (case when l is null then 'skipped' else 'written' end) else 'not_applicable' end, l, 'training_manager');
  return kafaa_result(true, 'ok', 'Request ' || v_to, a, l, jsonb_build_object('status', v_to));
end $$;

-- Requests made to offers, for the programme owner only.
create or replace function kafaa_wfn_desk() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if kafaa_me() is null or not kafaa_role_grant('training_manager', 'skills_profile', 'A') then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'offer_id', q.offer_id, 'offer_title_en', coalesce(o.title_en, q.offer_id), 'offer_title_ar', coalesce(o.title_ar, q.offer_id),
    'strand', coalesce(o.strand, ''), 'person_id', q.person_id, 'person_name', q.person_name, 'person_name_ar', q.person_name_ar, 'statement', q.statement, 'status', q.status,
    'outcome', q.outcome, 'note', q.note, 'created_at', q.created_at, 'updated_at', q.updated_at) order by q.created_at desc, q.id collate "C")
    from kafaa_wfn_requests q left join kafaa_wfn_offers o on o.id = q.offer_id where q.status <> 'withdrawn'), '[]'::jsonb);
end $$;

-- Pipeline metrics (wfnStats()): active participants only; gender share per future-skills programme, suppressed whole under 10.
create or replace function kafaa_fs54_gender_row(p_id text, p_people text[]) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare w integer; m integer; v_sup boolean;
begin
  select count(*) filter (where p.gender = 'f')::integer, count(*) filter (where p.gender = 'm')::integer into w, m from kafaa_people p where p.id = any(coalesce(p_people, '{}'::text[]));
  v_sup := w < 10 or m < 10;
  return jsonb_build_object('id', p_id, 'women', case when v_sup then null else w end, 'men', case when v_sup then null else m end,
    'share', case when v_sup then null else (round(1000.0 * w / (w + m)) / 1000)::float8 end, 'suppressed', v_sup);
end $$;
create or replace function kafaa_wfn_stats_compute() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_act integer; v_men integer; v_cm integer; v_tot integer; v_req jsonb; v_comp integer; v_base integer; v_prog integer; v_pipe jsonb;
begin
  select count(*)::integer, count(*) filter (where mentor)::integer into v_act, v_men from kafaa_wfn_participants where active;
  select count(distinct m.person_id)::integer into v_cm from kafaa_wfn_circle_members m join kafaa_wfn_circles c on c.id = m.circle_id and c.status = 'active'
    join kafaa_wfn_participants p on p.person_id = m.person_id and p.active where m.active;
  select count(*)::integer into v_tot from kafaa_wfn_requests q join kafaa_wfn_participants p on p.person_id = q.person_id and p.active where q.status <> 'withdrawn';
  select jsonb_agg(jsonb_build_object('status', t.s, 'n', case when t.k < 10 then null else t.k end, 'suppressed', t.k < 10) order by t.o) into v_req
    from (select s, o, (select count(*)::integer from kafaa_wfn_requests q join kafaa_wfn_participants p on p.person_id = q.person_id and p.active where q.status = s) k
            from unnest(array['interested', 'shortlisted', 'placed', 'completed', 'declined']) with ordinality u(s, o)) t;
  select count(*) filter (where q.status = 'completed')::integer, count(*) filter (where q.status in ('placed', 'completed'))::integer,
         count(*) filter (where q.status = 'completed' and q.outcome = 'progressed')::integer
    into v_comp, v_base, v_prog
    from kafaa_wfn_requests q join kafaa_wfn_participants p on p.person_id = q.person_id and p.active;
  v_pipe := jsonb_build_array(
    kafaa_fs54_gender_row('staff', (select coalesce(array_agg(id), '{}'::text[]) from kafaa_people where kind = 'staff' and status = 'active')),
    kafaa_fs54_gender_row('academies', (select coalesce(array_agg(distinct person_id), '{}'::text[]) from kafaa_academy_members where status not in ('declined', 'withdrawn'))),
    kafaa_fs54_gender_row('future_gigs', (select coalesce(array_agg(distinct a.person_id), '{}'::text[]) from kafaa_opportunity_applications a join kafaa_opportunities o on o.id = a.opportunity_id
                                           where nullif(o.channel, '') is not null and a.status <> 'withdrawn')),
    kafaa_fs54_gender_row('future_leaders', (select coalesce(array_agg(distinct person_id), '{}'::text[]) from kafaa_leadership_nominations where programme_id = 'prog-future-leaders' and status <> 'declined')),
    kafaa_fs54_gender_row('leadership_academy', (select coalesce(array_agg(distinct person_id), '{}'::text[]) from kafaa_leadership_nominations where programme_id <> 'prog-future-leaders' and status in ('approved', 'completed'))));
  return jsonb_build_object(
    'network', jsonb_build_object(
      'participants', case when v_act < 10 then null else v_act end, 'mentors', case when v_men < 10 then null else v_men end,
      'circle_members', case when v_cm < 10 then null else v_cm end, 'requests_total', case when v_tot < 10 then null else v_tot end, 'requests', v_req,
      'completion', jsonb_build_object('completed', case when v_comp < 10 then null else v_comp end, 'base', case when v_base < 10 then null else v_base end,
        'rate', case when v_base < 10 then null else (round(1000.0 * v_comp / v_base) / 1000)::float8 end, 'suppressed', v_base < 10),
      'progression', jsonb_build_object('progressed', case when v_prog < 10 then null else v_prog end, 'rate', case when v_comp < 10 then null else (round(1000.0 * v_prog / v_comp) / 1000)::float8 end, 'suppressed', v_comp < 10)),
    'pipeline', v_pipe);
end $$;
create or replace function kafaa_wfn_stats() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not kafaa_fs54_stats_gate() then return null; end if;
  return kafaa_wfn_stats_compute();
end $$;

-- ───────────── Data: the F13 mentoring engine card (F24) at version 2 with the FS48 ranking functions (same text as the seed builder)
update kafaa_engine_cards set version = 2, last_changed_at = '2026-10-10T00:00:00Z'::timestamptz,
  scoring_functions = array['src/modules/m04/match.ts#rankMentors', 'src/modules/m22/future.ts#rankCircles', 'src/modules/m22/future.ts#rankOffers']::text[],
  inputs_used = inputs_used || '[{"key":"wfn_participants","en":"Women in future nuclear skills (opt-in only): the future-skill areas and ways to take part I chose, circle seats and open offers","ar":"المرأة في المهارات النووية المستقبلية (بالاختيار فقط): مجالات المهارات المستقبلية وطرق المشاركة التي اخترتها، ومقاعد الحلقات والعروض المفتوحة"}]'::jsonb,
  limitations_en = 'Only mentors who opted in and have capacity appear. Mentor circles and offers (FS48) are ranked only for people who opt in, from the areas they chose; withdrawing removes them from every ranking.',
  limitations_ar = 'يظهر فقط المرشدون الذين اختاروا المشاركة ولديهم طاقة استيعابية. تُرتَّب حلقات الإرشاد والعروض (FS48) لمن اختار المشاركة فقط ووفق المجالات التي اختارها، والانسحاب يزيله من كل ترتيب.'
  where id = 'mentoring' and version = 1;

-- ───────────── Grants: internal helpers are not executable by API roles; RPCs only by signed-in users.
revoke all on function kafaa_lead_form_ids(integer),
  kafaa_lead_scores_v(jsonb, integer),
  kafaa_fs54_stats_gate(),
  kafaa_fs54_cell(text, text[], text[]),
  kafaa_fs54_programme_stats_compute(),
  kafaa_fl_cohort_for(text),
  kafaa_fs54_ts(),
  kafaa_fs54_hist(text, text),
  kafaa_fs54_notify(text, text, text, text, text, text, text),
  kafaa_fl_readiness_of(text),
  kafaa_fl_stats_compute(),
  kafaa_fs54_participant(kafaa_leadership_nominations),
  kafaa_fs54_gender_row(text, text[]),
  kafaa_fs54_circle_flags(text),
  kafaa_wfn_stats_compute(),
  kafaa_lead_360_summary(text, text),
  kafaa_lead_stats_compute() from public, anon, authenticated;
revoke all on function kafaa_leadership_programme_stats(),
  kafaa_nominate_future_leader(text, text),
  kafaa_fl_readiness(text[]),
  kafaa_record_fl_module(text, text, boolean),
  kafaa_save_policy_project(jsonb),
  kafaa_review_policy_project(text, text, text),
  kafaa_future_leaders_stats(),
  kafaa_set_wfn_optin(jsonb),
  kafaa_join_wfn_circle(text, boolean),
  kafaa_request_wfn_offer(text, text),
  kafaa_decide_wfn_request(text, text, text, text),
  kafaa_wfn_desk(),
  kafaa_wfn_stats(),
  kafaa_request_360(jsonb),
  kafaa_submit_360(text, jsonb) from public, anon;
grant execute on function kafaa_leadership_programme_stats(),
  kafaa_nominate_future_leader(text, text),
  kafaa_fl_readiness(text[]),
  kafaa_record_fl_module(text, text, boolean),
  kafaa_save_policy_project(jsonb),
  kafaa_review_policy_project(text, text, text),
  kafaa_future_leaders_stats(),
  kafaa_set_wfn_optin(jsonb),
  kafaa_join_wfn_circle(text, boolean),
  kafaa_request_wfn_offer(text, text),
  kafaa_decide_wfn_request(text, text, text, text),
  kafaa_wfn_desk(),
  kafaa_wfn_stats(),
  kafaa_request_360(jsonb),
  kafaa_submit_360(text, jsonb) to authenticated;
