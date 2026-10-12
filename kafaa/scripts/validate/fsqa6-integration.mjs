// [FS QA · wave F integration] PGlite checks for 20261010269001_kafaa_fs6qa_integration.sql (cross-feature wiring of FS50-FS59).
//  1. FS51 <-> FS52: the F35 outlook functions stay shared and stable: kafaa_so_base keeps the fs2qa body (FS02 fs_area condition), no
//     wave-F file redefines it, FS51 has its own kafaa_sf_* functions, the FS52 factor lives in kafaa_so_for; with adoption 0 the stored
//     outlooks reproduce byte for byte (TS) and the F35 stress test reads 10 of 10.
//  2. FS54 -> F35/FS51: the methodology banner's source (kafaa_skill_changes) is readable by every persona who opens those pages and the
//     notices SQL selects equal methodologyNotices() for both dashboard keys.
//  3. FS54 <-> FS57: kafaa_fs63_health takes its teaching flags from kafaa_cov_taught (one rule) and equals taxonomyHealth() with the
//     shared inputs on three dates.
//  4. FS55 lint -> wave F: one engine card per ranked surface (34), the three wave-F cards name their TS and SQL scoring functions, and
//     the SQL functions exist.
//  5. FS57 -> FS17: a backlog sync on the final seed adds nothing (every uncovered need and open FS17 gap has its row and owner).
//  6. Handover 3.9: the newest kafaa_skill_states_v2 / kafaa_skills_apply (fs65) carry every recorded ref_table incl. roleplay_sessions;
//     kafaa_skills_apply keeps validated role-play evidence and leaves the person's states equal to the seed.
//  7. FS59 -> F36: kafaa_dg_gather = gatherDigest for every role-play reviewer and a spread of staff on two days; every owed review is an
//     approval for its reviewer; forward proof of the guarded replay (from the wave-E digests to the seed, second run changes nothing).
//  8. FS56 after FS59: the stored skill-change measures equal skillChange() on the final seed.
//  9. RLS perf form on the 11 new wave-F tables; additivity and grants of the QA migration; md5s for the live comparison.
import { readFileSync, readdirSync } from 'node:fs';
import { RECORDED_REF_TABLES } from '../../src/domain/skills.ts';
import { buildDigestItems, digestNotice, gatherDigest, prefsOf } from '../../src/shell/digest/rules.ts';
import { RANKED_SURFACES } from '../../src/modules/m16/surfaces.ts';
import { methodologyNotices, taxonomyHealth } from '../../src/modules/m16/taxonomyGov.ts';
import { taughtBy } from '../../src/modules/m25/coverage.ts';
import { skillChange, skillChangeWorld } from '../../src/modules/m25/skillChange.ts';
import { WAVE_F_REF_TABLES } from '../seed/ext/fsqa6-integration.mjs';

const FILE = 'supabase/migrations/20261010269001_kafaa_fs6qa_integration.sql';
const NEW_TABLES = ['critical_skills', 'critical_skill_reviews', 'skill_forecasts', 'benchmark_values', 'skill_change_requests', 'skill_changes', 'surface_fairness',
  'skill_change_measures', 'gap_backlog', 'aps_scenarios', 'aps_attempts', 'roleplay_scenarios', 'roleplay_sessions'];
