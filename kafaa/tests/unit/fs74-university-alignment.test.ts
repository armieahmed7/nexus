// @vitest-environment jsdom
/** FS66 University programme alignment + FS67 Fellowships and sponsored placements (FS wave G · E4, M10): one test per acceptance
 *  criterion on the local path, plus the rules shared with SQL, RBAC, the seed and i18n. The SQL path (TS = SQL parity for
 *  kafaa_ua_coverage / auto / problem / decision_problem / hire_problem and kafaa_fw_plan / problem / ms_problem / stats; RLS; live RPC
 *  flows in a rolled-back transaction; grants; additivity) is checked by scripts/validate/fs74-university-alignment.mjs (PGlite). */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { SCHEMA } from '../../src/data/schema';
import en from '../../src/i18n/m10.en.json';
import ar from '../../src/i18n/m10.ar.json';
import seed from '../../src/seed/seed.json';
import { routes } from '../../src/modules/m10/routes';
import { FEATURE_BENCHMARKS } from '../../src/domain/taxonomy';
import { todayIso } from '../../src/domain/rules';
import { requirementsOf, restrictedSkills, scoreReqs, LEARN_CEILING } from '../../src/modules/m25/coverage';
import {
  COVERAGE_MIN, UA_LEVEL_MAX, UA_REF_TABLE, addYears, autoCriteria, cleanSkills, covered, decisionProblem, defaultCoversFrom, displayStatus,
  gradStatus, graduateEvidence, hireProblem, programmeCoverage, programmeId, programmeProblem, taughtOf, type ProgrammeInput,
} from '../../src/modules/m10/alignment';
import {
  FW_MIN, MS_TEMPLATE, fellowshipId, fellowshipProblem, fellowshipStats, isComplete, milestonePlan, milestoneProblem, type FwWorld,
} from '../../src/modules/m10/fellowship';
import { uaWorld } from '../../src/modules/m10/backend/local';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const S = seed as unknown as { tables: Record<string, Row[]>; personas: Row[] };
const T = S.tables;
const AR = /[؀-ۿ]/;
const flat = (o: Row, p = ''): [string, string][] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [[`${p}${k}`, String(v)]]));
const today = todayIso();

let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
const raw = (t: string) => b.raw(t as never) as unknown as Row[];
const progEvidence = () => raw('skill_evidence').filter((e) => e.ref_table === UA_REF_TABLE);
beforeEach(async () => {
  try { localStorage.clear(); } catch { /* ignore */ }
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});

const base: ProgrammeInput = {
  university_org_id: 'ku', code: 'BSC-TEST', title_en: 'Test programme', title_ar: 'برنامج اختبار', degree: 'bachelor', nqf_level: 7, field_en: 'Field', field_ar: 'مجال',
  summary_en: '', summary_ar: '', target_role_ids: ['local-operator'],
  skills: [{ skill_id: 'sk-pf-01', level: 2, modules: ['Nuclear physics'] }, { skill_id: 'sk-co-01', level: 1, modules: [' Procedures '] }, { skill_id: 'sk-fs-ai-verify', level: 1, modules: ['AI'] }],
  placement: true, accreditation_ref: 'Ref',
} as ProgrammeInput;
const dBase = { decision: 'endorse', note: 'All criteria checked by the reviewer', criteria: { assessment: true, placement: true, accreditation: true }, covers_from: null };
const fBase = {
  kind: 'sponsored_study', title_en: 'Sponsored study', title_ar: 'دراسة مموّلة', fellow_person_id: 'ap-160', university_org_id: 'ku', host_kind: 'research_challenge', host_ref: 'rc-1',
  supervisor_person_id: 'p-training-mgr', starts_on: '2026-09-01', ends_on: '2028-09-01', placement_en: 'Placement in year two', placement_ar: 'تدريب في السنة الثانية',
};

