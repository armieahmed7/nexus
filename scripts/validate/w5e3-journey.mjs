// [W5 · E3 · F34] PGlite checks for 20261009153001_kafaa_w5e3_journey.sql: public explorer questions and board facts (every fact
// with a source and an as-of date), own-only journeys and portfolio (no HR, auditor, university or anonymous row reads), SQL = TS
// parity of the explorer on every seeded journey and of the HR aggregate (cells under 10 suppressed), kafaa_save_student_journey
// (RBAC, validation messages, clear without removal, audit without ledger) and kafaa_issue_starter_credentials (HR director only,
// portfolio rows + notices, ledger, nothing left to issue afterwards).
import { readFileSync } from 'node:fs';
import { computeJourneyAggregate, exploreInterests, explorerFamilies, journeyPayload, validateJourneyInput } from '../../src/modules/m06/journey.ts';

const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${k}:${canon(v[k])}`).join(',')}}` : JSON.stringify(v ?? null));

export default async function w5e3Checks({ db, as, one, count, ok, uid }) {
  console.log('W5E3 · F34 student-to-career journey');
  const T = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables;
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  // Test identities (fixed uids 5301+; reuse a profile another check already created for the persona).
  let n = 5300;
  for (const [persona, role, lens] of [['k-student', 'Applicant', 'public'], ['k-graduate', 'Applicant', 'public'], ['nse', 'Nuclear Safety Engineer', 'employee'], ['k-university', 'University', 'partner'], ['k-auditor', 'Auditor', 'employee']]) {
    n++;
    const row = (await q('select user_id from profiles where persona_id = $1', [persona]))[0];
    if (row) { uid[persona] = row.user_id; continue; }
    uid[persona] = `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    await db.query('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, persona === 'k-university' ? 'ku' : 'enec-ops', lens, [role]]);
  }
  const rpc = async (persona, sql, p) => (await one(persona, `select ${sql} as r`, p)).r;
  const familySort = Object.fromEntries((await q('select id, sort from kafaa_job_families')).map((r) => [r.id, r.sort]));
  const questions = await q('select id, sort, prompt_en, prompt_ar, options from kafaa_journey_questions order by sort');

  // ── public reference data
  const pubQ = await as(null, 'select * from kafaa_journey_questions order by sort');
  const facts = await as(null, `select f.*, s.url, s.label from kafaa_journey_facts f left join kafaa_sources s on s.id = f.source_id order by f.step, f.sort`);
  ok(pubQ.length === 10 && pubQ.every((x) => Array.isArray(x.options) && x.options.length >= 3 && x.prompt_ar && x.options.every((o) => o.ar && o.en && Array.isArray(o.families))), 'anonymous visitors read the 10 explorer questions (EN and AR, every option names its job families)');
  ok(facts.length === T.journey_facts.length && facts.every((f) => /^https:\/\//.test(f.url ?? '') && f.as_of), `every one of the ${facts.length} journey-board facts has a public source and an as-of date`);
  const dnt = facts.filter((f) => f.programme_id === 'dnt').map((f) => f.text_en).join(' ');
  ok(/24 months/.test(dnt) && /cohort of 20 graduated on 17 June 2026/.test(dnt), 'the DNT facts state 24 months and the first cohort of 20 graduating in June 2026');
  ok(['explore', 'mustaqbali', 'route', 'first_role'].every((s) => facts.some((f) => f.step === s)), 'every board station carries at least one sourced fact');
  ok(T.journey_facts.every((f) => f.source_id && T.sources.some((s) => s.id === f.source_id)) && (await count(null, 'kafaa_journey_facts', 'source_id not in (select id from kafaa_sources)')) === 0, 'facts cite the shared source registry');

  // ── own rows only
  ok((await count(null, 'kafaa_student_journeys')) === 0 && (await count(null, 'kafaa_student_portfolio')) === 0, 'anonymous visitors read no journeys and no portfolio');
  const mine = await as('k-student', 'select person_id from kafaa_student_journeys');
  const minePf = await as('k-student', 'select person_id from kafaa_student_portfolio');
  ok(mine.length === 1 && mine[0].person_id === 'p-k-student' && minePf.length > 0 && minePf.every((r) => r.person_id === 'p-k-student'), 'a student reads only their own journey and portfolio');
  ok((await count('chco', 'kafaa_student_journeys', `person_id <> kafaa_me()`)) === 0 && (await count('k-hr-analyst', 'kafaa_student_journeys')) === 0 && (await count('k-auditor', 'kafaa_student_journeys')) === 0
    && (await count('chco', 'kafaa_student_portfolio')) === 0 && (await count('training-mgr', 'kafaa_student_journeys')) === 0,
    'HR (director A, analyst Agg), auditors and training staff read no individual journey or portfolio row (open_read stays false)');
  ok((await count('k-university', 'kafaa_student_journeys')) === 0 && (await count('k-university', 'kafaa_student_portfolio')) === 0
    && (await as('k-university', 'select consent_university from kafaa_scholars')).every((s) => s.consent_university === true),
    'a university reads no journeys; its scholar view stays consenting-only (existing M10 rule)');
  let direct = false;
  try { await as('k-student', `insert into kafaa_student_journeys (id, person_id) values ('sj-x', 'p-k-student')`); } catch { direct = true; }
  let directUpd = false;
  try { const r = await as('k-student', `update kafaa_student_journeys set route = 'gpo' where person_id = 'p-k-student' returning id`); directUpd = r.length === 0; } catch { directUpd = true; }
  let openRead = false;
  try { await db.query(`update kafaa_student_journeys set open_read = true where id = 'sj-p-k-student'`); } catch { openRead = true; }
  ok(direct && directUpd && openRead, 'journeys are written only through the RPC, and open_read can never be switched on (check constraint)');

  // ── SQL = TS: explorer on every seeded journey
  const seeded = await q(`select id, interests from kafaa_student_journeys where cleared_at is null order by id`);
  let same = 0, diff = [];
  for (const j of seeded) {
    const sql = (await q('select kafaa_sj_explore($1::jsonb) r', [JSON.stringify(j.interests?.answers ?? {})]))[0].r;
    const ts = exploreInterests(questions, j.interests?.answers ?? {}, familySort);
    const tsOut = { families: ts.families.map((f) => f.id), route: ts.route, answered: ts.answered };
    if (canon(sql) === canon(tsOut) && canon(sql.families) === canon(j.interests?.families ?? [])) same++; else diff.push(j.id);
  }
  ok(seeded.length > 100 && diff.length === 0, `SQL explorer = TS explorer = stored families on all ${same} seeded journeys${diff.length ? ` (diff ${diff.slice(0, 3)})` : ''}`);
  const probes = [{}, { q01: 'a' }, { q04: 'c', q09: 'd' }, { q01: 'b', q03: 'c', q06: 'b', q08: 'a', q10: 'b' }, { q02: 'c', q07: 'd', q10: 'd', q05: 'b' }, { q09: 'b', q01: 'c', q07: 'c', q10: 'c' }];
  let probeOk = true;
  for (const a of probes) {
    const sql = (await q('select kafaa_sj_explore($1::jsonb) r', [JSON.stringify(a)]))[0].r;
    const ts = exploreInterests(questions, a, familySort);
    if (canon(sql) !== canon({ families: ts.families.map((f) => f.id), route: ts.route, answered: ts.answered })) probeOk = false;
  }
  ok(probeOk, 'SQL = TS on edge cases (no answers, one answer, "not sure" answers, ties broken by job-family order)');
  const bads = [null, [], { stage: 'nursery' }, { route: 'ku-msc' }, { answers: [] }, { answers: { q99: 'a' } }, { answers: { q01: 'z' } }, { answers: { q01: 1 } }, { answers: { q99: 'a', q01: 'z' } },
    { checklist: [] }, { checklist: { 'BAD KEY': 'done' } }, { checklist: { 'prep:dnt:x': 'maybe' } }, { checklist: Object.fromEntries(Array.from({ length: 41 }, (_, i) => [`k${i}`, 'done'])) },
    { clear: true }, { stage: 'school', answers: { q01: 'a' }, checklist: { 'prep:dnt:practice': 'done' } }];
  let valOk = true;
  for (const b of bads) {
    const sql = (await q('select kafaa_sj_validate($1::jsonb) r', [b === null ? null : JSON.stringify(b)]))[0].r;
    if ((sql ?? null) !== (validateJourneyInput(questions, b) ?? null)) { valOk = false; console.log('   validate differs', JSON.stringify(b), sql, validateJourneyInput(questions, b)); }
  }
  ok(valOk, 'SQL and TS refuse the same inputs with the same message (stage, route, answers, checklist, clear)');

  // ── HR aggregate: SQL = TS, suppressed below 10
  const appRows = await q('select person_id, programme_id, stage from kafaa_applications');
  const tsAgg = async (canAct) => computeJourneyAggregate({
    journeys: (await q('select person_id, stage, route, interests, cleared_at from kafaa_student_journeys')),
    applications: appRows, portfolio: await q('select id, person_id, kind, status from kafaa_student_portfolio'), families: explorerFamilies(questions, familySort),
  }, canAct);
  const hr = await rpc('k-hr-analyst', 'kafaa_journey_aggregate()');
  const dir = await rpc('chco', 'kafaa_journey_aggregate()');
  const aud = await rpc('k-auditor', 'kafaa_journey_aggregate()');
  ok(hr.ok && canon(hr.data) === canon(await tsAgg(false)) && dir.ok && canon(dir.data) === canon(await tsAgg(true)), 'kafaa_journey_aggregate = computeJourneyAggregate (analyst view and director view)');
  const cells = [hr.data.total, hr.data.routed, hr.data.applied, hr.data.credentials, ...hr.data.by_stage, ...hr.data.by_route, ...hr.data.by_family];
  ok(cells.every((c) => (c.suppressed ? c.n === null : c.n >= 10)) && cells.some((c) => c.suppressed) && cells.some((c) => !c.suppressed), 'every aggregate cell is null and flagged below 10 (both kinds present in the seed)');
  ok(hr.data.pending_credentials === null && dir.data.pending_credentials === 3 && aud.ok && aud.data.pending_credentials === null, 'only the HR director (applications A) sees the starter-credential queue (3 waiting); analysts and auditors do not');
  ok(!JSON.stringify(hr.data).includes('"p-') && !/"a-\d|"ap-\d/.test(JSON.stringify(dir.data)), 'the aggregate carries no person id');
  const stu = await rpc('k-student', 'kafaa_journey_aggregate()');
  const mgr = await rpc('training-mgr', 'kafaa_journey_aggregate()');
  let anon = false;
  try { await as(null, 'select kafaa_journey_aggregate()'); } catch { anon = true; }
  const refusedAud = (await q(`select count(*)::int n from kafaa_audit_events where action = 'journey.aggregate' and outcome = 'refused'`))[0].n;
  ok(!stu.ok && stu.code === 'forbidden' && !mgr.ok && mgr.code === 'forbidden' && anon && refusedAud >= 2, 'students, training staff and anonymous callers cannot read the aggregate; refusals are audited');

  // ── save, update and clear my journey
  const led0 = (await q('select count(*)::int n from ledger_entries'))[0].n;
  const input = { stage: 'finishing_school', route: 'dnt', answers: { q01: 'a', q03: 'b', q06: 'a', q09: 'a', q02: 'a' }, checklist: { 'prep:dnt:practice': 'done', 'elig:dnt:0': 'yes' } };
  const saved = await rpc('k-student', 'kafaa_save_student_journey($1::jsonb)', [JSON.stringify(input)]);
  const row = (await q(`select * from kafaa_student_journeys where id = 'sj-p-k-student'`))[0];
  const p = journeyPayload(questions, input, familySort);
  const audSave = (await q(`select outcome, ledger_status, reason from kafaa_audit_events where action = 'journey.save' order by seq desc limit 1`))[0];
  ok(saved.ok && canon(row.interests) === canon(p.interests) && canon(row.milestones) === canon(p.milestones) && row.route === 'dnt' && row.stage === 'finishing_school'
    && canon(saved.data.families) === canon(p.interests.families) && audSave.outcome === 'ok' && audSave.ledger_status === 'not_applicable'
    && audSave.reason === `stage finishing_school, route dnt, ${p.interests.families.length} families, 2 checklist items` && (await q('select count(*)::int n from ledger_entries'))[0].n === led0,
    'saving stores the server-computed families (= TS) and the checklist, audited without a ledger write');
  const spoof = await rpc('k-student', 'kafaa_save_student_journey($1::jsonb)', [JSON.stringify({ ...input, interests: { families: ['security'] }, person_id: 'p-k-graduate' })]);
  ok(spoof.ok && (await q(`select interests from kafaa_student_journeys where id = 'sj-p-k-student'`))[0].interests.families.every((f) => f !== 'security')
    && canon((await q(`select interests from kafaa_student_journeys where id = 'sj-p-k-graduate'`))[0].interests) === canon(T.student_journeys.find((j) => j.id === 'sj-p-k-graduate').interests),
    'client-sent families or person ids are ignored: the row is always the caller\'s and the families come from the answers');
  const inv = await rpc('k-student', 'kafaa_save_student_journey($1::jsonb)', [JSON.stringify({ answers: { q01: 'z' } })]);
  const forb = await rpc('k-university', 'kafaa_save_student_journey($1::jsonb)', [JSON.stringify(input)]);
  let anonSave = false;
  try { await as(null, `select kafaa_save_student_journey('{}'::jsonb)`); } catch { anonSave = true; }
  ok(!inv.ok && inv.code === 'invalid' && inv.message === 'Unknown answer' && !forb.ok && forb.code === 'forbidden' && anonSave, 'invalid answers are refused; partners and anonymous callers cannot save a journey');
  const emp = await rpc('nse', 'kafaa_save_student_journey($1::jsonb)', [JSON.stringify({ stage: 'graduate', answers: { q09: 'c' } })]);
  ok(emp.ok && emp.data.route === null && (await count('nse', 'kafaa_student_journeys')) === 1, 'an employee (applications Own) can save a journey too, readable only by them');
  const clr = await rpc('k-student', 'kafaa_save_student_journey($1::jsonb)', [JSON.stringify({ clear: true })]);
  const after = (await q(`select * from kafaa_student_journeys where id = 'sj-p-k-student'`))[0];
  ok(clr.ok && clr.data.cleared && after && after.cleared_at && after.route === null && canon(after.interests) === '{}' && (await q(`select count(*)::int n from kafaa_audit_events where action = 'journey.clear'`))[0].n >= 1,
    'clearing keeps the row but empties it (never removed), audited');

  // ── starter credentials
  const queued = (await q(`select array_agg(distinct person_id order by person_id) a from kafaa_applications a where programme_id = 'mustaqbali' and stage = 'accepted' and not exists (select 1 from kafaa_student_portfolio s where s.id = 'spf-' || a.person_id || '-mustaqbali')`))[0].a ?? [];
  const an = await rpc('k-hr-analyst', 'kafaa_issue_starter_credentials()');
  const led1 = (await q('select count(*)::int n from ledger_entries'))[0].n;
  const audBefore = (await q('select count(*)::int n from kafaa_audit_events'))[0].n;
  const iss = await rpc('chco', 'kafaa_issue_starter_credentials()');
  const audAfter = (await q('select count(*)::int n from kafaa_audit_events'))[0].n;
  const rows = await q(`select * from kafaa_student_portfolio where person_id = any($1::text[]) and kind = 'microcred'`, [queued]);
  const notes = await q(`select * from kafaa_notifications where id = any($1::text[])`, [queued.map((p) => `nt-spf-${p}-mustaqbali`)]);
  const audIss = (await q(`select ledger_status, reason from kafaa_audit_events where action = 'journey.starter_credentials' and outcome = 'ok' order by seq desc limit 1`))[0];
  ok(!an.ok && an.code === 'forbidden' && iss.ok && iss.data.issued === queued.length && queued.length === 3 && rows.length === 3 && rows.every((r) => r.status === 'issued' && r.microcred_def_id === 'mc-student-mustaqbali' && r.sample)
    && notes.length === 3 && audIss.reason === 'issued 3' && audAfter === audBefore + 1 && (await q('select count(*)::int n from ledger_entries'))[0].n === led1 + 1 && audIss.ledger_status === 'written',
    'the HR director issues the 3 waiting starter credentials (portfolio rows + notices, one audit row, one ledger row); the analyst is refused');
  const again = await rpc('chco', 'kafaa_issue_starter_credentials()');
  ok(!again.ok && again.code === 'not_found', 'nothing is issued twice');
  const portfolioRead = await as('chco', `select count(*)::int n from kafaa_student_portfolio`);
  ok(portfolioRead[0].n === 0, 'issuing does not let the HR director read the portfolio rows');
}
