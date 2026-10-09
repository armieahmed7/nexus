-- [W5 QA · integration] Cross-feature wiring of wave 5 on master. Additive and idempotent: replaces one kafaa_* function body;
-- never alters NEXUS objects and never removes any object or row.
--   1. F38 -> F36: the personal digest's "approvals I owe" also lists OJT practice entries waiting for my acknowledgement as the
--      named preceptor (logged by the digest day) and OJT evaluation requests addressed to me as evaluator (made by the digest day).
--      Both link to the logbook tab (/my/ojt?tab=acknowledge | evaluate). TS mirror: src/shell/digest/rules.ts gatherDigest
--      (SQL = TS for every seeded person in scripts/validate/w5e5-digest-dalil.mjs and w5qa-integration.mjs).

create or replace function kafaa_dg_gather(p_me text, p_today date, p_hints jsonb) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  pe kafaa_people; out jsonb := '[]'::jsonb; r record; v_until date := p_today + 90; v_days integer; v_lv jsonb; v_tgt text; v_w jsonb; v_score double precision;
  v_short text[]; v_last date; v_due date; v_state text; v_n integer; v_hint jsonb := p_hints->'coach';
begin
  select * into pe from kafaa_people where id = p_me;
  if pe.id is null then return out; end if;
  -- expiry: qualifications (current status, non-restricted standard, not a security mirror) within 90 days
  for r in select q.id, q.expires_on, s.code, s.title_en, s.title_ar from kafaa_qual_records q join kafaa_qual_standards s on s.id = q.standard_id
           where q.person_id = p_me and not coalesce(s.security_restricted, false) and not coalesce(q.security_mirror_only, false)
             and q.status in ('qualified', 'due', 'renewed') and q.expires_on is not null and q.expires_on >= p_today and q.expires_on <= v_until loop
    v_days := r.expires_on - p_today;
    out := out || kafaa_dg_item('expiry:qual_records:' || r.id, 'expiry', 'qual_records', r.id, r.code || ' · ' || r.title_en, r.code || ' · ' || r.title_ar, '/my/quals',
      jsonb_build_array(jsonb_build_object('code', 'expiry_qual', 'vars', jsonb_build_object('days', v_days, 'date', to_char(r.expires_on, 'YYYY-MM-DD'))), jsonb_build_object('code', 'expiry_notice')),
      null, null, r.expires_on, v_days);
  end loop;
  -- expiry: mirrored licences
  for r in select l.id, l.type, l.expires_on from kafaa_licences l where l.person_id = p_me and l.status = 'valid' and l.expires_on is not null and l.expires_on >= p_today and l.expires_on <= v_until loop
    v_days := r.expires_on - p_today;
    out := out || kafaa_dg_item('expiry:licences:' || r.id, 'expiry', 'licences', r.id, r.type || ' operator certificate (licensee mirror)', 'شهادة ' || r.type || ' (نسخة مطابقة لسجلات المرخَّص له)', '/my/licence',
      jsonb_build_array(jsonb_build_object('code', 'expiry_licence', 'vars', jsonb_build_object('days', v_days, 'date', to_char(r.expires_on, 'YYYY-MM-DD'))), jsonb_build_object('code', 'mirror')),
      null, null, r.expires_on, v_days);
  end loop;
  -- approvals: skill ratings asked of me (one per open check-in; the manager request first)
  for r in select distinct on (c.id collate "C") c.id, c.person_id, c.due_on, rt.rater_kind, p.id as pid, p.display_name, p.display_name_ar
           from kafaa_skill_ratings rt join kafaa_skill_checkins c on c.id = rt.checkin_id and c.status = 'open'
           left join kafaa_people p on p.id = c.person_id
           where rt.rater_person_id = p_me and rt.status = 'pending' and rt.rater_kind in ('manager', 'peer') and c.person_id <> p_me
           order by c.id collate "C", rt.rater_kind collate "C" loop
    out := out || kafaa_dg_item('approval:skill_checkins:' || r.id, 'approval', 'skill_checkins', r.id,
      'Skill check-in: ' || case when r.pid is null then 'A colleague' else r.display_name end, 'تقييم مهارات: ' || case when r.pid is null then 'زميل' else coalesce(nullif(r.display_name_ar, ''), r.display_name) end,
      case when r.rater_kind = 'manager' then '/team/skills/validate' else '/my/skills/checkins' end,
      jsonb_build_array(jsonb_build_object('code', case when r.rater_kind = 'manager' then 'approval_rating_manager' else 'approval_rating_peer' end,
        'vars', case when r.due_on is null then '{}'::jsonb else jsonb_build_object('date', to_char(r.due_on, 'YYYY-MM-DD')) end)),
      case when r.pid is null then 'A colleague' else r.display_name end, case when r.pid is null then 'زميل' else coalesce(nullif(r.display_name_ar, ''), r.display_name) end,
      r.due_on, case when r.due_on is null then null else r.due_on - p_today end);
  end loop;
  -- approvals: mentoring requests addressed to me
  for r in select m.id, m.created_at, p.id as pid, p.display_name, p.display_name_ar from kafaa_mentoring_requests m left join kafaa_people p on p.id = m.person_id
           where m.mentor_person_id = p_me and m.status = 'requested' and m.person_id <> p_me loop
    out := out || kafaa_dg_item('approval:mentoring_requests:' || r.id, 'approval', 'mentoring_requests', r.id,
      'Mentoring request from ' || case when r.pid is null then 'A colleague' else r.display_name end, 'طلب إرشاد من ' || case when r.pid is null then 'زميل' else coalesce(nullif(r.display_name_ar, ''), r.display_name) end,
      '/my/mentoring', jsonb_build_array(jsonb_build_object('code', 'approval_mentoring', 'vars', jsonb_build_object('date', to_char(r.created_at at time zone 'UTC', 'YYYY-MM-DD')))),
      case when r.pid is null then 'A colleague' else r.display_name end, case when r.pid is null then 'زميل' else coalesce(nullif(r.display_name_ar, ''), r.display_name) end);
  end loop;
  -- approvals: mentoring agreements proposed to me
  for r in select a.id, p.id as pid, p.display_name, p.display_name_ar from kafaa_mentoring_agreements a
           left join kafaa_people p on p.id = case when a.person_id = p_me then a.mentor_person_id else a.person_id end
           where a.status = 'proposed' and (a.person_id = p_me or a.mentor_person_id = p_me) and a.proposed_by is distinct from p_me loop
    out := out || kafaa_dg_item('approval:mentoring_agreements:' || r.id, 'approval', 'mentoring_agreements', r.id,
      'Mentoring agreement with ' || case when r.pid is null then 'A colleague' else r.display_name end, 'اتفاقية إرشاد مع ' || case when r.pid is null then 'زميل' else coalesce(nullif(r.display_name_ar, ''), r.display_name) end,
      '/my/mentoring/' || r.id, jsonb_build_array(jsonb_build_object('code', 'approval_agreement')),
      case when r.pid is null then 'A colleague' else r.display_name end, case when r.pid is null then 'زميل' else coalesce(nullif(r.display_name_ar, ''), r.display_name) end);
  end loop;
  -- approvals: opportunity releases waiting for me
  for r in select a.id, a.opportunity_id, a.created_at, a.applicant_name, a.applicant_name_ar, o.id as oid, o.title_en, o.title_ar, p.id as pid, p.display_name, p.display_name_ar
           from kafaa_opportunity_applications a left join kafaa_opportunities o on o.id = a.opportunity_id left join kafaa_people p on p.id = a.person_id
           where a.releaser_id = p_me and a.status = 'applied' and a.person_id <> p_me loop
    out := out || kafaa_dg_item('approval:opportunity_applications:' || r.id, 'approval', 'opportunity_applications', r.id,
      'Release decision: ' || coalesce(r.title_en, r.opportunity_id), 'قرار الإفراج: ' || coalesce(nullif(r.title_ar, ''), nullif(r.title_en, ''), r.opportunity_id), '/opportunities/manage',
      jsonb_build_array(jsonb_build_object('code', 'approval_release', 'vars', jsonb_build_object('date', to_char(r.created_at at time zone 'UTC', 'YYYY-MM-DD')))),
      coalesce(nullif(r.applicant_name, ''), case when r.pid is null then 'A colleague' else r.display_name end),
      coalesce(nullif(r.applicant_name_ar, ''), nullif(r.applicant_name, ''), case when r.pid is null then 'زميل' else coalesce(nullif(r.display_name_ar, ''), r.display_name) end));
  end loop;
  -- approvals: my career-conversation record to acknowledge
  for r in select c.id, c.held_on from kafaa_career_conversations c where c.person_id = p_me and c.status = 'held' loop
    out := out || kafaa_dg_item('approval:career_conversations:' || r.id, 'approval', 'career_conversations', r.id, 'Acknowledge your career conversation record', 'أكّد سجل حوارك المهني',
      '/my/career/conversations', jsonb_build_array(jsonb_build_object('code', 'approval_ack', 'vars', case when r.held_on is null then '{}'::jsonb else jsonb_build_object('date', to_char(r.held_on, 'YYYY-MM-DD')) end)));
  end loop;
  -- approvals (W5 integration, F38): practice entries naming me as preceptor, logged by today and waiting for my acknowledgement
  for r in select l.id, l.on_date, p.id as pid, p.display_name, p.display_name_ar from kafaa_ojt_logs l left join kafaa_people p on p.id = l.person_id
           where l.preceptor_person_id = p_me and l.status = 'pending_ack' and l.person_id <> p_me and l.on_date <= p_today loop
    out := out || kafaa_dg_item('approval:ojt_logs:' || r.id, 'approval', 'ojt_logs', r.id,
      'OJT practice to acknowledge: ' || case when r.pid is null then 'A colleague' else r.display_name end, 'تدريب عملي بانتظار إقرارك: ' || case when r.pid is null then 'زميل' else coalesce(nullif(r.display_name_ar, ''), r.display_name) end,
      '/my/ojt?tab=acknowledge', jsonb_build_array(jsonb_build_object('code', 'approval_ojt_ack', 'vars', jsonb_build_object('date', to_char(r.on_date, 'YYYY-MM-DD')))),
      case when r.pid is null then 'A colleague' else r.display_name end, case when r.pid is null then 'زميل' else coalesce(nullif(r.display_name_ar, ''), r.display_name) end);
  end loop;
  -- approvals (W5 integration, F38): OJT evaluation requests addressed to me as evaluator, made by today
  for r in select q.id, q.requested_at, p.id as pid, p.display_name, p.display_name_ar from kafaa_ojt_eval_requests q left join kafaa_people p on p.id = q.person_id
           where q.evaluator_person_id = p_me and q.status = 'requested' and q.person_id <> p_me and (q.requested_at at time zone 'UTC')::date <= p_today loop
    out := out || kafaa_dg_item('approval:ojt_eval_requests:' || r.id, 'approval', 'ojt_eval_requests', r.id,
      'OJT evaluation requested: ' || case when r.pid is null then 'A colleague' else r.display_name end, 'طلب تقييم تدريب عملي: ' || case when r.pid is null then 'زميل' else coalesce(nullif(r.display_name_ar, ''), r.display_name) end,
      '/my/ojt?tab=evaluate', jsonb_build_array(jsonb_build_object('code', 'approval_ojt_eval', 'vars', jsonb_build_object('date', to_char(r.requested_at at time zone 'UTC', 'YYYY-MM-DD')))),
      case when r.pid is null then 'A colleague' else r.display_name end, case when r.pid is null then 'زميل' else coalesce(nullif(r.display_name_ar, ''), r.display_name) end);
  end loop;
  -- coach: the F07 top card (hint) unless I opted out of coach ranking, else my soonest mandatory training due within 60 days
  if v_hint is not null and jsonb_typeof(v_hint) = 'object' and kafaa_dg_hint_ok(v_hint)
     and not exists (select 1 from kafaa_reco_optouts o where o.person_id = p_me and o.surface = 'coach' and o.opted_out) then
    out := out || kafaa_dg_item('coach:coach:' || (v_hint->>'id'), 'coach', 'coach', v_hint->>'id', v_hint->>'title_en', v_hint->>'title_ar', v_hint->>'link',
      jsonb_build_array(jsonb_build_object('code', 'coach_top')) || coalesce((select jsonb_agg(jsonb_build_object('code', x->>'code', 'key', x->>'key', 'vars', coalesce(nullif(x->'vars', 'null'::jsonb), '{}'::jsonb)) order by i)
        from jsonb_array_elements(v_hint->'reasons') with ordinality e(x, i) where i <= 5), '[]'::jsonb));
  else
    select e.id, e.due_on, c.id as cid, c.code, c.title_en, c.title_ar into r from kafaa_enrolments e join kafaa_courses c on c.id = e.course_id
     where e.person_id = p_me and e.status in ('assigned', 'requested', 'approved', 'waitlisted', 'enrolled', 'in_progress') and e.due_on is not null and e.due_on >= p_today and e.due_on <= p_today + 60
     order by e.due_on, e.id collate "C" limit 1;
    if found then
      out := out || kafaa_dg_item('coach:enrolments:' || r.id, 'coach', 'enrolments', r.id, r.code || ' · ' || r.title_en, r.code || ' · ' || r.title_ar, '/learn/course/' || r.cid,
        jsonb_build_array(jsonb_build_object('code', 'coach_due', 'vars', jsonb_build_object('days', r.due_on - p_today, 'date', to_char(r.due_on, 'YYYY-MM-DD')))), null, null, r.due_on, r.due_on - p_today);
    end if;
  end if;
  -- opportunity: new (21 days), open, listed, seats left, eligible, not mine, not applied, match >= 0.7; none when I opted out of marketplace ranking
  if not exists (select 1 from kafaa_reco_optouts o where o.person_id = p_me and o.surface = 'marketplace' and o.opted_out) then
    select coalesce(jsonb_object_agg(x.skill_id, x.lv), '{}'::jsonb) into v_lv from (select ps.skill_id, max(ps.level) lv from kafaa_person_skills ps where ps.person_id = p_me and ps.active is not false and ps.level > 0 group by ps.skill_id) x;
    v_short := array(select t.role_id from kafaa_career_targets t where t.person_id = p_me and t.active is not false order by t.rank, t.id collate "C");
    v_tgt := (select x from unnest(v_short) with ordinality u(x, i) where x is not null and x <> '' and x is distinct from pe.job_role_id order by i limit 1);
    if v_tgt is null and pe.job_role_id is not null then
      v_tgt := coalesce((select cp.to_role_id from kafaa_career_paths cp where cp.from_role_id = pe.job_role_id and cp.type = 'vertical' order by coalesce(cp.sort, 0), cp.id collate "C" limit 1),
                        (select cp.to_role_id from kafaa_career_paths cp where cp.from_role_id = pe.job_role_id order by coalesce(cp.sort, 0), cp.id collate "C" limit 1));
    end if;
    v_w := coalesce((select es.weights from kafaa_engine_settings es where es.id = 'match'), '{}'::jsonb);
    for r in select o.* from kafaa_opportunities o
             where o.status = 'open' and o.listed is not false and o.posted_by is distinct from p_me
               and (o.created_at at time zone 'UTC')::date >= p_today - 21 and (o.created_at at time zone 'UTC')::date <= p_today
               and (o.seats is null or coalesce(o.seats_taken, 0) < o.seats)
               and (coalesce(cardinality(o.eligible_families), 0) = 0 or (pe.job_family_id is not null and pe.job_family_id = any(o.eligible_families)))
               and not exists (select 1 from kafaa_opportunity_applications a where a.person_id = p_me and a.opportunity_id = o.id
                                and a.status in ('applied', 'released', 'selected', 'completed', 'declined_release', 'not_selected')) loop
      v_score := kafaa_dg_match(r.skills_needed, r.skills_gained, v_lv, pe.job_role_id, v_tgt, v_w);
      if v_score >= 0.7 then
        out := out || kafaa_dg_item('opportunity:opportunities:' || r.id, 'opportunity', 'opportunities', r.id, r.title_en, coalesce(nullif(r.title_ar, ''), r.title_en), '/opportunities/' || r.id,
          jsonb_build_array(jsonb_build_object('code', 'opp_match', 'vars', jsonb_build_object('pct', floor(v_score * 100 + 0.5)::int)),
                            jsonb_build_object('code', 'opp_new', 'vars', jsonb_build_object('date', to_char(r.created_at at time zone 'UTC', 'YYYY-MM-DD')))),
          null, null, null, null, v_score);
      end if;
    end loop;
  end if;
  -- mentoring: the soonest next session (cadence after the last one, else after the start) within 7 days
  select x.id, x.nxt, x.cadence, p.id as pid, p.display_name, p.display_name_ar into r from (
    select a.id, a.cadence, case when a.person_id = p_me then a.mentor_person_id else a.person_id end as other,
           coalesce((select max(s.held_on) from kafaa_mentoring_sessions s where s.agreement_id = a.id), a.starts_on)
             + case a.cadence when 'weekly' then 7 when 'fortnightly' then 14 when 'monthly' then 30 else 30 end as nxt
      from kafaa_mentoring_agreements a where a.status = 'active' and (a.person_id = p_me or a.mentor_person_id = p_me)) x
    left join kafaa_people p on p.id = x.other
   where x.nxt <= p_today + 7 order by x.nxt, x.id collate "C" limit 1;
  if found then
    out := out || kafaa_dg_item('mentoring:mentoring_agreements:' || r.id, 'mentoring', 'mentoring_agreements', r.id,
      'Mentoring session with ' || case when r.pid is null then 'A colleague' else r.display_name end, 'جلسة إرشاد مع ' || case when r.pid is null then 'زميل' else coalesce(nullif(r.display_name_ar, ''), r.display_name) end,
      '/my/mentoring/' || r.id,
      jsonb_build_array(jsonb_build_object('code', case when r.nxt < p_today then 'mentoring_overdue' else 'mentoring_due' end, 'vars', jsonb_build_object('date', to_char(r.nxt, 'YYYY-MM-DD'))),
                        jsonb_build_object('code', 'cadence_' || r.cadence)),
      case when r.pid is null then 'A colleague' else r.display_name end, case when r.pid is null then 'زميل' else coalesce(nullif(r.display_name_ar, ''), r.display_name) end,
      r.nxt, r.nxt - p_today);
  end if;
  -- conversation: my six-monthly career conversation, due within 30 days or overdue (staff only)
  if pe.kind = 'staff' and pe.status = 'active' then
    v_last := (select max(c.held_on) from kafaa_career_conversations c where c.person_id = p_me and c.status in ('held', 'acknowledged') and c.held_on is not null);
    v_due := (coalesce(v_last, pe.hire_date) + interval '6 months')::date;
    if v_due is not null then
      v_state := case when v_due < p_today then 'overdue' when v_due - p_today <= 30 then 'due_soon' else 'ok' end;
      if v_state <> 'ok' then
        out := out || kafaa_dg_item('conversation:career_conversations:' || p_me, 'conversation', 'career_conversations', p_me, 'Your six-monthly career conversation', 'حوارك المهني نصف السنوي',
          '/my/career/conversations', jsonb_build_array(jsonb_build_object('code', case when v_state = 'overdue' then 'conversation_overdue' else 'conversation_due' end, 'vars', jsonb_build_object('date', to_char(v_due, 'YYYY-MM-DD')))),
          null, null, v_due, v_due - p_today);
      end if;
    end if;
  end if;
  -- refresher: questions due today or earlier, unless paused
  if not exists (select 1 from kafaa_refresh_prefs rp where rp.person_id = p_me and rp.cadence = 'paused') then
    v_n := (select count(*)::int from kafaa_refresh_state rs where rs.person_id = p_me and rs.due_on <= p_today);
    if v_n > 0 then
      out := out || kafaa_dg_item('refresher:refresh_state:' || p_me, 'refresher', 'refresh_state', p_me, v_n || ' refresher ' || case when v_n = 1 then 'question' else 'questions' end || ' due',
        'أسئلة تنشيط مستحقة: ' || v_n, '/my/coach/refresh', jsonb_build_array(jsonb_build_object('code', 'refresher_due', 'vars', jsonb_build_object('n', v_n))), null, null, p_today, 0);
    end if;
  end if;
  return out;
end $$;

revoke execute on function kafaa_dg_gather(text, date, jsonb) from public, anon, authenticated;
