-- kafaa_fs94_grants_consortium_p2 (2/2) · from supabase/migrations/20261010294001_kafaa_fs94_grants_consortium.sql
-- Apply with apply_migration name "kafaa_fs94_grants_consortium_p2". Additive and idempotent; kafaa_* objects only.
-- nominationProblem(): open for nominations; the organisation rule; a discipline; the person rule; no duplicate; seats
create or replace function kafaa_cc_nom_problem(p jsonb, p_cohort kafaa_consortium_cohorts, p_org text, p_by_hr boolean, p_active integer, p_dup boolean, p_today date) returns text language plpgsql stable security definer set search_path = public as $$
declare pt jsonb; v_pid text;
begin
  if kafaa_cc_phase(p_cohort.nominations_close_on, p_cohort.starts_on, p_cohort.ends_on, p_today) <> 'nominating' then return 'phase'; end if;
  pt := kafaa_cc_partner(p_cohort.partners, p_org);
  if pt is null or (p_by_hr and not kafaa_cc_is_enec(pt ->> 'org_id') and coalesce((pt ->> 'kafaa_access')::boolean, false)) or (not p_by_hr and kafaa_cc_is_enec(pt ->> 'org_id')) then return 'org'; end if;
  if p is null or jsonb_typeof(p -> 'discipline') is distinct from 'string' or p ->> 'discipline' not in ('mechanical', 'electrical', 'chemical', 'operations', 'instrumentation', 'environmental', 'digital') then return 'discipline'; end if;
  v_pid := case when jsonb_typeof(p -> 'person_id') = 'string' and p ->> 'person_id' <> '' then p ->> 'person_id' end;
  if kafaa_cc_is_enec(pt ->> 'org_id') then
    if not kafaa_cc_enec_eligible(v_pid, p_today) or v_pid is null then return 'person'; end if;
  elsif v_pid is not null then return 'person'; end if;
  if p_dup then return 'duplicate'; end if;
  if p_active >= (pt ->> 'seats')::numeric then return 'seats'; end if;
  return null;
end $$;
-- memberDecisionProblem(): accept with a mentor of another consortium organisation and a team; decline with a note
create or replace function kafaa_cc_decision_problem(p jsonb, p_member_org text, p_cohort kafaa_consortium_cohorts) returns text language plpgsql immutable set search_path = public as $$
declare v_note text; mt jsonb;
begin
  if p is null or jsonb_typeof(p -> 'decision') is distinct from 'string' or p ->> 'decision' not in ('accept', 'decline') then return 'decision'; end if;
  v_note := kafaa_rg_txt(p -> 'note');
  if p ->> 'decision' = 'decline' then return case when length(v_note) < 5 or length(v_note) > 300 then 'note' end; end if;
  select x into mt from jsonb_array_elements(case when jsonb_typeof(p_cohort.mentors) = 'array' then p_cohort.mentors else '[]'::jsonb end) x
   where jsonb_typeof(p -> 'mentor_id') = 'string' and x ->> 'id' = p ->> 'mentor_id' limit 1;
  if mt is null or kafaa_cc_org(p_cohort.partners, mt ->> 'org_id') is not distinct from kafaa_cc_org(p_cohort.partners, p_member_org) then return 'mentor'; end if;
  if jsonb_typeof(p -> 'team') is distinct from 'string' or p ->> 'team' not in ('A', 'B', 'C', 'D') then return 'team'; end if;
  if length(v_note) > 300 then return 'note'; end if;
  return null;
