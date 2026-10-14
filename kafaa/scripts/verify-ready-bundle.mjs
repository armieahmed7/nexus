// Readiness fixes 2026-10-13: the live-apply bundle docs/kafaa/ref/live_apply/ready/ (build and dry run).
//   node scripts/verify-ready-bundle.mjs --write [base-ref]   (re)build the parts, the two data parts and ORDER.txt from the migrations
//   node scripts/verify-ready-bundle.mjs [base-ref]           dry run on PGlite, starting from a model of the live project: the NEXUS stubs,
//                                                             Supabase's default privileges, every migration and the seed of base-ref
//                                                             (default origin/main). Then:
//   1. records the "before" state (md5 of the function bodies the bundle replaces, the policy fingerprint, grants, NEXUS fingerprint);
//   2. applies the parts in ORDER.txt order twice (idempotence) and each data part twice (N rows, then 0);
//   3. prints the "after" state and compares it with EXPECTED.md (md5 rows "| `fn(args)` | `md5` |", grant and policy counts);
//   4. runs the behaviour checks of scripts/validate/ready-fixes.mjs on the result.
import { PGlite } from '@electric-sql/pglite';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const BASE = args.find((a) => !a.startsWith('--')) ?? 'origin/main';
const DIR = '../docs/kafaa/ref/live_apply/ready';
const MAX = 60 * 1024;
const read = (p) => readFileSync(p, 'utf8');
const MIGS = readdirSync('supabase/migrations').filter((f) => /^20261013200\d{3}_kafaa_ready_.*\.sql$/.test(f)).sort();
const partOf = (f) => f.replace(/^\d+_/, '').replace(/\.sql$/, '');
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

/** Top-level statements (dollar quotes, quotes and comments respected), each with its leading comments. */
function statements(sql) {
  const out = [];
  let i = 0, start = 0, dq = null;
  while (i < sql.length) {
    if (dq) { if (sql.startsWith(dq, i)) { i += dq.length; dq = null; } else i++; continue; }
    const c = sql[i];
    if (c === '-' && sql[i + 1] === '-') { const e = sql.indexOf('\n', i); i = e < 0 ? sql.length : e + 1; continue; }
    if (c === "'") { i++; while (i < sql.length) { if (sql[i] === "'" && sql[i + 1] === "'") i += 2; else if (sql[i] === "'") { i++; break; } else i++; } continue; }
    if (c === '$') { const m = sql.slice(i).match(/^\$[A-Za-z_]*\$/); if (m) { dq = m[0]; i += dq.length; continue; } }
    if (c === ';') { out.push(sql.slice(start, i + 1)); start = i + 1; }
    i++;
  }
  const rest = sql.slice(start);
  if (rest.trim()) out.push(rest);
  return out;
}

