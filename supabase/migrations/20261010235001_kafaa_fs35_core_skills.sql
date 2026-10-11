-- [FS wave C · E5 · FS25 + FS26] Nuclear Critical Core Skills and situational judgement practice (M33 Human Skills Studio).
-- FS25: 16 core skills in the three SkillsFuture clusters (thinking critically, interacting with others, staying relevant), written for a
--   nuclear plant; each maps to at least two kafaa_benchmarks rows (SSG-SF, WEF-FOJ, GREENCOMP/LifeComp/EntreComp, MCK-DELTA, IAEA-1917), to
--   INPO traits in M08 and to FS02 catalogue skills; three level descriptors; its own development and assessment routes (the McKinsey DELTA
--   inclusion rule); wellbeing and career health are outcomes, never competencies (kafaa_core_skill_candidates). A target per job family and
--   core skill. My level per core skill comes from F01 person skill states of the linked skills (kafaa_cs_view / kafaa_cs_profile, mirror of
--   coreProfile in src/modules/m33/coreSkills.ts); the HR aggregate is suppressed under 10 (kafaa_cs_stats_core = coreStats).
-- FS26: a 48-item bilingual situational judgement bank (expert effectiveness 0-3 per response, a why per response and an expert rationale per
--   item); practice sets of up to 8 items picked by kafaa_sjt_pick (= pickSet), scored by kafaa_sjt_score (= scoreSjt). Development only:
--   attempts are Own-only (RLS own_profile person rule: never managers, HR or talent review), never write skill evidence, never reach the
--   ledger, never gate anything; HR sees suppressed aggregates (kafaa_sjt_stats_core = sjtStats); the training manager edits the bank
--   (secure_items A). No points, streaks, badges or leaderboards.
-- PGlite parity and checks: scripts/validate/fs35-core-skills.mjs.
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file; RLS created once (never dropped).

-- ───────────── Tables (generated DDL, additive)
create table if not exists kafaa_core_skills (
  id text primary key,
  code text not null unique,
  cluster text not null check (cluster in ('thinking_critically', 'interacting_with_others', 'staying_relevant')),
  name_en text not null,
  name_ar text not null,
  summary_en text not null,
  summary_ar text not null,
  plant_en text not null,
  plant_ar text not null,
  descriptors jsonb not null default '[]'::jsonb,
  mappings jsonb not null default '[]'::jsonb,
  benchmark_ids text[] not null default '{}'::text[],
  trait_ids text[] not null default '{}'::text[],
  skill_ids text[] not null default '{}'::text[],
  development jsonb not null default '[]'::jsonb,
  assessment jsonb not null default '[]'::jsonb,
  dev_approach_en text not null,
  dev_approach_ar text not null,
  assess_approach_en text not null,
  assess_approach_ar text not null,
  outcome_en text not null default '',
  outcome_ar text not null default '',
  sources jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('active', 'retired')),
  version integer not null default 1,
  as_of date not null,
  sort integer not null default 0
);
comment on table kafaa_core_skills is '[M33] Nuclear critical core skill (16 in three SkillsFuture clusters), written for a nuclear plant, with benchmark mappings, INPO traits, linked catalogue skills, level descriptors and its own development and assessment routes (FS25)';

create table if not exists kafaa_core_skill_targets (
  id text primary key,
  family_id text not null,
  core_skill_id text not null,
  level integer not null,
  rationale_en text not null,
  rationale_ar text not null
);
comment on table kafaa_core_skill_targets is '[M33] Core-skill target level (1 Foundation, 2 Proficient, 3 Role model) for each job family and core skill, with the reason (FS25)';

create table if not exists kafaa_core_skill_candidates (
  id text primary key,
  name_en text not null,
  name_ar text not null,
  decision text not null check (decision in ('merged', 'outcome', 'not_added')),
  merged_into text,
  has_development boolean not null default false,
  has_assessment boolean not null default false,
  reason_en text not null,
  reason_ar text not null,
  benchmark_ids text[] not null default '{}'::text[],
  sources jsonb not null default '[]'::jsonb,
  sort integer not null default 0
);
comment on table kafaa_core_skill_candidates is '[M33] Candidate core skills considered and not added under the inclusion rule (merged, treated as an outcome or not added), with the reason and source (FS25)';

create table if not exists kafaa_sjt_items (
  id text primary key,
  core_skill_id text not null,
  theme text not null check (theme in ('conservative_decisions', 'questioning', 'raising_concerns', 'teamwork_pressure', 'procedure_use', 'learning_change', 'working_across_cultures', 'digital_judgement')),
  stem_en text not null,
  stem_ar text not null,
  options_en text[] not null default '{}'::text[],
  options_ar text[] not null default '{}'::text[],
  expert_key jsonb not null default '[]'::jsonb,
  notes_en text[] not null default '{}'::text[],
  notes_ar text[] not null default '{}'::text[],
  rationale_en text not null,
  rationale_ar text not null,
  status text not null default 'active' check (status in ('active', 'retired')),
  version integer not null default 1,
  sort integer not null default 0,
  updated_by text,
  updated_at timestamptz not null default now()
);
comment on table kafaa_sjt_items is '[M33] Situational judgement practice item (EN/AR): a plant scenario, four responses with expert effectiveness 0-3 and a why for each, and the expert rationale; read by training staff, served to takers without the key (FS26)';

