// [FS wave E · E2 · FS41 + FS42 + FS43] PGlite checks for 20261010252001_kafaa_fs52_energy_transition.sql (Energy Transition Skills, M32).
// Seed (the four M32 tables load unchanged; CleanEnergyComp framework and targets pass their checks; value chains sourced and clean; the
// FS42/FS43 tracks run on published M19 pathways that pass pathwayProblems, resolve with no requested step in SQL and TS, FS43 under 10
// hours, the FS43 pathway reaches every MC-CLEAN-ENERGY criterion; readings pass the FS18 gate); SQL = TS parity on the database state
// (kafaa_cec_profile = cecProfile and kafaa_cec_level = cecLevel for every person, also after generated edits of the skill states inside a
// rolled-back transaction; kafaa_cec_stats_core = cecStats); RLS (framework public, explainers staff only); the two RPCs (Own / Agg, never
// audited, never ledgered, anonymous callers refused); internal rules not executable by API roles; the migration is additive.
// Prints the md5 of every new function body and the row digest of every new table for the live comparison.
import { readFileSync } from 'node:fs';
import { cecLevel, cecProfile, cecStats, frameworkProblems, targetProblems } from '../../src/modules/m32/cec.ts';
import { chainProblems, credentialRoute, quickRoute, trackHours, trackProblems, FS43_HOUR_CAP } from '../../src/modules/m32/transition.ts';
import { catalogueCheck, resolvePathway } from '../../src/modules/m19/pathways.ts';

const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${k}:${canon(v[k])}`).join(',')}}` : typeof v === 'number' ? String(Number(v)) : typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) ? String(Number(v)) : JSON.stringify(v ?? null));
const same = (a, b) => canon(a) === canon(b);
const M32 = ['cec_competences', 'cec_role_targets', 'value_chains', 'transition_tracks'];
const FUNCS = ['kafaa_cec_area_name', 'kafaa_cec_basis_rank', 'kafaa_cec_pct1', 'kafaa_cec_comp', 'kafaa_cec_profile', 'kafaa_cec_level', 'kafaa_cec_stats_core', 'kafaa_cec_mine', 'kafaa_cec_stats'];

