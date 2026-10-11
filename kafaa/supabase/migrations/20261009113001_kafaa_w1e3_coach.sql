-- [W1 · E3 · F07] Kafa'a Learning Coach (M19): feedback on coach suggestions and the private weekly learning goal.
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file, RLS in the per-statement
-- form (like 20261008140000_kafaa_rls_perf.sql) and the two RPCs. LocalBackend mirror: src/modules/m19/backend/local.ts
-- (+ src/modules/m19/insights.ts). PGlite checks: scripts/validate/w1e3-coach.mjs.

-- ───────────── Tables (generated DDL)
-- M19 · Learning Coach feedback per person and suggestion: saved, dismissed (hidden 90 days), enrolled (F07)
create table if not exists kafaa_coach_feedback (
  id text primary key,
  person_id text not null,
  item_kind text not null check (item_kind in ('course', 'practice', 'ojt', 'mentor', 'opportunity', 'reading', 'refresher')),
  item_id text not null,
  signal text not null check (signal in ('saved', 'dismissed', 'enrolled', 'cleared')),
  competency_ids text[] not null default '{}'::text[],
  at timestamptz not null default now(),
  hidden_until date
);
comment on table kafaa_coach_feedback is '[M19] Learning Coach feedback per person and suggestion: saved, dismissed (hidden 90 days), enrolled (F07)';

-- M19 · Weekly learning goal in hours and coach focus roles: optional and private, no streaks (F07)
create table if not exists kafaa_learning_goals (
  id text primary key,
  person_id text not null unique,
  hours_per_week numeric not null default 0,
  focus_role_ids text[] not null default '{}'::text[],
  updated_at timestamptz not null default now()
);
comment on table kafaa_learning_goals is '[M19] Weekly learning goal in hours and coach focus roles: optional and private, no streaks (F07)';

do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_coach_feedback_person_id_fk') then alter table kafaa_coach_feedback add constraint kafaa_coach_feedback_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_learning_goals_person_id_fk') then alter table kafaa_learning_goals add constraint kafaa_learning_goals_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
-- A goal is 0 to 40 hours a week (0 = no goal) and at most three focus roles.
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_learning_goals_bounds_chk') then alter table kafaa_learning_goals add constraint kafaa_learning_goals_bounds_chk check (hours_per_week >= 0 and hours_per_week <= 40 and coalesce(array_length(focus_role_ids, 1), 0) <= 3); end if; end $$;
create index if not exists kafaa_coach_feedback_person_id_idx on kafaa_coach_feedback (person_id);
create index if not exists kafaa_coach_feedback_item_kind_idx on kafaa_coach_feedback (item_kind);

-- ───────────── RLS: both tables are private to the person (own_profile Own; nobody holds R, Scope or Agg on it).
alter table kafaa_coach_feedback enable row level security;
alter table kafaa_learning_goals enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_coach_feedback' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_coach_feedback for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_learning_goals' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_learning_goals for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_learning_goals' and policyname = 'kafaa_insert') then
    execute 'create policy kafaa_insert on kafaa_learning_goals for insert to anon, authenticated with check (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_learning_goals' and policyname = 'kafaa_update') then
    execute 'create policy kafaa_update on kafaa_learning_goals for update to authenticated using (false) with check (false)'; end if;
end $$;
alter policy kafaa_read on kafaa_coach_feedback using ((((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false))));
alter policy kafaa_read on kafaa_learning_goals using ((((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false))));
alter policy kafaa_insert on kafaa_learning_goals with check (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['W'::text, 'A'::text])) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text])))));
alter policy kafaa_update on kafaa_learning_goals using (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['W'::text, 'A'::text])) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))))) with check (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['W'::text, 'A'::text])) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text])))));
grant select on kafaa_coach_feedback, kafaa_learning_goals to anon, authenticated;
grant insert, update on kafaa_learning_goals to authenticated;
-- kafaa_coach_feedback changes only through kafaa_coach_feedback() below.
revoke insert, update on kafaa_coach_feedback from anon, authenticated;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'kafaa_learning_goals_audit') then
    execute 'create trigger kafaa_learning_goals_audit after insert or update on kafaa_learning_goals for each row execute function kafaa_audit_row()'; end if;
end $$;

