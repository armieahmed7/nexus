// [FS wave F · E5 · FS58 + FS59] PGlite checks for 20261010265001_kafaa_fs65_aps_roleplay.sql (M33: adaptive problem-solving practice and
// the role-play library with saved feedback). Seed sanity (every scenario has a mid-task change, passes the bank rule, practice runs replay
// with judgeStage/scoreAps; every role-play scenario passes the library rule and its EN and AR example answers pass every criterion of their
// turn; sessions replay with summarise; evidence only for validated sessions, level 1-2); SQL = TS parity on the shared database:
// kafaa_aps_judge / kafaa_aps_score / kafaa_aps_pick / kafaa_aps_next_reasons / kafaa_aps_problem / kafaa_aps_stats_core = judgeStage /
// scoreAps / pickScenario / nextReasons / apsScenarioProblem / apsStats, kafaa_rp_norm / kafaa_rp_eval / kafaa_rp_speak_up / kafaa_rp_summary /
// kafaa_rp_problem / kafaa_rp_stats_core / kafaa_rp_evidence_skills / kafaa_rp_reviewers = rpNorm / evaluateTurn / speakUpTopic / summarise /
// rpScenarioProblem / rpStats / evidenceSkills / eligibleReviewers (seeded + generated cases); the recorded-evidence redefinition keeps
// 'roleplay_sessions'; RLS (keys for training staff only, attempts and sessions Own only); RPC flows inside a rolled-back transaction
// (server-side keys, speak-up stores nothing and writes no audit row, maker-checker review, evidence and ledger, results never gate);
// suppression; grants; additivity. Test profile uids from 6501.
import { readFileSync } from 'node:fs';
import { apsScenarioProblem, apsStats, judgeStage, nextReasons, personSeed, pickScenario, responseOf, scoreAps } from '../../src/modules/m33/aps.ts';
import { RP_PUNCT, SPEAK_UP_CUES, eligibleReviewers, evaluateTurn, evidenceSkills, rpNorm, rpScenarioProblem, rpStats, speakUpTopic, summarise } from '../../src/modules/m33/roleplay.ts';
import { RECORDED_REF_TABLES } from '../../src/domain/skills.ts';

const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${k}:${canon(v[k])}`).join(',')}}` : typeof v === 'number' ? String(Number(v)) : JSON.stringify(v ?? null));
const MIG = 'supabase/migrations/20261010265001_kafaa_fs65_aps_roleplay.sql';
function h32(s) { let x = 0x811c9dc5; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; } return x >>> 0; }

