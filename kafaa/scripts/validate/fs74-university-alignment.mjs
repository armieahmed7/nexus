// [FS wave G · E4 · FS66 + FS67] PGlite checks for 20261010274001_kafaa_fs74_university_alignment.sql (university programme alignment, fellowships and
// sponsored placements). Seed sanity (every state present; endorsed programmes pass the computed criteria and carry the coverage the FS57 rule gives;
// no seeded graduate carries evidence; every fellowship names a host project and a supervisor role card; completion follows the milestones); SQL = TS
// parity on the shared database: kafaa_ua_coverage = programmeCoverage(), kafaa_ua_auto = autoCriteria(), kafaa_ua_problem = programmeProblem(),
// kafaa_ua_clean_skills = cleanSkills(), kafaa_ua_decision_problem = decisionProblem(), kafaa_ua_hire_problem = hireProblem(), kafaa_fw_plan =
// milestonePlan(), kafaa_fw_problem = fellowshipProblem(), kafaa_fw_ms_problem = milestoneProblem(), kafaa_fw_stats = fellowshipStats(); RLS (a
// partner university sees only its own programmes and fellowships); RPC flows and RBAC inside a rolled-back transaction (evidence is written only
// for endorsed programmes, maker-checker, completion from milestones); grants; additivity.
import { readFileSync } from 'node:fs';
import {
  autoCriteria, cleanSkills, decisionProblem, graduateEvidence, hireProblem, programmeCoverage, programmeProblem, gradStatus, addYears, COVERAGE_MIN,
} from '../../src/modules/m10/alignment.ts';
import { fellowshipProblem, fellowshipStats, isComplete, milestonePlan, milestoneProblem } from '../../src/modules/m10/fellowship.ts';

const BANNED = [['dr', 'op'], ['del', 'ete'], ['trun', 'cate']].map((p) => p.join('')); // destructive SQL words, spelled so this file does not contain them
const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${k}:${canon(v[k])}`).join(',')}}` : typeof v === 'number' ? String(Number(v)) : JSON.stringify(v ?? null));
const MIG = 'supabase/migrations/20261010274001_kafaa_fs74_university_alignment.sql';
const iso = (v) => (v instanceof Date ? v.toISOString() : v);
const norm = (rows) => rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, iso(v)])));
const d10 = (v) => (v == null ? null : String(v).slice(0, 10));
const first = (a, b) => { const x = canon(a), y = canon(b); if (x === y) return ''; let i = 0; while (i < x.length && x[i] === y[i]) i++; return ` (SQL …${x.slice(Math.max(0, i - 60), i + 80)} vs TS …${y.slice(Math.max(0, i - 60), i + 80)})`; };