-- ───────────── RPC: the person's own feedback on a coach suggestion (staff: skills_profile Own). Audited, no ledger.
create or replace function kafaa_coach_feedback(p_kind text, p_item text, p_signal text, p_competency_ids text[] default '{}'::text[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_entity text := coalesce(p_kind, '') || ':' || coalesce(p_item, ''); v_id text; v_hidden date; v_comps text[]; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('coach.feedback', 'coach_feedback', v_entity, 'not_signed_in', 'Sign in to give feedback to the coach'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Own']);
  if v_role is null then return kafaa_refuse('coach.feedback', 'coach_feedback', v_entity, 'forbidden', 'The learning coach is for staff'); end if;
  if p_kind is null or p_kind not in ('course', 'practice', 'ojt', 'mentor', 'opportunity', 'reading', 'refresher')
     or p_signal is null or p_signal not in ('saved', 'dismissed', 'enrolled', 'cleared')
     or p_item is null or btrim(p_item) = '' or length(p_item) > 200 then
    return kafaa_refuse('coach.feedback', 'coach_feedback', v_entity, 'invalid', 'Unknown suggestion or feedback', v_role);
  end if;
  select coalesce(array_agg(c order by o), '{}'::text[]) into v_comps
  from (select c, o from unnest(coalesce(p_competency_ids, '{}'::text[])) with ordinality u(c, o) where c is not null and length(c) between 1 and 40 order by o limit 12) x;
  v_id := 'cf:' || me || ':' || p_kind || ':' || p_item;
  v_hidden := case when p_signal = 'dismissed' then current_date + 90 else null end;
  insert into kafaa_coach_feedback (id, person_id, item_kind, item_id, signal, competency_ids, at, hidden_until)
  values (v_id, me, p_kind, p_item, p_signal, v_comps, now(), v_hidden)
  on conflict (id) do update set signal = excluded.signal, competency_ids = excluded.competency_ids, at = excluded.at, hidden_until = excluded.hidden_until;
  a := kafaa_audit('coach.feedback', 'coach_feedback', v_id, 'ok', v_entity || ' ' || p_signal, 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Feedback saved', a, null, jsonb_build_object('id', v_id, 'signal', p_signal, 'hidden_until', v_hidden));
end $$;

-- ───────────── Aggregates: one suppressed-or-not cell (internal helper)
create or replace function kafaa_coach_cell(p_key text, p_people integer, p_saved integer, p_enrolled integer, p_dismissed integer) returns jsonb
language sql immutable set search_path = public as $$
  select case when coalesce(p_people, 0) < 10 then
    jsonb_build_object('key', p_key, 'people', null, 'saved', null, 'enrolled', null, 'dismissed', null, 'acceptance_pct', null, 'suppressed', true)
  else
    jsonb_build_object('key', p_key, 'people', p_people, 'saved', p_saved, 'enrolled', p_enrolled, 'dismissed', p_dismissed,
      'acceptance_pct', case when p_saved + p_enrolled + p_dismissed = 0 then null else round(round(1000.0 * (p_saved + p_enrolled) / (p_saved + p_enrolled + p_dismissed)) / 10, 1) end,
      'suppressed', false)
  end
$$;

-- ───────────── RPC: acceptance of coach suggestions for HR (skills_profile Agg) and the training manager (A). Counts only.
create or replace function kafaa_coach_insights() returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_total jsonb; v_kind jsonb; v_family jsonb; v_goals jsonb; v_n integer; v_median double precision;
begin
  if me is null then return kafaa_refuse('coach.insights', 'coach_feedback', null, 'not_signed_in', 'Sign in to see coach insights'); end if;
  v_role := kafaa_acting_role('skills_profile', array['Agg', 'A']);
  if v_role is null then return kafaa_refuse('coach.insights', 'coach_feedback', null, 'forbidden', 'Coach insights are for HR and the training manager (aggregates only)'); end if;
  with f as (
    select f.person_id, f.item_kind, f.signal, coalesce(p.job_family_id, 'unassigned') as fam
    from kafaa_coach_feedback f left join kafaa_people p on p.id = f.person_id where f.signal <> 'cleared'
  )
  select
    (select kafaa_coach_cell('all', count(distinct person_id)::int, (count(*) filter (where signal = 'saved'))::int, (count(*) filter (where signal = 'enrolled'))::int, (count(*) filter (where signal = 'dismissed'))::int) from f),
    (select coalesce(jsonb_agg(c order by k collate "C"), '[]'::jsonb) from (
       select item_kind as k, kafaa_coach_cell(item_kind, count(distinct person_id)::int, (count(*) filter (where signal = 'saved'))::int, (count(*) filter (where signal = 'enrolled'))::int, (count(*) filter (where signal = 'dismissed'))::int) as c
       from f group by item_kind) x),
    (select coalesce(jsonb_agg(c order by k collate "C"), '[]'::jsonb) from (
       select fam as k, kafaa_coach_cell(fam, count(distinct person_id)::int, (count(*) filter (where signal = 'saved'))::int, (count(*) filter (where signal = 'enrolled'))::int, (count(*) filter (where signal = 'dismissed'))::int) as c
       from f group by fam) y)
  into v_total, v_kind, v_family;
  select count(*)::int, percentile_cont(0.5) within group (order by hours_per_week::double precision) into v_n, v_median from kafaa_learning_goals where hours_per_week > 0;
  v_goals := case when v_n >= 10 then jsonb_build_object('people', v_n, 'median_hours', v_median, 'suppressed', false) else jsonb_build_object('people', null, 'median_hours', null, 'suppressed', true) end;
  return jsonb_build_object('ok', true, 'code', 'ok', 'message', 'Coach insights', 'audit_seq', null, 'ledger_seq', null,
    'data', jsonb_build_object('min_group', 10, 'total', v_total, 'by_kind', v_kind, 'by_family', v_family, 'goals', v_goals));
end $$;

revoke execute on function kafaa_coach_cell(text, integer, integer, integer, integer) from public, anon, authenticated;
revoke execute on function kafaa_coach_feedback(text, text, text, text[]), kafaa_coach_insights() from public, anon;
grant execute on function kafaa_coach_feedback(text, text, text, text[]), kafaa_coach_insights() to authenticated;
