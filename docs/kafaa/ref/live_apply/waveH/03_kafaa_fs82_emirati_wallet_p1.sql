-- kafaa_fs82_emirati_wallet_p1 (1/2) · from supabase/migrations/20261010282001_kafaa_fs82_emirati_wallet.sql
-- Apply with apply_migration name "kafaa_fs82_emirati_wallet_p1". Additive and idempotent; kafaa_* objects only.
-- [FS wave H · E2 · FS73 + FS74] National Alignment (M37): the Emirati pipeline by competency and the Future Skills Wallet target.
-- FS73: kafaa_pipeline_mirror (a SIMULATED, de-identified HR mirror of hires into the critical and future roles: role, nationality group
--   for reporting only, hire, leave and authorisation dates; no person id, no name; nobody reads a row directly). kafaa_ep_core =
--   emiratiPipeline() in src/modules/m37/pipeline.ts: per competency area (the job family of the role) and in total, Emirati-ready
--   successors by readiness band and ready-by date (F19 succession slates, live; concept roles never enter), progression into authorised
--   roles in the last 36 months and by year (mirror status) and retention at 12, 24 and 36 months (the mirror). Aggregate only; every
--   count under 10 is null; a share needs its count and base at 10 or above. Nationality is read only inside this aggregate and never
--   enters a score (no engine ranks anything here). Access: anyRole hr_analyst, hr_director, auditor (kafaa_ep_allowed); observers,
--   partners and managers get null. The workforce_analytics grant is NOT used because it gives observers and managers Agg.
-- FS74: kafaa_wallet_targets (the dated organisation target for the core-five wallet: a leadership setting with who set it, when and
--   its history). kafaa_fw_status = walletStatus() in src/modules/m37/wallet.ts (from evidence only: FS09 rung 2 via kafaa_ai_rung, the
--   FS31 MC-CYBER-HYGIENE award in date, the FS02 skill sk-da-01 at level 1+ with counted evidence, one FS25 core skill at level 2+ with
--   counted evidence, FS41 CleanEnergyComp L1 via kafaa_cec_level); kafaa_fw_counter_core = walletCounter() (suppressed under 10;
--   security, safeguards and cyber families never broken out); kafaa_fw_target_problem = targetProblem().
-- RPCs (TS + local + SQL SECURITY DEFINER + supabase map; authenticated only; the kafaa_ep_* / kafaa_fw_* helpers executable by nobody):
--   kafaa_emirati_pipeline(p_scope) (read, never audited), kafaa_my_future_wallet() (skills_profile Own), kafaa_future_wallet_counter()
--   (national_alignment Agg/W/A), kafaa_set_wallet_target(p) (workforce_strategy A: the HR director; versioned with history; audited;
--   ledger kafaa.national.wallet_target), kafaa_add_wallet_to_plan() (dev_plans Own; writes M04 kafaa_dev_plans / kafaa_plan_activities
--   through this SECURITY DEFINER function, logged in CONTRACT.md; never duplicates; audited, no ledger).
-- FS62 hand-off: the wallet target joins the national-alignment layer as a target table. Redefined from their newest bodies (the fs72
--   migration; the fs7qa migration does not redefine them), each with 'wallet_targets' added: kafaa_na_target, kafaa_na_link_problem,
--   kafaa_na_links, kafaa_na_measure (measure wallet_share), kafaa_na_report_core. Same signatures, same grants.
-- Read-only reuse (never redefined here): kafaa_ai_rung (FS09), kafaa_cec_level (FS41), kafaa_so_text_clean, kafaa_na_pct1, kafaa_na_sup,
--   kafaa_na_len. No recorded-evidence table is added and kafaa_skill_states_v2 / kafaa_skills_apply are untouched (nothing here writes
--   skill evidence).
-- PGlite parity and checks: scripts/validate/fs82-emirati-wallet.mjs. Tests: tests/unit/fs82-*.
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects; never removes any object or row.
-- Self-contained for the live project: the same DDL as the generated 20261008120100 schema file; RLS in the per-statement (perf) form.

-- ───────────── Tables (generated DDL, additive)

-- M37 · SIMULATED, de-identified HR mirror of hires into critical and future roles: role, nationality group (reporting only), hire, leave and authorisation dates; read only by the suppressed FS73 aggregate (FS73)
create table if not exists kafaa_pipeline_mirror (
  id text primary key,
  role_id text not null,
  nationality_flag text not null check (nationality_flag in ('uae', 'other')),
  hired_on date not null,
  left_on date,
  authorised_on date,
  source text not null default 'SIMULATED HR mirror',
  simulated boolean not null default true,
  open_read boolean not null default false
);
comment on table kafaa_pipeline_mirror is '[M37] SIMULATED, de-identified HR mirror of hires into critical and future roles: role, nationality group (reporting only), hire, leave and authorisation dates; read only by the suppressed FS73 aggregate (FS73)';

-- M37 · Dated organisation target for the core-five Future Skills Wallet: a leadership setting shown with who set it and when, with its history; a parameter, never a claim (FS74)
create table if not exists kafaa_wallet_targets (
  id text primary key,
  metric text not null check (metric in ('core_five_complete')),
  pct integer not null,
  due_on date not null,
  note_en text not null,
  note_ar text not null,
  set_by text not null,
  set_by_role text not null,
  set_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active', 'superseded')),
  version integer not null default 1,
  history jsonb not null default '[]'::jsonb,
  benchmark_ids text[] not null default '{}'::text[],
  sources jsonb not null default '[]'::jsonb
);
comment on table kafaa_wallet_targets is '[M37] Dated organisation target for the core-five Future Skills Wallet: a leadership setting shown with who set it and when, with its history; a parameter, never a claim (FS74)';

