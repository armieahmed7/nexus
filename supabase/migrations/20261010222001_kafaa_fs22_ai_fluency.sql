-- [FS wave B · E2 · FS09 + FS10] AI Fluency Ladder and AI and Digital Fitness Check (M29 AI and Digital Fluency).
-- FS09: a four-rung literacy ladder (Aware, Practitioner, Builder, Assurer) across the four UNESCO AI competency dimensions; the rung
--   is computed from F01 person skill states by kafaa_ai_rung (mirror of aiRung in src/modules/m29/fluency.ts); only literacy-track
--   skills count, AI-engineering skills never raise the rung; role targets for all 20 job families; HR aggregate suppressed under 10.
-- FS10: an adaptive 18-20 item diagnostic over the five DigComp areas (safety and problem solving weighted 1.5) and the four AI
--   dimensions; routing, scoring and the item key stay server-side (kafaa_fit_*, mirror of src/modules/m29/fitness.ts); the result is
--   written as F01 `assessment` evidence (ref_table fitness_attempts) capped at level 2; one check per quarter; organisation indicator
--   "% of staff above basic" suppressed under 10.
-- Shared redefinition (same signatures): kafaa_skill_states_v2 and kafaa_skills_apply (FS03) treat assessment rows with
--   ref_table = 'fitness_attempts' as recorded evidence (kept on recompute), like rating, ojt and credential rows. TS mirror:
--   isRecordedEvidence / isDerivedEvidence in src/domain/skills.ts. Nothing else in either function changes.
-- PGlite parity and checks: scripts/validate/fs22-ai-fluency.mjs.
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file; RLS created once (never dropped).

-- ───────────── Tables (generated DDL, additive)
create table if not exists kafaa_ai_rungs (
  id text primary key,
  rung integer not null,
  rung_key text not null check (rung_key in ('aware', 'practitioner', 'builder', 'assurer')),
  dimension text not null check (dimension in ('mindset', 'ethics', 'techniques', 'design')),
  name_en text not null,
  name_ar text not null,
  essence_en text not null,
  essence_ar text not null,
  descriptor_en text not null,
  descriptor_ar text not null,
  example_en text not null,
  example_ar text not null,
  skill_ids text[] not null default '{}'::text[],
  min_level integer not null,
  learning jsonb not null default '[]'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  sort integer not null default 0
);
comment on table kafaa_ai_rungs is '[M29] AI fluency ladder cell: one rung (Aware, Practitioner, Builder, Assurer) x one UNESCO dimension, with plant examples and the literacy skills that evidence it (FS09)';

create table if not exists kafaa_ai_skill_tracks (
  id text primary key,
  skill_id text not null unique,
  track text not null check (track in ('literacy', 'engineering')),
  rationale_en text not null,
  rationale_ar text not null,
  sort integer not null default 0
);
comment on table kafaa_ai_skill_tracks is '[M29] Whether an AI or digital skill counts as AI literacy (everyone, raises the rung) or AI engineering (specialists, shown apart) (FS09)';

create table if not exists kafaa_ai_role_targets (
  id text primary key,
  family_id text not null unique,
  rung integer not null,
  plus_cells text[] not null default '{}'::text[],
  fitness_target integer not null,
  rationale_en text not null,
  rationale_ar text not null,
  sort integer not null default 0
);
comment on table kafaa_ai_role_targets is '[M29] AI fluency target per job family: a rung plus optional cells from a higher rung, and the fitness-check score the family aims for (FS09/FS10)';

create table if not exists kafaa_ai_org_targets (
  id text primary key,
  metric text not null check (metric in ('practitioner_or_above', 'above_basic')),
  pct numeric not null,
  due_on date not null,
  basis_en text not null,
  basis_ar text not null,
  set_by_en text not null,
  set_by_ar text not null,
  benchmark_ids text[] not null default '{}'::text[],
  sources jsonb not null default '[]'::jsonb,
  as_of date not null
);
comment on table kafaa_ai_org_targets is '[M29] Dated organisation AI-fluency target set by leadership: a demo parameter shown beside the measured value, never a claim (FS09)';

create table if not exists kafaa_fitness_areas (
  id text primary key,
  framework text not null check (framework in ('digcomp', 'ai')),
  code text not null,
  name_en text not null,
  name_ar text not null,
  summary_en text not null,
  summary_ar text not null,
  weight numeric not null default 1,
  skill_ids text[] not null default '{}'::text[],
  dimension text check (dimension in ('mindset', 'ethics', 'techniques', 'design')),
  sources jsonb not null default '[]'::jsonb,
  sort integer not null default 0
);
comment on table kafaa_fitness_areas is '[M29] Fitness-check area: the five DigComp areas and the four AI dimensions, with weight and the skills its evidence goes to (FS10)';

create table if not exists kafaa_fitness_items (
  id text primary key,
  area_id text not null,
  difficulty integer not null,
  stem_en text not null,
  stem_ar text not null,
  options_en text[] not null default '{}'::text[],
  options_ar text[] not null default '{}'::text[],
  correct integer not null,
  explain_en text not null default '',
  explain_ar text not null default '',
  status text not null default 'active' check (status in ('active', 'retired')),
  version integer not null default 1,
  sort integer not null default 0,
  updated_by text,
  updated_at timestamptz not null default now()
);
comment on table kafaa_fitness_items is '[M29] Fitness-check item bank (EN/AR, difficulty 1-3, answer key): read by training staff only, served to takers without the key by the RPCs (FS10)';

create table if not exists kafaa_fitness_attempts (
  id text primary key,
  person_id text not null,
  period text not null,
  attempt_no integer not null,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  responses jsonb not null default '[]'::jsonb,
  current_item_id text,
  item_count integer not null default 0,
  area_levels jsonb not null default '{}'::jsonb,
  score integer,
  band text check (band in ('limited', 'basic', 'above_basic', 'advanced')),
  reasons jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb
);
comment on table kafaa_fitness_attempts is '[M29] One person''s fitness-check attempt in a quarter: answers in order, area levels, score, band and the capped evidence it wrote (FS10)';

