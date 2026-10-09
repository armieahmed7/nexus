-- [W5 · E3 · F34] Kafa'a Student-to-career journey (existing module M06): the 10-question interest explorer (public, deterministic,
-- non-scoring), the journey-board facts (each with a public source and an as-of date), the saved student journey (own rows only)
-- and the starter portfolio (synthetic Mustaqbali starter credential), plus three RPCs:
--   kafaa_save_student_journey      own row; families recomputed from the answers on the server; audited, no ledger
--   kafaa_journey_aggregate         HR aggregate (applications Agg/A/R); every cell under 10 (zero included) is null
--   kafaa_issue_starter_credentials HR director (applications A); portfolio rows + notices; audited with a ledger row
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file, RLS in the per-statement form.
-- Rules: src/modules/m06/journey.ts (LocalBackend mirror: src/modules/m06/backend/local.ts). PGlite checks:
-- scripts/validate/w5e3-journey.mjs (SQL = TS for every seeded journey, the aggregate and every refusal).

-- ───────────── Tables (generated DDL)
-- M06 · Student journey interest explorer: 10 questions mapping answers to job families (public, non-scoring) (F34)
create table if not exists kafaa_journey_questions (
  id text primary key,
  sort integer not null,
  prompt_en text not null,
  prompt_ar text not null,
  hint_en text not null default '',
  hint_ar text not null default '',
  options jsonb not null default '[]'::jsonb
);
comment on table kafaa_journey_questions is '[M06] Student journey interest explorer: 10 questions mapping answers to job families (public, non-scoring) (F34)';

-- M06 · Student journey board facts, each with a public source and an as-of date (F34)
create table if not exists kafaa_journey_facts (
  id text primary key,
  step text not null check (step in ('explore', 'mustaqbali', 'route', 'first_role')),
  programme_id text,
  role_id text,
  text_en text not null,
  text_ar text not null,
  source_id text not null,
  as_of date not null,
  precision text not null default 'day' check (precision in ('day', 'month', 'year')),
  sort integer not null default 0
);
comment on table kafaa_journey_facts is '[M06] Student journey board facts, each with a public source and an as-of date (F34)';

-- M06 · Saved student journey: interests, stage, route and readiness checklist (own rows only; HR aggregate >= 10) (F34)
create table if not exists kafaa_student_journeys (
  id text primary key,
  person_id text not null unique,
  stage text check (stage in ('school', 'finishing_school', 'university', 'graduate')),
  route text,
  interests jsonb not null default '{}'::jsonb,
  milestones jsonb not null default '{}'::jsonb,
  saved_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cleared_at timestamptz,
  open_read boolean not null default false
);
comment on table kafaa_student_journeys is '[M06] Saved student journey: interests, stage, route and readiness checklist (own rows only; HR aggregate >= 10) (F34)';

