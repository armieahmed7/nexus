-- [FS QA · wave A integration] Cross-feature wiring of FS01-FS06 on master. Additive and idempotent: guarded data
-- statements on kafaa_* rows only (no DDL, no function change, nothing removed); never touches a NEXUS object or row. Each
-- statement only changes rows that still hold the value the engineers loaded, so admin edits made live are kept, and a second
-- run (or a run on the final seed) changes nothing. Seed mirror: scripts/seed/ext/fsqa1-integration.mjs and
-- scripts/seed/ext/fs02-catalogue.mjs; proof: scripts/validate/fsqa1-integration.mjs.
--   1. FS02 <-> FS03: the stored decay class of the 71 F01 skills is FS03's area default (digital fast; plant systems,
--      engineering and nuclear safety slow; everything else standard), so the column, the public decay-class rows and the
--      derivation agree; the review date follows the class's review cycle.
--   2. FS04 -> FS02: 12 keyspace rows for FS02 advanced-reactor, AI and digital-plant skills; adv_skills.sk_ids follow the map.
--   3. FS05 -> FS02: 2030/2035 requirements naming an F01 skill with an FS02 future equivalent name the FS02 skill.
--   4. FS06 -> FS02: task links of kind "future" point at the FS02 equivalent.
--   5. FS05 -> F24/F36: "future" career edges (current role -> concept role) are not progression routes for the engines built
--      before FS05: the F24 fairness snapshot's Navigator reach (kafaa_fairness_compute) and the F36 digest's target role
--      (kafaa_dg_gather) skip them, as TS reachableRoles / careerMoves / defaultTargetRole do. Both are create-or-replace of
--      existing kafaa_* functions with unchanged signatures; only the edge filter is added.

-- 1. decay class and review date of 32 F01 skills
update kafaa_skills s set decay_class = v.new_class, review_due = v.new_due
from (values
  ('sk-pf-01', 'standard', '2028-01-15'::date, 'slow', '2029-01-15'::date),
  ('sk-pf-01-core', 'standard', '2028-02-15'::date, 'slow', '2029-02-15'::date),
  ('sk-pf-01-advfuel', 'standard', '2028-03-15'::date, 'slow', '2029-03-15'::date),
  ('sk-pf-02', 'standard', '2028-04-15'::date, 'slow', '2029-04-15'::date),
  ('sk-pf-02-advcool', 'standard', '2028-05-15'::date, 'slow', '2029-05-15'::date),
  ('sk-pf-03', 'standard', '2028-06-15'::date, 'slow', '2029-06-15'::date),
  ('sk-pf-03-rcs', 'standard', '2028-01-15'::date, 'slow', '2029-01-15'::date),
  ('sk-pf-03-steam', 'standard', '2028-02-15'::date, 'slow', '2029-02-15'::date),
  ('sk-pf-03-eccs', 'standard', '2028-03-15'::date, 'slow', '2029-03-15'::date),
  ('sk-pf-03-elec', 'standard', '2028-04-15'::date, 'slow', '2029-04-15'::date),
  ('sk-pf-03-aux', 'standard', '2028-05-15'::date, 'slow', '2029-05-15'::date),
  ('sk-pf-03-fuel', 'standard', '2028-06-15'::date, 'slow', '2029-06-15'::date),
  ('sk-en-01', 'standard', '2028-05-15'::date, 'slow', '2029-05-15'::date),
  ('sk-en-01-mods', 'standard', '2028-06-15'::date, 'slow', '2029-06-15'::date),
  ('sk-en-02', 'standard', '2028-02-15'::date, 'slow', '2029-02-15'::date),
  ('sk-en-02-perf', 'standard', '2028-03-15'::date, 'slow', '2029-03-15'::date),
  ('sk-ns-01', 'standard', '2028-04-15'::date, 'slow', '2029-04-15'::date),
  ('sk-ns-01-psa', 'standard', '2028-05-15'::date, 'slow', '2029-05-15'::date),
  ('sk-ns-02', 'standard', '2028-06-15'::date, 'slow', '2029-06-15'::date),
  ('sk-ns-02-techspec', 'standard', '2028-01-15'::date, 'slow', '2029-01-15'::date),
  ('sk-ns-02-licensing', 'standard', '2028-02-15'::date, 'slow', '2029-02-15'::date),
  ('sk-hu-01', 'slow', '2029-03-15'::date, 'standard', '2028-03-15'::date),
  ('sk-hu-01-star', 'slow', '2029-04-15'::date, 'standard', '2028-04-15'::date),
  ('sk-hu-02', 'slow', '2029-05-15'::date, 'standard', '2028-05-15'::date),
  ('sk-hu-02-brief', 'slow', '2029-06-15'::date, 'standard', '2028-06-15'::date),
  ('sk-sc-01', 'slow', '2029-01-15'::date, 'standard', '2028-01-15'::date),
  ('sk-sc-02', 'slow', '2029-02-15'::date, 'standard', '2028-02-15'::date),
  ('sk-ld-01', 'slow', '2029-06-15'::date, 'standard', '2028-06-15'::date),
  ('sk-ld-01-coach', 'slow', '2029-01-15'::date, 'standard', '2028-01-15'::date),
  ('sk-ld-01-instruct', 'slow', '2029-02-15'::date, 'standard', '2028-02-15'::date),
  ('sk-ld-02', 'slow', '2029-03-15'::date, 'standard', '2028-03-15'::date),
  ('sk-ld-02-decide', 'slow', '2029-04-15'::date, 'standard', '2028-04-15'::date)
) v(id, old_class, old_due, new_class, new_due)
where s.id = v.id and s.fs_area is null and s.decay_class = v.old_class and s.review_due is not distinct from v.old_due;

