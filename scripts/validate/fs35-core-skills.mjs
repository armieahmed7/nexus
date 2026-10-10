// [FS wave C · E5 · FS25 + FS26] PGlite checks for 20261010235001_kafaa_fs35_core_skills.sql (Nuclear Critical Core Skills, SJT practice).
// Seed sanity (16 core skills pass the inclusion rule with >= 2 benchmark mappings each, a development and an assessment route each, no
// wellbeing competency, 48 bilingual items with expert rationales, practice sets replay exactly with pickSet/scoreSjt, no skill evidence
// from practice); SQL = TS parity on the database state: kafaa_cs_profile = coreProfile for every person, kafaa_cs_stats_core = coreStats,
// kafaa_sjt_pick = pickSet, kafaa_sjt_feedback = feedbackOf, kafaa_sjt_score = scoreSjt (seeded + generated), kafaa_sjt_item_problem =
// sjtItemProblem, kafaa_sjt_stats_core = sjtStats; RLS (public definitions, the bank for training staff only, attempts Own only: never a
// manager, HR, the HR director's talent review or an auditor; no talent-review function reads attempts); RPC flows (start, resume, answer with
// server-side key, refusals, completion without evidence or ledger, Agg-only aggregates without person ids, the item bank RBAC and guards).
import { readFileSync } from 'node:fs';
import { coreProfile, coreStats, inclusionProblems, benchmarkIdsOf } from '../../src/modules/m33/coreSkills.ts';
import { feedbackOf, personSeed, pickSet, scoreSjt, sjtItemProblem, sjtStats } from '../../src/modules/m33/sjt.ts';

const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${k}:${canon(v[k])}`).join(',')}}` : typeof v === 'number' ? String(Number(v)) : typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) ? String(Number(v)) : JSON.stringify(v ?? null));
const TODAY = '2026-10-10';
function h32(s) { let x = 0x811c9dc5; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; } return x >>> 0; }

