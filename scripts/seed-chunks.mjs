// Splits supabase/seed.sql into FK-ordered chunks (~N KB) that can each be run as one transaction, e.g. when the seed
// has to be applied through a size-limited SQL console. Each chunk inserts with `on conflict (id) do nothing` and sets
// kafaa.seeding so row-audit triggers stay quiet. Usage: node scripts/seed-chunks.mjs <outDir> [maxKB=45] [--skip=t1,t2]
// audit_events are never chunked: a live project's hash chain starts from real actions, and seeded rows would collide
// with live sequence numbers. --skip leaves out tables that are already loaded.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { SCHEMA, columnsOf } from '../src/data/schema.ts';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const skip = new Set(['audit_events', ...((process.argv.find((a) => a.startsWith('--skip=')) ?? '--skip=').slice(7).split(',').filter(Boolean))]);
const [outDir, maxKbArg] = args;
const MAX = (Number(maxKbArg) || 45) * 1024;
mkdirSync(outDir, { recursive: true });
const sql = readFileSync('supabase/seed.sql', 'utf8');
const blocks = sql.split(/\n\n(?=-- [a-z_]+ \(\d+\)\n)/).slice(1);
const byTable = new Map();
for (const b of blocks) {
  const t = b.match(/^-- ([a-z_]+) \(/)[1];
  if (skip.has(t)) continue;
  const stmts = [];
  let cur = null;
  for (const line of b.split('\n').slice(1)) {
    if (line.startsWith('insert into ')) { cur = { head: line, rows: [] }; stmts.push(cur); }
    else if (line.startsWith('(')) cur.rows.push(line.replace(/,$/, ''));
  }
  byTable.set(t, stmts);
}
// topological order by foreign keys (self references ignored)
const deps = new Map([...byTable.keys()].map((t) => [t, new Set(columnsOf(t).filter((c) => c.ref && c.ref !== t && byTable.has(c.ref)).map((c) => c.ref))]));
const order = [];
const seen = new Set();
const visit = (t) => { if (seen.has(t)) return; seen.add(t); for (const d of deps.get(t) ?? []) visit(d); order.push(t); };
for (const t of byTable.keys()) visit(t);

const PRE = "select set_config('kafaa.seeding', 'on', true);\n";
const chunks = [];
let buf = '';
const flush = () => { if (buf) { chunks.push(PRE + buf); buf = ''; } };
for (const t of order) {
  for (const s of byTable.get(t)) {
    let rows = [];
    let size = 0;
    const emit = () => { if (!rows.length) return; const stmt = `${s.head}\n${rows.join(',\n')}\non conflict (id) do nothing;\n`; if (buf.length + stmt.length > MAX) flush(); buf += stmt; rows = []; size = 0; };
    for (const r of s.rows) {
      if (size + r.length > MAX - 2000 && t !== 'people') emit();
      rows.push(r); size += r.length + 2;
    }
    emit();
  }
}
flush();
chunks.forEach((c, i) => writeFileSync(`${outDir}/seed_${String(i + 1).padStart(2, '0')}.sql`, c));
console.log(`${chunks.length} chunks; order: ${order.join(' ')}`);
