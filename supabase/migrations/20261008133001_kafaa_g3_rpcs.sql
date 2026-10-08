-- [G3] M06 talent pipeline, M07 workforce analytics, M10 universities and research.
-- Additive and idempotent: create or replace functions, revoke/grant, guarded DO blocks. Nothing is dropped.
-- Mirrored 1:1 by the [G3] block in src/data/local/rpc.ts (same checks, refusal codes, audit and ledger behaviour).
-- Every RPC: SECURITY DEFINER, set search_path = public, refusals through kafaa_refuse (audited), results through kafaa_result.

-- ───────────── Table write lock-down for tables that moved to write mode 'rpc' (src/data/schema.ts)
-- kafaa_applications and kafaa_research_proposals change only through the RPCs below, so an applicant cannot move their
-- own application to "offer" and a partner cannot mark its own proposal screened or accepted with a direct update.
revoke insert, update, delete on kafaa_applications from anon, authenticated;
revoke insert, update, delete on kafaa_research_proposals from anon, authenticated;
-- The RPCs write their own audit rows; the row-level audit trigger created earlier for direct writes would double them.
do $$
begin
  if exists (select 1 from pg_trigger where tgname = 'kafaa_applications_audit' and not tgisinternal and tgenabled <> 'D') then
    execute 'alter table kafaa_applications disable trigger kafaa_applications_audit';
  end if;
  if exists (select 1 from pg_trigger where tgname = 'kafaa_research_proposals_audit' and not tgisinternal and tgenabled <> 'D') then
    execute 'alter table kafaa_research_proposals disable trigger kafaa_research_proposals_audit';
  end if;
end $$;

-- A university partner reads the cohort aggregates hosted at its own university (generated policy kafaa_read carries the same
-- rule for fresh databases; this extra policy brings an already-migrated database to the same result without a drop).
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_scholar_cohorts' and policyname = 'kafaa_g3_read_university') then
    execute 'create policy kafaa_g3_read_university on kafaa_scholar_cohorts for select to authenticated using (kafaa_rule_read(''partner_org'', null::text, university_org_id, true))';
  end if;
end $$;

-- HR planning role for scenarios and bench targets: the HR analyst or the HR authority (CHCO office).
create or replace function kafaa_g3_hr_role() returns text language sql stable security definer set search_path = public as $$
  select case when kafaa_has_role('hr_director') then 'hr_director' when kafaa_has_role('hr_analyst') then 'hr_analyst' else null end
$$;