do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_ai_skill_tracks_skill_id_fk') then alter table kafaa_ai_skill_tracks add constraint kafaa_ai_skill_tracks_skill_id_fk foreign key (skill_id) references kafaa_skills(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_ai_role_targets_family_id_fk') then alter table kafaa_ai_role_targets add constraint kafaa_ai_role_targets_family_id_fk foreign key (family_id) references kafaa_job_families(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_fitness_items_area_id_fk') then alter table kafaa_fitness_items add constraint kafaa_fitness_items_area_id_fk foreign key (area_id) references kafaa_fitness_areas(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_fitness_attempts_person_id_fk') then alter table kafaa_fitness_attempts add constraint kafaa_fitness_attempts_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_ai_rungs_dimension_idx on kafaa_ai_rungs (dimension);
create index if not exists kafaa_ai_skill_tracks_track_idx on kafaa_ai_skill_tracks (track);
create index if not exists kafaa_fitness_items_area_id_idx on kafaa_fitness_items (area_id);
create index if not exists kafaa_fitness_items_status_idx on kafaa_fitness_items (status);
create index if not exists kafaa_fitness_attempts_person_id_idx on kafaa_fitness_attempts (person_id);
create index if not exists kafaa_fitness_attempts_period_idx on kafaa_fitness_attempts (period);
create index if not exists kafaa_fitness_attempts_status_idx on kafaa_fitness_attempts (status);

-- ───────────── RLS (generated rules; policies created once, never dropped)
do $$ begin
  execute 'alter table kafaa_ai_rungs enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_ai_rungs' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_ai_rungs for select to anon, authenticated using (kafaa_rule_read(''public_content'', null::text, null::text, true))'; end if;
  execute 'alter table kafaa_ai_skill_tracks enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_ai_skill_tracks' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_ai_skill_tracks for select to anon, authenticated using (kafaa_rule_read(''public_content'', null::text, null::text, true))'; end if;
  execute 'alter table kafaa_ai_role_targets enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_ai_role_targets' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_ai_role_targets for select to anon, authenticated using (kafaa_rule_read(''public_content'', null::text, null::text, true))'; end if;
  execute 'alter table kafaa_ai_org_targets enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_ai_org_targets' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_ai_org_targets for select to anon, authenticated using (kafaa_has_grant(''ai_literacy'', array[''Agg'',''R'',''W'',''A'']))'; end if;
  execute 'alter table kafaa_fitness_areas enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_fitness_areas' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_fitness_areas for select to anon, authenticated using (kafaa_rule_read(''public_content'', null::text, null::text, true))'; end if;
  execute 'alter table kafaa_fitness_items enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_fitness_items' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_fitness_items for select to anon, authenticated using (kafaa_rule_read(''secure_items'', null::text, null::text, true))'; end if;
  execute 'alter table kafaa_fitness_attempts enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_fitness_attempts' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_fitness_attempts for select to anon, authenticated using (kafaa_rule_read(''own_profile'', person_id, null::text, true))'; end if;
end $$;
revoke insert, update, delete on kafaa_ai_rungs, kafaa_ai_skill_tracks, kafaa_ai_role_targets, kafaa_ai_org_targets, kafaa_fitness_areas, kafaa_fitness_items, kafaa_fitness_attempts from anon, authenticated;
grant select on kafaa_ai_rungs, kafaa_ai_skill_tracks, kafaa_ai_role_targets, kafaa_ai_org_targets, kafaa_fitness_areas, kafaa_fitness_items, kafaa_fitness_attempts to anon, authenticated;

-- ───────────── FS03 skill states: fitness-check assessment rows are recorded evidence (shared redefinition, same signatures)
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
    where e.active and (e.kind in ('rating', 'ojt', 'credential') or e.ref_table = 'fitness_attempts') and (p_person is null or e.person_id = p_person)
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
  where e.active and e.kind in ('qual', 'course', 'assessment', 'jpm') and e.ref_table <> 'fitness_attempts' and (p_person is null or e.person_id = p_person)
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

-- ───────────── FS09 rule: the literacy rung of one person (mirror of aiRung in src/modules/m29/fluency.ts)
create or replace function kafaa_ai_rung(p_person text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  c record; b record; v_have integer; v_cells jsonb := '[]'::jsonb; v_mins jsonb := '{}'::jsonb; v_rung integer := 0; r integer; v_upto integer;
  v_reasons jsonb; x jsonb; v_next jsonb := null; v_eng jsonb; v_missing jsonb := '[]'::jsonb;
begin
  for c in select a.id, a.rung, a.dimension, a.skill_ids, a.min_level from kafaa_ai_rungs a
           order by a.rung, coalesce(array_position(array['mindset', 'ethics', 'techniques', 'design'], a.dimension), 99), a.id collate "C"
  loop
    select coalesce(max(ps.level), 0) into v_have
      from unnest(c.skill_ids) s(sid)
      join kafaa_ai_skill_tracks t on t.skill_id = s.sid and t.track = 'literacy'
      join kafaa_person_skills ps on ps.person_id = p_person and ps.skill_id = s.sid and ps.active and ps.level > 0 and ps.basis <> 'claimed';
    select s.sid, ps.level, ps.reasons -> 0 ->> 'evidence_id' as ev into b
      from unnest(c.skill_ids) with ordinality s(sid, i)
      join kafaa_ai_skill_tracks t on t.skill_id = s.sid and t.track = 'literacy'
      join kafaa_person_skills ps on ps.person_id = p_person and ps.skill_id = s.sid and ps.active and ps.level > 0 and ps.basis <> 'claimed'
      where ps.level >= c.min_level
      order by ps.level desc, s.i
      limit 1;
    if found then
      v_cells := v_cells || jsonb_build_array(jsonb_build_object('id', c.id, 'rung', c.rung, 'dimension', c.dimension, 'met', true, 'have', v_have,
        'skill_id', b.sid, 'level', b.level, 'evidence_id', b.ev));
    else
      v_cells := v_cells || jsonb_build_array(jsonb_build_object('id', c.id, 'rung', c.rung, 'dimension', c.dimension, 'met', false, 'have', v_have,
        'skill_id', null, 'level', null, 'evidence_id', null));
    end if;
    v_mins := v_mins || jsonb_build_object(c.id, c.min_level);
  end loop;
  for r in 1..4 loop
    if (select count(*) from jsonb_array_elements(v_cells) e where (e ->> 'rung')::integer = r) = 4
       and not exists (select 1 from jsonb_array_elements(v_cells) e where (e ->> 'rung')::integer = r and not (e ->> 'met')::boolean) then
      v_rung := r;
    else
      exit;
    end if;
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('skill_id', ps.skill_id, 'level', ps.level) order by ps.skill_id collate "C"), '[]'::jsonb) into v_eng
    from kafaa_person_skills ps join kafaa_ai_skill_tracks t on t.skill_id = ps.skill_id and t.track = 'engineering'
    where ps.person_id = p_person and ps.active and ps.level > 0 and ps.basis <> 'claimed';
  v_reasons := jsonb_build_array(jsonb_build_object('code', 'fs09_rung', 'key', 'm29.reason.rung', 'vars', jsonb_build_object('rung', v_rung)));
  v_upto := least(v_rung + 1, 4);
  for x in select e from jsonb_array_elements(v_cells) e loop
    if (x ->> 'met')::boolean and (x ->> 'rung')::integer <= v_upto then
      v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'fs09_cell_met', 'key', 'm29.reason.met.' || (x ->> 'dimension'),
        'vars', jsonb_build_object('rung', (x ->> 'rung')::integer, 'level', coalesce((x ->> 'level')::integer, 0)),
        'ref', case when x ->> 'evidence_id' is not null then jsonb_build_object('table', 'skill_evidence', 'id', x ->> 'evidence_id')
                    else jsonb_build_object('table', 'person_skills', 'id', 'ps:' || p_person || ':' || (x ->> 'skill_id')) end));
    end if;
  end loop;
  if v_rung < 4 then
    for x in select e from jsonb_array_elements(v_cells) e loop
      if (x ->> 'rung')::integer = v_rung + 1 and not (x ->> 'met')::boolean then
        v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'fs09_cell_gap', 'key', 'm29.reason.gap.' || (x ->> 'dimension'),
          'vars', jsonb_build_object('rung', (x ->> 'rung')::integer, 'level', (v_mins ->> (x ->> 'id'))::integer)));
        v_missing := v_missing || jsonb_build_array(x ->> 'id');
      end if;
    end loop;
    v_next := jsonb_build_object('rung', v_rung + 1, 'missing', v_missing);
  end if;
  if jsonb_array_length(v_eng) > 0 then
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'fs09_engineering', 'key', 'm29.reason.engineering', 'vars', jsonb_build_object('n', jsonb_array_length(v_eng))));
  end if;
  return jsonb_build_object('rung', v_rung, 'cells', v_cells, 'next', v_next, 'engineering', v_eng, 'reasons', v_reasons);
