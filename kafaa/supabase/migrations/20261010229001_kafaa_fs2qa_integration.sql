-- [FS QA · wave B integration] Cross-feature wiring of FS07-FS16 on master. Additive and idempotent: four create-or-replace of
-- existing kafaa_* functions with unchanged signatures and grants, plus guarded data statements on kafaa_* rows (each only
-- changes a row that still holds the value the engineers loaded live, so a second run, or a run on the final seed, changes
-- nothing). No DDL on tables, nothing dropped or deleted; never touches a NEXUS object or row.
-- Proof: scripts/validate/fsqa2-integration.mjs (PGlite: SQL = TS, forward proof, idempotence). Tests: tests/unit/fsqa2-integration.test.tsx.
--   1. FS10 -> F35: FS02 future-skill states (fs_area set) are not F35 supply. The fitness check evidences FS02 AI skills at
--      level <= 2 for 100 staff, which made 99 of them "digital" holders and turned the stress-test digital shortfall into a
--      surplus. kafaa_so_base counts the established catalogue only, for holders as it already did for the ADVANCE share
--      (TS mirror: src/modules/m07/outlook.ts). The stored outlooks equal the released ones again.
--   2. FS15 -> F36/F37: a shortlisted concept role (the target of an FS05 "future" edge) is never the digest's target role
--      (kafaa_dg_gather; TS defaultTargetRole, also used by Dalil career mode).
--   3. FS15 -> F12: a shortlisted concept role in a career-conversation agenda reads its FS05-profile readiness
--      (kafaa_fs15_concept_readiness_compute, concept band, gate_status 'none', concept: true) instead of F05's 0 %
--      (kafaa_cc_agenda; TS buildAgenda).
--   4. FS10 -> F23: FS02 future-skill states are left out of a reserve member's frozen skill snapshot (kafaa_res_snapshot; TS
--      snapshotFrom), so fitness-check evidence never pushes a departing expert's verified skills out of the top 12.
--   5. FS14 -> F26: the four 2027-Q1 "future" demand snapshots and one session proposal take the FS14 lane interest
--      (rows F26 derives; guarded on the pre-FS14 values).