-- 2. 12 keyspace rows (FS04 -> FS02)
insert into kafaa_future_skill_map (id, key, key_kind, sk_id, relation, need_level, primary_sk, active, note_en, note_ar, sort, updated_by, updated_at)
select v.id, v.key, v.key_kind, v.sk_id, v.relation, v.need_level, v.primary_sk, v.active, v.note_en, v.note_ar, v.sort, v.updated_by, v.updated_at from (values
  ('fsm:as-passive-safety:sk-fs-adv-passive', 'as-passive-safety', 'adv_skill', 'sk-fs-adv-passive', 'new', 1, false, true, 'Passive safety concepts (FS02 awareness skill).', 'مفاهيم السلامة الخاملة (مهارة توعوية من الكتالوج).', 3, null::text, '2026-10-08T00:00:00Z'::timestamptz),
  ('fsm:as-new-licensing-basis:sk-fs-adv-regulation', 'as-new-licensing-basis', 'adv_skill', 'sk-fs-adv-regulation', 'new', 1, false, true, 'Advanced-reactor regulatory awareness (FS02).', 'الوعي التنظيمي بالمفاعلات المتقدمة (من الكتالوج).', 3, null::text, '2026-10-08T00:00:00Z'::timestamptz),
  ('fsm:as-other-regulators:sk-fs-adv-regulation', 'as-other-regulators', 'adv_skill', 'sk-fs-adv-regulation', 'new', 1, false, true, 'Advanced-reactor regulatory awareness (FS02).', 'الوعي التنظيمي بالمفاعلات المتقدمة (من الكتالوج).', 2, null::text, '2026-10-08T00:00:00Z'::timestamptz),
  ('fsm:as-transportable-units:sk-fs-adv-micro', 'as-transportable-units', 'adv_skill', 'sk-fs-adv-micro', 'new', 1, false, true, 'Microreactor and transportable unit concepts (FS02).', 'مفاهيم المفاعلات الصغرى والوحدات القابلة للنقل (من الكتالوج).', 2, null::text, '2026-10-08T00:00:00Z'::timestamptz),
  ('fsm:as-triso-fuel:sk-fs-adv-fuelcycle', 'as-triso-fuel', 'adv_skill', 'sk-fs-adv-fuelcycle', 'new', 1, false, true, 'Advanced fuel-cycle awareness (FS02).', 'الوعي بدورة الوقود المتقدمة (من الكتالوج).', 2, null::text, '2026-10-08T00:00:00Z'::timestamptz),
  ('fsm:as-digital-twins:sk-fs-ai-twin', 'as-digital-twins', 'adv_skill', 'sk-fs-ai-twin', 'new', 2, false, true, 'Digital twin validation (FS02).', 'التحقق من التوائم الرقمية (من الكتالوج).', 3, null::text, '2026-10-08T00:00:00Z'::timestamptz),
  ('fsm:as-ic-maintenance:sk-fs-dp-dic', 'as-ic-maintenance', 'adv_skill', 'sk-fs-dp-dic', 'adapts', 2, false, true, 'Digital I&C fundamentals (FS02).', 'أساسيات الأجهزة والتحكم الرقمية (من الكتالوج).', 2, null::text, '2026-10-08T00:00:00Z'::timestamptz),
  ('fsm:as-opaque-inspection:sk-fs-dp-robotics', 'as-opaque-inspection', 'adv_skill', 'sk-fs-dp-robotics', 'new', 2, false, true, 'Robotics and remote inspection (FS02).', 'الروبوتات والتفتيش عن بعد (من الكتالوج).', 2, null::text, '2026-10-08T00:00:00Z'::timestamptz),
  ('fsm:digital-twins:sk-fs-ai-twin', 'digital-twins', 'radar', 'sk-fs-ai-twin', 'new', 2, false, true, 'Digital twin validation (FS02).', 'التحقق من التوائم الرقمية (من الكتالوج).', 5, null::text, '2026-10-08T00:00:00Z'::timestamptz),
  ('fsm:ai-governance:sk-fs-ai-verify', 'ai-governance', 'radar', 'sk-fs-ai-verify', 'new', 2, false, true, 'AI output verification and challenge (FS02).', 'التحقق من مخرجات الذكاء الاصطناعي والاعتراض عليها (من الكتالوج).', 4, null::text, '2026-10-08T00:00:00Z'::timestamptz),
  ('fsm:ai-governance:sk-fs-ai-use', 'ai-governance', 'radar', 'sk-fs-ai-use', 'new', 2, false, true, 'Everyday use of approved AI tools (FS02).', 'الاستخدام اليومي لأدوات الذكاء الاصطناعي المعتمدة (من الكتالوج).', 5, null::text, '2026-10-08T00:00:00Z'::timestamptz),
  ('fsm:remote-ops:sk-fs-adv-multimodule', 'remote-ops', 'radar', 'sk-fs-adv-multimodule', 'new', 1, false, true, 'Multi-module operations concepts (FS02).', 'مفاهيم تشغيل الوحدات المتعددة (من الكتالوج).', 4, null::text, '2026-10-08T00:00:00Z'::timestamptz)
) v(id, key, key_kind, sk_id, relation, need_level, primary_sk, active, note_en, note_ar, sort, updated_by, updated_at)
where exists (select 1 from kafaa_skills s where s.id = v.sk_id and s.lifecycle <> 'obsolete')
  and exists (select 1 from kafaa_future_skill_map k where k.key = v.key and k.key_kind = v.key_kind)