describe('FS66 acceptance', () => {
  it('FS66 acceptance: evidence is written only for endorsed programmes', async () => {
    expect(progEvidence().length).toBe(0); // the seed writes none (F01 digest of the 71 established skills is untouched)
    await as('training-mgr');
    expect((await b.rpc.recordGraduateHire({ person_id: 'ap-150', programme_id: 'ua-iat-cert-dpo', graduated_on: addYears(today, -1), hired_on: today })).code).toBe('forbidden');
    await as('chco');
    const ret = await b.rpc.recordGraduateHire({ person_id: 'ap-150', programme_id: 'ua-adpoly-bsc-est', graduated_on: addYears(today, -1), hired_on: today });
    expect(ret.ok, ret.message).toBe(true);
    expect(ret.data!.status).toBe('awaiting_endorsement');
    expect(ret.data!.evidence).toBe(0);
    const lap = await b.rpc.recordGraduateHire({ person_id: 'ap-151', programme_id: 'ua-kaist-msc-ai', graduated_on: '2026-06-20', hired_on: today });
    expect(lap.ok, lap.message).toBe(true);
    expect(lap.data!.status).toBe('not_covered');
    expect(lap.data!.evidence).toBe(0);
    expect(progEvidence().length).toBe(0);
    const iat = T.programme_alignments.find((p) => p.id === 'ua-iat-cert-dpo')!;
    const end = await b.rpc.recordGraduateHire({ person_id: 'ap-152', programme_id: iat.id, graduated_on: addYears(today, -1), hired_on: today });
    expect(end.ok, end.message).toBe(true);
    expect(end.data!.status).toBe('evidence_written');
    expect(end.data!.evidence).toBe(iat.skills.length);
    expect((await b.rpc.recordGraduateHire({ person_id: 'ap-152', programme_id: iat.id, graduated_on: addYears(today, -1), hired_on: today })).code).toBe('duplicate');
    const ev = progEvidence();
    expect(ev.length).toBe(iat.skills.length);
    expect(ev.every((e) => e.kind === 'credential' && e.basis === 'validated' && e.ref_id === iat.id && e.person_id === 'ap-152' && e.level <= UA_LEVEL_MAX)).toBe(true);
    // endorsement writes the waiting graduates' evidence (maker-checker: the submitter cannot decide)
    await as('ai-governance');
    expect((await b.rpc.endorseProgramme('ua-kings-msc-npp', dBase)).code).toBe('maker_checker');
    await as('chco');
    expect((await b.rpc.endorseProgramme('ua-ku-bsc-nuc', dBase)).code).toBe('forbidden');
    await as('k-admin');
    expect((await b.rpc.endorseProgramme('ua-ku-bsc-nuc', { ...dBase, criteria: { assessment: true } })).code).toBe('invalid');
    expect(progEvidence().filter((e) => e.ref_id === 'ua-ku-bsc-nuc').length).toBe(0);
    const e = await b.rpc.endorseProgramme('ua-ku-bsc-nuc', dBase);
    expect(e.ok, e.message).toBe(true);
    const after = raw('programme_alignments').find((p) => p.id === 'ua-ku-bsc-nuc')!;
    expect(after.status).toBe('endorsed');
    const grads = raw('programme_graduates').filter((g) => g.programme_id === after.id);
    expect(grads.every((g) => g.status === gradStatus(after, String(g.graduated_on).slice(0, 10)))).toBe(true);
    expect(e.data!.graduates).toBe(grads.filter((g) => g.status === 'evidence_written').length);
    expect(e.data!.graduates).toBeGreaterThan(0);
    const expected = grads.filter((g) => g.status === 'evidence_written').flatMap((g) => graduateEvidence({ id: g.id, person_id: g.person_id, graduated_on: String(g.graduated_on).slice(0, 10) }, after, uaWorld(b)));
    expect(progEvidence().filter((x) => x.ref_id === after.id).map((x) => x.id).sort()).toEqual(expected.map((x) => x.id).sort());
    // every programme-backed evidence row points at an endorsed programme
    const status = new Map(raw('programme_alignments').map((p) => [p.id, p.status]));
    expect(progEvidence().every((x) => status.get(x.ref_id) === 'endorsed')).toBe(true);
    // the person's skills were recomputed from the new evidence
    const kg = raw('person_skills').filter((s) => s.person_id === 'p-k-graduate' && s.active !== false && after.skills.some((k: Row) => k.skill_id === s.skill_id));
    expect(kg.length).toBeGreaterThan(0);
  });

  it('FS66 acceptance: coverage reuses the FS57 rule', async () => {
    const src = readFileSync('src/modules/m10/alignment.ts', 'utf8');
    expect(src).toMatch(/import \{[^}]*requirementsOf[^}]*scoreReqs[^}]*\} from '\.\.\/m25\/coverage(\.ts)?'/);
    expect(UA_LEVEL_MAX).toBe(LEARN_CEILING);
    const w = uaWorld(b);
    const restricted = restrictedSkills(w.skills, w.competencies);
    let checked = 0;
    for (const p of T.programme_alignments) {
      const cov = programmeCoverage(p, w);
      if (p.status === 'endorsed') expect(p.coverage_snapshot, p.id).toEqual(cov);
      const taught = taughtOf(p.skills, restricted);
      for (const r of cov.roles) {
        const v = w.role_profile_versions.find((x) => x.id === r.version_id)!;
        const direct = scoreReqs(requirementsOf(v, w.skills, restricted), (s) => taught.get(s) ?? 0);
        expect(r.score, `${p.id} ${r.role_id} ${r.horizon}`).toBe(direct.score);
        expect(r.covered).toBe(direct.covered);
        checked++;
      }
      expect(autoCriteria(p, w).coverage).toBe((cov.best ?? 0) >= COVERAGE_MIN);
    }
    expect(checked).toBeGreaterThan(10);
    // the save RPC returns the same coverage
    await as('k-university');
    const r = await b.rpc.saveProgramme({ ...base, submit: false } as never);
    expect(r.ok, r.message).toBe(true);
    expect(r.data!.coverage).toEqual(programmeCoverage(raw('programme_alignments').find((p) => p.id === r.data!.id)!, uaWorld(b)));
    // a level above the learnable ceiling is refused
    expect(programmeProblem({ ...base, skills: [{ skill_id: 'sk-pf-01', level: 3, modules: ['x1'] }, ...(base.skills as Row[]).slice(1)] } as never, w)).toBe('skills');
  });

  it('FS66 acceptance: a partner university sees only its own programmes', async () => {
    expect(SCHEMA.programme_alignments.read).toEqual([{ res: 'partner_org', org: 'university_org_id' }, { res: 'recognition' }]);
    await as('k-university');
    const mine = await b.list('programme_alignments' as never) as unknown as Row[];
    expect(mine.length).toBe(T.programme_alignments.filter((p) => p.university_org_id === 'ku').length);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((p) => p.university_org_id === 'ku')).toBe(true);
    expect((await b.list('programme_graduates' as never)).length).toBe(0);
    expect((await b.rpc.saveProgramme({ ...base, university_org_id: 'kings' } as never)).code).toBe('forbidden');
    expect((await b.rpc.saveProgramme({ ...base, id: 'ua-kings-msc-npp', university_org_id: 'kings' } as never)).code).toBe('forbidden');
    await as('alnoor-gm');
    expect((await b.list('programme_alignments' as never)).length).toBe(0);
    await as(null);
    expect((await b.list('programme_alignments' as never)).length).toBe(0);
    await as('training-mgr');
    expect((await b.list('programme_alignments' as never)).length).toBe(T.programme_alignments.length);
    await as('k-admin');
    expect((await b.list('programme_alignments' as never)).length).toBe(T.programme_alignments.length);
  });
});

