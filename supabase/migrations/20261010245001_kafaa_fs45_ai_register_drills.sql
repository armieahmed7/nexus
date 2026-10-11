-- [FS wave D · E5 · FS36 + FS37] AI-literacy register and governed AI sandbox drills (M29 AI and Digital Fluency).
-- FS36: a register of AI systems (synthetic examples) with ENEC's role (provider or deployer), approved-use class, maturity label (planned,
--   partially rolled out, fully implemented), owner, literacy measures and user groups (job families or all staff, provider or deployer
--   side, the FS09 rung each needs). Coverage is computed from FS09 rungs (kafaa_air_coverage over kafaa_ai_rung), never entered by hand;
--   groups under 10 are suppressed; "fully implemented" is refused below 80% coverage; compliance or certification wording is refused.
--   Mirror of src/modules/m29/register.ts. The exportable pack (built in the page) states that Kafa'a is not a regulator and the
--   alignment with the EU AI Act Article 4 practice repository is voluntary.
-- FS37: browser-only drills that compare an AI-styled summary with a synthetic controlled procedure (SYN- codes) and follow a challenge
--   protocol; the key stays in kafaa_ai_drill_keys (training staff only); scored server-side (kafaa_dr_score, mirror of
--   src/modules/m29/drills.ts); a pass writes F01 assessment evidence (ref_table ai_drill_attempts) capped at level 2. No model call.
-- Shared redefinition (same signatures): kafaa_skill_states_v2 and kafaa_skills_apply treat ref_table = 'ai_drill_attempts' rows as
--   recorded evidence (kept on recompute). TS mirror: RECORDED_REF_TABLES in src/domain/skills.ts. Nothing else in either function changes.
-- PGlite parity and checks: scripts/validate/fs45-ai-register.mjs.
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file; RLS created once (never dropped).

-- ───────────── Tables (generated DDL, additive)
create table if not exists kafaa_ai_systems (
  id text primary key,
  name_en text not null,
  name_ar text not null,
  purpose_en text not null,
  purpose_ar text not null,
  ai_role text not null check (ai_role in ('provider', 'deployer')),
  use_class text not null check (use_class in ('information', 'decision_support', 'automation')),
  maturity text not null check (maturity in ('planned', 'partial', 'full')),
  simulated boolean not null default true,
  owner_person_id text not null,
  owner_en text not null,
  owner_ar text not null,
  oversight_en text not null,
  oversight_ar text not null,
  measures jsonb not null default '[]'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  benchmark_ids text[] not null default '{}'::text[],
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  listed boolean not null default false,
  version integer not null default 1,
  review_due date,
  as_of date not null,
  sort integer not null default 0,
  updated_by text,
  updated_at timestamptz not null default now()
);
comment on table kafaa_ai_systems is '[M29] AI-literacy register entry: one AI system (synthetic example), ENEC as provider or deployer, approved-use class, maturity label, owner role card, literacy measures and sources (FS36)';

-- M29 · A user group of an AI system: job families (or all staff), provider or deployer side, the FS09 rung it needs and extra cells (FS36)
create table if not exists kafaa_ai_system_users (
  id text primary key,
  system_id text not null,
  label_en text not null,
  label_ar text not null,
  family_ids text[] not null default '{}'::text[],
  all_staff boolean not null default false,
  side text not null check (side in ('provider', 'deployer')),
  required_rung integer not null,
  required_cells text[] not null default '{}'::text[],
  rationale_en text not null default '',
  rationale_ar text not null default '',
  active boolean not null default true,
  listed boolean not null default false,
  sort integer not null default 0
);
comment on table kafaa_ai_system_users is '[M29] A user group of an AI system: job families (or all staff), provider or deployer side, the FS09 rung it needs and extra cells (FS36)';

-- M29 · Sandbox drill: a synthetic controlled procedure, an AI-styled summary in segments and a challenge protocol (no answers; the key is in ai_drill_keys) (FS37)
create table if not exists kafaa_ai_drills (
  id text primary key,
  title_en text not null,
  title_ar text not null,
  summary_en text not null,
  summary_ar text not null,
  scenario_en text not null,
  scenario_ar text not null,
  difficulty integer not null,
  level integer not null,
  skill_id text not null,
  doc jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  protocol jsonb not null default '[]'::jsonb,
  est_minutes integer not null default 10,
  synthetic boolean not null default true,
  sources jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  listed boolean not null default false,
  version integer not null default 1,
  sort integer not null default 0,
  updated_by text,
  updated_at timestamptz not null default now()
);
comment on table kafaa_ai_drills is '[M29] Sandbox drill: a synthetic controlled procedure, an AI-styled summary in segments and a challenge protocol (no answers; the key is in ai_drill_keys) (FS37)';

-- M29 · Answer key of a sandbox drill: the planted errors (segment, kind, step) and the protocol answers; training staff only (FS37)
create table if not exists kafaa_ai_drill_keys (
  id text primary key,
  drill_id text not null unique,
  errors jsonb not null default '[]'::jsonb,
  protocol jsonb not null default '[]'::jsonb,
  pass_pct integer not null default 70
);
comment on table kafaa_ai_drill_keys is '[M29] Answer key of a sandbox drill: the planted errors (segment, kind, step) and the protocol answers; training staff only (FS37)';

