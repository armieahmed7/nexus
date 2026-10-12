// [FS QA · wave E integration] PGlite checks for 20261010259001_kafaa_fs5qa_integration.sql (cross-feature wiring of FS38-FS49).
//  1. Recorded evidence (handover 3.9): the final kafaa_skill_states_v2 / kafaa_skills_apply carry the union of the recorded lists (TS
//     RECORDED_REF_TABLES); kafaa_skills_apply for a plant-visit, a twin-drill and a contribution person keeps their wave-E evidence and
//     leaves their skill states equal to the seed; the bodies are the newest definitions (md5 printed for the live comparison).
//  2. FS39 -> F36: kafaa_dg_gather = TS gatherDigest for every host of a plant visit and a spread of staff on two days; every pending
//     visit logged by the day is an approval for its host.
//  3. FS41 -> FS31: kafaa_cec_cites = cecCitations() for every micro-credential definition and generated criteria; MC-CLEAN-ENERGY cites
//     CEC-2.2 and CEC-3.1; nobody but the definer can execute it.
//  4. RLS perf form: the 8 rewritten wave-E policies have no caller-only helper outside a sub-select, and every test identity sees the
//     same rows as under the generated rule (the original policy is put back inside a rolled-back transaction).
//  5. Data replay: forward proof from the state the engineer seeds left live (digests without the plant-visit approvals, rebuilt with the
//     same TS rules), idempotent second run; additive (no removal words; ALTER only on policies of kafaa_* tables).
import { readFileSync } from 'node:fs';
import { RECORDED_REF_TABLES } from '../../src/domain/skills.ts';
import { buildDigestItems, digestNotice, gatherDigest, prefsOf } from '../../src/shell/digest/rules.ts';
import { cecCitations } from '../../src/modules/m32/cec.ts';
import { WAVE_E_REF_TABLES } from '../seed/ext/fsqa5-integration.mjs';

