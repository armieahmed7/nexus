// [FS wave B · E4 · FS13 + FS14] PGlite checks for 20261010224001_kafaa_fs24_future_readiness.sql.
//  FS13  * SQL = TS: kafaa_fm_readiness_of(person) equals readinessV2(inputFor(person)) for every seeded person (fresh database)
//        * completing c-adv-intro raises every family by exactly the previewEvidence amount (all people without that learning)
//        * an index of 100 is reachable through evidence alone (level 3 on the transferring or direct skill of every key)
//        * kafaa_future_readiness (own, staff only) and kafaa_record_track_step (RBAC, refusals, audit without ledger, completion
//          counts as learning, undo); track progress is own-only; the engine card names the SQL function
//  FS14  * eleven lanes, each with three or more https sources and as-of dates (TS laneProblems and the SQL check), clean public text,
//          links and milestones that resolve; interest aggregates under 10 are suppressed
//  Migration: guarded data statements turn pre-FS13 rows into exactly the seed (forward proof) and are idempotent.
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { readinessV2, inputFor, previewEvidence, deltaOf, fullEvidence } from '../../src/modules/m21/readiness.ts';
import { laneProblems, LANE_HORIZONS } from '../../src/modules/m21/lanes.ts';
import { FS13_KEYSPACE_ROWS } from '../../src/modules/m21/fs13data.ts';
import { publicTextIsClean } from '../../src/domain/future.ts';

const FILE = 'supabase/migrations/20261010224001_kafaa_fs24_future_readiness.sql';
const canon = (x) => JSON.stringify(x, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((y) => [y, v[y]])) : v));

