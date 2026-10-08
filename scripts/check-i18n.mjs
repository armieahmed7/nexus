// Fails if any i18n key exists in one language but not the other, or if a value is empty.
import { readdirSync, readFileSync } from 'node:fs';
const dir = 'src/i18n';
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]));
let bad = 0;
const ns = new Set(readdirSync(dir).filter((f) => /\.(en|ar)\.json$/.test(f)).map((f) => f.replace(/\.(en|ar)\.json$/, '')));
for (const n of ns) {
  const load = (l) => { try { return JSON.parse(readFileSync(`${dir}/${n}.${l}.json`, 'utf8')); } catch { return null; } };
  const en = load('en'), ar = load('ar');
  if (!en || !ar) { console.error(`i18n: ${n} is missing a language file`); bad++; continue; }
  const E = new Map(flat(en)), A = new Map(flat(ar));
  for (const k of E.keys()) if (!A.has(k)) { console.error(`i18n: ${n}.${k} missing in ar`); bad++; }
  for (const k of A.keys()) if (!E.has(k)) { console.error(`i18n: ${n}.${k} missing in en`); bad++; }
  for (const [k, v] of [...E, ...A]) if (typeof v === 'string' && !v.trim()) { console.error(`i18n: ${n}.${k} is empty`); bad++; }
}
if (bad) { console.error(`i18n check failed: ${bad} problem(s)`); process.exit(1); }
console.log(`i18n check: ${ns.size} namespaces, en/ar in parity`);
