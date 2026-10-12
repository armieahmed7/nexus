// [FS wave G · E3 · FS64 + FS65] PGlite checks for 20261010273001_kafaa_fs73_regional_pledges.sql (M36 Skills Ecosystem).
// Seed (the current regional release equals demandRows() of the released FS51 forecast; every released cell is null, 0 or 10+; no withheld
// or security skill released; commitments and pledges pass their checks); SQL = TS parity on the database state and on generated cases:
// kafaa_rg_rows = demandRows (every stored forecast x 3 planning scenarios + synthetic results with small cells), academic terms,
// kafaa_rg_commit_problem = commitmentProblem, kafaa_rg_delivery_problem = deliveryProblem, kafaa_rg_status = commitmentView().status,
// kafaa_pl_problem / kafaa_pl_progress_problem = pledgeProblem / progressProblem, kafaa_pl_ledger = pledgeLedger (several days); RLS
// (released aggregates for everyone with ecosystem R; organisation rows OwnOrg only: alnoor-gm never sees gulfhydro-qa rows and vice
// versa; HR, admin and auditors read all); the seven RPCs with their RBAC, refusals, audit and ledger rows (flows inside a rolled-back
// transaction); grants; additivity. Prints the md5 of every new function body and the row digest of every new table for the live check.
import { readFileSync } from 'node:fs';
import { DEMAND_AREAS, commitmentProblem, commitmentView, deliveryProblem, demandRows, firstOpenTerm, termState } from '../../src/modules/m36/regional.ts';
import { pledgeLedger, pledgeProblem, progressProblem } from '../../src/modules/m36/pledges.ts';

const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${k}:${canon(v[k])}`).join(',')}}` : typeof v === 'number' ? String(Number(v)) : typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) ? String(Number(v)) : JSON.stringify(v ?? null));
const same = (a, b) => canon(a) === canon(b);
const MIG = 'supabase/migrations/20261010273001_kafaa_fs73_regional_pledges.sql';
const TABLES = ['regional_demand', 'provider_commitments', 'pledges', 'pledge_progress'];
const FUNCS = ['kafaa_rg_rows', 'kafaa_rg_term_ord', 'kafaa_rg_term_of_ord', 'kafaa_rg_term_start', 'kafaa_rg_term_end', 'kafaa_rg_term_state', 'kafaa_rg_first_open', 'kafaa_rg_locked',
  'kafaa_rg_is_int', 'kafaa_rg_txt', 'kafaa_rg_commit_problem', 'kafaa_rg_delivery_problem', 'kafaa_rg_status', 'kafaa_pl_date', 'kafaa_pl_problem', 'kafaa_pl_progress_problem', 'kafaa_pl_status',
  'kafaa_pl_cell', 'kafaa_pl_count', 'kafaa_pl_ledger', 'kafaa_release_regional_demand', 'kafaa_commit_provision', 'kafaa_report_commitment_delivery', 'kafaa_review_commitment',
  'kafaa_register_pledge', 'kafaa_record_pledge_progress', 'kafaa_pledge_ledger'];

