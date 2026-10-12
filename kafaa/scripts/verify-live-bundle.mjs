// Dry run of a live-apply bundle on PGlite: a database in the state the live project is in before the wave (the earlier migrations
// plus the base ref's seed), then every bundle part in file order (twice, for idempotence), then the md5s and digests of EXPECTED.md.
//   node scripts/verify-live-bundle.mjs <config.json>
import { PGlite } from '@electric-sql/pglite';
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
const cfg = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const read = (p) => readFileSync(p, 'utf8');
const db = new PGlite();
await db.exec(read('supabase/tests/nexus_stubs.sql'));
const first = cfg.migrations[0].file;
// every migration before the wave as the base ref has it (the generated schema / RLS files differ after the wave), then the base seed
const baseFiles = execSync(`git ls-tree -r --name-only ${cfg.base_ref} -- supabase/migrations`).toString().trim().split('\n').map((x) => x.split('/').pop()).filter((f) => f.endsWith('.sql') && f < first).sort();
for (const m of baseFiles) await db.exec(execSync(`git show ${cfg.base_ref}:kafaa/supabase/migrations/${m}`, { maxBuffer: 1 << 28 }).toString());
await db.exec(execSync(`git show ${cfg.base_ref}:kafaa/supabase/seed.sql`, { maxBuffer: 1 << 30 }).toString());
console.log('base state loaded (migrations before the wave + base seed)');
const parts = readdirSync(cfg.out).filter((f) => f.endsWith('.sql')).sort();
// optional: make the base look like live where live is known to differ from the local seed (wave G: the mentoring card at version 13)
for (const s of cfg.dry_run_live_state ?? []) { await db.exec(`select set_config('kafaa.seeding', 'on', false); ${s.sql}`); console.log(`live-state simulation: ${s.label}`); }
for (let pass = 1; pass <= 2; pass++) {
  for (const f of parts) { try { await db.exec(read(`${cfg.out}/${f}`)); } catch (e) { console.error(`✗ ${f} (pass ${pass}): ${e.message}`); process.exit(1); } }
  console.log(`pass ${pass}: ${parts.length} parts applied`);
}
const md = read(`${cfg.out}/EXPECTED.md`);
let bad = 0, n = 0;
for (const m of md.matchAll(/^\| `(kafaa_\w+)\(([^)]*)\)` \| `([0-9a-f]{32})` \|$/gm)) {
  const r = (await db.query(`select md5(p.prosrc) m from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = $1 and pg_get_function_identity_arguments(p.oid) = $2`, [m[1], m[2]])).rows[0];
  n++; if (r?.m !== m[3]) { bad++; console.log(`✗ md5 ${m[1]}(${m[2]}): ${r?.m} != ${m[3]}`); }
}
console.log(`function bodies: ${n - bad}/${n} equal`);
const digests = [...cfg.digests.map((d) => [d.label, d.table, d.where])];
let dn = 0, dbad = 0;
for (const m of md.matchAll(/^\| `([^`]+)` \| `([^`]+)` \| (\d+) \| `([0-9a-f]{8})` \|$/gm)) {
  const [, label, where, cnt, dig] = m;
  let table = label.match(/^kafaa_(\w+)/)[1], w = where;
  const cfgd = digests.find((d) => d[0] === label);
  if (cfgd) { table = cfgd[1]; w = cfgd[2]; }
  if (/replayed people/.test(label)) {
    const ids = [...read(`${cfg.out}/${parts.find((p) => p.includes('replay'))}`).matchAll(/'([a-z0-9-]+)'/g)].map((x) => x[1]).filter((x) => /^(p|w)-/.test(x));
    w = `person_id = any(array[${ids.map((x) => `'${x}'`).join(',')}])`;
  }
  const omit = /without updated_at/.test(label) ? " - 'updated_at'" : '';
  const r = (await db.query(`select count(*)::int n, left(md5(coalesce(string_agg((to_jsonb(t)${omit})::text, '|' order by t.id), '')), 8) d from public.kafaa_${table} t where ${w}`)).rows[0];
  dn++; if (String(r.n) !== cnt || r.d !== dig) { dbad++; console.log(`✗ ${label}: ${r.n}:${r.d} != ${cnt}:${dig}`); }
}
console.log(`digests: ${dn - dbad}/${dn} equal`);
let sbad = 0;
for (const s of cfg.dry_run_live_state ?? []) { const r = (await db.query(s.check)).rows[0]; const okk = Object.values(r ?? {})[0] === true; if (!okk) sbad++; console.log(`${okk ? '✓' : '✗'} after the parts (twice): ${s.expect}`); }
if (sbad) process.exit(1);
if (process.env.DEBUG_TABLE) {
  const T = JSON.parse(read('src/seed/seed.json')).tables[process.env.DEBUG_TABLE];
  const rows = (await db.query(`select to_jsonb(t) j from public.kafaa_${process.env.DEBUG_TABLE} t where ${process.env.DEBUG_WHERE ?? 'true'} order by id`)).rows.map((r) => r.j);
  let shown = 0;
  for (const r of rows) { const s = T.find((x) => x.id === r.id); if (!s) { console.log('extra', r.id); continue; } for (const k of Object.keys(r)) { const same = JSON.stringify(r[k]) === JSON.stringify(s[k]) || String(r[k]) === String(s[k]) || (typeof r[k] === 'string' && !isNaN(Date.parse(r[k])) && Date.parse(r[k]) === Date.parse(s[k])) || Number(r[k]) === Number(s[k]); if (!same) { if (shown++ < 12) console.log(r.id, k, JSON.stringify(r[k]).slice(0, 120), "| seed", JSON.stringify(s[k]).slice(0, 120)); } } }
  console.log('diff fields', shown);
}
process.exit(bad || dbad ? 1 : 0);
