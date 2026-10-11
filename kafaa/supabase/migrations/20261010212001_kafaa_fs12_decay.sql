-- [FS · wave A · E2 · FS03, M17] Honest skill states: working decay, decay classes and confidence bands.
-- Additive and idempotent: kafaa_* objects only (new columns on kafaa_person_skills, one new reference table, new functions, and
-- create-or-replace of four existing kafaa_* functions with unchanged signatures and return types). Never alters NEXUS objects.
--   * kafaa_skill_states_v2(person, now, half-life override): the SQL mirror of deriveStates in src/domain/skills.ts (per-class
--     half-lives from kafaa_engine_settings.skills, the calibrated blend, Wilson band and interval). PGlite proves SQL = TS
--     (scripts/validate/fs12-decay.mjs).
--   * kafaa_skill_states_compute (wave-0 signature) now returns the v2 states; kafaa_skills_apply writes band and interval too.
--   * kafaa_engine_check (W3E5, used by setEngineWeights / changeEngineWeights) accepts the half-life keys of the skills surface
--     (whole months 6-120, fast <= standard <= slow); every other weight keeps the 0-10 rule.
--   * RPCs kafaa_skill_confidence_stats (aggregate read) and kafaa_set_skill_half_lives (admin; change log, ledger, recompute).
--   * kafaa_fs03_backfill_award_evidence(): F01 credential evidence for micro-credential awards that wrote none (W5 open item).
-- LocalBackend mirror: src/data/local/rpc.w0.ts (apply), src/modules/m17/backend/local.fs03.ts (RPCs), src/modules/m16/backend/local.ts (check).

-- ───────────── Columns (generated DDL has them for new databases)
alter table kafaa_person_skills add column if not exists confidence_band text not null default 'low';
alter table kafaa_person_skills add column if not exists conf_low numeric not null default 0;
alter table kafaa_person_skills add column if not exists conf_high numeric not null default 0;
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'kafaa_person_skills'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%confidence_band%') then
    alter table kafaa_person_skills add constraint kafaa_person_skills_confidence_band_check check (confidence_band in ('low', 'medium', 'high'));
  end if;
end $$;

