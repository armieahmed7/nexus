// [FS QA · wave D integration] PGlite checks for 20261010249001_kafaa_fs4qa_integration.sql (cross-feature wiring of FS27-FS37).
//  1. FS31 -> FS27/F08: SQL kafaa_fc_target_check = TS targetCheck for every staff member x every gig or rotation a strategic credential
//     names; kafaa_apply_opportunity refuses 'credential_required' to a non-holder of a gated gig and accepts a holder; ungated gigs as before.
//  2. FS31 -> FS27/FS28: the wave-D unlocks pass unlockProblem and name FS27 channel gigs and FS28 future-role rotations.
//  3. FS31 -> FS30: every current micro-credential has a published, indicative credit tag; kafaa_cr_compute = creditsFor() for every
//     FS31 holder and the ledger equals it.
//  4. FS27/FS31 -> FS17 gap backlog: open rows are exactly the requested steps (SQL kafaa_pw_resolve); forward proof from the state the
//     wave-C QA left live, idempotent second run, guarded.
//  5. Additive: one create-or-replace (same signature, grants unchanged), inserts into three kafaa_* tables, guarded gap updates only.
// Every write runs inside a transaction that is rolled back; uses the shared validator database (migrations + seed, twice).
import { readFileSync } from 'node:fs';
import { targetCheck, unlockProblem, FS31_CODES } from '../../src/modules/m17/futureCreds.ts';
import { creditsFor } from '../../src/modules/m34/credits.ts';
import { resolvePathway } from '../../src/modules/m19/pathways.ts';
import { FSQA4_UNLOCKS } from '../seed/ext/fsqa4-integration.mjs';

const FILE = 'supabase/migrations/20261010249001_kafaa_fs4qa_integration.sql';
const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${k}:${canon(v[k])}`).join(',')}}` : typeof v === 'number' ? String(Number(v)) : JSON.stringify(v ?? null));