on conflict (id) do nothing;

update kafaa_adv_skills a set sk_ids = v.new_ids
from (values
  ('as-passive-safety', '{sk-pf-02-advcool,sk-ns-01}'::text[], '{sk-pf-02-advcool,sk-ns-01,sk-fs-adv-passive}'::text[]),
  ('as-new-licensing-basis', '{sk-ns-02-licensing,sk-ns-02}'::text[], '{sk-ns-02-licensing,sk-ns-02,sk-fs-adv-regulation}'::text[]),
  ('as-triso-fuel', '{sk-pf-01-advfuel}'::text[], '{sk-pf-01-advfuel,sk-fs-adv-fuelcycle}'::text[]),
  ('as-opaque-inspection', '{sk-mp-01-remote}'::text[], '{sk-mp-01-remote,sk-fs-dp-robotics}'::text[]),
  ('as-transportable-units', '{sk-mp-01-remote}'::text[], '{sk-mp-01-remote,sk-fs-adv-micro}'::text[]),
  ('as-ic-maintenance', '{sk-mp-02-dic}'::text[], '{sk-mp-02-dic,sk-fs-dp-dic}'::text[]),
  ('as-other-regulators', '{sk-ns-02-licensing}'::text[], '{sk-ns-02-licensing,sk-fs-adv-regulation}'::text[]),
  ('as-digital-twins', '{sk-da-01-twins,sk-da-02}'::text[], '{sk-da-01-twins,sk-da-02,sk-fs-ai-twin}'::text[])
) v(id, old_ids, new_ids)
where a.id = v.id and a.sk_ids = v.old_ids;

