// [FS wave B · E5] PGlite checks for 20261010225001_kafaa_fs25_future_roles.sql (FS15 future roles in the Navigator and Roadmap,
// FS16 role outlook labels): seed digests; SQL = TS for concept readiness (every staff member x every concept role), transition
// evidence (every current role x every role) and outlook labels (every role, every stored row); suppression under 10; RLS
// (labels and criteria public, components staff, the move mirror auditors only); the four RPCs (RBAC, refusals, audit, ledger,
// past years locked); the guarded F24 navigator card update reproduces the seeded card.
import { readFileSync } from 'node:fs';
import { careerFacts } from '../../src/modules/m18/career.ts';
import { conceptReadiness, transitionEvidence, MIN_GROUP } from '../../src/modules/m18/futureRoles.ts';
import { computeLabels, outlookLabel, labelReasons } from '../../src/modules/m18/outlookLabels.ts';
import { publicTextIsClean } from '../../src/domain/future.ts';

const canon = (x) => (Array.isArray(x) ? x.map(canon) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, canon(x[k])])) : x);
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const NOW = '2026-10-10';

export default async function fs25Checks({ db, as, one, count, ok }) {
  const T = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables;
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  const byId = (rows) => [...rows].sort((a, b) => (a.id < b.id ? -1 : 1));
  const strip = (rows, cols) => rows.map((r) => Object.fromEntries(cols.map((c) => [c, r[c] instanceof Date ? r[c].toISOString().slice(0, 10) : r[c]])));

  // ── seed digests
  const digest = async (table, cols, seedRows) => {
    const db1 = strip(await q(`select ${cols.join(', ')} from kafaa_${table} order by id`), cols);
    const s1 = strip(byId(seedRows), cols);
    return db1.length === s1.length && same(db1, s1);
  };
  ok(await digest('role_moves', ['id', 'from_role_id', 'to_role_id', 'moved_on', 'months_before', 'kind', 'simulated', 'source'], T.role_moves), `the ${T.role_moves.length} SIMULATED role moves load unchanged`);
  ok(await digest('role_outlook_criteria', ['id', 'version', 'year_from', 'thresholds', 'precedence', 'components', 'summary_en', 'summary_ar', 'sources', 'benchmark_ids', 'status'], T.role_outlook_criteria), 'the 2 criteria versions load unchanged');
  ok(await digest('role_outlook_labels', ['id', 'role_id', 'year', 'label', 'criteria_id', 'archived', 'published_by_role'], T.role_outlook_labels) && await digest('role_outlook_components', ['id', 'role_id', 'year', 'criteria_id', 'components'], T.role_outlook_components),
    `the ${T.role_outlook_labels.length} labels and their components load unchanged`);

  // ── TS inputs come from the database as it stands now (earlier validators may have changed states, settings or profiles)
  const D = {};
  for (const t of ['people', 'job_roles', 'career_paths', 'role_competencies', 'competencies', 'skills', 'person_skills', 'licences', 'qual_standards', 'qual_records', 'programmes', 'courses', 'training_records', 'enrolments', 'role_profile_versions', 'engine_settings', 'role_moves', 'skill_outlooks', 'career_targets', 'roadmaps']) {
    D[t] = (await q(`select * from kafaa_${t} order by id`)).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v instanceof Date ? (/_at$/.test(k) ? v.toISOString() : v.toISOString().slice(0, 10)) : v])));
  }

  // ── FS15: concept readiness, SQL = TS for every staff member with a role
  const weights = Object.fromEntries(Object.entries(D.engine_settings.find((s) => s.id === 'recommend')?.weights ?? {}).filter(([, v]) => typeof v === 'number'));
  const careerData = { people: D.people, roles: D.job_roles, edges: D.career_paths, roleComps: D.role_competencies, competencies: D.competencies, skills: D.skills, states: D.person_skills, licences: D.licences, standards: D.qual_standards, qualRecords: D.qual_records, programmes: D.programmes, courses: D.courses, trainingRecords: D.training_records, enrolments: D.enrolments };
  const conceptData = { roles: D.job_roles, versions: D.role_profile_versions, edges: D.career_paths, skills: D.skills, competencies: D.competencies, states: D.person_skills, weights };
  const staff = D.people.filter((p) => p.job_role_id).map((p) => p.id);
  const diffs = [];
  let nRows = 0;
  for (const pid of staff) {
    const ts = conceptReadiness(conceptData, careerFacts(careerData, pid, NOW), pid, null);
    const sql = (await q(`select kafaa_fs15_concept_readiness_compute($1, null, $2::date) r`, [pid, NOW]))[0].r;
    nRows += ts.length;
    if (!same(ts, sql)) diffs.push(pid);
  }
  ok(diffs.length === 0 && nRows === staff.length * 11, `concept readiness: kafaa_fs15_concept_readiness_compute = conceptReadiness() for ${staff.length} staff x 11 concept roles (${nRows} results)${diffs.length ? ` (differs: ${diffs.slice(0, 3).join(', ')})` : ''}`);
  const pick = ['fr-bwr-operator', 'reactor-operator', 'nope', 'fr-digital-twin', 'fr-bwr-operator', 'cyber-security-engineer'];
  const p1 = staff[0];
  const sub = (await q(`select kafaa_fs15_concept_readiness_compute($1, $2::text[], $3::date) r`, [p1, pick, NOW]))[0].r;
  ok(same(sub, conceptReadiness(conceptData, careerFacts(careerData, p1, NOW), p1, pick)) && sub.map((x) => x.role_id).join() === 'fr-bwr-operator,fr-digital-twin', 'an explicit role list keeps its order, drops duplicates, current, unknown and security roles (SQL = TS)');
  const all = staff.flatMap((pid) => conceptReadiness(conceptData, careerFacts(careerData, pid, NOW), pid, null));
  ok(all.every((r) => r.band !== 'profile_met' || (r.score >= 0.85 && r.months === 0)) && all.every((r) => r.reasons.some((x) => x.code === 'fs15_concept') && r.reasons.some((x) => x.code === 'fs15_profile')) && new Set(all.map((r) => r.band)).size >= 2,
    `every concept result carries the profile and the "no vacancy, no deployment decision" reason; bands seen: ${[...new Set(all.map((r) => r.band))].join(', ')}`);
  const kro = conceptReadiness(conceptData, careerFacts(careerData, 'p-k-ro', NOW), 'p-k-ro', null);
  ok(kro.find((r) => r.role_id === 'fr-bwr-operator')?.bridge?.mine === true, 'persona k-ro (Reactor Operator) has its own bridge into the small BWR operator concept role');

  // ── FS15: transition evidence, SQL = TS for every current role x every role
  const current = D.job_roles.filter((r) => r.lifecycle === 'current').map((r) => r.id);
  const everyRole = D.job_roles.map((r) => r.id);
  const tDiffs = [];
  const allTr = [];
  for (const from of current) {
    const ts = transitionEvidence(D.role_moves, D.job_roles, from, everyRole);
    const sql = (await q(`select kafaa_fs15_transition_compute($1, $2::text[], 10) r`, [from, everyRole]))[0].r;
    allTr.push(...ts);
    if (!same(ts, sql)) tDiffs.push(from);
  }
  ok(tDiffs.length === 0, `transition evidence: kafaa_fs15_transition_compute = transitionEvidence() for ${current.length} roles x ${everyRole.length} targets${tDiffs.length ? ` (differs: ${tDiffs.slice(0, 3).join(', ')})` : ''}`);
  const shown = allTr.filter((x) => !x.suppressed);
  const supp = allTr.filter((x) => x.suppressed && !x.path_only);
  ok(shown.length > 0 && supp.length > 0 && shown.every((x) => x.n >= MIN_GROUP) && supp.every((x) => x.n === null && x.median_months === null) && allTr.filter((x) => x.concept).every((x) => x.n === null) && allTr.filter((x) => x.analogue && !x.analogue.suppressed).every((x) => x.analogue.n >= MIN_GROUP),
    `counts under 10 are suppressed (no count, no median): ${shown.length} cells shown, ${supp.length} suppressed; concept targets never carry a count`);
  ok(allTr.filter((x) => T.job_roles.find((r) => r.id === x.to_role_id)?.security_sensitive || T.job_roles.find((r) => r.id === x.from_role_id)?.security_sensitive).every((x) => x.path_only && x.n === null), 'security, safeguards and cyber roles are path-only (no move numbers)');

  // ── FS16: labels reproduce from the rule (TS and SQL), and today's inputs reproduce the 2026 labels
  const crit = new Map(T.role_outlook_criteria.map((c) => [c.id, c]));
  const stored = T.role_outlook_labels.map((l) => ({ ...l, components: T.role_outlook_components.find((c) => c.id === l.id).components }));
  const ruleDiffs = [];
  for (const l of stored) {
    const th = crit.get(l.criteria_id).thresholds;
    const sql = (await q(`select kafaa_fs16_label($1::jsonb, $2::jsonb) l`, [JSON.stringify(l.components), JSON.stringify(th)]))[0].l;
    if (outlookLabel(l.components, th) !== l.label || sql !== l.label) ruleDiffs.push(l.id);
  }
  ok(ruleDiffs.length === 0 && stored.length === 75, `every stored label (${stored.length}, 3 years) reproduces exactly from its components and criteria version, in TS and SQL`);
  const released = D.skill_outlooks.filter((o) => o.status === 'released').sort((a, b) => (String(b.released_at) < String(a.released_at) ? -1 : String(b.released_at) > String(a.released_at) ? 1 : a.id < b.id ? -1 : 1))[0];
  const tsNow = computeLabels({ roles: D.job_roles, roleComps: D.role_competencies, skills: [...D.skills].sort((a, b) => a.sort - b.sort || (a.id < b.id ? -1 : 1)), outlook: { id: released.id, results: released.results }, versions: D.role_profile_versions }, crit.get('olc-v2'), 2026);
  const sqlNow = (await q(`select kafaa_fs16_compute(2026) v`))[0].v;
  ok(sqlNow.criteria_id === 'olc-v2' && same(sqlNow.rows, tsNow) && same(tsNow.map((r) => [r.id, r.label, r.components]), stored.filter((l) => l.year === 2026).sort((a, b) => (a.id < b.id ? -1 : 1)).map((l) => [l.id, l.label, l.components])),
    `kafaa_fs16_compute(2026) = computeLabels() = the stored 2026 labels (${tsNow.length} roles; ${['changing', 'growing', 'stable'].map((k) => `${tsNow.filter((r) => r.label === k).length} ${k}`).join(', ')})`);
  const th2 = crit.get('olc-v2').thresholds;
  const battery = [
    { growth_pct: 5, shortfall_pct: 0.1, change_pct: 29.9 }, { growth_pct: 4.9, shortfall_pct: 10, change_pct: 0 }, { growth_pct: 20, shortfall_pct: 0, change_pct: 10 }, { growth_pct: 20, shortfall_pct: 5, change_pct: 30 },
    { growth_pct: null, shortfall_pct: null, change_pct: 31 }, { growth_pct: null, shortfall_pct: null, change_pct: null }, { growth_pct: 8, shortfall_pct: 2, change_pct: null }, { growth_pct: 8, shortfall_pct: -2, change_pct: 50 },
  ];
  const bDiffs = [];
  for (const th of [th2, crit.get('olc-v1').thresholds]) for (const c of battery) {
    const sql = (await q(`select kafaa_fs16_label($1::jsonb, $2::jsonb) l`, [JSON.stringify(c), JSON.stringify(th)]))[0].l;
    if (sql !== outlookLabel(c, th)) bDiffs.push(JSON.stringify(c));
  }
  ok(bDiffs.length === 0 && new Set(battery.map((c) => outlookLabel(c, th2))).size === 3, `kafaa_fs16_label = outlookLabel() on ${battery.length * 2} boundary inputs under both criteria versions`);
  ok(T.role_outlook_criteria.every((c) => c.sources.length && c.sources.every((s) => /^https:\/\//.test(s.url) && s.as_of)) && labelReasons(stored[0].components, crit.get(stored[0].criteria_id).thresholds, stored[0].label).length >= 3,
    'every criteria version cites https sources with an as-of date; every label explains itself');
  const roles = T.job_roles;
  ok(!stored.some((l) => roles.find((r) => r.id === l.role_id)?.security_sensitive || roles.find((r) => r.id === l.role_id)?.lifecycle === 'concept'), 'security and concept roles carry no label');

  // ── RLS
  const anonLabels = await as(null, 'select * from kafaa_role_outlook_labels');
  const anonText = [...anonLabels.flatMap(Object.values), ...(await as(null, 'select summary_en, summary_ar from kafaa_role_outlook_criteria')).flatMap(Object.values)];
  ok(anonLabels.length === 75 && (await count(null, 'kafaa_role_outlook_criteria')) === 2 && (await count(null, 'kafaa_role_outlook_components')) === 0 && (await count(null, 'kafaa_role_moves')) === 0
    && !anonLabels.some((r) => Object.keys(r).some((k) => /headcount|demand|supply|components|person/.test(k))) && publicTextIsClean(anonText),
    'anonymous visitors read the labels and criteria only: no components, no move rows, no headcount (publicTextIsClean)');
  const seen = {};
  for (const p of ['sro', 'training-mgr', 'k-hr-analyst', 'chco', 'k-auditor', 'alnoor-gm', 'k-observer']) seen[p] = [await count(p, 'kafaa_role_outlook_components'), await count(p, 'kafaa_role_moves')];
  ok(['sro', 'training-mgr', 'k-hr-analyst', 'chco', 'k-auditor'].every((p) => seen[p][0] === 75) && ['alnoor-gm', 'k-observer'].every((p) => seen[p][0] === 0)
    && seen['k-auditor'][1] === T.role_moves.length && ['sro', 'training-mgr', 'k-hr-analyst', 'chco', 'alnoor-gm', 'k-observer'].every((p) => seen[p][1] === 0),
    `components are staff-readable (partners and observers none); the move mirror is read by auditors only (${JSON.stringify(seen)})`);

  // ── FS15 RPCs
  const me = async (p) => (await one(p, 'select kafaa_me() m')).m;
  const sroId = await me('sro');
  const fr = (await one('sro', `select kafaa_future_role_readiness($1, null) r`, [sroId])).r;
  ok(fr.ok && fr.data.length === 11 && same(fr.data, (await q(`select kafaa_fs15_concept_readiness_compute($1, null, current_date) r`, [sroId]))[0].r), 'kafaa_future_role_readiness: self returns all 11 concept roles');
  const other = staff.find((pid) => pid !== sroId && !D.career_targets.some((t) => t.person_id === pid && t.shared && t.active) && !D.roadmaps.some((r) => r.person_id === pid && r.shared && r.active));
  const refused = [(await one('sro', `select kafaa_future_role_readiness($1, null) r`, [other])).r, (await one('k-observer', `select kafaa_future_role_readiness($1, null) r`, [await me('k-observer')])).r, (await one('sro', `select kafaa_future_role_readiness('nobody', null) r`)).r];
  ok(same(refused.map((r) => r.code), ['forbidden', 'forbidden', 'not_found']), `refusals: another person's unshared plans, no skills profile, unknown person (${refused.map((r) => r.code).join(', ')})`);
  const te = (await one('sro', `select kafaa_transition_evidence('reactor-operator', array['senior-reactor-operator','fr-bwr-operator','shift-supervisor']) r`)).r;
  ok(te.ok && te.data[0].n === T.role_moves.filter((m) => m.from_role_id === 'reactor-operator' && m.to_role_id === 'senior-reactor-operator').length && te.data[1].concept && te.data[1].analogue?.suppressed === false && te.data[2].suppressed, 'kafaa_transition_evidence: RO -> SRO shows its count, the BWR concept role shows the operations-family analogue, RO -> shift supervisor (no direct moves) is suppressed');
  const teRef = [(await one('alnoor-gm', `select kafaa_transition_evidence('reactor-operator', array['senior-reactor-operator']) r`)).r, (await one('sro', `select kafaa_transition_evidence('nope', array['x']) r`)).r];
  let anonExec = false;
  try { await as(null, `select kafaa_transition_evidence('reactor-operator', array['senior-reactor-operator'])`); } catch { anonExec = true; }
  ok(same(teRef.map((r) => r.code), ['forbidden', 'not_found']) && anonExec, 'transition evidence is for staff only (partners refused, anonymous callers cannot execute it)');

  // ── FS16 RPCs
  const yr = new Date().getUTCFullYear();
  const pv = (await one('training-mgr', `select kafaa_outlook_labels_preview($1) r`, [yr])).r;
  const pvRef = [(await one('sro', `select kafaa_outlook_labels_preview($1) r`, [yr])).r, (await one('chco', `select kafaa_outlook_labels_preview($1) r`, [yr - 1])).r];
  ok(pv.ok && pv.data.rows.length === 25 && pv.data.changed === (yr === 2026 ? 0 : 25) && same(pvRef.map((r) => r.code), ['forbidden', 'invalid']), `preview (training manager): ${pv.data?.rows?.length} labels, ${pv.data?.changed} would change; staff without W are refused; only the current year`);
  const led = async () => (await q('select count(*)::int n from ledger_entries'))[0].n;
  const led0 = await led();
  const past = await q(`select id, label, published_at from kafaa_role_outlook_labels where year < $1 order by id`, [yr]);
  const pubRef = [(await one('training-mgr', `select kafaa_publish_outlook_labels($1) r`, [yr])).r, (await one('chco', `select kafaa_publish_outlook_labels($1) r`, [yr - 1])).r, (await one('chco', `select kafaa_publish_outlook_labels($1) r`, [yr + 1])).r];
  ok(same(pubRef.map((r) => r.code), ['forbidden', 'past_year_locked', 'invalid']), `publish refusals: training manager (no A), a past year (locked), a future year (${pubRef.map((r) => r.code).join(', ')})`);
  const pub = (await one('chco', `select kafaa_publish_outlook_labels($1) r`, [yr])).r;
  const aud = (await q(`select action, outcome, ledger_status, actor_role from kafaa_audit_events where action = 'outlook.publish' order by seq desc limit 1`))[0];
  const after = await q(`select id, label, published_at from kafaa_role_outlook_labels where year < $1 order by id`, [yr]);
  ok(pub.ok && pub.data.published === 25 && aud.outcome === 'ok' && aud.actor_role === 'hr_director' && (aud.ledger_status === 'skipped' || (await led()) === led0 + 1) && same(past, after),
    `the HR director publishes ${pub.data?.published} labels for ${yr} (audited, ledger ${aud.ledger_status}); past years are untouched`);
  const refAud = (await q(`select count(*)::int n from kafaa_audit_events where action = 'outlook.publish' and outcome = 'refused'`))[0].n;
  let direct = false;
  try { await as('chco', `insert into kafaa_role_outlook_labels (id, role_id, year, label, criteria_id, as_of) values ('x', 'reactor-operator', 2026, 'growing', 'olc-v2', current_date)`); } catch { direct = true; }
  let internal = false;
  try { await as('chco', `select kafaa_fs16_compute(2026)`); } catch { internal = true; }
  ok(refAud >= 3 && direct && internal, 'refusals are audited; labels cannot be written directly; the internal rules are not executable by API roles');

  // ── F24 navigator card: the guarded update reproduces the seeded card and runs once
  const cardSeed = T.engine_cards.find((c) => c.id === 'navigator');
  const cardCols = ['inputs_used', 'scoring_functions', 'limitations_en', 'limitations_ar', 'feature', 'version'];
  const cardNow = async () => strip(await q(`select ${cardCols.join(', ')} from kafaa_engine_cards where id = 'navigator'`), cardCols)[0];
  ok(same(await cardNow(), strip([cardSeed], cardCols)[0]), `the navigator engine card carries the FS15 inputs and scoring functions (version ${cardSeed.version})`);
  const mig = readFileSync('supabase/migrations/20261010225001_kafaa_fs25_future_roles.sql', 'utf8');
  const upd = mig.slice(mig.indexOf('update kafaa_engine_cards set'));
  await db.query(`update kafaa_engine_cards set inputs_used = (select jsonb_agg(x) from jsonb_array_elements(inputs_used) with ordinality t(x, o) where o <= jsonb_array_length(inputs_used) - 2),
    scoring_functions = scoring_functions[1:cardinality(scoring_functions) - 5], limitations_en = 'x', limitations_ar = 'x', feature = 'x', version = version - 2 where id = 'navigator'`); // FS55 (fsFe3): - 5 and - 2 also take off the rankConcepts append
  const fs63 = readFileSync('supabase/migrations/20261010263001_kafaa_fs63_taxonomy_governance.sql', 'utf8'); // FS55 (fsFe3): the later migration appends rankConcepts to this card once (version + 1)
  const qa6 = readFileSync('supabase/migrations/20261010269001_kafaa_fs6qa_integration.sql', 'utf8'); // FS wave F integration: the QA migration redefines kafaa_fs63_health after fs63 (shared "taught by" rule); replay it too so the shared database keeps the final body
  await db.exec(upd);
  await db.exec(fs63); await db.exec(qa6);
  const once = await cardNow();
  await db.exec(upd);
  await db.exec(fs63); await db.exec(qa6);
  ok(same(once, strip([cardSeed], cardCols)[0]) && same(await cardNow(), once), 'the migration\'s guarded card update turns the wave-3 card into the seeded one, and a second run changes nothing');
}
