// [FS wave G · E1 · FS60 + FS61] PGlite checks for 20261010271001_kafaa_fs71_disclosure_pilots.sql (M35 Workforce Strategy and Disclosure).
// Seed (7 library metrics with definition, formula, source and owner; 2026-Q2 published with every line approved by a second person,
// 2026-Q3 in review; 11 pilots, 8 closed incl. 2 failures); SQL = TS parity on the database state: kafaa_hcd_compute = computeDisclosure
// for every quarter 2025-Q1..2026-Q4 and for generated edge cases (groups of exactly 9 and 10 people, a headcount under 10, new training
// records, durations), kafaa_hcd_minutes = minutesOf, kafaa_hcd_bounds = periodBounds, kafaa_hcd_line_problem = lineProblem,
// kafaa_spl_problem = pilotProblem, kafaa_spl_signoff_problem = signoffProblem, kafaa_spl_adoption = adoptionRate, kafaa_spl_reference =
// referenceOf (the FSC 78 % from kafaa_benchmarks); suppression (no people count under 10, no person id); RLS; the seven RPCs with RBAC,
// maker-checker, stale values, audit and ledger rows (flows inside a rolled-back transaction); the check constraints (no close without the
// evaluator's sign-off, closed = published); grants; additivity. Prints the md5 of every new function body and every new table's digest.
import { readFileSync } from 'node:fs';
import {
  METRIC_SPEC, MIN_GROUP, buildPack, computeDisclosure, hcInputFromTables, lineProblem, materialityOk, minutesOf, periodBounds,
} from '../../src/modules/m35/disclosure.ts';
import { disclosureFromTables, staffRungs } from '../../src/modules/m35/disclosureData.ts';
import { adoptionRate, pilotProblem, referenceOf, signoffProblem } from '../../src/modules/m35/pilots.ts';
import { boardInputFromTables, criticalBoard } from '../../src/modules/m35/critical.ts';

const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${k}:${canon(v[k])}`).join(',')}}` : typeof v === 'number' ? String(Number(v)) : typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) ? String(Number(v)) : JSON.stringify(v ?? null));
const same = (a, b) => canon(a) === canon(b);
const MIG = 'supabase/migrations/20261010271001_kafaa_fs71_disclosure_pilots.sql';
const TABLES = ['hc_metrics', 'hc_disclosures', 'skill_pilots'];
const FUNCS = ['kafaa_hcd_bounds', 'kafaa_hcd_computable', 'kafaa_hcd_closed', 'kafaa_hcd_minutes', 'kafaa_hcd_len', 'kafaa_hcd_bi', 'kafaa_hcd_line_problem', 'kafaa_hcd_materiality_ok',
  'kafaa_hcd_compute', 'kafaa_compute_disclosure', 'kafaa_save_disclosure', 'kafaa_approve_disclosure', 'kafaa_spl_num', 'kafaa_spl_date_ok', 'kafaa_spl_group_ok', 'kafaa_spl_problem',
  'kafaa_spl_signoff_problem', 'kafaa_spl_close_problem', 'kafaa_spl_adoption', 'kafaa_spl_reference', 'kafaa_pilot_stats', 'kafaa_save_pilot', 'kafaa_signoff_pilot', 'kafaa_close_pilot'];
const INPUT_TABLES = ['people', 'skills', 'person_skills', 'ai_rungs', 'ai_skill_tracks', 'training_records', 'xapi_statements', 'credit_ledger', 'critical_skills', 'critical_skill_reviews',
  'skill_gap_plans', 'skill_forecasts', 'workforce_snapshots', 'hc_metrics', 'hc_disclosures', 'skill_pilots', 'benchmarks'];
const PERIODS = ['2025-Q1', '2025-Q2', '2025-Q3', '2025-Q4', '2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4'];

