// [FS QA · wave C integration] PGlite checks for 20261010239001_kafaa_fs3qa_integration.sql (cross-feature wiring of FS17-FS26).
//  1. FS21/FS22 -> FS17: SQL kafaa_pw_discover = TS discover() for every published pathway step, and FS21 banks / FS22 tasks now
//     appear in assessment steps; kafaa_pw_progress = pathwayProgress(recordsOf()) for every person with an FS21/FS22 result.
//  2. A voided result (counts = false) or a failed task never ticks a step.
//  3. FS17 gap backlog: open rows are exactly the requested steps, filled rows resolve; forward proof (rows at the values FS17
//     loaded live become the seed after the migration), idempotent second run, guarded (a row refreshed live later is left alone).
//  4. Grants: the redefined internals stay closed to anon and authenticated; the migration is additive.
// Runs on its own fresh PGlite (migrations + seed once).
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const FILE = 'supabase/migrations/20261010239001_kafaa_fs3qa_integration.sql';
const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${k}:${canon(v[k])}`).join(',')}}` : typeof v === 'number' ? String(Number(v)) : JSON.stringify(v ?? null));

export default async function fsqa3Checks({ ok }) {
  console.log('FS QA · wave C integration (FS17-FS26)');
  const P = await import('../../src/modules/m19/pathways.ts');
  const T = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables;
  const db = new PGlite();
  await db.exec(readFileSync('supabase/tests/nexus_stubs.sql', 'utf8'));
  for (const m of readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()) await db.exec(readFileSync(`supabase/migrations/${m}`, 'utf8'));
  await db.exec(readFileSync('supabase/seed.sql', 'utf8'));
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  const q1 = async (sql, p = []) => (await q(sql, p))[0];
  const sql = readFileSync(FILE, 'utf8');
  const content = { courses: T.courses, externals: T.external_resources, opportunities: T.opportunities, credentials: T.microcred_defs, fitness: T.fitness_areas, adaptive: T.adaptive_banks, tasks: T.performance_tasks };
  const pub = T.pathways.filter((p) => p.status === 'published');

  // 1. discovery parity and the new items
  let diff = 0, n = 0, nAd = 0, nTask = 0;
  for (const p of pub) for (const kind of ['learn', 'practice', 'assess']) {
    const s = (await q1('select kafaa_pw_discover($1, $2, $3) j', [kind, p.skill_id, p.level])).j;
    const t = P.discover(kind, p.skill_id, p.level, content);
    n++; if (canon(s) !== canon(t)) diff++;
    nAd += t.filter((i) => i.type === 'adaptive').length; nTask += t.filter((i) => i.type === 'task').length;
  }
  ok(diff === 0 && n === pub.length * 3, `FS21/FS22 -> FS17: SQL kafaa_pw_discover = TS discover() on ${n} pathway x kind cases`);
  ok(nAd > 0 && nTask > 0, `FS21/FS22 -> FS17: assessment steps now discover ${nAd} adaptive-bank and ${nTask} performance-task items (links /my/assessments/...)`);
  const resolved = new Map(pub.map((p) => [p.id, P.resolvePathway(p, T.pathway_steps, content)]));
  const rec = { training_records: T.training_records, external_completions: T.external_completions, opportunity_applications: T.opportunity_applications, microcred_awards: T.microcred_awards, fitness_attempts: T.fitness_attempts, adaptive_attempts: T.adaptive_attempts, task_attempts: T.task_attempts };
  const people = [...new Set([...T.adaptive_attempts.filter((a) => a.status === 'completed').map((a) => a.person_id), ...T.task_attempts.filter((a) => a.status === 'scored').map((a) => a.person_id)])].sort().slice(0, 40);
  const withItems = pub.filter((p) => resolved.get(p.id).steps.some((s) => s.items.some((i) => i.type === 'adaptive' || i.type === 'task')));
  let pdiff = 0, pn = 0, viaNew = 0;
  for (const pid of people) for (const p of withItems) {
    const s = (await q1('select kafaa_pw_progress($1, $2) j', [pid, p.id])).j;
    const t = P.pathwayProgress(resolved.get(p.id), P.recordsOf(pid, rec));
    pn++; if (canon(s) !== canon(t)) pdiff++;
    viaNew += t.steps.filter((x) => /^(adaptive|task):/.test(x.via ?? '')).length;
  }
  ok(pdiff === 0 && viaNew > 0, `FS21/FS22 -> FS17: SQL kafaa_pw_progress = pathwayProgress() on ${pn} person x pathway pairs; ${viaNew} steps are done through an FS21/FS22 result`);

  // 2. voided or failed results never tick a step
  const ad = T.adaptive_attempts.find((a) => a.status === 'completed' && a.counts !== false && withItems.some((p) => resolved.get(p.id).steps.some((s) => s.items.some((i) => i.type === 'adaptive' && i.id === a.bank_id))));
  const pw = withItems.find((p) => resolved.get(p.id).steps.some((s) => s.items.some((i) => i.type === 'adaptive' && i.id === ad.bank_id)));
  const viaAd = async () => (await q1('select kafaa_pw_progress($1, $2) j', [ad.person_id, pw.id])).j.steps.some((x) => x.via === `adaptive:${ad.bank_id}`);
  const before = await viaAd();
  await db.exec('begin');
  let after;
  try {
    await db.exec(`select set_config('kafaa.seeding', 'on', true); update kafaa_adaptive_attempts set counts = false where person_id = '${ad.person_id}' and bank_id = '${ad.bank_id}'`);
    after = await viaAd();
  } finally { await db.exec('rollback'); }
  const failed = P.pathwayProgress(resolved.get(pw.id), P.recordsOf(ad.person_id, { ...rec, adaptive_attempts: rec.adaptive_attempts.map((a) => (a.person_id === ad.person_id && a.bank_id === ad.bank_id ? { ...a, counts: false } : a)) }));
  const noFail = P.recordsOf('x', { ...rec, task_attempts: [{ person_id: 'x', task_id: 't', status: 'scored', passed: false, counts: true }] }).tasks.length === 0;
  ok(before && !after && !failed.steps.some((x) => x.via === `adaptive:${ad.bank_id}`) && noFail, 'a voided adaptive result (counts = false) or a failed task never ticks a pathway step (SQL and TS)');

  // 3. gap backlog
  const open = T.pathway_gaps.filter((g) => g.status === 'open');
  const req = [...resolved.values()].flatMap((r) => r.steps.filter((s) => s.status === 'requested').map((s) => `pg:${s.step_id}`)).sort();
  ok(canon(open.map((g) => g.id).sort()) === canon(req) && T.pathway_gaps.filter((g) => g.status === 'filled').every((g) => resolved.get(g.pathway_id).steps.find((s) => s.step_id === g.step_id).status === 'resolved'),
    `FS17 backlog: ${open.length} open rows are exactly the requested steps; ${T.pathway_gaps.length - open.length} rows filled by FS19/FS21/FS22 stay as history`);
  const dig = async () => (await q1(`select md5(string_agg(to_jsonb(g)::text, '|' order by id)) d from kafaa_pathway_gaps g`)).d;
  const final = await dig();
  await db.exec('begin');
  try {
    await db.exec(`select set_config('kafaa.seeding', 'on', true); update kafaa_pathway_gaps set status = 'open', filled_on = null, last_checked = date '2026-10-10'`);
    const live = await dig();
    // FS wave D QA: the wave-D QA migration (FS27 gigs fill practice steps on the same day) runs after this one, as it did live
    const sql4 = readFileSync('supabase/migrations/20261010249001_kafaa_fs4qa_integration.sql', 'utf8');
    await db.exec(sql); await db.exec(sql4);
    const once = await dig();
    await db.exec(sql); await db.exec(sql4);
    ok(live !== final && once === final && (await dig()) === final, 'FS17 backlog: rows at the values FS17 loaded live become the seed after the migration; a second run changes nothing');
    await db.exec(`select set_config('kafaa.seeding', 'on', true); update kafaa_pathway_gaps set status = 'open', filled_on = null, last_checked = date '2026-10-12' where id = '${T.pathway_gaps.find((g) => g.status === 'filled').id}'`);
    await db.exec(sql); await db.exec(sql4);
    ok((await q1('select status from kafaa_pathway_gaps where id = $1', [T.pathway_gaps.find((g) => g.status === 'filled').id])).status === 'open', 'FS17 backlog: guarded: a row refreshed live after the QA date is left alone');
  } finally { await db.exec('rollback'); }

  // 4. grants and additivity
  ok(!/\b(drop|delete|truncate|alter)\b/i.test(sql.replace(/--.*$/gm, '')), 'the QA migration has no drop, delete, truncate or alter');
  const names = [...sql.matchAll(/create or replace function (\w+)/g)].map((m) => m[1]);
  ok(names.length === 3 && names.every((x) => x.startsWith('kafaa_')) && [...sql.matchAll(/\bupdate (\w+) set/g)].every((m) => ['kafaa_pathway_gaps', 'kafaa_skills'].includes(m[1])), 'the QA migration replaces three kafaa_* functions and updates kafaa_pathway_gaps and three kafaa_skills rows only');
  const ek = Object.fromEntries((await q(`select id, evidence_keys from kafaa_skills where id in ('sk-fs-tr-systems', 'sk-mp-01-remote')`)).map((r) => [r.id, r.evidence_keys]));
  ok(canon(ek['sk-fs-tr-systems']) === canon(T.skills.find((s) => s.id === 'sk-fs-tr-systems').evidence_keys) && canon(ek['sk-mp-01-remote']) === canon(T.skills.find((s) => s.id === 'sk-mp-01-remote').evidence_keys)
    && canon(ek['sk-fs-tr-systems']) === canon(['c-fs-systems', 'c-fs-plantlit-x']), 'FS19 evidence keys: the migration targets the seed order of the three skills whose live load order differed');
  let openGrant = 0;
  for (const fn of ['kafaa_pw_item(text, jsonb, boolean)', 'kafaa_pw_discover(text, text, integer)', 'kafaa_pw_progress(text, text)']) for (const role of ['anon', 'authenticated']) if ((await q1(`select has_function_privilege($1, $2, 'execute') x`, [role, fn])).x) openGrant++;
  ok(openGrant === 0, 'the three redefined internal functions stay closed to anon and authenticated');
  await db.close();
}
