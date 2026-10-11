// [FS wave E · E4 · FS46 + FS47 + FS48] PGlite checks for 20261010254001_kafaa_fs54_future_leadership.sql: the seeded rows load unchanged
// (row digests = seed.json); SQL = TS for the 360 summary (both form versions), the form-1 HR view, the form-2 programme view, the
// Future Leaders readiness and statistics, the network statistics and the sheet validator; RLS (reference rows public, staff rows staff,
// opt-in rows the person only, HR none); FS46 acceptance (form-1 results stay readable, aggregates under 10 suppressed, anchors at every
// point EN/AR); FS47 acceptance (descriptors + learning route per competency, external programmes with sources and dates, nomination
// and selection through RPCs with audit rows, statistics suppressed); FS48 acceptance (opt-in, withdrawal leaves no trace in any ranking,
// aggregates suppressed, HR never sees individuals); one audit row per call; ledger rows only on selection, completion and placement;
// grants; additive SQL. Flows run inside a rolled-back transaction, so later validators see the seeded state.
import { readFileSync } from 'node:fs';
import { BEHAVIOUR_IDS, BEHAVIOUR_IDS_V2, FUTURE_BEHAVIOUR_IDS, computeLeadershipStats, summarise360, validScores } from '../../src/modules/m22/domain.ts';
import { FL_MSG, FL_PROGRAMME_ID, WFN_MSG, computeFlStats, computeProgrammeStats, flCohortFor, flReadiness, rankCircles, rankOffers, wfnStats } from '../../src/modules/m22/future.ts';

const canon = (x) => (Array.isArray(x) ? x.map(canon) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, canon(x[k])])) : x);
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const d10 = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? null : String(v).slice(0, 10));
const iso = (v) => (v instanceof Date ? v.toISOString().replace('.000Z', 'Z') : v);
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const MINE = '20261010254001_kafaa_fs54_future_leadership.sql';
const area = (x) => ({ en: x, ar: x });

