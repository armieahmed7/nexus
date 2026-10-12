// [FS wave F · E1 · FS50 + FS51] PGlite checks for 20261010261001_kafaa_fs61_strategy_forecasts.sql (M35 Workforce Strategy and Disclosure).
// Seed (13 register rows, each with an owner and a decision rationale, passing the edit check; 2026-Q3 reviews with the computed progress
// snapshot; 4 forecast versions, names marked SIMULATED, release text clean, stored results = the TS rules on the seed); SQL = TS parity on
// the database state: kafaa_sf_normalize = normalizeForecastParams (valid and malformed sets), kafaa_sf_base = gatherForecastBase (current
// fleet, every staffing scenario, both catalogues), kafaa_sf_compute = computeForecast (defaults, slider corners, levers and 40 generated
// assumption sets; "reset assumptions" reproduces the baseline exactly), kafaa_crs_problem = criticalProblem, kafaa_crs_board_core =
// criticalBoard; suppression (no skill under 10 holders, no person id in any result); RLS (workforce_strategy only); the six RPCs and their
// RBAC (W drafts, A adopts / reviews / releases), audit and ledger rows, maker rules, supersession (flows inside a rolled-back
// transaction); grants; additivity. Prints the md5 of every new function body and the row digest of every new table for the live check.
import { readFileSync } from 'node:fs';
import { publicTextIsClean } from '../../src/domain/future.ts';
import {
  DEFAULTS, LEVER_LIMITS, LEVER_PARAMS, MIN_GROUP, SCENARIOS, SHARED_LIMITS, SHARED_PARAMS, computeForecast, forecastFor, forecastInputFromTables,
  gatherForecastBase, normalizeForecastParams, simulatedName,
} from '../../src/modules/m35/forecast.ts';
import { boardInputFromTables, criticalBoard, criticalProblem } from '../../src/modules/m35/critical.ts';

const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${k}:${canon(v[k])}`).join(',')}}` : typeof v === 'number' ? String(Number(v)) : typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) ? String(Number(v)) : JSON.stringify(v ?? null));
const same = (a, b) => canon(a) === canon(b);
const MIG = 'supabase/migrations/20261010261001_kafaa_fs61_strategy_forecasts.sql';
const TABLES = ['critical_skills', 'critical_skill_reviews', 'skill_forecasts'];
const FUNCS = ['kafaa_sf_normalize', 'kafaa_sf_needs', 'kafaa_sf_base', 'kafaa_sf_survive', 'kafaa_sf_project', 'kafaa_sf_compute', 'kafaa_sf_for', 'kafaa_crs_problem', 'kafaa_crs_quarter',
  'kafaa_crs_quarter_end', 'kafaa_crs_prev_quarter', 'kafaa_crs_held', 'kafaa_crs_target_for', 'kafaa_crs_progress', 'kafaa_crs_review_state', 'kafaa_crs_board_core', 'kafaa_crs_review_problem',
  'kafaa_critical_skill_board', 'kafaa_save_critical_skill', 'kafaa_review_critical_skill', 'kafaa_compute_skill_forecast', 'kafaa_save_skill_forecast', 'kafaa_release_skill_forecast'];
const INPUT_TABLES = ['people', 'skills', 'person_skills', 'role_competencies', 'klra_positions', 'klra_assessments', 'klra_settings', 'handover_cohorts', 'external_cover',
  'workforce_snapshots', 'adv_skills', 'future_skills', 'scenarios', 'role_profile_versions', 'critical_skills', 'critical_skill_reviews', 'skill_gap_plans', 'skill_forecasts'];