const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().filter((k) => v[k] !== undefined && v[k] !== null).map((k) => `${k}:${canon(v[k])}`).join(',')}}` : typeof v === 'number' ? String(Number(v)) : JSON.stringify(v ?? null));

export default async function fsqa6Checks({ db, as, ok, uid }) {
  console.log('FS QA · wave F integration (FS50-FS59)');
  const S = JSON.parse(readFileSync('src/seed/seed.json', 'utf8'));
  const T = S.tables;
  const day = S.meta.demo_today;
  const sql = readFileSync(FILE, 'utf8');
  const q = async (s, p = []) => (await db.query(s, p)).rows;
  const q1 = async (s, p = []) => (await q(s, p))[0];
  const rows = async (t) => (await q(`select to_jsonb(x) j from kafaa_${t} x order by id`)).map((r) => r.j);
  const md5 = async (names) => Object.fromEntries((await q(`select p.proname n, p.prosrc s, md5(p.prosrc) m from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace where ns.nspname = 'public' and p.proname = any($1)`, [names])).map((r) => [r.n, r]));
  const migs = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort();
  const lastDef = (fn) => migs.filter((f) => new RegExp(`create or replace function ${fn}\\(`).test(readFileSync(`supabase/migrations/${f}`, 'utf8'))).pop();

  // 1. FS51 <-> FS52
  const O = await import('../../src/modules/m07/outlook.ts');
  const inp = O.inputFromTables((t) => T[t] ?? []);
  const so = T.skill_outlooks ?? [];
  const byteBad = so.filter((o) => { const r = O.outlookFor(inp, { ...o.params, automation_adoption: 0 }); return r.code !== 'ok' || JSON.stringify(r.result) !== JSON.stringify(o.results); });
  const stress = so.find((o) => o.id === 'so-attrition-stress');
  const b1 = await md5(['kafaa_so_base', 'kafaa_so_for', 'kafaa_sf_base']);
  const waveF = migs.filter((f) => /^202610102[6]\d{4}_/.test(f));
  ok(so.length === 5 && byteBad.length === 0 && stress.results.totals.families_short === 10 && stress.results.totals.visible === 10
    && lastDef('kafaa_so_base') === '20261010229001_kafaa_fs2qa_integration.sql' && /fs_area is null/.test(b1.kafaa_so_base.s)
    && waveF.every((f) => !/create or replace function kafaa_so_base\(/.test(readFileSync(`supabase/migrations/${f}`, 'utf8')))
    && /automation/.test(b1.kafaa_so_for.s) && !!b1.kafaa_sf_base && lastDef('kafaa_so_for') === '20261010262001_kafaa_fs62_outlook_automation.sql',
  `FS51 <-> FS52: adoption 0 reproduces the ${so.length} stored outlooks byte for byte, stress test ${stress.results.totals.families_short} of ${stress.results.totals.visible}; kafaa_so_base keeps the fs2qa body (md5 ${b1.kafaa_so_base.m}); FS52 factor in kafaa_so_for (fs62); FS51 on its own kafaa_sf_* functions`);

  // 2. FS54 methodology banner source
  const changes = await rows('skill_changes');
  const readers = ['chco', 'k-hr-analyst', 'k-auditor', 'training-mgr', 'k-admin'].filter((p) => uid[p]);
  const seen = [];
  for (const p of [null, ...readers]) seen.push(Number((await as(p, 'select count(*)::int n from kafaa_skill_changes'))[0].n));
  const notice = async (dash) => (await q(`select id from kafaa_skill_changes where methodology and dashboards @> array[$1]::text[] and effective_on <= $2::date and $2::date - effective_on <= 90 order by effective_on desc, id collate "C" desc`, [dash, day])).map((r) => r.id);
  const nOut = await notice('skills_outlook'), nFc = await notice('skill_forecasts');
  ok(seen.every((n) => n === changes.length) && changes.length === T.skill_changes.length && nOut.length > 0 && nFc.length > 0
    && canon(nOut) === canon(methodologyNotices(changes, 'skills_outlook', day).map((c) => c.id)) && canon(nFc) === canon(methodologyNotices(changes, 'skill_forecasts', day).map((c) => c.id)),
  `FS54 -> F35/FS51: anon and ${readers.length} page personas read all ${changes.length} published changes; ${nOut.length} outlook and ${nFc.length} forecast notices on ${day} (SQL = methodologyNotices)`);

  // 3. one "taught by" rule
  const t = async (name) => rows(name);
  const hd = { skills: await t('skills'), courses: await t('courses'), courseSkillLinks: await t('course_skill_links'), pathways: await t('pathways'), standards: await t('qual_standards'),
    adaptiveBanks: await t('adaptive_banks'), adaptiveItems: await t('adaptive_items'), perfTasks: await t('performance_tasks'), twinScenarios: await t('twin_scenarios'), aiDrills: await t('ai_drills'),
    fitnessAreas: await t('fitness_areas'), profileVersions: await t('role_profile_versions'), roleCompetencies: await t('role_competencies'), taskSkills: await t('jta_task_skills'),
    competencies: await t('competencies'), pathwayGaps: await t('pathway_gaps'), externals: await t('external_resources') };
  let hdiff = [];
  for (const d of ['2026-03-31', day, '2027-06-30']) if (canon((await q1('select kafaa_fs63_health($1::date) h', [d])).h) !== canon(taxonomyHealth(hd, d))) hdiff.push(d);
  const h = (await q1('select kafaa_fs63_health($1::date) h', [day])).h;
  const cov = new Map(((await q1('select kafaa_cov_taught() j')).j).map((x) => [x.skill_id, x.items.map((i) => i.kind)]));
  const tb = taughtBy({ skills: hd.skills, competencies: hd.competencies, courses: hd.courses, course_skill_links: hd.courseSkillLinks, pathways: hd.pathways, pathway_gaps: hd.pathwayGaps, external_resources: hd.externals });
  const flagBad = h.skills.filter((s) => ['course', 'pathway', 'external'].some((k) => s[k] !== (cov.get(s.skill_id) ?? []).includes(k)) || (tb.has(s.skill_id) && !s.taught));
  ok(hdiff.length === 0 && flagBad.length === 0 && h.skills.length === h.summary.live,
    `FS54 <-> FS57: kafaa_fs63_health takes course / pathway / external from kafaa_cov_taught for all ${h.skills.length} live skills and equals taxonomyHealth on 3 dates (${h.summary.untaught} untaught, ${h.summary.orphans} orphans)${hdiff.length ? ` (differs ${hdiff[0]})` : ''}${flagBad.length ? ` (${flagBad[0].skill_id})` : ''}`);

  // 4. engine cards
  const cards = await rows('engine_cards');
  const ids = new Set(cards.map((c) => c.id));
  const wf = RANKED_SURFACES.filter((s) => s.wave === 'FSQA6');
  const sqlNamed = [...new Set(wf.flatMap((s) => cards.find((c) => c.id === s.card)?.scoring_functions ?? []).filter((f) => f.startsWith('sql:')).map((f) => f.slice(4)))];
  const exist = (await q(`select proname from pg_proc where proname = any($1)`, [sqlNamed])).map((r) => r.proname);
  ok(cards.length === RANKED_SURFACES.length && RANKED_SURFACES.every((s) => ids.has(s.card)) && wf.length === 3
    && wf.every((s) => { const c = cards.find((x) => x.id === s.card); return c && s.functions.every((f) => c.scoring_functions.includes(f)) && c.ranks === s.ranks && c.kernel_surface === s.kernel; })
    && sqlNamed.length >= 4 && sqlNamed.every((f) => exist.includes(f)),
  `FS55 lint: ${cards.length} engine cards for ${RANKED_SURFACES.length} ranked surfaces; the wave-F cards (${wf.map((s) => s.card).join(', ')}) name their TS and SQL functions (${sqlNamed.join(', ')})`);
  ok(Number((await as(null, 'select count(*)::int n from kafaa_engine_cards'))[0].n) === 0 && Number((await as('k-instructor', 'select count(*)::int n from kafaa_engine_cards'))[0].n) === cards.length,
    'engine cards: staff read all of them (incl. the wave-F cards), anon none (F24 rule)');

  // 5. backlog sync adds nothing
  await db.exec('begin');
  try {
    const n0 = Number((await q1('select count(*)::int n from kafaa_gap_backlog')).n);
    const r = (await as('training-mgr', 'select kafaa_sync_gap_backlog() r'))[0].r;
    const n1 = Number((await q1('select count(*)::int n from kafaa_gap_backlog')).n);
    const noOwner = Number((await q1(`select count(*)::int n from kafaa_gap_backlog where coalesce(owner_role, '') = ''`)).n);
    ok(r.ok && n1 === n0 && n0 === T.gap_backlog.length && noOwner === 0, `FS57 -> FS17: a backlog sync on the final seed adds nothing (${n0} rows, each with an owner)`);
  } finally { await db.exec('rollback'); }

  // 6. recorded evidence (handover 3.9)
  const b6 = await md5(['kafaa_skill_states_v2', 'kafaa_skills_apply']);
  const lists = ['kafaa_skill_states_v2', 'kafaa_skills_apply'].map((f) => (b6[f].s.match(/'fitness_attempts', 'adaptive_attempts', 'task_attempts', 'ai_drill_attempts'[^)]*\)/) ?? [''])[0]);
  ok(lists.every((l) => RECORDED_REF_TABLES.every((x) => l.includes(`'${x}'`)) && WAVE_F_REF_TABLES.every((x) => l.includes(`'${x}'`)))
    && lastDef('kafaa_skills_apply') === '20261010265001_kafaa_fs65_aps_roleplay.sql' && lastDef('kafaa_skill_states_v2') === '20261010265001_kafaa_fs65_aps_roleplay.sql',
  `3.9: the newest kafaa_skill_states_v2 / kafaa_skills_apply (fs65) carry all ${RECORDED_REF_TABLES.length} recorded ref_tables incl. roleplay_sessions (md5 ${b6.kafaa_skill_states_v2.m} / ${b6.kafaa_skills_apply.m})`);
  const rp = (await q1(`select person_id p from kafaa_skill_evidence where ref_table = 'roleplay_sessions' and active order by id limit 1`)).p;
  await db.exec('begin');
  try {
    const st = async () => (await q(`select id || ':' || level || ':' || coalesce(active, true) x from kafaa_person_skills where person_id = $1 order by id`, [rp])).map((r) => r.x).join('|');
    const ev = async () => Number((await q1(`select count(*)::int n from kafaa_skill_evidence where person_id = $1 and active and ref_table = 'roleplay_sessions'`, [rp])).n);
    const s0 = await st(), e0 = await ev();
    await q(`select kafaa_skills_apply($1, $2::date)`, [rp, day]);
    ok(e0 > 0 && (await ev()) === e0 && (await st()) === s0, `3.9: kafaa_skills_apply keeps the validated role-play evidence of ${rp} and leaves their states equal to the seed`);
  } finally { await db.exec('rollback'); }

  // 7. digest approvals for reviewers
  const data = Object.fromEntries(['people', 'qual_records', 'qual_standards', 'licences', 'skill_checkins', 'skill_ratings', 'mentoring_requests', 'mentoring_agreements', 'mentoring_sessions', 'opportunities',
    'opportunity_applications', 'career_conversations', 'refresh_state', 'refresh_prefs', 'enrolments', 'courses', 'person_skills', 'skills', 'role_competencies', 'career_paths', 'career_targets',
    'engine_settings', 'reco_optouts', 'ojt_logs', 'ojt_eval_requests', 'plant_visits', 'roleplay_sessions'].map((x) => [x, T[x] ?? []]));
  const reviewers = [...new Set(T.roleplay_sessions.map((s) => s.reviewer_id).filter(Boolean))].sort();
  const spread = T.people.filter((p) => p.kind === 'staff').map((p) => p.id).sort().filter((_, i) => i % 9 === 0);
  let dd = 0, dn = 0;
  const byId = (xs) => [...xs].sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const p of [...new Set([...reviewers, ...spread])]) for (const d of [day, '2026-10-11']) {
    const s = (await q1(`select kafaa_dg_gather($1, $2::date, '{}'::jsonb) j`, [p, d])).j;
    dn++; if (canon(byId(s)) !== canon(byId(gatherDigest(data, p, d)))) { dd++; if (dd === 1) console.log('    first digest diff', p, d); }
  }
  const owed = T.roleplay_sessions.filter((s) => s.review_status === 'requested' && s.requested_at);
  let miss = 0;
  for (const s of owed) {
    const g = (await q1(`select kafaa_dg_gather($1, current_date, '{}'::jsonb) j`, [s.reviewer_id])).j;
    if (!g.some((i) => i.id === `approval:roleplay_sessions:${s.id}` && i.link === '/training/role-play?tab=reviews' && i.why[0].code === 'approval_roleplay')) miss++;
  }
  const b7 = await md5(['kafaa_dg_gather']);
  ok(dd === 0 && dn >= 30 && owed.length > 0 && miss === 0, `FS59 -> F36: kafaa_dg_gather = gatherDigest on ${dn} reviewer/staff x day cases; all ${owed.length} owed role-play reviews are approvals for their reviewer (md5 ${b7.kafaa_dg_gather.m})`);
  // forward proof of the replay
  const runIds = [...sql.matchAll(/update kafaa_digest_runs set [\s\S]*?\n where id = '([^']+)'/g)].map((m) => m[1]);
  const ntIds = [...sql.matchAll(/update kafaa_notifications set [\s\S]*?\n where id = '([^']+)'/g)].map((m) => m[1]);
  const dig = async () => (await q1(`select md5(string_agg(x, '|' order by x)) d from (
    select 'r' || (to_jsonb(r) - 'built_at')::text x from kafaa_digest_runs r where id = any($1) union all
    select 'n' || jsonb_build_array(n.id, n.title_en, n.title_ar, n.body_en, n.body_ar)::text from kafaa_notifications n where id = any($2)) s`, [runIds, ntIds])).d;
  const final = await dig();
  const noRp = { ...data, roleplay_sessions: [] };
  const prefsBy = new Map(T.digest_prefs.map((p) => [p.person_id, p]));
  await db.exec('begin');
  try {
    await db.exec(`select set_config('kafaa.seeding', 'on', true)`);
    for (const id of runIds) {
      const r = T.digest_runs.find((x) => x.id === id);
      const items = buildDigestItems(noRp, r.person_id, r.as_of, prefsOf(prefsBy.get(r.person_id)));
      const n = digestNotice(items, r.frequency);
      await q(`update kafaa_digest_runs set items = $2::jsonb, item_count = $3 where id = $1`, [id, JSON.stringify(items), items.length]);
      await q(`update kafaa_notifications set title_en = $2, title_ar = $3, body_en = $4, body_ar = $5 where id = $1`, [r.notification_id, n.title_en, n.title_ar, n.body_en, n.body_ar]);
    }
    const live = await dig();
    await db.exec(sql);
    const once = await dig();
    await db.exec(sql);
    ok(runIds.length === 7 && ntIds.length === 7 && live !== final && once === final && (await dig()) === final,
      `forward proof: from the wave-E digests (no role-play approvals) the QA migration reaches the seed (${runIds.length} digest runs, ${ntIds.length} notices); a second run changes nothing`);
  } finally { await db.exec('rollback'); }

  // 8. FS56 after FS59
  const stored = T.skill_change_measures.map(({ computed_at, computed_by, ...r }) => r);
  const rule = skillChange(skillChangeWorld(T), day);
  ok(canon(stored) === canon(rule) && stored.length === 26, `FS56 after FS59: the ${stored.length} stored skill-change measures equal skillChange() on the final seed (incl. the validated role-play evidence)`);

  // 9. RLS perf form on the new wave-F tables; additivity and grants
  const pol = await q(`select tablename, qual from pg_policies where schemaname = 'public' and cmd = 'SELECT' and tablename = any($1)`, [NEW_TABLES.map((x) => `kafaa_${x}`)]);
  const bare = pol.filter((p) => /(?<!SELECT )kafaa_has_grant\(|(?<!SELECT )kafaa_me\(\)/.test(p.qual ?? ''));
  ok(new Set(pol.map((p) => p.tablename)).size === NEW_TABLES.length && bare.length === 0,
    `RLS perf: the read policies of the ${NEW_TABLES.length} new wave-F tables evaluate caller-only helpers once per statement${bare.length ? ` (${bare.map((p) => p.tablename).join(', ')})` : ''}`);
  const body = sql.replace(/--.*$/gm, '').replace(/\$j\$[\s\S]*?\$j\$/g, "''");
  ok(!/\b(drop|delete|truncate)\b/i.test(sql) && !/\balter\b/i.test(body) && !/\bcreate (table|index|policy|trigger)\b/i.test(body), 'the QA migration has no removal word, no ALTER and no new table, index, policy or trigger');
  const fns = [...body.matchAll(/create or replace function (\w+)/g)].map((m) => m[1]);
  const ins = [...body.matchAll(/insert into (\w+)/g)].map((m) => m[1]);
  const upd = [...body.matchAll(/\bupdate (\w+) set/g)].map((m) => m[1]);
  ok(canon(fns) === canon(['kafaa_fs63_health', 'kafaa_dg_gather']) && canon(ins) === canon(['kafaa_engine_cards']) && /on conflict \(id\) do nothing/.test(body)
    && upd.every((u) => u === 'kafaa_digest_runs' || u === 'kafaa_notifications') && (body.match(/\n where id = '[^']+' and /g) ?? []).length === upd.length,
  `the QA migration replaces two functions (same signatures), inserts ${ins.length} engine-card statement on conflict do nothing and makes ${upd.length} guarded updates`);
  const g = await q1(`select has_function_privilege('authenticated', 'kafaa_fs63_health(date)', 'execute') h, has_function_privilege('authenticated', 'kafaa_dg_gather(text, date, jsonb)', 'execute') d, has_function_privilege('anon', 'kafaa_fs63_health(date)', 'execute') a`);
  const b9 = await md5(['kafaa_fs63_health']);
  ok(g.h === false && g.d === false && g.a === false, `the replaced helpers keep their grants (no API role executes them) — md5 kafaa_fs63_health ${b9.kafaa_fs63_health.m}, kafaa_dg_gather ${b7.kafaa_dg_gather.m}`);
}
