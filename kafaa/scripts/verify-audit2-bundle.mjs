// Dry run of the final-audit live-apply bundle (docs/kafaa/ref/live_apply/audit2/) on PGlite, starting from a model of the live project:
// the NEXUS stubs, Supabase's default privileges, every migration and the seed of a base ref (default origin/main), and the live data
// clean-up of 2026-10-13 (the three duplicate open enrolments cancelled). Then:
//   1. records the "before" state (function md5s, grants, policies, NEXUS fingerprint);
//   2. checks that part 09 refuses (raise exception, nothing changed) while a duplicate open enrolment exists;
//   3. applies parts 01-09 in ORDER.txt order twice (idempotence) and the data_update part twice (16 rows, then 0);
//   4. prints the "after" state and compares it with EXPECTED.md (md5 table rows "| `fn(args)` | `md5` |" and the counts in section 4);
//   5. runs the behaviour checks of scripts/validate/audit2-fixes.mjs on the result (inside a transaction that is rolled back).
//   node scripts/verify-audit2-bundle.mjs [base-ref]
import { PGlite } from '@electric-sql/pglite';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const BASE = process.argv[2] ?? 'origin/main';
const DIR = '../docs/kafaa/ref/live_apply/audit2';
const read = (p) => readFileSync(p, 'utf8');
const db = new PGlite();
const q = async (sql, p = []) => (await db.query(sql, p)).rows;
let bad = 0;
const ok = (c, m) => { if (c) console.log(`  ✓ ${m}`); else { bad++; console.log(`  ✗ ${m}`); } };

await db.exec(read('supabase/tests/nexus_stubs.sql'));
await db.exec((await import('./validate/fsqa8-grants.mjs')).SUPABASE_DEFAULT_PRIVILEGES);
const files = execSync(`git ls-tree -r --name-only ${BASE} -- supabase/migrations`).toString().trim().split('\n').map((x) => x.split('/').pop()).filter((f) => f.endsWith('.sql')).sort();
if (files.some((f) => f.includes('audit2'))) { console.error(`base ${BASE} already holds the audit2 migrations: choose the ref before them`); process.exit(1); }
for (const m of files) await db.exec(execSync(`git show ${BASE}:kafaa/supabase/migrations/${m}`, { maxBuffer: 1 << 28 }).toString());
await db.exec(execSync(`git show ${BASE}:kafaa/supabase/seed.sql`, { maxBuffer: 1 << 30 }).toString());
console.log(`base: ${files.length} migrations + seed of ${BASE}, Supabase default privileges`);

const FNS = ['kafaa_client_ip', 'kafaa_rl_hit', 'kafaa_dalil_turn', 'kafaa_verify_limited', 'kafaa_verify_audit', 'kafaa_verify_refuse', 'kafaa_verify_badge', 'kafaa_verify_microcred',
  'kafaa_verify_record_share', 'kafaa_submit_contact', 'kafaa_dg_compose', 'kafaa_submit_application', 'kafaa_mnt_trim', 'kafaa_mnt_ratings'];
