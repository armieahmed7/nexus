/** F27 SAT analysis workbench and F29 Accreditation readiness (W4 · E2, M26): every acceptance criterion on the local path, the
 *  rules shared with SQL, the seed and i18n. The SQL path is checked by scripts/validate/w4e2-sat.mjs (PGlite). */
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { hasKey, translate } from '../../src/i18n';
import { SCHEMA } from '../../src/data/schema';
import { DECISIONS, MIN_RATERS, RESTRICTED_TITLE, SELECTED, changeImpact, consensus, coverage, difDecision, proposal, roundMean } from '../../src/modules/m26/sat';
import { DEMO_NOTICE, NONE, cycleOf, readiness, selfEvalState, soleAuthor, suggestFor, toLink, validEvidence } from '../../src/modules/m26/accr';
import { evidenceFacts, roleCoverage } from '../../src/modules/m26/evidence';
import { selfEvalHtml, traceabilityHtml } from '../../src/modules/m26/report';
import { routes } from '../../src/modules/m26/routes';
import seed from '../../src/seed/seed.json';

const T = (seed as unknown as { tables: Record<string, any[]> }).tables; // eslint-disable-line @typescript-eslint/no-explicit-any
let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});
const ledger = () => b.raw('ledger_local').length;
const lastAudit = () => [...b.raw('audit_events')].sort((x, y) => x.seq - y.seq).pop()!;
const trace = { tasks: T.jta_tasks, links: T.task_objectives, objectives: T.sat_objectives, roleComps: T.role_competencies, courses: T.courses };

describe('F27 · the DIF decision rule (acceptance: any (D, I, F) maps to exactly one outcome)', () => {
  it('is total and exclusive over all 125 triples, and agrees with an independent reading of the branches', () => {
    const branches = [
      { rule: 'overtrain', out: 'overtrain', hit: (d: number, i: number, f: number) => i >= 4 && d >= 3 && f <= 2 },
      { rule: 'important', out: 'train', hit: (_d: number, i: number) => i >= 3 },
      { rule: 'difficult', out: 'train', hit: (d: number) => d >= 4 },
      { rule: 'rare_moderate', out: 'train', hit: (d: number, _i: number, f: number) => d === 3 && f <= 2 },
      { rule: 'low', out: 'no_train', hit: () => true },
    ];
    const seen = new Map<string, number>();
    for (let d = 1; d <= 5; d++) for (let i = 1; i <= 5; i++) for (let f = 1; f <= 5; f++) {
      const r = difDecision(d, i, f);
      expect(DECISIONS).toContain(r.decision);
      const first = branches.find((x) => x.hit(d, i, f))!;
      expect([r.rule, r.decision], `${d}${i}${f}`).toEqual([first.rule, first.out]);
      expect(r.reasons.length).toBeGreaterThan(0);
      seen.set(r.decision, (seen.get(r.decision) ?? 0) + 1);
    }
    expect([...seen.values()].reduce((a, x) => a + x, 0)).toBe(125);
    expect(new Set(seen.keys())).toEqual(new Set(['train', 'overtrain', 'no_train']));
  });
  it('consensus rounds the mean half up exactly; fewer than 3 ratings give no proposal; a spread of 3 flags disagreement', () => {
    expect(roundMean(5, 2)).toBe(3); // 2.5 -> 3
    expect(roundMean(7, 3)).toBe(2); // 2.33 -> 2
    expect(proposal([{ d: 4, i: 5, f: 1 }, { d: 4, i: 5, f: 1 }]).status).toBe('insufficient');
    const p = proposal([{ d: 4, i: 5, f: 1 }, { d: 4, i: 5, f: 2 }, { d: 3, i: 4, f: 1 }]);
    expect([p.status, p.decision, p.consensus?.d, p.consensus?.i, p.consensus?.f]).toEqual(['proposed', 'overtrain', 4, 5, 1]);
    expect(consensus([{ d: 1, i: 3, f: 3 }, { d: 4, i: 3, f: 3 }, { d: 2, i: 3, f: 3 }])?.disagreement).toBe(true);
    expect(proposal([{ d: 1, i: 1, f: 5, active: false }, { d: 1, i: 1, f: 5 }]).n).toBe(1);
    expect(MIN_RATERS).toBe(3);
  });
  it('every reason key of the rule exists in English and Arabic', () => {
    for (let d = 1; d <= 5; d++) for (let i = 1; i <= 5; i++) for (let f = 1; f <= 5; f++) for (const r of proposal([{ d, i, f }, { d, i, f }, { d, i, f }]).reasons) {
      expect(hasKey(r.key), r.key).toBe(true);
      expect(translate('ar', r.key)).not.toBe(r.key);
    }
  });
});