end $$;
-- visitProblem(): an accepted member; a cohort host; another organisation; the date window; hours; the module; the note
create or replace function kafaa_cc_visit_problem(p jsonb, p_cohort kafaa_consortium_cohorts, p_member kafaa_consortium_members, p_today date) returns text language plpgsql immutable set search_path = public as $$
declare v_on date; v_h numeric; v_note text; md jsonb;
begin
  if p_member.id is null or p_member.status <> 'accepted' or p_member.cohort_id <> p_cohort.id then return 'member'; end if;
  if p is null or jsonb_typeof(p -> 'host_org_id') is distinct from 'string' or kafaa_cc_partner(p_cohort.partners, p ->> 'host_org_id') is null then return 'host'; end if;
  if kafaa_cc_org(p_cohort.partners, p ->> 'host_org_id') is not distinct from kafaa_cc_org(p_cohort.partners, p_member.org_id) then return 'same_org'; end if;
  if jsonb_typeof(p -> 'visit_on') is distinct from 'string' or not kafaa_w5_is_date(p ->> 'visit_on') then return 'date'; end if;
  v_on := (p ->> 'visit_on')::date;
  if v_on < p_cohort.starts_on or v_on > p_cohort.ends_on or v_on > p_today or p_today - v_on > 120 then return 'date'; end if;
  if jsonb_typeof(p -> 'hours') is distinct from 'number' then return 'hours'; end if;
  v_h := (p ->> 'hours')::numeric;
  if v_h < 1 or v_h > 40 or v_h * 2 <> floor(v_h * 2) then return 'hours'; end if;
  if coalesce(jsonb_typeof(p -> 'module_id'), 'null') <> 'null' and coalesce(p ->> 'module_id', '') <> '' then
    select x into md from jsonb_array_elements(case when jsonb_typeof(p_cohort.modules) = 'array' then p_cohort.modules else '[]'::jsonb end) x where x ->> 'id' = p ->> 'module_id' limit 1;
    if md is null or md ->> 'host_org_id' is distinct from p ->> 'host_org_id' then return 'module'; end if;
  end if;
  if coalesce(jsonb_typeof(p -> 'note'), 'null') = 'null' then v_note := '';
  elsif jsonb_typeof(p -> 'note') = 'string' then v_note := p ->> 'note';
  else return 'note'; end if;
  if length(btrim(v_note, E' \t\n\r')) > 300 or kafaa_res_contact(v_note) then return 'note'; end if;
  return null;
end $$;
-- visitLevel(): 2 from the second confirmed visit to the same host with 12+ hours there, else 1
create or replace function kafaa_cc_level(p_member text, p_visit text, p_host text, p_hours numeric) returns integer language plpgsql stable security definer set search_path = public as $$
declare n integer; h numeric;
begin
  select count(*) + 1, coalesce(sum(v.hours), 0) + p_hours into n, h from kafaa_consortium_visits v
   where v.member_id = p_member and v.status = 'confirmed' and v.id <> p_visit and v.host_org_id = p_host;
  return case when n >= 2 and h >= 12 then 2 else 1 end;
end $$;
-- confirmRoute(): host administrator (OrgW, own organisation) when the host has Kafa'a access; ENEC programme office for ENEC sites;
-- the programme office on behalf of a host without access
create or replace function kafaa_cc_route(p_partners jsonb, p_host text, p_org text, p_orgw boolean, p_hr boolean) returns text language sql immutable set search_path = public as $$
  select case when kafaa_cc_partner(p_partners, p_host) is null then null
    when kafaa_cc_is_enec(p_host) then case when p_hr then 'enec_host' end
    when coalesce((kafaa_cc_partner(p_partners, p_host) ->> 'kafaa_access')::boolean, false) then case when p_orgw and p_org = p_host then 'host' end
    else case when p_hr then 'on_behalf' end end
$$;
-- consortiumStats(): cohorts by start date; counts of 1-9 suppressed; confirmed hours only with 10+ confirmed visits
create or replace function kafaa_cc_stats(p_today date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
      'cohort_id', c.id, 'phase', kafaa_cc_phase(c.nominations_close_on, c.starts_on, c.ends_on, p_today),
      'trainees', kafaa_gr_cell(m.tr), 'nominated', kafaa_gr_cell(m.nom), 'organisations', jsonb_array_length(c.partners),
      'by_org', (select coalesce(jsonb_agg(jsonb_build_object('org_id', x ->> 'org_id', 'trainees', kafaa_gr_cell((select count(*) from kafaa_consortium_members mm
          where mm.cohort_id = c.id and mm.status in ('accepted', 'completed') and kafaa_cc_org(c.partners, mm.org_id) = x ->> 'org_id'))) order by n), '[]'::jsonb)
        from jsonb_array_elements(c.partners) with ordinality q(x, n)),
      'visits_confirmed', kafaa_gr_cell(s.conf), 'visits_waiting', kafaa_gr_cell(s.logged), 'hours_confirmed', case when s.conf >= 10 then to_jsonb(s.hrs) else 'null'::jsonb end,
      'by_host', (select coalesce(jsonb_agg(jsonb_build_object('org_id', x ->> 'org_id', 'confirmed', kafaa_gr_cell((select count(*) from kafaa_consortium_visits vv
          where vv.cohort_id = c.id and vv.status = 'confirmed' and vv.host_org_id = x ->> 'org_id'))) order by n), '[]'::jsonb)
        from jsonb_array_elements(c.partners) with ordinality q(x, n)),
      'evidence_rows', kafaa_gr_cell(s.ev)) order by c.starts_on), '[]'::jsonb)
    into v
    from kafaa_consortium_cohorts c
    cross join lateral (select count(*) filter (where mm.status in ('accepted', 'completed')) tr, count(*) filter (where mm.status = 'nominated') nom from kafaa_consortium_members mm where mm.cohort_id = c.id) m
    cross join lateral (select count(*) filter (where vv.status = 'confirmed') conf, count(*) filter (where vv.status = 'logged') logged,
        coalesce(sum(vv.hours) filter (where vv.status = 'confirmed'), 0) hrs, count(*) filter (where vv.status = 'confirmed' and vv.profile_evidence) ev
      from kafaa_consortium_visits vv where vv.cohort_id = c.id) s;
  return jsonb_build_object('as_of', p_today::text, 'min_group', 10, 'cohorts', v);
