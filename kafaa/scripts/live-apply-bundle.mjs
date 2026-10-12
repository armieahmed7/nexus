// Builds a live-apply bundle for one FS wave when the live Supabase project cannot be reached from the session that built it.
//   node scripts/live-apply-bundle.mjs <config.json>
// config: { "out": "../docs/kafaa/ref/live_apply/waveE", "base_ref": "main", "wave": "E", "demo_day": "2026-10-08",
//           "migrations": [{ "file": "20261010251001_kafaa_fs51_next_gen.sql", "part": "kafaa_fs51_next_gen" }, ...],
//           "replay_people_tables": ["plant_visits", ...], "digests": [{ "label": "...", "table": "x", "where": "..." }] }
// Output (all additive, no removal words, kafaa_* objects only):
//   NN_<part>_pK.sql   each migration split at statement boundaries into parts of at most ~60 KB, in file order
//   NN_kafaa_fs<w>seed_<n>_pK.sql  the seed rows the wave adds: every row of a new table and every new row of an existing table,
//                      `insert ... on conflict (id) do nothing` with kafaa.seeding on (rows copied from supabase/seed.sql)
//   NN_kafaa_fs<w>qa_replay_p1.sql  guarded refreshes (kafaa_skills_apply for the people whose evidence the wave changed)
//   EXPECTED.md        per part what it creates; local md5(prosrc) of every function the wave creates or redefines (and the bodies
//                      that must be live before a shared redefinition); row counts and digests to compare after the apply
import { PGlite } from '@electric-sql/pglite';
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { SCHEMA, columnsOf } from '../src/data/schema.ts';

const cfg = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const MAX = (cfg.max_kb ?? 60) * 1024;
const OUT = cfg.out;
const w = cfg.wave_digit;
const read = (p) => readFileSync(p, 'utf8');
const BANNED = /\b(drop|delete|truncate)\b/i;
if (existsSync(OUT)) for (const f of readdirSync(OUT)) if (f.endsWith('.sql') || f === 'EXPECTED.md') rmSync(`${OUT}/${f}`);
mkdirSync(OUT, { recursive: true });