describe('FS66 rules, RPCs and seed', () => {
  it('programmeProblem checks every field in order and cleans skills; ids are stable', () => {
    const w = uaWorld(b);
    expect(programmeProblem(base, w)).toBeNull();
    expect(programmeProblem({ ...base, university_org_id: 'org-alnoor' } as never, w)).toBe('org');
    expect(programmeProblem({ ...base, code: 'a' } as never, w)).toBe('code');
    expect(programmeProblem({ ...base, title_ar: '' } as never, w)).toBe('title');
    expect(programmeProblem({ ...base, degree: 'phd' } as never, w)).toBe('degree');
    expect(programmeProblem({ ...base, nqf_level: 11 } as never, w)).toBe('nqf');
    expect(programmeProblem({ ...base, target_role_ids: [] } as never, w)).toBe('roles');
    expect(programmeProblem({ ...base, skills: (base.skills as Row[]).slice(0, 2) } as never, w)).toBe('skills');
    expect(programmeProblem({ ...base, accreditation_ref: 'x'.repeat(121) } as never, w)).toBe('accreditation');
    expect(cleanSkills(base.skills).find((x) => x.skill_id === 'sk-co-01')!.modules).toEqual(['Procedures']);
    expect(cleanSkills(base.skills).map((x) => x.skill_id)).toEqual(['sk-co-01', 'sk-fs-ai-verify', 'sk-pf-01']);
    expect(programmeId('ku', 'BSc Nuc/2')).toBe('ua-ku-bsc-nuc-2');
  });

  it('saveProgramme: draft, submit locks, the endorsed programme starts a new version; returned programmes reopen', async () => {
    await as('sro');
    expect((await b.rpc.saveProgramme({ ...base } as never)).code).toBe('forbidden');
    await as('k-university');
    const s = await b.rpc.saveProgramme({ ...base, submit: false } as never);
    expect(s.ok, s.message).toBe(true);
    expect(s.data).toMatchObject({ id: 'ua-ku-bsc-test', status: 'draft', version: 1 });
    expect((await b.rpc.saveProgramme({ ...base, submit: false } as never)).code).toBe('duplicate');
    const sub = await b.rpc.saveProgramme({ ...base, id: 'ua-ku-bsc-test', submit: true } as never);
    expect(sub.ok, sub.message).toBe(true);
    expect(sub.data!.status).toBe('submitted');
    expect((await b.rpc.saveProgramme({ ...base, id: 'ua-ku-bsc-test' } as never)).code).toBe('invalid');
    const endorsed = T.programme_alignments.find((p) => p.id === 'ua-ku-msc-data')!;
    const rev = await b.rpc.saveProgramme({ ...endorsed, id: endorsed.id, submit: false } as never);
    expect(rev.ok, rev.message).toBe(true);
    expect(rev.data!.status).toBe('draft');
    expect(rev.data!.version).toBe(Number(endorsed.version) + 1);
  });

  it('decisionProblem: status, maker-checker, decision, note, reviewer criteria, computed criteria, window', () => {
    const w = uaWorld(b);
    const row = T.programme_alignments.find((p) => p.id === 'ua-ku-bsc-nuc')!;
    const auto = autoCriteria(row, w);
    expect(decisionProblem(dBase, row, 'p-k-admin', auto, today)).toBeNull();
    expect(decisionProblem(dBase, undefined, 'p-k-admin', auto, today)).toBe('not_found');
    expect(decisionProblem(dBase, { ...row, status: 'draft' }, 'p-k-admin', auto, today)).toBe('status');
    expect(decisionProblem(dBase, row, row.submitted_by, auto, today)).toBe('maker_checker');
    expect(decisionProblem({ ...dBase, decision: 'approve' }, row, 'p-k-admin', auto, today)).toBe('decision');
    expect(decisionProblem({ ...dBase, note: 'short' }, row, 'p-k-admin', auto, today)).toBe('note');
    expect(decisionProblem({ ...dBase, criteria: { assessment: true, placement: true } }, row, 'p-k-admin', auto, today)).toBe('criteria');
    expect(decisionProblem({ ...dBase, covers_from: addYears(today, 1) }, row, 'p-k-admin', auto, today)).not.toBeNull();
    expect(decisionProblem({ decision: 'return', note: 'Please map assessment to each skill' }, row, 'p-k-admin', auto, today)).toBeNull();
    expect(defaultCoversFrom('2026-10-12')).toBe('2025-01-01');
    expect(addYears('2024-02-29', 1)).toBe('2025-02-28');
  });

  it('hireProblem, window, display status (lapsed) and evidence shape', () => {
    const iat = T.programme_alignments.find((p) => p.id === 'ua-iat-cert-dpo')!;
    const person = T.people.find((p) => p.id === 'ap-150');
    const h = { person_id: 'ap-150', programme_id: iat.id, graduated_on: addYears(today, -1), hired_on: today };
    expect(hireProblem(h, person, iat, false, today)).toBeNull();
    expect(hireProblem(h, undefined, iat, false, today)).toBe('person');
    expect(hireProblem(h, person, undefined, false, today)).toBe('programme');
    expect(hireProblem(h, person, iat, true, today)).toBe('duplicate');
    expect(covered(iat, addYears(today, -1))).toBe(true);
    expect(gradStatus({ ...iat, status: 'returned' }, addYears(today, -1))).toBe('awaiting_endorsement');
    const kaist = T.programme_alignments.find((p) => p.id === 'ua-kaist-msc-ai')!;
    expect(displayStatus(kaist, today)).toBe('lapsed');
    expect(displayStatus(iat, today)).toBe('endorsed');
    const ev = graduateEvidence({ id: 'pg-x', person_id: 'ap-150', graduated_on: '2026-06-30' }, iat, uaWorld(b));
    expect(ev.length).toBe(iat.skills.length);
    expect(ev.every((e) => e.id.startsWith('se:programme:pg-x:') && e.observed_on === '2026-06-30' && e.level <= 2)).toBe(true);
  });

  it('seed: every state, synthetic sample rows, endorsed programmes decided by someone other than the submitter, no evidence', () => {
    const st = new Set(T.programme_alignments.map((p) => p.status));
    for (const s of ['draft', 'submitted', 'endorsed', 'returned']) expect(st.has(s), s).toBe(true);
    expect(T.programme_alignments.some((p) => displayStatus(p, today) === 'lapsed')).toBe(true);
    for (const p of T.programme_alignments) {
      expect(p.sample).toBe(true);
      expect(T.organisations.find((o) => o.id === p.university_org_id)?.kind, p.id).toBe('university');
      if (p.status === 'endorsed') {
        expect(p.decided_by).not.toBe(p.submitted_by);
        expect(String(p.valid_to).slice(0, 10)).toBe(addYears(String(p.decided_at).slice(0, 10), 3));
      }
    }
    expect(new Set(T.programme_graduates.map((g) => g.status))).toEqual(new Set(['awaiting_endorsement', 'not_covered']));
    expect(T.programme_graduates.every((g) => (g.evidence_ids ?? []).length === 0)).toBe(true);
  });
});