end $$;

-- ═════════════ FS83 RPCs
-- A partner administrator (OrgW) nominates a pseudonymous trainee of their own organisation; HR nominates ENEC staff trainees and, on the
-- partner's behalf, trainees of partners without Kafa'a access; audited
create or replace function kafaa_nominate_consortium_trainee(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_cid text := coalesce(p ->> 'cohort_id', ''); v_mine text := kafaa_my_org(); v_orgw boolean; v_hr boolean; c kafaa_consortium_cohorts;
  v_given text; v_org text; v_pid text; v_problem text; v_active integer; v_dup boolean; n integer; v_code text; v_id text; v_morg text; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('consortium.nominate', 'consortium_members', nullif(v_cid, ''), 'not_signed_in', 'Sign in to use the consortium cohort'); end if;
  v_orgw := v_mine is not null and kafaa_has_grant('ecosystem', array['OrgW']);
  v_hr := kafaa_has_grant('ecosystem', array['W', 'A']) and kafaa_has_grant('workforce_strategy', array['W', 'A']);
  if not v_orgw and not v_hr then return kafaa_refuse('consortium.nominate', 'consortium_members', nullif(v_cid, ''), 'forbidden', 'Only a consortium partner''s administrator (own trainees) or HR (ENEC trainees) nominates'); end if;
  v_role := case when v_orgw then kafaa_acting_role('ecosystem', array['OrgW']) else kafaa_acting_role('workforce_strategy', array['W', 'A']) end;
  select * into c from kafaa_consortium_cohorts where id = v_cid;
  if c.id is null then return kafaa_refuse('consortium.nominate', 'consortium_members', nullif(v_cid, ''), 'not_found', 'Cohort not found', v_role); end if;
  v_given := case when jsonb_typeof(p -> 'org_id') = 'string' and p ->> 'org_id' <> '' then p ->> 'org_id' end;
  v_org := case when v_orgw then case when v_given is not null and v_given <> v_mine then null else v_mine end
    when v_given is not null then kafaa_cc_org(c.partners, v_given) else kafaa_cc_org(c.partners, 'enec') end;
  v_pid := case when jsonb_typeof(p -> 'person_id') = 'string' and p ->> 'person_id' <> '' then p ->> 'person_id' end;
  select count(*) into v_active from kafaa_consortium_members m where m.cohort_id = v_cid and kafaa_cc_org(c.partners, m.org_id) is not distinct from v_org and m.status in ('nominated', 'accepted');
  v_dup := v_pid is not null and exists (select 1 from kafaa_consortium_members m where m.cohort_id = v_cid and m.person_id = v_pid and m.status in ('nominated', 'accepted'));
  v_problem := kafaa_cc_nom_problem(p, c, v_org, not v_orgw, v_active, v_dup, current_date);
  if v_problem is not null then return kafaa_refuse('consortium.nominate', 'consortium_members', v_cid, 'invalid', 'Check the nomination: ' || case v_problem
    when 'phase' then 'nominations for this cohort are closed'
    when 'org' then 'nominate for your own organisation (a partner in this cohort); HR nominates ENEC trainees and trainees of partners without Kafa''a access'
    when 'discipline' then 'choose a discipline'
    when 'person' then 'ENEC trainees are active early-career staff (entry level or hired in the last 5 years); partner trainees carry no person record'
    when 'duplicate' then 'this person already holds a place or a nomination in the cohort' else 'your organisation''s seats in this cohort are taken' end, v_role); end if;
  select count(*) + 1 into n from kafaa_consortium_members m where m.cohort_id = v_cid and kafaa_cc_org(c.partners, m.org_id) = v_org;
  while exists (select 1 from kafaa_consortium_members m where m.cohort_id = v_cid and m.trainee_code = kafaa_cc_code(c.partners, v_org, c.intake_year, n)) loop n := n + 1; end loop;
  v_code := kafaa_cc_code(c.partners, v_org, c.intake_year, n);
  v_id := 'cm-' || v_cid || '-' || lower(v_code);
  v_morg := case when v_pid is not null then coalesce((select pp.org_id from kafaa_people pp where pp.id = v_pid), v_org) else v_org end;
  insert into kafaa_consortium_members (id, cohort_id, org_id, person_id, initials, trainee_code, discipline, status, nominated_by, nominated_at, open_read, sample)
  values (v_id, v_cid, v_morg, v_pid, (select pp.initials from kafaa_people pp where pp.id = v_pid), v_code, p ->> 'discipline', 'nominated', me, now(), false, false);
  a := kafaa_audit('consortium.nominate', 'consortium_members', v_id, 'ok', v_org || ' ' || (p ->> 'discipline') || coalesce(' ' || v_pid, ''), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Nomination recorded', a, null, jsonb_build_object('id', v_id, 'trainee_code', v_code));
end $$;

-- The HR director accepts (mentor from another consortium organisation + project team) or declines with a note; audit + ledger
create or replace function kafaa_decide_consortium_member(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_mid text := coalesce(p ->> 'member_id', ''); m kafaa_consortium_members; c kafaa_consortium_cohorts; v_problem text; v_accept boolean; v_note text;
  a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('consortium.member.decide', 'consortium_members', nullif(v_mid, ''), 'not_signed_in', 'Sign in to use the consortium cohort'); end if;
  if not (kafaa_has_grant('ecosystem', array['A']) and kafaa_has_grant('workforce_strategy', array['W', 'A'])) then
    return kafaa_refuse('consortium.member.decide', 'consortium_members', nullif(v_mid, ''), 'forbidden', 'Only the HR director decides consortium places'); end if;
  v_role := kafaa_acting_role('ecosystem', array['A']);
  select * into m from kafaa_consortium_members where id = v_mid;
  if m.id is null then return kafaa_refuse('consortium.member.decide', 'consortium_members', nullif(v_mid, ''), 'not_found', 'Trainee not found', v_role); end if;
  if m.status <> 'nominated' then return kafaa_refuse('consortium.member.decide', 'consortium_members', v_mid, 'decided', 'This nomination is already decided', v_role); end if;
  if m.person_id is not null and m.person_id = me then return kafaa_refuse('consortium.member.decide', 'consortium_members', v_mid, 'maker_checker', 'You cannot decide your own place', v_role); end if;
  select * into c from kafaa_consortium_cohorts where id = m.cohort_id;
  v_problem := kafaa_cc_decision_problem(p, m.org_id, c);
  if v_problem is not null then return kafaa_refuse('consortium.member.decide', 'consortium_members', v_mid, 'invalid', 'Check the decision: ' || case v_problem
    when 'decision' then 'choose accept or decline' when 'mentor' then 'choose a mentor from another consortium organisation' when 'team' then 'choose a project team from A to D'
    else 'a note of 5 to 300 characters when declining (up to 300 otherwise)' end, v_role); end if;
  v_accept := p ->> 'decision' = 'accept';
  v_note := kafaa_rg_txt(p -> 'note');
  update kafaa_consortium_members set status = case when v_accept then 'accepted' else 'declined' end, decided_by = me, decided_at = now(), decision_note = nullif(v_note, ''),
    mentor_id = case when v_accept then p ->> 'mentor_id' end, team = case when v_accept then p ->> 'team' end where id = v_mid;
  perform kafaa_w5_notify('nt-cc-' || v_mid || '-decided', m.person_id, 'consortium', case when v_accept then 'Your consortium trainee place is confirmed' else 'Your consortium nomination was not accepted' end,
    case when v_accept then 'تم تأكيد مقعدك في دفعة المتدربين المشتركة' else 'لم يتم قبول ترشيحك لدفعة المتدربين المشتركة' end, '/my/consortium', case when v_accept then 'ok' else 'warn' end);
  l := kafaa_ledger('kafaa.consortium.member', 'Consortium place ' || m.trainee_code || ' ' || case when v_accept then 'accepted' else 'declined' end);
  a := kafaa_audit('consortium.member.decide', 'consortium_members', v_mid, 'ok', case when v_accept then 'accepted mentor ' || (p ->> 'mentor_id') || ' team ' || (p ->> 'team') else 'declined: ' || v_note end,
    case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when v_accept then 'Place confirmed' else 'Nomination declined' end, a, l, jsonb_build_object('id', v_mid, 'status', case when v_accept then 'accepted' else 'declined' end));
end $$;

-- The trainee, their employer's administrator or the programme office logs a cross-site visit; audited
create or replace function kafaa_log_consortium_visit(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_mid text := coalesce(p ->> 'member_id', ''); v_mine text := kafaa_my_org(); v_own boolean; v_orgw boolean; v_hr boolean; v_self boolean; v_emp boolean;
  v_via text; m kafaa_consortium_members; c kafaa_consortium_cohorts; v_problem text; v_id text; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('consortium.visit.log', 'consortium_visits', null, 'not_signed_in', 'Sign in to use the consortium cohort'); end if;
  v_own := kafaa_has_grant('ecosystem', array['Own']);
  v_orgw := v_mine is not null and kafaa_has_grant('ecosystem', array['OrgW']);
  v_hr := kafaa_has_grant('ecosystem', array['W', 'A']) and kafaa_has_grant('workforce_strategy', array['W', 'A']);
  if not v_own and not v_orgw and not v_hr then return kafaa_refuse('consortium.visit.log', 'consortium_visits', null, 'forbidden', 'Only the trainee, their employer''s administrator or the programme office logs a visit'); end if;
  select * into m from kafaa_consortium_members where id = v_mid;
  v_self := m.id is not null and m.person_id is not null and m.person_id = me and v_own;
  v_emp := m.id is not null and v_orgw and m.org_id = v_mine;
  if m.id is null or (not v_self and not v_emp and not v_hr) then return kafaa_refuse('consortium.visit.log', 'consortium_visits', null, 'not_found', 'Trainee not found'); end if;
  v_via := case when v_self then 'self' when v_emp then 'employer' else 'programme' end;
  v_role := case when v_self then kafaa_acting_role('ecosystem', array['Own']) when v_emp then kafaa_acting_role('ecosystem', array['OrgW']) else kafaa_acting_role('workforce_strategy', array['W', 'A']) end;
  select * into c from kafaa_consortium_cohorts where id = m.cohort_id;
  v_problem := kafaa_cc_visit_problem(p, c, m, current_date);
  if v_problem is not null then return kafaa_refuse('consortium.visit.log', 'consortium_visits', null, 'invalid', 'Check the visit: ' || case v_problem
    when 'member' then 'the trainee must hold an accepted place in this cohort' when 'host' then 'choose a host organisation of the cohort'
    when 'same_org' then 'a cross-site visit is to another consortium organisation, not the trainee''s own' when 'date' then 'a date within the cohort, not in the future and in the last 120 days'
    when 'hours' then '1 to 40 hours in half-hour steps' when 'module' then 'choose a module hosted by that organisation, or none' else 'a note of up to 300 characters without contact details' end, v_role); end if;
  v_id := 'cv-' || kafaa_w5_hex(12);
  insert into kafaa_consortium_visits (id, cohort_id, member_id, org_id, person_id, trainee_code, host_org_id, module_id, visit_on, hours, note, skill_id, status, logged_by, logged_via,
    level, evidence, profile_evidence, created_at, open_read, sample)
  values (v_id, c.id, v_mid, m.org_id, m.person_id, m.trainee_code, p ->> 'host_org_id', nullif(case when jsonb_typeof(p -> 'module_id') = 'string' then p ->> 'module_id' end, ''), (p ->> 'visit_on')::date,
    (p ->> 'hours')::numeric, kafaa_rg_txt(p -> 'note'), kafaa_cc_partner(c.partners, p ->> 'host_org_id') ->> 'visit_skill', 'logged', me, v_via, 0, '[]'::jsonb, false, now(), false, false);
  a := kafaa_audit('consortium.visit.log', 'consortium_visits', v_id, 'ok', m.trainee_code || ' at ' || (p ->> 'host_org_id') || ' ' || ((p ->> 'hours')::numeric)::text || 'h (' || v_via || ')', 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Visit logged; the host will confirm it', a, null, jsonb_build_object('id', v_id, 'status', 'logged'));
end $$;

-- Only the host confirms or declines; never the visitor or whoever logged it; a confirmation writes evidence; audit + ledger on confirm
create or replace function kafaa_confirm_consortium_visit(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_vid text := coalesce(p ->> 'visit_id', ''); v_mine text := kafaa_my_org(); v_orgw boolean; v_hr boolean; v kafaa_consortium_visits; c kafaa_consortium_cohorts;
  v_route text; v_dec text; v_reason text; v_ref text; v_level integer; v_kindp text; v_profile boolean; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('consortium.visit.decide', 'consortium_visits', nullif(v_vid, ''), 'not_signed_in', 'Sign in to use the consortium cohort'); end if;
  v_orgw := v_mine is not null and kafaa_has_grant('ecosystem', array['OrgW']);
  v_hr := kafaa_has_grant('ecosystem', array['W', 'A']) and kafaa_has_grant('workforce_strategy', array['W', 'A']);
  if not v_orgw and not v_hr then return kafaa_refuse('consortium.visit.decide', 'consortium_visits', nullif(v_vid, ''), 'forbidden', 'Only the host organisation confirms this visit'); end if;
  select * into v from kafaa_consortium_visits where id = v_vid;
  if v.id is null then return kafaa_refuse('consortium.visit.decide', 'consortium_visits', nullif(v_vid, ''), 'not_found', 'Visit not found'); end if;
  select * into c from kafaa_consortium_cohorts where id = v.cohort_id;
  v_route := kafaa_cc_route(c.partners, v.host_org_id, v_mine, v_orgw, v_hr);
  if v_route is null then return kafaa_refuse('consortium.visit.decide', 'consortium_visits', v_vid, 'forbidden', 'Only the host organisation confirms this visit'); end if;
  v_role := case when v_route = 'host' then kafaa_acting_role('ecosystem', array['OrgW']) else kafaa_acting_role('workforce_strategy', array['W', 'A']) end;
  if v.person_id = me or v.logged_by = me then return kafaa_refuse('consortium.visit.decide', 'consortium_visits', v_vid, 'maker_checker', 'The visitor or whoever logged the visit cannot confirm it', v_role); end if;
  if v.status <> 'logged' then return kafaa_refuse('consortium.visit.decide', 'consortium_visits', v_vid, 'invalid', 'This visit is already decided', v_role); end if;
  v_dec := case when jsonb_typeof(p -> 'decision') = 'string' then p ->> 'decision' else '' end;
  if v_dec not in ('confirm', 'decline') then return kafaa_refuse('consortium.visit.decide', 'consortium_visits', v_vid, 'invalid', 'Choose confirm or decline', v_role); end if;
  if v_dec = 'decline' then
    v_reason := kafaa_rg_txt(p -> 'reason');
    if length(v_reason) < 5 or length(v_reason) > 300 then return kafaa_refuse('consortium.visit.decide', 'consortium_visits', v_vid, 'invalid', 'Give a reason (5 to 300 characters) when you decline', v_role); end if;
    update kafaa_consortium_visits set status = 'declined', decided_by = me, decided_at = now(), decline_reason = v_reason, confirmed_via = v_route where id = v_vid;
    perform kafaa_w5_notify('nt-cv-' || v_vid || '-declined', v.person_id, 'consortium', 'Your consortium visit was not confirmed by the host', 'لم تؤكد الجهة المضيفة زيارتك ضمن الدفعة المشتركة', '/my/consortium', 'warn');
    a := kafaa_audit('consortium.visit.decide', 'consortium_visits', v_vid, 'ok', 'declined (' || v_route || ')', 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Visit declined', a, null, jsonb_build_object('id', v_vid, 'status', 'declined', 'level', 0, 'profile_evidence', false));
  end if;
  v_ref := kafaa_rg_txt(p -> 'host_ref');
  if v_route = 'on_behalf' and (length(v_ref) < 3 or length(v_ref) > 80) then
    return kafaa_refuse('consortium.visit.decide', 'consortium_visits', v_vid, 'invalid', 'Record the host''s written confirmation reference (3 to 80 characters)', v_role); end if;
  v_level := kafaa_cc_level(v.member_id, v_vid, v.host_org_id, v.hours);
  select pp.kind into v_kindp from kafaa_people pp where pp.id = v.person_id;
  v_profile := v.person_id is not null and v_kindp is not distinct from 'staff';
  if v_profile then
    insert into kafaa_skill_evidence (id, person_id, skill_id, kind, ref_table, ref_id, level, basis, status, observed_on, note, recorded_by, active)
    values ('se:ojt:' || v_vid || ':' || v.skill_id, v.person_id, v.skill_id, 'ojt', 'consortium_visits', v_vid, v_level, 'validated', 'current', v.visit_on, 'Consortium cross-site visit confirmed by the host', me, true)
    on conflict (id) do nothing;
  end if;
  update kafaa_consortium_visits set status = 'confirmed', decided_by = me, decided_at = now(), confirmed_via = v_route, host_ref = case when v_route = 'on_behalf' then v_ref else nullif(v_ref, '') end,
    level = v_level, evidence = jsonb_build_array(jsonb_build_object('skill_id', v.skill_id, 'level', v_level)), profile_evidence = v_profile where id = v_vid;
  if v_profile then perform kafaa_skills_apply(v.person_id, current_date); end if;
  perform kafaa_w5_notify('nt-cv-' || v_vid || '-confirmed', v.person_id, 'consortium', 'Your consortium visit was confirmed by the host', 'أكدت الجهة المضيفة زيارتك ضمن الدفعة المشتركة', '/my/consortium', 'ok');
  l := kafaa_ledger('kafaa.consortium.visit_confirm', 'Consortium visit ' || v_vid || ' confirmed by the host (level ' || v_level || ')');
  a := kafaa_audit('consortium.visit.decide', 'consortium_visits', v_vid, 'ok', 'confirmed L' || v_level || ' (' || v_route || ')', case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Visit confirmed', a, l, jsonb_build_object('id', v_vid, 'status', 'confirmed', 'level', v_level, 'profile_evidence', v_profile));
end $$;

-- The trainee or whoever logged it withdraws a visit still waiting for the host; audited
create or replace function kafaa_withdraw_consortium_visit(p_id text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_vid text := coalesce(p_id, ''); v kafaa_consortium_visits; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('consortium.visit.withdraw', 'consortium_visits', nullif(v_vid, ''), 'not_signed_in', 'Sign in to use the consortium cohort'); end if;
  select * into v from kafaa_consortium_visits where id = v_vid;
  if v.id is null then return kafaa_refuse('consortium.visit.withdraw', 'consortium_visits', nullif(v_vid, ''), 'not_found', 'Visit not found'); end if;
  if v.person_id is distinct from me and v.logged_by <> me then return kafaa_refuse('consortium.visit.withdraw', 'consortium_visits', v_vid, 'forbidden', 'Only the trainee or whoever logged the visit withdraws it'); end if;
  if v.status <> 'logged' then return kafaa_refuse('consortium.visit.withdraw', 'consortium_visits', v_vid, 'invalid', 'This visit is already decided'); end if;
  update kafaa_consortium_visits set status = 'withdrawn' where id = v_vid;
  a := kafaa_audit('consortium.visit.withdraw', 'consortium_visits', v_vid, 'ok', 'withdrawn', 'not_applicable', null, null);
  return kafaa_result(true, 'ok', 'Visit withdrawn', a, null, jsonb_build_object('id', v_vid, 'status', 'withdrawn'));
end $$;

-- The visits my organisation hosts (programme office: ENEC sites and hosts without Kafa'a access), as the host sees them: trainee code,
-- visiting organisation, date, hours; never a member row or a person. Read-only; a refusal is audited.
create or replace function kafaa_consortium_host_visits() returns jsonb language plpgsql security definer set search_path = public as $$
declare v_mine text := kafaa_my_org(); v_orgw boolean; v_hr boolean; v jsonb;
begin
  if kafaa_me() is null then return kafaa_refuse('consortium.host_visits', 'consortium_visits', null, 'not_signed_in', 'Sign in to use the consortium cohort'); end if;
  v_orgw := v_mine is not null and kafaa_has_grant('ecosystem', array['OrgW']);
  v_hr := kafaa_has_grant('ecosystem', array['W', 'A']) and kafaa_has_grant('workforce_strategy', array['W', 'A']);
  if not v_orgw and not v_hr then return kafaa_refuse('consortium.host_visits', 'consortium_visits', null, 'forbidden', 'Only the host organisation confirms this visit'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'cohort_id', x.cohort_id, 'trainee_code', x.trainee_code, 'org_id', x.org_id, 'org_name_en', coalesce(o.name_en, x.org_id),
      'org_name_ar', coalesce(o.name_ar, o.name_en, x.org_id), 'host_org_id', x.host_org_id, 'module_id', x.module_id, 'visit_on', x.visit_on::text, 'hours', x.hours, 'note', x.note,
      'skill_id', x.skill_id, 'status', x.status, 'level', x.level, 'confirmed_via', x.confirmed_via, 'route', x.route) order by x.visit_on desc, x.id collate "C"), '[]'::jsonb)
    into v
    from (select vv.*, kafaa_cc_route(c.partners, vv.host_org_id, v_mine, v_orgw, v_hr) route from kafaa_consortium_visits vv join kafaa_consortium_cohorts c on c.id = vv.cohort_id) x
    left join kafaa_organisations o on o.id = x.org_id
   where x.route is not null;
  return jsonb_build_object('ok', true, 'code', 'ok', 'message', 'Visits to confirm as host', 'audit_seq', null, 'ledger_seq', null, 'data', v);
end $$;

-- Cohort aggregates for every ecosystem reader; counts of 1-9 suppressed. Read-only; a refusal is audited.
create or replace function kafaa_consortium_stats() returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if kafaa_me() is null then return kafaa_refuse('consortium.stats', 'consortium_members', null, 'not_signed_in', 'Sign in to use the consortium cohort'); end if;
  if not kafaa_has_grant('ecosystem', array['R', 'Own', 'OwnOrg', 'OrgW', 'Agg', 'W', 'A']) then
    return kafaa_refuse('consortium.stats', 'consortium_members', null, 'forbidden', 'Consortium figures are for ENEC staff, partners, universities, HR and auditors'); end if;
  return jsonb_build_object('ok', true, 'code', 'ok', 'message', 'Consortium figures', 'audit_seq', null, 'ledger_seq', null, 'data', kafaa_cc_stats(current_date));
end $$;

-- ───────────── Grants: internal helpers are not executable by API roles; the fourteen RPCs only by signed-in users.
revoke all on function kafaa_gr_next_deadline(date), kafaa_gr_slot(date, date), kafaa_gr_phase(date, date, date), kafaa_gr_schedule_problem(jsonb, date), kafaa_gr_full_years(date, date),
  kafaa_gr_eligibility(text, date, boolean), kafaa_gr_cost_total(jsonb), kafaa_gr_app_problem(jsonb, date, integer), kafaa_gr_decision_problem(jsonb, integer, date, date, integer, integer, integer, date),
  kafaa_gr_output_problem(jsonb, date, date), kafaa_gr_cell(bigint), kafaa_gr_rate(bigint, bigint), kafaa_gr_stats(date),
  kafaa_cc_is_enec(text), kafaa_cc_partner(jsonb, text), kafaa_cc_org(jsonb, text), kafaa_cc_phase(date, date, date, date), kafaa_cc_code(jsonb, text, integer, integer), kafaa_cc_enec_eligible(text, date),
  kafaa_cc_nom_problem(jsonb, kafaa_consortium_cohorts, text, boolean, integer, boolean, date), kafaa_cc_decision_problem(jsonb, text, kafaa_consortium_cohorts),
  kafaa_cc_visit_problem(jsonb, kafaa_consortium_cohorts, kafaa_consortium_members, date), kafaa_cc_level(text, text, text, numeric), kafaa_cc_route(jsonb, text, text, boolean, boolean),
  kafaa_cc_stats(date) from public, anon, authenticated;
revoke all on function kafaa_schedule_grant_round(jsonb), kafaa_apply_grant(jsonb), kafaa_withdraw_grant(text), kafaa_decide_grant(jsonb), kafaa_submit_grant_output(jsonb),
  kafaa_review_grant_output(jsonb), kafaa_grant_stats(), kafaa_nominate_consortium_trainee(jsonb), kafaa_decide_consortium_member(jsonb), kafaa_log_consortium_visit(jsonb),
  kafaa_confirm_consortium_visit(jsonb), kafaa_withdraw_consortium_visit(text), kafaa_consortium_host_visits(), kafaa_consortium_stats() from public, anon;
grant execute on function kafaa_schedule_grant_round(jsonb), kafaa_apply_grant(jsonb), kafaa_withdraw_grant(text), kafaa_decide_grant(jsonb), kafaa_submit_grant_output(jsonb),
  kafaa_review_grant_output(jsonb), kafaa_grant_stats(), kafaa_nominate_consortium_trainee(jsonb), kafaa_decide_consortium_member(jsonb), kafaa_log_consortium_visit(jsonb),
  kafaa_confirm_consortium_visit(jsonb), kafaa_withdraw_consortium_visit(text), kafaa_consortium_host_visits(), kafaa_consortium_stats() to authenticated;