describe('F27 · seed', () => {
  it('approved analyses are fully decided; decisions follow the rule unless overridden with a reason', () => {
    const approved = new Set(T.jta_analyses.filter((a) => a.status === 'approved').map((a) => a.role_id));
    expect(approved.size).toBeGreaterThanOrEqual(8);
    for (const t of T.jta_tasks.filter((x) => approved.has(x.role_id) && !x.restricted)) expect(t.decision, t.id).not.toBe('pending');
    for (const t of T.jta_tasks.filter((x) => x.decision !== 'pending')) {
      const p = proposal(T.dif_ratings.filter((r) => r.task_id === t.id));
      if (t.override) expect((t.decision_note ?? '').length, t.id).toBeGreaterThanOrEqual(10);
      else expect(t.decision, t.id).toBe(p.decision);
    }
    expect(T.jta_tasks.filter((t) => t.override).length).toBe(2);
    expect(T.dif_ratings.every((r) => [r.d, r.i, r.f].every((v) => Number.isInteger(v) && v >= 1 && v <= 5))).toBe(true);
  });
  it('the inventory reuses every M02 task item of the analysed roles; security tasks are title-less placeholders with no rating or link', () => {
    for (const ti of T.task_items.filter((x) => ['qs-ro', 'qs-sro', 'qs-mech', 'qs-lo-turbine'].includes(x.standard_id))) expect(T.jta_tasks.some((t) => t.task_item_id === ti.id), ti.id).toBe(true);
    const r = T.jta_tasks.filter((t) => t.restricted);
    expect(r.length).toBe(4);
    expect(r.every((t) => t.title_en === RESTRICTED_TITLE.en && t.title_ar === RESTRICTED_TITLE.ar && !t.standard_id && !t.task_item_id)).toBe(true);
    expect(T.dif_ratings.some((x) => r.some((t) => t.id === x.task_id)) || T.task_objectives.some((x) => r.some((t) => t.id === x.task_id))).toBe(false);
    expect(T.jta_analyses.filter((a) => a.restricted).map((a) => a.role_id).sort()).toEqual(['cyber-security-engineer', 'safeguards-specialist', 'security-officer']);
  });
});