end $$;

-- Target gap (mirror of targetGap): met = rung >= target rung and every extra cell met; missing = unmet cells up to the target rung + extra cells.
create or replace function kafaa_ai_target_gap(p_res jsonb, p_family text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t kafaa_ai_role_targets;
begin
  select * into t from kafaa_ai_role_targets where family_id = p_family limit 1;
  if t.id is null then return jsonb_build_object('met', false, 'missing', '[]'::jsonb); end if;
  return jsonb_build_object(
    'met', (p_res ->> 'rung')::integer >= t.rung and not exists (select 1 from unnest(t.plus_cells) pc(id)
      where not exists (select 1 from jsonb_array_elements(p_res -> 'cells') e where e ->> 'id' = pc.id and (e ->> 'met')::boolean)),
    'missing', coalesce((select jsonb_agg(e ->> 'id' order by i) from jsonb_array_elements(p_res -> 'cells') with ordinality q(e, i)
      where not (e ->> 'met')::boolean and ((e ->> 'rung')::integer <= t.rung or (e ->> 'id') = any(t.plus_cells))), '[]'::jsonb));
end $$;

-- ───────────── RPC: my AI fluency (ai_literacy Own)
create or replace function kafaa_ai_fluency() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); v_fam text; v_res jsonb; v_gap jsonb; t kafaa_ai_role_targets;
begin
  if me is null or not kafaa_has_grant('ai_literacy', array['Own']) then return null; end if;
  select job_family_id into v_fam from kafaa_people where id = me;
  v_res := kafaa_ai_rung(me);
  v_gap := kafaa_ai_target_gap(v_res, v_fam);
  select * into t from kafaa_ai_role_targets where family_id = v_fam limit 1;
  return jsonb_build_object('person_id', me, 'family_id', v_fam, 'result', v_res,
    'target', case when t.id is null then null else jsonb_build_object('rung', t.rung, 'plus_cells', to_jsonb(coalesce(t.plus_cells, '{}'::text[])), 'fitness_target', t.fitness_target,
      'rationale_en', t.rationale_en, 'rationale_ar', t.rationale_ar) end,
    'target_met', (v_gap ->> 'met')::boolean, 'target_missing', v_gap -> 'missing');
end $$;

-- ───────────── RPC: HR aggregate of rungs (ai_literacy Agg; mirror of rungStats with MIN_GROUP_SIZE 10)
create or replace function kafaa_ai_fluency_stats() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); v jsonb;
begin
  if me is null or not kafaa_has_grant('ai_literacy', array['Agg']) then return null; end if;
  with x as (
    select p.id as person_id, p.job_family_id as family_id, kafaa_ai_rung(p.id) as res from kafaa_people p where p.kind = 'staff' and p.status = 'active'
  ), t as (
    select person_id, family_id, (res ->> 'rung')::integer as rung, (kafaa_ai_target_gap(res, family_id) ->> 'met')::boolean as target_met from x
  ), tot as (
    select count(*)::integer n, count(*) filter (where rung >= 2)::integer prac, count(*) filter (where target_met)::integer tgt from t
  )
  select jsonb_build_object(
    'staff', tot.n,
    'distribution', (select jsonb_agg(jsonb_build_object('rung', g.r, 'n', case when tot.n >= 10 and g.c >= 10 then g.c else null end) order by g.r)
      from (select r, (select count(*) from t where t.rung = r)::integer c from generate_series(0, 4) r) g),
    'practitioner', jsonb_build_object('n', case when tot.n >= 10 and tot.prac >= 10 then tot.prac else null end,
      'pct', case when tot.n >= 10 then floor(1000.0::float8 * tot.prac / tot.n + 0.5) / 10 else null end),
    'target', jsonb_build_object('n', case when tot.n >= 10 and tot.tgt >= 10 then tot.tgt else null end,
      'pct', case when tot.n >= 10 then floor(1000.0::float8 * tot.tgt / tot.n + 0.5) / 10 else null end),
    'by_family', coalesce((select jsonb_agg(jsonb_build_object('family_id', f.family_id,
        'n', case when f.c >= 10 then f.c else null end,
        'pct_practitioner', case when f.c >= 10 then floor(1000.0::float8 * f.p / f.c + 0.5) / 10 else null end,
        'pct_target', case when f.c >= 10 then floor(1000.0::float8 * f.tg / f.c + 0.5) / 10 else null end) order by f.family_id collate "C")
      from (select family_id, count(*)::integer c, count(*) filter (where rung >= 2)::integer p, count(*) filter (where target_met)::integer tg
            from t where coalesce(family_id, '') <> '' and family_id not in ('security', 'safeguards', 'cyber') group by family_id) f), '[]'::jsonb),
    'org_target', (select jsonb_build_object('id', o.id, 'pct', o.pct, 'due_on', to_char(o.due_on, 'YYYY-MM-DD')) from kafaa_ai_org_targets o
      where o.metric = 'practitioner_or_above' order by o.id collate "C" limit 1))
  into v from tot;
  return v;