export default async function fs74Checks({ db, one, ok }) {
  console.log('FS wave G · E4 · FS66 university programme alignment + FS67 fellowships and sponsored placements');
  await db.exec('reset role');
  const T = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables;
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  const tables = async (names) => Object.fromEntries(await Promise.all(names.map(async (n) => [n, norm(await q(`select * from kafaa_${n}`))])));
  const W = await tables(['skills', 'competencies', 'job_roles', 'role_profile_versions', 'skill_alignments', 'organisations', 'people', 'research_challenges', 'adv_technologies',
    'programme_alignments', 'programme_graduates', 'fellowships', 'fellowship_milestones']);
  const today = (await q('select current_date::text d'))[0].d;
  const progs = W.programme_alignments;

  // ── seed sanity (FS66)
  const st = (s) => progs.filter((p) => p.status === s).length;
  ok(progs.length === T.programme_alignments.length && progs.length >= 8 && ['draft', 'submitted', 'endorsed', 'returned'].every((s) => st(s) > 0) && progs.every((p) => p.sample === true),
    `seed: ${progs.length} SAMPLE programmes in every state (${st('endorsed')} endorsed, ${st('submitted')} submitted, ${st('returned')} returned, ${st('draft')} draft)`);
  const endorsed = progs.filter((p) => p.status === 'endorsed');
  const autoBad = endorsed.filter((p) => { const a = autoCriteria(p, W); return !a.outcomes || !a.coverage || !a.crosswalk; });
  ok(autoBad.length === 0 && endorsed.every((p) => canon(p.coverage_snapshot) === canon(programmeCoverage(p, W)) && d10(p.valid_to) === addYears(d10(p.decided_at), 3) && p.decided_by !== p.submitted_by && d10(p.covers_from) <= d10(p.decided_at)),
    `seed: every endorsed programme meets the computed criteria (coverage >= ${COVERAGE_MIN}), keeps the coverage the FS57 rule gives on the final profiles, was decided by someone other than the submitter and is valid for three years`);
  const grads = W.programme_graduates;
  const evAll = await q(`select count(*)::int n from kafaa_skill_evidence where ref_table = 'programme_alignments'`);
  ok(grads.length === T.programme_graduates.length && grads.every((g) => g.evidence_ids.length === 0 && g.status === gradStatus(progs.find((p) => p.id === g.programme_id), d10(g.graduated_on))) && evAll[0].n === 0
    && grads.some((g) => g.status === 'awaiting_endorsement') && grads.some((g) => g.status === 'not_covered'),
    `seed: ${grads.length} graduate hires, none with evidence (programme not endorsed yet, or graduation outside the window); no programme evidence row in the seed`);

  // ── seed sanity (FS67)
  const fws = W.fellowships, mss = W.fellowship_milestones;
  const people = new Map(W.people.map((p) => [p.id, p]));
  const hostOk = (f) => (f.host_kind === 'research_challenge' ? W.research_challenges.some((c) => c.id === f.host_ref && c.is_published) : W.adv_technologies.some((t) => t.id === f.host_ref));
  const supOk = (f) => { const s = people.get(f.supervisor_person_id); return !!s && s.kind === 'staff' && !!s.persona_id && s.id !== f.fellow_person_id; };
  ok(fws.length === T.fellowships.length && fws.length >= 40 && fws.every((f) => hostOk(f) && supOk(f) && f.supervisor_name_en),
    `acceptance (FS67): each of the ${fws.length} fellowships names a host project (published research challenge or ADVANCE study) and a supervisor role card`);
  const byF = new Map(fws.map((f) => [f.id, mss.filter((m) => m.fellowship_id === f.id)]));
  const planOk = fws.every((f) => canon(milestonePlan(f.id, f.kind, d10(f.starts_on), d10(f.ends_on))) === canon(byF.get(f.id).sort((a, b) => a.n - b.n).map((m) => ({ id: m.id, n: m.n, kind: m.kind, owner: m.owner, required: m.required, due_on: d10(m.due_on) }))));
  ok(planOk && fws.every((f) => (f.status === 'completed') === (f.status !== 'withdrawn' && isComplete(byF.get(f.id)))) && fws.some((f) => f.status === 'withdrawn')
    && mss.every((m) => m.status !== 'signed_off' || (m.signed_by && m.signed_by !== m.submitted_by)),
    'seed: five milestones per fellowship from the template; a fellowship is completed exactly when every required milestone is signed off; no milestone is signed off by its submitter');

  // ── parity FS66
  const covDiff = [];
  const variants = [];
  for (const p of progs) {
    variants.push({ skills: p.skills, target_role_ids: p.target_role_ids });
    variants.push({ skills: p.skills.slice(0, 3), target_role_ids: [...p.target_role_ids].reverse() });
    variants.push({ skills: p.skills.map((s) => ({ ...s, level: 1 })), target_role_ids: ['senior-reactor-operator', 'security-officer', 'zz-none', p.target_role_ids[0]] });
  }
  variants.push({ skills: [], target_role_ids: [] }, { skills: 'x', target_role_ids: 7 }, { skills: [{ skill_id: 'sk-sa-01', level: 2, modules: ['x'] }, { skill_id: 'sk-pf-01', level: 4, modules: [] }], target_role_ids: ['local-operator'] });
  for (const v of variants) {
    const a = (await q('select kafaa_ua_coverage($1::jsonb, $2::jsonb) j', [JSON.stringify(v.skills), JSON.stringify(v.target_role_ids)]))[0].j;
    const b = programmeCoverage(v, W);
    if (canon(a) !== canon(b)) covDiff.push(first(a, b));
    const c = (await q('select kafaa_ua_auto($1::jsonb, $2::jsonb) j', [JSON.stringify(v.skills), JSON.stringify(v.target_role_ids)]))[0].j;
    if (canon(c) !== canon(autoCriteria(v, W))) covDiff.push(`auto ${first(c, autoCriteria(v, W))}`);
  }
  ok(covDiff.length === 0, `acceptance (FS66): coverage reuses the FS57 rule: SQL kafaa_ua_coverage / kafaa_ua_auto equal programmeCoverage() / autoCriteria() on ${variants.length} programmes and variants${covDiff[0] ?? ''}`);
  const base = { university_org_id: 'ku', code: 'BSC-TEST', title_en: 'Test programme', title_ar: 'برنامج اختبار', degree: 'bachelor', nqf_level: 7, field_en: 'Field', field_ar: 'مجال',
    summary_en: '', summary_ar: '', target_role_ids: ['local-operator'], skills: [{ skill_id: 'sk-pf-01', level: 2, modules: ['Nuclear physics'] }, { skill_id: 'sk-co-01', level: 1, modules: [' Procedures '] }, { skill_id: 'sk-fs-ai-verify', level: 1, modules: ['AI'] }],
    placement: true, accreditation_ref: 'Ref' };
  const sk3 = base.skills;
  const muts = [{}, { university_org_id: 'kings' }, { university_org_id: 'org-alnoor' }, { university_org_id: null }, { university_org_id: 5 }, { code: 'a' }, { code: ' AB ' }, { code: 'A_B' }, { code: 'x'.repeat(31) }, { code: 9 },
    { title_en: 'ab' }, { title_ar: null }, { title_en: ' '.repeat(5) + 'abc' }, { degree: 'mba' }, { degree: null }, { nqf_level: 0 }, { nqf_level: 11 }, { nqf_level: 7.5 }, { nqf_level: null }, { nqf_level: '7' },
    { field_en: 'x'.repeat(121) }, { field_ar: 3 }, { summary_en: 'x'.repeat(601) }, { target_role_ids: [] }, { target_role_ids: ['a', 'b', 'c', 'd', 'e'] }, { target_role_ids: ['local-operator', 'local-operator'] },
    { target_role_ids: ['security-officer'] }, { target_role_ids: ['zz'] }, { target_role_ids: 'local-operator' }, { target_role_ids: [3] },
    { target_role_ids: [T.job_roles.find((r) => r.lifecycle === 'concept').id] }, { skills: sk3.slice(0, 2) }, { skills: [...sk3, sk3[0]] }, { skills: [...sk3.slice(0, 2), { ...sk3[2], level: 3 }] },
    { skills: [...sk3.slice(0, 2), { ...sk3[2], level: 0 }] }, { skills: [...sk3.slice(0, 2), { ...sk3[2], level: 1.5 }] }, { skills: [...sk3.slice(0, 2), { ...sk3[2], modules: [] }] },
    { skills: [...sk3.slice(0, 2), { ...sk3[2], modules: ['x'] }] }, { skills: [...sk3.slice(0, 2), { ...sk3[2], modules: ['ok', 3] }] }, { skills: [...sk3.slice(0, 2), { ...sk3[2], modules: Array(7).fill('Module') }] },
    { skills: [...sk3.slice(0, 2), { skill_id: 'sk-sa-01', level: 1, modules: ['Security'] }] }, { skills: [...sk3.slice(0, 2), { skill_id: 'sk-fs-dp-paperwp', level: 1, modules: ['Paper'] }] },
    { skills: [...sk3.slice(0, 2), { skill_id: 'zz', level: 1, modules: ['Zz'] }] }, { skills: [...sk3.slice(0, 2), 'x'] }, { skills: [...sk3.slice(0, 2), [1]] }, { skills: null },
    { accreditation_ref: 'x'.repeat(121) }, { accreditation_ref: null }, { placement: 'yes' }];
  const probDiff = [];
  for (const m of muts) {
    const inp = { ...base, ...m };
    const a = (await q('select kafaa_ua_problem($1::jsonb) c', [JSON.stringify(inp)]))[0].c;
    const b = programmeProblem(inp, W);
    if ((a ?? null) !== b) probDiff.push(`${JSON.stringify(m).slice(0, 60)}: ${a} vs ${b}`);
  }
  const cl = (await q('select kafaa_ua_clean_skills($1::jsonb) j', [JSON.stringify(base.skills)]))[0].j;
  ok(probDiff.length === 0 && canon(cl) === canon(cleanSkills(base.skills)), `SQL kafaa_ua_problem equals programmeProblem() on ${muts.length} generated drafts; kafaa_ua_clean_skills = cleanSkills()${probDiff.length ? ` (${probDiff[0]})` : ''}`);
  const subRow = progs.find((p) => p.status === 'submitted');
  const autoT = { outcomes: true, coverage: true, crosswalk: true };
  const dBase = { decision: 'endorse', note: 'All criteria checked by the reviewer', criteria: { assessment: true, placement: true, accreditation: true }, covers_from: addYears(today, -1) };
  const dMuts = [{}, { decision: 'return' }, { decision: 'approve' }, { decision: null }, { note: 'short' }, { note: 'x'.repeat(501) }, { note: 7 }, { criteria: { assessment: true, placement: true } }, { criteria: [] },
    { criteria: { assessment: true, placement: true, accreditation: 'true' } }, { covers_from: null }, { covers_from: today }, { covers_from: addYears(today, -3) }, { covers_from: addYears(today, 1) },
    { covers_from: '2026-02-30' }, { covers_from: 20250101 }, { covers_from: '2019-01-01' }];
  const decDiff = [];
  for (const m of dMuts) for (const [row, me, auto] of [[subRow, 'p-k-admin', autoT], [subRow, subRow.submitted_by, autoT], [subRow, 'p-k-admin', { ...autoT, coverage: false }], [undefined, 'p-k-admin', null], [endorsed[0], 'p-k-admin', autoT]]) {
    const inp = { ...dBase, ...m };
    const a = (await q('select kafaa_ua_decision_problem($1::jsonb, $2, $3, $4, $5, $6::jsonb, $7::date) c', [JSON.stringify(inp), !!row, row?.status ?? null, row?.submitted_by ?? null, me, auto ? JSON.stringify(auto) : null, today]))[0].c;
    const b = decisionProblem(inp, row, me, auto, today);
    if ((a ?? null) !== b) decDiff.push(`${JSON.stringify(m)}: ${a} vs ${b}`);
  }
  ok(decDiff.length === 0, `SQL kafaa_ua_decision_problem equals decisionProblem() on ${dMuts.length * 5} generated decisions (status, maker-checker, note, criteria, window)${decDiff.length ? ` (${decDiff[0]})` : ''}`);
  const hBase = { person_id: 'ap-150', programme_id: 'ua-iat-cert-dpo', graduated_on: addYears(today, -1), hired_on: today };
  const hMuts = [{}, { person_id: 'p-alnoor-gm' }, { person_id: 'zz' }, { person_id: 4 }, { programme_id: 'zz' }, { graduated_on: '1999-12-31' }, { graduated_on: addYears(today, 1) }, { graduated_on: '2026-13-01' },
    { hired_on: addYears(today, -2) }, { hired_on: addYears(today, 2) }, { hired_on: null }, { person_id: 'p-k-graduate', programme_id: 'ua-ku-bsc-nuc' }];
  const hDiff = [];
  for (const m of hMuts) {
    const inp = { ...hBase, ...m };
    const per = typeof inp.person_id === 'string' ? people.get(inp.person_id) : undefined;
    const prg = typeof inp.programme_id === 'string' ? progs.find((p) => p.id === inp.programme_id) : undefined;
    const ex = !!per && !!prg && grads.some((g) => g.id === `pg-${prg.id}-${per.id}`);
    const a = (await q(`select kafaa_ua_hire_problem($1::jsonb, (select p from kafaa_people p where p.id = $2), $3, $4, $5::date) c`, [JSON.stringify(inp), per?.id ?? null, !!prg, ex, today]))[0].c;
    const b = hireProblem(inp, per, prg, ex, today);
    if ((a ?? null) !== b) hDiff.push(`${JSON.stringify(m)}: ${a} vs ${b}`);
  }
  ok(hDiff.length === 0, `SQL kafaa_ua_hire_problem equals hireProblem() on ${hMuts.length} generated hires${hDiff.length ? ` (${hDiff[0]})` : ''}`);

  // ── parity FS67
  const planDiff = [];
  for (const kind of ['nest_fellowship', 'sponsored_study']) for (const [s, e] of [['2026-01-01', '2026-04-01'], ['2024-02-29', '2028-02-29'], ['2025-09-15', '2027-09-15'], ['2026-10-12', '2027-01-30']]) {
    const a = norm(await q('select id, n, kind, owner, due_on::text due_on from kafaa_fw_plan($1, $2, $3::date, $4::date)', ['fw-x', kind, s, e])).map((r) => ({ ...r, required: true }));
    if (canon(a) !== canon(milestonePlan('fw-x', kind, s, e))) planDiff.push(`${kind} ${s}`);
  }
  ok(planDiff.length === 0, `SQL kafaa_fw_plan equals milestonePlan() for both kinds over 4 spans${planDiff.length ? ` (${planDiff[0]})` : ''}`);
  const fBase = { kind: 'sponsored_study', title_en: 'Sponsored study', title_ar: 'دراسة مموّلة', fellow_person_id: 'ap-160', university_org_id: 'ku', host_kind: 'research_challenge', host_ref: 'rc-1',
    supervisor_person_id: 'p-training-mgr', starts_on: '2026-09-01', ends_on: '2028-09-01', placement_en: 'Placement in year two', placement_ar: 'تدريب في السنة الثانية' };
  const fw0 = fws[0];
  const fMuts = [{}, { kind: 'grant' }, { title_en: 'x' }, { title_ar: 5 }, { fellow_person_id: 'p-alnoor-gm' }, { fellow_person_id: 'zz' }, { university_org_id: null }, { university_org_id: '' }, { university_org_id: 'org-alnoor' },
    { kind: 'nest_fellowship', university_org_id: null }, { kind: 'nest_fellowship', university_org_id: '' }, { kind: 'nest_fellowship', university_org_id: 7 }, { host_kind: 'lab' }, { host_ref: 'rc-4' }, { host_ref: 'rc-zz' },
    { host_kind: 'advance_study', host_ref: 'tech-bwr' }, { host_kind: 'advance_study', host_ref: 'rc-1' }, { host_kind: 'advance_study', host_ref: 'tech-bwr', placement_en: 'Placement for 25 engineers at the site' },
    { host_kind: 'advance_study', host_ref: 'tech-bwr', title_en: 'Candidate site study' }, { supervisor_person_id: 'w-eng-01' }, { supervisor_person_id: 'ap-160' }, { supervisor_person_id: 'p-alnoor-gm' },
    { starts_on: '2026-09-01', ends_on: '2026-10-01' }, { ends_on: '2031-09-01' }, { starts_on: '2026-02-30' }, { ends_on: null }, { placement_en: '' }, { kind: 'nest_fellowship', placement_en: '' },
    { placement_ar: 'x'.repeat(301) }, { fellow_person_id: fw0.fellow_person_id, starts_on: `${d10(fw0.starts_on).slice(0, 4)}-12-01`, ends_on: `${Number(d10(fw0.starts_on).slice(0, 4)) + 2}-12-01` }];
  const fDiff = [];
  const fwWorld = { people: W.people, organisations: W.organisations, research_challenges: W.research_challenges, adv_technologies: W.adv_technologies, fellowships: fws };
  for (const m of fMuts) {
    const inp = { ...fBase, ...m };
    const a = (await q('select kafaa_fw_problem($1::jsonb) c', [JSON.stringify(inp)]))[0].c;
    const b = fellowshipProblem(inp, fwWorld);
    if ((a ?? null) !== b) fDiff.push(`${JSON.stringify(m).slice(0, 80)}: ${a} vs ${b}`);
  }
  ok(fDiff.length === 0, `SQL kafaa_fw_problem equals fellowshipProblem() on ${fMuts.length} generated fellowships (host, supervisor role card, dates, ADVANCE wording)${fDiff.length ? ` (${fDiff[0]})` : ''}`);
  const msDiff = [];
  const sampleMs = [mss.find((m) => m.status === 'planned' && m.owner === 'university'), mss.find((m) => m.status === 'submitted'), mss.find((m) => m.status === 'signed_off'), mss.find((m) => m.status === 'planned' && m.owner === 'enec')];
  const wd = fws.find((f) => f.status === 'withdrawn');
  for (const m of sampleMs) for (const fwX of [fws.find((f) => f.id === m.fellowship_id), wd]) {
    const actors = [fwX.fellow_person_id, fwX.supervisor_person_id, m.submitted_by ?? 'p-k-university', 'p-chco', 'p-sro'];
    for (const me of actors) for (const [hr, uni] of [[false, null], [true, null], [false, 'ku'], [false, fwX.university_org_id]]) for (const action of ['submit', 'sign_off', 'return', 'approve']) for (const note of ['', 'Short', 'A proper note here', 'x'.repeat(501)]) {
      const a = (await q(`select kafaa_fw_ms_problem($1, (select m from kafaa_fellowship_milestones m where m.id = $2), (select f from kafaa_fellowships f where f.id = $3), $4, $5, $6, $7) c`, [action, m.id, fwX.id, me, hr, uni, note]))[0].c;
      const b = milestoneProblem(action, m, fwX, { me, hr, uniOrg: uni }, note);
      if ((a ?? null) !== b) msDiff.push(`${m.id}/${fwX.id}/${me}/${hr}/${uni}/${action}/${note.length}: ${a} vs ${b}`);
    }
  }
  ok(msDiff.length === 0, `SQL kafaa_fw_ms_problem equals milestoneProblem() over milestone states x actors x roles x actions x notes${msDiff.length ? ` (${msDiff[0]})` : ''}`);
  const statDiff = [];
  for (const d of ['2024-01-01', '2025-06-30', '2026-10-11', today, '2028-01-01']) {
    const a = (await q('select kafaa_fw_stats($1::date) j', [d]))[0].j;
    const b = fellowshipStats(fws, mss, d);
    if (canon(a) !== canon(b)) statDiff.push(d + first(a, b));
  }
  const s0 = fellowshipStats(fws, mss, '2026-10-11');
  ok(statDiff.length === 0 && s0.overall.rate !== null && s0.by_university.some((c) => c.suppressed) && s0.by_university.some((c) => !c.suppressed),
    `acceptance (FS67): completion rate is computed from milestones (SQL kafaa_fw_stats = fellowshipStats() at 5 dates; overall ${s0.overall.rate}% of ${s0.overall.due} due) and cells under 10 are suppressed${statDiff.length ? ` (${statDiff[0]})` : ''}`);
  const allCells = [s0.overall, ...s0.by_kind, ...s0.by_host, ...s0.by_university];
  ok(allCells.every((c) => (c.awarded === null || c.awarded >= 10) && (c.due === null || c.due >= 10) && (c.completed === null || c.completed >= 10) && (c.awarded === null || c.rate !== null || c.suppressed)),
    'acceptance (FS67): no cell under 10 is shown, and an award count only travels with its completion rate (or the suppressed flag)');

  // ── RLS
  const cnt = async (who, sql) => Number((await one(who, sql)).n);
  ok(await cnt('k-university', `select count(*)::int n from kafaa_programme_alignments where university_org_id <> 'ku'`) === 0 && await cnt('k-university', 'select count(*)::int n from kafaa_programme_alignments') === progs.filter((p) => p.university_org_id === 'ku').length
    && await cnt('k-university', `select count(*)::int n from kafaa_fellowships where university_org_id is distinct from 'ku'`) === 0 && await cnt('k-university', 'select count(*)::int n from kafaa_fellowships') > 0,
    'acceptance (FS66): a partner university sees only its own programmes (and only fellowships it hosts)');
  ok(await cnt(null, 'select count(*)::int n from kafaa_programme_alignments') === 0 && await cnt('alnoor-gm', 'select count(*)::int n from kafaa_programme_alignments') === 0
    && await cnt('sro', 'select count(*)::int n from kafaa_programme_alignments') === 0 && await cnt(null, 'select count(*)::int n from kafaa_fellowships') === 0
    && await cnt('alnoor-gm', 'select count(*)::int n from kafaa_fellowships') === 0 && await cnt('k-university', 'select count(*)::int n from kafaa_programme_graduates') === 0,
    'RLS: anonymous visitors, supplier partners and staff without a recognition grant read no programme; nobody outside HR reads graduate hires or fellowships they are not part of');
  ok(await cnt('training-mgr', 'select count(*)::int n from kafaa_programme_alignments') === progs.length && await cnt('chco', 'select count(*)::int n from kafaa_programme_graduates') === grads.length
    && await cnt('chco', 'select count(*)::int n from kafaa_fellowships') === fws.length && await cnt('k-auditor', 'select count(*)::int n from kafaa_fellowship_milestones') === mss.length
    && await cnt('training-mgr', 'select count(*)::int n from kafaa_fellowships') === fws.filter((f) => f.supervisor_person_id === 'p-training-mgr').length,
    'RLS: recognition reviewers read every programme; the HR director reads graduate hires and every fellowship; auditors read all; a supervisor reads the fellowships they supervise');

  // ── RPC flows (rolled back)
  await db.exec('begin');
  try {
    const r = async (who, sql, p = []) => (await one(who, sql, p)).r;
    const led = async () => Number((await q('select count(*)::int n from ledger_entries'))[0].n);
    const aud = async () => Number((await q('select count(*)::int n from kafaa_audit_events'))[0].n);
    const evN = async (prog) => Number((await q(`select count(*)::int n from kafaa_skill_evidence where ref_table = 'programme_alignments' and ref_id = $1 and active`, [prog]))[0].n);
    // save
    const draft = { ...base, code: 'BSC-PGL', skills: base.skills, submit: false };
    const sS = await r('sro', 'select kafaa_save_programme($1::jsonb) r', [JSON.stringify(draft)]);
    const sK = await r('k-university', 'select kafaa_save_programme($1::jsonb) r', [JSON.stringify({ ...draft, university_org_id: 'kings' })]);
    const sBad = await r('k-university', 'select kafaa_save_programme($1::jsonb) r', [JSON.stringify({ ...draft, skills: base.skills.slice(0, 1) })]);
    const a0 = await aud();
    const sOk = await r('k-university', 'select kafaa_save_programme($1::jsonb) r', [JSON.stringify(draft)]);
    const a1 = await aud();
    const sDup = await r('k-university', 'select kafaa_save_programme($1::jsonb) r', [JSON.stringify(draft)]);
    const sLock = await r('k-university', 'select kafaa_save_programme($1::jsonb) r', [JSON.stringify({ ...draft, id: subRow.university_org_id === 'ku' ? subRow.id : 'ua-ku-bsc-nuc' })]);
    const saved = norm(await q(`select * from kafaa_programme_alignments where id = 'ua-ku-bsc-pgl'`))[0];
    ok(sS.code === 'forbidden' && sK.code === 'forbidden' && sBad.code === 'invalid' && sOk.ok && sOk.data.id === 'ua-ku-bsc-pgl' && saved.status === 'draft' && a1 === a0 + 1
      && canon(saved.skills) === canon(cleanSkills(base.skills)) && canon(sOk.data.coverage) === canon(programmeCoverage(saved, W)) && sDup.code === 'duplicate' && sLock.code === 'invalid',
      `saveProgramme: only the owning university (or a partnerships admin) saves; invalid drafts and duplicates refused; a submitted programme is locked; one audit row; coverage returned by the FS57 rule${sOk.ok ? '' : ` (${JSON.stringify([sS.code, sK.code, sBad.code, sOk, sDup.code, sLock.code])})`}`);
    // decide
    const kuBsc = progs.find((p) => p.id === 'ua-ku-bsc-nuc');
    const waiting = grads.filter((g) => g.programme_id === kuBsc.id);
    const eF = await r('chco', 'select kafaa_endorse_programme($1, $2::jsonb) r', [kuBsc.id, JSON.stringify(dBase)]);
    const eMc = await r('ai-governance', 'select kafaa_endorse_programme($1, $2::jsonb) r', ['ua-kings-msc-npp', JSON.stringify(dBase)]);
    const eCr = await r('k-admin', 'select kafaa_endorse_programme($1, $2::jsonb) r', [kuBsc.id, JSON.stringify({ ...dBase, criteria: { assessment: true } })]);
    const eDr = await r('k-admin', 'select kafaa_endorse_programme($1, $2::jsonb) r', ['ua-ku-msc-nem', JSON.stringify(dBase)]);
    ok(eF.code === 'forbidden' && eMc.code === 'maker_checker' && eCr.code === 'invalid' && eDr.code === 'invalid' && (await evN(kuBsc.id)) === 0,
      'endorseProgramme: framework owners only; the submitter cannot decide; all three reviewer criteria needed; drafts cannot be decided; no evidence before endorsement');
    const l0 = await led();
    const e = await r('k-admin', 'select kafaa_endorse_programme($1, $2::jsonb) r', [kuBsc.id, JSON.stringify({ ...dBase, covers_from: null })]); // default window: graduates from 1 Jan of last year
    const after = norm(await q('select * from kafaa_programme_alignments where id = $1', [kuBsc.id]))[0];
    const gAfter = norm(await q('select * from kafaa_programme_graduates where programme_id = $1 order by id', [kuBsc.id]));
    const expect = waiting.flatMap((g) => graduateEvidence({ id: g.id, person_id: g.person_id, graduated_on: d10(g.graduated_on) }, after, W));
    const rows = norm(await q(`select id, person_id, skill_id, kind, ref_table, ref_id, level, basis, status, observed_on::text observed_on, note from kafaa_skill_evidence where ref_table = 'programme_alignments' and ref_id = $1 order by id`, [kuBsc.id]));
    const states = Number((await q(`select count(*)::int n from kafaa_person_skills where person_id = 'p-k-graduate' and active and skill_id = any($1::text[])`, [after.skills.map((s) => s.skill_id)]))[0].n);
    ok(e.ok && e.data.graduates === gAfter.filter((g) => g.status === 'evidence_written').length && e.data.graduates > 0 && after.status === 'endorsed' && d10(after.valid_to) === addYears(today, 3) && canon(after.coverage_snapshot) === canon(programmeCoverage(after, W))
      && gAfter.every((g) => g.status === gradStatus(after, d10(g.graduated_on)) && (g.status !== 'evidence_written' || g.evidence_ids.length > 0)) && canon(rows) === canon(expect.sort((x, y) => (x.id < y.id ? -1 : 1))) && expect.length > 0 && states > 0 && (await led()) === l0 + 1,
      `acceptance (FS66): endorsement writes validated evidence (kind credential, ref_table programme_alignments, level <= 2) for the waiting graduates it covers (${e.data?.graduates} of ${waiting.length}) (${expect.length} rows = graduateEvidence()), recomputes their skills and writes the ledger`);
    const hF = await r('training-mgr', 'select kafaa_record_graduate_hire($1::jsonb) r', [JSON.stringify(hBase)]);
    const hRet = await r('chco', 'select kafaa_record_graduate_hire($1::jsonb) r', [JSON.stringify({ ...hBase, programme_id: 'ua-adpoly-bsc-est' })]);
    const hLap = await r('chco', 'select kafaa_record_graduate_hire($1::jsonb) r', [JSON.stringify({ ...hBase, person_id: 'ap-151', programme_id: 'ua-kaist-msc-ai', graduated_on: '2026-06-20' })]);
    const hEnd = await r('chco', 'select kafaa_record_graduate_hire($1::jsonb) r', [JSON.stringify({ ...hBase, person_id: 'ap-152' })]);
    const hDup = await r('chco', 'select kafaa_record_graduate_hire($1::jsonb) r', [JSON.stringify({ ...hBase, person_id: 'ap-152' })]);
    const notEndorsedEv = Number((await q(`select count(*)::int n from kafaa_skill_evidence e join kafaa_programme_alignments p on p.id = e.ref_id where e.ref_table = 'programme_alignments' and p.status <> 'endorsed'`))[0].n);
    ok(hF.code === 'forbidden' && hRet.ok && hRet.data.status === 'awaiting_endorsement' && hRet.data.evidence === 0 && hLap.ok && hLap.data.status === 'not_covered' && hLap.data.evidence === 0
      && hEnd.ok && hEnd.data.status === 'evidence_written' && hEnd.data.evidence === progs.find((p) => p.id === 'ua-iat-cert-dpo').skills.length && hDup.code === 'duplicate' && notEndorsedEv === 0,
      'acceptance (FS66): evidence is written only for endorsed programmes: a returned programme waits, a lapsed endorsement writes nothing, a covered graduate of an endorsed programme gets every mapped skill; HR director only; duplicates refused');
    // fellowships
    const fF = await r('sro', 'select kafaa_save_fellowship($1::jsonb) r', [JSON.stringify(fBase)]);
    const fBad = await r('chco', 'select kafaa_save_fellowship($1::jsonb) r', [JSON.stringify({ ...fBase, supervisor_person_id: 'w-eng-01' })]);
    const l1 = await led();
    const fOk = await r('chco', 'select kafaa_save_fellowship($1::jsonb) r', [JSON.stringify(fBase)]);
    const newMs = norm(await q(`select id, n, kind, owner, required, due_on::text due_on from kafaa_fellowship_milestones where fellowship_id = $1 order by n`, [fOk.data?.id]));
    ok(fF.code === 'forbidden' && fBad.code === 'invalid' && fOk.ok && fOk.data.milestones === 5 && canon(newMs) === canon(milestonePlan(fOk.data.id, 'sponsored_study', fBase.starts_on, fBase.ends_on)) && (await led()) === l1 + 1,
      'saveFellowship: HR only; the supervisor must be a role card; five milestones from the template; ledgered');
    const kg = fws.find((f) => f.fellow_person_id === 'p-k-graduate');
    const kgMs = mss.find((m) => m.fellowship_id === kg.id && m.status === 'planned' && d10(m.due_on) <= '2026-10-11');
    const subOther = await r('sro', 'select kafaa_update_milestone($1, $2, $3) r', [kgMs.id, 'submit', '']);
    const subOk = await r('training-mgr', 'select kafaa_update_milestone($1, $2, $3) r', [kgMs.id, 'sign_off', '']);
    ok(subOther.code === 'forbidden' && subOk.code === 'invalid', 'updateMilestone: only the fellow (or the university for its own milestones) submits; a planned milestone cannot be signed off');
    const uniMs = mss.find((m) => m.owner === 'university' && m.status === 'planned' && m.university_org_id === 'ku' && d10(m.due_on) <= '2026-10-11');
    const uSub = await r('k-university', 'select kafaa_update_milestone($1, $2, $3) r', [uniMs.id, 'submit', 'Year results attached']);
    const uSign = await r('k-university', 'select kafaa_update_milestone($1, $2, $3) r', [uniMs.id, 'sign_off', '']);
    const tSign = await r('training-mgr', 'select kafaa_update_milestone($1, $2, $3) r', [uniMs.id, 'sign_off', '']);
    ok(uSub.ok && uSign.code === 'forbidden' && tSign.ok, 'updateMilestone: the university submits its own milestone; it cannot sign it off; the named supervisor signs it off');
    const pend = mss.find((m) => m.status === 'submitted' && fws.find((f) => f.id === m.fellowship_id).supervisor_person_id === 'p-training-mgr' && m.n === 5);
    const before = (await q('select kafaa_fw_stats(current_date) j'))[0].j;
    const done = await r('training-mgr', 'select kafaa_update_milestone($1, $2, $3) r', [pend.id, 'sign_off', '']);
    const fwRow = (await q('select status from kafaa_fellowships where id = $1', [pend.fellowship_id]))[0];
    const afterS = (await q('select kafaa_fw_stats(current_date) j'))[0].j;
    const tsAfter = fellowshipStats(norm(await q('select * from kafaa_fellowships')), norm(await q('select * from kafaa_fellowship_milestones')), today);
    ok(done.ok && done.data.fellowship_status === 'completed' && fwRow.status === 'completed' && canon(afterS) === canon(tsAfter) && canon(afterS) !== canon(before),
      'acceptance (FS67): the last required sign-off completes the fellowship and the completion rate moves with the milestones (SQL = TS after the change)');
    const self = await r('chco', 'select kafaa_save_fellowship($1::jsonb) r', [JSON.stringify({ ...fBase, kind: 'nest_fellowship', university_org_id: null, fellow_person_id: 'p-chco', starts_on: '2026-10-01', ends_on: '2027-10-01', placement_en: '' })]);
    const m1 = `${self.data?.id}-m1`;
    const s1 = await r('chco', 'select kafaa_update_milestone($1, $2, $3) r', [m1, 'submit', 'Plan attached']);
    const s2 = await r('chco', 'select kafaa_update_milestone($1, $2, $3) r', [m1, 'sign_off', '']);
    const s3 = await r('training-mgr', 'select kafaa_update_milestone($1, $2, $3) r', [m1, 'return', 'no']);
    const s4 = await r('training-mgr', 'select kafaa_update_milestone($1, $2, $3) r', [m1, 'return', 'Please add the risk section']);
    ok(self.ok && s1.ok && s2.code === 'maker_checker' && s3.code === 'invalid' && s4.ok, 'updateMilestone: the person who submitted a milestone never signs it off (maker-checker, even with an HR grant); a return needs a note');
    const w1 = await r('chco', 'select kafaa_withdraw_fellowship($1, $2) r', [fOk.data.id, 'short']);
    const w2 = await r('chco', 'select kafaa_withdraw_fellowship($1, $2) r', [fOk.data.id, 'The student changed programme']);
    const w3 = await r('sro', 'select kafaa_withdraw_fellowship($1, $2) r', [self.data.id, 'The fellow changed role here']);
    ok(w1.code === 'invalid' && w2.ok && w3.code === 'forbidden', 'withdrawFellowship: HR only, with a reason of 10 to 300 characters');
    const stS = await r('sro', 'select kafaa_fellowship_stats() r');
    const stP = await r('alnoor-gm', 'select kafaa_fellowship_stats() r');
    const stO = await r('k-observer', 'select kafaa_fellowship_stats() r');
    ok(stS.ok && stP.ok && stO.code === 'forbidden' && canon(stS.data) === canon((await q('select kafaa_fw_stats(current_date) j'))[0].j), 'fellowshipStats: staff and partners read the aggregates (ecosystem R); observers are refused');
  } finally { await db.exec('rollback'); }

  // ── grants and additivity
  let denied = 0;
  const helpers = ["select kafaa_ua_coverage('[]'::jsonb, '[]'::jsonb)", "select kafaa_ua_problem('{}'::jsonb)", 'select kafaa_fw_stats(current_date)', "select kafaa_fw_problem('{}'::jsonb)",
    "select kafaa_ua_write_evidence('x', 'p-k-ro', current_date, 'ua-ku-msc-data', 'p-k-ro')", "select kafaa_ua_notify('x', 'p-k-ro', 'a', 'b', '/', 'info')"];
  for (const sql of helpers) { try { await one('training-mgr', sql); } catch { denied++; } }
  ok(denied === helpers.length, 'grants: internal helpers (coverage, rules, evidence and notification writers) are not executable by signed-in users');
  let anon = 0;
  const rpcs = ["select kafaa_save_programme('{}'::jsonb)", "select kafaa_endorse_programme('x', '{}'::jsonb)", "select kafaa_record_graduate_hire('{}'::jsonb)", "select kafaa_save_fellowship('{}'::jsonb)",
    "select kafaa_update_milestone('x', 'submit', '')", "select kafaa_withdraw_fellowship('x', 'y')", 'select kafaa_fellowship_stats()'];
  for (const sql of rpcs) { try { await one(null, sql); } catch { anon++; } }
  ok(anon === rpcs.length, 'grants: anonymous visitors execute none of the FS74 RPCs');
  const pol = await q(`select tablename, qual from pg_policies where tablename in ('kafaa_programme_alignments', 'kafaa_programme_graduates', 'kafaa_fellowships', 'kafaa_fellowship_milestones') and policyname = 'kafaa_read'`);
  ok(pol.length === 4 && pol.every((p) => /SELECT kafaa_has_grant/i.test(p.qual)), 'RLS: the four tables use the per-statement policy form');
  const text = readFileSync(MIG, 'utf8');
  ok(!BANNED.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(text)) && !/\balter\s+table\s+(?!kafaa_)/i.test(text) && !/\balter\s+policy\s+\w+\s+on\s+(?!kafaa_)/i.test(text),
    'additive: the FS74 migration removes nothing (the words never appear) and alters only kafaa_* tables and policies');
}
