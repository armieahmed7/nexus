-- [FS wave I · E5 · FS84] Team 2030 capability targets and an organisation skills inventory (M17 Skills Passport).
-- kafaa_team_skill_targets (F11, M17) gets two additive columns: horizon ('current' = the F11 coverage target, the default for every
--   existing row; '2028' / '2030' = team targets adopted from the FS05 role profiles, id tst:<horizon>:<group>:<skill>) and
--   profile_version_ids (the FS05 kafaa_role_profile_versions each adopted target came from). No existing row changes.
-- Rules (mirror of src/modules/m17/teamTargets.ts; scripts/validate/fs95-team-targets-inventory.mjs proves SQL = TS on the seed and on
--   generated edits): kafaa_tt_pct, kafaa_tt_l2028, kafaa_tt_is_restricted, kafaa_tt_core, kafaa_tt_version, kafaa_tt_reqs, kafaa_tt_need,
--   kafaa_tt_derive (futureTargets), kafaa_tt_inventory (orgInventory), kafaa_tt_qblock / kafaa_tt_quality (dataQuality). Internal: no
--   API role executes them.
-- RPCs (TS backend/rpc.ts Fs9Rpc + LocalBackend backend/local.fs9.ts + this SQL + backend/supabase.ts; authenticated only):
--   kafaa_team_future_targets(p_group, p_horizon)  read; skills_profile Scope/R/W/A people mode (names, holders, member readiness), Agg
--                                                 counts only with a group under 10 suppressed; the same pool as kafaa_team_coverage
--   kafaa_adopt_future_targets(p)                 Scope over a member of the group, or A (training manager); writes only the rows that
--                                                 differ, switches off rows that no longer derive (never removes any); audited, no ledger
--   kafaa_org_skill_inventory(p_dim)              read; skills_profile Agg (HR) or A; every cell under 10 suppressed; null otherwise
-- Redefined (newest body: 20261009121001_kafaa_w2e1_checkins.sql; nothing later redefines it): kafaa_team_coverage, with every target
--   read limited to horizon = 'current' so adopted 2028/2030 targets never change the F11 coverage, heatmap or crew view. Same
--   signature and grants. Not redefined: kafaa_set_team_target (its ids tst:<group>:<skill> never meet an FS84 id), kafaa_skill_states_v2,
--   kafaa_skills_apply (nothing here writes skill evidence).
-- Additive and idempotent: kafaa_* objects only; never alters NEXUS objects; never removes any object or row.

-- ───────────── Columns (additive; ALTER only on a kafaa_* table)
alter table kafaa_team_skill_targets add column if not exists horizon text not null default 'current' check (horizon in ('current', '2028', '2030'));
alter table kafaa_team_skill_targets add column if not exists profile_version_ids text[] not null default '{}'::text[];
create index if not exists kafaa_team_skill_targets_horizon_idx on kafaa_team_skill_targets (horizon);

-- ───────────── Helpers (mirror of src/modules/m17/teamTargets.ts). Internal: not executable by API roles.
-- pctOf(): round half up of 100 n / d in integers
create or replace function kafaa_tt_pct(n integer, d integer) returns integer language sql immutable set search_path = public as $$
  select case when d > 0 then (200 * n + d) / (2 * d) end
$$;
-- level2028(): half-way from today's level to the 2030 level, rounded up (only where 2030 asks for more)
create or replace function kafaa_tt_l2028(n integer, l integer) returns integer language sql immutable set search_path = public as $$
  select case when l > n then n + ceil((l - n) / 2.0)::integer else l end
$$;
-- security skills (area security, or a competency of the security domain) never enter a target, the inventory or the quality panel
create or replace function kafaa_tt_is_restricted(p_skill text) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select s.area = 'security' or coalesce(c.domain, '') = 'security' from kafaa_skills s left join kafaa_competencies c on c.id = s.competency_id where s.id = p_skill), false)
$$;
-- the core skill of a competency: the first core skill by id (ttCtx().core)
create or replace function kafaa_tt_core(p_comp text) returns text language sql stable security definer set search_path = public as $$
  select s.id from kafaa_skills s where s.core = true and s.competency_id = p_comp order by s.id collate "C" limit 1
$$;
-- publishedVersion(): the published version of a role and horizon (highest version number, then id)
create or replace function kafaa_tt_version(p_role text, p_horizon text) returns text language sql stable security definer set search_path = public as $$
  select v.id from kafaa_role_profile_versions v where p_role is not null and v.role_id = p_role and v.horizon = p_horizon and v.status = 'published'
   order by v.version desc, v.id collate "C" limit 1
$$;
-- reqsOf(): a profile version as skill -> level (competency -> its core skill, highest level wins, security and unknown skills left out)
create or replace function kafaa_tt_reqs(p_version text) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(y.sid, y.lv), '{}'::jsonb) from (
    select x.sid, max(x.lv) lv from (
      select case when r ->> 'kind' = 'competency' then kafaa_tt_core(r ->> 'ref_id') when r ->> 'kind' = 'skill' then r ->> 'ref_id' end sid,
             case when jsonb_typeof(r -> 'level') = 'number' and (r ->> 'level')::numeric = floor((r ->> 'level')::numeric) then (r ->> 'level')::numeric::integer end lv
        from kafaa_role_profile_versions v
        cross join lateral jsonb_array_elements(case when jsonb_typeof(v.requirements) = 'array' then v.requirements else '[]'::jsonb end) r
       where v.id = p_version and not coalesce(v.path_only, false)) x
    join kafaa_skills s on s.id = x.sid
    where x.lv >= 1 and not kafaa_tt_is_restricted(x.sid)
    group by x.sid) y