describe('FS67 acceptance', () => {
  it('FS67 acceptance: completion rate is computed from milestones and suppressed under 10', async () => {
    await as('k-hr-analyst');
    const r = await b.rpc.fellowshipStats();
    expect(r.ok, r.message).toBe(true);
    const fws = raw('fellowships'), mss = raw('fellowship_milestones');
    expect(r.data).toEqual(fellowshipStats(fws, mss, today));
    // independent recomputation of the headline from the milestones
    const complete = fws.filter((f) => f.status !== 'withdrawn' && isComplete(mss.filter((m) => m.fellowship_id === f.id)));
    const due = fws.filter((f) => complete.includes(f) || f.status === 'withdrawn' || String(f.ends_on).slice(0, 10) < today);
    expect(due.length).toBeGreaterThanOrEqual(FW_MIN);
    expect(r.data!.overall.rate).toBe(Math.round((100 * complete.length) / due.length));
    expect(fws.filter((f) => f.status === 'completed').map((f) => f.id).sort()).toEqual(complete.map((f) => f.id).sort());
    // suppression
    const cells = [r.data!.overall, ...r.data!.by_kind, ...r.data!.by_host, ...r.data!.by_university];
    expect(cells.some((c) => c.suppressed)).toBe(true);
    for (const c of cells) {
      if (c.suppressed) expect([c.rate, c.due, c.completed, c.awarded], c.key).toEqual([null, null, null, null]);
      else expect(c.due!).toBeGreaterThanOrEqual(FW_MIN);
    }
    const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `f${String(i).padStart(2, '0')}`, kind: 'nest_fellowship', host_kind: 'research_challenge', university_org_id: null, status: 'withdrawn', ends_on: '2025-01-01' }));
    expect(fellowshipStats(mk(9), [], today).overall).toMatchObject({ suppressed: true, rate: null, awarded: null });
    expect(fellowshipStats(mk(10), [], today).overall).toMatchObject({ suppressed: false, rate: 0, awarded: 10, due: 10 });
    // the rate moves with the milestones: the last sign-off completes ap-122's sponsored study
    await as('training-mgr');
    const pend = mss.find((m) => m.fellowship_id === 'fw-2024-ap-122' && m.status === 'submitted')!;
    const done = await b.rpc.updateMilestone(pend.id, 'sign_off');
    expect(done.ok, done.message).toBe(true);
    expect(done.data!.fellowship_status).toBe('completed');
    await as('k-hr-analyst');
    const r2 = await b.rpc.fellowshipStats();
    expect(r2.data).toEqual(fellowshipStats(raw('fellowships'), raw('fellowship_milestones'), today));
    expect(r2.data).not.toEqual(r.data);
    await as('k-observer');
    expect((await b.rpc.fellowshipStats()).code).toBe('forbidden');
  });

  it('FS67 acceptance: each fellowship names a host project and a supervisor role card', async () => {
    const people = new Map(T.people.map((p) => [p.id, p]));
    expect(T.fellowships.length).toBeGreaterThanOrEqual(40);
    for (const f of T.fellowships) {
      const host = f.host_kind === 'research_challenge' ? T.research_challenges.find((x) => x.id === f.host_ref) : T.adv_technologies.find((x) => x.id === f.host_ref);
      expect(host, `${f.id} host`).toBeTruthy();
      const sup = people.get(f.supervisor_person_id);
      expect(sup?.kind, `${f.id} supervisor`).toBe('staff');
      expect(sup?.persona_id, `${f.id} supervisor role card`).toBeTruthy();
      expect(f.supervisor_person_id).not.toBe(f.fellow_person_id);
      expect(T.fellowship_milestones.filter((m) => m.fellowship_id === f.id).length).toBe(MS_TEMPLATE[f.kind as 'nest_fellowship'].length);
    }
    const w = { people: T.people, organisations: T.organisations, research_challenges: T.research_challenges, adv_technologies: T.adv_technologies, fellowships: T.fellowships } as FwWorld;
    expect(fellowshipProblem(fBase as never, w)).toBeNull();
    expect(fellowshipProblem({ ...fBase, host_ref: 'rc-none' } as never, w)).toBe('host');
    expect(fellowshipProblem({ ...fBase, host_kind: 'site' } as never, w)).toBe('host');
    expect(fellowshipProblem({ ...fBase, supervisor_person_id: 'w-eng-01' } as never, w)).toBe('supervisor');
    expect(fellowshipProblem({ ...fBase, supervisor_person_id: 'ap-160' } as never, w)).toBe('supervisor');
    await as('chco');
    expect((await b.rpc.saveFellowship({ ...fBase, supervisor_person_id: 'w-eng-01' } as never)).code).toBe('invalid');
    expect((await b.rpc.saveFellowship({ ...fBase, host_ref: '' } as never)).code).toBe('invalid');
    const ok = await b.rpc.saveFellowship(fBase as never);
    expect(ok.ok, ok.message).toBe(true);
    expect(ok.data).toEqual({ id: fellowshipId(fBase.starts_on, fBase.fellow_person_id), milestones: 5 });
    const row = raw('fellowships').find((f) => f.id === ok.data!.id)!;
    expect(row.host_ref).toBe('rc-1');
    expect(row.supervisor_person_id).toBe('p-training-mgr');
    expect(raw('fellowship_milestones').filter((m) => m.fellowship_id === row.id).map((m) => m.id)).toEqual(milestonePlan(row.id, 'sponsored_study', fBase.starts_on, fBase.ends_on).map((m) => m.id));
  });

  it('FS67 acceptance: award counts are never shown without the completion rate beside them', async () => {
    // data: a cell carries an award count only when its completion rate is given
    const st = fellowshipStats(T.fellowships, T.fellowship_milestones, today);
    for (const c of [st.overall, ...st.by_kind, ...st.by_host, ...st.by_university]) if (c.awarded != null) expect(c.rate, c.key).not.toBeNull();
    const halfDue = Array.from({ length: 14 }, (_, i) => ({ id: `f${i}`, kind: 'sponsored_study', host_kind: 'research_challenge', university_org_id: 'ku', status: i < 5 ? 'withdrawn' : 'active', ends_on: '2030-01-01' }));
    expect(fellowshipStats(halfDue, [], today).overall).toMatchObject({ awarded: null, rate: null, suppressed: true }); // 14 awarded, 5 due
    // UI: the only place an award count is rendered is CompletionPair, which always renders the rate (or "suppressed") first
    const files = ['FellowshipsPage', 'FellowshipPage', 'WorkforceFellowshipsPage', 'UniversitiesPage', 'PartnerUniversityPage', 'links'].map((f) => readFileSync(`src/modules/m10/${f}.tsx`, 'utf8'));
    for (const s of files) expect(s).not.toMatch(/\.awarded\b/);
    const fw = readFileSync('src/modules/m10/fw.tsx', 'utf8');
    const pair = fw.slice(fw.indexOf('export function CompletionPair'), fw.indexOf('export function StatsTable'));
    expect(fw.split('.awarded').length - 1).toBe(pair.split('.awarded').length - 1);
    expect(pair.indexOf('m10-fw-rate')).toBeLessThan(pair.indexOf('m10-fw-awarded'));
    expect(pair).toMatch(/cell\.rate == null \? t\('m10\.fw\.awardedSuppressed'\)/);
  });
});