-- 1. F35 supply: established catalogue only
create or replace function kafaa_so_base(p_scenario text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_base integer := 2026; sc kafaa_scenarios; v_p jsonb; v_head boolean; v_tech text := null; v_sc jsonb := null;
  v_kperiod text; v_cperiod text; v_vperiod text; v_high numeric; v_med numeric; v_fams jsonb := '[]'::jsonb; a text;
  v_ns integer; v_nd integer; v_pool integer; v_klra jsonb; v_cohort jsonb; v_cover jsonb; v_lo boolean; v_m integer; v_t integer;
  v_kv integer[]; pos record; dep jsonb; w integer; i integer; y integer; n integer; v_org integer; v_staff integer;
begin
  if p_scenario is not null then
    select * into sc from kafaa_scenarios where id = p_scenario;
    if sc.id is null then return null; end if;
    v_p := case when jsonb_typeof(sc.params) = 'object' then sc.params else '{}'::jsonb end;
    v_head := sc.kind = 'headcount';
    if sc.kind = 'technology' and jsonb_typeof(v_p->'technology') = 'string' and (v_p->>'technology') <> '' then v_tech := v_p->>'technology'; end if;
    v_sc := jsonb_build_object('id', sc.id, 'name', sc.name, 'kind', sc.kind,
      'units', case when v_head then kafaa_so_num(v_p->'units', 0) else 0 end,
      'start', case when v_head then kafaa_so_num(coalesce(v_p->'startYear', v_p->'start'), 2032) else 2032 end,
      'per_unit', case when v_head then kafaa_so_num(v_p->'perUnit', 48) else 48 end,
      'baseline', case when v_head then kafaa_so_num(v_p->'baseline', 190) else 190 end,
      'tech', v_tech);
  end if;
  select max(period collate "C") into v_kperiod from kafaa_klra_assessments;
  select max(period collate "C") into v_cperiod from kafaa_handover_cohorts;
  select max(period collate "C") into v_vperiod from kafaa_external_cover;
  select coalesce(max(high_threshold) filter (where id = 'default'), 16), coalesce(max(medium_threshold) filter (where id = 'default'), 8) into v_high, v_med from kafaa_klra_settings;
  select count(*)::integer into v_staff from kafaa_people p where p.kind = 'staff' and p.status = 'active';
  select greatest(0, floor(w.value))::integer into v_org from kafaa_workforce_snapshots w
    where w.measure = 'headcount' and w.family_id is null and w.level is null and w.entity_id is null order by w.period collate "C" desc limit 1;

  foreach a in array kafaa_so_families() loop
    select count(distinct ps.person_id)::integer into v_ns from kafaa_person_skills ps join kafaa_skills sk on sk.id = ps.skill_id join kafaa_people st on st.id = ps.person_id and st.kind = 'staff' and st.status = 'active'
      where ps.active is distinct from false and ps.level >= 2 and sk.area = a and sk.fs_area is null;
    select count(distinct ps.person_id)::integer into v_pool from kafaa_person_skills ps join kafaa_skills sk on sk.id = ps.skill_id join kafaa_people st on st.id = ps.person_id and st.kind = 'staff' and st.status = 'active'
      where ps.active is distinct from false and ps.level >= 1 and ps.level < 2 and sk.area = a and sk.fs_area is null
        and not exists (select 1 from kafaa_person_skills h join kafaa_skills hs on hs.id = h.skill_id where h.person_id = ps.person_id and h.active is distinct from false and h.level >= 2 and hs.area = a and hs.fs_area is null);
    select count(*)::integer into v_nd from kafaa_people st where st.kind = 'staff' and st.status = 'active' and st.job_role_id is not null and kafaa_so_role_needs(st.job_role_id, a);
    -- KLRA (F20): band-weighted departures of holders, latest assessment period, positions in id order
    v_kv := array_fill(0, array[20]);
    for pos in select kp.id, kp.contract_kind, kp.retirement_band, kp.contract_end_band, (select ka.total from kafaa_klra_assessments ka where ka.position_id = kp.id and ka.period = v_kperiod order by ka.id collate "C" desc limit 1) as total
        from kafaa_klra_positions kp
        where kp.active is distinct from false and kp.kind = 'staff' and kp.person_id is not null
          and exists (select 1 from kafaa_klra_assessments ka where ka.position_id = kp.id and ka.period = v_kperiod)
          and exists (select 1 from kafaa_person_skills h join kafaa_skills hs on hs.id = h.skill_id join kafaa_people st on st.id = h.person_id and st.kind = 'staff' and st.status = 'active'
                      where h.person_id = kp.person_id and h.active is distinct from false and h.level >= 2 and hs.area = a and hs.fs_area is null)
        order by kp.id collate "C" loop
      w := case when pos.total >= v_high then 10 when pos.total >= v_med then 7 else 4 end;
      dep := kafaa_so_departures(pos.contract_kind, pos.retirement_band, pos.contract_end_band, v_base);
      for i in 0 .. jsonb_array_length(dep) - 1 loop
        y := (dep->i->>0)::integer;
        v_kv[y - v_base] := v_kv[y - v_base] + w * (dep->i->>1)::integer;
      end loop;
    end loop;
    v_klra := '{}'::jsonb;
    for i in 1 .. 19 loop if v_kv[i] > 0 then v_klra := v_klra || jsonb_build_object((v_base + i)::text, v_kv[i]); end if; end loop;
    -- F22 cohorts for roles that need the family (latest plan period), at their ready year (never before base + 1)
    select coalesce(jsonb_object_agg(z.y::text, z.n), '{}'::jsonb) into v_cohort from (
      select greatest(v_base + 1, extract(year from c.ready_on)::integer) as y, sum(c.trainees)::integer as n
      from kafaa_handover_cohorts c where c.period = v_cperiod and kafaa_so_role_needs(c.role_id, a)
      group by 1) z;
    -- F22 external cover in roles that need the family, per year (last plan year repeats; the OSSA cut-off applies in the projection)
    v_cover := '{}'::jsonb;
    for y in v_base .. 2036 loop
      select coalesce(sum(c.cover_count), 0)::integer into n from kafaa_external_cover c
        join (select x.role_id, least(y, max(x.year)) as yy from kafaa_external_cover x where x.period = v_vperiod group by x.role_id) m on m.role_id = c.role_id and c.year = m.yy
        where c.period = v_vperiod and kafaa_so_role_needs(c.role_id, a);
      v_cover := v_cover || jsonb_build_object(y::text, n);
    end loop;
    v_lo := kafaa_so_role_needs('local-operator', a);
    select count(*)::integer, count(*) filter (where exists (select 1 from unnest(coalesce(sk.adv_skill_ids, '{}'::text[])) x join kafaa_adv_skills ad on ad.id = x
                                                           where v_tech is null or ad.tech_id = v_tech))::integer
      into v_t, v_m from kafaa_skills sk where sk.area = a and sk.fs_area is null; -- FS02: established catalogue only
    v_fams := v_fams || jsonb_build_array(jsonb_build_object('key', a, 'n_s', v_ns, 'n_d', v_nd, 'pool', v_pool, 'klra60', v_klra, 'cohort', v_cohort,
      'cover', v_cover, 'lo', v_lo, 'adv_m', v_m, 'adv_t', v_t));
  end loop;
  return jsonb_build_object('families', v_fams, 'adv_sum', (select coalesce(sum(value), 0) from kafaa_future_skills), 'adv_n', (select count(*)::integer from kafaa_future_skills),
    'org', coalesce(v_org, 0), 'staff', v_staff, 'scenario', v_sc);
end $$;
revoke execute on function kafaa_so_base(text) from public, anon, authenticated;

-- 2. F36 digest target: never a concept role
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
    v_tgt := (select x from unnest(v_short) with ordinality u(x, i) where x is not null and x <> '' and x is distinct from pe.job_role_id
      and not exists (select 1 from kafaa_career_paths fp where fp.to_role_id = x and fp.kind = 'future') order by i limit 1); -- FS wave B: concept roles are never the target
    if v_tgt is null and pe.job_role_id is not null then
      v_tgt := coalesce((select cp.to_role_id from kafaa_career_paths cp where cp.from_role_id = pe.job_role_id and cp.type = 'vertical' and coalesce(cp.kind, 'current') <> 'future' order by coalesce(cp.sort, 0), cp.id collate "C" limit 1),
                        (select cp.to_role_id from kafaa_career_paths cp where cp.from_role_id = pe.job_role_id and coalesce(cp.kind, 'current') <> 'future' order by coalesce(cp.sort, 0), cp.id collate "C" limit 1));
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

-- 3. F12 agenda: concept targets read FS15 readiness
create or replace function kafaa_cc_agenda(p_person text, p_targets boolean, p_roadmap boolean, p_coach boolean, p_shared_only boolean, p_today date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_role text; v_pass jsonb; v_ids text[]; v_cids text[]; v_rd jsonb; v_tg jsonb := '[]'::jsonb; v_rm jsonb; v_q jsonb; v_c jsonb; v_last jsonb;
begin
  select p.job_role_id into v_role from kafaa_people p where p.id = p_person;
  select coalesce(jsonb_agg(jsonb_build_object('skill_id', z.skill_id, 'level', z.level, 'basis', z.basis) order by z.level desc, z.confidence desc, z.skill_id collate "C"), '[]'::jsonb) into v_pass
  from (select ps.skill_id, ps.level, ps.confidence, ps.basis from kafaa_person_skills ps join kafaa_skills s on s.id = ps.skill_id left join kafaa_competencies cm on cm.id = s.competency_id
        where ps.person_id = p_person and ps.active and ps.level >= 1 and s.area <> 'security' and coalesce(cm.domain, '') <> 'security'
        order by ps.level desc, ps.confidence desc, ps.skill_id collate "C" limit 5) z;
  if p_targets then
    select array_agg(t.role_id order by t.rank, t.id collate "C") into v_ids from kafaa_career_targets t where t.person_id = p_person and t.active and (not p_shared_only or t.shared);
    if v_ids is not null then
      -- FS wave B: shortlisted FS15 concept roles read their FS05-profile readiness (kafaa_fs15_concept_readiness_compute), not 0 %
      v_cids := array(select x from unnest(v_ids) x join kafaa_job_roles jr on jr.id = x where jr.lifecycle = 'concept');
      v_rd := coalesce(kafaa_career_readiness_compute(p_person, array(select x from unnest(v_ids) x where not (x = any(v_cids))), p_today), '[]'::jsonb)
        || case when cardinality(v_cids) > 0 then coalesce(kafaa_fs15_concept_readiness_compute(p_person, v_cids, p_today), '[]'::jsonb) else '[]'::jsonb end;
      select coalesce(jsonb_agg(jsonb_build_object('role_id', t.role_id, 'rank', t.rank, 'pct', y.x -> 'pct', 'band', y.x -> 'band', 'gate_status', coalesce(y.x -> 'gate_status', '"none"'::jsonb), 'months', y.x -> 'months',
          'gaps', coalesce((select jsonb_agg(g order by o) from jsonb_array_elements(y.x -> 'gaps') with ordinality q(g, o) where o <= 3), '[]'::jsonb),
          'reasons', coalesce((select jsonb_agg(r order by o) from jsonb_array_elements(y.x -> 'reasons') with ordinality q(r, o) where o <= 4), '[]'::jsonb))
          || case when y.x ? 'concept' then jsonb_build_object('concept', true) else '{}'::jsonb end
        order by t.rank, t.id collate "C"), '[]'::jsonb) into v_tg
      from kafaa_career_targets t cross join lateral (select e as x from jsonb_array_elements(v_rd) e where e ->> 'role_id' = t.role_id limit 1) y
      where t.person_id = p_person and t.active and (not p_shared_only or t.shared);
    end if;
  end if;
  if p_roadmap then
    select jsonb_build_object('id', m.id, 'name', m.name, 'target_role_id', m.target_role_id, 'earliest_on', m.earliest_on, 'end_on', m.end_on,
      'dev_blocks', (select count(*) from jsonb_array_elements(case when jsonb_typeof(m.plan) = 'array' then m.plan else '[]'::jsonb end) b where b ->> 'lane' = 'development'))
      into v_rm from kafaa_roadmaps m where m.person_id = p_person and m.active and (not p_shared_only or m.shared) order by m.updated_at desc, m.id collate "C" limit 1;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('record_id', z.id, 'standard_id', z.standard_id, 'expires_on', z.expires_on, 'days', z.expires_on - p_today) order by z.expires_on, z.id collate "C"), '[]'::jsonb) into v_q
  from (select q.id, q.standard_id, q.expires_on from kafaa_qual_records q join kafaa_qual_standards s on s.id = q.standard_id
        where q.person_id = p_person and q.status in ('qualified', 'due', 'renewed') and q.expires_on is not null
          and not coalesce(s.security_restricted, false) and not coalesce(q.security_mirror_only, false)
          and q.expires_on - p_today between -90 and 365
        order by q.expires_on, q.id collate "C" limit 5) z;
  if p_coach then
    select jsonb_build_object('hours_per_week', coalesce(g.hours_per_week, 0), 'focus_role_ids', to_jsonb(coalesce(g.focus_role_ids, '{}'::text[])),
      'enrolled', (select count(*) from kafaa_coach_feedback f where f.person_id = p_person and f.signal = 'enrolled' and f.at::date >= p_today - 180),
      'passed', (select count(*) from kafaa_training_records r where r.person_id = p_person and r.result in ('passed', 'completed') and r.completed_on between p_today - 180 and p_today))
      into v_c from (select 1) one left join kafaa_learning_goals g on g.person_id = p_person;
  end if;
  select jsonb_build_object('id', c.id, 'held_on', c.held_on, 'status', c.status) into v_last from kafaa_career_conversations c
  where c.person_id = p_person and c.status in ('held', 'acknowledged') and c.held_on is not null order by c.held_on desc, c.id collate "C" limit 1;
  return jsonb_build_object('built_on', p_today, 'role_id', v_role, 'shared_only', p_shared_only,
    'included', jsonb_build_object('targets', p_targets, 'roadmap', p_roadmap, 'coach', p_coach),
    'passport', v_pass, 'targets', v_tg, 'roadmap', v_rm, 'quals', v_q, 'coach', v_c, 'last', v_last);
