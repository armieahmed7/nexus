-- [FS wave G · E5 · fsGe5] FS68 Supplier future-skills readiness + FS69 Contractor pre-arrival check with selective disclosure (M09).
--   FS68  kafaa_supplier_future_readiness(): contractor coverage (F33 passports, people of kind contractor) of the FS05 2030 versions of
--         the ENEC role profiles each supplier is contracted to staff (F33 kafaa_contract_role_targets), grouped as digital, AI literacy,
--         cyber hygiene and other future skills; organisations with fewer than 10 contractors return no counts (suppressed); course
--         suggestions from the F33 engine (kafaa_course_alignment, reason codes academy_course / enec_course / closes_gap). Read only.
--   FS69  kafaa_prearrival_shares: an FS32 share link (kafaa_record_shares) plus the qualification standard and mobilisation date; the
--         F33 pre-check runs against the shared skill items only (kafaa_precheck_from_share) and writes no skill evidence, no skill state,
--         no qualification record and no equivalency status. Contractors hold no Kafa'a grant on the live backend, so an ENEC evaluator
--         (equivalency A) may record a share on the contractor's behalf with the reference of the contractor's signed consent (the FS29
--         precedent); the contractor creates their own share where they can sign in (own_profile Own).
-- Shared writes, only inside these SECURITY DEFINER functions: kafaa_record_shares (FS32, M17) rows behind a pre-arrival share and their
-- revocation; kafaa_notifications (kind prearrival) when a share is recorded on behalf.
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects and never removes any object or row.
-- Rules: src/modules/m09/futureReadiness.ts, src/modules/m09/prearrival.ts. LocalBackend: src/modules/m09/backend/local.fs75.ts.
-- PGlite checks: scripts/validate/fs75-supplier-readiness.mjs.

