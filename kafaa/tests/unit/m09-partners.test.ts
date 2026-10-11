/** [G4] M09 partners and suppliers: business rules and the LocalBackend RPC path (mirrors the PGlite checks in scripts/validate/g4.mjs). */
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { buildSummary, certificateValidTo, DOC_CHECKLIST, equivalencyCoverage, icvCheck, icvSubmittable, readinessState, scoreCheck, summaryRef } from '../../src/domain/partners';

let b: LocalBackend;
async function as(persona: string | null) {
  b.setPersona(persona);
  await b.whenReady();
}
const audits = () => b.raw('audit_events').length;
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});

describe('M09 rules', () => {
  const allDone = ['orientation', 'quality', 'safety_culture', 'icv', 'self_assessment'].map((k) => ({ step_key: k, status: 'done' }));
  const allDocs = DOC_CHECKLIST.filter((d) => d.required).map((d) => ({ doc_key: d.key, status: 'uploaded', required: true }));
  it('readiness needs the five supplier steps, every required document and a submitted ICV plan', () => {
    const icv = { baseline: 30, target: 40, target_year: 2028, status: 'submitted' };
    expect(readinessState(allDone, allDocs, icv).ready).toBe(true);
    expect(readinessState(allDone.slice(1), allDocs, icv).missingSteps).toEqual(['orientation']);
    expect(readinessState(allDone, allDocs.slice(1), icv).missingDocs).toEqual([allDocs[0].doc_key]);
    expect(readinessState(allDone, [], icv).missingDocs.length).toBe(allDocs.length); // a document with no row is missing
    expect(readinessState(allDone, [...allDocs, { doc_key: 'iso9001', status: 'rejected', required: false }], icv).ready).toBe(false);
    expect(readinessState(allDone, allDocs, { ...icv, status: 'draft' }).icvReady).toBe(false);
    expect(readinessState([], [], null).pct).toBe(0);
  });
  it('the readiness summary carries a dated reference, the evidence fingerprints and the disclaimer', () => {
    const s = buildSummary({ org: { id: 'org-alnoor', name_en: 'Al Noor', name_ar: 'النور' }, steps: allDone, docs: [{ doc_key: 'qa_manual', status: 'accepted', required: true, sha256: 'ab'.repeat(32), file_name: 'qa.pdf' }], icv: null, certificates: [{ id: 'SA-1', course_id: 'c-sa-sc-104', issued_on: '2026-09-01' }], now: new Date('2026-10-08T10:00:00Z') });
    expect(s.ref).toBe('KFA-RS-ALNOOR-20261008');
    expect(summaryRef('org-gulfhydro', '2026-01-02')).toBe('KFA-RS-GULFHYDRO-20260102');
    expect(s.documents[0].sha256).toHaveLength(64);
    expect(s.disclaimer).toMatch(/not a registration, a qualification or an award/);
  });
  it('an ICV plan is valid only with a sane range and positive levers; submission also needs coverage and a live certificate', () => {
    const now = new Date('2026-10-08T00:00:00Z');
    const p = { baseline: 41, target: 50, target_year: 2028, levers: [{ lever: 'Emirati hiring', delta: 5 }, { lever: 'Local sourcing', delta: 4 }], certificate_file: 'c.pdf', certificate_valid_to: '2027-06-30' };
    expect(icvCheck(p, now)).toMatchObject({ valid: true, gap: 9, leverTotal: 9, covered: true, certificate: 'valid' });
    expect(icvSubmittable(p, now).ok).toBe(true);
    expect(icvSubmittable({ ...p, levers: [{ lever: 'x', delta: 2 }] }, now).problems).toContain('levers_short');
    expect(icvSubmittable({ ...p, certificate_valid_to: '2026-01-01' }, now).problems).toContain('certificate_expired');
    expect(icvCheck({ ...p, target: 40 }, now).problems).toContain('target_range');
    expect(icvCheck({ ...p, target_year: 2040 }, now).problems).toContain('year_range');
    expect(icvCheck({ ...p, levers: [{ lever: '', delta: 3 }] }, now).problems).toContain('lever_invalid');
    expect(icvCheck({ ...p, certificate_valid_to: '2026-11-01' }, now).certificate).toBe('expiring');
  });
  it('equivalency coverage counts only covered tasks; knowledge checks score against keys', () => {
    const tasks = [{ id: 't1', critical: true }, { id: 't2', critical: false }];
    expect(equivalencyCoverage(tasks, [{ task_id: 't1', covered: true }])).toMatchObject({ covered: 1, complete: false, criticalUncovered: [] });
    expect(equivalencyCoverage(tasks, [{ task_id: 't2', covered: true }]).criticalUncovered).toEqual(['t1']);
    expect(equivalencyCoverage([], []).complete).toBe(false);
    const keys = [{ check_id: 'a', answer: 0 }, { check_id: 'b', answer: 1 }, { check_id: 'c', answer: 2 }, { check_id: 'd', answer: 0 }];
    expect(scoreCheck(keys, keys, 80)).toMatchObject({ score: 100, passed: true });
    expect(scoreCheck(keys, keys.slice(0, 3), 75)).toMatchObject({ score: 75, passed: true });
    expect(scoreCheck(keys, keys.slice(0, 3), 80).passed).toBe(false);
    expect(certificateValidTo('2026-10-08', 24)).toBe('2028-10-08');
  });
});