export default async function fs71Checks({ db, one, ok, uid }) {
  const S = JSON.parse(readFileSync('src/seed/seed.json', 'utf8'));
  const T = S.tables;
  console.log('FS wave G · E1 · FS60 ISO 30414 skills disclosure pack + FS61 skills pilots registry (M35)');
  await db.exec('reset role');
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  const fix = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v instanceof Date ? (/(_at|^ts)$/.test(k) ? v.toISOString() : v.toISOString().slice(0, 10)) : v]));
  const dbRows = async () => { const D = {}; for (const t of INPUT_TABLES) D[t] = (await q(`select * from kafaa_${t} order by id`)).map(fix); return D; };
  let k = 0;
  for (const [persona, roles] of [['buyer', ['Buyer']], ['head-sq', ['Head of Supplier Quality']], ['independent-approver', ['Independent approver']], ['compliance', ['Compliance & Ethics Officer']]]) {
    if (uid[persona]) continue;
    const row = (await q('select user_id from profiles where persona_id = $1', [persona]))[0];
    if (row) { uid[persona] = row.user_id; continue; }
    uid[persona] = `00000000-0000-4000-8000-0000000071${String(++k).padStart(2, '0')}`;
    await q('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, 'enec-ops', 'employee', roles]);
  }

  // ── seed sanity and acceptance on the seed
  const hm = T.hc_metrics, hd = T.hc_disclosures, sp = T.skill_pilots;
  const ids = [...hm].sort((a, b) => a.sort - b.sort).map((m) => m.id);
  ok(hm.length === 7 && hm.every((m) => m.definition_en && /[؀-ۿ]/.test(m.definition_ar) && m.formula_en && /[؀-ۿ]/.test(m.formula_ar) && m.source_en && m.owner_person_id && m.owner_en
    && m.iso_area === 'skills_capabilities_development' && METRIC_SPEC[m.key]?.unit === m.unit && METRIC_SPEC[m.key]?.basis === m.basis && m.simulated),
  'seed: 7 library metrics mapped to the ISO 30414 Skills, Capabilities and Development area, each with a definition, formula, source and owner (EN/AR), unit and basis = the rule');
  const q2 = hd.find((d) => d.period === '2026-Q2'), q3 = hd.find((d) => d.period === '2026-Q3');
  ok(hd.length === 2 && q2.status === 'published' && ids.every((m) => q2.approvals[m]) && q3.status === 'draft' && Object.keys(q3.approvals).length === 2 && !q3.narratives['hcm-participation']
    && materialityOk(q2.materiality_en, q2.materiality_ar), 'seed: 2026-Q2 published (every line approved), 2026-Q3 in review (2 approved, the participation line has no narrative yet); materiality statements');
  ok(hd.every((d) => Object.entries(d.approvals).every(([m, a]) => d.narratives[m] && lineProblem({ metric_id: m, ...d.narratives[m] }, ids) === null && d.narratives[m].by !== a.by)),
    'acceptance (FS60): every seeded approval sits on a complete EN/AR narrative and variance explanation written by someone else (second approver)');
  const rungSeed = staffRungs((t) => T[t] ?? []);
  ok(same(q2.metric_values, disclosureFromTables((t) => (t === 'hc_disclosures' ? [] : T[t] ?? []), '2026-Q2', rungSeed))
    && same(q3.metric_values, disclosureFromTables((t) => (t === 'hc_disclosures' ? [q2] : T[t] ?? []), '2026-Q3', rungSeed)),
  'seed: every stored disclosure value equals computeDisclosure on the seed (computed, never typed)');
  const st = adoptionRate(sp);
  ok(sp.length === 11 && st.closed === 8 && st.failed === 2 && st.rate === 75 && sp.filter((p) => p.status === 'closed').every((p) => p.published && p.signoff_by === p.evaluator_person_id)
    && sp.every((p) => p.evaluator_person_id !== p.owner_person_id), 'seed: 11 pilots, 8 closed (2 failures, published), adoption 6 of 8 = 75 %; every closed pilot signed off by its named evaluator, never its owner');

  // ── parity on the database state
  const D = await dbRows();
  const tsFor = (rows, period) => {
    const raw = (t) => rows[t] ?? [];
    return computeDisclosure(hcInputFromTables(raw, staffRungs(raw)), period, criticalBoard(boardInputFromTables(raw), periodBounds(period).end).rows.map((r) => ({ id: r.id, progress: r.progress })));
  };
  let bad = [];
  for (const p of PERIODS) {
    const a = (await q('select kafaa_hcd_compute($1) r', [p]))[0].r;
    if (!same(a, tsFor(D, p))) bad.push(p);
  }
  ok(bad.length === 0, `acceptance (FS60): every value reproduces from its formula: SQL kafaa_hcd_compute = TS computeDisclosure for ${PERIODS.length} quarters${bad.length ? ` (differ: ${bad.join(', ')})` : ''}`);
  const r3 = tsFor(D, '2026-Q3');
  const pids = D.people.map((x) => x.id);
  const txt3 = JSON.stringify(r3);
  const cells = r3.metrics.flatMap((m) => m.cells);
  ok(r3.metrics.every((m) => m.count_kind !== 'people' || m.num === null || m.num >= MIN_GROUP) && cells.every((c) => (c.n === null || c.n >= MIN_GROUP) && (c.trained === null || c.trained >= MIN_GROUP)
    && (c.not_trained === null || c.not_trained >= MIN_GROUP) && (c.n !== null || c.pct === null)) && cells.some((c) => c.n === null) && !pids.some((id) => txt3.includes(`"${id}"`)),
  'acceptance (FS60): all cells under 10 are suppressed (people counts, group sizes and their shares); no result names a person');
  ok(cells.every((c) => ['site', 'shift', 'grade'].includes(c.dim)) && !/nationality|gender|uae|"f"|"m"/.test(JSON.stringify(cells.map((c) => [c.dim, c.key]))),
    'participation equity reads site, shift crew and grade only (never nationality or gender)');
  ok((await q("select kafaa_hcd_compute('2026-Q5') is null a, kafaa_hcd_compute('x') is null b"))[0].a === true, 'malformed periods: kafaa_hcd_compute returns null (the RPC refuses)');
  const durs = ['PT60M', 'PT1H', 'PT1.5H', 'P1D', 'P2DT3H', 'PT90S', 'PT29S', 'PT30S', 'P', 'PT', '60', 'P1W', 'PT0.5M', 'P0.25D'];
  const dSql = [];
  for (const d of durs) dSql.push((await q('select kafaa_hcd_minutes(to_jsonb($1::text)) m', [d]))[0].m);
  const nSql = (await q("select kafaa_hcd_minutes('12'::jsonb) a, kafaa_hcd_minutes(null) b"))[0];
  ok(durs.every((d, i) => minutesOf(d) === dSql[i]) && nSql.a === 0 && nSql.b === 0, `durations: kafaa_hcd_minutes = minutesOf for ${durs.length + 2} inputs`);
  const pers = ['2026-Q1', '2025-Q4', '2024-Q2', '2026-Q5', '2026Q1', '1999-Q1', ''];
  let bOk = true;
  for (const p of pers) { const a = (await q('select kafaa_hcd_bounds($1) b', [p]))[0].b; if (!same(a, periodBounds(p))) bOk = false; }
  ok(bOk, 'periods: kafaa_hcd_bounds = periodBounds (quarter bounds and 1 January; malformed refused)');
  const L = { metric_id: 'hcm-hours', narrative_en: 'Hours rose with the outage season and simulator time.', narrative_ar: 'ارتفعت الساعات مع موسم الإيقاف ووقت المحاكي.', variance_en: 'Up against last quarter.', variance_ar: 'ارتفاع مقارنة بالربع السابق.' };
  const lps = [L, { ...L, metric_id: 'hcm-x' }, { ...L, narrative_ar: 'English only narrative text goes here' }, { ...L, narrative_en: 'short' }, { ...L, variance_en: 'tiny' }, { ...L, variance_ar: 123 }, null, { ...L, narrative_en: `  ${'x'.repeat(19)}  ` }];
  const lpSql = [];
  for (const x of lps) lpSql.push((await q('select kafaa_hcd_line_problem($1::jsonb, $2::text[]) c', [JSON.stringify(x), ids]))[0].c);
  ok(lps.every((x, i) => (lineProblem(x, ids) ?? null) === lpSql[i]) && lpSql[0] === null && lpSql.slice(1).every(Boolean), `narrative check: kafaa_hcd_line_problem = lineProblem for ${lps.length} probes (${lpSql.slice(1).join(', ')})`);
  const mats = [[q2.materiality_en, q2.materiality_ar], ['short', 'قصير'], [q2.materiality_en, q2.materiality_en], ['', '']];
  let mOk = true;
  for (const [en, ar] of mats) if ((await q('select kafaa_hcd_materiality_ok($1, $2) m', [en, ar]))[0].m !== materialityOk(en, ar)) mOk = false;
  ok(mOk, 'materiality: kafaa_hcd_materiality_ok = materialityOk');

  // FS61 rules
  const staff = D.people.filter((x) => x.kind === 'staff' && x.status === 'active').map((x) => x.id);
  const pctx = { staff, skills: D.skills.map((s) => s.id), creator: 'p-k-hr-analyst' };
  const base = { id: 'sp-check-pilot', title_en: 'A check pilot', title_ar: 'تجربة للفحص', hypothesis_en: 'Doing the check this way makes the result better.', hypothesis_ar: 'إجراء الفحص بهذه الطريقة يحسّن النتيجة كثيراً.',
    comparison_en: 'Teams on the old way.', comparison_ar: 'فرق تعمل بالطريقة القديمة.', pilot_n: 12, comparison_n: null, owner_person_id: 'p-training-mgr', evaluator_person_id: 'p-compliance',
    metrics: [{ key: 'first_pass', label_en: 'First pass', label_ar: 'النجاح الأول', unit: 'pct', baseline: 80, target: 90 }], skill_ids: ['sk-co-01'], start_on: '2026-01-01', end_on: '2026-06-30', status: 'draft' };
  const probes = [[base, true], [{ ...base, id: 'SP-bad' }, true], [{ ...base, id: 'SP-bad' }, false], [{ ...base, title_ar: 'English title' }, false], [{ ...base, hypothesis_en: 'too short' }, false],
    [{ ...base, comparison_ar: '' }, false], [{ ...base, evaluator_person_id: 'p-alnoor-gm' }, false], [{ ...base, evaluator_person_id: 'p-training-mgr' }, false], [{ ...base, evaluator_person_id: 'p-k-hr-analyst' }, false],
    [{ ...base, metrics: [] }, false], [{ ...base, metrics: [base.metrics[0], base.metrics[0]] }, false], [{ ...base, metrics: [{ ...base.metrics[0], unit: 'kg' }] }, false],
    [{ ...base, metrics: [{ ...base.metrics[0], target: '90' }] }, false], [{ ...base, skill_ids: ['sk-nope'] }, false], [{ ...base, skill_ids: ['sk-co-01', 'sk-co-01'] }, false],
    [{ ...base, start_on: '2026-07-01' }, false], [{ ...base, end_on: '2026-02-30' }, false], [{ ...base, end_on: '2031-01-01' }, false], [{ ...base, pilot_n: 2.5 }, false], [{ ...base, comparison_n: -1 }, false],
    [{ ...base, status: 'closed' }, false], [null, false]];
  const ppSql = [];
  for (const [x, isNew] of probes) ppSql.push((await q('select kafaa_spl_problem($1::jsonb, $2, $3) c', [JSON.stringify(x), 'p-k-hr-analyst', isNew]))[0].c);
  ok(probes.every(([x, isNew], i) => (pilotProblem(x, pctx, isNew) ?? null) === ppSql[i]) && ppSql[0] === null && ppSql[2] === null && ppSql.filter((c, i) => i !== 0 && i !== 2).every(Boolean),
    `pilot check: kafaa_spl_problem = pilotProblem for ${probes.length} probes (${ppSql.filter(Boolean).join(', ')})`);
  const so = { result: 'success', recommendation: 'adopted', result_en: 'The first-pass rate rose clearly above the comparison.', result_ar: 'ارتفع معدل النجاح الأول بوضوح فوق المقارنة.',
    lessons_en: 'Keep it simple.', lessons_ar: 'الإبقاء على البساطة.', metric_results: [{ key: 'first_pass', pilot: 91, comparison: 84 }] };
  const sps = [so, { ...so, result: 'great' }, { ...so, result: 'failed' }, { ...so, result: 'failed', recommendation: 'further_funded' }, { ...so, recommendation: 'keep' }, { ...so, result_ar: 'English' },
    { ...so, lessons_en: 'x' }, { ...so, metric_results: [] }, { ...so, metric_results: [{ key: 'other', pilot: 1 }] }, { ...so, metric_results: [{ key: 'first_pass', pilot: '91' }] },
    { ...so, metric_results: [{ key: 'first_pass', pilot: 91, comparison: null }] }, null];
  const spSql = [];
  for (const x of sps) spSql.push((await q('select kafaa_spl_signoff_problem($1::jsonb, $2::text[]) c', [JSON.stringify(x), ['first_pass']]))[0].c);
  ok(sps.every((x, i) => (signoffProblem(x, ['first_pass']) ?? null) === spSql[i]) && spSql[0] === null && spSql[3] === null && spSql[10] === null,
    `sign-off check: kafaa_spl_signoff_problem = signoffProblem for ${sps.length} probes (${spSql.filter(Boolean).join(', ')})`);
  const adSql = (await q('select kafaa_spl_adoption() a, kafaa_spl_reference() r'))[0];
  const refTs = referenceOf(D.benchmarks);
  ok(same(adSql.a, adoptionRate(D.skill_pilots)) && same(adSql.r, refTs) && refTs?.value === 78 && /^https:\/\/fsc-ccf\.ca\//.test(refTs.url),
    `acceptance (FS61): the adoption rate is computed from pilot statuses (SQL = TS: ${adSql.a.rate} %) and the reference (${refTs?.value} %) is read from kafaa_benchmarks with its https source`);

  // ── RLS
  const rd = async (p, t, where = 'true') => Number((await one(p, `select count(*)::int n from kafaa_${t} where ${where}`)).n);
  let rls = true;
  for (const t of ['hc_metrics', 'hc_disclosures']) {
    for (const p of ['chco', 'k-hr-analyst', 'k-auditor', 'k-admin']) if ((await rd(p, t)) !== D[t].length) rls = false;
    for (const p of [null, 'training-mgr', 'sro', 'buyer', 'alnoor-gm', 'k-observer']) if ((await rd(p, t)) !== 0) rls = false;
  }
  ok(rls, 'RLS (FS60): the disclosure pack is read by the HR director, HR analysts, admins and auditors (workforce_strategy R/W/A); never public, staff, partners, observers or the training manager (Agg only)');
  const pub = D.skill_pilots.filter((x) => x.published).length;
  const hsq = D.skill_pilots.filter((x) => x.published || x.evaluator_person_id === 'p-head-sq').length;
  const pr = { all: [], staff: [], none: [] };
  for (const p of ['chco', 'k-hr-analyst', 'training-mgr', 'k-auditor', 'k-admin']) pr.all.push(await rd(p, 'skill_pilots'));
  for (const p of ['sro', 'buyer']) pr.staff.push(await rd(p, 'skill_pilots'));
  for (const p of [null, 'alnoor-gm', 'k-observer']) pr.none.push(await rd(p, 'skill_pilots'));
  const hsqN = await rd('head-sq', 'skill_pilots');
  ok(pr.all.every((n) => n === D.skill_pilots.length) && pr.staff.every((n) => n === pub) && pr.none.every((n) => n === 0) && hsqN === hsq && hsq > pub,
    `RLS (FS61): HR, the training manager, admins and auditors read the whole registry (${D.skill_pilots.length}); staff read the ${pub} published results (failures included); the evaluator also reads the pilots they evaluate; partners and anonymous visitors read nothing`);
  let direct = false;
  try { await one('chco', "update kafaa_skill_pilots set status = 'closed' where id = 'sp-adaptive-requal'"); direct = Number((await q("select count(*)::int n from kafaa_skill_pilots where id = 'sp-adaptive-requal' and status = 'closed'"))[0].n) === 1; } catch { direct = false; }
  let direct2 = false;
  try { await one('chco', "update kafaa_hc_disclosures set status = 'published' where id = 'hcd-2026-Q3'"); direct2 = Number((await q("select count(*)::int n from kafaa_hc_disclosures where id = 'hcd-2026-Q3' and status = 'published'"))[0].n) === 1; } catch { direct2 = false; }
  ok(!direct && !direct2, 'writes only through the RPCs (no direct update of a disclosure or a pilot)');
  let ck = 0;
  await db.exec('begin');
  for (const sql of ["update kafaa_skill_pilots set status = 'closed', adoption = 'adopted', published = true where id = 'sp-adaptive-requal'",
    "update kafaa_skill_pilots set published = false where id = 'sp-peer-coaching'", "update kafaa_skill_pilots set evaluator_person_id = owner_person_id where id = 'sp-rotation-buddies'"]) {
    await db.exec('savepoint c'); try { await db.exec(sql); } catch { ck++; } await db.exec('rollback to savepoint c');
  }
  await db.exec('rollback');
  ok(ck === 3, 'check constraints: a pilot cannot close without the named evaluator\'s sign-off, a closed pilot stays published (failed pilots stay visible), the evaluator is never the owner');

  // ── grants
  let anonDenied = 0;
  for (const sql of ["select kafaa_compute_disclosure('2026-Q3')", "select kafaa_save_disclosure('{}'::jsonb)", "select kafaa_approve_disclosure('x', '[]'::jsonb)", 'select kafaa_pilot_stats()',
    "select kafaa_save_pilot('{}'::jsonb)", "select kafaa_signoff_pilot('x', '{}'::jsonb)", "select kafaa_close_pilot('x', 'adopted')"]) {
    try { await one(null, sql); } catch { anonDenied++; }
  }
  ok(anonDenied === 7, 'grants: anonymous visitors cannot execute the seven RPCs');
  let helperDenied = 0;
  for (const sql of ["select kafaa_hcd_compute('2026-Q3')", "select kafaa_hcd_minutes('\"PT1H\"'::jsonb)", 'select kafaa_spl_adoption()', 'select kafaa_spl_reference()', "select kafaa_spl_problem('{}'::jsonb, 'x', true)"]) {
    try { await one('chco', sql); } catch { helperDenied++; }
  }
  ok(helperDenied === 5, 'grants: internal helpers are not executable by signed-in users');

  // ── RPC flows (inside a rolled-back transaction)
  await db.exec('begin');
  try {
    const audits = async (action) => Number((await q('select count(*)::int n from kafaa_audit_events where action = $1', [action]))[0].n);
    const lastAudit = async (action) => (await q('select ledger_seq, ledger_status, outcome from kafaa_audit_events where action = $1 order by seq desc limit 1', [action]))[0];
    const today = (await q('select current_date::text d'))[0].d;
    // compute
    const cmp = async (p, period) => (await one(p, 'select kafaa_compute_disclosure($1) r', [period])).r;
    const c1 = await cmp('chco', '2026-Q3'), c2 = await cmp('k-auditor', '2026-Q2');
    const a0 = await audits('disclosure.compute');
    const c3 = await cmp('training-mgr', '2026-Q3'), c4 = await cmp('chco', '2024-Q4'), c5 = await cmp('chco', '2099-Q1');
    ok(c1.ok && same(c1.data, r3) && c2.ok && c3.code === 'forbidden' && c4.code === 'invalid' && c5.code === 'invalid' && (await audits('disclosure.compute')) === a0 + 3,
      'computeDisclosure: the HR director and auditors compute (TS = SQL); the training manager (Agg only) and periods outside 2025-Q1..now are refused and audited');
    // stale values: new learning after the save blocks the approval until the analyst saves again
    await db.exec('savepoint stale');
    const pick = D.people.find((x) => x.kind === 'staff' && x.status === 'active' && !D.training_records.some((t) => t.person_id === x.id) && !D.xapi_statements.some((s) => s.actor_person_id === x.id && s.occurred_at.slice(0, 10) >= '2026-07-01' && s.occurred_at.slice(0, 10) <= '2026-09-30'));
    await q("insert into kafaa_training_records (id, person_id, course_id, completed_on, hours, result) values ('tr-fs71-stale', $1, 'c-get', '2026-08-15', 3, 'passed')", [pick.id]);
    const stale = (await one('chco', 'select kafaa_approve_disclosure($1, $2::jsonb) r', ['hcd-2026-Q3', JSON.stringify(['hcm-active-learners'])])).r;
    const fresh = (await one('chco', "select kafaa_compute_disclosure('2026-Q3') r")).r;
    const tsFresh = tsFor({ ...D, training_records: [...D.training_records, { id: 'tr-fs71-stale', person_id: pick.id, course_id: 'c-get', completed_on: '2026-08-15', hours: 3, result: 'passed' }] }, '2026-Q3');
    await db.exec('rollback to savepoint stale');
    ok(stale.code === 'stale' && same(fresh.data, tsFresh) && !same(fresh.data, r3), 'approveDisclosure: values that no longer reproduce from the formula are refused as stale (the recompute with a new training record still equals TS)');
    // save
    const sv = async (p, x) => (await one(p, 'select kafaa_save_disclosure($1::jsonb) r', [JSON.stringify(x)])).r;
    const PL = { metric_id: 'hcm-participation', narrative_en: 'Corporate functions and senior grades trail the plant in learning this year.', narrative_ar: 'تتأخر الوظائف المؤسسية والدرجات العليا عن المحطة في التعلّم هذا العام.',
      variance_en: 'No change against the previous published quarter.', variance_ar: 'لا تغيير مقارنة بالربع المنشور السابق.' };
    const s0 = await sv('training-mgr', { period: '2026-Q3', lines: [PL] });
    const s1 = await sv('k-hr-analyst', { period: '2026-Q4', lines: [] });
    const s2 = await sv('k-hr-analyst', { period: '2026-Q2', lines: [] });
    const s3 = await sv('k-hr-analyst', { period: '2026-Q3', lines: [{ ...q3.narratives['hcm-trained'], metric_id: 'hcm-trained', narrative_en: `${q3.narratives['hcm-trained'].narrative_en} Edited.` }] });
    const s4 = await sv('k-hr-analyst', { period: '2026-Q3', lines: [{ ...PL, narrative_ar: 'Only English here, no Arabic text' }] });
    const s5 = await sv('k-hr-analyst', { period: '2026-Q3', materiality_en: 'Too short', materiality_ar: 'قصير' });
    ok(s0.code === 'forbidden' && s1.code === 'period_open' && s2.code === 'published' && s3.code === 'locked' && s4.code === 'invalid' && /Arabic/.test(s4.message) && s5.code === 'invalid',
      'saveDisclosure: HR analysts and the HR director only; an open quarter, a published disclosure and an approved line cannot change; an English-only narrative and a short materiality statement are refused');
    // approve: no narrative, maker-checker, then publish
    const ap = async (p, id, mids) => (await one(p, 'select kafaa_approve_disclosure($1, $2::jsonb) r', [id, JSON.stringify(mids)])).r;
    const p0 = await ap('k-hr-analyst', 'hcd-2026-Q3', ['hcm-active-learners']);
    const p1 = await ap('chco', 'hcd-2026-Q3', ['hcm-participation']);
    const p2 = await ap('chco', 'hcd-2026-Q3', ['hcm-critical']);
    const p3 = await ap('chco', 'hcd-2026-Q3', ['hcm-trained']);
    const p4 = await ap('chco', 'hcd-2026-Q3', []);
    ok(p0.code === 'forbidden' && p1.code === 'no_narrative' && p2.code === 'maker_checker' && p3.code === 'already_approved' && p4.code === 'invalid',
      'acceptance (FS60): no metric publishes without a narrative (no_narrative) and a second approver (the HR director cannot approve the line he wrote: maker_checker); only the HR director approves');
    const s6 = await sv('k-hr-analyst', { period: '2026-Q3', lines: [PL, { ...q3.narratives['hcm-critical'], metric_id: 'hcm-critical', narrative_en: `${q3.narratives['hcm-critical'].narrative_en} Checked by the HR analyst.` }] });
    const ld0 = Number((await q("select count(*)::int n from kafaa_audit_events where action = 'disclosure.approve' and ledger_status in ('written', 'skipped')"))[0].n);
    const p5 = await ap('chco', 'hcd-2026-Q3', ['hcm-active-learners', 'hcm-ai-fundamentals', 'hcm-credits']);
    const p5a = await lastAudit('disclosure.approve');
    const mid = (await q("select status, approvals from kafaa_hc_disclosures where id = 'hcd-2026-Q3'"))[0];
    const p6 = await ap('chco', 'hcd-2026-Q3', ['hcm-critical', 'hcm-participation']);
    const fin = (await q("select status, approvals, narratives, published_by from kafaa_hc_disclosures where id = 'hcd-2026-Q3'"))[0];
    const p7 = await ap('chco', 'hcd-2026-Q3', ['hcm-trained']);
    ok(s6.ok && s6.data.ready === 5 && p5.ok && !p5.data.published && mid.status === 'draft' && Object.keys(mid.approvals).length === 5 && p5a.ledger_status === 'written' && p5a.ledger_seq != null
      && p6.ok && p6.data.published && fin.status === 'published' && fin.published_by === 'p-chco' && ids.every((m) => fin.approvals[m] && fin.narratives[m].by !== fin.approvals[m].by) && p7.code === 'published'
      && Number((await q("select count(*)::int n from kafaa_audit_events where action = 'disclosure.approve' and ledger_status in ('written', 'skipped')"))[0].n) === ld0 + 2,
    'approveDisclosure: the analyst rewrites the critical-skills narrative, the HR director approves the rest (audit + ledger each time); with every line approved by a second person the disclosure publishes and freezes');
    const pk = buildPack({ ...q3, approvals: { 'hcm-trained': q3.approvals['hcm-trained'] } }, hm);
    ok(pk.simulated && pk.not_an_assurance && pk.metrics.every((m) => (m.metric_id === 'hcm-trained') === m.published) && pk.metrics.filter((m) => !m.published).every((m) => m.value === null && m.narrative_en === null),
      'export pack: SIMULATED, not an assurance statement; a line without approval carries no value and no narrative');
    // pilots
    const stS = (await one('buyer', 'select kafaa_pilot_stats() r')).r;
    const stP = (await one('alnoor-gm', 'select kafaa_pilot_stats() r')).r;
    ok(stS.ok && stS.data.rate === 75 && stS.data.reference?.value === 78 && stP.code === 'forbidden', 'pilotStats: staff see the adoption rate with the FSC reference from kafaa_benchmarks; partners are refused');
    const svp = async (p, x) => (await one(p, 'select kafaa_save_pilot($1::jsonb) r', [JSON.stringify(x)])).r;
    const n1 = await svp('k-hr-analyst', { ...base, status: 'running' });
    const n2 = await svp('k-hr-analyst', { ...base, id: 'sp-check-two', evaluator_person_id: 'p-training-mgr' });
    const n3 = await svp('k-hr-analyst', { ...base, id: 'sp-check-three', evaluator_person_id: 'p-k-hr-analyst' });
    const n4 = await svp('training-mgr', { ...base, id: 'sp-check-four' });
    const n5 = await svp('k-hr-analyst', { ...base, id: 'sp-ai-literacy-nudges' });
    const n6 = await svp('chco', { ...base, status: 'draft' });
    ok(n1.ok && n1.data.version === 1 && n2.code === 'invalid' && /independent/.test(n2.message) && n3.code === 'invalid' && n4.code === 'forbidden' && n5.code === 'locked' && n6.code === 'invalid',
      'savePilot: HR registers a pilot with an independent evaluator (not the owner, not the person registering it); the training manager is refused; an evaluated pilot is locked; a running pilot stays running');
    const cl = async (p, id, a) => (await one(p, 'select kafaa_close_pilot($1, $2) r', [id, a])).r;
    const sg = async (p, id, x) => (await one(p, 'select kafaa_signoff_pilot($1, $2::jsonb) r', [id, JSON.stringify(x)])).r;
    const k0 = await cl('chco', 'sp-check-pilot', 'adopted');
    const g0 = await sg('chco', 'sp-check-pilot', so);
    const g1 = await sg('compliance', 'sp-check-pilot', { ...so, metric_results: [] });
    const g2 = await sg('compliance', 'sp-check-pilot', { ...so, result: 'failed', recommendation: 'not_adopted', result_en: 'No change in the first-pass rate against the comparison.' });
    const g2a = await lastAudit('pilot.signoff');
    const g3 = await sg('compliance', 'sp-check-pilot', so);
    const k1 = await cl('chco', 'sp-check-pilot', 'adopted');
    const k2 = await cl('compliance', 'sp-check-pilot', 'not_adopted');
    const k3 = await cl('k-hr-analyst', 'sp-check-pilot', 'not_adopted');
    const k3a = await lastAudit('pilot.close');
    const k4 = await cl('chco', 'sp-check-pilot', 'not_adopted');
    const seen = await rd('sro', 'skill_pilots', "id = 'sp-check-pilot'");
    ok(k0.code === 'no_signoff' && g0.code === 'not_evaluator' && g1.code === 'invalid' && g2.ok && g2a.ledger_status === 'written' && g3.code === 'not_running' && k1.code === 'invalid' && k2.code === 'forbidden'
      && k3.ok && k3a.ledger_status === 'written' && k4.code === 'closed' && seen === 1 && k3.data.rate === Math.floor(1000 * 6 / 9 + 0.5) / 10,
    'acceptance (FS61): a pilot cannot close without the evaluator\'s sign-off; only the named evaluator signs off (ledger); a failed pilot is not adopted; closing publishes it and the failure stays visible to staff; the rate counts it');
    const g4 = await sg('independent-approver', 'sp-adaptive-requal', { ...so, metric_results: [{ key: 'study_hours', pilot: 11.5, comparison: 16 }, { key: 'first_pass', pilot: 93, comparison: 92 }] });
    const k5 = await cl('chco', 'sp-adaptive-requal', 'expanded');
    const k6 = await cl('chco', 'sp-ai-literacy-nudges', 'expanded');
    ok(g4.ok && k5.ok && k6.ok && k6.data.rate === Math.floor(1000 * 8 / 11 + 0.5) / 10, 'live demo path: the independent approver (a NEXUS role card) signs off the running pilot and the HR director closes both signed-off pilots');
    void today;
  } finally {
    await db.exec('rollback');
  }

  // ── additivity, function bodies and table digests (for the live comparison)
  const text = readFileSync(MIG, 'utf8');
  ok(!/\b(drop|delete|truncate)\b/i.test(text) && !/\balter\s+table\s+(?!kafaa_)/i.test(text) && !/create\s+or\s+replace\s+function\s+(kafaa_air_people|kafaa_crs_|kafaa_skill_states_v2|kafaa_skills_apply)/i.test(text),
    'additive: the FS71 migration names no destructive statement, alters only kafaa_* tables and redefines no shared function');
  const md5s = await q(`select p.proname, md5(p.prosrc) m from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any($1) order by 1`, [FUNCS]);
  ok(md5s.length === FUNCS.length, `functions: ${md5s.length} new function bodies present`);
  console.log(`    md5 ${md5s.map((r) => `${r.proname}=${r.m.slice(0, 8)}`).join(' ')}`);
  for (const t of TABLES) {
    const d = (await q(`select count(*)::int n, left(md5(string_agg(to_jsonb(x)::text, '|' order by x.id)), 8) dg from kafaa_${t} x`))[0];
    console.log(`    digest kafaa_${t} ${d.n} ${d.dg}`);
  }
}
