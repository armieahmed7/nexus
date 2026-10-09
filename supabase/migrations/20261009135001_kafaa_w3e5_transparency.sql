-- [W3 · E5 · F24] Recommendation transparency, opt-out and fairness monitor (module M16 additions).
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file, RLS in the per-statement form
-- (like 20261008140000_kafaa_rls_perf.sql), the fairness compute (mirror of src/modules/m16/fairness.ts), the RPCs
-- kafaa_set_reco_optout, kafaa_run_fairness_snapshot, kafaa_change_engine_weights, kafaa_optout_stats, and a redefinition of
-- the wave-0 kafaa_set_engine_weights (same signature, checks and messages) so every engine change is logged and ledgered.
-- LocalBackend mirror: src/modules/m16/backend/local.ts. PGlite checks: scripts/validate/w3e5-transparency.mjs.

-- ───────────── Tables (generated DDL)
-- M16 · Model and engine card per recommendation surface: inputs used and never used, weights, owner, oversight, last change (F24)
create table if not exists kafaa_engine_cards (
  id text primary key,
  engine_surface text not null check (engine_surface in ('skills', 'recommend', 'match', 'search')),
  module text not null,
  route text not null,
  feature text not null,
  title_en text not null,
  title_ar text not null,
  purpose_en text not null,
  purpose_ar text not null,
  owner_en text not null,
  owner_ar text not null,
  inputs_used jsonb not null default '[]'::jsonb,
  inputs_excluded text[] not null default '{}'::text[],
  scoring_functions text[] not null default '{}'::text[],
  weight_keys text[] not null default '{}'::text[],
  output_en text not null,
  output_ar text not null,
  oversight_en text not null,
  oversight_ar text not null,
  limitations_en text not null,
  limitations_ar text not null,
  opt_out boolean not null default false,
  version integer not null default 1,
  last_changed_at timestamptz not null default now(),
  last_change_id text,
  sources jsonb not null default '[]'::jsonb,
  sort integer not null default 0
);
comment on table kafaa_engine_cards is '[M16] Model and engine card per recommendation surface: inputs used and never used, weights, owner, oversight, last change (F24)';

