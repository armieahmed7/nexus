// [W3 · E1] PGlite checks for 20261009131001_kafaa_w3e1_talent.sql (F18 Talent review, F19 Succession planning): SQL = TS parity
// of the evidence index (every staff member), terciles and outlier flags, potential anchors, development actions, cycle membership,
// HR aggregates, succession hard gates / readiness / reasons (every candidate of every slate), slate flags and succession aggregates;
// RLS (confidential: HR director only directly; managers and HR BP through RPCs; never their own placement; employees, auditors,
// partners nothing); the RPC flows with every F18/F19 acceptance case (scope, locked cycle, maker-checker, outlier flags, suppression,
// ready-now hard gates, roll-up into M07 critical_roles with audit + ledger).
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

export default async function w3e1Checks({ db, as, one, count, ok, uid }) {
  const D = await import('../../src/modules/m23/domain.ts');
  const { careerReadiness } = await import('../../src/modules/m18/career.ts');
  const seed = JSON.parse(readFileSync('src/seed/seed.json', 'utf8'));
  const T = seed.tables;
  const now = seed.meta.demo_today;
  let n = 1310;
  for (const [persona, role] of [['k-ro', 'Reactor Operator'], ['qc-inspector', 'QC Inspector'], ['ops-ceo', 'Operations CEO'], ['emergency-director', 'Emergency Director'], ['head-sq', 'Head of Supplier Quality'], ['group-ceo', 'Group CEO']]) {
    const row = (await db.query('select user_id from profiles where persona_id = $1', [persona])).rows[0];
    if (row) { uid[persona] = row.user_id; continue; }
    uid[persona] = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, 'enec-ops', 'employee', [role]]);
  }
  const norm = (x) => JSON.stringify(x, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((kk) => [kk, v[kk]])) : v));

  // ── parity on a fresh database (pristine seed)
  const fresh = new PGlite();
  await fresh.exec(readFileSync('supabase/tests/nexus_stubs.sql', 'utf8'));
  for (const m of readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()) await fresh.exec(readFileSync(`supabase/migrations/${m}`, 'utf8'));
  await fresh.exec(readFileSync('supabase/seed.sql', 'utf8'));
  const q1 = async (sql, params) => (await fresh.query(sql, params)).rows[0];
  const staff = T.people.filter((p) => p.kind === 'staff');
  const evIn = (pid) => ({ states: T.person_skills.filter((s) => s.person_id === pid), evidence: T.skill_evidence.filter((e) => e.person_id === pid), skills: T.skills });

  let evDiff = 0, evFirst = '';
  for (const p of staff) {
    for (const d of [now, '2026-05-15']) {
      const sql = (await q1('select kafaa_tr_evidence($1, $2::date) as r', [p.id, d])).r;
      if (norm(sql) !== norm(D.evidenceOf(evIn(p.id), d))) { evDiff++; if (!evFirst) evFirst = `${p.id}@${d}`; }
    }
  }
  const idx = staff.map((p) => D.evidenceOf(evIn(p.id), now).index);
  ok(evDiff === 0 && Math.max(...idx) > 60 && Math.min(...idx) < 20, `evidence index: SQL equals TS for ${staff.length} staff × 2 dates${evDiff ? `; ${evDiff} differ, first ${evFirst}` : ''} (range ${Math.min(...idx)}-${Math.max(...idx)})`);

  const arrays = [[], [5], [1, 2], [3, 1, 2], [10, 20, 30, 40], [50, 50, 50, 50, 50], [9, 81, 4, 64, 25, 36, 49, 16, 1], idx];
  let cutDiff = 0;
  for (const a of arrays) {
    const sql = (await q1('select kafaa_tr_cuts($1::int[]) as r', [a])).r;
    if (norm(sql) !== norm(D.cutsOf(a))) cutDiff++;
    const c = D.cutsOf(a);
    for (const pot of [1, 2, 3, null]) for (const i of [0, 30, 50, 90]) {
      const f = (await q1('select kafaa_tr_flags($1, $2, $3::jsonb) as r', [pot, i, c ? JSON.stringify(c) : null])).r;
      if (norm(f) !== norm(D.flagsOf(pot, i, c))) cutDiff++;
    }
  }
  const anchors = [null, {}, { agility: 3, influence: 3, drive: 1 }, { agility: 1, influence: 2, drive: 3 }, { agility: 2, influence: 2 }, { agility: 4, influence: 2, drive: 2 }, { agility: 2.5, influence: 2, drive: 2 }, { agility: '3', influence: 3, drive: 3 }, [1, 2, 3]];
  for (const a of anchors) if ((await q1('select kafaa_tr_potential($1::jsonb) as r', [a == null ? null : JSON.stringify(a)])).r !== D.potentialOf(a)) cutDiff++;
  const acts = [[], null, 'x', [{ kind: 'training', title_en: ' Course ', ref_table: 'courses', ref_id: 'c-get' }], [{ kind: 'coaching', title_ar: 'تدريب' }], [{ kind: 'nope', title_en: 'x' }],
    [{ kind: 'stretch', title_en: '' }], [{ kind: 'stretch', title_en: 'x'.repeat(201) }], Array.from({ length: 6 }, () => ({ kind: 'stretch', title_en: 'x' })), [[]], [{ kind: 'rotation', title_en: 'R', ref_table: '', ref_id: 5 }]];
  for (const a of acts) if (norm((await q1('select kafaa_tr_actions_norm($1::jsonb) as r', [a == null ? null : JSON.stringify(a)])).r) !== norm(D.normActions(a))) cutDiff++;
  for (const r of [null, 1, 2, 3, 4, 5]) if ((await q1('select kafaa_tr_perf_map($1) as r', [r])).r !== D.perfFromRating(r)) cutDiff++;
  ok(cutDiff === 0, `terciles, outlier flags, potential anchors (median), development actions and performance mapping: SQL equals TS on ${arrays.length * 17 + anchors.length + acts.length + 6} inputs`);

  let memDiff = 0;
  for (const c of T.review_cycles) {
    const sql = (await q1('select kafaa_tr_members($1::text[]) as r', [c.family_ids])).r;
    if (norm(sql) !== norm(D.membersOf(c.family_ids, T.people, T.role_assignments, now))) memDiff++;
  }
  let aggDiff = 0;
  for (const cid of [null, ...T.review_cycles.map((c) => c.id)]) {
    const sql = (await q1('select kafaa_tr_aggregates($1) as r', [cid])).r;
    if (norm(sql) !== norm(D.talentAggregatesOf(cid, T.review_placements, T.people, T.review_cycles.map((c) => c.id)))) aggDiff++;
  }
  const aggAll = D.talentAggregatesOf(null, T.review_placements, T.people, T.review_cycles.map((c) => c.id));
  const cellsOk = aggAll.cells.every((c) => [c.n, c.women, c.emirati].every((v) => v === null || v >= 10));
  ok(memDiff === 0 && aggDiff === 0 && cellsOk && aggAll.women === null && aggAll.cells.some((c) => c.n === null) && aggAll.cells.some((c) => c.n !== null),
    'cycle membership and HR aggregates: SQL equals TS; every shown cell (count, women, Emirati) is 10 or more, small cells and the women split suppressed');

  // succession: every candidate of every slate (peers + feeder roles)
  const careerData = (pid) => ({
    people: T.people.filter((p) => p.id === pid), roles: T.job_roles, edges: T.career_paths, roleComps: T.role_competencies, competencies: T.competencies, skills: T.skills,
    states: T.person_skills.filter((s) => s.person_id === pid), licences: T.licences.filter((l) => l.person_id === pid), standards: T.qual_standards,
    qualRecords: T.qual_records.filter((q) => q.person_id === pid), programmes: T.programmes, courses: T.courses, trainingRecords: T.training_records.filter((t) => t.person_id === pid),
    enrolments: T.enrolments.filter((e) => e.person_id === pid), weights: T.engine_settings.find((s) => s.id === 'recommend')?.weights,
  });
  let sxDiff = 0, sxN = 0, sxFirst = '', readyNowBlocked = 0;
  for (const s of T.succession_slates) {
    const feeders = D.feederRoles(s.role_id, T.career_paths);
    for (const p of staff.filter((x) => x.status === 'active' && (x.job_role_id === s.role_id || feeders.includes(x.job_role_id)))) {
      sxN++;
      const sql = (await q1('select kafaa_sx_assess($1, $2, $3::date) as r', [p.id, s.role_id, now])).r;
      const cr = careerReadiness(careerData(p.id), p.id, [s.role_id], now)[0] ?? null;
      const gates = D.hardGatesOf(s.role_id, { person: p, licences: T.licences, standards: T.qual_standards, qualRecords: T.qual_records }, cr, now);
      const rd = D.readinessOf(cr, gates);
      const rs = (await q1('select kafaa_sx_reasons($1::jsonb, $2::jsonb) as r', [JSON.stringify(sql.cr), JSON.stringify(sql.gates)])).r;
      if (norm(sql.gates) !== norm(gates) || sql.readiness !== rd || norm(rs) !== norm(D.candidateReasons(cr, gates))) { sxDiff++; if (!sxFirst) sxFirst = `${p.id}→${s.role_id}`; }
      if (rd !== 'ready_now' && cr?.score >= 0.85) readyNowBlocked++;
      if (rd === 'ready_now' && !D.gatesMet(gates)) sxDiff++;
    }
  }
  ok(sxDiff === 0 && sxN > 40 && readyNowBlocked > 0, `succession hard gates, readiness and reasons: SQL equals TS for ${sxN} candidate × role pairs${sxDiff ? `; ${sxDiff} differ, first ${sxFirst}` : ''}; ${readyNowBlocked} people at 85%+ held back by a hard gate, nobody ready now with a gate not met`);
  let flDiff = 0;
  for (const s of T.succession_slates) if (norm((await q1('select kafaa_sx_flags($1) as r', [s.id])).r) !== norm(D.slateFlags(s.id, T.successors))) flDiff++;
  const sagg = (await q1('select kafaa_sx_aggregates() as r')).r;
  const flagsAll = T.succession_slates.flatMap((s) => D.slateFlags(s.id, T.successors));
  ok(flDiff === 0 && norm(sagg) === norm(D.successionAggregatesOf(T.succession_slates, T.successors, T.people)) && flagsAll.includes('no_ready_now') && flagsAll.includes('successor_overloaded') && flagsAll.includes('external_cover')
    && (sagg.women === null || sagg.women >= 10), 'slate flags (no ready-now, successor on more than 2 slates, external cover, no emergency cover) and succession aggregates: SQL equals TS; women share suppressed below 10');
  await fresh.close();

  // ── RLS (shared database)
  const TB = ['kafaa_review_cycles', 'kafaa_perf_ratings', 'kafaa_review_placements', 'kafaa_talent_pool', 'kafaa_succession_slates', 'kafaa_successors', 'kafaa_bench_rollups'];
  let leak = 0;
  for (const who of [null, 'k-ro', 'sro', 'k-hr-analyst', 'k-auditor', 'gulfhydro-qa', 'k-observer', 'training-mgr', 'ops-ceo']) for (const t of TB) leak += await count(who, t);
  ok(leak === 0, 'confidential tables: anonymous, employees, line managers, the HR business partner, auditors, observers, partners and the training manager read no row directly');
  ok((await count('chco', 'kafaa_review_placements')) === T.review_placements.length && (await count('chco', 'kafaa_successors')) === T.successors.length, 'the HR director (talent_review R/A) reads every placement and successor');
  const qcPr = T.talent_priorities.filter((r) => r.person_id === 'p-qc-inspector').length;
  ok(qcPr > 0 && (await count('qc-inspector', 'kafaa_talent_priorities')) === qcPr && (await count('qc-inspector', 'kafaa_review_placements')) === 0 && (await count('k-ro', 'kafaa_talent_priorities')) === 0,
    'an employee reads only their own agreed development priorities, never their placement (no box, rating or pool field exists on the priorities row)');
  let direct = false;
  try { await as('chco', `update kafaa_review_placements set potential = 3 where cycle_id = 'trc-2026h2-ops'`); direct = (await count('chco', 'kafaa_review_placements', `cycle_id = 'trc-2026h2-ops' and potential = 3`)) === T.review_placements.filter((p) => p.cycle_id === 'trc-2026h2-ops').length; } catch { direct = false; }
  ok(!direct, 'no direct writes: placements change only through the RPCs');

  // ── board scope (managers and HR BP through the RPC)
  const auditN = async () => Number((await db.query('select count(*)::int n from kafaa_audit_events')).rows[0].n);
  const sroB = (await one('sro', `select kafaa_talent_board('trc-2026h2-ops') r`)).r;
  const crewB = new Set(T.people.filter((p) => p.crew === 'B' || p.manager_id === 'p-sro').map((p) => p.id));
  ok(sroB.ok && sroB.data.view === 'scope' && sroB.data.members.length > 0 && sroB.data.members.every((m) => crewB.has(m.person_id) && m.person_id !== 'p-sro') && sroB.data.members_total > sroB.data.members.length,
    `a line manager's board holds only their crew (${sroB.data?.members?.length} of ${sroB.data?.members_total}) and never their own placement`);
  const opsB = (await one('ops-ceo', `select kafaa_talent_board('trc-2026h2-ops') r`)).r;
  ok(opsB.ok && opsB.data.members.some((m) => m.person_id === 'p-sro' && m.placement) && (await one('sro', `select kafaa_talent_board('trc-2026h1-tsv') r`)).r.code === 'not_found',
    "the shift supervisor's own placement is visible to their manager only; a cycle outside the manager's scope reads as not found");
  const kro = (await one('k-ro', `select kafaa_talent_board('trc-2026h2-ops') r`)).r;
  const aud = (await one('k-auditor', `select kafaa_talent_cycles() r`)).r;
  ok(kro.code === 'forbidden' && aud.code === 'forbidden' && (await one('gulfhydro-qa', `select kafaa_succession_board() r`)).r.code === 'forbidden' && (await one('k-observer', `select kafaa_succession_board() r`)).r.code === 'forbidden',
    'employees, auditors, partners and observers are refused talent review and succession (forbidden, audited)');
  const hrB = (await one('k-hr-analyst', `select kafaa_talent_board('trc-2026h2-mne') r`)).r;
  ok(hrB.ok && hrB.data.members.length === hrB.data.members_total && hrB.data.can.calibrate && !hrB.data.can.place && hrB.data.can.lock_blocker === null, 'the HR business partner sees the whole cycle in scope and may calibrate but not place or lock');
  const mneChco = (await one('chco', `select kafaa_talent_board('trc-2026h2-mne') r`)).r;
  const flagged = mneChco.data.members.filter((m) => m.flags.length);
  const cuts = mneChco.data.cuts;
  ok(mneChco.data.members.every((m) => !m.placement || norm(m.flags) === norm(D.flagsOf(m.placement.potential, m.index, cuts)))
    && mneChco.data.members.filter((m) => m.placement?.potential === 3 && m.index <= cuts.low).every((m) => m.flags.includes('potential_high_evidence_low')),
    `outlier flags appear exactly when potential is 3 and the evidence index is in the bottom third (cut ${cuts?.low}; ${flagged.length} flagged)`);

  // ── place: scope, self, note, locked
  const a0 = await auditN();
  const pl1 = (await one('sro', `select kafaa_place_talent($1::jsonb) r`, [JSON.stringify({ cycle_id: 'trc-2026h2-ops', person_id: 'p-k-ro', perf: D.perfFromRating(T.perf_ratings.filter((r) => r.person_id === 'p-k-ro').sort((a, b) => (a.period < b.period ? 1 : -1))[0].rating), anchors: { agility: 3, influence: 2, drive: 3 }, actions: [{ kind: 'training', title_en: 'SRO pre-licensing course' }] })])).r;
  const out = (await one('sro', `select kafaa_place_talent($1::jsonb) r`, [JSON.stringify({ cycle_id: 'trc-2026h2-ops', person_id: 'w-ro-03', perf: 2, anchors: { agility: 2, influence: 2, drive: 2 } })])).r;
  const self = (await one('sro', `select kafaa_place_talent($1::jsonb) r`, [JSON.stringify({ cycle_id: 'trc-2026h2-ops', person_id: 'p-sro', perf: 2, anchors: { agility: 2, influence: 2, drive: 2 } })])).r;
  const sug = D.perfFromRating(T.perf_ratings.filter((r) => r.person_id === 'w-ro-02').sort((a, b) => (a.period < b.period ? 1 : -1))[0].rating);
  const noNote = (await one('sro', `select kafaa_place_talent($1::jsonb) r`, [JSON.stringify({ cycle_id: 'trc-2026h2-ops', person_id: 'w-ro-02', perf: sug === 3 ? 1 : 3, anchors: { agility: 2, influence: 2, drive: 2 } })])).r;
  const locked = (await one('sro', `select kafaa_place_talent($1::jsonb) r`, [JSON.stringify({ cycle_id: 'trc-2026h1-tsv', person_id: 'w-rp-01', perf: 2, anchors: { agility: 2, influence: 2, drive: 2 } })])).r;
  const hrPlace = (await one('k-hr-analyst', `select kafaa_place_talent($1::jsonb) r`, [JSON.stringify({ cycle_id: 'trc-2026h2-ops', person_id: 'p-k-ro', perf: 2, anchors: { agility: 2, influence: 2, drive: 2 } })])).r;
  const a1 = await auditN();
  const row = (await db.query(`select * from kafaa_review_placements where id = 'tp:trc-2026h2-ops:p-k-ro'`)).rows[0];
  ok(pl1.ok && row && row.placed_by === 'p-sro' && row.box === pl1.data.box && row.evidence_snapshot.index === row.evidence_index && out.code === 'not_in_scope' && self.code === 'self' && noNote.code === 'note_required'
    && locked.code === 'cycle_locked' && hrPlace.code === 'forbidden' && a1 - a0 === 6, 'placeTalent: in-scope placement with an evidence snapshot; out of scope, self, unexplained rating change, locked cycle and HR placement refused; every call audited');

  // ── calibration and lock (maker-checker, locked cycle)
  const inc = (await one('k-hr-analyst', `select kafaa_calibrate_cycle('trc-2026h2-ops', '[]'::jsonb, true) r`)).r;
  const someone = T.review_placements.find((p) => p.cycle_id === 'trc-2026h2-mne');
  const badNote = (await one('k-hr-analyst', `select kafaa_calibrate_cycle('trc-2026h2-mne', $1::jsonb, false) r`, [JSON.stringify([{ person_id: someone.person_id, perf: 2, potential: 2, note: 'short' }])])).r;
  const byChco = (await one('chco', `select kafaa_calibrate_cycle('trc-2026h2-mne', $1::jsonb, true) r`, [JSON.stringify([{ person_id: someone.person_id, perf: 2, potential: 2, note: 'Evidence supports a moderate placement.' }])])).r;
  const mk = (await one('chco', `select kafaa_lock_cycle('trc-2026h2-mne', '') r`)).r;
  const byHr = (await one('k-hr-analyst', `select kafaa_calibrate_cycle('trc-2026h2-mne', $1::jsonb, true) r`, [JSON.stringify([{ person_id: someone.person_id, perf: 2, potential: 2, note: 'Re-confirmed in the calibration session.' }])])).r;
  const led0 = Number((await db.query('select count(*)::int n from ledger_entries')).rows[0].n);
  const mk2 = (await one('chco', `select kafaa_lock_cycle('trc-2026h2-mne', '') r`)).r;
  const hrLock = (await one('k-hr-analyst', `select kafaa_lock_cycle('trc-2026h2-mne', '') r`)).r;
  ok(inc.code === 'incomplete' && badNote.code === 'note_required' && byChco.ok && mk.code === 'maker_checker' && byHr.ok && hrLock.code === 'forbidden', 'calibration: unplaced people block finishing, every change needs a reason; the HR director cannot lock a cycle they calibrated (maker-checker) and the HR BP cannot lock');
  const lk = mk2;
  const led1 = Number((await db.query('select count(*)::int n from ledger_entries')).rows[0].n);
  const nPl = Number((await db.query(`select count(*)::int n from kafaa_review_placements where cycle_id = 'trc-2026h2-mne'`)).rows[0].n);
  const pri = Number((await db.query(`select count(*)::int n from kafaa_talent_priorities where cycle_id = 'trc-2026h2-mne'`)).rows[0].n);
  const after = (await one('k-hr-analyst', `select kafaa_calibrate_cycle('trc-2026h2-mne', $1::jsonb, false) r`, [JSON.stringify([{ person_id: someone.person_id, perf: 3, potential: 3, note: 'Trying to change after the lock.' }])])).r;
  const again = (await one('chco', `select kafaa_lock_cycle('trc-2026h2-mne', '') r`)).r;
  ok(lk.ok && lk.data.priorities === nPl && pri === nPl && after.code === 'cycle_locked' && again.code === 'cycle_locked' && led1 === led0 + 1 && lk.ledger_seq != null && lk.audit_seq != null,
    `lockCycle: ${nPl} placements locked, priorities published, HiPo pool ${lk.data?.hipo}; a locked cycle refuses changes (cycle_locked); audited and ledgered`);

  // ── aggregates
  const agHr = (await one('k-hr-analyst', `select kafaa_talent_aggregates(null) r`)).r;
  const agMgr = (await one('sro', `select kafaa_talent_aggregates(null) r`)).r;
  const agSmall = (await one('chco', `select kafaa_talent_aggregates('trc-2026h2-mne') r`)).r;
  ok(agHr.ok && agHr.data.cells.every((c) => [c.n, c.women, c.emirati].every((v) => v === null || v >= 10)) && agMgr.code === 'forbidden' && agSmall.ok && agSmall.data.cells.every((c) => c.n === null || c.n >= 10),
    'talentAggregates: HR aggregates suppress every cell under 10 (women and Emirati splits included); line managers are refused');

  // ── succession
  const sxOps = (await one('ops-ceo', `select kafaa_succession_board() r`)).r;
  const sxEd = (await one('emergency-director', `select kafaa_succession_board() r`)).r;
  const sxSro = (await one('sro', `select kafaa_succession_board() r`)).r;
  const sxHr = (await one('k-hr-analyst', `select kafaa_succession_board() r`)).r;
  ok(sxOps.ok && sxOps.data.view === 'function' && sxOps.data.slates.length === T.succession_slates.length && sxOps.data.aggregates === null && sxEd.ok && sxEd.data.slates.every((s) => s.family_id === 'emergency-preparedness') && sxEd.data.slates.length === 1
    && sxSro.ok && sxSro.data.slates.length === 0 && sxHr.data.aggregates && !sxHr.data.can.edit,
    'successionBoard: executives see their own function (operations CEO all plant slates, emergency director the EP slate, crew supervisor none, no aggregates); HR BP reads with aggregates, no edits');
  const ss = 'ss-shift-supervisor-2026h2';
  const g1 = (await one('chco', `select kafaa_propose_successor($1::jsonb) r`, [JSON.stringify({ slate_id: ss, person_id: 'w-sro-03', readiness: 'ready_now', note: 'Strong performer in every outage.' })])).r;
  const cand = (await one('chco', `select kafaa_succession_candidates($1) r`, [ss])).r;
  const w2 = cand.data.find((c) => c.person_id === 'w-sro-02');
  const g2 = (await one('chco', `select kafaa_propose_successor($1::jsonb) r`, [JSON.stringify({ slate_id: ss, person_id: 'w-sro-02', readiness: 'ready_now' })])).r;
  const g3 = (await one('chco', `select kafaa_propose_successor($1::jsonb) r`, [JSON.stringify({ slate_id: ss, person_id: 'w-sro-02', readiness: 'ready_now', note: 'Acting shift supervisor for six months in 2026.', actions: [{ kind: 'training', title_en: 'ESTADAD', ref_table: 'courses', ref_id: 'c-estadad' }] })])).r;
  const conf0 = (await one('chco', `select kafaa_confirm_slate('ss-senior-reactor-operator-2026h2', '') r`)).r;
  const hrProp = (await one('k-hr-analyst', `select kafaa_propose_successor($1::jsonb) r`, [JSON.stringify({ slate_id: ss, person_id: 'w-sro-05' })])).r;
  ok(g1.code === 'gate_not_met' && w2 && w2.gates_met && (g2.code === 'optimistic_note' || w2.readiness === 'ready_now') && g3.ok && g3.data.readiness === 'ready_now' && conf0.code === 'slate_confirmed' && hrProp.code === 'forbidden',
    'proposeSuccessor: ready now is refused when a hard gate is not met (gate_not_met); earlier than computed needs a reason; HR BP cannot edit; confirmed slates are closed');
  const led2 = Number((await db.query('select count(*)::int n from ledger_entries')).rows[0].n);
  const conf = (await one('chco', `select kafaa_confirm_slate($1, 'Agreed with the operations CEO') r`, [ss])).r;
  const before = (await db.query(`select * from kafaa_critical_roles where id = 'crit-shift-supervisor-2026h2'`)).rows[0];
  const a2 = await auditN();
  const roll = (await one('chco', `select kafaa_rollup_bench('2026-H2') r`)).r;
  const a3 = await auditN();
  const led3 = Number((await db.query('select count(*)::int n from ledger_entries')).rows[0].n);
  const crit = (await db.query(`select * from kafaa_critical_roles where id = 'crit-shift-supervisor-2026h2'`)).rows[0];
  const ready = Number((await db.query(`select count(*)::int n from kafaa_successors where slate_id = $1 and status = 'confirmed' and cover_source = 'internal' and readiness = 'ready_now'`, [ss])).rows[0].n);
  const br = (await db.query(`select * from kafaa_bench_rollups where id = 'br:2026-H2:shift-supervisor'`)).rows[0];
  const badP = (await one('chco', `select kafaa_rollup_bench('2026-Q4') r`)).r;
  const hrRoll = (await one('k-hr-analyst', `select kafaa_rollup_bench('2026-H2') r`)).r;
  ok(conf.ok && !before && roll.ok && crit && crit.qualified === ready && crit.period === '2026-H2' && br && a3 - a2 === 1 && roll.audit_seq != null && led3 === led2 + 2 && badP.code === 'invalid' && hrRoll.code === 'forbidden',
    `rollupBench: confirmed slates update M07 critical_roles counts for the period (shift supervisor qualified = ${ready} ready-now), one audit row and a ledger row; bad period and non-HR-director refused`);
  const flags = (await one('chco', `select kafaa_succession_board() r`)).r.data.slates.flatMap((s) => s.flags);
  ok(flags.includes('no_ready_now') && flags.includes('successor_overloaded'), 'the board shows the "no ready-now successor" and "successor on more than 2 slates" flags');
}
