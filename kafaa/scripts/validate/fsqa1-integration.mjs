// [FS QA · wave A integration] PGlite checks for 20261010219001_kafaa_fs1qa_integration.sql (cross-feature wiring of FS01-FS06).
//  - Forward proof: rows put back to the values the engineers loaded live (FS02 decay classes, FS04 map without the QA rows,
//    FS05 requirements and FS06 future links naming the F01 skills) become exactly the seed (TS fsqa1-integration.mjs) after
//    the migration runs: SQL = TS, table digests equal.
//  - Idempotent on the final seed; guarded (a row edited live is left alone).
//  - The wiring holds on the seed: 2030/2035 requirements and future task links name the FS02 skills, F01 decay classes equal
//    FS03's area default, radar readiness is unchanged by the new keyspace rows (nobody holds the new skills yet).
// Runs on its own fresh PGlite (migrations + seed once), because earlier validators write role profiles and task links.
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { FUTURE_SKILL_EQUIVALENT as EQ, FS_QA_KEYSPACE_ROWS } from '../../src/domain/taxonomy.ts';
import { AREA_DECAY_CLASS } from '../../src/domain/skills.ts';

const FILE = 'supabase/migrations/20261010219001_kafaa_fs1qa_integration.sql';
const TABLES = ['kafaa_skills', 'kafaa_future_skill_map', 'kafaa_adv_skills', 'kafaa_role_profile_versions', 'kafaa_jta_task_skills'];

