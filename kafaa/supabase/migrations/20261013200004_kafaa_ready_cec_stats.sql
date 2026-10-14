-- [Readiness fixes 2026-10-13 · finding 3] kafaa_cec_stats_core() in one pass over the data instead of one profile per staff member.
--
-- Before: the HR aggregate behind /workforce/clean-energy built kafaa_cec_profile() for each of the ~300 active staff (one PL/pgSQL call per
-- person x competence, three queries each, plus the reason texts the aggregate never reads): 1.6-1.8 s on an idle database, and HTTP 500
-- (statement timeout) under a few concurrent testers.
-- After: the same numbers from set-based CTEs. Per person and active competence the level is least(3, the highest level among the
-- person's active person_skills rows with level >= 1 and basis verified / evidenced / validated whose skill the competence lists)
-- (= kafaa_cec_comp); per area the highest competence level (= the area loop of kafaa_cec_profile); the person's level is
-- least(3, the four area levels); target = the level of the family's first kafaa_cec_role_targets row by id; status none / no_target /
-- met / below as in kafaa_cec_profile. The JSON shape, suppression (MIN_GROUP_SIZE 10) and family exclusions are unchanged
-- (scripts/validate/ready-fixes.mjs compares it with the profile-based formula on the seed and on edited data). TS mirror: cecStats() in
-- src/modules/m32/cec.ts (unchanged). Same signature and grants (internal). Idempotent (create or replace).

create or replace function kafaa_cec_stats_core() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  with staff as (select id, job_family_id as fam from kafaa_people where kind = 'staff' and status = 'active'),
  tg as (select distinct on (family_id) family_id, level from kafaa_cec_role_targets where family_id is not null order by family_id, id collate "C"),
  cl as (select x.person_id as pid, c.id as cid, c.area, least(3, max(x.level)) as lvl
           from kafaa_person_skills x
           join kafaa_cec_competences c on c.status = 'active' and x.skill_id = any(c.skill_ids)
          where x.active and x.level >= 1 and x.basis in ('verified', 'evidenced', 'validated') and x.person_id in (select id from staff)
          group by x.person_id, c.id, c.area),
  al as (select pid, max(lvl) filter (where area = 'values') as a_values, max(lvl) filter (where area = 'complexity') as a_complexity,
                max(lvl) filter (where area = 'futures') as a_futures, max(lvl) filter (where area = 'acting') as a_acting
           from cl group by pid),
  y0 as (select s.id, s.fam, coalesce(al.a_values, 0) as a_values, coalesce(al.a_complexity, 0) as a_complexity, coalesce(al.a_futures, 0) as a_futures,
                coalesce(al.a_acting, 0) as a_acting, tg.level as tgt
           from staff s left join al on al.pid = s.id left join tg on tg.family_id = s.fam),
  y1 as (select y0.*, least(3, a_values, a_complexity, a_futures, a_acting) as lvl from y0),
  x as (select y1.*, case when lvl = 0 then 'none' when tgt is null then 'no_target' when lvl >= tgt then 'met' else 'below' end as st from y1),
  tot as (select count(*)::integer as n, count(*) filter (where lvl >= 1)::integer as l1, count(*) filter (where tgt is not null)::integer as wt,
            count(*) filter (where tgt is not null and st = 'met')::integer as met from x)
  select jsonb_build_object(
    'staff', tot.n,
    'pct_l1', case when tot.n >= 10 and tot.l1 >= 10 then kafaa_cec_pct1(tot.l1, tot.n) else null end,
    'pct_met', case when tot.wt >= 10 and tot.met >= 10 then kafaa_cec_pct1(tot.met, tot.wt) else null end,
    'by_level', (select jsonb_agg(jsonb_build_object('level', l.l, 'n', case when tot.n >= 10 and l.c >= 10 then l.c else null end) order by l.l)
      from (select g.l, (select count(*) from x where x.lvl = g.l)::integer as c from generate_series(0, 3) g(l)) l),
    'by_area', (select jsonb_agg(jsonb_build_object('area', ar.area, 'pct_l1', case when tot.n >= 10 and ar.c >= 10 then kafaa_cec_pct1(ar.c, tot.n) else null end) order by ar.ord)
      from (select y.area, y.ord, (select count(*) from x where case y.area when 'values' then x.a_values when 'complexity' then x.a_complexity
                                                                       when 'futures' then x.a_futures else x.a_acting end >= 1)::integer as c
            from (values ('values', 1), ('complexity', 2), ('futures', 3), ('acting', 4)) y(area, ord)) ar),
    'by_family', (select coalesce(jsonb_agg(jsonb_build_object('family_id', f.fam, 'n', case when f.c >= 10 then f.c else null end,
        'target', (select t.level from kafaa_cec_role_targets t where t.family_id = f.fam order by t.id collate "C" limit 1),
        'pct_met', case when f.c >= 10 and f.m >= 10 then kafaa_cec_pct1(f.m, f.c) else null end) order by f.fam collate "C"), '[]'::jsonb)
      from (select x.fam, count(*)::integer as c, count(*) filter (where x.st = 'met')::integer as m from x
            where x.fam is not null and x.fam not in ('security', 'safeguards', 'cyber') group by x.fam) f))
  into v from tot;
  return v;
end $$;

revoke all on function kafaa_cec_stats_core() from public, anon, authenticated;