export default async function fs54Checks({ db, one, count, ok, uid }) {
  const T = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables;
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  const norm = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v instanceof Date ? (k.endsWith('_on') || k === 'starts_on' || k === 'ends_on' || k === 'closes_on' ? d10(v) : iso(v)) : v]));
  const rows = async (t, where = 'true') => (await q(`select * from kafaa_${t} where ${where} order by id`)).map(norm);
  let n = 5440;
  for (const p of ['k-ro', 'qc-inspector', 'nse', 'outage-planner', 'sq-lead', 'alnoor-gm']) {
    if (uid[p]) continue;
    uid[p] = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[p], `${p}@test`, p, p.startsWith('alnoor') ? 'org-alnoor' : 'enec-ops', p.startsWith('alnoor') ? 'partner' : 'employee', ['Staff']]);
  }

  // ── seed digests (the new tables, the FS47 nominations and the form-2 360 rows)
  const pickCols = (cols) => (r) => Object.fromEntries(cols.map((c) => [c, r[c] ?? null]));
  const digest = async (t, seedRows, where = 'true') => {
    const db1 = await rows(t, where);
    const cols = Object.keys(seedRows[0] ?? {}).filter((c) => !['created_at', 'updated_at', 'invited_at', 'submitted_at', 'decided_at'].includes(c));
    return [t, db1.length, same(db1.map(pickCols(cols)), [...seedRows].sort(byId).map(pickCols(cols)))];
  };
  const dig = [];
  for (const t of ['leadership_behaviours', 'fl_competencies', 'fl_external', 'fl_cohorts', 'fl_participants', 'wfn_programmes', 'wfn_participants', 'wfn_circles', 'wfn_circle_members', 'wfn_offers', 'wfn_requests']) dig.push(await digest(t, T[t]));
  dig.push(await digest('leadership_nominations', T.leadership_nominations.filter((x) => x.programme_id === FL_PROGRAMME_ID), `programme_id = '${FL_PROGRAMME_ID}'`));
  dig.push(await digest('leadership_360_requests', T.leadership_360_requests.filter((x) => x.form_version === 2), 'form_version = 2'));
  dig.push(await digest('leadership_360', T.leadership_360.filter((x) => x.form_version === 2), 'form_version = 2'));
  const v1n = Number((await q(`select count(*)::int n from kafaa_leadership_360 where form_version = 1`))[0].n);
  ok(dig.every((x) => x[2]) && v1n === T.leadership_360.filter((x) => x.form_version === 1).length && dig.find((x) => x[0] === 'leadership_360')[1] > 50,
    `the seeded rows load unchanged (row digest = seed.json): ${dig.map(([t, k, s]) => `${t} ${k}${s ? '' : ' DIFF'}`).join(', ')}; ${v1n} form-1 responses keep version 1`);

  // ── FS46 acceptance: anchors at every rating point in EN and AR
  const beh = (await rows('leadership_behaviours')).sort((a, b) => a.sort - b.sort);
  const holes = beh.flatMap((b) => ['1', '2', '3', '4', '5'].flatMap((pt) => ['en', 'ar'].filter((l) => !(b.anchors?.[pt]?.[l] ?? '').trim()).map((l) => `${b.id}.${pt}.${l}`)));
  ok(beh.map((b) => b.id).join() === BEHAVIOUR_IDS_V2.join() && holes.length === 0 && FUTURE_BEHAVIOUR_IDS.every((id) => beh.find((b) => b.id === id)?.form_from === 2 && (beh.find((b) => b.id === id)?.coach?.tips ?? []).length >= 3),
    `acceptance (FS46): 12 behaviours in form-2 order, each with anchors at all five points in EN and AR (${holes.length} gaps); the four future behaviours carry coach cards`);

  // ── SQL = TS
  const reqs = (await rows('leadership_360_requests')).map((r) => ({ ...r, form_version: Number(r.form_version) }));
  const resps = (await rows('leadership_360')).map((r) => ({ ...r, form_version: Number(r.form_version) }));
  const people = await rows('people');
  const names = new Map(people.map((p) => [p.id, { name: p.display_name, name_ar: p.display_name_ar || p.display_name }]));
  const sumDiff = [];
  const subjects = [...new Set(reqs.map((r) => r.subject_id))].sort();
  let v2seen = 0;
  for (const s of subjects) for (const c of [null, '2026-H1', '2026-H2']) {
    const sq = (await q('select kafaa_lead_360_summary($1, $2) j', [s, c]))[0].j;
    const ts = summarise360(s, c, reqs, resps, names);
    if (ts.form_version === 2 && ts.enough) v2seen++;
    if (!same(sq, ts)) sumDiff.push(`${s}/${c}`);
  }
  ok(sumDiff.length === 0 && v2seen >= 10, `kafaa_lead_360_summary = summarise360 for ${subjects.length} subjects x 3 cycle choices, both form versions (${v2seen} form-2 views with results)${sumDiff.length ? ` DIFF ${sumDiff.slice(0, 4)}` : ''}`);
  const qc = summarise360('p-qc-inspector', null, reqs, resps, names);
  const qcH1 = summarise360('p-qc-inspector', '2026-H1', reqs, resps, names);
  ok(qc.form_version === 2 && qc.behaviours?.length === 12 && qcH1.form_version === 1 && qcH1.behaviours?.length === 8 && qcH1.cycles.includes('2026-H2'),
    'acceptance (FS46): old 360 results stay readable under version 1 (qc-inspector 2026-H1: 8 behaviours) next to a form-2 cycle (2026-H2: 12)');
  const nomsDb = await rows('leadership_nominations');
  const stSql = (await q('select kafaa_lead_stats_compute() j'))[0].j;
  const stTs = computeLeadershipStats(resps, people, nomsDb, 10);
  ok(same(stSql, stTs) && stTs.cycle === '2026-H1', `the form-1 HR view = computeLeadershipStats (form 1 only; cycle ${stTs.cycle})`);
  const progIds = (await q(`select id from kafaa_leadership_programmes order by sort, id collate "C"`)).map((r) => r.id);
  const psSql = (await q('select kafaa_fs54_programme_stats_compute() j'))[0].j;
  const psTs = computeProgrammeStats(resps, nomsDb, progIds, BEHAVIOUR_IDS_V2, 10);
  const flRow = psTs.rows.find((r) => r.programme_id === FL_PROGRAMME_ID);
  ok(same(psSql, psTs) && psTs.all.subjects >= 10 && flRow && !flRow.suppressed && psTs.rows.some((r) => r.suppressed && r.subjects === null && r.scores === null)
    && psTs.rows.every((r) => r.suppressed || r.subjects >= 10),
    `acceptance (FS46): the form-2 programme view = computeProgrammeStats; cells under 10 subjects suppressed (Future Leaders ${flRow?.subjects}, all ${psTs.all.subjects})`);
  const sheets = [[Object.fromEntries(BEHAVIOUR_IDS.map((b) => [b, 3])), 1], [Object.fromEntries(BEHAVIOUR_IDS.map((b) => [b, 3])), 2], [Object.fromEntries(BEHAVIOUR_IDS_V2.map((b) => [b, 4])), 2],
    [Object.fromEntries(BEHAVIOUR_IDS_V2.map((b) => [b, 4])), 1], [{ ...Object.fromEntries(BEHAVIOUR_IDS_V2.map((b) => [b, 4])), 'b-inclusion': 6 }, 2], [{ ...Object.fromEntries(BEHAVIOUR_IDS_V2.map((b) => [b, 4])), 'b-ai-teams': 2.5 }, 2]];
  const shDiff = [];
  for (const [s, v] of sheets) { const sq = (await q('select kafaa_lead_scores_v($1::jsonb, $2) j', [JSON.stringify(s), v]))[0].j; if (!same(sq, validScores(s, v))) shDiff.push(v); }
  const cohortDiff = [];
  for (const c of ['2024-H2', '2025-H1', '2026-H1', '2026-H2']) if ((await q('select kafaa_fl_cohort_for($1) c', [c]))[0].c !== flCohortFor(c)) cohortDiff.push(c);
  ok(shDiff.length === 0 && cohortDiff.length === 0, 'kafaa_lead_scores_v = validScores for both versions (missing, extra, out-of-range and non-integer scores refused); kafaa_fl_cohort_for = flCohortFor');
  const comps = await rows('fl_competencies');
  const states = (await rows('person_skills', 'active'));
  const lv = new Map();
  for (const s of states) { if (!lv.has(s.person_id)) lv.set(s.person_id, new Map()); lv.get(s.person_id).set(s.skill_id, { level: s.level }); }
  const staffIds = people.filter((p) => p.kind === 'staff').map((p) => p.id);
  const rdDiff = [];
  for (const pid of staffIds) { const sq = (await q('select kafaa_fl_readiness_of($1) j', [pid]))[0].j; if (!same(sq, flReadiness(pid, lv.get(pid) ?? new Map(), comps))) rdDiff.push(pid); }
  ok(rdDiff.length === 0 && staffIds.length > 100, `kafaa_fl_readiness_of = flReadiness for all ${staffIds.length} staff${rdDiff.length ? ` DIFF ${rdDiff.slice(0, 4)}` : ''}`);
  const parts = await rows('fl_participants');
  const cohorts = await rows('fl_cohorts');
  const flSql = (await q('select kafaa_fl_stats_compute() j'))[0].j;
  const flTs = computeFlStats(nomsDb, parts, cohorts, 10);
  ok(same(flSql, flTs) && flTs.cohorts.find((c) => c.id === 'flc-2025').suppressed && flTs.cohorts.find((c) => c.id === 'flc-2026').participants === 12 && flTs.nominations.some((x) => x.suppressed && x.n === null),
    'acceptance (FS47): track statistics = computeFlStats; every count under 10 suppressed (2025 pilot of 8 suppressed, 2026 cohort of 12 shown)');
  const wfnInput = async () => {
    const chan = new Map((await q('select id, channel from kafaa_opportunities')).map((o) => [o.id, o.channel ?? null]));
    return {
      participants: await rows('wfn_participants'), members: await rows('wfn_circle_members'), circles: await rows('wfn_circles'), requests: await rows('wfn_requests'), people,
      academyMembers: await rows('academy_members'), gigApplications: (await rows('opportunity_applications')).map((a) => ({ person_id: a.person_id, status: a.status, channel: chan.get(a.opportunity_id) ?? null })),
      nominations: await rows('leadership_nominations'),
    };
  };
  const wsSql = (await q('select kafaa_wfn_stats_compute() j'))[0].j;
  const wsTs = wfnStats(await wfnInput(), 10);
  ok(same(wsSql, wsTs) && wsTs.network.participants >= 10 && wsTs.pipeline.find((r) => r.id === 'staff').share !== null && wsTs.pipeline.some((r) => r.suppressed && r.women === null && r.men === null && r.share === null)
    && wsTs.network.requests.every((r) => r.suppressed ? r.n === null : r.n >= 10),
    'acceptance (FS48): network statistics = wfnStats; every aggregate cell under 10 suppressed, gender only as a share per programme, suppressed whole when either group is under 10');

  // ── RLS
  ok(await count(null, 'kafaa_leadership_behaviours') === 12 && await count(null, 'kafaa_fl_competencies') === 5 && await count(null, 'kafaa_fl_external') === T.fl_external.length && await count(null, 'kafaa_wfn_programmes') === 3
    && await count(null, 'kafaa_fl_cohorts') === 0 && await count(null, 'kafaa_wfn_circles') === 0 && await count(null, 'kafaa_fl_participants') === 0 && await count(null, 'kafaa_wfn_participants') === 0,
    'RLS: anonymous visitors read the behaviours, competencies, external programmes and network strands only');
  ok(await count('sro', 'kafaa_wfn_circles') === T.wfn_circles.length && await count('sro', 'kafaa_wfn_offers') === T.wfn_offers.length && await count('sro', 'kafaa_fl_cohorts') === 3 && await count('alnoor-gm', 'kafaa_wfn_circles') === 0,
    'RLS: staff read cohorts, circles and offers; partners do not');
  const qcOwn = T.wfn_requests.filter((r) => r.person_id === 'p-qc-inspector').length;
  ok(await count('qc-inspector', 'kafaa_wfn_participants') === 1 && await count('qc-inspector', 'kafaa_wfn_requests') === qcOwn && await count('qc-inspector', 'kafaa_wfn_circle_members', `person_id <> kafaa_me()`) === 0
    && await count('chco', 'kafaa_wfn_participants') === 0 && await count('chco', 'kafaa_wfn_requests') === 0 && await count('k-hr-analyst', 'kafaa_wfn_circle_members') === 0
    && await count('training-mgr', 'kafaa_wfn_participants') === 0 && await count('k-auditor', 'kafaa_wfn_requests') === 0 && await count('k-admin', 'kafaa_wfn_participants') === 0,
    'acceptance (FS48): opt-in rows are readable by the person only: HR, the training manager, admins and auditors read none (aggregates and the owner desk come through RPCs)');
  ok(await count('qc-inspector', 'kafaa_fl_participants') === 1 && await count('chco', 'kafaa_fl_participants') === T.fl_participants.length && await count('training-mgr', 'kafaa_fl_participants') === T.fl_participants.length
    && await count('k-auditor', 'kafaa_fl_participants') === T.fl_participants.length && await count('nse', 'kafaa_fl_participants', `person_id <> kafaa_me()`) === 0,
    'RLS: a Future Leaders participant reads their own row; the HR authority, the training manager and auditors read the roster');

  // ── RPC flows (inside a transaction that is rolled back)
  const auditN = async () => Number((await q(`select count(*)::int n from kafaa_audit_events`))[0].n);
  const ledgerN = async () => Number((await q(`select count(*)::int n from ledger_entries`).catch(() => [{ n: 0 }]))[0].n);
  const call = async (p, sql, params = []) => { try { return (await one(p, `select ${sql} r`, params)).r; } catch (e) { console.log(`  ! ${p} ${sql}: ${e.message}`); throw e; } };
  const anon = await one(null, `select kafaa_set_wfn_optin('{}'::jsonb) r`).then(() => 'executed', (e) => String(e.message));
  ok(anon.includes('permission denied'), 'anonymous callers cannot execute the FS46-FS48 RPCs');
  await db.exec('begin');
  try {
    let calls = 0;
    const a0 = await auditN();
    const l0 = await ledgerN();
    const c = async (p, sql, params) => { calls++; return call(p, sql, params); };
    // FS46: a new cycle uses form 2; a cycle already started keeps its version; the sheet must match the version
    const cyc = (await q(`select kafaa_lead_cycle(current_date) c`))[0].c;
    const rq = await c('k-instructor', `kafaa_request_360($1::jsonb)`, [JSON.stringify(['w-ro-01', 'w-ro-02', 'w-ro-03', 'w-ro-04', 'w-ro-06'].map((id) => ({ person_id: id, kind: 'peer' })))]);
    const vers = await q(`select distinct form_version v from kafaa_leadership_360_requests where subject_id = 'p-k-instructor' and cycle = $1`, [cyc]);
    const more = await c('outage-planner', `kafaa_request_360($1::jsonb)`, [JSON.stringify([{ person_id: 'w-mnt-02', kind: 'peer' }])]);
    const opv = await q(`select distinct form_version v from kafaa_leadership_360_requests where subject_id = 'p-outage-planner' and cycle = '2026-H2'`);
    ok(rq.ok && vers.length === 1 && vers[0].v === 2 && (cyc !== '2026-H2' || (more.ok && opv.length === 1 && opv[0].v === 1)), `360 requests: a new cycle uses form 2; a cycle already started keeps form 1 (outage-planner ${cyc})`);
    const v1Sheet = JSON.stringify(Object.fromEntries(BEHAVIOUR_IDS.map((b) => [b, 4])));
    const v2Sheet = JSON.stringify(Object.fromEntries(BEHAVIOUR_IDS_V2.map((b) => [b, 4])));
    const kroReq = 'l3q-2026-H2-p-k-ro-p-sro';
    const s1 = await c('sro', `kafaa_submit_360($1, $2::jsonb)`, [kroReq, v2Sheet]);
    const s2 = await c('sro', `kafaa_submit_360($1, $2::jsonb)`, [kroReq, v1Sheet]);
    const v2Req = T.leadership_360_requests.find((x) => x.form_version === 2 && x.rater_id === 'p-k-ro' && x.status === 'invited');
    const s3 = await c('k-ro', `kafaa_submit_360($1, $2::jsonb)`, [v2Req.id, v1Sheet]);
    const s4 = await c('k-ro', `kafaa_submit_360($1, $2::jsonb)`, [v2Req.id, v2Sheet]);
    const stored = await q(`select form_version, scores from kafaa_leadership_360 where subject_id = $1 and cycle = '2026-H2' and form_version = 2 order by submitted_at desc limit 1`, [v2Req.subject_id]);
    ok(s1.code === 'invalid' && s2.ok && s3.code === 'invalid' && s4.ok && stored[0]?.form_version === 2 && Object.keys(stored[0].scores).length === 12,
      'acceptance (FS46): a form-1 request takes the eight-behaviour sheet only and a form-2 request the twelve-behaviour sheet; the response keeps its version');
    const gate = [await call('chco', 'kafaa_leadership_programme_stats()'), await call('k-auditor', 'kafaa_leadership_programme_stats()'), await call('training-mgr', 'kafaa_leadership_programme_stats()'),
      await call('sro', 'kafaa_leadership_programme_stats()'), await call('qc-inspector', 'kafaa_leadership_programme_stats()')];
    ok(gate.slice(0, 3).every((x) => x && x.form_version === 2) && gate.slice(3).every((x) => x === null), 'the programme view is for HR, the training manager and auditors only (null for line managers and staff)');

    // FS47: HR nominates; the F16 decision selects (maker-checker); modules, project, review, completion
    const n1 = await c('sro', `kafaa_nominate_future_leader($1, $2)`, ['w-ro-03', 'Ready for nuclear-management depth and cross-functional work.']);
    const n2 = await c('chco', `kafaa_nominate_future_leader($1, $2)`, ['p-chco', 'Ready for nuclear-management depth and cross-functional work.']);
    const n3 = await c('chco', `kafaa_nominate_future_leader($1, $2)`, ['p-k-ro', 'short']);
    const n4 = await c('k-hr-analyst', `kafaa_nominate_future_leader($1, $2)`, ['p-sq-lead', 'Ready for nuclear-management depth and cross-functional work.']);
    const n5 = await c('chco', `kafaa_nominate_future_leader($1, $2)`, ['p-k-ro', 'Leads crew turnovers well and explains decisions to visitors; ready for the 2027 cohort.']);
    const nrow = (await q(`select * from kafaa_leadership_nominations where id = $1`, [n5.data?.id]))[0];
    ok(n1.code === 'forbidden' && n1.message === FL_MSG.forbidden_nominate && n2.code === 'self_nominate' && n3.code === 'invalid' && n4.code === 'conflict' && n5.ok && nrow?.programme_id === FL_PROGRAMME_ID && nrow.nominated_by === 'p-chco'
      && n5.data.cohort_id === flCohortFor(nrow.cycle),
      'acceptance (FS47): nomination goes through an RPC: HR only (line managers refused), never yourself, a real reason, one open nomination per person');
    const lb = await ledgerN();
    const ab = await auditN();
    const d1 = await call('chco', `kafaa_decide_nomination($1, 'approved', '')`, [n5.data.id]);
    const d2 = await call('training-mgr', `kafaa_decide_nomination($1, 'approved', '')`, [n5.data.id]);
    ok(d1.code === 'maker_checker' && d2.ok && (await ledgerN()) === lb + 1 && (await auditN()) > ab && (await q(`select status from kafaa_leadership_nominations where id = $1`, [n5.data.id]))[0].status === 'approved',
      'acceptance (FS47): selection goes through the F16 decision RPC with an audit row and a ledger row; the nominator cannot select');
    const target = T.fl_participants.find((p) => p.cohort_id === 'flc-2026' && p.project_status === 'submitted' && p.person_id !== 'p-qc-inspector');
    const m1 = await c('chco', `kafaa_record_fl_module($1, $2, true)`, [target.nomination_id, 'flm-project']);
    const m2 = await c('training-mgr', `kafaa_record_fl_module($1, $2, true)`, [n5.data.id, 'flm-safety']);
    const m3 = await c('training-mgr', `kafaa_record_fl_module($1, $2, true)`, [target.nomination_id, 'flm-nope']);
    let last;
    for (const m of ['flm-safety', 'flm-regulation', 'flm-project', 'flm-stakeholder', 'flm-knowledge', 'flm-future']) last = await c('training-mgr', `kafaa_record_fl_module($1, $2, true)`, [target.nomination_id, m]);
    ok(m1.code === 'forbidden' && m2.code === 'invalid' && m2.message === FL_MSG.not_running && m3.code === 'invalid' && last.ok && last.data.modules_done.length === 6,
      'modules: the training manager records them for running cohorts only and known modules only');
    const p1 = await c('qc-inspector', `kafaa_save_policy_project($1::jsonb)`, [JSON.stringify({ nomination_id: T.fl_participants.find((p) => p.person_id === 'p-qc-inspector').nomination_id, title: 'x', question: 'A good question for the sponsor?', summary: 'A long enough summary of the paper.', sponsor_role: 'Head of Quality' })]);
    const qcNom = T.fl_participants.find((p) => p.person_id === 'p-qc-inspector').nomination_id;
    const base = { nomination_id: qcNom, title: 'Supplier quality for factory modules', question: 'Which controls must move into the factory?', summary: 'This paper compares inspection approaches and proposes three options.', sponsor_role: 'Head of Supplier Quality (role card)' };
    const p2 = await c('qc-inspector', `kafaa_save_policy_project($1::jsonb)`, [JSON.stringify({ ...base, summary: 'This paper maps the perimeter guard posts and proposes options.' })]);
    const p3 = await c('qc-inspector', `kafaa_save_policy_project($1::jsonb)`, [JSON.stringify({ ...base, summary: 'Contact me at someone@example.org for the draft paper and options.' })]);
    const p4 = await c('nse', `kafaa_save_policy_project($1::jsonb)`, [JSON.stringify(base)]);
    const p5 = await c('qc-inspector', `kafaa_save_policy_project($1::jsonb)`, [JSON.stringify({ ...base, submit: true })]);
    const p6 = await c('k-ro', `kafaa_save_policy_project($1::jsonb)`, [JSON.stringify({ ...base, nomination_id: n5.data.id })]);
    const lazy = (await q(`select * from kafaa_fl_participants where nomination_id = $1`, [n5.data.id]))[0];
    ok(p1.code === 'invalid' && p1.message === FL_MSG.title && p2.code === 'restricted_content' && p3.code === 'contact_details' && p4.code === 'forbidden' && p5.ok && p5.data.project_status === 'submitted'
      && p6.ok && lazy?.cohort_id === 'flc-2027' && lazy.project_status === 'draft',
      'policy projects: the participant only, screened like community posts (security content and contact details refused); a first save creates the participant row');
    const r0 = await c('qc-inspector', `kafaa_review_policy_project($1, 'accept', '')`, [qcNom]);
    const r1 = await c('training-mgr', `kafaa_review_policy_project($1, 'return', 'no')`, [qcNom]);
    const r2 = await c('training-mgr', `kafaa_review_policy_project($1, 'accept', '')`, [qcNom]);
    const lc = await ledgerN();
    const r3 = await c('chco', `kafaa_review_policy_project($1, 'accept', '')`, [target.nomination_id]);
    const tn = (await q(`select status from kafaa_leadership_nominations where id = $1`, [target.nomination_id]))[0];
    const tp = (await q(`select status, project_status from kafaa_fl_participants where nomination_id = $1`, [target.nomination_id]))[0];
    await db.query(`insert into kafaa_leadership_nominations (id, person_id, programme_id, nominated_by, reason, cycle, status) values ('ln-fl-t1', 'p-training-mgr', 'prog-future-leaders', 'p-chco', 'Test nomination of the reviewer', '2026-H1', 'approved')`);
    await db.query(`insert into kafaa_fl_participants (id, nomination_id, person_id, cohort_id, project_status) values ('flp:ln-fl-t1', 'ln-fl-t1', 'p-training-mgr', 'flc-2026', 'submitted')`);
    const r4 = await c('training-mgr', `kafaa_review_policy_project('ln-fl-t1', 'accept', '')`);
    ok(r0.code === 'forbidden' && r1.code === 'invalid' && r1.message === FL_MSG.return_note && r2.ok && !r2.data.completed && r3.ok && r3.data.completed && tn.status === 'completed' && tp.status === 'completed'
      && (await ledgerN()) === lc + 1 && r3.ledger_seq != null && r4.code === 'maker_checker',
      'reviews: the training manager or HR authority, never their own project; acceptance with every module done completes the track (nomination completed, one ledger row)');
    const rd0 = await call('qc-inspector', `kafaa_fl_readiness($1::text[])`, [['p-qc-inspector', 'p-sq-lead']]);
    const aR = await auditN();
    const rd1 = await call('chco', `kafaa_fl_readiness($1::text[])`, [['p-qc-inspector', 'p-sq-lead', 'w-ro-01']]);
    ok(rd0.length === 1 && rd0[0].person_id === 'p-qc-inspector' && rd1.map((x) => x.person_id).join() === 'p-qc-inspector,p-sq-lead' && (await auditN()) === aR + 1,
      'readiness: staff see their own; the HR authority sees Future Leaders nominees only (a non-nominee is left out), and the read is audited');
    const fg = [await call('k-auditor', 'kafaa_future_leaders_stats()'), await call('sro', 'kafaa_future_leaders_stats()')];
    ok(fg[0] && fg[1] === null, 'acceptance (FS47): track statistics are for HR, the training manager and auditors (null for others)');

    // FS48: opt-in, circles, requests, decisions, withdrawal without trace
    const before = await wfnInput();
    const other = before.participants.find((p) => p.person_id === 'p-nse');
    const rankC0 = rankCircles(other, before.circles, before.members, area);
    const rankO0 = rankOffers(other, await rows('wfn_offers'), before.requests, '2026-10-08', area);
    const stats0 = wfnStats(before, 10);
    const w0 = await c('alnoor-gm', `kafaa_set_wfn_optin($1::jsonb)`, [JSON.stringify({ active: true, interests: ['ai_data'], strands: ['circles'] })]);
    const w1 = await c('k-ro', `kafaa_set_wfn_optin($1::jsonb)`, [JSON.stringify({ active: true, interests: ['nope'], strands: ['circles'] })]);
    const w2 = await c('k-ro', `kafaa_set_wfn_optin($1::jsonb)`, [JSON.stringify({ active: true, interests: ['advanced_reactor', 'ai_data'], strands: [] })]);
    const j0 = await c('k-ro', `kafaa_join_wfn_circle('wc-ai', true)`);
    const w3 = await c('k-ro', `kafaa_set_wfn_optin($1::jsonb)`, [JSON.stringify({ active: true, interests: ['advanced_reactor', 'ai_data'], strands: ['circles', 'visiting', 'sponsored'] })]);
    const j1 = await c('k-ro', `kafaa_join_wfn_circle('wc-smr', true)`);
    const j2 = await c('k-ro', `kafaa_join_wfn_circle('wc-ai', true)`);
    const j3 = await c('k-ro', `kafaa_join_wfn_circle('wc-pilot-2025', true)`);
    ok(w0.code === 'forbidden' && w1.code === 'invalid' && w1.message === WFN_MSG.interests && w2.message === WFN_MSG.strands && j0.code === 'forbidden' && j0.message === WFN_MSG.not_opted_in && w3.ok
      && j1.code === 'conflict' && j2.ok && j2.data.role === 'member' && j3.code === 'invalid',
      'acceptance (FS48): participation is opt-in (staff only, valid areas and ways to take part); circles need an opt-in, a free seat and an active circle');
    const o0 = await c('k-ro', `kafaa_request_wfn_offer('wo-visit-hub', $1)`, ['I want to learn knowledge management on real work with a partner team.']);
    const o1 = await c('k-ro', `kafaa_request_wfn_offer('wo-visit-smr', 'too short')`);
    const o2 = await c('k-ro', `kafaa_request_wfn_offer('wo-visit-smr', $1)`, ['Please call me on +971 50 123 4567 to discuss this placement and my plans.']);
    const ids = [];
    for (const o of ['wo-visit-smr', 'wo-study-data', 'wo-study-ntm']) ids.push(await c('k-ro', `kafaa_request_wfn_offer($1, $2)`, [o, 'I want to build this future skill on real work and bring it back to my crew.']));
    const o3 = await c('k-ro', `kafaa_request_wfn_offer('wo-study-h2', $1)`, ['I want to build this future skill on real work and bring it back to my crew.']);
    const o4 = await c('k-ro', `kafaa_request_wfn_offer('wo-visit-smr', $1)`, ['I want to build this future skill on real work and bring it back to my crew.']);
    ok(o0.code === 'invalid' && o0.message === WFN_MSG.offer_closed && o1.code === 'invalid' && o2.code === 'contact_details' && ids.every((x) => x.ok) && o3.code === 'limit' && o4.code === 'conflict',
      'requests: open offers only, a 20-600 character statement without contact details, one open request per offer, three open requests at most');
    const rid = ids[0].data.id;
    const x0 = await c('sro', `kafaa_decide_wfn_request($1, 'shortlist', '', null)`, [rid]);
    const x1 = await c('training-mgr', `kafaa_decide_wfn_request($1, 'place', '', null)`, [rid]);
    const x2 = await c('training-mgr', `kafaa_decide_wfn_request($1, 'shortlist', '', null)`, [rid]);
    const lp = await ledgerN();
    const x3 = await c('training-mgr', `kafaa_decide_wfn_request($1, 'place', '', null)`, [rid]);
    const lp2 = await ledgerN();
    const x4 = await c('training-mgr', `kafaa_decide_wfn_request($1, 'complete', '', null)`, [rid]);
    const x5 = await c('training-mgr', `kafaa_decide_wfn_request($1, 'complete', '', 'progressed')`, [rid]);
    const x6 = await c('training-mgr', `kafaa_decide_wfn_request($1, 'decline', 'no', null)`, [ids[1].data.id]);
    ok(x0.code === 'forbidden' && x1.code === 'invalid' && x1.message === WFN_MSG.transition && x2.ok && x3.ok && lp2 === lp + 1 && x3.ledger_seq != null && x4.code === 'invalid' && x4.message === WFN_MSG.outcome && x5.ok && x6.code === 'invalid',
      'decisions: the programme owner (training manager) only, in order (shortlist, place, complete with an outcome); a placement writes one ledger row; a decline needs a note');
    const desk = await call('training-mgr', 'kafaa_wfn_desk()');
    const deskHr = await call('chco', 'kafaa_wfn_desk()');
    const wst = [await call('chco', 'kafaa_wfn_stats()'), await call('k-auditor', 'kafaa_wfn_stats()'), await call('sro', 'kafaa_wfn_stats()'), await call('qc-inspector', 'kafaa_wfn_stats()')];
    ok(desk.length > 10 && desk.some((r) => r.id === rid) && deskHr.length === 0 && wst[0] && wst[1] && wst[2] === null && wst[3] === null && JSON.stringify(wst[0]).indexOf('person_id') === -1,
      'acceptance (FS48): HR gets aggregates only (no person in the payload) and never the request desk; the programme owner sees requests made to offers; staff and line managers get neither');
    const wd = await c('k-ro', `kafaa_set_wfn_optin('{"active": false}'::jsonb)`);
    const after = await wfnInput();
    const kro = after.participants.find((p) => p.person_id === 'p-k-ro');
    const rankC1 = rankCircles(other, after.circles, after.members, area);
    const rankO1 = rankOffers(other, await rows('wfn_offers'), after.requests, '2026-10-08', area);
    const stats1 = wfnStats(after, 10);
    const sqlStats1 = (await q('select kafaa_wfn_stats_compute() j'))[0].j;
    ok(wd.ok && kro && !kro.active && kro.interests.length === 0 && kro.strands.length === 0 && !kro.mentor && after.members.filter((m) => m.person_id === 'p-k-ro' && m.active).length === 0
      && after.requests.filter((r) => r.person_id === 'p-k-ro' && ['interested', 'shortlisted'].includes(r.status)).length === 0
      && same(rankC0, rankC1) && same(rankO0, rankO1) && same(stats0, stats1) && same(sqlStats1, stats1),
      'acceptance (FS48): withdrawal leaves no trace in any ranking: choices blanked, memberships ended, open requests withdrawn; another participant\'s circle and offer rankings and the network statistics equal the state before the opt-in');
    const a1 = await auditN();
    const acts = await q(`select action from (select * from kafaa_audit_events order by seq desc limit ${a1 - a0}) t`);
    const own = acts.filter((x) => !['leadership.decide', 'insert:kafaa_notifications', 'future_leaders.readiness_read'].includes(x.action)).length;
    const notes = acts.filter((x) => x.action === 'insert:kafaa_notifications').length;
    ok(own === calls && acts.filter((x) => x.action === 'future_leaders.readiness_read').length === 1 && notes <= 8,
      `every FS46-FS48 call wrote exactly one audit row (${calls} calls); the ${notes} notification rows come from the F16 helper kafaa_lead_notify used by the 360 request and the F16 decision, unchanged`);
    ok((await ledgerN()) === l0 + 3, 'ledger rows only for the selection, the track completion and the placement');
  } finally { await db.exec('rollback'); }

  // ── engine card, grants and additive SQL
  const card = (await q(`select version, scoring_functions, inputs_used from kafaa_engine_cards where id = 'mentoring'`))[0];
  ok(card.version === 2 && card.scoring_functions.includes('src/modules/m22/future.ts#rankCircles') && card.scoring_functions.includes('src/modules/m22/future.ts#rankOffers') && card.inputs_used.some((x) => x.key === 'wfn_participants'),
    'the F13 mentoring engine card (F24) lists the FS48 ranking functions (version 2)');
  const rpcs = ['kafaa_decide_wfn_request', 'kafaa_fl_readiness', 'kafaa_future_leaders_stats', 'kafaa_join_wfn_circle', 'kafaa_leadership_programme_stats', 'kafaa_nominate_future_leader', 'kafaa_record_fl_module',
    'kafaa_request_360', 'kafaa_request_wfn_offer', 'kafaa_review_policy_project', 'kafaa_save_policy_project', 'kafaa_set_wfn_optin', 'kafaa_submit_360', 'kafaa_wfn_desk', 'kafaa_wfn_stats'];
  const helpers = ['kafaa_lead_form_ids', 'kafaa_lead_scores_v', 'kafaa_fs54_stats_gate', 'kafaa_fs54_cell', 'kafaa_fs54_programme_stats_compute', 'kafaa_fl_cohort_for', 'kafaa_fs54_ts', 'kafaa_fs54_hist', 'kafaa_fs54_notify',
    'kafaa_fl_readiness_of', 'kafaa_fl_stats_compute', 'kafaa_fs54_participant', 'kafaa_fs54_gender_row', 'kafaa_wfn_stats_compute', 'kafaa_lead_360_summary', 'kafaa_lead_stats_compute'];
  const exec = await q(`select p.proname, has_function_privilege('anon', p.oid, 'execute') anon, has_function_privilege('authenticated', p.oid, 'execute') auth from pg_proc p where p.proname = any($1)`, [[...rpcs, ...helpers]]);
  ok(exec.length === rpcs.length + helpers.length && exec.every((x) => !x.anon) && exec.filter((x) => x.auth).map((x) => x.proname).sort().join() === [...rpcs].sort().join(),
    `anon executes none of the FS46-FS48 functions; authenticated only the ${rpcs.length} RPCs`);
  const sqlText = readFileSync(`supabase/migrations/${MINE}`, 'utf8');
  const code = sqlText.replace(/--.*$/gm, '');
  ok(!/\b(drop|truncate|delete)\b/i.test(sqlText) && [...code.matchAll(/\b(?:alter|create)\s+(?:table|policy|function|or replace function|index if not exists|unique index if not exists|trigger)\s+(?:if not exists\s+)?(?:kafaa_read\s+on\s+)?([a-z_]+)/gi)].every((m) => m[1].startsWith('kafaa_'))
    && [...code.matchAll(/\bupdate\s+([a-z_]+)\s+set\b/gi)].every((m) => m[1].startsWith('kafaa_')),
    'the migration only touches kafaa_* objects and never uses DROP, DELETE or TRUNCATE (not even in comments)');
}