export default async function fs52Checks({ db, as, one, count, ok, uid }) {
  const S = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables;
  console.log('FS wave E · E2 · FS41 CleanEnergyComp + FS42 energy-system integration + FS43 ESG and GHG literacy (M32)');
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  const fix = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v instanceof Date ? (/_at$/.test(k) ? v.toISOString() : v.toISOString().slice(0, 10)) : v]));
  const rows = async (t) => (await q(`select * from kafaa_${t} order by id`)).map(fix);

  // ── seed: the M32 tables load unchanged
  const D = {};
  for (const t of [...M32, 'skills', 'job_families', 'people', 'person_skills', 'pathways', 'pathway_steps', 'courses', 'external_resources', 'opportunities', 'microcred_defs',
    'fitness_areas', 'adaptive_banks', 'performance_tasks', 'horizon_lanes', 'benchmarks', 'catalogue_criteria', 'academies', 'course_pack_items']) D[t] = await rows(t);
  const byIdSort = (a) => [...a].sort((x, y) => (x.id < y.id ? -1 : 1));
  ok(M32.every((t) => D[t].length === S[t].length && same(D[t].map((r) => r.id), byIdSort(S[t]).map((r) => r.id)))
    && same(D.cec_competences.map((c) => [c.id, c.outcomes, c.skill_ids, c.learning, c.sources]), byIdSort(S.cec_competences).map((c) => [c.id, c.outcomes, c.skill_ids, c.learning, c.sources]))
    && same(D.value_chains.map((c) => [c.id, c.stages, c.facts]), byIdSort(S.value_chains).map((c) => [c.id, c.stages, c.facts])),
    `seed: ${M32.map((t) => `${D[t].length} ${t}`).join(', ')} load unchanged`);

  // ── FS41 acceptance on the database rows
  const learningExists = (r) => {
    const has = (t, id) => D[t].some((x) => x.id === id);
    return r.kind === 'course' ? has('courses', r.ref) : r.kind === 'pathway' ? D.pathways.some((p) => p.id === r.ref && p.status === 'published') : r.kind === 'external' ? D.external_resources.some((x) => x.id === r.ref && x.status === 'published')
      : r.kind === 'adaptive' ? has('adaptive_banks', r.ref) : r.kind === 'task' ? has('performance_tasks', r.ref) : r.kind === 'credential' ? D.microcred_defs.some((d) => d.code === r.ref && d.status === 'current')
      : r.kind === 'lane' ? has('horizon_lanes', r.ref) : r.kind === 'chain' ? has('value_chains', r.ref) : r.kind === 'academy' ? has('academies', r.ref) : r.kind === 'opportunity' ? has('opportunities', r.ref) : false;
  };
  ok(frameworkProblems(D.cec_competences, D.skills, learningExists).length === 0, 'acceptance FS41: 12 competences, three in each of the four areas, each with 2-4 learning outcomes in EN and AR, its GreenComp area and a GreenComp source');
  ok(D.cec_competences.every((c) => c.skill_ids.some((id) => D.skills.find((s) => s.id === id)?.fs_area) && c.learning.length >= 1 && c.learning.every(learningExists)),
    'acceptance FS41: every competence links to at least one FS02 future skill and at least one existing learning item');
  ok(targetProblems(D.cec_role_targets, D.job_families.map((f) => f.id), D.cec_competences.map((c) => c.id)).length === 0 && D.cec_role_targets.length === D.job_families.length,
    `acceptance FS41: a role target for every one of the ${D.job_families.length} job families; public text passes publicTextIsClean`);

  // ── FS42 / FS43 acceptance on the database rows
  const ctx = { skills: D.skills, lanes: D.horizon_lanes.map((l) => l.id), pathways: D.pathways.map((p) => p.id), cec: D.cec_competences.map((c) => c.id), benchmarks: D.benchmarks.map((b) => b.id), today: '2026-10-11' };
  ok(D.value_chains.length === 3 && D.value_chains.every((c) => chainProblems(c, ctx).length === 0) && D.value_chains.flatMap((c) => c.facts).every((f) => /^https:\/\//.test(f.url) && /^\d{4}-\d{2}-\d{2}$/.test(f.as_of)),
    'acceptance FS42: three value chains; every fact carries an https source and an as-of date; copy passes publicTextIsClean with no ENEC project claim');
  const readings = D.external_resources.filter((x) => x.id.startsWith('xr-et-'));
  ok(readings.length === 5 && readings.every((x) => x.format === 'reading' && !x.has_assessment && catalogueCheck({ ...x, hours: x.hours == null ? null : Number(x.hours) }, D.catalogue_criteria, D.skills, '2026-10-11').ok),
    'FS42/FS43 readings: five published FS18 resources that meet the published criteria; format "reading" without an assessment, so FS17 discovery never picks them up');
  const content = { courses: D.courses, externals: D.external_resources.map((x) => ({ ...x, hours: x.hours == null ? null : Number(x.hours) })), opportunities: D.opportunities, credentials: D.microcred_defs,
    fitness: D.fitness_areas, adaptive: D.adaptive_banks, tasks: D.performance_tasks };
  const steps = D.pathway_steps.map((s) => ({ ...s, hours: Number(s.hours) }));
  let resolvedOk = true;
  for (const t of D.transition_tracks) {
    const p = D.pathways.find((x) => x.id === t.pathway_id);
    const ts = resolvePathway({ ...p, weekly_hours: Number(p.weekly_hours) }, steps, content);
    const sql = (await q('select kafaa_pw_resolve($1) j', [p.id]))[0].j;
    if (trackProblems(t, { ...p, weekly_hours: Number(p.weekly_hours) }, steps, D.skills).length || ts.requested !== 0 || !same(ts, sql)) resolvedOk = false;
  }
  ok(resolvedOk, 'acceptance FS42/FS43: both tracks run on published FS17 pathways that pass pathwayProblems (envelope and weekly hours like every other pathway), resolve with no requested step, SQL kafaa_pw_resolve = resolvePathway');
  const esg = D.transition_tracks.find((t) => t.feature === 'FS43');
  const esgP = D.pathways.find((p) => p.id === esg.pathway_id);
  const h = trackHours({ ...esgP, weekly_hours: Number(esgP.weekly_hours) }, steps, FS43_HOUR_CAP);
  const res = resolvePathway({ ...esgP, weekly_hours: Number(esgP.weekly_hours) }, steps, content);
  ok(h.total_hours < 10 && h.weekly_hours > 0 && quickRoute(res).all_fit, `acceptance FS43: completable in ${h.total_hours} h (< 10) at ${h.weekly_hours} h a week; every step has an item that fits its hours`);
  const def = D.microcred_defs.find((d) => d.code === esg.credential_code && d.status === 'current');
  const route = credentialRoute(def.criteria, res, { courses: D.courses, adaptive: D.adaptive_banks, tasks: D.performance_tasks });
  ok(route.length >= 2 && route.every((r) => r.covered), `acceptance FS43: completing the pathway's check counts toward every ${def.code} criterion (${route.map((r) => `${r.key} via ${r.via.map((v) => v.id).join('/')}`).join('; ')})`);

  // ── SQL = TS: CleanEnergyComp profile, level and stats
  const names = new Map(D.skills.map((s) => [s.id, s]));
  const parity = async (label) => {
    const people = await rows('people');
    const states = (await q('select id, person_id, skill_id, level, basis, active from kafaa_person_skills where active')).map(fix);
    const by = new Map(); for (const s of states) (by.get(s.person_id) ?? by.set(s.person_id, []).get(s.person_id)).push(s);
    const diffs = [];
    for (const p of people) {
      const s = (await q('select kafaa_cec_profile($1) j, kafaa_cec_level($1) l', [p.id]))[0];
      const t = cecProfile(p.id, p.job_family_id, D.cec_competences, D.cec_role_targets, by.get(p.id) ?? [], names);
      if (!same(s.j, t) || Number(s.l) !== cecLevel(D.cec_competences, by.get(p.id) ?? []) || t.level !== cecLevel(D.cec_competences, by.get(p.id) ?? [])) diffs.push(p.id);
    }
    const st = (await q('select kafaa_cec_stats_core() j'))[0].j;
    const ts = cecStats(people, D.cec_competences, D.cec_role_targets, by, 10);
    ok(diffs.length === 0 && same(st, ts), `SQL kafaa_cec_profile / kafaa_cec_level = cecProfile / cecLevel for all ${people.length} people and kafaa_cec_stats_core = cecStats (${label})${diffs.length ? ` (first diff ${diffs[0]})` : ''}`);
    return { people, ts };
  };
  const base = await parity('seed');
  const lv = new Set(base.people.filter((p) => p.kind === 'staff').map((p) => cecProfile(p.id, p.job_family_id, D.cec_competences, D.cec_role_targets,
    D.person_skills.filter((s) => s.person_id === p.id && s.active), names).level));
  ok(lv.has(0) && lv.has(1) && lv.has(2), `the seed exercises CleanEnergyComp levels ${[...lv].sort().join(', ')} (honest evidence, not tuned)`);
  ok(base.ts.by_family.every((f) => !['security', 'safeguards', 'cyber'].includes(f.family_id)) && base.ts.by_family.every((f) => (f.n === null || f.n >= 10) && (f.pct_met === null || f.n !== null))
    && base.ts.by_level.every((l) => l.n === null || l.n >= 10), 'cecStats: every count under 10 suppressed; security, safeguards and cyber never broken out');
  // generated edits inside a rolled-back transaction: self-claimed bases, capped levels, inactive rows, a person moved to another family
  await db.exec('begin');
  try {
    await db.exec(`select set_config('kafaa.seeding', 'on', true);
      update kafaa_person_skills set basis = 'claimed' where id in (select id from kafaa_person_skills where active and skill_id like 'sk-fs-gr-%' order by id limit 25);
      update kafaa_person_skills set level = 5 where id in (select id from kafaa_person_skills where active and skill_id in ('sk-ns-01', 'sk-fs-tr-analytical') order by id limit 20);
      update kafaa_person_skills set active = false where id in (select id from kafaa_person_skills where active and skill_id = 'sk-sc-01' order by id limit 30);
      update kafaa_people set job_family_id = 'environment' where id = 'p-k-ro';`);
    await parity('generated edits: claimed-only states, levels above 3, inactive rows, a family change');
  } finally { await db.exec('rollback'); }

  // ── RLS: framework public, explainers staff only
  uid['k-ro'] ??= '00000000-0000-4000-8000-000000005201';
  await q(`insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1, 'k-ro@test', 'k-ro', 'enec-ops', 'employee', $2) on conflict do nothing`, [uid['k-ro'], ['Reactor Operator']]);
  const seen = {};
  for (const p of [null, 'k-ro', 'sro', 'alnoor-gm', 'k-university', 'k-auditor']) seen[p ?? 'anon'] = await Promise.all(M32.map((t) => count(p, `kafaa_${t}`)));
  const full = M32.map((t) => S[t].length);
  ok(same(seen.anon, [12, 20, 0, 0]) && same(seen['alnoor-gm'], [12, 20, 0, 0]) && same(seen['k-university'], [12, 20, 0, 0]) && same(seen['k-ro'], full) && same(seen.sro, full) && same(seen['k-auditor'], full),
    `RLS: CleanEnergyComp and targets are public (skills_taxonomy R); value chains and tracks are staff only (internal_content R) (${JSON.stringify(seen)})`);
  let direct = false;
  try { await as('k-ro', `insert into kafaa_cec_competences (id, code, area, name_en, name_ar, summary_en, summary_ar, plant_en, plant_ar, greencomp_area, as_of) values ('x', 'x', 'values', 'x', 'x', 'x', 'x', 'x', 'x', 'x', current_date)`); } catch { direct = true; }
  ok(direct, 'reference rows cannot be written through the API');

  // ── RPCs
  const aud0 = Number((await q('select count(*)::int n from kafaa_audit_events'))[0].n);
  const led0 = Number((await q('select count(*)::int n from ledger_entries'))[0].n);
  const kro = (await one('k-ro', 'select kafaa_me() m')).m;
  const mine = (await one('k-ro', 'select kafaa_cec_mine() r')).r;
  ok(mine && mine.person_id === kro && same(mine, (await q('select kafaa_cec_profile($1) j', [kro]))[0].j) && mine.competences.length === 12 && mine.areas.length === 4,
    'kafaa_cec_mine: k-ro reads their own profile (12 competences, 4 areas, reasons) and nobody else\'s');
  const stats = (await one('chco', 'select kafaa_cec_stats() r')).r;
  const an = (await one('k-hr-analyst', 'select kafaa_cec_stats() r')).r;
  ok(stats && same(stats, base.ts) && same(an, base.ts) && !JSON.stringify(stats).includes('"p-'), 'kafaa_cec_stats: HR (Agg) reads the suppressed aggregate, which carries no person ids');
  const nulls = [(await one('k-ro', 'select kafaa_cec_stats() r')).r, (await one('alnoor-gm', 'select kafaa_cec_mine() r')).r, (await one('k-observer', 'select kafaa_cec_mine() r')).r];
  let anon = 0;
  for (const f of ['kafaa_cec_mine()', 'kafaa_cec_stats()']) { try { await as(null, `select ${f}`); } catch { anon++; } }
  ok(nulls.every((x) => x === null) && anon === 2, 'staff without Agg, partners and observers get null; anonymous callers cannot execute the RPCs');
  ok(Number((await q('select count(*)::int n from kafaa_audit_events'))[0].n) === aud0 && Number((await q('select count(*)::int n from ledger_entries'))[0].n) === led0, 'the reads write no audit or ledger rows');
  let internal = 0;
  for (const f of ["kafaa_cec_profile('p-k-ro')", "kafaa_cec_level('p-k-ro')", 'kafaa_cec_stats_core()', "kafaa_cec_comp('p-k-ro', 'cec-1-1', 1, null)"]) { try { await as('k-ro', `select ${f}`); } catch { internal++; } }
  const grants = await q(`select routine_name, grantee from information_schema.routine_privileges where routine_name like 'kafaa\\_cec\\_%' and grantee in ('anon', 'authenticated') order by 1, 2`);
  ok(internal === 4 && same(grants.map((g) => `${g.routine_name}:${g.grantee}`), ['kafaa_cec_mine:authenticated', 'kafaa_cec_stats:authenticated']), `internal rules are not executable by API roles; authenticated executes only the two RPCs, anon none (${grants.map((g) => g.routine_name).join(', ')})`);

  // ── additive migration
  const sql = readFileSync('supabase/migrations/20261010252001_kafaa_fs52_energy_transition.sql', 'utf8');
  const created = [...sql.matchAll(/create (?:table if not exists|or replace function|index if not exists) (\w+)/g)].map((m) => m[1]);
  const altered = [...sql.matchAll(/alter (?:table|policy \w+ on) (\w+)/g)].map((m) => m[1]);
  ok(!/\b(drop|delete|truncate)\b/i.test(sql) && created.every((n) => n.startsWith('kafaa_')) && altered.every((n) => n.startsWith('kafaa_')) && !/\binsert into\b|\bupdate \w+ set\b/i.test(sql),
    `the migration is additive: ${created.length} kafaa_* objects created, no drop/delete/truncate words, no data changes, alters only kafaa_* tables`);

  // ── digests for the live comparison
  const md5 = await q(`select p.proname, md5(p.prosrc) m from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any($1) order by 1`, [FUNCS]);
  console.log(`    fs52 function md5: ${md5.map((r) => `${r.proname}=${r.m}`).join(' ')}`);
  for (const t of [...M32, 'pathways', 'pathway_steps', 'external_resources', 'courses', 'credit_tags']) {
    const where = { pathways: "where id like 'pw-et-%'", pathway_steps: "where id like 'pw-et-%'", external_resources: "where id like 'xr-et-%'", courses: "where id like 'c-et-%'", credit_tags: "where item_id like 'pw-et-%' or item_id like 'c-et-%'" }[t] ?? '';
    const d = (await q(`select count(*)::int n, left(md5(coalesce(string_agg(t.id, '|' order by t.id), '')), 8) ids, left(md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by t.id), '')), 8) rws from kafaa_${t} t ${where}`))[0];
    console.log(`    fs52 digest kafaa_${t}${where ? ` (${where.replace('where ', '')})` : ''}: ${d.n} rows, ids ${d.ids}, rows ${d.rws}`);
  }
}
