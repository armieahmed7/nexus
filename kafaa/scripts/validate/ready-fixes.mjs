// [Readiness fixes 2026-10-13] PGlite checks for supabase/migrations/20261013200001..07 (kafaa_ready_*):
//   1  kafaa_mirror_now() caps at MIRROR_AS_OF (= src/domain/mirrorClock.ts); crew availability and the check-in availability use it
//   2  kafaa_route_guard / kafaa_route_ok_for = linkOpenFor (src/routes/linkAccess.ts) for every route and every person's roles;
//      kafaa_dg_compute keeps only openable items; kafaa_build_digest builds through it; the helpers are closed to API roles
//   3  kafaa_scope_people(res) admits exactly the people kafaa_rule_read(res, person, null, false) admits, for every test identity, every
//      resource and every person; the rewritten policies call no kafaa_rule_read; kafaa_cec_stats_core equals the profile-based formula
//      on the seed and on edited data
//   6  the seven Arabic columns exist and are seeded for every English value
// Earlier validators replay older migration files on this shared database, so the files are replayed here first (idempotent, as live).
import { readFileSync, readdirSync } from 'node:fs';

const FILES = readdirSync('supabase/migrations').filter((f) => /^20261013200\d{3}_kafaa_ready_.*\.sql$/.test(f)).sort();

