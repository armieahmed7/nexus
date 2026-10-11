// [FS wave C · E2 · FS19 + FS20] PGlite checks for 20261010232001_kafaa_fs32_course_pack_academies.sql (future-skills course pack,
// academies and cohorts). Seed acceptance (pack rules, the six skills nobody held, the cyber course copy check, academy template);
// SQL = TS parity: kafaa_fsc_copy_problems / kafaa_fsc_course_problems = copyProblems(courseTexts, courseUrls) for every pack course and
// synthetic cases, kafaa_acad_evidence_level = evidenceLevel, kafaa_acad_stats_core = academyStats; evidence keys follow the links;
// RLS (public pack and academies; members and capstones for the person, training staff and the named mentor and reviewer only); RPC
// flows (links + copy check, nominate, decide with module enrolments, capstone save and submit, reviewer sign-off writing ojt evidence
// that survives recompute, return with feedback); suppression under 10; helpers not executable by API roles.
import { readFileSync } from 'node:fs';
import { copyProblems, courseTexts, courseUrls, learningRoutes, packProblems, UNHELD_BASELINE, MAX_COURSE_HOURS } from '../../src/modules/m04/fsPack.ts';
import { academyStats, evidenceLevel, RESULTS } from '../../src/modules/m04/academy.ts';

const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${k}:${canon(v[k])}`).join(',')}}` : typeof v === 'number' ? String(Number(v)) : JSON.stringify(v ?? null));