describe('F27 · the matrix highlights every train-selected task without an objective (acceptance)', () => {
  it('coverage gaps are exactly the active train/overtrain tasks with no active link, per role', () => {
    let total = 0;
    for (const a of T.jta_analyses.filter((x) => !x.restricted)) {
      const c = roleCoverage(a.role_id, trace);
      const expected = T.jta_tasks.filter((t) => t.role_id === a.role_id && t.status === 'active' && !t.restricted && SELECTED.includes(t.decision)
        && !T.task_objectives.some((l) => l.task_id === t.id && l.active)).map((t) => t.id).sort();
      expect(c.gaps, a.role_id).toEqual(expected);
      total += c.gaps.length;
    }
    expect(total).toBeGreaterThanOrEqual(4);
  });
  it('orphan objectives are active objectives in scope that no active task links to; overtrain needs a refresher', () => {
    const tasks = [{ id: 't1', role_id: 'r', restricted: false, status: 'active', decision: 'overtrain' as const }, { id: 't2', role_id: 'r', restricted: false, status: 'active', decision: 'train' as const }];
    const links = [{ id: 'l1', task_id: 't1', objective_ref: 'o1', course_id: 'c-init', jpm_id: null, active: true }];
    const objs = [{ id: 'o1', course_id: 'c-init', status: 'active', source: 'course' }, { id: 'o2', course_id: 'c-init', status: 'active', source: 'course' }];
    const c = coverage(tasks, links, tasks, objs, new Set(['c-cont']));
    expect([c.gaps, c.orphans, c.no_refresher, c.selected, c.covered, c.pct]).toEqual([['t2'], ['o2'], ['t1'], 2, 1, 50]);
  });
  it('linking an objective (local RPC) closes the gap; staff without SAT rights are refused', async () => {
    await as('k-ro');
    expect((await b.rpc.linkObjective({ task_id: 'jt-local-operator-g2', objective_ref: 'obj-c-loit-ojt-1' })).code).toBe('forbidden');
    await as('k-instructor');
    const before = roleCoverage('local-operator', { ...trace, links: b.raw('task_objectives') as never }).gaps;
    expect(before).toContain('jt-local-operator-g2');
    const r = await b.rpc.linkObjective({ task_id: 'jt-local-operator-g2', objective_ref: 'obj-c-loit-ojt-1' });
    expect(r.ok).toBe(true);
    expect(roleCoverage('local-operator', { ...trace, links: b.raw('task_objectives') as never }).gaps).not.toContain('jt-local-operator-g2');
    expect((await b.rpc.linkObjective({ task_id: 'jt-local-operator-g2', objective_ref: 'obj-c-loit-ojt-1' })).code).toBe('conflict');
    const un = await b.rpc.linkObjective({ task_id: 'jt-local-operator-g2', objective_ref: 'obj-c-loit-ojt-1', active: false });
    expect(un.ok && un.data?.active === false).toBe(true);
  });
});