const FILE = 'supabase/migrations/20261010259001_kafaa_fs5qa_integration.sql';
const PERF_TABLES = ['smr_deltas', 'plant_visits', 'twin_scenarios', 'twin_keys', 'twin_attempts', 'lectures', 'contributions', 'localisation_items'];
const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().filter((k) => v[k] !== undefined && v[k] !== null).map((k) => `${k}:${canon(v[k])}`).join(',')}}` : typeof v === 'number' ? String(Number(v)) : JSON.stringify(v ?? null));

export default async function fsqa5Checks({ db, as, ok, uid }) {
  console.log('FS QA · wave E integration (FS38-FS49)');
  const S = JSON.parse(readFileSync('src/seed/seed.json', 'utf8'));
  const T = S.tables;
  const sql = readFileSync(FILE, 'utf8');
  const q = async (s, p = []) => (await db.query(s, p)).rows;
  const q1 = async (s, p = []) => (await q(s, p))[0];
  const rows = async (t) => (await q(`select to_jsonb(x) j from kafaa_${t} x order by id`)).map((r) => r.j);

  // 1. recorded evidence union
  const bodies = Object.fromEntries((await q(`select p.proname n, p.prosrc s, md5(p.prosrc) m from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname in ('kafaa_skill_states_v2', 'kafaa_skills_apply', 'kafaa_dg_gather', 'kafaa_cec_cites') order by 1`)).map((r) => [r.n, r]));
  const lists = ['kafaa_skill_states_v2', 'kafaa_skills_apply'].map((f) => (bodies[f].s.match(/'fitness_attempts', 'adaptive_attempts', 'task_attempts', 'ai_drill_attempts'[^)]*\)/) ?? [''])[0]);
  ok(lists.every((l) => WAVE_E_REF_TABLES.every((t) => l.includes(`'${t}'`)) && RECORDED_REF_TABLES.every((t) => l.includes(`'${t}'`))),
    `3.9: the final kafaa_skill_states_v2 / kafaa_skills_apply carry every recorded ref_table (${RECORDED_REF_TABLES.length}, incl. ${WAVE_E_REF_TABLES.join(', ')}) — md5 ${bodies.kafaa_skill_states_v2.m} / ${bodies.kafaa_skills_apply.m}`);
  const people = [];
  for (const t of ['plant_visits', 'twin_attempts', 'lectures']) people.push((await q1(`select person_id p from kafaa_skill_evidence where ref_table = $1 and active order by id limit 1`, [t])).p);
  await db.exec('begin');
  try {
    const st = async (p) => (await q(`select id || ':' || level || ':' || coalesce(active, true) x from kafaa_person_skills where person_id = $1 order by id`, [p])).map((r) => r.x).join('|');
    const ev = async (p) => (await q1(`select count(*)::int n from kafaa_skill_evidence where person_id = $1 and active and ref_table = any($2)`, [p, WAVE_E_REF_TABLES])).n;
    let same = true, kept = true;
    for (const p of people) {
      const s0 = await st(p), e0 = await ev(p);
      await q(`select kafaa_skills_apply($1, date '2026-10-08')`, [p]);
      if ((await st(p)) !== s0) same = false;
      if ((await ev(p)) !== e0 || e0 === 0) kept = false;
    }
    ok(kept && same, `3.9: kafaa_skills_apply keeps the wave-E evidence of ${people.join(', ')} and leaves their skill states equal to the seed`);
  } finally { await db.exec('rollback'); }

  // 2. digest approvals for hosts
  const data = Object.fromEntries(['people', 'qual_records', 'qual_standards', 'licences', 'skill_checkins', 'skill_ratings', 'mentoring_requests', 'mentoring_agreements', 'mentoring_sessions', 'opportunities',
    'opportunity_applications', 'career_conversations', 'refresh_state', 'refresh_prefs', 'enrolments', 'courses', 'person_skills', 'skills', 'role_competencies', 'career_paths', 'career_targets',
    'engine_settings', 'reco_optouts', 'ojt_logs', 'ojt_eval_requests', 'plant_visits'].map((t) => [t, T[t] ?? []]));
  const hosts = [...new Set(T.plant_visits.map((v) => v.host_person_id))].sort();
  const spread = T.people.filter((p) => p.kind === 'staff').map((p) => p.id).sort().filter((_, i) => i % 7 === 0);
  let dd = 0, dn = 0;
  for (const p of [...new Set([...hosts, ...spread])]) for (const day of [S.meta.demo_today, '2026-10-11']) {
    const s = (await q1(`select kafaa_dg_gather($1, $2::date, '{}'::jsonb) j`, [p, day])).j;
    const byId = (xs) => [...xs].sort((a, b) => (a.id < b.id ? -1 : 1)); // candidate order is free; composeDigest sorts (w5e5 compares the composed digests)
    dn++; if (canon(byId(s)) !== canon(byId(gatherDigest(data, p, day)))) { dd++; if (dd === 1) console.log('    first digest diff', p, day); }
  }
  const pending = T.plant_visits.filter((v) => v.status === 'logged');
  let miss = 0;
  for (const v of pending) {
    const s = (await q1(`select kafaa_dg_gather($1, current_date, '{}'::jsonb) j`, [v.host_person_id])).j;
    if (!s.some((i) => i.id === `approval:plant_visits:${v.id}` && i.link === '/my/plant-log?tab=host')) miss++;
  }
  ok(dd === 0 && dn > 40 && miss === 0 && pending.length > 0, `FS39 -> F36: kafaa_dg_gather = gatherDigest on ${dn} host/staff x day cases; all ${pending.length} pending visits are approvals for their host (md5 ${bodies.kafaa_dg_gather.m})`);

  // 3. competences cited by credential criteria
  const comps = await rows('cec_competences');
  const defs = await rows('microcred_defs');
  const gen = [[{ key: 'a', kind: 'skill', ref: 'sk-fs-gr-circular' }], [{ key: 'b', kind: 'course', ref: 'c-fs-ghg' }, { key: 'c', kind: 'skill', ref: 'sk-none' }], [], [{ key: 'd', kind: 'pathway', ref: 'pw-et-esg-managers' }]];
  let cd = 0, cn = 0;
  for (const crit of [...defs.map((d) => d.criteria ?? []), ...gen]) {
    const s = (await q1('select kafaa_cec_cites($1::jsonb) j', [JSON.stringify(crit)])).j;
    cn++; if (canon(s) !== canon(cecCitations(crit, comps))) cd++;
  }
  const ce = defs.find((d) => d.code === 'MC-CLEAN-ENERGY' && d.status === 'current');
  const ceCites = (await q1('select kafaa_cec_cites($1::jsonb) j', [JSON.stringify(ce.criteria)])).j.map((c) => c.id);
  const ex = await q1(`select has_function_privilege('anon', 'kafaa_cec_cites(jsonb)', 'execute') a, has_function_privilege('authenticated', 'kafaa_cec_cites(jsonb)', 'execute') u`);
  ok(cd === 0 && canon(ceCites) === canon(['cec-2-2', 'cec-3-1']) && !ex.a && !ex.u, `FS41 -> FS31: kafaa_cec_cites = cecCitations() on ${cn} criteria sets; MC-CLEAN-ENERGY cites CEC-2.2 and CEC-3.1; no API role executes it`);

  // 4. RLS perf form for the 8 wave-E tables
  const pol = await q(`select tablename, qual from pg_policies where schemaname = 'public' and policyname = 'kafaa_read' and tablename = any($1)`, [PERF_TABLES.map((t) => `kafaa_${t}`)]);
  const bare = pol.filter((p) => /(?<!SELECT )kafaa_has_grant\(|(?<!SELECT )kafaa_me\(\)/.test(p.qual));
  ok(pol.length === PERF_TABLES.length && bare.length === 0, `RLS perf: the ${pol.length} rewritten wave-E policies evaluate caller-only helpers once per statement`);
  const ids = ['nse', 'k-ro', 'chco', 'training-mgr', 'k-instructor', 'sme-reviewer', 'buyer', 'qc-inspector', 'k-student', 'alnoor-qaqc', 'k-auditor', 'p-sro'];
  const known = [];
  for (const persona of ids) {
    if (!uid[persona]) {
      const u = `00000000-0000-4000-8000-${String(900 + known.length + Object.keys(uid).length).padStart(12, '0')}`;
      const r = await q(`insert into profiles (user_id, email, persona_id, org_id, lens, roles) select $1, $2, $3, coalesce(p.org_id, 'enec-ops'), 'employee', array['Test'] from kafaa_people p where p.persona_id = $3 limit 1 on conflict do nothing returning user_id`, [u, `${persona}@qa5.test`, persona]);
      if (!r.length) continue;
      uid[persona] = u;
    }
    known.push(persona);
  }
  const snap = async () => {
    const o = {};
    for (const persona of [null, ...known]) for (const t of PERF_TABLES) {
      const r = (await as(persona, `select count(*)::int n, md5(coalesce(string_agg(id::text, ',' order by id::text), '')) h from kafaa_${t}`))[0];
      o[`${persona}|${t}`] = `${r.n}:${r.h}`;
    }
    return o;
  };
  const rls = readFileSync('supabase/migrations/20261008120300_kafaa_rls.sql', 'utf8');
  const orig = PERF_TABLES.map((t) => { const m = rls.match(new RegExp(`create policy kafaa_read on kafaa_${t} for select to anon, authenticated using \\(([\\s\\S]*?)\\);\\n`)); return [t, m?.[1]]; });
  const after = await snap();
  await db.exec('begin');
  let before;
  try {
    for (const [t, e] of orig) await db.exec(`alter policy kafaa_read on kafaa_${t} using (${e})`);
    before = await snap();
  } finally { await db.exec('rollback'); }
  const mism = Object.keys(after).filter((k) => after[k] !== before[k]);
  const nonEmpty = Object.values(after).filter((v) => !v.startsWith('0:')).length;
  ok(orig.every(([, e]) => e) && mism.length === 0 && nonEmpty > 20, `RLS perf: ${known.length + 1} identities x ${PERF_TABLES.length} tables see the same rows as under the generated rule (${nonEmpty} non-empty)${mism.length ? `; ${mism.slice(0, 3).join(', ')}` : ''}`);

  // 5. data replay: forward proof
  const runIds = ['dg:p-k-instructor:2026-W40', 'dg:p-training-mgr:2026-W41'];
  const ntIds = ['nt-dg-p-k-instructor-2026-W40', 'nt-dg-p-training-mgr-2026-W41'];
  const dig = async () => (await q1(`select md5(string_agg(x, '|' order by x)) d from (
    select 'r' || (to_jsonb(r) - 'built_at')::text x from kafaa_digest_runs r where id = any($1) union all
    select 'n' || jsonb_build_array(n.id, n.title_en, n.title_ar, n.body_en, n.body_ar)::text from kafaa_notifications n where id = any($2)) s`, [runIds, ntIds])).d;
  const final = await dig();
  const noPv = { ...data, plant_visits: [] };
  const prefsBy = new Map(T.digest_prefs.map((p) => [p.person_id, p]));
  await db.exec('begin');
  try {
    await db.exec(`select set_config('kafaa.seeding', 'on', true)`);
    for (const id of runIds) {
      const r = T.digest_runs.find((x) => x.id === id);
      const items = buildDigestItems(noPv, r.person_id, r.as_of, prefsOf(prefsBy.get(r.person_id)));
      const n = digestNotice(items, r.frequency);
      await q(`update kafaa_digest_runs set items = $2::jsonb, item_count = $3 where id = $1`, [id, JSON.stringify(items), items.length]);
      await q(`update kafaa_notifications set title_en = $2, title_ar = $3, body_en = $4, body_ar = $5 where id = $1`, [r.notification_id, n.title_en, n.title_ar, n.body_en, n.body_ar]);
    }
    const live = await dig();
    await db.exec(sql);
    const once = await dig();
    await db.exec(sql);
    ok(live !== final && once === final && (await dig()) === final, 'forward proof: from the digests the engineer seeds left live, the QA migration reaches the seed (2 digest runs, 2 notices); a second run changes nothing');
  } finally { await db.exec('rollback'); }

  // additivity
  const body = sql.replace(/--.*$/gm, '').replace(/\$j\$[\s\S]*?\$j\$/g, "''");
  ok(!/\b(drop|delete|truncate)\b/i.test(sql), 'the QA migration has no drop, delete or truncate (comments and strings included)');
  const alters = [...body.matchAll(/\balter\s+(\w+)\s+(\w+)\s+on\s+public\.(\w+)/g)];
  ok((body.match(/\balter\b/g) ?? []).length === alters.length && alters.every((m) => m[1] === 'policy' && m[3].startsWith('kafaa_')) && alters.length === PERF_TABLES.length,
    `ALTER only on policies of kafaa_* tables (${alters.length})`);
  const fns = [...body.matchAll(/create or replace function (\w+)/g)].map((m) => m[1]);
  ok(canon(fns) === canon(['kafaa_skill_states_v2', 'kafaa_skills_apply', 'kafaa_dg_gather', 'kafaa_cec_cites']) && !/\bcreate (table|index)\b/i.test(body),
    'the QA migration replaces three functions (same signatures) and adds one internal helper; no new table');
  const g = await q1(`select has_function_privilege('authenticated', 'kafaa_skills_apply(text, date)', 'execute') a, has_function_privilege('authenticated', 'kafaa_dg_gather(text, date, jsonb)', 'execute') d`);
  ok(g.a === false && g.d === false, 'the replaced helpers keep their grants (not executable by authenticated)');
}
