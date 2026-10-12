-- kafaa_fs71_disclosure_pilots_p1 (1/1) · from supabase/migrations/20261010271001_kafaa_fs71_disclosure_pilots.sql
-- Apply with apply_migration name "kafaa_fs71_disclosure_pilots_p1". Additive and idempotent; kafaa_* objects only.
-- [FS wave G · E1 · FS60 + FS61] Workforce Strategy and Disclosure (M35): the ISO 30414 skills and capability disclosure pack and the skills
-- pilots registry (SIMULATED demo data; synthetic people only).
-- FS60: kafaa_hc_metrics (the metric library mapped to the ISO 30414 area "Skills, Capabilities and Development": definition, formula, data
--   source, owner function and role card, unit, basis; seeded reference data) and kafaa_hc_disclosures (one per quarter: the computed values,
--   the owner narrative and variance explanation of every metric, the approvals per metric and a materiality statement). Values are
--   computed, never typed: kafaa_hcd_compute = computeDisclosure (src/modules/m35/disclosure.ts) over training records (M04), the learning
--   record store (M27 xAPI), FS30 credits, FS09 rungs (kafaa_air_people, FS36; read-only) and the FS50 board (kafaa_crs_board_core, FS50;
--   read-only). People counts under 10 are suppressed; participation equity reads site, shift crew and grade only (never nationality or
--   gender). A metric publishes only with its narrative (EN/AR) and the approval of a second person who did not write it (maker-checker,
--   ledger). Approved lines are frozen.
-- FS61: kafaa_skill_pilots (hypothesis, comparison group, named independent evaluator, metrics, result including failures, evaluator
--   sign-off, adoption decision; draft -> running -> evaluating -> closed). A pilot cannot close without the named evaluator's sign-off
--   (RPC + check constraint); a closed pilot is always published (failures stay visible). The adoption rate is computed from the statuses
--   (kafaa_spl_adoption = adoptionRate in src/modules/m35/pilots.ts) and shown with the FSC reference read from kafaa_benchmarks.
-- RPCs (TS + local + SQL SECURITY DEFINER + supabase map; authenticated only; the kafaa_hcd_* / kafaa_spl_* helpers executable by nobody):
--   kafaa_compute_disclosure(p_period), kafaa_save_disclosure(p) (workforce_strategy W/A), kafaa_approve_disclosure(p_id, p_metric_ids)
--   (A; maker-checker; ledger), kafaa_pilot_stats(), kafaa_save_pilot(p) (W/A), kafaa_signoff_pilot(p_id, p) (the named evaluator; ledger),
--   kafaa_close_pilot(p_id, p_adoption) (W/A; needs the sign-off; ledger).
-- RBAC (logged in the CONTRACT changelog): hc_* read with workforce_strategy R/W/A (HR director A, HR analyst W, admin R, auditor R; the
--   card says "workforce_strategy A; auditor R; never public", so Agg alone does not read the pack); skill_pilots read with workforce_strategy
--   Agg/R/W/A, staff internal_content R where published, and the evaluator on their own rows (own_profile Own).
-- PGlite parity and checks: scripts/validate/fs71-disclosure-pilots.mjs. Tests: tests/unit/fs71-*.
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects; never removes any object or row. No shared function is
-- redefined (kafaa_air_people, kafaa_crs_board_core, kafaa_crs_quarter are only called).
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file; RLS in the per-statement (perf) form.

-- ───────────── Tables (generated DDL, additive)
-- M35 · Disclosure metric library mapped to the ISO 30414 area Skills, Capabilities and Development (FS60)
create table if not exists kafaa_hc_metrics (
  id text primary key,
  key text not null unique,
  iso_area text not null,
  name_en text not null,
  name_ar text not null,
  definition_en text not null,
  definition_ar text not null,
  formula_en text not null,
  formula_ar text not null,
  source_en text not null,
  source_ar text not null,
  source_tables text[] not null default '{}'::text[],
  owner_function text not null,
  owner_person_id text not null,
  owner_en text not null,
  owner_ar text not null,
  unit text not null check (unit in ('pct', 'hours', 'credits', 'pp')),
  basis text not null check (basis in ('ytd', 'quarter', 'point')),
  better text not null check (better in ('up', 'down')),
  benchmark_ids text[] not null default '{}'::text[],
  status text not null default 'active' check (status in ('active', 'retired')),
  sort integer not null default 0,
  version integer not null default 1,
  simulated boolean not null default true
);
comment on table kafaa_hc_metrics is '[M35] Disclosure metric library mapped to the ISO 30414 area Skills, Capabilities and Development: definition, formula, data source, owner (function and role card), unit, period basis; values are computed, never stored here (FS60)';

-- M35 · Quarterly ISO 30414 skills disclosure (SIMULATED): computed metric values, owner narratives with variance explanations, maker-checker approvals per metric, materiality statement; a metric publishes only with a narrative and a second approver (FS60)
create table if not exists kafaa_hc_disclosures (
  id text primary key,
  period text not null unique,
  period_start date not null,
  period_end date not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  metric_values jsonb not null default '{}'::jsonb,
  narratives jsonb not null default '{}'::jsonb,
  approvals jsonb not null default '{}'::jsonb,
  materiality_en text not null default '',
  materiality_ar text not null default '',
  method text not null,
  computed_on date not null,
  prepared_by text not null,
  created_at timestamptz not null default now(),
  updated_by text,
  updated_at timestamptz not null default now(),
  published_by text,
  published_at timestamptz,
  version integer not null default 1,
  simulated boolean not null default true
);
comment on table kafaa_hc_disclosures is '[M35] Quarterly ISO 30414 skills disclosure (SIMULATED): computed metric values, owner narratives with variance explanations, maker-checker approvals per metric, materiality statement; a metric publishes only with a narrative and a second approver (FS60)';

-- M35 · Skills pilot (workforce experiment): hypothesis, comparison group, named independent evaluator (role card), metrics, result including failures, evaluator sign-off, adoption decision; closed pilots are published and stay visible (FS61)
create table if not exists kafaa_skill_pilots (
  id text primary key,
  title_en text not null,
  title_ar text not null,
  hypothesis_en text not null,
  hypothesis_ar text not null,
  comparison_en text not null,
  comparison_ar text not null,
  pilot_n integer,
  comparison_n integer,
  owner_person_id text not null,
  evaluator_person_id text not null,
  metrics jsonb not null default '[]'::jsonb,
  skill_ids text[] not null default '{}'::text[],
  start_on date not null,
  end_on date not null,
  status text not null default 'draft' check (status in ('draft', 'running', 'evaluating', 'closed')),
  result text check (result in ('success', 'mixed', 'failed')),
  recommendation text check (recommendation in ('adopted', 'expanded', 'further_funded', 'not_adopted')),
  adoption text check (adoption in ('adopted', 'expanded', 'further_funded', 'not_adopted')),
  result_en text not null default '',
  result_ar text not null default '',
  lessons_en text not null default '',
  lessons_ar text not null default '',
  signoff_by text,
  signoff_at timestamptz,
  closed_by text,
  closed_at timestamptz,
  published boolean not null default false,
  benchmark_ids text[] not null default '{}'::text[],
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_by text,
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  sort integer not null default 0,
  simulated boolean not null default true
);
comment on table kafaa_skill_pilots is '[M35] Skills pilot (workforce experiment): hypothesis, comparison group, named independent evaluator (role card), metrics, result including failures, evaluator sign-off, adoption decision; closed pilots are published and stay visible (FS61)';