-- M06 · Student starter portfolio: synthetic Mustaqbali starter credential and experiences (own rows only; not a FANR certification) (F34)
create table if not exists kafaa_student_portfolio (
  id text primary key,
  person_id text not null,
  kind text not null check (kind in ('microcred', 'experience', 'practice', 'event')),
  title_en text not null,
  title_ar text not null,
  issuer_en text not null default '',
  issuer_ar text not null default '',
  programme_id text,
  microcred_def_id text,
  status text not null default 'issued' check (status in ('issued', 'in_progress')),
  issued_on date,
  evidence_en text not null default '',
  evidence_ar text not null default '',
  sample boolean not null default true,
  open_read boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table kafaa_student_portfolio is '[M06] Student starter portfolio: synthetic Mustaqbali starter credential and experiences (own rows only; not a FANR certification) (F34)';

do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_journey_facts_programme_id_fk') then alter table kafaa_journey_facts add constraint kafaa_journey_facts_programme_id_fk foreign key (programme_id) references kafaa_talent_programmes(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_journey_facts_role_id_fk') then alter table kafaa_journey_facts add constraint kafaa_journey_facts_role_id_fk foreign key (role_id) references kafaa_job_roles(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_journey_facts_source_id_fk') then alter table kafaa_journey_facts add constraint kafaa_journey_facts_source_id_fk foreign key (source_id) references kafaa_sources(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_student_journeys_person_id_fk') then alter table kafaa_student_journeys add constraint kafaa_student_journeys_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_student_journeys_route_fk') then alter table kafaa_student_journeys add constraint kafaa_student_journeys_route_fk foreign key (route) references kafaa_talent_programmes(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_student_portfolio_person_id_fk') then alter table kafaa_student_portfolio add constraint kafaa_student_portfolio_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_student_portfolio_programme_id_fk') then alter table kafaa_student_portfolio add constraint kafaa_student_portfolio_programme_id_fk foreign key (programme_id) references kafaa_talent_programmes(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_journey_facts_step_idx on kafaa_journey_facts (step);
create index if not exists kafaa_journey_facts_programme_id_idx on kafaa_journey_facts (programme_id);
create index if not exists kafaa_journey_facts_role_id_idx on kafaa_journey_facts (role_id);
create index if not exists kafaa_journey_facts_source_id_idx on kafaa_journey_facts (source_id);
create index if not exists kafaa_student_journeys_route_idx on kafaa_student_journeys (route);
create index if not exists kafaa_student_portfolio_person_id_idx on kafaa_student_portfolio (person_id);
create index if not exists kafaa_student_portfolio_programme_id_idx on kafaa_student_portfolio (programme_id);
-- open_read is always false: it keeps the applications R/A grants (HR director, auditor) from reading individual journeys.
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_student_journeys_closed_ck') then
  alter table kafaa_student_journeys add constraint kafaa_student_journeys_closed_ck check (open_read = false and (route is null or route in ('dnt', 'energy-pioneers', 'gdp', 'gpo'))); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_student_portfolio_closed_ck') then
  alter table kafaa_student_portfolio add constraint kafaa_student_portfolio_closed_ck check (open_read = false); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_journey_facts_dated_ck') then
  alter table kafaa_journey_facts add constraint kafaa_journey_facts_dated_ck check (as_of between date '2000-01-01' and date '2100-01-01'); end if; end $$;

-- ───────────── RLS: public reference data; own journeys and portfolio only (no staff, HR or auditor row reads)
alter table kafaa_journey_questions enable row level security;
alter table kafaa_journey_facts enable row level security;
alter table kafaa_student_journeys enable row level security;
alter table kafaa_student_portfolio enable row level security;
do $$ declare t text; begin
  foreach t in array array['kafaa_journey_questions', 'kafaa_journey_facts', 'kafaa_student_journeys', 'kafaa_student_portfolio'] loop
    if not exists (select 1 from pg_policies where tablename = t and policyname = 'kafaa_read') then
      execute format('create policy kafaa_read on %I for select to anon, authenticated using (false)', t);
    end if;
  end loop;