-- 3. requirements of the 2030/2035 role-profile versions naming an F01 skill with an FS02 equivalent (53 in the seed;
--    FS05 -> FS02). Elements keep their level, importance, why text and driver; order is kind, ref_id (byte order, as normaliseReqs).
with eq(old_id, new_id) as (values ('sk-da-02-review', 'sk-fs-ai-verify'), ('sk-mp-01-remote', 'sk-fs-dp-robotics'), ('sk-mp-02-dic', 'sk-fs-dp-dic')),
hit as (
  select r.id from kafaa_role_profile_versions r
  where r.horizon <> 'now' and exists (select 1 from jsonb_array_elements(r.requirements) e(x) join eq on eq.old_id = e.x->>'ref_id' where e.x->>'kind' = 'skill')
),
re as (
  select h.id, jsonb_agg(case when eq.new_id is not null and e.x->>'kind' = 'skill' then jsonb_set(e.x, '{ref_id}', to_jsonb(eq.new_id)) else e.x end
           order by (e.x->>'kind') collate "C", (case when eq.new_id is not null and e.x->>'kind' = 'skill' then eq.new_id else e.x->>'ref_id' end) collate "C") as req
  from hit h join kafaa_role_profile_versions r on r.id = h.id
  cross join jsonb_array_elements(r.requirements) e(x) left join eq on eq.old_id = e.x->>'ref_id'
  group by h.id
)
update kafaa_role_profile_versions r set requirements = re.req from re where r.id = re.id;

-- 4. future task links naming an F01 skill with an FS02 equivalent (48 in the seed; FS06 -> FS02); id jts:<task>:<skill>
with eq(old_id, new_id) as (values ('sk-da-02-review', 'sk-fs-ai-verify'), ('sk-mp-01-remote', 'sk-fs-dp-robotics'), ('sk-mp-02-dic', 'sk-fs-dp-dic'))
update kafaa_jta_task_skills l set id = 'jts:' || l.task_id || ':' || eq.new_id, skill_id = eq.new_id
from eq
where l.kind = 'future' and l.skill_id = eq.old_id and l.id = 'jts:' || l.task_id || ':' || eq.old_id
  and not exists (select 1 from kafaa_jta_task_skills x where x.id = 'jts:' || l.task_id || ':' || eq.new_id);