export default async function fs61Checks({ db, one, ok, uid }) {
  const S = JSON.parse(readFileSync('src/seed/seed.json', 'utf8'));
  const T = S.tables;
  console.log('FS wave F · E1 · FS50 Critical Future-Skills Register + FS51 three-scenario skill forecasting bands (M35)');
  await db.exec('reset role');
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  const fix = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v instanceof Date ? (/(_at|^ts)$/.test(k) ? v.toISOString() : v.toISOString().slice(0, 10)) : v]));
  const dbRows = async () => { const D = {}; for (const t of INPUT_TABLES) D[t] = (await q(`select * from kafaa_${t} order by id`)).map(fix); return D; };
  for (const [persona, roles] of [['buyer', ['Buyer']]]) {
    if (uid[persona]) continue;
    const row = (await q('select user_id from profiles where persona_id = $1', [persona]))[0];
    if (row) { uid[persona] = row.user_id; continue; }
    uid[persona] = '00000000-0000-4000-8000-000000006101';
    await q('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, 'enec-ops', 'employee', roles]);
  }

  // ── seed sanity and acceptance on the seed
  const cs = T.critical_skills, rv = T.critical_skill_reviews, sf = T.skill_forecasts;
  const ctx = {
    skills: Object.fromEntries(T.skills.map((s) => [s.id, { area: s.area ?? null, lifecycle: s.lifecycle ?? null }])),
    owners: T.people.filter((p) => p.kind === 'staff' && p.status === 'active').map((p) => p.id),
    plans: Object.fromEntries(T.skill_gap_plans.map((g) => [g.id, { sk_id: g.sk_id ?? null }])),
  };
  ok(cs.length === 13 && cs.filter((r) => r.status === 'active').length === 11 && cs.every((r) => criticalProblem(r, ctx) === null), `seed: ${cs.length} register rows (11 adopted, 2 drafts), every row passes the edit check`);
  ok(cs.every((r) => r.owner_function && ctx.owners.includes(r.owner_person_id) && r.rationale_en.trim().length >= 20 && /[؀-ۿ]/.test(r.rationale_ar) && ['build', 'buy', 'borrow', 'bot'].includes(r.decision)),
    'acceptance (FS50): every row has an owner (function and an active role card) and a build/buy/borrow/bot decision with its rationale in English and Arabic');
  ok(!cs.some((r) => 'progress' in r || 'pct' in r) && rv.every((x) => x.progress && typeof x.progress.suppressed === 'boolean'), 'acceptance (FS50): progress is never a column of the register (computed; reviews keep a computed snapshot)');
  ok(new Set(cs.flatMap((r) => r.gap_plan_ids)).size === 5 && cs.every((r) => r.gap_plan_ids.every((g) => T.skill_gap_plans.find((p) => p.id === g)?.sk_id === r.skill_id)), 'seed: 5 of the 7 FS04 gap plans linked, each to a row of the same skill (no parallel plan table)');
  ok(sf.length === 4 && sf.every((f) => /simulated/i.test(f.name) && f.simulated && f.name === simulatedName(f.name)) && sf.filter((f) => f.status === 'released').length === 2
    && sf.filter((f) => f.summary_en).every((f) => publicTextIsClean([f.name, f.summary_en, f.summary_ar])), 'seed: 4 forecast versions (2025 pilot and 2026 released, 2 drafts), names marked SIMULATED, release text clean');
  const inpSeed = forecastInputFromTables((t) => T[t] ?? []);
  ok(sf.every((f) => { const r = forecastFor(inpSeed, f.params); return r.code === 'ok' && same(r.result, f.results); }), 'seed: every stored forecast equals the TS rules recomputed on the seed (computed, never typed)');
  ok(rv.every((x) => same(x.progress, criticalBoard(boardInputFromTables((t) => T[t] ?? []), '2026-09-30').rows.find((r) => r.id === x.critical_skill_id).progress)),
    'seed: every 2026-Q3 review holds the computed progress snapshot');

  // ── parity on the database state
  const D = await dbRows();
  const inp = forecastInputFromTables((t) => D[t] ?? []);
  const scenIds = [null, ...D.scenarios.map((s) => s.id)];
  let bad = [];
  for (const cat of ['all', 'established']) for (const sid of scenIds) {
    const a = (await q('select kafaa_sf_base($1, $2) b', [sid, cat]))[0].b;
    if (!same(a, gatherForecastBase(inp, sid, cat))) bad.push(`${cat}/${sid ?? 'fleet'}`);
  }
  ok(bad.length === 0, `base aggregates: SQL kafaa_sf_base = TS gatherForecastBase for the current fleet and ${D.scenarios.length} staffing scenarios, both catalogues${bad.length ? ` (differ: ${bad.join(', ')})` : ''}`);
  ok((await q("select kafaa_sf_base('scn-nope', 'all') is null x"))[0].x, 'unknown staffing scenario: kafaa_sf_base returns null (the RPC refuses not_found)');

  let seedN = 61;
  const rand = () => { seedN = (seedN * 1103515245 + 12345) % 2147483648; return seedN / 2147483648; };
  const pick = ([lo, hi, step]) => { const n = Math.round((hi - lo) / step); return Math.round((lo + Math.floor(rand() * (n + 1)) * step) * 1000) / 1000; };
  const sets = [{}, DEFAULTS, { catalogue: 'established' }, ...scenIds.filter(Boolean).map((s) => ({ scenario_id: s }))];
  for (const k of SHARED_PARAMS) { sets.push({ [k]: SHARED_LIMITS[k][0] }); sets.push({ [k]: SHARED_LIMITS[k][1] }); }
  for (const s of SCENARIOS) for (const k of LEVER_PARAMS) { sets.push({ levers: { [s]: { [k]: LEVER_LIMITS[k][0] } } }); sets.push({ levers: { [s]: { [k]: LEVER_LIMITS[k][1] } } }); }
  for (let i = 0; i < 40; i++) {
    const p = {};
    for (const k of SHARED_PARAMS) if (rand() < 0.5) p[k] = pick(SHARED_LIMITS[k]);
    if (rand() < 0.6) { p.levers = {}; for (const s of SCENARIOS) if (rand() < 0.6) { p.levers[s] = {}; for (const k of LEVER_PARAMS) if (rand() < 0.6) p.levers[s][k] = pick(LEVER_LIMITS[k]); } }
    if (rand() < 0.3) p.scenario_id = scenIds[1 + Math.floor(rand() * (scenIds.length - 1))];
    if (rand() < 0.15) p.catalogue = 'established';
    sets.push(p);
  }
  bad = [];
  let compared = 0;
  const bases = new Map();
  for (const raw of sets) {
    const p = normalizeForecastParams(raw);
    const ps = (await q('select kafaa_sf_normalize($1::jsonb) p', [JSON.stringify(raw)]))[0].p;
    if (!p || !same(ps, p)) { bad.push(`normalize ${JSON.stringify(raw)}`); continue; }
    const key = `${p.scenario_id}|${p.catalogue}`;
    if (!bases.has(key)) bases.set(key, gatherForecastBase(inp, p.scenario_id, p.catalogue));
    const a = (await q('select kafaa_sf_compute(kafaa_sf_base($1, $2), $3::jsonb) r', [p.scenario_id, p.catalogue, JSON.stringify(p)]))[0].r;
    compared++;
    if (!same(a, computeForecast(bases.get(key), p))) bad.push(JSON.stringify(raw));
  }
  ok(bad.length === 0, `forecasts: SQL kafaa_sf_compute = TS computeForecast for ${compared} assumption sets (three scenarios, level mix, bands, totals, generations)${bad.length ? ` (${bad.length} differ, first ${bad[0]})` : ''}`);
  const invalid = [{ attrition_pct: -1 }, { attrition_pct: '4' }, { klra_weight: 2 }, { annual_intake: 10.5 }, { develop_rate: 41 }, { catalogue: 'future' }, { catalogue: 1 }, { scenario_id: 7 },
    { levers: [] }, { levers: { advance: 3 } }, { levers: { baseline: { pace: 2.5 } } }, { levers: { accelerated: { advance: -0.1 } } }, { levers: { advance: { adv_start: 2026 } } }, { levers: { advance: { adv_start: 2030.5 } } }];
  const invSql = [];
  for (const raw of invalid) invSql.push((await q('select kafaa_sf_normalize($1::jsonb) is null x', [JSON.stringify(raw)]))[0].x);
  ok(invalid.every((raw) => normalizeForecastParams(raw) === null) && invSql.every(Boolean), `assumption guard: ${invalid.length} out-of-range or malformed sets refused in SQL and TS alike`);
  const r0 = (await q("select kafaa_sf_for('{}'::jsonb)->'result' r"))[0].r;
  const rChanged = (await q('select kafaa_sf_for($1::jsonb)->\'result\' r', [JSON.stringify({ attrition_pct: 8, levers: { advance: { pace: 2 } } })]))[0].r;
  const rReset = (await q('select kafaa_sf_for($1::jsonb)->\'result\' r', [JSON.stringify(DEFAULTS)]))[0].r;
  ok(same(r0.params, DEFAULTS) && !same(rChanged, r0) && same(rReset, r0) && same(rReset, computeForecast(gatherForecastBase(inp, null, 'all'), DEFAULTS)),
    'acceptance (FS51): resetting assumptions reproduces the baseline exactly (defaults = empty set = reset after a change; TS = SQL)');
  ok(r0.simulated === true && r0.method === 'fs51-v1' && r0.skills.every((k) => k.basis_n >= MIN_GROUP) && r0.skills.length > 0 && r0.suppressed.length > 0,
    `acceptance (FS51): every result is marked SIMULATED with its method; skills with fewer than ${MIN_GROUP} holders are suppressed (${r0.skills.length} shown, ${r0.suppressed.length} suppressed, ${r0.not_modelled.length} not yet modelled)`);
  const supIds = new Set(r0.suppressed);
  const personIds = D.people.map((p) => p.id);
  const txt = JSON.stringify(r0);
  ok(r0.skills.every((k) => !supIds.has(k.skill_id)) && !personIds.some((id) => txt.includes(`"${id}"`)), 'suppression: a suppressed skill carries no numbers and no result names a person');
  ok(SCENARIOS.every((s) => r0.skills.every((k) => k.sc[s].d.length === 10 && k.sc[s].d.every((row) => row.length === 4 && row[0] >= row[1] && row[1] >= row[2] && row[2] >= row[3]))),
    'level mix: every scenario has 2026-2035 demand and supply at levels 1+ to 4 (non-increasing by level)');

  // FS50 rules
  const probes = [cs[0], { ...cs[0], skill_id: 'sk-sa-01' }, { ...cs[0], owner_person_id: 'p-alnoor-gm' }, { ...cs[0], target_level: 5 }, { ...cs[0], targets: [{ year: 2030, pe: 10 }, { year: 2028, pe: 5 }] },
    { ...cs[0], kpis: [{ kind: 'holders_pe', target: 1 }, { kind: 'holders_pe', target: 2 }] }, { ...cs[0], kpis: [{ kind: 'share_l3', target: 120 }] }, { ...cs[0], decision: 'hire' },
    { ...cs[0], rationale_ar: 'English only rationale text here' }, { ...cs[0], gap_plan_ids: ['gp-1'] }, { ...cs[0], status: 'live' }, { ...cs[0], targets: [] }, { ...cs[0], owner_function: 'finance' }];
  const probSql = [];
  for (const p of probes) probSql.push((await q('select kafaa_crs_problem($1::jsonb) c', [JSON.stringify(p)]))[0].c);
  ok(probes.every((p, i) => (criticalProblem(p, ctx) ?? null) === probSql[i]) && probSql[0] === null && probSql.slice(1).every(Boolean),
    `register check: SQL kafaa_crs_problem = TS criticalProblem for ${probes.length} probes (${probSql.slice(1).join(', ')})`);
  const today = (await q('select current_date::text d'))[0].d;
  const boardSql = (await q('select kafaa_crs_board_core(current_date) b'))[0].b;
  const boardTs = criticalBoard(boardInputFromTables((t) => D[t] ?? []), today);
  ok(same(boardSql, boardTs), `board: SQL kafaa_crs_board_core = TS criticalBoard on ${today} (progress, KPIs, review state, attention, tiles)`);
  ok(boardSql.rows.every((r) => (r.progress.suppressed ? r.progress.pe === null && r.progress.pct === null : r.progress.pe != null)) && boardSql.rows.some((r) => r.progress.suppressed)
    && boardSql.rows.every((r) => r.progress.mix.every((m) => m === null || m >= MIN_GROUP)), 'acceptance (FS50): progress is computed from person skills and suppressed under 10 (pe, percentage and every level cell)');

  // ── RLS
  const rd = async (p, t) => Number((await one(p, `select count(*)::int n from kafaa_${t}`)).n);
  const readers = ['chco', 'k-hr-analyst', 'training-mgr', 'k-auditor', 'k-admin'];
  let rlsOk = true;
  for (const t of TABLES) {
    for (const p of readers) if ((await rd(p, t)) !== D[t].length) rlsOk = false;
    for (const p of [null, 'sro', 'buyer', 'alnoor-gm', 'k-observer']) if ((await rd(p, t)) !== 0) rlsOk = false;
  }
  ok(rlsOk, 'RLS: workforce_strategy holders (HR director and analyst, training manager, admin, auditor) read the three tables; anonymous, staff, managers, partners and observers read nothing');
  let direct = false;
  try { await one('chco', "update kafaa_critical_skills set decision = 'buy' where id = 'cs-sk-hu-01'"); direct = Number((await q("select count(*)::int n from kafaa_critical_skills where id = 'cs-sk-hu-01' and decision = 'buy'"))[0].n) === 1; } catch { direct = false; }
  ok(!direct, 'writes only through the RPCs (no direct update of the register)');

  // ── RPC flows (inside a rolled-back transaction; anonymous checks first)
  let anonDenied = 0;
  for (const sql of ['select kafaa_critical_skill_board()', "select kafaa_compute_skill_forecast('{}'::jsonb)", "select kafaa_save_critical_skill('{}'::jsonb)", "select kafaa_release_skill_forecast('x', 'a', 'b')"]) {
    try { await one(null, sql); } catch { anonDenied++; }
  }
  ok(anonDenied === 4, 'grants: anonymous visitors cannot execute the RPCs');
  let helperDenied = 0;
  for (const sql of ["select kafaa_sf_base(null, 'all')", 'select kafaa_crs_board_core(current_date)', "select kafaa_sf_normalize('{}'::jsonb)", "select kafaa_crs_held('sk-hu-01')", "select kafaa_crs_problem('{}'::jsonb)"]) {
    try { await one('chco', sql); } catch { helperDenied++; }
  }
  ok(helperDenied === 5, 'grants: internal helpers are not executable by signed-in users');

  await db.exec('begin');
  try {
    const audits = async (action) => Number((await q('select count(*)::int n from kafaa_audit_events where action = $1', [action]))[0].n);
    const ledgerSeq = async (action) => (await q('select ledger_seq, ledger_status from kafaa_audit_events where action = $1 order by seq desc limit 1', [action]))[0];
    // board
    const bOk = (await one('training-mgr', 'select kafaa_critical_skill_board() r')).r;
    const bAu = (await one('k-auditor', 'select kafaa_critical_skill_board() r')).r;
    const a0 = await audits('critical.board');
    const bNo = (await one('sro', 'select kafaa_critical_skill_board() r')).r;
    ok(bOk.ok && bOk.data.rows.length === D.critical_skills.length && bAu.ok && bNo.code === 'forbidden' && (await audits('critical.board')) === a0 + 1,
      'criticalSkillBoard: the training manager (Agg) and auditors (R) read the board; a manager is refused and the refusal is audited');
    // save critical skill
    const base = { skill_id: 'sk-fs-ai-anomaly', owner_function: 'engineering', owner_person_id: 'p-sme-reviewer', target_level: 2, targets: [{ year: 2026, pe: 500 }, { year: 2030, pe: 900 }],
      kpis: [{ kind: 'holders_pe', target: 500 }], decision: 'build', rationale_en: 'Anomaly detection helps engineers find early drift in plant data.', rationale_ar: 'يساعد كشف الحالات الشاذة المهندسين على رصد الانحراف المبكر في بيانات المحطة.', gap_plan_ids: [], status: 'draft' };
    const sv = async (p, x) => (await one(p, 'select kafaa_save_critical_skill($1::jsonb) r', [JSON.stringify(x)])).r;
    const s1 = await sv('k-hr-analyst', base);
    const s1dup = await sv('k-hr-analyst', base);
    const s1act = await sv('k-hr-analyst', { ...base, id: 'cs-sk-fs-ai-anomaly', status: 'active' });
    const s1bad = await sv('k-hr-analyst', { ...base, skill_id: 'sk-fs-ai-dataeng', rationale_ar: 'English only text, which is not Arabic' });
    const s1no = await sv('training-mgr', { ...base, skill_id: 'sk-fs-ai-dataeng' });
    ok(s1.ok && s1.data.version === 1 && s1.data.status === 'draft' && s1dup.code === 'conflict' && s1act.code === 'forbidden' && s1bad.code === 'invalid' && /Arabic/.test(s1bad.message) && s1no.code === 'forbidden',
      'saveCriticalSkill: the HR analyst drafts a row (one per skill); adopting needs the HR director; an English-only rationale and the training manager (Agg) are refused');
    const ad = await sv('chco', { ...base, id: 'cs-sk-fs-ai-anomaly', status: 'active' });
    const adL = await ledgerSeq('critical.save');
    const edit = await sv('k-hr-analyst', { ...base, id: 'cs-sk-fs-ai-anomaly', status: 'draft' });
    const row = (await q("select status, version, adopted_on from kafaa_critical_skills where id = 'cs-sk-fs-ai-anomaly'"))[0];
    ok(ad.ok && ad.data.version === 2 && adL.ledger_status === 'written' && adL.ledger_seq != null && edit.code === 'forbidden' && row.status === 'active' && row.adopted_on != null,
      'saveCriticalSkill: the HR director adopts the row (version 2, adoption date, ledger row written); the analyst can no longer edit an adopted row');
    const ch = await sv('chco', { ...base, id: 'cs-sk-fs-ai-anomaly', status: 'active', decision: 'buy', rationale_en: 'Hire two data scientists while the drills build the base.', rationale_ar: 'تعيين عالمَي بيانات بينما تبني التمارين القاعدة الداخلية.' });
    const hist = (await q("select decision_history from kafaa_critical_skills where id = 'cs-sk-fs-ai-anomaly'"))[0].decision_history;
    ok(ch.ok && hist.length === 1 && hist[0].decision === 'build', 'saveCriticalSkill: a decision change keeps the previous decision and rationale in the history');
    // review
    const rvw = async (p, x) => (await one(p, 'select kafaa_review_critical_skill($1::jsonb) r', [JSON.stringify(x)])).r;
    const auBefore = await audits('critical.review');
    const r1 = await rvw('k-hr-analyst', { critical_skill_id: 'cs-sk-hu-01', rating: 'on_track', note_en: 'Holding steady this quarter.', note_ar: 'مستقر خلال هذا الربع.' });
    const r2 = await rvw('chco', { critical_skill_id: 'cs-sk-da-02', rating: 'on_track', note_en: 'Holding steady this quarter.', note_ar: 'مستقر خلال هذا الربع.' });
    const r3 = await rvw('chco', { critical_skill_id: 'cs-sk-hu-01', rating: 'on_track', note_en: 'Holding steady this quarter.', note_ar: 'مستقر خلال هذا الربع.' });
    const r3L = await ledgerSeq('critical.review');
    const r4 = await rvw('chco', { critical_skill_id: 'cs-sk-hu-01', rating: 'met', note_en: 'Second try in the quarter.', note_ar: 'محاولة ثانية في الربع.' });
    const expProg = boardTs.rows.find((x) => x.id === 'cs-sk-hu-01').progress;
    ok(r1.code === 'forbidden' && r2.code === 'not_active' && r3.ok && same(r3.data.progress, expProg) && r3L.ledger_status === 'written' && r3L.ledger_seq != null && r4.code === 'already_reviewed'
      && (await audits('critical.review')) === auBefore + 4, 'acceptance (FS50): each quarterly review writes an audit row and a ledger row (HR director only; adopted rows only; once per quarter; the computed progress snapshot is stored)');
    const r5 = await rvw('chco', { critical_skill_id: 'cs-sk-co-01', rating: 'at_risk', note_en: 'Moving to a partner route.', note_ar: 'الانتقال إلى مسار الشريك.', decision: 'borrow' });
    const r6 = await rvw('chco', { critical_skill_id: 'cs-sk-co-01', rating: 'at_risk', note_en: 'Moving to a partner route.', note_ar: 'الانتقال إلى مسار الشريك.', decision: 'borrow', rationale_en: 'A partner operator exchange covers the gap faster.', rationale_ar: 'يغطي تبادل المشغلين مع شريك الفجوة بشكل أسرع.' });
    const co = (await q("select decision, decision_history from kafaa_critical_skills where id = 'cs-sk-co-01'"))[0];
    ok(r5.code === 'invalid' && r6.ok && co.decision === 'borrow' && co.decision_history.at(-1).decision === 'build', 'reviewCriticalSkill: a decision change needs a new rationale in EN and AR and is kept in the history');
    // forecasts
    const fc = async (p, x) => (await one(p, 'select kafaa_compute_skill_forecast($1::jsonb) r', [JSON.stringify(x)])).r;
    const f1 = await fc('training-mgr', {});
    const f2 = await fc('sro', {});
    const f3 = await fc('chco', { attrition_pct: 99 });
    const f4 = await fc('chco', { scenario_id: 'scn-nope' });
    ok(f1.ok && same(f1.data, r0) && f2.code === 'forbidden' && f3.code === 'invalid' && f4.code === 'not_found', 'computeSkillForecast: workforce_strategy holders compute (Agg); managers refused; bad assumptions and unknown scenarios refused');
    const cyc = Number(today.slice(0, 4));
    const nextV = D.skill_forecasts.filter((f) => Number(f.cycle) === cyc).reduce((m, f) => Math.max(m, Number(f.version)), 0) + 1;
    const sv1 = (await one('k-hr-analyst', 'select kafaa_save_skill_forecast($1::jsonb) r', [JSON.stringify({ name: 'Analyst check', scenario: 'advance', params: { develop_rate: 20 } })])).r;
    const sv2 = (await one('training-mgr', 'select kafaa_save_skill_forecast($1::jsonb) r', [JSON.stringify({ name: 'Trainer check', scenario: 'advance', params: {} })])).r;
    const sv3 = (await one('k-hr-analyst', 'select kafaa_save_skill_forecast($1::jsonb) r', [JSON.stringify({ name: 'Bad scenario', scenario: 'growth', params: {} })])).r;
    const sv4 = (await one('chco', 'select kafaa_save_skill_forecast($1::jsonb) r', [JSON.stringify({ id: sv1.data?.id, name: 'Not mine', scenario: 'baseline', params: {} })])).r;
    ok(sv1.ok && sv1.data.id === `sf-${cyc}-v${nextV}` && sv1.data.name === 'Analyst check (SIMULATED)' && sv2.code === 'forbidden' && sv3.code === 'invalid' && sv4.code === 'not_found',
      'saveSkillForecast: an HR analyst saves the next version of the annual cycle, marked SIMULATED; the training manager, bad scenarios and other people\'s drafts are refused');
    const rl = async (p, id, en, ar) => (await one(p, 'select kafaa_release_skill_forecast($1, $2, $3) r', [id, en, ar])).r;
    const prevRel = D.skill_forecasts.find((f) => Number(f.cycle) === cyc && f.status === 'released');
    const e1 = await rl('k-hr-analyst', sv1.data.id, 'A clean summary of the refresh.', 'ملخص واضح للتحديث.');
    const e2 = await rl('chco', sv1.data.id, 'We need 120 operators by 2032.', 'ملخص واضح للتحديث.');
    const e3 = await rl('chco', sv1.data.id, 'Development push plan against ADVANCE.', 'خطة دفع التطوير وفق برنامج ADVANCE.');
    const e3L = await ledgerSeq('forecast.release');
    const e4 = await rl('chco', sv1.data.id, 'Development push plan against ADVANCE.', 'خطة دفع التطوير وفق برنامج ADVANCE.');
    const st = Object.fromEntries((await q('select id, status, superseded_by from kafaa_skill_forecasts where cycle = $1', [cyc])).map((x) => [x.id, x]));
    ok(e1.code === 'forbidden' && e2.code === 'not_clean' && e3.ok && e3L.ledger_status === 'written' && e4.code === 'already_released' && st[sv1.data.id].status === 'released'
      && (!prevRel || (st[prevRel.id].status === 'superseded' && st[prevRel.id].superseded_by === sv1.data.id && e3.data.superseded === prevRel.id)),
      'releaseSkillForecast: HR director only; release text with headcounts refused; the earlier release of the cycle is superseded (annual refresh with saved versions); ledger row');
    const e5 = await rl('chco', prevRel?.id ?? 'x', 'Try again with the old one.', 'محاولة مع النسخة القديمة.');
    ok(e5.code === 'superseded', 'releaseSkillForecast: a superseded version cannot be released again');
  } finally {
    await db.exec('rollback');
  }

  // ── additivity, function bodies and table digests (for the live comparison)
  const text = readFileSync(MIG, 'utf8');
  ok(!/\b(drop|delete|truncate)\b/i.test(text) && !/\balter\s+table\s+(?!kafaa_)/i.test(text), 'additive: the FS61 migration never names a destructive statement and alters only kafaa_* tables');
  const md5s = await q(`select p.proname, md5(p.prosrc) m from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any($1) order by 1`, [FUNCS]);
  ok(md5s.length === FUNCS.length, `functions: ${md5s.length} new function bodies present`);
  console.log(`    md5 ${md5s.map((r) => `${r.proname}=${r.m.slice(0, 8)}`).join(' ')}`);
  for (const t of TABLES) {
    const d = (await q(`select count(*)::int n, left(md5(string_agg(to_jsonb(x)::text, '|' order by x.id)), 8) dg from kafaa_${t} x`))[0];
    console.log(`    digest kafaa_${t} ${d.n} ${d.dg}`);
  }
}