end $$;
alter policy kafaa_read on kafaa_journey_questions using ((SELECT kafaa_has_grant('talent_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text])));
alter policy kafaa_read on kafaa_journey_facts using ((SELECT kafaa_has_grant('talent_content'::text, ARRAY['R'::text, 'W'::text, 'A'::text])));
alter policy kafaa_read on kafaa_student_journeys using (((COALESCE(open_read, false) AND (SELECT kafaa_has_grant('applications'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('applications'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('applications'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('applications'::text, person_id, NULL::text, false)));
alter policy kafaa_read on kafaa_student_portfolio using (((COALESCE(open_read, false) AND (SELECT kafaa_has_grant('applications'::text, ARRAY['R'::text, 'W'::text, 'A'::text])))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('applications'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('applications'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('applications'::text, person_id, NULL::text, false)));
grant select on kafaa_journey_questions, kafaa_journey_facts, kafaa_student_journeys, kafaa_student_portfolio to anon, authenticated;
revoke insert, update on kafaa_journey_questions, kafaa_journey_facts, kafaa_student_journeys, kafaa_student_portfolio from anon, authenticated;

-- ───────────── Internal helpers (mirror of src/modules/m06/journey.ts)
-- exploreInterests: one hit per family named by each chosen option; order hits desc, job_families.sort, id; keep the first
-- (with a hit) and the next two with two or more hits. Route: the first answered option (question order) naming one.
create or replace function kafaa_sj_explore(p_answers jsonb) returns jsonb language sql stable security definer set search_path = public as $$
  with a as (select case when jsonb_typeof(p_answers) = 'object' then p_answers else '{}'::jsonb end as v),
  picked as (
    select q.id as qid, q.sort, o.value as opt
    from kafaa_journey_questions q cross join a
    cross join lateral jsonb_array_elements(case when jsonb_typeof(q.options) = 'array' then q.options else '[]'::jsonb end) o(value)
    where (o.value->>'id') = (a.v->>q.id)
  ), f as (
    select distinct p.qid, x.fam from picked p cross join lateral jsonb_array_elements_text(case when jsonb_typeof(p.opt->'families') = 'array' then p.opt->'families' else '[]'::jsonb end) x(fam)
  ), t as (select f.fam, count(*)::int as hits from f group by f.fam),
  r as (
    select t.fam, t.hits, (row_number() over (order by t.hits desc, coalesce(jf.sort, 999), t.fam collate "C") - 1)::int as i
    from t left join kafaa_job_families jf on jf.id = t.fam
  )
  select jsonb_build_object(
    'families', coalesce((select jsonb_agg(r.fam order by r.i) from r where r.i < 3 and (r.hits >= 2 or r.i = 0)), '[]'::jsonb),
    'route', (select p.opt->>'route' from picked p where coalesce(p.opt->>'route', '') <> '' order by p.sort, p.qid collate "C" limit 1),
    'answered', (select count(*)::int from picked))
$$;

-- validateJourneyInput: null, or the user-facing refusal message (order-independent, same as TS).
create or replace function kafaa_sj_validate(p jsonb) returns text language plpgsql stable security definer set search_path = public as $$
declare v_ans jsonb; v_chk jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return 'Nothing to save'; end if;
  if p->'clear' = 'true'::jsonb then return null; end if;
  if (p->>'stage') is not null and (p->>'stage') not in ('school', 'finishing_school', 'university', 'graduate') then return 'Unknown stage'; end if;
  if (p->>'route') is not null and (p->>'route') not in ('dnt', 'energy-pioneers', 'gdp', 'gpo') then return 'Unknown route'; end if;
  v_ans := p->'answers';
  if v_ans is not null and jsonb_typeof(v_ans) <> 'null' then
    if jsonb_typeof(v_ans) <> 'object' then return 'Answers must be an object of question and option ids'; end if;
    if exists (select 1 from jsonb_object_keys(v_ans) k where not exists (select 1 from kafaa_journey_questions q where q.id = k)) then return 'Unknown question'; end if;
    if exists (select 1 from jsonb_each(v_ans) e where jsonb_typeof(e.value) <> 'string' or not exists (
      select 1 from kafaa_journey_questions q cross join lateral jsonb_array_elements(q.options) o(value) where q.id = e.key and (o.value->>'id') = (e.value #>> '{}'))) then
      return 'Unknown answer';
    end if;
  end if;
  v_chk := p->'checklist';
  if v_chk is not null and jsonb_typeof(v_chk) <> 'null' then
    if jsonb_typeof(v_chk) <> 'object' then return 'The checklist must be an object'; end if;
    if (select count(*) from jsonb_object_keys(v_chk)) > 40 then return 'At most 40 checklist items'; end if;
    if exists (select 1 from jsonb_object_keys(v_chk) k where k !~ '^[a-z0-9:_-]{1,40}$') then return 'Unknown checklist item'; end if;
    if exists (select 1 from jsonb_each(v_chk) e where jsonb_typeof(e.value) <> 'string' or (e.value #>> '{}') not in ('done', 'yes', 'no', 'unsure')) then return 'Unknown checklist value'; end if;
  end if;
  return null;
end $$;

create or replace function kafaa_sj_cell(p_n integer, p_min integer) returns jsonb language sql immutable set search_path = public as $$
  select case when p_n < p_min then jsonb_build_object('n', null, 'suppressed', true) else jsonb_build_object('n', p_n, 'suppressed', false) end
$$;

-- computeJourneyAggregate (counts of distinct people; cells under p_min null). pending_credentials only when p_act.
create or replace function kafaa_sj_aggregate(p_min integer, p_act boolean) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare d jsonb;
begin
  with live as (
    select j.person_id, j.stage, j.route, case when jsonb_typeof(j.interests->'families') = 'array' then j.interests->'families' else '[]'::jsonb end as fams
    from kafaa_student_journeys j
    where j.cleared_at is null
      and (j.stage is not null or j.route is not null or jsonb_array_length(case when jsonb_typeof(j.interests->'families') = 'array' then j.interests->'families' else '[]'::jsonb end) > 0)
  ), fam_list as (
    select x.fam, coalesce(jf.sort, 999) as s
    from (select distinct f.fam from kafaa_journey_questions q cross join lateral jsonb_array_elements(q.options) o(value)
          cross join lateral jsonb_array_elements_text(case when jsonb_typeof(o.value->'families') = 'array' then o.value->'families' else '[]'::jsonb end) f(fam)) x
    left join kafaa_job_families jf on jf.id = x.fam
  )
  select jsonb_build_object(
    'total', kafaa_sj_cell((select count(distinct person_id)::int from live), p_min),
    'routed', kafaa_sj_cell((select count(distinct person_id)::int from live where route is not null), p_min),
    'applied', kafaa_sj_cell((select count(distinct l.person_id)::int from live l where l.route is not null and exists (
       select 1 from kafaa_applications a where a.person_id = l.person_id and a.programme_id = l.route and a.stage <> 'withdrawn')), p_min),
    'credentials', kafaa_sj_cell((select count(distinct s.person_id)::int from kafaa_student_portfolio s where s.kind = 'microcred' and s.status = 'issued'), p_min),
    'by_stage', (select jsonb_agg(jsonb_build_object('key', k) || kafaa_sj_cell((select count(distinct person_id)::int from live where stage = k), p_min) order by o)
                 from unnest(array['school', 'finishing_school', 'university', 'graduate']) with ordinality u(k, o)),
    'by_route', (select jsonb_agg(jsonb_build_object('key', k) || kafaa_sj_cell((select count(distinct person_id)::int from live where (k = 'undecided' and route is null) or route = k), p_min) order by o)
                 from unnest(array['dnt', 'energy-pioneers', 'gdp', 'gpo', 'undecided']) with ordinality u(k, o)),
    'by_family', coalesce((select jsonb_agg(jsonb_build_object('key', fl.fam) || kafaa_sj_cell((select count(distinct person_id)::int from live where fams ? fl.fam), p_min) order by fl.s, fl.fam collate "C")
                 from fam_list fl), '[]'::jsonb),
    'pending_credentials', case when p_act then (select count(*)::int from (select distinct a.person_id from kafaa_applications a where a.programme_id = 'mustaqbali' and a.stage = 'accepted'
                 and not exists (select 1 from kafaa_student_portfolio s where s.id = 'spf-' || a.person_id || '-mustaqbali')) z) else null end
  ) into d;
  return d;
end $$;

-- ───────────── RPC: save or clear my journey (own row; applications Own). Audited, no ledger.
create or replace function kafaa_save_student_journey(p_input jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_id text; v_err text; v_ex jsonb; a kafaa_audit_events; v_stage text; v_route text; v_chk jsonb; v_int jsonb; v_mil jsonb;
begin
  if me is null then return kafaa_refuse('journey.save', 'student_journeys', null, 'not_signed_in', 'Sign in to save your journey; the explorer works without saving'); end if;
  v_id := 'sj-' || me;
  v_role := kafaa_acting_role('applications', array['Own']);
  if v_role is null then return kafaa_refuse('journey.save', 'student_journeys', v_id, 'forbidden', 'Saving a journey is for students and applicants with a Kafa''a account'); end if;
  v_err := kafaa_sj_validate(p_input);
  if v_err is not null then return kafaa_refuse('journey.save', 'student_journeys', v_id, 'invalid', v_err, v_role); end if;
  if p_input->'clear' = 'true'::jsonb then
    insert into kafaa_student_journeys (id, person_id, stage, route, interests, milestones, saved_at, updated_at, cleared_at, open_read)
    values (v_id, me, null, null, '{}'::jsonb, '{}'::jsonb, now(), now(), now(), false)
    on conflict (id) do update set stage = null, route = null, interests = '{}'::jsonb, milestones = '{}'::jsonb, updated_at = now(), cleared_at = now();
    a := kafaa_audit('journey.clear', 'student_journeys', v_id, 'ok', 'cleared', 'not_applicable', null, v_role);
    return kafaa_result(true, 'ok', 'Your saved journey was cleared', a, null, jsonb_build_object('id', v_id, 'families', '[]'::jsonb, 'route', null, 'cleared', true));
  end if;
  v_stage := p_input->>'stage';
  v_route := p_input->>'route';
  v_ex := kafaa_sj_explore(case when jsonb_typeof(p_input->'answers') = 'object' then p_input->'answers' else '{}'::jsonb end);
  v_chk := case when jsonb_typeof(p_input->'checklist') = 'object' then p_input->'checklist' else '{}'::jsonb end;
  v_int := jsonb_build_object('answers', case when jsonb_typeof(p_input->'answers') = 'object' then p_input->'answers' else '{}'::jsonb end,
                              'families', v_ex->'families', 'explorer_route', v_ex->'route');
  v_mil := jsonb_build_object('checklist', v_chk);
  insert into kafaa_student_journeys (id, person_id, stage, route, interests, milestones, saved_at, updated_at, cleared_at, open_read)
  values (v_id, me, v_stage, v_route, v_int, v_mil, now(), now(), null, false)
  on conflict (id) do update set stage = excluded.stage, route = excluded.route, interests = excluded.interests, milestones = excluded.milestones, updated_at = now(), cleared_at = null;
  a := kafaa_audit('journey.save', 'student_journeys', v_id, 'ok',
    format('stage %s, route %s, %s families, %s checklist items', coalesce(v_stage, '-'), coalesce(v_route, '-'), jsonb_array_length(v_ex->'families'), (select count(*) from jsonb_object_keys(v_chk))),
    'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Journey saved. Only you can see it.', a, null, jsonb_build_object('id', v_id, 'families', v_ex->'families', 'route', v_route, 'cleared', false));
end $$;

-- ───────────── RPC: HR journey insights (aggregate only, suppressed). Refusals audited; reads are not.
create or replace function kafaa_journey_aggregate() returns jsonb language plpgsql security definer set search_path = public as $$
declare v_role text;
begin
  if kafaa_me() is null then return kafaa_refuse('journey.aggregate', 'student_journeys', null, 'not_signed_in', 'Sign in to see journey insights'); end if;
  v_role := kafaa_acting_role('applications', array['Agg', 'A', 'R']);
  if v_role is null then return kafaa_refuse('journey.aggregate', 'student_journeys', null, 'forbidden', 'Journey insights are aggregate-only and for HR'); end if;
  return jsonb_build_object('ok', true, 'code', 'ok', 'message', 'Journey insights',
    'data', kafaa_sj_aggregate((kafaa_rules()->>'minGroupSize')::int, kafaa_has_grant('applications', array['A'])));
end $$;

-- ───────────── RPC: issue the synthetic Mustaqbali starter credential to accepted participants (HR director). Ledger row.
create or replace function kafaa_issue_starter_credentials() returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_people text[]; v_n integer; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('journey.starter_credentials', 'student_portfolio', null, 'not_signed_in', 'Sign in to issue starter credentials'); end if;
  v_role := kafaa_acting_role('applications', array['A']);
  if v_role is null then return kafaa_refuse('journey.starter_credentials', 'student_portfolio', null, 'forbidden', 'Only the HR director issues Mustaqbali starter credentials'); end if;
  select array_agg(z.pid order by z.pid collate "C") into v_people from (
    select distinct x.person_id as pid from kafaa_applications x
    where x.programme_id = 'mustaqbali' and x.stage = 'accepted'
      and not exists (select 1 from kafaa_student_portfolio s where s.id = 'spf-' || x.person_id || '-mustaqbali')) z;
  v_n := coalesce(cardinality(v_people), 0);
  if v_n = 0 then return kafaa_refuse('journey.starter_credentials', 'student_portfolio', null, 'not_found', 'No accepted Mustaqbali participant is waiting for a starter credential', v_role); end if;
  perform set_config('kafaa.seeding', 'on', true); -- row-audit triggers stay quiet inside the RPC; one audit row below
  insert into kafaa_student_portfolio (id, person_id, kind, title_en, title_ar, issuer_en, issuer_ar, programme_id, microcred_def_id, status, issued_on, evidence_en, evidence_ar, sample, open_read, created_at)
  select 'spf-' || p || '-mustaqbali', p, 'microcred', 'Mustaqbali starter credential', 'شهادة البداية من برنامج مستقبلي',
         'Kafa''a talent pipeline (synthetic record)', 'مسار المواهب في كفاءة (سجل تجريبي)', 'mustaqbali', 'mc-student-mustaqbali', 'issued', current_date,
         'Took part in the two-week Mustaqbali STEM experience (accepted participant).', 'شارك في تجربة مستقبلي للعلوم والتكنولوجيا لمدة أسبوعين (مشارك مقبول).', true, false, now()
  from unnest(v_people) p
  on conflict (id) do nothing;
  insert into kafaa_notifications (id, person_id, kind, title_en, title_ar, link, severity)
  select 'nt-spf-' || p || '-mustaqbali', p, 'journey', 'Your Mustaqbali starter credential is in your portfolio', 'شهادة البداية من برنامج مستقبلي في ملفك الآن', '/pathways/journey#portfolio', 'ok'
  from unnest(v_people) p where exists (select 1 from kafaa_people pp where pp.id = p)
  on conflict (id) do nothing;
  perform set_config('kafaa.seeding', 'off', true);
  l := kafaa_ledger('kafaa.student.starter_credentials', format('Issued %s Mustaqbali starter credentials (synthetic)', v_n));
  a := kafaa_audit('journey.starter_credentials', 'student_portfolio', null, 'ok', 'issued ' || v_n, case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', format('Issued %s starter credentials', v_n), a, l, jsonb_build_object('issued', v_n));
end $$;

-- ───────────── Grants: internal helpers are not callable by API roles; the three RPCs by signed-in users only.
revoke all on function kafaa_sj_explore(jsonb), kafaa_sj_validate(jsonb), kafaa_sj_cell(integer, integer), kafaa_sj_aggregate(integer, boolean) from public, anon, authenticated;
revoke all on function kafaa_save_student_journey(jsonb), kafaa_journey_aggregate(), kafaa_issue_starter_credentials() from public, anon;
grant execute on function kafaa_save_student_journey(jsonb), kafaa_journey_aggregate(), kafaa_issue_starter_credentials() to authenticated;