describe('F27 · a task change lists all linked courses and standards and creates one review item each (acceptance)', () => {
  it('opens one item per course and standard, ledgered; refuses a second open change; items closes it; standards reuse reviseStandard', async () => {
    // training-mgr is a NEXUS persona (ledgered); Kafa'a-only personas such as k-instructor get audit rows only, as in kafaa_ledger()
    await as('training-mgr');
    const task = 'jt-qs-ro-t1';
    const impact = (await b.rpc.satImpact(task))!;
    const linked = T.task_objectives.filter((l) => l.task_id === task && l.active);
    expect(impact.courses.map((c) => c.id).sort()).toEqual([...new Set(linked.map((l) => l.course_id))].sort());
    expect(impact.standards.map((s) => s.id)).toContain('qs-ro');
    expect(impact.items.every((i) => Object.keys(i).sort().join() === 'bank,difficulty,id,status,topic')).toBe(true);
    const l0 = ledger();
    const r = await b.rpc.openSatChange({ task_id: task, kind: 'modified', summary: 'Start-up procedure revised with a new hold point', trigger: 'regulatory', title_en: 'Perform a reactor start-up with the new hold point (simulator)', title_ar: 'إجراء بدء تشغيل المفاعل مع نقطة التوقف الجديدة (المحاكي)' });
    expect(r.ok).toBe(true);
    const items = b.raw('sat_change_items').filter((i) => i.change_id === r.data!.id);
    expect(items.length).toBe(impact.courses.length + impact.standards.length);
    expect(items.filter((i) => i.kind === 'course').map((i) => i.ref_id).sort()).toEqual(impact.courses.map((c) => c.id));
    expect(items.filter((i) => i.kind === 'standard').map((i) => i.ref_id).sort()).toEqual(impact.standards.map((s) => s.id));
    expect(ledger()).toBe(l0 + 1);
    const tk = b.rawGet('jta_tasks', task)!;
    expect([tk.version, tk.title_en]).toEqual([2, 'Perform a reactor start-up with the new hold point (simulator)']);
    expect((await b.rpc.openSatChange({ task_id: task, kind: 'retired', summary: 'A second change while the first is open' })).code).toBe('conflict');
    const std = items.find((i) => i.kind === 'standard')!;
    expect((await b.rpc.resolveSatChangeItem(std.id, 'revised')).code).toBe('not_revised');
    expect((await b.rpc.resolveSatChangeItem(std.id, 'no_change', 'x')).code).toBe('invalid');
    const rev = await b.rpc.reviseStandard(std.ref_id, 'SAT change: new hold point');
    expect(rev.ok).toBe(true);
    await as('k-instructor');
    for (const c of items.filter((i) => i.kind === 'course')) expect((await b.rpc.resolveSatChangeItem(c.id, 'updated', 'Lesson plan updated')).ok).toBe(true);
    await as('training-mgr');
    const l1 = ledger();
    const done = await b.rpc.resolveSatChangeItem(std.id, 'revised');
    expect([done.ok, done.data?.change_status, done.data?.revision_id]).toEqual([true, 'closed', rev.data!.new_id]);
    expect(ledger()).toBe(l1 + 1);
    expect(b.rawGet('sat_changes', r.data!.id)!.status).toBe('closed');
  });
  it('the shared changeImpact rule reproduces every seeded change impact', () => {
    for (const c of T.sat_changes.filter((x) => x.area !== 'future')) { // FS06 future-attribute rows carry no impact
      const items = T.sat_change_items.filter((i) => i.change_id === c.id);
      expect(items.length, c.id).toBe(c.impact.courses.length + c.impact.standards.length);
    }
    const t = T.jta_tasks.find((x) => x.restricted)!;
    expect(changeImpact({ task: t, links: T.task_objectives, objectives: T.sat_objectives, courses: T.courses, jpms: T.jpms, standards: T.qual_standards, items: T.items })).toEqual({ courses: [], standards: [], jpms: [], items: [], objectives: [] });
  });
});

describe('F27 · restricted tasks never expose titles beyond "restricted" (acceptance)', () => {
  it('every read and RPC path refuses or returns nothing for restricted tasks; security roles take no new task', async () => {
    await as('training-mgr');
    const rows = await b.list('jta_tasks');
    for (const t of rows.filter((x) => x.restricted)) expect([t.title_en, t.title_ar, t.duty_en]).toEqual([RESTRICTED_TITLE.en, RESTRICTED_TITLE.ar, '']);
    expect((await b.rpc.rateDif('jt-security-officer-r1', 3, 3, 3)).code).toBe('restricted');
    expect((await b.rpc.decideTraining('jt-security-officer-r1', 'train', 'Reason long enough')).code).toBe('restricted');
    expect((await b.rpc.linkObjective({ task_id: 'jt-security-officer-r1', objective_ref: 'obj-c-get-1' })).code).toBe('restricted');
    expect((await b.rpc.openSatChange({ task_id: 'jt-security-officer-r1', kind: 'retired', summary: 'Patrol route changed at the gate' })).code).toBe('restricted');
    expect((await b.rpc.saveJtaTask({ role_id: 'security-officer', title_en: 'Patrol the protected area', title_ar: 'دورية المنطقة المحمية' })).code).toBe('restricted');
    expect((await b.rpc.setAnalysisStatus('cyber-security-engineer', 'survey')).code).toBe('restricted');
    expect(await b.rpc.satImpact('jt-security-officer-r1')).toEqual({ courses: [], standards: [], jpms: [], items: [], objectives: [] });
    const audit = b.raw('audit_events').filter((a) => a.action.startsWith('sat.'));
    expect(JSON.stringify(audit)).not.toMatch(/Patrol|protected area/);
  });
  it('the traceability report prints restricted rows as "restricted" only', () => {
    const html = traceabilityHtml({ role: { en: 'Security Officer', ar: 'ضابط أمن' }, status: 'draft', version: 1, approved_on: null, generated_on: '2026-10-08',
      summary: { tasks: 0, selected: 0, covered: 0, gaps: 0, orphans: 0, pct: null }, orphans: [],
      rows: [{ code: 'SO-R01', title: { en: 'Secret patrol route', ar: 'سري' }, restricted: true, source: 'qual_card', critical: false, n: 0, dif: null, proposal: null, decision: 'pending', override: false, note: null, objectives: [], courses: [], jpms: [], state: 'not_selected' }] },
    'en', (k, v) => translate('en', k, v));
    expect(html).toContain("Restricted – managed outside Kafa&#39;a");
    expect(html).not.toContain('Secret patrol route');
  });
});