export default async function fs35Checks({ db, one, as, ok }) {
  const T = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables;
  console.log('FS wave C · E5 · FS25 Nuclear Critical Core Skills + FS26 situational judgement practice');
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;

  // ── seed sanity (acceptance)
  const bm = new Set(T.benchmarks.map((b) => b.id));
  ok(T.core_skills.length === 16 && inclusionProblems(T.core_skills).length === 0, 'seed: 16 core skills pass the inclusion rule (own development and assessment routes, >= 2 benchmark mappings, no wellbeing competency)');
  ok(T.core_skills.every((c) => benchmarkIdsOf(c).length >= 2 && benchmarkIdsOf(c).every((b) => bm.has(b)) && canon(c.benchmark_ids) === canon(benchmarkIdsOf(c))),
    'acceptance FS25: each of the 16 core skills cites at least 2 benchmark mappings, all of them kafaa_benchmarks rows');
  ok(T.core_skills.every((c) => c.development.length && c.assessment.length && c.dev_approach_en && c.dev_approach_ar && c.assess_approach_en && c.assess_approach_ar),
    'acceptance FS25: every core skill has a development route and an assessment route (EN and AR)');
  ok(!T.core_skills.some((c) => /well-?being|wellness/i.test(c.name_en)) && T.core_skill_candidates.some((c) => c.id === 'cand-wellbeing' && c.decision === 'outcome'),
    'acceptance FS25: no wellbeing competency; wellbeing is recorded as an outcome of Resilience and self-management');
  ok(new Set(T.core_skills.map((c) => c.cluster)).size === 3 && T.core_skills.every((c) => c.descriptors.length === 3 && c.descriptors.every((d) => d.en && d.ar)), 'seed: three clusters; three level descriptors per skill in EN and AR');
  ok(T.core_skill_targets.length === T.job_families.length * 16, `seed: ${T.core_skill_targets.length} family targets (20 families x 16)`);
  const ids = T.core_skills.map((c) => c.id);
  ok(T.sjt_items.length >= 40 && T.sjt_items.every((i) => sjtItemProblem(i, ids) === null && i.rationale_en && i.rationale_ar), `acceptance FS26: ${T.sjt_items.length} items (>= 40), every one with an expert rationale in both languages`);
  ok(T.skill_evidence.every((e) => e.ref_table !== 'sjt_attempts'), 'seed: practice never writes skill evidence (never gating)');
  const names = T.core_skills.map((c) => ({ id: c.id, name_en: c.name_en, name_ar: c.name_ar, sort: c.sort }));
  let replay = 0;
  const byPerson = new Map();
  for (const a of [...T.sjt_attempts].sort((x, y) => x.attempt_no - y.attempt_no)) (byPerson.get(a.person_id) ?? byPerson.set(a.person_id, []).get(a.person_id)).push(a);
  for (const [pid, list] of byPerson) {
    const answered = new Map();
    for (const a of list) {
      const set = pickSet(T.sjt_items, answered, a.attempt_no, a.core_skill_id, personSeed(pid));
      const sc = scoreSjt(a.responses, names);
      if (canon(set) === canon(a.item_ids) && sc.score === a.score && canon(sc.by_skill) === canon(a.by_skill)) replay++;
      for (const r of a.responses) answered.set(r.item_id, (answered.get(r.item_id) ?? 0) + 1);
    }
  }
  ok(replay === T.sjt_attempts.length, `seed: all ${T.sjt_attempts.length} practice sets replay exactly (pickSet, scoreSjt)`);

  // ── SQL = TS parity on the database state
  const people = await q('select id, kind, status, job_family_id from kafaa_people order by id');
  const states = await q('select id, person_id, skill_id, level, basis, active from kafaa_person_skills where active');
  const skills = await q('select id, name_en, name_ar from kafaa_skills');
  const core = await q('select * from kafaa_core_skills');
  const targets = await q('select family_id, core_skill_id, level from kafaa_core_skill_targets order by id');
  const attempts = await q('select * from kafaa_sjt_attempts');
  const items = (await q('select * from kafaa_sjt_items')).map((i) => ({ ...i, sort: Number(i.sort) }));
  const by = new Map(); for (const s of states) (by.get(s.person_id) ?? by.set(s.person_id, []).get(s.person_id)).push(s);
  const nameMap = new Map(skills.map((s) => [s.id, s]));
  const diffP = [];
  for (const p of people) {
    const s = (await q('select kafaa_cs_profile($1, $2::date) j', [p.id, TODAY]))[0].j;
    const t = coreProfile(p.id, p.job_family_id, core, targets, by.get(p.id) ?? [], nameMap, attempts, TODAY);
    if (canon(s) !== canon(t)) diffP.push(p.id);
  }
  ok(diffP.length === 0, `SQL kafaa_cs_profile equals coreProfile() for all ${people.length} people${diffP.length ? ` (first diff ${diffP[0]})` : ''}`);
  const st = (await q('select kafaa_cs_stats_core() j'))[0].j;
  ok(canon(st) === canon(coreStats(people, core, targets, by, 10)), 'SQL kafaa_cs_stats_core equals coreStats() (suppressed under 10)');
  const coreNames = core.map((c) => ({ id: c.id, name_en: c.name_en, name_ar: c.name_ar, sort: Number(c.sort) }));
  const ss = (await q('select kafaa_sjt_stats_core($1::date) j', [TODAY]))[0].j;
  ok(canon(ss) === canon(sjtStats(attempts, people, coreNames, TODAY, 10)), 'SQL kafaa_sjt_stats_core equals sjtStats() (suppressed under 10)');
  const diffK = [];
  const ans = new Map();
  for (const a of attempts) for (const r of a.responses) { const m = ans.get(a.person_id) ?? ans.set(a.person_id, new Map()).get(a.person_id); m.set(r.item_id, (m.get(r.item_id) ?? 0) + 1); }
  for (const p of people.filter((x) => x.kind === 'staff').slice(0, 60)) {
    for (const no of [1, 2, 5]) for (const cs of [null, ids[h32(p.id + no) % ids.length]]) {
      const s = (await q('select kafaa_sjt_pick($1, $2, $3, 8) j', [p.id, no, cs]))[0].j;
      if (canon(s) !== canon(pickSet(items, ans.get(p.id) ?? new Map(), no, cs, personSeed(p.id)))) diffK.push(`${p.id}:${no}:${cs}`);
    }
  }
  ok(diffK.length === 0, `SQL kafaa_sjt_pick equals pickSet() for 360 person x attempt x skill cases${diffK.length ? ` (${diffK[0]})` : ''}`);
  const diffF = [];
  for (const it of items) for (let c = 0; c < 4; c++) if (canon((await q('select kafaa_sjt_feedback($1, $2) j', [it.id, c]))[0].j) !== canon(feedbackOf(it, c))) diffF.push(`${it.id}:${c}`);
  ok(diffF.length === 0, `SQL kafaa_sjt_feedback equals feedbackOf() for every item and response (${items.length * 4})`);
  const diffS = [];
  const gen = [];
  for (let k = 0; k < 200; k++) {
    const n = 1 + (h32(`n${k}`) % 8);
    gen.push(Array.from({ length: n }, (_, j) => { const it = items[h32(`i${k}:${j}`) % items.length]; const c = h32(`c${k}:${j}`) % 4; return { item_id: it.id, core_skill_id: it.core_skill_id, choice: c, eff: it.expert_key[c] }; }));
  }
  for (const r of [...attempts.map((a) => a.responses), ...gen]) {
    if (canon((await q('select kafaa_sjt_score($1::jsonb) j', [JSON.stringify(r)]))[0].j) !== canon(scoreSjt(r, coreNames))) diffS.push(JSON.stringify(r).slice(0, 80));
  }
  ok(diffS.length === 0, `SQL kafaa_sjt_score equals scoreSjt() on ${attempts.length} seeded and 200 generated sets${diffS.length ? ` (${diffS[0]})` : ''}`);
  const base = { ...T.sjt_items[0] };
  const variants = [base, { ...base, rationale_ar: '' }, { ...base, expert_key: [3, 3, 0, 1] }, { ...base, expert_key: [3, 2, 1] }, { ...base, theme: 'bravery' },
    { ...base, options_ar: base.options_ar.slice(0, 3) }, { ...base, notes_en: [...base.notes_en.slice(0, 3), ''] }, { ...base, stem_en: `${base.stem_en} Check the guard force rota.` },
    { ...base, core_skill_id: 'cs-wellbeing' }, { ...base, expert_key: [3, 1.5, 0, 1] }, { ...base, stem_ar: '   ' }];
  const diffI = [];
  for (const v of variants) if ((await q('select kafaa_sjt_item_problem($1::jsonb) j', [JSON.stringify(v)]))[0].j !== sjtItemProblem(v, ids)) diffI.push(sjtItemProblem(v, ids));
  ok(diffI.length === 0, `SQL kafaa_sjt_item_problem equals sjtItemProblem() on ${variants.length} variants${diffI.length ? ` (${diffI[0]})` : ''}`);

  // ── RLS
  const cnt = async (persona, table, where = 'true') => Number((await one(persona, `select count(*)::int n from ${table} where ${where}`)).n);
  ok(await cnt(null, 'kafaa_core_skills') === 16 && await cnt(null, 'kafaa_core_skill_targets') === 320 && await cnt(null, 'kafaa_core_skill_candidates') === 8,
    'RLS: core skills, targets and candidates are public (anon reads 16 / 320 / 8)');
  ok(await cnt(null, 'kafaa_sjt_items') === 0 && await cnt('sro', 'kafaa_sjt_items') === 0 && await cnt('training-mgr', 'kafaa_sjt_items') >= 48 && await cnt('k-instructor', 'kafaa_sjt_items') >= 48,
    'RLS: the item bank (with the key) is read by training staff only; takers get items without the key from the RPCs');
  ok(await cnt(null, 'kafaa_sjt_attempts') === 0, 'RLS: anon reads no practice attempts');
  ok(await cnt('sro', 'kafaa_sjt_attempts') > 0 && await cnt('sro', 'kafaa_sjt_attempts', "person_id <> 'p-sro'") === 0, 'RLS: a person reads only their own practice (sro, also a line manager: none of the team\'s)');
  let leak = 0;
  for (const p of ['chco', 'k-hr-analyst', 'training-mgr', 'k-admin', 'k-auditor', 'k-instructor', 'k-licensing-coord']) leak += await cnt(p, 'kafaa_sjt_attempts', `person_id <> 'p-${p}'`);
  ok(leak === 0, 'acceptance FS26: practice results never appear in talent review: HR director (talent review R/A), HR analyst (Scope/Agg), training manager, admin, auditor and instructors read none of anyone else\'s attempts');
  const readers = await q(`select proname from pg_proc where prosrc ilike '%kafaa_sjt_attempts%' order by 1`);
  ok(readers.length > 0 && readers.every((r) => /^kafaa_(sjt_|cs_|start_sjt|submit_sjt)/.test(r.proname)), `acceptance FS26: only the FS26/FS25 functions read kafaa_sjt_attempts (${readers.map((r) => r.proname).join(', ')}); no talent-review function does`);
  const gamCols = await q(`select table_name, column_name from information_schema.columns where table_name in ('kafaa_sjt_items', 'kafaa_sjt_attempts', 'kafaa_core_skills', 'kafaa_core_skill_targets')
    and column_name ~ '(^|_)(points?|streaks?|badges?|leaderboards?|ranks?|xp|rewards?|level_up)($|_)'`);
  ok(gamCols.length === 0, 'acceptance FS26: no gamification columns (points, streaks, badges, leaderboards, ranks)');

  // ── RPC flows
  const ev0 = Number((await q('select count(*)::int n from kafaa_skill_evidence'))[0].n);
  const mine = (await one('sro', 'select kafaa_core_skills_mine() j')).j;
  ok(mine && mine.skills.length === 16 && mine.person_id === 'p-sro' && mine.skills.some((v) => v.practice), 'RPC kafaa_core_skills_mine: 16 core skills with evidence, target, status and practice (Own)');
  ok((await one('sro', 'select kafaa_core_skills_stats() j')).j === null && (await one('chco', 'select kafaa_core_skills_stats() j')).j?.staff > 0, 'RPC kafaa_core_skills_stats: HR (Agg) only; a line manager gets nothing');
  const hrS = (await one('k-hr-analyst', 'select kafaa_sjt_stats() j')).j;
  ok(hrS && hrS.participants >= 10 && !JSON.stringify(hrS).includes('p-'), 'RPC kafaa_sjt_stats: HR aggregate (participants >= 10) with no person ids');
  ok((await one('sro', 'select kafaa_sjt_stats() j')).j === null, 'RPC kafaa_sjt_stats: refused (null) for a line manager');
  let anonBlocked = false;
  try { await as(null, 'select kafaa_core_skills_mine()'); } catch { anonBlocked = true; }
  ok(anonBlocked, 'grants: anon cannot execute the FS25/FS26 RPCs');
  let s1 = (await one('sro', `select kafaa_start_sjt('{}'::jsonb) r`)).r;
  ok(s1.ok && s1.data.total === 8 && s1.data.item && !('expert_key' in s1.data.item) && !('rationale_en' in s1.data.item), 'RPC kafaa_start_sjt: a mixed set of 8; items come without the key, notes or rationale');
  const s2 = (await one('sro', `select kafaa_start_sjt('{}'::jsonb) r`)).r;
  ok(s2.ok && s2.data.resumed === true && s2.data.attempt_id === s1.data.attempt_id, 'RPC kafaa_start_sjt: an open set resumes');
  const aid = s1.data.attempt_id;
  const wrong = (await one('sro', 'select kafaa_submit_sjt($1::jsonb) r', [JSON.stringify({ attempt_id: aid, item_id: 'sjt-questioning-2x', choice: 0 })])).r;
  const bad = (await one('sro', 'select kafaa_submit_sjt($1::jsonb) r', [JSON.stringify({ attempt_id: aid, item_id: s1.data.item.id, choice: 7 })])).r;
  const other = (await one('chco', 'select kafaa_submit_sjt($1::jsonb) r', [JSON.stringify({ attempt_id: aid, item_id: s1.data.item.id, choice: 0 })])).r;
  ok(!wrong.ok && wrong.code === 'invalid' && !bad.ok && bad.code === 'invalid' && !other.ok && other.code === 'not_found', 'RPC kafaa_submit_sjt: refuses an item not on screen, a choice out of range and another person\'s set');
  let step = s1.data;
  let fbOk = true;
  for (let k = 0; k < 8 && !step.done; k++) {
    const r = (await one('sro', 'select kafaa_submit_sjt($1::jsonb) r', [JSON.stringify({ attempt_id: aid, item_id: step.item.id, choice: k % 4 })])).r;
    if (!r.ok || !r.data.feedback || r.data.feedback.key.length !== 4 || !r.data.feedback.rationale_ar) fbOk = false;
    step = r.data;
  }
  const row = (await q('select * from kafaa_sjt_attempts where id = $1', [aid]))[0];
  const sc = scoreSjt(row.responses, coreNames);
  ok(fbOk && step.done && step.result && row.status === 'completed' && row.score === sc.score && canon(row.by_skill) === canon(sc.by_skill),
    'RPC kafaa_submit_sjt: each answer returns the expert key, notes and bilingual rationale; the set completes and is scored server-side (= scoreSjt)');
  const ev1 = Number((await q('select count(*)::int n from kafaa_skill_evidence'))[0].n);
  const aud = (await q(`select ledger_status from kafaa_audit_events where action = 'sjt.complete' and entity_id = $1`, [aid]))[0];
  ok(ev1 === ev0 && aud?.ledger_status === 'not_applicable', 'acceptance FS26: practice is development only: no skill evidence written, no ledger entry, nothing gated');
  const unk = (await one('sro', `select kafaa_start_sjt('{"core_skill_id":"cs-wellbeing"}'::jsonb) r`)).r;
  const foc = (await one('sro', `select kafaa_start_sjt('{"core_skill_id":"cs-speak-up"}'::jsonb) r`)).r;
  ok(!unk.ok && unk.code === 'invalid' && foc.ok && foc.data.total === 3 && foc.data.item.core_skill_id === 'cs-speak-up', 'RPC kafaa_start_sjt: unknown core skill refused; a focused set uses only that skill\'s items');
  const ctx = (await one('sro', 'select kafaa_sjt_context() j')).j;
  ok(ctx && ctx.in_progress === foc.data.attempt_id && ctx.bank.length === 16 && ctx.enec_avg != null, 'RPC kafaa_sjt_context: open set, bank per core skill and the ENEC average');
  // item bank
  const it0 = T.sjt_items.find((i) => i.core_skill_id === 'cs-adaptability');
  const input = { core_skill_id: 'cs-adaptability', theme: 'learning_change', stem_en: 'A new practice scenario.', stem_ar: 'سيناريو تمرين جديد.', options_en: it0.options_en, options_ar: it0.options_ar,
    expert_key: [1, 3, 0, 2], notes_en: it0.notes_en, notes_ar: it0.notes_ar, rationale_en: 'Why.', rationale_ar: 'السبب.' };
  const add = (await one('training-mgr', 'select kafaa_save_sjt_item($1::jsonb) r', [JSON.stringify(input)])).r;
  const noAr = (await one('training-mgr', 'select kafaa_save_sjt_item($1::jsonb) r', [JSON.stringify({ ...input, rationale_ar: '' })])).r;
  const inst = (await one('k-instructor', 'select kafaa_save_sjt_item($1::jsonb) r', [JSON.stringify(input)])).r;
  ok(add.ok && add.data.version === 1 && !noAr.ok && noAr.code === 'invalid' && /rationale/.test(noAr.message) && !inst.ok && inst.code === 'forbidden',
    'RPC kafaa_save_sjt_item: the training manager adds items; a missing Arabic rationale is refused; instructors cannot edit');
  const cs3 = T.sjt_items.filter((i) => i.core_skill_id === 'cs-systems');
  const ret = (it) => one('training-mgr', 'select kafaa_save_sjt_item($1::jsonb) r', [JSON.stringify({ ...it, status: 'retired' })]);
  const r1 = (await ret(cs3[0])).r;
  const r2 = (await ret(cs3[1])).r;
  ok(r1.ok && r1.data.status === 'retired' && !r2.ok && r2.code === 'conflict', 'RPC kafaa_save_sjt_item: retiring keeps at least two active items per core skill');
}