do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_hc_metrics_owner_person_id_fk') then alter table kafaa_hc_metrics add constraint kafaa_hc_metrics_owner_person_id_fk foreign key (owner_person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_pilots_owner_person_id_fk') then alter table kafaa_skill_pilots add constraint kafaa_skill_pilots_owner_person_id_fk foreign key (owner_person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_pilots_evaluator_person_id_fk') then alter table kafaa_skill_pilots add constraint kafaa_skill_pilots_evaluator_person_id_fk foreign key (evaluator_person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_hc_metrics_owner_person_id_idx on kafaa_hc_metrics (owner_person_id);
create index if not exists kafaa_hc_disclosures_status_idx on kafaa_hc_disclosures (status);
create index if not exists kafaa_skill_pilots_owner_person_id_idx on kafaa_skill_pilots (owner_person_id);
create index if not exists kafaa_skill_pilots_evaluator_person_id_idx on kafaa_skill_pilots (evaluator_person_id);
create index if not exists kafaa_skill_pilots_status_idx on kafaa_skill_pilots (status);
-- every disclosure SIMULATED; a pilot's evaluator is never its owner; evaluating or closed needs the named evaluator's sign-off; a closed pilot
-- is always published (failures stay visible); a closed pilot carries its result and adoption decision.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'kafaa_hc_disclosures_simulated_ck') then
    alter table kafaa_hc_disclosures add constraint kafaa_hc_disclosures_simulated_ck check (simulated); end if;
  if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_pilots_independent_ck') then
    alter table kafaa_skill_pilots add constraint kafaa_skill_pilots_independent_ck check (evaluator_person_id <> owner_person_id); end if;
  if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_pilots_signoff_ck') then
    alter table kafaa_skill_pilots add constraint kafaa_skill_pilots_signoff_ck check (status in ('draft', 'running') or (signoff_by is not null and signoff_by = evaluator_person_id and result is not null)); end if;
  if not exists (select 1 from pg_constraint where conname = 'kafaa_skill_pilots_published_ck') then
    alter table kafaa_skill_pilots add constraint kafaa_skill_pilots_published_ck check (status <> 'closed' or (published and adoption is not null)); end if;
end $$;

