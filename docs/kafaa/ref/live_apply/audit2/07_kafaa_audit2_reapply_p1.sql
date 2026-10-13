-- kafaa_audit2_reapply_p1 (1/1) · from kafaa/supabase/migrations/20261013100007_kafaa_audit2_reapply.sql (final audit fixes 2026-10-13, branch audit2-fixes)
-- Apply with apply_migration name "kafaa_audit2_reapply_p1", in ORDER.txt order. Idempotent; a second run changes nothing. See EXPECTED.md.
-- [Audit2 2026-10-13 · finding 5] Re-applying reopens a withdrawn application instead of adding a row.
-- The E2E journeys J5/J6 (tests/e2e/journeys.spec.ts) apply and withdraw against the live project on every run; each run added a new
-- withdrawn app-<uuid> row (15 so far), and the gpo/withdrawn funnel cell was one run away from the suppression threshold of 10 with
-- test rows only. kafaa_submit_application now reuses the caller's most recent withdrawn application for the same programme: same id,
-- stage back to submitted (or interest), new answers, decision cleared, deletion schedule (delete_after) cleared, a new event
-- 'Application received again' on the kept history, and the audit and ledger rows say 'reopened'. Applications that ended as
-- unsuccessful or accepted are not reopened (a new application is a new row, as before). One application row per person and programme
-- while it keeps being withdrawn and re-sent, so repeated journey runs no longer accumulate rows. Mirror: LocalRpc.submitApplication.
-- Same signature, result shape and grants. kafaa_* objects only; idempotent.
create or replace function kafaa_submit_application(p_programme_id text, p_answers jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text := kafaa_acting_role('applications', array['Own']); prog kafaa_talent_programmes;
  v_answers jsonb := coalesce(p_answers, '{}'::jsonb); v_id text; v_stage text; v_nat text; a kafaa_audit_events; l integer; v_reopen boolean := false;
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
  v_stage := case when v_answers->>'mode' = 'interest' then 'interest' else 'submitted' end;
  v_nat := case when v_answers->>'nationality' in ('uae', 'other') then v_answers->>'nationality' else 'unknown' end;
  -- re-applying after withdrawing reopens the withdrawn application (same id, its history kept) instead of adding a row
  select x.id into v_id from kafaa_applications x where x.person_id = me and x.programme_id = p_programme_id and x.stage = 'withdrawn'
   order by x.updated_at desc, x.id desc limit 1;
  if v_id is not null then
    v_reopen := true;
    update kafaa_applications set stage = v_stage, submitted_at = now(), updated_at = now(), decision = 'none', decision_source = null, consent_version = '1',
           delete_after = null, answers = v_answers, nationality_flag = v_nat where id = v_id;
  else
    v_id := 'app-' || replace(gen_random_uuid()::text, '-', '');
    insert into kafaa_applications (id, person_id, programme_id, stage, submitted_at, updated_at, decision, decision_source, consent_version, delete_after, answers, nationality_flag, gender)
    values (v_id, me, p_programme_id, v_stage, now(), now(), 'none', null, '1', null, v_answers, v_nat, null);
  end if;
  insert into kafaa_application_events (id, application_id, person_id, ts, stage, note_en, note_ar, by_role)
  values ('ae-' || replace(gen_random_uuid()::text, '-', ''), v_id, me, now(), v_stage,
          case when v_stage = 'interest' then 'Interest registered' when v_reopen then 'Application received again (re-applied after withdrawing)' else 'Application received' end,
          case when v_stage = 'interest' then 'تم تسجيل الاهتمام' when v_reopen then 'تم استلام الطلب مجدداً (إعادة تقديم بعد السحب)' else 'تم استلام الطلب' end, 'Applicant');
  l := kafaa_ledger('kafaa.application.submit', format('Application %s to %s (%s)%s', v_id, p_programme_id, v_stage, case when v_reopen then ', reopened' else '' end));
  a := kafaa_audit('application.submit', 'applications', v_id, 'ok', p_programme_id || ' ' || v_stage || case when v_reopen then ' reopened' else '' end, case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when v_stage = 'interest' then 'Interest registered' else 'Application submitted' end, a, l, jsonb_build_object('id', v_id, 'stage', v_stage));
end $$;
