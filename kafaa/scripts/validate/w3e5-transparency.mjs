// [W3 · E5 · F24] PGlite checks for 20261009135001_kafaa_w3e5_transparency.sql: the fairness compute equals the TypeScript rules
// (every seeded weekly snapshot, on a fresh database), suppression below 10 and the four-fifths flag, RLS on the four tables,
// kafaa_run_fairness_snapshot / kafaa_set_reco_optout / kafaa_change_engine_weights / kafaa_set_engine_weights (RBAC, refusals,
// audit and ledger rows, change log, card versions), kafaa_optout_stats suppression, and no protected input in any SQL scoring function.
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { FOUR_FIFTHS } from '../../src/modules/m16/fairness.ts';
import { PROTECTED_COLUMNS } from '../../src/modules/m16/transparency.ts';

const norm = (r) => ({ ...r, n: r.n == null ? null : Number(r.n), positives: r.positives == null ? null : Number(r.positives), rate: r.rate == null ? null : Number(r.rate), ratio: r.ratio == null ? null : Number(r.ratio) });
const key = (r) => JSON.stringify(['id', 'period', 'as_of', 'surface', 'metric', 'dimension', 'group_key', 'n', 'positives', 'rate', 'ratio', 'suppressed', 'flagged', 'source'].map((k) => r[k]));