end $$;

-- ───────────── FS10 rules (mirror of src/modules/m29/fitness.ts)
create or replace function kafaa_fit_quarter(p_d date) returns text language sql immutable set search_path = public as $$
  select to_char(p_d, 'YYYY') || '-Q' || extract(quarter from p_d)::integer
$$;
create or replace function kafaa_fit_quarter_shift(p_q text, p_k integer) returns text language sql immutable set search_path = public as $$
  select (floor(i / 4.0))::integer || '-Q' || ((i % 4) + 1)
  from (select split_part(p_q, '-Q', 1)::integer * 4 + (split_part(p_q, '-Q', 2)::integer - 1) + p_k as i) x
$$;
create or replace function kafaa_fit_next_quarter_start(p_q text) returns text language sql immutable set search_path = public as $$
  select split_part(n, '-Q', 1) || '-' || lpad(((split_part(n, '-Q', 2)::integer - 1) * 3 + 1)::text, 2, '0') || '-01'
  from (select kafaa_fit_quarter_shift(p_q, 1) as n) x
$$;

-- nextStep: phase 1 every area at difficulty 2; phase 2 a second item (3 after right, 1 after wrong); phase 3 weighted split areas confirm.
create or replace function kafaa_fit_next(p_resp jsonb) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare a record; v_cnt integer; v_c1 boolean; v_c2 boolean; v_d2 integer;
begin
  if jsonb_array_length(coalesce(p_resp, '[]'::jsonb)) >= 20 then return null; end if;
  for a in select id from kafaa_fitness_areas order by sort, id collate "C" loop
    if not exists (select 1 from jsonb_array_elements(coalesce(p_resp, '[]'::jsonb)) e where e ->> 'area_id' = a.id) then
      return jsonb_build_object('area_id', a.id, 'difficulty', 2, 'phase', 1);
    end if;
  end loop;
  for a in select id from kafaa_fitness_areas order by sort, id collate "C" loop
    select count(*), (array_agg((e ->> 'correct')::boolean order by i))[1] into v_cnt, v_c1
      from jsonb_array_elements(p_resp) with ordinality q(e, i) where e ->> 'area_id' = a.id;
    if v_cnt = 1 then return jsonb_build_object('area_id', a.id, 'difficulty', case when v_c1 then 3 else 1 end, 'phase', 2); end if;
  end loop;
  for a in select id from kafaa_fitness_areas where weight > 1 order by sort, id collate "C" loop
    select count(*), (array_agg((e ->> 'correct')::boolean order by i))[1], (array_agg((e ->> 'correct')::boolean order by i))[2], (array_agg((e ->> 'difficulty')::integer order by i))[2]
      into v_cnt, v_c1, v_c2, v_d2
      from jsonb_array_elements(p_resp) with ordinality q(e, i) where e ->> 'area_id' = a.id;
    if v_cnt = 2 and v_c1 <> v_c2 then return jsonb_build_object('area_id', a.id, 'difficulty', v_d2, 'phase', 3); end if;
  end loop;
  return null;
end $$;

-- areaLevel: answers of one area in order -> level 0-3 (null when unanswered)
create or replace function kafaa_fit_area_level(p_rs jsonb, p_weighted boolean) returns integer language plpgsql immutable set search_path = public as $$
declare n integer := jsonb_array_length(coalesce(p_rs, '[]'::jsonb)); c1 boolean; c2 boolean; c3 boolean;
begin
  if n = 0 then return null; end if;
  c1 := (p_rs -> 0 ->> 'correct')::boolean;
  if n = 1 then return case when c1 then 2 else 0 end; end if;
  c2 := (p_rs -> 1 ->> 'correct')::boolean;
  if p_weighted and n >= 3 and c1 <> c2 then
    c3 := (p_rs -> 2 ->> 'correct')::boolean;
    return case when c1 then case when c3 then 3 else 2 end else case when c3 then 1 else 0 end end;
  end if;
  return case when c1 then case when c2 then 3 else 2 end else case when c2 then 1 else 0 end end;
end $$;

create or replace function kafaa_fit_band(p_score integer) returns text language sql immutable set search_path = public as $$
  select case when p_score >= 75 then 'advanced' when p_score >= 50 then 'above_basic' when p_score >= 25 then 'basic' else 'limited' end
$$;

-- scoreAttempt: area levels, score, band, capped evidence (level <= 2) and reasons
create or replace function kafaa_fit_score(p_resp jsonb) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare a record; v_rs jsonb; v_cnt integer; l integer; v_levels jsonb := '{}'::jsonb; v_num float8 := 0; v_den float8 := 0; v_best jsonb := '{}'::jsonb; s text;
  v_area_r jsonb := '[]'::jsonb; v_score integer; v_band text; v_ev jsonb; v_cap boolean := false; v_reasons jsonb;
