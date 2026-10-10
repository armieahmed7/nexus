/** FS19 Future-skills course pack + FS20 Future-skills academies and cohorts (FS wave C · E2, M04): one test per acceptance criterion
 *  on the local path, plus the rules shared with SQL, RBAC, the seed, routes and i18n. The SQL path (TS = SQL parity for
 *  kafaa_fsc_copy_problems / kafaa_fsc_course_problems, kafaa_acad_evidence_level, kafaa_acad_stats_core; RLS; live RPC flows) is
 *  checked by scripts/validate/fs32-course-pack-academies.mjs (PGlite). */
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { SCHEMA } from '../../src/data/schema';
import { FEATURE_BENCHMARKS } from '../../src/domain/taxonomy';
import { isRecordedEvidence } from '../../src/domain/skills';
import en from '../../src/i18n/m04.en.json';
import ar from '../../src/i18n/m04.ar.json';
import seed from '../../src/seed/seed.json';
import { routes } from '../../src/modules/m04/routes';
import {
  CYBER_LINK_HOSTS, MAX_COURSE_HOURS, RESTRICTED_TERMS, UNHELD_BASELINE, copyProblems, courseTexts, courseUrls, learningRoutes, packCoverage, packForMe, packProblems,
  type Requirement, type SkillRef,
} from '../../src/modules/m04/fsPack';
import { MIN_GROUP, academyStats, capstoneEvidence, evidenceLevel, memberStage, pct } from '../../src/modules/m04/academy';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const S = seed as unknown as { tables: Record<string, Row[]>; personas: Row[] };
const T = S.tables;
const skills = new Map(T.skills.map((s) => [s.id, s]));
const course = new Map(T.courses.map((c) => [c.id, c]));
const pack = T.course_pack_items;
const get = (o: unknown, k: string) => k.split('.').reduce<any>((a, x) => (a == null ? undefined : a[x]), o); // eslint-disable-line @typescript-eslint/no-explicit-any

let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});