describe('F27 · RBAC and the DIF survey', () => {
  it('only training staff and auditors read the SAT tables; an SME reads only their own ratings', async () => {
    for (const p of ['k-ro', 'chco', 'alnoor-gm', 'qc-inspector']) {
      await as(p);
      for (const tb of ['jta_tasks', 'jta_analyses', 'task_objectives', 'sat_changes', 'accr_selfevals', 'accr_assessments'] as const) expect((await b.list(tb)).length, `${p}/${tb}`).toBe(0);
    }
    await as('k-auditor');
    expect((await b.list('jta_tasks')).length).toBe(T.jta_tasks.length);
    expect((await b.rpc.rateDif('jt-qs-ro-t4', 2, 2, 2)).code).toBe('forbidden');
    expect((await b.rpc.decideTraining('jt-qs-ro-t4', 'train')).code).toBe('forbidden');
    await as('sme-reviewer');
    const sv = await b.rpc.difSurvey();
    expect(sv.open && sv.role_id === 'systems-design-plant-engineer' && sv.tasks.length > 0).toBe(true);
    const r = await b.rpc.rateDif(sv.tasks[0].id, 3, 4, 2, 'From the survey');
    expect(r.ok).toBe(true);
    expect((await b.list('dif_ratings')).map((x) => x.rater_person_id)).toEqual(['p-sme-reviewer']);
    expect((await b.rpc.rateDif('jt-qs-ro-t4', 3, 3, 3)).code).toBe('forbidden');
    await as('k-ro');
    expect((await b.rpc.difSurvey()).open).toBe(false);
  });
  it('opening a survey notifies the role\'s SMEs; approving needs every task decided (training manager, ledgered)', async () => {
    await as('k-instructor');
    expect((await b.rpc.setAnalysisStatus('quality-assurance-qc', 'approved')).code).toBe('forbidden');
    const s = await b.rpc.setAnalysisStatus('quality-assurance-qc', 'survey');
    expect(s.ok).toBe(true);
    const sme = T.sme_profiles.filter((x) => T.people.find((p) => p.id === x.person_id)?.job_role_id === 'quality-assurance-qc');
    for (const x of sme) expect(b.raw('notifications').some((n) => n.person_id === x.person_id && n.kind === 'sat' && n.link === '/training/sat/survey')).toBe(true);
    await as('training-mgr');
    expect((await b.rpc.setAnalysisStatus('quality-assurance-qc', 'approved')).code).toBe('undecided');
    const l0 = ledger();
    const ok = await b.rpc.setAnalysisStatus('chemistry-technician', 'approved');
    expect(ok.code).toBe('undecided');
    for (const t of b.raw('jta_tasks').filter((x) => x.role_id === 'local-operator' && x.status === 'active')) expect(t.decision).not.toBe('pending');
    expect((await b.rpc.setAnalysisStatus('local-operator', 'draft')).ok).toBe(true);
    expect((await b.rpc.setAnalysisStatus('local-operator', 'approved')).ok).toBe(true);
    expect(ledger()).toBe(l0 + 1);
    expect(b.rawGet('jta_analyses', 'jta-local-operator')!.version).toBe(2);
  });
  it('the training manager decides; an override needs a reason (audited and ledgered)', async () => {
    await as('training-mgr');
    const t = T.jta_tasks.find((x) => x.decision === 'pending' && !x.restricted && proposal(T.dif_ratings.filter((r) => r.task_id === x.id)).status === 'proposed' && x.role_id !== 'systems-design-plant-engineer')!;
    const rule = proposal(T.dif_ratings.filter((r) => r.task_id === t.id)).decision!;
    const other = rule === 'no_train' ? 'train' : 'no_train';
    expect((await b.rpc.decideTraining(t.id, other, 'short')).code).toBe('note_required');
    expect(lastAudit().outcome).toBe('refused');
    const l0 = ledger();
    const r = await b.rpc.decideTraining(t.id, other, 'Committee asked for a hands-on session after OE');
    expect([r.ok, r.data?.override]).toEqual([true, true]);
    expect(ledger()).toBe(l0 + 1);
    const insuff = T.jta_tasks.find((x) => !x.restricted && !T.dif_ratings.some((r2) => r2.task_id === x.id))!;
    expect((await b.rpc.decideTraining(insuff.id, 'train')).code).toBe('insufficient_ratings');
  });
  it('new tasks and objectives: titles in both languages; linked tasks change only through a SAT change', async () => {
    await as('k-instructor');
    expect((await b.rpc.saveJtaTask({ role_id: 'fire-protection', title_en: 'abc', title_ar: 'ابجد' })).code).toBe('invalid');
    const n = await b.rpc.saveJtaTask({ role_id: 'fire-protection', title_en: 'Test a fire pump', title_ar: 'اختبار مضخة الحريق' });
    expect(n.ok).toBe(true);
    expect(b.rawGet('jta_tasks', n.data!.id)!.code).toMatch(/^FP-J\d\d$/);
    expect((await b.rpc.saveJtaTask({ id: 'jt-qs-ro-t1', role_id: 'reactor-operator', title_en: 'Renamed directly', title_ar: 'إعادة تسمية مباشرة' })).code).toBe('change_required');
    const o = await b.rpc.saveObjective({ kind: 'terminal', text_en: 'Given the pump test procedure, test the fire pump', text_ar: 'بالاعتماد على إجراء الاختبار، اختبار مضخة الحريق', course_id: 'c-fire', role_id: 'fire-protection' });
    expect(o.ok).toBe(true);
    expect((await b.rpc.linkObjective({ task_id: n.data!.id, objective_ref: o.data!.id })).ok).toBe(true);
  });
});