-- M29 · One person's submitted sandbox drill: flags, protocol answers, score, pass, level and the capped evidence it wrote (FS37)
create table if not exists kafaa_ai_drill_attempts (
  id text primary key,
  person_id text not null,
  drill_id text not null,
  drill_version integer not null,
  attempt_no integer not null,
  flags jsonb not null default '[]'::jsonb,
  answers jsonb not null default '[]'::jsonb,
  points integer not null,
  max_points integer not null,
  pct integer not null,
  found integer not null,
  errors integer not null,
  false_flags integer not null,
  critical_ok boolean not null,
  passed boolean not null,
  level integer not null default 0,
  feedback jsonb not null default '{}'::jsonb,
  reasons jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  submitted_at timestamptz not null default now()
);
comment on table kafaa_ai_drill_attempts is '[M29] One person''s submitted sandbox drill: flags, protocol answers, score, pass, level and the capped evidence it wrote (FS37)';
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_ai_systems_owner_person_id_fk') then alter table kafaa_ai_systems add constraint kafaa_ai_systems_owner_person_id_fk foreign key (owner_person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_ai_system_users_system_id_fk') then alter table kafaa_ai_system_users add constraint kafaa_ai_system_users_system_id_fk foreign key (system_id) references kafaa_ai_systems(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_ai_drills_skill_id_fk') then alter table kafaa_ai_drills add constraint kafaa_ai_drills_skill_id_fk foreign key (skill_id) references kafaa_skills(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_ai_drill_keys_drill_id_fk') then alter table kafaa_ai_drill_keys add constraint kafaa_ai_drill_keys_drill_id_fk foreign key (drill_id) references kafaa_ai_drills(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_ai_drill_attempts_person_id_fk') then alter table kafaa_ai_drill_attempts add constraint kafaa_ai_drill_attempts_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_ai_drill_attempts_drill_id_fk') then alter table kafaa_ai_drill_attempts add constraint kafaa_ai_drill_attempts_drill_id_fk foreign key (drill_id) references kafaa_ai_drills(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_ai_systems_maturity_idx on kafaa_ai_systems (maturity);
create index if not exists kafaa_ai_systems_owner_person_id_idx on kafaa_ai_systems (owner_person_id);
create index if not exists kafaa_ai_systems_status_idx on kafaa_ai_systems (status);
create index if not exists kafaa_ai_system_users_system_id_idx on kafaa_ai_system_users (system_id);
create index if not exists kafaa_ai_drills_skill_id_idx on kafaa_ai_drills (skill_id);
create index if not exists kafaa_ai_drills_status_idx on kafaa_ai_drills (status);
create index if not exists kafaa_ai_drill_attempts_person_id_idx on kafaa_ai_drill_attempts (person_id);
create index if not exists kafaa_ai_drill_attempts_drill_id_idx on kafaa_ai_drill_attempts (drill_id);

-- ───────────── RLS (generated rules; policies created once, never dropped)
do $$ begin
  execute 'alter table kafaa_ai_systems enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_ai_systems' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_ai_systems for select to anon, authenticated using (kafaa_rule_read(''ai_literacy'', null::text, null::text, listed) or kafaa_rule_read(''audit_log'', null::text, null::text, true))'; end if;
  execute 'alter table kafaa_ai_system_users enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_ai_system_users' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_ai_system_users for select to anon, authenticated using (kafaa_rule_read(''ai_literacy'', null::text, null::text, listed) or kafaa_rule_read(''audit_log'', null::text, null::text, true))'; end if;
  execute 'alter table kafaa_ai_drills enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_ai_drills' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_ai_drills for select to anon, authenticated using (kafaa_rule_read(''ai_literacy'', null::text, null::text, listed) or kafaa_rule_read(''secure_items'', null::text, null::text, true))'; end if;
  execute 'alter table kafaa_ai_drill_keys enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_ai_drill_keys' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_ai_drill_keys for select to anon, authenticated using (kafaa_rule_read(''secure_items'', null::text, null::text, true))'; end if;
  execute 'alter table kafaa_ai_drill_attempts enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_ai_drill_attempts' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_ai_drill_attempts for select to anon, authenticated using (kafaa_rule_read(''own_profile'', person_id, null::text, true))'; end if;
end $$;
revoke insert, update, delete on kafaa_ai_systems, kafaa_ai_system_users, kafaa_ai_drills, kafaa_ai_drill_keys, kafaa_ai_drill_attempts from anon, authenticated;
grant select on kafaa_ai_systems, kafaa_ai_system_users, kafaa_ai_drills, kafaa_ai_drill_keys, kafaa_ai_drill_attempts to anon, authenticated;

-- @@SHARED-BEGIN@@
-- ───────────── FS03 skill states: FS10, FS21, FS22 and FS37 assessment rows are recorded evidence (shared redefinition, same signatures;
--               copied from the FS33 migration, only the two ref_table lists gain 'ai_drill_attempts')
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
    where e.active and (e.kind in ('rating', 'ojt', 'credential') or e.ref_table in ('fitness_attempts', 'adaptive_attempts', 'task_attempts', 'ai_drill_attempts')) and (p_person is null or e.person_id = p_person)
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
  where e.active and e.kind in ('qual', 'course', 'assessment', 'jpm') and e.ref_table not in ('fitness_attempts', 'adaptive_attempts', 'task_attempts', 'ai_drill_attempts') and (p_person is null or e.person_id = p_person)
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

-- ───────────── FS36 rules (mirror of src/modules/m29/register.ts)
-- Every active staff member's FS09 result reduced to what coverage needs: [{person_id, family_id, rung, met[]}] ordered by id.
create or replace function kafaa_air_people() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('person_id', x.id, 'family_id', x.job_family_id, 'rung', (x.res ->> 'rung')::integer,
      'met', coalesce((select jsonb_agg(e ->> 'id' order by i) from jsonb_array_elements(x.res -> 'cells') with ordinality q(e, i) where (e ->> 'met')::boolean), '[]'::jsonb))
    order by x.id collate "C"), '[]'::jsonb)
  from (select p.id, p.job_family_id, kafaa_ai_rung(p.id) as res from kafaa_people p where p.kind = 'staff' and p.status = 'active') x
$$;

-- Coverage of the given systems (mirror of coverage(); MIN_GROUP_SIZE 10, THRESHOLD 80).
create or replace function kafaa_air_coverage(p_systems text[], p_people jsonb) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  s record; g record; v_out jsonb := '[]'::jsonb; v_groups jsonb; v_members jsonb; v_users jsonb := '{}'::jsonb; v_mem jsonb; v_m integer; v_c integer; v_gaps jsonb;
  v_n integer; v_cov integer; v_un integer; v_uc integer;
begin
  for s in select a.id, a.maturity from kafaa_ai_systems a where a.id = any(p_systems) order by a.sort, a.id collate "C" loop
    v_groups := '[]'::jsonb; v_members := '{}'::jsonb;
    for g in select u.* from kafaa_ai_system_users u where u.system_id = s.id and u.active order by u.sort, u.id collate "C" loop
      select coalesce(jsonb_agg(jsonb_build_object('pid', e ->> 'person_id', 'met', e -> 'met',
          'cov', (e ->> 'rung')::integer >= g.required_rung and not exists (select 1 from unnest(g.required_cells) rc(c) where not ((e -> 'met') ? rc.c)))), '[]'::jsonb)
        into v_mem from jsonb_array_elements(p_people) e where g.all_staff or (e ->> 'family_id') = any(g.family_ids);
      v_m := jsonb_array_length(v_mem);
      select count(*)::integer into v_c from jsonb_array_elements(v_mem) x where (x ->> 'cov')::boolean;
      select coalesce(jsonb_object_agg(q.k, q.v), '{}'::jsonb) into v_members from (
        select coalesce(a.key, b.pid) as k, to_jsonb(coalesce((a.value)::boolean, true) and coalesce(b.cov, true)) as v
        from jsonb_each(v_members) a full join (select x ->> 'pid' as pid, (x ->> 'cov')::boolean as cov from jsonb_array_elements(v_mem) x) b on a.key = b.pid) q;
      v_gaps := '[]'::jsonb;
      if v_m >= 10 then
        select coalesce(jsonb_agg(jsonb_build_object('cell_id', z.id, 'n', case when z.k >= 10 then z.k else null end) order by z.k desc, z.i), '[]'::jsonb) into v_gaps
        from (
          select z0.* from (
            select nd.id, nd.i, (select count(*) from jsonb_array_elements(v_mem) x where not ((x -> 'met') ? nd.id))::integer as k
            from (select c.id, row_number() over (order by (c.rung > g.required_rung), c.rung * 10 + coalesce(array_position(array['mindset', 'ethics', 'techniques', 'design'], c.dimension) - 1, 0), c.id collate "C") as i
                  from kafaa_ai_rungs c where c.rung <= g.required_rung or c.id = any(g.required_cells)) nd
          ) z0 where z0.k > 0 order by z0.k desc, z0.i limit 3
        ) z;
      end if;
      v_groups := v_groups || jsonb_build_array(jsonb_build_object('group_id', g.id,
        'n', case when v_m >= 10 then v_m else null end,
        'covered', case when v_m >= 10 and v_c >= 10 then v_c else null end,
        'pct', case when v_m >= 10 then floor(1000.0::float8 * v_c / v_m + 0.5) / 10 else null end,
        'gaps', v_gaps));
    end loop;
    select count(*)::integer, count(*) filter (where (q.value)::boolean)::integer into v_n, v_cov from jsonb_each(v_members) q;
    select coalesce(jsonb_object_agg(q.k, q.v), '{}'::jsonb) into v_users from (
      select coalesce(a.key, b.key) as k, to_jsonb(coalesce((a.value)::boolean, true) and coalesce((b.value)::boolean, true)) as v
      from jsonb_each(v_users) a full join jsonb_each(v_members) b on a.key = b.key) q;
    v_out := v_out || jsonb_build_array(jsonb_build_object('system_id', s.id,
      'n', case when v_n >= 10 then v_n else null end,
      'covered', case when v_n >= 10 and v_cov >= 10 then v_cov else null end,
      'pct', case when v_n >= 10 then floor(1000.0::float8 * v_cov / v_n + 0.5) / 10 else null end,
      'maturity', s.maturity,
      'label_ok', case when s.maturity = 'full' then v_n > 0 and floor(1000.0::float8 * v_cov / greatest(v_n, 1) + 0.5) / 10 >= 80 else null end,
      'groups', v_groups));
  end loop;
  select count(*)::integer, count(*) filter (where (q.value)::boolean)::integer into v_un, v_uc from jsonb_each(v_users) q;
  return jsonb_build_object('threshold', 80, 'systems', v_out, 'overall', jsonb_build_object('systems', jsonb_array_length(v_out),
    'n', case when v_un >= 10 then v_un else null end,
    'covered', case when v_un >= 10 and v_uc >= 10 then v_uc else null end,
    'pct', case when v_un >= 10 then floor(1000.0::float8 * v_uc / v_un + 0.5) / 10 else null end));