-- ───────────── Table (generated DDL)
-- M17 · Skill decay classes with default half-lives, area defaults and sourced rationale (FS03)
create table if not exists kafaa_skill_decay_classes (
  id text primary key,
  name_en text not null,
  name_ar text not null,
  summary_en text not null,
  summary_ar text not null,
  examples_en text not null default '',
  examples_ar text not null default '',
  default_months integer not null,
  areas text[] not null default '{}'::text[],
  facts jsonb not null default '[]'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  as_of date not null,
  sort integer not null default 0
);
comment on table kafaa_skill_decay_classes is '[M17] Skill decay classes with default half-lives, area defaults and sourced rationale (FS03)';
alter table kafaa_skill_decay_classes enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_skill_decay_classes' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_skill_decay_classes for select to anon, authenticated using (false)'; end if;
end $$;
alter policy kafaa_read on kafaa_skill_decay_classes using ((SELECT kafaa_has_grant('public_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text])));
revoke all on kafaa_skill_decay_classes from anon, authenticated;
grant select on kafaa_skill_decay_classes to anon, authenticated;

-- ───────────── Engine settings: the fast and slow half-lives next to the wave-0 standard key (existing values are kept)
update kafaa_engine_settings set weights = '{"half_life_fast": 18, "half_life_slow": 60}'::jsonb || weights
where id = 'skills' and not (weights ? 'half_life_fast' and weights ? 'half_life_slow');
-- The deployment baseline of the skills change log describes the same defaults (the three half-lives were all in force at deployment).
update kafaa_engine_changes set weights_after = '{"half_life_fast": 18, "half_life_slow": 60}'::jsonb || weights_after
where id = 'ec:skills:001' and weights_before = '{}'::jsonb and not (weights_after ? 'half_life_fast' and weights_after ? 'half_life_slow');

-- ───────────── Rules (mirror of src/domain/skills.ts; same float operations and order)
-- Half-lives in months from a weights object: half_life_fast / half_life_months (standard) / half_life_slow, 6-120, else the default.
create or replace function kafaa_skill_hl_resolve(p_w jsonb) returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object(
    'fast', case when jsonb_typeof(p_w -> 'half_life_fast') = 'number' and (p_w ->> 'half_life_fast')::numeric between 6 and 120 then (p_w ->> 'half_life_fast')::numeric else 18 end,
    'standard', case when jsonb_typeof(p_w -> 'half_life_months') = 'number' and (p_w ->> 'half_life_months')::numeric between 6 and 120 then (p_w ->> 'half_life_months')::numeric else 36 end,
    'slow', case when jsonb_typeof(p_w -> 'half_life_slow') = 'number' and (p_w ->> 'half_life_slow')::numeric between 6 and 120 then (p_w ->> 'half_life_slow')::numeric else 60 end)
$$;
-- The live half-lives (engine settings), optionally overridden for a what-if preview.
create or replace function kafaa_skill_hl_months(p_override jsonb default null) returns jsonb language sql stable security definer set search_path = public as $$
  select kafaa_skill_hl_resolve(coalesce((select e.weights from kafaa_engine_settings e where e.id = 'skills'), '{}'::jsonb) || coalesce(p_override, '{}'::jsonb))
$$;
-- A skill's decay class: its own decay_class (FS02 column, read through to_jsonb so it works before that column exists), else the area default.
create or replace function kafaa_skill_decay_class(p_area text, p_own text) returns text language sql immutable set search_path = public as $$
  select case when p_own in ('fast', 'standard', 'slow') then p_own
              when p_area in ('digital', 'ai_data', 'digital_plant', 'cyber_hygiene') then 'fast'
              when p_area in ('plant_systems', 'engineering', 'safety') then 'slow'
              else 'standard' end
$$;
-- Calibrated blend over the best contribution per source, strongest first: [1 - prod(1 - c_k * 0.5^(k-1)), 10 * sum(c_k * 0.5^(k-1))].
create or replace function kafaa_skill_blend(p_c float8[]) returns float8[] language plpgsql immutable set search_path = public as $$
declare r float8 := 1; n float8 := 0; w float8; k integer;
begin
  for k in 1 .. coalesce(array_length(p_c, 1), 0) loop
    w := p_c[k] * power(0.5::float8, (k - 1)::float8);
    r := r * (1 - w);
    n := n + w;
  end loop;
  return array[1 - r, n * 10];
end $$;
-- Wilson score interval (z = 1.28, 80%) around confidence p with n pseudo-observations, capped to [0, 0.99], 2 decimals.
create or replace function kafaa_skill_interval(p float8, n float8) returns float8[] language plpgsql immutable set search_path = public as $$
declare z float8 := 1.28; z2 float8; den float8; centre float8; half float8;
begin
  if not (n > 0) then return array[0::float8, floor(least(0.99::float8, p) * 100 + 0.5) / 100]; end if;
  z2 := z * z;
  den := 1 + z2 / n;
  centre := (p + z2 / (2 * n)) / den;
  half := (z / den) * sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return array[floor(greatest(0::float8, centre - half) * 100 + 0.5) / 100, floor(least(0.99::float8, centre + half) * 100 + 0.5) / 100];
end $$;
create or replace function kafaa_skill_band(p_low float8) returns text language sql immutable set search_path = public as $$
  select case when p_low >= 0.6 then 'high' when p_low >= 0.3 then 'medium' else 'low' end
$$;

-- ───────────── Skill states v2 (mirror of deriveStates with a DecayModel)
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
    where e.active and e.kind in ('rating', 'ojt', 'credential') and (p_person is null or e.person_id = p_person)
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

-- Wave-0 signature kept: the same columns, now from v2 (live half-lives, calibrated confidence).
create or replace function kafaa_skill_states_compute(p_person text, p_now date)
returns table (id text, person_id text, skill_id text, level integer, confidence numeric, basis text, reasons jsonb, evidence_count integer)
language sql stable security definer set search_path = public as $$
  select v.id, v.person_id, v.skill_id, v.level, v.confidence, v.basis, v.reasons, v.evidence_count from kafaa_skill_states_v2(p_person, p_now, null) v
$$;

-- Apply: upsert derived evidence and states (band and interval included); rows no longer supported are marked inactive, never removed.
create or replace function kafaa_skills_apply(p_person text, p_now date) returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  insert into kafaa_skill_evidence (id, person_id, skill_id, kind, ref_table, ref_id, level, basis, status, observed_on, active)
  select d.id, d.person_id, d.skill_id, d.kind, d.ref_table, d.ref_id, d.level, d.basis, d.status, d.observed_on, true from kafaa_skill_evidence_derive(p_person, p_now) d
  on conflict (id) do update set level = excluded.level, basis = excluded.basis, status = excluded.status, observed_on = excluded.observed_on, active = true
  where (kafaa_skill_evidence.level, kafaa_skill_evidence.basis, kafaa_skill_evidence.status, kafaa_skill_evidence.observed_on, kafaa_skill_evidence.active)
        is distinct from (excluded.level, excluded.basis, excluded.status, excluded.observed_on, true);
  update kafaa_skill_evidence e set active = false
  where e.active and e.kind in ('qual', 'course', 'assessment', 'jpm') and (p_person is null or e.person_id = p_person)
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

-- ───────────── Engine settings check (W3E5 kafaa_engine_check: same signature, order and messages; half-life keys added)
create or replace function kafaa_engine_check(p_surface text, p_engine text, p_weights jsonb, p_role text) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_hl jsonb;
begin
  if p_role is null then return kafaa_refuse('engine.settings', 'engine_settings', p_surface, 'forbidden', 'Only a platform admin may change engine settings'); end if;
  if p_surface is null or p_surface not in ('skills', 'recommend', 'match', 'search') then return kafaa_refuse('engine.settings', 'engine_settings', p_surface, 'invalid', 'Unknown surface', p_role); end if;
  if p_engine is null or p_engine not in ('deterministic', 'model') then return kafaa_refuse('engine.settings', 'engine_settings', p_surface, 'invalid', 'Engine must be deterministic or model', p_role); end if;
  if p_weights is not null and (jsonb_typeof(p_weights) <> 'object' or exists (
      select 1 from jsonb_each(p_weights) w where jsonb_typeof(w.value) <> 'number'
        or (not (p_surface = 'skills' and w.key in ('half_life_fast', 'half_life_months', 'half_life_slow'))
            and ((w.value::text)::numeric < 0 or (w.value::text)::numeric > 10)))) then
    return kafaa_refuse('engine.settings', 'engine_settings', p_surface, 'invalid', 'Weights must be numbers between 0 and 10', p_role);
  end if;
  if p_surface = 'skills' and p_weights is not null then
    v_hl := kafaa_skill_hl_resolve(p_weights);
    if exists (select 1 from jsonb_each(p_weights) w where w.key in ('half_life_fast', 'half_life_months', 'half_life_slow')
                 and ((w.value::text)::numeric <> trunc((w.value::text)::numeric) or (w.value::text)::numeric < 6 or (w.value::text)::numeric > 120))
       or (v_hl ->> 'fast')::numeric > (v_hl ->> 'standard')::numeric or (v_hl ->> 'standard')::numeric > (v_hl ->> 'slow')::numeric then
      return kafaa_refuse('engine.settings', 'engine_settings', p_surface, 'invalid', 'Half-lives are whole months from 6 to 120, and fast may not be longer than standard, nor standard longer than slow', p_role);
    end if;
  end if;
  return null;
end $$;

-- ───────────── W5 open item: F01 credential evidence for micro-credential awards that wrote none (seeded awards)
create or replace function kafaa_fs03_backfill_award_evidence() returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  insert into kafaa_skill_evidence (id, person_id, skill_id, kind, ref_table, ref_id, level, basis, status, observed_on, note, recorded_by, active)
  select 'se:credential:' || a.id || ':' || al.id, a.person_id, al.id, 'credential', 'microcred_awards', a.id, al.lvl, 'evidenced', 'current', a.issued_on, null,
         coalesce(a.decided_by, a.person_id), a.status = 'awarded'
  from kafaa_microcred_awards a join kafaa_microcred_defs d on d.id = a.def_id cross join lateral kafaa_mc_aligned(d.alignment) al
  where a.status in ('awarded', 'superseded', 'revoked') and a.issued_on is not null
  on conflict (id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
select kafaa_fs03_backfill_award_evidence();

-- ───────────── Aggregates (mirror of confidenceStats in src/modules/m17/decay.ts). Cells naming fewer than 10 people are null.
create or replace function kafaa_fs03_stats(p_hl jsonb, p_now date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb; v_preview jsonb := null; v_last jsonb;
begin
  if p_hl is not null then
    with a as (select x.id, x.person_id, x.level, x.confidence_band as b from kafaa_skill_states_v2(null, p_now, null) x),
         b as (select y.id, y.level, y.confidence_band as b from kafaa_skill_states_v2(null, p_now, p_hl) y),
         j as (select a.id, a.person_id, a.b as f, b.b as t, a.level as la, b.level as lb from a join b on b.id = a.id),
         tr as (select j.f, j.t, count(*)::int as n, count(distinct j.person_id)::int as pp from j where j.f <> j.t group by j.f, j.t),
         ord as (select x.f, y.t, x.o * 3 + y.o as o from (values ('low', 0), ('medium', 1), ('high', 2)) x(f, o) cross join (values ('low', 0), ('medium', 1), ('high', 2)) y(t, o))
    select jsonb_build_object(
      'months', kafaa_skill_hl_months(p_hl),
      'transitions', coalesce((select jsonb_agg(jsonb_build_object('from', tr.f, 'to', tr.t, 'states', case when tr.pp < 10 then null else tr.n end, 'suppressed', tr.pp < 10) order by ord.o)
                               from tr join ord on ord.f = tr.f and ord.t = tr.t), '[]'::jsonb),
      'changed', (select case when count(distinct j.person_id) < 10 then null else count(*)::int end from j where j.f <> j.t),
      'people', (select case when count(distinct j.person_id) < 10 then null else count(distinct j.person_id)::int end from j where j.f <> j.t),
      'level_down', (select case when count(distinct j.person_id) < 10 then null else count(*)::int end from j where j.lb < j.la),
      'level_up', (select case when count(distinct j.person_id) < 10 then null else count(*)::int end from j where j.lb > j.la))
    into v_preview;
  end if;
  select jsonb_build_object('id', c.id, 'changed_at', c.changed_at, 'weights_before', c.weights_before, 'weights_after', c.weights_after, 'rationale', c.rationale)
    into v_last from kafaa_engine_changes c where c.surface = 'skills' order by c.changed_at desc, c.id collate "C" desc limit 1;
  with st as (
         select p.person_id, p.skill_id, p.confidence_band as band, kafaa_skill_decay_class(k.area, to_jsonb(k) ->> 'decay_class') as cls, k.area,
                coalesce((p.reasons -> 0 ->> 'ageing')::boolean, false) as ageing
         from kafaa_person_skills p join kafaa_skills k on k.id = p.skill_id where p.active),
       cells as (select st.cls, st.band, count(*)::int as n, count(distinct st.person_id)::int as pp from st group by st.cls, st.band),
       acells as (select st.area, st.band, count(*)::int as n, count(distinct st.person_id)::int as pp from st group by st.area, st.band),
       bo as (select * from (values ('low', 0), ('medium', 1), ('high', 2)) x(b, o)),
       co as (select * from (values ('fast', 0), ('standard', 1), ('slow', 2)) x(c, o)),
       sk as (select kafaa_skill_decay_class(k.area, to_jsonb(k) ->> 'decay_class') as cls, k.area from kafaa_skills k),
       aw as (select a.id from kafaa_microcred_awards a where a.status in ('awarded', 'superseded', 'revoked') and a.issued_on is not null)
  select jsonb_build_object(
    'allowed', true,
    'as_of', p_now::text,
    'months', kafaa_skill_hl_months(null),
    'classes', (select jsonb_agg(jsonb_build_object('id', co.c, 'skills', (select count(*)::int from sk where sk.cls = co.c),
                  'areas', coalesce((select to_jsonb(array_agg(distinct sk.area order by sk.area)) from sk where sk.cls = co.c), '[]'::jsonb)) order by co.o) from co),
    'bands', (select jsonb_agg(jsonb_build_object('band', bo.b,
                'states', (select case when count(distinct st.person_id) < 10 then null else count(*)::int end from st where st.band = bo.b),
                'people', (select case when count(distinct st.person_id) < 10 then null else count(distinct st.person_id)::int end from st where st.band = bo.b)) order by bo.o) from bo),
    'by_class', coalesce((select jsonb_agg(jsonb_build_object('cls', c.cls, 'band', c.band, 'states', case when c.pp < 10 then null else c.n end, 'suppressed', c.pp < 10) order by co.o, bo.o)
                 from cells c join co on co.c = c.cls join bo on bo.b = c.band), '[]'::jsonb),
    'by_area', coalesce((select jsonb_agg(jsonb_build_object('area', c.area, 'band', c.band, 'states', case when c.pp < 10 then null else c.n end, 'suppressed', c.pp < 10) order by c.area collate "C", bo.o)
                 from acells c join bo on bo.b = c.band), '[]'::jsonb),
    'ageing', (select jsonb_build_object('states', case when count(distinct st.person_id) < 10 then null else count(*)::int end,
                                         'people', case when count(distinct st.person_id) < 10 then null else count(distinct st.person_id)::int end) from st where st.ageing),
    'backfill', jsonb_build_object(
      'awards', (select count(*)::int from aw),
      'with_evidence', (select count(*)::int from aw where exists (select 1 from kafaa_skill_evidence e where e.ref_table = 'microcred_awards' and e.ref_id = aw.id)),
      'evidence_rows', (select count(*)::int from kafaa_skill_evidence e where e.ref_table = 'microcred_awards')),
    'last_change', v_last,
    'preview', v_preview)
  into v;
  return v;
end $$;

-- Read RPC: platform admins and auditors (integrations A/R), the training manager (skills_profile A) and HR (skills_profile Agg).
create or replace function kafaa_skill_confidence_stats(p_hl jsonb default null) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not (kafaa_has_grant('integrations', array['R', 'A']) or kafaa_has_grant('skills_profile', array['A', 'Agg'])) then
    raise exception 'Kafa''a · skill confidence statistics are aggregate-only and restricted' using errcode = '42501';
  end if;
  if p_hl is not null and jsonb_typeof(p_hl) <> 'object' then raise exception 'Kafa''a · the preview takes an object of half-lives' using errcode = '22023'; end if;
  return kafaa_fs03_stats(case when p_hl is null then null else (select coalesce(jsonb_object_agg(w.key, w.value), '{}'::jsonb) from jsonb_each(p_hl) w
                                                                  where w.key in ('half_life_fast', 'half_life_months', 'half_life_slow') and jsonb_typeof(w.value) = 'number') end, current_date);
end $$;

-- RPC: platform admins set the three half-lives with a rationale; logged as an engine change (cards, ledger) and every state recomputed.
create or replace function kafaa_set_skill_half_lives(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_role text := kafaa_acting_role('integrations', array['A']); v_why text := btrim(coalesce(p ->> 'rationale', ''), E' \t\r\n');
  v_f numeric; v_s numeric; v_l numeric; v_cur kafaa_engine_settings; v_after jsonb; v_before jsonb; r jsonb; v_rec jsonb; v_moved integer; v_down integer; v_up integer;
begin
  if kafaa_me() is null then return kafaa_refuse('skills.half_lives', 'engine_settings', 'skills', 'not_signed_in', 'Sign in to change the skill half-lives'); end if;
  if v_role is null then return kafaa_refuse('skills.half_lives', 'engine_settings', 'skills', 'forbidden', 'Only a platform admin may change the skill half-lives'); end if;
  if jsonb_typeof(p -> 'fast') <> 'number' or jsonb_typeof(p -> 'standard') <> 'number' or jsonb_typeof(p -> 'slow') <> 'number' then
    return kafaa_refuse('skills.half_lives', 'engine_settings', 'skills', 'invalid', 'Half-lives are whole months from 6 to 120, and fast may not be longer than standard, nor standard longer than slow', v_role);
  end if;
  v_f := (p ->> 'fast')::numeric; v_s := (p ->> 'standard')::numeric; v_l := (p ->> 'slow')::numeric;
  if v_f <> trunc(v_f) or v_s <> trunc(v_s) or v_l <> trunc(v_l) or least(v_f, v_s, v_l) < 6 or greatest(v_f, v_s, v_l) > 120 or v_f > v_s or v_s > v_l then
    return kafaa_refuse('skills.half_lives', 'engine_settings', 'skills', 'invalid', 'Half-lives are whole months from 6 to 120, and fast may not be longer than standard, nor standard longer than slow', v_role);
  end if;
  if char_length(v_why) < 10 or char_length(v_why) > 500 then
    return kafaa_refuse('skills.half_lives', 'engine_settings', 'skills', 'invalid', 'Give a rationale of 10 to 500 characters: it is shown in the change log', v_role);
  end if;
  select * into v_cur from kafaa_engine_settings where id = 'skills';
  if (kafaa_skill_hl_months(null) ->> 'fast')::numeric = v_f and (kafaa_skill_hl_months(null) ->> 'standard')::numeric = v_s and (kafaa_skill_hl_months(null) ->> 'slow')::numeric = v_l then
    return kafaa_refuse('skills.half_lives', 'engine_settings', 'skills', 'no_change', 'Nothing changed: the half-lives are already set this way', v_role);
  end if;
  v_after := coalesce(v_cur.weights, '{}'::jsonb) || jsonb_build_object('half_life_fast', v_f, 'half_life_months', v_s, 'half_life_slow', v_l);
  select coalesce(jsonb_object_agg(ps.id, jsonb_build_array(ps.level, ps.confidence_band)), '{}'::jsonb) into v_before from kafaa_person_skills ps where ps.active;
  r := kafaa_engine_apply_change('skills', coalesce(v_cur.engine, 'deterministic'), v_after, v_why, v_role, 'Half-lives saved and every skill state recomputed');
  v_rec := kafaa_skills_apply(null, current_date);
  select count(*)::int, count(*) filter (where ps.level < (v_before -> ps.id ->> 0)::integer)::int, count(*) filter (where ps.level > (v_before -> ps.id ->> 0)::integer)::int
    into v_moved, v_down, v_up
  from kafaa_person_skills ps where ps.active and v_before ? ps.id
    and (ps.confidence_band <> (v_before -> ps.id ->> 1) or ps.level <> (v_before -> ps.id ->> 0)::integer);
  return jsonb_set(r, '{data}', coalesce(r -> 'data', '{}'::jsonb) || jsonb_build_object('months', jsonb_build_object('fast', v_f, 'standard', v_s, 'slow', v_l),
    'recompute', v_rec, 'moved', v_moved, 'level_down', v_down, 'level_up', v_up));
end $$;

-- ───────────── Grants
revoke execute on function kafaa_skill_hl_resolve(jsonb), kafaa_skill_hl_months(jsonb), kafaa_skill_decay_class(text, text), kafaa_skill_blend(float8[]),
  kafaa_skill_interval(float8, float8), kafaa_skill_band(float8), kafaa_skill_states_v2(text, date, jsonb), kafaa_skill_states_compute(text, date),
  kafaa_skills_apply(text, date), kafaa_engine_check(text, text, jsonb, text), kafaa_fs03_backfill_award_evidence(), kafaa_fs03_stats(jsonb, date) from public, anon, authenticated;
revoke execute on function kafaa_skill_confidence_stats(jsonb), kafaa_set_skill_half_lives(jsonb) from public, anon;
grant execute on function kafaa_skill_confidence_stats(jsonb), kafaa_set_skill_half_lives(jsonb) to authenticated;
