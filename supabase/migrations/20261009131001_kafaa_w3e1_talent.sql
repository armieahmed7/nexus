-- [W3 · E1] F18 Talent review and F19 Succession planning (module M23).
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file, RLS in the per-statement form,
-- the SQL mirror of src/modules/m23/domain.ts (evidence index, terciles and outlier flags, potential anchors, actions, aggregates,
-- succession hard gates, readiness, slate flags and aggregates; scripts/validate/w3e1-talent.mjs proves SQL = TS on the seed) and twelve RPCs.
-- LocalBackend mirror: src/modules/m23/backend/local.ts. Confidential: talent_review (HR director R/A; managers and HR BP Scope through
-- the RPCs only; employees, auditors, observers and partners nothing). Readiness reuses F05 kafaa_career_readiness_compute (20261009112001);
-- line manager of record = F08 kafaa_opp_line_manager (20261009114001).
-- Shared writes, all inside these SECURITY DEFINER functions: M07 critical_roles (bench roll-up, contract request in the F19 card:
-- rows `crit-<role>-<period>` for the succession period, e.g. 2026-H2), M14 notifications (kind `talent`).

-- ───────────── Tables (generated DDL)
-- M23 · Talent review cycle per organisation unit: open → calibration → locked (F18, confidential)
create table if not exists kafaa_review_cycles (
  id text primary key,
  code text not null unique,
  title_en text not null,
  title_ar text not null,
  period text not null,
  family_ids text[] not null default '{}'::text[],
  status text not null default 'open' check (status in ('open', 'calibration', 'locked')),
  opened_by text,
  opened_on date not null,
  due_on date,
  calibration_started_at timestamptz,
  calibration_started_by text,
  calibrated_by text,
  calibrated_at timestamptz,
  locked_by text,
  locked_at timestamptz,
  lock_note text,
  listed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table kafaa_review_cycles is '[M23] Talent review cycle per organisation unit: open → calibration → locked (F18, confidential)';

-- M23 · Performance rating mirror 1-5 (synthetic HR field, SIMULATED) (F18, confidential)
create table if not exists kafaa_perf_ratings (
  id text primary key,
  person_id text not null,
  period text not null,
  rating integer not null,
  source text not null,
  listed boolean not null default true
);
comment on table kafaa_perf_ratings is '[M23] Performance rating mirror 1-5 (synthetic HR field, SIMULATED) (F18, confidential)';

-- M23 · 9-box placement with evidence snapshot, calibration and development actions (F18, confidential)
create table if not exists kafaa_review_placements (
  id text primary key,
  cycle_id text not null,
  person_id text not null,
  perf integer not null,
  potential integer not null,
  anchors jsonb not null default '{}'::jsonb,
  box integer not null,
  hipo boolean not null default false,
  perf_record integer,
  evidence_snapshot jsonb not null default '{}'::jsonb,
  evidence_index integer not null default 0,
  placed_by text not null,
  placed_at timestamptz not null default now(),
  calibrated boolean not null default false,
  calibrated_by text,
  calibrated_at timestamptz,
  note text,
  actions jsonb not null default '[]'::jsonb,
  status text not null default 'placed' check (status in ('placed', 'locked')),
  history jsonb not null default '[]'::jsonb,
  listed boolean not null default true,
  updated_at timestamptz not null default now()
);
comment on table kafaa_review_placements is '[M23] 9-box placement with evidence snapshot, calibration and development actions (F18, confidential)';

-- M23 · Development priorities agreed in talent review, visible to the employee (no box or rating) (F18)
create table if not exists kafaa_talent_priorities (
  id text primary key,
  person_id text not null,
  cycle_id text not null,
  period text not null,
  priorities jsonb not null default '[]'::jsonb,
  agreed_on date not null,
  status text not null default 'agreed' check (status in ('agreed', 'done')),
  listed boolean not null default true,
  created_at timestamptz not null default now()
);
comment on table kafaa_talent_priorities is '[M23] Development priorities agreed in talent review, visible to the employee (no box or rating) (F18)';

-- M23 · HiPo pool from locked review cycles (feeds ESTADAD nominations, F16) (F18, confidential)
create table if not exists kafaa_talent_pool (
  id text primary key,
  cycle_id text not null,
  person_id text not null,
  pool text not null default 'hipo' check (pool in ('hipo')),
  since date not null,
  programme_id text,
  status text not null default 'active' check (status in ('active', 'left')),
  listed boolean not null default true
);
comment on table kafaa_talent_pool is '[M23] HiPo pool from locked review cycles (feeds ESTADAD nominations, F16) (F18, confidential)';

-- M23 · Succession slate for a critical or leadership role and period (F19, confidential)
create table if not exists kafaa_succession_slates (
  id text primary key,
  role_id text not null,
  period text not null,
  status text not null default 'draft' check (status in ('draft', 'proposed', 'confirmed')),
  entity_id text,
  family_id text,
  critical boolean not null default false,
  leadership boolean not null default false,
  incumbent_en text not null,
  incumbent_ar text not null,
  target_bench integer not null default 3,
  confirmed_by text,
  confirmed_at timestamptz,
  confirm_note text,
  listed boolean not null default true,
  sort integer not null default 0,
  updated_at timestamptz not null default now()
);
comment on table kafaa_succession_slates is '[M23] Succession slate for a critical or leadership role and period (F19, confidential)';

-- M23 · Successor (or external emergency cover role card) on a slate, readiness, gates and gap actions (F19, confidential)
create table if not exists kafaa_successors (
  id text primary key,
  slate_id text not null,
  person_id text,
  cover_source text not null default 'internal' check (cover_source in ('internal', 'khnp', 'contractor')),
  cover_label_en text not null default '',
  cover_label_ar text not null default '',
  readiness text check (readiness in ('ready_now', '1_2y', '3_5y')),
  computed_readiness text check (computed_readiness in ('ready_now', '1_2y', '3_5y')),
  readiness_pct integer,
  months integer,
  gates jsonb not null default '[]'::jsonb,
  gaps jsonb not null default '[]'::jsonb,
  emergency boolean not null default false,
  actions jsonb not null default '[]'::jsonb,
  note text,
  status text not null default 'proposed' check (status in ('proposed', 'confirmed', 'withdrawn')),
  proposed_by text,
  proposed_at timestamptz not null default now(),
  confirmed_by text,
  confirmed_at timestamptz,
  person_name text not null default '',
  person_name_ar text not null default '',
  person_role_id text,
  listed boolean not null default true,
  sort integer not null default 0,
  updated_at timestamptz not null default now()
);
comment on table kafaa_successors is '[M23] Successor (or external emergency cover role card) on a slate, readiness, gates and gap actions (F19, confidential)';

-- M23 · Bench roll-up from confirmed slates into M07 critical-role counts (before and after) (F19)
create table if not exists kafaa_bench_rollups (
  id text primary key,
  period text not null,
  role_id text not null,
  slate_id text not null,
  critical_role_id text not null,
  before jsonb not null default '{}'::jsonb,
  after jsonb not null default '{}'::jsonb,
  rolled_by text,
  rolled_at timestamptz not null default now(),
  listed boolean not null default true
);
comment on table kafaa_bench_rollups is '[M23] Bench roll-up from confirmed slates into M07 critical-role counts (before and after) (F19)';

do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_review_cycles_opened_by_fk') then alter table kafaa_review_cycles add constraint kafaa_review_cycles_opened_by_fk foreign key (opened_by) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_review_cycles_calibration_started_by_fk') then alter table kafaa_review_cycles add constraint kafaa_review_cycles_calibration_started_by_fk foreign key (calibration_started_by) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_review_cycles_calibrated_by_fk') then alter table kafaa_review_cycles add constraint kafaa_review_cycles_calibrated_by_fk foreign key (calibrated_by) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_review_cycles_locked_by_fk') then alter table kafaa_review_cycles add constraint kafaa_review_cycles_locked_by_fk foreign key (locked_by) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_perf_ratings_person_id_fk') then alter table kafaa_perf_ratings add constraint kafaa_perf_ratings_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_review_placements_cycle_id_fk') then alter table kafaa_review_placements add constraint kafaa_review_placements_cycle_id_fk foreign key (cycle_id) references kafaa_review_cycles(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_review_placements_person_id_fk') then alter table kafaa_review_placements add constraint kafaa_review_placements_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_review_placements_placed_by_fk') then alter table kafaa_review_placements add constraint kafaa_review_placements_placed_by_fk foreign key (placed_by) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_review_placements_calibrated_by_fk') then alter table kafaa_review_placements add constraint kafaa_review_placements_calibrated_by_fk foreign key (calibrated_by) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_talent_priorities_person_id_fk') then alter table kafaa_talent_priorities add constraint kafaa_talent_priorities_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_talent_priorities_cycle_id_fk') then alter table kafaa_talent_priorities add constraint kafaa_talent_priorities_cycle_id_fk foreign key (cycle_id) references kafaa_review_cycles(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_talent_pool_cycle_id_fk') then alter table kafaa_talent_pool add constraint kafaa_talent_pool_cycle_id_fk foreign key (cycle_id) references kafaa_review_cycles(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_talent_pool_person_id_fk') then alter table kafaa_talent_pool add constraint kafaa_talent_pool_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_succession_slates_role_id_fk') then alter table kafaa_succession_slates add constraint kafaa_succession_slates_role_id_fk foreign key (role_id) references kafaa_job_roles(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_succession_slates_confirmed_by_fk') then alter table kafaa_succession_slates add constraint kafaa_succession_slates_confirmed_by_fk foreign key (confirmed_by) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_successors_slate_id_fk') then alter table kafaa_successors add constraint kafaa_successors_slate_id_fk foreign key (slate_id) references kafaa_succession_slates(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_successors_person_id_fk') then alter table kafaa_successors add constraint kafaa_successors_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_successors_proposed_by_fk') then alter table kafaa_successors add constraint kafaa_successors_proposed_by_fk foreign key (proposed_by) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_successors_confirmed_by_fk') then alter table kafaa_successors add constraint kafaa_successors_confirmed_by_fk foreign key (confirmed_by) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_bench_rollups_role_id_fk') then alter table kafaa_bench_rollups add constraint kafaa_bench_rollups_role_id_fk foreign key (role_id) references kafaa_job_roles(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_bench_rollups_slate_id_fk') then alter table kafaa_bench_rollups add constraint kafaa_bench_rollups_slate_id_fk foreign key (slate_id) references kafaa_succession_slates(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_bench_rollups_rolled_by_fk') then alter table kafaa_bench_rollups add constraint kafaa_bench_rollups_rolled_by_fk foreign key (rolled_by) references kafaa_people(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_review_cycles_period_idx on kafaa_review_cycles (period);
create index if not exists kafaa_review_cycles_status_idx on kafaa_review_cycles (status);
create index if not exists kafaa_review_cycles_opened_by_idx on kafaa_review_cycles (opened_by);
create index if not exists kafaa_review_cycles_calibration_started_by_idx on kafaa_review_cycles (calibration_started_by);
create index if not exists kafaa_review_cycles_calibrated_by_idx on kafaa_review_cycles (calibrated_by);
create index if not exists kafaa_review_cycles_locked_by_idx on kafaa_review_cycles (locked_by);
create index if not exists kafaa_perf_ratings_person_id_idx on kafaa_perf_ratings (person_id);
create index if not exists kafaa_review_placements_cycle_id_idx on kafaa_review_placements (cycle_id);
create index if not exists kafaa_review_placements_person_id_idx on kafaa_review_placements (person_id);
create index if not exists kafaa_review_placements_placed_by_idx on kafaa_review_placements (placed_by);
create index if not exists kafaa_review_placements_calibrated_by_idx on kafaa_review_placements (calibrated_by);
create index if not exists kafaa_talent_priorities_person_id_idx on kafaa_talent_priorities (person_id);
create index if not exists kafaa_talent_priorities_cycle_id_idx on kafaa_talent_priorities (cycle_id);
create index if not exists kafaa_talent_pool_cycle_id_idx on kafaa_talent_pool (cycle_id);
create index if not exists kafaa_talent_pool_person_id_idx on kafaa_talent_pool (person_id);
create index if not exists kafaa_succession_slates_role_id_idx on kafaa_succession_slates (role_id);
create index if not exists kafaa_succession_slates_period_idx on kafaa_succession_slates (period);
create index if not exists kafaa_succession_slates_confirmed_by_idx on kafaa_succession_slates (confirmed_by);
create index if not exists kafaa_successors_slate_id_idx on kafaa_successors (slate_id);
create index if not exists kafaa_successors_person_id_idx on kafaa_successors (person_id);
create index if not exists kafaa_successors_status_idx on kafaa_successors (status);
create index if not exists kafaa_successors_proposed_by_idx on kafaa_successors (proposed_by);
create index if not exists kafaa_successors_confirmed_by_idx on kafaa_successors (confirmed_by);
create index if not exists kafaa_bench_rollups_period_idx on kafaa_bench_rollups (period);
create index if not exists kafaa_bench_rollups_role_id_idx on kafaa_bench_rollups (role_id);
create index if not exists kafaa_bench_rollups_slate_id_idx on kafaa_bench_rollups (slate_id);
create index if not exists kafaa_bench_rollups_rolled_by_idx on kafaa_bench_rollups (rolled_by);

-- ───────────── RLS: confidential. Only an R/W/A grant on talent_review (the HR director) reads rows directly (`listed` is always
-- true); line managers and the HR business partner (Scope) read through the RPCs below, which apply their scope and never return
-- the caller's own placement. talent_priorities is also readable by the person (own_profile Own). Writes only through the RPCs.
alter table kafaa_review_cycles enable row level security;
alter table kafaa_perf_ratings enable row level security;
alter table kafaa_review_placements enable row level security;
alter table kafaa_talent_priorities enable row level security;
alter table kafaa_talent_pool enable row level security;
alter table kafaa_succession_slates enable row level security;
alter table kafaa_successors enable row level security;
alter table kafaa_bench_rollups enable row level security;
do $$
declare t text;
begin
  foreach t in array array['kafaa_review_cycles', 'kafaa_perf_ratings', 'kafaa_review_placements', 'kafaa_talent_priorities', 'kafaa_talent_pool', 'kafaa_succession_slates', 'kafaa_successors', 'kafaa_bench_rollups'] loop
    if not exists (select 1 from pg_policies where tablename = t and policyname = 'kafaa_read') then
      execute format('create policy kafaa_read on %I for select to anon, authenticated using (false)', t);
    end if;
  end loop;
end $$;
alter policy kafaa_read on kafaa_review_cycles using (((COALESCE(listed, false) AND (SELECT kafaa_has_grant('talent_review'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_perf_ratings using (((COALESCE(listed, false) AND (SELECT kafaa_has_grant('talent_review'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_review_placements using (((COALESCE(listed, false) AND (SELECT kafaa_has_grant('talent_review'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_talent_priorities using ((((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false))) OR ((COALESCE(listed, false) AND (SELECT kafaa_has_grant('talent_review'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_talent_pool using (((COALESCE(listed, false) AND (SELECT kafaa_has_grant('talent_review'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_succession_slates using (((COALESCE(listed, false) AND (SELECT kafaa_has_grant('talent_review'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_successors using (((COALESCE(listed, false) AND (SELECT kafaa_has_grant('talent_review'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
alter policy kafaa_read on kafaa_bench_rollups using (((COALESCE(listed, false) AND (SELECT kafaa_has_grant('talent_review'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))));
grant select on kafaa_review_cycles, kafaa_perf_ratings, kafaa_review_placements, kafaa_talent_priorities, kafaa_talent_pool, kafaa_succession_slates, kafaa_successors, kafaa_bench_rollups to anon, authenticated;
revoke insert, update on kafaa_review_cycles, kafaa_perf_ratings, kafaa_review_placements, kafaa_talent_priorities, kafaa_talent_pool, kafaa_succession_slates, kafaa_successors, kafaa_bench_rollups from anon, authenticated;

-- ───────────── Pure helpers (mirror of src/modules/m23/domain.ts; internal)
create or replace function kafaa_tr_ts() returns text language sql stable set search_path = public as $$
  select to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
$$;
create or replace function kafaa_tr_str(p jsonb) returns text language sql immutable set search_path = public as $$
  select case when jsonb_typeof(p) = 'string' then btrim(p #>> '{}', E' \t\r\n') else '' end
$$;
create or replace function kafaa_tr_int(p jsonb, p_lo integer, p_hi integer) returns integer language sql immutable set search_path = public as $$
  select case when jsonb_typeof(p) = 'number' and (p #>> '{}')::numeric = trunc((p #>> '{}')::numeric) and (p #>> '{}')::numeric between p_lo and p_hi then (p #>> '{}')::integer end
$$;

-- Evidence index (evidenceOf): integer points, floor division; self-claimed ratings never count as growth or agility.
create or replace function kafaa_tr_evidence(p_person text, p_now date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_since date := p_now - 365; b integer; d integer; g integer; v integer; o integer; a integer;
  pb integer; pd integer; pg integer; pv integer; po integer; pa integer;
begin
  select count(*) filter (where s.level >= 2), count(*) filter (where s.level >= 3) into b, d
    from kafaa_person_skills s where s.person_id = p_person and s.active is distinct from false;
  select count(distinct e.skill_id) into g from kafaa_skill_evidence e
   where e.person_id = p_person and e.active is distinct from false and e.basis <> 'claimed' and e.observed_on >= v_since and e.observed_on <= p_now;
  select count(distinct e.skill_id) into v from kafaa_skill_evidence e where e.person_id = p_person and e.active is distinct from false and e.basis = 'validated';
  select count(distinct e.ref_id) into o from kafaa_skill_evidence e where e.person_id = p_person and e.active is distinct from false and e.kind = 'ojt';
  select count(distinct e.skill_id) into a from kafaa_skill_evidence e join kafaa_skills k on k.id = e.skill_id
   where e.person_id = p_person and e.active is distinct from false and e.basis <> 'claimed' and e.observed_on >= v_since and e.observed_on <= p_now and e.level >= k.key_level;
  pb := (least(b, 20) * 25) / 20; pd := (least(d, 12) * 15) / 12; pg := (least(g, 15) * 20) / 15;
  pv := (least(v, 4) * 15) / 4; po := (least(o, 3) * 10) / 3; pa := (least(a, 8) * 15) / 8;
  return jsonb_build_object('breadth', b, 'depth', d, 'growth', g, 'validated', v, 'opportunities', o, 'agility', a,
    'index', pb + pd + pg + pv + po + pa,
    'points', jsonb_build_object('breadth', pb, 'depth', pd, 'growth', pg, 'validated', pv, 'opportunities', po, 'agility', pa),
    'as_of', to_char(p_now, 'YYYY-MM-DD'));
end $$;

-- Tercile cut-offs (cutsOf): low = highest index of the bottom third, high = lowest index of the top third; null under 3 people.
create or replace function kafaa_tr_cuts(p int[]) returns jsonb language plpgsql immutable set search_path = public as $$
declare v int[]; n integer; k integer;
begin
  n := coalesce(array_length(p, 1), 0);
  if n < 3 then return null; end if;
  select array_agg(x order by x) into v from unnest(p) x;
  k := ceil(n / 3.0)::integer - 1;
  return jsonb_build_object('low', v[k + 1], 'high', v[n - k]);
end $$;
create or replace function kafaa_tr_flags(p_potential integer, p_index integer, p_cuts jsonb) returns jsonb language sql immutable set search_path = public as $$
  select case when p_cuts is null or jsonb_typeof(p_cuts) <> 'object' or p_potential is null then '[]'::jsonb else
    (case when p_potential = 3 and p_index <= (p_cuts->>'low')::int then '["potential_high_evidence_low"]'::jsonb else '[]'::jsonb end)
    || (case when p_potential = 1 and p_index >= (p_cuts->>'high')::int then '["potential_low_evidence_high"]'::jsonb else '[]'::jsonb end) end
$$;
-- Potential = median of the three anchors (each a whole number 1-3), else null.
create or replace function kafaa_tr_potential(p jsonb) returns integer language plpgsql immutable set search_path = public as $$
declare a integer; b integer; c integer;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return null; end if;
  a := kafaa_tr_int(p->'agility', 1, 3); b := kafaa_tr_int(p->'influence', 1, 3); c := kafaa_tr_int(p->'drive', 1, 3);
  if a is null or b is null or c is null then return null; end if;
  return (select x from unnest(array[a, b, c]) x order by x offset 1 limit 1);
end $$;
create or replace function kafaa_tr_perf_map(p integer) returns integer language sql immutable set search_path = public as $$
  select case when p is null then null when p <= 2 then 1 when p = 3 then 2 else 3 end
$$;
create or replace function kafaa_tr_perf(p_person text) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('period', r.period, 'rating', r.rating) from kafaa_perf_ratings r where r.person_id = p_person order by r.period collate "C" desc, r.id collate "C" limit 1
$$;
-- Development actions (normActions): up to 5; known kind; a title in at least one language; each title at most 200 characters.
create or replace function kafaa_tr_actions_norm(p jsonb) returns jsonb language plpgsql immutable set search_path = public as $$
declare x jsonb; v_out jsonb := '[]'::jsonb; en text; ar text;
begin
  if p is null or jsonb_typeof(p) <> 'array' or jsonb_array_length(p) > 5 then return null; end if;
  for x in select e from jsonb_array_elements(p) e loop
    if jsonb_typeof(x) <> 'object' then return null; end if;
    if jsonb_typeof(x->'kind') is distinct from 'string' or (x->>'kind') not in ('training', 'rotation', 'mentoring', 'stretch', 'coaching') then return null; end if;
    en := kafaa_tr_str(x->'title_en'); ar := kafaa_tr_str(x->'title_ar');
    if (en = '' and ar = '') or char_length(en) > 200 or char_length(ar) > 200 then return null; end if;
    v_out := v_out || jsonb_build_array(jsonb_build_object('kind', x->>'kind', 'title_en', coalesce(nullif(en, ''), ar), 'title_ar', coalesce(nullif(ar, ''), en),
      'ref_table', case when jsonb_typeof(x->'ref_table') = 'string' and x->>'ref_table' <> '' then x->>'ref_table' end,
      'ref_id', case when jsonb_typeof(x->'ref_id') = 'string' and x->>'ref_id' <> '' then x->>'ref_id' end));
  end loop;
  return v_out;
end $$;
-- Cycle members (membersOf): active staff with a job role in one of the families, never the HR director.
create or replace function kafaa_tr_members(p_families text[]) returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(p.id order by p.id collate "C"), '{}'::text[]) from kafaa_people p
   where p.kind = 'staff' and p.status = 'active' and p.job_role_id is not null and p.job_family_id is not null and p.job_family_id = any(coalesce(p_families, '{}'::text[]))
     and not exists (select 1 from kafaa_role_assignments a where a.person_id = p.id and a.role = 'hr_director' and a.status = 'active' and (a.expires_at is null or a.expires_at >= current_date))
$$;
-- Board visibility: R/W/A everyone; Scope holders people in scope or their reports of record. Never the caller.
create or replace function kafaa_tr_sees(p_person text) returns boolean language sql stable security definer set search_path = public as $$
  select kafaa_me() is not null and p_person <> kafaa_me() and (kafaa_has_grant('talent_review', array['R', 'W', 'A'])
    or (kafaa_has_grant('talent_review', array['Scope']) and (kafaa_in_scope('talent_review', p_person) or kafaa_opp_line_manager(p_person) = kafaa_me())))
$$;
-- A line manager places: manager role, in scope or line manager of record, never themselves.
create or replace function kafaa_tr_can_place(p_person text) returns boolean language sql stable security definer set search_path = public as $$
  select kafaa_me() is not null and p_person <> kafaa_me() and kafaa_has_role('manager')
     and (kafaa_in_scope('talent_review', p_person) or kafaa_opp_line_manager(p_person) = kafaa_me())
$$;
-- Index per member: the placement's evidence snapshot when placed, else the live evidence.
create or replace function kafaa_tr_cycle_indices(p_cycle text, p_ids text[]) returns int[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(coalesce(pl.evidence_index, (kafaa_tr_evidence(u.x, current_date)->>'index')::int) order by u.o), '{}'::int[])
    from unnest(p_ids) with ordinality u(x, o) left join kafaa_review_placements pl on pl.id = 'tp:' || p_cycle || ':' || u.x
$$;
create or replace function kafaa_tr_hist(p_action text, p_extra jsonb) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('at', kafaa_tr_ts(), 'by', kafaa_me(), 'action', p_action) || coalesce(p_extra, '{}'::jsonb)
$$;
create or replace function kafaa_tr_name(p_person text) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('en', coalesce(p.display_name, ''), 'ar', coalesce(nullif(p.display_name_ar, ''), p.display_name, '')) from kafaa_people p where p.id = p_person
$$;

-- HR aggregates (talentAggregatesOf): every cell under the minimum group size suppressed, women and Emirati splits included.
create or replace function kafaa_tr_aggregates(p_cycle text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare mg integer := (kafaa_rules()->>'minGroupSize')::int; v_total integer; v_sup boolean; v_cells jsonb := '[]'::jsonb; b integer; n integer; w integer; e integer; v_w integer; v_e integer; v_h integer; v_by jsonb;
begin
  select count(*), count(*) filter (where pp.gender = 'f'), count(*) filter (where pp.nationality_flag = 'uae'), count(*) filter (where r.potential = 3 and r.perf >= 2)
    into v_total, v_w, v_e, v_h
    from kafaa_review_placements r left join kafaa_people pp on pp.id = r.person_id where p_cycle is null or r.cycle_id = p_cycle;
  v_sup := v_total < mg;
  for b in 1..9 loop
    select count(*), count(*) filter (where pp.gender = 'f'), count(*) filter (where pp.nationality_flag = 'uae') into n, w, e
      from kafaa_review_placements r left join kafaa_people pp on pp.id = r.person_id where (p_cycle is null or r.cycle_id = p_cycle) and (r.potential - 1) * 3 + r.perf = b;
    v_cells := v_cells || jsonb_build_array(jsonb_build_object('box', b, 'n', case when v_sup or n < mg then null else n end,
      'women', case when v_sup or w < mg then null else w end, 'emirati', case when v_sup or e < mg then null else e end));
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('cycle_id', z.id, 'n', case when z.n >= mg then z.n end, 'placed', case when z.n >= mg then z.n end, 'calibrated', case when z.c >= mg then z.c end) order by z.id collate "C"), '[]'::jsonb)
    into v_by
    from (select c.id, (select count(*) from kafaa_review_placements r where r.cycle_id = c.id)::int as n, (select count(*) from kafaa_review_placements r where r.cycle_id = c.id and r.calibrated)::int as c
            from kafaa_review_cycles c where p_cycle is null or c.id = p_cycle) z;
  return jsonb_build_object('cycle_id', p_cycle, 'n', case when v_sup then null else v_total end, 'suppressed', v_sup, 'min_group', mg, 'cells', v_cells,
    'women', case when v_sup or v_w < mg then null else v_w end, 'emirati', case when v_sup or v_e < mg then null else v_e end,
    'hipo', case when v_sup or v_h < mg then null else v_h end, 'by_cycle', v_by);
end $$;

-- ───────────── Succession helpers (mirror of hardGatesOf / readinessOf / candidateReasons / slateFlags / successionAggregatesOf)
create or replace function kafaa_sx_gates(p_person text, p_role text, p_cr jsonb, p_now date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_out jsonb := '[]'::jsonb; v_lic text[]; v_held text; v_stds text[]; v_cur text; v_role text; v_st text;
begin
  v_lic := case p_role when 'reactor-operator' then array['RO', 'SRO'] when 'senior-reactor-operator' then array['SRO'] when 'shift-supervisor' then array['SRO'] end;
  if v_lic is not null then
    select l.type into v_held from kafaa_licences l where l.person_id = p_person and l.status = 'valid' and (l.expires_on is null or l.expires_on >= p_now) and l.type = any(v_lic) order by l.type collate "C" limit 1;
    v_out := v_out || jsonb_build_array(jsonb_build_object('code', 'licence', 'met', v_held is not null, 'required', to_jsonb(v_lic), 'detail', v_held));
  end if;
  select array_agg(s.id order by s.id collate "C") into v_stds from kafaa_qual_standards s where s.security_restricted is not true and p_role = any(coalesce(s.role_ids, '{}'::text[]));
  if v_stds is not null then
    select r.standard_id into v_cur from kafaa_qual_records r where r.person_id = p_person and r.standard_id = any(v_stds) and r.status in ('qualified', 'due', 'renewed')
       and (r.expires_on is null or r.expires_on >= p_now) order by r.standard_id collate "C" limit 1;
    v_out := v_out || jsonb_build_array(jsonb_build_object('code', 'qualification', 'met', v_cur is not null, 'required', to_jsonb(v_stds), 'detail', v_cur));
  end if;
  select p.job_role_id into v_role from kafaa_people p where p.id = p_person;
  if v_role is distinct from p_role then
    v_st := coalesce(p_cr->>'gate_status', 'none');
    v_out := v_out || jsonb_build_array(jsonb_build_object('code', 'route', 'met', v_st <> 'not_met',
      'required', case when coalesce(p_cr->>'primary_route', '') <> '' then jsonb_build_array(p_cr->>'primary_route') else '[]'::jsonb end, 'detail', v_st));
  end if;
  return v_out;
end $$;
create or replace function kafaa_sx_gates_met(p_gates jsonb) returns boolean language sql immutable set search_path = public as $$
  select not exists (select 1 from jsonb_array_elements(coalesce(p_gates, '[]'::jsonb)) g where (g->>'met')::boolean is not true)
$$;
create or replace function kafaa_sx_readiness(p_cr jsonb, p_gates jsonb) returns text language sql immutable set search_path = public as $$
  select case
    when p_cr is null or jsonb_typeof(p_cr) <> 'object' or coalesce((p_cr->>'path_only')::boolean, false) or jsonb_typeof(p_cr->'score') is distinct from 'number' then '3_5y'
    when (p_cr->>'score')::float8 >= 0.85 and kafaa_sx_gates_met(p_gates) then 'ready_now'
    when coalesce((p_cr->>'months')::integer, 999) <= 24 then '1_2y'
    else '3_5y' end
$$;
create or replace function kafaa_sx_reasons(p_cr jsonb, p_gates jsonb) returns jsonb language sql immutable set search_path = public as $$
  select coalesce((select jsonb_agg(r.v order by r.o) from jsonb_array_elements(case when jsonb_typeof(p_cr->'reasons') = 'array' then p_cr->'reasons' else '[]'::jsonb end) with ordinality r(v, o) where r.o <= 4), '[]'::jsonb)
      || coalesce((select jsonb_agg(jsonb_build_object(
            'code', 'gate_' || (g.v->>'code') || '_' || case when (g.v->>'met')::boolean then 'met' else 'not_met' end,
            'key', 'm23.reasons.gate_' || (g.v->>'code') || '_' || case when (g.v->>'met')::boolean then 'met' else 'not_met' end,
            'vars', jsonb_build_object('req', coalesce(nullif((select string_agg(x, ' / ' order by o) from jsonb_array_elements_text(g.v->'required') with ordinality q(x, o)), ''), '—')))
          order by g.o) from jsonb_array_elements(coalesce(p_gates, '[]'::jsonb)) with ordinality g(v, o)), '[]'::jsonb)
$$;
-- Readiness of one person for one role: F05 career readiness (kafaa_career_readiness_compute) + hard gates.
create or replace function kafaa_sx_assess(p_person text, p_role text, p_now date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_cr jsonb; v_g jsonb;
begin
  v_cr := kafaa_career_readiness_compute(p_person, array[p_role], p_now) -> 0;
  v_g := kafaa_sx_gates(p_person, p_role, v_cr, p_now);
  return jsonb_build_object('cr', v_cr, 'gates', v_g, 'readiness', kafaa_sx_readiness(v_cr, v_g));
end $$;
create or replace function kafaa_sx_load(p_person text) returns integer language sql stable security definer set search_path = public as $$
  select count(distinct x.slate_id)::int from kafaa_successors x where x.person_id = p_person and x.status in ('proposed', 'confirmed')
$$;
create or replace function kafaa_sx_flags(p_slate text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_out jsonb := '[]'::jsonb; v_ready boolean;
begin
  v_ready := exists (select 1 from kafaa_successors s where s.slate_id = p_slate and s.status in ('proposed', 'confirmed') and s.cover_source = 'internal' and s.person_id is not null and s.readiness = 'ready_now');
  if not v_ready then v_out := v_out || '["no_ready_now"]'::jsonb; end if;
  if exists (select 1 from kafaa_successors s where s.slate_id = p_slate and s.status in ('proposed', 'confirmed') and s.cover_source = 'internal' and s.person_id is not null and kafaa_sx_load(s.person_id) > 2) then
    v_out := v_out || '["successor_overloaded"]'::jsonb; end if;
  if exists (select 1 from kafaa_successors s where s.slate_id = p_slate and s.status in ('proposed', 'confirmed') and s.cover_source <> 'internal' and s.emergency)
     or (exists (select 1 from kafaa_successors s where s.slate_id = p_slate and s.status in ('proposed', 'confirmed') and s.cover_source <> 'internal') and not v_ready) then
    v_out := v_out || '["external_cover"]'::jsonb; end if;
  if not exists (select 1 from kafaa_successors s where s.slate_id = p_slate and s.status in ('proposed', 'confirmed') and s.emergency) then v_out := v_out || '["no_emergency"]'::jsonb; end if;
  return v_out;
end $$;
create or replace function kafaa_sx_aggregates() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare mg integer := (kafaa_rules()->>'minGroupSize')::int; n integer; emi integer; wom integer;
begin
  select count(*), count(*) filter (where p.nationality_flag = 'uae'), count(*) filter (where p.gender = 'f') into n, emi, wom
    from (select distinct s.person_id from kafaa_successors s where s.status in ('proposed', 'confirmed') and s.cover_source = 'internal' and s.person_id is not null) d
    left join kafaa_people p on p.id = d.person_id;
  return jsonb_build_object(
    'slates', (select count(*) from kafaa_succession_slates),
    'confirmed', (select count(*) from kafaa_succession_slates where status = 'confirmed'),
    'with_ready_now', (select count(*) from kafaa_succession_slates sl where exists (select 1 from kafaa_successors s where s.slate_id = sl.id and s.status in ('proposed', 'confirmed') and s.cover_source = 'internal' and s.person_id is not null and s.readiness = 'ready_now')),
    'successors', n,
    'emirati', case when n >= mg and emi >= mg then emi end,
    'women', case when n >= mg and wom >= mg then wom end,
    'emirati_pct', case when n >= mg and emi >= mg then round((emi * 100)::numeric / n)::int end,
    'women_pct', case when n >= mg and wom >= mg then round((wom * 100)::numeric / n)::int end,
    'by_readiness', (select jsonb_build_object('ready_now', count(*) filter (where s.readiness = 'ready_now'), '1_2y', count(*) filter (where s.readiness = '1_2y'), '3_5y', count(*) filter (where s.readiness = '3_5y'))
                       from kafaa_successors s where s.status in ('proposed', 'confirmed') and s.cover_source = 'internal' and s.person_id is not null),
    'min_group', mg);
end $$;
-- Function-scoped slate visibility (slateInScope) for executives and the HR business partner; R/W/A sees every slate.
create or replace function kafaa_sx_visible(p_entity text, p_family text) returns boolean language sql stable security definer set search_path = public as $$
  select kafaa_has_grant('talent_review', array['R', 'W', 'A']) or exists (
    select 1 from kafaa_role_assignments ra join kafaa_policy_matrix m on m.role = ra.role and m.resource = 'talent_review' and m.level = 'Scope'
     where ra.person_id = kafaa_me() and ra.status = 'active' and (ra.expires_at is null or ra.expires_at >= current_date)
       and (ra.scope_type = 'all' or (ra.scope_type = 'entity' and p_entity is not null and ra.scope_value = p_entity) or (ra.scope_type = 'family' and p_family is not null and ra.scope_value = p_family)))
$$;
create or replace function kafaa_sx_successor_json(s kafaa_successors) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', s.id, 'person_id', s.person_id, 'cover_source', s.cover_source, 'cover_label_en', s.cover_label_en, 'cover_label_ar', s.cover_label_ar,
    'readiness', s.readiness, 'computed_readiness', s.computed_readiness, 'readiness_pct', s.readiness_pct, 'months', s.months, 'gates', s.gates, 'gaps', s.gaps,
    'emergency', s.emergency, 'actions', s.actions, 'note', s.note, 'status', s.status, 'slates', case when s.person_id is null then 0 else kafaa_sx_load(s.person_id) end,
    'person_name', s.person_name, 'person_name_ar', s.person_name_ar, 'person_role_id', s.person_role_id, 'confirmed_at', s.confirmed_at, 'proposed_at', s.proposed_at)
$$;

-- ───────────── F18 RPCs
-- Review cycles visible to the caller, with counts in their view. Read-only, not audited (a list of cycle names).
create or replace function kafaa_talent_cycles() returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_all boolean; c kafaa_review_cycles; v_ids text[]; v_view text[]; v_out jsonb := '[]'::jsonb; v_pl integer; v_cal integer;
begin
  if me is null then return kafaa_refuse('talent.cycles', 'review_cycles', null, 'not_signed_in', 'Sign in to use talent review'); end if;
  if kafaa_acting_role('talent_review', array['R', 'A', 'Scope']) is null then return kafaa_refuse('talent.cycles', 'review_cycles', null, 'forbidden', 'Talent review is for line managers and HR'); end if;
  v_all := kafaa_has_grant('talent_review', array['R', 'W', 'A']);
  for c in select * from kafaa_review_cycles order by period collate "C" desc, code collate "C" loop
    v_ids := kafaa_tr_members(c.family_ids);
    select coalesce(array_agg(x order by x collate "C"), '{}'::text[]) into v_view from unnest(v_ids) x where kafaa_tr_sees(x);
    if not v_all and coalesce(array_length(v_view, 1), 0) = 0 then continue; end if;
    select count(*), count(*) filter (where pl.calibrated) into v_pl, v_cal from kafaa_review_placements pl where pl.cycle_id = c.id and pl.person_id = any(v_view);
    v_out := v_out || jsonb_build_array(jsonb_build_object('id', c.id, 'code', c.code, 'title_en', c.title_en, 'title_ar', c.title_ar, 'period', c.period, 'family_ids', to_jsonb(c.family_ids),
      'status', c.status, 'opened_on', c.opened_on, 'due_on', c.due_on, 'members', coalesce(array_length(v_ids, 1), 0), 'in_view', coalesce(array_length(v_view, 1), 0),
      'placed_in_view', v_pl, 'calibrated_in_view', v_cal, 'locked_at', c.locked_at, 'calibrated_at', c.calibrated_at));
  end loop;
  return kafaa_result(true, 'ok', '', null::kafaa_audit_events, null, v_out);
end $$;

-- The board of one cycle. Audited read.
create or replace function kafaa_talent_board(p_cycle_id text) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; v_all boolean; c kafaa_review_cycles; v_ids text[]; v_idx int[]; v_cuts jsonb; v_pid text; p kafaa_people; pl kafaa_review_placements;
  v_ev jsonb; v_i integer; v_rec jsonb; v_members jsonb := '[]'::jsonb; v_place jsonb; v_maker boolean; v_block text; v_isA boolean; v_n integer := 0; v_any_place boolean := false; v_can boolean; v_o integer;
  a kafaa_audit_events; v_placed integer;
begin
  if me is null then return kafaa_refuse('talent.board_read', 'review_placements', p_cycle_id, 'not_signed_in', 'Sign in to use talent review'); end if;
  v_role := kafaa_acting_role('talent_review', array['R', 'A', 'Scope']);
  if v_role is null then return kafaa_refuse('talent.board_read', 'review_placements', p_cycle_id, 'forbidden', 'Talent review is for line managers and HR'); end if;
  select * into c from kafaa_review_cycles where id = p_cycle_id;
  v_all := kafaa_has_grant('talent_review', array['R', 'W', 'A']);
  v_ids := case when c.id is null then '{}'::text[] else kafaa_tr_members(c.family_ids) end;
  if c.id is null or (not v_all and not exists (select 1 from unnest(v_ids) x where kafaa_tr_sees(x))) then
    return kafaa_refuse('talent.board_read', 'review_placements', p_cycle_id, 'not_found', 'Review cycle not found', v_role); end if;
  v_idx := kafaa_tr_cycle_indices(c.id, v_ids);
  v_cuts := kafaa_tr_cuts(v_idx);
  for v_pid, v_o in select u.x, u.o from unnest(v_ids) with ordinality u(x, o) order by u.o loop
    if not kafaa_tr_sees(v_pid) then continue; end if;
    select * into p from kafaa_people where id = v_pid;
    select * into pl from kafaa_review_placements where id = 'tp:' || c.id || ':' || v_pid;
    v_ev := kafaa_tr_evidence(v_pid, current_date);
    v_i := v_idx[v_o];
    v_rec := kafaa_tr_perf(v_pid);
    v_can := c.status = 'open' and kafaa_tr_can_place(v_pid);
    v_any_place := v_any_place or v_can;
    v_place := case when pl.id is null then null else jsonb_build_object('id', pl.id, 'perf', pl.perf, 'potential', pl.potential, 'anchors', pl.anchors, 'box', pl.box, 'hipo', pl.hipo,
      'perf_record', pl.perf_record, 'evidence_index', pl.evidence_index, 'evidence_snapshot', pl.evidence_snapshot, 'placed_by', pl.placed_by,
      'placed_by_name', kafaa_tr_name(pl.placed_by)->>'en', 'placed_by_name_ar', kafaa_tr_name(pl.placed_by)->>'ar', 'placed_at', pl.placed_at, 'calibrated', pl.calibrated,
      'calibrated_at', pl.calibrated_at, 'note', pl.note, 'actions', pl.actions, 'status', pl.status, 'history', pl.history) end;
    v_members := v_members || jsonb_build_array(jsonb_build_object('person_id', v_pid, 'name', p.display_name, 'name_ar', coalesce(nullif(p.display_name_ar, ''), p.display_name),
      'role_id', p.job_role_id, 'family_id', p.job_family_id, 'crew', p.crew, 'team_id', p.team_id, 'perf_rating', v_rec, 'suggested_perf', kafaa_tr_perf_map((v_rec->>'rating')::int),
      'evidence', v_ev, 'index', v_i, 'flags', case when pl.id is null then '[]'::jsonb else kafaa_tr_flags(pl.potential, v_i, v_cuts) end, 'can_place', v_can, 'placement', v_place));
    v_n := v_n + 1;
  end loop;
  select count(*) into v_placed from kafaa_review_placements r where r.cycle_id = c.id and r.person_id = any(v_ids);
  v_maker := c.calibrated_by = me or exists (select 1 from kafaa_review_placements r where r.cycle_id = c.id and r.person_id = any(v_ids) and (r.placed_by = me or r.calibrated_by = me));
  v_block := case when c.status = 'locked' then 'locked' when c.status <> 'calibration' or c.calibrated_at is null then 'not_calibrated' when v_maker then 'maker_checker' end;
  v_isA := kafaa_has_grant('talent_review', array['A']);
  a := kafaa_audit('talent.board_read', 'review_placements', c.id, 'ok', v_n || ' people', 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', '', a, null, jsonb_build_object(
    'cycle', jsonb_build_object('id', c.id, 'code', c.code, 'title_en', c.title_en, 'title_ar', c.title_ar, 'period', c.period, 'family_ids', to_jsonb(c.family_ids), 'status', c.status,
      'opened_on', c.opened_on, 'due_on', c.due_on, 'calibration_started_at', c.calibration_started_at, 'calibrated_by', c.calibrated_by,
      'calibrated_name', case when c.calibrated_by is null then null else kafaa_tr_name(c.calibrated_by)->>'en' end, 'calibrated_at', c.calibrated_at,
      'locked_by', c.locked_by, 'locked_name', case when c.locked_by is null then null else kafaa_tr_name(c.locked_by)->>'en' end, 'locked_at', c.locked_at, 'lock_note', c.lock_note),
    'view', case when v_all then 'all' else 'scope' end, 'members_total', coalesce(array_length(v_ids, 1), 0), 'placed_total', v_placed, 'cuts', v_cuts,
    'can', jsonb_build_object('place', v_any_place, 'calibrate', (v_isA or kafaa_role_grant('hr_analyst', 'talent_review', 'Scope')) and c.status <> 'locked',
      'lock', v_isA and v_block is null, 'lock_blocker', case when v_isA then v_block end),
    'members', v_members));
end $$;

-- A line manager places someone in their scope on the 3×3 grid (open cycle only). Audited.
create or replace function kafaa_place_talent(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_cid text; v_pid text; v_ent text; c kafaa_review_cycles; v_ids text[]; v_pot integer; v_perf integer; v_note text; v_rec jsonb; v_sug integer;
  v_act jsonb; v_ev jsonb; v_id text; cur kafaa_review_placements; v_box integer; v_hipo boolean; v_anch jsonb; v_flags jsonb; v_idx int[]; v_ts timestamptz := date_trunc('second', now()); a kafaa_audit_events;
begin
  v_cid := case when jsonb_typeof(p->'cycle_id') = 'string' then p->>'cycle_id' else '' end;
  v_pid := case when jsonb_typeof(p->'person_id') = 'string' then p->>'person_id' else '' end;
  v_ent := case when v_cid <> '' and v_pid <> '' then 'tp:' || v_cid || ':' || v_pid end;
  if me is null then return kafaa_refuse('talent.place', 'review_placements', v_ent, 'not_signed_in', 'Sign in to use talent review'); end if;
  if not (kafaa_has_role('manager') and kafaa_has_grant('talent_review', array['Scope'])) then return kafaa_refuse('talent.place', 'review_placements', v_ent, 'forbidden', 'Only a line manager places people in their own team'); end if;
  select * into c from kafaa_review_cycles where id = v_cid;
  if c.id is null then return kafaa_refuse('talent.place', 'review_placements', v_ent, 'not_found', 'Review cycle not found', 'manager'); end if;
  if c.status = 'locked' then return kafaa_refuse('talent.place', 'review_placements', v_ent, 'cycle_locked', 'This review cycle is locked: decisions can no longer change', 'manager'); end if;
  if c.status = 'calibration' then return kafaa_refuse('talent.place', 'review_placements', v_ent, 'in_calibration', 'This cycle is in calibration: changes now go through the HR facilitator', 'manager'); end if;
  if v_pid = me then return kafaa_refuse('talent.place', 'review_placements', v_ent, 'self', 'You cannot review yourself', 'manager'); end if;
  v_ids := kafaa_tr_members(c.family_ids);
  if not (v_pid = any(v_ids)) then return kafaa_refuse('talent.place', 'review_placements', v_ent, 'not_member', 'This person is not part of this review cycle', 'manager'); end if;
  if not kafaa_tr_can_place(v_pid) then return kafaa_refuse('talent.place', 'review_placements', v_ent, 'not_in_scope', 'You can place only people in your own team', 'manager'); end if;
  v_pot := kafaa_tr_potential(p->'anchors');
  v_perf := kafaa_tr_int(p->'perf', 1, 3);
  if v_perf is null or v_pot is null then return kafaa_refuse('talent.place', 'review_placements', v_ent, 'invalid', 'Choose a performance level and all three potential anchors (1 to 3)', 'manager'); end if;
  v_note := kafaa_tr_str(p->'note');
  if char_length(v_note) > 500 then return kafaa_refuse('talent.place', 'review_placements', v_ent, 'invalid', 'Notes are at most 500 characters', 'manager'); end if;
  v_rec := kafaa_tr_perf(v_pid);
  v_sug := kafaa_tr_perf_map((v_rec->>'rating')::int);
  if v_sug is not null and v_perf <> v_sug and char_length(v_note) < 10 then
    return kafaa_refuse('talent.place', 'review_placements', v_ent, 'note_required', 'Add a note (10 characters or more) when you change the performance level from the HR record', 'manager'); end if;
  v_act := kafaa_tr_actions_norm(case when p ? 'actions' and jsonb_typeof(p->'actions') <> 'null' then p->'actions' else '[]'::jsonb end);
  if v_act is null then return kafaa_refuse('talent.place', 'review_placements', v_ent, 'invalid', 'Choose up to five development actions, each with a kind and a title', 'manager'); end if;
  v_ev := kafaa_tr_evidence(v_pid, current_date);
  v_id := 'tp:' || v_cid || ':' || v_pid;
  v_box := (v_pot - 1) * 3 + v_perf;
  v_hipo := v_pot = 3 and v_perf >= 2;
  v_anch := jsonb_build_object('agility', (p->'anchors'->>'agility')::int, 'influence', (p->'anchors'->>'influence')::int, 'drive', (p->'anchors'->>'drive')::int);
  select * into cur from kafaa_review_placements where id = v_id;
  if cur.id is null then
    insert into kafaa_review_placements (id, cycle_id, person_id, perf, potential, anchors, box, hipo, perf_record, evidence_snapshot, evidence_index, placed_by, placed_at, calibrated, note, actions, status, history, listed, updated_at)
    values (v_id, v_cid, v_pid, v_perf, v_pot, v_anch, v_box, v_hipo, (v_rec->>'rating')::int, v_ev, (v_ev->>'index')::int, me, v_ts, false, nullif(v_note, ''), v_act, 'placed',
            jsonb_build_array(kafaa_tr_hist('placed', jsonb_build_object('perf', v_perf, 'potential', v_pot, 'note', nullif(v_note, '')))), true, v_ts);
  else
    update kafaa_review_placements set perf = v_perf, potential = v_pot, anchors = v_anch, box = v_box, hipo = v_hipo, perf_record = (v_rec->>'rating')::int, evidence_snapshot = v_ev,
      evidence_index = (v_ev->>'index')::int, placed_by = me, placed_at = v_ts, calibrated = false, calibrated_by = null, calibrated_at = null, note = nullif(v_note, ''), actions = v_act,
      status = 'placed', updated_at = v_ts, history = history || jsonb_build_array(kafaa_tr_hist('placed', jsonb_build_object('perf', v_perf, 'potential', v_pot, 'note', nullif(v_note, ''))))
     where id = v_id;
  end if;
  update kafaa_review_cycles set updated_at = v_ts where id = v_cid;
  v_idx := kafaa_tr_cycle_indices(v_cid, v_ids);
  v_flags := kafaa_tr_flags(v_pot, (v_ev->>'index')::int, kafaa_tr_cuts(v_idx));
  a := kafaa_audit('talent.place', 'review_placements', v_id, 'ok', 'box ' || v_box || case when jsonb_array_length(v_flags) > 0 then ' · ' || (select string_agg(x, ',') from jsonb_array_elements_text(v_flags) x) else '' end, 'not_applicable', null, 'manager');
  return kafaa_result(true, 'ok', 'Placement saved', a, null, jsonb_build_object('id', v_id, 'box', v_box, 'potential', v_pot, 'hipo', v_hipo, 'flags', v_flags));
end $$;

-- HR facilitator: start calibration, apply adjustments (each with a reason), optionally finish. Audited.
create or replace function kafaa_calibrate_cycle(p_cycle_id text, p_changes jsonb, p_finish boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; c kafaa_review_cycles; x jsonb; v_pid text; v_seen text[] := '{}'; v_n text; v_ids text[]; v_ts timestamptz := date_trunc('second', now());
  v_cnt integer; pl kafaa_review_placements; v_perf integer; v_pot integer; a kafaa_audit_events; v_cal boolean;
begin
  if me is null then return kafaa_refuse('talent.calibrate', 'review_cycles', p_cycle_id, 'not_signed_in', 'Sign in to use talent review'); end if;
  if kafaa_has_grant('talent_review', array['A']) then v_role := kafaa_acting_role('talent_review', array['A']);
  elsif kafaa_role_grant('hr_analyst', 'talent_review', 'Scope') then v_role := 'hr_analyst'; end if;
  if v_role is null then return kafaa_refuse('talent.calibrate', 'review_cycles', p_cycle_id, 'forbidden', 'Calibration is facilitated by HR'); end if;
  select * into c from kafaa_review_cycles where id = p_cycle_id;
  if c.id is null then return kafaa_refuse('talent.calibrate', 'review_cycles', p_cycle_id, 'not_found', 'Review cycle not found', v_role); end if;
  if c.status = 'locked' then return kafaa_refuse('talent.calibrate', 'review_cycles', p_cycle_id, 'cycle_locked', 'This review cycle is locked: decisions can no longer change', v_role); end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) > 60 then
    return kafaa_refuse('talent.calibrate', 'review_cycles', p_cycle_id, 'invalid', 'Each change needs a placed person and levels from 1 to 3', v_role); end if;
  for x in select e from jsonb_array_elements(p_changes) e loop
    v_pid := case when jsonb_typeof(x) = 'object' and jsonb_typeof(x->'person_id') = 'string' then x->>'person_id' else '' end;
    if v_pid = '' or v_pid = any(v_seen) or not exists (select 1 from kafaa_review_placements r where r.id = 'tp:' || c.id || ':' || v_pid)
       or kafaa_tr_int(x->'perf', 1, 3) is null or kafaa_tr_int(x->'potential', 1, 3) is null then
      return kafaa_refuse('talent.calibrate', 'review_cycles', p_cycle_id, 'invalid', 'Each change needs a placed person and levels from 1 to 3', v_role); end if;
    if v_pid = me then return kafaa_refuse('talent.calibrate', 'review_cycles', p_cycle_id, 'self', 'You cannot review yourself', v_role); end if;
    v_n := kafaa_tr_str(x->'note');
    if char_length(v_n) < 10 or char_length(v_n) > 500 then return kafaa_refuse('talent.calibrate', 'review_cycles', p_cycle_id, 'note_required', 'Every calibration change needs a reason (10 characters or more)', v_role); end if;
    v_seen := v_seen || v_pid;
  end loop;
  v_ids := kafaa_tr_members(c.family_ids);
  if p_finish is true and exists (select 1 from unnest(v_ids) u where not exists (select 1 from kafaa_review_placements r where r.id = 'tp:' || c.id || ':' || u)) then
    return kafaa_refuse('talent.calibrate', 'review_cycles', p_cycle_id, 'incomplete', 'Everyone in the cycle must be placed before calibration can finish', v_role); end if;
  v_cnt := jsonb_array_length(p_changes);
  for x in select e from jsonb_array_elements(p_changes) e order by e->>'person_id' collate "C" loop
    v_perf := (x->>'perf')::int; v_pot := (x->>'potential')::int;
    update kafaa_review_placements set perf = v_perf, potential = v_pot, box = (v_pot - 1) * 3 + v_perf, hipo = v_pot = 3 and v_perf >= 2, calibrated = true, calibrated_by = me, calibrated_at = v_ts,
      updated_at = v_ts, history = history || jsonb_build_array(kafaa_tr_hist('calibrated', jsonb_build_object('perf', v_perf, 'potential', v_pot, 'note', kafaa_tr_str(x->'note'))))
     where id = 'tp:' || c.id || ':' || (x->>'person_id');
  end loop;
  update kafaa_review_cycles set status = 'calibration', updated_at = v_ts,
    calibration_started_at = case when c.status = 'open' then v_ts else calibration_started_at end,
    calibration_started_by = case when c.status = 'open' then me else calibration_started_by end
   where id = c.id;
  if p_finish is true then
    update kafaa_review_placements set calibrated = true, calibrated_by = me, calibrated_at = v_ts, updated_at = v_ts where cycle_id = c.id and person_id = any(v_ids) and not calibrated;
    update kafaa_review_cycles set calibrated_by = me, calibrated_at = v_ts where id = c.id;
  elsif v_cnt > 0 then
    update kafaa_review_cycles set calibrated_by = null, calibrated_at = null where id = c.id;
  end if;
  v_cal := p_finish is true or (v_cnt = 0 and c.calibrated_at is not null);
  a := kafaa_audit('talent.calibrate', 'review_cycles', c.id, 'ok', v_cnt || ' changes' || case when p_finish is true then ' · finished' else '' end, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when p_finish is true then 'Calibration finished: ready for the HR director to lock' when v_cnt > 0 then v_cnt || ' placements adjusted' else 'Calibration started' end, a, null,
    jsonb_build_object('status', 'calibration', 'changed', v_cnt, 'calibrated', v_cal));
end $$;

-- HR director locks a calibrated cycle (maker-checker): development priorities to employees, HiPo pool, notifications. Ledgered.
create or replace function kafaa_lock_cycle(p_cycle_id text, p_note text) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; c kafaa_review_cycles; v_note text := btrim(coalesce(p_note, ''), E' \t\r\n'); r kafaa_review_placements; v_n integer := 0; v_h integer := 0;
  v_ts timestamptz := date_trunc('second', now()); v_prev text := current_setting('kafaa.seeding', true); a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('talent.lock', 'review_cycles', p_cycle_id, 'not_signed_in', 'Sign in to use talent review'); end if;
  if not kafaa_has_grant('talent_review', array['A']) then return kafaa_refuse('talent.lock', 'review_cycles', p_cycle_id, 'forbidden', 'Only the HR director locks a review cycle'); end if;
  v_role := kafaa_acting_role('talent_review', array['A']);
  select * into c from kafaa_review_cycles where id = p_cycle_id;
  if c.id is null then return kafaa_refuse('talent.lock', 'review_cycles', p_cycle_id, 'not_found', 'Review cycle not found', v_role); end if;
  if c.status = 'locked' then return kafaa_refuse('talent.lock', 'review_cycles', p_cycle_id, 'cycle_locked', 'This review cycle is locked: decisions can no longer change', v_role); end if;
  if c.status <> 'calibration' or c.calibrated_at is null then return kafaa_refuse('talent.lock', 'review_cycles', p_cycle_id, 'not_calibrated', 'Finish calibration before locking the cycle', v_role); end if;
  if c.calibrated_by = me or exists (select 1 from kafaa_review_placements x where x.cycle_id = c.id and (x.placed_by = me or x.calibrated_by = me)) then
    return kafaa_refuse('talent.lock', 'review_cycles', p_cycle_id, 'maker_checker', 'Maker-checker: the person who calibrated or placed people in this cycle cannot lock it', v_role); end if;
  if char_length(v_note) > 500 then return kafaa_refuse('talent.lock', 'review_cycles', p_cycle_id, 'invalid', 'Notes are at most 500 characters', v_role); end if;
  perform set_config('kafaa.seeding', 'on', true);
  for r in select * from kafaa_review_placements x where x.cycle_id = c.id order by x.person_id collate "C" loop
    v_n := v_n + 1;
    update kafaa_review_placements set status = 'locked', updated_at = v_ts, history = history || jsonb_build_array(kafaa_tr_hist('locked', '{}'::jsonb)) where id = r.id;
    insert into kafaa_talent_priorities (id, person_id, cycle_id, period, priorities, agreed_on, status, listed, created_at)
    values ('tpr:' || c.id || ':' || r.person_id, r.person_id, c.id, c.period, r.actions, current_date, 'agreed', true, v_ts) on conflict (id) do nothing;
    if r.hipo then
      v_h := v_h + 1;
      insert into kafaa_talent_pool (id, cycle_id, person_id, pool, since, programme_id, status, listed)
      values ('pool:' || c.id || ':' || r.person_id, c.id, r.person_id, 'hipo', current_date, 'prog-estadad', 'active', true) on conflict (id) do nothing;
    end if;
    if exists (select 1 from kafaa_people where id = r.person_id) then
      insert into kafaa_notifications (id, person_id, kind, title_en, title_ar, link, severity, created_at)
      values ('nt-tpr-' || c.id || '-' || r.person_id, r.person_id, 'talent', 'Development priorities agreed', 'تم الاتفاق على أولويات التطوير', '/my/development-priorities', 'ok', v_ts) on conflict (id) do nothing;
    end if;
  end loop;
  update kafaa_review_cycles set status = 'locked', locked_by = me, locked_at = v_ts, lock_note = nullif(v_note, ''), updated_at = v_ts where id = c.id;
  perform set_config('kafaa.seeding', coalesce(v_prev, ''), true);
  l := kafaa_ledger('kafaa.talent.cycle_lock', format('Talent review %s locked: %s placements', c.code, v_n));
  a := kafaa_audit('talent.lock', 'review_cycles', c.id, 'ok', format('%s placements, %s HiPo', v_n, v_h), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Cycle locked: development priorities shared with employees', a, l, jsonb_build_object('status', 'locked', 'priorities', v_n, 'hipo', v_h));
end $$;

-- HR aggregates (Agg/R/A). Audited.
create or replace function kafaa_talent_aggregates(p_cycle_id text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_d jsonb; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('talent.aggregates', 'review_placements', p_cycle_id, 'not_signed_in', 'Sign in to use talent review'); end if;
  v_role := kafaa_acting_role('talent_review', array['Agg', 'R', 'A']);
  if v_role is null then return kafaa_refuse('talent.aggregates', 'review_placements', p_cycle_id, 'forbidden', 'Talent review is for line managers and HR'); end if;
  if p_cycle_id is not null and not exists (select 1 from kafaa_review_cycles where id = p_cycle_id) then
    return kafaa_refuse('talent.aggregates', 'review_placements', p_cycle_id, 'not_found', 'Review cycle not found', v_role); end if;
  v_d := kafaa_tr_aggregates(p_cycle_id);
  a := kafaa_audit('talent.aggregates', 'review_placements', p_cycle_id, 'ok', case when (v_d->>'suppressed')::boolean then 'suppressed' else (v_d->>'n') || ' placements' end, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', '', a, null, v_d);
end $$;

-- ───────────── F19 RPCs
create or replace function kafaa_succession_board() returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_all boolean; s kafaa_succession_slates; v_out jsonb := '[]'::jsonb; v_roll jsonb; v_agg jsonb; a kafaa_audit_events; v_n integer := 0;
begin
  if me is null then return kafaa_refuse('succession.board_read', 'succession_slates', null, 'not_signed_in', 'Sign in to use talent review'); end if;
  v_role := kafaa_acting_role('talent_review', array['R', 'A', 'Scope', 'Agg']);
  if v_role is null then return kafaa_refuse('succession.board_read', 'succession_slates', null, 'forbidden', 'Talent review is for line managers and HR'); end if;
  v_all := kafaa_has_grant('talent_review', array['R', 'W', 'A']);
  for s in select * from kafaa_succession_slates order by sort, id collate "C" loop
    if not kafaa_sx_visible(s.entity_id, s.family_id) then continue; end if;
    v_n := v_n + 1;
    select jsonb_build_object('period', b.period, 'at', b.rolled_at) into v_roll from kafaa_bench_rollups b where b.slate_id = s.id order by b.rolled_at desc limit 1;
    v_out := v_out || jsonb_build_array(jsonb_build_object('id', s.id, 'role_id', s.role_id, 'period', s.period, 'status', s.status, 'entity_id', s.entity_id, 'family_id', s.family_id,
      'critical', s.critical, 'leadership', s.leadership, 'incumbent_en', s.incumbent_en, 'incumbent_ar', s.incumbent_ar, 'target_bench', s.target_bench, 'confirmed_at', s.confirmed_at,
      'confirmed_name', case when s.confirmed_by is null then null else kafaa_tr_name(s.confirmed_by)->>'en' end, 'flags', kafaa_sx_flags(s.id),
      'successors', coalesce((select jsonb_agg(kafaa_sx_successor_json(x) order by x.sort, x.id collate "C") from kafaa_successors x where x.slate_id = s.id and x.status <> 'withdrawn'), '[]'::jsonb),
      'rolled_up', v_roll));
    v_roll := null;
  end loop;
  v_agg := case when kafaa_has_grant('talent_review', array['Agg', 'R', 'A']) then kafaa_sx_aggregates() end;
  a := kafaa_audit('succession.board_read', 'succession_slates', null, 'ok', v_n || ' slates', 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', '', a, null, jsonb_build_object('view', case when v_all then 'all' else 'function' end,
    'can', jsonb_build_object('edit', kafaa_has_grant('talent_review', array['A']), 'rollup', kafaa_has_grant('talent_review', array['A'])), 'slates', v_out, 'aggregates', v_agg));
end $$;

create or replace function kafaa_succession_candidates(p_slate_id text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; s kafaa_succession_slates; v_feed text[]; v_out jsonb; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('succession.candidates', 'successors', p_slate_id, 'not_signed_in', 'Sign in to use talent review'); end if;
  v_role := kafaa_acting_role('talent_review', array['R', 'A', 'Scope']);
  if v_role is null then return kafaa_refuse('succession.candidates', 'successors', p_slate_id, 'forbidden', 'Talent review is for line managers and HR'); end if;
  select * into s from kafaa_succession_slates where id = p_slate_id;
  if s.id is null or not kafaa_sx_visible(s.entity_id, s.family_id) then return kafaa_refuse('succession.candidates', 'successors', p_slate_id, 'not_found', 'Succession slate not found', v_role); end if;
  if exists (select 1 from kafaa_job_roles j where j.id = s.role_id and j.security_sensitive) then
    return kafaa_refuse('succession.candidates', 'successors', p_slate_id, 'path_only', 'Security, safeguards and cyber roles show the career path only', v_role); end if;
  select coalesce(array_agg(distinct e.from_role_id), '{}'::text[]) into v_feed from kafaa_career_paths e where e.to_role_id = s.role_id and e.from_role_id is not null and e.from_role_id <> s.role_id;
  select coalesce(jsonb_agg(z.j order by z.rk, z.pct desc, z.pid collate "C"), '[]'::jsonb) into v_out from (
    select y.pid, y.rk, y.pct, jsonb_build_object('person_id', y.pid, 'name', y.name, 'name_ar', y.name_ar, 'role_id', y.role_id, 'relation', y.relation,
      'readiness', y.x->>'readiness', 'pct', (y.x->'cr'->'pct'), 'months', (y.x->'cr'->'months'), 'gates', y.x->'gates', 'gates_met', kafaa_sx_gates_met(y.x->'gates'),
      'gaps', coalesce((select jsonb_agg(g.v order by g.o) from jsonb_array_elements(case when jsonb_typeof(y.x->'cr'->'gaps') = 'array' then y.x->'cr'->'gaps' else '[]'::jsonb end) with ordinality g(v, o) where g.o <= 5), '[]'::jsonb),
      'reasons', kafaa_sx_reasons(y.x->'cr', y.x->'gates'), 'slates', kafaa_sx_load(y.pid),
      'on_slate', exists (select 1 from kafaa_successors q where q.slate_id = s.id and q.status <> 'withdrawn' and q.person_id = y.pid)) as j
    from (select y0.*, case y0.x->>'readiness' when 'ready_now' then 0 when '1_2y' then 1 else 2 end as rk, coalesce((y0.x->'cr'->>'pct')::int, 0) as pct
            from (select p.id as pid, p.display_name as name, coalesce(nullif(p.display_name_ar, ''), p.display_name) as name_ar, p.job_role_id as role_id,
                         case when p.job_role_id = s.role_id then 'peer' else 'feeder' end as relation, kafaa_sx_assess(p.id, s.role_id, current_date) as x
                    from kafaa_people p
                   where p.kind = 'staff' and p.status = 'active' and p.id <> me and (p.job_role_id = s.role_id or p.job_role_id = any(v_feed))
                     and not exists (select 1 from kafaa_role_assignments ra where ra.person_id = p.id and ra.role = 'hr_director' and ra.status = 'active')) y0) y
    order by y.rk, y.pct desc, y.pid collate "C" limit 30) z;
  a := kafaa_audit('succession.candidates', 'successors', s.id, 'ok', jsonb_array_length(v_out) || ' candidates', 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', '', a, null, v_out);
end $$;

create or replace function kafaa_propose_successor(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; v_sid text; s kafaa_succession_slates; v_src text; v_note text; v_act jsonb; v_em boolean; v_ts timestamptz := date_trunc('second', now());
  v_pid text; pp kafaa_people; v_x jsonb; v_ready text; v_comp text; v_id text; v_en text; v_ar text; cur kafaa_successors; v_sort integer; a kafaa_audit_events;
begin
  v_sid := case when jsonb_typeof(p->'slate_id') = 'string' then p->>'slate_id' else '' end;
  if me is null then return kafaa_refuse('succession.propose', 'successors', nullif(v_sid, ''), 'not_signed_in', 'Sign in to use talent review'); end if;
  if not kafaa_has_grant('talent_review', array['A']) then return kafaa_refuse('succession.propose', 'successors', nullif(v_sid, ''), 'forbidden', 'Succession slates are changed by the HR director'); end if;
  v_role := kafaa_acting_role('talent_review', array['A']);
  select * into s from kafaa_succession_slates where id = v_sid;
  if s.id is null then return kafaa_refuse('succession.propose', 'successors', nullif(v_sid, ''), 'not_found', 'Succession slate not found', v_role); end if;
  if s.status = 'confirmed' then return kafaa_refuse('succession.propose', 'successors', v_sid, 'slate_confirmed', 'This slate is confirmed: propose changes in the next period', v_role); end if;
  if exists (select 1 from kafaa_job_roles j where j.id = s.role_id and j.security_sensitive) then
    return kafaa_refuse('succession.propose', 'successors', v_sid, 'path_only', 'Security, safeguards and cyber roles show the career path only', v_role); end if;
  v_src := case when jsonb_typeof(p->'cover_source') = 'string' then p->>'cover_source' when p->'cover_source' is null or jsonb_typeof(p->'cover_source') = 'null' then 'internal' else '?' end;
  v_note := kafaa_tr_str(p->'note');
  if char_length(v_note) > 500 then return kafaa_refuse('succession.propose', 'successors', v_sid, 'invalid', 'Notes are at most 500 characters', v_role); end if;
  v_act := kafaa_tr_actions_norm(case when p ? 'actions' and jsonb_typeof(p->'actions') <> 'null' then p->'actions' else '[]'::jsonb end);
  if v_act is null or exists (select 1 from jsonb_array_elements(v_act) e where e->>'kind' not in ('training', 'rotation', 'mentoring')) then
    return kafaa_refuse('succession.propose', 'successors', v_sid, 'invalid', 'Choose up to five development actions, each with a kind and a title', v_role); end if;
  v_em := coalesce(p->'emergency' = 'true'::jsonb, false);
  if v_src = 'internal' then
    v_pid := case when jsonb_typeof(p->'person_id') = 'string' then p->>'person_id' else '' end;
    select * into pp from kafaa_people where id = v_pid;
    if pp.id is null or pp.kind <> 'staff' or pp.status <> 'active'
       or exists (select 1 from kafaa_role_assignments ra where ra.person_id = v_pid and ra.role = 'hr_director' and ra.status = 'active') then
      return kafaa_refuse('succession.propose', 'successors', v_sid, 'not_found', 'Person not found or not eligible for this slate', v_role); end if;
    v_x := kafaa_sx_assess(v_pid, s.role_id, current_date);
    v_comp := v_x->>'readiness';
    v_ready := case when p->'readiness' is null or jsonb_typeof(p->'readiness') = 'null' then v_comp when jsonb_typeof(p->'readiness') = 'string' then p->>'readiness' else '?' end;
    if v_ready not in ('ready_now', '1_2y', '3_5y') then return kafaa_refuse('succession.propose', 'successors', v_sid, 'invalid', 'Choose ready now, 1 to 2 years or 3 to 5 years', v_role); end if;
    if v_ready = 'ready_now' and not kafaa_sx_gates_met(v_x->'gates') then
      return kafaa_refuse('succession.propose', 'successors', v_sid, 'gate_not_met', 'Not ready now: a hard gate of this role (licence route, qualification or entry condition) is not met', v_role); end if;
    if array_position(array['ready_now', '1_2y', '3_5y'], v_ready) < array_position(array['ready_now', '1_2y', '3_5y'], v_comp) and char_length(v_note) < 10 then
      return kafaa_refuse('succession.propose', 'successors', v_sid, 'optimistic_note', 'Give a reason (10 characters or more) when the readiness is earlier than the computed one', v_role); end if;
    v_id := 'sx:' || v_sid || ':' || v_pid;
  elsif v_src in ('khnp', 'contractor') then
    v_en := kafaa_tr_str(p->'cover_label_en'); v_ar := kafaa_tr_str(p->'cover_label_ar');
    if (p ? 'person_id' and jsonb_typeof(p->'person_id') = 'string' and p->>'person_id' <> '') or char_length(v_en) < 3 or char_length(v_ar) < 3 or char_length(v_en) > 120 or char_length(v_ar) > 120 then
      return kafaa_refuse('succession.propose', 'successors', v_sid, 'invalid', 'External cover needs a role-card label and must not name a person', v_role); end if;
    v_id := 'sx:' || v_sid || ':ext-' || v_src;
  else
    return kafaa_refuse('succession.propose', 'successors', v_sid, 'invalid', 'External cover needs a role-card label and must not name a person', v_role);
  end if;
  if v_em then update kafaa_successors set emergency = false, updated_at = v_ts where slate_id = v_sid and id <> v_id and emergency; end if;
  select * into cur from kafaa_successors where id = v_id;
  v_sort := coalesce(cur.sort, (select count(*)::int + 1 from kafaa_successors where slate_id = v_sid));
  if cur.id is null then
    insert into kafaa_successors (id, slate_id, person_id, cover_source, cover_label_en, cover_label_ar, readiness, computed_readiness, readiness_pct, months, gates, gaps, emergency, actions, note,
      status, proposed_by, proposed_at, confirmed_by, confirmed_at, person_name, person_name_ar, person_role_id, listed, sort, updated_at)
    values (v_id, v_sid, case when v_src = 'internal' then v_pid end, v_src, coalesce(v_en, ''), coalesce(v_ar, ''), case when v_src = 'internal' then v_ready end, case when v_src = 'internal' then v_comp end,
      case when v_src = 'internal' then (v_x->'cr'->>'pct')::int end, case when v_src = 'internal' then (v_x->'cr'->>'months')::int end, coalesce(v_x->'gates', '[]'::jsonb),
      coalesce((select jsonb_agg(g.v order by g.o) from jsonb_array_elements(case when jsonb_typeof(v_x->'cr'->'gaps') = 'array' then v_x->'cr'->'gaps' else '[]'::jsonb end) with ordinality g(v, o) where g.o <= 5), '[]'::jsonb),
      v_em, v_act, nullif(v_note, ''), 'proposed', me, v_ts, null, null, coalesce(pp.display_name, ''), coalesce(nullif(pp.display_name_ar, ''), pp.display_name, ''), pp.job_role_id, true, v_sort, v_ts);
  else
    update kafaa_successors set person_id = case when v_src = 'internal' then v_pid end, cover_source = v_src, cover_label_en = coalesce(v_en, ''), cover_label_ar = coalesce(v_ar, ''),
      readiness = case when v_src = 'internal' then v_ready end, computed_readiness = case when v_src = 'internal' then v_comp end,
      readiness_pct = case when v_src = 'internal' then (v_x->'cr'->>'pct')::int end, months = case when v_src = 'internal' then (v_x->'cr'->>'months')::int end,
      gates = coalesce(v_x->'gates', '[]'::jsonb),
      gaps = coalesce((select jsonb_agg(g.v order by g.o) from jsonb_array_elements(case when jsonb_typeof(v_x->'cr'->'gaps') = 'array' then v_x->'cr'->'gaps' else '[]'::jsonb end) with ordinality g(v, o) where g.o <= 5), '[]'::jsonb),
      emergency = v_em, actions = v_act, note = nullif(v_note, ''), status = 'proposed', proposed_by = me, proposed_at = v_ts, confirmed_by = null, confirmed_at = null,
      person_name = coalesce(pp.display_name, ''), person_name_ar = coalesce(nullif(pp.display_name_ar, ''), pp.display_name, ''), person_role_id = pp.job_role_id, sort = v_sort, updated_at = v_ts
     where id = v_id;
  end if;
  update kafaa_succession_slates set status = case when status = 'draft' then 'proposed' else status end, updated_at = v_ts where id = v_sid;
  a := kafaa_audit('succession.propose', 'successors', v_id, 'ok', case when v_src = 'internal' then v_pid else v_src end || ' ' || coalesce(case when v_src = 'internal' then v_ready end, 'cover') || case when v_em then ' · emergency' else '' end, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Successor proposed', a, null, jsonb_build_object('id', v_id, 'readiness', case when v_src = 'internal' then v_ready end, 'computed', case when v_src = 'internal' then v_comp end));
end $$;

create or replace function kafaa_withdraw_successor(p_id text, p_note text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; x kafaa_successors; s kafaa_succession_slates; v_note text := btrim(coalesce(p_note, ''), E' \t\r\n'); v_ts timestamptz := date_trunc('second', now()); a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('succession.withdraw', 'successors', p_id, 'not_signed_in', 'Sign in to use talent review'); end if;
  if not kafaa_has_grant('talent_review', array['A']) then return kafaa_refuse('succession.withdraw', 'successors', p_id, 'forbidden', 'Succession slates are changed by the HR director'); end if;
  v_role := kafaa_acting_role('talent_review', array['A']);
  select * into x from kafaa_successors where id = p_id;
  if x.id is null or x.status = 'withdrawn' then return kafaa_refuse('succession.withdraw', 'successors', p_id, 'not_found', 'Successor not found', v_role); end if;
  select * into s from kafaa_succession_slates where id = x.slate_id;
  if s.status = 'confirmed' then return kafaa_refuse('succession.withdraw', 'successors', p_id, 'slate_confirmed', 'This slate is confirmed: propose changes in the next period', v_role); end if;
  if char_length(v_note) < 10 or char_length(v_note) > 500 then return kafaa_refuse('succession.withdraw', 'successors', p_id, 'note_required', 'Give a reason (10 characters or more) for withdrawing a successor', v_role); end if;
  update kafaa_successors set status = 'withdrawn', emergency = false, note = v_note, updated_at = v_ts where id = x.id;
  update kafaa_succession_slates set updated_at = v_ts where id = s.id;
  a := kafaa_audit('succession.withdraw', 'successors', x.id, 'ok', v_note, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Successor withdrawn', a, null, jsonb_build_object('status', 'withdrawn'));
end $$;

create or replace function kafaa_confirm_slate(p_slate_id text, p_note text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; s kafaa_succession_slates; x kafaa_successors; v_n integer; v_note text := btrim(coalesce(p_note, ''), E' \t\r\n'); v_ts timestamptz := date_trunc('second', now()); a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('succession.confirm', 'succession_slates', p_slate_id, 'not_signed_in', 'Sign in to use talent review'); end if;
  if not kafaa_has_grant('talent_review', array['A']) then return kafaa_refuse('succession.confirm', 'succession_slates', p_slate_id, 'forbidden', 'Succession slates are changed by the HR director'); end if;
  v_role := kafaa_acting_role('talent_review', array['A']);
  select * into s from kafaa_succession_slates where id = p_slate_id;
  if s.id is null then return kafaa_refuse('succession.confirm', 'succession_slates', p_slate_id, 'not_found', 'Succession slate not found', v_role); end if;
  if s.status = 'confirmed' then return kafaa_refuse('succession.confirm', 'succession_slates', p_slate_id, 'slate_confirmed', 'This slate is confirmed: propose changes in the next period', v_role); end if;
  select count(*) into v_n from kafaa_successors where slate_id = s.id and status = 'proposed';
  if v_n = 0 then return kafaa_refuse('succession.confirm', 'succession_slates', p_slate_id, 'slate_empty', 'Add at least one successor before confirming the slate', v_role); end if;
  for x in select * from kafaa_successors where slate_id = s.id and status = 'proposed' order by id collate "C" loop
    if x.cover_source = 'internal' and x.readiness = 'ready_now' and not kafaa_sx_gates_met(kafaa_sx_assess(x.person_id, s.role_id, current_date)->'gates') then
      return kafaa_refuse('succession.confirm', 'succession_slates', p_slate_id, 'gate_not_met', 'Not ready now: a hard gate of this role (licence route, qualification or entry condition) is not met', v_role); end if;
  end loop;
  if char_length(v_note) > 500 then return kafaa_refuse('succession.confirm', 'succession_slates', p_slate_id, 'invalid', 'Notes are at most 500 characters', v_role); end if;
  update kafaa_successors set status = 'confirmed', confirmed_by = me, confirmed_at = v_ts, updated_at = v_ts where slate_id = s.id and status = 'proposed';
  update kafaa_succession_slates set status = 'confirmed', confirmed_by = me, confirmed_at = v_ts, confirm_note = nullif(v_note, ''), updated_at = v_ts where id = s.id;
  l := kafaa_ledger('kafaa.succession.slate_confirm', format('Succession slate %s confirmed (%s successors)', s.id, v_n));
  a := kafaa_audit('succession.confirm', 'succession_slates', s.id, 'ok', v_n || ' successors', case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Slate confirmed', a, l, jsonb_build_object('status', 'confirmed', 'successors', v_n));
end $$;

-- Bench roll-up: confirmed critical slates of the period → M07 critical_roles (contract: M23 writes the counts through this function).
create or replace function kafaa_rollup_bench(p_period text) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; s kafaa_succession_slates; v_done integer := 0; v_skip text[] := '{}'; v_cid text; cr kafaa_critical_roles; v_q integer; v_t integer; v_p integer;
  v_before jsonb; v_after jsonb; v_ts timestamptz := date_trunc('second', now()); v_prev text := current_setting('kafaa.seeding', true); a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('succession.rollup', 'critical_roles', p_period, 'not_signed_in', 'Sign in to use talent review'); end if;
  if not kafaa_has_grant('talent_review', array['A']) then return kafaa_refuse('succession.rollup', 'critical_roles', p_period, 'forbidden', 'Succession slates are changed by the HR director'); end if;
  v_role := kafaa_acting_role('talent_review', array['A']);
  if p_period is null or p_period !~ '^20\d\d-H[12]$' then return kafaa_refuse('succession.rollup', 'critical_roles', p_period, 'invalid', 'Choose a period like 2026-H2', v_role); end if;
  select coalesce(array_agg(role_id order by role_id collate "C"), '{}'::text[]) into v_skip from kafaa_succession_slates where period = p_period and critical and status <> 'confirmed';
  if not exists (select 1 from kafaa_succession_slates where period = p_period and critical and status = 'confirmed') then
    return kafaa_refuse('succession.rollup', 'critical_roles', p_period, 'nothing_to_roll', 'No confirmed slate for a critical role in this period', v_role); end if;
  perform set_config('kafaa.seeding', 'on', true);
  for s in select * from kafaa_succession_slates where period = p_period and critical and status = 'confirmed' order by role_id collate "C" loop
    v_done := v_done + 1;
    select count(*) filter (where readiness = 'ready_now'), count(*) filter (where readiness = '1_2y'), count(*) filter (where readiness = '3_5y') into v_q, v_t, v_p
      from kafaa_successors where slate_id = s.id and status = 'confirmed' and cover_source = 'internal' and person_id is not null;
    v_cid := 'crit-' || s.role_id || '-' || replace(lower(p_period), '-', '');
    select * into cr from kafaa_critical_roles where id = v_cid;
    v_before := case when cr.id is null then '{}'::jsonb else jsonb_build_object('target_bench', cr.target_bench, 'qualified', cr.qualified, 'in_training', cr.in_training, 'pipeline', cr.pipeline) end;
    v_after := jsonb_build_object('target_bench', s.target_bench, 'qualified', v_q, 'in_training', v_t, 'pipeline', v_p);
    insert into kafaa_critical_roles (id, role_id, period, target_bench, qualified, in_training, pipeline, source, sample)
    values (v_cid, s.role_id, p_period, s.target_bench, v_q, v_t, v_p, 'Succession slates (F19 roll-up)', true)
    on conflict (id) do update set target_bench = excluded.target_bench, qualified = excluded.qualified, in_training = excluded.in_training, pipeline = excluded.pipeline, source = excluded.source, sample = true;
    insert into kafaa_bench_rollups (id, period, role_id, slate_id, critical_role_id, before, after, rolled_by, rolled_at, listed)
    values ('br:' || p_period || ':' || s.role_id, p_period, s.role_id, s.id, v_cid, v_before, v_after, me, v_ts, true)
    on conflict (id) do update set slate_id = excluded.slate_id, critical_role_id = excluded.critical_role_id, before = excluded.before, after = excluded.after, rolled_by = excluded.rolled_by, rolled_at = excluded.rolled_at;
  end loop;
  perform set_config('kafaa.seeding', coalesce(v_prev, ''), true);
  l := kafaa_ledger('kafaa.succession.bench_rollup', format('Bench roll-up %s: %s critical roles', p_period, v_done));
  a := kafaa_audit('succession.rollup', 'critical_roles', p_period, 'ok', v_done || ' roles' || case when array_length(v_skip, 1) > 0 then '; skipped ' || array_to_string(v_skip, ',') else '' end,
    case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Bench updated for ' || v_done || ' critical roles', a, l, jsonb_build_object('period', p_period, 'roles', v_done, 'skipped', to_jsonb(v_skip)));
end $$;

-- ───────────── Grants: internal helpers are not callable by API roles; RPCs for signed-in users only.
revoke execute on function kafaa_tr_ts(), kafaa_tr_str(jsonb), kafaa_tr_int(jsonb, integer, integer), kafaa_tr_evidence(text, date), kafaa_tr_cuts(int[]), kafaa_tr_flags(integer, integer, jsonb),
  kafaa_tr_potential(jsonb), kafaa_tr_perf_map(integer), kafaa_tr_perf(text), kafaa_tr_actions_norm(jsonb), kafaa_tr_members(text[]), kafaa_tr_sees(text), kafaa_tr_can_place(text),
  kafaa_tr_cycle_indices(text, text[]), kafaa_tr_hist(text, jsonb), kafaa_tr_name(text), kafaa_tr_aggregates(text),
  kafaa_sx_gates(text, text, jsonb, date), kafaa_sx_gates_met(jsonb), kafaa_sx_readiness(jsonb, jsonb), kafaa_sx_reasons(jsonb, jsonb), kafaa_sx_assess(text, text, date), kafaa_sx_load(text),
  kafaa_sx_flags(text), kafaa_sx_aggregates(), kafaa_sx_visible(text, text), kafaa_sx_successor_json(kafaa_successors)
  from public, anon, authenticated;
revoke execute on function kafaa_talent_cycles(), kafaa_talent_board(text), kafaa_place_talent(jsonb), kafaa_calibrate_cycle(text, jsonb, boolean), kafaa_lock_cycle(text, text),
  kafaa_talent_aggregates(text), kafaa_succession_board(), kafaa_succession_candidates(text), kafaa_propose_successor(jsonb), kafaa_withdraw_successor(text, text),
  kafaa_confirm_slate(text, text), kafaa_rollup_bench(text) from public, anon;
grant execute on function kafaa_talent_cycles(), kafaa_talent_board(text), kafaa_place_talent(jsonb), kafaa_calibrate_cycle(text, jsonb, boolean), kafaa_lock_cycle(text, text),
  kafaa_talent_aggregates(text), kafaa_succession_board(), kafaa_succession_candidates(text), kafaa_propose_successor(jsonb), kafaa_withdraw_successor(text, text),
  kafaa_confirm_slate(text, text), kafaa_rollup_bench(text) to authenticated;