end $$;
revoke execute on function kafaa_cc_agenda(text, boolean, boolean, boolean, boolean, date) from public, anon, authenticated;

-- 4. F23 reserve snapshot: established catalogue only
create or replace function kafaa_res_snapshot(p_person text) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('skill_id', x.skill_id, 'level', x.level, 'basis', x.basis) order by x.level desc, x.skill_id collate "C"), '[]'::jsonb)
  from (select ps.skill_id, ps.level, ps.basis from kafaa_person_skills ps join kafaa_skills k on k.id = ps.skill_id
        where ps.person_id = p_person and ps.active is distinct from false and ps.level >= 1 and k.area not in ('security') and k.fs_area is null
        order by ps.level desc, ps.skill_id collate "C" limit 12) x
$$;
revoke execute on function kafaa_res_snapshot(text) from public, anon, authenticated;

-- 5. F26 derived rows after FS14 (guarded on the pre-FS14 values)
select set_config('kafaa.seeding', 'on', true);
update kafaa_demand_snapshots set count = 54, detail = '[{"key":"chemistry-technician","count":3},{"key":"corporate-professional","count":2},{"key":"cyber-security-engineer","count":1},{"key":"emergency-preparedness-coordinator","count":2},{"key":"fire-protection","count":2},{"key":"local-operator","count":8},{"key":"maintenance-technician-engineer","count":7},{"key":"nuclear-training-instructor","count":2},{"key":"operations-support-work-control","count":1},{"key":"procurement-engineer","count":1},{"key":"quality-assurance-qc","count":2},{"key":"radiation-protection-technician","count":4},{"key":"reactor-operator","count":9},{"key":"security-officer","count":2},{"key":"senior-reactor-operator","count":5},{"key":"shift-supervisor","count":2},{"key":"systems-design-plant-engineer","count":1}]'::jsonb where id = 'dm:2027-Q1:c-adv-intro:future' and count = 53 and detail = '[{"key":"chemistry-technician","count":3},{"key":"corporate-professional","count":2},{"key":"cyber-security-engineer","count":1},{"key":"emergency-preparedness-coordinator","count":2},{"key":"fire-protection","count":2},{"key":"local-operator","count":8},{"key":"maintenance-technician-engineer","count":7},{"key":"nuclear-training-instructor","count":2},{"key":"operations-support-work-control","count":1},{"key":"procurement-engineer","count":1},{"key":"quality-assurance-qc","count":2},{"key":"radiation-protection-technician","count":4},{"key":"reactor-operator","count":9},{"key":"security-officer","count":2},{"key":"senior-reactor-operator","count":5},{"key":"shift-supervisor","count":2}]'::jsonb;
update kafaa_demand_snapshots set count = 51, detail = '[{"key":"chemistry-technician","count":3},{"key":"corporate-professional","count":2},{"key":"cyber-security-engineer","count":1},{"key":"emergency-preparedness-coordinator","count":2},{"key":"fire-protection","count":2},{"key":"local-operator","count":10},{"key":"maintenance-technician-engineer","count":7},{"key":"nuclear-training-instructor","count":2},{"key":"operations-support-work-control","count":1},{"key":"procurement-engineer","count":1},{"key":"radiation-protection-technician","count":3},{"key":"reactor-operator","count":9},{"key":"security-officer","count":1},{"key":"senior-reactor-operator","count":5},{"key":"shift-supervisor","count":2}]'::jsonb where id = 'dm:2027-Q1:c-ai-gov:future' and count = 37 and detail = '[{"key":"chemistry-technician","count":3},{"key":"corporate-professional","count":2},{"key":"cyber-security-engineer","count":1},{"key":"emergency-preparedness-coordinator","count":2},{"key":"fire-protection","count":2},{"key":"local-operator","count":1},{"key":"maintenance-technician-engineer","count":7},{"key":"nuclear-training-instructor","count":2},{"key":"operations-support-work-control","count":1},{"key":"procurement-engineer","count":1},{"key":"reactor-operator","count":8},{"key":"senior-reactor-operator","count":5},{"key":"shift-supervisor","count":2}]'::jsonb;
update kafaa_demand_snapshots set count = 30, detail = '[{"key":"cyber-security-engineer","count":1},{"key":"emergency-preparedness-coordinator","count":2},{"key":"fire-protection","count":2},{"key":"local-operator","count":3},{"key":"maintenance-technician-engineer","count":7},{"key":"procurement-engineer","count":1},{"key":"quality-assurance-qc","count":2},{"key":"reactor-operator","count":6},{"key":"security-officer","count":1},{"key":"senior-reactor-operator","count":5}]'::jsonb where id = 'dm:2027-Q1:c-eng-cont:future' and count = 14 and detail = '[{"key":"cyber-security-engineer","count":1},{"key":"local-operator","count":1},{"key":"maintenance-technician-engineer","count":6},{"key":"procurement-engineer","count":1},{"key":"reactor-operator","count":5}]'::jsonb;
update kafaa_demand_snapshots set count = 57, detail = '[{"key":"chemistry-technician","count":3},{"key":"corporate-professional","count":2},{"key":"cyber-security-engineer","count":1},{"key":"emergency-preparedness-coordinator","count":2},{"key":"local-operator","count":10},{"key":"maintenance-technician-engineer","count":7},{"key":"nuclear-training-instructor","count":2},{"key":"operations-support-work-control","count":1},{"key":"procurement-engineer","count":1},{"key":"quality-assurance-qc","count":1},{"key":"radiation-protection-technician","count":4},{"key":"reactor-engineer-core-physicist","count":1},{"key":"reactor-operator","count":9},{"key":"security-officer","count":2},{"key":"senior-reactor-operator","count":5},{"key":"shift-supervisor","count":2},{"key":"systems-design-plant-engineer","count":4}]'::jsonb where id = 'dm:2027-Q1:c-mnt-ic:future' and count = 50 and detail = '[{"key":"chemistry-technician","count":3},{"key":"corporate-professional","count":2},{"key":"cyber-security-engineer","count":1},{"key":"emergency-preparedness-coordinator","count":2},{"key":"local-operator","count":10},{"key":"maintenance-technician-engineer","count":7},{"key":"nuclear-training-instructor","count":2},{"key":"operations-support-work-control","count":1},{"key":"reactor-engineer-core-physicist","count":1},{"key":"reactor-operator","count":8},{"key":"security-officer","count":2},{"key":"senior-reactor-operator","count":5},{"key":"shift-supervisor","count":2},{"key":"systems-design-plant-engineer","count":4}]'::jsonb;
update kafaa_session_proposals set demand = 57, shortfall = 57 where id = 'sp-2027-q1-c-mnt-ic-1' and demand = 50 and shortfall = 50 and status = 'draft';