export default async function fs32Checks({ db, one, ok, uid }) {
  const T = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables;
  console.log('FS wave C · E2 · FS19 future-skills course pack + FS20 academies and cohorts');
  const q = async (sql, p = []) => { await db.exec('reset role'); return (await db.query(sql, p)).rows; };
  const skills = new Map(T.skills.map((s) => [s.id, s]));
  const pack = T.course_pack_items;
  const course = new Map(T.courses.map((c) => [c.id, c]));

  // ── seed acceptance (FS19)
  const core = pack.filter((m) => m.kind === 'core');
  ok(core.length >= 18 && pack.filter((m) => m.kind === 'crossover').length >= 2, `seed: ${core.length} core pack courses + ${pack.length - core.length} cross-over versions for adjacent industries`);
  ok(pack.every((m) => packProblems(course.get(m.course_id), m, T.course_skill_links, skills).length === 0), `acceptance: every pack course is 60 h or less (max ${Math.max(...pack.map((m) => course.get(m.course_id).duration_hours))} <= ${MAX_COURSE_HOURS}), links at least one skill at a stated level 1-3, cites sources with an as-of date and is a SIMULATED outline`);
  const routes = learningRoutes(T.skills, [], T.course_skill_links);
  ok(UNHELD_BASELINE.every((id) => routes.find((r) => r.skill_id === id)?.courses.length > 0), 'acceptance: each of the 6 skills held by nobody gains at least one course');
  const cyber = pack.find((m) => m.theme === 'cyber');
  const cyberCourse = course.get(cyber.course_id);
  const cyberTs = copyProblems('cyber', courseTexts(cyberCourse, T.course_modules.filter((x) => x.course_id === cyberCourse.id), T.course_skill_links.filter((l) => l.course_id === cyberCourse.id)), courseUrls(cyberCourse));
  ok(cyberTs.length === 0 && cyber.copy_check === 'passed', 'acceptance: the cyber hygiene course has no security-restricted wording and links only awareness-level public pages (copy and link check)');
  ok(T.academies.length === 4 && T.academies.every((a) => a.module_course_ids.length && a.project_en && a.project_ar && a.mentor_role_en && a.mentor_role_ar), 'acceptance: four academies, each lists modules, a project and a mentor role');

  // ── SQL = TS parity
  const dbPack = await q('select course_id, theme from kafaa_course_pack_items order by sort');
  const diffC = [];
  for (const m of dbPack) {
    const c = (await q('select * from kafaa_courses where id = $1', [m.course_id]))[0];
    const mods = await q('select title_en, title_ar, n from kafaa_course_modules where course_id = $1 order by n', [m.course_id]);
    const links = await q('select * from kafaa_course_skill_links where course_id = $1 and active order by id', [m.course_id]);
    const ts = copyProblems(m.theme, courseTexts(c, mods, links), courseUrls(c));
    const sq = (await q('select kafaa_fsc_course_problems($1) j', [m.course_id]))[0].j;
    if (canon(ts) !== canon(sq)) diffC.push(m.course_id);
  }
  ok(dbPack.length === pack.length && diffC.length === 0, `SQL kafaa_fsc_course_problems equals copyProblems(courseTexts, courseUrls) for all ${dbPack.length} pack courses${diffC.length ? ` (first diff ${diffC[0]})` : ''}`);
  const cases = [
    ['cyber', ['Spot phishing', 'Keep the security plan secret'], ['https://www.iaea.org/node/97473']],
    ['cyber', ['ok'], ['http://www.iaea.org/x', 'https://example.com/cyber', 'https://niccs.cisa.gov/x', 'https://www.iaea.org/advisory/1']],
    ['data_ai', ['Exploit the data', 'VLAN tagging basics', null], ['https://example.com/a', ' https://cve-db.example.org/CVE-1 ']],
    ['green', [], []],
  ];
  let same = 0;
  for (const [th, tx, us] of cases) if (canon(copyProblems(th, tx, us)) === canon((await q('select kafaa_fsc_copy_problems($1, $2::text[], $3::text[]) j', [th, tx, us]))[0].j)) same++;
  ok(same === cases.length, `SQL kafaa_fsc_copy_problems equals copyProblems on ${cases.length} synthetic cases (restricted terms, http, off-list host, advisory path)`);
  let lv = 0;
  for (const r of [...RESULTS, 'x']) for (const l of [0, 1, 2, 3, 4]) if ((await q('select kafaa_acad_evidence_level($1, $2) v', [r, l]))[0].v === evidenceLevel(r, l)) lv++;
  ok(lv === 20, 'SQL kafaa_acad_evidence_level equals evidenceLevel (merit one level up, max 3; pass the stated level; not yet nothing)');
  const tabs = async () => ({
    academies: await q('select * from kafaa_academies'), cohorts: await q('select id, academy_id, status, capacity, starts_on::text starts_on from kafaa_academy_cohorts'),
    members: await q('select * from kafaa_academy_members'), capstones: await q('select * from kafaa_cohort_capstones'), enrolments: await q('select person_id, course_id, status from kafaa_enrolments'),
  });
  const statsParity = async (label) => {
    const x = await tabs();
    const ts = academyStats(x.academies, x.cohorts, x.members, x.capstones, x.enrolments);
    const sq = (await q('select kafaa_acad_stats_core(10) j'))[0].j;
    ok(canon(ts) === canon(sq), `SQL kafaa_acad_stats_core equals academyStats() ${label}`);
    return ts;
  };
  const st0 = await statsParity('on the seed');
  const cells = st0.academies.flatMap((a) => a.cohort_stats);
  ok(cells.every((c) => (c.participants == null || c.participants >= 10) && (c.alumni == null || c.alumni >= 10) && (c.reviewed == null || c.reviewed >= 10) && (c.nominations == null || c.nominations >= 10))
    && cells.some((c) => c.suppressed) && cells.some((c) => !c.suppressed) && st0.academies.every((a) => a.participants == null || a.participants >= 10),
  `acceptance: cohort statistics under 10 are suppressed (${cells.filter((c) => c.suppressed).length} of ${cells.length} cohorts suppressed)`);
  const keyed = await q(`select count(*)::int n from kafaa_course_skill_links l join kafaa_skills s on s.id = l.skill_id where l.active and l.course_id = any(s.evidence_keys)`);
  ok(keyed[0].n === T.course_skill_links.length, `every active link is the course's F01 evidence key on its skill (${keyed[0].n})`);
  const cev = await q(`select count(*)::int n, count(*) filter (where s.fs_area is null)::int f01 from kafaa_skill_evidence e join kafaa_skills s on s.id = e.skill_id where e.ref_table = 'cohort_capstones'`);
  ok(cev[0].n > 0 && cev[0].f01 === 0, `seed: ${cev[0].n} capstone evidence rows, all on FS02 future skills (the original 71-skill states are unchanged)`);

  // ── RLS
  let n = 3201;
  const addProfile = async (persona, role) => {
    if (uid[persona]) return;
    uid[persona] = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into profiles (user_id, email, persona_id, org_id, lens, roles) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [uid[persona], `${persona}@test`, persona, 'enec-ops', 'employee', [role]]);
  };
  for (const [p, r] of [['buyer', 'Buyer'], ['k-ro', 'Reactor Operator'], ['head-sq', 'Head of Quality'], ['outage-planner', 'Outage Planner'], ['qc-inspector', 'QC Inspector']]) await addProfile(p, r);
  const cnt = async (persona, t) => Number((await one(persona, `select count(*)::int n from ${t}`)).n);
  ok(await cnt(null, 'kafaa_course_pack_items') === pack.length && await cnt(null, 'kafaa_course_skill_links') === T.course_skill_links.length && await cnt(null, 'kafaa_academies') === 4 && await cnt(null, 'kafaa_academy_cohorts') === T.academy_cohorts.length,
    'RLS: the pack, its skill links, the academies and cohorts are public reference rows');
  ok(await cnt(null, 'kafaa_academy_members') === 0 && await cnt(null, 'kafaa_cohort_capstones') === 0 && await cnt('alnoor-gm', 'kafaa_academy_members') === 0, 'RLS: anonymous visitors and partners read no members or capstones');
  const mineB = T.academy_members.filter((m) => m.person_id === 'p-buyer').length;
  ok(await cnt('buyer', 'kafaa_academy_members') === mineB, `RLS: staff read only their own nominations and places (${mineB})`);
  ok(await cnt('training-mgr', 'kafaa_academy_members') >= T.academy_members.length, 'RLS: training staff (M04 rule) read every member row');
  const rev = T.cohort_capstones.filter((k) => k.reviewer_person_id === 'p-ai-governance').length;
  ok(await cnt('ai-governance', 'kafaa_cohort_capstones') === rev, `RLS: the named reviewer reads the capstones they review (${rev})`);

  // ── RPC: FS19 links and copy check
  const r = async (persona, sql, p = []) => (await one(persona, sql, p)).r;
  const linkBody = (extra = []) => JSON.stringify([{ skill_id: 'sk-fs-dp-procurement', level: 2, objective_en: 'Run a sourcing event end to end', objective_ar: 'إدارة عملية توريد من البداية إلى النهاية' }, ...extra]);
  ok((await r('buyer', 'select kafaa_save_course_skills($1, $2::jsonb) r', ['c-fs-procure', linkBody()])).code === 'forbidden', 'saveCourseSkills: staff without training W are refused');
  ok((await r('training-mgr', 'select kafaa_save_course_skills($1, $2::jsonb) r', ['c-fs-procure', linkBody([{ skill_id: 'sk-sa-01', level: 1, objective_en: 'Security career path', objective_ar: 'مسار مهني أمني' }])])).code === 'security_skill', 'saveCourseSkills: security skills are never linked');
  ok((await r('training-mgr', 'select kafaa_save_course_skills($1, $2::jsonb) r', ['c-fs-procure', linkBody([{ skill_id: 'sk-fs-gr-esg', level: 4, objective_en: 'Read an ESG report', objective_ar: 'قراءة تقرير بيئي' }])])).message === 'Levels are 1, 2 or 3', 'saveCourseSkills: levels are 1-3');
  const restr = await r('training-mgr', 'select kafaa_save_course_skills($1, $2::jsonb) r', ['c-fs-cyber', JSON.stringify([{ skill_id: 'sk-fs-cy-zones', level: 1, objective_en: 'Draw the network diagram of the plant', objective_ar: 'رسم مخطط الشبكة' }])]);
  ok(restr.code === 'restricted' && /network diagram/.test(restr.message), 'acceptance: the cyber hygiene course refuses security-restricted wording in its objectives');
  const save = await r('training-mgr', 'select kafaa_save_course_skills($1, $2::jsonb) r', ['c-fs-procure', linkBody([{ skill_id: 'sk-fs-gr-esg', level: 1, objective_en: 'Read the ESG data a supplier submits', objective_ar: 'قراءة البيانات البيئية التي يقدمها المورد' }])]);
  const esg = (await q(`select evidence_keys from kafaa_skills where id = 'sk-fs-gr-esg'`))[0].evidence_keys;
  const obj = (await q(`select objectives from kafaa_courses where id = 'c-fs-procure'`))[0].objectives;
  ok(save.ok && save.data.links === 2 && save.data.copy_check === 'passed' && esg.includes('c-fs-procure') && obj.length === 2 && obj[1].skill_id === 'sk-fs-gr-esg' && obj[1].level === 1,
    'saveCourseSkills: a new link is saved, becomes the evidence key and a course objective { skill_id, level } (what FS17 pathways resolve), and the copy check runs');
  const back = await r('training-mgr', 'select kafaa_save_course_skills($1, $2::jsonb) r', ['c-fs-procure', linkBody()]);
  ok(back.ok && !(await q(`select evidence_keys from kafaa_skills where id = 'sk-fs-gr-esg'`))[0].evidence_keys.includes('c-fs-procure') && (await q(`select active from kafaa_course_skill_links where id = 'csl-procure-fs-gr-esg'`))[0].active === false,
    'saveCourseSkills: a removed link is kept inactive (never deleted) and its evidence key is withdrawn');
  const chk = await r('training-mgr', 'select kafaa_check_course_pack() r');
  ok(chk.ok && chk.data.checked === pack.length && chk.data.passed === pack.length, `checkCoursePack: ${chk.data?.passed}/${chk.data?.checked} pack courses pass the copy and link check`);

  // ── RPC: FS20 nominate, decide, capstone, sign-off
  const lmOf = async (p) => (await q('select kafaa_sc_line_manager($1) v', [p]))[0].v;
  const team = (await q(`select id from kafaa_people where kind = 'staff' and status = 'active' and id <> 'p-sro' order by id`)).map((x) => x.id);
  let mate = null;
  for (const p of team) if (p !== 'p-k-ro' && (await lmOf(p)) === 'p-sro' && !T.academy_members.some((m) => m.person_id === p && m.academy_id === 'ac-energy')) { mate = p; break; }
  ok(!!mate, `test fixture: ${mate} reports to the SRO`);
  const nomSelf = await r('k-ro', `select kafaa_nominate_academy('{"cohort_id":"ac-energy-2026a"}'::jsonb) r`);
  const nomMate = await r('sro', 'select kafaa_nominate_academy($1::jsonb) r', [JSON.stringify({ cohort_id: 'ac-energy-2026a', person_id: mate, note: 'Ready for the energy cohort' })]);
  const nomOther = await r('buyer', 'select kafaa_nominate_academy($1::jsonb) r', [JSON.stringify({ cohort_id: 'ac-energy-2026a', person_id: 'p-k-ro' })]);
  const closed = await r('buyer', `select kafaa_nominate_academy('{"cohort_id":"ac-ai-2026b"}'::jsonb) r`);
  const twice = await r('buyer', `select kafaa_nominate_academy('{"cohort_id":"ac-energy-2026a"}'::jsonb) r`);
  ok(nomSelf.ok && nomMate.ok && nomOther.code === 'forbidden' && closed.code === 'closed' && twice.code === 'conflict',
    'nominateAcademy: myself and my own team only, open cohorts only, one open nomination per academy');
  ok((await r('alnoor-gm', `select kafaa_nominate_academy('{"cohort_id":"ac-energy-2026a"}'::jsonb) r`)).code === 'forbidden', 'nominateAcademy: partners are refused');
  const mid = nomSelf.data.id;
  ok((await r('sro', 'select kafaa_decide_academy_nomination($1::jsonb) r', [JSON.stringify({ member_id: mid, decision: 'accept', mentor_person_id: 'w-chem-03', reviewer_person_id: 'p-head-sustainability' })])).code === 'forbidden', 'decideAcademyNomination: only the programme owner decides');
  ok((await r('training-mgr', 'select kafaa_decide_academy_nomination($1::jsonb) r', [JSON.stringify({ member_id: mid, decision: 'accept', mentor_person_id: 'p-k-ro', reviewer_person_id: 'p-head-sustainability' })])).message.startsWith('Choose a mentor'), 'decideAcademyNomination: the nominee cannot be their own mentor');
  const acc = await r('training-mgr', 'select kafaa_decide_academy_nomination($1::jsonb) r', [JSON.stringify({ member_id: mid, decision: 'accept', mentor_person_id: 'w-chem-03', reviewer_person_id: 'p-head-sustainability' })]);
  const enr = (await q(`select count(*)::int n from kafaa_enrolments e where e.person_id = 'p-k-ro' and e.source = 'coordinator' and exists (select 1 from kafaa_academies a where a.id = 'ac-energy' and e.course_id = any(a.module_course_ids))`))[0].n;
  ok(acc.ok && acc.data.status === 'accepted' && acc.data.enrolled === 3 && enr === 3 && acc.ledger_seq != null, `decideAcademyNomination: acceptance enrols the member in the ${enr} module courses, names mentor and reviewer, drafts the capstone and is a ledger event`);
  const dec = await r('training-mgr', 'select kafaa_decide_academy_nomination($1::jsonb) r', [JSON.stringify({ member_id: nomMate.data.id, decision: 'decline', note: 'Next intake' })]);
  ok(dec.ok && dec.data.status === 'declined', 'decideAcademyNomination: a nomination can be declined with a note');

  // capstone: k-ro is active in AI cohort 2 (running)
  const kroMember = T.academy_members.find((m) => m.person_id === 'p-k-ro' && m.cohort_id === 'ac-ai-2026b').id;
  const kroCap = T.cohort_capstones.find((k) => k.member_id === kroMember);
  ok((await r('buyer', 'select kafaa_save_capstone($1::jsonb) r', [JSON.stringify({ member_id: kroMember, title: 'x', summary: 'y', submit: false })])).code === 'not_found', 'saveCapstone: only the member edits their capstone');
  ok((await r('k-ro', 'select kafaa_save_capstone($1::jsonb) r', [JSON.stringify({ member_id: kroMember, title: 'Alarm helper', summary: 'too short', submit: true })])).code === 'invalid', 'saveCapstone: a submission needs a title and a 20+ character summary');
  ok((await r('k-ro', 'select kafaa_save_capstone($1::jsonb) r', [JSON.stringify({ member_id: kroMember, title: 'Alarm helper', summary: 'Lists the alarm station codes and the security plan steps for each alarm', submit: true })])).code === 'restricted', 'saveCapstone: plant-security wording is refused');
  const sub = await r('k-ro', 'select kafaa_save_capstone($1::jsonb) r', [JSON.stringify({ member_id: kroMember, title: 'Alarm response cross-reference', summary: 'An approved-tool assistant that cross-references an alarm with the alarm response procedure index; verified against the index for two weeks.', submit: true })]);
  ok(sub.ok && sub.data.status === 'submitted', 'saveCapstone: the member submits to the named reviewer');
  ok((await r('k-ro', 'select kafaa_signoff_capstone($1::jsonb) r', [JSON.stringify({ capstone_id: kroCap.id, result: 'pass' })])).code === 'self', 'signoffCapstone: never by the member');
  ok((await r('training-mgr', 'select kafaa_signoff_capstone($1::jsonb) r', [JSON.stringify({ capstone_id: kroCap.id, result: 'pass' })])).code === 'forbidden', 'signoffCapstone: only the named reviewer (reviewer A), not even the programme owner');
  const so = await r('ai-governance', 'select kafaa_signoff_capstone($1::jsonb) r', [JSON.stringify({ capstone_id: kroCap.id, result: 'merit', feedback: 'Strong verification record.' })]);
  const evRows = await q(`select skill_id, level, kind, active from kafaa_skill_evidence where ref_table = 'cohort_capstones' and ref_id = $1 order by skill_id`, [kroCap.id]);
  const exp = T.academies.find((a) => a.id === 'ac-ai').capstone_skills.map((s) => ({ skill_id: s.skill_id, level: evidenceLevel('merit', s.level) })).sort((a, b) => (a.skill_id < b.skill_id ? -1 : 1));
  ok(so.ok && so.ledger_seq != null && canon(evRows.map((e) => ({ skill_id: e.skill_id, level: e.level }))) === canon(exp) && evRows.every((e) => e.kind === 'ojt' && e.active), 'acceptance: a signed-off capstone writes F01 ojt evidence on the academy\'s capstone skills (merit one level up) and is a ledger event');
  const ps = await q(`select skill_id, level from kafaa_person_skills where person_id = 'p-k-ro' and active and skill_id = any($1::text[])`, [exp.map((e) => e.skill_id)]);
  ok(ps.length === exp.length && ps.every((s) => s.level >= 1), 'acceptance: the sign-off recomputes the member\'s skills (states present for every capstone skill)');
  await q(`select kafaa_skills_apply('p-k-ro', current_date)`);
  ok((await q(`select count(*)::int n from kafaa_skill_evidence where ref_table = 'cohort_capstones' and ref_id = $1 and active`, [kroCap.id]))[0].n === exp.length, 'F01 recompute keeps capstone evidence (recorded ojt, not derived)');
  ok((await q('select status from kafaa_academy_members where id = $1', [kroMember]))[0].status === 'completed', 'the member becomes an alumnus of the academy');
  const buyerCap = T.cohort_capstones.find((k) => k.person_id === 'p-buyer' && k.status === 'submitted');
  ok((await r('ai-governance', 'select kafaa_signoff_capstone($1::jsonb) r', [JSON.stringify({ capstone_id: buyerCap.id, result: 'not_yet' })])).code === 'invalid', 'signoffCapstone: "not yet" needs feedback');
  const ret = await r('ai-governance', 'select kafaa_signoff_capstone($1::jsonb) r', [JSON.stringify({ capstone_id: buyerCap.id, result: 'not_yet', feedback: 'Add a week of independent checks.' })]);
  ok(ret.ok && ret.data.status === 'returned' && ret.data.evidence.length === 0 && (await q(`select count(*)::int n from kafaa_skill_evidence where ref_id = $1`, [buyerCap.id]))[0].n === 0, 'signoffCapstone: "not yet" returns the capstone for rework and writes no evidence');
  await statsParity('after the flows');
  const anonStats = await one(null, 'select kafaa_academy_stats() v');
  ok(anonStats.v && anonStats.v.academies.length === 4, 'academyStats: aggregates only, readable by anyone');
  const nomsS = (await one('sro', 'select kafaa_academy_nominees() v')).v;
  const nomsT = (await one('training-mgr', 'select kafaa_academy_nominees() v')).v;
  ok(nomsS[0].self && nomsS.some((x) => x.person_id === mate) && nomsT.length > nomsS.length && (await one('alnoor-gm', 'select kafaa_academy_nominees() v')).v.length === 0, `academyNominees: myself and my team (${nomsS.length}); everyone for the programme owner (${nomsT.length}); nobody for partners`);
  const audits = Number((await q(`select count(*)::int n from kafaa_audit_events where action like 'academy.%' or action like 'course.pack.%'`))[0].n);
  ok(audits >= 20, `every FS19/FS20 RPC writes an audit row, refusals included (${audits})`);
  const fns = (await q(`select p.proname from pg_proc p where p.proname like 'kafaa\\_fsc\\_%' or p.proname like 'kafaa\\_acad\\_%'`)).map((x) => x.proname);
  const exec = [];
  for (const f of fns) if ((await q(`select bool_or(has_function_privilege('authenticated', oid, 'execute')) or bool_or(has_function_privilege('anon', oid, 'execute')) e from pg_proc where proname = $1`, [f]))[0].e) exec.push(f);
  ok(fns.length >= 12 && exec.length === 0, `internal helpers are not executable by API roles (${fns.length} checked${exec.length ? `; executable: ${exec.join(', ')}` : ''})`);
}
