// [W4 · E1] PGlite checks for 20261009141001_kafaa_w4e1_effectiveness.sql (F25 Kirkpatrick effectiveness, F26 training needs):
// SQL = TS parity on a pristine database (every scorecard card, the demand of the four forecast quarters, the demand report exact and
// suppressed), the acceptance rules (instructors never read an individual L1 response; course results only at n >= 10; L3 due 90 days
// after a qualifying completion; L2 only from released attempts; L4 always SAMPLE with the caveat; demand decomposes into its
// sources; cells under 10 suppressed for aggregate viewers but counted in totals; proposals stay drafts; a roadmap change moves next
// quarter's demand), RBAC and refusals, and that internal helpers are not callable by API roles.
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

export default async function w4e1Checks({ db, as, one, count, ok, uid }) {
  console.log('W4E1 · F25 training effectiveness, F26 training needs forecast');
  const { courseCard, completionsOf, MIN_N } = await import('../../src/modules/m25/eff.ts');
  const { computeDemand, needsReport, periodsFrom, SOURCES } = await import('../../src/modules/m25/needs.ts');
  const seed = JSON.parse(readFileSync('src/seed/seed.json', 'utf8'));
  const T = seed.tables;
  const now = seed.meta.demo_today;
  let n = 1410;
  for (const [persona, role] of [['k-ro', 'Reactor Operator'], ['qc-inspector', 'QC Inspector']]) {
    const row = (await db.query('select user_id from profiles where persona_id = $1', [persona])).rows[0];
    if (row) { uid[persona] = row.user_id; continue; }
    uid[persona] = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, 'enec-ops', 'employee', [role]]);
  }
  const norm = (x) => JSON.stringify(x, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((kk) => [kk, v[kk]])) : v));

  // ── seed sanity
  const l2Forms = T.assessment_forms.filter((f) => f.id.startsWith('form-l2-'));
  ok(T.eval_surveys.length >= 35 && l2Forms.length === 12 && l2Forms.every((f) => f.course_id === null && !f.is_practice),
    `seed: ${T.eval_surveys.length} evaluation designs; ${l2Forms.length} L2 knowledge checks, none linked to a course (never skill evidence)`);
  ok(T.l3_observations.every((o) => o.due_on === new Date(Date.parse(`${o.completed_on}T00:00:00Z`) + 90 * 86400000).toISOString().slice(0, 10)),
    `seed: all ${T.l3_observations.length} L3 observations are due 90 days after completion`);
  const qual = new Set(T.courses.filter((c) => c.qualifying).map((c) => c.id));
  ok(T.l3_observations.every((o) => qual.has(o.course_id)), 'seed: L3 observations only for qualifying courses');

  // ── pristine database for parity
  const fresh = new PGlite();
  await fresh.exec(readFileSync('supabase/tests/nexus_stubs.sql', 'utf8'));
  for (const m of readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()) await fresh.exec(readFileSync(`supabase/migrations/${m}`, 'utf8'));
  await fresh.exec(readFileSync('supabase/seed.sql', 'utf8'));
  const q1 = async (sql, p = []) => (await fresh.query(sql, p)).rows[0];

  const x = { courses: T.courses, surveys: T.eval_surveys, completions: completionsOf(T.training_records, T.enrolments), responses: T.eval_responses, attempts: T.attempts,
    observations: T.l3_observations, kpis: T.course_kpi_links, flags: T.redesign_flags };
  let diffs = 0, first = '';
  const cards = [];
  for (const s of [...T.eval_surveys].sort((a, b) => (a.course_id < b.course_id ? -1 : 1))) {
    const sq = (await q1('select kafaa_ev_card($1, $2::date) as c', [s.course_id, now])).c;
    const ts = courseCard(s.course_id, x, now);
    cards.push(ts);
    if (norm(sq) !== norm(ts)) { diffs++; if (!first) first = `${s.course_id}\nSQL ${norm(sq)}\nTS  ${norm(ts)}`; }
  }
  ok(diffs === 0, `scorecard: SQL kafaa_ev_card equals TS courseCard for all ${cards.length} courses${diffs ? ` (${diffs} differ, first ${first})` : ''}`);
  const counts = (c) => [c.completions, c.l1.n, c.l2.pairs, c.l3.scheduled, c.l3.done, c.l3.overdue];
  ok(cards.every((c) => counts(c).every((v) => v === null || v >= MIN_N)), 'every count on every card is null (suppressed) or at least 10');
  ok(cards.every((c) => c.l1.n !== null || (c.l1.recommend === null && Object.values(c.l1.items).every((v) => v === null))), 'L1 results show only when 10 or more people answered');
  ok(cards.some((c) => c.l1.n !== null) && cards.some((c) => c.l1.suppressed && T.eval_responses.some((r) => r.course_id === c.course_id)), 'the seed shows both visible and suppressed L1 results');
  ok(cards.every((c) => c.l4.sample === true && c.l4.caveat === true), 'L4 panel always carries SAMPLE and the association caveat');
  ok(cards.some((c) => c.redesign) && cards.some((c) => c.reasons.some((r) => r.code === 'kpi_worse') && !c.redesign), 'redesign candidates flagged; a worsening KPI alone never triggers redesign');

  // L2 uses only released attempts: unreleasing one post attempt removes exactly one pair
  const get = (await q1('select kafaa_ev_card($1, $2::date) as c', ['c-get', now])).c;
  const att = (await q1(`select a.id from kafaa_attempts a where a.form_id = 'form-l2-post-c-get' and a.released order by a.id limit 1`)).id;
  await fresh.query(`update kafaa_attempts set released = false, status = 'graded' where id = $1`, [att]);
  const get2 = (await q1('select kafaa_ev_card($1, $2::date) as c', ['c-get', now])).c;
  ok(get.l2.pairs - get2.l2.pairs === 1 && get2.l2.unreleased_excluded === true, `L2 gain uses only released attempts (pairs ${get.l2.pairs} -> ${get2.l2.pairs} after unreleasing one)`);
  await fresh.query(`update kafaa_attempts set released = true, status = 'released' where id = $1`, [att]);

  // ── F26 parity: demand rows per quarter and the report
  const input = { people: T.people, courses: T.courses, curriculum_rules: T.curriculum_rules, training_records: T.training_records, enrolments: T.enrolments, qual_records: T.qual_records,
    qual_standards: T.qual_standards, links: T.needs_links, roadmaps: T.roadmaps, coach_feedback: T.coach_feedback, future_interest: T.future_interest, future_resources: T.future_resources,
    klra_actions: T.klra_actions, klra_positions: T.klra_positions };
  const periods = periodsFrom(now);
  ok(norm((await q1('select to_jsonb(kafaa_dm_periods($1::date)) as p', [now])).p) === norm(periods), `forecast horizon ${periods.join(', ')} (SQL = TS)`);
  let dd = 0, dfirst = '', rows = 0;
  for (const p of periods) {
    const sq = (await q1('select kafaa_dm_compute($1, $2::date) as r', [p, now])).r;
    const ts = computeDemand(input, p, now);
    rows += ts.length;
    if (norm(sq) !== norm(ts)) { dd++; if (!dfirst) dfirst = `${p}\nSQL ${norm(sq).slice(0, 600)}\nTS  ${norm(ts).slice(0, 600)}`; }
  }
  ok(dd === 0, `demand: SQL kafaa_dm_compute equals TS computeDemand for ${periods.length} quarters (${rows} cells)${dd ? ` (first ${dfirst})` : ''}`);
  const seededOk = periods.every((p) => norm(computeDemand(input, p, now)) === norm(T.demand_snapshots.filter((s) => s.period === p).map(({ computed_at, computed_by, open_read, ...r }) => r)));
  ok(seededOk, 'seeded demand snapshots equal the rules for every quarter');
  ok(T.demand_snapshots.every((s) => s.detail.reduce((t, d) => t + d.count, 0) === s.count), 'every demand cell decomposes into its drill-down (sums match)');
  ok(new Set(T.demand_snapshots.map((s) => s.source)).size >= 5, `demand comes from ${[...new Set(T.demand_snapshots.map((s) => s.source))].join(', ')}`);
  let rd = 0, rfirst = '';
  for (const p of periods) for (const exact of [true, false]) {
    const sq = (await q1('select kafaa_dm_report($1, $2) as r', [p, exact])).r;
    const ts = needsReport(T.demand_snapshots, { sessions: T.sessions, simulator_slots: T.simulator_slots, proposals: T.session_proposals, courses: T.courses }, p, exact);
    const a = { ...sq, computed_at: null }, b = { ...ts, computed_at: null };
    if (norm(a) !== norm(b)) { rd++; if (!rfirst) rfirst = `${p} ${exact}\nSQL ${norm(a).slice(0, 800)}\nTS  ${norm(b).slice(0, 800)}`; }
    if (!exact) {
      const bad = ts.rows.flatMap((r) => [...SOURCES.map((s) => r.sources[s]), ...SOURCES.flatMap((s) => r.detail[s].map((d) => d.count))]).filter((v) => v !== null && v < MIN_N);
      if (bad.length) { rd++; rfirst ||= `${p} unsuppressed ${bad}`; }
      const exactRep = needsReport(T.demand_snapshots, { sessions: T.sessions, simulator_slots: T.simulator_slots, proposals: T.session_proposals, courses: T.courses }, p, true);
      if (ts.total !== exactRep.total || ts.rows.some((r, i) => r.total !== exactRep.rows[i].total)) { rd++; rfirst ||= `${p} totals differ when suppressed`; }
    }
  }
  ok(rd === 0, `demand report: SQL = TS (exact and suppressed) for 4 quarters; suppressed cells < 10 still counted in totals${rd ? ` (${rfirst})` : ''}`);

  // A roadmap change moves next quarter's demand after recompute
  const next = periods[1];
  const rm = T.roadmaps.find((r) => r.active !== false && T.people.find((p) => p.id === r.person_id && p.kind === 'staff' && p.status === 'active'));
  const before = (await q1('select kafaa_dm_compute($1, $2::date) as r', [next, now])).r.find((r) => r.course_id === 'c-mcc' && r.source === 'roadmap')?.count ?? 0;
  const start = `${next.slice(0, 4)}-${String((Number(next.slice(-1)) - 1) * 3 + 2).padStart(2, '0')}-10`;
  await fresh.query(`update kafaa_roadmaps set plan = plan || $2::jsonb where id = $1`, [rm.id, JSON.stringify([{ id: 'dev-course-c-mcc', lane: 'development', kind: 'course', course_id: 'c-mcc', start, end: start, months: 1 }])]);
  const after = (await q1('select kafaa_dm_compute($1, $2::date) as r', [next, now])).r.find((r) => r.course_id === 'c-mcc' && r.source === 'roadmap')?.count ?? 0;
  ok(after === before + 1, `a roadmap course block added for ${next} raises next quarter's c-mcc demand ${before} -> ${after}`);
  await fresh.close();

  // ── RLS on the shared database
  const own = async (persona) => (await one(persona, `select count(*)::int as n, count(*) filter (where person_id <> kafaa_me())::int as other from kafaa_eval_responses`));
  for (const p of ['k-instructor', 'training-mgr', 'sro', 'chco', 'k-auditor']) {
    const r = await own(p);
    ok(r.other === 0, `${p} reads no individual L1 response but their own (${r.n} own)`);
  }
  ok((await count('k-instructor', 'kafaa_l3_observations', 'person_id <> kafaa_me() and observer_person_id is distinct from kafaa_me()')) === 0, 'instructors read no one else\'s L3 observation directly');
  ok((await count('training-mgr', 'kafaa_demand_snapshots')) === 0 && (await count('chco', 'kafaa_demand_snapshots')) === 0, 'demand snapshots are served only through the report RPC');
  ok((await count('k-instructor', 'kafaa_session_proposals')) >= 1 && (await count('k-ro', 'kafaa_session_proposals')) === 0, 'session drafts follow the schedule: instructors read them, employees do not');
  ok((await count('k-instructor', 'kafaa_eval_surveys')) >= 35 && (await count(null, 'kafaa_eval_surveys')) === 0, 'evaluation designs: staff read, anonymous none');

  // ── RPCs
  const rpc = async (persona, sql, p = []) => (await one(persona, sql, p)).r;
  const rep = await rpc('k-instructor', 'select kafaa_effectiveness_report() as r');
  ok(rep.ok && rep.data.cards.length >= 35 && rep.data.cards.every((c) => counts(c).every((v) => v === null || v >= 10)), 'instructor (Agg) gets the scorecard with every small group suppressed');
  ok((await rpc('k-ro', 'select kafaa_effectiveness_report() as r')).code === 'forbidden', 'an employee is refused the scorecard (audited)');
  let anonDenied = false;
  try { await as(null, 'select kafaa_effectiveness_report()'); } catch { anonDenied = true; }
  ok(anonDenied, 'anonymous callers cannot execute the RPCs');
  let helperDenied = false;
  try { await as('training-mgr', `select kafaa_ev_card('c-get', current_date)`); } catch { helperDenied = true; }
  ok(helperDenied, 'internal helpers (kafaa_ev_*, kafaa_dm_*) are not executable by API roles');

  const pend = 'en:en-68';
  const bad = await rpc('sro', 'select kafaa_submit_l1($1::jsonb) as r', [JSON.stringify({ completion_ref: pend, ratings: { relevance: 6, objectives: 4, delivery: 4, confidence: 4, time: 4 }, recommend: true })]);
  const l1 = await rpc('sro', 'select kafaa_submit_l1($1::jsonb) as r', [JSON.stringify({ completion_ref: pend, ratings: { relevance: 5, objectives: 4, delivery: 4, confidence: 4, time: 3 }, recommend: true })]);
  const dup = await rpc('sro', 'select kafaa_submit_l1($1::jsonb) as r', [JSON.stringify({ completion_ref: pend, ratings: { relevance: 5, objectives: 4, delivery: 4, confidence: 4, time: 3 }, recommend: true })]);
  const other = await rpc('k-instructor', 'select kafaa_submit_l1($1::jsonb) as r', [JSON.stringify({ completion_ref: 'en:en-1', ratings: { relevance: 5, objectives: 4, delivery: 4, confidence: 4, time: 3 }, recommend: true })]);
  ok(bad.code === 'invalid' && l1.ok && dup.code === 'duplicate' && other.code === 'not_found', `L1: out-of-range refused, own completion accepted, duplicate refused, someone else's completion not found`);
  // a fresh completion of a qualifying course (no observation yet): L1 schedules its L3 observation 90 days later
  await db.query(`insert into kafaa_enrolments (id, person_id, course_id, status, source, enrolled_at, progress_pct, completed_at) values ('en-w4e1-t', 'p-sro', 'c-hu', 'completed', 'self', now(), 100, (current_date - 10)::timestamp at time zone 'UTC') on conflict do nothing`);
  const l1b = await rpc('sro', 'select kafaa_submit_l1($1::jsonb) as r', [JSON.stringify({ completion_ref: 'en:en-w4e1-t', ratings: { relevance: 4, objectives: 4, delivery: 4, confidence: 4, time: 4 }, recommend: false })]);
  ok(l1b.ok && l1b.data.l3_id === 'l3:en:en-w4e1-t' && l1.data.l3_id === null, 'submitting L1 for a qualifying course schedules its L3 observation (once per completion)');
  const sch2 = (await db.query(`select (due_on - completed_on) as d, status from kafaa_l3_observations where id = $1`, ['l3:en:en-w4e1-t'])).rows[0];
  ok(sch2 && Number(sch2.d) === 90 && sch2.status === 'scheduled', 'the L3 observation is scheduled 90 days after completion');
  ok((await rpc('sro', 'select kafaa_schedule_l3() as r')).code === 'forbidden' && (await rpc('training-mgr', 'select kafaa_schedule_l3() as r')).ok, 'L3 scheduling: training manager only');

  const board = await rpc('sro', 'select kafaa_l3_board() as r');
  ok(board.ok && board.data.mode === 'mine' && board.data.rows.length > 0 && board.data.rows.length < T.l3_observations.length, `line manager sees only their team's ${board.data.rows.length} observations`);
  ok((await rpc('k-instructor', 'select kafaa_l3_board() as r')).code === 'forbidden', 'instructors (Own/Agg only) are refused the L3 board');
  const target = board.data.rows.find((r) => r.can_record);
  const items = (target?.items ?? []).map((i, k) => ({ key: i.key, rating: k === 0 ? 'yes' : 'partly' }));
  const badL3 = await rpc('sro', 'select kafaa_record_l3($1, $2::jsonb) as r', [target?.id ?? '', JSON.stringify({ items: items.slice(1) })]);
  const rec = await rpc('sro', 'select kafaa_record_l3($1, $2::jsonb) as r', [target?.id ?? '', JSON.stringify({ items, note: 'Seen on shift' })]);
  const again = await rpc('sro', 'select kafaa_record_l3($1, $2::jsonb) as r', [target?.id ?? '', JSON.stringify({ items })]);
  ok(!!target && badL3.code === 'invalid' && rec.ok && again.code === 'closed', `L3: incomplete checklist refused, observer of record records ${target?.id}, second record refused`);
  const future = (await db.query(`select id, items from kafaa_l3_observations where status = 'scheduled' and due_on - 30 > current_date order by id limit 1`)).rows[0];
  if (future) {
    const tooEarly = await rpc('training-mgr', 'select kafaa_record_l3($1, $2::jsonb) as r', [future.id, JSON.stringify({ items: future.items.map((i) => ({ key: i.key, rating: 'yes' })) })]);
    ok(tooEarly.code === 'too_early', 'L3 cannot be recorded before day 60');
  }

  const flag = await rpc('training-mgr', `select kafaa_flag_redesign('c-hu', 'Transfer to the job is low; add field coaching.') as r`);
  const flagDup = await rpc('training-mgr', `select kafaa_flag_redesign('c-hu', 'Transfer to the job is low; add field coaching.') as r`);
  const flagNo = await rpc('k-instructor', `select kafaa_flag_redesign('c-hu', 'Transfer to the job is low; add field coaching.') as r`);
  ok(flag.ok && flagDup.code === 'duplicate' && flagNo.code === 'forbidden', 'redesign flag: training manager only, one open flag per course');

  // F26 RPCs
  const dr = await rpc('chco', 'select kafaa_demand_report() as r');
  const cells = dr.data.rows.flatMap((r) => Object.values(r.sources));
  ok(dr.ok && dr.data.exact === false && cells.every((v) => v === null || v >= 10) && dr.data.total > 0, `HR (Agg) gets the demand report with cells under 10 suppressed and the exact total (${dr.data.total})`);
  const drt = await rpc('training-mgr', 'select kafaa_demand_report() as r');
  ok(drt.data.exact === true && drt.data.rows.every((r) => SOURCES.reduce((t, s) => t + (r.sources[s] ?? 0), 0) === r.total), 'training manager gets exact cells that add up to each course total');
  ok((await rpc('k-ro', 'select kafaa_demand_report() as r')).code === 'forbidden', 'employees are refused the demand report');
  const comp = await rpc('training-mgr', `select kafaa_compute_demand($1) as r`, [drt.data.period]);
  ok(comp.ok && (await rpc('sro', `select kafaa_compute_demand($1) as r`, [drt.data.period])).code === 'forbidden' && (await rpc('training-mgr', `select kafaa_compute_demand('2025-Q1') as r`)).code === 'invalid',
    `compute demand: training manager only, horizon quarters only (${comp.data?.rows} cells)`);
  const sessionsBefore = Number((await db.query('select count(*)::int as n from kafaa_sessions')).rows[0].n);
  const nq = await rpc('training-mgr', `select kafaa_demand_report($1) as r`, [periods[1]]);
  const short = nq.data.rows.find((r) => r.shortfall > r.draft_seats);
  const prop = short ? await rpc('training-mgr', 'select kafaa_propose_sessions($1, $2, $3) as r', [periods[1], short.course_id, 'test']) : { ok: false };
  const sessionsAfter = Number((await db.query('select count(*)::int as n from kafaa_sessions')).rows[0].n);
  const pr = prop.ok ? (await db.query('select status from kafaa_session_proposals where id = $1', [prop.data.id])).rows[0] : null;
  ok(prop.ok && pr?.status === 'draft' && sessionsAfter === sessionsBefore, `proposed sessions are drafts (${prop.data?.sessions} for ${short?.course_id}); no session is published`);
  const link = prop.ok ? await rpc('training-mgr', 'select kafaa_link_proposal($1, $2) as r', [prop.data.id, 's-coct-b']) : { code: '' };
  const wd = prop.ok ? await rpc('training-mgr', 'select kafaa_withdraw_proposal($1) as r', [prop.data.id]) : { ok: false };
  ok(link.code === 'invalid' && wd.ok && (await rpc('sro', 'select kafaa_propose_sessions($1, $2, $3) as r', [periods[1], short?.course_id ?? 'c-get', ''])).code === 'forbidden',
    'proposal: linking a session of another course/quarter refused, withdraw works, managers cannot propose');
}
