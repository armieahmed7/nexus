-- [FS QA · wave E integration] Cross-feature wiring of FS38-FS49 on the integration branch. Additive and idempotent: create-or-replace of
-- existing kafaa_* functions with unchanged signatures and grants, one new internal helper (executable by no API role), ALTER POLICY on
-- wave-E kafaa_* tables only (same rules, perf form), and guarded data statements (an update only changes a row that still holds what the
-- wave-E engineer migrations and seed left live, so a second run, or a run on the final seed, changes nothing). Nothing is removed; never
-- touches a NEXUS object or row.
-- Proof: scripts/validate/fsqa5-integration.mjs (PGlite: SQL = TS, forward proof, idempotence). Tests: tests/unit/fsqa5-integration.test.tsx.
--   1. Recorded evidence (handover 3.9): the single final kafaa_skill_states_v2 / kafaa_skills_apply carry the union of the recorded
--      ref_table lists: FS39 'plant_visits', FS40 'twin_attempts' (fs51) and FS44 'lectures', 'knowledge_assets' (fs53). Copied from the
--      fs53 body; only the two lists change. TS: RECORDED_REF_TABLES (src/domain/skills.ts).
--   2. FS39 -> F36 digest: "approvals I owe" lists reference-plant visits that name me as host, logged by today and still waiting for my
--      confirmation (link /my/plant-log?tab=host). Copied from the fs2qa body plus one block; TS gatherDigest (src/shell/digest/rules.ts).
--   3. FS41 -> FS31: kafaa_cec_cites(criteria) = cecCitations(): the CleanEnergyComp competences a credential's criteria cite
--      (MC-CLEAN-ENERGY cites CEC-2.2 and CEC-3.1). Internal helper for later waves (FS74 reads kafaa_cec_level the same way).
--   4. RLS performance for the wave-E tables whose engineer migrations kept the generated rule form (fs51 and fs53 tables): the same
--      rules with caller-only helpers evaluated once per statement (scripts/gen-rls-perf.mjs rewrite; visible rows proved identical for
--      28 identities x the 8 tables before and after). The fs52 and fs54 tables already carry the perf form.
--   5. Data replay for item 2: the two seeded digests whose approvals now include a plant visit (and their notices), guarded.

-- 1. recorded evidence: the final shared redefinition (union of the wave-E lists)
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
    where e.active and (e.kind in ('rating', 'ojt', 'credential') or e.ref_table in ('fitness_attempts', 'adaptive_attempts', 'task_attempts', 'ai_drill_attempts', 'plant_visits', 'twin_attempts', 'lectures', 'knowledge_assets')) and (p_person is null or e.person_id = p_person)
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
  where e.active and e.kind in ('qual', 'course', 'assessment', 'jpm') and e.ref_table not in ('fitness_attempts', 'adaptive_attempts', 'task_attempts', 'ai_drill_attempts', 'plant_visits', 'twin_attempts', 'lectures', 'knowledge_assets') and (p_person is null or e.person_id = p_person)
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

