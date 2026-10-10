// [FS wave B · E3 · FS11 + FS12] PGlite checks for 20261010223001_kafaa_fs23_role_transformation.sql (role transformation maps and
// the task exposure view). SQL = TS parity of transformRole (every current role x 2 horizons x people, from the rows in the database),
// exposureAggregate and transformationOverview (both horizons), the copy check and the publish checks; RLS (public maps, staff,
// drafts for admin/auditors, public timeline and archetypes); RBAC (staff read; HR aggregates; the training manager and HR director
// edit); suppression under 10 people; security roles path-level only; one audit row per call and the NEXUS ledger on publish.
import { readFileSync } from 'node:fs';
import { bannedWording, checkTransformation, exposureAggregate, isPathOnly, transformRole, transformationOverview } from '../../src/modules/m30/transform.ts';
import { publicTextIsClean } from '../../src/domain/future.ts';

const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${k}:${canon(v[k])}`).join(',')}}` : typeof v === 'number' ? String(Number(v)) : JSON.stringify(v));

export default async function fs23Checks({ db, one, count, ok, uid }) {
  const seed = JSON.parse(readFileSync('src/seed/seed.json', 'utf8'));
  const S = seed.tables;
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  console.log('FS wave B · E3 · FS11 role transformation maps + FS12 task exposure view');
  let n = 7230; // test identities, disjoint uid range 7231+ (FS wave B · E3)
  for (const [persona, role] of [['k-ro', 'Reactor Operator'], ['k-lo-trainee', 'Local Operator trainee'], ['rp-lead', 'RP Lead'], ['nuc-security', 'Security']]) {
    const row = (await q('select user_id from profiles where persona_id = $1', [persona]))[0];
    if (row) { uid[persona] = row.user_id; continue; }
    uid[persona] = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, 'enec-ops', 'employee', [role]]);
  }

  // ── seed (acceptance: all 28 roles have a map; public text clean, no headcount or numbers; security roles path-level only)
  const current = S.job_roles.filter((r) => (r.lifecycle ?? 'current') === 'current');
  ok(current.length === 28 && current.every((r) => S.role_transformations.filter((m) => m.role_id === r.id && m.status === 'published' && m.is_public).length === 1),
    'seed: all 28 current roles have one published, public role transformation map');
  const bad = S.role_transformations.filter((m) => checkTransformation({ ...m, publish: true }, S.job_roles.find((r) => r.id === m.role_id)) !== 'ok');
  ok(bad.length === 0, `seed: every map passes checkTransformation (clean text, the copy check, no numbers in public summaries, a source)${bad.length ? ` (${bad[0].role_id})` : ''}`);
  const sec = S.role_transformations.filter((m) => isPathOnly(S.job_roles.find((r) => r.id === m.role_id)));
  ok(sec.length === 3 && sec.every((m) => m.path_only && m.archetype === null && m.drivers.length === 0), 'seed: the 3 security, safeguards and cyber maps are path-level only (no archetype, no drivers)');
  const pubText = [...S.role_transformations.flatMap((m) => [m.public_summary_en, m.public_summary_ar]), ...S.transformation_milestones.flatMap((x) => [x.title_en, x.title_ar, x.body_en, x.body_ar]),
    ...S.transformation_archetypes.flatMap((x) => [x.name_en, x.name_ar, x.meaning_en, x.meaning_ar, x.learning_en, x.learning_ar, x.example_en, x.example_ar])];
  ok(publicTextIsClean(pubText) && pubText.every((t) => bannedWording(t) === null), 'seed: public text (summaries, timeline, archetypes) passes publicTextIsClean and the FS12 copy check');
  ok(S.transformation_milestones.length >= 5 && S.transformation_milestones.every((x) => x.sources.length && x.sources.every((s) => /^https:\/\//.test(s.url) && s.as_of))
    && S.transformation_milestones.filter((x) => x.kind === 'advance').every((x) => x.simulated || /no deployment decision implied/i.test(x.body_en)) && S.transformation_milestones.some((x) => x.kind === 'ossa' && !x.simulated),
  'seed: the timeline is sourced (https + as-of), OSSA support ending around 2030 is a sourced fact, ADVANCE gates are SIMULATED or say "no deployment decision implied"');

  // ── rows as the database holds them (after the earlier validators' writes)
  const rows = async (t, order = 'id') => q(`select * from ${t} order by ${order}`);
  const D = {
    roles: await rows('kafaa_job_roles'), maps: await rows('kafaa_role_transformations'), versions: await rows('kafaa_role_profile_versions'), tasks: await rows('kafaa_jta_tasks'),
    taskSkills: await rows('kafaa_jta_task_skills'), levels: await rows('kafaa_ai_capability_levels'), skills: await rows('kafaa_skills'), courses: await rows('kafaa_courses'),
    states: await rows('kafaa_person_skills'), people: await rows('kafaa_people'), families: await rows('kafaa_job_families'),
  };
  const mapOf = (roleId) => D.maps.find((m) => m.role_id === roleId) ?? null;
  const tsMap = (role, person, h) => transformRole({ role, map: mapOf(role.id), versions: D.versions, tasks: D.tasks, taskSkills: D.taskSkills, levels: D.levels, skills: D.skills, courses: D.courses,
    mine: person ? D.states.filter((s) => s.person_id === person) : null, horizon: h });
  const people = [null, 'p-k-ro', 'p-k-lo-trainee', 'p-rp-lead', 'w-mt-01', 'p-chco'].filter((p) => p === null || D.people.some((x) => x.id === p));
  const diffs = [];
  let checked = 0;
  for (const role of D.roles.filter((r) => (r.lifecycle ?? 'current') === 'current')) {
    for (const h of ['2030', '2035']) {
      for (const p of people) {
        const s = (await q('select kafaa_rt_map($1, $2, $3) v', [role.id, p, h]))[0].v;
        if (canon(s) !== canon(tsMap(role, p, h))) diffs.push(`${role.id}/${h}/${p}`);
        checked++;
      }
    }
  }
  ok(diffs.length === 0, `SQL kafaa_rt_map equals transformRole() for ${checked} role x horizon x person cases (tasks, reasons, skills added, bridge, my time-to-ready)${diffs.length ? ` (first diff ${diffs[0]})` : ''}`);
  const ro = tsMap(D.roles.find((r) => r.id === 'reactor-operator'), 'p-k-ro', '2030');
  ok(ro.tasks.length > 0 && ro.tasks.every((t) => t.reasons.length >= 2) && ro.added.length > 0 && ro.bridge.length === ro.added.length && ro.me && ro.me.gaps.every((g) => g.reasons.length) && ro.me.months === 2 * ro.me.levels,
    `the RO map: ${ro.tasks.length} tasks each with a reason, ${ro.added.length} skills added, a bridge step per skill, my time-to-ready lists the ${ro.me.gaps.length} gaps it is based on (${ro.me.months} months)`);
  const secMaps = D.roles.filter((r) => isPathOnly(r)).map((r) => tsMap(r, 'p-k-ro', '2030'));
  ok(secMaps.length === 3 && secMaps.every((m) => m.path_only && !m.tasks.length && !m.added.length && !m.bridge.length && !m.complements.length && m.me === null), 'security roles: path-level map only (no tasks, skills, bridge or time-to-ready)');

  // ── RLS
  ok((await count(null, 'kafaa_role_transformations')) === D.maps.filter((m) => m.is_public).length && (await count(null, 'kafaa_role_transformations', 'not is_public')) === 0, 'anon reads only published (public) maps');
  ok((await count('k-ro', 'kafaa_role_transformations')) === D.maps.length, 'staff (transformation R) read every map');
  ok((await count(null, 'kafaa_transformation_drafts')) === 0 && (await count('k-ro', 'kafaa_transformation_drafts')) === 0 && (await count('training-mgr', 'kafaa_transformation_drafts')) === 0
    && (await count('k-auditor', 'kafaa_transformation_drafts')) > 0, 'drafts: no direct read for anon, staff or editors (they use the RPC); admin and auditors read');
  ok((await count(null, 'kafaa_transformation_milestones')) === S.transformation_milestones.length && (await count(null, 'kafaa_transformation_archetypes')) === 3, 'anon reads the timeline and the three archetypes');

  // ── roleTransformation RPC
  const v1 = (await one('k-ro', `select kafaa_role_transformation(null, '2030') v`)).v;
  ok(v1 && v1.my_role_id === 'reactor-operator' && canon(v1.map) === canon(tsMap(D.roles.find((r) => r.id === 'reactor-operator'), 'p-k-ro', '2030')) && v1.can_edit === false && v1.draft === null,
    'kafaa_role_transformation (k-ro): my role by default, the map equals the TS map with my time-to-ready, no edit rights and no draft');
  const v2 = (await one('training-mgr', `select kafaa_role_transformation('reactor-operator', '2035') v`)).v;
  const sd = S.transformation_drafts.find((d) => d.role_id === 'reactor-operator');
  ok(v2 && v2.can_edit === true && v2.draft && canon(v2.draft.drivers) === canon(sd.content.drivers) && v2.draft.summary_en === sd.content.summary_en && v2.map.horizon === '2035', 'the training manager gets edit rights and the open draft; the horizon switches to 2035');
  const v3 = (await one('nuc-security', `select kafaa_role_transformation(null, '2030') v`)).v;
  ok(v3 && v3.map && v3.map.path_only === true && v3.map.tasks.length === 0 && v3.map.me === null, 'a security officer sees a path-level map of their own role only');
  ok((await one(null, `select kafaa_role_transformation(null, '2030') v`).catch(() => ({ v: 'refused' }))).v === 'refused', 'anon cannot execute kafaa_role_transformation');
  ok((await one('k-ro', `select kafaa_role_transformation('fr-digital-twin', '2030') v`)).v.map === null, 'concept roles have no transformation map (current roles only)');

  // ── FS12 aggregate and FS11 overview (HR), suppressed under 10
  const coh = { people: D.people, roles: D.roles, families: D.families };
  const ea = (await one('k-hr-analyst', 'select kafaa_exposure_aggregate() v')).v;
  const tsEa = exposureAggregate({ ...coh, tasks: D.tasks, levels: D.levels });
  ok(ea && canon(ea) === canon(tsEa), `kafaa_exposure_aggregate equals exposureAggregate(): ${tsEa.families.length} families, ${tsEa.groups.length} groups and the total`);
  const allCells = [...tsEa.families, ...tsEa.groups, tsEa.total];
  ok(allCells.every((c) => (c.suppressed ? c.people === null && c.shares === null : c.people >= 10)) && allCells.some((c) => c.suppressed) && allCells.some((c) => !c.suppressed),
    'aggregates under 10 people are suppressed (no count, no shares); larger groups are shown');
  ok(!tsEa.families.some((c) => ['security', 'safeguards', 'cyber'].includes(c.key)), 'security, safeguards and cyber families are never broken out');
  for (const h of ['2030', '2035']) {
    const ov = (await one('chco', `select kafaa_transformation_overview('${h}') v`)).v;
    const tsOv = transformationOverview({ ...coh, versions: D.versions, states: D.states, skills: D.skills, horizon: h });
    ok(ov && canon(ov) === canon(tsOv), `kafaa_transformation_overview('${h}') equals transformationOverview() (HR director), median months and ready share suppressed under 10`);
  }
  ok((await one('k-ro', 'select kafaa_exposure_aggregate() v')).v === null && (await one('training-mgr', 'select kafaa_exposure_aggregate() v')).v === null
    && (await one('k-ro', `select kafaa_transformation_overview('2030') v`)).v === null, 'aggregates are for HR only (transformation Agg/A): null for staff and the training manager');

  // ── the copy check: TS = SQL on banned and allowed wording, English and Arabic
  const words = ['AI will replace the operator', 'Replacement of roles', 'The role becomes redundant', 'Redundancies are planned', 'job losses', 'layoffs', 'eliminate jobs',
    'سيحل الذكاء الاصطناعي محل', 'استبدال المشغلين', 'الاستغناء عن الموظفين', 'تسريح العمال', 'وظيفة زائد عن الحاجة',
    'Tools take on routine work', 'AI assists; people keep the decision', 'placement of sensors', 'تتولى الأدوات العمل الروتيني', 'replica of the simulator'];
  const wd = [];
  for (const w of words) { const s = (await q('select kafaa_rt_banned($1) v', [w]))[0].v; if (s !== (bannedWording(w) !== null)) wd.push(w); }
  ok(wd.length === 0 && bannedWording(words[0]) && bannedWording(words[8]) && !bannedWording(words[12]) && !bannedWording(words[14]), `copy check: SQL kafaa_rt_banned equals bannedWording() on ${words.length} EN/AR phrases (banned blocked, allowed pass)${wd.length ? ` (${wd[0]})` : ''}`);

  // ── publishTransformation: RBAC, checks (TS = SQL codes), draft, publish, history, audit and ledger
  const audits = async () => Number((await q('select count(*)::int n from kafaa_audit_events'))[0].n);
  const led = async () => Number((await q('select count(*)::int n from ledger_entries'))[0].n);
  const call = (persona, input) => one(persona, 'select kafaa_publish_transformation($1::jsonb) r', [JSON.stringify(input)]).then((x) => x.r);
  const base = D.maps.find((m) => m.role_id === 'chemistry-technician');
  const good = { role_id: 'chemistry-technician', archetype: base.archetype, drivers: base.drivers, summary_en: base.summary_en, summary_ar: base.summary_ar,
    public_summary_en: base.public_summary_en, public_summary_ar: base.public_summary_ar, sources: base.sources, publish: false };
  let a0 = await audits();
  const r1 = await call('k-ro', good), r2 = await call('k-auditor', good), r3 = await call('k-hr-analyst', good);
  ok(!r1.ok && r1.code === 'forbidden' && !r2.ok && r2.code === 'forbidden' && !r3.ok && r3.code === 'forbidden' && (await audits()) === a0 + 3, 'staff, auditors and HR analysts cannot edit maps (forbidden, each audited)');
  const cases = [
    { ...good, role_id: 'nope' }, { ...good, role_id: 'fr-digital-twin' }, { ...good, drivers: ['quantum'] }, { ...good, drivers: ['ai_assist', 'ai_assist'] }, { ...good, archetype: 'hero' },
    { ...good, archetype: null }, { ...good, summary_en: 'Too short' }, { ...good, public_summary_ar: 'قصير' },
    { ...good, role_id: 'security-officer', archetype: 'mastery_builder', drivers: [] }, { ...good, role_id: 'safeguards-specialist', archetype: null, drivers: ['ai_assist'] },
    { ...good, summary_en: `${good.summary_en} The headcount stays the same.` }, { ...good, summary_en: `${good.summary_en} Tools replace manual sampling.` },
    { ...good, summary_ar: `${good.summary_ar} الاستغناء عن العمل اليدوي.` }, { ...good, public_summary_en: 'Tools take on two thirds of routine sampling by 2030.' },
    { ...good, public_summary_ar: 'تتولى الأدوات مزيداً من العمل الروتيني حتى ٢٠٣٠ تقريباً.' }, { ...good, sources: [], publish: true }, { ...good, sources: [{ label: 'x', url: 'http://insecure.example' }], publish: true },
  ];
  const cd = [];
  for (const c of cases) {
    const r = await call('training-mgr', c);
    const ts = checkTransformation(c, D.roles.find((x) => x.id === c.role_id) ?? null);
    if (r.ok || r.code !== ts || ts === 'ok') cd.push(`${JSON.stringify(c).slice(0, 60)} sql=${r.code} ts=${ts}`);
  }
  ok(cd.length === 0, `${cases.length} invalid inputs refused with the same code as checkTransformation() (not_found, invalid, security_restricted, unclean_text, banned_wording, public_numbers, source_required)${cd.length ? ` (${cd[0]})` : ''}`);
  a0 = await audits();
  let l0 = await led();
  const d1 = await call('training-mgr', { ...good, drivers: [...good.drivers, 'robotics'] });
  const dr = (await q(`select * from kafaa_transformation_drafts where role_id = 'chemistry-technician'`))[0];
  const m1 = (await q(`select * from kafaa_role_transformations where role_id = 'chemistry-technician'`))[0];
  ok(d1.ok && d1.data.status === 'draft' && dr && dr.open && dr.content.drivers.includes('robotics') && m1.version === base.version && canon(m1.drivers) === canon(base.drivers)
    && (await audits()) === a0 + 1 && (await led()) === l0, 'saving a draft keeps the published map unchanged; one audit row, no ledger row');
  a0 = await audits(); l0 = await led();
  const p1 = await call('chco', { ...good, drivers: [...good.drivers, 'robotics'], publish: true });
  const m2 = (await q(`select * from kafaa_role_transformations where role_id = 'chemistry-technician'`))[0];
  const dr2 = (await q(`select * from kafaa_transformation_drafts where role_id = 'chemistry-technician'`))[0];
  ok(p1.ok && p1.data.version === base.version + 1 && m2.status === 'published' && m2.is_public && m2.drivers.includes('robotics') && m2.history.length === base.history.length + 1
    && m2.history.at(-1).version === base.version && !dr2.open && (await audits()) === a0 + 1 && (await led()) === l0 + 1 && p1.ledger_seq !== null,
  'the HR director publishes: the version goes up, the previous version moves to the history, the draft closes, one audit row and one NEXUS ledger row');
  ok((await count(null, 'kafaa_role_transformations', `role_id = 'chemistry-technician' and 'robotics' = any(drivers)`)) === 1, 'the published map is visible to the public at once');
  const p2 = await call('training-mgr', { ...good, role_id: 'security-officer', archetype: null, drivers: [], summary_en: base.summary_en, publish: true });
  ok(p2.ok && (await q(`select path_only from kafaa_role_transformations where role_id = 'security-officer'`))[0].path_only === true, 'a security role can be republished at path level (no archetype, no drivers)');

  // ── grants
  for (const fn of [`kafaa_rt_map('reactor-operator', null, '2030')`, `kafaa_rt_banned('x')`, 'kafaa_rt_cohort()', `kafaa_rt_readiness('p-k-ro', '[]'::jsonb, '2030')`]) {
    let refused = false;
    try { await one('training-mgr', `select ${fn}`); } catch { refused = true; }
    ok(refused, `internal helper ${fn.split('(')[0]} is not executable by API roles`);
  }
  let anonRefused = false;
  try { await one(null, `select kafaa_publish_transformation('{}'::jsonb)`); } catch { anonRefused = true; }
  ok(anonRefused, 'anon cannot execute kafaa_publish_transformation');
}