$$;
-- roleNeed(): what one role needs at a horizon (status ok | no_role | no_profile | path_only, the versions, needs and today's levels)
create or replace function kafaa_tt_need(p_role text, p_horizon text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v30 text; vn text; ref30 jsonb; refn jsonb; r30 jsonb; rn jsonb;
begin
  if p_role is null then return jsonb_build_object('status', 'no_role', 'v2030', null, 'vnow', null, 'needs', '{}'::jsonb, 'now', '{}'::jsonb); end if;
  v30 := kafaa_tt_version(p_role, '2030');
  vn := kafaa_tt_version(p_role, 'now');
  refn := (select jsonb_build_object('id', v.id, 'version', v.version) from kafaa_role_profile_versions v where v.id = vn);
  if v30 is null then return jsonb_build_object('status', 'no_profile', 'v2030', null, 'vnow', refn, 'needs', '{}'::jsonb, 'now', '{}'::jsonb); end if;
  ref30 := (select jsonb_build_object('id', v.id, 'version', v.version) from kafaa_role_profile_versions v where v.id = v30);
  if (select coalesce(v.path_only, false) from kafaa_role_profile_versions v where v.id = v30) then
    return jsonb_build_object('status', 'path_only', 'v2030', ref30, 'vnow', refn, 'needs', '{}'::jsonb, 'now', '{}'::jsonb); end if;
  r30 := kafaa_tt_reqs(v30);
  rn := kafaa_tt_reqs(vn);
  return jsonb_build_object('status', 'ok', 'v2030', ref30, 'vnow', refn, 'now', rn,
    'needs', coalesce((select jsonb_object_agg(e.key, case when p_horizon = '2030' then (e.value)::integer else kafaa_tt_l2028(coalesce((rn ->> e.key)::integer, 0), (e.value)::integer) end)
                         from jsonb_each(r30) e), '{}'::jsonb));
end $$;

-- futureTargets(): the team targets of a group at a horizon (p_people: names and holders; otherwise counts, a group under 10 suppressed)
create or replace function kafaa_tt_derive(p_members text[], p_horizon text, p_group text, p_people boolean) returns jsonb language sql stable security definer set search_path = public as $$
  with prm as (select coalesce(p_members, '{}'::text[]) mem, not p_people and cardinality(coalesce(p_members, '{}'::text[])) < 10 supp),
  rn as (select r.role_id, kafaa_tt_need(r.role_id, p_horizon) j
           from (select distinct x.job_role_id role_id from kafaa_people x, prm where x.id = any(prm.mem) and x.job_role_id is not null) r),
  mn as (select p.id, p.job_role_id role_id, coalesce(rn.j, jsonb_build_object('status', 'no_role')) j
           from kafaa_people p cross join prm left join rn on rn.role_id = p.job_role_id where p.id = any(prm.mem)),
  hv as (select ps.person_id, ps.skill_id, max(ps.level)::int lv from kafaa_person_skills ps, prm
          where ps.person_id = any(prm.mem) and coalesce(ps.active, true) and ps.level > 0 and ps.basis in ('verified', 'evidenced', 'validated') group by ps.person_id, ps.skill_id),
  ms as (select mn.id person, mn.role_id, e.key sid, (e.value)::integer lv, coalesce((mn.j -> 'now' ->> e.key)::integer, 0) nowl, coalesce(hv.lv, 0) hv
           from mn cross join lateral jsonb_each(case when mn.j ->> 'status' = 'ok' then mn.j -> 'needs' else '{}'::jsonb end) e
           left join hv on hv.person_id = mn.id and hv.skill_id = e.key),
  sk as (select s.sid, (select x.lv from ms x where x.sid = s.sid group by x.lv order by count(*) desc, x.lv desc limit 1) ml from (select distinct sid from ms) s),
  tg as (
    select sk.sid, sk.ml, coalesce(k0.sort, 0) so,
      (select count(*) from ms x where x.sid = sk.sid and x.lv >= sk.ml)::int mp,
      (select count(*) from hv where hv.skill_id = sk.sid and hv.lv >= sk.ml)::int n,
      (select coalesce(jsonb_agg(hv.person_id order by hv.person_id collate "C"), '[]'::jsonb) from hv where hv.skill_id = sk.sid and hv.lv >= sk.ml) holders,
      (select case when bool_and(x.nowl = 0) then 'new' when bool_or(x.lv > x.nowl) then 'raised' else 'kept' end from ms x where x.sid = sk.sid) chg,
      (select coalesce(jsonb_agg(jsonb_build_object('role_id', r.role_id, 'level', r.lv, 'people', case when prm.supp then null else r.cnt end,
                'version_id', r.j -> 'v2030' ->> 'id', 'version', (r.j -> 'v2030' ->> 'version')::int, 'now_level', r.nowl, 'now_version_id', r.j -> 'vnow' ->> 'id') order by r.role_id collate "C"), '[]'::jsonb)
         from (select x.role_id, min(x.lv) lv, min(x.nowl) nowl, count(*)::int cnt, (select rn.j from rn where rn.role_id = x.role_id) j from ms x where x.sid = sk.sid group by x.role_id) r) roles,
      (select coalesce(jsonb_agg(vv.v order by vv.v collate "C"), '[]'::jsonb) from (
          select rn.j -> 'v2030' ->> 'id' v from rn where rn.role_id in (select x.role_id from ms x where x.sid = sk.sid)
          union select rn.j -> 'vnow' ->> 'id' from rn where p_horizon = '2028' and rn.j -> 'vnow' ->> 'id' is not null and rn.role_id in (select x.role_id from ms x where x.sid = sk.sid)) vv) versions,
      t.id tid, t.min_people tmp, t.min_level tml, t.set_by tby, t.updated_at tat, t.note tnote,
      (select coalesce(jsonb_agg(v order by v collate "C"), '[]'::jsonb) from unnest(coalesce(t.profile_version_ids, '{}'::text[])) v) tv
    from sk cross join prm join kafaa_skills k0 on k0.id = sk.sid
    left join kafaa_team_skill_targets t on p_group is not null and t.team_id = p_group and t.horizon = p_horizon and t.active and t.skill_id = sk.sid),
  tj as (select coalesce(jsonb_agg(z.j order by z.g desc, z.mp desc, z.so, z.sid collate "C"), '[]'::jsonb) a from (
    select tg.sid, tg.so, case when prm.supp then 0 else greatest(0, tg.mp - tg.n) end g, case when prm.supp then 0 else tg.mp end mp,
      jsonb_build_object('skill_id', tg.sid, 'min_level', tg.ml, 'min_people', case when prm.supp then null else tg.mp end, 'n', case when prm.supp then null else tg.n end,
        'gap', case when prm.supp then null else greatest(0, tg.mp - tg.n) end,
        'status', case when prm.supp then 'suppressed' when tg.n >= tg.mp then 'covered' when tg.n = 0 then 'uncovered' else 'thin' end,
        'change', tg.chg, 'roles', tg.roles, 'versions', tg.versions,
        'adopted', case when tg.tid is null then null else jsonb_build_object('skill_id', tg.sid, 'min_people', tg.tmp, 'min_level', tg.tml, 'versions', tg.tv, 'set_by', tg.tby,
          'updated_at', to_char(tg.tat at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'note', tg.tnote) end,
        'changed', tg.tid is not null and (tg.tmp <> tg.mp or tg.tml <> tg.ml or tg.tv <> tg.versions))
      || case when p_people then jsonb_build_object('holders', tg.holders) else '{}'::jsonb end j
    from tg cross join prm) z),
  st as (select t.* from kafaa_team_skill_targets t where p_group is not null and t.team_id = p_group and t.horizon = p_horizon and t.active),
  ret as (select coalesce(jsonb_agg(jsonb_build_object('skill_id', t.skill_id, 'min_people', t.min_people, 'min_level', t.min_level,
      'versions', (select coalesce(jsonb_agg(v order by v collate "C"), '[]'::jsonb) from unnest(coalesce(t.profile_version_ids, '{}'::text[])) v), 'set_by', t.set_by,
      'updated_at', to_char(t.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'note', t.note) order by t.skill_id collate "C"), '[]'::jsonb) a
    from st t where not exists (select 1 from ms x where x.sid = t.skill_id)),
  lst as (select (select to_char(t.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') from st t order by t.updated_at desc, t.id collate "C" limit 1) lts,
                 (select t.set_by from st t order by t.updated_at desc, t.id collate "C" limit 1) lby),
  mj as (select case when not p_people then '[]'::jsonb else coalesce(jsonb_agg(jsonb_build_object('id', mn.id, 'role_id', mn.role_id, 'status', mn.j ->> 'status',
        'need', q.need, 'have', q.have, 'pct', kafaa_tt_pct(q.have, q.need), 'gaps', q.gaps, 'top', q.top) order by mn.id collate "C"), '[]'::jsonb) end a
      from mn cross join lateral (
        select coalesce(sum(x.lv), 0)::int need, coalesce(sum(least(x.hv, x.lv)), 0)::int have, count(*) filter (where x.hv < x.lv)::int gaps,
               coalesce((select jsonb_agg(y.sid order by y.d desc, y.sid collate "C") from (select x2.sid, x2.lv - x2.hv d from ms x2 where x2.person = mn.id and x2.hv < x2.lv
                          order by x2.lv - x2.hv desc, x2.sid collate "C" limit 3) y), '[]'::jsonb) top
          from ms x where x.person = mn.id) q),
  cnt as (select count(*) filter (where mn.j ->> 'status' = 'ok')::int n_ok, count(*) filter (where mn.j ->> 'status' in ('no_role', 'no_profile'))::int n_no,
                 count(*) filter (where mn.j ->> 'status' = 'path_only')::int n_path, (select coalesce(sum(x.lv), 0)::int from ms x) t_need, (select coalesce(sum(least(x.hv, x.lv)), 0)::int from ms x) t_have from mn)
  select jsonb_build_object('horizon', p_horizon, 'group', p_group, 'size', cardinality(prm.mem), 'suppressed', prm.supp,
    'profiled', case when prm.supp then null else cnt.n_ok end, 'no_profile', case when prm.supp then null else cnt.n_no end, 'path_only', case when prm.supp then null else cnt.n_path end,
    'targets', tj.a, 'members', mj.a, 'retired', ret.a, 'adopted_at', lst.lts, 'adopted_by', lst.lby,
    'summary', jsonb_build_object('targets', jsonb_array_length(tj.a),
      'covered', case when prm.supp then null else (select count(*) from jsonb_array_elements(tj.a) x where x ->> 'status' = 'covered')::int end,
      'thin', case when prm.supp then null else (select count(*) from jsonb_array_elements(tj.a) x where x ->> 'status' = 'thin')::int end,
      'uncovered', case when prm.supp then null else (select count(*) from jsonb_array_elements(tj.a) x where x ->> 'status' = 'uncovered')::int end,
      'gap', case when prm.supp then null else (select coalesce(sum((x ->> 'gap')::int), 0) from jsonb_array_elements(tj.a) x)::int end,
      'new_skills', (select count(*) from jsonb_array_elements(tj.a) x where x ->> 'change' = 'new')::int,
      'raised', (select count(*) from jsonb_array_elements(tj.a) x where x ->> 'change' = 'raised')::int,
      'readiness', case when prm.supp then null else kafaa_tt_pct(cnt.t_have, cnt.t_need) end))
  from prm, tj, ret, lst, mj, cnt
$$;

-- orgInventory(): every non-security skill by area and entity (or job family): people at the key level with counted evidence; cells under 10 null
create or replace function kafaa_tt_inventory(p_dim text, p_today date) returns jsonb language sql stable security definer set search_path = public as $$
  with st as (select p.id, nullif(case when p_dim = 'family' then (case when p.job_family_id in ('security', 'safeguards', 'cyber') then null else p.job_family_id end) else p.entity_id end, '') g
                from kafaa_people p where p.kind = 'staff' and p.status = 'active'),
  tot as (select count(*)::int n from st),
  gs as (select st.g, count(*)::int n from st where st.g is not null group by st.g),
  sk as (select s.id, s.area, coalesce(s.sort, 0) so, s.key_level from kafaa_skills s where not kafaa_tt_is_restricted(s.id)),
  h as (select distinct ps.person_id, ps.skill_id, st.g from kafaa_person_skills ps join st on st.id = ps.person_id join sk on sk.id = ps.skill_id
         where coalesce(ps.active, true) and ps.basis in ('verified', 'evidenced', 'validated') and ps.level >= sk.key_level),
  sj as (select coalesce(jsonb_agg(jsonb_build_object('skill_id', sk.id, 'area', sk.area,
            'total', (select case when count(distinct h.person_id) < 10 then jsonb_build_object('n', null, 'pct', null)
                             else jsonb_build_object('n', count(distinct h.person_id), 'pct', kafaa_tt_pct(count(distinct h.person_id)::int, tot.n)) end from h where h.skill_id = sk.id),
            'cells', (select coalesce(jsonb_agg(case when gs.n < 10 or c.n < 10 then jsonb_build_object('g', gs.g, 'n', null, 'pct', null) else jsonb_build_object('g', gs.g, 'n', c.n, 'pct', kafaa_tt_pct(c.n, gs.n)) end
                         order by gs.g collate "C"), '[]'::jsonb)
                        from gs cross join lateral (select count(distinct h.person_id)::int n from h where h.skill_id = sk.id and h.g = gs.g) c))
          order by sk.area collate "C", sk.so, sk.id collate "C"), '[]'::jsonb) a from sk, tot),
  aj as (select coalesce(jsonb_agg(jsonb_build_object('area', ar.area, 'skills', ar.k,
            'total', (select case when count(distinct h.person_id) < 10 then jsonb_build_object('n', null, 'pct', null)
                             else jsonb_build_object('n', count(distinct h.person_id), 'pct', kafaa_tt_pct(count(distinct h.person_id)::int, tot.n)) end from h join sk on sk.id = h.skill_id where sk.area = ar.area),
            'cells', (select coalesce(jsonb_agg(case when gs.n < 10 or c.n < 10 then jsonb_build_object('g', gs.g, 'n', null, 'pct', null) else jsonb_build_object('g', gs.g, 'n', c.n, 'pct', kafaa_tt_pct(c.n, gs.n)) end
                         order by gs.g collate "C"), '[]'::jsonb)
                        from gs cross join lateral (select count(distinct h.person_id)::int n from h join sk on sk.id = h.skill_id where sk.area = ar.area and h.g = gs.g) c))
          order by ar.area collate "C"), '[]'::jsonb) a
         from (select sk.area, count(*)::int k from sk group by sk.area) ar, tot)
  select jsonb_build_object('dim', p_dim, 'as_of', to_char(p_today, 'YYYY-MM-DD'), 'staff', tot.n,
    'groups', (select coalesce(jsonb_agg(jsonb_build_object('id', gs.g, 'staff', case when gs.n < 10 then null else gs.n end) order by gs.g collate "C"), '[]'::jsonb) from gs),
    'areas', aj.a, 'skills', sj.a)
  from tot, aj, sj
$$;
-- dataQuality() block over a set of active staff: profile coverage, role requirements recorded, staleness (FS03 ageing / FS54 review date), share validated
create or replace function kafaa_tt_qblock(p_ids text[], p_today date) returns jsonb language sql stable security definer set search_path = public as $$
  with st as (select ps.person_id p, ps.skill_id s, ps.basis b,
                     (jsonb_typeof(ps.reasons) = 'array' and (ps.reasons -> 0 -> 'ageing') = 'true'::jsonb) age,
                     (k.review_due is not null and k.review_due < p_today) rev
                from kafaa_person_skills ps join kafaa_skills k on k.id = ps.skill_id
               where ps.person_id = any(p_ids) and coalesce(ps.active, true) and ps.level > 0 and ps.basis <> 'none' and not kafaa_tt_is_restricted(ps.skill_id)),
  rl as (select r.role_id, kafaa_tt_reqs(kafaa_tt_version(r.role_id, 'now')) q from (select distinct p.job_role_id role_id from kafaa_people p where p.id = any(p_ids) and p.job_role_id is not null) r),
  rq as (select p.id, (select count(*) from jsonb_object_keys(rl.q))::int rt,
                (select count(*) from jsonb_object_keys(rl.q) k where exists (select 1 from st where st.p = p.id and st.s = k))::int rr
           from kafaa_people p join rl on rl.role_id = p.job_role_id where p.id = any(p_ids)),
  a as (select cardinality(p_ids) staff,
          (select count(distinct st.p)::int from st) prof, (select count(*)::int from st) states,
          (select coalesce(sum(rq.rt), 0)::int from rq where rq.rt > 0) rt, (select coalesce(sum(rq.rr), 0)::int from rq where rq.rt > 0) rr, (select count(*)::int from rq where rq.rt > 0) rp,
          (select case when count(distinct st.p) < 10 then null else count(*)::int end from st where st.age) ageing,
          (select case when count(distinct st.p) < 10 then null else count(*)::int end from st where st.rev) rev,
          (select case when count(distinct st.p) < 10 then null else count(*)::int end from st where st.age or st.rev) stale,
          (select case when count(distinct st.p) < 10 then null else count(*)::int end from st where st.b in ('verified', 'validated')) val,
          (select case when count(distinct st.p) < 10 then null else count(*)::int end from st where st.b = 'verified') b_ver,
          (select case when count(distinct st.p) < 10 then null else count(*)::int end from st where st.b = 'evidenced') b_evi,
          (select case when count(distinct st.p) < 10 then null else count(*)::int end from st where st.b = 'validated') b_val,
          (select case when count(distinct st.p) < 10 then null else count(*)::int end from st where st.b = 'claimed') b_cla)
  select jsonb_build_object('staff', a.staff, 'profiled', case when a.prof < 10 then null else a.prof end, 'states', case when a.prof < 10 then null else a.states end,
    'req_total', case when a.rp < 10 then null else a.rt end, 'req_recorded', case when a.rp < 10 then null else a.rr end,
    'ageing', a.ageing, 'review_overdue', a.rev, 'stale', a.stale, 'validated', a.val,
    'basis', jsonb_build_object('verified', a.b_ver, 'evidenced', a.b_evi, 'validated', a.b_val, 'claimed', a.b_cla),
    'profiled_pct', case when a.prof < 10 then null else kafaa_tt_pct(a.prof, a.staff) end,
    'req_pct', case when a.rp < 10 then null else kafaa_tt_pct(a.rr, a.rt) end,
    'stale_pct', case when a.stale is null or a.prof < 10 then null else kafaa_tt_pct(a.stale, a.states) end,
    'validated_pct', case when a.val is null or a.prof < 10 then null else kafaa_tt_pct(a.val, a.states) end)
  from a
$$;
-- dataQuality(): the organisation block, the skills past their review date and one row per entity (or family; under 10 staff suppressed)
create or replace function kafaa_tt_quality(p_dim text, p_today date) returns jsonb language sql stable security definer set search_path = public as $$
  with st as (select p.id, nullif(case when p_dim = 'family' then (case when p.job_family_id in ('security', 'safeguards', 'cyber') then null else p.job_family_id end) else p.entity_id end, '') g
                from kafaa_people p where p.kind = 'staff' and p.status = 'active'),
  allb as (select kafaa_tt_qblock((select coalesce(array_agg(st.id order by st.id collate "C"), '{}'::text[]) from st), p_today) b),
  gb as (select st.g, count(*)::int n, array_agg(st.id order by st.id collate "C") ids from st where st.g is not null group by st.g)
  select (allb.b - 'basis' - 'staff') || jsonb_build_object('as_of', to_char(p_today, 'YYYY-MM-DD'), 'staff', allb.b -> 'staff', 'basis', allb.b -> 'basis',
      'overdue_skills', (select count(*)::int from kafaa_skills s where not kafaa_tt_is_restricted(s.id) and s.review_due is not null and s.review_due < p_today),
      'by_group', (select coalesce(jsonb_agg(case when gb.n < 10 then jsonb_build_object('g', gb.g, 'staff', null, 'profiled_pct', null, 'req_pct', null, 'stale_pct', null, 'validated_pct', null)
                   else (select jsonb_build_object('g', gb.g, 'staff', q.b -> 'staff', 'profiled_pct', q.b -> 'profiled_pct', 'req_pct', q.b -> 'req_pct', 'stale_pct', q.b -> 'stale_pct', 'validated_pct', q.b -> 'validated_pct')
                           from (select kafaa_tt_qblock(gb.ids, p_today) b) q) end order by gb.g collate "C"), '[]'::jsonb) from gb))
  from allb
$$;

-- ───────────── RPCs
-- teamFutureTargets: the same pool and groups as rpc.teamCoverage (kafaa_sc_pool / kafaa_sc_groups); people mode names members and holders
create or replace function kafaa_team_future_targets(p_group text default null, p_horizon text default '2030') returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); v_people boolean; v_agg boolean; v_pool text[]; v_groups jsonb; v_key text; v_found boolean; v_members text[];
  v_h text := case when p_horizon in ('2028', '2030') then p_horizon else '2030' end;
begin
  v_people := kafaa_has_grant('skills_profile', array['Scope', 'R', 'W', 'A']);
  v_agg := kafaa_has_grant('skills_profile', array['Agg']);
  if me is null or (not v_people and not v_agg) then raise exception 'Kafa''a · team capability is for managers in scope and HR aggregates' using errcode = '42501'; end if;
  v_pool := kafaa_sc_pool(v_people);
  v_groups := kafaa_sc_groups(v_pool);
  v_key := coalesce(p_group, kafaa_sc_default_group(v_groups, me, v_people));
  v_found := exists (select 1 from jsonb_array_elements(v_groups) g where g->>'key' = v_key);
  v_members := case when v_found then kafaa_sc_members(v_pool, v_key) else '{}'::text[] end;
  return kafaa_tt_derive(v_members, v_h, case when v_found then v_key end, v_people) || jsonb_build_object('group', v_key, 'mode', case when v_people then 'people' else 'aggregate' end, 'groups', v_groups,
    'people', case when not v_people then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name_en', coalesce(p.display_name, p.id),
      'name_ar', coalesce(nullif(p.display_name_ar, ''), nullif(p.display_name, ''), p.id), 'job_role_id', p.job_role_id) order by p.id collate "C") from kafaa_people p where p.id = any(v_members)), '[]'::jsonb) end);
end $$;

-- adoptFutureTargets: a manager in scope (Scope over a member) or the training manager (A) stores the derived targets; audited, no ledger
create or replace function kafaa_adopt_future_targets(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me text := kafaa_me(); v_role text; v_key text := trim(coalesce(p->>'team_id', '')); v_h text := case when jsonb_typeof(p->'horizon') = 'string' then p->>'horizon' end;
  v_ft jsonb; v_note text := nullif(left(trim(coalesce(p->>'note', '')), 300), ''); v_w integer; v_r integer; v_k integer; v_at timestamptz := now(); a kafaa_audit_events;
  c_act constant text := 'skills.future_target.adopt'; c_tbl constant text := 'team_skill_targets';
begin
  if me is null then return kafaa_refuse(c_act, c_tbl, nullif(v_key, ''), 'not_signed_in', 'Sign in to set team targets'); end if;
  v_role := coalesce(kafaa_acting_role('skills_profile', array['A']), kafaa_acting_role('skills_profile', array['Scope']));
  if v_role is null then return kafaa_refuse(c_act, c_tbl, nullif(v_key, ''), 'forbidden', 'Only a manager in scope or the training manager can adopt team targets'); end if;
  if not v_key ~ '^(team|family):[a-z0-9][a-z0-9-]{0,59}$' then return kafaa_refuse(c_act, c_tbl, nullif(v_key, ''), 'invalid', 'Unknown team or group', v_role); end if;
  if v_h is null or v_h not in ('2028', '2030') then return kafaa_refuse(c_act, c_tbl, v_key, 'invalid', 'Choose the 2028 or the 2030 horizon', v_role); end if;
  if not exists (select 1 from kafaa_people x where x.kind = 'staff' and x.status = 'active' and (('team:' || x.team_id) = v_key or ('family:' || x.job_family_id) = v_key)) then
    return kafaa_refuse(c_act, c_tbl, v_key, 'not_found', 'Unknown team or group', v_role); end if;
  if not kafaa_has_grant('skills_profile', array['A']) and not exists (select 1 from kafaa_people x where x.kind = 'staff' and x.status = 'active'
       and (('team:' || x.team_id) = v_key or ('family:' || x.job_family_id) = v_key) and kafaa_in_scope('skills_profile', x.id)) then
    return kafaa_refuse(c_act, c_tbl, v_key, 'forbidden', 'Only a manager in scope or the training manager can adopt team targets', v_role); end if;
  v_ft := kafaa_tt_derive(kafaa_sc_members(kafaa_sc_pool(true), v_key), v_h, v_key, true);
  if jsonb_array_length(v_ft->'targets') = 0 then return kafaa_refuse(c_act, c_tbl, v_key, 'no_profile', 'No published 2030 role profile covers this group, so there is nothing to adopt', v_role); end if;
  v_w := (select count(*) from jsonb_array_elements(v_ft->'targets') t where t->'adopted' = 'null'::jsonb or (t->>'changed')::boolean)::int;
  v_r := jsonb_array_length(v_ft->'retired');
  v_k := jsonb_array_length(v_ft->'targets') - v_w;
  if v_w = 0 and v_r = 0 then return kafaa_refuse(c_act, c_tbl, v_key, 'unchanged', 'The team targets already match the role profiles', v_role); end if;
  insert into kafaa_team_skill_targets (id, team_id, skill_id, min_people, min_level, note, active, set_by, updated_at, horizon, profile_version_ids)
    select 'tst:' || v_h || ':' || v_key || ':' || (t->>'skill_id'), v_key, t->>'skill_id', (t->>'min_people')::int, (t->>'min_level')::int,
           v_note, true, me, v_at, v_h,
           array(select jsonb_array_elements_text(t->'versions'))
      from jsonb_array_elements(v_ft->'targets') t where t->'adopted' = 'null'::jsonb or (t->>'changed')::boolean
  on conflict (id) do update set min_people = excluded.min_people, min_level = excluded.min_level, note = excluded.note, active = true, set_by = excluded.set_by,
    updated_at = excluded.updated_at, horizon = excluded.horizon, profile_version_ids = excluded.profile_version_ids;
  update kafaa_team_skill_targets set active = false, set_by = me, updated_at = v_at
   where id in (select 'tst:' || v_h || ':' || v_key || ':' || (r->>'skill_id') from jsonb_array_elements(v_ft->'retired') r);
  a := kafaa_audit(c_act, c_tbl, v_h || ':' || v_key, 'ok', v_w || ' written, ' || v_r || ' switched off, ' || v_k || ' kept', 'not_applicable', null, v_role);
  return kafaa_result(true, 'ok', 'Team targets adopted from the role profiles', a, null, jsonb_build_object('written', v_w, 'retired', v_r, 'kept', v_k));
end $$;

-- orgSkillInventory: HR aggregates (skills_profile Agg) and the training manager (A); null for anyone else; reads are not audited
create or replace function kafaa_org_skill_inventory(p_dim text default 'entity') returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_dim text := case when p_dim = 'family' then 'family' else 'entity' end;
begin
  if kafaa_me() is null or not kafaa_has_grant('skills_profile', array['Agg', 'A']) then return null; end if;
  return jsonb_build_object('inventory', kafaa_tt_inventory(v_dim, current_date), 'quality', kafaa_tt_quality(v_dim, current_date));
end $$;


-- ───────────── F11 coverage reads current targets only (redefinition of the w2e1 body, horizon filter added)
create or replace function kafaa_team_coverage(p_group text default null) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := kafaa_me(); v_people boolean; v_agg boolean; v_pool text[]; v_groups jsonb; v_key text; v_found boolean; v_members text[]; v_size integer; v_supp boolean;
  v_cols text[]; v_targets jsonb; v_profile jsonb; v_cov jsonb; v_cells jsonb := '[]'::jsonb; v_mem jsonb := '[]'::jsonb; v_crews jsonb := '[]'::jsonb;
  c_counted constant text[] := array['verified', 'evidenced', 'validated'];
begin
  v_people := kafaa_has_grant('skills_profile', array['Scope', 'R', 'W', 'A']);
  v_agg := kafaa_has_grant('skills_profile', array['Agg']);
  if me is null or (not v_people and not v_agg) then raise exception 'Kafa''a · team capability is for managers in scope and HR aggregates' using errcode = '42501'; end if;
  v_pool := kafaa_sc_pool(v_people);
  v_groups := kafaa_sc_groups(v_pool);
  v_key := coalesce(p_group, kafaa_sc_default_group(v_groups, me, v_people));
  v_found := exists (select 1 from jsonb_array_elements(v_groups) g where g->>'key' = v_key);
  v_members := case when v_found then kafaa_sc_members(v_pool, v_key) else '{}'::text[] end;
  v_size := cardinality(v_members);
  v_supp := not v_people and v_size < 10;
  v_targets := coalesce((select jsonb_agg(jsonb_build_object('team_id', t.team_id, 'skill_id', t.skill_id, 'min_people', t.min_people, 'min_level', t.min_level, 'active', true, 'note', t.note) order by t.skill_id collate "C")
                 from kafaa_team_skill_targets t where v_found and t.active and t.horizon = 'current' and t.team_id = v_key), '[]'::jsonb);
  v_profile := coalesce((select jsonb_agg(jsonb_build_object('team_id', t.team_id, 'skill_id', t.skill_id, 'min_people', t.min_people, 'min_level', t.min_level, 'active', true, 'note', t.note) order by t.skill_id collate "C")
                 from kafaa_team_skill_targets t where t.active and t.horizon = 'current' and t.team_id = 'crew:profile'), '[]'::jsonb);
  v_cols := array(select s.id from kafaa_skills s left join kafaa_competencies cp on cp.id = s.competency_id
                   where not (s.area = 'security' or coalesce(cp.domain, '') = 'security')
                     and (exists (select 1 from kafaa_team_skill_targets t where v_found and t.active and t.horizon = 'current' and t.team_id = v_key and t.skill_id = s.id)
                          or (not v_supp and exists (select 1 from kafaa_person_skills ps where ps.person_id = any(v_members) and ps.skill_id = s.id and ps.active and ps.level > 0 and ps.basis <> 'none')))
                   order by coalesce(s.sort, 0), s.id collate "C");
  select coalesce(jsonb_agg(x.j order by x.o), '[]'::jsonb) into v_cov from (
    select k.o, case when v_supp
        then jsonb_build_object('skill_id', s.id, 'min_people', m.mp, 'min_level', m.ml, 'target_set', t.id is not null, 'n', null, 'claimed_n', null, 'status', 'suppressed', 'spof', false)
        else jsonb_build_object('skill_id', s.id, 'min_people', m.mp, 'min_level', m.ml, 'target_set', t.id is not null, 'n', h.n, 'claimed_n', h.c,
               'status', case when h.n >= m.mp then 'covered' when h.n = 0 then 'uncovered' else 'thin' end, 'spof', h.n = 1)
             || case when v_people then jsonb_build_object('holders', h.holders) else '{}'::jsonb end end j
      from unnest(v_cols) with ordinality k(sid, o)
      join kafaa_skills s on s.id = k.sid
      left join kafaa_team_skill_targets t on v_found and t.active and t.horizon = 'current' and t.team_id = v_key and t.skill_id = s.id
      cross join lateral (select coalesce(t.min_people, 2) mp, coalesce(t.min_level, s.key_level) ml) m
      cross join lateral (select count(*) filter (where ps.basis = any(c_counted))::int n, count(*) filter (where not ps.basis = any(c_counted))::int c,
                                 coalesce(jsonb_agg(ps.person_id order by ps.person_id collate "C") filter (where ps.basis = any(c_counted)), '[]'::jsonb) holders
                            from kafaa_person_skills ps
                           where ps.person_id = any(v_members) and ps.skill_id = s.id and ps.active and ps.level > 0 and ps.basis <> 'none' and ps.level >= m.ml) h) x;
  if v_people then
    v_cells := coalesce((select jsonb_agg(jsonb_build_object('p', ps.person_id, 's', ps.skill_id, 'l', ps.level, 'b', ps.basis) order by ps.person_id collate "C", ps.skill_id collate "C")
                 from kafaa_person_skills ps where ps.person_id = any(v_members) and ps.skill_id = any(v_cols) and ps.active and ps.level > 0 and ps.basis <> 'none'), '[]'::jsonb);
    v_mem := coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name_en', coalesce(p.display_name, p.id), 'name_ar', coalesce(nullif(p.display_name_ar, ''), nullif(p.display_name, ''), p.id),
                 'initials', coalesce(p.initials, ''), 'job_role_id', p.job_role_id, 'crew', p.crew, 'team_id', p.team_id) order by p.id collate "C")
                 from kafaa_people p where p.id = any(v_members)), '[]'::jsonb);
    v_crews := coalesce((select jsonb_agg(jsonb_build_object('crew', cr.crew, 'headcount', cr.hc, 'available', cr.av, 'unknown', cr.unk, 'skills', cr.sk) order by cr.crew collate "C") from (
        select p.crew, count(*)::int hc, count(*) filter (where kafaa_sc_available(p.id) is true)::int av, count(*) filter (where kafaa_sc_available(p.id) is null)::int unk,
               coalesce((select jsonb_agg(jsonb_build_object('skill_id', t.skill_id, 'min_people', t.min_people, 'min_level', t.min_level, 'n', q.n, 'available_n', q.an,
                          'status', case when q.n >= t.min_people then 'covered' when q.n = 0 then 'uncovered' else 'thin' end) order by coalesce(s.sort, 0), t.skill_id collate "C")
                  from kafaa_team_skill_targets t join kafaa_skills s on s.id = t.skill_id
                  cross join lateral (select count(*)::int n, count(*) filter (where kafaa_sc_available(x.id) is true)::int an
                                        from kafaa_people x join kafaa_person_skills ps on ps.person_id = x.id and ps.skill_id = t.skill_id
                                       where x.id = any(v_pool) and x.crew = p.crew and ps.active and ps.level > 0 and ps.level >= t.min_level and ps.basis = any(c_counted)) q
                 where t.team_id = 'crew:profile' and t.active and t.horizon = 'current'), '[]'::jsonb) sk
          from kafaa_people p where p.id = any(v_pool) and p.crew is not null group by p.crew) cr), '[]'::jsonb);
  end if;
  return jsonb_build_object('mode', case when v_people then 'people' else 'aggregate' end, 'groups', v_groups, 'group', v_key, 'size', v_size, 'suppressed', v_supp,
    'members', v_mem, 'skills', to_jsonb(v_cols), 'cells', v_cells, 'coverage', v_cov, 'targets', v_targets, 'crew_profile', v_profile, 'crews', v_crews);
end $$;

-- ───────────── Grants
revoke execute on function kafaa_tt_pct(integer, integer), kafaa_tt_l2028(integer, integer), kafaa_tt_is_restricted(text), kafaa_tt_core(text), kafaa_tt_version(text, text),
  kafaa_tt_reqs(text), kafaa_tt_need(text, text), kafaa_tt_derive(text[], text, text, boolean), kafaa_tt_inventory(text, date), kafaa_tt_qblock(text[], date), kafaa_tt_quality(text, date)
  from public, anon, authenticated;
revoke execute on function kafaa_team_future_targets(text, text), kafaa_adopt_future_targets(jsonb), kafaa_org_skill_inventory(text) from public, anon;
grant execute on function kafaa_team_future_targets(text, text), kafaa_adopt_future_targets(jsonb), kafaa_org_skill_inventory(text) to authenticated;