-- 2. FS39 -> F36 digest approvals
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
  -- approvals (FS wave E integration, FS39): reference-plant visits naming me as host, logged by today and waiting for my confirmation
  for r in select v.id, v.created_at, p.id as pid, p.display_name, p.display_name_ar from kafaa_plant_visits v left join kafaa_people p on p.id = v.person_id
           where v.host_person_id = p_me and v.status = 'logged' and v.person_id <> p_me and (v.created_at at time zone 'UTC')::date <= p_today loop
    out := out || kafaa_dg_item('approval:plant_visits:' || r.id, 'approval', 'plant_visits', r.id,
      'Plant visit to confirm: ' || case when r.pid is null then 'A colleague' else r.display_name end, 'زيارة محطة بانتظار تأكيدك: ' || case when r.pid is null then 'زميل' else coalesce(nullif(r.display_name_ar, ''), r.display_name) end,
      '/my/plant-log?tab=host', jsonb_build_array(jsonb_build_object('code', 'approval_plant_visit', 'vars', jsonb_build_object('date', to_char(r.created_at at time zone 'UTC', 'YYYY-MM-DD')))),
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

-- 3. FS41 -> FS31 competences cited by credential criteria
create or replace function kafaa_cec_cites(p_criteria jsonb) returns jsonb language sql stable security definer set search_path = public as $$
  -- = cecCitations() in src/modules/m32/cec.ts: competences (framework order) cited by credential criteria, each with the citing keys
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'code', x.code, 'keys', x.keys) order by x.sort, x.id collate "C"), '[]'::jsonb)
  from (
    select c.id, c.code, c.sort, (select jsonb_agg(k->>'key' order by o) from jsonb_array_elements(coalesce(p_criteria, '[]'::jsonb)) with ordinality e(k, o)
      where case when k->>'kind' = 'skill' then (k->>'ref') = any(c.skill_ids)
                 else exists (select 1 from jsonb_array_elements(coalesce(c.learning, '[]'::jsonb)) l where l->>'kind' = k->>'kind' and l->>'ref' = k->>'ref') end) as keys
    from kafaa_cec_competences c where coalesce(c.status, 'published') <> 'retired'
  ) x where x.keys is not null;
$$;
revoke execute on function kafaa_cec_cites(jsonb) from public, anon, authenticated;