-- @@PART1@@ ───────────── Table (generated DDL) + RLS in the per-statement form
-- M09 · Contractor pre-arrival shares: an FS32 share link checked against a qualification standard before mobilisation (FS69)
create table if not exists kafaa_prearrival_shares (
  id text primary key,
  share_id text not null unique,
  person_id text not null,
  org_id text not null,
  standard_id text not null,
  mobilise_on date not null,
  created_via text not null check (created_via in ('self', 'on_behalf')),
  created_by text not null,
  consent_ref text not null default '',
  note text not null default '',
  checked_by text,
  checked_at timestamptz,
  check_summary jsonb,
  created_at timestamptz not null default now()
);
comment on table kafaa_prearrival_shares is '[M09] Contractor pre-arrival shares: an FS32 share link checked against a qualification standard before mobilisation (FS69)';
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_prearrival_shares_share_id_fk') then alter table kafaa_prearrival_shares add constraint kafaa_prearrival_shares_share_id_fk foreign key (share_id) references kafaa_record_shares(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_prearrival_shares_person_id_fk') then alter table kafaa_prearrival_shares add constraint kafaa_prearrival_shares_person_id_fk foreign key (person_id) references kafaa_people(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_prearrival_shares_org_id_fk') then alter table kafaa_prearrival_shares add constraint kafaa_prearrival_shares_org_id_fk foreign key (org_id) references kafaa_organisations(id) deferrable initially deferred; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'kafaa_prearrival_shares_standard_id_fk') then alter table kafaa_prearrival_shares add constraint kafaa_prearrival_shares_standard_id_fk foreign key (standard_id) references kafaa_qual_standards(id) deferrable initially deferred; end if; end $$;
create index if not exists kafaa_prearrival_shares_person_id_idx on kafaa_prearrival_shares (person_id);
create index if not exists kafaa_prearrival_shares_org_id_idx on kafaa_prearrival_shares (org_id);
create index if not exists kafaa_prearrival_shares_standard_id_idx on kafaa_prearrival_shares (standard_id);
alter table kafaa_prearrival_shares enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kafaa_prearrival_shares' and policyname = 'kafaa_read') then
    create policy kafaa_read on kafaa_prearrival_shares for select to anon, authenticated using (false);
  end if;
end $$;
-- The contractor (own_profile Own), their partner admin (equivalency OwnOrg/OrgW on the organisation), ENEC evaluators and auditors (equivalency R/W/A).
alter policy kafaa_read on kafaa_prearrival_shares using (((SELECT kafaa_has_grant('own_profile'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((person_id = (SELECT kafaa_me())) AND (SELECT kafaa_has_grant('own_profile'::text, ARRAY['Own'::text, 'Scope'::text]))) OR ((SELECT kafaa_has_grant('own_profile'::text, ARRAY['Scope'::text])) AND kafaa_rule_read('own_profile'::text, person_id, NULL::text, false))
  OR ((SELECT kafaa_has_grant('equivalency'::text, ARRAY['R'::text, 'W'::text, 'A'::text]))) OR ((org_id = (SELECT kafaa_my_org())) AND (SELECT kafaa_has_grant('equivalency'::text, ARRAY['OwnOrg'::text, 'OrgW'::text]))));
grant select on kafaa_prearrival_shares to anon, authenticated;
revoke insert, update on kafaa_prearrival_shares from anon, authenticated;

-- @@PART2@@ ───────────── FS68 rules (mirror of futureReadiness.ts)
create or replace function kafaa_fr_pct(a integer, b integer) returns integer language sql immutable set search_path = public as $$
  select case when coalesce(b, 0) > 0 then (200 * a + b) / (2 * b) else 0 end
$$;
-- The future-skill group of a requirement (TS frGroupOf).
create or replace function kafaa_fr_group(p_kind text, p_ref text) returns text language sql stable security definer set search_path = public as $$
  select case
    when p_kind = 'competency' then case p_ref when 'da-02' then 'ai_literacy' when 'da-01' then 'digital' else 'other_future' end
    when s.id is null then 'other_future'
    when s.fs_area = 'cyber_hygiene' then 'cyber_hygiene'
    when s.fs_area = 'ai_data' or s.competency_id = 'da-02' then 'ai_literacy'
    when s.area = 'digital' or s.fs_area = 'digital_plant' or s.competency_id = 'da-01' then 'digital'
    else 'other_future' end
  from (select 1) one left join kafaa_skills s on s.id = p_ref
$$;
-- met / bridge / fresh for one contractor and one requirement (TS statusOf over active, recorded, non-security states).
create or replace function kafaa_fr_status(p_person text, p_kind text, p_ref text, p_need integer) returns text language sql stable security definer set search_path = public as $$
  with st as (
    select ps.skill_id, ps.level, k.competency_id, k.core
    from kafaa_person_skills ps join kafaa_skills k on k.id = ps.skill_id left join kafaa_competencies c on c.id = k.competency_id
    where ps.person_id = p_person and ps.active is not false and ps.level > 0 and ps.basis <> 'claimed' and k.area <> 'security' and coalesce(c.domain, '') <> 'security'
  ), hv as (
    select case when p_kind = 'skill' then coalesce((select max(level) from st where skill_id = p_ref), 0)
      else coalesce(case when exists (select 1 from st where competency_id = p_ref and core) then (select max(level) from st where competency_id = p_ref and core)
        else (select max(level) from st where competency_id = p_ref) end, 0) end as h
  )
  select case when h >= p_need then 'met'
    when h > 0 and h = p_need - 1 then 'bridge'
    when p_kind = 'skill' and exists (select 1 from st join kafaa_skills r on r.id = p_ref
      where st.skill_id <> p_ref and st.level >= 2 and (st.skill_id = any(coalesce(r.adjacent_ids, '{}'::text[])) or st.competency_id = r.competency_id)) then 'bridge'
    else 'fresh' end
  from hv
$$;
-- The newest published profile of a role for a horizon.
create or replace function kafaa_fr_profile(p_role text, p_horizon text) returns kafaa_role_profile_versions language sql stable security definer set search_path = public as $$
  select v.* from kafaa_role_profile_versions v where v.role_id = p_role and v.horizon = p_horizon and v.status = 'published'
  order by v.version desc, v.id collate "C" limit 1
$$;
create or replace function kafaa_fr_reason(p_code text, p_vars jsonb default null, p_table text default null, p_id text default null) returns jsonb
language sql immutable set search_path = public as $$
  select jsonb_build_object('code', p_code, 'key', 'm09.reasons.' || p_code)
    || case when p_vars is null then '{}'::jsonb else jsonb_build_object('vars', p_vars) end
    || case when p_table is null then '{}'::jsonb else jsonb_build_object('ref', jsonb_build_object('table', p_table, 'id', p_id)) end
$$;
-- The readiness of the listed organisations (p_orgs null = every supplier organisation with contractors or contracted roles). TS supplierFutureReadiness.
create or replace function kafaa_fr_compute(p_orgs text[]) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_out jsonb := '[]'::jsonb; o record; t record; r record; c record;
  v_people text[]; v_n integer; v_supp boolean; v_roles jsonb; v_future jsonb; v_reasons jsonb; v_gap jsonb; v_groups jsonb; v_grp jsonb := '{}'::jsonb;
  p30 kafaa_role_profile_versions; pnow kafaa_role_profile_versions; v_title jsonb; v_name jsonb; v_group text; v_st text;
  v_met integer; v_bridge integer; v_rmet integer; v_rbridge integer; v_tmet integer; v_today integer; v_fut integer; v_futmet integer; v_futall integer;
  v_sugg jsonb; v_covers jsonb; v_score numeric; v_acad text[]; v_gaps jsonb; v_w integer; g text; v_pid text;
begin
  for o in
    select og.* from kafaa_organisations og where og.kind = 'supplier'
      and (exists (select 1 from kafaa_people p where p.org_id = og.id and p.kind = 'contractor' and p.status = 'active')
        or exists (select 1 from kafaa_contract_role_targets x where x.org_id = og.id and x.active))
      and (p_orgs is null or og.id = any(p_orgs))
    order by og.id collate "C"
  loop
    select coalesce(array_agg(p.id order by p.id collate "C"), '{}'::text[]) into v_people from kafaa_people p where p.org_id = o.id and p.kind = 'contractor' and p.status = 'active';
    v_n := coalesce(array_length(v_people, 1), 0);
    v_supp := v_n < 10;
    v_roles := '[]'::jsonb; v_gap := '{}'::jsonb; v_grp := '{}'::jsonb; v_futmet := 0; v_futall := 0;
    for t in
      select x.*, jr.title_en, jr.title_ar from kafaa_contract_role_targets x left join kafaa_job_roles jr on jr.id = x.role_id
      where x.org_id = o.id and x.active order by coalesce(jr.sort, 0), x.role_id collate "C"
    loop
      p30 := kafaa_fr_profile(t.role_id, '2030');
      pnow := kafaa_fr_profile(t.role_id, 'now');
      v_title := jsonb_build_object('en', coalesce(t.title_en, t.role_id), 'ar', coalesce(t.title_ar, t.role_id));
      v_future := '[]'::jsonb; v_reasons := '[]'::jsonb; v_rmet := 0; v_rbridge := 0; v_tmet := 0; v_today := 0; v_fut := 0;
      for r in
        with nowr as (
          select e ->> 'kind' as kind, e ->> 'ref_id' as ref_id, max((e ->> 'level')::integer) as lvl
          from jsonb_array_elements(case when jsonb_typeof(pnow.requirements) = 'array' then pnow.requirements else '[]'::jsonb end) e group by 1, 2
        )
        select e ->> 'kind' as kind, e ->> 'ref_id' as ref_id, (e ->> 'level')::integer as lvl, coalesce(e ->> 'importance', 'useful') as importance,
          nullif(e ->> 'driver', '') as driver, n.lvl as now_lvl, (n.lvl is null or (e ->> 'level')::integer > n.lvl) as future
        from jsonb_array_elements(case when jsonb_typeof(p30.requirements) = 'array' then p30.requirements else '[]'::jsonb end) with ordinality q(e, ord)
        left join nowr n on n.kind = e ->> 'kind' and n.ref_id = e ->> 'ref_id'
        where e ->> 'kind' in ('skill', 'competency')
          and case when e ->> 'kind' = 'competency' then not exists (select 1 from kafaa_competencies k where k.id = e ->> 'ref_id' and k.domain = 'security')
            else exists (select 1 from kafaa_skills s left join kafaa_competencies k on k.id = s.competency_id where s.id = e ->> 'ref_id' and s.area <> 'security' and coalesce(k.domain, '') <> 'security') end
        order by q.ord
      loop
        if not r.future then
          v_today := v_today + 1;
          foreach v_pid in array v_people loop if kafaa_fr_status(v_pid, r.kind, r.ref_id, r.lvl) = 'met' then v_tmet := v_tmet + 1; end if; end loop;
          continue;
        end if;
        v_fut := v_fut + 1; v_met := 0; v_bridge := 0;
        foreach v_pid in array v_people loop
          v_st := kafaa_fr_status(v_pid, r.kind, r.ref_id, r.lvl);
          if v_st = 'met' then v_met := v_met + 1; elsif v_st = 'bridge' then v_bridge := v_bridge + 1; end if;
        end loop;
        v_group := kafaa_fr_group(r.kind, r.ref_id);
        v_rmet := v_rmet + v_met; v_rbridge := v_rbridge + v_bridge;
        v_grp := v_grp || jsonb_build_object(v_group, jsonb_build_object(
          'reqs', coalesce((v_grp #>> array[v_group, 'reqs'])::integer, 0) + 1,
          'met', coalesce((v_grp #>> array[v_group, 'met'])::integer, 0) + v_met,
          'bridge', coalesce((v_grp #>> array[v_group, 'bridge'])::integer, 0) + v_bridge));
        if r.kind = 'skill' then
          select jsonb_build_object('en', coalesce(s.name_en, r.ref_id), 'ar', coalesce(s.name_ar, r.ref_id)) into v_name from (select 1) one left join kafaa_skills s on s.id = r.ref_id;
        else
          select jsonb_build_object('en', btrim(coalesce(k.code, r.ref_id) || ' ' || coalesce(k.name_en, '')), 'ar', btrim(coalesce(k.code, r.ref_id) || ' ' || coalesce(k.name_ar, ''))) into v_name
          from (select 1) one left join kafaa_competencies k on k.id = r.ref_id;
        end if;
        v_future := v_future || jsonb_build_array(jsonb_build_object('kind', r.kind, 'ref_id', r.ref_id, 'level', r.lvl, 'now_level', r.now_lvl, 'importance', r.importance,
          'driver', r.driver, 'group', v_group, 'name', v_name,
          'met', case when v_supp then null else v_met end, 'bridge', case when v_supp then null else v_bridge end,
          'fresh', case when v_supp then null else v_n - v_met - v_bridge end, 'pct', case when v_supp then null else kafaa_fr_pct(v_met, v_n) end));
        if v_supp or v_met < v_n then
          v_w := case r.importance when 'core' then 3 when 'important' then 2 when 'useful' then 1 else 1 end;
          for c in select s.id from kafaa_skills s where (r.kind = 'skill' and s.id = r.ref_id) or (r.kind = 'competency' and s.core and s.competency_id = r.ref_id) loop
            v_gap := v_gap || jsonb_build_object(c.id, greatest(coalesce((v_gap ->> c.id)::integer, 0), v_w));
          end loop;
        end if;
        v_reasons := v_reasons || jsonb_build_array(case when v_supp then kafaa_fr_reason('fr_req_suppressed', jsonb_build_object('skill', v_name, 'need', r.lvl))
          else kafaa_fr_reason(case when v_met = v_n then 'fr_req_met' when v_bridge > 0 then 'fr_req_bridge' else 'fr_req_new' end,
            jsonb_build_object('skill', v_name, 'need', r.lvl, 'met', v_met, 'bridge', v_bridge, 'n', v_n), case when r.kind = 'skill' then 'skills' else 'competencies' end, r.ref_id) end);
      end loop;
      v_futmet := v_futmet + v_rmet; v_futall := v_futall + v_fut * v_n;
      if v_fut = 0 then v_reasons := v_reasons || jsonb_build_array(kafaa_fr_reason('fr_no_future', jsonb_build_object('role', v_title))); end if;
      if p30.id is null then v_reasons := jsonb_build_array(kafaa_fr_reason('fr_no_profile', jsonb_build_object('role', v_title))) || v_reasons; end if;
      v_roles := v_roles || jsonb_build_array(jsonb_build_object('role_id', t.role_id, 'title', v_title, 'band', t.headcount_band, 'profile_id', p30.id, 'version', p30.version,
        'now_profile_id', pnow.id, 'today_total', v_today, 'today_pct', case when v_supp then null else kafaa_fr_pct(v_tmet, v_today * v_n) end, 'future', v_future,
        'future_pct', case when v_supp then null else kafaa_fr_pct(v_rmet, v_fut * v_n) end, 'bridge_pct', case when v_supp then null else kafaa_fr_pct(v_rbridge, v_fut * v_n) end,
        'reasons', v_reasons));
    end loop;
    v_groups := '[]'::jsonb;
    foreach g in array array['digital', 'ai_literacy', 'cyber_hygiene', 'other_future'] loop
      v_groups := v_groups || jsonb_build_array(jsonb_build_object('group', g, 'reqs', coalesce((v_grp #>> array[g, 'reqs'])::integer, 0),
        'pct', case when v_supp or coalesce((v_grp #>> array[g, 'reqs'])::integer, 0) = 0 then null else kafaa_fr_pct((v_grp #>> array[g, 'met'])::integer, (v_grp #>> array[g, 'reqs'])::integer * v_n) end,
        'bridge_pct', case when v_supp or coalesce((v_grp #>> array[g, 'reqs'])::integer, 0) = 0 then null else kafaa_fr_pct((v_grp #>> array[g, 'bridge'])::integer, (v_grp #>> array[g, 'reqs'])::integer * v_n) end));
    end loop;
    -- course suggestions (F33 engine), supplier academy first on ties
    v_sugg := '[]'::jsonb;
    for c in
      select co.* from kafaa_courses co
      where co.programme_id = any(array['supplier-academy', 'get', 'hu-core', 'maint-init', 'maint-cont', 'rp-init', 'rp-cont', 'chem-init', 'chem-cont', 'eng-init', 'eng-cont', 'ero', 'pg-fs-pack'])
        and not exists (select 1 from kafaa_competencies k where k.id = any(co.competency_ids) and k.domain = 'security')
    loop
      select coalesce(jsonb_agg(jsonb_build_object('id', al.id, 'en', al.name_en, 'ar', al.name_ar) order by al.sort, al.id collate "C"), '[]'::jsonb), coalesce(sum((v_gap ->> al.id)::integer), 0)
        into v_covers, v_score from kafaa_course_alignment(c.id) al where v_gap ? al.id;
      if jsonb_array_length(v_covers) = 0 then continue; end if;
      v_score := v_score + case when c.audience = 'supplier' then 0.5 else 0 end;
      v_sugg := v_sugg || jsonb_build_array(jsonb_build_object('id', c.id, 'score', v_score, 'reasons',
        jsonb_build_array(kafaa_fr_reason(case when c.audience = 'supplier' then 'academy_course' else 'enec_course' end,
          jsonb_build_object('code', jsonb_build_object('en', coalesce(c.code, ''), 'ar', coalesce(c.code, ''))), 'courses', c.id))
        || coalesce((select jsonb_agg(kafaa_fr_reason('closes_gap', jsonb_build_object('skill', jsonb_build_object('en', x ->> 'en', 'ar', x ->> 'ar')), 'skills', x ->> 'id') order by n)
                     from jsonb_array_elements(v_covers) with ordinality as e(x, n)), '[]'::jsonb),
        'code', coalesce(c.code, ''), 'title', jsonb_build_object('en', coalesce(c.title_en, ''), 'ar', coalesce(c.title_ar, '')), 'audience', coalesce(c.audience, ''), 'hours', c.duration_hours));
    end loop;
    select coalesce(jsonb_agg(s order by (s ->> 'score')::numeric desc, s ->> 'id' collate "C"), '[]'::jsonb) into v_sugg
      from (select s from jsonb_array_elements(v_sugg) s order by (s ->> 'score')::numeric desc, s ->> 'id' collate "C" limit 4) x;
    -- gap skills no supplier academy course evidences
    select coalesce(array_agg(distinct al.id), '{}'::text[]) into v_acad from kafaa_courses co cross join lateral kafaa_course_alignment(co.id) al
      where co.programme_id = 'supplier-academy' and not exists (select 1 from kafaa_competencies k where k.id = any(co.competency_ids) and k.domain = 'security');
    select coalesce(jsonb_agg(jsonb_build_object('skill_id', k.key, 'name', jsonb_build_object('en', coalesce(s.name_en, k.key), 'ar', coalesce(s.name_ar, k.key))) order by k.key collate "C"), '[]'::jsonb)
      into v_gaps from jsonb_object_keys(v_gap) k(key) left join kafaa_skills s on s.id = k.key where not k.key = any(v_acad);
    v_out := v_out || jsonb_build_array(jsonb_build_object('org_id', o.id, 'name', jsonb_build_object('en', coalesce(o.name_en, o.id), 'ar', coalesce(o.name_ar, o.name_en, o.id)),
      'n', case when v_supp then null else v_n end, 'suppressed', v_supp, 'roles', v_roles, 'groups', v_groups,
      'future_pct', case when v_supp then null else kafaa_fr_pct(v_futmet, v_futall) end, 'suggestions', v_sugg, 'academy_gaps', v_gaps));
  end loop;
  return v_out;
end $$;
-- Read: partner_org OwnOrg/OrgW = own organisation; equivalency A/R or partner_org A/R = every supplier organisation.
create or replace function kafaa_supplier_future_readiness() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_org text;
begin
  if kafaa_me() is null then return jsonb_build_object('allowed', false, 'scope', 'none', 'min_group', 10, 'orgs', '[]'::jsonb); end if;
  if kafaa_has_grant('equivalency', array['A', 'R']) or kafaa_has_grant('partner_org', array['A', 'R']) then
    return jsonb_build_object('allowed', true, 'scope', 'all', 'min_group', 10, 'orgs', kafaa_fr_compute(null));
  end if;
  if kafaa_has_grant('partner_org', array['OwnOrg', 'OrgW']) then
    v_org := kafaa_my_org();
    return jsonb_build_object('allowed', true, 'scope', 'own', 'min_group', 10, 'orgs', case when v_org is null then '[]'::jsonb else kafaa_fr_compute(array[v_org]) end);
  end if;
  return jsonb_build_object('allowed', false, 'scope', 'none', 'min_group', 10, 'orgs', '[]'::jsonb);
end $$;

-- @@PART3@@ ───────────── FS69 rules (mirror of prearrival.ts)
-- Share view of an FS32 link today: revoked, expired (after its expiry day) or active.
create or replace function kafaa_pa_view(s kafaa_record_shares, p_today date) returns text language sql immutable set search_path = public as $$
  select case when s.revoked_at is not null then 'revoked' when s.expires_on < p_today then 'expired' else 'active' end
$$;
-- Input check (TS prearrivalProblem): FS32 share rules, the consent reference when on behalf, then the mobilisation date.
create or replace function kafaa_pa_problem(p jsonb, p_person text, p_today date, p_on_behalf boolean) returns text language plpgsql stable security definer set search_path = public as $$
declare v text := kafaa_lr_share_problem(p, p_person, p_today); v_ref integer;
begin
  if v <> 'ok' then return v; end if;
  if p_on_behalf then
    v_ref := case when jsonb_typeof(p -> 'consent_ref') = 'string' then length(btrim(p ->> 'consent_ref', E' \t\n\r')) else 0 end;
    if v_ref < 3 or v_ref > 80 then return 'consent_ref'; end if;
  end if;
  if jsonb_typeof(p -> 'mobilise_on') is distinct from 'string' or not kafaa_w5_is_date(p ->> 'mobilise_on') then return 'mobilise'; end if;
  if (p ->> 'mobilise_on')::date < p_today or (p ->> 'mobilise_on')::date > (p ->> 'expires_on')::date then return 'mobilise'; end if;
  return 'ok';
end $$;
-- The shared items still shareable today, in record order (TS sharedItems over kafaa_lr_items).
create or replace function kafaa_pa_shared(p_person text, p_refs text[], p_today date) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(e order by o), '[]'::jsonb) from jsonb_array_elements(kafaa_lr_items(p_person, p_today)) with ordinality x(e, o) where e ->> 'ref' = any(coalesce(p_refs, '{}'::text[]))
$$;
-- The F33 pre-check against supplied states (the shared skills) and no prior requests: kafaa_cp_precheck_compute with the states from
-- p_states (TS precheck with requests = []).
create or replace function kafaa_pa_precheck_compute(p_person text, p_std text, p_states jsonb) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  t record; l record; c record;
  v_tasks jsonb := '[]'::jsonb; v_links jsonb; v_reasons jsonb; v_gap jsonb := '{}'::jsonb; v_sugg jsonb := '[]'::jsonb; v_covers jsonb;
  v_total integer := 0; v_likely integer := 0; v_partial integer := 0; v_crit integer := 0; v_n integer; v_none integer; v_first text;
  v_have integer; v_basis text; v_state text; v_status text; v_score numeric;
  v_programmes text[] := array['supplier-academy', 'get', 'hu-core', 'maint-init', 'maint-cont', 'rp-init', 'rp-cont', 'chem-init', 'chem-cont', 'eng-init', 'eng-cont', 'ero'];
begin
  for t in select * from kafaa_task_items ti where ti.standard_id = p_std order by ti.sort, ti.id collate "C" loop
    v_links := '[]'::jsonb; v_reasons := '[]'::jsonb; v_n := 0; v_none := 0; v_first := null;
    for l in
      select tl.skill_id, tl.need_level, s.name_en, s.name_ar, (st ->> 'level')::integer as have_level, st ->> 'basis' as have_basis
      from kafaa_task_skill_links tl join kafaa_skills s on s.id = tl.skill_id join kafaa_competencies k on k.id = s.competency_id
      left join lateral (select x as st from jsonb_array_elements(case when jsonb_typeof(p_states) = 'array' then p_states else '[]'::jsonb end) with ordinality q(x, o)
        where x ->> 'skill_id' = tl.skill_id order by o desc limit 1) ss on true
      where tl.task_id = t.id and s.area <> 'security' and k.domain <> 'security'
      order by tl.sort, tl.skill_id collate "C"
    loop
      v_have := coalesce(l.have_level, 0);
      v_basis := case when l.have_level is not null and l.have_level > 0 then l.have_basis else 'none' end;
      v_state := case when v_have >= l.need_level then (case when v_basis = 'claimed' then 'claimed' else 'strong' end)
                      when v_have > 0 and v_have = l.need_level - 1 then 'near' else 'none' end;
      v_n := v_n + 1;
      if v_n = 1 then v_first := v_state; end if;
      if v_state = 'none' then v_none := v_none + 1; end if;
      v_links := v_links || jsonb_build_array(jsonb_build_object('skill_id', l.skill_id, 'need', l.need_level, 'have', v_have, 'basis', v_basis, 'state', v_state));
      v_reasons := v_reasons || jsonb_build_array(kafaa_cp_reason('link_' || v_state,
        jsonb_build_object('skill', jsonb_build_object('en', l.name_en, 'ar', l.name_ar), 'have', v_have, 'need', l.need_level), 'skills', l.skill_id));
    end loop;
    if v_n = 0 then v_reasons := v_reasons || jsonb_build_array(kafaa_cp_reason('no_link')); end if;
    v_status := case when v_n > 0 and v_first = 'strong' and v_none = 0 then 'likely' when v_n > v_none then 'partial' else 'gap' end;
    if v_status <> 'likely' then
      select v_gap || coalesce(jsonb_object_agg(x.skill_id, greatest(coalesce((v_gap ->> x.skill_id)::integer, 0), x.w)), '{}'::jsonb) into v_gap
      from (select e.v ->> 'skill_id' as skill_id, max(case when e.n = 1 then 2 else 1 end) as w
            from jsonb_array_elements(v_links) with ordinality as e(v, n) where e.v ->> 'state' <> 'strong' group by e.v ->> 'skill_id') x;
    end if;
    v_total := v_total + 1;
    if v_status = 'likely' then v_likely := v_likely + 1; elsif v_status = 'partial' then v_partial := v_partial + 1; end if;
    if t.critical is true and v_status = 'gap' then v_crit := v_crit + 1; end if;
    v_tasks := v_tasks || jsonb_build_array(jsonb_build_object('task_id', t.id, 'critical', t.critical is true, 'status', v_status, 'prior', false, 'links', v_links, 'reasons', v_reasons));
  end loop;
  for c in
    select co.* from kafaa_courses co where co.programme_id = any(v_programmes)
      and not exists (select 1 from kafaa_competencies k where k.id = any(co.competency_ids) and k.domain = 'security')
  loop
    select coalesce(jsonb_agg(jsonb_build_object('id', al.id, 'en', al.name_en, 'ar', al.name_ar) order by al.sort, al.id collate "C"), '[]'::jsonb), coalesce(sum((v_gap ->> al.id)::integer), 0)
      into v_covers, v_score from kafaa_course_alignment(c.id) al where v_gap ? al.id;
    if jsonb_array_length(v_covers) = 0 then continue; end if;
    v_score := v_score + case when c.audience = 'supplier' then 0.5 else 0 end;
    v_sugg := v_sugg || jsonb_build_array(jsonb_build_object('id', c.id, 'score', v_score, 'reasons',
      jsonb_build_array(kafaa_cp_reason(case when c.audience = 'supplier' then 'academy_course' else 'enec_course' end,
        jsonb_build_object('code', jsonb_build_object('en', coalesce(c.code, ''), 'ar', coalesce(c.code, ''))), 'courses', c.id))
      || coalesce((select jsonb_agg(kafaa_cp_reason('closes_gap', jsonb_build_object('skill', jsonb_build_object('en', x ->> 'en', 'ar', x ->> 'ar')), 'skills', x ->> 'id') order by n)
                   from jsonb_array_elements(v_covers) with ordinality as e(x, n)), '[]'::jsonb)));
  end loop;
  select coalesce(jsonb_agg(s order by (s ->> 'score')::numeric desc, s ->> 'id' collate "C"), '[]'::jsonb) into v_sugg
    from (select s from jsonb_array_elements(v_sugg) s order by (s ->> 'score')::numeric desc, s ->> 'id' collate "C" limit 4) x;
  return jsonb_build_object(
    'person_id', p_person, 'standard_id', p_std, 'total', v_total, 'likely', v_likely, 'partial', v_partial, 'gaps', v_total - v_likely - v_partial,
    'critical_gaps', v_crit, 'coverage', case when v_total > 0 then ((2 * v_likely + v_partial) * 100 + v_total) / (2 * v_total) else 0 end,
    'outlook', case when v_total > 0 and v_likely = v_total then 'likely_equivalent' when v_crit > 0 then 'training_likely' else 'review' end,
    'open_request_id', null, 'equivalent_request_id', null, 'prior_request_id', null, 'tasks', v_tasks, 'suggestions', v_sugg);
end $$;
-- The pre-check from a share's shared items (TS precheckFromShare): states from the shared skill items only.
create or replace function kafaa_pa_check(p_share text, p_person text, p_shared jsonb, p_std text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_states jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('person_id', p_person, 'skill_id', e ->> 'id', 'level', coalesce((e ->> 'level')::integer, 0), 'basis', e ->> 'status', 'active', true) order by o), '[]'::jsonb)
    into v_states from jsonb_array_elements(p_shared) with ordinality x(e, o) where e ->> 'kind' = 'skill';
  return kafaa_pa_precheck_compute(p_person, p_std, v_states) || jsonb_build_object('share_id', p_share, 'shared', p_shared, 'skills_used', jsonb_array_length(v_states));
end $$;
create or replace function kafaa_pa_summary(p jsonb) returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object('standard_id', p -> 'standard_id', 'total', p -> 'total', 'likely', p -> 'likely', 'partial', p -> 'partial', 'gaps', p -> 'gaps',
    'critical_gaps', p -> 'critical_gaps', 'coverage', p -> 'coverage', 'outlook', p -> 'outlook', 'skills_used', p -> 'skills_used')
$$;
create or replace function kafaa_pa_ts(t timestamptz) returns text language sql immutable set search_path = public as $$
  select case when t is null then null else to_char(t at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') end
$$;
-- The list/detail view of one pre-arrival row (TS rowView).
create or replace function kafaa_pa_row(r kafaa_prearrival_shares, p_today date) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', r.id, 'share_id', r.share_id, 'person_id', r.person_id,
    'initials', coalesce(nullif(s.holder_initials, ''), nullif(p.initials, ''), '—'), 'org_id', r.org_id,
    'org_name_en', coalesce(o.name_en, r.org_id), 'org_name_ar', coalesce(o.name_ar, o.name_en, r.org_id), 'standard_id', r.standard_id, 'standard_code', coalesce(q.code, ''),
    'standard_title_en', coalesce(q.title_en, ''), 'standard_title_ar', coalesce(q.title_ar, ''), 'label', coalesce(s.label, ''), 'mobilise_on', to_char(r.mobilise_on, 'YYYY-MM-DD'),
    'expires_on', to_char(s.expires_on, 'YYYY-MM-DD'), 'status', kafaa_pa_view(s, p_today), 'created_via', r.created_via, 'created_at', kafaa_pa_ts(r.created_at),
    'item_count', coalesce(cardinality(s.items), 0), 'views', coalesce(s.views, 0), 'checked_at', kafaa_pa_ts(r.checked_at), 'check_summary', r.check_summary)
  from (select 1) one left join kafaa_record_shares s on s.id = r.share_id left join kafaa_people p on p.id = r.person_id
    left join kafaa_organisations o on o.id = r.org_id left join kafaa_qual_standards q on q.id = r.standard_id
$$;

-- @@PART4@@ ───────────── FS69 RPCs
-- Read: pre-arrival shares the caller may see (own; own organisation for a partner admin; all for evaluators and auditors). No items.
create or replace function kafaa_prearrival_shares() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); v_all boolean; v_org text;
begin
  if me is null then return '[]'::jsonb; end if;
  v_all := kafaa_has_grant('equivalency', array['A', 'R']);
  v_org := case when kafaa_has_grant('equivalency', array['OwnOrg', 'OrgW']) then kafaa_my_org() end;
  return coalesce((select jsonb_agg(v order by case v ->> 'status' when 'active' then 0 when 'expired' then 1 else 2 end, v ->> 'mobilise_on' collate "C", v ->> 'id' collate "C")
    from (select kafaa_pa_row(r, current_date) v from kafaa_prearrival_shares r where v_all or r.person_id = me or (v_org is not null and r.org_id = v_org)) x), '[]'::jsonb);
end $$;
-- Read: contractors an ENEC evaluator may record a share for (initials and organisation only).
create or replace function kafaa_prearrival_contractors() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if kafaa_me() is null or not kafaa_has_grant('equivalency', array['A']) then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'initials', coalesce(nullif(p.initials, ''), '—'), 'org_id', p.org_id, 'org_name_en', coalesce(o.name_en, p.org_id),
      'org_name_ar', coalesce(o.name_ar, o.name_en, p.org_id), 'job_role_id', p.job_role_id, 'ref', p.id) order by p.org_id collate "C", p.id collate "C")
    from kafaa_people p join kafaa_organisations o on o.id = p.org_id where p.kind = 'contractor' and p.status = 'active' and o.kind = 'supplier'), '[]'::jsonb);
end $$;
-- Read: the items a contractor may share (the contractor, or an evaluator recording the contractor's consent).
create or replace function kafaa_prearrival_items(p_person text default null) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); v_pid text; p kafaa_people; o kafaa_organisations;
begin
  if me is null then return jsonb_build_object('allowed', false, 'person', null, 'items', '[]'::jsonb); end if;
  v_pid := coalesce(nullif(btrim(coalesce(p_person, '')), ''), me);
  if (v_pid = me and kafaa_cp_org(me) is null) or (v_pid <> me and not (kafaa_has_grant('equivalency', array['A']) and kafaa_cp_org(v_pid) is not null)) then
    return jsonb_build_object('allowed', false, 'person', null, 'items', '[]'::jsonb);
  end if;
  select * into p from kafaa_people where id = v_pid;
  select * into o from kafaa_organisations where id = p.org_id;
  return jsonb_build_object('allowed', true, 'person', jsonb_build_object('id', v_pid, 'initials', coalesce(nullif(p.initials, ''), '—'), 'org_id', p.org_id,
    'org_name_en', coalesce(o.name_en, p.org_id), 'org_name_ar', coalesce(o.name_ar, o.name_en, p.org_id), 'job_role_id', p.job_role_id), 'items', kafaa_lr_items(v_pid, current_date));
end $$;
-- RPC: create a pre-arrival share (FS32 link + standard + mobilisation date). Self, or an evaluator on behalf with a consent reference. Ledger.
create or replace function kafaa_create_prearrival_share(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_pid text; v_behalf boolean; v_role text; q kafaa_qual_standards; v_chk text; v_share text; v_id text; v_token text; v_init text; v_ref text;
  v_exp text; v_mob text; v_n integer; v_at text; v_prev text; v_why text; a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('prearrival.share', 'prearrival_shares', null, 'not_signed_in', 'Sign in first'); end if;
  v_pid := coalesce(nullif(btrim(coalesce(p ->> 'person_id', '')), ''), me);
  v_behalf := v_pid <> me;
  if not v_behalf then
    v_role := kafaa_acting_role('own_profile', array['Own']);
    if kafaa_cp_org(me) is null or v_role is null then return kafaa_refuse('prearrival.share', 'prearrival_shares', null, 'forbidden', 'Pre-arrival shares are for contractor passports only', v_role); end if;
  else
    v_role := kafaa_acting_role('equivalency', array['A']);
    if v_role is null then return kafaa_refuse('prearrival.share', 'prearrival_shares', null, 'forbidden', 'Only the contractor, or an ENEC evaluator recording the contractor''s consent, can create a pre-arrival share'); end if;
    if kafaa_cp_org(v_pid) is null then return kafaa_refuse('prearrival.share', 'prearrival_shares', null, 'not_found', 'Pre-arrival shares are for contractor passports only', v_role); end if;
  end if;
  select * into q from kafaa_qual_standards where id = p ->> 'standard_id';
  if q.id is null or q.status <> 'current' then return kafaa_refuse('prearrival.share', 'prearrival_shares', null, 'not_found', 'Qualification standard not found', v_role); end if;
  if q.security_restricted then return kafaa_refuse('prearrival.share', 'prearrival_shares', null, 'invalid', 'Security qualifications are not handled through equivalency in Kafa''a', v_role); end if;
  v_chk := kafaa_pa_problem(p, v_pid, current_date, v_behalf);
  if v_chk <> 'ok' then
    return kafaa_refuse('prearrival.share', 'prearrival_shares', null, v_chk, case v_chk
      when 'consent_required' then 'Confirm all three consent steps before the link is created'
      when 'not_shareable' then 'Some items are not the contractor''s or cannot be shared (security and medical details never are)'
      when 'consent_ref' then 'Record the reference of the contractor''s signed consent (3 to 80 characters)'
      when 'mobilise' then 'Choose a mobilisation date from today to the link''s expiry date'
      else 'Choose 1 to 30 items, a label of 3 to 80 characters and an expiry between 1 and 90 days from today' end, v_role);
  end if;
  if (select count(*) from kafaa_record_shares s where s.person_id = v_pid and s.revoked_at is null and s.expires_on >= current_date) >= 10 then
    return kafaa_refuse('prearrival.share', 'prearrival_shares', null, 'too_many', 'Up to 10 active share links per person: revoke one first', v_role);
  end if;
  v_share := 'rs-' || kafaa_w5_hex(16);
  v_id := 'pa-' || kafaa_w5_hex(16);
  v_token := kafaa_w5_hex(32);
  v_ref := case when v_behalf then btrim(p ->> 'consent_ref', E' \t\n\r') else '' end;
  v_exp := p ->> 'expires_on'; v_mob := p ->> 'mobilise_on';
  v_n := jsonb_array_length(p -> 'items');
  v_at := to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  select coalesce(nullif(initials, ''), '—') into v_init from kafaa_people where id = v_pid;
  insert into kafaa_record_shares (id, person_id, token, label, items, holder_initials, consents, expires_on, created_at)
  values (v_share, v_pid, v_token, btrim(p ->> 'label', E' \t\n\r'), array(select jsonb_array_elements_text(p -> 'items')), coalesce(v_init, '—'),
    jsonb_build_object('items', true, 'preview', true, 'share', true, 'at', v_at, 'purpose', 'prearrival', 'on_behalf', v_behalf, 'recorded_by', case when v_behalf then me end,
      'consent_ref', nullif(v_ref, '')), v_exp::date, now());
  insert into kafaa_prearrival_shares (id, share_id, person_id, org_id, standard_id, mobilise_on, created_via, created_by, consent_ref, note, created_at)
  values (v_id, v_share, v_pid, kafaa_cp_org(v_pid), q.id, v_mob::date, case when v_behalf then 'on_behalf' else 'self' end, me, v_ref,
    left(btrim(coalesce(p ->> 'note', ''), E' \t\n\r'), 300), now());
  if v_behalf and not exists (select 1 from kafaa_notifications where id = 'nt-pa-' || v_id || '-created') then
    v_prev := current_setting('kafaa.seeding', true);
    perform set_config('kafaa.seeding', 'on', true);
    insert into kafaa_notifications (id, person_id, kind, title_en, title_ar, link, severity)
    values ('nt-pa-' || v_id || '-created', v_pid, 'prearrival', format('An ENEC evaluator recorded your pre-arrival share for %s (consent %s)', q.code, v_ref),
      format('سجّل مقيّم من مؤسسة الإمارات للطاقة النووية مشاركتك قبل الوصول لمعيار %s (الموافقة %s)', q.code, v_ref), '/partner/workforce/prearrival', 'info') on conflict (id) do nothing;
    perform set_config('kafaa.seeding', coalesce(v_prev, ''), true);
  end if;
  v_why := format('%s for %s: %s items until %s, mobilising %s', q.code, v_pid, v_n, v_exp, v_mob) || case when v_behalf then format(' (on behalf, consent %s)', v_ref) else '' end;
  l := kafaa_ledger('kafaa.prearrival.share', format('Pre-arrival share %s (%s items, until %s)', v_id, v_n, v_exp));
  a := kafaa_audit('prearrival.share', 'prearrival_shares', v_id, 'ok', v_why, case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Pre-arrival share created', a, l, jsonb_build_object('id', v_id, 'share_id', v_share, 'token', v_token, 'expires_on', v_exp));
end $$;
-- RPC: revoke (the contractor, or an evaluator on the contractor's request with a reason). Ledger.
create or replace function kafaa_revoke_prearrival_share(p_id text, p_reason text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_key text := btrim(coalesce(p_id, '')); r kafaa_prearrival_shares; s kafaa_record_shares; v_self boolean; v_role text;
  v_why text := left(btrim(coalesce(p_reason, ''), E' \t\n\r'), 300); a kafaa_audit_events; l integer;
begin
  if me is null then return kafaa_refuse('prearrival.revoke', 'prearrival_shares', nullif(v_key, ''), 'not_signed_in', 'Sign in first'); end if;
  select * into r from kafaa_prearrival_shares where id = v_key;
  v_self := r.id is not null and r.person_id = me;
  v_role := case when v_self then kafaa_acting_role('own_profile', array['Own']) else kafaa_acting_role('equivalency', array['A']) end;
  if r.id is null or v_role is null then return kafaa_refuse('prearrival.revoke', 'prearrival_shares', nullif(v_key, ''), 'not_found', 'Pre-arrival share not found', v_role); end if;
  select * into s from kafaa_record_shares where id = r.share_id;
  if s.id is null or kafaa_pa_view(s, current_date) <> 'active' then return kafaa_refuse('prearrival.revoke', 'prearrival_shares', r.id, 'already_closed', 'This link is already revoked or expired', v_role); end if;
  if not v_self and length(v_why) < 3 then return kafaa_refuse('prearrival.revoke', 'prearrival_shares', r.id, 'invalid', 'Give the contractor''s reason for revoking (3 to 300 characters)', v_role); end if;
  update kafaa_record_shares set revoked_at = now(), revoke_reason = nullif(v_why, '') where id = s.id;
  l := kafaa_ledger('kafaa.prearrival.revoke', format('Pre-arrival share %s revoked', r.id));
  a := kafaa_audit('prearrival.revoke', 'prearrival_shares', r.id, 'ok', coalesce(nullif(v_why, ''), 'revoked by the contractor'), case when l is null then 'skipped' else 'written' end, l, v_role);
  return kafaa_result(true, 'ok', 'Pre-arrival share revoked', a, l, jsonb_build_object('id', r.id));
end $$;
-- RPC (audited read): one share with the shared items only while the link is active (the contractor, evaluators, auditors).
create or replace function kafaa_prearrival_share(p_id text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_key text := btrim(coalesce(p_id, '')); r kafaa_prearrival_shares; s kafaa_record_shares; v_role text; v jsonb; v_items jsonb; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('prearrival.view', 'prearrival_shares', nullif(v_key, ''), 'not_signed_in', 'Sign in first'); end if;
  select * into r from kafaa_prearrival_shares where id = v_key;
  v_role := case when r.id is not null and r.person_id = me then kafaa_acting_role('own_profile', array['Own']) else kafaa_acting_role('equivalency', array['A', 'R']) end;
  if r.id is null or v_role is null then return kafaa_refuse('prearrival.view', 'prearrival_shares', nullif(v_key, ''), 'not_found', 'Pre-arrival share not found', v_role); end if;
  select * into s from kafaa_record_shares where id = r.share_id;
  v := kafaa_pa_row(r, current_date);
  v_items := case when v ->> 'status' = 'active' then kafaa_pa_shared(r.person_id, s.items, current_date) else '[]'::jsonb end;
  a := kafaa_audit('prearrival.view', 'prearrival_shares', r.id, 'ok', format('%s: %s shared items', v ->> 'status', jsonb_array_length(v_items)), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Pre-arrival share', a, null, v || jsonb_build_object('consent_ref', r.consent_ref, 'note', r.note, 'revoked_at', kafaa_pa_ts(s.revoked_at),
    'revoke_reason', s.revoke_reason, 'items', v_items));
end $$;
-- RPC: the F33 pre-check against the shared skills only (evaluators, equivalency A). Writes only the check summary on its own row
-- and an audit row: no skill evidence, no skill state, no qualification record, no equivalency status. No ledger.
create or replace function kafaa_precheck_from_share(p_id text, p_standard text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_key text := btrim(coalesce(p_id, '')); v_role text; r kafaa_prearrival_shares; s kafaa_record_shares; q kafaa_qual_standards; v_status text;
  v_res jsonb; a kafaa_audit_events;
begin
  if me is null then return kafaa_refuse('prearrival.precheck', 'prearrival_shares', nullif(v_key, ''), 'not_signed_in', 'Sign in first'); end if;
  v_role := kafaa_acting_role('equivalency', array['A']);
  if v_role is null then return kafaa_refuse('prearrival.precheck', 'prearrival_shares', nullif(v_key, ''), 'forbidden', 'Only an ENEC evaluator can run the pre-arrival check'); end if;
  select * into r from kafaa_prearrival_shares where id = v_key;
  if r.id is null then return kafaa_refuse('prearrival.precheck', 'prearrival_shares', nullif(v_key, ''), 'not_found', 'Pre-arrival share not found', v_role); end if;
  select * into s from kafaa_record_shares where id = r.share_id;
  v_status := case when s.id is null then 'expired' else kafaa_pa_view(s, current_date) end;
  if v_status = 'expired' then return kafaa_refuse('prearrival.precheck', 'prearrival_shares', r.id, 'expired', 'This link has expired: ask the contractor for a new share', v_role); end if;
  if v_status = 'revoked' then return kafaa_refuse('prearrival.precheck', 'prearrival_shares', r.id, 'revoked', 'The contractor revoked this link', v_role); end if;
  select * into q from kafaa_qual_standards where id = coalesce(nullif(btrim(coalesce(p_standard, '')), ''), r.standard_id);
  if q.id is null or q.status <> 'current' then return kafaa_refuse('prearrival.precheck', 'prearrival_shares', r.id, 'not_found', 'Qualification standard not found', v_role); end if;
  if q.security_restricted then return kafaa_refuse('prearrival.precheck', 'prearrival_shares', r.id, 'invalid', 'Security qualifications are not handled through equivalency in Kafa''a', v_role); end if;
  v_res := kafaa_pa_check(r.id, r.person_id, kafaa_pa_shared(r.person_id, s.items, current_date), q.id);
  update kafaa_prearrival_shares set checked_by = me, checked_at = now(), check_summary = kafaa_pa_summary(v_res) where id = r.id;
  a := kafaa_audit('prearrival.precheck', 'prearrival_shares', r.id, 'ok',
    format('%s: %s/%s likely from %s shared skills, outlook %s', q.code, v_res ->> 'likely', v_res ->> 'total', v_res ->> 'skills_used', v_res ->> 'outlook'), 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Pre-arrival check ready. It uses the shared items only and is guidance: an ENEC evaluator decides equivalency on arrival.', a, null, v_res);
end $$;

-- ───────────── Grants: internal helpers are not executable by API roles; RPCs by signed-in users only.
revoke execute on function kafaa_fr_pct(integer, integer), kafaa_fr_group(text, text), kafaa_fr_status(text, text, text, integer), kafaa_fr_profile(text, text),
  kafaa_fr_reason(text, jsonb, text, text), kafaa_fr_compute(text[]), kafaa_pa_view(kafaa_record_shares, date), kafaa_pa_problem(jsonb, text, date, boolean),
  kafaa_pa_shared(text, text[], date), kafaa_pa_precheck_compute(text, text, jsonb), kafaa_pa_check(text, text, jsonb, text), kafaa_pa_summary(jsonb), kafaa_pa_ts(timestamptz),
  kafaa_pa_row(kafaa_prearrival_shares, date) from public, anon, authenticated;
revoke execute on function kafaa_supplier_future_readiness(), kafaa_prearrival_shares(), kafaa_prearrival_contractors(), kafaa_prearrival_items(text),
  kafaa_create_prearrival_share(jsonb), kafaa_revoke_prearrival_share(text, text), kafaa_prearrival_share(text), kafaa_precheck_from_share(text, text) from public, anon;
grant execute on function kafaa_supplier_future_readiness(), kafaa_prearrival_shares(), kafaa_prearrival_contractors(), kafaa_prearrival_items(text),
  kafaa_create_prearrival_share(jsonb), kafaa_revoke_prearrival_share(text, text), kafaa_prearrival_share(text), kafaa_precheck_from_share(text, text) to authenticated;