-- ───────────── M06 · submit an application or expression of interest (the applicant; never decided automatically)
create or replace function kafaa_submit_application(p_programme_id text, p_answers jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text := kafaa_acting_role('applications', array['Own']); prog kafaa_talent_programmes;
  v_answers jsonb := coalesce(p_answers, '{}'::jsonb); v_id text; v_stage text; v_nat text; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('application.submit', 'applications', p_programme_id, 'not_signed_in', 'Sign in with an applicant account to apply'); end if;
  if v_role is null then return kafaa_refuse('application.submit', 'applications', p_programme_id, 'forbidden', 'This account cannot apply to talent programmes'); end if;
  select * into prog from kafaa_talent_programmes where id = p_programme_id;
  if prog.id is null then return kafaa_refuse('application.submit', 'applications', p_programme_id, 'not_found', 'Programme not found', v_role); end if;
  if prog.apply_mode <> 'in_kafaa' then return kafaa_refuse('application.submit', 'applications', p_programme_id, 'invalid', 'This programme takes applications on ENEC''s official channel', v_role); end if;
  if jsonb_typeof(v_answers) <> 'object' then v_answers := '{}'::jsonb; end if;
  if exists (select 1 from jsonb_object_keys(v_answers) k where lower(k) in ('emirates_id', 'emiratesid', 'eid', 'passport', 'passport_no', 'dob', 'date_of_birth', 'birth_date')) then
    return kafaa_refuse('application.submit', 'applications', p_programme_id, 'invalid', 'Do not send an Emirates ID, passport number or date of birth: they are collected later through UAE Pass if a stage needs them', v_role);
  end if;
  if length(v_answers::text) > 4000 or exists (select 1 from jsonb_each(v_answers) e where jsonb_typeof(e.value) <> 'string') then
    return kafaa_refuse('application.submit', 'applications', p_programme_id, 'invalid', 'Answers are too long or not text', v_role);
  end if;
  if exists (select 1 from kafaa_applications x where x.person_id = me and x.programme_id = p_programme_id and x.stage not in ('withdrawn', 'unsuccessful')) then
    return kafaa_refuse('application.submit', 'applications', p_programme_id, 'conflict', 'You already have an open application for this programme', v_role);
  end if;
  v_id := 'app-' || replace(gen_random_uuid()::text, '-', '');
  v_stage := case when v_answers->>'mode' = 'interest' then 'interest' else 'submitted' end;
  v_nat := case when v_answers->>'nationality' in ('uae', 'other') then v_answers->>'nationality' else 'unknown' end;
  insert into kafaa_applications (id, person_id, programme_id, stage, submitted_at, updated_at, decision, decision_source, consent_version, delete_after, answers, nationality_flag, gender)
  values (v_id, me, p_programme_id, v_stage, now(), now(), 'none', null, '1', null, v_answers, v_nat, null);
  insert into kafaa_application_events (id, application_id, person_id, ts, stage, note_en, note_ar, by_role)
  values ('ae-' || replace(gen_random_uuid()::text, '-', ''), v_id, me, now(), v_stage,
          case when v_stage = 'interest' then 'Interest registered' else 'Application received' end,
          case when v_stage = 'interest' then 'تم تسجيل الاهتمام' else 'تم استلام الطلب' end, 'Applicant');
  l := kafaa_ledger('kafaa.application.submit', format('Application %s to %s (%s)', v_id, p_programme_id, v_stage));
  a := kafaa_audit('application.submit', 'applications', v_id, 'ok', p_programme_id || ' ' || v_stage, case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when v_stage = 'interest' then 'Interest registered' else 'Application submitted' end, a, l, jsonb_build_object('id', v_id, 'stage', v_stage));
end $$;

-- ───────────── M06 · withdraw one's own application (data deleted on the published schedule: 6 months)
create or replace function kafaa_withdraw_application(p_id text, p_reason text default '') returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text := kafaa_acting_role('applications', array['Own']); ap kafaa_applications; v_note text := left(coalesce(p_reason, ''), 300); a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('application.withdraw', 'applications', p_id, 'not_signed_in', 'Sign in to manage your applications'); end if;
  select * into ap from kafaa_applications where id = p_id;
  if ap.id is null or ap.person_id <> me or v_role is null then return kafaa_refuse('application.withdraw', 'applications', p_id, 'not_found', 'Application not found', v_role); end if;
  if ap.stage in ('withdrawn', 'unsuccessful', 'accepted') then return kafaa_refuse('application.withdraw', 'applications', p_id, 'invalid', 'Application is closed', v_role); end if;
  update kafaa_applications set stage = 'withdrawn', decision = 'withdrawn', updated_at = now(), delete_after = (current_date + interval '6 months')::date where id = p_id;
  insert into kafaa_application_events (id, application_id, person_id, ts, stage, note_en, note_ar, by_role)
  values ('ae-' || replace(gen_random_uuid()::text, '-', ''), p_id, me, now(), 'withdrawn', coalesce(nullif(v_note, ''), 'Withdrawn by applicant'), coalesce(nullif(v_note, ''), 'سحبه المتقدم'), 'Applicant');
  l := kafaa_ledger('kafaa.application.withdraw', format('Application %s (%s) withdrawn by the applicant', p_id, ap.programme_id));
  a := kafaa_audit('application.withdraw', 'applications', p_id, 'ok', 'withdrawn', case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Application withdrawn', a, l);
end $$;

-- ───────────── M07 · HR prepares an observer report draft from aggregate tiles (release still needs kafaa_observer_report_action)
create or replace function kafaa_draft_observer_report(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_role text := kafaa_acting_role('observer_release', array['W','A']); v_tiles jsonb := coalesce(p->'tiles', '[]'::jsonb); v_id text; a kafaa_audit_events;
begin
  if v_role is null then return kafaa_refuse('observer_report.draft', 'observer_reports', null, 'forbidden', 'Only HR may prepare an observer report'); end if;
  if length(trim(coalesce(p->>'title_en', ''))) < 5 or length(trim(coalesce(p->>'title_ar', ''))) < 5 or trim(coalesce(p->>'period', '')) = '' then
    return kafaa_refuse('observer_report.draft', 'observer_reports', null, 'invalid', 'A report needs an English and an Arabic title and a period', v_role);
  end if;
  if jsonb_typeof(v_tiles) <> 'array' or jsonb_array_length(v_tiles) < 1 or jsonb_array_length(v_tiles) > 12
     or exists (select 1 from jsonb_array_elements(v_tiles) t where coalesce(t->>'k', '') = '' or coalesce(t->>'v', '') = '' or length(t->>'v') > 60) then
    return kafaa_refuse('observer_report.draft', 'observer_reports', null, 'invalid', 'Choose between 1 and 12 aggregate tiles', v_role);
  end if;
  v_id := 'or-' || replace(gen_random_uuid()::text, '-', '');
  insert into kafaa_observer_reports (id, title_en, title_ar, period, body, status, prepared_by, approved_by, approved_at, released_to_org_ids)
  values (v_id, trim(p->>'title_en'), trim(p->>'title_ar'), trim(p->>'period'),
          jsonb_build_object('tiles', (select jsonb_agg(jsonb_build_object('k', t->>'k', 'v', t->>'v', 'src', coalesce(t->>'src', ''))) from jsonb_array_elements(v_tiles) t),
                             'note', coalesce(p->>'note', 'Aggregate only; groups under 10 suppressed.')),
          'draft', kafaa_me(), null, null, '{}');
  a := kafaa_audit('observer_report.draft', 'observer_reports', v_id, 'ok', jsonb_array_length(v_tiles) || ' tiles', 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Draft saved', a, null, jsonb_build_object('id', v_id));
end $$;

-- ───────────── M07 · save a workforce scenario (always SIMULATED; never a forecast)
create or replace function kafaa_save_scenario(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_role text := kafaa_g3_hr_role(); v_name text := trim(coalesce(p->>'name', '')); v_kind text := p->>'kind'; v_id text := nullif(p->>'id', ''); cur kafaa_scenarios; a kafaa_audit_events;
begin
  if v_role is null then return kafaa_refuse('scenario.save', 'scenarios', v_id, 'forbidden', 'Only HR analysts may save workforce scenarios'); end if;
  if length(v_name) < 3 or coalesce(v_kind, '') not in ('headcount', 'technology', 'programme') then return kafaa_refuse('scenario.save', 'scenarios', v_id, 'invalid', 'A scenario needs a name and a kind', v_role); end if;
  if v_name !~* 'simulated' then v_name := v_name || ' (SIMULATED)'; end if;
  if v_id is not null then
    select * into cur from kafaa_scenarios where id = v_id;
    if cur.id is null or cur.owner_person_id is distinct from kafaa_me() then return kafaa_refuse('scenario.save', 'scenarios', v_id, 'not_found', 'Scenario not found', v_role); end if;
    update kafaa_scenarios set name = v_name, kind = v_kind, params = coalesce(p->'params', '{}'::jsonb), results = coalesce(p->'results', '{}'::jsonb), simulated = true where id = v_id;
  else
    v_id := 'scn-' || replace(gen_random_uuid()::text, '-', '');
    insert into kafaa_scenarios (id, name, kind, params, results, simulated, owner_person_id, created_at)
    values (v_id, v_name, v_kind, coalesce(p->'params', '{}'::jsonb), coalesce(p->'results', '{}'::jsonb), true, kafaa_me(), now());
  end if;
  a := kafaa_audit('scenario.save', 'scenarios', v_id, 'ok', v_name, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Scenario saved', a, null, jsonb_build_object('id', v_id));
end $$;

-- ───────────── M07 · HR sets the bench-depth target for a critical role (counts only, never names)
create or replace function kafaa_set_bench_target(p_id text, p_target integer, p_reason text) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_role text := kafaa_g3_hr_role(); r kafaa_critical_roles; a kafaa_audit_events; l integer;
begin
  if v_role is null then return kafaa_refuse('bench.target', 'critical_roles', p_id, 'forbidden', 'Only HR sets bench-depth targets'); end if;
  select * into r from kafaa_critical_roles where id = p_id;
  if r.id is null then return kafaa_refuse('bench.target', 'critical_roles', p_id, 'not_found', 'Critical role not found', v_role); end if;
  if p_target is null or p_target < 0 or p_target > 1000 then return kafaa_refuse('bench.target', 'critical_roles', p_id, 'invalid', 'Target must be a whole number from 0 to 1000', v_role); end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then return kafaa_refuse('bench.target', 'critical_roles', p_id, 'invalid', 'Give a reason of at least 5 characters', v_role); end if;
  update kafaa_critical_roles set target_bench = p_target where id = p_id;
  l := kafaa_ledger('kafaa.workforce.bench_target', format('Bench target for %s set to %s', r.role_id, p_target));
  a := kafaa_audit('bench.target', 'critical_roles', p_id, 'ok', format('%s -> %s: %s', r.target_bench, p_target, trim(p_reason)), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Target updated', a, l);
end $$;

-- ───────────── M10 · create or edit a research challenge (any edit needs a fresh screening sign-off before it is public)
create or replace function kafaa_save_research_challenge(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_role text := kafaa_acting_role('research', array['A']); v_id text := nullif(p->>'id', ''); c kafaa_research_challenges; v_status text; a kafaa_audit_events;
  v_submit boolean := coalesce((p->>'submit')::boolean, false);
begin
  if v_role is null then return kafaa_refuse('research.challenge_save', 'research_challenges', v_id, 'forbidden', 'Only the research screening authority may edit challenges'); end if;
  if length(trim(coalesce(p->>'title_en', ''))) < 3 or length(trim(coalesce(p->>'title_ar', ''))) < 3 or length(trim(coalesce(p->>'summary_en', ''))) < 3
     or length(trim(coalesce(p->>'summary_ar', ''))) < 3 or length(trim(coalesce(p->>'theme', ''))) < 3 then
    return kafaa_refuse('research.challenge_save', 'research_challenges', v_id, 'invalid', 'Titles, summaries (English and Arabic) and a theme are required', v_role);
  end if;
  if v_id is not null then
    select * into c from kafaa_research_challenges where id = v_id;
    if c.id is null then return kafaa_refuse('research.challenge_save', 'research_challenges', v_id, 'not_found', 'Challenge not found', v_role); end if;
    if c.status = 'closed' then return kafaa_refuse('research.challenge_save', 'research_challenges', v_id, 'invalid', 'A closed challenge cannot be edited', v_role); end if;
    v_status := case when c.status = 'draft' and not v_submit then 'draft' else 'screening' end;
    update kafaa_research_challenges set title_en = trim(p->>'title_en'), title_ar = trim(p->>'title_ar'), theme = trim(p->>'theme'), summary_en = trim(p->>'summary_en'),
      summary_ar = trim(p->>'summary_ar'), closes_on = nullif(p->>'closes_on', '')::date, status = v_status, is_published = false, security_ok = false, export_control_ok = false,
      screening_signed_by = null, screening_signed_at = null where id = v_id;
    a := kafaa_audit('research.challenge_save', 'research_challenges', v_id, 'ok', 'edited; now ' || v_status, 'not_applicable', null, v_role);
  else
    v_id := 'rc-' || replace(gen_random_uuid()::text, '-', '');
    v_status := case when v_submit then 'screening' else 'draft' end;
    insert into kafaa_research_challenges (id, title_en, title_ar, theme, summary_en, summary_ar, status, is_published, screening_signed_by, screening_signed_at, security_ok, export_control_ok, closes_on)
    values (v_id, trim(p->>'title_en'), trim(p->>'title_ar'), trim(p->>'theme'), trim(p->>'summary_en'), trim(p->>'summary_ar'), v_status, false, null, null, false, false, nullif(p->>'closes_on', '')::date);
    a := kafaa_audit('research.challenge_save', 'research_challenges', v_id, 'ok', 'created; ' || v_status, 'not_applicable', null, v_role);
  end if;
  return kafaa_result(true, 'ok', case when v_status = 'screening' then 'Saved; awaiting screening sign-off' else 'Draft saved' end, a, null, jsonb_build_object('id', v_id, 'status', v_status));
end $$;

-- ───────────── M10 · a partner organisation saves or submits a research proposal (IP routed via the MoET patents route)
create or replace function kafaa_save_research_proposal(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_org text := kafaa_my_org(); v_role text := kafaa_acting_role('research', array['OrgW']); v_id text := nullif(p->>'id', '');
  v_submit boolean := coalesce((p->>'submit')::boolean, false); v_status text; v_ip text; v_ch text := nullif(p->>'challenge_id', ''); cur kafaa_research_proposals; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('research.proposal_save', 'research_proposals', v_id, 'not_signed_in', 'Sign in to propose research'); end if;
  if v_role is null or v_org is null then return kafaa_refuse('research.proposal_save', 'research_proposals', v_id, 'forbidden', 'Only partner organisations may submit research proposals'); end if;
  if length(trim(coalesce(p->>'title', ''))) < 5 or length(p->>'title') > 200 or length(trim(coalesce(p->>'summary', ''))) < 20 or length(p->>'summary') > 4000 then
    return kafaa_refuse('research.proposal_save', 'research_proposals', v_id, 'invalid', 'A proposal needs a title (5-200 characters) and a summary (20-4000 characters)', v_role);
  end if;
  if v_ch is not null and not exists (select 1 from kafaa_research_challenges c where c.id = v_ch and c.is_published) then
    return kafaa_refuse('research.proposal_save', 'research_proposals', v_id, 'invalid', 'Respond to a published challenge, or leave the challenge empty for an open proposal', v_role);
  end if;
  v_ip := coalesce(nullif(trim(coalesce(p->>'ip_route', '')), ''), 'MoET patents route (May 2026 MoU)');
  v_status := case when v_submit then 'submitted' else 'draft' end;
  if v_id is not null then
    select * into cur from kafaa_research_proposals where id = v_id;
    if cur.id is null or cur.org_id <> v_org then return kafaa_refuse('research.proposal_save', 'research_proposals', v_id, 'not_found', 'Proposal not found', v_role); end if;
    if cur.status <> 'draft' then return kafaa_refuse('research.proposal_save', 'research_proposals', v_id, 'invalid', 'A submitted proposal cannot be edited', v_role); end if;
    update kafaa_research_proposals set challenge_id = v_ch, title = trim(p->>'title'), summary = trim(p->>'summary'), ip_route = v_ip, status = v_status,
      submitted_at = case when v_submit then now() else null end where id = v_id;
  else
    v_id := 'rp-' || replace(gen_random_uuid()::text, '-', '');
    insert into kafaa_research_proposals (id, challenge_id, org_id, title, summary, status, ip_route, screened, submitted_at)
    values (v_id, v_ch, v_org, trim(p->>'title'), trim(p->>'summary'), v_status, v_ip, false, case when v_submit then now() else null end);
  end if;
  l := case when v_submit then kafaa_ledger('kafaa.research.proposal_submit', format('Research proposal %s submitted by %s', v_id, v_org)) else null end;
  a := kafaa_audit('research.proposal_save', 'research_proposals', v_id, 'ok', v_status, case when not v_submit then 'not_applicable' when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when v_submit then 'Proposal submitted for screening' else 'Draft saved' end, a, l, jsonb_build_object('id', v_id, 'status', v_status));
end $$;

-- ───────────── M10 · screening authority screens and decides a proposal (cannot accept before security/export screening)
create or replace function kafaa_decide_research_proposal(p_id text, p_decision text, p_security_ok boolean, p_note text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_role text := kafaa_acting_role('research', array['A']); r kafaa_research_proposals; v_screened boolean; a kafaa_audit_events; l integer;
begin
  if v_role is null then return kafaa_refuse('research.proposal_decide', 'research_proposals', p_id, 'forbidden', 'Only the research screening authority may decide proposals'); end if;
  if coalesce(p_decision, '') not in ('screening', 'accepted', 'declined') then return kafaa_refuse('research.proposal_decide', 'research_proposals', p_id, 'invalid', 'Unknown decision', v_role); end if;
  select * into r from kafaa_research_proposals where id = p_id;
  if r.id is null then return kafaa_refuse('research.proposal_decide', 'research_proposals', p_id, 'not_found', 'Proposal not found', v_role); end if;
  if r.status not in ('submitted', 'screening') then return kafaa_refuse('research.proposal_decide', 'research_proposals', p_id, 'invalid', 'Only submitted proposals can be screened or decided', v_role); end if;
  v_screened := r.screened or coalesce(p_security_ok, false);
  if p_decision = 'accepted' and not v_screened then
    return kafaa_refuse('research.proposal_decide', 'research_proposals', p_id, 'invalid', 'Screen the proposal for security sensitivity and export control before accepting it', v_role);
  end if;
  if p_decision <> 'screening' and length(trim(coalesce(p_note, ''))) < 5 then
    return kafaa_refuse('research.proposal_decide', 'research_proposals', p_id, 'invalid', 'A decision note of at least 5 characters is required', v_role);
  end if;
  update kafaa_research_proposals set status = p_decision, screened = v_screened where id = p_id;
  l := case when p_decision = 'screening' then null else kafaa_ledger('kafaa.research.proposal_decide', format('Research proposal %s (%s): %s', p_id, r.org_id, p_decision)) end;
  a := kafaa_audit('research.proposal_decide', 'research_proposals', p_id, 'ok',
         p_decision || '; screened=' || v_screened || case when coalesce(p_note, '') <> '' then '; ' || left(trim(p_note), 200) else '' end,
         case when l is null then (case when p_decision = 'screening' then 'not_applicable' else 'skipped' end) else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Decision recorded', a, l);
end $$;

-- ───────────── grants: signed-in callers only; the functions check grants themselves
revoke execute on function
  kafaa_g3_hr_role(), kafaa_submit_application(text, jsonb), kafaa_withdraw_application(text, text), kafaa_draft_observer_report(jsonb),
  kafaa_save_scenario(jsonb), kafaa_set_bench_target(text, integer, text), kafaa_save_research_challenge(jsonb), kafaa_save_research_proposal(jsonb),
  kafaa_decide_research_proposal(text, text, boolean, text)
from public, anon;
revoke execute on function kafaa_g3_hr_role() from authenticated;
grant execute on function
  kafaa_submit_application(text, jsonb), kafaa_withdraw_application(text, text), kafaa_draft_observer_report(jsonb),
  kafaa_save_scenario(jsonb), kafaa_set_bench_target(text, integer, text), kafaa_save_research_challenge(jsonb), kafaa_save_research_proposal(jsonb),
  kafaa_decide_research_proposal(text, text, boolean, text)
to authenticated;
