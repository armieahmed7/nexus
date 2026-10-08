-- G1 (M01 career map, M02 qualification, M03 licensing tracker): additive kafaa_* objects only.
-- Mirrored 1:1 by src/data/local/rpc.g1.ts (and the detectLicensingEvents fix in src/data/local/rpc.ts). Change both together.
-- Idempotent (create or replace / if not exists) and written without DROP statements so it can be applied live as is.
-- Kafa'a is a tracker, not an authority: nothing here decides a licence, and nothing is sent to FANR.

-- ───────────── M02 · evaluation acknowledgements (table also generated into 20261008120100/0300 by npm run gen)
create table if not exists kafaa_evaluation_acks (
  id text primary key,
  evaluation_id text not null,
  record_id text not null,
  person_id text not null,
  ack_by_person_id text not null,
  ack_role text not null,
  note text,
  created_at timestamptz not null default now()
);
comment on table kafaa_evaluation_acks is '[M02] Supervisor acknowledgement of an evaluation (append-only)';
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_evaluation_acks_evaluation_id_fk') then alter table kafaa_evaluation_acks add constraint kafaa_evaluation_acks_evaluation_id_fk foreign key (evaluation_id) references kafaa_evaluations(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_evaluation_acks_record_id_fk') then alter table kafaa_evaluation_acks add constraint kafaa_evaluation_acks_record_id_fk foreign key (record_id) references kafaa_qual_records(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_evaluation_acks_person_id_fk') then alter table kafaa_evaluation_acks add constraint kafaa_evaluation_acks_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_evaluation_acks_ack_by_person_id_fk') then alter table kafaa_evaluation_acks add constraint kafaa_evaluation_acks_ack_by_person_id_fk foreign key (ack_by_person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_evaluation_acks_evaluation_id_idx on kafaa_evaluation_acks (evaluation_id);
create index if not exists kafaa_evaluation_acks_record_id_idx on kafaa_evaluation_acks (record_id);
create index if not exists kafaa_evaluation_acks_person_id_idx on kafaa_evaluation_acks (person_id);
create index if not exists kafaa_evaluation_acks_ack_by_person_id_idx on kafaa_evaluation_acks (ack_by_person_id);
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'kafaa_evaluation_acks_append_only') then
    create trigger kafaa_evaluation_acks_append_only before update or delete on kafaa_evaluation_acks for each row execute function kafaa_append_only();
  end if;
end $$;
alter table kafaa_evaluation_acks enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_evaluation_acks' and policyname = 'kafaa_read') then
    create policy kafaa_read on kafaa_evaluation_acks for select to anon, authenticated using (kafaa_rule_read('qual_records', person_id, null::text, true));
  end if;
end $$;
grant select on kafaa_evaluation_acks to anon, authenticated;

-- ───────────── M01 · a role cannot publish with an empty source (spec M01 business rule)
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'kafaa_job_roles_published_sources_chk') then
    alter table kafaa_job_roles add constraint kafaa_job_roles_published_sources_chk check (status <> 'published' or jsonb_array_length(sources) > 0);
  end if;
end $$;