describe('FS67 rules and RPCs', () => {
  it('milestone template: five per kind, the university owns its sponsored-study reports; ids and due dates', () => {
    for (const k of ['nest_fellowship', 'sponsored_study'] as const) expect(MS_TEMPLATE[k].length).toBe(5);
    const plan = milestonePlan('fw-x', 'sponsored_study', '2026-09-01', '2028-09-01');
    expect(plan.map((m) => m.id)).toEqual(['fw-x-m1', 'fw-x-m2', 'fw-x-m3', 'fw-x-m4', 'fw-x-m5']);
    expect(plan.filter((m) => m.owner === 'university').map((m) => m.kind)).toEqual(['enrolment', 'year_results', 'graduation']);
    expect(plan[0].due_on).toBe('2026-09-15');
    expect(plan[4].due_on).toBe('2028-09-01');
    const nest = milestonePlan('fw-y', 'nest_fellowship', '2026-01-01', '2027-01-01');
    expect(nest[4].kind).toBe('knowledge_transfer');
    expect(nest.every((m) => m.owner === 'enec')).toBe(true);
  });

  it('updateMilestone: the fellow or the university submits; supervisor or HR signs off, never the submitter; a return needs a note', async () => {
    const fw = { id: 'fw-z', fellow_person_id: 'ap-1', supervisor_person_id: 'p-sup', university_org_id: 'ku', status: 'active' };
    const ms = { id: 'fw-z-m1', fellowship_id: 'fw-z', owner: 'enec', status: 'planned' };
    expect(milestoneProblem('submit', ms, fw, { me: 'ap-1', hr: false, uniOrg: null }, '')).toBeNull();
    expect(milestoneProblem('submit', ms, fw, { me: 'p-sup', hr: false, uniOrg: null }, '')).toBe('forbidden');
    expect(milestoneProblem('submit', { ...ms, owner: 'university' }, fw, { me: 'p-k-university', hr: false, uniOrg: 'ku' }, '')).toBeNull();
    expect(milestoneProblem('sign_off', ms, fw, { me: 'p-sup', hr: false, uniOrg: null }, '')).not.toBeNull(); // planned
    const sub = { ...ms, status: 'submitted', submitted_by: 'p-sup' };
    expect(milestoneProblem('sign_off', sub, fw, { me: 'p-sup', hr: false, uniOrg: null }, '')).toBe('maker_checker');
    expect(milestoneProblem('sign_off', { ...sub, submitted_by: 'ap-1' }, fw, { me: 'p-sup', hr: false, uniOrg: null }, '')).toBeNull();
    expect(milestoneProblem('sign_off', { ...sub, submitted_by: 'ap-1' }, fw, { me: 'p-hr', hr: true, uniOrg: null }, '')).toBeNull();
    expect(milestoneProblem('sign_off', { ...sub, submitted_by: 'ap-1' }, fw, { me: 'p-other', hr: false, uniOrg: null }, '')).toBe('forbidden');
    expect(milestoneProblem('return', { ...sub, submitted_by: 'ap-1' }, fw, { me: 'p-sup', hr: false, uniOrg: null }, 'no')).not.toBeNull();
    expect(milestoneProblem('sign_off', { ...sub, submitted_by: 'ap-1' }, { ...fw, status: 'withdrawn' }, { me: 'p-sup', hr: false, uniOrg: null }, '')).not.toBeNull();
    // local RPC path: k-university submits ap-125's year results; it cannot sign them off; the supervisor can
    const uniMs = T.fellowship_milestones.find((m) => m.owner === 'university' && m.status === 'planned' && m.fellowship_id === 'fw-2025-ap-125' && String(m.due_on).slice(0, 10) <= today)!;
    expect(uniMs).toBeTruthy();
    await as('k-university');
    const u = await b.rpc.updateMilestone(uniMs.id, 'submit', 'Year results attached');
    expect(u.ok, u.message).toBe(true);
    expect((await b.rpc.updateMilestone(uniMs.id, 'sign_off')).code).toBe('forbidden');
    const sup = T.fellowships.find((f) => f.id === 'fw-2025-ap-125')!.supervisor_person_id;
    const supPersona = S.personas.find((p) => p.person_id === sup)!.persona;
    await as(supPersona);
    const s = await b.rpc.updateMilestone(uniMs.id, 'sign_off');
    expect(s.ok, s.message).toBe(true);
    expect(raw('fellowship_milestones').find((m) => m.id === uniMs.id)!.status).toBe('signed_off');
  });

  it('withdrawFellowship: HR only, with a reason; the fellowship stays in the denominator', async () => {
    const active = T.fellowships.find((f) => f.status === 'active')!;
    await as('sro');
    expect((await b.rpc.withdrawFellowship(active.id, 'The fellow changed role here')).code).toBe('forbidden');
    await as('chco');
    expect((await b.rpc.withdrawFellowship(active.id, 'short')).code).toBe('invalid');
    const before = fellowshipStats(raw('fellowships'), raw('fellowship_milestones'), today);
    const w = await b.rpc.withdrawFellowship(active.id, 'The student changed programme');
    expect(w.ok, w.message).toBe(true);
    const after = fellowshipStats(raw('fellowships'), raw('fellowship_milestones'), today);
    expect(raw('fellowships').find((f) => f.id === active.id)!.status).toBe('withdrawn');
    if (String(active.ends_on).slice(0, 10) >= today) expect(after.overall.due).toBe((before.overall.due ?? 0) + 1);
  });

  it('read rules: fellowship rows are personal (fellow, supervisor, host university, HR, auditor); aggregates via the RPC', async () => {
    expect(SCHEMA.fellowships.read).toEqual(SCHEMA.fellowship_milestones.read);
    await as('k-university');
    const uni = await b.list('fellowships' as never) as unknown as Row[];
    expect(uni.length).toBe(T.fellowships.filter((f) => f.university_org_id === 'ku').length);
    await as('training-mgr');
    const sup = await b.list('fellowships' as never) as unknown as Row[];
    expect(sup.length).toBe(T.fellowships.filter((f) => f.supervisor_person_id === 'p-training-mgr').length);
    await as('k-graduate');
    expect((await b.list('fellowships' as never) as unknown as Row[]).every((f) => f.fellow_person_id === 'p-k-graduate')).toBe(true);
    await as('chco');
    expect((await b.list('fellowships' as never)).length).toBe(T.fellowships.length);
    await as('alnoor-gm');
    expect((await b.list('fellowships' as never)).length).toBe(0);
  });
});