begin
  for a in select id, weight, skill_ids, name_en, name_ar from kafaa_fitness_areas order by sort, id collate "C" loop
    select coalesce(jsonb_agg(e order by i), '[]'::jsonb), count(*) into v_rs, v_cnt from jsonb_array_elements(coalesce(p_resp, '[]'::jsonb)) with ordinality q(e, i) where e ->> 'area_id' = a.id;
    l := coalesce(kafaa_fit_area_level(v_rs, a.weight > 1), 0);
    v_levels := v_levels || jsonb_build_object(a.id, l);
    v_num := v_num + a.weight::float8 * l;
    v_den := v_den + a.weight::float8 * 3;
    if l > 2 then v_cap := true; end if;
    foreach s in array coalesce(a.skill_ids, '{}'::text[]) loop
      v_best := v_best || jsonb_build_object(s, greatest(coalesce((v_best ->> s)::integer, 0), least(2, l)));
    end loop;
    v_area_r := v_area_r || jsonb_build_array(jsonb_build_object('code', 'fs10_area', 'key', 'm29.fit.reason.level' || l, 'vars', jsonb_build_object('area', jsonb_build_object('en', a.name_en, 'ar', a.name_ar))));
    if a.weight > 1 and v_cnt >= 3 then
      v_area_r := v_area_r || jsonb_build_array(jsonb_build_object('code', 'fs10_confirmed', 'key', 'm29.fit.reason.confirmed', 'vars', jsonb_build_object('area', jsonb_build_object('en', a.name_en, 'ar', a.name_ar))));
    end if;
  end loop;
  v_score := case when v_den > 0 then floor(100 * v_num / v_den + 0.5)::integer else 0 end;
  v_band := kafaa_fit_band(v_score);
  v_reasons := jsonb_build_array(jsonb_build_object('code', 'fs10_score', 'key', 'm29.fit.reason.band.' || v_band,
    'vars', jsonb_build_object('score', v_score, 'n', jsonb_array_length(coalesce(p_resp, '[]'::jsonb))))) || v_area_r;
  if v_cap then v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'fs10_cap', 'key', 'm29.fit.reason.cap', 'vars', jsonb_build_object('level', 2))); end if;
  select coalesce(jsonb_agg(jsonb_build_object('skill_id', k, 'level', v::integer) order by k collate "C"), '[]'::jsonb) into v_ev
    from jsonb_each_text(v_best) x(k, v) where v::integer >= 1;
  return jsonb_build_object('levels', v_levels, 'score', v_score, 'band', v_band, 'evidence', v_ev, 'reasons', v_reasons);
end $$;

-- pickItem: active items of the area and difficulty not used yet, ordered (sort, id), index attempt_no mod count
create or replace function kafaa_fit_pick(p_area text, p_diff integer, p_used text[], p_no integer) returns text language plpgsql stable security definer set search_path = public as $$
declare ids text[]; n integer;
begin
  select array_agg(i.id order by i.sort, i.id collate "C") into ids from kafaa_fitness_items i
    where i.status = 'active' and i.area_id = p_area and i.difficulty = p_diff and not (i.id = any(coalesce(p_used, '{}'::text[])));
  n := coalesce(array_length(ids, 1), 0);
  if n = 0 then return null; end if;
  return ids[((p_no % n) + n) % n + 1];
end $$;

create or replace function kafaa_fit_item_view(p_id text) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', i.id, 'area_id', i.area_id, 'difficulty', i.difficulty, 'stem_en', i.stem_en, 'stem_ar', i.stem_ar,
    'options_en', to_jsonb(i.options_en), 'options_ar', to_jsonb(i.options_ar)) from kafaa_fitness_items i where i.id = p_id
$$;