do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_pipeline_mirror_role_id_fk') then alter table kafaa_pipeline_mirror add constraint kafaa_pipeline_mirror_role_id_fk foreign key (role_id) references kafaa_job_roles(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_wallet_targets_set_by_fk') then alter table kafaa_wallet_targets add constraint kafaa_wallet_targets_set_by_fk foreign key (set_by) references kafaa_people(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_pipeline_mirror_role_id_idx on kafaa_pipeline_mirror (role_id);
create index if not exists kafaa_wallet_targets_set_by_idx on kafaa_wallet_targets (set_by);
create index if not exists kafaa_wallet_targets_status_idx on kafaa_wallet_targets (status);

-- mirror dates in order; a target value from 1 to 100 (FS73/FS74)
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_pipeline_mirror_dates_ck') then
  alter table kafaa_pipeline_mirror add constraint kafaa_pipeline_mirror_dates_ck check ((left_on is null or left_on > hired_on) and (authorised_on is null or authorised_on > hired_on)); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_wallet_targets_pct_ck') then
  alter table kafaa_wallet_targets add constraint kafaa_wallet_targets_pct_ck check (pct between 1 and 100); end if; end $$;

-- ───────────── RLS (per-statement form). The mirror: nobody reads a row (open_read is always false; only the FS73 aggregate RPC reads it).
-- The wallet target: national_alignment R/W/A (all staff, HR, admins, auditors). Writes only through the RPCs.
alter table kafaa_pipeline_mirror enable row level security;
alter table kafaa_wallet_targets enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_pipeline_mirror' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_pipeline_mirror for select to anon, authenticated using (false)'; end if;
  if not exists (select 1 from pg_policies where tablename = 'kafaa_wallet_targets' and policyname = 'kafaa_read') then
    execute 'create policy kafaa_read on kafaa_wallet_targets for select to anon, authenticated using (false)'; end if;
end $$;
alter policy kafaa_read on kafaa_pipeline_mirror using ((open_read AND (SELECT kafaa_has_grant('workforce_strategy'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))));
alter policy kafaa_read on kafaa_wallet_targets using ((SELECT kafaa_has_grant('national_alignment'::text, ARRAY['R'::text, 'W'::text, 'A'::text])));
revoke all on kafaa_pipeline_mirror, kafaa_wallet_targets from anon, authenticated;
grant select on kafaa_pipeline_mirror, kafaa_wallet_targets to anon, authenticated;

-- ═════════════ FS73 rules (mirror of src/modules/m37/pipeline.ts). Internal: not executable by API roles.
-- addMonths(): calendar months, clamped to the month end
create or replace function kafaa_ep_add_months(p date, n integer) returns date language sql immutable set search_path = public as $$
  select (p + make_interval(months => n))::date
$$;
-- pipelineAllowed(): anyRole hr_analyst, hr_director, auditor
create or replace function kafaa_ep_allowed() returns boolean language sql stable security definer set search_path = public as $$
  select kafaa_me() is not null and (kafaa_has_role('hr_analyst') or kafaa_has_role('hr_director') or kafaa_has_role('auditor'))
$$;
-- pipelineRoles(): current, non-security roles that are critical (job_roles.critical or a critical slate) or whose current FS16 outlook is growing
create or replace function kafaa_ep_roles() returns jsonb language sql stable security definer set search_path = public as $$
  with r as (
    select j.id, j.family_id, j.title_en, j.title_ar, j.regulated,
      (j.critical or exists (select 1 from kafaa_succession_slates s where s.role_id = j.id and s.critical)) as critical,
      coalesce((select l.label from kafaa_role_outlook_labels l where l.role_id = j.id and not l.archived
        order by l.year desc, l.as_of desc nulls last, l.id collate "C" desc limit 1) = 'growing', false) as future,
      exists (select 1 from kafaa_succession_slates s where s.role_id = j.id) as slate
    from kafaa_job_roles j
    where coalesce(j.lifecycle, 'current') = 'current' and not j.security_sensitive and j.family_id is not null
  )
  select coalesce(jsonb_agg(jsonb_build_object('role_id', id, 'family_id', family_id, 'title_en', title_en, 'title_ar', title_ar, 'critical', critical, 'future', future,
    'slate', slate, 'regulated', regulated) order by family_id collate "C", id collate "C"), '[]'::jsonb)
  from r where critical or future
$$;
-- one competency area (p_fam) or the total (null) of the pipeline over the roles in scope (emiratiPipeline() area())
create or replace function kafaa_ep_area(p_roles jsonb, p_fam text, p_today date) returns jsonb language sql stable security definer set search_path = public as $$
  with sc as (select x ->> 'role_id' as role_id, x ->> 'family_id' as family_id from jsonb_array_elements(p_roles) x),
  sa as (select sc.* from sc where p_fam is null or sc.family_id = p_fam),
  lp as (select s.role_id, max(s.period collate "C") as period from kafaa_succession_slates s join sc on sc.role_id = s.role_id group by s.role_id),
  sl as (select s.id, s.role_id from kafaa_succession_slates s join lp on lp.role_id = s.role_id and lp.period = s.period),
  pr as (
    select x.person_id, sl.role_id, (p.nationality_flag = 'uae') as uae,
      case coalesce(x.readiness, x.computed_readiness) when 'ready_now' then 0 when '1_2y' then 1 else 2 end as rk,
      case when coalesce(x.readiness, x.computed_readiness) = 'ready_now' then p_today
        else kafaa_ep_add_months(coalesce((x.proposed_at at time zone 'UTC')::date, p_today),
          case when x.months is null then (case coalesce(x.readiness, x.computed_readiness) when '1_2y' then 24 else 60 end) else greatest(0, x.months) end) end as ready_by
    from kafaa_successors x join sl on sl.id = x.slate_id join sa on sa.role_id = sl.role_id join kafaa_people p on p.id = x.person_id
    where x.status in ('proposed', 'confirmed') and x.cover_source = 'internal' and x.person_id is not null and p.kind = 'staff' and p.status = 'active'
      and coalesce(x.readiness, x.computed_readiness) in ('ready_now', '1_2y', '3_5y')
  ),
  best as (select person_id, bool_or(uae) as uae, min(rk) as rk, min(ready_by) as ready_by from pr group by person_id),
  hz as (select distinct d from unnest(array[make_date(extract(year from p_today)::integer, 12, 31), make_date(extract(year from p_today)::integer + 1, 12, 31),
    make_date(extract(year from p_today)::integer + 2, 12, 31), make_date(greatest(2030, extract(year from p_today)::integer), 12, 31)]) d),
  sp as (select m.* from kafaa_pipeline_mirror m join sa on sa.role_id = m.role_id)
  select jsonb_build_object(
    'family_id', p_fam,
    'roles', (select count(*) from sa)::integer,
    'slates', (select count(*) from sa where exists (select 1 from lp where lp.role_id = sa.role_id))::integer,
    'successors', (select jsonb_build_object('emirati', kafaa_na_sup(q.e), 'all', kafaa_na_sup(q.a), 'share_pct', case when q.e >= 10 and q.a >= 10 then kafaa_na_pct1(q.e, q.a) end,
        'bands', jsonb_build_object('ready_now', kafaa_na_sup(q.b0), '1_2y', kafaa_na_sup(q.b1), '3_5y', kafaa_na_sup(q.b2)))
      from (select count(*) filter (where uae)::integer as e, count(*)::integer as a, count(*) filter (where uae and rk = 0)::integer as b0,
        count(*) filter (where uae and rk = 1)::integer as b1, count(*) filter (where uae and rk = 2)::integer as b2 from best) q),
    'ready_by', (select coalesce(jsonb_agg(jsonb_build_object('date', to_char(q.d, 'YYYY-MM-DD'), 'n', kafaa_na_sup(q.n), 'roles', case when q.n >= 10 then q.r end) order by q.d), '[]'::jsonb)
      from (select hz.d, (select count(*) from best b where b.uae and b.ready_by <= hz.d)::integer as n,
        (select count(distinct pr.role_id) from pr where pr.uae and pr.ready_by <= hz.d)::integer as r from hz) q),
    'progression', (select jsonb_build_object('emirati', kafaa_na_sup(q.e), 'all', kafaa_na_sup(q.a), 'share_pct', case when q.e >= 10 and q.a >= 10 then kafaa_na_pct1(q.e, q.a) end,
        'by_year', (select jsonb_agg(jsonb_build_object('year', yr, 'n', kafaa_na_sup((select count(*) from sp where sp.nationality_flag = 'uae' and sp.authorised_on is not null
            and extract(year from sp.authorised_on)::integer = yr and sp.authorised_on <= p_today)::integer)) order by yr)
          from generate_series(extract(year from p_today)::integer - 5, extract(year from p_today)::integer) yr))
      from (select count(*) filter (where nationality_flag = 'uae')::integer as e, count(*)::integer as a from sp
        where sp.authorised_on > kafaa_ep_add_months(p_today, -36) and sp.authorised_on <= p_today) q),
    'retention', (select jsonb_agg(jsonb_build_object('months', n, 'cohort', kafaa_na_sup(q.ce), 'retained', case when q.ce >= 10 then kafaa_na_sup(q.ke) end,
        'pct', case when q.ke >= 10 and q.ce >= 10 then kafaa_na_pct1(q.ke, q.ce) end, 'all_pct', case when q.ka >= 10 and q.ca >= 10 then kafaa_na_pct1(q.ka, q.ca) end) order by n)
      from unnest(array[12, 24, 36]) n cross join lateral (
        select count(*) filter (where z.c and z.uae)::integer as ce, count(*) filter (where z.c and z.k and z.uae)::integer as ke,
          count(*) filter (where z.c)::integer as ca, count(*) filter (where z.c and z.k)::integer as ka
        from (select sp.nationality_flag = 'uae' as uae, kafaa_ep_add_months(sp.hired_on, n) <= p_today as c,
          (sp.left_on is null or sp.left_on >= kafaa_ep_add_months(sp.hired_on, n)) as k from sp) z) q))
$$;
-- emiratiPipeline(): the roles in scope, one row per competency area and the total
create or replace function kafaa_ep_core(p_scope text, p_today date) returns jsonb language sql stable security definer set search_path = public as $$
  with s as (select case when p_scope in ('all', 'critical', 'future') then p_scope else 'all' end as scope),
  r as (select coalesce((select jsonb_agg(x order by x ->> 'family_id' collate "C", x ->> 'role_id' collate "C") from jsonb_array_elements(kafaa_ep_roles()) x
          where s.scope = 'all' or (s.scope = 'critical' and (x ->> 'critical')::boolean) or (s.scope = 'future' and (x ->> 'future')::boolean)), '[]'::jsonb) as roles from s)
  select jsonb_build_object('as_of', to_char(p_today, 'YYYY-MM-DD'), 'method', 'fs73-v1', 'min_group', 10, 'scope', s.scope, 'roles', r.roles,
    'areas', coalesce((select jsonb_agg(kafaa_ep_area(r.roles, q.f, p_today) order by q.f collate "C") from (select distinct x ->> 'family_id' as f from jsonb_array_elements(r.roles) x) q), '[]'::jsonb),
    'total', kafaa_ep_area(r.roles, null, p_today))
  from s, r
$$;

-- ═════════════ FS74 rules (mirror of src/modules/m37/wallet.ts). Internal: not executable by API roles.
-- the wallet items in order: key, plan activity kind and title (ITEM_PLAN_KIND / ITEM_TITLE)
create or replace function kafaa_fw_items() returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_array(
    jsonb_build_object('key', 'ai_rung2', 'kind', 'assessment', 'title_en', 'Future Skills Wallet: reach AI fluency rung 2 (Practitioner)', 'title_ar', 'محفظة مهارات المستقبل: بلوغ الدرجة 2 في الطلاقة في الذكاء الاصطناعي (ممارِس)'),
    jsonb_build_object('key', 'cyber_hygiene', 'kind', 'assessment', 'title_en', 'Future Skills Wallet: earn the cyber hygiene micro-credential', 'title_ar', 'محفظة مهارات المستقبل: الحصول على الاعتماد المصغّر في النظافة السيبرانية'),
    jsonb_build_object('key', 'plant_data', 'kind', 'course', 'title_en', 'Future Skills Wallet: show plant-data basics with evidence', 'title_ar', 'محفظة مهارات المستقبل: إثبات أساسيات بيانات المحطة بالأدلة'),
    jsonb_build_object('key', 'core_skill', 'kind', 'ojt', 'title_en', 'Future Skills Wallet: practise one critical core skill to level 2', 'title_ar', 'محفظة مهارات المستقبل: ممارسة مهارة أساسية حرجة واحدة حتى المستوى 2'),
    jsonb_build_object('key', 'cec_l1', 'kind', 'course', 'title_en', 'Future Skills Wallet: reach CleanEnergyComp level 1', 'title_ar', 'محفظة مهارات المستقبل: بلوغ المستوى 1 في كفاءات الطاقة النظيفة'))
$$;
-- walletStatus(): the core-five wallet of one person, from evidence only (a self-rating never counts)
create or replace function kafaa_fw_status(p_person text, p_today date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_rung integer; v_aw text; v_aw_to date; v_pl text; v_pl_lv integer; v_cs text; v_cs_lv integer; v_cec integer; v_items jsonb; v_met integer;
begin
  v_rung := coalesce((kafaa_ai_rung(p_person) ->> 'rung')::integer, 0);
  select a.id, a.valid_to into v_aw, v_aw_to from kafaa_microcred_awards a
    where a.person_id = p_person and a.def_code = 'MC-CYBER-HYGIENE' and a.status = 'awarded' and (a.valid_to is null or a.valid_to >= p_today)
    order by a.issued_on desc nulls last, a.id collate "C" limit 1;
  select s.id, s.level into v_pl, v_pl_lv from kafaa_person_skills s
    where s.person_id = p_person and s.active and s.skill_id = 'sk-da-01' and s.basis in ('verified', 'evidenced', 'validated') and s.level >= 1
    order by s.level desc, s.id collate "C" limit 1;
  select c.id, least(3, greatest(0, coalesce(max(s.level), 0))) into v_cs, v_cs_lv from kafaa_core_skills c
    left join kafaa_person_skills s on s.person_id = p_person and s.active and s.basis in ('verified', 'evidenced', 'validated') and s.level >= 1 and s.skill_id = any (c.skill_ids)
    where c.status = 'active' group by c.id, c.sort order by 2 desc, c.sort, c.id collate "C" limit 1;
  v_cec := coalesce(kafaa_cec_level(p_person), 0);
  v_items := jsonb_build_array(
    jsonb_build_object('key', 'ai_rung2', 'met', v_rung >= 2, 'level', v_rung, 'ref_table', null, 'ref_id', null, 'until', null),
    jsonb_build_object('key', 'cyber_hygiene', 'met', v_aw is not null, 'level', null, 'ref_table', case when v_aw is not null then 'microcred_awards' end, 'ref_id', v_aw,
      'until', to_char(v_aw_to, 'YYYY-MM-DD')),
    jsonb_build_object('key', 'plant_data', 'met', v_pl is not null and v_pl_lv >= 1, 'level', v_pl_lv, 'ref_table', case when v_pl is not null then 'person_skills' end, 'ref_id', v_pl, 'until', null),
    jsonb_build_object('key', 'core_skill', 'met', coalesce(v_cs_lv, 0) >= 2, 'level', case when v_cs_lv > 0 then v_cs_lv end, 'ref_table', case when v_cs_lv > 0 then 'core_skills' end,
      'ref_id', case when v_cs_lv > 0 then v_cs end, 'until', null),
    jsonb_build_object('key', 'cec_l1', 'met', v_cec >= 1, 'level', v_cec, 'ref_table', null, 'ref_id', null, 'until', null));
  v_met := (select count(*) from jsonb_array_elements(v_items) i where (i ->> 'met')::boolean)::integer;
  return jsonb_build_object('items', v_items, 'met', v_met, 'complete', v_met = 5);
end $$;
-- targetViewOf(): the active leadership setting with the name of the role card that set it
create or replace function kafaa_fw_target_view() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', t.id, 'metric', t.metric, 'pct', t.pct, 'due_on', to_char(t.due_on, 'YYYY-MM-DD'), 'set_by', t.set_by, 'set_by_role', t.set_by_role,
    'set_at', to_char(t.set_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'set_by_name_en', coalesce(p.display_name, t.set_by),
    'set_by_name_ar', coalesce(p.display_name_ar, p.display_name, t.set_by), 'note_en', t.note_en, 'note_ar', t.note_ar, 'version', t.version, 'history', t.history,
    'benchmark_ids', to_jsonb(t.benchmark_ids), 'sources', t.sources)
  from kafaa_wallet_targets t left join kafaa_people p on p.id = t.set_by
  where t.metric = 'core_five_complete' and t.status = 'active' order by t.id collate "C" limit 1
$$;
-- walletCounter(): active staff with a complete wallet against the target; per item, by number of items held, by family; suppressed under 10
create or replace function kafaa_fw_counter_core(p_today date) returns jsonb language sql stable security definer set search_path = public as $$
  with st as (select p.id, p.job_family_id as fam, kafaa_fw_status(p.id, p_today) as j from kafaa_people p where p.kind = 'staff' and p.status = 'active'),
  x as (select id, fam, (j ->> 'complete')::boolean as c, (j ->> 'met')::integer as m,
    array[(j -> 'items' -> 0 ->> 'met')::boolean, (j -> 'items' -> 1 ->> 'met')::boolean, (j -> 'items' -> 2 ->> 'met')::boolean,
          (j -> 'items' -> 3 ->> 'met')::boolean, (j -> 'items' -> 4 ->> 'met')::boolean] as it from st),
  tot as (select count(*)::integer as n, count(*) filter (where c)::integer as c from x),
  tv as (select kafaa_fw_target_view() as t),
  keys as (select k, o from unnest(array['ai_rung2', 'cyber_hygiene', 'plant_data', 'core_skill', 'cec_l1']) with ordinality as u(k, o))
  select jsonb_build_object(
    'as_of', to_char(p_today, 'YYYY-MM-DD'), 'staff', kafaa_na_sup(tot.n), 'complete', case when tot.n >= 10 then kafaa_na_sup(tot.c) end,
    'pct', case when tot.n >= 10 and tot.c >= 10 then kafaa_na_pct1(tot.c, tot.n) end,
    'gap', case when tot.n >= 10 and tot.c >= 10 and tv.t is not null then ((tv.t ->> 'pct')::numeric * 10 - round((kafaa_na_pct1(tot.c, tot.n) * 10)::numeric)) / 10 end,
    'target', tv.t,
    'items', (select jsonb_agg(jsonb_build_object('key', keys.k, 'n', case when tot.n >= 10 then kafaa_na_sup(q.m) end,
        'pct', case when tot.n >= 10 and q.m >= 10 then kafaa_na_pct1(q.m, tot.n) end) order by keys.o)
      from keys cross join lateral (select count(*) filter (where x.it[keys.o])::integer as m from x) q),
    'distribution', (select jsonb_agg(jsonb_build_object('met', k, 'n', case when tot.n >= 10 then kafaa_na_sup((select count(*) from x where x.m = k)::integer) end) order by k)
      from generate_series(0, 5) k),
    'families', coalesce((select jsonb_agg(jsonb_build_object('family_id', f.fam, 'staff', kafaa_na_sup(f.n), 'complete', case when f.n >= 10 then kafaa_na_sup(f.c) end,
        'pct', case when f.n >= 10 and f.c >= 10 then kafaa_na_pct1(f.c, f.n) end,
        'items', (select jsonb_object_agg(keys.k, case when f.n >= 10 and q.m >= 10 then kafaa_na_pct1(q.m, f.n) end)
          from keys cross join lateral (select count(*) filter (where x.it[keys.o])::integer as m from x where x.fam = f.fam) q)) order by f.fam collate "C")
      from (select fam, count(*)::integer as n, count(*) filter (where c)::integer as c from x
        where fam is not null and fam <> all (array['security', 'safeguards', 'cyber']) group by fam) f), '[]'::jsonb))
  from tot, tv
$$;
-- targetProblem(): first problem of a target setting (null = ok)
create or replace function kafaa_fw_target_problem(p jsonb, p_today date) returns text language plpgsql stable set search_path = public as $$
declare v_due date;
begin
  if coalesce(jsonb_typeof(p -> 'pct'), '') <> 'number' or (p ->> 'pct')::numeric <> floor((p ->> 'pct')::numeric) or (p ->> 'pct')::numeric < 1 or (p ->> 'pct')::numeric > 100 then return 'pct'; end if;
  if coalesce(jsonb_typeof(p -> 'due_on'), '') <> 'string' or (p ->> 'due_on') !~ '^\d{4}-\d{2}-\d{2}$' then return 'due'; end if;
  begin v_due := (p ->> 'due_on')::date; exception when others then return 'due'; end;
  if to_char(v_due, 'YYYY-MM-DD') <> p ->> 'due_on' or v_due <= p_today or v_due > date '2035-12-31' then return 'due'; end if;
  if not kafaa_na_len(p, 'note_en', 10, 300) or not kafaa_na_len(p, 'note_ar', 10, 300) then return 'note'; end if;
  if not kafaa_so_text_clean(array[p ->> 'note_en', p ->> 'note_ar']) then return 'clean'; end if;
  return null;
end $$;

-- ═════════════ RPCs
-- FS73: the Emirati pipeline (anyRole hr_analyst, hr_director, auditor); null for anyone else; read-only, never audited
create or replace function kafaa_emirati_pipeline(p_scope text default 'all') returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not kafaa_ep_allowed() then return null; end if;
  return kafaa_ep_core(p_scope, current_date);
end $$;

-- FS74: my wallet, my open plan and the target (skills_profile Own)
create or replace function kafaa_my_future_wallet() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); v_plan text; v_plan_status text; v_fam text;
begin
  if me is null or not kafaa_has_grant('skills_profile', array['Own']) then return null; end if;
  select job_family_id into v_fam from kafaa_people where id = me;
  select d.id, d.status into v_plan, v_plan_status from kafaa_dev_plans d where d.person_id = me and d.status in ('draft', 'submitted', 'approved', 'active')
    order by case d.status when 'active' then 0 when 'approved' then 1 when 'submitted' then 2 else 3 end, d.id collate "C" limit 1;
  return jsonb_build_object('person_id', me, 'family_id', v_fam, 'as_of', to_char(current_date, 'YYYY-MM-DD'), 'status', kafaa_fw_status(me, current_date),
    'plan', case when v_plan is not null then jsonb_build_object('id', v_plan, 'status', v_plan_status) end,
    'in_plan', coalesce((select jsonb_object_agg(i ->> 'key', a.status) from jsonb_array_elements(kafaa_fw_items()) i
      join kafaa_plan_activities a on a.id = 'pa-fs74-' || me || '-' || (i ->> 'key')), '{}'::jsonb),
    'target', kafaa_fw_target_view());
end $$;

-- FS74: the organisation counter (national_alignment Agg/W/A)
create or replace function kafaa_future_wallet_counter() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if kafaa_me() is null or not kafaa_has_grant('national_alignment', array['Agg', 'W', 'A']) then return null; end if;
  return kafaa_fw_counter_core(current_date);
end $$;

-- FS74: set the dated target (workforce_strategy A: the HR director); versioned with history; audited; ledger
create or replace function kafaa_set_wallet_target(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; v_prob text; cur kafaa_wallet_targets; v_version integer; a kafaa_audit_events; l integer;
  v_pct integer; v_due date;
begin
  p := coalesce(p, '{}'::jsonb);
  if me is null then return kafaa_refuse('national.wallet_target.set', 'wallet_targets', 'wt-core-five', 'not_signed_in', 'Sign in to see your Future Skills Wallet'); end if;
  v_role := kafaa_acting_role('workforce_strategy', array['A']);
  if v_role is null then return kafaa_refuse('national.wallet_target.set', 'wallet_targets', 'wt-core-five', 'forbidden', 'Only the HR director sets the Future Skills Wallet target'); end if;
  v_prob := kafaa_fw_target_problem(p, current_date);
  if v_prob is not null then
    return kafaa_refuse('national.wallet_target.set', 'wallet_targets', 'wt-core-five', 'invalid', 'Check the target: ' || case v_prob
      when 'pct' then 'a whole percentage from 1 to 100' when 'due' then 'a target date after today and no later than 2035-12-31'
      when 'note' then 'a note of 10 to 300 characters in English and in Arabic' else 'the note may not state headcounts or site information' end, v_role);
  end if;
  v_pct := (p ->> 'pct')::integer; v_due := (p ->> 'due_on')::date;
  select * into cur from kafaa_wallet_targets where id = 'wt-core-five';
  if cur.id is not null and cur.pct = v_pct and cur.due_on = v_due then
    return kafaa_refuse('national.wallet_target.set', 'wallet_targets', 'wt-core-five', 'unchanged', 'This is already the target: change the value or the date', v_role);
  end if;
  v_version := coalesce(cur.version + 1, 1);
  if cur.id is not null then
    update kafaa_wallet_targets set pct = v_pct, due_on = v_due, note_en = btrim(p ->> 'note_en', E' \t\n\r'), note_ar = btrim(p ->> 'note_ar', E' \t\n\r'),
      set_by = me, set_by_role = v_role, set_at = date_trunc('second', now()), status = 'active', version = v_version,
      history = cur.history || jsonb_build_array(jsonb_build_object('version', cur.version, 'pct', cur.pct, 'due_on', to_char(cur.due_on, 'YYYY-MM-DD'), 'set_by', cur.set_by,
        'set_by_role', cur.set_by_role, 'set_at', to_char(cur.set_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'note_en', cur.note_en, 'note_ar', cur.note_ar))
    where id = 'wt-core-five';
  else
    insert into kafaa_wallet_targets (id, metric, pct, due_on, note_en, note_ar, set_by, set_by_role, set_at, status, version, history, benchmark_ids, sources)
    values ('wt-core-five', 'core_five_complete', v_pct, v_due, btrim(p ->> 'note_en', E' \t\n\r'), btrim(p ->> 'note_ar', E' \t\n\r'), me, v_role, date_trunc('second', now()),
      'active', 1, '[]'::jsonb, '{}'::text[], '[]'::jsonb);
  end if;
  l := kafaa_ledger('kafaa.national.wallet_target', format('Future Skills Wallet target set: %s%% of staff by %s (v%s)', v_pct, to_char(v_due, 'YYYY-MM-DD'), v_version));
  a := kafaa_audit('national.wallet_target.set', 'wallet_targets', 'wt-core-five', 'ok', format('v%s %s%% by %s', v_version, v_pct, to_char(v_due, 'YYYY-MM-DD')),
    case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Target saved', a, l, jsonb_build_object('id', 'wt-core-five', 'version', v_version));
end $$;

-- FS74: add my open wallet items to my development plan (dev_plans Own). Writes M04 kafaa_dev_plans / kafaa_plan_activities (logged in
-- CONTRACT.md, the W1 roadmap-to-plan precedent); the row-audit triggers stay quiet inside (kafaa.seeding, transaction-local) because the
-- RPC writes one audit row itself. Never duplicates an activity (same id, or the same title already in the plan).
create or replace function kafaa_add_wallet_to_plan() returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me text := kafaa_me(); v_role text; v_status jsonb; v_plan text; v_job text; v_new boolean := false; v_due date; it jsonb; x jsonb; v_id text;
  v_created integer := 0; v_existing integer := 0; a kafaa_audit_events; v_prev text := current_setting('kafaa.seeding', true);
begin
  if me is null then return kafaa_refuse('national.wallet.to_plan', 'plan_activities', null, 'not_signed_in', 'Sign in to see your Future Skills Wallet'); end if;
  v_role := kafaa_acting_role('dev_plans', array['Own', 'Scope']);
  if v_role is null or not kafaa_has_grant('skills_profile', array['Own']) then
    return kafaa_refuse('national.wallet.to_plan', 'plan_activities', me, 'forbidden', 'Only staff with a development plan can do this'); end if;
  v_status := kafaa_fw_status(me, current_date);
  if (v_status ->> 'complete')::boolean then return kafaa_refuse('national.wallet.to_plan', 'plan_activities', me, 'complete', 'Your wallet is complete: there is nothing to add', v_role); end if;
  select d.id into v_plan from kafaa_dev_plans d where d.person_id = me and d.status in ('draft', 'submitted', 'approved', 'active')
    order by case d.status when 'active' then 0 when 'approved' then 1 when 'submitted' then 2 else 3 end, d.id collate "C" limit 1;
  if v_plan is null then
    select job_role_id into v_job from kafaa_people where id = me;
    if v_job is null or exists (select 1 from kafaa_dev_plans where id = 'dp-fs74-' || me) then
      return kafaa_refuse('national.wallet.to_plan', 'plan_activities', me, 'no_plan', 'Start a development plan first (My plan)', v_role); end if;
  end if;
  perform set_config('kafaa.seeding', 'on', true);
  if v_plan is null then
    v_plan := 'dp-fs74-' || me;
    insert into kafaa_dev_plans (id, person_id, target_role_id, status, created_at, note) values (v_plan, me, v_job, 'draft', date_trunc('second', now()), 'Created from the Future Skills Wallet');
    v_new := true;
  end if;
  v_due := (select (t ->> 'due_on')::date from (select kafaa_fw_target_view() as t) q);
  for it in select i from jsonb_array_elements(v_status -> 'items') i loop
    if (it ->> 'met')::boolean then continue; end if;
    select i into x from jsonb_array_elements(kafaa_fw_items()) i where i ->> 'key' = it ->> 'key';
    v_id := 'pa-fs74-' || me || '-' || (it ->> 'key');
    if exists (select 1 from kafaa_plan_activities where id = v_id)
       or exists (select 1 from kafaa_plan_activities pa where pa.person_id = me and pa.plan_id = v_plan and pa.title_en = x ->> 'title_en') then
      v_existing := v_existing + 1; continue;
    end if;
    insert into kafaa_plan_activities (id, plan_id, person_id, kind, title_en, title_ar, due_on, status, course_id)
    values (v_id, v_plan, me, x ->> 'kind', x ->> 'title_en', x ->> 'title_ar', v_due, 'planned', null);
    v_created := v_created + 1;
  end loop;
  perform set_config('kafaa.seeding', coalesce(v_prev, ''), true);
  a := kafaa_audit('national.wallet.to_plan', 'plan_activities', v_plan, 'ok', format('%s added, %s already in plan %s', v_created, v_existing, v_plan), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', case when v_created > 0 then 'Added to your development plan' else 'Already in your development plan' end, a, null,
    jsonb_build_object('plan_id', v_plan, 'plan_created', v_new, 'created', v_created, 'existing', v_existing));
end $$;

-- ═════════════ FS62 hand-off: the wallet target joins the national-alignment layer. Newest bodies (fs72), each with 'wallet_targets' added.
create or replace function kafaa_na_target(p_table text, p_id text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r record; v jsonb := jsonb_build_object('exists', false, 'title_en', p_id, 'title_ar', p_id, 'active', false, 'area', null);
begin
  if p_table = 'skills' then
    select * into r from kafaa_skills where id = p_id;
    if found then v := jsonb_build_object('exists', true, 'title_en', r.name_en, 'title_ar', r.name_ar, 'active', r.lifecycle is distinct from 'obsolete', 'area', r.area); end if;
  elsif p_table = 'cec_competences' then
    select * into r from kafaa_cec_competences where id = p_id;
    if found then v := jsonb_build_object('exists', true, 'title_en', r.code || ' ' || r.name_en, 'title_ar', r.code || ' ' || r.name_ar, 'active', coalesce(r.status, 'active') = 'active', 'area', null); end if;
  elsif p_table = 'programmes' then
    select * into r from kafaa_programmes where id = p_id;
    if found then v := jsonb_build_object('exists', true, 'title_en', r.name_en, 'title_ar', r.name_ar, 'active', true, 'area', null); end if;
  elsif p_table = 'pathways' then
    select * into r from kafaa_pathways where id = p_id;
    if found then v := jsonb_build_object('exists', true, 'title_en', r.title_en, 'title_ar', r.title_ar, 'active', r.status = 'published', 'area', null); end if;
  elsif p_table = 'microcred_defs' then
    select * into r from kafaa_microcred_defs where id = p_id;
    if found then v := jsonb_build_object('exists', true, 'title_en', r.code || ' ' || r.title_en, 'title_ar', r.code || ' ' || r.title_ar, 'active', r.status = 'current', 'area', null); end if;
  elsif p_table = 'talent_programmes' then
    select * into r from kafaa_talent_programmes where id = p_id;
    if found then v := jsonb_build_object('exists', true, 'title_en', r.name_en, 'title_ar', r.name_ar, 'active', true, 'area', null); end if;
  elsif p_table = 'leadership_programmes' then
    select * into r from kafaa_leadership_programmes where id = p_id;
    if found then v := jsonb_build_object('exists', true, 'title_en', r.title_en, 'title_ar', r.title_ar, 'active', true, 'area', null); end if;
  elsif p_table = 'critical_skills' then
    select c.status, c.skill_id, s.name_en, s.name_ar into r from kafaa_critical_skills c left join kafaa_skills s on s.id = c.skill_id where c.id = p_id;
    if found then v := jsonb_build_object('exists', true, 'title_en', 'Critical skill: ' || coalesce(r.name_en, r.skill_id), 'title_ar', 'مهارة حرجة: ' || coalesce(r.name_ar, r.skill_id),
      'active', r.status = 'active', 'area', null); end if;
  elsif p_table = 'ai_org_targets' then
    select * into r from kafaa_ai_org_targets where id = p_id;
    if found then v := case when r.metric = 'practitioner_or_above'
      then jsonb_build_object('exists', true, 'title_en', 'AI fluency target: Practitioner or above', 'title_ar', 'هدف الطلاقة في الذكاء الاصطناعي: ممارِس أو أعلى', 'active', true, 'area', null)
      else jsonb_build_object('exists', true, 'title_en', 'AI fluency target: above basic', 'title_ar', 'هدف الطلاقة في الذكاء الاصطناعي: فوق المستوى الأساسي', 'active', true, 'area', null) end; end if;
  elsif p_table = 'cec_role_targets' then
    select t.family_id, f.name_en, f.name_ar into r from kafaa_cec_role_targets t left join kafaa_job_families f on f.id = t.family_id where t.id = p_id;
    if found then v := jsonb_build_object('exists', true, 'title_en', 'CleanEnergyComp target: ' || coalesce(r.name_en, r.family_id), 'title_ar', 'هدف كفاءات الطاقة النظيفة: ' || coalesce(r.name_ar, r.family_id), 'active', true, 'area', null); end if;
  elsif p_table = 'wallet_targets' then -- FS74 (fsHe2)
    select * into r from kafaa_wallet_targets where id = p_id;
    if found then v := jsonb_build_object('exists', true, 'title_en', 'Future Skills Wallet target: the core five', 'title_ar', 'هدف محفظة مهارات المستقبل: المهارات الخمس الأساسية', 'active', r.status = 'active', 'area', null); end if;
  end if;
  return v;
end $$;

-- linkProblem(): first problem of a link save (null = ok)
create or replace function kafaa_na_link_problem(p jsonb, p_tag kafaa_national_tags, p_target jsonb, p_active boolean) returns text language plpgsql stable security definer set search_path = public as $$
declare v_table text := kafaa_na_str(p, 'target_table');
begin
  if p_tag.id is null or p_tag.status <> 'active' then return 'tag'; end if;
  if not (v_table = any (array['skills', 'cec_competences', 'programmes', 'pathways', 'microcred_defs', 'talent_programmes', 'leadership_programmes', 'critical_skills', 'ai_org_targets', 'cec_role_targets'])) then return 'table'; end if;
  if not (p_target ->> 'exists')::boolean then return 'target'; end if;
  if (p_tag.derive = 'future_group' and v_table = 'skills') or (p_tag.derive = 'cec_net_zero' and v_table = 'cec_competences') then return 'derived'; end if;
  if v_table = 'skills' and p_target ->> 'area' = 'security' then return 'security'; end if;
  if p_active and (not kafaa_na_len(p, 'note_en', 10, 300) or not kafaa_na_len(p, 'note_ar', 10, 300)) then return 'note'; end if;
  if not kafaa_so_text_clean(array[coalesce(p ->> 'note_en', ''), coalesce(p ->> 'note_ar', '')]) then return 'clean'; end if;
  if not kafaa_na_typed_free(array[coalesce(p ->> 'note_en', ''), coalesce(p ->> 'note_ar', '')]) then return 'typed_total'; end if;
  return null;
end $$;

-- effectiveLinks(): curated links on active tags plus links derived from data, one per tag, table and target (curated first)
create or replace function kafaa_na_links() returns jsonb language sql stable security definer set search_path = public as $$
  with t as (select * from kafaa_national_tags where status = 'active'),
  x as (
    select l.tag_id, l.target_table, l.target_id, 'curated'::text as basis, l.id as link_id, l.note_en, l.note_ar, 0 as b
      from kafaa_tag_links l join t on t.id = l.tag_id
      where l.active and l.target_table = any (array['skills', 'cec_competences', 'programmes', 'pathways', 'microcred_defs', 'talent_programmes', 'leadership_programmes', 'critical_skills', 'ai_org_targets', 'cec_role_targets'])
    union all
    select t.id, 'skills', s.id, 'future_group', null, null, null, 1 from t join kafaa_skills s on s.future_group = t.future_group
      where t.derive = 'future_group' and coalesce(t.future_group, '') <> '' and s.lifecycle is distinct from 'obsolete'
    union all
    select t.id, 'cec_competences', c.id, 'net_zero', null, null, null, 2 from t join kafaa_cec_competences c on c.net_zero and coalesce(c.status, 'active') = 'active'
      where t.derive = 'cec_net_zero'
  ),
  d as (select x.*, row_number() over (partition by tag_id, target_table, target_id order by b) as rn from x)
  select coalesce(jsonb_agg(jsonb_build_object('tag_id', tag_id, 'target_table', target_table, 'target_id', target_id, 'basis', basis, 'link_id', link_id, 'note_en', note_en, 'note_ar', note_ar)
    order by tag_id collate "C", array_position(array['skills', 'cec_competences', 'programmes', 'pathways', 'microcred_defs', 'talent_programmes', 'leadership_programmes', 'critical_skills', 'ai_org_targets', 'cec_role_targets'], target_table),
      target_id collate "C", b), '[]'::jsonb)
  from d where rn = 1
$$;

create or replace function kafaa_na_link_problem(p jsonb, p_tag kafaa_national_tags, p_target jsonb, p_active boolean) returns text language plpgsql stable security definer set search_path = public as $$
declare v_table text := kafaa_na_str(p, 'target_table');
begin
  if p_tag.id is null or p_tag.status <> 'active' then return 'tag'; end if;
  if not (v_table = any (array['skills', 'cec_competences', 'programmes', 'pathways', 'microcred_defs', 'talent_programmes', 'leadership_programmes', 'critical_skills', 'ai_org_targets', 'cec_role_targets', 'wallet_targets'])) then return 'table'; end if;
  if not (p_target ->> 'exists')::boolean then return 'target'; end if;
  if (p_tag.derive = 'future_group' and v_table = 'skills') or (p_tag.derive = 'cec_net_zero' and v_table = 'cec_competences') then return 'derived'; end if;
  if v_table = 'skills' and p_target ->> 'area' = 'security' then return 'security'; end if;
  if p_active and (not kafaa_na_len(p, 'note_en', 10, 300) or not kafaa_na_len(p, 'note_ar', 10, 300)) then return 'note'; end if;
  if not kafaa_so_text_clean(array[coalesce(p ->> 'note_en', ''), coalesce(p ->> 'note_ar', '')]) then return 'clean'; end if;
  if not kafaa_na_typed_free(array[coalesce(p ->> 'note_en', ''), coalesce(p ->> 'note_ar', '')]) then return 'typed_total'; end if;
  return null;
end $$;

-- effectiveLinks(): curated links on active tags plus links derived from data, one per tag, table and target (curated first)
create or replace function kafaa_na_links() returns jsonb language sql stable security definer set search_path = public as $$
  with t as (select * from kafaa_national_tags where status = 'active'),
  x as (
    select l.tag_id, l.target_table, l.target_id, 'curated'::text as basis, l.id as link_id, l.note_en, l.note_ar, 0 as b
      from kafaa_tag_links l join t on t.id = l.tag_id
      where l.active and l.target_table = any (array['skills', 'cec_competences', 'programmes', 'pathways', 'microcred_defs', 'talent_programmes', 'leadership_programmes', 'critical_skills', 'ai_org_targets', 'cec_role_targets', 'wallet_targets'])
    union all
    select t.id, 'skills', s.id, 'future_group', null, null, null, 1 from t join kafaa_skills s on s.future_group = t.future_group
      where t.derive = 'future_group' and coalesce(t.future_group, '') <> '' and s.lifecycle is distinct from 'obsolete'
    union all
    select t.id, 'cec_competences', c.id, 'net_zero', null, null, null, 2 from t join kafaa_cec_competences c on c.net_zero and coalesce(c.status, 'active') = 'active'
      where t.derive = 'cec_net_zero'
  ),
  d as (select x.*, row_number() over (partition by tag_id, target_table, target_id order by b) as rn from x)
  select coalesce(jsonb_agg(jsonb_build_object('tag_id', tag_id, 'target_table', target_table, 'target_id', target_id, 'basis', basis, 'link_id', link_id, 'note_en', note_en, 'note_ar', note_ar)
    order by tag_id collate "C", array_position(array['skills', 'cec_competences', 'programmes', 'pathways', 'microcred_defs', 'talent_programmes', 'leadership_programmes', 'critical_skills', 'ai_org_targets', 'cec_role_targets', 'wallet_targets'], target_table),
      target_id collate "C", b), '[]'::jsonb)
  from d where rn = 1
$$;

create or replace function kafaa_na_links() returns jsonb language sql stable security definer set search_path = public as $$
  with t as (select * from kafaa_national_tags where status = 'active'),
  x as (
    select l.tag_id, l.target_table, l.target_id, 'curated'::text as basis, l.id as link_id, l.note_en, l.note_ar, 0 as b
      from kafaa_tag_links l join t on t.id = l.tag_id
      where l.active and l.target_table = any (array['skills', 'cec_competences', 'programmes', 'pathways', 'microcred_defs', 'talent_programmes', 'leadership_programmes', 'critical_skills', 'ai_org_targets', 'cec_role_targets', 'wallet_targets'])
    union all
    select t.id, 'skills', s.id, 'future_group', null, null, null, 1 from t join kafaa_skills s on s.future_group = t.future_group
      where t.derive = 'future_group' and coalesce(t.future_group, '') <> '' and s.lifecycle is distinct from 'obsolete'
    union all
    select t.id, 'cec_competences', c.id, 'net_zero', null, null, null, 2 from t join kafaa_cec_competences c on c.net_zero and coalesce(c.status, 'active') = 'active'
      where t.derive = 'cec_net_zero'
  ),
  d as (select x.*, row_number() over (partition by tag_id, target_table, target_id order by b) as rn from x)
  select coalesce(jsonb_agg(jsonb_build_object('tag_id', tag_id, 'target_table', target_table, 'target_id', target_id, 'basis', basis, 'link_id', link_id, 'note_en', note_en, 'note_ar', note_ar)
    order by tag_id collate "C", array_position(array['skills', 'cec_competences', 'programmes', 'pathways', 'microcred_defs', 'talent_programmes', 'leadership_programmes', 'critical_skills', 'ai_org_targets', 'cec_role_targets', 'wallet_targets'], target_table),
      target_id collate "C", b), '[]'::jsonb)
  from d where rn = 1
$$;

create or replace function kafaa_na_measure(p_table text, p_id text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_kind text; n integer := 0; v_base integer; v_target double precision; v_due text; r record;
begin
  v_kind := case p_table when 'skills' then 'holders' when 'cec_competences' then 'holders' when 'programmes' then 'completers' when 'pathways' then 'enrolled'
    when 'microcred_defs' then 'awarded' when 'talent_programmes' then 'applicants' when 'leadership_programmes' then 'participants' when 'critical_skills' then 'at_target'
    when 'ai_org_targets' then 'org_share' when 'cec_role_targets' then 'family_share' when 'wallet_targets' then 'wallet_share' end;
  if v_kind is null then return null; end if;
  if p_table = 'skills' then n := kafaa_na_holders(array[p_id], 1);
  elsif p_table = 'cec_competences' then n := coalesce((select kafaa_na_holders(c.skill_ids, 1) from kafaa_cec_competences c where c.id = p_id), 0);
  elsif p_table = 'programmes' then
    select count(distinct x.pid)::integer into n from (
      select e.person_id as pid from kafaa_enrolments e join kafaa_courses c on c.id = e.course_id where c.programme_id = p_id and e.status = 'completed'
      union select tr.person_id from kafaa_training_records tr join kafaa_courses c on c.id = tr.course_id where c.programme_id = p_id and tr.result = 'passed') x
      join kafaa_people pp on pp.id = x.pid where pp.kind = 'staff' and pp.status = 'active';
  elsif p_table = 'pathways' then
    select count(distinct e.person_id)::integer into n from kafaa_pathway_enrolments e join kafaa_people pp on pp.id = e.person_id
      where e.pathway_id = p_id and e.status in ('active', 'completed') and pp.kind = 'staff' and pp.status = 'active';
  elsif p_table = 'microcred_defs' then
    select count(distinct a.person_id)::integer into n from kafaa_microcred_defs d join kafaa_microcred_awards a on a.def_code = d.code and a.status = 'awarded'
      join kafaa_people pp on pp.id = a.person_id where d.id = p_id and pp.kind = 'staff' and pp.status = 'active';
  elsif p_table = 'talent_programmes' then
    select count(distinct a.person_id)::integer into n from kafaa_applications a where a.programme_id = p_id;
  elsif p_table = 'leadership_programmes' then
    select count(distinct ln.person_id)::integer into n from kafaa_leadership_nominations ln join kafaa_people pp on pp.id = ln.person_id
      where ln.programme_id = p_id and ln.status in ('approved', 'completed') and pp.kind = 'staff' and pp.status = 'active';
  elsif p_table = 'critical_skills' then
    select * into r from kafaa_critical_skills where id = p_id;
    if found then
      return jsonb_build_object('kind', v_kind, 'n', kafaa_na_sup(kafaa_na_holders(array[r.skill_id], r.target_level)), 'base', null, 'pct', null, 'target', r.target_level, 'due_on', null);
    end if;
  elsif p_table = 'ai_org_targets' then
    select * into r from kafaa_ai_org_targets where id = p_id;
    if found then
      select count(*)::integer, count(*) filter (where (kafaa_ai_rung(pp.id) ->> 'rung')::integer >= 2)::integer into v_base, n
        from kafaa_people pp where pp.kind = 'staff' and pp.status = 'active';
      return jsonb_build_object('kind', v_kind, 'n', case when v_base >= 10 then kafaa_na_sup(n) end, 'base', kafaa_na_sup(v_base),
        'pct', case when v_base >= 10 and n >= 10 then kafaa_na_pct1(n, v_base) end, 'target', r.pct, 'due_on', to_char(r.due_on, 'YYYY-MM-DD'));
    end if;
  elsif p_table = 'cec_role_targets' then
    select * into r from kafaa_cec_role_targets where id = p_id;
    if found then
      if r.family_id = any (array['security', 'safeguards', 'cyber']) then
        return jsonb_build_object('kind', v_kind, 'n', null, 'base', null, 'pct', null, 'target', r.level, 'due_on', null);
      end if;
      select count(*)::integer, count(*) filter (where kafaa_cec_level(pp.id) >= r.level)::integer into v_base, n
        from kafaa_people pp where pp.kind = 'staff' and pp.status = 'active' and pp.job_family_id = r.family_id;
      return jsonb_build_object('kind', v_kind, 'n', case when v_base >= 10 then kafaa_na_sup(n) end, 'base', kafaa_na_sup(v_base),
        'pct', case when v_base >= 10 and n >= 10 then kafaa_na_pct1(n, v_base) end, 'target', r.level, 'due_on', null);
    end if;
  elsif p_table = 'wallet_targets' then -- FS74 (fsHe2): active staff with a complete core-five wallet against the leadership target
    select * into r from kafaa_wallet_targets where id = p_id;
    if found then
      select count(*)::integer, count(*) filter (where (kafaa_fw_status(pp.id, current_date) ->> 'complete')::boolean)::integer into v_base, n
        from kafaa_people pp where pp.kind = 'staff' and pp.status = 'active';
      return jsonb_build_object('kind', v_kind, 'n', case when v_base >= 10 then kafaa_na_sup(n) end, 'base', kafaa_na_sup(v_base),
        'pct', case when v_base >= 10 and n >= 10 then kafaa_na_pct1(n, v_base) end, 'target', r.pct, 'due_on', to_char(r.due_on, 'YYYY-MM-DD'));
    end if;
  end if;
  return jsonb_build_object('kind', v_kind, 'n', kafaa_na_sup(n), 'base', null, 'pct', null, 'target', null, 'due_on', null);
end $$;

-- the Jahiz group name inside reasons (identical to JAHIZ_GROUP_NAME)
create or replace function kafaa_na_group_name(p_group text) returns jsonb language sql immutable set search_path = public as $$
  select case p_group
    when 'digital' then jsonb_build_object('en', 'Digital Skills', 'ar', 'المهارات الرقمية')
    when 'ten_x' then jsonb_build_object('en', '10X Skills', 'ar', 'مهارات 10X')
    when 'data_ai' then jsonb_build_object('en', 'Data & AI Skills', 'ar', 'مهارات البيانات والذكاء الاصطناعي')
    when 'new_economy' then jsonb_build_object('en', 'New Economy Skills', 'ar', 'مهارات الاقتصاد الجديد')
    else jsonb_build_object('en', coalesce(p_group, ''), 'ar', coalesce(p_group, '')) end
$$;

create or replace function kafaa_na_report_core(p_filter jsonb, p_measures boolean) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_strategy text; v_tag kafaa_national_tags; v_kind text; v_filter jsonb; v_eff jsonb := kafaa_na_links(); v_tags jsonb; v_items jsonb;
  c_tables constant text[] := array['skills', 'cec_competences', 'programmes', 'pathways', 'microcred_defs', 'talent_programmes', 'leadership_programmes', 'critical_skills', 'ai_org_targets', 'cec_role_targets', 'wallet_targets'];
  c_strat constant text[] := array['nes_2031', 'we_uae_2031', 'ai_2031', 'net_zero_2050', 'jahiz', 'centennial_2071'];
begin
  p_filter := coalesce(p_filter, '{}'::jsonb);
  v_strategy := case when jsonb_typeof(p_filter -> 'strategy') = 'string' and p_filter ->> 'strategy' = any (c_strat) then p_filter ->> 'strategy' end;
  if jsonb_typeof(p_filter -> 'tag_id') = 'string' then select * into v_tag from kafaa_national_tags where id = p_filter ->> 'tag_id'; end if;
  v_kind := case when jsonb_typeof(p_filter -> 'kind') = 'string' and p_filter ->> 'kind' in ('skill', 'programme', 'target') then p_filter ->> 'kind' end;
  if v_tag.id is not null then v_strategy := v_tag.strategy; end if;
  v_filter := jsonb_build_object('strategy', v_strategy, 'tag_id', v_tag.id, 'kind', v_kind);

  with t as (
    select t.id, t.strategy, t.parent_id, t.kind, t.name_en, t.name_ar, t.future_group,
      row_number() over (order by array_position(c_strat, t.strategy), coalesce(r.sort, t.sort), case when t.parent_id is not null then t.sort else -1 end, t.id collate "C") as ord
    from kafaa_national_tags t left join kafaa_national_tags r on r.id = t.parent_id where t.status = 'active'
  ),
  s as (select t.*, case when v_tag.id is not null then (t.id = v_tag.id or coalesce(t.parent_id = v_tag.id, false)) when v_strategy is not null then t.strategy = v_strategy else true end as in_scope from t),
  e as (
    select x ->> 'tag_id' as tag_id, x ->> 'target_table' as target_table, x ->> 'target_id' as target_id, x ->> 'basis' as basis, x ->> 'link_id' as link_id,
      x ->> 'note_en' as note_en, x ->> 'note_ar' as note_ar,
      case when x ->> 'target_table' in ('skills', 'cec_competences') then 'skill' when x ->> 'target_table' in ('critical_skills', 'ai_org_targets', 'cec_role_targets', 'wallet_targets') then 'target' else 'programme' end as ikind
    from jsonb_array_elements(v_eff) x
  ),
  sm as (
    select s.ord, s.id, s.strategy, s.parent_id, s.kind,
      (select count(distinct (e.target_table, e.target_id)) from e where (e.tag_id = s.id or (s.kind = 'strategy' and e.tag_id in (select c.id from t c where c.parent_id = s.id))) and e.ikind = 'skill')::integer as n_skill,
      (select count(distinct (e.target_table, e.target_id)) from e where (e.tag_id = s.id or (s.kind = 'strategy' and e.tag_id in (select c.id from t c where c.parent_id = s.id))) and e.ikind = 'programme')::integer as n_prog,
      (select count(distinct (e.target_table, e.target_id)) from e where (e.tag_id = s.id or (s.kind = 'strategy' and e.tag_id in (select c.id from t c where c.parent_id = s.id))) and e.ikind = 'target')::integer as n_target,
      case when p_measures then kafaa_na_sup(kafaa_na_holders((
        select coalesce(array_agg(distinct k), '{}'::text[]) from (
          select e.target_id as k from e where (e.tag_id = s.id or (s.kind = 'strategy' and e.tag_id in (select c.id from t c where c.parent_id = s.id))) and e.target_table = 'skills'
          union select unnest(cc.skill_ids) from e join kafaa_cec_competences cc on cc.id = e.target_id
            where (e.tag_id = s.id or (s.kind = 'strategy' and e.tag_id in (select c.id from t c where c.parent_id = s.id))) and e.target_table = 'cec_competences') q), 1)) end as reach
    from s where s.in_scope
  )
  select coalesce(jsonb_agg(jsonb_build_object('tag_id', id, 'strategy', strategy, 'parent_id', parent_id, 'kind', kind, 'skills', n_skill, 'programmes', n_prog, 'targets', n_target, 'reach', reach) order by ord), '[]'::jsonb)
  into v_tags from sm;

  with t as (
    select t.id, t.strategy, t.parent_id, t.name_en, t.name_ar, t.future_group,
      row_number() over (order by array_position(c_strat, t.strategy), coalesce(r.sort, t.sort), case when t.parent_id is not null then t.sort else -1 end, t.id collate "C") as ord
    from kafaa_national_tags t left join kafaa_national_tags r on r.id = t.parent_id where t.status = 'active'
  ),
  s as (select t.* from t where case when v_tag.id is not null then (t.id = v_tag.id or coalesce(t.parent_id = v_tag.id, false)) when v_strategy is not null then t.strategy = v_strategy else true end),
  e as (
    select x ->> 'tag_id' as tag_id, x ->> 'target_table' as target_table, x ->> 'target_id' as target_id, x ->> 'basis' as basis, x ->> 'link_id' as link_id,
      x ->> 'note_en' as note_en, x ->> 'note_ar' as note_ar,
      case when x ->> 'target_table' in ('skills', 'cec_competences') then 'skill' when x ->> 'target_table' in ('critical_skills', 'ai_org_targets', 'cec_role_targets', 'wallet_targets') then 'target' else 'programme' end as ikind
    from jsonb_array_elements(v_eff) x
  ),
  i as (
    select e.*, s.ord, s.strategy, s.name_en as tag_en, s.name_ar as tag_ar, s.future_group, tv.v,
      case when not (tv.v ->> 'exists')::boolean then 'missing' when (tv.v ->> 'active')::boolean then 'active' else 'inactive' end as status
    from e join s on s.id = e.tag_id cross join lateral (select kafaa_na_target(e.target_table, e.target_id) as v) tv
    where v_kind is null or e.ikind = v_kind
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'tag_id', tag_id, 'strategy', strategy, 'target_table', target_table, 'kind', ikind, 'target_id', target_id, 'basis', basis, 'link_id', link_id,
      'title_en', v ->> 'title_en', 'title_ar', v ->> 'title_ar', 'status', status, 'note_en', note_en, 'note_ar', note_ar,
      'measure', case when p_measures and (v ->> 'exists')::boolean then kafaa_na_measure(target_table, target_id) end,
      'reasons', case basis
          when 'curated' then jsonb_build_array(jsonb_build_object('code', 'na_curated', 'key', 'm37.reason.curated', 'vars', jsonb_build_object('tag', jsonb_build_object('en', tag_en, 'ar', tag_ar)),
            'ref', jsonb_build_object('table', 'tag_links', 'id', coalesce(link_id, ''))))
          when 'future_group' then jsonb_build_array(jsonb_build_object('code', 'na_future_group', 'key', 'm37.reason.futureGroup', 'vars', jsonb_build_object('group', kafaa_na_group_name(future_group)),
            'ref', jsonb_build_object('table', 'skills', 'id', target_id)))
          else jsonb_build_array(jsonb_build_object('code', 'na_net_zero', 'key', 'm37.reason.netZero', 'ref', jsonb_build_object('table', 'cec_competences', 'id', target_id))) end
        || case status when 'inactive' then jsonb_build_array(jsonb_build_object('code', 'na_inactive', 'key', 'm37.reason.inactive'))
          when 'missing' then jsonb_build_array(jsonb_build_object('code', 'na_missing', 'key', 'm37.reason.missing')) else '[]'::jsonb end)
    order by ord, array_position(array['skill', 'programme', 'target'], ikind), array_position(c_tables, target_table), target_id collate "C"), '[]'::jsonb)
  into v_items from i;

  return jsonb_build_object('filter', v_filter, 'measures', p_measures, 'tags', v_tags, 'items', v_items);
end $$;