export default async function fs73Checks({ db, one, ok, uid }) {
  const S = JSON.parse(readFileSync('src/seed/seed.json', 'utf8'));
  const T = S.tables;
  console.log('FS wave G · E3 · FS64 Regional skills plan for Al Dhafra + FS65 Skills pledges ledger (M36)');
  await db.exec('reset role');
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  const fix = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v instanceof Date ? (/(_at|^ts)$/.test(k) ? v.toISOString() : v.toISOString().slice(0, 10)) : v]));
  const rows = async (t) => (await q(`select * from kafaa_${t} order by id`)).map(fix);
  for (const [persona, org, roles] of [['alnoor-qaqc', 'org-alnoor', ['Al Noor QA/QC Lead']], ['buyer', 'enec-ops', ['Buyer']]]) {
    if (uid[persona]) continue;
    const row = (await q('select user_id from profiles where persona_id = $1', [persona]))[0];
    if (row) { uid[persona] = row.user_id; continue; }
    uid[persona] = persona === 'buyer' ? '00000000-0000-4000-8000-000000006101' : '00000000-0000-4000-8000-000000007301';
    await q('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, org, persona === 'buyer' ? 'employee' : 'partner', roles]);
  }
  const today = (await q('select current_date::text d'))[0].d;
  const skillArea = Object.fromEntries(T.skills.map((s) => [s.id, s.area]));
  const ctxSkills = Object.fromEntries(T.skills.map((s) => [s.id, { area: s.area ?? null, lifecycle: s.lifecycle ?? null }]));

  // ── seed sanity and acceptance on the seed
  const rd = T.regional_demand, pc = T.provider_commitments, pl = T.pledges, pp = T.pledge_progress;
  const f25 = T.skill_forecasts.find((f) => f.id === 'sf-2025-v1');
  const exp = demandRows(f25.results, f25.scenario, skillArea);
  ok(rd.length === exp.length && rd.every((r) => r.status === 'current' && r.release_id === 'rdr-2025-1' && r.released && r.simulated)
    && exp.every((e) => same({ ...e }, (({ area, year, demand_low, demand_high, gap_low, gap_high, gap_plan, skills_n, withheld_n, skill_ids, suppressed }) => ({ area, year, demand_low, demand_high, gap_low, gap_high, gap_plan, skills_n, withheld_n, skill_ids, suppressed }))(rd.find((r) => r.area === e.area && r.year === e.year) ?? {}))),
  `seed: the current regional release rdr-2025-1 (${rd.length} rows) equals demandRows() of the released FS51 forecast sf-2025-v1 (computed, never typed)`);
  const cellOk = (v) => v === null || v === 0 || v >= 10;
  const withheld = new Set(T.skill_forecasts.flatMap((f) => f.results.suppressed ?? []));
  ok(rd.every((r) => [r.demand_low, r.demand_high, r.gap_low, r.gap_high, r.gap_plan].every(cellOk)) && rd.every((r) => r.skill_ids.every((s) => !withheld.has(s) && skillArea[s] !== 'security'))
    && !rd.some((r) => r.area === 'security') && rd.every((r) => !('basis_n' in r) && !('supply' in r)),
  'acceptance (FS64): only released, suppressed aggregates are stored: every cell is null, 0 or 10+, no skill FS51 withheld and no security skill is released, no supply or basis column');
  const relAreas = [...new Set(rd.map((r) => r.area))];
  ok(pc.length === 13 && pc.every((c) => commitmentProblem(c, { areas: relAreas, skills: ctxSkills, today: c.created_at.slice(0, 10) }) === null)
    && pc.every((c) => c.delivery.every((d) => deliveryProblem({ ...d, commitment_id: c.id }, c.plan, d.reported_at.slice(0, 10)) === null)) && new Set(pc.map((c) => c.org_id)).size === 7,
  'seed: 13 commitments by 7 providers, each passing the commit check as of its creation date, every delivery report passing its check');
  const statuses = new Set(pc.map((c) => commitmentView(c, today).status));
  ok(['on_track', 'at_risk', 'behind', 'not_started', 'withdrawn'].every((s) => statuses.has(s)), `acceptance (FS64): each commitment shows its delivery status (${[...statuses].join(', ')})`);
  ok(pl.length === 16 && pl.every((p) => pledgeProblem({ ...p }, p.pledged_on) === null && p.org_id && p.area && p.target_date) && pp.every((x) => x.completed <= x.started),
    'acceptance (FS65): each pledge names its organisation, skill area and date (16 pledges pass the register check)');

  // ── parity: demand rows
  const D = { skill_forecasts: await rows('skill_forecasts'), regional_demand: await rows('regional_demand'), provider_commitments: await rows('provider_commitments'), pledges: await rows('pledges'), pledge_progress: await rows('pledge_progress') };
  const synth = (vals) => ({
    years: [2026, 2028, 2030, 2035], suppressed: ['sk-op-01', 'sk-ma-01'],
    skills: vals.map(([id, area, basis, d, s]) => ({ skill_id: id, area, basis_n: basis, sc: Object.fromEntries(['baseline', 'advance', 'accelerated'].map((sc, i) => [sc, { d: [0, 1, 2, 3].map((y) => [d + i + y, d + i + y, 1, 0]), s: [0, 1, 2, 3].map(() => [s, s, 0, 0]) }])) })),
  });
  const synthetic = [
    synth([['sk-x1', 'operations', 12, 5, 0], ['sk-x2', 'operations', 4, 3, 1]]), synth([['sk-x3', 'maintenance', 30, 120, 115]]), synth([['sk-x4', 'safety', 8, 40, 0]]),
    synth([['sk-x5', 'security', 50, 100, 10], ['sk-x6', 'digital', 50, 9, 9]]), { years: [2026], skills: [], suppressed: [] }, {}, null,
  ];
  let bad = [];
  let n = 0;
  for (const f of D.skill_forecasts) for (const plan of ['baseline', 'advance', 'accelerated', 'unknown']) {
    n++;
    const a = (await q('select kafaa_rg_rows($1::jsonb, $2) r', [JSON.stringify(f.results), plan]))[0].r;
    if (!same(a, demandRows(f.results, plan, skillArea))) bad.push(`${f.id}/${plan}`);
  }
  for (const [i, r] of synthetic.entries()) {
    n++;
    const a = (await q('select kafaa_rg_rows($1::jsonb, $2) r', [JSON.stringify(r), 'advance']))[0].r;
    if (!same(a, demandRows(r, 'advance', skillArea))) bad.push(`synthetic ${i}`);
  }
  const smallCase = demandRows(synthetic[0], 'advance', skillArea);
  ok(bad.length === 0 && smallCase.some((x) => x.suppressed && x.gap_low === null) && demandRows(synthetic[2], 'advance', skillArea).every((x) => x.demand_low === null && x.suppressed)
    && demandRows(synthetic[3], 'advance', skillArea).every((x) => x.area !== 'security'),
  `demand rows: SQL kafaa_rg_rows = TS demandRows for ${n} cases (every stored forecast x planning scenario, synthetic small cells, basis under 10, security skills, empty results)${bad.length ? ` (differ: ${bad.join(', ')})` : ''}`);

  // ── parity: terms and checks
  const days = ['2026-01-31', '2026-02-01', '2026-07-31', '2026-08-01', '2026-08-31', '2026-09-01', today, '2027-01-15', '2030-07-31', '2030-08-01'];
  bad = [];
  for (const d of days) {
    const fo = (await q('select kafaa_rg_first_open($1::date) t', [d]))[0].t;
    if (fo !== firstOpenTerm(d)) bad.push(`open ${d}`);
    for (const t of ['2025S2', '2026S1', '2026S2', '2030S2']) if ((await q('select kafaa_rg_term_state($1, $2::date) s', [t, d]))[0].s !== termState(t, d)) bad.push(`${t}@${d}`);
  }
  ok(bad.length === 0, `academic terms: SQL first open term and term state = TS on ${days.length} days${bad.length ? ` (${bad.join(', ')})` : ''}`);
  const fo = firstOpenTerm(today);
  const base = { area: 'operations', kind: 'cohort', title_en: 'Plant operations cohort', title_ar: 'دفعة تشغيل المحطات', summary_en: 'A cohort for operations fundamentals.', summary_ar: 'دفعة لأساسيات التشغيل في المحطة.',
    skill_ids: ['sk-co-01'], level: 2, plan: [{ term: fo, seats: 20 }, { term: '2027S2', seats: 20 }] };
  const probes = [base, { ...base, area: 'engineering' }, { ...base, area: 7 }, { ...base, kind: 'degree' }, { ...base, title_ar: 'English only title' }, { ...base, title_en: 'abc' },
    { ...base, summary_en: 'short' }, { ...base, skill_ids: ['sk-sa-01'] }, { ...base, skill_ids: ['sk-co-01', 'sk-co-01'] }, { ...base, skill_ids: ['nope'] }, { ...base, skill_ids: 'sk-co-01' },
    { ...base, level: 5 }, { ...base, level: 2.5 }, { ...base, plan: [] }, { ...base, plan: [{ term: '2025S1', seats: 10 }] }, { ...base, plan: [{ term: '2027S2', seats: 10 }, { term: '2027S1', seats: 10 }] },
    { ...base, plan: [{ term: '2031S1', seats: 10 }] }, { ...base, plan: [{ term: '2027S1', seats: 0 }] }, { ...base, plan: [{ term: '2027S1', seats: 501 }] }, { ...base, plan: [{ term: '2027-S1', seats: 5 }] },
    { ...base, plan: [{ term: '2027S1', seats: '5' }] }, null, 'x'];
  const areas = relAreas;
  const probSql = [];
  for (const p of probes) probSql.push((await q('select kafaa_rg_commit_problem($1::jsonb, $2::text[], $3::jsonb, $4::date) c', [JSON.stringify(p), areas, '[]', today]))[0].c);
  const lockedCases = [[[{ term: '2025S2', seats: 12 }], { ...base, plan: [{ term: '2025S2', seats: 12 }, { term: '2027S1', seats: 5 }] }], [[{ term: '2025S2', seats: 12 }], { ...base, plan: [{ term: '2025S2', seats: 14 }] }],
    [[{ term: '2025S2', seats: 12 }], { ...base, plan: [{ term: '2027S1', seats: 5 }] }]];
  const lockSql = [];
  for (const [lk, p] of lockedCases) lockSql.push((await q('select kafaa_rg_commit_problem($1::jsonb, $2::text[], $3::jsonb, $4::date) c', [JSON.stringify(p), areas, JSON.stringify(lk), today]))[0].c);
  ok(probes.every((p, i) => (commitmentProblem(p, { areas, skills: ctxSkills, today }) ?? null) === probSql[i]) && probSql[0] === null && probSql.slice(1).every(Boolean)
    && lockedCases.every(([lk, p], i) => (commitmentProblem(p, { areas, skills: ctxSkills, today }, lk) ?? null) === lockSql[i]) && lockSql[0] === null && lockSql[1] === 'locked',
  `commit check: SQL kafaa_rg_commit_problem = TS commitmentProblem for ${probes.length} probes and ${lockedCases.length} locked-term cases (${[...new Set(probSql.filter(Boolean))].join(', ')}, ${lockSql[1]})`);
  const plan = [{ term: '2025S2', seats: 10 }, { term: fo, seats: 10 }, { term: '2030S1', seats: 10 }];
  const dprobes = [{ term: fo, enrolled: 9, completed: 0 }, { term: '2025S2', enrolled: 10, completed: 10 }, { term: '2030S1', enrolled: 1, completed: 0 }, { term: '2024S1', enrolled: 1, completed: 0 },
    { term: fo, enrolled: 5, completed: 6 }, { term: fo, enrolled: -1, completed: 0 }, { term: fo, enrolled: 1001, completed: 0 }, { term: fo, enrolled: 2.5, completed: 0 }, { term: 5 }, null];
  const dSql = [];
  for (const d of dprobes) dSql.push((await q('select kafaa_rg_delivery_problem($1::jsonb, $2::jsonb, $3::date) c', [JSON.stringify(d), JSON.stringify(plan), today]))[0].c);
  ok(dprobes.every((d, i) => (deliveryProblem(d, plan, today) ?? null) === dSql[i]) && dSql[0] === null && dSql[2] === 'future', `delivery check: SQL = TS for ${dprobes.length} probes (${dSql.join(', ')})`);
  bad = [];
  const sdays = [today, '2026-03-01', '2026-08-15', '2027-02-15', '2031-01-01'];
  for (const c of D.provider_commitments) for (const d of sdays) {
    const s = (await q('select kafaa_rg_status($1::jsonb, $2::jsonb, $3, $4::date) s', [JSON.stringify(c.plan), JSON.stringify(c.delivery), c.status, d]))[0].s;
    if (s !== commitmentView(c, d).status) bad.push(`${c.id}@${d}`);
  }
  ok(bad.length === 0, `delivery status: SQL kafaa_rg_status = TS commitmentView().status for ${D.provider_commitments.length} commitments x ${sdays.length} days${bad.length ? ` (${bad.slice(0, 5).join(', ')})` : ''}`);
  const pbase = { area: 'quality', people: 25, target_date: '2027-06-30', title_en: 'Quality skills pledge', title_ar: 'تعهد مهارات الجودة' };
  const pprobes = [pbase, { ...pbase, area: 'security' }, { ...pbase, people: 0 }, { ...pbase, people: 5001 }, { ...pbase, people: 2.5 }, { ...pbase, people: '25' }, { ...pbase, target_date: '2026-10-20' },
    { ...pbase, target_date: '2036-01-01' }, { ...pbase, target_date: '2027-02-30' }, { ...pbase, target_date: '30/06/2027' }, { ...pbase, title_ar: 'English only' }, { ...pbase, department_en: 'Ops' },
    { ...pbase, department_en: 'Ops training', department_ar: 'تدريب العمليات' }, { ...pbase, department_en: 'Ops', department_ar: 'Ops' }, null];
  const ppSql = [];
  for (const p of pprobes) ppSql.push((await q('select kafaa_pl_problem($1::jsonb, $2::date) c', [JSON.stringify(p), today]))[0].c);
  const prev = { as_of: '2026-06-30', started: 10, completed: 4 };
  const gprobes = [[{ as_of: '2026-09-30', started: 12, completed: 5 }, prev], [{ as_of: '2026-06-30', started: 12, completed: 5 }, prev], [{ as_of: '2026-09-30', started: 9, completed: 5 }, prev],
    [{ as_of: '2026-09-30', started: 12, completed: 13 }, prev], [{ as_of: '2025-01-01', started: 1, completed: 0 }, null], [{ as_of: '2099-01-01', started: 1, completed: 0 }, null],
    [{ as_of: '2026-09-30', started: 1.5, completed: 0 }, null], [{ as_of: 'x', started: 1, completed: 0 }, null]];
  const gSql = [];
  for (const [x, pv] of gprobes) gSql.push((await q('select kafaa_pl_progress_problem($1::jsonb, $2::date, $3::jsonb, $4::date) c', [JSON.stringify(x), '2026-01-10', pv ? JSON.stringify(pv) : null, today]))[0].c);
  ok(pprobes.every((p, i) => (pledgeProblem(p, today) ?? null) === ppSql[i]) && ppSql[0] === null && ppSql.slice(1).filter((x, i) => i !== 11).every(Boolean)
    && gprobes.every(([x, pv], i) => (progressProblem(x, { pledged_on: '2026-01-10' }, pv, today) ?? null) === gSql[i]) && gSql[0] === null,
  `pledge checks: SQL kafaa_pl_problem / kafaa_pl_progress_problem = TS for ${pprobes.length} + ${gprobes.length} probes (${[...new Set([...ppSql, ...gSql].filter(Boolean))].join(', ')})`);
  bad = [];
  const ldays = [today, '2026-06-30', '2026-12-31', '2027-07-01', '2029-01-01'];
  const orgs = Object.fromEntries(D.pledges.map((p) => [p.org_id, p.org_kind]));
  for (const d of ldays) {
    const a = (await q('select kafaa_pl_ledger($1::date) l', [d]))[0].l;
    if (!same(a, pledgeLedger({ pledges: D.pledges, progress: D.pledge_progress, orgs }, d))) bad.push(d);
  }
  const L = pledgeLedger({ pledges: D.pledges, progress: D.pledge_progress, orgs }, today);
  const groups = [L.totals, ...L.by_area, ...L.by_type, ...L.by_year];
  ok(bad.length === 0 && groups.every((g) => ['pledged', 'started', 'completed'].every((k) => g[k].suppressed || (g.orgs >= 2 && (g[k].value === 0 || g[k].value >= 10))))
    && groups.some((g) => g.pledged.suppressed) && groups.every((g) => !('total' in g) && !('sum' in g)),
  `acceptance (FS65): ledger SQL kafaa_pl_ledger = TS pledgeLedger on ${ldays.length} days; pledged, started and completed stay three separate cells; small counts (1-9 people or one organisation) suppressed${bad.length ? ` (differ: ${bad.join(', ')})` : ''}`);

  // ── RLS
  const cnt = async (p, t, w = 'true') => Number((await one(p, `select count(*)::int n from kafaa_${t} where ${w}`)).n);
  let rlsOk = true;
  const fails = [];
  for (const p of ['alnoor-gm', 'gulfhydro-qa', 'k-university', 'alnoor-qaqc', 'sro', 'buyer', 'training-mgr', 'chco', 'k-auditor']) if ((await cnt(p, 'regional_demand')) !== D.regional_demand.length) { rlsOk = false; fails.push(`rd:${p}`); }
  for (const p of [null, 'k-observer']) if ((await cnt(p, 'regional_demand')) !== 0) { rlsOk = false; fails.push(`rd:${p}`); }
  for (const t of ['provider_commitments', 'pledges', 'pledge_progress']) {
    for (const [p, org] of [['alnoor-gm', 'org-alnoor'], ['alnoor-qaqc', 'org-alnoor'], ['gulfhydro-qa', 'org-gulfhydro'], ['k-university', 'ku']]) {
      const mine = D[t].filter((r) => r.org_id === org).length;
      if ((await cnt(p, t)) !== mine || (await cnt(p, t, `org_id <> '${org}'`)) !== 0) { rlsOk = false; fails.push(`${t}:${p}`); }
    }
    for (const p of ['chco', 'k-hr-analyst', 'k-auditor', 'k-admin']) if ((await cnt(p, t)) !== D[t].length) { rlsOk = false; fails.push(`${t}:${p}`); }
    for (const p of [null, 'sro', 'buyer', 'training-mgr', 'k-observer']) if ((await cnt(p, t)) !== 0) { rlsOk = false; fails.push(`${t}:${p}`); }
  }
  ok(rlsOk, `RLS: released aggregates for every ecosystem reader (staff, partners, university, HR); organisation rows OwnOrg only (alnoor-gm never sees gulfhydro-qa rows and vice versa; the university only its own), HR/admin/auditors all; anonymous, staff, managers, the training manager and observers none${fails.length ? ` (${fails.join(', ')})` : ''}`);
  let direct = false;
  try { await one('alnoor-gm', "update kafaa_provider_commitments set level = 4 where id = 'pc-org-alnoor-1'"); direct = Number((await q("select count(*)::int n from kafaa_provider_commitments where id = 'pc-org-alnoor-1' and level = 4"))[0].n) === 1; } catch { direct = false; }
  let directIns = false;
  try { await one('alnoor-gm', "insert into kafaa_pledges (id, org_id, org_name_en, org_name_ar, org_kind, area, people, target_date, pledged_on, title_en, title_ar, created_by) values ('pl-x', 'org-alnoor', 'x', 'x', 'supplier', 'quality', 5, '2027-01-01', '2026-10-01', 'x', 'x', 'x')"); directIns = true; } catch { directIns = false; }
  ok(!direct && !directIns, 'writes only through the RPCs (no direct update of a commitment, no direct pledge insert)');

  // ── grants
  let anonDenied = 0;
  for (const sql of ["select kafaa_pledge_ledger()", "select kafaa_commit_provision('{}'::jsonb)", "select kafaa_register_pledge('{}'::jsonb)", "select kafaa_release_regional_demand('{}'::jsonb)",
    "select kafaa_report_commitment_delivery('{}'::jsonb)", "select kafaa_review_commitment('{}'::jsonb)", "select kafaa_record_pledge_progress('{}'::jsonb)"]) {
    try { await one(null, sql); } catch { anonDenied++; }
  }
  let helperDenied = 0;
  for (const sql of ["select kafaa_rg_rows('{}'::jsonb, 'baseline')", 'select kafaa_pl_ledger(current_date)', "select kafaa_rg_commit_problem('{}'::jsonb, '{}'::text[], '[]'::jsonb, current_date)", "select kafaa_pl_problem('{}'::jsonb, current_date)", "select kafaa_rg_status('[]'::jsonb, '[]'::jsonb, 'active', current_date)"]) {
    try { await one('chco', sql); } catch { helperDenied++; }
  }
  ok(anonDenied === 7 && helperDenied === 5, 'grants: anonymous visitors execute none of the seven RPCs; internal helpers are not executable by signed-in users');

  // ── RPC flows (rolled back)
  await db.exec('begin');
  try {
    const audits = async (action) => Number((await q('select count(*)::int n from kafaa_audit_events where action = $1', [action]))[0].n);
    const lastAudit = async (action) => (await q('select outcome, ledger_status, ledger_seq, reason from kafaa_audit_events where action = $1 order by seq desc limit 1', [action]))[0];
    const call = async (p, fn, x) => (await one(p, `select ${fn}($1::jsonb) r`, [JSON.stringify(x)])).r;
    // release
    const relNote = { note_en: 'The 2026 annual refresh, shared with providers for the next intake.', note_ar: 'التحديث السنوي لعام 2026، مشارك مع الجهات المزودة للدفعة القادمة.' };
    const r1 = await call('k-hr-analyst', 'kafaa_release_regional_demand', { forecast_id: 'sf-2026-v1', ...relNote });
    const r2 = await call('chco', 'kafaa_release_regional_demand', { forecast_id: 'sf-nope', ...relNote });
    const r3 = await call('chco', 'kafaa_release_regional_demand', { forecast_id: 'sf-2026-v2', ...relNote });
    const r4 = await call('chco', 'kafaa_release_regional_demand', { forecast_id: 'sf-2026-v1', note_en: 'short', note_ar: 'قصير' });
    const r5 = await call('chco', 'kafaa_release_regional_demand', { forecast_id: 'sf-2026-v1', note_en: 'We need 120 operators by 2030.', note_ar: relNote.note_ar });
    const r6 = await call('chco', 'kafaa_release_regional_demand', { forecast_id: 'sf-2025-v1', ...relNote });
    const r7 = await call('chco', 'kafaa_release_regional_demand', { forecast_id: 'sf-2026-v1', ...relNote });
    const r7a = await lastAudit('regional.release');
    const f26 = D.skill_forecasts.find((f) => f.id === 'sf-2026-v1');
    const exp26 = demandRows(f26.results, f26.scenario, skillArea);
    const cur = (await q("select * from kafaa_regional_demand where status = 'current' order by area, year")).map(fix);
    const sup = Number((await q("select count(*)::int n from kafaa_regional_demand where release_id = 'rdr-2025-1' and status = 'superseded'"))[0].n);
    const partnerSees = await cnt('gulfhydro-qa', 'regional_demand', "status = 'current'");
    ok(r1.code === 'forbidden' && r2.code === 'not_found' && r3.code === 'not_released' && r4.code === 'invalid' && r5.code === 'not_clean' && r6.code === 'already_current'
      && r7.ok && r7.data.release_id === 'rdr-2026-1' && r7.data.rows === exp26.length && r7.data.superseded === 'rdr-2025-1' && sup === D.regional_demand.length
      && cur.length === exp26.length && exp26.every((e) => { const c = cur.find((x) => x.area === e.area && x.year === e.year); return c && same([c.gap_plan, c.gap_low, c.gap_high, c.demand_low, c.demand_high, c.skill_ids, c.withheld_n], [e.gap_plan, e.gap_low, e.gap_high, e.demand_low, e.demand_high, e.skill_ids, e.withheld_n]); })
      && r7a.ledger_status === 'written' && partnerSees === exp26.length,
    'releaseRegionalDemand: HR director only; released FS51 forecasts only; clean EN/AR note; rows = demandRows (TS = SQL); the previous release superseded; ledger row; partners read the new release');
    // commitments
    const cbase = { action: 'create', area: 'maintenance', kind: 'cohort', title_en: 'Pump maintenance cohort', title_ar: 'دفعة صيانة المضخات', summary_en: 'A cohort on pump maintenance and testing.',
      summary_ar: 'دفعة حول صيانة المضخات واختبارها.', skill_ids: [], level: 2, plan: [{ term: fo, seats: 10 }, { term: '2027S2', seats: 12 }] };
    const c1 = await call('alnoor-qaqc', 'kafaa_commit_provision', cbase);
    const c2 = await call('chco', 'kafaa_commit_provision', cbase);
    const c3 = await call('alnoor-gm', 'kafaa_commit_provision', { ...cbase, plan: [{ term: '2024S1', seats: 10 }] });
    const c4 = await call('alnoor-gm', 'kafaa_commit_provision', { ...cbase, area: 'engineering' });
    const c5 = await call('alnoor-gm', 'kafaa_commit_provision', cbase);
    const c5a = await lastAudit('commitment.commit');
    const nAlnoor = D.provider_commitments.filter((c) => c.org_id === 'org-alnoor').length;
    ok(c1.code === 'forbidden' && c2.code === 'forbidden' && c3.code === 'invalid' && c4.code === 'invalid' && c5.ok && c5.data.id === `pc-org-alnoor-${nAlnoor + 1}` && c5a.ledger_status === 'written',
      'acceptance (FS64): commitments are written only through commitProvision (partner admin, own organisation; partner users and HR refused; closed terms and unreleased areas refused) with an audit row and a ledger row');
    const a0 = await audits('commitment.commit');
    const x1 = await call('gulfhydro-qa', 'kafaa_commit_provision', { ...cbase, action: 'revise', id: c5.data.id });
    const x2 = await call('k-university', 'kafaa_report_commitment_delivery', { commitment_id: 'pc-org-alnoor-1', term: fo, enrolled: 1, completed: 0 });
    ok(x1.code === 'not_found' && x2.code === 'not_found' && (await audits('commitment.commit')) === a0 + 1, 'partner isolation: another organisation\'s commitment reads as not found (revise and delivery), and the refusal is audited');
    const lk = await call('alnoor-gm', 'kafaa_commit_provision', { ...cbase, action: 'revise', id: 'pc-org-alnoor-1', area: 'maintenance', plan: [{ term: '2025S2', seats: 14 }, { term: fo, seats: 12 }] });
    const pcA = D.provider_commitments.find((c) => c.id === 'pc-org-alnoor-1');
    const rv = await call('alnoor-gm', 'kafaa_commit_provision', { action: 'revise', id: 'pc-org-alnoor-1', area: pcA.area, kind: pcA.kind, title_en: pcA.title_en, title_ar: pcA.title_ar, summary_en: pcA.summary_en,
      summary_ar: pcA.summary_ar, skill_ids: pcA.skill_ids, level: pcA.level, plan: [...pcA.plan.filter((x) => termState(x.term, today) !== 'future'), { term: '2027S2', seats: 14 }] });
    const rvRow = fix((await q("select version, hr_status, history, delivery from kafaa_provider_commitments where id = 'pc-org-alnoor-1'"))[0]);
    const wd1 = await call('alnoor-gm', 'kafaa_commit_provision', { action: 'withdraw', id: c5.data.id, reason: 'x' });
    const wd2 = await call('alnoor-gm', 'kafaa_commit_provision', { action: 'withdraw', id: c5.data.id, reason: 'The cohort moves to the supplier academy.' });
    const wd3 = await call('alnoor-gm', 'kafaa_commit_provision', { ...cbase, action: 'revise', id: c5.data.id });
    ok(lk.code === 'invalid' && /started/.test(lk.message) && rv.ok && rvRow.version === 2 && rvRow.hr_status === 'pending' && rvRow.history.length === 2 && rvRow.delivery.length === pcA.delivery.length
      && wd1.code === 'invalid' && wd2.ok && wd2.data.status === 'withdrawn' && wd3.code === 'withdrawn',
    'commitProvision: started terms keep their seats; a revision bumps the version, keeps the delivery reports and asks ENEC to review again; a withdrawal needs a reason and stays visible');
    // delivery
    const curTerm = (D.provider_commitments.find((c) => c.id === 'pc-org-alnoor-2').plan.find((x) => termState(x.term, today) === 'current') ?? {}).term;
    const d1 = curTerm ? await call('alnoor-gm', 'kafaa_report_commitment_delivery', { commitment_id: 'pc-org-alnoor-2', term: curTerm, enrolled: 18, completed: 0 }) : { ok: true, data: {} };
    const d2 = await call('alnoor-gm', 'kafaa_report_commitment_delivery', { commitment_id: 'pc-org-alnoor-2', term: '2026S2', enrolled: 1, completed: 0 });
    const d3 = await call('alnoor-gm', 'kafaa_report_commitment_delivery', { commitment_id: 'pc-org-alnoor-1', term: '2025S2', enrolled: 5, completed: 6 });
    const d4 = await call('alnoor-qaqc', 'kafaa_report_commitment_delivery', { commitment_id: 'pc-org-alnoor-2', term: '2025S2', enrolled: 1, completed: 0 });
    const d5 = await call('k-university', 'kafaa_report_commitment_delivery', { commitment_id: 'pc-ku-3', term: '2025S2', enrolled: 30, completed: 29 });
    const row2 = fix((await q("select * from kafaa_provider_commitments where id = 'pc-org-alnoor-2'"))[0]);
    ok(d1.ok && (!curTerm || d1.data.status === commitmentView(row2, today).status) && d2.code === (termState('2026S2', today) === 'future' ? 'invalid' : 'ok') && d3.code === 'invalid' && d4.code === 'forbidden' && d5.ok,
      'reportCommitmentDelivery: the provider admin reports a started term (status recomputed = TS); future terms and completed above enrolled refused; partner users refused; the university reports its own');
    // review
    const v1 = await call('alnoor-gm', 'kafaa_review_commitment', { commitment_id: 'pc-org-alnoor-2', decision: 'acknowledged' });
    const v2 = await call('chco', 'kafaa_review_commitment', { commitment_id: 'pc-org-alnoor-2', decision: 'queried' });
    const v3 = await call('chco', 'kafaa_review_commitment', { commitment_id: 'pc-org-alnoor-2', decision: 'queried', note: 'Please confirm the start date.' });
    const v4 = await call('k-hr-analyst', 'kafaa_review_commitment', { commitment_id: 'pc-org-liwa-1', decision: 'acknowledged' });
    ok(v1.code === 'forbidden' && v2.code === 'invalid' && v3.ok && v3.data.hr_status === 'queried' && v4.code === 'withdrawn', 'reviewCommitment: HR only; a query needs a note; a withdrawn commitment cannot be reviewed');
    // pledges
    const pin = { area: 'quality', people: 20, target_date: '2028-06-30', title_en: 'Inspection skills for machinists', title_ar: 'مهارات الفحص للعاملين في التشغيل' };
    const p1 = await call('alnoor-gm', 'kafaa_register_pledge', pin);
    const p1a = await lastAudit('pledge.register');
    const p2 = await call('alnoor-gm', 'kafaa_register_pledge', { ...pin, org_id: 'org-gulfhydro' });
    const p3 = await call('chco', 'kafaa_register_pledge', { ...pin, org_id: 'enec-ops', department_en: 'Maintenance training', department_ar: 'تدريب الصيانة' });
    const p4 = await call('chco', 'kafaa_register_pledge', { ...pin, org_id: 'org-alnoor' });
    const p5 = await call('sro', 'kafaa_register_pledge', pin);
    const p6 = await call('alnoor-qaqc', 'kafaa_register_pledge', pin);
    const p7 = await call('gulfhydro-qa', 'kafaa_register_pledge', { ...pin, people: 0 });
    const nA = D.pledges.filter((p) => p.org_id === 'org-alnoor').length;
    ok(p1.ok && p1.data.id === `pl-org-alnoor-${nA + 1}` && p1a.ledger_status === 'written' && p2.code === 'org' && p3.ok && p4.code === 'org' && p5.code === 'forbidden' && p6.code === 'forbidden' && p7.code === 'invalid',
      'registerPledge: partner admins for their own organisation, HR for ENEC entities only (audit + ledger); staff and partner users refused; bad numbers refused');
    const g1 = await call('alnoor-gm', 'kafaa_record_pledge_progress', { pledge_id: p1.data.id, as_of: today, started: 4, completed: 0 });
    const g2 = await call('alnoor-gm', 'kafaa_record_pledge_progress', { pledge_id: 'pl-org-alnoor-1', as_of: today, started: 14, completed: 9 });
    const g3 = await call('gulfhydro-qa', 'kafaa_record_pledge_progress', { pledge_id: 'pl-org-alnoor-1', as_of: today, started: 20, completed: 10 });
    const g4 = await call('chco', 'kafaa_record_pledge_progress', { pledge_id: 'pl-enec-ops-1', as_of: today, started: 1180, completed: 1010 });
    const g5 = await call('chco', 'kafaa_record_pledge_progress', { pledge_id: 'pl-org-alnoor-1', as_of: today, started: 20, completed: 10 });
    const ex4 = D.pledges.find((p) => p.id === 'pl-enec-ops-1');
    ok(g1.ok && g1.data.status === 'in_progress' && g2.code === 'invalid' && /go down/.test(g2.message) && g3.code === 'not_found' && g4.ok && g4.data.status === (1010 >= ex4.people ? 'met' : ex4.target_date < today ? 'lapsed' : 'in_progress') && g5.code === 'not_found',
      'recordPledgeProgress: own organisation only (another organisation\'s pledge reads as not found); started and completed never go down; HR records ENEC entities only');
    const lg1 = (await one('buyer', 'select kafaa_pledge_ledger() r')).r;
    const lg2 = (await one('alnoor-qaqc', 'select kafaa_pledge_ledger() r')).r;
    const lg3 = (await one('k-observer', 'select kafaa_pledge_ledger() r')).r;
    const Dn = { pledges: (await rows('pledges')), progress: (await rows('pledge_progress')) };
    const txt = JSON.stringify(lg2.data);
    ok(lg1.ok && same(lg1.data, pledgeLedger({ pledges: Dn.pledges, progress: Dn.progress, orgs: Object.fromEntries(Dn.pledges.map((p) => [p.org_id, p.org_kind])) }, today)) && lg2.ok && lg3.code === 'forbidden'
      && !/org-(alnoor|gulfhydro)|"ku"|pl-/.test(txt), 'pledgeLedger: staff and partner users read the aggregate ledger (TS = SQL), which names no organisation and no pledge; observers are refused');
  } finally {
    await db.exec('rollback');
  }

  // ── additivity, function bodies and table digests (for the live comparison)
  const text = readFileSync(MIG, 'utf8');
  ok(!/\b(drop|delete|truncate)\b/i.test(text) && !/\balter\s+table\s+(?!kafaa_)/i.test(text) && DEMAND_AREAS.length === 12, 'additive: the FS73 migration never names a destructive statement and alters only kafaa_* tables');
  const md5s = await q(`select p.proname, md5(p.prosrc) m from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any($1) order by 1`, [FUNCS]);
  ok(md5s.length === FUNCS.length, `functions: ${md5s.length} new function bodies present`);
  console.log(`    md5 ${md5s.map((r) => `${r.proname}=${r.m.slice(0, 8)}`).join(' ')}`);
  for (const t of [...TABLES, 'organisations']) {
    const w = t === 'organisations' ? "where x.id in ('org-dhafra-tech', 'org-ruwais-vti')" : '';
    const d = (await q(`select count(*)::int n, left(md5(string_agg(to_jsonb(x)::text, '|' order by x.id)), 8) dg from kafaa_${t} x ${w}`))[0];
    console.log(`    digest kafaa_${t}${w ? ' (2 new synthetic providers)' : ''} ${d.n} ${d.dg}`);
  }
}