-- M16 · Per-person, per-surface opt-out of ranked recommendations (F24; private to the person)
create table if not exists kafaa_reco_optouts (
  id text primary key,
  person_id text not null,
  surface text not null check (surface in ('navigator', 'coach', 'marketplace')),
  opted_out boolean not null default true,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table kafaa_reco_optouts is '[M16] Per-person, per-surface opt-out of ranked recommendations (F24; private to the person)';

-- M16 · Weekly fairness monitor: outcome rate per group with suppression below 10 and the four-fifths flag (F24; aggregates only)
create table if not exists kafaa_fairness_snapshots (
  id text primary key,
  period text not null,
  as_of date not null,
  surface text not null check (surface in ('navigator', 'marketplace', 'mentoring', 'talent_evidence')),
  metric text not null check (metric in ('navigator_ready', 'opportunity_selected', 'mentoring_matched', 'hipo_pool')),
  dimension text not null check (dimension in ('gender', 'nationality')),
  group_key text not null check (group_key in ('f', 'm', 'uae', 'other')),
  n integer,
  positives integer,
  rate numeric,
  ratio numeric,
  suppressed boolean not null default false,
  flagged boolean not null default false,
  source text not null,
  run_by text,
  created_at timestamptz not null default now()
);
comment on table kafaa_fairness_snapshots is '[M16] Weekly fairness monitor: outcome rate per group with suppression below 10 and the four-fifths flag (F24; aggregates only)';

-- M16 · Change log of engine settings and weights (F02 settings): before, after, rationale, audit and ledger (F24)
create table if not exists kafaa_engine_changes (
  id text primary key,
  surface text not null check (surface in ('skills', 'recommend', 'match', 'search')),
  engine_before text,
  engine_after text not null,
  weights_before jsonb not null default '{}'::jsonb,
  weights_after jsonb not null default '{}'::jsonb,
  rationale text,
  card_ids text[] not null default '{}'::text[],
  changed_by text,
  changed_by_role text,
  changed_at timestamptz not null default now(),
  audit_seq integer,
  ledger_seq integer
);
comment on table kafaa_engine_changes is '[M16] Change log of engine settings and weights (F02 settings): before, after, rationale, audit and ledger (F24)';

-- Foreign keys and indexes
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_reco_optouts_person_id_fk') then alter table kafaa_reco_optouts add constraint kafaa_reco_optouts_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_engine_cards_engine_surface_idx on kafaa_engine_cards (engine_surface);
create index if not exists kafaa_reco_optouts_person_id_idx on kafaa_reco_optouts (person_id);
create index if not exists kafaa_reco_optouts_surface_idx on kafaa_reco_optouts (surface);
create index if not exists kafaa_fairness_snapshots_period_idx on kafaa_fairness_snapshots (period);
create index if not exists kafaa_fairness_snapshots_metric_idx on kafaa_fairness_snapshots (metric);
create index if not exists kafaa_engine_changes_surface_idx on kafaa_engine_changes (surface);

-- ───────────── RLS (policies created when missing, then set to the per-statement form)
alter table kafaa_engine_cards enable row level security;
alter table kafaa_reco_optouts enable row level security;
alter table kafaa_fairness_snapshots enable row level security;
alter table kafaa_engine_changes enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_engine_cards' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_engine_cards for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_reco_optouts' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_reco_optouts for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_fairness_snapshots' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_fairness_snapshots for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_engine_changes' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_engine_changes for select to anon, authenticated using (false)'; end if;
end $$;
alter policy kafaa_read on kafaa_engine_cards using ((SELECT kafaa_has_grant('internal_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text])));
alter policy kafaa_read on kafaa_reco_optouts using (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false)));
alter policy kafaa_read on kafaa_fairness_snapshots using (((SELECT kafaa_has_grant('integrations'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR (SELECT kafaa_has_grant('skills_profile'::text, ARRAY['Agg'::text, 'R'::text, 'W'::text, 'A'::text])));
alter policy kafaa_read on kafaa_engine_changes using ((SELECT kafaa_has_grant('integrations'::text, ARRAY['R'::text, 'W'::text, 'A'::text])));
-- All four tables change only through the SECURITY DEFINER RPCs below.
revoke all on kafaa_engine_cards, kafaa_reco_optouts, kafaa_fairness_snapshots, kafaa_engine_changes from anon, authenticated;
grant select on kafaa_engine_cards, kafaa_reco_optouts, kafaa_fairness_snapshots, kafaa_engine_changes to anon, authenticated;

-- ───────────── Fairness compute (internal; mirror of src/modules/m16/fairness.ts)
-- Status of a history-tracked row at the end of a day: the last entry (array order) stamped before the cut.
create or replace function kafaa_fairness_hist_status(p_hist jsonb, p_cut timestamptz) returns text language sql stable set search_path = public as $$
  select x.e->>'status' from jsonb_array_elements(case when jsonb_typeof(p_hist) = 'array' then p_hist else '[]'::jsonb end) with ordinality x(e, i)
  where jsonb_typeof(x.e) = 'object' and jsonb_typeof(x.e->'at') = 'string' and (x.e->>'at')::timestamptz < p_cut order by x.i desc limit 1
$$;

-- Population: active staff with a job role, hired on or before the as-of date.
create or replace function kafaa_fairness_base(p_as_of date) returns setof text language sql stable security definer set search_path = public as $$
  select pe.id from kafaa_people pe where pe.kind = 'staff' and pe.status = 'active' and pe.job_role_id is not null and (pe.hire_date is null or pe.hire_date <= p_as_of)
$$;

-- Rows for one metric: per dimension (gender f/m, nationality uae/other) the group counts and rates; a comparison is suppressed
-- whole when any group has fewer than 10 people; ratio = group rate / best group rate; flagged below four-fifths (0.8).
create or replace function kafaa_fairness_rows(p_period text, p_as_of date, p_metric text, p_surface text, p_source text, p_people text[], p_pos boolean[])
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_out jsonb := '[]'::jsonb; v_dim text; v_groups text[]; g text; v_n integer[]; v_k integer[]; v_sup boolean; v_best numeric; v_rate numeric; v_ratio numeric; i integer; n1 integer; k1 integer;
begin
  foreach v_dim in array array['gender', 'nationality'] loop
    v_groups := case when v_dim = 'gender' then array['f', 'm'] else array['uae', 'other'] end;
    v_n := '{}'; v_k := '{}';
    foreach g in array v_groups loop
      select count(*)::int, (count(*) filter (where x.pos))::int into n1, k1
      from unnest(coalesce(p_people, '{}'::text[]), coalesce(p_pos, '{}'::boolean[])) x(pid, pos) join kafaa_people pe on pe.id = x.pid
      where (case when v_dim = 'gender' then pe.gender else pe.nationality_flag end) = g;
      v_n := v_n || n1; v_k := v_k || k1;
    end loop;
    v_sup := exists (select 1 from unnest(v_n) n where n < 10);
    v_best := null;
    if not v_sup then select max(k::numeric / n) into v_best from unnest(v_n, v_k) z(n, k); end if;
    for i in 1 .. array_length(v_groups, 1) loop
      v_rate := case when v_sup then null else round(v_k[i]::numeric / v_n[i], 4) end;
      v_ratio := case when v_sup or v_best is null or v_best <= 0 then null else round((v_k[i]::numeric / v_n[i]) / v_best, 4) end;
      v_out := v_out || jsonb_build_array(jsonb_build_object(
        'id', format('fs:%s:%s:%s:%s', p_period, p_metric, v_dim, v_groups[i]), 'period', p_period, 'as_of', to_char(p_as_of, 'YYYY-MM-DD'), 'surface', p_surface, 'metric', p_metric,
        'dimension', v_dim, 'group_key', v_groups[i], 'n', case when v_sup then null else v_n[i] end, 'positives', case when v_sup then null else v_k[i] end,
        'rate', v_rate, 'ratio', v_ratio, 'suppressed', v_sup, 'flagged', coalesce(v_ratio < 0.8, false), 'source', p_source));
    end loop;
  end loop;
  return v_out;
end $$;

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
      select e.to_role_id, 1 from kafaa_career_paths e where e.from_role_id = p.job_role_id
      union
      select e.to_role_id, r.steps + 1 from r join kafaa_career_paths e on e.from_role_id = r.role_id where r.steps < 2
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

-- ───────────── RPC: weekly fairness snapshot (platform admin / AI governance; audited and ledgered)
create or replace function kafaa_run_fairness_snapshot(p_as_of date default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_role text := kafaa_acting_role('integrations', array['A']); v_day date := coalesce(p_as_of, current_date); v_rows jsonb; v_period text; v_flag integer; v_sup integer;
  v_src text; l integer; a kafaa_audit_events;
begin
  if v_role is null then return kafaa_refuse('fairness.snapshot', 'fairness_snapshots', v_day::text, 'forbidden', 'Only a platform admin or AI governance lead may run the fairness snapshot'); end if;
  if v_day > current_date or v_day < current_date - 366 then return kafaa_refuse('fairness.snapshot', 'fairness_snapshots', v_day::text, 'invalid', 'Choose a date within the last year', v_role); end if;
  v_rows := kafaa_fairness_compute(v_day);
  v_period := to_char(v_day, 'IYYY-"W"IW');
  insert into kafaa_fairness_snapshots (id, period, as_of, surface, metric, dimension, group_key, n, positives, rate, ratio, suppressed, flagged, source, run_by, created_at)
  select x->>'id', x->>'period', (x->>'as_of')::date, x->>'surface', x->>'metric', x->>'dimension', x->>'group_key', (x->>'n')::integer, (x->>'positives')::integer,
         (x->>'rate')::numeric, (x->>'ratio')::numeric, (x->>'suppressed')::boolean, (x->>'flagged')::boolean, x->>'source', kafaa_me(), now()
  from jsonb_array_elements(v_rows) x
  on conflict (id) do update set period = excluded.period, as_of = excluded.as_of, surface = excluded.surface, n = excluded.n, positives = excluded.positives, rate = excluded.rate,
    ratio = excluded.ratio, suppressed = excluded.suppressed, flagged = excluded.flagged, source = excluded.source, run_by = excluded.run_by, created_at = excluded.created_at;
  select count(distinct (x->>'metric') || ':' || (x->>'dimension')) filter (where (x->>'flagged')::boolean), count(distinct (x->>'metric') || ':' || (x->>'dimension')) filter (where (x->>'suppressed')::boolean)
    into v_flag, v_sup from jsonb_array_elements(v_rows) x;
  select coalesce((select x->>'source' from jsonb_array_elements(v_rows) x where x->>'metric' = 'hipo_pool' limit 1), 'leadership_nominations') into v_src;
  l := kafaa_ledger('kafaa.ai.fairness_snapshot', format('Fairness snapshot %s (as of %s): %s comparisons below four-fifths, %s suppressed', v_period, v_day, v_flag, v_sup));
  a := kafaa_audit('fairness.snapshot', 'fairness_snapshots', v_period, 'ok', format('%s: %s rows, %s flagged, %s suppressed', v_period, jsonb_array_length(v_rows), v_flag, v_sup),
    case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Fairness snapshot saved', a, l, jsonb_build_object('period', v_period, 'as_of', to_char(v_day, 'YYYY-MM-DD'), 'rows', jsonb_array_length(v_rows),
    'flagged', v_flag, 'suppressed', v_sup, 'hipo_source', v_src));
end $$;

-- ───────────── RPC: per-surface opt-out of ranked recommendations (own; staff with a skills profile; audited and ledgered)
create or replace function kafaa_set_reco_optout(p_surface text, p_opted_out boolean, p_reason text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_id text; v_why text := btrim(coalesce(p_reason, ''), E' \t\r\n'); l integer; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('reco.optout', 'reco_optouts', p_surface, 'not_signed_in', 'Sign in to change your recommendation settings'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  if v_role is null then return kafaa_refuse('reco.optout', 'reco_optouts', p_surface, 'forbidden', 'Recommendations are for staff with a skills profile'); end if;
  if p_surface is null or p_surface not in ('navigator', 'coach', 'marketplace') or p_opted_out is null then return kafaa_refuse('reco.optout', 'reco_optouts', p_surface, 'invalid', 'Unknown recommendation surface', v_role); end if;
  if char_length(v_why) > 500 then return kafaa_refuse('reco.optout', 'reco_optouts', p_surface, 'invalid', 'Keep the reason under 500 characters', v_role); end if;
  v_id := 'ro:' || me || ':' || p_surface;
  insert into kafaa_reco_optouts (id, person_id, surface, opted_out, reason, created_at, updated_at) values (v_id, me, p_surface, p_opted_out, nullif(v_why, ''), now(), now())
  on conflict (id) do update set opted_out = excluded.opted_out, reason = excluded.reason, updated_at = now();
  l := kafaa_ledger('kafaa.ai.optout', format('%s %s recommendations', case when p_opted_out then 'Opted out of' else 'Opted back in to' end, p_surface));
  a := kafaa_audit('reco.optout', 'reco_optouts', v_id, 'ok', p_surface || ': ' || case when p_opted_out then 'opted out' else 'opted in' end, case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', case when p_opted_out then 'Ranked suggestions are off for this surface' else 'Ranked suggestions are back on for this surface' end, a, l,
    jsonb_build_object('id', v_id, 'surface', p_surface, 'opted_out', p_opted_out));
end $$;

-- ───────────── Engine settings: the shared write (internal), the new RPC with a rationale, and the redefined wave-0 RPC
create or replace function kafaa_engine_apply_change(p_surface text, p_engine text, p_weights jsonb, p_rationale text, p_role text, p_message text) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_cur kafaa_engine_settings; v_after jsonb; v_n integer; v_id text; v_cards text[]; l integer; a kafaa_audit_events;
begin
  select * into v_cur from kafaa_engine_settings where id = p_surface;
  v_after := coalesce(p_weights, v_cur.weights, '{}'::jsonb);
  insert into kafaa_engine_settings (id, surface, engine, weights, updated_by, updated_at) values (p_surface, p_surface, p_engine, v_after, kafaa_me(), now())
  on conflict (id) do update set engine = excluded.engine, weights = excluded.weights, updated_by = excluded.updated_by, updated_at = now();
  select count(*)::int into v_n from kafaa_engine_changes where surface = p_surface;
  v_id := 'ec:' || p_surface || ':' || lpad((v_n + 1)::text, 3, '0');
  select coalesce(array_agg(c.id order by c.id collate "C"), '{}') into v_cards from kafaa_engine_cards c where c.engine_surface = p_surface;
  insert into kafaa_engine_changes (id, surface, engine_before, engine_after, weights_before, weights_after, rationale, card_ids, changed_by, changed_by_role, changed_at)
  values (v_id, p_surface, v_cur.engine, p_engine, coalesce(v_cur.weights, '{}'::jsonb), v_after, p_rationale, v_cards, kafaa_me(), p_role, now());
  update kafaa_engine_cards set version = version + 1, last_changed_at = now(), last_change_id = v_id where engine_surface = p_surface;
  l := kafaa_ledger('kafaa.ai.engine_change', format('Engine settings for %s: %s -> %s; change %s', p_surface, coalesce(v_cur.engine, 'default'), p_engine, v_id));
  a := kafaa_audit('engine.settings', 'engine_settings', p_surface, 'ok', p_surface || ': ' || p_engine || coalesce(' (' || p_rationale || ')', ''), case when l is null then 'skipped' else 'written' end, l, p_role);
  update kafaa_engine_changes set audit_seq = a.seq, ledger_seq = l where id = v_id;
  return kafaa_result(true, 'ok', p_message, a, l, jsonb_build_object('change_id', v_id, 'surface', p_surface, 'engine', p_engine, 'cards', to_jsonb(v_cards)));
end $$;

create or replace function kafaa_engine_check(p_surface text, p_engine text, p_weights jsonb, p_role text) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if p_role is null then return kafaa_refuse('engine.settings', 'engine_settings', p_surface, 'forbidden', 'Only a platform admin may change engine settings'); end if;
  if p_surface is null or p_surface not in ('skills', 'recommend', 'match', 'search') then return kafaa_refuse('engine.settings', 'engine_settings', p_surface, 'invalid', 'Unknown surface', p_role); end if;
  if p_engine is null or p_engine not in ('deterministic', 'model') then return kafaa_refuse('engine.settings', 'engine_settings', p_surface, 'invalid', 'Engine must be deterministic or model', p_role); end if;
  if p_weights is not null and (jsonb_typeof(p_weights) <> 'object' or exists (
      select 1 from jsonb_each(p_weights) w where jsonb_typeof(w.value) <> 'number' or (w.value::text)::numeric < 0 or (w.value::text)::numeric > 10)) then
    return kafaa_refuse('engine.settings', 'engine_settings', p_surface, 'invalid', 'Weights must be numbers between 0 and 10', p_role);
  end if;
  return null;
end $$;

create or replace function kafaa_change_engine_weights(p_surface text, p_engine text, p_weights jsonb, p_rationale text) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_role text := kafaa_acting_role('integrations', array['A']); v_bad jsonb; v_why text := btrim(coalesce(p_rationale, ''), E' \t\r\n'); v_cur kafaa_engine_settings;
begin
  v_bad := kafaa_engine_check(p_surface, p_engine, p_weights, v_role);
  if v_bad is not null then return v_bad; end if;
  if char_length(v_why) < 10 or char_length(v_why) > 500 then return kafaa_refuse('engine.settings', 'engine_settings', p_surface, 'invalid', 'Give a rationale of 10 to 500 characters: it is shown in the change log', v_role); end if;
  select * into v_cur from kafaa_engine_settings where id = p_surface;
  if v_cur.id is not null and v_cur.engine = p_engine and (p_weights is null or v_cur.weights = p_weights) then
    return kafaa_refuse('engine.settings', 'engine_settings', p_surface, 'no_change', 'Nothing changed: the engine and weights are already set this way', v_role);
  end if;
  return kafaa_engine_apply_change(p_surface, p_engine, p_weights, v_why, v_role, 'Engine settings changed and logged');
end $$;

-- Wave-0 signature, checks and messages kept; the write now goes through the change log, the cards and the ledger.
create or replace function kafaa_set_engine_weights(p_surface text, p_engine text, p_weights jsonb default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_role text := kafaa_acting_role('integrations', array['A']); v_bad jsonb;
begin
  v_bad := kafaa_engine_check(p_surface, p_engine, p_weights, v_role);
  if v_bad is not null then return v_bad; end if;
  return kafaa_engine_apply_change(p_surface, p_engine, p_weights, null, v_role, 'Engine settings saved');
end $$;

-- ───────────── Read RPC: opt-out counts per surface (aggregate only; suppressed below 10)
create or replace function kafaa_optout_stats() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not (kafaa_has_grant('integrations', array['R', 'A']) or kafaa_has_grant('skills_profile', array['Agg', 'A'])) then
    raise exception 'Kafa''a · opt-out counts are aggregate-only and restricted' using errcode = '42501';
  end if;
  return (select jsonb_agg(jsonb_build_object('surface', s.surface, 'n', case when s.n < 10 then null else s.n end, 'suppressed', s.n < 10) order by s.ord)
    from (select u.surface, u.ord, (select count(distinct o.person_id)::int from kafaa_reco_optouts o where o.surface = u.surface and o.opted_out) n
          from unnest(array['navigator', 'coach', 'marketplace']) with ordinality u(surface, ord)) s);
end $$;

-- ───────────── Grants
revoke execute on function kafaa_fairness_hist_status(jsonb, timestamptz), kafaa_fairness_base(date), kafaa_fairness_rows(text, date, text, text, text, text[], boolean[]),
  kafaa_fairness_compute(date), kafaa_engine_apply_change(text, text, jsonb, text, text, text), kafaa_engine_check(text, text, jsonb, text) from public, anon, authenticated;
revoke execute on function kafaa_run_fairness_snapshot(date), kafaa_set_reco_optout(text, boolean, text), kafaa_change_engine_weights(text, text, jsonb, text),
  kafaa_set_engine_weights(text, text, jsonb), kafaa_optout_stats() from public, anon;
grant execute on function kafaa_run_fairness_snapshot(date), kafaa_set_reco_optout(text, boolean, text), kafaa_change_engine_weights(text, text, jsonb, text),
  kafaa_set_engine_weights(text, text, jsonb), kafaa_optout_stats() to authenticated;