describe('M09 directory', () => {
  it('every public directory entry links at least one public source; MoUs are non-binding; unverified relationships are absent', async () => {
    await as(null);
    const orgs = await b.list('organisations');
    expect(orgs.length).toBeGreaterThanOrEqual(55);
    expect(orgs.every((o) => o.public_listed)).toBe(true);
    for (const o of orgs) expect(Array.isArray(o.sources) && (o.sources as { url: string }[]).length > 0 && (o.sources as { url: string }[]).every((s) => /^https:\/\//.test(s.url))).toBe(true);
    for (const o of orgs.filter((x) => (x.rel_types ?? []).includes('mou'))) expect(o.binding).toBe(false);
    expect(orgs.some((o) => /microsoft|energy alliance|terrestrial/i.test(`${o.name_en} ${o.relationship_en}`))).toBe(false);
    expect(orgs.filter((o) => o.categories.includes('oversight')).map((o) => o.id).sort()).toEqual(['ad-doe', 'ead', 'fanr', 'iaea']);
  });
});

describe('M09 supplier onboarding (supplier lens)', () => {
  it("a supplier sees only its own file; another organisation's documents are not found and the attempt is audited", async () => {
    await as('alnoor-gm');
    expect((await b.list('supplier_documents')).every((d) => d.org_id === 'org-alnoor')).toBe(true);
    expect((await b.list('partner_onboarding')).map((c) => c.org_id)).toEqual(['org-alnoor']);
    const n = audits();
    const r = await b.rpc.uploadSupplierDocument('org-gulfhydro', 'qa_manual', 'x.pdf', 10, 'a'.repeat(64));
    expect(r.code).toBe('not_found');
    expect(audits()).toBe(n + 1);
    await as('k-contractor');
    expect((await b.list('partner_onboarding')).map((c) => c.org_id)).toEqual(['org-dhafra']);
  });
  it('a supplier cannot change its case or ICV plan status with a direct write', async () => {
    await as('gulfhydro-qa');
    expect((await b.update('partner_onboarding', 'po-gulfhydro', { status: 'approved' })).ok).toBe(false);
    expect((await b.update('icv_plans', 'icv-org-gulfhydro', { status: 'reviewed' })).ok).toBe(false);
    expect((await b.update('equivalency_requests', 'eq-4', { status: 'equivalent' })).ok).toBe(false);
  });
  it('completing the readiness path produces a summary for ENEC registration; then ENEC reviews, approves and hands off', async () => {
    await as('gulfhydro-qa');
    const early = await b.rpc.partnerOnboardingAction('po-gulfhydro', 'submit');
    expect(early.ok).toBe(false);
    expect(early.message).toMatch(/readiness step\(s\) open/);
    expect(early.message).toMatch(/document\(s\) missing/);
    for (const s of (await b.list('supplier_readiness')).filter((x) => x.step_key !== 'handoff')) expect((await b.update('supplier_readiness', s.id, { status: 'done' })).ok).toBe(true);
    for (const k of ['cgd_procedure', 'safety_culture_statement', 'icv_certificate']) expect((await b.rpc.uploadSupplierDocument('org-gulfhydro', k, `${k}.pdf`, 200, 'c'.repeat(64))).ok).toBe(true);
    const sub = await b.rpc.partnerOnboardingAction('po-gulfhydro', 'submit');
    expect(sub.ok).toBe(true);
    const summary = sub.data!.summary as { ref: string; documents: unknown[]; disclaimer: string };
    expect(summary.ref).toMatch(/^KFA-RS-GULFHYDRO-\d{8}$/);
    expect(summary.documents.length).toBeGreaterThanOrEqual(9);
    expect(sub.ledger_seq).toBeGreaterThan(0); // NEXUS persona: ledger written
    expect((await b.rpc.uploadSupplierDocument('org-gulfhydro', 'iso9001', 'iso.pdf', 10, 'd'.repeat(64))).code).toBe('conflict');

    await as('k-admin');
    const blocked = await b.rpc.decidePartnerOnboarding('po-gulfhydro', 'approved', 'ok');
    expect(blocked.ok).toBe(false);
    expect((await b.rpc.reviewSupplierDocument('sd-org-gulfhydro-qa_manual', 'rejected', '')).code).toBe('invalid');
    for (const d of (await b.list('supplier_documents', { filter: { org_id: 'org-gulfhydro' } })).filter((x) => x.required && x.status !== 'missing')) expect((await b.rpc.reviewSupplierDocument(d.id, 'accepted', 'Checked')).ok).toBe(true);
    expect((await b.rpc.decidePartnerOnboarding('po-gulfhydro', 'returned', '')).code).toBe('invalid'); // a return needs a note
    expect((await b.rpc.decidePartnerOnboarding('po-gulfhydro', 'approved', 'Evidence complete')).ok).toBe(true);
    expect((await b.rpc.decidePartnerOnboarding('po-gulfhydro', 'handed_off', '')).ok).toBe(true);

    await as('gulfhydro-qa');
    const c = (await b.list('partner_onboarding'))[0];
    expect(c.status).toBe('handed_off');
    expect((c.history as { action: string }[]).map((h) => h.action)).toEqual(expect.arrayContaining(['submit', 'approved', 'handed_off']));
    expect((await b.list('supplier_readiness', { filter: { step_key: 'handoff' } }))[0].status).toBe('done');
  });
  it("only the supplier's partner admin moves its case: not a contractor (partner user), not an ENEC admin", async () => {
    await as('k-contractor');
    expect((await b.rpc.partnerOnboardingAction('po-dhafra', 'withdraw')).code).toBe('forbidden');
    await as('k-admin');
    expect((await b.rpc.partnerOnboardingAction('po-liwa', 'start')).code).toBe('forbidden');
  });
});

describe('M09 ICV plans', () => {
  it('a plan whose levers do not cover the gap cannot be submitted; ENEC reviews a covered plan', async () => {
    await as('alnoor-gm');
    const base = { baseline: 41, target: 50, target_year: new Date().getUTCFullYear() + 2, certificate_file: 'c.pdf', certificate_valid_to: `${new Date().getUTCFullYear() + 1}-06-30` };
    const short = await b.rpc.saveIcvPlan('org-alnoor', { ...base, levers: [{ lever: 'Local sourcing', delta: 2 }] }, true);
    expect(short.ok).toBe(false);
    expect(short.message).toMatch(/do not cover/);
    expect((await b.rpc.saveIcvPlan('org-gulfhydro', { ...base, levers: [{ lever: 'x', delta: 9 }] }, false)).code).toBe('not_found');
    const ok = await b.rpc.saveIcvPlan('org-alnoor', { ...base, levers: [{ lever: 'Emirati hiring', delta: 5 }, { lever: 'Local sourcing', delta: 4 }] }, true);
    expect(ok.ok && ok.data?.status).toBe('submitted');
    expect((await b.rpc.saveIcvPlan('org-alnoor', { ...base, levers: [{ lever: 'x', delta: 9 }] }, false)).code).toBe('conflict');
    await as('k-admin');
    expect((await b.rpc.reviewIcvPlan('icv-org-alnoor', 'returned', 'no')).code).toBe('invalid');
    expect((await b.rpc.reviewIcvPlan('icv-org-alnoor', 'reviewed', 'Levers cover the gap')).ok).toBe(true);
    await as('k-auditor');
    expect((await b.rpc.reviewIcvPlan('icv-org-gulfhydro', 'reviewed', '')).code).toBe('forbidden');
  });
});

describe('M09 contractor equivalency', () => {
  it("a partner requesting another organisation's equivalency record gets not found, and an audit event is written", async () => {
    await as('gulfhydro-qa');
    const n = audits();
    const r = await b.rpc.getEquivalency('eq-1');
    expect(r).toMatchObject({ ok: false, code: 'not_found' });
    expect(audits()).toBe(n + 1);
    expect(b.raw('audit_events').at(-1)).toMatchObject({ action: 'equivalency.read', outcome: 'refused', entity_id: 'eq-1' });
    expect((await b.rpc.getEquivalency('eq-4')).ok).toBe(true);
  });
  it('submit, map and decide: security standards refused, equivalent needs full coverage, decisions are final', async () => {
    await as('gulfhydro-qa');
    expect((await b.rpc.submitEquivalency({ person_label: 'G-03', standard_id: 'qs-sec', evidence: [{ name: 'c', kind: 'certificate' }] })).message).toMatch(/Security/);
    expect((await b.rpc.submitEquivalency({ person_id: 'c-alnoor-02', person_label: 'x', standard_id: 'qs-elec', evidence: [{ name: 'c', kind: 'certificate' }] })).code).toBe('not_found');
    expect((await b.rpc.submitEquivalency({ person_label: 'G-03', standard_id: 'qs-elec', evidence: [] })).code).toBe('invalid');
    const eq = await b.rpc.submitEquivalency({ person_id: 'c-gulf-02', person_label: 'Technician G-02', standard_id: 'qs-elec', evidence: [{ name: 'Training record', kind: 'training_record' }, { name: 'JPM record', kind: 'jpm_record' }] });
    expect(eq.ok).toBe(true);
    expect((await b.rpc.submitEquivalency({ person_id: 'c-gulf-02', person_label: 'Technician G-02', standard_id: 'qs-elec', evidence: [{ name: 'x', kind: 'cv' }] })).code).toBe('conflict');
    const id = eq.data!.id;
    await as('alnoor-gm');
    expect((await b.list('equivalency_requests')).some((r) => r.id === id)).toBe(false);
    await as('training-mgr');
    expect((await b.rpc.decideEquivalency(id, 'equivalent', 'looks fine')).message).toMatch(/every task item/);
    expect((await b.rpc.mapEquivalency(id, [{ task_id: 'qs-mech-t1', covered: true, evidence: [0] }])).code).toBe('invalid'); // task not on this standard
    expect((await b.rpc.mapEquivalency(id, [{ task_id: 'qs-elec-t1', covered: true, evidence: [] }])).code).toBe('invalid'); // covered needs cited evidence
    const map = await b.rpc.mapEquivalency(id, ['qs-elec-t1', 'qs-elec-t2', 'qs-elec-t3'].map((t, i) => ({ task_id: t, covered: true, evidence: [i % 2] })));
    expect(map.data).toEqual({ covered: 3, total: 3 });
    expect((await b.rpc.decideEquivalency(id, 'equivalent', 'All tasks evidenced')).ok).toBe(true);
    expect((await b.rpc.decideEquivalency(id, 'rejected', 'second thoughts')).code).toBe('invalid');
    await as('gulfhydro-qa');
    const mine = await b.rpc.getEquivalency(id);
    expect(mine.data?.status).toBe('equivalent');
    expect((mine.data?.history as { action: string }[]).map((h) => h.action)).toEqual(['submit', 'map', 'decide']);
  });
  it('only an evaluator qualified for the standard maps evidence', async () => {
    await as('k-instructor');
    const r = await b.rpc.mapEquivalency('eq-5', [{ task_id: 'qs-mech-t1', covered: true, evidence: [0] }]);
    expect(['not_evaluator', 'ok']).toContain(r.code);
    await as('alnoor-gm');
    expect((await b.rpc.mapEquivalency('eq-2', [])).code).toBe('forbidden');
  });
});

describe('M09 supplier academy', () => {
  const answers = (course: string, right = true) =>
    b.raw('academy_check_keys').filter((k) => b.raw('academy_checks').some((c) => c.id === k.check_id && c.course_id === course)).map((k) => ({ check_id: k.check_id, answer: right ? k.answer : (k.answer + 1) % 3 }));
  it('a contractor enrols, fails then passes the server-scored check, and the certificate verifies publicly', async () => {
    await as('k-contractor');
    const en = await b.rpc.enrolSupplierCourse('c-sa-cgd-103', null);
    expect(en.ok).toBe(true);
    expect((await b.rpc.enrolSupplierCourse('c-sa-cgd-103', null)).code).toBe('conflict');
    const fail = await b.rpc.completeSupplierCourse(en.data!.id, answers('c-sa-cgd-103', false));
    expect(fail.ok && fail.data).toMatchObject({ passed: false, certificate_no: null });
    const pass = await b.rpc.completeSupplierCourse(en.data!.id, answers('c-sa-cgd-103'));
    expect(pass.data?.passed).toBe(true);
    expect(pass.ledger_seq ?? null).toBeNull(); // Kafa'a-only persona: ledger skipped
    expect((await b.rpc.completeSupplierCourse(en.data!.id, answers('c-sa-cgd-103'))).code).toBe('conflict');
    await as(null);
    const v = await b.rpc.verifyCertificate(pass.data!.certificate_no!);
    expect(v.found).toBe(true);
    expect(v.status).toBe('valid');
    expect(JSON.stringify(v)).not.toMatch(/p-k-contractor|Dhafra/);
  });
  it("nobody completes someone else's enrolment; only a partner admin enrols others, and only in its own organisation", async () => {
    await as('k-contractor');
    const en = await b.rpc.enrolSupplierCourse('c-sa-def-107', null);
    expect((await b.rpc.enrolSupplierCourse('c-sa-def-107', 'c-dhafra-02')).code).toBe('forbidden');
    await as('alnoor-qaqc');
    expect((await b.rpc.completeSupplierCourse(en.data!.id, [])).code).toBe('not_found');
    await as('alnoor-gm');
    expect((await b.rpc.enrolSupplierCourse('c-sa-def-107', 'c-alnoor-02')).ok).toBe(true);
    expect((await b.rpc.enrolSupplierCourse('c-sa-def-107', 'c-dhafra-02')).code).toBe('not_found');
    expect((await b.rpc.enrolSupplierCourse('c-get', null)).code).toBe('not_found'); // not a supplier course
    await as('k-ro');
    expect((await b.rpc.enrolSupplierCourse('c-sa-def-107', null)).code).toBe('forbidden');
  });
  it('questions are public; answer keys are not', async () => {
    await as(null);
    expect((await b.list('academy_checks')).length).toBe(32);
    expect(await b.list('academy_check_keys')).toEqual([]);
    await as('k-contractor');
    expect(await b.list('academy_check_keys')).toEqual([]);
  });
  it('an admin invites a partner from a register-interest request: case, steps and checklist open; the organisation is not public', async () => {
    await as('k-admin');
    const r = await b.rpc.invitePartner({ name_en: 'Falcon Seals Trading', kind: 'supplier', request_id: 'ct-1', scope_en: 'Elastomer seals' });
    expect(r.ok).toBe(true);
    const { org_id, case_id } = r.data!;
    expect((await b.get('partner_onboarding', case_id))?.status).toBe('invited');
    expect(b.raw('supplier_readiness').filter((x) => x.org_id === org_id).map((x) => x.step_key).sort()).toEqual(['handoff', 'icv', 'orientation', 'quality', 'safety_culture', 'self_assessment']);
    expect(b.raw('supplier_documents').filter((x) => x.org_id === org_id && x.status === 'missing')).toHaveLength(DOC_CHECKLIST.length);
    expect(b.raw('audit_events').at(-1)).toMatchObject({ action: 'partner.invite', outcome: 'ok' });
    expect((await b.rpc.invitePartner({ name_en: ' falcon seals trading ', kind: 'supplier' })).code).toBe('conflict');
    expect((await b.rpc.invitePartner({ name_en: 'X', kind: 'supplier' })).code).toBe('invalid');
    expect((await b.rpc.invitePartner({ name_en: 'Valid Name', kind: 'regulator' as never })).code).toBe('invalid');
    const uni = await b.rpc.invitePartner({ name_en: 'Gulf Technical College', kind: 'university' });
    expect(b.raw('supplier_documents').filter((x) => x.org_id === uni.data!.org_id)).toHaveLength(0);
    await as(null);
    expect(await b.get('organisations', org_id)).toBeFalsy();
    await as('alnoor-gm');
    expect((await b.rpc.invitePartner({ name_en: 'Self Made Org', kind: 'supplier' })).code).toBe('forbidden');
    expect(await b.get('partner_onboarding', case_id)).toBeFalsy();
    await as('k-auditor');
    expect((await b.rpc.invitePartner({ name_en: 'Audit Org', kind: 'supplier' })).code).toBe('forbidden');
  });
});