-- ───────────── RLS (per-statement form). Writes only via the RPCs.
alter table kafaa_hc_metrics enable row level security;
alter table kafaa_hc_disclosures enable row level security;
alter table kafaa_skill_pilots enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_hc_metrics' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_hc_metrics for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_hc_disclosures' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_hc_disclosures for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_skill_pilots' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_skill_pilots for select to anon, authenticated using (false)'; end if;
end $$;
alter policy kafaa_read on kafaa_hc_metrics using ((SELECT kafaa_has_grant('workforce_strategy'::text, ARRAY['R'::text, 'W'::text, 'A'::text])));
alter policy kafaa_read on kafaa_hc_disclosures using ((SELECT kafaa_has_grant('workforce_strategy'::text, ARRAY['R'::text, 'W'::text, 'A'::text])));
alter policy kafaa_read on kafaa_skill_pilots using ((SELECT kafaa_has_grant('workforce_strategy'::text, ARRAY['Agg'::text, 'R'::text, 'W'::text, 'A'::text]))
  OR (published AND (SELECT kafaa_has_grant('internal_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))
  OR (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((evaluator_person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, evaluator_person_id, NULL::text, false))));
revoke all on kafaa_hc_metrics, kafaa_hc_disclosures, kafaa_skill_pilots from anon, authenticated;
grant select on kafaa_hc_metrics, kafaa_hc_disclosures, kafaa_skill_pilots to anon, authenticated;

-- ═════════════ FS60 rules (mirror of src/modules/m35/disclosure.ts). Internal: not executable by API roles.
-- periodBounds(): first day, last day and 1 January of a quarter; null when malformed
create or replace function kafaa_hcd_bounds(p text) returns jsonb language plpgsql immutable set search_path = public as $$
declare y text; q integer;
begin
  if p is null or p !~ '^20\d\d-Q[1-4]$' then return null; end if;
  y := substr(p, 1, 4); q := substr(p, 7, 1)::integer;
  return jsonb_build_object('start', y || '-' || lpad(((q - 1) * 3 + 1)::text, 2, '0') || '-01',
    'end', y || '-' || lpad((q * 3)::text, 2, '0') || '-' || (array['31', '30', '30', '31'])[q], 'ytd', y || '-01-01');
end $$;
-- periodComputable(): 2025-Q1 up to the current quarter; periodClosed(): the quarter has ended
create or replace function kafaa_hcd_computable(p text, p_today date) returns boolean language sql stable set search_path = public as $$
  select kafaa_hcd_bounds(p) is not null and p collate "C" >= '2025-Q1' and p collate "C" <= kafaa_crs_quarter(p_today) collate "C"
$$;
create or replace function kafaa_hcd_closed(p text, p_today date) returns boolean language sql stable set search_path = public as $$
  select coalesce((kafaa_hcd_bounds(p) ->> 'end')::date < p_today, false)
$$;
-- minutesOf(): an xAPI ISO 8601 duration in whole minutes (a working day counts 8 hours); 0 when absent or malformed
create or replace function kafaa_hcd_minutes(d jsonb) returns integer language plpgsql immutable set search_path = public as $$
declare m text[];
begin
  if d is null or jsonb_typeof(d) <> 'string' then return 0; end if;
  m := regexp_match(d #>> '{}', '^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$');
  if m is null then return 0; end if;
  return floor(coalesce(m[1]::float8, 0) * 8 * 60 + coalesce(m[2]::float8, 0) * 60 + coalesce(m[3]::float8, 0) + coalesce(m[4]::float8, 0) / 60 + 0.5)::integer;
end $$;
-- the trimmed length of a JSON string, -1 for anything else (mirror of len() in disclosure.ts and pilots.ts)
create or replace function kafaa_hcd_len(x jsonb) returns integer language sql immutable set search_path = public as $$
  select case when x is not null and jsonb_typeof(x) = 'string' then char_length(btrim(x #>> '{}', E' \t\n\r')) else -1 end
$$;
-- EN and AR text within bounds, the Arabic one in Arabic script (mirror of bi() / between() + ARABIC)
create or replace function kafaa_hcd_bi(p_en jsonb, p_ar jsonb, p_lo integer, p_hi integer) returns boolean language sql immutable set search_path = public as $$
  select coalesce(kafaa_hcd_len(p_en) between p_lo and p_hi and kafaa_hcd_len(p_ar) between p_lo and p_hi and (p_ar #>> '{}') ~ '[؀-ۿ]', false)
$$;
-- lineProblem(): metric, narrative (20-1200) and variance explanation (10-600), EN and AR
create or replace function kafaa_hcd_line_problem(l jsonb, p_ids text[]) returns text language sql immutable set search_path = public as $$
  select case
    when l is null or jsonb_typeof(l) <> 'object' or jsonb_typeof(l -> 'metric_id') is distinct from 'string' or not ((l ->> 'metric_id') = any(p_ids)) then 'metric'
    when not kafaa_hcd_bi(l -> 'narrative_en', l -> 'narrative_ar', 20, 1200) then 'narrative'
    when not kafaa_hcd_bi(l -> 'variance_en', l -> 'variance_ar', 10, 600) then 'variance'
    else null end
$$;
create or replace function kafaa_hcd_materiality_ok(p_en text, p_ar text) returns boolean language sql immutable set search_path = public as $$
  select kafaa_hcd_bi(to_jsonb(coalesce(p_en, '')), to_jsonb(coalesce(p_ar, '')), 40, 1500)
$$;

-- computeDisclosure(): every active library metric for one quarter (null when the period is malformed)
create or replace function kafaa_hcd_compute(p_period text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  b jsonb := kafaa_hcd_bounds(p_period); v_start date; v_end date; v_ytd date;
  v_hc integer; v_den integer; v_tr text[]; v_trained integer; v_active integer; v_minutes bigint; v_credit bigint; v_aware integer;
  v_rows integer; v_measured integer; v_on integer; v_cells jsonb := '[]'::jsonb; v_gap integer := null; v_g integer; d text; v_none text; k record;
  m record; v_out jsonb := '[]'::jsonb; v_unit text; v_basis text; v_val double precision; v_num jsonb; v_dn jsonb; v_kind text; v_exc integer; v_mc jsonb;
  v_pp text; v_pv jsonb; v_var double precision; v_f integer; v_n integer;
begin
  if b is null then return null; end if;
  v_start := (b ->> 'start')::date; v_end := (b ->> 'end')::date; v_ytd := (b ->> 'ytd')::date;
  select count(*)::integer into v_hc from kafaa_people p where p.kind = 'staff' and p.status = 'active';
  v_den := case when v_hc >= 10 then v_hc else null end;
  -- trained this year: a training record (passed, completed, attended) or a completed / passed LRS statement, 1 January to quarter end
  select coalesce(array_agg(distinct x.pid), '{}'::text[]) into v_tr from (
    select t.person_id as pid from kafaa_training_records t join kafaa_people p on p.id = t.person_id and p.kind = 'staff' and p.status = 'active'
      where t.result in ('passed', 'completed', 'attended') and t.completed_on between v_ytd and v_end
    union
    select s.actor_person_id from kafaa_xapi_statements s join kafaa_people p on p.id = s.actor_person_id and p.kind = 'staff' and p.status = 'active'
      where s.verb in ('completed', 'passed') and (s.occurred_at at time zone 'UTC')::date between v_ytd and v_end) x;
  v_trained := cardinality(v_tr);
  -- active learners: any LRS statement or completed training record dated in the quarter
  select count(distinct x.pid)::integer into v_active from (
    select t.person_id as pid from kafaa_training_records t join kafaa_people p on p.id = t.person_id and p.kind = 'staff' and p.status = 'active'
      where t.result in ('passed', 'completed', 'attended') and t.completed_on between v_start and v_end
    union
    select s.actor_person_id from kafaa_xapi_statements s join kafaa_people p on p.id = s.actor_person_id and p.kind = 'staff' and p.status = 'active'
      where (s.occurred_at at time zone 'UTC')::date between v_start and v_end) x;
  -- learning minutes: training-record hours + LRS durations from every source except the training-record emitter (counted once)
  select coalesce(sum(floor(t.hours::float8 * 60 + 0.5)), 0)::bigint into v_minutes from kafaa_training_records t
    join kafaa_people p on p.id = t.person_id and p.kind = 'staff' and p.status = 'active'
    where t.result in ('passed', 'completed', 'attended') and t.completed_on between v_ytd and v_end;
  v_minutes := v_minutes + (select coalesce(sum(kafaa_hcd_minutes(s.result -> 'duration')), 0)::bigint from kafaa_xapi_statements s
    join kafaa_people p on p.id = s.actor_person_id and p.kind = 'staff' and p.status = 'active'
    where s.source <> 'm04_course' and (s.occurred_at at time zone 'UTC')::date between v_ytd and v_end);
  select coalesce(sum(c.notional_hours), 0)::bigint into v_credit from kafaa_credit_ledger c join kafaa_people p on p.id = c.person_id and p.kind = 'staff' and p.status = 'active'
    where c.status = 'counted' and c.completed_on between v_ytd and v_end;
  select count(*)::integer into v_aware from jsonb_array_elements(kafaa_air_people()) e where (e ->> 'rung')::integer >= 1;
  -- FS50 register rows (adopted) on the quarter's last day
  select count(*)::integer,
         count(*) filter (where not (r -> 'progress' ->> 'suppressed')::boolean and (r -> 'progress' ->> 'status') not in ('no_target', 'suppressed'))::integer,
         count(*) filter (where not (r -> 'progress' ->> 'suppressed')::boolean and (r -> 'progress' ->> 'status') in ('met', 'on_track'))::integer
    into v_rows, v_measured, v_on
    from jsonb_array_elements(coalesce(kafaa_crs_board_core(v_end) -> 'rows', '[]'::jsonb)) r join kafaa_critical_skills c on c.id = r ->> 'id' and c.status = 'active';
  -- participation equity: share trained this year by site, shift crew and grade (groups under 10 suppressed)
  foreach d in array array['site', 'shift', 'grade'] loop
    v_none := case d when 'shift' then 'day' else 'none' end;
    for k in
      select z.key, z.n, z.tr from (
        select coalesce(case d when 'site' then p.unit when 'shift' then p.crew else p.level end, v_none) as key, count(*)::integer as n,
               count(*) filter (where p.id = any(v_tr))::integer as tr
        from kafaa_people p where p.kind = 'staff' and p.status = 'active' group by 1) z
      order by (z.key = v_none), z.key collate "C"
    loop
      if k.n >= 10 and v_den is not null then
        v_cells := v_cells || jsonb_build_array(jsonb_build_object('dim', d, 'key', k.key, 'n', k.n, 'trained', case when k.tr >= 10 then k.tr end,
          'not_trained', case when k.n - k.tr >= 10 then k.n - k.tr end, 'pct', floor(1000.0::float8 * k.tr / k.n + 0.5) / 10));
      else
        v_cells := v_cells || jsonb_build_array(jsonb_build_object('dim', d, 'key', k.key, 'n', null, 'trained', null, 'not_trained', null, 'pct', null));
      end if;
    end loop;
    select case when count(*) >= 2 then max(x.p10) - min(x.p10) end into v_g
      from (select floor((c ->> 'pct')::float8 * 10 + 0.5)::integer as p10 from jsonb_array_elements(v_cells) c where c ->> 'dim' = d and jsonb_typeof(c -> 'pct') = 'number') x;
    if v_g is not null then v_gap := greatest(coalesce(v_gap, 0), v_g); end if;
  end loop;
  for m in select h.id, h.key from kafaa_hc_metrics h
           where h.status = 'active' and h.key in ('trained_pct', 'active_learners_pct', 'hours_per_employee', 'ai_fundamentals_pct', 'critical_on_track_pct', 'credits_per_employee', 'participation_gap_pp')
           order by h.sort, h.id collate "C" loop
    v_unit := case m.key when 'hours_per_employee' then 'hours' when 'credits_per_employee' then 'credits' when 'participation_gap_pp' then 'pp' else 'pct' end;
    v_basis := case m.key when 'active_learners_pct' then 'quarter' when 'ai_fundamentals_pct' then 'point' when 'critical_on_track_pct' then 'point' else 'ytd' end;
    v_exc := 0; v_mc := '[]'::jsonb; v_dn := to_jsonb(v_den);
    if m.key in ('trained_pct', 'active_learners_pct', 'ai_fundamentals_pct') then
      v_n := case m.key when 'trained_pct' then v_trained when 'active_learners_pct' then v_active else v_aware end;
      v_val := case when v_den is not null then floor(1000.0::float8 * v_n / v_den + 0.5) / 10 end;
      v_num := case when v_den is not null and v_n >= 10 then to_jsonb(v_n) else 'null'::jsonb end; v_kind := 'people';
    elsif m.key = 'hours_per_employee' then
      v_val := case when v_den is not null then floor((10.0::float8 * v_minutes) / (60.0::float8 * v_den) + 0.5) / 10 end;
      v_num := case when v_den is not null then to_jsonb(floor((10.0::float8 * v_minutes) / 60.0::float8 + 0.5) / 10) else 'null'::jsonb end; v_kind := 'hours';
    elsif m.key = 'credits_per_employee' then
      v_val := case when v_den is not null then floor((100.0::float8 * v_credit) / (10.0::float8 * v_den) + 0.5) / 100 end;
      v_num := case when v_den is not null then to_jsonb(v_credit::float8 / 10) else 'null'::jsonb end; v_kind := 'credits';
    elsif m.key = 'critical_on_track_pct' then
      v_val := case when v_measured > 0 then floor(1000.0::float8 * v_on / v_measured + 0.5) / 10 end;
      v_num := to_jsonb(v_on); v_dn := to_jsonb(v_measured); v_kind := 'register_rows'; v_exc := v_rows - v_measured;
    else
      v_val := case when v_den is not null and v_gap is not null then v_gap::float8 / 10 end;
      v_num := 'null'::jsonb; v_dn := 'null'::jsonb; v_kind := 'cells'; v_mc := v_cells;
    end if;
    v_pp := null; v_pv := null;
    select d0.period, x.value -> 'value' into v_pp, v_pv
      from kafaa_hc_disclosures d0 cross join lateral jsonb_array_elements(case when jsonb_typeof(d0.metric_values -> 'metrics') = 'array' then d0.metric_values -> 'metrics' else '[]'::jsonb end) x(value)
      where d0.period collate "C" < p_period collate "C" and d0.approvals ? m.id and x.value ->> 'metric_id' = m.id
      order by d0.period collate "C" desc limit 1;
    v_f := case v_unit when 'credits' then 100 else 10 end;
    v_var := case when v_val is not null and v_pv is not null and jsonb_typeof(v_pv) = 'number'
      then (floor(v_val * v_f + 0.5) - floor((v_pv #>> '{}')::float8 * v_f + 0.5)) / v_f end;
    v_out := v_out || jsonb_build_array(jsonb_build_object('metric_id', m.id, 'key', m.key, 'unit', v_unit, 'basis', v_basis, 'value', v_val, 'num', v_num, 'den', v_dn,
      'count_kind', v_kind, 'excluded', v_exc, 'suppressed', v_val is null, 'cells', v_mc, 'prev_period', v_pp,
      'prev_value', case when v_pv is null or jsonb_typeof(v_pv) <> 'number' then 'null'::jsonb else v_pv end, 'variance', v_var));
  end loop;
  return jsonb_build_object('period', p_period, 'start', b ->> 'start', 'end', b ->> 'end', 'ytd', b ->> 'ytd', 'method', 'fs60-v1', 'simulated', true, 'min_group', 10,
    'headcount', v_den, 'metrics', v_out);
end $$;

-- ───────────── FS60 RPCs
create or replace function kafaa_compute_disclosure(p_period text) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_role text;
begin
  if kafaa_me() is null then return kafaa_refuse('disclosure.compute', 'hc_disclosures', null, 'not_signed_in', 'Sign in to use the disclosure pack'); end if;
  if not kafaa_has_grant('workforce_strategy', array['R', 'W', 'A']) then
    return kafaa_refuse('disclosure.compute', 'hc_disclosures', null, 'forbidden', 'The disclosure pack is for the HR director, HR analysts, admins and auditors'); end if;
  v_role := kafaa_acting_role('workforce_strategy', array['R', 'W', 'A']);
  if not kafaa_hcd_computable(coalesce(p_period, ''), current_date) then
    return kafaa_refuse('disclosure.compute', 'hc_disclosures', null, 'invalid', 'Choose a quarter from 2025-Q1 to the current quarter', v_role); end if;
  return jsonb_build_object('ok', true, 'code', 'ok', 'message', 'Disclosure values (SIMULATED)', 'audit_seq', null, 'ledger_seq', null, 'data', kafaa_hcd_compute(p_period));
end $$;

create or replace function kafaa_save_disclosure(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; v_period text := case when jsonb_typeof(p -> 'period') = 'string' then p ->> 'period' else '' end;
  v_id text := 'hcd-' || v_period; v_ent text := case when v_period <> '' then 'hcd-' || v_period end;
  cur kafaa_hc_disclosures; v_ids text[]; v_lines jsonb; l jsonb; v_pr text; v_seen text[] := '{}'::text[]; v_has boolean; v_men text; v_mar text;
  v_apr jsonb; v_nar jsonb; v_old jsonb; v_same boolean; v_mid text; v_fresh jsonb; v_stored jsonb; v_ver integer; v_ready integer; v_appr integer;
  v_ts text := to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'); b jsonb; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('disclosure.save', 'hc_disclosures', v_ent, 'not_signed_in', 'Sign in to use the disclosure pack'); end if;
  if not kafaa_has_grant('workforce_strategy', array['W', 'A']) then
    return kafaa_refuse('disclosure.save', 'hc_disclosures', v_ent, 'forbidden', 'Only HR analysts and the HR director prepare a disclosure'); end if;
  v_role := kafaa_acting_role('workforce_strategy', array['W', 'A']);
  if not kafaa_hcd_computable(v_period, current_date) then
    return kafaa_refuse('disclosure.save', 'hc_disclosures', v_ent, 'invalid', 'Choose a quarter from 2025-Q1 to the current quarter', v_role); end if;
  if not kafaa_hcd_closed(v_period, current_date) then
    return kafaa_refuse('disclosure.save', 'hc_disclosures', v_ent, 'period_open', 'A disclosure is prepared only after the quarter has ended', v_role); end if;
  select * into cur from kafaa_hc_disclosures where id = v_id;
  if cur.id is not null and cur.status = 'published' then
    return kafaa_refuse('disclosure.save', 'hc_disclosures', v_ent, 'published', 'This disclosure is published and can no longer change', v_role); end if;
  select coalesce(array_agg(h.id order by h.sort, h.id collate "C"), '{}'::text[]) into v_ids from kafaa_hc_metrics h where h.status = 'active';
  v_lines := case when p -> 'lines' is null or jsonb_typeof(p -> 'lines') = 'null' then '[]'::jsonb else p -> 'lines' end;
  if jsonb_typeof(v_lines) <> 'array' or jsonb_array_length(v_lines) > cardinality(v_ids) then
    return kafaa_refuse('disclosure.save', 'hc_disclosures', v_ent, 'invalid', 'Check the disclosure: send the lines as a list with one line per metric', v_role); end if;
  for l in select e from jsonb_array_elements(v_lines) e loop
    v_pr := kafaa_hcd_line_problem(l, v_ids);
    if v_pr is not null then
      return kafaa_refuse('disclosure.save', 'hc_disclosures', v_ent, 'invalid', 'Check the disclosure: ' || case v_pr
        when 'metric' then 'choose a metric from the library'
        when 'narrative' then 'an owner narrative of 20 to 1200 characters in English and in Arabic'
        else 'a variance explanation of 10 to 600 characters in English and in Arabic' end, v_role);
    end if;
    if (l ->> 'metric_id') = any(v_seen) then
      return kafaa_refuse('disclosure.save', 'hc_disclosures', v_ent, 'invalid', 'Check the disclosure: send the lines as a list with one line per metric', v_role); end if;
    v_seen := v_seen || (l ->> 'metric_id');
  end loop;
  v_has := (p -> 'materiality_en' is not null and jsonb_typeof(p -> 'materiality_en') <> 'null') or (p -> 'materiality_ar' is not null and jsonb_typeof(p -> 'materiality_ar') <> 'null');
  v_men := case when v_has then (case when jsonb_typeof(p -> 'materiality_en') = 'string' then btrim(p ->> 'materiality_en', E' \t\n\r') else '' end) else btrim(coalesce(cur.materiality_en, ''), E' \t\n\r') end;
  v_mar := case when v_has then (case when jsonb_typeof(p -> 'materiality_ar') = 'string' then btrim(p ->> 'materiality_ar', E' \t\n\r') else '' end) else btrim(coalesce(cur.materiality_ar, ''), E' \t\n\r') end;
  if v_has and (v_men <> '' or v_mar <> '') and not kafaa_hcd_materiality_ok(v_men, v_mar) then
    return kafaa_refuse('disclosure.save', 'hc_disclosures', v_ent, 'invalid', 'Check the disclosure: a materiality statement of 40 to 1500 characters in English and in Arabic', v_role); end if;
  v_apr := coalesce(cur.approvals, '{}'::jsonb);
  v_nar := coalesce(cur.narratives, '{}'::jsonb);
  for l in select e from jsonb_array_elements(v_lines) e loop
    v_mid := l ->> 'metric_id';
    v_old := v_nar -> v_mid;
    v_same := v_old is not null and v_old ->> 'narrative_en' = btrim(l ->> 'narrative_en', E' \t\n\r') and v_old ->> 'narrative_ar' = btrim(l ->> 'narrative_ar', E' \t\n\r')
      and v_old ->> 'variance_en' = btrim(l ->> 'variance_en', E' \t\n\r') and v_old ->> 'variance_ar' = btrim(l ->> 'variance_ar', E' \t\n\r');
    if v_apr ? v_mid then
      if not coalesce(v_same, false) then return kafaa_refuse('disclosure.save', 'hc_disclosures', v_ent, 'locked', 'An approved line cannot change', v_role); end if;
      continue;
    end if;
    if not coalesce(v_same, false) then
      v_nar := v_nar || jsonb_build_object(v_mid, jsonb_build_object('narrative_en', btrim(l ->> 'narrative_en', E' \t\n\r'), 'narrative_ar', btrim(l ->> 'narrative_ar', E' \t\n\r'),
        'variance_en', btrim(l ->> 'variance_en', E' \t\n\r'), 'variance_ar', btrim(l ->> 'variance_ar', E' \t\n\r'), 'by', me, 'at', v_ts));
    end if;
  end loop;
  -- fresh values for every unapproved metric; approved lines keep the values that were approved
  v_fresh := kafaa_hcd_compute(v_period);
  v_stored := case when jsonb_typeof(cur.metric_values -> 'metrics') = 'array' then cur.metric_values -> 'metrics' else '[]'::jsonb end;
  v_fresh := jsonb_set(v_fresh, '{metrics}', coalesce((select jsonb_agg(case when v_apr ? (x.value ->> 'metric_id')
      then coalesce((select s.value from jsonb_array_elements(v_stored) s(value) where s.value ->> 'metric_id' = x.value ->> 'metric_id' limit 1), x.value) else x.value end order by x.i)
    from jsonb_array_elements(v_fresh -> 'metrics') with ordinality x(value, i)), '[]'::jsonb));
  b := kafaa_hcd_bounds(v_period);
  v_ver := coalesce(cur.version, 0) + 1;
  if cur.id is not null then
    update kafaa_hc_disclosures set status = 'draft', metric_values = v_fresh, narratives = v_nar, approvals = v_apr, materiality_en = v_men, materiality_ar = v_mar, method = v_fresh ->> 'method',
      computed_on = current_date, updated_by = me, updated_at = now(), version = v_ver where id = v_id;
  else
    insert into kafaa_hc_disclosures (id, period, period_start, period_end, status, metric_values, narratives, approvals, materiality_en, materiality_ar, method, computed_on, prepared_by,
      created_at, updated_by, updated_at, published_by, published_at, version, simulated)
    values (v_id, v_period, (b ->> 'start')::date, (b ->> 'end')::date, 'draft', v_fresh, v_nar, v_apr, v_men, v_mar, v_fresh ->> 'method', current_date, me, now(), null, now(), null, null, v_ver, true);
  end if;
  select count(*) filter (where not (v_apr ? x.id) and v_nar ? x.id and kafaa_hcd_line_problem((v_nar -> x.id) || jsonb_build_object('metric_id', x.id), array[x.id]) is null)::integer,
         count(*) filter (where v_apr ? x.id)::integer
    into v_ready, v_appr from unnest(v_ids) x(id);
  a := kafaa_audit('disclosure.save', 'hc_disclosures', v_id, 'ok', v_period || ' v' || v_ver || ' ready ' || v_ready || ' approved ' || v_appr, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when cur.id is not null then 'Disclosure saved' else 'Disclosure prepared' end, a, null,
    jsonb_build_object('id', v_id, 'period', v_period, 'version', v_ver, 'ready', v_ready, 'approved', v_appr));
end $$;

create or replace function kafaa_approve_disclosure(p_id text, p_metric_ids jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; v_ent text := nullif(coalesce(p_id, ''), ''); cur kafaa_hc_disclosures; v_all text[]; v_ids text[]; v_mid text; v_n jsonb;
  v_fresh jsonb; v_s jsonb; v_f jsonb; v_apr jsonb; v_pub boolean; v_ts text := to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'); a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('disclosure.approve', 'hc_disclosures', v_ent, 'not_signed_in', 'Sign in to use the disclosure pack'); end if;
  if not kafaa_has_grant('workforce_strategy', array['A']) then
    return kafaa_refuse('disclosure.approve', 'hc_disclosures', v_ent, 'forbidden', 'Only the HR director approves disclosure lines'); end if;
  v_role := kafaa_acting_role('workforce_strategy', array['A']);
  select * into cur from kafaa_hc_disclosures where id = p_id;
  if cur.id is null then return kafaa_refuse('disclosure.approve', 'hc_disclosures', v_ent, 'not_found', 'Disclosure not found', v_role); end if;
  if cur.status = 'published' then return kafaa_refuse('disclosure.approve', 'hc_disclosures', v_ent, 'published', 'This disclosure is published and can no longer change', v_role); end if;
  select coalesce(array_agg(h.id order by h.sort, h.id collate "C"), '{}'::text[]) into v_all from kafaa_hc_metrics h where h.status = 'active';
  if p_metric_ids is null or jsonb_typeof(p_metric_ids) <> 'array' or jsonb_array_length(p_metric_ids) = 0
     or exists (select 1 from jsonb_array_elements(p_metric_ids) e where jsonb_typeof(e) <> 'string' or not ((e #>> '{}') = any(v_all)))
     or (select count(distinct e #>> '{}') from jsonb_array_elements(p_metric_ids) e) <> jsonb_array_length(p_metric_ids) then
    return kafaa_refuse('disclosure.approve', 'hc_disclosures', v_ent, 'invalid', 'Check the disclosure: choose one or more metric lines of this disclosure', v_role); end if;
  select array_agg(e #>> '{}' order by i) into v_ids from jsonb_array_elements(p_metric_ids) with ordinality x(e, i);
  if not kafaa_hcd_materiality_ok(cur.materiality_en, cur.materiality_ar) then
    return kafaa_refuse('disclosure.approve', 'hc_disclosures', v_ent, 'no_materiality', 'Write the materiality statement (40 to 1500 characters in English and in Arabic) before approving', v_role); end if;
  foreach v_mid in array v_ids loop
    if coalesce(cur.approvals, '{}'::jsonb) ? v_mid then return kafaa_refuse('disclosure.approve', 'hc_disclosures', v_ent, 'already_approved', 'This line is already approved', v_role); end if;
    v_n := coalesce(cur.narratives, '{}'::jsonb) -> v_mid;
    if v_n is null or jsonb_typeof(v_n) <> 'object' or kafaa_hcd_line_problem(v_n || jsonb_build_object('metric_id', v_mid), array[v_mid]) is not null then
      return kafaa_refuse('disclosure.approve', 'hc_disclosures', v_ent, 'no_narrative', 'A metric publishes only with its narrative and variance explanation in English and in Arabic', v_role); end if;
    if v_n ->> 'by' = me then return kafaa_refuse('disclosure.approve', 'hc_disclosures', v_ent, 'maker_checker', 'A second person must approve: you wrote this narrative', v_role); end if;
  end loop;
  v_fresh := kafaa_hcd_compute(cur.period);
  foreach v_mid in array v_ids loop
    v_s := null; v_f := null;
    select x.value into v_s from jsonb_array_elements(case when jsonb_typeof(cur.metric_values -> 'metrics') = 'array' then cur.metric_values -> 'metrics' else '[]'::jsonb end) x(value)
      where x.value ->> 'metric_id' = v_mid limit 1;
    select x.value into v_f from jsonb_array_elements(v_fresh -> 'metrics') x(value) where x.value ->> 'metric_id' = v_mid limit 1;
    if v_s is null or v_f is null or jsonb_build_object('value', v_s -> 'value', 'num', v_s -> 'num', 'den', v_s -> 'den') <> jsonb_build_object('value', v_f -> 'value', 'num', v_f -> 'num', 'den', v_f -> 'den') then
      return kafaa_refuse('disclosure.approve', 'hc_disclosures', v_ent, 'stale', 'The data changed since the values were computed; save the disclosure again to refresh them', v_role); end if;
  end loop;
  v_apr := coalesce(cur.approvals, '{}'::jsonb);
  foreach v_mid in array v_ids loop v_apr := v_apr || jsonb_build_object(v_mid, jsonb_build_object('by', me, 'at', v_ts)); end loop;
  v_pub := not exists (select 1 from unnest(v_all) x(id) where not (v_apr ? x.id));
  update kafaa_hc_disclosures set approvals = v_apr, status = case when v_pub then 'published' else 'draft' end, published_by = case when v_pub then me end,
    published_at = case when v_pub then now() end, updated_by = me, updated_at = now(), version = cur.version + 1 where id = p_id;
  l := kafaa_ledger('kafaa.workforce.hc_disclosure_approve', 'ISO 30414 disclosure ' || cur.period || ': ' || cardinality(v_ids) || ' line(s) approved' || case when v_pub then ', published' else '' end);
  a := kafaa_audit('disclosure.approve', 'hc_disclosures', p_id, 'ok', cur.period || ' approved ' || array_to_string(v_ids, ',') || case when v_pub then ' published' else '' end,
    case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when v_pub then 'Disclosure published' else 'Lines approved' end, a, l, jsonb_build_object('id', p_id, 'approved', to_jsonb(v_ids), 'published', v_pub));
end $$;

-- ═════════════ FS61 rules (mirror of src/modules/m35/pilots.ts). Internal: not executable by API roles.
create or replace function kafaa_spl_num(x jsonb) returns boolean language sql immutable set search_path = public as $$
  select x is not null and jsonb_typeof(x) = 'number' and abs((x #>> '{}')::numeric) <= 1000000
$$;
create or replace function kafaa_spl_date_ok(x jsonb) returns boolean language plpgsql immutable set search_path = public as $$
declare s text;
begin
  if x is null or jsonb_typeof(x) <> 'string' then return false; end if;
  s := x #>> '{}';
  if s !~ '^20(2[4-9]|30)-\d\d-\d\d$' then return false; end if;
  return s::date::text = s;
exception when others then return false;
end $$;
create or replace function kafaa_spl_group_ok(x jsonb) returns boolean language sql immutable set search_path = public as $$
  select x is null or jsonb_typeof(x) = 'null'
    or (jsonb_typeof(x) = 'number' and (x #>> '{}')::numeric = floor((x #>> '{}')::numeric) and (x #>> '{}')::numeric between 0 and 100000)
$$;
-- pilotProblem(): the register check (first problem or null); p_creator = who registered it; p_new = a new pilot (id format checked)
create or replace function kafaa_spl_problem(p jsonb, p_creator text, p_new boolean) returns text language plpgsql stable security definer set search_path = public as $$
declare m jsonb; v_keys text[] := '{}'::text[]; v_staff text[]; v_sk jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return 'title'; end if;
  if p_new and not (jsonb_typeof(p -> 'id') = 'string' and (p ->> 'id') ~ '^sp-[a-z0-9-]{3,48}$') then return 'id'; end if;
  if not kafaa_hcd_bi(p -> 'title_en', p -> 'title_ar', 5, 140) then return 'title'; end if;
  if not kafaa_hcd_bi(p -> 'hypothesis_en', p -> 'hypothesis_ar', 20, 800) then return 'hypothesis'; end if;
  if not kafaa_hcd_bi(p -> 'comparison_en', p -> 'comparison_ar', 10, 600) then return 'comparison'; end if;
  select coalesce(array_agg(pe.id), '{}'::text[]) into v_staff from kafaa_people pe where pe.kind = 'staff' and pe.status = 'active';
  if jsonb_typeof(p -> 'owner_person_id') is distinct from 'string' or jsonb_typeof(p -> 'evaluator_person_id') is distinct from 'string'
     or not ((p ->> 'owner_person_id') = any(v_staff)) or not ((p ->> 'evaluator_person_id') = any(v_staff)) then return 'people'; end if;
  if p ->> 'evaluator_person_id' = p ->> 'owner_person_id' or p ->> 'evaluator_person_id' = p_creator then return 'independence'; end if;
  if jsonb_typeof(p -> 'metrics') is distinct from 'array' or jsonb_array_length(p -> 'metrics') < 1 or jsonb_array_length(p -> 'metrics') > 5 then return 'metrics'; end if;
  for m in select e from jsonb_array_elements(p -> 'metrics') e loop
    if jsonb_typeof(m) <> 'object' or jsonb_typeof(m -> 'key') is distinct from 'string' or (m ->> 'key') !~ '^[a-z0-9_]{2,40}$' or (m ->> 'key') = any(v_keys) then return 'metrics'; end if;
    v_keys := v_keys || (m ->> 'key');
    if not kafaa_hcd_bi(m -> 'label_en', m -> 'label_ar', 3, 120) or jsonb_typeof(m -> 'unit') is distinct from 'string' or (m ->> 'unit') not in ('pct', 'count', 'hours', 'score', 'days')
       or not kafaa_spl_num(m -> 'baseline') or not kafaa_spl_num(m -> 'target') then return 'metrics'; end if;
  end loop;
  v_sk := p -> 'skill_ids';
  if jsonb_typeof(v_sk) is distinct from 'array' or jsonb_array_length(v_sk) > 6
     or exists (select 1 from jsonb_array_elements(v_sk) e where jsonb_typeof(e) <> 'string' or not exists (select 1 from kafaa_skills s where s.id = e #>> '{}'))
     or (select count(distinct e #>> '{}') from jsonb_array_elements(v_sk) e) <> jsonb_array_length(v_sk) then return 'skills'; end if;
  if not kafaa_spl_date_ok(p -> 'start_on') or not kafaa_spl_date_ok(p -> 'end_on') or (p ->> 'start_on') collate "C" > (p ->> 'end_on') collate "C" then return 'dates'; end if;
  if not kafaa_spl_group_ok(p -> 'pilot_n') or not kafaa_spl_group_ok(p -> 'comparison_n') then return 'groups'; end if;
  if jsonb_typeof(p -> 'status') is distinct from 'string' or (p ->> 'status') not in ('draft', 'running') then return 'status'; end if;
  return null;
end $$;
-- signoffProblem(): result, recommendation (a failed pilot is not adopted or further funded), summary, lessons, a measured value per metric
create or replace function kafaa_spl_signoff_problem(p jsonb, p_keys text[]) returns text language plpgsql immutable set search_path = public as $$
declare m jsonb; v_seen text[] := '{}'::text[];
begin
  if p is null or jsonb_typeof(p) <> 'object' or jsonb_typeof(p -> 'result') is distinct from 'string' or (p ->> 'result') not in ('success', 'mixed', 'failed') then return 'result'; end if;
  if jsonb_typeof(p -> 'recommendation') is distinct from 'string' or (p ->> 'recommendation') not in ('adopted', 'expanded', 'further_funded', 'not_adopted')
     or (p ->> 'result' = 'failed' and (p ->> 'recommendation') not in ('not_adopted', 'further_funded')) then return 'recommendation'; end if;
  if not kafaa_hcd_bi(p -> 'result_en', p -> 'result_ar', 20, 1200) then return 'summary'; end if;
  if not kafaa_hcd_bi(p -> 'lessons_en', p -> 'lessons_ar', 10, 1200) then return 'lessons'; end if;
  if jsonb_typeof(p -> 'metric_results') is distinct from 'array' or jsonb_array_length(p -> 'metric_results') <> cardinality(p_keys) then return 'metrics'; end if;
  for m in select e from jsonb_array_elements(p -> 'metric_results') e loop
    if jsonb_typeof(m) <> 'object' or jsonb_typeof(m -> 'key') is distinct from 'string' or not ((m ->> 'key') = any(p_keys)) or (m ->> 'key') = any(v_seen)
       or not kafaa_spl_num(m -> 'pilot') or not (m -> 'comparison' is null or jsonb_typeof(m -> 'comparison') = 'null' or kafaa_spl_num(m -> 'comparison')) then return 'metrics'; end if;
    v_seen := v_seen || (m ->> 'key');
  end loop;
  return null;
end $$;
create or replace function kafaa_spl_close_problem(p_adoption text, p_result text) returns text language sql immutable set search_path = public as $$
  select case when p_adoption is null or p_adoption not in ('adopted', 'expanded', 'further_funded', 'not_adopted')
    or (p_result = 'failed' and p_adoption not in ('not_adopted', 'further_funded')) then 'adoption' else null end
$$;
-- adoptionRate(): closed pilots adopted, expanded or further funded out of all closed pilots (failures stay in the denominator)
create or replace function kafaa_spl_adoption() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'closed', count(*) filter (where status = 'closed'),
    'adopted', count(*) filter (where status = 'closed' and adoption = 'adopted'),
    'expanded', count(*) filter (where status = 'closed' and adoption = 'expanded'),
    'further_funded', count(*) filter (where status = 'closed' and adoption = 'further_funded'),
    'not_adopted', count(*) filter (where status = 'closed' and adoption = 'not_adopted'),
    'failed', count(*) filter (where status = 'closed' and result = 'failed'),
    'mixed', count(*) filter (where status = 'closed' and result = 'mixed'),
    'success', count(*) filter (where status = 'closed' and result = 'success'),
    'rate', case when count(*) filter (where status = 'closed') > 0
      then floor(1000.0::float8 * count(*) filter (where status = 'closed' and adoption in ('adopted', 'expanded', 'further_funded')) / count(*) filter (where status = 'closed') + 0.5) / 10 end,
    'running', count(*) filter (where status = 'running'),
    'evaluating', count(*) filter (where status = 'evaluating'),
    'draft', count(*) filter (where status = 'draft'))
  from kafaa_skill_pilots
$$;
-- referenceOf(): the FSC adoption-rate figure from the benchmark registry (never typed)
create or replace function kafaa_spl_reference() returns jsonb language sql stable security definer set search_path = public as $$
  select (select jsonb_build_object('id', b.id, 'figure', f ->> 'key', 'value', f -> 'value', 'url', coalesce(b.urls[1], ''), 'as_of', left(b.as_of::text, 10))
          from kafaa_benchmarks b cross join lateral jsonb_array_elements(case when jsonb_typeof(b.figures) = 'array' then b.figures else '[]'::jsonb end) f
          where b.id = 'FSC' and f ->> 'key' = 'adoption_rate' and jsonb_typeof(f -> 'value') = 'number' limit 1)
$$;

-- ───────────── FS61 RPCs
create or replace function kafaa_pilot_stats() returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if kafaa_me() is null then return kafaa_refuse('pilot.stats', 'skill_pilots', null, 'not_signed_in', 'Sign in to see skills pilots'); end if;
  if not kafaa_has_grant('workforce_strategy', array['Agg', 'R', 'W', 'A']) and not kafaa_has_grant('internal_content', array['R']) then
    return kafaa_refuse('pilot.stats', 'skill_pilots', null, 'forbidden', 'Pilot results are for staff; the full registry is for HR, the training manager, admins and auditors'); end if;
  return jsonb_build_object('ok', true, 'code', 'ok', 'message', 'Skills pilots', 'audit_seq', null, 'ledger_seq', null,
    'data', kafaa_spl_adoption() || jsonb_build_object('reference', coalesce(kafaa_spl_reference(), 'null'::jsonb)));
end $$;

create or replace function kafaa_save_pilot(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; v_id text := case when jsonb_typeof(p -> 'id') = 'string' and p ->> 'id' <> '' then p ->> 'id' end; cur kafaa_skill_pilots; v_pr text;
  v_ver integer; v_metrics jsonb; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('pilot.save', 'skill_pilots', v_id, 'not_signed_in', 'Sign in to see skills pilots'); end if;
  if not kafaa_has_grant('workforce_strategy', array['W', 'A']) then return kafaa_refuse('pilot.save', 'skill_pilots', v_id, 'forbidden', 'Only HR analysts and the HR director register or close pilots'); end if;
  v_role := kafaa_acting_role('workforce_strategy', array['W', 'A']);
  select * into cur from kafaa_skill_pilots where id = v_id;
  if cur.id is not null and cur.status not in ('draft', 'running') then return kafaa_refuse('pilot.save', 'skill_pilots', v_id, 'locked', 'A pilot under evaluation or closed cannot be edited', v_role); end if;
  v_pr := kafaa_spl_problem(p, case when cur.id is not null then cur.created_by else me end, cur.id is null);
  if v_pr is null and cur.id is not null and cur.status = 'running' and p ->> 'status' = 'draft' then v_pr := 'status'; end if;
  if v_pr is not null then
    return kafaa_refuse('pilot.save', 'skill_pilots', v_id, 'invalid', 'Check the pilot: ' || case v_pr
      when 'id' then 'an id like sp-short-name (lowercase letters, digits and hyphens)'
      when 'title' then 'a title of 5 to 140 characters in English and in Arabic'
      when 'hypothesis' then 'a hypothesis of 20 to 800 characters in English and in Arabic'
      when 'comparison' then 'a comparison group of 10 to 600 characters in English and in Arabic'
      when 'people' then 'an owner and an evaluator who are active staff role cards'
      when 'independence' then 'an independent evaluator: not the pilot owner and not the person who registered it'
      when 'metrics' then 'one to five metrics, each with a key, labels in English and Arabic, a unit, a baseline and a target'
      when 'skills' then 'up to six catalogue skills'
      when 'dates' then 'start and end dates from 2024 to 2030, the start on or before the end'
      when 'groups' then 'group sizes as whole numbers from 0 to 100000'
      else 'choose draft or running (a running pilot stays running)' end, v_role);
  end if;
  select jsonb_agg(jsonb_build_object('key', m ->> 'key', 'label_en', btrim(m ->> 'label_en', E' \t\n\r'), 'label_ar', btrim(m ->> 'label_ar', E' \t\n\r'), 'unit', m ->> 'unit',
      'baseline', m -> 'baseline', 'target', m -> 'target', 'pilot', null, 'comparison', null) order by i)
    into v_metrics from jsonb_array_elements(p -> 'metrics') with ordinality x(m, i);
  v_ver := coalesce(cur.version, 0) + 1;
  if cur.id is not null then
    update kafaa_skill_pilots set title_en = btrim(p ->> 'title_en', E' \t\n\r'), title_ar = btrim(p ->> 'title_ar', E' \t\n\r'), hypothesis_en = btrim(p ->> 'hypothesis_en', E' \t\n\r'),
      hypothesis_ar = btrim(p ->> 'hypothesis_ar', E' \t\n\r'), comparison_en = btrim(p ->> 'comparison_en', E' \t\n\r'), comparison_ar = btrim(p ->> 'comparison_ar', E' \t\n\r'),
      pilot_n = (p ->> 'pilot_n')::integer, comparison_n = (p ->> 'comparison_n')::integer, owner_person_id = p ->> 'owner_person_id', evaluator_person_id = p ->> 'evaluator_person_id',
      metrics = v_metrics, skill_ids = array(select jsonb_array_elements_text(p -> 'skill_ids')), start_on = (p ->> 'start_on')::date, end_on = (p ->> 'end_on')::date,
      status = p ->> 'status', updated_by = me, updated_at = now(), version = v_ver where id = v_id;
  else
    insert into kafaa_skill_pilots (id, title_en, title_ar, hypothesis_en, hypothesis_ar, comparison_en, comparison_ar, pilot_n, comparison_n, owner_person_id, evaluator_person_id,
      metrics, skill_ids, start_on, end_on, status, published, benchmark_ids, created_by, created_at, updated_at, version, sort, simulated)
    values (v_id, btrim(p ->> 'title_en', E' \t\n\r'), btrim(p ->> 'title_ar', E' \t\n\r'), btrim(p ->> 'hypothesis_en', E' \t\n\r'), btrim(p ->> 'hypothesis_ar', E' \t\n\r'),
      btrim(p ->> 'comparison_en', E' \t\n\r'), btrim(p ->> 'comparison_ar', E' \t\n\r'), (p ->> 'pilot_n')::integer, (p ->> 'comparison_n')::integer, p ->> 'owner_person_id',
      p ->> 'evaluator_person_id', v_metrics, array(select jsonb_array_elements_text(p -> 'skill_ids')), (p ->> 'start_on')::date, (p ->> 'end_on')::date, p ->> 'status', false,
      array['FSC'], me, now(), now(), 1, (select coalesce(max(sort), 0) + 1 from kafaa_skill_pilots), true);
  end if;
  a := kafaa_audit('pilot.save', 'skill_pilots', v_id, 'ok', 'v' || v_ver || ' ' || (p ->> 'status'), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when cur.id is not null then 'Pilot saved' else 'Pilot registered' end, a, null, jsonb_build_object('id', v_id, 'version', v_ver, 'status', p ->> 'status'));
end $$;

create or replace function kafaa_signoff_pilot(p_id text, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_ent text := nullif(coalesce(p_id, ''), ''); cur kafaa_skill_pilots; v_keys text[]; v_pr text; v_metrics jsonb; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('pilot.signoff', 'skill_pilots', v_ent, 'not_signed_in', 'Sign in to see skills pilots'); end if;
  v_role := kafaa_acting_role('own_profile', array['Own']);
  select * into cur from kafaa_skill_pilots where id = p_id;
  if cur.id is null then return kafaa_refuse('pilot.signoff', 'skill_pilots', v_ent, 'not_found', 'Pilot not found', v_role); end if;
  if cur.evaluator_person_id <> me then return kafaa_refuse('pilot.signoff', 'skill_pilots', v_ent, 'not_evaluator', 'Only the named evaluator signs off this pilot', v_role); end if;
  if cur.status <> 'running' then return kafaa_refuse('pilot.signoff', 'skill_pilots', v_ent, 'not_running', 'Only a running pilot is signed off', v_role); end if;
  select coalesce(array_agg(m ->> 'key' order by i), '{}'::text[]) into v_keys from jsonb_array_elements(cur.metrics) with ordinality x(m, i);
  v_pr := kafaa_spl_signoff_problem(p, v_keys);
  if v_pr is not null then
    return kafaa_refuse('pilot.signoff', 'skill_pilots', v_ent, 'invalid', 'Check the sign-off: ' || case v_pr
      when 'result' then 'choose success, mixed or failed'
      when 'recommendation' then 'recommend adopted, expanded, further funded or not adopted (a failed pilot is not adopted or is funded for a redesign)'
      when 'summary' then 'a result summary of 20 to 1200 characters in English and in Arabic'
      when 'lessons' then 'lessons of 10 to 1200 characters in English and in Arabic'
      else 'a measured pilot value (and an optional comparison value) for every metric' end, v_role);
  end if;
  select jsonb_agg(m || jsonb_build_object('pilot', r -> 'pilot', 'comparison', coalesce(r -> 'comparison', 'null'::jsonb)) order by i) into v_metrics
    from jsonb_array_elements(cur.metrics) with ordinality x(m, i)
    join lateral (select e as r from jsonb_array_elements(p -> 'metric_results') e where e ->> 'key' = m ->> 'key' limit 1) y on true;
  update kafaa_skill_pilots set status = 'evaluating', result = p ->> 'result', recommendation = p ->> 'recommendation', result_en = btrim(p ->> 'result_en', E' \t\n\r'),
    result_ar = btrim(p ->> 'result_ar', E' \t\n\r'), lessons_en = btrim(p ->> 'lessons_en', E' \t\n\r'), lessons_ar = btrim(p ->> 'lessons_ar', E' \t\n\r'), metrics = v_metrics,
    signoff_by = me, signoff_at = now(), updated_by = me, updated_at = now(), version = cur.version + 1 where id = p_id;
  l := kafaa_ledger('kafaa.workforce.pilot_signoff', 'Skills pilot signed off by the evaluator: ' || p_id || ' ' || (p ->> 'result'));
  a := kafaa_audit('pilot.signoff', 'skill_pilots', p_id, 'ok', (p ->> 'result') || ' recommends ' || (p ->> 'recommendation'), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Evaluation signed off', a, l, jsonb_build_object('id', p_id, 'status', 'evaluating'));
end $$;

create or replace function kafaa_close_pilot(p_id text, p_adoption text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_ent text := nullif(coalesce(p_id, ''), ''); cur kafaa_skill_pilots; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('pilot.close', 'skill_pilots', v_ent, 'not_signed_in', 'Sign in to see skills pilots'); end if;
  if not kafaa_has_grant('workforce_strategy', array['W', 'A']) then return kafaa_refuse('pilot.close', 'skill_pilots', v_ent, 'forbidden', 'Only HR analysts and the HR director register or close pilots'); end if;
  v_role := kafaa_acting_role('workforce_strategy', array['W', 'A']);
  select * into cur from kafaa_skill_pilots where id = p_id;
  if cur.id is null then return kafaa_refuse('pilot.close', 'skill_pilots', v_ent, 'not_found', 'Pilot not found', v_role); end if;
  if cur.status = 'closed' then return kafaa_refuse('pilot.close', 'skill_pilots', v_ent, 'closed', 'This pilot is already closed', v_role); end if;
  if cur.status <> 'evaluating' or cur.signoff_by is null or cur.signoff_by <> cur.evaluator_person_id then
    return kafaa_refuse('pilot.close', 'skill_pilots', v_ent, 'no_signoff', 'A pilot cannot close without the evaluator''s sign-off', v_role); end if;
  if cur.evaluator_person_id = me then return kafaa_refuse('pilot.close', 'skill_pilots', v_ent, 'maker_checker', 'The evaluator cannot close their own evaluation', v_role); end if;
  if kafaa_spl_close_problem(p_adoption, cur.result) is not null then
    return kafaa_refuse('pilot.close', 'skill_pilots', v_ent, 'invalid', 'Choose an adoption decision that fits the result (a failed pilot is not adopted or is funded for a redesign)', v_role); end if;
  update kafaa_skill_pilots set status = 'closed', adoption = p_adoption, published = true, closed_by = me, closed_at = now(), updated_by = me, updated_at = now(), version = cur.version + 1
    where id = p_id;
  l := kafaa_ledger('kafaa.workforce.pilot_close', 'Skills pilot closed: ' || p_id || ' ' || cur.result || ', ' || p_adoption);
  a := kafaa_audit('pilot.close', 'skill_pilots', p_id, 'ok', cur.result || ' ' || p_adoption, case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Pilot closed and published', a, l, jsonb_build_object('id', p_id, 'adoption', p_adoption, 'rate', kafaa_spl_adoption() -> 'rate'));
end $$;

-- ───────────── Grants: internal helpers are not executable by API roles; the seven RPCs only by signed-in users.
revoke all on function kafaa_hcd_bounds(text), kafaa_hcd_computable(text, date), kafaa_hcd_closed(text, date), kafaa_hcd_minutes(jsonb), kafaa_hcd_len(jsonb),
  kafaa_hcd_bi(jsonb, jsonb, integer, integer), kafaa_hcd_line_problem(jsonb, text[]), kafaa_hcd_materiality_ok(text, text), kafaa_hcd_compute(text), kafaa_spl_num(jsonb),
  kafaa_spl_date_ok(jsonb), kafaa_spl_group_ok(jsonb), kafaa_spl_problem(jsonb, text, boolean), kafaa_spl_signoff_problem(jsonb, text[]), kafaa_spl_close_problem(text, text),
  kafaa_spl_adoption(), kafaa_spl_reference() from public, anon, authenticated;
revoke all on function kafaa_compute_disclosure(text), kafaa_save_disclosure(jsonb), kafaa_approve_disclosure(text, jsonb), kafaa_pilot_stats(), kafaa_save_pilot(jsonb),
  kafaa_signoff_pilot(text, jsonb), kafaa_close_pilot(text, text) from public, anon;
grant execute on function kafaa_compute_disclosure(text), kafaa_save_disclosure(jsonb), kafaa_approve_disclosure(text, jsonb), kafaa_pilot_stats(), kafaa_save_pilot(jsonb),
  kafaa_signoff_pilot(text, jsonb), kafaa_close_pilot(text, text) to authenticated;