-- 5. FS05 "future" edges are not progression routes for the F24 fairness reach and the F36 digest target
create or replace function kafaa_fairness_compute(p_as_of date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_cut timestamptz := (p_as_of + 1)::timestamp at time zone 'UTC';
  v_period text := to_char(p_as_of, 'IYYY-"W"IW');
  v_out jsonb := '[]'::jsonb; p record; v_ids text[]; v_rd jsonb;
  v_people text[]; v_pos boolean[]; v_f18 boolean := false; v_pool text[] := '{}';
begin
  -- Career Navigator: at least one role within two steps is ready now or ready within 3 years (path-only roles excluded); opted-out people left out
  v_people := '{}'; v_pos := '{}';
  for p in select pe.id, pe.job_role_id from kafaa_people pe where pe.id in (select kafaa_fairness_base(p_as_of)) order by pe.id loop
    if exists (select 1 from kafaa_reco_optouts o where o.person_id = p.id and o.surface = 'navigator' and o.opted_out) then continue; end if;
    with recursive r(role_id, steps) as (
      select e.to_role_id, 1 from kafaa_career_paths e where e.from_role_id = p.job_role_id and coalesce(e.kind, 'current') <> 'future'
      union
      select e.to_role_id, r.steps + 1 from r join kafaa_career_paths e on e.from_role_id = r.role_id where r.steps < 2 and coalesce(e.kind, 'current') <> 'future'
    ) select coalesce(array_agg(distinct r.role_id), '{}'::text[]) into v_ids from r where r.role_id <> p.job_role_id;
    v_rd := kafaa_career_readiness_compute(p.id, v_ids, p_as_of);
    v_people := v_people || p.id::text;
    v_pos := v_pos || exists (select 1 from jsonb_array_elements(v_rd) e where not coalesce((e->>'path_only')::boolean, false) and e->>'band' in ('ready_now', 'ready_in'));
  end loop;
  v_out := v_out || kafaa_fairness_rows(v_period, p_as_of, 'navigator_ready', 'navigator', 'career_readiness', v_people, v_pos);

  -- Marketplace: applicants (status as of the date, not withdrawn) selected or completed at least once
  select coalesce(array_agg(z.pid order by z.pid), '{}'), coalesce(array_agg(z.ok order by z.pid), '{}') into v_people, v_pos from (
    select a.person_id pid, bool_or(a.st in ('selected', 'completed')) ok from (
      select o.person_id, kafaa_fairness_hist_status(o.history, v_cut) st from kafaa_opportunity_applications o where o.person_id in (select kafaa_fairness_base(p_as_of))
    ) a where a.st is not null and a.st <> 'withdrawn' group by a.person_id) z;
  v_out := v_out || kafaa_fairness_rows(v_period, p_as_of, 'opportunity_selected', 'marketplace', 'opportunity_applications', v_people, v_pos);

  -- Mentoring: requesters matched (or since closed) by the date
  select coalesce(array_agg(z.pid order by z.pid), '{}'), coalesce(array_agg(z.ok order by z.pid), '{}') into v_people, v_pos from (
    select m.person_id pid, bool_or((case when m.responded_at is not null and m.responded_at < v_cut then m.status else 'requested' end) in ('matched', 'closed')) ok
    from kafaa_mentoring_requests m where m.person_id in (select kafaa_fairness_base(p_as_of)) and m.created_at < v_cut group by m.person_id) z;
  v_out := v_out || kafaa_fairness_rows(v_period, p_as_of, 'mentoring_matched', 'mentoring', 'mentoring_requests', v_people, v_pos);

  -- High-potential pool: F18 talent-review placements (potential 3, performance 2+) when present, else the F16 leadership pipeline
  if to_regclass('public.kafaa_review_placements') is not null then
    begin
      execute 'select coalesce(bool_or(potential is not null and perf is not null), false) from kafaa_review_placements' into v_f18;
      if v_f18 then execute 'select coalesce(array_agg(distinct person_id), ''{}''::text[]) from kafaa_review_placements where potential = 3 and perf >= 2' into v_pool; end if;
    exception when others then v_f18 := false; v_pool := '{}';
    end;
  end if;
  if not v_f18 then
    select coalesce(array_agg(distinct n.person_id), '{}') into v_pool from kafaa_leadership_nominations n where kafaa_fairness_hist_status(n.history, v_cut) in ('approved', 'completed');
  end if;
  select coalesce(array_agg(b.id order by b.id), '{}'), coalesce(array_agg(b.id = any(v_pool) order by b.id), '{}') into v_people, v_pos from kafaa_fairness_base(p_as_of) b(id);
  v_out := v_out || kafaa_fairness_rows(v_period, p_as_of, 'hipo_pool', 'talent_evidence', case when v_f18 then 'review_placements' else 'leadership_nominations' end, v_people, v_pos);
  return v_out;
end $$;

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
revoke execute on function kafaa_fairness_compute(date), kafaa_dg_gather(text, date, jsonb) from public, anon, authenticated;