export default async function w3e5Checks({ db, as, one, count, ok }) {
  const S = JSON.parse(readFileSync('src/seed/seed.json', 'utf8'));
  const T = S.tables;
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;

  // ── SQL = TS: every seeded weekly snapshot recomputed by kafaa_fairness_compute on a fresh database (earlier checks mutate data)
  const fresh = new PGlite();
  await fresh.exec(readFileSync('supabase/tests/nexus_stubs.sql', 'utf8'));
  for (const m of readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()) await fresh.exec(readFileSync(`supabase/migrations/${m}`, 'utf8'));
  await fresh.exec(readFileSync('supabase/seed.sql', 'utf8'));
  const days = [...new Set(T.fairness_snapshots.map((r) => r.as_of))].sort();
  const diffs = [];
  for (const d of days) {
    const sql = (await fresh.query(`select kafaa_fairness_compute($1::date) r`, [d])).rows[0].r.map(norm);
    const ts = T.fairness_snapshots.filter((r) => r.as_of === d).map(norm);
    if (sql.length !== ts.length) diffs.push(`${d}: ${sql.length} vs ${ts.length} rows`);
    else sql.forEach((r, i) => { if (key(r) !== key(ts[i])) diffs.push(`${d}: ${r.id} ${key(r)} != ${key(ts[i])}`); });
  }
  ok(diffs.length === 0, `kafaa_fairness_compute equals fairnessSnapshot() for all ${days.length} seeded weeks (${T.fairness_snapshots.length} rows)${diffs.length ? `; first diff ${diffs[0]}` : ''}`);
  const latest = (await fresh.query(`select kafaa_fairness_compute($1::date) r`, [S.meta.demo_today])).rows[0].r.map(norm);
  await fresh.close();
  ok(latest.every((r) => r.suppressed ? r.n === null && r.rate === null && r.positives === null && !r.flagged : r.n >= 10),
    'every shown group has at least 10 people; a suppressed comparison shows no count, no rate and no flag');
  const pairs = new Map();
  for (const r of latest) (pairs.get(`${r.metric}:${r.dimension}`) ?? pairs.set(`${r.metric}:${r.dimension}`, []).get(`${r.metric}:${r.dimension}`)).push(r);
  ok([...pairs.values()].every((rs) => rs.every((r) => r.suppressed) || rs.every((r) => !r.suppressed)), 'suppression applies to a whole comparison (no group can be worked out by subtraction)');
  ok(latest.every((r) => r.flagged === (r.ratio != null && r.ratio < FOUR_FIFTHS)) && latest.some((r) => r.flagged) && latest.some((r) => r.suppressed),
    `the four-fifths flag marks exactly the groups below 0.8 of the best rate (seed: ${latest.filter((r) => r.flagged).map((r) => r.id).join(', ')}) and small groups are suppressed`);

  // ── RLS
  ok((await count(null, 'kafaa_engine_cards')) === 0 && (await count('k-instructor', 'kafaa_engine_cards')) === T.engine_cards.length && (await count('alnoor-gm', 'kafaa_engine_cards')) === 0,
    'engine cards: every staff member reads all cards; anonymous visitors and partners read none');
  ok((await count('k-instructor', 'kafaa_reco_optouts')) === 0 && (await count('k-admin', 'kafaa_reco_optouts')) === 0 && (await count('chco', 'kafaa_reco_optouts')) === 0 && (await count('k-auditor', 'kafaa_reco_optouts')) === 0,
    'opt-outs are private: not admins, HR or auditors read other people\'s opt-outs');
  const nSnap = T.fairness_snapshots.length;
  ok((await count('k-admin', 'kafaa_fairness_snapshots')) === nSnap && (await count('ai-governance', 'kafaa_fairness_snapshots')) === nSnap && (await count('k-auditor', 'kafaa_fairness_snapshots')) === nSnap
    && (await count('chco', 'kafaa_fairness_snapshots')) === nSnap && (await count('k-hr-analyst', 'kafaa_fairness_snapshots')) === nSnap,
    'fairness snapshots: admin and AI governance, auditors and HR (aggregates) read them');
  ok((await count('k-instructor', 'kafaa_fairness_snapshots')) === 0 && (await count('sro', 'kafaa_fairness_snapshots')) === 0 && (await count(null, 'kafaa_fairness_snapshots')) === 0 && (await count('alnoor-gm', 'kafaa_fairness_snapshots')) === 0,
    'fairness snapshots: employees, line managers, partners and anonymous visitors read none');
  const nCh = (await q('select count(*)::int n from kafaa_engine_changes'))[0].n; // the W0 checks above changed settings, which now log
  ok(nCh >= T.engine_changes.length && (await count('k-admin', 'kafaa_engine_changes')) === nCh && (await count('k-auditor', 'kafaa_engine_changes')) === nCh && (await count('chco', 'kafaa_engine_changes')) === 0 && (await count('k-instructor', 'kafaa_engine_changes')) === 0,
    'the engine change log: admins and auditors only');
  let w1 = false, w2 = false, w3 = false;
  try { await as('k-instructor', `insert into kafaa_reco_optouts (id, person_id, surface) values ('ro:x', 'p-k-instructor', 'coach')`); } catch { w1 = true; }
  try { await as('k-admin', `update kafaa_fairness_snapshots set flagged = false returning id`).then((r) => { if (r.length) throw new Error('updated'); w2 = true; }); } catch { w2 = true; }
  try { await as('k-admin', `insert into kafaa_engine_changes (id, surface, engine_after) values ('ec:x', 'match', 'model')`); } catch { w3 = true; }
  ok(w1 && w2 && w3, 'no direct writes: opt-outs, snapshots and the change log change only through the RPCs');

  // ── kafaa_set_reco_optout
  const led = async () => (await q('select count(*)::int n from ledger_entries'))[0].n;
  const l0 = await led();
  const o1 = (await one('k-instructor', `select kafaa_set_reco_optout('coach', true, 'I prefer the full catalogue') r`)).r;
  const row1 = (await q(`select * from kafaa_reco_optouts where id = 'ro:p-k-instructor:coach'`))[0];
  const aud1 = (await q(`select outcome, ledger_status, actor_role from kafaa_audit_events where action = 'reco.optout' order by seq desc limit 1`))[0];
  ok(o1.ok && row1?.opted_out === true && row1.reason === 'I prefer the full catalogue' && aud1.outcome === 'ok' && aud1.ledger_status === 'written' && (await led()) === l0 + 1,
    'opting out of the coach stores the choice, writes an audit row and a NEXUS ledger row');
  ok((await count('k-instructor', 'kafaa_reco_optouts')) === 1, 'the person reads their own opt-out');
  const o2 = (await one('k-instructor', `select kafaa_set_reco_optout('coach', false) r`)).r;
  const o3 = (await one('k-instructor', `select kafaa_set_reco_optout('salary', true) r`)).r;
  const o4 = (await one('k-auditor', `select kafaa_set_reco_optout('coach', true) r`)).r;
  const o5 = (await one('alnoor-gm', `select kafaa_set_reco_optout('coach', true) r`)).r;
  const o6 = (await one('k-instructor', `select kafaa_set_reco_optout('coach', true, repeat('x', 501)) r`)).r;
  let anonOpt = false;
  try { await as(null, `select kafaa_set_reco_optout('coach', true)`); } catch { anonOpt = true; }
  ok(o2.ok && o2.data.opted_out === false && (await q(`select opted_out from kafaa_reco_optouts where id = 'ro:p-k-instructor:coach'`))[0].opted_out === false
    && o3.code === 'invalid' && o4.code === 'forbidden' && o5.code === 'forbidden' && o6.code === 'invalid' && anonOpt,
    'opting back in works; unknown surface, over-long reason, auditors, partners and anonymous callers are refused');

  // ── kafaa_optout_stats
  const st = (await one('k-admin', `select kafaa_optout_stats() r`)).r;
  const seedN = (s) => T.reco_optouts.filter((o) => o.surface === s && o.opted_out).length;
  ok(st.length === 3 && st.find((x) => x.surface === 'coach').n === seedN('coach') && st.find((x) => x.surface === 'navigator').n === null && st.find((x) => x.surface === 'navigator').suppressed === true,
    `opt-out counts per surface (coach ${seedN('coach')}); surfaces with fewer than 10 opt-outs are suppressed`);
  ok((await one('chco', `select jsonb_array_length(kafaa_optout_stats()) n`)).n === 3, 'HR reads the opt-out aggregate');
  let stDenied = false;
  try { await as('k-instructor', `select kafaa_optout_stats()`); } catch { stDenied = true; }
  ok(stDenied, 'employees cannot read the opt-out aggregate');

  // ── kafaa_run_fairness_snapshot
  const r0 = (await one('k-instructor', `select kafaa_run_fairness_snapshot(null) r`)).r;
  const r1 = (await one('k-auditor', `select kafaa_run_fairness_snapshot(null) r`)).r;
  const r2 = (await one('chco', `select kafaa_run_fairness_snapshot(null) r`)).r;
  const r3 = (await one('ai-governance', `select kafaa_run_fairness_snapshot(current_date + 3) r`)).r;
  ok(r0.code === 'forbidden' && r1.code === 'forbidden' && r2.code === 'forbidden' && r3.code === 'invalid', 'only a platform admin / AI governance lead runs the snapshot, and only for a date in the last year');
  const l1 = await led();
  const r4 = (await one('ai-governance', `select kafaa_run_fairness_snapshot(null) r`)).r;
  const period = (await q(`select to_char(current_date, 'IYYY-"W"IW') p`))[0].p;
  const stored = await q(`select * from kafaa_fairness_snapshots where period = $1`, [period]);
  const aud4 = (await q(`select outcome, ledger_status, entity_id from kafaa_audit_events where action = 'fairness.snapshot' order by seq desc limit 1`))[0];
  ok(r4.ok && r4.data.period === period && r4.data.rows === 16 && stored.length === 16 && stored.every((x) => x.run_by === 'p-ai-governance') && aud4.ledger_status === 'written' && aud4.entity_id === period && (await led()) === l1 + 1,
    `the weekly snapshot stores 16 group rows for ${period}, audited and ledgered (${r4.data.flagged} flagged, ${r4.data.suppressed} suppressed comparisons)`);
  const r5 = (await one('ai-governance', `select kafaa_run_fairness_snapshot(null) r`)).r;
  ok(r5.ok && (await q(`select count(*)::int n from kafaa_fairness_snapshots where period = $1`, [period]))[0].n === 16, 'running the snapshot again in the same week updates the rows (idempotent ids)');

  // ── engine settings: change log, cards, audit and ledger
  const cardsV = async () => Object.fromEntries((await q(`select id, version from kafaa_engine_cards order by id`)).map((c) => [c.id, c.version]));
  const v0 = await cardsV();
  const c0 = (await one('k-instructor', `select kafaa_change_engine_weights('match', 'deterministic', '{"skills":0.6,"development":0.3,"target":0.1}'::jsonb, 'Pilot feedback: more weight on development') r`)).r;
  const c1 = (await one('ai-governance', `select kafaa_change_engine_weights('match', 'deterministic', '{"skills":0.6,"development":0.3,"target":0.1}'::jsonb, 'short') r`)).r;
  const c2 = (await one('ai-governance', `select kafaa_change_engine_weights('match', 'deterministic', '{"skills":11}'::jsonb, 'Out of range weights test') r`)).r;
  const c3 = (await one('ai-governance', `select kafaa_change_engine_weights('nope', 'deterministic', null, 'Unknown surface test') r`)).r;
  ok(c0.code === 'forbidden' && c1.code === 'invalid' && c2.code === 'invalid' && c3.code === 'invalid', 'weight changes: admins only, a rationale of at least 10 characters, weights 0 to 10, known surfaces');
  const l2 = await led();
  const c4 = (await one('ai-governance', `select kafaa_change_engine_weights('match', 'deterministic', '{"skills":0.6,"development":0.3,"target":0.1}'::jsonb, 'Pilot feedback: more weight on development value') r`)).r;
  const ch = (await q(`select * from kafaa_engine_changes where id = $1`, [c4.data?.change_id]))[0];
  const aud5 = (await q(`select seq, ledger_status, ledger_seq from kafaa_audit_events where action = 'engine.settings' order by seq desc limit 1`))[0];
  const v1 = await cardsV();
  ok(c4.ok && /^ec:match:\d{3}$/.test(c4.data.change_id) && ch.weights_before.skills === 0.7 && ch.weights_after.development === 0.3 && ch.rationale.startsWith('Pilot feedback') && ch.changed_by === 'p-ai-governance'
    && ch.audit_seq === aud5.seq && ch.ledger_seq === aud5.ledger_seq && aud5.ledger_status === 'written' && (await led()) === l2 + 1,
    'a weight change is logged with before, after and rationale, and carries its audit and ledger sequence numbers');
  const matchCards = T.engine_cards.filter((c) => c.engine_surface === 'match').map((c) => c.id);
  ok(matchCards.every((id) => v1[id] === v0[id] + 1) && Object.keys(v0).filter((id) => !matchCards.includes(id)).every((id) => v1[id] === v0[id]) && JSON.stringify(c4.data.cards) === JSON.stringify([...matchCards].sort()),
    `every card served by the surface gets a new version (${matchCards.join(', ')}); other cards are untouched`);
  const c5 = (await one('ai-governance', `select kafaa_change_engine_weights('match', 'deterministic', '{"target":0.1,"development":0.3,"skills":0.6}'::jsonb, 'Same weights again, no change') r`)).r;
  ok(c5.code === 'no_change', 'a change that changes nothing is refused (no_change)');
  const l3 = await led();
  const c6 = (await one('k-admin', `select kafaa_set_engine_weights('search', 'model', null) r`)).r;
  const ch6 = (await q(`select * from kafaa_engine_changes where surface = 'search' order by id desc limit 1`))[0];
  ok(c6.ok && ch6.id === c6.data.change_id && ch6.engine_before === 'deterministic' && ch6.engine_after === 'model' && ch6.rationale === null && ch6.audit_seq != null && (await led()) === l3 + 1,
    'the wave-0 setEngineWeights RPC is now logged in the change log and ledgered too');
  await one('k-admin', `select kafaa_set_engine_weights('search', 'deterministic', null) r`);

  // ── no protected input in the SQL scoring functions named on the engine cards
  const sqlFns = [...new Set(T.engine_cards.flatMap((c) => c.scoring_functions).filter((f) => f.startsWith('sql:')).map((f) => f.slice(4)))];
  const bodies = await q(`select proname, prosrc from pg_proc where proname = any($1)`, [sqlFns]);
  const hits = bodies.filter((b) => PROTECTED_COLUMNS.some((k) => new RegExp(`(?<![a-z0-9_])${k}(?![a-z0-9_])`, 'i').test(b.prosrc.replace(/--[^\n]*/g, ''))));
  ok(new Set(bodies.map((b) => b.proname)).size === sqlFns.length && hits.length === 0, `the ${sqlFns.length} SQL scoring functions on the cards read no gender, nationality or age field${hits.length ? ` (${hits.map((h) => h.proname).join(', ')})` : ''}`);
  let compDenied = false;
  try { await as('k-admin', `select kafaa_fairness_compute(current_date)`); } catch { compDenied = true; }
  ok(compDenied, 'the fairness compute is internal (not executable by API roles)');
}