describe('F29 · evidence suggestions (acceptance: at least one link when data exists, or "no evidence found")', () => {
  it('every criterion of every programme gets suggestions or the none marker; facts are counts only', async () => {
    await as('training-mgr');
    for (const p of T.accr_programmes) {
      const ev = (await b.rpc.accrEvidence(p.id))!;
      expect(ev.facts.length, p.id).toBeGreaterThan(0);
      expect(JSON.stringify(ev.facts)).not.toMatch(/"(w|p)-[a-z]/);
      for (const c of T.accr_criteria) {
        const s = suggestFor(c.evidence_kinds, ev.facts);
        expect(s.length).toBeGreaterThan(0);
        if (s[0].kind === 'none') expect(ev.facts.some((f) => c.evidence_kinds.includes(f.kind))).toBe(false);
        else for (const x of s) expect(validEvidence([toLink(x as never)])).toBe(true);
      }
    }
    expect(suggestFor(['effectiveness'], [])).toEqual([NONE]);
    await as('k-ro');
    expect(await b.rpc.accrEvidence('coit')).toBeNull();
  });
  it('the local evidence equals the shared rule on the seed (and F25 / F31 sources are optional)', () => {
    const p = T.accr_programmes.find((x) => x.id === 'coit')!;
    const facts = evidenceFacts({ programme: p, analyses: T.jta_analyses, ...trace, items: T.items, forms: T.assessment_forms, attempts: T.attempts, evaluatorQuals: T.evaluator_quals, qualRecords: T.qual_records,
      evaluations: T.evaluations, trainingRecords: T.training_records, sessions: T.sessions, l3: [{ course_id: 'c-coit-sim' }, { course_id: 'x' }], tracks: [{}, {}] }, '2026-10-08');
    expect(facts.find((f) => f.kind === 'effectiveness' && f.route === '/training/effectiveness')?.m).toEqual({ l3: 1, courses: 1 });
    expect(facts.find((f) => f.route === '/training/instructors')?.m.tracks).toBe(2);
    expect(facts.filter((f) => f.kind === 'traceability').map((f) => f.ref)).toEqual(['reactor-operator', 'senior-reactor-operator']);
  });
});

describe('F29 · maker-checker, gaps and readiness (acceptance: never finalised by its sole author)', () => {
  it('the sole author is refused; a co-authored self-evaluation is finalised by the training manager (ledgered) and frozen', async () => {
    await as('training-mgr');
    const sole = await b.rpc.finaliseSelfEval('ase-chem-init-2026-H2');
    expect(sole.code).toBe('maker_checker');
    expect(lastAudit().outcome).toBe('refused');
    expect((await b.rpc.finaliseSelfEval('ase-loit-2026-H2')).code).toBe('incomplete');
    await as('k-instructor');
    expect((await b.rpc.finaliseSelfEval('ase-coit-2026-H2')).code).toBe('forbidden');
    await as('training-mgr');
    const l0 = ledger();
    const ok = await b.rpc.finaliseSelfEval('ase-coit-2026-H2');
    expect([ok.ok, ok.data?.status]).toEqual([true, 'finalised']);
    expect(ledger()).toBe(l0 + 1);
    expect((await b.rpc.rateCriterion({ selfeval_id: 'ase-coit-2026-H2', criterion_id: 'ac-pi-1', rating: 4, evidence: [] })).code).toBe('invalid');
    // another instructor co-rates the chemistry draft: now it can be finalised
    await as('k-instructor');
    expect((await b.rpc.rateCriterion({ selfeval_id: 'ase-chem-init-2026-H2', criterion_id: 'ac-pi-1', rating: 4, evidence: [] })).ok).toBe(true);
    await as('training-mgr');
    expect((await b.rpc.finaliseSelfEval('ase-chem-init-2026-H2')).ok).toBe(true);
    expect(soleAuthor(['p-a'], 'p-a')).toBe(true);
    expect(soleAuthor(['p-a', 'p-b'], 'p-a')).toBe(false);
  });
  it('a gap needs an owner and a due date; readiness counts unrated criteria as 0; opening a cycle works once', async () => {
    await as('k-instructor');
    expect((await b.rpc.rateCriterion({ selfeval_id: 'ase-loit-2026-H2', criterion_id: 'ac-qi-3', rating: 2, evidence: [] })).code).toBe('invalid');
    const due = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const r = await b.rpc.rateCriterion({ selfeval_id: 'ase-loit-2026-H2', criterion_id: 'ac-qi-3', rating: 2, evidence: [], owner_role: 'instructors', due_on: due, gap_en: 'Observation programme not in place' });
    expect(r.ok).toBe(true);
    const xs = b.raw('accr_assessments').filter((a) => a.selfeval_id === 'ase-loit-2026-H2');
    expect(r.data!.readiness).toBe(selfEvalState(xs as never, T.accr_criteria.length).readiness);
    expect(readiness([4, 4], 22)).toBe(9); // 6 of 66 points
    expect(readiness(Array(22).fill(4), 22)).toBe(100);
    expect(readiness(Array(22).fill(1), 22)).toBe(0);
    const op = await b.rpc.openSelfEval('rp-init');
    expect([op.ok, op.data?.cycle]).toEqual([true, cycleOf(new Date().toISOString().slice(0, 10))]);
    expect((await b.rpc.openSelfEval('rp-init')).code).toBe('conflict');
    expect((await b.rpc.rateCriterion({ selfeval_id: 'ase-loit-2026-H2', criterion_id: 'ac-pi-1', rating: 4, evidence: [{ kind: 'secret', ref: 'x', route: '/x', label_en: '', label_ar: '' }] as never })).code).toBe('invalid');
  });
  it('the seeded trend rises over three finalised cycles for every programme, and finalised ones have two or more authors', () => {
    for (const p of T.accr_programmes) {
      const fin = T.accr_selfevals.filter((s) => s.programme_id === p.id && s.status === 'finalised').sort((a, b2) => (a.cycle < b2.cycle ? -1 : 1));
      expect(fin.length).toBe(3);
      expect(fin[0].readiness).toBeLessThan(fin[2].readiness);
      for (const s of fin) expect(s.authors.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('F29 · exports carry "demo / not an accreditation decision"; criteria are generic and sourced (acceptance)', () => {
  it('the report in both languages and the gap CSV carry the notice', () => {
    const m = { programme: { en: 'COIT', ar: 'COIT' }, code: 'COIT', cycle: '2026-H2', status: 'draft', readiness: 50, rated: 1, total: 22, gaps: 0, authors: [], finalised_by: null, finalised_at: null,
      generated_on: '2026-10-08', areas: [], trend: [], sources: [] };
    for (const lang of ['en', 'ar'] as const) {
      const html = selfEvalHtml(m, lang, (k, v) => translate(lang, k, v), DEMO_NOTICE);
      expect(html.split(DEMO_NOTICE[lang]).length - 1).toBeGreaterThanOrEqual(3); // title, banner, footer
      expect(html).toContain(lang === 'ar' ? 'dir="rtl"' : 'dir="ltr"');
    }
  });
  it('criteria are paraphrased (no INPO / ACAD wording) and cite public IAEA SAT guidance and FANR-REG-16', () => {
    expect(T.accr_criteria.length).toBe(22);
    const text = JSON.stringify(T.accr_criteria.map((c) => [c.title_en, c.title_ar, c.guidance_en, c.guidance_ar]));
    expect(text).not.toMatch(/\bINPO\b|\bACAD\b|NANT|National Academy/i);
    for (const c of T.accr_criteria) expect(c.sources.map((s: { url: string }) => s.url).join(' ')).toMatch(/iaea\.org.*fanr\.gov\.ae/);
    expect(new Set(T.accr_criteria.map((c) => c.area))).toEqual(new Set(['performance', 'environment', 'process', 'instructors', 'examinations']));
    expect(new Set(T.accr_criteria.filter((c) => c.area === 'process').map((c) => c.phase))).toEqual(new Set(['analysis', 'design', 'development', 'implementation', 'evaluation']));
  });
});

describe('M26 · routes, schema and i18n', () => {
  it('routes are SAT-guarded (the survey is for any signed-in SME) and every route has EN and AR titles', () => {
    expect(routes.length).toBe(10); // FS06 added training-sat-future
    for (const r of routes) {
      expect(hasKey(`m26.routes.${r.id}.title`)).toBe(true);
      expect(translate('ar', `m26.routes.${r.id}.title`)).not.toBe(translate('en', `m26.routes.${r.id}.title`));
      if (r.id !== 'training-sat-survey') expect(r.guard.grant?.res).toBe('sat');
    }
    for (const t of ['jta_analyses', 'jta_tasks', 'dif_ratings', 'sat_objectives', 'task_objectives', 'sat_changes', 'sat_change_items', 'accr_selfevals', 'accr_assessments']) {
      expect(SCHEMA[t].write.mode, t).toBe('rpc');
      expect(SCHEMA[t].read[0].res, t).toBe('sat');
    }
  });
});
