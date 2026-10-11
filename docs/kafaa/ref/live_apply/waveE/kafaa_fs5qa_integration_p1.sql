-- live apply part kafaa_fs5qa_integration_p1 (from supabase/migrations/20261010259001_kafaa_fs5qa_integration.sql, part 1 of 1)
-- [FS wave E · QA] Integration migration for wave E (FS38 to FS49).
-- 1. The one final redefinition of kafaa_skill_states_v2 / kafaa_skills_apply with the unioned recorded-evidence list (handover 3.9).
--    fsEe1 (20261010251001) and fsEe3 (20261010253001) each redefine both functions with only their own tokens; this file runs after
--    both, so locally and live the last body carries the full list. Before applying live, check that the live bodies still equal the
--    FS45 bodies (md5 07434363... / 55089400...).
-- 2. F24 mentoring engine card: the FS48 ranking functions, input and limitation, added on top of whatever version the card is at.
--    fsEe4 updates the card only where version = 1 (the local seed); the live card is at a later version (each engine weight change
--    bumps it), so this guarded, additive update appends the FS48 parts there and bumps the version by one, keeping
--    every existing function, input and sentence. It is a no-op where the FS48 functions are already listed (local, or a second run).
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.

-- @@SHARED-BEGIN@@
-- ───────────── FS03 skill states: FS10, FS21, FS22, FS37, FS39, FS40 and FS44 rows are recorded evidence. The single final wave-E
--               redefinition (same signatures; body copied from the FS45 migration, the two ref_table lists gain the union of the wave-E
--               tokens: 'plant_visits', 'twin_attempts' (fsEe1) and 'lectures', 'knowledge_assets' (fsEe3)). Applied live instead of the
--               fsEe1 / fsEe3 copies, which each carry only half of the union.
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
-- @@SHARED-END@@

-- ───────────── F24 mentoring engine card: FS48 additions on top of the current version (guarded; no-op once rankCircles is listed)
update kafaa_engine_cards c set
  scoring_functions = c.scoring_functions || array(select f from unnest(array['src/modules/m22/future.ts#rankCircles', 'src/modules/m22/future.ts#rankOffers']::text[]) f
                                                   where not (f = any(c.scoring_functions))),
  inputs_used = case when exists (select 1 from jsonb_array_elements(c.inputs_used) x where x ->> 'key' = 'wfn_participants') then c.inputs_used
    else c.inputs_used || '[{"key":"wfn_participants","en":"Women in future nuclear skills (opt-in only): the future-skill areas and ways to take part I chose, circle seats and open offers","ar":"المرأة في المهارات النووية المستقبلية (بالاختيار فقط): مجالات المهارات المستقبلية وطرق المشاركة التي اخترتها، ومقاعد الحلقات والعروض المفتوحة"}]'::jsonb end,
  limitations_en = case when position('(FS48)' in c.limitations_en) > 0 then c.limitations_en
    else rtrim(c.limitations_en) || ' Mentor circles and offers (FS48) are ranked only for people who opt in, from the areas they chose; withdrawing removes them from every ranking.' end,
  limitations_ar = case when position('(FS48)' in c.limitations_ar) > 0 then c.limitations_ar
    else rtrim(c.limitations_ar) || ' تُرتَّب حلقات الإرشاد والعروض (FS48) لمن اختار المشاركة فقط ووفق المجالات التي اختارها، والانسحاب يزيله من كل ترتيب.' end,
  version = c.version + 1,
  last_changed_at = '2026-10-11T00:00:00Z'::timestamptz
where c.id = 'mentoring' and not ('src/modules/m22/future.ts#rankCircles' = any(c.scoring_functions));