create table if not exists kafaa_sjt_attempts (
  id text primary key,
  person_id text not null,
  period text not null,
  attempt_no integer not null,
  core_skill_id text,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  item_ids text[] not null default '{}'::text[],
  responses jsonb not null default '[]'::jsonb,
  score integer,
  by_skill jsonb not null default '{}'::jsonb,
  reasons jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
comment on table kafaa_sjt_attempts is '[M33] One person''s situational judgement practice set: the items, answers with expert effectiveness, score and tally per core skill. Own only: never read by managers, HR or talent review (FS26)';

do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_core_skill_targets_family_id_fk') then alter table kafaa_core_skill_targets add constraint kafaa_core_skill_targets_family_id_fk foreign key (family_id) references kafaa_job_families(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_core_skill_targets_core_skill_id_fk') then alter table kafaa_core_skill_targets add constraint kafaa_core_skill_targets_core_skill_id_fk foreign key (core_skill_id) references kafaa_core_skills(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_core_skill_candidates_merged_into_fk') then alter table kafaa_core_skill_candidates add constraint kafaa_core_skill_candidates_merged_into_fk foreign key (merged_into) references kafaa_core_skills(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_sjt_items_core_skill_id_fk') then alter table kafaa_sjt_items add constraint kafaa_sjt_items_core_skill_id_fk foreign key (core_skill_id) references kafaa_core_skills(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_sjt_attempts_person_id_fk') then alter table kafaa_sjt_attempts add constraint kafaa_sjt_attempts_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_sjt_attempts_core_skill_id_fk') then alter table kafaa_sjt_attempts add constraint kafaa_sjt_attempts_core_skill_id_fk foreign key (core_skill_id) references kafaa_core_skills(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_core_skills_cluster_idx on kafaa_core_skills (cluster);
create index if not exists kafaa_core_skill_targets_family_id_idx on kafaa_core_skill_targets (family_id);
create index if not exists kafaa_core_skill_targets_core_skill_id_idx on kafaa_core_skill_targets (core_skill_id);
create index if not exists kafaa_core_skill_candidates_decision_idx on kafaa_core_skill_candidates (decision);
create index if not exists kafaa_core_skill_candidates_merged_into_idx on kafaa_core_skill_candidates (merged_into);
create index if not exists kafaa_sjt_items_core_skill_id_idx on kafaa_sjt_items (core_skill_id);
create index if not exists kafaa_sjt_items_theme_idx on kafaa_sjt_items (theme);
create index if not exists kafaa_sjt_items_status_idx on kafaa_sjt_items (status);
create index if not exists kafaa_sjt_attempts_person_id_idx on kafaa_sjt_attempts (person_id);
create index if not exists kafaa_sjt_attempts_period_idx on kafaa_sjt_attempts (period);
create index if not exists kafaa_sjt_attempts_core_skill_id_idx on kafaa_sjt_attempts (core_skill_id);
create index if not exists kafaa_sjt_attempts_status_idx on kafaa_sjt_attempts (status);

-- ───────────── RLS (generated rules; policies created once, never dropped)
do $$ begin
  execute 'alter table kafaa_core_skills enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_core_skills' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_core_skills for select to anon, authenticated using (kafaa_rule_read(''public_content'', null::text, null::text, true))'; end if;
  execute 'alter table kafaa_core_skill_targets enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_core_skill_targets' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_core_skill_targets for select to anon, authenticated using (kafaa_rule_read(''public_content'', null::text, null::text, true))'; end if;
  execute 'alter table kafaa_core_skill_candidates enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_core_skill_candidates' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_core_skill_candidates for select to anon, authenticated using (kafaa_rule_read(''public_content'', null::text, null::text, true))'; end if;
  execute 'alter table kafaa_sjt_items enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_sjt_items' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_sjt_items for select to anon, authenticated using (kafaa_rule_read(''secure_items'', null::text, null::text, true))'; end if;
  execute 'alter table kafaa_sjt_attempts enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'kafaa_sjt_attempts' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_sjt_attempts for select to anon, authenticated using (kafaa_rule_read(''own_profile'', person_id, null::text, true))'; end if;
end $$;
revoke insert, update, delete on kafaa_core_skills, kafaa_core_skill_targets, kafaa_core_skill_candidates, kafaa_sjt_items, kafaa_sjt_attempts from anon, authenticated;
grant select on kafaa_core_skills, kafaa_core_skill_targets, kafaa_core_skill_candidates, kafaa_sjt_items, kafaa_sjt_attempts to anon, authenticated;

-- ───────────── Shared helpers (mirror of src/modules/m33/coreSkills.ts and sjt.ts)
create or replace function kafaa_cs_quarter(p_d date) returns text language sql immutable set search_path = public as $$
  select to_char(p_d, 'YYYY') || '-Q' || ((extract(month from p_d)::integer - 1) / 3 + 1)::text
$$;
create or replace function kafaa_cs_quarter_shift(p_q text, p_k integer) returns text language sql immutable set search_path = public as $$
  select ((split_part(p_q, '-Q', 1)::integer * 4 + split_part(p_q, '-Q', 2)::integer - 1 + p_k) / 4)::text || '-Q'
    || ((split_part(p_q, '-Q', 1)::integer * 4 + split_part(p_q, '-Q', 2)::integer - 1 + p_k) % 4 + 1)::text
$$;
create or replace function kafaa_cs_basis_rank(p_basis text) returns integer language sql immutable set search_path = public as $$
  select case p_basis when 'verified' then 4 when 'evidenced' then 3 when 'validated' then 2 when 'claimed' then 1 else 0 end
$$;
/** One-decimal percentage a / b, half up, in integers (pct1). */
create or replace function kafaa_cs_pct1(p_a integer, p_b integer) returns numeric language sql immutable set search_path = public as $$
  select round(((2000 * p_a + p_b) / (2 * p_b))::numeric / 10, 1)
$$;
/** round(100 * sum / (3 n)) half up (practicePct / scorePct). */
create or replace function kafaa_cs_practice_pct(p_sum bigint, p_n bigint) returns integer language sql immutable set search_path = public as $$
  select case when p_n > 0 then ((200 * p_sum + 3 * p_n) / (6 * p_n))::integer else 0 end
$$;

-- ───────────── FS25: one core skill for one person (coreSkillView)
create or replace function kafaa_cs_view(p_person text, p_cs text, p_fam text, p_from text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare cs kafaa_core_skills; v_target integer; v_level integer := 0; v_top text; v_ev jsonb; v_reasons jsonb := '[]'::jsonb; v_status text;
  v_n bigint; v_sum bigint; v_pr jsonb := null; r record; i integer := 0;
begin
  select * into cs from kafaa_core_skills where id = p_cs;
  if p_fam is not null then
    select t.level into v_target from kafaa_core_skill_targets t where t.family_id = p_fam and t.core_skill_id = p_cs order by t.id collate "C" limit 1;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('skill_id', x.skill_id, 'level', x.level, 'basis', x.basis)
      order by x.level desc, kafaa_cs_basis_rank(x.basis) desc, x.skill_id collate "C"), '[]'::jsonb) into v_ev
    from kafaa_person_skills x where x.person_id = p_person and x.active and x.skill_id = any(cs.skill_ids) and x.level >= 1;
  for r in select x.id, x.skill_id, x.level, x.basis, s.name_en, s.name_ar from kafaa_person_skills x left join kafaa_skills s on s.id = x.skill_id
      where x.person_id = p_person and x.active and x.skill_id = any(cs.skill_ids) and x.level >= 1
      order by x.level desc, kafaa_cs_basis_rank(x.basis) desc, x.skill_id collate "C" loop
    i := i + 1;
    if i = 1 then v_level := least(3, greatest(0, r.level)); v_top := r.basis; end if;
    exit when i > 3;
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'cs_evidence', 'key', 'm33.reason.evidence',
      'vars', jsonb_build_object('skill', jsonb_build_object('en', coalesce(r.name_en, r.skill_id), 'ar', coalesce(r.name_ar, r.skill_id)), 'level', r.level,
        'basis', jsonb_build_object('en', r.basis, 'ar', case r.basis when 'verified' then 'موثّق' when 'evidenced' then 'مُثبت بالأدلة' when 'validated' then 'مُصادق عليه' when 'claimed' then 'مُعلَن ذاتياً' else r.basis end)),
      'ref', jsonb_build_object('table', 'person_skills', 'id', r.id)));
  end loop;
  v_status := case when v_level = 0 then 'no_evidence' when v_target is null then 'no_target' when v_level >= v_target then 'met' else 'below' end;
  v_reasons := v_reasons || case v_status
    when 'no_evidence' then jsonb_build_array(jsonb_build_object('code', 'cs_none', 'key', 'm33.reason.none', 'vars', jsonb_build_object('n', coalesce(cardinality(cs.skill_ids), 0))))
    when 'met' then jsonb_build_array(jsonb_build_object('code', 'cs_met', 'key', 'm33.reason.met', 'vars', jsonb_build_object('level', v_level, 'target', v_target)))
    when 'below' then jsonb_build_array(jsonb_build_object('code', 'cs_below', 'key', 'm33.reason.below', 'vars', jsonb_build_object('level', v_level, 'target', v_target)))
    else jsonb_build_array(jsonb_build_object('code', 'cs_no_target', 'key', 'm33.reason.noTarget', 'vars', jsonb_build_object('level', v_level))) end;
  if p_from is not null then
    select coalesce(sum((e.value ->> 'n')::bigint), 0), coalesce(sum((e.value ->> 'sum')::bigint), 0) into v_n, v_sum
      from kafaa_sjt_attempts a cross join lateral jsonb_each(a.by_skill) e
      where a.person_id = p_person and a.status = 'completed' and a.period collate "C" >= p_from collate "C" and e.key = p_cs;
    if v_n > 0 then
      v_pr := jsonb_build_object('n', v_n, 'pct', kafaa_cs_practice_pct(v_sum, v_n));
      v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'cs_practice', 'key', 'm33.reason.practice', 'vars', jsonb_build_object('pct', kafaa_cs_practice_pct(v_sum, v_n), 'n', v_n)));
    end if;
  end if;
  return jsonb_build_object('core_skill_id', p_cs, 'cluster', cs.cluster, 'level', v_level, 'target', v_target, 'status', v_status, 'top_basis', v_top,
    'evidence', v_ev, 'practice', v_pr, 'reasons', v_reasons);