export default async function fsqa4Checks({ db, as, ok }) {
  console.log('FS QA · wave D integration (FS27-FS37)');
  const T = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables;
  const sql = readFileSync(FILE, 'utf8');
  const q = async (s, p = []) => (await db.query(s, p)).rows;
  const q1 = async (s, p = []) => (await q(s, p))[0];
  const rows = async (t) => (await q(`select to_jsonb(x) j from kafaa_${t} x order by id`)).map((r) => r.j);
  const rpc = async (persona, s, p = []) => (await as(persona, s, p))[0].r;
  const today = (await q1('select current_date::text d')).d;

  // 1. strategic-credential gate
  const w = { today, defs: await rows('microcred_defs'), awards: await rows('microcred_awards'), unlocks: await rows('microcred_unlocks'), opportunities: await rows('opportunities'), rotation_templates: await rows('rotation_templates') };
  const staff = T.people.filter((p) => p.kind === 'staff').map((p) => p.id).sort();
  let diff = 0, n = 0;
  for (const u of w.unlocks) for (const pid of staff) {
    const s = (await q1('select kafaa_fc_target_check($1, $2, $3, current_date) j', [pid, u.target_kind, u.target_id])).j;
    n++; if (canon(s) !== canon(targetCheck(pid, u.target_kind, u.target_id, w))) diff++;
  }
  ok(diff === 0 && n > 500, `FS31 -> FS27: SQL kafaa_fc_target_check = TS targetCheck on ${n} person x named-target cases`);
  await db.exec('begin');
  try {
    const no = await rpc('nse', `select kafaa_apply_opportunity('fg-ai-chem-trend-flags', '') r`);
    const yes = await rpc('k-ro', `select kafaa_apply_opportunity('fg-ai-chem-trend-flags', 'I hold the AI assurer credential') r`);
    const twinNo = await rpc('k-ro', `select kafaa_apply_opportunity('fg-dig-twin-validation', '') r`);
    const plain = await rpc('nse', `select kafaa_apply_opportunity('fg-data-dose-history', '') r`);
    const aud = await q1(`select count(*)::int n from kafaa_audit_events where action = 'opportunity.apply' and entity_id in ('fg-ai-chem-trend-flags', 'fg-dig-twin-validation') and outcome <> 'ok'`);
    ok(no.ok === false && no.code === 'credential_required' && yes.ok === true && twinNo.code === 'credential_required' && plain.ok === true,
      'FS31 -> FS27: a gated gig refuses a non-holder (credential_required) and accepts a holder of the named strategic credential; an ungated gig is unchanged');
    ok(aud.n >= 2, 'the refusals are audited');
  } finally { await db.exec('rollback'); }

  // 2. wave-D unlocks
  const mine = w.unlocks.filter((u) => FSQA4_UNLOCKS.some(([c, k, t]) => u.id === `mcu:${c}:${k}:${t}`));
  const others = { ...w, unlocks: w.unlocks.filter((u) => !mine.includes(u)) };
  ok(mine.length === FSQA4_UNLOCKS.length && mine.every((u) => unlockProblem(u, others) === 'ok') && mine.some((u) => w.opportunities.find((o) => o.id === u.target_id)?.channel)
    && mine.some((u) => w.rotation_templates.find((r) => r.id === u.target_id)?.future_track), `FS31 -> FS27/FS28: ${mine.length} wave-D unlocks name FS27 channel gigs and FS28 future-role rotations and pass unlockProblem`);

  // 3. credit tags and ledger
  const cur = w.defs.filter((d) => d.status === 'current');
  const tags = await rows('credit_tags');
  ok(cur.every((d) => tags.some((t) => t.item_kind === 'microcred' && t.item_id === d.id && t.status === 'published' && t.indicative === true && t.nqf_level && t.credits > 0)),
    `FS31 -> FS30: all ${cur.length} current micro-credentials (${FS31_CODES.length} FS31 codes among them) carry a published indicative NQF level and credit tag`);
  const cw = { credit_tags: tags, training_records: await rows('training_records'), pathway_enrolments: await rows('pathway_enrolments'), microcred_awards: w.awards, rpl_requests: await rows('rpl_requests'), credit_stacks: await rows('credit_stacks') };
  const holders = [...new Set(w.awards.filter((a) => FS31_CODES.includes(a.def_code) && a.status === 'awarded').map((a) => a.person_id))].sort();
  let cd = 0, ld = 0, nmc = 0;
  const ledger = await rows('credit_ledger');
  const strip = (r) => ({ id: r.id, person_id: r.person_id, item_kind: r.item_kind, item_id: r.item_id, tag_id: r.tag_id ?? null, completed_on: String(r.completed_on).slice(0, 10), source_id: r.source_id, notional_hours: Number(r.notional_hours), credits: Number(r.credits), nqf_level: r.nqf_level == null ? null : Number(r.nqf_level), stack_ids: [...(r.stack_ids ?? [])].sort() });
  for (const pid of holders) {
    const s = (await q1('select kafaa_cr_compute($1) j', [pid])).j;
    const t = creditsFor(pid, cw);
    if (canon(s.map(strip)) !== canon(t.map(strip))) cd++;
    if (canon(ledger.filter((r) => r.person_id === pid && r.status === 'counted').map(strip)) !== canon(t.map(strip))) ld++;
    nmc += t.filter((r) => r.item_kind === 'microcred' && FS31_CODES.includes(w.defs.find((d) => d.id === r.item_id)?.code)).length;
  }
  ok(cd === 0 && ld === 0 && nmc > 0, `FS31 -> FS30: kafaa_cr_compute = creditsFor() and the ledger equals it for ${holders.length} FS31 holders (${nmc} FS31 credit rows)`);

  // 4. gap backlog
  const pub = T.pathways.filter((p) => p.status === 'published');
  const content = { courses: T.courses, externals: T.external_resources, opportunities: T.opportunities, credentials: T.microcred_defs, fitness: T.fitness_areas, adaptive: T.adaptive_banks, tasks: T.performance_tasks };
  const req = pub.flatMap((p) => resolvePathway(p, T.pathway_steps, content).steps.filter((s) => s.status === 'requested').map((s) => `pg:${s.step_id}`)).sort();
  const sreq = [];
  for (const p of pub) for (const s of (await q1('select kafaa_pw_resolve($1) j', [p.id])).j.steps) if (s.status === 'requested') sreq.push(`pg:${s.step_id}`);
  const gaps = await rows('pathway_gaps');
  const viaGig = gaps.filter((g) => g.status === 'filled' && g.kind === 'practice');
  ok(canon(gaps.filter((g) => g.status === 'open').map((g) => g.id).sort()) === canon(req) && canon(sreq.sort()) === canon(req) && gaps.length === 215 && viaGig.length > 0,
    `FS27 -> FS17: ${req.length} open backlog rows are exactly the requested steps (TS = SQL); ${viaGig.length} practice steps the channel gigs fill are kept as filled; 215 rows, none removed`);

  // forward proof from the state the wave-C QA left live
  const dig = async () => (await q1(`select md5(string_agg(x, '|' order by x)) d from (
    select 'g' || to_jsonb(g)::text x from kafaa_pathway_gaps g union all select 'u' || to_jsonb(u)::text from kafaa_microcred_unlocks u
    union all select 't' || to_jsonb(t)::text from kafaa_credit_tags t union all select 'l' || (to_jsonb(l) - 'updated_at')::text from kafaa_credit_ledger l) s`)).d;
  const final = await dig();
  const ids = viaGig.map((g) => g.id);
  await db.exec('begin');
  try {
    await db.exec(`select set_config('kafaa.seeding', 'on', true);
      update kafaa_pathway_gaps set status = 'open', filled_on = null where id = any(array[${ids.map((x) => `'${x}'`).join(',')}]::text[]);
      delete from kafaa_microcred_unlocks where id = any(array[${mine.map((u) => `'${u.id}'`).join(',')}]::text[]);
      delete from kafaa_credit_ledger where item_kind = 'microcred' and item_id in (select id from kafaa_microcred_defs where code = any(array[${FS31_CODES.map((c) => `'${c}'`).join(',')}]));
      delete from kafaa_credit_tags where item_kind = 'microcred' and item_id in (select id from kafaa_microcred_defs where code = any(array[${FS31_CODES.map((c) => `'${c}'`).join(',')}]));`);
    const live = await dig();
    await db.exec(sql);
    const once = await dig();
    await db.exec(sql);
    ok(live !== final && once === final && (await dig()) === final, 'forward proof: from the state the wave-C QA left live, the migration reaches the seed (gaps, unlocks, tags, ledger); a second run changes nothing');
    await db.exec(`select set_config('kafaa.seeding', 'on', true); update kafaa_pathway_gaps set status = 'open', filled_on = null, last_checked = date '2026-10-12' where id = '${ids[0]}'`);
    await db.exec(sql);
    ok((await q1('select status from kafaa_pathway_gaps where id = $1', [ids[0]])).status === 'open', 'guarded: a backlog row refreshed live after the QA date is left alone');
  } finally { await db.exec('rollback'); }

  // 5. additivity and grants
  const body = sql.replace(/--.*$/gm, '').replace(/\$j\$[\s\S]*?\$j\$/g, "''");
  ok(!/\b(drop|delete|truncate|alter)\b/i.test(body), 'the QA migration has no drop, delete, truncate or alter');
  const fns = [...body.matchAll(/create or replace function (\w+)/g)].map((m) => m[1]);
  const data = body.slice(body.indexOf("select set_config('kafaa.seeding'")); // statements after the redefined function
  const ins = [...data.matchAll(/\binsert into (\w+)/g)].map((m) => m[1]);
  ok(canon(fns) === canon(['kafaa_apply_opportunity']) && canon(ins) === canon(['kafaa_microcred_unlocks', 'kafaa_credit_tags', 'kafaa_credit_ledger'])
    && [...data.matchAll(/\bupdate (\w+) set/g)].every((m) => m[1] === 'kafaa_pathway_gaps') && (data.match(/on conflict \(id\) do nothing/g) ?? []).length === 3, 'the QA migration replaces kafaa_apply_opportunity only, inserts with on conflict do nothing and updates kafaa_pathway_gaps only');
  const g = await q1(`select has_function_privilege('anon', 'kafaa_apply_opportunity(text, text)', 'execute') a, has_function_privilege('authenticated', 'kafaa_apply_opportunity(text, text)', 'execute') u`);
  ok(g.a === false && g.u === true, 'kafaa_apply_opportunity keeps its grants (authenticated only)');
}
