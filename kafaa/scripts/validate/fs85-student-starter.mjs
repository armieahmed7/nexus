// [FS wave H · E5 · FS77] PGlite checks for 20261010285001_kafaa_fs85_student_starter.sql (student future-skills starter and intake baselines).
// Seed sanity (every starter fact cites an https source with an as-of date; SMR text clean; mandatory modules never skipped; every seeded
// plan = inductionPlan() of the baseline it names); SQL = TS parity: kafaa_ib_problem = baselineProblem(), kafaa_ib_clean = cleanEntries(),
// kafaa_ib_for = baselineFor(), kafaa_ip_compute = inductionPlan(), kafaa_ip_problem = planProblem(), kafaa_ip_joiners = joinerCandidates();
// RLS per persona (public reads lessons, modules and published baselines only; plans are read by the joiner, HR and training staff);
// RPC flows and RBAC inside a rolled-back transaction (induction plans read the baseline for the joiner's intake year; publishing makes
// plans stale; mandatory modules refused; ledger on publish only); grants; additivity.
import { readFileSync } from 'node:fs';
import {
  baselineFor, baselineProblem, cleanEntries, inductionPlan, joinerCandidates, lessonProblem, planProblem, starterTextIsClean,
} from '../../src/modules/m06/starter.ts';

const BANNED = [['dr', 'op'], ['del', 'ete'], ['trun', 'cate']].map((p) => p.join('')); // destructive SQL words, spelled so this file does not contain them
const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${k}:${canon(v[k])}`).join(',')}}` : typeof v === 'number' ? String(Number(v)) : JSON.stringify(v ?? null));
const MIG = 'supabase/migrations/20261010285001_kafaa_fs85_student_starter.sql';
const NUM = new Set(['hours', 'refresh_hours', 'hours_total', 'hours_planned', 'hours_saved']);
const norm = (rows) => rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : NUM.has(k) && v != null ? Number(v) : v])));
const first = (a, b) => { const x = canon(a), y = canon(b); if (x === y) return ''; let i = 0; while (i < x.length && x[i] === y[i]) i++; return ` (SQL …${x.slice(Math.max(0, i - 60), i + 80)} vs TS …${y.slice(Math.max(0, i - 60), i + 80)})`; };
const TEST = { 'k-lo-trainee': '00000000-0000-4000-8000-000000008501', 'k-student': '00000000-0000-4000-8000-000000008502' };