end $$;

-- ───────────── FS25: my profile (coreProfile)
create or replace function kafaa_cs_profile(p_person text, p_today date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_fam text; v_from text := kafaa_cs_quarter_shift(kafaa_cs_quarter(p_today), -3); v_skills jsonb := '[]'::jsonb; c record;
begin
  select job_family_id into v_fam from kafaa_people where id = p_person;
  for c in select id from kafaa_core_skills where status = 'active' order by sort, id collate "C" loop
    v_skills := v_skills || jsonb_build_array(kafaa_cs_view(p_person, c.id, v_fam, v_from));
  end loop;
  return jsonb_build_object('person_id', p_person, 'family_id', v_fam,
    'summary', jsonb_build_object(
      'met', (select count(*) from jsonb_array_elements(v_skills) x where x ->> 'status' = 'met'),
      'below', (select count(*) from jsonb_array_elements(v_skills) x where x ->> 'status' = 'below'),
      'no_evidence', (select count(*) from jsonb_array_elements(v_skills) x where x ->> 'status' = 'no_evidence'),
      'no_target', (select count(*) from jsonb_array_elements(v_skills) x where x ->> 'status' = 'no_target'),
      'total', jsonb_array_length(v_skills)),
    'skills', v_skills);
end $$;

-- ───────────── FS25: HR aggregate (coreStats with MIN_GROUP_SIZE 10)
create or replace function kafaa_cs_stats_core() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  with staff as (select id, job_family_id from kafaa_people where kind = 'staff' and status = 'active'),
  cs as (select id, cluster, skill_ids, sort from kafaa_core_skills where status = 'active'),
  cells as (
    select st.id as person, st.job_family_id as fam, cs.id as csid, cs.cluster,
      coalesce((select least(3, greatest(0, max(ps.level))) from kafaa_person_skills ps
        where ps.person_id = st.id and ps.active and ps.skill_id = any(cs.skill_ids) and ps.level >= 1), 0) as lvl,
      case when st.job_family_id is null then null else (select t.level from kafaa_core_skill_targets t
        where t.family_id = st.job_family_id and t.core_skill_id = cs.id order by t.id collate "C" limit 1) end as tgt
    from staff st cross join cs
  ),
  c as (select *, case when lvl = 0 then 'no_evidence' when tgt is null then 'no_target' when lvl >= tgt then 'met' else 'below' end as status from cells),
  tot as (
    select (select count(*) from staff)::integer as n, (select count(*) from c)::integer as cells, (select count(*) from c where status = 'met')::integer as met,
      (select count(distinct person) from c where status <> 'no_evidence')::integer as evid
  )
  select jsonb_build_object(
    'staff', tot.n,
    'pct_met', case when tot.n >= 10 and tot.cells > 0 then kafaa_cs_pct1(tot.met, tot.cells) else null end,
    'pct_evidenced', case when tot.n >= 10 and tot.evid >= 10 then kafaa_cs_pct1(tot.evid, tot.n) else null end,
    'by_skill', (select coalesce(jsonb_agg(jsonb_build_object('core_skill_id', k.id,
        'met', case when tot.n >= 10 and k.met >= 10 then k.met else null end,
        'below', case when tot.n >= 10 and k.below >= 10 then k.below else null end,
        'no_evidence', case when tot.n >= 10 and k.ne >= 10 then k.ne else null end,
        'pct_met', case when tot.n >= 10 and k.met >= 10 then kafaa_cs_pct1(k.met, tot.n) else null end) order by k.sort, k.id collate "C"), '[]'::jsonb)
      from (select cs.id, cs.sort, (select count(*) from c where c.csid = cs.id and c.status = 'met')::integer as met,
              (select count(*) from c where c.csid = cs.id and c.status = 'below')::integer as below,
              (select count(*) from c where c.csid = cs.id and c.status = 'no_evidence')::integer as ne from cs) k),
    'by_cluster', (select jsonb_agg(jsonb_build_object('cluster', cl.cluster,
        'pct_met', case when tot.n >= 10 and cl.cnt > 0 then kafaa_cs_pct1(cl.met, cl.cnt) else null end) order by cl.ord)
      from (select x.cluster, x.ord, (select count(*) from c where c.cluster = x.cluster)::integer as cnt,
              (select count(*) from c where c.cluster = x.cluster and c.status = 'met')::integer as met
            from (values ('thinking_critically', 1), ('interacting_with_others', 2), ('staying_relevant', 3)) x(cluster, ord)) cl),
    'by_family', (select coalesce(jsonb_agg(jsonb_build_object('family_id', f.fam,
        'n', case when f.ppl >= 10 then f.ppl else null end,
        'pct_met', case when f.ppl >= 10 and f.cnt > 0 then kafaa_cs_pct1(f.met, f.cnt) else null end) order by f.fam collate "C"), '[]'::jsonb)
      from (select s.job_family_id as fam, count(*)::integer as ppl,
              (select count(*) from c where c.fam = s.job_family_id)::integer as cnt,
              (select count(*) from c where c.fam = s.job_family_id and c.status = 'met')::integer as met
            from staff s where coalesce(s.job_family_id, '') <> '' and s.job_family_id not in ('security', 'safeguards', 'cyber') group by s.job_family_id) f))
  into v from tot;
  return v;
end $$;

-- ───────────── FS26 rules (mirror of src/modules/m33/sjt.ts)
create or replace function kafaa_sjt_seed(p text) returns integer language sql immutable set search_path = public as $$
  select coalesce(sum(ascii(substr(p, i, 1))), 0)::integer from generate_series(1, coalesce(length(p), 0)) i
$$;
/** pickSet: active items (all, or one core skill's), rotated by the person's seed and the attempt number; least-answered first. */
create or replace function kafaa_sjt_pick(p_person text, p_no integer, p_cs text, p_n integer default 8) returns text[] language sql stable security definer set search_path = public as $$
  with pool as (
    select id, (row_number() over (order by sort, id collate "C") - 1)::integer as i from kafaa_sjt_items where status = 'active' and (p_cs is null or core_skill_id = p_cs)
  ), nn as (select count(*)::integer as n from pool),
  ans as (select r ->> 'item_id' as item_id, count(*)::integer as c from kafaa_sjt_attempts a cross join lateral jsonb_array_elements(a.responses) r where a.person_id = p_person group by 1),
  o as (select nn.n, case when nn.n = 0 then 0 else ((kafaa_sjt_seed(p_person) + (p_no - 1) * p_n) % nn.n + nn.n) % nn.n end as off from nn)
  select coalesce(array_agg(x.id order by x.c, x.r), '{}'::text[]) from (
    select pool.id, coalesce(ans.c, 0) as c, (pool.i - o.off + o.n) % o.n as r from pool cross join o left join ans on ans.item_id = pool.id
    order by 2, 3 limit p_n
  ) x
$$;
create or replace function kafaa_sjt_item_view(p_id text) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', i.id, 'core_skill_id', i.core_skill_id, 'theme', i.theme, 'stem_en', i.stem_en, 'stem_ar', i.stem_ar,
    'options_en', to_jsonb(i.options_en), 'options_ar', to_jsonb(i.options_ar)) from kafaa_sjt_items i where i.id = p_id