const state = async () => ({
  fns: await q(`select p.proname, pg_get_function_identity_arguments(p.oid) args, md5(p.prosrc) m, p.prosecdef d, p.provolatile v, coalesce(array_to_string(p.proconfig, ','), '') cfg,
      has_function_privilege('anon', p.oid, 'execute') a, has_function_privilege('authenticated', p.oid, 'execute') u
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any($1) order by 1, 2`, [FNS]),
  grants: await q(`select r.rolname g, x.p, count(*)::int n from pg_class c join pg_namespace s on s.oid = c.relnamespace
      cross join (values ('anon'), ('authenticated')) r(rolname) cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) x(p)
     where s.nspname = 'public' and c.relkind in ('r', 'p') and c.relname like 'kafaa\\_%' and (has_table_privilege(r.rolname, c.oid, x.p) or (x.p in ('SELECT', 'INSERT', 'UPDATE') and has_any_column_privilege(r.rolname, c.oid, x.p)))
     group by 1, 2 order by 1, 2`),
  policies: await q(`select cmd, count(*)::int n from pg_policies where schemaname = 'public' and tablename like 'kafaa\\_%' group by 1 order by 1`),
  tables: Number((await q(`select count(*)::int n from pg_class c join pg_namespace s on s.oid = c.relnamespace where s.nspname = 'public' and c.relkind = 'r' and c.relname like 'kafaa\\_%'`))[0].n),
  nexus: (await q(`select md5(string_agg(x, '|' order by x)) m from (
      select 'p:' || c.relname || ':' || r.rolname || ':' || x.p as x from pg_class c join pg_namespace s on s.oid = c.relnamespace cross join (values ('anon'), ('authenticated')) r(rolname)
        cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) x(p)
       where s.nspname = 'public' and c.relkind in ('r', 'p') and c.relname not like 'kafaa\\_%' and has_table_privilege(r.rolname, c.oid, x.p)
      union all select 'pol:' || tablename || ':' || policyname || ':' || coalesce(qual, '') || ':' || coalesce(with_check, '') from pg_policies where schemaname = 'public' and tablename not like 'kafaa\\_%'
      union all select 'fn:' || p.proname || ':' || md5(p.prosrc) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname not like 'kafaa\\_%'
      union all select 'acl:' || coalesce(d.defaclacl::text, '') from pg_default_acl d) t`))[0].m,
});
const show = (s) => {
  for (const f of s.fns) console.log(`    ${f.proname}(${f.args}) ${f.m} ${f.v}${f.d ? ' secdef' : ''}${f.cfg ? ` ${f.cfg}` : ''} anon=${f.a} auth=${f.u}`);
  console.log(`    grants on kafaa_* tables: ${s.grants.map((g) => `${g.g} ${g.p} ${g.n}`).join(' · ')}`);
  console.log(`    policies on kafaa_* tables: ${s.policies.map((p) => `${p.cmd} ${p.n}`).join(' · ')}; kafaa_* tables ${s.tables}; NEXUS fingerprint ${s.nexus}`);
};

// the live clean-up of 2026-10-13 (done on live before this bundle): the three duplicate open enrolments cancelled
const dupSql = `update kafaa_enrolments set status = 'cancelled', decision_note = 'Duplicate enrolment closed in data clean-up 2026-10-13 (kept ' || k.kept || ')'
  from (values ('en-133', 'en-166'), ('en-140', 'en-164'), ('en-173', 'en-244')) k(id, kept) where kafaa_enrolments.id = k.id and status <> 'cancelled'`;

const before = await state();
console.log('before:'); show(before);
const order = read(`${DIR}/ORDER.txt`).trim().split('\n');
const last = order[order.length - 1];
// 2. the guard of the last part
const dups = Number((await q(`select count(*)::int n from (select 1 from kafaa_enrolments where status in ('assigned','requested','approved','waitlisted','enrolled','in_progress') group by person_id, course_id having count(*) > 1) d`))[0].n);
if (dups > 0) {
  let msg = null;
  try { await db.exec(read(`${DIR}/${last}`)); } catch (e) { msg = e.message; }
  const idx = Number((await q(`select count(*)::int n from pg_indexes where indexname = 'kafaa_enrolments_open_person_course_uniq'`))[0].n);
  ok(/close the duplicates first/.test(msg ?? '') && idx === 0, `${last} refuses while ${dups} duplicate open enrolments exist (${(msg ?? 'no error').slice(0, 120)}...) and creates nothing`);
  await db.exec(dupSql);
  console.log('  simulated the live clean-up of 2026-10-13 (en-133, en-140, en-173 cancelled)');
}
// 3. parts twice, data update twice
for (let pass = 1; pass <= 2; pass++) {
  for (const f of order) { try { await db.exec(read(`${DIR}/${f}`)); } catch (e) { console.error(`✗ ${f} (pass ${pass}): ${e.message}`); process.exit(1); } }
  console.log(`pass ${pass}: ${order.length} parts applied`);
}
const du = read(`${DIR}/data_update/01_kafaa_audit2_role_notes_ar_values_p1.sql`);
const n1 = (await db.exec(du)).reduce((s, r) => s + (r.affectedRows ?? 0), 0);
const n2 = (await db.exec(du)).reduce((s, r) => s + (r.affectedRows ?? 0), 0);
ok(n1 === 16 && n2 === 0, `data_update part: ${n1} roles get an Arabic note on the first run, ${n2} on the second`);
const after = await state();
console.log('after:'); show(after);
ok(after.nexus === before.nexus, 'NEXUS tables, policies, functions and default privileges are unchanged');