if (WRITE) {
  if (existsSync(DIR)) for (const f of readdirSync(DIR)) if (f.endsWith('.sql') || f === 'ORDER.txt') rmSync(`${DIR}/${f}`);
  mkdirSync(`${DIR}/data_update`, { recursive: true });
  const order = [];
  let nn = 0;
  for (const f of MIGS) {
    const part = partOf(f);
    const chunks = [];
    let cur = '';
    for (const st of statements(read(`supabase/migrations/${f}`))) {
      if (cur && cur.length + st.length > MAX) { chunks.push(cur); cur = ''; }
      cur += st;
    }
    if (cur.trim()) chunks.push(cur);
    chunks.forEach((c, k) => {
      const name = `${part}_p${k + 1}`;
      const file = `${String(++nn).padStart(2, '0')}_${name}.sql`;
      writeFileSync(`${DIR}/${file}`, `-- ${name} (${k + 1}/${chunks.length}) · from kafaa/supabase/migrations/${f} (readiness fixes 2026-10-13, branch readiness-fixes)
-- Apply with apply_migration name "${name}", in ORDER.txt order. Idempotent; a second run changes nothing; kafaa_* objects only. See EXPECTED.md.
${c.replace(/^\n+/, '')}${c.endsWith('\n') ? '' : '\n'}`);
      order.push(file);
    });
  }
  writeFileSync(`${DIR}/ORDER.txt`, `${order.join('\n')}\n`);
  // data parts: guarded UPDATEs generated from the seed finalizer's maps (scripts/seed/ext/zz-ready-integrity.mjs)
  const { AR } = await import('./seed/ext/zz-ready-integrity.mjs');
  let d1 = `-- kafaa_ready_ar_values_p1 (1/1) · readiness fixes 2026-10-13, finding 6 · DATA UPDATE: apply only with the owner's explicit approval
-- Apply with apply_migration name "kafaa_ready_ar_values_p1", any time after part kafaa_ready_ar_columns_p1 (it adds the columns).
-- Fills the Arabic columns with the values a fresh build seeds (scripts/seed/ext/zz-ready-integrity.mjs AR). Guarded: a row changes only while
-- its English value is the seeded text and its Arabic value is still empty, so a second run (or an edited row) changes nothing. Touches only
-- the *_ar columns named; the tables' audit triggers write one audit row per changed row. Expected: see EXPECTED.md section 6.
`;
  for (const [key, map] of Object.entries(AR)) {
    const [table, col] = key.split('.');
    for (const [en, ar] of Object.entries(map)) d1 += `update kafaa_${table} set ${col}_ar = ${lit(ar)} where ${col} = ${lit(en)} and ${col}_ar is null;\n`;
  }
  writeFileSync(`${DIR}/data_update/01_kafaa_ready_ar_values_p1.sql`, d1);
  console.log(`wrote ${order.length} parts and 1 data part to ${DIR}`);
  process.exit(0);
}

// ───────────── dry run
const db = new PGlite();
const q = async (sql, p = []) => (await db.query(sql, p)).rows;
let bad = 0;
const ok = (c, m) => { if (c) console.log(`  ✓ ${m}`); else { bad++; console.log(`  ✗ ${m}`); } };
await db.exec(read('supabase/tests/nexus_stubs.sql'));
await db.exec((await import('./validate/fsqa8-grants.mjs')).SUPABASE_DEFAULT_PRIVILEGES);
const files = execSync(`git ls-tree -r --name-only ${BASE} -- supabase/migrations`).toString().trim().split('\n').map((x) => x.split('/').pop()).filter((f) => f.endsWith('.sql')).sort();
if (files.some((f) => f.includes('kafaa_ready_'))) { console.error(`base ${BASE} already holds the readiness migrations: choose the ref before them`); process.exit(1); }
for (const m of files) await db.exec(execSync(`git show ${BASE}:kafaa/supabase/migrations/${m}`, { maxBuffer: 1 << 28 }).toString());
await db.exec(execSync(`git show ${BASE}:kafaa/supabase/seed.sql`, { maxBuffer: 1 << 30 }).toString());
console.log(`base: ${files.length} migrations + seed of ${BASE}, Supabase default privileges`);

const FNS = ['kafaa_scope_people', 'kafaa_mirror_now', 'kafaa_crew_availability', 'kafaa_sc_available', 'kafaa_cec_stats_core', 'kafaa_route_guard', 'kafaa_route_ok_for', 'kafaa_dg_compute', 'kafaa_build_digest'];
export const POLICY_FINGERPRINT = `select md5(string_agg(tablename || '|' || policyname || '|' || cmd || '|' || coalesce(qual, '') || '|' || coalesce(with_check, ''), E'\\n' order by tablename collate "C", policyname collate "C")) m
  from pg_policies where schemaname = 'public' and tablename like 'kafaa\\_%'`;
