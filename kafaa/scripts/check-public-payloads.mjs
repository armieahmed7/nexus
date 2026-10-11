// M01/M12 acceptance: public payloads carry no personal data. Checks every table an anonymous visitor can read
// (read rule on public_content without a person/org condition) for personal columns, and scans their seed rows for
// email addresses and phone numbers. Run: npm run check:public
import { readFileSync } from 'node:fs';
import { SCHEMA, columnsOf } from '../src/data/schema.ts';

const PERSONAL_COL = /^(display_name|display_name_ar|full_name|person_name|first_name|last_name|initials|email|phone|mobile|photo|photo_url|avatar|emirates_id|passport|dob|birth_date|nationality|gender|salary)$/;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE = /\+?971[\s-]?\d{1,2}[\s-]?\d{3}[\s-]?\d{4}/;
// Role mailboxes used for contact routing are not personal data.
const ALLOWED_EMAIL = /^(careers|programmes|suppliers|universities|media|accessibility|info|contact|privacy|ecp|speakup)@/i;

const seed = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables;
const isPublic = (def) => (def.read ?? []).some((r) => r.res === 'public_content' && !r.person && !r.org && !r.special);
let bad = 0;
const pub = Object.entries(SCHEMA).filter(([, d]) => isPublic(d) && !d.localOnly);
for (const [t] of pub) {
  for (const c of columnsOf(t)) if (PERSONAL_COL.test(c.name)) { console.error(`public table ${t} has personal column ${c.name}`); bad++; }
  for (const row of seed[t] ?? []) {
    for (const [k, v] of Object.entries(row)) {
      const s = typeof v === 'string' ? v : v && typeof v === 'object' ? JSON.stringify(v) : '';
      const m = s.match(EMAIL);
      if (m && !ALLOWED_EMAIL.test(m[0])) { console.error(`public ${t}.${k} (${row.id}) contains an email address: ${m[0]}`); bad++; }
      if (PHONE.test(s)) { console.error(`public ${t}.${k} (${row.id}) contains a phone number`); bad++; }
    }
  }
}
// FS01/FS02: every public benchmark row and skill definition cites at least one https source; benchmarks carry an as-of date.
const HTTPS = /^https:\/\/[^\s/$.?#][^\s]*$/i;
for (const b of seed.benchmarks ?? []) {
  if (!Array.isArray(b.urls) || !b.urls.length || b.urls.some((u) => !HTTPS.test(u))) { console.error(`public benchmarks.${b.id}: every source must be https`); bad++; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.as_of ?? '')) { console.error(`public benchmarks.${b.id}: no as-of date`); bad++; }
}
for (const k of seed.skills ?? []) if (!(k.sources ?? []).some((x) => HTTPS.test(x.url ?? ''))) { console.error(`public skills.${k.id}: no https source`); bad++; }
if (bad) { console.error(`public payload check failed: ${bad} problem(s)`); process.exit(1); }
console.log(`public payload check: ${pub.length} public tables, no personal columns, no emails or phone numbers; ${(seed.benchmarks ?? []).length} benchmarks and ${(seed.skills ?? []).length} skills cite https sources`);