export default async function fsqa1Checks({ ok }) {
  const db = new PGlite();
  await db.exec(readFileSync('supabase/tests/nexus_stubs.sql', 'utf8'));
  for (const m of readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()) await db.exec(readFileSync(`supabase/migrations/${m}`, 'utf8'));
  await db.exec(readFileSync('supabase/seed.sql', 'utf8'));
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  const digests = async () => Object.fromEntries(await Promise.all(TABLES.map(async (t) => [t, (await q(`select count(*)::int n, md5(coalesce(string_agg(x::text, '|' order by x.id collate "C"), '')) d from ${t} x`))[0]])));
  const sql = readFileSync(FILE, 'utf8');
  const seed = await digests();
  const eqVals = Object.entries(EQ).map(([a, b]) => `('${a}', '${b}')`).join(', ');
  const qaIds = FS_QA_KEYSPACE_ROWS.map(([k, , sk]) => `'fsm:${k}:${sk}'`).join(', ');
  const skillRows = [...sql.matchAll(/\('([^']+)', '(fast|standard|slow)', '(\d{4}-\d\d-\d\d)'::date, '(fast|standard|slow)', '(\d{4}-\d\d-\d\d)'::date\)/g)];
  ok(skillRows.length > 0, `the migration names the F01 skills whose decay class changes (${skillRows.length})`);

  // forward proof inside a transaction (rolled back)
  await db.exec('begin');
  try {
    for (const [, id, oldC, oldD] of skillRows) await q(`update kafaa_skills set decay_class = $2, review_due = $3::date where id = $1`, [id, oldC, oldD]);
    await q(`delete from kafaa_future_skill_map where id in (${qaIds})`);
    await q(`update kafaa_adv_skills a set sk_ids = coalesce((select array_agg(x order by o) from unnest(a.sk_ids) with ordinality u(x, o) where 'fsm:' || a.id || ':' || x not in (${qaIds})), '{}')`);
    await q(`with eq(new_id, old_id) as (values ${Object.entries(EQ).map(([a, b]) => `('${b}', '${a}')`).join(', ')}),
      re as (select r.id, jsonb_agg(case when eq.old_id is not null and e.x->>'kind' = 'skill' then jsonb_set(e.x, '{ref_id}', to_jsonb(eq.old_id)) else e.x end
        order by (e.x->>'kind') collate "C", (case when eq.old_id is not null and e.x->>'kind' = 'skill' then eq.old_id else e.x->>'ref_id' end) collate "C") req
        from kafaa_role_profile_versions r cross join jsonb_array_elements(r.requirements) e(x) left join eq on eq.new_id = e.x->>'ref_id'
        where r.horizon <> 'now' and exists (select 1 from jsonb_array_elements(r.requirements) y(z) join eq on eq.new_id = y.z->>'ref_id') group by r.id)
      update kafaa_role_profile_versions r set requirements = re.req from re where r.id = re.id`);
    await q(`with eq(new_id, old_id) as (values ${Object.entries(EQ).map(([a, b]) => `('${b}', '${a}')`).join(', ')})
      update kafaa_jta_task_skills l set id = 'jts:' || l.task_id || ':' || eq.old_id, skill_id = eq.old_id from eq where l.kind = 'future' and l.skill_id = eq.new_id`);
    const before = await digests();
    ok(TABLES.some((t) => before[t].d !== seed[t].d), 'the engineers\' state differs from the final seed before the migration');
    const stale = (await q(`select count(*)::int n from kafaa_role_profile_versions where horizon <> 'now' and requirements::text like '%sk-da-02-review%'`))[0].n;
    ok(stale > 0, `before: ${stale} future role-profile versions still name the F01 AI-review skill`);
    await db.exec(sql);
    const after = await digests();
    for (const t of TABLES) ok(after[t].n === seed[t].n && after[t].d === seed[t].d, `SQL = TS: ${t} after the QA migration equals the seed (${after[t].n} rows, ${after[t].d.slice(0, 10)}…)`);
  } finally { await db.exec('rollback'); }

  // idempotent and guarded
  await db.exec('begin');
  try {
    await db.exec(sql);
    const again = await digests();
    ok(TABLES.every((t) => again[t].d === seed[t].d), 'idempotent: a second run on the final seed changes nothing');
    const [, id, , , newD] = skillRows[0];
    await q(`update kafaa_skills set decay_class = 'fast', review_due = '2027-03-01' where id = $1`, [id]);
    await db.exec(sql);
    const kept = (await q(`select decay_class, review_due::text d from kafaa_skills where id = $1`, [id]))[0];
    ok(kept.decay_class === 'fast' && kept.d === '2027-03-01' && newD !== '2027-03-01', 'guarded: a decay class an admin changed live is left alone');
  } finally { await db.exec('rollback'); }

  // the wiring on the seed
  const olds = Object.keys(EQ).map((x) => `'${x}'`).join(', ');
  const n1 = (await q(`select count(*)::int n from kafaa_role_profile_versions r, jsonb_array_elements(r.requirements) e(x) where r.horizon <> 'now' and e.x->>'kind' = 'skill' and e.x->>'ref_id' in (${olds})`))[0].n;
  const n2 = (await q(`select count(*)::int n from kafaa_role_profile_versions r, jsonb_array_elements(r.requirements) e(x) where r.horizon <> 'now' and e.x->>'ref_id' in (${Object.values(EQ).map((x) => `'${x}'`).join(', ')})`))[0].n;
  ok(n1 === 0 && n2 > 0, `FS05 -> FS02: 2030/2035 requirements name the FS02 skills (${n2}), none the F01 equivalents`);
  const fl = (await q(`select count(*)::int n, count(*) filter (where s.fs_area is not null)::int fs, count(*) filter (where l.skill_id in (${olds}))::int old from kafaa_jta_task_skills l join kafaa_skills s on s.id = l.skill_id where l.kind = 'future'`))[0];
  ok(fl.old === 0 && fl.fs > 0, `FS06 -> FS02: future task links name FS02 skills (${fl.fs} of ${fl.n}), none the F01 equivalents`);
  // FS13 (wave B) adds its own FS02 keyspace rows; this check counts the wave-A QA rows only
  const keys = (await q(`select count(*)::int n from kafaa_future_skill_map m join kafaa_skills s on s.id = m.sk_id where s.fs_area is not null and m.active and m.id in (${qaIds})`))[0].n;
  ok(keys === FS_QA_KEYSPACE_ROWS.length, `FS04 -> FS02: ${keys} active keyspace rows name FS02 skills`);
  const adv = (await q(`select count(*)::int n from kafaa_adv_skills a where exists (select 1 from kafaa_future_skill_map m where m.key = a.id and m.active and not (m.sk_id = any(a.sk_ids)))`))[0].n;
  ok(adv === 0, 'adv_skills.sk_ids lists every active keyspace row of its key');
  const sk = await q(`select id, area, decay_class from kafaa_skills where fs_area is null`);
  ok(sk.every((s) => s.decay_class === (AREA_DECAY_CLASS[s.area] ?? 'standard')), `FS02 <-> FS03: all ${sk.length} F01 skills store FS03's area decay class`);
  // FS10 (wave B): the AI and digital fitness check now evidences some FS02 AI skills (level <= 2); no other source does yet.
  const holders = (await q(`select count(*)::int n from kafaa_person_skills p where p.active and p.level > 0 and p.skill_id in (select sk_id from kafaa_future_skill_map where id in (${qaIds}))
    and exists (select 1 from kafaa_skill_evidence e where e.person_id = p.person_id and e.skill_id = p.skill_id and e.active and e.ref_table not in ('fitness_attempts', 'cohort_capstones', 'adaptive_attempts', 'task_attempts', 'ai_drill_attempts', 'plant_visits', 'twin_attempts', 'microcred_awards', 'rpl_requests', 'programme_alignments', 'lectures', 'knowledge_assets', 'roleplay_sessions', 'skill_suggestions', 'external_certs'))` /* FS72 (fsHe1) confirmed suggestions; FS21/FS22 recorded results too; FS44 validated contributions */))[0].n;
  ok(holders === 0, 'nobody holds the FS02 skills of the new keyspace rows except through FS10 fitness-check evidence (level <= 2)');
  await db.close();
}