// 4. compare with EXPECTED.md
const md = read(`${DIR}/EXPECTED.md`);
let n = 0, nb = 0;
const sec2 = md.split('## 2.')[1]?.split('## 3.')[0] ?? '';
for (const m of sec2.matchAll(/^\| `(kafaa_\w+)\(([^)]*)\)` \| `([0-9a-f]{32})` \|/gm)) {
  n++;
  const f = after.fns.find((x) => x.proname === m[1] && x.args === m[2]);
  if (f?.m !== m[3]) { nb++; console.log(`  ✗ md5 ${m[1]}(${m[2]}): ${f?.m} != ${m[3]}`); }
}
ok(n > 0 && nb === 0, `function bodies: ${n - nb}/${n} equal EXPECTED.md`);
for (const m of md.matchAll(/^\| (anon|authenticated) \| (SELECT|INSERT|UPDATE|DELETE|TRUNCATE) \| (\d+) \| (\d+) \|/gm)) {
  const b = before.grants.find((g) => g.g === m[1] && g.p === m[2])?.n ?? 0;
  const a = after.grants.find((g) => g.g === m[1] && g.p === m[2])?.n ?? 0;
  ok(String(b) === m[3] && String(a) === m[4], `grants ${m[1]} ${m[2]}: before ${b} (EXPECTED ${m[3]}), after ${a} (EXPECTED ${m[4]})`);
}
for (const m of md.matchAll(/^\| policies (SELECT|INSERT|UPDATE) \| (\d+) \| (\d+) \|/gm)) {
  const b = before.policies.find((p) => p.cmd === m[1])?.n ?? 0;
  const a = after.policies.find((p) => p.cmd === m[1])?.n ?? 0;
  ok(String(b) === m[2] && String(a) === m[3], `policies ${m[1]}: before ${b} (EXPECTED ${m[2]}), after ${a} (EXPECTED ${m[3]})`);
}

// 5. behaviour checks (rolled back), as scripts/validate/audit2-fixes.mjs runs them in npm run migrations:validate
const P = { 'alnoor-gm': 'org-alnoor', 'k-university': 'ku', 'k-auditor': 'enec-ops', 'k-admin': 'enec-ops', 'training-mgr': 'enec-ops' };
const uid = {};
let i = 0;
for (const [persona, org] of Object.entries(P)) {
  uid[persona] = `00000000-0000-4000-8000-${String(++i).padStart(12, '0')}`;
  await db.query('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, org, org === 'enec-ops' ? 'employee' : 'partner', [persona]]);
}
const as = async (persona, sql, params = []) => {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [persona ? JSON.stringify({ sub: uid[persona] }) : '']);
  await db.exec(persona ? 'set role authenticated' : 'set role anon');
  try { return (await db.query(sql, params)).rows; } finally { await db.exec('reset role'); }
};
const one = async (persona, sql, params) => (await as(persona, sql, params))[0];
await (await import('./validate/audit2-fixes.mjs')).default({ db, as, one, ok, uid, count: null });
console.log(bad ? `\n${bad} check(s) FAILED` : '\nAudit2 bundle dry run: all checks passed');
process.exit(bad ? 1 : 0);