export default async function fs24Checks({ db, as, one, count, ok }) {
  const T = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables;
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  const tabs = (x) => ({ techs: x.adv_technologies, advSkills: x.adv_skills, map: x.future_skill_map, skills: x.skills, resources: x.future_resources, states: x.person_skills, enrolments: x.enrolments, trainingRecords: x.training_records, trackProgress: x.future_track_progress });

  // ── fresh database: migrations + seed once (earlier validators write skills, map rows and enrolments on the shared one)
  const f = new PGlite();
  await f.exec(readFileSync('supabase/tests/nexus_stubs.sql', 'utf8'));
  for (const m of readdirSync('supabase/migrations').filter((x) => x.endsWith('.sql')).sort()) await f.exec(readFileSync(`supabase/migrations/${m}`, 'utf8'));
  await f.exec(readFileSync('supabase/seed.sql', 'utf8'));
  const fq = async (sql, p = []) => (await f.query(sql, p)).rows;
  const sqlR = async (person) => (await fq('select kafaa_fm_readiness_of($1) r', [person]))[0].r;
  const t0 = tabs(T);

  // SQL = TS for every seeded person
  let diff = 0, first = '';
  const before = new Map();
  for (const p of T.people) {
    const ts = readinessV2(inputFor(p.id, t0));
    const sq = await sqlR(p.id);
    before.set(p.id, ts);
    if (canon(sq) !== canon(ts)) { diff++; if (!first) first = `${p.id}\nSQL ${canon(sq).slice(0, 500)}\nTS  ${canon(ts).slice(0, 500)}`; }
  }
  ok(diff === 0, `FS13 SQL = TS: kafaa_fm_readiness_of equals readinessV2 for all ${T.people.length} seeded people${diff ? ` (${diff} differ; first ${first})` : ''}`);
  const staff = T.people.filter((p) => p.kind === 'staff').map((p) => before.get(p.id).overall);
  ok(staff.some((x) => x > 0) && staff.every((x) => x >= 0 && x <= 100), `staff readiness spans ${Math.min(...staff)} to ${Math.max(...staff)} (SIMULATED, 0-100)`);

  // completing c-adv-intro: every family rises by the previewed, deterministic amount
  await f.exec('begin');
  try {
    const learnt = (r) => r.families.some((fm) => fm.items.some((i) => i.learn_opts.some((o) => o.course_id === 'c-adv-intro') && i.l3 >= 1));
    const fresh = T.people.filter((p) => !learnt(before.get(p.id)));
    // FS21 (fsCe3): a family whose c-adv-intro items are already fully evidenced (e.g. level 3 from an adaptive assessment) has no headroom left
    const full = (r) => r.families.some((fm) => { const its = fm.items.filter((i) => i.learn_opts.some((o) => o.course_id === 'c-adv-intro')); return its.length > 0 && its.every((i) => i.bp >= 10000); });
    const sat = fresh.filter((p) => full(before.get(p.id)));
    for (const p of T.people) await f.query(`insert into kafaa_training_records (id, person_id, course_id, completed_on, hours, result) values ($1, $2, 'c-adv-intro', '2026-10-09', 3, 'passed')`, [`tr-fs24-${p.id}`, p.id]);
    let bad = 0, rise = 0, firstBad = '';
    for (const p of T.people) {
      const after = await sqlR(p.id);
      const prev = previewEvidence(before.get(p.id), { courses: ['c-adv-intro'] });
      if (canon(after) !== canon(prev)) { bad++; firstBad ||= p.id; }
    }
    for (const p of fresh) if (!sat.includes(p) && deltaOf(before.get(p.id), await sqlR(p.id)).families.every((x) => x.delta > 0)) rise++;
    ok(bad === 0, `completing c-adv-intro gives exactly the previewEvidence result for all ${T.people.length} people${bad ? ` (${bad} differ, first ${firstBad})` : ''}`);
    ok(fresh.length > 300 && sat.length <= 10 && rise === fresh.length - sat.length, `it raises the index of every family for all ${fresh.length - sat.length} people without that learning yet (${T.people.length - fresh.length} already hold it through the orientation track; ${sat.length} already evidenced in full, e.g. by an FS21 adaptive assessment)`);
  } finally { await f.exec('rollback'); }

  // an index of 100 through evidence alone
  await f.exec('begin');
  try {
    const who = 'p-k-lo-trainee';
    const ev = fullEvidence(before.get(who));
    for (const s of ev.skills) await f.query(`insert into kafaa_person_skills (id, person_id, skill_id, level, confidence, basis) values ($1, $2, $3, 3, 0.9, 'evidenced')`, [`ps-fs24-${s.skill_id}`, who, s.skill_id]);
    const r = await sqlR(who);
    ok(r.overall === 100 && r.families.every((x) => x.index === 100) && previewEvidence(before.get(who), ev).overall === 100,
      `an index of 100 is reachable through evidence alone: level 3 on ${ev.skills.length} transferring or new-capability skills gives 100 in every family (SQL and TS)`);
  } finally { await f.exec('rollback'); }

  // migration forward proof: pre-FS13 rows become exactly the seed; idempotent
  const sql = readFileSync(FILE, 'utf8');
  const TABLES = ['kafaa_horizon_lanes', 'kafaa_future_resources', 'kafaa_engine_cards', 'kafaa_future_skill_map', 'kafaa_adv_skills'];
  const digests = async () => Object.fromEntries(await Promise.all(TABLES.map(async (t) => [t, (await fq(`select count(*)::int n, md5(coalesce(string_agg(x::text, '|' order by x.id collate "C"), '')) d from ${t} x`))[0]])));
  const seedD = await digests();
  await f.exec('begin');
  try {
    const mapIds = FS13_KEYSPACE_ROWS.map(([k, sk]) => `fsm:${k}:${sk}`);
    await fq(`update kafaa_horizon_lanes set as_of = null, sources = '[]'::jsonb, kind = 'build', milestone_ids = '{}' where id in ('lane-digital', 'lane-cyber', 'lane-ai', 'lane-advanced', 'lane-netzero')`);
    await fq(`update kafaa_horizon_lanes set title_en = 'x' where id = 'lane-netzero'`);
    await fq(`update kafaa_future_resources set lane_ids = '{}' where lane_ids && array['lane-robotics', 'lane-ai-maint', 'lane-manufacturing', 'lane-hydrogen', 'lane-grid', 'lane-fusion']`);
    await fq(`update kafaa_engine_cards set version = 1, scoring_functions = '{}', inputs_used = '[]'::jsonb where id = 'future'`);
    await fq(`delete from kafaa_future_skill_map where id = any($1)`, [mapIds]);
    await fq(`update kafaa_adv_skills set sk_ids = '{}' where id = any($1)`, [FS13_KEYSPACE_ROWS.map((r) => r[0])]);
    const pre = await digests();
    ok(TABLES.every((t) => pre[t].d !== seedD[t].d), 'before the migration the pre-FS13 rows differ from the seed in all five tables');
    await f.exec(sql);
    await f.exec(readFileSync('supabase/migrations/20261010263001_kafaa_fs63_taxonomy_governance.sql', 'utf8')); // FS55 (fsFe3): the later migration appends bridgePlan and rankRaises to this card once (version + 1)
    const post = await digests();
    for (const t of TABLES) ok(post[t].n === seedD[t].n && post[t].d === seedD[t].d, `SQL = TS: ${t} after the migration equals the seed (${post[t].n} rows)`);
    await f.exec(sql);
    await f.exec(readFileSync('supabase/migrations/20261010263001_kafaa_fs63_taxonomy_governance.sql', 'utf8')); // FS55 (fsFe3)
    const again = await digests();
    ok(TABLES.every((t) => again[t].d === seedD[t].d), 'idempotent: a second run changes nothing');
  } finally { await f.exec('rollback'); }
  await f.exec('begin');
  try {
    await fq(`update kafaa_horizon_lanes set title_en = 'Edited live' where id = 'lane-ai'`);
    await f.exec(sql);
    ok((await fq(`select title_en from kafaa_horizon_lanes where id = 'lane-ai'`))[0].title_en === 'Edited live', 'guarded: a reviewed lane edited live is left alone by a re-run');
  } finally { await f.exec('rollback'); }
  await f.close();

  // ── shared database (persona profiles): RPCs and row-level security
  const sro = (await one('sro', 'select kafaa_future_readiness() r')).r;
  const sroOwn = (await q(`select kafaa_fm_readiness_of('p-sro') r`))[0].r;
  ok(sro.person_id === 'p-sro' && canon({ ...sro, person_id: undefined }) === canon(sroOwn) && sro.families.length === 6, 'kafaa_future_readiness returns the signed-in person\'s readiness (six families)');
  const denied = async (persona, sqlText) => { try { await as(persona, sqlText); return false; } catch { return true; } };
  ok(await denied(null, 'select kafaa_future_readiness()') && await denied('gulfhydro-qa', 'select kafaa_future_readiness()') && await denied('k-observer', 'select kafaa_future_readiness()'),
    'anonymous callers, partners and observers get no Future Me readiness');
  ok(await denied('k-admin', `select kafaa_fm_readiness_of('p-sro')`) && await denied('sro', `select kafaa_fm_readiness_of('w-ro-01')`), 'nobody reads another person\'s readiness: the per-person function is internal');

  // track steps: k-instructor works through trk-digital (3 steps)
  const led0 = (await q('select count(*)::int n from ledger_entries'))[0].n;
  const r0 = (await q(`select kafaa_fm_readiness_of('p-k-instructor') r`))[0].r;
  const s1 = (await one('k-instructor', `select kafaa_record_track_step('trk-digital', 0, true) r`)).r;
  const s2 = (await one('k-instructor', `select kafaa_record_track_step('trk-digital', 1, true) r`)).r;
  const s3 = (await one('k-instructor', `select kafaa_record_track_step('trk-digital', 2, true) r`)).r;
  const r1 = (await q(`select kafaa_fm_readiness_of('p-k-instructor') r`))[0].r;
  ok(s1.ok && s1.data.status === 'in_progress' && s2.data.steps_done.length === 2 && s3.ok && s3.data.status === 'completed' && s3.data.completed_at && s3.data.steps === 3,
    'three steps complete trk-digital (in progress, then completed with a date)');
  ok(canon(r1) === canon(previewEvidence(r0, { tracks: ['trk-digital'] })) && r1.overall >= r0.overall, `a completed track counts as level-1 learning: readiness ${r0.overall} -> ${r1.overall}, exactly as previewed`);
  const aud = await q(`select outcome, ledger_status from kafaa_audit_events where action = 'future.track' order by seq desc limit 3`);
  ok(aud.length === 3 && aud.every((a) => a.outcome === 'ok' && a.ledger_status === 'not_applicable') && (await q('select count(*)::int n from ledger_entries'))[0].n === led0, 'every step is audited, with no ledger write');
  const u = (await one('k-instructor', `select kafaa_record_track_step('trk-digital', 2, false) r`)).r;
  const r2 = (await q(`select kafaa_fm_readiness_of('p-k-instructor') r`))[0].r;
  ok(u.ok && u.data.status === 'in_progress' && u.data.completed_at === null && canon(r2) === canon(r0), 'undoing a step reopens the track and the readiness returns to where it was');
  const bad = (await one('k-instructor', `select kafaa_record_track_step('trk-digital', 9, true) r`)).r;
  const nf = (await one('k-instructor', `select kafaa_record_track_step('trk-nope', 0, true) r`)).r;
  const obs = (await one('k-observer', `select kafaa_record_track_step('trk-digital', 0, true) r`)).r;
  const partner = (await one('gulfhydro-qa', `select kafaa_record_track_step('trk-digital', 0, true) r`)).r;
  ok(bad.code === 'invalid' && nf.code === 'not_found' && obs.code === 'forbidden' && partner.code === 'forbidden', 'track refusals: step out of range, unknown track, observers and partners');
  ok(await denied(null, `select kafaa_record_track_step('trk-digital', 0, true)`), 'anonymous callers cannot execute kafaa_record_track_step');
  ok(await denied('sro', `insert into kafaa_future_track_progress (id, person_id, track_id) values ('x', 'p-sro', 'trk-digital')`), 'track progress cannot be written directly (RPC only)');
  ok((await count('k-hr-analyst', 'kafaa_future_track_progress', 'person_id <> kafaa_me()')) === 0 && (await count('training-mgr', 'kafaa_future_track_progress', 'person_id <> kafaa_me()')) === 0 && (await count(null, 'kafaa_future_track_progress')) === 0
    && (await count('k-instructor', 'kafaa_future_track_progress')) >= 1, 'track progress is own-only (not HR, not training, not anonymous)');

  // ── FS14 lanes, links, milestones
  const lanes = await as(null, 'select * from kafaa_horizon_lanes order by sort');
  ok(lanes.length === 11 && lanes.length === T.horizon_lanes.length, `anonymous visitors read the ${lanes.length} horizon lanes`);
  ok(lanes.every((l) => laneProblems(l).length === 0 && l.sources.length >= 3 && l.as_of), `every lane cites 3 or more https sources with as-of dates (min ${Math.min(...lanes.map((l) => l.sources.length))})`);
  ok(Object.keys(LANE_HORIZONS).every((h) => lanes.some((l) => l.horizon === h)) && lanes.filter((l) => l.kind === 'watch').map((l) => l.id).join() === 'lane-fusion', 'lanes cover now, next and later; the fusion lane is a watch (awareness) lane');
  const links = await as(null, 'select * from kafaa_horizon_lane_links');
  const ms = await as(null, 'select * from kafaa_horizon_milestones');
  ok(links.length === T.horizon_lane_links.length && ms.length === T.horizon_milestones.length && ms.every((m) => m.sources.length >= 1 && m.sources.every((s) => /^https:\/\//.test(s.url) && /^\d{4}-\d{2}-\d{2}$/.test(s.as_of ?? '')) && m.year >= 2023 && m.year <= 2035),
    `anonymous visitors read ${links.length} lane links and ${ms.length} sourced milestones`);
  const resolve = (await q(`select count(*)::int n from kafaa_horizon_lane_links l where not (
      (l.kind = 'skill' and exists (select 1 from kafaa_skills s where s.id = l.ref_id and s.fs_area is not null and s.area <> 'security'))
      or (l.kind = 'course' and exists (select 1 from kafaa_courses c where c.id = l.ref_id))
      or (l.kind = 'track' and exists (select 1 from kafaa_adv_tracks t where t.id = l.ref_id))
      or (l.kind = 'gig' and exists (select 1 from kafaa_opportunities o where o.id = l.ref_id))
      or l.kind in ('pathway', 'resource'))`))[0].n;
  const msOk = (await q(`select count(*)::int n from kafaa_horizon_lanes l, unnest(l.milestone_ids) m where not exists (select 1 from kafaa_horizon_milestones x where x.id = m)`))[0].n;
  ok(resolve === 0 && msOk === 0 && lanes.every((l) => links.some((k) => k.lane_id === l.id && k.kind === 'skill')), 'every lane lists FS02 skills; every link and milestone resolves');
  ok(publicTextIsClean([...lanes, ...ms]), 'all lane and milestone text passes publicTextIsClean (no headcount, no site information)');
  let ck = false;
  try { await q(`insert into kafaa_horizon_lanes (id, code, title_en, title_ar, summary_en, summary_ar, why_en, why_ar, horizon, sources, as_of) values ('lane-x', 'HZ-X', 'x', 'x', 'x', 'x', 'x', 'x', 'now', $1::jsonb, '2026-10-10')`, [JSON.stringify(lanes[0].sources.slice(0, 2))]); } catch { ck = true; }
  ok(ck, 'the SQL check refuses a reviewed lane with fewer than three sources');

  // interest aggregates for the new lanes: suppressed under 10
  const dem = await as('k-hr-analyst', 'select * from kafaa_future_demand()');
  const cell = (src, id) => dem.find((r) => r.source === src && r.target_id === id);
  const seedN = (id) => new Set(T.future_interest.filter((i) => i.active && i.lane_id === id).map((i) => i.person_id)).size;
  const newLanes = ['lane-robotics', 'lane-ai-maint', 'lane-manufacturing', 'lane-hydrogen', 'lane-grid', 'lane-fusion'];
  ok(newLanes.every((l) => { const c = cell('interest', l); const n = seedN(l); return n < 10 ? c?.suppressed === true && c.n === null : c?.n === n; })
    && cell('interest', 'lane-grid')?.suppressed === true && cell('interest', 'lane-manufacturing')?.suppressed === true && cell('goal', 'lane-ai-maint')?.n >= 10 && cell('goal', 'lane-robotics')?.suppressed === true,
    `lane interest and goals for the six new lanes: counts at 10 or more (ai-maint ${cell('interest', 'lane-ai-maint')?.n}), cells under 10 suppressed (grid, manufacturing)`);

  // engine card
  const card = (await q(`select version, scoring_functions from kafaa_engine_cards where id = 'future'`))[0];
  ok(card.version === 3 && card.scoring_functions.includes('src/modules/m21/raises.ts#rankRaises') && card.scoring_functions.includes('sql:kafaa_fm_readiness_of') && card.scoring_functions.includes('src/modules/m21/readiness.ts#readinessV2'), 'the Future Me engine card is at version 2 and names readiness v2 (TS and SQL); FS55 (fsFe3) appends two rankers once: version 3');
}