export default async function fs65Checks({ db, one, as, ok, uid }) {
  const S = JSON.parse(readFileSync('src/seed/seed.json', 'utf8'));
  const T = S.tables;
  const TODAY = S.meta.demo_today;
  console.log('FS wave F · E5 · FS58 adaptive problem-solving practice + FS59 role-play library with saved feedback');
  await db.exec('reset role');
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  const coreIds = T.core_skills.filter((c) => (c.status ?? 'active') === 'active').map((c) => c.id);
  const skillIds = T.skills.filter((s) => s.lifecycle !== 'obsolete').map((s) => s.id);
  const skillMap = new Map(T.skills.map((s) => [s.id, { id: s.id, area: s.area ?? null, lifecycle: s.lifecycle ?? null, fs_area: s.fs_area ?? null }]));
  const evIds = evidenceSkills([...skillMap.keys()], skillMap);

  // ── seed sanity (acceptance)
  const scn = T.aps_scenarios;
  ok(scn.length >= 6 && scn.every((s) => s.stages.filter((x) => x.kind === 'change').length >= 1), `acceptance FS58: every one of the ${scn.length} scenarios has at least one mid-task change`);
  ok(scn.every((s) => apsScenarioProblem(s, { coreSkillIds: coreIds, skillIds }) === null), 'seed: every scenario passes the bank rule (bilingual, one best option per stage, facts to judge, no plant security)');
  ok(scn.some((s) => s.stages.some((st) => st.kind === 'change' && st.options.some((o) => o.keep && o.eff === 3))), 'seed: at least one change does not matter (keeping the plan is the best answer)');
  let replay = 0;
  for (const a of T.aps_attempts.filter((x) => x.status === 'completed')) {
    const sc = scn.find((s) => s.id === a.scenario_id);
    const same = a.responses.every((r) => { const st = sc.stages.find((x) => x.id === r.stage_id); return canon(responseOf(judgeStage(st, r.choice, r.picks))) === canon(r); });
    const s = scoreAps(a.responses);
    if (same && s.score === a.score && s.band === a.band && canon(s.dims) === canon(a.dims) && canon(s.reasons) === canon(a.reasons)) replay++;
  }
  const done = T.aps_attempts.filter((x) => x.status === 'completed').length;
  ok(replay === done, `seed: all ${done} completed practice runs replay exactly (judgeStage, scoreAps)`);
  ok(T.skill_evidence.every((e) => e.ref_table !== 'aps_attempts'), 'acceptance FS58: practice never writes skill evidence');
  const rps = T.roleplay_scenarios;
  ok(rps.filter((s) => s.status === 'published').length === 6 && new Set(rps.filter((s) => s.status === 'published').map((s) => s.kind)).size === 6, 'seed: six published role-play scenarios, one per kind');
  ok(rps.every((s) => rpScenarioProblem(s, { coreSkillIds: coreIds, evidenceSkillIds: evIds }) === null), 'acceptance FS59: every scenario publishes a complete rubric in EN and AR (library rule passes)');
  let exOk = true;
  for (const s of rps) for (const t of s.turns) for (const l of ['en', 'ar']) if (evaluateTurn(t, s.rubric, t[`example_${l}`]).criteria.some((c) => !c.pass)) exOk = false;
  ok(exOk, 'acceptance FS59: the rubric works in both languages: every EN and AR example answer passes every criterion of its turn');
  let sReplay = 0;
  const doneS = T.roleplay_sessions.filter((s) => s.status === 'completed');
  for (const s of doneS) {
    const sc = rps.find((x) => x.id === s.scenario_id);
    const sm = summarise(s.turns, sc.rubric, sc.pass_pct);
    if (sm.passed === s.passed && sm.total === s.total && sm.pct === s.pct && sm.ready === s.ready && canon(sm.reasons) === canon(s.reasons)) sReplay++;
  }
  ok(sReplay === doneS.length, `seed: all ${doneS.length} completed role-play sessions replay exactly (summarise)`);
  ok(T.roleplay_sessions.every((s) => s.turns.every((t) => Object.keys(t).every((k) => ['turn_id', 'criteria', 'words', 'at'].includes(k)))), 'acceptance FS59: sessions keep the ticks and word counts, never the answer text');
  const rpEv = T.skill_evidence.filter((e) => e.ref_table === 'roleplay_sessions');
  const val = new Set(T.roleplay_sessions.filter((s) => s.review_status === 'validated').map((s) => s.id));
  ok(rpEv.length > 0 && rpEv.every((e) => val.has(e.ref_id) && e.kind === 'rating' && e.basis === 'validated' && e.level >= 1 && e.level <= 2),
    `seed: ${rpEv.length} role-play evidence rows, each from a validated session (kind rating, basis validated, level 1-2)`);
  ok(RECORDED_REF_TABLES.includes('roleplay_sessions'), 'handover 3.9: roleplay_sessions is a recorded ref_table in TS');

  // ── SQL = TS parity
  const dbScn = (await q('select * from kafaa_aps_scenarios order by id')).map((s) => ({ ...s, sort: Number(s.sort) }));
  let dJ = 0; let nJ = 0;
  for (const s of dbScn) for (const st of s.stages) for (let c = 0; c < st.options.length; c++) {
    const n = (st.cues ?? []).length;
    const subsets = [[], [0], [...Array(n).keys()], [...Array(n).keys()].filter((i) => st.cues[i].relevant), [...Array(n).keys()].filter((i) => !st.cues[i].relevant), n ? [n - 1, 0] : []].map((x) => [...new Set(x)].sort((a, b) => a - b));
    for (const p of subsets) {
      nJ++;
      const sq = (await q('select kafaa_aps_judge($1::jsonb, $2, $3::integer[]) j', [JSON.stringify(st), c, p]))[0].j;
      if (canon(sq) !== canon(judgeStage(st, c, p))) dJ++;
    }
  }
  ok(dJ === 0, `SQL kafaa_aps_judge equals judgeStage() on ${nJ} stage x option x fact-set cases`);
  const gen = [];
  for (let k = 0; k < 300; k++) {
    const s = dbScn[h32(`s${k}`) % dbScn.length];
    const upto = 1 + (h32(`u${k}`) % s.stages.length);
    gen.push(s.stages.slice(0, upto).map((st, i) => {
      const c = h32(`c${k}:${i}`) % st.options.length;
      const p = (st.cues ?? []).map((_, j) => j).filter((j) => h32(`p${k}:${i}:${j}`) % 2 === 0);
      return responseOf(judgeStage(st, c, p));
    }));
  }
  let dS = 0;
  const seededResp = (await q(`select responses from kafaa_aps_attempts where status = 'completed'`)).map((r) => r.responses);
  for (const r of [...seededResp, ...gen, []]) if (canon((await q('select kafaa_aps_score($1::jsonb) j', [JSON.stringify(r)]))[0].j) !== canon(scoreAps(r))) dS++;
  ok(dS === 0, `SQL kafaa_aps_score equals scoreAps() on ${seededResp.length} seeded and ${gen.length + 1} generated runs`);
  const people = await q('select id, kind, status from kafaa_people order by id');
  const attempts = await q('select * from kafaa_aps_attempts');
  let dP = 0; let nP = 0;
  for (const p of people.filter((x) => x.kind === 'staff').slice(0, 70)) {
    const doneMap = new Map();
    for (const a of attempts.filter((x) => x.person_id === p.id && x.status === 'completed')) doneMap.set(a.scenario_id, (doneMap.get(a.scenario_id) ?? 0) + 1);
    for (const no of [1, 2, 3, 7]) {
      nP++;
      const sq = (await q('select kafaa_aps_pick($1, $2) j', [p.id, no]))[0].j;
      if (sq !== pickScenario(dbScn, doneMap, no, personSeed(p.id))) dP++;
    }
  }
  ok(dP === 0, `SQL kafaa_aps_pick equals pickScenario() for ${nP} person x attempt cases`);
  let dN = 0;
  for (const s of dbScn) for (const m of [0, 1, 4]) if (canon((await q('select kafaa_aps_next_reasons($1, $2::jsonb, $3) j', [s.theme, JSON.stringify(s.stages), m]))[0].j) !== canon(nextReasons(s, m))) dN++;
  ok(dN === 0, 'SQL kafaa_aps_next_reasons equals nextReasons() (why a scenario is suggested next)');
  const base = scn[0];
  const st0 = base.stages;
  const mut = [
    base, { ...base, code: 'APS-1' }, { ...base, theme: 'fun' }, { ...base, title_ar: '  ' }, { ...base, core_skill_ids: [] }, { ...base, core_skill_ids: ['cs-wellbeing'] },
    { ...base, skill_ids: ['sk-nope'] }, { ...base, difficulty: 4 }, { ...base, difficulty: 1.5 }, { ...base, est_minutes: 2 }, { ...base, stages: [st0[0]] },
    { ...base, stages: [st0[1], st0[0]] }, { ...base, stages: [st0[0], { ...st0[1], kind: 'initial' }] }, { ...base, stages: [st0[0], { ...st0[1], id: 'plan' }] },
    { ...base, stages: [st0[0], { ...st0[1], debrief_ar: '' }] }, { ...base, stages: [{ ...st0[0], options: st0[0].options.slice(0, 2) }, st0[1]] },
    { ...base, stages: [{ ...st0[0], options: st0[0].options.map((o) => ({ ...o, eff: 3 })) }, st0[1]] }, { ...base, stages: [{ ...st0[0], options: st0[0].options.map((o, i) => (i === 1 ? { ...o, keep: true } : o)) }, st0[1]] },
    { ...base, stages: [st0[0], { ...st0[1], options: st0[1].options.map((o) => ({ ...o, keep: true })) }] }, { ...base, stages: [st0[0], { ...st0[1], cues: st0[1].cues.slice(0, 2) }] },
    { ...base, stages: [st0[0], { ...st0[1], cues: st0[1].cues.map((c) => ({ ...c, relevant: true })) }] }, { ...base, stages: [st0[0], { ...st0[1], cues: [] }] },
    { ...base, stages: [st0[0], { ...st0[1], info_en: `${st0[1].info_en} Check the guard force rota.` }] }, { ...base, status: 'live' }, { ...base, stages: [st0[0], { ...st0[1], options: st0[1].options.map((o, i) => (i === 0 ? { ...o, keep: 'yes' } : o)) }] },
    { ...base, stages: [st0[0], { ...st0[1], cues: { a: 1 } }] }, { ...base, stages: [st0[0], st0[1], st0[2], st0[1], st0[2]] }, { ...base, context_en: 'x'.repeat(1300) },
  ];
  let dQ = 0;
  for (const v of mut) { const sq = (await q('select kafaa_aps_problem($1::jsonb) j', [JSON.stringify(v)]))[0].j; if (sq !== apsScenarioProblem(v, { coreSkillIds: coreIds, skillIds })) dQ++; }
  ok(dQ === 0, `SQL kafaa_aps_problem equals apsScenarioProblem() on ${mut.length} valid and malformed scenarios`);
  ok(new Set(mut.map((v) => apsScenarioProblem(v, { coreSkillIds: coreIds, skillIds }))).size >= 14 && apsScenarioProblem({ ...base, stages: [st0[0]] }, { coreSkillIds: coreIds, skillIds }) === 'stages'
    && apsScenarioProblem({ ...base, stages: [st0[0], { ...st0[1], kind: 'initial' }] }, { coreSkillIds: coreIds, skillIds }) === 'no_change', 'acceptance FS58: a scenario without a mid-task change is refused by the bank rule');
  const sqlStats = (await q('select kafaa_aps_stats_core($1::date) j', [TODAY]))[0].j;
  const tsStats = apsStats(attempts.map((a) => ({ ...a, completed_at: a.completed_at ? new Date(a.completed_at).toISOString() : null })), people, dbScn, TODAY, 10);
  ok(canon(sqlStats) === canon(tsStats), `SQL kafaa_aps_stats_core equals apsStats() (participants ${tsStats.participants})`);
  ok(tsStats.participants >= 10 && [...tsStats.by_theme, ...tsStats.by_quarter, ...tsStats.bands].every((x) => x.people === null || x.people >= 10) && tsStats.by_theme.some((x) => x.people === null),
    'suppression FS58: every shown cell names 10 people or more; small themes are suppressed');

  // FS59 parity
  const chars = `${RP_PUNCT}abcXYZ ÉéAa0129٣٧ إأآٱىةؤئ ًٌٍَُِّْـ قلق شكوى I want TO report مضايقة harassment *?؟`;
  const strs = ['', '   ', 'I want to report my supervisor', 'إنني أريد الإبلاغ عن تحرش', ...SPEAK_UP_CUES, ...SPEAK_UP_CUES.map((c) => c.toUpperCase()), 'Raise a concern about the valve', 'speak up early'];
  for (let k = 0; k < 250; k++) strs.push(Array.from({ length: 1 + (h32(`l${k}`) % 40) }, (_, j) => chars[h32(`ch${k}:${j}`) % chars.length]).join(''));
  for (const s of rps) for (const t of s.turns) strs.push(t.example_en, t.example_ar, t.prompt_en);
  let dNorm = 0; let dSp = 0;
  for (const s of strs) {
    const r = (await q('select kafaa_rp_norm($1) n, kafaa_rp_speak_up($1) s', [s]))[0];
    if (r.n !== rpNorm(s)) dNorm++;
    if (r.s !== speakUpTopic(s)) dSp++;
  }
  ok(dNorm === 0, `SQL kafaa_rp_norm equals rpNorm() on ${strs.length} strings (punctuation, Arabic forms, diacritics, digits, case)`);
  ok(dSp === 0, `SQL kafaa_rp_speak_up equals speakUpTopic() on ${strs.length} strings`);
  ok(speakUpTopic('I want to report my supervisor for harassment') && speakUpTopic('أريد الإبلاغ عن مضايقة') && !rps.some((s) => s.turns.some((t) => speakUpTopic(t.example_en) || speakUpTopic(t.example_ar)))
    && !speakUpTopic('I have a concern about the temporary modification, so I will raise a condition report'), 'speak-up rule: real concerns are routed; practising how to raise a technical concern is not');
  const dbRp = await q('select * from kafaa_roleplay_scenarios order by id');
  let dE = 0; let nE = 0;
  for (const s of dbRp) for (const t of s.turns) {
    const parts = t.example_en.split(/(?<=[.!?])\s+/);
    const texts = [t.example_en, t.example_ar, parts[0], parts.slice(0, -1).join(' '), t.example_en.toUpperCase(), 'ok', t.example_ar.replace(/[.،؟?]/g, ''), ...strs.slice(0, 12)];
    for (const x of texts) { nE++; if (canon((await q('select kafaa_rp_eval($1::jsonb, $2::jsonb, $3) j', [JSON.stringify(t), JSON.stringify(s.rubric), x]))[0].j) !== canon(evaluateTurn(t, s.rubric, x))) dE++; }
  }
  ok(dE === 0, `SQL kafaa_rp_eval equals evaluateTurn() on ${nE} answers (examples, partial answers, upper case, noise)`);
  let dSum = 0; let nSum = 0;
  const sess = await q('select * from kafaa_roleplay_sessions');
  for (const s of sess) {
    const sc = dbRp.find((x) => x.id === s.scenario_id);
    nSum++;
    if (canon((await q('select kafaa_rp_summary($1::jsonb, $2::jsonb, $3) j', [JSON.stringify(s.turns), JSON.stringify(sc.rubric), sc.pass_pct]))[0].j) !== canon(summarise(s.turns, sc.rubric, sc.pass_pct))) dSum++;
  }
  ok(dSum === 0, `SQL kafaa_rp_summary equals summarise() on ${nSum} seeded sessions (complete and partial)`);
  const rb = rps[0];
  const rmut = [rb, { ...rb, code: 'RP-1' }, { ...rb, kind: 'chat' }, { ...rb, role_ar: '' }, { ...rb, core_skill_ids: ['x'] }, { ...rb, skill_ids: ['sk-sc-02'] }, { ...rb, skill_ids: ['sk-nope'] },
    { ...rb, level: 3 }, { ...rb, pass_pct: 95 }, { ...rb, est_minutes: 60 }, { ...rb, rubric: rb.rubric.slice(0, 2) }, { ...rb, rubric: [...rb.rubric, rb.rubric[0]] },
    { ...rb, rubric: rb.rubric.map((c, i) => (i === 0 ? { ...c, tip_ar: '' } : c)) }, { ...rb, rubric: rb.rubric.map((c, i) => (i === 0 ? { ...c, check: { type: 'vibes' } } : c)) },
    { ...rb, rubric: rb.rubric.map((c, i) => (i === 0 ? { ...c, check: { type: 'cues', cues: [] } } : c)) }, { ...rb, rubric: rb.rubric.map((c, i) => (i === 0 ? { ...c, check: { type: 'cues', cues: ['*'] } } : c)) },
    { ...rb, rubric: rb.rubric.map((c, i) => (i === 0 ? { ...c, check: { ...c.check, min: 99 } } : c)) }, { ...rb, rubric: rb.rubric.map((c, i) => (i === 0 ? { ...c, check: { type: 'length', min: 10, max: 5 } } : c)) },
    { ...rb, turns: rb.turns.slice(0, 2) }, { ...rb, turns: rb.turns.map((t, i) => (i === 0 ? { ...t, example_ar: '' } : t)) }, { ...rb, turns: rb.turns.map((t, i) => (i === 0 ? { ...t, criteria: ['nope'] } : t)) },
    { ...rb, turns: rb.turns.map((t, i) => (i === 0 ? { ...t, criteria: ['scope', 'scope'] } : t)) }, { ...rb, turns: rb.turns.map((t) => ({ ...t, criteria: t.criteria.filter((c) => c !== 'roles') })) },
    { ...rb, setting_en: `${rb.setting_en} Near the vital area.` }, { ...rb, status: 'archived' }, { ...rb, rubric: rb.rubric.map((c, i) => (i === 0 ? { ...c, check: { type: 'length', min: 1, max: 400 } } : c)) }];
  let dR = 0;
  for (const v of rmut) { const sq = (await q('select kafaa_rp_problem($1::jsonb) j', [JSON.stringify(v)]))[0].j; if (sq !== rpScenarioProblem(v, { coreSkillIds: coreIds, evidenceSkillIds: evIds })) dR++; }
  ok(dR === 0, `SQL kafaa_rp_problem equals rpScenarioProblem() on ${rmut.length} valid and malformed scenarios`);
  ok(rpScenarioProblem({ ...rb, rubric: rb.rubric.map((c, i) => (i === 0 ? { ...c, label_ar: '' } : c)) }, { coreSkillIds: coreIds, evidenceSkillIds: evIds }) === 'criterion', 'acceptance FS59: a rubric without its Arabic text cannot be saved');
  const sqlRs = (await q('select kafaa_rp_stats_core($1::date) j', [TODAY]))[0].j;
  const tsRs = rpStats(sess, people, dbRp, TODAY, 10);
  ok(canon(sqlRs) === canon(tsRs), `SQL kafaa_rp_stats_core equals rpStats() (participants ${tsRs.participants})`);
  ok(tsRs.participants >= 10 && tsRs.by_kind.every((x) => x.people === null || x.people >= 10), 'suppression FS59: shown cells name 10 people or more');
  const evSql = (await q('select kafaa_rp_evidence_skills($1::text[]) j', [[...skillMap.keys()]]))[0].j;
  ok(canon(evSql) === canon(evIds), `SQL kafaa_rp_evidence_skills equals evidenceSkills() (${evIds.length} skills can carry role-play evidence; security and cyber hygiene never)`);
  const assigns = await q('select person_id, role, status from kafaa_role_assignments');
  let dRv = 0;
  for (const pid of ['p-k-ro', 'p-training-mgr', 'p-k-instructor', 'p-chco', null]) if (canon((await q('select kafaa_rp_reviewers($1) j', [pid]))[0].j) !== canon(eligibleReviewers(people, assigns, pid))) dRv++;
  ok(dRv === 0 && !eligibleReviewers(people, assigns, 'p-training-mgr').includes('p-training-mgr'), 'SQL kafaa_rp_reviewers equals eligibleReviewers() (never the person)');
  const body = (await q(`select prosrc from pg_proc where proname = 'kafaa_skill_states_v2'`))[0].prosrc;
  const body2 = (await q(`select prosrc from pg_proc where proname = 'kafaa_skills_apply'`))[0].prosrc;
  ok(body.includes("'roleplay_sessions'") && body2.includes("'roleplay_sessions'") && body.includes("'knowledge_assets'") && body.includes("'ai_drill_attempts'"),
    'handover 3.9: the final kafaa_skill_states_v2 / kafaa_skills_apply keep roleplay_sessions with every earlier recorded ref_table');

  // ── RLS
  let n = 6500;
  const addProfile = async (persona, role) => {
    const row = (await q('select user_id from profiles where persona_id = $1', [persona]))[0];
    if (row) { uid[persona] = row.user_id; return; }
    uid[persona] = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, 'enec-ops', 'employee', [role]]);
  };
  await db.exec('begin');
  try {
    for (const [p, r] of [['nse', 'NSE'], ['qc-inspector', 'QC Inspector'], ['k-ro', 'Reactor operator'], ['k-lo-trainee', 'Trainee'], ['buyer', 'Buyer']]) await addProfile(p, r);
    const cnt = async (who, sql) => Number((await one(who, sql)).n);
    const pubRp = rps.filter((s) => s.status === 'published').length;
    ok(await cnt(null, 'select count(*)::int n from kafaa_aps_scenarios') === 0 && await cnt(null, 'select count(*)::int n from kafaa_roleplay_scenarios') === 0
      && await cnt(null, 'select count(*)::int n from kafaa_aps_attempts') === 0 && await cnt(null, 'select count(*)::int n from kafaa_roleplay_sessions') === 0, 'RLS: anon reads nothing of FS58/FS59');
    ok(await cnt('nse', 'select count(*)::int n from kafaa_aps_scenarios') === 0 && await cnt('training-mgr', 'select count(*)::int n from kafaa_aps_scenarios') === scn.length
      && await cnt('k-instructor', 'select count(*)::int n from kafaa_aps_scenarios') === scn.length, 'RLS: the scenario bank (with the key) is read by training staff only; takers get stages without it from the RPCs');
    ok(await cnt('nse', 'select count(*)::int n from kafaa_roleplay_scenarios') === pubRp && await cnt('nse', `select count(*)::int n from kafaa_roleplay_scenarios where status <> 'published'`) === 0
      && await cnt('training-mgr', 'select count(*)::int n from kafaa_roleplay_scenarios') === rps.length, 'RLS: staff read the published role-play library and rubrics; drafts only training staff');
    ok(await cnt('k-ro', 'select count(*)::int n from kafaa_roleplay_sessions') > 0 && await cnt('k-ro', `select count(*)::int n from kafaa_roleplay_sessions where person_id <> 'p-k-ro'`) === 0
      && await cnt('k-ro', `select count(*)::int n from kafaa_aps_attempts where person_id <> 'p-k-ro'`) === 0, 'RLS: a person reads only their own practice runs and role-play feedback');
    let leak = 0;
    for (const p of ['sro', 'chco', 'k-hr-analyst', 'training-mgr', 'k-admin', 'k-auditor', 'k-instructor']) {
      leak += await cnt(p, `select count(*)::int n from kafaa_roleplay_sessions where person_id <> 'p-${p}'`);
      leak += await cnt(p, `select count(*)::int n from kafaa_aps_attempts where person_id <> 'p-${p}'`);
    }
    ok(leak === 0, 'acceptance FS59: feedback history is visible only to its owner: line managers, HR, the training manager (even as reviewer), admins, auditors and instructors read none of it');
    const readers = await q(`select proname from pg_proc where prosrc ilike '%kafaa_aps_attempts%' or prosrc ilike '%kafaa_roleplay_sessions%' order by 1`);
    ok(readers.every((r) => /^kafaa_(aps_|rp_|start_aps|submit_aps|save_aps|start_roleplay|roleplay_|request_roleplay|withdraw_roleplay|attach_roleplay|save_roleplay)/.test(r.proname)),
      `only FS58/FS59 functions read the practice tables (${readers.length}); no talent-review or qualification function does`);

    // ── RPC flows (rolled back)
    const ev0 = Number((await q('select count(*)::int n from kafaa_skill_evidence'))[0].n);
    const qual0 = Number((await q('select count(*)::int n from kafaa_qual_records'))[0].n);
    const fails = async (fn) => { await db.exec('savepoint fx'); try { await fn(); await db.exec('release savepoint fx'); return false; } catch { await db.exec('rollback to savepoint fx'); return true; } };
    ok(await fails(() => as(null, `select kafaa_start_aps('{}'::jsonb)`)) && await fails(() => as(null, `select kafaa_roleplay_turn('{}'::jsonb)`)), 'grants: anon cannot execute the FS58/FS59 RPCs');
    ok(await fails(() => as('nse', `select kafaa_aps_score('[]'::jsonb)`)) && await fails(() => as('nse', `select kafaa_rp_eval('{}'::jsonb, '[]'::jsonb, 'x')`)), 'grants: internal helpers are not executable by API roles');
    const st1 = (await one('k-lo-trainee', `select kafaa_start_aps('{"scenario_id":"aps-os-001"}'::jsonb) r`)).r;
    ok(st1.ok && st1.data.stage && st1.data.stage.id === 'plan' && !JSON.stringify(st1.data.stage).includes('"eff"') && !JSON.stringify(st1.data.stage).includes('relevant') && !('debrief_en' in st1.data.stage),
      'RPC kafaa_start_aps: the first stage only, without effectiveness, relevance or debrief');
    const dr = (await one('k-lo-trainee', `select kafaa_start_aps('{"scenario_id":"aps-wl-001"}'::jsonb) r`)).r;
    ok(!dr.ok && dr.code === 'not_found', 'RPC kafaa_start_aps: a draft scenario cannot be practised');
    const bad1 = (await one('k-lo-trainee', 'select kafaa_submit_aps($1::jsonb) r', [JSON.stringify({ attempt_id: st1.data.attempt_id, stage_id: 'crane', choice: 0, picks: [] })])).r;
    const bad2 = (await one('k-lo-trainee', 'select kafaa_submit_aps($1::jsonb) r', [JSON.stringify({ attempt_id: st1.data.attempt_id, stage_id: 'plan', choice: 0, picks: [9] })])).r;
    const bad3 = (await one('nse', 'select kafaa_submit_aps($1::jsonb) r', [JSON.stringify({ attempt_id: st1.data.attempt_id, stage_id: 'plan', choice: 0, picks: [] })])).r;
    ok(bad1.code === 'invalid' && bad2.code === 'invalid' && bad3.code === 'not_found', 'RPC kafaa_submit_aps: refuses a stage not on screen, facts outside the list and another person\'s run');
    let step = st1.data; let changeSeen = false; let fbOk = true;
    const sc1 = scn.find((s) => s.id === 'aps-os-001');
    while (!step.done) {
      const stg = sc1.stages.find((s) => s.id === step.stage.id);
      const r = (await one('k-lo-trainee', 'select kafaa_submit_aps($1::jsonb) r', [JSON.stringify({ attempt_id: step.attempt_id, stage_id: stg.id, choice: 1, picks: [0, 1] })])).r;
      if (!r.ok || canon(r.data.feedback) !== canon(judgeStage(stg, 1, [0, 1]))) fbOk = false;
      if (r.data.stage?.kind === 'change') changeSeen = true;
      step = r.data;
    }
    const row = (await q('select * from kafaa_aps_attempts where id = $1', [step.attempt_id]))[0];
    ok(fbOk && changeSeen && row.status === 'completed' && row.score === scoreAps(row.responses).score && step.result.band === row.band,
      'RPC kafaa_submit_aps: each answer returns the key and debrief (= judgeStage); the change is revealed only after the plan; the run is scored server-side (= scoreAps)');
    const ev1 = Number((await q('select count(*)::int n from kafaa_skill_evidence'))[0].n);
    const qual1 = Number((await q('select count(*)::int n from kafaa_qual_records'))[0].n);
    const audA = (await q(`select ledger_status from kafaa_audit_events where action = 'aps.complete' and entity_id = $1`, [step.attempt_id]))[0];
    ok(ev1 === ev0 && qual1 === qual0 && audA?.ledger_status === 'not_applicable', 'acceptance FS58: results never gate a qualification: no skill evidence, no qualification record, no ledger entry');
    const ctx = (await one('k-lo-trainee', 'select kafaa_aps_context() j')).j;
    ok(ctx && ctx.scenarios.length === scn.filter((s) => s.status === 'published').length && ctx.completed === 1 && ctx.enec_avg != null && ctx.next?.reasons?.length === 2, 'RPC kafaa_aps_context: catalogue, my runs, ENEC average and the suggestion with reasons');
    ok((await one('k-hr-analyst', 'select kafaa_aps_stats() j')).j?.participants >= 10 && (await one('sro', 'select kafaa_aps_stats() j')).j === null, 'RPC kafaa_aps_stats: HR aggregate only; a line manager gets nothing');
    // bank
    const nb = { ...sc1, id: null, code: 'APS-OS-099', status: 'draft' };
    const add = (await one('training-mgr', 'select kafaa_save_aps_scenario($1::jsonb) r', [JSON.stringify(nb)])).r;
    const noCh = (await one('training-mgr', 'select kafaa_save_aps_scenario($1::jsonb) r', [JSON.stringify({ ...nb, code: 'APS-OS-098', stages: [sc1.stages[0], { ...sc1.stages[1], kind: 'initial' }] })])).r;
    const inst = (await one('k-instructor', 'select kafaa_save_aps_scenario($1::jsonb) r', [JSON.stringify({ ...nb, code: 'APS-OS-097' })])).r;
    ok(add.ok && add.data.version === 1 && !noCh.ok && noCh.code === 'invalid' && /mid-task change/.test(noCh.message) && !inst.ok && inst.code === 'forbidden',
      'RPC kafaa_save_aps_scenario: the training manager adds scenarios; one without a mid-task change is refused; instructors cannot edit');
    const ckBlocked = await fails(() => db.query(`update kafaa_aps_scenarios set stages = jsonb_build_array(stages -> 0) where id = 'aps-os-001'`));
    ok(ckBlocked, 'acceptance FS58: the database refuses a scenario without a mid-task change (check kafaa_aps_scenarios_change_ck)');

    // role-play
    const audN = async () => Number((await q('select count(*)::int n from kafaa_audit_events'))[0].n);
    const r0 = (await one('k-lo-trainee', `select kafaa_start_roleplay('{"scenario_id":"rp-st-01"}'::jsonb) r`)).r;
    ok(r0.ok && r0.data.turn?.id === 'status' && r0.data.total === 4, 'RPC kafaa_start_roleplay: a published scenario starts at its first turn');
    const a0 = await audN();
    const sessBefore = JSON.stringify((await q('select * from kafaa_roleplay_sessions where id = $1', [r0.data.session_id]))[0]);
    const su = (await one('k-lo-trainee', 'select kafaa_roleplay_turn($1::jsonb) r', [JSON.stringify({ session_id: r0.data.session_id, turn_id: 'status', text: 'I want to report my supervisor: he pressured me to sign a record zq7leak' })])).r;
    const sessAfter = JSON.stringify((await q('select * from kafaa_roleplay_sessions where id = $1', [r0.data.session_id]))[0]);
    const leakText = Number((await q(`select count(*)::int n from kafaa_audit_events t where to_jsonb(t)::text ilike '%zq7leak%'`))[0].n);
    ok(!su.ok && su.code === 'speak_up' && su.data.route === '/speak-up' && (await audN()) === a0 && sessAfter === sessBefore && leakText === 0,
      'acceptance FS59: a speak-up topic routes to the existing channel and is never stored: no session change, no audit row, no text anywhere');
    const scSt = rps.find((s) => s.id === 'rp-st-01');
    const sec = (await one('k-lo-trainee', 'select kafaa_roleplay_turn($1::jsonb) r', [JSON.stringify({ session_id: r0.data.session_id, turn_id: 'status', text: 'The fans run. Also the guard posts and the cctv cameras are all fine.' })])).r;
    ok(!sec.ok && sec.code === 'security_restricted', 'RPC kafaa_roleplay_turn: plant-security detail is refused and not stored');
    let rs = r0.data; let tOk = true;
    for (const t of scSt.turns) {
      const r = (await one('k-lo-trainee', 'select kafaa_roleplay_turn($1::jsonb) r', [JSON.stringify({ session_id: rs.session_id, turn_id: t.id, text: t.example_en })])).r;
      const exp = evaluateTurn(t, scSt.rubric, t.example_en);
      if (!r.ok || canon(r.data.feedback.criteria) !== canon(exp.criteria) || r.data.feedback.words !== exp.words) tOk = false;
      rs = r.data;
    }
    const sRow = (await q('select * from kafaa_roleplay_sessions where id = $1', [rs.session_id]))[0];
    ok(tOk && rs.done && sRow.status === 'completed' && sRow.ready && sRow.pct === 100 && !JSON.stringify(sRow).includes(scSt.turns[0].example_en.slice(0, 30)),
      'RPC kafaa_roleplay_turn: ticks equal evaluateTurn(); the session completes with its summary; the answer text is never stored');
    const rv = (await one('k-lo-trainee', 'select kafaa_roleplay_reviewers() j')).j;
    ok(rv.length > 0 && rv.every((x) => x.id !== 'p-k-lo-trainee' && x.role), 'RPC kafaa_roleplay_reviewers: instructors, the training manager and the HR authority, never me');
    const noRv = (await one('k-lo-trainee', 'select kafaa_request_roleplay_review($1::jsonb) r', [JSON.stringify({ session_id: rs.session_id, reviewer_id: 'p-nse', context: 'Practised with my lead.' })])).r;
    const ctxSu = (await one('k-lo-trainee', 'select kafaa_request_roleplay_review($1::jsonb) r', [JSON.stringify({ session_id: rs.session_id, reviewer_id: 'p-training-mgr', context: 'Something happened to me and I want to report harassment' })])).r;
    const req = (await one('k-lo-trainee', 'select kafaa_request_roleplay_review($1::jsonb) r', [JSON.stringify({ session_id: rs.session_id, reviewer_id: 'p-training-mgr', context: 'Practised with my lead during a quiet hour.' })])).r;
    const twice = (await one('k-lo-trainee', 'select kafaa_request_roleplay_review($1::jsonb) r', [JSON.stringify({ session_id: rs.session_id, reviewer_id: 'p-training-mgr', context: 'Again please.' })])).r;
    ok(noRv.code === 'invalid' && ctxSu.code === 'speak_up' && req.ok && twice.code === 'conflict', 'RPC kafaa_request_roleplay_review: a named eligible reviewer only; speak-up context stored nowhere; one open request');
    const queue = (await one('training-mgr', 'select kafaa_roleplay_review_queue() j')).j;
    const qItem = queue.items.find((x) => x.session_id === rs.session_id);
    ok(qItem && qItem.rubric.length === scSt.rubric.length && qItem.skills.length === 2 && !JSON.stringify(queue).includes(scSt.turns[0].example_en.slice(0, 30))
      && (await one('k-instructor', 'select kafaa_roleplay_review_queue() j')).j.items.every((x) => x.session_id !== rs.session_id) && (await one('nse', 'select kafaa_roleplay_review_queue() j')).j === null,
      'RPC kafaa_roleplay_review_queue: the named reviewer sees the ticks, rubric and context (never the answers); other reviewers and staff do not');
    const self = (await one('training-mgr', 'select kafaa_attach_roleplay_evidence($1::jsonb) r', [JSON.stringify({ session_id: T.roleplay_sessions.find((s) => s.person_id === 'p-training-mgr')?.id ?? 'x', decision: 'validate' })])).r;
    const other = (await one('k-instructor', 'select kafaa_attach_roleplay_evidence($1::jsonb) r', [JSON.stringify({ session_id: rs.session_id, decision: 'validate' })])).r;
    const staff = (await one('nse', 'select kafaa_attach_roleplay_evidence($1::jsonb) r', [JSON.stringify({ session_id: rs.session_id, decision: 'validate' })])).r;
    const noNote = (await one('training-mgr', 'select kafaa_attach_roleplay_evidence($1::jsonb) r', [JSON.stringify({ session_id: rs.session_id, decision: 'decline', note: 'no' })])).r;
    ok(['maker_checker', 'invalid', 'not_found'].includes(self.code) && other.code === 'forbidden' && staff.code === 'forbidden' && noNote.code === 'invalid',
      'RPC kafaa_attach_roleplay_evidence: only the named reviewer (recognition A), never the person; a decline needs a reason');
    const okV = (await one('training-mgr', 'select kafaa_attach_roleplay_evidence($1::jsonb) r', [JSON.stringify({ session_id: rs.session_id, decision: 'validate', note: 'Observed: clear and complete.' })])).r;
    const evRows = await q(`select * from kafaa_skill_evidence where ref_table = 'roleplay_sessions' and ref_id = $1 order by id`, [rs.session_id]);
    const states = await q(`select skill_id, level, basis from kafaa_person_skills where person_id = 'p-k-lo-trainee' and skill_id = any($1) and active`, [evRows.map((e) => e.skill_id)]);
    const audV = (await q(`select ledger_status from kafaa_audit_events where action = 'roleplay.review.decide' and entity_id = $1 and outcome = 'ok'`, [rs.session_id]))[0];
    ok(okV.ok && evRows.length === 2 && evRows.every((e) => e.kind === 'rating' && e.basis === 'validated' && e.level === 1 && e.id === `se:roleplay:${rs.session_id}:${e.skill_id}`)
      && states.length === 2 && ['written', 'skipped'].includes(audV?.ledger_status), 'attach as evidence after validation: rating evidence (validated, level 1-2), skills recomputed, one ledger row (skipped for a Kafa\'a-only persona)');
    await q(`select kafaa_skills_apply('p-k-lo-trainee', current_date)`);
    ok(Number((await q(`select count(*)::int n from kafaa_skill_evidence where ref_table = 'roleplay_sessions' and ref_id = $1 and active`, [rs.session_id]))[0].n) === 2,
      'recorded evidence: a recompute keeps the validated role-play evidence (handover 3.9)');
    const notes = await q(`select id from kafaa_notifications where id like $1`, [`nt-rp-${rs.session_id}-%`]);
    ok(notes.length === 2, 'notifications: the reviewer was asked and the person told of the validation (kind roleplay)');
  } finally { await db.exec('rollback'); }

  // ── additivity
  const mig = readFileSync(MIG, 'utf8');
  ok(!/\b(drop|delete|truncate)\b/i.test(mig), 'additivity: the migration holds no removal words (comments and strings included)');
  const alters = [...mig.matchAll(/alter table\s+(\S+)/gi)].map((m) => m[1]);
  ok(alters.every((t) => t.startsWith('kafaa_')), `additivity: ALTER TABLE only on kafaa_* tables (${new Set(alters).size} tables)`);
  const created = [...mig.matchAll(/create or replace function\s+(\S+?)\(/gi)].map((m) => m[1]);
  ok(created.every((f) => f.startsWith('kafaa_')), `additivity: ${created.length} functions, all kafaa_*`);
}
