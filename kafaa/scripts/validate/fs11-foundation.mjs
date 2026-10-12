// [FS · wave A · E1 · FS01/FS02] PGlite checks for 20261010211001_kafaa_fs11_foundation_catalogue.sql:
// benchmark registry (sources, as-of, RLS, write rule, SQL = TS rules), the seven policy resources (SQL = TS matrix),
// the extended skills catalogue (110+, 100% sourced and owned, EN/AR, cyber hygiene out of the security area), "obsolete,
// never delete", the F01 digest of the original 71 skills, the F35 outlook hand-off and "no NEXUS object altered".
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { MATRIX, PLATFORM_ROLES } from '../../src/auth/policy.ts';
import { benchmarkProblems } from '../../src/domain/benchmarks.ts';
import { publishProblems, SKILL_GUARD_MSG } from '../../src/domain/taxonomy.ts';
import { statesDigestText } from '../../src/domain/skills.ts';

const MINE = '20261010211001_kafaa_fs11_foundation_catalogue.sql';
/** sha256 of statesDigestText over the states of the original 71 skills in the master seed before FS02 (06d23f1). */
// FS wave-A integration: FS03's decay model changes the F01 states themselves (per-class half-lives, blended confidence), so the
// baseline is the FS03 digest before the catalogue extension (master after FS03 = branch fsAe2); FS02 still adds no change.
// Pre-FS03 value: 68427633f02b803792825b671f03a6a683bd41826ffbee4e1db850ae8ba0bd0d.
export const F01_DIGEST_71 = 'e53f5501a72a5d22adc8ac96df4885fc54225afc9f10a6840a3c7e0f4a496148';
const NEW_RES = ['skills_taxonomy', 'ai_literacy', 'transformation', 'recognition', 'workforce_strategy', 'ecosystem', 'national_alignment'];