describe('FS66/FS67 wiring', () => {
  it('routes, chips, i18n parity and Arabic', () => {
    const ids = ['partner-university-programmes', 'training-university-programmes', 'university-programme', 'workforce-graduate-hires', 'universities-fellowships', 'university-fellowship', 'workforce-fellowships'];
    for (const id of ids) {
      const r = routes.find((x) => x.id === id);
      expect(r, id).toBeTruthy();
      expect((en as Row).routes[id].title, id).toBeTruthy();
      expect(AR.test((ar as Row).routes[id].title), id).toBe(true);
    }
    expect(FEATURE_BENCHMARKS.FS66).toEqual(['NUC-NET', 'UAE-NQF', 'LIGHTCAST']);
    expect(FEATURE_BENCHMARKS.FS67).toEqual(['NEA', 'NUC-NET']);
    for (const f of ['ProgrammesWorkspacePage', 'ProgrammeRegisterPage', 'ProgrammePage', 'GraduateHiresPage']) expect(readFileSync(`src/modules/m10/${f}.tsx`, 'utf8')).toContain('<BenchmarkChips feature="FS66" />');
    for (const f of ['FellowshipsPage', 'FellowshipPage', 'WorkforceFellowshipsPage']) expect(readFileSync(`src/modules/m10/${f}.tsx`, 'utf8')).toContain('<BenchmarkChips feature="FS67" />');
    const E = new Map(flat(en as Row)), A = new Map(flat(ar as Row));
    expect([...E.keys()].sort()).toEqual([...A.keys()].sort());
    for (const [k, v] of A) if (/^(ua|fw|links)\./.test(k) && /[a-z]{3}/i.test(E.get(k)!) && !/^[\d{}\s().,:A-Z-]+$/.test(E.get(k)!)) expect(AR.test(v) || /ADVANCE|NEST|MSCFP|FS57|2030/.test(v), k).toBe(true);
    for (const [k, v] of E) expect((v.match(/\{\w+\}/g) ?? []).sort(), k).toEqual((A.get(k)!.match(/\{\w+\}/g) ?? []).sort());
  });
});
