// [W3 · E4 · F23] PGlite checks for 20261009134001_kafaa_w3e4_reserve.sql: RLS on the reserve tables, SQL = TS parity (consent and
// request validation, contact-data detection, bands, frozen snapshots, the alumni board and the HR stats with suppression), and the
// RPC flows with the card's acceptance criteria (withdrawal hides the alumnus everywhere and schedules erasure after six months; a
// request needs HR approval before an alumnus sees the poster's team; no contact data is stored; maker-checker on HR approval).
import { readFileSync } from 'node:fs';
import { ALMSG, addMonths, bandOf, computeBoard, computeStats, hasContactData, snapshotFrom, validateJoin, validateRequest } from '../../src/modules/m20/reserve.ts';

export default async function w3e4Checks({ db, as, count, ok, uid }) {
  const seed = JSON.parse(readFileSync('src/seed/seed.json', 'utf8'));
  const T = seed.tables;
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  let n = 3400;
  for (const [persona, role] of [['k-ro', 'Reactor Operator'], ['outage-manager', 'Outage Manager'], ['sme-reviewer', 'SME reviewer'], ['nse', 'NSE'], ['sec-compliance', 'Security compliance'], ['qc-inspector', 'QC Receiving Inspector'], ['ops-ceo', 'Operations CEO']]) {
    const row = (await q('select user_id from profiles where persona_id = $1', [persona]))[0];
    if (row) { uid[persona] = row.user_id; continue; }
    uid[persona] = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, 'enec-ops', 'employee', [role]]);
  }
  console.log('W3E4 · F23 alumni and expert reserve');
  const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${k}:${canon(v[k])}`).join(',')}}` : JSON.stringify(v ?? null));
  const today = (await q('select current_date::text as d'))[0].d;
  const tsZ = (v) => (typeof v === 'string' && /T/.test(v) ? new Date(v).toISOString().replace(/\.\d{3}Z$/, 'Z') : v);
  const rows = async (table) => (await q(`select to_jsonb(x) j from ${table} x`)).map((r) => Object.fromEntries(Object.entries(r.j).map(([k, v]) => [k, /_at$/.test(k) ? tsZ(v) : v])));

  // ── RLS
  const tabs = ['kafaa_alumni', 'kafaa_reserve_requests', 'kafaa_reserve_engagements', 'kafaa_alumni_stories'];
  ok((await Promise.all(tabs.map((t) => count(null, t)))).every((c) => c === 0), 'anonymous visitors read no reserve rows');
  ok((await count('k-ro', 'kafaa_alumni')) === T.alumni.filter((m) => m.finder_visible).length && (await count('k-ro', 'kafaa_alumni', 'not finder_visible')) === 0,
    'staff read a member only while they opted into the expert finder');
  ok((await count('sme-reviewer', 'kafaa_alumni', `id = 'alm:p-sme-reviewer'`)) === 1, 'a member reads their own row');
  ok((await count('k-ro', 'kafaa_reserve_requests')) === 0 && (await count('k-ro', 'kafaa_reserve_engagements')) === 0 && (await count('chco', 'kafaa_reserve_requests')) === 0,
    'requests and engagements are not readable by staff, nor directly by HR (HR works through the desk RPC)');
  ok((await count('outage-manager', 'kafaa_reserve_requests')) === T.reserve_requests.filter((r) => r.posted_by === 'p-outage-manager').length && (await count('k-auditor', 'kafaa_reserve_requests')) === T.reserve_requests.length,
    'a manager reads their own requests; auditors read all');
  ok((await count('k-ro', 'kafaa_alumni_stories')) === T.alumni_stories.filter((s) => s.listed).length && (await count('k-ro', 'kafaa_alumni_stories', 'not listed')) === 0, 'staff read listed (consented) stories only');
  let direct = false;
  try { await as('outage-manager', `insert into kafaa_reserve_requests (id, posted_by, host_team_en, host_team_ar, engagement, title_en, title_ar, summary_en, summary_ar, hours_total, location_type, start_on, end_on) values ('x', 'p-outage-manager', 't', 't', 'mentor', 'x', 'x', 'x', 'x', 1, 'remote', current_date, current_date)`); } catch { direct = true; }
  ok(direct, 'reserve tables cannot be written directly (RPC only)');
  const contactCols = (await q(`select table_name, column_name from information_schema.columns where table_name = any($1) and column_name ~ '(email|phone|mobile|address|contact|photo)'`, [tabs]));
  ok(contactCols.length === 0, 'no contact column exists on any reserve table');

  // ── parity: validation, contact detection, bands, snapshots
  const base = { consent: true, availability: 'open', hours_month: 10, engagement_prefs: ['mentor'], finder_optin: true, headline_en: 'Veteran', headline_ar: 'خبير' };
  const joins = [base, { ...base, availability: 'sometimes' }, { ...base, hours_month: 41 }, { ...base, hours_month: 2.5 }, { ...base, engagement_prefs: [] }, { ...base, engagement_prefs: ['mentor', 'mentor'] },
    { ...base, engagement_prefs: ['contract'] }, { ...base, finder_optin: 'yes' }, { ...base, headline_en: 'x'.repeat(161) }, { ...base, headline_ar: 'mail a@b.ae' }, { ...base, headline_en: null, headline_ar: null }, { ...base, engagement_prefs: [1] }];
  let jd = 0;
  for (const p of joins) { const s = (await q('select kafaa_res_validate_join($1::jsonb) v', [JSON.stringify(p)]))[0].v; if (canon(s) !== canon(validateJoin(p))) { jd++; if (jd === 1) console.log('    join diff', JSON.stringify(p).slice(0, 120), canon(s), canon(validateJoin(p))); } }
  ok(jd === 0, `consent form validation: SQL = TS for ${joins.length} inputs`);
  const plus = (d, k) => (await_date(d, k));
  function await_date(d, k) { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + k); return t.toISOString().slice(0, 10); }
  const rb = { engagement: 'reviewer', title_en: 'Review of a plan', title_ar: 'مراجعة خطة', summary_en: 'A short independent review of the plan.', summary_ar: 'مراجعة مستقلة قصيرة للخطة المقترحة.', skills_needed: ['sk-ch-01'], hours_total: 10, seats: 1, location_type: 'remote', start_on: plus(today, 5), end_on: plus(today, 30) };
  const reqs = [rb, { ...rb, skills_needed: ['sk-sa-01'] }, { ...rb, location_type: 'protected_area' }, { ...rb, engagement: 'contract' }, { ...rb, title_ar: 'x' }, { ...rb, summary_en: 'short' },
    { ...rb, skills_needed: [] }, { ...rb, skills_needed: ['nope'] }, { ...rb, skills_needed: ['sk-ch-01', 'sk-ch-01'] }, { ...rb, hours_total: 0 }, { ...rb, seats: 4 }, { ...rb, seats: null }, { ...rb, start_on: plus(today, -1) },
    { ...rb, end_on: plus(today, 2) }, { ...rb, end_on: addMonths(rb.start_on, 13) }, { ...rb, start_on: '2026-02-30' }, { ...rb, summary_en: 'Call +971 50 123 4567 to agree it all.' }, { ...rb, title_en: 'Mail x@y.org now' }];
  let rd = 0;
  for (const p of reqs) { const s = (await q('select kafaa_res_validate_request($1::jsonb, current_date) v', [JSON.stringify(p)]))[0].v; if (canon(s) !== canon(validateRequest(p, T.skills, today))) { rd++; if (rd === 1) console.log('    request diff', JSON.stringify(p).slice(0, 160), canon(s), canon(validateRequest(p, T.skills, today))); } }
  ok(rd === 0, `reserve request validation: SQL = TS for ${reqs.length} inputs (restricted, invalid, contact data)`);
  const texts = ['a.b@example.org', '+971 50 123 4567', '00971501234567', 'mobile 050 123 4567', '02-123-4567', '2026-10-09 to 2026-12-31', '12 hours', 'APR-1400', 'Unit 4 in 2026', 'call 0501234567.'];
  const cd = [];
  for (const s of texts) if ((await q('select kafaa_res_contact($1) c', [s]))[0].c !== hasContactData(s)) cd.push(s);
  ok(cd.length === 0, `contact-data detection: SQL = TS for ${texts.length} strings${cd.length ? ` (diff: ${cd.join(' | ')})` : ''}`);
  const bands = [null, today, plus(today, -100), plus(today, -400), plus(today, -1200), plus(today, -1900), plus(today, 30)];
  let bd = 0;
  for (const d of bands) if ((await q('select kafaa_res_band($1::date, current_date) b', [d]))[0].b !== bandOf(d, today)) bd++;
  ok(bd === 0, 'time-since-leaving bands: SQL = TS');
  const people = ['p-sme-reviewer', 'p-k-ro', 'p-nse', 'w-mnt-08', 'p-sro', 'w-instr-01'];
  const skills = await rows('kafaa_skills');
  let sd = 0;
  for (const p of people) {
    const s = (await q('select kafaa_res_snapshot($1) s', [p]))[0].s;
    const st = (await q('select skill_id, level, basis, active from kafaa_person_skills where person_id = $1', [p]));
    if (canon(s) !== canon(snapshotFrom(st, skills))) sd++;
  }
  ok(sd === 0, `frozen skill snapshot: SQL = TS for ${people.length} people`);

  // ── parity: read models over the seeded rows (before any flow below changes them)
  const members = await rows('kafaa_alumni');
  const requests = await rows('kafaa_reserve_requests');
  const engs = await rows('kafaa_reserve_engagements');
  const statsSql = (await q('select kafaa_res_stats_compute(current_date) s'))[0].s;
  ok(canon(statsSql) === canon(computeStats(members, requests, engs, today)), 'HR stats: SQL = TS over the seed');
  ok(statsSql.by_kind.some((c) => c.suppressed && c.n === null) && [...statsSql.by_kind, ...statsSql.by_band, ...statsSql.by_family, ...statsSql.by_engagement].every((c) => c.suppressed || c.n >= 10),
    'every stats cell under 10 is suppressed');
  const sme = members.find((m) => m.id === 'alm:p-sme-reviewer');
  const boardSql = (await as('sme-reviewer', 'select kafaa_reserve_board() b'))[0].b;
  ok(canon(boardSql) === canon(computeBoard(sme, requests, engs)), 'alumni board: SQL = TS for the seeded pre-departure member');
  ok(boardSql.requests.every((r) => !('posted_by' in r) && !('poster_name' in r)) && boardSql.requests.length === T.reserve_requests.filter((r) => r.status === 'open').length,
    "the board lists open (HR-approved) requests only and never the poster's identity");
  ok((await as('k-ro', 'select kafaa_reserve_board() b'))[0].b === null && (await as('k-ro', 'select kafaa_reserve_desk() d'))[0].d === null && (await as('outage-manager', 'select kafaa_reserve_desk() d'))[0].d === null,
    'non-members get no board; the desk is HR-only');
  const desk = (await as('k-hr-analyst', 'select kafaa_reserve_desk() d'))[0].d;
  ok(desk.members.length === T.alumni.filter((m) => m.status === 'active').length && desk.erasures.length === T.alumni.filter((m) => m.status === 'withdrawn').length && desk.erasures.every((x) => !('name' in x)),
    'the HR desk lists active members and the erasure schedule (ids and dates only)');

  // ── flows
  const rpc = async (persona, sql, p = []) => (await as(persona, sql, p))[0].r;
  const reqIn = { ...rb, title_en: 'Validator reserve request', skills_needed: ['sk-ch-01', 'sk-ch-02-labqa'] };
  const emp = await rpc('nse', 'select kafaa_request_reserve($1::jsonb) r', [JSON.stringify(reqIn)]);
  const sec = await rpc('outage-manager', 'select kafaa_request_reserve($1::jsonb) r', [JSON.stringify({ ...reqIn, skills_needed: ['sk-sa-01'] })]);
  const ph = await rpc('outage-manager', 'select kafaa_request_reserve($1::jsonb) r', [JSON.stringify({ ...reqIn, summary_en: 'Ring 050 123 4567 to agree the details of this.' })]);
  ok(!emp.ok && emp.code === 'forbidden' && emp.message === ALMSG.forbidden_request && sec.code === 'restricted_kind' && ph.code === 'contact_data',
    'only managers request; restricted work and contact data are refused with the TS messages');
  const r1 = await rpc('outage-manager', 'select kafaa_request_reserve($1::jsonb) r', [JSON.stringify(reqIn)]);
  const rid = r1.data?.id;
  const b1 = (await as('sme-reviewer', 'select kafaa_reserve_board() b'))[0].b;
  const i0 = await rpc('sme-reviewer', 'select kafaa_reserve_interest($1, $2) r', [rid, '']);
  ok(r1.ok && r1.data.status === 'pending_hr' && !b1.requests.some((x) => x.id === rid) && !JSON.stringify(b1).includes('Validator reserve request') && i0.code === 'not_found',
    'a pending request is invisible to alumni (board and interest) until HR approves it');
  const self = await rpc('outage-manager', `select kafaa_decide_reserve_request($1, 'approve', '') r`, [rid]);
  const ap = await rpc('chco', `select kafaa_decide_reserve_request($1, 'approve', '') r`, [rid]);
  const b2 = (await as('sme-reviewer', 'select kafaa_reserve_board() b'))[0].b;
  const seen = b2.requests.find((x) => x.id === rid);
  ok(self.code === 'forbidden' && ap.ok && seen && seen.host_team_en === 'Outage Manager / Planner / Scheduler team' && !JSON.stringify(seen).includes('p-outage-manager'),
    "after HR approval the alumnus sees the request with the poster's team, never the poster");
  const i1 = await rpc('sme-reviewer', 'select kafaa_reserve_interest($1, $2) r', [rid, 'Happy to help']);
  const iDup = await rpc('sme-reviewer', 'select kafaa_reserve_interest($1, $2) r', [rid, '']);
  const iNote = await rpc('k-ro', 'select kafaa_reserve_interest($1, $2) r', [rid, '']);
  ok(i1.ok && iDup.code === 'conflict' && iNote.code === 'not_member', 'members express interest once; non-members are refused');
  const eid = i1.data.id;
  const preRead = await count('outage-manager', 'kafaa_reserve_engagements', `id = '${eid}'`);
  const preDone = await rpc('outage-manager', `select kafaa_decide_reserve_engagement($1, 'complete', 'Done well') r`, [eid]);
  const hand = await rpc('chco', `select kafaa_decide_reserve_engagement($1, 'approve', '') r`, [eid]);
  const postRead = await count('outage-manager', 'kafaa_reserve_engagements', `id = '${eid}' and alumni_name <> ''`);
  const reqAfter = (await q('select status, seats_taken, interest_count from kafaa_reserve_requests where id = $1', [rid]))[0];
  ok(preRead === 0 && preDone.code === 'not_found' && hand.ok && hand.data.status === 'handed_to_hr' && postRead === 1 && reqAfter.status === 'filled' && reqAfter.seats_taken === 1,
    'the poster reads the engagement only after HR hands it over; the request fills');
  const done = await rpc('outage-manager', `select kafaa_decide_reserve_engagement($1, 'complete', 'Review delivered with six findings.') r`, [eid]);
  ok(done.ok && done.data.status === 'completed', 'the poster confirms the outcome');
  // maker-checker: chco joins, shows interest in a second request and cannot hand themselves over
  const r2 = await rpc('outage-manager', 'select kafaa_request_reserve($1::jsonb) r', [JSON.stringify({ ...reqIn, title_en: 'Validator reserve request two' })]);
  await rpc('k-hr-analyst', `select kafaa_decide_reserve_request($1, 'approve', '') r`, [r2.data.id]);
  const cj = await rpc('chco', 'select kafaa_join_reserve($1::jsonb) r', [JSON.stringify(base)]);
  const ci = await rpc('chco', 'select kafaa_reserve_interest($1, $2) r', [r2.data.id, '']);
  const cm = await rpc('chco', `select kafaa_decide_reserve_engagement($1, 'approve', '') r`, [ci.data?.id]);
  const ka = await rpc('k-hr-analyst', `select kafaa_decide_reserve_engagement($1, 'approve', '') r`, [ci.data?.id]);
  ok(cj.ok && ci.ok && cm.code === 'maker_checker' && cm.message === ALMSG.maker_checker && ka.ok, 'HR approval is maker-checker: never an engagement involving the approver');
  // withdrawal hides everywhere at once and schedules erasure
  const sj = await rpc('sec-compliance', 'select kafaa_join_reserve($1::jsonb) r', [JSON.stringify(base)]);
  const qj = await rpc('qc-inspector', 'select kafaa_join_reserve($1::jsonb) r', [JSON.stringify(base)]);
  const r3 = await rpc('outage-manager', 'select kafaa_request_reserve($1::jsonb) r', [JSON.stringify({ ...reqIn, title_en: 'Validator reserve request three' })]);
  await rpc('chco', `select kafaa_decide_reserve_request($1, 'approve', '') r`, [r3.data.id]);
  const qi = await rpc('qc-inspector', 'select kafaa_reserve_interest($1, $2) r', [r3.data.id, '']);
  const qid = qj.data?.id;
  const seenBefore = await count('k-ro', 'kafaa_alumni', `id = '${qid}'`);
  const w = await rpc('qc-inspector', 'select kafaa_join_reserve($1::jsonb) r', [JSON.stringify({ consent: false })]);
  const row = (await q('select status, finder_visible, erase_after::text e, withdrawn_on::text w from kafaa_alumni where id = $1', [qid]))[0];
  const engRow = (await q('select status, alumni_name from kafaa_reserve_engagements where id = $1', [qi.data?.id]))[0];
  const deskAfter = (await as('chco', 'select kafaa_reserve_desk() d'))[0].d;
  const bAfter = (await as('qc-inspector', 'select kafaa_reserve_board() b'))[0].b;
  const ledgerAudit = (await q(`select ledger_status from kafaa_audit_events where action = 'reserve.withdraw' and entity_id = $1 order by seq desc limit 1`, [qid]))[0];
  ok(sj.code === 'restricted_kind' && qj.ok && qi.ok && seenBefore === 1 && w.ok && (await count('k-ro', 'kafaa_alumni', `id = '${qid}'`)) === 0
    && row.status === 'withdrawn' && !row.finder_visible && row.e === addMonths(today, 6) && row.w === today && engRow.status === 'withdrawn' && engRow.alumni_name === ''
    && !deskAfter.members.some((m) => m.id === qid) && deskAfter.erasures.some((x) => x.id === qid && x.erase_after === addMonths(today, 6)) && bAfter.requests.length === 0 && !!ledgerAudit,
    'withdrawing consent hides the alumnus everywhere at once (finder, desk, board, engagements anonymised) and schedules erasure after six months');
  const storyId = T.alumni_stories.find((s) => s.listed).id;
  await db.query(`update kafaa_alumni_stories set alumni_id = 'alm:p-sme-reviewer' where id = $1`, [storyId]);
  await rpc('sme-reviewer', 'select kafaa_join_reserve($1::jsonb) r', [JSON.stringify({ consent: false })]);
  ok((await count('k-ro', 'kafaa_alumni_stories', `id = '${storyId}'`)) === 0, "a withdrawn member's stories are unlisted at once");
  const refusals = (await q(`select count(*)::int n from kafaa_audit_events where action like 'reserve.%' and outcome = 'refused'`))[0].n;
  const leaks = (await q(`select count(*)::int n from kafaa_alumni a where to_jsonb(a)::text ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}'`))[0].n;
  ok(refusals >= 8 && leaks === 0, 'every refusal is audited; no email address is stored in the reserve');
}