describe('FS19 · acceptance: future-skills course pack', () => {
  it('adds about 18 modular courses of 60 h or less plus cross-over versions (SMR fundamentals and plant literacy) for adjacent industries', () => {
    const core = pack.filter((m) => m.kind === 'core');
    const cross = pack.filter((m) => m.kind === 'crossover');
    expect(core.length).toBe(18);
    expect(cross.map((m) => m.crossover_of)).toEqual(['c-fs-smr', 'c-fs-smr']);
    expect(cross.every((m) => (m.for_industries as string[]).length >= 3 && course.get(m.course_id)!.audience === 'public')).toBe(true);
    for (const m of pack) expect(Number(course.get(m.course_id)!.duration_hours)).toBeLessThanOrEqual(MAX_COURSE_HOURS);
    const titles = core.map((m) => course.get(m.course_id)!.title_en).join(' | ');
    for (const w of ['Plant-data', 'Scripting', 'Digital-twin', 'Remote and autonomous', 'AI output verification', 'Governed prompt and agent', 'Cyber hygiene', 'SMR fundamentals', 'Passive safety', 'Factory fabrication QA', 'Hydrogen and process heat', 'GHG', 'Systems thinking', 'Resilience', 'Creative problem solving', 'Data quality', 'AR and VR', 'Digital procurement']) expect(titles).toContain(w);
  });
  it('acceptance 1: each of the 6 skills held by nobody gains at least one course', () => {
    const held = new Set(T.person_skills.filter((s) => s.active && s.level > 0).map((s) => s.skill_id));
    for (const id of UNHELD_BASELINE) expect(held.has(id), `${id} is still unheld before anyone completes a course`).toBe(false);
    const routes = learningRoutes(T.skills as unknown as SkillRef[], T.person_skills as never, T.course_skill_links as never);
    for (const id of UNHELD_BASELINE) expect(routes.find((r) => r.skill_id === id)!.courses.length, id).toBeGreaterThan(0);
    const cov = packCoverage(routes, skills as unknown as Map<string, SkillRef>);
    expect(cov.baselineCovered).toBe(6);
    expect(cov.futureCovered).toBeGreaterThanOrEqual(30);
  });
  it('acceptance 2: every course links at least one skill at a stated level (1-3), with sources, as-of dates, an envelope and the SIMULATED label', () => {
    for (const m of pack) {
      const c = course.get(m.course_id)!;
      expect(packProblems(c as never, m as never, T.course_skill_links as never, skills as unknown as Map<string, SkillRef>), c.id).toEqual([]);
      expect((c.sources as Row[]).every((s) => /^https:\/\//.test(s.url) && s.as_of === '2026-10-10')).toBe(true);
      expect(c.concept_content).toBe(true);
    }
    // objectives carry { skill_id, level } (what FS17 pathways resolve content from) and a link is also the course's F01 evidence key
    for (const m of pack) expect((course.get(m.course_id)!.objectives as Row[]).map((o) => `${o.skill_id}:${o.level}`)).toEqual(T.course_skill_links.filter((l) => l.course_id === m.course_id).map((l) => `${l.skill_id}:${l.level}`));
    for (const l of T.course_skill_links) expect(skills.get(l.skill_id)!.evidence_keys, l.id).toContain(l.course_id);
  });
  it('acceptance 3: the cyber hygiene course contains no security-restricted content (copy and link check)', () => {
    const m = pack.find((x) => x.theme === 'cyber')!;
    const c = course.get(m.course_id)!;
    const texts = courseTexts(c as never, T.course_modules.filter((x) => x.course_id === c.id) as never, T.course_skill_links.filter((l) => l.course_id === c.id) as never);
    expect(copyProblems('cyber', texts, courseUrls(c as never))).toEqual([]);
    expect(m.copy_check).toBe('passed');
    expect((c.sources as Row[]).every((s) => CYBER_LINK_HOSTS.includes(new URL(s.url).hostname))).toBe(true);
    expect(T.course_skill_links.filter((l) => l.course_id === c.id).every((l) => skills.get(l.skill_id)!.fs_area === 'cyber_hygiene')).toBe(true);
    // the rule catches what it should
    expect(copyProblems('cyber', ['Learn the security plan'], ['http://x.org', 'https://example.com/a', 'https://www.iaea.org/advisory'])).toEqual([
      { code: 'restricted_term', detail: 'security plan' }, { code: 'link_https', detail: 'http://x.org' }, { code: 'link_host', detail: 'https://example.com/a' }, { code: 'link_path', detail: 'https://www.iaea.org/advisory' },
    ]);
    expect(copyProblems('data_ai', ['ok'], ['https://example.com/a'])).toEqual([]);
    expect(RESTRICTED_TERMS.length).toBeGreaterThanOrEqual(20);
  });
  it('every pack course passes the copy check; advanced-reactor and transition courses say no deployment decision is implied', () => {
    for (const m of pack) {
      const c = course.get(m.course_id)!;
      expect(copyProblems(m.theme, courseTexts(c as never, T.course_modules.filter((x) => x.course_id === c.id) as never, T.course_skill_links.filter((l) => l.course_id === c.id) as never), courseUrls(c as never)), c.id).toEqual([]);
      if (m.no_decision) expect(c.summary_en).toMatch(/no deployment decision/i);
    }
    expect(T.course_skill_links.every((l) => skills.get(l.skill_id)!.area !== 'security')).toBe(true);
  });
  it('"for me" ranks pack courses against today\'s and 2030 gaps with reasons (WhyThis), never repeating a completed course first', () => {
    const reqs: Requirement[] = [{ kind: 'skill', ref_id: 'sk-fs-ai-verify', level: 3, horizon: '2030' }, { kind: 'skill', ref_id: 'sk-da-01-scripting', level: 2, horizon: 'now' }];
    const routesMap = new Map(learningRoutes(T.skills as never, [], T.course_skill_links as never).map((r) => [r.skill_id, r]));
    const picks = packForMe(T.courses as never, pack as never, T.course_skill_links as never, reqs, () => 0, skills as never, routesMap, new Set(), new Set(['c-fs-scripting']));
    expect(picks[0].course_id).toBe('c-fs-aiverify');
    expect(picks[0].reasons.map((r) => r.code)).toEqual(expect.arrayContaining(['gap2030', 'envelope']));
    expect(picks.find((p) => p.course_id === 'c-fs-scripting')!.status).toBe('enrolled');
    expect(picks.every((p) => p.reasons.every((r) => get(en, r.key.replace(/^m04\./, '')) && get(ar, r.key.replace(/^m04\./, ''))))).toBe(true);
  });
});

describe('FS19 · RPCs (local path = SQL kafaa_save_course_skills / kafaa_check_course_pack)', () => {
  it('saveCourseSkills: training W only; security skills, bad levels and restricted wording refused; links become evidence keys; removals kept inactive', async () => {
    await as('buyer');
    expect((await b.rpc.saveCourseSkills('c-fs-procure', [{ skill_id: 'sk-fs-dp-procurement', level: 2, objective_en: 'Run a sourcing event', objective_ar: 'إدارة عملية توريد' }])).code).toBe('forbidden');
    await as('training-mgr');
    expect((await b.rpc.saveCourseSkills('c-fs-procure', [{ skill_id: 'sk-sa-01', level: 1, objective_en: 'Security path', objective_ar: 'مسار أمني' }])).code).toBe('security_skill');
    expect((await b.rpc.saveCourseSkills('c-fs-procure', [{ skill_id: 'sk-fs-dp-procurement', level: 4, objective_en: 'Run a sourcing event', objective_ar: 'إدارة عملية توريد' }])).message).toBe('Levels are 1, 2 or 3');
    const r = await b.rpc.saveCourseSkills('c-fs-cyber', [{ skill_id: 'sk-fs-cy-zones', level: 1, objective_en: 'Draw the network diagram', objective_ar: 'رسم مخطط الشبكة' }]);
    expect(r.code).toBe('restricted');
    const ok = await b.rpc.saveCourseSkills('c-fs-procure', [
      { skill_id: 'sk-fs-dp-procurement', level: 2, objective_en: 'Run a sourcing event end to end', objective_ar: 'إدارة عملية توريد من البداية إلى النهاية' },
      { skill_id: 'sk-fs-gr-esg', level: 1, objective_en: 'Read supplier ESG data', objective_ar: 'قراءة بيانات الموردين البيئية' },
    ]);
    expect(ok.ok && ok.data!.copy_check === 'passed').toBe(true);
    expect((b.rawGet('skills', 'sk-fs-gr-esg') as Row).evidence_keys).toContain('c-fs-procure');
    expect(((b.rawGet('courses', 'c-fs-procure') as Row).objectives as Row[]).map((o) => [o.skill_id, o.level])).toEqual([['sk-fs-dp-procurement', 2], ['sk-fs-gr-esg', 1]]);
    await b.rpc.saveCourseSkills('c-fs-procure', [{ skill_id: 'sk-fs-dp-procurement', level: 2, objective_en: 'Run a sourcing event end to end', objective_ar: 'إدارة عملية توريد من البداية إلى النهاية' }]);
    expect((b.rawGet('skills', 'sk-fs-gr-esg') as Row).evidence_keys).not.toContain('c-fs-procure');
    expect((b.rawGet('course_skill_links' as never, 'csl-procure-fs-gr-esg') as unknown as Row).active).toBe(false);
  });
  it('checkCoursePack: every pack course passes and the result is stored; staff cannot run it', async () => {
    await as('k-ro');
    expect((await b.rpc.checkCoursePack()).code).toBe('forbidden');
    await as('training-mgr');
    const r = await b.rpc.checkCoursePack();
    expect(r.ok && r.data!.checked === pack.length && r.data!.passed === pack.length).toBe(true);
  });
});

describe('FS20 · acceptance: academies and cohorts', () => {
  it('acceptance 1: four academies (AI, Digital Twin, SMR, Energy Transition), each listing modules, a project and a mentor role', () => {
    expect(T.academies.map((a) => a.id)).toEqual(['ac-ai', 'ac-twin', 'ac-smr', 'ac-energy']);
    for (const a of T.academies) {
      expect(a.module_course_ids.length).toBeGreaterThanOrEqual(3);
      expect(a.module_course_ids.every((id: string) => course.has(id))).toBe(true);
      for (const k of ['project_en', 'project_ar', 'mentor_role_en', 'mentor_role_ar', 'reviewer_role_en', 'deliverable_en']) expect(String(a[k]).length, `${a.id} ${k}`).toBeGreaterThan(10);
      expect((a.capstone_skills as Row[]).every((s) => skills.get(s.skill_id)?.fs_area)).toBe(true);
      expect(a.sources.every((s: Row) => s.url.startsWith('https://') && s.as_of)).toBe(true);
    }
    expect(T.academies.filter((a) => a.theme === 'advanced_reactor').every((a) => a.no_decision)).toBe(true);
  });
  it('acceptance 2: a signed-off capstone writes evidence and recomputes skills (reviewer only, never the member; merit one level up)', async () => {
    const m = T.academy_members.find((x) => x.person_id === 'p-k-ro' && x.status === 'active')!;
    await as('k-ro');
    const sub = await b.rpc.saveCapstone({ member_id: m.id, title: 'Alarm response cross-reference', summary: 'Cross-references an alarm with the alarm response procedure index; verified for two weeks.', submit: true });
    expect(sub.ok && sub.data!.status === 'submitted').toBe(true);
    const capId = sub.data!.id;
    expect((await b.rpc.signoffCapstone({ capstone_id: capId, result: 'pass' })).code).toBe('self');
    await as('training-mgr');
    expect((await b.rpc.signoffCapstone({ capstone_id: capId, result: 'pass' })).code).toBe('forbidden');
    await as('ai-governance');
    const so = await b.rpc.signoffCapstone({ capstone_id: capId, result: 'merit', feedback: 'Strong verification record.' });
    expect(so.ok).toBe(true);
    expect(so.ledger_seq).not.toBeNull();
    const want = (T.academies.find((a) => a.id === 'ac-ai')!.capstone_skills as Row[]).map((s) => ({ skill_id: s.skill_id, level: evidenceLevel('merit', s.level) })).sort((x, y) => (x.skill_id < y.skill_id ? -1 : 1));
    expect(so.data!.evidence).toEqual(want);
    const ev = (b.raw('skill_evidence') as unknown as Row[]).filter((e) => e.ref_table === 'cohort_capstones' && e.ref_id === capId);
    expect(ev.length).toBe(want.length);
    expect(ev.every((e) => e.kind === 'ojt' && isRecordedEvidence(e as never))).toBe(true);
    const ps = (b.raw('person_skills') as unknown as Row[]).filter((s) => s.person_id === 'p-k-ro' && s.active);
    for (const w of want) expect(ps.find((s) => s.skill_id === w.skill_id)?.level ?? 0, w.skill_id).toBeGreaterThanOrEqual(1);
    expect((b.rawGet('academy_members' as never, m.id) as unknown as Row).status).toBe('completed');
    // recompute keeps the recorded evidence
    await as('training-mgr');
    await b.rpc.recomputeSkills('p-k-ro');
    expect((b.raw('skill_evidence') as unknown as Row[]).filter((e) => e.ref_id === capId && e.active).length).toBe(want.length);
  });
  it('"not yet" needs feedback, returns the capstone and records nothing', async () => {
    const k = T.cohort_capstones.find((x) => x.person_id === 'p-buyer' && x.status === 'submitted')!;
    await as('ai-governance');
    expect((await b.rpc.signoffCapstone({ capstone_id: k.id, result: 'not_yet' })).code).toBe('invalid');
    const r = await b.rpc.signoffCapstone({ capstone_id: k.id, result: 'not_yet', feedback: 'Add a week of independent checks.' });
    expect(r.ok && r.data!.status === 'returned' && r.data!.evidence.length === 0).toBe(true);
    expect((b.raw('skill_evidence') as unknown as Row[]).some((e) => e.ref_id === k.id)).toBe(false);
  });
  it('acceptance 3: cohort statistics under 10 are suppressed (seed cohorts and a small synthetic cohort)', async () => {
    const st = academyStats(T.academies as never, T.academy_cohorts as never, T.academy_members as never, T.cohort_capstones as never, T.enrolments as never);
    const cells = st.academies.flatMap((a) => a.cohort_stats);
    expect(cells.find((c) => c.cohort_id === 'ac-energy-2026a')!.suppressed).toBe(true);
    expect(cells.find((c) => c.cohort_id === 'ac-ai-2027a')!.participants).toBeNull();
    expect(cells.find((c) => c.cohort_id === 'ac-ai-2026a')!.participants).toBe(12);
    for (const c of cells) for (const v of [c.participants, c.alumni, c.reviewed, c.nominations]) if (v != null) expect(v).toBeGreaterThanOrEqual(MIN_GROUP);
    const small = academyStats([{ id: 'a', module_course_ids: ['c1'] }], [{ id: 'c', academy_id: 'a', status: 'running', capacity: 16, starts_on: '2026-01-01' }],
      Array.from({ length: 9 }, (_, i) => ({ id: `m${i}`, cohort_id: 'c', academy_id: 'a', person_id: `p${i}`, status: 'completed' })), [], []);
    expect(small.academies[0].suppressed && small.academies[0].cohort_stats[0].suppressed && small.academies[0].participants === null).toBe(true);
    await as(null);
    const anon = await b.rpc.academyStats();
    expect(anon.academies.length).toBe(4);
  });
  it('nomination and decision: myself or my team; programme owner decides with a mentor and a reviewer; acceptance enrols the module courses', async () => {
    await as('k-ro');
    const self = await b.rpc.nominateAcademy({ cohort_id: 'ac-energy-2026a' });
    expect(self.ok).toBe(true);
    expect((await b.rpc.nominateAcademy({ cohort_id: 'ac-energy-2026a' })).code).toBe('conflict');
    expect((await b.rpc.nominateAcademy({ cohort_id: 'ac-ai-2026b' })).code).toBe('closed');
    await as('buyer');
    expect((await b.rpc.nominateAcademy({ cohort_id: 'ac-energy-2026a', person_id: 'p-k-ro' })).code).toBe('forbidden');
    await as('alnoor-gm');
    expect((await b.rpc.nominateAcademy({ cohort_id: 'ac-energy-2026a' })).code).toBe('forbidden');
    await as('sro');
    expect((await b.rpc.decideAcademyNomination({ member_id: self.data!.id, decision: 'accept', mentor_person_id: 'w-chem-03', reviewer_person_id: 'p-head-sustainability' })).code).toBe('forbidden');
    await as('training-mgr');
    expect((await b.rpc.decideAcademyNomination({ member_id: self.data!.id, decision: 'accept', mentor_person_id: 'w-chem-03', reviewer_person_id: 'w-chem-03' })).code).toBe('invalid');
    const acc = await b.rpc.decideAcademyNomination({ member_id: self.data!.id, decision: 'accept', mentor_person_id: 'w-chem-03', reviewer_person_id: 'p-head-sustainability' });
    expect(acc.ok && acc.data!.enrolled === 3).toBe(true);
    const enr = (b.raw('enrolments') as unknown as Row[]).filter((e) => e.person_id === 'p-k-ro' && e.source === 'coordinator' && ['c-fs-h2heat', 'c-fs-ghg', 'c-fs-systems'].includes(e.course_id));
    expect(enr.length).toBe(3);
    const nominees = await b.rpc.academyNominees();
    expect(nominees.length).toBeGreaterThan(50);
  });
  it('RLS: members and capstones for the person, training staff and the named mentor and reviewer only', async () => {
    await as('buyer');
    expect((await b.list('academy_members')).every((m) => m.person_id === 'p-buyer' || m.mentor_person_id === 'p-buyer' || m.reviewer_person_id === 'p-buyer')).toBe(true);
    await as('ai-governance');
    const caps = await b.list('cohort_capstones');
    expect(caps.length).toBe(T.cohort_capstones.filter((k) => k.person_id === 'p-ai-governance' || k.reviewer_person_id === 'p-ai-governance' || k.mentor_person_id === 'p-ai-governance').length);
    await as(null);
    expect((await b.list('academy_members')).length).toBe(0);
    expect((await b.list('academies')).length).toBe(4);
    expect((await b.list('course_pack_items')).length).toBe(pack.length);
  });
});

describe('FS19/FS20 · rules, seed, routes and i18n', () => {
  it('evidence levels, percentages and stages (shared with SQL)', () => {
    expect([evidenceLevel('merit', 2), evidenceLevel('merit', 3), evidenceLevel('pass', 2), evidenceLevel('not_yet', 2), evidenceLevel('pass', 0)]).toEqual([3, 3, 2, 0, 1]);
    expect([pct(1, 3), pct(2, 3), pct(1, 2), pct(0, 0)]).toEqual([33, 67, 50, null]);
    expect(capstoneEvidence('cc-x', 'p', [{ skill_id: 'b', level: 1 }, { skill_id: 'a', level: 2 }], 'pass', '2026-10-10', 'r', 'X').map((e) => [e.id, e.level])).toEqual([['se:ojt:cc-x:a', 2], ['se:ojt:cc-x:b', 1]]);
    expect(memberStage({ status: 'active' }, { status: 'draft' }, 1, 4)).toBe('modules');
    expect(memberStage({ status: 'active' }, { status: 'submitted' }, 1, 4)).toBe('capstone_submitted');
    expect(memberStage({ status: 'completed' }, { status: 'signed_off' }, 4, 4)).toBe('alumni');
  });
  it('seeded capstone evidence names FS02 skills only, so the original 71-skill states are unchanged', () => {
    const ev = T.skill_evidence.filter((e) => e.ref_table === 'cohort_capstones');
    expect(ev.length).toBe(60);
    expect(ev.every((e) => skills.get(e.skill_id)!.fs_area && e.kind === 'ojt')).toBe(true);
    expect(T.cohort_capstones.filter((k) => k.status === 'signed_off').every((k) => k.reviewer_person_id !== k.person_id && k.mentor_person_id !== k.reviewer_person_id)).toBe(true);
  });
  it('tables are M04, people tables read by training/own rules, writes through RPCs; six routes with EN/AR titles and benchmark ids', () => {
    for (const t of ['course_pack_items', 'course_skill_links', 'academies', 'academy_cohorts', 'academy_members', 'cohort_capstones']) {
      expect(SCHEMA[t].module).toBe('M04');
      expect(SCHEMA[t].write.mode === 'rpc' || SCHEMA[t].write.mode === 'none').toBe(true);
    }
    expect(SCHEMA.academy_members.read.map((r) => r.res)).toEqual(['training', 'own_profile', 'own_profile']);
    const ids = ['learn-future-skills', 'learn-academies', 'learn-academy', 'my-academies', 'training-future-skills', 'training-academies'];
    for (const id of ids) {
      expect(routes.find((r) => r.id === id), id).toBeTruthy();
      expect(get(en, `routes.${id}.title`) && get(ar, `routes.${id}.title`)).toBeTruthy();
    }
    expect(FEATURE_BENCHMARKS.FS19).toEqual(['SMR-WF', 'UAE-PEERS', 'ENTITLE']);
    expect(FEATURE_BENCHMARKS.FS20).toEqual(['NUC-NET', 'UAE-PEERS']);
  });
});