end $$;

-- Raw coverage % of one system's users from its (input) groups, no suppression (mirror of rawSystemPct): the check behind "fully implemented".
create or replace function kafaa_air_raw_pct(p_groups jsonb, p_people jsonb) returns float8 language sql stable security definer set search_path = public as $$
  with mem as (
    select e ->> 'person_id' as pid,
      bool_and((e ->> 'rung')::integer >= (g ->> 'required_rung')::integer
        and not exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(g -> 'required_cells') = 'array' then g -> 'required_cells' else '[]'::jsonb end) rc(c) where not ((e -> 'met') ? rc.c))) as cov
    from jsonb_array_elements(p_people) e cross join jsonb_array_elements(p_groups) g
    where coalesce((g ->> 'active')::boolean, true)
      and (coalesce((g ->> 'all_staff')::boolean, false)
        or (e ->> 'family_id') in (select jsonb_array_elements_text(case when jsonb_typeof(g -> 'family_ids') = 'array' then g -> 'family_ids' else '[]'::jsonb end)))
    group by e ->> 'person_id'
  )
  select case when count(*) = 0 then 0::float8 else floor(1000.0::float8 * count(*) filter (where cov) / count(*) + 0.5) / 10 end from mem
$$;

-- A bounded, non-empty string (mirror of str() / s() in register.ts and drills.ts).
create or replace function kafaa_air_str(x jsonb, p_max integer) returns boolean language sql immutable set search_path = public as $$
  select coalesce(jsonb_typeof(x) = 'string' and length(btrim(x #>> '{}', E' \t\n\r')) between 1 and p_max, false)
$$;
create or replace function kafaa_air_int(x jsonb, p_lo integer, p_hi integer) returns boolean language sql immutable set search_path = public as $$
  select coalesce(jsonb_typeof(x) = 'number' and (x #>> '{}')::numeric = floor((x #>> '{}')::numeric) and (x #>> '{}')::numeric between p_lo and p_hi, false)
$$;

-- First problem code of a register entry, or null (mirror of systemProblem).
create or replace function kafaa_air_problem(p jsonb) returns text language plpgsql stable security definer set search_path = public as $$
declare g jsonb; m jsonb; v_texts text[];
begin
  if p is null or jsonb_typeof(p) <> 'object' or not kafaa_air_str(p -> 'name_en', 120) or not kafaa_air_str(p -> 'name_ar', 120) then return 'name'; end if;
  if not kafaa_air_str(p -> 'purpose_en', 600) or not kafaa_air_str(p -> 'purpose_ar', 600) then return 'purpose'; end if;
  if jsonb_typeof(p -> 'ai_role') is distinct from 'string' or p ->> 'ai_role' not in ('provider', 'deployer') then return 'ai_role'; end if;
  if jsonb_typeof(p -> 'use_class') is distinct from 'string' or p ->> 'use_class' not in ('information', 'decision_support', 'automation') then return 'use_class'; end if;
  if jsonb_typeof(p -> 'maturity') is distinct from 'string' or p ->> 'maturity' not in ('planned', 'partial', 'full') then return 'maturity'; end if;
  if jsonb_typeof(p -> 'status') is distinct from 'string' or p ->> 'status' not in ('draft', 'published', 'retired') then return 'status'; end if;
  if jsonb_typeof(p -> 'simulated') is distinct from 'boolean' then return 'simulated'; end if;
  if jsonb_typeof(p -> 'owner_person_id') is distinct from 'string' or not exists (select 1 from kafaa_people x where x.id = p ->> 'owner_person_id' and x.kind = 'staff' and x.status = 'active') then return 'owner'; end if;
  if not kafaa_air_str(p -> 'oversight_en', 400) or not kafaa_air_str(p -> 'oversight_ar', 400) then return 'oversight'; end if;
  if jsonb_typeof(p -> 'measures') is distinct from 'array' or jsonb_array_length(p -> 'measures') > 6 then return 'measures'; end if;
  for m in select x from jsonb_array_elements(p -> 'measures') x loop
    if jsonb_typeof(m) <> 'object' or jsonb_typeof(m -> 'kind') is distinct from 'string' or m ->> 'kind' not in ('ladder', 'check', 'drill', 'course', 'briefing')
       or not kafaa_air_str(m -> 'title_en', 160) or not kafaa_air_str(m -> 'title_ar', 160) then return 'measures'; end if;
  end loop;
  if p ->> 'status' = 'published' and jsonb_array_length(p -> 'measures') = 0 then return 'measures'; end if;
  if jsonb_typeof(p -> 'groups') is distinct from 'array' or jsonb_array_length(p -> 'groups') < 1 or jsonb_array_length(p -> 'groups') > 8 then return 'groups'; end if;
  for g in select x from jsonb_array_elements(p -> 'groups') with ordinality q(x, i) order by i loop
    if jsonb_typeof(g) <> 'object' or not kafaa_air_str(g -> 'label_en', 120) or not kafaa_air_str(g -> 'label_ar', 120) then return 'groups'; end if;
    if jsonb_typeof(g -> 'side') is distinct from 'string' or g ->> 'side' not in ('provider', 'deployer') then return 'groups'; end if;
    if not kafaa_air_int(g -> 'required_rung', 1, 4) then return 'rung'; end if;
    if jsonb_typeof(g -> 'all_staff') is distinct from 'boolean' or jsonb_typeof(g -> 'family_ids') is distinct from 'array'
       or (not (g ->> 'all_staff')::boolean and jsonb_array_length(g -> 'family_ids') = 0)
       or exists (select 1 from jsonb_array_elements(g -> 'family_ids') f where jsonb_typeof(f) <> 'string' or not exists (select 1 from kafaa_job_families j where j.id = f #>> '{}')) then return 'families'; end if;
    if jsonb_typeof(g -> 'required_cells') is distinct from 'array'
       or exists (select 1 from jsonb_array_elements(g -> 'required_cells') c where jsonb_typeof(c) <> 'string'
                  or not exists (select 1 from kafaa_ai_rungs r where r.id = c #>> '{}' and r.rung > (g ->> 'required_rung')::integer)) then return 'cells'; end if;
  end loop;
  v_texts := array[p ->> 'name_en', p ->> 'name_ar', p ->> 'purpose_en', p ->> 'purpose_ar', p ->> 'oversight_en', p ->> 'oversight_ar']
    || coalesce((select array_agg(t) from jsonb_array_elements(p -> 'measures') m2, lateral (values (m2 ->> 'title_en'), (m2 ->> 'title_ar')) v(t)), '{}'::text[])
    || coalesce((select array_agg(coalesce(t, '')) from jsonb_array_elements(p -> 'groups') g2, lateral (values (g2 ->> 'label_en'), (g2 ->> 'label_ar'), (g2 ->> 'rationale_en'), (g2 ->> 'rationale_ar')) v(t)), '{}'::text[]);
  if exists (select 1 from unnest(v_texts) t, unnest(array['compliant', 'compliance certified', 'certified', 'certifies', 'complies with', 'presumption of compliance', 'approved by fanr', 'fanr approved',
      'licensed by', 'conformity assessed', 'معتمد من', 'ممتثل', 'شهادة امتثال', 'يمتثل', 'مرخص من']) w where position(w in lower(coalesce(t, ''))) > 0) then return 'claim'; end if;
  return null;
end $$;

-- ───────────── RPC: AI-literacy coverage (ai_literacy Agg or A, audit_log R; owners see their own published systems)
create or replace function kafaa_ai_literacy_coverage() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); v_full boolean; v_drafts boolean; v_ids text[];
begin
  if me is null then return null; end if;
  v_full := kafaa_has_grant('ai_literacy', array['Agg', 'A']) or kafaa_has_grant('audit_log', array['R']);
  v_drafts := kafaa_has_grant('ai_literacy', array['A']) or kafaa_has_grant('audit_log', array['R']);
  select coalesce(array_agg(a.id), '{}'::text[]) into v_ids from kafaa_ai_systems a
    where a.status <> 'retired' and (case when v_full then a.listed or v_drafts else a.owner_person_id = me and a.listed end);
  if not v_full and cardinality(v_ids) = 0 then return null; end if;
  return kafaa_air_coverage(v_ids, kafaa_air_people()) || jsonb_build_object('scope', case when v_full then 'all' else 'owner' end, 'as_of', to_char(current_date, 'YYYY-MM-DD'));
end $$;

-- ───────────── RPC: add or edit a register entry with its user groups (ai_literacy A)
create or replace function kafaa_save_ai_system(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_given text := nullif(coalesce(p ->> 'id', ''), ''); cur kafaa_ai_systems; v_problem text; v_id text; v_version integer; v_listed boolean;
  o kafaa_people; g jsonb; i integer := 0; v_n integer; v_gid text; v_keep text[] := '{}'::text[]; v_measures jsonb; v_due date; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('ai.register.save', 'ai_systems', v_given, 'not_signed_in', 'Sign in to use the AI-literacy register'); end if;
  if not kafaa_has_grant('ai_literacy', array['A']) then return kafaa_refuse('ai.register.save', 'ai_systems', v_given, 'forbidden', 'Only AI governance (admin) maintains the AI-literacy register'); end if;
  v_role := kafaa_acting_role('ai_literacy', array['A']);
  if v_given is not null then
    select * into cur from kafaa_ai_systems where id = v_given;
    if cur.id is null then return kafaa_refuse('ai.register.save', 'ai_systems', v_given, 'not_found', 'Register entry not found', v_role); end if;
  end if;
  v_problem := kafaa_air_problem(p);
  if v_problem is not null then
    return kafaa_refuse('ai.register.save', 'ai_systems', v_given, 'invalid', 'Check the register entry: ' || case v_problem
      when 'name' then 'a name in English and Arabic (up to 120 characters)' when 'purpose' then 'a purpose in English and Arabic (up to 600 characters)'
      when 'ai_role' then 'ENEC''s role must be provider or deployer' when 'use_class' then 'choose an approved-use class'
      when 'maturity' then 'choose planned, partially rolled out or fully implemented' when 'status' then 'choose draft, published or retired'
      when 'simulated' then 'say whether the system is simulated' when 'owner' then 'the owner must be ENEC staff'
      when 'oversight' then 'the human-oversight rule in English and Arabic (up to 400 characters)'
      when 'measures' then 'up to 6 literacy measures with English and Arabic titles (a published entry needs at least one)'
      when 'groups' then '1 to 8 user groups, each with English and Arabic labels and a side' when 'rung' then 'each group needs a required rung from 1 to 4'
      when 'families' then 'each group needs job families or all staff' when 'cells' then 'extra cells must come from a higher rung than the group''s rung'
      else 'Kafa''a does not certify or declare compliance; remove compliance or certification wording' end, v_role);
  end if;
  if p ->> 'maturity' = 'full' and kafaa_air_raw_pct(p -> 'groups', kafaa_air_people()) < 80 then
    return kafaa_refuse('ai.register.save', 'ai_systems', v_given, 'invalid', 'Fully implemented needs at least 80% of the system''s users covered on the AI fluency ladder; coverage is below that today', v_role);
  end if;
  v_listed := p ->> 'status' = 'published';
  select * into o from kafaa_people where id = p ->> 'owner_person_id';
  v_id := coalesce(cur.id, 'ais-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  v_version := coalesce(cur.version + 1, 1);
  select coalesce(jsonb_agg(jsonb_build_object('kind', m ->> 'kind', 'ref', nullif(btrim(case when jsonb_typeof(m -> 'ref') = 'string' then m ->> 'ref' else '' end), ''),
      'title_en', btrim(m ->> 'title_en'), 'title_ar', btrim(m ->> 'title_ar')) order by k), '[]'::jsonb) into v_measures
    from jsonb_array_elements(p -> 'measures') with ordinality q(m, k);
  v_due := case when coalesce(p ->> 'review_due', '') ~ '^\d{4}-\d{2}-\d{2}$' then (p ->> 'review_due')::date else null end;
  if cur.id is not null then
    update kafaa_ai_systems set name_en = btrim(p ->> 'name_en'), name_ar = btrim(p ->> 'name_ar'), purpose_en = btrim(p ->> 'purpose_en'), purpose_ar = btrim(p ->> 'purpose_ar'),
      ai_role = p ->> 'ai_role', use_class = p ->> 'use_class', maturity = p ->> 'maturity', simulated = (p ->> 'simulated')::boolean, owner_person_id = o.id,
      owner_en = o.display_name, owner_ar = o.display_name_ar, oversight_en = btrim(p ->> 'oversight_en'), oversight_ar = btrim(p ->> 'oversight_ar'), measures = v_measures,
      status = p ->> 'status', listed = v_listed, version = v_version, review_due = v_due, as_of = current_date, updated_by = me, updated_at = now() where id = v_id;
  else
    insert into kafaa_ai_systems (id, name_en, name_ar, purpose_en, purpose_ar, ai_role, use_class, maturity, simulated, owner_person_id, owner_en, owner_ar, oversight_en, oversight_ar,
      measures, sources, benchmark_ids, status, listed, version, review_due, as_of, sort, updated_by, updated_at)
    values (v_id, btrim(p ->> 'name_en'), btrim(p ->> 'name_ar'), btrim(p ->> 'purpose_en'), btrim(p ->> 'purpose_ar'), p ->> 'ai_role', p ->> 'use_class', p ->> 'maturity',
      (p ->> 'simulated')::boolean, o.id, o.display_name, o.display_name_ar, btrim(p ->> 'oversight_en'), btrim(p ->> 'oversight_ar'), v_measures, '[]'::jsonb, array['AI-LIT', 'UAE-AI'],
      p ->> 'status', v_listed, 1, v_due, current_date, (select coalesce(max(sort), 0) + 1 from kafaa_ai_systems), me, now());
  end if;
  select count(*)::integer into v_n from kafaa_ai_system_users where system_id = v_id;
  for g in select x from jsonb_array_elements(p -> 'groups') with ordinality q(x, k) order by k loop
    i := i + 1;
    v_gid := null;
    if jsonb_typeof(g -> 'id') = 'string' and g ->> 'id' <> '' then select u.id into v_gid from kafaa_ai_system_users u where u.id = g ->> 'id' and u.system_id = v_id; end if;
    if v_gid is null then
      v_n := v_n + 1; v_gid := v_id || '-g' || v_n;
      insert into kafaa_ai_system_users (id, system_id, label_en, label_ar, family_ids, all_staff, side, required_rung, required_cells, rationale_en, rationale_ar, active, listed, sort)
      values (v_gid, v_id, btrim(g ->> 'label_en'), btrim(g ->> 'label_ar'),
        case when (g ->> 'all_staff')::boolean then '{}'::text[] else array(select jsonb_array_elements_text(g -> 'family_ids')) end, (g ->> 'all_staff')::boolean, g ->> 'side',
        (g ->> 'required_rung')::integer, array(select jsonb_array_elements_text(g -> 'required_cells')), btrim(coalesce(g ->> 'rationale_en', '')), btrim(coalesce(g ->> 'rationale_ar', '')), true, v_listed, i);
    else
      update kafaa_ai_system_users set label_en = btrim(g ->> 'label_en'), label_ar = btrim(g ->> 'label_ar'),
        family_ids = case when (g ->> 'all_staff')::boolean then '{}'::text[] else array(select jsonb_array_elements_text(g -> 'family_ids')) end, all_staff = (g ->> 'all_staff')::boolean,
        side = g ->> 'side', required_rung = (g ->> 'required_rung')::integer, required_cells = array(select jsonb_array_elements_text(g -> 'required_cells')),
        rationale_en = btrim(coalesce(g ->> 'rationale_en', '')), rationale_ar = btrim(coalesce(g ->> 'rationale_ar', '')), active = true, listed = v_listed, sort = i where id = v_gid;
    end if;
    v_keep := v_keep || v_gid;
  end loop;
  update kafaa_ai_system_users set active = false, listed = false where system_id = v_id and not (id = any(v_keep)) and (active or listed);
  if v_listed then l := kafaa_ledger('kafaa.ai.register', 'AI-literacy register: ' || btrim(p ->> 'name_en') || ' v' || v_version || ' ' || (p ->> 'maturity')); end if;
  a := kafaa_audit('ai.register.save', 'ai_systems', v_id, 'ok', 'v' || v_version || ' ' || (p ->> 'status') || ' ' || (p ->> 'maturity'),
    case when not v_listed then 'not_applicable' when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when cur.id is not null then 'Register entry saved' else 'Register entry added' end, a, l,
    jsonb_build_object('id', v_id, 'version', v_version, 'status', p ->> 'status', 'maturity', p ->> 'maturity'));
end $$;

-- ───────────── FS37 rules (mirror of src/modules/m29/drills.ts)
-- Flags deduplicated by segment, first flag wins, in the order given (mirror of normFlags).
create or replace function kafaa_dr_norm_flags(p jsonb) returns jsonb language sql immutable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('segment_id', z.f ->> 'segment_id', 'kind', case when jsonb_typeof(z.f -> 'kind') = 'string' then z.f ->> 'kind' else '' end) order by z.i), '[]'::jsonb)
  from (select f, i, row_number() over (partition by f ->> 'segment_id' order by i) as rn
        from jsonb_array_elements(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end) with ordinality q(f, i)
        where jsonb_typeof(f) = 'object' and jsonb_typeof(f -> 'segment_id') = 'string') z
  where z.rn = 1
$$;

-- Score one submission against the key (mirror of scoreDrill).
create or replace function kafaa_dr_score(p_key jsonb, p_flags jsonb, p_answers jsonb, p_level integer) returns jsonb language plpgsql immutable set search_path = public as $$
declare
  v_flags jsonb := kafaa_dr_norm_flags(p_flags); e jsonb; s jsonb; v_fl text; v_found integer := 0; v_kinds integer := 0; v_points integer := 0; v_fe jsonb := '[]'::jsonb;
  v_false jsonb; v_pr integer := 0; v_crit boolean := true; v_fp jsonb := '[]'::jsonb; v_choice integer; a jsonb; v_right boolean; v_e integer; v_p integer; v_max integer; v_pct integer;
  v_need integer; v_passed boolean; v_cap integer; v_level integer; v_reasons jsonb;
begin
  v_e := jsonb_array_length(p_key -> 'errors'); v_p := jsonb_array_length(p_key -> 'protocol');
  for e in select x from jsonb_array_elements(p_key -> 'errors') with ordinality q(x, i) order by i loop
    v_fl := (select f ->> 'kind' from jsonb_array_elements(v_flags) f where f ->> 'segment_id' = e ->> 'segment_id' limit 1);
    if v_fl is not null then v_found := v_found + 1; v_points := v_points + 2; end if;
    if v_fl is not null and v_fl = e ->> 'kind' then v_kinds := v_kinds + 1; v_points := v_points + 1; end if;
    v_fe := v_fe || jsonb_build_array(jsonb_build_object('segment_id', e ->> 'segment_id', 'kind', e ->> 'kind', 'found', v_fl is not null, 'kind_right', v_fl is not null and v_fl = e ->> 'kind',
      'flagged_kind', v_fl, 'step_n', case when jsonb_typeof(e -> 'step_n') = 'number' then e -> 'step_n' else 'null'::jsonb end, 'explain_en', e ->> 'explain_en', 'explain_ar', e ->> 'explain_ar'));
  end loop;
  select coalesce(jsonb_agg(f ->> 'segment_id' order by i), '[]'::jsonb) into v_false from jsonb_array_elements(v_flags) with ordinality q(f, i)
    where not exists (select 1 from jsonb_array_elements(p_key -> 'errors') x where x ->> 'segment_id' = f ->> 'segment_id');
  v_points := v_points - jsonb_array_length(v_false);
  for s in select x from jsonb_array_elements(p_key -> 'protocol') with ordinality q(x, i) order by i loop
    select x into a from jsonb_array_elements(case when jsonb_typeof(p_answers) = 'array' then p_answers else '[]'::jsonb end) with ordinality q(x, i)
      where jsonb_typeof(x) = 'object' and jsonb_typeof(x -> 'id') = 'string' and x ->> 'id' = s ->> 'id' order by i limit 1;
    v_choice := case when a is not null and jsonb_typeof(a -> 'choice') = 'number' and (a ->> 'choice')::numeric = floor((a ->> 'choice')::numeric) then (a ->> 'choice')::integer else -1 end;
    v_right := v_choice = (s ->> 'correct')::integer;
    if v_right then v_pr := v_pr + 1; v_points := v_points + 2; elsif coalesce((s ->> 'critical')::boolean, false) then v_crit := false; end if;
    v_fp := v_fp || jsonb_build_array(jsonb_build_object('id', s ->> 'id', 'choice', v_choice, 'correct', (s ->> 'correct')::integer, 'right', v_right,
      'critical', coalesce((s ->> 'critical')::boolean, false), 'explain_en', s ->> 'explain_en', 'explain_ar', s ->> 'explain_ar'));
    a := null;
  end loop;
  v_max := 3 * v_e + 2 * v_p;
  v_points := greatest(0, v_points);
  v_pct := case when v_max > 0 then (200 * v_points + v_max) / (2 * v_max) else 0 end;
  v_need := (2 * v_e + 2) / 3;
  v_passed := v_crit and v_found >= v_need and v_pct >= (p_key ->> 'pass_pct')::integer;
  v_cap := least(2, greatest(1, p_level));
  v_level := case when not v_passed then 0 when v_cap >= 2 and v_found = v_e and v_pct >= 85 then 2 else 1 end;
  v_reasons := jsonb_build_array(
    jsonb_build_object('code', 'fs37_found', 'key', 'm29.dr.reason.found', 'vars', jsonb_build_object('found', v_found, 'errors', v_e)),
    jsonb_build_object('code', 'fs37_kinds', 'key', 'm29.dr.reason.kinds', 'vars', jsonb_build_object('kinds', v_kinds, 'found', v_found)),
    jsonb_build_object('code', 'fs37_false', 'key', 'm29.dr.reason.false', 'vars', jsonb_build_object('n', jsonb_array_length(v_false))),
    jsonb_build_object('code', 'fs37_protocol', 'key', 'm29.dr.reason.protocol', 'vars', jsonb_build_object('right', v_pr, 'total', v_p)));
  if not v_crit then v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'fs37_critical', 'key', 'm29.dr.reason.critical')); end if;
  v_reasons := v_reasons || jsonb_build_array(case when v_passed then jsonb_build_object('code', 'fs37_level', 'key', 'm29.dr.reason.level', 'vars', jsonb_build_object('level', v_level, 'pct', v_pct))
    else jsonb_build_object('code', 'fs37_not_passed', 'key', 'm29.dr.reason.notPassed', 'vars', jsonb_build_object('pct', v_pct, 'pass', (p_key ->> 'pass_pct')::integer, 'need', v_need)) end);
  return jsonb_build_object('points', v_points, 'max', v_max, 'pct', v_pct, 'errors', v_e, 'found', v_found, 'kinds_right', v_kinds, 'false_flags', jsonb_array_length(v_false),
    'protocol_right', v_pr, 'protocol_total', v_p, 'critical_ok', v_crit, 'passed', v_passed, 'level', v_level,
    'feedback', jsonb_build_object('errors', v_fe, 'false_flags', v_false, 'protocol', v_fp), 'reasons', v_reasons);
end $$;

-- Problems in a submission against the drill shown (mirror of submissionProblem).
create or replace function kafaa_dr_sub_problem(p_output jsonb, p_protocol jsonb, p_flags jsonb, p_answers jsonb) returns text language plpgsql immutable set search_path = public as $$
declare f jsonb; s jsonb; a jsonb;
begin
  if jsonb_typeof(p_flags) is distinct from 'array' or jsonb_typeof(p_answers) is distinct from 'array' then return 'shape'; end if;
  for f in select x from jsonb_array_elements(p_flags) with ordinality q(x, i) order by i loop
    if jsonb_typeof(f) <> 'object' or jsonb_typeof(f -> 'segment_id') is distinct from 'string'
       or not exists (select 1 from jsonb_array_elements(p_output -> 'segments') g where g ->> 'id' = f ->> 'segment_id') then return 'segment'; end if;
    if jsonb_typeof(f -> 'kind') is distinct from 'string' or f ->> 'kind' not in ('omitted_step', 'wrong_value', 'wrong_order', 'invented', 'overreach', 'stale_revision') then return 'kind'; end if;
  end loop;
  for s in select x from jsonb_array_elements(coalesce(p_protocol, '[]'::jsonb)) with ordinality q(x, i) order by i loop
    select x into a from jsonb_array_elements(p_answers) with ordinality q(x, i) where jsonb_typeof(x) = 'object' and jsonb_typeof(x -> 'id') = 'string' and x ->> 'id' = s ->> 'id' order by i limit 1;
    if a is null or jsonb_typeof(a -> 'choice') is distinct from 'number' or (a ->> 'choice')::numeric <> floor((a ->> 'choice')::numeric)
       or (a ->> 'choice')::numeric < 0 or (a ->> 'choice')::numeric >= jsonb_array_length(coalesce(s -> 'options', '[]'::jsonb)) then return 'protocol'; end if;
    a := null;
  end loop;
  return null;
end $$;

-- First problem code of an authored drill, or null (mirror of drillProblem). Documents must be synthetic (code SYN-XX-000).
create or replace function kafaa_dr_problem(p jsonb, p_skills text[]) returns text language plpgsql immutable set search_path = public as $$
declare d jsonb := coalesce(p -> 'doc', 'null'::jsonb); o jsonb := coalesce(p -> 'output', 'null'::jsonb); k jsonb := coalesce(p -> 'key', 'null'::jsonb); x jsonb; ks jsonb; v_all text; v_n integer;
begin
  if p is null or jsonb_typeof(p) <> 'object' or not kafaa_air_str(p -> 'title_en', 140) or not kafaa_air_str(p -> 'title_ar', 140) or not kafaa_air_str(p -> 'summary_en', 400)
     or not kafaa_air_str(p -> 'summary_ar', 400) or not kafaa_air_str(p -> 'scenario_en', 800) or not kafaa_air_str(p -> 'scenario_ar', 800) then return 'texts'; end if;
  if not kafaa_air_int(p -> 'difficulty', 1, 3) then return 'difficulty'; end if;
  if not kafaa_air_int(p -> 'level', 1, 2) then return 'level'; end if;
  if jsonb_typeof(p -> 'skill_id') is distinct from 'string' or not (p ->> 'skill_id' = any(coalesce(p_skills, '{}'::text[]))) then return 'skill'; end if;
  if jsonb_typeof(p -> 'status') is distinct from 'string' or p ->> 'status' not in ('draft', 'published', 'retired') then return 'status'; end if;
  if not kafaa_air_int(p -> 'est_minutes', 3, 30) then return 'minutes'; end if;
  if jsonb_typeof(d) is distinct from 'object' or coalesce(d ->> 'code', '') !~ '^SYN-[A-Z]{2}-[0-9]{3}$' or not kafaa_air_str(d -> 'title_en', 160) or not kafaa_air_str(d -> 'title_ar', 160)
     or not kafaa_air_str(d -> 'revision', 10) then return 'synthetic'; end if;
  if jsonb_typeof(d -> 'steps') is distinct from 'array' or jsonb_array_length(d -> 'steps') < 3 or jsonb_array_length(d -> 'steps') > 12
     or exists (select 1 from jsonb_array_elements(d -> 'steps') with ordinality q(st, i) where jsonb_typeof(st) <> 'object' or jsonb_typeof(st -> 'n') is distinct from 'number'
                or (st ->> 'n')::numeric <> i or not kafaa_air_str(st -> 'text_en', 400) or not kafaa_air_str(st -> 'text_ar', 400)) then return 'doc'; end if;
  if jsonb_typeof(o) is distinct from 'object' or not kafaa_air_str(o -> 'tool_en', 80) or not kafaa_air_str(o -> 'tool_ar', 80) or jsonb_typeof(o -> 'segments') is distinct from 'array'
     or jsonb_array_length(o -> 'segments') < 3 or jsonb_array_length(o -> 'segments') > 12
     or exists (select 1 from jsonb_array_elements(o -> 'segments') sg where jsonb_typeof(sg) <> 'object' or not kafaa_air_str(sg -> 'id', 20) or not kafaa_air_str(sg -> 'text_en', 400) or not kafaa_air_str(sg -> 'text_ar', 400))
     or (select count(distinct sg -> 'id') from jsonb_array_elements(o -> 'segments') sg) <> jsonb_array_length(o -> 'segments') then return 'output'; end if;
  if jsonb_typeof(p -> 'protocol') is distinct from 'array' or jsonb_array_length(p -> 'protocol') < 3 or jsonb_array_length(p -> 'protocol') > 5
     or exists (select 1 from jsonb_array_elements(p -> 'protocol') ps where jsonb_typeof(ps) <> 'object' or not kafaa_air_str(ps -> 'id', 20) or not kafaa_air_str(ps -> 'q_en', 300) or not kafaa_air_str(ps -> 'q_ar', 300)
                or jsonb_typeof(ps -> 'options') is distinct from 'array' or jsonb_array_length(ps -> 'options') < 2 or jsonb_array_length(ps -> 'options') > 4
                or exists (select 1 from jsonb_array_elements(ps -> 'options') op where jsonb_typeof(op) <> 'object' or not kafaa_air_str(op -> 'en', 200) or not kafaa_air_str(op -> 'ar', 200))) then return 'protocol'; end if;
  v_n := jsonb_array_length(o -> 'segments');
  if jsonb_typeof(k) is distinct from 'object' or jsonb_typeof(k -> 'errors') is distinct from 'array' or jsonb_array_length(k -> 'errors') < 2 or jsonb_array_length(k -> 'errors') > 5
     or exists (select 1 from jsonb_array_elements(k -> 'errors') er where jsonb_typeof(er) <> 'object'
                or not exists (select 1 from jsonb_array_elements(o -> 'segments') sg where sg -> 'id' = er -> 'segment_id')
                or jsonb_typeof(er -> 'kind') is distinct from 'string' or er ->> 'kind' not in ('omitted_step', 'wrong_value', 'wrong_order', 'invented', 'overreach', 'stale_revision')
                or not kafaa_air_str(er -> 'explain_en', 400) or not kafaa_air_str(er -> 'explain_ar', 400))
     or (select count(distinct er -> 'segment_id') from jsonb_array_elements(k -> 'errors') er) <> jsonb_array_length(k -> 'errors')
     or jsonb_array_length(k -> 'errors') >= v_n then return 'errors'; end if;
  if jsonb_typeof(k -> 'protocol') is distinct from 'array' or jsonb_array_length(k -> 'protocol') <> jsonb_array_length(p -> 'protocol') then return 'key'; end if;
  for x in select y from jsonb_array_elements(p -> 'protocol') with ordinality q(y, i) order by i loop
    select z into ks from jsonb_array_elements(k -> 'protocol') with ordinality q(z, i) where jsonb_typeof(z) = 'object' and z -> 'id' = x -> 'id' order by i limit 1;
    if ks is null or not kafaa_air_int(ks -> 'correct', 0, jsonb_array_length(x -> 'options') - 1) or jsonb_typeof(ks -> 'critical') is distinct from 'boolean'
       or not kafaa_air_str(ks -> 'explain_en', 400) or not kafaa_air_str(ks -> 'explain_ar', 400) then return 'key'; end if;
    ks := null;
  end loop;
  if not exists (select 1 from jsonb_array_elements(k -> 'protocol') z where jsonb_typeof(z -> 'critical') = 'boolean' and (z ->> 'critical')::boolean) then return 'key'; end if;
  if not kafaa_air_int(k -> 'pass_pct', 50, 95) then return 'pass'; end if;
  v_all := lower(jsonb_build_array(p -> 'title_en', p -> 'summary_en', p -> 'scenario_en', d, o, p -> 'protocol', k)::text);
  if exists (select 1 from unnest(array['vital area', 'protected area', 'security plan', 'guard force', 'design basis threat', 'safeguards', 'physical protection', 'alarm station', 'access code',
      'firewall rule', 'network diagram', 'ip address']) w where position(w in v_all) > 0) then return 'restricted'; end if;
  return null;
end $$;

-- Training view of drill results (mirror of drillStats with MIN_GROUP_SIZE 10): latest attempt per person and drill.
create or replace function kafaa_dr_stats_core() returns jsonb language sql stable security definer set search_path = public as $$
  with lt as (
    select distinct on (a.person_id, a.drill_id) a.person_id, a.drill_id, a.passed, a.pct, a.feedback from kafaa_ai_drill_attempts a
    order by a.person_id, a.drill_id, a.submitted_at desc, a.id collate "C" desc
  ), dr as (select d.id from kafaa_ai_drills d where d.status <> 'retired'),
  ek as (select e ->> 'kind' as kind, coalesce((e ->> 'found')::boolean, false) as found from lt cross join jsonb_array_elements(coalesce(lt.feedback -> 'errors', '[]'::jsonb)) e)
  select jsonb_build_object(
    'attempts', (select count(*)::integer from kafaa_ai_drill_attempts),
    'people', (select case when count(distinct person_id) >= 10 then count(distinct person_id)::integer else null end from lt),
    'drills', coalesce((select jsonb_agg(jsonb_build_object('drill_id', dr.id,
        'attempts', case when g.n >= 10 then (select count(*)::integer from kafaa_ai_drill_attempts x where x.drill_id = dr.id) else null end,
        'people', case when g.n >= 10 then g.n else null end,
        'pass_pct', case when g.n >= 10 then floor((100.0::float8 * g.p / g.n) * 10 + 0.5) / 10 else null end,
        'avg_pct', case when g.n >= 10 then floor((g.s::float8 / g.n) * 10 + 0.5) / 10 else null end) order by dr.id collate "C")
      from dr cross join lateral (select count(*)::integer n, count(*) filter (where lt.passed)::integer p, coalesce(sum(lt.pct), 0)::integer s from lt where lt.drill_id = dr.id) g), '[]'::jsonb),
    'missed_kinds', (select jsonb_agg(jsonb_build_object('kind', k.kind,
        'missed', case when c.planted >= 10 and c.missed >= 10 then c.missed else null end,
        'planted', case when c.planted >= 10 then c.planted else null end,
        'pct_missed', case when c.planted >= 10 then floor((100.0::float8 * c.missed / c.planted) * 10 + 0.5) / 10 else null end) order by k.i)
      from unnest(array['omitted_step', 'wrong_value', 'wrong_order', 'invented', 'overreach', 'stale_revision']) with ordinality k(kind, i)
      cross join lateral (select count(*)::integer planted, count(*) filter (where not ek.found)::integer missed from ek where ek.kind = k.kind) c))
$$;

-- ───────────── RPC: submit a sandbox drill (ai_literacy Own): scored server-side; a pass writes F01 assessment evidence <= L2
create or replace function kafaa_submit_drill(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_did text := coalesce(p ->> 'drill_id', ''); d kafaa_ai_drills; k kafaa_ai_drill_keys; v_problem text; sc jsonb; v_no integer; v_aid text;
  v_ev jsonb; v_passed boolean; v_level integer; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('ai.drill.submit', 'ai_drill_attempts', nullif(v_did, ''), 'not_signed_in', 'Sign in to take a sandbox drill'); end if;
  if not kafaa_has_grant('ai_literacy', array['Own']) then return kafaa_refuse('ai.drill.submit', 'ai_drill_attempts', nullif(v_did, ''), 'forbidden', 'Sandbox drills are for ENEC staff'); end if;
  v_role := kafaa_acting_role('ai_literacy', array['Own']);
  select * into d from kafaa_ai_drills where id = v_did;
  select * into k from kafaa_ai_drill_keys where drill_id = v_did limit 1;
  if d.id is null or k.id is null then return kafaa_refuse('ai.drill.submit', 'ai_drill_attempts', nullif(v_did, ''), 'not_found', 'Drill not found', v_role); end if;
  if d.status <> 'published' then return kafaa_refuse('ai.drill.submit', 'ai_drill_attempts', v_did, 'invalid', 'This drill is not open', v_role); end if;
  v_problem := kafaa_dr_sub_problem(d.output, d.protocol, p -> 'flags', p -> 'answers');
  if v_problem is not null then
    return kafaa_refuse('ai.drill.submit', 'ai_drill_attempts', v_did, 'invalid', 'Check your answers: ' || case v_problem when 'shape' then 'flags and answers are required'
      when 'segment' then 'flag only parts of the summary shown' when 'kind' then 'choose a kind of error for every flag' else 'answer every protocol step' end, v_role);
  end if;
  sc := kafaa_dr_score(jsonb_build_object('errors', k.errors, 'protocol', k.protocol, 'pass_pct', k.pass_pct), p -> 'flags', p -> 'answers', d.level);
  v_passed := (sc ->> 'passed')::boolean; v_level := (sc ->> 'level')::integer;
  select count(*)::integer + 1 into v_no from kafaa_ai_drill_attempts where person_id = me and drill_id = v_did;
  v_aid := 'da-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
  v_ev := case when v_passed then jsonb_build_array(jsonb_build_object('skill_id', d.skill_id, 'level', v_level)) else '[]'::jsonb end;
  -- the latest attempt on a drill replaces earlier evidence from the same drill (kept, inactive)
  update kafaa_skill_evidence set active = false where person_id = me and ref_table = 'ai_drill_attempts' and active
    and ref_id in (select x.id from kafaa_ai_drill_attempts x where x.person_id = me and x.drill_id = v_did);
  insert into kafaa_ai_drill_attempts (id, person_id, drill_id, drill_version, attempt_no, flags, answers, points, max_points, pct, found, errors, false_flags, critical_ok, passed, level,
    feedback, reasons, evidence, submitted_at)
  values (v_aid, me, v_did, d.version, v_no, kafaa_dr_norm_flags(p -> 'flags'),
    (select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', x -> 'id', 'choice', x -> 'choice')) order by i), '[]'::jsonb) from jsonb_array_elements(p -> 'answers') with ordinality q(x, i)),
    (sc ->> 'points')::integer, (sc ->> 'max')::integer, (sc ->> 'pct')::integer, (sc ->> 'found')::integer, (sc ->> 'errors')::integer, (sc ->> 'false_flags')::integer,
    (sc ->> 'critical_ok')::boolean, v_passed, v_level, sc -> 'feedback', sc -> 'reasons', v_ev, now());
  if v_passed then
    insert into kafaa_skill_evidence (id, person_id, skill_id, kind, ref_table, ref_id, level, basis, status, observed_on, note, recorded_by, active)
    values ('se:assessment:' || v_aid || ':' || d.skill_id, me, d.skill_id, 'assessment', 'ai_drill_attempts', v_aid, v_level, 'evidenced', 'current', current_date, 'AI sandbox drill ' || v_did, me, true)
    on conflict (id) do nothing;
  end if;
  perform kafaa_skills_apply(me, current_date);
  if v_passed then l := kafaa_ledger('kafaa.ai.drill', 'AI sandbox drill ' || v_did || ': passed at level ' || v_level); end if;
  a := kafaa_audit('ai.drill.submit', 'ai_drill_attempts', v_aid, 'ok', v_did || ' ' || (sc ->> 'pct') || '% ' || case when v_passed then 'pass L' || v_level else 'not yet' end,
    case when not v_passed then 'not_applicable' when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when v_passed then 'Drill passed' else 'Drill submitted' end, a, l,
    sc || jsonb_build_object('attempt_id', v_aid, 'drill_id', v_did, 'attempt_no', v_no, 'pass_pct', k.pass_pct, 'evidence', v_ev));
end $$;

-- ───────────── RPC: drill results for training (ai_literacy W or Agg, or secure_items W/A; suppressed under 10)
create or replace function kafaa_drill_stats() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if kafaa_me() is null then return null; end if;
  if not (kafaa_has_grant('ai_literacy', array['W', 'Agg']) or kafaa_has_grant('secure_items', array['W', 'A'])) then return null; end if;
  return kafaa_dr_stats_core();
end $$;

-- ───────────── RPC: add, edit or retire a drill with its key (training manager: ai_literacy W and secure_items W/A)
create or replace function kafaa_save_drill(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_given text := nullif(coalesce(p ->> 'id', ''), ''); cur kafaa_ai_drills; v_problem text; v_id text; v_version integer; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('ai.drill.save', 'ai_drills', v_given, 'not_signed_in', 'Sign in to take a sandbox drill'); end if;
  if not (kafaa_has_grant('ai_literacy', array['W']) and kafaa_has_grant('secure_items', array['W', 'A'])) then
    return kafaa_refuse('ai.drill.save', 'ai_drills', v_given, 'forbidden', 'Only the training manager edits sandbox drills'); end if;
  v_role := kafaa_acting_role('ai_literacy', array['W']);
  if v_given is not null then
    select * into cur from kafaa_ai_drills where id = v_given;
    if cur.id is null then return kafaa_refuse('ai.drill.save', 'ai_drills', v_given, 'not_found', 'Drill not found', v_role); end if;
  end if;
  v_problem := kafaa_dr_problem(p, (select array_agg(t.skill_id order by t.skill_id) from kafaa_ai_skill_tracks t where t.track = 'literacy'));
  if v_problem is not null then
    return kafaa_refuse('ai.drill.save', 'ai_drills', v_given, 'invalid', 'Check the drill: ' || case v_problem
      when 'texts' then 'title, summary and scenario in English and Arabic' when 'difficulty' then 'difficulty must be 1, 2 or 3' when 'level' then 'the evidence level must be 1 or 2'
      when 'skill' then 'choose an AI-literacy skill' when 'status' then 'choose draft, published or retired' when 'minutes' then 'an estimate from 3 to 30 minutes'
      when 'synthetic' then 'documents must be synthetic (code SYN-XX-000) with a title and revision' when 'doc' then '3 to 12 numbered procedure steps in both languages'
      when 'output' then 'a tool name and 3 to 12 summary segments with unique ids in both languages' when 'protocol' then '3 to 5 protocol steps with 2 to 4 options in both languages'
      when 'errors' then '2 to 5 planted errors on different segments, each with a kind and explanations' when 'key' then 'an answer and explanation for every protocol step, at least one critical'
      when 'pass' then 'a pass mark from 50 to 95' else 'drills never touch plant security' end, v_role);
  end if;
  v_id := coalesce(cur.id, 'ad-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  v_version := coalesce(cur.version + 1, 1);
  if cur.id is not null then
    update kafaa_ai_drills set title_en = btrim(p ->> 'title_en'), title_ar = btrim(p ->> 'title_ar'), summary_en = btrim(p ->> 'summary_en'), summary_ar = btrim(p ->> 'summary_ar'),
      scenario_en = btrim(p ->> 'scenario_en'), scenario_ar = btrim(p ->> 'scenario_ar'), difficulty = (p ->> 'difficulty')::integer, level = (p ->> 'level')::integer, skill_id = p ->> 'skill_id',
      doc = p -> 'doc', output = p -> 'output', protocol = p -> 'protocol', est_minutes = (p ->> 'est_minutes')::integer, synthetic = true, status = p ->> 'status',
      listed = p ->> 'status' = 'published', version = v_version, updated_by = me, updated_at = now() where id = v_id;
  else
    insert into kafaa_ai_drills (id, title_en, title_ar, summary_en, summary_ar, scenario_en, scenario_ar, difficulty, level, skill_id, doc, output, protocol, est_minutes, synthetic, sources,
      status, listed, version, sort, updated_by, updated_at)
    values (v_id, btrim(p ->> 'title_en'), btrim(p ->> 'title_ar'), btrim(p ->> 'summary_en'), btrim(p ->> 'summary_ar'), btrim(p ->> 'scenario_en'), btrim(p ->> 'scenario_ar'),
      (p ->> 'difficulty')::integer, (p ->> 'level')::integer, p ->> 'skill_id', p -> 'doc', p -> 'output', p -> 'protocol', (p ->> 'est_minutes')::integer, true, '[]'::jsonb,
      p ->> 'status', p ->> 'status' = 'published', 1, (select coalesce(max(sort), 0) + 1 from kafaa_ai_drills), me, now());
  end if;
  insert into kafaa_ai_drill_keys (id, drill_id, errors, protocol, pass_pct) values ('adk-' || v_id, v_id, p #> '{key,errors}', p #> '{key,protocol}', (p #>> '{key,pass_pct}')::integer)
  on conflict (id) do update set errors = excluded.errors, protocol = excluded.protocol, pass_pct = excluded.pass_pct;
  a := kafaa_audit('ai.drill.save', 'ai_drills', v_id, 'ok', 'v' || v_version || ' ' || (p ->> 'status'), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when cur.id is not null then 'Drill saved' else 'Drill added' end, a, null, jsonb_build_object('id', v_id, 'version', v_version, 'status', p ->> 'status'));
end $$;

-- ───────────── Grants: internal helpers are not executable by API roles; RPCs only by signed-in users.
revoke all on function kafaa_air_people(), kafaa_air_coverage(text[], jsonb), kafaa_air_raw_pct(jsonb, jsonb), kafaa_air_str(jsonb, integer), kafaa_air_int(jsonb, integer, integer),
  kafaa_air_problem(jsonb), kafaa_dr_norm_flags(jsonb), kafaa_dr_score(jsonb, jsonb, jsonb, integer), kafaa_dr_sub_problem(jsonb, jsonb, jsonb, jsonb), kafaa_dr_problem(jsonb, text[]),
  kafaa_dr_stats_core() from public, anon, authenticated;
revoke all on function kafaa_ai_literacy_coverage(), kafaa_save_ai_system(jsonb), kafaa_submit_drill(jsonb), kafaa_drill_stats(), kafaa_save_drill(jsonb) from public, anon;
grant execute on function kafaa_ai_literacy_coverage(), kafaa_save_ai_system(jsonb), kafaa_submit_drill(jsonb), kafaa_drill_stats(), kafaa_save_drill(jsonb) to authenticated;