$$;
create or replace function kafaa_sjt_feedback(p_id text, p_choice integer) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('item_id', i.id, 'choice', p_choice, 'eff', (i.expert_key ->> p_choice)::integer,
    'best', (select (k.ord - 1)::integer from jsonb_array_elements_text(i.expert_key) with ordinality k(v, ord) order by k.v::integer desc, k.ord limit 1),
    'key', (select jsonb_agg((k.v)::integer order by k.ord) from jsonb_array_elements_text(i.expert_key) with ordinality k(v, ord)),
    'notes_en', to_jsonb(i.notes_en), 'notes_ar', to_jsonb(i.notes_ar), 'rationale_en', i.rationale_en, 'rationale_ar', i.rationale_ar)
  from kafaa_sjt_items i where i.id = p_id
$$;
/** scoreSjt: overall %, the tally per core skill and the reasons (strongest and the one to develop). */
create or replace function kafaa_sjt_score(p_resp jsonb) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_n integer; v_sum integer; v_best integer; v_score integer; v_by jsonb; v_reasons jsonb; s record; d record; v_k integer;
begin
  select count(*)::integer, coalesce(sum((r ->> 'eff')::integer), 0)::integer, count(*) filter (where (r ->> 'eff')::integer = 3)::integer into v_n, v_sum, v_best
    from jsonb_array_elements(p_resp) r;
  v_score := kafaa_cs_practice_pct(v_sum, v_n);
  select coalesce(jsonb_object_agg(g.cs, jsonb_build_object('n', g.n, 'sum', g.sm)), '{}'::jsonb), count(*)::integer into v_by, v_k
    from (select r ->> 'core_skill_id' as cs, count(*)::integer as n, sum((r ->> 'eff')::integer)::integer as sm from jsonb_array_elements(p_resp) r group by 1) g;
  v_reasons := jsonb_build_array(jsonb_build_object('code', 'sjt_score', 'key', 'm33.sjt.reason.score', 'vars', jsonb_build_object('score', v_score, 'n', v_n, 'best', v_best)));
  if v_k > 1 then
    select g.cs, g.pct, c.name_en, c.name_ar into s from (
      select e.key as cs, kafaa_cs_practice_pct((e.value ->> 'sum')::bigint, (e.value ->> 'n')::bigint) as pct from jsonb_each(v_by) e) g
      left join kafaa_core_skills c on c.id = g.cs order by g.pct desc, coalesce(c.sort, 999), g.cs collate "C" limit 1;
    select g.cs, g.pct, c.name_en, c.name_ar into d from (
      select e.key as cs, kafaa_cs_practice_pct((e.value ->> 'sum')::bigint, (e.value ->> 'n')::bigint) as pct from jsonb_each(v_by) e) g
      left join kafaa_core_skills c on c.id = g.cs order by g.pct asc, coalesce(c.sort, 999), g.cs collate "C" limit 1;
    if s.pct > d.pct then
      v_reasons := v_reasons || jsonb_build_array(
        jsonb_build_object('code', 'sjt_strong', 'key', 'm33.sjt.reason.strong', 'vars', jsonb_build_object('skill', jsonb_build_object('en', coalesce(s.name_en, s.cs), 'ar', coalesce(s.name_ar, s.cs)), 'pct', s.pct),
          'ref', jsonb_build_object('table', 'core_skills', 'id', s.cs)),
        jsonb_build_object('code', 'sjt_develop', 'key', 'm33.sjt.reason.develop', 'vars', jsonb_build_object('skill', jsonb_build_object('en', coalesce(d.name_en, d.cs), 'ar', coalesce(d.name_ar, d.cs)), 'pct', d.pct),
          'ref', jsonb_build_object('table', 'core_skills', 'id', d.cs)));
    end if;
  end if;
  v_reasons := v_reasons || jsonb_build_array(jsonb_build_object('code', 'sjt_private', 'key', 'm33.sjt.reason.private'));
  return jsonb_build_object('score', v_score, 'by_skill', v_by, 'reasons', v_reasons);
