// [W4 · E4 · F30] PGlite checks for 20261009144001_kafaa_w4e4_lrs.sql: SQL = TS for the seeded statements (emitters) and the
// profile validator, append-only store, RLS (own / scope / auditor; analytics aggregate only), the emitters on real RPCs (course
// completion emits exactly one completed statement, refresher answers carry no item id), storeStatement, queryStatements
// (a manager cannot read people outside scope), exportStatements and the suppressed aggregate.
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { ACTIVITY_TYPE_IRI, EXT, VERB_IRI, XAPI_HOME, activityIri, containsId, lrsAggregateOf, validateStatement, xapiId } from '../../src/modules/m27/xapi.ts';

const sortKeys = (v) => (Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' && !(v instanceof Date) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v);
const t = (x) => (x == null ? null : new Date(x).getTime());
const norm = (r) => JSON.stringify([r.id, r.actor_person_id, r.verb, r.object_type, r.object_id, sortKeys(r.object_name), sortKeys(r.result ?? null), sortKeys(r.context), t(r.occurred_at), t(r.stored_at), r.source, r.source_ref, r.stored_by ?? null, r.version]);

export default async function w4e4Checks({ db, as, one, count, ok }) {
  const seed = JSON.parse(readFileSync('src/seed/seed.json', 'utf8'));
  const T = seed.tables;
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  const secure = T.items.filter((i) => i.bank === 'secure').map((i) => i.id);

  // ── fresh database: the SQL emitters reproduce the seeded (TS) statements exactly; the validator agrees with the TS profile
  const fresh = new PGlite();
  await fresh.exec(readFileSync('supabase/tests/nexus_stubs.sql', 'utf8'));
  for (const m of readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()) await fresh.exec(readFileSync(`supabase/migrations/${m}`, 'utf8'));
  await fresh.exec(readFileSync('supabase/seed.sql', 'utf8'));
  const fq = async (sql, p = []) => (await fresh.query(sql, p)).rows;
  const sqlRows = await fq(`select * from kafaa_xapi_source_rows() order by id collate "C"`);
  const seedRows = [...T.xapi_statements].sort((a, b) => (a.id < b.id ? -1 : 1));
  const diff = sqlRows.filter((r, i) => !seedRows[i] || norm(r) !== norm(seedRows[i]));
  ok(sqlRows.length === seedRows.length && diff.length === 0, `SQL emitters (kafaa_xapi_source_rows) equal the TS emitters for all ${seedRows.length} seeded statements${diff.length ? `; first diff ${diff[0].id}` : ''}`);
  const loaded = await fq(`select * from kafaa_xapi_statements order by id collate "C"`);
  ok(loaded.length === seedRows.length && loaded.every((r, i) => norm(r) === norm(seedRows[i])), 'the seed loads every statement unchanged, and seeding fires no emitter (no extra rows)');
  ok((await fq(`select kafaa_xapi_backfill() n`))[0].n === 0, 'the backfill is idempotent: nothing to add on the seeded store');
  const bySrc = Object.fromEntries((await fq(`select source, count(*)::int n from kafaa_xapi_statements group by source`)).map((r) => [r.source, r.n]));
  ok(['m04_course', 'f14_refresher', 'f08_opportunity', 'f15_rotation', 'f15_shadowing', 'm05_jpm', 'f13_mentoring', 'f21_knowledge'].every((s) => bySrc[s] > 0), `every live emitter has seeded statements (${Object.entries(bySrc).map(([k, v]) => `${k} ${v}`).join(', ')})`);
  ok((await fq(`select kafaa_xapi_id('m04_course', 'tr-1') id`))[0].id === xapiId('m04_course', 'tr-1'), 'statement ids are the same deterministic UUID in SQL and TS');

  const people = new Set(T.people.map((p) => p.id));
  const env = { isPerson: (id) => people.has(id), secureItemIds: secure, now: new Date() };
  const base = () => ({
    id: '2f6d1c3e-9a4b-4c1d-8e2f-1a2b3c4d5e6f',
    actor: { objectType: 'Agent', account: { homePage: XAPI_HOME, name: 'p-k-admin' } },
    verb: { id: VERB_IRI.completed, display: { 'en-US': 'completed', 'ar-AE': 'أكمل' } },
    object: { objectType: 'Activity', id: activityIri('course', 'c-get'), definition: { name: { 'en-US': 'General Employee Training' }, type: ACTIVITY_TYPE_IRI.course } },
    result: { completion: true, success: true, score: { scaled: 0.9, raw: 90, min: 0, max: 100 }, duration: 'PT2H30M' },
    context: { platform: "Kafa'a", language: 'en', registration: '7e1c2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f', extensions: { [`${EXT}note`]: 'console test' } },
    timestamp: '2026-10-01T09:00:00Z', version: '2.0.0',
  });
  const mut = (f) => { const s = base(); f(s); return s; };
  const fixtures = [
    base(), 'not an object', [], null,
    mut((s) => { s.context.extensions[`${EXT}big`] = 'x'.repeat(9000); }),
    mut((s) => { s.stored = '2026-10-01T09:00:00Z'; s.authority = {}; s.foo = 1; }),
    mut((s) => { s.id = 'abc'; }), mut((s) => { delete s.actor; }), mut((s) => { s.actor.objectType = 'Group'; }),
    mut((s) => { s.actor.mbox = 'mailto:someone@example.com'; s.actor.mbox_sha1sum = 'x'; }), mut((s) => { s.actor.name = 'A person'; s.actor.extra = 1; }),
    mut((s) => { delete s.actor.account; }), mut((s) => { s.actor.account.homePage = 'https://elsewhere.example'; }), mut((s) => { s.actor.account.name = 'nobody'; }),
    mut((s) => { delete s.verb; }), mut((s) => { s.verb.id = 'http://adlnet.gov/expapi/verbs/liked'; s.verb.display = 'done'; s.verb.x = 1; }),
    mut((s) => { delete s.object; }), mut((s) => { s.object.objectType = 'Agent'; }), mut((s) => { s.object.id = 'urn:course:c-get'; }),
    mut((s) => { s.object.id = activityIri('item', 'it-basics-01'); }), mut((s) => { s.object.id = `${activityIri('course', 'c-get')}/x`; }),
    mut((s) => { s.object.definition = { name: { 'en-US': 5 }, type: 'not-an-iri', moreInfo: 'x' }; s.object.extra = 1; }), mut((s) => { s.object.definition = 'x'; }),
    mut((s) => { s.object.id = activityIri('course', secure[0]); }), mut((s) => { s.context.extensions[`${EXT}note`] = `see ${secure[1]} please`; }),
    mut((s) => { s.result.response = 'B'; s.result.success = 'yes'; s.result.duration = 'two hours'; }), mut((s) => { s.result.score.scaled = 2; }),
    mut((s) => { s.result.score = { raw: 120, min: 0, max: 100 }; }), mut((s) => { s.result.score = { raw: '90' }; s.result.extensions = { note: 1 }; s.result.extra = 1; }), mut((s) => { s.result = 'ok'; }),
    mut((s) => { s.context.registration = 'r-1'; s.context.platform = 'p'.repeat(50); s.context.extensions = { note: 1 }; s.context.instructor = { name: 'x' }; }), mut((s) => { s.context = []; }),
    mut((s) => { s.timestamp = 'yesterday'; }), mut((s) => { s.timestamp = '2031-01-01T00:00:00Z'; }), mut((s) => { s.version = '0.9'; }),
    mut((s) => { delete s.id; delete s.result; delete s.context; delete s.timestamp; delete s.version; s.object.definition = { name: { 'ar-AE': 'تدريب' } }; }),
  ];
  const pd = [];
  for (const [i, f] of fixtures.entries()) {
    const ts = validateStatement(f, env).errors.map((e) => `${e.path}|${e.code}`).sort();
    const sq = (await fq(`select kafaa_xapi_validate($1::jsonb) e`, [JSON.stringify(f)]))[0].e.map((e) => `${e.path}|${e.code}`).sort();
    if (JSON.stringify(ts) !== JSON.stringify(sq)) pd.push(`#${i}: TS ${ts.join(',')} / SQL ${sq.join(',')}`);
  }
  ok(pd.length === 0, `kafaa_xapi_validate = validateStatement on ${fixtures.length} fixtures (valid, minimal and ${fixtures.length - 2} invalid)${pd.length ? `; ${pd[0]}` : ''}`);
  await fresh.close();

  // ── RLS: own rows, scope rows, auditors all; analytics roles read no rows directly; anonymous nothing
  const total = (await q(`select count(*)::int n from kafaa_xapi_statements`))[0].n;
  ok((await count(null, 'kafaa_xapi_statements')) === 0, 'anonymous visitors read no statements');
  const sroOthers = await as('sro', `select distinct p.crew from kafaa_xapi_statements s join kafaa_people p on p.id = s.actor_person_id where s.actor_person_id <> kafaa_me()`);
  ok(sroOthers.length > 0 && sroOthers.every((r) => r.crew === 'B'), 'a shift manager reads statements of crew B only (plus their own)');
  ok((await count('k-auditor', 'kafaa_xapi_statements')) === total, `auditors read every statement (${total})`);
  ok((await count('k-hr-analyst', 'kafaa_xapi_statements', 'actor_person_id <> kafaa_me()')) === 0 && (await count('chco', 'kafaa_xapi_statements', 'actor_person_id <> kafaa_me()')) === 0,
    'HR analytics roles read no one else\'s statements directly (aggregate only)');
  ok((await count('alnoor-gm', 'kafaa_xapi_statements')) === 0 && (await count('k-observer', 'kafaa_xapi_statements')) === 0, 'partners and observers read no statements');

  // ── append-only
  let upd = false, ins = false, upd2 = false;
  try { await q(`update kafaa_xapi_statements set verb = 'passed' where id = (select id from kafaa_xapi_statements limit 1)`); } catch { upd = true; }
  try { await as('k-admin', `insert into kafaa_xapi_statements (id, actor_person_id, verb, object_type, object_id, occurred_at, source, source_ref) values ('x', 'p-k-admin', 'completed', 'course', 'c-get', now(), 'console', 'x')`); } catch { ins = true; }
  try { const r = await as('k-auditor', `update kafaa_xapi_statements set verb = 'passed' returning id`); upd2 = r.length === 0; } catch { upd2 = true; }
  ok(upd && ins && upd2, 'statements are immutable: the append-only trigger refuses updates, and API roles can neither insert nor update directly');

  // ── emitter: completing a course in M04 emits exactly one completed statement
  const cand = (await q(`select e.id, e.person_id from kafaa_enrolments e join kafaa_courses c on c.id = e.course_id left join kafaa_sessions s on s.id = e.session_id
    where e.status in ('enrolled', 'in_progress') and not c.qualifying and c.pass_mark is null and (e.session_id is null or s.kind = 'elearning' or e.attendance = 'present')
      and e.person_id <> 'p-training-mgr' order by e.id limit 1`))[0];
  if (cand) {
    const before = (await q(`select count(*)::int n from kafaa_xapi_statements where actor_person_id = $1`, [cand.person_id]))[0].n;
    const done = (await one('training-mgr', `select kafaa_complete_enrolment($1, 'completed', null, 'LRS check') r`, [cand.id])).r;
    const again = (await one('training-mgr', `select kafaa_complete_enrolment($1, 'completed', null, 'LRS check') r`, [cand.id])).r;
    const after = await q(`select * from kafaa_xapi_statements where actor_person_id = $1 and source = 'm04_course' and source_ref = $2`, [cand.person_id, done.data?.record_id ?? '']);
    const n = (await q(`select count(*)::int n from kafaa_xapi_statements where actor_person_id = $1`, [cand.person_id]))[0].n;
    ok(done.ok && !again.ok && after.length === 1 && after[0].verb === 'completed' && after[0].object_type === 'course' && n === before + 1 && after[0].stored_by === null,
      `completing a course (${cand.id}) emits exactly one completed statement; a second completion is refused and emits nothing`);
  } else ok(false, 'a course enrolment to complete exists in the seed');

  // ── emitter: refresher answers carry no item id; JPM results are recorded
  const item = (await q(`select i.id, v.answer from kafaa_items i join kafaa_item_versions v on v.item_id = i.id and v.version = i.current_version where i.bank = 'practice' and i.is_practice and i.status = 'approved' and i.competency_id is not null order by i.id limit 1`))[0];
  const r0 = (await q(`select count(*)::int n from kafaa_xapi_statements where source = 'f14_refresher' and actor_person_id = 'p-sro'`))[0].n;
  const sub1 = (await one('sro', `select kafaa_submit_refresher($1::jsonb) r`, [JSON.stringify([{ item_id: item.id, answer: item.answer }])])).r;
  const sub2 = (await one('sro', `select kafaa_submit_refresher($1::jsonb) r`, [JSON.stringify([{ item_id: item.id, answer: item.answer }])])).r;
  const rs = await q(`select * from kafaa_xapi_statements where source = 'f14_refresher' and actor_person_id = 'p-sro'`);
  ok(sub1.ok && sub2.ok && rs.length === r0 + 2 && rs.every((s) => !JSON.stringify(s).includes(item.id)), 'each refresher answer emits one answered statement, and no statement carries the practice item id');
  ok((await q(`select count(*)::int n from kafaa_xapi_statements s join kafaa_jpm_results j on j.id = s.source_ref where s.source = 'm05_jpm'`))[0].n >= (await q(`select count(*)::int n from kafaa_jpm_results`))[0].n,
    'every JPM result (including the one recorded earlier in this run) has its statement');

  // ── storeStatement (admin test console)
  const good = { ...base(), actor: { objectType: 'Agent', account: { homePage: XAPI_HOME, name: 'p-k-admin' } } };
  delete good.id;
  const st1 = (await one('k-admin', `select kafaa_store_statement($1::jsonb) r`, [JSON.stringify(good)])).r;
  const row = st1.ok ? (await q(`select * from kafaa_xapi_statements where id = $1`, [st1.data.id]))[0] : null;
  ok(st1.ok && row?.source === 'console' && row.stored_by === 'p-k-admin' && row.verb === 'completed' && row.object_id === 'c-get' && row.context.platform === undefined, 'an admin stores a valid statement about themselves from the test console');
  const bad = (await one('k-admin', `select kafaa_store_statement($1::jsonb) r`, [JSON.stringify({ ...good, actor: { mbox: 'mailto:x@example.com' } })])).r;
  const aud = (await q(`select outcome, reason from kafaa_audit_events where action = 'lrs.store' order by seq desc limit 1`))[0];
  ok(!bad.ok && bad.code === 'schema_error' && /mbox_not_allowed/.test(bad.message) && aud.outcome === 'refused', 'an invalid statement is refused with a schema error and the refusal is audited');
  const other = (await one('k-admin', `select kafaa_store_statement($1::jsonb) r`, [JSON.stringify({ ...good, actor: { account: { homePage: XAPI_HOME, name: 'w-ro-01' } } })])).r;
  const dup = (await one('k-admin', `select kafaa_store_statement($1::jsonb) r`, [JSON.stringify({ ...good, id: st1.data?.id })])).r;
  const notAdmin = (await one('sro', `select kafaa_store_statement($1::jsonb) r`, [JSON.stringify(good)])).r;
  let anonStore = false;
  try { await as(null, `select kafaa_store_statement('{}'::jsonb)`); } catch { anonStore = true; }
  ok(other.code === 'not_self' && dup.code === 'conflict' && notAdmin.code === 'forbidden' && anonStore, 'console refusals: another person (not_self), an existing id (conflict), non-admins (forbidden), anonymous (no execute)');

  // ── queryStatements: scope enforced, audited reads of others
  const crewA = (await q(`select s.actor_person_id id from kafaa_xapi_statements s join kafaa_people p on p.id = s.actor_person_id where p.crew = 'A' limit 1`))[0].id;
  const crewB = (await q(`select s.actor_person_id id from kafaa_xapi_statements s join kafaa_people p on p.id = s.actor_person_id where p.crew = 'B' and p.id <> 'p-sro' limit 1`))[0].id;
  const out = (await one('sro', `select kafaa_query_statements($1::jsonb) r`, [JSON.stringify({ actor: crewA })])).r;
  const outAud = (await q(`select outcome, entity_id from kafaa_audit_events where action = 'lrs.query' order by seq desc limit 1`))[0];
  ok(!out.ok && out.code === 'not_in_scope' && outAud.outcome === 'refused' && outAud.entity_id === crewA, `a manager cannot query statements of a person outside scope (${crewA}); the refusal is audited`);
  const inn = (await one('sro', `select kafaa_query_statements($1::jsonb) r`, [JSON.stringify({ actor: crewB, limit: 1000 })])).r;
  const innDirect = (await q(`select count(*)::int n from kafaa_xapi_statements where actor_person_id = $1`, [crewB]))[0].n;
  ok(inn.ok && inn.data.total === innDirect && inn.data.rows.every((r) => r.actor_person_id === crewB) && inn.audit_seq != null && inn.data.people.some((p) => p.id === crewB), `the same manager reads a crew B timeline (${innDirect} statements), audited`);
  const scope = (await one('sro', `select kafaa_query_statements('{"limit": 1000}'::jsonb) r`)).r;
  const scopeIds = [...new Set(scope.data.rows.map((r) => r.actor_person_id))];
  const crews = await q(`select id, crew from kafaa_people where id = any($1)`, [scopeIds]);
  ok(scope.ok && scope.data.scope === 'scope' && crews.every((c) => c.crew === 'B' || c.id === 'p-sro'), 'without a person filter a manager gets their scope only');
  const own = (await one('k-admin', `select kafaa_query_statements('{}'::jsonb) r`)).r;
  ok(own.ok && own.data.scope === 'own' && own.data.rows.every((r) => r.actor_person_id === 'p-k-admin') && own.audit_seq === null, 'a person reads their own statements (not audited)');
  const agg = (await one('k-hr-analyst', `select kafaa_query_statements('{}'::jsonb) r`)).r;
  const aud2 = (await one('k-auditor', `select kafaa_query_statements('{"limit": 5}'::jsonb) r`)).r;
  const obsQ = (await one('k-observer', `select kafaa_query_statements('{}'::jsonb) r`)).r;
  const badQ = (await one('sro', `select kafaa_query_statements('{"verb": "liked"}'::jsonb) r`)).r;
  ok(agg.ok && agg.data.scope === 'own' && agg.data.rows.every((r) => r.actor_person_id === 'p-k-hr-analyst') && aud2.ok && aud2.data.scope === 'all' && aud2.data.total === (await q(`select count(*)::int n from kafaa_xapi_statements`))[0].n && obsQ.code === 'forbidden' && badQ.code === 'invalid',
    'HR analysts read only their own rows (others as aggregates), auditors read all, observers are refused, unknown filters are invalid');

  // ── exportStatements
  const ex = (await one('sro', `select kafaa_export_statements() r`)).r;
  const exN = (await q(`select count(*)::int n from kafaa_xapi_statements where actor_person_id = 'p-sro'`))[0].n;
  const exAud = (await q(`select action, outcome, ledger_status from kafaa_audit_events order by seq desc limit 1`))[0];
  ok(ex.ok && ex.data.count === exN && ex.data.rows.every((r) => r.actor_person_id === 'p-sro') && exAud.action === 'lrs.export' && exAud.ledger_status === 'not_applicable', `a person exports their own ${exN} statements (audited, no ledger)`);

  // ── aggregate: same as the TS rules, suppressed below 10
  const sqlAgg = (await one('training-mgr', `select kafaa_lrs_aggregate() a`)).a;
  const all = await q(`select * from kafaa_xapi_statements`);
  const tsAgg = lrsAggregateOf(all.map((r) => ({ ...r, occurred_at: new Date(r.occurred_at).toISOString() })), 10);
  ok(JSON.stringify(sortKeys(sqlAgg)) === JSON.stringify(sortKeys(tsAgg)), `kafaa_lrs_aggregate equals lrsAggregateOf (${sqlAgg.cells.length} cells, ${sqlAgg.top.length} top activities)`);
  ok(sqlAgg.cells.every((c) => (c.suppressed ? c.statements === null && c.actors === null : c.actors >= 10)) && sqlAgg.cells.some((c) => c.suppressed) && sqlAgg.top.every((x) => x.actors >= 10),
    'every aggregate cell covers 10 or more people or shows suppressed');
  let sroAgg = false, anonAgg = false;
  try { await as('sro', `select kafaa_lrs_aggregate()`); } catch { sroAgg = true; }
  try { await as(null, `select kafaa_lrs_aggregate()`); } catch { anonAgg = true; }
  ok(sroAgg && anonAgg && (await one('k-hr-analyst', `select (kafaa_lrs_aggregate()->>'statements')::int n`)).n > 0, 'HR analytics read the aggregate; managers and anonymous callers cannot');

  // ── no secure item id or text anywhere
  const stems = (await q(`select v.stem_en from kafaa_item_versions v join kafaa_items i on i.id = v.item_id where i.bank = 'secure' and coalesce(v.stem_en, '') <> ''`)).map((r) => r.stem_en.slice(0, 40));
  const texts = (await q(`select to_jsonb(s.*)::text t from kafaa_xapi_statements s`)).map((r) => r.t);
  ok(texts.every((x) => !secure.some((id) => containsId(x, id)) && !stems.some((st) => x.includes(st))), `no secure item id or item text appears in any of the ${texts.length} statements`);
  let helper = false;
  try { await as('k-admin', `select kafaa_xapi_backfill()`); } catch { helper = true; }
  ok(helper, 'emitter and backfill helpers are not executable by API roles');
}