-- 4. RLS perf form for wave-E tables (ALTER POLICY only, same rules)
alter policy kafaa_read on public.kafaa_contributions using ((((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false))));
alter policy kafaa_read on public.kafaa_lectures using ((((COALESCE(published, false) AND (SELECT kafaa_has_grant('knowledge'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))) OR (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((speaker_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, speaker_id, NULL::text, false))) OR (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((created_by = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, created_by, NULL::text, false)))));
alter policy kafaa_read on public.kafaa_localisation_items using ((((SELECT kafaa_has_grant('knowledge'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on public.kafaa_plant_visits using (((((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false))) OR (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((host_person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, host_person_id, NULL::text, false)))));
alter policy kafaa_read on public.kafaa_smr_deltas using ((((COALESCE(listed, false) AND (SELECT kafaa_has_grant('skills_taxonomy'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))) OR (((SELECT kafaa_has_grant('audit_log'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))) OR (((SELECT kafaa_has_grant('sat'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))))));
alter policy kafaa_read on public.kafaa_twin_attempts using ((((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false))));
alter policy kafaa_read on public.kafaa_twin_keys using ((((SELECT kafaa_has_grant('secure_items'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on public.kafaa_twin_scenarios using ((((COALESCE(listed, false) AND (SELECT kafaa_has_grant('internal_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))) OR (((SELECT kafaa_has_grant('secure_items'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))))));

-- 5. data replay (guarded): seeded digests that now list a plant visit to confirm
select set_config('kafaa.seeding', 'on', true);
update kafaa_digest_runs set items = $j$[{"meta_en":"Local Operator trainee, Crew C (DNT graduate)","meta_ar":"متدرب مشغّل محلي، الطاقم ج (خريج الدبلوم)","score":null,"due_on":null,"days":null,"id":"approval:mentoring_requests:mr-1","kind":"approval","ref_table":"mentoring_requests","ref_id":"mr-1","title_en":"Mentoring request from Local Operator trainee, Crew C (DNT graduate)","title_ar":"طلب إرشاد من متدرب مشغّل محلي، الطاقم ج (خريج الدبلوم)","link":"/my/mentoring","why":[{"code":"approval_mentoring","vars":{"date":"2026-10-06"}}],"urgency":2},{"meta_en":"Local Operator trainee, Crew C (DNT graduate)","meta_ar":"متدرب مشغّل محلي، الطاقم ج (خريج الدبلوم)","score":null,"due_on":null,"days":null,"id":"approval:ojt_eval_requests:oer-p-k-lo-trainee-qs-lo-turbine-t3","kind":"approval","ref_table":"ojt_eval_requests","ref_id":"oer-p-k-lo-trainee-qs-lo-turbine-t3","title_en":"OJT evaluation requested: Local Operator trainee, Crew C (DNT graduate)","title_ar":"طلب تقييم تدريب عملي: متدرب مشغّل محلي، الطاقم ج (خريج الدبلوم)","link":"/my/ojt?tab=evaluate","why":[{"code":"approval_ojt_eval","vars":{"date":"2026-09-28"}}],"urgency":2},{"meta_en":"Outage Planner (role card)","meta_ar":"مخطط فترات الإيقاف (بطاقة دور)","score":null,"due_on":null,"days":null,"id":"approval:plant_visits:pv-demo-07","kind":"approval","ref_table":"plant_visits","ref_id":"pv-demo-07","title_en":"Plant visit to confirm: Outage Planner (role card)","title_ar":"زيارة محطة بانتظار تأكيدك: مخطط فترات الإيقاف (بطاقة دور)","link":"/my/plant-log?tab=host","why":[{"code":"approval_plant_visit","vars":{"date":"2026-10-01"}}],"urgency":2},{"meta_en":null,"meta_ar":null,"score":null,"due_on":"2026-08-25","days":-37,"id":"conversation:career_conversations:p-k-instructor","kind":"conversation","ref_table":"career_conversations","ref_id":"p-k-instructor","title_en":"Your six-monthly career conversation","title_ar":"حوارك المهني نصف السنوي","link":"/my/career/conversations","why":[{"code":"conversation_overdue","vars":{"date":"2026-08-25"}}],"urgency":3},{"meta_en":"Hamad Al Mazrouei","meta_ar":"حمد المزروعي","score":null,"due_on":"2026-09-29","days":-2,"id":"mentoring:mentoring_agreements:ma-mr-2","kind":"mentoring","ref_table":"mentoring_agreements","ref_id":"ma-mr-2","title_en":"Mentoring session with Hamad Al Mazrouei","title_ar":"جلسة إرشاد مع حمد المزروعي","link":"/my/mentoring/ma-mr-2","why":[{"code":"mentoring_overdue","vars":{"date":"2026-09-29"}},{"code":"cadence_fortnightly"}],"urgency":3},{"meta_en":null,"meta_ar":null,"score":null,"due_on":"2026-11-29","days":59,"id":"coach:enrolments:en-142","kind":"coach","ref_table":"enrolments","ref_id":"en-142","title_en":"HU-101 · Human performance core tools","title_ar":"HU-101 · الأدوات الأساسية للأداء البشري","link":"/learn/course/c-hu","why":[{"code":"coach_due","vars":{"days":59,"date":"2026-11-29"}}],"urgency":3},{"meta_en":null,"meta_ar":null,"score":0.7,"due_on":null,"days":null,"id":"opportunity:opportunities:opp-ep-exercise-evaluator","kind":"opportunity","ref_table":"opportunities","ref_id":"opp-ep-exercise-evaluator","title_en":"Emergency exercise controller and evaluator support","title_ar":"دعم التحكم والتقييم في تمارين الطوارئ","link":"/opportunities/opp-ep-exercise-evaluator","why":[{"code":"opp_match","vars":{"pct":70}},{"code":"opp_new","vars":{"date":"2026-09-22"}}],"urgency":3}]$j$::jsonb, item_count = 7
 where id = 'dg:p-k-instructor:2026-W40' and not (items @> '[{"ref_table":"plant_visits"}]'::jsonb);
update kafaa_digest_runs set items = $j$[{"meta_en":"DOA signatory (role card)","meta_ar":"مفوض بالتوقيع (بطاقة دور)","score":null,"due_on":null,"days":null,"id":"approval:plant_visits:pv-demo-09","kind":"approval","ref_table":"plant_visits","ref_id":"pv-demo-09","title_en":"Plant visit to confirm: DOA signatory (role card)","title_ar":"زيارة محطة بانتظار تأكيدك: مفوض بالتوقيع (بطاقة دور)","link":"/my/plant-log?tab=host","why":[{"code":"approval_plant_visit","vars":{"date":"2026-10-07"}}],"urgency":2},{"meta_en":null,"meta_ar":null,"score":null,"due_on":"2018-07-01","days":-3021,"id":"conversation:career_conversations:p-training-mgr","kind":"conversation","ref_table":"career_conversations","ref_id":"p-training-mgr","title_en":"Your six-monthly career conversation","title_ar":"حوارك المهني نصف السنوي","link":"/my/career/conversations","why":[{"code":"conversation_overdue","vars":{"date":"2018-07-01"}}],"urgency":3},{"meta_en":null,"meta_ar":null,"score":null,"due_on":"2026-11-21","days":44,"id":"coach:enrolments:en-14","kind":"coach","ref_table":"enrolments","ref_id":"en-14","title_en":"HU-101 · Human performance core tools","title_ar":"HU-101 · الأدوات الأساسية للأداء البشري","link":"/learn/course/c-hu","why":[{"code":"coach_due","vars":{"days":44,"date":"2026-11-21"}}],"urgency":3},{"meta_en":null,"meta_ar":null,"score":0.7,"due_on":null,"days":null,"id":"opportunity:opportunities:opp-icv-supplier-mapping","kind":"opportunity","ref_table":"opportunities","ref_id":"opp-icv-supplier-mapping","title_en":"In-country value: local supplier capability mapping","title_ar":"القيمة المحلية المضافة: رسم خريطة قدرات الموردين المحليين","link":"/opportunities/opp-icv-supplier-mapping","why":[{"code":"opp_match","vars":{"pct":70}},{"code":"opp_new","vars":{"date":"2026-09-22"}}],"urgency":3},{"meta_en":null,"meta_ar":null,"score":0.7,"due_on":null,"days":null,"id":"opportunity:opportunities:opp-knowledge-capture-senior-ops","kind":"opportunity","ref_table":"opportunities","ref_id":"opp-knowledge-capture-senior-ops","title_en":"Knowledge capture: structured interviews with departing senior operators","title_ar":"التقاط المعرفة: مقابلات منظمة مع كبار المشغّلين المغادرين","link":"/opportunities/opp-knowledge-capture-senior-ops","why":[{"code":"opp_match","vars":{"pct":70}},{"code":"opp_new","vars":{"date":"2026-09-18"}}],"urgency":3}]$j$::jsonb, item_count = 5
 where id = 'dg:p-training-mgr:2026-W41' and not (items @> '[{"ref_table":"plant_visits"}]'::jsonb);
update kafaa_notifications set title_en = $j$"Your weekly digest: 7 things for you"$j$::jsonb #>> '{}', title_ar = $j$"ملخصك الأسبوعي: 7 أمور تخصك"$j$::jsonb #>> '{}', body_en = $j$"Mentoring request from Local Operator trainee, Crew C (DNT graduate) · OJT evaluation requested: Local Operator trainee, Crew C (DNT graduate) · Plant visit to confirm: Outage Planner (role card)"$j$::jsonb #>> '{}', body_ar = $j$"طلب إرشاد من متدرب مشغّل محلي، الطاقم ج (خريج الدبلوم) · طلب تقييم تدريب عملي: متدرب مشغّل محلي، الطاقم ج (خريج الدبلوم) · زيارة محطة بانتظار تأكيدك: مخطط فترات الإيقاف (بطاقة دور)"$j$::jsonb #>> '{}'
 where id = 'nt-dg-p-k-instructor-2026-W40' and kind = 'digest' and body_en not like '%Plant visit to confirm%';
update kafaa_notifications set title_en = $j$"Your weekly digest: 5 things for you"$j$::jsonb #>> '{}', title_ar = $j$"ملخصك الأسبوعي: 5 أمور تخصك"$j$::jsonb #>> '{}', body_en = $j$"Plant visit to confirm: DOA signatory (role card) · Your six-monthly career conversation · HU-101 · Human performance core tools"$j$::jsonb #>> '{}', body_ar = $j$"زيارة محطة بانتظار تأكيدك: مفوض بالتوقيع (بطاقة دور) · حوارك المهني نصف السنوي · HU-101 · الأدوات الأساسية للأداء البشري"$j$::jsonb #>> '{}'
 where id = 'nt-dg-p-training-mgr-2026-W41' and kind = 'digest' and body_en not like '%Plant visit to confirm%';