export default async function fs85Checks({ db, one, ok }) {
  console.log('FS wave H · E5 · FS77 student future-skills starter and intake baselines');
  await db.exec('reset role');
  const T = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables;
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  const tables = async (names) => Object.fromEntries(await Promise.all(names.map(async (n) => [n, norm(await q(`select * from kafaa_${n} order by id`))])));
  const W = await tables(['starter_lessons', 'induction_modules', 'intake_baselines', 'induction_plans', 'people', 'applications']);
  const today = (await q('select current_date::text d'))[0].d;
  const mods = W.induction_modules;

  // test identities for two Kafa'a-only personas (test-only profiles)
  for (const [persona, uid] of Object.entries(TEST)) if (uid) await db.query(`insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,'enec-ops','employee',$4) on conflict do nothing`, [uid, `${persona}@fs85.test`, persona, ['Test']]);
  const asT = async (persona, sql, p = []) => {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: TEST[persona] })]);
    await db.exec('set role authenticated');
    try { return (await db.query(sql, p)).rows; } finally { await db.exec('reset role'); }
  };

  // ── seed sanity
  ok(W.starter_lessons.length === T.starter_lessons.length && W.starter_lessons.length === 8 && W.starter_lessons.every((l) => lessonProblem({ ...l, as_of: String(l.as_of).slice(0, 10) }) === null)
    && W.starter_lessons.filter((l) => l.track === 'smr').every((l) => starterTextIsClean([l.title_en, l.summary_en, l.points, l.self_check])),
    `acceptance (FS77 all facts cite sources): ${W.starter_lessons.length} starter lessons, every one with https sources and an as-of date; SMR text has no site, headcount or deployment claim`);
  ok(mods.length === 12 && mods.filter((m) => m.mandatory).length === 6 && W.intake_baselines.length === T.intake_baselines.length
    && W.intake_baselines.every((b) => baselineProblem({ intake_year: b.intake_year, programme: b.programme, entries: b.entries, note_en: b.note_en, note_ar: b.note_ar }, mods) === null)
    && W.intake_baselines.every((b) => b.listed === (b.status === 'published')),
    `seed: 12 induction modules (6 mandatory), ${W.intake_baselines.length} valid baselines; exactly the published ones are listed`);
  const byId = new Map(W.intake_baselines.map((b) => [b.id, b]));
  const planBad = W.induction_plans.filter((p) => {
    const plan = inductionPlan(mods, p.baseline_id ? byId.get(p.baseline_id) : null);
    return canon({ ...plan }) !== canon({ baseline_id: p.baseline_id, baseline_version: p.baseline_version, items: p.items, hours_total: p.hours_total, hours_planned: p.hours_planned, hours_saved: p.hours_saved });
  });
  const stale = W.induction_plans.filter((p) => (baselineFor(W.intake_baselines, p.intake_year, p.programme)?.id ?? null) !== (p.baseline_id ?? null)).map((p) => p.id);
  ok(W.induction_plans.length === 8 && planBad.length === 0 && canon(stale) === canon(['ip-w-lo-10']) && W.induction_plans.every((p) => p.items.filter((i) => mods.find((m) => m.id === i.module_id).mandatory).every((i) => i.action === 'full')),
    `seed: 8 induction plans = inductionPlan() of the baseline each names; mandatory modules always full; one stale plan (${stale.join(', ')})`);

  // ── parity
  const base = { intake_year: 2027, programme: 'all', entries: [{ module_id: 'ind-ai-basics', status: 'held', basis: 'national_curriculum', source_url: 'https://example.org/a', note_en: ' x ', note_ar: 'y' }, { module_id: 'ind-data', status: 'partial', basis: 'intake_diagnostic' }], note_en: '', note_ar: '' };
  const e0 = base.entries[0], e1 = base.entries[1];
  const muts = [{}, { intake_year: 2019 }, { intake_year: 2036 }, { intake_year: 2026.5 }, { intake_year: '2026' }, { intake_year: null }, { programme: 'mustaqbali' }, { programme: null }, { programme: 'gdp' },
    { entries: [] }, { entries: 'x' }, { entries: Array(13).fill(e1) }, { entries: [e1, e1] }, { entries: [{ ...e1, module_id: 'zz' }] }, { entries: [{ ...e1, module_id: 7 }] }, { entries: ['x'] }, { entries: [[1]] },
    { entries: [{ ...e1, status: 'maybe' }] }, { entries: [{ ...e1, status: null }] }, { entries: [{ ...e1, basis: 'guess' }] }, { entries: [{ ...e1, basis: 'none' }] }, { entries: [{ ...e1, status: 'not_held', basis: 'none' }] },
    { entries: [{ module_id: 'ind-safety-culture', status: 'held', basis: 'intake_diagnostic' }] }, { entries: [{ module_id: 'ind-cyber', status: 'partial', basis: 'none' }] }, { entries: [{ module_id: 'ind-site', status: 'not_held', basis: 'none' }] },
    { entries: [{ ...e0, source_url: null }] }, { entries: [{ ...e0, source_url: 'http://x.org' }] }, { entries: [{ ...e0, source_url: 5 }] }, { entries: [{ ...e1, source_url: 'https://a b' }] }, { entries: [{ ...e1, source_url: 'https://ok.org/x' }] },
    { entries: [{ ...e0, note_en: 'x'.repeat(301) }] }, { entries: [{ ...e0, note_ar: 3 }] }, { entries: [{ ...e0, note_en: ` ${'x'.repeat(300)} ` }] }, { note_en: 'x'.repeat(601) }, { note_ar: 9 },
    { entries: [e1, { ...e1, module_id: 'zz' }, { ...e1, status: 'bad' }] }, { entries: [{ ...e1, status: 'bad' }, { ...e1, module_id: 'zz' }] }];
  const pd = [];
  for (const m of muts) {
    const inp = { ...base, ...m };
    const a = (await q('select kafaa_ib_problem($1::jsonb) c', [JSON.stringify(inp)]))[0].c;
    const b = baselineProblem(inp, mods);
    if ((a ?? null) !== b) pd.push(`${JSON.stringify(m).slice(0, 70)}: ${a} vs ${b}`);
  }
  for (const raw of ['null', '[]', '"x"']) { const a = (await q(`select kafaa_ib_problem('${raw}'::jsonb) c`))[0].c; if (a !== baselineProblem(JSON.parse(raw), mods)) pd.push(`raw ${raw}: ${a}`); }
  const clean = (await q('select kafaa_ib_clean($1::jsonb) j', [JSON.stringify([e1, e0, { module_id: 'ind-energy', status: 'not_held', basis: 'none', note_en: '  a  ' }])]))[0].j;
  ok(pd.length === 0 && canon(clean) === canon(cleanEntries([e1, e0, { module_id: 'ind-energy', status: 'not_held', basis: 'none', note_en: '  a  ' }], mods)),
    `SQL kafaa_ib_problem = baselineProblem() on ${muts.length + 3} generated drafts (mandatory modules never held or partial); kafaa_ib_clean = cleanEntries()${pd.length ? ` (${pd[0]})` : ''}`);
  const forDiff = [];
  for (let y = 2019; y <= 2028; y++) for (const sc of ['all', 'dnt', 'energy-pioneers', 'gdp', 'gpo', 'direct']) {
    const a = (await q('select (kafaa_ib_for($1, $2)).id id', [y, sc]))[0].id;
    const b = baselineFor(W.intake_baselines, y, sc)?.id ?? null;
    if ((a ?? null) !== b) forDiff.push(`${y}/${sc}: ${a} vs ${b}`);
  }
  ok(forDiff.length === 0, `SQL kafaa_ib_for = baselineFor() for 10 intake years x 6 scopes (programme first, then all programmes, highest published version)${forDiff[0] ? ` (${forDiff[0]})` : ''}`);
  const cmp = [];
  const variants = [...W.intake_baselines, null, { id: 'ib-x', intake_year: 2030, programme: 'all', version: 3, status: 'published', entries: [{ module_id: 'ind-energy', status: 'partial', basis: 'intake_diagnostic' }, { module_id: 'ind-smr', status: 'held', basis: 'programme_curriculum' }, { module_id: 'ind-cyber', status: 'held', basis: 'x' }] }];
  for (const b of variants) {
    const a = b ? (await q(`select kafaa_ip_compute(jsonb_populate_record(null::kafaa_intake_baselines, $1::jsonb)) j`, [JSON.stringify(b)]))[0].j
      : (await q('select kafaa_ip_compute(null::kafaa_intake_baselines) j'))[0].j;
    const t = inductionPlan(mods, b);
    if (canon(a) !== canon(t)) cmp.push(`${b?.id ?? 'none'}${first(a, t)}`);
  }
  const ppd = [];
  for (const [inp, kind] of [[{ programme: 'dnt', intake_year: 2026 }, 'staff'], [{ programme: 'dnt', intake_year: 2026 }, 'applicant'], [{ programme: 'dnt', intake_year: 2026 }, 'partner'], [{ programme: 'dnt', intake_year: 2026 }, null],
    [{ programme: 'all', intake_year: 2026 }, 'staff'], [{ programme: 'mustaqbali', intake_year: 2026 }, 'staff'], [{ programme: 'gdp', intake_year: 2019 }, 'staff'], [{ programme: 'gdp', intake_year: '2026' }, 'staff'], [{ programme: 'gdp' }, 'staff'], [{ programme: 'direct', intake_year: 2035 }, 'applicant']]) {
    const a = (await q('select kafaa_ip_problem($1::jsonb, $2) c', [JSON.stringify(inp), kind]))[0].c;
    const b = planProblem(inp, kind ? { kind } : null);
    if ((a ?? null) !== b) ppd.push(`${JSON.stringify(inp)}/${kind}: ${a} vs ${b}`);
  }
  const jA = (await q('select kafaa_ip_joiners(current_date) j'))[0].j;
  const jT = joinerCandidates(W, today);
  ok(cmp.length === 0 && ppd.length === 0 && canon(jA) === canon(jT) && jT.length >= 9 && jT.some((j) => j.source === 'offer') && jT.some((j) => j.source === 'plan'),
    `SQL kafaa_ip_compute = inductionPlan() on ${variants.length} baselines (incl. none and a hand-made one); kafaa_ip_problem = planProblem(); kafaa_ip_joiners = joinerCandidates() (${jT.length} joiners)${cmp[0] ?? ''}${ppd[0] ?? ''}${first(jA, jT)}`);

  // ── RLS
  const cnt = async (who, sql) => Number((await one(who, sql)).n);
  const pubN = W.intake_baselines.filter((b) => b.listed).length;
  ok(await cnt(null, 'select count(*)::int n from kafaa_starter_lessons') === 8 && await cnt(null, 'select count(*)::int n from kafaa_induction_modules') === 12
    && await cnt(null, 'select count(*)::int n from kafaa_intake_baselines') === pubN && await cnt(null, 'select count(*)::int n from kafaa_induction_plans') === 0
    && await cnt('sro', 'select count(*)::int n from kafaa_intake_baselines') === pubN && await cnt('sro', 'select count(*)::int n from kafaa_induction_plans') === 0
    && await cnt('alnoor-gm', 'select count(*)::int n from kafaa_induction_plans') === 0 && await cnt('k-university', 'select count(*)::int n from kafaa_induction_plans') === 0,
    `RLS (Public R): anonymous visitors, staff and partners read the 8 lessons, 12 modules and ${pubN} published baselines only, and no induction plan`);
  const own = await asT('k-lo-trainee', 'select id from kafaa_induction_plans');
  ok(own.length === 1 && own[0].id === 'ip-p-k-lo-trainee' && (await asT('k-student', 'select id from kafaa_induction_plans')).length === 0
    && await cnt('k-hr-analyst', 'select count(*)::int n from kafaa_induction_plans') === 8 && await cnt('chco', 'select count(*)::int n from kafaa_intake_baselines') === W.intake_baselines.length
    && await cnt('training-mgr', 'select count(*)::int n from kafaa_induction_plans') === 8 && await cnt('k-auditor', 'select count(*)::int n from kafaa_intake_baselines') === W.intake_baselines.length,
    'RLS: a joiner reads only their own plan; HR (workforce_strategy), training staff (sat) and auditors read every plan and every baseline incl. drafts');

  // ── RPC flows (rolled back)
  await db.exec('begin');
  try {
    const r = async (who, sql, p = []) => (await one(who, sql, p)).r;
    const led = async () => Number((await q('select count(*)::int n from ledger_entries'))[0].n);
    const aud = async () => Number((await q('select count(*)::int n from kafaa_audit_events'))[0].n);
    const draft27 = W.intake_baselines.find((b) => b.status === 'draft');
    const inp27 = { intake_year: 2027, programme: 'all', entries: draft27.entries, note_en: draft27.note_en, note_ar: draft27.note_ar };
    const sF = await r('sro', 'select kafaa_save_intake_baseline($1::jsonb) r', [JSON.stringify(inp27)]);
    const sT = await r('training-mgr', 'select kafaa_save_intake_baseline($1::jsonb) r', [JSON.stringify(inp27)]);
    const sM = await r('k-hr-analyst', 'select kafaa_save_intake_baseline($1::jsonb) r', [JSON.stringify({ ...inp27, entries: [...draft27.entries, { module_id: 'ind-radiation', status: 'held', basis: 'intake_diagnostic' }] })]);
    ok(sF.code === 'forbidden' && sT.code === 'forbidden' && sM.code === 'invalid' && /Mandatory nuclear modules/.test(sM.message),
      'saveIntakeBaseline: HR only (a manager and the training manager are refused); a mandatory module can never be marked held');
    const a0 = await aud(), l0 = await led();
    const sD = await r('k-hr-analyst', 'select kafaa_save_intake_baseline($1::jsonb) r', [JSON.stringify({ ...inp27, note_en: 'Updated draft' })]);
    const a1 = await aud(), l1 = await led();
    const sP = await r('chco', 'select kafaa_save_intake_baseline($1::jsonb) r', [JSON.stringify({ ...inp27, publish: true })]);
    const row27 = norm(await q(`select * from kafaa_intake_baselines where id = $1`, [draft27.id]))[0];
    ok(sD.ok && sD.data.id === draft27.id && sD.data.status === 'draft' && a1 === a0 + 1 && l1 === l0 && sP.ok && sP.data.status === 'published' && sP.data.stale_plans === 6 && row27.status === 'published' && row27.listed === true
      && row27.published_by === 'p-chco' && (await led()) === l1 + 1,
      `saveIntakeBaseline: saving updates the open draft (audited, no ledger); publishing makes it public, writes the ledger and reports the ${sP.data?.stale_plans} 2027 plans that now read a different baseline`);
    const sN = await r('chco', 'select kafaa_save_intake_baseline($1::jsonb) r', [JSON.stringify({ intake_year: 2026, programme: 'all', entries: [{ module_id: 'ind-ai-basics', status: 'held', basis: 'national_curriculum', source_url: 'https://www.middleeastainews.com/p/uae-rolls-out-ai-school-curriculum' }], publish: true })]);
    const v26 = norm(await q(`select id, status, listed from kafaa_intake_baselines where intake_year = 2026 and programme = 'all' order by version`));
    ok(sN.ok && sN.data.id === 'ib-2026-all-v3' && sN.data.version === 3 && canon(v26.map((x) => x.status)) === canon(['superseded', 'superseded', 'published']) && v26.filter((x) => x.listed).length === 1,
      'saveIntakeBaseline: a new version supersedes the previous published one (versions kept, one listed)');
    // plans read the baseline for the joiner's intake year
    const bF = await r('sro', 'select kafaa_build_induction_plan($1::jsonb) r', [JSON.stringify({ person_id: 'ap-054', programme: 'dnt', intake_year: 2027 })]);
    const bP = await r('chco', 'select kafaa_build_induction_plan($1::jsonb) r', [JSON.stringify({ person_id: 'p-alnoor-gm', programme: 'dnt', intake_year: 2027 })]);
    const bY = await r('chco', 'select kafaa_build_induction_plan($1::jsonb) r', [JSON.stringify({ person_id: 'ap-054', programme: 'dnt', intake_year: 2040 })]);
    const B = await tables(['intake_baselines']);
    const build = async (person, programme, year) => {
      const res = await r('chco', 'select kafaa_build_induction_plan($1::jsonb) r', [JSON.stringify({ person_id: person, programme, intake_year: year })]);
      const row = norm(await q('select * from kafaa_induction_plans where person_id = $1', [person]))[0];
      const want = inductionPlan(mods, baselineFor(B.intake_baselines, year, programme));
      return { res, row, want, same: canon({ baseline_id: row.baseline_id, baseline_version: row.baseline_version, items: row.items, hours_total: row.hours_total, hours_planned: row.hours_planned, hours_saved: row.hours_saved }) === canon(want) };
    };
    const p27 = await build('ap-054', 'dnt', 2027);
    const p26g = await build('ap-128', 'gdp', 2026);
    const p25 = await build('ap-128', 'dnt', 2025);
    const p30 = await build('ap-055', 'dnt', 2030);
    const note = norm(await q(`select * from kafaa_notifications where id = 'nt-ip-ap-054-r2'`));
    ok(bF.code === 'forbidden' && bP.code === 'invalid' && bY.code === 'invalid'
      && p27.res.ok && p27.row.baseline_id === 'ib-2027-all-v1' && p27.row.revision === 2 && p27.same && p27.row.hours_saved > 0
      && p26g.same && p26g.row.baseline_id === 'ib-2026-gdp-v1' && p25.same && p25.row.baseline_id === 'ib-2025-all-v2' && p25.row.revision === 2
      && p30.same && p30.row.baseline_id === null && p30.row.hours_saved === 0 && note.length === 1 && note[0].kind === 'induction' && note[0].link === '/my/induction',
      `acceptance (FS77 induction plans read the baseline for the joiner's intake year): 2027 DNT reads ib-2027-all-v1 (${p27.row.hours_saved} h saved), 2026 GDP reads the programme baseline ib-2026-gdp-v1, 2025 reads ib-2025-all-v2, 2030 has none (full induction); HR only; the joiner is notified`);
    const jF = await r('sro', 'select kafaa_induction_joiners() r');
    const jT2 = await r('training-mgr', 'select kafaa_induction_joiners() r');
    ok(jF.code === 'forbidden' && jT2.ok && Array.isArray(jT2.data) && jT2.data.some((j) => j.person_id === 'ap-128'), 'inductionJoiners: HR and training staff only');
  } finally { await db.exec('rollback'); }

  // ── grants and additivity
  let denied = 0;
  const helpers = ["select kafaa_ib_problem('{}'::jsonb)", "select kafaa_ib_for(2026, 'all')", 'select kafaa_ip_compute(null::kafaa_intake_baselines)', 'select kafaa_ip_joiners(current_date)',
    "select kafaa_ip_notify('x', 'p-k-ro', 'a', 'b')", "select kafaa_ib_clean('[]'::jsonb)"];
  for (const sql of helpers) { try { await one('training-mgr', sql); } catch { denied++; } }
  ok(denied === helpers.length, 'grants: internal helpers (rules, plan builder, joiner list, notification writer) are not executable by signed-in users');
  let anon = 0;
  const rpcs = ["select kafaa_save_intake_baseline('{}'::jsonb)", "select kafaa_build_induction_plan('{}'::jsonb)", 'select kafaa_induction_joiners()'];
  for (const sql of rpcs) { try { await one(null, sql); } catch { anon++; } }
  ok(anon === rpcs.length, 'grants: anonymous visitors execute none of the FS85 RPCs (the starter itself needs no RPC)');
  const pol = await q(`select tablename, qual from pg_policies where tablename in ('kafaa_starter_lessons', 'kafaa_induction_modules', 'kafaa_intake_baselines', 'kafaa_induction_plans') and policyname = 'kafaa_read'`);
  ok(pol.length === 4 && pol.every((p) => /SELECT kafaa_has_grant/i.test(p.qual)), 'RLS: the four tables use the per-statement policy form');
  const text = readFileSync(MIG, 'utf8');
  ok(!BANNED.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(text)) && !/\balter\s+table\s+(?!kafaa_)/i.test(text) && !/\balter\s+policy\s+\w+\s+on\s+(?!kafaa_)/i.test(text) && !/\bupdate\s+(?!kafaa_)\w+\s+set\b/i.test(text),
    'additive: the FS85 migration removes nothing (the words never appear), alters and updates only kafaa_* objects');
}