/** Split SQL into top-level statements (dollar quotes, quotes, comments respected). Returns [{ text }] including leading comments. */
function statements(sql) {
  const out = [];
  let i = 0, start = 0, dq = null;
  while (i < sql.length) {
    if (dq) { if (sql.startsWith(dq, i)) { i += dq.length; dq = null; } else i++; continue; }
    const c = sql[i];
    if (c === '-' && sql[i + 1] === '-') { const e = sql.indexOf('\n', i); i = e < 0 ? sql.length : e + 1; continue; }
    if (c === '/' && sql[i + 1] === '*') { const e = sql.indexOf('*/', i + 2); i = e < 0 ? sql.length : e + 2; continue; }
    if (c === "'") { i++; while (i < sql.length) { if (sql[i] === "'" && sql[i + 1] === "'") i += 2; else if (sql[i] === "'") { i++; break; } else i++; } continue; }
    if (c === '$') { const m = sql.slice(i).match(/^\$[A-Za-z_]*\$/); if (m) { dq = m[0]; i += dq.length; continue; } }
    if (c === ';') { out.push(sql.slice(start, i + 1)); start = i + 1; }
    i++;
  }
  const tail = sql.slice(start);
  if (tail.trim()) out.push(tail);
  return out;
}
const created = (s) => {
  const x = s.replace(/--.*$/gm, '').trim();
  const m = x.match(/^(create(?: or replace)? (?:function|table|index|unique index|trigger|view|policy)(?: if not exists)?|alter table|alter policy|insert into|update|revoke|grant|comment on|do|select|set)\s+([^\s(]+)?/i);
  return m ? `${m[1].toLowerCase()} ${m[2] ?? ''}`.trim() : x.slice(0, 60);
};
/** Non-kafaa targets of DDL/DML (must be none). */
function foreignTargets(s) {
  const x = s.replace(/--.*$/gm, '').replace(/\$([A-Za-z_]*)\$[\s\S]*?\$\1\$/g, "''");
  const bad = [];
  for (const m of x.matchAll(/(?<!do )\b(create(?: or replace)? (?:function|table|view|trigger|index|unique index)(?: if not exists)?|alter table(?: if exists)?|alter policy \w+ on|insert into|update)\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi)) {
    const kind = m[1].toLowerCase();
    if (m[2] === 'on' || m[2] === 'of') continue; // grant ... update on, before insert or update on, update of <column>
    if (!m[2].startsWith('kafaa_')) bad.push(`${kind} ${m[2]}`);
  }
  for (const m of x.matchAll(/\bcreate (?:policy|trigger) \w+ (?:[\s\S]*?) on (?:public\.)?([a-z_][a-z0-9_]*)/gi)) if (!m[1].startsWith('kafaa_')) bad.push(`policy/trigger on ${m[1]}`);
  return bad;
}

const files = [];
let n = 0;
const expected = [];
const pad = (k) => String(k).padStart(2, '0');
function writeParts(name, stmts, header, describe) {
  const parts = [];
  let cur = [];
  let size = 0;
  for (const s of stmts) {
    const len = Buffer.byteLength(s);
    if (size + len > MAX && cur.length) { parts.push(cur); cur = []; size = 0; }
    cur.push(s); size += len;
  }
  if (cur.length) parts.push(cur);
  parts.forEach((p, k) => {
    const file = `${pad(++n)}_${name}_p${k + 1}.sql`;
    const body = `-- ${name}_p${k + 1} (${k + 1}/${parts.length}) · ${header}\n-- Apply with apply_migration name "${name}_p${k + 1}". Additive and idempotent; kafaa_* objects only.\n${p.join('').replace(/^\n+/, '')}\n`;
    if (BANNED.test(body)) throw new Error(`${file}: contains a removal word`);
    const ft = foreignTargets(body);
    if (ft.length) throw new Error(`${file}: non-kafaa targets ${ft.join(', ')}`);
    if (Buffer.byteLength(body) > MAX + 4096 && p.length > 1) throw new Error(`${file}: too large`);
    writeFileSync(`${OUT}/${file}`, body);
    files.push(file);
    expected.push({ file, name: `${name}_p${k + 1}`, kb: Math.round(Buffer.byteLength(body) / 102.4) / 10, what: describe(p) });
  });
}
const summarize = (p) => {
  const counts = new Map();
  for (const s of p) { const c = created(s); if (!c) continue; counts.set(c, (counts.get(c) ?? 0) + 1); }
  const fn = [...counts.keys()].filter((k) => /^create or replace function/.test(k)).map((k) => k.replace('create or replace function ', ''));
  const tb = [...counts.keys()].filter((k) => /^create table/.test(k)).map((k) => k.replace(/create table( if not exists)? /, ''));
  const al = [...counts.keys()].filter((k) => /^alter (table|policy)/.test(k));
  const up = [...counts.keys()].filter((k) => /^(update|insert into)/.test(k));
  const parts = [];
  if (tb.length) parts.push(`tables: ${tb.join(', ')}`);
  if (fn.length) parts.push(`functions (${fn.length}): ${fn.join(', ')}`);
  if (al.length) parts.push(`${al.length} alter statement${al.length > 1 ? 's' : ''} (${[...new Set(al.map((a) => a.split(' ').slice(0, 2).join(' ') + ' ' + a.split(' ').pop()))].slice(0, 12).join(', ')})`);
  const pol = p.filter((s) => /create policy|do \$\$/.test(s)).length;
  if (pol) parts.push(`${pol} policy / guarded do-blocks`);
  const gr = p.filter((s) => /^\s*(revoke|grant)\b/im.test(s.replace(/--.*$/gm, ''))).length;
  if (gr) parts.push(`${gr} grant/revoke statements`);
  if (up.length) parts.push(`data: ${up.join(', ')}`);
  return parts.join('; ') || 'statements';
};

// 1. migrations
for (const m of cfg.migrations) {
  const sql = read(`supabase/migrations/${m.file}`);
  if (BANNED.test(sql)) throw new Error(`${m.file}: contains a removal word`);
  writeParts(m.part, statements(sql), `from supabase/migrations/${m.file}`, summarize);
}

// 2. seed rows the wave adds (diff against the base ref's seed.json), from supabase/seed.sql row literals
const base = JSON.parse(execSync(`git show ${cfg.base_ref}:kafaa/src/seed/seed.json`, { maxBuffer: 1 << 30 }).toString()).tables;
const T = JSON.parse(read('src/seed/seed.json')).tables;
const seedSql = read('supabase/seed.sql');
const blocks = new Map(seedSql.split(/\n\n(?=-- [a-z0-9_]+ \(\d+\)\n)/).slice(1).map((b) => [b.match(/^-- ([a-z0-9_]+) \(/)[1], b]));
const changed = {};
const add = new Map();
for (const t of Object.keys(T)) {
  if (t === 'audit_events') continue;
  const before = new Map((base[t] ?? []).map((r) => [r.id, JSON.stringify(r)]));
  const newIds = T[t].filter((r) => !before.has(r.id)).map((r) => r.id);
  const chg = T[t].filter((r) => before.has(r.id) && before.get(r.id) !== JSON.stringify(r)).map((r) => r.id);
  if (chg.length) changed[t] = chg;
  if (newIds.length) add.set(t, new Set(newIds));
}
const deps = new Map([...add.keys()].map((t) => [t, new Set(columnsOf(t).filter((c) => c.ref && c.ref !== t && add.has(c.ref)).map((c) => c.ref))]));
const order = [];
const seen = new Set();
const visit = (t) => { if (seen.has(t)) return; seen.add(t); for (const d of [...(deps.get(t) ?? [])].sort()) visit(d); order.push(t); };
for (const t of (cfg.seed_first ?? []).filter((x) => add.has(x))) visit(t);
for (const t of [...add.keys()].sort()) visit(t);
const seedStmts = [];
const seedRows = {};
for (const t of order) {
  const b = blocks.get(t);
  if (!b) throw new Error(`no seed.sql block for ${t}`);
  const ids = add.get(t);
  let head = null;
  const rows = [];
  for (const line of b.split('\n').slice(1)) {
    if (line.startsWith('insert into ')) head = line;
    else if (line.startsWith('(')) { const id = line.match(/^\('((?:[^']|'')*)'/)?.[1]?.replace(/''/g, "'"); if (id != null && ids.has(id)) rows.push(line.replace(/,$/, '')); }
  }
  if (rows.length !== ids.size) throw new Error(`${t}: found ${rows.length} of ${ids.size} rows in seed.sql`);
  seedRows[t] = rows.length;
  let chunk = [], size = 0;
  const emit = () => { if (!chunk.length) return; seedStmts.push(`\n-- ${t}\nselect set_config('kafaa.seeding', 'on', true);\n${head}\n${chunk.join(',\n')}\non conflict (id) do nothing;\n`); chunk = []; size = 0; };
  for (const r of rows) { const len = Buffer.byteLength(r); if (size + len > MAX - 4096) emit(); chunk.push(r); size += len + 2; }
  emit();
}
writeParts(`kafaa_fs${w}seed_rows`, seedStmts, `seed rows the wave adds (new tables in full, new rows of existing tables), from supabase/seed.sql`, (p) => {
  const tabs = new Map();
  for (const s of p) { const t = s.match(/\n-- ([a-z0-9_]+)\n/)[1]; tabs.set(t, (tabs.get(t) ?? 0) + (s.match(/\n\(/g) ?? []).length); }
  return `insert ... on conflict (id) do nothing: ${[...tabs].map(([t, k]) => `kafaa_${t} ${k}`).join(', ')}`;
});

// 3. guarded refreshes
const ev = T.skill_evidence.filter((e) => cfg.evidence_ref_tables.includes(e.ref_table));
const psChanged = new Set([...(changed.person_skills ?? []), ...(add.get('person_skills') ?? [])].map((id) => T.person_skills.find((r) => r.id === id)?.person_id).filter(Boolean));
const people = [...new Set([...ev.map((e) => e.person_id), ...psChanged])].sort();
const replay = `-- kafaa_skills_apply for the ${people.length} people whose evidence the wave changed (recorded wave evidence: ${cfg.evidence_ref_tables.join(', ')}),
-- on the demo day ${cfg.demo_day}, after the final shared redefinition and the seed rows are in. Recomputes derived states only;
-- recorded evidence is kept. Compare the person_skills digest below afterwards.
do $$ declare x text; begin
  foreach x in array array[${people.map((p) => `'${p}'`).join(', ')}]::text[] loop
    if exists (select 1 from kafaa_people where id = x) then perform kafaa_skills_apply(x, date '${cfg.demo_day}'); end if;
  end loop;
end $$;
`;
writeParts(`kafaa_fs${w}qa_replay`, [replay], 'guarded refreshes after the seed rows', () => `kafaa_skills_apply for ${people.length} people`);

// 4. expected values from PGlite: all migrations + seed (twice not needed here), and the bodies live must hold before the wave
const db = new PGlite();
await db.exec(read('supabase/tests/nexus_stubs.sql'));
const migs = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort();
for (const m of migs) await db.exec(read(`supabase/migrations/${m}`));
await db.exec(read('supabase/seed.sql'));
const waveFns = new Set();
for (const m of cfg.migrations) for (const x of read(`supabase/migrations/${m.file}`).matchAll(/create or replace function (?:public\.)?(\w+)\s*\(/gi)) waveFns.add(x[1]);
const fnRows = (await db.query(`select p.proname n, pg_get_function_identity_arguments(p.oid) a, md5(p.prosrc) m from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = any($1) order by 1, 2`, [[...waveFns]])).rows;
const pre = new PGlite();
await pre.exec(read('supabase/tests/nexus_stubs.sql'));
const first = cfg.migrations[0].file;
for (const m of migs.filter((f) => f < first)) await pre.exec(read(`supabase/migrations/${m}`));
const preRows = (await pre.query(`select p.proname n, pg_get_function_identity_arguments(p.oid) a, md5(p.prosrc) m from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = any($1) order by 1, 2`, [[...waveFns]])).rows;
const digest = async (table, where = 'true', omit = []) => (await db.query(`select count(*)::int n, left(md5(coalesce(string_agg((to_jsonb(t)${omit.map((c) => ` - '${c}'`).join('')})::text, '|' order by t.id), '')), 8) d from public.kafaa_${table} t where ${where}`)).rows[0];
const newTables = [...add.keys()].filter((t) => !(t in base)).sort();
const dg = [];
for (const t of newTables) dg.push({ label: `kafaa_${t}`, where: 'true', ...(await digest(t)) });
for (const d of cfg.digests ?? []) dg.push({ label: d.label, where: d.where, ...(await digest(d.table, d.where)) });
dg.push({ label: `kafaa_person_skills of the ${people.length} replayed people (without updated_at)`, where: `person_id in (${people.length} ids, see the replay part); digest over to_jsonb(t) - 'updated_at' (the replay stamps now())`, ...(await digest('person_skills', `person_id = any(array[${people.map((p) => `'${p}'`).join(',')}])`, ['updated_at'])) });
const anon = (await db.query(`select p.proname n from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = any($1) and has_function_privilege('anon', p.oid, 'execute')`, [[...waveFns]])).rows.map((r) => r.n);
const auth = (await db.query(`select p.proname n from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = any($1) and has_function_privilege('authenticated', p.oid, 'execute') order by 1`, [[...waveFns]])).rows.map((r) => r.n);

// 5. EXPECTED.md
const preMap = new Map(preRows.map((r) => [`${r.n}(${r.a})`, r.m]));
const redefined = fnRows.filter((r) => preMap.has(`${r.n}(${r.a})`));
let md = `# Wave ${cfg.wave} live-apply bundle: what each part does and what to compare afterwards\n\n`;
md += `Generated by \`kafaa/scripts/live-apply-bundle.mjs\` from branch \`${cfg.branch}\` (${cfg.generated_on}). Live Supabase (project \`hlirqxoddysxtdezwcgv\`) was not reachable from the session that built wave ${cfg.wave}, so nothing here has been applied. Apply **every part in file order** with the Supabase \`apply_migration\` tool (name = the file name without the number prefix and \`.sql\`), then run the checks below. Merge \`${cfg.branch}\` to \`main\` only after the checks pass: merging to \`main\` deploys production, and the new pages call these tables and functions.\n\n`;
md += `Rules kept by every file (checked by the generator): additive and idempotent, \`kafaa_*\` objects and rows only, no removal words anywhere (comments and strings included), parts of at most ~${cfg.max_kb ?? 60} KB, seed rows \`insert ... on conflict (id) do nothing\` with \`kafaa.seeding\` on.\n\n`;
md += `## 0. Before you start\n\n${cfg.pre_state ? `${cfg.pre_state}\n\n` : ''}These shared functions are redefined by this wave. Check that the live bodies still equal the bodies the earlier waves left (local md5 of \`prosrc\` before wave ${cfg.wave}); if one differs, stop and compare before applying:\n\n| function | md5 before wave ${cfg.wave} (must be live now) | md5 after the bundle |\n|---|---|---|\n`;
for (const r of redefined) md += `| \`${r.n}(${r.a})\` | \`${preMap.get(`${r.n}(${r.a})`)}\` | \`${r.m}\` |\n`;
md += `\n\`\`\`sql\nselect p.proname, md5(p.prosrc) from pg_proc p join pg_namespace n on n.oid = p.pronamespace\n where n.nspname = 'public' and p.proname in (${redefined.map((r) => `'${r.n}'`).filter((v, i, a) => a.indexOf(v) === i).join(', ')}) order by 1;\n\`\`\`\n\n`;
md += `## 1. Parts, in order\n\n| # | apply_migration name | KB | what it does |\n|---|---|---|---|\n`;
expected.forEach((e, i) => { md += `| ${i + 1} | \`${e.name}\` | ${e.kb} | ${e.what.replace(/\|/g, '/')} |\n`; });
md += `\n${cfg.notes ?? ''}\n\n## 2. Function bodies after the apply (local PGlite, \`md5(prosrc)\`)\n\nEvery function the wave's migrations create or redefine (${fnRows.length}). Live must give the same values:\n\n\`\`\`sql\nselect p.proname, pg_get_function_identity_arguments(p.oid), md5(p.prosrc) from pg_proc p join pg_namespace n on n.oid = p.pronamespace\n where n.nspname = 'public' and p.proname = any(array[<names below>]) order by 1, 2;\n\`\`\`\n\n| function | md5 |\n|---|---|\n`;
for (const r of fnRows) md += `| \`${r.n}(${r.a})\` | \`${r.m}\` |\n`;
md += `\n## 3. Rows after the apply (count and digest)\n\nDigest = \`left(md5(string_agg(to_jsonb(t)::text, '|' order by t.id)), 8)\` over the rows that match the filter (handover 3.10):\n\n\`\`\`sql\nselect count(*), left(md5(string_agg(to_jsonb(t)::text, '|' order by t.id)), 8) from public.kafaa_x t where <filter>;\n\`\`\`\n\n| table | filter | rows | digest |\n|---|---|---|---|\n`;
for (const d of dg) md += `| \`${d.label}\` | \`${d.where.replace(/\|/g, '/')}\` | ${d.n} | \`${d.d}\` |\n`;
md += `\nSeed rows inserted by the seed parts: ${Object.entries(seedRows).map(([t, k]) => `kafaa_${t} ${k}`).join(', ')}.\n\nExisting rows the wave changes (not inserted; reached by the migrations' guarded updates, column defaults or the replay): ${Object.entries(changed).map(([t, ids]) => `kafaa_${t} ${ids.length}`).join(', ') || 'none'}.\n\n`;
md += `## 4. Grants\n\nanon must execute none of the wave's functions (local: ${anon.length ? anon.join(', ') : 'none'}). authenticated executes only the RPCs (${auth.length}): ${auth.map((a) => `\`${a}\``).join(', ')}.\n\n\`\`\`sql\nselect routine_name, grantee from information_schema.routine_privileges\n where routine_schema = 'public' and grantee in ('anon', 'authenticated') and routine_name = any(array[<names above>]) order by 1, 2;\n\`\`\`\n\n${cfg.after ?? ''}\n`;
writeFileSync(`${OUT}/EXPECTED.md`, md);
for (const f of [...files, 'EXPECTED.md']) if (BANNED.test(read(`${OUT}/${f}`).replace(/removal words?/g, ''))) throw new Error(`${f}: removal word`);
console.log(`live-apply bundle: ${files.length} parts in ${OUT}; ${fnRows.length} functions; ${dg.length} digests; replay ${people.length} people; seed ${Object.values(seedRows).reduce((a, b) => a + b, 0)} rows in ${Object.keys(seedRows).length} tables; changed existing: ${JSON.stringify(Object.fromEntries(Object.entries(changed).map(([t, v]) => [t, v.length])))}`);
