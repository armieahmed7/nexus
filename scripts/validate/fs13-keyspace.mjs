// [FS wave A · E3 · FS04] PGlite checks for 20261010213001_kafaa_fs13_keyspace.sql: the one future-skill keyspace (every ADVANCE,
// radar and gap-plan key resolves to a catalogue skill), Scenario A != Scenario B, the computed radar (SQL kafaa_future_radar = TS
// futureRadar from src/modules/m11/keyspace.ts, before and after an admin keyspace edit; cells under 10 suppressed), RBAC, the admin
// map RPC (audited, refusals) and the redefined kafaa_save_skill_gap_plan (sk_id stamped, skill_key kept as the label).
import { readFileSync } from 'node:fs';
import { futureRadar, unresolvedKeys, scenarioDifferences, rowsOf } from '../../src/modules/m11/keyspace.ts';
import { publicTextIsClean } from '../../src/domain/future.ts';

const A = 'Scenario A (SIMULATED)';
const B = 'Scenario B (SIMULATED)';

export default async function fs13Checks({ db, as, one, count, ok }) {
  const T = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables;
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  const tables = async () => ({
    futureSkills: await q(`select * from kafaa_future_skills`),
    map: await q(`select * from kafaa_future_skill_map`),
    people: await q(`select id, kind, status, job_family_id from kafaa_people`),
    states: await q(`select person_id, skill_id, level, active from kafaa_person_skills`),
    advSkills: await q(`select id, sk_ids from kafaa_adv_skills`),
    plans: await q(`select id, skill_key, sk_id from kafaa_skill_gap_plans`),
    skills: await q(`select id, area, name_en, name_ar from kafaa_skills`),
  });
  const norm = (r) => ({
    population: Number(r.population),
    rows: r.rows.map((c) => ({ key: c.key, sk_id: c.sk_id, sk_ids: c.sk_ids, target_level: Number(c.target_level), demand: Number(c.demand), readiness: c.readiness == null ? null : Number(c.readiness), ready_n: c.ready_n == null ? null : Number(c.ready_n), suppressed: c.suppressed, readiness_max: c.readiness_max == null ? null : Number(c.readiness_max) })),
    families: r.families.map((f) => ({ family_id: f.family_id, n: f.n == null ? null : Number(f.n), suppressed: f.suppressed, cells: f.cells.map((c) => ({ key: c.key, readiness: c.readiness == null ? null : Number(c.readiness), suppressed: c.suppressed })) })),
  });
  const radarSql = async (persona, sc) => (await one(persona, `select kafaa_future_radar($1) r`, [sc])).r;

  // ── keyspace coverage
  let d = await tables();
  const bad = unresolvedKeys({ advSkills: d.advSkills, futureSkills: d.futureSkills, plans: d.plans, map: d.map, skills: d.skills });
  const sqlBad = await q(`select k from (select id k from kafaa_adv_skills union select skill_key from kafaa_future_skills union select skill_key from kafaa_skill_gap_plans where skill_key not like 'sk-%') x
    where not exists (select 1 from kafaa_future_skill_map m join kafaa_skills s on s.id = m.sk_id where m.key = x.k and m.active)`);
  ok(bad.length === 0 && sqlBad.length === 0 && d.advSkills.length === 27, `every one of the ${d.advSkills.length} ADVANCE skills, ${new Set(d.futureSkills.map((f) => f.skill_key)).size} radar keys and every gap-plan key resolves to at least one sk-* catalogue skill (TS and SQL)`);
  ok(d.advSkills.every((a) => JSON.stringify(a.sk_ids) === JSON.stringify(rowsOf(d.map, a.id).map((m) => m.sk_id))) && d.futureSkills.every((f) => f.sk_id) && d.plans.every((p) => p.sk_id),
    'adv_skills.sk_ids, future_skills.sk_id and skill_gap_plans.sk_id are back-filled from the map (old plan keys kept as labels)');
  ok((await q(`select count(*)::int n from kafaa_future_skill_map m join kafaa_skills s on s.id = m.sk_id where s.area = 'security'`))[0].n === 0 && publicTextIsClean(d.map.flatMap((m) => [m.note_en, m.note_ar])),
    'no security skill is on the map, and the public map notes carry no headcount or site wording');
  const diff = scenarioDifferences(d.futureSkills, A, B);
  const sqlDiff = (await q(`select count(*)::int n from kafaa_future_skills a join kafaa_future_skills b on b.skill_key = a.skill_key and b.scenario = $2 where a.scenario = $1 and a.value <> b.value`, [A, B]))[0].n;
  ok(diff.differ >= 6 && sqlDiff === diff.differ && d.futureSkills.every((f) => f.assumption_en && f.assumption_ar && f.sources.length > 0 && f.sources.every((s) => /^https:\/\//.test(s.url))),
    `Scenario A and B differ on ${diff.differ} of ${diff.total} radar skills; every row carries a sourced SIMULATED assumption (EN and AR)`);
  const sum = (sc) => d.futureSkills.filter((f) => f.scenario === sc).reduce((s, f) => s + Number(f.value), 0);
  ok(sum(A) === sum(B), `both scenarios keep the same total demand (${sum(A)}), so the F35 outlook's mean ADVANCE index is unchanged`);

  // ── radar: SQL = TS, suppression
  let same = true; let sup = 0; let shown = 0;
  for (const sc of [A, B]) {
    const s = norm(await radarSql('k-hr-analyst', sc));
    const t = norm(futureRadar(d, sc));
    if (JSON.stringify(s) !== JSON.stringify(t)) { same = false; console.log('    SQL', JSON.stringify(s).slice(0, 400), '\n    TS ', JSON.stringify(t).slice(0, 400)); }
    for (const c of s.rows) { if (c.suppressed) { sup++; if (c.readiness !== null || c.ready_n !== null || c.readiness_max == null) same = false; } else { shown++; if (c.ready_n < 10) same = false; } }
    for (const f of s.families) { if ((f.n !== null && f.n < 10) || (f.suppressed && f.cells.some((c) => !c.suppressed))) same = false; }
  }
  ok(same && sup > 0 && shown >= 6, `radar readiness from person_skills: SQL = TS for both scenarios (${shown} cells shown, ${sup} suppressed under 10 people, families under 10 suppressed)`);
  const r0 = norm(await radarSql('chco', A));
  ok(JSON.stringify(r0.rows.map((c) => c.readiness)) === JSON.stringify(norm(await radarSql('chco', B)).rows.map((c) => c.readiness)) && r0.families.every((f) => !['security', 'safeguards', 'cyber'].includes(f.family_id)),
    'readiness describes today\'s staff (same in both scenarios); security, safeguards and cyber families are never broken out');
  ok(Number((await radarSql('k-auditor', A)).population) === r0.population, 'the CHCO office and auditors (workforce_analytics R) read the radar');
  let denied = 0;
  for (const p of ['sro', 'training-mgr', 'k-observer', 'k-instructor', null]) { try { await radarSql(p, A); } catch { denied++; } }
  ok(denied === 5, 'managers, the training manager, observers, instructors and anonymous callers are refused the radar');

  // ── map RBAC and the admin RPC
  ok((await count(null, 'kafaa_future_skill_map')) === T.future_skill_map.length && (await count('sro', 'kafaa_future_skill_map')) === T.future_skill_map.length, `the keyspace is reference data: anonymous visitors and staff read all ${T.future_skill_map.length} map rows`);
  let direct = false;
  try { await as('k-admin', `insert into kafaa_future_skill_map (id, key, key_kind, sk_id, relation) values ('x', 'bwr-ops', 'radar', 'sk-co-02', 'transfers')`); } catch { direct = true; }
  ok(direct, 'map rows cannot be written directly (RPC only, admin)');
  const save = async (persona, p) => (await one(persona, `select kafaa_save_future_skill_map($1::jsonb) r`, [JSON.stringify(p)])).r;
  const forb = await save('k-hr-analyst', { key: 'bwr-ops', key_kind: 'radar', sk_id: 'sk-co-02', relation: 'transfers', need_level: 3 });
  const inv = await save('k-admin', { key: 'bwr-ops', key_kind: 'radar', sk_id: 'sk-co-02', relation: 'maybe', need_level: 9 });
  const nf = await save('k-admin', { key: 'no-such-key', key_kind: 'radar', sk_id: 'sk-co-02', relation: 'transfers', need_level: 2 });
  const secR = await save('k-admin', { key: 'bwr-ops', key_kind: 'radar', sk_id: 'sk-sa-01', relation: 'transfers', need_level: 2 });
  const conflict = await save('k-admin', { key: 'as-lab-qa', key_kind: 'adv_skill', sk_id: 'sk-ch-02-labqa', relation: 'transfers', need_level: 2, active: false });
  ok(forb.code === 'forbidden' && inv.code === 'invalid' && nf.code === 'not_found' && secR.code === 'security_restricted' && conflict.code === 'conflict',
    'admin-only keyspace edits; invalid, unknown-key, security-skill and last-active-row changes are refused');
  const add = await save('k-admin', { key: 'bwr-ops', key_kind: 'radar', sk_id: 'sk-co-02', relation: 'transfers', need_level: 3, primary_sk: true, note_en: 'Shift turnover transfers.', note_ar: 'ينتقل تسليم الوردية.' });
  const aud = (await q(`select outcome, ledger_status, actor_role from kafaa_audit_events where action = 'future.map' order by seq desc limit 1`))[0];
  const fsRow = (await q(`select sk_id from kafaa_future_skills where skill_key = 'bwr-ops' limit 1`))[0];
  ok(add.ok && aud.outcome === 'ok' && aud.actor_role === 'admin' && aud.ledger_status === 'not_applicable' && fsRow.sk_id === 'sk-co-02', 'an admin adds a primary catalogue skill to a radar key: audited, and the radar row now resolves to it');
  const advAdd = await save('k-admin', { key: 'as-remote-ops', key_kind: 'adv_skill', sk_id: 'sk-co-01-rounds', relation: 'adapts', need_level: 3 });
  const adv = (await q(`select sk_ids from kafaa_adv_skills where id = 'as-remote-ops'`))[0];
  ok(advAdd.ok && adv.sk_ids.includes('sk-co-01-rounds'), 'an ADVANCE skill gains a catalogue skill and adv_skills.sk_ids follows the map');
  d = await tables();
  const after = norm(await radarSql('k-hr-analyst', B));
  ok(JSON.stringify(after) === JSON.stringify(norm(futureRadar(d, B))), 'after the keyspace edits the SQL radar still equals the TS computation');

  // ── gap plans re-keyed to catalogue skills
  const y = new Date().getUTCFullYear() + 1;
  const gp = (await one('k-hr-analyst', `select kafaa_save_skill_gap_plan($1::jsonb) r`, [JSON.stringify({ skill_key: 'gas-coolant', scenario: A, action: 'research', owner_role: 'Engineering (role)', target_quarter: `${y}-Q2` })])).r;
  const gpRow = (await q(`select skill_key, sk_id from kafaa_skill_gap_plans where id = $1`, [gp.data?.id]))[0];
  const gpSk = (await one('chco', `select kafaa_save_skill_gap_plan($1::jsonb) r`, [JSON.stringify({ skill_key: 'sk-da-02', scenario: B, action: 'train', owner_role: 'Digital (role)', target_quarter: `${y}-Q3` })])).r;
  const gpSec = (await one('chco', `select kafaa_save_skill_gap_plan($1::jsonb) r`, [JSON.stringify({ skill_key: 'sk-sa-01', scenario: B, action: 'train', owner_role: 'Digital (role)', target_quarter: `${y}-Q3` })])).r;
  const gpNo = (await one('k-auditor', `select kafaa_save_skill_gap_plan($1::jsonb) r`, [JSON.stringify({ skill_key: 'gas-coolant', scenario: A, action: 'train', owner_role: 'Engineering (role)', target_quarter: `${y}-Q2` })])).r;
  ok(gp.ok && gpRow.skill_key === 'gas-coolant' && gpRow.sk_id === 'sk-pf-02-advcool' && gpSk.ok && gpSec.code === 'not_found' && gpNo.code === 'forbidden',
    'gap plans carry the catalogue skill (radar key kept as the label, or an sk-* id directly); security skills and non-HR callers are refused');
}