-- ───────────── internal helper: idempotent notice (deterministic id); returns true when a new notice was written
create or replace function kafaa_g1_notify(p_id text, p_person text, p_kind text, p_en text, p_ar text, p_link text, p_sev text)
returns boolean language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if p_person is null or not exists (select 1 from kafaa_people where id = p_person) then return false; end if;
  insert into kafaa_notifications (id, person_id, kind, title_en, title_ar, link, severity) values (p_id, p_person, p_kind, p_en, p_ar, p_link, p_sev)
  on conflict (id) do nothing;
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- ───────────── M02 · supervisor acknowledgement (trainee -> evaluator -> supervisor)
create or replace function kafaa_ack_evaluation(p_evaluation_id text, p_note text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); ev kafaa_evaluations; v_role text; v_id text; a kafaa_audit_events; l integer;
begin
  v_role := case when kafaa_has_role('manager') then 'manager' when kafaa_has_role('training_manager') then 'training_manager' else null end;
  if me is null then return kafaa_refuse('evaluation.ack', 'evaluations', p_evaluation_id, 'not_signed_in', 'Sign in to acknowledge evaluations'); end if;
  if v_role is null then return kafaa_refuse('evaluation.ack', 'evaluations', p_evaluation_id, 'forbidden', 'Only a supervisor (line manager or training manager) may acknowledge an evaluation'); end if;
  select * into ev from kafaa_evaluations where id = p_evaluation_id;
  if ev.id is null or not (kafaa_in_scope('qual_records', ev.person_id) or ev.person_id = me) then
    return kafaa_refuse('evaluation.ack', 'evaluations', p_evaluation_id, 'not_found', 'Evaluation not found', v_role);
  end if;
  if ev.person_id = me then return kafaa_refuse('evaluation.ack', 'evaluations', ev.id, 'self_sign', 'You cannot acknowledge an evaluation of your own qualification', v_role); end if;
  if ev.evaluator_person_id = me then return kafaa_refuse('evaluation.ack', 'evaluations', ev.id, 'separation_of_duties', 'The evaluator cannot also give the supervisor acknowledgement', v_role); end if;
  if ev.result = 'pending' then return kafaa_refuse('evaluation.ack', 'evaluations', ev.id, 'invalid', 'Only a signed evaluation can be acknowledged', v_role); end if;
  if ev.supervisor_ack_at is not null or exists (select 1 from kafaa_evaluation_acks k where k.evaluation_id = ev.id) then
    return kafaa_refuse('evaluation.ack', 'evaluations', ev.id, 'conflict', 'This evaluation is already acknowledged', v_role);
  end if;
  v_id := 'ack-' || replace(gen_random_uuid()::text, '-', '');
  insert into kafaa_evaluation_acks (id, evaluation_id, record_id, person_id, ack_by_person_id, ack_role, note)
  values (v_id, ev.id, ev.record_id, ev.person_id, me, case when v_role = 'manager' then 'Line manager / shift supervisor' else 'Training manager' end, nullif(p_note, ''));
  l := kafaa_ledger('kafaa.qualification.ack', format('Supervisor acknowledged evaluation %s on %s', ev.id, ev.record_id));
  a := kafaa_audit('evaluation.ack', 'evaluation_acks', v_id, 'ok', format('ack %s (%s)', ev.id, ev.result), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Acknowledgement recorded', a, l, jsonb_build_object('ack_id', v_id));
end $$;

-- ───────────── M02 · expiry sweep: notices at the standard's intervals (default 90/60/30) to the person and their manager
create or replace function kafaa_qual_expiry_sweep() returns jsonb language plpgsql security definer set search_path = public as $$
declare v_role text := kafaa_acting_role('qual_records', array['Scope']); r record; d integer; n integer; v_code text; v_mgr text; v_ini text; v_sev text;
  n_notice integer := 0; n_due integer := 0; n_exp integer := 0; a kafaa_audit_events;
begin
  if v_role is null then return kafaa_refuse('qualification.expiry_sweep', 'qual_records', null, 'forbidden', 'Only a manager, instructor or coordinator with a scope may run the expiry sweep'); end if;
  for r in select q.*, s.code as std_code, coalesce(rr.notice_days, '[90,60,30]'::jsonb) as notice_days
             from kafaa_qual_records q join kafaa_qual_standards s on s.id = q.standard_id
             left join kafaa_requal_rules rr on rr.standard_id = q.standard_id
            where q.expires_on is not null and q.status in ('qualified', 'due', 'renewed') and kafaa_in_scope('qual_records', q.person_id) loop
    d := r.expires_on - current_date;
    v_code := coalesce(r.std_code, r.standard_id);
    if d < 0 then
      update kafaa_qual_records set status = 'expired' where id = r.id;
      n_exp := n_exp + 1;
      continue;
    end if;
    if d <= 30 and r.status <> 'due' then
      update kafaa_qual_records set status = 'due' where id = r.id;
      n_due := n_due + 1;
    end if;
    select min(x::int) into n from jsonb_array_elements_text(case when jsonb_array_length(r.notice_days) > 0 then r.notice_days else '[90,60,30]'::jsonb end) x where x::int >= d;
    if n is null then continue; end if;
    v_sev := case when n <= 30 then 'warn' else 'info' end;
    if kafaa_g1_notify(format('nt-qx-%s-%s-%s', r.id, n, r.person_id), r.person_id, 'expiry', format('%s expires in %s days (%s)', v_code, d, r.expires_on),
                       format('ينتهي %s خلال %s يوماً (%s)', v_code, d, r.expires_on), '/my/quals', v_sev) then n_notice := n_notice + 1; end if;
    select manager_id, initials into v_mgr, v_ini from kafaa_people where id = r.person_id;
    if v_mgr is not null and kafaa_g1_notify(format('nt-qx-%s-%s-%s', r.id, n, v_mgr), v_mgr, 'expiry', format('Team: %s expires in %s days for %s', v_code, d, coalesce(nullif(v_ini, ''), 'a team member')),
                       format('الفريق: ينتهي %s خلال %s يوماً لأحد أعضاء الفريق', v_code, d), '/team/quals', v_sev) then n_notice := n_notice + 1; end if;
  end loop;
  a := kafaa_audit('qualification.expiry_sweep', 'qual_records', null, 'ok', format('%s notices, %s due, %s expired', n_notice, n_due, n_exp), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', format('%s notices sent', n_notice), a, null, jsonb_build_object('notices', n_notice, 'due', n_due, 'expired', n_exp));
end $$;

-- ───────────── M02 · change impact: review a record flagged by a standard revision
create or replace function kafaa_review_qual_record(p_record_id text, p_decision text, p_note text) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_role text := kafaa_acting_role('frameworks', array['W','A']); rec kafaa_qual_records; old kafaa_qual_standards; cur kafaa_qual_standards; v_status text; a kafaa_audit_events; l integer;
begin
  if v_role is null then return kafaa_refuse('qualification.review', 'qual_records', p_record_id, 'forbidden', 'Only a framework owner (instructor or training manager) may review flagged records'); end if;
  select * into rec from kafaa_qual_records where id = p_record_id;
  if rec.id is null or not kafaa_in_scope('qual_records', rec.person_id) then return kafaa_refuse('qualification.review', 'qual_records', p_record_id, 'not_found', 'Qualification record not found', v_role); end if;
  if p_decision not in ('carry_over', 'retrain') then return kafaa_refuse('qualification.review', 'qual_records', p_record_id, 'invalid', 'Decision must be carry_over or retrain', v_role); end if;
  if not rec.needs_review then return kafaa_refuse('qualification.review', 'qual_records', p_record_id, 'invalid', 'This record is not flagged for review', v_role); end if;
  if coalesce(trim(p_note), '') = '' then return kafaa_refuse('qualification.review', 'qual_records', p_record_id, 'invalid', 'A review note is required', v_role); end if;
  select * into old from kafaa_qual_standards where id = rec.standard_id;
  select * into cur from kafaa_qual_standards where code = old.code and status = 'current' order by version desc limit 1;
  if cur.id is null then cur := old; end if;
  if cur.id is null then return kafaa_refuse('qualification.review', 'qual_standards', rec.standard_id, 'not_found', 'Current standard not found', v_role); end if;
  v_status := case when p_decision = 'retrain' then 'in_progress' else rec.status end;
  update kafaa_qual_records set standard_id = cur.id, standard_version = cur.version, needs_review = false,
    review_reason = case when p_decision = 'retrain' then 'Retraining required: ' || p_note else null end, status = v_status
  where id = rec.id;
  l := kafaa_ledger('kafaa.qualification.review', format('%s %s to %s v%s', rec.id, p_decision, cur.code, cur.version));
  a := kafaa_audit('qualification.review', 'qual_records', rec.id, 'ok', format('%s to %s: %s', p_decision, cur.id, p_note), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when p_decision = 'retrain' then 'Retraining required; record moved to the new version' else 'Record carried over to the new version' end, a, l,
                      jsonb_build_object('record_status', v_status, 'standard_id', cur.id));
end $$;

-- ───────────── M03 · sweep fix: a past medical due date with no new date is overdue whatever the last flag said
create or replace function kafaa_detect_licensing_events() returns jsonb language plpgsql security definer set search_path = public as $$
declare v_role text := kafaa_acting_role('licence', array['W']); n_lapse integer := 0; n_med integer := 0; r record; a kafaa_audit_events;
begin
  if v_role is null then return kafaa_refuse('licence.sweep', 'licences', null, 'forbidden', 'Only the licensing coordinator may run the sweep'); end if;
  for r in select * from kafaa_licences where status = 'valid' and expires_on < current_date loop
    perform kafaa_set_licence_status(r.id, 'lapsed', 'Detected by sweep: expiry date passed');
    n_lapse := n_lapse + 1;
  end loop;
  for r in select m.* from kafaa_medical_due m where m.due_on < current_date
           and not exists (select 1 from kafaa_licensing_tasks t where t.person_id = m.person_id and t.kind = 'medical_overdue' and t.status = 'open') loop
    insert into kafaa_licensing_tasks (id, kind, person_id, due_at, title_en, title_ar, rule_ref)
    values ('lt-' || replace(gen_random_uuid()::text, '-', ''), 'medical_overdue', r.person_id, kafaa_add_working_days(current_date, 5), 'Medical overdue: confirm new date', 'فحص طبي متأخر: تأكيد موعد جديد', 'FANR-REG-17 Art. 10');
    n_med := n_med + 1;
  end loop;
  a := kafaa_audit('licence.sweep', 'licences', null, 'ok', format('%s lapses, %s medical tasks', n_lapse, n_med), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Sweep complete', a, null, jsonb_build_object('lapses', n_lapse, 'medical', n_med));
end $$;

-- ───────────── M03 · alerts: renewal (12 months), proficiency risk (Art. 11), 75-day exam-notice reminder (Art. 7), withdrawal escalation, medical-due notices
create or replace function kafaa_g1_task(p_id text, p_kind text, p_person text, p_due date, p_en text, p_ar text, p_rule text)
returns boolean language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  insert into kafaa_licensing_tasks (id, kind, person_id, due_at, title_en, title_ar, rule_ref) values (p_id, p_kind, p_person, p_due, p_en, p_ar, p_rule) on conflict (id) do nothing;
  get diagnostics n = row_count;
  return n > 0;
end $$;

create or replace function kafaa_licensing_alerts() returns jsonb language plpgsql security definer set search_path = public as $$
declare v_role text := kafaa_acting_role('licence', array['W']); r record; sp kafaa_shift_proficiency; a kafaa_audit_events;
  v_q text := extract(year from current_date)::int || '-Q' || extract(quarter from current_date)::int;
  v_qend date := (date_trunc('quarter', current_date) + interval '3 months - 1 day')::date;
  v_min date := kafaa_add_working_days(current_date, 5); v_due date; v_wd date; v_sro boolean; v_risk boolean; v_srorisk boolean;
  n_ren integer := 0; n_pr integer := 0; n_xn integer := 0; n_wd integer := 0; n_md integer := 0;
begin
  if v_role is null then return kafaa_refuse('licence.alerts', 'licensing_tasks', null, 'forbidden', 'Only the licensing coordinator may raise licensing alerts'); end if;
  for r in select * from kafaa_licences loop
    if r.status = 'valid' and r.expires_on >= current_date and r.expires_on <= (current_date + interval '12 months')::date
       and not exists (select 1 from kafaa_licensing_tasks t where t.person_id = r.person_id and t.kind = 'renewal' and t.status = 'open') then
      v_due := greatest(r.expires_on - 90, v_min);
      if kafaa_g1_task(format('lt-rn-%s-%s', r.id, r.expires_on), 'renewal', r.person_id, v_due, format('Certificate renewal: start renewal tasks (expires %s)', r.expires_on),
                       format('تجديد الشهادة: بدء مهام التجديد (تنتهي %s)', r.expires_on), 'FANR-REG-17 Art. 8') then n_ren := n_ren + 1; end if;
    end if;
    if r.status = 'valid' then
      sp := null;
      select * into sp from kafaa_shift_proficiency s where s.person_id = r.person_id and s.quarter = v_q limit 1;
      if sp.id is not null then
        v_sro := r.type <> 'RO';
        v_risk := not (sp.shifts_8h >= 7 or sp.shifts_12h >= 5) and not (sp.shifts_8h + sp.scheduled_remaining_8h >= 7 or sp.shifts_12h + sp.scheduled_remaining_12h >= 5);
        v_srorisk := v_sro and sp.sro_role_shifts < 2 and sp.sro_role_shifts + sp.scheduled_remaining_sro < 2;
        if (v_risk or v_srorisk) and not exists (select 1 from kafaa_licensing_tasks t where t.person_id = r.person_id and t.kind = 'proficiency_risk' and t.status = 'open') then
          if kafaa_g1_task(format('lt-pr-%s-%s', r.person_id, v_q), 'proficiency_risk', r.person_id, v_qend,
                           case when v_srorisk then 'SRO-role shift minimum at risk this quarter' else 'Quarterly shift minimum at risk' end,
                           case when v_srorisk then 'الحد الأدنى لنوبات دور المشغّل الأول معرّض للخطر هذا الربع' else 'الحد الأدنى للنوبات ربع السنوية معرّض للخطر' end, 'FANR-REG-17 Art. 11') then
            n_pr := n_pr + 1;
            perform kafaa_g1_notify(format('nt-pr-%s-%s', r.person_id, v_q), r.person_id, 'licence',
              case when v_srorisk then v_q || ': SRO-role shift minimum at risk' else v_q || ': quarterly shift minimum at risk' end,
              case when v_srorisk then v_q || ': الحد الأدنى لنوبات دور المشغّل الأول معرّض للخطر' else v_q || ': الحد الأدنى للنوبات معرّض للخطر' end, '/my/licence', 'warn');
          end if;
        end if;
      end if;
    end if;
    if r.status = 'lapsed' and r.lapsed_on is not null then
      v_wd := (r.lapsed_on + interval '2 years')::date;
      if kafaa_g1_task(format('lt-wd-%s-%s', r.id, r.lapsed_on), 'withdrawal_risk', r.person_id, (r.lapsed_on + interval '12 months')::date,
                       format('Validity lapsed on %s: FANR withdraws the certificate on %s unless validity is restored', r.lapsed_on, v_wd),
                       format('انقضت الصلاحية في %s: تسحب الهيئة الشهادة في %s ما لم تُستعَد الصلاحية', r.lapsed_on, v_wd), 'FANR-REG-17 (withdrawal after 2 years of non-validity)') then
        n_wd := n_wd + 1;
        perform kafaa_g1_notify(format('nt-wd-%s-%s', r.id, r.lapsed_on), r.person_id, 'licence', format('Your certificate validity lapsed on %s; the licensing coordinator will contact you', r.lapsed_on),
                                format('انقضت صلاحية شهادتك في %s؛ سيتواصل معك منسّق الترخيص', r.lapsed_on), '/my/licence', 'bad');
      end if;
    end if;
  end loop;
  for r in select m.*, p.name_en, p.name_ar from kafaa_exam_milestones m left join kafaa_licence_programmes p on p.id = m.programme_id
            where m.kind = 'fanr_written' and m.status = 'planned' and current_date >= m.due_on - 75 and current_date < m.due_on loop
    if kafaa_g1_task(format('lt-xn-%s', r.id), 'exam_notice', null, r.due_on - 60, format('Send the 60-day FANR exam notice for %s (exam %s)', coalesce(r.name_en, r.programme_id, 'programme'), r.due_on),
                     format('إرسال إخطار الهيئة قبل 60 يوماً لـ%s (الاختبار %s)', coalesce(r.name_ar, r.name_en, r.programme_id, ''), r.due_on), 'FANR-REG-17 Art. 7') then n_xn := n_xn + 1; end if;
  end loop;
  for r in select * from kafaa_medical_due m where m.due_on >= current_date and m.due_on <= current_date + 30 loop
    if kafaa_g1_notify(format('nt-md-%s-%s', r.person_id, r.due_on), r.person_id, 'licence', format('Annual medical due by %s', r.due_on), format('الفحص الطبي السنوي مستحق بحلول %s', r.due_on), '/my/licence', 'info') then n_md := n_md + 1; end if;
  end loop;
  a := kafaa_audit('licence.alerts', 'licensing_tasks', null, 'ok', format('%s renewal, %s proficiency, %s exam notice, %s withdrawal, %s medical notices', n_ren, n_pr, n_xn, n_wd, n_md), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', format('%s tasks raised', n_ren + n_pr + n_xn + n_wd), a, null,
                      jsonb_build_object('renewal', n_ren, 'proficiency', n_pr, 'exam_notice', n_xn, 'withdrawal', n_wd, 'medical_notices', n_md));
end $$;

-- ───────────── M03 · close a coordinator task (the named role sent it through official channels)
create or replace function kafaa_close_licensing_task(p_task_id text, p_note text) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_role text := kafaa_acting_role('licence', array['W']); t kafaa_licensing_tasks; a kafaa_audit_events; l integer;
begin
  if v_role is null then return kafaa_refuse('licence.task_close', 'licensing_tasks', p_task_id, 'forbidden', 'Only the licensing coordinator may close licensing tasks'); end if;
  select * into t from kafaa_licensing_tasks where id = p_task_id;
  if t.id is null then return kafaa_refuse('licence.task_close', 'licensing_tasks', p_task_id, 'not_found', 'Task not found', v_role); end if;
  if t.status <> 'open' then return kafaa_refuse('licence.task_close', 'licensing_tasks', p_task_id, 'invalid', 'Task is already closed', v_role); end if;
  if length(trim(coalesce(p_note, ''))) < 5 then return kafaa_refuse('licence.task_close', 'licensing_tasks', p_task_id, 'invalid', 'Record what was done (at least 5 characters)', v_role); end if;
  update kafaa_licensing_tasks set status = 'done' where id = t.id;
  l := kafaa_ledger('kafaa.licence.task_close', format('%s task %s closed: %s', t.kind, t.id, p_note));
  a := kafaa_audit('licence.task_close', 'licensing_tasks', t.id, 'ok', format('%s: %s', t.kind, p_note), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Task closed', a, l);
end $$;

-- ───────────── M03 · mirror a new medical due date and fitness flag (no medical content); closes open medical tasks
create or replace function kafaa_record_medical_date(p_person_id text, p_due_on date, p_flag text, p_source_ref text) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_role text := kafaa_acting_role('licence', array['W']); n integer; a kafaa_audit_events;
begin
  if v_role is null or not kafaa_has_grant('medical_flag', array['Scope']) then return kafaa_refuse('licence.medical_date', 'medical_due', p_person_id, 'forbidden', 'Only the licensing coordinator may mirror a medical due date'); end if;
  if not exists (select 1 from kafaa_people where id = p_person_id) then return kafaa_refuse('licence.medical_date', 'medical_due', p_person_id, 'not_found', 'Person not found', v_role); end if;
  if p_due_on is null or p_due_on < current_date then return kafaa_refuse('licence.medical_date', 'medical_due', p_person_id, 'invalid', 'The new due date must be today or later', v_role); end if;
  if p_flag not in ('fit', 'not_confirmed') then return kafaa_refuse('licence.medical_date', 'medical_due', p_person_id, 'invalid', 'Flag must be fit or not_confirmed', v_role); end if;
  if length(trim(coalesce(p_source_ref, ''))) < 3 then return kafaa_refuse('licence.medical_date', 'medical_due', p_person_id, 'invalid', 'A source record reference is required', v_role); end if;
  insert into kafaa_medical_due (id, person_id, due_on, flag, last_synced) values ('med-' || p_person_id, p_person_id, p_due_on, p_flag, now())
  on conflict (person_id) do update set due_on = excluded.due_on, flag = excluded.flag, last_synced = now();
  update kafaa_licensing_tasks set status = 'done' where person_id = p_person_id and kind = 'medical_overdue' and status = 'open';
  get diagnostics n = row_count;
  a := kafaa_audit('licence.medical_date', 'medical_due', p_person_id, 'ok', format('due date and flag mirrored from %s; %s task(s) closed', p_source_ref, n), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Medical due date recorded', a, null, jsonb_build_object('closed', n));
end $$;

-- ───────────── M03 · crew availability for shift supervisors: available / not available only (null when the sync is stale)
create or replace function kafaa_crew_availability() returns table (person_id text, available boolean) language plpgsql stable security definer set search_path = public as $$
begin
  if not kafaa_has_grant('licence', array['Scope','R','W','Own']) then raise exception 'Kafa''a · crew availability is restricted' using errcode = '42501'; end if;
  return query
    select l.person_id,
           case when now() - l.last_synced > interval '72 hours' then null
                else (l.status = 'valid' and l.expires_on >= current_date and coalesce((select m.due_on >= current_date from kafaa_medical_due m where m.person_id = l.person_id), false)) end
      from kafaa_licences l
     where kafaa_rule_read('licence', l.person_id, null::text, true);
end $$;

revoke execute on function kafaa_g1_notify(text, text, text, text, text, text, text), kafaa_g1_task(text, text, text, date, text, text, text) from public, anon, authenticated;
revoke execute on function kafaa_ack_evaluation(text, text), kafaa_qual_expiry_sweep(), kafaa_review_qual_record(text, text, text), kafaa_licensing_alerts(),
  kafaa_close_licensing_task(text, text), kafaa_record_medical_date(text, date, text, text), kafaa_crew_availability(), kafaa_detect_licensing_events() from public, anon;
grant execute on function kafaa_ack_evaluation(text, text), kafaa_qual_expiry_sweep(), kafaa_review_qual_record(text, text, text), kafaa_licensing_alerts(),
  kafaa_close_licensing_task(text, text), kafaa_record_medical_date(text, date, text, text), kafaa_crew_availability(), kafaa_detect_licensing_events() to authenticated;