const state = async () => ({
  fns: await q(`select p.proname, pg_get_function_identity_arguments(p.oid) args, md5(p.prosrc) m, p.prosecdef d, coalesce(array_to_string(p.proconfig, ','), '') cfg,
      has_function_privilege('anon', p.oid, 'execute') a, has_function_privilege('authenticated', p.oid, 'execute') u
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any($1) order by 1, 2`, [FNS]),
  grants: await q(`select r.rolname g, x.p, count(*)::int n from pg_class c join pg_namespace s on s.oid = c.relnamespace
      cross join (values ('anon'), ('authenticated')) r(rolname) cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) x(p)
     where s.nspname = 'public' and c.relkind in ('r', 'p') and c.relname like 'kafaa\\_%' and (has_table_privilege(r.rolname, c.oid, x.p) or (x.p in ('SELECT', 'INSERT', 'UPDATE') and has_any_column_privilege(r.rolname, c.oid, x.p)))
     group by 1, 2 order by 1, 2`),
  policies: await q(`select cmd, count(*)::int n from pg_policies where schemaname = 'public' and tablename like 'kafaa\\_%' group by 1 order by 1`),
  perRow: Number((await q(`select count(*)::int n from pg_policies where schemaname = 'public' and tablename like 'kafaa\\_%' and (qual like '%kafaa_rule_read(%' or with_check like '%kafaa_rule_read(%')`))[0].n),
  policyMd5: (await q(POLICY_FINGERPRINT))[0].m,
  nexus: (await q(`select md5(string_agg(x, '|' order by x)) m from (
      select 'p:' || c.relname || ':' || r.rolname || ':' || x.p as x from pg_class c join pg_namespace s on s.oid = c.relnamespace cross join (values ('anon'), ('authenticated')) r(rolname)
        cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) x(p)
       where s.nspname = 'public' and c.relkind in ('r', 'p') and c.relname not like 'kafaa\\_%' and has_table_privilege(r.rolname, c.oid, x.p)
      union all select 'pol:' || tablename || ':' || policyname || ':' || coalesce(qual, '') || ':' || coalesce(with_check, '') from pg_policies where schemaname = 'public' and tablename not like 'kafaa\\_%'
      union all select 'fn:' || p.proname || ':' || md5(p.prosrc) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname not like 'kafaa\\_%'
      union all select 'acl:' || coalesce(d.defaclacl::text, '') from pg_default_acl d) t`))[0].m,
});
const show = (s) => {
  for (const f of s.fns) console.log(`    ${f.proname}(${f.args}) ${f.m}${f.d ? ' secdef' : ''}${f.cfg ? ` ${f.cfg}` : ''} anon=${f.a} auth=${f.u}`);
  console.log(`    grants on kafaa_* tables: ${s.grants.map((g) => `${g.g} ${g.p} ${g.n}`).join(' · ')}`);
  console.log(`    policies: ${s.policies.map((p) => `${p.cmd} ${p.n}`).join(' · ')}; ${s.perRow} with a per-row kafaa_rule_read; fingerprint ${s.policyMd5}; NEXUS fingerprint ${s.nexus}`);
};
const before = await state();
console.log('before:'); show(before);
const gen = read('supabase/migrations/20261013200002_kafaa_ready_rls_scope.sql').match(/Policies before this file \(fingerprint[^)]*\): ([0-9a-f]{32})/)?.[1];
ok(gen === before.policyMd5, `the generated ALTER POLICY part was computed from these policies (fingerprint ${before.policyMd5}; generator ${gen})`);