export default async function fs11Checks({ db, as, one, count, ok }) {
  const seed = JSON.parse(readFileSync('src/seed/seed.json', 'utf8'));
  const T = seed.tables;
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  const raises = async (sql, p = []) => { try { await db.query(sql, p); return null; } catch (e) { return e.message; } };

  // ── FS01 benchmark registry
  const bm = await q(`select id, urls, as_of::text as as_of, status, listed, figures from kafaa_benchmarks order by sort`);
  ok(bm.length === 40, `40 benchmark rows seeded (${bm.length})`);
  const httpsOk = await q(`select count(*)::int n from kafaa_benchmarks b where cardinality(urls) >= 1 and as_of is not null and not exists (select 1 from unnest(b.urls) u where u !~ '^https://')`);
  ok(httpsOk[0].n === 40, 'every benchmark row has at least one source, every source is https, and every row has an as-of date');
  ok(T.benchmarks.every((b) => benchmarkProblems(b).length === 0), 'TS benchmarkProblems() is empty for every seeded row (same rules as the SQL checks)');
  ok((await count(null, 'kafaa_benchmarks')) === 40 && (await count('sro', 'kafaa_benchmarks')) === 40, 'anonymous visitors and staff read the 40 published benchmarks');
  const httpErr = await raises(`insert into kafaa_benchmarks (id, name_en, name_ar, owner_en, owner_ar, country_en, country_ar, category, year_from, urls, fact_en, fact_ar, borrow_en, borrow_ar, as_of)
    values ('FS-TEST-HTTP', 'x', 'x', 'x', 'x', 'x', 'x', 'global', 2025, array['http://example.org'], 'x', 'x', 'x', 'x', '2026-10-10')`);
  ok(/kafaa_benchmarks_https_ck/.test(httpErr ?? ''), 'a source that is not https is refused by the check (kafaa_benchmarks_https_ck)');
  const listErr = await raises(`insert into kafaa_benchmarks (id, name_en, name_ar, owner_en, owner_ar, country_en, country_ar, category, year_from, urls, fact_en, fact_ar, borrow_en, borrow_ar, as_of, status, listed)
    values ('FS-TEST-LIST', 'x', 'x', 'x', 'x', 'x', 'x', 'global', 2025, array['https://example.org'], 'x', 'x', 'x', 'x', '2026-10-10', 'draft', true)`);
  ok(/kafaa_benchmarks_listed_ck/.test(listErr ?? ''), 'a draft cannot be listed publicly (kafaa_benchmarks_listed_ck)');
  await db.exec(`set kafaa.seeding = 'on'`);
  await db.query(`insert into kafaa_benchmarks (id, name_en, name_ar, owner_en, owner_ar, country_en, country_ar, category, year_from, urls, fact_en, fact_ar, borrow_en, borrow_ar, as_of, status, listed, sort)
    values ('FS-TEST-DRAFT', 'Draft', 'مسودة', 'x', 'x', 'x', 'x', 'global', 2026, array['https://example.org/draft'], 'x', 'x', 'x', 'x', '2026-10-10', 'draft', false, 9999) on conflict do nothing`);
  await db.exec(`reset kafaa.seeding`);
  ok((await count(null, 'kafaa_benchmarks', `id = 'FS-TEST-DRAFT'`)) === 0 && (await count('sro', 'kafaa_benchmarks', `id = 'FS-TEST-DRAFT'`)) === 0
    && (await count('k-admin', 'kafaa_benchmarks', `id = 'FS-TEST-DRAFT'`)) === 1 && (await count('k-auditor', 'kafaa_benchmarks', `id = 'FS-TEST-DRAFT'`)) === 1 && (await count('training-mgr', 'kafaa_benchmarks', `id = 'FS-TEST-DRAFT'`)) === 1,
    'a draft benchmark is hidden from the public and staff, and read by admins, auditors and the training manager');
  const staffUpd = await as('sro', `update kafaa_benchmarks set borrow_en = borrow_en || ' (x)' where id = 'ESCO' returning id`).catch(() => []);
  const tmUpd = await as('training-mgr', `update kafaa_benchmarks set as_of = as_of where id = 'ESCO' returning id`);
  const anonIns = await as(null, `insert into kafaa_benchmarks (id, name_en, name_ar, owner_en, owner_ar, country_en, country_ar, category, year_from, urls, fact_en, fact_ar, borrow_en, borrow_ar, as_of) values ('FS-TEST-ANON','x','x','x','x','x','x','global',2025,array['https://example.org'],'x','x','x','x','2026-10-10') returning id`).then(() => 'inserted', (e) => e.message);
  ok(staffUpd.length === 0 && tmUpd.length === 1 && anonIns !== 'inserted', 'framework owners edit benchmarks (frameworks W); staff and anonymous visitors cannot write');
  const figs = T.benchmarks.flatMap((b) => b.figures.map((f) => ({ b, f })));
  ok(figs.length >= 40 && figs.every(({ b, f }) => f.quote_en && b.fact_en.includes(f.quote_en)), `every stored benchmark figure quotes its source text (${figs.length} figures)`);

  // ── FS01 policy resources: SQL matrix = TS matrix
  const want = NEW_RES.flatMap((r) => PLATFORM_ROLES.flatMap((role) => (MATRIX[r][role] ?? []).map((l) => `${role}|${r}|${l}`))).sort();
  const got = (await q(`select role || '|' || resource || '|' || level as k from kafaa_policy_matrix where resource = any($1::text[]) order by 1`, [NEW_RES])).map((r) => r.k).sort();
  ok(want.length > 0 && JSON.stringify(want) === JSON.stringify(got), `the seven future-skills resources are in kafaa_policy_matrix exactly as src/auth/policy.ts (${got.length} rows)`);
  ok(!(await q(`select 1 from kafaa_policy_matrix where resource = 'workforce_strategy' and role in ('public', 'employee', 'licensed_operator')`)).length, 'workforce_strategy is never public and never staff-wide');

  // ── FS02 catalogue
  const sk = await q(`select id, name_en, name_ar, sources, owner_role, version, review_due::text as review_due, lifecycle, level_essence_en, level_essence_ar, alt_labels_en, alt_labels_ar, fs_area, area, competency_id, evidence_keys from kafaa_skills`);
  ok(sk.length >= 110, `the catalogue holds at least 110 skills (${sk.length})`);
  const complete = sk.filter((s) => (s.sources ?? []).some((x) => /^https:\/\//.test(x.url ?? '')) && s.owner_role && s.version >= 1 && s.review_due && s.lifecycle);
  ok(complete.length === sk.length, `100% of skills carry an https source, owner, version, review date and lifecycle (${complete.length}/${sk.length})`);
  const fresh = sk.filter((s) => s.fs_area);
  ok(fresh.length >= 44 && fresh.every((s) => s.name_en && s.name_ar && s.level_essence_en && s.level_essence_ar && s.alt_labels_en.length >= 2 && s.alt_labels_ar.length >= 2),
    `every new skill (${fresh.length}) has EN and AR names, a level-essence line and at least 2 alternative labels per language`);
  ok(sk.every((s) => publishProblems(s).filter((p) => p !== 'obsolete').length === 0), 'TS publishProblems() finds nothing missing on any seeded skill');
  const cyber = await q(`select s.id from kafaa_skills s left join kafaa_competencies c on c.id = s.competency_id
    where s.fs_area = 'cyber_hygiene' and (s.area = 'security' or s.competency_id = 'sa-01' or c.domain = 'security'
      or exists (select 1 from unnest(s.evidence_keys) k join kafaa_qual_standards q on q.id = k where q.discipline ilike '%secur%'))`);
  ok(fresh.filter((s) => s.fs_area === 'cyber_hygiene').length >= 3 && cyber.length === 0, 'no cyber-hygiene skill sits in the SA-01 security area or references a security standard');
  ok((await count(null, 'kafaa_skills')) === sk.length, 'anonymous visitors read the whole catalogue (public definitions)');

  // ── obsolete, never delete
  const del = await raises(`delete from kafaa_skills where id = 'sk-fs-dp-paperwp'`);
  ok((del ?? '').includes(SKILL_GUARD_MSG.delete), 'deleting a skill is refused even with owner rights (kafaa_fs_skill_guard)');
  const delApi = await as('training-mgr', `delete from kafaa_skills where id = 'sk-fs-dp-paperwp' returning id`).then((r) => r.length, (e) => e.message);
  ok(delApi === 0 || /permission denied/.test(String(delApi)), 'framework owners have no delete right on skills through the API');
  const unob = await raises(`update kafaa_skills set lifecycle = 'stable' where id = 'sk-fs-dp-paperwp'`);
  ok((unob ?? '').includes(SKILL_GUARD_MSG.unobsolete), 'an obsolete skill cannot return to a live lifecycle state');
  const ver = await raises(`update kafaa_skills set version = 0 where id = 'sk-fs-tr-systems'`);
  ok(!!ver && /version/.test(ver), 'a skill version can only go up');
  const nodate = await raises(`update kafaa_skills set lifecycle = 'obsolete' where id = 'sk-fs-dp-paperlog'`);
  ok(/kafaa_skills_fs_obsolete_ck/.test(nodate ?? ''), 'marking a skill obsolete needs the obsolete date');
  await db.exec('begin');
  const tmObs = await as('training-mgr', `update kafaa_skills set lifecycle = 'obsolete', obsolete_on = '2026-10-10', replaced_by = 'sk-fs-dp-rounds', version = version + 1 where id = 'sk-fs-dp-paperlog' returning id, version`);
  await db.exec('rollback');
  ok(tmObs.length === 1 && tmObs[0].version === 2, 'a framework owner marks a declining skill obsolete with its date and replacement (version + 1)');
  ok((await q(`select 1 from kafaa_skills where id = 'sk-fs-dp-paperwp' and lifecycle = 'obsolete' and replaced_by = 'sk-fs-dp-ework'`)).length === 1, 'the seeded superseded skill stays in the catalogue with its replacement');

  // ── F01 digest of the original 71 skills unchanged; F35 outlook unchanged by the extension
  const orig = new Set(sk.filter((s) => !s.fs_area).map((s) => s.id));
  ok(orig.size === 71, 'the original 71 F01 skills keep their ids');
  const st = await q(`select id, skill_id, level, confidence::float8 as confidence, basis from kafaa_skill_states_compute(null, $1::date)`, [seed.meta.demo_today]);
  const dig = createHash('sha256').update(statesDigestText(st.filter((s) => orig.has(s.skill_id)))).digest('hex');
  // FS10: the AI and digital fitness check records (not derives) capped evidence for FS02 skills; those states are allowed here.
  const fit = new Set((await q(`select distinct 'ps:' || person_id || ':' || skill_id as id from kafaa_skill_evidence where active and ref_table in ('fitness_attempts', 'cohort_capstones', 'adaptive_attempts', 'task_attempts', 'ai_drill_attempts', 'plant_visits', 'twin_attempts', 'rpl_requests', 'programme_alignments', 'lectures', 'knowledge_assets', 'roleplay_sessions')` /* FS10, FS21/FS22 recorded results, FS44 validated contributions */)).map((r) => r.id));
  ok(dig === F01_DIGEST_71 && st.every((s) => orig.has(s.skill_id) || fit.has(s.id)), `F01 recompute over the extended catalogue: the digest of the original 71 skills is unchanged (${dig.slice(0, 12)}…) and no future skill gains a derived state`);
  const adv = await q(`select f->>'key' k, (f->>'adv_t')::int t from jsonb_array_elements((kafaa_so_base(null))->'families') f`).catch(() => []);
  ok(adv.length > 0 && adv.every((r) => r.t === T.skills.filter((s) => s.area === r.k && !s.fs_area).length), 'F35 outlook: family ADVANCE shares count the established catalogue only (kafaa_so_base = outlook.ts)');

  // ── engine settings keep their four stored surfaces (transform and assess serve defaults only)
  ok(/check/i.test((await raises(`insert into kafaa_engine_settings (id, surface) values ('transform', 'transform')`)) ?? ''), 'kafaa_engine_settings keeps its four stored surfaces; transform and assess are kernel defaults');

  // ── no NEXUS object altered: static scan of the file, then a catalogue snapshot of every non-kafaa object before/after
  const sql = readFileSync(`supabase/migrations/${MINE}`, 'utf8').replace(/--[^\n]*/g, '');
  const targets = [...sql.matchAll(/\b(?:alter table|create table if not exists|create index if not exists \w+ on|insert into|create or replace function|comment on table|grant [a-z, ]+ on|alter policy \w+ on|create policy \w+ on|create trigger \w+ [a-z ]+ on|revoke execute on function|references)\s+([a-z_]+)/gi)].map((m) => m[1]);
  ok(targets.length > 20 && targets.every((x) => x.startsWith('kafaa_')), `every object the migration creates, alters or grants is a kafaa_* object (${targets.length} statements)`);
  ok(!/\b(drop|truncate)\b/i.test(sql) && !/\bdelete\s+from\b/i.test(sql), 'the migration contains no drop, truncate or delete');
  const snap = async (pg) => {
    const rows = async (s) => (await pg.query(s)).rows;
    const parts = [
      await rows(`select table_name, column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema = 'public' and table_name not like 'kafaa\\_%' order by 1, 2`),
      await rows(`select c.conrelid::regclass::text t, c.conname, pg_get_constraintdef(c.oid) d from pg_constraint c join pg_class r on r.oid = c.conrelid join pg_namespace n on n.oid = r.relnamespace where n.nspname = 'public' and r.relname not like 'kafaa\\_%' order by 1, 2`),
      await rows(`select tablename, policyname, cmd, qual, with_check from pg_policies where schemaname = 'public' and tablename not like 'kafaa\\_%' order by 1, 2`),
      await rows(`select tgrelid::regclass::text t, tgname from pg_trigger t join pg_class r on r.oid = t.tgrelid where not tgisinternal and r.relname not like 'kafaa\\_%' order by 1, 2`),
      await rows(`select p.proname, md5(p.prosrc) s from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname not like 'kafaa\\_%' order by 1, 2`),
      await rows(`select table_name, grantee, privilege_type from information_schema.role_table_grants where table_schema = 'public' and table_name not like 'kafaa\\_%' order by 1, 2, 3`),
    ];
    return createHash('md5').update(JSON.stringify(parts)).digest('hex');
  };
  const pg = new PGlite();
  await pg.exec(readFileSync('supabase/tests/nexus_stubs.sql', 'utf8'));
  for (const m of readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql') && f < MINE).sort()) await pg.exec(readFileSync(`supabase/migrations/${m}`, 'utf8'));
  const before = await snap(pg);
  await pg.exec(readFileSync(`supabase/migrations/${MINE}`, 'utf8'));
  await pg.exec(readFileSync(`supabase/migrations/${MINE}`, 'utf8')); // idempotent
  const after = await snap(pg);
  await pg.close();
  ok(before === after, `no NEXUS (non-kafaa) table, column, constraint, policy, trigger, function or grant is altered (snapshot ${after.slice(0, 12)}…)`);
  void one;
}