export default async function readyChecks({ db, as, one, ok, uid }) {
  console.log('Readiness fixes 2026-10-13');
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  const q1 = async (sql, p = []) => (await q(sql, p))[0];
  ok(FILES.length === 7, `7 kafaa_ready_* migrations (${FILES.join(', ')})`);
  for (const f of FILES) await db.exec(readFileSync(`supabase/migrations/${f}`, 'utf8'));
  for (const f of FILES) await db.exec(readFileSync(`supabase/migrations/${f}`, 'utf8')); // idempotent
  for (const f of FILES) {
    const body = readFileSync(`supabase/migrations/${f}`, 'utf8').replace(/--[^\n]*/g, '');
    ok(!/\b(drop|delete|truncate)\b/i.test(body) && !/\balter default privileges\b/i.test(body) && !/\b(alter|create)\s+(table|policy|function|or replace function|index)\s+(if not exists\s+)?(public\.)?(?!kafaa_)\w+/i.test(body.replace(/alter policy \w+ on public\.kafaa_/g, '')),
      `${f}: no drop/delete/truncate, no default privileges`);
  }

  // ── 1 mirror clock
  const MC = await import('../../src/domain/mirrorClock.ts');
  const cap = (await q1(`select kafaa_mirror_now() < now() as capped, to_char(kafaa_mirror_now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as at`));
  ok(cap.capped && cap.at === MC.MIRROR_AS_OF, `kafaa_mirror_now() = least(now(), ${MC.MIRROR_AS_OF}) (SQL ${cap.at})`);
  const avail = await q(`select l.person_id, kafaa_sc_available(l.person_id) a from kafaa_licences l order by 1`);
  ok(avail.find((x) => x.person_id === 'w-sro-05')?.a === null && avail.filter((x) => x.a === null).length === 1,
    `availability: only w-sro-05 (synced 2 Oct) is unknown for a stale sync; ${avail.filter((x) => x.a === true).length} available, ${avail.filter((x) => x.a === false).length} not`);
  ok((await q1(`select count(*)::int n from pg_proc where proname = 'kafaa_crew_availability' and prosrc like '%kafaa_mirror_now() - l.last_synced%'`)).n === 1, 'kafaa_crew_availability judges the sync at the mirror clock');

  // ── 2 route guards and the digest
  const LA = await import('../../src/routes/linkAccess.ts');
  const G = await import('../../src/routes/guards.gen.ts');
  const people = await q(`select id from kafaa_people where persona_id like 'k-%' or id in ('p-sro', 'p-training-mgr', 'p-presenter', 'p-nse', 'p-alnoor-gm', 'w-ro-05', 'ap-001') order by id`);
  const ras = await q(`select person_id, role, status, expires_at::text from kafaa_role_assignments`);
  const links = G.ROUTE_GUARDS.flatMap(([p]) => { const x = p.replace(/:(\w+)/g, 'x-1'); return [x, `/ar${x === '/' ? '' : x}?tab=1#a`]; }).concat(['/nope', 'https://x.org/', '//evil', '/my#digest']);
  let diff = [], n = 0;
  for (const { id } of people) {
    const roles = LA.rolesOn(ras, id, '2026-10-13');
    const sql = await q(`select l, kafaa_route_ok_for($1, l, '2026-10-13'::date) ok from unnest($2::text[]) l`, [id, links]);
    for (const r of sql) { n++; if (r.ok !== LA.linkOpenFor(r.l, roles)) diff.push(`${id} ${r.l}`); }
  }
  ok(diff.length === 0 && n > 10000, `kafaa_route_ok_for = linkOpenFor for ${people.length} people x ${links.length} links (${n})${diff.length ? `; first: ${diff.slice(0, 3).join(', ')}` : ''}`);
  ok((await q1(`select kafaa_route_ok_for(null, '/learn', current_date) a, kafaa_route_ok_for(null, '/my', current_date) b`)).a === true
    && (await q1(`select kafaa_route_ok_for(null, '/my', current_date) b`)).b === false, 'public routes are open without a person; signed-in routes need one');
  const bad = await q(`select p.id, i ->> 'link' link from kafaa_people p cross join lateral jsonb_array_elements(kafaa_dg_compute(p.id, '2026-10-13'::date, '{}'::jsonb)) i
                        where not kafaa_route_ok_for(p.id, i ->> 'link', '2026-10-13'::date)`);
  ok(bad.length === 0, `kafaa_dg_compute offers no item the person cannot open (all ${(await q1('select count(*)::int n from kafaa_people')).n} people)`);
  const dropped = (await q1(`select count(*)::int n from kafaa_people p cross join lateral jsonb_array_elements(kafaa_dg_gather(p.id, '2026-10-13'::date, '{}'::jsonb)) i
                             where not kafaa_route_ok_for(p.id, i ->> 'link', '2026-10-13'::date)`)).n;
  ok(dropped > 0, `the filter drops ${dropped} gathered items people could not open`);
  ok((await q1(`select count(*)::int n from pg_proc where proname = 'kafaa_build_digest' and prosrc like '%v_items := kafaa_dg_compute(me, v_today%'`)).n === 1, 'kafaa_build_digest builds through kafaa_dg_compute');
  const priv = await q(`select p.proname, has_function_privilege('anon', p.oid, 'execute') a, has_function_privilege('authenticated', p.oid, 'execute') u
                          from pg_proc p where p.proname in ('kafaa_route_guard', 'kafaa_route_ok_for', 'kafaa_dg_compute', 'kafaa_mirror_now', 'kafaa_cec_stats_core', 'kafaa_scope_people', 'kafaa_build_digest') order by 1`);
  const pv = Object.fromEntries(priv.map((r) => [r.proname, `${r.a ? 'a' : '-'}${r.u ? 'u' : '-'}`]));
  ok(pv.kafaa_route_guard === '--' && pv.kafaa_route_ok_for === '--' && pv.kafaa_dg_compute === '--' && pv.kafaa_mirror_now === '--' && pv.kafaa_cec_stats_core === '--'
    && pv.kafaa_scope_people === 'au' && pv.kafaa_build_digest === '-u', `execute grants: ${JSON.stringify(pv)}`);
  // a student's digest (k-student) has no staff opportunity or skills item
  const st = await as('k-student', `select kafaa_build_digest('{}'::jsonb) r`).catch(() => null);
  ok(st === null || !(st[0]?.r?.data?.items ?? []).some((i) => /^\/(opportunities|my\/skills|my\/ai-fluency)/.test(i.link)), 'k-student: the digest offers no staff opportunity or skills page');

  // ── 3 RLS without a per-row call
  ok((await q1(`select count(*)::int n from pg_policies where schemaname = 'public' and tablename like 'kafaa\\_%' and (qual like '%kafaa_rule_read(%' or with_check like '%kafaa_rule_read(%')`)).n === 0,
    'no kafaa_* policy calls kafaa_rule_read per row');
  ok((await q1(`select count(*)::int n from pg_policies where schemaname = 'public' and tablename like 'kafaa\\_%' and qual like '%kafaa_scope_people(%'`)).n === 134, 'the 134 person rules read kafaa_scope_people once per statement');
  const resources = (await q(`select distinct resource from kafaa_policy_matrix where level = 'Scope' order by 1`)).map((r) => r.resource);
  const ids = (await q(`select id from kafaa_people order by id`)).map((r) => r.id);
  let mism = [], checked = 0;
  for (const persona of [null, ...Object.keys(uid)]) {
    for (const res of resources) {
      const r = await one(persona, `select array(select x from unnest($2::text[]) x where kafaa_rule_read($1, x, null::text, false) order by x) a,
                                           array(select x from unnest(kafaa_scope_people($1)) x order by x) b`, [res, ids]);
      checked++;
      if (JSON.stringify(r.a) !== JSON.stringify(r.b)) mism.push(`${persona}/${res}`);
    }
  }
  ok(mism.length === 0, `kafaa_scope_people(res) = the people kafaa_rule_read(res, person, null, false) admits: ${checked} identity x resource pairs over ${ids.length} people${mism.length ? `; differ: ${mism.slice(0, 4).join(', ')}` : ''}`);

  // cec stats: set-based core = the per-person profile formula
  const REF = `with staff as (select id, job_family_id as fam from kafaa_people where kind = 'staff' and status = 'active'),
    pr as (select s.id, s.fam, kafaa_cec_profile(s.id) as j from staff s),
    x as (select id, fam, (j ->> 'level')::integer as lvl, (j ->> 'target')::integer as tgt, j ->> 'status' as st, j -> 'areas' as areas from pr),
    tot as (select count(*)::integer as n, count(*) filter (where lvl >= 1)::integer as l1, count(*) filter (where tgt is not null)::integer as wt,
              count(*) filter (where tgt is not null and st = 'met')::integer as met from x)
    select jsonb_build_object('staff', tot.n,
      'pct_l1', case when tot.n >= 10 and tot.l1 >= 10 then kafaa_cec_pct1(tot.l1, tot.n) else null end,
      'pct_met', case when tot.wt >= 10 and tot.met >= 10 then kafaa_cec_pct1(tot.met, tot.wt) else null end,
      'by_level', (select jsonb_agg(jsonb_build_object('level', l.l, 'n', case when tot.n >= 10 and l.c >= 10 then l.c else null end) order by l.l)
        from (select g.l, (select count(*) from x where x.lvl = g.l)::integer as c from generate_series(0, 3) g(l)) l),
      'by_area', (select jsonb_agg(jsonb_build_object('area', ar.area, 'pct_l1', case when tot.n >= 10 and ar.c >= 10 then kafaa_cec_pct1(ar.c, tot.n) else null end) order by ar.ord)
        from (select y.area, y.ord, (select count(*) from x cross join lateral jsonb_array_elements(x.areas) e where e ->> 'area' = y.area and (e ->> 'level')::integer >= 1)::integer as c
              from (values ('values', 1), ('complexity', 2), ('futures', 3), ('acting', 4)) y(area, ord)) ar),
      'by_family', (select coalesce(jsonb_agg(jsonb_build_object('family_id', f.fam, 'n', case when f.c >= 10 then f.c else null end,
          'target', (select t.level from kafaa_cec_role_targets t where t.family_id = f.fam order by t.id collate "C" limit 1),
          'pct_met', case when f.c >= 10 and f.m >= 10 then kafaa_cec_pct1(f.m, f.c) else null end) order by f.fam collate "C"), '[]'::jsonb)
        from (select x.fam, count(*)::integer as c, count(*) filter (where x.st = 'met')::integer as m from x
              where x.fam is not null and x.fam not in ('security', 'safeguards', 'cyber') group by x.fam) f)) r from tot`;
  const cmp = async (label) => {
    const a = (await q1(`select kafaa_cec_stats_core() r`)).r;
    const b = (await q1(REF)).r;
    ok(JSON.stringify(a) === JSON.stringify(b), `kafaa_cec_stats_core = profile formula (${label}): staff ${a?.staff}, pct_l1 ${a?.pct_l1}, pct_met ${a?.pct_met}`);
  };
  await cmp('seed');
  await db.exec('begin');
  try {
    // levels above 3, a claimed-only skill, a retired competence, a family without target rows, a person whose evidence goes inactive
    await db.exec(`update kafaa_person_skills set level = 4 where id in (select id from kafaa_person_skills where active and level >= 1 and basis = 'verified' order by id limit 40)`);
    await db.exec(`update kafaa_person_skills set basis = 'claimed' where id in (select id from kafaa_person_skills where active and level >= 1 and basis = 'validated' order by id limit 40)`);
    await db.exec(`update kafaa_person_skills set active = false where id in (select id from kafaa_person_skills where active and level >= 2 order by id desc limit 60)`);
    await db.exec(`update kafaa_cec_competences set status = 'retired' where id = (select id from kafaa_cec_competences where status = 'active' order by sort, id limit 1)`);
    await db.exec(`update kafaa_people set job_family_id = 'no-such-family' where id in (select id from kafaa_people where kind = 'staff' and status = 'active' order by id limit 12)`);
    await cmp('edited data');
  } finally { await db.exec('rollback'); }

  // ── 6 Arabic columns
  const cols = await q(`select table_name || '.' || column_name c from information_schema.columns where (table_name, column_name) in
    (('kafaa_job_roles', 'regulation_ref_ar'), ('kafaa_career_paths', 'rule_ref_ar'), ('kafaa_programmes', 'population_note_ar'), ('kafaa_programmes', 'conflict_note_ar'),
     ('kafaa_talent_programmes', 'conflict_note_ar'), ('kafaa_facts', 'conflict_note_ar'), ('kafaa_vacancies', 'location_ar'))`);
  ok(cols.length === 7, `7 Arabic columns present (${cols.length})`);
  const missing = await q(`select 'job_roles' t, count(*)::int n from kafaa_job_roles where regulation_ref is not null and regulation_ref_ar is null
    union all select 'career_paths', count(*)::int from kafaa_career_paths where rule_ref is not null and rule_ref_ar is null
    union all select 'programmes', count(*)::int from kafaa_programmes where (population_note is not null and population_note_ar is null) or (conflict_note is not null and conflict_note_ar is null)
    union all select 'talent_programmes', count(*)::int from kafaa_talent_programmes where conflict_note is not null and conflict_note_ar is null
    union all select 'facts', count(*)::int from kafaa_facts where conflict_note is not null and conflict_note_ar is null
    union all select 'vacancies', count(*)::int from kafaa_vacancies where location is not null and location_ar is null`);
  ok(missing.every((r) => r.n === 0), `seed: every English value has its Arabic (${missing.map((r) => `${r.t} ${r.n}`).join(', ')})`);
}