const order = read(`${DIR}/ORDER.txt`).trim().split('\n');
for (let pass = 1; pass <= 2; pass++) {
  for (const f of order) { try { await db.exec(read(`${DIR}/${f}`)); } catch (e) { console.error(`✗ ${f} (pass ${pass}): ${e.message}`); process.exit(1); } }
  console.log(`pass ${pass}: ${order.length} parts applied`);
}
const runData = async (f) => (await db.exec(read(`${DIR}/data_update/${f}`))).reduce((s, r) => s + (r.affectedRows ?? 0), 0);
const a1 = await runData('01_kafaa_ready_ar_values_p1.sql'), a2 = await runData('01_kafaa_ready_ar_values_p1.sql');
console.log(`data part: Arabic values ${a1} then ${a2} rows`);
const after = await state();
console.log('after:'); show(after);
ok(after.nexus === before.nexus, 'NEXUS tables, policies, functions and default privileges are unchanged');
ok(after.perRow === 0, `no kafaa_* policy calls kafaa_rule_read per row (before: ${before.perRow})`);
ok(JSON.stringify(after.grants) === JSON.stringify(before.grants), 'table grants on kafaa_* unchanged');
ok(JSON.stringify(after.policies) === JSON.stringify(before.policies), 'policy counts unchanged (ALTER POLICY only)');

const md = read(`${DIR}/EXPECTED.md`);
const sec = (n) => md.split(`## ${n}.`)[1]?.split(/\n## \d/)[0] ?? '';
let n = 0, nb = 0;
for (const m of sec(2).matchAll(/^\| `(kafaa_\w+)\(([^)]*)\)` \| `([0-9a-f]{32}|-)` \| `([0-9a-f]{32})` \|/gm)) {
  n++;
  const b = before.fns.find((x) => x.proname === m[1] && x.args === m[2]);
  const f = after.fns.find((x) => x.proname === m[1] && x.args === m[2]);
  if ((m[3] === '-' ? b : b?.m !== m[3]) || f?.m !== m[4]) { nb++; console.log(`  ✗ md5 ${m[1]}(${m[2]}): before ${b?.m ?? '-'} / ${m[3]}, after ${f?.m} / ${m[4]}`); }
}
ok(n === FNS.length && nb === 0, `function bodies before and after: ${n - nb}/${n} equal EXPECTED.md`);
const fp = sec(3).match(/before: `([0-9a-f]{32})`, after: `([0-9a-f]{32})`/);
ok(fp && fp[1] === before.policyMd5 && fp[2] === after.policyMd5, `policy fingerprint EXPECTED.md ${fp?.[1]} -> ${fp?.[2]}`);
const dm = sec(6).match(/first run: (\d+) rows/);
ok(dm && Number(dm[1]) === a1 && a2 === 0, `data part: ${a1} rows (EXPECTED ${dm?.[1]}), 0 on the second run`);

// behaviour checks (as npm run migrations:validate runs them)
const P = ['training-mgr', 'sro', 'k-instructor', 'k-hr-analyst', 'k-licensing-coord', 'k-ro', 'k-auditor', 'k-admin', 'k-student', 'k-university', 'alnoor-gm', 'k-observer', 'rp-lead', 'outage-manager'];
const uid = {};
let i = 0;
for (const persona of P) {
  uid[persona] = `00000000-0000-4000-8000-${String(9100 + ++i).padStart(12, '0')}`;
  await db.query(`insert into profiles (user_id, email, persona_id, org_id, lens, roles) select $1, $2, $3, coalesce(p.org_id, 'enec-ops'), 'employee', array['Test'] from kafaa_people p where p.persona_id = $3 limit 1 on conflict do nothing`, [uid[persona], `${persona}@ready.test`, persona]);
}
const as = async (persona, sql, params = []) => {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [persona ? JSON.stringify({ sub: uid[persona] }) : '']);
  await db.exec(persona ? 'set role authenticated' : 'set role anon');
  try { return (await db.query(sql, params)).rows; } finally { await db.exec('reset role'); }
};
const one = async (persona, sql, params) => (await as(persona, sql, params))[0];
await (await import('./validate/ready-fixes.mjs')).default({ db, as, one, ok, uid, count: null });
console.log(bad ? `\n${bad} check(s) FAILED` : '\nReadiness bundle dry run: all checks passed');
process.exit(bad ? 1 : 0);