end $$;
/** sjtStats: participation and average practice score by quarter and core skill; suppressed under 10; never a person. */
create or replace function kafaa_sjt_stats_core(p_today date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb; v_q text := kafaa_cs_quarter(p_today);
begin
  with win as (select kafaa_cs_quarter_shift(v_q, -k) as q, 3 - k as ord from generate_series(0, 3) k),
  done as (
    select a.* from kafaa_sjt_attempts a join kafaa_people p on p.id = a.person_id and p.kind = 'staff' and p.status = 'active'
    where a.status = 'completed' and a.score is not null and a.period in (select q from win)
  ),
  tally as (select d.id, d.person_id, d.period, e.key as cs, (e.value ->> 'n')::bigint as n, (e.value ->> 'sum')::bigint as sm from done d cross join lateral jsonb_each(d.by_skill) e),
  tot as (select (select count(distinct person_id) from done)::integer as ppl, (select count(*) from done)::integer as att,
    (select coalesce(sum(n), 0) from tally)::bigint as n, (select coalesce(sum(sm), 0) from tally)::bigint as sm)
  select jsonb_build_object(
    'participants', case when tot.ppl >= 10 then tot.ppl else null end,
    'attempts', case when tot.ppl >= 10 then tot.att else null end,
    'avg', case when tot.ppl >= 10 and tot.n > 0 then kafaa_cs_practice_pct(tot.sm, tot.n) else null end,
    'by_quarter', (select jsonb_agg(jsonb_build_object('period', w.q,
        'people', case when w.p >= 10 then w.p else null end,
        'attempts', case when w.p >= 10 then w.a else null end,
        'avg', case when w.p >= 10 and w.n > 0 then kafaa_cs_practice_pct(w.sm, w.n) else null end) order by w.ord)
      from (select win.q, win.ord, (select count(distinct person_id) from done where period = win.q)::integer as p, (select count(*) from done where period = win.q)::integer as a,
              (select coalesce(sum(n), 0) from tally where period = win.q)::bigint as n, (select coalesce(sum(sm), 0) from tally where period = win.q)::bigint as sm from win) w),
    'by_skill', (select coalesce(jsonb_agg(jsonb_build_object('core_skill_id', k.id,
        'people', case when k.p >= 10 then k.p else null end,
        'pct', case when k.p >= 10 and k.n > 0 then kafaa_cs_practice_pct(k.sm, k.n) else null end) order by k.sort, k.id collate "C"), '[]'::jsonb)
      from (select c.id, c.sort, (select count(distinct person_id) from tally where cs = c.id)::integer as p,
              (select coalesce(sum(n), 0) from tally where cs = c.id)::bigint as n, (select coalesce(sum(sm), 0) from tally where cs = c.id)::bigint as sm from kafaa_core_skills c) k))
  into v from tot;
  return v;
end $$;
/** sjtItemProblem: the item bank check (null when the item is fine). */
create or replace function kafaa_sjt_item_problem(p jsonb) returns text language plpgsql stable security definer set search_path = public as $$
declare v_all text; x jsonb; k integer; n3 integer := 0;
begin
  if p is null or jsonb_typeof(p -> 'core_skill_id') is distinct from 'string' or not exists (select 1 from kafaa_core_skills where id = p ->> 'core_skill_id' and status = 'active') then return 'core_skill'; end if;
  if jsonb_typeof(p -> 'theme') is distinct from 'string' or (p ->> 'theme') not in ('conservative_decisions', 'questioning', 'raising_concerns', 'teamwork_pressure', 'procedure_use',
      'learning_change', 'working_across_cultures', 'digital_judgement') then return 'theme'; end if;
  if jsonb_typeof(p -> 'stem_en') is distinct from 'string' or jsonb_typeof(p -> 'stem_ar') is distinct from 'string'
     or char_length(btrim(p ->> 'stem_en')) not between 1 and 700 or char_length(btrim(p ->> 'stem_ar')) not between 1 and 700 then return 'stem'; end if;
  foreach k in array array[0, 1] loop
    x := p -> (case k when 0 then 'options_en' else 'options_ar' end);
    if jsonb_typeof(x) is distinct from 'array' or jsonb_array_length(x) <> 4
       or exists (select 1 from jsonb_array_elements(x) e where jsonb_typeof(e) <> 'string' or char_length(btrim(e #>> '{}')) not between 1 and 240) then return 'options'; end if;
  end loop;
  x := p -> 'expert_key';
  if jsonb_typeof(x) is distinct from 'array' or jsonb_array_length(x) <> 4
     or exists (select 1 from jsonb_array_elements(x) e where jsonb_typeof(e) <> 'number' or (e #>> '{}')::numeric <> floor((e #>> '{}')::numeric) or (e #>> '{}')::numeric not between 0 and 3) then return 'key'; end if;
  select count(*) into n3 from jsonb_array_elements(x) e where (e #>> '{}')::numeric = 3;
  if n3 <> 1 then return 'key'; end if;
  foreach k in array array[0, 1] loop
    x := p -> (case k when 0 then 'notes_en' else 'notes_ar' end);
    if jsonb_typeof(x) is distinct from 'array' or jsonb_array_length(x) <> 4
       or exists (select 1 from jsonb_array_elements(x) e where jsonb_typeof(e) <> 'string' or char_length(btrim(e #>> '{}')) not between 1 and 300) then return 'notes'; end if;
  end loop;
  if jsonb_typeof(p -> 'rationale_en') is distinct from 'string' or jsonb_typeof(p -> 'rationale_ar') is distinct from 'string'
     or char_length(btrim(p ->> 'rationale_en')) not between 1 and 700 or char_length(btrim(p ->> 'rationale_ar')) not between 1 and 700 then return 'rationale'; end if;
  v_all := lower(concat_ws(' ', p ->> 'stem_en', p ->> 'stem_ar', (select string_agg(e, ' ' order by o) from jsonb_array_elements_text(p -> 'options_en') with ordinality q(e, o)),
    (select string_agg(e, ' ' order by o) from jsonb_array_elements_text(p -> 'options_ar') with ordinality q(e, o)),
    (select string_agg(e, ' ' order by o) from jsonb_array_elements_text(p -> 'notes_en') with ordinality q(e, o)), p ->> 'rationale_en'));
  if exists (select 1 from unnest(array['vital area', 'protected area', 'security plan', 'guard force', 'design basis threat', 'safeguards', 'physical protection',
      'alarm station', 'access code', 'firewall rule', 'network diagram', 'ip address']) w where position(w in v_all) > 0) then return 'restricted'; end if;
  return null;
end $$;

-- ───────────── RPC: my core skills (skills_profile Own)
create or replace function kafaa_core_skills_mine() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me();
begin
  if me is null or not kafaa_has_grant('skills_profile', array['Own']) then return null; end if;
  return kafaa_cs_profile(me, current_date);
end $$;

-- ───────────── RPC: HR aggregate (skills_profile Agg)
create or replace function kafaa_core_skills_stats() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if kafaa_me() is null or not kafaa_has_grant('skills_profile', array['Agg']) then return null; end if;
  return kafaa_cs_stats_core();
end $$;

-- ───────────── RPC: start (or resume) a practice set
create or replace function kafaa_start_sjt(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_cs text := nullif(coalesce(p ->> 'core_skill_id', ''), ''); v_open kafaa_sjt_attempts; v_no integer; v_set text[]; v_id text; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('sjt.start', 'sjt_attempts', null, 'not_signed_in', 'Sign in to practise situational judgement'); end if;
  if not kafaa_has_grant('skills_profile', array['Own']) then return kafaa_refuse('sjt.start', 'sjt_attempts', null, 'forbidden', 'Situational judgement practice is for ENEC staff'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  select * into v_open from kafaa_sjt_attempts where person_id = me and status = 'in_progress' order by started_at desc limit 1;
  if v_open.id is not null then
    a := kafaa_audit('sjt.start', 'sjt_attempts', v_open.id, 'ok', 'resumed', 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Practice resumed', a, null, jsonb_build_object('attempt_id', v_open.id, 'done', false, 'answered', jsonb_array_length(v_open.responses),
      'total', coalesce(cardinality(v_open.item_ids), 0), 'item', kafaa_sjt_item_view(v_open.item_ids[jsonb_array_length(v_open.responses) + 1]), 'feedback', null, 'result', null, 'resumed', true));
  end if;
  if v_cs is not null and not exists (select 1 from kafaa_core_skills where id = v_cs and status = 'active') then
    return kafaa_refuse('sjt.start', 'sjt_attempts', null, 'invalid', 'Unknown core skill', v_role); end if;
  select count(*) + 1 into v_no from kafaa_sjt_attempts where person_id = me;
  v_set := kafaa_sjt_pick(me, v_no, v_cs, 8);
  if coalesce(cardinality(v_set), 0) = 0 then return kafaa_refuse('sjt.start', 'sjt_attempts', null, 'unavailable', 'No active practice items for this choice; ask the training manager', v_role); end if;
  v_id := 'sjt-a-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
  insert into kafaa_sjt_attempts (id, person_id, period, attempt_no, core_skill_id, status, item_ids, responses, score, by_skill, reasons, started_at, completed_at)
  values (v_id, me, kafaa_cs_quarter(current_date), v_no, v_cs, 'in_progress', v_set, '[]'::jsonb, null, '{}'::jsonb, '[]'::jsonb, now(), null);
  a := kafaa_audit('sjt.start', 'sjt_attempts', v_id, 'ok', coalesce(v_cs, 'mixed'), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Practice started', a, null, jsonb_build_object('attempt_id', v_id, 'done', false, 'answered', 0, 'total', cardinality(v_set),
    'item', kafaa_sjt_item_view(v_set[1]), 'feedback', null, 'result', null, 'resumed', false));
end $$;

-- ───────────── RPC: answer the item on screen; the key, notes and rationale come back; after the last item the set is scored.
-- Development only: never writes skill evidence, never reaches the ledger.
create or replace function kafaa_submit_sjt(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_aid text := coalesce(p ->> 'attempt_id', ''); at kafaa_sjt_attempts; it kafaa_sjt_items; v_cur text; v_choice integer;
  v_fb jsonb; v_resp jsonb; v_next text; sc jsonb; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('sjt.answer', 'sjt_attempts', nullif(v_aid, ''), 'not_signed_in', 'Sign in to practise situational judgement'); end if;
  if not kafaa_has_grant('skills_profile', array['Own']) then return kafaa_refuse('sjt.answer', 'sjt_attempts', nullif(v_aid, ''), 'forbidden', 'Situational judgement practice is for ENEC staff'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  select * into at from kafaa_sjt_attempts where id = v_aid for update;
  if at.id is null or at.person_id <> me then return kafaa_refuse('sjt.answer', 'sjt_attempts', nullif(v_aid, ''), 'not_found', 'Practice set not found', v_role); end if;
  if at.status <> 'in_progress' then return kafaa_refuse('sjt.answer', 'sjt_attempts', v_aid, 'invalid', 'This practice set is already complete', v_role); end if;
  v_cur := at.item_ids[jsonb_array_length(at.responses) + 1];
  if coalesce(p ->> 'item_id', '') = '' or p ->> 'item_id' is distinct from v_cur then
    return kafaa_refuse('sjt.answer', 'sjt_attempts', v_aid, 'invalid', 'Answer the item on screen first', v_role); end if;
  select * into it from kafaa_sjt_items where id = v_cur;
  if it.id is null then return kafaa_refuse('sjt.answer', 'sjt_attempts', v_aid, 'not_found', 'Item not found', v_role); end if;
  if jsonb_typeof(p -> 'choice') is distinct from 'number' or (p ->> 'choice')::numeric <> floor((p ->> 'choice')::numeric)
     or (p ->> 'choice')::numeric < 0 or (p ->> 'choice')::numeric >= coalesce(array_length(it.options_en, 1), 0) then
    return kafaa_refuse('sjt.answer', 'sjt_attempts', v_aid, 'invalid', 'Choose one of the responses', v_role); end if;
  v_choice := (p ->> 'choice')::integer;
  v_fb := kafaa_sjt_feedback(it.id, v_choice);
  v_resp := at.responses || jsonb_build_array(jsonb_build_object('item_id', it.id, 'core_skill_id', it.core_skill_id, 'choice', v_choice, 'eff', (v_fb ->> 'eff')::integer));
  v_next := at.item_ids[jsonb_array_length(v_resp) + 1];
  if v_next is not null then
    update kafaa_sjt_attempts set responses = v_resp where id = v_aid;
    a := kafaa_audit('sjt.answer', 'sjt_attempts', v_aid, 'ok', jsonb_array_length(v_resp)::text, 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Answer recorded', a, null, jsonb_build_object('attempt_id', v_aid, 'done', false, 'answered', jsonb_array_length(v_resp),
      'total', coalesce(cardinality(at.item_ids), 0), 'item', kafaa_sjt_item_view(v_next), 'feedback', v_fb, 'result', null));
  end if;
  sc := kafaa_sjt_score(v_resp);
  update kafaa_sjt_attempts set responses = v_resp, status = 'completed', completed_at = now(), score = (sc ->> 'score')::integer, by_skill = sc -> 'by_skill', reasons = sc -> 'reasons'
    where id = v_aid;
  a := kafaa_audit('sjt.complete', 'sjt_attempts', v_aid, 'ok', sc ->> 'score', 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Practice complete', a, null, jsonb_build_object('attempt_id', v_aid, 'done', true, 'answered', jsonb_array_length(v_resp),
    'total', coalesce(cardinality(at.item_ids), 0), 'item', null, 'feedback', v_fb,
    'result', jsonb_build_object('attempt_id', v_aid, 'period', at.period, 'score', (sc ->> 'score')::integer, 'by_skill', sc -> 'by_skill', 'reasons', sc -> 'reasons',
      'item_count', jsonb_array_length(v_resp))));
end $$;

-- ───────────── RPC: my practice page context (skills_profile Own)
create or replace function kafaa_sjt_context() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); v_open text; s jsonb;
begin
  if me is null or not kafaa_has_grant('skills_profile', array['Own']) then return null; end if;
  select id into v_open from kafaa_sjt_attempts where person_id = me and status = 'in_progress' order by started_at desc limit 1;
  s := kafaa_sjt_stats_core(current_date);
  return jsonb_build_object('period', kafaa_cs_quarter(current_date), 'in_progress', v_open,
    'completed', (select count(*) from kafaa_sjt_attempts where person_id = me and status = 'completed'),
    'bank', (select coalesce(jsonb_agg(jsonb_build_object('core_skill_id', c.id, 'items',
        (select count(*) from kafaa_sjt_items i where i.core_skill_id = c.id and i.status = 'active')) order by c.sort, c.id collate "C"), '[]'::jsonb) from kafaa_core_skills c),
    'enec_avg', s -> 'avg', 'enec_n', case when s ->> 'avg' is null then null else s -> 'participants' end);
end $$;

-- ───────────── RPC: practice aggregate (skills_profile Agg)
create or replace function kafaa_sjt_stats() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if kafaa_me() is null or not kafaa_has_grant('skills_profile', array['Agg']) then return null; end if;
  return kafaa_sjt_stats_core(current_date);
end $$;

-- ───────────── RPC: add, edit or retire a practice item (secure_items A: the training manager)
create or replace function kafaa_save_sjt_item(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_given text := nullif(coalesce(p ->> 'id', ''), ''); cur kafaa_sjt_items; v_problem text; v_status text; v_left integer;
  v_id text; v_version integer; v_sort integer; a kafaa_audit_events; v_oe text[]; v_oa text[]; v_ne text[]; v_na text[]; v_key jsonb;
begin
  if me is null then return kafaa_refuse('sjt.item', 'sjt_items', v_given, 'not_signed_in', 'Sign in to practise situational judgement'); end if;
  if not kafaa_has_grant('secure_items', array['A']) then return kafaa_refuse('sjt.item', 'sjt_items', v_given, 'forbidden', 'Only the training manager edits the practice item bank'); end if;
  v_role := kafaa_acting_role('secure_items', array['A']);
  if v_given is not null then
    select * into cur from kafaa_sjt_items where id = v_given;
    if cur.id is null then return kafaa_refuse('sjt.item', 'sjt_items', v_given, 'not_found', 'Item not found', v_role); end if;
  end if;
  v_problem := kafaa_sjt_item_problem(p);
  if v_problem is not null then
    return kafaa_refuse('sjt.item', 'sjt_items', v_given, 'invalid', 'Check the item: ' || case v_problem
      when 'core_skill' then 'unknown core skill' when 'theme' then 'unknown theme' when 'stem' then 'a scenario in English and Arabic (up to 700 characters) is required'
      when 'options' then 'four responses in both languages (up to 240 characters each)' when 'key' then 'rate every response 0-3 with exactly one best response (3)'
      when 'notes' then 'a why for every response in both languages (up to 300 characters each)' when 'rationale' then 'the expert rationale in English and Arabic is required'
      else 'items never touch plant security' end, v_role);
  end if;
  v_status := case when p ->> 'status' = 'retired' then 'retired' else 'active' end;
  if cur.id is not null and cur.status = 'active' and (v_status = 'retired' or cur.core_skill_id <> p ->> 'core_skill_id') then
    select count(*) into v_left from kafaa_sjt_items where status = 'active' and id <> cur.id and core_skill_id = cur.core_skill_id;
    if v_left < 2 then return kafaa_refuse('sjt.item', 'sjt_items', v_given, 'conflict', 'Each core skill needs at least two active practice items', v_role); end if;
  end if;
  select array_agg(btrim(e #>> '{}') order by i) into v_oe from jsonb_array_elements(p -> 'options_en') with ordinality q(e, i);
  select array_agg(btrim(e #>> '{}') order by i) into v_oa from jsonb_array_elements(p -> 'options_ar') with ordinality q(e, i);
  select array_agg(btrim(e #>> '{}') order by i) into v_ne from jsonb_array_elements(p -> 'notes_en') with ordinality q(e, i);
  select array_agg(btrim(e #>> '{}') order by i) into v_na from jsonb_array_elements(p -> 'notes_ar') with ordinality q(e, i);
  select jsonb_agg(((e #>> '{}')::numeric)::integer order by i) into v_key from jsonb_array_elements(p -> 'expert_key') with ordinality q(e, i);
  if cur.id is not null then
    v_id := cur.id; v_version := cur.version + 1;
    update kafaa_sjt_items set core_skill_id = p ->> 'core_skill_id', theme = p ->> 'theme', stem_en = btrim(p ->> 'stem_en'), stem_ar = btrim(p ->> 'stem_ar'),
      options_en = v_oe, options_ar = v_oa, expert_key = v_key, notes_en = v_ne, notes_ar = v_na, rationale_en = btrim(p ->> 'rationale_en'), rationale_ar = btrim(p ->> 'rationale_ar'),
      status = v_status, updated_by = me, updated_at = now(), version = v_version where id = v_id;
  else
    v_id := 'sjt-' || regexp_replace(p ->> 'core_skill_id', '^cs-', '') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8); v_version := 1;
    select coalesce(max(sort), 0) + 1 into v_sort from kafaa_sjt_items;
    insert into kafaa_sjt_items (id, core_skill_id, theme, stem_en, stem_ar, options_en, options_ar, expert_key, notes_en, notes_ar, rationale_en, rationale_ar, status, version, sort, updated_by, updated_at)
    values (v_id, p ->> 'core_skill_id', p ->> 'theme', btrim(p ->> 'stem_en'), btrim(p ->> 'stem_ar'), v_oe, v_oa, v_key, v_ne, v_na, btrim(p ->> 'rationale_en'), btrim(p ->> 'rationale_ar'),
      v_status, 1, v_sort, me, now());
  end if;
  a := kafaa_audit('sjt.item', 'sjt_items', v_id, 'ok', 'v' || v_version || ' ' || v_status, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when cur.id is not null then 'Item saved' else 'Item added' end, a, null, jsonb_build_object('id', v_id, 'version', v_version, 'status', v_status));
end $$;

-- ───────────── Grants: internal helpers are not executable by API roles; RPCs only by signed-in users.
revoke all on function kafaa_cs_quarter(date), kafaa_cs_quarter_shift(text, integer), kafaa_cs_basis_rank(text), kafaa_cs_pct1(integer, integer), kafaa_cs_practice_pct(bigint, bigint),
  kafaa_cs_view(text, text, text, text), kafaa_cs_profile(text, date), kafaa_cs_stats_core(), kafaa_sjt_seed(text), kafaa_sjt_pick(text, integer, text, integer),
  kafaa_sjt_item_view(text), kafaa_sjt_feedback(text, integer), kafaa_sjt_score(jsonb), kafaa_sjt_stats_core(date), kafaa_sjt_item_problem(jsonb) from public, anon, authenticated;
revoke all on function kafaa_core_skills_mine(), kafaa_core_skills_stats(), kafaa_start_sjt(jsonb), kafaa_submit_sjt(jsonb), kafaa_sjt_context(), kafaa_sjt_stats(),
  kafaa_save_sjt_item(jsonb) from public, anon;
grant execute on function kafaa_core_skills_mine(), kafaa_core_skills_stats(), kafaa_start_sjt(jsonb), kafaa_submit_sjt(jsonb), kafaa_sjt_context(), kafaa_sjt_stats(),
  kafaa_save_sjt_item(jsonb) to authenticated;
