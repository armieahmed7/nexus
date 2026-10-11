// [FS QA · wave E integration] PGlite checks for 20261010259001_kafaa_fs5qa_integration.sql.
//  1. Recorded-evidence union (handover 3.9): the final kafaa_skill_states_v2 / kafaa_skills_apply bodies carry exactly the TS
//     RECORDED_REF_TABLES list (FS10, FS21, FS22, FS37 + FS39 plant_visits, FS40 twin_attempts, FS44 lectures / knowledge_assets), in
//     both the keep list and the "not in" list.
//  2. A recompute keeps every wave-E recorded evidence row: kafaa_skills_apply for every person with plant-visit, twin-drill or
//     contribution evidence leaves all of those rows active and the person's states unchanged against the seed.
//  3. The FS48 mentoring engine card update is additive on a card at any version: on a card at the pre-FS48 content and version 13
//     (as live) it appends the two ranking functions, the wfn_participants input and the FS48 sentence, keeps everything else and
//     bumps the version by one; a second run changes nothing; on the local card (already FS48) it is a no-op.
// Every write runs inside a transaction that is rolled back; uses the shared validator database (migrations + seed, twice).
import { readFileSync } from 'node:fs';
import { RECORDED_REF_TABLES } from '../../src/domain/skills.ts';

const FILE = 'supabase/migrations/20261010259001_kafaa_fs5qa_integration.sql';
const WAVE_E = ['plant_visits', 'twin_attempts', 'lectures', 'knowledge_assets'];

export default async function fsqa5Checks({ db, ok }) {
  console.log('FS QA · wave E integration (FS38-FS49)');
  const sql = readFileSync(FILE, 'utf8');
  const q = async (s, p = []) => (await db.query(s, p)).rows;
  const list = `(${RECORDED_REF_TABLES.map((t) => `'${t}'`).join(', ')})`;

  // 1. union in the live bodies
  ok(WAVE_E.every((t) => RECORDED_REF_TABLES.includes(t)) && RECORDED_REF_TABLES.length === 8, 'TS RECORDED_REF_TABLES holds the four wave-E tokens (8 in all)');
  const src = Object.fromEntries((await q(`select proname, prosrc from pg_proc where proname in ('kafaa_skill_states_v2', 'kafaa_skills_apply')`)).map((r) => [r.proname, r.prosrc]));
  ok(src.kafaa_skill_states_v2.includes(`e.ref_table in ${list}`), 'final kafaa_skill_states_v2 keeps exactly the TS recorded list');
  ok(src.kafaa_skills_apply.includes(`e.ref_table not in ${list}`), 'final kafaa_skills_apply spares exactly the TS recorded list');
  ok(sql.split(list).length - 1 === 2, 'the fs5qa migration carries the unioned list in both functions');

  // 2. recompute keeps wave-E recorded evidence
  const people = (await q(`select distinct person_id from kafaa_skill_evidence where active and ref_table = any($1) order by 1`, [WAVE_E])).map((r) => r.person_id);
  const before = Number((await q(`select count(*)::int n from kafaa_skill_evidence where active and ref_table = any($1)`, [WAVE_E]))[0].n);
  const states = async () => (await q(`select id, level, basis, evidence_count from kafaa_person_skills where active and person_id = any($1) order by id`, [people])).map((r) => JSON.stringify(r)).join('\n');
  const s0 = await states();
  await db.exec('begin');
  try {
    for (const p of people) await q(`select kafaa_skills_apply($1, '2026-10-08'::date)`, [p]);
    const after = Number((await q(`select count(*)::int n from kafaa_skill_evidence where active and ref_table = any($1)`, [WAVE_E]))[0].n);
    ok(people.length > 20 && before > 100 && after === before, `recompute for ${people.length} people keeps all ${before} plant-visit, twin-drill and contribution evidence rows`);
    ok((await states()) === s0, 'recompute leaves their skill states equal to the seed');
  } finally { await db.exec('rollback'); }

  // 3. mentoring card
  const upd = sql.slice(sql.indexOf('update kafaa_engine_cards c set'));
  const card = async () => (await q(`select version, scoring_functions, inputs_used, limitations_en, limitations_ar from kafaa_engine_cards where id = 'mentoring'`))[0];
  const local = await card();
  await db.exec('begin');
  try {
    await db.exec(upd);
    ok(JSON.stringify(await card()) === JSON.stringify(local), 'card update is a no-op on the local card (FS48 already listed)');
    const first = (s) => s.slice(0, s.indexOf('.') + 1);
    await q(`update kafaa_engine_cards set version = 13, scoring_functions = array['src/modules/m04/match.ts#rankMentors']::text[],
      inputs_used = (select coalesce(jsonb_agg(x), '[]'::jsonb) from jsonb_array_elements(inputs_used) x where x ->> 'key' <> 'wfn_participants'),
      limitations_en = $1, limitations_ar = $2 where id = 'mentoring'`, [first(local.limitations_en), first(local.limitations_ar)]);
    await db.exec(upd);
    const live = await card();
    ok(live.version === 14 && JSON.stringify(live.scoring_functions) === JSON.stringify(local.scoring_functions)
      && JSON.stringify(live.inputs_used) === JSON.stringify(local.inputs_used) && live.limitations_en === local.limitations_en && live.limitations_ar === local.limitations_ar,
      'on a pre-FS48 card at version 13 the update adds the FS48 functions, input and sentence (version 14) and matches the local card');
    await db.exec(upd);
    ok(JSON.stringify(await card()) === JSON.stringify(live), 'a second run changes nothing');
  } finally { await db.exec('rollback'); }
}