-- Organisation indicator (mirror of fitnessStats with MIN_GROUP_SIZE 10): latest completed attempt per active staff member in the
-- current quarter and the three before it.
create or replace function kafaa_fit_stats_core(p_today date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_q text := kafaa_fit_quarter(p_today); v_win text[]; v jsonb;
begin
  v_win := array[kafaa_fit_quarter_shift(v_q, -3), kafaa_fit_quarter_shift(v_q, -2), kafaa_fit_quarter_shift(v_q, -1), v_q];
  with staff as (
    select id, job_family_id from kafaa_people where kind = 'staff' and status = 'active'
  ), done as (
    select a.id, a.person_id, a.period, a.score, a.band, a.area_levels, a.completed_at, s.job_family_id as family_id
    from kafaa_fitness_attempts a join staff s on s.id = a.person_id where a.status = 'completed' and a.period = any(v_win)
  ), latest as (
    select distinct on (person_id) * from done order by person_id, completed_at desc, id desc
  ), tot as (
    select (select count(*) from staff)::integer staff, count(*)::integer tested, count(*) filter (where band in ('above_basic', 'advanced'))::integer above,
           coalesce(sum(score), 0)::float8 ssum from latest
  )
  select jsonb_build_object(
    'quarter', v_q, 'window', to_jsonb(v_win), 'staff', tot.staff, 'tested', tot.tested,
    'coverage_pct', case when tot.staff >= 10 and tot.tested >= 10 then floor((100 * tot.tested)::float8 / tot.staff * 10 + 0.5) / 10 else null end,
    'above_basic', case when tot.tested >= 10 and tot.above >= 10 then tot.above else null end,
    'pct_above_basic', case when tot.tested >= 10 then floor((100 * tot.above)::float8 / tot.tested * 10 + 0.5) / 10 else null end,
    'avg_score', case when tot.tested >= 10 then floor(tot.ssum / tot.tested * 10 + 0.5) / 10 else null end,
    'bands', (select jsonb_agg(jsonb_build_object('band', b.band, 'n', case when tot.tested >= 10 and b.c >= 10 then b.c else null end) order by b.o)
      from (select bb.band, bb.o, (select count(*) from latest l where l.band = bb.band)::integer c
            from (values ('limited', 1), ('basic', 2), ('above_basic', 3), ('advanced', 4)) bb(band, o)) b),
    'trend', (select jsonb_agg(jsonb_build_object('quarter', w.q, 'n', case when g.c >= 10 then g.c else null end,
        'pct_above_basic', case when g.c >= 10 then floor((100 * g.ab)::float8 / g.c * 10 + 0.5) / 10 else null end,
        'avg_score', case when g.c >= 10 then floor(g.s / g.c * 10 + 0.5) / 10 else null end) order by w.o)
      from unnest(v_win) with ordinality w(q, o)
      cross join lateral (
        select count(*)::integer c, count(*) filter (where z.band in ('above_basic', 'advanced'))::integer ab, coalesce(sum(z.score), 0)::float8 s
        from (select distinct on (d.person_id) d.person_id, d.band, d.score from done d where d.period = w.q order by d.person_id, d.completed_at desc, d.id desc) z) g),
    'by_family', coalesce((select jsonb_agg(jsonb_build_object('family_id', f.family_id, 'n', case when f.c >= 10 then f.c else null end,
        'pct_above_basic', case when f.c >= 10 then floor((100 * f.ab)::float8 / f.c * 10 + 0.5) / 10 else null end,
        'avg_score', case when f.c >= 10 then floor(f.s / f.c * 10 + 0.5) / 10 else null end) order by f.family_id collate "C")
      from (select family_id, count(*)::integer c, count(*) filter (where band in ('above_basic', 'advanced'))::integer ab, sum(score)::float8 s
            from latest where coalesce(family_id, '') <> '' and family_id not in ('security', 'safeguards', 'cyber') group by family_id) f), '[]'::jsonb),
    'by_area', (select coalesce(jsonb_agg(jsonb_build_object('area_id', ar.id,
        'avg_level', case when tot.tested >= 10 then floor((select sum(coalesce((l.area_levels ->> ar.id)::integer, 0)) from latest l)::float8 / tot.tested * 100 + 0.5) / 100 else null end)
        order by ar.sort, ar.id collate "C"), '[]'::jsonb) from kafaa_fitness_areas ar))
  into v from tot;
  return v;
end $$;

-- Item checks (mirror of itemProblem): first problem code or null
create or replace function kafaa_fit_item_problem(p jsonb) returns text language plpgsql stable security definer set search_path = public as $$
declare oe jsonb := case when jsonb_typeof(p -> 'options_en') = 'array' then p -> 'options_en' else '[]'::jsonb end;
  oa jsonb := case when jsonb_typeof(p -> 'options_ar') = 'array' then p -> 'options_ar' else '[]'::jsonb end;
  v_all text; se text; sa text;
begin
  if not exists (select 1 from kafaa_fitness_areas where id = p ->> 'area_id') then return 'area'; end if;
  if jsonb_typeof(p -> 'difficulty') is distinct from 'number' or (p ->> 'difficulty')::numeric <> floor((p ->> 'difficulty')::numeric)
     or (p ->> 'difficulty')::numeric not between 1 and 3 then return 'difficulty'; end if;
  se := case when jsonb_typeof(p -> 'stem_en') = 'string' then btrim(p ->> 'stem_en') else '' end;
  sa := case when jsonb_typeof(p -> 'stem_ar') = 'string' then btrim(p ->> 'stem_ar') else '' end;
  if se = '' or sa = '' or length(se) > 400 or length(sa) > 400 then return 'stem'; end if;
  if jsonb_array_length(oe) < 3 or jsonb_array_length(oe) > 4 or jsonb_array_length(oe) <> jsonb_array_length(oa) then return 'options'; end if;
  if exists (select 1 from (select e from jsonb_array_elements(oe) e union all select e from jsonb_array_elements(oa) e) x
             where jsonb_typeof(x.e) <> 'string' or btrim(x.e #>> '{}') = '' or length(btrim(x.e #>> '{}')) > 200) then return 'options'; end if;
  if jsonb_typeof(p -> 'correct') is distinct from 'number' or (p ->> 'correct')::numeric <> floor((p ->> 'correct')::numeric)
     or (p ->> 'correct')::numeric < 0 or (p ->> 'correct')::numeric >= jsonb_array_length(oe) then return 'correct'; end if;
  v_all := lower(concat_ws(' ', p ->> 'stem_en', p ->> 'stem_ar',
    (select string_agg(e #>> '{}', ' ' order by i) from jsonb_array_elements(oe) with ordinality q(e, i)),
    (select string_agg(e #>> '{}', ' ' order by i) from jsonb_array_elements(oa) with ordinality q(e, i)),
    coalesce(p ->> 'explain_en', ''), coalesce(p ->> 'explain_ar', '')));
  if exists (select 1 from unnest(array['vital area', 'protected area', 'security plan', 'guard force', 'design basis threat', 'safeguards', 'physical protection',
      'alarm station', 'access code', 'firewall rule', 'network diagram', 'ip address']) w where position(w in v_all) > 0) then return 'restricted'; end if;
  return null;
end $$;

-- ───────────── RPC: start (or resume) this quarter's check
create or replace function kafaa_start_fitness() returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_q text := kafaa_fit_quarter(current_date); v_open kafaa_fitness_attempts; v_no integer; v_step jsonb; v_item text; v_id text; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('ai.fitness.start', 'fitness_attempts', null, 'not_signed_in', 'Sign in to use the AI and digital fitness check'); end if;
  if not kafaa_has_grant('ai_literacy', array['Own']) then return kafaa_refuse('ai.fitness.start', 'fitness_attempts', null, 'forbidden', 'The fitness check is for ENEC staff'); end if;
  v_role := kafaa_acting_role('ai_literacy', array['Own']);
  select * into v_open from kafaa_fitness_attempts where person_id = me and status = 'in_progress' order by started_at desc limit 1;
  if v_open.id is not null then
    a := kafaa_audit('ai.fitness.start', 'fitness_attempts', v_open.id, 'ok', 'resumed', 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Fitness check resumed', a, null, jsonb_build_object('attempt_id', v_open.id, 'done', false, 'answered', jsonb_array_length(v_open.responses),
      'max', 20, 'item', kafaa_fit_item_view(v_open.current_item_id), 'result', null, 'resumed', true));
  end if;
  if exists (select 1 from kafaa_fitness_attempts where person_id = me and status = 'completed' and period = v_q) then
    return kafaa_refuse('ai.fitness.start', 'fitness_attempts', null, 'too_soon', 'This quarter''s check is complete; the next one opens on ' || kafaa_fit_next_quarter_start(v_q), v_role);
  end if;
  select count(*) + 1 into v_no from kafaa_fitness_attempts where person_id = me;
  v_step := kafaa_fit_next('[]'::jsonb);
  v_item := kafaa_fit_pick(v_step ->> 'area_id', (v_step ->> 'difficulty')::integer, '{}'::text[], v_no);
  if v_item is null then return kafaa_refuse('ai.fitness.start', 'fitness_attempts', null, 'unavailable', 'The item bank has no active item for this step; ask the training manager', v_role); end if;
  v_id := 'fa-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
  insert into kafaa_fitness_attempts (id, person_id, period, attempt_no, status, started_at, responses, current_item_id, item_count)
  values (v_id, me, v_q, v_no, 'in_progress', now(), '[]'::jsonb, v_item, 0);
  a := kafaa_audit('ai.fitness.start', 'fitness_attempts', v_id, 'ok', v_q, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Fitness check started', a, null, jsonb_build_object('attempt_id', v_id, 'done', false, 'answered', 0, 'max', 20,
    'item', kafaa_fit_item_view(v_item), 'result', null, 'resumed', false));
end $$;

-- ───────────── RPC: answer the current item; after the stop rule, score server-side and write capped F01 evidence
create or replace function kafaa_submit_fitness(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_aid text := coalesce(p ->> 'attempt_id', ''); at kafaa_fitness_attempts; it kafaa_fitness_items; v_choice integer;
  v_resp jsonb; v_step jsonb; v_next text; v_used text[]; sc jsonb; e jsonb; v_ev text; l integer; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('ai.fitness.answer', 'fitness_attempts', nullif(v_aid, ''), 'not_signed_in', 'Sign in to use the AI and digital fitness check'); end if;
  if not kafaa_has_grant('ai_literacy', array['Own']) then return kafaa_refuse('ai.fitness.answer', 'fitness_attempts', nullif(v_aid, ''), 'forbidden', 'The fitness check is for ENEC staff'); end if;
  v_role := kafaa_acting_role('ai_literacy', array['Own']);
  select * into at from kafaa_fitness_attempts where id = v_aid for update;
  if at.id is null or at.person_id <> me then return kafaa_refuse('ai.fitness.answer', 'fitness_attempts', nullif(v_aid, ''), 'not_found', 'Attempt not found', v_role); end if;
  if at.status <> 'in_progress' then return kafaa_refuse('ai.fitness.answer', 'fitness_attempts', v_aid, 'invalid', 'This attempt is already complete', v_role); end if;
  if coalesce(p ->> 'item_id', '') = '' or p ->> 'item_id' is distinct from at.current_item_id then
    return kafaa_refuse('ai.fitness.answer', 'fitness_attempts', v_aid, 'invalid', 'Answer the item on screen first', v_role); end if;
  select * into it from kafaa_fitness_items where id = at.current_item_id;
  if it.id is null then return kafaa_refuse('ai.fitness.answer', 'fitness_attempts', v_aid, 'not_found', 'Item not found', v_role); end if;
  if jsonb_typeof(p -> 'choice') is distinct from 'number' or (p ->> 'choice')::numeric <> floor((p ->> 'choice')::numeric)
     or (p ->> 'choice')::numeric < 0 or (p ->> 'choice')::numeric >= coalesce(array_length(it.options_en, 1), 0) then
    return kafaa_refuse('ai.fitness.answer', 'fitness_attempts', v_aid, 'invalid', 'Choose one of the options', v_role); end if;
  v_choice := (p ->> 'choice')::integer;
  v_resp := at.responses || jsonb_build_array(jsonb_build_object('item_id', it.id, 'area_id', it.area_id, 'difficulty', it.difficulty, 'choice', v_choice, 'correct', v_choice = it.correct));
  v_step := kafaa_fit_next(v_resp);
  if v_step is not null then
    select array_agg(q.r ->> 'item_id') into v_used from jsonb_array_elements(v_resp) q(r);
    v_next := kafaa_fit_pick(v_step ->> 'area_id', (v_step ->> 'difficulty')::integer, v_used, at.attempt_no);
  end if;
  if v_next is not null then
    update kafaa_fitness_attempts set responses = v_resp, current_item_id = v_next, item_count = jsonb_array_length(v_resp) where id = v_aid;
    a := kafaa_audit('ai.fitness.answer', 'fitness_attempts', v_aid, 'ok', jsonb_array_length(v_resp)::text, 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Answer recorded', a, null, jsonb_build_object('attempt_id', v_aid, 'done', false, 'answered', jsonb_array_length(v_resp), 'max', 20,
      'item', kafaa_fit_item_view(v_next), 'result', null));
  end if;
  sc := kafaa_fit_score(v_resp);
  update kafaa_fitness_attempts set responses = v_resp, current_item_id = null, item_count = jsonb_array_length(v_resp), status = 'completed', completed_at = now(),
    area_levels = sc -> 'levels', score = (sc ->> 'score')::integer, band = sc ->> 'band', reasons = sc -> 'reasons', evidence = sc -> 'evidence' where id = v_aid;
  -- the latest check replaces earlier checks' evidence (kept, inactive)
  update kafaa_skill_evidence set active = false where person_id = me and ref_table = 'fitness_attempts' and ref_id <> v_aid and active;
  for e in select x from jsonb_array_elements(sc -> 'evidence') x loop
    v_ev := 'se:assessment:' || v_aid || ':' || (e ->> 'skill_id');
    insert into kafaa_skill_evidence (id, person_id, skill_id, kind, ref_table, ref_id, level, basis, status, observed_on, note, recorded_by, active)
    values (v_ev, me, e ->> 'skill_id', 'assessment', 'fitness_attempts', v_aid, (e ->> 'level')::integer, 'evidenced', 'current', current_date,
      'AI and digital fitness check ' || at.period, me, true)
    on conflict (id) do nothing;
  end loop;
  perform kafaa_skills_apply(me, current_date);
  l := kafaa_ledger('kafaa.ai.fitness_check', 'AI and digital fitness check ' || at.period || ': ' || (sc ->> 'band'));
  a := kafaa_audit('ai.fitness.complete', 'fitness_attempts', v_aid, 'ok', (sc ->> 'score') || ' ' || (sc ->> 'band'), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Fitness check complete', a, l, jsonb_build_object('attempt_id', v_aid, 'done', true, 'answered', jsonb_array_length(v_resp), 'max', 20, 'item', null,
    'result', jsonb_build_object('attempt_id', v_aid, 'period', at.period, 'score', (sc ->> 'score')::integer, 'band', sc ->> 'band',
      'above_basic', (sc ->> 'band') in ('above_basic', 'advanced'), 'area_levels', sc -> 'levels', 'evidence', sc -> 'evidence', 'reasons', sc -> 'reasons',
      'item_count', jsonb_array_length(v_resp))));
end $$;

-- ───────────── RPC: my check page context (ai_literacy Own)
create or replace function kafaa_fitness_context() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); v_q text := kafaa_fit_quarter(current_date); v_open text; v_done boolean; v_fam text; v_t integer; s jsonb;
begin
  if me is null or not kafaa_has_grant('ai_literacy', array['Own']) then return null; end if;
  select id into v_open from kafaa_fitness_attempts where person_id = me and status = 'in_progress' order by started_at desc limit 1;
  v_done := exists (select 1 from kafaa_fitness_attempts where person_id = me and status = 'completed' and period = v_q);
  select job_family_id into v_fam from kafaa_people where id = me;
  select fitness_target into v_t from kafaa_ai_role_targets where family_id = v_fam limit 1;
  s := kafaa_fit_stats_core(current_date);
  return jsonb_build_object('period', v_q, 'family_id', v_fam, 'can_start', (not v_done) or v_open is not null, 'in_progress', v_open,
    'next_on', case when v_done and v_open is null then kafaa_fit_next_quarter_start(v_q) else null end,
    'role_target', v_t, 'enec_avg', s -> 'avg_score', 'enec_n', case when s ->> 'avg_score' is null then null else s -> 'tested' end);
end $$;

-- ───────────── RPC: the organisation indicator (ai_literacy Agg)
create or replace function kafaa_fitness_stats() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if kafaa_me() is null or not kafaa_has_grant('ai_literacy', array['Agg']) then return null; end if;
  return kafaa_fit_stats_core(current_date);
end $$;

-- ───────────── RPC: add, edit or retire an item (ai_literacy W: training manager)
create or replace function kafaa_save_fitness_item(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_given text := nullif(coalesce(p ->> 'id', ''), ''); cur kafaa_fitness_items; v_problem text; v_status text; v_left integer;
  v_id text; v_version integer; v_sort integer; a kafaa_audit_events; v_oe text[]; v_oa text[];
begin
  if me is null then return kafaa_refuse('ai.fitness.item', 'fitness_items', v_given, 'not_signed_in', 'Sign in to use the AI and digital fitness check'); end if;
  if not kafaa_has_grant('ai_literacy', array['W']) then return kafaa_refuse('ai.fitness.item', 'fitness_items', v_given, 'forbidden', 'Only the training manager edits the fitness item bank'); end if;
  v_role := kafaa_acting_role('ai_literacy', array['W']);
  if v_given is not null then
    select * into cur from kafaa_fitness_items where id = v_given;
    if cur.id is null then return kafaa_refuse('ai.fitness.item', 'fitness_items', v_given, 'not_found', 'Item not found', v_role); end if;
  end if;
  v_problem := kafaa_fit_item_problem(p);
  if v_problem is not null then
    return kafaa_refuse('ai.fitness.item', 'fitness_items', v_given, 'invalid', 'Check the item: ' || case v_problem
      when 'area' then 'unknown area' when 'difficulty' then 'difficulty must be 1, 2 or 3' when 'stem' then 'a question in English and Arabic (up to 400 characters) is required'
      when 'options' then '3 or 4 options in both languages (up to 200 characters each)' when 'correct' then 'the answer must be one of the options'
      else 'items never touch plant security' end, v_role);
  end if;
  v_status := case when p ->> 'status' = 'retired' then 'retired' else 'active' end;
  if cur.id is not null and cur.status = 'active' and (v_status = 'retired' or cur.area_id <> p ->> 'area_id' or cur.difficulty <> (p ->> 'difficulty')::integer) then
    select count(*) into v_left from kafaa_fitness_items where status = 'active' and id <> cur.id and area_id = cur.area_id and difficulty = cur.difficulty;
    if v_left < 2 then return kafaa_refuse('ai.fitness.item', 'fitness_items', v_given, 'conflict', 'Each area and difficulty needs at least two active items', v_role); end if;
  end if;
  select array_agg(btrim(e #>> '{}') order by i) into v_oe from jsonb_array_elements(p -> 'options_en') with ordinality q(e, i);
  select array_agg(btrim(e #>> '{}') order by i) into v_oa from jsonb_array_elements(p -> 'options_ar') with ordinality q(e, i);
  if cur.id is not null then
    v_id := cur.id; v_version := cur.version + 1;
    update kafaa_fitness_items set area_id = p ->> 'area_id', difficulty = (p ->> 'difficulty')::integer, stem_en = btrim(p ->> 'stem_en'), stem_ar = btrim(p ->> 'stem_ar'),
      options_en = v_oe, options_ar = v_oa, correct = (p ->> 'correct')::integer, explain_en = btrim(coalesce(p ->> 'explain_en', '')), explain_ar = btrim(coalesce(p ->> 'explain_ar', '')),
      status = v_status, updated_by = me, updated_at = now(), version = v_version where id = v_id;
  else
    v_id := 'fi-' || regexp_replace(p ->> 'area_id', '^fa-', '') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8); v_version := 1;
    select coalesce(max(sort), 0) + 1 into v_sort from kafaa_fitness_items where area_id = p ->> 'area_id' and difficulty = (p ->> 'difficulty')::integer;
    insert into kafaa_fitness_items (id, area_id, difficulty, stem_en, stem_ar, options_en, options_ar, correct, explain_en, explain_ar, status, version, sort, updated_by, updated_at)
    values (v_id, p ->> 'area_id', (p ->> 'difficulty')::integer, btrim(p ->> 'stem_en'), btrim(p ->> 'stem_ar'), v_oe, v_oa, (p ->> 'correct')::integer,
      btrim(coalesce(p ->> 'explain_en', '')), btrim(coalesce(p ->> 'explain_ar', '')), v_status, 1, v_sort, me, now());
  end if;
  a := kafaa_audit('ai.fitness.item', 'fitness_items', v_id, 'ok', 'v' || v_version || ' ' || v_status, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when cur.id is not null then 'Item saved' else 'Item added' end, a, null, jsonb_build_object('id', v_id, 'version', v_version, 'status', v_status));
end $$;

-- ───────────── Grants: internal helpers are not executable by API roles; RPCs only by signed-in users.
revoke all on function kafaa_ai_rung(text), kafaa_ai_target_gap(jsonb, text), kafaa_fit_quarter(date), kafaa_fit_quarter_shift(text, integer), kafaa_fit_next_quarter_start(text),
  kafaa_fit_next(jsonb), kafaa_fit_area_level(jsonb, boolean), kafaa_fit_band(integer), kafaa_fit_score(jsonb), kafaa_fit_pick(text, integer, text[], integer), kafaa_fit_item_view(text),
  kafaa_fit_stats_core(date), kafaa_fit_item_problem(jsonb) from public, anon, authenticated;
revoke all on function kafaa_ai_fluency(), kafaa_ai_fluency_stats(), kafaa_start_fitness(), kafaa_submit_fitness(jsonb), kafaa_fitness_context(), kafaa_fitness_stats(),
  kafaa_save_fitness_item(jsonb) from public, anon;
grant execute on function kafaa_ai_fluency(), kafaa_ai_fluency_stats(), kafaa_start_fitness(), kafaa_submit_fitness(jsonb), kafaa_fitness_context(), kafaa_fitness_stats(),
  kafaa_save_fitness_item(jsonb) to authenticated;
